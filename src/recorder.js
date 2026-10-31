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
 * Plays a recorded take back through the hall. `wet` is how much of the hall is
 * mixed in — 0.34 is a recital room, 0 is the microphone's own sound.
 */
export async function play(blob, { wet = 0.34 } = {}) {
  const ac = audio();
  if (!ac) throw new Error('no-audio');
  const buffer = await ac.decodeAudioData(await blob.arrayBuffer());

  const source = ac.createBufferSource();
  source.buffer = buffer;

  // The dry path is trimmed a little so the mix does not clip once the tail is
  // added on top of it.
  const dry = ac.createGain();
  dry.gain.value = 1 - wet * 0.45;
  const send = ac.createGain();
  send.gain.value = wet;
  const room = hall(ac);

  source.connect(dry);
  dry.connect(ac.destination);
  source.connect(room);
  room.connect(send);
  send.connect(ac.destination);

  source.start();
  const ended = new Promise((resolve) => {
    source.onended = () => resolve();
  });
  return {
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
