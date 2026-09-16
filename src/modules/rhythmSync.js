/**
 * rhythmSync.js — keeps the Rhythm ciphertext in step across devices.
 *
 * One Firestore document, `rhythm/shared`, holds the same encrypted envelope
 * that rhythmStore keeps in localStorage: { v, alg, kdf, iterations, salt, iv,
 * ciphertext, updatedAt }. That is ALL this module ever sends or receives. The
 * passphrase never comes near it, so the server (and anyone reading the
 * database) sees only AES-GCM ciphertext. Whoever holds the passphrase can
 * open the same entries on her phone, her laptop, and his.
 *
 * Reads and writes are gated by Firestore rules to the signed-in site
 * passcode (uid 'owner'); rhythm.js signs in before calling anything here.
 *
 * Freshness is decided by the envelope's own `updatedAt` (an ISO string, so
 * plain string comparison works): the newer envelope wins, whichever side it
 * is on. Writes are rare — a few a month — so last-write-wins at the envelope
 * level is enough, and the live listener keeps an open page current so a
 * stale write over someone else's entry is very unlikely.
 */

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';

export const COLLECTION = 'rhythm';
export const DOC_ID = 'shared';

const FIELDS = ['v', 'alg', 'kdf', 'iterations', 'salt', 'iv', 'ciphertext', 'updatedAt'];

function ref() {
  return doc(db, COLLECTION, DOC_ID);
}

/** Only the envelope fields, in a fixed shape the rules can check. */
function pick(env) {
  const out = {};
  for (const f of FIELDS) if (env[f] !== undefined) out[f] = env[f];
  return out;
}

function looksLikeEnvelope(env) {
  return !!env && env.alg === 'AES-GCM' && typeof env.salt === 'string' && typeof env.iv === 'string'
    && typeof env.ciphertext === 'string' && Number.isInteger(env.iterations) && Number.isInteger(env.v)
    && typeof env.updatedAt === 'string';
}

/** True when `a` should replace `b`. A missing side always loses to a present one. */
export function isNewer(a, b) {
  if (!a) return false;
  if (!b) return true;
  return String(a.updatedAt || '') > String(b.updatedAt || '');
}

/**
 * The shared envelope, or null when none has been written yet.
 * Rejects on permission or network failure — the caller decides what "offline" means.
 */
export async function pull() {
  const snap = await getDoc(ref());
  if (!snap.exists()) return null;
  const data = snap.data();
  return looksLikeEnvelope(data) ? data : null;
}

/** Upload this device's envelope as the shared one. Resolves once the server has it. */
export async function push(env) {
  if (!looksLikeEnvelope(env)) throw new Error('not an envelope');
  await setDoc(ref(), pick(env));
}

/**
 * Listen for the shared envelope changing. `onRemote(env)` fires with the
 * server's copy (never a local, unacknowledged write); `onError(err)` when the
 * listener drops (permission, network).
 * @returns {() => void} stop listening
 */
export function watch(onRemote, onError) {
  return onSnapshot(
    ref(),
    (snap) => {
      if (snap.metadata.hasPendingWrites) return; // our own write echoing back
      const data = snap.exists() ? snap.data() : null;
      onRemote(looksLikeEnvelope(data) ? data : null);
    },
    (err) => { if (onError) onError(err); },
  );
}
