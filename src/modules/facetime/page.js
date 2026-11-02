/**
 * page.js — boots the FaceTime page: story first, then everything.
 *
 *   initFacetimePage()
 *
 * First visit: the story, layer by layer, then everything to scroll through.
 * Later visits open on everything, with a button to watch the story again.
 *   ?story    always start with the story
 *   ?explore  skip straight to everything
 *
 * The numbers come from src/data/facetime-stats.json, which _private/build_stats.py
 * writes from the raw call log. Nothing here reads anything personal.
 */

import stats from '../../data/facetime-stats.json';
import { initSiteChrome } from '../siteChrome.js';
import { createStore } from '../storage.js';
import { readNotes } from './notes.js';
import { buildStory } from './story.js';
import { buildExplore, buildSky, bindSkyToScroll } from './explore.js';

const HER_BIRTHDAY = new Date(2001, 9, 26); // October 26

export function initFacetimePage() {
  const store = createStore('facetime', { version: 1, initial: { seen: false } });

  const readSeen = () => {
    try { const v = store.read(); return !!(v && v.seen); } catch { return false; }
  };
  const markSeen = () => {
    try { store.write({ ...(store.read() || {}), seen: true, at: new Date().toISOString() }); } catch { /* storage off: she just sees the story again next time */ }
  };
  const readPalette = () => {
    try { const v = store.read(); return v && v.palette === 'pink' ? 'pink' : 'sky'; } catch { return 'sky'; }
  };
  const savePalette = (palette) => {
    try { store.write({ ...(store.read() || {}), palette }); } catch { /* fine, it just resets next time */ }
  };

  document.addEventListener('DOMContentLoaded', () => {
    initSiteChrome({ active: 'foryou' });

    const page = document.getElementById('ftPage');
    if (!page) return;
    const notes = readNotes();
    const params = new URLSearchParams(window.location.search);
    const forceStory = params.has('story');
    const forceExplore = params.has('explore');

    let unbindSky = null;

    function showExplore({ fromStory } = {}) {
      if (unbindSky) unbindSky();
      const sky = buildSky();
      const palette = readPalette();
      const explore = buildExplore(stats, notes, {
        birthday: HER_BIRTHDAY,
        palette,
        onPalette: (v) => {
          savePalette(v);
          document.body.dataset.palette = v;
          sky.hidden = v === 'pink';
          window.dispatchEvent(new Event('scroll'));
        },
        onReplay: () => { window.scrollTo(0, 0); showStory(); },
      });
      document.body.dataset.palette = palette;
      sky.hidden = palette === 'pink';
      page.replaceChildren(sky, explore);
      unbindSky = bindSkyToScroll(sky, explore);
      if (fromStory) window.scrollTo(0, 0);
    }

    function showStory() {
      const story = buildStory(stats, notes, {
        birthday: HER_BIRTHDAY,
        palette: readPalette(),
        onPalette: (v) => { savePalette(v); document.body.dataset.palette = v; },
        onDone: () => { markSeen(); showExplore({ fromStory: true }); },
        onSkip: () => { markSeen(); showExplore({ fromStory: true }); },
      });
      // Everything sits underneath so the stage can fade into it.
      if (!page.querySelector('.ft-explore')) showExplore();
      document.body.appendChild(story.el);
      story.start();
    }

    if (forceExplore || (readSeen() && !forceStory)) showExplore();
    else showStory();
  });
}
