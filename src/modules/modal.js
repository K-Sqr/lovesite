/**
 * modal.js — open/close for `.usm-modal` (ui.css) with the accessibility the
 * existing passcode modal lacks: focus trap, Escape-to-close, focus restore.
 *
 *   const close = openModal(el, { onClose });   // returns a closer
 *   closeModal(el);
 *
 * Markup: see the `.usm-modal` comment in src/styles/ui.css. Anything inside
 * with `[data-modal-close]` closes the modal on click (the scrim, a Cancel button).
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** @type {WeakMap<Element, () => void>} */
const closers = new WeakMap();

/**
 * @param {HTMLElement} modal
 * @param {{ onClose?: () => void, initialFocus?: HTMLElement }} [opts]
 */
export function openModal(modal, opts = {}) {
  if (!modal || closers.has(modal)) return closers.get(modal);
  const previouslyFocused = document.activeElement;

  modal.hidden = false;
  // Two frames so the opacity transition actually runs after display flips.
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));

  const focusables = () => Array.from(modal.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab' || !modal.hasAttribute('data-focus-trap')) return;
    const items = focusables();
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function onClick(e) {
    if (e.target instanceof Element && e.target.closest('[data-modal-close]')) close();
  }

  function close() {
    document.removeEventListener('keydown', onKeydown);
    modal.removeEventListener('click', onClick);
    closers.delete(modal);
    modal.classList.remove('is-open');
    const finish = () => {
      modal.hidden = true;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      if (typeof opts.onClose === 'function') opts.onClose();
    };
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) finish();
    else setTimeout(finish, 300); // matches the .usm-modal opacity transition
  }

  document.addEventListener('keydown', onKeydown);
  modal.addEventListener('click', onClick);
  closers.set(modal, close);

  const target = opts.initialFocus || focusables()[0] || modal;
  if (target === modal && !modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
  requestAnimationFrame(() => target.focus());

  return close;
}

/** @param {HTMLElement} modal */
export function closeModal(modal) {
  const close = closers.get(modal);
  if (close) close();
}
