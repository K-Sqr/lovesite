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

    if (noClickCount >= noTexts.length) {
      noBtn.style.opacity = '0';
      setTimeout(() => { noBtn.style.display = 'none'; }, 400);
      return;
    }

    // Switch to fixed positioning on first dodge
    if (noBtn.style.position !== 'fixed') {
      noBtn.style.position = 'fixed';
      noBtn.style.zIndex = '400';
      noBtn.style.maxWidth = '70vw';
      noBtn.style.whiteSpace = 'nowrap';
      noBtn.style.transition = 'left 0.3s ease, top 0.3s ease, opacity 0.4s ease';
    }

    // Wait for text reflow before measuring and repositioning
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const btnW = noBtn.offsetWidth;
        const btnH = noBtn.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const pad = 20;

        const maxX = Math.max(pad, vw - btnW - pad);
        const maxY = Math.max(pad + 60, vh - btnH - pad);

        const x = pad + Math.random() * (maxX - pad);
        const y = 60 + Math.random() * (maxY - 60);

        noBtn.style.left = Math.round(x) + 'px';
        noBtn.style.top = Math.round(y) + 'px';
      });
    });
  });
}
