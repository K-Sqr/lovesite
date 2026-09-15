/**
 * rhythmStore.js — the Rhythm page's records, encrypted at rest.
 *
 * A thin wrapper over `createStore('rhythm', { version: 1, encrypted: true })`
 * from storage.js (PBKDF2-SHA256 → AES-GCM, non-extractable key, fresh IV per
 * write, no verification hash). This module adds only the record shape, the
 * CRUD, and a plaintext export. It knows nothing about the DOM.
 *
 * Nothing here talks to a server, a console, or anything outside this tab.
 * The passphrase is a function argument and nothing else: never assigned to
 * module state, never stored, never logged.
 *
 * Decrypted payload:
 *   { version: 1, records: [Record], settings: { autoLockMinutes: 5 }, reminders: { [sourceId]: State } }
 * `records` is kept sorted newest-first on every write, so rendering never sorts.
 *
 * `reminders` is the Rhythm half of 11-NOTIFICATIONS' privacy boundary. The
 * reminder engine never writes a rhythm row to its plaintext store; instead
 * rhythm.js registers an in-memory ("ephemeral") reminder at unlock and the
 * engine hands status changes ("got it", "later") back here, where they are
 * saved INSIDE this ciphertext — same passphrase, same key, one unlock.
 *   State: { status: 'delivered'|'snoozed'|'dismissed', snoozedUntil, dismissedAt, deliveredAt, updatedAt }
 * Entries older than REMINDER_STATE_DAYS are dropped on read, so nothing accumulates.
 */

import { createStore, StorageError } from './storage.js';
import { toISO, daysBetween, parseISO } from './dates.js';

export { StorageError };

export const STORE_NAME = 'rhythm';
export const STORE_VERSION = 1;
export const FLOWS = ['light', 'medium', 'heavy'];
export const SYMPTOMS = ['cramps', 'headache', 'tired', 'back pain', 'nausea', 'bloating'];
export const NOTE_MAX = 500;
export const MOOD_MAX = 80;
export const MAX_DURATION_DAYS = 14;
export const DUPLICATE_WINDOW_DAYS = 3;
export const DEFAULT_AUTO_LOCK_MINUTES = 5;
export const REMINDER_STATE_DAYS = 30;
const REMINDER_STATUSES = ['delivered', 'snoozed', 'dismissed'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RECORD_ID = /^r_[a-z0-9-]{1,64}$/i;

function initialData() {
  return { version: STORE_VERSION, records: [], settings: { autoLockMinutes: DEFAULT_AUTO_LOCK_MINUTES }, reminders: {} };
}

/** @type {ReturnType<typeof createStore> | null} */
let store = null;

/** Created lazily so a browser without WebCrypto fails at unlock, not at import. */
function getStore() {
  if (!store) store = createStore(STORE_NAME, { version: STORE_VERSION, encrypted: true, initial: initialData() });
  return store;
}

/* ───────────────────────────── validation ───────────────────────────── */

function isIsoDate(s) {
  return typeof s === 'string' && ISO_DATE.test(s) && !Number.isNaN(parseISO(s).getTime());
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Coerce an arbitrary object into a valid record. Only `startDate` is required;
 * every other field is optional and silently normalised — there is no such
 * thing as a validation error for leaving something empty.
 * @param {object} input
 * @param {object} [existing]  the record being updated, if any
 */
function normalise(input, existing = {}) {
  const startDate = input.startDate !== undefined ? input.startDate : existing.startDate;
  if (!isIsoDate(startDate)) throw new StorageError('A start date is needed', 'bad-start');
  if (startDate > toISO(new Date())) throw new StorageError("That date hasn't happened yet", 'future-start');
  const approximate = input.approximate !== undefined ? input.approximate === true : existing.approximate === true;

  let endDate = input.endDate !== undefined ? input.endDate : existing.endDate;
  if (endDate === '' || endDate === undefined) endDate = null;
  if (endDate !== null) {
    if (!isIsoDate(endDate)) throw new StorageError("That end date doesn't look right", 'bad-end');
    const span = daysBetween(startDate, endDate);
    if (span < 0) throw new StorageError('The end date is before the start', 'end-before-start');
    if (span > MAX_DURATION_DAYS) throw new StorageError(`The end date is more than ${MAX_DURATION_DAYS} days after the start`, 'end-too-late');
  }

  let flow = input.flow !== undefined ? input.flow : existing.flow;
  if (!FLOWS.includes(flow)) flow = null;

  const rawSymptoms = input.symptoms !== undefined ? input.symptoms : existing.symptoms;
  const symptoms = Array.isArray(rawSymptoms)
    ? SYMPTOMS.filter((s) => rawSymptoms.includes(s)) // fixed vocabulary, canonical order, deduped
    : [];

  const mood = cleanText(input.mood !== undefined ? input.mood : existing.mood, MOOD_MAX);
  const note = cleanText(input.note !== undefined ? input.note : existing.note, NOTE_MAX);

  return { startDate, approximate, endDate, flow, symptoms, mood, note };
}

function newId() {
  if (typeof crypto.randomUUID === 'function') return `r_${crypto.randomUUID().slice(0, 8)}`;
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `r_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function sortNewestFirst(records) {
  return records.slice().sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));
}

function isIsoInstant(s) {
  return typeof s === 'string' && !Number.isNaN(new Date(s).getTime());
}

/** Keep only well-formed, recent reminder states. */
function coerceReminders(raw, now = new Date()) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [sourceId, st] of Object.entries(raw)) {
    if (!st || typeof st !== 'object' || !REMINDER_STATUSES.includes(st.status)) continue;
    const updatedAt = isIsoInstant(st.updatedAt) ? st.updatedAt : null;
    if (!updatedAt || daysBetween(new Date(updatedAt), now) > REMINDER_STATE_DAYS) continue;
    out[sourceId] = {
      status: st.status,
      snoozedUntil: isIsoInstant(st.snoozedUntil) ? st.snoozedUntil : null,
      dismissedAt: isIsoInstant(st.dismissedAt) ? st.dismissedAt : null,
      deliveredAt: isIsoInstant(st.deliveredAt) ? st.deliveredAt : null,
      updatedAt,
    };
  }
  return out;
}

/** Make sure whatever was decrypted has the shape the page expects. */
function coerceData(data) {
  const base = initialData();
  if (!data || typeof data !== 'object') return base;
  const seenIds = new Set();
  const records = Array.isArray(data.records)
    ? data.records
      .filter((r) => {
        if (!r || !RECORD_ID.test(r.id) || seenIds.has(r.id) || !isIsoDate(r.startDate)) return false;
        seenIds.add(r.id);
        return true;
      })
      .map((r) => {
        try {
          return {
            id: r.id,
            ...normalise(r),
            createdAt: isIsoInstant(r.createdAt) ? r.createdAt : new Date().toISOString(),
            updatedAt: isIsoInstant(r.updatedAt) ? r.updatedAt : new Date().toISOString(),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
    : [];
  const minutes = data.settings && Number.isFinite(data.settings.autoLockMinutes) ? data.settings.autoLockMinutes : base.settings.autoLockMinutes;
  return { version: STORE_VERSION, records: sortNewestFirst(records), settings: { autoLockMinutes: minutes }, reminders: coerceReminders(data.reminders) };
}

/* ─────────────────────────────── lifecycle ─────────────────────────────── */

/** True when an encrypted envelope is on disk. Does not need the passphrase. */
export function hasData() {
  try {
    return getStore().hasData();
  } catch {
    return false;
  }
}

/**
 * True when something is stored under our key but it is not a readable
 * envelope. We refuse to unlock over it rather than silently start fresh —
 * that would overwrite whatever she had.
 */
export function hasUnreadableData() {
  try {
    const raw = window.localStorage.getItem(getStore().key);
    return raw !== null && !getStore().hasData();
  } catch {
    return false;
  }
}

export function isUnlocked() {
  return store !== null && store.isUnlocked();
}

/**
 * Derive the key and decrypt. First-ever unlock sets the store up under this
 * passphrase. Rejects with a StorageError whose `code` is one of:
 *   'wrong-passphrase' | 'corrupt' | 'no-crypto' | 'empty-passphrase' | 'locked'
 * @param {string} passphrase   used for this call only; never retained here
 * @returns {Promise<{ records: object[], settings: object }>}
 */
export async function unlock(passphrase) {
  if (hasUnreadableData()) throw new StorageError("I can't read the saved data", 'corrupt');
  let data;
  try {
    data = await getStore().unlock(passphrase);
  } catch (err) {
    if (err instanceof StorageError) throw err;
    // Decrypt succeeded but the plaintext was not the JSON we wrote — a damaged payload.
    throw new StorageError("I can't read the saved data", 'corrupt');
  }
  const clean = coerceData(data);
  return { records: clean.records, settings: { ...clean.settings } };
}

/** Forget the key and every decrypted record. */
export function lock() {
  if (store) store.lock();
}

/* ──────────────────────────────── records ──────────────────────────────── */

async function readData() {
  return coerceData(await getStore().read());
}

async function writeData(data) {
  const ok = await getStore().write(data);
  if (!ok) throw new StorageError("Saving isn't working in this browser right now", 'write-failed');
}

/** @returns {Promise<object[]>} newest first */
export async function list() {
  return (await readData()).records;
}

export async function getSettings() {
  return { ...(await readData()).settings };
}

/**
 * The existing record whose start is within `DUPLICATE_WINDOW_DAYS` of `isoDate`,
 * if any. Pure; takes the records so the UI can check without a decrypt round-trip.
 * @param {object[]} records @param {string} isoDate @param {string} [ignoreId]
 */
export function findNear(records, isoDate, ignoreId) {
  let best = null;
  for (const r of records) {
    if (r.id === ignoreId) continue;
    const gap = Math.abs(daysBetween(r.startDate, isoDate));
    if (gap <= DUPLICATE_WINDOW_DAYS && (!best || gap < Math.abs(daysBetween(best.startDate, isoDate)))) best = r;
  }
  return best;
}

/**
 * @param {{ startDate: string, approximate?: boolean, endDate?: string|null, flow?: string|null, symptoms?: string[], mood?: string, note?: string }} input
 * @returns {Promise<object>} the stored record
 */
export async function add(input) {
  const data = await readData();
  const now = new Date().toISOString();
  const record = { id: newId(), ...normalise(input), createdAt: now, updatedAt: now };
  data.records = sortNewestFirst([record, ...data.records]);
  await writeData(data);
  return { ...record, symptoms: record.symptoms.slice() };
}

/**
 * @param {string} id @param {object} patch  any subset of the editable fields
 * @returns {Promise<object>} the updated record
 */
export async function update(id, patch) {
  const data = await readData();
  const idx = data.records.findIndex((r) => r.id === id);
  if (idx === -1) throw new StorageError("That entry isn't here any more", 'not-found');
  const existing = data.records[idx];
  const record = { ...existing, ...normalise(patch, existing), updatedAt: new Date().toISOString() };
  data.records[idx] = record;
  data.records = sortNewestFirst(data.records);
  await writeData(data);
  return { ...record, symptoms: record.symptoms.slice() };
}

/** @param {string} id @returns {Promise<boolean>} true if something was removed */
export async function remove(id) {
  const data = await readData();
  const before = data.records.length;
  data.records = data.records.filter((r) => r.id !== id);
  if (data.records.length === before) return false;
  await writeData(data);
  return true;
}

/** @param {{ autoLockMinutes?: number }} patch */
export async function updateSettings(patch) {
  const data = await readData();
  if (Number.isFinite(patch.autoLockMinutes) && patch.autoLockMinutes > 0) {
    data.settings.autoLockMinutes = patch.autoLockMinutes;
  }
  await writeData(data);
  return { ...data.settings };
}

/* ─────────────────────────────── reminder state ─────────────────────────────── */

/**
 * Saved status of the ephemeral reminders, keyed by the engine's sourceId.
 * Read once at unlock so rhythm.js can re-register with the status she left it in.
 * @returns {Promise<Record<string, object>>}
 */
export async function getReminderStates() {
  return { ...(await readData()).reminders };
}

/**
 * Persist a status change the engine reported through onChange. Cancelled or
 * pending states are simply forgotten — only "she acted on it" is worth keeping.
 * @param {string} sourceId
 * @param {{ status: string, snoozedUntil?: string|null, dismissedAt?: string|null, deliveredAt?: string|null }} snap
 */
export async function setReminderState(sourceId, snap) {
  if (typeof sourceId !== 'string' || !sourceId) return;
  const data = await readData();
  if (!snap || !REMINDER_STATUSES.includes(snap.status)) {
    delete data.reminders[sourceId];
  } else {
    data.reminders[sourceId] = {
      status: snap.status,
      snoozedUntil: isIsoInstant(snap.snoozedUntil) ? snap.snoozedUntil : null,
      dismissedAt: isIsoInstant(snap.dismissedAt) ? snap.dismissedAt : null,
      deliveredAt: isIsoInstant(snap.deliveredAt) ? snap.deliveredAt : null,
      updatedAt: new Date().toISOString(),
    };
  }
  await writeData(data);
}

/**
 * Pretty-printed PLAINTEXT JSON of everything — the backup she can read
 * without the passphrase. The UI must show the "this file is not encrypted"
 * sentence before offering it.
 */
export async function exportJson() {
  const data = await readData();
  return JSON.stringify(
    { name: STORE_NAME, version: STORE_VERSION, exportedAt: new Date().toISOString(), records: data.records, settings: data.settings },
    null,
    2,
  );
}

/**
 * Replace the current records from a plaintext file made by exportJson().
 * The imported data is immediately encrypted again under the currently
 * unlocked passphrase. Reminder state is kept on this device.
 */
export async function importJson(json) {
  let backup;
  try {
    backup = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new StorageError("That file doesn't look like a Rhythm backup", 'bad-json');
  }
  if (!backup || typeof backup !== 'object' || backup.name !== STORE_NAME || !Array.isArray(backup.records)) {
    throw new StorageError("That file doesn't look like a Rhythm backup", 'bad-shape');
  }

  const current = await readData();
  const imported = coerceData({
    version: STORE_VERSION,
    records: backup.records,
    settings: backup.settings,
    reminders: current.reminders,
  });
  if (backup.records.length > 0 && imported.records.length === 0) {
    throw new StorageError("I couldn't find any readable entries in that backup", 'bad-records');
  }
  await writeData(imported);
  return imported.records.length;
}

/** `rhythm-backup-YYYY-MM-DD.json` for today. */
export function exportFilename(today = new Date()) {
  return `rhythm-backup-${toISO(today)}.json`;
}
