// sightreading.js — an eight-bar passage, generated to the NYSSMA level table.
//
// The rules here are the ones a human would follow when writing a sight-reading
// example: open on a chord tone, step more than leap, resolve a leap by step in
// the other direction, one climax, cadence on the tonic. A random walk inside the
// level's limits still looks like an exercise; this does not.
//
// Everything is seeded, so a passage can be reproduced: the same level and seed
// always give the same eight bars. Durations are counted in sixteenth notes.

import { MAJOR_KEYS, keySignature, makeNote } from './music.js?v=202610311331';

/* ── Seeded randomness ─────────────────────────────────────────────────── */

/** mulberry32 — small, fast, and good enough for generating eight bars. */
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const chance = (rng, p) => rng() < p;

/* ── The level table ───────────────────────────────────────────────────── */
//
// Ranges are MIDI numbers. A violin in first position reaches G3 (open G) up to
// B5 (fourth finger on the E string); the Manual asks for D6 at IV–V and F6 at VI,
// which imply a shift. The table follows the Manual; the note under the staff says
// where a passage sits so a teacher can check it at a glance.

const LEVELS = {
  1: {
    keys: ['D'],
    meters: ['2/4', '4/4'],
    range: [62, 71],
    steps: [1, 2],
    maxSemis: 4,
    rhythms: {
      '2/4': [[4, 4], [4, 2, 2], [2, 2, 4], [8]],
      '4/4': [[4, 4, 4, 4], [8, 4, 4], [4, 4, 8], [4, 2, 2, 4, 4]],
    },
    tempo: { '*': { unit: 'q', bpm: 60 } },
    dynamics: ['mf'],
    marks: [],
    rests: false,
    accidentals: 0,
  },
  2: {
    keys: ['D', 'G'],
    meters: ['2/4', '3/4', '4/4'],
    range: [55, 71],
    steps: [1, 2],
    maxSemis: 4,
    rhythms: {
      '2/4': [[4, 4], [4, 2, 2], [2, 2, 4], [8]],
      '3/4': [[4, 4, 4], [2, 2, 4, 4], [8, 4], [4, 8]],
      '4/4': [[4, 4, 4, 4], [8, 4, 4], [4, 4, 8], [4, 2, 2, 4, 4]],
    },
    tempo: { '*': { unit: 'q', bpm: 72 } },
    dynamics: ['mf'],
    marks: [],
    rests: false,
    accidentals: 0,
  },
  3: {
    keys: ['D', 'G', 'C', 'F'],
    meters: ['2/4', '3/4', '4/4'],
    range: [55, 83],
    steps: [1, 2, 3, 4],
    maxSemis: 7,
    rhythms: {
      '2/4': [[4, 4], [4, 2, 2], [2, 2, 4], [8], [2, 2, 2, 2]],
      '3/4': [[4, 4, 4], [2, 2, 4, 4], [8, 4], [4, 8], [2, 2, 2, 2, 4]],
      '4/4': [
        [4, 4, 4, 4],
        [4, 2, 2, 4, 4],
        [8, 4, 4],
        [4, 4, 2, 2, 4],
        [2, 2, 2, 2, 4, 4],
      ],
    },
    tempo: { '*': { unit: 'q', bpm: 60 } },
    dynamics: ['f', 'ff'],
    marks: ['staccato'],
    rests: false,
    accidentals: 0,
  },
  4: {
    keys: ['D', 'G', 'C', 'F', 'A', 'Bb'],
    meters: ['2/4', '3/4', '4/4', '2/2'],
    range: [55, 86],
    steps: [1, 2, 3, 4, 5],
    maxSemis: 9,
    rhythms: {
      '2/4': [[4, 4], [4, 2, 2], [2, 2, 4], [8]],
      '3/4': [[4, 4, 4], [2, 2, 4, 4], [8, 4], [4, 8]],
      '4/4': [[4, 4, 4, 4], [4, 2, 2, 4, 4], [8, 4, 4], [4, 4, 2, 2, 4]],
      '2/2': [
        [4, 4, 4, 4],
        [8, 4, 4],
        [4, 4, 8],
        [6, 2, 4, 4],
        [4, 4, 6, 2],
        [8, 6, 2],
        [6, 2, 6, 2],
      ],
    },
    tempo: { '2/2': { unit: 'h', bpm: 76 }, '*': { unit: 'q', bpm: 88 } },
    dynamics: ['mf', 'f'],
    marks: ['staccato', 'accent'],
    rests: true,
    accidentals: 1,
  },
  5: {
    keys: ['D', 'G', 'C', 'F', 'A', 'Bb', 'Eb'],
    meters: ['2/4', '3/4', '4/4', '2/2', '6/8'],
    range: [55, 86],
    steps: [1, 2, 3, 4, 5],
    maxSemis: 9,
    rhythms: {
      '2/4': [[4, 4], [4, 2, 2], [2, 2, 4], [8], [2, 2, 2, 2], [4 / 3, 4 / 3, 4 / 3, 4]],
      '3/4': [[4, 4, 4], [2, 2, 4, 4], [8, 4], [4, 8], [4 / 3, 4 / 3, 4 / 3, 4, 4]],
      '4/4': [
        [4, 4, 4, 4],
        [4, 2, 2, 4, 4],
        [8, 4, 4],
        [4, 4, 2, 2, 4],
        [4 / 3, 4 / 3, 4 / 3, 4, 4, 4],
      ],
      '2/2': [[4, 4, 4, 4], [8, 4, 4], [6, 2, 4, 4], [4, 4, 6, 2], [8, 6, 2]],
      '6/8': [[2, 2, 2, 6], [6, 2, 2, 2], [2, 2, 2, 2, 2, 2], [4, 2, 6], [6, 6]],
    },
    tempo: { '6/8': { unit: 'qd', bpm: 120 }, '*': { unit: 'q', bpm: 60 } },
    dynamics: ['mp', 'f'],
    marks: ['staccato', 'accent'],
    rests: true,
    accidentals: 2,
  },
  6: {
    keys: ['D', 'G', 'C', 'F', 'A', 'Bb', 'Eb', 'E', 'Ab'],
    meters: ['2/4', '3/4', '4/4', '2/2', '6/8'],
    range: [55, 89],
    steps: [1, 2, 3, 4, 5, 6, 7],
    maxSemis: 12,
    rhythms: {
      '2/4': [[4, 4], [4, 2, 2], [2, 2, 4], [2, 4, 2], [1, 1, 2, 4], [2, 1, 1, 4]],
      '3/4': [
        [4, 4, 4],
        [2, 2, 4, 4],
        [8, 4],
        [4, 8],
        [2, 4, 2, 4],
        [1, 1, 2, 4, 4],
        [4, 2, 1, 1, 4],
      ],
      '4/4': [
        [4, 4, 4, 4],
        [4, 2, 2, 4, 4],
        [8, 4, 4],
        [2, 4, 2, 4, 4],
        [4, 2, 4, 2, 4],
        [2, 2, 2, 4, 4, 2],
        [8, 2, 2, 4],
        [1, 1, 2, 4, 4, 4],
        [1, 1, 1, 1, 4, 4, 4],
        [2, 1, 1, 4, 4, 4],
        [4, 2, 1, 1, 4, 4],
        [4 / 3, 4 / 3, 4 / 3, 4, 4, 4],
        [4 / 3, 4 / 3, 4 / 3, 4 / 3, 4 / 3, 4 / 3, 4, 4],
      ],
      '2/2': [
        [4, 4, 4, 4],
        [8, 4, 4],
        [6, 2, 4, 4],
        [8, 6, 2],
        [4, 4, 4, 1, 1, 2],
        [8, 4, 1, 1, 2],
        [4 / 3, 4 / 3, 4 / 3, 4, 8],
      ],
      '6/8': [
        [2, 2, 2, 6],
        [6, 2, 2, 2],
        [2, 2, 2, 2, 2, 2],
        [4, 2, 6],
        [6, 6],
        [2, 2, 2, 4, 1, 1],
        [6, 2, 1, 1, 2],
      ],
    },
    tempo: { '6/8': { unit: 'qd', bpm: 120 }, '4/4': { unit: 'q', bpm: 120 }, '*': { unit: 'q', bpm: 72 } },
    dynamics: ['mp', 'mf'],
    marks: ['staccato', 'accent'],
    rests: true,
    accidentals: 2,
  },
};

export const SIGHT_LEVELS = Object.keys(LEVELS).map(Number);

/** Sixteenth notes in a bar of this meter. */
function barLength(meter) {
  const [num, den] = meter.split('/').map(Number);
  return (num / den) * 16;
}

/** The lengths that make up one beat, for beaming. */
export function beatLength(meter) {
  const [num, den] = meter.split('/').map(Number);
  // Compound meters are felt in three eighths, simple ones in quarters.
  if (den === 8 && num % 3 === 0) return 6;
  if (den === 2) return 8;
  return 16 / den;
}

export function levelSpec(level) {
  return LEVELS[level] || LEVELS[6];
}

/* ── The key's notes, spelled, inside the level's range ────────────────── */

function poolFor(key, [low, high]) {
  const variant = key.variants[0];
  const sig = keySignature(variant.fifths);
  const tonicLetter = variant.letter;
  const pool = [];
  for (let octave = 2; octave <= 6; octave++) {
    for (let letter = 0; letter < 7; letter++) {
      const note = makeNote(letter, sig[letter], octave);
      if (note.midi < low || note.midi > high) continue;
      note.degree = (letter - tonicLetter + 7) % 7;
      note.index = pool.length;
      pool.push(note);
    }
  }
  pool.sort((a, b) => a.midi - b.midi);
  pool.forEach((n, i) => {
    n.index = i;
  });
  return pool;
}

/* ── Choosing pitches ──────────────────────────────────────────────────── */

/** Semitone size of each degree step, used only for weighting. */
const STEP_WEIGHTS = [0, 62, 26, 7, 4, 1, 0.5];

/**
 * How far along its rise/fall arc the melody should be at this point, with the
 * climax just past the middle. The shape is what makes eight random-ish notes
 * read as a phrase.
 */
function arc(progress, peakAt = 0.62) {
  if (progress <= peakAt) return progress / peakAt;
  return 1 - (progress - peakAt) / (1 - peakAt);
}

function chooseStep(rng, allowed, directionBias, lastStep) {
  const options = [];
  for (const step of allowed) {
    // After a leap, a step is much more likely — and usually back the other way.
    let weight = STEP_WEIGHTS[step] || 0.3;
    if (Math.abs(lastStep) >= 3) {
      if (step === 1) weight *= 4;
      if (Math.sign(step) === Math.sign(lastStep)) weight *= 0.25;
    }
    if (directionBias > 0 && Math.sign(step) === -1) weight *= 0.35;
    if (directionBias < 0 && Math.sign(step) === 1) weight *= 0.35;
    options.push({ step, weight });
  }
  const total = options.reduce((a, o) => a + o.weight, 0);
  let roll = rng() * total;
  for (const o of options) {
    roll -= o.weight;
    if (roll <= 0) return o.step;
  }
  return options[options.length - 1].step;
}

/* ── Generating ────────────────────────────────────────────────────────── */

const BAR_COUNT = 8;

/**
 * Build one passage.
 *
 * @param {object} opts
 * @param {number} opts.level  NYSSMA level 1–6
 * @param {number} [opts.seed] omitted → a random seed (returned, so it can be shared)
 */
export function generatePassage({ level = 5, seed = null } = {}) {
  const spec = levelSpec(level);
  const actualSeed = seed == null ? Math.floor(Math.random() * 1e6) : seed >>> 0;
  const rng = rngFrom(actualSeed);

  const keyId = pick(rng, spec.keys);
  const key = MAJOR_KEYS.find((k) => k.id === keyId);
  const meter = pick(rng, spec.meters);
  const pool = poolFor(key, spec.range);
  if (pool.length < 6) return null;

  const perBar = barLength(meter);
  const beat = beatLength(meter);

  // ── rhythm: one pattern per bar, the last bar landing on a longer note ──
  const patterns = spec.rhythms[meter];
  const bars = [];
  let previous = null;
  for (let b = 0; b < BAR_COUNT; b++) {
    // Avoid the same bar twice in a row when there is a choice: eight identical
    // bars of half notes is not a sight-reading test, it is a warm-up.
    const fresh = patterns.filter((p) => p !== previous);
    const pool_ = fresh.length ? fresh : patterns;

    let pattern;
    if (b === BAR_COUNT - 1) {
      // close on something that can hold: a half note or a dotted quarter
      const endings = pool_.filter((p) => p[p.length - 1] >= 6);
      pattern = endings.length ? pick(rng, endings) : pick(rng, pool_);
    } else if (b === BAR_COUNT / 2 - 1) {
      // bar 4 usually ends on a note you can breathe on
      const endings = pool_.filter((p) => p[p.length - 1] >= 4);
      pattern = endings.length ? pick(rng, endings) : pick(rng, pool_);
    } else {
      pattern = pick(rng, pool_);
    }
    previous = pattern;

    const events = [];
    let start = 0;
    pattern.forEach((dur, i) => {
      events.push({ start, dur, rest: false, midi: null, note: null });
      start += dur;
    });
    // guard against a typo in the table: a bar that does not add up is a bug
    if (Math.abs(start - perBar) > 0.01) {
      events.push({ start, dur: perBar - start, rest: false, midi: null });
    }
    bars.push(events);
  }

  // ── rests (level IV and up) — one bar, in the middle, on a weak slot ────
  if (spec.rests && chance(rng, 0.55)) {
    const b = 1 + Math.floor(rng() * 5);
    const events = bars[b];
    // A beat or a half-beat can become a rest anywhere in the bar. A sixteenth
    // rest only reads properly when it *opens* a pair of sixteenths — the note
    // that follows still beams with the one after it — so that is the only
    // sixteenth slot worth considering. Level VI is where those pairs exist.
    const opensPair = (e, i) =>
      e.dur === 1 &&
      events[i + 1] &&
      events[i + 1].dur === 1 &&
      (!events[i - 1] || events[i - 1].dur !== 1);
    const sixteenthSlot = events.findIndex(
      (e, i) => i > 0 && i < events.length - 1 && opensPair(e, i),
    );
    const beatSlot = events.findIndex(
      (e, i) => i > 0 && e.dur >= 2 && e.dur <= 4 && i < events.length - 1,
    );
    const slot = sixteenthSlot > 0 && chance(rng, 0.4) ? sixteenthSlot : beatSlot;
    if (slot > 0) events[slot].rest = true;
  }

  // ── pitches ───────────────────────────────────────────────────────────
  const slots = bars.flatMap((events) => events);
  const sounding = slots.filter((e) => !e.rest);

  // The melody lives around the middle of the level's range, not at the top of
  // it: the climax is roughly a sixth above home, which is what makes eight bars
  // sit on the staff instead of climbing onto ledger lines.
  const middle = (spec.range[0] + spec.range[1]) / 2;
  // Prefer the tonic at or just below the middle of the range; only reach above
  // it when the level has no lower option. That keeps the line on the staff.
  let home = -1;
  let bestBelow = -Infinity;
  let bestAbove = Infinity;
  let aboveIndex = -1;
  pool.forEach((n, i) => {
    if (n.degree !== 0) return;
    if (n.midi <= middle + 1) {
      if (n.midi > bestBelow) {
        bestBelow = n.midi;
        home = i;
      }
    } else if (n.midi < bestAbove) {
      bestAbove = n.midi;
      aboveIndex = i;
    }
  });
  if (home < 0) home = aboveIndex >= 0 ? aboveIndex : Math.floor(pool.length / 2);

  // Home to an octave above it, and never more than a third below home. Without
  // the clamp the random walk drifts: a level III passage would climb to B5 and
  // stay there, however well the arc was aimed.
  const peak = Math.min(pool.length - 1, home + 7);
  const lowest = Math.max(0, home - 3);

  let prev = home;
  let lastStep = 0;

  sounding.forEach((event, i) => {
    const progress = sounding.length > 1 ? i / (sounding.length - 1) : 0;
    const target = home + (peak - home) * arc(progress);
    const directionBias = Math.sign(target - prev);

    if (i === 0) {
      // open on the tonic, or on the third or fifth above it
      const openings = [0, 2, 4].map((d) => pool.findIndex((n) => n.degree === d && n.index >= home));
      const valid = openings.filter((x) => x >= 0);
      prev = valid.length ? valid[Math.floor(rng() * valid.length)] : home;
    } else if (i === sounding.length - 1) {
      // cadence: the tonic nearest to where we are
      let best = null;
      for (let j = 0; j < pool.length; j++) {
        if (pool[j].degree !== 0) continue;
        if (best == null || Math.abs(j - prev) < Math.abs(best - prev)) best = j;
      }
      if (best != null) prev = best;
    } else {
      const step = chooseStep(rng, [...spec.steps, -1, -2, -3, -4, -5, -6].filter((s) => spec.steps.includes(Math.abs(s))), directionBias, lastStep);
      let next = prev + step;
      if (next < lowest || next > peak) next = prev - step;
      prev = Math.max(lowest, Math.min(peak, next));
      lastStep = step;
    }

    const note = pool[prev];
    event.note = note;
    event.midi = note.midi;
  });

  const setNote = (event, note) => {
    event.note = note;
    event.midi = note.midi;
  };

  /**
   * The note in the pool closest to `targetMidi` that sits within `maxSemis` of
   * `anchorMidi`. A unison is allowed but ranked last, so a fix prefers to keep
   * the line moving.
   */
  const within = (anchorMidi, targetMidi, maxSemis) => {
    let best = null;
    for (const note of pool) {
      if (Math.abs(note.midi - anchorMidi) > maxSemis) continue;
      const cost = Math.abs(note.midi - targetMidi) + (note.midi === anchorMidi ? 4 : 0);
      if (!best || cost < best.cost) best = { note, cost };
    }
    return best ? best.note : null;
  };

  const neighbourOk = (event, note) => {
    const i = sounding.indexOf(event);
    const before = sounding[i - 1];
    const after = sounding[i + 1];
    return (
      (!before || Math.abs(note.midi - before.midi) <= spec.maxSemis) &&
      (!after || Math.abs(note.midi - after.midi) <= spec.maxSemis)
    );
  };

  // ── the middle of the phrase may close on the dominant ─────────────────
  // Before the interval pass, so any leap it introduces gets repaired.
  const halfBar = bars[BAR_COUNT / 2 - 1];
  const lastOfHalf = halfBar[halfBar.length - 1];
  if (!lastOfHalf.rest && lastOfHalf.note && chance(rng, 0.5)) {
    const dominants = pool.filter((n) => n.degree === 4 && neighbourOk(lastOfHalf, n));
    if (dominants.length) setNote(lastOfHalf, pick(rng, dominants));
  }

  // ── keep every interval inside the level's vocabulary ─────────────────
  // One pass, backwards, and it only ever moves the *earlier* note of a pair —
  // so each pair stays fixed once it has been checked, and the cadence, which is
  // the last note, is never touched.
  for (let i = sounding.length - 2; i >= 0; i--) {
    const next = sounding[i + 1];
    const gap = Math.abs(sounding[i].midi - next.midi);
    if (gap <= spec.maxSemis) continue;
    const fixed = within(next.midi, sounding[i].midi, spec.maxSemis);
    if (fixed) setNote(sounding[i], fixed);
  }

  // ── accidentals (level IV and up) ──────────────────────────────────────
  // Last, and only where they do not push the line outside its vocabulary.
  if (spec.accidentals > 0) {
    const count = 1 + Math.floor(rng() * spec.accidentals);
    const sig = keySignature(key.variants[0].fifths);
    for (let k = 0; k < count; k++) {
      const candidates = sounding.filter(
        (e, i) => i > 0 && i < sounding.length - 2 && !e.accidental && e.note,
      );
      if (!candidates.length) break;
      const event = pick(rng, candidates);
      const letter = event.note.letter;
      const base = sig[letter];
      // move one semitone away from the key signature, staying printable
      const next = base === 1 ? 0 : base === -1 ? 0 : chance(rng, 0.5) ? 1 : -1;
      if (next === base) continue;
      const spelled = makeNote(letter, next, event.note.octave);
      if (spelled.midi < spec.range[0] || spelled.midi > spec.range[1]) continue;
      if (!neighbourOk(event, spelled)) continue;
      setNote(event, spelled);
      event.accidental = true;
    }
  }

  // ── marks ─────────────────────────────────────────────────────────────
  if (spec.marks.length) {
    const playable = sounding.slice(0, -2).filter((e) => e.dur <= 4);
    for (const event of playable) {
      if (chance(rng, 0.14)) {
        event.mark = spec.marks.includes('accent') && chance(rng, 0.35) ? 'accent' : 'staccato';
      }
    }
  }

  // ── dynamics: one at the start, a swell before the climax ─────────────
  const dynamic = pick(rng, spec.dynamics);
  const first = bars[0][0];
  if (!first.rest) first.dynamic = dynamic;
  let swell = null;
  if (level >= 4 && chance(rng, 0.5)) {
    const b = Math.floor(BAR_COUNT * 0.45);
    swell = { bar: b, kind: level >= 5 ? 'cresc' : 'cresc' };
  }

  const tempo = spec.tempo[meter] || spec.tempo['*'];

  return {
    level,
    seed: actualSeed,
    key: { id: keyId, name: key.variants[0].name, fifths: key.variants[0].fifths },
    meter,
    perBar,
    beat,
    tempo,
    bars,
    swell,
    dynamic,
    marks: spec.marks,
    range: spec.range,
    /** Flattened, in order — the shape `analyzeTake` expects. */
    sequence: sounding.map((e) => ({
      midi: e.midi,
      name: e.note.name,
      letter: e.note.letter,
      alter: e.note.alter,
      octave: e.note.octave,
    })),
  };
}

/** Every event in order, with bar and beat, for drawing and for feedback. */
export function flatten(passage) {
  const out = [];
  passage.bars.forEach((events, barIndex) => {
    for (const event of events) {
      out.push({ ...event, bar: barIndex + 1, beat: event.start / passage.beat + 1 });
    }
  });
  return out;
}
