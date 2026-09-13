# 08 — People

**Recommended tool:** Claude Code. One page, three cooperating parts (people list, low-energy
filter, message templates), one data layer, and a lot of copy that has to sound human — best done
in a single coherent pass rather than incremental edits that let the tone drift.
**Model:** a strong reasoning model. The hard part of this feature is *what not to build* and how
every string is worded. The DOM work is easy; the restraint is not.

---

## Context

She cares about people. She is also introverted, and the failure mode is always the same shape: she
thinks of someone and means to reach out (1), life happens and she doesn't (2), time passes and it
now feels like it's *been too long* (3), so reaching out would require an explanation, which
requires energy (4), and she has no social energy (5), so she puts it off (6) — and repeats, with
the weight increasing each round.

**Step 3 is where every existing app makes it worse.** Relationship CRMs and "keep in touch" tools
solve this by counting: "47 days since you talked to Mom", "3 contacts overdue", a red badge. That
is not a reminder, it is an invoice. For someone already avoiding the thing because it feels heavy,
adding a number makes the avoidance rational.

> **CORE PRINCIPLE: do not build a guilt machine.**

The project principle — *reduce mental load, don't create another app she has to maintain* — is
sharper here than anywhere else. A field she has to keep current is a debt, and a feature that only
works when she updates it diligently will not work at all. The quality bar: she should look at this
and think *"You made this because you noticed I do that?"* — not *"he built me a dashboard."*

## Objective

Build `people.html`, nav label **"People"** — a warm, phone-first page that does three things:

1. Shows the people she cares about in **gentle** states, so she can see who she might like to say
   hi to without ever being told she has failed anyone.
2. **Low-Energy Mode** — a transient filter that adapts what the page suggests to how much she has
   in the tank right now. This is the key differentiator.
3. **Quick-copy message templates** — real, human-sounding starter texts, so "I don't know what to
   say" stops being the blocker.

Plus two first-class actions on every person: **Said hi** and **Snooze**, equal weight, both
legitimate.

## Prerequisites

- `01-REPOSITORY-AUDIT.md` read.
- `02-DESIGN-SYSTEM.md` complete — `src/styles/ui.css` exists with the `.usm-*` primitives and the
  `--tone-*` / `--space-*` / `--surface-sunken` / `--border-subtle` tokens.
- `04-SHARED-FOUNDATIONS.md` complete — `src/modules/siteChrome.js`, `storage.js`, `reveal.js`,
  `dates.js` exist, and `foryou.html` has a 🫶 People card carrying `data-coming-soon`.
- Read `docs/anniversary/PAGE-CHECKLIST.md` and follow it. Step 2 is the one people forget.
- **Read `formatRelativeGentle()` in `src/modules/dates.js` before writing any copy.** Its contract
  from `04` is that it never returns a count of days overdue, never "X days late", never a
  negative-sounding phrase. That function is the tone of this entire feature in one place.

## Existing Files To Inspect

| File | Why |
| --- | --- |
| `src/memories.js` | Page-entry pattern: CSS imports at top, everything inside `DOMContentLoaded`, state in module-scoped `let`. Copy this shape. |
| `src/modules/memoriesGallery.js` | `renderMemoryCard()` is the house card-builder — `createElement` + `textContent`, never `innerHTML` for data. Your person row mirrors it exactly; names and notes are user text. |
| `src/styles/memories.css` | `.upload-panel` / `.active`, header layout, `.memories-empty`, the single `@media (max-width: 600px)` block. |
| `src/styles/base.css` | The token list. Nothing outside it may be hardcoded. |
| `src/modules/storage.js`, `src/modules/dates.js` | The `createStore` contract, and `parseISO` / `toISO` / `addDays` / `formatRelativeGentle`. |
| `src/modules/auth.js` | Read only to confirm you are **not** using it. No passcode on this page. |
| `vite.config.js`, `memories.html` | The `rollupOptions.input` map to extend; the `<head>` to copy verbatim. |

## Files You Own (Create)

```
people.html                        page shell (repo root)
src/people.js                      page entry
src/styles/people.css              page styles
src/data/messageTemplates.js       the default starter messages (R4)
src/modules/peopleStore.js         domain layer over createStore: CRUD, states, ordering, seam
```

## Files You May Modify

```
vite.config.js      add exactly one input entry: people
src/foryou.js       remove data-coming-soon from the People card only
DOCS.md             one paragraph: the page, its two store keys, its data shapes
```

## Files You Must Not Touch

`applications.html`, `src/applications.js`, `src/styles/applications.css`,
`src/modules/applicationsStore.js`, `src/data/promptTemplates.js` — **owned by
`07-JOB-APPLICATION-STUDIO.md`, which may be running in parallel.**

Also off limits: `src/modules/storage.js`, `dates.js`, `reveal.js`, `siteChrome.js` (foundations —
if one is wrong, report it, do not patch it here) ·
`src/styles/{base,ui,sections,animations,memories,timeline-page,lovegpt}.css` · `index.html`,
`timeline.html`, `memories.html`, `lovegpt.html`, `foryou.html` ·
`src/{main,timeline-page,memories,lovegpt}.js` · `src/data/{milestones,verses,noTexts}.js` ·
`src/modules/firebase.js` and everything importing it · `functions/**` (especially
`functions/knowledge/chunks.json`) · `firestore.rules` · `storage.rules` · `package.json`.

Also, when they exist: `letters.html`, `rhythm.html`, `outfit.html` and their `src/*.js` /
`src/styles/*.css` counterparts, owned by `06`, `09`, and `10` respectively. Do not create them here.

## Requirements

### R1 — Page shell and registration

Per `PAGE-CHECKLIST.md`: `people.html` at repo root with the `<head>` copied verbatim from
`memories.html`; body holds `<nav id="siteNav"></nav>`, the page container, and the music mount.
`src/people.js` imports `base.css`, `ui.css`, `people.css`, then calls
`initSiteChrome({ active: 'foryou' })` and `initReveal()`.

**Add `people: resolve(__dirname, 'people.html')` to `rollupOptions.input` in `vite.config.js` in
the same commit as the HTML file.** The audit is blunt: forgetting it means the page works in
`npm run dev` and silently 404s in production.

Layout, top to bottom: page `h1` "People" and one sentence in `--font-display`; the energy selector;
the people list; a **Messages** disclosure holding the templates; an **Add someone** action.

### R2 — Person record

```js
// usm.people.v1 → { v: 1, updatedAt: <ISO>, data: { items: [...] } }
{
  id: 'per_k3n8v',                   // crypto.randomUUID() or a short random id
  name: 'Tinu',
  relationship: 'Sister',            // free text, not an enum — "church friend" is a real answer
  lastContactAt: '2026-08-30',       // date-only ISO, or null if she's never logged one
  preferredCadence: 'none',          // 'weekly' | 'few-weeks' | 'monthly' | 'seasonally' | 'none'
  birthday: { month: 4, day: 17, year: null },   // year OPTIONAL and usually absent
  importantDates: [                  // small, optional
    { label: "Her mum's anniversary", month: 11, day: 2 },
  ],
  notes: '',                         // private third-party personal data — see Privacy
  isSnoozedUntil: null,              // date-only ISO; while set, the person is quietly parked
  energyCost: 'low',                 // 'low' | 'medium' | 'high' | null — quiet, private
  createdAt: '2026-09-13T18:04:00.000Z',
  updatedAt: '2026-09-13T18:04:00.000Z',
}
```

Every field has to earn its place:

- `preferredCadence` includes **`'none'` ("no schedule")** and that must be genuinely first-class,
  not a fallback. Some people you just think about when you think about them. **Default a new person
  to `'none'`**, never to `'monthly'` — do not make her opt out of a schedule.
- `birthday` may be **month + day with no year.** Nobody remembers the year, and asking makes the
  form feel like a database. Never compute or display an age.
- `energyCost` is the quiet field powering Low-Energy Mode. Label it *"How much does reaching out to
  them take?"* with options **Easy · Some · A lot** and a "prefer not to say" default of `null`. It
  is never a badge on the row and is never shown to anyone. Do not use the word "cost" in the UI.
- `importantDates` is optional and capped at a handful. If it starts feeling like a calendar, cut it.
- **No fields for** phone, email, address, photo, social handles, "relationship strength", contact
  history, or a log of past conversations. All of that is maintenance debt, and her phone's contacts
  app already holds the ones that matter.

### R3 — States, and the states we refuse to build

Derive state in one pure, commented function in `peopleStore.js` from `lastContactAt`,
`preferredCadence`, `birthday`, and `isSnoozedUntil`. **Exactly these states:**

| State | Meaning | Tone token |
| --- | --- | --- |
| **Recently caught up** | Well inside her cadence | `--tone-calm` |
| **Might be nice soon** | Approaching her cadence | `--tone-soon` |
| **It's been a little while** | Past her cadence, by any amount | `--tone-waiting` |
| **Birthday coming up** | Within ~2 weeks; outranks the others | `--tone-warm` |
| **Snoozed** | `isSnoozedUntil` is in the future | `--tone-quiet` |

**There is no "overdue" state, and nothing exists beyond "It's been a little while."** A person she
hasn't spoken to in three years and a person she hasn't spoken to in five weeks land in the same
state, with the same words and the same colour. That is deliberate: the escalation is exactly what
creates the dread. Put that reasoning in a comment in the state function so nobody "improves" it
later by adding a fourth tier.

Relative time on a row comes **only** from `formatRelativeGentle()`. Do not format dates yourself,
do not compute a day count for display, and do not pass a day count into any string.

**Explicitly forbidden, in code and copy:** the word "overdue" · red badges or dots ·
notification-style unread counts · streaks · "you haven't talked to X in 47 days" · a count of
missed check-ins · a "neglected" / "at risk" / "going cold" filter · a health score or percentage ·
any number rendered larger than body text · anything that makes a glance at the page feel like
arriving at a pile of unanswered messages.

**Ordering** is by gentle relevance: Birthday coming up → It's been a little while → Might be nice
soon → Recently caught up, and within each group by `lastContactAt` ascending. Snoozed people
collapse behind a quiet **"Parked for now (3)"** disclosure — that count is fine, because it
describes a choice she made rather than a failure.

### R4 — Quick-copy message templates (required)

This unblocks step 4 of her loop. When it's been a little while, the hardest part is the first
sentence, so give her the first sentence. Six categories, each with two or three starters. Ship
these actual words in `src/data/messageTemplates.js` — they are drafted, not placeholders:

```js
// src/data/messageTemplates.js
// These have to sound like a person texting, not like a product.
// Rules for anything added here:
//   - contractions, lowercase where natural, at most one emoji
//   - no "I hope this message finds you well", no "reaching out", no "circling back"
//   - no em-dash-heavy corporate warmth, no enthusiasm she doesn't feel
//   - it must be sendable AS-IS, with no editing, on her worst day
// {name} is interpolated. Every template must still read correctly if {name} is missing.
export const defaultMessageTemplates = [
  {
    id: 'thinking',
    category: 'Thinking of you',
    items: [
      'Hey \u2764\uFE0F just thinking about you. Hope you\u2019re doing okay.',
      'You popped into my head today and I wanted you to know.',
      '{name} hi! no reason, just thought of you.',
    ],
  },
  {
    id: 'been-a-while',
    category: 'Haven\u2019t talked in a while',
    items: [
      'Hey {name}! it\u2019s been a minute. how have you been?',
      'I know it\u2019s been a while but I still think about you often \u2764\uFE0F',
      'Hi {name} \u2014 not letting more time go by without saying hi.',
    ],
  },
  {
    id: 'busy-but-caring',
    category: 'Busy but caring',
    items: [
      'Life has been a lot lately but you\u2019ve been on my mind.',
      'Hey {name}, I\u2019m swamped right now so this is a drive-by hello. Love you.',
      'Can\u2019t talk properly yet but I didn\u2019t want to wait to say hi.',
    ],
  },
  {
    id: 'low-energy',
    category: 'Very low energy',
    items: [
      'Hey \u2764\uFE0F no need for a whole conversation, just wanted you to know I\u2019m thinking about you.',
      'hi {name} \u2764\uFE0F',
      'Low battery today but sending you love.',
    ],
  },
  {
    id: 'birthday',
    category: 'Birthday',
    items: [
      'Happy birthday {name} \u2764\uFE0F I hope today is gentle and good to you.',
      'Happy birthday! so glad you were born.',
    ],
  },
  {
    id: 'after-hard',
    category: 'Checking in after something hard',
    items: [
      'Hey {name}, just checking in. No need to reply if you\u2019re not up to it.',
      'Thinking about you today. I\u2019m here whenever you want to talk, or not talk.',
      'How are you doing, really?',
    ],
  },
];
```

Requirements:

- **One-tap copy with a visible confirmation.** `navigator.clipboard.writeText(text)`; on rejection
  or absent API fall back to a hidden `<textarea>` + `select()` + `document.execCommand('copy')`; if
  that also fails, select the text and say "Select all and copy — your browser blocked automatic
  copying." Confirmation: the chip briefly reads "Copied ✓" **and** a `role="status"` region
  announces "Copied." Never rely on the label change alone.
- **`{name}` interpolation.** Copying from a person's row substitutes their name; copying from the
  Messages section with nobody selected strips ` {name}` gracefully and the sentence must still read
  correctly — which is why each default above works either way. Test that.
- **She can add, edit, and delete her own templates**, stored in the same store as
  `customTemplates`, so the defaults stay in the data file and her changes are overrides or
  additions. An edited default gets an override entry plus "Reset to default".
- **Forbidden copy, in the defaults and anywhere the UI generates text:** "I hope this message finds
  you well" · "Just reaching out" · "Circling back" · "Touching base" · "I wanted to take a moment
  to" · em-dash-stacked sentimentality · three or more emoji in one message · anything that reads as
  AI-generated warmth. If a line sounds like a LinkedIn post, delete it.

### R5 — Low-Energy Mode (the key differentiator)

A four-way selector above the list: **Low · A little · Normal · Social today**. Four `.usm-pill`
buttons in a `role="radiogroup"`, 44px tall, full width on mobile.

- **Low** — show at most 3 people, drawn from `energyCost: 'low'` (and `null`) and preferring
  Birthday coming up / It's been a little while. The per-row primary action becomes **Copy a quick
  hello** using the "Very low energy" templates, the section line reads *"A quick hello counts."*,
  and everything else on the page collapses behind disclosures. **Never say "Call Mom" on Low.**
- **A little** — up to 6 people, `low` and `medium`, templates default to "Thinking of you".
- **Normal** — the full gentle-relevance list, no filtering.
- **Social today** — the full list with `high`-cost people surfaced *first*, and the copy shifts to
  invite real contact: *"Good day to call someone."*

Hard constraints, and state them in code comments too:

- **This must not read as a mood or mental-health assessment.** No "How are you feeling today?", no
  1–10 scale, no faces, no mood vocabulary beyond energy *for this task*. The label is *"How much
  social energy do you have right now?"* and nothing more clinical than that.
- **Do not persist an energy history.** The current selection lives in `sessionStorage` under
  `usm.people.energy` (session-scoped so it resets, which is the point) or in a module variable.
  **No array of past selections, no timestamps, no charts, no trends, no weekly summary, and no
  export of it.** It is a transient filter for the current session. If a future reader wants to
  graph it, the answer is no.
- The selector never changes a person's stored data. It is a view filter only.

### R6 — Actions: Said hi, and Snooze

Two primary actions per row at **equal visual weight** — not a primary button plus a small grey
link, but two buttons of the same size side by side. Snoozing is a legitimate choice and the UI has
to look like it believes that.

- **Said hi** — one tap. Sets `lastContactAt = today`, clears `isSnoozedUntil`, and the row moves to
  *Recently caught up* with a brief quiet confirmation ("Nice."). No modal, no "how did it go?"
  form, no logging what was said. One tap, done.
- **Snooze** — offers **Tomorrow · This weekend · Next week · Custom date**, sets `isSnoozedUntil`,
  and moves the person to "Parked for now". The framing line above the options, verbatim: *"I
  remembered, I just don't have the energy right now."*

Snooze rules: it is **never** a penalty or a deferral — it does not extend a counter, does not
change the person's state on return, does not accumulate ("snoozed 4 times"), and is not tracked.
When a snooze expires the person simply reappears in whatever state they were in, with no "snooze
ended" alert and no re-surfacing banner. Re-snoozing is fine and unremarked.

Secondary actions sit behind a `⋯` overflow (a bottom sheet on mobile): Edit, Copy a message,
Remove person (with confirmation).

### R7 — Reminder seam (do not implement the engine)

Birthdays, important dates, and cadence nudges emit reminder records for `11-NOTIFICATIONS.md`.
**Specify and consume the seam only: no scheduler, no permission prompt, no service worker.** The
page must be fully functional with notifications absent.

```js
// src/modules/reminders.js is OWNED BY 11-NOTIFICATIONS.md. Do not create it here.
let reminders = null;
try { reminders = await import('./modules/reminders.js'); }
catch { reminders = null; }   // not built yet; every call below becomes a no-op

// Emitted record — the id is stable and deterministic, so re-emitting REPLACES, never duplicates.
{
  id: `people:${person.id}:birthday`,
  source: 'people',
  kind: 'birthday' | 'checkin' | 'importantDate',
  dueAt: '2026-04-16T13:00:00.000Z',
  title: 'Tinu\u2019s birthday is tomorrow',
  body: 'A quick hello counts.',          // reminder copy obeys the same tone rules
  href: '/lovesite/people.html#per_k3n8v',
}
```

Wrap it locally once — `function emitReminder(rec) { reminders?.upsertReminder?.(rec); }` and
`function dropReminder(id) { reminders?.cancelReminder?.(id); }` — emitting on save and dropping on
snooze, on "Said hi", and on removal. **No reminder body may contain a day count or the word
"overdue".** Document the contract at the top of `peopleStore.js`.

## UX Requirements

**She will use this one-handed on a phone, often at night, often with very little left in the tank.**
That is the design constraint, not a nice-to-have:

- The energy selector and the per-row primary actions live in the **lower two-thirds** of the
  viewport. Nothing important requires a stretch to the top of the screen.
- Every tap target ≥44px; the two row actions are side-by-side thumb-sized buttons.
- **Low-Energy Mode must be usable in three taps or fewer, from page load to copied message**: tap
  "Low", tap a person's "Copy a quick hello", done. Time that path; if it takes more, cut something.
- One breakpoint, `@media (max-width: 600px)`. Below it: single column, full-bleed rows, and both
  the overflow menu and the snooze options become bottom sheets.
- `--font-display` (Dancing Script) for the `h1`, the intro sentence, empty-state lines, and the "A
  quick hello counts." line. `--font-body` (Inter) for names, relationships, dates, and every
  control. **No script type inside a data row.**
- `.reveal` + `data-delay="(i % 4) + 1"` on rows; `observeReveal(el)` for rows added later. All
  motion survives `prefers-reduced-motion: reduce`. `:focus-visible` rings everywhere.
- No hearts as scattered decoration, no gradients beyond the one primary button treatment, no extra
  `backdrop-filter`. The design system is already glassmorphic; adding more is the risk.

**First-run empty state — this matters enormously.** An empty People page is the first thing she
sees and it must feel like an invitation, not a chore. Use `.usm-empty` with one line in
`--font-display` — *"Nobody here yet. Who's been on your mind?"* — one plain sentence — *"Add a few
people you like thinking about. No schedules needed — this is just so you don't have to hold it all
in your head."* — and **one** button, **+ Add someone**. No "Import contacts", no wizard, no
suggested-people list. The add form shows **only name and relationship**, with cadence, birthday,
energy, and notes behind "Add a little more". **A person with just a name is a complete, valid
record.**

**Loading:** localStorage is synchronous, but first render happens after `DOMContentLoaded` — paint
`.usm-skeleton` rows for one frame rather than flashing the empty state at someone who has fifteen
people saved. Never show "Nobody here yet" before the store has been read. **Error:** if
`createStore` reports an in-memory fallback (Safari private mode, full quota), show one calm
`.usm-toast` — *"Saving isn't working in this browser right now."* — and keep the page usable. Never
discard what she just typed.

**Approved copy.** "A quick hello counts." · "I remembered, I just don't have the energy right now."
· "Parked for now" · "Nice." · "Who's been on your mind?" · "Good day to call someone."

## Technical Requirements

- Vanilla ESM. No framework, no TypeScript, no JSX, no new dependency; `package.json` unchanged.
- No inline `<script>` (the CSP forbids it) and no new `connect-src` host — **this page makes zero
  network requests.**
- `createStore('people', { version: 1 })` and `createStore('messageTemplates', { version: 1 })` →
  keys `usm.people.v1` and `usm.messageTemplates.v1`, each with the `{ v, updatedAt, data }`
  envelope. The `usm.` namespace is mandatory: `k-sqr.github.io` is a shared origin across every one
  of that user's Pages sites, so storage is **not** isolated by the `/lovesite/` path.
- All user text rendered via `textContent` or as a control `value`. **No `innerHTML` for any stored
  field** — names, relationships, notes, and custom templates are all user text. Follow
  `renderMemoryCard()`.
- `peopleStore.js` owns all reads, writes, id generation, state derivation, ordering, and the
  reminder seam. `people.js` renders and wires events and must never call `localStorage` directly.
- Birthday math is month/day-only and must not break when `year` is `null`. Use `dates.js`; do not
  hand-roll date arithmetic. Never compute an age.
- Writes debounced ~300ms on typing, flushed on `blur`, `visibilitychange`, and `beforeunload`.
- No `console.log`; errors go through one small local `warn()` helper, as in `04`.

## Privacy & Security

**Other people's names, relationships, birthdays, and private notes are third-party personal data.
She did not get their consent to put them in a web app.** Treat that seriously:

- **Local-only. Never synced, never uploaded, never transmitted anywhere.** No Firestore collection,
  no Storage prefix, no `firestore.rules` change, no backend of any kind.
- **This page does not touch Firebase. At all.** It must not import `src/modules/firebase.js`,
  `auth.js`, `memoriesGallery.js`, `gallery.js`, `upload.js`, or `memoryAdmin.js`. Importing
  `firebase.js` runs `getAnalytics(app)`, which would hand Google Analytics a pageview tied to a
  page full of other people's names, and adds a Firestore/Storage dependency for a feature that
  needs neither.
- **Never sent to LoveGPT and never added to `functions/knowledge/chunks.json`.** The RAG corpus is
  about the two of them. Her sister's birthday and her friend's hard month are not relationship
  context and must not become retrievable chat material.
- **Never logged, never in analytics.** No `console` output containing a name, no error message that
  echoes a note, no event names derived from person data, no counts of people reported anywhere. The
  `warn()` helper must never receive a person record.
- Notes are the most sensitive field. Keep them collapsed by default in the row and visible only in
  the person's own detail view, so a glance over her shoulder on a bus shows names and nothing else.
- No passcode gate — her own device, and a passcode is friction without a threat model. But **do**
  keep the honest limitation line permanently visible in the footer: *"This lives only in this
  browser on this device. Clearing your browser data will erase it — download a backup now and then."*
- **Export / Backup is required**, in the page header: `store.export()` for both stores wrapped into
  one file, downloaded via `Blob` + `URL.createObjectURL` + `<a download>` named
  `people-backup-YYYY-MM-DD.json`. Pair it with **Import** behind a confirmation that says plainly
  that importing replaces what is there.

## Do Not

- Do not build streaks, scores, counts of missed contact, "overdue" anything, red badges, or any
  escalating state past "It's been a little while."
- Do not persist an energy history, or chart, summarise, or export the energy selection.
- Do not add contact import, phone/email fields, click-to-call or click-to-SMS deep links, photos,
  or any social-network integration.
- Do not send messages. This page copies text to the clipboard; she sends it in her own app, in her
  own words, at her own pace.
- Do not generate message text with AI, and do not write default copy that sounds like AI did.
- Do not add a mood tracker, journal, gratitude prompt, or anything that reads as therapy software.
- Do not add a passcode, login, or sync.
- Do not touch `applications.html` / `src/applications.js` / `src/styles/applications.css` /
  `applicationsStore.js` / `src/data/promptTemplates.js`, nor timeline, letters, memories, LoveGPT,
  `functions/**`, or either rules file.
- Do not add a second breakpoint unless the list genuinely breaks; if you must, use
  `@media (max-width: 900px)` and say why in a comment.

## Implementation Strategy

1. `people.html` + `vite.config.js` entry + empty `src/people.js` → `npm run build`, confirm
   `dist/people.html` exists. **Ship this before writing any feature code.**
2. `src/data/messageTemplates.js` with the defaults above. Read every line out loud; if you would
   not text it to a friend, rewrite it.
3. `peopleStore.js`: schema, CRUD, the state function (with its comment about refusing to escalate),
   the ordering function.
4. The list and the add form, with the first-run empty state built **first** — it sets the tone, so
   do not leave it to the end.
5. Said hi and Snooze, at equal visual weight.
6. Message templates: copy with all three fallbacks, `{name}` interpolation, custom add/edit/delete.
7. Low-Energy Mode, layered on top as a filter. Verify the three-tap path.
8. Export / Import, then the reminder seam (a no-op until `11` lands).
9. Loading and error states; then re-read every string against the forbidden-copy list and grep for
   the banned words.

Commit after each step. Steps 4 and 7 are where the whole feature is won or lost.

## Acceptance Criteria

1. `npm run build` succeeds with zero errors and `dist/people.html` exists.
2. `npm run preview` → `/lovesite/people.html` loads with nav, music, and theme toggle working, and
   the For You card no longer says "coming soon".
3. No Firebase import anywhere in the files you own, and the page issues **zero** network requests
   after load (DevTools Network, All, excluding the shared Google Fonts stylesheet).
4. `grep -rniE "overdue|late|neglect|streak|days since|you haven.t (talked|spoken)|at risk"` across
   `src/people.js`, `src/modules/peopleStore.js`, `src/styles/people.css`, and
   `src/data/messageTemplates.js` returns nothing.
5. A person last contacted three years ago and one last contacted five weeks ago render the **same**
   state text and the **same** tone colour.
6. Every relative time string comes from `formatRelativeGentle()`. No day counts, no raw dates in a
   row, no `toLocaleDateString()` in the row renderer.
7. There is no red anywhere on the page, no numbered badge except "Parked for now (n)", and no
   number rendered larger than body text.
8. Adding a person requires only a name; the saved record is valid with `preferredCadence: 'none'`,
   `birthday: null`, and `energyCost: null`.
9. A birthday saved as month + day with no year produces the "Birthday coming up" state within ~2
   weeks, and no age is ever displayed or computed.
10. **Low** shows at most 3 people, prefers low-cost people, shows "A quick hello counts.", and its
    per-row action copies a "Very low energy" template. It never says "Call".
11. **Social today** shows the full list with high-cost people first.
12. Changing the energy selector writes **nothing** to localStorage: DevTools → Application shows no
    `usm.people.energy` under Local Storage (sessionStorage only), and no array of past selections
    exists anywhere in the code.
13. Copying a template puts the exact text, with `{name}` substituted, on the clipboard with a
    visible confirmation; with `navigator.clipboard` deleted in the console, the `execCommand`
    fallback still works and still confirms.
14. Every default template reads correctly with `{name}` absent.
15. "Said hi" is one tap: it sets `lastContactAt` to today, clears any snooze, and opens no dialog
    or follow-up form.
16. Snooze offers Tomorrow / This weekend / Next week / Custom, shows the approved framing line,
    renders at the same size as "Said hi", and increments no counter. Snoozing twice leaves no trace.
17. A snooze whose date has passed silently returns the person to the list with no banner or alert.
18. DevTools → Application → Local Storage shows exactly `usm.people.v1` and
    `usm.messageTemplates.v1`, each with a `{ v, updatedAt, data }` envelope. No other new keys.
19. Export downloads a JSON file; clearing both keys and importing it restores every person and
    custom template exactly. Reload preserves state; a second tab reflects changes via `subscribe`.
20. The first-run empty state shows the invitation copy and exactly one button.
21. A name containing `<script>alert(1)</script>` renders as literal text and executes nothing.
22. At 375px, page load → copied low-energy message is **three taps or fewer**, one-handed, all
    targets ≥44px.
23. Keyboard-only: Tab reaches every control with a visible focus ring; the energy radiogroup
    responds to arrow keys; Escape closes any sheet and restores focus to its trigger.
24. With `prefers-reduced-motion: reduce`, all content is visible and nothing animates.
25. Both themes are legible for every surface, state chip, and template chip, and `people.css`
    contains no hardcoded hex values.
26. With localStorage blocked (DevTools → Application → Storage, or Safari private mode), the page
    loads, shows one calm banner, and remains fully usable.
27. `git diff --stat package.json` is empty — zero new dependencies.

## Verification

```bash
npm run dev                                   # /lovesite/people.html
npm run build && npm run preview              # confirm dist/people.html
grep -rn "firebase" src/people.js src/modules/peopleStore.js               # → nothing
grep -rn "localStorage\|IntersectionObserver\|innerHTML" src/people.js     # → nothing
grep -rn "toLocaleDateString" src/people.js                                # → nothing
grep -rn "people" vite.config.js                                           # → the input entry
grep -rniE "overdue|streak|days since|neglect|at risk|you haven" src/people.js src/modules/peopleStore.js src/styles/people.css src/data/messageTemplates.js
grep -rniE "this message finds you|reaching out|circling back|touching base" src/data/messageTemplates.js
git diff --stat package.json package-lock.json                             # → empty
```

Manual:
- Add five real people with different cadences and one birthday two weeks out. Does the page feel
  like an invitation or like an inbox? **If it feels like an inbox the feature has failed** — fix the
  copy and the density before anything else.
- Set energy to **Low** and try to send someone a message without thinking. Count the taps.
- Snooze someone, then look at the page. Does snoozing feel respected or punished?
- Set a person's `lastContactAt` to two years ago and confirm the page says nothing about it beyond
  "It's been a little while."
- DevTools → Rendering → *Emulate prefers-reduced-motion: reduce*.
- Toggle `data-theme="dark"` on `<html>`; check every state chip and template chip.
- DevTools → Session Storage vs Local Storage: confirm the energy selection is session-only and
  vanishes on browser restart.
- Export, clear both `usm.*` keys, import, confirm a byte-identical restore.

## Definition of Done

- [ ] `people.html` created, `vite.config.js` input entry added, `dist/people.html` builds
- [ ] `src/people.js`, `src/styles/people.css`, `src/modules/peopleStore.js` created
- [ ] `src/data/messageTemplates.js` created with all six categories written as real human text
- [ ] Person record implemented with every field in R2, and a name-only person is valid
- [ ] State function implements exactly five states, refuses to escalate past "It's been a little
      while", and carries the comment explaining why
- [ ] All relative time comes from `formatRelativeGentle()`
- [ ] Low-Energy Mode: four settings adapting people and actions, three-tap path verified, **no
      persisted history, no charts, no mood framing**
- [ ] Message templates: one-tap copy with three fallbacks and a visible confirmation, `{name}`
      interpolation, and user add/edit/delete
- [ ] "Said hi" is one tap; **Snooze** is first-class at equal visual weight, with the four options
      and the approved framing line
- [ ] Export and Import working, plus the honest in-UI line about device-bound storage
- [ ] Reminder seam documented and consumed defensively; page fully functional without it
- [ ] First-run empty state reads as an invitation; loading and error states implemented
- [ ] Zero Firebase imports, zero network requests, zero new dependencies; nothing reaches LoveGPT,
      analytics, or any log
- [ ] No guilt language anywhere — every grep in Verification comes back clean
- [ ] Both themes, 375px one-handed, keyboard-only, and reduced-motion all verified
- [ ] `DOCS.md` updated with the page, its two store keys, and its data shapes
