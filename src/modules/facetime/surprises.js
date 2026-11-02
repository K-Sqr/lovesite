/**
 * surprises.js — the hidden moments on the FaceTime pages.
 *
 *   heartsBurst(origin)           a small pop of hearts from an element (nothing under reduced motion)
 *   birthdayState(birthday, now)  'window' | 'countdown' | 'none', with the days and the age
 *   lateNightLine(now)            a line for when she opens it between midnight and 6 AM
 *   monthsaryLine(start, now)     "Happy N months" on the 13th and the week after
 *   fleeButton(button, onCaught)  a button that slides away from the pointer, like the No button
 */

import { svgIcon } from '../icons.js';
import { monthsaryFor } from '../monthsary.js';
import { prefersReducedMotion, clock, ordinal, el } from './format.js';

const rand = (min, max) => min + Math.random() * (max - min);

/** @param {HTMLElement} origin */
export function heartsBurst(origin, { count = 14, cap = 40 } = {}) {
  if (prefersReducedMotion() || !origin) return;
  if (origin.querySelectorAll('.ft-spark').length >= cap) return;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
    const radius = rand(70, 150);
    const span = el('span', { class: 'ft-spark', 'aria-hidden': 'true', style: {
      '--dx': `${(Math.cos(angle) * radius).toFixed(1)}px`,
      '--dy': `${(Math.sin(angle) * radius - 30).toFixed(1)}px`,
      '--size': `${Math.round(rand(12, 22))}px`,
      '--delay': `${Math.round(rand(0, 120))}ms`,
    } });
    span.dataset.tone = String(i % 3);
    span.appendChild(svgIcon('heart'));
    span.addEventListener('animationend', () => span.remove(), { once: true });
    origin.appendChild(span);
  }
}

/**
 * @param {Date} birthday  her date of birth
 * @param {Date} now
 * @returns {{ mode: 'window'|'countdown'|'none', days: number, age: number, nextAge: number }}
 *   window: her birthday and the 60 days after it. countdown: the 14 days before.
 */
export function birthdayState(birthday, now = new Date()) {
  const y = now.getFullYear();
  const thisYear = new Date(y, birthday.getMonth(), birthday.getDate());
  const msDay = 86_400_000;
  const today = new Date(y, now.getMonth(), now.getDate());
  let last = thisYear <= today ? thisYear : new Date(y - 1, birthday.getMonth(), birthday.getDate());
  let next = thisYear > today ? thisYear : new Date(y + 1, birthday.getMonth(), birthday.getDate());
  const sinceLast = Math.round((today - last) / msDay);
  const untilNext = Math.round((next - today) / msDay);
  const age = last.getFullYear() - birthday.getFullYear();
  if (sinceLast >= 0 && sinceLast <= 60) return { mode: 'window', days: sinceLast, age, nextAge: age + 1 };
  if (untilNext > 0 && untilNext <= 14) return { mode: 'countdown', days: untilNext, age, nextAge: age + 1 };
  return { mode: 'none', days: untilNext, age, nextAge: age + 1 };
}

/** @param {Date} now */
export function lateNightLine(now = new Date()) {
  const h = now.getHours();
  if (h >= 6) return null;
  const time = clock(now.toISOString ? new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : now);
  return `It's ${time}. Of course we're up.`;
}

/** @param {Date|string} start @param {Date} now */
export function monthsaryLine(start, now = new Date()) {
  const info = monthsaryFor(start, now);
  if (!info) return null;
  return `Happy ${info.count} ${info.unit}${info.count === 1 ? '' : 's'}. Every 13th is ours.`;
}

/** "25th" from an age. */
export function tripLabel(age) {
  return `${ordinal(age)} trip around the sun`;
}

/**
 * The End call button that will not be pressed. Slides away from the pointer a
 * few times, then gives in. Under reduced motion it just answers the first tap.
 * @param {HTMLElement} button
 * @param {() => void} onGiveUp
 */
export function fleeButton(button, onGiveUp, { escapes = 5 } = {}) {
  let count = 0;
  let done = false;
  const reduced = prefersReducedMotion();

  const flee = () => {
    if (done || reduced) return false;
    count += 1;
    if (count > escapes) return false;
    const field = button.parentElement.getBoundingClientRect();
    const b = button.getBoundingClientRect();
    const maxX = Math.max(0, field.width - b.width);
    const maxY = Math.max(0, field.height - b.height);
    const x = rand(0, maxX);
    const y = rand(0, maxY);
    button.style.transform = `translate(${(x - (b.left - field.left)).toFixed(0)}px, ${(y - (b.top - field.top)).toFixed(0)}px)`;
    button.dataset.escapes = String(count);
    return true;
  };

  button.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') flee(); });
  button.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' && flee()) e.preventDefault();
  });
  button.addEventListener('click', (e) => {
    if (count > 0 && count <= escapes && !reduced) {
      e.preventDefault();
      return;
    }
    if (done) return;
    done = true;
    onGiveUp();
  });
}
