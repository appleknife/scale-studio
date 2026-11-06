// playback.js — hearing the passage before playing it.
//
// Two layers, deliberately separate:
//
//   schedule()  turns a passage into a list of notes to play: when each one
//               sounds, how loud, whether it starts a new bow stroke or carries
//               on from the last. Pure arithmetic, so a test can weigh it.
//   player      puts that list through a voice into the speakers and calls back
//               once per frame with where the music has got to, so the score can
//               show a playhead.
//
// The voice is the teacher's **own violin** when the samples are loaded (see
// sampler.js), and a synthesised bowed string when they are not — oscillators,
// bow noise and a filter envelope, good enough that the rhythm and the shaping
// are audible, and obviously not a violin. The sampled voice slots in without
// anything else changing: the
// player only asks the voice to `play({ midi, at, duration, gain, legato })`.

import { makeHallIR } from './recorder.js?v=202611068600';
import { sampleVoice, loadBank, emptyBank } from './sampler.js?v=202611068600';

/** How long each tempo unit lasts, counted in quarter notes. */
const UNIT_QUARTERS = { w: 4, h: 2, qd: 1.5, q: 1, e: 0.5 };

export function secondsPerQuarter(tempo) {
  // A marking counts *units* per minute: "dotted quarter = 72" means seventy-two
  // dotted quarters a minute, so one of them lasts 60/72 s and a quarter note —
  // which is two thirds of it — lasts 40/72 s. Every duration in the app is kept
  // in sixteenths, so this is the one conversion that has to be right.
  const quarters = UNIT_QUARTERS[tempo.unit] || 1;
  return 60 / tempo.bpm / quarters;
}

/**
 * How a bar divides into clicks, for the count-in and for a click track.
 *
 * The click follows the metre the way a player counts it: a quarter in 4/4, 3/4
 * and 2/4; a half in cut time, because a bar of 2/2 is two beats and not four; and
 * an eighth in 6/8, so a student counts six rather than the two dotted quarters an
 * advanced player feels. Plain numbers, so the count-in can be tested without any
 * audio.
 */
export function countInPlan(meter, tempo) {
  const spq = secondsPerQuarter(tempo);
  const [num, den] = String(meter).split('/').map(Number);
  const quartersPerBar = (num / den) * 4;
  const felt = den === 2 ? 2 : den === 8 ? 0.5 : 1; // half · eighth · quarter
  const clicks = Math.max(1, Math.round(quartersPerBar / felt));
  const interval = spq * felt;
  return { clicks, interval, seconds: clicks * interval };
}

/**
 * What each dynamic marking is worth as a gain. These are ratios between the
 * markings, not absolute levels: the master gain decides the volume.
 */
export const DYNAMIC_GAIN = { pp: 0.34, p: 0.46, mp: 0.58, mf: 0.72, f: 0.86, ff: 1 };

/**
 * A passage as a list of notes to play.
 *
 * `start` and `dur` are counted in sixteenth notes and `tempo` in quarter notes,
 * so every time here is (sixteenths / 4) × seconds-per-quarter. A `rate` below 1
 * slows the whole thing down for a first read.
 *
 * Three musical shapes are applied, because a playback that ignores them sounds
 * like a metronome: a slur makes the second note continue the first bow (no new
 * attack), a staccato shortens the note, and a hairpin ramps the gain across the
 * notes it covers.
 */
/**
 * The dynamic whose printed level is closest to this gain.
 *
 * A sampled voice picks a *take* per dynamic, so a crescendo is best played by
 * stepping the take up the ladder rather than by turning one take up: a p take at
 * 1.9× its recorded level is louder than an f take, and sounds it. Naming the
 * nearest rung keeps the gain asked of any take within a few per cent of the level
 * it was recorded at, and the ladder is walked from p to f as the hairpin rises.
 */
const LADDER = ['p', 'mp', 'mf', 'f', 'ff'];

function levelForGain(gain) {
  let best = LADDER[0];
  let away = Infinity;
  for (const name of LADDER) {
    const distance = Math.abs(DYNAMIC_GAIN[name] - gain);
    if (distance < away) {
      away = distance;
      best = name;
    }
  }
  return best;
}

export function schedule(passage, { rate = 1, fromBar = 0 } = {}) {
  const spq = secondsPerQuarter(passage.tempo) / rate;
  const base = DYNAMIC_GAIN[passage.dynamic] ?? DYNAMIC_GAIN.mf;
  const swell = passage.swell || null;
  const notes = [];
  let previous = null;
  // Everything before the bar the reader picked is simply not played, and the
  // clock starts at that bar. Keeping the whole passage here (rather than handing
  // the player a sliced copy) keeps every bar index — and so the hairpin, which
  // names the bar it lives in — pointing where it did.
  const offset = ((fromBar * passage.perBar) / 4) * spq;

  for (let index = 0; index < passage.bars.length; index++) {
    const bar = passage.bars[index];
    for (let i = 0; i < bar.length; i++) {
      const event = bar[i];
      if (index < fromBar) {
        // Nothing before the cut is heard, and the first note after it gets a
        // fresh attack rather than being tied to a note nobody heard.
        previous = null;
        continue;
      }
      if (event.rest || !event.note) {
        previous = null;
        continue;
      }
      const time = ((index * passage.perBar + event.start) / 4) * spq - offset;
      let duration = (event.dur / 4) * spq;
      let gain = base;

      // A hairpin is a ramp across the notes it covers — from the marking the
      // passage opens with to the one the hairpin arrives at, which is the marking
      // printed beside its open end. With no target to reach it still ramps, just
      // less far.
      if (swell && swell.bar === index && i >= swell.from && i <= swell.to) {
        const steps = Math.max(1, swell.to - swell.from);
        const through = (i - swell.from) / steps;
        // Both directions run from the marking the passage opens with to the one
        // the ramp arrives at; only the target differs, so there is no second
        // direction to encode here.
        const goal = DYNAMIC_GAIN[swell.target] ?? base * (swell.kind === 'dim' ? 0.75 : 1.25);
        gain = base + (goal - base) * through;
      }

      // Which take this note should be made of, when the voice has layers. It
      // follows the loudness itself rather than the passage's opening marking: on
      // a p → f crescendo it walks p → mp → mf → f, so each take plays near the
      // level it was recorded at instead of one take being turned up 1.9× (which
      // is what made some playbacks sound exaggerated).
      const level = levelForGain(gain);

      const legato = Boolean(previous && previous.slurStart);
      if (event.mark === 'accent') gain *= 1.14;
      if (event.mark === 'staccato') duration *= 0.45;

      const levelGain = DYNAMIC_GAIN[level] ?? base;
      notes.push({
        time,
        duration,
        midi: event.midi,
        gain,
        // The printed dynamic of *this* note, so a sampled voice can choose its
        // layer; and the hairpin as a ratio against that same dynamic, because a
        // recorded take already carries its own level — 1 means "as recorded".
        level,
        ramp: levelGain > 0 ? gain / levelGain : 1,
        legato,
        accent: event.mark === 'accent',
        staccato: event.mark === 'staccato',
        /** True when the next note is slurred out of this one. */
        tied: Boolean(event.slurStart),
      });
      previous = event;
    }
  }

  const seconds = notes.reduce((end, note) => Math.max(end, note.time + note.duration), 0);
  return { notes, seconds, secondsPerQuarter: spq };
}

/* ── The placeholder voice ────────────────────────────────────────────── */

let noise = null;

function bowNoise(ctx) {
  if (!noise) {
    const length = Math.floor(ctx.sampleRate * 0.4);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/**
 * A bowed string, roughly: two sawtooths a hair apart for the body of the tone, a
 * triangle underneath for weight, a lowpass that closes as the note is held, a
 * few cents of vibrato that arrives after the attack, and a scrape of filtered
 * noise where the bow meets the string. It is not a violin — but it *is* a string,
 * which is enough to hear a rhythm.
 */
export function bowedVoice(ctx, destination) {
  return {
    play({ midi, at, duration, gain, legato = false, accent = false, staccato = false, tied = false }) {
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const attack = legato ? 0.02 : accent ? 0.012 : 0.045;
      const release = staccato ? 0.05 : tied ? 0.05 : 0.18;
      const hold = Math.max(attack + 0.02, duration - release);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, at);
      amp.gain.linearRampToValueAtTime(gain, at + attack);
      amp.gain.setValueAtTime(gain, at + hold);
      amp.gain.linearRampToValueAtTime(0, at + duration);

      const body = ctx.createBiquadFilter();
      body.type = 'lowpass';
      body.frequency.setValueAtTime(legato ? 1900 : 2900, at);
      body.frequency.linearRampToValueAtTime(1500, at + duration);
      body.Q.value = 0.8;

      const saw = ctx.createOscillator();
      saw.type = 'sawtooth';
      saw.frequency.value = freq;
      const sawB = ctx.createOscillator();
      sawB.type = 'sawtooth';
      sawB.frequency.value = freq;
      sawB.detune.value = 5;
      const sub = ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.value = freq;

      const mixB = ctx.createGain();
      mixB.gain.value = 0.55;
      const mixC = ctx.createGain();
      mixC.gain.value = 0.32;

      saw.connect(body);
      sawB.connect(mixB).connect(body);
      sub.connect(mixC).connect(body);
      body.connect(amp).connect(destination);

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, at);
      depth.gain.linearRampToValueAtTime(7, at + Math.min(0.3, duration * 0.6));
      lfo.connect(depth);
      depth.connect(saw.detune);
      depth.connect(sawB.detune);

      const stop = at + duration + 0.05;
      for (const osc of [saw, sawB, sub, lfo]) {
        osc.start(at);
        osc.stop(stop);
      }

      // The bow's own noise, only where a stroke begins.
      if (!legato) {
        const scrape = ctx.createBufferSource();
        scrape.buffer = bowNoise(ctx);
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = Math.min(7000, freq * 4);
        band.Q.value = 1.1;
        const burst = ctx.createGain();
        burst.gain.setValueAtTime(accent ? 0.5 : 0.22, at);
        burst.gain.exponentialRampToValueAtTime(0.001, at + 0.09);
        scrape.connect(band).connect(burst).connect(destination);
        scrape.start(at);
        scrape.stop(at + 0.12);
      }
    },
  };
}

/* ── The player ───────────────────────────────────────────────────────── */

/**
 * One player for the whole page: an AudioContext may only be created from a
 * gesture, and the user's click is that gesture — so the first play makes it and
 * every later play reuses it.
 */
export function createPlayer({ wet = 0.24, volume: start = 0.8 } = {}) {
  let ctx = null;
  let master = null;
  let dry = null;
  let hall = null;
  let hallGain = null;
  let current = null;
  let volume = Math.max(0, Math.min(1, start));
  // The recorded violin, once it has loaded. Until then — and for any single
  // note the bank cannot cover — the synth answers.
  let bank = null;
  let bankReady = false;

  // Half scale at full volume: a monophonic line of shaped notes needs the
  // headroom, and the slider then goes from silent to "as loud as it gets".
  const levelFor = (v) => 0.5 * v;

  /** The input side of the hall, created on first use. */
  function hallInput() {
    if (!hall) build();
    return hall;
  }

  function build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('no-audio');
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = levelFor(volume);
    master.connect(ctx.destination);

    dry = ctx.createGain();
    dry.gain.value = 1;
    dry.connect(master);

    hall = ctx.createConvolver();
    hall.buffer = makeHallIR(ctx, 2.4, 3.4);
    hallGain = ctx.createGain();
    hallGain.gain.value = wet;
    hall.connect(hallGain).connect(master);
  }

  return {
    get playing() {
      return Boolean(current);
    },

    /**
     * The audio context and the node everything is mixed into, so the metronome
     * can share them: one context per page (browsers give you a limited number),
     * and one volume control for every sound the app makes.
     */
    get context() {
      if (!ctx) build();
      return ctx;
    },

    get output() {
      if (!ctx) build();
      return master;
    },

    get volume() {
      return volume;
    },

    /** 0–1. Applied smoothly, so dragging the slider does not click. */
    setVolume(next) {
      volume = Math.max(0, Math.min(1, Number(next) || 0));
      if (master) master.gain.setTargetAtTime(levelFor(volume), ctx.currentTime, 0.02);
      return volume;
    },

    /**
     * Plays `passage` and calls `onTick(seconds)` every frame while it sounds, so
     * a playhead can follow. Resolves when the last note's tail has died away.
     */
    play(passage, { rate = 1, fromBar = 0, onTick = null, onEnd = null } = {}) {
      if (!ctx) build();
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
      this.stop();

      const plan = schedule(passage, { rate, fromBar });
      // Every sounding of the passage gets its own gate, wired to the dry path and
      // to the hall. Stopping closes the gate — cancelling the animation was all
      // the old stop did, and since every note is scheduled up front the music
      // simply carried on to the end of the bar.
      const gate = ctx.createGain();
      gate.gain.value = 1;
      gate.connect(dry);
      gate.connect(hallInput());

      const voice = bowedVoice(ctx, gate);
      const sampled = bank ? sampleVoice(ctx, gate, bank) : null;
      const start = ctx.currentTime + 0.14;
      for (let i = 0; i < plan.notes.length; i++) {
        const note = plan.notes[i];
        const next = plan.notes[i + 1];
        const when = {
          ...note,
          at: start + note.time,
          // How much room there is before the next note, and what it is: a short
          // take may ring on *under its own pitch*, but ringing on under a
          // different one is heard as two notes at once.
          nextIn: next ? next.time - note.time : Infinity,
          nextMidi: next ? next.midi : null,
        };
        // A note the bank has no take for falls through to the synth, so a
        // half-loaded set is a slightly mixed voice rather than silence.
        if (!(sampled && sampled.play(when))) voice.play(when);
      }

      const frame = () => {
        if (!current) return;
        const t = Math.max(0, ctx.currentTime - start);
        if (onTick) onTick(Math.min(t, plan.seconds));
        if (t <= plan.seconds + 0.35) {
          current.raf = requestAnimationFrame(frame);
        } else {
          this.stop();
          if (onEnd) onEnd();
        }
      };

      current = { plan, start, raf: requestAnimationFrame(frame), gate };
      return plan;
    },

    stop() {
      if (!current) return;
      cancelAnimationFrame(current.raf);
      const { gate } = current;
      current = null;
      const now = ctx.currentTime;
      // Fade the gate over 40 ms rather than cutting: a hard stop on a sounding
      // note is a click. Then tear the node down, so a passage that has been
      // stopped releases its oscillators instead of ringing out.
      gate.gain.setValueAtTime(gate.gain.value, now);
      gate.gain.linearRampToValueAtTime(0, now + 0.04);
      setTimeout(() => gate.disconnect(), 400);
    },

    /** Which position, in sixteenths, the music has reached at `seconds`. */
    positionAt(plan, seconds) {
      return (seconds / plan.secondsPerQuarter) * 4;
    },

    /**
     * Loads the recorded violin and switches the player over to it. Safe to call
     * more than once: the bank is fetched on the first call and handed back
     * afterwards, so a second passage costs nothing.
     */
    loadVoice(base = 'samples/') {
      if (!bank) bank = emptyBank();
      // Decoding needs *a* context, not the playing one: an OfflineAudioContext
      // can be made before the student has touched anything, which is what lets
      // the violin load while they are still reading the page. The buffers it
      // returns are plain data and are used by the playing context later.
      const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Ctx) return Promise.reject(new Error('no-audio'));
      const decoder = new Ctx(1, 1, 44100);
      return loadBank(decoder, base, bank).then(() => {
        bankReady = true;
        return bank;
      });
    },

    /** Whether the recorded violin is in use yet. */
    get sampled() {
      return bankReady;
    },
  };
}
