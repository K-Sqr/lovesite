# Timeline Content — Structured Authoring Sheet

> Built from `timeline rough sheet.md` (your notes), reconciled against the 18 entries already in
> `src/data/milestones.js`.
>
> **Purpose:** so the agent implementing `05-TIMELINE.md` never has to invent, infer, or "fill in"
> a single detail. It transcribes this table into `src/data/timeline.js` and stops.
>
> **Your job before running the timeline batch:** resolve every 🔴 and write the `description`
> lines marked ✍️. Everything else is ready.

---

## Conventions

- `id` — stable slug, never changes once shipped (anchors and reminders may reference it).
- `date` — ISO `YYYY-MM-DD`, sortable. `dateDisplay` only when you want something other than the
  default format (e.g. showing a time).
- `featured: true` — appears in the **homepage preview**. You said: *"the main page milestone should
  be simple and the milestone page would flesh things out in more detail."* So `featured` is your
  main list; the full timeline page shows everything.
- `type` — `milestone | trip | anniversary | letter | conversation | funny | event | memory`
- ✍️ = you write the `description`. 🔴 = a question you must answer first.

---

## 🔴 Decisions needed before authoring

| # | Question | Why it matters |
| --- | --- | --- |
| 1 | **Aug 15 or Aug 19, 2025** for "she gave me the good traits she sees in me + questions to answer"? Your sheet says Aug 15 in the bulleted list and Aug 19 in the prose. | It's the first entry in the whole story. |
| 2 | **The love journal: ~50 or 54 pages, and documenting since Aug 18 or Aug 19?** Your sheet says "~50 pages, since August 19"; the existing entry says "54-page, since August 18". | Existing text may be wrong; the journal itself settles it. |
| 3 | **Jul 9, 2026 — "went to the gym and pumped iron together for the first time and had a massage"** — massage, or a message (a sermon/word)? | Changes the sentence entirely. |
| 4 | **Dec 25, 2025 + Jan 1, 2026 vs the existing Dec 31, 2025 "New Year's Eve Together" entry.** Keep all three, or fold Dec 31 into Jan 1? | Avoids two near-identical entries three days apart. |
| 5 | **Dates for the four undated items** in §4 below. | They can't be placed without dates. |
| 6 | **Your `featured` picks for Mar–Sep 2026.** I've marked proposals as `featured: PROPOSED`. | You chose the 2025 list explicitly; you didn't choose these. |
| 7 | **Sinmi / Sinam** and **Ibukun** — spelling, and relationship to each of you. Also **Resiliak** and **Rapha** spelling. | Names must be right. |
| 8 | Anything here that is **too private for a public repo.** See the warning at the bottom. | Some of these are quite personal. |

---

## 1. Entries that already exist — keep, migrate as-is

These 18 are in `src/data/milestones.js` and already have written descriptions. The agent migrates
them to the new schema **without rewriting the prose.** Only `id`, `date` (ISO), `type`, and
`featured` are added.

| id | date | title | featured |
| --- | --- | --- | --- |
| `confession` | 2025-08-18 | The Confession | ✅ |
| `prophetic-encounter` | 2025-08-23 | The Prophetic Encounter | |
| `gods-confirmation` | 2025-09-01 | God's Confirmation | |
| `falling-in-love` | 2025-09-11 | "I'm Falling In Love With You" | |
| `she-said-yes` | 2025-09-13 | She Said Yes | ✅ |
| `first-virtual-date` | 2025-09-20 | First Virtual Date | ✅ |
| `first-love-letter` | 2025-10-02 | First Love Letter | |
| `first-storm` | 2025-10-18 | First Storm, Stronger Together | |
| `her-24th-birthday` | 2025-10-26 | Her 24th Birthday | ✅ |
| `his-23rd-birthday` | 2025-11-14 | His 23rd Birthday | ✅ |
| `love-journal` | 2025-11-14 | The Love Journal | ✅ |
| `hymns-and-healing` | 2025-11-26 | Hymns & Healing | |
| `first-good-dream` | 2025-12-04 | Her First Good Dream | |
| `three-months` | 2025-12-13 | Three Months | |
| `new-years-eve` | 2025-12-31 | New Year's Eve Together | 🔴 see decision 4 |
| `touchdown-winnipeg` | 2026-02-09 | Touchdown Winnipeg | ✅ |
| `first-in-person-date` | 2026-02-14 | First In-Person Date | ✅ |
| `six-months` | 2026-03-13 | Six Months — Happy 180 Days | ✅ |

**Two amendments to existing prose**, from your sheet:

- `confession` — add the time **12:12am, Sunday into Monday**. Existing text already says
  "Sunday to Monday, 12:12am", so verify rather than duplicate.
- `she-said-yes` — add **2am**. Existing text does not mention the time.
- `love-journal` — reconcile page count and start date per decision 2.

---

## 2. New entries — 2025

| id | date | title | featured | type | notes for the description |
| --- | --- | --- | --- | --- | --- |
| `her-questions` | 2025-08-19 | ✍️ *(suggest: "The Questions")* | | conversation | ✍️ She told him the good traits she saw in him, and gave him questions about himself to answer and come back with. |
| `she-prays-on-it` | after 08-18-20 | ✍️ | | conversation | ✍️ She went to pray about it and came back with her concerns. **If you can't date it, fold it into `confession`'s `expandedBody` rather than inventing a date.** |
| `first-girlfriend-gifts` | 2025-09-19 | ✍️ *(suggest: "First Gifts")* | | memory | ✍️ Striped pink PJs, a comfy pillowcase, and earplugs. |
| `first-christmas` | 2025-12-25 | First Christmas Together | ✅ | event | ✍️ Virtual. Your own line: *"Celebrating with you made everything warmer."* |
| `new-year-same-us` | 2026-01-01 | New Year, Same Us | ✅ | anniversary | ✍️ "Started a new year with my lover by my side. Best resolution ever."  |

---

## 3. New entries — 2026 (the gap: Feb → Sep)

### Feb–Mar

| id | date | title | featured | type | notes |
| --- | --- | --- | --- | --- | --- |
| `meeting-peace` | 2026-02-11 | ✍️ | ❌ detail-only | memory | ✍️ Met her best friend Peace. You marked this detail-page-only. |
| `first-shopping-together` | 2026-02-12 | ✍️ | ❌ detail-only | memory | ✍️ First time shopping together; she bought him "spectacular jackets". |
| `meeting-her-pastor` | 2026-02-12 | ✍️ | ❌ detail-only | event | ✍️ Went to see her pastor at his house. |
| `she-became-an-aunt` | 2026-03-12 | ✍️ *(suggest: "She Became an Aunt")* | PROPOSED ✅ | event | ✍️ Jayden was born. **Note: one day before your six-month anniversary.** |

|`Our six months anniversary`2026-03-12 | I made this site, and we celebrated together
### Apr–Jun

| id | date | title | featured | type | notes |
| --- | --- | --- | --- | --- | --- |
| `student-success-story` | 2026-05-07 | ✍️ | PROPOSED ✅ | milestone | ✍️ She was featured on her school's website as one of their student success stories. |
| `his-graduation` | 2026-05-25 | ✍️ | PROPOSED ✅ | milestone | ✍️ Celebrated his college graduation. |
| `her-graduation` | 2026-06-11 | ✍️ *(suggest: "Bachelor of Arts, Honours")* | PROPOSED ✅ | milestone | ✍️ **BA in Psychology (Honours), Minor in English.** Probably the biggest entry of the six months — give it room and consider `photos`. |
| `"Rapha — The Immersive Experience` | 2026-06-21 | ✍️ *(suggest: "Rapha — The Immersive Experience")* | PROPOSED ✅ | event | ✍️  confirm spelling. Your sheet "two God-sent projects and events we partnered and delivered."* |
| `Rapha — The Exhibition` | 2026-06-24 | ✍️ *(suggest: "Rapha — The Exhibition")* | | event | ✍️ |

### Jul–Aug

| id | date | title | featured | type | notes |
| --- | --- | --- | --- | --- | --- |
| `throne-of-glass` | 2026-07-06 | ✍️ | | memory | ✍️ She got her hands on *Throne of Glass* — her graduation gift. |
| `first-gym-together` | 2026-07-09 | ✍️ | | funny | ✍️ First time at the gym together, pumping iron. And then after we had massage  |
| `ten-months` | 2026-07-13 | Ten Months | | anniversary | ✍️ |
| `hosting-ibukun` | 2026-07-25 | ✍️ | | memory | ✍️ She hosted his Ibukun; they had a stellar conversation. Ibukun is my suster |
| `blood-types-compatible` | 2026-08-03 | ✍️ | PROPOSED ✅ | milestone | ✍️ Blood tests — compatible types. Reads as a quiet, forward-looking entry. |
| `his-new-job` | 2026-08-10 | ✍️ | PROPOSED ✅ | milestone | ✍️ Celebrated him starting his new job. |
| `her-first-interview` | 2026-08-25 | ✍️ | | milestone | ✍️ Her first job interview, with the University of Manitoba. **Cross-reference: this is the one interview mentioned in `07-JOB-APPLICATION-STUDIO.md`.** |
| `internship-complete` | 2026-08-27 | ✍️ | | milestone | ✍️ She concluded her internship at Resilia.|

### Sep — the run-up to one year

| id | date | title | featured | type | notes |
| --- | --- | --- | --- | --- | --- |
| `his-first-car` | 2026-09-01 | ✍️ | PROPOSED ✅ | milestone | ✍️ Celebrated his first car. |
| `touchdown-toronto` | 2026-09-04 | Touchdown Toronto | ✅ | trip | ✍️ Deliberately echoes `touchdown-winnipeg` — lovely bookend, keep the parallel title. Use `location`. |
| `meeting-Sinam` | 🔴 undated (during the Toronto trip) | ✍️ | | memory | ✍️ She met "our lovely prince" Sinam in Toronto and stayed with Itunu. 🔴 spellings. **Consider making this `expandedBody` on `touchdown-toronto` instead of a separate entry.** |
| `one-year` | **2026-09-13** | **One Year** | ✅ | anniversary | ✍️ *(your draft, cleaned:)* "To the one that holds my heart — happy anniversary, baby girl. I love you. One year with the one; how wonderful." ✅ cleared to publish, see §7. Fires the celebration in `05-TIMELINE.md` R7b. `12-ANNIVERSARY-EXPERIENCE.md` reads this entry. |

---

## 4. 🔴 Undated — needs a date before it can be placed

From the end of your sheet. Do not let an agent guess these.

| Item | Likely window |
| --- | --- |
| She finished conducting her research experiments **in record time** | Before the thesis defence, so ~Mar–Apr 2026 |
| She **defended her thesis** | Before Jun 11 graduation, so ~Apr–May 2026 |
| She **composed and directed a song** with Anu, Testimony and Stephen | June 17 |
| **Second in-person date** at Boston Pizza | July 4tth |

If a date genuinely cannot be recovered, the honest options are a month-level `date` with
`dateDisplay: 'June 2026'`, or folding it into a neighbouring entry's `expandedBody`. **Do not
invent a specific day** — a wrong date in a timeline of your own relationship is worse than a vague
one.

---

## 5. Counts, for the acceptance criteria in `05-TIMELINE.md`

| | Count |
| --- | --- |
| Existing entries migrated | 18 |
| New 2025 entries | 5 |
| New 2026 entries | 21 |
| **Total** | **~44** (before the 4 undated ones land) |
| `featured` — confirmed by you | 11 |
| `featured` — proposed, pending decision 6 | 8 |

Two consequences worth deciding now:

1. **The homepage preview currently shows 5 entries.** Your confirmed `featured` list is 11, and
   could reach 19. Eleven cards on the homepage stops being "simple". Recommendation: keep
   `featured` as the full curated set for the timeline page's emphasis treatment, and have the
   **homepage take the first N featured entries (5 or 6) plus the most recent one**, then
   "View full timeline →". That keeps your "main page simple" instruction true as the list grows.
2. **44 entries across 13 months needs the year/chapter grouping** specified in `05-TIMELINE.md`.
   A flat 44-card rail is a list; grouped by year with sticky headings, it reads as a story.

---

## 6. ⚠️ Before you commit any of this

`src/data/timeline.js` is imported by `src/**`, so **Vite inlines it into `dist/assets/*.js`, which
is published to the public Pages site.** Repo visibility does not change that (see
`01-REPOSITORY-AUDIT.md` §7). So every word here becomes permanently public the first time you
deploy.

Read back through with that in mind. Most of it is lovely and harmless. A few things are more
personal than the rest — the blood-test entry, the panic attack in the existing `hymns-and-healing`
entry, her family details, and other people's full names (Peace, Jayden, Ibukun, Sinmi, Itunu,
Anu, Testimony, Stephen). **Those are other people's private information, and they did not agree to
be on a public website.**

Practical suggestion: first names only for third parties, and for anything you want to keep between
the two of you, put it in a **letter** (`06-LETTERS.md`, served from private Storage) rather than a
timeline entry. The timeline is the public-facing story; the letters are the private one. That split
is worth using deliberately.

---

## 7. ✅ Resolved — the `one-year` entry is safe to publish

There was a collision: the closing line of the `one-year` draft was also the Rhythm unlock
passphrase, which would have published AES-GCM key material in plain text on the same public origin
as the ciphertext it unlocks.

**The owner changed the passphrase instead of cutting the line.** The entry text is now unremarkable
from a security standpoint and can ship as written.

The new passphrase is deliberately recorded **nowhere** — not here, not in `09-PERIOD-TRACKER.md`,
not in source, not in a comment. `09` takes it from the owner at runtime and stores no verification
hash. If you find a literal passphrase written down anywhere in this repository, that is a bug: stop
and report it.

**Standing rule for this file:** timeline entries are published verbatim to a public site. Never put
a passphrase, passcode, key, token, address, or phone number in one, however good the sentence is.

Two small copy fixes still outstanding in the `one-year` row: "Anniverary" → "Anniversary", and the
sentence lost its closing punctuation where it ran into the note text.
