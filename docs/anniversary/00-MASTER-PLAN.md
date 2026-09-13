# 00 — Master Plan

**Us Machina 2.0 — Anniversary Expansion**
Target: **Sep 13, 2026** — one year.

> **Read this file first, then do exactly one thing: `03-SECURITY-REMEDIATION.md`.**
> Jump to [§10 Start Here](#10-start-here) if you want the instruction and nothing else.

---

## 1. Executive summary — what this application actually is

Us Machina is a **four-page static website written in plain JavaScript**. No React, no
TypeScript, no router, no state library. Vite bundles four separate HTML files; each one imports a
small entry script that calls a handful of `initX()` functions from `src/modules/`. Those functions
find an element by `id` and build DOM into it by hand. It is about 3,100 lines total, and the entire
dependency list is `firebase`, plus `vite` and `gh-pages` for development. That smallness is the
codebase's best quality and the plan protects it.

The frontend deploys to GitHub Pages by pushing `dist/` to a `gh-pages` branch. **The repository is
public.** There is no server for the website itself.

There *is* one real backend: a **Firebase Cloud Function** called `lovegpt`, which does two jobs.
It answers chat questions using a hand-rolled RAG pipeline — 48 hand-written knowledge chunks in
`functions/knowledge/chunks.json`, scored by keyword overlap (no embeddings, no vector database),
with the top 8 passed to Gemini 2.5 Flash. And it verifies a passcode against a hashed Firebase
secret and mints a Firebase custom token. That second job matters more than it looks: **this project
already has genuine server-verified authentication**, which is the foundation everything private
will be built on. Firestore and Storage rules are deny-by-default and only permit a single
`memories` collection and `memories/` prefix.

Styling is six plain CSS files with real design tokens in `base.css` — a pink palette with a full
dark-mode inversion, three radii, four shadows, five gradients, `clamp()` fluid typography, and one
breakpoint at 600px. Scroll animation is a single convention: an `.reveal` element gets `.visible`
when an `IntersectionObserver` sees it. That convention is currently copy-pasted into three files.

The honest weak points: navigation markup, the CSP, the font links, and the music player are
duplicated by hand into every HTML file, so adding six pages means six more copies. The nav is one
flex row that already holds four links and only shrinks on mobile — it will break with more. There
is no `:focus-visible` anywhere. There are no tests and no linting. Timeline data lives in two
duplicated arrays whose dates are unsortable display strings. And the site's own docs have drifted
from the code in five specific places.

**And one thing that is not a weak point but an active problem:** three PDFs — including her
54-page personal journal — are committed to the public repository and downloadable right now. That
is why the roadmap starts with remediation rather than features.

Full detail: **`01-REPOSITORY-AUDIT.md`**. That file is the fact sheet every other prompt assumes.

---

## 2. Architecture map (as-is, and where the new work lands)

```
                        GitHub Pages · k-sqr.github.io/lovesite/
                        (gh-pages branch · PUBLIC repo · static)
┌───────────────────────────────────────────────────────────────────────────────┐
│  EXISTING                              NEW (this expansion)                    │
│                                                                                │
│  index.html    → src/main.js           foryou.html    → src/foryou.js   [hub]  │
│  timeline.html → src/timeline-page.js   letters.html   → src/letters.js         │
│  memories.html → src/memories.js        applications.html → src/applications.js│
│  lovegpt.html  → src/lovegpt.js         people.html    → src/people.js         │
│                                         rhythm.html    → src/rhythm.js         │
│                                         outfit.html    → src/outfit.js         │
│                                                                                │
│  Each page: .html at root  +  rollupOptions.input entry in vite.config.js      │
│             +  duplicated <head> (fonts, CSP)  +  <nav id="siteNav">           │
│                                                                                │
│  ── shared modules ───────────────────────────────────────────────────────────│
│  existing:  theme · musicPlayer · auth · textReveal · buttons · graffiti ·     │
│             verses · loveCounter · timeline · gallery · memoriesGallery ·      │
│             upload · memoryAdmin · firebase                                    │
│  NEW:       siteChrome (renders nav+music once) · storage (namespaced,        │
│             versioned, +AES-GCM encrypted, +IndexedDB blobs) ·                 │
│             reveal (one observer) · dates (real calendar math) ·               │
│             reminders + notifiers/*                                            │
│                                                                                │
│  ── styles ───────────────────────────────────────────────────────────────────│
│  base.css (tokens) · sections.css · animations.css · memories.css ·           │
│  timeline-page.css · lovegpt.css      NEW: ui.css (.usm-* primitives)         │
│                                       + one stylesheet per new page            │
└────────────┬─────────────────────────┬──────────────────────┬─────────────────┘
             │                         │                      │
      5 of 6 tools                Letters only          LoveGPT only
             │                         │                      │
             ▼                         ▼                      ▼
   ┌──────────────────┐    ┌────────────────────┐   ┌──────────────────────┐
   │ THE DEVICE        │    │ Firebase Storage    │   │ Cloud Function       │
   │ localStorage      │    │ letters/ (private)  │   │ lovegpt (us-central1)│
   │  usm.* namespaced │    │ rules: uid owner    │   │  ├ RAG → Gemini 2.5  │
   │ IndexedDB (photos)│    │        or tolu      │   │  │   chunks.json     │
   │ AES-GCM (rhythm)  │    │ fetched via getBlob │   │  └ verify-passcode → │
   │ NOTHING LEAVES    │    │ after custom-token  │   │      custom token    │
   └──────────────────┘    │ sign-in             │   │  secrets: GEMINI_KEY,│
                            └────────────────────┘   │   OWNER/READER hash  │
                                                     └──────────────────────┘
```

The shape of the decision: **the private, personal tools stay on her device. Only the letters need
the network, because only the letters need to be readable by two people on two devices.**

---

## 3. Design system audit

Documented in full in **`02-DESIGN-SYSTEM.md`**. The short version:

- **Colour:** 11 tokens, fully inverted for dark mode. `--pink-deep #d72660` is the ink;
  `--pink-hot #ff4da6` is the accent; `--card-bg` is translucent white (plum in dark) and pairs with
  `backdrop-filter`. Dark mode is deep plum, not navy.
- **Type:** Dancing Script for emotional voice (headings, verses, empty states); Inter for anything
  functional (dates, numbers, labels, buttons). Existing code deliberately overrides back to Inter
  for `.timeline-date` and `.counter-num`. Everything is `clamp()`.
- **Shape:** radii 12/20/28 plus 999px pills and 50% circles; exactly four shadows; exactly five
  gradients. **The site is already glassmorphism, so the risk is adding more, not less.**
- **Motion:** `.reveal` → `.visible`, four `data-delay` steps, `ease` for most things,
  `cubic-bezier(0.2,0.8,0.2,1)` for arrivals, `translateY(-2px)` hover lifts. A
  `prefers-reduced-motion` block already disables everything, so nothing may depend on motion.
- **Icons are emoji.** One inline SVG exists in the whole codebase. Do not add an icon library.
- **Voice** is warm, second-person, faith-aware, slightly teasing: *"love in the machine"*,
  *"Every chapter of us"*, *"No memories yet — be the first to add one!"*

The only additions are semantic tokens (spacing scale, gentle status tones, `--error`,
`--border-subtle`) and a `ui.css` of `.usm-*` primitives **extracted** from existing classes, plus
the missing global `:focus-visible` rule. Nothing existing changes value.

---

## 4. Feature architecture — how each piece fits

| Feature | Page | Fits in by | Backend |
| --- | --- | --- | --- |
| **Timeline** | `timeline.html` (existing) | Replacing the two duplicated arrays with one `src/data/timeline.js`; refactoring `src/modules/timeline.js` to render richer entries in `preview`/`full` variants. Keeps existing classnames so the CSS keeps working. | none |
| **Letters** | `letters.html` (new) | Reuses the existing passcode → custom-token auth. Bodies read from private Storage with `getBlob()`. | Firebase Storage |
| **Application Desk** | `applications.html` (new) | Pure local. Centrepiece is a **prompt assembler**, not a Claude API integration. | none |
| **People** | `people.html` (new) | Pure local. Gentle states + copyable templates + first-class snooze. | none |
| **Rhythm** | `rhythm.html` (new) | Pure local, **AES-GCM encrypted at rest**. Never touches Firebase, analytics, or RAG. | none |
| **What to Wear** | `outfit.html` (new) | Local wardrobe (metadata in localStorage, photos in IndexedDB) + Open-Meteo, no key. Deterministic rule-based scoring, not an LLM. | Open-Meteo |
| **Notifications** | cross-cutting | `reminders.js` engine + adapter interface. **In-app only.** | none |
| **Anniversary** | hidden | Built from real timeline data; reuses the proposal page's own sparkle/graffiti/verse mechanics. | none |

The connective tissue is `foryou.html` — a hub with six cards and one sentence of his writing. Not a
dashboard: no sidebar, no breadcrumbs, no global search, no notification bell with an unread badge.

---

## 5. Data architecture — where each thing lives, and why

| Data | Store | Reasoning |
| --- | --- | --- |
| Timeline entries | `src/data/timeline.js` (git) | He authors it, it is versioned, it never changes at runtime. A database would add operations for zero benefit. |
| Letter metadata | `src/data/letters.js` (git) — **titles/dates/occasions only** | Innocuous. An excerpt is not; bodies do not go here. |
| Letter bodies + PDFs | **Firebase Storage `letters/`, private** | The only content that must be readable by two people on two devices, and the only thing that genuinely needs a server-enforced boundary. |
| Applications, materials | `localStorage` via `createStore` | Hers, device-local, zero infrastructure. Export/backup provided. |
| People, message templates | `localStorage` | Same, plus this is third-party personal data that should not be on anyone's server. |
| **Cycle records** | `localStorage`, **AES-GCM encrypted** | Most sensitive data in the project. Key derived per-session from a passphrase, never stored. |
| Wardrobe metadata | `localStorage` | Small text records. |
| Wardrobe photos | **IndexedDB blob store** | localStorage is ~5 MB; photos would blow it instantly. |
| Reminders | `localStorage` | In-app delivery needs nothing more. Rhythm reminders stay in the encrypted store or are omitted. |
| Weather | `localStorage`, ~1 h TTL | Makes the page instant and survives a failed request. |

**The rule applied throughout:** complexity has to earn its place. Firestore is available and was
*not* used for five of six features, because a database would add rules, quotas, latency, an online
requirement, and a privacy surface in exchange for nothing she would notice.

**The honest trade-off, which must be visible in the UI and not buried in docs:** localStorage is
tied to one browser on one device, and clearing browser data destroys it. Every local feature ships
an export/backup action, and says so in plain language. If she ends up wanting the data on two
devices, the upgrade path is per-user Firestore documents scoped by `request.auth.uid` — real work,
but not a rewrite, because `storage.js` is the only thing that touches persistence.

---

## 6. Security & privacy model

### The threat model, stated plainly

The realistic adversaries are: **a curious person holding her unlocked phone**, **anyone who finds
the public GitHub repository**, and **search-engine and archival crawlers**. Not a nation state. The
recommendations below are calibrated to that, which is why "encrypt at rest and never store the
key" is the right answer for cycle data while "build a full auth system" is not.

### Safe enough for this anniversary MVP

- Firebase web config in frontend source — it is an identifier, not a credential. Already correct.
- Passcode → hashed-secret comparison in a Cloud Function → short-lived custom token, with
  `browserSessionPersistence`. **This is real authentication.**
- Deny-by-default Firestore and Storage rules with an explicit `letters/` read rule.
- Cycle data in localStorage encrypted with AES-GCM under a PBKDF2 key derived from a passphrase
  that is never stored. Without the passphrase the stored blob is genuinely unreadable.
- Applications, People, and Wardrobe unencrypted in localStorage — low sensitivity, and the device
  lock is the real boundary.
- In-app-only notifications, so nothing sensitive can render on a lock screen.

### Requires real infrastructure (and is therefore out of scope, deliberately)

- Multi-device sync of anything private.
- Email or push notifications, both of which move data off the device.
- Recovery if she forgets the Rhythm passphrase. There is none, by design. The UI must say so.
- Any protection against someone who already has her unlocked phone.

### Non-negotiables

1. 🔴 **`docs/*.pdf` are public right now.** `raw.githubusercontent.com/.../docs/boo.pdf` returned
   **HTTP 200, 13.4 MB** during the audit. Fix before anything else — `03-SECURITY-REMEDIATION.md`.
2. 🔴 **`functions/knowledge/chunks.json` is a bigger disclosure than the PDFs.** It is committed to
   the same public repo, is plain text, is trivially searchable, and contains sections named
   `health_details`, `intimacy_attraction`, `spiritual_warfare`, and `wedding_planning`. **Making the
   repository private is the single highest-value action in this entire plan** and it fixes this,
   the PDFs, and every future personal commit at once.
3. **A private repository does not protect anything the build inlines.** GitHub Pages serves the
   deployed site publicly regardless of repo visibility (private Pages is Enterprise-only), so the
   real question is never "public or private repo" — it is **"does this content end up in `dist/`?"**
   A private repo protects `chunks.json` and the PDFs, because neither is bundled (the function
   reads `chunks.json` with `readFileSync` at cold start). It protects **nothing** imported by
   `src/**` — including `import body from './letter.md?raw'`, which Vite inlines straight into a
   publicly fetchable `dist/assets/*.js`. **Therefore: making the repo private is not a licence to
   commit letter bodies.** Private document bodies belong in Storage behind a rule either way.
   See `01-REPOSITORY-AUDIT.md` §7 for the table.
4. **Never describe obscurity as authentication.** A hidden URL, an unlisted page, or a client-side
   route guard is a curtain. The only real boundary here is a Firebase rule evaluated server-side
   against an authenticated UID.
4. **No secret in frontend source, ever** — and no passcode or passphrase anywhere in the repo, in
   any form, including comments, fixtures, and git history. Hashes only, in Firebase secrets.
   **The Rhythm passphrase must never become a Firebase secret either** — it never leaves her device.
5. **Cycle data never enters LoveGPT or `chunks.json`.** Enforced by grep in `13-SECURITY-REVIEW.md`.
6. **`getDownloadURL()` returns a tokenised URL that bypasses Storage rules once issued.** Never
   persist one. Fetch bytes with `getBlob()` and hold an in-memory `blob:` URL for the current view.
7. **No new page may import `src/modules/firebase.js` except Letters** — it calls `getAnalytics()`
   unconditionally, so importing it on `rhythm.html` would send Google a pageview for a period
   tracker.

---

## 7. Notification strategy — what can realistically work

| Level | Mechanism | Effort | Verdict |
| --- | --- | --- | --- |
| **1 — In-app** | Local reminder queue evaluated on load/`visibilitychange`, surfaced as calm cards on the hub and the relevant tool page | **EASY** | ✅ **Build this.** Works today, no infrastructure, nothing leaves the device. Limitation to accept honestly: it only fires when she opens the site. |
| **2 — Browser Notification API** | `Notification.requestPermission()`, fires while a tab is open | **EASY–MODERATE** | ⚠️ **Opt-in, only after checking her device.** On iOS/iPadOS Safari this requires the site to be installed to the Home Screen as a PWA. If she is on an iPhone — likely — plain Level 2 buys almost nothing. |
| **3 — Email** | Firebase Scheduled Function (needs Blaze + Cloud Scheduler) + an email provider + server-side reminder storage | **MODERATE** | ❌ **Not for the anniversary.** It forces reminder data off the device, which contradicts the whole privacy model and is categorically unacceptable for Rhythm. If ever built, content-free nudges only. |
| **4 — Scheduled push** | Service worker + Web Push/FCM + VAPID + stored subscriptions + scheduler, plus the same iOS PWA requirement | **COMPLEX** | ❌ **Defer.** Biggest infrastructure jump in the project, and not what makes the gift good. |

The design that matters is the **seam**: `reminders.js` holds the engine, `src/modules/notifiers/*`
hold adapters implementing `isAvailable()` / `requestPermission()` / `deliver(reminder)`. Shipping
`browser` or `push` later must not require touching a single feature page. Defaults: everything off
except in-app, and **nothing asks for notification permission on first load.**

---

## 8. Tool & model strategy

You have Cursor Pro and Claude Pro. The split that actually matters for *this* repo: it is small
(3,100 lines), untyped, and visually driven, so there is no large-codebase navigation problem to
solve. **Cursor Chat wins wherever you need to look at the result**; **Claude Code wins wherever the
work is mechanical, repetitive, and spans many files at once.**

| # | Task | Tool | Model | Why |
| --- | --- | --- | --- | --- |
| 03 | Security remediation | **You, in a terminal** | none | `git filter-repo` and force-push are destructive and irreversible. Read every command yourself. Do not delegate this. |
| 02 | Design tokens + `ui.css` | Cursor Chat | mid-tier | ~150 lines of CSS extracted from classes you can read side by side. A frontier model is wasted; you need to *see* it. |
| 04 | Shared foundations | **Claude Code** | frontier | Multi-file scaffold plus identical edits across four HTML files. Use a frontier model for `storage.js` specifically — the encryption boundary and fail-soft semantics are where subtle bugs cost real data. |
| 05 | Timeline | Cursor Chat | frontier for the refactor, mid-tier for data entry | The render refactor needs care with existing CSS coupling; typing timeline entries needs no model at all — **write those yourself, they are your memories.** |
| 06 | Letters | Cursor Chat | frontier | Small surface but the security reasoning (`getBlob` vs `getDownloadURL`, CSP `frame-src`) is where a weak model will confidently do the wrong thing. |
| 07 | Application Desk | **Claude Code** | frontier | Largest feature: assembler, materials library, tracker, three views. Genuinely multi-file. |
| 08 | People | Claude Code | frontier | Similar scope to 07. The tone requirements need a model that will actually honour them. |
| 09 | Rhythm | Cursor Chat | frontier | Small but the highest-stakes correctness in the project: crypto, prediction honesty, and a hard no-leak requirement. Review every line yourself. |
| 10 | What to Wear | Claude Code | frontier | Wardrobe CRUD + IndexedDB + weather + scoring is a lot of surface. |
| 11 | Notifications | Cursor Chat | frontier | Small amount of code, but it is an abstraction design — thinking, not typing. |
| 12 | Anniversary experience | **Cursor Chat** | frontier for mechanics, **you** for every word | Heavy visual iteration; you must see each change. **Write all the prose yourself.** |
| 13 | Security review | Claude Code | frontier | Broad read-only audit across every file. Exactly what a batch agent is for. |
| 14 | Mobile + a11y | Cursor Chat | mid-tier | You must look at it on a phone. No model substitutes for that. |
| 15 | Testing | Claude Code | mid-tier | Writing Vitest tests against specified pure functions is mechanical. |
| 16 | Final polish | **Cursor Chat + you** | mid-tier | Copy review is the highest-value item here and it is a human job. |

**Where a heavyweight model is wasteful, so don't:** adding a `rollupOptions.input` entry; writing
timeline or letter content; adding a nav link; deleting `webhook.js`; fixing the five stale claims in
`DOCS.md`. Those are typing, not reasoning.

**The one rule that matters more than the table:** every piece of writing she will read — the hub
sentence, the letter titles, the supportive lines, the anniversary message — **must be written by
you.** The prompt files instruct agents to leave marked authoring stubs and to refuse to fabricate.
An AI-written love letter would fail the entire project, and she would be able to tell.

---

## 9. Dependency graph & roadmap

```
  03 SECURITY REMEDIATION  ◄── do this first, alone, by hand
            │
            ▼
  02 DESIGN SYSTEM ──────────┐
            │                │
            ▼                │
  04 SHARED FOUNDATIONS ◄────┘   nav · storage · reveal · dates · For You hub
            │
            ├──────────────┬──────────────┬─────────────┬────────────┐
            ▼              ▼              ▼             ▼            ▼
        05 TIMELINE    06 LETTERS   07 APPLICATIONS  08 PEOPLE   09 RHYTHM
            │           (needs 03)         │             │            │
            │                              └──────┬──────┘            │
            ▼                                     ▼                   │
                                            10 WHAT TO WEAR           │
                                                  │                   │
            └──────────────┬───────────────────────┴───────────────────┘
                           ▼
                   11 NOTIFICATIONS      (consumes the seams 07/08/09/10 exposed)
                           │
                           ▼
                   12 ANNIVERSARY        (consumes 05's timeline data + 06's letters)
                           │
                           ▼
                   13 SECURITY REVIEW
                           │
                           ▼
                   14 MOBILE + A11Y
                           │
                           ▼
                   15 TESTING / QA
                           │
                           ▼
                   16 FINAL POLISH  ──►  deploy  ──►  Sep 13
```

**05 through 09 are genuinely parallel** once 04 lands — they share no files, which is why each
prompt has a restrictive "Files You Must Not Touch" list. **10 comes after 07/08** only because it
is the largest and least essential of the tools; if time is short, cut its scope rather than its
quality. **11 must come after the features** so the reminder seams already exist. **12 must come
after 05 and 06** because it reads their data.

### If you run out of time, cut in this order

Ship **05 Timeline, 06 Letters, and 12 Anniversary** no matter what — those three *are* the gift.
Then **09 Rhythm** (smallest effort, largest daily relief) and **08 People**. Then **07
Applications**. **10 What to Wear** last: it is the most delightful in theory and carries the
biggest hidden cost, because cataloguing a wardrobe is a data-entry chore that fights the product's
own principle. If you build it, **seed her closet yourself as part of the gift** — that turns the
chore into the gesture.

Better to give her three features that feel like they were made by someone paying attention than six
that feel like a product launch.

---

## 10. Start here

### Step 1 — right now

| | |
| --- | --- |
| **Do** | `03-SECURITY-REMEDIATION.md` |
| **Tool** | Your terminal. **Not an agent.** |
| **Model** | None. `git filter-repo --invert-paths` and `git push --force` are irreversible. |
| **Time** | ~30 minutes |
| **Success looks like** | All three PDF raw URLs return **404**; `git log --all --oneline -- 'docs/*.pdf'` is empty; a `letters/` Storage rule exists; the function returns `{ token, role }` for two passcodes; and you have made an explicit, written decision about repository visibility. |
| **Verify** | `for f in boo.pdf journal.pdf "Happy%20180%20days.pdf"; do curl -so /dev/null -w "$f %{http_code}\n" "https://raw.githubusercontent.com/K-Sqr/lovesite/master/docs/$f"; done` |
| **Then** | Step 2. |

While you are in there: **look at `functions/knowledge/chunks.json` and decide whether this repo
should be public at all.** If you have GitHub Pro, making it private takes one click and
retroactively protects more than every other item in this plan combined.

### Step 2 — foundations

1. **`02-DESIGN-SYSTEM.md`** — Cursor Chat, mid-tier model, ~1 hour.
   Success: existing pages pixel-identical, `ui.css` exists, focus rings appear on Tab.
2. **`04-SHARED-FOUNDATIONS.md`** — Claude Code, frontier model, ~half a day.
   Success: five HTML files in `dist/`, all four original pages behave exactly as before, nav
   markup exists in one place, `storage.js` survives a quota failure, encrypted store shows
   ciphertext in DevTools, `grep -rn "IntersectionObserver" src/` returns one file.

**Do not start a feature until `npm run build` is clean and all four original pages still work.**
A regression on the proposal page is much more expensive than a day of delay — that page is the
origin story.

### Step 3 — features, in dependency order

`05` → `06` → (`07`, `08`, `09` in any order or in parallel) → `10` → `11` → `12`.
Each file names the tool, the model, the files it owns, and its own acceptance criteria. Commit
after each. Run `npm run build && npm run preview` before moving on.

### Step 4 — hardening and handover

`13` → `14` → `15` → `16`, then `npm run deploy`, then walk the live site on your phone as if you
were her.

### How to verify at any point

```bash
npm run dev                                   # /lovesite/  — all pages
npm run build                                 # must be clean; check dist/ has every .html
npm run preview                               # base-path problems only show up here
grep -rn "IntersectionObserver" src/          # → src/modules/reveal.js only
grep -rn "firebase" src/*.js                  # → letters.js, memories.js, lovegpt.js only
git diff --stat
```

---

## 11. File index

| File | Kind | Tool |
| --- | --- | --- |
| `00-MASTER-PLAN.md` | this file | — |
| `01-REPOSITORY-AUDIT.md` | reference (fact sheet) | — |
| `02-DESIGN-SYSTEM.md` | reference + small task | Cursor Chat |
| `03-SECURITY-REMEDIATION.md` | 🔴 **task — first** | you + terminal |
| `04-SHARED-FOUNDATIONS.md` | task (blocks everything) | Claude Code |
| `05-TIMELINE.md` | task | Cursor Chat |
| `06-LETTERS.md` | task | Cursor Chat |
| `07-JOB-APPLICATION-STUDIO.md` | task | Claude Code |
| `08-FRIENDS-FAMILY.md` | task | Claude Code |
| `09-PERIOD-TRACKER.md` | task | Cursor Chat |
| `10-OUTFIT-OF-THE-DAY.md` | task | Claude Code |
| `11-NOTIFICATIONS.md` | task | Cursor Chat |
| `12-ANNIVERSARY-EXPERIENCE.md` | task | Cursor Chat + you |
| `13-SECURITY-REVIEW.md` | audit | Claude Code |
| `14-MOBILE-ACCESSIBILITY.md` | review + fix | Cursor Chat |
| `15-TESTING-QA.md` | task | Claude Code |
| `16-FINAL-POLISH.md` | review + fix | Cursor Chat + you |
| `PAGE-CHECKLIST.md` | created by `04` | — |

---

## 12. Open questions for you

These are decisions the repository cannot answer, and several features depend on them.

1. **The timeline gap dates.** Your brief said the timeline stops at *"May 13, 2026 — our 6 month
   anniversary."* The repo says the six-month entry is **Mar 13, 2026**, consistent with the
   `Sep 13, 2025` start date. So the gap to fill is **Mar → Sep 2026**. Confirm before authoring.
2. **Repository visibility.** Public or private? This determines whether `chunks.json` has to move
   out of version control. It does **not** change the Letters architecture — bodies go to Storage
   either way, for the reason in non-negotiable #3 above.
3. **Her device.** iPhone or Android? This decides whether Level 2 notifications are worth
   offering at all.
4. **Her city**, for the weather default.
5. **Does she use one browser on one device?** If she switches between a phone and a laptop,
   localStorage-only will quietly frustrate her and the Firestore upgrade path moves up the list.
6. **Which letters exist**, and are you willing to transcribe them to text? Transcription gives a
   far better reading experience than any PDF viewer, and it sidesteps the CSP problem entirely.

---

## 13. The standard this is measured against

Not "how many features did we ship." Instead:

> **How much unnecessary mental effort did we remove from her life, while making the anniversary
> feel like it came from someone who was paying attention?**

| Feature | Mental load removed |
| --- | --- |
| Timeline | Holding and reliving the story |
| Letters | Finding the things he wrote |
| Application Desk | Reassembling the same application materials every time |
| Rhythm | Remembering and predicting |
| People | Remembering, and finding the energy to start |
| What to Wear | Deciding, every single morning |

The relationship stays the centre. The tools are how the care shows up on a Tuesday.

**The final test, before you give it to her:** open it on your phone and read every word aloud. If
any sentence sounds like a product, rewrite it. If the whole thing sounds like you, it is done.
