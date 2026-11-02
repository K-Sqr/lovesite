/**
 * story.js — the Daybreak deck: one long night that turns into morning.
 *
 *   buildStory(stats, notes, { onDone, onSkip, birthday }) → { el, start() }
 *
 * Fifteen layers sit stacked in a fixed stage. Each one carries its own sky,
 * tinted by where the sun really was over Winnipeg at that moment. A tap, a
 * swipe or an arrow key peels the top layer away from its corner to show the
 * next. Under reduced motion the layers simply swap.
 *
 * Every shape is data: the horizon is our days, the stars are the nights we
 * fell asleep on a call, the orbit is her year.
 */

import { svgIcon } from '../icons.js';
import { el, dateOf, fmtInt, fmtNum, hms, clock, longDate, monthDay, monthLabel, hourLabel, ordinal, callerSentence, prefersReducedMotion, plural, hoursMinutes } from './format.js';
import { noteBlock } from './notes.js';
import { countUp, countUpClock } from './countup.js';
import { horizon, starField, orbit, monthlyLine, splitBar } from './charts.js';
import { heartsBurst, birthdayState, lateNightLine, tripLabel } from './surprises.js';

const PEEL_MS = 980;

/** "Click" with a mouse or trackpad, "Tap" on a phone. */
function tapWord() {
  const fine = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  return fine ? 'Click' : 'Tap';
}

/* ───────────── the skies, one per layer ───────────── */
// top, mid, bottom: the gradient. ink: text. land: the horizon silhouette.
// stars: how many nights to show (0 = none). sun: where the sun sits.
const SKY = {
  lateGold:  { top: '#f9c86f', mid: '#f7a46a', bottom: '#f28a86', ink: '#3a1530', muted: 'rgba(58,21,48,.72)', accent: '#8f1d4e', land: '#5a2d5e', stars: 0, sun: 'high', tone: 'dark' },
  dusk:      { top: '#2b1b4f', mid: '#7a3f7e', bottom: '#e4809a', ink: '#fff4e4', muted: 'rgba(255,244,228,.74)', accent: '#ffc247', land: '#2a1434', stars: 40, sun: 'set', tone: 'light' },
  midnight:  { top: '#150b1f', mid: '#24143a', bottom: '#3b1f55', ink: '#fff4e4', muted: 'rgba(255,244,228,.72)', accent: '#ffc247', land: '#120817', stars: 90, sun: 'hidden', tone: 'light' },
  small:     { top: '#130d24', mid: '#211846', bottom: '#3a2a66', ink: '#fff4e4', muted: 'rgba(255,244,228,.72)', accent: '#ffc247', land: '#0f0a1c', stars: 70, sun: 'hidden', tone: 'light' },
  deep:      { top: '#0f0816', mid: '#1c0f22', bottom: '#301a3c', ink: '#fff4e4', muted: 'rgba(255,244,228,.72)', accent: '#ffc247', land: '#0b0610', stars: 110, sun: 'hidden', tone: 'light' },
  stars:     { top: '#0d0a1a', mid: '#1a1230', bottom: '#2b1c45', ink: '#fff4e4', muted: 'rgba(255,244,228,.72)', accent: '#ffc247', land: '#0a0714', stars: 'all', sun: 'hidden', tone: 'light' },
  four:      { top: '#10102a', mid: '#221544', bottom: '#3b2560', ink: '#fff4e4', muted: 'rgba(255,244,228,.72)', accent: '#ffc247', land: '#0d0a1c', stars: 60, sun: 'hidden', tone: 'light' },
  fourThirty:{ top: '#141538', mid: '#2b1d5a', bottom: '#4a2f7a', ink: '#fff4e4', muted: 'rgba(255,244,228,.72)', accent: '#ffc247', land: '#100c22', stars: 50, sun: 'hidden', tone: 'light' },
  firstBlue: { top: '#1a2250', mid: '#4a2f7a', bottom: '#8a4f8e', ink: '#fff4e4', muted: 'rgba(255,244,228,.74)', accent: '#ffc247', land: '#140e26', stars: 25, sun: 'hidden', tone: 'light' },
  beforeDawn:{ top: '#2e2160', mid: '#7a4a96', bottom: '#c97a9f', ink: '#fff4e4', muted: 'rgba(255,244,228,.78)', accent: '#ffd36b', land: '#1d1333', stars: 10, sun: 'set', tone: 'light' },
  firstLight:{ top: '#4a3a7e', mid: '#b56b9b', bottom: '#f0a080', ink: '#fff8ee', muted: 'rgba(255,248,238,.8)', accent: '#ffe08a', land: '#2a1838', stars: 0, sun: 'set', tone: 'light' },
  sunrise:   { top: '#6d4f9a', mid: '#d9779f', bottom: '#ffc27a', ink: '#fff8ee', muted: 'rgba(255,248,238,.82)', accent: '#fff1c2', land: '#3b1d4a', stars: 0, sun: 'rising', tone: 'light' },
  morning:   { top: '#ffd9b5', mid: '#ffe9d0', bottom: '#fff4e4', ink: '#3a1530', muted: 'rgba(58,21,48,.7)', accent: '#c2185b', land: '#e9bfa6', stars: 0, sun: 'faint', tone: 'dark' },
  letter:    { top: '#ffeacc', mid: '#fff4e4', bottom: '#fff8ee', ink: '#3a1530', muted: 'rgba(58,21,48,.7)', accent: '#c2185b', land: '#f0cdb5', stars: 0, sun: 'faint', tone: 'dark' },
  fullSun:   { top: '#ffd98a', mid: '#ffe6b4', bottom: '#fff4e4', ink: '#3a1530', muted: 'rgba(58,21,48,.7)', accent: '#c2185b', land: '#f1c69e', stars: 0, sun: 'full', tone: 'dark' },
};

// The same story in the site's own pinks: light in the afternoon, deep pink
// through the night, light again by morning. The sun stays gold.
const PINK_INK_DARK = { ink: '#b4164e', muted: 'rgba(180,22,78,.74)', accent: '#c9962b', tone: 'dark' };
const PINK_INK_LIGHT = { ink: '#fff4f8', muted: 'rgba(255,244,248,.82)', accent: '#ffe08a', tone: 'light' };
const PINK_SKY = {
  lateGold:   { top: '#fff0f5', mid: '#ffd9e6', bottom: '#ffbfd3', land: '#e86fa0', stars: 0, sun: 'high', ...PINK_INK_DARK },
  dusk:       { top: '#ffb6c1', mid: '#ff7fb5', bottom: '#ff4da6', land: '#8f1d4e', stars: 40, sun: 'set', ...PINK_INK_LIGHT },
  midnight:   { top: '#5a0f33', mid: '#8f1d4e', bottom: '#b5164f', land: '#3a0a20', stars: 90, sun: 'hidden', ...PINK_INK_LIGHT, accent: '#ffc247' },
  small:      { top: '#4e0d2c', mid: '#7a1040', bottom: '#a3184b', land: '#330819', stars: 70, sun: 'hidden', ...PINK_INK_LIGHT, accent: '#ffc247' },
  deep:       { top: '#3a0a20', mid: '#5a0f33', bottom: '#7a1040', land: '#260514', stars: 110, sun: 'hidden', ...PINK_INK_LIGHT, accent: '#ffc247' },
  stars:      { top: '#330819', mid: '#4e0d2c', bottom: '#6d1239', land: '#220411', stars: 'all', sun: 'hidden', ...PINK_INK_LIGHT, accent: '#ffc247' },
  four:       { top: '#4a0c2a', mid: '#7a1040', bottom: '#9a1448', land: '#2e0718', stars: 60, sun: 'hidden', ...PINK_INK_LIGHT, accent: '#ffc247' },
  fourThirty: { top: '#5a0f33', mid: '#8f1d4e', bottom: '#b02a5a', land: '#36081d', stars: 50, sun: 'hidden', ...PINK_INK_LIGHT, accent: '#ffc247' },
  firstBlue:  { top: '#6d1239', mid: '#a3184b', bottom: '#d72660', land: '#3e0921', stars: 25, sun: 'hidden', ...PINK_INK_LIGHT, accent: '#ffc247' },
  beforeDawn: { top: '#8f1d4e', mid: '#d72660', bottom: '#ff4da6', land: '#4e0d2c', stars: 10, sun: 'set', ...PINK_INK_LIGHT, accent: '#ffd36b' },
  firstLight: { top: '#b5164f', mid: '#ff4da6', bottom: '#ff9ec6', land: '#5a0f33', stars: 0, sun: 'set', ...PINK_INK_LIGHT },
  sunrise:    { top: '#d72660', mid: '#ff6fb1', bottom: '#ffc1d6', land: '#7a1040', stars: 0, sun: 'rising', ...PINK_INK_LIGHT, accent: '#fff1c2' },
  morning:    { top: '#ffbfd3', mid: '#ffd9e6', bottom: '#fff0f5', land: '#f29ab8', stars: 0, sun: 'faint', ...PINK_INK_DARK, accent: '#c2185b' },
  letter:     { top: '#ffd9e6', mid: '#fff0f5', bottom: '#fff5f9', land: '#f6b4c9', stars: 0, sun: 'faint', ...PINK_INK_DARK, accent: '#c2185b' },
  fullSun:    { top: '#ffd9e6', mid: '#fff0f5', bottom: '#fff8ee', land: '#f6b4c9', stars: 0, sun: 'full', ...PINK_INK_DARK, accent: '#c2185b' },
};
const SKY_KEY = new Map(Object.entries(SKY).map(([k, v]) => [v, k]));
const pinkOf = (sky) => PINK_SKY[SKY_KEY.get(sky)] || sky;

function applySky(layer, sky) {
  layer.style.setProperty('--sky-top', sky.top);
  layer.style.setProperty('--sky-mid', sky.mid);
  layer.style.setProperty('--sky-bottom', sky.bottom);
  layer.style.setProperty('--ink', sky.ink);
  layer.style.setProperty('--muted', sky.muted);
  layer.style.setProperty('--accent', sky.accent);
  layer.style.setProperty('--land', sky.land);
  layer.dataset.tone = sky.tone;
}

/* ───────────── small builders ───────────── */

/** A big number in Fraunces with a unit line under it. */
function bigNumber(unitText, { clockFace = false } = {}) {
  const num = el('div', { class: `ft-num${clockFace ? ' ft-num--clock' : ''}`, 'aria-live': 'off', text: clockFace ? '0:00:00' : '0' });
  const unit = el('p', { class: 'ft-unit ft-in', text: unitText });
  return { num, unit, wrap: el('div', { class: 'ft-big ft-in' }, [num, unit]) };
}

/** Text that appears when she taps something, with its own gentle entrance. */
function reveal(children) {
  return el('div', { class: 'ft-reveal', hidden: true }, children);
}

function show(node) {
  if (!node) return;
  node.hidden = false;
  requestAnimationFrame(() => node.classList.add('is-shown'));
}

const whoCalledAt = (m) => `${callerSentence(m.who_called)} at ${clock(m.call_started)}`;

/* ───────────── the layers ───────────── */

/**
 * @param {object} stats facetime-stats.json
 * @param {Map<string,string[]>} notes
 */
function defineLayers(stats, notes, { birthday, now }) {
  const nights = stats.daily.filter((d) => d.fell_asleep).map((d) => d.date);
  const daily = stats.daily;
  const moment = (label) => stats.moments.find((m) => m.label === label);
  const yes = moment('The night you said yes');
  const christmas = moment('Christmas');
  const bday = birthdayState(birthday, now);

  const layers = [];

  // 1 ── 6:33 PM, the first call
  layers.push({
    id: 'first-call', sky: SKY.lateGold, title: 'The first call',
    build() {
      const fc = stats.first_call;
      const late = lateNightLine(now);
      const banner = el('div', { class: 'ft-banner', role: 'img', 'aria-label': 'FaceTime from Miracle' }, [
        el('span', { class: 'ft-banner__avatar', 'aria-hidden': 'true', text: '☀️' }),
        el('span', { class: 'ft-banner__text' }, [
          el('span', { class: 'ft-banner__name', text: 'Miracle☀️' }),
          el('span', { class: 'ft-banner__sub', text: 'FaceTime Video' }),
        ]),
        el('span', { class: 'ft-banner__time', text: fc.time }),
      ]);
      const kids = [
        banner,
        el('p', { class: 'ft-date ft-in', text: `${longDate(fc.at)}, ${fc.time}.` }),
        el('p', { class: 'ft-lead ft-in', text: `${callerSentence(fc.who_called)} me. It lasted ${plural(fc.seconds, 'second')}.` }),
        el('p', { class: 'ft-small ft-in', text: `It really began on ${monthDay(stats.before_facetime.first_day)}, on WhatsApp. WhatsApp kept no record of those weeks, so the count starts with our first FaceTime.` }),
        noteBlock(notes, 'first-call', 'ft-note ft-in'),
        late ? el('p', { class: 'ft-small ft-in ft-late', text: late }) : null,
        el('p', { class: 'ft-hint ft-in', text: tapWord() === 'Click' ? 'Click anywhere to peel, or use the arrow keys' : 'Tap anywhere to peel' }),
      ];
      return { content: el('div', { class: 'ft-content' }, kids) };
    },
  });

  // 2 ── 10:48 PM, the first long call
  layers.push({
    id: 'first-long-call', sky: SKY.dusk, title: 'The first long call',
    build() {
      const c = stats.first_long_call;
      const big = bigNumber('hours, minutes, seconds', { clockFace: true });
      const kids = [
        el('p', { class: 'ft-date ft-in', text: `That same night, ${c.time}.` }),
        el('p', { class: 'ft-lead ft-in', text: `${callerSentence(c.who_called)} again.` }),
        big.wrap,
        el('p', { class: 'ft-small ft-in', text: c.saw_sunrise
          ? `We didn't hang up until ${c.ended_time} the next morning. The sun came up on our very first long call.`
          : `We didn't hang up until ${c.ended_time}.` }),
        noteBlock(notes, 'first-long-call', 'ft-note ft-in'),
      ];
      return {
        content: el('div', { class: 'ft-content' }, kids),
        onEnter: () => countUpClock(big.num, c.seconds, { duration: 2600, delay: 500 }),
      };
    },
  });

  // 3 ── midnight, the scale of it
  layers.push({
    id: 'hours', sky: SKY.midnight, title: 'The hours',
    build() {
      const t = stats.totals;
      const big = bigNumber('hours on FaceTime');
      const more = reveal([el('p', { class: 'ft-small', text: `That line is our ${fmtInt(stats.range.days_span)} days, taller where we talked longer. The peaks are the days we never hung up at all.` })]);
      const chip = el('button', { type: 'button', class: 'ft-chip ft-in', text: 'What is the horizon?' });
      chip.addEventListener('click', () => { show(more); chip.hidden = true; });
      const kids = [
        el('p', { class: 'ft-lead ft-in', text: 'Since then, we have spent' }),
        big.wrap,
        el('p', { class: 'ft-small ft-in', text: `That's ${fmtInt(t.days_equivalent)} days. ${fmtInt(t.share_of_all_time_pct)}% of every hour since that first call.` }),
        chip,
        more,
      ];
      return {
        content: el('div', { class: 'ft-content' }, kids),
        horizonDraws: true,
        onEnter: () => countUp(big.num, { to: Math.floor(t.hours), duration: 3000, delay: 400 }),
      };
    },
  });

  // 4 ── 12:30 AM, day by day
  layers.push({
    id: 'day-by-day', sky: SKY.small, title: 'Day by day',
    build() {
      const o = stats.official;
      const chart = monthlyLine(stats.monthly);
      chart.classList.add('ft-in');
      const detail = el('p', { class: 'ft-detail', 'aria-live': 'polite' });
      const pick = (key) => {
        const m = stats.monthly.find((x) => x.month === key);
        if (!m) return;
        detail.textContent = `${monthLabel(m.month)}: ${fmtNum(m.hours_per_day)} hours a day. A call lasted ${fmtNum(m.avg_call_hours)} hours on average.`;
        chart.querySelectorAll('.ft-monthly__pt').forEach((p) => p.classList.toggle('is-active', p.dataset.month === key));
      };
      chart.addEventListener('click', (e) => { const pt = e.target.closest('.ft-monthly__pt'); if (pt) pick(pt.dataset.month); });
      chart.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const pt = e.target.closest('.ft-monthly__pt'); if (pt) { e.preventDefault(); pick(pt.dataset.month); } } });
      const kids = [
        el('p', { class: 'ft-lead ft-in', text: 'Day by day, it grew.' }),
        chart,
        el('p', { class: 'ft-small ft-in', text: `Before we were official, about ${fmtNum(Math.round(o.before.hours_per_day * 2) / 2)} hours a day. After, ${fmtNum(o.after.hours_per_day)}.` }),
        el('p', { class: 'ft-hint ft-in', text: `${tapWord()} a month` }),
        detail,
      ];
      return { content: el('div', { class: 'ft-content ft-content--wide' }, kids) };
    },
  });

  // 5 ── 2:00 AM, September 13, 2025
  layers.push({
    id: 'said-yes', sky: SKY.deep, title: 'The night you said yes',
    build() {
      const ended = yes && yes.stretch_ended ? yes.stretch_ended : yes && yes.call_ended;
      const endedClock = ended ? clock(ended) : '';
      const afternoon = ended && dateOf(ended).getHours() >= 12 && dateOf(ended).getHours() < 18 ? ' that afternoon' : '';
      const tap = el('button', { type: 'button', class: 'ft-num ft-num--tap ft-in', 'aria-label': 'Two in the morning. Press for a little love', text: clock(yes ? yes.at : '2025-09-13T02:00') });
      const more = reveal([noteBlock(notes, 'said-yes', 'ft-note') || el('p', { class: 'ft-note', text: 'You said yes on this call.' })]);
      tap.addEventListener('click', () => { heartsBurst(tap); show(more); });
      const kids = [
        el('p', { class: 'ft-date ft-in', text: longDate(yes ? yes.at : '2025-09-13') }),
        tap,
        el('p', { class: 'ft-lead ft-in', text: yes && yes.on_facetime ? 'We were on FaceTime when you said yes.' : 'The night you said yes.' }),
        yes && yes.on_facetime ? el('p', { class: 'ft-small ft-in', text: `The call started at ${clock(yes.call_started)}. We stayed on, one call after another, until ${endedClock}${afternoon}.` }) : null,
        el('p', { class: 'ft-hint ft-in', text: `${tapWord()} the time` }),
        more,
      ];
      return { content: el('div', { class: 'ft-content' }, kids) };
    },
  });

  // 6 ── 3 AM, the nights
  layers.push({
    id: 'nights', sky: SKY.stars, title: 'The nights we fell asleep',
    build() {
      const n = stats.nights;
      const big = bigNumber('nights we fell asleep on FaceTime');
      const kids = [
        big.wrap,
        el('p', { class: 'ft-small ft-in', text: 'One star for each of them.' }),
        el('p', { class: 'ft-small ft-in', text: `${fmtInt(n.night_share_pct)}% of our time on FaceTime was between midnight and 6 AM. Our hour is ${hourLabel(n.peak_hour)}.` }),
      ];
      return {
        content: el('div', { class: 'ft-content' }, kids),
        onEnter: () => countUp(big.num, { to: n.fell_asleep_calls, duration: 2400, delay: 300 }),
      };
    },
  });

  // 7 ── 4 AM, the longest call
  layers.push({
    id: 'longest', sky: SKY.four, title: 'Our longest call',
    build() {
      const L = stats.longest_call;
      const S = stats.longest_stretch;
      const big = bigNumber('hours, minutes, seconds', { clockFace: true });
      const brk = S.break_seconds && S.break_seconds.length
        ? `, with ${S.break_seconds.length === 1 ? `one ${S.break_seconds[0]} second break` : `${S.break_seconds.length} short breaks`}`
        : '';
      const secret = S.hours > L.hours
        ? el('p', { class: 'ft-small', text: `Want a secret? ${monthDay(S.from)} went longer: ${hoursMinutes(S.hours * 3600)}${brk}.` })
        : null;
      const more = reveal([noteBlock(notes, 'longest-call', 'ft-note'), secret]);
      const tap = el('button', { type: 'button', class: 'ft-chip ft-in', text: monthDay(L.at) });
      tap.addEventListener('click', () => { show(more); tap.hidden = true; });
      const xmas = christmas && christmas.on_facetime && christmas.call_hours >= 24
        ? el('p', { class: 'ft-small ft-in', text: `And all 24 hours of Christmas Day were inside one ${fmtInt(christmas.call_hours)} hour call.` })
        : null;
      const kids = [
        el('p', { class: 'ft-lead ft-in', text: 'Our longest call.' }),
        big.wrap,
        el('p', { class: 'ft-small ft-in', text: `It started at ${L.time} on ${longDate(L.at)} and ended at ${L.ended_time} the next day.` }),
        tap,
        more,
        xmas,
        noteBlock(notes, 'christmas', 'ft-note ft-in'),
      ];
      return {
        content: el('div', { class: 'ft-content' }, kids),
        onEnter: () => countUpClock(big.num, L.seconds, { duration: 3000, delay: 400 }),
      };
    },
  });

  // 8 ── 4:30 AM, midnights we were there for
  layers.push({
    id: 'midnights', sky: SKY.fourThirty, title: 'Midnights we were there for',
    build() {
      const wanted = ['Your 24th birthday', 'My 23rd birthday', 'One year, to the hour', 'Your 25th birthday'];
      const items = wanted.map((label) => moment(label)).filter((m) => m && m.on_facetime);
      const detail = el('p', { class: 'ft-detail', 'aria-live': 'polite' });
      const grid = el('div', { class: 'ft-clocks ft-in' }, items.map((m) => {
        const btn = el('button', { type: 'button', class: 'ft-clock' }, [
          el('b', { text: clock(m.at) }),
          el('span', { text: m.label }),
          el('small', { text: whoCalledAt(m) }),
        ]);
        btn.addEventListener('click', () => {
          grid.querySelectorAll('.ft-clock').forEach((b) => b.classList.toggle('is-active', b === btn));
          const until = m.stretch_ended || m.call_ended;
          detail.textContent = `${longDate(m.at)}. We were on until ${clock(until)}${dateOf(until).getDate() !== dateOf(m.at).getDate() ? ' the next day' : ''}.`;
        });
        return btn;
      }));
      const kids = [
        el('p', { class: 'ft-lead ft-in', text: 'Midnights we were there for.' }),
        grid,
        el('p', { class: 'ft-hint ft-in', text: `${tapWord()} one` }),
        detail,
      ];
      return { content: el('div', { class: 'ft-content ft-content--wide' }, kids) };
    },
  });

  // 9 ── 5 AM, together
  layers.push({
    id: 'together', sky: SKY.firstBlue, title: 'Together',
    build() {
      const big = bigNumber('days in the same room');
      const stillCalled = stats.visits.reduce((s, v) => s + v.facetime_days_inside, 0);
      const detail = el('div', { class: 'ft-detail ft-detail--card', 'aria-live': 'polite' });
      const chips = el('div', { class: 'ft-chips ft-in' }, stats.visits.map((v) => {
        const from = dateOf(v.from); const to = dateOf(v.to);
        const sameMonth = from.getMonth() === to.getMonth();
        const range = sameMonth ? `${monthDay(v.from)} to ${to.getDate()}` : `${monthDay(v.from)} to ${monthDay(v.to)}`;
        const b = el('button', { type: 'button', class: 'ft-chip ft-chip--visit' }, [el('b', { text: v.where }), el('span', { text: range })]);
        b.addEventListener('click', () => {
          chips.querySelectorAll('.ft-chip').forEach((c) => c.classList.toggle('is-active', c === b));
          detail.replaceChildren(
            el('p', { text: `${v.who}. ${plural(v.days, 'day')}${v.note ? `. ${v.note}` : '.'}` }),
            v.back_on_facetime ? el('p', { text: `Back on FaceTime ${fmtNum(v.back_on_facetime.hours_after_leaving)} hours after we said goodbye.` }) : null,
            el('p', { text: `${fmtInt(v.hours_week_before)} hours on FaceTime the week before. ${fmtInt(v.hours_week_after)} the week after.` }),
          );
          detail.classList.add('is-shown');
        });
        return b;
      }));
      const kids = [
        big.wrap,
        el('p', { class: 'ft-lead ft-in', text: 'No FaceTime needed. We were together.' }),
        stillCalled ? el('p', { class: 'ft-small ft-in', text: `And we still called goodnight on ${stillCalled} of them.` }) : null,
        chips,
        detail,
        noteBlock(notes, 'visits', 'ft-note ft-in'),
      ];
      return {
        content: el('div', { class: 'ft-content ft-content--wide' }, kids),
        highlightVisits: true,
        onEnter: () => countUp(big.num, { to: stats.totals.days_together_in_person, duration: 1800, delay: 300 }),
      };
    },
  });

  // 10 ── before dawn, milestones
  layers.push({
    id: 'milestones', sky: SKY.beforeDawn, title: 'Milestones',
    build() {
      const officialDate = dateOf(stats.official.date);
      const msDay = 86_400_000;
      const rows = stats.milestones.map((m, i) => {
        const d = dateOf(m.date);
        const beforeOfficial = Math.round((officialDate - d) / msDay);
        let aside = `day ${m.day_number}`;
        if (beforeOfficial > 0) aside = `${plural(beforeOfficial, 'day')} before we were official`;
        else if (m.hours === 1000) aside = 'the day after three months';
        return el('li', { class: 'ft-milestone ft-in', style: { '--i': i + 1 } }, [
          el('b', { text: `${fmtInt(m.hours)} hours` }),
          el('span', { text: longDate(m.date) }),
          el('small', { text: aside }),
        ]);
      });
      const nxt = stats.next_milestone;
      const kids = [
        el('p', { class: 'ft-lead ft-in', text: 'The hours added up.' }),
        el('ol', { class: 'ft-milestones' }, rows),
        nxt ? el('p', { class: 'ft-small ft-in', text: `${fmtInt(nxt.hours)} is coming. Around ${monthDay(nxt.expected_date)}, at our pace.` }) : null,
        noteBlock(notes, 'milestone-1000', 'ft-note ft-in'),
      ];
      return { content: el('div', { class: 'ft-content' }, kids) };
    },
  });

  // 11 ── first light, who called who
  layers.push({
    id: 'who-called', sky: SKY.firstLight, title: 'Who called who',
    build() {
      const d = stats.direction;
      const n = stats.nights.started_by || {};
      const cb = stats.called_right_back;
      const bar = splitBar(d.incoming.connected, d.outgoing.connected, { leftLabel: 'you called', rightLabel: 'I called', format: fmtInt });
      bar.classList.add('ft-in');
      const kids = [
        el('p', { class: 'ft-lead ft-in', text: 'Who called who.' }),
        bar,
        el('p', { class: 'ft-small ft-in', text: `You called ${fmtInt(d.incoming.connected)} times, I called ${fmtInt(d.outgoing.connected)}. But the nights we fell asleep? You started ${fmtInt(n.incoming || 0)}, I started ${fmtInt(n.outgoing || 0)}. We take turns.` }),
        cb ? el('p', { class: 'ft-small ft-in', text: `When a call didn't go through, one of us got through again within ${cb.window_minutes} minutes ${fmtInt(cb.episodes)} times. Usually in ${cb.median_seconds < 60 ? 'under a minute' : `about ${Math.round(cb.median_seconds / 60)} minutes`}.` }) : null,
      ];
      return { content: el('div', { class: 'ft-content ft-content--wide' }, kids) };
    },
  });

  // 12 ── sunrise
  layers.push({
    id: 'sunrises', sky: SKY.sunrise, title: 'Sunrises',
    build() {
      const s = stats.sunrises;
      const big = bigNumber('mornings, the sun came up while we were still on the call');
      const kids = [
        big.wrap,
        noteBlock(notes, 'sunrises', 'ft-note ft-in'),
      ];
      return {
        content: el('div', { class: 'ft-content' }, kids),
        sunRises: true,
        onEnter: () => countUp(big.num, { to: s.count, duration: 2600, delay: 600 }),
      };
    },
  });

  // 13 ── morning, her year
  layers.push({
    id: 'her-year', sky: SKY.morning, title: 'Her year',
    build() {
      const y = stats.her_year;
      const ring = orbit(y.orbit, { size: 320 });
      ring.classList.add('ft-in');
      const big = bigNumber('hours on FaceTime');
      const detail = el('p', { class: 'ft-detail', 'aria-live': 'polite' });
      const pick = (ray) => {
        ring.querySelectorAll('.ft-orbit__ray').forEach((r) => r.classList.toggle('is-active', r === ray));
        detail.textContent = ray.dataset.together
          ? `${longDate(ray.dataset.date)}: together, in person.`
          : `${longDate(ray.dataset.date)}: ${Number(ray.dataset.hours) > 0 ? `${fmtNum(Number(ray.dataset.hours))} hours on FaceTime.` : 'a quiet day.'}`;
      };
      ring.addEventListener('click', (e) => { const r = e.target.closest('.ft-orbit__ray'); if (r) pick(r); });
      const seen = y.days - y.days_neither;
      big.wrap.classList.add('ft-big--md');
      const words = el('div', { class: 'ft-split-text' }, [
        el('p', { class: 'ft-lead ft-in', text: 'This past year of your life,' }),
        big.wrap,
        el('p', { class: 'ft-small ft-in', text: `${y.share_pct >= 48 && y.share_pct <= 52 ? 'Almost exactly half of it.' : `${fmtInt(y.share_pct)}% of it.`} ${fmtInt(seen)} of its ${fmtInt(y.days)} days, we saw each other's faces, on a screen or in the same room.` }),
        y.counted_from_first_call ? el('p', { class: 'ft-small ft-in', text: 'Counted from our first call, since your birthday came before it.' }) : null,
        el('p', { class: 'ft-hint ft-in', text: `${tapWord()} a day` }),
        detail,
        noteBlock(notes, 'her-year', 'ft-note ft-in'),
      ]);
      const kids = [ring, words];
      return {
        content: el('div', { class: 'ft-content ft-content--split' }, kids),
        onEnter: () => countUp(big.num, { to: Math.floor(y.hours), duration: 2800, delay: 900 }),
      };
    },
  });

  // 14 ── the letter (only when it has been written)
  if (notes.has('letter')) {
    layers.push({
      id: 'letter', sky: SKY.letter, title: 'A letter',
      build() {
        const kids = [
          el('p', { class: 'ft-dear ft-in', text: 'Dear Miracle☀️,' }),
          noteBlock(notes, 'letter', 'ft-letter ft-in'),
        ];
        return { content: el('div', { class: 'ft-content' }, kids) };
      },
    });
  }

  // 15 ── full sun, the finale
  layers.push({
    id: 'finale', sky: SKY.fullSun, title: 'Around the sun',
    build() {
      const y = stats.her_year;
      const ring = orbit(y.orbit, { size: 300 });
      ring.classList.add('ft-orbit--finale', 'ft-in');
      let headline;
      let sub = null;
      if (bday.mode === 'window') {
        headline = `Happy ${tripLabel(bday.age)}, Miracle☀️`;
      } else if (bday.mode === 'countdown') {
        headline = `${plural(bday.days, 'day')} until your ${tripLabel(bday.nextAge)}`;
        sub = 'I am already counting.';
      } else {
        headline = `${ordinal(bday.age).replace(/(\d+)/, (n) => fmtInt(Number(n)))} trip around the sun, Miracle☀️`;
        sub = `This last one, we spent ${fmtInt(y.share_pct)}% of on FaceTime.`;
      }
      const sunTap = el('button', { type: 'button', class: 'ft-suntap', 'aria-label': 'Tap the sun' }, [ring]);
      const more = reveal([noteBlock(notes, 'birthday', 'ft-note')]);
      sunTap.addEventListener('click', () => { heartsBurst(sunTap, { count: 18 }); show(more); });
      const done = el('button', { type: 'button', class: 'ft-cta ft-in', text: 'See everything' });
      const kids = [
        sunTap,
        el('h2', { class: 'ft-headline ft-in', text: headline }),
        sub ? el('p', { class: 'ft-small ft-in', text: sub }) : null,
        more,
        done,
      ];
      return {
        content: el('div', { class: 'ft-content' }, kids),
        doneButton: done,
        finale: true,
      };
    },
  });

  return { layers, nights };
}

/* ───────────── the deck ───────────── */

/**
 * @param {object} stats
 * @param {Map<string,string[]>} notes
 * @param {{ onDone: () => void, onSkip?: () => void, birthday: Date, now?: Date }} options
 */
export function buildStory(stats, notes, { onDone, onSkip, birthday, now = new Date(), palette = 'sky', onPalette = null }) {
  const { layers, nights } = defineLayers(stats, notes, { birthday, now });
  const reduced = prefersReducedMotion();
  let pink = palette === 'pink';
  const stage = el('div', { class: 'ft-stage', role: 'region', 'aria-roledescription': 'story', 'aria-label': 'Us, on FaceTime, the story' });
  const live = el('p', { class: 'sr-only', 'aria-live': 'polite' });
  const deck = el('div', { class: 'ft-deck' });
  stage.append(deck, live);

  const nodes = layers.map((layer, i) => {
    const node = el('section', { class: 'ft-layer', 'aria-roledescription': 'slide', 'aria-label': `${i + 1} of ${layers.length}: ${layer.title}`, hidden: true, 'data-id': layer.id });
    node.style.zIndex = String(layers.length - i);
    applySky(node, pink ? pinkOf(layer.sky) : layer.sky);
    const skyEl = el('div', { class: 'ft-sky-layer', 'aria-hidden': 'true' });
    const count = layer.sky.stars === 'all' ? nights.length : layer.sky.stars;
    if (count > 0) skyEl.appendChild(starField(nights, { count }));
    const sun = el('div', { class: 'ft-sun', 'data-pos': layer.sky.sun });
    skyEl.appendChild(sun);
    node.appendChild(skyEl);
    const built = layer.build();
    const land = horizon(stats.daily, { highlight: !!built.highlightVisits });
    if (built.horizonDraws) land.classList.add('ft-horizon--draws');
    node.appendChild(land);
    const body = el('div', { class: 'ft-layer__body' }, [built.content]);
    node.appendChild(body);
    if (!reduced) node.appendChild(el('div', { class: 'ft-corner', 'aria-hidden': 'true' }));
    return { node, layer, built, sun, entered: false };
  });
  nodes.forEach((n) => deck.appendChild(n.node));

  const progress = el('div', { class: 'ft-progress', role: 'tablist', 'aria-label': 'Layers' }, nodes.map((n, i) => {
    const dot = el('button', { type: 'button', class: 'ft-progress__dot', role: 'tab', 'aria-label': `${n.layer.title}`, 'aria-selected': 'false' });
    dot.addEventListener('click', (e) => { e.stopPropagation(); go(i); });
    return dot;
  }));
  const skip = el('button', { type: 'button', class: 'ft-skip', text: 'Skip to everything' });
  skip.addEventListener('click', (e) => { e.stopPropagation(); finish(true); });
  stage.append(progress, skip);

  // "In pink?" sits top left on the first layer and recolours the whole story.
  const pinkBtn = el('button', { type: 'button', class: 'ft-pink', 'aria-pressed': String(pink) }, [
    el('span', { class: 'ft-pink__dot', 'aria-hidden': 'true' }),
    el('span', { class: 'ft-pink__label', text: pink ? 'Back to the sky?' : 'In pink?' }),
  ]);
  pinkBtn.addEventListener('click', (e) => { e.stopPropagation(); setPalette(pink ? 'sky' : 'pink'); });
  stage.appendChild(pinkBtn);
  if (pink) stage.dataset.palette = 'pink';

  function setPalette(p) {
    pink = p === 'pink';
    if (pink) stage.dataset.palette = 'pink'; else delete stage.dataset.palette;
    nodes.forEach((n) => applySky(n.node, pink ? pinkOf(n.layer.sky) : n.layer.sky));
    pinkBtn.setAttribute('aria-pressed', String(pink));
    pinkBtn.querySelector('.ft-pink__label').textContent = pink ? 'Back to the sky?' : 'In pink?';
    if (cur >= 0) setTone();
    if (onPalette) onPalette(p);
  }

  let cur = -1;
  let animating = false;
  let finished = false;
  let shootTimer = null;

  function setTone() {
    stage.dataset.tone = (pink ? pinkOf(nodes[cur].layer.sky) : nodes[cur].layer.sky).tone;
    progress.querySelectorAll('.ft-progress__dot').forEach((d, i) => {
      d.setAttribute('aria-selected', String(i === cur));
      d.classList.toggle('is-current', i === cur);
      d.classList.toggle('is-done', i < cur);
    });
  }

  function enter(i) {
    const n = nodes[i];
    n.node.hidden = false;
    n.node.inert = false;
    n.node.classList.add('is-current');
    n.node.classList.remove('is-under');
    live.textContent = `${n.layer.title}. ${i + 1} of ${nodes.length}.`;
    pinkBtn.hidden = i !== 0;
    if (n.built.sunRises) requestAnimationFrame(() => setTimeout(() => n.sun.classList.add('is-up'), 200));
    if (n.built.finale) requestAnimationFrame(() => setTimeout(() => n.node.classList.add('is-blooming'), 400));
    if (!n.entered) {
      n.entered = true;
      if (n.built.onEnter) n.built.onEnter();
      if (n.built.doneButton) n.built.doneButton.addEventListener('click', (e) => { e.stopPropagation(); finish(false); });
    } else {
      n.node.classList.add('is-settled');
    }
    setTone();
  }

  function leave(i) {
    const n = nodes[i];
    n.node.classList.remove('is-current');
    n.node.inert = true;
  }

  function peelFlap() {
    const flap = el('div', { class: 'ft-flap', 'aria-hidden': 'true' }, [el('div', { class: 'ft-flap__sheet' })]);
    return flap;
  }

  function go(to) {
    if (animating || finished || to < 0 || to >= nodes.length || to === cur) return;
    if (cur === -1) {
      cur = to;
      enter(cur);
      return;
    }
    animating = true;
    const from = cur;
    const forward = to > from;
    const fromNode = nodes[from].node;
    const toNode = nodes[to].node;
    leave(from);
    toNode.hidden = false;

    if (reduced) {
      fromNode.hidden = true;
      cur = to;
      enter(cur);
      animating = false;
      return;
    }

    if (forward) {
      toNode.classList.add('is-under');
      toNode.style.zIndex = String(nodes.length - to);
      fromNode.style.zIndex = String(nodes.length + 2);
      const flap = peelFlap();
      flap.style.zIndex = String(nodes.length + 3);
      deck.appendChild(flap);
      fromNode.classList.add('is-peeling');
      flap.classList.add('is-peeling');
      setTimeout(() => {
        fromNode.classList.remove('is-peeling');
        fromNode.hidden = true;
        fromNode.style.zIndex = String(nodes.length - from);
        flap.remove();
        cur = to;
        enter(cur);
        animating = false;
      }, PEEL_MS);
    } else {
      // Going back: the earlier layer folds back down over this one.
      toNode.style.zIndex = String(nodes.length + 2);
      toNode.classList.add('is-unpeeling');
      const flap = peelFlap();
      flap.style.zIndex = String(nodes.length + 3);
      flap.classList.add('is-unpeeling');
      deck.appendChild(flap);
      setTimeout(() => {
        toNode.classList.remove('is-unpeeling');
        toNode.style.zIndex = String(nodes.length - to);
        fromNode.hidden = true;
        flap.remove();
        cur = to;
        enter(cur);
        animating = false;
      }, PEEL_MS);
    }
  }

  function finish(skipped) {
    if (finished) return;
    finished = true;
    stopShooting();
    stage.classList.add('is-leaving');
    const after = () => {
      stage.remove();
      document.removeEventListener('keydown', onKey);
      (skipped && onSkip ? onSkip : onDone)();
    };
    if (reduced) after();
    else setTimeout(after, 700);
  }

  /* ── input ── */
  const INTERACTIVE = 'button, a, input, [role="button"], .ft-monthly__pt, .ft-orbit__ray, .ft-reveal';
  let press = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest(INTERACTIVE)) { press = null; return; }
    press = { x: e.clientX, y: e.clientY, t: Date.now() };
  });
  stage.addEventListener('pointerup', (e) => {
    if (!press) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    const dt = Date.now() - press.t;
    press = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      go(dx < 0 ? cur + 1 : cur - 1);
      return;
    }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 600) {
      if (nodes[cur].built.finale) return; // the finale ends with its own button
      go(cur + 1);
    }
  });
  stage.addEventListener('pointercancel', () => { press = null; });

  function onKey(e) {
    if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) || (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement))) {
      e.preventDefault();
      if (nodes[cur].built.finale) finish(false); else go(cur + 1);
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
      e.preventDefault();
      go(cur - 1);
    } else if (e.key === 'Escape') {
      finish(true);
    }
  }
  document.addEventListener('keydown', onKey);

  /* ── shooting stars on the night layers ── */
  function shoot() {
    const n = nodes[cur];
    if (!n || reduced) return;
    const count = n.layer.sky.stars === 'all' ? 1 : n.layer.sky.stars;
    if (count > 0 && !n.built.finale) {
      const skyEl = n.node.querySelector('.ft-sky-layer');
      const star = el('span', { class: 'ft-shoot', 'aria-hidden': 'true', style: { top: `${8 + Math.random() * 34}%`, left: `${35 + Math.random() * 55}%` } });
      star.addEventListener('animationend', () => star.remove(), { once: true });
      skyEl.appendChild(star);
    }
    shootTimer = setTimeout(shoot, 7000 + Math.random() * 8000);
  }
  function stopShooting() { if (shootTimer) clearTimeout(shootTimer); shootTimer = null; }

  return {
    el: stage,
    start() {
      nodes.forEach((n) => { n.node.inert = true; });
      go(0);
      if (!reduced) shootTimer = setTimeout(shoot, 4000);
    },
  };
}
