import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from './firebase.js';

export async function fetchMemories(maxItems = 50) {
  try {
    const q = query(
      collection(db, 'memories'),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Failed to fetch memories:', err);
    return [];
  }
}

export function renderMemoryCard(memory) {
  const card = document.createElement('div');
  card.className = 'gallery-card reveal';
  card.dataset.id = memory.id;
  card.innerHTML = `
    <img src="${memory.url}" alt="${memory.caption || 'Memory'}" loading="lazy" />
    ${memory.caption ? `<div class="caption">${memory.caption}</div>` : ''}
  `;
  return card;
}

export function setupLightbox(container) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');
  if (!lightbox || !lightboxClose) return;

  function closeLightbox() {
    lightbox.classList.remove('active');
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  container.addEventListener('click', (e) => {
    const card = e.target.closest('.gallery-card:not(.placeholder)');
    if (!card) return;
    const img = card.querySelector('img');
    if (!img) return;
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || '';
    lightboxCaption.textContent = card.querySelector('.caption')?.textContent || '';
    lightbox.classList.add('active');
  });
}
