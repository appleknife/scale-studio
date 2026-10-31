// staff.js — a small treble-staff renderer (SVG string output).
//
// Deliberately dependency-free: five lines, a G clef, a key signature, note
// heads with stems, ledger lines, courtesy accidentals and note names.

import { CLEF_PATH } from './clef.js?v=202610310311';

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
  /** Where each accidental of a key signature sits, as [letter, octave]. */
  SHARP_POSITIONS,
  FLAT_POSITIONS,
};

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

  const flatAt = (cx) =>
    `<path d="M${cx} ${y - 1.95 * s} L${cx} ${y + 0.5 * s}" stroke="${colour}" stroke-width="${0.2 * s}"/>` +
    `<path d="M${cx} ${y - 0.5 * s} A ${0.66 * s} ${0.5 * s} 0 0 1 ${cx} ${y + 0.5 * s}" ` +
    `fill="none" stroke="${colour}" stroke-width="${0.44 * s}" stroke-linecap="round"/>`;

  // A sharp is about one staff space wide and 2.8 tall. Drawn wider than that
  // (as it first was) a six-sharp key signature merges into one dark block, so
  // the horizontals stop at just over half a space either side of the middle.
  const sharpAt = (cx) =>
    `<g stroke="${colour}" stroke-linecap="butt">` +
    `<line x1="${cx - 0.27 * s}" y1="${y - 1.45 * s}" x2="${cx - 0.27 * s}" y2="${y + 1.45 * s}" stroke-width="${stem}"/>` +
    `<line x1="${cx + 0.27 * s}" y1="${y - 1.6 * s}" x2="${cx + 0.27 * s}" y2="${y + 1.3 * s}" stroke-width="${stem}"/>` +
    `<line x1="${cx - 0.42 * s}" y1="${y - 0.32 * s}" x2="${cx + 0.42 * s}" y2="${y - 0.46 * s}" stroke-width="${0.32 * s}"/>` +
    `<line x1="${cx - 0.42 * s}" y1="${y + 0.46 * s}" x2="${cx + 0.42 * s}" y2="${y + 0.32 * s}" stroke-width="${0.32 * s}"/>` +
    `</g>`;

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

export function renderStaff(
  notes,
  { fifths = 0, colors = null, labels = true, caption = '', ariaLabel = 'Scale notation' } = {},
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
    (alter === 0 ? 1.25 : Math.abs(alter) >= 2 ? 2.3 : alter > 0 ? 1.4 : 1.6) * LINE_GAP;
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
  const height = 196;

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
        `<line x1="${x - 9}" y1="${ly}" x2="${x + 9}" y2="${ly}" stroke="#c3b49d" stroke-width="1.15"/>`,
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
    const stemUp = idx < 34;
    const stemX = stemUp ? x + 5.4 : x - 5.4;
    const stemY2 = stemUp ? y - 30 : y + 30;
    part.push(
      `<line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${stemY2}" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>`,
    );

    // Note head
    part.push(
      `<ellipse cx="${x}" cy="${y}" rx="5.7" ry="4.2" fill="${color}" transform="rotate(-18 ${x} ${y})"/>`,
    );

    if (labels) {
      part.push(
        `<text class="staff-label" x="${x}" y="${height - 13}" text-anchor="middle" font-size="11">${note.letterName}${note.octave}</text>`,
      );
    }
  });

  if (caption) {
    part.push(
      `<text x="${leftPad}" y="${height - 2}" font-size="9" fill="${MUTED}">${caption}</text>`,
    );
  }

  part.push('</svg>');
  return part.join('');
}
