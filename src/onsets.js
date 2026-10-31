// onsets.js — where one bow stroke ends and the next begins.
//
// The pitch detector in pitch.js can only start a new note when the pitch moves
// or when the sound stops for long enough. A repeated note — the most ordinary
// thing on a sight-reading page — does neither, so it merges into one long note.
//
// A bow change does leave two marks, though: the tone dips as the bow reverses,
// and the string catches the hair again with a short broadband transient. This
// module looks for the second one, which is far more reliable than the dip: it
// isolates the band above ~4 kHz — where bow noise lives and a violin's harmonics
// are weak — and finds the moments where that band jumps above its own recent level.
//
// Nothing here is wired into the app yet. `tests/onset-probe.html` is where it is
// measured; the sight-reading scorer is where it will be used.

/** Median of a numeric array (does not mutate the input). */
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Two numbers per slice of audio:
 *   rms — how loud it is (what the eye reads as the note)
 *   hi  — how much energy sits above `hpHz`, i.e. the bow catching the string
 *
 * The high band comes from a one-pole high-pass at 4 kHz. A first difference
 * was tried first and did not separate the bow catch from the tone: it lifts the
 * harmonics as much as the transient.
 *
 * `state` carries the filter between calls, so a live app can feed this block by
 * block without a click at every boundary; leave it out for offline analysis.
 */
export function envelopeTrack(
  samples,
  sampleRate,
  { hop = 0.005, win = 0.01, hpHz = 6000, poles = 3, state = null } = {},
) {
  const hopN = Math.max(1, Math.round(hop * sampleRate));
  const winN = Math.max(2, Math.round(win * sampleRate));

  // High-pass, run once over the whole signal so the state is continuous. One
  // pole is not enough: a 3 kHz harmonic of an A4 still comes through it, and the
  // bow catch disappears underneath the tone.
  const w = (2 * Math.PI * hpHz) / sampleRate;
  const a = 1 / (1 + w);
  const hp = new Float32Array(samples.length);
  for (let p = 0; p < poles; p++) {
    let y = state ? state.y[p] : 0;
    let prevX = state ? state.prevX[p] : 0;
    for (let i = 0; i < samples.length; i++) {
      const x = p === 0 ? samples[i] : hp[i];
      y = a * (y + x - prevX);
      prevX = x;
      hp[i] = y;
    }
    if (state) {
      state.y[p] = y;
      state.prevX[p] = prevX;
    }
  }

  const track = [];
  for (let start = 0; start + winN <= samples.length; start += hopN) {
    let sum = 0;
    let hiSum = 0;
    for (let k = 0; k < winN; k++) {
      const s = samples[start + k];
      sum += s * s;
      const h = hp[start + k];
      hiSum += h * h;
    }
    track.push({
      t: (start + winN / 2) / sampleRate,
      rms: Math.sqrt(sum / winN),
      hi: Math.sqrt(hiSum / winN),
    });
  }
  return track;
}

/** Running median over `2 * half + 1` frames — the "recent level" a peak is measured against. */
function runningMedian(values, half) {
  const out = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(values.length, i + half + 1);
    out[i] = median(values.slice(a, b));
  }
  return out;
}

/**
 * Moments where the bow catches the string.
 *
 * `sensitivity` is the multiple of the recent level a peak must reach: lower
 * finds more (including noise), higher misses soft bow changes. 1.6 is the value
 * that survived the synthetic tests; it should be re-tuned against real playing.
 *
 * `minGap` is the musical floor: two onsets closer than this are one event as
 * far as sheet music is concerned (at ♩=120 a sixteenth is 125 ms).
 */
// Tuned against `tests/onset-probe.html` (synthetic bow changes). These values
// find 8/8 repeated notes to within 5 ms at full resolution and ~14 ms at the
// frame rate the running app can manage. They should be re-tuned against real
// recordings before anything is graded on them.
export function bowBoundaries(
  track,
  { sensitivity = 1.2, minGap = 0.08, metric = 'flux' } = {},
) {
  if (track.length < 12) return [];

  const hi = track.map((f) => f.hi);
  const rms = track.map((f) => f.rms);

  // The sustained tone is loud; the room between phrases is not. Only look for
  // bow changes where something is actually sounding.
  const floor = Math.max(1e-5, median(rms) * 0.12);

  const recent = runningMedian(hi, 40); // ~0.4 s at a 5 ms hop
  // "level" asks how loud the bow-noise band is; "flux" asks how fast it rises,
  // which is what a transient actually is and what survives a noisy tone.
  const score =
    metric === 'flux'
      ? hi.map((v, i) => (i === 0 ? 0 : Math.max(0, v - hi[i - 1]) / (recent[i] + 1e-9)))
      : hi.map((v, i) => v / (recent[i] + 1e-9));

  // Every frame that clearly stands out, then the strongest of each cluster. A
  // strict "local maximum" test would drop a plateau of equal frames, which is
  // exactly what a 12 ms transient looks like at a 5 ms hop.
  const candidates = [];
  for (let i = 0; i < track.length; i++) {
    if (rms[i] < floor) continue;
    if (score[i] < sensitivity) continue;
    candidates.push({ i, t: track[i].t, strength: score[i] });
  }

  // Keep the strongest of any group that is closer together than minGap.
  candidates.sort((a, b) => b.strength - a.strength);
  const kept = [];
  for (const c of candidates) {
    if (kept.some((k) => Math.abs(k.t - c.t) < minGap)) continue;
    kept.push(c);
  }
  kept.sort((a, b) => a.t - b.t);
  return kept;
}

/**
 * The onsets of a take, as times, from a raw sample buffer. Convenience for
 * tests and for offline analysis; the live app builds the track frame by frame
 * from the analyser instead.
 */
export function onsetsFromBuffer(samples, sampleRate, options = {}) {
  const { hop = 0.005, win = 0.02, ...rest } = options;
  return bowBoundaries(envelopeTrack(samples, sampleRate, { hop, win }), rest).map((o) => o.t);
}
