/**
 * letterSource.js — the ONLY module that touches letter bytes / letter URLs.
 *
 * The archive page is still passcode-gated. The PDF bytes themselves are public
 * on purpose: authenticated getBlob() was too slow/fragile for multi-MB letters
 * on her phone. A guessable URL is an acceptable trade for a drawer that opens.
 *
 * Production: Firebase Storage `letters/<file>` with public read.
 * Local dev: Vite serves the gitignored `letters-source/` folder.
 *
 * Prefer `letterPublicUrl()` for PDFs so pdf.js can stream pages (range requests)
 * instead of waiting for the whole file to download into a Blob first.
 */

import { letters } from '../data/letters.js';

const BUCKET = 'lovesite-1540e.firebasestorage.app';
const DEV_DIR = `${import.meta.env.BASE_URL}letters-source/`;

/**
 * @param {string} file
 * @returns {string}
 */
export function letterPublicUrl(file) {
  if (import.meta.env.DEV) {
    return DEV_DIR + encodeURIComponent(file);
  }
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(`letters/${file}`)}?alt=media`;
}

/**
 * Metadata for every letter.
 * @returns {Promise<import('../data/letters.js').Letter[]>}
 */
export async function getLetterList() {
  return letters.map((letter) => ({ ...letter }));
}

/**
 * The bytes of one letter (text bodies / rare cases). PDFs should use
 * letterPublicUrl() so the viewer can stream.
 * @param {string} id
 * @returns {Promise<Blob>}
 */
export async function getLetterBlob(id) {
  const letter = letters.find((l) => l.id === id);
  if (!letter || !letter.file) throw new Error('Unknown letter');

  const res = await fetch(letterPublicUrl(letter.file), { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Letter fetch failed (${res.status})`);
  return res.blob();
}
