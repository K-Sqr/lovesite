import { fetchMemories, renderMemoryCard, setupLightbox } from './memoriesGallery.js';

const PREVIEW_COUNT = 6;

const LOCAL_PHOTOS = [
  { url: './photos/IMG_5697.JPG', caption: '' },
  { url: './photos/IMG_9651.jpg', caption: '' },
  { url: './photos/IMG_9742.jpg', caption: '' },
  { url: './photos/WhatsApp Image 2026-03-18 at 8.35.33 PM.jpeg', caption: '' },
  { url: './photos/WhatsApp Image 2026-03-18 at 8.36.15 PM.jpeg', caption: '' },
  { url: './photos/WhatsApp Image 2026-03-18 at 8.36.44 PM.jpeg', caption: '' },
];

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
    const photo = LOCAL_PHOTOS[i % LOCAL_PHOTOS.length];
    const card = renderLocalCard(photo);
    card.classList.add('reveal');
    card.setAttribute('data-delay', String(((memories.length + i) % 4) + 1));
    grid.appendChild(card);
  }

  addViewAllLink(grid);
}

function renderLocalCard(photo) {
  const card = document.createElement('div');
  card.className = 'gallery-card';

  const img = document.createElement('img');
  img.src = photo.url;
  img.alt = photo.caption || 'Memory';
  img.loading = 'lazy';
  card.appendChild(img);

  if (photo.caption) {
    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = photo.caption;
    card.appendChild(caption);
  }

  return card;
}

function addViewAllLink(grid) {
  const link = document.createElement('a');
  link.href = './memories.html';
  link.className = 'view-all-link reveal';
  link.setAttribute('data-delay', '2');
  link.textContent = 'View all memories \u2192';
  grid.parentElement.appendChild(link);
}
