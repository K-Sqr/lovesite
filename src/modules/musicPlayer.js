const SESSION_SHOULD_PLAY = 'music_should_play';
const SESSION_MUTED = 'music_muted';

const POPUP_ID = 'music-popup';
const POPUP_DISMISS_MS = 8000;
const POPUP_SHOWN_KEY = 'music_popup_shown';

function ensureSessionDefaults() {
  if (!sessionStorage.getItem(SESSION_SHOULD_PLAY)) {
    sessionStorage.setItem(SESSION_SHOULD_PLAY, 'true');
  }
  if (!sessionStorage.getItem(SESSION_MUTED)) {
    sessionStorage.setItem(SESSION_MUTED, 'false');
  }
}

function getShouldPlay() {
  return sessionStorage.getItem(SESSION_SHOULD_PLAY) !== 'false';
}

function getMuted() {
  return sessionStorage.getItem(SESSION_MUTED) === 'true';
}

function setMuted(muted) {
  sessionStorage.setItem(SESSION_MUTED, String(!!muted));
}

function setShouldPlay(shouldPlay) {
  sessionStorage.setItem(SESSION_SHOULD_PLAY, String(!!shouldPlay));
}

function updateToggleUI(toggle, audio) {
  if (!toggle) return;
  const isMuted = !!audio.muted;
  toggle.textContent = isMuted ? '\u{1F507}' : '\u{1F3B5}'; // 🔇 vs 🎵
  if (!isMuted) toggle.classList.add('playing');
  else toggle.classList.remove('playing');
}

function getOrCreatePopup(toggle, audio) {
  let popup = document.getElementById(POPUP_ID);
  if (popup) return popup;

  popup = document.createElement('div');
  popup.id = POPUP_ID;
  popup.className = 'music-popup';

  popup.innerHTML = `
    <div class="music-popup-card">
      <div class="music-popup-title">Music is playing</div>
      <button type="button" class="music-popup-btn" id="musicPopupBtn">
        ${audio.muted ? 'Unmute' : 'Mute'}
      </button>
      <button type="button" class="music-popup-close" aria-label="Close" id="musicPopupClose">
        &times;
      </button>
    </div>
  `;
  document.body.appendChild(popup);

  const btn = popup.querySelector('#musicPopupBtn');
  const closeBtn = popup.querySelector('#musicPopupClose');

  btn.addEventListener('click', () => {
    if (audio.muted) {
      audio.muted = false;
      setMuted(false);
      setShouldPlay(true);
      // Try play after unmuting.
      audio.play().catch(() => {});
    } else {
      audio.muted = true;
      setMuted(true);
    }
    updateToggleUI(toggle, audio);
    // Keep popup around until auto-dismiss; text updates immediately.
    btn.textContent = audio.muted ? 'Unmute' : 'Mute';
  });

  closeBtn.addEventListener('click', () => {
    popup.classList.remove('active');
  });

  return popup;
}

export function initMusicPlayer() {
  const toggle = document.getElementById('musicToggle');
  const audio = document.getElementById('bgMusic');
  if (!audio) return;

  ensureSessionDefaults();

  const shouldPlay = getShouldPlay();
  audio.loop = true; // loop seamlessly
  audio.muted = getMuted();

  updateToggleUI(toggle, audio);

  const playIfAllowed = async () => {
    if (!getShouldPlay()) return;
    if (audio.muted) return;
    try {
      await audio.play();
      // Successful play will be handled by the `play` event below.
    } catch {
      // Autoplay can be blocked until a user gesture.
    }
  };

  let dismissTimer = null;
  const showPopup = () => {
    if (!getShouldPlay()) return;
    // Only show the hint once per tab/session. Subsequent pages should not keep popping it up.
    if (sessionStorage.getItem(POPUP_SHOWN_KEY) === 'true') return;

    const popup = getOrCreatePopup(toggle, audio);
    const btn = popup.querySelector('#musicPopupBtn');
    if (btn) btn.textContent = audio.muted ? 'Unmute' : 'Mute';

    popup.classList.add('active');
    sessionStorage.setItem(POPUP_SHOWN_KEY, 'true');
    if (dismissTimer) clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => popup.classList.remove('active'), POPUP_DISMISS_MS);
  };

  audio.addEventListener('play', showPopup);
  audio.addEventListener('pause', () => {
    updateToggleUI(toggle, audio);
  });

  // If playback starts via autoplay, `play` event fires and shows popup.
  playIfAllowed();

  // If autoplay was blocked, try again after first user gesture.
  const gestureHandler = () => {
    document.removeEventListener('click', gestureHandler);
    document.removeEventListener('touchstart', gestureHandler);
    document.removeEventListener('keydown', gestureHandler);
    playIfAllowed();
  };
  document.addEventListener('click', gestureHandler, { once: true });
  document.addEventListener('touchstart', gestureHandler, { once: true });
  document.addEventListener('keydown', gestureHandler, { once: true });

  // Toggle = mute/unmute (not pause/play), so music can stay "enabled" across pages.
  if (toggle) {
    toggle.addEventListener('click', () => {
      const nextMuted = !audio.muted;
      audio.muted = nextMuted;
      setMuted(nextMuted);
      setShouldPlay(true);
      updateToggleUI(toggle, audio);
      if (!nextMuted) audio.play().catch(() => {});
      showPopup();
    });
  }
}
