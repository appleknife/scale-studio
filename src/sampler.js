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
  const played = sample.midi + (sample.cents || 0) / 100;
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

/* ── The voice ────────────────────────────────────────────────────────── */

/**
 * A voice with the same `play()` shape as the synth in playback.js, so the player
 * can swap one for the other. Returns false when the take a note needs has not
 * loaded — the player then asks the synth, so a half-loaded bank still plays.
 */
export function sampleVoice(ctx, destination, bank) {
  return {
    play({ midi, at, duration, gain, level = 'mf', legato = false, accent = false, staccato = false }) {
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

      // A staccato note is cut short of its written length, an accent is only
      // louder, and a slur landing starts a little way into the take so it has
      // no attack of its own — that is the whole difference between a slur and
      // two notes.
      const want = staccato ? Math.max(0.07, Math.min(duration, duration * 0.5)) : duration;
      const offset = (sample.skip || 0) + (legato ? 0.05 : 0);
      const attack = legato ? 0.012 : 0.004;
      const release = Math.min(0.14, Math.max(0.035, want * 0.3));
      const peak = gain * tilt.gain * (sample.gain || 1);

      // A held note outlasts its take; the loop runs between two points an
      // integer number of periods apart, so the join lands on a zero crossing.
      const span = (buffer.duration - offset) / rate;
      if (sample.loopEnd && want > span - 0.06) {
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
