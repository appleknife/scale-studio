// sightreading.js — an eight-bar passage, generated to the NYSSMA level table.
//
// The rules here are the ones a human would follow when writing a sight-reading
// example: open on a chord tone, step more than leap, resolve a leap by step in
// the other direction, one climax, cadence on the tonic. A random walk inside the
// level's limits still looks like an exercise; this does not.
//
// Everything is seeded, so a passage can be reproduced: the same level and seed
// always give the same eight bars. Durations are counted in sixteenth notes.

import { MAJOR_KEYS, keySignature, makeNote } from './music.js?v=202611021420';
import { STAFF_GEOM } from './staff.js?v=202611021420';

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
    // The markings grow with the level, one rung at a time: mf from I, f from III,
    // mp from IV, p from V. Fortissimo is nowhere in the Manual's sight-reading
    // criteria, and level VI used to be the one level that never drew an f at all.
    dynamics: ['mf', 'f'],
    marks: ['staccato'],
    // Level III is also where silence arrives: a quarter rest first, a half rest
    // now and then, and an eighth rest inside a beat. The sixteenth rest waits
    // until level VI (see `sixteenthRest` there).
    rests: true,
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
    dynamics: ['mp', 'mf', 'f'],
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
    dynamics: ['p', 'mp', 'mf', 'f'],
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
    dynamics: ['p', 'mp', 'mf', 'f'],
    marks: ['staccato', 'accent'],
    rests: true,
    // The sixteenth rest belongs to the top level: it only makes sense inside a
    // run of sixteenths, and level VI is the one that has runs to break.
    sixteenthRest: true,
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
    // Step momentum: a line that has just moved by a step tends to go on the same
    // way for another note or two. That is what turns a shuffled run of small
    // intervals into a run a player can hear the shape of — and it is the other
    // half of the skip-reversal rule above, which deals with the leaps.
    if (Math.abs(lastStep) <= 2 && lastStep !== 0 && Math.sign(step) === Math.sign(lastStep)) {
      weight *= 1.8;
    }
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

/** The marking ladder, soft to loud. Used to turn a ramp towards its next rung. */
const DYNAMIC_ORDER = ['pp', 'p', 'mp', 'mf', 'f', 'ff'];

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
  // A level that *meets* sixteenths meets them every time. Left to the draw,
  // level III produced the figure in about a third of its passages, which for a
  // student is the same as never: the page they are given is the page they
  // practise. So the bar that carries the run is chosen up front — never the
  // fourth (which ends on a note to breathe on) and never the last — and the
  // pattern there is forced. A second run is still possible, at the same lean.
  const lean = spec.sixteenths ?? 1;
  const runBar = lean < 1 ? pick(rng, [1, 2, 4, 5]) : -1;
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
    // Manual's own example is built from it; at levels IV and V the run is in
    // every draw. Level III takes the run once in every passage, at the bar
    // chosen above.
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
    if (b === runBar && runBars === 0) {
      const usable = (runs.length ? runs : patterns.filter(hasRunOfFour)).filter(
        (p) => p !== previous,
      );
      if (usable.length) pattern = pick(rng, usable);
    }
    if (pattern) {
      // the run bar is settled
    } else if (b === BAR_COUNT - 1) {
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

  // ── rests (level III and up) ──────────────────────────────────────────
  // One slot of one bar, sometimes two, is turned into silence. Which kind
  // matters as much as how often: a quarter rest is the one a sight-reader meets
  // constantly, a half rest takes two beats and is rarer, and a sixteenth rest
  // only makes sense inside a run of sixteenths, where it breaks the beam. The
  // old chooser took the first short slot it found in one middle bar, which was
  // nearly always an eighth — quarter rests hardly ever appeared.
  if (spec.rests && chance(rng, 0.6)) {
    // A bar never opens a passage or closes it with a silence: the first note and
    // the cadence have to sound. Any other slot may go quiet, including the first
    // slot of a bar, which is where a half rest belongs.
    const firstSlot = bars[0][0];
    const lastBar = bars[bars.length - 1];
    const lastSlot = lastBar[lastBar.length - 1];
    const free = (e) => e !== firstSlot && e !== lastSlot;

    const slotsOf = (test) => {
      const out = [];
      bars.forEach((events, b) =>
        events.forEach((e, i) => {
          if (free(e) && test(e, i, events)) out.push({ e, bar: b });
        }),
      );
      return out;
    };

    const compound = meter === '6/8';
    // A half rest needs a bar of two-beat groups to sit in: in 2/4 it would be a
    // whole-bar rest (drawn as a whole rest, not this glyph), and in 6/8 the beat
    // is a dotted quarter, so neither takes one.
    const allowsHalf = meter === '3/4' || meter === '4/4' || meter === '2/2';
    // A sixteenth rest is level VI's figure and nobody else's: the teacher is
    // clear that it does not turn up before the top level. At III it would also
    // carve a hole in the one guaranteed cluster of the passage, which is the
    // figure that level is *for*.
    const table = compound
      ? [[2, 1]] // an eighth rest; a quarter rest would cross 6/8's own beat
      : [[4, 5], [2, 2], [8, allowsHalf ? 2 : 0], [1, spec.sixteenthRest ? 1 : 0]];

    const options = table
      .map(([dur, weight]) => ({
        weight,
        list: dur === 1
          ? slotsOf((e, i, events) =>
              e.dur === 1 && events[i - 1]?.dur === 1 && events[i + 1]?.dur === 1)
          : slotsOf((e) => e.dur === dur),
      }))
      .filter((o) => o.weight > 0 && o.list.length);

    const placeOne = (banned = -1) => {
      const usable = options
        .map((o) => ({ weight: o.weight, list: o.list.filter((s) => s.bar !== banned) }))
        .filter((o) => o.list.length);
      if (!usable.length) return -1;
      const total = usable.reduce((a, o) => a + o.weight, 0);
      let roll = rng() * total;
      let chosen = usable[usable.length - 1];
      for (const o of usable) {
        roll -= o.weight;
        if (roll <= 0) {
          chosen = o;
          break;
        }
      }
      const slot = chosen.list[Math.floor(rng() * chosen.list.length)];
      slot.e.rest = true;
      return slot.bar;
    };

    const used = placeOne();
    // Two rests in a passage is ordinary music; two in the same bar is a hole.
    if (used >= 0 && chance(rng, 0.3)) placeOne(used);
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

  // ── the phrase plan ──────────────────────────────────────────────────
  //
  // Eight bars are four two-bar phrases, and a melody is not one slow arc. Each
  // phrase occupies a register; the next one leaps into a different one and stays
  // there a while, then the answer comes from below and the last phrase comes
  // home for the cadence. That contrast is the thing a line built only from steps
  // can never produce: every note lands beside the last one, the walk drifts
  // slowly, and the whole passage sits in one narrow band from beginning to end.
  //
  // The lift is in scale steps and follows what the level allows: a third at I–II
  // (whose largest interval is a third), a fourth at III, a fifth at IV, a sixth
  // at V–VI.
  const barOf = new Map();
  bars.forEach((events, b) => events.forEach((e) => barOf.set(e, b)));
  const phraseOf = (event) => Math.min(3, Math.floor((barOf.get(event) || 0) / 2));
  const lift = spec.maxSemis >= 12 ? 5 : spec.maxSemis >= 9 ? 4 : spec.maxSemis >= 7 ? 3 : 1;
  const zones = [0, lift, -Math.min(lift, 2), 0];

  let prev = home;
  let lastStep = 0;

  sounding.forEach((event, i) => {
    const bar = barOf.get(event) || 0;
    const zone = Math.max(lowest, Math.min(peak, home + zones[phraseOf(event)]));
    const opensPhrase = i > 0 && bar % 2 === 0;
    const directionBias = Math.sign(zone - prev);

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
      // A phrase that opens in a different register gets there in one move. Three
      // steps in a row towards a new zone sound like an accident; the leap at the
      // phrase boundary is what makes the second phrase a phrase. The leap is
      // capped by the level's own largest interval, so nothing here breaks the
      // rule the Manual sets.
      const leap = opensPhrase && Math.abs(zone - prev) >= 3;
      let step = 0;
      let next;
      if (leap) {
        const want = pool[zone];
        let best = prev;
        for (let j = Math.max(0, lowest); j <= Math.min(peak, pool.length - 1); j++) {
          if (Math.abs(pool[j].midi - pool[prev].midi) > spec.maxSemis) continue;
          if (Math.abs(pool[j].midi - want.midi) < Math.abs(pool[best].midi - want.midi)) best = j;
        }
        next = best;
        step = next - prev;
      } else {
        step = chooseStep(rng, allowed, directionBias, lastStep);
        next = prev + step;
        if (next < lowest || next > peak) next = prev - step;
        next = Math.max(lowest, Math.min(peak, next));
      }
      // No augmented fourth: the one interval every melody text forbids. A
      // fourth between F and B is the usual accident; take the step next door
      // instead.
      if (Math.abs(pool[next].midi - pool[prev].midi) === 6 && !leap) {
        const alt = prev + (next > prev ? 1 : -1);
        if (alt > lowest && alt < peak) next = alt;
      }
      prev = next;
      lastStep = step;   // a leap here is answered by a step back, like any other
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

  // ── dynamics: one at the start, and a hairpin around the climax ─────────
  //
  // A crescendo or decrescendo is printed as a hairpin — two lines opening, or
  // closing, across the beats it applies to — and it belongs at the climax,
  // because that is the only place a ramp means anything: drawn over a phrase
  // that never goes anywhere it teaches the wrong thing. So the peak is found
  // first, and the ramp is put on the side of it that the level asks for.
  const dynamic = pick(rng, spec.dynamics);
  const first = bars[0][0];
  if (!first.rest) first.dynamic = dynamic;

  let swell = null;
  if (level >= 4 && chance(rng, 0.6)) {
    let peak = null;
    bars.forEach((list, b) =>
      list.forEach((e, i) => {
        if (e.note && (!peak || e.midi > peak.midi)) peak = { bar: b, index: i, midi: e.midi };
      }),
    );
    // The ramp is measured in **beats**, not in notes. Counting notes put its ends
    // in the middle of things — under two of a triplet's three notes, or starting
    // on the second of an eighth pair — because a hairpin that stops halfway
    // through a group says the crescendo happens inside that group, which is not
    // what it means. A beat is the smallest span that is always a whole group.
    const wanted = level >= 5 && chance(rng, 0.5) ? 'dim' : 'cresc';
    const beatOf = (e) => Math.floor(e.start / beat + 1e-6);
    const onBeat = (s) => Math.abs(s / beat - Math.round(s / beat)) < 1e-6;
    const beatsPerBar = Math.round(perBar / beat);
    for (const kind of [wanted, wanted === 'cresc' ? 'dim' : 'cresc']) {
      if (!peak) break;
      const list = bars[peak.bar];
      const firstOf = (b) => list.findIndex((e) => beatOf(e) === b);
      const peakBeat = beatOf(list[peak.index]);
      let lastBeat = kind === 'cresc' ? peakBeat : peakBeat + 1;
      let firstBeat = kind === 'cresc' ? peakBeat - 1 : peakBeat;
      if (lastBeat >= beatsPerBar) continue;
      // The ramp has to *begin* on a beat. A beat whose first note is already off
      // the beat — syncopation, an eighth moving early — cannot open a hairpin:
      // the ramp would start half-way through a group. In that case it starts a
      // beat earlier instead, which is what a player would be told anyway.
      while (firstBeat > 0) {
        const candidate = firstOf(firstBeat);
        if (candidate >= 0 && onBeat(list[candidate].start)) break;
        firstBeat -= 1;
      }
      // …and it has to *end* where a beat begins. The beat after the ramp may open
      // with a note that is already off the beat — a tie across the bar's middle,
      // a dotted figure — so the ramp runs on until a beat starts cleanly, or
      // until the bar ends, which is always clean.
      while (lastBeat + 1 < beatsPerBar) {
        const nextBeat = firstOf(lastBeat + 1);
        if (nextBeat < 0 || onBeat(list[nextBeat].start)) break;
        lastBeat += 1;
      }
      const from = firstOf(firstBeat);
      if (from < 0 || !onBeat(list[from].start)) continue;
      const after = firstOf(lastBeat + 1);
      const to = after < 0 ? list.length - 1 : after - 1;
      if (to <= from) continue;
      // No rest under a hairpin: a ramp is one bow that keeps moving, and a rest
      // in the middle of one is the same contradiction as a slur over silence.
      if (list.slice(from, to + 1).some((e) => !e.note)) continue;
      // A ramp is written *towards* a marking — "mp < f" is music, a hairpin that
      // opens onto nothing is not. The passage's opening dynamic is the one it
      // starts from, so the target is the next rung up (or down) in the level's
      // own list; when there is no rung to reach, the ramp is left without one.
      const rung = DYNAMIC_ORDER.indexOf(dynamic);
      const reach = spec.dynamics.filter((d) =>
        kind === 'cresc' ? DYNAMIC_ORDER.indexOf(d) > rung : DYNAMIC_ORDER.indexOf(d) < rung,
      );
      const target = reach.length ? (kind === 'cresc' ? reach[0] : reach[reach.length - 1]) : null;
      swell = { bar: peak.bar, kind, from, to, target };
      break;
    }
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
