# 12 — The Anniversary Experience

> **This is the emotional payload of the whole project.** The six utilities exist so that this page
> lands as *"he pays attention to my life"* rather than *"he built me a dashboard."* Everything else
> in `docs/anniversary/` is scaffolding for this file.

**Recommended tool:** Cursor Chat, working section by section with him in the loop.
**Model:** a strong reasoning model.
This is not a mechanical build. Half the work is deciding what *not* to include, and every line of
prose has to come from him — which means short iterations with a human reading the output, not a long
autonomous run.

---

## Context

**One-year anniversary: Sunday, September 13, 2026.** The relationship started **September 13,
2025** — the day she opened the coded website he sent her and clicked *Yes*.
`src/modules/loveCounter.js` already encodes that as `new Date(2025, 8, 13)`, and
`src/data/milestones.js` records it: *"She Said Yes — The coded website worked. She clicked yes
immediately."*

That symmetry is the idea, and you should build on it deliberately: **the site began as the question;
a year later it answers it.** The proposal mechanics already in this repo — the character-by-character
sparkle reveal (`textReveal.js`), the No button that dodges through 15 hardcoded zones
(`buttons.js`), the graffiti rain and floating verses fired on *Yes* (`graffiti.js`, `verses.js`) —
are not generic decoration to re-implement. They are the vocabulary of the original moment. Reusing
them is thematically exact and costs almost no new code.

Constraints from `01-REPOSITORY-AUDIT.md`:

- TypeScript / one UI framework / justified dependencies allowed per `RUN-SHEETS.md` Stack
  policy. `celebrate.js` stays hand-rolled — do not add a confetti library.
- **New page = `.html` at repo root + an entry in `rollupOptions.input`.** Both, every time. Missing
  the second means it works in `npm run dev` and 404s in production.
- `base: '/lovesite/'`, so the page lives at `/lovesite/anniversary.html`.
- CSP `default-src 'self'`, `frame-src 'none'`, `connect-src` allow-list duplicated in every HTML
  file. You need no new host, so no CSP change.
- `src/modules/firebase.js` calls `getAnalytics(app)` on import, and `04-SHARED-FOUNDATIONS.md` rules
  that no new page imports it except `letters.html`. **This page must not import it.**
- The `prefers-reduced-motion` block at the end of `src/styles/animations.css` sets all animation and
  transition durations to `0.01ms` and hides `.floating-heart` and `.sparkle`. **Anything that needs
  motion to convey meaning is broken for that user.**
- `src/modules/musicPlayer.js` already owns autoplay, mute state, and the once-per-session hint via
  `sessionStorage` (`music_should_play`, `music_muted`, `music_popup_shown`).

## Objective

A hidden page, `anniversary.html`, that (1) turns itself on for a window around September 13 and can
be previewed on demand without a deploy, (2) tells her the truth about the year using only data that
exists, (3) carries **his** writing rather than a machine's, (4) holds a small number of discoverable
surprises built from mechanics already here, and (5) works on her phone, respects reduced motion, and
lets her leave and come back.

## Prerequisites

- `01-REPOSITORY-AUDIT.md` read; `02-DESIGN-SYSTEM.md` complete (`ui.css`, tone tokens);
  `04-SHARED-FOUNDATIONS.md` complete (`siteChrome.js`, `reveal.js`, `storage.js`, and above all
  `dates.js`).
- `05-TIMELINE.md` **complete** — it creates `src/data/timeline.js` with ISO dates, `id`s, and a
  `featured` flag, which this page reads. **If `05` has not landed, do not fabricate that file and do
  not restructure `src/data/milestones.js`;** build against `fullMilestones` behind a small local
  adapter and leave a marked `TODO` to switch over.
- `06-LETTERS.md` is a soft dependency; the link into Letters degrades to nothing if `letters.html`
  does not exist.

## Existing Files To Inspect

- `src/data/milestones.js` — the real shape `{ date, title, description, icon }`. No `id`, no
  `featured`, and `date` is a display string like `'Aug 18, 2025'` that does not sort. The field is
  `description`, not `desc`.
- `src/main.js` — how `revealTextWithSparkles(MESSAGE, mainMessage, onRevealComplete)` and
  `initButtons(unlockSections)` are actually called, plus the `.locked` / `.unlocked` gate.
- `src/modules/textReveal.js` — `revealTextWithSparkles(text, container, onComplete, charDelay = 45)`
  and `skipReveal()`; it writes into `container.innerHTML` and spawns `.sparkle` on `document.body`.
- `src/modules/buttons.js` — requires ids **`yesBtn`** and **`noBtn`**, pulls text from
  `src/data/noTexts.js`, detaches `noBtn` to `document.body` at `position: fixed; z-index: 400` on
  the first dodge, cycles 15 `ZONES`, and removes it after 15 clicks with an *"I still love you"*
  overlay.
- `src/modules/graffiti.js` — `startGraffitiRain(count = 25)` needs `#graffiti-container`.
  `src/modules/verses.js` — `showFloatingVerses()` needs `#verse-container`.
- `src/modules/loveCounter.js` — `initLoveCounter()` needs `#loveCounter`, runs a 1s `setInterval`,
  rewrites `innerHTML` every tick, and approximates months as `days / 30.44`.
- `src/timeline-page.js` — `calculateStats()` does the same `days / 30.44`. **Do not replicate that.**
- `src/styles/animations.css` — the `.reveal` contract and the reduced-motion block.
  `index.html` — the exact `<head>` you will copy. `vite.config.js` — the four inputs you add a
  fifth to.

## Files You Own (Create)

```
anniversary.html                hidden page; NOT in siteChrome's NAV_LINKS
src/anniversary.js              page entry
src/styles/anniversary.css      page styles, from ui.css primitives
src/modules/anniversaryMode.js  date window + preview flag + the homepage door
src/data/anniversaryContent.js  HIS WORDS. Authoring stubs only — see "Do Not".
```

## Files You May Modify

```
vite.config.js   exactly one line: anniversary: resolve(__dirname, 'anniversary.html')
index.html       exactly one element: <div id="anniversaryDoor"></div> near the footer
src/main.js      exactly one import + one call: initAnniversaryDoor()
DOCS.md          the page, the preview flag, the usm.anniversary.v1 key
```

Nothing else. `git diff --stat` on those four should total well under 15 lines.

## Files You Must Not Touch

- **`src/data/timeline.js` and `src/data/milestones.js`.** You are a reader. No new fields, no
  reordering, no "normalising" dates — `05-TIMELINE.md` owns that data.
- **The Letters feature** — `letters.html`, `src/letters.js`, `src/styles/letters.css`, and any
  Firestore/Storage rules or collections it uses. You link to it; that is all.
- **`src/modules/reminders.js` and `src/modules/notifiers/**`** — owned by `11-NOTIFICATIONS.md`,
  which already registers an anniversary reminder from its own constant.
- **The mechanics you are reusing:** `buttons.js`, `textReveal.js`, `graffiti.js`, `verses.js`,
  `loveCounter.js`, `musicPlayer.js`, `noTexts.js`. **Import them unchanged.** If one does not quite
  fit, adapt your markup to it, not it to you.
- Shared foundations `storage.js`, `dates.js`, `reveal.js`, `siteChrome.js`, `theme.js`; other pages
  and entries (`timeline.html`, `memories.html`, `lovegpt.html`, `foryou.html`, `src/timeline-page.js`,
  `src/memories.js`, `src/lovegpt.js`, `src/foryou.js`); all existing CSS
  (`base`, `ui`, `animations`, `sections`, `memories`, `timeline-page`, `lovegpt`, `foryou`);
  `functions/**`, `firestore.rules`, `storage.rules`, `.github/**`.

---

## Requirements

### R1 — Page decision: a new hidden page, `anniversary.html`

**Recommended, and it is not close.** `index.html` already carries a full narrative device: the
sparkle reveal of the proposal, then `initButtons()`, then `unlockSections()` flipping every
`.locked` section and scrolling to the timeline. Layering a second reveal-and-unlock experience on
top means two competing entrances on one page, and every test of the anniversary content requires
replaying the proposal first.

A separate page gives **testability** (`?anniversary=1` straight to it), **revisitability** (a stable
address she can bookmark, which does not disappear when the homepage leaves anniversary mode), **no
regression risk** to the most beloved page in the repo, and a diff to existing files of four lines.
The cost is two edits instead of one plus duplicated `<head>` boilerplate — both already the
documented norm in `docs/anniversary/PAGE-CHECKLIST.md`. Pay it.

Also: copy the `<head>` from `index.html` **verbatim** (fonts, CSP, icon, viewport) and add
`<meta name="robots" content="noindex, nofollow" />` — the repo is public and this need not be
indexed. The `<title>` must not spoil it (`Us Machina ♥` is right; *"Happy Anniversary!"* is not).
Call `initSiteChrome({ active: null })` but **do not add an entry to `NAV_LINKS`**. Include
`#graffiti-container`, `#verse-container`, and `#loveCounter` mounts, because the mechanics you reuse
require them. Do not import `src/modules/firebase.js`.

### R2 — Anniversary mode: the activation mechanism

In `src/modules/anniversaryMode.js`, all date maths through `dates.js`:

```js
const RELATIONSHIP_START = '2025-09-13';   // matches loveCounter.js's new Date(2025, 8, 13)
const WINDOW_OPENS_DAYS_BEFORE = 2;        // Sep 11
const WINDOW_CLOSES_DAYS_AFTER = 7;        // Sep 20 — she gets a week, not one midnight

export function anniversaryState(now = new Date());
// → { isWindow, isTheDay, yearsTogether, daysTogether, previewed, everOpened }
```

Three ways in; build all three.

1. **The window.** Sep 11 → Sep 20 of any year from 2026, the door is present on the homepage.
   `isTheDay` is true only on Sep 13 and unlocks the one section that is explicitly for the day.
2. **Preview, no deploy required.** `?anniversary=1` on `index.html` or `anniversary.html` forces the
   mode on any date. **Preview must be non-destructive:** it renders everything and writes nothing to
   storage, so his testing never consumes her first-open moment or marks eggs as found. Emit one
   `console.info('anniversary: preview mode')` so he can tell.
3. **A keyboard easter egg.** Typing `ezer` anywhere on `index.html` opens the door regardless of
   date — a nod to the confession milestone, *"Will you be my ezer?"* (`milestones.js`, Aug 18 2025).
   Implement as a rolling 8-character `keydown` buffer, reset after 2s idle, ignored while an input or
   textarea has focus.

**And it must not vanish.** Persist `createStore('anniversary', { version: 1 })` →
`usm.anniversary.v1`, shape `{ firstOpenedAt, openCount, eggsFound: [] }`. Once `firstOpenedAt` is
set, the door stays available **permanently** as a small `✨` in the homepage footer, long after the
window closes. A gift that self-destructs at midnight is a worse gift.

### R3 — The door on the homepage

`initAnniversaryDoor()` renders into `<div id="anniversaryDoor"></div>` and does nothing at all when
the state says it should not be there — no empty wrapper, no reserved space, no layout shift.

When present: one small, unlabelled-but-inviting link near the footer — `✨` plus at most four words
in `--font-display`. **It must not say what it is.** *"Something for today ✨"* is right; *"View your
1-Year Anniversary Recap"* is a product feature, and naming it destroys the discovery. 44px target,
`:focus-visible` ring, keyboard reachable, no pulse that survives reduced motion as a jitter.

### R4 — Content sections

Writing first, data second, surprises last. Each section is a `.usm-card` or a plain section with
`.reveal` + `data-delay` (only four delay steps exist).

1. **The opening.** His words, revealed with `revealTextWithSparkles()` exactly as `main.js` does it —
   same function, same `charDelay`, same skip affordance. This is the direct callback to the original
   page and should feel like it.
2. **The year, honestly.** See R5. Three or four true numbers as sentences, not a row of stat cards.
3. **Timeline highlights.** `featured === true` entries from `src/data/timeline.js`, capped at
   **five to seven**. Render `icon`, `title`, and a *short* line — not the full `description`; the
   whole timeline is one tap away. Link: *"the whole story is still on Our Story →"*.
4. **Then → now.** Two or three pairings: an early photo or quote beside a recent one. Quotes from
   `timeline.js`, photos from `public/photos/`. On mobile this **stacks vertically** with a small
   `then` / `now` label — no swipe comparator, no drag slider fighting the page scroll.
5. **His message.** The longest writing on the page. `--font-display` for the greeting, `--font-body`
   at `line-height: 1.6` for the body, because a long letter in Dancing Script is unreadable. This is
   exactly the split `02-DESIGN-SYSTEM.md` §2 mandates.
6. **A link into Letters:** *"every letter I've written you lives here →"* → `letters.html`. If `06`
   has not landed, omit the section rather than ship a dead link.
7. **The question, re-asked.** Only when `isTheDay` or previewing. A `Yes` / `Not yet` pair using ids
   **`yesBtn`** and **`noBtn`**, wired with `initButtons(onYes)` — unmodified. `Not yet` dodges the
   same 15 zones and cycles the same `noTexts`; `Yes` fires `startGraffitiRain(30)` and
   `showFloatingVerses()` for free, and your `onYes` reveals the closing note. The symmetry with
   September 13, 2025 is the point, and it costs a wrapper and two ids.
8. **The closing note.** Two or three sentences from him. The last thing she reads.

### R5 — Statistics: only what is true

**Hard rule: do not make up statistics.** Everything below is derivable from data this repo holds.
Nothing else may appear as a number.

| Stat | Source | Method |
| --- | --- | --- |
| Exact days together | `RELATIONSHIP_START` | `daysBetween('2025-09-13', today)` |
| Calendar duration | `RELATIONSHIP_START` | `calendarDuration(...)` → `{ years: 1, months: 0, days: 0 }` |
| Moments recorded | `src/data/timeline.js` | `timeline.length` |
| Letters written | Letters (`06`) | its own count, **only if the feature exists** |

`dates.js` `calendarDuration` uses real month-by-month arithmetic. **Do not use `days / 30.44`** —
`loveCounter.js` and `timeline-page.js` both do, and both show her an approximation as a fact. Leave
them alone (`04` forbids touching `loveCounter.js`) but do not inherit the mistake.

**Explicitly forbidden**, because no data supports them: messages sent, hours on call, words written,
miles apart, kilometres travelled, "times you made me laugh", days until the wedding, percentages, a
compatibility score, a streak, a "relationship health" figure. If a number would be lovely and is not
measurable, **write a sentence instead.** *"I have lost count of the number of times you have talked
me down off a ledge"* is better writing than a fake counter, and it is the honest version.

The photo count is the worked example: `src/memories.js` hardcodes six local photos and prepends them
to Firestore results, and this page must not import `firebase.js`, so a truthful total is not
available here. **Omit the photo count.** Write a line about the photos instead; do not print `6`.

Presentation: **no `.stat-card` grid, no KPI row.** Fold numbers into prose — *"Three hundred and
sixty-five days. Eighteen moments I wrote down so I would not lose them."* One number may be
visually emphasised (`--pink-hot`, `--font-body`, larger) as the anchor. One.

### R6 — Easter eggs: three, grounded, discoverable

Not a dozen. Three, each with a defined trigger, each built from something already in the repo, each
findable by a curious person without instructions and not triggerable by accident.

**E1 — `ezer`.** Typed on `anniversary.html`, same rolling-buffer handler as the door, reveals one
extra short note from him. Discoverable because the confession — *"Will you be my ezer?"* — is the
first entry in her timeline and the word is hers.

**E2 — three deliberate taps on the love counter.** Three clicks/taps on `#loveCounter` within 1500ms
fires `startGraffitiRain(30)` + `showFloatingVerses()`. Discoverable because people poke at live
numbers; not accidental because one stray tap does nothing. Requires `#graffiti-container` and
`#verse-container` in the DOM, and note that `initLoveCounter()` rewrites `innerHTML` every second,
so **bind the listener to the wrapper, not a child** — a child listener is destroyed on the next tick.
This is a real bug you will hit if you skip this sentence.

**E3 — the date itself.** In Then → Now, the text `Sep 13, 2025` is quietly clickable
(`cursor: pointer`, no button chrome, `role="button"`, `tabindex="0"`, an `aria-label` that does not
spoil it) and re-reveals the **original 2025 proposal message** through `revealTextWithSparkles()`.
Copy that string into `src/data/anniversaryContent.js` as `ORIGINAL_QUESTION` rather than importing
from `main.js`, which is a page entry and not a module.

Record finds in `usm.anniversary.v1.eggsFound` so one warm sentence can appear once all three are
found. **One sentence.** No `1/3`, no progress bar, no badge, no achievement list. Preview mode never
writes to `eggsFound`.

## UX Requirements

- **Phone first.** She will almost certainly open this on her phone, one-handed, possibly in bed.
  Design at 375px, check 320px does not break, 44px targets. The single existing
  `@media (max-width: 600px)` breakpoint is enough; do not add another.
- **It is a scrollable document, not a slideshow.** No forced sequence, no full-screen step
  navigation, no "next" button she must press eleven times, no viewport-takeover modal, no scroll
  hijacking. **Do not trap her.** She must be able to put the phone down mid-way, come back an hour
  later, and neither lose her place nor be made to restart.
- **She can leave and come back.** No one-time-only content; nothing is consumed by being viewed. The
  re-asked question stays answerable, and answering again is fine.
- **Reduced motion.** That media block kills every transition and hides `.sparkle`, so: the opening
  reveal must still deliver the full text (it does — `revealTextWithSparkles` sets `opacity: 1`
  per span and only the `.sparkle` nodes are hidden), the graffiti egg must still produce something
  legible, and **no meaning may live in motion alone.** Under `prefers-reduced-motion: reduce` the
  page must read completely top to bottom with every word present.
- **Audio.** Do not autoplay anything loud and do not add a second `<audio>` element. `musicPlayer.js`
  already handles autoplay-with-fallback and persists mute state in `sessionStorage`. Include the
  standard `#musicToggle` + `#bgMusic` markup, init it through `initSiteChrome()`, and **never set
  `audio.muted = false` programmatically** — if she muted it elsewhere it stays muted. Integrate, do
  not fight.
- A skip affordance on the opening reveal, matching `#skipBtn`. Visible `:focus-visible` rings
  everywhere including the egg triggers. Both themes verified via `data-theme="dark"` on `<html>`.

## Technical Requirements

- Vanilla ESM, plain CSS, existing tokens, `.usm-*` primitives, emoji not icons. **Zero new
  dependencies.**
- `vite.config.js` gets exactly one new input. Verify `dist/anniversary.html` exists after
  `npm run build` — this is the step people forget.
- No new host, so no CSP edit. No `<iframe>`/`<embed>`/`<object>` — `frame-src 'none'` blocks them.
- All date logic through `dates.js`; no raw-millisecond arithmetic, no `/ 30.44`. All persistence
  through `storage.js` under `usm.anniversary.v1`; no direct `localStorage`.
- Reuse `reveal.js` (`initReveal()` / `observeReveal()`); do not write a fourth
  `IntersectionObserver`.
- Photos need explicit `width`/`height` or `aspect-ratio` to avoid the layout shift the existing
  gallery has, plus `loading="lazy"` below the fold.
- `textContent` for anything derived from stored data; template `innerHTML` only for fully static
  markup, as `verses.js` does.
- One `warn()` helper, no stray `console.log` beyond the single preview `console.info`.
- Fail soft: if `src/data/timeline.js` is missing or empty the page still renders his writing. The
  prose is the payload; the data is garnish.

## Privacy & Security

- The repository is **public**. Every word committed to `src/data/anniversaryContent.js` is
  world-readable by anyone who finds the repo, forever, including in git history. He must decide what
  goes in with that fully in mind — put that warning in a comment at the top of the file.
- **And making the repo private would not fix it.** This file is imported by `src/**`, so Vite
  inlines its contents into `dist/assets/*.js`, which is published to the Pages site — and the Pages
  site is served publicly regardless of repository visibility (see `01-REPOSITORY-AUDIT.md` §7).
  So the honest rule for this file is: **assume anything written here is public, permanently, with no
  mitigation available.** If a sentence is too private for that, it does not belong in the repo — it
  belongs in a Storage-backed letter (`06-LETTERS.md`) or handed to her on paper. That is a real
  option and for the most personal lines it may be the better one.
- `noindex, nofollow`, and no link from any indexed nav. Do not import `firebase.js`: no analytics
  pageview, no Firestore or Storage read.
- Surface nothing from Rhythm, People, Applications, or the encrypted store. This page reads timeline
  data, a letter count, and his own words.
- Do not reference the PDFs in `docs/` (`boo.pdf`, `journal.pdf`, `Happy 180 days.pdf`).
  `03-SECURITY-REMEDIATION.md` exists because those are currently exposed; do not create a second
  path to them. No passcode or passphrase in source, comments, or fixtures.

## Do Not

- **Do not write her love letter.** This is the most important line in this document.
  `src/data/anniversaryContent.js` ships as **authoring stubs only**: exported constants whose values
  are `''`, each with a `// TODO(emmanuel):` comment saying what belongs there, roughly how long, and
  where it appears. You may write structural copy — a section label, a link caption, an `aria-label`.
  You may **not** write, draft, suggest, or "give an example of" a personal message, memory,
  sentiment, inside joke, pet name, or closing line. Not as a placeholder, not in a comment, not "for
  him to edit". An AI-generated love letter is the single worst possible outcome of this entire
  project, and a draft he lightly edits is still that. If a stub is empty at runtime, render a loud,
  obviously-unfinished marker (`.usm-empty`, "⚠️ unwritten — <what goes here>") and `console.warn`.
  Ugly and unmistakable is correct; plausible filler that ships by accident is a catastrophe.
- Do not invent statistics, or any number you cannot trace to a line of stored data (R5).
- Do not add a nav entry, and do not add a For You card that reveals what this is. `04` already lists
  this as *"✨ (hidden) — not a nav item, by design."* Discovery is the feature.
- Do not add more than three easter eggs. Twelve hidden things is a scavenger hunt, and a scavenger
  hunt is a chore.
- Do not restructure the timeline data or touch the Letters feature. You read; you do not own.
- Do not modify `buttons.js`, `textReveal.js`, `graffiti.js`, `verses.js`, `loveCounter.js`, or
  `musicPlayer.js`. Adapt your markup to their existing requirements.
- Do not add a countdown to next year, a "days until forever" figure, or a second live `setInterval`
  counter. `loveCounter.js` is the one counter.
- Do not add glassmorphism beyond `var(--card-bg)` on overlays, a sixth gradient, a heart on every
  section, Valentine's-card aesthetics, a floating 3D orb hero, a "Your Year in Review" wrapped-style
  card deck, corporate phrasing, or guilt language. Do not autoplay audio or add video.

## Implementation Strategy

1. **`anniversaryMode.js` first, headless.** `anniversaryState(now)` with an injected clock, the
   window maths, the query flag, the `ezer` buffer, and the store. Verify from the console with fake
   dates: Sep 10 (closed), Sep 11 (open), Sep 13 (`isTheDay`), Sep 21 (closed unless
   `firstOpenedAt` is set).
2. `anniversary.html` + `vite.config.js` + `src/anniversary.js` + `anniversary.css` as a skeleton with
   visible placeholders. Run `npm run build` and confirm `dist/anniversary.html` **now**, not later.
3. `src/data/anniversaryContent.js` with **every stub empty** and the unwritten-marker rendering
   working. Hand it to him. His writing is the long-lead item; everything else is built around
   whatever length he produces.
4. Data sections: honest stats via `dates.js`, then featured highlights, then Then → Now.
5. The opening reveal via `revealTextWithSparkles()` + skip button.
6. The re-asked question via `initButtons()` with ids `yesBtn` / `noBtn`.
7. The three eggs. E2's listener-on-the-wrapper detail will bite you; re-read R6.
8. The homepage door — `#anniversaryDoor` in `index.html`, one import and one call in `main.js`.
   Confirm the homepage is behaviourally identical when the door is absent.
9. Mobile pass at 375px, both themes, reduced motion, keyboard-only. Then `DOCS.md`.

Commit after each step. Step 3 gates the whole thing emotionally; do it early even though it is not
code.

## Acceptance Criteria

1. `npm run build` succeeds, `dist/anniversary.html` exists, no new dependency in `package.json`.
2. `npm run preview` serves `/lovesite/anniversary.html` with every asset resolving — no 404 on a
   photo, font, or stylesheet.
3. `grep -rn "firebase" src/anniversary.js src/modules/anniversaryMode.js` → nothing.
4. `grep -rn "30.44" src/anniversary.js src/modules/anniversaryMode.js` → nothing;
   `calendarDuration('2025-09-13', '2026-09-13')` renders as **one year** and `daysBetween` as **365**.
5. **Fake clock:** Sep 10 2026 → no door and no reserved DOM space; Sep 11 → door; Sep 13 →
   `isTheDay` true and the re-asked question rendered; Sep 21 with an empty store → no door; Sep 21
   with `firstOpenedAt` set → door.
6. `index.html?anniversary=1` shows the door on any date; `anniversary.html?anniversary=1` renders the
   full experience including `isTheDay` content and **writes nothing** to `usm.anniversary.v1`.
7. Typing `ezer` on the homepage opens the door on any date; typing it into a focused input does not.
8. **No fabricated prose.** Every export in `src/data/anniversaryContent.js` holding personal writing
   is either `''` or written by him; `grep -c "TODO(emmanuel)"` on that file is greater than zero on
   first delivery. This criterion fails if a single sentence of invented affection ships, including in
   a comment.
9. **No fabricated numbers.** Every numeral on the page traces to `dates.js`, `timeline.length`, or a
   Letters count. No photo count. No "messages", "hours", "miles", percentage, or score anywhere.
10. No `.stat-card` grid; numbers live inside sentences with at most one visually emphasised.
11. `anniversary.html` is absent from `NAV_LINKS` and from every nav on every page;
    `grep -rn "anniversary.html" *.html src/` shows it only in `vite.config.js`, its own file, and the
    JS-rendered door.
12. `<meta name="robots" content="noindex, nofollow">` present, and the `<title>` does not spoil it.
13. All three eggs fire from their documented triggers, and none fires from a single accidental tap, a
    normal keystroke, or a scroll.
14. The counter egg still fires after the page has been open 30 seconds — proving the listener
    survives `initLoveCounter()`'s per-second `innerHTML` rewrite.
15. With `prefers-reduced-motion: reduce`, every section and word is visible, the opening message is
    fully present, nothing animates, nothing is stuck at `opacity: 0`.
16. Arriving with music muted from another page, the page does not unmute; no second `<audio>` in the
    DOM.
17. At 375px: no horizontal scroll, every target ≥44px, Then → Now stacks.
18. Keyboard-only: the door, skip button, both question buttons, and E3's clickable date are reachable
    with a visible focus ring.
19. Both themes read correctly and `anniversary.css` contains no hardcoded hex.
20. **Homepage regression:** with the door absent, `index.html` behaves exactly as before — proposal
    reveal, skip, No-button dodge and disappearance, graffiti, floating verses, unlock, counter,
    gallery, verses, theme, cross-page music.
21. With `src/data/timeline.js` missing or empty, the page still renders his writing without throwing.
22. `git diff --stat` touches only `vite.config.js`, `index.html`, `src/main.js`, `DOCS.md`, plus the
    five created files.

## Verification

```bash
npm run dev                                  # /lovesite/anniversary.html?anniversary=1
npm run build && ls dist/anniversary.html    # must exist
npm run preview                              # load /lovesite/anniversary.html
grep -rn "anniversary" vite.config.js        # the input entry is really there
grep -rn "30.44" src/                        # only loveCounter.js + timeline-page.js (untouched)
grep -rn "TODO(emmanuel)" src/data/anniversaryContent.js
grep -rniE "messages sent|hours on call|miles apart|score|streak" src/anniversary.js
grep -rn "IntersectionObserver" src/         # still only src/modules/reveal.js
git diff --stat
```

Manual:

- Console:
  `(await import('/src/modules/anniversaryMode.js')).anniversaryState(new Date('2026-09-10'))`,
  then `-09-11`, `-09-13`, `-09-21`.
- Load `?anniversary=1`, then DevTools → Application → Local Storage: `usm.anniversary.v1`
  **unchanged**. Load without the flag inside the window: `firstOpenedAt` set once, reload increments
  `openCount` and nothing else.
- Fire all three eggs, reload, confirm nothing regressed and the single "you found them all" sentence
  appears once with no counter.
- DevTools → Rendering → *Emulate prefers-reduced-motion: reduce*, then read the whole page top to
  bottom. Device toolbar at 375px and 320px, both themes, one-thumb scroll.
- Start music on `index.html`, mute it, navigate here: still muted, hint does not re-pop.
- Load `index.html` outside the window with a cleared store; confirm it is visually and behaviourally
  identical to `master`.

## Definition of Done

- [ ] `anniversary.html` created, `<head>` copied verbatim from `index.html` plus `noindex`
- [ ] `vite.config.js` has the `anniversary` input and `dist/anniversary.html` builds
- [ ] `src/anniversary.js`, `src/styles/anniversary.css`, `src/modules/anniversaryMode.js` created
- [ ] `src/data/anniversaryContent.js` created with **empty, clearly marked authoring stubs** and a
      public-repository warning — **no AI-written prose anywhere in it**
- [ ] Date window + `?anniversary=1` preview + `ezer` trigger all working, preview non-destructive
- [ ] `usm.anniversary.v1` records `firstOpenedAt` / `openCount` / `eggsFound`; the door persists
      after the window closes
- [ ] Honest stats only, via `dates.js`; no photo count; no stat-card grid
- [ ] Featured highlights capped at 5–7, reading `src/data/timeline.js` without modifying it
- [ ] Opening reveal via `textReveal.js`; re-asked question via `initButtons()` with `yesBtn` /
      `noBtn`; both modules unmodified
- [ ] Exactly three easter eggs, each with a documented trigger; the counter listener survives the 1s
      `innerHTML` rewrite
- [ ] Homepage door: one element in `index.html`, one import and one call in `src/main.js`, no
      regression
- [ ] Not in `NAV_LINKS`, not on the For You hub, no spoiler in `<title>` or the door copy
- [ ] Reduced motion, 375px, both themes, keyboard-only all verified
- [ ] Zero new dependencies, no CSP change, no Firebase import, no service worker
- [ ] All 22 acceptance criteria verified
- [ ] `DOCS.md` updated: the hidden page, the activation window, the preview flag, the `ezer` trigger,
      the `usm.anniversary.v1` key, and the rule that the prose in `src/data/anniversaryContent.js` is
      his and is never machine-generated
