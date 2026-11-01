// music.js — note spelling, key signatures, and the NYSSMA scale library.
//
// Everything is built from spelled notes (letter + accidental + octave) rather
// than raw MIDI numbers, so the staff can be drawn with the right accidentals
// and the app can show enharmonic spellings (F♯ / G♭, C♯ / D♭, B / C♭).

import { getLang, t } from './i18n.js?v=202610312212';

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_SEMITONE = [0, 2, 4, 5, 7, 9, 11];

// Order accidentals appear in a key signature.
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F

export function keySignature(fifths) {
  const sig = [0, 0, 0, 0, 0, 0, 0];
  if (fifths > 0) {
    for (let i = 0; i < Math.min(fifths, 7); i++) sig[SHARP_ORDER[i]] = 1;
  } else if (fifths < 0) {
    for (let i = 0; i < Math.min(-fifths, 7); i++) sig[FLAT_ORDER[i]] = -1;
  }
  return sig;
}

export function accidentalGlyph(alter) {
  if (alter === 0) return '';
  if (alter === 1) return '\u266F'; // ♯
  if (alter === -1) return '\u266D'; // ♭
  if (alter === 2) return '\u266F\u266F';
  if (alter === -2) return '\u266D\u266D';
  return '';
}

export function makeNote(letter, alter, octave) {
  return {
    letter,
    alter,
    octave,
    midi: (octave + 1) * 12 + LETTER_SEMITONE[letter] + alter,
    name: LETTERS[letter] + accidentalGlyph(alter) + octave,
    letterName: LETTERS[letter] + accidentalGlyph(alter),
  };
}

// ---------------------------------------------------------------------------
// Scale library
//
// NYSSMA Levels 5–6 for violin/viola/cello: "15 major scales, all two octaves,
// up and down, from memory." The 15 = C major + the 7 sharp keys + the 7 flat
// keys; three of them share a pitch set (B/C♭, F♯/G♭, C♯/D♭), so the grid
// shows 12 cards with a spelling switch where it applies.
//
// Starting octaves follow the usual two-octave violin fingering: the tonic is
// the lowest one available on the instrument in first position.
// ---------------------------------------------------------------------------

function variant(name, letter, alter, fifths, octave) {
  return { name, letter, alter, fifths, octave };
}

// Ordered the way a violinist meets them — by where the scale starts on the
// instrument, from G on the open G string up to F♯, the highest tonic still in
// first position. The old order was the circle of fifths, which is a theorist's
// order rather than a player's.
export const MAJOR_KEYS = [
  { id: 'G', variants: [variant('G', 4, 0, 1, 3)] },
  { id: 'Ab', variants: [variant('A\u266D', 5, -1, -4, 3)] },
  { id: 'A', variants: [variant('A', 5, 0, 3, 3)] },
  { id: 'Bb', variants: [variant('B\u266D', 6, -1, -2, 3)] },
  { id: 'B', variants: [variant('B', 6, 0, 5, 3), variant('C\u266D', 0, -1, -7, 4)] },
  { id: 'C', variants: [variant('C', 0, 0, 0, 4)] },
  { id: 'C#', variants: [variant('C\u266F', 0, 1, 7, 4), variant('D\u266D', 1, -1, -5, 4)] },
  { id: 'D', variants: [variant('D', 1, 0, 2, 4)] },
  { id: 'Eb', variants: [variant('E\u266D', 2, -1, -3, 4)] },
  { id: 'E', variants: [variant('E', 2, 0, 4, 4)] },
  { id: 'F', variants: [variant('F', 3, 0, -1, 4)] },
  { id: 'F#', variants: [variant('F\u266F', 3, 1, 6, 4), variant('G\u266D', 4, -1, -6, 4)] },
];

// Not required by NYSSMA at these levels, but the same students are playing
// minor-key repertoire, so the app offers the parallel set as a bonus.
// Same order as the majors: by the pitch the scale starts on, G minor first.
export const MINOR_KEYS = [
  { id: 'Gm', variants: [variant('G', 4, 0, -2, 3)] },
  { id: 'G#m', variants: [variant('G\u266F', 4, 1, 5, 3)] },
  { id: 'Am', variants: [variant('A', 5, 0, 0, 3)] },
  { id: 'Bbm', variants: [variant('B\u266D', 6, -1, -5, 3)] },
  { id: 'Bm', variants: [variant('B', 6, 0, 2, 3)] },
  { id: 'Cm', variants: [variant('C', 0, 0, -3, 4)] },
  { id: 'C#m', variants: [variant('C\u266F', 0, 1, 4, 4)] },
  { id: 'Dm', variants: [variant('D', 1, 0, -1, 4)] },
  { id: 'Ebm', variants: [variant('E\u266D', 2, -1, -6, 4)] },
  { id: 'Em', variants: [variant('E', 2, 0, 1, 4)] },
  { id: 'Fm', variants: [variant('F', 3, 0, -4, 4)] },
  { id: 'F#m', variants: [variant('F\u266F', 3, 1, 3, 4)] },
];

function buildAscending(tonic, sig, form, octaves) {
  const notes = [];
  for (let i = 0; i <= octaves * 7; i++) {
    const letter = (tonic.letter + i) % 7;
    const octave = tonic.octave + Math.floor((tonic.letter + i) / 7);
    const degree = i % 7;
    let alter = sig[letter];
    if (form === 'harmonic' && degree === 6) alter += 1;
    if (form === 'melodic' && (degree === 5 || degree === 6)) alter += 1;
    const note = makeNote(letter, alter, octave);
    // An accidental is printed when the note departs from the key signature
    // (the raised 6th/7th of a minor scale, for example).
    note.courtesy = alter !== sig[letter];
    notes.push(note);
  }
  return notes;
}

export function buildScale(card, variantIndex = 0, mode = 'major', form = 'melodic', octaves = 2) {
  const v = card.variants[Math.min(variantIndex, card.variants.length - 1)];
  const tonic = { letter: v.letter, alter: v.alter, octave: v.octave };
  const sig = keySignature(v.fifths);
  const up = buildAscending(tonic, sig, mode === 'minor' ? form : 'major', octaves);
  const down =
    mode === 'minor' && form === 'melodic'
      ? buildAscending(tonic, sig, 'natural', octaves)
      : up;

  // On the way down a melodic minor needs courtesy naturals to cancel the
  // raised 6th and 7th printed on the way up.
  if (down !== up) {
    down.forEach((note, i) => {
      if (i < up.length && note.alter !== up[i].alter) note.courtesy = true;
    });
  }

  // Up to the top tonic, then back down to the bottom one.
  const sequence = up.concat(down.slice(0, octaves * 7).reverse());

  const name = v.name;
  const zh = getLang() === 'zh';
  const formName = zh
    ? { natural: '自然', harmonic: '和声', melodic: '旋律' }[form]
    : form;
  const title = mode === 'minor' ? `${name} ${formName}${zh ? '小调' : ' minor'}` : `${name}${zh ? '大调' : ' major'}`;

  return {
    cardId: card.id,
    variantIndex: Math.min(variantIndex, card.variants.length - 1),
    mode,
    form: mode === 'minor' ? form : null,
    name,
    title,
    fifths: v.fifths,
    keySignature: sig,
    spellings: card.variants.map((x) => x.name),
    up,
    sequence,
    rangeText: `${sequence[0].name} – ${sequence[octaves * 7].name}`,
    octaves,
    meta: t(`meta.${octaves === 1 ? 1 : 2}`, { o: octaves, n: sequence.length }),
    card,
  };
}

export function describeKey(fifths) {
  const n = Math.abs(fifths);
  if (n === 0) return t('key.none');
  const key = fifths > 0 ? (n === 1 ? 'key.sharp' : 'key.sharps') : n === 1 ? 'key.flat' : 'key.flats';
  return t(key, { n });
}
