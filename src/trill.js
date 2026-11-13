// trill.js — the trill trainer's rules: which two notes, the ladder of steps,
// and what a take of trilling is measured for. No DOM, no microphone: the page
// (trillview.js) feeds it pitch frames and paints what it says.
//
// Why it is built the way it is. How violinists are taught to trill is one of
// the more agreed-upon corners of the technique, and the same handful of points
// come up from Ševčík's Op. 7 to Simon Fischer:
//
//   - a trill is one finger tapping against a note held by the finger behind
//     it (or the open string); the lower finger stays down;
//   - the work is the LIFT, not the drop. "Lift the trilling finger as if the
//     string were hot"; the fall is only the rebound. A finger that is pressed
//     down and left there is the commonest fault, and it is a slow, heavy trill;
//   - light fingers. Speed comes from less weight, never from more effort, and
//     a trill that tenses is being practised wrongly;
//   - measured before free. With a click at 60: two notes to the beat, then
//     three, four, six, eight — the click stays where it is and the notes
//     divide. Even at one step before fast at the next;
//   - every pair of fingers, because they are not alike: 1–2 is the easy one,
//     3–4 the weak one, and a trill is only as good as its worst pair.
//
// So that is the mode: pick a string and a pair of fingers, climb the ladder of
// notes-per-beat against a click, and finish on a free trill. What the
// microphone can honestly tell from the pitch going up and down is exactly what
// those points ask about, so that is what is measured:
//
//   pace      how many notes a beat (or a second) — is it with the click?
//   evenness  is every wiggle the same length as the last?
//   balance   how the time divides between the two notes. Half and half is a
//             finger that lifts as fast as it falls; long on the top note is
//             the finger left down; long on the bottom is one that only dabs;
//   reach     does the upper note arrive at its pitch, or fall short — the
//             finger landing on its spot, properly, every time.
//
// It cannot see tension or finger height, and says so nowhere: those stay with
// the teacher.

/** The four strings, open, as MIDI notes. */
export const STRINGS = [
  { id: 'G', midi: 55 },
  { id: 'D', midi: 62 },
  { id: 'A', midi: 69 },
  { id: 'E', midi: 76 },
];

/**
 * The four pairs of neighbours, lowest finger first, with the frame of the hand
 * each is usually first met in (semitones above the open string) and the other
 * spacing it can be asked for in. `usual` is which of the two is the default.
 */
export const PAIRS = [
  { id: '01', lower: 0, upper: 1, whole: [0, 2], half: [0, 1], usual: 'whole' },
  { id: '12', lower: 1, upper: 2, whole: [2, 4], half: [2, 3], usual: 'whole' },
  { id: '23', lower: 2, upper: 3, whole: [3, 5], half: [4, 5], usual: 'half' },
  { id: '34', lower: 3, upper: 4, whole: [5, 7], half: [5, 6], usual: 'whole' },
];

/**
 * The ladder. `per` is notes to the beat; the last step has no click to keep
 * to and is simply as fast as stays even.
 */
export const STEPS = [
  { id: 'two', per: 2 },
  { id: 'three', per: 3 },
  { id: 'four', per: 4 },
  { id: 'six', per: 6 },
  { id: 'eight', per: 8 },
  { id: 'free', per: 0 },
];

export const TEMPO = { min: 40, max: 96, start: 60, step: 4 };

/** How long a measured take lasts, in beats, after the count-in; and a free one, in seconds. */
export const TAKE_BEATS = 8;
export const FREE_SECONDS = 6;
export const COUNT_IN = 4;

const NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** A note's name with its octave. The lowered fingers are spelled as flats. */
export function nameOf(midi, flat = false) {
  const pc = ((midi % 12) + 12) % 12;
  return `${(flat ? NAMES_FLAT : NAMES_SHARP)[pc]}${Math.floor(midi / 12) - 1}`;
}

export const pairById = (id) => PAIRS.find((p) => p.id === id) || PAIRS[1];
export const stringById = (id) => STRINGS.find((s) => s.id === id) || STRINGS[2];
export const stepById = (id) => STEPS.find((s) => s.id === id) || STEPS[0];

/** The two notes of a trill: which string, which fingers, a whole or a half step. */
export function notesFor(stringId, pairId, spacing) {
  const string = stringById(stringId);
  const pair = pairById(pairId);
  const space = spacing === 'half' || spacing === 'whole' ? spacing : pair.usual;
  const [lo, hi] = pair[space];
  const low = string.midi + lo;
  const high = string.midi + hi;
  // In the usual frame the fingers are 2, 4, 5, 7 semitones up. Anything lower
  // than that is a lowered finger, and is written as a flat.
  const frame = [0, 2, 4, 5, 7];
  return {
    string: string.id,
    pair: pair.id,
    spacing: space,
    low,
    high,
    interval: high - low,
    lowName: nameOf(low, lo < frame[pair.lower]),
    highName: nameOf(high, hi < frame[pair.upper]),
    lowFinger: pair.lower,
    highFinger: pair.upper,
  };
}

/** What a step asks for, in notes a second, at a tempo. Nothing for the free step. */
export function targetRate(step, bpm) {
  return step.per ? (step.per * bpm) / 60 : 0;
}

/* ── Listening ──────────────────────────────────────────────────────────── */

/**
 * Where a frame's pitch sits between the two notes: 0 on the lower, 1 on the
 * upper. Null if nothing clear was heard, or it was some other note entirely.
 */
export function placeOf(frame, notes) {
  if (!frame || !frame.freq || frame.clarity < 0.5) return null;
  const cents = 1200 * Math.log2(frame.freq / hz(notes.low));
  const span = notes.interval * 100;
  // An octave slip of the tracker is the same two notes: fold it back.
  let c = cents;
  if (c > span + 600) c -= 1200;
  else if (c < -600) c += 1200;
  if (c < -90 || c > span + 90) return null;
  return c / span;
}

/**
 * A take of trilling, measured.
 *
 * `frames` are { t (seconds), freq, clarity } as the microphone hands them over.
 * The pitch is followed across the halfway line between the two notes; each
 * upward crossing starts a cycle. Crossing times are read between frames (the
 * pitch slides through the middle, and where it would have crossed is a better
 * clock than the 30 ms the frames come at).
 */
export function analyse(frames, notes, { bpm = TEMPO.start, step = STEPS[0] } = {}) {
  const pts = [];
  for (const f of frames) {
    const p = placeOf(f, notes);
    if (p != null) pts.push({ t: f.t, p });
  }
  const empty = {
    heard: pts.length,
    cycles: 0,
    rate: 0,
    perBeat: 0,
    even: 0,
    balance: 0.5,
    reach: 0,
    seconds: 0,
    crossings: [],
  };
  if (pts.length < 6) return { ...empty, verdict: verdictOf(empty, step, bpm) };

  // Up- and down-crossings of the middle. A gap in the hearing (a breath of
  // noise, the click in the microphone) is bridged if it is short; a long one
  // breaks the run, and only the longest run is measured.
  const ups = [];
  const downs = [];
  let runs = [[]];
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    if (b.t - a.t > 0.2) {
      runs.push([]);
      continue;
    }
    if ((a.p < 0.5 && b.p >= 0.5) || (a.p >= 0.5 && b.p < 0.5)) {
      const f = (0.5 - a.p) / (b.p - a.p || 1);
      const at = a.t + (b.t - a.t) * f;
      runs[runs.length - 1].push({ t: at, up: b.p >= 0.5 });
    }
  }
  // A crossing and its undoing inside 25 ms is the tracker wavering on the
  // line, not a finger: drop the pair.
  runs = runs.map((run) => {
    const kept = [];
    for (const c of run) {
      const last = kept[kept.length - 1];
      if (last && c.t - last.t < 0.025 && last.up !== c.up) kept.pop();
      else kept.push(c);
    }
    return kept;
  });
  const run = runs.reduce((best, r) => (r.length > best.length ? r : best), []);
  for (const c of run) (c.up ? ups : downs).push(c.t);
  if (ups.length < 3) {
    const few = { ...empty, cycles: Math.max(0, ups.length - 1), crossings: run };
    return { ...few, verdict: verdictOf(few, step, bpm) };
  }

  const periods = [];
  for (let i = 1; i < ups.length; i += 1) periods.push(ups[i] - ups[i - 1]);
  const sorted = periods.slice().sort((x, y) => x - y);
  const median = sorted[Math.floor(sorted.length / 2)];
  // Evenness from how far a typical cycle strays from the middle one. The
  // median of the misses, so one stumble does not condemn a steady trill.
  const misses = periods.map((p) => Math.abs(p - median) / median).sort((x, y) => x - y);
  const wobble = misses[Math.floor(misses.length / 2)];

  // Time spent above the middle, cycle by cycle.
  let upTime = 0;
  let allTime = 0;
  for (let i = 0; i < ups.length - 1; i += 1) {
    const down = downs.find((d) => d > ups[i] && d < ups[i + 1]);
    if (down == null) continue;
    upTime += down - ups[i];
    allTime += ups[i + 1] - ups[i];
  }
  const balance = allTime > 0 ? upTime / allTime : 0.5;

  // How high the upper note gets: the top of what was heard between the first
  // and last crossing, not the average (the frames in between are mid-slide).
  const inside = pts.filter((q) => q.t >= ups[0] && q.t <= ups[ups.length - 1]).map((q) => q.p);
  inside.sort((x, y) => x - y);
  const top = inside[Math.floor(inside.length * 0.9)] ?? 1;
  const reachCents = (top - 1) * notes.interval * 100;

  const rate = 2 / median; // notes a second
  const result = {
    heard: pts.length,
    cycles: periods.length,
    rate,
    perBeat: (rate * 60) / bpm,
    even: Math.max(0, Math.min(100, Math.round(100 - wobble * 300))),
    balance,
    reach: Math.round(reachCents),
    seconds: ups[ups.length - 1] - ups[0],
    crossings: run,
  };
  return { ...result, verdict: verdictOf(result, step, bpm) };
}

/** Even enough to go on, and the least number of cycles worth judging. */
export const EVEN_PASS = 72;
const MIN_CYCLES = 4;

/**
 * What to say about a take. One thing — the first that applies, in the order a
 * teacher would mind them — and whether the step is done.
 *
 *   none     no trill was heard
 *   short    a few wiggles, not enough to judge
 *   reach    the upper note is falling short of its pitch
 *   stuck    long on the upper note: the finger is being left down
 *   dab      long on the lower note: the finger only brushes the string
 *   uneven   the cycles are not alike
 *   slow / fast   not with the click (measured steps only)
 *   good     all of the above are fine
 */
export function verdictOf(r, step, bpm) {
  if (r.cycles < 1) return { id: 'none', pass: false };
  if (r.cycles < MIN_CYCLES) return { id: 'short', pass: false };
  if (r.reach < -30) return { id: 'reach', pass: false };
  if (r.balance > 0.63) return { id: 'stuck', pass: false };
  if (r.balance < 0.37) return { id: 'dab', pass: false };
  if (r.even < EVEN_PASS) return { id: 'uneven', pass: false };
  if (step.per) {
    const off = r.perBeat / step.per;
    if (off < 0.85) return { id: 'slow', pass: false };
    if (off > 1.18) return { id: 'fast', pass: false };
  }
  return { id: 'good', pass: true };
}

/* ── What is remembered ─────────────────────────────────────────────────── */

export function storageKey(profileId) {
  return `scaleStudio.trill.v1.${profileId || 'default'}`;
}

export function emptyStats() {
  return {
    v: 1,
    opts: { string: 'A', pair: '12', spacing: '', bpm: TEMPO.start, click: true },
    // { 'A:12:whole': { done: ['two', 'three'], best: 9.6, runs: 4, last: '2026-11-12' } }
    sets: {},
    runs: 0,
    // One line a judged take, newest last, for the stats page:
    // { d: '2026-11-13', k: 'A:12:whole', s: 'four', r: 6.4, e: 81, p: 1 }
    log: [],
  };
}

/** The most takes the log keeps: months of practice, and still a small save. */
export const LOG_LIMIT = 300;

export function loadStats(profileId, store = localStorage) {
  const base = emptyStats();
  try {
    const raw = store.getItem(storageKey(profileId));
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    const opts = { ...base.opts, ...(parsed.opts && typeof parsed.opts === 'object' ? parsed.opts : {}) };
    opts.string = stringById(opts.string).id;
    opts.pair = pairById(opts.pair).id;
    opts.bpm = Math.min(TEMPO.max, Math.max(TEMPO.min, Math.round(Number(opts.bpm)) || TEMPO.start));
    opts.click = opts.click !== false;
    const sets = {};
    for (const [key, value] of Object.entries(parsed.sets && typeof parsed.sets === 'object' ? parsed.sets : {})) {
      if (!value || typeof value !== 'object') continue;
      sets[key] = {
        done: Array.isArray(value.done) ? value.done.filter((id) => STEPS.some((s) => s.id === id)) : [],
        best: Number(value.best) > 0 ? Number(value.best) : 0,
        runs: Math.max(0, Math.round(Number(value.runs)) || 0),
        last: typeof value.last === 'string' ? value.last : '',
      };
    }
    const log = (Array.isArray(parsed.log) ? parsed.log : [])
      .filter((x) => x && typeof x === 'object' && typeof x.k === 'string' && STEPS.some((st) => st.id === x.s))
      .map((x) => ({
        d: typeof x.d === 'string' ? x.d : '',
        k: x.k,
        s: x.s,
        r: Math.max(0, Number(x.r) || 0),
        e: Math.max(0, Math.min(100, Math.round(Number(x.e)) || 0)),
        p: x.p ? 1 : 0,
      }))
      .slice(-LOG_LIMIT);
    return { v: 1, opts, sets, runs: Math.max(0, Math.round(Number(parsed.runs)) || 0), log };
  } catch {
    return base;
  }
}

export function saveStats(profileId, stats, store = localStorage) {
  try {
    store.setItem(storageKey(profileId), JSON.stringify(stats));
    return true;
  } catch {
    return false;
  }
}

export const setKey = (notes) => `${notes.string}:${notes.pair}:${notes.spacing}`;

/** The steps already done for this string, pair and spacing. */
export function doneFor(stats, notes) {
  const set = stats.sets[setKey(notes)];
  return set ? set.done : [];
}

/**
 * File a take. A passed step is ticked; a free trill that was even keeps its
 * pace if it is the fastest yet for these two notes. Returns what changed.
 */
export function recordRun(stats, notes, step, result, dayKey = '') {
  const key = setKey(notes);
  const set = stats.sets[key] || { done: [], best: 0, runs: 0, last: '' };
  set.runs += 1;
  set.last = dayKey;
  stats.runs += 1;
  let newStep = false;
  let newBest = false;
  if (result.verdict.pass && !set.done.includes(step.id)) {
    set.done.push(step.id);
    newStep = true;
  }
  if (!step.per && result.verdict.pass && result.rate > set.best + 0.05) {
    newBest = set.best > 0;
    set.best = Math.round(result.rate * 10) / 10;
  }
  stats.sets[key] = set;
  if (result.cycles >= MIN_CYCLES) {
    if (!Array.isArray(stats.log)) stats.log = [];
    stats.log.push({
      d: dayKey,
      k: key,
      s: step.id,
      r: Math.round(result.rate * 10) / 10,
      e: Math.round(result.even),
      p: result.verdict.pass ? 1 : 0,
    });
    if (stats.log.length > LOG_LIMIT) stats.log.splice(0, stats.log.length - LOG_LIMIT);
  }
  return { newStep, newBest, best: set.best };
}

/**
 * What the stats page shows, worked out from the save: totals, each pair of
 * fingers side by side, every string against every pair, and the latest takes.
 * Nothing here is a grade: it is where the practice has gone and where it has not.
 */
export function summary(stats) {
  const log = Array.isArray(stats.log) ? stats.log : [];
  const days = new Set(log.map((x) => x.d).filter(Boolean));
  for (const set of Object.values(stats.sets)) if (set.last) days.add(set.last);
  const mean = (list) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null);
  const pairs = PAIRS.map((pair) => {
    const sets = Object.entries(stats.sets).filter(([key]) => key.split(':')[1] === pair.id);
    const mine = log.filter((x) => x.k.split(':')[1] === pair.id);
    return {
      id: pair.id,
      runs: sets.reduce((n, [, set]) => n + set.runs, 0),
      steps: sets.reduce((n, [, set]) => Math.max(n, set.done.length), 0),
      best: sets.reduce((n, [, set]) => Math.max(n, set.best), 0),
      even: mean(mine.slice(-10).map((x) => x.e)),
    };
  });
  const grid = STRINGS.map((string) => ({
    string: string.id,
    cells: PAIRS.map((pair) => {
      const sets = Object.entries(stats.sets).filter(([key]) => key.startsWith(`${string.id}:${pair.id}:`));
      return {
        pair: pair.id,
        steps: sets.reduce((n, [, set]) => Math.max(n, set.done.length), 0),
        runs: sets.reduce((n, [, set]) => n + set.runs, 0),
      };
    }),
  }));
  // The pair that has had the least: fewest steps, then fewest takes. Only named
  // once there is something to compare it with.
  const tried = pairs.filter((p) => p.runs > 0);
  const least = [...pairs].sort((a, b) => a.steps - b.steps || a.runs - b.runs)[0];
  const most = [...pairs].sort((a, b) => b.steps - a.steps || b.runs - a.runs)[0];
  const behind = tried.length && (most.steps > least.steps || most.runs >= least.runs + 3) ? least.id : null;
  return {
    runs: stats.runs,
    days: days.size,
    best: pairs.reduce((n, p) => Math.max(n, p.best), 0),
    steps: Object.values(stats.sets).reduce((n, set) => n + set.done.length, 0),
    pairs,
    grid,
    behind,
    recent: log.slice(-24),
  };
}

/** The step to offer next: the first not yet done, or the free one. */
export function nextStep(stats, notes) {
  const done = doneFor(stats, notes);
  return STEPS.find((s) => !done.includes(s.id)) || STEPS[STEPS.length - 1];
}
