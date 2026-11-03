// intonation.js — one picture of how far each note sat from its centre.
//
// The result screens already colour each note on the staff, and colour alone
// answers only half the question: green, amber, red says *how far*, never
// *which way*. A student who has just been told "2 of 19 notes sat a little
// high" wants to see the shape of it — which notes, how many, and whether the
// take as a whole drifted sharp or flat.
//
// So this draws a axis of cents with one stem per note: up is sharp, down is
// flat, length is the amount, colour is the band the app already uses. A missed
// note is a hollow ring on the centre line — visibly not a note that was played
// in tune, but one the microphone did not hear.
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

/** Where a reading sits, vertically. Exported because a test can check it. */
export function yForCents(cents, { height, top = 10, bottom = 10 } = {}) {
  const middle = height / 2;
  const half = Math.max(1, middle - Math.max(top, bottom));
  // Up is sharp: a positive number of cents is drawn above the centre line.
  return middle - (clampCents(cents) / SPAN) * half;
}

const fmt = (value) => Number(value.toFixed(2));

/**
 * The picture itself, as SVG.
 *
 * `notes` are the result of a take — `{ status, cents }` per note, in order, as
 * `analyzeTake` and `analyzeSightTake` both produce them.
 */
export function renderIntonationMap(notes = [], options = {}) {
  const {
    width = 760,
    height = 118,
    label = '',
    // A narrow phone gets the same drawing, just fewer notes across it.
    gutter = 26,
    padRight = 6,
  } = options;
  const count = notes.length;
  if (!count) return '';

  const top = 12;
  const bottom = 12;
  const middle = height / 2;
  const half = middle - Math.max(top, bottom);
  const plotLeft = gutter;
  const plotRight = width - padRight;
  const step = (plotRight - plotLeft) / count;
  const stemWidth = Math.max(2, Math.min(3.4, step * 0.22));
  const dotR = Math.max(2.0, Math.min(3.0, step * 0.18));

  const part = [];
  part.push(
    `<svg class="intonation-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">`,
  );

  // The centred band: the same ±15 cents the app calls "in tune".
  const bandTop = yForCents(15, { height, top, bottom });
  const bandBottom = yForCents(-15, { height, top, bottom });
  part.push(
    `<rect class="intonation-band" x="${fmt(plotLeft)}" y="${fmt(bandTop)}" ` +
      `width="${fmt(Math.max(0, plotRight - plotLeft))}" height="${fmt(bandBottom - bandTop)}" rx="5"/>`,
  );
  // ±25 — the point at which the app stops calling a note centred.
  for (const cents of [25, -25]) {
    const y = yForCents(cents, { height, top, bottom });
    part.push(
      `<line class="intonation-guide" x1="${fmt(plotLeft)}" y1="${fmt(y)}" ` +
        `x2="${fmt(plotRight)}" y2="${fmt(y)}"/>`,
    );
  }
  // The centre line, and the labels that make the axis readable on its own.
  part.push(
    `<line class="intonation-zero" x1="${fmt(plotLeft)}" y1="${fmt(middle)}" ` +
      `x2="${fmt(plotRight)}" y2="${fmt(middle)}"/>`,
  );
  for (const [cents, text] of [
    [SPAN, '+50'],
    [0, '0'],
    [-SPAN, '−50'],
  ]) {
    const y = yForCents(cents, { height, top, bottom });
    part.push(
      `<text class="intonation-tick" x="${fmt(plotLeft - 6)}" y="${fmt(y + 3)}" ` +
        `text-anchor="end">${text}</text>`,
    );
  }

  notes.forEach((note, index) => {
    const x = plotLeft + step * (index + 0.5);
    if (!isHeard(note)) {
      // Hollow on the line: the note was not heard, which is not the same as
      // "played perfectly in tune" and must not look like it.
      part.push(
        `<circle class="intonation-missed" cx="${fmt(x)}" cy="${fmt(middle)}" r="${fmt(dotR * 0.8)}"/>`,
      );
      return;
    }
    const cents = Number(note.cents) || 0;
    const y = yForCents(cents, { height, top, bottom });
    const { colour } = bandFor(cents);
    part.push(
      `<line class="intonation-stem" x1="${fmt(x)}" y1="${fmt(middle)}" ` +
        `x2="${fmt(x)}" y2="${fmt(y)}" stroke="${colour}" stroke-width="${fmt(stemWidth)}"/>`,
    );
    part.push(`<circle class="intonation-dot" cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(dotR)}" fill="${colour}"/>`);
    // A reading past the end of the axis gets a small chevron, so "off the
    // scale" is a fact rather than a stem that just happens to stop early.
    if (Math.abs(cents) > SPAN) {
      const dir = cents > 0 ? -1 : 1;
      const tip = y + dir * (dotR + 1.2);
      part.push(
        `<path class="intonation-over" d="M ${fmt(x - dotR)} ${fmt(tip)} L ${fmt(x)} ${fmt(tip + dir * (dotR * 1.2))} L ${fmt(x + dotR)} ${fmt(tip)}" stroke="${colour}"/>`,
      );
    }
  });

  part.push('</svg>');
  return part.join('');
}
