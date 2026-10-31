// tuner.js — open-string targets and the double-stop "wobble" check.
//
// The pitch side reuses the same YIN detector as the scale scorer; this module
// only holds what is specific to tuning: the four strings, the small offsets
// the teacher wants, and a way to hear whether a fifth is pure.

export const STRINGS = [
  { id: 'G', note: 'G3', freq: 196.0, offset: -2.5, label: 'G' },
  { id: 'D', note: 'D4', freq: 293.66, offset: 2.5, label: 'D' },
  { id: 'A', note: 'A4', freq: 440.0, offset: 2.5, label: 'A' },
  { id: 'E', note: 'E5', freq: 659.26, offset: 2.5, label: 'E' },
];

export const FIFTHS = [
  { id: 'G+D', lower: 'G', upper: 'D' },
  { id: 'D+A', lower: 'D', upper: 'A' },
  { id: 'A+E', lower: 'A', upper: 'E' },
];

export function stringById(id) {
  return STRINGS.find((s) => s.id === id) || STRINGS[2];
}

/** Cents between a heard frequency and a target frequency. */
export function centsFrom(freq, target) {
  return 1200 * Math.log2(freq / target);
}

/**
 * Which open string is being played? Only close matches count, so a stopped
 * note in the middle of a scale does not masquerade as a string.
 */
export function nearestString(freq) {
  let best = null;
  for (const s of STRINGS) {
    const d = Math.abs(centsFrom(freq, s.freq));
    if (!best || d < best.d) best = { string: s, d };
  }
  return best && best.d <= 160 ? best.string : null;
}

/** Is this reading close enough to the string's target offset to count? */
export function isInTune(cents, string) {
  return Math.abs(cents - string.offset) <= 3;
}

/**
 * A double-stop verdict: wobbling (a beat was found), steady, or too quiet.
 *
 * @returns {{status: 'wobble'|'steady'|'quiet', rateHz?: number, depth?: number}}
 */
export function analyseDoubleStop(rms, options = {}) {
  if (!rms || !rms.length) return { status: 'quiet' };
  const mean = rms.reduce((a, b) => a + b, 0) / rms.length;
  if (mean < 0.004) return { status: 'quiet' };
  const beats = analyseBeats(rms, options);
  if (beats) return { status: 'wobble', rateHz: beats.rateHz, depth: beats.depth };
  return { status: 'steady' };
}

/**
 * Detect a slow amplitude wobble in a held double stop.
 *
 * When two strings are not quite a pure fifth apart, their matching overtones
 * beat, and the whole sound pulses a few times a second. That pulse shows up in
 * the loudness envelope even though no FFT could resolve the two partials.
 *
 * @param {number[]} rms loudness samples
 * @param {{fps?: number, minRate?: number, maxRate?: number}} options
 * @returns {{rateHz: number, correlation: number, depth: number} | null}
 */
export function analyseBeats(rms, { fps = 30, minRate = 0.7, maxRate = 6 } = {}) {
  if (!rms || rms.length < fps * 1.5) return null;

  const mean = rms.reduce((a, b) => a + b, 0) / rms.length;
  if (mean < 0.004) return null; // nothing was played

  // Remove slow drift (bow pressure, level) so only the wobble remains.
  const window = Math.max(3, Math.round(fps * 0.7));
  const residual = new Array(rms.length);
  const queue = [];
  let sum = 0;
  for (let i = 0; i < rms.length; i++) {
    queue.push(rms[i]);
    sum += rms[i];
    if (queue.length > window) sum -= queue.shift();
    residual[i] = rms[i] - sum / queue.length;
  }

  const variance = residual.reduce((a, v) => a + v * v, 0) / residual.length;
  const depth = Math.sqrt(variance) / mean;

  const minLag = Math.max(2, Math.round(fps / maxRate));
  const maxLag = Math.min(Math.round(fps / minRate), Math.floor(residual.length / 2));

  let best = { r: 0, lag: 0 };
  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0;
    let a = 0;
    let b = 0;
    for (let i = 0; i + lag < residual.length; i++) {
      num += residual[i] * residual[i + lag];
      a += residual[i] * residual[i];
      b += residual[i + lag] * residual[i + lag];
    }
    const denom = Math.sqrt(a * b) || 1;
    const r = num / denom;
    if (r > best.r) best = { r, lag };
  }

  if (!best.lag || best.r < 0.35 || depth < 0.015) return null;
  return { rateHz: fps / best.lag, correlation: best.r, depth };
}
