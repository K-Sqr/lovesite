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
      // iOS also parks the context in 'interrupted' after a call or the lock
      // screen; the element keeps "playing" through it silently unless resumed.
      resume: () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}); },
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
 * Drag the player anywhere that isn't a control. The position is kept in
 * viewport coordinates and clamped back on screen on load and on resize, so
 * a spot saved on a wide screen never strands it off a phone.
 *
 * Swipe it to the side (a quick horizontal flick, or shoving it past the
 * edge) and it tucks into a small tab at that edge; tap the tab, or swipe it
 * back in, and it returns. The tab keeps the player's vertical position.
 */
function makeDraggable(player, tab) {
  const MARGIN = 8;
  /** px/ms — a flick, not a slow drag */
  const FLICK = 0.55;
  /** how much of the player may hang off the edge before it docks */
  const OVERHANG = 0.35;

  const clampTop = (y, height) => {
    const maxY = window.innerHeight - height - MARGIN - tabsHeight();
    return Math.round(Math.min(Math.max(MARGIN, y), Math.max(MARGIN, maxY)));
  };

  const place = (x, y) => {
    const rect = player.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - MARGIN;
    const left = Math.round(Math.min(Math.max(MARGIN, x), Math.max(MARGIN, maxX)));
    const top = clampTop(y, rect.height);
    player.style.left = `${left}px`;
    player.style.top = `${top}px`;
    player.style.right = 'auto';
    player.style.bottom = 'auto';
  };

  const save = (extra = {}) => {
    const rect = player.getBoundingClientRect();
    const dock = player.dataset.dock || null;
    writeJSON(POSITION_KEY, { left: rect.left, top: rect.top, dock, ...extra });
  };

  const dock = (side, top) => {
    player.dataset.dock = side;
    player.classList.add('is-docked');
    player.style.left = 'auto';
    player.style.right = 'auto';
    player.style[side] = '0px';
    player.style.top = `${clampTop(top, 48)}px`;
    player.style.bottom = 'auto';
    tab.setAttribute('aria-label', 'Show music player');
    save({ dock: side });
  };

  /**
   * The click a browser synthesises after a tap lands ~300ms later at the
   * same spot — where, once the player has expanded, the ✕ button now sits.
   * Swallow the one click that follows an undock so a tap only ever opens.
   * Only that one, though — a quick tap on play right after must still land.
   */
  let swallowClickUntil = 0;
  player.addEventListener('click', (e) => {
    if (performance.now() < swallowClickUntil) {
      swallowClickUntil = 0;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  const undock = () => {
    swallowClickUntil = performance.now() + 600;
    const side = player.dataset.dock;
    const top = parseFloat(player.style.top) || MARGIN;
    delete player.dataset.dock;
    player.classList.remove('is-docked');
    // Come back on the same side it was tucked into.
    const rect = player.getBoundingClientRect();
    place(side === 'left' ? MARGIN : window.innerWidth - rect.width - MARGIN, top);
    save({ dock: null });
  };

  const saved = readJSON(POSITION_KEY);
  if (saved && Number.isFinite(saved.top)) {
    if (saved.dock === 'left' || saved.dock === 'right') dock(saved.dock, saved.top);
    else if (Number.isFinite(saved.left)) place(saved.left, saved.top);
  }

  let drag = null;
  player.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('input, .music-player__control')) return;
    const rect = player.getBoundingClientRect();
    drag = {
      x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, width: rect.width,
      moved: false, lastX: e.clientX, lastT: e.timeStamp, vx: 0,
      docked: player.classList.contains('is-docked'),
    };
    try {
      player.setPointerCapture(e.pointerId);
    } catch {
      // synthetic or already-captured pointer; dragging still works within the element
    }
    player.classList.add('is-dragging');
    e.preventDefault();
  });

  player.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) drag.vx = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;
    drag.unclampedX = drag.left + dx;

    if (drag.docked) {
      // Swiping the tab back toward the middle brings the player out.
      const inward = player.dataset.dock === 'left' ? dx : -dx;
      if (inward > 28) {
        drag.docked = false;
        undock();
        const rect = player.getBoundingClientRect();
        drag.left = rect.left;
        drag.top = rect.top;
        drag.width = rect.width;
        drag.x = e.clientX;
        drag.y = e.clientY;
      }
      return;
    }
    place(drag.left + dx, drag.top + dy);
  });

  const end = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    player.classList.remove('is-dragging');
    try {
      player.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }

    if (d.docked) {
      // A tap (or a tiny wobble) on the tab opens the player.
      if (!d.moved || Math.abs(e.clientX - d.x) < 28) undock();
      return;
    }
    if (!d.moved) return;

    // Flicked sideways, or shoved past the edge → tuck away on that side.
    const x = d.unclampedX ?? d.left;
    const overLeft = x < -d.width * OVERHANG;
    const overRight = x + d.width > window.innerWidth + d.width * OVERHANG;
    const flickLeft = d.vx < -FLICK && e.clientX < window.innerWidth * 0.5;
    const flickRight = d.vx > FLICK && e.clientX > window.innerWidth * 0.5;
    const top = parseFloat(player.style.top) || MARGIN;
    if (overLeft || flickLeft) dock('left', top);
    else if (overRight || flickRight) dock('right', top);
    else save();
  };
  player.addEventListener('pointerup', end);
  player.addEventListener('pointercancel', end);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    // Phones fire resize when the URL bar or keyboard comes and goes; a hidden
    // player measures 0×0 and would be clamped into the top-left corner.
    if (!player.style.top || player.hidden) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const rect = player.getBoundingClientRect();
      if (player.classList.contains('is-docked')) {
        player.style.top = `${clampTop(rect.top, rect.height)}px`;
      } else {
        place(rect.left, rect.top);
      }
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
  const dockTab = document.getElementById('musicDockTab');
  if (!audio || !player) return;

  // Volume first, before any src is set, so nothing ever plays at full blast.
  const volumeControl = createVolumeControl(audio);
  let volume = readVolume();
  volumeControl.set(volume);
  if (volumeSlider) volumeSlider.value = String(Math.round(volume * 100));
  if (dockTab) makeDraggable(player, dockTab);

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
    player.classList.toggle('is-playing', isPlaying);
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

  /**
   * Every play goes through here so the iOS gain node is always woken first —
   * otherwise "next" as the first tap on an iPhone plays in silence.
   * Resolves true if playback actually started.
   */
  const startPlayback = async () => {
    volumeControl.resume();
    try {
      await audio.play();
      return true;
    } catch {
      // Autoplay blocked until a gesture, or a newer play/pause won the race.
      updateUI();
      return false;
    }
  };

  const updateMediaSession = () => {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: playlist[trackIndex].title });
    } catch {
      // Not supported here; the lock screen just shows the page title.
    }
  };

  let restoreTimeListener = null;
  const setTrack = (nextIndex, { play = true, restoreTime = false } = {}) => {
    trackIndex = (nextIndex + playlist.length) % playlist.length;
    sessionStorage.setItem(SESSION_TRACK, String(trackIndex));
    sessionStorage.setItem(SESSION_TRACK_SRC, playlist[trackIndex].src);
    // A restore still pending from the previous track must not seek this one.
    if (restoreTimeListener) {
      audio.removeEventListener('loadedmetadata', restoreTimeListener);
      restoreTimeListener = null;
    }
    audio.src = playlist[trackIndex].src;
    audio.load();
    if (restoreTime) {
      restoreTimeListener = () => {
        restoreTimeListener = null;
        const savedTime = Number.parseFloat(sessionStorage.getItem(SESSION_TIME) || '0');
        if (Number.isFinite(savedTime) && savedTime < audio.duration) audio.currentTime = savedTime;
      };
      audio.addEventListener('loadedmetadata', restoreTimeListener, { once: true });
    } else {
      sessionStorage.setItem(SESSION_TIME, '0');
    }
    updateMediaSession();
    updateUI();
    if (play) {
      setShouldPlay(true);
      startPlayback();
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

  /** Resolves true when there was nothing left to do: playing, or not wanted. */
  const playIfAllowed = async () => {
    if (!getShouldPlay() || audio.muted) return true;
    if (!audio.paused) return true;
    return startPlayback();
  };

  setTrack(trackIndex, { play: false, restoreTime: true });
  audio.addEventListener('play', updateUI);
  audio.addEventListener('pause', updateUI);
  audio.addEventListener('ended', nextTrack);
  playIfAllowed();

  /*
   * Autoplay is usually blocked until she touches the page, so the first
   * gesture anywhere starts the music. Two things matter on a phone:
   *
   * - Listen for the *end* of a tap, not `touchstart`: browsers only count
   *   pointerup / touchend / click as activation, so a play() from touchstart
   *   is refused — and the old once-only handler then gave up for good.
   *   The handler stays armed until a play actually goes through.
   * - Ignore taps on the player itself. Its buttons handle their own state;
   *   kicking play() from the tap that lands on the play button made the
   *   button's own click see "already playing" and pause it straight back.
   */
  const GESTURE_EVENTS = ['pointerup', 'touchend', 'keydown', 'click'];
  const gestureHandler = async (e) => {
    if (player.contains(e.target)) return;
    if (await playIfAllowed()) {
      GESTURE_EVENTS.forEach((type) => document.removeEventListener(type, gestureHandler));
    }
  };
  GESTURE_EVENTS.forEach((type) => document.addEventListener(type, gestureHandler));

  const togglePlayback = () => {
    if (audio.paused) {
      setShouldPlay(true);
      startPlayback();
    } else {
      setShouldPlay(false);
      audio.pause();
    }
  };
  playButton?.addEventListener('click', togglePlayback);

  // Lock-screen / notification controls should mean the same as the buttons,
  // so a pause there stays paused on the next page too.
  if ('mediaSession' in navigator) {
    const bind = (action, handler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // action not supported on this browser
      }
    };
    bind('play', () => { if (audio.paused) togglePlayback(); });
    bind('pause', () => { if (!audio.paused) togglePlayback(); });
    bind('previoustrack', () => setTrack(trackIndex - 1));
    bind('nexttrack', () => nextTrack());
  }

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
    // Muted players don't auto-start on a new page, so unmuting on one would
    // otherwise sit silent with the play icon showing. This is a tap, so allowed.
    if (!audio.muted) playIfAllowed();
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

  const saveProgress = () => {
    sessionStorage.setItem(SESSION_TRACK, String(trackIndex));
    sessionStorage.setItem(SESSION_TRACK_SRC, playlist[trackIndex].src);
    sessionStorage.setItem(SESSION_TIME, String(audio.currentTime || 0));
  };
  window.addEventListener('pagehide', saveProgress);
  // Phones often kill a backgrounded tab without ever firing pagehide.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveProgress();
    // Coming back from the lock screen on iOS, the gain node may be interrupted.
    else if (!audio.paused) volumeControl.resume();
  });

  updateUI();
}
