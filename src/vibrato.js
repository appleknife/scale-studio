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

const median = (xs) => {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
const clamp = (v) => Math.max(0, Math.min(100, v));
const centsFrom = (freq, midi) => (69 + 12 * Math.log2(freq / 440) - midi) * 100;

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
