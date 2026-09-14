/**
 * celebrate.js — the one-year burst (05-TIMELINE.md R7b). Shared with 12; do not fork.
 *
 * Same pattern as graffiti.js: absolutely-positioned DOM spans appended to a
 * container, driven by CSS keyframes (transform + opacity only, so the
 * compositor does the work), removed on a timer. No library.
 *
 *   celebrate(anchor)       fire now; idempotent while one is running
 *   celebrateOnce(anchor)   fire at most once per page load AND per session
 *
 * Hard rules honoured here:
 *   - the container is absolute inside the entry, `pointer-events: none`,
 *     never full-screen, never a layout shift
 *   - reduced motion ⇒ nothing is created; the static card treatment is the celebration
 *   - full teardown at `duration`, on tab hide, and on pagehide
 *   - colours come from tokens via getComputedStyle (themes correctly), plus
 *     one warm gold that only the anniversary uses
 *
 * The keyframes and particle classes live in timeline-page.css
 * (.celebrate, .celebrate__streak, .celebrate__spark, .celebrate__confetti).
 */

const SESSION_KEY = 'usm.celebrate.one-year';

/** The 13th, and the day after — she said yes on the 13th. */
export function isAnniversaryDay(now = new Date()) {
  const day = now.getDate();
  return day === 13 || day === 14;
}

let running = false;
let firedThisLoad = false;

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isSmallScreen() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 600px)').matches;
}

function sessionGet(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function sessionSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* private mode, quota — a re-fire is not fatal */ }
}

const rand = (min, max) => min + Math.random() * (max - min);

/** Token colours read from the anchor so page-scoped tokens (the gold) resolve too. */
function palette(anchor) {
  const cs = getComputedStyle(anchor);
  const read = (name) => cs.getPropertyValue(name).trim();
  const pinks = ['--pink-deep', '--pink-hot', '--pink-light', '--tone-warm', '--tone-calm']
    .map(read)
    .filter(Boolean);
  const gold = read('--gold-anniversary');
  return { pinks: pinks.length ? pinks : ['currentColor'], gold: gold || pinks[0] || 'currentColor' };
}

/** Card bursts sit in a taller box than the card; page bursts use the viewport. */
function containerHeight(anchor, fullPage) {
  if (fullPage) return window.innerHeight || 600;
  return (anchor.getBoundingClientRect().height || 200) * 1.9;
}

function particle(className, left, top, vars) {
  const span = document.createElement('span');
  span.className = className;
  span.style.left = `${left.toFixed(1)}%`;
  span.style.top = `${top.toFixed(1)}%`;
  for (const [k, v] of Object.entries(vars)) span.style.setProperty(k, v);
  return span;
}

/**
 * Fires once. Idempotent — a second call while running is a no-op.
 * @param {HTMLElement} anchor  the element to centre the burst on
 * @returns {() => void}        teardown, safe to call at any time
 */
export function celebrate(anchor, { particles = 90, duration = 3200, fullPage = false } = {}) {
  if (running || !anchor || prefersReducedMotion()) return () => {};
  running = true;

  // Budget: desktop 90 → phones 45 → low-core phones 22.
  let budget = particles;
  if (isSmallScreen()) budget = Math.floor(budget / 2);
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) budget = Math.floor(budget / 2);
  budget = Math.max(budget, 8);

  const bursts = Math.min(4, Math.max(2, Math.round(budget / 22)));
  const sparksPerBurst = Math.max(4, Math.round((budget * 0.45) / bursts));
  const confettiCount = Math.max(0, budget - bursts - bursts * sparksPerBurst);

  const { pinks, gold } = palette(anchor);
  const colours = [...pinks, gold, gold]; // gold weighted in, but still a minority
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const container = document.createElement('div');
  container.className = fullPage ? 'celebrate celebrate--page' : 'celebrate';
  container.setAttribute('aria-hidden', 'true');

  const frag = document.createDocumentFragment();
  const boxHeight = containerHeight(anchor, fullPage);

  // ── Fireworks: a few streaks rising, each bursting into radial sparks, staggered over ~800ms.
  for (let b = 0; b < bursts; b += 1) {
    const delay = Math.round((b / bursts) * 800 + rand(0, 120));
    const rise = Math.round(rand(90, 150));           // px the streak climbs
    const x = rand(18, 82);                           // % across the container
    const launchY = rand(78, 92);                     // % down — starts low, near the card's base
    const streakMs = 520;
    const burstY = launchY - (rise / boxHeight) * 100; // where the sparks appear

    frag.appendChild(particle('celebrate__streak', x, launchY, {
      '--celebrate-colour': b % 2 === 0 ? gold : pick(pinks),
      '--celebrate-rise': `${-rise}px`,
      '--celebrate-delay': `${delay}ms`,
      '--celebrate-duration': `${streakMs}ms`,
    }));

    for (let s = 0; s < sparksPerBurst; s += 1) {
      const angle = (s / sparksPerBurst) * Math.PI * 2 + rand(-0.2, 0.2);
      const radius = rand(34, 70);
      frag.appendChild(particle('celebrate__spark', x, burstY, {
        '--celebrate-colour': s % 3 === 0 ? gold : pick(pinks),
        '--celebrate-dx': `${(Math.cos(angle) * radius).toFixed(1)}px`,
        '--celebrate-dy': `${(Math.sin(angle) * radius + 14).toFixed(1)}px`, // a touch of gravity
        '--celebrate-delay': `${delay + streakMs - 40}ms`,
        '--celebrate-duration': `${Math.round(rand(900, 1300))}ms`,
      }));
    }
  }

  // ── Confetti: small rectangles tumbling down, uneven on purpose.
  for (let c = 0; c < confettiCount; c += 1) {
    const dur = Math.round(rand(1600, 2400));
    const delay = Math.round(rand(0, 700));
    const fall = fullPage ? rand(280, 640) : rand(180, 320);
    frag.appendChild(particle('celebrate__confetti', rand(4, 96), rand(-6, 22), {
      '--celebrate-colour': pick(colours),
      '--celebrate-dx': `${rand(-60, 60).toFixed(1)}px`,
      '--celebrate-dy': `${fall.toFixed(1)}px`,
      '--celebrate-rot': `${Math.round(rand(-540, 540))}deg`,
      '--celebrate-delay': `${delay}ms`,
      '--celebrate-duration': `${Math.min(dur, duration - delay - 50)}ms`,
    }));
  }

  container.appendChild(frag);
  (fullPage ? document.body : anchor).appendChild(container);

  let timer = null;
  let done = false;

  function teardown() {
    if (done) return;
    done = true;
    running = false;
    if (timer) clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', teardown);
    if (container.parentNode) container.parentNode.removeChild(container);
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') teardown();
  }

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', teardown);
  timer = setTimeout(teardown, duration);

  return teardown;
}

/**
 * Fire at most once per page load and once per browser session, so scrolling
 * away and back never re-triggers it. Replay is only via celebrate() directly.
 */
export function celebrateOnce(anchor, options = {}) {
  const key = options.key || SESSION_KEY;
  if (key === SESSION_KEY) {
    if (firedThisLoad || sessionGet(key) === '1') return;
    firedThisLoad = true;
  } else if (sessionGet(key) === '1') {
    return;
  }
  if (prefersReducedMotion()) return;
  sessionSet(key, '1');
  celebrate(anchor, options);
}

const PAGE_SHOW_MS = 60 * 1000;
/** One batch, then a beat of quiet, then the next. */
const PAGE_WAVE_MS = 3800;

let pageTeardown = null;

/**
 * Full-viewport show: slower batches for one minute, with a pause between them.
 * Calling again while it is running restarts the show.
 */
export function celebratePage(options = {}) {
  if (prefersReducedMotion()) return () => {};
  if (pageTeardown) pageTeardown();

  const duration = options.duration ?? PAGE_SHOW_MS;
  running = true;

  const overlay = document.createElement('div');
  overlay.className = 'celebrate celebrate--page';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.appendChild(overlay);

  const { pinks, gold } = palette(document.body);
  const colours = [...pinks, gold, gold, gold];
  const pick = (arr) => arr[arr.length ? Math.floor(Math.random() * arr.length) : 0];

  let budget = options.particles ?? 140;
  if (isSmallScreen()) budget = Math.floor(budget * 0.55);
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
    budget = Math.floor(budget * 0.65);
  }
  budget = Math.max(budget, 40);

  const boxHeight = window.innerHeight || 600;
  let waveTimer = null;
  let endTimer = null;
  let done = false;

  function fireWave() {
    const bursts = isSmallScreen() ? 5 : 8;
    const sparksPerBurst = isSmallScreen() ? 12 : 18;
    const confettiCount = Math.round(budget * 0.35);
    const frag = document.createDocumentFragment();

    for (let b = 0; b < bursts; b += 1) {
      const delay = Math.round((b / bursts) * 700 + rand(0, 160));
      const rise = Math.round(rand(220, 420));
      const x = rand(8, 92);
      const launchY = rand(72, 96);
      const streakMs = Math.round(rand(780, 1100));
      const burstY = launchY - (rise / boxHeight) * 100;

      frag.appendChild(particle('celebrate__streak', x, launchY, {
        '--celebrate-colour': b % 2 === 0 ? gold : pick(pinks),
        '--celebrate-rise': `${-rise}px`,
        '--celebrate-delay': `${delay}ms`,
        '--celebrate-duration': `${streakMs}ms`,
      }));

      for (let s = 0; s < sparksPerBurst; s += 1) {
        const angle = (s / sparksPerBurst) * Math.PI * 2 + rand(-0.25, 0.25);
        const radius = rand(70, 170);
        frag.appendChild(particle('celebrate__spark', x, burstY, {
          '--celebrate-colour': s % 3 === 0 ? gold : pick(colours),
          '--celebrate-dx': `${(Math.cos(angle) * radius).toFixed(1)}px`,
          '--celebrate-dy': `${(Math.sin(angle) * radius + 28).toFixed(1)}px`,
          '--celebrate-delay': `${delay + streakMs - 40}ms`,
          '--celebrate-duration': `${Math.round(rand(2000, 2800))}ms`,
        }));
      }
    }

    for (let c = 0; c < confettiCount; c += 1) {
      frag.appendChild(particle('celebrate__confetti', rand(0, 100), rand(-8, 18), {
        '--celebrate-colour': pick(colours),
        '--celebrate-dx': `${rand(-90, 90).toFixed(1)}px`,
        '--celebrate-dy': `${rand(360, 780).toFixed(1)}px`,
        '--celebrate-rot': `${Math.round(rand(-720, 720))}deg`,
        '--celebrate-delay': `${Math.round(rand(0, 600))}ms`,
        '--celebrate-duration': `${Math.round(rand(2800, 4000))}ms`,
      }));
    }

    overlay.appendChild(frag);
    while (overlay.childElementCount > 280) overlay.removeChild(overlay.firstChild);
  }

  function teardown() {
    if (done) return;
    done = true;
    running = false;
    pageTeardown = null;
    if (waveTimer) clearInterval(waveTimer);
    if (endTimer) clearTimeout(endTimer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', teardown);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') teardown();
  }

  fireWave();
  waveTimer = setInterval(fireWave, PAGE_WAVE_MS);
  endTimer = setTimeout(teardown, duration);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', teardown);
  pageTeardown = teardown;
  return teardown;
}

