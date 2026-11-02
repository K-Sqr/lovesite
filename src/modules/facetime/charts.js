/**
 * charts.js — the small, hand-drawn SVG pieces of the FaceTime pages.
 *
 * Everything here is built from aggregates in facetime-stats.json. Shapes are
 * data, never decoration: the horizon is our days, every star is a night we
 * fell asleep on a call, every ray of the orbit is a day of her year.
 */

import { el, svg, hash01, monthShort, hourLabel, fmtNum } from './format.js';

/* ───────────────────────── horizon ───────────────────────── */

/**
 * A skyline drawn from hours per day. Smoothing keeps it a landscape rather than
 * a bar chart; the tallest peaks are the days we spent all 24 hours on a call.
 * @param {{hours:number}[]} daily
 */
function horizonPoints(daily, { width = 1000, height = 200, smooth = 2, scale = 0.92 } = {}) {
  const n = daily.length;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - smooth); j <= Math.min(n - 1, i + smooth); j += 1) {
      sum += daily[j].hours;
      count += 1;
    }
    const v = sum / count;
    pts.push([(i / (n - 1)) * width, height - (v / 24) * height * scale]);
  }
  return pts;
}

export function horizonPath(daily, opts = {}) {
  const { width = 1000, height = 200 } = opts;
  let d = `M0,${height} `;
  horizonPoints(daily, opts).forEach(([x, y]) => { d += `L${x.toFixed(1)},${y.toFixed(1)} `; });
  d += `L${width},${height} Z`;
  return d;
}



/**
 * The horizon element. `highlight` lights the days we were together in gold.
 * @param {{date:string, hours:number, together?:boolean}[]} daily
 */
export function horizon(daily, { width = 1000, height = 200, highlight = false, id = 'ftHorizon' } = {}) {
  const root = svg('svg', {
    class: 'ft-horizon',
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  root.appendChild(svg('path', { class: 'ft-horizon__land', d: horizonPath(daily, { width, height }) }));

  if (highlight) {
    // One gold glow per visit: a soft column over the days we were in the same room.
    const gid = `ftVisitGlow${Math.random().toString(36).slice(2, 7)}`;
    const grad = svg('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.append(
      svg('stop', { offset: '0', 'stop-color': '#ffc247', 'stop-opacity': '0' }),
      svg('stop', { offset: '0.55', 'stop-color': '#ffc247', 'stop-opacity': '0.55' }),
      svg('stop', { offset: '1', 'stop-color': '#ffd98a', 'stop-opacity': '0.95' }),
    );
    root.appendChild(svg('defs', {}, [grad]));
    let i = 0;
    while (i < daily.length) {
      if (!daily[i].together) { i += 1; continue; }
      let j = i;
      while (j + 1 < daily.length && daily[j + 1].together) j += 1;
      const x0 = (i / (daily.length - 1)) * width;
      const x1 = ((j + 1) / (daily.length - 1)) * width;
      root.appendChild(svg('rect', {
        class: 'ft-horizon__visit',
        x: (x0 - 1).toFixed(1), y: 0, width: Math.max(5, x1 - x0 + 2).toFixed(1), height,
        fill: `url(#${gid})`,
        'data-from': daily[i].date, 'data-to': daily[j].date,
      }));
      i = j + 1;
    }
  }
  return root;
}

/* ───────────────────────── stars ───────────────────────── */

/**
 * A star for every night we fell asleep on a call. Positions come from the
 * date, so the sky looks the same every time she opens it.
 * @param {string[]} nights ISO dates
 */
export function starField(nights, { count = nights.length, width = 100, height = 100, bottomClear = 0.3 } = {}) {
  const root = svg('svg', {
    class: 'ft-stars',
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid slice',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const groups = [svg('g', { class: 'ft-stars__g ft-stars__g--a' }), svg('g', { class: 'ft-stars__g ft-stars__g--b' }), svg('g', { class: 'ft-stars__g ft-stars__g--c' })];
  const used = nights.slice(0, count);
  used.forEach((night, i) => {
    const x = hash01(night, 1) * width;
    const y = hash01(night, 2) * height * (1 - bottomClear);
    const r = 0.07 + hash01(night, 3) * 0.17;
    const o = 0.45 + hash01(night, 4) * 0.55;
    groups[i % 3].appendChild(svg('circle', { cx: x.toFixed(2), cy: y.toFixed(2), r: r.toFixed(2), opacity: o.toFixed(2), 'data-night': night }));
  });
  groups.forEach((g) => root.appendChild(g));
  return root;
}

/* ───────────────────────── orbit ───────────────────────── */

/**
 * Her year as one trip around the sun: a ray for each day, longer the longer we
 * talked, gold on the days we were together.
 * @param {{date:string, hours:number, together:boolean}[]} days
 */
export function orbit(days, { size = 320, inner = 0.34, maxRay = 0.42, withRing = true } = {}) {
  const c = size / 2;
  const r0 = c * inner;
  const root = svg('svg', {
    class: 'ft-orbit',
    viewBox: `0 0 ${size} ${size}`,
    role: 'img',
    'aria-label': `One year as a circle, a ray for each of the ${days.length} days`,
  });
  const defs = svg('defs');
  const grad = svg('radialGradient', { id: 'ftSunGrad' });
  grad.append(
    svg('stop', { offset: '0', 'stop-color': '#fff6cf' }),
    svg('stop', { offset: '0.55', 'stop-color': '#ffd25e' }),
    svg('stop', { offset: '1', 'stop-color': '#ffb21f' }),
  );
  defs.appendChild(grad);
  root.appendChild(defs);

  if (withRing) {
    root.appendChild(svg('circle', { class: 'ft-orbit__ring', cx: c, cy: c, r: (c * 0.94).toFixed(1) }));
  }
  const rays = svg('g', { class: 'ft-orbit__rays' });
  days.forEach((day, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / days.length;
    const len = day.together ? c * maxRay : day.hours <= 0 ? 2 : 4 + (day.hours / 24) * c * (maxRay - 0.06);
    const x0 = c + r0 * Math.cos(a);
    const y0 = c + r0 * Math.sin(a);
    const x1 = c + (r0 + len) * Math.cos(a);
    const y1 = c + (r0 + len) * Math.sin(a);
    const level = day.together ? 'together' : day.hours <= 0 ? 'none' : day.hours < 6 ? 'low' : day.hours < 14 ? 'mid' : 'high';
    rays.appendChild(svg('line', {
      class: `ft-orbit__ray is-${level}`,
      x1: x0.toFixed(1), y1: y0.toFixed(1), x2: x1.toFixed(1), y2: y1.toFixed(1),
      'data-date': day.date, 'data-hours': day.hours, 'data-together': day.together ? '1' : null,
      style: `--i:${i}`,
    }));
  });
  root.appendChild(rays);
  root.appendChild(svg('circle', { class: 'ft-orbit__sun', cx: c, cy: c, r: (r0 * 0.78).toFixed(1), fill: 'url(#ftSunGrad)' }));
  return root;
}

/* ───────────────────────── monthly ───────────────────────── */

/**
 * Hours a day, month by month, as a rising line with a dot per month.
 * @param {{month:string, hours_per_day:number, avg_call_hours:number, partial:boolean}[]} monthly
 */
export function monthlyLine(monthly, { width = 600, height = 220, pad = 28 } = {}) {
  const months = monthly.filter((m) => !m.partial || m === monthly[0]);
  const max = Math.max(...months.map((m) => m.hours_per_day)) * 1.1;
  const x = (i) => pad + (i / (months.length - 1)) * (width - pad * 2);
  const y = (v) => height - pad - (v / max) * (height - pad * 2);
  const root = svg('svg', {
    class: 'ft-monthly',
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': 'Hours a day, month by month',
  });
  let d = '';
  let area = `M${x(0)},${height - pad} `;
  months.forEach((m, i) => {
    d += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(m.hours_per_day).toFixed(1)} `;
    area += `L${x(i).toFixed(1)},${y(m.hours_per_day).toFixed(1)} `;
  });
  area += `L${x(months.length - 1)},${height - pad} Z`;
  const gid = `ftAreaGlow${Math.random().toString(36).slice(2, 7)}`;
  const grad = svg('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' });
  grad.append(
    svg('stop', { offset: '0', 'stop-color': 'currentColor', 'stop-opacity': '0.32' }),
    svg('stop', { offset: '1', 'stop-color': 'currentColor', 'stop-opacity': '0' }),
  );
  root.appendChild(svg('defs', {}, [grad]));
  root.appendChild(svg('path', { class: 'ft-monthly__area', d: area, fill: `url(#${gid})` }));
  root.appendChild(svg('path', { class: 'ft-monthly__line', d }));
  const dots = svg('g', { class: 'ft-monthly__dots' });
  months.forEach((m, i) => {
    const g = svg('g', { class: 'ft-monthly__pt', 'data-month': m.month, tabindex: '0', role: 'button',
      'aria-label': `${monthShort(m.month)}: ${fmtNum(m.hours_per_day)} hours a day` });
    g.appendChild(svg('circle', { class: 'ft-monthly__hit', cx: x(i).toFixed(1), cy: y(m.hours_per_day).toFixed(1), r: 16 }));
    g.appendChild(svg('circle', { class: 'ft-monthly__dot', cx: x(i).toFixed(1), cy: y(m.hours_per_day).toFixed(1), r: 4 }));
    if (i % 2 === 0 || months.length <= 9) {
      g.appendChild(svg('text', { class: 'ft-monthly__label', x: x(i).toFixed(1), y: height - 4, 'text-anchor': 'middle', text: monthShort(m.month) + (m.month.endsWith('-01') ? ` '${m.month.slice(2, 4)}` : '') }));
    }
    dots.appendChild(g);
  });
  root.appendChild(dots);
  return root;
}

/* ───────────────────────── clock dial ───────────────────────── */

/**
 * A 24 hour dial. Each wedge is one hour of the day, longer the more we talked then.
 * @param {number[]} hoursByHour
 */
export function clockDial(hoursByHour, { size = 300 } = {}) {
  const c = size / 2;
  const r0 = c * 0.3;
  const max = Math.max(...hoursByHour);
  const root = svg('svg', { class: 'ft-dial', viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': 'When we talk, around the clock' });
  root.appendChild(svg('circle', { class: 'ft-dial__ring', cx: c, cy: c, r: (c * 0.95).toFixed(1) }));
  const peak = hoursByHour.indexOf(max);
  hoursByHour.forEach((h, i) => {
    const a0 = -Math.PI / 2 + (2 * Math.PI * i) / 24 + 0.02;
    const a1 = -Math.PI / 2 + (2 * Math.PI * (i + 1)) / 24 - 0.02;
    const r1 = r0 + (h / max) * (c * 0.62);
    const p = (r, a) => `${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`;
    const d = `M${p(r0, a0)} L${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)} Z`;
    root.appendChild(svg('path', {
      class: `ft-dial__wedge${i === peak ? ' is-peak' : ''}${i < 6 ? ' is-night' : ''}`,
      d, 'data-hour': i, 'data-hours': h,
    }));
  });
  [0, 6, 12, 18].forEach((h) => {
    const a = -Math.PI / 2 + (2 * Math.PI * h) / 24;
    root.appendChild(svg('text', {
      class: 'ft-dial__label', x: (c + c * 0.84 * Math.cos(a)).toFixed(1), y: (c + c * 0.84 * Math.sin(a) + 4).toFixed(1),
      'text-anchor': 'middle', text: h === 0 ? '12 AM' : h === 12 ? 'noon' : hourLabel(h),
    }));
  });
  root.appendChild(svg('text', { class: 'ft-dial__peak', x: c, y: c - 4, 'text-anchor': 'middle', text: hourLabel(peak) }));
  root.appendChild(svg('text', { class: 'ft-dial__peak-sub', x: c, y: c + 14, 'text-anchor': 'middle', text: 'our hour' }));
  return root;
}

/* ───────────────────────── cumulative climb ───────────────────────── */

/**
 * The climb to every hour we have, with the milestones marked on the way up.
 * @param {{date:string, hours:number}[]} daily
 * @param {{hours:number, date:string}[]} milestones
 */
export function climb(daily, milestones, next, { width = 600, height = 240, pad = 26 } = {}) {
  const total = daily.reduce((s, d) => s + d.hours, 0);
  const top = Math.max(total, next ? next.hours : 0) * 1.04;
  const extraDays = next ? next.days_away : 0;
  const n = daily.length + extraDays;
  const x = (i) => pad + (i / (n - 1)) * (width - pad * 2);
  const y = (v) => height - pad - (v / top) * (height - pad * 2);
  const root = svg('svg', { class: 'ft-climb', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Hours adding up over time' });
  let cum = 0;
  let d = `M${x(0)},${y(0)} `;
  const byDate = new Map();
  daily.forEach((day, i) => {
    cum += day.hours;
    byDate.set(day.date, { i, cum });
    d += `L${x(i).toFixed(1)},${y(cum).toFixed(1)} `;
  });
  root.appendChild(svg('path', { class: 'ft-climb__line', d }));
  if (next) {
    root.appendChild(svg('path', { class: 'ft-climb__next', d: `M${x(daily.length - 1).toFixed(1)},${y(cum).toFixed(1)} L${x(n - 1).toFixed(1)},${y(next.hours).toFixed(1)}` }));
    root.appendChild(svg('circle', { class: 'ft-climb__dot is-next', cx: x(n - 1).toFixed(1), cy: y(next.hours).toFixed(1), r: 5 }));
    root.appendChild(svg('text', { class: 'ft-climb__label', x: (x(n - 1) - 8).toFixed(1), y: (y(next.hours) - 10).toFixed(1), 'text-anchor': 'end', text: `${fmtNum(next.hours)} soon` }));
  }
  milestones.forEach((m, idx) => {
    const hit = byDate.get(m.date);
    if (!hit) return;
    root.appendChild(svg('line', { class: 'ft-climb__tick', x1: x(hit.i).toFixed(1), y1: y(m.hours).toFixed(1), x2: x(hit.i).toFixed(1), y2: height - pad }));
    root.appendChild(svg('circle', { class: 'ft-climb__dot', cx: x(hit.i).toFixed(1), cy: y(m.hours).toFixed(1), r: 5 }));
    const above = idx % 2 === 0 ? -10 : 20;
    root.appendChild(svg('text', { class: 'ft-climb__label', x: (x(hit.i) - 6).toFixed(1), y: (y(m.hours) + above).toFixed(1), 'text-anchor': 'end', text: fmtNum(m.hours) }));
  });
  return root;
}

/* ───────────────────────── split bar ───────────────────────── */

/** Two numbers as one bar. */
export function splitBar(left, right, { leftLabel, rightLabel, format = fmtNum } = {}) {
  const total = left + right || 1;
  const bar = el('div', { class: 'ft-split', role: 'img', 'aria-label': `${leftLabel} ${format(left)}, ${rightLabel} ${format(right)}` });
  const a = el('div', { class: 'ft-split__a', style: { '--w': `${(100 * left) / total}%` } }, [el('b', { text: format(left) }), el('span', { text: leftLabel })]);
  const b = el('div', { class: 'ft-split__b', style: { '--w': `${(100 * right) / total}%` } }, [el('b', { text: format(right) }), el('span', { text: rightLabel })]);
  bar.append(a, b);
  return bar;
}

/* ───────────────────────── every day ───────────────────────── */

/**
 * One month as a small wall calendar. Each day is a button; its glow is the hours.
 * @param {string} key '2026-04'
 * @param {{date:string, hours:number, calls:number, together?:boolean, fell_asleep?:boolean, sunrise?:boolean}[]} days
 */
export function monthCalendar(key, days, onPick) {
  const [yy, mm] = key.split('-').map(Number);
  const first = new Date(yy, mm - 1, 1);
  const block = el('section', { class: 'ft-month', 'aria-label': `${monthShort(key)} ${yy}` });
  const total = days.reduce((s, d) => s + d.hours, 0);
  block.appendChild(el('header', { class: 'ft-month__head' }, [
    el('h3', { class: 'ft-month__name', text: `${monthShort(key)} ${yy}` }),
    el('span', { class: 'ft-month__total', text: `${fmtNum(Math.round(total))} h` }),
  ]));
  const grid = el('div', { class: 'ft-month__grid', role: 'grid' });
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d) => grid.appendChild(el('span', { class: 'ft-month__wd', 'aria-hidden': 'true', text: d })));
  for (let i = 0; i < first.getDay(); i += 1) grid.appendChild(el('span', { class: 'ft-month__pad' }));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const lastDay = new Date(yy, mm, 0).getDate();
  for (let dnum = 1; dnum <= lastDay; dnum += 1) {
    const iso = `${yy}-${String(mm).padStart(2, '0')}-${String(dnum).padStart(2, '0')}`;
    const day = byDate.get(iso);
    if (!day) {
      grid.appendChild(el('span', { class: 'ft-day is-outside', text: dnum }));
      continue;
    }
    const level = day.together ? 'together' : day.hours <= 0 ? 'none' : day.hours < 4 ? 'l1' : day.hours < 10 ? 'l2' : day.hours < 16 ? 'l3' : 'l4';
    const btn = el('button', {
      type: 'button',
      class: `ft-day is-${level}`,
      'data-date': iso,
      'aria-label': `${monthShort(key)} ${dnum}: ${day.together ? 'together in person' : `${fmtNum(day.hours)} hours`}`,
      text: dnum,
    });
    if (day.fell_asleep) btn.appendChild(el('i', { class: 'ft-day__mark ft-day__mark--night', 'aria-hidden': 'true' }));
    if (day.sunrise) btn.appendChild(el('i', { class: 'ft-day__mark ft-day__mark--sun', 'aria-hidden': 'true' }));
    btn.addEventListener('click', () => onPick(day, btn, block));
    grid.appendChild(btn);
  }
  block.appendChild(grid);
  block.appendChild(el('p', { class: 'ft-month__detail', 'aria-live': 'polite' }));
  return block;
}

/** A tiny 24 bar sparkline of one day: minutes we were on, hour by hour. */
export function hourStrip(minutesByHour) {
  const root = svg('svg', { class: 'ft-hourstrip', viewBox: '0 0 96 20', 'aria-hidden': 'true', focusable: 'false' });
  (minutesByHour || []).forEach((m, h) => {
    const hgt = Math.max(1, (m / 60) * 18);
    root.appendChild(svg('rect', { x: h * 4, y: (20 - hgt).toFixed(1), width: 3, height: hgt.toFixed(1), class: m > 0 ? 'is-on' : '' }));
  });
  return root;
}

/** Small bars, one per weekday, hours a day. */
export function weekdayBars(perWeekday) {
  const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const max = Math.max(...order.map((d) => perWeekday[d]));
  const wrap = el('div', { class: 'ft-wdbars', role: 'img', 'aria-label': 'Hours a day for each weekday' });
  order.forEach((d) => {
    const v = perWeekday[d];
    wrap.appendChild(el('div', { class: `ft-wdbar${v === max ? ' is-top' : ''}` }, [
      el('b', { text: fmtNum(v) }),
      el('i', { style: { '--h': `${(v / max) * 100}%` } }),
      el('span', { text: d.slice(0, 3) }),
    ]));
  });
  return wrap;
}

/* ───────────────────────── every day, as dots ───────────────────────── */

/**
 * One row per month, one dot per day, brighter the longer we talked. Hollow is
 * a day with no call, a ring marks the day we made it official, and the days
 * we were together get their own colour.
 * @param {{date:string, hours:number, together?:boolean}[]} daily
 * @param {{ official: string, onPick: (day, dot) => void }} options
 */
export function dotGrid(daily, { official, onPick }) {
  const grid = el('div', { class: 'ft-dots', role: 'grid', 'aria-label': 'Every day since our first call' });
  const byMonth = new Map();
  daily.forEach((d) => {
    const key = d.date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, new Map());
    byMonth.get(key).set(Number(d.date.slice(8, 10)), d);
  });
  const dots = [];
  [...byMonth.keys()].sort().forEach((key) => {
    const [yy, mm] = key.split('-').map(Number);
    const row = el('div', { class: 'ft-dots__row', role: 'row' });
    row.appendChild(el('span', { class: 'ft-dots__label', role: 'rowheader', text: `${monthShort(key)} '${String(yy).slice(2)}` }));
    const days = byMonth.get(key);
    const lastDay = new Date(yy, mm, 0).getDate();
    for (let dnum = 1; dnum <= 31; dnum += 1) {
      const day = days.get(dnum);
      if (!day || dnum > lastDay) {
        row.appendChild(el('span', { class: 'ft-dot ft-dot--blank', role: 'gridcell', 'aria-hidden': 'true' }));
        continue;
      }
      const v = Math.min(1, day.hours / 24);
      const cls = ['ft-dot'];
      if (day.together) cls.push('is-together');
      else if (day.hours <= 0) cls.push('is-none');
      if (day.date === official) cls.push('is-official');
      const dot = el('button', {
        type: 'button',
        class: cls.join(' '),
        role: 'gridcell',
        tabindex: dots.length === 0 ? '0' : '-1',
        'data-date': day.date,
        'aria-label': `${monthShort(key)} ${dnum}: ${day.together ? 'together in person' : day.hours > 0 ? `${fmtNum(day.hours)} hours` : 'no call'}${day.date === official ? '. The day we made it official' : ''}`,
        style: { '--v': v.toFixed(2) },
      });
      dot.addEventListener('click', () => onPick(day, dot));
      dot.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') onPick(day, dot, { hover: true }); });
      dot.addEventListener('focus', () => onPick(day, dot, { hover: true }));
      dots.push({ dot, day, col: dnum, rowIndex: byMonth.size });
      row.appendChild(dot);
    }
    grid.appendChild(row);
  });
  // arrow keys move between dots so the grid is one tab stop
  grid.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const cur = e.target.closest('.ft-dot');
    if (!cur) return;
    e.preventDefault();
    const rows = [...grid.querySelectorAll('.ft-dots__row')];
    const r = rows.findIndex((row) => row.contains(cur));
    const cells = [...rows[r].querySelectorAll('.ft-dot')];
    const c = cells.indexOf(cur);
    let next = null;
    if (e.key === 'ArrowRight') next = cells.slice(c + 1).find((x) => x.tagName === 'BUTTON');
    if (e.key === 'ArrowLeft') next = cells.slice(0, c).reverse().find((x) => x.tagName === 'BUTTON');
    if (e.key === 'ArrowDown' && rows[r + 1]) next = [...rows[r + 1].querySelectorAll('.ft-dot')][c];
    if (e.key === 'ArrowUp' && rows[r - 1]) next = [...rows[r - 1].querySelectorAll('.ft-dot')][c];
    if (next && next.tagName === 'BUTTON') {
      cur.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    }
  });
  return grid;
}
