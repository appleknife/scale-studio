// capture.js — the recording page's engine: what to record, how to trim it, and
// how to hand it back in one file.
//
// This is a tool, not a student screen. The playback in the sight-reading
// section needs a real violin rather than an oscillator, and the only violin
// whose samples may be shipped in a public repo is the teacher's own: so this
// module lists the takes, the page records them, and everything comes back as a
// zip of WAVs plus a manifest the app's playback reads.
//
// Nothing here touches the DOM, so `tests/capture.test.html` can weigh it.

import { makeNote } from './music.js?v=202611021745';

/* ── What to record ───────────────────────────────────────────────────── */

/**
 * The passages run from G3 (the open G) to F6 (the Manual's level-VI ceiling), so
 * that is the range the voice has to cover. One sample every **whole tone**,
 * because sample playback stretches a note by at most a semitone before it starts
 * to sound pinched — a semitone per sample would be twice the recordings for no
 * audible gain.
 */
export const RANGE = { from: 55, to: 89, step: 2 };

/**
 * Staccato and accent are short sounds with a strong front; they survive being
 * stretched further than a sustain does, so five pitches spread over the range
 * are enough. The slur pairs come in twos and fours, from two comfortable
 * starting notes.
 */
export const ARTICULATION_PITCHES = [55, 62, 69, 76, 83];
export const SLUR_STARTS = [69, 74];
export const SLUR_STEPS = [2, 3, -2, -3];

// `makeNote` counts letters the way the staff does — C is 0 and B is 6, the
// diatonic index that `indexOf` uses everywhere else.
const SHARP_SPELLING = [
  [0, 0], // C
  [0, 1], // C♯
  [1, 0], // D
  [1, 1], // D♯
  [2, 0], // E
  [3, 0], // F
  [3, 1], // F♯
  [4, 0], // G
  [4, 1], // G♯
  [5, 0], // A
  [5, 1], // A♯
  [6, 0], // B
];

/** A MIDI number as a note the engraver can set: sharps, never flats. */
export function spell(midi) {
  const [letter, alter] = SHARP_SPELLING[midi % 12];
  return makeNote(letter, alter, Math.floor(midi / 12) - 1);
}

/**
 * Which string a violin would play this on, in first position — a suggestion, not
 * a rule: the teacher knows which string sounds best on their instrument.
 */
export function stringFor(midi) {
  if (midi <= 61) return 'G string';
  if (midi <= 68) return 'D string';
  if (midi <= 75) return 'A string';
  return midi <= 84 ? 'E string' : 'E string, higher position';
}

const levelName = (level) => (level === 'f' ? 'loud' : 'medium');

/** The notation a take is drawn with — the engraver's own event shape. */
function noteEvent(midi, dur, extra = {}) {
  return { start: 0, dur, rest: false, midi, note: spell(midi), ...extra };
}

export const STAGES = [
  {
    id: 'smooth-mf',
    name: 'Smooth bow · medium',
    title: 'détaché — the bow changes direction between every note',
    hint:
      'Two seconds of even bow at an easy mezzo-forte. No swell, no accent at the start, no ' +
      'fade at the end. A light vibrato is fine, but make every note the same.',
    seconds: 2,
    silence: 0.45,
  },
  {
    id: 'smooth-f',
    name: 'Smooth bow · loud',
    title: 'the same bowing again, louder',
    hint:
      'The same note list again, this time at a strong forte — the level you would use under a ' +
      'forte marking. Still even: loud is not the same as an accent.',
    seconds: 2,
    silence: 0.45,
  },
  {
    id: 'staccato',
    name: 'Short notes',
    title: 'staccato — the dotty note',
    hint: 'Short: about a quarter of a second, stopped with the bow still on the string.',
    seconds: 0.6,
    silence: 0.3,
  },
  {
    id: 'accent',
    name: 'Accents',
    title: 'a firm attack, then let it ring',
    hint: 'A hard, clean start — like the accented note in a passage — then hold two seconds.',
    seconds: 2,
    silence: 0.45,
  },
  {
    id: 'slur',
    name: 'Slurs',
    title: 'two notes in one bow — the second with no new attack',
    hint:
      'One smooth bow stroke for the pair. The second note must not be re-bowed: ' +
      'that is the whole point of the recording.',
    seconds: 2.4,
    silence: 0.45,
  },
];

/**
 * Every take, in the order the page walks them: one pitch at a time, medium then
 * loud, so the bow arm settles into a shape rather than jumping between styles.
 */
export function buildTakes() {
  const takes = [];
  const push = (take) => takes.push({ ...take, index: takes.length });

  // The two dynamic layers are two passes, not two takes per note: the bow arm
  // holds one level far better across eighteen notes than across thirty-six
  // alternations, and the page's rail then has one dot per pitch instead of two
  // dots with the same name.
  for (const level of ['mf', 'f']) {
    for (let midi = RANGE.from; midi <= RANGE.to; midi += RANGE.step) {
      const note = spell(midi);
      push({
        id: `smooth-${level}-${midi}`,
        stage: level === 'f' ? 'smooth-f' : 'smooth-mf',
        style: 'smooth',
        level,
        midi,
        file: `${note.name.replace('♯', 's')}-smooth-${level}.wav`.replace(/\s/g, ''),
        title: note.name,
        sub: `${stringFor(midi)} · ${levelName(level)} (${level})`,
        events: [noteEvent(midi, 16, { dynamic: level })],
      });
    }
  }
  for (const midi of ARTICULATION_PITCHES) {
    for (const style of ['staccato', 'accent']) {
      const note = spell(midi);
      push({
        id: `${style}-${midi}`,
        stage: style,
        style,
        level: style === 'accent' ? 'f' : 'mf',
        midi,
        file: `${note.name.replace('♯', 's')}-${style}.wav`,
        title: note.name,
        sub: `${stringFor(midi)} · ${style}`,
        events: [noteEvent(midi, 4, { mark: style })],
      });
    }
  }
  for (const from of SLUR_STARTS) {
    for (const step of SLUR_STEPS) {
      const to = from + step;
      const a = spell(from);
      const b = spell(to);
      const up = step > 0;
      const word = { 2: 'a tone', 3: 'a third' }[Math.abs(step)];
      push({
        id: `slur-${from}-${to}`,
        stage: 'slur',
        style: 'slur',
        level: 'mf',
        midi: from,
        toMidi: to,
        file: `${a.name.replace('♯', 's')}-${b.name.replace('♯', 's')}-slur.wav`,
        title: `${a.name} → ${b.name}`,
        sub: `${stringFor(from)} · ${word} ${up ? 'up' : 'down'}, one bow`,
        events: [
          { ...noteEvent(from, 8), slurStart: true },
          { ...noteEvent(to, 8), slurEnd: true, start: 2 },
        ],
      });
    }
  }
  return takes;
}

export const takesInStage = (takes, stage) => takes.filter((take) => take.stage === stage);

/* ── Trimming a take ──────────────────────────────────────────────────── */

/**
 * Cut a recording down to the note: everything before the bow speaks and after it
 * stops, with a short head and tail left on so the attack and the release are not
 * clipped, and a few milliseconds of fade at each end so the sample does not
 * begin or end with a click.
 */
export function trimTake(samples, sampleRate, { head = 0.02, tail = 0.06, fade = 0.006, floor = 0.004 } = {}) {
  let first = -1;
  let last = -1;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const level = Math.abs(samples[i]);
    if (level > peak) peak = level;
    if (level > floor) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return { samples: new Float32Array(0), peak, seconds: 0, silent: true };

  const start = Math.max(0, first - Math.round(head * sampleRate));
  const stop = Math.min(samples.length, last + Math.round(tail * sampleRate));
  const out = samples.slice(start, stop);

  const fadeCount = Math.max(1, Math.round(fade * sampleRate));
  for (let i = 0; i < fadeCount && i < out.length; i++) {
    out[i] *= i / fadeCount;
    out[out.length - 1 - i] *= i / fadeCount;
  }
  return { samples: out, peak, seconds: out.length / sampleRate, silent: false };
}

/* ── Files ────────────────────────────────────────────────────────────── */

/** A take as a 16-bit mono WAV — the format the build step converts from. */
export function encodeWav(samples, sampleRate) {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at, value) => {
    for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // size of this chunk
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0, at = 44; i < samples.length; i++, at += 2) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    // Rounded, not truncated: half scale is 16384, and truncating it to 16383 on
    // every sample is a quiet DC lean over a two-second note.
    view.setInt16(at, Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff), true);
  }
  return bytes;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** The CRC every zip entry carries; the format will not open without it. */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * A zip of `files` ([{ name, bytes }]), stored rather than deflated: WAVs barely
 * compress, and a correct stored archive is forty lines instead of a dependency.
 */
export function makeZip(files, when = new Date()) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2);
  const date =
    ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); // local file header
    head.setUint16(4, 20, true); // version needed
    head.setUint16(6, 0x0800, true); // UTF-8 names
    head.setUint16(8, 0, true); // stored
    head.setUint16(10, time, true);
    head.setUint16(12, date, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, file.bytes.length, true);
    head.setUint32(22, file.bytes.length, true);
    head.setUint16(26, name.length, true);
    head.setUint16(28, 0, true);
    chunks.push(new Uint8Array(head.buffer), name, file.bytes);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true); // central directory header
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, date, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, file.bytes.length, true);
    entry.setUint32(24, file.bytes.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push({ entry: new Uint8Array(entry.buffer), name });

    offset += 30 + name.length + file.bytes.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const { entry, name } of central) {
    chunks.push(entry, name);
    centralSize += 46 + name.length;
  }

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, centralStart, true);
  chunks.push(new Uint8Array(end.buffer));

  return new Blob(chunks, { type: 'application/zip' });
}

/* ── The microphone ───────────────────────────────────────────────────── */

/**
 * The input, opened once for the whole session: the teacher should not have to
 * answer a permission prompt for every one of fifty takes.
 *
 * Automatic gain, echo cancellation and noise suppression are all switched off —
 * they are tuned for speech and they pump and gate a sustained violin note, which
 * is exactly what we are trying to capture.
 */
export async function openInput({ onLevel } = {}) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    },
    video: false,
  });
  await ctx.resume().catch(() => {});

  const source = ctx.createMediaStreamSource(stream);
  // A deprecated node, and the only tap that works in every browser without
  // shipping a worklet module. This is a recording tool, not the app's audio path.
  const tap = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;

  let frames = null;
  tap.onaudioprocess = (event) => {
    const frame = event.inputBuffer.getChannelData(0);
    if (onLevel) {
      let sum = 0;
      for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
      onLevel(Math.sqrt(sum / frame.length));
    }
    if (frames) frames.push(frame.slice());
  };
  source.connect(tap);
  tap.connect(mute);
  mute.connect(ctx.destination);

  return {
    sampleRate: ctx.sampleRate,
    begin() {
      frames = [];
    },
    end() {
      const captured = frames || [];
      frames = null;
      const total = captured.reduce((n, f) => n + f.length, 0);
      const out = new Float32Array(total);
      let at = 0;
      for (const f of captured) {
        out.set(f, at);
        at += f.length;
      }
      return out;
    },
    /** A soft reference pitch, so the take starts on the right note. */
    playTone(midi, seconds = 1.1) {
      const now = ctx.currentTime + 0.02;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.03);
      gain.gain.setValueAtTime(0.16, now + seconds - 0.15);
      gain.gain.linearRampToValueAtTime(0, now + seconds);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + seconds + 0.05);
    },
    close() {
      frames = null;
      tap.disconnect();
      source.disconnect();
      mute.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      ctx.close().catch(() => {});
    },
  };
}
