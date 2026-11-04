/**
 * explore.js — everything, to scroll and tap, once the story has been told.
 *
 *   buildExplore(stats, notes, { onReplay, birthday }) → element
 *
 * The sky keeps moving as she scrolls, dusk at the top, morning at the bottom.
 * Sections are the real numbers again, with room to poke at every day.
 */

import { svgIcon } from '../icons.js';
import { el, svg, dateOf, fmtInt, fmtNum, hms, clock, longDate, monthDay, shortMonthDay, monthLabel, hourLabel, weekdayShort, callerSentence, plural, hoursMinutes, ordinal, hash01 } from './format.js';
import { noteBlock } from './notes.js';
import { countUp, whenVisible } from './countup.js';
import { monthCalendar, hourStrip, clockDial, monthlyLine, climb, splitBar, weekdayBars, orbit, dotGrid } from './charts.js';
import { heartsBurst, fleeButton, monthsaryLine, birthdayState, tripLabel } from './surprises.js';

function section(id, title, lede, children) {
  return el('section', { class: 'ft-sec', id: `ft-${id}`, 'aria-labelledby': `ft-${id}-h` }, [
    el('h2', { class: 'ft-sec__title', id: `ft-${id}-h`, text: title }),
    lede ? el('p', { class: 'ft-sec__lede', text: lede }) : null,
    ...[].concat(children),
  ]);
}

function stat(value, label, { format = fmtInt, duration = 1600 } = {}) {
  const n = el('b', { class: 'ft-stat__n', text: format(0) });
  const box = el('div', { class: 'ft-stat' }, [n, el('span', { class: 'ft-stat__l', text: label })]);
  whenVisible(box, () => countUp(n, { to: value, format, duration }));
  return box;
}

function pair(label, a, aLabel, b, bLabel) {
  return el('div', { class: 'ft-pair' }, [
    el('h3', { class: 'ft-pair__t', text: label }),
    el('div', { class: 'ft-pair__row' }, [
      el('div', {}, [el('b', { text: a }), el('span', { text: aLabel })]),
      el('div', {}, [el('b', { text: b }), el('span', { text: bLabel })]),
    ]),
  ]);
}

/**
 * @param {object} stats
 * @param {Map<string,string[]>} notes
 */
/** A two-way switch. `onChange(value)` fires when the other side is chosen. */
function segmented(label, options, value, onChange) {
  const wrap = el('div', { class: 'ft-toggle', role: 'group', 'aria-label': label });
  const buttons = options.map((o) => {
    const b = el('button', { type: 'button', class: 'ft-toggle__btn', 'aria-pressed': String(o.value === value), text: o.label });
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-pressed') === 'true') return;
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onChange(o.value);
    });
    return b;
  });
  wrap.append(...buttons);
  return wrap;
}


/* ───────────── the record book ───────────── */

const HOUR_MS = 3600 * 1000;
const shortHM = (seconds) => `${Math.floor(seconds / 3600)} h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')} m`;

/**
 * A bar as long as the call, on a shared scale, coloured by the sky it ran
 * through: night until sunrise, day until sunset, then night again.
 */
function timeSpan({ from, to, sky, label, value }, maxMs) {
  const a = dateOf(from).getTime();
  const b = dateOf(to).getTime();
  const len = Math.max(1, b - a);
  const pct = (t) => Math.max(0, Math.min(100, ((t - a) / len) * 100));
  const hourPct = (HOUR_MS / len) * 100;
  const firstLight = sky.find((m) => m.kind !== 'midnight');
  let phase = firstLight && firstLight.kind === 'sunset' ? 'day' : 'night';
  const stops = [`var(--b-${phase}) 0%`];
  sky.forEach((m) => {
    const p = pct(dateOf(m.at).getTime());
    if (m.kind === 'sunrise') {
      stops.push(`var(--b-night) ${Math.max(0, p - hourPct * 0.6).toFixed(2)}%`, `var(--b-dawn) ${p.toFixed(2)}%`, `var(--b-day) ${Math.min(100, p + hourPct * 1.4).toFixed(2)}%`);
      phase = 'day';
    } else if (m.kind === 'sunset') {
      stops.push(`var(--b-day) ${Math.max(0, p - hourPct * 1.4).toFixed(2)}%`, `var(--b-dusk) ${p.toFixed(2)}%`, `var(--b-night) ${Math.min(100, p + hourPct * 0.8).toFixed(2)}%`);
      phase = 'night';
    }
  });
  stops.push(`var(--b-${phase}) 100%`);

  const marks = sky.map((m) => el('span', {
    class: `ft-span__mark is-${m.kind}`,
    style: { left: `${pct(dateOf(m.at).getTime()).toFixed(2)}%` },
    title: `${m.kind === 'midnight' ? 'Midnight' : m.kind === 'sunrise' ? 'Sunrise' : 'Sunset'}, ${m.time}`,
  }, [
    el('i', { 'aria-hidden': 'true' }, [skyGlyph(m.kind)]),
    el('small', { text: m.kind === 'midnight' ? 'midnight' : m.time }),
  ]));
  const desc = `${label}: ${clock(from)} ${shortMonthDay(from)} to ${clock(to)} ${shortMonthDay(to)}. ${sky.filter((m) => m.kind !== 'midnight').map((m) => `${m.kind} at ${m.time}`).join(', ')}.`;
  return el('figure', { class: 'ft-span', style: { '--w': `${((len / maxMs) * 100).toFixed(2)}%` } }, [
    el('figcaption', { class: 'ft-span__cap' }, [el('span', { text: label }), el('b', { text: value })]),
    el('div', { class: 'ft-span__track' }, [
      el('div', { class: 'ft-span__bar', role: 'img', 'aria-label': desc, style: { background: `linear-gradient(90deg, ${stops.join(', ')})` } }, marks),
    ]),
    el('div', { class: 'ft-span__ends', 'aria-hidden': 'true' }, [
      el('span', { text: `${clock(from)}, ${shortMonthDay(from)}` }),
      el('span', { text: `${clock(to)}, ${shortMonthDay(to)}` }),
    ]),
  ]);
}

const GLYPHS = {
  sunrise: 'M12 7a5 5 0 0 1 5 5H7a5 5 0 0 1 5-5zm-1-5h2v3h-2zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1zM2 14h20v2H2z',
  sunset: 'M12 7a5 5 0 0 1 5 5H7a5 5 0 0 1 5-5zM2 14h20v2H2zm9 3h2v4h-2z',
  midnight: 'M14.5 3a8.5 8.5 0 1 0 6.4 14.1A7 7 0 0 1 14.5 3z',
};
function skyGlyph(kind) {
  return svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, [svg('path', { d: GLYPHS[kind], fill: 'currentColor' })]);
}

/** A small round stamp that lands on each record as it scrolls in. */
function seal(i) {
  const id = `ft-seal-${i}`;
  const tilt = Math.round((hash01(id, 7) - 0.5) * 26);
  return svg('svg', { class: 'ft-seal', viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false', style: `--tilt: ${tilt}deg` }, [
    svg('defs', {}, [svg('path', { id, d: 'M50 50 m-36 0 a36 36 0 1 1 72 0 a36 36 0 1 1 -72 0' })]),
    svg('circle', { cx: 50, cy: 50, r: 47, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5 }),
    svg('circle', { cx: 50, cy: 50, r: 27, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }),
    svg('text', { class: 'ft-seal__ring' }, [svg('textPath', { href: `#${id}`, startOffset: '0', textLength: '222' }, ['CERTIFIED  ·  BY US  ·  ON THE RECORD  ·'])]),
    svg('path', { d: 'M50 64.5l-2.2-2C40.2 55.7 35 51 35 45.3c0-4.7 3.7-8.3 8.3-8.3 2.6 0 5.1 1.2 6.7 3.1 1.6-1.9 4.1-3.1 6.7-3.1 4.6 0 8.3 3.6 8.3 8.3 0 5.7-5.2 10.4-12.8 17.2z', fill: 'currentColor' }),
  ]);
}

export function buildExplore(stats, notes, { onReplay, birthday, now = new Date(), palette = 'sky', onPalette = null }) {
  const t = stats.totals;
  const root = el('div', { class: 'ft-explore', 'data-ink': 'light', 'data-palette': palette });

  /* ── header ── */
  const monthsary = monthsaryLine(stats.official.date, now);
  const bday = birthdayState(birthday, now);
  const replay = el('button', { type: 'button', class: 'ft-cta ft-cta--ghost', text: 'Watch the story again' });
  replay.addEventListener('click', onReplay);
  root.appendChild(el('header', { class: 'ft-head' }, [
    el('h1', { class: 'ft-head__title', text: 'One call away' }),
    el('p', { class: 'ft-head__lede', text: `Every call since the very first one, FaceTime and WhatsApp before it. ${longDate(stats.range.first_call)} to ${longDate(stats.range.last_call)}.` }),
    monthsary ? el('p', { class: 'ft-head__line', text: monthsary }) : null,
    bday.mode === 'window' ? el('p', { class: 'ft-head__line', text: `Happy ${tripLabel(bday.age)}, my Miracle☀️.` }) : null,
    el('div', { class: 'ft-stats' }, [
      stat(Math.floor(t.hours), 'hours'),
      stat(t.connected_calls, 'calls that connected'),
      stat(t.days_talked, 'days we talked'),
      stat(stats.nights.fell_asleep_calls, 'nights we fell asleep'),
      stat(stats.sunrises.count, 'sunrises on a call'),
      stat(t.days_together_in_person, 'days in the same room'),
    ]),
    el('div', { class: 'ft-head__actions' }, [
      replay,
      onPalette ? segmented('Colours', [{ value: 'sky', label: 'Sky' }, { value: 'pink', label: 'Pink' }], palette, (v) => {
        root.dataset.palette = v;
        onPalette(v);
      }) : null,
    ]),
  ]));

  /* ── every day ── */
  const byMonth = new Map();
  stats.daily.forEach((d) => {
    const key = d.date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(d);
  });
  const keys = [...byMonth.keys()].sort();
  const visitFor = (iso) => stats.visits.find((v) => v.from <= iso && iso <= v.to);
  const describeDay = (day, detail) => {
    const v = day.together ? visitFor(day.date) : null;
    const bits = [];
    if (day.date === stats.official.date) bits.push('The day we made it official.');
    if (v) bits.push(`Together in ${v.where}.`);
    if (day.hours > 0) bits.push(`${fmtNum(day.hours)} hours on a call, over ${plural(day.calls, 'call')}.`);
    else if (!v) bits.push('A quiet day.');
    if (day.fell_asleep) bits.push('We fell asleep on the call.');
    if (day.sunrise) bits.push('The sun came up while we were on.');
    detail.replaceChildren(
      el('b', { text: `${weekdayShort(day.date)}, ${longDate(day.date)}. ` }),
      bits.join(' '),
      day.hours > 0 ? hourStrip(day.minutes_by_hour) : null,
    );
  };
  const onPick = (day, btn, block) => {
    block.querySelectorAll('.ft-day').forEach((b) => b.classList.toggle('is-active', b === btn));
    describeDay(day, block.querySelector('.ft-month__detail'));
  };
  const dotDetail = el('p', { class: 'ft-dots__detail', 'aria-live': 'polite', text: 'Hover or tap a dot to see that day.' });
  const dots = dotGrid(stats.daily, {
    official: stats.official.date,
    onPick: (day, dot) => {
      dots.querySelectorAll('.ft-dot.is-active').forEach((d) => d.classList.remove('is-active'));
      dot.classList.add('is-active');
      describeDay(day, dotDetail);
    },
  });
  const months = el('div', { class: 'ft-months' });
  const SHOWN = 4;
  keys.forEach((key, i) => {
    const block = monthCalendar(key, byMonth.get(key), onPick);
    if (i < keys.length - SHOWN) block.hidden = true;
    months.appendChild(block);
  });
  const moreBtn = el('button', { type: 'button', class: 'ft-cta ft-cta--ghost', text: `Show all ${keys.length} months` });
  moreBtn.addEventListener('click', () => {
    months.querySelectorAll('.ft-month[hidden]').forEach((b) => { b.hidden = false; });
    moreBtn.remove();
  });
  const overview = el('div', { class: 'ft-days__panel' }, [
    el('div', { class: 'ft-legend', 'aria-hidden': 'true' }, [
      el('span', { class: 'ft-legend__dot', style: { '--v': '0.25' } }), el('span', { text: 'a little' }),
      el('span', { class: 'ft-legend__dot', style: { '--v': '1' } }), el('span', { text: 'most of the day' }),
      el('span', { class: 'ft-legend__dot is-none' }), el('span', { text: 'no call' }),
      el('span', { class: 'ft-legend__dot is-together' }), el('span', { text: 'together' }),
      el('span', { class: 'ft-legend__dot is-official', style: { '--v': '0.6' } }), el('span', { text: 'we made it official' }),
    ]),
    dots,
    dotDetail,
  ]);
  const calendars = el('div', { class: 'ft-days__panel', hidden: true }, [
    el('div', { class: 'ft-legend', 'aria-hidden': 'true' }, [
      el('span', { class: 'ft-legend__i is-l1' }), el('span', { text: 'a little' }),
      el('span', { class: 'ft-legend__i is-l4' }), el('span', { text: 'most of the day' }),
      el('span', { class: 'ft-legend__i is-together' }), el('span', { text: 'together' }),
      el('i', { class: 'ft-day__mark ft-day__mark--night ft-legend__m' }), el('span', { text: 'fell asleep' }),
      el('i', { class: 'ft-day__mark ft-day__mark--sun ft-legend__m' }), el('span', { text: 'sunrise' }),
    ]),
    months,
    keys.length > SHOWN ? moreBtn : null,
  ]);
  const daysSwitch = segmented('How to show the days', [{ value: 'overview', label: 'Every day at once' }, { value: 'months', label: 'Month by month' }], 'overview', (v) => {
    overview.hidden = v !== 'overview';
    calendars.hidden = v !== 'months';
  });
  root.appendChild(section('days', 'Every day since our first call', 'Each dot is one day, and brighter means we talked longer. The ringed dot is the day we made it official.', [
    daysSwitch,
    overview,
    calendars,
  ]));

  /* ── our clock ── */
  const nights = stats.nights;
  root.appendChild(section('clock', 'Our clock', `${fmtInt(nights.night_share_pct)}% of all our time on calls was between midnight and 6 AM.`, [
    el('div', { class: 'ft-dialwrap' }, [clockDial(nights.hours_by_hour)]),
    el('p', { class: 'ft-sec__note', text: `Our busiest hour is ${hourLabel(nights.peak_hour)}. The quietest is ${hourLabel(nights.hours_by_hour.indexOf(Math.min(...nights.hours_by_hour)))}.` }),
  ]));

  /* ── month by month ── */
  const monthly = stats.monthly.filter((m) => !m.partial || m === stats.monthly[0]);
  const chart = monthlyLine(stats.monthly);
  const mDetail = el('p', { class: 'ft-detail is-shown', 'aria-live': 'polite', text: 'Tap a month.' });
  const pickMonth = (key) => {
    const m = stats.monthly.find((x) => x.month === key);
    if (!m) return;
    mDetail.textContent = `${monthLabel(m.month)}: ${fmtNum(m.hours)} hours, ${fmtNum(m.hours_per_day)} a day, over ${plural(m.calls, 'call')}. A call lasted ${fmtNum(m.avg_call_hours)} hours on average, and we fell asleep on ${m.sleep_calls} of them.`;
    chart.querySelectorAll('.ft-monthly__pt').forEach((p) => p.classList.toggle('is-active', p.dataset.month === key));
  };
  chart.addEventListener('click', (e) => { const pt = e.target.closest('.ft-monthly__pt'); if (pt) pickMonth(pt.dataset.month); });
  chart.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const pt = e.target.closest('.ft-monthly__pt'); if (pt) { e.preventDefault(); pickMonth(pt.dataset.month); } } });
  const shortest = monthly.reduce((a, b) => (a.avg_call_hours < b.avg_call_hours ? a : b));
  const longest = monthly.reduce((a, b) => (a.avg_call_hours > b.avg_call_hours ? a : b));
  root.appendChild(section('months', 'Month by month', 'Hours a day, as the months went on.', [
    chart,
    mDetail,
    el('p', { class: 'ft-sec__note', text: `Our calls got longer. In ${monthLabel(shortest.month)} one lasted about ${hoursMinutes(shortest.avg_call_hours * 3600)}. By ${monthLabel(longest.month)}, about ${hoursMinutes(longest.avg_call_hours * 3600)}.` }),
  ]));

  /* ── nights and sunrises ── */
  root.appendChild(section('nights', 'Nights and mornings', null, [
    el('div', { class: 'ft-stats ft-stats--two' }, [
      stat(nights.fell_asleep_calls, 'nights we fell asleep on the call'),
      stat(stats.sunrises.count, 'mornings the sun rose while we were on'),
    ]),
    el('p', { class: 'ft-sec__note', text: `A night like that lasted ${fmtNum(nights.avg_hours)} hours on average${nights.median_wake_time ? `, and on a typical one we were still on at ${nights.median_wake_time.replace(/^(\d+):(\d+)$/, (s, h, m) => `${h}:${m} ${Number(h) < 12 ? 'AM' : 'PM'}`)} the next morning` : ''}. The first was ${longDate(nights.first)}, our first night on FaceTime.` }),
  ]));

  /* ── together ── */
  const visitCards = stats.visits.map((v) => {
    const from = dateOf(v.from); const to = dateOf(v.to);
    const range = from.getMonth() === to.getMonth() ? `${monthDay(v.from)} to ${to.getDate()}, ${to.getFullYear()}` : `${monthDay(v.from)} to ${monthDay(v.to)}, ${to.getFullYear()}`;
    return el('article', { class: 'ft-visit' }, [
      el('h3', { class: 'ft-visit__where', text: v.where }),
      el('p', { class: 'ft-visit__when', text: `${range}. ${plural(v.days, 'day')}. ${v.who}.` }),
      v.note ? el('p', { class: 'ft-visit__note', text: v.note }) : null,
      el('ul', { class: 'ft-visit__facts' }, [
        v.facetime_days_inside ? el('li', { text: `We still called on ${v.facetime_days_inside} of those days.` }) : el('li', { text: 'Not one call. No need.' }),
        v.back_on_facetime ? el('li', { text: `Back on a call ${fmtNum(v.back_on_facetime.hours_after_leaving)} hours after we said goodbye.` }) : null,
        el('li', { text: `${fmtInt(v.hours_week_before)} hours the week before, ${fmtInt(v.hours_week_after)} the week after.` }),
      ]),
    ]);
  });
  root.appendChild(section('together', 'In the same room', `${plural(t.days_together_in_person, 'day')} together in person, next to ${fmtInt(t.days_talked)} days on a call.`, [
    el('div', { class: 'ft-visits' }, visitCards),
    noteBlock(notes, 'visits', 'ft-note ft-note--explore'),
  ]));

  /* ── milestones ── */
  const nxt = stats.next_milestone;
  root.appendChild(section('milestones', 'The climb', 'Every hour, adding up.', [
    climb(stats.daily, stats.milestones, nxt),
    el('ol', { class: 'ft-milestones ft-milestones--explore' }, stats.milestones.map((m) => el('li', { class: 'ft-milestone' }, [
      el('b', { text: `${fmtInt(m.hours)} hours` }), el('span', { text: longDate(m.date) }), el('small', { text: `day ${m.day_number}` }),
    ]))),
    nxt ? el('p', { class: 'ft-sec__note', text: `At ${fmtNum(nxt.based_on_hours_per_day)} hours a day, we should pass ${fmtInt(nxt.hours)} around ${longDate(nxt.expected_date)}.` }) : null,
  ]));

  /* ── who called who ── */
  const d = stats.direction;
  const cb = stats.called_right_back;
  const started = nights.started_by || {};
  root.appendChild(section('who', 'Who called who', null, [
    splitBar(d.incoming.connected, d.outgoing.connected, { leftLabel: 'you called', rightLabel: 'I called', format: fmtInt }),
    el('p', { class: 'ft-sec__note', text: `Counting only the calls that connected. You have called ${fmtInt(d.incoming.attempts)} times in all, I have called ${fmtInt(d.outgoing.attempts)}. The nights we fell asleep, you started ${fmtInt(started.incoming || 0)} and I started ${fmtInt(started.outgoing || 0)}.` }),
    cb ? el('p', { class: 'ft-sec__note', text: `${fmtInt(cb.of_missed_or_canceled)} calls never connected. ${fmtInt(cb.episodes)} times, one of us got through again within ${cb.window_minutes} minutes, you ${fmtInt(cb.who_got_through.incoming || 0)} times and me ${fmtInt(cb.who_got_through.outgoing || 0)}.` }) : null,
  ]));

  /* ── then and now ── */
  const o = stats.official;
  const w = stats.weekdays;
  const fy = stats.first_year;
  const hy = stats.her_year;
  root.appendChild(section('compare', 'Then and now', null, [
    el('div', { class: 'ft-pairs' }, [
      pair(`Before and after ${monthDay(o.date)}, ${dateOf(o.date).getFullYear()}`, `${fmtNum(o.before.hours_per_day)} h`, 'a day before we were official', `${fmtNum(o.after.hours_per_day)} h`, 'a day since'),
      pair('Weekdays and weekends', `${fmtNum(w.weekday_hours_per_day)} h`, 'a weekday', `${fmtNum(w.weekend_hours_per_day)} h`, 'a weekend day'),
      pair(`Our first year, ${monthDay(fy.from)} to ${monthDay(fy.to)}`, fmtInt(fy.hours), 'hours', `${fy.days_talked + fy.days_together}`, 'days we saw each other, of 365'),
      pair(`Your ${ordinal(hy.age_turned - 1)} year, ${monthDay(hy.from)} to ${monthDay(hy.to)}`, fmtInt(hy.hours), 'hours on a call', `${fmtInt(hy.share_pct)}%`, 'of the whole year'),
    ]),
    el('h3', { class: 'ft-sub', text: `${w.best_day}s are our day.` }),
    weekdayBars(w.per_weekday_hours_per_day),
  ]));

  /* ── records ── */
  const r = stats.records;
  const L = stats.longest_call;
  const S = stats.longest_stretch;
  const xmas = stats.moments.find((m) => m.label === 'Christmas');
  const wordNumber = (n) => ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'][n - 1] || fmtInt(n);
  const streak = stats.streaks;
  const records = [
    r.full_24_hour_days.length ? { value: fmtInt(r.full_24_hour_days.length), unit: r.full_24_hour_days.length === 1 ? 'whole day' : 'whole days', title: 'All 24 hours on a call',
      text: 'Midnight to midnight, without hanging up.', chips: r.full_24_hour_days.map((x) => `${shortMonthDay(x)}, ${dateOf(x).getFullYear()}`) } : null,
    xmas && xmas.on_facetime ? { value: fmtInt(xmas.call_hours), unit: 'hours, one call', title: 'Christmas, start to finish',
      text: `From ${clock(xmas.call_started)} on Christmas Eve until ${clock(xmas.call_ended)} on Boxing Day.` } : null,
    { value: fmtInt(streak.facetime.days), unit: 'days in a row', title: 'On a call every day',
      text: `${monthDay(streak.facetime.from)} to ${longDate(streak.facetime.to)}.` },
    streak.current.days === streak.facetime_or_together.days
      ? { value: fmtInt(streak.current.days), unit: 'days and counting', title: 'Seeing each other every day',
        text: `On a screen or in the same room, every single day since ${longDate(streak.current.from)}.` }
      : { value: fmtInt(streak.facetime_or_together.days), unit: 'days in a row', title: 'Seeing each other every day',
        text: `Counting the days we were together. ${monthDay(streak.facetime_or_together.from)} to ${longDate(streak.facetime_or_together.to)}.` },
    streak.current.days > 1 && streak.current.days !== streak.facetime_or_together.days ? { value: fmtInt(streak.current.days), unit: 'days and counting', title: 'Right now',
      text: `Every single day since ${longDate(streak.current.from)}.` } : null,
    { value: fmtInt(r.most_attempts_in_a_day.calls), unit: 'calls', title: 'In a single day',
      text: `${longDate(r.most_attempts_in_a_day.date)}. Some of them even connected.` },
    { value: fmtInt(r.calls_over_12_hours), unit: 'calls', title: 'Longer than twelve hours',
      text: r.calls_over_24_hours ? `${wordNumber(r.calls_over_24_hours)} of them went past a whole day.` : `${plural(r.days_over_20_hours, 'day')} with more than twenty hours.` },
  ].filter(Boolean);

  // The longest call (and the longest stretch, if longer) drawn to one scale,
  // tinted by the real sky over Winnipeg while we were on.
  const spans = [
    { from: L.at, to: L.ended, sky: L.sky || [], label: 'One call, to scale', value: shortHM(L.seconds) },
    S.hours > L.hours ? { from: S.from, to: S.to, sky: S.sky || [], label: S.break_seconds && S.break_seconds.length === 1 ? `One stretch, with a single ${S.break_seconds[0]} second break` : 'One stretch, with hardly a break', value: shortHM(S.hours * 3600) } : null,
  ].filter(Boolean);
  const maxMs = Math.max(...spans.map((s) => dateOf(s.to) - dateOf(s.from)));
  const hero = el('div', { class: 'ft-book__hero' }, [
    el('div', { class: 'ft-book__lead' }, [
      el('h3', { class: 'ft-book__title', text: 'Our longest call' }),
      el('b', { class: 'ft-book__n', text: hms(L.seconds) }),
      el('p', { class: 'ft-book__u', text: 'hours, minutes, seconds' }),
      el('p', { class: 'ft-book__s', text: `${callerSentence(L.who_called)} at ${L.time} on ${longDate(L.at)}, and we were still on at ${L.ended_time} the next day.${(L.sky || []).filter((m) => m.kind === 'sunrise').length >= 2 ? ' The sun came up on us twice.' : ''}` }),
    ]),
    el('div', { class: 'ft-book__spans' }, spans.map((s) => timeSpan(s, maxMs))),
    seal(0),
  ]);

  const entry = (rec, i) => {
    const row = el('li', { class: 'ft-entry' }, [
      el('div', { class: 'ft-entry__num' }, [
        el('b', { class: 'ft-entry__n', text: rec.value }),
        el('span', { class: 'ft-entry__u', text: rec.unit }),
      ]),
      el('div', { class: 'ft-entry__body' }, [
        el('h3', { class: 'ft-entry__t', text: rec.title }),
        el('p', { class: 'ft-entry__s', text: rec.text }),
        rec.chips ? el('ul', { class: 'ft-entry__chips', 'aria-label': 'The days' }, rec.chips.map((c) => el('li', { text: c }))) : null,
      ]),
      seal(i + 1),
    ]);
    whenVisible(row, () => row.classList.add('is-stamped'));
    return row;
  };
  whenVisible(hero, () => hero.classList.add('is-stamped'));
  root.appendChild(section('records', 'For the record', 'The ones worth bragging about.', [
    el('div', { class: 'ft-book' }, [
      hero,
      el('ol', { class: 'ft-book__rows' }, records.map(entry)),
    ]),
  ]));

  /* ── the letter ── */
  if (notes.has('letter')) {
    root.appendChild(section('letter', 'A letter', null, [
      el('p', { class: 'ft-dear', text: 'Dear Miracle☀️,' }),
      noteBlock(notes, 'letter', 'ft-letter'),
    ]));
  }

  /* ── the end ── */
  const field = el('div', { class: 'ft-end__field' });
  const handset = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, [
    svg('path', { d: 'M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z' }),
  ]);
  const endBtn = el('button', { type: 'button', class: 'ft-end__btn', 'aria-label': 'End call' }, [handset]);
  const endLine = el('p', { class: 'ft-end__line', hidden: true, text: 'We never hang up first.' });
  field.appendChild(endBtn);
  fleeButton(endBtn, () => {
    endBtn.classList.add('is-caught');
    endLine.hidden = false;
    heartsBurst(field, { count: 20 });
  });
  root.appendChild(section('end', "That's everything.", 'Almost.', [
    field,
    endLine,
    el('p', { class: 'ft-end__sub', text: `${fmtInt(t.hours)} hours, and counting.` }),
  ]));

  return root;
}

/**
 * The sky behind the explore view. Three gradients cross-fade with scroll.
 */
export function buildSky() {
  const sky = el('div', { class: 'ft-sky', 'aria-hidden': 'true' }, [
    el('div', { class: 'ft-sky__night' }),
    el('div', { class: 'ft-sky__dawn' }),
    el('div', { class: 'ft-sky__morning' }),
  ]);
  return sky;
}

/** Keep the sky and the ink in step with how far down the page she is. */
export function bindSkyToScroll(sky, explore) {
  const night = sky.querySelector('.ft-sky__night');
  const dawn = sky.querySelector('.ft-sky__dawn');
  const morning = sky.querySelector('.ft-sky__morning');
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const p = Math.min(1, Math.max(0, window.scrollY / max));
    // night fades out across the first half, morning fades in across the second
    night.style.opacity = String(Math.max(0, 1 - p * 2.2));
    dawn.style.opacity = String(p < 0.5 ? Math.min(1, p * 2.2) : Math.max(0, 1 - (p - 0.5) * 2.2));
    morning.style.opacity = String(Math.max(0, (p - 0.5) * 2.2));
    if (explore.dataset.palette === 'pink') {
      explore.dataset.ink = 'dark';
      return;
    }
    explore.dataset.ink = p > 0.64 ? 'dark' : 'light';
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
  return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
}
