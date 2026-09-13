/**
 * dates.js — real calendar math + gentle relative wording.
 *
 * Every function accepts a Date or an ISO date string ('YYYY-MM-DD' or full ISO).
 * "Whole day" math is done on UTC-normalised calendar days so DST never
 * produces a 23/25-hour "day". Nothing here divides milliseconds by 30.44.
 */

const MS_PER_DAY = 86_400_000;

/** @param {Date|string} v @returns {Date} */
function asDate(v) {
  if (v instanceof Date) return new Date(v.getTime());
  return parseISO(String(v));
}

/**
 * Parse 'YYYY-MM-DD' as a *local* calendar date (midnight), or any other ISO
 * string via the Date constructor. Returns an invalid Date on garbage input.
 * @param {string} s
 */
export function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

/** Local calendar date → 'YYYY-MM-DD'. @param {Date|string} d */
export function toISO(d) {
  const x = asDate(d);
  const y = x.getFullYear();
  const mo = String(x.getMonth() + 1).padStart(2, '0');
  const da = String(x.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Midnight (local) of the given day. @param {Date|string} d */
export function startOfDay(d) {
  const x = asDate(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

/** Calendar day as a UTC day number — immune to DST. */
function dayNumber(d) {
  const x = asDate(d);
  return Math.floor(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / MS_PER_DAY);
}

/**
 * Whole calendar days from `a` to `b` (positive when b is after a).
 * @param {Date|string} a @param {Date|string} b
 */
export function daysBetween(a, b) {
  return dayNumber(b) - dayNumber(a);
}

/** @param {Date|string} d @param {number} n */
export function addDays(d, n) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Add calendar months, clamping the day to the end of the target month
 * (Jan 31 + 1 month → Feb 28/29, not Mar 3).
 * @param {Date|string} d @param {number} n
 */
export function addMonths(d, n) {
  const x = asDate(d);
  const day = x.getDate();
  const target = new Date(x.getFullYear(), x.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  target.setHours(x.getHours(), x.getMinutes(), x.getSeconds(), x.getMilliseconds());
  return target;
}

/**
 * Real calendar duration between two dates, counted month by month.
 * calendarDuration('2025-09-13', '2026-09-13') → { years: 1, months: 0, days: 0 }
 * If `to` is before `from` the arguments are swapped, so the result is never negative.
 * @param {Date|string} from @param {Date|string} to
 * @returns {{ years: number, months: number, days: number }}
 */
export function calendarDuration(from, to) {
  let a = startOfDay(from);
  let b = startOfDay(to);
  if (b < a) [a, b] = [b, a];

  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  // If we've overshot the day-of-month, step one month back and count the remainder in days.
  if (addMonths(a, months) > b) months -= 1;
  const days = daysBetween(addMonths(a, months), b);

  return { years: Math.floor(months / 12), months: months % 12, days };
}

/**
 * Gentle relative wording for the People feature and friends.
 *
 * TONE RULE — do not "improve" this into a due-date formatter:
 *   • never a count of days overdue, never "late", "overdue", "should", "missed"
 *   • past dates soften as they get older ("a while back"), they never escalate
 *   • future dates are just "coming up", not deadlines
 * The point is that opening the page never feels like being told off.
 *
 * @param {Date|string} date
 * @param {Date|string} [now]
 * @returns {string}
 */
export function formatRelativeGentle(date, now = new Date()) {
  const d = asDate(date);
  if (Number.isNaN(d.getTime())) return 'a while back';
  const ago = daysBetween(d, now); // positive = in the past

  if (ago === 0) return 'today';
  if (ago === 1) return 'yesterday';
  if (ago > 1 && ago < 7) return `${ago} days ago`;
  if (ago >= 7 && ago < 14) return 'last week';
  if (ago >= 14 && ago < 28) return 'a couple of weeks ago';
  if (ago >= 28 && ago < 60) return 'about a month ago';
  if (ago >= 60) return 'a while back';

  // Future
  const ahead = -ago;
  if (ahead === 1) return 'tomorrow';
  if (ahead < 7) return `in ${ahead} days`;
  if (ahead < 14) return 'in about a week';
  if (ahead < 28) return 'in a couple of weeks';
  if (ahead < 60) return 'in about a month';
  return 'a little way off';
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * 'September 18–22' · 'September 28 – October 3' · 'December 30, 2025 – January 2, 2026'
 * A single day comes back as 'September 18'.
 * @param {Date|string} a @param {Date|string} b
 */
export function formatDateRange(a, b) {
  let x = startOfDay(a);
  let y = startOfDay(b);
  if (y < x) [x, y] = [y, x];

  const sameYear = x.getFullYear() === y.getFullYear();
  const sameMonth = sameYear && x.getMonth() === y.getMonth();
  const mx = MONTHS[x.getMonth()];
  const my = MONTHS[y.getMonth()];

  if (sameMonth && x.getDate() === y.getDate()) return `${mx} ${x.getDate()}`;
  if (sameMonth) return `${mx} ${x.getDate()}–${y.getDate()}`;
  if (sameYear) return `${mx} ${x.getDate()} – ${my} ${y.getDate()}`;
  return `${mx} ${x.getDate()}, ${x.getFullYear()} – ${my} ${y.getDate()}, ${y.getFullYear()}`;
}

/** 'September 18, 2026' — for places that need a full, readable date. @param {Date|string} d */
export function formatLongDate(d) {
  const x = asDate(d);
  return `${MONTHS[x.getMonth()]} ${x.getDate()}, ${x.getFullYear()}`;
}
