let aborted = false;

function spawnSparkle(x, y) {
  const s = document.createElement('div');
  s.className = 'sparkle';

  if (Math.random() > 0.6) s.classList.add('large');
  if (Math.random() > 0.5) s.classList.add('warm');

  s.style.left = x + 'px';
  s.style.top = y + 'px';
  document.body.appendChild(s);
  setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, 1000);
}

export function skipReveal() {
  aborted = true;
}

export function revealTextWithSparkles(text, container, onComplete, charDelay = 45) {
  aborted = false;
  container.classList.add('glitter');
  container.innerHTML = '';
  let i = 0;

  function finishImmediately() {
    container.innerHTML = '';
    container.classList.remove('glitter');

    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      if (idx > 0) container.appendChild(document.createElement('br'));
      if (line === '') return;
      for (const ch of line) {
        const span = document.createElement('span');
        // Use normal spaces so the browser can wrap at word boundaries.
        span.textContent = (ch === ' ') ? ' ' : ch;
        span.style.opacity = '1';
        container.appendChild(span);
      }
    });

    container.classList.add('glitter');
    if (onComplete) setTimeout(onComplete, 300);
  }

  function revealNext() {
    if (aborted) {
      finishImmediately();
      return;
    }

    if (i >= text.length) {
      if (onComplete) setTimeout(onComplete, 2500);
      return;
    }

    const ch = text[i++];
    if (ch === '\n') {
      container.appendChild(document.createElement('br'));
      setTimeout(revealNext, charDelay);
      return;
    }

    const span = document.createElement('span');
    // Use normal spaces so the browser can wrap at word boundaries.
    span.textContent = (ch === ' ') ? ' ' : ch;
    span.style.opacity = '0';
    span.style.transform = 'translateY(8px) scale(0.98)';
    container.appendChild(span);

    requestAnimationFrame(() => {
      span.style.transition = 'opacity 160ms ease, transform 260ms cubic-bezier(.2,.8,.2,1)';
      span.style.opacity = '1';
      span.style.transform = 'translateY(0) scale(1)';

      const rect = span.getBoundingClientRect();
      const sx = rect.left + rect.width / 2;
      const sy = rect.top + rect.height / 2;

      if (ch.trim() !== '') {
        const sparks = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < sparks; k++) {
          setTimeout(() => {
            const ox = sx + (Math.random() * 28 - 14);
            const oy = sy + (Math.random() * 16 - 8);
            spawnSparkle(ox, oy);
          }, k * 40);
        }
      }
    });

    const extra = /[,.!?]/.test(ch) ? 120 : 0;
    setTimeout(revealNext, charDelay + extra);
  }

  revealNext();
}
