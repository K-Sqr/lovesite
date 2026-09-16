/**
 * cloudSync.js — keeps the For You plain stores in step across devices.
 *
 * Each plain store (storage.js createStore) is mirrored to one Firestore
 * document, `foryou/<storeName>`, holding the very same envelope that sits in
 * localStorage: { v, updatedAt, data }. On a page:
 *
 *   1. sign in once per device with the site passcode (remembered),
 *   2. pull: if the shared envelope is newer than this device's, adopt it;
 *      if this device's is newer (or the shared one is missing), push it,
 *   3. keep listening: a change saved on another device lands here live,
 *      and every local write is pushed as it happens.
 *
 * "Newer" is the envelope's own `updatedAt` (ISO, so string comparison works).
 * The whole envelope wins or loses — there is no per-record merge — which is
 * fine at the write rates these pages see, and the live listener means an open
 * page is rarely more than a second behind. Nothing is pushed until the server
 * has said what it holds, so a device that comes back from offline can never
 * blindly overwrite newer entries with stale ones.
 *
 * Wardrobe photos are the one non-envelope thing: a Firebase Storage adapter
 * (wardrobePhotoCloud) is handed to wardrobeStore so the closet's photos
 * follow the closet. Firestore and Storage access are gated by rules to the
 * signed-in site passcode (uid 'owner').
 */

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getBlob, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase.js';
import { whenAuthReady, authenticateWithPasscode } from './auth.js';

export const COLLECTION = 'foryou';

/** The only console output in this module. Never pass it data. */
function warn(message, err) {
  if (err !== undefined) console.warn(`[cloudSync] ${message}`, err);
  else console.warn(`[cloudSync] ${message}`);
}

const COPY = {
  signInLead: 'Keep this in step across your devices',
  signInHint: 'Type the site passcode once on this device — the same one as the Letters page. What you add here then shows up on her phone, her laptop, and yours.',
  signInLabel: 'Site passcode',
  signInButton: 'Continue',
  signingIn: 'Signing in…',
  wrong: "That's not it. Try again.",
  empty: 'Type the site passcode to continue.',
  checking: 'Checking for the latest…',
  ok: 'Shared across your devices.',
  saving: 'Saving to the shared copy…',
  offline: "Couldn't reach the shared copy. Saved here for now — it'll catch up when the connection is back.",
  updated: 'Updated with what was saved on another device.',
};

/* ─────────────────────────────── envelopes ─────────────────────────────── */

function looksLikeEnvelope(env) {
  return !!env && typeof env === 'object' && Number.isInteger(env.v) && typeof env.updatedAt === 'string' && 'data' in env;
}

/** True when `a` should replace `b`. A missing side always loses to a present one. */
export function isNewer(a, b) {
  if (!a) return false;
  if (!b) return true;
  return String(a.updatedAt || '') > String(b.updatedAt || '');
}

function docFor(store) {
  return doc(db, COLLECTION, store.name);
}

/**
 * Mirror one plain store. Returns a handle with stop().
 * @param {ReturnType<import('./storage.js').createStore>} store
 * @param {{ onStatus?: (s: 'checking'|'ok'|'saving'|'offline'|'updated') => void }} [opts]
 */
export function syncStore(store, { onStatus } = {}) {
  const st = { remote: null, primed: false, pushing: false, stopped: false, unwatch: null, unsubscribe: null };
  const status = (s) => { if (onStatus) { try { onStatus(s); } catch (err) { warn('status listener threw', err); } } };

  async function push() {
    if (st.stopped || !st.primed) return;
    const env = store.envelope();
    if (!isNewer(env, st.remote)) { status('ok'); return; }
    if (st.pushing) return; // re-checked once this one lands
    st.pushing = true;
    status('saving');
    try {
      await setDoc(docFor(store), { v: env.v, updatedAt: env.updatedAt, data: env.data });
      st.remote = env;
      status('ok');
    } catch (err) {
      warn(`push failed for ${store.name}`, err && err.code);
      status('offline');
    } finally {
      st.pushing = false;
    }
    if (!st.stopped && isNewer(store.envelope(), st.remote)) push();
  }

  function adopt(env) {
    try {
      store.adopt(env);
      return true;
    } catch (err) {
      warn(`could not adopt shared ${store.name}`, err && err.code);
      return false;
    }
  }

  function onRemote(env) {
    if (st.stopped) return;
    st.primed = true;
    if (env) st.remote = env;
    if (env && isNewer(env, store.envelope())) {
      if (adopt(env)) status('updated');
      return;
    }
    push();
  }

  async function start() {
    status('checking');
    try {
      const snap = await getDoc(docFor(store));
      const env = snap.exists() ? snap.data() : null;
      onRemote(looksLikeEnvelope(env) ? env : null);
    } catch (err) {
      warn(`pull failed for ${store.name}`, err && err.code);
      status('offline');
    }
    if (st.stopped) return;
    st.unsubscribe = store.subscribe(() => push());
    st.unwatch = onSnapshot(
      docFor(store),
      (snap) => {
        if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return; // our own write, or nothing new from the server
        const env = snap.exists() ? snap.data() : null;
        onRemote(looksLikeEnvelope(env) ? env : null);
      },
      (err) => { warn(`listener dropped for ${store.name}`, err && err.code); status('offline'); },
    );
  }

  function stop() {
    st.stopped = true;
    if (st.unwatch) st.unwatch();
    if (st.unsubscribe) st.unsubscribe();
    st.unwatch = st.unsubscribe = null;
  }

  start();
  return { stop, push };
}

/* ─────────────────────────────── wardrobe photos ─────────────────────────────── */

/**
 * Photo adapter for wardrobeStore.setPhotoCloud(): one JPEG per item under
 * wardrobe/<photoId>.jpg in Firebase Storage. The store keeps IndexedDB as the
 * cache and asks here only when a photo is missing locally.
 */
export const wardrobePhotoCloud = {
  async put(photoId, blob) {
    await uploadBytes(storageRef(storage, `wardrobe/${photoId}.jpg`), blob, { contentType: blob.type || 'image/jpeg' });
  },
  async get(photoId) {
    try {
      return await getBlob(storageRef(storage, `wardrobe/${photoId}.jpg`));
    } catch (err) {
      if (err && err.code !== 'storage/object-not-found') warn('photo download failed', err.code);
      return null;
    }
  },
  async delete(photoId) {
    try {
      await deleteObject(storageRef(storage, `wardrobe/${photoId}.jpg`));
    } catch (err) {
      if (err && err.code !== 'storage/object-not-found') throw err;
    }
  },
};

/* ─────────────────────────────── the strip ─────────────────────────────── */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c) node.appendChild(c);
  return node;
}

/**
 * One line under a page header: a passcode field until this device is signed
 * in, then a quiet status sentence. Local use never waits on it.
 * @param {{ stores: object[], after?: HTMLElement|null, onSignedIn?: () => void }} options
 *   stores     plain stores to mirror (each module exports its own list)
 *   after      element to insert the strip after (default: the page's main > header)
 *   onSignedIn called once sync is running (e.g. to hand wardrobeStore the photo adapter)
 * @returns {{ stop: () => void }}
 */
export function initCloudSync({ stores, after = null, onSignedIn = null }) {
  const anchor = after || document.querySelector('main > header');
  const strip = el('div', { class: 'usm-sync', role: 'status' });
  if (anchor) anchor.insertAdjacentElement('afterend', strip);

  /** @type {{ stop: () => void, push: () => void }[]} */
  const handles = [];
  const statuses = new Map();
  let updatedTimer = null;

  function renderStatus() {
    const all = [...statuses.values()];
    let text;
    if (all.includes('offline')) text = COPY.offline;
    else if (all.includes('checking')) text = COPY.checking;
    else if (all.includes('saving')) text = COPY.saving;
    else if (all.includes('updated')) text = COPY.updated;
    else text = COPY.ok;
    strip.replaceChildren(el('p', { class: 'usm-sync__line', text }));
  }

  function start() {
    if (onSignedIn) { try { onSignedIn(); } catch (err) { warn('onSignedIn threw', err); } }
    for (const store of stores) {
      handles.push(syncStore(store, {
        onStatus: (s) => {
          statuses.set(store.name, s);
          renderStatus();
          if (s === 'updated') {
            clearTimeout(updatedTimer);
            updatedTimer = setTimeout(() => { statuses.set(store.name, 'ok'); renderStatus(); }, 6000);
          }
        },
      }));
    }
    window.addEventListener('online', () => handles.forEach((h) => h.push()));
  }

  function renderSignIn() {
    const id = 'usmSyncCode';
    const input = el('input', {
      type: 'password', class: 'usm-input', id, autocomplete: 'off', spellcheck: 'false',
      autocapitalize: 'off', autocorrect: 'off', placeholder: '••••••••',
      'aria-describedby': 'usmSyncHint',
    });
    const error = el('p', { class: 'usm-field__error', 'aria-live': 'polite' });
    const btn = el('button', { type: 'button', class: 'usm-btn usm-btn--secondary', text: COPY.signInButton });
    const details = el('details', { class: 'usm-sync__signin' }, [
      el('summary', { text: COPY.signInLead }),
      el('p', { class: 'usm-sync__hint', id: 'usmSyncHint', text: COPY.signInHint }),
      el('div', { class: 'usm-sync__form' }, [
        el('label', { class: 'sr-only', for: id, text: COPY.signInLabel }),
        input,
        btn,
      ]),
      error,
    ]);

    async function submit() {
      if (btn.disabled) return;
      const passcode = input.value.trim();
      input.value = '';
      if (!passcode) { error.textContent = COPY.empty; input.focus(); return; }
      error.textContent = '';
      btn.disabled = true;
      input.disabled = true;
      btn.textContent = COPY.signingIn;
      let ok = false;
      try {
        ok = await authenticateWithPasscode(passcode, { remember: true });
      } catch (err) {
        warn('sign-in failed', err);
      }
      btn.disabled = false;
      input.disabled = false;
      btn.textContent = COPY.signInButton;
      if (!ok) { error.textContent = COPY.wrong; input.focus(); return; }
      start();
    }
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    strip.replaceChildren(details);
  }

  whenAuthReady().then((signedIn) => {
    if (signedIn) start();
    else renderSignIn();
  });

  return { stop: () => handles.forEach((h) => h.stop()) };
}
