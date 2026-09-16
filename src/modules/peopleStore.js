/**
 * peopleStore.js — the domain layer for people.html.
 *
 * Owns every read and write for the People page: ids, the person record,
 * state derivation, ordering, the energy filter, the message templates and
 * their overrides, backup/restore, and the reminder seam. `people.js` only
 * renders and wires events; it never touches storage itself.
 *
 * Stores (storage.js, both plain localStorage, both `{ v, updatedAt, data }`):
 *   usm.people.v3            → { items: Person[] } (including per-person check-in dates)
 *   usm.messageTemplates.v1  → { customTemplates: CustomTemplate[] }
 *
 * The energy selection is NOT in either store. It lives in sessionStorage
 * under `usm.people.energy` as one string — no history, no timestamps, ever.
 *
 * This module never imports firebase.js, never fetches, never logs a person.
 * Cross-device sync happens one layer up: people.js hands syncTargets() to
 * cloudSync.js, which mirrors the stores' envelopes. The `warn()` helper
 * below is the only console output and it must never be handed a record.
 *
 * ── Reminder seam (08 R7 → 11-NOTIFICATIONS) ─────────────────────────────
 * `src/modules/reminders.js` is owned by 11-NOTIFICATIONS.md. It is loaded
 * with a dynamic import inside try/catch; if that chunk ever fails to load,
 * every emit/drop below is a no-op and the page works exactly the same.
 *
 * Emitted record (ids are deterministic, so re-emitting REPLACES, never duplicates):
 *   {
 *     id: `people:${person.id}:birthday`          // or `:checkin`, or `:date:${index}`
 *     source: 'people',
 *     kind: 'birthday' | 'checkin' | 'importantDate',
 *     dueAt: '2026-04-16T13:00:00.000Z',            // ISO instant, 1pm local the day before
 *     title: 'Tinu’s birthday is tomorrow',
 *     body: 'A quick hello counts.',                 // same tone rules as the page
 *     href: '/lovesite/people.html#per_k3n8v',
 *   }
 * Calls: `reminders.upsertReminder(rec)` and `reminders.cancelReminder(id)`.
 * The engine maps kind birthday → 'birthday', checkin → 'checkin',
 * importantDate → 'birthday' ("Birthdays & dates"). Emitted on save and on page
 * load; dropped on snooze, on "Said hi" (then re-emitted with the new date),
 * and on removal. No reminder body ever contains a day count or "overdue".
 */

import { createStore } from './storage.js';
import { parseISO, toISO, addDays, daysBetween, startOfDay } from './dates.js';
import { defaultMessageTemplates } from '../data/messageTemplates.js';
import { peopleSeed, PEOPLE_CATEGORIES } from '../data/peopleSeed.js';

export { PEOPLE_CATEGORIES };

/** The only console output in this module. Never pass it a person or a template. */
function warn(message, err) {
  if (err !== undefined) console.warn(`[people] ${message}`, err);
  else console.warn(`[people] ${message}`);
}

/* ─────────────────────────────── constants ─────────────────────────────── */

export const CADENCES = [
  { id: 'none',       label: 'No schedule' },
  { id: 'weekly',     label: 'Every week' },
  { id: 'few-weeks',  label: 'Every few weeks' },
  { id: 'monthly',    label: 'Every month' },
  { id: 'seasonally', label: 'Every season or so' },
];

/** Rough day counts behind each cadence. "none" deliberately has no entry. */
const CADENCE_DAYS = { weekly: 7, 'few-weeks': 21, monthly: 30, seasonally: 90 };

/** With no schedule, "recently caught up" simply means inside the last four weeks. */
const NO_SCHEDULE_RECENT_DAYS = 28;

/** A birthday is "coming up" from this many days out until the day itself. */
const BIRTHDAY_WINDOW_DAYS = 14;

export const ENERGY_COSTS = [
  { id: null,     label: 'Prefer not to say' },
  { id: 'low',    label: 'Easy' },
  { id: 'medium', label: 'Some' },
  { id: 'high',   label: 'A lot' },
];

export const MAX_IMPORTANT_DATES = 4;

/**
 * The five states. Nothing else exists — see deriveState() for why.
 * `tone` maps to `.usm-tone--<tone>` and the `--tone-<tone>` tokens in base.css.
 */
export const STATES = {
  birthday: { id: 'birthday', label: 'Birthday coming up',        tone: 'warm',    rank: 0 },
  while:    { id: 'while',    label: 'It’s been a little while',  tone: 'waiting', rank: 1 },
  soon:     { id: 'soon',     label: 'Might be nice soon',        tone: 'soon',    rank: 2 },
  recent:   { id: 'recent',   label: 'Recently caught up',        tone: 'calm',    rank: 3 },
  snoozed:  { id: 'snoozed',  label: 'Parked for now',            tone: 'quiet',   rank: 4 },
};

/**
 * The energy selector. `people` is the cap on how many rows are shown,
 * `costs` which energyCost values are allowed (null = "prefer not to say"
 * is always allowed, so an unlabelled person is never hidden).
 */
export const ENERGY_LEVELS = [
  { id: 'low',    label: 'Low',          line: 'One small hello is enough.',  people: 2,  costs: ['low'],                   templateCategory: 'low-energy' },
  { id: 'little', label: 'A little',     line: 'A few familiar faces.',       people: 4,  costs: ['low', 'medium'],         templateCategory: 'thinking' },
  { id: 'normal', label: 'Normal',       line: 'Six gentle possibilities.',   people: 6,  costs: ['low', 'medium', 'high'], templateCategory: 'thinking' },
  { id: 'social', label: 'Social today', line: 'A wider circle for today.',   people: 10, costs: ['low', 'medium', 'high'], templateCategory: 'thinking' },
];

const ENERGY_SESSION_KEY = 'usm.people.energy';
const DEFAULT_ENERGY = 'normal';

/* ─────────────────────────────── stores ─────────────────────────────── */

/** Stable starter records so a re-seed never duplicates or reshuffles ids. */
function seededItems() {
  const ts = '2026-09-13T12:00:00.000Z';
  return peopleSeed.map((p) => ({
    id: `per_seed_${p.slug}`,
    name: p.name,
    relationship: p.relationship,
    lastContactAt: null,
    preferredCadence: p.preferredCadence,
    birthday: null,
    importantDates: [],
    notes: '',
    isSnoozedUntil: null,
    energyCost: p.energyCost,
    checkIns: [],
    createdAt: ts,
    updatedAt: ts,
  }));
}

function mergeSeed(existing) {
  const have = new Set(
    existing.map((p) => String(p?.name || '').trim().toLowerCase()).filter(Boolean),
  );
  const extra = seededItems().filter((p) => !have.has(p.name.toLowerCase()));
  return [...existing, ...extra];
}

const peopleStore = createStore('people', {
  version: 3,
  initial: { items: seededItems() },
  migrate(oldData) {
    const existing = Array.isArray(oldData?.items) ? oldData.items : [];
    return {
      items: mergeSeed(existing).map((person) => ({
        ...person,
        checkIns: cleanCheckIns(person.checkIns),
      })),
    };
  },
});
const templatesStore = createStore('messageTemplates', { version: 1, initial: { customTemplates: [] } });

export const storeKeys = { people: peopleStore.key, messageTemplates: templatesStore.key };

/** The underlying stores, for cloudSync.js only — it mirrors their envelopes between devices. */
export function syncTargets() {
  return [peopleStore, templatesStore];
}

/* ─────────────────────────────── helpers ─────────────────────────────── */

function randomId(prefix) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    for (const b of bytes) out += alphabet[b % alphabet.length];
  } catch {
    for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}_${out}`;
}

function nowISO() {
  return new Date().toISOString();
}

function isDateOnly(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISO(s).getTime());
}

function cleanText(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function cleanMonthDay(month, day) {
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { month: m, day: d };
}

/** Birthday is month + day; the year is optional and never used for anything. */
function cleanBirthday(b) {
  if (!b || typeof b !== 'object') return null;
  const md = cleanMonthDay(b.month, b.day);
  if (!md) return null;
  const year = Number.isInteger(Number(b.year)) && b.year !== null && b.year !== '' ? Number(b.year) : null;
  return { month: md.month, day: md.day, year };
}

function cleanImportantDates(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const md = cleanMonthDay(item.month, item.day);
    const label = cleanText(item.label, 80);
    if (!md || !label) continue;
    out.push({ label, month: md.month, day: md.day });
    if (out.length >= MAX_IMPORTANT_DATES) break;
  }
  return out;
}

function cleanCheckIns(list) {
  if (!Array.isArray(list)) return [];
  return Array.from(new Set(list.filter(isDateOnly))).sort().slice(-2000);
}

/**
 * Coerce any input into a valid Person. A name is the only requirement —
 * everything else falls back to "nothing set", and "nothing set" is a
 * complete, legitimate record.
 * @returns {object|null} null when there is no name
 */
export function normalisePerson(input, existing = null) {
  const name = cleanText(input?.name, 80);
  if (!name) return null;
  const ts = nowISO();
  const cadence = CADENCES.some((c) => c.id === input?.preferredCadence) ? input.preferredCadence : 'none';
  const energy = ['low', 'medium', 'high'].includes(input?.energyCost) ? input.energyCost : null;
  return {
    id: existing?.id || randomId('per'),
    name,
    relationship: cleanText(input?.relationship, 80),
    lastContactAt: isDateOnly(input?.lastContactAt) ? input.lastContactAt : null,
    preferredCadence: cadence,
    birthday: cleanBirthday(input?.birthday),
    importantDates: cleanImportantDates(input?.importantDates),
    notes: cleanText(input?.notes, 2000),
    isSnoozedUntil: isDateOnly(input?.isSnoozedUntil) ? input.isSnoozedUntil : null,
    energyCost: energy,
    checkIns: cleanCheckIns(input?.checkIns !== undefined ? input.checkIns : existing?.checkIns),
    createdAt: existing?.createdAt || ts,
    updatedAt: ts,
  };
}

/* ─────────────────────────────── state ─────────────────────────────── */

/**
 * Next occurrence of a month/day on or after `now` (local calendar).
 * Feb 29 in a common year rolls to Mar 1, which is what people do anyway.
 * @returns {Date|null}
 */
export function nextOccurrence(monthDay, now = new Date()) {
  if (!monthDay) return null;
  const today = startOfDay(now);
  let d = new Date(today.getFullYear(), monthDay.month - 1, monthDay.day);
  if (d < today) d = new Date(today.getFullYear() + 1, monthDay.month - 1, monthDay.day);
  return d;
}

/** True while the person is parked: the snooze date is strictly after today. */
export function isSnoozed(person, now = new Date()) {
  if (!person.isSnoozedUntil || !isDateOnly(person.isSnoozedUntil)) return false;
  return daysBetween(now, person.isSnoozedUntil) > 0;
}

/**
 * Derive the one state a person is in right now. Pure; `now` is injectable.
 *
 * WHY THERE ARE ONLY FIVE STATES, AND WHY NOTHING SITS PAST "A LITTLE WHILE":
 * The loop this page exists to break goes: she thinks of someone → doesn't
 * get to it → time passes → it now feels like it's *been too long* → reaching
 * out needs an explanation → that needs energy she doesn't have → she puts it
 * off. Every "keep in touch" app makes step 4 worse by counting: 47 days,
 * overdue, red. The count is what turns a warm thought into a debt.
 *
 * So this function refuses to escalate. Someone she spoke to five weeks ago
 * and someone she spoke to three years ago are in the SAME state, with the
 * same words and the same colour. There is no "overdue", no "long overdue",
 * no "going cold", and no fourth tier of any kind. If you are reading this
 * because you want to add one: the answer is no, and this comment is why.
 *
 * Precedence:
 *   1. snoozed   — she parked them; nothing else is evaluated
 *   2. birthday  — within BIRTHDAY_WINDOW_DAYS, outranks the rest
 *   3. cadence   — recent / soon / while, or for "no schedule": recent / while
 *   A person with no lastContactAt lands in "while" — the gentlest place to
 *   start, and the reason she probably added them.
 *
 * @returns {{ id: string, label: string, tone: string, rank: number }}
 */
export function deriveState(person, now = new Date()) {
  if (isSnoozed(person, now)) return STATES.snoozed;

  if (person.birthday) {
    const next = nextOccurrence(person.birthday, now);
    const ahead = daysBetween(now, next);
    if (ahead >= 0 && ahead <= BIRTHDAY_WINDOW_DAYS) return STATES.birthday;
  }

  if (!person.lastContactAt || !isDateOnly(person.lastContactAt)) return STATES.while;
  const ago = daysBetween(person.lastContactAt, now);

  const days = CADENCE_DAYS[person.preferredCadence];
  if (!days) {
    // No schedule: there is nothing to be "approaching", so no "soon".
    return ago < NO_SCHEDULE_RECENT_DAYS ? STATES.recent : STATES.while;
  }

  if (ago >= days) return STATES.while;              // past it, by any amount at all
  const soonWindow = Math.max(2, Math.round(days * 0.25));
  if (ago >= days - soonWindow) return STATES.soon;  // getting close
  return STATES.recent;
}

/**
 * Gentle relevance order. Snoozed people are not in this list at all — they
 * live behind "Parked for now". Within a state, the person she spoke to
 * longest ago comes first; never-logged people come last so a brand new
 * record does not jump the queue.
 */
export function orderPeople(items, now = new Date()) {
  return items
    .map((person) => ({ person, state: deriveState(person, now) }))
    .sort((a, b) => {
      if (a.state.rank !== b.state.rank) return a.state.rank - b.state.rank;
      const al = a.person.lastContactAt;
      const bl = b.person.lastContactAt;
      if (al === bl) return a.person.name.localeCompare(b.person.name);
      if (al === null) return 1;
      if (bl === null) return -1;
      return al < bl ? -1 : 1;
    });
}

function seededRng(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(entries, seed) {
  const out = entries.slice();
  const random = seededRng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function isParent(person) {
  const name = String(person.name || '').trim().toLowerCase();
  const relationship = String(person.relationship || '').trim().toLowerCase();
  return ['mother', 'mom', 'mum', 'father', 'dad', 'parent', 'parents'].includes(name)
    || /(^|\s)(mother|mom|mum|father|dad|parent)(\s|$)/.test(relationship);
}

function isSister(person) {
  const name = String(person.name || '').trim().toLowerCase();
  const relationship = String(person.relationship || '').trim().toLowerCase();
  return name === 'sister' || name === 'sisters' || relationship.includes('sister');
}

function isBestFriend(person) {
  return String(person.relationship || '').trim().toLowerCase() === 'best friend';
}

function longestUnchecked(entries) {
  return entries.slice().sort((a, b) => {
    const aLast = a.person.lastContactAt;
    const bLast = b.person.lastContactAt;
    if (aLast === bLast) return a.person.name.localeCompare(b.person.name);
    if (!aLast) return 1;
    if (!bLast) return -1;
    return aLast < bLast ? -1 : 1;
  });
}

/**
 * Pick the small set shown first for an energy level. Random selections are
 * stable for one local calendar day so a re-render never feels like a moving target.
 */
export function pickSuggestions(entries, energyId, now = new Date(), shuffle = 0) {
  const level = getEnergyLevel(energyId);
  const dateSeed = `${toISO(now)}|people|${level.id}|${shuffle}`;
  const active = entries.filter((entry) => entry.state.id !== 'snoozed');

  if (level.id === 'low') {
    const eligible = longestUnchecked(active.filter((entry) => !isParent(entry.person)));
    if (shuffle > 0 && eligible.length > level.people) {
      const offset = (shuffle * level.people) % eligible.length;
      return [...eligible.slice(offset), ...eligible.slice(0, offset)].slice(0, level.people);
    }
    return eligible.slice(0, level.people);
  }

  if (level.id === 'little') {
    const picked = [];
    const add = (entry) => {
      if (entry && !picked.some((item) => item.person.id === entry.person.id)) picked.push(entry);
    };
    add(active.find((entry) => isSister(entry.person)));
    add(shuffled(active.filter((entry) => isBestFriend(entry.person)), `${dateSeed}|best-friend`)[0]);
    shuffled(active.filter((entry) => !picked.some((item) => item.person.id === entry.person.id)), dateSeed)
      .some((entry) => {
        add(entry);
        return picked.length >= level.people;
      });
    return picked.slice(0, level.people);
  }

  return shuffled(active, dateSeed).slice(0, level.people);
}

/**
 * The full picture the page renders from, already split into the visible
 * list (filtered by energy) and the parked list.
 *
 * ENERGY IS A VIEW FILTER ONLY. It never changes a stored record, and it is
 * never recorded anywhere — no history, no counts, no "you've been low all
 * week". It is a filter for right now and that is all it will ever be.
 *
 * @param {string} energyId
 * @param {Date} [now]
 * @param {number} [shuffle] changes the stable daily selection on explicit request
 */
export function getView(energyId, now = new Date(), shuffle = 0) {
  const level = getEnergyLevel(energyId);
  const all = orderPeople(listPeople(), now);
  const parked = all.filter((e) => e.state.id === 'snoozed');
  const available = all.filter((e) => e.state.id !== 'snoozed');
  const active = pickSuggestions(available, level.id, now, shuffle);
  const selectedIds = new Set(active.map((entry) => entry.person.id));
  const rest = available.filter((entry) => !selectedIds.has(entry.person.id));
  return { level, active, suggested: active, rest, parked, hiddenByEnergy: rest.length };
}

export function getEnergyLevel(id) {
  return ENERGY_LEVELS.find((l) => l.id === id) || ENERGY_LEVELS.find((l) => l.id === DEFAULT_ENERGY);
}

/** Session-only. One string. Nothing about past selections is kept. */
export function getEnergy() {
  try {
    const v = window.sessionStorage.getItem(ENERGY_SESSION_KEY);
    return ENERGY_LEVELS.some((l) => l.id === v) ? v : DEFAULT_ENERGY;
  } catch {
    return DEFAULT_ENERGY;
  }
}

export function setEnergy(id) {
  const level = getEnergyLevel(id);
  try {
    window.sessionStorage.setItem(ENERGY_SESSION_KEY, level.id);
  } catch {
    /* session storage unavailable — the module-level value in people.js still works */
  }
  return level.id;
}

/* ─────────────────────────────── people CRUD ─────────────────────────────── */

function readItems() {
  const data = peopleStore.read();
  return Array.isArray(data?.items) ? data.items : [];
}

function writeItems(items) {
  return peopleStore.write({ items });
}

export function listPeople() {
  return readItems();
}

export function getPerson(id) {
  return readItems().find((p) => p.id === id) || null;
}

/** @returns {object|null} the saved person, or null if there was no name */
export function addPerson(input) {
  const person = normalisePerson(input);
  if (!person) return null;
  writeItems([...readItems(), person]);
  emitRemindersFor(person);
  return person;
}

/** @returns {object|null} the saved person, or null if not found / no name */
export function updatePerson(id, patch) {
  const items = readItems();
  const idx = items.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const merged = normalisePerson({ ...items[idx], ...patch }, items[idx]);
  if (!merged) return null;
  items[idx] = merged;
  writeItems(items);
  if (isSnoozed(merged)) dropRemindersFor(merged); else emitRemindersFor(merged);
  return merged;
}

export function removePerson(id) {
  const items = readItems();
  const person = items.find((p) => p.id === id);
  if (!person) return false;
  writeItems(items.filter((p) => p.id !== id));
  dropRemindersFor(person);
  return true;
}

/**
 * "Said hi" — one tap. Today becomes the last contact, any snooze is cleared,
 * and that is the whole record of it. Nothing about what was said is kept.
 */
export function markSaidHi(id, now = new Date()) {
  const person = getPerson(id);
  if (!person) return null;
  const today = toISO(now);
  const checkIns = cleanCheckIns([...(person.checkIns || []), today]);
  return updatePerson(id, { lastContactAt: today, isSnoozedUntil: null, checkIns });
}

/** Dashboard-ready check-in totals. Only explicit "Said hi" taps appear here. */
export function getCheckInSummary(now = new Date()) {
  const today = startOfDay(now);
  const weekStart = addDays(today, -((today.getDay() + 6) % 7));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const weekISO = toISO(weekStart);
  const monthISO = toISO(monthStart);
  const people = listPeople();
  const events = [];

  for (const person of people) {
    for (const date of cleanCheckIns(person.checkIns)) {
      events.push({ personId: person.id, name: person.name, date });
    }
  }
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.name.localeCompare(b.name)));

  const thisWeek = events.filter((event) => event.date >= weekISO);
  const thisMonth = events.filter((event) => event.date >= monthISO);
  const perPerson = people
    .map((person) => {
      const checkIns = cleanCheckIns(person.checkIns);
      return {
        personId: person.id,
        name: person.name,
        relationship: person.relationship,
        count: checkIns.length,
        lastCheckIn: checkIns.length ? checkIns[checkIns.length - 1] : null,
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || String(b.lastCheckIn).localeCompare(String(a.lastCheckIn)) || a.name.localeCompare(b.name));

  return {
    total: events.length,
    thisWeek: thisWeek.length,
    thisMonth: thisMonth.length,
    uniqueThisMonth: new Set(thisMonth.map((event) => event.personId)).size,
    activeDaysThisMonth: new Set(thisMonth.map((event) => event.date)).size,
    startedAt: events.length ? events[events.length - 1].date : null,
    perPerson,
    recent: events.slice(0, 12),
  };
}

/**
 * Snooze — park the person until a date. Not a penalty, not a deferral:
 * lastContactAt is untouched, nothing counts how often it happens, and when
 * the date passes they simply reappear in whatever state they were in.
 */
export function snoozePerson(id, untilISO) {
  if (!isDateOnly(untilISO)) return null;
  return updatePerson(id, { isSnoozedUntil: untilISO });
}

export function unsnoozePerson(id) {
  return updatePerson(id, { isSnoozedUntil: null });
}

/**
 * The snooze presets. Dates only; the person comes back on that day.
 * "This weekend" is the next Saturday, "Next week" the next Monday, both
 * strictly after today.
 */
export function snoozePresets(now = new Date()) {
  const today = startOfDay(now);
  const dow = today.getDay(); // 0 = Sunday
  const toSaturday = ((6 - dow) + 7) % 7 || 7;
  const toMonday = ((8 - dow) % 7) || 7;
  return [
    { id: 'tomorrow', label: 'Tomorrow',     until: toISO(addDays(today, 1)) },
    { id: 'weekend',  label: 'This weekend', until: toISO(addDays(today, toSaturday)) },
    { id: 'week',     label: 'Next week',    until: toISO(addDays(today, toMonday)) },
  ];
}

/* ─────────────────────────────── debounced edits ─────────────────────────────── */

let pendingPatch = null; // { id, patch }
let pendingTimer = null;

/**
 * Debounced updatePerson for the edit form: ~300ms after the last keystroke,
 * or immediately via flushPendingEdit() (called on blur / visibilitychange /
 * beforeunload by the page). Only one person is ever pending at a time.
 */
export function scheduleUpdate(id, patch) {
  if (pendingPatch && pendingPatch.id !== id) flushPendingEdit();
  pendingPatch = { id, patch: { ...(pendingPatch?.patch || {}), ...patch } };
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(flushPendingEdit, 300);
}

export function flushPendingEdit() {
  clearTimeout(pendingTimer);
  pendingTimer = null;
  if (!pendingPatch) return null;
  const { id, patch } = pendingPatch;
  pendingPatch = null;
  return updatePerson(id, patch);
}

/* ─────────────────────────────── subscriptions ─────────────────────────────── */

/** Fires on any change to either store, including from another tab. */
export function subscribe(fn) {
  const a = peopleStore.subscribe(() => fn());
  const b = templatesStore.subscribe(() => fn());
  return () => { a(); b(); };
}

/* ─────────────────────────────── message templates ─────────────────────────────── */

/**
 * CustomTemplate (usm.messageTemplates.v1 → data.customTemplates[]):
 *   { id: 'tpl_x1y2z3', categoryId: 'thinking', text: '…',
 *     overrides: 'thinking-2' | null,   // set when this edits a default line
 *     createdAt, updatedAt }
 * Defaults stay in src/data/messageTemplates.js; her changes are overrides
 * (same category, `overrides` = the default's id) or additions.
 */

function readCustom() {
  const data = templatesStore.read();
  return Array.isArray(data?.customTemplates) ? data.customTemplates : [];
}

function writeCustom(customTemplates) {
  return templatesStore.write({ customTemplates });
}

/**
 * Categories with defaults and overrides merged, ready to render.
 * Each item: { id, text, isDefault, isOverridden, customId }.
 */
export function listTemplateCategories() {
  const custom = readCustom();
  return defaultMessageTemplates.map((cat) => {
    const items = cat.items.map((text, i) => {
      const id = `${cat.id}-${i}`;
      const override = custom.find((c) => c.overrides === id);
      return {
        id,
        text: override ? override.text : text,
        isDefault: true,
        isOverridden: !!override,
        customId: override ? override.id : null,
      };
    });
    for (const c of custom) {
      if (c.categoryId === cat.id && !c.overrides) {
        items.push({ id: c.id, text: c.text, isDefault: false, isOverridden: false, customId: c.id });
      }
    }
    return { id: cat.id, category: cat.category, items };
  });
}

export function getTemplateCategory(categoryId) {
  return listTemplateCategories().find((c) => c.id === categoryId) || null;
}

export function addTemplate(categoryId, text) {
  const clean = cleanText(text, 500);
  if (!clean || !defaultMessageTemplates.some((c) => c.id === categoryId)) return null;
  const ts = nowISO();
  const tpl = { id: randomId('tpl'), categoryId, text: clean, overrides: null, createdAt: ts, updatedAt: ts };
  writeCustom([...readCustom(), tpl]);
  return tpl;
}

/**
 * Edit a line. For a default (`itemId` like 'thinking-2') this creates or
 * updates an override; for a custom line it edits in place.
 */
export function editTemplate(categoryId, itemId, text) {
  const clean = cleanText(text, 500);
  if (!clean) return null;
  const custom = readCustom();
  const ts = nowISO();
  const isDefaultId = defaultMessageTemplates.some((c) => c.id === categoryId && itemId.startsWith(`${c.id}-`));
  if (isDefaultId) {
    const idx = custom.findIndex((c) => c.overrides === itemId);
    if (idx === -1) {
      custom.push({ id: randomId('tpl'), categoryId, text: clean, overrides: itemId, createdAt: ts, updatedAt: ts });
    } else {
      custom[idx] = { ...custom[idx], text: clean, updatedAt: ts };
    }
  } else {
    const idx = custom.findIndex((c) => c.id === itemId);
    if (idx === -1) return null;
    custom[idx] = { ...custom[idx], text: clean, updatedAt: ts };
  }
  writeCustom(custom);
  return true;
}

/** Remove an override (a default goes back to its shipped words) or delete a custom line. */
export function resetOrDeleteTemplate(itemId) {
  const custom = readCustom();
  const next = custom.filter((c) => c.id !== itemId && c.overrides !== itemId);
  if (next.length === custom.length) return false;
  writeCustom(next);
  return true;
}

/**
 * Put a name into a template, or take the placeholder out cleanly when there
 * is nobody selected. Every default reads correctly either way.
 */
export function fillTemplate(text, name) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (n) return text.replaceAll('{name}', n);
  return text
    .replace(/ \{name\}/g, '')
    .replace(/\{name\} /g, '')
    .replace(/\{name\}/g, '')
    .trim();
}

/* ─────────────────────────────── backup ─────────────────────────────── */

/** One file for both stores. */
export function exportBackup() {
  return JSON.stringify({
    kind: 'people-backup',
    exportedAt: nowISO(),
    people: JSON.parse(peopleStore.export()),
    messageTemplates: JSON.parse(templatesStore.export()),
  }, null, 2);
}

/**
 * Replaces both stores with the file's contents. The page confirms with her
 * first; this function does not ask. Throws StorageError on a bad file.
 */
export function importBackup(json) {
  const obj = typeof json === 'string' ? JSON.parse(json) : json;
  if (!obj || obj.kind !== 'people-backup' || !obj.people) {
    throw new Error("That file doesn't look like a People backup");
  }
  flushPendingEdit();
  peopleStore.import(obj.people);
  if (obj.messageTemplates) templatesStore.import(obj.messageTemplates);
  else templatesStore.write({ customTemplates: [] });
  syncReminders();
  return true;
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
      reminders.registerReminder({ type: rec.kind, sourceId: rec.id, title: rec.title, body: rec.body, scheduledAt: rec.dueAt });
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

/** 1pm local on the day before `date`, as an ISO instant. */
function dayBeforeAt1pm(date) {
  const d = addDays(date, -1);
  d.setHours(13, 0, 0, 0);
  return d.toISOString();
}

function hrefFor(person) {
  return `/lovesite/people.html#${person.id}`;
}

function reminderIds(person) {
  const ids = [`people:${person.id}:birthday`, `people:${person.id}:checkin`];
  for (let i = 0; i < MAX_IMPORTANT_DATES; i++) ids.push(`people:${person.id}:date:${i}`);
  return ids;
}

function emitRemindersFor(person, now = new Date()) {
  // Always start clean so a removed birthday or a shortened list drops its reminder.
  reminderIds(person).forEach(dropReminder);
  if (isSnoozed(person, now)) return;

  if (person.birthday) {
    const next = nextOccurrence(person.birthday, now);
    emitReminder({
      id: `people:${person.id}:birthday`,
      source: 'people',
      kind: 'birthday',
      dueAt: dayBeforeAt1pm(next),
      title: `${person.name}’s birthday is tomorrow`,
      body: 'A quick hello counts.',
      href: hrefFor(person),
    });
  }

  person.importantDates.forEach((d, i) => {
    const next = nextOccurrence(d, now);
    emitReminder({
      id: `people:${person.id}:date:${i}`,
      source: 'people',
      kind: 'importantDate',
      dueAt: dayBeforeAt1pm(next),
      title: `${d.label} is tomorrow`,
      body: `A small hello to ${person.name} might be nice.`,
      href: hrefFor(person),
    });
  });

  const days = CADENCE_DAYS[person.preferredCadence];
  if (days && person.lastContactAt) {
    const due = addDays(person.lastContactAt, days);
    due.setHours(13, 0, 0, 0);
    if (due > now) {
      emitReminder({
        id: `people:${person.id}:checkin`,
        source: 'people',
        kind: 'checkin',
        dueAt: due.toISOString(),
        title: `Might be nice to say hi to ${person.name}`,
        body: 'A quick hello counts.',
        href: hrefFor(person),
      });
    }
  }
}

function dropRemindersFor(person) {
  reminderIds(person).forEach(dropReminder);
}

/**
 * Re-emit for everyone (ids are stable, so this replaces rather than
 * duplicates). Called by the page once on load, after the engine import has
 * settled; a no-op when there is no engine.
 */
export async function syncReminders() {
  await remindersReady;
  if (!reminders) return;
  const now = new Date();
  for (const person of readItems()) {
    if (isSnoozed(person, now)) dropRemindersFor(person);
    else emitRemindersFor(person, now);
  }
}
