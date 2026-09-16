/**
 * pdfPages.js — draw a PDF as a stack of pages, the way a letter reads.
 *
 * Why not an <iframe>: iOS Safari (and so every browser on an iPhone) paints a
 * PDF in a frame as a single, non-scrollable first page, and Android Chrome
 * refuses to paint one inline at all. She only ever saw page one. Rendering
 * with pdf.js onto canvases works the same everywhere.
 *
 * Memory: a 77-page letter would be ~250 MB of canvases on a phone, so pages
 * are placeholders sized to the right aspect ratio and only drawn while near
 * the viewport; ones that scroll well away are released and redrawn on return.
 *
 * pdf.js is loaded on demand — nothing on the archive view pays for it.
 * The worker is a same-origin asset, so the existing CSP (default-src 'self')
 * covers it; the PDF itself is fetched from a host already in connect-src.
 */

/** Render at most this many device pixels per CSS pixel — retina-sharp, not wasteful. */
const MAX_DPR = 2;
/** Draw pages within this margin of the viewport; release beyond it. */
const NEAR = '150% 0px';
/** Fallback aspect for placeholders before a page is measured (US Letter). */
const DEFAULT_ASPECT = 11 / 8.5;

let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/**
 * @typedef {object} PdfPagesController
 * @property {() => void} destroy   cancels everything; safe to call twice
 * @property {() => void} refresh   redraw the pages on screen (after a zoom / layout change)
 * @property {number} numPages
 */

/**
 * @param {HTMLElement} mount   emptied and filled with .pdf-page elements
 * @param {string} url
 * @param {{ onPage?: (current: number, total: number) => void }} [hooks]
 *   onPage fires when the page occupying most of the viewport changes.
 * @returns {Promise<PdfPagesController>}
 */
export async function renderPdfPages(mount, url, hooks = {}) {
  let alive = true;
  /** @type {Map<number, { holder: HTMLElement, canvas: HTMLCanvasElement|null, task: any, drawnWidth: number }>} */
  const pages = new Map();
  const visible = new Set();
  /** Visible fraction per page, for the "current page" readout. */
  const ratios = new Map();
  let current = 0;
  let observer = null;
  let currentObserver = null;
  let doc = null;
  let loadingTask = null;
  let resizeTimer = null;

  const destroy = () => {
    if (!alive) return;
    alive = false;
    if (observer) observer.disconnect();
    if (currentObserver) currentObserver.disconnect();
    window.removeEventListener('resize', onResize);
    clearTimeout(resizeTimer);
    for (const page of pages.values()) release(page);
    pages.clear();
    if (loadingTask) loadingTask.destroy().catch(() => {});
    doc = null;
  };

  const refresh = () => {
    if (!alive) return;
    for (const n of visible) {
      const page = pages.get(n);
      if (page && page.drawnWidth !== page.holder.clientWidth) draw(n);
    }
  };

  const controller = { destroy, refresh, numPages: 0 };

  const pdfjs = await loadPdfjs();
  if (!alive) return controller;

  loadingTask = pdfjs.getDocument({ url });
  doc = await loadingTask.promise;
  if (!alive) return controller;
  controller.numPages = doc.numPages;

  // Size every placeholder from page 1 so the scrollbar is honest from the start;
  // each page corrects its own aspect the first time it is drawn.
  const first = await doc.getPage(1);
  if (!alive) return controller;
  const aspect = aspectOf(first.getViewport({ scale: 1 }));

  mount.replaceChildren();
  for (let n = 1; n <= doc.numPages; n += 1) {
    const holder = document.createElement('div');
    holder.className = 'pdf-page';
    holder.style.aspectRatio = `1 / ${aspect}`;
    holder.setAttribute('aria-label', `Page ${n} of ${doc.numPages}`);
    holder.dataset.page = String(n);
    mount.appendChild(holder);
    pages.set(n, { holder, canvas: null, task: null, drawnWidth: 0 });
  }

  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const n = Number(entry.target.dataset.page);
      if (entry.isIntersecting) {
        visible.add(n);
        draw(n);
      } else {
        visible.delete(n);
        release(pages.get(n));
      }
    }
  }, { rootMargin: NEAR });
  for (const { holder } of pages.values()) observer.observe(holder);

  // "Page 3 of 7": whichever page shows the most of itself right now.
  if (hooks.onPage) {
    currentObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) ratios.set(Number(entry.target.dataset.page), entry.intersectionRatio);
      let best = current;
      let bestRatio = -1;
      for (const [n, ratio] of ratios) {
        if (ratio > bestRatio) {
          best = n;
          bestRatio = ratio;
        }
      }
      if (best !== current && bestRatio > 0) {
        current = best;
        hooks.onPage(current, doc.numPages);
      }
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    for (const { holder } of pages.values()) currentObserver.observe(holder);
  }

  window.addEventListener('resize', onResize);

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refresh, 200);
  }

  async function draw(n) {
    const page = pages.get(n);
    if (!page || !alive || !doc) return;
    const cssWidth = page.holder.clientWidth;
    if (!cssWidth) return;
    if (page.task) {
      if (page.drawnWidth === cssWidth) return;
      page.task.cancel();
      page.task = null;
    }
    page.drawnWidth = cssWidth;

    let pdfPage;
    try {
      pdfPage = await doc.getPage(n);
    } catch (err) {
      return;
    }
    if (!alive || !visible.has(n) || page.drawnWidth !== cssWidth) return;

    const base = pdfPage.getViewport({ scale: 1 });
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const viewport = pdfPage.getViewport({ scale: (cssWidth / base.width) * dpr });
    page.holder.style.aspectRatio = `1 / ${aspectOf(base)}`;

    const canvas = page.canvas || document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    if (!page.canvas) {
      page.canvas = canvas;
      page.holder.appendChild(canvas);
    }

    const task = pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport });
    page.task = task;
    try {
      await task.promise;
    } catch (err) {
      // RenderingCancelledException on release/resize — expected, nothing to do.
    } finally {
      if (page.task === task) page.task = null;
    }
  }

  function release(page) {
    if (!page) return;
    if (page.task) {
      page.task.cancel();
      page.task = null;
    }
    if (page.canvas) {
      // Zero the bitmap so the memory goes now, not at the next GC.
      page.canvas.width = 0;
      page.canvas.height = 0;
      page.canvas.remove();
      page.canvas = null;
    }
    page.drawnWidth = 0;
  }

  return controller;
}

function aspectOf(viewport) {
  return viewport.width > 0 ? viewport.height / viewport.width : DEFAULT_ASPECT;
}
