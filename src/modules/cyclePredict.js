/**
 * cyclePredict.js — pure prediction math for the Rhythm page.
 *
 *   predictNextWindow(records, today) → plain object (see below)
 *   cycleLengthByRecord(records)      → Map<id, days | null>
 *
 * PURE: takes an array of records and a "today", returns data. No DOM, no
 * storage, no copy — the sentence she reads is built in rhythm.js. The only
 * import is dates.js, so this can be exercised by hand in a console:
 *
 *   predictNextWindow([{ startDate: '2026-05-01' }, { startDate: '2026-05-29' }, …], '2026-09-13')
 *
 * The method, stated plainly so nobody "improves" it into a black box:
 *   1. sort starts ascending; cycle length = days between consecutive starts
 *   2. drop lengths < 18 or > 60 days from the maths (data-entry mistakes, not
 *      cycles) — the record stays, only its derived length is excluded
 *   3. take the last 6 usable lengths
 *   4. centre = median, spread = median absolute deviation, clamped to [2, 7]
 *   5. window = lastStart + median ± spread
 *
 * It never returns a single certain date, a percentage, or anything about
 * fertility or ovulation. Those are not this module's business.
 */

import { daysBetween, addDays, toISO, startOfDay } from './dates.js';

export const MIN_CYCLE_DAYS = 18;
export const MAX_CYCLE_DAYS = 60;
export const RECENT_CYCLES = 6;
const MIN_USABLE_FOR_ESTIMATE = 3;
const MODERATE_FROM = 5;
const SPREAD_MAX = 7;
const APPROXIMATE_DATE_PADDING = 2;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validStart(record) {
  return !!record && typeof record.startDate === 'string' && ISO_DATE.test(record.startDate);
}

/** Records sorted by startDate ascending; anything without a usable startDate is ignored. */
function sortedByStart(records) {
  return (Array.isArray(records) ? records : [])
    .filter(validStart)
    .slice()
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}

function isPlausible(days) {
  return days >= MIN_CYCLE_DAYS && days <= MAX_CYCLE_DAYS;
}

/**
 * Median, NOT mean. One 45-day cycle caused by stress or a missed log would
 * drag a mean by several days; the median barely notices it. The prediction
 * has to be robust to exactly that kind of single bad month.
 * @param {number[]} values
 */
export function median(values) {
  if (values.length === 0) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median absolute deviation around a centre. @param {number[]} values @param {number} centre */
export function medianAbsoluteDeviation(values, centre) {
  if (values.length === 0) return null;
  return median(values.map((v) => Math.abs(v - centre)));
}

/**
 * Days from each record's start to the next recorded start, keyed by record id.
 * `null` for the most recent record (no next start yet) and for records
 * without an id. Implausible lengths are still reported here — the history
 * list shows what was recorded; only the prediction excludes them.
 * @param {Array<{ id?: string, startDate: string }>} records
 * @returns {Map<string, number | null>}
 */
export function cycleLengthByRecord(records) {
  const sorted = sortedByStart(records);
  const out = new Map();
  sorted.forEach((r, i) => {
    if (typeof r.id !== 'string') return;
    const next = sorted[i + 1];
    out.set(r.id, next ? daysBetween(r.startDate, next.startDate) : null);
  });
  return out;
}

/**
 * @param {Array<{ startDate: string }>} records  any order; only startDate is read
 * @param {Date|string} [today]
 * @returns {{
 *   state: 'insufficient' | 'estimate',
 *   usableCycles: number,
 *   discardedCycles: number,
 *   medianLength: number | null,
 *   spreadDays: number | null,
 *   lastStart: string | null,
 *   windowStart: string | null,
 *   windowEnd: string | null,
 *   confidence: 'low' | 'moderate' | null,
 *   isPastWindow: boolean,
 *   recentLengths: number[],
 *   usableLengths: number[],
 *   starts: string[],
 *   hasApproximateDates: boolean,
 * }}
 */
export function predictNextWindow(records, today = new Date()) {
  const sorted = sortedByStart(records);
  const starts = sorted.map((r) => r.startDate);
  const lastStart = starts.length ? starts[starts.length - 1] : null;

  // 1–2: every consecutive gap, then keep only the plausible ones
  const allLengths = [];
  for (let i = 0; i + 1 < starts.length; i++) allLengths.push(daysBetween(starts[i], starts[i + 1]));
  const usableLengths = allLengths.filter(isPlausible);
  const discardedCycles = allLengths.length - usableLengths.length;

  // 3: the last 6 usable
  const recentLengths = usableLengths.slice(-RECENT_CYCLES);
  const usableCycles = recentLengths.length;
  const hasApproximateDates = sorted.slice(-(recentLengths.length + 1)).some((r) => r.approximate === true);

  const base = {
    state: 'insufficient',
    usableCycles,
    discardedCycles,
    medianLength: null,
    spreadDays: null,
    lastStart,
    windowStart: null,
    windowEnd: null,
    confidence: null,
    isPastWindow: false,
    recentLengths,
    usableLengths,
    starts,
    hasApproximateDates,
  };

  if (usableCycles < MIN_USABLE_FOR_ESTIMATE || !lastStart) return base;

  // 4: centre and spread
  const rawMedian = median(recentLengths);
  const medianLength = Math.round(rawMedian);
  const confidence = usableCycles >= MODERATE_FROM ? 'moderate' : 'low';
  // Fewer cycles → wider window: the spread floor is 3 days rather than 2.
  const spreadMin = confidence === 'low' ? 3 : 2;
  const mad = Math.ceil(medianAbsoluteDeviation(recentLengths, rawMedian));
  const spreadDays = Math.min(
    SPREAD_MAX + APPROXIMATE_DATE_PADDING,
    Math.max(spreadMin, mad) + (hasApproximateDates ? APPROXIMATE_DATE_PADDING : 0),
  );

  // 5: the window
  const predictedStart = addDays(lastStart, medianLength);
  const windowStart = addDays(predictedStart, -spreadDays);
  const windowEnd = addDays(predictedStart, spreadDays);
  const isPastWindow = daysBetween(windowEnd, startOfDay(today)) > 0;

  return {
    ...base,
    state: 'estimate',
    medianLength,
    spreadDays,
    windowStart: toISO(windowStart),
    windowEnd: toISO(windowEnd),
    confidence,
    isPastWindow,
  };
}
