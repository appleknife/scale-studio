// offline.js — keeping the app on the device.
//
// The service worker (sw.js) does the storing; this is the part the screens talk
// to: register it, notice when a newer version is waiting, download the recorded
// violin on request, and report honestly what is on this device.

const SAMPLES_KEY = 'scaleStudio.samplesOffline';
const SAMPLE_BASE = 'samples/';

let registration = null;
let onUpdate = null;

/** Registers the worker. Safe to call on every page load; does nothing where
 *  service workers or a secure context are missing (an `file://` copy, an old
 *  browser), and the app simply behaves as it did before. */
export async function startOffline({ onUpdateReady } = {}) {
  onUpdate = onUpdateReady || null;
  if (!('serviceWorker' in navigator)) return { supported: false, ready: false };
  try {
    registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    // A worker can already be waiting if the page was opened twice.
    if (registration.waiting) notifyUpdate();
    registration.addEventListener('updatefound', () => {
      const next = registration.installing;
      if (!next) return;
      next.addEventListener('statechange', () => {
        if (next.state === 'installed' && navigator.serviceWorker.controller) notifyUpdate();
      });
    });
    return { supported: true, ready: Boolean(registration.active) };
  } catch (err) {
    return { supported: false, ready: false, error: String(err && err.message) };
  }
}

function notifyUpdate() {
  if (onUpdate) onUpdate();
}

/** Takes the waiting version, then reloads so the page and the cache agree. */
export function applyUpdate() {
  if (!registration || !registration.waiting) return;
  registration.waiting.postMessage({ type: 'take-over' });
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
    once: true,
  });
}

/* ── The recorded violin ─────────────────────────────────────────────── */

/**
 * Whether the takes are on this device. The flag is set only after a download
 * finishes, so it can be trusted offline — where checking the cache cannot tell
 * a full download from a half one.
 */
export function samplesStored() {
  try {
    return localStorage.getItem(SAMPLES_KEY) === 'yes';
  } catch {
    return false;
  }
}

/**
 * Fetches every recorded take so it can be played without a connection.
 * `onProgress(done, total)` keeps a button honest while it works. A take that
 * fails does not abort the download — the rest of the set is still worth having,
 * and the flag is only set when all of them arrived.
 */
export async function downloadSamples(onProgress) {
  const index = await (await fetch(`${SAMPLE_BASE}index.json`, { cache: 'force-cache' })).json();
  const files = [index, ...index.samples];
  const total = files.length;
  let done = 0;
  let missing = 0;

  for (const entry of files) {
    const url = entry.file ? SAMPLE_BASE + entry.file : `${SAMPLE_BASE}index.json`;
    try {
      const response = await fetch(url, { cache: 'default' });
      if (!response.ok) throw new Error(String(response.status));
      await response.blob(); // forces the body through the service worker's cache
    } catch {
      missing += 1;
    }
    done += 1;
    if (onProgress) onProgress(done, total);
  }

  const complete = missing === 0;
  try {
    if (complete) localStorage.setItem(SAMPLES_KEY, 'yes');
    else localStorage.removeItem(SAMPLES_KEY);
  } catch {
    /* private mode — the download still worked for this visit */
  }
  return { complete, missing, total };
}

/** Forgets the flag; the browser drops the cache itself when it needs the room. */
export function forgetSamples() {
  try {
    localStorage.removeItem(SAMPLES_KEY);
  } catch {
    /* nothing to forget */
  }
}
