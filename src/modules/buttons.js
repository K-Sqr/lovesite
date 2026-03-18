import { noTexts } from '../data/noTexts.js';
import { sendResponse } from './webhook.js';
import { startGraffitiRain } from './graffiti.js';
import { showFloatingVerses } from './verses.js';

let noClickCount = 0;

export function initButtons(onYes) {
  const yesBtn = document.getElementById('yesBtn');
  const noBtn = document.getElementById('noBtn');
  if (!yesBtn || !noBtn) return;

  yesBtn.addEventListener('click', () => {
    sendResponse('yes');
    startGraffitiRain(30);
    showFloatingVerses();
    yesBtn.disabled = true;
    noBtn.style.display = 'none';
    yesBtn.innerHTML = 'Yay!! \u{1F389}\u{1F496}';
    if (onYes) onYes();
  });

  noBtn.addEventListener('click', () => {
    sendResponse('no');
    noClickCount++;

    if (noClickCount < noTexts.length) {
      noBtn.textContent = noTexts[noClickCount];
    }

    // On last message, hide the button
    if (noClickCount >= noTexts.length) {
      noBtn.style.opacity = '0';
      setTimeout(() => { noBtn.style.display = 'none'; }, 400);
      return;
    }

    // Ensure button dimensions are measured before repositioning
    const btnRect = noBtn.getBoundingClientRect();
    const btnW = btnRect.width || 120;
    const btnH = btnRect.height || 50;
    const pad = 30;

    // Spread across the full viewport, clamped to stay fully visible
    const minX = pad;
    const maxX = window.innerWidth - btnW - pad;
    const minY = pad;
    const maxY = window.innerHeight - btnH - pad;

    const x = minX + Math.random() * Math.max(0, maxX - minX);
    const y = minY + Math.random() * Math.max(0, maxY - minY);

    noBtn.style.position = 'fixed';
    noBtn.style.left = x + 'px';
    noBtn.style.top = y + 'px';
    noBtn.style.zIndex = '400';
    noBtn.style.transition = 'left 0.25s ease, top 0.25s ease, opacity 0.4s ease';
  });
}
