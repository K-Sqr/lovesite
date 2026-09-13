/**
 * reveal.js — the one scroll-reveal observer for the whole site.
 *
 * Adds `.visible` to `.reveal` elements as they enter the viewport. This is
 * the ONLY IntersectionObserver for `.reveal` in the codebase (04-SHARED-FOUNDATIONS R4).
 *
 * Content must never be stuck invisible because an API is missing or the user
 * asked for less motion — `.reveal` starts at `opacity: 0`, so both of those
 * cases mark everything visible immediately.
 */

const OPTIONS = { threshold: 0.12, rootMargin: '0px 0px -32px 0px' };

let observer = null;

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function canObserve() {
  return typeof IntersectionObserver === 'function' && !prefersReducedMotion();
}

function getObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, OPTIONS);
  return observer;
}

/**
 * Observe a single element (use for rows inserted after initReveal ran).
 * @param {Element} el
 */
export function observeReveal(el) {
  if (!el || el.classList.contains('visible')) return;
  if (!canObserve()) {
    el.classList.add('visible');
    return;
  }
  getObserver().observe(el);
}

/**
 * Observe every `.reveal` under `root` that is not yet visible.
 * Safe to call more than once (e.g. after re-rendering a list).
 * @param {ParentNode} [root]
 */
export function initReveal(root = document) {
  root.querySelectorAll('.reveal:not(.visible)').forEach(observeReveal);
}
