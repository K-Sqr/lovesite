# 02 — Design System Audit & Extension

> **Part reference, part task.** §1–§7 document what already exists — treat as law.
> §8 is the only thing you *build*: a small set of additive tokens and primitives that the new
> feature pages will share. Nothing in §1–§7 gets redefined.

**Prerequisite:** `01-REPOSITORY-AUDIT.md` read.
**Recommended tool:** Cursor Chat. This is small, surgical CSS in a codebase you can hold in your
head. A heavyweight agent is wasted here.

---

## 1. Colour tokens (`src/styles/base.css`)

### Light (default, `:root`)

| Token | Value | Real role |
| --- | --- | --- |
| `--pink-deep` | `#d72660` | Headings, body text, primary ink. **This is the text colour.** |
| `--pink-hot` | `#ff4da6` | Accent: dates, active nav, stat numbers, subtitles |
| `--pink-light` | `#ffb6c1` | Borders, dividers, placeholders, disabled |
| `--pink-bg` | `#ffe6f0` | Page background start |
| `--pink-bg-alt` | `#fff0f5` | Page background end |
| `--white` | `#ffffff` | Solid surfaces, timeline dot rings |
| `--card-bg` | `rgba(255,255,255,0.85)` | **Every card.** Translucent, pairs with `backdrop-filter` |
| `--shadow-pink` | `rgba(215,38,96,0.12)` | Interactive/raised shadow |
| `--shadow-soft` | `rgba(215,38,96,0.06)` | Resting shadow |
| `--text-primary` | `#d72660` | = `--pink-deep` |
| `--text-muted` | `rgba(215,38,96,0.7)` | Secondary text |

### Dark (`[data-theme="dark"]`)

| Token | Value |
| --- | --- |
| `--pink-deep` | `#f087a8` |
| `--pink-hot` | `#ff6bb5` |
| `--pink-light` | `#9e4466` |
| `--pink-bg` | `#1a1018` |
| `--pink-bg-alt` | `#221520` |
| `--white` | `#2a1c24` |
| `--card-bg` | `rgba(42,28,36,0.9)` |
| `--text-primary` | `#f5c2d4` |
| `--text-muted` | `rgba(245,194,212,0.6)` |

Dark mode is **deep plum**, not navy (`DOCS.md` says navy — stale). Note the inversion trick:
`--white` becomes a dark surface, so `color: var(--white)` on gradient buttons still works.

**Rules:**
- Never hardcode a hex in new CSS. If you need a colour that does not exist, add a token in §8.
- Only three hardcoded colours exist in the whole codebase and all are semantic escapes:
  `#e74c3c` (error text), `#f0f0f0`/`#666`/`#999` (passcode modal neutrals),
  `rgba(0,0,0,…)` (scrims). **`#999` and `#f0f0f0` do not respond to dark mode — that is an
  existing bug in `.passcode-modal p`. Do not copy that pattern.**

---

## 2. Typography

```css
--font-display: 'Dancing Script', cursive, sans-serif;   /* h1, h2, h3 — script */
--font-body:    'Inter', sans-serif;                      /* everything else */
```

Loaded via `<link>` in each HTML head: Dancing Script 400/600/700, Inter 400/500/600.
`base.css` sets `h1,h2,h3 { font-family: var(--font-display); font-weight: 700; line-height: 1.3 }`.

**Observed scale** (all `clamp(min, vw, max)`):

| Use | Declaration |
| --- | --- |
| Page `h1` | `clamp(1.6rem, 4vw, 2.4rem)` |
| LoveGPT `h1` | `clamp(2rem, 6vw, 3rem)` |
| Section title | `clamp(1.6rem, 4vw, 2.6rem)` |
| Card `h3` | `clamp(1rem, 2.5vw, 1.2rem)` |
| Body / card `p` | `clamp(0.85rem, 2vw, 0.95rem)`, `line-height: 1.5–1.6` |
| Subtitle (script) | `clamp(0.95rem, 2.5vw, 1.1rem)` |
| Eyebrow / meta | `0.8rem`, `600`, `uppercase`, `letter-spacing: 0.05em` |
| Micro-label | `0.65–0.72rem`, `uppercase`, `letter-spacing: 0.04em`, `opacity 0.55–0.7` |

**The single most important typographic rule in this design system:**

> **`--font-display` (Dancing Script) is for emotional voice — headings, verses, the counter
> label, "Made with ♥". `--font-body` (Inter) is for anything functional or data-bearing —
> dates, numbers, labels, form fields, buttons.**

Existing code follows this deliberately: `.timeline-date` and `.counter-num` explicitly override
back to `var(--font-body)`. The new utility features are mostly functional, so they will lean on
Inter — and that is correct, not a departure. Script is the seasoning; use it for the *writing*
(a section's title, an empty-state sentence, a supportive line), never for a data table.

---

## 3. Spacing & shape

**No spacing scale token exists.** Spacing is written inline with `clamp()`. The de-facto rhythm:

```
page padding      clamp(1.5rem, 4vw, 3rem) clamp(1rem, 3vw, 2rem)
section padding   clamp(1.5rem, 5vw, 4rem) clamp(1rem, 4vw, 3rem)
card padding      1.2rem–1.5rem  (timeline: 1.4rem 1.6rem;  panel: 1.5rem 2rem)
grid/flex gap     0.8rem (mobile) · 1rem · 1.2rem · clamp(1.5rem, 4vw, 3rem)
stack rhythm      0.3rem · 0.4rem · 0.5rem · 0.8rem · 1rem · 1.5rem · 2rem · 2.5rem
page max-width    720px (lovegpt) · 850px (timeline) · 1000px (memories)
```

**Radii:**
```css
--radius-sm: 12px   /* inputs, small cards, timeline entries, nav links */
--radius-md: 20px   /* buttons, stat cards */
--radius-lg: 28px   /* panels, modals, verse cards */
999px               /* pills: starter pills, chat input wrap */
50%                 /* circular: 44px icon buttons, avatars, timeline dots */
18px / 4px          /* chat bubbles — one corner collapses to 4px */
```

**Shadows** (only these four exist — reuse them):
```css
0 2px 12px var(--shadow-soft)     /* resting card */
0 4px 16px var(--shadow-pink)     /* raised / interactive */
0 6px 24px var(--shadow-pink)     /* hover */
0 8px 40px var(--shadow-pink)     /* modal / overlay */
```

**Gradients** (only these):
```css
linear-gradient(135deg, var(--pink-hot) 0%, var(--pink-light) 100%)   /* primary button */
linear-gradient(135deg, var(--pink-hot), var(--pink-deep))            /* send btn, user bubble */
linear-gradient(135deg, var(--pink-bg) 0%, var(--pink-bg-alt) 100%)   /* body */
linear-gradient(180deg, var(--pink-bg-alt) 0%, var(--pink-bg) 100%)   /* alternating sections */
linear-gradient(90deg, var(--pink-hot), var(--pink-light))            /* progress bar */
```

**Glass:** `background: var(--card-bg)` + `backdrop-filter: blur(Npx)` where N ∈ {6, 8, 10, 12}.
Nav uses 12 with `-webkit-` prefix. This is the house look — **it is already glassmorphism, so
adding more is the risk, not less.** New surfaces: prefer plain `var(--card-bg)` + a shadow, and
reserve `backdrop-filter` for things that genuinely overlay content.

---

## 4. Component inventory (what you can reuse)

| Pattern | Class | Source |
| --- | --- | --- |
| Primary button | `.upload-btn`, `.upload-submit`, `#yesBtn` | gradient + white text + `0 4px 16px` + `translateY(-2px)` hover |
| Secondary button | `.upload-cancel`, `.back-link`, `#noBtn` | translucent surface, `--pink-deep` text, sometimes 2px border |
| Ghost / tertiary | `.skip-btn` | transparent, muted text, tints on hover |
| Pill | `.starter-pill` | `999px`, `1.5px solid var(--pink-light)`, glass |
| Circular icon button | `.verse-nav button`, `.music-toggle`, `.lightbox-close` | 44px, `50%`, glass, `scale(1.1)` hover |
| Card | `.timeline-entry`, `.stat-card`, `.verse-card`, `.gallery-card` | `--card-bg` + blur + radius + soft shadow |
| Panel | `.upload-panel` | `--radius-lg`, `1.5rem 2rem`, `.active` toggles display |
| Modal | `.passcode-overlay` / `.passcode-modal` | fixed scrim `rgba(0,0,0,0.5)` + `blur(6px)`, `.active` fades opacity, `z-index: 600` |
| Text input | `.passcode-input` | `2px solid var(--pink-light)` → `--pink-hot` on focus |
| Progress bar | `.upload-progress` + `-bar` | 6px track, gradient fill, width transition |
| Empty state | `.memories-empty` | centred, `4rem 1rem`, `--font-display`, `1.2rem`, `--pink-light` |
| Timeline rail | `.timeline` + `::before` + `.timeline-entry::after` | centre rail desktop, left rail ≤600px |
| Lightbox | `.lightbox` | full-screen `rgba(0,0,0,0.85)` + `blur(8px)` |
| Stat card | `.stat-card` / `.stat-number` / `.stat-label` | script number, Inter label |
| Chat bubble | `.chat-msg` / `.msg-bubble` / `.msg-avatar` | asymmetric radius, gradient user / glass assistant |
| Typing dots | `.typing-dots` | 3 × 7px, staggered bounce |
| Toast | `.music-popup` | fixed bottom-centre card, `.active`, auto-dismiss |

**Z-index ladder (respect it):**
```
0    #hearts-bg
100  #graffiti-container
200  #verse-container
300  .music-toggle
400  .site-nav, detached #noBtn
500  .lightbox, .love-message-overlay
600  .passcode-overlay
999  .music-popup
```

---

## 5. Animation system

All keyframes live in `src/styles/animations.css` (plus `typingBounce`/`msgSlideIn`, which are
defined locally in `lovegpt.css` — a small inconsistency; leave it).

| Keyframe | Use |
| --- | --- |
| `pulse` | hearts, logo, footer icon (1.2s infinite) |
| `graffiti-fall` | celebration rain (2.5s forwards) |
| `sparkle-anim` | text-reveal particles (700–900ms) |
| `float-up` | ambient background hearts (8–20s linear infinite, `opacity 0.12`) |
| `music-pulse` | playing-state shadow breathe |
| `typingBounce`, `msgSlideIn` | chat |

**The scroll-reveal contract — this is the workhorse and new features must use it:**

```css
.reveal            { opacity: 0; transform: translateY(40px);
                     transition: opacity .7s ease, transform .7s ease; }
.reveal.visible    { opacity: 1; transform: translateY(0); }
.reveal[data-delay="1".."4"] { transition-delay: .1s .. .4s; }
```

Plus the alternating horizontal variant for timeline entries (`translateX(∓30px)`).
An `IntersectionObserver` on the page adds `.visible`. **Only four delay steps exist.** Existing
code cycles with `(i % 4) + 1`, which is why long lists feel like waves rather than a single
staggered cascade.

**Easing vocabulary:** `ease` for almost everything; `cubic-bezier(0.2, 0.8, 0.2, 1)` for
"arriving" motion (modal scale-in, sparkle span settle). **Durations:** `0.15–0.2s` micro
(hover/press), `0.3s` state change, `0.4s` theme/overlay, `0.6–0.7s` entrance.

**Hover/press vocabulary:** `translateY(-1px|-2px|-4px)` lift + shadow step-up; `scale(1.08–1.2)`
for circular buttons; `:active { transform: scale(1.05) }` or `translateY(1px)`.

`@media (prefers-reduced-motion: reduce)` nukes all animation/transition durations and hides
`.floating-heart` and `.sparkle`. **Anything you add must survive that block** — never encode
meaning in motion alone.

---

## 6. Responsive system

- **One breakpoint: `@media (max-width: 600px)`.** That is it.
- Fluidity comes from `clamp()`, not from breakpoints — this is the actual strategy and it works.
- Mobile adaptations that exist: timeline rail moves centre→left, grids collapse to 2 columns,
  gaps shrink, nav font/padding shrink, headers go `column` + `align-items: flex-start`.
- `body { padding-top: 52px }` compensates for the fixed nav.

**Add a second breakpoint only if a feature genuinely needs it** (the wardrobe grid and the
application list are the likely candidates). If you do, use `@media (max-width: 900px)` and say so
in that feature's file.

---

## 7. Voice & iconography

- **Icons are emoji.** There is no icon library and only one inline SVG in the whole codebase (the
  LoveGPT send arrow). **Do not add an icon dependency.** Emoji + occasional inline SVG.
- **Voice is warm, second-person, faith-aware, a bit teasing.** Real examples:
  *"love in the machine"*, *"Every chapter of us, from the very beginning"*,
  *"Made with ♥ and a little bit of code"*, *"No memories yet — be the first to add one!"*,
  *"In love for"*.
- Buttons are conversational (`+ Add Memory`, `Skip »`, `View full timeline →`), never
  imperative-corporate (`Submit`, `Manage`, `Configure`).

---

## 8. YOUR TASK — additive tokens & primitives

### Objective

Add the minimum shared vocabulary the six new features need, **inside the existing system.**
Everything below is *additive*. You are not permitted to change an existing token's value.

### Files you own

- `src/styles/tokens.css` — **new**
- `src/styles/ui.css` — **new**

### Files you may modify

- `src/styles/base.css` — append the semantic tokens in §8.1 into the existing `:root` and
  `[data-theme="dark"]` blocks. Do **not** reorder or edit existing lines.

### Files you must not touch

`sections.css`, `memories.css`, `timeline-page.css`, `lovegpt.css`, `animations.css`, any `.html`,
any JS module.

> **Decide once:** either put new tokens in `base.css` (fewer files, matches current structure) or
> in a new `tokens.css` imported before it. **Recommendation: append to `base.css`.** This project
> has 6 CSS files and no import graph problems; a 7th file for 25 lines is not worth it. If you
> take that route, delete `tokens.css` from "files you own" and only create `ui.css`.

### 8.1 Semantic tokens to add

Add to `:root`, and add dark-mode counterparts where the light value would not read on plum:

```css
/* Spacing scale — codifies the rhythm already in use */
--space-1: 0.3rem;  --space-2: 0.5rem;  --space-3: 0.8rem;
--space-4: 1rem;    --space-5: 1.5rem;  --space-6: 2rem;   --space-7: 2.5rem;

/* Status hues — for check-in states, application statuses, cycle windows.
   Desaturated and pink-adjacent so they never read as a SaaS status badge. */
--tone-calm:    /* recently done / on track  */
--tone-soon:    /* gentle "coming up"        */
--tone-waiting: /* "it's been a little while" */
--tone-warm:    /* positive / offer / good news */
--tone-quiet:   /* archived, closed, snoozed */

/* Feedback */
--error: #e74c3c;                 /* promote the existing hardcoded value to a token */
--surface-sunken: /* inset wells: list rows, prompt preview box */
--border-subtle:  /* hairline dividers — currently people reach for --pink-light, too strong */
```

**Choose the actual values yourself**, subject to these constraints:

- Derive them from the existing palette (hue-shift `--pink-*`, do not import a new palette).
- Each must pass **4.5:1 contrast** against `--card-bg` in *both* themes when used as text.
- Semantic tones must remain distinguishable **without colour** — always pair with a word or
  emoji. Colour-only status is an accessibility failure and this app will be used one-handed on a
  phone in bad light.
- `--tone-waiting` must read as *gentle*, never as alarm. **No red, amber, or traffic-light
  semantics anywhere in this product.** If it looks like an overdue-invoice badge, it is wrong.

### 8.2 Primitives to add in `ui.css`

Extract these from the patterns catalogued in §4 into reusable classes. **Match the existing
visual result exactly** — this is extraction, not redesign. Read the source class listed in §4 and
reproduce its declarations.

| New class | Extract from | Notes |
| --- | --- | --- |
| `.usm-card` | `.timeline-entry` / `.stat-card` | `--card-bg`, `--radius-sm`, `0 2px 12px var(--shadow-soft)` |
| `.usm-btn` / `.usm-btn--primary` / `--secondary` / `--ghost` | `.upload-btn`, `.upload-cancel`, `.skip-btn` | 44px min, lift-on-hover |
| `.usm-pill` | `.starter-pill` | also used for filters and tone chips |
| `.usm-icon-btn` | `.verse-nav button` | 44px circle |
| `.usm-input`, `.usm-textarea`, `.usm-select` | `.passcode-input` | `--select` is new; match the input border/focus treatment |
| `.usm-field` | — | label + control + optional hint, `--space-2` stack |
| `.usm-panel` | `.upload-panel` | `.is-open` instead of `.active` for new code |
| `.usm-modal` + `.usm-modal__scrim` | `.passcode-overlay` | **must** add `:focus-visible`, focus trap hooks (`data-focus-trap`), and Escape-to-close; the existing modal lacks these |
| `.usm-empty` | `.memories-empty` | slot for a sentence in `--font-display` |
| `.usm-toast` | `.music-popup` | reuse `z-index: 999` |
| `.usm-tone--calm/soon/waiting/warm/quiet` | — | background tint + text colour from §8.1 |
| `.usm-skeleton` | — | new: loading placeholder, `--pink-light` at low opacity, shimmer that respects reduced-motion |
| `:focus-visible` global | — | **new and required.** `outline: 2px solid var(--pink-hot); outline-offset: 2px`. The codebase has none. |

### Do not

- Do not change any existing token value, class name, or selector.
- Do not introduce a CSS framework, preprocessor, `@layer`, or a second design language.
- Do not add `backdrop-filter` to `.usm-card`. Cards are opaque-ish surfaces; glass is for overlays.
- Do not add more gradients. Five exist; that is enough.
- Do not add rounded-corner-plus-big-shadow "KPI cards". `.stat-card` is the only stat treatment.
- Do not add hearts to the new utility features. The affection lives in the words.

### Acceptance criteria

1. `npm run build` succeeds.
2. All four existing pages are **pixel-identical** before and after, in both themes, at 375px and
   1440px. This is the primary test — you added CSS that nothing consumes yet.
3. `ui.css` is imported by **no page yet** (feature prompts will import it), or is imported and
   provably inert. State which you chose.
4. Every new token has a dark-mode value or is provably theme-independent.
5. Keyboard `Tab` through the existing nav now shows a visible focus ring.
6. Every new class works under `prefers-reduced-motion: reduce`.

### Verification

```bash
npm run dev      # visit all 4 pages, toggle theme, resize to 375px
npm run build    # zero errors
```

Manual: DevTools → Rendering → *Emulate prefers-reduced-motion: reduce*, confirm no animation.
DevTools → Elements → toggle `data-theme="dark"` on `<html>`, confirm every new token resolves.

### Definition of done

- [ ] Tokens appended to `base.css` (both themes)
- [ ] `src/styles/ui.css` created with all primitives from §8.2
- [ ] Global `:focus-visible` rule added
- [ ] Existing four pages visually unchanged, both themes, both widths
- [ ] `npm run build` clean
- [ ] Contrast spot-checked at 4.5:1 for every new text colour
- [ ] A short comment block at the top of `ui.css` naming which existing class each primitive was
      extracted from, so future readers can see they are meant to stay in sync
