# 01 — Repository Audit (Fact Sheet)

> **Status:** Complete. This file is **reference material, not a task.**
> Every other prompt in `docs/anniversary/` assumes these facts. If you change the
> repository in a way that invalidates something here, update this file.
>
> Audited against commit `a96e270` (`master`), plus uncommitted edits to `DOCS.md`.

---

## 1. Stack — what this actually is

| Question | Answer |
| --- | --- |
| Framework | **None.** Vanilla JavaScript, ES modules, hand-written DOM. No React/Vue/Svelte. |
| Language | JavaScript (ESM, `"type": "module"`). **No TypeScript, no JSX, no build-time templating.** |
| Build system | **Vite 8**, multi-page application (MPA) mode |
| Package manager | **npm** (`package-lock.json` committed) |
| Routing | **None.** Four separate `.html` files at repo root. Navigation is hardcoded `<nav>` markup duplicated in each HTML file. |
| Component architecture | "Modules that render into a known DOM id." Each file in `src/modules/` exports an `initX()` function that finds an element by `id`/class and imperatively builds children. No component abstraction, no props, no lifecycle. |
| Styling | **Plain CSS**, 6 files, hand-imported by each page entry. No Tailwind, no CSS modules, no preprocessor. |
| State management | **None.** Module-scoped `let` variables. Cross-page state via `localStorage` / `sessionStorage`. |
| Tests | **None.** No test runner, no test files, no `test` script. |
| Linting / formatting | **None.** No ESLint, no Prettier, no `.editorconfig`. |
| CI/CD for the site | **None.** Deployment is a manual local command. |
| TypeScript config | Absent. |

### Dependencies (complete)

```
dependencies:     firebase ^12.10.0
devDependencies:  vite ^8.0.0, gh-pages ^6.3.0
functions/:       firebase-functions, firebase-admin, @google/generative-ai
```

That is the entire dependency surface. **Adding a dependency is a real decision here, not a
formality.** Prefer platform APIs.

---

## 2. Build & deployment

### `vite.config.js`

```js
base: '/lovesite/',
build.outDir: 'dist',
rollupOptions.input: { main: index.html, memories: memories.html,
                       timeline: timeline.html, lovegpt: lovegpt.html }
```

**Consequence:** every new page requires **two** edits — a new `.html` at repo root **and** a new
entry in `rollupOptions.input`. Forgetting the second means the page works in `npm run dev` and
silently 404s in production. This has bitten people; it will bite you.

`publicDir` is not overridden, so `public/` is copied to the deploy root. That is why photos are
referenced as `./photos/...` and music as `./music/...`, **not** `./public/photos/...`.

### Scripts

```
npm run dev      → vite            (http://localhost:5173/lovesite/)
npm run build    → vite build      (→ dist/)
npm run preview  → vite preview
npm run deploy   → vite build && gh-pages -d dist
```

### Hosting

- GitHub Pages, `build_type: legacy`, **source = `gh-pages` branch, path `/`**
- Live at `https://k-sqr.github.io/lovesite/`, HTTPS enforced
- Repo: `https://github.com/K-Sqr/lovesite` — **visibility: PUBLIC**
- Only branch on the remote is `master`; `gh-pages` is created/pushed by the `gh-pages` package
  and has no local tracking branch.

### `.github/workflows/npm-publish-github-packages.yml`

Boilerplate npm-package-publishing workflow, triggered on GitHub *release*. It runs `npm ci &&
npm test`, and **`package.json` has no `test` script**, so it would fail if a release were ever
cut. It is unrelated to this site. **Treat as dead. Do not build on it.** Deleting it is a
reasonable cleanup (see `16-FINAL-POLISH.md`).

---

## 3. Pages and entry points

| Page | Entry module | Imports (CSS) | Purpose |
| --- | --- | --- | --- |
| `index.html` | `src/main.js` | base, sections, animations | Proposal reveal → unlocks timeline preview, gallery preview, verses, counter |
| `timeline.html` | `src/timeline-page.js` | base, sections, animations, memories, timeline-page | Full timeline + stats |
| `memories.html` | `src/memories.js` | base, sections, memories | Photo grid, upload, delete, lightbox |
| `lovegpt.html` | `src/lovegpt.js` | base, sections, lovegpt | AI chat |

Note `src/memories.js` **does not import `animations.css`** yet uses `.reveal` / `.visible`
classes, which are defined in `animations.css`. Reveal transitions on the memories page therefore
depend on incidental cascade. Minor existing bug; do not "fix" it as a side effect of feature work.

### Shared per-page boilerplate

Each HTML file repeats, verbatim:

1. Google Fonts `<link>` (Dancing Script 400/600/700 + Inter 400/500/600) with preconnects
2. A `<meta http-equiv="Content-Security-Policy">` tag (see §7)
3. The `<nav id="siteNav">` block with 4 links + theme toggle
4. The `#musicToggle` button + `<audio id="bgMusic">` element
5. `<link rel="icon" href="./heart.png">`

There is **no HTML templating**, so this duplication is real and must be maintained by hand on
every new page. `04-SHARED-FOUNDATIONS.md` addresses this.

---

## 4. Modules (`src/modules/`) — actual behaviour

| Module | Lines | What it really does |
| --- | --- | --- |
| `auth.js` | 111 | Passcode → Cloud Function → Firebase custom token → `signInWithCustomToken` with `browserSessionPersistence`. Exports `isAuthenticated()`, `authenticateWithPasscode()`, `showPasscodeModal()`, `ensureAuthenticated()`. **This is real server-verified auth.** |
| `buttons.js` | 103 | Yes/No handlers. "No" detaches to `document.body`, goes `position: fixed`, bounces through 15 hardcoded `ZONES`, cycles `noTexts`, disappears after 15 clicks. |
| `firebase.js` | 26 | `initializeApp` with **hardcoded** config; exports `db`, `storage`, `auth`; calls `getAnalytics(app)`. |
| `gallery.js` | 75 | Home page 6-photo preview from Firestore. |
| `graffiti.js` | 31 | Falling-emoji celebration. |
| `loveCounter.js` | 47 | Live counter from `new Date(2025, 8, 13)` (**Sep 13, 2025**). Updates every 1s via `setInterval`, rewrites `innerHTML` each tick. Months computed as `days / 30.44`. |
| `memoriesGallery.js` | 83 | `fetchMemories()`, `renderMemoryCard()` (safe DOM, `textContent` for captions, URL scheme allow-list), `setupLightbox()`. |
| `memoryAdmin.js` | 18 | `deleteMemory()` — Firestore `deleteDoc` + best-effort Storage `deleteObject`. |
| `musicPlayer.js` | 159 | Autoplay-with-fallback, cross-page continuity via `sessionStorage` (`music_should_play`, `music_muted`, `music_popup_shown`). Toggle = mute/unmute, not pause. |
| `navbar.js` | 14 | Only sets `.active` on the matching `.nav-link`. **It does not render the nav.** |
| `textReveal.js` | 98 | Character-by-character sparkle reveal + skip. |
| `theme.js` | 29 | `data-theme` on `<html>`, persisted to `localStorage` key **`aho_theme`**, defaults to `light`. Wires **all** `.theme-toggle` elements. |
| `timeline.js` | 30 | Renders `mainMilestones` or `fullMilestones` into `.timeline` via `innerHTML`. Adds `.timeline-entry.reveal` with `data-delay` = `(i % 4) + 1`. |
| `upload.js` | 65 | Canvas compression (max width 1200, JPEG q0.82) → `uploadBytesResumable` → `addDoc`. |
| `verses.js` | 65 | Verse carousel + floating verse overlay. |
| `webhook.js` | 13 | `RESPONSE_WEBHOOK_URL` is `''` → **no-op**. Dead code. |

### The one shared UI convention worth knowing

Scroll-in animation is **not** a module. Each page re-implements the same
`IntersectionObserver` locally (`main.js:42`, `timeline-page.js:40`, `memories.js:82`):

```js
// add .visible when .reveal enters the viewport
{ threshold: 0.1–0.15, rootMargin: '0px 0px -30px/-40px 0px' }
```

Combined with `.reveal[data-delay="1..4"]` stagger classes in `animations.css`. Three copies,
slightly different thresholds. `04-SHARED-FOUNDATIONS.md` consolidates this.

---

## 5. Data layer

### `src/data/` — static content modules

| File | Exports | Notes |
| --- | --- | --- |
| `milestones.js` | `mainMilestones` (5), `fullMilestones` (18) | **Two hand-maintained arrays with duplicated content.** `mainMilestones` is a manually abridged copy of 5 `fullMilestones` entries. Editing one does not update the other. |
| `verses.js` | `verses` (33), `graffitiTexts` | |
| `noTexts.js` | `noTexts` (16) | |

**Milestone entry shape (actual):**

```js
{ date: 'Aug 18, 2025',   // display string — NOT parseable-sorted, NOT ISO
  title: 'The Confession',
  description: '…',        // NOTE: DOCS.md incorrectly calls this `desc`
  icon: '\u{1F49C}' }      // emoji
```

There is **no** `id`, `location`, `photos`, `featured`, `tags`, or `type` field. Dates are
display-only strings; nothing sorts or filters by them.

**Current timeline coverage: `Aug 18, 2025` → `Mar 13, 2026`.** The final entry is
`Six Months — Happy 180 Days`.

> ⚠️ **Discrepancy to resolve with the owner.** The expansion brief describes the timeline as
> stopping at *"May 13, 2026 — our 6 month anniversary."* The repository says the six-month
> milestone is **Mar 13, 2026** (consistent with the `Sep 13, 2025` start date in
> `loveCounter.js` and `timeline-page.js`). The gap to fill is therefore
> **Mar 2026 → Sep 2026**, ending at the **one-year anniversary on Sep 13, 2026**.
> Confirm before authoring entries.

### Firestore

Project `lovesite-1540e`. **One** collection:

**`memories/{docId}`** — `{ url, caption, filename, createdAt }`
(`upload.js` writes exactly these four. `DOCS.md` claims a `passcodeHash` field is also
written — **it is not**; that is stale documentation.)

`firestore.rules`:
```
memories: read = public
          create = auth.uid == 'owner' AND has [url, caption, filename, createdAt]
                   AND caption.size() <= 500
          update = false
          delete = auth.uid == 'owner'
/{document=**}: read, write = false     ← DENY-BY-DEFAULT
```

**Consequence: any new Firestore collection is unwritable and unreadable until you add rules.**
Every feature prompt that touches Firestore must ship a `firestore.rules` change and a deploy step.

### Storage

`storage.rules`:
```
memories/{fileName}: read = public
                     create = auth.uid == 'owner' AND size < 10MB AND contentType image/*
                     update, delete = owner
/{allPaths=**}: read, write = false     ← DENY-BY-DEFAULT
```

Same consequence: a new Storage prefix (e.g. `letters/`) needs an explicit rule block.

### Browser storage currently in use

| Key | Store | Owner |
| --- | --- | --- |
| `aho_theme` | localStorage | `theme.js` |
| `music_should_play`, `music_muted`, `music_popup_shown` | sessionStorage | `musicPlayer.js` |
| Firebase auth session | sessionStorage (`browserSessionPersistence`) | `auth.js` |

> ⚠️ **Origin-sharing caveat.** The site is hosted at `k-sqr.github.io/lovesite/`. Browser storage
> is scoped to the **origin** `https://k-sqr.github.io`, *not* the path. Any other GitHub Pages
> site published under the same `k-sqr.github.io` user domain shares this localStorage. Namespace
> all new keys (`usm.*`) and never assume path isolation.

---

## 6. LoveGPT / RAG — existing implementation

**Do not rewrite this. It works.**

```
POST https://lovegpt-osmy5pclpq-uc.a.run.app
```

Firebase Cloud Function v2 (`onRequest`), region `us-central1`, `nodejs20`, 256 MiB,
`invoker: 'public'`, CORS allow-list: `https://k-sqr.github.io`, `http://localhost:5173`,
`http://localhost:4173`.

**One endpoint, two jobs**, dispatched on `body.action`:

1. `action: 'verify-passcode'` → SHA-256 of `passcode.trim().toLowerCase()` compared against the
   `OWNER_PASSCODE_HASH` secret → on match, `admin.auth().createCustomToken('owner')`.
2. *(no action)* → RAG chat.

### Retrieval

No vector DB, no embeddings. `functions/knowledge/chunks.json` holds **48 chunks**:

```json
{ "id": "...", "source": "emmanuel" | "tolu" | "both",
  "section": "food_preferences", "tags": ["..."], "content": "..." }
```

Scoring in `scoreChunk()`: tag match **+3**, section match **+2**, content match **+1**.
Top **8** chunks; if keyword extraction yields nothing, first 5 chunks are used. Context is
labelled per source ("From Emmanuel's notes" / "From Tolu's journal") and prepended to the user
message. Model: **`gemini-2.5-flash`** (`DOCS.md` still says `2.0-flash` in one place — stale).

Existing `section` values (43 distinct) include month buckets `august_2025` … `march_2026`, plus
`food_preferences`, `nicknames`, `health_details`, `intimacy_attraction`, `wedding_planning`,
`spiritual_warfare`, `pickup_lines`, and others.

**Extending LoveGPT's knowledge = appending chunks to `chunks.json` + redeploying the function.**
That is the entire mechanism. It is cheap and it is the right way to add timeline/letter context.

### Secrets

| Secret | Where |
| --- | --- |
| `GEMINI_API_KEY` | Firebase Functions secret |
| `OWNER_PASSCODE_HASH` | Firebase Functions secret |
| `OWNER_UID` | `process.env`, defaults to `'owner'` |

**No secret is present in frontend source.** The Firebase web config in `src/modules/firebase.js`
is public by design (it is an identifier, not a credential) — that is correct and is not a finding.

---

## 7. Security posture — findings

### 🔴 CRITICAL — private letters and journal are publicly downloadable, right now

Three PDFs are **committed to a public repository**:

```
docs/boo.pdf              (Emmanuel's notes)
docs/Happy 180 days.pdf    (the 10-page anniversary letter)
docs/journal.pdf           (Tolu's 54-page personal journal)
```

Verified live during this audit:

```
GET https://raw.githubusercontent.com/K-Sqr/lovesite/master/docs/boo.pdf
→ HTTP 200, 13,389,504 bytes
```

They are **not** exposed via GitHub Pages (`https://k-sqr.github.io/lovesite/docs/boo.pdf` → 404,
because `docs/` is not inside `publicDir`). The exposure is the **public git repository**, and it
includes full history. Anyone with the repo URL can read her private journal.

`03-SECURITY-REMEDIATION.md` handles this. **It runs before any feature work.**

### 🔴 A private repository does **not** protect anything the build inlines

This is the trap that will catch someone who reads the remediation plan and concludes "the repo is
private now, so I can commit her letters as Markdown."

GitHub Pages serves `https://k-sqr.github.io/lovesite/` **publicly** (`pages.public = true`),
independent of repository visibility. Private Pages access control is an Enterprise-only feature.
So the boundary is not "repo public vs private" — it is **"does this content end up in `dist/`?"**

| Content | Reaches `dist/`? | Protected by a private repo? |
| --- | --- | --- |
| Anything imported by `src/**` — including `import body from './letter.md?raw'` | **Yes**, inlined into `dist/assets/*.js` | ❌ **No.** Publicly fetchable from the deployed bundle. |
| Anything in `public/` | **Yes**, copied verbatim | ❌ **No.** |
| `functions/knowledge/chunks.json` | **No** — `functions/index.js:21` reads it with `readFileSync` at function cold start, and `functions/` is never bundled by Vite | ✅ **Yes.** |
| `docs/*.pdf` | **No** — outside `publicDir`, hence the 404 on Pages | ✅ **Yes** (the exposure was the repo, not the site). |

Verified: `grep -rn "chunks" src/` returns nothing, so the RAG corpus is genuinely function-side.

**Consequences:**

1. Making the repo private **is** the fix for `chunks.json` and the PDFs.
2. Making the repo private is **not** a licence to commit letter bodies, cycle data, or anything
   else private into `src/` or `public/`. Private document bodies must live in Firebase Storage
   behind a rule, regardless of repo visibility. `06-LETTERS.md` depends on this.

### 🟡 Content Security Policy blocks PDF embedding

Every page ships this CSP via `<meta http-equiv>`:

```
default-src 'self'; script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' https://*.firebasestorage.app https://firebasestorage.googleapis.com data: blob:;
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com
            https://lovegpt-osmy5pclpq-uc.a.run.app
            https://www.google-analytics.com https://analytics.google.com;
font-src 'self' https://fonts.gstatic.com; media-src 'self'; frame-src 'none';
```

Implications for new work:

- **`frame-src 'none'`** → `<iframe>`, `<embed>`, and `<object>` PDF viewers **will not render.**
  A Letters PDF viewer requires either relaxing this or not using a frame.
- **`connect-src`** is an allow-list → any new API (e.g. a weather endpoint) must be added to the
  CSP **in all HTML files** or `fetch` is blocked.
- `script-src 'self'` with no `'unsafe-inline'` → no inline `<script>`, no `eval`. Good; keep it.
- The CSP is duplicated across 4 files and will be duplicated across every new page. See
  `04-SHARED-FOUNDATIONS.md`.

### 🟢 Already correct — do not "fix" these

- Server-side passcode verification with a hashed secret and short-lived custom tokens
- `browserSessionPersistence` (auth dies with the tab)
- Deny-by-default Firestore and Storage rules
- `textContent` for user-supplied captions; HTML-escaping before markdown in chat replies
- URL scheme allow-list on memory images
- Generic client-facing error strings, detailed logs server-side
- Prompt-injection guards in the system prompt
- `.gitignore` covers `.env`, `.env.*`, `firebase-debug.log`, `.firebase/`

### 🟡 Other notes

- `getAnalytics(app)` runs on **every page**, unconditionally, with no consent gate. Google
  Analytics will therefore see page views for any new page — including a period tracker. Analytics
  must be considered when adding sensitive pages.
- `firebase-debug.log` (≈300 KB) exists in the working tree. It is gitignored, so it is not
  leaking, but it should not be left around.
- No `Permissions-Policy` / `Referrer-Policy`; not achievable via `<meta>` on GitHub Pages anyway.
- `webhook.js` is inert but is a latent exfiltration path if ever populated. Consider deleting.

---

## 8. Accessibility & responsive reality

**Good:**
- `prefers-reduced-motion` block in `animations.css` disables animations, floating hearts, sparkles
- 44 px minimum tap targets used consistently
- `clamp()` typography throughout — genuinely fluid
- `aria-label` on icon buttons; `.sr-only` utility exists
- `lang="en"`, `viewport` meta, `-webkit-text-size-adjust: 100%`

**Gaps (relevant to new work):**
- **No mobile navigation pattern.** The nav is a single flex row that just shrinks font size at
  ≤600px. It already holds 4 links + brand + toggle. **It will break with more links.**
- **One breakpoint only:** `@media (max-width: 600px)`. No tablet or desktop-max treatment.
- No `:focus-visible` styles anywhere → keyboard focus is browser-default or invisible.
- Lightbox is not focus-trapped and does not restore focus on close.
- Chat has no `aria-live`, so screen readers do not announce replies.
- `body { padding-top: 52px }` is a hardcoded offset for the fixed nav — changing nav height
  breaks every page.
- No skip-to-content link.
- `.locked { display: none } / .locked.unlocked { display: flex }` gates homepage content — note
  that this is CSS-only gating, not security.

---

## 8b. Build output — measured baseline

`npm run build` succeeds cleanly in ~12s. Notable chunk sizes:

```
assets/memoriesGallery-*.js   400.33 kB  │ gzip: 122.30 kB   ← the Firebase SDK
assets/main-*.js               11.69 kB  │ gzip:   4.63 kB
assets/loveCounter-*.js         7.87 kB  │ gzip:   3.31 kB
assets/memories-*.js            6.72 kB  │ gzip:   2.69 kB
assets/theme-*.js               3.94 kB  │ gzip:   1.50 kB
assets/lovegpt-*.js             2.36 kB  │ gzip:   1.09 kB
assets/timeline-*.js            1.12 kB  │ gzip:   0.55 kB
assets/theme-*.css             13.93 kB  │ gzip:   3.40 kB
```

**The Firebase SDK is ~97% of the JavaScript on any page that imports `src/modules/firebase.js`**
(400 kB raw / 122 kB gzipped, versus 12 kB for the entire homepage). The site's own code is tiny.

Two consequences for this expansion:

1. Keeping Firebase off the new local-only pages is not just a privacy decision — it is the
   difference between a ~5 kB page and a ~125 kB page on her phone.
2. `firebase.js` imports `getFirestore`, `getStorage`, `getAuth`, **and** `getAnalytics` eagerly at
   module load, so every consumer pays for all four. If Letters ends up being the only new Firebase
   page, consider splitting the initialisation so a page can import just Auth + Storage.

`public/photos/` holds six unoptimised full-size photos and `public/music/` a full MP3. Neither is
processed by the build, so image and audio weight is untouched by these numbers.

## 9. Assets

```
public/heart.png                       favicon
public/music/Venus (Bass Version).mp3  background track
public/photos/  6 images (IMG_*.JPG/jpg, "WhatsApp Image 2026-03-18 at ….jpeg")
```

`src/memories.js` hardcodes these six as `LOCAL_PHOTOS` (`local-1` … `local-6`) and prepends them
to the Firestore results; entries whose `id` starts with `local-` are not deletable. Filenames
contain spaces and mixed case — fine today, but **do not follow this naming pattern** for new
assets.

There is no image optimisation step, no responsive `srcset`, and no `width`/`height` attributes
(so the gallery has layout shift).

---

## 10. Ten things that will trip up an implementation agent

1. **This is not React.** Do not introduce JSX, hooks, or a component library.
2. New page ⇒ **`.html` at root + `vite.config.js` input entry.** Both. Always.
3. New `fetch` target ⇒ **add to `connect-src` in every page's CSP meta tag.**
4. New Firestore collection or Storage prefix ⇒ **rules change + deploy**, else it silently fails.
5. Milestone objects use **`description`**, not `desc`.
6. `mainMilestones` and `fullMilestones` are **separate duplicated arrays**.
7. Milestone `date` is a **display string**, not sortable. Add ISO fields for anything date-driven.
8. `frame-src 'none'` means **PDF iframes do not work.**
9. `.reveal` needs `animations.css` imported **and** an IntersectionObserver wired on that page.
10. localStorage is shared across the whole `k-sqr.github.io` origin. **Namespace your keys.**

---

## 11. Verification commands used

```bash
npm run dev                      # http://localhost:5173/lovesite/
npm run build                    # must succeed with zero errors
gh api repos/K-Sqr/lovesite/pages
gh repo view K-Sqr/lovesite --json visibility,isPrivate
curl -sI https://raw.githubusercontent.com/K-Sqr/lovesite/master/docs/boo.pdf
```
