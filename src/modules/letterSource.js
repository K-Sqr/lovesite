/**
 * letterSource.js — the ONLY module that touches letter bytes.
 *
 * Production: authenticated Firebase Storage via getBlob(). The Storage rule
 * (storage.rules, letters/{fileName}) is evaluated server-side against the
 * signed-in UID (owner | tolu). Nothing is readable without that.
 *
 * Local dev: Vite serves the gitignored letters-source/ folder so the reading
 * room can be built without a Storage round-trip. That folder is never copied
 * into dist/ or public/ — GitHub Pages cannot authenticate a byte, so anything
 * reachable by the built site is public. Never move, copy, or symlink it there.
 *
 * Rules (06-LETTERS R6):
 *   • never mint a download URL (the SDK's getDownload… helper) — its output
 *     is a bearer token that bypasses the Storage rule forever
 *   • return a Blob, never a URL; the caller creates and revokes blob:
 *   • fetch on demand, one letter at a time; never prefetch the archive
 */

import { getBlob, ref } from 'firebase/storage';
import { storage } from './firebase.js';
import { letters } from '../data/letters.js';

// Vite base is required: without it the dev URL resolves to /letters-source/… and 404s.
const SOURCE_DIR = `${import.meta.env.BASE_URL}letters-source/`;

function storagePath(file) {
  return `letters/${file}`;
}

async function blobFromDevServer(file) {
  const res = await fetch(SOURCE_DIR + encodeURIComponent(file), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Letter fetch failed (${res.status})`);
  return res.blob();
}

/**
 * Metadata for every letter. Async so a Storage-backed list can land later
 * without the page changing.
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

  if (import.meta.env.DEV) {
    return blobFromDevServer(letter.file);
  }

  return getBlob(ref(storage, storagePath(letter.file)));
}
