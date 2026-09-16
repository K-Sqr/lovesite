/**
 * applicationsStore.js — the Application Desk's data layer.
 *
 * Owns every read and write for two stores, id generation, ordering, and the
 * reminder seam. `src/applications.js` renders and wires events; it never
 * touches localStorage and never imports storage.js directly.
 *
 *   createStore('applications', { version: 2 })  →  usm.applications.v2
 *   createStore('materials',    { version: 2 })  →  usm.materials.v2
 *
 * v2 adds starter records from src/data/applicationsSeed.js (resumes, cover
 * letters, and a few applications she has already worked on) so the first
 * visit is not empty. A later seed merge recognises `mat_seed_` / `app_seed_`
 * ids and will not duplicate them.
 *
 * On disk both are `{ v, updatedAt, data }` envelopes (storage.js does that).
 *
 *   usm.applications.v2.data = { items: Application[] }
 *   usm.materials.v2.data    = { items: Material[], templateOverrides: { [templateId]: body } }
 *
 * Application (17 fields):
 *   { id, organization, position, url, jobDescription,
 *     deadline,      // 'YYYY-MM-DD' or null
 *     discoveredAt,  // 'YYYY-MM-DD'
 *     appliedAt,     // 'YYYY-MM-DD' or null
 *     status,        // one of STATUSES
 *     resumeUsed, coverLetter, referencesUsed,   // material ids or null
 *     interviewAt,   // full ISO datetime or null
 *     followUpAt,    // 'YYYY-MM-DD' or null
 *     notes, outcome, updatedAt }
 *
 * Material:
 *   { id, label, kind, body, updatedAt }   kind ∈ MATERIAL_KINDS
 *
 * ── Reminder seam (for 11-NOTIFICATIONS.md) ─────────────────────────────────
 * This page emits reminder records; it does not schedule, prompt, or poll.
 * `src/modules/reminders.js` is OWNED BY 11-NOTIFICATIONS.md. It is loaded
 * lazily via `import.meta.glob`, so the desk still works if that chunk ever
 * fails to load — every call below simply becomes a no-op.
 *
 * Emitted record (the id is stable and deterministic, so re-emitting REPLACES,
 * never duplicates):
 *
 *   {
 *     id: `applications:${app.id}:deadline`,   // …:interview  …:followup
 *     source: 'applications',
 *     kind: 'deadline' | 'interview' | 'followup',
 *     dueAt: '2026-10-01T13:00:00.000Z',        // full ISO; the moment to surface it
 *     title: 'Manso Manitoba closes tomorrow',
 *     body: 'Ready when you are.',
 *     href: '/lovesite/applications.html#app_7fq2m',
 *   }
 *
 * Consumed as:  reminders.upsertReminder(record)   and   reminders.cancelReminder(id)
 * The engine maps `kind` deadline/interview/followup → type 'application' and
 * stores `id` as the opaque sourceId; cancelReminder() accepts that same id.
 *
 * When each fires: a deadline the morning before it closes; an interview the
 * morning before; a follow-up the morning of. Cleared fields drop their record;
 * archiving (Rejected / Closed) or deleting drops all three.
 */

import { createStore } from './storage.js';
import { parseISO, toISO, startOfDay, addDays, formatLongDate } from './dates.js';
import { materialsSeed, applicationsSeed } from '../data/applicationsSeed.js';

/** One small helper — the only place this module talks to the console. */
function warn(message, err) {
  if (err !== undefined) console.warn(`[applications] ${message}`, err);
  else console.warn(`[applications] ${message}`);
}

/* ────────────────────────────── vocabulary ────────────────────────────── */

export const STATUSES = ['Saved', 'Preparing', 'Ready', 'Applied', 'Interview', 'Follow-up', 'Offer', 'Rejected', 'Closed'];

/** Colour is always paired with the word — see the row renderer. */
export const STATUS_TONE = {
  Saved: 'soon',
  Preparing: 'soon',
  Ready: 'calm',
  Applied: 'calm',
  Interview: 'warm',
  Offer: 'warm',
  'Follow-up': 'waiting',
  Rejected: 'quiet',
  Closed: 'quiet',
};

export const ARCHIVED_STATUSES = ['Rejected', 'Closed'];

export const MATERIAL_KINDS = [
  { id: 'resume', label: 'Resume', heading: 'Resume' },
  { id: 'blurb', label: 'Experience note', heading: 'Experience note' },
  { id: 'coverLetter', label: 'Cover letter', heading: 'Previous cover letter' },
  { id: 'references', label: 'References', heading: 'References' },
  { id: 'other', label: 'Other', heading: 'Note' },
];

/** Stable order for the {{materials}} block and for grouping in the picker. */
export const KIND_ORDER = MATERIAL_KINDS.map((k) => k.id);

export function kindLabel(kind) {
  return (MATERIAL_KINDS.find((k) => k.id === kind) || MATERIAL_KINDS[MATERIAL_KINDS.length - 1]).label;
}

export function isArchived(app) {
  return ARCHIVED_STATUSES.includes(app.status);
}

/* ─────────────────────────────── stores ─────────────────────────────── */

/** Stable starter records so a re-seed never duplicates or reshuffles ids. */
function seededMaterials() {
  return materialsSeed.map((m) => ({
    id: `mat_seed_${m.slug}`,
    label: m.label,
    kind: m.kind,
    body: String(m.body ?? ''),
    updatedAt: m.updatedAt,
  }));
}

function seededApplications() {
  return applicationsSeed.map((a) => ({
    id: `app_seed_${a.slug}`,
    organization: a.organization,
    position: a.position,
    url: a.url || '',
    jobDescription: String(a.jobDescription ?? ''),
    deadline: a.deadline ?? null,
    discoveredAt: a.discoveredAt,
    appliedAt: a.appliedAt ?? null,
    status: a.status,
    resumeUsed: a.resumeUsed ?? null,
    coverLetter: a.coverLetter ?? null,
    referencesUsed: a.referencesUsed ?? null,
    interviewAt: a.interviewAt ?? null,
    followUpAt: a.followUpAt ?? null,
    notes: a.notes || '',
    outcome: a.outcome ?? null,
    updatedAt: a.updatedAt,
  }));
}

function mergeById(existing, seeded) {
  const have = new Set(existing.map((item) => item && item.id).filter(Boolean));
  const extra = seeded.filter((item) => !have.has(item.id));
  return extra.length === 0 ? existing : [...existing, ...extra];
}

const applications = createStore('applications', {
  version: 2,
  initial: { items: seededApplications() },
  migrate(oldData) {
    const existing = Array.isArray(oldData?.items) ? oldData.items : [];
    return { items: mergeById(existing, seededApplications()) };
  },
});
const materials = createStore('materials', {
  version: 2,
  initial: { items: seededMaterials(), templateOverrides: {} },
  migrate(oldData) {
    const existing = Array.isArray(oldData?.items) ? oldData.items : [];
    const templateOverrides = oldData?.templateOverrides && typeof oldData.templateOverrides === 'object'
      ? oldData.templateOverrides
      : {};
    return { items: mergeById(existing, seededMaterials()), templateOverrides };
  },
});

/** The underlying stores, for cloudSync.js only — it mirrors their envelopes between devices. */
export function syncTargets() {
  return [applications, materials];
}

/** Listeners told when a write did not reach disk (storage kept it in memory). */
const failureListeners = new Set();

/** @param {() => void} fn */
export function onSaveFailure(fn) {
  failureListeners.add(fn);
  return () => failureListeners.delete(fn);
}

function commit(store, data) {
  const ok = store.write(data);
  if (!ok) failureListeners.forEach((fn) => { try { fn(); } catch (err) { warn('failure listener threw', err); } });
  return ok;
}

function readApplications() {
  const data = applications.read();
  return data && Array.isArray(data.items) ? data : { items: [] };
}

function readMaterials() {
  const data = materials.read();
  if (!data || !Array.isArray(data.items)) return { items: [], templateOverrides: {} };
  if (!data.templateOverrides || typeof data.templateOverrides !== 'object') data.templateOverrides = {};
  return data;
}

export function subscribeApplications(fn) { return applications.subscribe(() => fn(listApplications())); }
export function subscribeMaterials(fn) { return materials.subscribe(() => fn(listMaterials())); }

/* ──────────────────────────────── ids ──────────────────────────────── */

function shortId(prefix) {
  let rand;
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') {
    rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  } else {
    rand = Math.random().toString(36).slice(2, 10);
  }
  return `${prefix}_${rand}`;
}

function nowISO() { return new Date().toISOString(); }
function todayISO() { return toISO(new Date()); }
function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }
function dateOrNull(v) { const s = str(v).trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }
function datetimeOrNull(v) {
  const s = str(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function idOrNull(v) { const s = str(v).trim(); return s ? s : null; }

/* ───────────────────────────── materials ───────────────────────────── */

export function listMaterials() {
  return readMaterials().items.slice();
}

export function getMaterial(id) {
  return readMaterials().items.find((m) => m.id === id) || null;
}

function normaliseMaterial(input, existing = {}) {
  const kind = KIND_ORDER.includes(input.kind) ? input.kind : (existing.kind || 'other');
  return {
    id: existing.id || shortId('mat'),
    label: str(input.label ?? existing.label).trim() || 'Untitled',
    kind,
    body: str(input.body ?? existing.body),
    updatedAt: nowISO(),
  };
}

/** @returns {{ ok: boolean, item: object }} */
export function addMaterial({ label, kind, body }) {
  const data = readMaterials();
  const item = normaliseMaterial({ label, kind, body });
  data.items.push(item);
  return { ok: commit(materials, data), item };
}

export function updateMaterial(id, patch) {
  const data = readMaterials();
  const i = data.items.findIndex((m) => m.id === id);
  if (i === -1) return { ok: false, item: null };
  const item = normaliseMaterial(patch, data.items[i]);
  data.items[i] = item;
  return { ok: commit(materials, data), item };
}

export function deleteMaterial(id) {
  const data = readMaterials();
  data.items = data.items.filter((m) => m.id !== id);
  const ok = commit(materials, data);
  // Applications that pointed at it keep working; the pointer just goes away.
  const apps = readApplications();
  let touched = false;
  for (const app of apps.items) {
    for (const key of ['resumeUsed', 'coverLetter', 'referencesUsed']) {
      if (app[key] === id) { app[key] = null; touched = true; }
    }
  }
  if (touched) commit(applications, apps);
  return ok;
}

/** Her second cover letter starts from her first. */
export function duplicateMaterial(id) {
  const src = getMaterial(id);
  if (!src) return { ok: false, item: null };
  return addMaterial({ label: `${src.label} (copy)`, kind: src.kind, body: src.body });
}

export function getTemplateOverrides() {
  return { ...readMaterials().templateOverrides };
}

export function setTemplateOverride(templateId, body) {
  const data = readMaterials();
  data.templateOverrides[templateId] = str(body);
  return commit(materials, data);
}

export function resetTemplateOverride(templateId) {
  const data = readMaterials();
  delete data.templateOverrides[templateId];
  return commit(materials, data);
}

/* ─────────────────────────── applications ─────────────────────────── */

export function listApplications() {
  return readApplications().items.slice();
}

export function getApplication(id) {
  return readApplications().items.find((a) => a.id === id) || null;
}

function normaliseApplication(input, existing = {}) {
  const status = STATUSES.includes(input.status) ? input.status : (existing.status || 'Saved');
  return {
    id: existing.id || shortId('app'),
    organization: str(input.organization ?? existing.organization).trim(),
    position: str(input.position ?? existing.position).trim(),
    url: str(input.url ?? existing.url).trim(),
    jobDescription: str(input.jobDescription ?? existing.jobDescription),
    deadline: 'deadline' in input ? dateOrNull(input.deadline) : (existing.deadline ?? null),
    discoveredAt: dateOrNull(input.discoveredAt ?? existing.discoveredAt) || todayISO(),
    appliedAt: 'appliedAt' in input ? dateOrNull(input.appliedAt) : (existing.appliedAt ?? null),
    status,
    resumeUsed: 'resumeUsed' in input ? idOrNull(input.resumeUsed) : (existing.resumeUsed ?? null),
    coverLetter: 'coverLetter' in input ? idOrNull(input.coverLetter) : (existing.coverLetter ?? null),
    referencesUsed: 'referencesUsed' in input ? idOrNull(input.referencesUsed) : (existing.referencesUsed ?? null),
    interviewAt: 'interviewAt' in input ? datetimeOrNull(input.interviewAt) : (existing.interviewAt ?? null),
    followUpAt: 'followUpAt' in input ? dateOrNull(input.followUpAt) : (existing.followUpAt ?? null),
    notes: str(input.notes ?? existing.notes),
    outcome: 'outcome' in input ? (str(input.outcome).trim() || null) : (existing.outcome ?? null),
    updatedAt: nowISO(),
  };
}

/** Create from the assembler or the tracker. Defaults: status Saved, discoveredAt today. */
export function addApplication(fields) {
  const data = readApplications();
  const item = normaliseApplication(fields);
  data.items.push(item);
  const ok = commit(applications, data);
  syncReminders(item);
  return { ok, item };
}

export function updateApplication(id, patch) {
  const data = readApplications();
  const i = data.items.findIndex((a) => a.id === id);
  if (i === -1) return { ok: false, item: null };
  const item = normaliseApplication(patch, data.items[i]);
  data.items[i] = item;
  const ok = commit(applications, data);
  syncReminders(item);
  return { ok, item };
}

export function deleteApplication(id) {
  const data = readApplications();
  data.items = data.items.filter((a) => a.id !== id);
  const ok = commit(applications, data);
  dropAllReminders(id);
  return ok;
}

/* ─────────────────────────────── ordering ─────────────────────────────── */

/**
 * The single "what needs attention soonest" date for a record, or null.
 * Only FUTURE dates count (today included for date-only fields, so a deadline
 * that closes today still leads). Past dates never promote a record and are
 * never flagged — the row renderer just says "Closed on October 2".
 * @param {object} app
 * @param {Date} [now]
 * @returns {{ kind: 'interview'|'deadline'|'followup', at: Date } | null}
 */
export function nextAttention(app, now = new Date()) {
  const today = startOfDay(now);
  const candidates = [];
  if (app.interviewAt) {
    const d = new Date(app.interviewAt);
    if (!Number.isNaN(d.getTime()) && d >= now) candidates.push({ kind: 'interview', at: d });
  }
  if (app.deadline) {
    const d = parseISO(app.deadline);
    if (!Number.isNaN(d.getTime()) && d >= today) candidates.push({ kind: 'deadline', at: d });
  }
  if (app.followUpAt) {
    const d = parseISO(app.followUpAt);
    if (!Number.isNaN(d.getTime()) && d >= today) candidates.push({ kind: 'followup', at: d });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.at - b.at);
  return candidates[0];
}

/**
 * Pure. Splits the list into what she is working on and what is archived, and
 * orders the first group by attention:
 *
 *   1. records with an upcoming interview / deadline / follow-up, nearest first
 *   2. records with no upcoming date, most recently touched first
 *
 * Rejected and Closed always go to `archived` (most recently touched first) so
 * they sit under the disclosure and never mix with the working list. Nothing
 * here counts anything, and no date is ever flagged.
 *
 * @param {object[]} items
 * @param {Date} [now]
 * @returns {{ active: object[], archived: object[] }}
 */
export function orderForAttention(items, now = new Date()) {
  const active = [];
  const archived = [];
  for (const app of items) (isArchived(app) ? archived : active).push(app);

  const byUpdated = (a, b) => str(b.updatedAt).localeCompare(str(a.updatedAt));
  const nearest = new Map(active.map((a) => [a.id, nextAttention(a, now)]));

  active.sort((a, b) => {
    const da = nearest.get(a.id);
    const db = nearest.get(b.id);
    if (da && db) return (da.at - db.at) || byUpdated(a, b);
    if (da) return -1;
    if (db) return 1;
    return byUpdated(a, b);
  });
  archived.sort(byUpdated);
  return { active, archived };
}

/* ───────────────────────────── export / import ───────────────────────────── */

const BACKUP_NAME = 'application-desk';

/** Both stores wrapped into one file. */
export function exportAll() {
  const bundle = {
    name: BACKUP_NAME,
    exportedAt: nowISO(),
    stores: {
      applications: JSON.parse(applications.export()),
      materials: JSON.parse(materials.export()),
    },
  };
  return JSON.stringify(bundle, null, 2);
}

export function backupFilename(now = new Date()) {
  return `application-desk-backup-${toISO(now)}.json`;
}

/**
 * Replaces both stores with the contents of a backup made by exportAll().
 * Throws a StorageError (from storage.js) with a readable message on a bad file.
 */
export function importAll(json) {
  let obj;
  try {
    obj = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new Error("That file doesn't look like an Application Desk backup.");
  }
  if (!obj || typeof obj !== 'object' || obj.name !== BACKUP_NAME || !obj.stores || typeof obj.stores !== 'object') {
    throw new Error("That file doesn't look like an Application Desk backup.");
  }
  // Validate both before writing either, so a bad file never half-imports.
  const { applications: a, materials: m } = obj.stores;
  if (!a || !m) throw new Error('That backup is missing one of its two parts.');
  if (a.name !== 'applications' || m.name !== 'materials' || !('data' in a) || !('data' in m)) {
    throw new Error("That file doesn't look like an Application Desk backup.");
  }
  materials.import(m);
  applications.import(a);
  // Re-emit every reminder from the restored records.
  for (const app of listApplications()) syncReminders(app);
  return { applications: listApplications().length, materials: listMaterials().length };
}

/* ────────────────────────────── reminder seam ────────────────────────────── */

/**
 * Lazy, defensive handle on src/modules/reminders.js (owned by 11-NOTIFICATIONS).
 * `import.meta.glob` is resolved by Vite at build time: an empty object while the
 * file does not exist, a lazy loader once it does. Never throws, never blocks.
 * @type {Promise<object|null>|null}
 */
let remindersPromise = null;

function loadReminders() {
  if (remindersPromise) return remindersPromise;
  remindersPromise = (async () => {
    try {
      const loaders = import.meta.glob('./reminders.js');
      const load = loaders['./reminders.js'];
      if (typeof load !== 'function') return null; // not built yet; every call below becomes a no-op
      return await load();
    } catch (err) {
      warn('reminders module unavailable; continuing without it', err);
      return null;
    }
  })();
  return remindersPromise;
}

/** The one local wrapper for emitting. */
function emitReminder(rec) {
  loadReminders().then((reminders) => {
    if (!reminders) return;
    try {
      if (typeof reminders.upsertReminder === 'function') {
        reminders.upsertReminder(rec);
      } else if (typeof reminders.registerReminder === 'function') {
        // 11-NOTIFICATIONS engine shape: upsert by (type, sourceId, day of scheduledAt).
        reminders.registerReminder({ type: 'application', sourceId: rec.id, title: rec.title, body: rec.body, scheduledAt: rec.dueAt, href: rec.href });
      }
    } catch (err) {
      warn('upsertReminder threw', err);
    }
  });
}

/** The one local wrapper for dropping. */
function dropReminder(id) {
  loadReminders().then((reminders) => {
    if (!reminders) return;
    try {
      if (typeof reminders.cancelReminder === 'function') reminders.cancelReminder(id);
      if (typeof reminders.cancelBySource === 'function') reminders.cancelBySource('application', id);
    } catch (err) {
      warn('cancelReminder threw', err);
    }
  });
}

const REMINDER_KINDS = ['deadline', 'interview', 'followup'];
const MORNING_HOUR = 8; // local time — the same hour the spec's example lands in Winnipeg

function reminderId(appId, kind) { return `applications:${appId}:${kind}`; }
function hrefFor(appId) { return `/lovesite/applications.html#${appId}`; }
function orgName(app) { return app.organization || app.position || 'This one'; }

/** Local morning of a calendar date, as ISO. */
function morningOf(date) {
  const d = startOfDay(date);
  d.setHours(MORNING_HOUR, 0, 0, 0);
  return d.toISOString();
}

/**
 * Build the up-to-three reminder records for a record; null where the field is empty.
 * Exported so 11-NOTIFICATIONS (and a test) can see exactly what this page emits.
 */
export function remindersFor(app) {
  const out = { deadline: null, interview: null, followup: null };
  if (app.deadline) {
    const closes = parseISO(app.deadline);
    if (!Number.isNaN(closes.getTime())) {
      out.deadline = {
        id: reminderId(app.id, 'deadline'),
        source: 'applications',
        kind: 'deadline',
        dueAt: morningOf(addDays(closes, -1)),
        title: `${orgName(app)} closes tomorrow`,
        body: 'Ready when you are.',
        href: hrefFor(app.id),
      };
    }
  }
  if (app.interviewAt) {
    const when = new Date(app.interviewAt);
    if (!Number.isNaN(when.getTime())) {
      out.interview = {
        id: reminderId(app.id, 'interview'),
        source: 'applications',
        kind: 'interview',
        dueAt: morningOf(addDays(when, -1)),
        title: `Interview with ${orgName(app)} tomorrow`,
        body: "It's a conversation. You already know your own story.",
        href: hrefFor(app.id),
      };
    }
  }
  if (app.followUpAt) {
    const day = parseISO(app.followUpAt);
    if (!Number.isNaN(day.getTime())) {
      out.followup = {
        id: reminderId(app.id, 'followup'),
        source: 'applications',
        kind: 'followup',
        dueAt: morningOf(day),
        title: `A note to ${orgName(app)}, whenever you like`,
        body: `You said you'd check in around ${formatLongDate(day)}. Short and friendly is plenty.`,
        href: hrefFor(app.id),
      };
    }
  }
  return out;
}

/** Emit on save, drop what was cleared, drop everything when archived. */
function syncReminders(app) {
  if (isArchived(app)) { dropAllReminders(app.id); return; }
  const recs = remindersFor(app);
  for (const kind of REMINDER_KINDS) {
    if (recs[kind]) emitReminder(recs[kind]);
    else dropReminder(reminderId(app.id, kind));
  }
}

function dropAllReminders(appId) {
  for (const kind of REMINDER_KINDS) dropReminder(reminderId(appId, kind));
}
