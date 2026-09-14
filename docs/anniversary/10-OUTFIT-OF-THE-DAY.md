# 10 — What to Wear

**Recommended tool:** Claude Code, one session, working from this file top to bottom.
**Model:** Sonnet is sufficient; a stronger model if you have headroom.

Justification: this is the largest feature by surface area but the least subtle. The hard thinking —
the scoring rules, the storage split, the CSP change — is already decided below, and what remains is
a lot of straightforward CRUD, a grid, and a form. The one part that rewards care is the explanation
copy, and you should write that yourself regardless of model.

---

## Context

Every morning there is a decision to make, and it is made under time pressure, half-awake, with a
phone in one hand. It is not an interesting decision and it does not get easier with practice. That
is the load this feature removes.

The core promise, and the thing that separates this from every AI stylist on the internet:

> **Tell me what your day looks like and I'll figure out what you can wear from the clothes you
> already own.**

Recommendations are **constrained to items in her actual closet**. A suggestion she cannot act on
because she does not own the thing is worse than no suggestion, because it costs her the time she
spent reading it. This constraint is the feature. Protect it.

### The risk you must design around

Cataloguing a wardrobe is a large one-time data-entry chore, and it sits in direct tension with the
product principle for this whole project — *reduce mental load, don't create another app she has to
maintain.* Of the six new tools, **this is the one most likely to be abandoned**, and it will be
abandoned at the empty-closet screen, not later.

So the mitigations below are not polish items to defer. They are the feature working at all:

- **Be useful with 10–15 items.** A sparse closet must produce a real suggestion, never an error and
  never a "add more items to continue" wall.
- **Photos are optional.** A name and a category is a complete, valid item.
- **Add lazily.** A "what did you wear today?" affordance grows the closet as a by-product of use.
- **He seeds it.** The single highest-leverage decision in this feature: *you* enter her first
  fifteen items before she ever sees the page. That converts the chore into the gesture, and it means
  she meets a working tool instead of an empty form. Build the batch-add flow for yourself, and treat
  it as gift-wrapping.

---

## Objective

Ship `outfit.html`: open it, and within about two seconds — with no taps — see today's weather and a
complete outfit assembled from clothes she owns, with a one-line reason in your voice for why those
pieces.

The success sentence is: **"I picked the trench because it's windy and there's a chance of rain."**
The clothes are the output; the reason is why it reads as care rather than as an algorithm.

---

## Prerequisites

- `01-REPOSITORY-AUDIT.md` read.
- `02-DESIGN-SYSTEM.md` complete — `src/styles/ui.css` and the added tokens exist.
- `04-SHARED-FOUNDATIONS.md` complete — you need `initSiteChrome()`, `initReveal()`,
  `createStore(name, { version })`, **`createBlobStore(name)`**, and from `dates.js`: `toISO()`,
  `parseISO()`, `startOfDay()`, `daysBetween()`, `addDays()`.
- `foryou.html` exists with a "What to Wear" card in the `data-coming-soon` state.

If `createBlobStore` does not yet exist, **stop and build it in `04-SHARED-FOUNDATIONS.md` first.**
Do not write a second IndexedDB wrapper inside this feature.

---

## Existing Files To Inspect

| File | Why |
| --- | --- |
| `src/modules/storage.js` | `createStore` contract and the `{ v, updatedAt, data }` envelope. |
| `src/modules/storage.js` → `createBlobStore` | `{ put(id, blob), get(id), delete(id), keys(), estimate() }`. Note the fail-soft contract. |
| `src/modules/upload.js` **lines 6–30** | `compressImage(file, maxWidth = 1200, quality = 0.82)`. Read it exactly; you are duplicating this logic, not importing it. See Technical Requirements for why. |
| `src/modules/dates.js` | Date helpers. Do not write new date math. |
| `src/modules/reveal.js` | `initReveal()`, `observeReveal(el)`. |
| `src/modules/siteChrome.js` | `initSiteChrome({ active })` and `NAV_LINKS`. |
| `src/styles/memories.css` | The existing photo-grid and lightbox patterns — the wardrobe grid should feel like a sibling of the memories grid, not a new invention. |
| `src/memories.js` | How an existing page wires a grid plus an upload form. Follow its shape. |
| `src/styles/base.css` | Token names, both theme blocks. Never hardcode a hex. |
| `src/modules/firebase.js` | Read it precisely to understand why this page must never import it. It calls `getAnalytics(app)` at module scope, unconditionally. |
| `index.html` **line 12** | The CSP meta tag. Read it character by character — you are editing it in every HTML file. |
| `vite.config.js` | You are adding an input entry. Forgetting this is a silent production 404. |
| `docs/anniversary/PAGE-CHECKLIST.md` | Follow it literally. |

---

## Files You Own (Create)

```
outfit.html                        the page
src/outfit.js                      page entry — CSS, chrome, reveal, wires the UI
src/modules/wardrobeStore.js       metadata store + photo blob store + item CRUD + export
src/modules/weather.js             Open-Meteo client, location resolution, TTL cache
src/modules/outfitEngine.js        PURE scoring — zero DOM, zero storage, zero network
src/styles/outfit.css              page styles
```

`outfitEngine.js` must be **pure**: it takes data and returns a plain object. Its only import is
`dates.js`. `15-TESTING-QA.md` already plans to unit-test it, including an extreme-cold exclusion
case, and purity is what makes that possible without a browser.

## Files You May Modify

```
vite.config.js                     add:  outfit: resolve(__dirname, 'outfit.html')
index.html  timeline.html  memories.html  lovegpt.html  foryou.html
   letters.html  applications.html  people.html  rhythm.html  anniversary.html
                                   CSP connect-src ONLY — see Technical Requirements
src/foryou.js                      remove data-coming-soon from the What to Wear card only
DOCS.md                            one line: the page exists, wardrobe data is local
```

## Files You Must Not Touch

```
rhythm.html  src/rhythm.js  src/styles/rhythm.css  src/modules/rhythmStore.js
   src/modules/cyclePredict.js                             ← owned by 09
applications.html  src/applications.js  src/styles/applications.css  src/modules/application*.js
                                                            ← owned by 07
people.html  src/people.js  src/styles/people.css  src/modules/people*.js
                                                            ← owned by 08
letters.html  src/letters.js  src/styles/letters.css  src/modules/letter*.js
                                                            ← owned by 06
src/data/timeline.js  src/modules/timeline.js  src/timeline-page.js
                                                            ← owned by 05
src/modules/storage.js  src/modules/dates.js  src/modules/reveal.js
   src/modules/siteChrome.js                                ← foundations, consume only
src/modules/upload.js  src/modules/firebase.js  src/modules/auth.js
functions/**  firestore.rules  storage.rules
src/styles/base.css                ← no token changes
```

You may edit the CSP line in the other pages' HTML. That is the **only** thing you may change in
them.

---

## Requirements

### R1 — Weather via Open-Meteo

Use `https://api.open-meteo.com/v1/forecast`. No API key, free for non-commercial use, CORS-enabled,
no backend.

Why not a key-requiring provider: this is a static site in a public repository, so there is nowhere
safe to put a key — anything the build can read, the built bundle publishes. The only server surface
in the project is a single Firebase Cloud Function for LoveGPT, and extending it into a weather proxy
would add a deploy dependency, a cold start, and a second thing to maintain, in exchange for nothing.
Keyless is not the compromise here; it is the correct answer.

Request shape:

```js
const params = new URLSearchParams({
  latitude:  lat.toFixed(2),          // 2dp ≈ 1.1km — deliberately coarse, see Privacy
  longitude: lon.toFixed(2),
  current:  'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
  daily:    'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
  hourly:   'temperature_2m,apparent_temperature,precipitation_probability',
  timezone: 'auto',
  forecast_days: '1',
});
const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
```

Parameter names I am confident about: `latitude`, `longitude`, `current`, `hourly`, `daily`,
`timezone`, `temperature_2m`, `apparent_temperature`, `precipitation`,
`precipitation_probability`, `weather_code`, `wind_speed_10m`. Defaults are Celsius, km/h, and mm.
**Confirm the exact `daily` field names against Open-Meteo's live documentation before shipping** —
they are the ones most likely to have drifted, and a wrong name returns an error rather than
silently omitting the field, so this fails loudly and is easy to catch.

Normalise the response into a flat internal shape immediately, so `outfitEngine.js` never sees an
Open-Meteo payload:

```js
{ tempC, feelsLikeC, tempMinC, tempMaxC, windKph, precipMm, precipChance,
  code, condition, isDaytime, fetchedAt, locationLabel, stale }
```

`condition` is a small internal enum mapped from WMO `weather_code` — `clear | cloudy | fog |
drizzle | rain | freezing | snow | storm`. Keep the mapping in one table with a comment citing the
WMO code ranges. Do not scatter magic numbers through the scoring rules.

**Apparent temperature drives the rules, not air temperature.** In Winnipeg in January the gap
between the two is routinely 10°C and it is the one that decides what you wear.

### R2 — CSP: the step everyone forgets

`connect-src` is an allow-list. The CSP is duplicated as a `<meta>` tag in **every** HTML file, so a
missed file means `fetch` is silently blocked **on that page only** — and since this feature has one
page, a mistake here looks like "weather is broken" rather than "CSP is wrong". Add the host to every
file anyway, so the tags stay byte-identical and future pages inherit a correct baseline.

Current `connect-src` (`index.html` line 12):

```
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://lovegpt-osmy5pclpq-uc.a.run.app https://www.google-analytics.com https://analytics.google.com;
```

Add exactly one host, `https://api.open-meteo.com`, and change nothing else in the policy:

```
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://lovegpt-osmy5pclpq-uc.a.run.app https://www.google-analytics.com https://analytics.google.com https://api.open-meteo.com;
```

After editing, every HTML file's CSP line must be identical. Verify with the command in Verification.

### R3 — Location

`navigator.geolocation.getCurrentPosition` with real handling for all four outcomes: granted,
denied, dismissed without answering, and unavailable. It requires a secure context, which the live
site has over HTTPS and `localhost` provides in dev.

- Always pass a `timeout` (8s) and `maximumAge`, and treat a silent non-answer as a soft failure. A
  dismissed prompt never calls either callback in some browsers, so the timeout is what saves you.
- **Never prompt on page load.** Resolve in this order: saved location → geolocation *only if
  permission is already granted* (`navigator.permissions.query({ name: 'geolocation' })`) → default.
  A cold-open permission dialog on a page she opened to get dressed is exactly the wrong first
  impression.
- Offer geolocation behind an explicit "use my location" control.
- **Manual location override**, saved. A plain text field plus Open-Meteo's geocoding, or a short
  hardcoded list of the two or three cities that actually matter, is fine — do not build a
  location picker UI.
- **Default: Winnipeg (49.90, -97.14).** Confirm with the owner; it is where she is.

### R4 — Caching and graceful degradation

Cache the normalised forecast in `createStore('weather-cache', { version: 1 })` with a **60-minute
TTL**, keyed by rounded coordinates. Render from cache instantly on load, then refresh in the
background and update in place.

If the fetch fails and the cache is empty, **still produce an outfit** from occasion and season
alone, with an honest banner: *"Couldn't get today's weather — this is based on the season."* If the
cache is stale, use it and mark it. A weather outage must never be a blank page; the closet is the
part that matters and it is entirely local.

### R5 — Closet inventory

Categories: **Tops, Bottoms, Dresses, Shoes, Jackets, Bags, Jewellery, Accessories.**

```js
/** @typedef {Object} WardrobeItem */
{
  id:         'itm_1a2b3c',      // crypto.randomUUID() or a short nanoid-style local helper
  name:       'Camel trench',    // the only required field besides category
  category:   'jackets',
  colour:     'camel',           // free text, optional
  style:      'classic',         // free text, optional
  warmth:     3,                 // 1-5, see scale below. Required for tops/bottoms/dresses/shoes/jackets
  season:     ['spring','autumn'],   // subset of spring|summer|autumn|winter, [] = any
  formality:  3,                 // 1-5, see scale below
  occasions:  ['work','church','date'],  // [] = any
  waterproof: false,             // shoes and jackets only — drives the rain rule
  photoId:    'itm_1a2b3c',      // key into the blob store, or null
  notes:      '',
  lastWornAt: null,              // ISO date or null
  archived:   false,
}
```

**Warmth, 1–5 — put these words in the UI, not the numbers:**

| | Label | Means |
| --- | --- | --- |
| 1 | Hot days only | Tank, shorts, sandals, thin linen |
| 2 | Light | T-shirt, light blouse, thin dress |
| 3 | Mid | Long sleeve, jeans, sweatshirt |
| 4 | Warm | Sweater, fleece, lined trousers, boots |
| 5 | Winter | Parka, thermals, insulated boots |

**Formality, 1–5:**

| | Label |
| --- | --- |
| 1 | Home / lounge |
| 2 | Casual |
| 3 | Smart casual |
| 4 | Professional |
| 5 | Event |

Never show a bare number to the user. She should pick "Warm", not "4".

Occasions: `home, class, work, church, date, gym, errands, event, travel, interview`.

### R6 — Storage split

- **Metadata** in `createStore('wardrobe', { version: 1 })` → key `usm.wardrobe.v1`, envelope
  `{ v, updatedAt, data }`.
- **Photos** in `createBlobStore('wardrobe-photos')` (IndexedDB), keyed by `photoId`.

Photos must not go in localStorage. The quota is roughly 5 MB per origin and it stores strings, so
base64 inflates every image by about a third — three photos would exhaust it, and the failure mode is
a thrown `QuotaExceededError` that takes the metadata write down with it. IndexedDB stores Blobs
natively and has an order-of-magnitude more room.

Render photos with `URL.createObjectURL(blob)` and **revoke every object URL** when its tile leaves
the DOM. This is a grid that gets re-rendered on every filter change; without revocation a long
session leaks the entire wardrobe into memory.

### R7 — Compression before storing

Duplicate the `compressImage` logic from `src/modules/upload.js` lines 6–30 into `wardrobeStore.js`.

**Do not import `upload.js`.** It imports `./firebase.js`, which calls `getAnalytics(app)` at module
scope — importing it would send Google a pageview from this page and pull the entire Firebase SDK
into the bundle, for a page that needs neither. Duplicating thirty lines is the cheaper trade, and
the audit already records the bundle cost.

Use a smaller `maxWidth` than `upload.js` does: **640px at quality 0.8**. These render as thumbnails
in a grid, not full-screen in a lightbox, and 1200px would store four times the bytes for pixels
nobody sees. Note the divergence in a comment so the difference reads as deliberate.

### R8 — The recommendation engine

**Deterministic, local, rule-based scoring. Not an LLM call.** Justification, and this is a design
decision rather than a cost decision:

- It must work instantly and offline. A network round-trip to answer "what do I wear" loses to
  opening the wardrobe door.
- No key, so no proxy, so no backend — same constraint as the weather.
- **It must be explainable.** "Why did it pick this?" has to have a real answer, and a rule that
  fired is an answer where a sampled token is not.
- **Constraint is the whole product.** A filter over her own data cannot suggest something she does
  not own. A prompt can, and eventually will.

Signature:

```js
/**
 * @returns {{
 *   picks: { top, bottom, dress, shoes, layer, accessories: [] },
 *   reasons: string[],        // ordered, most important first
 *   warnings: string[],       // e.g. "nothing warm enough for -28°C in your closet yet"
 *   score: number
 * }}
 */
export function suggestOutfit({ wardrobe, weather, occasion, date, exclude = [], rng = Math.random })
```

Pass `rng` in so "give me another option" is reproducible in tests. Keep it side-effect free — no
storage writes, no `Date.now()`, no `console`.

Scoring inputs, roughly in priority order:

1. **Warmth against `feelsLikeC`.** Map apparent temperature to a target warmth band, score items by
   distance from it. This dominates, because being cold ruins a day in a way that being slightly
   over-dressed does not.
2. **Formality against occasion.** A hard-ish floor: never suggest formality 1 for `interview`,
   `work`, `church`, or `event`.
3. **Condition needs.** `rain`/`drizzle` ⇒ strongly prefer `waterproof` shoes and require an outer
   layer. `snow`/`freezing` ⇒ warmth-5 footwear. `windKph > 30` ⇒ require a layer. Every one of
   these must produce a matching `reasons` entry.
4. **Season** against the item's `season` array; `[]` matches everything.
5. **Recency**, as a **mild tiebreaker only.** Do **not** enforce a no-repeat rule. People re-wear
   their favourites and that is normal; a tool that refuses to suggest her favourite jeans two days
   running is wrong about clothes and it is also annoying.

**Extreme cold is a hard exclusion, not a preference.** Winnipeg reaches −30°C and colder, and −40°C
wind chill happens. Below about −20°C apparent, exclude warmth ≤ 2 outright for every slot, require a
warmth-5 layer, and require closed warm footwear. If her closet cannot satisfy that, say so plainly
in `warnings` — *"nothing in your closet is warm enough for −28°C yet"* — and return the warmest
available combination anyway. Never return nothing.

Output slots: **Top / Bottom** *or* **Dress** / **Shoes** / **Layer** / **Accessories**. When a dress
is chosen, `top` and `bottom` are null; the renderer must handle both shapes.

### R9 — The explanation is the feature

One or two short lines, in **his** voice, referencing the actual numbers that drove the choice:

> *"It's −24° with the wind, so: parka, the wool sweater, and the insulated boots. Not the day for the
> nice shoes."*

Requirements:

- Must cite real values from `weather` — the temperature, the condition, the wind. Generic filler
  ("great pick for today!") is a failure of this requirement.
- Assembled from a small set of **hand-written templates** with slots. Not generated prose.
- **The owner writes every template string.** Put them in one clearly-marked block at the top of
  `outfitEngine.js` so they are easy to find and rewrite.
- Warm, dry, a bit funny. Never instructional, never "optimal".

### R10 — Interaction

- **"Give me another option"** — reshuffle, passing the current picks as `exclude`.
- **Swap one slot** — tap a slot, see the ranked alternatives from her closet for that slot only,
  pick one. The rest of the outfit stays put. This is the escape hatch that makes a wrong suggestion
  cost two seconds instead of destroying trust.
- **Occasion picker** — a row of chips, defaulting to a sensible guess from the day of the week,
  changeable in one tap.
- **"That's what I wore"** — sets `lastWornAt` on the picked items. This is also the lazy-add hook:
  if she wore something not in the closet, one field adds it.

### R11 — Visual Outfit Mode — deferred, and here is the honest analysis

The appealing version composites photos of her actual clothes into a flat-lay. What that really
needs:

| Requirement | Cost |
| --- | --- |
| Background removal on every item photo | Manual prep in an image editor (hours, ongoing per item), a paid API (a key, so a backend, so no), or `@imgly/background-removal` in-browser (a multi-megabyte model download on a page that must feel instant) |
| Consistent framing and scale | A photography discipline she has not agreed to |
| Canvas compositing with per-category layout rules | Real work, and it looks wrong until it is finished |

**Verdict: MODERATE-to-COMPLEX, and out of scope for MVP.**

**Ship instead:** a simple CSS-grid collage of the actual item photos as an "outfit preview" — the
five tiles for the five slots, laid out cleanly. Zero dependencies, immediately valuable, and it
answers "what does this look like together?" well enough. Build the layout so a true composited
flat-lay could replace it later without touching the engine.

**Explicitly rejected: generating clothing images with AI.** Generating garments that merely resemble
what she owns inverts the entire premise of the feature — the promise is *the clothes you already
own*, and a plausible fake is a lie in a tool whose only job is to be actionable. Do not add it, do
not add it behind a flag.

### R12 — Accessories

Jewellery, bags, and accessory suggestions come from owned items where the closet has them. If those
categories are empty, omit the slot silently — an accessories row reading "add some jewellery" is
nagging, and nagging is what this project does not do.

### R13 — Reminder seam

Emit an optional morning "here's today's outfit" reminder for `11-NOTIFICATIONS.md`. Match the
pattern in `08-FRIENDS-FAMILY.md` exactly: a defensive dynamic `import()` in a `try`/`catch`, a
stable deterministic id (`outfit-<ISO date>`) so re-running never duplicates, and full functionality
when the notifications module is absent.

Opt-in, off by default.

### R14 — Export

Metadata-only JSON export, via the store's `export()`. **Photos are not included**, and the UI must
say so in plain words: *"Your item details are saved. Photos stay on this device — you'd need to add
those again."*

Why not include them: a zip needs a dependency, and base64-inlining fifteen photos produces a
multi-megabyte JSON file that is slow to generate, awkward to store, and likely to fail on a phone.
Re-adding photos is the accepted recovery cost, and it is proportionate — the item list is the part
that took effort to build.

---

## UX Requirements

**This page is used in a hurry, half-awake, one-handed, on a phone.** Everything follows from that.

- **The outfit is the landing content.** Weather summary and today's outfit above the fold, rendered
  without a single tap. The closet manager is secondary and lives behind a disclosure or a second
  view. If she has to tap "generate" to find out what to wear, the feature has failed at its one job.
- Render the cached forecast and an outfit **immediately**; refresh in place. Never block the outfit
  on the network.
- One primary action per screen. The occasion chips are the only thing she should reasonably touch
  before getting an answer.
- 44px minimum tap targets. The swap and reshuffle controls are thumb-reachable, not in a corner.
- `@media (max-width: 600px)` is the primary breakpoint. A second at 900px is permitted for the
  wardrobe grid only, where a one-column list on a tablet would be silly.
- `prefers-reduced-motion` honoured; `:focus-visible` rings on everything focusable.
- Both themes. Never hardcode a hex.
- Emoji, not an icon library — matching the rest of the site.

### States, all four required

- **Empty closet** — warm, not a form. Explain the promise in one sentence, offer "add your first
  few things", and if he seeded it she never sees this. Do not show a progress meter toward some
  item count.
- **Sparse closet** — works. Suggests from what exists. May note *"the more you add, the better this
  gets"* **once**, quietly, and never again.
- **Loading** — a skeleton for the weather line only. The outfit does not wait for it.
- **Errors** — weather failed, geolocation denied, IndexedDB blocked (private browsing). Each says
  what happened in one plain sentence and what still works. None of them is a dead end.

---

## Privacy & Security

- **Local only. No Firebase.** Do not import `src/modules/firebase.js`. Wardrobe photos are photos of
  her clothes in her home; they never leave the device.
- **The only network request this page makes is to Open-Meteo.** State this in the UI's about/help
  text, because it is the one privacy trade-off in the feature and she is entitled to know.
  Open-Meteo receives coordinates and nothing else — no account, no identifier, no cookie.
- **Send coarse coordinates.** Round to 2 decimal places (~1.1 km). Nothing about the recommendation
  improves with more precision, and city-block accuracy is not worth transmitting.
- The manual location override is the mitigation for anyone uncomfortable with geolocation at all —
  set it once and the browser API is never called.
- No analytics on this page. No `console.log` of wardrobe contents or coordinates.
- Nothing from this feature goes to LoveGPT, `functions/knowledge/chunks.json`, or any RAG index.
- Everything in `src/**` is inlined into `dist/` and published. So: **no real item names, photos, or
  wardrobe data may be committed** — not as fixtures, not as seed data, not as a test file. Seed data
  for development must be obviously fictional.

---

## Do Not

- Do not comment on her body, fit, size, or shape. No "flattering", no "slimming", no "for your body
  type", no compliments about appearance generated by code. This tool is about **weather and
  occasion**, full stop. It is the single hardest line in this file to hold, because the genre this
  feature belongs to is soaked in that language. Hold it.
- Do not call an LLM for recommendations.
- Do not generate clothing images.
- TypeScript / one UI framework / justified dependencies allowed per `RUN-SHEETS.md` Stack
  policy. Still forbidden: a background-removal model, generated clothing images, an LLM call.
- Do not import `upload.js`, `firebase.js`, or `auth.js`.
- Do not enforce no-repeat.
- Do not gate the page behind a minimum item count.
- Do not gamify: no streaks, no completion percentage, no "closet health score", no badges.
- Do not prompt for geolocation on load.
- Do not put photos in localStorage.
- Do not write a second IndexedDB wrapper or a second copy of the crypto.
- Do not touch any file in the Must Not Touch list, and do not change anything but `connect-src` in
  the other pages' HTML.
- No corporate or productivity framing. This is not a "wardrobe management system".

---

## Implementation Strategy

Commit after each step.

1. **`outfitEngine.js` first, with fictional data, in isolation.** It is pure, it holds all the
   judgement, and it is testable in a console before any UI exists. Get −25°C, +2°C rain, and +28°C
   producing three obviously different and obviously sensible outfits from the same fake closet.
   Everything after this is plumbing.
2. **`weather.js`** — fetch, normalise, WMO mapping, TTL cache, location resolution, all failure
   paths. Verify by throttling and blocking the request in DevTools.
3. **CSP** across all HTML files. Confirm identical. Do this before wondering why `fetch` fails.
4. **`wardrobeStore.js`** — metadata CRUD, blob store, `compressImage`, export. Test the quota path
   deliberately.
5. **`outfit.html` + `src/outfit.js`** — the outfit view only. Landing content, above the fold,
   working with a seeded fake closet.
6. **The closet manager** — grid, add/edit form, batch-add, photo capture with `capture="environment"`
   on the file input so the phone opens the camera.
7. **Swap, reshuffle, "that's what I wore".**
8. **States, both themes, 375px.**
9. **`vite.config.js` input entry, `foryou.js` card, `DOCS.md` line.** Run `npm run build`.
10. **Reminder seam** last, defensively.

---

## Acceptance Criteria

1. `outfit.html` builds and appears in `dist/` after `npm run build`, and `vite.config.js` has an
   `outfit` input entry.
2. Every HTML file's CSP `connect-src` includes `https://api.open-meteo.com`, and all CSP lines are
   byte-identical.
3. Opening the page with a seeded closet and a warm cache shows the weather and a complete outfit
   **above the fold with zero taps**, on a 375px viewport.
4. No geolocation permission prompt fires on page load.
5. With the same closet and occasion, `suggestOutfit` returns visibly different outfits at
   `feelsLikeC: -25` and `feelsLikeC: 25`. Different layer, different shoes, different warmth.
6. At `feelsLikeC: -25`, no item with `warmth <= 2` appears in any slot, and a warmth-5 layer is
   present or a `warnings` entry explains its absence.
7. With rain and `precipChance > 50`, waterproof shoes are preferred if owned and a layer is
   included, and `reasons` mentions the rain.
8. `reasons[0]` contains an actual numeric temperature or a named condition from the weather object.
   No generic filler.
9. A closet of exactly 12 items, some with no photo, produces a usable outfit with no error and no
   empty state.
10. An item with only a name and a category saves successfully.
11. Blocking the Open-Meteo request in DevTools still yields an outfit, plus an honest banner. Blank
    page or thrown error is a fail.
12. Photos are in IndexedDB (`wardrobe-photos`), not localStorage. DevTools → Application confirms
    both.
13. Every `createObjectURL` has a matching `revokeObjectURL`. Filtering the grid twenty times does
    not grow retained memory without bound.
14. A 4 MB photo is stored at roughly 640px wide and well under 200 KB.
15. `outfitEngine.js` imports only `dates.js`. No DOM, no storage, no network, no `Date.now()`.
16. `grep` confirms this feature imports neither `firebase.js` nor `upload.js`.
17. "Give me another option" changes the outfit. Swapping one slot leaves the others unchanged.
18. Export downloads valid JSON with all item metadata, and the UI states that photos are excluded.
19. Both themes, no hardcoded hex, `prefers-reduced-motion` honoured, all controls reachable by
    keyboard with a visible focus ring.
20. No body, size, fit, or appearance commentary anywhere in the UI copy or the templates.
21. The page works with the notifications module absent.
22. No real wardrobe data, photos, or coordinates are committed.

## Verification

```bash
# 1. Page is in the build
npm run build && ls dist/outfit.html

# 2. CSP identical across every page — should print ONE unique line
grep -h "Content-Security-Policy" *.html | sed 's/^ *//' | sort -u
grep -c "api.open-meteo.com" *.html        # every file must report 1

# 3. No forbidden imports
grep -rn "firebase\|upload\.js\|getAnalytics" src/outfit.js src/modules/wardrobeStore.js \
  src/modules/weather.js src/modules/outfitEngine.js        # expect no matches

# 4. Engine purity
grep -n "^import" src/modules/outfitEngine.js               # only dates.js
grep -n "document\|localStorage\|fetch\|Date.now\|console" src/modules/outfitEngine.js  # none

# 5. Object URLs are balanced
grep -c "createObjectURL" src/outfit.js src/modules/wardrobeStore.js
grep -c "revokeObjectURL" src/outfit.js src/modules/wardrobeStore.js

# 6. No committed wardrobe photos
git status --short && git ls-files | grep -iE "\.(jpe?g|png|webp|heic)$"
```

**Manual, on a real phone at 375px:**

1. Open cold with an empty cache. Time how long until an outfit is on screen. No permission prompt.
2. DevTools → Network → block `api.open-meteo.com`. Reload. Outfit still appears, banner explains.
3. Deny geolocation. Confirm the default location is used and the copy is not alarming.
4. Add an item with a 4 MB phone photo. Check stored size and grid render.
5. Add an item with a name and category only. Confirm it can be suggested.
6. In the console, call `suggestOutfit` at −25, +2 with rain, and +28. Read the three reasons aloud.
   Do they sound like you, or like a product?
7. Private/incognito window — IndexedDB may be restricted. Confirm a graceful message.
8. Both themes. Tab through everything.
9. Reshuffle ten times. Confirm it does not repeat identically and does not run out.

## Definition of Done

- [ ] `outfit.html`, `src/outfit.js`, `src/styles/outfit.css` shipped and in `vite.config.js`
- [ ] `outfitEngine.js` pure, and unit-testable — hand it to `15-TESTING-QA.md`
- [ ] `weather.js` with WMO mapping, 60-min TTL cache, and all four geolocation outcomes handled
- [ ] `wardrobeStore.js` with metadata in localStorage, photos in IndexedDB, 640px compression
- [ ] CSP updated in every HTML file, all lines identical
- [ ] Weather materially changes the outfit; extreme cold excludes light items
- [ ] Explanation cites real weather values, from owner-written templates
- [ ] Reshuffle and per-slot swap work
- [ ] "That's what I wore" sets `lastWornAt` and can lazily add an item
- [ ] Photo-collage outfit preview; no compositing, no generated images
- [ ] Empty, sparse, loading, and all error states designed and tested
- [ ] Metadata export with an honest note about photos
- [ ] Reminder seam optional and defensive
- [ ] Zero new dependencies; no Firebase import
- [ ] Both themes, 375px, keyboard, reduced-motion
- [ ] No appearance or body commentary anywhere
- [ ] `docs/anniversary/PAGE-CHECKLIST.md` items all ticked
- [ ] **Owner has seeded 10–15 real items before she sees it**

---

## Final quality test

She opens it on a Tuesday morning in January, still half asleep, and it says: *"It's −24° with the
wind. Parka, the wool sweater, the insulated boots. Not the day for the nice shoes."*

If her reaction is *"oh good, that's decided"* — it works.

If it is *"let me just check the weather app"* — the weather line is not trusted, or the outfit is not
specific enough to act on.

If it is *"I should really finish adding my clothes"* — the feature has become a chore, and that is
the failure mode this file exists to prevent.
