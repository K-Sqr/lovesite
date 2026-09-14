/**
 * timeline.js — renders src/data/timeline.js in two variants.
 *
 *   initTimeline({ variant: 'preview' })                        home page, capped featured slice
 *   initTimeline({ variant: 'full', mount: '#fullTimeline' })   timeline page, everything
 *
 * DOM is built with createElement + textContent (no string interpolation), following
 * renderMemoryCard() in memoriesGallery.js. Every entry keeps the contract
 * sections.css / timeline-page.css depend on:
 *
 *   <div class="timeline-entry reveal" data-delay="1..4" id="…">
 *     <div class="timeline-icon">…</div>
 *     <div class="timeline-date">…</div>
 *     <h3>…</h3>
 *     <p>…</p>
 *   </div>
 *
 * Full-page-only additions live INSIDE the entry after <p>, with additive
 * classnames, so the home preview renders exactly as it always has.
 */

import { getHomeMoments, groupByYear, displayDate } from '../data/timeline.js';

/** The one entry that gets the celebration treatment (05-TIMELINE.md R7b). */
export const ONE_YEAR_ID = 'one-year';

/** Same allow-list renderMemoryCard() uses: https:// or a relative ./ path. */
function safeSrc(src) {
  return (typeof src === 'string' && /^(https:\/\/|\.?\/)/.test(src)) ? src : '';
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderDisclosure(entry) {
  const bodyId = `${entry.id}-body`;
  const btn = el('button', 'timeline-more', 'Read more');
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', bodyId);

  const body = el('div', 'timeline-body', entry.expandedBody);
  body.id = bodyId;
  body.hidden = true;

  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    btn.textContent = open ? 'Read more' : 'Less';
    body.hidden = open;
  });

  return [btn, body];
}

function renderPhotos(entry) {
  const row = el('div', 'timeline-photos');
  for (const photo of entry.photos) {
    const src = safeSrc(photo.src);
    if (!src) continue;
    const card = el('button', 'timeline-photo');
    card.type = 'button';
    card.setAttribute('aria-label', `Open photo: ${photo.alt}`);

    const img = document.createElement('img');
    img.src = src;
    img.alt = photo.alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 88;
    img.height = 88;
    card.appendChild(img);

    // .caption is what setupLightbox() reads for the lightbox label.
    const caption = el('span', 'caption sr-only', photo.caption || photo.alt || '');
    card.appendChild(caption);

    row.appendChild(card);
  }
  return row;
}

function renderEntry(entry, { variant, delay, side }) {
  const node = el('div', 'timeline-entry reveal');
  node.setAttribute('data-delay', String(delay));
  node.id = entry.id;

  if (variant === 'full') {
    node.classList.add(side === 'left' ? 'timeline-entry--left' : 'timeline-entry--right');
    if (entry.type) node.classList.add(`timeline-entry--${entry.type}`);
    if (entry.id === ONE_YEAR_ID) node.classList.add('timeline-entry--anniversary-year');
  }

  node.appendChild(el('div', 'timeline-icon', entry.icon));

  const date = el('div', 'timeline-date', displayDate(entry));
  if (variant === 'full' && entry.location) {
    date.appendChild(el('span', 'timeline-location', ` · ${entry.location}`));
  }
  node.appendChild(date);

  if (variant === 'full' && entry.id === ONE_YEAR_ID) {
    node.appendChild(el('div', 'timeline-eyebrow', 'One year.'));
  }

  node.appendChild(el('h3', null, entry.title));
  node.appendChild(el('p', null, entry.description));

  if (variant === 'full') {
    if (entry.expandedBody) renderDisclosure(entry).forEach((c) => node.appendChild(c));
    if (Array.isArray(entry.photos) && entry.photos.length) node.appendChild(renderPhotos(entry));
  }

  return node;
}

function renderPreview(container) {
  const items = getHomeMoments();

  items.forEach((entry, i) => {
    container.appendChild(renderEntry(entry, { variant: 'preview', delay: (i % 4) + 1 }));
  });

  const link = document.createElement('a');
  link.href = './timeline.html';
  link.className = 'view-all-link reveal';
  link.setAttribute('data-delay', '2');
  link.textContent = 'View full timeline →';
  container.parentElement.appendChild(link);
}

function renderFull(container) {
  const frag = document.createDocumentFragment();
  let globalIndex = 0;

  for (const group of groupByYear()) {
    const heading = el('h2', 'timeline-year', String(group.year));
    heading.id = `year-${group.year}`;
    frag.appendChild(heading);

    group.entries.forEach((entry, indexWithinYear) => {
      frag.appendChild(renderEntry(entry, {
        variant: 'full',
        // Reset the stagger per chapter and cap it, so each year cascades once.
        delay: Math.min(indexWithinYear, 3) + 1,
        // Alternate from the GLOBAL index so sides keep alternating across year boundaries.
        side: globalIndex % 2 === 0 ? 'left' : 'right',
      }));
      globalIndex += 1;
    });
  }

  container.appendChild(frag);
}

/**
 * @param {{ variant?: 'preview' | 'full', mount?: string }} [options]
 */
export function initTimeline({ variant = 'preview', mount = '.timeline' } = {}) {
  const container = document.querySelector(mount);
  if (!container) return;

  if (variant === 'full') renderFull(container);
  else renderPreview(container);
}
