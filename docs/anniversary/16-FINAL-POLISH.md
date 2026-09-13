# 16 — Final Polish & Launch

**Recommended tool:** Cursor Chat. **Model:** a strong model for the copy review, anything for the
cleanup.
Justification: this pass is mostly judgement — reading a sentence and deciding whether it sounds
like him, looking at the love counter and deciding whether the new number feels right, walking the
site on a phone as if you were her. None of that is delegable to a batch agent, and an agent that
rewrites copy unsupervised will flatten the one thing that makes this gift work. Keep the browser
and the real device beside you.

---

## Context

Everything is built. `03-SECURITY-REMEDIATION.md` cleared the disclosure, `04-SHARED-FOUNDATIONS.md`
laid the scaffold, features 05–12 shipped, `13-SECURITY-REVIEW.md` audited the data,
`14-MOBILE-ACCESSIBILITY.md` fixed the keyboard and the phone, `15-TESTING-QA.md` added a small
test suite and the manual checklist.

What is left is the difference between a working site and a gift.

Be clear about what that difference is. She is not going to notice that the focus ring meets
contrast, or that `calendarDuration` handles DST. She is going to notice whether the sentence at
the top of the For You page sounds like him. She is going to notice whether the timeline reads
like their story or like a list of dates. **The writing is the product.** Everything else is
plumbing that makes the writing possible.

That is why the copy review is first in this file and not last. If you run out of time, do the
copy review and the deployment verification and skip the rest.

Concrete debts this pass inherits:

- `src/modules/loveCounter.js:17` computes `months = Math.floor(days / 30.44)` and updates via
  `el.innerHTML = ...` on a 1-second `setInterval`. `04-SHARED-FOUNDATIONS.md` R5 deliberately
  deferred fixing this to here, "where you can look at it visually".
- `src/modules/webhook.js` is 13 lines with `RESPONSE_WEBHOOK_URL = ''` — a no-op, and per
  `01-REPOSITORY-AUDIT.md` §7 a latent exfiltration path if it were ever populated.
- `firebase-debug.log` (~300 KB) sits in the working tree. Gitignored, so not leaking, but it
  should not be there.
- `public/photos/` holds six unoptimised camera and WhatsApp originals totalling ~2.7 MB, the
  largest 1.16 MB, with no `srcset` and no compression step. For scale: the `boo.pdf` that `03`
  removed was 13.4 MB, so this codebase has form on unmanaged binary weight.
- `DOCS.md` has five specific false claims, listed in R7.

## Objective

1. Read every user-facing string aloud, in his voice, and fix the ones that are not his.
2. Review every empty, loading, and error state across all eleven pages.
3. Check spacing, radii, shadows and motion against `02-DESIGN-SYSTEM.md`.
4. Fix the love counter's month arithmetic and check it visually.
5. Reduce image weight and remove the 1-second `innerHTML` rewrite.
6. Delete the dead code.
7. Correct `DOCS.md`, `README.md`, and `FEATURES.md`.
8. Build, preview, deploy, and verify the live site.
9. Run a genuine dry-run as her, on a phone, and a final quality test against the brief's own
   questions.

## Prerequisites

- Features `05-TIMELINE.md` … `12-ANNIVERSARY-EXPERIENCE.md` complete.
- `13-SECURITY-REVIEW.md` complete — it produced `SECURITY-INVENTORY.md`, which contains the
  corrected security wording this file merges into `DOCS.md`.
- `14-MOBILE-ACCESSIBILITY.md` complete — it produced `A11Y-REPORT.md`.
- `15-TESTING-QA.md` complete — `npm test` exists and `QA-CHECKLIST.md` is written. **The
  npm-publish workflow is resolved by `15`; this file only verifies the outcome.**
- The real phone she will open it on, or one like it.
- Time. This pass is not a 30-minute job; the copy review alone is an evening.

## Existing Files To Inspect

```
DOCS.md                          five stale claims, see R7
README.md                        webhook section, localhost URL, feature list
FEATURES.md                      the original bug list and feature requests
src/modules/loveCounter.js       days/30.44 and the 1s innerHTML rewrite
src/modules/webhook.js           dead, 13 lines
src/modules/dates.js             calendarDuration — the replacement arithmetic
src/data/*.js                    timeline prose, verses, noTexts
public/photos/                   6 unoptimised originals, ~2.7 MB
firebase-debug.log               ~300 KB in the working tree
package.json                     scripts, version
vite.config.js                   ten input entries — verify every page is present
docs/anniversary/SECURITY-INVENTORY.md, A11Y-REPORT.md, QA-CHECKLIST.md
all eleven .html files              every visible string
```

## Files You Own (Create)

```
docs/anniversary/LAUNCH-CHECKLIST.md    the deploy + post-deploy + dry-run record
```

## Files You May Modify

- Any user-facing copy string, in any `.html` file or any JS that renders text.
- `src/data/timeline.js` (or `milestones.js` if `05` kept the name), `src/data/verses.js`,
  `src/data/noTexts.js` — wording only.
- `src/modules/loveCounter.js` — the month arithmetic and the render loop.
- `public/photos/**` — recompress and rename.
- `DOCS.md`, `README.md`, `FEATURES.md`.
- `package.json` — the `version` field and the `description`, nothing else.
- Any CSS file — only to correct a spacing/radius/shadow inconsistency against `02`.
- Delete: `src/modules/webhook.js` and its imports, `firebase-debug.log`.

## Files You Must Not Touch

- `firestore.rules`, `storage.rules`, `functions/**`, any CSP meta tag — `13-SECURITY-REVIEW.md`
  owns those, and changing a rule the night before launch is how a feature silently stops working.
- `.github/workflows/**`, any `*.test.js` — `15-TESTING-QA.md`.
- `src/modules/focusTrap.js`, any `aria-*` attribute, any `<label>`, any heading level —
  `14-MOBILE-ACCESSIBILITY.md`. If you rewrite a string that is also an `aria-label`, update both
  and say so.
- **Any feature's behaviour, layout, or data model.** This is a polish pass. If a feature is
  wrong, the honest move at this point is to note it in `LAUNCH-CHECKLIST.md` as a post-launch
  item, not to rebuild it the week before the anniversary.
- Do not add a feature. Not one.

## Requirements

### R1 — The copy review (do this first)

Walk every page and read every string **out loud**. Out loud is not a figure of speech — it is the
test. Corporate phrasing and AI phrasing survive silent reading and die immediately when spoken.

Collect the strings first (the grep in **Verification** gets most of them), then judge each one
against these:

- **Does it sound like him talking to her?** `02-DESIGN-SYSTEM.md` §7 pins the voice: warm,
  second-person, faith-aware, a bit teasing. The existing site already has the register —
  *"love in the machine"*, *"Every chapter of us, from the very beginning"*, *"Made with ♥ and a
  little bit of code"*, *"In love for"*, *"No memories yet — be the first to add one!"*. Anything
  that would not sit beside those is wrong.
- **Buttons are conversational, never imperative-corporate.** `+ Add Memory`, `Skip »`,
  `View full timeline →` are right. `Submit`, `Manage`, `Configure`, `Get Started`, `Learn More`
  are wrong.
- **No guilt.** Nothing may imply she is behind, overdue, neglecting anyone, or owes anybody a
  reply. This is most likely to have crept into People (`08-FRIENDS-FAMILY.md`) and the reminders
  in `11-NOTIFICATIONS.md`. `formatRelativeGentle` in `dates.js` exists precisely to prevent it —
  check that nothing bypassed it with its own string.
- **No corporate productivity language.** No "optimise", "streamline", "workflow", "track your
  progress", "stay on top of", "boost", "leverage", "insights", "at a glance".
- **No fake statistics and no KPI framing.** A number is only shown if it is real and derived from
  actual data. No percentages invented to fill a card.
- **No AI-startup voice.** No "Powered by AI", no "✨ Smart", no em-dash-heavy breathless
  enthusiasm, no sentence that begins "Effortlessly".
- **Script vs Inter discipline** (`02` §2): Dancing Script carries emotional voice — section
  titles, an empty-state sentence, a supportive line. Inter carries anything functional. A date or
  a status in script is a mistake.

Pay special attention to the highest-leverage strings, in this order: the For You hub's one-line
introduction; every empty state (she will see those before she sees anything else); the Rhythm
passphrase-setup copy (it has to be honest about unrecoverability without sounding like a EULA);
the Letters list framing; and the anniversary sequence from `12`, where a single false note is
very expensive.

Where copy is wrong, **rewrite it in his voice** — do not neutralise it. "Nothing here yet" is not
better than a bad sentence; it is just emptier.

### R2 — Empty, loading, and error states

Five of six new features start empty. The empty state is the first thing she sees, so it is not a
fallback — it is the feature's front door.

For each of the eleven pages, force and review:

- **Empty:** clear `usm.*` keys and reload. Does it look intentional? Is there one warm sentence
  in `--font-display`? Is there one obvious next action? A bare "No data" is a failure.
- **Loading:** throttle to Slow 3G. Does `.usm-skeleton` appear, or does the layout jump? Does
  anything flash unstyled? Letters and Memories are the network-dependent ones.
- **Error:** block the network entirely; block just the Cloud Function; block Open-Meteo; sign out
  mid-session so a Firebase read is denied. Every failure must produce a calm, human sentence and
  a way forward — never a raw error object, a Firebase error code, or a silent blank region.
- **Storage blocked:** Safari private mode. One calm banner, once. Nothing typed is lost.

### R3 — Visual consistency against `02-DESIGN-SYSTEM.md`

Six features were built by different passes. Drift is expected; find it.

- **Radii:** only `--radius-sm` 12px, `--radius-md` 20px, `--radius-lg` 28px, `999px` pills, `50%`
  circles. Grep for hardcoded `border-radius` values that are none of those.
- **Shadows:** only the four in `02` §3. A fifth blur radius is drift.
- **Gradients:** only the five in `02` §3. `02` §8 was explicit — no new gradients.
- **Colours:** no hardcoded hex outside the three documented semantic escapes. Any new colour must
  be a token, and must have a dark-mode value.
- **Spacing:** the `--space-*` scale from `02` §8.1 should be in use; one-off `1.37rem` values are
  drift.
- **Glass:** `backdrop-filter` only on things that genuinely overlay content. `02` §3 warns the
  risk is *adding* glass, not removing it. If a new card got `blur()`, take it off.
- **Motion:** durations from the `02` §5 vocabulary (0.15–0.2s micro, 0.3s state, 0.4s overlay,
  0.6–0.7s entrance), easing `ease` or `cubic-bezier(0.2,0.8,0.2,1)`.
- **Hearts:** `02` §8 banned hearts on the utility features. Check none crept in. The affection
  lives in the words.
- Then the plainest test: open all eleven pages side by side in both themes and see whether they look
  like one site or like six.

### R4 — The love counter

`loveCounter.js` shows `Math.floor(days / 30.44)` months. On the one-year anniversary that reads
**"11 months · 31 days"** instead of **"1 year"** — the exact day this gift is given, the most
beloved element on the site will be wrong.

Verified arithmetic, so you know this is real and not a guess. At Sep 13, 2026 with
`START_DATE = new Date(2025, 8, 13)`: `days = 365`; `months = Math.floor(365 / 30.44) = 11`;
`remainingDays = 365 - Math.floor(11 * 30.44) = 365 - 334 = 31`. So the counter renders
`11 months · 31 days`, and it will *never* display a year, because the component has no years unit
at all — `computeElapsed()` returns `{ months, days, hours, minutes, seconds, totalDays }`. Adding
`years` to that return value and to the rendered markup is part of this task, not just swapping the
month formula.

- Replace the arithmetic with `calendarDuration()` from `src/modules/dates.js`. `15-TESTING-QA.md`
  already asserts `calendarDuration('2025-09-13','2026-09-13') → { years: 1, months: 0, days: 0 }`.
- Decide the display format deliberately, because the shape changes: it now has a `years`
  component. Suggested: `1 year · 0 months · 3 days · 04:17:22`, collapsing the years unit before
  the first anniversary so nothing reads "0 years". Write out what it renders on the day before,
  the day of, and the day after Sep 13, 2026, and look at all three.
- **Look at it.** Set the system clock forward (or inject a fake `now`) and screenshot the counter
  on Sep 12, Sep 13, and Sep 14, 2026, in both themes, at 375px and 1440px. This is a beloved
  element; the numbers changing is not enough — the line has to still feel good.
- While you are in the file, fix the render loop: it rebuilds the whole `innerHTML` every second,
  which destroys and recreates ten elements per tick, defeats text selection, and is the only
  per-second DOM churn on the site. Build the structure once, then update only the digit
  `textContent`s in the interval. Keep the exact same markup and class names so `sections.css` is
  untouched.
- The counter is *decorative precision*. Do not add a "days until the anniversary" countdown, a
  progress ring, or a milestone badge.

### R5 — Performance

Not a Lighthouse-score exercise. Two things actually matter on a phone on mobile data.

**Image weight.** `public/photos/` is six camera and WhatsApp originals, ~2.7 MB total, the
largest 1.16 MB, served at gallery-card size. Recompress to a sane width (1600px long edge is
generous for this site) at JPEG q0.8 — a 70–85% saving with no visible difference. Note the upload
path already does this for new uploads (`upload.js` compresses to max width 1200 at q0.82), so the
committed originals are the inconsistent ones.

While renaming, fix the filenames: `01-REPOSITORY-AUDIT.md` §9 flags that they contain spaces and
mixed case (`WhatsApp Image 2026-03-18 at 8.35.33 PM.jpeg`). Rename to lowercase hyphenated names
and update the `LOCAL_PHOTOS` array in `src/memories.js`. Verify each of the six still renders.

`srcset` remains deferred (`14` R11 recorded that decision). Do not add an image build plugin.

**Bundle.** Record the real numbers from `npm run build` in `LAUNCH-CHECKLIST.md`. The Firebase SDK
dominates; the thing to check is that pages which should not include it, do not — `13` R6 already
proved that only the Letters path imports `firebase.js`, so confirm the built chunks agree.

**Runtime.** The `loveCounter` interval is handled in R4. Also confirm nothing else from features
05–12 left a `setInterval`, a `requestAnimationFrame` loop, or an `IntersectionObserver` running
after its element is gone. Grep for `setInterval` and check each hit clears.

Targets, and no more: the site loads and becomes interactive on a phone on 4G in under ~3 seconds,
and nothing janks while scrolling.

### R6 — Dead code

- **Delete `src/modules/webhook.js`** and every import of it (`buttons.js` calls it on "Yes").
  `RESPONSE_WEBHOOK_URL` is `''` so it is already a no-op; the deletion removes a latent
  exfiltration path and a stale README section. Verify the Yes button still celebrates.
- **Delete `firebase-debug.log`** from the working tree.
- **Verify** `.github/workflows/npm-publish-github-packages.yml` was resolved by `15-TESTING-QA.md`
  — deleted, or replaced by `ci.yml`. Do not change it yourself; just confirm and record.
- Grep for and remove leftover `console.log`, commented-out blocks, and any `TODO` written during
  feature work that is now done or that will never be done.
- Confirm `navbar.js` was deleted or justified per `04-SHARED-FOUNDATIONS.md`, and that no page
  still imports it.
- Check `COUPLE_QUESTIONS_TO_FILL.md` against `13`'s inventory decision — if the repo stayed
  public, it should not be committed.

### R7 — Documentation

**`DOCS.md` — these specific claims are false. Fix each one:**

| Claim | Reality |
| --- | --- |
| Milestone entries have a `desc` field | The field is **`description`** (and `05` changed the schema again — document the real one) |
| `upload.js` writes a `passcodeHash` field to Firestore, and the `memories` doc has one | It writes exactly `url`, `caption`, `filename`, `createdAt`. **No `passcodeHash` field exists.** |
| Auth is a passcode hashed client-side with SHA-256, stored in `sessionStorage` | Auth is **server-side**: the Cloud Function hashes and compares against `OWNER_PASSCODE_HASH`, mints a Firebase custom token, and the client calls `signInWithCustomToken` with `browserSessionPersistence` |
| Gemini model is `2.0-flash` (in the LoveGPT section) | It is **`gemini-2.5-flash`**, as the architecture diagram in the same file already says |
| Dark mode is "deep navy/purple" | Dark mode is **deep plum** (`--pink-bg: #1a1018`) |

While you are in there, also correct: the knowledge base is **48 chunks**, not 37; Storage
`delete` is allowed for the owner, not denied; and the file tree, module table, page list and
architecture diagram must include the six new pages, the new modules (`siteChrome`, `storage`,
`reveal`, `dates`, `focusTrap`), `ui.css`, and the `usm.*` localStorage namespace. Merge the
corrected security wording from `SECURITY-INVENTORY.md`, including the repo-visibility and
`chunks.json` decisions, and add the `PAGE-CHECKLIST.md` procedure.

**`README.md`:** delete the Webhook section (the module is gone); fix the dev URL, which is
`http://localhost:5173/lovesite/` because of `base: '/lovesite/'`, not `http://localhost:5173`;
update the feature list to include the six new tools; update the milestone example to the real
schema; add `npm test`.

**`FEATURES.md`:** it is the original wish list and bug list. Walk it and resolve every line —
tick what shipped, and move what did not into a short "Not doing / later" section with a reason.
Known items: *"any passcode currently works"* is fixed (server-verified since `03`); *delete
memories from the website* shipped; *captions on upload* shipped; *smooth navigation to Our Story
after Yes* — verify; *words cutting mid-word on desktop ("reality" → "r" / "eality")* in the
sparkle reveal on `index.html` — verify whether this is still happening, since `textReveal.js`
wraps characters in `<span>`s with `display: inline` specifically to avoid it. The "Site Cleanup &
Proposal Archive" and "Protected Milestones" sections were not built; say so honestly.

### R8 — Build, deploy, verify

The deployment is `npm run deploy` → `vite build && gh-pages -d dist`, publishing to the
`gh-pages` branch, served at `https://k-sqr.github.io/lovesite/`.

Before deploying: `npm test`, `npm run build`, `npm run preview`, and walk
`docs/anniversary/QA-CHECKLIST.md`. Confirm `dist/` contains all eleven HTML files — a page missing
from `rollupOptions.input` builds fine locally in `npm run dev` and 404s in production, and
`01-REPOSITORY-AUDIT.md` §10 lists this as the single most common mistake in this repo.

After deploying, verify **on the live origin, not localhost**, and preferably from the phone:

- Every one of the eleven pages resolves under `/lovesite/` — no 404, no blank page.
- No console errors, and specifically no CSP violation reports. The deployed origin is the only
  place the real CSP is exercised against the real Firebase and Open-Meteo hosts.
- Fonts, `heart.png`, photos and music load (relative `./` paths under a base path are the classic
  break).
- Sign-in works with both passcodes against the live Cloud Function (CORS allows
  `https://k-sqr.github.io` only, so this cannot be tested locally).
- LoveGPT returns a reply; a letter opens; the weather fetch succeeds.
- Hard-refresh and cross-browser: iOS Safari, Android Chrome, desktop.
- Check the live page source to confirm the CSP meta tag deployed intact.

Record the deploy time, the commit SHA, and the verification results in `LAUNCH-CHECKLIST.md`.

### R9 — The final quality test

Not a checklist — a judgement. Sit with each feature and answer the brief's own questions
honestly, in writing, in `LAUNCH-CHECKLIST.md`. "Yes" with no evidence is not an answer.

- **Timeline** — does it feel like *our story*, or like a list of dates with icons?
- **Letters** — does it feel like a personal archive she would revisit, or like a folder of PDFs
  with a viewer bolted on?
- **The Application Desk** — does it actually reduce the number of steps between "I found a job"
  and "I applied"? If it adds a step, it has failed, however nice it looks.
- **Rhythm** — can she answer *"when is it probably coming?"* in under ten seconds, without
  reading a chart?
- **People** — does it help an introvert reach out, without creating guilt? Read every string in
  it again specifically for guilt. If any line makes you feel slightly bad reading it, cut it.
- **What to Wear** — can it answer *"what am I wearing today?"* using clothes she actually owns
  and today's real weather? If the suggestion is generic advice, it has failed.
- **Notifications** — do they feel thoughtful, or like app spam? Would she turn them off in a week?
- **The whole site** — does it feel like *"He knows me"*, or like *"he built a dashboard"*?

If any answer is no, the fix is almost always **fewer elements and better writing**, not more
features. Cutting a card is a legitimate outcome of this pass.

### R10 — The dry-run

Genuinely do this. Put the laptop away, pick up a phone, open
`https://k-sqr.github.io/lovesite/` cold — no autofill, no dev tools, no knowledge of the
information architecture — and use it as she would on a normal Tuesday evening.

Note everything: where you hesitated, where you tapped the wrong thing, where you could not tell
whether something saved, where a word was ambiguous, where you had to shuffle your grip, where you
expected a back link and there wasn't one, where the passcode prompt was annoying, where a number
did not match what you expected.

Write the raw notes into `LAUNCH-CHECKLIST.md` **before** you fix anything. Then fix the cheap
ones and list the rest as post-launch. The value is in the unfiltered list; a dry-run you edit as
you go is just a demo.

Then do it once more with the phone at 20% brightness in a dim room, because that is the actual
context in which most of it will be used.

## UX Requirements

- After this pass, every page must feel like the same site: same rhythm, same voice, same weight.
- No feature may end in a dead end. Every page has an obvious way back to For You or Home.
- Nothing shows a spinner with no text for more than a moment; nothing shows a raw error string.
- The product principle holds everywhere: **reduce mental load, don't create another app she has
  to maintain.** Anything that asks her to keep something up to date, for the app's benefit rather
  than hers, is a bug.
- The quality bar is **"He knows me"**, not **"he built a dashboard"**.

## Technical Requirements

- **Zero new dependencies**, runtime or dev. Image recompression uses a local tool
  (`sips`, ImageMagick, Squoosh) run by hand, not a build plugin.
- `npm run build` and `npm test` both clean before any deploy.
- No behaviour change beyond `loveCounter.js`'s arithmetic and render loop.
- Renaming a photo means updating `LOCAL_PHOTOS` in `src/memories.js` in the same commit.
- No `console.log` anywhere in `src/`.
- Bump `package.json` `version` to `3.0.0` — the site is materially different from the 2.0.0 the
  audit describes — and fix its `description`, which still says "creative front-end project".
- Commit in small, reviewable steps. Copy changes separately from code changes.

## Privacy & Security

- **Do not undo `13-SECURITY-REVIEW.md`.** No rules change, no CSP change, no new fetch host. If
  polish appears to need one, it is not polish.
- Recompressing photos rewrites EXIF handling — confirm the tool strips GPS coordinates and device
  metadata. A committed photo with home coordinates in EXIF is a real disclosure in a public repo.
- Documentation updates must not introduce a secret. `DOCS.md` describes the *shape* of the auth
  flow; it never contains a passcode, a hash, or the Rhythm passphrase.
- Screenshots taken for the counter check (R4) or the dry-run must not be committed if they show
  letters, Rhythm data, or People notes.
- Before deploying, confirm `dist/` contains no stray private file — the build copies all of
  `public/` verbatim.
- Re-run the `13` verification greps one final time after all edits. A last-minute copy change can
  reintroduce something.

## Do Not

- Do not add a feature, a page, a card, a badge, or a settings screen.
- Do not redesign anything. If it needed redesigning, that time has passed.
- Do not add analytics, a cookie banner, a privacy policy page, a changelog, or a version footer.
- Do not add a service worker or PWA manifest unless `11-NOTIFICATIONS.md` already shipped one —
  and if it did, do not touch it now; caching bugs discovered post-deploy are miserable.
- Do not upgrade Vite, Firebase, or any dependency. A major-version bump days before launch is
  pure downside.
- Do not run `npm audit fix --force`.
- Do not soften an honest sentence into marketing. "Forgetting the passphrase means this data is
  gone" must stay exactly that blunt.
- Do not let an AI rewrite the personal copy. Use it to *find* the strings and flag the corporate
  ones; write the replacements yourself. Every sentence she reads should be one he would say.
- Do not deploy without walking `QA-CHECKLIST.md`.

## Implementation Strategy

1. **Copy review first** (R1), before touching code. It is the highest-value work and the thing
   most likely to be crowded out. One commit, copy only.
2. States sweep (R2) — force every empty, loading and error state in turn.
3. Visual consistency sweep (R3) — all eleven pages, both themes, side by side.
4. Love counter (R4), with the three screenshots. Its own commit.
5. Performance (R5): recompress and rename photos, remove per-second DOM churn, record bundle
   numbers.
6. Dead code (R6).
7. Documentation (R7). Do this after the code is final so it documents what shipped.
8. Build, test, preview, walk `QA-CHECKLIST.md`, deploy, verify live (R8).
9. Dry-run on the phone (R10) — **against the live site**, not localhost.
10. Final quality test (R9), written down. Fix only what is cheap; list the rest.

Steps 9 and 10 are the ones that will be skipped under time pressure. They are the two that
determine whether this feels like a gift.

## Acceptance Criteria

1. Every user-facing string has been read aloud. No string contains guilt language, corporate
   productivity phrasing, AI-startup voice, a fake statistic, or a KPI framing. Buttons are
   conversational.
2. Every page's empty, loading, and error states have been forced and reviewed; none shows a raw
   error, a bare "No data", or an untexted spinner.
3. No hardcoded radius, shadow, gradient, or colour outside the `02-DESIGN-SYSTEM.md` vocabulary;
   no `backdrop-filter` on a non-overlay surface; no hearts on the utility features.
4. `loveCounter.js` uses `calendarDuration()`. On Sep 13, 2026 it reads "1 year", verified by
   screenshot at Sep 12 / 13 / 14 in both themes. It no longer rewrites `innerHTML` every second,
   and `sections.css` was not modified.
5. `public/photos/` total weight is reduced by at least 60%, filenames are lowercase and
   space-free, EXIF GPS is stripped, all six still render, and `LOCAL_PHOTOS` is updated.
6. `src/modules/webhook.js` is deleted with its imports; the Yes button still celebrates.
   `firebase-debug.log` is gone. `grep -rn "console.log" src/` is empty. No page imports
   `navbar.js`.
7. All five listed `DOCS.md` claims are corrected, plus the chunk count, the Storage delete rule,
   and the file tree / module table / page list. The `13` security wording and the repo-visibility
   and `chunks.json` decisions are recorded there.
8. `README.md` has no Webhook section, the correct `/lovesite/` dev URL, the six new features, and
   `npm test`.
9. Every line in `FEATURES.md` is ticked as shipped or moved to "Not doing / later" with a reason.
10. `npm test` green and `npm run build` clean; `dist/` contains all eleven HTML files.
11. The live site serves all eleven pages under `/lovesite/` with no 404, no console error, and no CSP
    violation; both passcodes sign in; LoveGPT replies; a letter opens; the weather fetch succeeds.
    Verified on iOS Safari from a phone.
12. `package.json` version is `3.0.0` with an accurate description; zero dependency changes.
13. `docs/anniversary/LAUNCH-CHECKLIST.md` contains the deploy record (time, SHA, results), the
    bundle numbers, the unedited dry-run notes, and a written answer to each of the eight R9
    questions.
14. The answer to *"does this feel like 'He knows me' rather than 'he built a dashboard'?"* is yes,
    with reasons — or the remaining gap is named as a post-launch item.

## Verification

```bash
# ── Copy: collect every visible string ──────────────────────────────────────
grep -rhoE ">[A-Z][^<>{}]{6,}<" *.html | sort -u
grep -rnE "textContent *=|innerHTML *=|placeholder=|aria-label=" src/ | grep -v "\.test\.js"
grep -rniE "overdue|late|should have|don't forget|streak|you haven't|neglect" src/ *.html
grep -rniE "optimi[sz]e|streamline|workflow|leverage|insights|at a glance|boost|seamless" src/ *.html
grep -rniE "powered by ai|effortlessly|supercharge|unlock your" src/ *.html

# ── Design drift ────────────────────────────────────────────────────────────
grep -rnE "border-radius: *[0-9]+" src/styles/ | grep -vE "12px|20px|28px|999px|50%|4px|18px"
grep -rn "box-shadow" src/styles/ | grep -v "shadow-soft\|shadow-pink"
grep -rn "linear-gradient\|radial-gradient" src/styles/ | wc -l
grep -rnE "#[0-9a-fA-F]{3,8}" src/styles/ | grep -v "base.css"
grep -rn "backdrop-filter" src/styles/

# ── Dead code and hygiene ───────────────────────────────────────────────────
grep -rn "webhook" src/ README.md DOCS.md
grep -rn "navbar.js" src/
grep -rn "console.log\|TODO\|FIXME" src/
ls -la firebase-debug.log 2>/dev/null && echo "still present — delete it"
grep -rn "setInterval\|requestAnimationFrame" src/

# ── Stale docs ──────────────────────────────────────────────────────────────
grep -n "desc\b\|passcodeHash\|2.0-flash\|navy\|37 chunks\|client-side" DOCS.md
node -e "console.log(require('./functions/knowledge/chunks.json').length, 'chunks')"

# ── Images ──────────────────────────────────────────────────────────────────
du -sh public/photos/ && ls -la public/photos/
ls public/photos/ | grep -n " "          # expect: no filenames with spaces
grep -rn "LOCAL_PHOTOS" -A 12 src/memories.js
exiftool public/photos/*.jpg | grep -i "GPS" || echo "no GPS metadata — good"

# ── Build, test, preview ────────────────────────────────────────────────────
npm test
npm run build
for p in index memories timeline lovegpt foryou letters applications people rhythm outfit; do
  test -f "dist/$p.html" && echo "ok   $p" || echo "MISS $p  ← add to rollupOptions.input"
done
du -sh dist/ && ls -la dist/assets/ | sort -k5 -n | tail -10
npm run preview                          # walk QA-CHECKLIST.md at /lovesite/

# ── Deploy ──────────────────────────────────────────────────────────────────
git status --short                       # clean tree before deploying
npm run deploy                           # vite build && gh-pages -d dist
git rev-parse --short HEAD               # record this SHA in LAUNCH-CHECKLIST.md

# ── Post-deploy, against the live origin ────────────────────────────────────
for p in index memories timeline lovegpt foryou letters applications people rhythm outfit; do
  curl -so /dev/null -w "$p → %{http_code}\n" "https://k-sqr.github.io/lovesite/$p.html"
done
curl -s https://k-sqr.github.io/lovesite/index.html | grep -o 'Content-Security-Policy[^>]*' | head -1
```

**Manual tests:**

1. **Read aloud.** Every string, out loud, on a phone-width window. Mark anything that makes you
   wince.
2. **Empty-state pass.** DevTools → Application → clear all `usm.*` keys, reload each page.
3. **Counter check.** Set the system clock to Sep 12, 13 and 14, 2026. Screenshot the counter in
   both themes at 375px and 1440px. Reset the clock.
4. **Side-by-side.** All eleven pages open in tabs, light theme, then dark. Do they look like one
   site?
5. **Live smoke test from the phone.** Both passcodes, one letter, one LoveGPT reply, one weather
   fetch, music across two pages, theme toggle persisting.
6. **The dry-run (R10).** Cold, on a phone, as her. Then again at 20% brightness in a dim room.
   Raw notes first, fixes after.
7. **The final quality test (R9).** Eight questions, eight written answers.

## Definition of Done

- [ ] Every user-facing string read aloud and revised where it did not sound like him
- [ ] No guilt language, corporate phrasing, AI voice, fake statistics, or KPI framing anywhere
- [ ] Empty / loading / error / storage-blocked states forced and reviewed on all eleven pages
      (including the hidden `anniversary.html`)
- [ ] Radii, shadows, gradients, colours, spacing, glass and motion reconciled against `02`
- [ ] `loveCounter.js` uses `calendarDuration()`; "1 year" verified by screenshot on Sep 13, 2026;
      per-second `innerHTML` rewrite replaced with targeted `textContent` updates
- [ ] `public/photos/` recompressed (≥60% lighter), renamed, EXIF GPS stripped, `LOCAL_PHOTOS`
      updated, all six rendering
- [ ] Bundle sizes recorded; no stray `setInterval` or observer left running
- [ ] `webhook.js` deleted with its imports; `firebase-debug.log` removed; no `console.log`;
      `navbar.js` resolved; the npm-publish workflow confirmed resolved by `15`
- [ ] `DOCS.md`: all five stale claims fixed, plus chunk count, Storage delete rule, file tree,
      module table, page list, `usm.*` namespace, and the `13` security decisions
- [ ] `README.md` and `FEATURES.md` updated; every FEATURES line ticked or deferred with a reason
- [ ] `package.json` at `3.0.0` with an accurate description; zero dependency changes
- [ ] `npm test` green, `npm run build` clean, all eleven files in `dist/`, `QA-CHECKLIST.md` walked
- [ ] Deployed; all eleven live pages return 200 under `/lovesite/`; no console or CSP errors; both
      passcodes, LoveGPT, a letter and the weather fetch verified on a real phone
- [ ] `docs/anniversary/LAUNCH-CHECKLIST.md` written: deploy record, bundle numbers, unedited
      dry-run notes, and written answers to all eight quality questions
- [ ] It feels like "He knows me", not "he built a dashboard" — and the reasons are written down
