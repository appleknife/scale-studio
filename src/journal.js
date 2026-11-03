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
//     playing into practicing, and it is what the teacher can use next lesson.

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
  return { v: 1, days: {}, rests: [], plan: '', scales: {}, goal: null, takes: [] };
}

/**
 * The last few hundred takes, in order, with what each one was made of.
 *
 * The scores alone were enough for "what is my best on this scale", but not for
the questions a player actually asks a stat tracker: am I getting steadier? is my
intonation better on the A string or the E? which day of the week do I play well?
Those need the four parts, the scale, the level and the time, kept per take.
 *
 * Four hundred is a school year of a few takes a day, and about 40 kB of text —
 * small enough to keep entirely on the device, which is the only place it goes.
 */
export const TAKES_KEPT = 400;

/**
 * Whether a take is really a take.
 *
 * Students press start to see what happens, hold the phone away from the violin,
 * or let a sibling shout into it. Those records do not belong in a stat screen:
 * they would drag an average down for a year, and a child watching their "best"
 * line fall because of a pocket tap learns the wrong thing about their playing.
 *
 * So a take is set aside when it is obviously not an attempt — not when it is
 * merely bad. The rules are deliberately narrow, and every one of them is about
the *evidence*, not the score: nothing was heard, almost nothing was heard, or
it was over before anybody could have played a scale.
 */
export function looksLikeTrial({ heard = 0, expected = 0, seconds = 0, score = 0 } = {}) {
  if (heard < 3) return true;                       // a tap, a cough, a room
  if (seconds > 0 && seconds < 2.5) return true;    // over before a scale could start
  if (expected > 0 && heard < expected * 0.34) return true; // gave up at the first bar
  if (score < 25 && heard < expected * 0.6) return true;    // a handful of stray notes
  return false;
}

export function recordTake(state, take) {
  if (!Array.isArray(state.takes)) state.takes = [];
  const entry = {
    // A stable identity for this take, so one can be deleted later: two takes can
    // share a timestamp to the millisecond, and a timestamp is not a key.
    uid: take.uid || `${Date.now().toString(36)}-${(state.takes.length + 1).toString(36)}`,
    at: take.at || new Date().toISOString(),
    key: take.key || dayKey(),
    kind: take.kind || 'scale',
    id: take.id || '',
    level: take.level || '',
    score: Math.round(take.score || 0),
    parts: take.parts || null,
    bpm: take.bpm || 0,
    heard: take.heard || 0,
    expected: take.expected || 0,
    // A run with the clicks and the moving line. Recorded, not hidden — but read
    // separately, because a score with the wheels on is a different claim.
    assisted: Boolean(take.assisted),
    // Kept, not discarded: a teacher may want to know that a run happened, and
    // the flag is what the averages read. Old records have no flag and count.
    counted: take.counted !== false,
  };
  state.takes.push(entry);
  if (state.takes.length > TAKES_KEPT) {
    state.takes.splice(0, state.takes.length - TAKES_KEPT);
  }
  return entry;
}

/** The takes, newest last, optionally one kind ("scale" or "sight"). */
export function recentTakes(state, { kind = null, limit = TAKES_KEPT, counted = false } = {}) {
  const all = Array.isArray(state.takes) ? state.takes : [];
  const filtered = all.filter(
    (t) => (!kind || t.kind === kind) && (!counted || t.counted !== false),
  );
  return filtered.slice(-limit);
}

/** How many takes were set aside as test runs. */
export function trialsIgnored(state) {
  const all = Array.isArray(state.takes) ? state.takes : [];
  return all.filter((t) => t.counted === false).length;
}

/**
 * Per-scale totals, for a leaderboard of your own scales: attempts, best,
 * average, and the recent scores a sparkline would draw.
 */
export function scaleTotals(state, ids = []) {
  const byScale = new Map();
  for (const take of recentTakes(state, { kind: 'scale', counted: true })) {
    if (!take.id) continue;
    const cell = byScale.get(take.id) || { id: take.id, scores: [], best: 0, last: null };
    cell.scores.push(take.score);
    cell.best = Math.max(cell.best, take.score);
    cell.last = take;
    byScale.set(take.id, cell);
  }
  return [...byScale.values()]
    .map((cell) => ({
      id: cell.id,
      attempts: cell.scores.length,
      best: cell.best,
      average: cell.scores.reduce((a, b) => a + b, 0) / cell.scores.length,
      recent: cell.scores.slice(-12),
      last: cell.last,
    }))
    .sort((a, b) => b.average - a.average)
    .filter((row) => !ids.length || ids.includes(row.id));
}

/**
 * The four parts of a take, averaged over the last `window` takes of a kind.
 * This is the "am I getting better at anything in particular" question, and the
 * reason the parts are stored at all.
 */
export function partAverages(state, { kind = 'scale', window = 12 } = {}) {
  const takes = recentTakes(state, { kind, limit: window, counted: true }).filter((t) => t.parts);
  if (!takes.length) return null;
  const keys = ['accuracy', 'intonation', 'rhythm', 'flow'];
  const avg = {};
  for (const key of keys) {
    const values = takes.map((t) => t.parts[key]).filter((v) => Number.isFinite(v));
    avg[key] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }
  return { ...avg, takes: takes.length };
}

/**
 * The weekly goals a student can pick from. A short menu rather than a free-text
 * box: the evidence on goal setting favours specific, close-at-hand goals, and
 * "practice more" is neither. The student still chooses, which is the autonomy
 * part — the app only offers shapes that can be counted honestly.
 */
/**
 * What the audition asks for, by level group — straight from the Manual.
 *
 * Levels I–II: three scales, one octave, chosen by the student. III–IV: seven,
 * two of them in two octaves, also chosen. V–VI: fifteen major scales in two
 * octaves, which in this app is twelve keys, because C♯ and D♭ are the same
 * scale played the same way.
 *
 * The point of writing it down here is that the log can then say "two of three"
 * to a beginner instead of showing twelve scales and implying they all have to
 * be ready. The `choose` flag is what makes that difference: at I–IV any three
 * (or seven) will do, so the app counts how many are ready and lets the student
 * pick; at V–VI every key is required, so the count is the whole list.
 */
export const AUDITION = {
  '1-2': { need: 3, octaves: 1, choose: true },
  '3-4': { need: 7, octaves: 2, choose: true },
  '5-6': { need: 12, octaves: 2, choose: false },
};

/** The scales a beginner is usually given first: open strings, one pattern. */
export const FIRST_THREE = ['G', 'D', 'A'];

export function auditionLevel(state) {
  return AUDITION[state.audition] ? state.audition : '5-6';
}

export function setAudition(state, group) {
  state.audition = AUDITION[group] ? group : '5-6';
  return state.audition;
}

/** How far through the level's requirement the student is. */
export function auditionProgress(state, ids = [], today = dayKey()) {
  const group = auditionLevel(state);
  const spec = AUDITION[group];
  const ready = scalesReady(state, ids).filter((s) => s.ready);
  return {
    group,
    ...spec,
    ready: ready.length,
    readyIds: ready.map((s) => s.id),
    // At I–IV the requirement is met by *any* of them, so the count stops at the
    // requirement rather than running to twelve and looking like a failure.
    done: spec.choose ? Math.min(ready.length, spec.need) : ready.length,
    met: ready.length >= spec.need,
  };
}

export const GOALS = [
  { kind: 'days', target: 3 },
  { kind: 'days', target: 5 },
  { kind: 'ready', target: 1 },
  { kind: 'ready', target: 2 },
];

export function setGoal(state, kind, target) {
  if (!kind || !target) {
    state.goal = null;
    return null;
  }
  state.goal = { kind, target: Math.max(1, Math.min(7, Number(target) || 1)) };
  return state.goal;
}

export function goalKey(goal) {
  return goal ? `${goal.kind}:${goal.target}` : '';
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

export function practiced(state, key) {
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
  remember(entry, key, score);
  return entry;
}

/** How many takes of one scale are kept. A dozen is enough to know whether this
 *  week beats last, and small enough that a log cannot grow without bound. */
export const HISTORY = 12;

function remember(entry, key, score) {
  if (!Array.isArray(entry.history)) entry.history = [];
  entry.history.push({ key, score });
  if (entry.history.length > HISTORY) entry.history.splice(0, entry.history.length - HISTORY);
  return entry.history;
}

/**
 * Rebuilds the per-scale and per-level records from the takes that are left.
 *
 * Those records are derived data — a best, a dozen scores, the days a scale was
 * played cleanly — so after a deletion there is nothing to un-add one by one:
 * the honest thing is to work them out again from what remains. The practice log
 * is *not* derived this way, because a day can also be logged by hand.
 */
function rebuildScores(state) {
  state.scales = {};
  state.sight = {};
  for (const take of Array.isArray(state.takes) ? state.takes : []) {
    if (take.counted === false) continue;
    if (take.kind === 'sight') noteSight(state, take.level, take.key, take.score);
    else if (take.kind === 'scale' && take.id) noteScale(state, take.id, take.key, take.score);
  }
}

/**
 * Removes one take — an accidental one, a test someone played, a take whose
 * microphone heard the wrong instrument.
 *
 * The take goes, the scale and level records are rebuilt without it, and the day
 * it was played stays if anything else happened on it. Deleting a take is not
 * meant to rewrite the past, only to undo a mistake.
 *
 * @returns whether a take with that timestamp was there to remove.
 */
export function removeTake(state, uid) {
  const list = Array.isArray(state.takes) ? state.takes : [];
  // By uid; a record written before uids existed is matched by its timestamp.
  const index = list.findIndex((take) => take && (take.uid === uid || take.at === uid));
  if (index < 0) return false;
  const [gone] = list.splice(index, 1);
  rebuildScores(state);

  const day = state.days && state.days[gone.key];
  if (day) {
    day.takes = Math.max(0, (day.takes || 0) - 1);
    if (day.takes === 0) {
      // The day was only there because of takes: drop the tags a take added, and
      // the day itself if nothing else is on it.
      day.tags = (day.tags || []).filter((tag) => tag !== 'scales' && tag !== 'sight');
      if (!day.tags.length && !(day.hard || []).length) delete state.days[gone.key];
    }
  }
  return true;
}

/**
 * Erases this person's whole record: every take, every day, every best, the goal.
 *
 * Deliberately total, and deliberately theirs — the log is per person on a shared
 * device, so one student starting again does not touch a sibling's. The app asks
 * twice before doing it; nothing here asks anything.
 */
export function clearStats(state) {
  state.takes = [];
  state.days = {};
  state.rests = [];
  state.scales = {};
  state.sight = {};
  state.goal = null;
  return state;
}
/**
 * How this take compares with the ones before it.
 *
 * Strict in what it counts — a "best" is only a best among takes recorded on
 * this device — and gentle in what it says: the first take of a scale is told
 * so rather than being called an improvement on nothing, and the number quoted
 * is the previous best, because "the furthest you have got" is the useful
 * sentence.
 */
export function compareTake(entry, score) {
  const history = (entry && entry.history) || [];
  if (!history.length) return { first: true, delta: 0, best: score, isBest: true, takes: 0 };
  const best = history.reduce((m, h) => Math.max(m, h.score), 0);
  return { first: false, delta: score - best, best, isBest: score > best, takes: history.length };
}

/**
 * Sight reading is counted per level rather than per key: a level VI page is a
 * level VI page whatever it happens to be in.
 */
export function noteSight(state, level, key, score) {
  if (!state.sight) state.sight = {};
  const entry = state.sight[level] || (state.sight[level] = { best: 0, history: [] });
  entry.best = Math.max(entry.best, score);
  remember(entry, key, score);
  return entry;
}

export function sightEntry(state, level) {
  return (state.sight && state.sight[level]) || { best: 0, history: [] };
}

export function scaleEntry(state, id) {
  return state.scales[id] || null;
}

/* ── Reading it back ───────────────────────────────────────────────────── */

/**
 * Days in a row. Today does not break the streak until it is over: in the
 * morning the number is yesterday's, which is what people expect and what keeps
 * a good habit from looking lost before breakfast.
 */
export function streak(state, today) {
  let key = today;
  if (!practiced(state, key) && !isRest(state, key)) key = addDays(key, -1);
  let count = 0;
  for (let guard = 0; guard < 800; guard++) {
    if (practiced(state, key)) count += 1;
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
        practiced: practiced(state, key),
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
    if (practiced(state, key)) days += 1;
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

/**
 * Progress against the student's own weekly goal.
 *
 * Weeks run Monday to Sunday, and only days up to today count — a goal is not
 * "failed" in advance because it is Wednesday.
 */
export function goalProgress(state, today, ids = []) {
  if (!state.goal) return null;
  const { kind, target } = state.goal;
  const done = kind === 'ready' ? readyThisWeek(state, ids, today) : weekSheet(state, today, ids).days;
  return {
    kind,
    target,
    done: Math.min(done, target),
    met: done >= target,
    raw: done,
  };
}

/**
 * Scales that *became* ready this week — the day they were completed, not the
 * total standing on the shelf, which would make the same scale count every week.
 */
export function readyBetween(state, ids = [], from = dayKey(), to = dayKey()) {
  return ids.filter((id) => {
    const entry = state.scales[id];
    if (!entry || !entry.days || entry.days.length < READY_DAYS) return false;
    // The day it *became* ready — the second clean day — not the latest day it
    // was played, or a scale polished for a month would count every week.
    const completeOn = entry.days[READY_DAYS - 1];
    return Boolean(completeOn) && completeOn >= from && completeOn <= to;
  });
}

export function readyThisWeek(state, ids = [], today = dayKey()) {
  return readyBetween(state, ids, weekStart(today), today).length;
}

/** Scales that became ready this week, by id, for naming them in the app. */
export function readyNames(state, ids = [], today = dayKey()) {
  return readyBetween(state, ids, weekStart(today), today);
}

/**
 * This week against last week, in the terms a student can feel: days, takes and
 * scales that came good. Everything here is counted from the log, so nothing can
 * flatter itself. Returns nulls rather than zeroes where there is no comparison
 * to make yet — "no last week to compare" is honest, "0" is not.
 */
export function smallWins(state, today, ids = []) {
  const thisMonday = weekStart(today);
  const lastMonday = addDays(thisMonday, -7);
  const countWeek = (monday) => {
    let days = 0;
    let takes = 0;
    for (let d = 0; d < 7; d++) {
      const key = addDays(monday, d);
      if (key > today) break;
      if (practiced(state, key)) days += 1;
      const day = state.days[key];
      if (day) takes += day.takes || 0;
    }
    return { days, takes };
  };
  const now = countWeek(thisMonday);
  const before = countWeek(lastMonday);
  return {
    days: now.days,
    takes: now.takes,
    lastDays: state.days && Object.keys(state.days).length ? before.days : null,
    lastTakes: Object.keys(state.days || {}).length ? before.takes : null,
    readyNow: readyThisWeek(state, ids, today),
    readyBefore: readyBetween(state, ids, lastMonday, addDays(thisMonday, -1)).length,
    readyNames: readyNames(state, ids, today),
    hasAnyHistory: Object.keys(state.days || {}).length > 0,
  };
}

/**
 * The note at the end of the week sheet.
 *
 * This is the one place the app talks to the student rather than about them, so
 * it is built from what the log actually holds and nothing else: no praise for
 * days that were not practised, and no scolding for a week that was thin. What
 * it can do is notice — the goal that was met, the scale that came good, the
 * thing they said was hard, the run they are on — and say which one it saw.
 *
 * Returns a descriptor; the screens own the language. Journal logic stays
 * testable, and the sentences stay translatable.
 */
export function weekNote(state, today, ids = []) {
  const sheet = weekSheet(state, today, ids);
  const goal = goalProgress(state, today, ids);
  const wins = smallWins(state, today, ids);
  const ready = readyNames(state, ids, today);
  const base = {
    days: sheet.days,
    target: goal ? goal.target : 0,
    done: goal ? goal.raw : 0,
    hard: sheet.hard.length ? sheet.hard[0].key : null,
    ready,
    streak: streak(state, today),
    takes: sheet.takes,
  };

  if (!wins.hasAnyHistory) return { kind: 'start', ...base };
  if (goal && goal.met) return { kind: 'goalMet', ...base };
  // One day short is a different sentence from far short: it is still reachable.
  if (goal && goal.target - goal.raw === 1) return { kind: 'goalNear', ...base };
  if (goal) return { kind: 'goalShort', ...base };
  if (sheet.days >= 4) return { kind: 'plenty', ...base };
  if (sheet.days >= 1) return { kind: 'some', ...base };
  return { kind: 'quiet', ...base };
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
