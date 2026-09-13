# 15 — Testing & QA

**Recommended tool:** Claude Code. **Model:** a strong reasoning model for the test cases, a cheap
one for the checklist prose.
Justification: writing tests means reading the real implementations of `dates.js`, `storage.js`,
the encrypted store, the prediction logic and the outfit scorer, then deriving edge cases from
them — a multi-file reasoning job with a hard pass/fail signal (`npm test`) at the end. There is no
visual iteration, so the cost of a batch agent is repaid immediately.

---

## Context

`01-REPOSITORY-AUDIT.md` §1 is blunt: **no test runner, no test files, no `test` script, no
ESLint, no Prettier, no CI for the site.** Deployment is `npm run deploy` from a laptop. The only
GitHub Actions workflow is `.github/workflows/npm-publish-github-packages.yml`, boilerplate for
publishing an npm package on release, which runs `npm ci && npm test` — and since no `test` script
exists, it would fail if a release were ever cut. It is unrelated to this site.

Before you reach for a testing pyramid: **be honest about what this is.** It is a ~3,000-line
vanilla-JS gift for one person, maintained by one developer, deployed manually, with two users.
Nobody is onboarding. There is no regression suite to protect a team from itself. Most of the
surface is DOM rendering and CSS, which is verified faster and better by *looking at it* than by
asserting on `innerHTML`.

So this file rejects two failure modes equally:

- **Under-testing.** Features 05–12 introduced real logic with real edge cases: calendar
  arithmetic across a DST boundary, schema migrations, AES-GCM round-trips, median-based cycle
  prediction, and a weighted outfit scorer. These are pure functions whose bugs are silent, are
  not visible on screen, and produce *confidently wrong* output — a prediction that is four days
  off, a duration that says "11 months" on the one-year anniversary. Manual verification of those
  is slower and less reliable than a test, every single time.
- **Over-testing.** A component-rendering suite, jsdom snapshots, Playwright end-to-end coverage,
  a coverage threshold, mocked Firebase, or a test for `initSiteChrome` would cost more to
  maintain than the bugs they would catch. Explicitly decline them, in writing, so the next person
  does not add them out of habit.

The rule this file applies: **write a test when the function is pure, the correct answer is
non-obvious, and being wrong would be invisible.** Everything else gets a manual checklist.

## Objective

1. Add **Vitest** as the only new tooling, wired with zero config friction.
2. Write a small suite — roughly 40–60 assertions across 5 files — covering exactly the logic
   listed in R2.
3. Add a real `test` script, and resolve the broken npm-publish workflow.
4. Write `docs/anniversary/QA-CHECKLIST.md`: a manual checklist organised per feature and per
   device, covering both themes, reduced motion, offline, blocked storage, empty states, and a
   regression smoke test of the four original pages.
5. Make a decision about ESLint and write it down.

## Prerequisites

- `01-REPOSITORY-AUDIT.md` §1 and §2 read.
- `04-SHARED-FOUNDATIONS.md` complete — `src/modules/dates.js` and `src/modules/storage.js` must
  exist; they are the main subjects.
- `09-PERIOD-TRACKER.md` and `10-OUTFIT-OF-THE-DAY.md` complete — their prediction and scoring
  functions must exist and must be **exported as pure functions**. If they are trapped inside a
  render function, extract them (that is the one refactor this file is allowed to request).
- Node 20+.
- `13-SECURITY-REVIEW.md` and `14-MOBILE-ACCESSIBILITY.md` may run in any order relative to this.

## Existing Files To Inspect

```
package.json                      scripts block; devDependencies (vite, gh-pages)
vite.config.js                    MPA inputs; Vitest reads this file
.github/workflows/npm-publish-github-packages.yml   the broken workflow
src/modules/dates.js              calendarDuration, daysBetween, formatRelativeGentle, addMonths
src/modules/storage.js            createStore, migrations, export/import, encrypted variant
src/modules/rhythm*.js            cycle prediction (median + window)
src/modules/outfit*.js            garment scoring against weather
src/modules/loveCounter.js        the days/30.44 approximation 16-FINAL-POLISH will replace
```

## Files You Own (Create)

```
src/modules/dates.test.js
src/modules/storage.test.js
src/modules/cryptoStore.test.js          encrypted-store round-trip (may merge into storage.test.js)
src/modules/rhythm.test.js               prediction median + window
src/modules/outfit.test.js               scoring
docs/anniversary/QA-CHECKLIST.md         the manual checklist
.github/workflows/ci.yml                 only if the decision in R4 is "replace"
```

Colocated `*.test.js` beside the module, not a `tests/` tree. Vitest finds them by default, the
import path is `./dates.js`, and a module and its test stay visible to each other in the file list.

## Files You May Modify

- `package.json` — add `vitest` to `devDependencies` and `test` / `test:watch` scripts. **Nothing
  else.** Do not touch `dependencies`.
- `vite.config.js` — add a `test: {}` block only if a setting is genuinely needed; the defaults
  are fine for pure Node-environment unit tests.
- `.github/workflows/npm-publish-github-packages.yml` — delete it, or replace it per R4.
- The modules under test — **only** to export an existing pure function that is currently private.
  No behaviour changes, no signature changes.

## Files You Must Not Touch

- `firestore.rules`, `storage.rules`, `functions/**`, any CSP meta tag — `13-SECURITY-REVIEW.md`.
- Any CSS, any HTML, `src/modules/focusTrap.js` — `14-MOBILE-ACCESSIBILITY.md`.
- `DOCS.md`, `README.md`, `FEATURES.md`, `src/modules/loveCounter.js`, `src/modules/webhook.js`,
  `public/photos/**` — `16-FINAL-POLISH.md`. **The npm-publish workflow is this file's to resolve,
  not `16`'s** — `16` only verifies the outcome.
- Any feature's UI logic.

## Requirements

### R1 — Vitest, minimally configured

```bash
npm install --save-dev vitest
```

Add to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Vitest reads `vite.config.js` automatically, so resolution, ESM handling and `base` all match the
real build with no duplicate config. That single fact is why it is the right runner here: Jest
would need a transform, a module-mapper, and an ESM workaround, all to test five files.

Keep the default Node environment. **Do not install `jsdom` or `happy-dom`** — no test in this
suite touches the DOM. If you find yourself wanting jsdom, you are writing a test this file says
not to write.

For `storage.test.js` and `cryptoStore.test.js` you need `localStorage` and `crypto.subtle`. Node
20 provides `globalThis.crypto.subtle` natively. For `localStorage`, write a ~15-line in-memory
stub in the test file and assign it to `globalThis.localStorage` in `beforeEach` — smaller and
clearer than a DOM environment, and it lets you make `setItem` throw on demand, which is the
interesting case.

### R2 — The tests worth writing

**`dates.test.js`** — the highest-value file in the suite, because `04-SHARED-FOUNDATIONS.md` R5
wrote it specifically to kill the `days / 30.44` approximation, and a date bug is invisible until
it is embarrassing.

- `calendarDuration('2025-09-13', '2026-09-13')` → `{ years: 1, months: 0, days: 0 }`. This is the
  anniversary itself. If this returns 11 months and 30 days on the day she opens the site, the
  gift is broken in the most visible possible way.
- `calendarDuration('2025-09-13', '2026-03-13')` → `{ years: 0, months: 6, days: 0 }` — the
  six-month milestone the timeline already claims.
- Month-end clamping: `addMonths('2026-01-31', 1)` must land on Feb 28 (and Feb 29 in 2028), and
  `calendarDuration('2026-01-31', '2026-03-01')` must not produce a negative `days`.
- Leap day: `daysBetween('2028-02-28', '2028-03-01')` → 2.
- **DST boundary.** In America/Winnipeg (where she is — `fullMilestones` ends at "Touchdown
  Winnipeg"), clocks move on the second Sunday of March and the first Sunday of November.
  `daysBetween('2026-03-07', '2026-03-09')` must be 2, not 1.958…, and
  `daysBetween('2026-10-31', '2026-11-02')` must be 2. If the implementation divides
  milliseconds by 86,400,000 this fails, which is exactly the bug the test exists to catch.
  Set `process.env.TZ = 'America/Winnipeg'` at the top of the file so the test is deterministic,
  and add a second run pinned to `UTC` to prove timezone-independence.
- `formatRelativeGentle` returns `'today'` / `'yesterday'` at the boundaries, and — asserted as a
  hard rule over a range of 0–400 days — **never** produces a string containing "overdue", "late",
  "should", "ago" with a negative number, or a bare day count above the thresholds. This is the
  tone of the People feature encoded as a test, and it is the most likely thing a future "helpful"
  refactor breaks.
- `formatDateRange('2026-09-18', '2026-09-22')` → `'September 18–22'` (en dash, not hyphen).

**`storage.test.js`**

- Round trip: `write(value)` then `read()` returns a deep-equal value.
- The on-disk shape is the envelope `{ v, updatedAt, data }` under the key
  `usm.<name>.v<version>` — assert the literal key string. Namespacing is a security property
  here (the origin is shared with every other `k-sqr.github.io` Pages site), so assert it.
- Migration: seed a `v1` envelope, open a `v2` store with a `migrate` function, assert the value
  is upgraded, that `migrate` was called once with the old data and old version, and that the
  upgraded envelope was written back.
- `export()` returns parseable pretty-printed JSON; `import(export())` reproduces state exactly.
- `import()` **rejects** a mismatched `name`, a future `v`, and malformed JSON — and leaves the
  existing data untouched in all three cases.
- **Quota failure is the important one.** Make the stub's `setItem` throw a `QuotaExceededError`.
  Assert: `write()` does not throw to the caller, the value is still readable via `read()` from the
  in-memory fallback for the rest of the session, and a failure state is surfaced exactly once.
  `04-SHARED-FOUNDATIONS.md` R3 says *never let a storage error throw away what she just typed* —
  this test is that sentence.
- Corrupt data: a key containing `"not json"` or `{}` must yield the default value, not a crash.
- `subscribe(fn)` fires on a local write and on a synthesised `storage` event.

**`cryptoStore.test.js`**

- Encrypt → reload (fresh store instance, same backing stub) → decrypt with the correct passphrase
  returns the original object.
- Wrong passphrase fails **cleanly** — a rejected promise or a typed failure result, never a crash
  and never partial plaintext.
- The stored value contains no plaintext: assert that the raw string does not contain any value
  from the payload, and that it parses to an envelope with `alg: 'AES-GCM'`,
  `kdf: 'PBKDF2-SHA256'`, `iterations >= 250000`, and base64 `salt`, `iv`, `ciphertext`.
- Two successive writes of the **same** payload produce **different** ciphertext — proves the IV
  is fresh per write. A reused IV under AES-GCM is a real cryptographic break, and it is a one-line
  mistake to make.
- The passphrase appears nowhere in the stored envelope, and no verification hash of it is stored
  (`03-SECURITY-REMEDIATION.md` and `04` R3b both forbid one — authentication failure *is* the
  check).
- Use an obviously fake literal such as `'test-passphrase-not-real'`. **Never a real passphrase in
  a fixture** — `13-SECURITY-REVIEW.md` R5 greps for exactly this.
- Keep iterations at the production value and mark this file slow if needed; do not weaken the KDF
  for test speed, or the test stops testing the thing that matters.

**`rhythm.test.js`**

- Median cycle length from a known list of start dates, with an **even** count (the average of the
  two middles) and an **odd** count.
- Median, not mean — feed one 45-day outlier cycle among five 28-day cycles and assert the
  prediction barely moves. That is the whole reason the design says median.
- Insufficient data: with 0 and with 1 recorded start, the function returns "not enough yet"
  rather than a confident number. A fabricated prediction is a fake statistic, which the brief
  forbids.
- The prediction is a **window**, not a day: assert it returns a range, that the range width grows
  with observed variance, and that the range contains the point estimate.
- Irregular history (cycles of 24, 38, 31, 26) still returns a window and never a negative length,
  a zero-width window, or a date in the past.

**`outfit.test.js`**

- A garment appropriate to the temperature outscores one that is not, for a hot day and a cold day.
- Winnipeg reality: at −25 °C the scorer must not return a garment tagged for summer, at any
  weighting. Assert the category is excluded, not merely ranked low.
- Rain flips the ranking toward waterproof outerwear.
- Deterministic given the same input and the same wardrobe — no `Math.random()` leaking into the
  score. If variety is wanted, it must be injectable and seeded, so assert the injection point.
- An empty wardrobe returns an empty result with no crash; a single-item wardrobe returns that item
  rather than nothing.

**That is the whole suite.** Roughly five files. If you find yourself writing a sixth, re-read the
"Do Not" section first.

### R3 — What explicitly does not get tested

Write this list into `QA-CHECKLIST.md` as a short "why there are no tests for X" note, so the
decision is visible rather than looking like an omission:

- **DOM rendering.** `renderMemoryCard`, `initTimeline`, `initSiteChrome`, the chat bubbles. The
  assertion would restate the implementation, it would break on every legitimate markup change,
  and it would catch nothing you would not see instantly in the browser.
- **Firebase.** Mocking Firestore and Storage tests the mock. The real coverage is
  `13-SECURITY-REVIEW.md`'s rules verification against the emulator.
- **The Cloud Function.** One endpoint, two branches, deployed rarely, verified by using it.
- **Animations, theme switching, music continuity.** Manual, in the checklist.
- **End-to-end.** No Playwright, no Cypress. Eleven static pages and two users do not justify a
  browser-automation harness or its maintenance.

### R4 — The `test` script and the broken workflow

`.github/workflows/npm-publish-github-packages.yml` runs `npm ci && npm test` on GitHub *release*
and then publishes to GitHub Packages. This project is `"private": true` and is not an npm package.
Once `npm test` exists, the workflow will get *further* before failing, which is worse than
failing immediately.

**Recommendation: delete it and add a small CI workflow instead.** Deleting alone is defensible,
but a `push`-triggered build is genuinely useful here for one reason — `npm run deploy` builds on
a laptop, and a build that only ever succeeds locally is a build nobody can trust. Catching a
broken `vite.config.js` input entry (the single most common mistake in this repo, per
`01-REPOSITORY-AUDIT.md` §10) before deploy is worth twenty lines of YAML.

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [master]
  pull_request:
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - name: Every page must be in the build output
        run: |
          for p in index memories timeline lovegpt foryou letters \
                   applications people rhythm outfit; do
            test -f "dist/$p.html" || { echo "MISSING dist/$p.html"; exit 1; }
          done
```

That last step is the highest-value twenty seconds in this file: it is a direct guard against
forgetting the `rollupOptions.input` entry, which works in `npm run dev` and 404s in production.

Whichever way you go, **record the decision** in `QA-CHECKLIST.md`. Do not leave the old workflow
in place unchanged.

### R5 — The manual QA checklist

`docs/anniversary/QA-CHECKLIST.md` is the real deliverable for everything the unit tests do not
cover. Make it a checkbox list someone can actually walk in about 45 minutes.

**Per feature** (Timeline, Letters, Applications, People, Rhythm, What to Wear, Notifications,
Anniversary Experience) cover at minimum:

- First run with empty storage: the empty state renders, reads as warm rather than broken, and
  offers the obvious next action.
- The primary happy path, end to end.
- Reload persistence: the data is still there after a hard refresh.
- Both themes: light and plum dark, checking that no hardcoded colour leaked in (`02` §1 notes
  `.passcode-modal p` already has this bug — do not let a new one ship).
- `prefers-reduced-motion: reduce`.
- Failure: what happens with the network off, with a failed `fetch` (Open-Meteo down for What to
  Wear, the Cloud Function down for LoveGPT and Letters sign-in), and with a Firebase permission
  denial.
- Storage blocked: Safari private mode, or DevTools → Application → *Block storage*. The page must
  load, warn calmly once, and not lose typed input.
- Delete / undo paths, if the feature has one.

**Per device:** iPhone Safari, Android Chrome, desktop Chrome, desktop Safari or Firefox. Note
that iOS Safari is the one that matters most — it is the device this gift will actually be opened
on — and it is where private-mode storage, `env(safe-area-inset-*)`, and audio autoplay differ.

**Pre-deploy regression smoke test of the four ORIGINAL pages.** This is not optional and it is
the part most likely to be skipped. Features 04–12 touched the nav, the CSP, the reveal observer
and the CSS import graph on all four:

- `index.html` — the sparkle text reveal runs and the Skip button works; "Yes" triggers graffiti
  and the verse overlay; the "No" button dodges and disappears after 15 clicks; the locked
  sections unlock; the timeline preview renders 5 entries; the gallery preview renders 6 photos;
  the verse carousel advances both ways; the love counter ticks every second.
- `timeline.html` — the stats bar renders, the full timeline renders every entry, the rail sits
  correctly at 375px (left rail) and 1440px (centre rail).
- `memories.html` — the grid renders including the six local photos; the lightbox opens and
  closes; the upload panel opens; the passcode modal accepts the owner passcode; an upload
  compresses, shows progress, and appears in the grid; delete works and is owner-only.
- `lovegpt.html` — starter pills send; a typed message gets a reply; the typing dots appear; the
  reply renders markdown with HTML escaped; history survives within the session.
- Cross-page: theme persists, music keeps playing across navigation and the hint does not re-pop,
  the nav marks the right page, every link resolves under `/lovesite/`.

### R6 — ESLint: the honest answer

**Recommendation: do not add ESLint.** Say so plainly rather than adding it because every project
has one.

The argument for adding it is real but small: it would catch an unused import, a `console.log`
left behind, and a typo'd global. The argument against is larger here. There is no team and no
style disagreement to arbitrate. Vite already fails the build on genuine syntax errors. The editor
already flags undefined variables. A flat config plus a plugin set is 3–4 more devDependencies and
a config file to maintain for a codebase this size, and the first run on 3,000 lines of existing
vanilla JS will produce a wall of warnings that get suppressed rather than fixed — which is worse
than no linter, because it teaches everyone to ignore the output.

If you want the 5% that matters without the cost, the cheap substitutes are already in the
verification block: `grep -rn "console.log" src/` before deploy, and the build itself.

Write the reasoning into `QA-CHECKLIST.md` so the decision does not get relitigated in six months.
If it is ever revisited, the trigger should be a second contributor, not a tidy impulse.

## UX Requirements

- The checklist is written for a tired person at 11pm the night before an anniversary. Short lines,
  imperative, one check per line, no prose paragraphs between items.
- Every item states the **expected** result, not just the action: "Tap Add Memory → the panel
  slides open and focus lands in the caption field", not "test the upload panel".
- Group by feature, then by device, so it can be run in passes rather than read end to end.
- Include a five-minute "if you only have time for one thing" subset at the top: build, the four
  original pages, one letter, and the anniversary date rendering correctly.

## Technical Requirements

- **`vitest` is the only permitted new dependency, and it is a `devDependency`.** No jsdom, no
  happy-dom, no Playwright, no `@testing-library/*`, no `c8`, no ESLint.
- Tests run in Node with no browser, no network, and no Firebase. Any test that needs one of those
  is a test this file says not to write.
- `npm test` must exit non-zero on failure and complete in under ~10 seconds (the PBKDF2 test is
  the slowest; that is acceptable).
- No coverage threshold, no coverage reporting. Coverage percentage is a metric that would push
  this suite in exactly the wrong direction.
- Tests must be deterministic: pin `process.env.TZ`, inject `now` rather than calling
  `new Date()` inside assertions, and never depend on the real current date — this suite must still
  pass in 2027.
- Do not change any module's public behaviour to make it testable. Exporting an existing private
  pure function is the only permitted change.

## Privacy & Security

- **No real passcode and no real passphrase in any fixture, ever** — source, comment, or snapshot.
  Use `'test-passphrase-not-real'`. `13-SECURITY-REVIEW.md` R5 greps the repo and the git history
  for exactly this, and a test fixture is the classic way it gets in.
- No real cycle dates, no real names of her friends or family, no real application details in
  fixtures. Use obviously synthetic data (`'Person A'`, `'2026-01-01'`). Test data is committed to
  a public repo; treat it as published.
- Tests must never write to a real Firebase project or hit a real network host. The suite has no
  network access by construction; keep it that way.
- The CI workflow must not require any secret. If it needs one, you have built the wrong workflow.
- Do not print storage contents on test failure in a way that would dump decrypted personal data
  into a public CI log.

## Do Not

- Do not add a testing pyramid, a coverage badge, a coverage gate, or a mutation-testing run.
- Do not add Playwright, Cypress, WebdriverIO, or any browser automation.
- Do not add jsdom or write a single DOM-rendering test.
- Do not mock Firebase.
- Do not add ESLint or Prettier (see R6). Do not add Husky or lint-staged.
- Do not add TypeScript, JSDoc type checking, or `checkJs`.
- Do not refactor production code to be "more testable". The functions in R2 are already pure.
- Do not write tests for `loveCounter.js` — `16-FINAL-POLISH.md` is changing its month logic, and
  a test written now against the current approximation would be a test asserting a known bug.
- Do not let the test suite become a second specification. Where a test and this document
  disagree, this document is wrong and should be updated — but say so out loud.

## Implementation Strategy

1. Install Vitest, add the scripts, and commit a single trivial passing test to prove the runner
   works with this repo's ESM + `vite.config.js` setup before writing anything real.
2. `dates.test.js` first. It is the highest value, it has no setup, and `calendarDuration` across
   the anniversary is the single assertion most likely to catch an embarrassing bug.
3. `storage.test.js` with the localStorage stub. Write the quota-failure case *first* — it is the
   one that will actually fail.
4. `cryptoStore.test.js`. Expect this to be the slowest file; leave the iteration count alone.
5. `rhythm.test.js` and `outfit.test.js` last — they depend on features 09 and 10 being final, and
   may require exporting a private function.
6. Resolve the workflow (R4), then run the new CI once on a throwaway push to prove it is green.
7. Write `QA-CHECKLIST.md` last, while walking the actual site. A checklist written from
   imagination misses the real failure modes.

Commit after each test file. A failing test that reveals a real bug goes in its own commit with
the fix, so the pairing is visible in history.

## Acceptance Criteria

1. `npm test` exists, runs Vitest, exits 0 on a clean tree, and finishes in under ~10 seconds.
2. `package.json` gained exactly one devDependency (`vitest`) and zero runtime dependencies.
3. `dates.test.js` asserts `calendarDuration('2025-09-13','2026-09-13')` → `{years:1,months:0,days:0}`
   and passes under both `TZ=America/Winnipeg` and `TZ=UTC`.
4. The DST assertions pass: `daysBetween('2026-03-07','2026-03-09') === 2` and
   `daysBetween('2026-10-31','2026-11-02') === 2`. Verify the test genuinely catches the bug by
   temporarily reverting `daysBetween` to millisecond division and watching it fail.
5. `formatRelativeGentle` is asserted over a 0–400 day range to never contain "overdue", "late",
   or "should".
6. `storage.test.js` covers round-trip, the literal `usm.<name>.v<n>` key, a v1→v2 migration,
   export/import fidelity, three rejected-import cases, corrupt-data fallback, `subscribe`, and a
   `QuotaExceededError` that loses no data and does not throw to the caller.
7. `cryptoStore.test.js` proves a correct-passphrase round-trip, a clean wrong-passphrase failure,
   ciphertext with no plaintext leakage, `iterations >= 250000`, and **different ciphertext for two
   identical writes**.
8. `rhythm.test.js` proves median-not-mean behaviour with an outlier, returns "not enough data" for
   fewer than two cycles, and returns a widening window under higher variance.
9. `outfit.test.js` proves temperature-appropriateness (including the −25 °C exclusion), rain
   handling, determinism, and empty/single-item wardrobes.
10. No test imports Firebase, opens a network connection, or needs a DOM.
11. No fixture contains a real passcode, passphrase, name, or cycle date.
12. `.github/workflows/npm-publish-github-packages.yml` is deleted; either nothing replaced it (with
    the reasoning written down) or `ci.yml` exists, runs `npm test` and `npm run build`, and asserts
    all **eleven** `dist/*.html` files. It has been observed green at least once.

    > The eleven: `index`, `timeline`, `memories`, `lovegpt` (existing) + `foryou`, `letters`,
    > `applications`, `people`, `rhythm`, `outfit`, and **`anniversary`** (hidden, from
    > `12-ANNIVERSARY-EXPERIENCE.md` — easy to forget precisely because it is absent from the nav,
    > which is exactly why the assertion is worth having). Assert the count as well as the names, so
    > a page added later without a `rollupOptions.input` entry fails CI instead of 404ing in
    > production.
13. `docs/anniversary/QA-CHECKLIST.md` exists with a per-feature section, a per-device section, the
    four-original-page regression smoke test, and the five-minute subset at the top.
14. The ESLint decision is written down with its reasoning.
15. `npm run build` still succeeds and no production behaviour changed.

## Verification

```bash
npm install --save-dev vitest
npm test                      # → all green, < ~10s
npm run test:watch            # sanity: watch mode picks up a saved change

# Determinism and timezone independence
TZ=UTC npm test
TZ=America/Winnipeg npm test
TZ=Pacific/Kiritimati npm test         # UTC+14, catches date-only off-by-one bugs

# Prove the DST test has teeth: break daysBetween, expect red, then restore
git stash list && npm test             # (after temporarily reverting to ms-division)

# Dependency discipline
git diff package.json                  # exactly one new devDependency
grep -c '"' package.json && node -e "const p=require('./package.json'); \
  console.log(Object.keys(p.dependencies), Object.keys(p.devDependencies))"

# No fixture leaks
grep -rniE "passphrase|passcode" src/**/*.test.js

# The build guard the CI encodes
npm run build
for p in index memories timeline lovegpt foryou letters applications people rhythm outfit; do
  test -f "dist/$p.html" && echo "ok   $p" || echo "MISS $p"
done

# Pre-deploy hygiene (the cheap substitute for a linter)
grep -rn "console.log" src/
npm run preview               # walk the QA checklist against /lovesite/
```

**Manual tests:** run `docs/anniversary/QA-CHECKLIST.md` end to end at least once before deploy —
all features, both themes, reduced motion, offline, blocked storage, and the four-original-page
regression pass. On iOS Safari specifically, run the checklist in a private tab to exercise the
storage-blocked path, and confirm the calm banner appears exactly once and nothing typed is lost.

## Definition of Done

- [ ] `vitest` added as the only new devDependency; `test` and `test:watch` scripts in `package.json`
- [ ] `src/modules/dates.test.js` — anniversary duration, six-month milestone, month-end clamping,
      leap day, both DST boundaries, `formatRelativeGentle` tone rule, `formatDateRange`
- [ ] `src/modules/storage.test.js` — round-trip, key namespace, migration, export/import, three
      rejection cases, corrupt data, `subscribe`, quota failure with no data loss
- [ ] `src/modules/cryptoStore.test.js` — round-trip, clean wrong-passphrase failure, no plaintext,
      `iterations >= 250000`, fresh IV per write, no stored verification hash
- [ ] `src/modules/rhythm.test.js` — median with outlier, insufficient data, widening window
- [ ] `src/modules/outfit.test.js` — temperature, rain, determinism, empty wardrobe
- [ ] `npm test` green under three timezones and in under ~10 seconds
- [ ] No DOM, network, or Firebase in any test; no real secrets or real personal data in fixtures
- [ ] The DST test verified to fail against a deliberately broken `daysBetween`
- [ ] `npm-publish-github-packages.yml` deleted; the replace-or-delete decision recorded
- [ ] `ci.yml` (if chosen) observed green, including the eleven-page `dist` assertion
- [ ] `docs/anniversary/QA-CHECKLIST.md` written: five-minute subset, per feature, per device,
      both themes, reduced motion, offline, blocked storage, empty states, and the four-original-
      page regression smoke test
- [ ] The "why there are no tests for X" note written
- [ ] The ESLint decision written down with reasoning
- [ ] `npm run build` clean; zero runtime dependencies added; no production behaviour changed
