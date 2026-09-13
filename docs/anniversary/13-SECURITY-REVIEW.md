# 13 — Final Security Review

**Recommended tool:** Claude Code. **Model:** a strong reasoning model.
Justification: this is a breadth-first, mostly read-only audit across every HTML file, every new
module, `firestore.rules`, `storage.rules`, `functions/index.js`, and git history. There is no
visual iteration to do and there are dozens of files to hold at once — exactly what a batch agent
is good at, and exactly what Cursor Chat is bad at.

---

## Context

`03-SECURITY-REMEDIATION.md` was a fire drill run **before** any feature work: three private PDFs
were publicly downloadable from `github.com/K-Sqr/lovesite` and had to be purged from history.
This file is the opposite kind of pass. It runs **after** features 05–12 have landed, when the
repository holds materially more of her life than it did in March: a rewritten timeline, private
letters in Firebase Storage, a job-application record, notes about her friends and family,
menstrual-cycle data, a wardrobe, and a notification system.

Three facts from `01-REPOSITORY-AUDIT.md` set the boundaries of what is even possible here:

1. **The site is a static bundle on GitHub Pages.** There is no server you control between her
   browser and the internet. No sessions, no server-rendered gating, no HTTP response headers you
   can set. The only server-side logic in the entire product is one Cloud Function.
2. **The only real authorisation boundary is a Firebase security rule** evaluated against an
   authenticated UID (`owner`, and after `03`, `tolu`). Everything else in the frontend is
   decoration.
3. **The repository is public** unless the visibility decision in `03` §4 changed that. Every file
   you commit is a publication.

The purpose of this review is not to make the site secure in an absolute sense — it cannot be, and
pretending otherwise is worse than being honest. The purpose is to produce a written, defensible
answer to one question for every piece of data in the product: *is this safe enough given who can
actually reach it, or does it need infrastructure this project does not have?*

## Objective

1. Produce `docs/anniversary/SECURITY-INVENTORY.md` — a complete asset inventory that classifies
   every asset as **"Safe enough for this anniversary MVP"** or
   **"Requires real backend/security infrastructure"**, with a one-line justification each.
2. Verify that the `03-SECURITY-REMEDIATION.md` remediation actually held, by fetching the URLs.
3. Escalate and force a decision on `functions/knowledge/chunks.json`.
4. Prove, by grep, that Rhythm data never leaves the device.
5. Re-audit CSP, Firebase rules, analytics exposure, and download-URL handling across all the new
   pages that did not exist when `01` was written.
6. Write down the real threat model, in plain language, and calibrate every recommendation to it.

## Prerequisites

- `01-REPOSITORY-AUDIT.md` read in full, especially §5, §6 and §7.
- `03-SECURITY-REMEDIATION.md` completed, including the repo-visibility decision.
- Features `05-TIMELINE.md` through `12-ANNIVERSARY-EXPERIENCE.md` implemented and merged.
  This review is meaningless against half-built features.
- `14-MOBILE-ACCESSIBILITY.md` may run before or after; they do not overlap.
- A terminal with `git`, `curl`, `grep` and `npx firebase-tools` authenticated.

## Existing Files To Inspect

```
index.html, timeline.html, memories.html, lovegpt.html      original pages (CSP baseline)
foryou.html, letters.html, applications.html, people.html   new pages (CSP + imports)
rhythm.html, outfit.html
firestore.rules                                             collections + catch-all deny
storage.rules                                               memories/ + letters/ + catch-all deny
functions/index.js                                          secrets array, verify-passcode, CORS
functions/knowledge/chunks.json                             48 chunks, see Requirements R3
src/modules/firebase.js                                     getAnalytics(app) fires on import
src/modules/auth.js                                         custom-token flow, role handling
src/modules/storage.js                                      namespacing + encrypted variant
src/modules/letters.js (or whatever 06 created)             getDownloadURL vs getBlob
COUPLE_QUESTIONS_TO_FILL.md                                 committed, contains personal answers
.gitignore                                                  *.pdf rule from 03
DOCS.md                                                     security section, currently stale
```

## Files You Own (Create)

```
docs/anniversary/SECURITY-INVENTORY.md    the classification table + findings + decisions
```

## Files You May Modify

- `firestore.rules`, `storage.rules` — only to tighten a rule you can demonstrate is too loose.
- The `<meta http-equiv="Content-Security-Policy">` tag in any HTML file — only to make all files
  byte-identical, or to remove a directive that turned out to be unnecessary.
- `.gitignore` — to exclude a file this review decides must leave version control.
- `functions/index.js` — only the `secrets` array or CORS allow-list, if a real defect is found.

Every change you make here must be accompanied by a line in `SECURITY-INVENTORY.md` saying what
you changed and why.

## Files You Must Not Touch

- `DOCS.md`, `README.md`, `FEATURES.md` — documentation is `16-FINAL-POLISH.md`'s pass. Write the
  corrected security wording into `SECURITY-INVENTORY.md` and let `16` merge it.
- Any CSS file, and any HTML outside the CSP meta tag — that is `14-MOBILE-ACCESSIBILITY.md`.
- `package.json`, `.github/workflows/**`, any test file — that is `15-TESTING-QA.md`.
- Any feature module's behaviour. If a feature is insecure, **write the finding down**; do not
  silently redesign it. A security pass that also refactors is a security pass nobody can review.

## Requirements

### R1 — The inventory table (the deliverable)

`SECURITY-INVENTORY.md` opens with one table. Every row is a real asset that exists in the shipped
product. Columns: **Asset · Where it lives · Who can reach it today · Classification · Action**.
Classification is exactly one of **"Safe enough for this anniversary MVP"** or
**"Requires real backend/security infrastructure"** — no third bucket, no "partially". Forcing a
binary is the point; it is what makes the document useful later.

Rows you must cover, at minimum:

| Category | Specific assets |
| --- | --- |
| Public assets | `public/photos/*`, `public/music/*`, `public/heart.png`, all timeline prose, verses |
| Sensitive assets | the three PDFs from `03`, letters in Storage `letters/`, `COUPLE_QUESTIONS_TO_FILL.md` |
| Frontend "secrets" | the Firebase web config in `src/modules/firebase.js` |
| API keys | `GEMINI_API_KEY`, the Open-Meteo endpoint (keyless) |
| Environment variables | `OWNER_UID`, `OWNER_PASSCODE_HASH`, `READER_PASSCODE_HASH` |
| Passwords / passcodes | owner passcode, her reader passcode, the Rhythm passphrase |
| localStorage | `aho_theme`, `usm.applications.*`, `usm.people.*`, `usm.wardrobe.*`, `usm.reminders.*`, `usm.rhythm.*` |
| IndexedDB | wardrobe photo blobs |
| Authentication | what `signInWithCustomToken` + `browserSessionPersistence` actually protects |
| Health data | cycle dates, symptoms, predictions |
| Third-party personal data | friends'/family names, birthdays, notes in People |
| Notifications | in-app text content, and what would change if it ever became a push notification |
| Analytics | Google Analytics pageviews per page |
| RAG knowledge base | `functions/knowledge/chunks.json` |

State plainly for each row *who* can reach it: "anyone on the internet", "anyone with the repo
URL", "anyone with her unlocked phone", "only an authenticated `owner`/`tolu` session", "nobody
but her, and only with the passphrase".

### R2 — Verify `03` actually held

Do not take the remediation on trust. Fetch the URLs and inspect history. The exact commands are
in **Verification**. Record the literal HTTP status codes in the inventory, with the date checked.
If any of the three returns 200, stop the review and escalate immediately — that is a live
disclosure, not a finding to file.

Also check the forks list (`gh api repos/K-Sqr/lovesite/forks`). A force-push does not reach forks.

### R3 — `functions/knowledge/chunks.json` is a serious finding, not a footnote

Escalate this explicitly, in its own section, with the heading it deserves.

The file is committed to a public repository and contains 48 plain-text chunks. Its `section`
values include `health_details`, `intimacy_attraction`, `spiritual_warfare`, and
`wedding_planning`, alongside `nicknames`, `key_dates`, and month-by-month journal summaries. It
is plain text, it is indexed by GitHub's own code search, and it needs no PDF reader to read.

**Argue the case honestly: this is arguably a bigger disclosure than the three PDFs were.** The
PDFs were the headline because they were obviously private documents. `chunks.json` is worse in
one specific way — it is *searchable*. Someone searching GitHub for a name, a church, or a phrase
lands directly on the relevant paragraph.

The review must force one of exactly two decisions, and record which was taken:

- **Make the repository private.** Pages can still serve the site from a private repo on a paid
  plan. This retroactively protects `chunks.json`, `COUPLE_QUESTIONS_TO_FILL.md`, and every future
  commit, at the cost of a GitHub Pro subscription. This is the recommendation.
- **Keep it public, and move `chunks.json` out of version control.** Gitignore it, keep the real
  file locally, and have the deploy step supply it — the Cloud Function reads it with
  `readFileSync` at cold start, so it must exist in the deployed function bundle but need not
  exist in git. This also means purging it from history exactly as `03` purged the PDFs, and it
  means every future content addition needs a manual "is this okay to be public?" check.

Say in the document which was chosen, who chose it, and when. An undecided finding is a finding
that will still be open next year.

While you are in that file: check whether any chunk contains a full legal name of a third party, a
home address, a church name, an employer, or a phone number. Those are other people's data and
they did not consent to being in a public repo.

### R4 — Prove Rhythm data never leaves the device

The Rhythm feature (`09-PERIOD-TRACKER.md`) holds menstrual-cycle and symptom data. In most
jurisdictions this is a special category of personal data, and in this product it is the single
most sensitive thing on the site. The design (from `04-SHARED-FOUNDATIONS.md` R3b) is that it is
AES-GCM encrypted under a PBKDF2 key derived from a passphrase that is never stored.

That design is only as good as its blast radius. Prove, by grep, that the Rhythm code path has no
network egress at all. The commands are in **Verification** — run them and paste the real output
into the inventory, including the case where output is empty.

Specifically verify, with evidence:

1. `src/rhythm.js` and every module it imports contain **no** `fetch(`, no `navigator.sendBeacon`,
   no `new WebSocket`, no `new Image()` pixel, and no dynamic `import()` of a network module.
2. Nothing under the Rhythm path imports `src/modules/firebase.js` (directly or transitively).
   That import alone fires `getAnalytics(app)`.
3. No cycle data, symptom label, or prediction string is ever passed to the LoveGPT request body
   in `src/lovegpt.js`, and no cycle-related chunk was added to `functions/knowledge/chunks.json`.
   Grep `chunks.json` for cycle vocabulary and confirm nothing was added by feature work.
4. The `usm.rhythm.*` localStorage value, read raw in DevTools, is base64 ciphertext — no readable
   date, no readable symptom, no verification hash of the passphrase.
5. `rhythm.html` has no `<img>` or `<link>` pointing at a third-party host, and its `connect-src`
   is no broader than the other pages'.

If any of these fails, it is a **blocking** finding, not an advisory one.

### R5 — No passcode and no passphrase anywhere in the repository

Neither passcode nor the Rhythm passphrase may appear in source, docs, comments, test fixtures,
sample data, or git history. Hashes only, and only in Firebase secrets.

Run the history grep in **Verification**. Be honest about its limits: a `git log -p | grep` over a
repo this size is slow, it produces false positives on ordinary English words, and it cannot find
a passcode you do not already know the shape of. Treat a clean result as *weak* evidence, not
proof. The stronger control is the rule itself plus the `03` §Step 6 practice of generating the
hash with `node -e` and clearing shell history.

Also check that no test fixture written by `15-TESTING-QA.md` embeds a real passphrase — the
encrypted-store round-trip test must use an obviously fake literal.

### R6 — Analytics exposure on the new pages

`src/modules/firebase.js` calls `getAnalytics(app)` at module scope. Any page that imports it —
directly or through a chain — sends a Google Analytics pageview. `04-SHARED-FOUNDATIONS.md`
required that **only `letters.html` among the new pages touches Firebase**.

Verify it. Build the import graph for each new page entry and confirm that `applications.js`,
`people.js`, `rhythm.js`, `outfit.js`, and `foryou.js` never reach `firebase.js`. A single stray
`import { db } from './modules/firebase.js'` in a shared helper defeats this silently.

Then form a view on the remaining case and write it down: Google Analytics currently receives a
pageview for `letters.html`, `memories.html`, and `lovegpt.html` with no consent gate. For this
product — two users, one of whom is the owner — that is defensible. State the reasoning rather
than leaving it unexamined, and note the cleanest improvement: move `getAnalytics(app)` behind an
explicit opt-in, or delete it. It buys this project nothing.

### R7 — CSP consistency across every HTML file

There is no templating, so the CSP meta tag is copy-pasted into what is now eleven HTML files. They
drift. Verify they are **byte-identical** using the hash command in **Verification**.

Then review the content of the shared policy:

- The Open-Meteo host required by `10-OUTFIT-OF-THE-DAY.md` must be in `connect-src` in **every**
  file, not just `outfit.html` — the policy is shared, so a per-page policy is a bug waiting for
  the first refactor.
- Check whether `frame-src 'none'` was relaxed for the Letters viewer. If it was, that is a real
  decision and must be justified in writing: which directive value, why a frame was needed at all,
  and whether a `blob:` PDF rendered without a frame would have worked. `03` §Step 5 explicitly
  routed Letters through `getBlob`, so a relaxed `frame-src` suggests the design drifted.
- Confirm `script-src 'self'` still has no `'unsafe-inline'` and no `'unsafe-eval'`. If a feature
  added an inline handler or a `new Function`, find it.
- Confirm no directive was widened to a bare wildcard.

### R8 — Firebase rules re-audit

For every collection and Storage prefix added by features 05–12:

- There is an explicit `match` block with an `allow` condition scoped to `request.auth.uid`.
- The deny-by-default catch-alls (`match /{document=**}` and `match /{allPaths=**}`) are still the
  **last** blocks in their files. Rule order matters and an appended feature block placed after
  the catch-all is a common, silent mistake.
- Any rule granting `read: if true` is deliberate and the data behind it is genuinely public.
- Size and content-type constraints exist on every `create`.
- Run the rules through the emulator or the Firebase console rules playground with an
  unauthenticated principal and confirm denial.

### R9 — `getDownloadURL()` discipline

A Firebase Storage download URL carries a token that **bypasses security rules once issued**.
Anyone holding the URL can fetch the object, signed out, forever, until the token is revoked.

Grep for `getDownloadURL` across `src/`. For each call site, confirm the result is:

- held in memory only for the lifetime of the view, and
- never written to Firestore, `localStorage`, IndexedDB, `src/data/`, a bookmark, or a log.

The `memories` collection legitimately stores `url` — those images are public by rule, so a
tokenised URL adds no exposure. **Letters are the opposite case.** If a letter's download URL is
persisted anywhere, that is a blocking finding: it converts an authenticated-read object into a
permanently public one.

## UX Requirements

Security findings become user-visible copy, and the copy has to be as honest as the document.

- **No fake assurance.** Do not add a padlock icon, a "🔒 Encrypted" badge, or the word "secure" to
  anything whose only protection is that the page is unlisted. If a lock appears on screen, a
  Firebase rule must be enforcing it.
- The Rhythm setup screen must already say, plainly, that forgetting the passphrase means the data
  is gone and there is no reset. Verify that sentence exists and is not buried.
- Where data is device-only (Applications, People, Wardrobe, Rhythm), one calm sentence should say
  so — "this stays on your phone" — because that is genuinely reassuring and also sets the correct
  expectation that clearing browser data deletes it.
- Error copy must not leak. A failed letter fetch says something warm and generic, not a Firebase
  error code.
- None of this may read as legal boilerplate. No privacy-policy tone, no consent modal, no cookie
  banner. One sentence, in his voice, where it matters.

## Technical Requirements

- **No new runtime dependencies.** No scanner package, no `helmet`-style middleware (there is no
  server), no crypto library.
- Any rules change must be deployed and re-verified, not just committed:
  `npx firebase-tools deploy --only firestore:rules,storage`.
- The inventory document is committed to the repo. Make sure it contains **no** secret values,
  no passcodes, and no verbatim excerpts of sensitive `chunks.json` content — describe, do not
  quote. A security document that leaks is a comedy.
- Findings get severities: **Blocking** (fix before she sees the site), **Should fix**,
  **Accepted risk**. Every accepted risk names who accepted it.

## Privacy & Security

**Obscurity is not authentication. Write this at the top of the inventory and mean it.**

A hidden URL is not a security control. Neither is a page that is missing from the nav, a
client-side route guard, a `.locked` CSS class, a `display: none`, an `if (!isAuthenticated())`
check in JavaScript, or a passcode compared in the browser. All of those are curtains. They stop a
casual glance and nothing else, because the visitor controls the browser: they can read the
bundle, call the function directly, and edit any variable in the console.

The **only** real boundary in this architecture is a Firebase security rule evaluated server-side
against an authenticated UID. When you classify an asset as safe, the justification must be either
"a rule protects it" or "it does not matter if it is public" — never "the URL is hard to guess".

### The threat model, named

Calibrate everything to the adversaries who actually exist here, and say so in the document:

1. **A curious person holding her unlocked phone** — a sibling, a friend, someone she handed the
   phone to. This is the most likely one by a wide margin. The defences that matter are the
   Rhythm passphrase, the discreet "Rhythm" label, session-scoped auth that dies with the tab, and
   not putting cycle state on the For You hub.
2. **Someone who finds the public GitHub repo** — from the live site's source, the README, a
   search for her name. This is what `03` addressed and what `chunks.json` re-opens.
3. **Search engines and archival crawlers** — Google, the Wayback Machine, GitHub code search.
   They are indiscriminate and they do not forget. This is why "we removed it" is not "it was
   never there".

**The adversary is not a nation state, not an APT, and not a determined attacker with time and
motive.** Nobody is going to brute-force the passcode function or mount a timing attack on the
hash comparison. Say that explicitly, because it licenses you to *stop*: recommendations that
would be right for a fintech are wrong here, they cost the gift its warmth, and they will not get
implemented anyway. A recommendation nobody follows is worth zero.

### What real security would look like

Include this as a short forward-looking section — not a plan, just an honest description of the
gap, so that future-him knows what "properly" would mean:

- **Real per-user authentication** — Firebase Auth with email or Google sign-in, one account each,
  rather than two shared passcodes minting fixed UIDs.
- **Per-user Firestore documents** scoped by `request.auth.uid` in the path, so the rule is
  `match /users/{uid}/{doc} { allow read, write: if request.auth.uid == uid; }` and no rule
  hardcodes a string like `'owner'`.
- **Signed, short-lived URLs** for private files (a Cloud Function minting a V4 signed URL with a
  5-minute expiry) instead of `getDownloadURL()`'s permanent token.
- **A private repository**, so that committing something personal is not the same as publishing it.
- **No analytics on any page carrying sensitive data**, and a consent gate on the rest.
- **Server-side rendering or a real backend**, which would make route guards meaningful — this is
  the one that is genuinely out of scope for a static Pages site.

## Do Not

- Do not add a `SECURITY.md`, a threat-model diagram generator, a vulnerability-disclosure policy,
  or a compliance checklist. This is a gift for one person.
- Do not run `npm audit fix --force`. With `firebase` as the only runtime dependency, transitive
  advisories are noise; a forced upgrade to Vite or Firebase majors right before the anniversary
  is a much larger risk than the advisory.
- Do not add rate limiting, CAPTCHA, or WAF-style defences to the Cloud Function.
- Do not weaken any existing control to make a feature work. If a feature needs a weaker rule, the
  feature is wrong.
- Do not silently fix a feature while auditing it. File the finding.
- Do not quote sensitive content in the inventory. Reference it by file and section name.
- Do not describe anything as "encrypted" unless AES-GCM is actually involved.

## Implementation Strategy

1. **Verify `03` first** (R2). If a PDF is live, everything else waits.
2. **Enumerate before you judge.** Walk the repo and build the raw asset list — `git ls-files`,
   the `dist/` output, the Firestore collections, the Storage prefixes, the browser-storage keys
   from DevTools. Only then start classifying. Classifying as you enumerate causes omissions.
3. **Run the mechanical checks** (R4, R5, R7, R9) — they are greps and hashes, they are fast, and
   their output goes verbatim into the document.
4. **Review the rules** (R8) against the emulator, not by reading.
5. **Write the `chunks.json` section** (R3) and get an actual decision. Do not file it as "TBD".
6. **Write the threat model and the future-architecture section last**, once you know what the
   findings are, so the narrative matches the evidence.
7. Make only the minimal tightening changes you can justify, and list each one.

## Acceptance Criteria

1. `docs/anniversary/SECURITY-INVENTORY.md` exists and contains a single table where **every** row
   has one of exactly two classification values, and no row is blank or "TBD".
2. All three PDF URLs return **404** from `raw.githubusercontent.com`, and
   `git log --all --oneline -- 'docs/*.pdf'` is empty. Status codes and the check date are recorded.
3. The `chunks.json` decision is recorded with a date and an owner: either the repo is private
   (verified by `gh repo view K-Sqr/lovesite --json visibility`), or the file is gitignored, purged
   from history, and absent from `git ls-files`.
4. The Rhythm egress greps (R4) all return empty, and the raw `usm.rhythm.*` localStorage value is
   demonstrably unreadable ciphertext. Evidence pasted into the inventory.
5. `grep -rn "getAnalytics\|from './modules/firebase.js'" src/` shows that among the new pages only
   the Letters path reaches `firebase.js`.
6. Every HTML file's CSP meta tag hashes to the same value.
7. `firestore.rules` and `storage.rules` each end with their catch-all deny block, and an
   unauthenticated read of a `letters/` object and of every new collection is denied — tested, not
   assumed.
8. `grep -rn "getDownloadURL" src/` — every hit is either the public `memories` path or is
   demonstrably memory-only. No letter URL is persisted anywhere.
9. No passcode or passphrase appears in `git ls-files` content or, as far as the history grep can
   tell, in history. The limits of that check are stated in the document.
10. The document names the three adversaries, says explicitly that a nation-state adversary is out
    of scope, and includes the "what real security would look like" section.
11. Every **Blocking** finding is either fixed or has a written, dated acceptance.
12. `npm run build` still succeeds and all eleven pages load — this review must not break the site.

## Verification

```bash
# ── R2: did the 03 remediation hold? ────────────────────────────────────────
for f in "boo.pdf" "journal.pdf" "Happy%20180%20days.pdf"; do
  curl -so /dev/null -w "$f → %{http_code}\n" \
    "https://raw.githubusercontent.com/K-Sqr/lovesite/master/docs/$f"
done
git log --all --oneline -- 'docs/*.pdf'          # expect: empty
git log --all --diff-filter=D --name-only | grep -i '\.pdf'   # expect: empty
gh repo view K-Sqr/lovesite --json visibility,isPrivate
gh api repos/K-Sqr/lovesite/forks --jq 'length'  # forks retain old history

# ── R3: what is actually in the public knowledge base ───────────────────────
node -e "const c=require('./functions/knowledge/chunks.json'); \
  console.log(c.length, 'chunks'); \
  console.log([...new Set(c.map(x=>x.section))].sort().join('\n'))"
git ls-files | grep -n 'chunks.json'             # empty only if the file was removed from VCS

# ── R4: Rhythm must have zero network egress ────────────────────────────────
grep -rn "fetch(\|sendBeacon\|WebSocket\|new Image(\|XMLHttpRequest" \
  src/rhythm.js src/modules/rhythm*.js src/modules/storage.js
grep -rn "firebase" src/rhythm.js src/modules/rhythm*.js
grep -rniE "period|cycle|menstrual|ovulation|luteal|tampon|cramp" \
  functions/knowledge/chunks.json src/lovegpt.js
grep -rn "connect-src" rhythm.html               # must match the other pages exactly

# ── R5: no secrets in the tree, and a weak history check ────────────────────
grep -rniE "passcode *= *['\"]|passphrase *= *['\"]" src/ functions/ docs/ *.html
git log -p --all -- src/ functions/ | grep -niE "passcode *= *['\"]" | head -50
#   ^ slow, noisy, and only weak evidence — read the caveat in R5 before trusting it

# ── R6: which pages reach Firebase (and therefore Analytics) ────────────────
grep -rn "modules/firebase" src/
grep -rn "getAnalytics" src/

# ── R7: CSP must be byte-identical in every HTML file ───────────────────────
for f in *.html; do
  printf "%s  " "$f"
  grep -o 'content="default-src[^"]*"' "$f" | shasum | cut -c1-12
done | sort -k2
grep -c "unsafe-eval\|unsafe-inline' [^;]*script" *.html   # expect 0 for script-src

# ── R8: rules — catch-all must be last ──────────────────────────────────────
grep -n "match\|allow" firestore.rules storage.rules
npx firebase-tools deploy --only firestore:rules,storage

# ── R9: download URLs must never be persisted ───────────────────────────────
grep -rn "getDownloadURL" src/
grep -rn "getBlob" src/

# ── The site must still work afterwards ─────────────────────────────────────
npm run build && npm run preview
```

**Manual tests:**

1. **Signed-out letter fetch.** In a logged-out incognito window, request a `letters/` object path
   directly via the Storage REST URL. Expect a permission error, not a file.
2. **Tokenised URL check.** Sign in as `owner`, open a letter, then copy any URL the app produced
   from DevTools → Network. Paste it into a logged-out incognito window. If the PDF loads, the app
   used `getDownloadURL` instead of `getBlob` — blocking finding.
3. **Rhythm at rest.** With Rhythm data saved, open DevTools → Application → Local Storage and read
   `usm.rhythm.*`. Confirm ciphertext. Reload without entering the passphrase and confirm nothing
   readable is rendered or cached in memory from a previous session.
4. **Analytics reality check.** Open DevTools → Network, filter `google-analytics`, and load each
   of the eleven pages in turn. Record exactly which pages fire a request.
5. **GitHub code search.** Search the public repo for her first name, the church name, and a
   distinctive phrase from a journal entry. Record what surfaces.
6. **Rules playground.** In the Firebase console, simulate an unauthenticated read and a
   `request.auth.uid == 'tolu'` write against every new collection and prefix.

## Definition of Done

- [ ] `docs/anniversary/SECURITY-INVENTORY.md` created, with a complete two-value classification
      table covering every category listed in R1
- [ ] "Obscurity is not authentication" stated at the top, and no asset is justified by obscurity
- [ ] `03` remediation re-verified with literal HTTP status codes and a check date
- [ ] Fork count checked and noted
- [ ] `chunks.json` escalated in its own section; a private-repo-or-remove decision is recorded
      with an owner and a date
- [ ] Third-party PII in `chunks.json` reviewed (names, addresses, employers, phone numbers)
- [ ] Rhythm egress proven by grep, with output pasted in; ciphertext confirmed in DevTools
- [ ] No passcode or passphrase in the tree; history check run with its limitations stated
- [ ] Import graph confirms no new page except Letters reaches `src/modules/firebase.js`
- [ ] A written position on Google Analytics, including the recommendation to remove it
- [ ] CSP meta tags byte-identical across all HTML files; Open-Meteo host present in all of them;
      any `frame-src` relaxation justified in writing
- [ ] Firebase rules re-audited; catch-all deny blocks confirmed last; unauthenticated access
      tested and denied
- [ ] Every `getDownloadURL` call site reviewed; no letter URL persisted anywhere
- [ ] Threat model written with the three named adversaries and the explicit non-goal
- [ ] "What real security would look like" section written
- [ ] Every finding carries a severity; every Blocking finding fixed or formally accepted
- [ ] `npm run build` clean and all eleven pages load
- [ ] Corrected security wording handed to `16-FINAL-POLISH.md` for the `DOCS.md` update
