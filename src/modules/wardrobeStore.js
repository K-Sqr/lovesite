/**
 * wardrobeStore.js — her closet, kept on this device (10-OUTFIT R5/R6/R7/R13/R14).
 *
 *   Metadata  → createStore('wardrobe', { version: 5 })     localStorage key usm.wardrobe.v5
 *   Photos    → createBlobStore('wardrobe-photos')           IndexedDB, keyed by photoId
 *
 * Photos never go in localStorage (5 MB quota, base64 inflation, and a thrown
 * QuotaExceededError would take the metadata write down with it). Photos are
 * compressed to 640px / q0.8 before storing — thumbnails in a grid, not a
 * lightbox — see compressImage() for why that differs from upload.js.
 *
 * This module imports neither firebase.js nor upload.js. Nothing here makes a
 * network request, and nothing about the closet is ever logged.
 *
 * Item shape (WardrobeItem):
 *   { id: 'itm_…', name, category, colour, style, warmth (1-5 | null),
 *     season: [], formality (1-5 | null), occasions: [], waterproof,
 *     photoId (| null), photoSrc (| null — static seed URL under ./outfits/),
 *     notes, lastWornAt (date-only ISO | null), archived,
 *     createdAt, updatedAt }
 * A name and a category is a complete, valid item.
 *
 * ── Reminder seam (for 11-NOTIFICATIONS.md) ─────────────────────────────────
 * Same pattern as peopleStore.js: a defensive dynamic import() in try/catch,
 * a stable deterministic id (`outfit-<ISO date>`) so re-running never
 * duplicates, and full functionality if the engine chunk fails to load.
 * Opt-in twice over: settings.morningReminder here, and the 'What to Wear'
 * type in the engine's preferences (default off).
 */

import { createStore, createBlobStore } from './storage.js';
import { toISO, addDays, parseISO } from './dates.js';
import { wardrobeSeed } from '../data/wardrobeSeed.js';

/** The only console output in this file. Never pass it an item. */
function warn(message, err) {
  if (err !== undefined) console.warn(`[wardrobe] ${message}`, err);
  else console.warn(`[wardrobe] ${message}`);
}

/* ─────────────────────────────── vocabulary ─────────────────────────────── */

export const CATEGORIES = [
  { id: 'tops',        label: 'Tops',        emoji: '\u{1F455}' }, // 👕
  { id: 'bottoms',     label: 'Bottoms',     emoji: '\u{1F456}' }, // 👖
  { id: 'dresses',     label: 'Dresses',     emoji: '\u{1F457}' }, // 👗
  { id: 'shoes',       label: 'Shoes',       emoji: '\u{1F45F}' }, // 👟
  { id: 'jackets',     label: 'Jackets',     emoji: '\u{1F9E5}' }, // 🧥
  { id: 'bags',        label: 'Bags',        emoji: '\u{1F45C}' }, // 👜
  { id: 'jewellery',   label: 'Jewellery',   emoji: '\u{1F48D}' }, // 💍
  { id: 'accessories', label: 'Accessories', emoji: '\u{1F9E3}' }, // 🧣
];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/** Warmth applies to these; the form asks for it here and nowhere else. */
export const WARMTH_CATEGORIES = ['tops', 'bottoms', 'dresses', 'shoes', 'jackets'];
/** Waterproof is only a question for these. */
export const WATERPROOF_CATEGORIES = ['shoes', 'jackets'];
/** Accessories can still carry a warmth (a scarf, a toque) — optional there. */
export const OPTIONAL_WARMTH_CATEGORIES = ['accessories'];

/** Words, not numbers. She picks "Warm", never "4". */
export const WARMTH_SCALE = [
  { value: 1, label: 'Hot days only', hint: 'tank, shorts, sandals, thin linen' },
  { value: 2, label: 'Light',         hint: 't-shirt, light blouse, thin dress' },
  { value: 3, label: 'Mid',           hint: 'long sleeve, jeans, sweatshirt' },
  { value: 4, label: 'Warm',          hint: 'sweater, fleece, lined trousers, boots' },
  { value: 5, label: 'Winter',        hint: 'parka, thermals, insulated boots' },
];

export const FORMALITY_SCALE = [
  { value: 1, label: 'Home / lounge' },
  { value: 2, label: 'Casual' },
  { value: 3, label: 'Smart casual' },
  { value: 4, label: 'Professional' },
  { value: 5, label: 'Event' },
];

export const SEASON_OPTIONS = [
  { id: 'spring', label: 'Spring' },
  { id: 'summer', label: 'Summer' },
  { id: 'autumn', label: 'Autumn' },
  { id: 'winter', label: 'Winter' },
];

export const OCCASION_OPTIONS = [
  { id: 'home',      label: 'Home',      emoji: '\u{1F3E0}' }, // 🏠
  { id: 'class',     label: 'Class',     emoji: '\u{1F4DA}' }, // 📚
  { id: 'work',      label: 'Work',      emoji: '\u{1F4BC}' }, // 💼
  { id: 'church',    label: 'Church',    emoji: '\u{26EA}' },  // ⛪
  { id: 'date',      label: 'Date out',  emoji: '\u{1F495}' }, // 💕
  { id: 'online-date', label: 'FaceTime date', emoji: '\u{1F4F1}' }, // 📱
  { id: 'brunch',    label: 'Brunch',    emoji: '\u{1F950}' }, // 🥐
  { id: 'hangout',   label: 'Hangout',   emoji: '\u{1F46F}' }, // 👯
  { id: 'study',     label: 'Study day', emoji: '\u{1F4DD}' }, // 📝
  { id: 'dinner',    label: 'Dinner',    emoji: '\u{1F37D}\u{FE0F}' }, // 🍽️
  { id: 'gym',       label: 'Gym',       emoji: '\u{1F3CB}\u{FE0F}' }, // 🏋️
  { id: 'errands',   label: 'Errands',   emoji: '\u{1F6D2}' }, // 🛒
  { id: 'event',     label: 'Event',     emoji: '\u{1F389}' }, // 🎉
  { id: 'travel',    label: 'Travel',    emoji: '\u{2708}\u{FE0F}' }, // ✈️
  { id: 'interview', label: 'Interview', emoji: '\u{1F91D}' }, // 🤝
];

export function warmthLabel(v) {
  const row = WARMTH_SCALE.find((r) => r.value === v);
  return row ? row.label : '';
}
export function formalityLabel(v) {
  const row = FORMALITY_SCALE.find((r) => r.value === v);
  return row ? row.label : '';
}
export function categoryLabel(id) {
  const row = CATEGORIES.find((c) => c.id === id);
  return row ? row.label : id;
}

/* ─────────────────────────────── stores ─────────────────────────────── */

const INITIAL_SETTINGS = { sparseNoteShown: false, morningReminder: false };

/** Stable starter records so a re-seed never duplicates or reshuffles ids. */
function seededItems() {
  const ts = '2026-09-14T00:00:00.000Z';
  return wardrobeSeed.map((row) => ({
    id: `itm_seed_${row.slug}`,
    name: row.name,
    category: row.category,
    colour: row.colour || '',
    style: row.style || '',
    warmth: row.warmth ?? null,
    season: Array.isArray(row.season) ? row.season : [],
    formality: row.formality ?? null,
    occasions: Array.isArray(row.occasions) ? row.occasions : [],
    waterproof: Boolean(row.waterproof),
    photoId: null,
    photoSrc: row.photoSrc || null,
    notes: row.notes || '',
    lastWornAt: null,
    archived: false,
    createdAt: ts,
    updatedAt: ts,
  }));
}

function mergeById(existing, seeded) {
  const byId = new Map(seeded.map((item) => [item.id, item]));
  // Refresh additive seed metadata while preserving edits to names and details.
  const refreshed = existing.map((item) => {
    if (!item || !item.id || !String(item.id).startsWith('itm_seed_')) return item;
    const fresh = byId.get(item.id);
    if (!fresh) return item;
    return {
      ...item,
      photoSrc: item.photoSrc || fresh.photoSrc || null,
      occasions: Array.from(new Set([...(item.occasions || []), ...(fresh.occasions || [])])),
    };
  });
  const have = new Set(refreshed.map((item) => item && item.id).filter(Boolean));
  const extra = seeded.filter((item) => !have.has(item.id));
  return extra.length === 0 ? refreshed : [...refreshed, ...extra];
}

const INITIAL = { items: seededItems(), settings: { ...INITIAL_SETTINGS } };

const store = createStore('wardrobe', {
  version: 5,
  initial: INITIAL,
  migrate(oldData) {
    const existing = Array.isArray(oldData?.items) ? oldData.items : [];
    return {
      items: mergeById(existing, seededItems()),
      settings: { ...INITIAL_SETTINGS, ...(oldData?.settings || {}) },
    };
  },
});
const photos = createBlobStore('wardrobe-photos');

export const STORE_NAME = store.name;

function readState() {
  const data = store.read();
  if (!data || typeof data !== 'object') return { items: [], settings: { ...INITIAL_SETTINGS } };
  return {
    items: Array.isArray(data.items) ? data.items : [],
    settings: { ...INITIAL_SETTINGS, ...(data.settings || {}) },
  };
}

function writeState(state) {
  return store.write(state);
}

export function subscribe(fn) {
  return store.subscribe(() => fn(readState()));
}

/* ─────────────────────────────── ids & shape ─────────────────────────────── */

function newId() {
  const bytes = new Uint8Array(6);
  if (globalThis.crypto && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return 'itm_' + Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
}

function clampScale(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

function cleanList(list, allowed) {
  if (!Array.isArray(list)) return [];
  return Array.from(new Set(list.map(String).filter((x) => allowed.includes(x))));
}

function cleanText(v, max = 80) {
  return String(v ?? '').trim().slice(0, max);
}

function cleanDate(v) {
  if (!v) return null;
  const d = parseISO(String(v));
  return Number.isNaN(d.getTime()) ? null : toISO(d);
}

/**
 * Normalise arbitrary input into a valid item. Throws only when there is no
 * name or the category is unknown — everything else is optional.
 */
export function normaliseItem(input, existing = null) {
  const name = cleanText(input.name, 80);
  const category = String(input.category || existing?.category || '').trim();
  if (!name) throw new Error('Give it a name — even "the grey one" works.');
  if (!CATEGORY_IDS.includes(category)) throw new Error('Pick a category.');
  const now = new Date().toISOString();
  const warmthAllowed = WARMTH_CATEGORIES.includes(category) || OPTIONAL_WARMTH_CATEGORIES.includes(category);
  return {
    id: existing?.id || newId(),
    name,
    category,
    colour: cleanText(input.colour, 40),
    style: cleanText(input.style, 40),
    warmth: warmthAllowed ? clampScale(input.warmth) : null,
    season: cleanList(input.season, SEASON_OPTIONS.map((s) => s.id)),
    formality: clampScale(input.formality),
    occasions: cleanList(input.occasions, OCCASION_OPTIONS.map((o) => o.id)),
    waterproof: WATERPROOF_CATEGORIES.includes(category) ? Boolean(input.waterproof) : false,
    photoId: input.photoId === undefined ? (existing?.photoId ?? null) : (input.photoId || null),
    photoSrc: input.photoSrc === undefined
      ? (existing?.photoSrc ?? null)
      : (cleanText(input.photoSrc, 200) || null),
    notes: cleanText(input.notes, 300),
    lastWornAt: input.lastWornAt === undefined ? (existing?.lastWornAt ?? null) : cleanDate(input.lastWornAt),
    archived: input.archived === undefined ? Boolean(existing?.archived) : Boolean(input.archived),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

/* ─────────────────────────────── CRUD ─────────────────────────────── */

/** @param {{ includeArchived?: boolean }} [opts] */
export function listItems({ includeArchived = false } = {}) {
  const { items } = readState();
  return includeArchived ? items : items.filter((it) => !it.archived);
}

export function getItem(id) {
  return readState().items.find((it) => it.id === id) || null;
}

export function addItem(input) {
  const item = normaliseItem(input);
  const state = readState();
  state.items.push(item);
  writeState(state);
  return item;
}

/** Batch add — the gift-wrapping flow. Invalid rows are skipped and reported. */
export function addItems(inputs) {
  const state = readState();
  const added = [];
  const skipped = [];
  for (const input of inputs || []) {
    try {
      const item = normaliseItem(input);
      state.items.push(item);
      added.push(item);
    } catch (err) {
      skipped.push({ input, reason: err.message });
    }
  }
  if (added.length) writeState(state);
  return { added, skipped };
}

export function updateItem(id, patch) {
  const state = readState();
  const idx = state.items.findIndex((it) => it.id === id);
  if (idx === -1) return null;
  const merged = normaliseItem({ ...state.items[idx], ...patch }, state.items[idx]);
  state.items[idx] = merged;
  writeState(state);
  return merged;
}

export function archiveItem(id, archived = true) {
  return updateItem(id, { archived });
}

export async function deleteItem(id) {
  const state = readState();
  const item = state.items.find((it) => it.id === id);
  if (!item) return false;
  state.items = state.items.filter((it) => it.id !== id);
  writeState(state);
  if (item.photoId) await photos.delete(item.photoId);
  return true;
}

/** "That's what I wore" — sets lastWornAt on each id. Never enforces a no-repeat rule. */
export function markWorn(ids, date = new Date()) {
  const iso = toISO(date);
  const state = readState();
  const set = new Set(ids || []);
  let touched = 0;
  state.items = state.items.map((it) => {
    if (!set.has(it.id)) return it;
    touched += 1;
    return { ...it, lastWornAt: iso, updatedAt: new Date().toISOString() };
  });
  if (touched) writeState(state);
  return touched;
}

/* ─────────────────────────────── settings ─────────────────────────────── */

export function getSettings() {
  return readState().settings;
}

export function updateSettings(patch) {
  const state = readState();
  state.settings = { ...state.settings, ...patch };
  writeState(state);
  return state.settings;
}

/* ─────────────────────────────── photos ─────────────────────────────── */

const PHOTO_MAX_WIDTH = 640;
const PHOTO_QUALITY = 0.8;

/**
 * Same canvas approach as upload.js → compressImage(), duplicated on purpose:
 * importing upload.js would pull in firebase.js, whose getAnalytics(app) call
 * at module scope would send a pageview from this page and add the whole SDK
 * to the bundle. Deliberately smaller than upload.js (1200 / 0.82): these are
 * grid thumbnails, never full-screen, and 1200px stores four times the bytes
 * for pixels nobody sees.
 * @param {Blob} file
 * @returns {Promise<Blob>}
 */
export function compressImage(file, maxWidth = PHOTO_MAX_WIDTH, quality = PHOTO_QUALITY) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not compress that photo'))),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that photo"));
    };
    img.src = url;
  });
}

/**
 * Compress and store a photo for an item. Resolves with the photoId, or null
 * if the blob could not be persisted (it still lives in memory for the session).
 * @param {string} id  item id
 * @param {Blob} file
 */
export async function setPhoto(id, file) {
  const item = getItem(id);
  if (!item) throw new Error('No such item');
  const blob = await compressImage(file);
  const photoId = id; // photoId is the item id — one photo per item
  const persisted = await photos.put(photoId, blob);
  if (!persisted) {
    warn('photo could not be stored beyond this session');
    return null;
  }
  updateItem(id, { photoId });
  return photoId;
}

/** @returns {Promise<Blob|null>} */
export async function getPhoto(photoId) {
  if (!photoId) return null;
  return photos.get(photoId);
}

export async function removePhoto(id) {
  const item = getItem(id);
  if (!item || !item.photoId) return false;
  await photos.delete(item.photoId);
  updateItem(id, { photoId: null });
  return true;
}

export function photoEstimate() {
  return photos.estimate();
}

/* ─────────────────────────────── export / import ─────────────────────────────── */

/**
 * Metadata-only JSON, via the store's own export(). Photos are NOT included —
 * the UI must say so in plain words.
 */
export function exportJSON() {
  return store.export();
}

export function exportFilename(date = new Date()) {
  return `wardrobe-backup-${toISO(date)}.json`;
}

/** Accepts a file produced by exportJSON(). Existing photos stay attached where ids still match. */
export function importJSON(json) {
  const data = store.import(json);
  const items = Array.isArray(data?.items) ? data.items : [];
  // Re-normalise so a hand-edited file cannot introduce a broken item.
  const clean = [];
  for (const raw of items) {
    try { clean.push(normaliseItem(raw, raw)); } catch { /* skip */ }
  }
  writeState({ items: clean, settings: { ...INITIAL_SETTINGS, ...(data?.settings || {}) } });
  return clean.length;
}

/* ─────────────────────────────── reminder seam ─────────────────────────────── */

let reminders = null;
// A literal path so Vite bundles the engine (11-NOTIFICATIONS) with this page.
// Still wrapped: if the chunk ever fails to load, every call below is a no-op.
const remindersReady = (async () => {
  try {
    reminders = await import('./reminders.js');
  } catch {
    reminders = null;
  }
})();

function emitReminder(rec) {
  if (!reminders) return;
  try {
    if (typeof reminders.upsertReminder === 'function') {
      reminders.upsertReminder(rec);
    } else if (typeof reminders.registerReminder === 'function') {
      reminders.registerReminder({ type: rec.kind, sourceId: rec.id, title: rec.title, body: rec.body, scheduledAt: rec.dueAt, href: rec.href });
    }
  } catch (err) {
    warn('reminder emit failed', err);
  }
}

function dropReminder(id) {
  if (!reminders) return;
  try {
    reminders.cancelReminder?.(id);
  } catch (err) {
    warn('reminder drop failed', err);
  }
}

/** 7:30 local on `date`, as an ISO instant. */
function morningOf(date) {
  const d = parseISO(toISO(date));
  d.setHours(7, 30, 0, 0);
  return d.toISOString();
}

/**
 * Keep (or drop) the optional "here's today's outfit" morning reminder for
 * tomorrow. Deterministic id `outfit-<ISO date>`, so calling this on every
 * page open replaces rather than duplicates.
 * @param {Date} [now]
 */
export async function syncMorningReminder(now = new Date()) {
  await remindersReady;
  if (!reminders) return;
  const tomorrow = addDays(now, 1);
  const id = `outfit-${toISO(tomorrow)}`;
  if (!getSettings().morningReminder) {
    dropReminder(id);
    return;
  }
  emitReminder({
    id,
    source: 'outfit',
    kind: 'outfit',
    dueAt: morningOf(tomorrow),
    title: "Today's outfit is ready",
    body: 'Open it, get dressed, go.',
    href: '/lovesite/outfit.html',
  });
}
