import './styles/base.css';
import './styles/sections.css';
import './styles/animations.css';
import './styles/ui.css';
import './styles/foryou.css';

import { initSiteChrome } from './modules/siteChrome.js';
import { initReveal } from './modules/reveal.js';

/**
 * The tools behind the For You hub. When a feature lands, flip `comingSoon`
 * to false — that is the whole change. `hint` is an optional calm line of
 * state ("3 in progress"); never a counter that implies backlog, and never
 * anything from Rhythm.
 */
const TOOLS = [
  { id: 'letters',      emoji: '\u{1F48C}', name: 'Letters',              purpose: "Everything I've written you.",         href: './letters.html',      comingSoon: true },
  { id: 'applications', emoji: '\u{1F4BC}', name: 'The Application Desk', purpose: 'One application at a time.',           href: './applications.html', comingSoon: true },
  { id: 'people',       emoji: '\u{1FAF6}', name: 'People',               purpose: 'Who you might want to say hi to.',     href: './people.html',       comingSoon: true },
  { id: 'rhythm',       emoji: '\u{1F337}', name: 'Rhythm',               purpose: 'Your month, kept quietly.',            href: './rhythm.html',       comingSoon: true },
  { id: 'outfit',       emoji: '\u{1F457}', name: 'What to Wear',         purpose: 'For the mornings the wardrobe says nothing.', href: './outfit.html', comingSoon: true },
];

function renderCard(tool, index) {
  // Live tools are one whole-card link. Coming-soon ones are plain cards with
  // no link affordance, so nothing on the page promises what it can't do yet.
  const card = document.createElement(tool.comingSoon ? 'div' : 'a');
  card.className = 'usm-card foryou-card reveal' + (tool.comingSoon ? ' is-coming-soon' : ' usm-card--link');
  card.setAttribute('data-delay', String((index % 4) + 1));
  if (tool.comingSoon) {
    card.setAttribute('data-coming-soon', '');
  } else {
    card.href = tool.href;
  }

  const emoji = document.createElement('span');
  emoji.className = 'foryou-card__emoji';
  emoji.setAttribute('aria-hidden', 'true');
  emoji.textContent = tool.emoji;

  const name = document.createElement('h2');
  name.className = 'foryou-card__name';
  name.textContent = tool.name;

  const purpose = document.createElement('p');
  purpose.className = 'foryou-card__purpose';
  purpose.textContent = tool.purpose;

  card.append(emoji, name, purpose);

  if (tool.comingSoon) {
    const soon = document.createElement('span');
    soon.className = 'foryou-card__meta';
    soon.textContent = 'Coming soon';
    card.appendChild(soon);
  } else if (tool.hint) {
    const hint = document.createElement('span');
    hint.className = 'foryou-card__meta';
    hint.textContent = tool.hint;
    card.appendChild(hint);
  }

  return card;
}

document.addEventListener('DOMContentLoaded', () => {
  initSiteChrome({ active: 'foryou' });

  const grid = document.getElementById('foryouGrid');
  if (grid) {
    TOOLS.forEach((tool, i) => grid.appendChild(renderCard(tool, i)));
  }

  requestAnimationFrame(() => setTimeout(() => initReveal(), 50));
});
