/**
 * countup.js — numbers that count up like a call timer.
 *
 * countUp(el, { to, duration, format })  resolves when the number has landed
 * whenVisible(el, cb)                    runs cb once, the first time el scrolls into view
 *
 * Under reduced motion the final value is set at once. Nothing here encodes
 * meaning in motion: the final text is always the real number.
 */

import { prefersReducedMotion, fmtInt } from './format.js';

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * @param {HTMLElement} el
 * @param {{ to: number, from?: number, duration?: number, format?: (n: number) => string, delay?: number }} options
 */
export function countUp(el, { to, from = 0, duration = 1800, format = fmtInt, delay = 0 }) {
  return new Promise((resolve) => {
    const finish = () => {
      el.textContent = format(to);
      resolve();
    };
    if (prefersReducedMotion() || duration <= 0) {
      finish();
      return;
    }
    let start = null;
    const tick = (now) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / duration);
      const value = from + (to - from) * easeOut(t);
      el.textContent = format(value);
      if (t < 1) requestAnimationFrame(tick);
      else finish();
    };
    el.textContent = format(from);
    setTimeout(() => requestAnimationFrame(tick), delay);
  });
}

/**
 * Count up a clock readout "h:mm:ss" from zero to `seconds`.
 */
export function countUpClock(el, seconds, { duration = 2200, delay = 0 } = {}) {
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (s) => {
    const v = Math.max(0, Math.round(s));
    return `${Math.floor(v / 3600)}:${pad(Math.floor((v % 3600) / 60))}:${pad(v % 60)}`;
  };
  return countUp(el, { to: seconds, duration, format: fmt, delay });
}

let observer = null;
const pending = new WeakMap();

/** @param {Element} el @param {() => void} cb */
export function whenVisible(el, cb) {
  if (typeof IntersectionObserver !== 'function') {
    cb();
    return;
  }
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const fn = pending.get(entry.target);
        observer.unobserve(entry.target);
        pending.delete(entry.target);
        if (fn) fn();
      });
    }, { threshold: 0.25 });
  }
  pending.set(el, cb);
  observer.observe(el);
}
