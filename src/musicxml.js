// musicxml.js — reading a score the student brings: .musicxml / .xml / .mxl.
//
// Only what the listening needs is read: one part's notes, in the order they are
// played, with where each sits in its bar. Drawing the score is left to a proper
// engraver (OpenSheetMusicDisplay, loaded only when a score is opened).
//
// The parts of MusicXML that trip readers up, and what this one does with them:
//   - <divisions> can change bar to bar; every duration is read against the one
//     in force.
//   - <backup>/<forward> move the clock for other voices; only voice 1 of the
//     chosen staff is kept, so a second voice never lands on top of the first.
//   - <chord/> marks extra notes of a double stop; the top note is kept, since a
//     single-pitch ear hears the top string most clearly.
//   - <tie> joins notes into one sounding note; <grace/> and <cue/> notes take no
//     time and are skipped.
//   - Repeats and 1st/2nd endings are *unrolled* into playing order before
//     anything is compared: score-to-audio alignment falls apart at jumps
//     (20% → 83% bar accuracy once repeats are unrolled, in Shan et al. 2024).
//     D.C. / D.S. / Coda jumps are not followed in this beta.

/* ── Unzipping a .mxl ──────────────────────────────────────────────────── */

/**
 * A .mxl is a zip: META-INF/container.xml names the score inside (its first
 * <rootfile>). Entries are stored or deflated; the browser's DecompressionStream
 * inflates them, so no zip library is needed.
 */
export async function readMxl(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  // the end-of-central-directory record, searched from the back
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not-a-zip');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries = new Map();
  const dec = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method, size, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const read = async (name) => {
    const e = entries.get(name);
    if (!e) return null;
    const lNameLen = view.getUint16(e.local + 26, true);
    const lExtraLen = view.getUint16(e.local + 28, true);
    const start = e.local + 30 + lNameLen + lExtraLen;
    const data = bytes.subarray(start, start + e.size);
    if (e.method === 0) return dec.decode(data);
    if (e.method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('cannot-inflate');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return dec.decode(await new Response(stream).arrayBuffer());
  };
  let root = null;
  const container = await read('META-INF/container.xml');
  if (container) {
    const m = /<rootfile[^>]*full-path="([^"]+)"/.exec(container);
    if (m) root = m[1];
  }
  if (!root) root = [...entries.keys()].find((n) => /\.(musicxml|xml)$/i.test(n) && !n.startsWith('META-INF'));
  if (!root) throw new Error('no-score-in-zip');
  return read(root);
}

/** Text of a .musicxml/.xml/.mxl file the student picked. */
export async function readScoreFile(file) {
  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  const zipped = head[0] === 0x50 && head[1] === 0x4b; // "PK"
  return zipped ? readMxl(buffer) : new TextDecoder().decode(buffer);
}

/* ── Reading the score ─────────────────────────────────────────────────── */

const STEP_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const kid = (el, name) => (el ? [...el.children].find((c) => c.tagName === name) || null : null);
const kids = (el, name) => (el ? [...el.children].filter((c) => c.tagName === name) : []);
const text = (el, name, fallback = null) => {
  const c = kid(el, name);
  return c ? c.textContent.trim() : fallback;
};

/** The parts a score has, for choosing which one is the violin. */
export function listParts(doc) {
  return kids(kid(doc.documentElement, 'part-list'), 'score-part').map((sp) => ({
    id: sp.getAttribute('id'),
    name: text(sp, 'part-name', '') || text(sp, 'part-abbreviation', '') || sp.getAttribute('id'),
  }));
}

/** The part most likely to be the violin: by name, else the first. */
export function violinPart(parts) {
  return (parts.find((p) => /viol|vln|vn\b|fiddle|solo/i.test(p.name)) || parts[0] || null)?.id ?? null;
}

export function parseXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.documentElement) throw new Error('bad-xml');
  if (doc.documentElement.tagName === 'score-timewise') throw new Error('timewise');
  if (doc.documentElement.tagName !== 'score-partwise') throw new Error('not-musicxml');
  return doc;
}

/**
 * One part of a score, read for listening.
 * Returns { title, parts, partId, measures, order, notes, keyFifths, tempo }:
 *   measures: [{ index, number, beats, beatType, quarters }] as written
 *   order:    the written measure indices in playing order (repeats unrolled)
 *   notes:    sounding notes in playing order:
 *             { midi, measure (written index), pass (0-based play index of the
 *               bar), at (quarters from the start of the bar), quarters,
 *               abs (quarters from the start of the performance) }
 */
export function readScore(xmlText, partId = null) {
  const doc = parseXml(xmlText);
  const parts = listParts(doc);
  const id = partId || violinPart(parts);
  const part = [...doc.documentElement.children].find((c) => c.tagName === 'part' && c.getAttribute('id') === id);
  if (!part) throw new Error('no-part');
  const title =
    text(kid(doc.documentElement, 'work'), 'work-title', '') ||
    text(doc.documentElement, 'movement-title', '') ||
    '';

  let divisions = 1;
  let beats = 4;
  let beatType = 4;
  let keyFifths = null;
  let tempo = null;
  const measures = [];
  const perMeasure = []; // notes as written, per measure: { midi, at, quarters }
  const repeats = []; // { index, forward, backward, times, endings }
  let activeEnding = null; // a 1st/2nd ending can span several bars

  kids(part, 'measure').forEach((m, index) => {
    let clock = 0; // in divisions, for voice 1
    let maxClock = 0;
    let staffWanted = null;
    const notes = [];
    let lastNote = null; // for chords and ties
    const rep = { index, forward: false, backward: false, times: 2, endings: null };
    for (const el of m.children) {
      const tag = el.tagName;
      if (tag === 'attributes') {
        const d = text(el, 'divisions');
        if (d) divisions = Number(d) || divisions;
        const time = kid(el, 'time');
        if (time && text(time, 'beats')) {
          beats = Number(text(time, 'beats').split('+').reduce((a, b) => a + Number(b), 0)) || beats;
          beatType = Number(text(time, 'beat-type')) || beatType;
        }
        const key = kid(el, 'key');
        if (key && keyFifths == null && text(key, 'fifths') != null) keyFifths = Number(text(key, 'fifths'));
      } else if (tag === 'direction' || tag === 'sound') {
        const snd = tag === 'sound' ? el : kid(el, 'sound');
        if (snd && snd.getAttribute('tempo') && tempo == null) tempo = Number(snd.getAttribute('tempo'));
        const metro = el.querySelector && el.querySelector('metronome per-minute');
        if (metro && tempo == null) {
          const unit = el.querySelector('metronome beat-unit')?.textContent.trim();
          const dotted = Boolean(el.querySelector('metronome beat-unit-dot'));
          const q = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 }[unit] || 1;
          tempo = Number(metro.textContent) * q * (dotted ? 1.5 : 1);
        }
      } else if (tag === 'backup') {
        clock -= Number(text(el, 'duration', 0));
      } else if (tag === 'forward') {
        clock += Number(text(el, 'duration', 0));
        maxClock = Math.max(maxClock, clock);
      } else if (tag === 'barline') {
        const r = kid(el, 'repeat');
        if (r) {
          if (r.getAttribute('direction') === 'forward') rep.forward = true;
          if (r.getAttribute('direction') === 'backward') {
            rep.backward = true;
            rep.times = Number(r.getAttribute('times')) || 2;
          }
        }
        const ending = kid(el, 'ending');
        if (ending) {
          const type = ending.getAttribute('type');
          if (type === 'start') {
            activeEnding = (ending.getAttribute('number') || '1').split(/[,\s]+/).map(Number).filter(Boolean);
            rep.endings = activeEnding;
          } else {
            rep.endings = rep.endings || activeEnding;
            rep.endingEnds = true;
          }
        }
      } else if (tag === 'note') {
        const dur = Number(text(el, 'duration', 0));
        const isChord = Boolean(kid(el, 'chord'));
        const grace = Boolean(kid(el, 'grace')) || Boolean(kid(el, 'cue'));
        const voice = text(el, 'voice', '1');
        const staff = text(el, 'staff', '1');
        if (staffWanted == null) staffWanted = staff;
        const mine = voice === '1' && staff === staffWanted;
        if (grace) continue;
        const start = isChord && lastNote ? lastNote.startDiv : clock;
        if (!isChord) clock += dur;
        maxClock = Math.max(maxClock, clock);
        if (!mine) continue;
        const pitch = kid(el, 'pitch');
        if (!pitch) {
          if (!isChord) lastNote = { startDiv: start, rest: true };
          continue;
        }
        const step = text(pitch, 'step');
        const midi = 12 * (Number(text(pitch, 'octave')) + 1) + STEP_PC[step] + Number(text(pitch, 'alter', 0) || 0);
        const ties = kids(el, 'tie').map((tie) => tie.getAttribute('type'));
        const entry = {
          midi: Math.round(midi),
          at: start / divisions,
          quarters: dur / divisions,
          tieStop: ties.includes('stop'),
          tieStart: ties.includes('start'),
          startDiv: start,
        };
        if (isChord && lastNote && !lastNote.rest) {
          // a double stop: keep the top note
          if (entry.midi > lastNote.midi) {
            lastNote.midi = entry.midi;
          }
          continue;
        }
        notes.push(entry);
        lastNote = entry;
      }
    }
    if (!rep.endings && activeEnding) rep.endings = activeEnding;
    if (rep.endingEnds) activeEnding = null;
    const quarters = Math.max((beats * 4) / beatType, maxClock / divisions);
    measures.push({ index, number: m.getAttribute('number') || String(index + 1), beats, beatType, quarters });
    perMeasure.push(notes);
    repeats.push(rep);
  });

  const order = unroll(repeats);

  // Notes in playing order. Ties across a barline join with the note before.
  const out = [];
  let abs = 0;
  const passes = new Map();
  for (const mi of order) {
    const pass = passes.get(mi) || 0;
    passes.set(mi, pass + 1);
    for (const n of perMeasure[mi]) {
      const prev = out[out.length - 1];
      if (n.tieStop && prev && prev.midi === n.midi) {
        prev.quarters += n.quarters;
        continue;
      }
      out.push({ midi: n.midi, measure: mi, pass, at: n.at, quarters: n.quarters, abs: abs + n.at });
    }
    abs += measures[mi].quarters;
  }

  return {
    title,
    parts,
    partId: id,
    measures,
    order,
    notes: out,
    keyFifths: keyFifths ?? 0,
    tempo,
    totalQuarters: abs,
  };
}

/**
 * Written bars `from`..`to` (indexes, either way round) as a score of their own:
 * played once, straight through, the way a passage is practised. A bar that the
 * whole piece visits more than once gives the notes of its first visit.
 */
export function sectionOf(score, from, to) {
  const last = score.measures.length - 1;
  const a = Math.max(0, Math.min(from, to, last));
  const b = Math.min(last, Math.max(from, to, 0));
  const order = [];
  const notes = [];
  let abs = 0;
  for (let mi = a; mi <= b; mi++) {
    order.push(mi);
    const inBar = score.notes.filter((n) => n.measure === mi);
    const first = inBar.reduce((low, n) => Math.min(low, n.pass), Infinity);
    for (const n of inBar) if (n.pass === first) notes.push({ ...n, pass: 0, abs: abs + n.at });
    abs += score.measures[mi].quarters;
  }
  return { ...score, order, notes, totalQuarters: abs, section: { from: a, to: b } };
}

/**
 * Written bars in playing order: a backward repeat sends the reader back to the
 * last forward repeat (or the start) `times − 1` more times, and a bar under a
 * numbered ending is only played on the passes it is numbered for.
 */
export function unroll(repeats) {
  const order = [];
  let start = 0; // where a backward repeat sends the reader
  let pass = 1;
  let i = 0;
  let guard = 0;
  while (i < repeats.length && guard++ < 10000) {
    const r = repeats[i];
    if (r.forward && i !== start) {
      start = i;
      pass = 1;
    }
    const playsHere = !r.endings || r.endings.includes(pass);
    if (playsHere) order.push(i);
    if (playsHere && r.backward) {
      if (pass < r.times) {
        pass += 1;
        i = start;
        continue;
      }
      // the repeat is done: what follows is a fresh section
      pass = 1;
      start = i + 1;
    }
    // the last bar of a final ending closes its section too
    if (playsHere && r.endingEnds && !r.backward) {
      pass = 1;
      start = i + 1;
    }
    i += 1;
  }
  return order;
}
