// score.js — eight bars of real notation, in the app's own hand.
//
// staff.js draws a scale: one line, no rhythm. Sight reading needs barlines, note
// values, beams, rests, dots, accidentals, articulations, dynamics and a tempo
// mark, and it needs to fit a phone, so it prints as two systems of four bars.
//
// It borrows staff.js's geometry and ink so the two screens look like siblings.

import { STAFF_GEOM } from './staff.js?v=202610310114';
import { CLEF_PATH } from './clef.js?v=202610310114';
import { accidentalGlyph } from './music.js?v=202610310114';
import { beatLength } from './sightreading.js?v=202610310114';

const { LINE_GAP, STEPS, E4, INK, MUTED, CLEF_BBOX, yForNote, indexOf } = STAFF_GEOM;

const WIDTH = 1000;
const LEFT = 16;
const RIGHT = 16;
const SYSTEM_GAP = 132;
const TOP_PAD = 54;
const CLEF_SCALE = (LINE_GAP * 7.1) / CLEF_BBOX.h;
const CLEF_WIDTH = CLEF_BBOX.w * CLEF_SCALE;
const BARS_PER_SYSTEM = 4;

const HEAD_RX = 5.7;
const HEAD_RY = 4.2;
const STEM = 30;
const BEAM = 3.6;

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
  // eighth rest — a dot with a short hook
  return (
    `<circle cx="${x + 2}" cy="${y - 7.5}" r="2.6" fill="${colour}"/>` +
    `<path d="M${x + 2} ${y - 7.5} q3.6 -2.4 1.2 -6" fill="none" stroke="${colour}" stroke-width="1.9" stroke-linecap="round"/>`
  );
}

/* ── Beams ─────────────────────────────────────────────────────────────── */

/** Groups of consecutive eighth notes inside one beat. */
function beamGroups(events, beat) {
  const groups = [];
  let group = [];
  const close = () => {
    if (group.length > 1) groups.push(group);
    group = [];
  };
  for (const e of events) {
    if (e.rest || e.dur !== 2) {
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
  const sigX = clefX + CLEF_WIDTH + 8;
  if (sigCount) {
    const symbol = passage.key.fifths > 0 ? '\u266F' : '\u266D';
    // Same placement table as staff.js — one source of truth, so a key signature
    // can never land on the wrong line here.
    const order = passage.key.fifths > 0 ? STAFF_GEOM.SHARP_POSITIONS : STAFF_GEOM.FLAT_POSITIONS;
    for (let i = 0; i < sigCount; i++) {
      const [letter, octave] = order[i];
      part.push(
        `<text class="score-acc" x="${sigX + i * 12}" y="${yForNote(letter, octave, bottom) + 5.5}" font-size="16">${symbol}</text>`,
      );
    }
  }

  // time signature, first system only
  let cursor = sigX + sigCount * 12 + (sigCount ? 16 : 12);
  if (timeSignature) {
    const [num, den] = passage.meter.split('/');
    const midY = top + 2 * LINE_GAP;
    part.push(
      `<text class="score-time" x="${cursor}" y="${midY - 2}" font-size="19" text-anchor="middle">${num}</text>`,
      `<text class="score-time" x="${cursor}" y="${midY + 17}" font-size="19" text-anchor="middle">${den}</text>`,
    );
    cursor += 22;
  }

  // tempo mark
  if (showTempo && tempoText) {
    part.push(
      `<text class="score-tempo" x="${cursor + 6}" y="${top - 16}" font-size="13">${tempoText}</text>`,
    );
  }

  const musicLeft = cursor + 26;
  const musicWidth = WIDTH - RIGHT - musicLeft;
  const barWidth = musicWidth / (barTo - barFrom);
  const inset = 12;

  const xFor = (event, barIndex) => {
    const barX = musicLeft + (barIndex - barFrom) * barWidth;
    return barX + inset + (event.start / passage.perBar) * (barWidth - inset - 8);
  };

  const beat = beatLength(passage.meter);

  for (let bar = barFrom; bar < barTo; bar++) {
    const events = passage.bars[bar];
    const barX = musicLeft + (bar - barFrom) * barWidth;

    // barlines
    part.push(
      `<line x1="${barX}" y1="${top}" x2="${barX}" y2="${bottom}" stroke="${INK}" stroke-width="1.1"/>`,
    );

    // dynamics and swell
    const firstWithDynamic = events.find((e) => e.dynamic);
    if (firstWithDynamic) {
      part.push(
        `<text class="score-dyn" x="${xFor(firstWithDynamic, bar)}" y="${bottom + 24}" font-size="15" text-anchor="middle">${firstWithDynamic.dynamic}</text>`,
      );
    }
    if (passage.swell && passage.swell.bar === bar) {
      part.push(
        `<text class="score-dyn" x="${barX + barWidth * 0.35}" y="${bottom + 24}" font-size="12" font-style="italic">cresc.</text>`,
      );
    }

    // beams first, so stems can be drawn to the beam line
    const groups = beamGroups(events, beat);
    const beamOf = new Map();
    groups.forEach((group, gi) => {
      const ups = group.map((e) => stemUp(e.note.letter, e.note.octave));
      const up = ups.filter(Boolean).length >= ups.length / 2;
      const ys = group.map((e) => yForNote(e.note.letter, e.note.octave, bottom));
      const beamY = up ? Math.min(...ys) - STEM : Math.max(...ys) + STEM;
      group.forEach((e) => beamOf.set(e, { beamY, up, gi }));
      part.push(
        `<line x1="${xFor(group[0], bar) + (up ? 5.4 : -5.4)}" y1="${beamY}" ` +
          `x2="${xFor(group[group.length - 1], bar) + (up ? 5.4 : -5.4)}" y2="${beamY}" ` +
          `stroke="${INK}" stroke-width="${BEAM}" stroke-linecap="butt"/>`,
      );
    });

    for (const event of events) {
      const x = xFor(event, bar);

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
        const sig = accidentalGlyph(event.note.alter);
        part.push(
          `<text class="score-acc" x="${x - 21}" y="${y + 5.5}" font-size="16">${sig || '\u266E'}</text>`,
        );
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
      if (event.dur === 2 && !beam) {
        // A lone eighth gets a flag: a short hook off the end of the stem, always
        // curling back toward the note head.
        const dy = up ? 11 : -11;
        part.push(
          `<path d="M${stemX} ${stemEnd} q7 ${up ? 3 : -3} 5 ${dy}" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>`,
        );
      }

      part.push(head(x, y, { hollow }));

      // dot
      if (event.dur === 6 || event.dur === 12 || event.dur === 3) {
        const onLine = indexOf(event.note.letter, event.note.octave) % 2 === 0;
        part.push(`<circle cx="${x + 10.5}" cy="${y - (onLine ? 4.5 : 1.5)}" r="1.9" fill="${INK}"/>`);
      }

      // articulations
      if (event.mark === 'staccato') {
        part.push(`<circle cx="${x}" cy="${up ? y + HEAD_RY + 7 : y - HEAD_RY - 7}" r="1.9" fill="${INK}"/>`);
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
