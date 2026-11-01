// journal.js — the practice log: what you did, what was hard, what is ready.
//
// Everything here is plain data: a handful of small objects in localStorage. The
// rules that carry the motivation — the streak, the two rest days a week, when a
// scale counts as ready for the audition — live here rather than in the screens,
// so they can be tested without a browser.
//
// The psychology behind the shape of it:
//   * a streak that counts *anything*, because demanding a full session a day is
//     what stops people forming the habit at all;
//   * two planned rest days a week, because a goal with skips survives a miss;
//   * nothing is ever marked as a failure — a missed day is simply blank;
//   * "what was hard" is one tap, because reflection is the step that turns
//     playing into practising, and it is what the teacher can use next lesson.

export const TAGS = ['scales', 'sight', 'tuner', 'piece', 'recording', 'other'];
export const HARD = ['intonation', 'rhythm', 'shifts', 'reading', 'tone'];

/** A scale is "ready" after it has been played cleanly on this many days. */
export const READY_DAYS = 2;
/** A take counts towards "cleanly" at or above this score. */
export const READY_SCORE = 90;
/** Planned rest days allowed in one week. */
export const RESTS_PER_WEEK = 2;

const KEY = 'scale-studio.journal.v1';
const STORE_KEY = 'scale-studio.journal.v2';

/** How many names one device holds. A family is three; eight is generous. */
export const MAX_PROFILES = 8;

export function emptyState() {
  return { v: 1, days: {}, rests: [], plan: '', scales: {} };
}

/* ── Dates ─────────────────────────────────────────────────────────────── */

export function dayKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, delta) {
  const d = fromKey(key);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

/** The Monday of the week a date falls in. */
export function weekStart(key) {
  const day = (fromKey(key).getDay() + 6) % 7;
  return addDays(key, -day);
}

/* ── Reading the log ───────────────────────────────────────────────────── */

export function practised(state, key) {
  const day = state.days[key];
  return Boolean(day && (day.tags.length > 0 || day.takes > 0));
}

export function isRest(state, key) {
  return state.rests.includes(key);
}

export function hardThatDay(state, key) {
  return (state.days[key] && state.days[key].hard) || [];
}

/* ── Writing the log ───────────────────────────────────────────────────── */

export function log(state, key, tag) {
  const day = state.days[key] || (state.days[key] = { tags: [], takes: 0, hard: [] });
  if (tag && !day.tags.includes(tag)) day.tags.push(tag);
  return day;
}

/** A finished take logs itself — nothing to type. */
export function logTake(state, key, tag = 'scales') {
  const day = log(state, key, tag);
  day.takes += 1;
  return day;
}

export function toggleHard(state, key, what) {
  const day = log(state, key);
  const at = day.hard.indexOf(what);
  if (at >= 0) day.hard.splice(at, 1);
  else day.hard.push(what);
  return day.hard.includes(what);
}

/**
 * Marks or clears a planned rest day. Two a week; a rest day neither adds to the
 * streak nor breaks it, which is the whole point of having them.
 */
export function markRest(state, key) {
  if (isRest(state, key)) {
    state.rests = state.rests.filter((k) => k !== key);
    return 'cleared';
  }
  const week = weekStart(key);
  const used = state.rests.filter((k) => weekStart(k) === week).length;
  if (used >= RESTS_PER_WEEK) return 'limit';
  state.rests.push(key);
  return 'marked';
}

export function noteScale(state, id, key, score) {
  const entry = state.scales[id] || (state.scales[id] = { days: [], best: 0 });
  if (score >= READY_SCORE && !entry.days.includes(key)) entry.days.push(key);
  entry.best = Math.max(entry.best, score);
  return entry;
}

/* ── Reading it back ───────────────────────────────────────────────────── */

/**
 * Days in a row. Today does not break the streak until it is over: in the
 * morning the number is yesterday's, which is what people expect and what keeps
 * a good habit from looking lost before breakfast.
 */
export function streak(state, today) {
  let key = today;
  if (!practised(state, key) && !isRest(state, key)) key = addDays(key, -1);
  let count = 0;
  for (let guard = 0; guard < 800; guard++) {
    if (practised(state, key)) count += 1;
    else if (!isRest(state, key)) break;
    key = addDays(key, -1);
  }
  return count;
}

/** The last `count` weeks, each Monday to Sunday, oldest first. */
export function weeks(state, today, count = 5) {
  const thisWeek = weekStart(today);
  const out = [];
  for (let w = count - 1; w >= 0; w--) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      const key = addDays(thisWeek, -w * 7 + d);
      row.push({
        key,
        practised: practised(state, key),
        rest: isRest(state, key),
        today: key === today,
        future: key > today,
      });
    }
    out.push(row);
  }
  return out;
}

export function scalesReady(state, ids) {
  return ids.map((id) => {
    const entry = state.scales[id] || { days: [], best: 0 };
    return { id, days: entry.days.length, best: entry.best, ready: entry.days.length >= READY_DAYS };
  });
}

/**
 * A week in numbers, for the lesson sheet. Deliberately language-free: the
 * screen turns it into words.
 */
export function weekSheet(state, today, ids) {
  const start = weekStart(today);
  const tags = {};
  let days = 0;
  let rests = 0;
  let takes = 0;
  const hard = {};
  for (let d = 0; d < 7; d++) {
    const key = addDays(start, d);
    if (key > today) break;
    if (practised(state, key)) days += 1;
    if (isRest(state, key)) rests += 1;
    const day = state.days[key];
    if (!day) continue;
    takes += day.takes || 0;
    for (const tag of day.tags) tags[tag] = (tags[tag] || 0) + 1;
    for (const what of day.hard || []) hard[what] = (hard[what] || 0) + 1;
  }
  const hardList = Object.entries(hard)
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => ({ key, n }));
  const ready = scalesReady(state, ids).filter((s) => s.ready).map((s) => s.id);
  return { start, days, rests, takes, tags, hard: hardList, ready, total: ids.length };
}

/* ── Storage ───────────────────────────────────────────────────────────── */

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

export function save(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    // A full or blocked store must never break the practice screen — but the
    // screen has to know, because a log that is not being written is gone at the
    // next reload, and the student deserves to hear that now.
    return false;
  }
}

export function clear(storage = globalThis.localStorage) {
  try {
    storage.removeItem(KEY);
    storage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

/* ── More than one person on the same device ───────────────────────────── */
//
// Three children can share one tablet, and one shared streak would be worse than
// none: the youngest's two days would hold the oldest's run together. So the
// store holds a list of named logs and a pointer to the one on screen. Everything
// else in this file is unchanged — the rules never knew whose log they were
// applying.

export function emptyStore() {
  return { v: 2, current: null, profiles: [] };
}

let seq = 0;

export function makeProfile(name = '', state = emptyState()) {
  seq += 1;
  return {
    id: `p${Date.now().toString(36)}${seq}`,
    name: String(name || '').trim().slice(0, 24),
    state,
  };
}

/** The log on screen: the current one, or the first, so a call never returns null. */
export function active(store) {
  if (!store || !Array.isArray(store.profiles) || !store.profiles.length) return null;
  return store.profiles.find((p) => p.id === store.current) || store.profiles[0];
}

function isBlank(state) {
  if (!state) return true;
  return (
    !Object.keys(state.days || {}).length &&
    !(state.rests || []).length &&
    !Object.keys(state.scales || {}).length
  );
}

/**
 * Adds a name, or switches to it if it is already there. The nameless log every
 * device starts with is taken over by the first real name while it is still
 * empty, so a family does not end up with "Me" plus three children.
 */
export function addProfile(store, name) {
  const clean = String(name || '').trim().slice(0, 24);
  if (!clean) return null;

  const same = store.profiles.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (same) {
    store.current = same.id;
    return same;
  }

  const only = store.profiles.length === 1 ? store.profiles[0] : null;
  if (only && !only.name && isBlank(only.state)) {
    only.name = clean;
    store.current = only.id;
    return only;
  }

  if (store.profiles.length >= MAX_PROFILES) return null;

  const profile = makeProfile(clean);
  store.profiles.push(profile);
  store.current = profile.id;
  return profile;
}

export function renameProfile(store, id, name) {
  const clean = String(name || '').trim().slice(0, 24);
  const profile = store.profiles.find((p) => p.id === id);
  if (!profile || !clean) return false;
  if (store.profiles.some((p) => p.id !== id && p.name.toLowerCase() === clean.toLowerCase())) {
    return false;
  }
  profile.name = clean;
  return true;
}

/** Removing the last name leaves a fresh nameless log rather than an empty page. */
export function removeProfile(store, id) {
  const at = store.profiles.findIndex((p) => p.id === id);
  if (at < 0) return false;
  store.profiles.splice(at, 1);
  if (!store.profiles.length) {
    const fresh = makeProfile('');
    store.profiles.push(fresh);
    store.current = fresh.id;
    return true;
  }
  if (store.current === id) {
    store.current = store.profiles[Math.min(at, store.profiles.length - 1)].id;
  }
  return true;
}

export function loadStore(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length) {
        return {
          v: 2,
          current: parsed.current,
          profiles: parsed.profiles.map((p) => ({
            id: p.id || makeProfile().id,
            name: String(p.name || '').slice(0, 24),
            state: { ...emptyState(), ...(p.state || {}) },
          })),
        };
      }
    }
  } catch {
    /* fall through to migration */
  }

  // A device from before names: its one log becomes the first log, not a loss.
  const store = emptyStore();
  const first = makeProfile('', load(storage));
  store.profiles.push(first);
  store.current = first.id;
  return store;
}

export function saveStore(store, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/* ── Copies ────────────────────────────────────────────────────────────── */

/**
 * The log as a file the student can keep. The same shape as the stored state,
 * in a small envelope so a file can be recognised before it is trusted, and
 * dated so two copies in a downloads folder can be told apart.
 */
export function serialise(state, date = new Date(), profile = '') {
  return JSON.stringify(
    { app: 'scale-studio', kind: 'practice-log', v: 1, saved: dayKey(date), profile, state },
    null,
    2,
  );
}

/**
 * The log inside a file, or null if the text is not one. `profile` is the name it
 * was saved under — null for a file written before names existed, which is taken
 * at face value by whoever loads it.
 */
export function parse(text) {
  try {
    const data = JSON.parse(text);
    if (!data || data.app !== 'scale-studio' || data.kind !== 'practice-log') return null;
    // The envelope without a log inside is not a log: refusing it is better than
    // reporting "loaded" over a file that carried nothing.
    if (!data.state || typeof data.state !== 'object') return null;
    const state = { ...emptyState(), ...data.state };
    if (!state.days || typeof state.days !== 'object') return null;
    if (!Array.isArray(state.rests) || !state.scales || typeof state.scales !== 'object') return null;
    return { profile: typeof data.profile === 'string' ? data.profile : null, state };
  } catch {
    return null;
  }
}

/**
 * Adds a second copy into the first. Everything is a union, and takes are the
 * *larger* of the two rather than the sum, so loading the same file twice — or
 * loading it after the log has moved on — can never inflate a week's numbers.
 */
export function merge(into, other) {
  const out = {
    ...emptyState(),
    days: { ...(into.days || {}) },
    rests: [...(into.rests || [])],
    scales: { ...(into.scales || {}) },
    plan: into.plan || (other && other.plan) || '',
  };

  for (const [key, day] of Object.entries((other && other.days) || {})) {
    const mine = out.days[key] || { tags: [], takes: 0, hard: [] };
    out.days[key] = {
      tags: [...new Set([...(mine.tags || []), ...(day.tags || [])])],
      takes: Math.max(mine.takes || 0, day.takes || 0),
      hard: [...new Set([...(mine.hard || []), ...(day.hard || [])])],
    };
  }

  for (const key of (other && other.rests) || []) {
    if (!out.rests.includes(key)) out.rests.push(key);
  }
  out.rests.sort();

  for (const [id, entry] of Object.entries((other && other.scales) || {})) {
    const mine = out.scales[id] || { days: [], best: 0 };
    out.scales[id] = {
      days: [...new Set([...(mine.days || []), ...(entry.days || [])])],
      best: Math.max(mine.best || 0, entry.best || 0),
    };
  }

  return out;
}

/** How many days the log has an entry for — the number a copy is worth. */
export function totalDays(state) {
  return Object.keys(state.days || {}).length;
}
