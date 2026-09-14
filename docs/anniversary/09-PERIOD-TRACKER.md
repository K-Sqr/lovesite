# 09 — Rhythm (Period Awareness)

**Recommended tool:** Cursor Chat, working file-by-file with you reviewing each diff.
**Model:** a strong reasoning model. This page has one small hard part — the encryption boundary and
the honesty of the prediction — and getting either subtly wrong is worse than not shipping it.

Justification: the feature is small in surface area (one page, three modules) but it holds the most
sensitive data in the project. A batch agent that touches many files at once is the wrong shape
here; you want every line of the crypto and storage path read by a human before it lands.

---

## Context

She frequently does not know when her period is coming. That is the entire problem. It is not
medical management, it is not symptom analysis, it is not a health record — it is **awareness and
prediction**. She wants to look at something for three seconds and get an answer to "when is it
probably coming?"

Everything in this feature follows from two facts:

1. **The primary action is one tap.** If logging a period start takes more than a single tap on the
   first screen, she will not do it, the history will be empty, and the prediction will never work.
   Low friction is not a nice-to-have; it is the feature.
2. **This is the most sensitive data in the entire project.** The site lives in a **public** GitHub
   repository at `https://github.com/K-Sqr/lovesite` and is served from `k-sqr.github.io`, an origin
   shared with any other Pages site under that user. There is no scenario in which this data goes to
   a server.

### Why the page is called "Rhythm"

The nav label is **"Rhythm"** and the page is **`rhythm.html`**. Keep both. This is a deliberate
privacy decision, already recorded in `04-SHARED-FOUNDATIONS.md`:

- If someone glances at her phone while the page is open, the nav label and the heading say
  "Rhythm". They do not say "Period Tracker".
- The browser tab title, the browser history entry, the URL in the address bar, and the entry in
  her recently-visited list all read "Rhythm".
- It is also simply the honest word for the thing: a rhythm is what a cycle is.

Do not rename it, do not add a clarifying subtitle like "period tracker", and do not put a
menstruation emoji in the tab title. Discretion by naming is cheap and it works.

---

## Objective

Ship `rhythm.html`: a local-only, encrypted-at-rest page where she can record a period start in one
tap and read an honest estimated range for the next one, derived from her own history.

The success sentence is: **"Your next period may be around September 18–22."** Rendered above the
fold, legible in three seconds, never stated as a certainty.

---

## Prerequisites

- `01-REPOSITORY-AUDIT.md` read.
- `02-DESIGN-SYSTEM.md` complete — `src/styles/ui.css` and the added tokens exist.
- `04-SHARED-FOUNDATIONS.md` complete — you need `initSiteChrome()`, `initReveal()`,
  `createStore(name, { encrypted: true })`, `formatDateRange()`, `daysBetween()`, `addDays()`,
  `toISO()`, `parseISO()`, `startOfDay()`.
- `foryou.html` exists with a Rhythm card (shipped in the `data-coming-soon` state).

If `createStore(..., { encrypted: true })` does not yet exist, **stop and build it in
`04-SHARED-FOUNDATIONS.md` first.** Do not implement a second, local copy of the crypto in this
feature.

---

## Existing Files To Inspect

Read these before writing anything.

| File | Why |
| --- | --- |
| `src/modules/storage.js` | The encrypted store contract you must consume. Confirm PBKDF2 iterations, the on-disk envelope, and how a wrong passphrase surfaces. |
| `src/modules/dates.js` | `formatDateRange`, `daysBetween`, `addDays`, `toISO`, `startOfDay`. Use these; do not write new date math. |
| `src/modules/reveal.js` | `initReveal()`, `observeReveal(el)`. |
| `src/modules/siteChrome.js` | `initSiteChrome({ active })` and the `NAV_LINKS` array. |
| `src/styles/ui.css` | `.usm-card`, `.usm-btn`, `.usm-input`, `.usm-field`, `.usm-modal`, `.usm-empty`, `.usm-tone--*`, `.usm-skeleton`. |
| `src/styles/base.css` | Token names and both theme blocks. Never hardcode a hex. |
| `src/styles/memories.css` | Read `.passcode-modal` / `.passcode-input` (lines ~264–348) as the visual reference for the unlock screen. Note `.passcode-modal p { color: #999 }` is an existing dark-mode bug — do **not** copy it. |
| `src/modules/firebase.js` | Read it precisely so you understand why this page must never import it. It calls `getAnalytics(app)` at module scope, unconditionally. |
| `index.html` | Copy the `<head>` shape: fonts, CSP meta, icon, viewport. |
| `vite.config.js` | You are adding an input entry. |
| `docs/anniversary/PAGE-CHECKLIST.md` | Follow it literally. |

---

## Files You Own (Create)

```
rhythm.html                        the page
src/rhythm.js                      page entry — imports CSS, chrome, reveal, wires the UI
src/modules/rhythmStore.js         encrypted store wrapper + record CRUD + export
src/modules/cyclePredict.js        pure prediction math, zero DOM, zero storage
src/styles/rhythm.css              page styles
```

`cyclePredict.js` must be **pure**: it takes an array of records and a "today" date and returns a
plain object. No imports except `dates.js`. This is the only part of the feature worth testing by
hand in a console, and purity is what makes that possible.

## Files You May Modify

```
vite.config.js                     add:  rhythm: resolve(__dirname, 'rhythm.html')
src/foryou.js                      remove data-coming-soon from the Rhythm card only
docs/anniversary/PAGE-CHECKLIST.md tick nothing; add a note only if you found a gap
DOCS.md                            one line: the page exists, its data is local and encrypted
```

## Files You Must Not Touch

Genuinely restrictive — another agent is working in parallel on the outfit page.

```
outfit.html · src/outfit.js · src/styles/outfit.css · src/modules/wardrobe*.js · src/modules/weather*.js
letters.html · applications.html · people.html · lovegpt.html · memories.html · timeline.html · index.html
src/letters.js · src/applications.js · src/people.js · src/lovegpt.js · src/memories.js · src/timeline-page.js · src/main.js
src/data/*
src/modules/{firebase,auth,upload,memoriesGallery,memoryAdmin,gallery,buttons,graffiti,textReveal,verses,loveCounter,musicPlayer,navbar,theme,webhook}.js
src/modules/{storage,dates,reveal,siteChrome}.js       ← consume them; do not edit them
src/styles/{base,sections,animations,memories,timeline-page,lovegpt,ui}.css
functions/** · functions/knowledge/chunks.json · firestore.rules · storage.rules
```

Two exceptions to "do not touch HTML": you will add `https://` hosts to nothing (this page makes no
network requests), and you do **not** need to edit the other pages' CSP. If you find yourself
editing another page's CSP, you have added a network call and violated the core requirement.

---

## Requirements

### R1 — One-tap logging

The first thing on the page, once unlocked, is a single large button: **"Period started today"**.
Tapping it writes a record dated today and immediately shows a calm confirmation with an inline
**Undo** for ~8 seconds. That is the whole primary path. No modal, no form, no confirm dialog.

Directly beneath it, in smaller text, a secondary correction path: **"Actually, it started
yesterday"** (one tap, dates it to yesterday) and **"Pick a date"** (opens a native
`<input type="date">`, `max` = today).

Guard against duplicates: if a record already exists with a start date within 3 days of the tapped
date, do not create a second one. Instead show "You already logged this on the 21st — want to change
it to today?" with a change/keep choice.

### R2 — Optional detail, never in the way

Everything except `startDate` is optional and lives behind a single **"Add a bit more"** disclosure
on the record, collapsed by default:

- **End date** — `<input type="date">`, must be ≥ start, ≤ start + 14 days.
- **Flow** — three pills: light / medium / heavy. Nullable, clearable.
- **Symptoms** — a fixed short vocabulary of chips: cramps, headache, tired, back pain, nausea,
  bloating. Multi-select, no free-text tag creation.
- **Mood** — one short free-text line.
- **Note** — one free-text textarea, ~500 chars.

No field is required, ever. No field shows a validation error for being empty. No progress meter,
no "profile completeness", no streaks.

### R3 — Edit and delete

Every record in the history is editable and deletable in two taps. Delete asks once ("Delete the
entry from August 21?") and then deletes for real. A mistaken tap on the big button must be trivial
to erase — that fear is why people abandon trackers.

### R4 — The prediction

Compute in `cyclePredict.js`. The method, stated plainly so nobody "improves" it into a black box:

1. Sort records by `startDate` ascending. Compute cycle lengths as `daysBetween(start[i], start[i+1])`.
2. Discard implausible lengths (`< 18` or `> 60` days) from the maths — those are data-entry
   mistakes, not cycles. Keep the record itself; just exclude the derived length. Count how many
   were discarded so the UI can mention it if it is significant.
3. Take the **last 6** usable lengths (fewer if that is all there is).
4. **Centre = median**, not mean. Median resists a single 45-day outlier caused by stress or a
   missed log; the mean does not. Write that reason in a code comment.
5. **Spread = median absolute deviation** of those lengths, rounded up, clamped to `[2, 7]` days.
   Padding is `spread`, so the window is `2 × spread + 1` days wide.
6. `predictedStart = addDays(lastStart, medianLength)`;
   `windowStart = addDays(predictedStart, -spread)`;
   `windowEnd = addDays(predictedStart, +spread)`.
7. Render with `formatDateRange(windowStart, windowEnd)`.

**Confidence must degrade visibly with less data.**

| Usable cycles | State | What she sees |
| --- | --- | --- |
| 0–1 | `insufficient` | "I need a couple more cycles before I can guess. For now, here's what I know." + the recorded dates. No range. |
| 2 | `insufficient` | Same copy. One gap is not a pattern. |
| 3–4 | `estimate`, low | The range, prefixed "Rough guess, from 3 cycles —", and a wider window (spread floor of 3 rather than 2). |
| 5+ | `estimate`, moderate | The range, plus "based on your last 5 cycles". |

There is no "high confidence" tier. It does not exist for this problem.

**Never present a single certain date.** No countdown timer, no "3 days until", no ring gauge
filling up. If the window has already passed, say something factual and unalarmed: *"You're a few
days past your usual window. Cycles move around — this is just what I've got recorded."* Do not
speculate about why.

Return shape:

```js
// cyclePredict.js
export function predictNextWindow(records, today) {
  return {
    state: 'insufficient' | 'estimate',
    usableCycles: 4,          // count feeding the median
    discardedCycles: 0,       // implausible lengths excluded
    medianLength: 29,         // days, integer
    spreadDays: 3,            // padding on each side
    lastStart: '2026-08-21',  // ISO
    windowStart: '2026-09-18',
    windowEnd: '2026-09-22',
    confidence: 'low' | 'moderate',
    isPastWindow: false,
  };
}
```

The **sentence** is built in `rhythm.js`, not in `cyclePredict.js`. Keep copy out of the maths
module.

### R5 — Honest history, not charts

One section: a plain list of recorded cycles (start, optional end, length in days) plus a single
simple cycle-length line — "Your cycles have been 28, 30, 27, 31, 29 days." That is the whole
visualisation budget. No bar charts, no calendar heat map, no ring, no KPI cards.

### R6 — Export / backup

A quiet **"Download a copy"** action in a Settings disclosure. It writes a pretty-printed plaintext
JSON file (`rhythm-backup-YYYY-MM-DD.json`) via `Blob` + `URL.createObjectURL` + `<a download>`.

It must be preceded by one honest sentence: *"This file is not encrypted. Anyone who opens it can
read it. Put it somewhere you trust."* This exists so that "forgetting the passphrase loses
everything" is a real risk she has a real answer to, not a trap.

### R7 — Data schema

```js
// Decrypted payload inside createStore('rhythm', { version: 1, encrypted: true })
{
  version: 1,
  records: [
    {
      id: 'r_8f3c1a',            // crypto.randomUUID() or a short random id
      startDate: '2026-08-21',   // ISO calendar date, local. THE ONLY REQUIRED FIELD.
      endDate: '2026-08-26',     // ISO date | null
      flow: 'medium',            // 'light' | 'medium' | 'heavy' | null
      symptoms: ['cramps'],      // fixed vocabulary, may be []
      mood: '',                  // short free text
      note: '',                  // free text, <= 500 chars
      createdAt: '2026-08-21T13:02:11.480Z',
      updatedAt: '2026-08-21T13:02:11.480Z',
    },
  ],
  settings: {
    autoLockMinutes: 5,          // re-lock after this long hidden
  },
}
```

`records` is sorted on write, newest first, so rendering never sorts. There is no `userId`, no
`deviceId`, no `syncedAt`. Do not add one.

---

## UX Requirements

**Design for a hurry.** She opens this while doing something else. The answer must be readable
without scrolling on a 375px screen, one-handed, thumb on the bottom half of the display.

Vertical order once unlocked:

1. **The answer.** One `.usm-card`, the estimate sentence at `clamp(1.05rem, 3vw, 1.3rem)` in
   `--font-body` (it is data — Inter, not Dancing Script), with a smaller line beneath giving the
   basis ("based on your last 5 cycles, which have run 27–31 days").
2. **The button.** "Period started today" — full-width, `.usm-btn--primary`, minimum 56px tall
   (larger than the 44px floor because it is the one thing she is here to press), positioned within
   thumb reach.
3. The two correction links.
4. History list, `.reveal` with `data-delay` cycling `(i % 4) + 1`.
5. Settings disclosure: export, lock now, and the passphrase warning.

**States, all three required and all written as sentences:**

- **Empty** (`.usm-empty`, one line in `--font-display`): *"Nothing here yet. Tap the button when
  it starts, and I'll start learning your rhythm."*
- **Loading** (between unlock and decrypt — PBKDF2 at 250k iterations is deliberately slow, expect
  200–800ms): `.usm-skeleton` blocks in the shape of the answer card, plus a status line
  "Unlocking…". Never a spinner over a blank page.
- **Error** — three distinct, calm messages: wrong passphrase ("That's not it. Try again."),
  storage unavailable ("Saving isn't working in this browser right now"), corrupt/undecryptable
  payload ("I can't read the saved data with that passphrase.").

**Tone rules.** Gentle, factual, adult. Second person. Never clinical ("menstrual flow volume"),
never cutesy ("Aunt Flo", "shark week"), never infantilising (no pink ribbons, no cartoon uterus,
no "you've got this!"). No guilt: never "you forgot to log", never a streak, never a nag. One
warm line is enough; the rest is information.

**Accessibility:** 44px minimum targets (56px on the primary), `:focus-visible` rings from
`ui.css`, `aria-live="polite"` on the confirmation/undo region, the unlock modal focus-trapped with
Escape-to-close via `.usm-modal`'s `data-focus-trap` hook, everything legible and complete under
`prefers-reduced-motion: reduce`. Confidence must never be conveyed by colour alone — always pair a
`--tone-*` tint with the word ("Rough guess").

---

## Technical Requirements

- Existing tokens and `.usm-*` primitives. TypeScript / one UI framework / justified
  dependencies allowed per `RUN-SHEETS.md` Stack policy. Privacy rules are not relaxed.
- One breakpoint: `@media (max-width: 600px)`. This page does not need a second one.
- `rhythm.html` body contains `<nav id="siteNav"></nav>`, the page container, the music mount, and
  `<script type="module" src="/src/rhythm.js"></script>`. No inline script — CSP forbids it.
- `src/rhythm.js` imports, in order: `base.css`, `ui.css`, `animations.css`, `rhythm.css`, then
  calls `initSiteChrome({ active: 'foryou' })` and `initReveal()`.
- **Add `rhythm: resolve(__dirname, 'rhythm.html')` to `rollupOptions.input` in `vite.config.js`.**
  This is the step that gets forgotten. Without it the page works in `npm run dev` and returns a
  silent 404 in production. Verify `dist/rhythm.html` exists before you call this done.
- Copy the CSP meta tag from `index.html` **verbatim**. Add nothing to `connect-src`. The pages must
  stay byte-identical in their CSP so a future diff is meaningful.
- Emoji only for iconography (🌷 is the established Rhythm emoji from `04`). No icon library.
- No `console.log` of anything. Errors go through the small `warn()` helper convention from
  `04-SHARED-FOUNDATIONS.md`, and must never include record contents.

---

## Privacy & Security

Read this section twice. It is the reason this file is long.

### The passphrase is out-of-band information

The unlock passphrase is **supplied by the owner at runtime** and is sensitive project information.

> **To the implementing agent: you must never write the literal passphrase anywhere.** Not in this
> document, not in `src/`, not in a comment, not in a test fixture, not in UI copy, not in a
> placeholder attribute, not in a commit message, not in a log line, not in a `.env`, and **not as
> a Firebase Functions secret** — there is no server component to this feature and adding one would
> defeat it. If you need to refer to it, write "the passphrase the owner will supply at runtime".
> If you discover a literal passphrase anywhere in the repository while working, stop and report it
> rather than using it.

Use a placeholder like `••••••••` or no placeholder at all. Never a hint, never a "forgot?" flow.

### Local-only: the data never leaves the device

- **No Firestore, no Firebase Storage, no Cloud Function, no `fetch`, no `XMLHttpRequest`, no
  `navigator.sendBeacon`, no dynamic `import()` of a remote module, no third-party script.**
- **`rhythm.html` and everything it imports must not import `src/modules/firebase.js`.** This is not
  stylistic. `firebase.js` calls `getAnalytics(app)` at module scope with no consent gate, so a
  single transitive import would send a Google Analytics pageview for this page to Google. Also
  avoid importing anything that imports it — `auth.js`, `upload.js`, `gallery.js`,
  `memoriesGallery.js`, `memoryAdmin.js` are all off-limits for that reason.
- A grep-based check for this is a required part of Verification below.
- No analytics, no error reporting, no crash telemetry, no performance beacon.

### "Casual UI lock" vs "Actual security"

These are different things and conflating them is how people end up trusting something they
shouldn't. Both subsections below must also be reflected honestly in the UI copy.

#### Casual UI lock — what the gate alone gives you

A passphrase prompt on a static page is, by itself, **not authentication.** There is no server to
verify against. If the records were stored as plaintext in localStorage, anyone holding the unlocked
phone could open devtools, or just read the values in the Application panel, and the gate would be
theatre. The lock screen's honest job is narrow: it stops a casual over-the-shoulder glance and it
stops someone who picks up the phone and taps around.

**Never describe obscurity as authentication.** The name "Rhythm" and the discreet tab title are
privacy-by-discretion, not security. Do not write UI copy or comments that imply otherwise.

#### Actual security — what the encryption gives you

The real protection is that the payload is **encrypted at rest** and the key is never stored:

- `createStore('rhythm', { version: 1, encrypted: true })` from `04-SHARED-FOUNDATIONS.md`.
- **PBKDF2-SHA256, ≥250,000 iterations**, 16-byte random salt, deriving an **AES-GCM** key.
- Fresh 12-byte IV per write. On-disk envelope
  `{ v, alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations, salt, iv, ciphertext }`, base64.
- The `CryptoKey` is **non-extractable**, held only in a module-scoped variable, and dies with the
  page. The passphrase itself is never assigned to anything long-lived, never put in
  `sessionStorage`, and never persisted.
- **No verification hash is stored.** A wrong passphrase is detected by AES-GCM authentication
  failure, which is the correct check and leaks nothing.

What that actually buys, stated plainly: **the ciphertext in localStorage is unreadable without the
passphrase.** Someone with the phone, the repo, a disk image, or a browser-profile backup gets
nothing but noise. That is genuine protection at rest and it is the strongest thing achievable
without a backend.

What it does **not** protect against, and you must not imply otherwise:

- A device that is already unlocked **with a live session on this page** — the data is decrypted in
  memory and on screen.
- Malware, a keylogger, or a malicious browser extension.
- Someone watching her type the passphrase.
- Someone who knows or guesses the passphrase.

### Unrecoverable loss — say it in the UI

On the unlock screen (and again in Settings), in plain words:
*"There's no way to reset this. If the passphrase is forgotten, the entries are gone for good —
that's the trade for keeping them truly private. Download a copy if you want a safety net."*

This sentence goes **in the interface**, not only in this document.

### Never in LoveGPT, never in the RAG index

- Nothing from this feature may ever be added to `functions/knowledge/chunks.json`. Not a summary,
  not a date, not a cycle length, not a symptom.
- LoveGPT must have no awareness that this page exists.
- **Pre-existing concern to flag, not to fix here:** `functions/knowledge/chunks.json` already
  contains a `health_details` section, which means health information about her is already in the
  RAG corpus that a Gemini call sees. That predates this feature and is out of scope for this
  prompt. Record it as an open item for `13-SECURITY-REVIEW.md` (not yet written) and move on. Do
  not edit `chunks.json` in this task for any reason.

### Head, history, and hostile-glance details

- `<title>Rhythm &mdash; Us Machina</title>`. **Not** "Period Tracker", not "Cycle", no 🩸.
- `<meta name="description" content="Rhythm — a private page in Us Machina." />` — must not mention
  periods, cycles, or health. It is a public repo; this string is world-readable.
- Add `<meta name="robots" content="noindex, nofollow" />` and
  `<meta name="referrer" content="no-referrer" />`. Both are meta-supported and both are cheap.
- **Browser history:** never push state. No query parameters, no hash fragments, no
  `history.pushState` carrying dates or record ids. A URL must never contain data. Navigation within
  the page is DOM-only.
- **Autofill:** the passphrase input is `type="password"`, `autocomplete="off"`, no `name`
  attribute, `spellcheck="false"`, `autocapitalize="off"`, `autocorrect="off"`, and **not inside a
  submitting `<form>`**. Browsers should not offer to save it and password managers should not
  associate it with the origin.
- **Shared or borrowed device:** provide a visible **"Lock now"** button; auto-lock after
  `settings.autoLockMinutes` (default 5) of the tab being hidden, via `visibilitychange`; and lock
  on `pagehide`. Locking drops the `CryptoKey` reference and clears all decrypted records from the
  DOM and from module state. Never leave decrypted content behind a `display: none`.
- **For You hub:** `04-SHARED-FOUNDATIONS.md` forbids leaking Rhythm state onto `foryou.html`, and
  that stands. The Rhythm card shows static copy only — no "next window in about a week", no count,
  no dot. The hub is visible without the passphrase; anything on it is public to a glance.

---

## Do Not

- Do not import `src/modules/firebase.js`, or anything that imports it.
- Do not add any network call, of any kind, for any reason.
- Do not write the passphrase anywhere, or add a hint, reset, or recovery flow.
- Do not store a verification hash of the passphrase.
- Do not present a single predicted date, a countdown, or a percentage confidence.
- Do not offer **fertility windows, ovulation estimates, conception odds, or contraception
  implications.** Explicitly out of scope. Reason to state in the prompt and honour in code: those
  are medical claims with real consequences, derived from data this app does not have (basal
  temperature, LH, cervical mucus) using models it has not validated. A wrong ovulation window can
  cause an unplanned pregnancy. This app has no business making that claim, so it does not make it.
- Do not build medication or contraceptive-pill tracking, temperature logging, weight, doctor
  reports, PDF exports for a clinician, or any pregnancy feature.
- Do not add charts beyond the single honest cycle-length list.
- Do not add hearts, pink ribbons, flowers-as-decoration, or Valentine's styling. 🌷 in the nav is
  the entire decorative budget.
- Do not add KPI/stat cards, streaks, badges, "logging consistency", or any number that implies she
  owes the app something.
- Do not write fake statistics ("94% accurate", "your cycle is very regular").
- Do not add a second breakpoint, a new gradient, a new token, or `backdrop-filter` on cards.
- Do not touch the other feature's files, `chunks.json`, `functions/**`, or the rules files.

---

## Implementation Strategy

Commit after each step. Steps 2 and 3 are where a mistake is expensive.

1. **`cyclePredict.js` first.** Pure, no DOM, no storage. Write it, then exercise it in the browser
   console against hand-made arrays: zero records, one, two, three, six, one with a 45-day outlier,
   one with a duplicate start date, one where the window is already past. Get the maths and the
   tier boundaries right before any UI exists.
2. **`rhythmStore.js`** on top of the encrypted store: `unlock(passphrase)`, `lock()`, `list()`,
   `add(record)`, `update(id, patch)`, `remove(id)`, `exportJson()`. Verify in DevTools that the
   localStorage value is opaque base64 before you build a single pixel of UI.
3. **The lock screen and the auto-lock lifecycle.** Wrong passphrase, correct passphrase, reload,
   lock now, hidden-tab timeout, `pagehide`. Confirm no plaintext survives a lock.
4. **`rhythm.html` + `vite.config.js` entry + `rhythm.css` skeleton.** Run `npm run build` and
   confirm `dist/rhythm.html` exists. Do this early — do not discover the missing input entry at
   the end.
5. **The answer card and the one-tap button**, in that order. The page should be useful with
   nothing else built.
6. **History list, edit, delete, undo.**
7. **Optional detail disclosure.**
8. **Settings: export, lock now, the loss warning.**
9. Remove `data-coming-soon` from the Rhythm card in `src/foryou.js`. Confirm no state hint leaked.
10. Re-read the Privacy & Security section against the finished diff, line by line.

---

## Acceptance Criteria

1. `npm run build` succeeds and `dist/rhythm.html` exists.
2. `npm run preview` serves the page at `/lovesite/rhythm.html` with working nav, theme toggle, and
   cross-page music continuity.
3. `grep -rn "firebase" src/rhythm.js src/modules/rhythmStore.js src/modules/cyclePredict.js src/styles/rhythm.css` returns **nothing**, and the built
   chunk for `rhythm.html` contains no Firebase or Analytics code.
4. `grep -rnE "fetch\(|XMLHttpRequest|sendBeacon|EventSource|WebSocket" src/rhythm.js src/modules/rhythmStore.js src/modules/cyclePredict.js` returns **nothing**.
5. With the page open and DevTools → Network recording, unlocking, logging a period, editing, and
   deleting produce **zero** network requests beyond the initial document, JS, CSS, and fonts.
6. DevTools → Application → Local Storage shows a single `usm.rhythm.v1` key whose value is
   base64 ciphertext. No date, symptom, note, or the passphrase appears anywhere in Local Storage,
   Session Storage, IndexedDB, or Cookies.
7. Reload → wrong passphrase → a calm "That's not it." message, no stack trace, no partial data
   rendered. Correct passphrase → records decrypt intact.
8. With 0, 1, and 2 usable cycles the page shows the "I need a couple more cycles" copy and **no
   range**. With 3 it shows a range labelled as a rough guess. With 6 it shows a range plus the
   basis line. At no point does any UI show a single predicted date.
9. Prediction correctness, verifiable in the console: starts
   `['2026-05-01','2026-05-29','2026-06-28','2026-07-26','2026-08-24']` give lengths
   `[28, 30, 28, 29]`, median `28.5 → 29`, and a window centred on `2026-09-22`. Adding a bogus
   `'2026-11-30'` start (97 days) does **not** move the median, and `discardedCycles` is 1.
10. Tapping "Period started today" twice in a row does not create two records; the second tap offers
    the change/keep choice.
11. Undo after the primary tap removes the record completely.
12. A record can be deleted in two taps and stays deleted after reload.
13. "Download a copy" produces a valid JSON file whose contents match the on-screen records, and the
    plaintext warning is shown before the download.
14. "Lock now" clears the screen; hiding the tab for longer than the auto-lock window and returning
    requires the passphrase again; after locking, no record text exists anywhere in the DOM.
15. `<title>`, `<meta name="description">`, and the visible page heading contain none of "period",
    "menstrual", "cycle tracker", or a blood/uterus emoji.
16. `git diff` contains no literal passphrase, and no `chunks.json` change.
17. `foryou.html` shows the Rhythm card with static copy only — no date, count, or status hint.
18. At 375px, the estimate sentence and the primary button are both visible without scrolling, and
    the button is ≥56px tall.
19. Under `prefers-reduced-motion: reduce`, all content is visible and nothing animates.
20. `package.json` dependencies are unchanged.

---

## Verification

```bash
npm run dev            # http://localhost:5173/lovesite/rhythm.html
npm run build          # must be clean
ls dist/rhythm.html    # must exist — the vite.config.js input check

# Local-only enforcement
grep -rn "firebase" src/rhythm.js src/modules/rhythmStore.js src/modules/cyclePredict.js
grep -rnE "fetch\(|XMLHttpRequest|sendBeacon|EventSource|WebSocket" src/rhythm.js src/modules/rhythmStore.js src/modules/cyclePredict.js
grep -rn "getAnalytics\|analytics" src/rhythm.js src/modules/rhythmStore.js
grep -rn "connect-src" rhythm.html                 # must match index.html exactly
diff <(grep -o 'Content-Security-Policy.*' index.html) <(grep -o 'Content-Security-Policy.*' rhythm.html)

# Discretion of the public-facing strings
grep -niE "period|menstrual|cycle tracker" rhythm.html

# Nothing leaked into the RAG corpus
git diff --stat functions/knowledge/chunks.json    # must be empty

# No debug output of records
grep -rn "console\." src/rhythm.js src/modules/rhythmStore.js src/modules/cyclePredict.js

npm run preview        # load /lovesite/rhythm.html
```

**Manual tests, in order:**

1. First visit: unlock screen appears, states the unrecoverable-loss consequence, offers no hint or
   reset. Passphrase field does not trigger a password-manager save prompt.
2. Enter a wrong passphrase → "That's not it." Enter the correct one → empty state with the warm
   one-liner.
3. Tap "Period started today" → confirmation + Undo. Tap Undo → gone.
4. Tap again → record persists. Reload → passphrase required → record still there.
5. Add four more historical starts via "Pick a date" spanning ~5 months. Confirm the tier copy
   changes at 3 usable cycles and again at 5, and that the range widens with fewer cycles.
6. Open the optional disclosure, set an end date, flow, two symptoms, a note. Reload; all present.
7. Edit a start date; the prediction updates. Delete a record; the prediction updates.
8. Search the whole app for anything resembling a fertility or ovulation claim. There must be none.
9. DevTools → Application → clear only `usm.rhythm.v1` → the page returns to the empty state
   without throwing.
10. Throttle to Slow 3G: nav does not flash, the unlock screen renders, the PBKDF2 delay shows the
    skeleton and "Unlocking…" rather than a blank card.
11. Toggle `data-theme="dark"` on `<html>`: every colour resolves, no `#999` grey text.
12. DevTools → Rendering → *Emulate prefers-reduced-motion: reduce*: everything readable.
13. Hide the tab for longer than the auto-lock window, return: locked. Inspect the DOM: no record
    text present.
14. Read every string on the page out loud. If any of it sounds clinical, cutesy, or like it is
    telling her off, rewrite it.

---

## Definition of Done

- [ ] `rhythm.html`, `src/rhythm.js`, `src/modules/rhythmStore.js`, `src/modules/cyclePredict.js`, `src/styles/rhythm.css` created
- [ ] `rhythm: resolve(__dirname, 'rhythm.html')` added to `rollupOptions.input`; `dist/rhythm.html` confirmed
- [ ] CSP meta tag byte-identical to `index.html`; nothing added to `connect-src`
- [ ] `<title>`, description, `robots`, and `referrer` meta tags are discreet
- [ ] No import of `firebase.js` (or anything importing it); no network call of any kind; grep-verified
- [ ] `createStore('rhythm', { version: 1, encrypted: true })` used; localStorage holds only ciphertext
- [ ] No passphrase literal, hint, reset flow, or stored verification hash anywhere
- [ ] "Casual UI lock" vs "Actual security" distinction reflected honestly in UI copy
- [ ] Unrecoverable-loss consequence stated in the interface
- [ ] Export/backup action with its plaintext warning
- [ ] Lock now + auto-lock on hidden tab + lock on `pagehide`, all clearing decrypted state
- [ ] One-tap logging with Undo, "started yesterday", "pick a date", duplicate guard, edit, delete
- [ ] Median-of-last-6 prediction with MAD-based padding, tiered confidence, never a single date
- [ ] No fertility, ovulation, contraception, medication, temperature, or pregnancy feature
- [ ] Empty, loading, and error states all present and written as sentences
- [ ] 56px primary target, 44px elsewhere, `:focus-visible`, `aria-live` confirmation, focus-trapped modal
- [ ] Answer + button visible without scrolling at 375px
- [ ] Nothing added to `functions/knowledge/chunks.json`; the pre-existing `health_details` concern noted for `13-SECURITY-REVIEW.md`
- [ ] Rhythm card on `foryou.html` un-gated but leaking no state
- [ ] Zero new dependencies; `npm run build` clean
- [ ] All 20 acceptance criteria checked
