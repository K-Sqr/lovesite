/**
 * notifiers/browser.js — Level 2: the Notification API. Implemented, registered, DEFAULT OFF.
 *
 * READ THIS BEFORE DEBUGGING "IT DOESN'T WORK ON HER PHONE":
 *   On iOS / iPadOS Safari, `window.Notification` DOES NOT EXIST in a normal
 *   browser tab. It only appears once the site has been added to the Home
 *   Screen as a web app (which needs a manifest this project deliberately does
 *   not ship — see 11-NOTIFICATIONS.md R1 and "Do Not"). isAvailable() is
 *   therefore honestly `false` on an iPhone, and nothing here papers over that.
 *
 *   Without a service worker (also deliberately absent) a notification can
 *   only be created while a page of this site is open. That buys surfacing a
 *   reminder while she is on another tab, and roughly nothing else.
 *
 * Permission is requested ONLY from requestPermission(), which the preferences
 * panel calls inside a click handler. Nothing here runs on page load.
 * deliver() returns false unless permission is already 'granted', so the
 * engine falls through to the in-app card.
 */

function api() {
  return typeof window !== 'undefined' && 'Notification' in window ? window.Notification : null;
}

export const browserNotifier = {
  id: 'browser',
  label: 'Browser notifications',

  async isAvailable() {
    return api() !== null;
  },

  /** @returns {Promise<'granted'|'denied'|'unsupported'>} */
  async requestPermission() {
    const N = api();
    if (!N) return 'unsupported';
    if (N.permission === 'granted') return 'granted';
    if (N.permission === 'denied') return 'denied';
    try {
      const result = await N.requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  },

  async deliver(reminder) {
    const N = api();
    if (!N || N.permission !== 'granted' || !reminder) return false;
    try {
      const n = new N(reminder.title, {
        body: reminder.body || '',
        tag: reminder.id,        // re-delivery replaces rather than stacks
        silent: true,            // a mention in passing, not an alarm
      });
      n.onclick = () => {
        try { window.focus(); } catch { /* not every browser allows it */ }
        n.close();
      };
      return true;
    } catch {
      return false;
    }
  },
};
