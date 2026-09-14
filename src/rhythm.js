/**
 * rhythm.js — page entry for rhythm.html.
 *
 * Local-only by construction: this file and everything it imports touch no
 * network. Not the Firebase SDK module (it reports a page view on import), no fetch, no beacon.
 * Nothing here writes to the console either — every error becomes a calm
 * sentence on the page, and record contents never leave the DOM/module state.
 *
 * The passphrase exists only as a local inside attemptUnlock() for the length
 * of one call to rhythmStore.unlock(). It is never assigned to module state.
 */

import './styles/base.css';
import './styles/sections.css';
import './styles/animations.css';
import './styles/ui.css';
import './styles/rhythm.css';

import { initSiteChrome } from './modules/siteChrome.js';
import { initReveal } from './modules/reveal.js';
import { openModal, closeModal } from './modules/modal.js';
import * as store from './modules/rhythmStore.js';
import { predictNextWindow, cycleLengthByRecord, MIN_CYCLE_DAYS, MAX_CYCLE_DAYS } from './modules/cyclePredict.js';
import { toISO, addDays, daysBetween, parseISO, formatDateRange, formatLongDate } from './modules/dates.js';
import { registerEphemeral, clearEphemeral } from './modules/reminders.js';
import { mountReminderStrip } from './modules/reminderUI.js';

/* ────────────────────────────────── copy ────────────────────────────────── */
// Gentle, factual, second person. No streaks, no nagging, no single certain date.

const COPY = {
  empty: "Nothing here yet. Tap the button when it starts, and I'll start learning your rhythm.",
  insufficient: "I need a couple more cycles before I can guess. For now, here's what I know.",
  pastWindow: "You're a few days past your usual window. Cycles move around — this is just what I've got recorded.",
  loss: "There's no way to reset this. If the passphrase is forgotten, the entries are gone for good — that's the trade for keeping them truly private. Download a copy if you want a safety net.",
  exportWarning: 'This file is not encrypted. Anyone who opens it can read it. Put it somewhere you trust.',
  honestLock: "The passphrase stops a glance and a curious tap-around. The encryption is what actually protects what's saved: it's unreadable on this phone without the passphrase. Nothing protects what's on screen while it's open, so lock it when you put the phone down.",
  localOnly: 'Everything stays on this device. It is never sent anywhere, and no other page on this site can see it.',
  unlocking: 'Unlocking…',
  errors: {
    'wrong-passphrase': "That's not it. Try again.",
    corrupt: "I can't read the saved data with that passphrase.",
    'no-crypto': "This browser can't keep things private, so Rhythm can't open here.",
    'write-failed': "Saving isn't working in this browser right now.",
    'empty-passphrase': 'Type the passphrase to open this.',
    generic: "Something went wrong there. Try again.",
  },
};

const UNDO_MS = 8000;

/* ─────────────────────────────── state ─────────────────────────────── */

const state = {
  /** @type {object[] | null} decrypted records while unlocked, newest first */
  records: null,
  /** @type {{ autoLockMinutes: number } | null} */
  settings: null,
  hiddenAt: null,
  lockTimer: null,
  undoTimer: null,
  historyAnimated: false,
  /** @type {{ unmount: () => void } | null} the in-page reminder card while unlocked */
  reminderStrip: null,
};

/** @type {HTMLElement} */ let content;
/** @type {HTMLElement} */ let unlockModal;
/** @type {HTMLInputElement} */ let passInput;
/** @type {HTMLInputElement} */ let confirmInput;
/** @type {HTMLElement} */ let confirmWrap;
/** @type {HTMLElement} */ let unlockTitle;
/** @type {HTMLElement} */ let unlockIntro;
/** @type {HTMLElement} */ let unlockError;
/** @type {HTMLButtonElement} */ let unlockBtn;
/** @type {HTMLElement | null} */ let statusEl = null;
/** @type {HTMLElement | null} */ let answerEl = null;
/** @type {HTMLElement | null} */ let historyEl = null;

/* ─────────────────────────────── helpers ─────────────────────────────── */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'class') node.className = v;
    else if (k === 'value') node.value = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children) if (child) node.appendChild(child);
  return node;
}

function button(label, className, onClick, attrs = {}) {
  const b = el('button', { type: 'button', class: `usm-btn ${className}`, text: label, ...attrs });
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

function todayISO() {
  return toISO(new Date());
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** 'today' · 'yesterday' · 'September 3' — for confirmations. */
function dayLabel(iso) {
  const ago = daysBetween(iso, todayISO());
  if (ago === 0) return 'today';
  if (ago === 1) return 'yesterday';
  return formatDateRange(iso, iso);
}

function errorMessage(err) {
  if (err && err.name === 'StorageError' && COPY.errors[err.code]) return COPY.errors[err.code];
  if (err && err.name === 'StorageError' && err.message) return err.message + '.';
  return COPY.errors.generic;
}

/* ─────────────────────────────── locking ─────────────────────────────── */

function clearTimers() {
  clearTimeout(state.lockTimer);
  clearTimeout(state.undoTimer);
  state.lockTimer = null;
  state.undoTimer = null;
}

/**
 * Drop the key, forget every decrypted record, and replace the DOM so no
 * plaintext survives — nothing is merely hidden.
 */
function lock({ prompt = true } = {}) {
  clearTimers();
  // The reminder lives only in memory and only while unlocked: drop it before the key.
  clearEphemeral('rhythm');
  if (state.reminderStrip) { state.reminderStrip.unmount(); state.reminderStrip = null; }
  store.lock();
  state.records = null;
  state.settings = null;
  state.hiddenAt = null;
  state.historyAnimated = false;
  statusEl = answerEl = historyEl = null;
  content.replaceChildren();
  if (passInput) passInput.value = '';
  if (confirmInput) confirmInput.value = '';
  renderLocked();
  if (prompt) showUnlockModal();
}

function autoLockMs() {
  const minutes = state.settings && state.settings.autoLockMinutes > 0 ? state.settings.autoLockMinutes : store.DEFAULT_AUTO_LOCK_MINUTES;
  return minutes * 60_000;
}

function wireAutoLock() {
  document.addEventListener('visibilitychange', () => {
    if (!store.isUnlocked()) return;
    if (document.visibilityState === 'hidden') {
      state.hiddenAt = Date.now();
      clearTimeout(state.lockTimer);
      // Timers are throttled in background tabs, so the elapsed check on return is the real guard.
      state.lockTimer = setTimeout(() => lock(), autoLockMs());
    } else {
      clearTimeout(state.lockTimer);
      if (state.hiddenAt !== null && Date.now() - state.hiddenAt >= autoLockMs()) lock();
      state.hiddenAt = null;
    }
  });
  // storage.js drops its key on pagehide too; this clears the screen and module state as well.
  window.addEventListener('pagehide', () => { if (store.isUnlocked()) lock({ prompt: false }); });
}

/* ───────────────────────────── unlock modal ───────────────────────────── */

function buildUnlockModal() {
  passInput = el('input', {
    type: 'password',
    class: 'usm-input',
    id: 'rhythmPass',
    autocomplete: 'off',
    spellcheck: 'false',
    autocapitalize: 'off',
    autocorrect: 'off',
    'aria-describedby': 'rhythmPassHint',
    placeholder: '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022',
  });
  passInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); attemptUnlock(); }
  });
  // Shown only when nothing is stored yet: a typo on first setup would lock the
  // entries under a passphrase nobody knows, so the first one is typed twice.
  confirmInput = el('input', {
    type: 'password',
    class: 'usm-input',
    id: 'rhythmPassAgain',
    autocomplete: 'off',
    spellcheck: 'false',
    autocapitalize: 'off',
    autocorrect: 'off',
    placeholder: '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022',
  });
  confirmInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); attemptUnlock(); }
  });
  confirmWrap = el('div', { class: 'usm-field', hidden: true }, [
    el('label', { class: 'usm-field__label', for: 'rhythmPassAgain', text: 'Type it again' }),
    confirmInput,
  ]);
  unlockError = el('p', { class: 'usm-field__error', 'aria-live': 'polite' });
  unlockBtn = button('Unlock', 'usm-btn--primary', attemptUnlock);
  unlockTitle = el('h3', { id: 'rhythmUnlockTitle', text: 'Unlock Rhythm' });
  unlockIntro = el('p', { id: 'rhythmPassHint' });

  // Deliberately NOT a <form>: nothing to submit, and password managers should not latch on.
  unlockModal = el('div', {
    class: 'usm-modal rhythm-unlock',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'rhythmUnlockTitle',
    'data-focus-trap': true,
    hidden: true,
  }, [
    el('div', { class: 'usm-modal__scrim', 'data-modal-close': true }),
    el('div', { class: 'usm-modal__card' }, [
      unlockTitle,
      unlockIntro,
      el('div', { class: 'usm-field' }, [
        el('label', { class: 'usm-field__label', for: 'rhythmPass', text: 'Passphrase' }),
        passInput,
      ]),
      confirmWrap,
      unlockError,
      el('p', { text: COPY.loss }),
      el('div', { class: 'usm-modal__actions' }, [
        unlockBtn,
        button('Not now', 'usm-btn--ghost', null, { 'data-modal-close': true }),
      ]),
    ]),
  ]);
  document.body.appendChild(unlockModal);
}

function showUnlockModal() {
  const firstTime = !store.hasData();
  unlockTitle.textContent = firstTime ? 'Choose a passphrase' : 'Unlock Rhythm';
  unlockIntro.textContent = firstTime
    ? "First time here. Whatever you type now becomes the passphrase for this phone. Pick something you'll remember."
    : "Your passphrase opens the entries on this phone. It isn't kept anywhere — not here, not on a server — so there's no hint and no reset.";
  confirmWrap.hidden = !firstTime;
  unlockBtn.textContent = firstTime ? 'Set it up' : 'Unlock';
  unlockError.textContent = '';
  openModal(unlockModal, { initialFocus: passInput });
}

function setUnlockBusy(busy) {
  passInput.disabled = busy;
  confirmInput.disabled = busy;
  unlockBtn.disabled = busy;
  if (busy) unlockBtn.textContent = COPY.unlocking;
  else unlockBtn.textContent = confirmWrap.hidden ? 'Unlock' : 'Set it up';
}

async function attemptUnlock() {
  if (unlockBtn.disabled) return;
  const passphrase = passInput.value;
  const again = confirmWrap.hidden ? passphrase : confirmInput.value;
  passInput.value = '';
  confirmInput.value = '';
  if (!passphrase) {
    unlockError.textContent = COPY.errors['empty-passphrase'];
    passInput.focus();
    return;
  }
  if (again !== passphrase) {
    unlockError.textContent = "Those two don't match. Try again.";
    passInput.focus();
    return;
  }
  unlockError.textContent = '';
  setUnlockBusy(true);
  renderUnlocking();
  try {
    const data = await store.unlock(passphrase);
    state.records = data.records;
    state.settings = data.settings;
    setUnlockBusy(false);
    closeModal(unlockModal);
    renderUnlocked();
  } catch (err) {
    setUnlockBusy(false);
    renderLocked();
    unlockError.textContent = errorMessage(err);
    passInput.focus();
  }
}

/* ───────────────────────────── locked views ───────────────────────────── */

function renderLocked() {
  content.replaceChildren(
    el('div', { class: 'usm-card rhythm-locked' }, [
      el('p', { class: 'rhythm-answer', text: store.hasData() ? 'Rhythm is locked.' : "Rhythm is ready when you are." }),
      el('p', { class: 'rhythm-note', text: COPY.localOnly }),
      button('Unlock', 'usm-btn--primary', showUnlockModal),
      el('p', { class: 'rhythm-note', text: COPY.loss }),
    ]),
  );
}

function renderUnlocking() {
  content.replaceChildren(
    el('div', { class: 'usm-card rhythm-skeleton', 'aria-hidden': 'true' }, [
      el('span', { class: 'usm-skeleton' }),
      el('span', { class: 'usm-skeleton' }),
      el('span', { class: 'usm-skeleton' }),
    ]),
    el('p', { class: 'rhythm-note', role: 'status', text: COPY.unlocking }),
  );
}

/* ──────────────────────────── unlocked: answer ──────────────────────────── */

function lengthsPhrase(lengths) {
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  return min === max ? `each been ${min} days` : `run ${min}–${max} days`;
}

function buildAnswer(records) {
  const wrap = el('div', { class: 'usm-card rhythm-answer-card' });
  if (records.length === 0) {
    wrap.className = 'usm-empty';
    wrap.textContent = COPY.empty;
    return wrap;
  }

  const p = predictNextWindow(records, new Date());
  const n = p.usableCycles;
  const cycles = `${n} cycle${n === 1 ? '' : 's'}`;

  if (p.state === 'insufficient') {
    const recent = records.slice(0, 3).map((r) => formatLongDate(r.startDate));
    const more = records.length > 3 ? `, and ${records.length - 3} earlier` : '';
    wrap.append(
      el('p', { class: 'rhythm-answer', text: COPY.insufficient }),
      el('p', { class: 'rhythm-basis', text: `Recorded so far: ${recent.join(', ')}${more}.` }),
    );
  } else if (p.isPastWindow) {
    wrap.append(
      el('span', { class: 'usm-tone usm-tone--waiting', text: 'Past the window' }),
      el('p', { class: 'rhythm-answer', text: COPY.pastWindow }),
      el('p', { class: 'rhythm-basis', text: `The window I had was ${formatDateRange(p.windowStart, p.windowEnd)}, from your last ${cycles}.` }),
    );
  } else if (p.confidence === 'low') {
    wrap.append(
      el('span', { class: 'usm-tone usm-tone--waiting', text: 'Rough guess' }),
      el('p', { class: 'rhythm-answer', text: `Rough guess, from ${cycles} — your next period may be around ${formatDateRange(p.windowStart, p.windowEnd)}.` }),
      el('p', { class: 'rhythm-basis', text: `Those cycles have ${lengthsPhrase(p.recentLengths)}. The more there is to go on, the closer this gets.` }),
    );
  } else {
    wrap.append(
      el('span', { class: 'usm-tone usm-tone--calm', text: 'Estimate' }),
      el('p', { class: 'rhythm-answer', text: `Your next period may be around ${formatDateRange(p.windowStart, p.windowEnd)}.` }),
      el('p', { class: 'rhythm-basis', text: `Based on your last ${cycles}, which have ${lengthsPhrase(p.recentLengths)}.` }),
    );
  }

  if (p.discardedCycles > 0) {
    const g = p.discardedCycles;
    wrap.appendChild(el('p', { class: 'rhythm-basis', text: `I left ${g} gap${g === 1 ? '' : 's'} out of the maths because ${g === 1 ? 'it' : 'they'} didn't look like a cycle.` }));
  }
  return wrap;
}

/* ──────────────────────────── unlocked: status ──────────────────────────── */

/** @param {string} text @param {HTMLElement[]} [actions] */
function showStatus(text, actions = []) {
  if (!statusEl) return;
  clearTimeout(state.undoTimer);
  statusEl.replaceChildren(el('span', { text }), ...actions);
}

function clearStatus() {
  clearTimeout(state.undoTimer);
  if (statusEl) statusEl.replaceChildren();
}

async function refresh() {
  try {
    state.records = await store.list();
  } catch (err) {
    showStatus(errorMessage(err));
    return;
  }
  if (answerEl) answerEl.replaceChildren(buildAnswer(state.records));
  if (historyEl) renderHistory();
  syncReminder();
}

/* ─────────────────────────── unlocked: reminder ─────────────────────────── */

const REMINDER_LEAD_DAYS = 3;
const REMINDER_HOUR = 9; // local; after the engine's default quiet hours end

/**
 * The Rhythm half of the 11-NOTIFICATIONS privacy boundary. Nothing about the
 * window is ever written by the reminder engine: the reminder is registered
 * in memory at unlock, shown only on this page, and "got it" / "later" go back
 * into the encrypted store via rhythmStore.setReminderState(). The wording is
 * deliberately content-free — it must read as nothing to anyone else.
 */
async function syncReminder() {
  clearEphemeral('rhythm');
  if (!state.records || !store.isUnlocked()) return;
  const p = predictNextWindow(state.records, new Date());
  if (p.state !== 'estimate' || p.isPastWindow) return;

  const sourceId = `window-${p.windowStart}`;
  const when = addDays(p.windowStart, -REMINDER_LEAD_DAYS);
  when.setHours(REMINDER_HOUR, 0, 0, 0);

  let saved = null;
  try {
    saved = (await store.getReminderStates())[sourceId] || null;
  } catch {
    saved = null; // no saved state is fine; it just starts fresh
  }
  if (!store.isUnlocked()) return; // locked while we were reading

  registerEphemeral({
    type: 'rhythm',
    sourceId,
    title: 'Something to keep an eye on this week.',
    body: 'Just a heads-up.',
    scheduledAt: when,
    status: saved ? saved.status : 'pending',
    snoozedUntil: saved ? saved.snoozedUntil : null,
    dismissedAt: saved ? saved.dismissedAt : null,
    deliveredAt: saved ? saved.deliveredAt : null,
    onChange: (snap) => {
      if (!store.isUnlocked()) return;
      store.setReminderState(sourceId, snap).catch(() => { /* saving failed; the page's own status line covers writes she makes */ });
    },
  });
}

/* ─────────────────────────── unlocked: logging ─────────────────────────── */

async function addStart(iso) {
  let record;
  try {
    record = await store.add({ startDate: iso });
  } catch (err) {
    showStatus(errorMessage(err));
    return;
  }
  await refresh();
  const undo = button('Undo', 'usm-btn--secondary', async () => {
    try {
      await store.remove(record.id);
      await refresh();
      showStatus('Undone.');
    } catch (err) {
      showStatus(errorMessage(err));
    }
  });
  const more = button('Add a bit more', 'usm-btn--ghost', () => {
    clearStatus();
    openEditor(record.id, { detailsOpen: true });
  });
  showStatus(`Logged for ${dayLabel(iso)}.`, [undo, more]);
  state.undoTimer = setTimeout(() => {
    if (statusEl && statusEl.contains(undo)) undo.remove();
  }, UNDO_MS);
}

/** The one-tap path. Guards against logging the same start twice. */
async function logStart(iso) {
  if (!state.records) return;
  const near = store.findNear(state.records, iso);
  if (!near) {
    await addStart(iso);
    return;
  }
  const day = ordinal(parseISO(near.startDate).getDate());
  const change = button('Change it', 'usm-btn--secondary', async () => {
    try {
      await store.update(near.id, { startDate: iso });
      await refresh();
      showStatus(`Changed to ${dayLabel(iso)}.`);
    } catch (err) {
      showStatus(errorMessage(err));
    }
  });
  const keep = button('Keep it', 'usm-btn--ghost', clearStatus);
  showStatus(`You already logged this on the ${day} — want to change it to ${dayLabel(iso)}?`, [change, keep]);
}

function buildLogging() {
  const primary = button('Period started today', 'usm-btn--primary rhythm-primary', () => logStart(todayISO()));

  const pickInput = el('input', { type: 'date', class: 'usm-input', max: todayISO(), 'aria-label': 'Start date' });
  const pickRow = el('div', { class: 'rhythm-pick', hidden: true }, [
    pickInput,
    button('Log it', 'usm-btn--secondary', () => {
      const iso = pickInput.value;
      if (!iso) { pickInput.focus(); return; }
      if (iso > todayISO()) { showStatus("That date hasn't happened yet."); return; }
      pickRow.hidden = true;
      pickInput.value = '';
      logStart(iso);
    }),
  ]);

  const pickToggle = button('Pick a date', 'usm-btn--ghost', () => {
    pickRow.hidden = !pickRow.hidden;
    pickToggle.setAttribute('aria-expanded', String(!pickRow.hidden));
    pickInput.max = todayISO();
    if (!pickRow.hidden) pickInput.focus();
  }, { 'aria-expanded': 'false' });

  const corrections = el('div', { class: 'rhythm-corrections' }, [
    button('Actually, it started yesterday', 'usm-btn--ghost', () => logStart(toISO(addDays(new Date(), -1)))),
    pickToggle,
  ]);

  statusEl = el('div', { class: 'rhythm-status', 'aria-live': 'polite' });
  return [primary, corrections, pickRow, statusEl];
}

/* ─────────────────────────── unlocked: history ─────────────────────────── */

function describeRecord(record, lengthToNext) {
  const bits = [];
  if (record.endDate) {
    const span = daysBetween(record.startDate, record.endDate) + 1;
    bits.push(`${span} day${span === 1 ? '' : 's'}, through ${formatDateRange(record.endDate, record.endDate)}`);
  }
  if (record.flow) bits.push(record.flow);
  if (lengthToNext !== null && lengthToNext !== undefined) {
    const plausible = lengthToNext >= MIN_CYCLE_DAYS && lengthToNext <= MAX_CYCLE_DAYS;
    bits.push(plausible ? `${lengthToNext} days to the next` : `${lengthToNext} days to the next — left out of the guess`);
  }
  return bits.join(' · ');
}

function buildRow(record, lengthToNext, index) {
  const row = el('li', { class: 'usm-well rhythm-row', 'data-id': record.id });
  if (!state.historyAnimated) {
    row.classList.add('reveal');
    row.setAttribute('data-delay', String((index % 4) + 1));
  }
  const meta = describeRecord(record, lengthToNext);
  const extras = [];
  if (record.symptoms.length) extras.push(record.symptoms.join(', '));
  if (record.mood) extras.push(record.mood);
  if (record.note) extras.push(record.note);

  row.append(...[
    el('div', { class: 'rhythm-row__head' }, [
      el('span', { class: 'rhythm-row__date', text: formatLongDate(record.startDate) }),
      el('div', { class: 'rhythm-row__actions' }, [
        button('Edit', 'usm-btn--ghost', () => openEditor(record.id), { 'aria-label': `Edit the entry from ${formatLongDate(record.startDate)}` }),
        button('Delete', 'usm-btn--ghost', () => confirmDelete(record.id), { 'aria-label': `Delete the entry from ${formatLongDate(record.startDate)}` }),
      ]),
    ]),
    meta ? el('p', { class: 'rhythm-row__meta', text: meta }) : null,
    extras.length ? el('p', { class: 'rhythm-row__extra', text: extras.join(' — ') }) : null,
  ].filter(Boolean));
  return row;
}

function renderHistory() {
  const records = state.records || [];
  historyEl.replaceChildren();
  if (records.length === 0) return;

  const p = predictNextWindow(records, new Date());
  historyEl.appendChild(el('h2', { class: 'rhythm-section-title', text: "What I've got recorded" }));
  if (p.usableLengths.length === 1) {
    historyEl.appendChild(el('p', { class: 'rhythm-lengths', text: `Your last cycle was ${p.usableLengths[0]} days.` }));
  } else if (p.usableLengths.length > 1) {
    historyEl.appendChild(el('p', { class: 'rhythm-lengths', text: `Your cycles have been ${p.usableLengths.join(', ')} days.` }));
  }

  const lengths = cycleLengthByRecord(records);
  const list = el('ul', { class: 'rhythm-list' });
  records.forEach((r, i) => list.appendChild(buildRow(r, lengths.get(r.id), i)));
  historyEl.appendChild(list);
  initReveal(historyEl);
  state.historyAnimated = true;
}

function rowFor(id) {
  return historyEl ? historyEl.querySelector(`[data-id="${id}"]`) : null;
}

function confirmDelete(id) {
  const record = (state.records || []).find((r) => r.id === id);
  const row = rowFor(id);
  if (!record || !row) return;
  const yes = button('Delete', 'usm-btn--secondary', async () => {
    try {
      await store.remove(id);
      await refresh();
      showStatus(`Deleted the entry from ${formatLongDate(record.startDate)}.`);
    } catch (err) {
      showStatus(errorMessage(err));
    }
  });
  const keep = button('Keep', 'usm-btn--ghost', () => renderHistory());
  row.replaceChildren(el('div', { class: 'rhythm-confirm' }, [
    el('span', { text: `Delete the entry from ${formatDateRange(record.startDate, record.startDate)}?` }),
    yes,
    keep,
  ]));
  yes.focus();
}

/* ──────────────────────── unlocked: editor (R2/R3) ──────────────────────── */

function choiceGroup(label, options, selected, { multi }) {
  const group = el('div', { class: 'rhythm-choices', role: 'group', 'aria-label': label });
  const current = new Set(multi ? selected : selected ? [selected] : []);
  options.forEach((opt) => {
    const pill = el('button', { type: 'button', class: 'usm-pill', text: opt, 'aria-pressed': String(current.has(opt)) });
    pill.addEventListener('click', () => {
      const on = pill.getAttribute('aria-pressed') === 'true';
      if (!multi) group.querySelectorAll('.usm-pill').forEach((p) => p.setAttribute('aria-pressed', 'false'));
      pill.setAttribute('aria-pressed', String(!on)); // clicking the selected one clears it
    });
    group.appendChild(pill);
  });
  const read = () => {
    const on = Array.from(group.querySelectorAll('[aria-pressed="true"]')).map((p) => p.textContent);
    return multi ? on : on[0] || null;
  };
  return { node: group, read };
}

function openEditor(id, { detailsOpen = false } = {}) {
  const record = (state.records || []).find((r) => r.id === id);
  const row = rowFor(id);
  if (!record || !row) return;

  const start = el('input', { type: 'date', class: 'usm-input', value: record.startDate, max: todayISO(), id: `start-${id}` });
  const end = el('input', { type: 'date', class: 'usm-input', value: record.endDate || '', min: record.startDate, max: toISO(addDays(record.startDate, store.MAX_DURATION_DAYS)), id: `end-${id}` });
  start.addEventListener('change', () => {
    if (start.value) { end.min = start.value; end.max = toISO(addDays(start.value, store.MAX_DURATION_DAYS)); }
  });
  const flow = choiceGroup('Flow', store.FLOWS, record.flow, { multi: false });
  const symptoms = choiceGroup('Symptoms', store.SYMPTOMS, record.symptoms, { multi: true });
  const mood = el('input', { type: 'text', class: 'usm-input', value: record.mood, maxlength: store.MOOD_MAX, autocomplete: 'off', id: `mood-${id}` });
  const note = el('textarea', { class: 'usm-textarea', maxlength: store.NOTE_MAX, id: `note-${id}` });
  note.value = record.note;
  const error = el('p', { class: 'rhythm-inline-error', 'aria-live': 'polite' });

  const field = (labelText, input, hint) => el('div', { class: 'usm-field' }, [
    el('label', { class: 'usm-field__label', for: input.id, text: labelText }),
    input,
    hint ? el('span', { class: 'usm-field__hint', text: hint }) : null,
  ]);
  const group = (labelText, node) => el('div', { class: 'usm-field' }, [
    el('span', { class: 'usm-field__label', text: labelText }),
    node,
  ]);

  const details = el('details', { class: 'rhythm-details', open: detailsOpen }, [
    el('summary', { text: 'Add a bit more' }),
    el('div', { class: 'rhythm-details__body' }, [
      field('Ended', end, 'Optional — leave it if you like.'),
      group('Flow', flow.node),
      group('How it felt', symptoms.node),
      field('Mood', mood),
      field('Note', note),
    ]),
  ]);

  const save = button('Save', 'usm-btn--primary', async () => {
    error.textContent = '';
    try {
      await store.update(id, {
        startDate: start.value,
        endDate: end.value || null,
        flow: flow.read(),
        symptoms: symptoms.read(),
        mood: mood.value,
        note: note.value,
      });
      await refresh();
      showStatus('Saved.');
    } catch (err) {
      error.textContent = errorMessage(err);
    }
  });
  const cancel = button('Cancel', 'usm-btn--ghost', () => renderHistory());

  row.replaceChildren(el('div', { class: 'rhythm-form' }, [
    field('Started', start),
    details,
    error,
    el('div', { class: 'rhythm-form__actions' }, [save, cancel]),
  ]));
  (detailsOpen ? end : start).focus();
}

/* ─────────────────────────── unlocked: settings ─────────────────────────── */

async function downloadCopy() {
  let json;
  try {
    json = await store.exportJson();
  } catch (err) {
    showStatus(errorMessage(err));
    return;
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: store.exportFilename() });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildSettings() {
  const lockSelect = el('select', { class: 'usm-select', id: 'rhythmAutoLock', 'aria-describedby': 'rhythmAutoLockHint' });
  [1, 5, 15].forEach((m) => lockSelect.appendChild(el('option', { value: String(m), text: `${m} minute${m === 1 ? '' : 's'}` })));
  lockSelect.value = String(state.settings ? state.settings.autoLockMinutes : store.DEFAULT_AUTO_LOCK_MINUTES);
  if (!lockSelect.value) lockSelect.value = String(store.DEFAULT_AUTO_LOCK_MINUTES);
  lockSelect.addEventListener('change', async () => {
    try {
      state.settings = await store.updateSettings({ autoLockMinutes: Number(lockSelect.value) });
    } catch (err) {
      showStatus(errorMessage(err));
    }
  });

  return el('details', { class: 'rhythm-details usm-card' }, [
    el('summary', { text: 'Settings' }),
    el('div', { class: 'rhythm-details__body' }, [
      el('p', { class: 'rhythm-note', text: COPY.honestLock }),
      el('p', { class: 'rhythm-note', text: COPY.localOnly }),
      el('div', { class: 'usm-field' }, [
        el('label', { class: 'usm-field__label', for: 'rhythmAutoLock', text: 'Lock on its own after' }),
        lockSelect,
        el('span', { class: 'usm-field__hint', id: 'rhythmAutoLockHint', text: 'Counted while the page is out of sight — another tab, the phone asleep.' }),
      ]),
      el('div', { class: 'rhythm-settings-actions' }, [
        button('Lock now', 'usm-btn--secondary', () => lock()),
      ]),
      el('hr', { class: 'usm-divider' }),
      el('p', { class: 'rhythm-note' }, [el('strong', { text: COPY.exportWarning })]),
      el('div', { class: 'rhythm-settings-actions' }, [
        button('Download a copy', 'usm-btn--secondary', downloadCopy),
      ]),
      el('p', { class: 'rhythm-note', text: COPY.loss }),
    ]),
  ]);
}

/* ──────────────────────────── unlocked: page ──────────────────────────── */

function renderUnlocked() {
  const reminderEl = el('div', { class: 'rhythm-reminders' });
  answerEl = el('div', { class: 'rhythm-answer-wrap' }, [buildAnswer(state.records)]);
  historyEl = el('section', { class: 'rhythm-history', 'aria-label': 'Recorded' });
  content.replaceChildren(reminderEl, answerEl, ...buildLogging(), historyEl, buildSettings());
  renderHistory();
  if (state.reminderStrip) state.reminderStrip.unmount();
  state.reminderStrip = mountReminderStrip(reminderEl, { types: ['rhythm'] });
  syncReminder();
}

/* ───────────────────────────────── boot ───────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  initSiteChrome({ active: 'foryou' });
  content = document.getElementById('rhythmContent');
  if (!content) return;

  let cryptoOk = false;
  try {
    cryptoOk = !!(globalThis.crypto && crypto.subtle);
  } catch {
    cryptoOk = false;
  }
  if (!cryptoOk) {
    content.replaceChildren(el('div', { class: 'usm-card' }, [el('p', { class: 'rhythm-answer', text: COPY.errors['no-crypto'] })]));
    return;
  }

  buildUnlockModal();
  wireAutoLock();
  renderLocked();
  requestAnimationFrame(() => setTimeout(() => initReveal(), 50));
  showUnlockModal();
});
