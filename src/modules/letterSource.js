/**
 * letterSource.js — the ONLY module that touches letter bytes.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  LOCAL DEV IMPLEMENTATION — NOT THE PRODUCTION DATA PATH.                │
 * │                                                                          │
 * │  Letters are read from `letters-source/` at the project root. That      │
 * │  folder is gitignored and is served ONLY by Vite's dev server, at        │
 * │  `${import.meta.env.BASE_URL}letters-source/<file>` (→ /lovesite/…).    │
 * │  `npm run build` does not copy it into dist/, so the deployed site 404s  │
 * │  on every letter — and that is the point. GitHub Pages cannot            │
 * │  authenticate a byte: anything reachable by the built site is public.   │
 * │  Letters must NEVER be deployed from here. Never move, copy, or symlink  │
 * │  letters-source/ into public/ or dist/.                                  │
 * │                                                                          │
 * │  The real implementation is authenticated Firebase Storage, per          │
 * │  docs/anniversary/03-SECURITY-REMEDIATION.md §5–6:                       │
 * │      getBlob(ref(storage, `letters/${letter.file}`))                     │
 * │  rule-checked server-side against the signed-in UID, no URL minted.     │
 * │  Swapping to it is a change to THIS FILE ONLY — src/letters.js sees      │
 * │  nothing but `getLetterList()` and `getLetterBlob(id)`.                  │
 * │                                                                          │
 * │  Rules that survive the swap (06-LETTERS R6):                            │
 * │    • never mint a download URL (the SDK's getDownload… helper) — its    │
 * │      output is a bearer token that bypasses the Storage rule forever    │
 * │    • return a Blob, never a URL; the caller creates and revokes blob:    │
 * │    • fetch on demand, one letter at a time; never prefetch the archive   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { letters } from '../data/letters.js';

// Vite base is required: without it the dev URL resolves to /letters-source/… and 404s.
const SOURCE_DIR = `${import.meta.env.BASE_URL}letters-source/`;

/**
 * Metadata for every letter. Async so the Storage-backed version can list
 * objects (or stay static) without the page changing.
 * @returns {Promise<import('../data/letters.js').Letter[]>}
 */
export async function getLetterList() {
  return letters.map((letter) => ({ ...letter }));
}

/**
 * The bytes of one letter, fetched now, for this view only.
 * @param {string} id
 * @returns {Promise<Blob>}
 */
export async function getLetterBlob(id) {
  const letter = letters.find((l) => l.id === id);
  if (!letter || !letter.file) throw new Error('Unknown letter');

  // no-store: the letter lives in memory for this view, not in the HTTP cache.
  const res = await fetch(SOURCE_DIR + encodeURIComponent(letter.file), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Letter fetch failed (${res.status})`);
  return res.blob();
}
