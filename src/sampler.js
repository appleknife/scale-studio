// sampler.js — the recorded voice.
//
// playback.js turns a passage into a list of notes to play; this turns each of
// those into a sound. The teacher recorded one sustained note every whole tone
// from G3 to F6, plus five short notes, five accents and eight slur landings, so
// the app can play a passage on a real violin instead of an oscillator.
//
// Two things make the recordings usable rather than merely present:
//
//  * **The tuning is corrected per take.** Measured against equal temperament the
//    takes sit anywhere from 26 cents flat to 20 cents sharp, which is normal for
//    a human and fatal for a sample set: played one after another they would
//    sound like an instrument that cannot tune. Each entry carries its own `cents`
//    and the playback rate is adjusted by exactly that much, so the set is in tune
//    with itself and the teacher's vibrato still moves around a true centre.
//  * **The levels are evened out.** The takes were played at whatever dynamic felt
//    right, so their RMS differs by nearly 5 dB; `gain` on each entry flattens it.
//
// The loud and soft layers are made here rather than recorded: a gain change plus
// a gentle filter tilt. That is not the same as a real forte — see the README —
// but it is close enough that the passage sounds bowed at every dynamic, and real
// f and p takes replace it the day they are recorded.

/** How loud each printed dynamic is against the recorded mezzo-forte. */
export const LEVEL_GAIN = { p: 0.45, mp: 0.66, mf: 1, f: 1.34, ff: 1.6 };

/**
 * The takes were recorded with a lot of headroom — peaks between −25 and −13
 * dBFS, the page asks for "peak in the green" — so the sampler brings the whole
 * set up to the level the rest of the app is mixed at. Their room tone sits 42
 * to 49 dB below the note, so a 18 dB lift puts the noise floor around −55 dBFS:
 * inaudible under the note. Before this the example was roughly 20 dB quieter
 * than the metronome at the same slider position.
 */
export const BANK_GAIN = 6.5;

/**
 * The tilt that stands in for bowing harder or softer. A forte is brighter, not
 * just louder; a piano has its top thinned out. Frequencies are the point at
 * which the shape starts, in hertz.
 */
export const LEVEL_TILT = {
  p: { gain: 0.45, lowpass: 2400, lowpassQ: 0.6, highShelf: -4, highShelfAt: 1200 },
  mp: { gain: 0.66, lowpass: 3400, lowpassQ: 0.6, highShelf: -2, highShelfAt: 1400 },
  mf: { gain: 1 },
  f: { gain: 1.34, highShelf: 3.5, highShelfAt: 1600 },
  ff: { gain: 1.6, highShelf: 5, highShelfAt: 1600 },
};

/** The articulation a note asks for, as the sample set spells it. */
const STYLES = { smooth: 'smooth', staccato: 'staccato', accent: 'accent', slur: 'slurhead' };

/** How far a take may be stretched before another take is the better answer. */
const STRETCH = { smooth: 1, staccato: 3, accent: 3, slurhead: 3 };

/**
 * The take to use for `midi`, out of the ones the bank holds. Articulation takes
 * are preferred when they exist and are close enough in pitch; otherwise the
 * sustained note is used and the shaping is done with the envelope.
 */
export function pickSample(index, midi, { staccato = false, accent = false, legato = false, level = 'mf' } = {}) {
  const byStyle = new Map();
  for (const sample of index.samples) {
    if (!byStyle.has(sample.style)) byStyle.set(sample.style, []);
    byStyle.get(sample.style).push(sample);
  }

  /** The nearest take of `style`, preferring one recorded at `level` if there is one. */
  const nearest = (style, level) => {
    const list = byStyle.get(style) || [];
    const layers = level ? [level, 'mf', null] : ['mf', null];
    for (const want of layers) {
      let best = null;
      for (const sample of list) {
        if (want && sample.level !== want) continue;
        const away = Math.abs(sample.midi - midi);
        if (away > STRETCH[style]) continue;
        if (!best || away < best.away) best = { sample, away };
      }
      if (best) return best.sample;
    }
    return null;
  };

  if (legato) {
    // The landing of a real slur: the second note with no new bow.
    const head = nearest(STYLES.slur, level);
    if (head) return head;
  }
  if (staccato) {
    const short = nearest(STYLES.staccato, level);
    if (short) return short;
  }
  if (accent) {
    const hard = nearest(STYLES.accent, level);
    if (hard) return hard;
  }
  return nearest(STYLES.smooth, level);
}

/**
 * The playback rate that puts `midi` exactly in tune, whatever the take's own
 * error was. `midi` is where the page wants the note; the take was played at
 * `sample.midi` plus or minus its measured cents.
 */
export function rateFor(sample, midi) {
  // `tune` is a deliberate offset on top of the measurement: the teacher's ear
  // said the A takes sat a little low, so they sit a few cents high — the same
  // thing a soloist does to the A string, and written down here rather than
  // baked into the file so it can be changed without re-recording anything.
  const played = sample.midi + ((sample.cents || 0) - (sample.tune || 0)) / 100;
  return Math.pow(2, (midi - played) / 12);
}

/* ── The bank ─────────────────────────────────────────────────────────── */

export function emptyBank() {
  return { index: { samples: [] }, buffers: new Map(), base: 'samples/' };
}

/** How long one take is given to decode before it is left out of the bank. */
const DECODE_MS = 8000;

function decodeOne(ctx, bytes) {
  return new Promise((resolve, reject) => {
    // Safari's decodeAudioData returns a promise; the older callback form exists
    // in the same browsers, so both are wired up and the first answer wins.
    const timer = setTimeout(() => reject(new Error('decode timed out')), DECODE_MS);
    const settle = (fn) => (value) => {
      clearTimeout(timer);
      fn(value);
    };
    const done = ctx.decodeAudioData(bytes, settle(resolve), settle(reject));
    if (done && typeof done.then === 'function') done.then(settle(resolve), settle(reject));
  });
}

/**
 * Loads the index, then every take. The whole set is under a megabyte, so it is
 * fetched once and kept: a passage uses maybe eight of the takes, but it is the
 * ones it does not use that make the next passage free.
 */
/**
 * Can this browser decode the recorded takes at all?
 *
 * They are m4a (AAC), which every mainstream browser decodes and some Chromium
 * builds do not. Asking first matters because the failure is not clean: a
 * browser without the codec can leave decodeAudioData unsettled for ever, and on
 * one build here it takes the page down with it. The app is better off knowing
 * to use the synthesiser than finding out that way.
 */
export async function canDecodeTakes() {
  if (!navigator.mediaCapabilities?.decodingInfo) return true; // old browser: try it
  try {
    const info = await navigator.mediaCapabilities.decodingInfo({
      type: 'file',
      audio: {
        contentType: 'audio/mp4; codecs="mp4a.40.2"',
        channels: 1,
        samplerate: 44100,
        bitrate: 96000,
      },
    });
    return Boolean(info && info.supported);
  } catch {
    return true; // it could not answer; let the decode try
  }
}

export async function loadBank(ctx, base = 'samples/', bank = emptyBank()) {
  bank.base = base.endsWith('/') ? base : `${base}/`;
  if (!bank.index.samples.length) {
    const response = await fetch(`${bank.base}index.json`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`samples: ${response.status}`);
    bank.index = await response.json();
  }
  if (!(await canDecodeTakes())) {
    // No AAC decoder: hand back the index and no buffers, so every note falls
    // through to the synthesiser instead of crashing the page trying to decode.
    bank.failed = bank.index.samples.length;
    bank.noCodec = true;
    return bank;
  }
  const pending = bank.index.samples.filter((s) => !bank.buffers.has(s.id));
  await Promise.all(
    pending.map(async (sample) => {
      const response = await fetch(bank.base + sample.file, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`sample: ${sample.file}`);
      const bytes = await response.arrayBuffer();
      let buffer;
      try {
        buffer = await decodeOne(ctx, bytes);
      } catch {
        // A browser without the AAC decoder does not always *reject* — some
        // leave decodeAudioData unsettled for ever — and one take like that used
        // to hold the whole bank waiting, so the recorded violin never arrived
        // at all. A take that cannot be decoded is left out instead: the note it
        // would have covered falls through to the synthesiser, which is the
        // fallback a missing take already uses.
        bank.failed = (bank.failed || 0) + 1;
        return;
      }
      bank.buffers.set(sample.id, buffer);
    }),
  );
  return bank;
}

/* ── How long a note sounds ──────────────────────────────────────────── */

/**
 * How a note longer than its take is stitched together.
 *
 * The obvious way is `source.loop`, and it is what the voice used do — but a
 * hard loop is audible on a held note for two reasons that have nothing to do
 * with clicks. The first is the seam: even joining zero crossing to zero
 * crossing, the *envelope* either side of the join does not match, so every pass
 * is a small step in loudness. The second is worse on a sustained violin: the
 * take has vibrato, and a hard loop repeats one cycle of it exactly, so the note
 * acquires a pulse that no player would produce. On a level I whole note that is
 * four seconds of audible machinery.
 *
 * So the note is played as a chain of passes through the middle of the take,
 * each starting before the previous one ends, with an **equal-power crossfade**
 * between them. There is no seam to hear: the two copies are different parts of
 * the vibrato, and they cross while both are sounding. Each pass is a separate
 * buffer source, so this costs nothing but a few nodes.
 *
 * Returns the passes as plain numbers — start time, where in the take, how long,
 * and the two fades — so the arithmetic can be tested without any audio.
 */
export function loopPasses({ at, want, offset, rate, loopStart, loopEnd, attack = 0.004, release = 0.1 }) {
  const passes = [];
  const passLen = Math.max(0.05, (loopEnd - loopStart) / rate);
  const firstLen = Math.max(0.05, (loopEnd - offset) / rate);
  // Long enough that the two copies are never in phase, short enough to hide in
  // the note; never longer than a third of the pass, or the note would be more
  // crossfade than take.
  const cross = Math.min(0.18, passLen * 0.33);
  const endsAt = at + want;

  let start = at;
  let from = offset;
  let span = firstLen;
  let first = true;

  for (let guard = 0; guard < 64; guard++) {
    const length = Math.min(span, endsAt - start);
    if (!(length > 0.01)) break;
    const more = start + length < endsAt - 0.01;
    passes.push({
      from,
      start,
      length,
      fadeIn: first ? Math.min(attack, length * 0.5) : Math.min(cross, length * 0.5),
      fadeOut: more ? Math.min(cross, length * 0.5) : Math.min(release, length * 0.5),
      first,
    });
    if (!more) break;
    // The next pass begins one crossfade before this one ends, so the two are
    // always sounding together across the join.
    start = start + length - passes[passes.length - 1].fadeOut;
    from = loopStart;
    span = passLen;
    first = false;
  }
  return passes;
}

/**
 * The envelope for one note: where to start in the take, how long to let it
 * sound, and how long the fades are.
 *
 * The interesting case is a **short note**. A recorded staccato take is 0.4 to
 * 0.6 s long and most of that is the note's own ring: the bow has already
 * stopped by then, and the sound is dying away. Cutting such a take at the
 * written length — which is what the voice used to do — chops the ring off and
 * makes every dotted note sound clipped. So a short note played from a *staccato*
 * take is allowed to ring out in full and simply runs under the next note. A
 * short note played from a sustained take is still cut, because a sustained
 * take has no ring to give: it would just be a long note in the wrong rhythm.
 */
export function noteShape(sample, { staccato, legato, duration, written, rate, bufferSeconds, nextIn = Infinity }) {
  // A slur take is a **pair** of notes: it starts on the note the teacher slurred
  // *from* and lands on the one the bank files it under. Starting 50 ms into it
  // was still inside that departure, so any slur landing on a pitch near a take's
  // recorded departure played two notes at once — the real previous note still
  // ringing, and a fragment of the take's own D or A underneath it. The landing
  // begins where the take's loop begins (the capture tool marks it there), so a
  // slurred note now starts exactly there and the departure is never heard.
  const legatoStart = sample.style === 'slurhead' && sample.loopStart ? sample.loopStart : 0.05;
  const offset = (sample.skip || 0) + (legato ? legatoStart : 0);
  const available = (bufferSeconds - offset) / rate;
  const shortTake = staccato && sample.style === 'staccato';
  // How long a short note may ring: its take, but never much past its own slot.
  // The dotted-eighth-and-sixteenth figure is why. Marked staccato, the written
  // pair is 0.51 s then 0.17 s; letting the sixteenth ring its whole 0.42 s take
  // ran it far into the next beat and the pair stopped sounding like dotted-short
  // and started sounding like two long notes. One and a half times the written
  // length keeps the ring audible and the rhythm intact — a sixteenth gets 0.26 s
  // of your take's decay, a dotted eighth still gets all of it.
  // ... and never so long that it is still sounding when a *different* note
  // arrives. Three hundredths past the next onset is enough for the decay to feel
  // natural rather than chopped.
  const room = Math.max(
    0.1,
    Math.min((written || duration) * 1.5, Number.isFinite(nextIn) ? nextIn + 0.03 : Infinity),
  );

  const want = shortTake
    ? Math.max(0.08, Math.min(available - 0.015, room, 0.7))
    : Math.max(0.04, duration);
  const attack = shortTake ? 0.003 : legato ? 0.012 : 0.004;
  // A short take fades only in its last few milliseconds, where the recording is
  // already 40 dB down; a cut note takes a real release so it does not click.
  const fade = shortTake ? Math.min(0.05, want * 0.15) : Math.min(0.14, Math.max(0.035, want * 0.3));
  return { offset, want, attack, fade, available, shortTake };
}

/* ── The voice ────────────────────────────────────────────────────────── */

/**
 * A voice with the same `play()` shape as the synth in playback.js, so the player
 * can swap one for the other. Returns false when the take a note needs has not
 * loaded — the player then asks the synth, so a half-loaded bank still plays.
 */
export function sampleVoice(ctx, destination, bank) {
  return {
    play({ midi, at, duration, written, gain, ramp = 1, level = 'mf', legato = false, accent = false, staccato = false, nextIn = Infinity, nextMidi = null }) {
      const sample = pickSample(bank.index, midi, { staccato, accent, legato, level });
      if (!sample) return false;
      const buffer = bank.buffers.get(sample.id);
      if (!buffer) return false;

      // A take recorded at this very dynamic needs no impression of one: the
      // layers are only invented for the loudness that was not recorded.
      const recorded = sample.level === level;
      const tilt = recorded ? { gain: 1 } : LEVEL_TILT[level] || LEVEL_TILT.mf;
      const rate = rateFor(sample, midi);

      // The tilt: one filter, or two when the layer wants both ends shaped. It
      // sits between every pass and the note's own gain, so all the copies of a
      // held note are shaped once.
      const amp = ctx.createGain();
      let head = amp;
      if (tilt.highShelf) {
        const shelf = ctx.createBiquadFilter();
        shelf.type = 'highshelf';
        shelf.frequency.value = tilt.highShelfAt || 1500;
        shelf.gain.value = tilt.highShelf;
        shelf.connect(head);
        head = shelf;
      }
      if (tilt.lowpass) {
        const low = ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = tilt.lowpass;
        low.Q.value = tilt.lowpassQ || 0.7;
        low.connect(head);
        head = low;
      }
      amp.connect(destination);

      // A short note lets its staccato take ring out (see noteShape), an accent is
      // only louder, and a slur landing starts a little way into the take so it
      // has no attack of its own — that is the whole difference between a slur
      // and two notes.
      // A ringing short note may run under the next one only when it is the same
      // pitch: two different notes sounding together is not a ring, it is a
      // mistake, and it is what "I can hear two notes at once" is.
      const clashes = nextMidi != null && nextMidi !== midi;
      const { offset, want, attack, fade, shortTake } = noteShape(sample, {
        staccato,
        legato,
        duration,
        written,
        rate,
        bufferSeconds: buffer.duration,
        nextIn: clashes ? nextIn : Infinity,
      });
      const release = fade;
      // `ramp` is where a hairpin has got to (1 with no hairpin); the absolute
      // level comes from LEVEL_TILT, which is the sampled voice's own ladder —
      // using `gain` here as well would count the dynamic twice.
      const level_ = (ramp == null ? 1 : ramp) * tilt.gain;
      const peak = level_ * (sample.gain || 1) * BANK_GAIN;

      // One pass is the whole note for everything except a held note that outlasts
      // its take. Those are stitched from several passes with crossfades (see
      // loopPasses) instead of a hard loop, because a hard loop repeats the
      // take's vibrato exactly and that is audible on a four-second note.
      const span = (buffer.duration - offset) / rate;
      const held = !shortTake && sample.loopEnd && want > span - 0.03;
      const passes = held
        ? loopPasses({
            at,
            want,
            offset,
            rate,
            loopStart: sample.loopStart,
            loopEnd: sample.loopEnd,
            attack,
            release,
          })
        : [{ from: offset, start: at, length: want, fadeIn: attack, fadeOut: release, first: true }];

      for (const pass of passes) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        const gain = ctx.createGain();
        source.connect(gain).connect(head);

        // Equal power, not linear: two copies of the same note fading past each
        // other at half volume each would sum to a dip, which is exactly the
        // pulse this is here to remove. sin/cos keeps the sum constant.
        const t0 = pass.start;
        const t1 = t0 + pass.fadeIn;
        const t3 = t0 + pass.length;
        const t2 = Math.max(t1, t3 - pass.fadeOut);
        const curve = (up, steps = 24) => {
          const out = new Float32Array(steps);
          for (let i = 0; i < steps; i++) {
            const x = i / (steps - 1);
            out[i] = peak * (up ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2));
          }
          return out;
        };

        gain.gain.setValueAtTime(0, t0);
        gain.gain.setValueCurveAtTime(curve(true), t0, Math.max(0.001, pass.fadeIn));
        gain.gain.setValueAtTime(peak, t1);
        if (t2 > t1) gain.gain.setValueAtTime(peak, t2);
        gain.gain.setValueCurveAtTime(curve(false), t2, Math.max(0.001, t3 - t2));

        source.start(t0, pass.from);
        source.stop(t3 + 0.02);
      }
      return true;
    },
  };
}
