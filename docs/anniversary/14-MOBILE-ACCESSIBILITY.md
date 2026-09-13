# 14 — Mobile & Accessibility Pass

**Recommended tool:** Cursor Chat. **Model:** a mid-tier model is fine; reach for a stronger one
only for the focus-trap module.
Justification: this is visual and tactile work. Almost every fix needs you to look at the result
at 375px, tab through it, and decide whether the focus ring is ugly. A batch agent cannot see the
screen, and an agent that edits ten files of CSS unsupervised will quietly change the look of a
site that is already finished. Work one surface at a time with the browser open beside you.

---

## Context

`01-REPOSITORY-AUDIT.md` §8 found a site that is unusually good in some ways and has real holes in
others. The good parts are deliberate and must survive this pass: a `prefers-reduced-motion` block
in `src/styles/animations.css` that disables all animation, 44px tap targets used consistently,
`clamp()` fluid typography throughout, `aria-label` on every icon button, an `.sr-only` utility,
`textContent` for user content, and `lang="en"` plus a correct viewport meta.

The holes, all confirmed in source:

- **No `:focus-visible` rule anywhere.** `02-DESIGN-SYSTEM.md` §8.2 required one in
  `src/styles/ui.css`. Verify it landed and actually applies on every page.
- **No mobile navigation pattern.** `sections.css:450` is one flex row; the only mobile treatment
  is `@media (max-width: 600px)` shrinking the font from `0.85rem` to `0.78rem` and the gap from
  `clamp(0.8rem,3vw,2rem)` to `0.4rem`. `04-SHARED-FOUNDATIONS.md` R2 specified a real pattern.
- **One breakpoint in the entire codebase:** `@media (max-width: 600px)`.
- **The lightbox is not focus-trapped and does not restore focus.** `memoriesGallery.js:54-83`
  adds a document-level Escape listener that is never removed and never returns focus to the card.
- **The LoveGPT chat has no `aria-live`.** `#chatArea` in `lovegpt.html:47` gets messages appended
  with no announcement, so a screen-reader user hears nothing when the reply arrives.
- **No skip-to-content link** on any page.
- **`body { padding-top: 52px }`** at `sections.css:497` is a hardcoded offset for the fixed nav.
- **No `width`/`height` on any image**, so the gallery reflows as photos load. No `srcset`.

Features 05–12 have since added six pages, several modals, a timeline with expandable entries, and
a wardrobe grid. **This pass reviews and fixes all of it. It does not redesign any of it.**

## Objective

Bring every page — the four originals and the six new ones — to a consistent standard:
keyboard-operable, screen-reader-sane, usable one-handed on a 375px phone, correct in both themes,
and calm under `prefers-reduced-motion`. Then write down what was checked, so the next person does
not have to rediscover it.

## Prerequisites

- `01-REPOSITORY-AUDIT.md` §8 read.
- `02-DESIGN-SYSTEM.md` complete — `src/styles/ui.css`, the global `:focus-visible`, and the
  contrast-checked tokens must already exist.
- `04-SHARED-FOUNDATIONS.md` complete — `src/modules/siteChrome.js` owns the nav, and the mobile
  nav pattern was specified there. If it was not built, build it here and say so.
- Features `05-TIMELINE.md` … `12-ANNIVERSARY-EXPERIENCE.md` merged.
- A real phone. Chrome DevTools device emulation is necessary but not sufficient — it does not
  reproduce thumb reach, iOS safe areas, or how a focus ring looks in sunlight.

## Existing Files To Inspect

```
src/styles/sections.css              nav (L450-497), the single @media (max-width:600px) (L773)
src/styles/ui.css                    :focus-visible, .usm-modal, .usm-input from 02
src/styles/base.css                  tokens, .sr-only, clamp() scale
src/styles/animations.css            the prefers-reduced-motion block (L141-155)
src/styles/memories.css              upload panel, passcode modal, gallery grid
src/styles/lovegpt.css               chat area, starter pills, input row
src/styles/timeline-page.css         stats bar, rail
src/modules/siteChrome.js            nav rendering + active state
src/modules/memoriesGallery.js       setupLightbox() — L54-83, the untrapped modal
src/modules/auth.js                  showPasscodeModal() — L37-105, also untrapped
src/modules/theme.js                 wires all .theme-toggle elements
index.html, timeline.html, memories.html, lovegpt.html
foryou.html, letters.html, applications.html, people.html, rhythm.html, outfit.html
```

## Files You Own (Create)

```
src/modules/focusTrap.js                   one shared trap: trap(el), release(), restore focus
docs/anniversary/A11Y-REPORT.md            what was checked, what was fixed, what was accepted
```

## Files You May Modify

- Any `src/styles/*.css` — for focus rings, breakpoints, spacing, safe-area insets, target sizes.
- Any `.html` file — **attributes and structural elements only**: heading levels, `<label>`,
  `aria-*`, `role`, the skip link, `width`/`height` on `<img>`. Do not rewrite copy.
- `src/modules/memoriesGallery.js`, `src/modules/auth.js` — only to adopt `focusTrap.js` and
  restore focus on close.
- `src/modules/siteChrome.js` — nav semantics, `aria-current`, mobile behaviour.
- `src/lovegpt.js` and any feature entry — only to add `aria-live` regions, `aria-expanded`
  toggling, and focus management. No behaviour changes.

## Files You Must Not Touch

- The `<meta http-equiv="Content-Security-Policy">` tag in any HTML file, `firestore.rules`,
  `storage.rules`, `functions/**` — that is `13-SECURITY-REVIEW.md`.
- `package.json`, `.github/workflows/**`, any test file — that is `15-TESTING-QA.md`.
- Any user-facing copy string, `DOCS.md`, `README.md`, `FEATURES.md`, `src/modules/loveCounter.js`,
  `public/photos/**` — that is `16-FINAL-POLISH.md`.
- `src/data/*` — content is not this pass's business.
- **Any feature's information architecture, layout, or interaction model.** If a feature is hard
  to use, that is a note in `A11Y-REPORT.md`, not a redesign.

## Requirements

### R1 — Mobile navigation

`04-SHARED-FOUNDATIONS.md` R2 specified the pattern (bottom tab bar on mobile, top bar on desktop,
or a disclosure menu). Verify it shipped and finish it properly:

- 44×44px minimum for every tab or menu item, with at least 8px between adjacent targets.
- `aria-current="page"` on the active destination — not just a `.active` class.
- If it is a disclosure menu: `aria-expanded` on the trigger, `aria-controls` pointing at the
  panel, Escape closes it, and focus returns to the trigger.
- Keyboard operable end to end. Tab order follows visual order.
- No layout shift on load. The nav is `position: fixed` and `body { padding-top: 52px }` assumes a
  52px height — **if the nav height changed, that rule must change in the same commit**, and it is
  one rule in one file, so there is no excuse for it drifting. If you moved to a bottom bar,
  `padding-top` shrinks and `padding-bottom: calc(56px + env(safe-area-inset-bottom))` replaces it.
- The bottom bar must not sit on top of `.music-toggle` (`bottom: 1rem`, `z-index: 300`). Move one
  of them and verify on a real phone, including while the browser chrome is hidden mid-scroll.

### R2 — `:focus-visible` everywhere

Confirm the global rule from `02-DESIGN-SYSTEM.md` (`outline: 2px solid var(--pink-hot);
outline-offset: 2px`) is loaded on all eleven pages — `ui.css` must actually be imported by each page
entry. Then tab through each page and look for:

- Elements where the ring is invisible because of `overflow: hidden` on an ancestor, or because
  the element sits on a `--pink-hot` background. Those need a local override, not a removed ring.
- Any `outline: none` in the codebase. Grep for it. Each hit must either be paired with a visible
  alternative or deleted.
- Custom controls (cards acting as links, tone chips, the theme toggle) that are `<div>`s. Make
  them real `<button>`/`<a>` elements rather than adding `tabindex` and a keydown handler.
- The ring must be visible in **both** themes. On plum, `--pink-hot` is `#ff6bb5` — check it
  against `--pink-bg` `#1a1018` and against `--card-bg`.

### R3 — Focus trap and focus restore

Write `src/modules/focusTrap.js` once and use it everywhere. API:

```js
const release = trapFocus(containerEl, { initialFocus, onEscape });
release();   // removes listeners, returns focus to the element that was focused before
```

Requirements: Tab and Shift+Tab cycle within the container; Escape calls `onEscape`; the element
that opened the modal is captured on open and focused on release; listeners are removed on
release (the current lightbox adds a `document` keydown listener that is never removed — fix
that); `aria-modal="true"` and `role="dialog"` with an `aria-labelledby` on the container; content
behind the modal gets `inert` where supported, `aria-hidden="true"` otherwise.

Apply to: the existing lightbox (`memoriesGallery.js:54`), the existing passcode modal
(`auth.js:37`), the `.usm-modal` primitive in `ui.css`, and every modal, sheet, or overlay added
by features 05–12 — including the Rhythm passphrase prompt, which is the one a keyboard user is
most likely to hit first.

### R4 — `aria-live`

- **LoveGPT chat.** `#chatArea` gets `aria-live="polite"` and `aria-atomic="false"`. The typing
  indicator must not be announced on a loop — either keep it outside the live region or give it
  `aria-hidden="true"` and announce a single "LoveGPT is typing…" via a separate visually hidden
  status node. Verify with a real screen reader that one reply produces one announcement.
- **Copy-to-clipboard confirmations.** `07-JOB-APPLICATION-STUDIO.md` has copy buttons. A toast
  that only appears visually is invisible to a screen reader. Use a single shared
  `role="status"` live region — one per page, reused — and put "Copied" into it.
- Same treatment for save confirmations, upload progress completion, and the storage-failure
  banner from `04-SHARED-FOUNDATIONS.md` R3 (which should be `role="status"`, not `role="alert"` —
  it is calm, not urgent).
- Never use `aria-live="assertive"` anywhere in this product. Nothing here is urgent.

### R5 — Skip link

Add a skip-to-content link as the first focusable element of every page, rendered by
`siteChrome.js` so it exists exactly once in source. Visually hidden until focused, then visible
with the standard focus ring, positioned over the nav. It targets the page's main landmark, so
every page needs a `<main id="main">` (several currently jump straight from `<nav>` to `<section>`).
Verify it actually moves focus, not just scroll position — set `tabindex="-1"` on the target.

### R6 — Semantics

- Exactly one `<h1>` per page, and heading levels descend without skipping. The timeline's year
  chapters from `05-TIMELINE.md` are the likely offender.
- `<main>`, `<nav>`, `<footer>` landmarks on every page.
- Lists of things are `<ul>`/`<li>` — the application list, the people list, the wardrobe grid.
- **Form labels, not placeholders.** `lovegpt.html:58` uses `placeholder="Ask LoveGPT anything..."`
  with no label, and `auth.js:45` uses `placeholder="Passcode"`. A placeholder disappears on input
  and is not reliably announced. Every input gets a real `<label>` — visually hidden via `.sr-only`
  where the design has no room — and every new form control from features 07–10 gets the same.
  `02-DESIGN-SYSTEM.md`'s `.usm-field` primitive already pairs label + control; use it.
- Decorative emoji get `aria-hidden="true"`; meaningful ones get an accessible name. The icons in
  timeline entries and For You cards are decorative — the adjacent text already says it.
- Buttons that change state carry that state: `aria-pressed` on the theme and music toggles.

### R7 — `aria-expanded` on every disclosure

Every control that shows and hides content needs `aria-expanded` kept in sync, plus
`aria-controls` on the trigger. Known instances: timeline expandable entries (`05`), the memories
upload panel (`#uploadToggle` / `#uploadPanel`), any filter drawer in Applications, any
accordion in People, the mobile nav if it is a menu, and the `.usm-panel` primitive's `.is-open`
state. If the toggle is a `<div>` or a bare styled `<span>`, make it a `<button type="button">`.

### R8 — Tap targets and one-handed reach

- Every interactive element is ≥44×44px in its **hit area**, which may exceed its visual size via
  padding or a pseudo-element. Measure at 375px in DevTools, not from the CSS.
- Adjacent targets have ≥8px of separation. Delete buttons on gallery cards and chips in filter
  rows are the usual failures.
- **Thumb reachability:** on a 375×812 viewport, primary actions belong in the lower two-thirds.
  Destructive actions (delete a memory, delete a person, clear Rhythm data) belong *away* from the
  thumb's resting arc, and must require a confirmation. Check that nothing important sits in the
  top-right corner, the hardest spot to reach one-handed.
- Horizontal scrolling is never required. At 320px, `document.documentElement.scrollWidth` must
  equal the viewport width on every page.

### R9 — Contrast in both themes

Every new token added by `02-DESIGN-SYSTEM.md` §8.1 — `--tone-calm`, `--tone-soon`,
`--tone-waiting`, `--tone-warm`, `--tone-quiet`, `--error`, `--surface-sunken`, `--border-subtle` —
must reach **4.5:1** against the surface it is used on, in light and dark. Measure the computed
values with a contrast tool; do not eyeball them, and remember `--card-bg` is translucent so the
effective background is the blend, not the token.

Also: **no status may be communicated by colour alone.** Every tone chip carries a word or an
emoji. That is already a rule in `02`; this pass verifies it held under real feature code.

### R10 — Reduced motion, per feature

`animations.css:141` nukes durations globally with `!important`, which covers CSS. It does **not**
cover JavaScript-driven motion. For each feature, with *Emulate prefers-reduced-motion: reduce*
on, verify: content is visible (the `.reveal` base state is `opacity: 0`, so a broken observer
means a blank page — `reveal.js` already handles this, confirm it), no auto-advancing carousel, no
parallax, no confetti, no scroll-linked rail fill, and the `.usm-skeleton` shimmer is static.

`12-ANNIVERSARY-EXPERIENCE.md` is the highest risk here — a celebratory sequence is exactly the
thing that gets built as JS animation and forgets the media query.

### R11 — Images and layout shift

- Every `<img>` in static HTML gets `width` and `height` attributes matching its intrinsic aspect
  ratio, so the browser reserves the box. For JS-created images (`memoriesGallery.js:25`,
  the timeline photos, the wardrobe grid) set `img.width`/`img.height` or an `aspect-ratio` on the
  container with `object-fit: cover`.
- `loading="lazy"` on everything below the fold; `decoding="async"` on all of them.
- Meaningful `alt` text; `alt=""` for decorative. A caption is not alt text — if the card shows the
  caption visually, the image's `alt` must not repeat it verbatim.
- `srcset` is **optional** here and explicitly not required: there is no image pipeline and only
  six local photos. Note it in `A11Y-REPORT.md` as deferred. Photo *weight* is a real problem but
  it belongs to `16-FINAL-POLISH.md`.

### R12 — Breakpoints and safe areas

- Test and fix at **320px, 375px, 768px, 1440px**. 320px is the floor (iPhone SE / a zoomed
  browser); 768px is where the single 600px breakpoint currently leaves tablets in the desktop
  layout with a cramped grid.
- Add `@media (max-width: 900px)` only where a feature genuinely needs it — the wardrobe grid and
  the application list are the expected candidates, per `02-DESIGN-SYSTEM.md` §6. Do not
  retrofit a full breakpoint system.
- iOS safe areas: `viewport-fit=cover` in the viewport meta, then
  `padding-bottom: env(safe-area-inset-bottom)` on any bottom-fixed element (nav bar, music
  toggle, sticky action row) and `env(safe-area-inset-left/right)` on full-bleed content. Test in
  landscape on a notched device, where the left inset is the one people forget.
- Text must reflow at 200% browser zoom without clipping or horizontal scroll.

### R13 — Keyboard-only task completion

For each feature, complete one full task using only the keyboard, and record it in the report:

| Feature | Task to complete with keyboard only |
| --- | --- |
| Timeline | Open a year chapter, expand an entry, open a photo, close it, land back on the entry |
| Letters | Sign in, open a letter, close it, return to the list |
| Applications | Add an application, change its status, copy a field, delete it |
| People | Add a person, log a check-in, dismiss the suggestion |
| Rhythm | Enter the passphrase, log a start date, read the prediction, lock it again |
| What to Wear | Add a garment, generate today's suggestion, mark it worn |
| Notifications | Open the in-app list, dismiss an item |
| LoveGPT | Send a message via a starter pill, then one typed, hear the reply announced |
| Memories | Open the lightbox, close it, land back on the card you opened |

## UX Requirements

- **Nothing about this pass may change how the site feels.** Same layout, same copy, same warmth.
  A focus ring appearing is the only visible difference a sighted mouse user should notice.
- Focus rings use the house accent (`--pink-hot`), not the browser default blue.
- The skip link, when focused, looks like part of the site — a pill on the nav surface, not a
  bare-blue browser artifact.
- Announcements are calm and in his voice: "Saved", "Copied", "That's not it" — never "Error:
  operation failed" or "Success!".
- Reduced motion must feel *intentional*, not broken: things appear instantly, they do not appear
  half-way.

## Technical Requirements

- No new runtime dependencies. No `focus-trap`, no `a11y-dialog`, no testing library. `focusTrap.js`
  is about 60 lines of vanilla JS.
- Vanilla ESM only; no inline `<script>` (CSP forbids it).
- Do not change any existing design token value — `02-DESIGN-SYSTEM.md` forbids it. If a contrast
  failure needs a new colour, add a new token.
- `focusTrap.js` must be safe to call twice and safe to release twice.
- No `console.log` left behind.
- `npm run build` clean; no new CSS file unless a feature genuinely needs one.

## Privacy & Security

- Live regions read their contents aloud. **Nothing from Rhythm may be placed in a live region**
  that could be announced on a shared speaker, and no Rhythm state may be announced by the For You
  hub — `04-SHARED-FOUNDATIONS.md` R6 already bans it from the hub visually; the same applies to
  screen-reader-only text.
- Do not add `aria-label`s that restate private content (an `aria-label` of "Period started
  September 3" on a button is a disclosure).
- Adding a `<label>` must not change any input's `name`, `id`, or `autocomplete` in a way that
  makes a browser offer to save a passcode. The passcode input keeps `autocomplete="off"`.
- Do not add a third-party accessibility widget or overlay. They are worse than nothing.
- Do not introduce any new network request in this pass — no icon CDN, no font, no analytics.

## Do Not

- Do not redesign a feature. Not the layout, not the flow, not the wording.
- Do not add ARIA where HTML already says it. `<button>` beats `role="button"` every time; the
  first rule of ARIA is not to use ARIA.
- Do not add `role="application"`, `tabindex` greater than 0, or a custom focus-order scheme.
- Do not add an accessibility settings panel, a font-size switcher, or a high-contrast theme.
  The browser already does all three.
- Do not remove any `outline` without replacing it.
- Do not "fix" the existing `.locked` / `.locked.unlocked` CSS gating on the homepage — it is
  cosmetic, it is intentional, and `01-REPOSITORY-AUDIT.md` §8 already notes it is not security.
- Do not touch `buttons.js`'s dodging No button. It is inaccessible by design and it is a joke
  that already ends after 15 clicks. Note it in the report and leave it alone.

## Implementation Strategy

1. **Audit before editing.** Tab through all eleven pages, run Lighthouse and axe on each, and fill
   in `A11Y-REPORT.md` as a findings list first. Editing as you discover produces a half-fixed site
   and no record.
2. `focusTrap.js` next — it is self-contained and unblocks four other fixes. Prove it on the
   existing lightbox, which is the smallest consumer.
3. Shared chrome: skip link, `<main>` landmarks, `aria-current`, mobile nav. One commit, all eleven
   pages, because the diff shape should be identical everywhere.
4. Then per-page: labels, headings, `aria-expanded`, live regions. One page per commit.
5. Then the visual sweep at 320/375/768/1440 in both themes, fixing spacing and targets.
6. Then reduced motion and contrast measurement.
7. Finally the keyboard task matrix (R13) as the acceptance run, on a real phone with VoiceOver or
   TalkBack for at least LoveGPT and Letters.

Commit after each step. Steps 3 and 4 are where a regression hides.

## Acceptance Criteria

1. Tabbing from a fresh page load reaches, in order: skip link → nav → main content. The skip link
   is visible when focused and moves focus (not just scroll) to `<main>`.
2. Every focusable element on all eleven pages shows a visible `--pink-hot` focus ring in both themes.
   `grep -rn "outline: *none" src/styles/` returns only hits paired with a visible alternative.
3. Opening the lightbox, the passcode modal, and every feature modal traps Tab, closes on Escape,
   and returns focus to the exact element that opened it.
4. A LoveGPT reply is announced once by a screen reader; the typing indicator is not announced
   repeatedly. "Copied" is announced on every copy button.
5. Every input on every page has a programmatic label. `grep -rn "placeholder=" *.html src/` shows
   no input whose only accessible name is a placeholder.
6. Every disclosure control has `aria-expanded` that changes value when toggled, verified in the
   accessibility tree.
7. The active nav destination has `aria-current="page"` on all eleven pages.
8. At 320px, no page scrolls horizontally: `document.documentElement.scrollWidth === window.innerWidth`.
9. Every interactive element measures ≥44×44px at 375px, with ≥8px between adjacent targets.
10. All `02-DESIGN-SYSTEM.md` §8.1 tokens measure ≥4.5:1 against their actual background in both
    themes, with numbers recorded in `A11Y-REPORT.md`.
11. With reduced motion emulated, every page renders fully with no animation and no invisible
    content, feature by feature — including the anniversary sequence.
12. No layout shift on image load: Lighthouse CLS < 0.1 on `memories.html` and `timeline.html`.
13. Lighthouse Accessibility ≥ 95 on all eleven pages; axe DevTools reports zero critical or serious
    issues. Any remaining violation is listed and justified in the report.
14. Every row of the R13 keyboard-task matrix is completed and ticked.
15. All four original pages look and behave exactly as before at 375px and 1440px in both themes.
16. `npm run build` succeeds; zero new dependencies.

## Verification

```bash
npm run dev                       # keep it open; this pass is done in the browser

# Where the gaps are, before and after
grep -rn "outline: *none" src/styles/
grep -rn "placeholder=" *.html src/
grep -rn "aria-live\|role=\"status\"\|role=\"alert\"" src/ *.html
grep -rn "aria-expanded\|aria-controls" src/ *.html
grep -rn "aria-current" src/modules/siteChrome.js
grep -rn ":focus-visible" src/styles/
grep -c "<h1" *.html                       # exactly 1 per page
grep -rn "<main" *.html                    # every page
grep -rn "max-width: *600px\|max-width: *900px" src/styles/
grep -rn "env(safe-area-inset" src/styles/
grep -rn "loading=\"lazy\"\|decoding=" src/ *.html

npm run build && npm run preview  # re-verify at /lovesite/ — base path affects the skip link anchor

# Per page, with the preview server running:
npx lighthouse http://localhost:4173/lovesite/index.html \
  --only-categories=accessibility,performance --view
```

**Manual tests:**

1. **Keyboard sweep.** On each of the eleven pages: Tab from the top to the bottom without touching
   the mouse. Note anywhere focus vanishes, jumps backwards, or lands on something invisible.
2. **Screen reader.** VoiceOver on iOS for `lovegpt.html` and `letters.html`; NVDA or Narrator on
   Windows for `applications.html`. Listen for: page title, heading structure, unlabelled buttons,
   and whether the chat reply is announced.
3. **Widths.** DevTools responsive mode at 320, 375, 768, 1440. Both themes at each width. Look
   for horizontal scroll, clipped text, and cramped targets.
4. **Reduced motion.** DevTools → Rendering → *Emulate prefers-reduced-motion: reduce*. Reload
   every page. Nothing animates; nothing is missing.
5. **Real phone, one hand.** Complete the R13 task for three features holding the phone in one
   hand. Note anything you had to shuffle your grip for.
6. **Notched device, landscape.** Confirm content clears the notch and the home indicator.
7. **200% zoom** in a desktop browser at 1440px: no clipping, no horizontal scroll.
8. **Contrast.** Measure every §8.1 token with DevTools' contrast picker in both themes and write
   the ratios into the report.

## Definition of Done

- [ ] `src/modules/focusTrap.js` created and adopted by the lightbox, the passcode modal, and
      every feature modal, with focus restored to the opener in each case
- [ ] Skip link rendered once from `siteChrome.js`, present and working on all eleven pages
- [ ] `<main id="main" tabindex="-1">` landmark on every page; one `<h1>` each; no skipped levels
- [ ] Mobile nav finished: 44px targets, `aria-current="page"`, keyboard operable, no overlap with
      the music toggle, `body` padding rule updated in the same commit as any nav height change
- [ ] `:focus-visible` verified on every page in both themes; no unpaired `outline: none`
- [ ] `aria-live` on the chat, on copy confirmations, on save/upload status, and on the storage
      banner — all `polite`, none `assertive`
- [ ] Every input has a real `<label>`; no placeholder-as-label remains
- [ ] `aria-expanded` + `aria-controls` on every disclosure, synced on toggle
- [ ] `width`/`height` or `aspect-ratio` on every image; `loading="lazy"` below the fold; CLS < 0.1
- [ ] 320/375/768/1440 verified in both themes with no horizontal scroll
- [ ] `env(safe-area-inset-*)` applied and tested on a notched device in both orientations
- [ ] Contrast ratios measured and recorded for every `02` §8.1 token in both themes
- [ ] Reduced motion verified feature by feature, including the anniversary sequence
- [ ] All nine rows of the keyboard-task matrix completed
- [ ] Lighthouse a11y ≥ 95 and zero serious axe issues on all eleven pages
- [ ] `docs/anniversary/A11Y-REPORT.md` written: what was checked, what was fixed, what was
      accepted and why (including the No button and the deferred `srcset`)
- [ ] Four original pages visually unchanged; `npm run build` clean; zero new dependencies
