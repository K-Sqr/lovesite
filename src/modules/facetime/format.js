/**
 * format.js — small helpers shared by the FaceTime pages.
 *
 * Copy rules for this page: sentence case, "we" and "us", no em dashes.
 * Direction in the data: incoming = she called, outgoing = he called.
 */

import { parseISO, formatLongDate } from '../dates.js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Parse any ISO string from the stats file as a local date. A date-only string
 * ('2026-02-14') would otherwise be read as UTC midnight and land on the 13th
 * in Winnipeg.
 */
export function dateOf(iso) {
  const str = String(iso);
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? parseISO(str) : new Date(str);
}

export function fmtInt(n) {
  return Math.round(n).toLocaleString('en-US');
}

/** 4881.6 → "4,881.6"; whole numbers lose the decimal. */
export function fmtNum(n, digits = 1) {
  const v = Number(n);
  const factor = 10 ** digits;
  const rounded = Math.round(v * factor) / factor;
  if (Number.isInteger(rounded)) return fmtInt(rounded);
  return rounded.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function plural(n, word, pluralWord = `${word}s`) {
  return `${fmtNum(n)} ${Number(n) === 1 ? word : pluralWord}`;
}

/** 39079 → "10:51:19" */
export function hms(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** 39079 → "10 hours, 51 minutes" */
export function hoursMinutes(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return plural(m, 'minute');
  if (m === 0) return plural(h, 'hour');
  return `${plural(h, 'hour')}, ${plural(m, 'minute')}`;
}

/** '2026-04-15T02:40' → "2:40 AM" */
export function clock(iso) {
  const d = dateOf(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** '2026-04-15' or a full ISO → "April 15, 2026" */
export function longDate(iso) {
  return formatLongDate(String(iso).slice(0, 10));
}

/** → "April 15" */
export function monthDay(iso) {
  const d = parseISO(String(iso).slice(0, 10));
  return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
}

/** → "Apr 15" */
export function shortMonthDay(iso) {
  const d = parseISO(String(iso).slice(0, 10));
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** '2026-04' → "April 2026" */
export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** '2026-04' → "Apr" */
export function monthShort(key) {
  const m = Number(key.split('-')[1]);
  return MONTHS_SHORT[m - 1];
}

export function weekdayShort(iso) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseISO(String(iso).slice(0, 10)).getDay()];
}

export function ordinal(n) {
  const v = Math.abs(n) % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][Math.min(n % 10, 4)] || 'th';
  return `${n}${suffix}`;
}

/** Hour of day (0..23) → "1 AM" */
export function hourLabel(h) {
  const x = h % 12 || 12;
  return `${x} ${h < 12 ? 'AM' : 'PM'}`;
}

/** The data's direction, in our voice. */
export function callerWord(direction) {
  return direction === 'incoming' ? 'you' : 'I';
}

export function callerSentence(direction) {
  return direction === 'incoming' ? 'You called' : 'I called';
}

export function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Tiny DOM builder. `text` sets textContent, `html` is never accepted. */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') node.textContent = String(v);
    else if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) node.style.setProperty(p, String(val));
    } else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, String(v));
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

/** Deterministic 0..1 from a string, so stars land in the same place every visit. */
export function hash01(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
