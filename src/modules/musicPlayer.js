export function initMusicPlayer() {
  const toggle = document.getElementById('musicToggle');
  const audio = document.getElementById('bgMusic');
  if (!toggle || !audio) return;

  let playing = false;

  function startPlaying() {
    audio.play().then(() => {
      playing = true;
      toggle.textContent = '\u{1F3B5}';
      toggle.classList.add('playing');
    }).catch(() => {});
  }

  startPlaying();

  toggle.addEventListener('click', () => {
    if (playing) {
      audio.pause();
      toggle.textContent = '\u{1F507}';
      toggle.classList.remove('playing');
    } else {
      audio.play().catch(() => {});
      toggle.textContent = '\u{1F3B5}';
      toggle.classList.add('playing');
    }
    playing = !playing;
  });

  audio.addEventListener('ended', () => {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  });
}
