// staff.js — a small treble-staff renderer (SVG string output).
//
// Deliberately dependency-free: five lines, a G clef, a key signature, note
// heads with stems, ledger lines, courtesy accidentals and note names.

import { CLEF_PATH } from './clef.js?v=202611120915';
import { intonationLane } from './intonation.js?v=202611120915';

const LINE_GAP = 11;
const STEPS = LINE_GAP / 2;
const STAFF_TOP = 74;
const STAFF_BOTTOM = STAFF_TOP + 4 * LINE_GAP;
const E4 = 30; // diatonic index of the bottom line (octave * 7 + letter)

const INK = '#241f1a';
const MUTED = '#8a8175';

const yFor = (note) => STAFF_BOTTOM - (note.octave * 7 + note.letter - E4) * STEPS;

// Where each accidental of a key signature sits on a treble staff.
const SHARP_POSITIONS = [
  [3, 5], [0, 5], [4, 5], [1, 5], [5, 4], [2, 5], [6, 4],
];
const FLAT_POSITIONS = [
  [6, 4], [2, 5], [5, 4], [1, 5], [4, 4], [0, 5], [3, 4],
];

// The clef path is drawn in a 1435 x 4066 box.
const CLEF_BBOX = { w: 1435, h: 4066, x: 1186, y: 5608 };

// Shared with src/score.js so a bar of sight reading sits on the same staff as a
// scale exercise: one source of truth for the geometry and the ink.
export const STAFF_GEOM = {
  LINE_GAP,
  STEPS,
  TOP: STAFF_TOP,
  BOTTOM: STAFF_BOTTOM,
  E4,
  INK,
  MUTED,
  CLEF_BBOX,
  /**
   * Vertical centre of a note head, from its spelled letter and octave.
   * `bottom` lets a page with several systems say where its staff sits;
   * without it the note lands on the single staff staff.js draws.
   */
  yForNote: (letter, octave, bottom = STAFF_BOTTOM) =>
    bottom - (octave * 7 + letter - E4) * STEPS,
  /** Diatonic staff index: every step of a third is 2. */
  indexOf: (letter, octave) => octave * 7 + letter,
  /** Stems follow the convention: below the middle line they point up. */
  stemUp: (letter, octave) => octave * 7 + letter < E4 + 4,
  /** Where each accidental of a key signature sits, as [letter, octave]. */
  SHARP_POSITIONS,
  FLAT_POSITIONS,
};

const FLAT_PATH =
  'M-0.085 -1.95 H0.085 V-0.42 C0.28 -0.76 0.80 -0.70 0.78 -0.26 ' +
  'C0.76 0.12 0.36 0.38 0.085 0.65 H-0.085 Z ' +
  'M0.085 -0.16 C0.21 -0.45 0.47 -0.45 0.47 -0.22 C0.47 0.00 0.27 0.16 0.085 0.34 Z';

/**
 * Sharps, flats and naturals drawn as paths, sized in staff spaces: a flat's
 * bowl is exactly one space and the glyph stands about three. Text glyphs sit on
 * a font baseline nobody controls, so they came out small and off-centre — and
 * the two staves in the app then looked like they came from different books.
 * `y` is the centre of the note's line or space.
 */
export function accidentalAt(alter, x, y, colour = INK, size = 1) {
  const s = LINE_GAP * size;
  const stem = 0.17 * s;

  // A flat: the printed outline, as one filled path — a thin stem, a bowl that
  // swells on the right and comes back down to a point on the stem, the counter
  // left open (even-odd). It used to be a stem and a heavy half-ellipse stroke,
  // which read as a "D" on a stick: round at the bottom where a flat is pointed,
  // and closed up into a blob at small sizes. Coordinates are in staff spaces
  // with the stem on x = 0; the bowl sits on the note's line or space.
  const flatAt = (cx) =>
    `<path d="${FLAT_PATH}" transform="translate(${cx} ${y}) scale(${s})" ` +
    `fill="${colour}" fill-rule="evenodd"/>`;

  // A sharp: the engraved sample the app was matched against, traced once from a
  // high-resolution bitmap of it and kept as a path. The outline is the printed
  // one — thin uprights, bars nearly a whole space apart so a note head fits
  // between them, ends cut vertically — and because it is a path it stays crisp
  // at any size instead of going soft the way an embedded bitmap would.
  //
  // Coordinates are in staff spaces, centred on the note's line or space: x from
  // -0.481 to 0.481, y from -1.510 to 1.400. The second subpath is the counter
  // (the gap enclosed by the two bars and the two uprights), so it has to be
  // filled with even-odd.
  const SHARP_PATH =
    'M0.168 -1.510 L0.276 -1.504 L0.275 -0.793 L0.481 -0.833 L0.481 -0.447 L0.275 -0.397 ' +
    'L0.275 0.150 L0.480 0.110 L0.481 0.505 L0.454 0.517 L0.283 0.553 L0.275 0.561 L0.273 1.275 ' +
    'L0.150 1.272 L0.148 0.586 L-0.146 0.651 L-0.146 1.397 L-0.268 1.400 L-0.271 0.681 ' +
    'L-0.464 0.723 L-0.479 0.725 L-0.481 0.716 L-0.480 0.325 L-0.271 0.275 L-0.271 -0.271 ' +
    'L-0.481 -0.231 L-0.481 -0.617 L-0.271 -0.667 L-0.268 -1.416 L-0.146 -1.414 L-0.144 -0.697 ' +
    'L0.148 -0.762 L0.148 -1.504 Z ' +
    'M0.138 -0.368 L0.149 -0.362 L0.150 0.180 L-0.143 0.246 L-0.145 -0.301 Z';

  const sharpAt = (cx) =>
    `<path d="${SHARP_PATH}" transform="translate(${cx} ${y}) scale(${s})" ` +
    `fill="${colour}" fill-rule="evenodd"/>`;

  const naturalAt = (cx) => {
    const l = cx - 0.36 * s;
    const r = cx + 0.36 * s;
    const bar = 0.36 * s;
    return (
      `<g stroke="${colour}" stroke-linecap="butt">` +
      `<line x1="${l}" y1="${y - 1.5 * s}" x2="${l}" y2="${y + 0.5 * s}" stroke-width="${stem}"/>` +
      `<line x1="${r}" y1="${y - 0.5 * s}" x2="${r}" y2="${y + 1.5 * s}" stroke-width="${stem}"/>` +
      `<line x1="${l}" y1="${y - 0.5 * s}" x2="${r}" y2="${y - 0.5 * s}" stroke-width="${bar}"/>` +
      `<line x1="${l}" y1="${y + 0.5 * s}" x2="${r}" y2="${y + 0.5 * s}" stroke-width="${bar}"/>` +
      `</g>`
    );
  };

  if (alter === -1) return flatAt(x);
  if (alter === 1) return sharpAt(x);
  if (alter === -2) return flatAt(x - 0.75 * s) + flatAt(x + 0.75 * s);
  if (alter === 2) return sharpAt(x - 0.75 * s) + sharpAt(x + 0.75 * s);
  return naturalAt(x);
}

/**
 * A key signature as a small row of engraved signs, for the scale cards: the
 * same sharp and flat the staff draws, not the font's. As text they came from
 * whichever symbol font the device happened to have, so the flats arrived thin,
 * pale and a different shape on every machine. Drawn in currentColor, one em
 * tall by way of the CSS, so the card decides the colour and size.
 */
export function keySignatureGlyphs(fifths) {
  const count = Math.abs(fifths);
  if (!count) return '';
  const sharp = fifths > 0;
  const s = LINE_GAP;
  const step = (sharp ? 1.42 : 1.3) * s;
  // A flat's stem is its left edge and the bowl hangs to the right of it; a
  // sharp is centred. The box is the same height for both so rows line up.
  const first = (sharp ? 0.52 : 0.14) * s;
  const top = (sharp ? -1.62 : -2.1) * s;
  const height = 3.24 * s;
  const width = first + (count - 1) * step + (sharp ? 0.52 : 0.95) * s;
  let marks = '';
  for (let i = 0; i < count; i += 1) {
    marks += accidentalAt(sharp ? 1 : -1, first + i * step, 0, 'currentColor');
  }
  const r = (n) => Math.round(n * 100) / 100;
  return (
    `<svg class="sig-svg" viewBox="0 ${r(top)} ${r(width)} ${r(height)}" ` +
    `style="width:${r(width / height)}em" focusable="false">${marks}</svg>`
  );
}

export function renderStaff(
  notes,
  {
    fifths = 0,
    colors = null,
    labels = true,
    caption = '',
    ariaLabel = 'Scale notation',
    // One entry per note: cents above or below centre, or null for a note that
    // was not heard. Present only on the result screen.
    intonation = null,
  } = {},
) {
  const noteSpacing = 34;
  const leftPad = 18;
  const clefX = leftPad + 4;
  const clefHeight = LINE_GAP * 7.1;
  const clefScale = clefHeight / CLEF_BBOX.h;
  const clefWidth = CLEF_BBOX.w * clefScale;
  // The spiral of the clef wraps the G4 line (second line from the bottom).
  const clefTop = STAFF_BOTTOM - LINE_GAP - clefHeight * 0.615;

  const sigCount = Math.min(Math.abs(fifths), 7);
  const sigWidth = sigCount * 13;
  const sigX = clefX + clefWidth + 10;
  const notesX = sigX + sigWidth + (sigCount ? 30 : 18);

  // An accidental needs horizontal room, as it does in engraved music. A note
  // that carries one is pushed a little to the right, so the glyph sits against
  // the head it belongs to instead of drifting toward the note before it — and
  // two accidentals in a row (G#, then the G natural on the way down) stop
  // colliding.
  const accOffset = (alter) =>
    (alter === 0 ? 1.25 : Math.abs(alter) >= 2 ? 2.2 : alter > 0 ? 1.25 : 1.55) * LINE_GAP;
  const accPad = (alter) => Math.max(0, accOffset(alter) - LINE_GAP);
  const xs = [];
  let cursor = notesX;
  for (const note of notes) {
    xs.push(cursor);
    cursor += noteSpacing + (note.courtesy ? accPad(note.alter) : 0);
  }
  if (notes.length) {
    // (`notes.at(-1)` would be tidier but needs iOS 15.4; students' iPads are older)
    const last = notes[notes.length - 1];
    cursor -= noteSpacing + (last.courtesy ? accPad(last.alter) : 0);
  }

  const width = Math.max(520, cursor + 34);
  // A result screen asks for the intonation lane under the notes, which needs its
  // own room below the note names: the drawing grows downwards, never sideways.
  const lane = Boolean(intonation && intonation.length);
  const laneTop = 196;
  const height = lane ? laneTop + 62 : 196;

  const part = [];
  part.push(
    `<svg class="staff" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}">`,
  );

  // Staff lines
  part.push('<g stroke="#c3b49d" stroke-width="1.15" stroke-linecap="round">');
  for (let i = 0; i < 5; i++) {
    const y = STAFF_TOP + i * LINE_GAP;
    part.push(`<line x1="${leftPad}" y1="${y}" x2="${width - leftPad}" y2="${y}"/>`);
  }
  part.push('</g>');

  // Clef
  part.push(
    `<g transform="translate(${clefX},${clefTop}) scale(${clefScale}) translate(${-CLEF_BBOX.x},${-CLEF_BBOX.y})">` +
      `<path d="${CLEF_PATH}" fill="${INK}" stroke="${INK}" stroke-width="4"/></g>`,
  );

  // Key signature — grouped so it can be found (and checked) as one thing.
  if (sigCount) {
    const positions = fifths > 0 ? SHARP_POSITIONS : FLAT_POSITIONS;
    const glyphs = [];
    for (let i = 0; i < sigCount; i++) {
      const [letter, octave] = positions[i];
      const y = yFor({ letter, octave });
      glyphs.push(accidentalAt(fifths > 0 ? 1 : -1, sigX + i * 14, y));
    }
    part.push(`<g class="staff-key-sig">${glyphs.join('')}</g>`);
  }

  // Notes
  notes.forEach((note, i) => {
    const x = xs[i];
    const y = yFor(note);
    const idx = note.octave * 7 + note.letter;
    const color = (colors && colors[i]) || INK;

    // Ledger lines
    const ledgers = [];
    if (idx < E4) for (let l = E4 - 2; l >= idx; l -= 2) ledgers.push(l);
    if (idx > E4 + 8) for (let l = E4 + 10; l <= idx; l += 2) ledgers.push(l);
    for (const l of ledgers) {
      const ly = STAFF_BOTTOM - (l - E4) * STEPS;
      part.push(
        `<line x1="${x - 10.5}" y1="${ly}" x2="${x + 10.5}" y2="${ly}" stroke="#c3b49d" stroke-width="1.15"/>`,
      );
    }

    // Courtesy accidental (anything the key signature does not already cover).
    // Tucked against its own head, and small enough to read as a reminder
    // rather than as loud as the key signature.
    if (note.courtesy) {
      part.push(
        accidentalAt(note.alter, x - accOffset(note.alter), y, color, 0.92),
      );
    }

    // Stem
    // The printed proportions, the same as the sight-reading page: a stem is an
    // octave long (3.5 spaces) and stands at the edge of its head, starting where
    // the leaning oval is widest. A note out on ledger lines has its stem carried
    // back to the middle line, so the low G and the high notes stay tied to the
    // staff instead of floating beside it. (It was 2.7 spaces for every note,
    // set inside a head that did not fill its space.)
    const stemUp = idx < 34;
    const stemX = stemUp ? x + 6 : x - 6;
    const stemY1 = stemUp ? y - 1 : y + 1;
    const middle = STAFF_TOP + 2 * LINE_GAP;
    const stemY2 = stemUp
      ? Math.min(y - 3.5 * LINE_GAP, middle)
      : Math.max(y + 3.5 * LINE_GAP, middle);
    part.push(
      `<line x1="${stemX}" y1="${stemY1}" x2="${stemX}" y2="${stemY2}" stroke="${color}" stroke-width="1.42" stroke-linecap="round"/>`,
    );

    // Note head
    part.push(
      `<ellipse class="staff-head" data-i="${i}" data-stem="${stemUp ? 'up' : 'down'}" cx="${x}" cy="${y}" rx="6.9" ry="5.1" fill="${color}" transform="rotate(-20 ${x} ${y})"/>`,
    );

    if (labels) {
      part.push(
        `<text class="staff-label" x="${x}" y="${lane ? laneTop - 13 : height - 13}" text-anchor="middle" font-size="11">${note.letterName}${note.octave}</text>`,
      );
    }
  });

  if (caption) {
    part.push(
      `<text x="${leftPad}" y="${lane ? laneTop - 2 : height - 2}" font-size="9" fill="${MUTED}">${caption}</text>`,
    );
  }

  // The intonation lane, under the note names and lined up with the noteheads
  // above it: one stem per note, at that note's own x.
  if (lane) {
    const marks = notes.map((note, i) => ({
      x: xs[i],
      cents: Number.isFinite(intonation[i]) ? intonation[i] : null,
    }));
    part.push(
      intonationLane({
        marks,
        centre: laneTop + 30,
        half: 24,
        left: leftPad,
        right: width - leftPad,
      }).markup,
    );
  }

  part.push('</svg>');
  return part.join('');
}
