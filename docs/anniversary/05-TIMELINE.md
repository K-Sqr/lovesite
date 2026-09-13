# 05 — Timeline Expansion & Data Consolidation

**Recommended tool:** Claude Code. **Model:** a strong reasoning model.
Justification: this is a data-model refactor with two consumers (`index.html` preview and
`timeline.html` full page) and a CSS contract that alternates sides with `:nth-child` — a
mechanical agent will silently break the rail. One careful pass beats three cheap ones.

---

## Context

The story currently lives in `src/data/milestones.js` as **two hand-maintained arrays with
duplicated content**: `mainMilestones` (5 entries, an abridged copy) and `fullMilestones`
(18 entries). Editing one does not update the other, and they have already drifted — compare the
`Feb 9, 2026` entry in each: one is titled "First Time In Person", the other "Touchdown Winnipeg",
with different prose. That is the bug this file exists to kill.

The entry shape is `{ date, title, description, icon }`. Two facts the docs get wrong elsewhere:
the field is **`description`, not `desc`**, and **`date` is a display string** (`'Aug 18, 2025'`)
that nothing sorts, filters, or groups by.

`src/modules/timeline.js` is 30 lines that render either array into `.timeline` with `innerHTML`
string interpolation. That is safe today only by luck — the entries are full of typographic
apostrophes and quotation marks, and this feature adds captions and longer prose — so it has to go.

Coverage stops at **`Mar 13, 2026` — "Six Months — Happy 180 Days"**. The relationship started
**`Sep 13, 2025`** (see `loveCounter.js`) and the one-year anniversary is **`Sep 13, 2026`**, so
roughly six months of the story is unrecorded.

## Objective

1. Collapse the two arrays into **one source of truth** — `src/data/timeline.js` — with a richer,
   sortable schema and derived helpers.
2. Rewrite `src/modules/timeline.js` to render safely from that data in two variants (`preview` for
   the home page, `full` for the timeline page) without changing the DOM contract `sections.css`
   and `timeline-page.css` depend on.
3. Add the reading affordances that turn 24+ entries into a story: year chapters, expandable
   entries, photos, type accents, and one scroll-linked rail fill.
4. Replace the fake `days / 30.44` month statistic with real calendar arithmetic, and make every
   remaining statistic derivable from the data.
5. Leave a **clearly marked authoring stub** for the owner to fill the Mar → Sep 2026 gap himself.

## Prerequisites

`01-REPOSITORY-AUDIT.md` read. `02-DESIGN-SYSTEM.md` complete (`src/styles/ui.css`,
`:focus-visible`, the new tokens). `04-SHARED-FOUNDATIONS.md` complete — this file **requires**
`src/modules/reveal.js` and `src/modules/dates.js`; do not start before they exist and do not write
local copies. `03-SECURITY-REMEDIATION.md` is not a hard dependency because the timeline is public
content, but it governs which photos may be added at all (see **Privacy & Security**).

## Existing Files To Inspect

```
src/data/milestones.js             the two arrays being replaced
src/modules/timeline.js            the renderer being rewritten
src/timeline-page.js               calculateStats(), the local observer, initTimeline(true)
src/main.js                        initTimeline() for the home preview (line ~102)
timeline.html                      #fullTimeline mount, #timelineStats mount, no lightbox yet
index.html                         #timelineSection > .timeline mount (line ~47)
src/styles/sections.css            .timeline rail, .timeline-entry, :nth-child alternation (L145–235, L772–789)
src/styles/timeline-page.css       full-page overrides, .stat-card, mobile rail (L31–111)
src/modules/memoriesGallery.js     renderMemoryCard() — the safe-DOM pattern to copy
memories.html                      the #lightbox markup to replicate (L61–65)
src/styles/memories.css            .lightbox styles (already imported by timeline-page.js)
```

## Files You Own (Create)

`src/data/timeline.js` — the single source of truth plus its derived helpers. Nothing else.

## Files You May Modify

```
src/modules/timeline.js            rewrite
src/timeline-page.js               stats, imports, reveal wiring
src/main.js                        the initTimeline() call only
timeline.html                      add the lightbox markup; nothing else
src/styles/timeline-page.css       new classes for year headings, disclosure, photos, rail fill
src/data/milestones.js             DELETE once nothing imports it (verify with grep first)
```

## Files You Must Not Touch

```
src/modules/loveCounter.js         beloved, and 04 explicitly defers it to 16-FINAL-POLISH
src/modules/{buttons,graffiti,textReveal,verses,gallery,upload,memoriesGallery,memoryAdmin}.js
src/modules/{auth,firebase,theme,musicPlayer,siteChrome,storage,reveal,dates}.js
src/styles/{base,animations,sections,memories,lovegpt,ui}.css
memories.html, lovegpt.html, index.html (beyond nothing — see below), foryou.html
functions/**  ·  firestore.rules  ·  storage.rules  ·  vite.config.js  ·  package.json
```

`index.html` needs **no** markup change — the home preview already mounts into
`#timelineSection > .timeline`. `sections.css` is off-limits because the preview must look exactly
as it does today, so every new visual affordance is full-page-only and lives in `timeline-page.css`.

---

## Requirements

### R1 — `src/data/timeline.js`, the single source of truth

One exported array, `timeline`, of entries in this shape:

```js
{
  id: 'the-confession',          // stable slug, kebab-case, unique. Never renumber or reuse.
  date: '2025-08-18',            // ISO YYYY-MM-DD. Sortable. This is the real date field.
  dateDisplay: 'Aug 18, 2025',   // OPTIONAL override. Omit and it is derived from `date`.
  title: 'The Confession',
  description: 'One or two sentences. Shown on the card, always visible.',
  expandedBody: 'OPTIONAL longer prose, revealed by a disclosure button.',
  icon: '\u{1F49C}',             // emoji, as today
  type: 'milestone',             // milestone | trip | anniversary | letter | conversation
                                 // | funny | event | memory
  featured: true,                // drives the home-page preview. Replaces mainMilestones.
  location: 'Winnipeg',          // OPTIONAL
  tags: ['proverbs-18-22'],      // OPTIONAL, free-form, not surfaced in UI yet
  photos: [                      // OPTIONAL
    { src: './photos/first-date.jpg', alt: 'Describes the image', caption: 'Ume Yummy' }
  ],
}
```

Field rules: `id` is the contract with the URL fragment (`timeline.html#the-confession`) and later
with `functions/knowledge/chunks.json`, so once shipped it is permanent. `date` is ISO **only** —
everything that sorts, groups, or counts reads it, and anything shown to a human reads
`dateDisplay ?? formatDisplayDate(date)`. `photos[].src` must be a root-relative `./photos/...`
path (that is how `public/` is served — **not** `./public/photos/...`) or an `https://` URL, and the
renderer enforces that allow-list the way `renderMemoryCard()` does. `alt` is required whenever
`photos` is present; a photo with no `alt` is a bug, not a style choice.

Also export these helpers as pure functions over the array — no side effects, no `Date.now()`
baked into module scope:

```js
export function sortedByDate(order = 'asc')   // stable sort on ISO `date`
export function getFeatured()                  // entries with featured === true, chronological
export function getById(id)
export function groupByYear()                  // [{ year: 2025, entries: [...] }, ...] ascending
export function countByType(type)
export function photoCount()                   // total photos across all entries
```

**Migration is lossless.** Port all 18 `fullMilestones` entries verbatim — same prose, same emoji,
same escapes — adding `id`, ISO `date`, and `type`. Set `featured: true` on exactly the five
moments `mainMilestones` promotes: The Confession, She Said Yes, First Virtual Date, the Feb 9 2026
arrival, and the six-month mark. Where the two arrays disagree (Feb 9 and Mar 13), **keep the
`fullMilestones` wording** — it is the longer, better-written one.

Two entries share `date: '2025-11-14'` (His 23rd Birthday, The Love Journal), so the sort must be
stable and keep their authored order. Do not invent times to disambiguate.

### R2 — `src/modules/timeline.js`, rewritten

```js
export function initTimeline({ variant = 'preview', mount = '.timeline' } = {})
```

Update both call sites: `src/main.js` → `initTimeline({ variant: 'preview' })`,
`src/timeline-page.js` → `initTimeline({ variant: 'full', mount: '#fullTimeline' })`.
Do not keep the old boolean parameter alive; there are exactly two callers.

**Build DOM, never `innerHTML`.** Follow `renderMemoryCard()` in `src/modules/memoriesGallery.js`:
`createElement` + `textContent` for every author-supplied string, and the URL scheme allow-list for
image sources.

**Preserve the DOM contract.** Every entry still renders as:

```html
<div class="timeline-entry reveal" data-delay="1..4" id="the-confession">
  <div class="timeline-icon">💜</div>
  <div class="timeline-date">Aug 18, 2025</div>
  <h3>The Confession</h3>
  <p>…description…</p>
</div>
```

Those five classnames are load-bearing in `sections.css` and `timeline-page.css`. New elements go
*inside* the entry after `<p>` with additive classnames (`timeline-entry--letter`,
`timeline-photos`, `timeline-more`). Nothing existing is renamed.

| | `preview` | `full` |
| --- | --- | --- |
| Source | `getFeatured()` | `sortedByDate('asc')` |
| Year headings | no | yes |
| `expandedBody` disclosure | no | yes |
| Photos | no | yes |
| Rail fill | no | yes |
| Trailing "View full timeline →" link | yes (unchanged) | no |

The preview must render **identically to today**. Keep appending the `.view-all-link` to
`container.parentElement` exactly as the current code does.

### R3 — Year chapters, and the `:nth-child` trap

Group the full variant with a sticky `<h2 class="timeline-year" id="year-2025">2025</h2>` as a
**direct child of `.timeline`** between groups.

> ⚠️ **This breaks the rail.** `sections.css` alternates sides with
> `.timeline-entry:nth-child(odd)` / `:nth-child(even)`, counting *all* siblings. Insert headings
> and the alternation scrambles and the connector dots land on the wrong side.

Fix it in the renderer, not by editing `sections.css`: assign an explicit
`timeline-entry--left` / `timeline-entry--right` class from the entry's **global** index (so
alternation continues across year boundaries rather than restarting), and add higher-specificity
rules in `timeline-page.css`:

```css
.timeline-page .timeline-entry.timeline-entry--left  { margin-left: 0; margin-right: auto; }
.timeline-page .timeline-entry.timeline-entry--right { margin-left: auto; margin-right: 0; }
.timeline-page .timeline-entry--left::after  { right: -32px; left: auto; }
.timeline-page .timeline-entry--right::after { left: -32px; right: auto; }
```

The ≤600px block already forces a single left rail with `!important`; confirm the new selectors do
not defeat it and extend that mobile override to cover them.

Sticky headings use `position: sticky` at the nav height — `body` has a hardcoded
`padding-top: 52px`, so `top: 52px` on desktop. If `04` moved the nav to a bottom bar at ≤600px,
sticky `top` becomes `0` there; handle it in the existing `@media (max-width: 600px)` block rather
than adding a breakpoint.

### R4 — Expandable entries

Entries with `expandedBody` get a real disclosure, not a CSS checkbox hack:

```html
<button type="button" class="timeline-more" aria-expanded="false" aria-controls="the-confession-body">Read more</button>
<div class="timeline-body" id="the-confession-body" hidden>…</div>
```

Toggle `aria-expanded` and `hidden` together; the label flips between "Read more" and "Less"; 44px
minimum target; the button inherits the global `:focus-visible` ring from `ui.css`. If you animate
the height, the `prefers-reduced-motion: reduce` path is an instant show, never a no-op.

### R5 — Photos and the lightbox

Render `photos` as a small row of thumbnails inside the entry, `loading="lazy"` with explicit
`width`/`height` so the rail does not jump as images load — the memories grid has that layout-shift
bug already; do not reproduce it.

`timeline.html` has **no lightbox markup**. Copy the `#lightbox` block from `memories.html`
(L61–65) verbatim. `src/timeline-page.js` already imports `memories.css`, so the styling is free.

Reuse `setupLightbox()` from `memoriesGallery.js` — but note it binds to `.gallery-card`
specifically, so either give thumbnails that class or pass a selector. **If you need a selector
parameter, that is the one permitted edit to `memoriesGallery.js`: an optional argument defaulting
to the current value.** Do not restructure that module.

### R6 — Type treatment

`type` adds a subtle accent only: the entry gains `timeline-entry--<type>` and the icon chip picks
up a tone from `02`'s new tokens. A different border-left colour and nothing else is enough. No
type badges, no filter chips, no legend — eight muted variants of one pink, not a taxonomy.

### R7 — The rail fill (the ONE scroll-linked effect)

A progress line that fills the centre rail as you scroll the full page.

- **This is the only scroll-linked effect on the page.** Everything else uses the existing
  `.reveal` / `.visible` contract via `initReveal()` from `04`. Do not animate every element; no
  parallax, no counters that tick up, no extra slide-ins beyond what `animations.css` already does.
- Implement as a single absolutely-positioned `.timeline-progress` layered over `.timeline::before`,
  its `height` (or `scaleY`) set from one passive, rAF-throttled `scroll` handler — or from CSS
  `animation-timeline: scroll()` with the JS path as fallback.
- Under `prefers-reduced-motion: reduce`, **do not render it at all.** It conveys nothing the static
  rail does not, so if it fails to initialise the page is unaffected.

Stagger discipline: `animations.css` defines only **four** `data-delay` steps, and the current
`(i % 4) + 1` cycling is why long lists arrive in visible waves. Reset the counter **per year
group** and cap it — `Math.min(indexWithinYear, 3) + 1` — so each chapter cascades once instead of
pulsing four-at-a-time down 24 entries.

### R8 — Honest statistics

`calculateStats()` computes `months = Math.floor(days / 30.44)` and shows it as a fact. Replace it
with `calendarDuration(from, to)` from `src/modules/dates.js`, and render exactly four
`.stat-card`s, all derived from real data:

| Number | Label | Source |
| --- | --- | --- |
| `daysBetween('2025-09-13', today)` | days together | `dates.js` |
| `calendarDuration(...)` formatted `1 yr 0 mo` | together | `dates.js` |
| `timeline.length` | moments recorded | data |
| `photoCount()` | photos | data |

If `countByType('letter')` is non-zero it may replace the photos card; do not show five. **Invent
nothing** — no "memories per month", no streak, no percentage, no progress-to-anniversary bar. A
number she cannot verify by counting is what makes a page feel like a dashboard.

Build the cards with `createElement`, not the current `innerHTML` block, and keep the
`.stat-card` / `.stat-number` / `.stat-label` classnames — `02` froze that as the only stat treatment.

### R9 — The content gap (READ THIS TWICE)

The last recorded entry is **`Mar 13, 2026`**. The one-year anniversary is **`Sep 13, 2026`**.
About six months is missing.

> 🔴 **THE AGENT MUST NOT WRITE THESE ENTRIES.**
> Fabricating a memory is the single worst failure possible in this project. A plausible invented
> anniversary, an imagined trip, a made-up conversation — she will read it, know it never happened,
> and every real entry on the page becomes suspect. There is no partial credit and no acceptable
> "I marked it as a placeholder" version. If you are tempted to fill the gap with something
> reasonable, stop: the correct output is an empty, clearly-labelled form.

> ⚠️ **Date discrepancy, to resolve before anyone authors anything.** The owner's brief describes
> the timeline as stopping at *"May 13, 2026 — our 6 month anniversary."* The repository says the
> six-month milestone is **Mar 13, 2026**, which is what `Sep 13, 2025 + 6 months` gives and is
> consistent with `loveCounter.js` and `timeline-page.js`. Either the brief's month is wrong or the
> start date is, and it shifts every anniversary on the page including the one-year mark. **The
> owner must confirm which.** Do not guess, do not average the two. Ask.

Append this block, verbatim, at the end of `src/data/timeline.js`:

```js
// ─────────────────────────────────────────────────────────────────────────────
//  ✍️  AUTHORING STUB — Emmanuel fills this in. Nobody else. No AI.
//
//  Coverage today ends at 2026-03-13. The gap is Mar 2026 → Sep 13 2026.
//  ⚠️ Confirm the six-month date first (repo says Mar 13, the brief says May 13).
//
//  Copy the block below once per real moment, delete the placeholder text, and
//  move the finished object up into the `timeline` array in date order.
//  An entry needs: id, date, title, description, icon, type. Everything else
//  is optional. A one-line entry is worth more than an invented paragraph.
//
//  Worth reaching for, if they happened: a trip, a hard week you got through,
//  something she said that you wrote down, a meal, an inside joke with a date
//  attached, the first time something felt ordinary in a good way.
//
//  {
//    id: '',                  // kebab-case, unique, permanent
//    date: '2026-__-__',      // ISO
//    title: '',
//    description: '',         // one or two sentences, always visible
//    expandedBody: '',        // optional — the longer version
//    icon: '',                // emoji
//    type: '',                // milestone | trip | anniversary | letter
//                             // | conversation | funny | event | memory
//    featured: false,
//    location: '',            // optional
//    photos: [],              // optional — { src, alt, caption }
//  },
//
//  Reserved, do not write until the day: 2026-09-13, one year.
// ─────────────────────────────────────────────────────────────────────────────
```

The renderer must handle the gap gracefully today: a year group with few entries is fine, and
`2026` rendering with only three entries is the honest current state, not an error state.

### R10 — Cross-reference, out of scope here

Appending entries as chunks to `functions/knowledge/chunks.json` would let LoveGPT answer "what
happened in February?". **That is not this task.** Do not touch `functions/`. Note it in the PR
description as a follow-up and move on.

---

## UX Requirements

- **Premium but restrained.** It should read like a printed chapter book, not a feed. Reading order,
  generous spacing, and typography do the work.
- Preserve the existing structure exactly: alternating left/right cards on a centre rail at desktop,
  collapsing to a single left rail at ≤600px.
- `--font-display` stays on `h3` titles as today. A year heading is data, so `--font-body`,
  uppercase, letter-spaced, per the micro-label scale in `02` §2 — likewise dates and buttons.
- Voice: "Read more" / "Less", not "Expand" / "Collapse". No guilt copy, no "you haven't added
  anything since March", no completion meters. The gap is not a failure to nag about.
- No new hearts, no gradients beyond the five that exist, no `backdrop-filter` on new surfaces.
- Everything works at 375px, one-handed. Thumbnails and disclosure buttons are ≥44px.
- Deep-linking: `timeline.html#the-confession` scrolls to that entry. With sticky year headings,
  add `scroll-margin-top` so the target is not hidden under the heading.

## Technical Requirements

- Vanilla ESM. **Zero new dependencies** — `package.json` must not change.
- No `innerHTML` anywhere in the new or modified render paths.
- `src/timeline-page.js` must use `initReveal()` from `src/modules/reveal.js`; delete its local
  `setupScrollReveal()`. `04` requires `reveal.js` to be the only `IntersectionObserver` for
  `.reveal` in the codebase.
- All date maths goes through `src/modules/dates.js`. No `new Date(string)` parsing of display
  strings, no millisecond division, no `30.44`.
- One passive scroll listener maximum on the page.
- No `console.log` left behind.
- Delete `src/data/milestones.js` only after `grep -rn "milestones" src/` is clean.

## Privacy & Security

- **`timeline.html` is a fully public page** — no auth, no gate, crawlable, and the data file is
  committed to a public repo besides. Everything in `src/data/timeline.js` is public forever. Apply
  the judgement `03` applies to the PDFs: titles and warm one-liners are fine, private detail is not.
- `getAnalytics()` already fires here, and entry `id`s can end up in a URL fragment sent to Google
  Analytics. Avoid `id`s that are themselves sensitive.
- Photos come from `public/photos/` only. Do not reference anything under `docs/`, do not re-add a
  file `03` removed, and do not commit a new photo the owner has not explicitly chosen.
- No passcode, hash, or secret goes near this feature. The timeline needs no auth at all.

## Do Not

- Do not invent, infer, or "reconstruct" any relationship event, date, or quote. (R9.)
- Do not edit `src/styles/sections.css` or change the home-page preview's appearance.
- Do not rename or remove `.timeline`, `.timeline-entry`, `.timeline-icon`, `.timeline-date`, or
  `.view-all-link`.
- Do not touch `loveCounter.js` — its month approximation is deferred to `16-FINAL-POLISH.md`.
- Do not add filters, search, a type legend, a minimap, or a "jump to year" dropdown. Sticky
  headings are the navigation.
- Do not add a second scroll-linked effect, parallax, or counting-up numbers.
- Do not add Firestore, Storage, or any network call. This page is static data.
- Do not introduce a date library. `dates.js` exists.
- Do not add `type: 'letter'` entries that quote letter contents — that is `06-LETTERS.md`, and
  those bodies are private.

## Implementation Strategy

1. Write `src/data/timeline.js` with all 18 entries ported and the helpers implemented. Nothing
   consumes it yet; verify `sortedByDate()` and `groupByYear()` in the console.
2. Rewrite `src/modules/timeline.js` for `preview` only, point `src/main.js` at it, and confirm the
   home page is **pixel-identical** to before. Commit.
3. Add the `full` variant: year grouping, left/right classes, `timeline-page.css` rules. Check the
   rail and dots at 1440px and 375px, both themes. Commit.
4. Disclosure, then photos + lightbox, then type accents — one at a time, re-checking the rail after
   each. Commit each.
5. Rail fill last, behind the reduced-motion check.
6. `calculateStats()` on `dates.js`; swap `setupScrollReveal()` for `initReveal()`.
7. Append the authoring stub. Delete `src/data/milestones.js` after grepping.

## Acceptance Criteria

1. `grep -rn "milestones" src/` returns nothing; `src/data/milestones.js` is deleted.
2. `src/data/timeline.js` exports one array containing all 18 original entries with prose byte-identical
   to `fullMilestones`, each with a unique `id`, an ISO `date`, and a `type`.
3. `getFeatured()` returns exactly 5 entries, matching the five moments `mainMilestones` promoted.
4. `grep -rn "innerHTML" src/modules/timeline.js src/timeline-page.js` returns nothing.
5. The home page timeline preview renders the same 5 moments with the same layout and the same
   "View full timeline →" link as before the change, in both themes, at 375px and 1440px.
6. `timeline.html` renders year headings; headings stick under the nav on scroll; entries still
   alternate left/right across year boundaries and every connector dot is on its card's rail side.
7. At ≤600px all entries sit on a single left rail with dots at `left: -37px`, exactly as today.
8. Every entry with `expandedBody` has a `<button aria-expanded>` that toggles correctly, is
   keyboard operable, shows a focus ring, and is ≥44px.
9. Clicking a thumbnail opens the existing lightbox with the correct image and caption; Escape closes it.
10. With `prefers-reduced-motion: reduce`: no rail-fill element exists, all entries are visible
    immediately, and expand/collapse still works.
11. Stats show four cards, all verifiable by hand from the data; `30.44` appears nowhere in `src/`.
12. `calendarDuration('2025-09-13', '2026-09-13')` drives a "1 yr 0 mo" display on Sep 13 2026.
13. `grep -rn "IntersectionObserver" src/` matches only `src/modules/reveal.js`.
14. The authoring stub is present in `src/data/timeline.js` and **no entry dated after 2026-03-13
    exists in the array.**
15. `npm run build` succeeds; `git diff package.json package-lock.json` is empty.

## Verification

```bash
npm run dev                                   # /lovesite/  and /lovesite/timeline.html
grep -rn "milestones" src/                    # → empty
grep -rn "innerHTML" src/modules/timeline.js src/timeline-page.js   # → empty
grep -rn "30.44" src/                         # → only loveCounter.js (untouched, by design)
grep -rn "IntersectionObserver" src/          # → only src/modules/reveal.js
grep -rn "2026-0[4-9]\|2026-1[0-2]" src/data/timeline.js  # → only inside the authoring stub comment
npm run build && npm run preview              # load /lovesite/timeline.html from dist
git diff --stat src/styles/sections.css       # → no change
```

Manual:

- Home page before/after screenshots at 375px and 1440px, light and dark. Any difference is a regression.
- Scroll `timeline.html` end to end: one smooth rail fill, chapters sticking and releasing, no
  wave-pulsing of entry reveals, no thumbnail load shifting the rail.
- Tab through the page: every disclosure button and thumbnail reachable with a visible focus ring.
- DevTools → Rendering → *Emulate prefers-reduced-motion: reduce*, reload, scroll.
- Toggle `data-theme="dark"`; check year headings, type accents, and the rail fill.
- Open `timeline.html#first-virtual-date` fresh; the entry is visible, not hidden under the heading.

## Definition of Done

- [ ] `src/data/timeline.js` created: one array, 18 ported entries, 6 helpers, authoring stub
- [ ] `src/data/milestones.js` deleted; no import of it remains
- [ ] `src/modules/timeline.js` rewritten with `{ variant, mount }` and safe DOM construction
- [ ] Home-page preview verified pixel-identical, both themes, both widths
- [ ] Year chapters with sticky headings; left/right alternation fixed in `timeline-page.css`
- [ ] `aria-expanded` disclosure, photo thumbnails, lightbox markup, restrained type accents
- [ ] Exactly one scroll-linked effect, absent under reduced motion
- [ ] `calculateStats()` on `dates.js`; four honest stats; `30.44` gone from the timeline path
- [ ] `src/timeline-page.js` uses `initReveal()`; its local observer deleted
- [ ] Zero new dependencies; `npm run build` clean
- [ ] Six-month date discrepancy raised with the owner **in writing** (unresolved-but-flagged is
      acceptable; silently picking one is not)
- [ ] **No invented entries.** The Mar → Sep 2026 gap is empty and the stub is waiting.
- [ ] PR description notes the `chunks.json` RAG follow-up as out of scope
