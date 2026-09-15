/**
 * wedding.js — the wedding fund page.
 *
 * Nothing is stored and nothing is fetched. The numbers come from
 * src/data/weddingFund.js and the arithmetic in src/modules/weddingFund.js:
 * a deposit lands every payday on its own, and between paydays the "growing
 * right now" figure ticks up at the weekly rate. Leave the tab open over a
 * payday midnight and the page re-renders itself when the day changes.
 */

import './styles/base.css';
import './styles/sections.css';
import './styles/animations.css';
import './styles/ui.css';
import './styles/wedding.css';

import { initSiteChrome } from './modules/siteChrome.js';
import { initReveal } from './modules/reveal.js';
import { formatLongDate, toISO } from './modules/dates.js';
import { snapshot, recentDeposits, money } from './modules/weddingFund.js';
import { FUND, WEDDING_DATE } from './data/weddingFund.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PAYDAY_NAME = DAY_NAMES[FUND.payday];

/** One line at the bottom. Rotates with the weeks so it's never quite the same page. */
const SIGN_OFF = [
  'Every one of these is a payday where you came first.',
  'Not a big number yet. A very stubborn one, though.',
  'Slow is fine. Slow and every single week is how things get built.',
  'Still going. Was never going to stop.',
  "It isn't the amount. It's that I think about it every week, and about you every day.",
];

/** How many hearts to actually draw before it stops meaning anything. */
const MAX_HEARTS = 160;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 'Friday, September 18' */
function dayAndDate(d) {
  return `${DAY_NAMES[d.getDay()]}, ${formatLongDate(d).replace(/,\s\d{4}$/, '')}`;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** '1 year, 7 months and 28 days' — drops the zero parts. */
function untilWords({ years, months, days }) {
  const parts = [];
  if (years) parts.push(plural(years, 'year'));
  if (months) parts.push(plural(months, 'month'));
  if (days || parts.length === 0) parts.push(plural(days, 'day'));
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/* ── Render ── */

function renderHero(s) {
  document.getElementById('weddingSaved').textContent = money(s.saved);

  const note = document.getElementById('weddingNote');
  if (s.isDepositDay) {
    note.textContent = `Today's ${money(s.weekly)} just went in. That makes ${plural(s.weeksIn, 'week')} of showing up.`;
  } else {
    note.textContent = `${plural(s.weeksIn, 'week')} of showing up. The next ${money(s.weekly)} lands ${dayAndDate(s.nextDeposit)}.`;
  }

  const hearts = document.getElementById('weddingHearts');
  hearts.replaceChildren();
  const shown = Math.min(s.weeksIn, MAX_HEARTS);
  for (let i = 0; i < shown; i += 1) {
    const heart = el('span', 'wedding-heart', '♥');
    // Newest heart blooms on the day it arrived; the rest sit quietly.
    if (i === shown - 1 && s.isDepositDay) heart.classList.add('is-new');
    hearts.appendChild(heart);
  }

  document.getElementById('weddingHeartsCaption').textContent = s.weeksIn > MAX_HEARTS
    ? `One heart for every week we've put something aside — ${s.weeksIn} of them now, more than fit here.`
    : "One heart for every week we've put something aside.";

  document.getElementById('weddingEyebrow').textContent =
    `For ${formatLongDate(WEDDING_DATE)} · ${plural(s.daysToWedding, 'day')} away`;
}

function renderStats(s) {
  const tiles = [
    { label: 'Every week', value: money(s.weekly), note: FUND.source },
    { label: 'Every month', value: money(s.monthly), note: `give or take a ${PAYDAY_NAME}` },
    { label: 'Every year', value: money(s.yearly), note: 'without lifting a finger' },
    { label: 'Until the day', value: untilWords(s.untilWedding), note: formatLongDate(WEDDING_DATE), wide: true },
  ];

  const grid = document.getElementById('weddingStats');
  grid.replaceChildren(...tiles.map((tile, i) => {
    const card = el('div', 'usm-card wedding-stat reveal' + (tile.wide ? ' wedding-stat--wide' : ''));
    card.setAttribute('data-delay', String((i % 4) + 1));
    card.append(
      el('p', 'wedding-stat__label', tile.label),
      el('p', 'wedding-stat__value', tile.value),
      el('p', 'wedding-stat__note', tile.note),
    );
    return card;
  }));
}

function renderAhead(s) {
  const line = document.getElementById('weddingAhead');
  if (s.depositsAhead === 0) {
    line.textContent = `We made it here with ${money(s.saved)} set aside, one ${PAYDAY_NAME} at a time.`;
    return;
  }
  line.textContent = `At this pace, with nothing else added, we walk into ${formatLongDate(WEDDING_DATE)} with `
    + `${money(s.projected)} set aside. That's ${s.depositsAhead} more ${PAYDAY_NAME}s. `
    + 'Anything extra we tuck in along the way sits on top of that.';
}

function renderLog(s, now) {
  document.getElementById('weddingLogLabel').textContent = `The last few ${PAYDAY_NAME}s`;
  const list = document.getElementById('weddingLog');
  list.replaceChildren();

  if (s.deposits === 0) {
    const first = el('li', 'wedding-log__row wedding-log__row--next');
    first.append(
      el('span', 'wedding-log__date', `Next one lands ${dayAndDate(s.nextDeposit)}`),
      el('span', 'wedding-log__amount', `+ ${money(s.weekly)}`),
    );
    list.appendChild(first);
  }

  for (const date of recentDeposits(now, 6)) {
    const row = el('li', 'wedding-log__row');
    row.append(
      el('span', 'wedding-log__date', formatLongDate(date)),
      el('span', 'wedding-log__amount', `+ ${money(s.weekly)}`),
    );
    list.appendChild(row);
  }

  // Where it started: the opening balance, always the last row.
  const opening = el('li', 'wedding-log__row wedding-log__row--opening');
  opening.append(
    el('span', 'wedding-log__date', `Already in the jar by ${formatLongDate(FUND.balanceAsOf)}`),
    el('span', 'wedding-log__amount', money(FUND.balance)),
  );
  list.appendChild(opening);
}

function renderHow(s) {
  const source = FUND.source[0].toUpperCase() + FUND.source.slice(1);
  document.getElementById('weddingHow').textContent =
    `${source} — ${money(s.weekly)} a week — goes in every ${PAYDAY_NAME}. `
    + 'This page adds it on its own, so the number up top is always current. '
    + `"Growing right now" is the next ${PAYDAY_NAME}'s ${money(s.weekly)} arriving a fraction at a time, `
    + 'at the same pace, just so you can watch it move.';

  document.getElementById('weddingLiveNote').textContent =
    `Counting toward ${PAYDAY_NAME}'s ${money(s.weekly)}. If you watch closely, it moves.`;
}

function renderSign(s) {
  document.getElementById('weddingSign').textContent = SIGN_OFF[s.weeksIn % SIGN_OFF.length];
}

function renderAll(now) {
  const s = snapshot(now);
  renderHero(s);
  renderStats(s);
  renderAhead(s);
  renderLog(s, now);
  renderHow(s);
  renderSign(s);
}

/* ── The live number ── */

function renderLive(now) {
  const { live } = snapshot(now);
  const mount = document.getElementById('weddingLive');
  // "$425.01" in full, then three fainter digits that never stop moving.
  const whole = money(live, 5);
  mount.replaceChildren(
    el('span', 'wedding-live__main', whole.slice(0, -3)),
    el('span', 'wedding-live__tail', whole.slice(-3)),
  );
}

function startTicking() {
  const reduced = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const interval = reduced ? 1000 : 120;

  let renderedDay = toISO(new Date());
  let timer = null;

  const tick = () => {
    const now = new Date();
    const today = toISO(now);
    if (today !== renderedDay) {
      renderedDay = today;
      renderAll(now);
    }
    renderLive(now);
  };

  const start = () => {
    if (timer) return;
    tick();
    timer = setInterval(tick, interval);
  };
  const stop = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  start();
}

document.addEventListener('DOMContentLoaded', () => {
  initSiteChrome({ active: 'foryou' });
  renderAll(new Date());
  startTicking();
  requestAnimationFrame(() => setTimeout(() => initReveal(), 50));
});
