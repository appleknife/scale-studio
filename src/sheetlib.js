// sheetlib.js — the sheet-music shelf: what a page of music is made of.
//
// Everything here is either plain arithmetic or a small IndexedDB store. The
// pictures stay in the database as the files the student brought (a PDF, an
// image, a MusicXML file); the app never rasterises and keeps a copy of its own.
// Ink, bookmarks, the reading spot and the audio tracks hang off the sheet, so a
// page opened next week is the page that was left, marks and all.
//
// Nothing leaves the device: the shelf is IndexedDB, not a server, which is also
// why a PDF the student paid for can sit here without the repository carrying it.

const DB_NAME = 'scale-studio.sheets';
const DB_VERSION = 1;
const STORE_SHEETS = 'sheets';
const STORE_FILES = 'files';
const STORE_INK = 'ink';
const STORE_AUDIO = 'audio';

export const TONES = ['paper', 'sepia', 'night'];
export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 5;

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

export function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/** `Gavotte - Gossec.pdf` becomes the two fields a card shows. */
export function splitName(fileName) {
  const base = String(fileName || '').replace(/\\/g, '/').split('/').pop().replace(/\.[^.]+$/, '');
  const cut = base.split(/\s+[-–—]\s+/);
  const clean = (s) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (cut.length > 1 && cut[1]) return { title: clean(cut[0]) || 'Untitled', composer: clean(cut.slice(1).join(' - ')) };
  return { title: clean(base) || 'Untitled', composer: '' };
}

/** What kind of page a picked file makes, or null when it is not music. */
export function fileKind(file) {
  const type = String(file && file.type || '');
  const name = String(file && file.name || '').toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (/\.(musicxml|mxl|xml)$/.test(name) || type.includes('musicxml')) return 'musicxml';
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)$/.test(name)) return 'image';
  return null;
}

export function audioKind(file) {
  const type = String(file && file.type || '');
  const name = String(file && file.name || '').toLowerCase();
  if (type.startsWith('audio/')) return true;
  return /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm)$/.test(name);
}

/** A page never moves past either cover. */
export function turnPage(page, count, delta) {
  return clamp(page + delta, 1, Math.max(1, count));
}

export function clampZoom(zoom) {
  return Math.round(clamp(zoom, MIN_ZOOM, MAX_ZOOM) * 100) / 100;
}

/**
 * Page scale that fits the stage. `margin` leaves a hair of paper visible so a
 * page never looks glued to the toolbar.
 */
export function fitScale(pageW, pageH, stageW, stageH, mode, margin = 12) {
  if (!pageW || !pageH || !stageW || !stageH) return 1;
  const w = Math.max(40, stageW - margin * 2);
  const h = Math.max(40, stageH - margin * 2);
  const byWidth = w / pageW;
  const byPage = Math.min(byWidth, h / pageH);
  return mode === 'width' ? byWidth : byPage;
}

/** Crop is a share of each edge, 0–0.3, applied to the rendered page. */
export function cropRect(crop) {
  const c = crop || {};
  const l = clamp(c.l || 0, 0, 0.3);
  const r = clamp(c.r || 0, 0, 0.3);
  const t = clamp(c.t || 0, 0, 0.3);
  const b = clamp(c.b || 0, 0, 0.3);
  const w = Math.max(0.2, 1 - l - r);
  const h = Math.max(0.2, 1 - t - b);
  return { left: l, right: r, top: t, bottom: b, width: w, height: h };
}

/**
 * The CSS filter a page tone asks for. Night is an inversion with the contrast
 * pulled back; sepia warms the paper without hiding pencil.
 */
export function toneFilter(tone, brightness = 1) {
  const b = clamp(brightness, 0.5, 1.6);
  if (tone === 'night') return `invert(1) hue-rotate(180deg) brightness(${b}) contrast(0.88)`;
  if (tone === 'sepia') return `sepia(0.35) saturate(1.05) brightness(${b})`;
  return `brightness(${b})`;
}

export function pageLabel(page, count) {
  return `${page} / ${count}`;
}

/** Equal temperament: a semitone is 2^(1/12), so 12 is an octave. */
export function semitoneRatio(semitones) {
  return 2 ** (clamp(semitones, -12, 12) / 12);
}

/** A-B points: A before B, both inside the track, never on top of each other. */
export function loopWindow(a, b, duration) {
  const end = Math.max(0, Number(duration) || 0);
  let lo = Math.max(0, Number(a) || 0);
  let hi = Math.min(end, Number(b) || 0);
  if (hi - lo < 0.2) hi = Math.min(end, lo + 0.2);
  if (hi <= lo) {
    lo = Math.max(0, end - 0.2);
    hi = end;
  }
  return { a: lo, b: hi };
}

/** "3:07" — a clock a thumb can read. */
export function clock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function normalizeStroke(points) {
  return (points || [])
    .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(([x, y]) => [clamp(x, 0, 1), clamp(y, 0, 1)]);
}

export function emptySheet(profile, patch = {}) {
  return {
    id: uid(),
    profile: String(profile || ''),
    title: 'Untitled',
    composer: '',
    tags: [],
    kind: 'pdf',
    pageCount: 1,
    addedAt: Date.now(),
    lastOpenedAt: null,
    lastPage: 1,
    settings: {
      tone: 'paper',
      brightness: 1,
      zoom: 1,
      fit: 'page',
      crop: { l: 0, r: 0, t: 0, b: 0 },
      halfPage: false,
      spread: false,
      keepAwake: true,
    },
    bookmarks: [],
    audioId: null,
    autoplay: false,
    ...patch,
  };
}

/* ── The shelf ─────────────────────────────────────────────────────────── */

let dbPromise = null;

function db() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const d = request.result;
      if (!d.objectStoreNames.contains(STORE_SHEETS)) {
        const sheets = d.createObjectStore(STORE_SHEETS, { keyPath: 'id' });
        sheets.createIndex('profile', 'profile');
      }
      if (!d.objectStoreNames.contains(STORE_FILES)) d.createObjectStore(STORE_FILES);
      if (!d.objectStoreNames.contains(STORE_INK)) d.createObjectStore(STORE_INK);
      if (!d.objectStoreNames.contains(STORE_AUDIO)) d.createObjectStore(STORE_AUDIO);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('no-database'));
    request.onblocked = () => reject(new Error('database-blocked'));
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const tx = d.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.onerror = () => reject(tx.error || new Error('database-error'));
        tx.onabort = () => reject(tx.error || new Error('database-aborted'));
        if (req) {
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error || new Error('database-error'));
        } else {
          tx.oncomplete = () => resolve();
        }
      }),
  );
}

export function listSheets(profile) {
  return run(STORE_SHEETS, 'readonly', (store) => store.index('profile').getAll(String(profile || ''))).then((rows) =>
    (rows || []).sort((a, b) => (b.lastOpenedAt || b.addedAt) - (a.lastOpenedAt || a.addedAt)),
  );
}

export function getSheet(id) {
  return run(STORE_SHEETS, 'readonly', (store) => store.get(id));
}

export function saveSheet(sheet) {
  return run(STORE_SHEETS, 'readwrite', (store) => store.put(sheet)).then(() => sheet);
}

export const pageKey = (id, n) => `${id}/p${n}`;

export async function deleteSheet(id) {
  const sheet = await getSheet(id).catch(() => null);
  const tracks = await getAudio(id).catch(() => []);
  const pages = sheet && sheet.kind === 'images' ? Array.from({ length: sheet.pageCount || 0 }, (_, i) => pageKey(id, i + 1)) : [];
  const keys = [...tracks.map((row) => `${id}/${row.id}`), ...pages, id];
  await Promise.all([
    run(STORE_SHEETS, 'readwrite', (store) => store.delete(id)),
    run(STORE_INK, 'readwrite', (store) => store.delete(id)),
    run(STORE_AUDIO, 'readwrite', (store) => store.delete(id)),
    ...keys.map((key) => run(STORE_FILES, 'readwrite', (store) => store.delete(key))),
  ]);
}

export function getFile(id) {
  return run(STORE_FILES, 'readonly', (store) => store.get(id));
}

export function saveFile(id, blob) {
  return run(STORE_FILES, 'readwrite', (store) => store.put(blob, id));
}

export function getInk(id) {
  return run(STORE_INK, 'readonly', (store) => store.get(id)).then((v) => v || {});
}

export function saveInk(id, pages) {
  return run(STORE_INK, 'readwrite', (store) => store.put(pages, id));
}

export function getAudio(id) {
  return run(STORE_AUDIO, 'readonly', (store) => store.get(id)).then((v) => v || []);
}

export function saveAudio(id, tracks) {
  return run(STORE_AUDIO, 'readwrite', (store) => store.put(tracks, id));
}

export function getAudioBlob(sheetId, trackId) {
  return run(STORE_FILES, 'readonly', (store) => store.get(`${sheetId}/${trackId}`));
}

export function saveAudioBlob(sheetId, trackId, blob) {
  return run(STORE_FILES, 'readwrite', (store) => store.put(blob, `${sheetId}/${trackId}`));
}

export function deleteAudioBlob(sheetId, trackId) {
  return run(STORE_FILES, 'readwrite', (store) => store.delete(`${sheetId}/${trackId}`));
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage.estimate();
    return { used: e.usage || 0, quota: e.quota || 0 };
  } catch {
    return { used: 0, quota: 0 };
  }
}

export const megabytes = (bytes) => Math.round((bytes / 1048576) * 10) / 10;
