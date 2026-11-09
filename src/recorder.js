// recorder.js — hear yourself, in a hall.
//
// Two rules shape this file:
//
// 1. Nothing leaves the device. The recording is a Blob in memory: no upload, no
//    storage, gone when the tab closes. That is why it can sit inside an app that
//    promises exactly that.
// 2. The hall is synthesised, not sampled. A ConvolverNode needs an impulse
//    response, and a real one would be a megabyte of audio to ship and decode on
//    a phone. Exponentially decaying noise is a good hall: it is what a plate or
//    hall IR looks like before anyone records a real room, and it costs a few
//    milliseconds to generate.
//
// The reverb is for playback only. Nothing about it changes what the detector
// hears, so it cannot flatter a take into a better score.

let ctx = null;

function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/**
 * A hall as an impulse response: noise under an exponential decay, a few
 * milliseconds of pre-delay so the direct sound stays clear of the tail, and
 * independent noise per channel so the two ears get different reflections.
 * Exported so the shape of the room can be measured offline.
 */
export function makeHallIR(ac, seconds = 2.6, decay = 3.2) {
  const rate = ac.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const preDelay = Math.floor(rate * 0.02);
  const buffer = ac.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      if (i < preDelay) {
        data[i] = 0;
        continue;
      }
      const t = (i - preDelay) / (length - preDelay);
      const tail = Math.pow(1 - t, decay);
      data[i] = (Math.random() * 2 - 1) * tail * 0.55;
    }
  }
  return buffer;
}

let irCache = null;
let convolverCache = null;

function hall(ac) {
  if (!convolverCache) {
    convolverCache = ac.createConvolver();
    irCache = makeHallIR(ac);
    convolverCache.buffer = irCache;
  }
  return convolverCache;
}

/**
 * How much to turn a recording up: enough to bring its loud moments near full
 * scale (about −2 dB), measured on the 99.5th-percentile sample so a single
 * click cannot hold the whole take down, and never more than ×16. Exported so
 * it can be checked offline.
 */
export function loudnessGain(buffer, target = 0.8) {
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / 200000));
  const mags = [];
  for (let i = 0; i < data.length; i += step) mags.push(Math.abs(data[i]));
  if (!mags.length) return 1;
  mags.sort((a, b) => a - b);
  const peak = mags[Math.floor(mags.length * 0.995)] || mags[mags.length - 1];
  if (peak < 1e-4) return 1;
  return Math.max(1, Math.min(16, target / peak));
}

/** True when this browser can record at all — Safari before 14.1 cannot. */
export function canRecord() {
  return Boolean(window.MediaRecorder) && Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * Starts recording. `stop()` returns a Blob and shuts the microphone down
 * immediately, so the browser's recording light goes out with the take.
 */
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    },
    video: false,
  });

  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  const mimeType = candidates.find(
    (type) => !window.MediaRecorder.isTypeSupported || window.MediaRecorder.isTypeSupported(type),
  );
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size) chunks.push(event.data);
  };

  const done = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    };
  });

  recorder.start();
  return {
    stop() {
      if (recorder.state !== 'inactive') recorder.stop();
      return done;
    },
  };
}

/**
 * Records a stream that is already open — the microphone the detector is
 * listening to — without opening a second one and without closing it after:
 * the take's own listening goes on untouched. `startedAt` is performance.now()
 * at the moment recording began, so a moment in the take can be found in the
 * audio later.
 */
export function recordStream(stream) {
  if (!window.MediaRecorder || !stream) return null;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  const mimeType = candidates.find(
    (type) => !window.MediaRecorder.isTypeSupported || window.MediaRecorder.isTypeSupported(type),
  );
  let recorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch {
    return null;
  }
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size) chunks.push(event.data);
  };
  const done = new Promise((resolve) => {
    recorder.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }) : null);
  });
  const startedAt = performance.now();
  recorder.start();
  return {
    startedAt,
    stop() {
      if (recorder.state !== 'inactive') recorder.stop();
      return done;
    },
  };
}

/**
 * Plays a recorded take back through the hall. `wet` is how much of the hall is
 * mixed in — 0.34 is a recital room, 0 is the microphone's own sound.
 */
export async function play(blob, { wet = 0.34, offset = 0 } = {}) {
  const ac = audio();
  if (!ac) throw new Error('no-audio');
  const buffer = await ac.decodeAudioData(await blob.arrayBuffer());

  const source = ac.createBufferSource();
  source.buffer = buffer;

  // A violin a few feet from a phone, recorded raw (no automatic gain — that
  // would fight the pitch detector), plays back far too quietly. So the take is
  // brought up to a healthy level first: a gain from its own loudest moments
  // (the 99.5th-percentile peak, so one bow knock does not set it), then a gentle
  // compressor that lifts the soft passages and catches anything the gain
  // pushed too far. Only the playback is touched; the analysis never hears it.
  const makeup = ac.createGain();
  makeup.gain.value = loudnessGain(buffer);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.2;
  source.connect(makeup);
  makeup.connect(comp);

  // The dry path is trimmed a little so the mix does not clip once the tail is
  // added on top of it.
  const dry = ac.createGain();
  dry.gain.value = 1 - wet * 0.45;
  const send = ac.createGain();
  send.gain.value = wet;
  const room = hall(ac);

  comp.connect(dry);
  dry.connect(ac.destination);
  comp.connect(room);
  room.connect(send);
  send.connect(ac.destination);

  const from = Math.max(0, Math.min(offset, buffer.duration - 0.05));
  const began = ac.currentTime;
  source.start(0, from);
  const ended = new Promise((resolve) => {
    source.onended = () => resolve();
  });
  return {
    /** Seconds into the recording that are sounding now. */
    position: () => from + (ac.currentTime - began),
    stop() {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    },
    ended,
    duration: buffer.duration,
  };
}
