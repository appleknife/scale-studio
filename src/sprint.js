// sprint.js — Note Sprint: the rules, kept apart from the screen.
//
// A student picks the notes they know, the app shows them one at a time, and
// each is "read" the moment it is played. Everything here is plain data in and
// out — the screen (sprintview.js) draws it, the microphone feeds it.
//
// What the scoring is built on, and why:
//   - Speed *and* accuracy, as a rate: notes read correctly per minute. That is
//     how fluency drills are measured (Precision Teaching): short timed sets,
//     charted day after day, the line going up.
//   - The student against their own past, never against another child. A
//     personal best is the headline; stars are a coarse guide, not a grade.
//   - A wrong note is noted quietly — it costs no time, and the note waits until
//     it is played. Children read faster when a slip is not a penalty.

/* ── The notes ────────────────────────────────────────────────────────── */

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** The violin's reading range for the app: the open G to level VI's top F. */
export const LOW = { letter: 'G', octave: 3 };
export const HIGH = { letter: 'F', octave: 6 };

export function midiOf(letter, alter, octave) {
  return 12 * (octave + 1) + NATURAL_PC[letter] + alter;
}

/** 'F#4', 'Bb3', 'C5'. */
export function noteId(letter, alter, octave) {
  return `${letter}${alter > 0 ? '#' : alter < 0 ? 'b' : ''}${octave}`;
}

export function parseId(id) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(id);
  if (!m) return null;
  const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const octave = Number(m[3]);
  return { id, letter: m[1], alter, octave, midi: midiOf(m[1], alter, octave) };
}

/** Pretty name for a note: F♯4, B♭3. */
export function displayName(id) {
  return id.replace('#', '♯').replace(/^([A-G])b/, '$1♭');
}

/**
 * Every row of the picker, low to high: one row per staff position, with the
 * natural, the sharp and the flat on it — E♯, B♯, F♭ and C♭ included, so every
 * column is complete. Only what sounds outside G3–F6 is left out: G♭3 is below
 * the open G, F♯6 above the top F.
 */
export function rows() {
  const out = [];
  let letterIndex = LETTERS.indexOf(LOW.letter);
  let octave = LOW.octave;
  for (;;) {
    const letter = LETTERS[letterIndex];
    const lo = midiOf(LOW.letter, 0, LOW.octave);
    const hi = midiOf(HIGH.letter, 0, HIGH.octave);
    const cell = (alter) => {
      const midi = midiOf(letter, alter, octave);
      if (midi < lo || midi > hi) return null;
      return { id: noteId(letter, alter, octave), letter, alter, octave, midi };
    };
    out.push({ letter, octave, natural: cell(0), sharp: cell(1), flat: cell(-1) });
    if (letter === HIGH.letter && octave === HIGH.octave) break;
    letterIndex += 1;
    if (letterIndex === 7) {
      letterIndex = 0;
      octave += 1;
    }
  }
  return out;
}

export const ALL_IDS = rows().flatMap((r) => [r.natural, r.sharp, r.flat].filter(Boolean).map((n) => n.id));

const naturalsBetween = (from, to) => {
  const a = parseId(from).midi;
  const b = parseId(to).midi;
  return rows()
    .map((r) => r.natural)
    .filter((n) => n && n.midi >= a && n.midi <= b)
    .map((n) => n.id);
};

/** Quick starting points, so nobody taps fifteen notes to begin. */
export const PRESETS = [
  { id: 'open', notes: ['G3', 'D4', 'A4', 'E5'] },
  { id: 'staff', notes: naturalsBetween('E4', 'F5') },
  { id: 'first', notes: naturalsBetween('G3', 'B5') },
  { id: 'below', notes: naturalsBetween('G3', 'D4') },
  { id: 'above', notes: naturalsBetween('G5', 'F6') },
];

/**
 * The string a note is usually first read on, in first position (for the
 * "weakest string" stat). Above B5 it is the E string, out of first position.
 */
export function stringOf(id) {
  const m = parseId(id).midi;
  if (m < 62) return 'G';
  if (m < 69) return 'D';
  if (m < 76) return 'A';
  return 'E';
}

/* ── A round ──────────────────────────────────────────────────────────── */

export const LENGTHS = [10, 20, 30];

/**
 * The notes of one sprint, in order.
 *   repeats off: every chosen note once, shuffled.
 *   repeats on:  `length` notes drawn from the chosen ones, never the same note
 *                twice in a row; with `weak`, the slower and more-missed notes
 *                come up more often (up to three times as often).
 */
export function makeDeck(chosen, { repeats = true, weak = false, length = 20, stats = null, rng = Math.random } = {}) {
  const ids = chosen.filter((id) => parseId(id));
  if (!ids.length) return [];
  if (!repeats) {
    const deck = ids.slice();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  const weights = ids.map((id) => (weak ? weakness(stats, id) : 1));
  const deck = [];
  for (let i = 0; i < length; i++) {
    const prev = deck[deck.length - 1];
    const pool = ids.length > 1 ? ids.map((id, k) => (id === prev ? 0 : weights[k])) : weights;
    const total = pool.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    let pick = ids[ids.length - 1];
    for (let k = 0; k < ids.length; k++) {
      roll -= pool[k];
      if (roll <= 0 && pool[k] > 0) {
        pick = ids[k];
        break;
      }
    }
    deck.push(pick);
  }
  return deck;
}

/**
 * How much more often a note should come up: 1 for a note read as fast as the
 * student's own average, up to 3 for one that is much slower or often missed.
 * A note never seen counts as a little weak, so new notes get their turn.
 */
export function weakness(stats, id) {
  const all = stats?.notes || {};
  const n = all[id];
  if (!n || !n.seen) return 1.6;
  const mine = n.totalMs / n.seen;
  const seen = Object.values(all).filter((x) => x.seen);
  const avg = seen.reduce((a, x) => a + x.totalMs / x.seen, 0) / seen.length;
  const slow = avg ? mine / avg : 1;
  const missRate = n.misses / (n.seen + n.misses);
  return Math.max(1, Math.min(3, slow + missRate * 3));
}

/* ── Hearing a note ───────────────────────────────────────────────────── */

const HOLD_RIGHT = 0.08; // seconds a right note must sound to count
const HOLD_WRONG = 0.16; // a wrong one has to be meant: slides and shifts pass
const SETTLE = 0.18; // after a right note, the next is not judged straight away

/**
 * Listens for one note at a time. `frame(t, midi)` takes a reading (fractional
 * midi or null) and returns an event, or null:
 *   { type: 'start' }               first sound: the clock starts
 *   { type: 'right', ms }           the note on screen was played
 *   { type: 'wrong', played }       a different note, held (once per target)
 */
export function createEar() {
  let target = null;
  let cand = null;
  let since = 0;
  let judged = false;
  let quietUntil = 0;
  let started = false;
  let shownAt = 0;
  let missedThis = new Set();
  let lastRight = null; // the note just read, which may still be ringing

  return {
    show(midi, t) {
      if (target != null && judged && cand === target) lastRight = target;
      target = midi;
      shownAt = t;
      missedThis = new Set();
      cand = null;
      judged = false;
    },
    settle(t) {
      quietUntil = t + SETTLE;
    },
    frame(t, midi) {
      if (midi == null) {
        cand = null;
        return null;
      }
      const m = Math.round(midi);
      if (m !== cand) {
        cand = m;
        since = t;
        judged = false;
        return null;
      }
      const held = t - since;
      if (!started && held >= HOLD_RIGHT) {
        started = true;
        // The clock starts at the first sound, not when the screen appeared.
        shownAt = since;
        if (m !== target) return { type: 'start' };
      }
      if (judged || t < quietUntil || target == null) return null;
      if (m === target && held >= HOLD_RIGHT) {
        judged = true;
        return { type: 'right', ms: Math.max(0, (since - shownAt) * 1000) };
      }
      // An octave off is the pitch tracker slipping far more often than the
      // student: it is not called a wrong note.
      // Nor is the note just read, still sounding after the next appears.
      if (m !== target && m !== lastRight && Math.abs(m - target) !== 12 && held >= HOLD_WRONG && !missedThis.has(m)) {
        judged = true;
        missedThis.add(m);
        return { type: 'wrong', played: m };
      }
      return null;
    },
    get started() {
      return started;
    },
  };
}

/* ── Scoring ──────────────────────────────────────────────────────────── */

/**
 * Stars from the average time per note and how many were right first time.
 * Reading a note and playing it takes most students well over a second at first;
 * the thresholds sit where a teacher would say "that is getting fluent".
 */
export const STAR_MS = { two: 2200, three: 1300 };

export function scoreRun(times, misses) {
  const n = times.length;
  const total = times.reduce((a, b) => a + b, 0);
  const avgMs = n ? total / n : 0;
  const firstTry = n ? (n - Math.min(n, misses.length)) / n : 0;
  const perMinute = total ? (n / total) * 60000 : 0;
  let stars = n ? 1 : 0;
  if (n && avgMs <= STAR_MS.two && firstTry >= 0.7) stars = 2;
  if (n && avgMs <= STAR_MS.three && firstTry >= 0.9) stars = 3;
  return { notes: n, totalMs: total, avgMs, perMinute, firstTry, stars };
}

/** Which set of notes a run was: the same set, in any order, is the same race. */
export function setKey(chosen) {
  return chosen.slice().sort((a, b) => parseId(a).midi - parseId(b).midi || a.localeCompare(b)).join(' ');
}

/* ── Keeping it ───────────────────────────────────────────────────────── */

export function storageKey(profileId) {
  return `scaleStudio.sprint.v1.${profileId || 'default'}`;
}

export function emptyStats() {
  return {
    v: 1,
    picked: PRESETS[1].notes.slice(),
    opts: { repeats: true, weak: false, length: 20 },
    runs: [], // { at, set, notes, totalMs, avgMs, perMinute, firstTry, stars, misses }
    notes: {}, // { [id]: { seen, totalMs, bestMs, misses } }
    mixups: {}, // { 'B4>C5': n } — wanted B4, played C5
    bests: {}, // { [setKey]: avgMs }
    streak: 0, // best run of right-first-time notes, ever
  };
}

export function loadStats(profileId, store = localStorage) {
  try {
    const raw = store.getItem(storageKey(profileId));
    if (!raw) return emptyStats();
    const s = JSON.parse(raw);
    const base = emptyStats();
    return {
      ...base,
      ...s,
      opts: { ...base.opts, ...(s.opts || {}) },
      picked: Array.isArray(s.picked) ? s.picked.filter((id) => ALL_IDS.includes(id)) : base.picked,
      runs: Array.isArray(s.runs) ? s.runs : [],
      notes: s.notes || {},
      mixups: s.mixups || {},
      bests: s.bests || {},
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(profileId, stats, store = localStorage) {
  try {
    store.setItem(storageKey(profileId), JSON.stringify(stats));
  } catch {
    /* full or blocked: the run still shows, it just is not kept */
  }
}

/**
 * Files a finished run. `steps` is one entry per note on screen:
 * { id, ms, wrong: [midi…] }. Returns the score and what was new about it.
 */
export function recordRun(stats, chosen, steps, at = Date.now()) {
  const times = steps.map((s) => s.ms);
  const misses = steps.flatMap((s) => s.wrong.map((w) => ({ id: s.id, played: w })));
  const score = scoreRun(times, steps.filter((s) => s.wrong.length));
  const key = setKey(chosen);
  const previous = stats.bests[key];
  const best = previous == null || score.avgMs < previous;
  if (best) stats.bests[key] = score.avgMs;

  let run = 0;
  let longest = 0;
  for (const s of steps) {
    const n = (stats.notes[s.id] = stats.notes[s.id] || { seen: 0, totalMs: 0, bestMs: null, misses: 0 });
    n.seen += 1;
    n.totalMs += s.ms;
    if (n.bestMs == null || s.ms < n.bestMs) n.bestMs = s.ms;
    n.misses += s.wrong.length;
    run = s.wrong.length ? 0 : run + 1;
    longest = Math.max(longest, run);
  }
  for (const m of misses) {
    const k = `${m.id}>${m.played}`;
    stats.mixups[k] = (stats.mixups[k] || 0) + 1;
  }
  const streakBest = longest > (stats.streak || 0);
  stats.streak = Math.max(stats.streak || 0, longest);
  stats.runs.push({
    at,
    set: key,
    notes: score.notes,
    totalMs: Math.round(score.totalMs),
    avgMs: Math.round(score.avgMs),
    perMinute: Math.round(score.perMinute * 10) / 10,
    firstTry: Math.round(score.firstTry * 100) / 100,
    stars: score.stars,
    misses: misses.length,
  });
  if (stats.runs.length > 300) stats.runs = stats.runs.slice(-300);
  return { ...score, best, firstOfSet: previous == null, previousBest: previous ?? null, longest, streakBest };
}

/* ── What the numbers say ─────────────────────────────────────────────── */

/** The name of a midi note, spelled the way the student most likely read it. */
export function playedName(midi) {
  const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
  return displayName(`${names[midi % 12]}${Math.floor(midi / 12) - 1}`);
}

export function summary(stats) {
  const runs = stats.runs || [];
  const notesRead = runs.reduce((a, r) => a + r.notes, 0);
  const avg = (list) => {
    const n = list.reduce((a, r) => a + r.notes, 0);
    return n ? list.reduce((a, r) => a + r.avgMs * r.notes, 0) / n : null;
  };
  const day = 86400000;
  const now = Date.now();
  const thisWeek = runs.filter((r) => now - r.at < 7 * day);
  const before = runs.filter((r) => now - r.at >= 7 * day);

  const perNote = Object.entries(stats.notes || {})
    .filter(([, n]) => n.seen >= 2)
    .map(([id, n]) => ({ id, avgMs: n.totalMs / n.seen, seen: n.seen, misses: n.misses, bestMs: n.bestMs }))
    .sort((a, b) => a.avgMs - b.avgMs);

  const strings = {};
  for (const [id, n] of Object.entries(stats.notes || {})) {
    if (!n.seen) continue;
    const s = (strings[stringOf(id)] = strings[stringOf(id)] || { seen: 0, totalMs: 0 });
    s.seen += n.seen;
    s.totalMs += n.totalMs;
  }
  const stringList = Object.entries(strings)
    .filter(([, s]) => s.seen >= 3)
    .map(([name, s]) => ({ name, avgMs: s.totalMs / s.seen }))
    .sort((a, b) => a.avgMs - b.avgMs);

  const mixups = Object.entries(stats.mixups || {})
    .map(([k, n]) => {
      const [want, played] = k.split('>');
      return { want, played: Number(played), n };
    })
    .sort((a, b) => b.n - a.n);

  const fastest = runs.length ? runs.reduce((a, r) => (r.avgMs < a.avgMs && r.notes >= 5 ? r : a), runs[0]) : null;

  return {
    runs: runs.length,
    notesRead,
    avgMs: avg(runs),
    weekAvgMs: avg(thisWeek),
    beforeAvgMs: avg(before),
    trend: runs.slice(-20).map((r) => r.avgMs),
    // With only a few notes timed, fastest and slowest would name the same notes
    // twice; the two halves never overlap.
    strongest: perNote.slice(0, Math.min(3, Math.floor(perNote.length / 2))),
    weakest: perNote.slice(perNote.length - Math.min(3, Math.floor(perNote.length / 2))).reverse(),
    perNote,
    strings: stringList,
    mixups: mixups.slice(0, 4),
    streak: stats.streak || 0,
    fastest,
    threeStars: runs.filter((r) => r.stars === 3).length,
  };
}
