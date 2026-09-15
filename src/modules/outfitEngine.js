/**
 * outfitEngine.js — PURE outfit scoring for What to Wear (10-OUTFIT-OF-THE-DAY R8/R9).
 *
 *   suggestOutfit({ wardrobe, weather, occasion, date, exclude, rng })
 *     → { picks: { top, bottom, dress, shoes, layer, accessories: [] }, reasons, warnings, score }
 *   rankSlot({ wardrobe, weather, occasion, date, slot, exclude, rng })
 *     → [{ item, score, eligible, note }]      ranked alternatives for one slot (the swap sheet)
 *   explainOutfit({ picks, weather, occasion, date, wardrobe })
 *     → { reasons, warnings }                  re-explain after a swap
 *
 * Contract: zero DOM, zero storage, zero network, no clock reads, no logging.
 * The only import is dates.js. `date` is passed in (ISO 'YYYY-MM-DD' or a Date)
 * and `rng` is injectable, so every result is reproducible in a test.
 *
 * Deterministic, local, rule-based. Not an LLM. Every rule that changes a
 * pick produces a `reasons` entry, so "why this?" always has a real answer.
 *
 * Weather is the normalised shape from weather.js (never an Open-Meteo payload):
 *   { tempC, feelsLikeC, tempMinC, tempMaxC, windKph, precipMm, precipChance,
 *     code, condition, isDaytime, locationLabel, stale, … }
 * `weather` may be null — the outfit is then based on the season alone.
 *
 * NOTHING in this file may comment on body, fit, size, or appearance. It is
 * about weather and occasion, full stop.
 */

import { parseISO, daysBetween } from './dates.js';

/* ═══════════════════════════════════════════════════════════════════════════
   ✍️  TEMPLATES — every line she reads comes from here. Owner-written.
   Rewrite freely; keep the {slots}. Available slots:

     {feels}        apparent temperature, e.g. −24°  (already has the ° sign)
     {temp}         air temperature, same format
     {cond}         a plain word for the sky: "snowing", "grey", "clear", …
     {wind}         wind speed, e.g. 35 km/h
     {chance}       precipitation chance, e.g. 70%
     {pieces}       every core pick, joined: "the parka, the wool sweater and the boots"
     {main}         the top and bottom ("the wool sweater and the black jeans") or the dress
     {layer}        the jacket / coat            (only in templates marked "needs layer")
     {shoes}        the shoes                    (only in templates marked "needs shoes")
     {season}       "winter" | "spring" | "summer" | "autumn"
     {occasion}     the occasion word, e.g. "church"

   A template is only used when every slot it mentions is actually filled, so
   a closet with no jacket never produces "the undefined".
   ═══════════════════════════════════════════════════════════════════════════ */

const HEADLINES = {
  home: [
    'Staying in: {main}. Soft, easy, done.',
    'Home mode. {main} and no overthinking it.',
  ],
  onlineDate: [
    'FaceTime date tonight: {main}. Comfortable, cute, camera-ready.',
    'Online date pick: {main}. No outside clothes required.',
    'For seeing each other through a screen: {main}. Cozy still counts.',
  ],
  // feels ≤ −20 — the hard-exclusion band
  extremeCold: [
    "It's {feels} with the wind, so: {layer}, {main}, and {shoes}. Not the day for the nice shoes.",
    '{feels} out there. {layer} over {main}, {shoes}, and nothing light — I checked.',
    "{feels}. {layer} — and it isn't a discussion. {main}, {shoes}, and go.",
    // no layer in the closet
    "It's {feels} with the wind. {main} and {shoes} — and the warmest coat you can find, because there isn't one in here yet.",
  ],
  // −20 < feels ≤ −8
  cold: [
    "{feels} and {cond}. {layer}, {main}, {shoes}. Don't linger at the bus stop.",
    "It's {feels} — proper winter. {layer}, {main}, and {shoes}. You'll be glad of all three.",
    '{feels} today. {layer} over {main}, {shoes} on. Standard Winnipeg issue.',
    '{feels} and {cond}. {main} and {shoes}, plus whatever coat is by the door.',
  ],
  // −8 < feels ≤ 4
  chilly: [
    "{feels} and {cond}. {layer}, {main}, {shoes}. Cold enough to notice, that's all.",
    "It's {feels} out. {main} with {layer} on top, {shoes} — you'll be fine.",
    '{feels} and {cond}, so {layer} goes on. {main}, {shoes}.',
    '{feels} and {cond}. {main} and {shoes}; grab a jacket on the way out.',
  ],
  // 4 < feels ≤ 14
  cool: [
    "{feels} and {cond} — {layer}, but only just. {main}, {shoes}.",
    "It's {feels}. {main}, {shoes}, and {layer} for the walk.",
    '{feels} and {cond}. {main} and {shoes} — a jacket if you feel like one.',
  ],
  // 14 < feels ≤ 23
  mild: [
    '{feels} and {cond}. {main}, {shoes}. Easy one.',
    "It's {feels} — actually nice out. {main} and {shoes}.",
    '{feels} and {cond}: {main}, {shoes}, and {layer} in case the wind picks up.',
  ],
  // feels > 23
  hot: [
    "{feels} and {cond}. {main}, {shoes}, and that's honestly it.",
    "It's {feels}. {main} and {shoes} — nothing heavy today, I made sure.",
    '{feels} out there. Keep it light: {main}, {shoes}.',
  ],
  // weather unavailable — season only
  noWeather: [
    "Couldn't see the sky this morning, so I'm going by {season}: {layer}, {main}, {shoes}.",
    "No forecast today, so a {season} guess: {main} and {shoes}.",
    "Weather's not answering. Going by {season}: {pieces}.",
  ],
};

const RULE_LINES = {
  // condition rules — each of these fires only when the rule actually changed something
  rainWaterproof:    '{chance} chance of rain — which is why {shoes}, and why {layer} isn’t optional.',
  rainNoWaterproof:  "{chance} chance of rain and nothing waterproof in here yet, so {shoes} it is — mind the puddles.",
  rainNoLayer:       "{chance} chance of rain. There's no jacket in the closet yet, so take an umbrella.",
  snowBoots:         "It's {cond}, so {shoes} — the warm, closed ones.",
  snowNoBoots:       "It's {cond} and there are no proper winter boots in here yet — the warmest you've got is {shoes}.",
  windLayer:         'Wind is {wind}. {layer} stays on.',
  windNoLayer:       "Wind is {wind} and there's no jacket in the closet yet. Wear the one by the door.",
  extremeExcluded:   "Anything light stayed in the drawer — it's {feels}.",
  extremeNoLayer:    "There's nothing in the closet warm enough for {feels} yet. This is the warmest I could put together.",
  extremeNoBoots:    'No winter boots in the closet yet — the warmest I could find is {shoes}.',
  hotExcluded:       "It's {feels}, so nothing warm made the list.",

  // occasion rules
  occasion: {
    interview: 'Interview today, so {main} — dressed up enough without looking like you tried.',
    work:      'Work, so {main}. Smart enough, comfortable enough.',
    church:    'Church, so {main}.',
    event:     "It's an event, so {main} — the good stuff.",
    date:      'Date, so {main}. You know what you’re doing.',
    'online-date': 'FaceTime date: {main}. Cute, comfortable, and no outside shoes required.',
    brunch:    'Brunch, so {main} — easy, bright, and ready for pictures.',
    hangout:   'A hangout day: {main}. Relaxed, but still put together.',
    study:     'Study day, so {main}. Comfortable enough to stay focused.',
    dinner:    'Dinner plans, so {main} — a little more dressed up.',
    gym:       'Gym: {main} and {shoes}. Nobody there cares, that’s the point.',
    home:      'Home day. {main} — comfort wins.',
    travel:    'Travel, so {main} — things you can sit in for hours.',
  },
  formalityFallback: "Nothing in the closet is quite dressed-up enough for {occasion} yet — this is the closest.",

  // the once-only sparse-closet nudge (the UI shows it once and never again)
  sparse: 'The more you add, the better this gets. No rush.',
};

/* ═══════════════════════════ end of owner templates ═══════════════════════════ */

/* ────────────────────────────── vocab & scales ────────────────────────────── */

export const OCCASIONS = [
  'home', 'class', 'work', 'church', 'date', 'online-date', 'brunch',
  'hangout', 'study', 'dinner', 'gym', 'errands', 'event', 'travel', 'interview',
];
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

/** Slots → categories. Accessories are the three optional categories. */
export const SLOT_CATEGORIES = {
  top: ['tops'],
  bottom: ['bottoms'],
  dress: ['dresses'],
  shoes: ['shoes'],
  layer: ['jackets'],
  accessories: ['bags', 'jewellery', 'accessories'],
};

/** Occasion → { target formality, hard floor }. Floor 1 = no floor. */
const OCCASION_FORMALITY = {
  home:      { target: 1,   floor: 1 },
  'online-date': { target: 1.5, floor: 1 },
  gym:       { target: 1.5, floor: 1 },
  errands:   { target: 2,   floor: 1 },
  study:     { target: 2,   floor: 1 },
  hangout:   { target: 2.5, floor: 1 },
  travel:    { target: 2,   floor: 1 },
  class:     { target: 2.5, floor: 1 },
  brunch:    { target: 3,   floor: 1 },
  date:      { target: 3.5, floor: 1 },
  dinner:    { target: 4,   floor: 2 },
  work:      { target: 4,   floor: 2 },  // never formality 1
  church:    { target: 4,   floor: 2 },  // never formality 1
  event:     { target: 4.5, floor: 2 },  // never formality 1
  interview: { target: 4.5, floor: 2 },  // never formality 1
};

/** Thresholds (apparent °C). Extreme cold is a hard exclusion, not a preference. */
export const EXTREME_COLD_C = -20;
export const HOT_C = 26;

/** Rough apparent temperature per season, used only when there is no weather at all. */
const SEASON_FEELS = { winter: -15, spring: 6, summer: 22, autumn: 6 };

/** Scoring weights. Warmth dominates; recency is a whisper. */
const W = {
  warmth: 3,
  formality: 2,
  occasion: 1.5,
  season: 0.8,
  condition: 2.5,
  recency: 0.4,
  exclude: 5,
  jitter: 0.6,
};

/** Older broad tags still count for newer, more specific occasions. */
const OCCASION_AFFINITIES = {
  brunch: ['date', 'church', 'class'],
  dinner: ['date', 'event', 'church'],
  hangout: ['class', 'errands', 'date'],
  study: ['class', 'home'],
  'online-date': ['home'],
};

/* ────────────────────────────── small helpers ────────────────────────────── */

/** Northern-hemisphere meteorological season for a date. */
export function seasonFor(date) {
  const d = date instanceof Date ? date : parseISO(String(date));
  const m = Number.isNaN(d.getTime()) ? 0 : d.getMonth();
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

/**
 * Apparent temperature → target warmth (1–5), piecewise linear.
 *   ≤ −20 → 5 · −8 → 4.5 · 2 → 4 · 10 → 3 · 18 → 2.5 · 24 → 2 · ≥ 28 → 1
 */
function targetWarmth(feels) {
  const pts = [[-20, 5], [-8, 4.5], [2, 4], [10, 3], [18, 2.5], [24, 2], [28, 1]];
  if (feels <= pts[0][0]) return pts[0][1];
  if (feels >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (feels <= x1) return y0 + ((feels - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 3;
}

function bandFor(feels) {
  if (feels === null) return 'noWeather';
  if (feels <= EXTREME_COLD_C) return 'extremeCold';
  if (feels <= -8) return 'cold';
  if (feels <= 4) return 'chilly';
  if (feels <= 14) return 'cool';
  if (feels <= 23) return 'mild';
  return 'hot';
}

/** −24° with a real minus sign; never "-24" or "−0". */
function formatDeg(c) {
  const n = Math.round(c);
  return (n < 0 ? '−' : '') + Math.abs(n) + '°';
}

const CONDITION_WORDS = {
  clear: 'clear',
  cloudy: 'grey',
  fog: 'foggy',
  drizzle: 'drizzly',
  rain: 'raining',
  freezing: 'freezing rain',
  snow: 'snowing',
  storm: 'stormy',
};

/** "Camel trench" → "the camel trench"; "H&M blazer" stays "the H&M blazer". */
function theName(item) {
  if (!item) return '';
  const n = String(item.name || '').trim();
  if (!n) return 'that one';
  const lowered = n.length > 1 && /^[A-Z][a-z]/.test(n) ? n[0].toLowerCase() + n.slice(1) : n;
  return `the ${lowered}`;
}

function joinNames(items) {
  const names = items.filter(Boolean).map(theName);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function fill(template, slots) {
  const out = template.replace(/\{(\w+)\}/g, (_, k) => (slots[k] === undefined || slots[k] === null ? '' : String(slots[k])));
  // "the parka" at the start of a sentence → "The parka"
  return out.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead, ch) => lead + ch.toUpperCase());
}

function placeholdersOf(template) {
  return Array.from(template.matchAll(/\{(\w+)\}/g), (m) => m[1]);
}

/**
 * Pick, via rng, a template whose every placeholder is available, and fill it.
 * When a layer is being worn, templates that mention it are preferred, so the
 * "no coat in here yet" variants only appear when that is actually true.
 */
function chooseTemplate(list, slots, rng) {
  const has = (k) => slots[k] !== undefined && slots[k] !== null && slots[k] !== '';
  let usable = list.filter((t) => placeholdersOf(t).every(has));
  if (has('layer')) {
    const withLayer = usable.filter((t) => placeholdersOf(t).includes('layer'));
    if (withLayer.length > 0) usable = withLayer;
  }
  if (usable.length === 0) return null;
  return fill(usable[Math.min(usable.length - 1, Math.floor(rng() * usable.length))], slots);
}

function num(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/* ─────────────────────────────── context ─────────────────────────────── */

/**
 * Everything the rules need, derived once from the inputs.
 * @param {{ weather: object|null, occasion: string|null, date: Date|string, exclude?: string[], rng?: () => number }} input
 */
function buildContext({ weather, occasion, date, exclude = [], rng = Math.random }) {
  const season = seasonFor(date);
  const hasWeather = !!weather && (typeof weather.feelsLikeC === 'number' || typeof weather.tempC === 'number');
  const feels = hasWeather ? num(weather.feelsLikeC, weather.tempC) : null;
  const tempC = hasWeather ? num(weather.tempC, feels) : null;
  const effectiveFeels = feels === null ? SEASON_FEELS[season] : feels;
  const condition = hasWeather ? String(weather.condition || 'clear') : null;
  const windKph = hasWeather ? num(weather.windKph, 0) : 0;
  const precipChance = hasWeather ? num(weather.precipChance, 0) : 0;

  const wet = hasWeather && (condition === 'rain' || condition === 'drizzle' || condition === 'storm' || precipChance > 50);
  const snowy = hasWeather && (condition === 'snow' || condition === 'freezing');
  const windy = windKph > 30;
  const extreme = effectiveFeels <= EXTREME_COLD_C;
  const hot = effectiveFeels >= HOT_C;

  const occ = OCCASIONS.includes(occasion) ? occasion : null;
  const formality = occ ? OCCASION_FORMALITY[occ] : { target: 2.5, floor: 1 };
  const indoors = occ === 'home' || occ === 'online-date';
  const outfitFeels = indoors ? 21 : effectiveFeels;

  return {
    season,
    hasWeather,
    feels,
    tempC,
    effectiveFeels,
    target: targetWarmth(outfitFeels),
    band: bandFor(feels),
    condition,
    windKph,
    precipChance,
    wet: indoors ? false : wet,
    snowy: indoors ? false : snowy,
    windy: indoors ? false : windy,
    extreme: indoors ? false : extreme,
    hot: indoors ? false : hot,
    indoors,
    // Indoor modes deliberately ignore the forecast.
    needLayer: !indoors && (effectiveFeels < 14 || wet || windy),
    wantLayer: !indoors && effectiveFeels < 19,
    occasion: occ,
    formality,
    date: date instanceof Date ? date : parseISO(String(date)),
    exclude: new Set(exclude || []),
    rng: typeof rng === 'function' ? rng : Math.random,
  };
}

/* ─────────────────────────────── scoring ─────────────────────────────── */

/**
 * Score one item for one slot. `hard` is a reason key when the item is excluded
 * outright for today (extreme cold, heat, formality floor); it is never a
 * preference — a hard-failed item is only used when the slot would otherwise
 * be empty, and then a warning says so.
 */
function scoreItem(item, slot, ctx) {
  let score = 0;
  let hard = null;
  const hasWarmth = typeof item.warmth === 'number';
  const warmth = hasWarmth ? item.warmth : 3;
  const isCore = slot !== 'accessories';

  // 1. Warmth against apparent temperature — dominates. Being cold is worse than being over-dressed.
  if (hasWarmth || isCore) {
    const d = warmth - ctx.target;
    const conf = hasWarmth ? 1 : 0.5; // unknown warmth counts as "mid", softly
    score -= (d < 0 ? 1.4 : 1) * W.warmth * Math.abs(d) * conf;
  }
  if (ctx.extreme && hasWarmth) {
    if (slot === 'layer' && warmth < 5) hard = 'extremeNoLayer';          // require a warmth-5 layer
    else if (slot === 'shoes' && warmth < 4) hard = 'extremeNoBoots';     // require closed warm footwear
    else if (warmth <= 2) hard = 'extremeExcluded';                       // light items out, every slot
  }
  if (ctx.hot && hasWarmth && warmth >= 4) hard = hard || 'hotExcluded';
  // a scarf or toque is not an accessory above ~8°
  if (slot === 'accessories' && hasWarmth && warmth >= 4 && ctx.effectiveFeels > 8) hard = hard || 'hotExcluded';

  // 2. Formality against occasion — a hard-ish floor.
  if (isCore) {
    const hasF = typeof item.formality === 'number';
    const f = hasF ? item.formality : 3;
    const d = f - ctx.formality.target;
    score -= W.formality * Math.abs(d) * (d < 0 && ctx.formality.floor > 1 ? 1.3 : 1) * (hasF ? 1 : 0.5);
    if (hasF && f < ctx.formality.floor) hard = hard || 'formalityFallback';
  }

  // Occasion tags. [] = any.
  if (ctx.occasion && Array.isArray(item.occasions) && item.occasions.length > 0) {
    const related = OCCASION_AFFINITIES[ctx.occasion] || [];
    const exact = item.occasions.includes(ctx.occasion);
    const adjacent = related.some((tag) => item.occasions.includes(tag));
    score += exact ? W.occasion * 1.5 : adjacent ? W.occasion * 0.65 : -W.occasion * 0.8;
  }

  const styleText = `${item.name || ''} ${item.style || ''} ${item.notes || ''}`.toLowerCase();
  const nightwear = /night|sleep|top\s*&\s*shorts/.test(styleText);
  if (ctx.occasion === 'online-date') score += nightwear ? 8 : 0;
  else if (nightwear && ctx.occasion !== 'home') score -= 6;

  // 3. Condition needs.
  if (slot === 'shoes') {
    if (ctx.wet) score += item.waterproof ? W.condition : -W.condition * 0.6;
    if (ctx.snowy && hasWarmth) score += warmth >= 5 ? W.condition : warmth >= 4 ? 0 : -W.condition;
    if (ctx.snowy && item.waterproof) score += W.condition * 0.3;
  }
  if (slot === 'layer') {
    if (ctx.wet && item.waterproof) score += W.condition * 0.6;
    if (ctx.windy && hasWarmth) score += warmth >= 3 ? W.condition * 0.3 : 0;
  }
  if (slot === 'accessories' && hasWarmth) {
    // a scarf or toque in the cold, not in July
    if (ctx.effectiveFeels <= -8 && warmth >= 4) score += W.condition * 0.5;
  }

  // 4. Season. [] = any.
  if (Array.isArray(item.season) && item.season.length > 0) {
    score += item.season.includes(ctx.season) ? W.season * 0.5 : -W.season;
  }

  // 5. Recency — a mild tiebreaker only. No no-repeat rule, ever.
  if (item.lastWornAt) {
    const ago = daysBetween(item.lastWornAt, ctx.date);
    if (Number.isFinite(ago)) {
      if (ago >= 0 && ago <= 1) score -= W.recency;
      else if (ago > 1 && ago <= 3) score -= W.recency * 0.5;
    }
  } else {
    score += 0.1;
  }

  // "Give me another option": a strong nudge away from the current picks, not a ban.
  if (ctx.exclude.has(item.id)) score -= W.exclude;

  // A little variety among near-equals, reproducible through rng.
  score += (ctx.rng() - 0.5) * W.jitter;

  return { item, score, hard };
}

function itemsFor(wardrobe, categories) {
  return (wardrobe || []).filter((it) => it && !it.archived && categories.includes(it.category));
}

/**
 * Rank the candidates for one slot. Eligible (no hard failure) first, by score;
 * hard-failed items after, by score, so a swap sheet can still show them, marked.
 * @returns {{ ranked: {item, score, eligible, note}[], fallbackKey: string|null }}
 */
function rankCandidates(wardrobe, slot, categories, ctx) {
  const scored = itemsFor(wardrobe, categories).map((it) => scoreItem(it, slot, ctx));
  const eligible = scored.filter((s) => !s.hard).sort((a, b) => b.score - a.score);
  const failed = scored.filter((s) => s.hard).sort((a, b) => b.score - a.score);
  let fallbackKey = null;
  if (eligible.length === 0 && failed.length > 0) {
    // Never return nothing: use the least-bad, and say so.
    fallbackKey = failed[0].hard;
  }
  const ranked = [
    ...eligible.map((s) => ({ item: s.item, score: s.score, eligible: true, note: null })),
    ...failed.map((s) => ({ item: s.item, score: s.score, eligible: fallbackKey !== null, note: s.hard })),
  ];
  return { ranked, fallbackKey };
}

/** Rotate among choices that are close enough to the best one to still make sense. */
function chooseNearBest(ranked, rng, { limit = 6, tolerance = 2.4 } = {}) {
  if (!ranked.length) return null;
  const usable = ranked.filter((row) => row.eligible).slice(0, limit);
  if (!usable.length) return ranked[0];
  const pool = usable.filter((row) => usable[0].score - row.score <= tolerance);
  if (pool.length <= 1) return pool[0] || ranked[0];
  // Bias toward the strongest choices without making the first one inevitable.
  return pool[Math.floor(Math.pow(rng(), 1.45) * pool.length)];
}

function words(value) {
  return new Set(String(value || '').toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 2));
}

/** A small coordination bonus; weather and occasion still dominate. */
function pairCompatibility(top, bottom) {
  const topStyle = String(top.style || '').toLowerCase();
  const bottomStyle = String(bottom.style || '').toLowerCase();
  const topColour = String(top.colour || '').toLowerCase();
  const bottomColour = String(bottom.colour || '').toLowerCase();
  if (topStyle.includes('matching set') && bottomStyle.includes('matching set') && topColour === bottomColour) return 4;

  let score = 0;
  const sharedColours = [...words(topColour)].filter((colour) => words(bottomColour).has(colour));
  if (sharedColours.length) score += 0.75;
  const neutral = /black|white|beige|brown|cream|grey|gray/;
  if (neutral.test(topColour) || neutral.test(bottomColour)) score += 0.35;
  if (topStyle.includes('net') && bottomStyle.includes('net') && topColour === bottomColour) score += 2.5;
  return score;
}

/* ─────────────────────────────── public API ─────────────────────────────── */

/**
 * Ranked alternatives for a single slot — the swap sheet. Same inputs as
 * suggestOutfit plus `slot` ∈ top | bottom | dress | shoes | layer | bags |
 * jewellery | accessories.
 */
export function rankSlot({ wardrobe, weather, occasion, date, slot, exclude = [], rng = Math.random }) {
  const ctx = buildContext({ weather, occasion, date, exclude, rng });
  const categories = SLOT_CATEGORIES[slot] || [slot];
  const scoringSlot = SLOT_CATEGORIES[slot] ? slot : 'accessories';
  return rankCandidates(wardrobe, scoringSlot, categories, ctx).ranked;
}

/**
 * @param {{ wardrobe: object[], weather: object|null, occasion?: string|null, date: Date|string, exclude?: string[], rng?: () => number }} input
 * @returns {{ picks: { top, bottom, dress, shoes, layer, accessories: object[] }, reasons: string[], warnings: string[], score: number }}
 */
export function suggestOutfit({ wardrobe, weather, occasion = null, date, exclude = [], rng = Math.random }) {
  const ctx = buildContext({ weather, occasion, date, exclude, rng });
  const fallbacks = new Set();

  const rank = (slot) => {
    const { ranked, fallbackKey } = rankCandidates(wardrobe, slot, SLOT_CATEGORIES[slot], ctx);
    if (fallbackKey) fallbacks.add(fallbackKey);
    return ranked;
  };

  const topRanked = rank('top');
  const bottomRanked = rank('bottom');
  const dress = chooseNearBest(rank('dress'), ctx.rng);
  const shoes = chooseNearBest(rank('shoes'), ctx.rng);

  // Score coordinated top + bottom combinations instead of choosing each half
  // independently. This unlocks many more sensible looks from the same closet.
  const pairOptions = [];
  for (const top of topRanked.filter((row) => row.eligible).slice(0, 8)) {
    for (const bottom of bottomRanked.filter((row) => row.eligible).slice(0, 8)) {
      pairOptions.push({
        top,
        bottom,
        score: (top.score + bottom.score) / 2 + pairCompatibility(top.item, bottom.item),
        eligible: true,
      });
    }
  }
  pairOptions.sort((a, b) => b.score - a.score);
  const pair = chooseNearBest(pairOptions, ctx.rng, { limit: 12, tolerance: 2.8 });
  const top = pair?.top || chooseNearBest(topRanked, ctx.rng);
  const bottom = pair?.bottom || chooseNearBest(bottomRanked, ctx.rng);

  // Dress, or top + bottom. Compare the best of each; near-ties go to rng.
  let useDress = false;
  if (dress && (!top || !bottom)) useDress = true;
  else if (dress && top && bottom) {
    const pairScore = pair?.score ?? (top.score + bottom.score) / 2;
    const diff = dress.score - pairScore;
    useDress = ctx.occasion === 'online-date' && dress.score >= pairScore - 1
      ? true
      : Math.abs(diff) < 1.25 ? ctx.rng() < 0.5 : diff > 0;
  }

  // Layer: required in the cold / wet / wind, welcome up to ~19°, otherwise none.
  let layer = null;
  if (ctx.needLayer || ctx.wantLayer) {
    const { ranked, fallbackKey } = rankCandidates(wardrobe, 'layer', SLOT_CATEGORIES.layer, ctx);
    layer = chooseNearBest(ranked, ctx.rng);
    // When a layer is merely optional and the best one scores badly (too warm), skip it.
    if (layer && !ctx.needLayer && layer.score < -W.warmth) layer = null;
    if (fallbackKey && ctx.needLayer) fallbacks.add(fallbackKey);
  }

  // Accessories: one per category, from what she owns. Empty categories are silently omitted.
  const accessories = [];
  for (const cat of SLOT_CATEGORIES.accessories) {
    if (cat === 'jewellery' && ctx.occasion === 'gym') continue;
    const { ranked, fallbackKey } = rankCandidates(wardrobe, 'accessories', [cat], ctx);
    const best = chooseNearBest(ranked, ctx.rng, { limit: 4, tolerance: 1.5 });
    // Omit silently when nothing fits the day; an accessories row is never a nag.
    if (best && !fallbackKey && best.note === null && best.score > -2) accessories.push(best.item);
  }

  const picks = {
    top: useDress ? null : (top ? top.item : null),
    bottom: useDress ? null : (bottom ? bottom.item : null),
    dress: useDress ? dress.item : null,
    shoes: ctx.indoors ? null : (shoes ? shoes.item : null),
    layer: layer ? layer.item : null,
    accessories,
  };

  const coreScores = [useDress ? dress : top, useDress ? null : bottom, shoes, layer].filter(Boolean).map((s) => s.score);
  const score = coreScores.length ? Math.round((coreScores.reduce((a, b) => a + b, 0) / coreScores.length) * 100) / 100 : 0;

  const { reasons, warnings } = explain(picks, ctx, fallbacks);
  return { picks, reasons, warnings, score };
}

/**
 * Re-explain a set of picks (after a swap) without re-choosing anything.
 */
export function explainOutfit({ picks, weather, occasion = null, date, rng = Math.random }) {
  const ctx = buildContext({ weather, occasion, date, exclude: [], rng });
  return explain(picks, ctx, new Set());
}

/* ─────────────────────────────── explanation ─────────────────────────────── */

function explain(picks, ctx, fallbacks) {
  const reasons = [];
  const warnings = [];
  const feelsText = ctx.feels === null ? null : formatDeg(ctx.feels);

  const main = picks.dress ? theName(picks.dress) : joinNames([picks.top, picks.bottom]);
  const slots = {
    feels: feelsText,
    temp: ctx.tempC === null ? null : formatDeg(ctx.tempC),
    cond: ctx.condition ? CONDITION_WORDS[ctx.condition] || ctx.condition : null,
    wind: ctx.hasWeather ? `${Math.round(ctx.windKph)} km/h` : null,
    chance: ctx.hasWeather ? `${Math.round(ctx.precipChance)}%` : null,
    pieces: joinNames([picks.layer, picks.dress, picks.top, picks.bottom, picks.shoes]) || null,
    main: main || null,
    layer: picks.layer ? theName(picks.layer) : null,
    shoes: picks.shoes ? theName(picks.shoes) : null,
    season: ctx.season,
    occasion: ctx.occasion,
  };

  const anyCore = picks.dress || picks.top || picks.bottom || picks.shoes || picks.layer;
  if (!anyCore) {
    warnings.push('Nothing in the closet yet to choose from.');
    return { reasons, warnings };
  }

  // 1. Indoor occasions lead with the plan; outdoor ones lead with weather.
  const headlineTemplates = ctx.occasion === 'online-date'
    ? HEADLINES.onlineDate
    : ctx.occasion === 'home'
      ? HEADLINES.home
      : HEADLINES[ctx.band];
  const headline = chooseTemplate(headlineTemplates, slots, ctx.rng)
    || (feelsText ? fill('{feels} and {cond}. {pieces}.', slots) : fill("Going by {season}: {pieces}.", slots));
  reasons.push(headline);

  // 2. Rules that fired, most important first.
  if (ctx.extreme) {
    if (fallbacks.has('extremeNoLayer') || (!picks.layer)) {
      reasons.push(fill(RULE_LINES.extremeNoLayer, slots));
      warnings.push(`Nothing in your closet is warm enough for ${feelsText} yet — this is the warmest combination I could find.`);
    } else {
      reasons.push(fill(RULE_LINES.extremeExcluded, slots));
    }
    if (fallbacks.has('extremeNoBoots') && picks.shoes) {
      reasons.push(fill(RULE_LINES.extremeNoBoots, slots));
      warnings.push(`No winter boots in your closet yet — the warmest option for ${feelsText} is ${theName(picks.shoes)}.`);
    }
  } else if (ctx.hot) {
    reasons.push(fill(RULE_LINES.hotExcluded, slots));
  }

  if (ctx.snowy && picks.shoes) {
    const warm = typeof picks.shoes.warmth === 'number' && picks.shoes.warmth >= 4;
    reasons.push(fill(warm ? RULE_LINES.snowBoots : RULE_LINES.snowNoBoots, slots));
  }

  if (ctx.wet) {
    if (picks.shoes && picks.shoes.waterproof && picks.layer) reasons.push(fill(RULE_LINES.rainWaterproof, slots));
    else if (picks.shoes && !picks.shoes.waterproof && picks.layer) reasons.push(fill(RULE_LINES.rainNoWaterproof, slots));
    else if (!picks.layer) reasons.push(fill(RULE_LINES.rainNoLayer, slots));
  }

  if (ctx.windy && !ctx.wet) {
    reasons.push(fill(picks.layer ? RULE_LINES.windLayer : RULE_LINES.windNoLayer, slots));
  }

  if (ctx.needLayer && !picks.layer && !ctx.extreme && !ctx.wet && !ctx.windy) {
    warnings.push('No jacket in your closet yet — it’s a jacket kind of day.');
  }

  // 3. Occasion.
  if (!ctx.indoors && ctx.occasion && RULE_LINES.occasion[ctx.occasion] && slots.main) {
    const line = RULE_LINES.occasion[ctx.occasion];
    if (placeholdersOf(line).every((k) => slots[k])) reasons.push(fill(line, slots));
  }
  if (fallbacks.has('formalityFallback') && ctx.occasion) {
    reasons.push(fill(RULE_LINES.formalityFallback, slots));
    warnings.push(`Nothing in your closet is dressed-up enough for ${ctx.occasion} yet.`);
  }
  if (fallbacks.has('hotExcluded') && feelsText) {
    warnings.push(`Everything in your closet is on the warm side for ${feelsText}.`);
  }

  return { reasons, warnings };
}

/** The once-only nudge for a sparse closet; the UI decides whether to show it. */
export const SPARSE_CLOSET_LINE = RULE_LINES.sparse;
