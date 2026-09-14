/**
 * notifiers/inApp.js — Level 1: "here on the site". The only adapter on by default.
 *
 * It does not draw anything itself. reminderUI.js mounts *surfaces* (the calm
 * inline card on the For You hub, the strip on a tool page) and each surface
 * says which reminder types it will show. deliver() answers one question:
 * is there a surface on this page for this type? If yes the engine marks the
 * reminder delivered and the surface — which subscribes to the engine —
 * re-renders. If no (index.html, say, has no strip) the reminder stays due
 * for a page that does.
 *
 * Works everywhere, needs no permission, never leaves the device.
 */

/** @type {Set<{ types: Set<string>|null }>} */
const surfaces = new Set();

/**
 * Register a place reminders can be shown. `types` null = anything.
 * @param {{ types?: string[]|null }} [opts]
 * @returns {() => void} detach
 */
export function attachSurface({ types = null } = {}) {
  const surface = { types: Array.isArray(types) ? new Set(types) : null };
  surfaces.add(surface);
  return () => surfaces.delete(surface);
}

/** @param {string} type */
export function hasSurfaceFor(type) {
  for (const s of surfaces) if (!s.types || s.types.has(type)) return true;
  return false;
}

export const inAppNotifier = {
  id: 'in-app',
  label: 'Here on the site',
  async isAvailable() { return true; },
  async requestPermission() { return 'granted'; },
  async deliver(reminder) {
    return !!reminder && hasSurfaceFor(reminder.type);
  },
};
