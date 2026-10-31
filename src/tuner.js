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

// A is the base. Everything is tuned outward from it: E to A, D to A, then G to D.
export const FIFTHS = [
  { id: 'A+E', label: 'A + E', base: 'A', tune: 'E' },
  { id: 'D+A', label: 'D + A', base: 'A', tune: 'D' },
  { id: 'G+D', label: 'G + D', base: 'D', tune: 'G' },
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
