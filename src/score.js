// score.js — eight bars of real notation, in the app's own hand.
//
// staff.js draws a scale: one line, no rhythm. Sight reading needs barlines, note
// values, beams, rests, dots, accidentals, articulations, dynamics and a tempo
// mark, and it needs to fit a phone, so it prints as two systems of four bars.
//
// It borrows staff.js's geometry and ink so the two screens look like siblings.

import { STAFF_GEOM } from './staff.js?v=202610310132';
import { CLEF_PATH } from './clef.js?v=202610310132';

import { beatLength } from './sightreading.js?v=202610310132';

const { LINE_GAP, STEPS, E4, INK, MUTED, CLEF_BBOX, yForNote, indexOf } = STAFF_GEOM;

const WIDTH = 1000;
const LEFT = 16;
const RIGHT = 16;
const SYSTEM_GAP = 150;
const TOP_PAD = 62;
const CLEF_SCALE = (LINE_GAP * 7.1) / CLEF_BBOX.h;
const CLEF_WIDTH = CLEF_BBOX.w * CLEF_SCALE;
const BARS_PER_SYSTEM = 4;

// Proportions follow engraving convention in staff spaces (one space = LINE_GAP):
// a stem is 3.5 spaces, a beam half a space thick, a note head a little over a
// space wide. Anything smaller reads as a sketch rather than a score.
const HEAD_RX = 6.1;
const HEAD_RY = 4.6;
const STEM = 3.5 * LINE_GAP;
const BEAM = 0.48 * LINE_GAP;
const FLAG = 22;

/** Stems follow the convention: below the middle line point up. */
const stemUp = (letter, octave) => indexOf(letter, octave) < E4 + 4;

function ledgerLines(letter, octave, x, bottom) {
  const idx = indexOf(letter, octave);
  const out = [];
  const line = (l) => {
    const y = bottom - (l - E4) * STEPS;
    out.push(`<line x1="${x - 9.5}" y1="${y}" x2="${x + 9.5}" y2="${y}" stroke="#cfc4b3" stroke-width="1"/>`);
  };
  if (idx < E4) for (let l = E4 - 2; l >= idx; l -= 2) line(l);
  else if (idx > E4 + 8) for (let l = E4 + 10; l <= idx; l += 2) line(l);
  return out.join('');
}

/**
 * Accidentals drawn as paths, sized in staff spaces: a flat's bowl is exactly
 * one space tall and the glyph stands about 2.9 spaces. Text glyphs sit on a font
 * baseline nobody controls, which is why they came out small and off-centre.
 * `y` is the centre of the note's line or space.
 */
function accidental(alter, x, y, colour = INK) {
  const s = LINE_GAP;
  const stem = 0.17 * s;

  // The bowl is a thick arc rather than a filled outline: it keeps its weight at
  // small sizes, and its height is exactly one staff space as the eye expects.
  const flatAt = (cx) =>
    `<path d="M${cx} ${y - 1.95 * s} L${cx} ${y + 0.5 * s}" ` +
    `stroke="${colour}" stroke-width="${0.2 * s}"/>` +
    `<path d="M${cx} ${y - 0.5 * s} A ${0.66 * s} ${0.5 * s} 0 0 1 ${cx} ${y + 0.5 * s}" ` +
    `fill="none" stroke="${colour}" stroke-width="${0.44 * s}" stroke-linecap="round"/>`;

  const sharpAt = (cx) =>
    `<g stroke="${colour}" stroke-linecap="butt">` +
    `<line x1="${cx - 0.34 * s}" y1="${y - 1.45 * s}" x2="${cx - 0.34 * s}" y2="${y + 1.45 * s}" stroke-width="${stem}"/>` +
    `<line x1="${cx + 0.34 * s}" y1="${y - 1.6 * s}" x2="${cx + 0.34 * s}" y2="${y + 1.3 * s}" stroke-width="${stem}"/>` +
    `<line x1="${cx - 0.75 * s}" y1="${y - 0.3 * s}" x2="${cx + 0.75 * s}" y2="${y - 0.46 * s}" stroke-width="${0.34 * s}"/>` +
    `<line x1="${cx - 0.75 * s}" y1="${y + 0.46 * s}" x2="${cx + 0.75 * s}" y2="${y + 0.3 * s}" stroke-width="${0.34 * s}"/>` +
    `</g>`;

  const naturalAt = (cx) =>
    `<g stroke="${colour}" stroke-linecap="butt">` +
    `<line x1="${cx - 0.36 * s}" y1="${y - 1.45 * s}" x2="${cx - 0.36 * s}" y2="${y + 0.22 * s}" stroke-width="${stem}"/>` +
    `<line x1="${cx + 0.36 * s}" y1="${y - 0.22 * s}" x2="${cx + 0.36 * s}" y2="${y + 1.45 * s}" stroke-width="${stem}"/>` +
    `<line x1="${cx - 0.36 * s}" y1="${y - 0.22 * s}" x2="${cx + 0.36 * s}" y2="${y - 0.38 * s}" stroke-width="${0.34 * s}"/>` +
    `<line x1="${cx - 0.36 * s}" y1="${y + 0.38 * s}" x2="${cx + 0.36 * s}" y2="${y + 0.22 * s}" stroke-width="${0.34 * s}"/>` +
    `</g>`;

  if (alter === -1) return flatAt(x);
  if (alter === 1) return sharpAt(x);
  if (alter === -2) return flatAt(x - 0.75 * s) + flatAt(x + 0.75 * s);
  if (alter === 2) return sharpAt(x - 0.75 * s) + sharpAt(x + 0.75 * s);
  return naturalAt(x);
}

function head(x, y, { hollow = false, colour = INK } = {}) {
  if (hollow) {
    return `<ellipse cx="${x}" cy="${y}" rx="${HEAD_RX}" ry="${HEAD_RY}" fill="none" stroke="${colour}" stroke-width="1.7" transform="rotate(-18 ${x} ${y})"/>`;
  }
  return `<ellipse cx="${x}" cy="${y}" rx="${HEAD_RX}" ry="${HEAD_RY}" fill="${colour}" transform="rotate(-18 ${x} ${y})"/>`;
}

/* ── Rests ─────────────────────────────────────────────────────────────── */

function restGlyph(x, y, dur, colour) {
  if (dur >= 16) {
    // whole rest — a block hanging under the fourth line
    return `<rect x="${x - 6}" y="${y - LINE_GAP / 2 + 1}" width="12" height="5.5" fill="${colour}"/>`;
  }
  if (dur >= 8) {
    // half rest — a block sitting on the middle line
    return `<rect x="${x - 6}" y="${y - 2}" width="12" height="5.5" fill="${colour}"/>`;
  }
  if (dur >= 4) {
    // quarter rest — a bolder squiggle, so it reads at a glance on a phone
    return (
      `<path d="M${x - 1.2} ${y - 12} l5 5.6 -4.6 4.4 5.6 5 -3.6 9" ` +
      `fill="none" stroke="${colour}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }
  // eighth rest — a dot with a hook, big enough to read at phone size
  return (
    `<circle cx="${x + 2.4}" cy="${y - 8}" r="3" fill="${colour}"/>` +
    `<path d="M${x + 2.4} ${y - 8} q4.6 -2.6 2 -7.4" fill="none" stroke="${colour}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M${x + 2.4} ${y - 8} q-2.4 5.4 -4.6 9.6" fill="none" stroke="${colour}" stroke-width="2.2" stroke-linecap="round"/>`
  );
}

/* ── Beams ─────────────────────────────────────────────────────────────── */

/**
 * Groups of consecutive eighths and sixteenths inside one beat, with the runs
 * of sixteenths that need a second beam.
 */
function beamGroups(events, beat) {
  const groups = [];
  let group = [];
  const close = () => {
    if (group.length > 1) groups.push(group);
    group = [];
  };
  for (const e of events) {
    if (e.rest || e.dur > 2) {
      close();
      continue;
    }
    if (group.length) {
      const sameBeat = Math.floor(group[group.length - 1].start / beat) === Math.floor(e.start / beat);
      if (!sameBeat) close();
    }
    group.push(e);
  }
  close();
  return groups;
}

/** Runs of consecutive sixteenths inside one beam group. */
function sixteenthRuns(group) {
  const runs = [];
  let run = [];
  for (const e of group) {
    if (e.dur === 1) run.push(e);
    else {
      if (run.length > 1) runs.push(run);
      run = [];
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

/* ── One system of four bars ───────────────────────────────────────────── */

function drawSystem(passage, barFrom, barTo, top, { timeSignature, tempoText, showTempo }) {
  const part = [];
  const bottom = top + 4 * LINE_GAP;

  // staff lines
  part.push(`<g stroke="#cfc4b3" stroke-width="1" stroke-linecap="round">`);
  for (let i = 0; i < 5; i++) {
    const y = top + i * LINE_GAP;
    part.push(`<line x1="${LEFT}" y1="${y}" x2="${WIDTH - RIGHT}" y2="${y}"/>`);
  }
  part.push('</g>');

  // clef
  const clefX = LEFT + 4;
  const clefTop = bottom - LINE_GAP - LINE_GAP * 7.1 * 0.615;
  part.push(
    `<g transform="translate(${clefX},${clefTop}) scale(${CLEF_SCALE}) translate(${-CLEF_BBOX.x},${-CLEF_BBOX.y})">` +
      `<path d="${CLEF_PATH}" fill="${INK}" stroke="${INK}" stroke-width="4"/></g>`,
  );

  // key signature
  const sigCount = Math.min(Math.abs(passage.key.fifths), 7);
  const sigX = clefX + CLEF_WIDTH + 17;
  if (sigCount) {
    // Same placement table as staff.js — one source of truth, so a key signature
    // can never land on the wrong line here.
    const order = passage.key.fifths > 0 ? STAFF_GEOM.SHARP_POSITIONS : STAFF_GEOM.FLAT_POSITIONS;
    for (let i = 0; i < sigCount; i++) {
      const [letter, octave] = order[i];
      part.push(
        accidental(passage.key.fifths > 0 ? 1 : -1, sigX + i * 16, yForNote(letter, octave, bottom)),
      );
    }
  }

  // time signature, first system only
  let cursor = sigX + sigCount * 14 + (sigCount ? 18 : 14);
  if (timeSignature) {
    const [num, den] = passage.meter.split('/');
    const midY = top + 2 * LINE_GAP;
    // Each digit is about two spaces tall, so the pair fills the staff.
    part.push(
      `<text class="score-time" x="${cursor}" y="${midY - 1}" font-size="27" text-anchor="middle">${num}</text>`,
      `<text class="score-time" x="${cursor}" y="${midY + 23}" font-size="27" text-anchor="middle">${den}</text>`,
    );
    cursor += 30;
  }

  // tempo mark
  if (showTempo && tempoText) {
    part.push(
      `<text class="score-tempo" x="${cursor + 6}" y="${top - 17}" font-size="15">${tempoText}</text>`,
    );
  }

  const musicLeft = cursor + 26;
  const musicWidth = WIDTH - RIGHT - musicLeft;
  const barWidth = musicWidth / (barTo - barFrom);
  const inset = 12;

  const beat = beatLength(passage.meter);

  /**
   * Horizontal positions for one bar: time first, then a floor on the gap so a
   * sixteenth and the accidental in front of it never land on top of each other.
   * If the nudge pushes the bar past its own width, the whole bar is compressed
   * back inside it rather than colliding with the barline.
   */
  function positions(events, barX) {
    const x0 = barX + inset;
    const span = barWidth - inset - 8;
    const xs = new Map();
    let prev = null;
    for (const e of events) {
      let x = x0 + (e.start / passage.perBar) * span;
      const gap = 15 + (e.accidental ? 9 : 0);
      if (prev != null && x - prev < gap) x = prev + gap;
      xs.set(e, x);
      prev = x;
    }
    const limit = barX + barWidth - 9;
    if (prev != null && prev > limit) {
      const first = xs.get(events[0]);
      const scale = prev > first ? (limit - first) / (prev - first) : 1;
      for (const e of events) xs.set(e, first + (xs.get(e) - first) * scale);
    }
    return xs;
  }

  for (let bar = barFrom; bar < barTo; bar++) {
    const events = passage.bars[bar];
    const barX = musicLeft + (bar - barFrom) * barWidth;
    const xs = positions(events, barX);
    const xOf = (event) => xs.get(event);

    // barlines
    part.push(
      `<line x1="${barX}" y1="${top}" x2="${barX}" y2="${bottom}" stroke="${INK}" stroke-width="1.3"/>`,
    );

    // dynamics: below everything else in the bar, so a low note never hides them
    const lowest = Math.max(
      bottom,
      ...events.map((e) => (e.note ? yForNote(e.note.letter, e.note.octave, bottom) : 0)),
    );
    const dynY = Math.max(bottom + 34, lowest + 26);
    const firstWithDynamic = events.find((e) => e.dynamic);
    if (firstWithDynamic) {
      part.push(
        `<text class="score-dyn" x="${xOf(firstWithDynamic)}" y="${dynY}" font-size="16" text-anchor="middle">${firstWithDynamic.dynamic}</text>`,
      );
    }
    if (passage.swell && passage.swell.bar === bar) {
      part.push(
        `<text class="score-dyn" x="${barX + barWidth * 0.35}" y="${dynY}" font-size="13" font-style="italic">cresc.</text>`,
      );
    }

    // beams first, so stems can be drawn to the beam line
    const groups = beamGroups(events, beat);
    const beamOf = new Map();
    groups.forEach((group, gi) => {
      const ups = group.map((e) => stemUp(e.note.letter, e.note.octave));
      const up = ups.filter(Boolean).length >= ups.length / 2;
      const ys = group.map((e) => yForNote(e.note.letter, e.note.octave, bottom));
      // A beam that hangs far below the staff would run into the dynamics and the
      // system beneath, so its depth is capped (stems shorten to meet it).
      const beamY = up
        ? Math.min(...ys) - STEM
        : Math.min(Math.max(...ys) + STEM, bottom + 18);
      group.forEach((e) => beamOf.set(e, { beamY, up, gi }));
      const stemX = (e) => xOf(e) + (up ? 5.4 : -5.4);
      part.push(
        `<line x1="${stemX(group[0])}" y1="${beamY}" ` +
          `x2="${stemX(group[group.length - 1])}" y2="${beamY}" ` +
          `stroke="${INK}" stroke-width="${BEAM}" stroke-linecap="butt"/>`,
      );
      // sixteenths carry a second beam, offset toward the note heads
      const offset = up ? BEAM + 3.4 : -(BEAM + 3.4);
      for (const run of sixteenthRuns(group)) {
        part.push(
          `<line x1="${stemX(run[0])}" y1="${beamY + offset}" ` +
            `x2="${stemX(run[run.length - 1])}" y2="${beamY + offset}" ` +
            `stroke="${INK}" stroke-width="${BEAM}" stroke-linecap="butt"/>`,
        );
      }
    });

    for (const event of events) {
      const x = xOf(event);

      if (event.rest) {
        part.push(restGlyph(x, top + 2 * LINE_GAP, event.dur, MUTED));
        continue;
      }
      if (!event.note) continue;

      const y = yForNote(event.note.letter, event.note.octave, bottom);
      const up = stemUp(event.note.letter, event.note.octave);
      const hollow = event.dur >= 8;

      part.push(ledgerLines(event.note.letter, event.note.octave, x, bottom));

      if (event.accidental) {
        part.push(accidental(event.note.alter, x - 2.4 * LINE_GAP, y));
      }

      const beam = beamOf.get(event);
      const stemX = up ? x + 5.2 : x - 5.2;
      const stemEnd = beam ? beam.beamY : up ? y - STEM : y + STEM;
      // a stem is drawn for everything but a whole note and a beamed eighth
      if (!(event.dur >= 16)) {
        part.push(
          `<line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${stemEnd}" stroke="${INK}" stroke-width="1.35" stroke-linecap="round"/>`,
        );
      }
      if (event.dur <= 2 && !beam) {
        // A lone eighth or sixteenth gets a filled flag off the end of the stem,
        // curling back toward the note head. Drawn as a shape, not a stroke: a
        // hairline hook is what made these look shrivelled.
        const dir = up ? 1 : -1;
        const tip = stemEnd + dir * FLAG;
        part.push(
          `<path d="M${stemX} ${stemEnd} C${stemX + 8} ${stemEnd + dir * 5} ${stemX + 8.5} ${stemEnd + dir * 14} ${stemX + 3.5} ${tip} ` +
            `C${stemX + 5} ${stemEnd + dir * 13} ${stemX + 3.5} ${stemEnd + dir * 8} ${stemX} ${stemEnd + dir * 5} Z" ` +
            `fill="${INK}"/>`,
        );
        if (event.dur === 1) {
          part.push(
            `<path d="M${stemX} ${stemEnd + dir * 8} C${stemX + 7} ${stemEnd + dir * 12} ${stemX + 7.5} ${stemEnd + dir * 19} ${stemX + 3} ${stemEnd + dir * 24} ` +
              `C${stemX + 4.5} ${stemEnd + dir * 19} ${stemX + 3} ${stemEnd + dir * 15} ${stemX} ${stemEnd + dir * 12} Z" ` +
              `fill="${INK}"/>`,
          );
        }
      }

      part.push(head(x, y, { hollow }));

      // dot
      if (event.dur === 6 || event.dur === 12 || event.dur === 3) {
        const onLine = indexOf(event.note.letter, event.note.octave) % 2 === 0;
        part.push(`<circle cx="${x + 10.5}" cy="${y - (onLine ? 4.5 : 1.5)}" r="1.9" fill="${INK}"/>`);
      }

      // articulations
      if (event.mark === 'staccato') {
        part.push(`<circle cx="${x}" cy="${up ? y + HEAD_RY + 7 : y - HEAD_RY - 7}" r="2.2" fill="${INK}"/>`);
      } else if (event.mark === 'accent') {
        const ay = up ? y + HEAD_RY + 5 : y - HEAD_RY - 5;
        part.push(
          `<path d="M${x - 5} ${ay} L${x + 5} ${ay} L${x} ${ay + (up ? 5 : -5)} Z" fill="${INK}" transform="${up ? '' : `rotate(180 ${x} ${ay})`}"/>`,
        );
      }
    }
  }

  // closing barline
  part.push(
    `<line x1="${WIDTH - RIGHT}" y1="${top}" x2="${WIDTH - RIGHT}" y2="${bottom}" stroke="${INK}" stroke-width="1.4"/>`,
  );

  return part.join('');
}

/**
 * The whole passage: two systems of four bars.
 * `tempoText` is a localised string such as "♩ = 60"; pass '' to omit it.
 */
export function renderScore(passage, { tempoText = '', ariaLabel = 'Sight-reading passage' } = {}) {
  const height = TOP_PAD + 4 * LINE_GAP + SYSTEM_GAP + 4 * LINE_GAP + 34;
  const parts = [
    `<svg class="score" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${ariaLabel}">`,
    drawSystem(passage, 0, BARS_PER_SYSTEM, TOP_PAD, {
      timeSignature: true,
      tempoText,
      showTempo: Boolean(tempoText),
    }),
    drawSystem(passage, BARS_PER_SYSTEM, BARS_PER_SYSTEM * 2, TOP_PAD + SYSTEM_GAP, {
      timeSignature: false,
      tempoText: '',
      showTempo: false,
    }),
    '</svg>',
  ];
  return parts.join('');
}
