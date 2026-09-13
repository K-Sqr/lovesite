/**
 * storage.js — namespaced local persistence for the For You tools.
 *
 *   createStore(name, { version, migrate, initial })            → sync store (localStorage)
 *   createStore(name, { version, migrate, initial, encrypted }) → async store (AES-GCM, passphrase)
 *   createBlobStore(name)                                       → async IndexedDB blob store
 *
 * Contract (04-SHARED-FOUNDATIONS R3):
 *   • Every key is `usm.<name>.v<version>` — the k-sqr.github.io origin is shared
 *     with every other Pages site, so nothing is ever stored un-namespaced.
 *   • On disk: { v, updatedAt, data }. Never a bare payload.
 *   • Fail soft. localStorage throws in Safari private mode and on a full quota.
 *     Every access is wrapped; a failed write keeps the value in memory for the
 *     session and shows ONE calm banner. What she typed is never thrown away.
 *   • This module never sends anything anywhere. No fetch, no beacon.
 *
 * Encrypted stores (R3b) keep the passphrase and derived CryptoKey in closure
 * variables only. Nothing about the passphrase — not a hash, not a hint — is
 * ever written to storage. A wrong passphrase is detected purely by AES-GCM
 * authentication failing. Forgetting the passphrase means the data is gone;
 * the UI that sets one up has to say so.
 */

const NS = 'usm';
const PBKDF2_ITERATIONS = 310_000; // ≥ 250k per spec
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** One small helper — the only place this module talks to the console. */
function warn(message, err) {
  if (err !== undefined) console.warn(`[storage] ${message}`, err);
  else console.warn(`[storage] ${message}`);
}

export class StorageError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

/* ─────────────────────────── fail-soft primitives ─────────────────────────── */

let bannerShown = false;

/** A single, calm banner. Requires ui.css on the page for styling; degrades to plain text. */
function showStorageBanner() {
  if (bannerShown || typeof document === 'undefined' || !document.body) return;
  bannerShown = true;
  const el = document.createElement('div');
  el.className = 'usm-banner';
  el.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = "Saving isn't working in this browser right now — what you write stays here until you close the tab.";
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'usm-toast__close';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  close.addEventListener('click', () => el.remove());
  el.append(text, close);
  document.body.appendChild(el);
}

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    warn('localStorage read failed', err);
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    warn('localStorage write failed', err);
    showStorageBanner();
    return false;
  }
}

function safeRemove(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (err) {
    warn('localStorage remove failed', err);
    return false;
  }
}

function clone(value) {
  if (value === null || value === undefined) return value;
  try {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function keyFor(name, version) {
  return `${NS}.${name}.v${version}`;
}

function parseEnvelope(raw) {
  try {
    const env = JSON.parse(raw);
    if (env && typeof env === 'object' && typeof env.v === 'number') return env;
  } catch (err) {
    warn('stored value is not a valid envelope', err);
  }
  return null;
}

/**
 * Look for an older schema version of this store on disk.
 * @returns {{ key: string, env: object } | null}
 */
function findOlderVersion(name, version) {
  for (let v = version - 1; v >= 1; v--) {
    const k = keyFor(name, v);
    const raw = safeGet(k);
    if (raw === null) continue;
    const env = parseEnvelope(raw);
    if (env) return { key: k, env };
  }
  return null;
}

function validateName(name) {
  if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(name)) {
    throw new StorageError(`Store name "${name}" must be a simple identifier`, 'bad-name');
  }
}

/* ────────────────────────────── plain store ────────────────────────────── */

/**
 * @template T
 * @param {string} name
 * @param {{ version?: number, migrate?: (oldData: any, oldVersion: number) => T, initial?: T, encrypted?: boolean }} [options]
 */
export function createStore(name, options = {}) {
  validateName(name);
  const { version = 1, migrate, initial = null, encrypted = false } = options;
  if (!Number.isInteger(version) || version < 1) {
    throw new StorageError('version must be a positive integer', 'bad-version');
  }
  if (encrypted) return createEncryptedStore(name, { version, migrate, initial });

  const key = keyFor(name, version);
  const listeners = new Set();
  /** Last envelope we know about. Survives a failed write. */
  let cache = null;
  /** True while the in-memory value is newer than what is on disk (a write failed). */
  let dirty = false;

  function notify() {
    const value = read();
    listeners.forEach((fn) => {
      try { fn(value); } catch (err) { warn('subscriber threw', err); }
    });
  }

  function persist(data) {
    const env = { v: version, updatedAt: new Date().toISOString(), data };
    cache = env;
    const ok = safeSet(key, JSON.stringify(env));
    dirty = !ok;
    return ok;
  }

  function runMigration(oldData, oldVersion) {
    if (typeof migrate !== 'function') {
      warn(`no migrate() for ${name} v${oldVersion} → v${version}; starting fresh`);
      return clone(initial);
    }
    try {
      return migrate(oldData, oldVersion);
    } catch (err) {
      warn(`migrate() for ${name} threw; keeping old data`, err);
      return oldData;
    }
  }

  function read() {
    // An unsaved value in memory is newer than anything on disk — never lose it.
    if (dirty && cache) return clone(cache.data);

    const raw = safeGet(key);
    if (raw !== null) {
      const env = parseEnvelope(raw);
      if (env) {
        if (env.v < version) {
          const migrated = runMigration(env.data, env.v);
          persist(migrated);
          return clone(migrated);
        }
        cache = env;
        return clone(env.data);
      }
    }

    const older = findOlderVersion(name, version);
    if (older) {
      const migrated = runMigration(older.env.data, older.env.v);
      if (persist(migrated)) safeRemove(older.key);
      return clone(migrated);
    }

    if (cache) return clone(cache.data); // storage unreadable, but we still have the session value
    return clone(initial);
  }

  function write(value) {
    const ok = persist(value);
    notify();
    return ok;
  }

  function update(fn) {
    return write(fn(read()));
  }

  function clear() {
    cache = null;
    dirty = false;
    safeRemove(key);
    notify();
  }

  function exportJSON() {
    const env = cache || parseEnvelope(safeGet(key) || 'null') || { v: version, updatedAt: null, data: read() };
    return JSON.stringify({ name, v: env.v, updatedAt: env.updatedAt, data: env.data }, null, 2);
  }

  function importJSON(json) {
    let obj;
    try {
      obj = typeof json === 'string' ? JSON.parse(json) : json;
    } catch {
      throw new StorageError("That file doesn't look like a backup", 'bad-json');
    }
    if (!obj || typeof obj !== 'object') throw new StorageError("That file doesn't look like a backup", 'bad-shape');
    if (obj.name !== name) throw new StorageError(`That backup is for "${obj.name}", not "${name}"`, 'wrong-store');
    if (!Number.isInteger(obj.v) || obj.v < 1) throw new StorageError('That backup has no version', 'bad-version');
    if (obj.v > version) throw new StorageError('That backup is from a newer version of this page', 'newer-version');
    if (!('data' in obj)) throw new StorageError('That backup has no data in it', 'no-data');
    const data = obj.v < version ? runMigration(obj.data, obj.v) : obj.data;
    write(data);
    return clone(data);
  }

  let storageListenerAttached = false;
  function subscribe(fn) {
    listeners.add(fn);
    if (!storageListenerAttached && typeof window !== 'undefined') {
      storageListenerAttached = true;
      window.addEventListener('storage', (e) => {
        if (e.key !== null && e.key !== key) return;
        if (!dirty) cache = null; // keep an unsaved value; the other tab's write must not erase it
        notify();
      });
    }
    return () => listeners.delete(fn);
  }

  return { name, key, version, read, write, update, clear, export: exportJSON, import: importJSON, subscribe };
}

/* ───────────────────────────── encrypted store ───────────────────────────── */

const te = new TextEncoder();
const td = new TextDecoder();

function b64encode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function deriveKey(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: the key can be used but never read back
    ['encrypt', 'decrypt'],
  );
}

function isEncryptedEnvelope(env) {
  return !!env && env.alg === 'AES-GCM' && env.kdf === 'PBKDF2-SHA256'
    && typeof env.salt === 'string' && typeof env.iv === 'string'
    && typeof env.ciphertext === 'string' && Number.isInteger(env.iterations);
}

function createEncryptedStore(name, { version, migrate, initial }) {
  if (!globalThis.crypto || !crypto.subtle) {
    throw new StorageError('This browser cannot encrypt (WebCrypto unavailable)', 'no-crypto');
  }

  const key = keyFor(name, version);
  const listeners = new Set();

  // Session-only secrets. None of these are ever written anywhere.
  /** @type {CryptoKey|null} */ let cryptoKey = null;
  /** @type {Uint8Array|null} */ let salt = null;
  let iterations = PBKDF2_ITERATIONS;
  let cache = null; // decrypted data while unlocked

  function requireUnlocked() {
    if (!cryptoKey) throw new StorageError('Unlock this store first', 'locked');
  }

  function readEnvelope() {
    const raw = safeGet(key);
    if (raw === null) return null;
    const env = parseEnvelope(raw);
    return isEncryptedEnvelope(env) ? env : null;
  }

  async function encryptData(data) {
    const iv = randomBytes(IV_BYTES);
    const plaintext = te.encode(JSON.stringify({ data }));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext);
    return {
      v: version,
      alg: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations,
      salt: b64encode(salt),
      iv: b64encode(iv),
      ciphertext: b64encode(new Uint8Array(ct)),
      updatedAt: new Date().toISOString(),
    };
  }

  async function decryptEnvelope(env, k) {
    let pt;
    try {
      pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64decode(env.iv) }, k, b64decode(env.ciphertext));
    } catch {
      // AES-GCM authentication failed — the only way we know the passphrase was wrong.
      throw new StorageError("That's not it", 'wrong-passphrase');
    }
    const obj = JSON.parse(td.decode(pt));
    return obj.data;
  }

  async function persist(data) {
    requireUnlocked();
    cache = data;
    const env = await encryptData(data);
    return safeSet(key, JSON.stringify(env));
  }

  function notify() {
    const value = cryptoKey ? clone(cache) : null;
    listeners.forEach((fn) => {
      try { fn(value); } catch (err) { warn('subscriber threw', err); }
    });
  }

  /** True if an encrypted envelope exists on disk (does not need the passphrase). */
  function hasData() {
    return readEnvelope() !== null;
  }

  function isUnlocked() {
    return cryptoKey !== null;
  }

  /**
   * Derive the key from the passphrase and decrypt. First call on an empty
   * store *sets up* the store with a fresh salt and writes an encrypted
   * envelope straight away, so the next session can verify the passphrase.
   * Rejects with StorageError('wrong-passphrase') if AES-GCM authentication fails.
   */
  async function unlock(passphrase) {
    if (typeof passphrase !== 'string' || passphrase.length === 0) {
      throw new StorageError('A passphrase is needed', 'empty-passphrase');
    }
    const env = readEnvelope();
    if (env) {
      const s = b64decode(env.salt);
      const k = await deriveKey(passphrase, s, env.iterations);
      const data = await decryptEnvelope(env, k); // throws on wrong passphrase
      cryptoKey = k;
      salt = s;
      iterations = env.iterations;
      cache = data;
      if (env.v < version) {
        cache = typeof migrate === 'function' ? migrate(data, env.v) : data;
        await persist(cache);
      }
    } else {
      salt = randomBytes(SALT_BYTES);
      iterations = PBKDF2_ITERATIONS;
      cryptoKey = await deriveKey(passphrase, salt, iterations);
      cache = clone(initial);
      await persist(cache);
    }
    notify();
    return clone(cache);
  }

  /** Forget the key and the decrypted data. Called automatically on page unload. */
  function lock() {
    cryptoKey = null;
    salt = null;
    cache = null;
    notify();
  }

  async function read() {
    requireUnlocked();
    return clone(cache);
  }

  async function write(value) {
    const ok = await persist(value);
    notify();
    return ok;
  }

  async function update(fn) {
    return write(fn(await read()));
  }

  /** Delete everything and lock. The next unlock starts fresh with a new salt. */
  async function clear() {
    safeRemove(key);
    lock();
  }

  /** Re-encrypt under a new passphrase (requires the store to be unlocked). */
  async function changePassphrase(nextPassphrase) {
    requireUnlocked();
    if (typeof nextPassphrase !== 'string' || nextPassphrase.length === 0) {
      throw new StorageError('A passphrase is needed', 'empty-passphrase');
    }
    salt = randomBytes(SALT_BYTES);
    iterations = PBKDF2_ITERATIONS;
    cryptoKey = await deriveKey(nextPassphrase, salt, iterations);
    return persist(cache);
  }

  /** Exports the *ciphertext* envelope — a backup that still needs the passphrase. */
  function exportJSON() {
    const env = readEnvelope();
    if (!env) throw new StorageError('Nothing to export yet', 'empty');
    return JSON.stringify({ name, ...env }, null, 2);
  }

  /** Accepts an exported ciphertext envelope. Locks the store; unlock with that backup's passphrase. */
  function importJSON(json) {
    let obj;
    try {
      obj = typeof json === 'string' ? JSON.parse(json) : json;
    } catch {
      throw new StorageError("That file doesn't look like a backup", 'bad-json');
    }
    if (!obj || typeof obj !== 'object') throw new StorageError("That file doesn't look like a backup", 'bad-shape');
    if (obj.name !== name) throw new StorageError(`That backup is for "${obj.name}", not "${name}"`, 'wrong-store');
    if (!isEncryptedEnvelope(obj) || !Number.isInteger(obj.v)) throw new StorageError('That backup is not an encrypted envelope', 'bad-envelope');
    if (obj.v > version) throw new StorageError('That backup is from a newer version of this page', 'newer-version');
    const { name: _ignored, ...env } = obj;
    const ok = safeSet(key, JSON.stringify(env));
    lock();
    return ok;
  }

  let storageListenerAttached = false;
  function subscribe(fn) {
    listeners.add(fn);
    if (!storageListenerAttached && typeof window !== 'undefined') {
      storageListenerAttached = true;
      window.addEventListener('storage', async (e) => {
        if (e.key !== null && e.key !== key) return;
        if (!cryptoKey) return;
        const env = readEnvelope();
        if (!env) { lock(); return; }
        try {
          cache = await decryptEnvelope(env, cryptoKey);
          notify();
        } catch {
          // Another tab changed the passphrase; our key no longer fits.
          lock();
        }
      });
    }
    return () => listeners.delete(fn);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => { cryptoKey = null; salt = null; cache = null; });
  }

  return {
    name, key, version, encrypted: true,
    unlock, lock, isUnlocked, hasData, changePassphrase,
    read, write, update, clear, export: exportJSON, import: importJSON, subscribe,
  };
}

/* ─────────────────────────────── blob store ─────────────────────────────── */

/**
 * Minimal IndexedDB store for binary things (wardrobe photos). One database
 * per store, one object store, four methods. Same fail-soft contract: if
 * IndexedDB is unavailable or errors, values live in memory for the session.
 * @param {string} name
 */
export function createBlobStore(name) {
  validateName(name);
  const dbName = `${NS}.${name}`;
  const STORE = 'blobs';
  /** @type {Promise<IDBDatabase|null>|null} */
  let dbPromise = null;
  const fallback = new Map();
  let fallbackAnnounced = false;

  function useFallback() {
    if (!fallbackAnnounced) {
      fallbackAnnounced = true;
      showStorageBanner();
    }
    return fallback;
  }

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(null);
      let req;
      try {
        req = indexedDB.open(dbName, 1);
      } catch (err) {
        warn('indexedDB.open threw', err);
        return resolve(null);
      }
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { warn('indexedDB.open failed', req.error); resolve(null); };
      req.onblocked = () => { warn('indexedDB.open blocked'); resolve(null); };
    });
    return dbPromise;
  }

  /** Run one request inside a transaction; resolves with the request result. */
  async function run(mode, op) {
    const db = await open();
    if (!db) return op(null);
    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(STORE, mode);
      } catch (err) {
        warn('transaction failed', err);
        return resolve(op(null));
      }
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new StorageError('IndexedDB transaction aborted', 'idb-abort'));
    });
  }

  async function put(id, blob) {
    try {
      await run('readwrite', (store) => (store ? store.put(blob, id) : void useFallback().set(id, blob)));
      return true;
    } catch (err) {
      warn('blob put failed; keeping in memory', err);
      useFallback().set(id, blob);
      return false;
    }
  }

  async function get(id) {
    if (fallback.has(id)) return fallback.get(id);
    try {
      const v = await run('readonly', (store) => (store ? store.get(id) : undefined));
      return v === undefined ? null : v;
    } catch (err) {
      warn('blob get failed', err);
      return null;
    }
  }

  async function del(id) {
    fallback.delete(id);
    try {
      await run('readwrite', (store) => (store ? store.delete(id) : undefined));
      return true;
    } catch (err) {
      warn('blob delete failed', err);
      return false;
    }
  }

  async function keys() {
    let stored = [];
    try {
      stored = (await run('readonly', (store) => (store ? store.getAllKeys() : undefined))) || [];
    } catch (err) {
      warn('blob keys failed', err);
    }
    return Array.from(new Set([...stored, ...fallback.keys()]));
  }

  async function estimate() {
    try {
      if (navigator.storage && typeof navigator.storage.estimate === 'function') {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate();
        return { usage, quota };
      }
    } catch (err) {
      warn('storage.estimate failed', err);
    }
    return { usage: 0, quota: 0 };
  }

  return { name, put, get, delete: del, keys, estimate };
}
