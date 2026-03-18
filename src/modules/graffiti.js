import { graffitiTexts } from '../data/verses.js';

let container;

function init() {
  container = document.getElementById('graffiti-container');
}

function dropGraffiti() {
  if (!container) init();
  const text = graffitiTexts[Math.floor(Math.random() * graffitiTexts.length)];
  const span = document.createElement('span');
  span.className = 'graffiti';
  span.innerHTML = text;
  span.style.left = Math.random() * 80 + 10 + 'vw';
  span.style.top = '-40px';
  container.appendChild(span);
  setTimeout(() => {
    if (span.parentNode) container.removeChild(span);
  }, 2600);
}

export function startGraffitiRain(count = 25) {
  init();
  let drops = 0;
  const interval = setInterval(() => {
    dropGraffiti();
    drops++;
    if (drops >= count) clearInterval(interval);
  }, 110);
}
