# Adding a page — the checklist

There is no router and no templating. Every page is a real `.html` file at the repo root plus a
Vite entry. Forgetting step 2 is the classic mistake: the page works in `npm run dev` and 404s in
production.

1. **Create `<name>.html` at the repo root.** Copy `foryou.html` and change the `<title>`,
   `<meta name="description">`, and the script `src`. Keep the `<head>` otherwise verbatim — fonts,
   favicon, viewport and the **CSP `<meta>` must stay in HTML** (a CSP set from JS is not enforced,
   and fonts must not wait on JS). The body needs only:

   ```html
   <nav class="site-nav" id="siteNav"></nav>       <!-- filled by siteChrome -->
   <main class="<name>-page"> … </main>
   <footer class="site-footer" id="siteFooter"></footer>   <!-- optional -->
   <div id="siteMusic"></div>                     <!-- optional; omit on pages that should be silent -->
   <script type="module" src="/src/<name>.js"></script>
   ```

2. **Add the entry to `rollupOptions.input` in `vite.config.js`:**
   `<name>: resolve(__dirname, '<name>.html')`.

3. **Create `src/<name>.js`.** Import, in this order: `base.css`, `sections.css`, `animations.css`,
   `ui.css`, then the page's own `src/styles/<name>.css`. Then:

   ```js
   import { initSiteChrome } from './modules/siteChrome.js';
   import { initReveal } from './modules/reveal.js';
   document.addEventListener('DOMContentLoaded', () => {
     initSiteChrome({ active: '<nav id or undefined>' });
     // … render the page …
     requestAnimationFrame(() => setTimeout(() => initReveal(), 50));
   });
   ```

   Local data goes through `createStore()` in `src/modules/storage.js` (keys are namespaced
   `usm.<name>.v<version>` automatically). Calendar math goes through `src/modules/dates.js`.

4. **Link it.** Top-level section → one entry in `NAV_LINKS` in `src/modules/siteChrome.js`.
   Tool page → flip `comingSoon: false` on its card in `src/foryou.js` (or add a card).
   The hidden anniversary page is deliberately in neither.

5. **New network host?** Add it to `connect-src` in the CSP `<meta>` of **every** HTML file — they
   must stay identical — and record the host in `DOCS.md` → Security → Content Security Policy.
   No new page should import `src/modules/firebase.js` except `letters.html` (analytics fires on
   import, and the SDK is ~120 kB gzipped).

6. `npm run build`, then confirm `dist/<name>.html` exists.

7. `npm run preview` and open `http://localhost:4173/lovesite/<name>.html`. The `/lovesite/` base
   path is where broken links usually hide — all internal links are `./x.html`, never `/x.html`.

8. Check at 375px: the bottom tab bar covers the last 58px of the viewport. Anything you pin to the
   bottom of the screen needs `bottom: calc(var(--site-tabs-height) + env(safe-area-inset-bottom))`
   inside the `@media (max-width: 600px)` block (see how `.music-toggle` is handled in `sections.css`).
