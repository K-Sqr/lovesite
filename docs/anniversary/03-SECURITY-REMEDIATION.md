# 03 — Security Remediation (RUN THIS FIRST)

> 🔴 **This is not a feature. This is a live disclosure of your girlfriend's private journal.**
> Do it before you write a line of anniversary code. It takes about 30 minutes.
>
> **Do this one by hand, in a terminal, reading each command before you run it.** Do not delegate
> history rewriting to an AI agent. The commands are destructive and irreversible.

**Prerequisite:** `01-REPOSITORY-AUDIT.md` §7 read.
**Tool:** you + a terminal. **Model:** none.

---

## Context

`https://github.com/K-Sqr/lovesite` is a **public** repository. These files are committed to it:

| File | What it is |
| --- | --- |
| `docs/journal.pdf` | Tolu's 54-page personal journal |
| `docs/boo.pdf` | Emmanuel's private notes (13.4 MB) |
| `docs/Happy 180 days.pdf` | The 10-page six-month letter |

Verified live:

```
GET https://raw.githubusercontent.com/K-Sqr/lovesite/master/docs/boo.pdf
→ HTTP 200, 13,389,504 bytes
```

Anyone who knows the repo URL — which is discoverable from the live site's own source, its README,
and `DOCS.md` — can download all three. The deployed Pages site does *not* serve them (that URL
404s), so this is purely the public git repo. That distinction does not help: the repo is the
exposure.

### Be honest with yourself about what remediation can and cannot do

Removing the files fixes **future** access. It does not un-disclose anything already fetched.
GitHub may serve cached raw content for a period after a force-push, forks and clones retain
history, and archival crawlers exist. Assume the content **has been publicly available since the
commit that added it**, and act accordingly: this is damage limitation, not a time machine.

This is also a good moment to tell her the journal was briefly public. That is not a technical
requirement. It is the right thing to do, and it is much better coming from you now than being
discovered later.

---

## Objective

1. Stop serving the PDFs from the public repo, including from git history.
2. Establish the **one** correct home for private documents in this architecture:
   **Firebase Storage under a deny-by-default prefix, read only by an authenticated session.**
3. Extend the existing passcode/custom-token flow to issue a **second identity for her**, so
   Letters can be readable by both of you without making her share your owner passcode.

This unblocks `06-LETTERS.md`, which depends on all three.

---

## Existing files to inspect

```
docs/boo.pdf, docs/journal.pdf, docs/Happy 180 days.pdf   ← to be removed from git
.gitignore                                                 ← add an exclusion
storage.rules                                              ← add letters/ block
functions/index.js                                         ← verify-passcode handler, ~L150-182
src/modules/auth.js                                        ← client passcode flow
firebase.json                                              ← rules wiring
```

## Files you will modify

- `.gitignore`
- `storage.rules`
- `functions/index.js` (only the `verify-passcode` branch and the UID constants)
- `src/modules/auth.js` (only to surface *which* identity signed in)
- `DOCS.md` (correct the security section afterwards)

## Files you must not touch

`firestore.rules`, any page HTML, any other module, the RAG code path in `functions/index.js`.

---

## Step 1 — Move the PDFs somewhere safe locally

```bash
mkdir -p ../ahosite-private
mv docs/boo.pdf docs/journal.pdf "docs/Happy 180 days.pdf" ../ahosite-private/
```

**Outside the repo.** Verify all three are there and open correctly before continuing.
`docs/anniversary/` stays where it is — those planning files are fine to commit.

## Step 2 — Prevent recurrence

Append to `.gitignore`:

```gitignore
# Private documents — never commit. Letters live in Firebase Storage (see docs/anniversary/03).
*.pdf
docs/*.pdf
!docs/anniversary/**
```

## Step 3 — Remove from the current tree

```bash
git rm --cached "docs/boo.pdf" "docs/journal.pdf" "docs/Happy 180 days.pdf"
git commit -m "Remove private documents from version control"
```

At this point the files are gone from `HEAD` but **still in history and still downloadable by
commit SHA.** Step 4 is the one that matters.

## Step 4 — Purge from history

Use `git filter-repo` (the maintained tool; `filter-branch` is deprecated).

```bash
# Back up first. Non-negotiable.
cd .. && cp -r ahosite ahosite-backup-$(date +%Y%m%d) && cd ahosite

pip install git-filter-repo    # or: brew install git-filter-repo

git filter-repo --invert-paths \
  --path "docs/boo.pdf" \
  --path "docs/journal.pdf" \
  --path "docs/Happy 180 days.pdf" \
  --force
```

`filter-repo` drops the `origin` remote by design. Re-add and force-push:

```bash
git remote add origin https://github.com/K-Sqr/lovesite.git
git push origin --force --all
git push origin --force --tags
```

Verify — this must 404:

```bash
curl -sI "https://raw.githubusercontent.com/K-Sqr/lovesite/master/docs/boo.pdf" | head -1
```

Then, in the GitHub UI, search history for `journal.pdf` and confirm nothing remains. Finally,
open a GitHub Support request asking them to **purge cached views and any stale refs** for those
paths — force-pushing does not immediately evict their caches.

### Consider: make the repo private

Pages **can** serve a public site from a private repo on a paid plan. If `K-Sqr` has GitHub Pro,
flipping this repo to private is the single highest-value action here, because it retroactively
protects everything else — the RAG `chunks.json` (which contains health details, intimacy notes,
and wedding planning), the `COUPLE_QUESTIONS_TO_FILL.md` answers, and every future personal commit.

> **Look at `functions/knowledge/chunks.json` before you decide.** It has 48 chunks including
> `health_details`, `intimacy_attraction`, `spiritual_warfare`, and `wedding_planning`. That file
> is public right now too. It is arguably a bigger disclosure than the PDFs, because it is plain
> text and trivially searchable. The PDFs are the headline; `chunks.json` is the real problem.

**Decide explicitly and record the decision in `DOCS.md`:**

- **Private repo** → everything above is protected at once. Recommended if you have Pro.
- **Public repo** → then `chunks.json` must be moved out of the repo too (bundled at deploy time
  from a local file, or loaded from Storage by the function at cold start), and every future
  content addition needs a "is this okay to be public?" check. That is ongoing discipline you will
  not sustain. Prefer private.

## Step 5 — Private Storage prefix for letters

Add to `storage.rules` **above** the catch-all deny:

```
match /letters/{fileName} {
  allow read:   if request.auth != null
                && (request.auth.uid == 'owner' || request.auth.uid == 'tolu');
  allow create: if request.auth != null && request.auth.uid == 'owner'
                && request.resource.size < 25 * 1024 * 1024
                && request.resource.contentType == 'application/pdf';
  allow update, delete: if request.auth != null && request.auth.uid == 'owner';
}
```

Note what this does and does not do:

- ✅ Unauthenticated `GET` of the object path is **denied by Firebase**, server-side. Real security.
- ⚠️ `getDownloadURL()` returns a **long-lived tokenised URL that bypasses rules once issued.**
  Anyone with that URL can fetch the file. **Therefore: never persist a download URL in
  Firestore, in `src/data/`, or in a `localStorage` cache.** Fetch bytes with the authenticated
  SDK (`getBlob`) at view time and hold them only in memory as a `blob:` URL. `06-LETTERS.md`
  specifies this.

Deploy:

```bash
npx firebase-tools deploy --only storage
```

## Step 6 — A second identity for her

Today `functions/index.js` has one privileged identity:

```js
const OWNER_UID = process.env.OWNER_UID || 'owner';
```

and one secret, `OWNER_PASSCODE_HASH`. She currently cannot read anything private without your
owner passcode, which would also let her upload and delete.

Extend the `verify-passcode` branch to check the submitted passcode against **two** hashed secrets
and mint a token for whichever matches:

| Secret | UID minted | Capabilities |
| --- | --- | --- |
| `OWNER_PASSCODE_HASH` (exists) | `owner` | read + write letters, upload/delete memories |
| `READER_PASSCODE_HASH` (**new**) | `tolu` | read letters only |

Requirements:

- Keep the existing normalisation exactly as-is (`passcode.trim().toLowerCase()` → SHA-256 hex) so
  the current owner passcode keeps working. Do not change the hashing.
- Compare against both hashes and return `{ token, role }` so the client can adapt the UI.
- If neither matches, return the same generic `401 { error: 'Unauthorized.' }`. **Do not** reveal
  which passcode was closer, and do not vary the response shape or timing per branch.
- Register the new secret in the function's `secrets: [...]` array.
- Add both UIDs to the `letters/` read rule (done in Step 5).

Set the secret — generate the hash locally so the plaintext never reaches a log or your shell
history file:

```bash
# choose her passcode, then:
node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1].trim().toLowerCase()).digest('hex'))" 'HER PASSCODE HERE'

npx firebase-tools functions:secrets:set READER_PASSCODE_HASH   # paste the hash at the prompt
npx firebase-tools deploy --only functions
```

Then clear the plaintext from your shell history.

In `src/modules/auth.js`, return and expose the `role` from the response so `06-LETTERS.md` can
show upload controls to `owner` only. Keep `browserSessionPersistence`. Do not add a "remember me".

---

## Privacy / security notes

- **Never write a passcode, or the period-tracker passphrase, into any file in this repository** —
  not source, not docs, not a comment, not a test fixture, not a prompt file. Hashes only, and only
  in Firebase secrets.
- The **period tracker passphrase is out of scope here.** It is not a Firebase secret and must
  never become one. It never leaves her device. See `09-PERIOD-TRACKER.md`.
- Frontend route guards, hidden pages, and unlisted URLs are **not** security. The only real
  boundary in this architecture is a Firebase security rule evaluated server-side against an
  authenticated UID. Everything else is a curtain.

---

## Acceptance criteria

1. `curl -sI https://raw.githubusercontent.com/K-Sqr/lovesite/master/docs/boo.pdf` → **404**.
2. Same for `journal.pdf` and `Happy%20180%20days.pdf`.
3. `git log --all --diff-filter=D --name-only | grep -i '\.pdf'` finds no trace, and
   `git log --all --oneline -- 'docs/*.pdf'` is empty.
4. Cloning the repo fresh into a temp dir produces **no** PDFs and a repo materially smaller than
   before (the 13.4 MB blob is gone).
5. An anonymous, signed-out `fetch` of a `letters/` object path is **denied**.
6. Signing in with the owner passcode yields `role: 'owner'`; with her passcode, `role: 'tolu'`;
   with a wrong passcode, a generic 401.
7. `npm run build` still succeeds and all four existing pages work — you have not touched the
   frontend beyond `auth.js`.
8. A decision about repo visibility (and, if staying public, about `chunks.json`) is written down
   in `DOCS.md`.

## Verification

```bash
# History is clean
git log --all --oneline -- 'docs/*.pdf'          # → empty
git count-objects -vH                            # size-pack should have dropped ~13MB

# Public access is gone
for f in boo.pdf journal.pdf "Happy%20180%20days.pdf"; do
  curl -so /dev/null -w "$f %{http_code}\n" \
    "https://raw.githubusercontent.com/K-Sqr/lovesite/master/docs/$f"
done

# Rules deployed
npx firebase-tools deploy --only storage
```

Manual: in a **logged-out incognito window**, open the Firebase Storage object URL for a test file
under `letters/` and confirm a permission error. Then sign in on the site with each passcode and
confirm the correct `role` comes back.

## Definition of done

- [ ] PDFs moved outside the repo and verified openable
- [ ] `.gitignore` blocks `*.pdf` while allowing `docs/anniversary/**`
- [ ] History rewritten with `git filter-repo`, force-pushed, backup retained
- [ ] All three raw URLs return 404
- [ ] GitHub Support asked to purge cached views
- [ ] Repo-visibility decision made and recorded; `chunks.json` handled accordingly
- [ ] `storage.rules` has a `letters/` block with read limited to `owner` + `tolu`
- [ ] `READER_PASSCODE_HASH` secret set; function returns `{ token, role }`
- [ ] `auth.js` exposes `role`; session persistence unchanged
- [ ] Stale `DOCS.md` security claims corrected (it documents a `passcodeHash` Firestore field that
      is never written, and client-side SHA-256 auth that is now server-side)
- [ ] You have told her
