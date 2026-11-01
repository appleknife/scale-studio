// sightreading.js — an eight-bar passage, generated to the NYSSMA level table.
//
// The rules here are the ones a human would follow when writing a sight-reading
// example: open on a chord tone, step more than leap, resolve a leap by step in
// the other direction, one climax, cadence on the tonic. A random walk inside the
// level's limits still looks like an exercise; this does not.
//
// Everything is seeded, so a passage can be reproduced: the same level and seed
// always give the same eight bars. Durations are counted in sixteenth notes.

import { MAJOR_KEYS, keySignature, makeNote } from './music.js?v=202610312144';
import { STAFF_GEOM } from './staff.js?v=202610312144';

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
    // The Manual prints level I's range as two notes — D4 under the staff and D5
    // on the fourth line — so the window is one octave of D major. Nothing faster
    // than a quarter note, nothing wider than a third, and only 2/4 or 4/4.
    keys: ['D'],
    meters: ['2/4', '4/4'],
    range: [62, 74],
    steps: [1, 2],
    maxSemis: 4,
    rhythms: {
      '2/4': [[4, 4], [8]],
      '4/4': [[4, 4, 4, 4], [8, 4, 4], [4, 4, 8], [8, 8], [16]],
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
      // The dotted half is level II's long note: it fills a 3/4 bar, or takes
      // the first three beats of a 4/4 one.
      '3/4': [[4, 4, 4], [2, 2, 4, 4], [8, 4], [4, 8], [12]],
      '4/4': [[4, 4, 4, 4], [8, 4, 4], [4, 4, 8], [4, 2, 2, 4, 4], [12, 4]],
    },
    slurs: 0.5,
    tempo: { '*': { unit: 'q', bpm: 72 } },
    dynamics: ['mf'],
    marks: [],
    rests: false,
    accidentals: 0,
  },
  // Leaps follow the Manual's ladder: thirds at I–II, a fifth at III, an octave
  // at V–VI. `steps` is what the walk may choose from, in scale degrees, so it
  // has to reach the ceiling — a fifth at III, an octave at V and VI — or the
  // limit is only theoretical; `maxSemis` is the ceiling every interval is held
  // to afterwards.
  3: {
    keys: ['D', 'G', 'C', 'F'],
    meters: ['2/4', '3/4', '4/4'],
    range: [55, 83],
    steps: [1, 2, 3, 4, 5],
    maxSemis: 7,
    rhythms: {
      // Level III owns the first sixteenths in the Manual's ladder, and they
      // arrive as one beat of four under a beam — the same figure level VI
      // leans on, met here only now and then. `sixteenths` below sets how
      // often: see the rhythm draw.
      '2/4': [[4, 4], [4, 2, 2], [2, 2, 4], [8], [2, 2, 2, 2], [1, 1, 1, 1, 4]],
      '3/4': [[4, 4, 4], [2, 2, 4, 4], [8, 4], [4, 8], [2, 2, 2, 2, 4], [1, 1, 1, 1, 4, 4]],
      '4/4': [
        [4, 4, 4, 4],
        [4, 2, 2, 4, 4],
        [8, 4, 4],
        [4, 4, 2, 2, 4],
        [2, 2, 2, 2, 4, 4],
        [4, 4, 4, 1, 1, 1, 1],
      ],
    },
    sixteenths: 0.35,
    slurs: 0.75,
    tempo: { '*': { unit: 'q', bpm: 80 } },
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
    steps: [1, 2, 3, 4, 5, 6, 7],
    maxSemis: 12,
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
    // 6/8 is marked in dotted quarters at both these levels; the Manual's
    // "eighth = 120" belongs to the simple metres, not to 6/8, where it would
    // be slower than any sight-reading example ever printed. The simple metres
    // are not repeated here — they carry over from level IV at ♩ = 88.
    tempo: { '6/8': { unit: 'qd', bpm: 60 } },
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
      '2/4': [[4, 4], [4, 2, 2], [2, 2, 4], [2, 4, 2], [1, 1, 2, 4], [2, 1, 1, 4], [1, 1, 1, 1]],
      '3/4': [
        [4, 4, 4],
        [2, 2, 4, 4],
        [8, 4],
        [4, 8],
        [2, 4, 2, 4],
        [1, 1, 2, 4, 4],
        [4, 2, 1, 1, 4],
        // four sixteenths under one beam, which the Manual's own level VI
        // example uses in both beats — a whole beat of them
        [1, 1, 1, 1, 4, 4],
        [4, 1, 1, 1, 1, 4],
        [4, 4, 1, 1, 1, 1],
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
        [4, 1, 1, 1, 1, 4, 4],
        [4, 4, 1, 1, 1, 1, 4],
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
    // 6/8 is a dotted-quarter metre; ♪ = 120 in the Manual's list belongs to the
    // simple metres. In 6/8 it would come out at 40 beats a minute, slower than
    // any printed example. Only what changes is listed: 4/4 goes up to 120 and
    // 6/8 takes its own marking, while the rest carry on from level V at 88.
    tempo: { '6/8': { unit: 'qd', bpm: 72 }, '4/4': { unit: 'q', bpm: 120 } },
    dynamics: ['mp', 'mf'],
    marks: ['staccato', 'accent'],
    rests: true,
    accidentals: 2,
  },
};

// A level's page prints only the tempi that change. Everything else carries
// over from the level before, so a later level never falls back to a slower
// speed for a metre it shares: level V's simple metres stay at IV's ♩ = 88, and
// level VI only lifts 4/4 to 120 and gives 6/8 its own marking.
for (const level of Object.keys(LEVELS).map(Number).sort((a, b) => a - b)) {
  if (level === 1) continue;
  LEVELS[level].tempo = { ...LEVELS[level - 1].tempo, ...LEVELS[level].tempo };
}

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
  // A leap is answered by a step back the other way. Every source says it the
  // same way — “leap up, step down” — and weighting it was not enough: only 30%
  // of leaps were actually resolved, because the arc kept pulling the line on.
  // So after a leap this is the only move considered.
  if (Math.abs(lastStep) >= 3) {
    const back = allowed.filter((s) => Math.sign(s) === -Math.sign(lastStep) && Math.abs(s) <= 2);
    if (back.length) {
      const weights = back.map((s) => STEP_WEIGHTS[Math.abs(s)] || 1);
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = rng() * total;
      for (let i = 0; i < back.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return back[i];
      }
      return back[back.length - 1];
    }
  }

  const options = [];
  for (const step of allowed) {
    let weight = STEP_WEIGHTS[step] || 0.3;
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

  // A beat of four sixteenths is the figure the Manual's own level VI example
  // leans on, so patterns containing one go into the draw twice. Left unweighted
  // it turned up in about half the passages; the students who need it most are
  // the ones who never saw it.
  const hasRunOfFour = (p) => {
    let run = 0;
    for (const d of p) {
      run = d === 1 ? run + 1 : 0;
      if (run >= 4) return true;
    }
    return false;
  };

  const bars = [];
  let previous = null;
  let runBars = 0;
  for (let b = 0; b < BAR_COUNT; b++) {
    // Avoid the same bar twice in a row when there is a choice: eight identical
    // bars of half notes is not a sight-reading test, it is a warm-up.
    const fresh = patterns.filter((p) => p !== previous);
    const base = fresh.length ? fresh : patterns;
    // One beat of sixteenths is usually the point of the passage, two is a
    // handful, four is a workout. Before the passage has one, the run patterns
    // are weighted up; afterwards they are usually taken out of the draw, with
    // enough of a chance left that a second one still happens — a lean, not a
    // lock.
    const runs = base.filter(hasRunOfFour);
    const plain = base.filter((p) => !hasRunOfFour(p));
    // How hard this level leans on the figure. Level VI leans hard, because the
    // Manual's own example is built from it. Level III meets it now and then:
    // there the pattern is in the draw for a bar about a third of the time and
    // out of it otherwise, so most passages have none and the rest have one.
    const lean = spec.sixteenths ?? 1;
    let pool_;
    if (runBars === 0 && runs.length && lean < 1) {
      pool_ = lean > 0 && chance(rng, lean) ? base : plain;
    } else if (runBars === 0) {
      pool_ = base.concat(runs, runs, runs, runs);
    } else if (plain.length && chance(rng, 0.85)) {
      pool_ = plain;
    } else {
      pool_ = base;
    }

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
    if (hasRunOfFour(pattern)) runBars++;
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
    // A sixteenth rest needs a run of sixteenths to sit in, and leaving the
    // choice to a random bar made it appear about once in twenty passages. So
    // the bar is drawn from those that actually have a run, and only sometimes
    // from the whole set.
    const runSlot = (events) => {
      for (let i = 1; i < events.length - 1; i++) {
        if (
          events[i].dur === 1 &&
          events[i - 1].dur === 1 &&
          events[i + 1].dur === 1
        ) {
          return i;
        }
      }
      return -1;
    };
    const runners = bars.filter((events) => runSlot(events) > 0);

    if (runners.length && chance(rng, 0.6)) {
      // The fourteenth-sixteenth figure: a rest inside the run, which breaks the
      // beam and leaves the notes on each side to beam among themselves.
      const events = runners[Math.floor(rng() * runners.length)];
      events[runSlot(events)].rest = true;
    } else {
      // Otherwise a beat or a half-beat rest, never the first or last event.
      const events = bars[1 + Math.floor(rng() * 5)];
      const slot = events.findIndex(
        (e, i) => i > 0 && e.dur >= 2 && e.dur <= 4 && i < events.length - 1,
      );
      if (slot > 0) events[slot].rest = true;
    }
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
  //
  // Levels V and VI are allowed the whole printed range, though. The Manual's
  // own level V example climbs to the D above the staff, two octaves above home,
  // and capping the climax at an octave meant that note could never appear.
  const top = pool.length - 1;
  const headroom = Math.max(1, top - home - 6);
  const reach = level >= 5 ? 7 + Math.floor(rng() * headroom) : 7;
  const peak = Math.min(top, home + reach);
  const lowest = Math.max(0, home - 3 - (level >= 5 ? Math.floor(rng() * 3) : 0));

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
      // Short notes step, long notes may leap. A sixteenth in the middle of a run
      // that jumps a fifth is the sort of thing that makes a random line sound
      // random; quarter notes and longer are where a leap belongs.
      const allowed = [...spec.steps, -1, -2, -3, -4, -5, -6]
        .filter((s) => spec.steps.includes(Math.abs(s)))
        .filter((s) => event.dur > 2 || Math.abs(s) <= 2);
      const step = chooseStep(rng, allowed, directionBias, lastStep);
      let next = prev + step;
      if (next < lowest || next > peak) next = prev - step;
      next = Math.max(lowest, Math.min(peak, next));
      // No augmented fourth: the one interval every melody text forbids. A
      // fourth between F and B is the usual accident; take the step next door
      // instead.
      if (Math.abs(pool[next].midi - pool[prev].midi) === 6) {
        const alt = prev + (next > prev ? 1 : -1);
        if (alt > lowest && alt < peak) next = alt;
      }
      prev = next;
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
    const ok = (other) =>
      !other ||
      (Math.abs(note.midi - other.midi) <= spec.maxSemis &&
        // An augmented fourth is the one interval every melody text forbids, so
        // no repair may introduce one either.
        Math.abs(note.midi - other.midi) !== 6);
    return ok(before) && ok(after);
  };

  /**
   * No unison with a neighbour — and above all no *enharmonic* unison. The trap
   * is G♯ followed by A♭: one pitch wearing two spellings, which reads as a
   * repeated note nobody meant to write. A lucky pairing of key and accidental
   * used to produce it (A♭ major was the usual culprit), and no adjudicator
   * sets that on purpose.
   */
  const samePitch = (event, note) => {
    const i = sounding.indexOf(event);
    const before = sounding[i - 1];
    const after = sounding[i + 1];
    return Boolean((before && before.midi === note.midi) || (after && after.midi === note.midi));
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

  // ── a motive comes back ────────────────────────────────────────────────
  // “Without repetition the listener hears successive ideas as random and
  // unrelated” — every source says some version of that. So one later bar
  // restates an earlier bar's line exactly, transposed so its first note stays
  // put. Only whole-tone-or-bigger steps survive the transposition, so if the
  // shape does not fit the key it is simply not used.
  const restateBar = (fromBar, toBar) => {
    const from = bars[fromBar].filter((e) => !e.rest);
    const to = bars[toBar].filter((e) => !e.rest);
    const n = Math.min(from.length, to.length);
    if (n < 3) return false;
    let idx = pool.findIndex((x) => x.midi === to[0].midi);
    if (idx < 0) return false;
    const copy = [pool[idx]];
    for (let i = 1; i < n; i++) {
      const step = from[i].midi - from[i - 1].midi;
      if (Math.abs(step) > spec.maxSemis) return false;
      const next = pool.findIndex((x) => x.midi === pool[idx].midi + step);
      if (next < 0) return false;
      copy.push(pool[next]);
      idx = next;
    }
    // The copy must not break an interval at either end of the bar either.
    const ok = (a, b) =>
      !a ||
      !b ||
      (Math.abs(a.midi - b.midi) <= spec.maxSemis && Math.abs(a.midi - b.midi) !== 6);
    const at = sounding.indexOf(to[0]);
    if (!ok(sounding[at - 1], copy[0])) return false;
    if (!ok(copy[copy.length - 1], sounding[at + copy.length])) return false;
    copy.forEach((note, i) => setNote(to[i], note));
    return true;
  };

  if (level >= 3 && chance(rng, 0.75)) {
    // Try the answer phrase first (bars 5–8 restating 1–4), then any pair. The
    // copy only fits when the two bars have the same number of notes and every
    // step survives the transposition, so the search has to be a search.
    const pairs = [];
    // never into the last bar: the cadence has to stay where it was
    for (let a = 0; a < 4; a++) for (let b = 4; b < BAR_COUNT - 1; b++) pairs.push([a, b]);
    for (let a = 0; a < 3; a++) for (let b = a + 2; b < 4; b++) pairs.push([a, b]);
    for (const [fromBar, toBar] of pairs) {
      if (restateBar(fromBar, toBar)) break;
    }
  }

  // ── every leap is answered by a step back ──────────────────────────────
  // “Leap up, step down” is the one rule every melody text states identically,
  // and weighting it inside the walk left three quarters of leaps unresolved.
  // So it is enforced outright — and enforced twice, because the harmony and
  // peak passes that follow can nibble at a resolution even when told not to.
  const answerLeaps = () => {
    for (let i = 0; i < sounding.length - 2; i++) {
      const a = sounding[i];
      const b = sounding[i + 1];
      const c = sounding[i + 2];
      if (!a.note || !b.note || !c.note) continue;
      // The cadence is fixed: a line that does not end on the tonic is a bug, not
      // a resolution problem.
      if (i + 2 === sounding.length - 1) continue;
      const leap = b.midi - a.midi;
      if (Math.abs(leap) < 4) continue;
      if (Math.sign(c.midi - b.midi) === -Math.sign(leap) && Math.abs(c.midi - b.midi) <= 2) {
        continue; // already resolved
      }
      // The note that has to move is c, and it must land a scale step from b,
      // the other way from the leap. If the range or an interval blocks that, it stays.
      const wantUp = -Math.sign(leap) > 0;
      const candidates = wantUp
        ? pool.filter((n) => n.midi > b.midi)
        : [...pool].reverse().filter((n) => n.midi < b.midi);
      const stepBack = candidates.find((n) => !samePitch(c, n) && neighbourOk(c, n));
      if (stepBack) setNote(c, stepBack);
    }
  };

  answerLeaps();

  // ── the polish pass ────────────────────────────────────────────────────
  // Two rules the sources state plainly, applied once the line exists so each
  // note can see its neighbours:
  //
  //  * a note that lands on a beat should be a chord tone — that is what the ear
  //    hears as the harmony — while passing notes belong off the beat. Before
  //    this, only 56% of on-beat notes were chord tones.
  //  * the highest note should sound once. Spending the peak twice erodes it.
  /**
   * True when note i is the step back that answers a leap into it. Getting this
   * the wrong way round (protecting the leap rather than its resolution) is why
   * the first attempt at this pass halved the number of resolved leaps.
   */
  const resolvesALeap = (i) => {
    const twoBack = sounding[i - 2];
    const before = sounding[i - 1];
    const note = sounding[i];
    if (!twoBack || !before || !note) return false;
    const leap = before.midi - twoBack.midi;
    if (Math.abs(leap) < 4) return false;
    return (
      Math.sign(note.midi - before.midi) === -Math.sign(leap) &&
      Math.abs(note.midi - before.midi) <= 2
    );
  };

  const nearestChordTone = (event) => {
    const options = pool.filter(
      (n) =>
        [0, 2, 4].includes(n.degree) &&
        Math.abs(n.midi - event.midi) <= 2 &&
        !samePitch(event, n) &&
        neighbourOk(event, n),
    );
    if (!options.length) return null;
    return options.reduce((a, b) =>
      Math.abs(b.midi - event.midi) < Math.abs(a.midi - event.midi) ? b : a,
    );
  };

  for (let i = 0; i < sounding.length; i++) {
    const event = sounding[i];
    if (!event.note) continue;
    // Only the genuinely strong positions — the bar line and the half bar — so
    // a passing note is still free to sit elsewhere on the beat.
    if (event.start % (perBar / 2) !== 0) continue;
    if (i === sounding.length - 1) continue; // never the cadence
    if ([0, 2, 4].includes(event.note.degree)) continue;
    if (resolvesALeap(i)) continue; // answering a leap outranks the harmony
    // Nor may this move a note a leap lands on: shortening the leap would break
    // the step back that has just been put in place after it.
    const previous = sounding[i - 1];
    if (previous && Math.abs(event.midi - previous.midi) >= 4) continue;
    const note = nearestChordTone(event);
    if (note) setNote(event, note);
  }

  // The peak sounds once — but never at the cadence's expense. When the tonic
  // *is* the highest note the line reaches (usual at levels I–II, where the
  // range is narrow), the cadence keeps it and the earlier arrivals move.
  const highest = Math.max(...sounding.map((e) => e.midi));
  const cadence = sounding.length - 1;
  const keeper =
    sounding[cadence] && sounding[cadence].midi === highest
      ? cadence
      : sounding.findIndex((e) => e.midi === highest);
  for (let i = 0; i < sounding.length; i++) {
    const event = sounding[i];
    if (event.midi !== highest) continue;
    if (i === keeper) continue;
    if (resolvesALeap(i)) continue; // the step back outranks the peak
    const below = pool
      .filter((n) => n.midi < highest && !samePitch(event, n) && neighbourOk(event, n))
      .sort((a, b) => b.midi - a.midi)[0];
    if (below) setNote(event, below);
  }

  // The harmony and peak passes can shorten a leap or break the step back that
  // followed it, so the leap rule gets the last word.
  answerLeaps();

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
      // A chromatic note that lands on the pitch next door reads as a mistake,
      // however it is spelled — the G♯/A♭ trap.
      if (samePitch(event, spelled)) continue;
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

  // ── slurs ─────────────────────────────────────────────────────────────
  // Two to four notes of one bar under a curve. Engraving puts the slur on the
  // opposite side of the stems; the renderer works that out from the notes.
  // Slurs begin at level II — the Manual's level II page has slurred pairs —
  // and get commoner as the levels go up. `spec.slurs` is how often a passage
  // gets any: half of them at II, most at III, all of them from IV on.
  if (level >= 2) {
    const wanted = chance(rng, spec.slurs ?? 1)
      ? (chance(rng, level >= 4 ? 0.45 : 0.2) ? 2 : 1)
      : 0;
    for (let s = 0; s < wanted; s++) {
      // A slur is drawn on the side the stems are not, so every stem it spans has
      // to point the same way. A run that mixes them leaves the curve threading
      // between two stems, and one of them always ends up poking through it —
      // so try a few bars before giving up on this slur.
      for (let attempt = 0; attempt < 8; attempt++) {
        const barEvents = bars[Math.floor(rng() * (BAR_COUNT - 1))];
        if (barEvents.length < 2) continue;
        const len = Math.min(barEvents.length, 2 + Math.floor(rng() * 3));
        const start = Math.floor(rng() * (barEvents.length - len + 1));
        // A contiguous run of the bar, rests and all: a slur is one stroke of the
        // bow, so a rest anywhere under it is a contradiction — the bow has to
        // stop, which is precisely what a slur says not to do. Filtering the
        // rests out first did exactly that, drawing a curve over a silence.
        const run = barEvents.slice(start, start + len);
        if (run.some((e) => e.rest || !e.note)) continue;
        if (run.some((e) => e.slurStart || e.slurEnd)) continue;
        // A slur may not begin or end right beside a beamed group. Its curve is
        // drawn on the far side of its own stems, and a neighbouring group's beam
        // lies exactly across that path — the curve then threads the beam, which
        // is what a slur over the top of a sixteenth run looked like. Musically a
        // slur that cuts a figure in half is wrong too.
        const beamable = (e) => e && !e.rest && e.dur <= 2;
        if (beamable(barEvents[start - 1]) || beamable(barEvents[start + len])) continue;
        const points = new Set(run.map((e) => STAFF_GEOM.stemUp(e.note.letter, e.note.octave)));
        if (points.size > 1) continue;

        // And the run has to stay on the far side of the curve: an inner note
        // that reaches further to the slur's side than either end makes the
        // curve come down over it. The slur sits opposite the stems, so its side
        // is below the run when the stems point up, and above it when they point
        // down.
        const ys = run.map((e) => STAFF_GEOM.yForNote(e.note.letter, e.note.octave));
        const [first, end] = [ys[0], ys[ys.length - 1]];
        const inner = ys.slice(1, -1);
        const stemsUp = [...points][0];
        if (stemsUp && inner.some((y) => y > Math.max(first, end))) continue;
        if (!stemsUp && inner.some((y) => y < Math.min(first, end))) continue;

        run[0].slurStart = true;
        run[run.length - 1].slurEnd = true;
        break;
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
