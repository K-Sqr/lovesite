import './styles/base.css';
import './styles/sections.css';
import './styles/animations.css';
import './styles/ui.css';
import './styles/people-dashboard.css';

import { initSiteChrome } from './modules/siteChrome.js';
import { initReveal } from './modules/reveal.js';
import { formatLongDate, formatRelativeGentle } from './modules/dates.js';
import { getCheckInSummary, subscribe } from './modules/peopleStore.js';

const REWARDS = [
  { title: 'DoorDash night', note: 'Your pick, my treat.' },
  { title: 'Uninterrupted boyfriend time', note: 'Phone down, just us.' },
  { title: 'Movie night and food', note: 'You choose the film; I handle the rest.' },
  { title: 'Something new to wear', note: 'A little treat for your wardrobe.' },
  { title: 'A slow self-care hour', note: 'Zero questions, full recharge.' },
];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child) node.appendChild(child);
  return node;
}

function plural(count, singular, pluralWord = `${singular}s`) {
  return count === 1 ? singular : pluralWord;
}

function metric(label, value, note) {
  return el('article', { class: 'usm-card people-dashboard-metric reveal' }, [
    el('p', { class: 'people-dashboard-metric__label', text: label }),
    el('p', { class: 'people-dashboard-metric__value', text: value }),
    el('p', { class: 'people-dashboard-metric__note', text: note }),
  ]);
}

function renderMetrics(summary) {
  const mount = document.getElementById('dashboardMetrics');
  if (!summary.total) {
    mount.replaceChildren(el('div', { class: 'usm-empty people-dashboard-empty' }, [
      el('p', { class: 'people-dashboard-empty__title', text: 'Your first hello will show up here.' }),
      el('p', { text: 'Counting starts the next time you tap “Said hi” on the People page.' }),
      el('a', { class: 'usm-btn usm-btn--primary', href: './people.html', text: 'Choose someone' }),
    ]));
    return;
  }

  mount.replaceChildren(
    el('p', {
      class: 'people-dashboard-intro',
      text: `${summary.total} ${plural(summary.total, 'hello')} since ${formatLongDate(summary.startedAt)}.`,
    }),
    el('div', { class: 'people-dashboard-metrics' }, [
      metric('This week', String(summary.thisWeek), `${plural(summary.thisWeek, 'hello')} shared`),
      metric('This month', String(summary.thisMonth), `${plural(summary.thisMonth, 'hello')} shared`),
      metric('People this month', String(summary.uniqueThisMonth), 'different people'),
      metric('Days this month', String(summary.activeDaysThisMonth), `${plural(summary.activeDaysThisMonth, 'day')} you showed up`),
    ]),
  );
}

function renderPeople(summary) {
  const mount = document.getElementById('dashboardPeople');
  if (!summary.perPerson.length) {
    mount.replaceChildren();
    return;
  }
  const max = Math.max(...summary.perPerson.map((entry) => entry.count), 1);
  const list = el('ul', { class: 'people-dashboard-person-list' });
  summary.perPerson.forEach((entry) => {
    list.appendChild(el('li', { class: 'people-dashboard-person usm-well' }, [
      el('div', { class: 'people-dashboard-person__top' }, [
        el('span', { class: 'people-dashboard-person__name', text: entry.name }),
        el('span', {
          class: 'people-dashboard-person__count',
          text: `${entry.count} ${plural(entry.count, 'hello')}`,
        }),
      ]),
      el('div', { class: 'people-dashboard-person__track', 'aria-hidden': 'true' }, [
        el('span', { style: `width:${Math.max(8, Math.round((entry.count / max) * 100))}%` }),
      ]),
      el('p', {
        class: 'people-dashboard-person__meta',
        text: entry.lastCheckIn ? `Last hello ${formatRelativeGentle(entry.lastCheckIn)}` : '',
      }),
    ]));
  });
  mount.replaceChildren(
    el('h2', { class: 'people-dashboard-title', text: 'Your circle' }),
    el('p', { class: 'people-dashboard-hint', text: 'Only hellos logged from now on are counted.' }),
    list,
  );
}

function renderRecent(summary) {
  const mount = document.getElementById('dashboardRecent');
  if (!summary.recent.length) {
    mount.replaceChildren();
    return;
  }
  const list = el('ul', { class: 'people-dashboard-recent-list' });
  summary.recent.forEach((event) => {
    list.appendChild(el('li', {}, [
      el('span', { text: event.name }),
      el('span', { text: formatLongDate(event.date) }),
    ]));
  });
  mount.replaceChildren(el('details', { class: 'people-dashboard-recent' }, [
    el('summary', { text: 'Recent hellos' }),
    list,
  ]));
}

function renderRewards() {
  const mount = document.getElementById('dashboardRewards');
  const cards = REWARDS.map((reward) => el('article', {
    class: 'usm-card people-reward-card',
    'aria-disabled': 'true',
  }, [
    el('span', { class: 'usm-tone usm-tone--quiet', text: 'Coming soon' }),
    el('h3', { text: reward.title }),
    el('p', { text: reward.note }),
  ]));
  mount.replaceChildren(
    el('div', { class: 'people-dashboard-section-head' }, [
      el('div', {}, [
        el('h2', { class: 'people-dashboard-title', text: 'Little treats' }),
        el('p', { class: 'people-dashboard-hint', text: 'Ideas for later — nothing to earn or unlock yet.' }),
      ]),
      el('span', { class: 'usm-tone usm-tone--quiet', text: 'Coming soon' }),
    ]),
    el('div', { class: 'people-rewards-grid' }, cards),
  );
}

function renderDashboard() {
  const summary = getCheckInSummary(new Date());
  renderMetrics(summary);
  renderPeople(summary);
  renderRecent(summary);
  requestAnimationFrame(() => initReveal());
}

document.addEventListener('DOMContentLoaded', () => {
  initSiteChrome({ active: 'foryou' });
  renderRewards();
  renderDashboard();
  subscribe(renderDashboard);
});
