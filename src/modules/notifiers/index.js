/**
 * notifiers/index.js — the delivery-adapter registry and its contract.
 *
 * ADDING A CHANNEL LATER (email, push, …) IS:
 *   1. write `notifiers/<channel>.js` implementing the Notifier interface below;
 *   2. registerNotifier() it here;
 *   3. add its id to the `channels` arrays in REMINDER_TYPES (reminders.js) for
 *      the types allowed to use it, and a `channels.<id>` default in prefs.
 * That is the whole change. No feature file (people, applications, outfit,
 * rhythm) is touched — if one has to be, the abstraction has failed.
 *
 * No adapter knows what a reminder *means*. It receives a public-string title
 * and body and either shows them or says it could not.
 *
 * @typedef {Object} Notifier
 * @property {'in-app'|'browser'|'email'|'push'} id
 * @property {string} label      shown in preferences, in her language
 * @property {() => Promise<boolean>} isAvailable
 *   Can this channel work in THIS browser right now? No prompting, no side effects.
 * @property {() => Promise<'granted'|'denied'|'unsupported'>} requestPermission
 *   Called ONLY from a user gesture in the preferences panel. Never on load.
 * @property {(reminder: import('../reminders.js').Reminder) => Promise<boolean>} deliver
 *   true = shown. false = could not show; the engine falls through to the next adapter.
 */

import { inAppNotifier } from './inApp.js';
import { browserNotifier } from './browser.js';

/** @type {Notifier[]} */
const registry = [];

const VALID_IDS = new Set(['in-app', 'browser', 'email', 'push']);

/** @param {Notifier} n */
export function registerNotifier(n) {
  if (!n || !VALID_IDS.has(n.id)) throw new Error('registerNotifier: unknown adapter id');
  for (const m of ['isAvailable', 'requestPermission', 'deliver']) {
    if (typeof n[m] !== 'function') throw new Error(`registerNotifier: "${n.id}" lacks ${m}()`);
  }
  if (registry.some((x) => x.id === n.id)) return;
  registry.push(n);
}

/** Every registered adapter, in registry order. The engine filters by preferences and type policy. */
export function getNotifiers() {
  return registry.slice();
}

/** Adapters the preferences allow, in registry order. */
export function getEnabledNotifiers(channels = {}) {
  return registry.filter((n) => channels[n.id] === true);
}

/** @param {string} id */
export function getNotifier(id) {
  return registry.find((n) => n.id === id) || null;
}

// Registry order is delivery order. The browser adapter goes first so that,
// once it is switched on, a reminder reaches the OS *and* the in-app card
// (the card is where "Got it" / "Later" live). It is default OFF, so today
// every reminder falls straight through to the site.
registerNotifier(browserNotifier);
registerNotifier(inAppNotifier);
