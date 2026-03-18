import './styles/base.css';
import './styles/sections.css';
import './styles/animations.css';

import { revealTextWithSparkles, skipReveal } from './modules/textReveal.js';
import { initButtons } from './modules/buttons.js';
import { initTimeline } from './modules/timeline.js';
import { initGallery } from './modules/gallery.js';
import { initVerseCarousel } from './modules/verses.js';
import { initMusicPlayer } from './modules/musicPlayer.js';
import { initLoveCounter } from './modules/loveCounter.js';
import { initNavbar } from './modules/navbar.js';
import { initTheme } from './modules/theme.js';

const MESSAGE = "I would like to make this dream a reality with you as God stirs the waters of life, both stormy and still.\n\nI don\u2019t want to navigate them alone. I want you as my co-captain.\n\nWill you be my Boo? \u2764";

function spawnFloatingHearts() {
  const container = document.getElementById('hearts-bg');
  if (!container) return;

  const hearts = ['\u2764', '\u{1F496}', '\u{1F495}', '\u{1F493}', '\u{1F497}'];

  function addHeart() {
    const el = document.createElement('span');
    el.className = 'floating-heart';
    el.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.fontSize = (0.8 + Math.random() * 1.2) + 'rem';
    el.style.animationDuration = (8 + Math.random() * 12) + 's';
    el.style.animationDelay = Math.random() * 4 + 's';
    container.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 22000);
  }

  for (let i = 0; i < 8; i++) addHeart();
  setInterval(addHeart, 3000);
}

function setupScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

function unlockSections() {
  document.querySelectorAll('.locked').forEach((section) => {
    section.classList.add('unlocked');
  });

  initLoveCounter();

  requestAnimationFrame(() => {
    setTimeout(setupScrollReveal, 100);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();
  spawnFloatingHearts();

  const mainMessage = document.getElementById('mainMessage');
  const buttonGroup = document.getElementById('buttonGroup');
  const skipBtn = document.getElementById('skipBtn');

  function onRevealComplete() {
    if (skipBtn) skipBtn.style.display = 'none';
    buttonGroup.style.display = 'flex';
    buttonGroup.classList.add('reveal');
    requestAnimationFrame(() => buttonGroup.classList.add('visible'));
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      skipBtn.style.display = 'none';
      skipReveal();
    });
  }

  revealTextWithSparkles(MESSAGE, mainMessage, onRevealComplete);

  initButtons(unlockSections);
  initTimeline();
  initGallery();
  initVerseCarousel();
  initMusicPlayer();
});
