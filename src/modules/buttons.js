import { noTexts } from '../data/noTexts.js';
import { sendResponse } from './webhook.js';
import { startGraffitiRain } from './graffiti.js';
import { showFloatingVerses } from './verses.js';

// Predefined zones as % of viewport -- guarantees full-screen spread
const ZONES = [
  { left: '10%', top: '15%' },
  { left: '70%', top: '20%' },
  { left: '25%', top: '70%' },
  { left: '60%', top: '75%' },
  { left: '5%',  top: '45%' },
  { left: '75%', top: '50%' },
  { left: '40%', top: '12%' },
  { left: '15%', top: '80%' },
  { left: '55%', top: '40%' },
  { left: '30%', top: '30%' },
  { left: '80%', top: '70%' },
  { left: '10%', top: '60%' },
  { left: '65%', top: '15%' },
  { left: '45%', top: '85%' },
  { left: '20%', top: '50%' },
];

let noClickCount = 0;
let lastZone = -1;

function pickZone() {
  let idx;
  do {
    idx = Math.floor(Math.random() * ZONES.length);
  } while (idx === lastZone);
  lastZone = idx;
  return ZONES[idx];
}

function showLoveMessage() {
  const msg = document.createElement('div');
  msg.className = 'love-message-overlay';
  msg.innerHTML = `
    <div class="love-message-card">
      <p class="love-message-icon">\u{1F496}</p>
      <p class="love-message-text">I still love you</p>
    </div>
  `;
  document.body.appendChild(msg);
  requestAnimationFrame(() => msg.classList.add('active'));
  setTimeout(() => {
    msg.classList.remove('active');
    setTimeout(() => msg.remove(), 500);
  }, 3000);
}

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

    // Update text
    if (noClickCount < noTexts.length) {
      noBtn.textContent = noTexts[noClickCount];
    }

    // After 15 clicks: fade out, show love message
    if (noClickCount >= 15) {
      noBtn.style.opacity = '0';
      noBtn.style.pointerEvents = 'none';
      setTimeout(() => {
        noBtn.style.display = 'none';
        showLoveMessage();
      }, 400);
      return;
    }

    // Move to a predefined zone using CSS percentages (no pixel math needed)
    const zone = pickZone();
    noBtn.style.position = 'fixed';
    noBtn.style.left = zone.left;
    noBtn.style.top = zone.top;
    noBtn.style.zIndex = '400';
    noBtn.style.transform = 'translate(-50%, -50%)';
    noBtn.style.transition = 'left 0.3s ease, top 0.3s ease, opacity 0.4s ease';
    noBtn.style.maxWidth = '80vw';
  });
}
