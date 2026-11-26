// rhythm.js — call-and-response rhythm: the ladder, the generator and the judge.
//
// The screen (rhythmview.js) draws this; the microphone and the pad feed it. The
// shape is a call-and-response cycle: hear one bar, answer it, and let the bar
// you fumbled come back. What is measured is *when* the bow catches the string —
// the attacks — not pitch, and the pattern is one pitch on purpose.
//
// Two things are deliberately different from that app. The ladder is short and
// built for a violinist: steady pulse and bow lanes first, then eighths, offbeats,
// sixteenths, dotted rhythms, triplets and syncopation. And the judge is
// interval-aware: when two notes are close together it checks the *gap* between
// them against the gap that was written, so a passage played a little behind but
// evenly can pass, while a passage that stumbles cannot.
//
// Time here is counted in sixteenth notes ("ticks"). A quarter note is 4, an
// eighth 2, a triplet eighth 4/3. Nothing is in milliseconds, so a bar keeps its
// shape at every tempo.

/* ── The ladder ─────────────────────────────────────────────────────────── */

const R = (n) => -n; // a rest of n ticks

const FIGURES = {
  q: { ticks: [4], kind: 'note' },
  e: { ticks: [2], kind: 'note' },
  s: { ticks: [1], kind: 'note' },
  ee: { ticks: [2, 2], kind: 'pair' },
  er: { ticks: [2, R(2)], kind: 'pair' },
  re: { ticks: [R(2), 2], kind: 'pair' },
  ssss: { ticks: [1, 1, 1, 1], kind: 'run' },
  eeee: { ticks: [2, 2, 2, 2], kind: 'run' },
  dot8: { ticks: [3, 1], kind: 'dotted' },
  dotq: { ticks: [6, 2], kind: 'dotted' },
  trip: { ticks: [4 / 3, 4 / 3, 4 / 3], kind: 'tuplet' },
  off1: { ticks: [R(1), 1, 2], kind: 'sync' },
  off2: { ticks: [R(2), 2], kind: 'sync' },
  e3: { ticks: [2, 2, 2], kind: 'run' },
  s4e: { ticks: [1, 1, 1, 1, 2], kind: 'run' },
  trip6: { ticks: Array(9).fill(4 / 3), kind: 'tuplet' },
};

const t = (kind, ticks) => ({ kind, ticks });

// One template is one bar. A cell is `q`/`h`/`w`/`r` (a written note or rest),
// `e` (an eighth) or `f` (a figure slot of the same length). `f8` is an
// eight-tick figure slot, used by the dotted quarter, and `f6` a six-tick one
// in 6/8.
const TEMPLATES = {
  '4/4': {
    1: [
      [t('h', 8), t('q', 4), t('q', 4)],
      [t('h', 8), t('r', 4), t('q', 4)],
      [t('q', 4), t('h', 8), t('q', 4)],
      [t('w', 16)],
      [t('h', 8), t('h', 8)],
      [t('q', 4), t('q', 4), t('h', 8)],
    ],
    2: [
      [t('h', 8), t('q', 4), t('r', 4)],
      [t('q', 4), t('h', 8), t('r', 4)],
      [t('h', 8), t('r', 4), t('q', 4)],
      [t('q', 4), t('r', 4), t('h', 8)],
      [t('w', 16)],
      [t('h', 8), t('h', 8)],
    ],
    3: [
      [t('f', 4), t('q', 4), t('q', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('q', 4), t('q', 4)],
      [t('q', 4), t('q', 4), t('f', 4), t('q', 4)],
      [t('q', 4), t('q', 4), t('q', 4), t('f', 4)],
      [t('f', 4), t('q', 4), t('f', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('q', 4), t('r', 4)],
    ],
    4: [
      [t('f', 4), t('f', 4), t('q', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('q', 4), t('f', 4)],
      [t('f', 4), t('q', 4), t('f', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('f', 4), t('q', 4)],
      [t('f', 4), t('f', 4), t('f', 4), t('q', 4)],
      [t('r', 4), t('f', 4), t('q', 4), t('f', 4)],
    ],
    5: [
      [t('f', 4), t('e', 2), t('e', 2), t('q', 4), t('q', 4)],
      [t('e', 2), t('e', 2), t('f', 4), t('q', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('e', 2), t('e', 2), t('q', 4)],
      [t('f', 4), t('q', 4), t('q', 4), t('e', 2), t('e', 2)],
      [t('q', 4), t('f', 4), t('q', 4), t('f', 4)],
      [t('f', 4), t('f', 4), t('q', 4), t('r', 4)],
    ],
    6: [
      [t('f', 4), t('q', 4), t('f', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('q', 4), t('f', 4)],
      [t('f', 4), t('r', 4), t('f', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('f', 4), t('r', 4)],
      [t('f', 4), t('q', 4), t('q', 4), t('q', 4)],
      [t('q', 4), t('q', 4), t('f', 4), t('f', 4)],
    ],
    7: [
      [t('f', 4), t('q', 4), t('q', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('q', 4), t('q', 4)],
      [t('f', 4), t('f', 4), t('q', 4), t('q', 4)],
      [t('f8', 8), t('q', 4), t('q', 4)],
      [t('q', 4), t('f8', 8), t('q', 4)],
      [t('f', 4), t('q', 4), t('f8', 8)],
    ],
    9: [
      [t('f', 4), t('q', 4), t('q', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('q', 4), t('q', 4)],
      [t('f', 4), t('r', 4), t('f', 4), t('q', 4)],
      [t('f', 4), t('f', 4), t('r', 4), t('q', 4)],
      [t('q', 4), t('r', 4), t('f', 4), t('f', 4)],
      [t('f', 4), t('q', 4), t('r', 4), t('f', 4)],
    ],
    10: [
      [t('f', 4), t('q', 4), t('f', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('e', 2), t('e', 2), t('q', 4)],
      [t('f', 4), t('r', 4), t('f', 4), t('q', 4)],
      [t('q', 4), t('q', 4), t('f', 4), t('f', 4)],
    ],
  },
  '3/4': {
    1: [
      [t('h', 8), t('q', 4)],
      [t('q', 4), t('h', 8)],
      [t('h', 8), t('r', 4)],
    ],
    2: [
      [t('h', 8), t('r', 4)],
      [t('q', 4), t('q', 4), t('r', 4)],
      [t('r', 4), t('q', 4), t('q', 4)],
      [t('q', 4), t('r', 4), t('q', 4)],
    ],
    3: [
      [t('f', 4), t('q', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('q', 4)],
      [t('q', 4), t('q', 4), t('f', 4)],
      [t('f', 4), t('q', 4), t('r', 4)],
      [t('q', 4), t('f', 4), t('r', 4)],
    ],
    4: [
      [t('f', 4), t('f', 4), t('q', 4)],
      [t('f', 4), t('q', 4), t('f', 4)],
      [t('q', 4), t('f', 4), t('f', 4)],
      [t('f', 4), t('f', 4), t('r', 4)],
    ],
    5: [
      [t('f', 4), t('q', 4), t('e', 2), t('e', 2)],
      [t('e', 2), t('e', 2), t('f', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('f', 4)],
      [t('f', 4), t('f', 4), t('q', 4)],
    ],
    6: [
      [t('f', 4), t('q', 4), t('f', 4)],
      [t('q', 4), t('f', 4), t('f', 4)],
      [t('f', 4), t('f', 4), t('r', 4)],
      [t('f', 4), t('r', 4), t('f', 4)],
    ],
    7: [
      [t('f', 4), t('q', 4), t('q', 4)],
      [t('f8', 8), t('q', 4)],
      [t('q', 4), t('f8', 8)],
      [t('f', 4), t('f', 4), t('q', 4)],
    ],
    8: [
      [t('f', 4), t('q', 4), t('q', 4)],
      [t('q', 4), t('f', 4), t('q', 4)],
      [t('f', 4), t('f', 4), t('r', 4)],
      [t('f', 4), t('r', 4), t('f', 4)],
    ],
    9: [
      [t('f', 4), t('q', 4), t('q', 4)],
      [t('f', 4), t('r', 4), t('f', 4)],
      [t('q', 4), t('f', 4), t('r', 4)],
    ],
    10: [
      [t('f', 4), t('q', 4), t('f', 4)],
      [t('q', 4), t('f', 4), t('e', 2), t('e', 2)],
    ],
  },
  '2/4': {
    1: [[t('h', 8)], [t('q', 4), t('q', 4)], [t('q', 4), t('r', 4)]],
    2: [[t('q', 4), t('q', 4)], [t('q', 4), t('r', 4)], [t('r', 4), t('q', 4)]],
    3: [[t('f', 4), t('q', 4)], [t('q', 4), t('f', 4)], [t('f', 4), t('f', 4)], [t('f', 4), t('r', 4)]],
    4: [[t('f', 4), t('f', 4)], [t('r', 4), t('f', 4)], [t('f', 4), t('r', 4)], [t('f', 4), t('q', 4)]],
    5: [[t('f', 4), t('e', 2), t('e', 2)], [t('e', 2), t('e', 2), t('f', 4)], [t('f', 4), t('f', 4)]],
    6: [[t('f', 4), t('q', 4)], [t('f', 4), t('f', 4)], [t('q', 4), t('f', 4)]],
    7: [[t('f', 4), t('q', 4)], [t('f8', 8)], [t('q', 4), t('f', 4)]],
    8: [[t('f', 4), t('q', 4)], [t('f', 4), t('r', 4)]],
    9: [[t('f', 4), t('q', 4)], [t('r', 4), t('f', 4)]],
    10: [[t('f', 4), t('q', 4)], [t('f', 4), t('f', 4)]],
  },
  '2/2': {
    9: [[t('q', 4), t('q', 4), t('f', 4), t('q', 4)], [t('f', 4), t('q', 4), t('f', 4), t('q', 4)]],
    10: [[t('f', 4), t('q', 4), t('f', 4), t('q', 4)], [t('q', 4), t('f', 4), t('e', 2), t('e', 2), t('q', 4)]],
  },
  '6/8': {
    8: [[t('f12', 12)], [t('f6', 6), t('f6', 6)], [t('f6', 6), t('q', 4), t('e', 2)]],
    9: [[t('f6', 6), t('f6', 6)], [t('f6', 6), t('r', 6)]],
    10: [[t('f12', 12)], [t('f6', 6), t('f6', 6)], [t('f6', 6), t('q', 4), t('e', 2)]],
  },
};

const STAGES = [
  {
    id: 'pulse',
    group: 'begin',
    meters: ['4/4', '3/4', '2/4'],
    figures: ['q'],
    base: 60,
    cap: 100,
    cards: 4,
    answerBars: 1,
  },
  {
    id: 'longshort',
    group: 'begin',
    meters: ['4/4', '3/4', '2/4'],
    figures: ['q'],
    base: 56,
    cap: 92,
    cards: 4,
    answerBars: 1,
  },
  {
    id: 'eighths',
    group: 'begin',
    meters: ['4/4', '3/4', '2/4'],
    figures: ['ee', 'er', 're'],
    base: 56,
    cap: 84,
    cards: 5,
    answerBars: 1,
  },
  {
    id: 'offbeats',
    group: 'begin',
    meters: ['4/4', '3/4', '2/4'],
    figures: ['er', 're'],
    mayOpenRest: true,
    base: 56,
    cap: 80,
    cards: 5,
    answerBars: 1,
  },
  {
    id: 'mixed',
    group: 'build',
    meters: ['4/4', '3/4', '2/4'],
    figures: ['ee', 'er', 're'],
    base: 60,
    cap: 88,
    cards: 5,
    answerBars: 1,
  },
  {
    id: 'sixteenths',
    group: 'build',
    meters: ['4/4', '3/4', '2/4'],
    figures: ['ssss'],
    strict: true,
    base: 54,
    cap: 76,
    cards: 5,
    answerBars: 1,
  },
  {
    id: 'dotted',
    group: 'colour',
    meters: ['4/4', '3/4', '2/4'],
    figures: ['dot8', 'dotq'],
    strict: true,
    base: 52,
    cap: 72,
    cards: 5,
    answerBars: 1,
  },
  {
    id: 'triplets',
    group: 'colour',
    meters: ['4/4', '3/4', '2/4', '6/8'],
    figures: ['trip', 'e3', 'trip6'],
    strict: true,
    base: 50,
    cap: 69,
    cards: 5,
    answerBars: 1,
  },
  {
    id: 'syncopation',
    group: 'colour',
    meters: ['4/4', '3/4', '2/4', '2/2'],
    figures: ['off1', 'off2'],
    strict: true,
    mayOpenRest: true,
    base: 52,
    cap: 72,
    cards: 5,
    answerBars: 1,
  },
  {
    id: 'reading',
    group: 'read',
    meters: ['4/4', '3/4', '2/4', '6/8', '2/2'],
    figures: ['ee', 'er', 're', 'ssss', 'dot8', 'trip', 'trip6', 'off1', 'e3', 's4e'],
    strict: true,
    bars: 2,
    base: 60,
    cap: 84,
    cards: 4,
    answerBars: 2,
  },
];

STAGES.forEach((stage, index) => {
  stage.index = index;
});
const STAGE_BY_ID = new Map(STAGES.map((s) => [s.id, s]));

export const RHYTHM_STAGES = STAGES.map((s) => ({ ...s }));
export const ACCURACY = [
  { id: 'room', coeff: 1.3 },
  { id: 'normal', coeff: 1 },
  { id: 'tight', coeff: 0.75 },
  { id: 'pro', coeff: 0.5 },
];
export const ACCURACY_BY_ID = new Map(ACCURACY.map((a) => [a.id, a]));

export const METERS = {
  '2/4': { beats: 2, unit: 4, perBar: 8 },
  '3/4': { beats: 3, unit: 4, perBar: 12 },
  '4/4': { beats: 4, unit: 4, perBar: 16 },
  '2/2': { beats: 2, unit: 2, perBar: 16 },
  '6/8': { beats: 2, unit: 8, perBar: 12 },
};

export const ticksPerBeat = (meter) => METERS[meter].perBar / METERS[meter].beats;

export function stageById(id) {
  return STAGE_BY_ID.get(id) || STAGES[0];
}

export function unlockedStages(stats) {
  return STAGES.map((s, i) => i === 0 || (stats.cleared || []).includes(STAGES[i - 1].id));
}

export function nextStageId(stats) {
  const open = unlockedStages(stats);
  const current = STAGES.findIndex((s) => s.id === stats.stage);
  for (let i = current + 1; i < STAGES.length; i++) if (open[i]) return STAGES[i].id;
  return STAGES[Math.max(0, current)].id;
}

/* ── Seeded randomness ─────────────────────────────────────────────────── */

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const chance = (rng, p) => rng() < p;

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ── The generator ─────────────────────────────────────────────────────── */

export function sumTicks(ticks) {
  return ticks.reduce((a, n) => a + Math.abs(n), 0);
}

/**
 * How strongly a figure is due. A figure the player keeps fumbling comes up
 * more; a figure just played sits out one turn so bars do not repeat.
 */
function weightOf(figure, weak, last) {
  const bad = weak?.[figure] || 0;
  let weight = 1 + Math.min(4, bad);
  if (figure === last) weight *= 0.35;
  return weight;
}

function chooseFigure(slot, stage, rng, weak, last) {
  const options = stage.figures.filter(
    (id) => FIGURES[id] && Math.abs(sumTicks(FIGURES[id].ticks) - slot) < 1e-6,
  );
  if (!options.length) return null;
  const weights = options.map((id) => weightOf(id, weak, last));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < options.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return options[i];
  }
  return options[options.length - 1];
}

function buildBar(stage, meter, rng, weak, last) {
  const byStage = TEMPLATES[meter] || {};
  const templates = byStage[stage.index + 1] || byStage[10] || byStage[1] || [];
  if (!templates.length) return null;
  const template = pick(rng, templates);
  const events = [];
  let start = 0;
  let lastFigure = last || null;
  for (const cell of template) {
    if (cell.kind === 'f' || cell.kind === 'f8' || cell.kind === 'f6' || cell.kind === 'f12') {
      const figure = chooseFigure(cell.ticks, stage, rng, weak, lastFigure);
      if (figure) {
        const ticks = FIGURES[figure].ticks;
        for (const n of ticks) {
          events.push({ start, dur: Math.abs(n), rest: n < 0, figure });
          start += Math.abs(n);
        }
        lastFigure = figure;
        continue;
      }
    }
    if (cell.kind === 'f') {
      const filler = cell.ticks === 8 ? (chance(rng, 0.5) ? 8 : R(8)) : cell.ticks === 6 ? 2 : 4;
      events.push({ start, dur: Math.abs(filler), rest: filler < 0, figure: 'q' });
      start += Math.abs(filler);
    } else if (cell.kind === 'f8') {
      events.push({ start, dur: 8, rest: false, figure: 'h' });
      start += 8;
    } else if (cell.kind === 'f6') {
      events.push({ start, dur: 6, rest: false, figure: 'e3' });
      start += 6;
    } else if (cell.kind === 'f12') {
      for (let i = 0; i < 9; i++) events.push({ start: start + i * (4 / 3), dur: 4 / 3, rest: false, figure: 'trip6' });
      start += 12;
    } else if (cell.kind === 'w') {
      events.push({ start, dur: 16, rest: false, figure: 'w' });
      start += 16;
    } else if (cell.kind === 'h') {
      events.push({ start, dur: 8, rest: false, figure: 'h' });
      start += 8;
    } else if (cell.kind === 'r') {
      events.push({ start, dur: cell.ticks, rest: true, figure: 'r' });
      start += cell.ticks;
    } else if (cell.kind === 'e') {
      const note = chance(rng, 0.5) ? 2 : R(2);
      events.push({ start, dur: Math.abs(note), rest: note < 0, figure: 'e' });
      start += Math.abs(note);
    } else {
      events.push({ start, dur: 4, rest: false, figure: 'q' });
      start += 4;
    }
  }
  if (!events.length || events.every((e) => e.rest)) return null;
  return events;
}

/**
 * One pattern: a bar (or two at the reading stage) written as flat events on a
 * tick grid. A bar that comes out all rests is redrawn from the same seed.
 */
export function makePattern({ stageId, seed, weak = {}, previous = [] }) {
  const stage = stageById(stageId);
  const rng = rngFrom(seed);
  const meter = pick(rng, stage.meters);
  const bars = stage.bars || 1;
  const perBar = METERS[meter].perBar;
  const events = [];
  let lastFigure = previous[previous.length - 1] || null;
  for (let b = 0; b < bars; b++) {
    const bar = buildBar(stage, meter, rng, weak, lastFigure);
    if (!bar) return null;
    lastFigure = bar.filter((e) => !e.rest).map((e) => e.figure).pop() || lastFigure;
    for (const e of bar) events.push({ ...e, start: e.start + b * perBar });
  }
  const lastEvent = events[events.length - 1];
  if (!lastEvent) return null;
  const ticks = lastEvent.start + lastEvent.dur;
  const attacks = events.filter((e) => !e.rest);
  if (!attacks.length) return null;
  // A bar normally opens on its downbeat. The offbeat and syncopation stages
  // are the two that must be allowed to open with silence.
  if (!stage.mayOpenRest && events[0].rest) return null;
  return {
    id: seed,
    stageId: stage.id,
    seed,
    sig: events.map((e) => `${e.start}.${e.dur}${e.rest ? 'r' : ''}`).join('|'),
    meter,
    perBar,
    bars,
    events,
    figures: [
      ...new Set(
        events.map((e) => e.figure).filter((f) => f && f !== 'q' && f !== 'h' && f !== 'w' && f !== 'r' && f !== 'e'),
      ),
    ],
    ticks,
    attacks,
    strict: Boolean(stage.strict),
    tempo: stage.base,
  };
}

export function makePool(stageId, seed, weak = {}) {
  const stage = stageById(stageId);
  const need = stage.cards || 5;
  const pool = [];
  const seen = [];
  for (let i = 0; i < need * 4 && pool.length < need; i++) {
    const pattern = makePattern({ stageId, seed: hash(`${seed}:${stageId}:${i}`), weak, previous: seen });
    if (!pattern) continue;
    if (pool.some((p) => p.sig === pattern.sig)) continue;
    pool.push(pattern);
    seen.push(pattern.figures[pattern.figures.length - 1] || null);
  }
  return pool;
}

/* ── The judge ─────────────────────────────────────────────────────────── */

/**
 * Compare the written attacks with the heard ones. Times are ticks from the
 * start of the answer.
 *
 * The window around each target reaches halfway to its neighbours, so every
 * heard attack belongs to exactly one written note. Within a window the
 * nearest attack may match — but only if it is close in absolute terms, and,
 * where the previous note was also matched and sits less than a quarter away,
 * if the *gap* is close too. Second and later attacks in a window are extra.
 *
 * Status is `ok`, `early`, `late`, `missed` or `extra`.
 */
export function judge(targets, onsets, { strict = false, ticksPerBeat: tpb = 4, coeff = 1 } = {}) {
  const targetList = [...new Set(targets)].sort((a, b) => a - b);
  const heard = [...onsets].sort((a, b) => a - b);
  const absTol = (coeff / 6) * tpb;
  const ioiTol = (coeff / (strict ? 12 : 6)) * tpb;
  const phase = 0.99 * tpb;

  if (!targetList.length) {
    return { features: [], clean: heard.length === 0, empty: heard.length === 0, drift: 0, missed: 0, extra: 0, bad: 0 };
  }
  if (!heard.length) {
    return {
      features: targetList.map((target) => ({ target, onset: null, status: 'missed' })),
      clean: false,
      empty: true,
      drift: 0,
      missed: targetList.length,
      extra: 0,
      bad: 0,
    };
  }

  const bounds = [-Infinity];
  for (let i = 0; i < targetList.length - 1; i++) bounds.push((targetList[i] + targetList[i + 1]) / 2);
  bounds.push(Infinity);

  let previous = null;
  let drift = 0;
  let matched = 0;
  let missed = 0;
  let extra = 0;
  let bad = 0;
  const features = [];

  for (let i = 0; i < targetList.length; i++) {
    const target = targetList[i];
    const inWindow = heard
      .filter((o) => o > bounds[i] && o <= bounds[i + 1])
      .sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
    if (!inWindow.length) {
      missed++;
      features.push({ target, onset: null, status: 'missed' });
      continue;
    }
    const first = inWindow[0];
    const error = first - target;
    let deviation = Math.abs(error);
    if (previous && target - previous.target < phase) {
      deviation = Math.abs(first - previous.onset - (target - previous.target));
    }
    if (Math.abs(error) < absTol && deviation < ioiTol) {
      matched++;
      drift += error;
      features.push({ target, onset: first, status: 'ok', error });
      previous = { target, onset: first };
    } else {
      bad++;
      features.push({ target, onset: first, status: error < 0 ? 'early' : 'late', error });
    }
    for (let k = 1; k < inWindow.length; k++) {
      extra++;
      features.push({ target, onset: inWindow[k], status: 'extra', error: inWindow[k] - target });
    }
  }

  return {
    features,
    clean: bad === 0 && missed === 0 && extra === 0,
    empty: false,
    drift: matched ? drift / matched : 0,
    missed,
    extra,
    bad,
  };
}

/** Ticks between two felt beats. */
export function beatTicks(meter) {
  return METERS[meter].perBar / METERS[meter].beats;
}

/** A tick position in performance time, in seconds from the session clock. */
export function secondsToTicks(seconds, bpm, meter) {
  const felt = beatTicks(meter);
  return (seconds / (60 / bpm)) * felt;
}

/* ── Progress ─────────────────────────────────────────────────────────── */

export const LEVEL_MIN = -2;
export const LEVEL_MAX = 2;

export function bumpLevel(level, passed) {
  const next = level + (passed ? 1 : -1);
  return Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, next));
}

/** The next card: the weakest that is not the one just played. */
export function chooseNext(pool, levels, previousSig = null) {
  const open = pool.filter((p) => p.sig !== previousSig || pool.length === 1);
  const list = open.length ? open : pool;
  return list.reduce((best, p) => {
    const lv = levels[p.sig] || 0;
    const bestLv = levels[best.sig] || 0;
    return lv < bestLv ? p : best;
  }, list[0]);
}

export function stageDone(pool, levels) {
  return pool.length > 0 && pool.every((p) => (levels[p.sig] || 0) >= LEVEL_MAX);
}

export function tempoFor(stats, stage, bpm) {
  const wanted = bpm || stats.tempo?.[stage.id] || stage.base;
  return Math.max(40, Math.min(stage.cap, Math.round(wanted)));
}

/**
 * Tempo after an answer. Clean answers lift the speed every fourth in a row;
 * three fumbles in a row bring it back down. The floor is a little under the
 * stage's own starting speed, and the stage's ceiling keeps sixteenths and
 * triplets playable.
 */
export function tempoAfter(current, stage, { clean, streak, failStreak }) {
  let next = current;
  if (clean && streak > 0 && streak % 4 === 0) next += 2;
  if (!clean && failStreak > 0 && failStreak % 3 === 0) next -= 2;
  return Math.max(40, Math.min(stage.cap, next));
}

/* ── Bowings ──────────────────────────────────────────────────────────── */

/**
 * A bow for every attack: down on the first, then alternating. A rest does not
 * change the bow. The melody is one pitch, so this is the whole bowing story.
 */
export function bowPlan(pattern) {
  let down = true;
  const out = new Map();
  for (const event of pattern.events) {
    if (event.rest) continue;
    out.set(event.start, down ? 'down' : 'up');
    down = !down;
  }
  return out;
}

/* ── Storage ──────────────────────────────────────────────────────────── */

export function storageKey(profileId) {
  return `scaleStudio.rhythm.v1.${profileId || 'default'}`;
}

export function emptyStats() {
  return {
    v: 1,
    stage: 'pulse',
    cleared: [],
    tempo: {},
    levels: {},
    pools: {},
    weak: {},
    runs: [],
    streak: 0,
    bestStreak: 0,
    latency: null,
    accuracy: 'normal',
    focus: true,
    input: 'violin',
    metronome: true,
    string: 'D4',
  };
}

export function loadStats(profileId, store = localStorage) {
  try {
    const raw = store.getItem(storageKey(profileId));
    if (!raw) return emptyStats();
    const saved = JSON.parse(raw);
    const base = emptyStats();
    return {
      ...base,
      ...saved,
      cleared: Array.isArray(saved.cleared) ? saved.cleared : [],
      tempo: saved.tempo || {},
      levels: saved.levels || {},
      pools: saved.pools || {},
      weak: saved.weak || {},
      runs: Array.isArray(saved.runs) ? saved.runs : [],
      accuracy: ACCURACY_BY_ID.has(saved.accuracy) ? saved.accuracy : 'normal',
      input: saved.input === 'tap' ? 'tap' : 'violin',
      string: ['G3', 'D4', 'A4', 'E5'].includes(saved.string) ? saved.string : 'D4',
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(profileId, stats, store = localStorage) {
  try {
    store.setItem(storageKey(profileId), JSON.stringify(stats));
  } catch {
    /* full or blocked: the set still plays, it just is not kept */
  }
}

/* ── Calibration ──────────────────────────────────────────────────────── */

/**
 * The offset, in milliseconds, between the audio clock and the ear. Taps made
 * while eight clicks sound are measured against the clicks; the median survives
 * a stray tap. Positive means the player's attacks arrive later than the page
 * hears them, which is the normal case with a speaker and a microphone.
 */
export function calibrationOffset(clickTimes, tapTimes) {
  const pairs = [];
  for (const tap of tapTimes) {
    let best = null;
    let away = Infinity;
    for (const click of clickTimes) {
      const d = tap - click;
      if (Math.abs(d) < Math.abs(away)) {
        away = d;
        best = click;
      }
    }
    if (best != null && Math.abs(away) < 0.35) pairs.push(away);
  }
  if (pairs.length < 4) return null;
  pairs.sort((a, b) => a - b);
  const mid = pairs.length >> 1;
  return pairs.length % 2 ? pairs[mid] : (pairs[mid - 1] + pairs[mid]) / 2;
}


