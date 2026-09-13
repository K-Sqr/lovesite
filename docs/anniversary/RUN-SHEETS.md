# Run Sheets — Claude Code Execution Guide

> Features first, security later, per your call. Every batch is a **single Claude Code session** you
> can start and walk away from, followed by a **Cursor Chat review** where you actually look at it.
>
> **The one rule that makes this work: commit before every batch.** Your review is then just
> `git diff`, and a bad batch is `git reset --hard` instead of an evening of archaeology.

---

## Before anything — 5 minutes, by hand

### 1. Get the letters out of the publish directory

`public/` is Vite's `publicDir`. Everything in it is copied verbatim into `dist/`, and
`npm run deploy` pushes `dist/` to the public `gh-pages` branch. Your 11 letters (78 MB) would go
live at `k-sqr.github.io/lovesite/letters/boo.pdf` and similar — guessable, unauthenticated URLs.

They are not committed (I've added them to `.gitignore`), but **`.gitignore` does not stop the
deploy**, because the deploy copies the folder, not the git index.

```bash
cd "c:/Users/A .Yemi/Desktop/Projects/ahosite"
mv public/letters letters-source
ls letters-source          # confirm all 11 are there
```

`letters-source/` is already gitignored, and Vite's dev server still serves it — **verified** on this
repo, and the URL shape matters:

```
http://localhost:5173/lovesite/letters-source/boo.pdf   → 200   ✅ base prefix required
http://localhost:5173/letters-source/boo.pdf            → 404   ❌
```

Because `vite.config.js` sets `base: '/lovesite/'`, the fetch path must include it. In code, derive
it from `import.meta.env.BASE_URL` rather than hardcoding `/lovesite/`, so it keeps working if the
base ever changes.

The folder is absent from `dist/` entirely, which is exactly what you want until the letters live in
private Storage.

### 2. Resolve the timeline questions

Open `docs/anniversary/TIMELINE-CONTENT.md` and answer the eight 🔴 items. Batch 2 cannot run
honestly without them, and this is the one thing no model can do for you.

### 3. Baseline commit

```bash
git add -A && git commit -m "Anniversary expansion: planning docs, gitignore private letters"
```

---

## Model strategy

You have Claude Pro, so Opus time is finite. Spend it where a wrong answer is expensive and cheap
elsewhere. This split is deliberate, not arbitrary:

| Use **Opus** (strongest available) | Use **Sonnet** |
| --- | --- |
| Batch 1 Foundations — everything else sits on it, and `storage.js` has a crypto boundary | Batch 3b People |
| Batch 2 Timeline — refactors CSS-coupled render code | Batch 3a Applications |
| Batch 3c Rhythm — encryption plus a hard no-leak requirement | Batch 4 Outfit |
| Batch 5 Letters — the security reasoning is where weak models confidently do the wrong thing | Batch 6 Notifications |

If you have Opus headroom, use it everywhere — Sonnet is the budget option, not the better one. The
Sonnet-suitable batches are the ones that are mostly CRUD plus layout, where the spec is already
doing the hard thinking.

**Spacing.** One batch per session, always. Do not continue a second feature in a session that has
already written a thousand lines — quality drops measurably as context fills, and it is the last
third of a long session where an agent starts "improving" files it was told not to touch. Batch 1
and Batch 2 are half-day jobs. Batches 3a/3b/3c share no files, so you can run them concurrently in
three terminals if you want everything in one afternoon.

---

## Batch 1 — Foundations (Opus)

**Blast radius:** `base.css`, new `ui.css`, four new modules, the nav in all four existing HTML
files, a new For You page, `vite.config.js`. This is the riskiest batch precisely because it touches
the pages that already work.

```
Read docs/anniversary/01-REPOSITORY-AUDIT.md first — it is the authoritative fact sheet
for this repo. Then execute docs/anniversary/02-DESIGN-SYSTEM.md (section 8 only — sections
1-7 are reference) followed by docs/anniversary/04-SHARED-FOUNDATIONS.md, in that order.

Follow those two files exactly, including their "Files You Must Not Touch" lists and their
Acceptance Criteria. Do not implement any feature page beyond the For You hub.

Hard constraints:
- Vanilla JS ES modules. No framework, no TypeScript, no new dependencies.
- Do not change the value of any existing CSS token.
- The four existing pages (index, timeline, memories, lovegpt) must look and behave
  EXACTLY as they do now. That is the primary success test.
- Commit after each numbered step of 04's Implementation Strategy, with a short message.

When done, run `npm run build` and report: which files you created, which you modified,
anything in the two specs you could not satisfy and why.
```

**Then review in Cursor Chat.** Ask for a walkthrough of the `storage.js` encrypted path and the nav
diff specifically. Manually check:

- All four original pages, both themes, at 375px and desktop. Proposal reveal, No-button dodge,
  graffiti, verses, counter, gallery, upload, lightbox, chat, cross-page music.
- DevTools → Application → Local Storage: the encrypted store shows **ciphertext**, and no
  passphrase is stored anywhere.
- `grep -rn "IntersectionObserver" src/` → only `src/modules/reveal.js`.
- Tab through the nav — you should now see focus rings.

**Do not start Batch 2 until the four original pages are clean.** A regression on the proposal page
costs more than a day of delay.

---

## Batch 2 — Timeline (Opus)

Requires the 🔴 items in `TIMELINE-CONTENT.md` answered.

```
Read docs/anniversary/01-REPOSITORY-AUDIT.md, then execute
docs/anniversary/05-TIMELINE.md.

The content comes from docs/anniversary/TIMELINE-CONTENT.md. That file is the ONLY source
of timeline entries. Transcribe it.

ABSOLUTE RULE: do not invent, embellish, infer, or "improve" any relationship event, date,
title, or description. Where TIMELINE-CONTENT.md marks a description with the pencil icon,
create the entry with an empty description and a TODO(emmanuel) comment — leave it for the
owner to write. Where it marks a red circle, stop and ask rather than guessing. A fabricated
memory in this file is the worst possible failure of this task.

Also fix this bug while you are in the neighbourhood, since it is on the same page:
The "No" button on index.html runs off-screen from about the 4th click. Root cause: #noBtn
has `white-space: nowrap` (src/styles/sections.css around line 99), and noTexts[4] is the
long string 'I will be your second pair of eyes, or even, first!'. Once detached the button
is position:fixed with transform translate(-50%,-50%) at zone positions up to left:80%, so a
nowrap button wider than the viewport has its right half pushed off the screen. Fix by
allowing the text to wrap, keeping a sensible max-width, and clamping the zone positions so
the button always stays fully visible on a 375px viewport. Verify by clicking through all 15
zones at 375px width.

Report which entries you created, which have empty TODO descriptions, and anything you had
to ask about.
```

**Cursor review:** this is the most visually important section of the site, so look at it rather
than reading the diff. On a phone, scroll the whole thing top to bottom. Does it feel like a story
unfolding, or a list of records? Check the year headings, one expandable entry, and that the rail's
left/right alternation still works with headings inserted. Then click the No button 15 times at
375px.

Then write your ✍️ descriptions yourself, in Cursor, with the file open. This is the part that makes
the timeline yours.

---

## Batch 3 — Three tools (can run concurrently)

These three share **no files**, so they cannot collide. Run them in three terminals, or one after
another.

### 3a — Applications (Sonnet, or Opus if you have room)

```
Read docs/anniversary/01-REPOSITORY-AUDIT.md, then execute
docs/anniversary/07-JOB-APPLICATION-STUDIO.md exactly, including its Files You Must Not
Touch list.

Context you should know: she has had exactly one job interview so far, with the University
of Manitoba, in August 2026. The tone requirements in that file are the most important part
of the task — supportive, never "you are behind". No KPI cards, no funnel, no counters of
failure.

Do not touch people.html, rhythm.html, or outfit.html or any of their files — parallel
sessions own those. Report what you built and any spec item you could not satisfy.
```

### 3b — People (Sonnet, or Opus)

```
Read docs/anniversary/01-REPOSITORY-AUDIT.md, then execute
docs/anniversary/08-FRIENDS-FAMILY.md exactly, including its Files You Must Not Touch list.

The core principle is non-negotiable: this must not become a guilt machine. Read the state
rules carefully — nothing escalates past "It's been a little while", and that is deliberate.
The message templates must sound like a real person texting, not like AI wrote them.

Do not touch applications.html, rhythm.html, or outfit.html or any of their files — parallel
sessions own those. Report what you built and any spec item you could not satisfy.
```

### 3c — Rhythm (Opus — do not economise here)

```
Read docs/anniversary/01-REPOSITORY-AUDIT.md, then execute
docs/anniversary/09-PERIOD-TRACKER.md exactly, including its Files You Must Not Touch list.

Two constraints matter more than anything else in this task:

1. This page must never import src/modules/firebase.js, must make zero network requests, and
   nothing from it may ever reach LoveGPT, functions/knowledge/chunks.json, analytics, or a
   console log. Verify with the greps in that file's Verification section and paste the
   results.

2. The unlock passphrase is supplied by the owner at runtime and must NEVER appear in source,
   comments, tests, fixtures, UI copy, logs, or a Firebase secret. Do not ask me for it and
   do not invent a placeholder that looks like a real one.

Do not touch applications.html, people.html, or outfit.html or any of their files — parallel
sessions own those. Report what you built, and paste the output of the privacy greps.
```

**Cursor review for all three:** run the greps yourself rather than trusting the report. For People,
the real test is emotional, not technical — add five real people, set one `lastContactAt` to two
years ago, and see whether the page feels like an invitation or an inbox. If it feels like an inbox,
the feature has failed and the fix is copy and density, not code.

---

## Batch 4 — What to Wear (Sonnet, or Opus)

Biggest single feature by surface area, but the least subtle — the judgement calls are all decided in
the spec. Run after Batch 3.

```
Read docs/anniversary/01-REPOSITORY-AUDIT.md, then execute
docs/anniversary/10-OUTFIT-OF-THE-DAY.md exactly.

Build src/modules/outfitEngine.js FIRST, in isolation, with fictional data, and show me
three outfits from the same fake closet at -25C, at +2C with rain, and at +28C before you
write any UI. If those three are not obviously different and obviously sensible, nothing
downstream matters.

Three things that are easy to get wrong:
- The Open-Meteo host MUST be added to connect-src in the CSP meta tag of EVERY HTML file,
  and all of those tags must stay identical. Miss one and fetch is silently blocked on that
  page only. Verified baseline: all pages currently emit ONE identical CSP line, so
  `grep -h "Content-Security-Policy" *.html | sed 's/^ *//' | sort -u` must still print
  exactly one line when you are done.
- Wardrobe photos go in IndexedDB via createBlobStore, never localStorage. Revoke every
  object URL when its grid tile leaves the DOM.
- Never prompt for geolocation on page load. Saved location, then an already-granted
  permission, then the Winnipeg default.

Winters here reach -30C with -40C wind chill, so extreme cold must be a hard exclusion of
light items, not a preference.

Report what you built and paste the output of the CSP grep above.
```

**Cursor review:** add 12 real items and see whether a sparse closet still gives a useful answer.
Check the explanation line actually cites today's weather rather than generic filler.

---

## Batch 5 — Letters, local-source mode (Opus)

Modified from the spec, because you're deferring the Storage work. This builds the entire reading
experience now and leaves the data source swappable.

```
Read docs/anniversary/01-REPOSITORY-AUDIT.md and docs/anniversary/06-LETTERS.md.

DEVIATION FROM THE SPEC, deliberate: we are NOT doing the Firebase Storage wiring yet.
Instead:

- Build the full Letters page, cards, reading view, and locked state exactly as 06 specifies.
- Put ALL data access behind a single module, src/modules/letterSource.js, exporting
  getLetterList() and getLetterBlob(id). For now it fetches from the gitignored
  letters-source/ folder at the project root, which Vite's dev server serves in development.
  IMPORTANT, verified: the URL must include the Vite base, so build paths as
  `${import.meta.env.BASE_URL}letters-source/<filename>` — that resolves to
  /lovesite/letters-source/<filename> and returns 200. Without the base prefix it 404s.
  Do not hardcode the literal string '/lovesite/'.
- Add a clear comment block at the top of letterSource.js stating that this is the LOCAL DEV
  implementation, that letters must NOT be deployed from here because anything reachable by
  the built site is public, and that swapping to authenticated Firebase Storage getBlob()
  per 03-SECURITY-REMEDIATION.md is a change to this file ONLY.
- Do NOT copy, move, or reference anything into public/ or dist/. Do not commit any PDF.
- Everything else from 06 still applies: never use getDownloadURL, hold blob: URLs in memory
  only and revoke them, and note that CSP frame-src 'none' means no iframe PDF viewer.

The 11 letters in letters-source/ are: 7.pdf, 92DN.pdf, All the letters 6 months in.pdf,
Blazing Hot (1).pdf, boo.pdf, Build up.pdf, First Birthday.pdf, First of many.pdf,
Happy 180 days.pdf, Random thought.pdf, Valentines.pdf. Create src/data/letters.js with
metadata stubs for these — titles, dates, and occasions left as TODO(emmanuel) for the owner
to fill in, since only he knows what each one is. Do not guess dates or occasions from
filenames.

Report what you built and confirm nothing was written into public/ or dist/.
```

**Cursor review:** `git status` must show no PDFs. `npm run build && ls dist/` must contain no
letters. Then read a letter on your phone and see whether the reading experience is actually good —
this is the feature most likely to feel like a PDF folder if the typography is lazy.

---

## Batch 6 — Notifications (Sonnet)

```
Read docs/anniversary/01-REPOSITORY-AUDIT.md, then execute
docs/anniversary/11-NOTIFICATIONS.md.

Build Level 1 (in-app) only, behind the adapter interface, and wire the reminder seams that
features 07, 08, 09 and 10 already emit into. Do not add a service worker, a PWA manifest, or
any permission prompt. Nothing may ask for notification permission on page load.

Rhythm reminders must stay in the encrypted store and must never carry explicit content.
```

---

## Batch 7 — Anniversary experience (Cursor Chat, not Claude Code)

Do this one in Cursor with `12-ANNIVERSARY-EXPERIENCE.md` open, iterating visually. It is the
emotional payload, it needs your eyes on every frame, and **every word must be yours.** The spec
ships `src/data/anniversaryContent.js` as empty `TODO(emmanuel)` stubs on purpose.

Sensible split: let an agent build the page mechanics, the date-window activation, the preview flag,
and the easter-egg triggers. You write the content. Nothing in that file should be AI-written — she
will be able to tell, and it would undo the point of the whole project.

---

## Then, and only then — the hands-on pass

In this order, once features are in and you've lived with them for a day:

1. **`03-SECURITY-REMEDIATION.md`** — by hand, in a terminal, no agent. Purges the PDFs from git
   history, sets up private Storage, adds her reader passcode. Then swap `letterSource.js` to the
   authenticated implementation. **You cannot deploy the Letters feature before this.**
2. **`13-SECURITY-REVIEW.md`** — Claude Code, Sonnet. Read-only audit.
3. **`14-MOBILE-ACCESSIBILITY.md`** — Cursor Chat, on your actual phone.
4. **`15-TESTING-QA.md`** — Claude Code, Sonnet.
5. **`16-FINAL-POLISH.md`** — Cursor Chat plus you. Copy review first; it is the highest-value item
   in the entire plan.

---

## Quick reference

| Batch | Spec | Tool | Model | Blast radius |
| --- | --- | --- | --- | --- |
| 0 | — | you | — | move letters, answer timeline questions, commit |
| 1 | `02` §8 + `04` | Claude Code | **Opus** | tokens, 4 modules, all 4 navs, For You |
| 2 | `05` + `TIMELINE-CONTENT` | Claude Code | **Opus** | timeline data + render + No-button fix |
| 3a | `07` | Claude Code | Sonnet | `applications.*` only |
| 3b | `08` | Claude Code | Sonnet | `people.*` only |
| 3c | `09` | Claude Code | **Opus** | `rhythm.*` only |
| 4 | `10` | Claude Code | Sonnet | `outfit.*` + CSP in all pages |
| 5 | `06` (local mode) | Claude Code | **Opus** | `letters.*` + `letterSource.js` |
| 6 | `11` | Claude Code | Sonnet | `reminders.js` + `notifiers/` |
| 7 | `12` | **Cursor Chat** | — | `anniversary.*` — your words |
| later | `03` → `13` → `14` → `15` → `16` | mixed | — | security, a11y, tests, polish |

## Two things that will bite you

**Every new page needs a `rollupOptions.input` entry in `vite.config.js`.** Without it the page
works perfectly in `npm run dev` and 404s in production. After every batch that adds a page:

```bash
npm run build && ls dist/*.html
```

By the end you should have eleven: `index`, `timeline`, `memories`, `lovegpt`, `foryou`, `letters`,
`applications`, `people`, `rhythm`, `outfit`, `anniversary`.

**Do not run `npm run deploy` until after step 1 of the hands-on pass.** Until then, deploying is
what publishes things you didn't mean to publish.
