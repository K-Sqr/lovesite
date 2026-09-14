/**
 * weather.js — Open-Meteo client, location resolution, 60-minute cache (10-OUTFIT R1/R3/R4).
 *
 *   resolveLocation()                  saved → geolocation ONLY if already granted → Winnipeg. Never prompts.
 *   requestGeolocation()               the explicit "use my location" control; handles all four outcomes
 *   setSavedLocation(loc) / clearSavedLocation()
 *   readCachedWeather(loc)             sync, from the cache; { weather, stale } or null
 *   fetchWeather(loc)                  network; normalises and caches
 *   getWeather(loc)                    cached-first: { weather, stale, fromCache } — throws only when both fail
 *   PRESET_LOCATIONS, DEFAULT_LOCATION
 *
 * Privacy: the ONLY network request this module makes is to api.open-meteo.com,
 * and it receives coordinates rounded to 2 dp (~1.1 km) and nothing else — no
 * account, no identifier, no cookie. Coordinates are never logged.
 *
 * The normalised shape (the only thing outfitEngine.js ever sees):
 *   { tempC, feelsLikeC, tempMinC, tempMaxC, windKph, precipMm, precipChance,
 *     code, condition, isDaytime, fetchedAt, locationLabel, stale }
 */

import { createStore } from './storage.js';

const API = 'https://api.open-meteo.com/v1/forecast';
const TTL_MS = 60 * 60 * 1000;        // 60 minutes
const FETCH_TIMEOUT_MS = 10_000;
const GEO_TIMEOUT_MS = 8_000;

/** Winnipeg. Confirm with the owner; it is where she is. */
export const DEFAULT_LOCATION = { lat: 49.90, lon: -97.14, label: 'Winnipeg' };

/**
 * The manual override is a short list, not a picker. Trim or extend freely —
 * every entry is just { lat, lon, label }, rounded to 2 dp on purpose.
 */
export const PRESET_LOCATIONS = [
  DEFAULT_LOCATION,
  { lat: 49.85, lon: -99.95, label: 'Brandon' },
  { lat: 43.65, lon: -79.38, label: 'Toronto' },
  { lat: 45.42, lon: -75.70, label: 'Ottawa' },
  { lat: 45.50, lon: -73.57, label: 'Montréal' },
  { lat: 51.05, lon: -114.07, label: 'Calgary' },
  { lat: 53.55, lon: -113.49, label: 'Edmonton' },
  { lat: 49.28, lon: -123.12, label: 'Vancouver' },
  { lat: 6.52, lon: 3.38, label: 'Lagos' },
  { lat: 9.06, lon: 7.49, label: 'Abuja' },
  { lat: 51.51, lon: -0.13, label: 'London' },
];

/**
 * WMO weather interpretation codes → internal condition.
 *   0            clear sky
 *   1, 2, 3      mainly clear, partly cloudy, overcast
 *   45, 48       fog, depositing rime fog
 *   51, 53, 55   drizzle (light, moderate, dense)
 *   56, 57       freezing drizzle
 *   61, 63, 65   rain (slight, moderate, heavy)
 *   66, 67       freezing rain
 *   71, 73, 75   snowfall (slight, moderate, heavy)
 *   77           snow grains
 *   80, 81, 82   rain showers
 *   85, 86       snow showers
 *   95           thunderstorm
 *   96, 99       thunderstorm with hail
 */
const WMO_CONDITIONS = [
  { codes: [0], condition: 'clear' },
  { codes: [1, 2, 3], condition: 'cloudy' },
  { codes: [45, 48], condition: 'fog' },
  { codes: [51, 53, 55], condition: 'drizzle' },
  { codes: [56, 57, 66, 67], condition: 'freezing' },
  { codes: [61, 63, 65, 80, 81, 82], condition: 'rain' },
  { codes: [71, 73, 75, 77, 85, 86], condition: 'snow' },
  { codes: [95, 96, 99], condition: 'storm' },
];

export function conditionFor(code) {
  const n = Number(code);
  const row = WMO_CONDITIONS.find((r) => r.codes.includes(n));
  return row ? row.condition : 'cloudy';
}

/** Plain words for the weather line. */
export const CONDITION_LABELS = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  fog: 'Foggy',
  drizzle: 'Drizzle',
  rain: 'Rain',
  freezing: 'Freezing rain',
  snow: 'Snow',
  storm: 'Thunderstorms',
};

export const CONDITION_EMOJI = {
  clear: '\u{2600}\u{FE0F}',   // ☀️
  cloudy: '\u{2601}\u{FE0F}',  // ☁️
  fog: '\u{1F32B}\u{FE0F}',    // 🌫️
  drizzle: '\u{1F326}\u{FE0F}',// 🌦️
  rain: '\u{1F327}\u{FE0F}',   // 🌧️
  freezing: '\u{1F9CA}',       // 🧊
  snow: '\u{2744}\u{FE0F}',    // ❄️
  storm: '\u{26C8}\u{FE0F}',   // ⛈️
};

/** Never anything specific to the console. */
function warn(message) {
  console.warn(`[weather] ${message}`);
}

/* ─────────────────────────────── stores ─────────────────────────────── */

const cacheStore = createStore('weather-cache', { version: 1, initial: {} });
const locationStore = createStore('weather-location', { version: 1, initial: null });

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function normaliseLocation(loc) {
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return null;
  if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) return null;
  return { lat: round2(loc.lat), lon: round2(loc.lon), label: String(loc.label || '').slice(0, 60) || 'Here' };
}

function cacheKey(loc) {
  return `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;
}

/* ─────────────────────────────── location ─────────────────────────────── */

export function getSavedLocation() {
  return normaliseLocation(locationStore.read());
}

/** @param {{ lat: number, lon: number, label?: string }} loc */
export function setSavedLocation(loc) {
  const clean = normaliseLocation(loc);
  if (!clean) return null;
  locationStore.write(clean);
  return clean;
}

export function clearSavedLocation() {
  locationStore.clear();
}

/** True only if the browser says permission is already 'granted'. Never prompts. */
async function geolocationAlreadyGranted() {
  try {
    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') return false;
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state === 'granted';
  } catch {
    return false;
  }
}

/**
 * Ask the browser for a position. This is the ONLY place getCurrentPosition is
 * called, and it is only reached from resolveLocation() when permission is
 * already granted, or from the explicit "use my location" control.
 * @returns {Promise<{ ok: true, location: object } | { ok: false, reason: 'denied'|'unavailable'|'timeout'|'insecure'|'unsupported' }>}
 */
export function requestGeolocation() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve({ ok: false, reason: 'unsupported' });
    if (typeof window !== 'undefined' && window.isSecureContext === false) return resolve({ ok: false, reason: 'insecure' });

    let settled = false;
    const done = (result) => { if (!settled) { settled = true; clearTimeout(timer); resolve(result); } };
    // A dismissed prompt never calls either callback in some browsers — this timer is the third outcome.
    const timer = setTimeout(() => done({ ok: false, reason: 'timeout' }), GEO_TIMEOUT_MS + 500);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => done({ ok: true, location: normaliseLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Where you are' }) }),
        (err) => {
          if (err && err.code === 1) done({ ok: false, reason: 'denied' });
          else if (err && err.code === 3) done({ ok: false, reason: 'timeout' });
          else done({ ok: false, reason: 'unavailable' });
        },
        { timeout: GEO_TIMEOUT_MS, maximumAge: 30 * 60 * 1000, enableHighAccuracy: false },
      );
    } catch {
      done({ ok: false, reason: 'unavailable' });
    }
  });
}

/**
 * saved location → geolocation only if permission is already granted → Winnipeg.
 * Never shows a permission dialog.
 * @returns {Promise<{ location: object, source: 'saved'|'geo'|'default' }>}
 */
export async function resolveLocation() {
  const saved = getSavedLocation();
  if (saved) return { location: saved, source: 'saved' };

  if (await geolocationAlreadyGranted()) {
    const result = await requestGeolocation();
    if (result.ok && result.location) return { location: result.location, source: 'geo' };
  }

  return { location: DEFAULT_LOCATION, source: 'default' };
}

/* ─────────────────────────────── weather ─────────────────────────────── */

function readCache() {
  const all = cacheStore.read();
  return all && typeof all === 'object' ? all : {};
}

/**
 * @param {{ lat: number, lon: number }} loc
 * @param {Date} [now]
 * @returns {{ weather: object, stale: boolean } | null}
 */
export function readCachedWeather(loc, now = new Date()) {
  const clean = normaliseLocation(loc);
  if (!clean) return null;
  const entry = readCache()[cacheKey(clean)];
  if (!entry || typeof entry !== 'object' || typeof entry.fetchedAt !== 'string') return null;
  const age = now.getTime() - new Date(entry.fetchedAt).getTime();
  const stale = !Number.isFinite(age) || age > TTL_MS;
  return { weather: { ...entry, stale }, stale };
}

function writeCache(loc, weather) {
  const key = cacheKey(loc);
  // Keep the cache small: this location plus at most a few others.
  const all = readCache();
  const entries = Object.entries(all).filter(([k]) => k !== key).slice(-4);
  cacheStore.write(Object.fromEntries([...entries, [key, weather]]));
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Open-Meteo payload → the flat internal shape. Exported for tests. */
export function normaliseForecast(payload, loc, fetchedAt) {
  const cur = (payload && payload.current) || {};
  const daily = (payload && payload.daily) || {};
  const first = (arr) => (Array.isArray(arr) ? num(arr[0]) : null);
  const code = num(cur.weather_code) ?? first(daily.weather_code) ?? 3;
  const tempC = num(cur.temperature_2m);
  return {
    tempC,
    feelsLikeC: num(cur.apparent_temperature) ?? tempC,
    tempMinC: first(daily.temperature_2m_min),
    tempMaxC: first(daily.temperature_2m_max),
    windKph: num(cur.wind_speed_10m) ?? 0,
    precipMm: num(cur.precipitation) ?? 0,
    precipChance: first(daily.precipitation_probability_max) ?? 0,
    code,
    condition: conditionFor(code),
    isDaytime: cur.is_day === undefined ? true : Number(cur.is_day) === 1,
    fetchedAt,
    locationLabel: loc.label,
    stale: false,
  };
}

/**
 * Fetch today's forecast from Open-Meteo and cache it. Throws on any failure
 * (network, CSP, non-2xx, malformed) — callers fall back to the cache or the season.
 * @param {{ lat: number, lon: number, label?: string }} loc
 */
export async function fetchWeather(loc) {
  const clean = normaliseLocation(loc);
  if (!clean) throw new Error('bad location');

  const params = new URLSearchParams({
    latitude: clean.lat.toFixed(2),          // 2dp ≈ 1.1km — deliberately coarse
    longitude: clean.lon.toFixed(2),
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability',
    timezone: 'auto',
    forecast_days: '1',
  });

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
  let payload;
  try {
    const res = await fetch(`${API}?${params}`, { signal: controller ? controller.signal : undefined });
    if (!res.ok) throw new Error(`weather request failed (${res.status})`);
    payload = await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!payload || typeof payload !== 'object' || !payload.current) throw new Error('weather payload malformed');

  const weather = normaliseForecast(payload, clean, new Date().toISOString());
  if (weather.tempC === null) throw new Error('weather payload missing temperature');
  writeCache(clean, weather);
  return weather;
}

/**
 * Cache first, network second. Resolves with whatever it could get:
 *   { weather, stale, fromCache }  — `weather` is null only when there is nothing at all.
 * Never throws.
 * @param {{ lat: number, lon: number, label?: string }} loc
 * @param {{ refresh?: boolean }} [opts]  refresh=true forces a network attempt even when the cache is fresh
 */
export async function getWeather(loc, { refresh = false } = {}) {
  const cached = readCachedWeather(loc);
  if (cached && !cached.stale && !refresh) return { weather: cached.weather, stale: false, fromCache: true };
  try {
    const weather = await fetchWeather(loc);
    return { weather, stale: false, fromCache: false };
  } catch (err) {
    warn(`fetch failed: ${err && err.name === 'AbortError' ? 'timed out' : 'unavailable'}`);
    if (cached) return { weather: cached.weather, stale: true, fromCache: true };
    return { weather: null, stale: true, fromCache: false };
  }
}

/** Display helper: "−24°" with a real minus sign. */
export function formatTemp(c) {
  if (typeof c !== 'number' || !Number.isFinite(c)) return '—';
  const n = Math.round(c);
  return (n < 0 ? '−' : '') + Math.abs(n) + '°';
}
