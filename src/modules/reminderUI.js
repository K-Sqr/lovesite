/**
 * reminderUI.js — the one visible surface of the reminder system.
 *
 *   initReminders({ strip, prefs })          For You hub: card + "Reminders" panel
 *   mountReminderStrip(el, { types, max })   tool pages: the same card, their type only
 *
 * A strip with nothing to show renders NOTHING — zero height, no empty state,
 * no "all caught up". Absence is the calm state. When there is something, it
 * is one .usm-card ("One small thing" / "A couple of things") holding at most
 * MAX_VISIBLE items, each with two gentle actions — "Got it" and "Later" —
 * and, past the cap, one line ("a couple of other things are waiting…") that
 * reveals the rest only when she asks. Never a list, never a count, never a
 * badge. Inline in the page flow; the music popup owns the bottom of the screen.
 *
 * Everything from her data goes through textContent. No innerHTML.
 * Notification permission is requested in exactly one place: the click
 * handler on the "Browser notifications" switch in the panel. Never on load.
 */

import '../styles/reminders.css';
import {
  REMINDER_TYPES, PERSISTED_TYPES, MAX_VISIBLE,
  listActionable, snoozeReminder, dismissReminder, getPrefs, setPrefs,
  subscribeReminders, startEvaluating,
} from './reminders.js';
import { attachSurface } from './notifiers/inApp.js';
import { getNotifier } from './notifiers/index.js';

/** The only console output in this module. Never pass it a reminder. */
function warn(message, err) {
  if (err !== undefined) console.warn(`[reminderUI] ${message}`, err);
  else console.warn(`[reminderUI] ${message}`);
}

const COPY = {
  one: 'One small thing',
  couple: 'A couple of things',
  more: 'A couple of other things are waiting whenever you want them',
  gotIt: 'Got it',
  later: 'Later',
  open: 'Have a look',
  panelTitle: 'Reminders',
  onLabel: 'Mention things here now and then',
  honest: 'Only while the site is open — nothing runs in the background, and nothing leaves this device.',
  whatLegend: 'What to mention',
  whereLegend: 'Where',
  inAppNote: 'Always. This is the site itself.',
  browserUnsupported: "This browser can't show notifications from a normal tab. On an iPhone the site would need to be added to the Home Screen first — ask him.",
  browserDenied: "Notifications are switched off for this site in the browser's own settings.",
  browserOn: 'On. Only while a page of this site is open.',
  quietLegend: 'Quiet hours',
  quietNote: 'Nothing pops up between these times. The card here on the site still shows, because you opened it.',
  from: 'From',
  to: 'Until',
};

/** Tone chip per type: "coming up" vs "it's been a little while". Always a word with the tint. */
const TONE = {
  rhythm:      { cls: 'usm-tone--soon',    text: 'This week' },
  checkin:     { cls: 'usm-tone--waiting', text: "It's been a little while" },
  birthday:    { cls: 'usm-tone--soon',    text: 'Coming up' },
  application: { cls: 'usm-tone--soon',    text: 'Coming up' },
  outfit:      { cls: 'usm-tone--soon',    text: 'This morning' },
  date:        { cls: 'usm-tone--soon',    text: 'Coming up' },
};

/* ─────────────────────────────── helpers ─────────────────────────────── */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'class') node.className = v;
    else if (k === 'checked') node.checked = !!v;
    else if (k === 'value') node.value = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children) if (child) node.appendChild(child);
  return node;
}

function resolveMount(target) {
  if (!target) return null;
  if (typeof target === 'string') return document.querySelector(target);
  return target instanceof Element ? target : null;
}

/** True when `href` points at the page she is already on — no link then. */
function isThisPage(href) {
  if (!href) return true;
  try {
    const url = new URL(href, window.location.href);
    return url.pathname === window.location.pathname;
  } catch {
    return true;
  }
}

/* ─────────────────────────────── the card ─────────────────────────────── */

function buildItem(reminder) {
  const tone = TONE[reminder.type] || TONE.date;
  const actions = el('div', { class: 'reminder-item__actions' });

  if (!isThisPage(reminder.href)) {
    actions.appendChild(el('a', { class: 'usm-btn usm-btn--ghost reminder-item__open', href: reminder.href, text: COPY.open }));
  }
  const gotIt = el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', text: COPY.gotIt });
  gotIt.addEventListener('click', () => dismissReminder(reminder.id));
  const later = el('button', { type: 'button', class: 'usm-btn usm-btn--ghost', text: COPY.later });
  later.addEventListener('click', () => snoozeReminder(reminder.id));
  actions.append(gotIt, later);

  return el('li', { class: 'reminder-item', 'data-id': reminder.id }, [
    el('span', { class: `usm-tone ${tone.cls}`, text: tone.text }),
    el('p', { class: 'reminder-item__title', text: reminder.title }),
    reminder.body ? el('p', { class: 'reminder-item__body', text: reminder.body }) : null,
    actions,
  ]);
}

/**
 * Mount a reminder card into `el`. Re-renders itself on every engine change.
 * @param {Element|string} target
 * @param {{ types?: string[], max?: number }} [opts]
 * @returns {{ refresh: () => void, unmount: () => void }}
 */
export function mountReminderStrip(target, { types = PERSISTED_TYPES, max = MAX_VISIBLE } = {}) {
  const mount = resolveMount(target);
  const noop = { refresh() {}, unmount() {} };
  if (!mount) return noop;

  let expanded = false;
  let detach = () => {};
  let unsubscribe = () => {};

  function render() {
    let items = [];
    try {
      items = listActionable({ types });
    } catch (err) {
      warn('list failed', err);
    }
    if (items.length === 0) {
      mount.replaceChildren();
      expanded = false;
      return;
    }
    const shown = expanded ? items : items.slice(0, max);
    const hidden = items.length - shown.length;

    const list = el('ul', { class: 'reminder-list' }, shown.map(buildItem));
    const card = el('section', { class: 'usm-card reminder-card', 'aria-label': COPY.panelTitle }, [
      el('h2', { class: 'reminder-card__title', text: items.length === 1 ? COPY.one : COPY.couple }),
      list,
    ]);
    if (hidden > 0) {
      const more = el('button', { type: 'button', class: 'reminder-card__more', text: COPY.more });
      more.addEventListener('click', () => {
        expanded = true;
        render();
        const next = mount.querySelectorAll('.reminder-item')[max];
        next?.querySelector('button')?.focus();
      });
      card.appendChild(more);
    }
    mount.replaceChildren(card);
  }

  try {
    detach = attachSurface({ types });
    unsubscribe = subscribeReminders(render);
    render();
    startEvaluating().catch((err) => warn('evaluate failed', err));
  } catch (err) {
    // Never block a page on this system.
    warn('strip could not mount', err);
    mount.replaceChildren();
  }

  return {
    refresh: render,
    unmount() {
      unsubscribe();
      detach();
      mount.replaceChildren();
    },
  };
}

/* ─────────────────────────────── preferences ─────────────────────────────── */

function switchRow({ id, label, checked, note, disabled = false, onChange }) {
  const input = el('input', { type: 'checkbox', id, checked, disabled });
  if (onChange) input.addEventListener('change', (e) => onChange(e.target.checked, input));
  const text = el('span', { class: 'reminder-switch__text' }, [
    el('span', { class: 'reminder-switch__label', text: label }),
    note ? el('span', { class: 'reminder-switch__note', text: note }) : null,
  ]);
  return el('label', { class: 'reminder-switch', for: id }, [input, text]);
}

function buildPrefsPanel(mount) {
  const panelId = 'reminderPrefsPanel';
  const toggle = el('button', {
    type: 'button',
    class: 'usm-btn usm-btn--ghost reminder-prefs__toggle',
    'aria-expanded': 'false',
    'aria-controls': panelId,
    text: COPY.panelTitle,
  });
  const panel = el('section', { class: 'usm-panel reminder-prefs__panel', id: panelId, 'aria-labelledby': `${panelId}Title` });
  const title = el('h2', { class: 'reminder-prefs__title', id: `${panelId}Title`, text: COPY.panelTitle });

  function open() {
    panel.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    renderPanel();
    panel.querySelector('input')?.focus();
  }
  function close({ restoreFocus = true } = {}) {
    panel.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => (panel.classList.contains('is-open') ? close() : open()));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  function renderPanel() {
    const prefs = getPrefs();
    const browser = getNotifier('browser');
    const body = el('div', { class: 'reminder-prefs__body' });

    // 1. The global switch, first and alone.
    body.append(
      switchRow({
        id: 'rmdOn', label: COPY.onLabel, checked: prefs.enabled, note: COPY.honest,
        onChange: (on) => { setPrefs({ enabled: on }); renderPanel(); panel.querySelector('#rmdOn')?.focus(); },
      }),
    );

    if (prefs.enabled) {
      // 2. What to mention.
      const what = el('fieldset', { class: 'reminder-prefs__group' }, [el('legend', { text: COPY.whatLegend })]);
      for (const [type, def] of Object.entries(REMINDER_TYPES)) {
        what.appendChild(switchRow({
          id: `rmdType_${type}`, label: def.label, checked: prefs.types[type] !== false,
          onChange: (on) => setPrefs({ types: { [type]: on } }),
        }));
      }
      body.appendChild(what);

      // 3. Where. In-app is the floor; browser is the one real choice.
      const browserNote = el('span', { class: 'reminder-switch__note', 'aria-live': 'polite', text: prefs.channels.browser ? COPY.browserOn : '' });
      const where = el('fieldset', { class: 'reminder-prefs__group' }, [
        el('legend', { text: COPY.whereLegend }),
        switchRow({ id: 'rmdInApp', label: 'Here on the site', checked: true, disabled: true, note: COPY.inAppNote }),
      ]);
      const browserRow = switchRow({
        id: 'rmdBrowser', label: browser ? browser.label : 'Browser notifications', checked: prefs.channels.browser,
        onChange: async (on, input) => {
          // The ONLY place permission is ever requested, and only inside this click.
          if (!on || !browser) { setPrefs({ channels: { browser: false } }); browserNote.textContent = ''; return; }
          input.disabled = true;
          try {
            if (!(await browser.isAvailable())) {
              input.checked = false;
              browserNote.textContent = COPY.browserUnsupported;
              return;
            }
            const result = await browser.requestPermission();
            if (result === 'granted') {
              setPrefs({ channels: { browser: true } });
              browserNote.textContent = COPY.browserOn;
            } else {
              input.checked = false;
              browserNote.textContent = result === 'unsupported' ? COPY.browserUnsupported : COPY.browserDenied;
            }
          } catch (err) {
            warn('browser permission flow failed', err);
            input.checked = false;
          } finally {
            input.disabled = false;
          }
        },
      });
      browserRow.querySelector('.reminder-switch__text').appendChild(browserNote);
      where.appendChild(browserRow);
      body.appendChild(where);

      // 4. Quiet hours.
      const start = el('input', { type: 'time', class: 'usm-input reminder-time', id: 'rmdQuietStart', value: prefs.quietHours.start });
      const end = el('input', { type: 'time', class: 'usm-input reminder-time', id: 'rmdQuietEnd', value: prefs.quietHours.end });
      const saveQuiet = () => {
        if (start.value && end.value) setPrefs({ quietHours: { start: start.value, end: end.value } });
      };
      start.addEventListener('change', saveQuiet);
      end.addEventListener('change', saveQuiet);
      body.appendChild(el('fieldset', { class: 'reminder-prefs__group' }, [
        el('legend', { text: COPY.quietLegend }),
        el('div', { class: 'reminder-quiet' }, [
          el('label', { class: 'reminder-quiet__field', for: 'rmdQuietStart' }, [el('span', { text: COPY.from }), start]),
          el('label', { class: 'reminder-quiet__field', for: 'rmdQuietEnd' }, [el('span', { text: COPY.to }), end]),
        ]),
        el('p', { class: 'reminder-prefs__note', text: COPY.quietNote }),
      ]));
    }

    panel.replaceChildren(title, body);
  }

  mount.replaceChildren(el('div', { class: 'reminder-prefs' }, [toggle, panel]));
}

/**
 * The For You hub: the card for every persisted type (never Rhythm — that
 * page's state stays behind its passphrase) and the closed-by-default
 * "Reminders" panel at the bottom.
 * @param {{ strip: Element|string, prefs: Element|string }} mounts
 */
export function initReminders({ strip, prefs } = {}) {
  try {
    mountReminderStrip(strip, { types: PERSISTED_TYPES });
  } catch (err) {
    warn('strip failed', err);
  }
  try {
    const mount = resolveMount(prefs);
    if (mount) buildPrefsPanel(mount);
  } catch (err) {
    warn('preferences failed', err);
  }
}
