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

/**
 * Loads the index, then every take. The whole set is under a megabyte, so it is
 * fetched once and kept: a passage uses maybe eight of the takes, but it is the
 * ones it does not use that make the next passage free.
 */
export async function loadBank(ctx, base = 'samples/', bank = emptyBank()) {
  bank.base = base.endsWith('/') ? base : `${base}/`;
  if (!bank.index.samples.length) {
    const response = await fetch(`${bank.base}index.json`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`samples: ${response.status}`);
    bank.index = await response.json();
  }
  const pending = bank.index.samples.filter((s) => !bank.buffers.has(s.id));
  await Promise.all(
    pending.map(async (sample) => {
      const response = await fetch(bank.base + sample.file, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`sample: ${sample.file}`);
      const bytes = await response.arrayBuffer();
      const buffer = await new Promise((resolve, reject) => {
        // Safari's decodeAudioData returns a promise; the older callback form
        // exists in the same browsers, so the promise is simply awaited.
        const done = ctx.decodeAudioData(bytes, resolve, reject);
        if (done && typeof done.then === 'function') done.then(resolve, reject);
      });
      bank.buffers.set(sample.id, buffer);
    }),
  );
  return bank;
}

/* ── How long a note sounds ──────────────────────────────────────────── */

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
export function noteShape(sample, { staccato, legato, duration, rate, bufferSeconds }) {
  const offset = (sample.skip || 0) + (legato ? 0.05 : 0);
  const available = (bufferSeconds - offset) / rate;
  const shortTake = staccato && sample.style === 'staccato';
  const want = shortTake
    ? Math.max(0.08, Math.min(available - 0.015, 0.7))
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
    play({ midi, at, duration, gain, ramp = 1, level = 'mf', legato = false, accent = false, staccato = false }) {
      const sample = pickSample(bank.index, midi, { staccato, accent, legato, level });
      if (!sample) return false;
      const buffer = bank.buffers.get(sample.id);
      if (!buffer) return false;

      // A take recorded at this very dynamic needs no impression of one: the
      // layers are only invented for the loudness that was not recorded.
      const recorded = sample.level === level;
      const tilt = recorded ? { gain: 1 } : LEVEL_TILT[level] || LEVEL_TILT.mf;
      const rate = rateFor(sample, midi);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;

      // The tilt: one filter, or two when the layer wants both ends shaped.
      let tail = source;
      if (tilt.lowpass) {
        const low = ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = tilt.lowpass;
        low.Q.value = tilt.lowpassQ || 0.7;
        tail.connect(low);
        tail = low;
      }
      if (tilt.highShelf) {
        const shelf = ctx.createBiquadFilter();
        shelf.type = 'highshelf';
        shelf.frequency.value = tilt.highShelfAt || 1500;
        shelf.gain.value = tilt.highShelf;
        tail.connect(shelf);
        tail = shelf;
      }

      const amp = ctx.createGain();
      tail.connect(amp).connect(destination);

      // A short note lets its staccato take ring out (see noteShape), an accent is
      // only louder, and a slur landing starts a little way into the take so it
      // has no attack of its own — that is the whole difference between a slur
      // and two notes.
      const { offset, want, attack, fade, shortTake } = noteShape(sample, {
        staccato,
        legato,
        duration,
        rate,
        bufferSeconds: buffer.duration,
      });
      const release = fade;
      // `ramp` is where a hairpin has got to (1 with no hairpin); the absolute
      // level comes from LEVEL_TILT, which is the sampled voice's own ladder —
      // using `gain` here as well would count the dynamic twice.
      const level_ = (ramp == null ? 1 : ramp) * tilt.gain;
      const peak = level_ * (sample.gain || 1) * BANK_GAIN;

      // A held note outlasts its take; the loop runs between two points an
      // integer number of periods apart, so the join lands on a zero crossing.
      // A short take is never looped: it is already as long as it is, and the
      // whole point is to let it end by itself.
      const span = (buffer.duration - offset) / rate;
      if (!shortTake && sample.loopEnd && want > span - 0.06) {
        source.loop = true;
        source.loopStart = sample.loopStart;
        source.loopEnd = sample.loopEnd;
      }

      const hold = Math.max(attack + 0.01, want - release);
      amp.gain.setValueAtTime(0, at);
      amp.gain.linearRampToValueAtTime(peak, at + attack);
      amp.gain.setValueAtTime(peak, at + hold);
      amp.gain.linearRampToValueAtTime(0, at + want);

      source.start(at, offset);
      source.stop(at + want + 0.06);
      return true;
    },
  };
}
