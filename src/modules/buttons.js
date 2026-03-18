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

    const x = Math.random() * (window.innerWidth - noBtn.offsetWidth);
    const y = Math.random() * (window.innerHeight - noBtn.offsetHeight - 80) + 40;
    noBtn.style.position = 'fixed';
    noBtn.style.left = x + 'px';
    noBtn.style.top = y + 'px';
    noBtn.style.zIndex = '400';

    if (noClickCount < noTexts.length) {
      noBtn.textContent = noTexts[noClickCount];
    }
    if (noClickCount >= noTexts.length) {
      noBtn.style.display = 'none';
    }
  });
}
