import { setIcon } from './icons.js';

const SESSION_SHOULD_PLAY = 'music_should_play';
const SESSION_MUTED = 'music_muted';
const SESSION_TRACK = 'music_track';
const SESSION_TRACK_SRC = 'music_track_src';
const SESSION_TIME = 'music_time';
const SESSION_SHUFFLE = 'music_shuffle';
const SESSION_HIDDEN = 'music_player_hidden';

/* Volume and where the player sits are hers to keep, so they outlive the tab. */
const VOLUME_KEY = 'usm.music.volume.v1';
const POSITION_KEY = 'usm.music.position.v1';
/** Songs come in loud; start quiet and let her turn it up. */
const DEFAULT_VOLUME = 0.25;


function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage off — the session still works, it just won't remember.
  }
}

function readVolume() {
  const v = readJSON(VOLUME_KEY);
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
}

function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * iOS ignores `audio.volume` entirely (only the hardware buttons change it),
 * so there the element is routed through a Web Audio gain node instead.
 * Everywhere else `audio.volume` works and autoplay after prior engagement
 * keeps working, which a suspended AudioContext would silence — so this is
 * iOS-only on purpose.
 * @returns {{ set: (v: number) => void, resume: () => void }}
 */
function createVolumeControl(audio) {
  const direct = { set: (v) => { audio.volume = v; }, resume: () => {} };
  if (!isIOS()) return direct;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return direct;
  try {
    const ctx = new Ctx();
    const gain = ctx.createGain();
    ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
    return {
      set: (v) => { gain.gain.value = v; },
      resume: () => { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    };
  } catch {
    return direct;
  }
}

/** Space the bottom tab bar takes on a phone, so the player can't hide under it. */
function tabsHeight() {
  const tabs = document.getElementById('siteTabs');
  if (!tabs || getComputedStyle(tabs).display === 'none') return 0;
  return tabs.offsetHeight;
}

/**
 * Drag the player by its top row (anywhere that isn't a button). The position
 * is kept in viewport coordinates and clamped back on screen on load and on
 * resize, so a spot saved on a wide screen never strands it off a phone.
 */
function makeDraggable(player, handle) {
  const MARGIN = 8;

  const place = (x, y) => {
    const rect = player.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - MARGIN;
    const maxY = window.innerHeight - rect.height - MARGIN - tabsHeight();
    const left = Math.round(Math.min(Math.max(MARGIN, x), Math.max(MARGIN, maxX)));
    const top = Math.round(Math.min(Math.max(MARGIN, y), Math.max(MARGIN, maxY)));
    player.style.left = `${left}px`;
    player.style.top = `${top}px`;
    player.style.right = 'auto';
    player.style.bottom = 'auto';
  };

  const saved = readJSON(POSITION_KEY);
  if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
    place(saved.left, saved.top);
  }

  let drag = null;
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const rect = player.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false };
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // synthetic or already-captured pointer; dragging still works within the handle
    }
    player.classList.add('is-dragging');
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    place(drag.left + dx, drag.top + dy);
  });
  const end = (e) => {
    if (!drag) return;
    if (drag.moved) {
      const rect = player.getBoundingClientRect();
      writeJSON(POSITION_KEY, { left: rect.left, top: rect.top });
    }
    drag = null;
    player.classList.remove('is-dragging');
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!player.style.left) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const rect = player.getBoundingClientRect();
      place(rect.left, rect.top);
    }, 150);
  });
}

async function loadPlaylist() {
  try {
    const response = await fetch('./music/playlist.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Playlist request failed: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.tracks)
      ? data.tracks.filter((track) => track?.title && track?.src)
      : [];
  } catch (error) {
    console.warn('The music folder could not be read.', error);
    return [];
  }
}

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

export async function initMusicPlayer() {
  const audio = document.getElementById('bgMusic');
  const player = document.getElementById('musicPlayer');
  const title = document.getElementById('musicTrackTitle');
  const playButton = document.getElementById('musicPlay');
  const muteButton = document.getElementById('musicMute');
  const shuffleButton = document.getElementById('musicShuffle');
  const restoreButton = document.getElementById('musicRestore');
  const volumeSlider = document.getElementById('musicVolume');
  const handle = document.getElementById('musicHandle');
  if (!audio || !player) return;

  // Volume first, before any src is set, so nothing ever plays at full blast.
  const volumeControl = createVolumeControl(audio);
  let volume = readVolume();
  volumeControl.set(volume);
  if (volumeSlider) volumeSlider.value = String(Math.round(volume * 100));
  if (handle) makeDraggable(player, handle);

  ensureSessionDefaults();

  const playlist = await loadPlaylist();
  if (!playlist.length) {
    if (title) title.textContent = 'Drop songs into public/music';
    player.querySelectorAll('.music-player__controls button').forEach((button) => {
      button.disabled = true;
    });
    return;
  }

  let trackIndex = Number.parseInt(sessionStorage.getItem(SESSION_TRACK) || '0', 10);
  const savedTrackSrc = sessionStorage.getItem(SESSION_TRACK_SRC);
  const savedTrackIndex = playlist.findIndex((track) => track.src === savedTrackSrc);
  if (savedTrackIndex >= 0) trackIndex = savedTrackIndex;
  if (!Number.isInteger(trackIndex) || !playlist[trackIndex]) trackIndex = 0;
  let shuffle = sessionStorage.getItem(SESSION_SHUFFLE) === 'true';

  audio.loop = false;
  audio.muted = getMuted();
  player.hidden = sessionStorage.getItem(SESSION_HIDDEN) === 'true';
  if (restoreButton) restoreButton.hidden = !player.hidden;

  const updateUI = () => {
    const isPlaying = !audio.paused && !audio.ended;
    if (title) title.textContent = playlist[trackIndex].title;
    if (playButton) {
      setIcon(playButton, isPlaying ? 'pause' : 'play');
      playButton.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
      playButton.title = isPlaying ? 'Pause' : 'Play';
    }
    if (muteButton) {
      const silent = audio.muted || volume === 0;
      setIcon(muteButton, silent ? 'volumeOff' : volume < 0.5 ? 'volumeLow' : 'volumeHigh');
      muteButton.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
      muteButton.title = audio.muted ? 'Unmute' : 'Mute';
      muteButton.setAttribute('aria-pressed', String(audio.muted));
    }
    if (volumeSlider) volumeSlider.classList.toggle('is-muted', audio.muted);
    if (shuffleButton) {
      shuffleButton.classList.toggle('is-active', shuffle);
      shuffleButton.setAttribute('aria-pressed', String(shuffle));
      shuffleButton.setAttribute('aria-label', shuffle ? 'Shuffle on' : 'Shuffle off');
      shuffleButton.title = shuffle ? 'Shuffle on' : 'Shuffle off';
    }
  };

  const setTrack = (nextIndex, { play = true, restoreTime = false } = {}) => {
    trackIndex = (nextIndex + playlist.length) % playlist.length;
    sessionStorage.setItem(SESSION_TRACK, String(trackIndex));
    sessionStorage.setItem(SESSION_TRACK_SRC, playlist[trackIndex].src);
    audio.src = playlist[trackIndex].src;
    audio.load();
    if (restoreTime) {
      audio.addEventListener('loadedmetadata', () => {
        const savedTime = Number.parseFloat(sessionStorage.getItem(SESSION_TIME) || '0');
        if (Number.isFinite(savedTime) && savedTime < audio.duration) audio.currentTime = savedTime;
      }, { once: true });
    } else {
      sessionStorage.setItem(SESSION_TIME, '0');
    }
    updateUI();
    if (play) {
      setShouldPlay(true);
      audio.play().catch(() => updateUI());
    }
  };

  const nextTrack = () => {
    if (shuffle && playlist.length > 1) {
      let next = trackIndex;
      while (next === trackIndex) next = Math.floor(Math.random() * playlist.length);
      setTrack(next);
      return;
    }
    setTrack(trackIndex + 1);
  };

  const playIfAllowed = async () => {
    if (!getShouldPlay()) return;
    if (audio.muted) return;
    volumeControl.resume();
    try {
      await audio.play();
    } catch {
      // Autoplay can be blocked until a user gesture.
    }
  };

  setTrack(trackIndex, { play: false, restoreTime: true });
  audio.addEventListener('play', updateUI);
  audio.addEventListener('pause', updateUI);
  audio.addEventListener('ended', nextTrack);
  playIfAllowed();

  const gestureHandler = () => {
    volumeControl.resume();
    document.removeEventListener('click', gestureHandler);
    document.removeEventListener('touchstart', gestureHandler);
    document.removeEventListener('keydown', gestureHandler);
    playIfAllowed();
  };
  document.addEventListener('click', gestureHandler, { once: true });
  document.addEventListener('touchstart', gestureHandler, { once: true });
  document.addEventListener('keydown', gestureHandler, { once: true });

  playButton?.addEventListener('click', () => {
    if (audio.paused) {
      setShouldPlay(true);
      volumeControl.resume();
      audio.play().catch(() => updateUI());
    } else {
      setShouldPlay(false);
      audio.pause();
    }
  });

  document.getElementById('musicStop')?.addEventListener('click', () => {
    setShouldPlay(false);
    audio.pause();
    audio.currentTime = 0;
    sessionStorage.setItem(SESSION_TIME, '0');
    updateUI();
  });

  document.getElementById('musicPrev')?.addEventListener('click', () => {
    setTrack(trackIndex - 1);
  });
  document.getElementById('musicNext')?.addEventListener('click', nextTrack);

  muteButton?.addEventListener('click', () => {
    audio.muted = !audio.muted;
    setMuted(audio.muted);
    updateUI();
  });

  volumeSlider?.addEventListener('input', () => {
    volume = Math.min(1, Math.max(0, Number(volumeSlider.value) / 100));
    volumeControl.set(volume);
    writeJSON(VOLUME_KEY, volume);
    // Nudging the slider while muted is a clear "I want to hear it".
    if (audio.muted && volume > 0) {
      audio.muted = false;
      setMuted(false);
    }
    updateUI();
  });

  shuffleButton?.addEventListener('click', () => {
    shuffle = !shuffle;
    sessionStorage.setItem(SESSION_SHUFFLE, String(shuffle));
    updateUI();
  });

  document.getElementById('musicClose')?.addEventListener('click', () => {
    player.hidden = true;
    sessionStorage.setItem(SESSION_HIDDEN, 'true');
    if (restoreButton) restoreButton.hidden = false;
  });

  restoreButton?.addEventListener('click', () => {
    player.hidden = false;
    sessionStorage.setItem(SESSION_HIDDEN, 'false');
    restoreButton.hidden = true;
  });

  window.addEventListener('pagehide', () => {
    sessionStorage.setItem(SESSION_TRACK, String(trackIndex));
    sessionStorage.setItem(SESSION_TRACK_SRC, playlist[trackIndex].src);
    sessionStorage.setItem(SESSION_TIME, String(audio.currentTime || 0));
  });

  updateUI();
}
