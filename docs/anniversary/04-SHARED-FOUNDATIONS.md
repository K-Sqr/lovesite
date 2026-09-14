# 04 — Shared Foundations

> Every feature after this one depends on this file. If you skip it, you will write the same
> navigation, the same storage boilerplate, and the same IntersectionObserver six times, and the
> six new pages will drift apart visually.

**Prerequisites:** `01-REPOSITORY-AUDIT.md`, `02-DESIGN-SYSTEM.md` (completed), `03-SECURITY-REMEDIATION.md` (completed).

**Recommended tool:** Claude Code — this is a multi-file scaffold with a mechanical, well-specified
shape, and it touches all four existing HTML files identically. That is exactly what a batch agent
is good at. Review the nav diff carefully afterwards.
**Model:** a strong reasoning model for `storage.js` (the encryption boundary matters), a cheap one
for the repetitive HTML edits.

---

## Context

From the audit, the facts that force this work:

- **No router, no templating.** Nav markup, CSP, fonts, and the music player are copy-pasted into
  every HTML file. Six new pages means six more copies.
- **The nav is a single flex row** that already holds a brand + 4 links + a theme toggle, and
  degrades at ≤600px only by shrinking text. Adding 6 links breaks it on a phone.
- **Three separate copies** of the same scroll-reveal `IntersectionObserver` exist.
- **New page = `.html` at root + `vite.config.js` input.** Both, every time.
- **New `fetch` host = CSP `connect-src` edit in every HTML file.**
- **localStorage is shared across the whole `k-sqr.github.io` origin** and keys must be namespaced.
- Five of the six new features store data locally. Only Letters needs the network.

---

## Objective

Build five things:

1. **Information architecture + a mobile-capable nav** that can hold the new sections.
2. **A page scaffold** (`foryou.html` hub) plus a documented checklist for adding a page.
3. **A storage layer** (`src/modules/storage.js`) with namespacing, versioned schemas, export/import,
   and an **encrypted** variant for sensitive data.
4. **A shared reveal module** replacing the three duplicated observers.
5. **A shared date utility** — because the timeline, period tracker, applications, and check-ins all
   need real calendar math, and the codebase currently approximates months as `days / 30.44`.

---

## Information architecture — the decision

**Top-level navigation (5 items):**

```
♥ Us Machina    Home    Our Story    Memories    LoveGPT    For You    🌙
```

`Our Story` is a **rename of the existing `Timeline` link** (same `timeline.html`, same file — just
the label; "Our Story" is already the page's own `<h1>`, so this makes nav and page agree).

`For You` is a **new hub page** (`foryou.html`) that is the entrance to the six tools. It is not a
dashboard. It is a short, warm page — a line of writing, then six cards.

**Second level, reached only from the For You hub:**

| Card | Page | Feature file |
| --- | --- | --- |
| 💌 Letters | `letters.html` | `06-LETTERS.md` |
| 💼 The Application Desk | `applications.html` | `07-JOB-APPLICATION-STUDIO.md` |
| 🫶 People | `people.html` | `08-FRIENDS-FAMILY.md` |
| 🌷 Rhythm | `rhythm.html` | `09-PERIOD-TRACKER.md` |
| 👗 What to Wear | `outfit.html` | `10-OUTFIT-OF-THE-DAY.md` |
| ✨ (hidden) | — | `12-ANNIVERSARY-EXPERIENCE.md` — not a nav item, by design |

**Naming rationale — the labels carry the whole tone, so they are specified, not left open:**

- **"The Application Desk"**, not "Job Search" or "Application Studio". A desk is a place where you
  sit down and do one thing calmly. "Studio" and "Dashboard" are product words.
- **"Rhythm"**, not "Period" or "Cycle Tracker". It is discreet on a shared screen, it is what the
  thing actually is, and it does not announce itself if someone glances at her phone. This is a
  privacy feature disguised as a naming choice.
- **"People"**, not "Contacts" or "Check-ins". Warm, no obligation implied.
- **"What to Wear"**, not "Outfit of the Day". It is phrased as the question she actually asks.
- **"Letters"** stays. It is already perfect.

You may adjust wording, but preserve the principle: **the label should sound like something a
person would say, and no label should imply a task she owes anyone.**

### Do not build

A sidebar. A breadcrumb trail. A settings page with tabs. A global search. A notification bell with
an unread badge. All six of those are how this becomes a dashboard.

---

## Files you own (create)

```
foryou.html                        For You hub
src/foryou.js                      hub entry
src/styles/foryou.css              hub styles
src/modules/siteChrome.js          renders nav + music + footer into every page
src/modules/storage.js             namespaced local persistence (+ encrypted variant)
src/modules/reveal.js              single shared IntersectionObserver
src/modules/dates.js               real calendar math + gentle relative formatting
docs/anniversary/PAGE-CHECKLIST.md the "adding a page" checklist
```

## Files you may modify

```
vite.config.js                     add the foryou input (and later, one per feature page)
index.html, timeline.html,         nav markup + CSP only
memories.html, lovegpt.html
src/main.js, src/timeline-page.js, replace local observers with reveal.js
src/memories.js, src/lovegpt.js
src/styles/sections.css            nav mobile behaviour only
src/modules/navbar.js              may be superseded by siteChrome.js — if so, delete it and
                                   update the four imports
```

## Files you must not touch

`src/data/*` · `src/modules/{buttons,graffiti,textReveal,verses,loveCounter,upload,memoriesGallery,memoryAdmin,firebase}.js` · `functions/**` · `firestore.rules` · `storage.rules` · `src/styles/{base,animations,memories,timeline-page,lovegpt}.css`

---

## Requirements

### R1 — `siteChrome.js`: stop copy-pasting the nav

Export `initSiteChrome({ active })` which renders the nav (brand, 5 links, theme toggle) and the
music toggle + `<audio>` element into the page, then calls `initTheme()` and `initMusicPlayer()`.

- Nav links are defined in **one** array in this module. Adding a section is a one-line change.
- `active` marks the current section, replacing `navbar.js`'s path-sniffing (which is fragile: it
  string-matches `href` against `location.pathname` and special-cases `/lovesite/`).
- Each HTML file keeps only `<nav id="siteNav"></nav>` and a music mount point; the module fills them.
- **The nav must render before first paint or reserve its space** — it is `position: fixed` and
  `body { padding-top: 52px }` already compensates, so keep the height at exactly **52px** or
  update that rule in one place. Do not let the page jump on load.
- **Do not** move the CSP or the font `<link>` into JS. CSP must be in the HTML head to be
  effective, and fonts must not wait on JS. Those stay duplicated; the `PAGE-CHECKLIST.md` covers it.

### R2 — Mobile navigation

At ≤600px, 5 links plus a brand plus a toggle does not fit. Implement **one** of:

- **(Recommended) Bottom tab bar on mobile, top bar on desktop.** Icons + short labels, 5 tabs. This
  is a phone-first personal app and she will use it one-handed. It also removes the top-nav crowding
  problem entirely and feels native rather than like a shrunken website.
- A `<details>`-based or button-toggled disclosure menu, if you prefer to keep one bar.

Requirements either way: 44px targets, `aria-current="page"` on the active item, keyboard operable,
visible `:focus-visible` ring, respects `prefers-reduced-motion`, no layout shift on load, and the
`--card-bg` + `backdrop-filter: blur(12px)` treatment the existing nav uses. If you go with the
bottom bar, add `padding-bottom: env(safe-area-inset-bottom)` and make sure it does not cover the
music toggle (`.music-toggle` sits at `bottom: 1rem/1.5rem`, `z-index: 300` — move it or move the bar).

### R3 — `storage.js`: the local persistence layer

This is the backbone for Applications, People, Rhythm, Wardrobe, and Reminders. Get it right once.

```js
createStore(name, { version, migrate, encrypted })
  → { read(), write(value), update(fn), clear(),
      export(), import(json), subscribe(fn) }
```

- **Key namespace: `usm.<name>.v<version>`.** Mandatory — the origin is shared with every other
  `k-sqr.github.io` Pages site.
- **Envelope on disk:** `{ v: <schemaVersion>, updatedAt: <ISO>, data: <payload> }`. Never store a
  bare array; you will regret it at the first schema change.
- **Migrations:** on read, if the stored `v` is older, run `migrate(oldData, oldV)` and write back.
- **Fail soft, always.** localStorage throws in Safari private mode and when the quota is full.
  Wrap every access; on failure fall back to an in-memory store for the session and surface a
  single, calm banner ("Saving isn't working in this browser right now"). **Never let a storage
  error throw away what she just typed.** Prefer keeping the value in memory and letting her retry.
- `subscribe(fn)` fires on local writes **and** on the `storage` event, so two open tabs stay in sync.
- `export()` returns a pretty-printed JSON string; `import()` validates the envelope and version
  before overwriting, and rejects mismatched `name`.
- Quota: localStorage is ~5 MB per origin. Text records are fine. **Wardrobe photos are not** — they
  go in IndexedDB (see R3b).

#### R3b — `encrypted: true`

For the Rhythm tracker only (`09-PERIOD-TRACKER.md` consumes this).

- Derive a key with **PBKDF2** (WebCrypto `deriveKey`, SHA-256, **≥250,000 iterations**, 16-byte
  random salt) from a passphrase the user types.
- Encrypt the payload with **AES-GCM**, fresh 12-byte IV per write.
- Stored envelope: `{ v, alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations, salt, iv, ciphertext }`
  — all binary base64-encoded.
- **The passphrase and the derived key are never written to any storage.** The `CryptoKey` lives in
  a module-scoped variable, is non-extractable, and dies on page unload. She re-enters the
  passphrase per session. That friction is the feature.
- A wrong passphrase must surface as a clean "that's not it" — AES-GCM authentication failure is
  the check, so **do not** store a verification hash of the passphrase anywhere.
- **Consequence, and you must state it in the UI:** *forgetting the passphrase means the data is
  unrecoverable.* There is no reset. Say so plainly at setup.

#### R3c — IndexedDB for blobs

A minimal `createBlobStore(name)` → `{ put(id, blob), get(id), delete(id), keys(), estimate() }`
over IndexedDB, for wardrobe photos. No wrapper library — `idb` is nice but this needs one object
store and four methods. Same fail-soft contract.

### R4 — `reveal.js`

`initReveal(root = document)` — one observer, `{ threshold: 0.12, rootMargin: '0px 0px -32px 0px' }`,
adds `.visible` to `.reveal` elements, unobserves after firing.

- Export `observeReveal(el)` so dynamically inserted rows animate in.
- If `prefers-reduced-motion: reduce`, add `.visible` to everything immediately and skip observing.
- **If `IntersectionObserver` is unavailable, add `.visible` to everything.** Content must never be
  invisible because an API is missing — the `.reveal` base style is `opacity: 0`, which is a
  content-hiding failure mode.
- Replace the three inline observers in `main.js`, `timeline-page.js`, `memories.js`. Keep the
  existing thresholds' *visual effect* — do not make the homepage reveal feel different.
- Also fix, while here: `src/memories.js` uses `.reveal` but never imports `animations.css`. Add it.

### R5 — `dates.js`

The counter and stats currently do `Math.floor(days / 30.44)`. That is an approximation shown to
her as a fact, and the brief says **no fake statistics.**

Export:

- `parseISO(s)`, `toISO(d)`, `startOfDay(d)`
- `daysBetween(a, b)` — whole days, DST-safe (compare `startOfDay` UTC-normalised, do not divide
  milliseconds)
- `calendarDuration(from, to)` → `{ years, months, days }` by **real calendar arithmetic**
  (month-by-month, not `/30.44`)
- `addDays`, `addMonths`
- `formatRelativeGentle(date, now)` → `'today' | 'yesterday' | '3 days ago' | 'last week' |
  'about a month ago' | 'a while back'`. **Never** returns a number of days overdue, never
  "X days late", never a negative-sounding phrase. This function is the tone of the People feature
  in one place — write it with care and put the tone rule in a comment so nobody "improves" it.
- `formatDateRange(a, b)` → `'September 18–22'`

Do **not** change `loveCounter.js` in this task. Its off-by-a-bit month count is cosmetic and it is
a beloved piece of the site; retro-fitting it belongs in `16-FINAL-POLISH.md` where you can look at
it visually.

### R6 — `foryou.html` hub

- Header: page `h1` "For You" and **one sentence** in `--font-display` explaining the room in his
  voice. Not a tagline, not marketing — something like *"Little things I made so your days take
  less out of you."* Write it as him talking to her.
- Six cards using `.usm-card` + `.reveal` with `data-delay` staggering. Each card: emoji, name, and
  one line of plain-language purpose ("Everything I've written you", "One application at a time",
  "Who you might want to say hi to").
- **Cards may show a small, calm state hint** once features exist (e.g. "3 in progress",
  "next window in about a week"). Rules: no counters that imply backlog, no badges, no red dots,
  and **nothing from Rhythm may appear here** — that page's state is behind the passphrase and must
  not leak a hint onto a shared-visible hub. Ship the hub with static copy first and add hints later.
- Build the hub **before** any tool page. Link cards to pages that do not exist yet with a
  `data-coming-soon` attribute and a gentle "coming soon" state, and remove that per feature as it
  lands. This keeps every feature branch independently shippable.

### R7 — `PAGE-CHECKLIST.md`

Because forgetting step 2 costs a confusing production 404:

1. Create `<name>.html` at repo root — copy an existing page's `<head>` verbatim (fonts, CSP, icon,
   viewport), body contains `<nav id="siteNav"></nav>`, the page container, and the music mount.
2. **Add the entry to `rollupOptions.input` in `vite.config.js`.**
3. Create `src/<name>.js` importing `base.css`, `ui.css`, the page CSS, then
   `initSiteChrome({ active })` and `initReveal()`.
4. Add the link to the `NAV_LINKS` array in `siteChrome.js` if it is top-level, or a card in
   `foryou.js` if it is a tool.
5. If the page calls a new host, add it to `connect-src` **in every HTML file** (they must stay
   identical) and record the host in `DOCS.md`.
6. `npm run build`, then confirm `dist/<name>.html` exists.
7. `npm run preview` and load the page at `/lovesite/<name>.html` — the `base` path is a common
   source of broken links.

---

## UX requirements

- Nav transition between top-bar and bottom-bar layouts must not flash or shift content on load.
- Hub cards: lift + shadow step-up on hover exactly as `.gallery-card` does; `:active` press state;
  whole card is one link target (not a nested "Open" button).
- The hub must look complete and intentional **with all six cards in "coming soon" state**. If it
  looks like an unfinished construction site, the tone is already lost.
- Empty and loading states use `.usm-empty` / `.usm-skeleton` from `ui.css`.
- Everything works at 375px width, one-handed, with a thumb.

## Technical requirements

- Start from the existing Vite MPA. TypeScript is welcome on new modules. A framework is
  allowed on `foryou.html` only in this batch — do not convert the four existing pages.
  New dependencies are allowed if they earn their place. See `RUN-SHEETS.md` Stack policy.
- No inline `<script>` (CSP forbids it).
- `siteChrome.js` must be safe to call on a page with no music element.
- All new localStorage keys under `usm.`.
- No `console.log` left behind; errors go through one small `warn()` helper.

## Privacy / security

- `storage.js` must never send anything anywhere. No fetch, no analytics, no beacon.
- **Do not** write the Rhythm passphrase, or any passcode, into source, docs, comments, or fixtures.
- Consider whether `getAnalytics()` in `firebase.js` should run on the new tool pages at all. It
  currently fires on every page unconditionally, which means Google Analytics would receive a
  pageview for `rhythm.html`. **Recommendation: `firebase.js` is imported only by memories/LoveGPT
  paths today — keep it that way. No new page should import `firebase.js` except `letters.html`.**
  State explicitly in your PR which new pages touch Firebase.

## Do not

- Do not convert the site to a SPA or add a client router.
- Do not add a build-time templating step, partials system, or HTML preprocessor.
- Do not delete or restyle `buttons.js`, `textReveal.js`, `graffiti.js`, or the verse carousel.
- Do not modify `loveCounter.js`.
- Do not change existing CSS token values.
- Do not touch `firestore.rules` or `storage.rules` in this task.
- Do not add a service worker or PWA manifest yet — that is `11-NOTIFICATIONS.md`, and doing it here
  will cause caching confusion during development.

---

## Implementation strategy

1. `dates.js` + `reveal.js` first — pure, no dependencies, independently verifiable.
2. `storage.js` unencrypted path, then the encrypted path, then `createBlobStore`.
3. `siteChrome.js`; migrate `index.html` alone and confirm it is identical to before.
4. Migrate the other three pages. Delete `navbar.js` if fully superseded.
5. Nav mobile treatment.
6. `foryou.html` + `vite.config.js` entry + `foryou.css`.
7. `PAGE-CHECKLIST.md`.

Commit after each step. Steps 3–4 are where a regression will hide.

## Acceptance criteria

1. `npm run build` succeeds; `dist/` contains all **five** HTML files.
2. All four original pages look and behave **exactly** as before: proposal reveal, No-button dodge,
   graffiti, verses, counter, gallery, upload, lightbox, chat, theme toggle, cross-page music.
3. Nav markup exists in exactly **one** place in JS. Adding a link is a one-line edit.
4. At 375px all five nav destinations are reachable with 44px targets; the active one is marked with
   `aria-current`.
5. `storage.js`: round-trips a value; survives a simulated `QuotaExceededError` without data loss;
   `export()` → `import()` reproduces state; a second tab sees changes via `subscribe`.
6. `storage.js` encrypted: write → reload → wrong passphrase fails cleanly → correct passphrase
   decrypts. **The raw localStorage value is unreadable ciphertext in DevTools.** No plaintext and
   no passphrase anywhere in Application storage.
7. `dates.js`: `calendarDuration('2025-09-13', '2026-09-13')` → `{ years: 1, months: 0, days: 0 }`.
   `daysBetween` is correct across a DST boundary. `formatRelativeGentle` never produces a phrase
   containing "overdue", "late", or "should".
8. `reveal.js` is the only IntersectionObserver for `.reveal` in the codebase.
9. With `prefers-reduced-motion: reduce`, all content is visible and nothing animates.
10. `foryou.html` renders six cards, is keyboard navigable, and looks finished with all six in
    "coming soon".
11. Zero new dependencies in `package.json`.

## Verification

```bash
npm run dev      # /lovesite/  and /lovesite/foryou.html
npm run build && npm run preview
grep -rn "IntersectionObserver" src/          # → only src/modules/reveal.js
grep -rn "localStorage.setItem" src/          # → only storage.js and theme.js
git diff --stat                               # nav edits should be small and identical in shape
```

Manual:
- Toggle theme on every page; reload; preference sticks.
- Start music on Home, navigate to For You — it keeps playing, hint does not re-pop.
- DevTools → Application → Local Storage: only `aho_theme` and `usm.*` keys; the encrypted store
  shows ciphertext.
- DevTools → Rendering → *Emulate prefers-reduced-motion*.
- Throttle to Slow 3G and confirm no flash of unstyled or missing nav.
- Safari private mode (or block storage in DevTools): the app still loads and shows a calm banner.

## Definition of done

- [ ] `dates.js`, `reveal.js`, `storage.js` (+ encrypted + blob), `siteChrome.js` created
- [ ] Four existing pages migrated; `navbar.js` removed or justified in a comment
- [ ] Nav holds 5 destinations at 375px with `aria-current` and focus rings
- [ ] `foryou.html` + `src/foryou.js` + `src/styles/foryou.css` + `vite.config.js` entry
- [ ] `docs/anniversary/PAGE-CHECKLIST.md` written
- [ ] `src/memories.js` imports `animations.css`
- [ ] All 11 acceptance criteria verified
- [ ] `DOCS.md` updated: new modules, the `usm.` key namespace, the IA, and the page-add procedure
