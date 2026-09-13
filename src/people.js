import './styles/base.css';
import './styles/sections.css';
import './styles/animations.css';
import './styles/ui.css';
import './styles/people.css';

import { initSiteChrome } from './modules/siteChrome.js';
import { initReveal } from './modules/reveal.js';

document.addEventListener('DOMContentLoaded', () => {
  initSiteChrome({ active: 'foryou' });
  requestAnimationFrame(() => setTimeout(() => initReveal(), 50));
});
