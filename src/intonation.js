// intonation.js — how far each note sat from its centre, and which way.
//
// The result screens already colour each note on the staff, and colour alone
// answers only half the question: green, amber, red says *how far*, never
// *which way*. So each note gets a stem drawn under it — up is sharp, down is
// flat, length is the amount, colour is the band — on a lane that runs beneath
// the notes themselves, so "which ones were off" is a matter of looking up.
//
// The geometry is exported on its own so a test can weigh it without a browser.

/** The axis runs half a semitone either way — 50 cents is the next note. */
export const SPAN = 50;

/** The same bands the staff colours use (see noteColour in app.js). */
export const BANDS = [
  { maxCents: 15, colour: '#3f6d59', key: 'centred' },
  { maxCents: 30, colour: '#b58a44', key: 'close' },
  { maxCents: Infinity, colour: '#a4534a', key: 'off' },
];

const fmt = (value) => Number(value.toFixed(2));

/** Which band a reading falls in. */
export function bandFor(cents) {
  const size = Math.abs(Number.isFinite(cents) ? cents : 0);
  return BANDS.find((band) => size <= band.maxCents) || BANDS[BANDS.length - 1];
}

/** Clamped to the axis, so a wild reading cannot draw outside the picture. */
export function clampCents(cents) {
  if (!Number.isFinite(cents)) return 0;
  return Math.max(-SPAN, Math.min(SPAN, cents));
}

/** A note the app actually heard, as opposed to one it did not. */
export function isHeard(note) {
  return Boolean(note) && note.status !== 'missed' && Number.isFinite(note.cents);
}

/**
 * What the picture adds up to, in numbers a sentence can be built from.
 * `sharp` and `flat` count only notes outside the centred band; `missed` counts
 * the rings.
 */
export function summariseIntonation(notes = []) {
  const heard = notes.filter(isHeard);
  const sharp = heard.filter((n) => n.cents > 15).length;
  const flat = heard.filter((n) => n.cents < -15).length;
  const sum = heard.reduce((total, n) => total + n.cents, 0);
  return {
    heard: heard.length,
    missed: notes.length - heard.length,
    sharp,
    flat,
    centred: heard.length - sharp - flat,
    average: heard.length ? sum / heard.length : 0,
  };
}

/** The colour of a wrong note: stronger than the "off" band, so it reads as a different thing. */
export const WRONG = '#d23a2f';

/** How many half steps a wrong note was away, rounded, e.g. "+2" or "−1". */
export function semitoneLabel(cents) {
  const n = Math.round(cents / 100);
  if (n === 0) return cents > 0 ? '+' : '−';
  return `${n > 0 ? '+' : '−'}${Math.abs(n)}`;
}

/** The mark for a note that came out as a different pitch altogether. */
function wrongNoteMark(x, cents, centre, half, yFor, delay = 0) {
  const up = cents > 0;
  const r = WRONG_R;
  const badgeY = yFor(cents) + (up ? -1 : 1) * 2; // just past the end of the axis
  // Arrow on the outside, the number of half steps on the inside.
  const s = up ? -1 : 1;
  const tipY = badgeY + s * 7;
  const baseY = badgeY + s * 3.6;
  const arrow = `M ${fmt(x - 3.8)} ${fmt(baseY)} L ${fmt(x)} ${fmt(tipY)} L ${fmt(x + 3.8)} ${fmt(baseY)}`;
  const textY = up ? badgeY + 6.2 : badgeY + 0.6;
  return (
    // Everything animates from CSS (app.css, "wrong note"): the mark pops in,
    // two rings ripple out of the badge for ever, the glow breathes, and a spark
    // runs up the stem towards the badge. --d staggers the marks left to right.
    `<g class="intonation-wrong" data-semitones="${Math.round(cents / 100)}" style="--d:${fmt(delay)}s">` +
    `<rect class="intonation-wrong-col" x="${fmt(x - 8)}" y="${fmt(centre - half - 3)}" width="16" height="${fmt(half * 2 + 6)}" rx="8"/>` +
    `<line class="intonation-wrong-stem" x1="${fmt(x)}" y1="${fmt(centre)}" x2="${fmt(x)}" y2="${fmt(badgeY)}"/>` +
    `<line class="intonation-wrong-spark" x1="${fmt(x)}" y1="${fmt(centre)}" x2="${fmt(x)}" y2="${fmt(badgeY)}"/>` +
    `<circle class="intonation-wrong-ripple" cx="${fmt(x)}" cy="${fmt(badgeY)}" r="${r}"/>` +
    `<circle class="intonation-wrong-ripple is-late" cx="${fmt(x)}" cy="${fmt(badgeY)}" r="${r}"/>` +
    `<circle class="intonation-wrong-glow" cx="${fmt(x)}" cy="${fmt(badgeY)}" r="${fmt(r + 4)}"/>` +
    `<g class="intonation-wrong-pop">` +
    `<circle class="intonation-wrong-badge" cx="${fmt(x)}" cy="${fmt(badgeY)}" r="${r}"/>` +
    `<circle class="intonation-wrong-shine" cx="${fmt(x)}" cy="${fmt(badgeY)}" r="${fmt(r - 1.6)}"/>` +
    `<path class="intonation-wrong-arrow" d="${arrow}"/>` +
    `<text class="intonation-wrong-num" x="${fmt(x)}" y="${fmt(textY)}" text-anchor="middle">${semitoneLabel(cents)}</text>` +
    `</g>` +
    `</g>`
  );
}

/** The wrong-note badge's radius; the lane leaves this much more room. */
export const WRONG_R = 11;

/** Whether a lane holds a wrong note, so the score can leave room for its badge. */
export function hasWrongNote(marks = []) {
  return marks.some((m) => Number.isFinite(m.cents) && Math.abs(m.cents) >= SPAN);
}

/** Where a reading sits, vertically. Exported because a test can check it. */
export function yForCents(cents, { centre, half = 22 } = {}) {
  // Up is sharp: a positive number of cents is drawn above the centre line.
  return centre - (clampCents(cents) / SPAN) * half;
}

/**
 * The lane itself: one stem per note, drawn *under the notes it belongs to*.
 *
 * `marks` are `{ x, cents }` in the order the notes were printed, with `x` the
 * note's own horizontal position — which is what makes the picture readable:
 * a stem sits under the note it is about, so "which notes were off" is a matter
 * of looking up rather than counting columns.
 *
 * A reading half a semitone or more off is a wrong note and gets its own
 * glowing mark (see wrongNoteMark) instead of a stem.
 *
 * `cents` of `null` means the app did not hear that note; it is drawn as a hollow
 * ring on the centre line, which is visibly not the same as a note played
 * perfectly in tune.
 */
export function intonationLane({ marks = [], centre, half = 22, left, right }) {
  if (!marks.length) return { markup: '', bottom: centre };
  const part = [];
  const yFor = (cents) => centre - (clampCents(cents) / SPAN) * half;

  // The centred band, then the two guides where the app stops calling a note
  // centred — the same three thresholds the colour bands use.
  const bandTop = yFor(15);
  const bandBottom = yFor(-15);
  part.push(
    `<rect class="intonation-band" x="${fmt(left)}" y="${fmt(bandTop)}" ` +
      `width="${fmt(Math.max(0, right - left))}" height="${fmt(bandBottom - bandTop)}" rx="4"/>`,
  );
  for (const value of [25, -25]) {
    part.push(
      `<line class="intonation-guide" x1="${fmt(left)}" y1="${fmt(yFor(value))}" ` +
        `x2="${fmt(right)}" y2="${fmt(yFor(value))}"/>`,
    );
  }
  part.push(
    `<line class="intonation-zero" x1="${fmt(left)}" y1="${fmt(centre)}" ` +
      `x2="${fmt(right)}" y2="${fmt(centre)}"/>`,
  );

  for (const mark of marks) {
    const x = mark.x;
    if (!Number.isFinite(mark.cents)) {
      part.push(`<circle class="intonation-missed" cx="${fmt(x)}" cy="${fmt(centre)}" r="1.9"/>`);
      continue;
    }
    // Half a semitone or more off is not "a little high": it is a different
    // note. Clamped to the axis it used to look like a slightly sharp one, so it
    // gets a mark of its own that cannot be mistaken — a tinted column through
    // the lane, a thick stem to the edge, and a glowing badge with an arrow and
    // how many half steps away it was.
    if (Math.abs(mark.cents) >= SPAN) {
      const across = right > left ? (x - left) / (right - left) : 0;
      part.push(wrongNoteMark(x, mark.cents, centre, half, yFor, 0.15 + across * 0.5));
      continue;
    }
    const y = yFor(mark.cents);
    const { colour } = bandFor(mark.cents);
    part.push(
      `<line class="intonation-stem" x1="${fmt(x)}" y1="${fmt(centre)}" x2="${fmt(x)}" y2="${fmt(y)}" ` +
        `stroke="${colour}" stroke-width="2.6"/>`,
    );
    part.push(`<circle class="intonation-dot" cx="${fmt(x)}" cy="${fmt(y)}" r="2.2" fill="${colour}"/>`);
  }
  // A badge below the lane reaches past it; say so, so the next system clears it.
  const below = marks.some((m) => Number.isFinite(m.cents) && m.cents <= -SPAN);
  return { markup: part.join(''), bottom: centre + half + (below ? WRONG_R + 2 : 0) };
}
