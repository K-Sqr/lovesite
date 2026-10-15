/**
 * monthsary.js — the little "Happy N months" banner that pops up on the timeline
 * page every 13th and stays up for the week, the 13th through the 19th (she said
 * yes on the 13th, so every 13th is ours).
 *
 *   monthsaryFor(start, now)      → { count, unit } on a monthsary, otherwise null
 *   initMonthsary({ start, before })   build the banner and put it before `before`
 *
 * Nothing is hardcoded to a month: the count is real calendar months since
 * `start` (dates.js), so it is right on every 13th without anyone touching it.
 * Month 12 reads "Happy 1 year", month 24 "Happy 2 years", and so on.
 *
 * Preview any day with `timeline.html?monthsary` — it shows the whole months so far.
 *
 * Motion is CSS only (timeline-page.css, `.monthsary*`); the tap-for-hearts burst
 * creates nothing under reduced motion, and the banner itself is static text
 * that stands on its own.
 */

import { calendarDuration, daysBetween } from './dates.js';
import { svgIcon } from './icons.js';

/** The monthsary day itself plus the six after it — a week. */
const DAYS_SHOWN = 7;

const FLOATERS = 10;
const BURST = 10;
const BURST_CAP = 30;

const rand = (min, max) => min + Math.random() * (max - min);

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function countFor({ years, months }) {
  const total = years * 12 + months;
  if (total < 1) return null;
  return total % 12 === 0
    ? { count: total / 12, unit: 'year' }
    : { count: total, unit: 'month' };
}

/**
 * @param {Date|string} start  the day it began (its day-of-month is the monthsary; the week after still counts)
 * @param {Date|string} [now]
 * @param {{ force?: boolean }} [opts]  force: ignore the day, count whole months so far
 * @returns {{ count: number, unit: 'month' | 'year' } | null}
 */
export function monthsaryFor(start, now = new Date(), { force = false } = {}) {
  if (daysBetween(start, now) < 1) return null;
  const duration = calendarDuration(start, now);
  if (!force && duration.days >= DAYS_SHOWN) return null;
  return countFor(duration);
}

function floater(i) {
  const span = el('span', 'monthsary__float');
  span.style.setProperty('--x', `${((i + rand(0.1, 0.9)) / FLOATERS * 100).toFixed(1)}%`);
  span.style.setProperty('--size', `${Math.round(rand(11, 22))}px`);
  span.style.setProperty('--delay', `${rand(0, 7).toFixed(2)}s`);
  span.style.setProperty('--dur', `${rand(6.5, 10).toFixed(2)}s`);
  span.style.setProperty('--sway', `${Math.round(rand(-26, 26))}px`);
  span.dataset.tone = String(i % 3);
  span.appendChild(svgIcon('heart'));
  return span;
}

/** A small pop of hearts from the badge. Capped so a tapping frenzy stays cheap. */
function burst(origin) {
  if (prefersReducedMotion()) return;
  if (origin.querySelectorAll('.monthsary__spark').length >= BURST_CAP) return;

  for (let i = 0; i < BURST; i += 1) {
    const angle = (i / BURST) * Math.PI * 2 + rand(-0.25, 0.25);
    const radius = rand(60, 120);
    const span = el('span', 'monthsary__spark');
    span.style.setProperty('--dx', `${(Math.cos(angle) * radius).toFixed(1)}px`);
    span.style.setProperty('--dy', `${(Math.sin(angle) * radius - 20).toFixed(1)}px`);
    span.style.setProperty('--size', `${Math.round(rand(12, 20))}px`);
    span.dataset.tone = String(i % 3);
    span.appendChild(svgIcon('heart'));
    span.addEventListener('animationend', () => span.remove(), { once: true });
    origin.appendChild(span);
  }
}

function render({ count, unit }) {
  const section = el('section', 'monthsary');
  section.setAttribute('aria-label', 'Happy monthsary');

  const layer = el('div', 'monthsary__floats');
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < FLOATERS; i += 1) layer.appendChild(floater(i));
  section.appendChild(layer);

  const badge = el('button', 'monthsary__badge');
  badge.type = 'button';
  badge.setAttribute('aria-label', 'Send a little love');
  badge.appendChild(svgIcon('heart'));
  badge.appendChild(el('span', 'monthsary__count', String(count)));
  badge.addEventListener('click', () => burst(badge));
  section.appendChild(badge);

  section.appendChild(el('h2', 'monthsary__title', `Happy ${count} ${unit}${count === 1 ? '' : 's'}`));

  const name = el('p', 'monthsary__name', 'Baby girl ');
  const heart = el('span', null, '\u{1F495}');
  heart.setAttribute('aria-hidden', 'true');
  name.appendChild(heart);
  section.appendChild(name);

  section.appendChild(el('p', 'monthsary__note', 'Every 13th is ours.'));
  return section;
}

/**
 * @param {{ start: Date|string, before: string, now?: Date }} options
 *        before: selector of the element the banner is placed in front of
 */
export function initMonthsary({ start, before, now = new Date() }) {
  const anchor = document.querySelector(before);
  if (!anchor) return;

  const force = new URLSearchParams(window.location.search).has('monthsary');
  const info = monthsaryFor(start, now, { force });
  if (!info) return;

  anchor.before(render(info));
}
