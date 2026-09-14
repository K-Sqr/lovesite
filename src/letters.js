/**
 * letters.js — the reading room (06-LETTERS).
 *
 * No Firestore here, on purpose: a handful of owner-written documents with small static
 * metadata need no queryable collection, and Storage objects + src/data/letters.js is
 * strictly less to secure — no second rules block, no second place a body or URL could persist.
 *
 * Bytes come only through src/modules/letterSource.js. This file never sees a Storage URL: it
 * turns a Blob into a blob: URL for the reading page and revokes it on close, on switching,
 * and on pagehide. The hash holds only the letter id — never a file path.
 */

import './styles/base.css';
import './styles/sections.css';
import './styles/animations.css';
import './styles/ui.css';
import './styles/letters.css';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './modules/firebase.js';
import { authenticateWithPasscode, getRole } from './modules/auth.js';
import { initSiteChrome } from './modules/siteChrome.js';
import { initReveal } from './modules/reveal.js';
import { formatLongDate } from './modules/dates.js';
import { getLetterList, getLetterBlob, letterPublicUrl } from './modules/letterSource.js';
import { displayTitle, sortOldestFirst, groupByYear } from './data/letters.js';

const COPY = {
  wrong: "That's not it — try once more.",
  empty: 'Nothing here yet.',
  failed: "That didn't open — try signing in again.",
  original: '',
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COUNT_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
];

const state = {
  unlocked: false,
  role: null,
  /** @type {import('./data/letters.js').Letter[]} */
  letters: [],
  /** The letter on screen, in memory only: { id, blobUrl } */
  open: null,
  full: false,
};

function warn(...args) {
  console.warn('[letters]', ...args);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 'March 13, 2026 · 10 pages' — whichever parts exist. @param {import('./data/letters.js').Letter} letter */
function metaLine(letter) {
  const parts = [];
  if (letter.date) parts.push(formatLongDate(letter.date));
  if (letter.pages) parts.push(`${letter.pages} ${letter.pages === 1 ? 'page' : 'pages'}`);
  return parts.join(' · ');
}

/* ── Locked state ── */

function setupLocked({ form, input, submit, note }) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passcode = input.value.trim();
    if (!passcode) {
      input.focus();
      return;
    }
    submit.disabled = true;
    note.textContent = '';
    let ok = false;
    try {
      ok = await authenticateWithPasscode(passcode);
    } catch (err) {
      warn('sign-in failed', err);
    }
    submit.disabled = false;
    if (!ok) {
      // Generic on purpose — never a hint about which passcode was closer.
      note.textContent = COPY.wrong;
      input.select();
      input.focus();
    }
    // Success unlocks through onAuthStateChanged, the same path as a restored session.
  });
}

/* ── Archive ── */

function renderSkeleton(list) {
  list.replaceChildren(...[1, 2, 3].map(() => el('div', 'usm-skeleton letters-skeleton')));
}

function letterHref(id) {
  return `#${encodeURIComponent(id)}`;
}

function hashLetterId() {
  const raw = window.location.hash.replace(/^#/, '');
  return raw ? decodeURIComponent(raw) : '';
}

function wordNumber(n) {
  return COUNT_WORDS[n] || String(n);
}

function countLine() {
  const kept = state.letters.filter((letter) => letter.file && !letter.comingSoon).length;
  const soon = state.letters.length - kept;
  const keptBit = kept === 1
    ? 'One letter, kept for you'
    : `${wordNumber(kept).replace(/^\w/, (c) => c.toUpperCase())} letters, kept for you`;
  if (!soon) return `${keptBit}.`;
  if (soon === 1) return `${keptBit} · one still coming.`;
  return `${keptBit} · ${wordNumber(soon)} still coming.`;
}

function stampParts(letter) {
  if (!letter.date) return { day: '·', month: '' };
  const [, month, day] = letter.date.split('-');
  return {
    day,
    month: MONTHS_SHORT[Number(month) - 1] || '',
  };
}

function fillCard(node, letter, index) {
  const title = displayTitle(letter);
  const stamp = el('span', 'letter-card__stamp');
  stamp.setAttribute('aria-hidden', 'true');
  const parts = stampParts(letter);
  stamp.appendChild(el('span', 'letter-card__day', parts.day));
  if (parts.month) stamp.appendChild(el('span', 'letter-card__month', parts.month));

  const main = el('span', 'letter-card__main');
  const top = el('span', 'letter-card__top');
  top.appendChild(el('span', 'letter-card__num', `Letter ${String(index + 1).padStart(2, '0')}`));
  top.appendChild(el(
    'span',
    'letter-card__open',
    letter.comingSoon || !letter.file ? 'Soon' : 'Open →',
  ));
  main.appendChild(top);
  main.appendChild(el('span', 'letter-card__occasion', letter.occasion || title));
  if (letter.occasion && letter.title && letter.title !== letter.occasion) {
    main.appendChild(el('span', 'letter-card__title', letter.title));
  }
  if (letter.teaser) main.appendChild(el('span', 'letter-card__teaser', letter.teaser));
  const meta = metaLine(letter);
  if (meta) main.appendChild(el('span', 'letter-card__meta', meta));

  node.append(stamp, main);
}

function renderCard(letter, index) {
  const wrap = el('div', 'letter-item');
  wrap.dataset.id = letter.id;

  if (letter.comingSoon || !letter.file) {
    wrap.classList.add('is-coming-soon');
    const card = el('div', 'usm-card letter-card letter-card--soon reveal');
    card.setAttribute('data-delay', String((index % 4) + 1));
    fillCard(card, letter, index);
    wrap.appendChild(card);
    return wrap;
  }

  const card = el('a', 'usm-card usm-card--link letter-card reveal');
  card.href = letterHref(letter.id);
  card.setAttribute('data-delay', String((index % 4) + 1));
  card.setAttribute('aria-label', `${displayTitle(letter)}${letter.date ? `, ${formatLongDate(letter.date)}` : ''}`);
  fillCard(card, letter, index);
  wrap.appendChild(card);
  return wrap;
}

function renderArchive(list) {
  const count = document.getElementById('lettersCount');
  if (state.letters.length === 0) {
    if (count) {
      count.hidden = true;
      count.textContent = '';
    }
    list.replaceChildren(el('p', 'usm-empty', COPY.empty));
    return;
  }

  if (count) {
    count.hidden = false;
    count.textContent = countLine();
  }

  const groups = groupByYear(state.letters);
  const nodes = [];
  let i = 0;
  for (const group of groups) {
    if (groups.length > 1) {
      const year = el('h2', 'letters-year', group.year || 'Undated');
      nodes.push(year);
    }
    for (const letter of group.letters) nodes.push(renderCard(letter, i++));
  }
  list.replaceChildren(...nodes);
  requestAnimationFrame(() => setTimeout(() => initReveal(list), 50));
}

async function unlock(ui) {
  if (state.unlocked) return;
  state.unlocked = true;
  state.role = getRole(); // R8 owner management attaches here once the Storage path lands.

  ui.locked.hidden = true;
  ui.archive.hidden = false;
  renderSkeleton(ui.list);

  try {
    state.letters = sortOldestFirst(await getLetterList());
  } catch (err) {
    warn('list failed', err);
    state.letters = [];
  }
  renderArchive(ui.list);
  syncFromHash(ui);
}

/* ── Reading page ── click a card → this view, with the letter on the page ── */

function renderTextBody(text, mount) {
  const paragraphs = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  for (const paragraph of paragraphs) {
    const p = document.createElement('p');
    paragraph.split('\n').forEach((line, i) => {
      if (i) p.appendChild(document.createElement('br'));
      p.appendChild(document.createTextNode(line));
    });
    mount.appendChild(p);
  }
}

function embedFrame(blobUrl, title) {
  const frame = document.createElement('iframe');
  frame.className = 'letter-embed letter-embed--page';
  frame.title = title;
  frame.src = blobUrl;
  return frame;
}

function setFullView(on) {
  const ui = getUI();
  state.full = Boolean(on);
  document.body.classList.toggle('letter-full', state.full);
  ui.reading.classList.toggle('is-full', state.full);
  const btn = ui.reading.querySelector('.letters-reading__full');
  if (btn) {
    btn.textContent = state.full ? 'Exit full view' : 'Full view';
    btn.setAttribute('aria-pressed', state.full ? 'true' : 'false');
  }
}

function syncFromHash(ui = getUI()) {
  if (!state.unlocked) return;
  const id = hashLetterId();
  if (!id) {
    closeLetter(ui);
    return;
  }
  const letter = state.letters.find((l) => l.id === id);
  if (!letter || letter.comingSoon || !letter.file) {
    closeLetter(ui);
    return;
  }
  openLetter(letter, ui);
}

async function openLetter(letter, ui = getUI()) {
  if (state.open && state.open.id === letter.id) return;
  closeLetter(ui, { restore: false });

  const open = { id: letter.id, blobUrl: null };
  state.open = open;

  const bar = el('div', 'letters-reading__bar');
  const back = el('a', 'usm-btn usm-btn--ghost letters-reading__close', '← Back to the letters');
  back.href = './letters.html';
  back.addEventListener('click', (e) => {
    e.preventDefault();
    history.replaceState(null, '', window.location.pathname + window.location.search);
    closeLetter(ui);
  });
  const full = el('button', 'usm-btn usm-btn--ghost letters-reading__full', 'Full view');
  full.type = 'button';
  full.setAttribute('aria-pressed', 'false');
  full.addEventListener('click', () => setFullView(!state.full));
  bar.append(back, full);

  const header = el('header', 'letter__header');
  header.appendChild(el('h1', 'letter__title', displayTitle(letter)));
  if (letter.occasion) header.appendChild(el('p', 'letter__occasion', letter.occasion));
  const meta = metaLine(letter);
  if (meta) header.appendChild(el('p', 'letter__meta', meta));

  const body = el('div', 'letter__body');
  body.append(
    el('span', 'usm-skeleton letter__skeleton'),
    el('span', 'usm-skeleton letter__skeleton letter__skeleton--short'),
  );

  ui.archive.hidden = true;
  ui.reading.hidden = false;
  ui.reading.replaceChildren(bar, header, body);
  window.scrollTo(0, 0);

  // PDFs stream from a public URL so the viewer can paint before the whole
  // file finishes downloading. Text bodies still come through getLetterBlob.
  const looksLikeText = /\.(md|txt)$/i.test(letter.file || '');
  if (!looksLikeText) {
    if (state.open !== open) return;
    body.replaceChildren();
    const stage = el('div', 'letter-stage');
    stage.appendChild(embedFrame(letterPublicUrl(letter.file), displayTitle(letter)));
    body.appendChild(stage);
    return;
  }

  let blob;
  try {
    blob = await getLetterBlob(letter.id);
  } catch (err) {
    warn('open failed', err);
    if (state.open !== open) return;
    body.replaceChildren(el('p', 'letter__error', COPY.failed));
    return;
  }
  if (state.open !== open) return;

  open.blobUrl = URL.createObjectURL(blob);
  body.replaceChildren();
  renderTextBody(await blob.text(), body);
}

function closeLetter(ui = getUI(), { restore = true } = {}) {
  setFullView(false);
  const open = state.open;
  if (!open) {
    if (restore) {
      ui.reading.hidden = true;
      ui.reading.replaceChildren();
      if (state.unlocked) ui.archive.hidden = false;
    }
    return;
  }
  state.open = null;
  if (open.blobUrl) URL.revokeObjectURL(open.blobUrl);
  ui.reading.replaceChildren();
  ui.reading.hidden = true;
  if (restore && state.unlocked) ui.archive.hidden = false;
}

/* ── Wiring ── */

let uiCache = null;
function getUI() {
  if (uiCache) return uiCache;
  uiCache = {
    locked: document.getElementById('lettersLocked'),
    form: document.getElementById('lettersPasscodeForm'),
    input: document.getElementById('lettersPasscode'),
    submit: document.getElementById('lettersPasscodeSubmit'),
    note: document.getElementById('lettersPasscodeNote'),
    archive: document.getElementById('lettersArchive'),
    list: document.getElementById('lettersList'),
    reading: document.getElementById('lettersReading'),
  };
  return uiCache;
}

document.addEventListener('DOMContentLoaded', () => {
  initSiteChrome({ active: 'foryou' });
  const ui = getUI();
  setupLocked(ui);

  // Session restore and a fresh sign-in arrive through the same listener.
  // The passcode control only appears once we know there is no session.
  onAuthStateChanged(auth, (user) => {
    if (user) {
      unlock(ui);
    } else if (!state.unlocked) {
      ui.form.hidden = false;
      ui.input.focus({ preventScroll: true });
    }
  });

  window.addEventListener('hashchange', () => syncFromHash(ui));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (state.full) {
      e.preventDefault();
      setFullView(false);
      return;
    }
    if (state.open) {
      e.preventDefault();
      history.replaceState(null, '', window.location.pathname + window.location.search);
      closeLetter(ui);
    }
  });

  window.addEventListener('pagehide', () => closeLetter(ui, { restore: false }));

  requestAnimationFrame(() => setTimeout(() => initReveal(), 50));
});
