# TODAY — the one-hour anniversary ship

> **It is Sep 13, 2026. The anniversary is today.** This file replaces `RUN-SHEETS.md` for the next
> hour. Go back to that file tomorrow.

---

## Why the full plan does not fit in an hour

Not close, and the reason is worth knowing so you spend the hour on the right thing.

**Batch 1 alone is the wrong bet today.** Foundations (`02` + `04`) is the largest batch and it
rewrites the nav in all four working pages, adds a crypto module, and swaps the scroll-reveal system.
It is 30–60 minutes of agent time and it is the single highest regression risk in the plan. If it
breaks the proposal page at 8pm tonight, you have no anniversary site at all. **Everything else
depends on it**, which is exactly why it cannot be rushed.

**Five of the six tools are empty on day one.** An empty period tracker, an empty closet, an empty
people list, an empty application tracker — these are gifts of *capability*, and capability doesn't
unwrap. Handing her an empty wardrobe manager tonight reads as a chore assigned, not a gift given.
They become good after data goes in, which is a next-weekend job with her in the room.

**The real bottleneck is your writing, not agent time.** Roughly 25 timeline descriptions, metadata
for 11 letters, the anniversary page copy, the People message templates, the outfit explanation
lines. No model can do that part, and it is the part that makes the whole thing land.

So: **2–3 focused days for the full set.** Tonight, ship the one thing that is already full of
content and cannot be faked — the story.

---

## 🔴 Fix this regardless of everything else

Your homepage counter is wrong **right now, today, on the anniversary.**

```
START_DATE = Sep 13 2025 · today = Sep 13 2026
days   = 365
months = Math.floor(365 / 30.44) = 11
days   = 365 - Math.floor(11 * 30.44) = 365 - 334 = 31
```

It reads **"In love for 11 months · 31 days."** The timeline stats card says **"11 months"**. There is
no years unit in the component at all. If you do nothing else in this hour, do this.

---

## The plan — 60 minutes

| Time | Who | What |
| --- | --- | --- |
| 0:00–0:03 | you | 60-second privacy call below, then paste the prompt |
| 0:03–0:35 | agent | counter fix → timeline entries → fireworks, committing after each |
| 0:35–0:50 | you | review the diff, rewrite the one-year description in your own words |
| 0:50–0:57 | you | phone check, both themes |
| 0:57–1:00 | you | `npm run deploy` |

**Deliberately not in scope today:** the `02`/`04` foundations refactor, the timeline schema
migration, year chapters, the For You hub, letters, and all six tools. Today's change is *additive*
to the files that already work. Nothing that currently works can break.

### 60-second privacy call, before you paste

Deploying publishes the timeline permanently. Two things to decide now, not at 0:50:

1. **Other people's names** — Peace, Jayden, Ibukun, Itunu, Sinam, Anu, Testimony, Stephen. First
   names only, no surnames, and nothing about them beyond the fact they were there. They did not
   agree to be on a public website.
2. **The blood-test entry (Aug 3).** Compatible blood types is medical information about both of you
   on a public page. It is a lovely entry. My call: **put it in a letter instead, not the timeline.**
   Decide now — keep or cut.

---

## The prompt — paste this whole thing into Claude Code

**Model: the strongest one you have.** This is one shot with no time to redo it.

```
Read these two files completely before you touch anything:
  docs/anniversary/01-REPOSITORY-AUDIT.md   (how this repo works)
  timeline rough sheet.md                   (the owner's own notes — the ONLY content source)

CONTEXT: Today is Sep 13 2026 and it is the owner's one-year anniversary. He is shipping in
one hour. Scope is deliberately narrow and ADDITIVE. Do exactly these three steps, commit
after each, and do not refactor anything.

DO NOT execute docs/anniversary/02-DESIGN-SYSTEM.md, 04-SHARED-FOUNDATIONS.md, or
05-TIMELINE.md today. Do not create src/data/timeline.js. Do not create siteChrome.js,
storage.js, dates.js, or reveal.js. Do not touch the nav, the CSP, or vite.config.js. Do not
add a page. Do not add a dependency. Keep src/data/milestones.js in its CURRENT shape
({ date: 'Aug 18, 2025', title, description, icon } — string dates, no ids).

═══ STEP 1 — fix the counter (do this first, commit it alone) ═══

src/modules/loveCounter.js computes months as Math.floor(days / 30.44), has no years unit,
and therefore displays "11 months · 31 days" TODAY, on the one-year anniversary. This is the
most important line on the site tonight.

- Add a years unit and compute years/months/days with real calendar arithmetic (anniversary
  stepping), not division by 30.44.
- On Sep 13 2026 it must read "1 year". Zero-valued units are hidden, but never show nothing.
- Keep the live hrs/min/sec ticking and keep every existing class name
  (.counter-label, .counter-digits, .counter-unit, .counter-num, .counter-tag, .counter-sep)
  so src/styles/ styling is untouched.
- Nice touch, please add it: when today is the anniversary date itself, the label reads
  "One year today" instead of "In love for".
- Apply the same calendar fix to calculateStats() in src/timeline-page.js, which shows the
  same wrong "11 months". Keep the four .stat-card markup shape exactly as it is.
- Verify by temporarily faking the date to Sep 12, Sep 13, and Sep 14 2026, and to
  Mar 13 2026 (must read "6 months"). Report all four outputs to me.

═══ STEP 2 — fill the timeline to today (commit separately) ═══

src/data/milestones.js currently stops at Mar 13 2026. Six months of real events are
missing. Add them to BOTH arrays: every event goes in fullMilestones, and only the featured
subset listed below also goes in mainMilestones. The owner's instruction is that the home
page stays simple and the timeline page carries the detail.

ABSOLUTE RULE — READ TWICE: every description must use the owner's OWN WORDS from
"timeline rough sheet.md", transcribed or lightly tidied for grammar and punctuation ONLY.
Do not invent, embellish, dramatise, add adjectives, or write a single sentence of your own
about their relationship. His rough phrasing is better than your polished phrasing, because
it is his. If a line is terse, ship it terse. Fabricating a memory is the worst possible
failure here — she will read it, know it never happened, and every real entry becomes
suspect.

Add these, in date order, using his wording from the rough sheet:
  2025-09-19  first girlfriend gifts — striped pink PJs, comfy pillowcase, earplugs
  2025-12-25  first Christmas together, virtually
  2026-01-01  New Year, Same Us
  2026-02-11  met her best friend Peace
  2026-02-12  first time shopping together; she bought him jackets
  2026-02-12  went to see her pastor at his house
  2026-03-12  she became an aunt — Jayden was born
  2026-05-07  featured on her school website as a student success story
  2026-05-25  celebrated his college graduation
  2026-06-11  her graduation — BA Psychology (Honours), Minor in English
  2026-06-17  she composed and directed a song with Anu, Testimony and Stephen
  2026-06-21  Rapha, the immersive experience
  2026-06-24  Rapha, the exhibition
  2026-07-04  second in-person date, Boston Pizza
  2026-07-06  Throne of Glass, her graduation gift
  2026-07-09  first time at the gym together
  2026-07-13  ten months
  2026-07-25  she hosted his Ibukun; stellar conversation
  2026-08-03  blood tests, compatible blood types      ← SEE OWNER NOTE BELOW
  2026-08-10  celebrated him starting his new job
  2026-08-25  her first job interview, University of Manitoba
  2026-08-27  she concluded her internship at Resilia
  2026-09-01  celebrated his first car
  2026-09-04  Touchdown Toronto — fold in that she met Sinam and stayed with Itunu as part
              of THIS entry, not a separate one
  2026-09-13  ONE YEAR  ← see below

Match the existing style: date strings like 'Sep 19, 2025', one emoji icon per entry in the
same \u{...} escape form the file already uses, first names only for third parties.

The Sep 13 2026 one-year entry description, use exactly this and do not alter it:
  "To the one that holds my heart — happy anniversary, baby girl. I love you. One year with
   the one; how wonderful."

Also add to mainMilestones (home page) ONLY these three new ones, appended after the five
already there:  Jun 11 2026 her graduation,  Sep 4 2026 Touchdown Toronto,
Sep 13 2026 One Year.  That makes eight on the home page. Nothing else gets promoted.

DO NOT add, and do not ask me about: the Aug 15/19 2025 "questions" entry, the "she prays
about it" entry, her thesis defence, or her finishing her experiments. The owner has not
settled those. Leave the existing Nov 14 love-journal entry and the existing Dec 31
New Year's Eve entry EXACTLY as they are — do not edit, merge, or reword any of the 18
entries already in the file.

OWNER NOTE on the Aug 3 blood-test entry: include it only if the owner said "keep" — if he
has not told you, ASK before writing that one line, and write everything else meanwhile.

═══ STEP 3 — fireworks on the one-year entry (commit separately) ═══

Implement docs/anniversary/05-TIMELINE.md section R7b, and ONLY that section. Read it.
Summary of the constraints that matter:

- New file src/modules/celebrate.js. Hand-rolled following the src/modules/graffiti.js
  pattern already in this repo (positioned DOM spans, a CSS keyframe, removal on a timer).
  animations.css already has @keyframes sparkle-anim and .sparkle.warm — extend that
  vocabulary. NO confetti library. Zero new dependencies.
- There are no entry ids in the current data shape, so make the trigger robust rather than
  matching rendered text: in src/modules/timeline.js add ONE line inside the forEach —
  entry.dataset.date = m.date; — and key the celebration off [data-date="Sep 13, 2026"].
  That is the only change permitted to timeline.js today. Do not rewrite that module.
- It must fire on that entry ONLY — not on Six Months, not on Ten Months, not on New Year.
  One celebration, one moment.
- Fires ONCE per page load. Guard with a module flag AND a sessionStorage key so scrolling
  up and back down does not re-trigger it.
- pointer-events: none on the container and every particle.
- NEVER full-screen and never blocking: positioned relative to the entry, and she must be
  able to READ the entry while it plays. The words are the point; the confetti is the frame.
- No layout shift. Must not change the height of the rail.
- Full teardown: every element and timer gone when it ends, plus on tab-hide and unload.
- prefers-reduced-motion: reduce ⇒ ZERO particles created. Not fewer, none. Instead, a
  static gold-accented card treatment on that entry, with a quiet "One year." line above the
  title. BUILD THAT STATIC TREATMENT FIRST and confirm it stands on its own before writing a
  single particle — the confetti lasts three seconds, the card is there forever.
- Colours from existing CSS custom properties via getComputedStyle so dark mode works. Add
  ONE warm gold for this entry only; that gold is what makes it read as a milestone instead
  of more pink. Never hardcode a hex.
- ~90 particles on desktop, half that at max-width 600px. Animate transform/opacity only,
  never top/left/width/height. Append in one DocumentFragment.
- Restraint is what makes it feel expensive. A wedding sparkler, not a slot machine.

═══ WHEN DONE ═══

Run: npm run build
Report: the four counter outputs from step 1, the number of entries added, anything you had
to skip or ask about, and confirm package.json is unchanged.
```

---

## Your 15 minutes of review (0:35–0:50)

Do these in order and stop at the first failure.

```bash
git log --oneline -3          # three commits, one per step
git diff HEAD~3 --stat        # milestones.js, loveCounter.js, timeline-page.js, celebrate.js, css
git diff package.json         # MUST be empty
npm run dev
```

1. **The counter reads "1 year" / "One year today".** If it still says 11 months, nothing else
   matters — fix that and redeploy even if you drop everything else.
2. **Read every new description.** You are checking one thing: did it write anything you didn't say?
   Anything that sounds more polished than your notes is suspect. Delete it or rewrite it.
3. **Rewrite the one-year description in your own words.** The version in the prompt is a cleanup of
   your draft, not your writing. This is the single most-read sentence on the site tonight and it
   should be yours. Ten minutes here beats everything else in this file.
4. **Scroll to the one-year entry.** Fireworks fire once, you can still read the words through them,
   and nothing jumps.
5. **DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`.** Reload. Zero particles, gold
   card still looks intentional.
6. **Phone, both themes.** Home page and timeline, top to bottom.

## Ship

```bash
npm run build && ls dist/*.html          # index, timeline, memories, lovegpt — and NO letters/
npm run deploy
```

`letters-source/` is gitignored and outside `public/`, so no letters go out. Verify the `ls` anyway.

---

## Tomorrow, in this order

1. `RUN-SHEETS.md` Batch 1 — foundations. Unrushed, with the review it deserves.
2. Batch 2 — the real `05-TIMELINE.md`: schema migration, year chapters, expandable entries, photos,
   and the No-button fix. Today's additive entries port straight across.
3. `03-SECURITY-REMEDIATION.md` by hand, then letters. **`docs/*.pdf` are still tracked in a public
   repo** — that is unchanged by today and still needs doing.
4. Then the tools, one weekend afternoon each, ideally with her there to fill the first few items in.

Today's work is not a throwaway prototype. The entries, the counter fix, and `celebrate.js` are all
things the real plan keeps.
