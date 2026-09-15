const SESSION_SHOULD_PLAY = 'music_should_play';
const SESSION_MUTED = 'music_muted';
const SESSION_TRACK = 'music_track';
const SESSION_TRACK_SRC = 'music_track_src';
const SESSION_TIME = 'music_time';
const SESSION_SHUFFLE = 'music_shuffle';
const SESSION_HIDDEN = 'music_player_hidden';

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
  if (!audio || !player) return;

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
      playButton.textContent = isPlaying ? '❚❚' : '▶';
      playButton.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
      playButton.title = isPlaying ? 'Pause' : 'Play';
    }
    if (muteButton) {
      muteButton.textContent = audio.muted ? '🔇' : '🔊';
      muteButton.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
      muteButton.title = audio.muted ? 'Unmute' : 'Mute';
      muteButton.setAttribute('aria-pressed', String(audio.muted));
    }
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
