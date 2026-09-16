# Us Machina — Project Documentation

> *love in the machine*

## Table of Contents

- [Overview](#overview)
- [Origin Story](#origin-story)
- [Architecture](#architecture)
- [Pages](#pages)
- [JavaScript Modules](#javascript-modules)
- [Data Files](#data-files)
- [Styling Architecture](#styling-architecture)
- [Reminders](#reminders)
- [Firebase Setup](#firebase-setup)
- [LoveGPT — RAG Pipeline](#lovegpt--rag-pipeline)
- [Security](#security)
- [Deployment](#deployment)
- [Local Development](#local-development)
- [File Tree](#file-tree)

---

## Overview

**Us Machina** is a multi-page romantic web application built with vanilla HTML, CSS, and JavaScript, bundled by Vite. It started as a creative "Will you be my girlfriend?" proposal site and evolved into a full relationship hub with a timeline, photo memories, Bible verse carousel, background music, and a personalized AI chatbot (LoveGPT) powered by Google Gemini and a custom RAG pipeline.

The backend uses **Firebase** (Firestore for data, Storage for images, Cloud Functions for the AI endpoint) on the Spark/Blaze plan.

---

## Origin Story

The site was originally created in September 2025 as a proposal. Emmanuel asked Tolu out by delivering a sermon on Proverbs 18:22, then directing her to a custom-coded website that revealed the question through a sparkle text animation. The site featured a "Yes" and "No" button — the "No" button playfully bounces around the screen to avoid being clicked.

After a successful proposal, the site was upgraded from a one-time artifact into a living relationship hub, rebranded from "ahosite" to **Us Machina** ("love in the machine").

---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│                     GitHub Pages                       │
│  (static hosting at k-sqr.github.io/lovesite/)        │
│                                                        │
│  index.html ──── src/main.js                           │
│  memories.html ─ src/memories.js                       │
│  timeline.html ─ src/timeline-page.js                  │
│  lovegpt.html ── src/lovegpt.js                        │
│                                                        │
│  Shared: src/modules/*.js  src/styles/*.css             │
│          src/data/*.js                                  │
└──────────────┬──────────────────────┬─────────────────┘
               │                      │
               ▼                      ▼
    ┌──────────────────┐   ┌──────────────────────────┐
    │  Firebase Client  │   │  Firebase Cloud Function  │
    │  (Firestore +     │   │  (LoveGPT endpoint)       │
    │   Storage +       │   │                            │
    │   Analytics)      │   │  Gemini 2.5 Flash API      │
    └──────────────────┘   │  + RAG knowledge base       │
                            └──────────────────────────┘
```

- **Build tool**: Vite (multi-page mode)
- **Language**: Vanilla JavaScript (ES modules), CSS3 custom properties
- **Hosting**: GitHub Pages via `gh-pages` npm package
- **Backend**: Firebase (Firestore, Storage, Cloud Functions 2nd gen)
- **AI**: Google Gemini 2.5 Flash via `@google/generative-ai`

---

## Pages ane skeleton

### `index.html` — Home / Proposal

The original proposal page and current landing page. Features:

- **Sparkle text reveal** — letter-by-letter animation asking the question, with a skip button
- **Yes / No buttons** — "Yes" triggers a graffiti celebration; "No" bounces around the screen through 15 zones, showing playful messages, then fades and shows "I still love you"
- **Response section** — appears after answering, shows a heartfelt message
- **Timeline preview** — a capped slice of the `featured` timeline entries (first five + the most recent, max six) rendered as an interactive timeline
- **Photo gallery preview** — latest 6 memories from Firestore in a grid with lightbox
- **Bible verse carousel** — 33 curated verses with prev/next navigation
- **Background music** — toggle play/pause for a love song
- **Love counter** — live stopwatch showing months, days, hours, minutes, seconds since Sep 13, 2025
- **Floating hearts** — ambient animated hearts rising across the page

### `memories.html` — Photo Gallery

A dedicated page for browsing and uploading relationship photos.

- **Gallery grid** — all memories fetched from Firestore, displayed as cards
- **Lightbox** — click any photo to view full-size with caption
- **Upload panel** — drag-and-drop or file picker, client-side image compression (Canvas API), passcode-protected
- **Passcode modal** — SHA-256 hashed client-side, stored in `sessionStorage`

### `timeline.html` — Relationship Timeline

The full story of the relationship with stats and milestones.

- **Stats bar** — four cards derived from real data: days together, calendar duration (`1 yr 0 mo`), moments recorded, photos (or letters)
- **Full timeline** — every entry in `src/data/timeline.js`, grouped under sticky year headings, with type accents, "Read more" disclosures, photo thumbnails + lightbox, a scroll-linked rail fill, and a one-off celebration on the `one-year` entry
- **Dark mode support** — all cards respect the current theme

### `lovegpt.html` — LoveGPT Chat

A personalized AI chatbot page.

- **Starter pills** — pre-written question buttons to get started
- **Chat interface** — message bubbles (user: pink gradient, AI: glass card), typing indicator with animated dots
- **Cloud Function backend** — sends messages to the LoveGPT endpoint, receives AI responses
- **Conversation history** — maintained client-side, capped at 20 messages, sent with each request for context

### `foryou.html` — For You hub

The entrance to the personal tools. One sentence of writing, then a card per tool. Cards are
rendered from the `TOOLS` list in `src/foryou.js`; a tool that has not shipped yet renders as a
plain card marked "Coming soon" (`comingSoon: true`) — flip it when the page lands.

Above the grid sits the one reminder card (`#reminderStrip`) and below it the closed-by-default
"Reminders" preferences panel (`#reminderPrefs`), both mounted by `initReminders()` from
`src/modules/reminderUI.js`. Nothing from Rhythm ever appears here — see [Reminders](#reminders).

### `rhythm.html` — Rhythm

A private, local-only page. Its data lives in `localStorage` under `usm.rhythm.v1` as AES-GCM
ciphertext (key derived from a passphrase the owner supplies at runtime and never stored); it imports
no Firebase module and makes no network requests. Entry `src/rhythm.js`; prediction maths in
`src/modules/cyclePredict.js`; storage in `src/modules/rhythmStore.js`.

Its one reminder ("Something to keep an eye on this week.", three days before the predicted
window) is registered in memory at unlock via `registerEphemeral()` and shown only inside this page;
"Got it" / "Later" are saved inside the `usm.rhythm.v1` ciphertext (`reminders` field). It never
reaches `usm.reminders.v1`, the hub, or a browser notification — see [Reminders](#reminders).

### `people.html` — People

Who she might want to say hi to, without ever being told she has failed anyone. Local-only
(`src/people.js`, `src/modules/peopleStore.js`, `src/data/messageTemplates.js`): no Firebase, no
network, nothing sent to LoveGPT or analytics. Two stores — `usm.people.v1` →
`{ items: Person[] }` and `usm.messageTemplates.v1` → `{ customTemplates: CustomTemplate[] }` — each
in the `{ v, updatedAt, data }` envelope. `Person` is `{ id, name, relationship, lastContactAt
(date-only ISO | null), preferredCadence ('none' | 'weekly' | 'few-weeks' | 'monthly' |
'seasonally'), birthday ({ month, day, year: null } | null), importantDates [{ label, month,
day }], notes, isSnoozedUntil (date-only ISO | null), energyCost ('low' | 'medium' | 'high' |
null), createdAt, updatedAt }`; a name alone is a complete record. `CustomTemplate` is `{ id,
categoryId, text, overrides (default item id like 'thinking-2', or null), createdAt, updatedAt }`
— the defaults stay in the data file and her edits are overrides or additions. Exactly five
derived states (Birthday coming up · It's been a little while · Might be nice soon · Recently caught
up · Snoozed) and nothing escalates past "a little while" — see the comment on `deriveState()`.
The energy selector (Low · A little · Normal · Social today) is a view filter held in
`sessionStorage` as `usm.people.energy`, never a history. Reminders are emitted through a
defensive dynamic import of `src/modules/reminders.js` (owned by 11-NOTIFICATIONS) and are no-ops
until it exists. Backup/Import wrap both stores in one `people-backup-YYYY-MM-DD.json`.

### `applications.html` — The Application Desk

Her job-application prep, made into one tap. Local-only (`src/applications.js`,
`src/modules/applicationsStore.js`, `src/data/applicationsSeed.js`, `src/data/promptTemplates.js`, `src/styles/applications.css`):
no Firebase import, no network requests, nothing sent to LoveGPT or analytics, no passcode. Three
views behind a segmented control — **Prepare** (paste a job description, tick materials, pick tone
and length → one structured Claude prompt with a Copy button that falls back from
`clipboard.writeText` to `execCommand('copy')` to select-the-text), **Materials** (reusable text
blocks), and **Applications** (a calm list ordered by nearest upcoming interview / deadline /
follow-up, dateless records by `updatedAt`, `Rejected`/`Closed` under an "Archived" disclosure and
never counted). Two stores, each in the `{ v, updatedAt, data }` envelope: `usm.materials.v2` →
`{ items: Material[], templateOverrides: { [templateId]: body } }` where `Material` is `{ id
('mat_…' or 'mat_seed_…'), label, kind ('resume' | 'coverLetter' | 'blurb' | 'references' | 'other'), body,
updatedAt }`; and `usm.applications.v2` → `{ items: Application[] }` where `Application` is `{ id
('app_…' or 'app_seed_…'), organization, position, url, jobDescription, deadline (date-only ISO | null),
discoveredAt, appliedAt (| null), status (Saved · Preparing · Ready · Applied · Interview ·
Follow-up · Offer · Rejected · Closed), resumeUsed / coverLetter / referencesUsed (material id |
null), interviewAt (full ISO | null), followUpAt (date-only | null), notes, outcome (| null),
updatedAt }`. First visit is seeded from `src/data/applicationsSeed.js` (her resumes, cover letters,
and a few real postings) so the desk is not empty; a migrate from v1 merges those records by id and
does not duplicate. Prompt defaults live in `promptTemplates.js` (every template tells Claude not to
invent experience); her edits are `templateOverrides`. Reminder records
(`applications:<id>:deadline|interview|followup`) go through a lazy `import.meta.glob` of
`src/modules/reminders.js` (owned by 11-NOTIFICATIONS) and are no-ops until it exists — the
contract is documented at the top of `applicationsStore.js`. Export/Import wrap both stores in one
`application-desk-backup-YYYY-MM-DD.json`.

### `outfit.html` — What to Wear

Today's weather and a complete outfit from the clothes she actually owns, above the fold with no
taps. Local-only (`src/outfit.js`, `src/modules/wardrobeStore.js`, `src/modules/weather.js`,
`src/modules/outfitEngine.js`, `src/styles/outfit.css`): no Firebase import, nothing sent to
LoveGPT or analytics. The only network request is the forecast from `https://api.open-meteo.com`
(coordinates rounded to 2 dp, no key, no identifier), cached 60 minutes in `usm.weather-cache.v1`;
location resolves saved (`usm.weather-location.v1`) → geolocation only if already granted →
Winnipeg, and the browser is never asked on page load. Wardrobe metadata lives in
`usm.wardrobe.v1` → `{ items: WardrobeItem[], settings }`; photos are compressed to 640px and
stored as Blobs in the IndexedDB database `usm.wardrobe-photos` (never localStorage). The
recommendation is deterministic rule-based scoring in `outfitEngine.js` (pure: imports only
`dates.js`) — warmth against apparent temperature dominates, extreme cold (≤ −20°C) is a hard
exclusion of light items — and every line of explanation comes from the owner-written template
block at the top of that file. Backup exports item metadata only; photos are not included and the
UI says so. Reminder seam as in `peopleStore.js`, opt-in and off by default.

### `wedding.html` — Our Wedding Fund

A savings tracker with no goal bar, because there is no goal amount yet: just what's in the jar,
kept encouraging. Static and local-only (`src/wedding.js`, `src/modules/weddingFund.js`,
`src/styles/wedding.css`): no Firebase, no storage, no network. The only inputs are in
`src/data/weddingFund.js` — the opening `balance` as of `balanceAsOf`, the `weekly` deposit
($43.75, 5% of a paycheck) and the `payday` weekday (Tuesday). The page adds one deposit for every
payday that has passed since `balanceAsOf`, so the total keeps itself current; for a lump sum that
doesn't fit the rhythm, bump `balance` and reset `balanceAsOf`. "Growing right now" accrues the
next deposit continuously at the weekly rate (5 decimal places, ticking every 120 ms, 1 s under
reduced motion, paused while the tab is hidden) and is continuous across payday midnight. Also
shown: monthly/yearly equivalents, a calendar countdown to `WEDDING_DATE` (May 13, 2028), one
heart per week saved, the last six deposit dates, and a projection of the total on the wedding
morning at the current pace. All maths is in `weddingFund.js` (pure; imports only `dates.js`).

### `letters.html` — Letters

The reading room (`docs/anniversary/06-LETTERS.md`): a locked, session-authenticated archive of
the letters he has written her. `src/letters.js`, `src/styles/letters.css`, metadata in
`src/data/letters.js`, bytes through `src/modules/letterSource.js` only. Reached from the For You
hub, never the nav (the card is still `comingSoon` until the Storage path below lands).

**Locked state.** One sentence in his voice and an inline passcode control. Sign-in is the existing
`authenticateWithPasscode()` path (Cloud Function → custom token, `browserSessionPersistence`);
`onAuthStateChanged` unlocks, so a restored session and a fresh sign-in take the same route.
A wrong passcode shows one generic line. Nothing about a letter is in the DOM until unlock.
`getRole()` (`auth.js`) reads the signed-in UID (`owner` | `tolu`) for UI gating only.

**Archive.** Newest first, undated last, year dividers only when there is more than one year. No
search, no filters, no badges. Each card is a `<button>`; opening plays a 340ms fold-and-lift once
(none under `prefers-reduced-motion`).

**Reading view.** 66ch measure, `--font-body` at `clamp(1rem, 2.2vw, 1.15rem)` / 1.7; script for
the title and occasion only. Escape or the close control returns to the archive, restores scroll,
and puts focus back on the card. A text body (`text/*` blob — R3 path (a), transcribed) renders as
plain paragraphs via text nodes only. A PDF letter is drawn page by page onto canvases by
`src/modules/pdfPages.js` (pdf.js, loaded on demand; the worker is a same-origin asset, so no CSP
change). This replaced the `<iframe>` viewer, which on iOS shows only a non-scrollable first page
and on Android Chrome shows nothing — she was seeing page one of every letter. Pages are
placeholders at the right aspect ratio and are only rasterised while within 150% of the viewport,
released when they scroll away (a 77-page letter would otherwise be ~250 MB of canvases on a
phone); DPR is capped at 2. If pdf.js can't load, fetch or parse the file, the fallback is the
browser's own viewer in an iframe on desktop, and on a phone an "Open the letter" button into the
native reader (an iframe there is one page on iOS and nothing on Android).

**The bucket needs CORS for this.** pdf.js reads the bytes with `fetch`, and a plain
`?alt=media` GET from `firebasestorage.googleapis.com` carries no `Access-Control-Allow-Origin`
until the bucket has a CORS rule — without it every device silently lands on the fallback.
The rule lives in `cors.json` at the repo root; apply it once from Google Cloud Shell:
`gsutil cors set cors.json gs://lovesite-1540e.firebasestorage.app`. Verify with
`curl -sI -H "Origin: https://k-sqr.github.io" "<letter url>" | grep -i access-control`.

The reading bar for a PDF carries: zoom (− / level / +, 50–250 % of the column in 25 % steps,
also the plain `+` `−` `0` keys; wider than the column scrolls sideways, and visible pages are
re-rasterised at the new size), a live "3 / 7" page readout (the page showing most of itself),
**Download** (the public URL with `download` — desktops save it under the letter's file name,
phones open it in the native viewer, which can save), and **Full view** as a primary button.
In full view the bar stays in normal flow above the pages — never overlaid on them — and the body
is the scroller; Escape leaves full view first, then the letter. On a phone the tools collapse
to one row and Download is icon-only (label in `aria-label`).

**Bytes.** `getLetterBlob(id)` → `Blob` → `URL.createObjectURL`, held in a module variable for the
open view and revoked on close, on switching letters, and on `pagehide`. Never a download URL,
never any storage, never the URL bar.

**Data path.** Letter PDFs live in Firebase Storage under `letters/` with **public read** so the
browser can stream them into the viewer without an authenticated download. The page passcode is
still the curtain for the archive UI; a guessed object URL can reach a PDF, and that trade is
accepted so she can actually open them. Local `npm run dev` reads the gitignored
`letters-source/` folder. Owner upload/delete (06 R8) is still unbuilt.

**MVP privacy vs real security.** The locked state, the hidden nav entry, the role check and the
session persistence are a curtain — DevTools defeats each in a minute. Letter PDFs are deliberately
public on Storage so the viewer can stream; the passcode is what keeps the archive from being
browsable by a casual passer-by, not a hard lock on the bytes.

### Information architecture

Top-level navigation (one list, `NAV_LINKS` in `src/modules/siteChrome.js`):

```
♥ Us Machina    Home    Our Story    Memories    LoveGPT    For You    🌙
```

"Our Story" is `timeline.html`. On screens ≤600px the links move into a fixed bottom tab bar
(`.site-tabs`) and the top bar keeps only the brand and theme toggle. Tool pages (Letters, The
Application Desk, People, Rhythm, What to Wear, Our Wedding Fund) are reached only from the For You hub, never from
the nav. See `docs/anniversary/PAGE-CHECKLIST.md` for how to add a page.

---

## JavaScript Modules

All modules live in `src/modules/`. Each page imports only the modules it needs.

| Module | Purpose |
|--------|---------|
| `auth.js` | Passcode → Cloud Function `verify-passcode` → Firebase custom token → `signInWithCustomToken` with `browserSessionPersistence`. `isAuthenticated()`, `authenticateWithPasscode()`, `showPasscodeModal()`, `ensureAuthenticated()`, and `getRole()` (`'owner'` \| `'tolu'` \| `null`, read from the signed-in UID). |
| `letterSource.js` | Letter bytes/URLs only: `getLetterList()`, `letterPublicUrl(file)`, `getLetterBlob(id)`. Production streams public Storage `letters/<file>`; local `npm run dev` uses `letters-source/`. Passcode gates the page, not the object URL. |
| `dates.js` | Real calendar math: `daysBetween` (DST-safe), `calendarDuration` (month-by-month, not `/30.44`), `addDays`, `addMonths`, `formatDateRange`, and `formatRelativeGentle` — relative wording that never says "overdue", "late" or "should". |
| `modal.js` | `openModal()` / `closeModal()` for `.usm-modal`: focus trap (`data-focus-trap`), Escape-to-close, focus restore. |
| `reveal.js` | The single scroll-reveal `IntersectionObserver` (`initReveal(root)`, `observeReveal(el)`). Marks everything visible immediately under `prefers-reduced-motion` or when the API is missing. |
| `reminders.js` | The reminder engine: `registerReminder` / `upsertReminder` (upsert by type + sourceId + local day), `cancelReminder`, `cancelBySource`, `evaluateReminders({ now })`, `listActionable`, `snoozeReminder`, `dismissReminder`, `getPrefs` / `setPrefs`, `subscribeReminders`, `registerEphemeral` / `clearEphemeral` (Rhythm), `REMINDER_TYPES` (the per-type channel allow-list). Stores `usm.reminders.v1` + `usm.reminderPrefs.v1`. No network, no timers, no direct `localStorage`. |
| `notifiers/index.js` | Delivery-adapter registry and the `Notifier` contract (`id`, `label`, `isAvailable()`, `requestPermission()`, `deliver(reminder)`). Adding a channel = new file + `registerNotifier()` + an id in `REMINDER_TYPES[…].channels`; no feature file changes. |
| `notifiers/inApp.js` | Level 1, the only adapter on by default. `attachSurface({ types })` registers a place on the current page; `deliver()` is true when a surface exists for the reminder's type. |
| `notifiers/browser.js` | Level 2, registered, **default off**. Notification API; `isAvailable()` is honestly `false` in a normal iOS Safari tab (needs Home Screen install). Permission is requested only from the preferences panel's click handler. |
| `reminderUI.js` | `initReminders({ strip, prefs })` for the hub; `mountReminderStrip(el, { types, max })` for tool pages. One `.usm-card`, at most two items, "Got it" / "Later", an overflow sentence; renders nothing when nothing is due. |
| `siteChrome.js` | Renders the nav (top bar + mobile tab bar), music toggle/`<audio>`, and footer into mount points, then calls `initTheme()` and `initMusicPlayer()`. `NAV_LINKS` is the only place links are defined. |
| `storage.js` | Local persistence. `createStore(name, { version, migrate, initial })` → sync localStorage store with `{ v, updatedAt, data }` envelope, migrations, export/import, cross-tab `subscribe`, fail-soft in-memory fallback + one calm banner. `encrypted: true` → async AES-GCM store (PBKDF2-SHA256, 310k iterations, non-extractable key held in memory only, wrong passphrase = clean failure). `createBlobStore(name)` → IndexedDB for photos. Never touches the network. |
| `buttons.js` | Yes/No button behavior. "Yes" triggers celebration (graffiti rain, verse reveal, webhook). "No" detaches from its parent on first click, becomes `position: fixed` on `document.body`, bounces through 15 predefined zones (percentage-based), shows messages from `noTexts.js`, fades out after 15 clicks with a love message. |
| `firebase.js` | Initializes Firebase app, exports `db` (Firestore), `storage` (Storage), and analytics. Contains the project config object. |
| `gallery.js` | Home page gallery preview. Loads the 6 most recent memories from Firestore and renders them with lightbox support. |
| `graffiti.js` | Creates a "graffiti rain" celebration — hearts, emojis, and love phrases fall from the top of the screen when the user says "Yes". Uses `requestAnimationFrame` for smooth animation. |
| `loveCounter.js` | Live relationship duration counter. Calculates elapsed time from Sep 13, 2025 and updates every second showing months, days, hours, minutes, seconds. |
| `memoriesGallery.js` | Memories page gallery. Fetches all memories from Firestore, renders cards with safe DOM construction (no `innerHTML` for user content), sets up lightbox click handlers. Image URLs validated to require HTTPS. |
| `musicPlayer.js` | Background music toggle for the hero section. Play/pause with loop. |
| `textReveal.js` | Sparkle text reveal animation. Reveals text character-by-character with sparkle particle effects. Supports a skip button to complete instantly. |
| `theme.js` | Light/dark theme toggle. Uses `data-theme` attribute on `<html>`, persists choice in `localStorage`. Defaults to light mode on first visit. |
| `timeline.js` | Renders `src/data/timeline.js` as a vertical timeline via `initTimeline({ variant: 'preview' \| 'full', mount })`. Safe DOM construction (no `innerHTML`). `preview` = capped featured slice + "View full timeline →"; `full` = year chapters, explicit left/right classes, disclosures, photos. |
| `celebrate.js` | The one-year burst: `celebrate(anchor)` (hand-rolled fireworks + confetti, CSS keyframes, full teardown) and `celebrateOnce(anchor)` (module flag + `sessionStorage` `usm.celebrate.one-year`). Creates nothing under `prefers-reduced-motion`. |
| `upload.js` | Image upload to Firebase Storage. Compresses images client-side using Canvas API before uploading. Creates a Firestore document with URL, caption, timestamp, and the uploader's passcode hash. |
| `verses.js` | Bible verse carousel with prev/next navigation and floating verse overlay. Sources verses from `src/data/verses.js`. |
| `webhook.js` | Sends the Yes/No response to a configurable external URL (Formspree, Discord, etc.). |

---

## Data Files

All in `src/data/`:

| File | Contents |
|------|----------|
| `verses.js` | 33 Bible verses (`{ text, ref }`) curated for the relationship — 1 Corinthians 13, Song of Solomon, Romans, Isaiah, etc. Also exports `graffitiTexts` — an array of hearts, emojis, and love phrases used by the graffiti rain animation. |
| `timeline.js` | The single source of truth for the story: one `timeline` array (`id`, ISO `date`, optional `dateDisplay`, `title`, `description`, optional `expandedBody`, `icon`, `type`, `featured`, optional `location`/`tags`/`photos`) plus pure helpers `sortedByDate`, `getFeatured`, `getById`, `groupByYear`, `countByType`, `photoCount`, `displayDate`. Every entry traces to `docs/anniversary/TIMELINE-CONTENT.md`; ends with an authoring stub for the owner. |
| `letters.js` | Letter **metadata only** (`id`, `file`, `title`, `occasion`, ISO `date`, one-line `teaser`, `pages`) plus pure helpers `displayTitle`, `sortNewestFirst`, `groupByYear`, `letterCount`. Bundled into `dist/`, so nothing from inside a letter may appear here. Titles/dates/occasions are `TODO(emmanuel)`. |
| `noTexts.js` | 16 playful messages shown sequentially when the "No" button is clicked, e.g. "Are you sure?", "Pretty please?", "Abeg na!", "God said to say yes". |

---

## Styling Architecture

CSS uses custom properties for theming, `clamp()` for responsive typography, and `@keyframes` for all animations.

| File | Scope |
|------|-------|
| `base.css` | Root CSS variables (pink palette, card backgrounds, shadows, border radii, spacing scale `--space-*`, status tones `--tone-*`, `--error`, `--surface-sunken`, `--border-subtle`), reset, body styles, typography (Dancing Script for headings, Inter for body), `[data-theme="dark"]` overrides, and the global `:focus-visible` ring. |
| `sections.css` | Layout for all homepage sections (hero, response, timeline, gallery, verses, footer), navbar, buttons (including standalone `#noBtn` styles), lightbox, love counter, music toggle, locked sections, floating hearts, and mobile breakpoints. |
| `animations.css` | All `@keyframes`: `pulse`, `graffiti-fall`, `sparkle-anim`, `reveal`, `float-up`, `music-pulse`, `love-message`, `typingBounce`, `msgSlideIn`. Includes `prefers-reduced-motion` overrides. |
| `memories.css` | Memories page: upload panel, drag-and-drop zone, image preview list, progress bar, passcode modal, gallery grid, mobile adjustments. |
| `timeline-page.css` | Timeline page: stats bar with stat cards, extended timeline layout, responsive breakpoints. |
| `ui.css` | Shared primitives for the tool pages (`.usm-card`, `.usm-btn--*`, `.usm-pill`, `.usm-input`, `.usm-panel`, `.usm-modal`, `.usm-empty`, `.usm-toast`, `.usm-tone--*`, `.usm-skeleton`). Each is extracted from an existing class — the header comment names which. Imported only by new pages. |
| `foryou.css` | For You hub: header, lede, centred card wrap. |
| `wedding.css` | Our Wedding Fund: the big number, live ticker, pace tiles, deposit log. Alignment and padding live on child selectors because the shared `ui.css` chunk loads after page CSS. |
| `reminders.css` | The reminder card and the "Reminders" panel, built only from `ui.css` primitives and `base.css` tokens (no red/amber, no badges). Imported by `reminderUI.js`. |
| `lovegpt.css` | LoveGPT page: subtle gradient background, sparkly header, starter pills, chat area, message bubbles (user: pink gradient, AI: glass card with `backdrop-filter`), typing dots animation, input area, custom scrollbar. |

### Theming

The site supports light and dark modes via the `data-theme` attribute on `<html>`:

- **Light mode** (default on first visit): warm pink/white palette
- **Dark mode**: deep plum palette with adjusted shadows and card backgrounds
- Toggle is in the navbar; preference stored in `localStorage` under `aho_theme`

### Browser storage keys

The site lives at `k-sqr.github.io/lovesite/`; localStorage is scoped to the whole
`k-sqr.github.io` origin, so every key is namespaced.

| Key | Store | Owner |
|-----|-------|-------|
| `aho_theme` | localStorage | `theme.js` |
| `usm.<name>.v<version>` | localStorage | `storage.js` — one per `createStore()`; encrypted stores hold ciphertext only |
| `usm.<name>` | IndexedDB database | `storage.js` — `createBlobStore()` |
| `usm.people.v1`, `usm.messageTemplates.v1` | localStorage | `peopleStore.js` — see `people.html` above |
| `usm.people.energy` | sessionStorage | `peopleStore.js` — the current energy selection only; never a history |
| `usm.wardrobe.v1`, `usm.weather-cache.v1`, `usm.weather-location.v1` | localStorage | `wardrobeStore.js` / `weather.js` — see `outfit.html` above |
| `usm.wardrobe-photos` | IndexedDB database | `wardrobeStore.js` — compressed item photos as Blobs |
| `usm.reminders.v1`, `usm.reminderPrefs.v1` | localStorage | `reminders.js` — `{ items: Reminder[] }` and the preferences; never a `rhythm` row |
| `music_should_play`, `music_muted`, `music_popup_shown` | sessionStorage | `musicPlayer.js` |

---

## Reminders

A cross-feature system, not a page (`docs/anniversary/11-NOTIFICATIONS.md`). One engine
(`src/modules/reminders.js`), an adapter registry (`src/modules/notifiers/`), one visible surface
(`src/modules/reminderUI.js` + `src/styles/reminders.css`). It exists to reduce mental load, so it is
built to be suspicious of itself: defaults are "nearly everything off", there is never a list, a
count, a badge, a bell, or a red dot, and a page with nothing due shows nothing at all.

### Delivery levels — the decision

| Level | What | Verdict |
|-------|------|---------|
| **1 — In-app** | Queue in `localStorage`, evaluated on page load and on `visibilitychange`, shown as a calm inline card on the hub and the relevant tool page. No permission, no server, no CSP change, works in every browser. | ✅ **Built.** Honest limit: it only works when she opens the site. |
| **2 — Browser Notification API** | `Notification.requestPermission()` + `new Notification()`. No server. Fires only while a page is open; **absent in a normal iOS Safari tab** (needs Add to Home Screen, which needs a manifest this project does not ship). | ⚙️ **Shipped, registered, default off.** Turn on only after checking her actual device. |
| **3 — Email** | Scheduled Function (Blaze + Cloud Scheduler) + email provider + reminder data persisted server-side. | ❌ **Not built.** The server-side copy means reminder data leaves her device, which inverts the local-only model. **Rule: email may never carry Rhythm data in any form, not even a bare date.** If ever built, content-free nudges only ("a reminder from Us Machina"). |
| **4 — Web Push** | Service worker + Push/FCM + VAPID + server subscriptions + scheduler + the iOS install requirement. | ❌ **Deferred, in writing.** The largest infrastructure jump in the project; nothing about "he knows me" is delivered by a push. |

Adding a channel later must not touch a feature file: write `notifiers/<id>.js`, `registerNotifier()`
it, add the id to the relevant `REMINDER_TYPES[type].channels`. If Rhythm or People had to change,
the abstraction has failed. No service worker and no PWA manifest exist; if a future task adds a
manifest, `scope` and `start_url` must both be `/lovesite/`.

### The record

```js
{ id: 'rmd_7f3a91', type, sourceId,          // sourceId is opaque: never a name, email, or free text
  title, body, href,                          // title/body are lock-screen-visible: public strings
  scheduledAt, createdAt, status,             // pending → due → delivered → dismissed; due ⇄ snoozed; * → cancelled
  deliveryMethod, deliveredAt, snoozedUntil, dismissedAt, cancelledAt }
```

Engine rules: upsert by `(type, sourceId, local day of scheduledAt)` — features re-register on every
page load without creating duplicates, and a moved date cancels the old day's row; a dismissed row is
never re-raised; a `(type, sourceId)` pair is surfaced at most once per 20 h; dismissed/cancelled rows
are pruned after 30 days; anything nobody saw within 7 days ages out; at most 3 deliveries per day
and 2 visible at once (the rest sit behind one sentence); quiet hours default 21:30–08:00 and hold
every channel except the site itself. `enabled: false` means no evaluation and no DOM, and turning it
back on discards what came due while off. The only producer the engine owns is the anniversary
("Tomorrow makes a year. ❤️", the morning before, from `RELATIONSHIP_START = '2025-09-13'`).

### Types and channels

```js
rhythm      → ['in-app']              default on   (never persisted — see below)
checkin     → ['in-app', 'browser']   default on   People
birthday    → ['in-app', 'browser']   default on   People (birthdays + important dates)
application → ['in-app', 'browser']   default on   The Application Desk
outfit      → ['in-app']              default OFF  What to Wear (also opt-in on that page)
date        → ['in-app', 'browser']   default on   the anniversary
```

`channels` is enforced in the engine, not the adapter: a `rhythm` reminder offered to any channel
but `in-app` is refused with a warning.

### The Rhythm exception

A `type: 'rhythm'` row with a real `scheduledAt` in plaintext `localStorage` would hand her cycle
dates to anyone with her unlocked laptop and DevTools — the exact threat the passphrase exists for.
So Rhythm reminders **never enter `usm.reminders.v1`**. `rhythm.js` computes one content-free
reminder from the prediction at unlock and hands it to `registerEphemeral()`, which the engine holds
in memory only; "Got it" / "Later" come back through `onChange` and `rhythmStore.setReminderState()`
saves them inside the encrypted `usm.rhythm.v1` payload (one passphrase, one unlock). Locking clears
the memory copy and the card. **Consequence, stated honestly:** Rhythm reminders appear only inside
`rhythm.html` after the passphrase is entered — never on the For You hub, never as a browser
notification. No reminder title or body may ever match `/period|cycle|ovulat|flow|symptom|fertile/i`.

### Wiring a feature (the seam 07, 08 and 10 use)

A store module emits a deterministic record and never touches the engine's storage:

```js
reminders.upsertReminder({ id: 'people:per_x:checkin',   // stable → re-emitting replaces
  source: 'people', kind: 'checkin',                     // mapped to REMINDER_TYPES in the engine
  dueAt: '2026-09-20T18:00:00.000Z', title, body, href: '/lovesite/people.html#per_x' });
reminders.cancelReminder('people:per_x:checkin');       // accepts the feature's own id
```

Loaded with a guarded dynamic `import('./reminders.js')` (People, Wardrobe) or `import.meta.glob`
(Applications) so a page keeps working if the chunk fails. The page then mounts its own surface:

```js
import { mountReminderStrip } from './modules/reminderUI.js';
mountReminderStrip('#peopleReminders', { types: ['checkin', 'birthday'] });   // → { refresh, unmount }
```

Mounts today: `#reminderStrip` (hub, every persisted type), `#deskReminders` (`application`),
`#peopleReminders` (`checkin`, `birthday`), `#outfitReminders` (`outfit`), and `.rhythm-reminders`
(`rhythm`, created inside the unlocked view only).

### Preferences

`usm.reminderPrefs.v1`, written with defaults on first visit: `enabled: true`, channels
`{ 'in-app': true, browser: false, email: false, push: false }`, per-type switches as above,
`quietHours { '21:30', '08:00' }`, `maxPerDay: 3`. Edited from the "Reminders" `.usm-panel`
disclosure at the bottom of the hub (Escape closes it and returns focus). **Nothing asks for
notification permission on load**; the only `requestPermission()` call is inside the click handler
of the "Browser notifications" switch, which first checks `isAvailable()` and explains the iPhone
Home-Screen requirement instead of prompting when the API is absent.

---

## Firebase Setup

### Project

- **Project ID**: `lovesite-1540e`
- **Config file**: `src/modules/firebase.js` (client-side Firebase config)
- **Project settings**: `.firebaserc` (alias mapping)

### Firestore

**Collection: `memories`**

Each document represents an uploaded photo:

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Firebase Storage download URL |
| `caption` | string | User-provided caption (max 500 chars) |
| `createdAt` | timestamp | Upload timestamp |
| `passcodeHash` | string | SHA-256 hash of uploader's passcode |
| `filename` | string | Original filename |

**Security rules** (`firestore.rules`):
- Read: public (anyone can browse memories)
- Create: allowed if document has required fields and caption ≤ 500 chars
- Update/Delete: denied

### Storage

**Path: `memories/{fileName}`**

- Read: public
- Create: allowed for image files under 10 MB
- Update/Delete: denied

**Rules file**: `storage.rules`

### Cloud Functions

- **Runtime**: Node.js 20
- **Region**: us-central1
- **Function**: `lovegpt` — LoveGPT RAG endpoint (see below)
- **Memory**: 256 MiB
- **Source**: `functions/` directory

---

## LoveGPT — RAG Pipeline

LoveGPT is a personalized AI chatbot that answers questions about the relationship using a Retrieval-Augmented Generation (RAG) approach.

### Architecture

```
User question
    │
    ▼
┌─────────────────────┐
│  Keyword Extraction  │  ← stop-word filtering
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Chunk Retrieval     │  ← score by tag match (3x), section match (2x), content match (1x)
│  (top 8 chunks)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Context Building    │  ← format chunks with source labels
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Gemini 2.5 Flash    │  ← system prompt + context + user question + conversation history
└──────────┬──────────┘
           │
           ▼
      AI Response
```

### Knowledge Base

`functions/knowledge/chunks.json` contains 37 pre-processed chunks from three source documents:

1. **boo.pdf** (Emmanuel's notes) — food preferences, personality traits, relationship events, nicknames, spiritual notes
2. **journal.pdf** (Tolu's journal) — her perspective on the relationship, month-by-month entries
3. **Happy 180 Days** (anniversary letter) — detailed month-by-month recap from September 2025 to March 2026

Each chunk has:
- `id`: unique identifier
- `source`: `"emmanuel"` or `"tolu"`
- `section`: semantic category (e.g., `"food_preferences"`, `"september_2025"`)
- `tags`: array of keywords for scoring
- `content`: the actual text

### Retrieval Strategy

Instead of a vector database, retrieval uses keyword matching with weighted scoring:
- **Tag match**: 3 points per keyword
- **Section match**: 2 points per keyword
- **Content match**: 1 point per keyword

Top 8 chunks by score are returned. If no keywords are extracted, the first 5 chunks are used as default context.

### System Prompt

The system prompt defines LoveGPT's personality (warm, playful, faith-aware) and guidelines. Specific PII (birthdays, addresses, church names) has been removed from the system prompt — those details are only surfaced through RAG chunks when relevant to the question.

Security rules in the prompt prevent:
- Revealing system instructions
- Outputting HTML or executable code
- Fabricating events or quotes

### Gemini Integration

- **Model**: `gemini-2.0-flash`
- **API key**: stored as a Firebase secret (`GEMINI_API_KEY`), accessed via `process.env`
- **Conversation history**: validated and capped at 20 entries before forwarding to Gemini

---

## Security

### Content Security Policy

All 4 HTML pages include a `<meta>` CSP tag that restricts:
- **Scripts**: self only (no inline, no eval)
- **Styles**: self + unsafe-inline (needed for Vite-injected styles)
- **Images**: self + Firebase Storage
- **Connections**: self + Firebase APIs + Cloud Function endpoint + Google Analytics + `https://api.open-meteo.com` (weather for `outfit.html`)
- **Frames**: none

### CORS

The Cloud Function restricts CORS to:
- `https://k-sqr.github.io` (production)
- `http://localhost:5173` and `http://localhost:4173` (development)

### Input Validation (Cloud Function)

- Messages capped at 2,000 characters
- History capped at 20 entries
- Each history entry validated for shape (`role` must be `"user"` or `"assistant"`, `content` must be a string ≤ 2,000 chars)
- Non-POST requests rejected

### XSS Prevention

- **Memory captions**: rendered with `textContent` (not `innerHTML`)
- **Memory image URLs**: validated to require `https://` prefix
- **AI responses**: HTML-escaped before markdown formatting is applied
- **User messages in chat**: rendered with `textContent`

### Authentication

- Upload access: passcode-based, hashed client-side with SHA-256 (Web Crypto API)
- Auth state persisted in `sessionStorage` (clears when browser tab closes)

### Error Messages

The Cloud Function returns generic error messages to clients. Specific error details (missing API key, Gemini errors) are logged server-side only.

### Anti-Prompt Injection

The system prompt includes explicit instructions to never reveal its own instructions or output raw HTML/code.

### Firebase Security Rules

Version-controlled in `firestore.rules` and `storage.rules`:
- Memories are publicly readable
- Only valid image uploads under 10 MB are accepted
- No updates or deletes allowed
- All other paths are denied by default

---

## Deployment

### GitHub Pages (Frontend)

```bash
npm run deploy
```

This runs `vite build && gh-pages -d dist`, which:
1. Builds the Vite project to `dist/`
2. Pushes `dist/` to the `gh-pages` branch
3. GitHub Pages serves from `https://k-sqr.github.io/lovesite/`

### Firebase Cloud Functions

```bash
cd functions && npm install
npx firebase-tools deploy --only functions
```

Requires:
- Firebase CLI authenticated (`npx firebase-tools login`)
- `GEMINI_API_KEY` set as a Firebase secret:
  ```bash
  npx firebase-tools functions:secrets:set GEMINI_API_KEY
  ```

### Firebase Security Rules

```bash
npx firebase-tools deploy --only firestore:rules,storage
```

---

## Local Development

### Prerequisites

- Node.js 20+
- npm
- Firebase CLI (`npx firebase-tools`)
- A Firebase project with Firestore and Storage enabled

### Setup

```bash
git clone https://github.com/k-sqr/lovesite.git
cd lovesite
npm install
```

### Run Dev Server

```bash
npm run dev
```

Opens at `http://localhost:5173/lovesite/`. The Vite dev server provides hot module replacement.

### Preview Production Build

```bash
npm run build
npm run preview
```

### Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Firebase secret | Google Gemini API key for LoveGPT |
| Firebase config | `src/modules/firebase.js` | Client-side Firebase project configuration (public by design) |

### Functions Local Testing

```bash
cd functions
npm install
npx firebase-tools emulators:start --only functions
```

---

## File Tree

```
ahosite/
├── .firebaserc                  # Firebase project alias
├── .gitignore                   # Git ignore rules
├── DOCS.md                      # This file
├── FEATURES.md                  # Future feature ideas
├── README.md                    # Project readme
├── firebase.json                # Firebase config (functions, rules)
├── firestore.rules              # Firestore security rules
├── storage.rules                # Storage security rules
├── index.html                   # Home / proposal page
├── memories.html                # Photo gallery page
├── timeline.html                # Relationship timeline page
├── lovegpt.html                 # LoveGPT chat page
├── foryou.html                  # For You hub
├── wedding.html                 # Our Wedding Fund
├── package.json                 # Root dependencies & scripts
├── vite.config.js               # Vite build config (multi-page)
├── src/
│   ├── main.js                  # Home page entry point
│   ├── memories.js              # Memories page entry point
│   ├── timeline-page.js         # Timeline page entry point
│   ├── lovegpt.js               # LoveGPT page entry point
│   ├── foryou.js                # For You hub entry point
│   ├── wedding.js               # Our Wedding Fund entry point
│   ├── data/
│   │   ├── timeline.js          # The story — single source of truth
│   │   ├── noTexts.js           # No-button messages
│   │   ├── verses.js            # Bible verses & graffiti texts
│   │   └── weddingFund.js       # Wedding fund balance, rate, payday, date
│   ├── modules/
│   │   ├── auth.js              # Passcode auth
│   │   ├── buttons.js           # Yes/No button logic
│   │   ├── dates.js             # Calendar math + gentle relative dates
│   │   ├── firebase.js          # Firebase init & config
│   │   ├── gallery.js           # Home gallery preview
│   │   ├── graffiti.js          # Heart/emoji rain animation
│   │   ├── loveCounter.js       # Live duration counter
│   │   ├── memoriesGallery.js   # Memories fetch, render, lightbox
│   │   ├── modal.js             # Accessible modal open/close
│   │   ├── musicPlayer.js       # Background music toggle
│   │   ├── reveal.js            # Shared scroll-reveal observer
│   │   ├── siteChrome.js        # Nav + music + footer renderer
│   │   ├── storage.js           # Namespaced local storage (+ encrypted, + blobs)
│   │   ├── textReveal.js        # Sparkle text reveal
│   │   ├── theme.js             # Light/dark theme toggle
│   │   ├── timeline.js          # Timeline renderer
│   │   ├── upload.js            # Image upload + compression
│   │   ├── verses.js            # Verse carousel
│   │   ├── weddingFund.js       # Wedding fund arithmetic (pure)
│   │   └── webhook.js           # Response webhook
│   └── styles/
│       ├── animations.css       # All @keyframes
│       ├── base.css             # Variables, reset, typography, focus ring
│       ├── foryou.css           # For You hub styles
│       ├── lovegpt.css          # LoveGPT chat styles
│       ├── memories.css         # Memories page styles
│       ├── sections.css         # Homepage section layouts
│       ├── timeline-page.css    # Timeline page styles
│       ├── ui.css               # Shared primitives for tool pages
│       └── wedding.css          # Our Wedding Fund styles
├── docs/anniversary/
│   └── PAGE-CHECKLIST.md        # How to add a page
└── functions/
    ├── index.js                 # LoveGPT Cloud Function
    ├── package.json             # Function dependencies
    └── knowledge/
        └── chunks.json          # RAG knowledge base (37 chunks)
```
