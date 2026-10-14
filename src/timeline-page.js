import './styles/base.css';
import './styles/sections.css';
import './styles/animations.css';
import './styles/memories.css';
import './styles/timeline-page.css';

import { initTimeline, ONE_YEAR_ID } from './modules/timeline.js';
import { timeline, photoCount } from './data/timeline.js';
import { letterCount } from './data/letters.js';
import { daysBetween, calendarDuration } from './modules/dates.js';
import { initLoveCounter } from './modules/loveCounter.js';
import { initSiteChrome } from './modules/siteChrome.js';
import { initReveal } from './modules/reveal.js';
import { setupLightbox } from './modules/memoriesGallery.js';
import { celebrate, celebrateOnce, celebratePage, isAnniversaryDay } from './modules/celebrate.js';
import { initMonthsary } from './modules/monthsary.js';

const START_DATE = '2025-09-13';

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function statCard(number, label, delay) {
  const card = document.createElement('div');
  card.className = 'stat-card reveal';
  card.setAttribute('data-delay', String(delay));

  const num = document.createElement('div');
  num.className = 'stat-number';
  num.textContent = String(number);

  const lbl = document.createElement('div');
  lbl.className = 'stat-label';
  lbl.textContent = label;

  card.append(num, lbl);
  return card;
}

/** '1 yr 0 mo' once a year has passed; '11 mo' before that. */
function formatDuration({ years, months }) {
  return years > 0 ? `${years} yr ${months} mo` : `${months} mo`;
}

/** Four cards, every number verifiable by hand from the data (R8). */
function renderStats() {
  const statsContainer = document.getElementById('timelineStats');
  if (!statsContainer) return;

  const today = new Date();
  const cards = [
    statCard(daysBetween(START_DATE, today), 'days together', 1),
    statCard(formatDuration(calendarDuration(START_DATE, today)), 'together', 2),
    statCard(timeline.length, timeline.length === 1 ? 'moment recorded' : 'moments recorded', 3),
  ];

  const photos = photoCount();
  const letters = letterCount();
  if (letters > 0 && photos === 0) {
    cards.push(statCard(letters, letters === 1 ? 'letter' : 'letters', 4));
  } else {
    cards.push(statCard(photos, photos === 1 ? 'photo' : 'photos', 4));
  }

  statsContainer.replaceChildren(...cards);
}

/**
 * The one scroll-linked effect on the page (R7): a rail that fills as you
 * scroll. The same passive, rAF-throttled handler also watches for the
 * one-year entry coming into view so the page never needs a second listener
 * or a second observer.
 */
function initScrollEffects(rail) {
  const progress = document.createElement('div');
  progress.className = 'timeline-progress';
  progress.setAttribute('aria-hidden', 'true');
  rail.prepend(progress);

  const oneYear = document.getElementById(ONE_YEAR_ID);
  let ticking = false;

  function update() {
    ticking = false;
    const viewportH = window.innerHeight;
    const railRect = rail.getBoundingClientRect();

    // Fill to the point of the rail that sits at the viewport's vertical centre.
    const centre = viewportH * 0.5;
    const ratio = railRect.height > 0 ? (centre - railRect.top) / railRect.height : 0;
    const clamped = Math.min(1, Math.max(0, ratio));
    progress.style.transform = `translateX(-50%) scaleY(${clamped.toFixed(4)})`;

    document.querySelectorAll('.timeline-entry--anniversary').forEach((card) => {
      const r = card.getBoundingClientRect();
      const visible = Math.min(r.bottom, viewportH) - Math.max(r.top, 0);
      if (visible >= Math.min(r.height, viewportH) * 0.55) {
        celebrateOnce(card, { key: `usm.celebrate.entry.${card.id}`, particles: 70, duration: 2800 });
      }
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  return update;
}

function initReplayControl() {
  const oneYear = document.getElementById(ONE_YEAR_ID);
  if (!oneYear) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'timeline-replay';
  btn.setAttribute('aria-label', 'Play the celebration again');
  btn.textContent = '\u{1F389}';
  btn.addEventListener('click', () => celebratePage());
  oneYear.appendChild(btn);
}

document.addEventListener('DOMContentLoaded', () => {
  initSiteChrome({ active: 'story' });
  initMonthsary({ start: START_DATE, before: '#timelineStats' });
  renderStats();
  initTimeline({ variant: 'full', mount: '#fullTimeline' });
  initLoveCounter();

  const rail = document.getElementById('fullTimeline');
  if (rail) setupLightbox(rail, { selector: '.timeline-photo' });

  // Rail fill, replay control and the particle burst all need motion; the
  // static one-year card treatment is always present and stands on its own.
  let updateScroll = null;
  if (rail && !prefersReducedMotion()) {
    initReplayControl();
    updateScroll = initScrollEffects(rail);
  }

  requestAnimationFrame(() => setTimeout(() => {
    initReveal();
    if (updateScroll) updateScroll();
    if (isAnniversaryDay() && !prefersReducedMotion()) {
      celebratePage();
    }
  }, 50));
});
