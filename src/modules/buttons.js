import { noTexts } from '../data/noTexts.js';
import { sendResponse } from './webhook.js';
import { startGraffitiRain } from './graffiti.js';
import { showFloatingVerses } from './verses.js';

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
let detached = false;

function pickZone() {
  let idx;
  do {
    idx = Math.floor(Math.random() * ZONES.length);
  } while (idx === lastZone);
  lastZone = idx;
  return ZONES[idx];
}

/**
 * Turn a zone's percentage into a pixel centre that keeps the whole button on
 * screen. The button is position: fixed with translate(-50%, -50%), so its
 * centre must stay at least half its size (plus a margin) from every edge —
 * and clear of the fixed top nav and the ≤600px bottom tab bar.
 */
function clampToViewport(btn, zone) {
  const EDGE = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const halfW = btn.offsetWidth / 2;
  const halfH = btn.offsetHeight / 2;

  const nav = document.querySelector('.site-nav');
  const tabs = document.querySelector('.site-tabs');
  const topInset = nav ? nav.getBoundingClientRect().height : 0;
  const bottomInset = tabs ? tabs.getBoundingClientRect().height : 0;

  const minX = halfW + EDGE;
  const maxX = vw - halfW - EDGE;
  const minY = topInset + halfH + EDGE;
  const maxY = vh - bottomInset - halfH - EDGE;

  const wantX = (parseFloat(zone.left) / 100) * vw;
  const wantY = (parseFloat(zone.top) / 100) * vh;

  return {
    // If the button is wider than the room available, centre it rather than clip it.
    x: minX > maxX ? vw / 2 : Math.min(maxX, Math.max(minX, wantX)),
    y: minY > maxY ? vh / 2 : Math.min(maxY, Math.max(minY, wantY)),
  };
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

    if (noClickCount < noTexts.length) {
      noBtn.textContent = noTexts[noClickCount];
    }

    if (noClickCount >= 15) {
      noBtn.style.opacity = '0';
      noBtn.style.pointerEvents = 'none';
      setTimeout(() => {
        noBtn.remove();
        showLoveMessage();
      }, 400);
      return;
    }

    // Rip the button out of the flex container on the first dodge
    // so it's truly free-floating on the page
    if (!detached) {
      detached = true;
      document.body.appendChild(noBtn);
      noBtn.style.position = 'fixed';
      noBtn.style.zIndex = '400';
      noBtn.style.maxWidth = '80vw';
      noBtn.style.transform = 'translate(-50%, -50%)';
      noBtn.style.transition = 'left 0.3s ease, top 0.3s ease, opacity 0.4s ease';
    }

    const zone = pickZone();
    const { x, y } = clampToViewport(noBtn, zone);
    noBtn.style.left = `${Math.round(x)}px`;
    noBtn.style.top = `${Math.round(y)}px`;
  });
}
