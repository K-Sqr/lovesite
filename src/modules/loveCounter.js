const START_DATE = new Date(2025, 8, 13);

function pad(n) {
  return String(n).padStart(2, '0');
}

function computeElapsed() {
  const now = new Date();
  const diff = now - START_DATE;

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const months = Math.floor(days / 30.44);
  const remainingDays = days - Math.floor(months * 30.44);

  return { months, days: remainingDays, hours, minutes, seconds, totalDays: days };
}

export function initLoveCounter() {
  const el = document.getElementById('loveCounter');
  if (!el) return;

  function update() {
    const t = computeElapsed();
    el.innerHTML = `
      <span class="counter-label">In love for</span>
      <span class="counter-digits">
        <span class="counter-unit"><span class="counter-num">${t.months}</span><span class="counter-tag">months</span></span>
        <span class="counter-sep">&middot;</span>
        <span class="counter-unit"><span class="counter-num">${t.days}</span><span class="counter-tag">days</span></span>
        <span class="counter-sep">&middot;</span>
        <span class="counter-unit"><span class="counter-num">${pad(t.hours)}</span><span class="counter-tag">hrs</span></span>
        <span class="counter-sep">:</span>
        <span class="counter-unit"><span class="counter-num">${pad(t.minutes)}</span><span class="counter-tag">min</span></span>
        <span class="counter-sep">:</span>
        <span class="counter-unit"><span class="counter-num">${pad(t.seconds)}</span><span class="counter-tag">sec</span></span>
      </span>
    `;
  }

  update();
  setInterval(update, 1000);
}
