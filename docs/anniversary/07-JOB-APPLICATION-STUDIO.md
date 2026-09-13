# 07 — The Application Desk

**Recommended tool:** Claude Code. One self-contained page with three sub-views, a real data
schema, and a template file that needs genuinely good prose written into it — a batch agent that
holds the whole feature in one pass beats incremental chat edits here.
**Model:** a strong reasoning model. The difficulty is in the prompt templates and the tone of the
tracker copy, not in the DOM work.

---

## Context

She is applying for psychology jobs in Manitoba and she already finds the postings herself, browsing
boards like `mansomanitoba.ca/jobs` directly. **Job discovery is not the problem. Do not build a
job board, a scraper, or a "recommended roles" feed.**

Her actual loop today: browse boards (1), find a job worth applying to (2), copy the job description
somewhere (3), hunt through her files for a previous resume (4), hunt for previous cover letters and
materials (5), paste all of it into Claude (6), generate a tailored resume (7), generate a cover
letter (8), open her references document and edit it for this employer (9), apply (10).

She has had **one interview so far.** That number matters for tone: this feature must never imply
she is underperforming. The failure in her workflow is not effort — it is that **application
preparation is fragmented and repetitive.** Steps 3 through 9 are redone from scratch every time,
and the slowest parts are the hunting (4, 5, 9) and the re-assembly (6).

The project principle applies with full force here: **reduce mental load, don't create another app
she has to maintain.** A tracker she has to feed is a cost. A tracker that pays her back in one tap
— "here is the prompt, copy it" — is a gift. Judge every field on this page against that.

## Objective

Build `applications.html`, nav label **"The Application Desk"** — a calm, phone-first page with a
centrepiece and two supports:

1. **Prepare My Claude Prompt** (the MVP, the centrepiece) — paste a job description, pick which
   saved materials to include, pick tone and constraints, get **one** structured prompt with a big
   Copy button.
2. **Materials library** — reusable text blocks (master resume, previous cover letters, experience
   blurbs, references) so steps 4, 5 and 9 stop being a file hunt.
3. **Tracker** — a quiet list that answers "where was I with this one?" and nothing more.

### Why the assembler and not a Claude API integration

Decided. Do not re-open it.

| | **Prompt assembler (build this)** | **Claude API integration (defer)** |
| --- | --- | --- |
| Effort | ~1 day, pure client-side string assembly | Second Cloud Function, secret management, streaming UI, retry and rate-limit handling. Multiple days. |
| Cost | $0 | Per-token billing on top of the Claude Pro subscription she already pays for |
| Risk | None — no network, no key, no quota | An API key with nowhere safe to live, a new failure surface, a new thing to maintain |
| Result | Claude Pro's own UI: full context window, projects, follow-ups, artifact editing | A worse, thinner chat we rebuilt badly |
| Steps removed | 6 of 10 | 7 of 10, and only if it works perfectly |

The decisive argument is the hosting reality from `01-REPOSITORY-AUDIT.md`: this is static GitHub
Pages and **there is nowhere safe to put an API key.** Everything in `src/` is publicly readable —
the repo is public. The only server-side surface in the project is the single Firebase Cloud
Function behind LoveGPT, so an API path means a second function, a second secret, new billing,
added latency, and rate limits, in exchange for a *worse* experience than the tool she already
trusts. And the deeper point: **she already uses Claude and it works.** An in-house chat takes her
*out* of a workflow she is fluent in. The assembler meets her where she is and kills the hunting.

**Phase 3, deferred and explicitly out of scope:** if she ever says "I wish it just wrote it here,"
revisit an API path as a second Cloud Function with the key as a Functions secret. Do not scaffold
for it, do not leave a disabled "Generate with AI" button.

## Prerequisites

- `01-REPOSITORY-AUDIT.md` read.
- `02-DESIGN-SYSTEM.md` complete — `src/styles/ui.css` exists with the `.usm-*` primitives and the
  `--tone-*` / `--space-*` / `--surface-sunken` / `--border-subtle` tokens.
- `04-SHARED-FOUNDATIONS.md` complete — `src/modules/siteChrome.js`, `storage.js`, `reveal.js`,
  `dates.js` exist, and `foryou.html` has a 💼 Application Desk card carrying `data-coming-soon`.
- Read `docs/anniversary/PAGE-CHECKLIST.md` and follow it. Step 2 is the one people forget.

## Existing Files To Inspect

| File | Why |
| --- | --- |
| `src/memories.js` | Page-entry pattern: CSS imports at top, everything inside `DOMContentLoaded`, state in module-scoped `let`. Copy this shape. |
| `src/modules/memoriesGallery.js` | `renderMemoryCard()` is the house card-builder — `createElement` + `textContent`, never `innerHTML` for data. Your row renderer mirrors it. |
| `src/styles/memories.css` | `.upload-panel` / `.active`, header layout, `.memories-empty`, the single `@media (max-width: 600px)` block. |
| `src/styles/base.css` | The token list. Nothing outside it may be hardcoded. |
| `src/modules/storage.js`, `src/modules/dates.js` | The `createStore` contract and the date helpers you consume. |
| `vite.config.js`, `memories.html` | The `rollupOptions.input` map to extend; the `<head>` to copy verbatim. |

## Files You Own (Create)

```
applications.html                  page shell (repo root)
src/applications.js                page entry
src/styles/applications.css        page styles
src/data/promptTemplates.js        the editable prompt templates (R2)
src/modules/applicationsStore.js   domain layer over createStore: CRUD, ordering, reminder seam
```

## Files You May Modify

```
vite.config.js      add exactly one input entry: applications
src/foryou.js       remove data-coming-soon from the Application Desk card only
DOCS.md             one paragraph: the page, its two store keys, its data shapes
```

## Files You Must Not Touch

`people.html`, `src/people.js`, `src/styles/people.css`, `src/modules/peopleStore.js`,
`src/data/messageTemplates.js` — **owned by `08-FRIENDS-FAMILY.md`, which may be running in
parallel.**

Also off limits: `src/modules/storage.js`, `dates.js`, `reveal.js`, `siteChrome.js` (foundations —
if one is wrong, report it, do not patch it here) ·
`src/styles/{base,ui,sections,animations,memories,timeline-page,lovegpt}.css` · `index.html`,
`timeline.html`, `memories.html`, `lovegpt.html`, `foryou.html` ·
`src/{main,timeline-page,memories,lovegpt}.js` · `src/data/{milestones,verses,noTexts}.js` ·
`src/modules/firebase.js` and everything importing it · `functions/**` · `firestore.rules` ·
`storage.rules` · `package.json`.

Also, when they exist: `letters.html`, `rhythm.html`, `outfit.html` and their `src/*.js` /
`src/styles/*.css` counterparts, owned by `06`, `09`, and `10` respectively. Do not create them here.

## Requirements

### R1 — Page shell and registration

Per `PAGE-CHECKLIST.md`: `applications.html` at repo root with the `<head>` copied verbatim from
`memories.html`; body holds `<nav id="siteNav"></nav>`, the page container, and the music mount.
`src/applications.js` imports `base.css`, `ui.css`, `applications.css`, then calls
`initSiteChrome({ active: 'foryou' })` and `initReveal()`.

**Add `applications: resolve(__dirname, 'applications.html')` to `rollupOptions.input` in
`vite.config.js` in the same commit as the HTML file.** The audit is blunt: forgetting it means the
page works in `npm run dev` and silently 404s in production.

Three views behind a segmented control — **Prepare · Materials · Applications** — defaulting to
Prepare. One `<div role="tablist">` with three buttons, `aria-selected`, arrow-key support, panels
swapped by toggling `hidden`.

### R2 — Prompt assembler (the centrepiece)

Give it the most vertical space, the largest type, and the page's only gradient button.

**Inputs.** A job-description textarea as the primary field (≥8 rows, autofocus on desktop only),
plus optional organization, position, url, deadline. Then a **template picker** (Tailor my resume ·
Write a cover letter · Update my references — three pills, one selected); a **materials checklist**
generated from her library and grouped by `kind`, pre-checked sensibly per template (resume →
`resume` + `blurb`; cover letter → `resume` + `blurb` + `coverLetter`; references → `references`);
and **tone/constraint** controls (tone pills: Warm and professional · Direct · Plain and clinical;
length select: One page · Two pages · Match the posting) feeding `{{constraints.*}}`.

**Output.** One `<pre>` preview in a `--surface-sunken` well — monospace, scrollable,
`max-height: 45vh` — rendered live as she types, debounced ~200ms, plus:

- A **Copy prompt** button, full width on mobile, the largest control on the page. Use
  `navigator.clipboard.writeText(text)`; on rejection or absent API fall back to a hidden
  `<textarea>` + `select()` + `document.execCommand('copy')`; if that also fails, select the preview
  text and show "Select all and copy — your browser blocked automatic copying." **Always confirm
  visibly**: the label becomes "Copied ✓" for 2s *and* a `role="status"` region announces "Prompt
  copied." Never rely on the label change alone.
- **Save to applications** — creates a tracker record from the same fields at status `Preparing`,
  `discoveredAt = now`. This is the only bridge between assembler and tracker, and it is why she
  never types the same thing twice.
- A character count with a calm note past ~60,000 characters: "This is a long prompt — Claude will
  handle it, but you may want to trim the older cover letters."

**`src/data/promptTemplates.js`** is a real file with real prose. Interpolation is `{{token}}`
replaced from a flat context object; **empty sections are omitted entirely**, never rendered as
"(none)".

```js
// src/data/promptTemplates.js
// EVERY template must instruct Claude not to invent experience. That rule is non-negotiable
// and must survive any future edit to this file.
export const promptTemplates = [
  {
    id: 'resume',
    label: 'Tailor my resume',
    // Tokens: {{position}} {{organization}} {{url}} {{jobDescription}}
    //         {{materials}} {{constraints.tone}} {{constraints.length}}
    body: `I'm applying for a job and I'd like help tailoring my resume to it.

## The role
{{position}} at {{organization}}
{{url}}

## The job description
"""
{{jobDescription}}
"""

## My materials
{{materials}}

## What I want from you
Rewrite my resume so it speaks directly to this posting.

Rules:
1. Use only the experience, skills, education, and credentials that appear in my
   materials above. Do not invent, upgrade, or imply anything I did not give you.
   If the posting asks for something I have not evidenced, list it at the end
   instead of writing it into the resume.
2. Keep my real job titles, employers, and dates exactly as written.
3. Where the posting's language honestly matches something I actually did, use
   the posting's vocabulary rather than mine.
4. Start each bullet with the action and end with the outcome. Keep the numbers I
   gave you; do not create new ones.
5. Tone: {{constraints.tone}}. Length: {{constraints.length}}.

Give me, in this order: (a) the tailored resume as plain text I can paste into a
document, (b) a short list of what you changed and why, (c) anything in the
posting I do not currently evidence.`,
  },
  {
    id: 'cover',
    label: 'Write a cover letter',
    body: `I'm applying for a job and I'd like help writing the cover letter.

## The role
{{position}} at {{organization}}
{{url}}

## The job description
"""
{{jobDescription}}
"""

## My materials
{{materials}}

## What I want from you
Write a cover letter for this specific posting.

Rules:
1. Ground every claim in my materials above. No invented experience, no invented
   metrics, no "passionate about" filler I did not say myself.
2. Name the organization and the role, and say something specific about this
   posting — not something that would fit any employer.
3. Three to four short paragraphs, no more than one page.
4. Tone: {{constraints.tone}}. Write like a person, not like a template.
5. Do not open with "I am writing to express my interest in."

Give me the letter, then two alternative opening paragraphs so I can choose.`,
  },
  {
    id: 'references',
    label: 'Update my references',
    body: `I need to adapt my references page for a specific application.

## The role
{{position}} at {{organization}}

## The job description
"""
{{jobDescription}}
"""

## My current references block
{{materials}}

## What I want from you
1. Keep every name, title, organization, and contact detail exactly as I wrote
   them. Do not change, reformat, or guess at any contact information.
2. Reorder the references so the most relevant to this posting is first, and tell
   me why you chose that order.
3. For each one, draft a single line describing how they know me and what they can
   speak to — using only what my notes already say. Invent nothing.
4. Flag anyone I should ask for a fresh heads-up before listing them.`,
  },
];
```

The `{{materials}}` block is assembled by the page as labelled, fenced sections in a stable order
(resume, blurbs, cover letters, references):

```
### Master resume
"""
…body…
"""

### Experience note — Crisis line volunteering
"""
…body…
"""
```

She can edit template bodies in the UI behind a small "Edit this template" disclosure; edits are
stored as `templateOverrides` in the materials store, with "Reset to default". The file remains the
source of the defaults.

### R3 — Materials library

**This is the single highest-leverage part of the page after the assembler** — it is what actually
kills steps 4, 5, and 9. Say so in the copy: the empty state reads *"Paste your resume in once.
Then never go looking for it again."*

```js
// usm.materials.v1 → { v: 1, updatedAt: <ISO>, data: { items: [...], templateOverrides: {} } }
{
  id: 'mat_l3k9x',                 // crypto.randomUUID() or a short random id
  label: 'Master resume — 2026',
  kind: 'resume' | 'coverLetter' | 'blurb' | 'references' | 'other',
  body: '…plain text…',
  updatedAt: '2026-09-13T18:04:00.000Z',
}
```

- **Text only. No file upload.** There is no backend to upload to, and pasted text is what Claude
  needs anyway. A PDF would need client-side parsing — a dependency, and a worse result than Ctrl+A
  from the document she already has open.
- Rows show label, kind chip, and `formatRelativeGentle(updatedAt)`; tap anywhere to expand into a
  textarea that saves on blur and on explicit Save. Delete confirms. "Duplicate" appends
  `' (copy)'`, because her second cover letter starts from her first.
- No word counts, no completeness score, no "your resume is 40% optimised." That is exactly the
  productivity-app voice this project forbids.

### R4 — Tracker

```js
// usm.applications.v1 → { v: 1, updatedAt: <ISO>, data: { items: [...] } }
{
  id: 'app_7fq2m',
  organization: 'Manso Manitoba',
  position: 'Mental Health Support Worker',
  url: 'https://mansomanitoba.ca/jobs/…',
  jobDescription: '…full pasted text…',
  deadline: '2026-10-02',          // date-only ISO, or null
  discoveredAt: '2026-09-13',
  appliedAt: null,
  status: 'Preparing',
  resumeUsed: 'mat_l3k9x',         // material id, or null
  coverLetter: 'mat_p8s1c',        // material id, or null
  referencesUsed: 'mat_zz40q',     // material id, or null
  interviewAt: null,               // full ISO datetime when set
  followUpAt: null,                // date-only ISO
  notes: '',
  outcome: null,                   // free text, shown only on the record itself
}
```

**Statuses, exactly these nine:** `Saved` · `Preparing` · `Ready` · `Applied` · `Interview` ·
`Follow-up` · `Offer` · `Rejected` · `Closed`. Map them to `--tone-*` and **always pair colour with
the word** — colour-only status is an accessibility failure on a phone in bad light.
`Saved/Preparing → --tone-soon`, `Ready/Applied → --tone-calm`, `Interview/Offer → --tone-warm`,
`Follow-up → --tone-waiting`, `Rejected/Closed → --tone-quiet`.

**This is not a recruiting dashboard.** Forbidden: funnel charts, conversion or response rates,
"days since applied" counters, weekly application goals, leaderboards, KPI cards, sparklines, a
"pipeline" metaphor, and any number rendered larger than body text.

**Default view is a calm list ordered by what needs attention soonest**, implemented as one pure,
commented function in `applicationsStore.js`: rank by the nearest *future* date among `interviewAt`,
`deadline`, `followUpAt`; dateless records follow, ordered by `updatedAt` descending;
`Rejected`/`Closed` always last and collapsed behind an "Archived" disclosure. **Past dates are not
promoted to the top and are never labelled overdue** — a passed deadline just renders as "Closed on
October 2" in muted text.

**One primary action per row**, chosen by status, plus a `⋯` overflow for everything else: Saved →
Prepare this one · Preparing → Continue preparing · Ready → Mark applied · Applied → Add interview
date · Interview → Add a note · Follow-up → Mark followed up · Offer → 🎉 (opens the record; no
action needed) · Rejected/Closed → Archive.

Row tap opens a detail panel (`.usm-panel.is-open`, **not** a modal — modals are bad on a phone for
long forms) with every field. The job description collapses to 4 lines behind "Show full posting".

### R5 — Reminder seam (do not implement the engine)

Deadlines, interviews, and follow-ups emit reminder records for `11-NOTIFICATIONS.md`. **Specify and
consume the seam only: no scheduler, no permission prompt, no service worker.** The page must be
fully functional with notifications absent.

```js
// src/modules/reminders.js is OWNED BY 11-NOTIFICATIONS.md. Do not create it here.
let reminders = null;
try { reminders = await import('./modules/reminders.js'); }
catch { reminders = null; }   // not built yet; every call below becomes a no-op

// Emitted record — the id is stable and deterministic, so re-emitting REPLACES, never duplicates.
{
  id: `applications:${app.id}:deadline`,
  source: 'applications',
  kind: 'deadline' | 'interview' | 'followup',
  dueAt: '2026-10-01T13:00:00.000Z',
  title: 'Manso Manitoba closes tomorrow',
  body: 'Ready when you are.',
  href: '/lovesite/applications.html#app_7fq2m',
}
```

Wrap it locally once — `function emitReminder(rec) { reminders?.upsertReminder?.(rec); }` and
`function dropReminder(id) { reminders?.cancelReminder?.(id); }` — emitting on save and dropping
when a field is cleared or a record is archived. Document the contract at the top of
`applicationsStore.js` so `11-NOTIFICATIONS.md` can implement against it.

## UX Requirements

**She will use this one-handed on a phone, often in the evening, often tired.** Design for thumb
reach first and widen upward:

- Primary actions sit in the **lower third** of the viewport. The Copy button is sticky to the
  bottom of the assembler panel on mobile, above the nav, with
  `padding-bottom: env(safe-area-inset-bottom)`.
- Every tap target ≥44px; segmented-control buttons are 44px tall and stretch full width.
- One breakpoint, `@media (max-width: 600px)`. Below it: single column, full-bleed detail panel,
  overflow menu becomes a bottom sheet.
- `--font-body` (Inter) for everything functional — fields, statuses, dates, the preview.
  `--font-display` (Dancing Script) **only** for the `h1`, the intro sentence, and empty-state
  lines. No script type in a data row.
- `.reveal` + `data-delay="(i % 4) + 1"` on rows; `observeReveal(el)` for rows added after first
  paint. All motion survives `prefers-reduced-motion: reduce`. `:focus-visible` rings everywhere.

**Tone.** Supportive, never managerial. Approved lines, use them: *"One application at a time."*
(page subtitle) · *"Ready when you are."* (Copy button helper text) · *"You've already done the hard
part. Let's make this one easier."* (Prepare empty state).

**Forbidden copy, verbatim and in spirit:** "You are behind." · "You need to apply today." ·
"0 applications this week" · "Streak" · "Goal" · "Productivity" · "Pipeline" · "Optimise your
resume" · any sentence that counts what she has not done.

**Rejections are handled with grace.** Setting status to `Rejected` shows one line — *"Their loss.
This one's done."* — and a single **Archive** button, and the record moves behind the Archived
disclosure immediately. **A rejection is never counted anywhere in the UI:** no "3 rejections", no
numbered filter chip, no archive badge count.

**All three states required.** *Empty (first run):* Prepare shows the supportive line plus one
action, "Paste a job description"; Materials shows the "paste your resume in once" line;
Applications shows *"Nothing here yet. That's fine."* — all via `.usm-empty`. *Loading:*
localStorage is synchronous, but first render happens after `DOMContentLoaded`, so paint
`.usm-skeleton` rows for one frame rather than flashing an empty state; never show "no applications"
before the store has been read. *Error:* if `createStore` reports an in-memory fallback (Safari
private mode, full quota), show one calm `.usm-toast` — *"Saving isn't working in this browser right
now. Copy anything you want to keep."* — and keep the page usable. **Never discard what she just
typed.**

## Technical Requirements

- Vanilla ESM. No framework, no TypeScript, no JSX, no new dependency; `package.json` unchanged.
- No inline `<script>` (the CSP forbids it) and no new `connect-src` host — **this page makes zero
  network requests.**
- `createStore('applications', { version: 1 })` and `createStore('materials', { version: 1 })` →
  keys `usm.applications.v1` and `usm.materials.v1`. The `usm.` namespace is mandatory:
  `k-sqr.github.io` is a shared origin across every one of that user's Pages sites, so storage is
  **not** isolated by the `/lovesite/` path.
- All user text rendered via `textContent` or as a control `value`. **No `innerHTML` for any stored
  field** — job descriptions are pasted from the open web. Follow `renderMemoryCard()`.
- Render `url` as a link only when it matches `/^https?:\/\//`, with `rel="noopener noreferrer"`;
  otherwise render it as plain text.
- `applicationsStore.js` owns all reads, writes, id generation, ordering, and the reminder seam.
  `applications.js` renders and wires events and must never call `localStorage` directly.
- Writes debounced ~300ms on typing, flushed on `blur`, `visibilitychange`, and `beforeunload`.
- No `console.log`; errors go through one small local `warn()` helper, as in `04`.

## Privacy & Security

- **This page does not touch Firebase. At all.** It must not import `src/modules/firebase.js`,
  `auth.js`, `memoriesGallery.js`, `gallery.js`, `upload.js`, or `memoryAdmin.js`. Importing
  `firebase.js` runs `getAnalytics(app)`, which would hand Google Analytics a pageview for her job
  search, and adds a Firestore/Storage dependency for a feature that needs neither. No collection,
  no Storage prefix, no `firestore.rules` change.
- No passcode gate. This is her own device and her own job search; a passcode is friction without a
  threat model.
- Nothing here reaches LoveGPT or `functions/knowledge/chunks.json`. Job descriptions, salary notes,
  and interview notes are not relationship context.
- **Be honest in the UI about the localStorage limitation**, not just in these docs. A permanent,
  quiet line in the Applications footer: *"This lives only in this browser on this device. Clearing
  your browser data will erase it — download a backup now and then."*
- A visible **Export / Backup** button in the page header: `store.export()` for both stores wrapped
  into one file, downloaded via `Blob` + `URL.createObjectURL` + `<a download>` named
  `application-desk-backup-YYYY-MM-DD.json`. Pair it with **Import** behind a confirmation that says
  plainly that importing replaces what is there.

## Do Not

- Do not build job discovery: no scraping, no RSS, no board integration, no "jobs near you".
- Do not call the Anthropic API, add an API-key field, or leave a disabled "Generate with AI" button.
- Do not add file upload, PDF parsing, or resume parsing.
- Do not add charts, funnels, conversion rates, "days since" counters, weekly goals, or KPI cards.
- Do not add a passcode, login, or sync.
- Do not touch `people.html` / `src/people.js` / `src/styles/people.css` / `peopleStore.js` /
  `src/data/messageTemplates.js`, nor timeline, letters, memories, LoveGPT, `functions/**`, or
  either rules file.
- Do not add hearts, gradients beyond the one primary button, or extra `backdrop-filter`. The
  affection in this page is in the words and in the work it saves.
- Do not add a second breakpoint unless the list genuinely breaks; if you must, use
  `@media (max-width: 900px)` and say why in a comment.

## Implementation Strategy

1. `applications.html` + `vite.config.js` entry + empty `src/applications.js` → `npm run build`,
   confirm `dist/applications.html` exists. **Ship this before writing any feature code.**
2. `src/data/promptTemplates.js` with the three templates above. Read them out loud; fix the ones
   that sound like a robot wrote them.
3. Materials library end to end — store, list, add, edit, delete, duplicate. No dependencies, and
   the assembler needs it.
4. The assembler: inputs → live preview → Copy with all three fallbacks. Test copy on iOS Safari,
   the strictest clipboard environment she will hit.
5. Tracker: schema, ordering function, rows, status changes, detail panel.
6. Wire **Save to applications** from the assembler and the material pickers in the detail panel.
7. Export / Import, then the reminder seam (a no-op until `11` lands).
8. Empty, loading, error states; then re-read every string against the forbidden-copy list.

Commit after each step. Step 4 holds the real value — do not let steps 5–6 eat its polish.

## Acceptance Criteria

1. `npm run build` succeeds with zero errors and `dist/applications.html` exists.
2. `npm run preview` → `/lovesite/applications.html` loads with nav, music, and theme toggle
   working, and the For You card no longer says "coming soon".
3. No Firebase import anywhere in the files you own, and the page issues **zero** network requests
   after load (DevTools Network, All, excluding the shared Google Fonts stylesheet).
4. Pasting a job description and selecting two materials produces a single prompt containing both
   material bodies under labelled headings, the job description verbatim, and the tone/length
   constraints. Unselected materials appear nowhere in the output.
5. All three templates contain an explicit instruction not to invent experience.
6. **Copy** puts the exact preview text on the clipboard with a visible confirmation; with
   `navigator.clipboard` deleted in the console, the `execCommand` fallback still works and confirms.
7. Creating an application from the assembler carries organization, position, url, jobDescription,
   and deadline across with no retyping, at status `Preparing`.
8. DevTools → Application → Local Storage shows exactly `usm.applications.v1` and
   `usm.materials.v1`, each with a `{ v, updatedAt, data }` envelope. No other new keys.
9. Export downloads a JSON file; clearing both keys and importing it restores every application and
   material exactly. Reload preserves state; a second tab reflects changes via `subscribe`.
10. The default list is ordered by nearest upcoming date; `Rejected`/`Closed` sit behind the Archived
    disclosure and appear in no count anywhere.
11. `grep -rniE "overdue|you are behind|days since|streak|conversion|pipeline|0 applications"` over
    the files you own returns nothing.
12. No number on the page renders larger than body text; there are no stat cards, charts, or
    progress rings.
13. At 375px every control is reachable one-handed, all tap targets are ≥44px, and the Copy button
    is visible without scrolling once a job description has been pasted.
14. Keyboard-only: Tab reaches every control with a visible focus ring; the segmented control
    responds to arrow keys; Escape closes the detail panel and restores focus to the row.
15. With `prefers-reduced-motion: reduce`, all content is visible and nothing animates.
16. Both themes are legible for every surface and chip, and `applications.css` contains no hardcoded
    hex values.
17. With localStorage blocked (DevTools → Application → Storage, or Safari private mode), the page
    loads, shows one calm banner, and text typed into the assembler is not lost.
18. A job description containing `<script>alert(1)</script>` renders as literal text and executes
    nothing.
19. `git diff --stat package.json` is empty — zero new dependencies.

## Verification

```bash
npm run dev                                   # /lovesite/applications.html
npm run build && npm run preview              # confirm dist/applications.html
grep -rn "firebase" src/applications.js src/modules/applicationsStore.js   # → nothing
grep -rn "localStorage\|IntersectionObserver\|innerHTML" src/applications.js  # → nothing
grep -rn "applications" vite.config.js                                     # → the input entry
grep -rniE "overdue|behind|streak|days since|conversion" src/styles/applications.css src/applications.js
git diff --stat package.json package-lock.json                             # → empty
```

Manual:
- Paste a real posting from `mansomanitoba.ca/jobs`, select every material, copy, and paste the
  result into Claude. **Does it produce a usable tailored resume in one shot?** That is the only
  test that matters. If it does not, fix the template, not the UI.
- iOS Safari: the Copy button works and confirms.
- DevTools → Rendering → *Emulate prefers-reduced-motion: reduce*.
- Toggle `data-theme="dark"` on `<html>`; check the preview well and every status chip.
- Set a status to `Rejected`; confirm the kind line, the one-tap archive, and that nothing counts it.
- Export, clear both `usm.*` keys, import, confirm a byte-identical restore.

## Definition of Done

- [ ] `applications.html` created, `vite.config.js` input entry added, `dist/applications.html` builds
- [ ] `src/applications.js`, `src/styles/applications.css`, `src/modules/applicationsStore.js` created
- [ ] `src/data/promptTemplates.js` created with all three templates as real prose, each instructing
      Claude not to invent experience
- [ ] Assembler: job description + material selection + tone/length → one structured prompt
- [ ] Copy works via `clipboard.writeText`, an `execCommand` fallback, and a select-text last resort,
      with a visible confirmation in all three paths
- [ ] Materials library: add, edit, delete, duplicate; text only, no upload
- [ ] Tracker: all 17 fields, all 9 statuses, attention-first ordering, one primary action per row
- [ ] "Save to applications" carries assembler fields across with no retyping
- [ ] Export and Import working, plus the honest in-UI line about device-bound storage
- [ ] Reminder seam documented and consumed defensively; page fully functional without it
- [ ] Empty, loading, and error states implemented
- [ ] Zero Firebase imports, zero network requests, zero new dependencies
- [ ] Rejection flow is graceful and uncounted
- [ ] Both themes, 375px one-handed, keyboard-only, and reduced-motion all verified
- [ ] `DOCS.md` updated with the page, its two store keys, and its data shapes
