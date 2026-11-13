// listen.js — what a free performance says, with or without the score.
//
// Pure functions over the pitch frames the app already collects
// ({ t, freq, clarity, rms }). Two readings:
//
//   analyzeFree(frames)        no score: tendencies, never verdicts — the app
//                              cannot know which note was *meant*, so it reports
//                              how far each note sat from the nearest in-tune
//                              pitch, how the vibrato moved, the loud and soft
//                              range, and where the playing stopped.
//   analyzeScore(frames, score) with a score (musicxml.js): every written note
//                              is matched to a played one, so notes, rhythm and
//                              intonation are measured against what was meant,
//                              bar by bar.
//
// What the numbers rest on:
//   - Vibrato is a 4–8 Hz wobble of the pitch (Essentia's detector uses the same
//     band); violin vibrato is narrow — around 30 cents wide at about 6 Hz — so a
//     note counts as vibrato from 12 cents peak to peak.
//   - Accompaniment is not separated, only noticed: several notes at once give a
//     single-pitch detector frames with no clear period, so a take that is loud
//     but mostly unclear is most likely playing along with something.

import { segmentNotes, align } from './analyze.js?v=202611131720';

const median = (xs) => {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
export const nameOf = (midi) => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
export const pcName = (midi) => NAMES[((midi % 12) + 12) % 12];

/** The open string a note is most likely played on, in first position. */
export function stringOf(midi) {
  if (midi < 62) return 'G';
  if (midi < 69) return 'D';
  if (midi < 76) return 'A';
  return 'E';
}

/* ── Vibrato ───────────────────────────────────────────────────────────── */

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
  const cents = core.map((f) => (69 + 12 * Math.log2(f.freq / 440) - note.pitch) * 100);
  // drop octave slips and other outliers before measuring
  const clean = cents.map((c) => (Math.abs(c) > 120 ? 0 : c));
  // remove the slow drift: a straight line through the note
  const ts = core.map((f) => f.t);
  const n = ts.length;
  const mt = ts.reduce((a, b) => a + b, 0) / n;
  const mc = clean.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (ts[i] - mt) * (clean[i] - mc);
    den += (ts[i] - mt) ** 2;
  }
  const slope = den ? num / den : 0;
  const flat = clean.map((c, i) => c - (mc + slope * (ts[i] - mt)));
  // a light smoothing, so frame jitter is not counted as wobble
  const sm = flat.map((v, i) => (flat[i - 1] ?? v) * 0.25 + v * 0.5 + (flat[i + 1] ?? v) * 0.25);
  let crossings = 0;
  for (let i = 1; i < sm.length; i++) if (Math.sign(sm[i]) !== Math.sign(sm[i - 1]) && sm[i] !== 0) crossings++;
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

function vibratoSummary(frames, notes) {
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

/* ── Loudness, stops, accompaniment ───────────────────────────────────── */

const db = (rms) => 20 * Math.log10(Math.max(1e-6, rms));

function dynamicsOf(frames, gate) {
  const voiced = frames.filter((f) => f.rms > gate && f.freq > 0);
  if (voiced.length < 20) return null;
  const levels = voiced.map((f) => db(f.rms)).sort((a, b) => a - b);
  const soft = pct(levels, 0.1);
  const loud = pct(levels, 0.95);
  // a level per second, for a small picture of the shape of the take
  const end = frames[frames.length - 1].t;
  const curve = [];
  for (let s = 0; s < end; s += 1) {
    const inSec = voiced.filter((f) => f.t >= s && f.t < s + 1).map((f) => db(f.rms));
    curve.push(inSec.length ? median(inSec) : null);
  }
  return { soft, loud, range: loud - soft, curve };
}

function stopsOf(notes, min = 1.2) {
  const out = [];
  for (let k = 1; k < notes.length; k++) {
    const gap = notes[k].t0 - notes[k - 1].t1;
    if (gap >= min) out.push({ t: notes[k - 1].t1, length: gap, resume: notes[k].t0 });
  }
  return out;
}

/**
 * Whether something else was sounding: of the frames loud enough to be playing,
 * the share without a clear single pitch. A violin alone sits well under a
 * third; a violin over a piano or an orchestra well over half.
 */
export function accompanimentOf(frames, gate) {
  const loud = frames.filter((f) => f.rms > Math.max(gate * 2, 0.004));
  if (loud.length < 60) return { likely: false, share: 0, judged: false };
  const unclear = loud.filter((f) => !f.freq || f.clarity < 0.6).length / loud.length;
  return { likely: unclear > 0.45, share: unclear, judged: true };
}

/* ── Free playing ─────────────────────────────────────────────────────── */

export function analyzeFree(frames) {
  const { notes, gate } = segmentNotes(frames);
  const duration = frames.length ? frames[frames.length - 1].t : 0;

  // How each note sat against the nearest in-tune pitch. Only notes held long
  // enough to tune (0.2 s) count; a passing note says little about the ear.
  const tuned = notes.filter((n) => n.t1 - n.t0 >= 0.2);
  const byPc = new Map();
  for (const n of tuned) {
    const k = ((n.midi % 12) + 12) % 12;
    if (!byPc.has(k)) byPc.set(k, []);
    byPc.get(k).push(n.cents);
  }
  const tendencies = [...byPc.entries()]
    .filter(([, cs]) => cs.length >= 3)
    .map(([k, cs]) => ({ pc: k, name: NAMES[k], n: cs.length, mean: cs.reduce((a, b) => a + b, 0) / cs.length }))
    .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean));
  const byString = ['G', 'D', 'A', 'E']
    .map((s) => {
      const cs = tuned.filter((n) => stringOf(n.midi) === s).map((n) => n.cents);
      return { string: s, n: cs.length, mean: cs.length ? cs.reduce((a, b) => a + b, 0) / cs.length : null };
    })
    .filter((x) => x.n >= 4);
  const abs = tuned.map((n) => Math.abs(n.cents));
  // drift: the first third against the last
  const third = Math.max(1, Math.floor(tuned.length / 3));
  const early = tuned.slice(0, third).map((n) => n.cents);
  const late = tuned.slice(-third).map((n) => n.cents);

  return {
    duration,
    notes,
    heard: notes.length,
    intonation: tuned.length
      ? {
          n: tuned.length,
          inTune: abs.filter((c) => c <= 15).length / abs.length,
          sharp: tuned.filter((n) => n.cents > 15).length / tuned.length,
          flat: tuned.filter((n) => n.cents < -15).length / tuned.length,
          tendencies,
          byString,
          drift:
            tuned.length >= 9
              ? (late.reduce((a, b) => a + b, 0) / late.length) - (early.reduce((a, b) => a + b, 0) / early.length)
              : null,
        }
      : null,
    vibrato: vibratoSummary(frames, notes),
    dynamics: dynamicsOf(frames, gate),
    stops: stopsOf(notes),
    accompaniment: accompanimentOf(frames, gate),
    range: notes.length ? { low: Math.min(...notes.map((n) => n.midi)), high: Math.max(...notes.map((n) => n.midi)) } : null,
  };
}

/* ── With a score ─────────────────────────────────────────────────────── */

/**
 * `score` is readScore()'s result. Returns everything analyzeFree does, plus:
 *   results: one per written note (playing order) — status exact | octave |
 *            wrong | missed, cents, the played midi and when it was played
 *   bars:    one per bar as played — notes, exact, wrong, missed, bpm, start
 *            (seconds into the take, from its matched notes; null if none)
 *   tempo:   { bpm (median), marked, steadiness 0–1, rushing / dragging bars }
 */
export function analyzeScore(frames, score) {
  const free = analyzeFree(frames);
  const { notes } = free;
  const expected = score.notes.map((n) => n.midi);
  const { pairs, extras } = align(notes.map((n) => n.midi), expected);

  // `beat` keeps the note's place in its bar; `at` becomes when it was played.
  const results = score.notes.map((n, i) => ({ ...n, beat: n.at, index: i, status: 'missed', cents: 0, played: null, at: null }));
  for (const { d, e } of pairs) {
    const det = notes[d];
    const r = results[e];
    const diff = det.midi - expected[e];
    r.played = det.midi;
    r.at = det.t0;
    r.until = det.t1;
    if (diff === 0) {
      r.status = 'exact';
      r.cents = det.cents;
    } else if (Math.abs(diff) % 12 === 0) {
      r.status = 'octave';
      r.cents = (det.pitch - expected[e]) * 100;
    } else {
      r.status = 'wrong';
      r.cents = (det.pitch - expected[e]) * 100;
    }
  }

  // Seconds per quarter between neighbouring matched notes: the student's own
  // pulse, wherever they are in the piece.
  const spans = [];
  for (let k = 1; k < pairs.length; k++) {
    const a = pairs[k - 1];
    const b = pairs[k];
    if (b.e !== a.e + 1) continue;
    const q = score.notes[b.e].abs - score.notes[a.e].abs;
    if (q <= 0) continue;
    spans.push({ e: b.e, spq: (notes[b.d].t0 - notes[a.d].t0) / q });
  }
  const spq = median(spans.map((s) => s.spq));

  // Bars as played: the order the reader went through them (repeats unrolled).
  const bars = [];
  let barStart = 0;
  const firstOf = new Map();
  score.order.forEach((mi, p) => {
    const quarters = score.measures[mi].quarters;
    bars.push({ play: p, measure: mi, number: score.measures[mi].number, from: barStart, quarters, notes: 0, exact: 0, wrong: 0, missed: 0, spqs: [], start: null });
    barStart += quarters;
  });
  // map each written note to its played bar
  const passCount = new Map();
  const barIndexOf = [];
  {
    let p = 0;
    for (const r of results) {
      while (p < bars.length - 1 && r.abs >= bars[p].from + bars[p].quarters - 1e-6) p++;
      barIndexOf.push(p);
      const b = bars[p];
      b.notes += 1;
      if (r.status === 'exact') b.exact += 1;
      else if (r.status === 'missed') b.missed += 1;
      else b.wrong += 1;
    }
  }
  for (const s of spans) bars[barIndexOf[s.e]].spqs.push(s.spq);
  results.forEach((r, i) => {
    const b = bars[barIndexOf[i]];
    if (r.at != null && b.start == null && spq) b.start = Math.max(0, r.at - (r.abs - b.from) * spq);
    if (!firstOf.has(b.measure)) firstOf.set(b.measure, barIndexOf[i]);
  });
  for (const b of bars) {
    const m = median(b.spqs);
    b.bpm = m ? 60 / m : null;
    delete b.spqs;
  }

  // Steadiness: how far each span strays from the pulse (a quarter of it free).
  let steadiness = null;
  if (spans.length >= 4 && spq) {
    let sum = 0;
    for (const s of spans) {
      const err = Math.abs(s.spq - spq) / spq;
      sum += Math.max(0, Math.min(1, 1 - (err - 0.25) / 0.5));
    }
    steadiness = sum / spans.length;
  }
  const bpm = spq ? 60 / spq : null;
  const rushing = bars.filter((b) => b.bpm && bpm && b.bpm > bpm * 1.15 && b.notes >= 2);
  const dragging = bars.filter((b) => b.bpm && bpm && b.bpm < bpm * 0.85 && b.notes >= 2);

  const exact = results.filter((r) => r.status === 'exact');
  const intonation = exact.length
    ? {
        n: exact.length,
        inTune: exact.filter((r) => Math.abs(r.cents) <= 15).length / exact.length,
        sharp: exact.filter((r) => r.cents > 15).length / exact.length,
        flat: exact.filter((r) => r.cents < -15).length / exact.length,
        // which written notes run sharp or flat, by name
        tendencies: (() => {
          const m = new Map();
          for (const r of exact) {
            const k = ((r.midi % 12) + 12) % 12;
            if (!m.has(k)) m.set(k, []);
            m.get(k).push(r.cents);
          }
          return [...m.entries()]
            .filter(([, cs]) => cs.length >= 2)
            .map(([k, cs]) => ({ pc: k, name: NAMES[k], n: cs.length, mean: cs.reduce((a, b) => a + b, 0) / cs.length }))
            .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean));
        })(),
      }
    : null;

  const worst = bars
    .filter((b) => b.notes)
    .map((b) => ({ ...b, rightShare: b.exact / b.notes }))
    .filter((b) => b.rightShare < 0.75)
    .sort((a, b) => a.rightShare - b.rightShare)
    .slice(0, 4);

  return {
    ...free,
    withScore: true,
    results,
    extras: extras.length,
    expected: results.length,
    exact: exact.length,
    wrong: results.filter((r) => r.status === 'wrong' || r.status === 'octave').length,
    missed: results.filter((r) => r.status === 'missed').length,
    bars,
    worst,
    tempo: { bpm, marked: score.tempo, steadiness, rushing, dragging },
    intonation,
    reached: (() => {
      // how far into the piece the take got: the last bar with a matched note
      let last = -1;
      bars.forEach((b, i) => {
        if (b.exact + b.wrong > 0) last = i;
      });
      return { bar: last, of: bars.length };
    })(),
  };
}

/** Seconds into the take where a written bar was (first) begun, or null. */
export function barStartTime(analysis, measureIndex) {
  const b = analysis.bars.find((x) => x.measure === measureIndex && x.start != null);
  return b ? b.start : null;
}
