import './styles/base.css';
import './styles/sections.css';
import './styles/animations.css';
import './styles/ui.css';
import './styles/outfit.css';

import { initSiteChrome } from './modules/siteChrome.js';
import { initReveal } from './modules/reveal.js';
import { openModal, closeModal } from './modules/modal.js';
import { toISO, formatRelativeGentle } from './modules/dates.js';
import * as store from './modules/wardrobeStore.js';
import { mountReminderStrip } from './modules/reminderUI.js';
import * as weatherApi from './modules/weather.js';
import { suggestOutfit, rankSlot, explainOutfit, SPARSE_CLOSET_LINE } from './modules/outfitEngine.js';

/**
 * outfit.js — renders outfit.html and wires its events (10-OUTFIT-OF-THE-DAY).
 *
 * Used in a hurry, half-awake, one-handed. The outfit is the landing content:
 * it renders from the cached forecast (or the season) before any network
 * round-trip, and the weather line refreshes in place afterwards. The closet
 * manager lives behind a disclosure below.
 *
 * Data goes through wardrobeStore.js and weather.js; the judgement is in
 * outfitEngine.js. This file never touches storage directly and never logs
 * anything about the closet or the location.
 */

/** The only console output in this file. Never pass it an item or a coordinate. */
function warn(message, err) {
  if (err !== undefined) console.warn(`[outfit] ${message}`, err);
  else console.warn(`[outfit] ${message}`);
}

/* ─────────────────────────────── tiny DOM helper ─────────────────────────────── */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') node.textContent = v;          // user text always goes through here
    else if (k === 'class') node.className = v;
    else if (k === 'value') node.value = v;
    else if (k === 'checked') node.checked = Boolean(v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/** replaceChildren that skips null/false, like el() does. */
function mount(parent, children) {
  parent.replaceChildren(...children.filter((c) => c !== null && c !== undefined && c !== false));
}

/* ─────────────────────────────── object URL registry ───────────────────────────────
   Every createObjectURL is owned by a "scope" (one per rendered grid / collage).
   Re-rendering releases the old scope, which revokes every URL it created. A
   blob that resolves after its scope was released is revoked immediately. */

const scopes = new Set();

function newScope() {
  const scope = { urls: new Set(), released: false };
  scopes.add(scope);
  return scope;
}

function releaseScope(scope) {
  if (!scope || scope.released) return;
  scope.released = true;
  scope.urls.forEach((url) => URL.revokeObjectURL(url));
  scope.urls.clear();
  scopes.delete(scope);
}

/** Show a photo on `img` and hide the emoji placeholder. */
function showPhoto(img, url, scope, revokeOnRelease = false) {
  if (scope.released) {
    if (revokeOnRelease) URL.revokeObjectURL(url);
    return;
  }
  // Blob URLs resolve async — if the tile was already torn down, drop them.
  // Static seed URLs are assigned synchronously *before* mount, so isConnected
  // is still false; those must be allowed through.
  if (revokeOnRelease && !img.isConnected) {
    URL.revokeObjectURL(url);
    return;
  }
  if (revokeOnRelease) scope.urls.add(url);
  img.src = url;
  img.hidden = false;
  const placeholder = img.parentElement && img.parentElement.querySelector('.outfit-tile__emoji');
  if (placeholder) placeholder.hidden = true;
}

/** Resolve a static seed photo against the site base (`/lovesite/`). */
function staticPhotoUrl(src) {
  if (!src) return null;
  if (/^(?:https?:|data:|blob:)/i.test(src)) return src;
  const base = import.meta.env.BASE_URL || '/';
  return base + String(src).replace(/^\.\//, '');
}

/** Load an item's photo into `img` (or show the placeholder) inside `scope`. */
function attachPhoto(img, item, scope) {
  if (!item) return;
  // Uploaded blob wins; seed items use a static photoSrc under ./outfits/.
  if (item.photoId) {
    store.getPhoto(item.photoId).then((blob) => {
      if (!blob) {
        const fallback = staticPhotoUrl(item.photoSrc);
        if (fallback) showPhoto(img, fallback, scope);
        return;
      }
      showPhoto(img, URL.createObjectURL(blob), scope, true);
    }).catch((err) => warn('photo load failed', err));
    return;
  }
  const url = staticPhotoUrl(item.photoSrc);
  if (url) showPhoto(img, url, scope);
}

window.addEventListener('pagehide', () => { scopes.forEach(releaseScope); });

/* ─────────────────────────────── page state ─────────────────────────────── */

const today = new Date();
const todayISO = toISO(today);

let location = weatherApi.DEFAULT_LOCATION;
let locationSource = 'default';
let weather = null;               // normalised forecast or null
let weatherState = 'loading';     // loading | ok | stale | failed
let occasion = guessOccasion(today);
let shuffleCount = 0;             // bumps the rng seed on "another option"
let recentPicks = [];             // core picks of the last few outfits; "another option" steers away from them
let current = null;               // { picks, reasons, warnings, score }
let closetFilter = 'all';
let outfitScope = null;
let closetScope = null;
let mounts = {};

/** Sunday → church, Saturday → errands, otherwise work. Changeable in one tap. */
function guessOccasion(d) {
  const day = d.getDay();
  if (day === 0) return 'church';
  if (day === 6) return 'errands';
  return 'work';
}

/** Small deterministic rng so the same day + occasion gives the same outfit until she asks for another. */
function seededRng(seedText) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ─────────────────────────────── feedback ─────────────────────────────── */

function announce(text) {
  const region = mounts.status;
  if (!region) return;
  region.textContent = '';
  setTimeout(() => { region.textContent = text; }, 30);
}

let toastEl = null;
let toastTimer = null;
function showToast(text, { sticky = false } = {}) {
  if (!toastEl) {
    toastEl = el('div', { class: 'usm-toast', role: 'status' });
    document.body.appendChild(toastEl);
  }
  const card = el('div', { class: 'usm-toast__card' }, [el('span', { text })]);
  if (sticky) card.appendChild(el('button', { type: 'button', class: 'usm-toast__close', 'aria-label': 'Dismiss', text: '×', onclick: hideToast }));
  toastEl.replaceChildren(card);
  toastEl.classList.add('is-open');
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(hideToast, 2200);
}
function hideToast() {
  if (toastEl) toastEl.classList.remove('is-open');
}

function showBanner(text) {
  const b = mounts.banner;
  if (!b) return;
  b.textContent = text;
  b.hidden = false;
}
function hideBanner() {
  if (mounts.banner) mounts.banner.hidden = true;
}

/* ─────────────────────────────── sheet ─────────────────────────────── */

let sheet = null;
let sheetTitleId = 0;

function getSheet() {
  if (sheet) return sheet;
  sheet = el('div', { class: 'usm-modal outfit-sheet', role: 'dialog', 'aria-modal': 'true', 'data-focus-trap': true, hidden: true }, [
    el('div', { class: 'usm-modal__scrim', 'data-modal-close': true }),
    el('div', { class: 'usm-modal__card outfit-sheet__card' }),
  ]);
  document.body.appendChild(sheet);
  return sheet;
}

/** @param {{ title?: string, body: Node[], initialFocus?: HTMLElement, onClose?: () => void }} opts */
function openSheet({ title, body, initialFocus, onClose }) {
  const s = getSheet();
  // modal.js finishes a close ~300ms later; wait it out so the new sheet does not vanish underneath.
  if (!s.hidden && !s.classList.contains('is-open')) {
    setTimeout(() => openSheet({ title, body, initialFocus, onClose }), 320);
    return;
  }
  const card = s.querySelector('.outfit-sheet__card');
  const id = `outfitSheetTitle${++sheetTitleId}`;
  mount(card, [
    el('div', { class: 'outfit-sheet__grip', 'aria-hidden': 'true' }),
    title ? el('h3', { id, class: 'outfit-sheet__title', text: title }) : null,
    ...body,
  ]);
  if (title) s.setAttribute('aria-labelledby', id); else s.removeAttribute('aria-labelledby');
  openModal(s, { initialFocus, onClose });
}

function closeSheet() {
  if (sheet && !sheet.hidden) closeModal(sheet);
}

function openConfirm({ title, text, confirmLabel, onConfirm }) {
  const confirmBtn = el('button', { type: 'button', class: 'usm-btn usm-btn--primary', text: confirmLabel, onclick: () => { closeSheet(); onConfirm(); } });
  openSheet({
    title,
    body: [
      el('p', { class: 'outfit-sheet__text', text }),
      el('div', { class: 'usm-modal__actions' }, [
        confirmBtn,
        el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', 'data-modal-close': true, text: 'Cancel' }),
      ]),
    ],
    initialFocus: confirmBtn,
  });
}

/* ─────────────────────────────── weather line ─────────────────────────────── */

function renderWeather() {
  const m = mounts.weather;
  if (!m) return;

  if (weatherState === 'loading' && !weather) {
    mount(m, [
      el('div', { class: 'outfit-weather__line' }, [
        el('span', { class: 'usm-skeleton outfit-weather__skeleton', 'aria-hidden': 'true' }),
        el('span', { class: 'sr-only', text: 'Checking the weather…' }),
      ]),
      locationLine(),
    ]);
    return;
  }

  if (!weather) {
    mount(m, [
      el('div', { class: 'outfit-weather__line outfit-weather__line--none' }, [
        el('span', { class: 'outfit-weather__emoji', 'aria-hidden': 'true', text: '\u{1F324}\u{FE0F}' }),
        el('span', { class: 'outfit-weather__temp', text: '—' }),
        el('span', { class: 'outfit-weather__desc', text: 'No forecast right now' }),
      ]),
      locationLine(),
    ]);
    return;
  }

  const feels = weatherApi.formatTemp(weather.feelsLikeC);
  const temp = weatherApi.formatTemp(weather.tempC);
  const cond = weatherApi.CONDITION_LABELS[weather.condition] || 'Cloudy';
  const emoji = weatherApi.CONDITION_EMOJI[weather.condition] || '\u{2601}\u{FE0F}';
  const bits = [];
  if (Math.abs((weather.feelsLikeC ?? 0) - (weather.tempC ?? 0)) >= 2) bits.push(`${temp} on paper`);
  if (typeof weather.tempMinC === 'number' && typeof weather.tempMaxC === 'number') bits.push(`${weatherApi.formatTemp(weather.tempMinC)} to ${weatherApi.formatTemp(weather.tempMaxC)} today`);
  if (weather.windKph >= 20) bits.push(`wind ${Math.round(weather.windKph)} km/h`);
  if (weather.precipChance >= 30) bits.push(`${Math.round(weather.precipChance)}% chance of ${weather.condition === 'snow' ? 'snow' : 'rain'}`);

  mount(m, [
    el('div', { class: 'outfit-weather__line' }, [
      el('span', { class: 'outfit-weather__emoji', 'aria-hidden': 'true', text: emoji }),
      el('span', { class: 'outfit-weather__temp' }, [
        el('span', { text: feels }),
        el('span', { class: 'outfit-weather__feels', text: ' feels like' }),
      ]),
      el('span', { class: 'outfit-weather__desc', text: cond }),
      weatherState === 'stale' ? el('span', { class: 'usm-tone usm-tone--quiet', text: staleLabel(weather.fetchedAt) }) : null,
    ]),
    bits.length ? el('p', { class: 'outfit-weather__bits', text: bits.join(' · ') }) : null,
    locationLine(),
  ]);
}

function staleLabel(fetchedAt) {
  const rel = formatRelativeGentle(fetchedAt, today);
  return rel === 'today' ? 'from earlier today' : `from ${rel}`;
}

function locationLine() {
  const label = location.label || 'Here';
  return el('p', { class: 'outfit-weather__where' }, [
    el('span', { text: `${label}${locationSource === 'default' ? ' (assumed)' : ''}` }),
    ' · ',
    el('button', { type: 'button', class: 'outfit-linkbtn', text: 'change', onclick: openLocationSheet }),
  ]);
}

/* ─────────────────────────────── occasions ─────────────────────────────── */

function renderOccasions() {
  const m = mounts.occasions;
  if (!m) return;
  const selected = store.OCCASION_OPTIONS.find((o) => o.id === occasion);
  mount(m, [
    el('div', { class: 'outfit-occasions__heading' }, [
      el('p', { class: 'outfit-occasions__label', id: 'occasionLabel', text: 'What kind of day is it?' }),
      el('span', { class: 'outfit-occasions__selected', text: selected ? `${selected.emoji} ${selected.label}` : '' }),
    ]),
    el('div', { class: 'outfit-occasions__row', role: 'group', 'aria-labelledby': 'occasionLabel' },
      store.OCCASION_OPTIONS.map((o) => el('button', {
        type: 'button',
        class: 'usm-pill outfit-chip',
        'aria-pressed': o.id === occasion ? 'true' : 'false',
        onclick: () => {
          if (occasion === o.id) return;
          occasion = o.id;
          shuffleCount = 0;
          recentPicks = [];
          renderOccasions();
          computeOutfit();
          renderOutfit();
          announce(`${o.label}. Outfit updated.`);
        },
      }, [
        el('span', { 'aria-hidden': 'true', text: o.emoji }),
        el('span', { text: o.label }),
      ]))),
    el('p', { class: 'outfit-occasions__hint', text: 'Choose the plan, then tap any clothing card to swap just that piece.' }),
  ]);
}

/* ─────────────────────────────── outfit ─────────────────────────────── */

function computeOutfit() {
  const wardrobe = store.listItems();
  if (wardrobe.length === 0) { current = null; return; }
  current = suggestOutfit({
    wardrobe,
    weather,
    occasion,
    date: todayISO,
    exclude: excludeIds(),
    rng: seededRng(`${todayISO}|${occasion}|${shuffleCount}`),
  });
}

const SLOT_META = {
  layer: { label: 'Layer', emoji: '\u{1F9E5}' },
  dress: { label: 'Dress', emoji: '\u{1F457}' },
  top: { label: 'Top', emoji: '\u{1F455}' },
  bottom: { label: 'Bottom', emoji: '\u{1F456}' },
  shoes: { label: 'Shoes', emoji: '\u{1F45F}' },
  bags: { label: 'Bag', emoji: '\u{1F45C}' },
  jewellery: { label: 'Jewellery', emoji: '\u{1F48D}' },
  accessories: { label: 'Extra', emoji: '\u{1F9E3}' },
};

function categoryEmoji(category) {
  const row = store.CATEGORIES.find((c) => c.id === category);
  return row ? row.emoji : '\u{1F455}';
}

function pickedIds() {
  if (!current) return [];
  const p = current.picks;
  return [p.layer, p.dress, p.top, p.bottom, p.shoes, ...p.accessories].filter(Boolean).map((i) => i.id);
}

/** Core slots only — accessories are never steered away from, or they would simply vanish. */
function corePickedIds() {
  if (!current) return [];
  const p = current.picks;
  return [p.layer, p.dress, p.top, p.bottom, p.shoes].filter(Boolean).map((i) => i.id);
}

function excludeIds() {
  return Array.from(new Set(recentPicks.flat()));
}

function combinationCount(wardrobe) {
  const count = (category) => wardrobe.filter((item) => item.category === category && !item.archived).length;
  const tops = count('tops');
  const bottoms = count('bottoms');
  const dresses = count('dresses');
  const shoes = Math.max(1, count('shoes'));
  const layerChoices = Math.max(1, count('jackets') + 1); // "+1" is no layer.
  return ((tops * bottoms) + dresses) * shoes * layerChoices;
}

function renderOutfit() {
  const m = mounts.today;
  if (!m) return;
  releaseScope(outfitScope);
  outfitScope = newScope();

  const wardrobe = store.listItems();
  if (wardrobe.length === 0) {
    renderEmptyCloset(m);
    return;
  }
  if (!current) computeOutfit();
  if (!current) return;

  const { picks, reasons, warnings } = current;

  // Tiles: layer, then dress or top+bottom, then shoes, then whatever accessories exist.
  const tiles = [];
  const pushTile = (slot, item) => { if (item) tiles.push(renderPickTile(slot, item)); };
  pushTile('layer', picks.layer);
  if (picks.dress) pushTile('dress', picks.dress);
  else { pushTile('top', picks.top); pushTile('bottom', picks.bottom); }
  pushTile('shoes', picks.shoes);
  for (const acc of picks.accessories) {
    const slot = acc.category === 'bags' ? 'bags' : acc.category === 'jewellery' ? 'jewellery' : 'accessories';
    pushTile(slot, acc);
  }

  const settings = store.getSettings();
  const sparse = wardrobe.length < 8 && !settings.sparseNoteShown;
  if (sparse) store.updateSettings({ sparseNoteShown: true });

  mount(m, [
    el('div', { class: 'outfit-today__heading' }, [
      el('div', {}, [
        el('p', { class: 'outfit-today__eyebrow', text: 'Picked from her closet' }),
        el('h2', { class: 'outfit-today__title', text: 'Today’s look' }),
      ]),
      el('span', { class: 'outfit-look-number', text: `Look ${shuffleCount + 1}` }),
    ]),
    el('p', { class: 'outfit-headline', text: reasons[0] || 'Here’s today.' }),
    el('ul', { class: 'outfit-collage', 'aria-label': 'Today’s pieces — tap one to swap it' }, tiles),
    reasons.length > 1 ? el('ul', { class: 'outfit-why', 'aria-label': 'Why these' }, reasons.slice(1).map((r) => el('li', { text: r }))) : null,
    warnings.length ? el('ul', { class: 'outfit-warnings' }, warnings.map((w) => el('li', { text: w }))) : null,
    el('div', { class: 'outfit-actions' }, [
      el('button', { type: 'button', class: 'usm-btn usm-btn--primary outfit-remix', text: '✨ Mix another look', onclick: reshuffle }),
      el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', text: 'That’s what I wore', onclick: openWoreSheet }),
    ]),
    el('p', {
      class: 'outfit-combo-note',
      text: `${wardrobe.length} pieces · about ${combinationCount(wardrobe).toLocaleString()} core combinations before weather and occasion`,
    }),
    sparse ? el('p', { class: 'outfit-sparse', text: SPARSE_CLOSET_LINE }) : null,
  ]);
}

function renderPickTile(slot, item) {
  const meta = SLOT_META[slot] || SLOT_META.accessories;
  const img = el('img', { class: 'outfit-tile__img', alt: '', hidden: true });
  const tile = el('button', {
    type: 'button',
    class: `outfit-tile outfit-tile--${slot}`,
    'aria-label': `${meta.label}: ${item.name}. Swap.`,
    onclick: () => openSwapSheet(slot, item),
  }, [
    el('span', { class: 'outfit-tile__photo' }, [
      el('span', { class: 'outfit-tile__emoji', 'aria-hidden': 'true', text: categoryEmoji(item.category) }),
      img,
    ]),
    el('span', { class: 'outfit-tile__slot', text: meta.label }),
    el('span', { class: 'outfit-tile__name', text: item.name }),
  ]);
  attachPhoto(img, item, outfitScope);
  return el('li', { class: 'outfit-collage__cell' }, [tile]);
}

function renderEmptyCloset(m) {
  const addBtn = el('button', { type: 'button', class: 'usm-btn usm-btn--primary', text: 'Add your first few things', onclick: () => openItemSheet(null) });
  mount(m, [
    el('div', { class: 'usm-empty outfit-empty' }, [
      el('p', { class: 'outfit-empty__line', text: 'Tell me what your day looks like and I’ll figure out what to wear from the clothes you already own.' }),
      el('p', { class: 'outfit-empty__sub', text: 'It only ever suggests things that are actually in here.' }),
      el('div', { class: 'outfit-actions' }, [
        addBtn,
        el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', text: 'or add a whole batch', onclick: openBatchSheet }),
      ]),
    ]),
  ]);
}

function reshuffle() {
  if (!current) return;
  // Steer away from the last three outfits, not from everything ever shown —
  // a small closet must keep producing options rather than running out.
  const before = corePickedIds().join(',');
  recentPicks = [...recentPicks, corePickedIds()].slice(-3);
  shuffleCount += 1;
  computeOutfit();
  // With a small closet every combination can be "recent"; one more roll of the seed avoids an identical repeat.
  if (corePickedIds().join(',') === before) {
    shuffleCount += 1;
    computeOutfit();
  }
  renderOutfit();
  announce('Another option.');
  const headline = mounts.today.querySelector('.outfit-headline');
  if (headline) {
    headline.classList.add('is-fresh');
    setTimeout(() => headline.classList.remove('is-fresh'), 600);
  }
}

/* ─────────────────────────────── swap one slot ─────────────────────────────── */

function openSwapSheet(slot, currentItem) {
  const ranked = rankSlot({
    wardrobe: store.listItems(),
    weather,
    occasion,
    date: todayISO,
    slot,
    rng: seededRng(`${todayISO}|swap|${slot}`),
  }).filter((c) => c.item.id !== currentItem.id);

  const meta = SLOT_META[slot] || SLOT_META.accessories;
  const noteFor = (c) => {
    if (c.eligible && !c.note) return null;
    if (c.note === 'extremeExcluded' || c.note === 'extremeNoLayer' || c.note === 'extremeNoBoots') return 'too light for today';
    if (c.note === 'hotExcluded') return 'too warm for today';
    if (c.note === 'formalityFallback') return `a bit relaxed for ${occasion}`;
    return null;
  };

  const list = ranked.length
    ? el('div', { class: 'outfit-sheet__options' }, ranked.slice(0, 12).map((c) => {
        const note = noteFor(c);
        return el('button', {
          type: 'button',
          class: 'usm-btn usm-btn--secondary outfit-sheet__option',
          onclick: () => { swapSlot(slot, currentItem, c.item); closeSheet(); },
        }, [
          el('span', { class: 'outfit-sheet__optname', text: c.item.name }),
          note ? el('span', { class: 'usm-tone usm-tone--quiet', text: note }) : null,
        ]);
      }))
    : el('p', { class: 'outfit-sheet__text', text: `That’s the only ${meta.label.toLowerCase()} in the closet so far.` });

  openSheet({
    title: `Swap the ${meta.label.toLowerCase()}`,
    body: [
      el('p', { class: 'outfit-sheet__text', text: `Instead of ${currentItem.name}. Everything else stays put.` }),
      list,
      el('div', { class: 'usm-modal__actions' }, [
        el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', 'data-modal-close': true, text: 'Keep it' }),
      ]),
    ],
  });
}

function swapSlot(slot, oldItem, newItem) {
  if (!current) return;
  const picks = { ...current.picks, accessories: [...current.picks.accessories] };
  if (slot === 'bags' || slot === 'jewellery' || slot === 'accessories') {
    picks.accessories = picks.accessories.map((a) => (a.id === oldItem.id ? newItem : a));
  } else {
    picks[slot] = newItem;
  }
  const { reasons, warnings } = explainOutfit({ picks, weather, occasion, date: todayISO, rng: seededRng(`${todayISO}|${occasion}|${shuffleCount}`) });
  current = { ...current, picks, reasons, warnings };
  renderOutfit();
  announce(`Swapped to ${newItem.name}.`);
}

/* ─────────────────────────────── that's what I wore ─────────────────────────────── */

function openWoreSheet() {
  if (!current) return;
  const ids = pickedIds();
  const names = [current.picks.layer, current.picks.dress, current.picks.top, current.picks.bottom, current.picks.shoes, ...current.picks.accessories]
    .filter(Boolean).map((i) => i.name);

  const extraName = el('input', { type: 'text', class: 'usm-input', id: 'woreExtraName', placeholder: 'e.g. the green cardigan', maxlength: '80', autocomplete: 'off' });
  const extraCat = el('select', { class: 'usm-select', id: 'woreExtraCat', 'aria-label': 'Category' },
    store.CATEGORIES.map((c) => el('option', { value: c.id, text: c.label })));

  const save = el('button', { type: 'button', class: 'usm-btn usm-btn--primary', text: 'Noted', onclick: () => {
    const extra = extraName.value.trim();
    let addedName = null;
    if (extra) {
      try {
        const item = store.addItem({ name: extra, category: extraCat.value, lastWornAt: todayISO });
        addedName = item.name;
        ids.push(item.id);
      } catch (err) {
        warn('lazy add failed', err);
      }
    }
    store.markWorn(ids, today);
    closeSheet();
    renderCloset();
    showToast(addedName ? `Noted — and ${addedName} is in the closet now.` : 'Noted.');
    announce('Saved.');
  } });

  openSheet({
    title: 'That’s what you wore',
    body: [
      el('p', { class: 'outfit-sheet__text', text: names.join(', ') + '.' }),
      el('div', { class: 'usm-field' }, [
        el('label', { class: 'usm-field__label', for: 'woreExtraName', text: 'Wore something that isn’t in here?' }),
        el('div', { class: 'outfit-form__pair' }, [extraName, extraCat]),
        el('p', { class: 'usm-field__hint', text: 'One line adds it. You can fill in the rest later, or never.' }),
      ]),
      el('div', { class: 'usm-modal__actions' }, [
        save,
        el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', 'data-modal-close': true, text: 'Cancel' }),
      ]),
    ],
    initialFocus: save,
  });
}

/* ─────────────────────────────── location ─────────────────────────────── */

function openLocationSheet() {
  const select = el('select', { class: 'usm-select', id: 'locationSelect', 'aria-label': 'City' },
    weatherApi.PRESET_LOCATIONS.map((p) => el('option', { value: p.label, text: p.label, selected: p.label === location.label ? true : null })));

  const useCity = el('button', { type: 'button', class: 'usm-btn usm-btn--primary', text: 'Use this city', onclick: () => {
    const preset = weatherApi.PRESET_LOCATIONS.find((p) => p.label === select.value);
    if (!preset) return;
    weatherApi.setSavedLocation(preset);
    closeSheet();
    applyLocation(preset, 'saved');
  } });

  const useMine = el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', text: 'Use my location', onclick: async () => {
    useMine.disabled = true;
    useMine.textContent = 'Asking…';
    const result = await weatherApi.requestGeolocation();
    useMine.disabled = false;
    useMine.textContent = 'Use my location';
    if (result.ok) {
      weatherApi.setSavedLocation(result.location);
      closeSheet();
      applyLocation(result.location, 'saved');
      return;
    }
    const why = {
      denied: 'No problem — location stays off. Pick a city instead.',
      timeout: 'The browser didn’t answer. Pick a city instead, or try again.',
      unavailable: 'Couldn’t get a location right now. Pick a city instead.',
      insecure: 'Location only works over HTTPS. Pick a city instead.',
      unsupported: 'This browser can’t share location. Pick a city instead.',
    }[result.reason] || 'Pick a city instead.';
    showToast(why, { sticky: true });
  } });

  openSheet({
    title: 'Where are you?',
    body: [
      el('p', { class: 'outfit-sheet__text', text: 'Only the weather uses this. Open-Meteo gets a rounded location — about a kilometre — and nothing else.' }),
      el('div', { class: 'usm-field' }, [
        el('label', { class: 'usm-field__label', for: 'locationSelect', text: 'City' }),
        select,
      ]),
      el('div', { class: 'usm-modal__actions' }, [
        useCity,
        useMine,
        el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', 'data-modal-close': true, text: 'Cancel' }),
      ]),
    ],
    initialFocus: select,
  });
}

function applyLocation(loc, source) {
  location = loc;
  locationSource = source;
  weather = null;
  weatherState = 'loading';
  renderWeather();
  loadWeather();
}

/* ─────────────────────────────── weather loading ─────────────────────────────── */

/** Render from cache instantly, then refresh in the background and update in place. */
async function loadWeather() {
  const cached = weatherApi.readCachedWeather(location);
  if (cached) {
    weather = cached.weather;
    weatherState = cached.stale ? 'stale' : 'ok';
    hideBanner();
    renderWeather();
    computeOutfit();
    renderOutfit();
    if (!cached.stale) return;
  } else {
    // Nothing cached: the outfit renders from the season straight away; the weather line shows a skeleton.
    weatherState = 'loading';
    renderWeather();
    computeOutfit();
    renderOutfit();
  }

  const result = await weatherApi.getWeather(location, { refresh: true });
  if (result.weather && !result.stale) {
    const changed = !weather || Math.abs((weather.feelsLikeC ?? 0) - result.weather.feelsLikeC) >= 2 || weather.condition !== result.weather.condition;
    weather = result.weather;
    weatherState = 'ok';
    hideBanner();
    renderWeather();
    if (changed) { computeOutfit(); renderOutfit(); }
  } else if (result.weather) {
    weather = result.weather;
    weatherState = 'stale';
    renderWeather();
    showBanner('Couldn’t reach the weather just now — this is from the last forecast I had.');
  } else {
    weather = null;
    weatherState = 'failed';
    renderWeather();
    computeOutfit();
    renderOutfit();
    showBanner('Couldn’t get today’s weather — this is based on the season.');
  }
}

/* ─────────────────────────────── closet manager ─────────────────────────────── */

function renderCloset() {
  const body = mounts.closetBody;
  if (!body) return;
  releaseScope(closetScope);
  closetScope = newScope();

  const all = store.listItems({ includeArchived: true });
  const active = all.filter((it) => !it.archived);
  if (mounts.closetCount) mounts.closetCount.textContent = active.length ? `${active.length} ${active.length === 1 ? 'thing' : 'things'}` : '';

  const settings = store.getSettings();

  const toolbar = el('div', { class: 'outfit-closet__toolbar' }, [
    el('button', { type: 'button', class: 'usm-btn usm-btn--primary', text: '+ Add an item', onclick: () => openItemSheet(null) }),
    el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', text: 'Add a batch', onclick: openBatchSheet }),
    el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', text: 'Backup', onclick: exportBackup }),
    el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', text: 'Import', onclick: () => mounts.importInput.click() }),
  ]);

  const filters = el('div', { class: 'outfit-closet__filters', role: 'group', 'aria-label': 'Filter by category' }, [
    filterChip('all', 'All'),
    ...store.CATEGORIES.map((c) => filterChip(c.id, c.label)),
  ]);

  const shown = active.filter((it) => closetFilter === 'all' || it.category === closetFilter);
  const archived = all.filter((it) => it.archived);

  const grid = shown.length
    ? el('ul', { class: 'outfit-grid' }, shown.map(renderClosetTile))
    : el('p', { class: 'outfit-closet__none', text: active.length ? 'Nothing in this category yet.' : 'Nothing here yet.' });

  const reminderToggle = el('label', { class: 'outfit-closet__toggle' }, [
    el('input', { type: 'checkbox', checked: settings.morningReminder, onchange: (e) => {
      store.updateSettings({ morningReminder: e.target.checked });
      store.syncMorningReminder(today);
    } }),
    el('span', { text: 'A morning nudge that today’s outfit is ready (only if reminders are set up)' }),
  ]);

  mount(body, [
    toolbar,
    filters,
    grid,
    archived.length ? el('details', { class: 'outfit-closet__archived' }, [
      el('summary', { text: `Put away (${archived.length})` }),
      el('ul', { class: 'outfit-grid' }, archived.map(renderClosetTile)),
    ]) : null,
    reminderToggle,
    el('p', { class: 'outfit-closet__note', text: 'Your item details live in this browser. Photos stay on this device — a backup includes the details, not the photos.' }),
  ]);
}

function filterChip(id, label) {
  return el('button', {
    type: 'button',
    class: 'usm-pill outfit-chip outfit-chip--small',
    'aria-pressed': closetFilter === id ? 'true' : 'false',
    text: label,
    onclick: () => { closetFilter = id; renderCloset(); },
  });
}

function renderClosetTile(item) {
  const img = el('img', { class: 'outfit-tile__img', alt: '', hidden: true });
  const metaBits = [];
  if (item.warmth) metaBits.push(store.warmthLabel(item.warmth));
  if (item.formality) metaBits.push(store.formalityLabel(item.formality));
  if (item.waterproof) metaBits.push('waterproof');
  const tile = el('button', {
    type: 'button',
    class: 'outfit-tile outfit-tile--closet',
    'aria-label': `${item.name}, ${store.categoryLabel(item.category)}. Edit.`,
    onclick: () => openItemSheet(item.id),
  }, [
    el('span', { class: 'outfit-tile__photo' }, [
      el('span', { class: 'outfit-tile__emoji', 'aria-hidden': 'true', text: categoryEmoji(item.category) }),
      img,
    ]),
    el('span', { class: 'outfit-tile__name', text: item.name }),
    el('span', { class: 'outfit-tile__meta', text: metaBits.join(' · ') || store.categoryLabel(item.category) }),
  ]);
  attachPhoto(img, item, closetScope);
  return el('li', { class: 'outfit-grid__cell' }, [tile]);
}

/* ─────────────────────────────── add / edit item ─────────────────────────────── */

function openItemSheet(id) {
  const existing = id ? store.getItem(id) : null;
  const f = {};
  let pendingPhoto = null;    // File chosen but not yet stored
  let removePhoto = false;
  const previewScope = newScope();

  f.name = el('input', { type: 'text', class: 'usm-input', id: 'itemName', value: existing?.name || '', maxlength: '80', autocomplete: 'off', placeholder: 'e.g. Camel trench' });
  f.category = el('select', { class: 'usm-select', id: 'itemCategory' },
    store.CATEGORIES.map((c) => el('option', { value: c.id, text: c.label, selected: (existing?.category || 'tops') === c.id ? true : null })));
  f.colour = el('input', { type: 'text', class: 'usm-input', id: 'itemColour', value: existing?.colour || '', maxlength: '40', placeholder: 'optional' });
  f.style = el('input', { type: 'text', class: 'usm-input', id: 'itemStyle', value: existing?.style || '', maxlength: '40', placeholder: 'optional' });
  f.warmth = el('select', { class: 'usm-select', id: 'itemWarmth' }, [
    el('option', { value: '', text: 'Not sure' }),
    ...store.WARMTH_SCALE.map((w) => el('option', { value: String(w.value), text: `${w.label} — ${w.hint}`, selected: existing?.warmth === w.value ? true : null })),
  ]);
  f.formality = el('select', { class: 'usm-select', id: 'itemFormality' }, [
    el('option', { value: '', text: 'Not sure' }),
    ...store.FORMALITY_SCALE.map((w) => el('option', { value: String(w.value), text: w.label, selected: existing?.formality === w.value ? true : null })),
  ]);
  f.waterproof = el('input', { type: 'checkbox', id: 'itemWaterproof', checked: Boolean(existing?.waterproof) });
  f.notes = el('textarea', { class: 'usm-textarea', id: 'itemNotes', maxlength: '300', rows: '2', placeholder: 'optional' });
  f.notes.value = existing?.notes || '';
  f.archived = el('input', { type: 'checkbox', id: 'itemArchived', checked: Boolean(existing?.archived) });

  const seasonBoxes = store.SEASON_OPTIONS.map((s) => checkChip(`season-${s.id}`, s.label, (existing?.season || []).includes(s.id)));
  const occasionBoxes = store.OCCASION_OPTIONS.map((o) => checkChip(`occ-${o.id}`, o.label, (existing?.occasions || []).includes(o.id)));

  // Photo
  const hasPhoto = Boolean(existing?.photoId || existing?.photoSrc);
  const previewImg = el('img', { class: 'outfit-form__preview-img', alt: '', hidden: true });
  const previewEmoji = el('span', { class: 'outfit-tile__emoji', 'aria-hidden': 'true', text: categoryEmoji(existing?.category || 'tops') });
  const fileInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'sr-only', id: 'itemPhoto', tabindex: '-1' });
  const photoBtn = el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', text: hasPhoto ? 'Replace photo' : 'Add a photo', onclick: () => fileInput.click() });
  const photoRemove = el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', text: 'Remove photo', hidden: !hasPhoto, onclick: () => {
    pendingPhoto = null;
    removePhoto = true;
    previewImg.hidden = true;
    previewEmoji.hidden = false;
    photoRemove.hidden = true;
    photoBtn.textContent = 'Add a photo';
  } });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    pendingPhoto = file;
    removePhoto = false;
    previewScope.urls.forEach((u) => URL.revokeObjectURL(u));
    previewScope.urls.clear();
    const url = URL.createObjectURL(file);
    previewScope.urls.add(url);
    previewImg.src = url;
    previewImg.hidden = false;
    previewEmoji.hidden = true;
    photoRemove.hidden = false;
    photoBtn.textContent = 'Replace photo';
  });
  if (hasPhoto) attachPhoto(previewImg, existing, previewScope);

  const warmthField = el('div', { class: 'usm-field', id: 'warmthField' }, [
    el('label', { class: 'usm-field__label', for: 'itemWarmth', text: 'How warm is it?' }),
    f.warmth,
  ]);
  const waterproofField = el('label', { class: 'outfit-form__check', id: 'waterproofField' }, [f.waterproof, el('span', { text: 'Waterproof' })]);

  const syncCategoryFields = () => {
    const cat = f.category.value;
    warmthField.hidden = !(store.WARMTH_CATEGORIES.includes(cat) || store.OPTIONAL_WARMTH_CATEGORIES.includes(cat));
    waterproofField.hidden = !store.WATERPROOF_CATEGORIES.includes(cat);
    previewEmoji.textContent = categoryEmoji(cat);
  };
  f.category.addEventListener('change', syncCategoryFields);
  syncCategoryFields();

  const error = el('p', { class: 'usm-field__error', role: 'alert', hidden: true });

  const save = el('button', { type: 'button', class: 'usm-btn usm-btn--primary', text: existing ? 'Save' : 'Add it', onclick: async () => {
    const input = {
      name: f.name.value,
      category: f.category.value,
      colour: f.colour.value,
      style: f.style.value,
      warmth: f.warmth.value ? Number(f.warmth.value) : null,
      formality: f.formality.value ? Number(f.formality.value) : null,
      season: seasonBoxes.filter((b) => b.input.checked).map((b) => b.id),
      occasions: occasionBoxes.filter((b) => b.input.checked).map((b) => b.id),
      waterproof: f.waterproof.checked,
      notes: f.notes.value,
      archived: f.archived.checked,
    };
    let item;
    try {
      item = existing ? store.updateItem(existing.id, input) : store.addItem(input);
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      f.name.focus();
      return;
    }
    save.disabled = true;
    try {
      if (removePhoto) {
        if (existing?.photoId) await store.removePhoto(item.id);
        if (existing?.photoSrc) store.updateItem(item.id, { photoSrc: null });
      }
      if (pendingPhoto) {
        const photoId = await store.setPhoto(item.id, pendingPhoto);
        if (!photoId) showToast('Saved the item, but the photo could not be stored on this device.', { sticky: true });
      }
    } catch (err) {
      warn('photo save failed', err);
      showToast('Saved the item, but that photo couldn’t be read. Try another.', { sticky: true });
    }
    save.disabled = false;
    closeSheet();
    afterClosetChange(existing ? 'Saved.' : `${item.name} is in the closet.`);
  } });

  const del = existing ? el('button', { type: 'button', class: 'usm-btn usm-btn--ghost outfit-form__delete', text: 'Delete', onclick: () => {
    openConfirm({
      title: `Delete ${existing.name}?`,
      text: 'It comes out of the closet and its photo goes with it. “Put away” keeps it around instead.',
      confirmLabel: 'Delete',
      onConfirm: async () => { await store.deleteItem(existing.id); afterClosetChange('Deleted.'); },
    });
  } }) : null;

  openSheet({
    title: existing ? 'Edit' : 'Add to the closet',
    body: [
      el('form', { class: 'outfit-form', onsubmit: (e) => { e.preventDefault(); save.click(); } }, [
        el('div', { class: 'outfit-form__grid' }, [
          el('div', { class: 'usm-field' }, [el('label', { class: 'usm-field__label', for: 'itemName', text: 'Name' }), f.name]),
          el('div', { class: 'usm-field' }, [el('label', { class: 'usm-field__label', for: 'itemCategory', text: 'Category' }), f.category]),
        ]),
        el('p', { class: 'usm-field__hint', text: 'A name and a category is enough. Everything else helps, none of it is required.' }),
        el('div', { class: 'outfit-form__photo' }, [
          el('span', { class: 'outfit-form__preview' }, [previewEmoji, previewImg]),
          el('div', { class: 'outfit-form__photo-actions' }, [photoBtn, photoRemove, fileInput]),
        ]),
        warmthField,
        el('div', { class: 'usm-field' }, [el('label', { class: 'usm-field__label', for: 'itemFormality', text: 'How dressed-up?' }), f.formality]),
        el('fieldset', { class: 'outfit-form__set' }, [el('legend', { class: 'usm-field__label', text: 'Seasons (none = any)' }), el('div', { class: 'outfit-form__chips' }, seasonBoxes.map((b) => b.label))]),
        el('fieldset', { class: 'outfit-form__set' }, [el('legend', { class: 'usm-field__label', text: 'Good for (none = anything)' }), el('div', { class: 'outfit-form__chips' }, occasionBoxes.map((b) => b.label))]),
        waterproofField,
        el('div', { class: 'outfit-form__grid' }, [
          el('div', { class: 'usm-field' }, [el('label', { class: 'usm-field__label', for: 'itemColour', text: 'Colour' }), f.colour]),
          el('div', { class: 'usm-field' }, [el('label', { class: 'usm-field__label', for: 'itemStyle', text: 'Style' }), f.style]),
        ]),
        el('div', { class: 'usm-field' }, [el('label', { class: 'usm-field__label', for: 'itemNotes', text: 'Notes' }), f.notes]),
        existing ? el('label', { class: 'outfit-form__check' }, [f.archived, el('span', { text: 'Put away for now (won’t be suggested)' })]) : null,
        error,
        el('div', { class: 'usm-modal__actions' }, [
          save,
          el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', 'data-modal-close': true, text: 'Cancel' }),
          del,
        ]),
      ]),
    ],
    initialFocus: f.name,
    onClose: () => releaseScope(previewScope),
  });
}

function checkChip(id, label, checked) {
  const pill = el('span', { class: 'usm-pill outfit-chip outfit-chip--small' + (checked ? ' is-selected' : ''), text: label });
  const input = el('input', { type: 'checkbox', id: `chip-${id}`, class: 'outfit-chipcheck__input', checked, onchange: () => pill.classList.toggle('is-selected', input.checked) });
  const wrapper = el('label', { class: 'outfit-chipcheck', for: `chip-${id}` }, [input, pill]);
  return { id: id.replace(/^(season|occ)-/, ''), input, label: wrapper };
}

/* ─────────────────────────────── batch add ─────────────────────────────── */

const BATCH_HINT = 'One per line: name, category, warmth, dressed-up — the last two optional.\n' +
  'e.g.  Camel trench, jackets, mid, professional\n' +
  '      Black jeans, bottoms, mid\n' +
  '      Gold hoops, jewellery';

function parseBatch(text) {
  const catByLabel = new Map(store.CATEGORIES.map((c) => [c.label.toLowerCase(), c.id]));
  const catAliases = { top: 'tops', bottom: 'bottoms', dress: 'dresses', shoe: 'shoes', jacket: 'jackets', coat: 'jackets', bag: 'bags', jewelry: 'jewellery', accessory: 'accessories' };
  const warmthByLabel = new Map(store.WARMTH_SCALE.map((w) => [w.label.toLowerCase(), w.value]));
  const formalityByLabel = new Map(store.FORMALITY_SCALE.map((w) => [w.label.toLowerCase(), w.value]));
  const rows = [];
  for (const line of String(text || '').split('\n')) {
    const parts = line.split(/[,|]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const name = parts[0];
    const rawCat = (parts[1] || '').toLowerCase();
    const category = catByLabel.get(rawCat) || catAliases[rawCat] || (store.CATEGORY_IDS.includes(rawCat) ? rawCat : null);
    const warmthRaw = (parts[2] || '').toLowerCase();
    const warmth = warmthByLabel.get(warmthRaw) ?? (/^[1-5]$/.test(warmthRaw) ? Number(warmthRaw) : null);
    const formRaw = (parts[3] || '').toLowerCase();
    const formality = formalityByLabel.get(formRaw) ?? (/^[1-5]$/.test(formRaw) ? Number(formRaw) : null);
    rows.push({ name, category, warmth, formality, ok: Boolean(name && category), line });
  }
  return rows;
}

function openBatchSheet() {
  const ta = el('textarea', { class: 'usm-textarea outfit-batch__text', id: 'batchText', rows: '8', placeholder: BATCH_HINT, spellcheck: 'false' });
  const preview = el('p', { class: 'usm-field__hint', text: '' });
  const refresh = () => {
    const rows = parseBatch(ta.value);
    const ok = rows.filter((r) => r.ok).length;
    const bad = rows.length - ok;
    preview.textContent = rows.length ? `${ok} ready${bad ? ` · ${bad} need a category (tops, bottoms, dresses, shoes, jackets, bags, jewellery, accessories)` : ''}` : '';
  };
  ta.addEventListener('input', refresh);

  const add = el('button', { type: 'button', class: 'usm-btn usm-btn--primary', text: 'Add them', onclick: () => {
    const rows = parseBatch(ta.value).filter((r) => r.ok);
    if (rows.length === 0) { refresh(); ta.focus(); return; }
    const { added, skipped } = store.addItems(rows);
    closeSheet();
    afterClosetChange(`${added.length} ${added.length === 1 ? 'thing' : 'things'} in the closet${skipped.length ? `, ${skipped.length} skipped` : ''}.`);
  } });

  openSheet({
    title: 'Add a batch',
    body: [
      el('p', { class: 'outfit-sheet__text', text: 'Quickest way to fill the closet. Photos and the rest can come later, or never.' }),
      el('div', { class: 'usm-field' }, [
        el('label', { class: 'usm-field__label', for: 'batchText', text: 'One per line' }),
        ta,
        preview,
      ]),
      el('div', { class: 'usm-modal__actions' }, [
        add,
        el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', 'data-modal-close': true, text: 'Cancel' }),
      ]),
    ],
    initialFocus: ta,
  });
}

/* ─────────────────────────────── backup / import ─────────────────────────────── */

function exportBackup() {
  let json;
  try {
    json = store.exportJSON();
  } catch (err) {
    warn('export failed', err);
    showToast('Couldn’t build the backup just now.');
    return;
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: store.exportFilename(today) });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Your item details are saved. Photos stay on this device — you’d need to add those again.', { sticky: true });
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const n = store.importJSON(String(reader.result));
      afterClosetChange(`${n} ${n === 1 ? 'thing' : 'things'} restored. Photos aren’t in a backup — add those again when you like.`);
    } catch (err) {
      showToast(err && err.message ? err.message : "That file doesn't look like a wardrobe backup.", { sticky: true });
    }
  };
  reader.onerror = () => showToast("Couldn't read that file.");
  reader.readAsText(file);
}

function afterClosetChange(message) {
  recentPicks = [];
  computeOutfit();
  renderOutfit();
  renderCloset();
  if (message) { showToast(message); announce(message); }
}

/* ─────────────────────────────── boot ─────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
  initSiteChrome({ active: 'foryou' });
  mountReminderStrip('#outfitReminders', { types: ['outfit'] });

  mounts = {
    weather: document.getElementById('outfitWeather'),
    banner: document.getElementById('outfitBanner'),
    occasions: document.getElementById('outfitOccasions'),
    today: document.getElementById('outfitToday'),
    closet: document.getElementById('outfitCloset'),
    closetBody: document.getElementById('closetBody'),
    closetCount: document.getElementById('closetCount'),
    status: document.getElementById('outfitStatus'),
  };

  // Hidden import input, once.
  mounts.importInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  mounts.importInput.addEventListener('change', () => { importBackup(mounts.importInput.files[0]); mounts.importInput.value = ''; });
  document.body.appendChild(mounts.importInput);

  renderOccasions();
  renderWeather();          // skeleton
  computeOutfit();
  renderOutfit();           // the outfit never waits for the network
  renderCloset();

  // An empty closet opens the manager so the first add is one tap away.
  if (store.listItems().length === 0 && mounts.closet) mounts.closet.open = true;

  // Never prompts: saved → already-granted geolocation → Winnipeg.
  try {
    const resolved = await weatherApi.resolveLocation();
    location = resolved.location;
    locationSource = resolved.source;
  } catch (err) {
    warn('location resolve failed', err);
  }
  renderWeather();
  loadWeather();

  store.syncMorningReminder(today);

  requestAnimationFrame(() => setTimeout(() => initReveal(), 50));
});
