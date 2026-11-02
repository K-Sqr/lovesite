/**
 * explore.js — everything, to scroll and tap, once the story has been told.
 *
 *   buildExplore(stats, notes, { onReplay, birthday }) → element
 *
 * The sky keeps moving as she scrolls, dusk at the top, morning at the bottom.
 * Sections are the real numbers again, with room to poke at every day.
 */

import { svgIcon } from '../icons.js';
import { el, svg, dateOf, fmtInt, fmtNum, hms, clock, longDate, monthDay, monthLabel, hourLabel, weekdayShort, callerSentence, plural, hoursMinutes, ordinal } from './format.js';
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

export function buildExplore(stats, notes, { onReplay, birthday, now = new Date(), palette = 'sky', onPalette = null }) {
  const t = stats.totals;
  const root = el('div', { class: 'ft-explore', 'data-ink': 'light', 'data-palette': palette });

  /* ── header ── */
  const monthsary = monthsaryLine(stats.official.date, now);
  const bday = birthdayState(birthday, now);
  const replay = el('button', { type: 'button', class: 'ft-cta ft-cta--ghost', text: 'Watch the story again' });
  replay.addEventListener('click', onReplay);
  root.appendChild(el('header', { class: 'ft-head' }, [
    el('h1', { class: 'ft-head__title', text: 'Us, on FaceTime' }),
    el('p', { class: 'ft-head__lede', text: `Every call since the very first one. ${longDate(stats.range.first_call)} to ${longDate(stats.range.last_call)}.` }),
    monthsary ? el('p', { class: 'ft-head__line', text: monthsary }) : null,
    bday.mode === 'window' ? el('p', { class: 'ft-head__line', text: `Happy ${tripLabel(bday.age)}.` }) : null,
    el('div', { class: 'ft-stats' }, [
      stat(Math.floor(t.hours), 'hours'),
      stat(t.connected_calls, 'calls that connected'),
      stat(t.days_talked, 'days on FaceTime'),
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
    if (day.hours > 0) bits.push(`${fmtNum(day.hours)} hours on FaceTime over ${plural(day.calls, 'call')}.`);
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
  root.appendChild(section('clock', 'Our clock', `${fmtInt(nights.night_share_pct)}% of all our time on FaceTime was between midnight and 6 AM.`, [
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
        v.facetime_days_inside ? el('li', { text: `We still called on ${v.facetime_days_inside} of those days.` }) : el('li', { text: 'Not one FaceTime. No need.' }),
        v.back_on_facetime ? el('li', { text: `Back on FaceTime ${fmtNum(v.back_on_facetime.hours_after_leaving)} hours after we said goodbye.` }) : null,
        el('li', { text: `${fmtInt(v.hours_week_before)} hours the week before, ${fmtInt(v.hours_week_after)} the week after.` }),
      ]),
    ]);
  });
  root.appendChild(section('together', 'In the same room', `${plural(t.days_together_in_person, 'day')} together in person, next to ${fmtInt(t.days_talked)} on FaceTime.`, [
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
      pair(`Your ${ordinal(hy.age_turned - 1)} year, ${monthDay(hy.from)} to ${monthDay(hy.to)}`, fmtInt(hy.hours), 'hours on FaceTime', `${fmtInt(hy.share_pct)}%`, 'of the whole year'),
    ]),
    el('h3', { class: 'ft-sub', text: `${w.best_day}s are our day.` }),
    weekdayBars(w.per_weekday_hours_per_day),
  ]));

  /* ── records ── */
  const r = stats.records;
  const L = stats.longest_call;
  const S = stats.longest_stretch;
  const xmas = stats.moments.find((m) => m.label === 'Christmas');
  const record = ({ icon, value, title, text, big = false }) => el('article', { class: `ft-rec${big ? ' ft-rec--big' : ''}` }, [
    el('span', { class: 'ft-rec__icon', 'aria-hidden': 'true', text: icon }),
    el('div', { class: 'ft-rec__body' }, [
      el('b', { class: 'ft-rec__n', text: value }),
      el('h3', { class: 'ft-rec__t', text: title }),
      el('p', { class: 'ft-rec__s', text: text }),
    ]),
  ]);
  const streak = stats.streaks;
  const records = [
    { big: true, icon: '\u{23F3}', value: hms(L.seconds), title: 'Our longest call',
      text: `${callerSentence(L.who_called)} at ${L.time} on ${longDate(L.at)}, and we were still on at ${L.ended_time} the next day.` },
    S.hours > L.hours ? { icon: '\u{1F501}', value: hoursMinutes(S.hours * 3600), title: 'Our longest stretch',
      text: `${monthDay(S.from)} to ${monthDay(S.to)}, ${S.break_seconds && S.break_seconds.length === 1 ? `with one ${S.break_seconds[0]} second break` : 'with hardly a break'}.` } : null,
    r.full_24_hour_days.length ? { icon: '\u{1F319}', value: plural(r.full_24_hour_days.length, 'day'), title: 'All 24 hours, on FaceTime',
      text: r.full_24_hour_days.map((x) => monthDay(x)).join(', ') + '.' } : null,
    xmas && xmas.on_facetime ? { icon: '\u{1F384}', value: `${fmtInt(xmas.call_hours)} hours`, title: 'Christmas, inside one call',
      text: `From ${clock(xmas.call_started)} on Christmas Eve until ${clock(xmas.call_ended)} on Boxing Day.` } : null,
    { icon: '\u{1F525}', value: plural(streak.facetime.days, 'day'), title: 'In a row on FaceTime',
      text: `${monthDay(streak.facetime.from)} to ${longDate(streak.facetime.to)}.` },
    { icon: '\u{1F440}', value: plural(streak.facetime_or_together.days, 'day'), title: 'In a row seeing each other',
      text: `Counting the days we were together. ${monthDay(streak.facetime_or_together.from)} to ${longDate(streak.facetime_or_together.to)}.` },
    streak.current.days > 1 ? { icon: '\u{1F4C8}', value: plural(streak.current.days, 'day'), title: 'And counting',
      text: `Every single day since ${longDate(streak.current.from)}.` } : null,
    { icon: '\u{1F4F1}', value: plural(r.most_attempts_in_a_day.calls, 'call'), title: 'In a single day',
      text: `${longDate(r.most_attempts_in_a_day.date)}. Some of them even connected.` },
    { icon: '\u{1F55B}', value: plural(r.calls_over_12_hours, 'call'), title: 'Longer than twelve hours',
      text: r.calls_over_24_hours ? `${plural(r.calls_over_24_hours, 'call').replace(/^\d+/, (n) => ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'][Number(n) - 1] || n)} went past a whole day.` : `${plural(r.days_over_20_hours, 'day')} with more than twenty hours.` },
  ].filter(Boolean);
  root.appendChild(section('records', 'For the record', 'The ones worth bragging about.', [
    el('div', { class: 'ft-recs' }, records.map(record)),
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
