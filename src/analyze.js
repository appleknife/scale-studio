// analyze.js — turns a stream of pitch frames into notes, compares them with
// the requested scale, and produces a score plus plain-language feedback.
//
// This module is deliberately free of DOM and audio code so it can be tested
// in isolation (see tests/dsp.test.html).

import { median } from './pitch.js?v=202611120915';
import { getLang, t } from './i18n.js?v=202611120915';

export const DEFAULTS = {
  minClarity: 0.5,
  // Anything shorter than ~90 ms is almost always a bow change or a blip
  // caught mid-shift, not a note the student meant to play.
  minNoteFrames: 3,
  minNoteSeconds: 0.07,
  jumpSemitones: 0.7,
  // How the final percentage is assembled.
  weights: { accuracy: 0.56, intonation: 0.2, steadiness: 0.12, continuity: 0.12 },
  // Cents error that still counts as "centred" / where credit reaches zero.
  intonationPerfect: 15,
  intonationZero: 55,
  // Notes quieter than this are treated as silence (refined per take). It is a
  // floor against digital silence, not a guess at how loud a violin should be: a
  // phone's gain control can put a whole take under the old 0.0035, and then the
  // take came back as "nothing heard" while the student was playing all the way
  // through.
  minRms: 0.0015,
};

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/**
 * What a take says about the player, as opposed to what it scores.
 *
 * The score answers "how did that go"; this answers "what should I work on",
 * which is the question a teacher answers from the same evidence. Everything
 * here is measured, nothing is inferred: a pitch class is only named when at
 * least two of its notes were played and they agree with each other, and a
 * drift is only reported when the middle of the take and its end disagree by
 * enough to hear.
 *
 * Returned in plain numbers — the screens do the language.
 *
 * @param {Array} results per-note results: {status, cents, event:{midi}}
 * @param {Array} ratios seconds-per-written-unit, one per consecutive pair
 */
export function listenNotes(results = [], ratios = []) {
  const tuned = results.filter((r) => r.status === 'exact' && Number.isFinite(r.cents));

  // A systematic error on one written note: the same finger, the same habit.
  // Grouped by the note itself, not its pitch class — D4 and D5 are different
  // fingers on different strings, and averaging them blamed "the D4" for a D5
  // that was sharp, and counted every D on the page as one of "them".
  const byClass = new Map();
  for (const r of tuned) {
    // Two analysers, two shapes: a scale take carries the written note on the
    // result itself, a sight-reading take carries the whole event. Both are read.
    const note = (r.event && r.event.note) || r.note || null;
    const midi = note && note.midi != null ? note.midi : r.event && r.event.midi;
    if (midi == null) continue;
    const pc = ((midi % 12) + 12) % 12;
    const cell = byClass.get(midi) || {
      pc,
      midi,
      sum: 0,
      n: 0,
      // The name as the page spells it — E♭ stays E♭ even though its pitch class
      // is also D♯, because the student is reading the page, not a keyboard.
      name: (note && note.name) || null,
    };
    cell.sum += r.cents;
    cell.n += 1;
    byClass.set(midi, cell);
  }
  const bias = [...byClass.values()]
    .filter((c) => c.n >= 2)
    .map((c) => ({ pc: c.pc, midi: c.midi, cents: c.sum / c.n, n: c.n, name: c.name }))
    .sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));

  // The whole take leaning one way: worth saying once, gently.
  const mean = tuned.length ? tuned.reduce((a, r) => a + r.cents, 0) / tuned.length : 0;

  // Speeding up or slowing down: the middle against the end, so a wobble at the
  // start or one late note cannot tilt it.
  let drift = null;
  if (ratios.length >= 6) {
    const middle = median(ratios.slice(0, Math.ceil(ratios.length / 2)));
    const end = median(ratios.slice(Math.floor(ratios.length / 2)));
    if (middle > 0) {
      const factor = end / middle;
      if (Math.abs(factor - 1) >= 0.12) drift = { factor, faster: factor < 1 };
    }
  }

  return {
    mean,
    // Only one note is ever named: a list of five would be a diagnosis,
    // and this is a suggestion.
    bias: bias.length && Math.abs(bias[0].cents) >= 15 ? bias[0] : null,
    drift,
    tuned: tuned.length,
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = clamp(p, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/**
 * Group pitch frames into discrete notes.
 * @param {{t:number, freq:number, clarity:number, rms:number}[]} frames
 */
export function segmentNotes(frames, options = {}) {
  const o = { ...DEFAULTS, ...options };
  if (!frames.length) return { notes: [], gate: o.minRms };

  // The gate follows the room, and it is bounded from *both* sides. Never below
  // `minRms`, so silence is not a note; and never above a third of the loudest
  // frame, so a quiet instrument cannot have the gate placed over its own notes.
  // That second bound is what a phone needs: with gain control on, a whole take
  // can sit around 0.0045, and the old formula — 1.5 × the tenth percentile — put
  // the gate at 0.0068 and heard nothing at all.
  const rmsSorted = frames.map((f) => f.rms).sort((a, b) => a - b);
  const noiseFloor = percentile(rmsSorted, 0.1);
  const peak = percentile(rmsSorted, 0.98);
  const gate = Math.max(o.minRms, Math.min(0.015, noiseFloor * 1.5, peak * 0.35));

  // Frame-wise pitch in semitones (float), or null when unvoiced.
  const raw = frames.map((f) => {
    if (!f.freq || f.clarity < o.minClarity || f.rms < gate) return null;
    return 69 + 12 * Math.log2(f.freq / 440);
  });

  // Three-frame median smoothing removes isolated octave jumps and jitter.
  const smooth = raw.map((v, i) => {
    if (v == null) return null;
    const window = [];
    for (let k = Math.max(0, i - 1); k <= Math.min(raw.length - 1, i + 1); k++) {
      if (raw[k] != null) window.push(raw[k]);
    }
    return median(window);
  });

  // Runs of voiced frames (a one-frame dropout does not end a note).
  const runs = [];
  let run = null;
  for (let i = 0; i < smooth.length; i++) {
    const v = smooth[i];
    if (v == null) {
      if (run) {
        run.gap = (run.gap || 0) + 1;
        if (run.gap > 1) {
          runs.push(run);
          run = null;
        }
      }
      continue;
    }
    if (!run) run = { idx: [i], values: [v], gap: 0 };
    else {
      run.gap = 0;
      run.idx.push(i);
      run.values.push(v);
    }
  }
  if (run) runs.push(run);

  // Within a run, split wherever the pitch settles somewhere else — this
  // catches legato / sloppy shifts that never fully lose energy.
  const notes = [];
  for (const r of runs) {
    // Compare the median just before a frame with the median just after it.
    // A single-frame reading in between a semitone step would otherwise hide
    // the step (B5 -> C6, E5 -> F5) and glue two notes together.
    const cuts = [0];
    let lastCut = 0;
    for (let k = 1; k < r.values.length - 1; k++) {
      const before = median(r.values.slice(Math.max(0, k - 3), k));
      const after = median(r.values.slice(k, Math.min(r.values.length, k + 3)));
      if (Math.abs(after - before) > o.jumpSemitones && k - lastCut >= 3) {
        cuts.push(k);
        lastCut = k;
      }
    }
    cuts.push(r.values.length);

    for (let c = 0; c < cuts.length - 1; c++) {
      const a = cuts[c];
      const b = cuts[c + 1];
      if (b - a < o.minNoteFrames) continue;
      const idx = r.idx.slice(a, b);
      const t0 = frames[idx[0]].t;
      const t1 = frames[idx[idx.length - 1]].t;
      if (t1 - t0 < o.minNoteSeconds) continue;

      // Ignore the attack and release when measuring the pitch.
      const vals = r.values.slice(a, b);
      const trimA = Math.floor(vals.length * 0.2);
      const trimB = Math.max(trimA + 1, vals.length - Math.max(1, Math.round(vals.length * 0.15)));
      const core = vals.slice(trimA, trimB);
      const pitch = median(core);
      const midi = Math.round(pitch);

      notes.push({
        t0,
        t1,
        pitch,
        midi,
        cents: (pitch - midi) * 100,
        frames: idx.length,
        duration: t1 - t0,
      });
    }
  }

  notes.sort((a, b) => a.t0 - b.t0);
  return { notes, gate };
}

/**
 * The top note played more than once in a row becomes one long note.
 *
 * Only the top note, only back to back, and only across a gap a re-bow or a
 * breath could explain (under 1.5 s). A repeat anywhere else in the scale is
 * still an extra note, and a long silence at the top is still a stop.
 */
export function foldTopRepeat(notes, topMidi) {
  if (topMidi == null) return notes;
  const out = [];
  for (const note of notes) {
    const prev = out[out.length - 1];
    if (prev && prev.midi === topMidi && note.midi === topMidi && note.t0 - prev.t1 < 1.5) {
      const frames = prev.frames + note.frames;
      const pitch = (prev.pitch * prev.frames + note.pitch * note.frames) / frames;
      out[out.length - 1] = {
        ...prev,
        t1: note.t1,
        pitch,
        cents: (pitch - prev.midi) * 100,
        frames,
        duration: note.t1 - prev.t0,
        repeats: (prev.repeats || 0) + 1,
      };
      continue;
    }
    out.push(note);
  }
  return out;
}

function substitutionCost(detected, expected) {
  const diff = Math.abs(detected - expected);
  if (diff === 0) return 0;
  if (diff % 12 === 0) return 0.8; // right note, wrong octave
  return 1.5 + Math.min(diff, 12) * 0.05;
}

/**
 * Needleman–Wunsch style alignment between what was heard and what was asked
 * for. This is what makes the scoring forgiving: an extra note or a skip only
 * costs its own slot instead of throwing off every note that follows.
 */
export function align(detected, expected) {
  const n = detected.length;
  const m = expected.length;
  const extraCost = 0.65;
  const missCost = 1.0;

  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) dp[i][0] = dp[i - 1][0] + extraCost;
  for (let j = 1; j <= m; j++) dp[0][j] = dp[0][j - 1] + missCost;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1][j - 1] + substitutionCost(detected[i - 1], expected[j - 1]);
      const del = dp[i - 1][j] + extraCost;
      const ins = dp[i][j - 1] + missCost;
      dp[i][j] = Math.min(sub, del, ins);
    }
  }

  const pairs = [];
  const extras = [];
  const missed = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const sub = dp[i - 1][j - 1] + substitutionCost(detected[i - 1], expected[j - 1]);
      if (Math.abs(dp[i][j] - sub) < 1e-9) {
        pairs.push({ d: i - 1, e: j - 1 });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + extraCost)) < 1e-9) {
      extras.push(i - 1);
      i--;
      continue;
    }
    if (j > 0) {
      missed.push(j - 1);
      j--;
    }
  }

  pairs.sort((a, b) => a.e - b.e);
  extras.sort((a, b) => a - b);
  missed.sort((a, b) => a - b);
  return { pairs, extras, missed };
}

/**
 * @param frames pitch frames (seconds since the take started)
 * @param expectedScale result of buildScale()
 */
export function analyzeTake(frames, expectedScale, options = {}) {
  const o = { ...DEFAULTS, ...options, weights: { ...DEFAULTS.weights, ...(options.weights || {}) } };
  const expected = expectedScale.sequence;
  const expectedMidi = expected.map((n) => n.midi);

  const segmented = segmentNotes(frames, o);
  const gate = segmented.gate;
  // The top of the scale is where players stop to turn round: they hold it, and
  // often play it twice — once at the top of the way up, once at the start of the
  // way down — with a bow change or a lift between. Neither is a mistake, so a
  // repeated top note is folded into one long one before anything is scored.
  const topIndex = Math.min(expected.length - 1, (expectedScale.octaves || 2) * 7);
  const topMidi = expectedMidi[topIndex];
  const notes = foldTopRepeat(segmented.notes, topMidi);
  const { pairs, extras } = align(notes.map((n) => n.midi), expectedMidi);
  const octaveShift = detectOctaveShift(notes, expectedMidi);

  const noteResults = expected.map((note, index) => ({
    note,
    index,
    status: 'missed',
    cents: 0,
    detectedName: null,
  }));

  let exact = 0;
  let octaveErrors = 0;
  let wrong = 0;

  for (const { d, e } of pairs) {
    const det = notes[d];
    const target = expectedMidi[e];
    const diff = det.midi - target;
    const r = noteResults[e];
    r.detectedName = det.midi;
    if (diff === 0) {
      r.status = 'exact';
      r.cents = det.cents;
      exact++;
    } else if (Math.abs(diff) % 12 === 0) {
      r.status = 'octave';
      r.cents = (det.pitch - target) * 100;
      octaveErrors++;
    } else {
      r.status = 'wrong';
      r.cents = (det.pitch - target) * 100;
      wrong++;
    }
  }

  // --- Accuracy -----------------------------------------------------------
  let credit = 0;
  for (const r of noteResults) {
    if (r.status === 'exact') credit += 1;
    else if (r.status === 'octave') credit += 0.4;
    else if (r.status === 'wrong') credit += 0.1;
  }
  const accuracy = clamp(credit / expected.length - Math.min(0.08, extras.length * 0.015));

  // --- Intonation ---------------------------------------------------------
  const tuned = noteResults.filter((r) => r.status === 'exact');
  const P = o.intonationPerfect;
  const Z = o.intonationZero;
  let intonation = 0.6;
  if (tuned.length) {
    const sum = tuned.reduce((acc, r) => {
      const abs = Math.abs(r.cents);
      return acc + clamp(1 - (abs - P) / (Z - P));
    }, 0);
    intonation = clamp(sum / tuned.length);
  }


  // --- Steadiness ---------------------------------------------------------
  const iois = [];
  for (let k = 1; k < pairs.length; k++) {
    // How long the top note was held is the player's choice, like a fermata, and
    // says nothing about the pulse — so the gap that leaves it is not measured.
    if (pairs[k - 1].e === topIndex) continue;
    if (pairs[k].e === pairs[k - 1].e + 1) {
      iois.push(notes[pairs[k].d].t0 - notes[pairs[k - 1].d].t0);
    }
  }
  const medianIoi = iois.length ? median(iois) : 0;
  let steadiness = 1;
  if (iois.length >= 4) {
    const devs = iois.map((v) => Math.abs(v - medianIoi) / medianIoi).sort((a, b) => a - b);
    // Ignore the longest 10%: those are the pauses, scored separately below.
    const kept = devs.slice(0, Math.max(1, Math.ceil(devs.length * 0.9)));
    const meanDev = kept.reduce((a, b) => a + b, 0) / kept.length;
    steadiness = clamp(1 - (meanDev - 0.07) / 0.4);
  }

  // --- Continuity ---------------------------------------------------------
  const stopThreshold = Math.max(0.3, medianIoi * 0.8);
  let stops = 0;
  let longStops = 0;
  for (let k = 1; k < notes.length; k++) {
    const gap = notes[k].t0 - notes[k - 1].t1;
    if (gap > stopThreshold) {
      stops++;
      if (gap > 1.0) longStops++;
    }
  }
  const continuity = clamp(1 - 0.16 * stops - 0.1 * longStops);

  const w = o.weights;
  const raw = w.accuracy * accuracy + w.intonation * intonation + w.steadiness * steadiness + w.continuity * continuity;
  const score = Math.round(clamp(raw) * 100);

  const result = {
    score,
    components: { accuracy, intonation, steadiness, continuity },
    notes: noteResults,
    scale: expectedScale,
    stats: {
      expected: expected.length,
      heard: notes.length,
      exact,
      wrong,
      missed: noteResults.filter((r) => r.status === 'missed').length,
      extra: extras.length,
      octaveErrors,
      octaveShift,
      stops,
      longStops,
      bpm: medianIoi ? Math.round(60 / medianIoi) : 0,
      duration: notes.length ? notes[notes.length - 1].t1 - notes[0].t0 : 0,
      gate,
    },
    detected: notes,
  };
  // What this take says about the player, as opposed to how it scored.
  result.habits = listenNotes(noteResults, iois);
  result.tips = buildTips(result);
  return result;
}

/** Did the student play the right notes, but in another octave? */
function detectOctaveShift(notes, expected) {
  const n = Math.min(10, notes.length, expected.length);
  if (n < 6) return 0;
  for (const shift of [12, -12, 24, -24]) {
    let hits = 0;
    for (let i = 0; i < n; i++) {
      if (notes[i].midi - expected[i] === shift) hits++;
    }
    if (hits >= n * 0.7) return shift;
  }
  return 0;
}

export function centsText(cents) {
  const v = Math.round(Math.abs(cents));
  const zh = getLang() === 'zh';
  if (v === 0) return zh ? '正好' : 'dead on';
  if (zh) return `${cents > 0 ? '高' : '低'} ${v} 音分`;
  return `${v}¢ ${cents > 0 ? 'high' : 'low'}`;
}

function aside(text) {
  return getLang() === 'zh' ? `（${text}）` : ` (${text})`;
}

function noteList(items) {
  const zh = getLang() === 'zh';
  if (items.length === 1) return items[0];
  if (items.length === 2) return zh ? `${items[0]} 和 ${items[1]}` : `${items[0]} and ${items[1]}`;
  return zh
    ? `${items.slice(0, -1).join('、')} 和 ${items[items.length - 1]}`
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Gentle, specific feedback. Ordered by how much each item cost. */
export function buildTips(result) {
  const { stats, components, notes } = result;
  const tips = [];
  const push = (tip, impact) => tips.push({ ...tip, impact });

  const tuned = notes.filter((n) => n.status === 'exact');
  const offPitch = tuned
    .filter((n) => Math.abs(n.cents) > 28)
    .sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));

  if (offPitch.length >= 1) {
    const shown = offPitch.slice(0, 3);
    push(
      {
        kind: 'intonation',
        title: t('tip.intonation.title'),
        text: t('tip.intonation.text', {
          list: noteList(shown.map((n) => `${n.note.name}${aside(centsText(n.cents))}`)),
        }),
      },
      (1 - components.intonation) * 0.2,
    );
  }

  // A whole-scale tendency is worth naming: it is usually a tuning or hand
  // position issue rather than 29 separate mistakes.
  if (tuned.length >= 6) {
    const avg = tuned.reduce((a, n) => a + n.cents, 0) / tuned.length;
    if (Math.abs(avg) > 14) {
      push(
        {
          kind: 'intonation',
          title: t(avg > 0 ? 'tip.high.title' : 'tip.low.title'),
          text: t(avg > 0 ? 'tip.high.text' : 'tip.low.text', {
            cents: Math.abs(avg).toFixed(0),
          }),
        },
        Math.min(0.12, Math.abs(avg) / 200),
      );
    }
  }

  // A single pitch that sits off across the whole take: the same finger, or the
  // same string. Named only when at least two of its notes agree, so it cannot
  // be one unlucky entry being blamed on a habit.
  const habit = result.habits;
  if (habit && habit.bias) {
    push(
      {
        kind: 'intonation',
        title: t('tip.bias.title', { note: habit.bias.name || '' }),
        text: t(habit.bias.cents > 0 ? 'tip.bias.high' : 'tip.bias.low', {
          note: habit.bias.name || '',
          cents: Math.abs(habit.bias.cents).toFixed(0),
          n: habit.bias.n,
        }),
      },
      0.16,
    );
  }

  if (habit && habit.drift) {
    push(
      {
        kind: 'rhythm',
        title: t(habit.drift.faster ? 'tip.drift.faster.title' : 'tip.drift.slower.title'),
        text: t(habit.drift.faster ? 'tip.drift.faster.text' : 'tip.drift.slower.text', {
          pct: Math.abs((habit.drift.factor - 1) * 100).toFixed(0),
        }),
      },
      0.12,
    );
  }

  if (components.steadiness < 0.92) {
    push(
      {
        kind: 'rhythm',
        title: t('tip.rhythm.title'),
        text: t('tip.rhythm.text', {
          tempo: stats.bpm ? t('tip.rhythm.tempo', { bpm: stats.bpm }) : '',
        }),
      },
      (1 - components.steadiness) * 0.12,
    );
  }

  if (stats.bpm && stats.bpm < 50 && components.steadiness > 0.8) {
    push(
      {
        kind: 'tempo',
        title: t('tip.tempo.title'),
        text: t('tip.tempo.text', { bpm: stats.bpm }),
      },
      0.04,
    );
  }

  if (stats.stops >= 1) {
    push(
      {
        kind: 'flow',
        title:
          stats.stops === 1 ? t('tip.flow.titleOne') : t('tip.flow.title', { n: stats.stops }),
        text: t('tip.flow.text', { long: stats.longStops ? t('tip.flow.long') : '' }),
      },
      (1 - components.continuity) * 0.12,
    );
  }

  if (stats.missed > 0) {
    push(
      {
        kind: 'notes',
        title:
          stats.missed === 1
            ? t('tip.notes.titleOne')
            : t('tip.notes.title', { n: stats.missed }),
        text: t('tip.notes.text'),
      },
      (1 - components.accuracy) * 0.5,
    );
  }

  // A different note where the page asks for another — nearly always the key
  // signature (F natural in G major) or a finger a half step out. It used to earn
  // no tip at all, so a scale with four wrong notes and nothing else amiss was
  // told there was "nothing to fix". Not said when the whole take is in the wrong
  // octave: that has its own tip, and these would be the same news twice.
  const wrongNotes = notes.filter((n) => n.status === 'wrong');
  if (wrongNotes.length && !stats.octaveShift) {
    const names = [...new Set(wrongNotes.map((n) => n.note.name))];
    push(
      {
        kind: 'notes',
        title:
          wrongNotes.length === 1
            ? t('tip.wrong.titleOne')
            : t('tip.wrong.title', { n: wrongNotes.length }),
        text: t('tip.wrong.text', {
          list:
            names.length > 4
              ? names.slice(0, 4).join(getLang() === 'zh' ? '、' : ', ')
              : noteList(names),
          more: names.length > 4 ? t('tip.wrong.more') : '',
        }),
      },
      // Ahead of intonation and rhythm: the right pitch comes before a centred one.
      0.3 + Math.min(0.2, wrongNotes.length * 0.02),
    );
  }

  if (stats.octaveShift) {
    push(
      {
        kind: 'range',
        title: t(stats.octaveShift > 0 ? 'tip.range.titleHigh' : 'tip.range.titleLow'),
        text: t('tip.range.text', { range: result.scale.rangeText }),
      },
      0.5,
    );
  }

  tips.sort((a, b) => b.impact - a.impact);
  return tips.slice(0, 3).map(({ impact, ...rest }) => rest);
}

export function gradeFor(score) {
  const band = score >= 96 ? 96 : score >= 90 ? 90 : score >= 82 ? 82 : score >= 72 ? 72 : score >= 60 ? 60 : 0;
  return { label: t(`grade.${band}.label`), note: t(`grade.${band}.note`) };
}


/**
 * Score a sight-reading take against the passage that was on the page.
 *
 * Two things differ from a scale. The notes have different lengths, so
 * "steadiness" cannot be a constant inter-onset interval: what matters is the
 * ratio between what was played and the rhythm as written, at whatever tempo the
 * student chose. And the tempo itself is not scored — no adjudicator stops a
 * sight-reader for taking it slowly — but a pulse that wanders, and stops, are.
 */
export function analyzeSightTake(frames, passage, options = {}) {
  const o = { ...DEFAULTS, ...options, weights: { ...DEFAULTS.weights, ...(options.weights || {}) } };
  // `start` inside a bar is bar-relative, so the flat list needs absolute
  // positions — bar 2's first note starts a bar after bar 1's, not at zero.
  const events = [];
  passage.bars.forEach((barEvents, barIndex) => {
    for (const event of barEvents) {
      if (event.rest || !event.note) continue;
      events.push({ ...event, abs: barIndex * passage.perBar + event.start });
    }
  });
  const expectedMidi = events.map((e) => e.note.midi);

  const { notes } = segmentNotes(frames, o);
  const { pairs, extras } = align(notes.map((n) => n.midi), expectedMidi);

  const results = events.map((event, index) => ({
    event,
    index,
    status: 'missed',
    cents: 0,
    detected: null,
  }));

  let exact = 0;
  let octaveErrors = 0;
  let wrong = 0;

  for (const { d, e } of pairs) {
    const det = notes[d];
    const diff = det.midi - expectedMidi[e];
    const r = results[e];
    r.detected = det.midi;
    r.at = det.t0; // when it was played, seconds into the take
    if (diff === 0) {
      r.status = 'exact';
      r.cents = det.cents;
      exact++;
    } else if (Math.abs(diff) % 12 === 0) {
      r.status = 'octave';
      r.cents = (det.pitch - expectedMidi[e]) * 100;
      octaveErrors++;
    } else {
      r.status = 'wrong';
      r.cents = (det.pitch - expectedMidi[e]) * 100;
      wrong++;
    }
  }

  // --- Notes --------------------------------------------------------------
  let credit = 0;
  for (const r of results) {
    credit += r.status === 'exact' ? 1 : r.status === 'octave' ? 0.4 : r.status === 'wrong' ? 0.1 : 0;
  }
  const accuracy = clamp(credit / Math.max(1, events.length) - Math.min(0.08, extras.length * 0.015));

  // --- Intonation ---------------------------------------------------------
  const tuned = results.filter((r) => r.status === 'exact');
  const P = o.intonationPerfect;
  const Z = o.intonationZero;
  let intonation = 0.6;
  if (tuned.length) {
    const sum = tuned.reduce((acc, r) => acc + clamp(1 - (Math.abs(r.cents) - P) / (Z - P)), 0);
    intonation = clamp(sum / tuned.length);
  }

  // --- Pulse --------------------------------------------------------------
  // Seconds per written unit, one ratio per matched pair of notes. If the
  // student is steady, every ratio is the same number however slow they were.
  const ratios = [];
  for (let k = 1; k < pairs.length; k++) {
    if (pairs[k].e !== pairs[k - 1].e + 1) continue;
    const units = events[pairs[k].e].abs - events[pairs[k - 1].e].abs;
    if (units <= 0) continue;
    ratios.push((notes[pairs[k].d].t0 - notes[pairs[k - 1].d].t0) / units);
  }
  const unit = ratios.length ? median(ratios) : 0;
  // What this take says about the player, beyond what it scores.
  const habits = listenNotes(results, ratios);
  let rhythm = 0.6;
  let stops = 0;
  if (ratios.length >= 4 && unit > 0) {
    let sum = 0;
    for (const r of ratios) {
      const err = Math.abs(r - unit) / unit;
      // A quarter of the pulse is within the noise: at 30 ms per frame, a note
      // shorter than a third of a second already jitters by 10%. Full credit to
      // 25%, nothing by 75%.
      sum += clamp(1 - (err - 0.25) / 0.5);
      if (err > 1.6) stops++; // near three times the pulse is a stop, not a wobble
    }
    rhythm = sum / ratios.length;
  } else if (ratios.length) {
    rhythm = 0.75; // too little to judge
  }

  const continuity = clamp(1 - stops * 0.16);
  const w = o.weights;
  const score = Math.round(
    100 *
      clamp(
        accuracy * w.accuracy +
          intonation * w.intonation +
          rhythm * w.steadiness +
          continuity * w.continuity,
      ),
  );

  // --- What else the take can say ----------------------------------------
  //
  // Three readings that are reliable enough to speak about, each with a rule for
  // staying quiet: the speed against the page's own marking, where the music came
  // apart, and whether one kind of note was consistently early or late.
  const perBar = passage.perBar || 16;

  // Where it broke: notes missed or wrong, counted by bar. A bar with two or more
  // is a bar to look at; one is just a slip.
  const barCount = new Map();
  results.forEach((r, i) => {
    if (r.status !== 'missed' && r.status !== 'wrong') return;
    const bar = Math.floor((events[i].abs || 0) / perBar) + 1;
    barCount.set(bar, (barCount.get(bar) || 0) + 1);
  });
  const worstBars = [...barCount.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([bar, n]) => ({ bar, n }))
    .slice(0, 2);

  // The speed against the printed marking. Only worth saying when the student is
  // close to playing the passage — a take that stalled is not a tempo question.
  let tempo = null;
  if (unit > 0 && passage.tempo && passage.tempo.bpm) {
    const printed = passage.tempo.bpm;
    const played = 60 / (unit * 4); // seconds per sixteenth → quarters per minute
    if (Number.isFinite(played) && played > 0) {
      const ratio = played / printed;
      // A take that stalled is not a tempo question, so the speed is only
      // reported when most of the notes actually sounded.
      const missedCount = results.filter((r) => r.status === 'missed').length;
      if (Math.abs(ratio - 1) >= 0.08 && missedCount <= events.length * 0.15) {
        tempo = { played: Math.round(played), printed, ratio, faster: ratio > 1 };
      }
    }
  }

  // One kind of note consistently early or late: sixteenths that all arrive a
  // little before their beat are a habit, not a mistake.
  const byDur = new Map();
  for (let k = 1; k < pairs.length; k++) {
    const prev = pairs[k - 1];
    const here = pairs[k];
    if (here.e !== prev.e + 1) continue;
    const units = events[here.e].abs - events[prev.e].abs;
    if (!(units > 0)) continue;
    const actual = notes[here.d].t0 - notes[prev.d].t0;
    const expectedTime = unit * units;
    if (!(expectedTime > 0)) continue;
    const cell = byDur.get(events[here.e].dur) || { dur: events[here.e].dur, sum: 0, n: 0 };
    cell.sum += actual / expectedTime - 1;
    cell.n += 1;
    byDur.set(events[here.e].dur, cell);
  }
  const entries = [...byDur.values()]
    .filter((c) => c.n >= 3 && Math.abs(c.sum / c.n) >= 0.12)
    .map((c) => ({ dur: c.dur, bias: c.sum / c.n, n: c.n }))
    .sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias))
    .slice(0, 1);

  // How long the long notes were actually held.
  //
  // This is the least certain of the readings, and the only one the app phrases
  // as a question: a note's *end* is decided by when the sound stops, and a room
  // with any ring in it, or a bow lifting a little early, can shorten that in the
  // evidence without the player having meant it. So: only notes a quarter or
  // longer, only when at least three of them agree, only when they are well under
  // the written value — and the screen says "I might have heard", not "you
  // played".
  const heldBy = new Map();
  for (const { d, e } of pairs) {
    const event = events[e];
    if (!event || event.dur < 4) continue;
    const wanted = event.dur * unit;
    if (!(wanted > 0.15)) continue;
    const got = notes[d].t1 - notes[d].t0;
    const cell = heldBy.get(event.dur) || { dur: event.dur, sum: 0, n: 0 };
    cell.sum += got / wanted;
    cell.n += 1;
    heldBy.set(event.dur, cell);
  }
  const shortHeld =
    [...heldBy.values()]
      .filter((c) => c.n >= 3 && c.sum / c.n < 0.72)
      .map((c) => ({ dur: c.dur, ratio: c.sum / c.n, n: c.n }))
      .sort((a, b) => a.ratio - b.ratio)[0] || null;

  return {
    score,
    accuracy,
    intonation,
    rhythm,
    continuity,
    unit,
    results,
    extras,
    missed: results.filter((r) => r.status === 'missed'),
    stops,
    heard: notes.length,
    expected: events.length,
    exact,
    octaveErrors,
    wrong,
    habits,
    worstBars,
    tempo,
    entries,
    shortHeld,
    duration: frames.length ? frames[frames.length - 1].t : 0,
  };
}
