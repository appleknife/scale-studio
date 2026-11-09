// score.js — eight bars of real notation, in the app's own hand.
//
// staff.js draws a scale: one line, no rhythm. Sight reading needs barlines, note
// values, beams, rests, dots, accidentals, articulations, dynamics and a tempo
// mark, and it needs to fit a phone, so it prints as two systems of four bars.
//
// It borrows staff.js's geometry and ink so the two screens look like siblings.

import { STAFF_GEOM, accidentalAt } from './staff.js?v=202611091750';
import { CLEF_PATH } from './clef.js?v=202611091750';
import { intonationLane } from './intonation.js?v=202611091750';

import { beatLength } from './sightreading.js?v=202611091750';

const { LINE_GAP, STEPS, E4, INK, MUTED, CLEF_BBOX, yForNote, indexOf, stemUp } = STAFF_GEOM;

const WIDTH = 1000;
// Two bars to a system, for a phone. Same bar width as the four-bar layout, so
// the drawing is simply narrower: shown at the width of a phone card that makes
// every note — and every flag — about twice the size it would be squeezed to.
const NARROW_WIDTH = 520;
// The closest two systems may sit. The gap has to hold two things at once — the
// dynamic marking under one system and the tallest music of the one below it —
// and how big those are is a property of the music, so renderScore measures each
// system and widens the gap where it has to. This is the floor, for plain music.
const NARROW_PITCH = 104;
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
// Head proportions from a display-weight eighth note the app was matched
// against: 1.56 wide to tall, leaning 24°. The engraved default is nearer 1.33
// at 18°, which reads thinner at phone size than the rest of this design.
const HEAD_RX = 7.1;
const HEAD_RY = 4.55;
const HEAD_ANGLE = -24;
const STEM = 3.5 * LINE_GAP;
const BEAM = 0.48 * LINE_GAP;

/**
 * How far an articulation runs past the note head, on the side away from the
 * stem — which is the side the slur and the dynamic marking live on. An accent
 * is a wedge whose point sits nine units out and four more wide; a staccato dot
 * is seven out with a 2.2 radius. The slur, the dynamics and the drawing all ask
 * this one function, or one of them gets drawn through another.
 */
const markReach = (event) =>
  event.mark === 'accent' ? HEAD_RY + 13 : event.mark === 'staccato' ? HEAD_RY + 9.5 : 0;

// The eighth note's flag, traced off the mark the app has used since its first
// version — the note in the header and on the home screen. Drawn as two edges
// rather than as a stroke of changing width, because the edges are not parallel:
// the flag leaves the tip of the stem as a wedge welded to it, bows out to its
// widest about two spaces down, turns, and then narrows to a fine point that
// trails almost to the note head. A centreline with a width cannot make that
// shape — it made a fin, thick at the tip and blunt at the end, while the
// engraved flag has its weight in the middle of the curve and a hairline tail.
//
// Points are [across, down] in staff units, measured from the middle of the stem
// and the tip of the stem: the outer edge on the way down, the inner edge on the
// way back. The inner edge starts under the stem, so the join is one solid piece
// of ink rather than a sliver beside it.
const FLAG_OUTER = [
  [0.55, 0.0],
  [0.75, 1.6],
  [0.95, 3.0],
  [1.2, 4.2],
  [1.6, 5.4],
  [2.2, 6.6],
  [3.0, 7.7],
  [3.95, 8.7],
  [5.0, 10.2],
  [6.3, 11.4],
  [7.3, 12.6],
  [8.3, 14.0],
  [9.2, 15.1],
  [10.05, 16.6],
  [10.75, 18.2],
  [11.3, 19.6],
  [11.5, 20.8],
  [11.5, 24.5],
  [11.35, 25.4],
  [11.1, 26.5],
  [10.8, 27.5],
  [10.45, 28.5],
  [10.05, 29.8],
  [9.6, 30.8],
  [9.2, 31.7],
  [8.8, 32.6],
  [8.45, 33.4],
  [8.1, 34.2],
  [7.9, 34.9],
];
// How far the tail of the hook is from the tip of the stem, and how far down a
// down-stem note a flag may reach before it starts crowding the note head. The
// reach is set from the head's ellipse: at 32.2 the tail keeps a clear half-head
// of air below a head whose centre sits 38.5 down the stem.
const FLAG_REACH = 34.9;
const DOWN_ROOM = 32.2;
const FLAG_INNER = [
  [0.4, 0.0],
  [0.4, 6.0],
  [0.4, 12.4],
  [2.0, 12.9],
  [3.3, 13.4],
  [4.5, 14.0],
  [5.4, 14.6],
  [6.1, 15.0],
  [6.6, 15.4],
  [7.15, 15.8],
  [7.45, 16.1],
  [7.75, 16.6],
  [8.05, 16.9],
  [8.3, 17.2],
  [8.6, 17.5],
  [8.9, 18.1],
  [9.2, 18.7],
  [9.5, 19.2],
  [9.75, 20.1],
  [10.0, 21.0],
  [10.3, 22.4],
  [10.55, 24.2],
  [10.6, 25.2],
  [10.4, 26.0],
  [10.35, 27.0],
  [10.05, 27.9],
  [10.0, 28.6],
  [9.75, 29.1],
  [9.5, 29.8],
  [9.2, 30.5],
  [8.9, 31.6],
  [8.6, 32.3],
  [8.4, 33.0],
  [8.1, 33.6],
  [7.9, 34.9],
];

// The mark's ink in the same units: a little wider and taller than the shapes
// strictly need, so the round ends of the stem and the flag's tail are not
// clipped by the box the icon is scaled from.
const MARK_BOX = { x: -7.3, y: -41.2, w: 25.4, h: 46.6 };



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
    return `<ellipse cx="${x}" cy="${y}" rx="${HEAD_RX}" ry="${HEAD_RY}" fill="none" stroke="${colour}" stroke-width="1.7" transform="rotate(${HEAD_ANGLE} ${x} ${y})"/>`;
  }
  return `<ellipse cx="${x}" cy="${y}" rx="${HEAD_RX}" ry="${HEAD_RY}" fill="${colour}" transform="rotate(${HEAD_ANGLE} ${x} ${y})"/>`;
}

/* ── Rests ─────────────────────────────────────────────────────────────── */

const fmt = (v) => v.toFixed(2);

/**
 * A path fragment through `list`: a Catmull-Rom spline (one cubic per span) so
 * a hand-placed handful of points reads as a curve, or straight segments for a
 * glyph whose corners are sharp by nature — a rest's beak and foot.
 */
function trace(list, round = true) {
  if (!round) return list.map((p, i) => `${i ? 'L' : 'M'}${fmt(p[0])} ${fmt(p[1])}`).join(' ');
  const at = (i) => list[Math.min(list.length - 1, Math.max(0, i))];
  let d = `M${fmt(list[0][0])} ${fmt(list[0][1])}`;
  for (let i = 0; i < list.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d +=
      ` C${fmt(p1[0] + (p2[0] - p0[0]) / 6)} ${fmt(p1[1] + (p2[1] - p0[1]) / 6)}` +
      ` ${fmt(p2[0] - (p3[0] - p1[0]) / 6)} ${fmt(p2[1] - (p3[1] - p1[1]) / 6)}` +
      ` ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
}

/** Two edges closed into one filled shape: out along the first, back along the second. */
function closedOutline(edgeOut, edgeBack) {
  return `${trace(edgeOut)} ${trace(edgeBack).replace('M', 'L')} Z`;
}

/**
 * The flag hanging off a stem that ends at (`stemX`, `stemEnd`). `toward` is +1
 * when the note head is below the tip and -1 when it is above, so a down-stem
 * note's flag turns upward; `shift` drops the shape further down the stem, which
 * is how a sixteenth note gets its second flag.
 */
function flagPath(stemX, stemEnd, toward, shift = 0) {
  // A flag always hangs to the right of its stem. On an up stem the note head is
  // to the *left* of that stem, so the hook can trail most of the stem and still
  // pass beside the head. On a down stem the head is on the right — the same side
  // the flag hangs on — and the full length puts the tail almost exactly on the
  // head's edge: the gap between stem and flag closes into a knot around the
  // head, and a lone sixteenth lands its second flag squarely on it. So down a
  // stem a flag stops where there is still air: its tail may not come closer to
  // the head than DOWN_ROOM, which is measured against the head's own ellipse.
  const length = toward > 0 ? 1 : Math.min(1, (DOWN_ROOM - shift) / FLAG_REACH);
  const at = ([x, t]) => [stemX + x, stemEnd + toward * (t * length + shift)];
  // Out along the outer edge, back along the inner one — the inner edge is
  // written top-to-bottom like the outer, so it has to be walked backwards or
  // the outline crosses itself and the fill tears a hole in the flag.
  return closedOutline(FLAG_OUTER.map(at), FLAG_INNER.map(at).reverse());
}

/**
 * The quarter rest, traced edge for edge off the printed glyph the teacher sent.
 *
 * The points are in that reference's own pixels — a 59 by 178 box — because that
 * is how it was read off the image, row by row. Describing it instead as a
 * stroked curve with one width at every point turned it into a wavy "S": the
 * printed rest is a calligraphic zigzag whose belly swings nearly the full width
 * of the box, whose waist pinches to a fifth of it, and whose foot runs out to a
 * needle on the right before doubling back left and curling down to a point. The
 * points below are the outline, walked clockwise, with the waist's inward notch
 * and the gap under the foot's needle where the glyph has them.
 */
const QUARTER_REST = {
  box: [59, 178],
  outline: [
    [0.4, 135], [2, 127.2], [10.2, 118], [17.4, 115],
    [27.6, 115], [32.3, 117], [35, 116.6], [2, 75.7],
    [2.1, 74.2], [17.9, 57.8], [21, 51.8], [23, 42.6],
    [22, 29.3], [19, 20.2], [11.9, 7.2], [8, 2.7],
    [8.2, 1.1], [11.6, 0], [17.9, 7.2], [20.1, 11.8],
    [25.9, 18.2], [39.1, 37.8], [41.9, 40.2], [49.1, 51.8],
    [52, 54.2], [52, 56.8], [49.9, 59.8], [30.1, 81.2],
    [28, 86.3], [28, 91.6], [33, 102.8], [39.1, 111.8],
    [41.9, 114.2], [42.1, 115.8], [59, 137.6], [56.3, 138],
    [46.6, 135], [32.4, 135], [25.2, 138], [22.1, 141.2],
    [20, 147.3], [20, 152.7], [26, 167.8], [34, 176.2],
    [32.8, 178], [30.4, 178], [20.2, 171.9], [8.1, 159.8],
    [3, 151.8], [1, 145.7],
  ],
};

function quarterRest(x, y, colour) {
  // 2.6 spaces, centred on the middle line: the printed glyph reaches a third of
  // a space into the top space and hangs as far below the second line. At 2.15
  // it barely crossed the lines either side of the middle and read as a small
  // mark rather than a rest.
  const H = 2.6 * LINE_GAP;
  const [boxW, boxH] = QUARTER_REST.box;
  const W = (H * boxW) / boxH;
  const left = x - W / 2;
  const top = y - H / 2;
  const pts = QUARTER_REST.outline.map(([px, py]) => [
    left + (px / boxW) * W,
    top + (py / boxH) * H,
  ]);
  // Straight segments: every corner of this glyph is a real corner — the beak's
  // point, the waist's notch, the foot's needle — and a spline through them
  // rounds all three away.
  return `<path d="${trace(pts, false)} Z" fill="${colour}"/>`;
}

/**
 * The eighth rest, traced off the printed one.
 *
 * Every number is a fraction of the glyph's own height H, measured from its top
 * left corner, so one table draws the glyph at any size. Four parts:
 *
 *  · a round bulb at the top left;
 *  · a stem that leans a good 15° from upright — far more than the upright bar
 *    this used to be, and half of why it read as a 9 rather than a rest;
 *  · a hook: a thin wedge that leaves the bulb's underside, sweeps up to the
 *    right and runs clean into the stem's own tip;
 *  · and the sliver of white between that hook and the stem, which is the whole
 *    glyph. Close it and the bulb becomes a comma on a stick; open it wider and
 *    a 9 appears beside a stick.
 */
const HOOKED_REST = {
  // Ink width in H, from the bulb's left edge to the top of the stem.
  width: 0.601,
  bulb: [0.1705, 0.1717, 0.1717],
  stem: { top: [0.5707, 0.0429], foot: [0.3081, 0.9899], half: 0.0315 },
  // The hook's outer edge, from its tip at the stem down and left into the bulb…
  hookOuter: [
    [0.545, 0.035], [0.515, 0.091], [0.495, 0.121], [0.475, 0.152],
    [0.449, 0.182], [0.419, 0.212], [0.364, 0.242], [0.313, 0.263],
    [0.255, 0.31], [0.17, 0.28],
  ],
  // …and its underside, from the stem's edge back down into the bulb. Both ends
  // finish *inside* the bulb — a hook that stops on its edge leaves a sliver of
  // tail sticking out under the ball, and the eye reads it as a beak.
  hookUnder: [
    [0.481, 0.263], [0.444, 0.273], [0.419, 0.288], [0.384, 0.303],
    [0.343, 0.318], [0.278, 0.333], [0.17, 0.28],
  ],
};

function hookedRest(x, y, colour) {
  // An eighth rest stands just under two spaces tall, which is what a printed one
  // measures. At 1.7 it read as a small mark rather than a rest.
  const H = 1.9 * LINE_GAP;
  const left = x - (HOOKED_REST.width * H) / 2;
  const top = y - H / 2;
  const at = ([u, v]) => [left + u * H, top + v * H];
  const { bulb, stem } = HOOKED_REST;

  const dot = ([cx, cy, r]) => {
    const [px, py] = at([cx, cy]);
    return `<circle cx="${fmt(px)}" cy="${fmt(py)}" r="${fmt(r * H)}" fill="${colour}"/>`;
  };

  // The stem is a bar of one width between its two ends, both cut square to its
  // own direction — a cut square to the staff instead leaves a slivery point at
  // the top where the hook runs into it.
  const [tx, ty] = at(stem.top);
  const [fx, fy] = at(stem.foot);
  const len = Math.hypot(fx - tx, fy - ty);
  const nx = ((ty - fy) / len) * stem.half * H;
  const ny = ((fx - tx) / len) * stem.half * H;
  const bar =
    `M${fmt(tx + nx)} ${fmt(ty + ny)} L${fmt(fx + nx)} ${fmt(fy + ny)} ` +
    `L${fmt(fx - nx)} ${fmt(fy - ny)} L${fmt(tx - nx)} ${fmt(ty - ny)} Z`;

  // Out along the hook's outer edge from the tip, back along its underside. The
  // underside ends inside the stem, so where the two cross is the notch — it is
  // never drawn, which is why it stays a hairline at every size.
  const hook = closedOutline(
    HOOKED_REST.hookOuter.map(at),
    HOOKED_REST.hookUnder.map(at).reverse(),
  );

  return (
    dot(bulb) + `<path d="${hook}" fill="${colour}"/>` + `<path d="${bar}" fill="${colour}"/>`
  );
}

/**
 * The sixteenth rest, traced edge for edge off the printed glyph the teacher
 * sent, the same way the quarter rest is.
 *
 * It is not the eighth rest with a second hook bolted on, which is what it was
 * drawn as until now: the printed one gives each of its two bulbs about a fifth
 * of the height where the eighth rest spends a third on its one, runs its stem
 * long and a little wider towards the foot, and hangs both hooks off that same
 * leaning line. Points are in the reference's own pixels, a 278 by 612 box.
 */
const SIXTEENTH_REST = {
  box: [278, 612],
  outline: [
    [0.4, 262], [3.1, 252.2], [12.1, 237.2], [18.2, 230.1],
    [27.2, 223.1], [37.2, 218.1], [52.4, 214], [67.6, 214],
    [76.6, 216], [89.8, 222.1], [101.9, 233.2], [107.9, 243.2],
    [121.1, 288.8], [127.2, 294.9], [138.6, 298], [147.8, 293.9],
    [164.9, 276.8], [177.9, 259.8], [187.9, 242.8], [227.9, 111.2],
    [189.6, 123], [154.6, 129], [125.4, 128], [109.2, 122.9],
    [94.2, 114.9], [78.1, 98.8], [70.1, 84.8], [67, 74.6],
    [68, 42.4], [75.1, 28.2], [85.2, 16.1], [102.2, 5.1],
    [121.4, 0], [140.6, 1], [155.8, 7.1], [170.9, 22.2],
    [177, 35.4], [186.1, 71.8], [192.2, 79.9], [198.4, 83],
    [208.6, 83], [216.8, 77.9], [231.9, 61.8], [258.2, 24.1],
    [264.4, 22], [271.6, 23], [278, 29.4], [127, 595.6],
    [122.8, 604.9], [108.6, 611], [97.4, 612], [84.2, 607.9],
    [77.1, 602.8], [77, 600.4], [88, 568.6], [90, 558.4],
    [100, 529.6], [162, 325.4], [158.4, 325], [120.6, 337],
    [93.6, 342], [61.4, 342], [42.2, 336.9], [21.2, 323.9],
    [8.1, 307.8], [3.1, 297.8], [0, 286.6],
  ],
};

function sixteenthRest(x, y, colour) {
  // 2.2 spaces: a printed sixteenth rest stands about a fifth taller than an
  // eighth rest and is a shade narrower, which is what its own box says.
  const H = 2.2 * LINE_GAP;
  const [boxW, boxH] = SIXTEENTH_REST.box;
  const W = (H * boxW) / boxH;
  const left = x - W / 2;
  const top = y - H / 2;
  const pts = SIXTEENTH_REST.outline.map(([px, py]) => [
    left + (px / boxW) * W,
    top + (py / boxH) * H,
  ]);
  return `<path d="${trace(pts, false)} Z" fill="${colour}"/>`;
}

function restGlyph(x, y, dur, colour) {
  // `y` is the middle line of the staff. A half rest sits *on* that line and
  // fills the space above it; a whole rest hangs from the fourth line into the
  // space below. They are the same block, and which line it touches is the only
  // thing that tells them apart — drawn straddling the middle line, a half rest
  // reads as either. A space is LINE_GAP and the block is half of one, which is
  // what a printed rest measures.
  const BLOCK = 5.5;
  const WIDTH = 14;
  if (dur >= 16) {
    return `<rect x="${x - WIDTH / 2}" y="${y + LINE_GAP}" width="${WIDTH}" height="${BLOCK}" fill="${colour}"/>`;
  }
  if (dur >= 8) {
    return `<rect x="${x - WIDTH / 2}" y="${y - BLOCK}" width="${WIDTH}" height="${BLOCK}" fill="${colour}"/>`;
  }
  if (dur >= 4) return quarterRest(x, y, colour);
  if (dur < 2) return sixteenthRest(x, y, colour);
  return hookedRest(x, y, colour);
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
    // A dotted eighth (three sixteenths) beams with the sixteenth that completes
    // its beat — that is the figure, and beamed is how it is printed.
    if (e.rest || e.dur > 3) {
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
      // A lone sixteenth still needs its second beam — as a stub. Leaving single
      // runs out is what made a sixteenth after a dotted eighth read as an eighth.
      if (run.length) runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

/* ── One system of four bars ───────────────────────────────────────────── */

function drawSystem(
  passage,
  barFrom,
  barTo,
  top,

  {
    timeSignature,
    tempoText,
    tempoMark = null,
    showTempo,
    final = false,
    width = WIDTH,
    ceiling = null,
    // The intonation lane: cents per sounding note for the whole passage, and
    // where this system starts in that list.
    intonation = null,
    intonationStart = 0,
  },
) {

  const part = [];
  const bottom = top + 4 * LINE_GAP;
  // Filled while the bars are drawn, used once below them.
  const marks = [];
  // The highest point any *music* reaches in this system — heads, stems, beams,
  // flags, marks, slurs. The tempo mark is printed over the first bar, and a bar
  // that opens high would otherwise be drawn through it.
  let musicTop = top;

  // staff lines
  part.push(`<g stroke="#c3b49d" stroke-width="1.15" stroke-linecap="round">`);
  for (let i = 0; i < 5; i++) {
    const y = top + i * LINE_GAP;
    part.push(`<line x1="${LEFT}" y1="${y}" x2="${width - RIGHT}" y2="${y}"/>`);
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

  // The tempo mark is emitted after the bars — see the end of this function —
  // because where it may sit depends on how high the music reaches.
  const tempoX = cursor + 6; 

  // Where the last bar's dynamic marking went, so the system above can keep a
  // rising slur clear of it — and so does the system below, which has to stay out
  // of the way of the *lowest* one, not the last bar's. A bar with a low note puts
  // its dynamic marking much further down than a bar that sits in the staff.
  let lastDynY = bottom + 34;

  const musicLeft = cursor + 26;
  const musicWidth = width - RIGHT - musicLeft;
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
  const ACCIDENTAL_HALF = 5.5;
  const leftOf = (e) => (e.accidental ? 22 + ACCIDENTAL_HALF : HEAD_RX);

  // The extra room a beat boundary gets, on top of the spacing curve — see
  // `layout`. Five is about a third of a sixteenth's own room: enough to read as
  // a break between groups, not enough to look like a missing beat.
  const GROUP_AIR = 5;

  /**
   * How far each event's ink runs right of the point it is drawn at. A lone
   * eighth or sixteenth has a flag sweeping a whole space past its stem; a
   * *beamed* one has no flag at all — the beam runs to its neighbour — and
   * treating the two alike pushed every sixteenth group clean out of its bar.
   * A dotted note reaches out too: the dot sits a step to the right.
   *
   * "Beamed" has to mean the beam groups actually drawn, not merely "has a short
   * note next door". An eighth at the end of a beat is followed by an eighth of
   * the next beat — short on both sides by duration, in two separate groups, and
   * so flagged. Allowance for a beam it never had left its flag hanging over the
   * following note head, which is what a level VI high passage caught.
   */
  function rights(events, beamed) {
    return events.map((e) => {
      // A rest's ink is a block 14 wide, so it reaches 7 either side of the point
      // it is set at — the same as a note head.
      if (!e || e.rest || !e.note) return 7;
      if (e.dur === 3 || e.dur === 6 || e.dur === 12) return 12.9;
      if (e.dur <= 2) {
        if (beamed.has(e)) return HEAD_RX;
        const up = STAFF_GEOM.stemUp(e.note.letter, e.note.octave);
        return up ? 5.2 + 11.7 : HEAD_RX;
      }
      return HEAD_RX;
    });
  }

  function positions(events, barX, beamed) {
    // The bar's usable width has to account for what actually sticks out of its
    // first and last event: an accidental hangs a long way left of its note, and
    // a flag a long way right of its stem. Without this, a flag at the end of a
    // bar reached into the next bar and met the sharp in front of its first note.
    const right = rights(events, beamed);
    const firstLeft = leftOf(events[0]);
    const lastRight = right[right.length - 1];
    const x0 = barX + Math.max(inset, firstLeft + 2);
    const limit = barX + barWidth - Math.max(8, lastRight + 2);
    const span = Math.max(24, limit - x0);
    // A note that fills a whole bar — a whole note, a dotted half in 3/4 — is set
    // in the middle of it, the way an engraver sets one. Measured from its beat
    // it sits hard against the barline, which reads as a mistake rather than as
    // a long note.
    const lone =
      events.length === 1 && events[0].start === 0 && events[0].dur >= passage.perBar;

    /**
     * The bar set with its notes at `squash` of their spaced positions.
     *
     * Time alone is not enough for a crowded bar: three quarters and a beat of
     * sixteenths take up a 4/4 bar by the clock, but four sixteenths need 48
     * units between them and the clock gives them 46. The run then spent its
     * floor budget and pushed the last note onto the barline — where the next
     * bar's first note is — so two note heads ended up touching. Squashing the
     * spaced positions (not the floors) hands the room to the short notes: the
     * long ones give up what they do not need.
     */
    const layout = (squash, allowance) => {
      // How much room each event takes, in units that are scaled onto the bar
      // afterwards. The clock is the wrong ruler: it gives a quarter four times
      // the room of a sixteenth, so a beat of sixteenths comes out as a dark
      // clump with the quarter after it a whole beat away — which is the part of
      // a written passage that is hard to read at sight. Engravers space by a
      // curve instead, `a + b·d^c` with c below 1: short notes get more than
      // their time is worth, because their heads, beams and flags are what the
      // eye is picking apart, and long notes give some of theirs back.
      //
      // The constant `a` is the "as a group" part: it is the same for every
      // event, so it swells the tightest spacing most. `GROUP_AIR` lands only
      // where one beat ends and the next begins, which is the gap a player needs
      // to see where a run of short notes stops.
      const room = (quarters) => 4 + 30 * Math.pow(quarters, 0.6);
      const weights = events.map((e, i) => {
        const next = events[i + 1];
        // Only a *following* note can need air in front of it; the bar's last
        // event has the barline after it, and giving it air too would pull it
        // away from the end of the bar.
        const endsBeat = next && Math.abs(next.start / beat - Math.round(next.start / beat)) < 1e-6;
        return room(e.dur / 4) + (endsBeat ? GROUP_AIR : 0);
      });
      const totalRoom = weights.reduce((a, b) => a + b, 0) || 1;

      const xs = new Map();
      let cum = 0;
      let prev = null;
      let prevEvent = null;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        let x = lone
          ? x0 + (barWidth - inset - 8) / 2
          : x0 + (cum / totalRoom) * span * squash;
        cum += weights[i];
        // Measured, not guessed: a rest's glyph hangs 6 units to the left of the
        // position it is given, and a flagged sixteenth sweeps 17 to the right of
        // its own. Sixteen is enough for two noteheads, but between a flag and a
        // rest it puts the two glyphs on top of each other — the one place a rest
        // gets pushed into a note it does not belong to. 29 is those two reaches
        // plus half a space of air.
        const tucked = e.rest && prevEvent && !prevEvent.rest && prevEvent.dur <= 2;
        // Two floors, whichever is stricter: the house spacing, and what these
        // two glyphs actually need so neither can be drawn on top of the other.
        // The allowance may relax when a bar is crowded; the ink floor may not —
        // relaxing it is exactly how a sharp ended up inside a flag.
        const inkFloor = i > 0 ? right[i - 1] + leftOf(e) + 4 : 0;
        const gap = Math.max(inkFloor, (tucked ? 29 : 16) + (e.accidental ? allowance : 0));
        if (prev != null && x - prev < gap) x = prev + gap;
        xs.set(e, x);
        prev = x;
        prevEvent = e;
      }
      return { xs, end: prev };
    };

    let tightest = null;
    // The largest squash that fits is the one used; 0 is the last resort, where
    // only the floors are left and every note sits at its neighbour's right.
    for (const squash of [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]) {
      for (const allowance of [22, 16, 11, 6, 0]) {
        const { xs, end } = layout(squash, allowance);
        tightest = xs;
        if (end == null || end <= limit) return xs;
      }
    }

    // A bar too crowded even at the tightest spacing. Keep the tightest layout
    // rather than falling back to plain beat positions: a note a few units past
    // the barline is a blemish, but a sharp drawn through a flag is a misreading.
    return tightest;
  }

  for (let bar = barFrom; bar < barTo; bar++) {
    const events = passage.bars[bar];
    const barX = musicLeft + (bar - barFrom) * barWidth;
    // The groups are worked out before the spacing now, because how much room a
    // note needs depends on whether the engraver will beam it or flag it.
    const groups = beamGroups(events, beat);
    const beamed = new Set();
    for (const group of groups) {
      if (group.length > 1) for (const e of group) beamed.add(e);
    }

    const xs = positions(events, barX, beamed);
    const xOf = (event) => xs.get(event);

    // Every note of the system, with where it was drawn, so the lane below can
    // sit under the note it is about.
    if (intonation) {
      for (const event of events) {
        if (event.rest || !event.note) continue;
        const value = intonation[intonationStart + marks.length];
        marks.push({ x: xs.get(event), cents: Number.isFinite(value) ? value : null });
      }
    }

    // Barlines go between bars, never in front of the first one. A line at the
    // opening of a system sits right after the clef and key signature and reads
    // as the end of a pickup measure that was never written.
    if (bar > barFrom) {
      part.push(
        `<line x1="${barX}" y1="${top}" x2="${barX}" y2="${bottom}" stroke="${INK}" stroke-width="1.3"/>`,
      );
    }

    // Beam geometry next: the dynamics are placed below the deepest beam, so a
    // beamed group can never sit on top of an mf.
    const beamOf = new Map();
    let deepest = bottom;
    let tupletLow = 0;

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
      // A sign is a tall glyph — a sharp reaches nearly two spaces above the line
      // its note sits on — and a sixteenth's second beam hangs barely that far
      // above the head. So a beamed sixteenth with an accidental had its beam
      // drawn through the sign. The beam is lifted clear of its group's signs,
      // which costs the group a few units of stem and nothing else.
      const signs = group.some((e) => e.accidental) ? 9 : 0;
      const anchor = up ? Math.min(...ends) - signs : Math.max(...ends) + signs;
      const at = (event) => anchor + slope * (xOf(event) - xs[0]);

      deepest = Math.max(deepest, ...group.map((e) => at(e)));
      if (up) musicTop = Math.min(musicTop, ...group.map((e) => at(e) - BEAM));
      group.forEach((e) => beamOf.set(e, { at, up }));

      // A triplet's numeral hangs below a down-stem beam — further down than the
      // beam itself — and a hairpin drawn in the dynamic lane ran straight
      // through it. So the numeral is measured here, before the lane is chosen.
      if (isTriplet(group)) {
        const first = group[0];
        const last = group[group.length - 1];
        const under = (at(first) + at(last)) / 2;
        const by = under + (up ? -12 : 12);
        tupletLow = Math.max(tupletLow, by + (up ? 0 : 10) + 4);
      }
    }

    // dynamics: below everything else in the bar
    const lowest = Math.max(
      bottom,
      ...events.map((e) => (e.note ? yForNote(e.note.letter, e.note.octave, bottom) : 0)),
    );
    // An accent hangs below the head of an up-stem note, and on a low note it
    // reaches further down than the head does — far enough to meet the dynamic
    // marking, which is what put a wedge through an "f". So the marks are
    // measured too, not just the heads and the beams.
    const marksLow = events.reduce((low, e) => {
      if (!e.note || !e.mark) return low;
      const beam = beamOf.get(e);
      const up = beam ? beam.up : stemUp(e.note.letter, e.note.octave);
      const y = yForNote(e.note.letter, e.note.octave, bottom);
      return up ? Math.max(low, y + markReach(e)) : low;
    }, 0);
    // The hairpin stands up to eighteen units above its baseline (see below), so a
    // triplet's numeral needs that much clearance plus air — a hairpin drawn
    // through a "3" was the first complaint about the ramps.
    const dynY = Math.max(bottom + 34, lowest + 26, deepest + 26, marksLow + 20, tupletLow + 22);
    lastDynY = Math.max(lastDynY, dynY);
    const firstWithDynamic = events.find((e) => e.dynamic);
    if (firstWithDynamic) {
      part.push(
        `<text class="score-dyn" x="${xOf(firstWithDynamic)}" y="${dynY}" font-size="19" text-anchor="middle">${firstWithDynamic.dynamic}</text>`,
      );
    }
    // A crescendo or decrescendo is a hairpin: two lines from a point to an open
    // end, spanning the beats it applies to. It takes the same lane as the
    // dynamic marking, which is already clear of every note and beam.
    if (passage.swell && passage.swell.bar === bar) {
      const { kind, from, to } = passage.swell;
      const a = events[from];
      const b = events[to];
      // A word needs its own air: a hairpin starting under the letters of an "mf"
      // reads as part of the letters.
      const clear = firstWithDynamic ? xOf(firstWithDynamic) + 24 : 0;
      const near = Math.max(a ? xOf(a) : 0, clear);
      // The marking the ramp arrives at sits to the right of its open end, so the
      // hairpin stops short of the barline by enough room to hold it. A wedge drawn
      // to the bar's edge leaves nowhere for the "f" it is rising towards, and a
      // marking pulled back inside the wedge is drawn through it.
      const room = passage.swell.target ? 40 : 12;
      const far = Math.min(b ? xOf(b) : 0, barX + barWidth - room);
      const span = far - near;
      // Under three spaces of span a hairpin is a smudge; a printed score writes
      // the word instead, and so does this.
      if (span >= 34) {
        // The mouth opens with the length, and stops opening at two spaces: a
        // hairpin is read by its angle, and drawing every one of them about a
        // space tall turned the long ones into a sliver that looks like a staff
        // line rather than a crescendo.
        const half = Math.max(4.5, Math.min(12, span * 0.09));
        const y = dynY - 6;
        const tip = kind === 'dim' ? far : near;
        const mouth = kind === 'dim' ? near : far;
        part.push(
          `<g class="score-hairpin" data-kind="${kind}">` +
            `<line x1="${fmt(tip)}" y1="${fmt(y)}" x2="${fmt(mouth)}" y2="${fmt(y - half)}" ` +
            `stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>` +
            `<line x1="${fmt(tip)}" y1="${fmt(y)}" x2="${fmt(mouth)}" y2="${fmt(y + half)}" ` +
            `stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>` +
            `</g>`,
        );
      } else {
        part.push(
          `<text class="score-dyn" x="${fmt((near + far) / 2)}" y="${dynY}" font-size="15" ` +
            `font-style="italic" text-anchor="middle">${kind === 'dim' ? 'dim.' : 'cresc.'}</text>`,
        );
      }
      // …and the marking it arrives at, just past the open end: "mp < f" is what a
      // player reads, and a ramp that opens onto nothing is only a wedge.
      if (span >= 34 && passage.swell.target) {
        const x = Math.max(near, far) + 22;
        part.push(
          `<text class="score-dyn" x="${fmt(x)}" y="${dynY}" font-size="19" ` +
            `text-anchor="middle">${passage.swell.target}</text>`,
        );
      }
    }

    // Where this bar's beams are, so a slur pushed to the stems' side can steer
    // around them instead of being drawn along one.
    const beamBoxes = [];

    groups.forEach((group) => {
      const beam = beamOf.get(group[0]);
      const stemX = (e) => xOf(e) + (beam.up ? 5.2 : -5.2);
      const first = group[0];
      const last = group[group.length - 1];

      // `beam.at()` is where a stem *ends* — the beam's inner edge. Beams are
      // filled parallelograms built outward from that edge rather than stroked
      // lines: a stroke's butt cap is cut square to the line, so a slanted beam
      // grew little wedges at its ends and the second beam never sat parallel.
      const dx = stemX(last) - stemX(first);
      const dy = beam.at(last) - beam.at(first);
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // unit normal pointing away from the note heads
      const dir = beam.up ? 1 : -1;
      const ox = uy * dir;
      const oy = -ux * dir;
      const GAP2 = 3.4; // white between the two beams of a sixteenth run

      const bar = (x1, y1, x2, y2) => {
        // a hair of overlap, so the stem and the beam never leave a pale seam
        const inset = 0.35;
        const sx1 = x1 - ox * inset;
        const sy1 = y1 - oy * inset;
        const sx2 = x2 - ox * inset;
        const sy2 = y2 - oy * inset;
        const f = (v) => v.toFixed(2);
        const bx = [sx1, sx2, sx2 + ox * BEAM, sx1 + ox * BEAM];
        const by = [sy1, sy2, sy2 + oy * BEAM, sy1 + oy * BEAM];
        beamBoxes.push({
          x0: Math.min(...bx) - 1,
          x1: Math.max(...bx) + 1,
          y0: Math.min(...by) - 1,
          y1: Math.max(...by) + 1,
        });
        return (
          `<path class="score-beam" d="M${f(sx1)} ${f(sy1)} L${f(sx2)} ${f(sy2)} ` +
          `L${f(sx2 + ox * BEAM)} ${f(sy2 + oy * BEAM)} ` +
          `L${f(sx1 + ox * BEAM)} ${f(sy1 + oy * BEAM)} Z" fill="${INK}"/>`
        );
      };

      part.push(bar(stemX(first), beam.at(first), stemX(last), beam.at(last)));
      // Sixteenths carry a second beam, one beam-and-a-gap nearer the heads. It
      // is offset in y only, scaled so the *perpendicular* distance stays right:
      // sliding the whole beam along its normal pushed its ends 2 units sideways
      // off the stems, which is what made those pairs look torn.
      const back = (BEAM + GAP2) / Math.abs(ux);
      const dy2 = dir * back;
      for (const run of sixteenthRuns(group)) {
        const from = stemX(run[0]);
        const to = stemX(run[run.length - 1]);
        if (run.length === 1) {
          // One sixteenth inside a beam is written with a stub of second beam,
          // pointing back into the group. Without it the note reads as an eighth
          // — and the dotted-eighth figure is exactly this.
          //
          // The stub follows the beam's own line. Drawn flat, a slanted beam got a
          // horizontal dash beside it that met the beam at one end and drifted off
          // it at the other, which is exactly how it looked.
          const place = group.indexOf(run[0]);
          const toward = place > 0 ? -1 : 1;
          const slope = ux ? uy / ux : 0;
          const stub = 11;
          const y0 = beam.at(run[0]) + dy2;
          part.push(bar(from, y0, from + toward * stub, y0 + slope * toward * stub));
        } else {
          part.push(bar(from, beam.at(run[0]) + dy2, to, beam.at(run[run.length - 1]) + dy2));
        }
      }

      // A triplet gets its number. It needs no bracket: the beam has already
      // gathered the three notes, and a bracket on top of a beam is the one thing
      // engravers never print.
      if (isTriplet(group)) {
        // Centre the numeral on the beam, which is the part the eye reads as the
        // group's body. Centring it on the note heads instead put it half a head
        // to the right whenever the stems were on the left of the heads, which is
        // exactly how a triplet with down stems looked off-centre.
        const x1 = stemX(first);
        const x2 = stemX(last);
        // The beam is a line, so its height under the numeral is the average of
        // its height at the two ends. Taking the height at the *first* note put
        // the 3 on top of a slanted beam — the numeral sat where the beam began
        // rather than where the number is.
        const under = (beam.at(first) + beam.at(last)) / 2;
        const by = under + (beam.up ? -12 : 12);
        musicTop = Math.min(musicTop, by - (beam.up ? 11 : 0));
        part.push(
          `<text class="score-tuplet" x="${(x1 + x2) / 2}" y="${by + (beam.up ? 0 : 10)}" ` +
            `font-size="15" font-style="italic" text-anchor="middle">3</text>`,
        );
      }
    });

    for (const event of events) {
      const x = xOf(event);

      if (event.rest) {
        part.push(
          `<g class="score-rest" data-dur="${event.dur}">${restGlyph(x, top + 2 * LINE_GAP, event.dur, INK)}</g>`,
        );
        continue;
      }
      if (!event.note) continue;

      const y = yForNote(event.note.letter, event.note.octave, bottom);
      // Everything this note puts on the page, measured as it is drawn: the head,
      // its stem, and the dot or articulation that sits above it when the stem
      // points down.
      musicTop = Math.min(musicTop, y - HEAD_RY);
      const beam = beamOf.get(event);
      // Inside a beamed group the *group's* direction wins for everything — stem
      // side, articulations and all. A note whose own direction disagreed was
      // drawn with its stem on the wrong side of the head, which is what made
      // those pairs look mutated.
      const up = beam ? beam.up : stemUp(event.note.letter, event.note.octave);
      const hollow = event.dur >= 8;

      part.push(ledgerLines(event.note.letter, event.note.octave, x, bottom));

      if (event.accidental) {
        // Grouped so a test can find it: the glyph is a pair of paths that look
        // much like a flag by bounding box alone.
        part.push(
          `<g class="score-acc">${accidentalAt(event.note.alter, x - 2 * LINE_GAP, y)}</g>`,
        );
      }

      const stemX = up ? x + 5.2 : x - 5.2;
      const stemEnd = beam ? beam.at(event) : up ? y - STEM : y + STEM;
      musicTop = Math.min(musicTop, stemEnd);
      // a stem is drawn for everything but a whole note and a beamed eighth
      if (!(event.dur >= 16)) {
        part.push(
          `<line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${stemEnd}" stroke="${INK}" stroke-width="1.42" stroke-linecap="round"/>`,
        );
      }
      if (event.dur <= 2 && !beam) {
        // A lone eighth or sixteenth gets a flag: the hook traced in FLAG_OUTER /
        // FLAG_INNER, the same outline the header and the app icons are drawn
        // from, so the notation and the logo are one glyph rather than two
        // drawings that resemble each other.
        const toward = up ? 1 : -1; // which way the head lies from the stem tip
        part.push(`<path d="${flagPath(stemX, stemEnd, toward)}" fill="${INK}"/>`);
        // The sixteenth's second flag starts a little over a space down the stem,
        // which is where engravers put it.
        if (event.dur === 1) part.push(`<path d="${flagPath(stemX, stemEnd, toward, 13)}" fill="${INK}"/>`);
      }

      part.push(head(x, y, { hollow }));

      // ledger lines, above the staff, reach higher than the note that needs them
      if (indexOf(event.note.letter, event.note.octave) > E4 + 8) {
        musicTop = Math.min(musicTop, bottom - (indexOf(event.note.letter, event.note.octave) - E4) * STEPS);
      }

      // dot
      if (event.dur === 6 || event.dur === 12 || event.dur === 3) {
        // The dot belongs in the middle of the space beside the head; a note
        // sitting on a line takes its dot one step away, or it reads as a smudge
        // on the line.
        const onLine = indexOf(event.note.letter, event.note.octave) % 2 === 0;
        musicTop = Math.min(musicTop, y - (onLine ? STEPS : 0) - 2.05);
        part.push(
          `<circle cx="${x + 10.8}" cy="${y - (onLine ? STEPS : 0)}" r="2.05" fill="${INK}"/>`,
        );
      }

      // articulations
      if (event.mark === 'staccato') {
        if (!up) musicTop = Math.min(musicTop, y - markReach(event));
        part.push(`<circle cx="${x}" cy="${up ? y + HEAD_RY + 7 : y - HEAD_RY - 7}" r="2.2" fill="${INK}"/>`);
      } else if (event.mark === 'accent') {
        // A wedge, not a triangle: an accent points along the note, and drawing it
        // as a triangle (then turning it over for down-stems) read as a ▽.
        const ay = up ? y + HEAD_RY + 9 : y - HEAD_RY - 9;
        if (!up) musicTop = Math.min(musicTop, y - markReach(event));
        part.push(
          `<path d="M${x - 5.5} ${ay - 4} L${x + 5.5} ${ay} L${x - 5.5} ${ay + 4}" ` +
            `fill="none" stroke="${INK}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`,
        );
      }
    }

    // ── slurs ───────────────────────────────────────────────────────────
    // A slur sits on the opposite side of the stems, which is where engravers
    // put it, and clears the note heads by about half a space. The curve is a
    // cubic with both control points pushed outward, so it reads as a bow rather
    // than a straight line with rounded ends. Drawn last in the bar, so it lies
    // over the beams rather than under them.
    for (let i = 0; i < events.length; i++) {
      const a = events[i];
      if (!a.slurStart || !a.note) continue;
      let b = null;
      let last = i;
      for (let j = i + 1; j < events.length; j++) {
        if (events[j].slurEnd) { b = events[j]; last = j; break; }
      }
      if (!b || !b.note) continue;
      const x1 = xOf(a);
      const x2 = xOf(b);
      if (x2 - x1 < 8) continue;
      const y1 = yForNote(a.note.letter, a.note.octave, bottom);
      const y2 = yForNote(b.note.letter, b.note.octave, bottom);

      // Look at everything the slur passes over, not just the two notes it
      // joins. A stem that points the slur's way runs higher (or lower) than
      // either notehead, and a curve measured from the heads alone goes straight
      // through it.
      // A note's stem may follow its beam rather than the notehead rule, so ask
      // the beam first. `reach` is how far that stem (and the beam riding on it)
      // runs past the head.
      const stemInfo = (ev) => {
        const beam = beamOf.get(ev);
        const up = beam ? beam.up : stemUp(ev.note.letter, ev.note.octave);
        return { up, reach: beam ? STEM + BEAM : STEM };
      };
      // An articulation mark sits opposite the stem — the same side the slur
      // takes — so it has to be cleared too, or the slur runs through the dot.
      // The measurement lives in markReach, which the dynamics use as well.
      /** How far a note's own ink runs on one side of its head: -1 above, +1 below. */
      const edge = (ev, side) => {
        const ym = yForNote(ev.note.letter, ev.note.octave, bottom);
        const { up, reach } = stemInfo(ev);
        const mark = markReach(ev);
        return side > 0
          ? Math.max(up ? ym : ym + reach, up && mark ? ym + mark : ym)
          : Math.min(up ? ym - reach : ym, !up && mark ? ym - mark : ym);
      };
      let above = Infinity;
      let below = -Infinity;
      let ups = 0;
      let downs = 0;
      for (let k = i; k <= last; k++) {
        const mid = events[k];
        if (!mid.note) continue;
        const { up } = stemInfo(mid);
        if (up) ups++;
        else downs++;
      }
      for (let k = i; k <= last; k++) {
        const mid = events[k];
        if (!mid.note) continue;
        const ym = yForNote(mid.note.letter, mid.note.octave, bottom);
        const { up, reach } = stemInfo(mid);
        const mark = markReach(mid);
        above = Math.min(above, up ? ym - reach : ym, !up && mark ? ym - mark : ym);
        below = Math.max(below, up ? ym : ym + reach, up && mark ? ym + mark : ym);
      }

      const lift = 6.5;
      // Both control points sit at one height — clear of everything in the span
      // — so the slur is a symmetric bow. Giving each control point the height of
      // its own note made the curve swoop diagonally, which is what looked wrong
      // on slurs that spanned a wide interval. The bulge also grows far more
      // slowly than the span, so a long slur is a shallow bow rather than an arch.
      const span = Math.hypot(x2 - x1, y2 - y1);
      const rise = Math.min(13, 4 + span * 0.09);
      const f = (v) => v.toFixed(2);
      // The control points sit further in than a plain bow would put them, so the
      // curve holds its height across the run and dives only at the very ends.
      // Pulled out to a quarter span, it starts coming down early and clips the
      // head of the last note before the one it lands on.
      const grip = 0.18;

      // Every glyph the slur passes, as a box it must stay out of. Modelling the
      // curve perfectly for every combination of heads, stems, beams and marks
      // is a losing game; drawing it and then pushing it clear is not.
      const obstacles = [...beamBoxes];
      for (let k = i; k <= last; k++) {
        const ev = events[k];
        if (!ev.note) continue;
        const ex = xOf(ev);
        const ey = yForNote(ev.note.letter, ev.note.octave, bottom);
        const { up, reach } = stemInfo(ev);
        const mark = markReach(ev);
        obstacles.push({
          x0: ex - HEAD_RX - 1,
          x1: ex + HEAD_RX + 1,
          y0: Math.min(up ? ey - reach : ey - HEAD_RY, !up && mark ? ey - mark : ey - HEAD_RY),
          y1: Math.max(up ? ey + HEAD_RY : ey + reach, up && mark ? ey + mark : ey + HEAD_RY),
        });
      }
      const curveX = (t) => {
        const u = 1 - t;
        const c1x = x1 + (x2 - x1) * grip;
        const c2x = x2 - (x2 - x1) * grip;
        return u * u * u * x1 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x2;
      };

      /**
       * The curve set wholly on one side of the notes: -1 above the heads, +1
       * below. Each end leaves its note on that note's own edge — the head when
       * the stem points away, the stem tip or the articulation when it does not —
       * so nothing pokes through the curve at the join. `limit` is the height the
       * bow may not cross: the system above's dynamic marking when it goes up,
       * this bar's own when it goes down.
       */
      const place = (side, limit) => {
        const base = (side > 0 ? below : above) + side * lift;
        const startY = edge(a, side) + side * lift;
        const stopY = edge(b, side) + side * lift;
        const at = (t, extra) => {
          const u = 1 - t;
          const cy = base + side * (rise + extra);
          return u * u * u * startY + 3 * u * u * t * cy + 3 * u * t * t * cy + t * t * t * stopY;
        };
        const clipping = (extra) => {
          for (let s = 1; s < 60; s++) {
            const px = curveX(s / 60);
            const py = at(s / 60, extra);
            if (obstacles.some((o) => px > o.x0 && px < o.x1 && py > o.y0 && py < o.y1)) return true;
          }
          return false;
        };
        let extra = 0;
        for (let pass = 0; pass < 10 && clipping(extra); pass++) extra += 3;
        // Still clipping after all that means the side itself is occupied — the
        // curve has to leave its note through something, and no amount of bow
        // fixes that. Such a side must never win on the strength of its size.
        const blocked = clipping(extra);
        let bulge = base + side * (rise + extra);
        // Push the bow back inside its limit rather than through it: that shortens
        // the arc, it never turns it over.
        if (limit != null && side * (bulge - limit) > 0) bulge = limit + side * 1.5;
        // Whatever the limit says, the bow stays on its own side of the notes. A
        // shorter arc is a quiet slur; an arc that crosses its own ends is a
        // mistake a student can see.
        if (side * (bulge - base) < 2) bulge = base + side * 2;
        // How far the bow stands off the notes on its own side: positive for an
        // arc, negative when the limit has pushed it back past its own base.
        return { startY, stopY, base, bulge, blocked, room: side * (bulge - base) };
      };

      // A slur normally sits opposite the stems, which is where engravers put it.
      // On a phone the systems are sixty units apart, though, and a phrase that
      // sits high leaves no room above it: forcing the bow down to the ceiling put
      // the curve *below one of its own ends*, so the slur read as upside down.
      // The side is therefore a choice — take the one that can hold a real bow.
      const natural = ups > downs ? 1 : -1; // below the heads when the stems point up
      const limitFor = (side) => (side < 0 ? ceiling : dynY - 2);
      let dir = natural;
      let arc = place(dir, limitFor(dir));
      if (arc.blocked || arc.room < 4.5) {
        const other = place(-dir, limitFor(-dir));
        // The other side wins only if it is clear and genuinely roomier: a blocked
        // side reports a big bow, and taking that at face value is what put slurs
        // along the beams.
        const wins = !other.blocked && (arc.blocked ? other.room > 2 : other.room > Math.max(4.5, arc.room + 2));
        if (wins) {
          dir = -dir;
          arc = other;
        }
      }
      const { startY, stopY, bulge } = arc;
      // A slur rising over the top of the staff is music too, and can be the
      // highest thing in the system.
      if (dir < 0) musicTop = Math.min(musicTop, bulge - 2);
      part.push(
        `<path class="score-slur" d="M${f(x1)} ${f(startY)} ` +
          `C${f(x1 + (x2 - x1) * grip)} ${f(bulge)} ` +
          `${f(x2 - (x2 - x1) * grip)} ${f(bulge)} ` +
          `${f(x2)} ${f(stopY)}" ` +
          `fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
      );
    }
  }

  // One invisible box per bar, declared by the only part of the app that knows
  // where a bar begins and ends. The screen makes them clickable, so a student
  // can pick a bar out — to start the example there, or to work on it alone —
  // without the renderer ever having to guess its own geometry from the outside.
  // They are laid down last, which puts them above the notes: a click anywhere in
  // the bar counts, including on a note head.
  for (let bar = barFrom; bar < barTo; bar++) {
    const x = musicLeft + (bar - barFrom) * barWidth;
    part.push(
      `<rect class="score-bar-box" data-bar="${bar}" x="${x}" y="${top}" ` +
        `width="${barWidth}" height="${bottom - top}" fill="none"/>`,
    );
  }

  // Closing barline: a plain line where the music carries on — only the last
  // system gets the double bar. A double bar mid-piece tells a player the music
  // has stopped, which is the wrong thing to teach a sight-reader.
  if (final) {
    part.push(
      `<line x1="${width - RIGHT - 6}" y1="${top}" x2="${width - RIGHT - 6}" y2="${bottom}" stroke="${INK}" stroke-width="1.2"/>`,
      `<rect x="${width - RIGHT - 3}" y="${top}" width="3" height="${bottom - top}" fill="${INK}"/>`,
    );
  } else {
    part.push(
      `<line x1="${width - RIGHT}" y1="${top}" x2="${width - RIGHT}" y2="${bottom}" stroke="${INK}" stroke-width="1.3"/>`,
    );
  }

  // The tempo mark, now that the bars have said how high they reach. It is
  // printed over the first bar, so it goes above the music rather than through
  // it; TOP_PAD leaves room for the usual case and this moves it the rest of the
  // way. Never higher than twenty units from the top of the drawing, or it would
  // be clipped by the viewBox.
  if (showTempo && (tempoText || tempoMark)) {
    const y = Math.max(20, Math.min(top - 18, musicTop - 16));
    if (tempoMark && tempoMark.unit === 'h') {
      // A half note is *drawn*, not typed: its Unicode character is missing from
      // every phone font and comes out as an empty box. One head, one stem, then
      // the marking beside it, the way an engraver prints it. The head is the
      // score's own hollow note head, a shade smaller — a filled head would be a
      // quarter note, and a cut-time marking is not one.
      const hx = tempoX;
      const hy = y - 5.2;
      part.push(
        `<g class="score-tempo-mark">` +
          `<ellipse cx="${fmt(hx + 6.4)}" cy="${fmt(hy)}" rx="6.4" ry="4.1" ` +
          `transform="rotate(${HEAD_ANGLE} ${fmt(hx + 6.4)} ${fmt(hy)})" ` +
          `fill="none" stroke="${INK}" stroke-width="1.55"/>` +
          `<line x1="${fmt(hx + 11.6)}" y1="${fmt(hy - 1.4)}" x2="${fmt(hx + 11.6)}" y2="${fmt(hy - 15.6)}" ` +
          `stroke="${INK}" stroke-width="1.55" stroke-linecap="round"/>` +
          `<text class="score-tempo" x="${fmt(hx + 18.4)}" y="${fmt(y)}" font-size="17">= ${tempoMark.bpm}</text>` +
          `</g>`,
      );
    } else {
      part.push(
        `<text class="score-tempo" x="${tempoX}" y="${y}" font-size="17">${tempoText}</text>`,
      );
    }
  }


  // The intonation lane, under this system's own notes. It goes below the
  // dynamics so a crescendo's lettering never collides with it, and it returns
  // its bottom so the spacing pass can leave room for it.
  let laneBottom = null;
  if (marks.length) {
    const centre = Math.max(bottom + 26, lastDynY + 22);
    const lane = intonationLane({
      marks,
      centre,
      half: 20,
      left: LEFT,
      right: width - RIGHT,
    });
    part.push(lane.markup);
    laneBottom = lane.bottom + 4;
  }

  return { markup: part.join(''), dynY: lastDynY, musicTop, laneBottom };
}

/**
 * One bar on its own, for a tool rather than for the app: the sample-recording
 * page prints each take with the same engraver the passages use, so what the
 * teacher records is exactly the shape the playback has to produce.
 */
export function renderBar(
  events,
  { meter = '4/4', fifths = 0, width = 470, label = 'one bar' } = {},
) {
  const [count, unit] = meter.split('/').map(Number);
  const system = drawSystem(
    { key: { fifths }, meter, perBar: (count * 4) / unit, bars: [events], swell: null, dynamic: null },
    0,
    1,
    TOP_PAD,
    { width, timeSignature: true, tempoText: '', showTempo: false, final: true },
  );
  const height = Math.ceil(system.dynY + 18);
  return (
    `<svg class="score" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">` +
    system.markup +
    `</svg>`
  );
}

/**
 * The mark: one eighth note on its own, as an SVG — the glyph the app is built
 * around. The header and the home-screen icons are this function, so the note on
 * a phone's home screen is the same note as the one in the score, and it stays
 * vector at any size instead of being a 160-pixel raster blown up.
 */
export function noteMarkSvg({ height = 100, colour = INK } = {}) {
  const width = (height * MARK_BOX.w) / MARK_BOX.h;
  const stemX = 5.2;
  const stemEnd = -STEM;
  const hook = flagPath(stemX, stemEnd, 1);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_BOX.x} ${MARK_BOX.y} ${MARK_BOX.w} ${MARK_BOX.h}" ` +
    `width="${width.toFixed(2)}" height="${height}">` +
    `<path d="${hook}" fill="${colour}"/>` +
    `<line x1="${stemX}" y1="0" x2="${stemX}" y2="${stemEnd}" stroke="${colour}" ` +
    `stroke-width="1.42" stroke-linecap="round"/>` +
    `<ellipse cx="0" cy="0" rx="${HEAD_RX}" ry="${HEAD_RY}" fill="${colour}" ` +
    `transform="rotate(${HEAD_ANGLE} 0 0)"/>` +
    `</svg>`
  );
}

/**
 * The whole passage: two systems of four bars.
 * `tempoText` is a localised string such as "♩ = 60"; pass '' to omit it.
 */
export function renderScore(
  passage,
  {
    tempoText = '',
    tempoMark = null,
    ariaLabel = 'Sight-reading passage',
    barsPerSystem = BARS_PER_SYSTEM,
    // Cents per sounding note for the whole passage, or null. Each system draws
    // the part of the lane that belongs to it, under its own notes.
    intonation = null,
  } = {},
) {
  const narrow = barsPerSystem === 2;
  const per = narrow ? 2 : BARS_PER_SYSTEM;
  const systems = Math.ceil(8 / per);
  const width = narrow ? NARROW_WIDTH : WIDTH;
  const staff = 4 * LINE_GAP;
  const minPitch = narrow ? NARROW_PITCH : SYSTEM_GAP;

  /**
   * One system, drawn at `top`. Everything in it is positioned relative to that
   * top, so drawing a system on its own says how far its music reaches above the
   * staff and how far its dynamic marking hangs below — which is what the spacing
   * between systems has to hold.
   */
  // Where this system's notes start in the intonation list: everything before it.
  const startOf = (s) => {
    if (!intonation) return 0;
    let count = 0;
    for (let bar = 0; bar < s * per; bar++) {
      for (const event of passage.bars[bar] || []) if (!event.rest && event.note) count += 1;
    }
    return count;
  };

  const draw = (s, top, ceiling) =>
    drawSystem(passage, s * per, (s + 1) * per, top, {
      width,
      timeSignature: s === 0,
      tempoText: s === 0 ? tempoText : '',
      tempoMark: s === 0 ? tempoMark : null,
      showTempo: s === 0 && Boolean(tempoText || tempoMark),
      final: s === systems - 1,
      ceiling,
      intonation,
      intonationStart: startOf(s),
    });

  // ── how far apart the systems go ────────────────────────────────────────
  // A fixed pitch had to be set for the worst case in every level at once, and
  // on a phone it was too small: the dynamic under one system met the tall notes
  // of the next, and a slur over a high phrase had no room above it at all. So
  // the systems are measured first — each drawn on its own, which costs nothing
  // but a second pass — and then spaced by what they need.
  const measured = [];
  let measureCeiling = null;
  for (let s = 0; s < systems; s++) {
    const sys = draw(s, 0, measureCeiling);
    measured.push(sys);
    // The lane hangs below the dynamics, so the next system has to clear that
    // too — otherwise the lane would be drawn through the staff below it.
    measureCeiling = (sys.laneBottom ?? sys.dynY) + 6;
  }

  // The first system normally sits at TOP_PAD. Music that reaches very high — a
  // beam lifted clear of a beamed accidental, a phrase up on the ledger lines —
  // needs the whole drawing moved down instead: the tempo mark is clamped to
  // y = 20 so it can never be clipped by the top of the viewBox, and music that
  // reaches above that clamp is music drawn through the mark.
  const tops = [Math.max(TOP_PAD, 40 - measured[0].musicTop)];
  for (let s = 1; s < systems; s++) {
    // The lane under the system above is the lowest thing it puts on the page.
    const below = (measured[s - 1].laneBottom ?? measured[s - 1].dynY) - staff;
    const above = -measured[s].musicTop; // the tallest music of this one
    tops.push(tops[s - 1] + Math.max(minPitch, staff + below + above + 10));
  }

  // Room under the last system for its dynamics and a low slur.
  const bottomPad = (narrow ? 40 : 78);
  const lastBelow = (measured[systems - 1].laneBottom ?? measured[systems - 1].dynY) - staff;
  const height = tops[systems - 1] + staff + Math.max(bottomPad, lastBelow + 20);

  const parts = [
    `<svg class="score" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}">`,
  ];
  // Each system is drawn knowing where the one above put its dynamic marking, so
  // a slur rising into the gap can stop short of it.
  let ceiling = null;
  for (let s = 0; s < systems; s++) {
    const system = draw(s, tops[s], ceiling);
    parts.push(system.markup);
    ceiling = system.dynY + 6;
  }
  parts.push('</svg>');
  return parts.join('');
}
