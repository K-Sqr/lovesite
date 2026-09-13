/**
 * siteChrome.js — the one place the site's chrome is defined.
 *
 *   initSiteChrome({ active: 'home' | 'story' | 'memories' | 'lovegpt' | 'foryou' })
 *
 * Renders into mount points every page carries in its HTML:
 *   <nav class="site-nav" id="siteNav"></nav>   top bar (brand, links, theme toggle)
 *   <div id="siteMusic"></div>                  music toggle + <audio>   (optional)
 *   <footer class="site-footer" id="siteFooter"></footer>   "Made with ♥" (optional)
 * plus a bottom tab bar (`.site-tabs`) appended to <body>, shown only ≤600px.
 *
 * Adding a top-level section = one entry in NAV_LINKS. Nothing else.
 * The CSP and the font <link> stay in each HTML head on purpose (see PAGE-CHECKLIST.md).
 */

import { initTheme } from './theme.js';
import { initMusicPlayer } from './musicPlayer.js';

/** @type {{ id: string, label: string, href: string, icon: string }[]} */
export const NAV_LINKS = [
  { id: 'home',     label: 'Home',      href: './index.html',    icon: '\u{1F3E0}' }, // 🏠
  { id: 'story',    label: 'Our Story', href: './timeline.html', icon: '\u{1F4D6}' }, // 📖
  { id: 'memories', label: 'Memories',  href: './memories.html', icon: '\u{1F4F7}' }, // 📷
  { id: 'lovegpt',  label: 'LoveGPT',   href: './lovegpt.html',  icon: '\u{2728}' },  // ✨
  { id: 'foryou',   label: 'For You',   href: './foryou.html',   icon: '\u{1F49D}' }, // 💝
];

const BRAND = { label: '♥ Us Machina', href: './index.html' }; // ♥
const MUSIC_SRC = './music/Venus (Bass Version).mp3';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children) node.appendChild(child);
  return node;
}

function renderNav(active) {
  const nav = document.getElementById('siteNav');
  if (!nav) return;
  nav.classList.add('site-nav');
  nav.setAttribute('aria-label', 'Site');
  nav.replaceChildren(
    el('a', { href: BRAND.href, class: 'nav-brand', text: BRAND.label }),
    ...NAV_LINKS.map((link) => el('a', {
      href: link.href,
      class: link.id === active ? 'nav-link active' : 'nav-link',
      'aria-current': link.id === active ? 'page' : null,
      text: link.label,
    })),
    el('button', { type: 'button', class: 'theme-toggle', 'aria-label': 'Toggle theme', text: '\u{1F319}' }),
  );
}

function renderTabs(active) {
  if (document.getElementById('siteTabs')) return;
  const tabs = el('nav', { id: 'siteTabs', class: 'site-tabs', 'aria-label': 'Sections' },
    NAV_LINKS.map((link) => el('a', {
      href: link.href,
      class: 'site-tab',
      'aria-current': link.id === active ? 'page' : null,
    }, [
      el('span', { class: 'site-tab__icon', 'aria-hidden': 'true', text: link.icon }),
      el('span', { class: 'site-tab__label', text: link.label }),
    ])),
  );
  document.body.appendChild(tabs);
}

function renderMusic() {
  const mount = document.getElementById('siteMusic');
  if (!mount || document.getElementById('bgMusic')) return;
  const source = el('source', { src: MUSIC_SRC, type: 'audio/mpeg' });
  mount.replaceChildren(
    el('button', { type: 'button', class: 'music-toggle', id: 'musicToggle', 'aria-label': 'Toggle music', text: '\u{1F507}' }),
    el('audio', { id: 'bgMusic', preload: 'none' }, [source]),
  );
}

function renderFooter() {
  const footer = document.getElementById('siteFooter');
  if (!footer || footer.childElementCount) return;
  const p = el('p');
  p.append('Made with ', el('span', { class: 'heart-icon', text: '♥' }), ' and a little bit of code');
  footer.appendChild(p);
}

/**
 * @param {{ active?: string }} [options]
 */
export function initSiteChrome({ active } = {}) {
  renderNav(active);
  renderTabs(active);
  renderMusic();
  renderFooter();
  initTheme();
  initMusicPlayer();
}
