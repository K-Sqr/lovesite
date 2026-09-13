# 06 — Letters (Private, Authenticated Reading Archive)

**Recommended tool:** Claude Code. **Model:** a strong reasoning model, no exceptions.
Justification: this is the only feature in the set where a mistake leaks her private writing to the
internet. The threat model, not the UI, is the hard part, and a cheap model will happily cache a
`getDownloadURL()` result because it makes the code simpler.

---

## Context

The six-month letter is currently `docs/Happy 180 days.pdf`, committed to a **public** GitHub
repository and downloadable over `raw.githubusercontent.com`. `03-SECURITY-REMEDIATION.md` removes
it from git history and establishes the correct home: Firebase Storage under a `letters/` prefix
readable only by an authenticated `owner` or `tolu` UID.

This feature is the reading room on top of that. It is not a file browser. It is the place where
she goes to reread what he wrote her, and it should feel like opening a drawer of kept letters.

Three facts from the audit shape every decision below:

1. **GitHub Pages cannot authenticate anything.** Every byte in `public/`, every string in
   `src/data/`, every file in the repo is world-readable at a guessable URL.
2. **`frame-src 'none'`** is in the CSP of every page, so `<iframe>`, `<embed>`, and `<object>` PDF
   viewers will not render. You must choose a path (R3).
3. **`getDownloadURL()` returns a long-lived tokenised URL that bypasses Storage rules once
   issued.** Persisting one anywhere undoes the entire remediation.

## Objective

Build `letters.html` — a private, session-authenticated archive with a reading experience good
enough that she actually rereads the letters on her phone. Owner sees management affordances; she
sees a beautiful read-only room. Nothing about the letters — not a body, not an excerpt, not a
download URL — is readable without a server-evaluated Firebase rule passing.

## Prerequisites

**`03-SECURITY-REMEDIATION.md` must be DONE before a line of this is written.** Specifically:

- [ ] The three PDFs are purged from git history and the raw URLs 404.
- [ ] `storage.rules` has a `letters/{fileName}` block with
      `read: request.auth.uid == 'owner' || request.auth.uid == 'tolu'`, deployed.
- [ ] `READER_PASSCODE_HASH` is set and `functions/index.js` returns `{ token, role }`.
- [ ] `src/modules/auth.js` surfaces the `role`.
- [ ] **The repo-visibility decision is recorded in `DOCS.md`.** R5 branches on it. If it is not
      recorded, stop and get the decision — do not pick for him.

Also required: `02-DESIGN-SYSTEM.md` (`src/styles/ui.css`, `:focus-visible`, tokens) and
`04-SHARED-FOUNDATIONS.md` (`siteChrome.js`, `reveal.js`, `dates.js`, the For You hub, and
`PAGE-CHECKLIST.md` — follow it literally).

## Existing Files To Inspect

```
docs/anniversary/03-SECURITY-REMEDIATION.md   §5, §6 — the rules and the role contract
docs/anniversary/PAGE-CHECKLIST.md            created by 04 — follow it step by step
src/modules/auth.js                           ensureAuthenticated(), browserSessionPersistence
src/modules/firebase.js                       exports `storage`, `auth`; bucket lovesite-1540e.firebasestorage.app
src/modules/upload.js                         the existing uploadBytesResumable + progress pattern
src/modules/memoriesGallery.js                renderMemoryCard() — safe-DOM construction pattern
storage.rules                                 confirm the letters/ block exists before building
vite.config.js                                rollupOptions.input — you MUST add an entry
memories.html                                 the CSP meta tag to copy verbatim
src/memories.js                               how an authed page wires auth + render
src/styles/ui.css                             .usm-card, .usm-btn, .usm-empty, .usm-skeleton, .usm-modal
```

## Files You Own (Create)

```
letters.html                  the page
src/letters.js                page entry
src/styles/letters.css        page styles
src/data/letters.js           metadata ONLY — see R5 for what may and may not go here
```

## Files You May Modify

```
vite.config.js                add `letters: resolve(__dirname, 'letters.html')` to rollupOptions.input
src/foryou.js                 remove the `data-coming-soon` state from the Letters card
src/modules/auth.js           ONLY if 03 did not ship a role accessor — add a minimal `getRole()`
                              and nothing else. If 03 shipped it, this file is untouchable.
DOCS.md                       document the page, the Storage prefix, and the chosen CSP path
```

## Files You Must Not Touch

```
firestore.rules               letters use no Firestore at all — see R2
storage.rules                 owned by 03. If it is wrong, fix 03, do not patch it here.
functions/**                  including knowledge/chunks.json and the RAG path
src/data/timeline.js  ·  src/modules/timeline.js  ·  src/timeline-page.js  ·  timeline.html
src/modules/{memoriesGallery,memoryAdmin,upload,gallery}.js  ·  memories.html  ·  src/memories.js
src/modules/{loveCounter,buttons,graffiti,textReveal,verses,musicPlayer,theme,siteChrome,storage,reveal,dates}.js
src/styles/{base,animations,sections,memories,timeline-page,lovegpt,ui}.css
index.html  ·  lovegpt.html  ·  package.json
```

---

## Requirements

### R1 — The page exists in production

Follow `PAGE-CHECKLIST.md`. The failure mode the audit calls out by name: creating `letters.html`
and forgetting `rollupOptions.input`, which works perfectly in `npm run dev` and 404s in
production. **Both edits. Always.** Verify `dist/letters.html` exists before you call this done.

Copy the `<head>` verbatim from `memories.html` — fonts, icon, viewport, and the CSP meta tag. The
CSP's `connect-src` already includes `https://*.googleapis.com`, which covers the Storage REST host
(`firebasestorage.googleapis.com`) that the SDK actually calls, so **no `connect-src` change should
be needed**. Verify that in the Network tab rather than assuming; if a request is blocked, the fix
is adding the host to *every* HTML file, not just this one.

### R2 — No Firestore. Justify it in a comment.

Memories use Firestore because captions are user-generated and queryable. Letters are neither:
there are a handful, the owner writes them, and the metadata is small and static. A `letters`
collection would mean a new deny-by-default rules block that silently fails until deployed, a
second security surface, and a second place a body or download URL could accidentally be persisted.
**Storage objects plus a static metadata module is strictly less to secure.** Put that reasoning in
a two-line comment at the top of `src/letters.js` so nobody "improves" it later.

### R3 — The PDF rendering problem: choose, and say which

`frame-src 'none'` means no `<iframe>`/`<embed>/`<object>` viewer will render. Three options:

**(a) Transcribe to text — RECOMMENDED, and the primary reading experience.** The body is
Markdown/plain text rendered as real HTML: best typography, best mobile reading, real selection and
search, screen-reader friendly, respects the type scale, and it later lets LoveGPT index excerpts.
The original PDF stays available as an authenticated download for its artefact value. Cost: someone
types the letters out, and that someone is the owner, not you.

**(b) Relax the CSP to `frame-src 'self' blob:`** in every HTML file (they must stay identical), so
a `blob:` URL from `getBlob()` can be shown in an `<iframe>` using the browser's PDF viewer. Cost: a
real CSP weakening site-wide, and the native viewer's typography and mobile behaviour are mediocre.

**(c) Add pdf.js.** The project has **three** dependencies total (`firebase`, `vite`, `gh-pages`).
pdf.js is a large worker-based renderer and `script-src 'self'` means self-hosting and bundling the
worker. That is a permanent cost for a page with maybe six documents.

**Decision: do (a) as the reading experience, and (b) only if a preview affordance is actually
wanted** — download-to-device works today with no CSP change at all, so (b) may prove unnecessary.
Do not do (c) without the owner explicitly approving a fourth dependency.

**The implementer must state in the PR description which path shipped, and if (b), must show the
CSP diff across every root HTML file — six of them once `letters.html` exists.** An undocumented
CSP change is a finding.

### R4 — The auth boundary

```js
import { ensureAuthenticated, getRole } from './modules/auth.js';
```

- The page loads in a **locked** state and renders nothing about the letters until authenticated.
- `ensureAuthenticated()` opens the existing passcode modal, which hits the Cloud Function and signs
  in with a custom token. Keep `browserSessionPersistence` — auth dies with the tab. **Do not add a
  "remember me", do not mirror the token into `localStorage`, do not extend the session.**
- `role === 'owner'` → upload and delete affordances visible.
  `role === 'tolu'` → read-only, with no disabled-looking management chrome. She should not see a
  greyed-out "Upload" button; she should see a page that was built for her.
- Role gates the **UI only**. Storage rules gate the data. Both must be true independently: if a
  bug showed her the upload button, `storage.rules` would still reject the write.
- A failed passcode shows the existing generic error. Never reveal which passcode was closer.

### R5 — Where the words live (branch on the repo-visibility decision from 03)

`src/data/letters.js` holds **metadata only**, and only if every field in it is innocuous:

```js
export const letters = [
  {
    id: 'six-months',                 // stable slug; matches the Storage object name
    title: 'Happy 180 Days',
    occasion: 'Six months',
    date: '2026-03-13',               // ISO, sorted by dates.js
    teaser: 'Ten pages, written on my knees.',   // ONE line. See the rule below.
    storagePath: 'letters/six-months.pdf',       // path only — NEVER a download URL
    bodyPath: 'letters/six-months.md',           // PUBLIC-REPO branch only
    pages: 10,                        // optional
  },
];
```

> **The rule:** a *title* like "Happy 180 Days" is innocuous — it is already implied by the public
> timeline. An *excerpt* is not. `teaser` is the sharp edge here: it is tempting to pull the best
> line from the letter, and that line is exactly the thing that must not be in a public repo. Write
> teasers that describe the letter from outside it ("Ten pages, written on my knees"), never from
> inside it. If a teaser would embarrass either of you on a stranger's screen, it does not go in
> this file.

**PUBLIC REPO path** (repo stays public): bodies live in Firebase Storage as `letters/<id>.md`
alongside the PDF, fetched with the authenticated SDK at read time exactly like the PDF.
`src/data/letters.js` holds only the fields above. Slightly more code; the body is never in git.

**PRIVATE REPO path** (repo flipped to private, which `03` recommends): bodies could live as local
Markdown under `content/letters/<id>.md`, imported with Vite's `?raw`. Much simpler, instant, no
network. **But Vite compiles them into `dist/`, which is published to the public `gh-pages`
branch.** Repo visibility protects the *source*, not the *build*.

**Therefore: take the PUBLIC REPO path regardless of the visibility decision.** The private variant
is written down here so the next reader sees it was considered and rejected, not overlooked.
Record that reasoning in `DOCS.md`.

### R6 — Fetching bytes without leaking a URL

```js
import { getBlob, ref } from 'firebase/storage';
import { storage } from './modules/firebase.js';

const blob = await getBlob(ref(storage, letter.storagePath));  // authed, rule-checked
const url = URL.createObjectURL(blob);                          // in memory, this view only
// … on close / navigate away:
URL.revokeObjectURL(url);
```

Hard rules:

- **Never call `getDownloadURL()` in this feature.** Its output is a bearer token in a query string
  that works forever, for anyone, signed out, bypassing `storage.rules`. A grep in the acceptance
  criteria enforces this.
- **Never persist a blob URL or letter body** to `localStorage`, `sessionStorage`, IndexedDB,
  Firestore, `src/data/`, a `data-*` attribute, or a global. In-memory variable, current view only.
- `URL.revokeObjectURL()` on close, on navigating to another letter, and on `pagehide`.
- Fetch on demand — when a letter is opened, not on page load. Do not prefetch the whole archive.
- Errors get a calm generic message ("That didn't open — try signing in again"), with the real
  error only in a `warn()` helper. Do not print Firebase error codes into the DOM.

### R7 — MVP privacy vs real security

This distinction decides which shortcuts are acceptable. Write it into `DOCS.md` too.

#### MVP privacy

These make the page feel private and keep a casual passer-by out. All are fine to ship and **none
of them are security**: the page is absent from the top nav (it sits behind the For You hub), the
locked state hides content until a passcode is entered, `role` hides the upload controls,
`browserSessionPersistence` makes a closed tab forget, and letter titles stay out of `<title>` and
the meta description. A determined person with DevTools defeats every one in under a minute.
**Frontend route guards, hidden pages, and unlisted URLs are a curtain, not a lock.**

#### Real security

Exactly one thing here is real: **a Firebase Storage rule evaluated server-side against an
authenticated UID.** Which means the bytes must only ever be reachable through `getBlob()` on a
signed-in `owner`/`tolu` session so the rule actually runs; the moment a download URL is minted and
stored the rule stops being the boundary; and the moment a body is committed or bundled into
`dist/` the rule is irrelevant. Weigh a convenience against any of those three and the convenience
loses.

### R8 — Owner management (keep it small)

For `role === 'owner'` only: upload a PDF and/or a `.md` body to `letters/` using the
`uploadBytesResumable` + progress-bar pattern from `src/modules/upload.js` (read it, do not import
it — it is memory-specific and on the do-not-touch list). Storage rules cap letters at 25 MB and
`application/pdf`, so uploading `.md` bodies needs a matching content type in `03`'s create rule —
**raise that as a question against `03`, do not patch it here.**

Delete is owner-only with a confirmation step. There is no edit, no draft state, no scheduling, no
rich-text editor. He writes letters in a text editor like a person.

---

## UX Requirements

It should feel like a drawer of kept letters, not a PDF folder.

- **Order: newest first.** She will most often want the one he just wrote, and the archive grows
  downward into the past like a stack of letters set on top of each other. (The timeline is the
  chronological artefact; this is the drawer.) Offer no sort control.
- **Cards** (`.usm-card` + `.reveal`): occasion in `--font-display`, date and page count in
  `--font-body` at the micro-label scale, one-line teaser. Whole card is one target. Lift on hover
  like `.gallery-card`, press state on `:active`.
- **The sealed-envelope opening.** One interaction, used **once per card**: a brief seal or fold
  that gives way as the reading view opens. 300–400ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`, never on
  hover, never replayed on scroll, absent entirely under `prefers-reduced-motion: reduce`. The test
  is whether it still feels good the fifteenth time she opens that letter — **if it reads as a
  greeting-card gimmick, cut it.** No wax-seal emoji, paper textures, torn edges, or flying envelopes.
- **The reading view** is where the quality lives:
  - Measure **60–70ch**, centred. The single highest-impact decision on the page.
  - Body in `--font-body`, larger than the card scale — around `clamp(1rem, 2.2vw, 1.15rem)` —
    with `line-height: 1.7` and generous paragraph spacing.
  - **Dancing Script is for the title and occasion only.** `02` §2 already reserves script for
    emotional voice and Inter for everything readable. A ten-page letter set in a script face is a
    letter she will not finish.
  - A quiet header (occasion, date), the body, and one "Download the original" link if a PDF exists.
    No sidebar, no progress bar, no reading-time estimate, no share button.
  - Escape and a visible close control both return to the archive, restoring scroll position and
    focus to the card that was opened.
- **The locked state must be beautiful and warm, not an error** — it is the first thing she sees.
  One sentence in `--font-display` in his voice, something like *"These are just for you. The
  passcode is the one you already know."*, then the passcode control. No padlock iconography, no red
  text, no "Access Denied", no "Authentication required".
- **Do not build search or filters.** With a handful of letters a search box is a confession that
  the list is too long, and the brief says not to. Revisit past ~20 letters; until then the list
  *is* the interface, and year dividers are the most structure this page gets.
- Empty state uses `.usm-empty`: *"Nothing here yet."* Loading uses `.usm-skeleton`, not a spinner.
- 375px, one-handed, 44px targets. Test the reading view in bed, at night, in dark mode.

## Technical Requirements

- Vanilla ESM. **No new dependencies** unless path (c) is explicitly approved; `package.json`
  should not change.
- Build DOM with `createElement` + `textContent`. If you render Markdown, escape HTML **before**
  converting (the LoveGPT chat path already does this — copy the approach, not the file). No
  `innerHTML` with letter content, ever. No `eval`, no inline `<script>` (CSP forbids both).
- `letters.html` is the **only** new page permitted to import `src/modules/firebase.js`
  (`04` §Privacy states this explicitly). Note the consequence: `getAnalytics()` runs here, so
  Google Analytics sees a pageview for `letters.html`. That is acceptable — the page name is
  innocuous — but **no letter title, id, or fragment may ever appear in the URL.** Use in-page
  state, not `#six-months`.
- Use `initReveal()` from `src/modules/reveal.js` and `initSiteChrome({ active: 'foryou' })`.
- Dates through `src/modules/dates.js`. No ad-hoc parsing.
- One `warn()` helper; no `console.log` in the shipped file.

## Privacy & Security

Consolidated checklist — every line here is a hard requirement:

1. `getDownloadURL` appears **nowhere** in the feature.
2. No letter body, excerpt, or quotation is committed to the repo or bundled into `dist/`.
3. No download URL, blob URL, body, or decrypted content is written to any browser storage.
4. Blob URLs are revoked on close, on switching letters, and on `pagehide`.
5. No passcode or hash is written to source, docs, comments, fixtures, or a prompt file.
6. Session persistence stays `browserSessionPersistence`. No "remember me".
7. The signed-out state is verified by test, not by inspection: an incognito `fetch` of a
   `letters/` object path must be denied by the rule.
8. Letter titles do not appear in `<title>`, `<meta name="description">`, the URL, or the nav.
9. If the CSP is changed (path b), it is changed **identically in every root HTML file** and the
   diff is in the PR description.
10. Nothing about letters is appended to `functions/knowledge/chunks.json`. LoveGPT indexing
    letters is a separate, later, explicitly-approved decision — the RAG store is public today.

## Do Not

- Do not call `getDownloadURL()`.
- Do not create a Firestore collection or touch `firestore.rules`.
- Do not edit `storage.rules` — it belongs to `03`.
- Do not add a search box, tag filter, favourites, reactions, or a comment/reply feature.
- Do not add a WYSIWYG editor, draft state, or scheduled publishing.
- Do not set letter body text in Dancing Script.
- Do not use `<iframe>`/`<embed>`/`<object>` unless path (b) is chosen *and* the CSP is updated in
  every file — and even then, prefer the transcribed text as the default view.
- Do not add pdf.js without explicit approval of a fourth dependency.
- Do not add hearts, wax seals, paper textures, torn edges, or floating envelopes.
- Do not guilt-copy: no "you haven't read this one", no unread badges, no read receipts.
- Do not touch the timeline, memories, LoveGPT, or `functions/`.

## Implementation Strategy

1. Confirm every `03` prerequisite is actually done — run the verification commands from that file
   yourself. If the `letters/` rule is not deployed, everything below silently half-works.
2. Scaffold per `PAGE-CHECKLIST.md`: `letters.html`, `vite.config.js` input, `src/letters.js`,
   `src/styles/letters.css`. Build immediately and confirm `dist/letters.html`. Commit.
3. Locked state + `ensureAuthenticated()` + `getRole()`. Verify all three passcode outcomes before
   any letter rendering exists. Commit.
4. `src/data/letters.js` with one real entry. Render the card grid, still with no bodies. Commit.
5. `getBlob()` → Markdown body → reading view. Get the measure, type scale, and dark mode right
   here; this is the part she will actually use. Commit.
6. Envelope interaction, behind the reduced-motion check. Cut it if it feels twee. Commit.
7. Owner upload/delete. Commit.
8. Un-hide the Letters card on the For You hub; update `DOCS.md`.

## Acceptance Criteria

1. `npm run build` produces `dist/letters.html`, and `npm run preview` serves
   `/lovesite/letters.html` with working styles and a working nav.
2. `grep -rn "getDownloadURL" src/` returns **nothing**.
3. `grep -rni "letter" src/data/letters.js` shows metadata only — no body text, no excerpt longer
   than the one-line teaser, no URL containing a token.
4. Signed out, the page shows only the warm locked state. DevTools → Elements contains no letter
   title, teaser, or body before authentication.
5. In a logged-out incognito window, a direct `fetch` of a `letters/` Storage object path is denied
   by the rule (403/permission error), and the browser's PDF viewer cannot open it.
6. Owner passcode → cards render, upload and delete controls are present.
7. Her passcode → cards render, reading works, **no upload or delete control exists in the DOM**
   (not merely hidden), and an attempted write from the console is rejected by the rule.
8. Wrong passcode → the existing generic error, no hint about which passcode was closer.
9. Closing a letter revokes its blob URL: `performance`/DevTools shows no retained `blob:` and
   re-opening re-fetches.
10. DevTools → Application: no letter content, blob URL, or token in `localStorage`,
    `sessionStorage`, or IndexedDB. Only `aho_theme`, `usm.*`, and the Firebase session key.
11. Reading view measures 60–70ch at 1440px, body is `--font-body`, title is `--font-display`,
    and a ten-page letter is comfortable to read at 375px in dark mode.
12. Under `prefers-reduced-motion: reduce`, no envelope animation runs and every letter still opens.
13. Escape closes the reading view, scroll position is restored, and focus returns to the card.
14. Keyboard-only: every card, the close control, and the download link are reachable with a
    visible focus ring.
15. Reloading the page (new session) re-locks. Closing the tab and reopening re-locks.
16. `git diff package.json package-lock.json` is empty (unless path (c) was explicitly approved).
17. The PR description states which R3 path shipped and, for path (b), includes the CSP diff.

## Verification

```bash
npm run dev                                  # /lovesite/letters.html
grep -rn "getDownloadURL" src/               # → empty
grep -rn "innerHTML" src/letters.js          # → empty
grep -rn "localStorage\|sessionStorage" src/letters.js   # → empty
grep -rn "frame-src" *.html                  # → every page identical
node -e "console.log(require('fs').readFileSync('vite.config.js','utf8').includes('letters'))"
npm run build && ls dist/letters.html        # must exist
npm run preview                              # load /lovesite/letters.html

# The rule is the boundary — prove it, signed out:
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://firebasestorage.googleapis.com/v0/b/lovesite-1540e.firebasestorage.app/o/letters%2Fsix-months.pdf?alt=media"
# → 403. A 200 here means the remediation failed and you must stop.
```

Manual:

- Incognito, signed out: confirm the locked state is warm and gives nothing away, then view source
  and Ctrl-F for a letter title.
- Sign in with each passcode and confirm the role difference in the DOM, not just visually.
- Open a letter, close it, open another; the Network tab re-fetches each time and no blob accumulates.
- DevTools → Rendering → *Emulate prefers-reduced-motion: reduce*; then Slow 3G, where the skeleton
  shows and nothing flashes unstyled.
- Dark mode, 375px, at night, actually reading a full letter end to end. If you do not want to
  finish it, the typography is wrong.

## Definition of Done

- [ ] Every `03` prerequisite verified by running its own verification commands
- [ ] `letters.html` + `src/letters.js` + `src/styles/letters.css` + `src/data/letters.js` created
- [ ] `vite.config.js` input added; `dist/letters.html` confirmed
- [ ] R3 path chosen, implemented, and stated in the PR description
- [ ] Locked state is warm, explains itself, and leaks nothing
- [ ] `getBlob()` only; `getDownloadURL` absent from the codebase
- [ ] Blob URLs revoked on close, switch, and `pagehide`
- [ ] No body text committed to the repo or bundled into `dist/`
- [ ] Owner vs `tolu` roles differ in the DOM, and Storage rules independently enforce it
- [ ] Reading view: 60–70ch, `--font-body`, script reserved for title/occasion
- [ ] Envelope interaction once per card, reduced-motion safe — or cut, deliberately
- [ ] No search, no filters, no badges, no guilt copy
- [ ] Signed-out `curl` of a `letters/` object returns 403
- [ ] Zero new dependencies; `npm run build` clean
- [ ] Letters card un-hidden on the For You hub
- [ ] `DOCS.md` updated: the page, the `letters/` prefix, the MVP-privacy vs real-security note,
      the chosen CSP path, and why `dist/` being public rules out local Markdown bodies
