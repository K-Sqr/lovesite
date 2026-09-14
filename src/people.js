import './styles/base.css';
import './styles/sections.css';
import './styles/animations.css';
import './styles/ui.css';
import './styles/people.css';

import { initSiteChrome } from './modules/siteChrome.js';
import { initReveal, observeReveal } from './modules/reveal.js';
import { openModal, closeModal } from './modules/modal.js';
import { formatRelativeGentle, toISO, addDays } from './modules/dates.js';
import * as store from './modules/peopleStore.js';
import { mountReminderStrip } from './modules/reminderUI.js';

/**
 * people.js — renders people.html and wires its events. All data goes
 * through peopleStore.js; this file never touches storage itself.
 *
 * Tone rules live in peopleStore.deriveState() and dates.formatRelativeGentle().
 * Nothing in here formats a date, counts days, or escalates anything. The
 * energy selector is a filter for right now and is never recorded.
 */

/** The only console output in this file. Never pass it a person or a template. */
function warn(message, err) {
  if (err !== undefined) console.warn(`[people] ${message}`, err);
  else console.warn(`[people] ${message}`);
}

/* ─────────────────────────────── tiny DOM helper ─────────────────────────────── */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') node.textContent = v;          // user text always goes through here
    else if (k === 'class') node.className = v;
    else if (k === 'value') node.value = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ─────────────────────────────── page state ─────────────────────────────── */

let energy = 'normal';          // the current view filter; mirrored to sessionStorage only
let animateRows = true;         // rows animate in on first paint only; later re-renders are instant
let editingId = null;           // person currently open in the form, or null for "add"
let templateFor = '';           // person id selected in the Messages section ('' = nobody)
let lowHelloIndex = -1;         // cycles through the "Very low energy" lines

let mounts = {};

/* ─────────────────────────────── feedback ─────────────────────────────── */

function announce(text) {
  const region = mounts.status;
  if (!region) return;
  region.textContent = '';
  // A tick later so repeated identical announcements are still read out.
  setTimeout(() => { region.textContent = text; }, 30);
}

let toastEl = null;
let toastTimer = null;
function showToast(text, { writing = false, sticky = false } = {}) {
  if (!toastEl) {
    toastEl = el('div', { class: 'usm-toast', role: 'status' });
    document.body.appendChild(toastEl);
  }
  const card = el('div', { class: writing ? 'usm-toast__card usm-toast__card--writing' : 'usm-toast__card' }, [
    el('span', { text }),
  ]);
  if (sticky) {
    card.appendChild(el('button', { type: 'button', class: 'usm-toast__close', 'aria-label': 'Dismiss', text: '×', onclick: hideToast }));
  }
  toastEl.replaceChildren(card);
  toastEl.classList.add('is-open');
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(hideToast, 1800);
}
function hideToast() {
  if (toastEl) toastEl.classList.remove('is-open');
}

/* ─────────────────────────────── clipboard ─────────────────────────────── */

async function copyToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      warn('clipboard API rejected, trying the fallback', err);
    }
  }
  // Fallback: hidden textarea + execCommand.
  let ok = false;
  const ta = el('textarea', { class: 'people-copy-shim', 'aria-hidden': 'true', readonly: true, tabindex: '-1' });
  ta.value = text;
  document.body.appendChild(ta);
  try {
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch (err) {
    warn('execCommand copy failed', err);
    ok = false;
  }
  ta.remove();
  return ok;
}

/** Copy, then confirm on the control AND in the live region. */
async function copyWithFeedback(text, button) {
  const ok = await copyToClipboard(text);
  if (ok) {
    flashLabel(button, 'Copied ✓');
    announce('Copied.');
    return true;
  }
  openManualCopy(text, button);
  return false;
}

function flashLabel(button, label) {
  if (!button || button.dataset.flashing) return;
  const original = button.textContent;
  button.dataset.flashing = '1';
  button.classList.add('is-copied');
  button.textContent = label;
  setTimeout(() => {
    button.textContent = original;
    button.classList.remove('is-copied');
    delete button.dataset.flashing;
  }, 1500);
}

/* ─────────────────────────────── sheets & modals ─────────────────────────────── */

let sheet = null;
let sheetTitleId = 0;

/** One reusable modal; on phones it becomes a bottom sheet (people.css). */
function getSheet() {
  if (sheet) return sheet;
  sheet = el('div', { class: 'usm-modal people-sheet', role: 'dialog', 'aria-modal': 'true', 'data-focus-trap': true, hidden: true }, [
    el('div', { class: 'usm-modal__scrim', 'data-modal-close': true }),
    el('div', { class: 'usm-modal__card people-sheet__card' }),
  ]);
  document.body.appendChild(sheet);
  return sheet;
}

/**
 * @param {{ title?: string, body: Node[], initialFocus?: HTMLElement, onClose?: () => void }} opts
 */
function openSheet({ title, body, initialFocus, onClose }) {
  const s = getSheet();
  // modal.js finishes a close ~300ms later (it flips `hidden` back on). While
  // one is in flight the sheet is visible but not `.is-open`; wait it out or
  // the new sheet would vanish underneath us.
  if (!s.hidden && !s.classList.contains('is-open')) {
    setTimeout(() => openSheet({ title, body, initialFocus, onClose }), 320);
    return;
  }
  const card = s.querySelector('.people-sheet__card');
  const id = `peopleSheetTitle${++sheetTitleId}`;
  card.replaceChildren(
    el('div', { class: 'people-sheet__grip', 'aria-hidden': 'true' }),
    title ? el('h3', { id, class: 'people-sheet__title', text: title }) : null,
    ...body,
  );
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
      el('p', { class: 'people-sheet__text', text }),
      el('div', { class: 'usm-modal__actions' }, [
        confirmBtn,
        el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', 'data-modal-close': true, text: 'Cancel' }),
      ]),
    ],
    initialFocus: confirmBtn,
  });
}

function openManualCopy(text) {
  const ta = el('textarea', { class: 'usm-textarea people-manual-copy', readonly: true, 'aria-label': 'Message to copy' });
  ta.value = text;
  openSheet({
    title: 'Copy this',
    body: [
      el('p', { class: 'people-sheet__text', text: 'Select all and copy — your browser blocked automatic copying.' }),
      ta,
      el('div', { class: 'usm-modal__actions' }, [
        el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', 'data-modal-close': true, text: 'Done' }),
      ]),
    ],
    initialFocus: ta,
  });
  requestAnimationFrame(() => { try { ta.select(); } catch { /* fine */ } });
}

/* ─────────────────────────────── energy selector ─────────────────────────────── */

function renderEnergy() {
  const wrap = mounts.energy;
  const level = store.getEnergyLevel(energy);
  const group = el('div', { class: 'people-energy__group', role: 'radiogroup', 'aria-labelledby': 'peopleEnergyLabel' });

  store.ENERGY_LEVELS.forEach((lvl) => {
    const selected = lvl.id === level.id;
    const btn = el('button', {
      type: 'button',
      class: selected ? 'usm-pill people-energy__pill is-selected' : 'usm-pill people-energy__pill',
      role: 'radio',
      'aria-checked': selected ? 'true' : 'false',
      tabindex: selected ? '0' : '-1',
      'data-energy': lvl.id,
      text: lvl.label,
      onclick: () => setEnergy(lvl.id),
    });
    group.appendChild(btn);
  });

  group.addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const ids = store.ENERGY_LEVELS.map((l) => l.id);
    const idx = ids.indexOf(energy);
    const next = ids[(idx + keys[e.key] + ids.length) % ids.length];
    setEnergy(next); // re-renders the group, so look the pill up fresh
    mounts.energy.querySelector(`[data-energy="${next}"]`)?.focus();
  });

  wrap.replaceChildren(
    el('p', { class: 'people-energy__label', id: 'peopleEnergyLabel', text: 'How much social energy do you have right now?' }),
    group,
  );
}

function setEnergy(id) {
  // A view filter for right now. Written to sessionStorage as one string,
  // never to localStorage, never as a history. Nothing about a person changes.
  energy = store.setEnergy(id);
  renderEnergy();
  renderList();
}

/* ─────────────────────────────── people list ─────────────────────────────── */

function nextLowHello(name) {
  const cat = store.getTemplateCategory('low-energy');
  if (!cat || cat.items.length === 0) return store.fillTemplate('hi {name} ❤️', name);
  lowHelloIndex = (lowHelloIndex + 1) % cat.items.length;
  return store.fillTemplate(cat.items[lowHelloIndex].text, name);
}

function renderRow({ person, state }, index, { level, parked = false }) {
  const isLow = level.id === 'low' && !parked;

  const chip = el('span', { class: `usm-tone usm-tone--${state.tone}`, text: state.label });

  const more = el('button', {
    type: 'button',
    class: 'usm-icon-btn person-row__more',
    'aria-label': `More for ${person.name}`,
    'aria-haspopup': 'dialog',
    text: '⋯',
    onclick: () => openOverflow(person, state),
  });

  // Only ever a phrase from formatRelativeGentle(). No dates, no counts.
  const metaBits = [];
  if (parked && person.isSnoozedUntil) {
    metaBits.push(`back ${formatRelativeGentle(person.isSnoozedUntil)}`);
  } else if (state.id === 'birthday') {
    const next = store.nextOccurrence(person.birthday);
    metaBits.push(`birthday ${formatRelativeGentle(next)}`);
    if (person.lastContactAt) metaBits.push(`said hi ${formatRelativeGentle(person.lastContactAt)}`);
  } else if (person.lastContactAt) {
    metaBits.push(`said hi ${formatRelativeGentle(person.lastContactAt)}`);
  }

  const saidHi = el('button', { type: 'button', class: 'usm-btn usm-btn--secondary person-row__btn', text: 'Said hi', onclick: () => onSaidHi(person) });
  const snooze = el('button', { type: 'button', class: 'usm-btn usm-btn--secondary person-row__btn', text: 'Snooze', 'aria-haspopup': 'dialog', onclick: () => openSnooze(person) });

  const actions = el('div', { class: isLow ? 'person-row__actions is-low' : 'person-row__actions' });
  if (isLow) {
    const quick = el('button', {
      type: 'button',
      class: 'usm-btn usm-btn--primary person-row__btn person-row__quick',
      text: 'Copy a quick hello',
      onclick: (e) => copyWithFeedback(nextLowHello(person.name), e.currentTarget),
    });
    actions.appendChild(quick);
  }
  actions.append(saidHi, snooze);

  const row = el('li', {
    class: animateRows ? 'usm-card person-row reveal' : 'usm-card person-row reveal visible',
    id: person.id,
    'data-delay': String((index % 4) + 1),
  }, [
    el('div', { class: 'person-row__top' }, [
      el('div', { class: 'person-row__who' }, [
        el('span', { class: 'person-row__name', text: person.name }),
        person.relationship ? el('span', { class: 'person-row__rel', text: person.relationship }) : null,
      ]),
      more,
    ]),
    el('div', { class: 'person-row__state' }, [
      chip,
      metaBits.length ? el('span', { class: 'person-row__meta', text: metaBits.join(' · ') }) : null,
    ]),
    actions,
  ]);
  return row;
}

function categoryRank(relationship) {
  const i = store.PEOPLE_CATEGORIES.indexOf(relationship);
  return i === -1 ? store.PEOPLE_CATEGORIES.length : i;
}

function renderGroupedList(entries, level) {
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.person.relationship || 'Others';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  const keys = [...groups.keys()].sort((a, b) => {
    const d = categoryRank(a) - categoryRank(b);
    return d !== 0 ? d : a.localeCompare(b);
  });

  const wrap = el('div', { class: 'people-groups' });
  let i = 0;
  for (const key of keys) {
    const list = el('ul', { class: 'people-list' });
    groups.get(key).forEach((entry) => {
      list.appendChild(renderRow(entry, i, { level }));
      i += 1;
    });
    wrap.appendChild(el('section', { class: 'people-group', 'aria-label': key }, [
      el('h2', { class: 'people-group__title', text: key }),
      list,
    ]));
  }
  return wrap;
}

function renderEmptyState() {
  const add = el('button', { type: 'button', class: 'usm-btn usm-btn--primary', text: '+ Add someone', onclick: () => openForm(null) });
  return el('div', { class: 'usm-empty people-empty' }, [
    el('p', { class: 'people-empty__line', text: 'Nobody here yet. Who’s been on your mind?' }),
    el('p', { class: 'people-empty__text', text: 'Add a few people you like thinking about. No schedules needed — this is just so you don’t have to hold it all in your head.' }),
    add,
  ]);
}

function renderList() {
  const wrap = mounts.list;
  const view = store.getView(energy);
  const total = view.active.length + view.parked.length + view.hiddenByEnergy;

  if (total === 0) {
    wrap.replaceChildren(renderEmptyState());
    mounts.energy.hidden = true;
    // The empty state carries its own "+ Add someone"; keep the panel reachable if it is open.
    mounts.addWrap.hidden = !panel.classList.contains('is-open');
    return;
  }
  mounts.energy.hidden = false;
  mounts.addWrap.hidden = false;

  const children = [];
  children.push(el('p', { class: 'people-line', text: view.level.line }));

  if (view.active.length === 0) {
    children.push(el('p', { class: 'people-quiet', text: view.hiddenByEnergy > 0
      ? 'Nobody easy to reach in this list right now, and that’s fine.'
      : 'Everyone’s parked for now. Enjoy the quiet.' }));
  } else {
    children.push(renderGroupedList(view.active, view.level));
  }

  if (view.hiddenByEnergy > 0) {
    // The rest of the list, folded away rather than gone. No count on purpose.
    const full = store.getView('normal');
    const shownIds = new Set(view.active.map((e) => e.person.id));
    const rest = full.active.filter((e) => !shownIds.has(e.person.id));
    const list = el('ul', { class: 'people-list' });
    rest.forEach((entry, i) => list.appendChild(renderRow(entry, i, { level: view.level })));
    children.push(el('details', { class: 'people-fold' }, [
      el('summary', { class: 'people-fold__summary', text: 'Everyone else' }),
      list,
    ]));
  }

  if (view.parked.length > 0) {
    const list = el('ul', { class: 'people-list' });
    view.parked.forEach((entry, i) => list.appendChild(renderRow(entry, i, { level: view.level, parked: true })));
    children.push(el('details', { class: 'people-fold' }, [
      el('summary', { class: 'people-fold__summary', text: `Parked for now (${view.parked.length})` }),
      list,
    ]));
  }

  wrap.replaceChildren(...children);
  if (animateRows) {
    wrap.querySelectorAll('.reveal').forEach(observeReveal);
    animateRows = false;
  }
}

/* ─────────────────────────────── row actions ─────────────────────────────── */

function onSaidHi(person) {
  // One tap. No form, no "how did it go", nothing logged but today's date.
  const saved = store.markSaidHi(person.id);
  if (!saved) return;
  showToast('Nice.', { writing: true });
  announce(`Nice. ${saved.name} is caught up.`);
  // The row was re-rendered; keep keyboard focus on it rather than dropping to <body>.
  document.getElementById(saved.id)?.querySelector('button')?.focus({ preventScroll: true });
}

function openSnooze(person) {
  const presets = store.snoozePresets();
  const options = el('div', { class: 'people-sheet__options' });
  presets.forEach((p) => {
    options.appendChild(el('button', {
      type: 'button', class: 'usm-btn usm-btn--secondary people-sheet__option', text: p.label,
      onclick: () => { closeSheet(); doSnooze(person, p.until); },
    }));
  });

  const customWrap = el('div', { class: 'people-sheet__custom', hidden: true });
  const dateInput = el('input', { type: 'date', class: 'usm-input', 'aria-label': 'Come back on', min: toISO(addDays(new Date(), 1)) });
  dateInput.value = toISO(addDays(new Date(), 7));
  customWrap.append(
    dateInput,
    el('button', { type: 'button', class: 'usm-btn usm-btn--primary people-sheet__option', text: 'Park until then', onclick: () => {
      if (!dateInput.value) { dateInput.focus(); return; }
      closeSheet();
      doSnooze(person, dateInput.value);
    } }),
  );
  const customBtn = el('button', {
    type: 'button', class: 'usm-btn usm-btn--secondary people-sheet__option', text: 'Custom date', 'aria-expanded': 'false',
    onclick: () => {
      const open = customWrap.hidden;
      customWrap.hidden = !open;
      customBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) dateInput.focus();
    },
  });
  options.appendChild(customBtn);

  openSheet({
    title: `Snooze ${person.name}`,
    body: [
      el('p', { class: 'people-sheet__framing', text: 'I remembered, I just don’t have the energy right now.' }),
      options,
      customWrap,
      el('div', { class: 'usm-modal__actions' }, [
        el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', 'data-modal-close': true, text: 'Never mind' }),
      ]),
    ],
    initialFocus: options.firstElementChild,
  });
}

function doSnooze(person, untilISO) {
  const saved = store.snoozePerson(person.id, untilISO);
  if (!saved) return;
  announce(`${saved.name} is parked for now.`);
}

function openOverflow(person, state) {
  const item = (label, onclick) => el('button', { type: 'button', class: 'usm-btn usm-btn--secondary people-sheet__option', text: label, onclick });
  const body = [
    el('div', { class: 'people-sheet__options' }, [
      item('Edit', () => { closeSheet(); openForm(person.id); }),
      item('Copy a message', () => { closeSheet(); openCopyMessage(person); }),
      state.id === 'snoozed' ? item('Bring back now', () => { closeSheet(); store.unsnoozePerson(person.id); }) : null,
      item('Remove person', () => { closeSheet(); confirmRemove(person); }),
    ]),
    el('div', { class: 'usm-modal__actions' }, [
      el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', 'data-modal-close': true, text: 'Close' }),
    ]),
  ];
  openSheet({ title: person.name, body });
}

function confirmRemove(person) {
  openConfirm({
    title: `Remove ${person.name}?`,
    text: 'They’ll just be gone from this list. Nothing else changes.',
    confirmLabel: 'Remove',
    onConfirm: () => {
      store.removePerson(person.id);
      announce('Removed.');
    },
  });
}

/* ─────────────────────────────── message templates ─────────────────────────────── */

/** A tappable line. Tap copies (with the name filled in); the small ✎ edits. */
function renderTemplateItem(cat, item, name, { editable }) {
  const text = store.fillTemplate(item.text, name);
  const chip = el('button', {
    type: 'button', class: 'people-tpl', text,
    onclick: (e) => copyWithFeedback(text, e.currentTarget),
  });
  const li = el('li', { class: 'people-tpl__item' }, [chip]);
  if (editable) {
    li.appendChild(el('button', {
      type: 'button', class: 'usm-icon-btn people-tpl__edit', 'aria-label': 'Edit this message', text: '✎',
      onclick: () => openTemplateEditor(cat, item),
    }));
  }
  return li;
}

function renderTemplateCategory(cat, name, { editable, open }) {
  const list = el('ul', { class: 'people-tpl-list' });
  cat.items.forEach((item) => list.appendChild(renderTemplateItem(cat, item, name, { editable })));
  const details = el('details', { class: 'people-tpl-cat', open: open || null }, [
    el('summary', { class: 'people-tpl-cat__summary', text: cat.category }),
    list,
    editable ? el('button', {
      type: 'button', class: 'usm-btn usm-btn--ghost people-tpl-cat__add', text: '+ Add one of your own',
      onclick: () => openTemplateEditor(cat, null),
    }) : null,
  ]);
  return details;
}

function renderMessages() {
  const wrap = mounts.messages;
  const people = store.listPeople();
  if (!people.some((p) => p.id === templateFor)) templateFor = '';
  const forPerson = people.find((p) => p.id === templateFor) || null;

  const select = el('select', { class: 'usm-select people-tpl-for', id: 'peopleTplFor', onchange: (e) => { templateFor = e.target.value; renderMessages(); } }, [
    el('option', { value: '', text: 'No one in particular' }),
    ...people.map((p) => el('option', { value: p.id, text: p.name })),
  ]);
  select.value = templateFor;

  const level = store.getEnergyLevel(energy);
  const cats = store.listTemplateCategories();
  const catNodes = cats.map((cat) => renderTemplateCategory(cat, forPerson?.name || '', { editable: true, open: cat.id === level.templateCategory }));

  const details = el('details', { class: 'people-messages__details', open: wrap.querySelector('details.people-messages__details')?.open || null }, [
    el('summary', { class: 'people-messages__summary', text: 'Messages' }),
    el('p', { class: 'people-messages__hint', text: 'Tap one to copy it. The first sentence is the hard part; these are a start.' }),
    people.length ? el('div', { class: 'usm-field people-tpl-for-wrap' }, [
      el('label', { class: 'usm-field__label', for: 'peopleTplFor', text: 'For' }),
      select,
    ]) : null,
    ...catNodes,
  ]);
  wrap.replaceChildren(details);
}

/** The per-person "Copy a message" sheet: same lines, name filled in, the fitting category first. */
function openCopyMessage(person) {
  const level = store.getEnergyLevel(energy);
  const state = store.deriveState(person);
  const preferred = state.id === 'birthday' ? 'birthday' : level.templateCategory;
  const cats = store.listTemplateCategories();
  const ordered = [...cats.filter((c) => c.id === preferred), ...cats.filter((c) => c.id !== preferred)];
  const nodes = ordered.map((cat, i) => renderTemplateCategory(cat, person.name, { editable: false, open: i === 0 }));
  openSheet({
    title: `A message for ${person.name}`,
    body: [
      el('div', { class: 'people-sheet__scroll' }, nodes),
      el('div', { class: 'usm-modal__actions' }, [
        el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', 'data-modal-close': true, text: 'Close' }),
      ]),
    ],
  });
}

function openTemplateEditor(cat, item) {
  const isNew = !item;
  const ta = el('textarea', { class: 'usm-textarea', 'aria-label': 'Message', maxlength: '500', placeholder: 'Write it how you’d actually text it. {name} becomes their name.' });
  ta.value = item ? item.text : '';

  const save = el('button', { type: 'button', class: 'usm-btn usm-btn--primary', text: 'Save', onclick: () => {
    const text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    if (isNew) store.addTemplate(cat.id, text);
    else store.editTemplate(cat.id, item.id, text);
    closeSheet();
  } });

  const extra = [];
  if (item && item.isDefault && item.isOverridden) {
    extra.push(el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', text: 'Reset to default', onclick: () => { store.resetOrDeleteTemplate(item.id); closeSheet(); } }));
  }
  if (item && !item.isDefault) {
    extra.push(el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', text: 'Delete', onclick: () => { store.resetOrDeleteTemplate(item.id); closeSheet(); } }));
  }

  openSheet({
    title: isNew ? `New line for “${cat.category}”` : 'Edit this line',
    body: [
      ta,
      el('div', { class: 'usm-modal__actions' }, [
        save,
        el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', 'data-modal-close': true, text: 'Cancel' }),
        ...extra,
      ]),
    ],
    initialFocus: ta,
  });
}

/* ─────────────────────────────── add / edit form ─────────────────────────────── */

let panel = null;
let form = null;
let datesList = null;

function monthSelect(name, value) {
  const s = el('select', { class: 'usm-select', name, 'aria-label': 'Month' }, [
    el('option', { value: '', text: 'Month' }),
    ...MONTHS.map((m, i) => el('option', { value: String(i + 1), text: m })),
  ]);
  s.value = value ? String(value) : '';
  return s;
}

function dayInput(name, value) {
  return el('input', { type: 'number', class: 'usm-input', name, inputmode: 'numeric', min: '1', max: '31', placeholder: 'Day', 'aria-label': 'Day', value: value ? String(value) : '' });
}

function renderDateRow(d = null) {
  const row = el('div', { class: 'people-form__date' }, [
    el('input', { type: 'text', class: 'usm-input', name: 'dateLabel', placeholder: 'What is it?', 'aria-label': 'What is it?', maxlength: '80', value: d?.label || '' }),
    monthSelect('dateMonth', d?.month),
    dayInput('dateDay', d?.day),
    el('button', { type: 'button', class: 'usm-icon-btn people-form__date-remove', 'aria-label': 'Remove this date', text: '×', onclick: () => { row.remove(); onFormInput(); syncAddDateButton(); } }),
  ]);
  return row;
}

function syncAddDateButton() {
  const btn = form?.querySelector('[data-add-date]');
  if (btn) btn.hidden = datesList.children.length >= store.MAX_IMPORTANT_DATES;
}

function buildForm(person) {
  const isEdit = !!person;
  form = el('form', { class: 'people-form', novalidate: true });

  const nameInput = el('input', { type: 'text', class: 'usm-input', name: 'name', required: true, maxlength: '80', autocomplete: 'off', placeholder: 'Their name', value: person?.name || '' });
  const relInput = el('input', { type: 'text', class: 'usm-input', name: 'relationship', maxlength: '80', autocomplete: 'off', list: 'peopleRelHints', placeholder: 'Best friend, Family, Friend, Mentor…', value: person?.relationship || '' });
  const relHints = el('datalist', { id: 'peopleRelHints' },
    store.PEOPLE_CATEGORIES.map((label) => el('option', { value: label })));

  const cadence = el('select', { class: 'usm-select', name: 'preferredCadence', id: 'peopleCadence' },
    store.CADENCES.map((c) => el('option', { value: c.id, text: c.label })));
  cadence.value = person?.preferredCadence || 'none';

  const energyGroup = el('div', { class: 'people-form__pills', role: 'radiogroup', 'aria-labelledby': 'peopleEnergyCostLabel' });
  let energyValue = person?.energyCost ?? null;
  const energyHidden = el('input', { type: 'hidden', name: 'energyCost', value: energyValue || '' });
  function paintEnergy() {
    energyGroup.querySelectorAll('[data-cost]').forEach((b) => {
      const on = (b.dataset.cost || null) === (energyValue || null);
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
  }
  store.ENERGY_COSTS.forEach((c) => {
    energyGroup.appendChild(el('button', {
      type: 'button', class: 'usm-pill', role: 'radio', 'data-cost': c.id || '', text: c.label,
      onclick: () => { energyValue = c.id; energyHidden.value = c.id || ''; paintEnergy(); onFormInput(); },
    }));
  });
  energyGroup.addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const ids = store.ENERGY_COSTS.map((c) => c.id);
    const idx = ids.indexOf(energyValue);
    energyValue = ids[(idx + keys[e.key] + ids.length) % ids.length];
    energyHidden.value = energyValue || '';
    paintEnergy();
    energyGroup.querySelector(`[data-cost="${energyValue || ''}"]`)?.focus();
    onFormInput();
  });
  paintEnergy();

  datesList = el('div', { class: 'people-form__dates' });
  (person?.importantDates || []).forEach((d) => datesList.appendChild(renderDateRow(d)));

  const notes = el('textarea', { class: 'usm-textarea', name: 'notes', maxlength: '2000', placeholder: 'Anything you want to remember. Only you see this.' });
  notes.value = person?.notes || '';

  const lastContact = el('input', { type: 'date', class: 'usm-input', name: 'lastContactAt', max: toISO(new Date()), value: person?.lastContactAt || '' });

  const hasMore = !!(person && (person.preferredCadence !== 'none' || person.birthday || person.energyCost || person.notes || person.importantDates.length || person.lastContactAt));
  const more = el('details', { class: 'people-form__more', open: hasMore || null }, [
    el('summary', { class: 'people-form__more-summary', text: 'Add a little more' }),
    el('div', { class: 'people-form__grid' }, [
      el('div', { class: 'usm-field' }, [
        el('label', { class: 'usm-field__label', for: 'peopleCadence', text: 'How often feels right' }),
        cadence,
        el('span', { class: 'usm-field__hint', text: '“No schedule” is a real answer. Some people you just think about when you think about them.' }),
      ]),
      el('div', { class: 'usm-field' }, [
        el('span', { class: 'usm-field__label', text: 'Birthday' }),
        el('div', { class: 'people-form__monthday' }, [monthSelect('birthdayMonth', person?.birthday?.month), dayInput('birthdayDay', person?.birthday?.day)]),
        el('span', { class: 'usm-field__hint', text: 'Month and day is plenty.' }),
      ]),
      el('div', { class: 'usm-field' }, [
        el('span', { class: 'usm-field__label', id: 'peopleEnergyCostLabel', text: 'How much does reaching out to them take?' }),
        energyGroup,
        energyHidden,
      ]),
      el('div', { class: 'usm-field' }, [
        el('span', { class: 'usm-field__label', text: 'Last said hi' }),
        lastContact,
        el('span', { class: 'usm-field__hint', text: 'Roughly is fine. Leave it blank if you don’t know.' }),
      ]),
      el('div', { class: 'usm-field' }, [
        el('span', { class: 'usm-field__label', text: 'Dates that matter to them' }),
        datesList,
        el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', 'data-add-date': true, text: '+ Add a date', onclick: () => { datesList.appendChild(renderDateRow()); syncAddDateButton(); datesList.lastElementChild.querySelector('input')?.focus(); } }),
      ]),
      el('div', { class: 'usm-field' }, [
        el('label', { class: 'usm-field__label', for: 'peopleNotes', text: 'Notes' }),
        notes,
      ]),
    ]),
  ]);
  notes.id = 'peopleNotes';

  const submit = el('button', { type: 'submit', class: 'usm-btn usm-btn--primary', text: isEdit ? 'Done' : 'Add' });
  const cancel = el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', text: isEdit ? 'Close' : 'Cancel', onclick: closeForm });

  form.append(
    el('h2', { class: 'people-form__title', text: isEdit ? 'Edit' : 'Someone new' }),
    el('div', { class: 'people-form__grid people-form__grid--basics' }, [
      el('div', { class: 'usm-field' }, [el('label', { class: 'usm-field__label', for: 'peopleName', text: 'Name' }), nameInput]),
      el('div', { class: 'usm-field' }, [el('label', { class: 'usm-field__label', for: 'peopleRel', text: 'Who they are to you' }), relInput, relHints]),
    ]),
    more,
    el('div', { class: 'people-form__actions' }, [submit, cancel]),
  );
  nameInput.id = 'peopleName';
  relInput.id = 'peopleRel';

  form.addEventListener('submit', onFormSubmit);
  if (isEdit) {
    // Edits save themselves as she types (debounced in the store), and flush on blur.
    form.addEventListener('input', onFormInput);
    form.addEventListener('focusout', () => store.flushPendingEdit());
  }
  syncAddDateButton();
  return { form, nameInput };
}

function collectForm() {
  const fd = new FormData(form);
  const dates = Array.from(datesList.querySelectorAll('.people-form__date')).map((row) => ({
    label: row.querySelector('[name="dateLabel"]').value,
    month: row.querySelector('[name="dateMonth"]').value,
    day: row.querySelector('[name="dateDay"]').value,
  }));
  const bm = fd.get('birthdayMonth');
  const bd = fd.get('birthdayDay');
  return {
    name: fd.get('name'),
    relationship: fd.get('relationship'),
    preferredCadence: fd.get('preferredCadence'),
    birthday: bm && bd ? { month: bm, day: bd, year: null } : null,
    energyCost: fd.get('energyCost') || null,
    lastContactAt: fd.get('lastContactAt') || null,
    importantDates: dates,
    notes: fd.get('notes'),
  };
}

function onFormInput() {
  if (!editingId || !form) return;
  store.scheduleUpdate(editingId, collectForm());
}

function onFormSubmit(e) {
  e.preventDefault();
  const data = collectForm();
  if (!String(data.name || '').trim()) {
    form.querySelector('[name="name"]').focus();
    showToast('Just a name is enough.');
    return;
  }
  if (editingId) {
    const id = editingId;
    store.flushPendingEdit();
    closeForm();
    store.updatePerson(id, data);
    return;
  }
  const saved = store.addPerson(data);
  if (!saved) return;
  closeForm();
  announce(`${saved.name} added.`);
  // A brand new row: reveal it like the first paint would have.
  requestAnimationFrame(() => {
    const row = document.getElementById(saved.id);
    if (row) { row.classList.remove('visible'); observeReveal(row); }
  });
}

function openForm(personId) {
  const person = personId ? store.getPerson(personId) : null;
  if (personId && !person) return;
  if (editingId) store.flushPendingEdit();
  editingId = person ? person.id : null;

  const { form: f, nameInput } = buildForm(person);
  panel.replaceChildren(f);
  panel.classList.add('is-open');
  mounts.addWrap.hidden = false;
  mounts.addButton.hidden = true;
  panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  requestAnimationFrame(() => nameInput.focus({ preventScroll: true }));
}

function closeForm() {
  if (editingId) store.flushPendingEdit();
  editingId = null;
  panel.classList.remove('is-open');
  panel.replaceChildren();
  form = null;
  datesList = null;
  mounts.addButton.hidden = false;
  mounts.addButton.focus({ preventScroll: true });
}

function renderAddWrap() {
  const btn = el('button', { type: 'button', class: 'usm-btn usm-btn--primary people-add', text: '+ Add someone', onclick: () => openForm(null) });
  panel = el('div', { class: 'usm-panel people-panel', id: 'peoplePanel' });
  mounts.addWrap.replaceChildren(btn, panel);
  mounts.addButton = btn;
}

/* ─────────────────────────────── backup ─────────────────────────────── */

function onExport() {
  try {
    const json = store.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `people-backup-${toISO(new Date())}.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Backup downloaded.');
  } catch (err) {
    warn('export failed', err);
    showToast('The backup didn’t download. Try again in a moment.');
  }
}

function onImportClick() {
  openConfirm({
    title: 'Import a backup?',
    text: 'This replaces everyone and every message here with what’s in the file.',
    confirmLabel: 'Choose a file',
    onConfirm: () => mounts.importFile.click(),
  });
}

function onImportFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  file.text().then((text) => {
    try {
      store.importBackup(text);
      showToast('Restored.', { writing: true });
      announce('Backup restored.');
    } catch (err) {
      warn('import failed', err);
      showToast(err && err.message ? err.message : "That file doesn't look like a People backup", { sticky: true });
    }
  }).catch((err) => {
    warn('reading the file failed', err);
    showToast('Couldn’t read that file.', { sticky: true });
  });
}

/* ─────────────────────────────── boot ─────────────────────────────── */

function renderSkeleton() {
  mounts.list.replaceChildren(
    ...[1, 2, 3].map(() => el('div', { class: 'usm-card person-row person-row--skeleton', 'aria-hidden': 'true' }, [
      el('span', { class: 'usm-skeleton people-skel people-skel--name' }),
      el('span', { class: 'usm-skeleton people-skel people-skel--line' }),
      el('span', { class: 'usm-skeleton people-skel people-skel--btn' }),
    ])),
  );
}

function renderAll() {
  renderEnergy();
  renderList();
  renderMessages();
}

function jumpToHash() {
  const id = (location.hash || '').slice(1);
  if (!id) return;
  const row = document.getElementById(id);
  if (!row || !row.classList.contains('person-row')) return;
  row.classList.add('visible', 'is-highlighted');
  row.scrollIntoView({ block: 'center' });
  setTimeout(() => row.classList.remove('is-highlighted'), 2000);
}

document.addEventListener('DOMContentLoaded', () => {
  // theme.js (inside siteChrome) reads localStorage unguarded; with storage
  // blocked it throws. The chrome is decoration — this page must still work.
  try {
    initSiteChrome({ active: 'foryou' });
  } catch (err) {
    warn('site chrome failed to initialise', err);
  }

  mountReminderStrip('#peopleReminders', { types: ['checkin', 'birthday'] });

  mounts = {
    energy: document.getElementById('peopleEnergy'),
    list: document.getElementById('peopleListWrap'),
    messages: document.getElementById('peopleMessages'),
    addWrap: document.getElementById('peopleAddWrap'),
    status: document.getElementById('peopleStatus'),
    importFile: document.getElementById('peopleImportFile'),
  };

  energy = store.getEnergy();
  renderSkeleton();
  renderAddWrap();

  document.getElementById('peopleExport')?.addEventListener('click', onExport);
  document.getElementById('peopleImport')?.addEventListener('click', onImportClick);
  mounts.importFile?.addEventListener('change', onImportFile);

  // Never lose a half-typed edit.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.flushPendingEdit(); });
  window.addEventListener('beforeunload', () => store.flushPendingEdit());
  window.addEventListener('pagehide', () => store.flushPendingEdit());

  // Any change — here or in another tab — re-renders from the store.
  store.subscribe(() => { renderList(); renderMessages(); });

  // One frame of skeleton, then the real thing (never the empty state before the store is read).
  requestAnimationFrame(() => {
    renderAll();
    jumpToHash();
    requestAnimationFrame(() => setTimeout(() => initReveal(), 50));
    store.syncReminders();
  });
});
