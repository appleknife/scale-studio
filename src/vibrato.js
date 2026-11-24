// vibrato.js — measuring the wobble of one held note.
//
// Two readings live here:
//   vibratoOf(frames, note)     a note found by the Listen scorer; returns null
//                               unless it is a real 4–8.5 Hz wobble
//   analyseVibrato(frames, midi) a dedicated, known target note; returns the
//                               measurement plus how even it was, so a trainer
//                               can show what it heard without guessing a score
//
// Both work on the app's ~30 ms pitch frames. The pitch inside a note is detrended
// before anything is counted: a slow slide is intonation, not vibrato.

import { STRINGS, TEMPO, stringById } from './trill.js?v=202611240200';

const median = (xs) => {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
const clamp = (v) => Math.max(0, Math.min(100, v));
const centsFrom = (freq, midi) => (69 + 12 * Math.log2(freq / 440) - midi) * 100;

/** A quarter-tone-wide wave is about 50 cents peak to peak. */
export const TARGET_WIDTH = 50;
/** Below this the wave reads as a wobble rather than a settled vibrato. */
export const EVEN_PASS = 72;

/** Detrend a run of {t, c} cents, and say what its straight line was. */
function detrend(points) {
  const n = points.length;
  const mt = points.reduce((a, p) => a + p.t, 0) / n;
  const mc = points.reduce((a, p) => a + p.c, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - mt) * (p.c - mc);
    den += (p.t - mt) ** 2;
  }
  const slope = den ? num / den : 0;
  return { flat: points.map((p) => p.c - (mc + slope * (p.t - mt))), centre: mc, slope };
}

const smooth = (xs) =>
  xs.map((v, i) => (xs[i - 1] ?? v) * 0.25 + v * 0.5 + (xs[i + 1] ?? v) * 0.25);

/** Interpolated crossings from below the centre line to above it. */
function upCrossings(ts, sm) {
  const out = [];
  for (let i = 1; i < sm.length; i++) {
    if (sm[i - 1] < 0 && sm[i] >= 0) {
      const a = sm[i - 1];
      const b = sm[i];
      const f = b === a ? 0 : -a / (b - a);
      out.push(ts[i - 1] + f * (ts[i] - ts[i - 1]));
    }
  }
  return out;
}

/**
 * The vibrato of one held note: { rate (Hz), width (cents, peak to peak) } or
 * null when there is none. The pitch inside the note, less its slow drift, is
 * counted for wobbles in the 4–8.5 Hz band.
 */
export function vibratoOf(frames, note) {
  if (note.t1 - note.t0 < 0.35) return null;
  const inside = frames.filter(
    (f) => f.t >= note.t0 && f.t <= note.t1 && f.freq > 0 && f.clarity >= 0.5,
  );
  if (inside.length < 10) return null;
  const trim = Math.floor(inside.length * 0.12);
  const core = inside.slice(trim, inside.length - trim);
  if (core.length < 8) return null;
  const cents = core.map((f) => centsFrom(f.freq, note.pitch));
  // drop octave slips and other outliers before measuring
  const clean = cents.map((c) => (Math.abs(c) > 120 ? 0 : c));
  const { flat } = detrend(core.map((f, i) => ({ t: f.t, c: clean[i] })));
  // a light smoothing, so frame jitter is not counted as wobble
  const sm = smooth(flat);
  let crossings = 0;
  for (let i = 1; i < sm.length; i++) if (Math.sign(sm[i]) !== Math.sign(sm[i - 1]) && sm[i] !== 0) crossings++;
  const ts = core.map((f) => f.t);
  const span = ts[ts.length - 1] - ts[0];
  if (span <= 0) return null;
  const rate = crossings / 2 / span;
  const sorted = sm.slice().sort((a, b) => a - b);
  // The smoothing shrinks a wobble as well as the jitter: by 0.5 + 0.5·cos(2π·f·dt)
  // at f Hz, about 0.7 at 6 Hz with 30 ms frames. Put that back.
  const dt = span / (ts.length - 1);
  const gain = 0.5 + 0.5 * Math.cos(2 * Math.PI * rate * dt);
  const width = (pct(sorted, 0.95) - pct(sorted, 0.05)) / Math.max(0.3, gain);
  if (rate < 4 || rate > 8.5 || width < 12 || crossings < 5) return null;
  return { rate, width };
}

export function vibratoSummary(frames, notes) {
  const held = notes.filter((n) => n.t1 - n.t0 >= 0.35);
  const found = held.map((n) => vibratoOf(frames, n)).filter(Boolean);
  if (held.length < 3) return { held: held.length, used: found.length, share: null, rate: null, width: null };
  const rate = median(found.map((v) => v.rate));
  const width = median(found.map((v) => v.width));
  return {
    held: held.length,
    used: found.length,
    share: found.length / held.length,
    rate,
    width,
    // in words, against the violin's usual ~6 Hz and ~30 cents
    speed: rate == null ? null : rate < 5 ? 'slow' : rate > 7 ? 'fast' : 'medium',
    size: width == null ? null : width < 20 ? 'narrow' : width > 60 ? 'wide' : 'medium',
  };
}

/**
 * The one thing to try next. Rate and width are matters of style and register,
 * so they are shown as measurements rather than passed or failed; evenness and
 * a settled centre are what make a vibrato sound professional.
 */
export function vibratoVerdict(m, targetRate = null) {
  if (m.cycles < 3 || m.rate == null || m.evenness == null) return { id: 'none', pass: false };
  if (m.evenness < EVEN_PASS) return { id: 'uneven', pass: false };
  if (m.centreOffset != null && Math.abs(m.centreOffset) > 25) return { id: 'offcentre', pass: false };
  if (targetRate) {
    const ratio = m.rate / targetRate;
    if (ratio < 0.8) return { id: 'slow', pass: false };
    if (ratio > 1.2) return { id: 'fast', pass: false };
  }
  return { id: 'good', pass: true };
}

/**
 * One known sustained note, measured for a trainer. Unlike vibratoOf this always
 * answers — with nulls where there was nothing to measure — so the screen can say
 * "no vibrato detected" instead of treating it as an exception.
 *
 * `evenness` is the one number worth scoring: rate and width are matters of style
 * and register, but a professional vibrato is an even one. It combines the spread
 * of the cycle periods (60%) and of the cycle widths (40%), 100 being even.
 */
export function analyseVibrato(frames, centreMidi, { from = -Infinity, to = Infinity } = {}) {
  const empty = { rate: null, width: null, evenness: null, centreOffset: null, cycles: 0, held: 0 };
  const voiced = frames.filter(
    (f) => f.t >= from && f.t <= to && f.freq > 0 && f.clarity >= 0.5,
  );
  if (voiced.length < 10) return empty;
  const trim = Math.floor(voiced.length * 0.05);
  const core = voiced.slice(trim, voiced.length - trim);
  if (core.length < 8) return empty;
  const span = core[core.length - 1].t - core[0].t;
  if (span <= 0) return empty;

  const points = core
    .map((f) => ({ t: f.t, c: centsFrom(f.freq, centreMidi) }))
    .filter((p) => Math.abs(p.c) <= 120);
  if (points.length < 8) return { ...empty, held: span };
  const { flat, centre } = detrend(points);
  const ts = points.map((p) => p.t);
  const peak = Math.max(...flat);
  const trough = Math.min(...flat);
  // A straight note still has a centre worth reporting, but no wobble.
  if (peak - trough < 4) return { ...empty, centreOffset: centre, held: span };

  const sm = smooth(flat);
  const ups = upCrossings(ts, sm);
  const result = { rate: null, width: null, evenness: null, centreOffset: centre, cycles: ups.length, held: span };
  if (ups.length < 3) return result;

  const dt = span / (ts.length - 1);
  const rate = (ups.length - 1) / (ups[ups.length - 1] - ups[0]);
  const sorted = sm.slice().sort((a, b) => a - b);
  const gain = 0.5 + 0.5 * Math.cos(2 * Math.PI * rate * dt);
  result.rate = rate;
  result.width = (pct(sorted, 0.95) - pct(sorted, 0.05)) / Math.max(0.3, gain);

  const periods = [];
  const widths = [];
  for (let i = 1; i < ups.length; i++) {
    periods.push(ups[i] - ups[i - 1]);
    const cycle = sm.filter((_, k) => ts[k] >= ups[i - 1] && ts[k] < ups[i]);
    if (cycle.length) widths.push(Math.max(...cycle) - Math.min(...cycle));
  }
  const medPeriod = median(periods);
  const medWidth = median(widths);
  if (medPeriod && medWidth) {
    const periodSpread = median(periods.map((p) => Math.abs(p - medPeriod) / medPeriod)) || 0;
    const widthSpread = median(widths.map((w) => Math.abs(w - medWidth) / medWidth)) || 0;
    result.evenness = clamp(100 - (0.6 * periodSpread + 0.4 * widthSpread) * 250);
  }
  return result;
}

/* ── Which note ─────────────────────────────────────────────────────────── */

// Third position is the starting point: the hand has room to rock, and a low
// first finger no longer rolls off toward the open string. First position stays
// available for players who cannot reach the third yet. The offsets are
// semitones above the open string. A hand in third position puts finger 1
// where finger 3 sat in first position — on A, D5 instead of B4 — so the shift
// from first position is three semitones, not five.
export const POSITIONS = [
  { id: '3', semitones: 3 },
  { id: '1', semitones: 0 },
];

// A stopped finger has one or two places. There is deliberately no "open" and
// no whole-step spread: a vibrato lives inside the half step around its note.
export const FINGERS = [
  { id: '1', options: [{ id: 'low', semis: 1 }, { id: 'high', semis: 2 }] },
  { id: '2', options: [{ id: 'low', semis: 3 }, { id: 'high', semis: 4 }] },
  { id: '3', options: [{ id: 'normal', semis: 5 }, { id: 'high', semis: 6 }] },
  // High 4 (F on A in first position, G♯ on A in third) is a natural
  // placement in the higher positions and an extension down low.
  { id: '4', options: [{ id: 'normal', semis: 7 }, { id: 'high', semis: 8 }] },
];

// Free is first: a natural, even wave is the exercise, not the last rung.
export const STEPS = [
  { id: 'free', per: 0 },
  { id: 'two', per: 2 },
  { id: 'three', per: 3 },
  { id: 'four', per: 4 },
  { id: 'six', per: 6 },
  { id: 'eight', per: 8 },
];

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
export const nameOf = (midi) => NAMES[((midi % 12) + 12) % 12];

export const stepById = (id) => STEPS.find((s) => s.id === id) || STEPS[0];
export const positionById = (id) => POSITIONS.find((p) => p.id === id) || POSITIONS[0];
export const fingerById = (id) => FINGERS.find((f) => f.id === id) || FINGERS[1];
export const placementById = (finger, id) =>
  finger.options.find((o) => o.id === id) || finger.options[0];

/** The one stopped note a vibrato rolls around, and its half-step neighbours. */
export function centreFor(opts) {
  const open = (STRINGS.find((s) => s.id === opts.string) || STRINGS[2]).midi;
  const position = positionById(opts.position);
  const finger = fingerById(opts.finger);
  const placement = placementById(finger, opts.placement);
  const midi = open + position.semitones + placement.semis;
  return {
    midi,
    name: nameOf(midi),
    below: nameOf(midi - 1),
    above: nameOf(midi + 1),
    finger: finger.id,
    placement: placement.id,
    position: position.id,
    string: (STRINGS.find((s) => s.id === opts.string) || STRINGS[2]).id,
  };
}

/* ── What is remembered ─────────────────────────────────────────────────── */

export function storageKey(profileId) {
  return `scaleStudio.vibrato.v1.${profileId || 'default'}`;
}

export function emptyStats() {
  return {
    v: 1,
    // Third position, second finger: the hand has room and the finger is a
    // comfortable one to start a vibrato with.
    opts: { string: 'A', position: '3', finger: '2', placement: 'high', bpm: TEMPO.start, click: true },
    sets: {},
    runs: 0,
    log: [],
  };
}

export const LOG_LIMIT = 300;
export const setKey = (opts) => `${opts.string}:${opts.position}:${opts.finger}:${opts.placement}`;

export function loadStats(profileId, store = localStorage) {
  const base = emptyStats();
  try {
    const raw = store.getItem(storageKey(profileId));
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    const opts = { ...base.opts, ...(parsed.opts && typeof parsed.opts === 'object' ? parsed.opts : {}) };
    opts.string = stringById(opts.string).id;
    opts.position = positionById(opts.position).id;
    opts.finger = fingerById(opts.finger).id;
    opts.placement = placementById(fingerById(opts.finger), opts.placement).id;
    opts.bpm = Math.min(TEMPO.max, Math.max(TEMPO.min, Math.round(Number(opts.bpm)) || TEMPO.start));
    opts.click = opts.click !== false;
    const sets = {};
    for (const [key, value] of Object.entries(parsed.sets && typeof parsed.sets === 'object' ? parsed.sets : {})) {
      if (!value || typeof value !== 'object') continue;
      sets[key] = {
        done: Array.isArray(value.done) ? value.done.filter((id) => STEPS.some((s) => s.id === id)) : [],
        best: Math.max(0, Math.round(Number(value.best)) || 0),
        runs: Math.max(0, Math.round(Number(value.runs)) || 0),
        last: typeof value.last === 'string' ? value.last : '',
      };
    }
    const log = (Array.isArray(parsed.log) ? parsed.log : [])
      .filter((x) => x && typeof x === 'object' && typeof x.k === 'string' && STEPS.some((s) => s.id === x.s))
      .map((x) => ({
        d: typeof x.d === 'string' ? x.d : '',
        k: x.k,
        s: x.s,
        r: Math.max(0, Number(x.r) || 0),
        w: Math.max(0, Math.round(Number(x.w)) || 0),
        e: Math.max(0, Math.min(100, Math.round(Number(x.e)) || 0)),
        o: Math.round(Number(x.o) || 0),
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

export const doneFor = (stats, opts) => stats.sets[setKey(opts)]?.done || [];

/** The first step not yet passed for this note, or the natural wave. */
export function nextStep(stats, opts) {
  const done = doneFor(stats, opts);
  return STEPS.find((s) => !done.includes(s.id)) || STEPS[STEPS.length - 1];
}

/**
 * File a take. A passed step is ticked; a free wave keeps its most even result
 * rather than its rate — rate and width are style, evenness is the progress.
 */
export function recordRun(stats, opts, step, result, day = '') {
  const key = setKey(opts);
  const set = stats.sets[key] || { done: [], best: 0, runs: 0, last: '' };
  set.runs += 1;
  set.last = day;
  stats.runs += 1;
  const even = Math.round(result.evenness ?? 0);
  let newStep = false;
  let newBest = false;
  if (result.verdict?.pass && !set.done.includes(step.id)) {
    set.done.push(step.id);
    newStep = true;
  }
  if (!step.per && result.verdict?.pass && even > set.best) {
    newBest = set.best > 0;
    set.best = even;
  }
  stats.sets[key] = set;
  if (result.cycles >= 3) {
    if (!Array.isArray(stats.log)) stats.log = [];
    stats.log.push({
      d: day,
      k: key,
      s: step.id,
      r: Math.round((result.rate || 0) * 10) / 10,
      w: Math.round(result.width || 0),
      e: even,
      o: Math.round(result.centreOffset || 0),
      p: result.verdict?.pass ? 1 : 0,
    });
    if (stats.log.length > LOG_LIMIT) stats.log.splice(0, stats.log.length - LOG_LIMIT);
  }
  return { newStep, newBest, best: set.best };
}

export function summary(stats) {
  const log = Array.isArray(stats.log) ? stats.log : [];
  const days = new Set(log.map((x) => x.d).filter(Boolean));
  const sets = Object.values(stats.sets || {});
  for (const set of sets) if (set.last) days.add(set.last);
  return {
    runs: stats.runs,
    days: days.size,
    steps: sets.reduce((n, set) => n + set.done.length, 0),
    best: sets.reduce((n, set) => Math.max(n, set.best), 0),
    recent: log.slice(-24),
  };
}
