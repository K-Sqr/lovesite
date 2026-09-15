import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdir } from 'fs/promises';

const MUSIC_DIR = resolve(__dirname, 'public/music');
const DEFAULT_TRACK = 'Outgun Onkar - Wind II feat. The Good Wine, Anendlessocean (Official Visualizer).mp3';
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm', '.opus']);

function trackTitle(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/\s*\((official (music )?video|official visualizer|audio)\)\s*$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function scanMusicFolder() {
  const entries = await readdir(MUSIC_DIR, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((filename) => AUDIO_EXTENSIONS.has(filename.slice(filename.lastIndexOf('.')).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  const defaultIndex = filenames.indexOf(DEFAULT_TRACK);
  if (defaultIndex > 0) filenames.unshift(...filenames.splice(defaultIndex, 1));

  return filenames.map((filename) => ({
    title: trackTitle(filename),
    // encodeURIComponent turns commas into %2C; Vite's static middleware then
    // 404s the file. Leave commas (and other harmless punctuation) literal.
    src: `./music/${filename.split('/').map(encodeMusicPath).join('/')}`,
  }));
}

function encodeMusicPath(segment) {
  return encodeURIComponent(segment).replace(/%2C/g, ',');
}

function automaticMusicPlaylist() {
  const playlistJson = async () => JSON.stringify({ tracks: await scanMusicFolder() }, null, 2);

  return {
    name: 'automatic-music-playlist',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split('?')[0] || '';
        if (!pathname.endsWith('/music/playlist.json')) return next();

        try {
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(await playlistJson());
        } catch (error) {
          next(error);
        }
      });
    },
    async generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'music/playlist.json',
        source: await playlistJson(),
      });
    },
  };
}

export default defineConfig({
  root: '.',
  base: '/lovesite/',
  // Multi-page site: without this, Vite's SPA fallback rewrites every
  // /lovesite/*.html request to index.html in `npm run dev`.
  appType: 'mpa',
  plugins: [automaticMusicPlaylist()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        memories: resolve(__dirname, 'memories.html'),
        timeline: resolve(__dirname, 'timeline.html'),
        lovegpt: resolve(__dirname, 'lovegpt.html'),
        foryou: resolve(__dirname, 'foryou.html'),
        rhythm: resolve(__dirname, 'rhythm.html'),
        applications: resolve(__dirname, 'applications.html'),
        people: resolve(__dirname, 'people.html'),
        peopleDashboard: resolve(__dirname, 'people-dashboard.html'),
        outfit: resolve(__dirname, 'outfit.html'),
        letters: resolve(__dirname, 'letters.html'),
      },
    },
  },
});
