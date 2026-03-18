import { fetchMemories, renderMemoryCard, setupLightbox } from './memoriesGallery.js';

const PREVIEW_COUNT = 6;

export function initGallery() {
  const grid = document.querySelector('.gallery-grid');
  if (!grid) return;

  setupLightbox(grid);
  loadPreview(grid);
}

async function loadPreview(grid) {
  const memories = await fetchMemories(PREVIEW_COUNT);

  grid.innerHTML = '';

  if (memories.length > 0) {
    memories.forEach((m, i) => {
      const card = renderMemoryCard(m);
      card.classList.add('reveal');
      card.setAttribute('data-delay', String((i % 4) + 1));
      grid.appendChild(card);
    });
  }

  const remaining = PREVIEW_COUNT - memories.length;
  for (let i = 0; i < remaining; i++) {
    const card = document.createElement('div');
    card.className = 'gallery-card placeholder reveal';
    card.setAttribute('data-delay', String(((memories.length + i) % 4) + 1));
    grid.appendChild(card);
  }

  addViewAllLink(grid);
}

function addViewAllLink(grid) {
  const link = document.createElement('a');
  link.href = './memories.html';
  link.className = 'view-all-link reveal';
  link.setAttribute('data-delay', '2');
  link.textContent = 'View all memories \u2192';
  grid.parentElement.appendChild(link);
}
