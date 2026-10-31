// score.js — eight bars of real notation, in the app's own hand.
//
// staff.js draws a scale: one line, no rhythm. Sight reading needs barlines, note
// values, beams, rests, dots, accidentals, articulations, dynamics and a tempo
// mark, and it needs to fit a phone, so it prints as two systems of four bars.
//
// It borrows staff.js's geometry and ink so the two screens look like siblings.

import { STAFF_GEOM, accidentalAt } from './staff.js?v=202610310305';
import { CLEF_PATH } from './clef.js?v=202610310305';

import { beatLength } from './sightreading.js?v=202610310305';

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
    out.push(`<line x1="${x - 9.5}" y1="${y}" x2="${x + 9.5}" y2="${y}" stroke="#c3b49d" stroke-width="1.15"/>`);
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
    // quarter rest — a vertical zigzag with a hook at the foot, which is what
    // the eye is looking for; a straight zigzag reads as the digit 3.
    return (
      `<path d="M${x + 1.5} ${y - 12.5} C${x - 3} ${y - 7} ${x + 3.5} ${y - 3.5} ${x - 1} ${y + 2} ` +
      `C${x + 3} ${y + 5.5} ${x + 1.5} ${y + 9} ${x - 3.5} ${y + 11}" ` +
      `fill="none" stroke="${colour}" stroke-width="2.9" stroke-linecap="round"/>`
    );
  }
  // Eighth rest — the "7" every player knows: a bulb with a sickle blade
  // leaning down and left to a sharp point. Drawn as a filled shape rather than
  // a stroke, because a constant-width stroke reads as a slash with a dot on it.
  return (
    `<circle cx="${x + 2.4}" cy="${y - 10.6}" r="3.0" fill="${colour}"/>` +
    `<path d="M${x + 1.8} ${y - 8.4} ` +
    `C${x + 3.0} ${y - 2.0} ${x + 0.8} ${y + 3.6} ${x - 4.8} ${y + 6.8} ` +
    `C${x - 3.0} ${y + 3.0} ${x - 2.2} ${y - 1.6} ${x - 1.2} ${y - 7.2} Z" ` +
    `fill="${colour}"/>`
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

/** Three notes in the space of two — an eighth-note triplet. */
function isTriplet(group) {
  return group.length === 3 && group.every((e) => Math.abs(e.dur - 4 / 3) < 0.01);
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
  part.push(`<g stroke="#c3b49d" stroke-width="1.15" stroke-linecap="round">`);
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
        accidentalAt(passage.key.fifths > 0 ? 1 : -1, sigX + i * 16, yForNote(letter, octave, bottom)),
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
      `<text class="score-time" x="${cursor}" y="${midY - 2}" font-size="31" text-anchor="middle">${num}</text>`,
      `<text class="score-time" x="${cursor}" y="${midY + 24}" font-size="31" text-anchor="middle">${den}</text>`,
    );
    cursor += 30;
  }

  // tempo mark
  if (showTempo && tempoText) {
    part.push(
      `<text class="score-tempo" x="${cursor + 6}" y="${top - 18}" font-size="17">${tempoText}</text>`,
    );
  }

  const musicLeft = cursor + 26;
  const musicWidth = WIDTH - RIGHT - musicLeft;
  const barWidth = musicWidth / (barTo - barFrom);
  const inset = 12;

  const beat = beatLength(passage.meter);

  /**
   * Horizontal positions for one bar: time first, then a floor on the gap so a
   * note never lands on the accidental in front of it.
   *
   * The floor is generous; if it would push the bar past its width, it is relaxed
   * step by step rather than scaling the finished bar back — scaling re-creates
   * the very collision the floor was there to prevent.
   */
  function positions(events, barX) {
    const x0 = barX + inset;
    const span = barWidth - inset - 8;
    const limit = barX + barWidth - 9;

    for (const allowance of [22, 16, 11, 6, 0]) {
      const xs = new Map();
      let prev = null;
      for (const e of events) {
        let x = x0 + (e.start / passage.perBar) * span;
        const gap = 16 + (e.accidental ? allowance : 0);
        if (prev != null && x - prev < gap) x = prev + gap;
        xs.set(e, x);
        prev = x;
      }
      if (prev == null || prev <= limit) return xs;
    }

    // pathological bar: plain time positions, which at least stay inside the bar
    const xs = new Map();
    for (const e of events) xs.set(e, x0 + (e.start / passage.perBar) * span);
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

    // Beam geometry first: the dynamics are placed below the deepest beam, so a
    // beamed group can never sit on top of an mf.
    const groups = beamGroups(events, beat);
    const beamOf = new Map();
    let deepest = bottom;

    for (const group of groups) {
      const ups = group.map((e) => stemUp(e.note.letter, e.note.octave));
      const up = ups.filter(Boolean).length >= ups.length / 2;
      const ys = group.map((e) => yForNote(e.note.letter, e.note.octave, bottom));
      const xs = group.map((e) => xOf(e));

      // The beam follows the shape of the group (the interval between its first
      // and last note, gently), then is slid until it clears every stem by at
      // least three and a half spaces. A flat beam on notes far apart leaves the
      // high note with a stub of a stem.
      const span = Math.max(1, Math.abs(xs[xs.length - 1] - xs[0]));
      const contour = ys[ys.length - 1] - ys[0];
      const slope = Math.max(-0.3, Math.min(0.3, contour / span));

      const ends = ys.map((y, i) => (up ? y - STEM : y + STEM) - slope * (xs[i] - xs[0]));
      const anchor = up ? Math.min(...ends) : Math.max(...ends);
      const at = (event) => anchor + slope * (xOf(event) - xs[0]);

      deepest = Math.max(deepest, ...group.map((e) => at(e)));
      group.forEach((e) => beamOf.set(e, { at, up }));
    }

    // dynamics: below everything else in the bar
    const lowest = Math.max(
      bottom,
      ...events.map((e) => (e.note ? yForNote(e.note.letter, e.note.octave, bottom) : 0)),
    );
    const dynY = Math.max(bottom + 34, lowest + 26, deepest + 26);
    const firstWithDynamic = events.find((e) => e.dynamic);
    if (firstWithDynamic) {
      part.push(
        `<text class="score-dyn" x="${xOf(firstWithDynamic)}" y="${dynY}" font-size="19" text-anchor="middle">${firstWithDynamic.dynamic}</text>`,
      );
    }
    if (passage.swell && passage.swell.bar === bar) {
      part.push(
        `<text class="score-dyn" x="${barX + barWidth * 0.35}" y="${dynY}" font-size="15" font-style="italic">cresc.</text>`,
      );
    }

    groups.forEach((group) => {
      const beam = beamOf.get(group[0]);
      const stemX = (e) => xOf(e) + (beam.up ? 5.4 : -5.4);
      const first = group[0];
      const last = group[group.length - 1];
      part.push(
        `<line x1="${stemX(first)}" y1="${beam.at(first)}" ` +
          `x2="${stemX(last)}" y2="${beam.at(last)}" ` +
          `stroke="${INK}" stroke-width="${BEAM}" stroke-linecap="butt"/>`,
      );
      // sixteenths carry a second beam, offset toward the note heads
      const offset = beam.up ? BEAM + 3.6 : -(BEAM + 3.6);
      for (const run of sixteenthRuns(group)) {
        part.push(
          `<line x1="${stemX(run[0])}" y1="${beam.at(run[0]) + offset}" ` +
            `x2="${stemX(run[run.length - 1])}" y2="${beam.at(run[run.length - 1]) + offset}" ` +
            `stroke="${INK}" stroke-width="${BEAM}" stroke-linecap="butt"/>`,
        );
      }

      // A triplet gets its number. It needs no bracket: the beam has already
      // gathered the three notes, and a bracket on top of a beam is the one thing
      // engravers never print.
      if (isTriplet(group)) {
        const x1 = xOf(first);
        const x2 = xOf(last);
        const by = beam.at(first) + (beam.up ? -12 : 12);
        part.push(
          `<text class="score-tuplet" x="${(x1 + x2) / 2}" y="${by + (beam.up ? 0 : 10)}" ` +
            `font-size="15" font-style="italic" text-anchor="middle">3</text>`,
        );
      }
    });

    for (const event of events) {
      const x = xOf(event);

      if (event.rest) {
        part.push(restGlyph(x, top + 2 * LINE_GAP, event.dur, INK));
        continue;
      }
      if (!event.note) continue;

      const y = yForNote(event.note.letter, event.note.octave, bottom);
      const beam = beamOf.get(event);
      // Inside a beamed group the *group's* direction wins for everything — stem
      // side, articulations and all. A note whose own direction disagreed was
      // drawn with its stem on the wrong side of the head, which is what made
      // those pairs look mutated.
      const up = beam ? beam.up : stemUp(event.note.letter, event.note.octave);
      const hollow = event.dur >= 8;

      part.push(ledgerLines(event.note.letter, event.note.octave, x, bottom));

      if (event.accidental) {
        part.push(accidentalAt(event.note.alter, x - 2 * LINE_GAP, y));
      }

      const stemX = up ? x + 5.2 : x - 5.2;
      const stemEnd = beam ? beam.at(event) : up ? y - STEM : y + STEM;
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
        // The hook is drawn as an outline: a wide sweep out from the stem, then a
        // tighter curve back in, which is what gives a flag its curl rather than
        // a narrow sliver.
        const flag = (dy) => {
          const y0 = stemEnd + dir * dy;
          const tip = y0 + dir * FLAG;
          return (
            `<path d="M${stemX} ${y0} ` +
            `C${stemX + 10} ${y0 + dir * 4} ${stemX + 12} ${y0 + dir * 15} ${stemX + 6.5} ${tip} ` +
            `C${stemX + 9} ${y0 + dir * 15} ${stemX + 7} ${y0 + dir * 9} ${stemX} ${y0 + dir * 5.5} Z" ` +
            `fill="${INK}"/>`
          );
        };
        part.push(flag(0));
        if (event.dur === 1) part.push(flag(10));
      }

      part.push(head(x, y, { hollow }));

      // dot
      if (event.dur === 6 || event.dur === 12 || event.dur === 3) {
        // The dot belongs in the middle of the space beside the head; a note
        // sitting on a line takes its dot one step away, or it reads as a smudge
        // on the line.
        const onLine = indexOf(event.note.letter, event.note.octave) % 2 === 0;
        part.push(
          `<circle cx="${x + 10.8}" cy="${y - (onLine ? STEPS : 0)}" r="2.05" fill="${INK}"/>`,
        );
      }

      // articulations
      if (event.mark === 'staccato') {
        part.push(`<circle cx="${x}" cy="${up ? y + HEAD_RY + 7 : y - HEAD_RY - 7}" r="2.2" fill="${INK}"/>`);
      } else if (event.mark === 'accent') {
        // A wedge, not a triangle: an accent points along the note, and drawing it
        // as a triangle (then turning it over for down-stems) read as a ▽.
        const ay = up ? y + HEAD_RY + 9 : y - HEAD_RY - 9;
        part.push(
          `<path d="M${x - 5.5} ${ay - 4} L${x + 5.5} ${ay} L${x - 5.5} ${ay + 4}" ` +
            `fill="none" stroke="${INK}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`,
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
