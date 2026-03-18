const placeholderCount = 6;

export function initGallery() {
  const grid = document.querySelector('.gallery-grid');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');
  if (!grid) return;

  for (let i = 0; i < placeholderCount; i++) {
    const card = document.createElement('div');
    card.className = 'gallery-card placeholder reveal';
    card.setAttribute('data-delay', String((i % 4) + 1));
    grid.appendChild(card);
  }

  if (lightbox && lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.gallery-card:not(.placeholder)');
    if (!card || !lightbox) return;
    const img = card.querySelector('img');
    if (!img) return;
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || '';
    lightboxCaption.textContent = card.querySelector('.caption')?.textContent || '';
    lightbox.classList.add('active');
  });
}
