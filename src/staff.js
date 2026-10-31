// staff.js — a small treble-staff renderer (SVG string output).
//
// Deliberately dependency-free: five lines, a G clef, a key signature, note
// heads with stems, ledger lines, courtesy accidentals and note names.

import { CLEF_PATH } from './clef.js?v=202610302313';

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

function glyph(alter) {
  if (alter === 1) return '\u266F';
  if (alter === -1) return '\u266D';
  if (alter === 2) return '\u266F\u266F';
  if (alter === -2) return '\u266D\u266D';
  return '\u266E'; // natural
}

export function renderStaff(notes, { fifths = 0, colors = null, labels = true, caption = '' } = {}) {
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
  const notesX = sigX + sigWidth + (sigCount ? 26 : 18);

  const width = Math.max(520, notesX + (notes.length - 1) * noteSpacing + 34);
  const height = 196;

  const part = [];
  part.push(
    `<svg class="staff" viewBox="0 0 ${width} ${height}" role="img" aria-label="Scale notation">`,
  );

  // Staff lines
  part.push('<g stroke="#cfc4b3" stroke-width="1" stroke-linecap="round">');
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

  // Key signature
  if (sigCount) {
    const positions = fifths > 0 ? SHARP_POSITIONS : FLAT_POSITIONS;
    const symbol = fifths > 0 ? '\u266F' : '\u266D';
    for (let i = 0; i < sigCount; i++) {
      const [letter, octave] = positions[i];
      const y = yFor({ letter, octave });
      part.push(
        `<text class="staff-acc" x="${sigX + i * 13}" y="${y + 5.5}" font-size="16">${symbol}</text>`,
      );
    }
  }

  // Notes
  notes.forEach((note, i) => {
    const x = notesX + i * noteSpacing;
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
        `<line x1="${x - 9}" y1="${ly}" x2="${x + 9}" y2="${ly}" stroke="#cfc4b3" stroke-width="1"/>`,
      );
    }

    // Courtesy accidental (anything the key signature does not already cover)
    if (note.courtesy) {
      part.push(
        `<text class="staff-acc" x="${x - 20}" y="${y + 5.5}" font-size="16" fill="${color}">${glyph(note.alter)}</text>`,
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
