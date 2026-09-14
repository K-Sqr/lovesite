# 11 — Notifications & Reminders

> **A cross-feature system, not a page.** Nothing here renders a tool. You are building the one
> piece of plumbing Rhythm, People, the Application Desk, What to Wear, and the date nudges share,
> plus exactly one visible surface on the For You hub.

**Recommended tool:** Claude Code. **Model:** a strong reasoning model.
The code volume is small; the hard parts are the delivery-level analysis, the privacy boundary
around Rhythm, and an adapter seam that still holds when a second channel is added months later.
That is judgement work, not typing.

---

## Context

From `01-REPOSITORY-AUDIT.md`, the facts that constrain every decision below:

- **Static site on GitHub Pages** at `https://k-sqr.github.io/lovesite/`, Vite `base: '/lovesite/'`.
  There is no application server.
- **No service worker, no PWA manifest.** Nothing runs when the tab is closed.
- **One Cloud Function** (`functions/index.js`, `lovegpt`, `onRequest`, `us-central1`). It is an
  HTTP endpoint. No scheduler, no cron, no queue exists.
- **CSP is `default-src 'self'`** with an explicit `connect-src` allow-list, duplicated verbatim in
  every HTML file. A new host means editing every page's `<meta http-equiv>` tag.
- **`getAnalytics(app)` fires on every page importing `src/modules/firebase.js`.** Reminder
  behaviour must never reach it.
- **localStorage is shared across the whole `k-sqr.github.io` origin**, not the `/lovesite/` path;
  `storage.js` namespaces keys `usm.*`.
- **Five of six new tools are local-only by design.** Rhythm sits behind a PBKDF2 + AES-GCM
  passphrase whose key is never persisted (`04-SHARED-FOUNDATIONS.md` R3b).

Features that want to emit reminders:

| Feature | Prompt | Reminder |
| --- | --- | --- |
| Rhythm | `09-PERIOD-TRACKER.md` | predicted window opening in a few days |
| People | `08-FRIENDS-FAMILY.md` | check-in nudge, birthday coming up |
| The Application Desk | `07-JOB-APPLICATION-STUDIO.md` | deadline, interview, follow-up |
| What to Wear | `10-OUTFIT-OF-THE-DAY.md` | morning outfit nudge |
| Dates | this file | anniversary (Sep 13), birthdays via People |

And the principle that overrides all of it: **reduce mental load, don't create another app she has
to maintain.** A notification system is the easiest way in this whole project to violate that.
Build it like someone who is suspicious of it.

## Objective

Ship **Level 1 (in-app reminders) properly**, behind an adapter seam clean enough that Level 2 is an
afternoon's work and Levels 3–4 never require touching feature code. Concretely: an engine, an
adapter registry with one real adapter and one gated stub, preferences whose defaults are "nearly
everything off", one calm surface on the For You hub, and a mount function feature pages call.

## Prerequisites

- `01-REPOSITORY-AUDIT.md` read.
- `02-DESIGN-SYSTEM.md` **complete** — `ui.css` (`.usm-card`, `.usm-btn`, `.usm-panel`, `.usm-pill`,
  `.usm-empty`, `.usm-tone--*`) and the semantic tone tokens.
- `04-SHARED-FOUNDATIONS.md` **complete** — `storage.js` (`createStore`), `dates.js`
  (`daysBetween`, `startOfDay`, `toISO`, `parseISO`, `addDays`, `formatRelativeGentle`),
  `reveal.js`, and `foryou.html` / `src/foryou.js`.
- You do **not** need `07`–`10`. This ships standalone with date reminders as its only producer;
  the other features wire themselves in later.

## Existing Files To Inspect

- `src/modules/storage.js` — the `createStore(name, { version, migrate, encrypted })` contract and
  its fail-soft behaviour. You consume this file; you do not author it.
- `src/modules/dates.js` — especially `formatRelativeGentle`, whose tone rules you must not
  duplicate or contradict.
- `src/modules/musicPlayer.js` — the `.music-popup` pattern (fixed bottom, `z-index: 999`,
  `.active`, 8s auto-dismiss, once-per-session flag). Your adapter must not fight it for the bottom
  of the screen.
- `src/foryou.js`, `foryou.html` — the hub you add one card and one panel to.
- `src/styles/ui.css` — every primitive you may use. `src/styles/animations.css` — the
  `.reveal`/`.visible` contract and the `prefers-reduced-motion` block.
- `index.html` — the CSP meta tag, so you can see what you may not call.
- `functions/index.js` — proof that the one function is an HTTP handler with no scheduler, before
  you consider Level 3.

## Files You Own (Create)

```
src/modules/reminders.js          engine: register, cancel, evaluate, dedupe, deliver
src/modules/notifiers/index.js    adapter registry + the interface contract
src/modules/notifiers/inApp.js    Level 1 — the only adapter enabled by default
src/modules/notifiers/browser.js  Level 2 — implemented, registered, DEFAULT OFF
src/modules/reminderUI.js         hub card, strip mount, preferences panel
src/styles/reminders.css          styles, built only from ui.css primitives
```

## Files You May Modify

```
foryou.html     two empty mount elements (R6). Nothing else.
src/foryou.js   one import, one init call. Nothing else.
DOCS.md         the modules, the usm.* keys, the delivery-level decision
```

## Files You Must Not Touch

**Every feature page and its entry module.** `rhythm.html`, `people.html`, `applications.html`,
`outfit.html`, `letters.html`, `anniversary.html` and their `src/*.js` entries belong to prompts
`06`–`10` and `12`. You export `mountReminderStrip()`; **they** call it. If you are editing a tool
page you have misread this file.

Also untouchable: `storage.js` · `dates.js` · `reveal.js` · `siteChrome.js` ·
`{musicPlayer,theme,buttons,graffiti,textReveal,verses,loveCounter,firebase,auth}.js` ·
`src/data/**` · `src/styles/{base,ui,animations,sections,memories,timeline-page,lovegpt,foryou}.css` ·
`index.html`, `timeline.html`, `memories.html`, `lovegpt.html` · `functions/**` ·
`firestore.rules` · `storage.rules` · `vite.config.js`.

---

## Requirements

### R1 — Delivery levels: analysis and decision

Record this in short form in `DOCS.md` too. It is why the architecture looks the way it does, and
without it the next person will "improve" it into a push service.

**Level 1 — in-app reminders. EASY. This is what you build.** A queue in localStorage, evaluated on
page load and `visibilitychange`, surfaced as calm inline cards on the For You hub and the relevant
tool page. No permissions, no server, no new host, no CSP change, nothing to install; works in every
browser including iOS Safari. It is genuinely useful *because she will open the site* — this is a
gift she is expected to visit, not a background utility. Be honest about the limit: **it only works
when she opens it.** A period-window reminder she never sees is not a reminder. Level 1 does not fix
that, and pretending otherwise in the copy would be worse than the gap.

**Level 2 — Browser Notification API. EASY-to-MODERATE, with one decisive caveat.** Mechanically
small: `Notification.requestPermission()`, then `new Notification(title, { body })`. No server, no
CSP change (it is not a `connect-src` fetch). Two limits matter more than the ease:

1. Without a service worker and Push it **only fires while the page is open**. Over Level 1 that
   buys surfacing a reminder while she is on another tab, and roughly nothing else.
2. **On iOS/iPadOS Safari the Notification API is only available once the site is installed to the
   Home Screen as a PWA.** Not degraded — absent; `window.Notification` does not exist in a normal
   Safari tab. So Level 2 requires her to install the site, which requires a manifest, which
   requires explaining Add to Home Screen to her. **Assume she is on an iPhone.** Under that
   assumption plain Level 2 buys almost nothing while the permission prompt costs real goodwill.
   Do not hand-wave this. Ship the adapter, register it, default it off, and turn it on only after
   he has physically checked her device.

**Level 3 — Email. MODERATE, and disqualified on privacy rather than difficulty.** It needs a
Firebase **Scheduled Function** (Blaze plan + Cloud Scheduler — the project can do this, but it is
new infrastructure with billing attached), an email provider (Resend/SendGrid — a new Functions
secret), and **the reminder set persisted server-side**, because a scheduler cannot read
localStorage. That third piece is the killer: **it means the reminder data leaves her device.** The
whole local-only model — five of six tools never touching the network, Rhythm's key never written to
disk — exists so her data stays hers. Uploading a reminder table so a cron job can email her about
it inverts that. For Rhythm it is **categorically unacceptable**: nothing derived from cycle data
may reach a server in any form, including a bare date. If email is ever built, it may carry only
**content-free** nudges — literally "a reminder from Us Machina", content living behind opening the
site — and never cycle, health, or third-party personal data. Put that constraint in `DOCS.md` now
so it is a rule and not a later argument.

**Level 4 — true scheduled push. COMPLEX. Defer explicitly.** Service worker + Web Push/FCM + VAPID
keys + server-persisted subscriptions + a scheduler, plus the same iOS install requirement. This is
the single biggest infrastructure jump in the project: a service worker that caches aggressively and
makes `npm run dev` lie to you, a server-side data store, a billing dependency, and a subscription
lifecycle to debug. **Recommend deferring it, in writing.** Nothing about "he knows me" is delivered
by a push notification.

**The decision, plainly:**
> Build Level 1 properly with a clean adapter seam. Ship Level 2 opt-in, default off, enabled only
> after checking her device. Do not build Level 3 or 4 for the anniversary. **Adding a channel later
> must not require touching a single line of feature code** — if a future channel needs Rhythm or
> People to change, the abstraction has failed.

### R2 — The reminder record

One shape, written by the engine only. Features never construct storage rows.

```js
/** @typedef {'rhythm'|'checkin'|'birthday'|'application'|'outfit'|'date'} ReminderType */
/** @typedef {'pending'|'due'|'delivered'|'snoozed'|'dismissed'|'cancelled'} ReminderStatus */
/** @typedef {'in-app'|'browser'|'email'|'push'} DeliveryMethod */

/**
 * The only shape persisted by this system.
 * `title` and `body` may be rendered by the browser adapter, which draws on a LOCK SCREEN.
 * Treat both as public strings. See "Privacy & Security".
 */
const exampleReminder = {
  id: 'rmd_7f3a91',          // stable for the life of the record
  type: 'checkin',           // drives preferences, tone, and channel policy
  sourceId: 'person_04',     // opaque id owned by the emitting feature.
                             // NEVER a name, email, company, or free text.
  title: 'Maybe say hi to Mom today? \u2764\uFE0F',
  body: "It's been a little while.",
  scheduledAt: '2026-09-20T13:00:00.000Z',  // ISO — when it becomes due
  createdAt: '2026-09-13T18:04:11.412Z',    // ISO
  status: 'pending',
  deliveryMethod: null,      // set by the engine on delivery
  snoozedUntil: null,        // ISO or null
  dismissedAt: null,         // ISO or null
};
```

Status transitions, and no others:

```
pending → due        (scheduledAt <= now)      due       → snoozed   (she tapped "later")
due     → delivered  (an adapter returned true) snoozed  → due       (snoozedUntil <= now)
delivered → dismissed ("got it", or aged out)   *        → cancelled (source withdrew it)
```

`cancelled` and `dismissed` records are kept for `DEDUPE_WINDOW_DAYS = 30` so the engine will not
re-raise something she already waved off, then pruned. Nothing accumulates forever.

### R3 — The engine (`src/modules/reminders.js`)

Stores: `createStore('reminders', { version: 1 })` → `usm.reminders.v1`;
`createStore('reminderPrefs', { version: 1 })` → `usm.reminderPrefs.v1`.

```js
export function registerReminder({ type, sourceId, title, body, scheduledAt });  // → id
export function cancelReminder(id);
export function cancelBySource(type, sourceId);   // idempotent; used when a source is deleted
export function evaluateReminders({ now = new Date() } = {});   // → delivered count
export function listActionable({ types, max });   // → Reminder[] ready to show
export function snoozeReminder(id, untilISO);
export function dismissReminder(id);
export function getPrefs(); export function setPrefs(patch);
export function subscribeReminders(fn);           // re-render on change, incl. other tabs
```

Engine responsibilities, all of them:

1. **Register/cancel** for features. `registerReminder` is **upsert by `(type, sourceId, calendar
   day of scheduledAt)`** — features will call it on every page load and that must not create
   duplicates. This is the likeliest bug in the file; write and test it first.
2. **Evaluate** on `DOMContentLoaded` and on `visibilitychange` when the document becomes visible,
   debounced to `EVALUATE_MIN_GAP_MS = 60_000`. No `setInterval`, no polling.
3. **Dedupe.** Never surface a `(type, sourceId)` pair more than once per `MIN_GAP_HOURS = 20`, and
   never re-raise something dismissed inside `DEDUPE_WINDOW_DAYS`.
4. **Quiet hours**, default `21:30`–`08:00` local. Due items inside the window stay `due` and go out
   at the next evaluation after it. In-app cards are exempt while she is actively on the site — she
   opened it; she is not being interrupted.
5. **Per-type preferences.** A disabled type is not evaluated at all, not evaluated-then-hidden.
6. **Frequency caps:** `MAX_VISIBLE = 2` items at once, `MAX_PER_DAY = 3` deliveries total. When
   more are due, show the two most time-relevant plus one line — *"a couple of other things are
   waiting whenever you want them"* — a link, never a list, never a number that reads as a backlog.
7. **Hand due items to enabled adapters** in registry order, stopping at the first returning `true`,
   and record which in `deliveryMethod`.

One source of truth for types and channel policy:

```js
export const REMINDER_TYPES = {
  rhythm:      { label: 'Rhythm',       defaultEnabled: true,  channels: ['in-app'] },
  checkin:     { label: 'People',       defaultEnabled: true,  channels: ['in-app', 'browser'] },
  birthday:    { label: 'Birthdays',    defaultEnabled: true,  channels: ['in-app', 'browser'] },
  application: { label: 'Applications', defaultEnabled: true,  channels: ['in-app', 'browser'] },
  outfit:      { label: 'What to Wear', defaultEnabled: false, channels: ['in-app'] },
  date:        { label: 'Our dates',    defaultEnabled: true,  channels: ['in-app', 'browser'] },
};
```

`channels` is a hard allow-list enforced in the engine, not a hint. `rhythm` can only ever reach
`in-app`.

**Date reminders are the one producer this task owns.** Seed the anniversary from a local
`const RELATIONSHIP_START = '2025-09-13';` — the same date as `loveCounter.js`'s
`new Date(2025, 8, 13)`. Duplicating the constant is correct; **do not modify `loveCounter.js`**
(`04` forbids it). Birthdays belong to People (`08`) and are registered there, not hardcoded here.

### R4 — Adapters (`src/modules/notifiers/`)

One interface, four members. No adapter knows what a reminder means.

```js
/**
 * @typedef {Object} Notifier
 * @property {string} id     'in-app' | 'browser' | 'email' | 'push'
 * @property {string} label  shown in preferences, in her language
 * @property {() => Promise<boolean>} isAvailable
 *   Can this channel work in THIS browser right now? No prompting, no side effects.
 * @property {() => Promise<'granted'|'denied'|'unsupported'>} requestPermission
 *   Called ONLY from a user gesture in the preferences panel. Never on load.
 * @property {(reminder: Reminder) => Promise<boolean>} deliver
 *   true = shown. false = could not show; the engine falls through to the next adapter.
 */

export const inAppNotifier = {
  id: 'in-app',
  label: 'Here on the site',
  async isAvailable() { return true; },
  async requestPermission() { return 'granted'; },
  async deliver(reminder) { /* render a card; return whether a surface existed */ },
};
```

`notifiers/index.js` exports `registerNotifier(n)` and `getEnabledNotifiers()`, and registers
`inApp` and `browser` at module load. Adding `email.js` or `push.js` later is: write the file,
register it, add its id to the relevant `channels` arrays. **No feature file changes.** Say that in
a comment at the top of `index.js`.

`browser.js`: `isAvailable()` is `'Notification' in window`, which is correctly `false` in an
uninstalled iOS Safari tab — do not paper over that with a `try`/`catch` that lies. `deliver()`
returns `false` unless permission is `'granted'`, so the engine falls through to in-app. Put the iOS
Home-Screen requirement in a top-of-file comment so nobody debugs it twice.

### R5 — Preferences

```js
const DEFAULT_PREFS = {
  enabled: true,                       // the global switch
  channels: { 'in-app': true, browser: false, email: false, push: false },
  types: { rhythm: true, checkin: true, birthday: true, application: true,
           outfit: false, date: true },
  quietHours: { start: '21:30', end: '08:00' },
  maxPerDay: 3,
};
```

**Default state is everything off except in-app.** Non-negotiable:

- **Nothing asks permission on first load.** No `Notification.requestPermission()` outside a click
  handler in the preferences panel. A permission prompt on page one is exactly the app-spam feeling
  this product is a reaction against.
- `enabled: false` means **off**: no cards, no evaluation, no adapter calls, and no "reminders are
  paused, tap to resume" nag. Turning it back on must not replay a backlog — discard anything that
  came due while off.
- Preferences live in a `.usm-panel` disclosure at the bottom of the For You hub, closed by default,
  labelled *"Reminders"*. Not a settings page with tabs (`04` forbids that), not a gear in the nav.

### R6 — Surfaces

Two mount points in `foryou.html`, both empty in the HTML:

```html
<div id="reminderStrip"></div>
<div id="reminderPrefs"></div>
```

`src/foryou.js` gains one import and one call —
`initReminders({ strip: '#reminderStrip', prefs: '#reminderPrefs' })`. That is the complete diff to
files you do not own.

For tool pages, export `mountReminderStrip(el, { types, max = 2 })` from `reminderUI.js`. Feature
prompts call it with their own type; document it in `DOCS.md` and **do not call it from any page
yourself.** A strip with nothing due renders **nothing** — zero height, no empty state, no "you're
all caught up!" card. Absence is the correct calm state.

## UX Requirements

- **One card, never a list.** At most two items, inside a single `.usm-card` reading *"A couple of
  things"*. She must never see a wall of reminders.
- **Two actions per item, both gentle:** *"Got it"* (dismiss) and *"Later"* (snooze). "Later" uses a
  sensible per-type interval — 1 day for `checkin`, 1 hour for `outfit`, 1 day for `application` —
  with no dialog asking her to pick a duration.
- **Tone.** This voice and nowhere else: *"Maybe say hi to Mom today? ❤️"* · *"David's birthday is
  coming up."* · *"It's been a little while."* · *"Something to keep an eye on this week."*
- **Forbidden strings, and this belongs in a test:** *"You are behind."*, *"You haven't…"*,
  *"Don't forget!"*, *"overdue"*, *"late"*, *"should"*, *"streak"*, *"N reminders"*, any unread
  count, red dot, nav badge, or progress ring. A notification here is a thoughtful person mentioning
  something in passing, not an app demanding attention.
- Tone tokens only: `--tone-soon` for "coming up", `--tone-waiting` for "it's been a while".
  **No red, amber, or traffic-light semantics** (`02` §8.1). Always pair a tint with a word or
  emoji — colour alone is not a state.
- 44px targets, `:focus-visible` rings, Tab to each action, Enter/Space activates, Escape closes the
  prefs panel and returns focus to its disclosure button.
- Works at 375px one-handed. Under `prefers-reduced-motion: reduce` the card appears with no
  animation and reads identically.
- Render **inline in the page flow**, not as a floating toast — both because `.music-popup` already
  owns the bottom of the screen at `z-index: 999`, and because inline is calmer.

## Technical Requirements

- TypeScript / one UI framework / justified dependencies allowed per `RUN-SHEETS.md` Stack
  policy. Still no service worker and no permission prompt on load.
- No new network host, therefore **no CSP edit**. If you think you need one you have drifted into
  Level 3.
- All persistence through `storage.js`; no direct `localStorage` in your files. All date maths
  through `dates.js`; no `days / 30.44`, no `ms / 86400000`.
- No `setInterval`. `DOMContentLoaded` + `visibilitychange` only.
- `textContent` for anything derived from her data. `buttons.js` and `verses.js` use template
  `innerHTML`, but only with static content; reminder bodies must not follow that pattern.
- One `warn()` helper; no stray `console.log`.
- Fail soft: if the store is unavailable (Safari private mode, quota) the site loads normally and
  reminders are simply absent. **Never block a page on this system.**

## Privacy & Security

1. **A record may reference a source by id and must never embed sensitive content.** `sourceId` is
   opaque. `title` and `body` are lock-screen-visible strings. A Rhythm body is *"Something to keep
   an eye on this week."* — never a phase, a date, a symptom, or the words "period" or "cycle". Hard
   requirement, with an acceptance test, because the browser adapter renders `body` on a lock screen
   that anyone standing nearby can read.
2. **Rhythm reminders do not go in the general store.** Analysis: a row in `usm.reminders.v1` would
   sit in plaintext localStorage naming `type: 'rhythm'` with a real `scheduledAt`, so anyone with
   her unlocked laptop and DevTools — the exact threat the passphrase exists for — could read her
   cycle dates. **Rejected.** Therefore Rhythm reminders live in the **encrypted** store owned by
   `09-PERIOD-TRACKER.md` (`createStore('rhythmReminders', { version: 1, encrypted: true })`), and
   Rhythm hands them to the engine at unlock time through a runtime-only `registerEphemeral(reminder)`
   path the engine holds **in memory and never writes**. State the honest consequence in the code
   and `DOCS.md`: Rhythm reminders appear **only inside `rhythm.html` after she enters her
   passphrase** — never on the For You hub (`04` already forbids Rhythm state there), never as a
   browser notification. That is a real loss of usefulness and it is the right trade; if it proves
   too weak the fix is a better in-page surface, not a plaintext row. Enforce it structurally via
   `REMINDER_TYPES.rhythm.channels === ['in-app']`, with the engine dropping (and warning on) any
   other channel handed a `rhythm` reminder.
3. **Nothing leaves the device.** No `fetch`, `sendBeacon`, analytics event, or Firebase import in
   any file you own. `getAnalytics()` already fires on pages importing `firebase.js`; your modules
   must not become a new reason for it to see anything.
4. Reminder text must not carry third-party personal data beyond what People already stores
   locally — and even then, first name only in a title, never a phone number or address.
5. `export()` from the store is fine (local, hers). Do not add "email me my reminders" or any sync
   affordance.

## Do Not

- **Do not add a service worker.** Not for caching, not for offline, not "to prepare for push". It
  caches aggressively and will make `npm run dev` lie to you. `04` deferred this to here; here
  defers it again.
- **Do not add a PWA manifest** in this task. If a future Level 2/4 task adds one, note now that
  `base: '/lovesite/'` means `scope` and `start_url` must both be `/lovesite/` — a manifest at the
  origin root silently fails to match — and that installability changes how every page loads.
- Do not build Level 3 or 4: no scheduler, no second Cloud Function, no Firestore collection, no
  `firestore.rules` block.
- Do not add a notification bell, unread badge, red dot, nav count, streak, or "you have N
  reminders" line. `04` names the bell-with-a-badge as one of six ways this becomes a dashboard.
- Do not create a settings page; the prefs panel lives on the hub.
- Do not call `Notification.requestPermission()` outside an explicit click handler.
- Do not edit any feature page, `vite.config.js`, or any HTML file other than `foryou.html`.
- Do not use guilt language, productivity phrasing, KPI cards, extra gradients, or extra hearts.
  One ❤️ in one string is the ceiling.

## Implementation Strategy

1. **`reminders.js` pure core first**, with an injected `now`: record shape, status machine,
   upsert-by-`(type, sourceId, day)`, dedupe, quiet hours, caps. Drive it from the DevTools console
   with a fake clock before any UI exists. This is where the bugs are, and it is worth more than
   steps 2–7 combined.
2. `notifiers/index.js` + `inApp.js`, delivering into a plain unstyled `<div>`.
3. `reminderUI.js` + `reminders.css` from `.usm-card` / `.usm-btn` / `.usm-tone--*`, no new visual
   language.
4. The prefs panel in `.usm-panel`, global off switch working before the per-type switches.
5. Date reminders as the first real producer (anniversary from `RELATIONSHIP_START`).
6. `browser.js`, registered, default off, with the iOS comment. Verify `isAvailable()` on a real iOS
   tab if possible; otherwise verify by feature detection and say so in the PR.
7. Wire the hub. Confirm `git diff foryou.html src/foryou.js` is under 10 lines.
8. `DOCS.md`: modules, keys, the level analysis, the Rhythm exception, and the
   `mountReminderStrip()` contract that `07`–`10` will call.

Commit after each step.

## Acceptance Criteria

1. `npm run build` succeeds; `package.json` has no new dependency.
2. `grep -rn "fetch(\|sendBeacon\|firebase" src/modules/reminders.js src/modules/notifiers/ src/modules/reminderUI.js` → nothing.
3. `grep -rn "localStorage\|sessionStorage"` across the same files → nothing.
4. Calling `registerReminder()` twenty times with the same `(type, sourceId, day)` leaves **exactly
   one** record in `usm.reminders.v1`.
5. With `enabled: false`: no DOM node, no adapter call, no storage write beyond the preference.
   Re-enabling does not replay what came due while off.
6. On a fresh profile, loading `/lovesite/foryou.html` triggers **no** permission prompt, and
   `usm.reminderPrefs.v1` shows `channels.browser === false`.
7. Five due reminders render **one** card with **two** items plus a single non-numeric overflow line.
8. **Privacy:** register a `rhythm` reminder via the ephemeral path — `usm.reminders.v1` contains no
   `rhythm` record. Separately, no reminder `title` or `body` matches
   `/period|cycle|ovulat|flow|symptom|fertile/i`.
9. **Channel policy:** delivering a `rhythm` reminder via `browser` is refused *by the engine*, and
   that refusal is what the test observes — not the adapter's own permission check.
10. `browser.isAvailable()` is `false` when `window.Notification` is deleted; `deliver()` then
    returns `false` and the engine falls through to in-app without throwing.
11. Quiet hours: an item due at 23:00 local is not delivered by the browser adapter then, and is
    delivered at the first evaluation after 08:00.
12. `grep -rniE "you haven't|you are behind|don't forget|overdue|days late|streak|unread" src/modules/reminderUI.js src/modules/reminders.js` → nothing.
13. With `prefers-reduced-motion: reduce` the card is fully visible and nothing animates.
14. Keyboard-only: Tab reaches "Got it" and "Later" with a visible ring; Escape closes the panel and
    restores focus.
15. At 375px the card and both buttons fit with no horizontal scroll; every target ≥44px.
16. Blocking storage entirely leaves `foryou.html` fully functional, with no reminder UI and no
    console error.
17. `git diff --stat` shows only `foryou.html`, `src/foryou.js`, `DOCS.md`, and the six created
    files — nothing in `src/data/`, no other HTML, no `vite.config.js`.
18. No service worker file and no `manifest.webmanifest` / `manifest.json` anywhere in the repo.

## Verification

```bash
npm run dev        # http://localhost:5173/lovesite/foryou.html
npm run build && npm run preview
grep -rn "Notification" src/                       # only notifiers/browser.js
grep -rn "requestPermission" src/                  # browser.js + one click handler in reminderUI.js
grep -rn "setInterval" src/modules/reminders.js    # → nothing
grep -rn "30.44" src/modules/                      # → only loveCounter.js (pre-existing, untouched)
ls src/modules/notifiers/ && git diff --stat
```

In the console on `foryou.html` — the engine takes `now`, so there is no waiting:

```js
const r = await import('/src/modules/reminders.js');
r.registerReminder({ type: 'date', sourceId: 'anniv-2026',
  title: 'One year tomorrow.', body: '', scheduledAt: '2026-09-12T13:00:00.000Z' });
r.evaluateReminders({ now: new Date('2026-09-12T14:00:00Z') });  // delivers
r.evaluateReminders({ now: new Date('2026-09-12T14:30:00Z') });  // dedupes, delivers nothing
r.evaluateReminders({ now: new Date('2026-09-12T23:30:00Z') });  // quiet hours
```

Then: DevTools → Application → Local Storage shows only `aho_theme`, `usm.reminders.v1`,
`usm.reminderPrefs.v1`. Dismiss a card in a second tab and watch the first update via `subscribe`.
DevTools → Rendering → *Emulate prefers-reduced-motion: reduce*. Run `delete window.Notification`,
re-evaluate, confirm graceful fall-through. Flip the global off switch, reload, see nothing.

## Definition of Done

- [ ] `src/modules/reminders.js` — record shape, status machine, upsert, dedupe, quiet hours, caps
- [ ] `src/modules/notifiers/{index,inApp,browser}.js` — one interface, in-app on, browser off
- [ ] `src/modules/reminderUI.js` — hub card, `mountReminderStrip()`, prefs panel
- [ ] `src/styles/reminders.css` — only `ui.css` primitives and existing tokens
- [ ] `usm.reminders.v1` + `usm.reminderPrefs.v1` via `storage.js`; defaults everything off except
      in-app
- [ ] Rhythm reminders excluded from the general store and hard-limited to `in-app`
- [ ] `foryou.html` + `src/foryou.js` diff under 10 lines; no feature page touched
- [ ] No service worker, manifest, CSP change, new dependency, or new Firebase surface
- [ ] All 18 acceptance criteria verified
- [ ] `DOCS.md` records the modules, the `usm.*` keys, the four-level analysis with its
      recommendation, the "email may never carry Rhythm data" rule, and the `mountReminderStrip()`
      contract for prompts `07`–`10`
