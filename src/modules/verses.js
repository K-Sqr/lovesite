import { verses } from '../data/verses.js';

let currentIndex = 0;
let carouselEl;
let cardEl;

export function initVerseCarousel() {
  carouselEl = document.querySelector('.verse-carousel');
  if (!carouselEl) return;

  cardEl = carouselEl.querySelector('.verse-card');
  renderVerse(0);

  const prevBtn = document.getElementById('versePrev');
  const nextBtn = document.getElementById('verseNext');

  if (prevBtn) prevBtn.addEventListener('click', () => navigate(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigate(1));
}

function renderVerse(index) {
  if (!cardEl) return;
  currentIndex = ((index % verses.length) + verses.length) % verses.length;
  const v = verses[currentIndex];
  cardEl.innerHTML = `\u201C${v.text}\u201D<span class="verse-ref">\u2014 ${v.ref}</span>`;
}

function navigate(dir) {
  if (!cardEl) return;
  cardEl.style.opacity = '0';
  cardEl.style.transform = `translateX(${dir * -20}px)`;
  setTimeout(() => {
    renderVerse(currentIndex + dir);
    cardEl.style.transform = `translateX(${dir * 20}px)`;
    requestAnimationFrame(() => {
      cardEl.style.opacity = '1';
      cardEl.style.transform = 'translateX(0)';
    });
  }, 300);
}

export function showFloatingVerses() {
  const verseContainer = document.getElementById('verse-container');
  if (!verseContainer) return;

  let i = 0;
  verseContainer.style.display = 'block';

  function nextVerse() {
    const v = verses[i];
    verseContainer.innerHTML = `\u201C${v.text}\u201D<span class="verse-ref">\u2014 ${v.ref}</span>`;
    verseContainer.style.opacity = '1';
    setTimeout(() => {
      verseContainer.style.opacity = '0';
      i++;
      if (i < Math.min(verses.length, 12)) {
        setTimeout(nextVerse, 800);
      } else {
        setTimeout(() => { verseContainer.style.display = 'none'; }, 800);
      }
    }, 2500);
  }

  nextVerse();
}
