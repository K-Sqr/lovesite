/**
 * reminders.js — the one reminder engine (11-NOTIFICATIONS.md).
 *
 * A queue in localStorage, evaluated when a page loads and when the tab
 * becomes visible again, handed to whichever delivery adapters are enabled
 * (src/modules/notifiers/). Level 1 — "here on the site" — is the only
 * adapter on by default. Nothing here runs when the tab is closed, and that
 * is a deliberate, documented limit, not a bug.
 *
 *   createStore('reminders',     { version: 1 })  →  usm.reminders.v1     { items: Reminder[] }
 *   createStore('reminderPrefs', { version: 1 })  →  usm.reminderPrefs.v1 Prefs
 *
 * Features never construct storage rows. They call registerReminder() /
 * upsertReminder() with (type, sourceId, title, body, scheduledAt) and the
 * engine owns the record from there. `sourceId` is opaque — never a name, a
 * phone number, or free text. `title` and `body` may one day be drawn on a
 * lock screen by the browser adapter, so they are treated as public strings.
 *
 * Rhythm is the exception, on purpose. A `type: 'rhythm'` row with a real
 * `scheduledAt` in plaintext localStorage would hand her cycle dates to anyone
 * with her unlocked laptop and DevTools — exactly the threat the Rhythm
 * passphrase exists for. So Rhythm reminders never enter the general store:
 * rhythm.js hands them over at unlock time through registerEphemeral(), the
 * engine holds them in memory only, and their status changes go back to the
 * caller's encrypted store through an onChange callback. The honest
 * consequence: Rhythm reminders appear only inside rhythm.html after she
 * enters her passphrase — never on the For You hub, never as a browser
 * notification. REMINDER_TYPES.rhythm.channels is the structural guarantee.
 *
 * This file never imports firebase.js, never fetches, never beacons, never
 * touches localStorage directly (storage.js does), and never polls.
 */

import { createStore } from './storage.js';
import { parseISO, toISO, startOfDay, addDays, daysBetween } from './dates.js';
import { getNotifiers } from './notifiers/index.js';

/** The only console output in this module. Never pass it a record. */
function warn(message, err) {
  if (err !== undefined) console.warn(`[reminders] ${message}`, err);
  else console.warn(`[reminders] ${message}`);
}

/* ─────────────────────────────── vocabulary ─────────────────────────────── */

/** @typedef {'rhythm'|'checkin'|'birthday'|'application'|'outfit'|'date'} ReminderType */
/** @typedef {'pending'|'due'|'delivered'|'snoozed'|'dismissed'|'cancelled'} ReminderStatus */
/** @typedef {'in-app'|'browser'|'email'|'push'} DeliveryMethod */

/**
 * @typedef {Object} Reminder
 * @property {string} id               stable for the life of the record ('rmd_…')
 * @property {ReminderType} type
 * @property {string} sourceId         opaque id owned by the emitting feature
 * @property {string} title            lock-screen-safe
 * @property {string} body             lock-screen-safe
 * @property {string|null} href        same-site link back to the source, or null
 * @property {string} scheduledAt      ISO — when it becomes due
 * @property {string} createdAt        ISO
 * @property {ReminderStatus} status
 * @property {DeliveryMethod|null} deliveryMethod   set on delivery
 * @property {string|null} deliveredAt ISO or null
 * @property {string|null} snoozedUntil ISO or null
 * @property {string|null} dismissedAt ISO or null
 * @property {string|null} cancelledAt ISO or null
 */

/**
 * One source of truth for types and channel policy. `channels` is a hard
 * allow-list enforced in evaluateReminders(), not a hint: a rhythm reminder
 * can only ever reach 'in-app', whatever the preferences say.
 */
export const REMINDER_TYPES = {
  rhythm:      { label: 'Rhythm',              defaultEnabled: true,  channels: ['in-app'] },
  checkin:     { label: 'People',              defaultEnabled: true,  channels: ['in-app', 'browser'] },
  birthday:    { label: 'Birthdays & dates',   defaultEnabled: true,  channels: ['in-app', 'browser'] },
  application: { label: 'Applications',        defaultEnabled: true,  channels: ['in-app', 'browser'] },
  outfit:      { label: 'What to Wear',        defaultEnabled: false, channels: ['in-app'] },
  date:        { label: 'Our dates',           defaultEnabled: true,  channels: ['in-app', 'browser'] },
};

/** Every type that lives in the plaintext store. Rhythm is deliberately absent. */
export const PERSISTED_TYPES = Object.keys(REMINDER_TYPES).filter((t) => t !== 'rhythm');

export const DEDUPE_WINDOW_DAYS = 30;  // dismissed/cancelled rows kept this long so nothing re-raises
export const MIN_GAP_HOURS = 20;       // one surfacing per (type, sourceId) per this many hours
export const EVALUATE_MIN_GAP_MS = 60_000;
export const MAX_VISIBLE = 2;
export const MAX_PER_DAY = 3;
export const AGE_OUT_DAYS = 7;         // a nudge nobody saw in a week is stale, not urgent

/** "Later" intervals, in hours. No dialog ever asks her to pick one. */
export const SNOOZE_HOURS = { rhythm: 24, checkin: 24, birthday: 6, application: 24, outfit: 1, date: 24 };

const TITLE_MAX = 140;
const BODY_MAX = 200;

/** Same date as loveCounter.js's `new Date(2025, 8, 13)`. Duplicated on purpose; 04 forbids editing that file. */
const RELATIONSHIP_START = '2025-09-13';

/* ─────────────────────────────── preferences ─────────────────────────────── */

const DEFAULT_PREFS = {
  enabled: true,                       // the global switch
  channels: { 'in-app': true, browser: false, email: false, push: false },
  types: { rhythm: true, checkin: true, birthday: true, application: true, outfit: false, date: true },
  quietHours: { start: '21:30', end: '08:00' },
  maxPerDay: MAX_PER_DAY,
};

/* ─────────────────────────────── stores ─────────────────────────────── */

let itemStore = null;
let prefStore = null;
let storesOk = false;
try {
  itemStore = createStore('reminders', { version: 1, initial: { items: [] } });
  prefStore = createStore('reminderPrefs', { version: 1, initial: null }); // null = never written; getPrefs() fills defaults
  storesOk = true;
} catch (err) {
  // Never block a page on this system. Every export below becomes a calm no-op.
  warn('stores unavailable; reminders are off for this session', err);
}

function readItems() {
  if (!storesOk) return [];
  try {
    const data = itemStore.read();
    return data && Array.isArray(data.items) ? data.items.filter(isRecord) : [];
  } catch (err) {
    warn('read failed', err);
    return [];
  }
}

function writeItems(items) {
  if (!storesOk) return false;
  try {
    return itemStore.write({ items });
  } catch (err) {
    warn('write failed', err);
    return false;
  }
}

function isRecord(r) {
  return !!r && typeof r === 'object' && typeof r.id === 'string' && typeof r.type === 'string' && typeof r.scheduledAt === 'string';
}

/** @returns {typeof DEFAULT_PREFS} always a complete object, whatever is on disk */
export function getPrefs() {
  let raw = null;
  if (storesOk) {
    try { raw = prefStore.read(); } catch (err) { warn('prefs read failed', err); }
  }
  return mergePrefs(DEFAULT_PREFS, raw);
}

function mergePrefs(base, patch) {
  const out = {
    enabled: base.enabled,
    channels: { ...base.channels },
    types: { ...base.types },
    quietHours: { ...base.quietHours },
    maxPerDay: base.maxPerDay,
  };
  if (!patch || typeof patch !== 'object') return out;
  if (typeof patch.enabled === 'boolean') out.enabled = patch.enabled;
  if (patch.channels && typeof patch.channels === 'object') {
    for (const k of Object.keys(out.channels)) if (typeof patch.channels[k] === 'boolean') out.channels[k] = patch.channels[k];
  }
  if (patch.types && typeof patch.types === 'object') {
    for (const k of Object.keys(out.types)) if (typeof patch.types[k] === 'boolean') out.types[k] = patch.types[k];
  }
  if (patch.quietHours && typeof patch.quietHours === 'object') {
    if (isClock(patch.quietHours.start)) out.quietHours.start = patch.quietHours.start;
    if (isClock(patch.quietHours.end)) out.quietHours.end = patch.quietHours.end;
  }
  if (Number.isInteger(patch.maxPerDay) && patch.maxPerDay >= 1 && patch.maxPerDay <= 10) out.maxPerDay = patch.maxPerDay;
  // 'in-app' is the floor; the site itself is never a channel she can switch off separately.
  out.channels['in-app'] = true;
  return out;
}

function isClock(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/**
 * Patch preferences (one level deep for channels/types/quietHours).
 * Turning the global switch back on discards whatever came due while it was
 * off — she must never be met with a backlog.
 * @param {Partial<typeof DEFAULT_PREFS>} patch
 */
export function setPrefs(patch, { now = new Date() } = {}) {
  if (!storesOk) return getPrefs();
  const before = getPrefs();
  const next = mergePrefs(before, patch);
  try {
    prefStore.write(next);
  } catch (err) {
    warn('prefs write failed', err);
  }
  if (!before.enabled && next.enabled) discardBacklog(now);
  emitChange();
  return next;
}

function discardBacklog(now) {
  const nowISO = now.toISOString();
  const items = readItems();
  let changed = false;
  for (const r of items) {
    if (isTerminal(r.status)) continue;
    if (r.status === 'snoozed') continue; // her own "later" is an intention, keep it
    if (new Date(r.scheduledAt) <= now) {
      r.status = 'dismissed';
      r.dismissedAt = nowISO;
      changed = true;
    }
  }
  for (const r of ephemeral.values()) {
    if (isTerminal(r.status) || r.status === 'snoozed') continue;
    if (new Date(r.scheduledAt) <= now) applyEphemeral(r, { status: 'dismissed', dismissedAt: nowISO });
  }
  if (changed) writeItems(items);
}

/* ─────────────────────────────── helpers ─────────────────────────────── */

function isTerminal(status) {
  return status === 'dismissed' || status === 'cancelled';
}

function newId() {
  let hex = '';
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    hex = Math.random().toString(16).slice(2, 10);
  }
  return `rmd_${hex}`;
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Same-site links only. Anything with a scheme, or outside the site, is dropped. */
function cleanHref(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || /[\s]/.test(s) || /^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith('//')) return null;
  if (s.startsWith('/lovesite/') || s.startsWith('./') || s.startsWith('#')) return s;
  return null;
}

function toInstant(value) {
  const d = value instanceof Date ? new Date(value.getTime()) : parseISO(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Upsert key: the same source on the same local calendar day is the same reminder. */
function keyOf(type, sourceId, scheduledAt) {
  return `${type}|${sourceId}|${toISO(scheduledAt)}`;
}

function sameLocalDay(aISO, bDate) {
  return daysBetween(new Date(aISO), bDate) === 0;
}

function hoursBetween(aISO, bDate) {
  return (bDate.getTime() - new Date(aISO).getTime()) / 3_600_000;
}

/** Quiet hours may wrap midnight ('21:30' → '08:00'); a start equal to the end means "never". */
export function inQuietHours(now, quietHours) {
  const q = quietHours || DEFAULT_PREFS.quietHours;
  if (!isClock(q.start) || !isClock(q.end) || q.start === q.end) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = q.start.split(':').map(Number);
  const [eh, em] = q.end.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start > end ? (mins >= start || mins < end) : (mins >= start && mins < end);
}

/** The hard allow-list. Exported so a test can observe the engine's own refusal. */
export function canDeliver(type, channelId) {
  const def = REMINDER_TYPES[type];
  return !!def && def.channels.includes(channelId);
}

/* ─────────────────────────────── listeners ─────────────────────────────── */

const listeners = new Set();
let storeSubscribed = false;

function emitChange() {
  listeners.forEach((fn) => {
    try { fn(); } catch (err) { warn('subscriber threw', err); }
  });
}

/**
 * Re-render on any change — here, in another tab, or in preferences.
 * @param {() => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribeReminders(fn) {
  listeners.add(fn);
  if (!storeSubscribed && storesOk) {
    storeSubscribed = true;
    try {
      itemStore.subscribe(() => emitChange());
      prefStore.subscribe(() => emitChange());
    } catch (err) {
      warn('store subscribe failed', err);
    }
  }
  return () => listeners.delete(fn);
}

/* ─────────────────────────────── register / cancel ─────────────────────────────── */

/**
 * Upsert by (type, sourceId, local day of scheduledAt). Features call this on
 * every page load; it must never create duplicates. Other live records for the
 * same (type, sourceId) on a *different* day are cancelled — the source moved
 * the date. A record she already dismissed is left alone (no re-raise).
 * @param {{ type: ReminderType, sourceId: string, title: string, body?: string, scheduledAt: string|Date, href?: string|null }} input
 * @returns {string|null} the record id, or null when the input was unusable
 */
export function registerReminder(input) {
  const rec = normaliseInput(input);
  if (!rec) return null;
  if (rec.type === 'rhythm') {
    // Structural: rhythm never enters the plaintext store. See registerEphemeral().
    warn('a rhythm reminder was offered to the persisted store and was refused');
    return null;
  }
  if (!storesOk) return null;

  const items = readItems();
  const key = keyOf(rec.type, rec.sourceId, rec.scheduledAt);
  const nowISO = new Date().toISOString();
  let id = null;
  let changed = false;

  for (const r of items) {
    if (r.type !== rec.type || r.sourceId !== rec.sourceId) continue;
    if (keyOf(r.type, r.sourceId, r.scheduledAt) === key) {
      id = r.id;
      if (r.status === 'dismissed') continue;            // she waved this off; leave it
      if (r.status === 'cancelled') {                     // the source withdrew it and is back
        r.status = 'pending';
        r.cancelledAt = null;
        r.deliveredAt = null;
        r.deliveryMethod = null;
        changed = true;
      }
      if (r.title !== rec.title || r.body !== rec.body || r.href !== rec.href || r.scheduledAt !== rec.scheduledAt) {
        r.title = rec.title;
        r.body = rec.body;
        r.href = rec.href;
        r.scheduledAt = rec.scheduledAt;
        changed = true;
      }
    } else if (!isTerminal(r.status)) {
      r.status = 'cancelled';                             // stale: same source, another day
      r.cancelledAt = nowISO;
      changed = true;
    }
  }

  if (id === null) {
    id = newId();
    items.push({
      id,
      type: rec.type,
      sourceId: rec.sourceId,
      title: rec.title,
      body: rec.body,
      href: rec.href,
      scheduledAt: rec.scheduledAt,
      createdAt: nowISO,
      status: 'pending',
      deliveryMethod: null,
      deliveredAt: null,
      snoozedUntil: null,
      dismissedAt: null,
      cancelledAt: null,
    });
    changed = true;
  }

  if (changed) {
    writeItems(items);
    requestEvaluate();
    emitChange();
  }
  return id;
}

function normaliseInput(input) {
  if (!input || typeof input !== 'object') { warn('registerReminder: not an object'); return null; }
  const { type, sourceId } = input;
  if (!REMINDER_TYPES[type]) { warn('registerReminder: unknown type'); return null; }
  if (typeof sourceId !== 'string' || !sourceId.trim()) { warn('registerReminder: sourceId missing'); return null; }
  const when = toInstant(input.scheduledAt);
  if (!when) { warn('registerReminder: scheduledAt is not a date'); return null; }
  const title = cleanText(input.title, TITLE_MAX);
  if (!title) { warn('registerReminder: title missing'); return null; }
  return {
    type,
    sourceId: sourceId.trim(),
    title,
    body: cleanText(input.body, BODY_MAX),
    href: cleanHref(input.href),
    scheduledAt: when.toISOString(),
  };
}

/**
 * Seam adapter for the records features 07, 08 and 10 already emit:
 *   { id, source, kind, dueAt, title, body, href }
 * Their `kind` vocabulary is mapped onto REMINDER_TYPES here so no feature
 * file needs to know the engine's type names. Returns the engine id.
 */
const SOURCE_KINDS = {
  applications: { deadline: 'application', interview: 'application', followup: 'application' },
  people:       { birthday: 'birthday', checkin: 'checkin', importantDate: 'birthday' },
  outfit:       { outfit: 'outfit' },
};

export function upsertReminder(rec) {
  if (!rec || typeof rec !== 'object') { warn('upsertReminder: not an object'); return null; }
  const bySource = SOURCE_KINDS[rec.source];
  const type = (bySource && bySource[rec.kind]) || (REMINDER_TYPES[rec.kind] ? rec.kind : null);
  if (!type) { warn('upsertReminder: unknown source/kind'); return null; }
  return registerReminder({ type, sourceId: rec.id, title: rec.title, body: rec.body, scheduledAt: rec.dueAt, href: rec.href });
}

/**
 * Cancel by engine id — or, for the feature seams, by their own deterministic
 * id (which the engine stored as `sourceId`). Idempotent.
 * @param {string} id
 */
export function cancelReminder(id) {
  if (typeof id !== 'string' || !id) return;
  const nowISO = new Date().toISOString();
  let changed = false;

  for (const r of ephemeral.values()) {
    if ((r.id === id || r.sourceId === id) && !isTerminal(r.status)) {
      applyEphemeral(r, { status: 'cancelled', cancelledAt: nowISO });
      changed = true;
    }
  }

  if (storesOk) {
    const items = readItems();
    let wrote = false;
    for (const r of items) {
      if ((r.id === id || r.sourceId === id) && !isTerminal(r.status)) {
        r.status = 'cancelled';
        r.cancelledAt = nowISO;
        wrote = true;
      }
    }
    if (wrote) { writeItems(items); changed = true; }
  }
  if (changed) emitChange();
}

/** Cancel every live record for a source. Idempotent; used when a source is deleted. */
export function cancelBySource(type, sourceId) {
  if (typeof sourceId !== 'string' || !sourceId) return;
  const nowISO = new Date().toISOString();
  let changed = false;

  for (const r of ephemeral.values()) {
    if (r.type === type && r.sourceId === sourceId && !isTerminal(r.status)) {
      applyEphemeral(r, { status: 'cancelled', cancelledAt: nowISO });
      changed = true;
    }
  }
  if (storesOk) {
    const items = readItems();
    let wrote = false;
    for (const r of items) {
      if (r.type === type && r.sourceId === sourceId && !isTerminal(r.status)) {
        r.status = 'cancelled';
        r.cancelledAt = nowISO;
        wrote = true;
      }
    }
    if (wrote) { writeItems(items); changed = true; }
  }
  if (changed) emitChange();
}

/* ─────────────────────────────── ephemeral (Rhythm) ─────────────────────────────── */

/**
 * In-memory reminders that are NEVER written by the engine. The caller owns
 * persistence (Rhythm keeps status inside its encrypted store) and re-registers
 * on every unlock, passing back whatever status it saved. Status changes made
 * here — delivered, snoozed, dismissed, cancelled — are reported through
 * `onChange(snapshot)` so the caller can save them.
 * @type {Map<string, Reminder & { onChange?: (snap: object) => void }>}
 */
const ephemeral = new Map();

/**
 * @param {{ type: ReminderType, sourceId: string, title: string, body?: string, scheduledAt: string|Date, href?: string|null,
 *           status?: ReminderStatus, snoozedUntil?: string|null, dismissedAt?: string|null, deliveredAt?: string|null,
 *           onChange?: (snap: { status: ReminderStatus, snoozedUntil: string|null, dismissedAt: string|null, deliveredAt: string|null }) => void }} input
 * @returns {string|null}
 */
export function registerEphemeral(input) {
  const rec = normaliseInput(input);
  if (!rec) return null;
  const key = keyOf(rec.type, rec.sourceId, rec.scheduledAt);
  const existing = ephemeral.get(key);
  const nowISO = new Date().toISOString();
  const status = ['pending', 'due', 'delivered', 'snoozed', 'dismissed', 'cancelled'].includes(input.status) ? input.status : 'pending';
  const record = {
    id: existing ? existing.id : newId(),
    type: rec.type,
    sourceId: rec.sourceId,
    title: rec.title,
    body: rec.body,
    href: rec.href,
    scheduledAt: rec.scheduledAt,
    createdAt: existing ? existing.createdAt : nowISO,
    status,
    deliveryMethod: status === 'delivered' ? 'in-app' : null,
    deliveredAt: typeof input.deliveredAt === 'string' ? input.deliveredAt : null,
    snoozedUntil: typeof input.snoozedUntil === 'string' ? input.snoozedUntil : null,
    dismissedAt: typeof input.dismissedAt === 'string' ? input.dismissedAt : null,
    cancelledAt: null,
    onChange: typeof input.onChange === 'function' ? input.onChange : undefined,
  };
  // Same source, another day → the caller's prediction moved; drop the old one.
  for (const [k, r] of ephemeral) {
    if (k !== key && r.type === rec.type && r.sourceId === rec.sourceId) ephemeral.delete(k);
  }
  ephemeral.set(key, record);
  requestEvaluate();
  emitChange();
  return record.id;
}

/** Forget every ephemeral record of a type (Rhythm calls this on lock). */
export function clearEphemeral(type) {
  let changed = false;
  for (const [k, r] of ephemeral) {
    if (!type || r.type === type) { ephemeral.delete(k); changed = true; }
  }
  if (changed) emitChange();
}

function applyEphemeral(r, patch) {
  Object.assign(r, patch);
  if (r.onChange) {
    try {
      r.onChange({ status: r.status, snoozedUntil: r.snoozedUntil, dismissedAt: r.dismissedAt, deliveredAt: r.deliveredAt });
    } catch (err) {
      warn('ephemeral onChange threw', err);
    }
  }
}

function publicView(r) {
  // Never hand the onChange closure to the UI.
  const { onChange, ...rest } = r;
  return rest;
}

/* ─────────────────────────────── evaluate ─────────────────────────────── */

let inFlight = null;
let runAgain = false;
let evaluateTimer = null;
let lastAutoEvaluate = 0;
let autoWired = false;

/**
 * Coalesce many registerReminder() calls on one page load into one pass.
 * Data-driven, so it is not subject to the 60s visibility debounce.
 */
function requestEvaluate() {
  if (evaluateTimer !== null || typeof setTimeout !== 'function') return;
  evaluateTimer = setTimeout(() => {
    evaluateTimer = null;
    evaluateReminders().catch((err) => warn('evaluate failed', err));
  }, 0);
}

/**
 * Wire the automatic triggers once: an immediate pass now, then one on every
 * visibilitychange → visible, at most once per EVALUATE_MIN_GAP_MS. No timers.
 * The UI calls this after a surface exists, so the first pass has somewhere to deliver.
 */
export function startEvaluating({ now = new Date() } = {}) {
  // First visit: write the defaults so the on-disk record shows what is (and is not) on.
  if (storesOk) {
    try { if (prefStore.read() === null) prefStore.write(DEFAULT_PREFS); } catch (err) { warn('prefs init failed', err); }
  }
  seedDateReminders(now);
  if (!autoWired && typeof document !== 'undefined') {
    autoWired = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastAutoEvaluate < EVALUATE_MIN_GAP_MS) return;
      lastAutoEvaluate = Date.now();
      evaluateReminders().catch((err) => warn('evaluate failed', err));
    });
  }
  lastAutoEvaluate = Date.now();
  return evaluateReminders({ now });
}

/**
 * One pass: prune, age out, move pending/snoozed → due, hand due items to the
 * enabled adapters in registry order, record the first that says "shown".
 * Takes `now` so it can be driven from the console with a fake clock.
 * @param {{ now?: Date }} [opts]
 * @returns {Promise<number>} how many were delivered in this pass
 */
export function evaluateReminders({ now = new Date() } = {}) {
  if (inFlight) { runAgain = true; return inFlight; }
  inFlight = runEvaluate(now).finally(() => {
    inFlight = null;
    if (runAgain) { runAgain = false; requestEvaluate(); }
  });
  return inFlight;
}

async function runEvaluate(now) {
  const prefs = getPrefs();
  if (!prefs.enabled) return 0;   // off means off: no reads that matter, no adapters, no writes

  const nowISO = now.toISOString();
  const snapshot = readItems();
  /** @type {Map<string, object|null>} id → patch, or null to remove */
  const patches = new Map();
  const patch = (r, changes) => {
    Object.assign(r, changes);
    patches.set(r.id, { ...(patches.get(r.id) || {}), ...changes });
  };
  const ephemeralPatch = (r, changes) => applyEphemeral(r, changes);
  const all = [...snapshot.map((r) => ({ r, eph: false })), ...[...ephemeral.values()].map((r) => ({ r, eph: true }))];

  // 1. Prune terminal rows past the dedupe window; age out stale ones.
  for (const { r, eph } of all) {
    if (eph) continue;
    if (isTerminal(r.status)) {
      const at = r.dismissedAt || r.cancelledAt || r.createdAt;
      if (daysBetween(new Date(at), now) > DEDUPE_WINDOW_DAYS) patches.set(r.id, null);
      continue;
    }
    if (r.status === 'delivered' && r.deliveredAt && daysBetween(new Date(r.deliveredAt), now) > AGE_OUT_DAYS) {
      patch(r, { status: 'dismissed', dismissedAt: nowISO });
    } else if ((r.status === 'pending' || r.status === 'due') && daysBetween(new Date(r.scheduledAt), now) > AGE_OUT_DAYS) {
      patch(r, { status: 'dismissed', dismissedAt: nowISO });
    }
  }

  // 2. Status machine: pending → due, snoozed → due.
  for (const { r, eph } of all) {
    const set = eph ? ephemeralPatch : patch;
    if (r.status === 'pending' && new Date(r.scheduledAt) <= now) set(r, { status: 'due' });
    else if (r.status === 'snoozed' && r.snoozedUntil && new Date(r.snoozedUntil) <= now) set(r, { status: 'due', snoozedUntil: null });
  }

  // 3. Deliver, most time-relevant first, under the daily cap.
  const quiet = inQuietHours(now, prefs.quietHours);
  const notifiers = getNotifiers().filter((n) => prefs.channels[n.id]);
  let deliveredToday = all.filter(({ r }) => r.deliveredAt && sameLocalDay(r.deliveredAt, now)).length;
  const cap = prefs.maxPerDay || MAX_PER_DAY;
  const due = all
    .filter(({ r }) => r.status === 'due' && prefs.types[r.type] !== false)
    .sort((a, b) => (a.r.scheduledAt < b.r.scheduledAt ? 1 : a.r.scheduledAt > b.r.scheduledAt ? -1 : 0));

  let delivered = 0;
  for (const { r, eph } of due) {
    if (deliveredToday >= cap) break;
    // Never surface the same (type, sourceId) twice within MIN_GAP_HOURS — other records, not this one's own snooze.
    const recent = all.some(({ r: o }) => o !== r && o.type === r.type && o.sourceId === r.sourceId
      && o.deliveredAt && hoursBetween(o.deliveredAt, now) < MIN_GAP_HOURS);
    if (recent) continue;

    const method = await deliverVia(r, notifiers, quiet);
    if (!method) continue;
    (eph ? ephemeralPatch : patch)(r, { status: 'delivered', deliveryMethod: method, deliveredAt: nowISO });
    deliveredToday += 1;
    delivered += 1;
  }

  // 4. One write, merged onto whatever is on disk now (a register() may have landed mid-pass).
  if (patches.size > 0 && storesOk) {
    const fresh = readItems();
    const next = [];
    for (const r of fresh) {
      if (!patches.has(r.id)) { next.push(r); continue; }
      const p = patches.get(r.id);
      if (p === null) continue;
      next.push({ ...r, ...p });
    }
    writeItems(next);
    emitChange();
  } else if (delivered > 0 || due.length > 0) {
    emitChange();
  }
  return delivered;
}

/** Try each enabled adapter in registry order; the engine's allow-list wins over everything. */
async function deliverVia(r, notifiers, quiet) {
  for (const n of notifiers) {
    if (!canDeliver(r.type, n.id)) {
      if (r.type === 'rhythm' && n.id !== 'in-app') warn(`refused to hand a rhythm reminder to "${n.id}"`);
      continue;
    }
    // Quiet hours hold everything except the site itself — she opened it; she is not being interrupted.
    if (quiet && n.id !== 'in-app') continue;
    try {
      if (!(await n.isAvailable())) continue;
      if (await n.deliver(publicView(r))) return n.id;
    } catch (err) {
      warn(`adapter "${n.id}" threw; falling through`, err);
    }
  }
  return null;
}

/* ─────────────────────────────── read side ─────────────────────────────── */

/**
 * Delivered, un-dismissed reminders ready to show, most time-relevant first.
 * With no `types`, every persisted type — ephemeral (Rhythm) records are
 * returned only when 'rhythm' is asked for by name, so a hub-style caller can
 * never see them by accident.
 * @param {{ types?: string[], max?: number }} [opts]
 * @returns {Reminder[]}
 */
export function listActionable({ types, max } = {}) {
  const prefs = getPrefs();
  if (!prefs.enabled) return [];
  const wanted = Array.isArray(types) && types.length ? types.filter((t) => REMINDER_TYPES[t]) : PERSISTED_TYPES;
  const allowed = new Set(wanted.filter((t) => prefs.types[t] !== false));

  const out = [];
  if ([...allowed].some((t) => t !== 'rhythm')) {
    for (const r of readItems()) {
      if (r.status === 'delivered' && allowed.has(r.type) && r.type !== 'rhythm') out.push(r);
    }
  }
  if (allowed.has('rhythm')) {
    for (const r of ephemeral.values()) if (r.status === 'delivered') out.push(publicView(r));
  }
  out.sort((a, b) => (a.scheduledAt < b.scheduledAt ? 1 : a.scheduledAt > b.scheduledAt ? -1 : 0));
  return Number.isInteger(max) && max >= 0 ? out.slice(0, max) : out;
}

/** "Later." Default interval is per type (SNOOZE_HOURS); no dialog. */
export function snoozeReminder(id, untilISO, { now = new Date() } = {}) {
  const apply = (r) => {
    if (r.status !== 'delivered' && r.status !== 'due') return false;
    let until = untilISO ? toInstant(untilISO) : null;
    if (!until) until = new Date(now.getTime() + (SNOOZE_HOURS[r.type] || 24) * 3_600_000);
    return { status: 'snoozed', snoozedUntil: until.toISOString() };
  };
  mutate(id, apply);
}

/** "Got it." */
export function dismissReminder(id, { now = new Date() } = {}) {
  mutate(id, (r) => (isTerminal(r.status) ? false : { status: 'dismissed', dismissedAt: now.toISOString() }));
}

function mutate(id, fn) {
  if (typeof id !== 'string') return;
  let changed = false;
  for (const r of ephemeral.values()) {
    if (r.id !== id) continue;
    const p = fn(r);
    if (p) { applyEphemeral(r, p); changed = true; }
  }
  if (storesOk) {
    const items = readItems();
    let wrote = false;
    for (const r of items) {
      if (r.id !== id) continue;
      const p = fn(r);
      if (p) { Object.assign(r, p); wrote = true; }
    }
    if (wrote) { writeItems(items); changed = true; }
  }
  if (changed) emitChange();
}

/* ─────────────────────────────── the one producer this file owns ─────────────────────────────── */

const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/**
 * The anniversary, the morning before. Registered while the day is still
 * ahead; on the day itself the target rolls to next year, so she is never
 * told "tomorrow" on the day. Birthdays belong to People and are registered there.
 */
export function seedDateReminders(now = new Date()) {
  const start = parseISO(RELATIONSHIP_START);
  let year = now.getFullYear();
  let anniv = new Date(year, start.getMonth(), start.getDate());
  if (daysBetween(startOfDay(now), anniv) < 1) { year += 1; anniv = new Date(year, start.getMonth(), start.getDate()); }
  const years = year - start.getFullYear();
  const word = WORDS[years] || String(years);
  const when = addDays(anniv, -1);
  when.setHours(9, 0, 0, 0);
  registerReminder({
    type: 'date',
    sourceId: `anniversary-${year}`,
    title: years === 1 ? 'Tomorrow makes a year. ❤️' : `Tomorrow makes ${word} years. ❤️`,
    body: 'Just saying.',
    scheduledAt: when,
    href: './index.html',
  });
}

/* ─────────────────────────────── diagnostics ─────────────────────────────── */

/** Everything, including terminal rows — for the console and tests. Never used by the UI. */
export function _debugList() {
  return { items: readItems(), ephemeral: [...ephemeral.values()].map(publicView) };
}
