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
  } catch {
    // A full or blocked store must never break the practice screen.
  }
}

export function clear(storage = globalThis.localStorage) {
  try {
    storage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
