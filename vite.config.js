import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: '/lovesite/',
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
        outfit: resolve(__dirname, 'outfit.html'),
        letters: resolve(__dirname, 'letters.html'),
      },
    },
  },
});
