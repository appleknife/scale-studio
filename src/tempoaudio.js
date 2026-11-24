// tempoaudio.js — a practice track that can run at another speed, or in another
// key, without the two dragging each other along.
//
// A recording played faster is also higher. A player working a hard bar wants
// half speed *and* the printed pitch, and a singer wants a key down without the
// tempo falling with it. The two are therefore separate settings here, which is
// the same pair MobileSheets exposes in its player; where it uses a licensed
// native engine, this does the arithmetic in the page.
//
// The stretch is granular: 60 ms grains on a 30 ms hop, each windowed and
// overlap-added. Read position advances by the speed, the samples inside a grain
// by the pitch, so the two never multiply into one another. it is not a studio
// stretcher, and the notes say so; for practice at a small distance from the
// original it keeps the beat and the bowing recognisable.

const GRAIN_SECONDS = 0.06;
const HOP_SECONDS = 0.03;

/** How long a track becomes at this speed. */
export function stretchedLength(seconds, rate) {
  return Math.max(0, Number(seconds) || 0) / Math.max(0.1, Number(rate) || 1);
}

/** A Hann window: quiet at both ends, so grains meet without a click. */
function hann(i, n) {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, n - 1));
}

/**
 * Render a buffer at another speed and pitch. `rate` 1 is the recording's own
 * tempo; `semitones` 0 is its own key. Both are clamped by the caller's slider.
 */
export function renderStretched(ctx, buffer, rate, semitones) {
  const speed = Math.max(0.25, Math.min(2, Number(rate) || 1));
  const pitch = 2 ** (Math.max(-12, Math.min(12, Number(semitones) || 0)) / 12);
  const sr = buffer.sampleRate;
  const inLen = buffer.length;
  const outLen = Math.max(1, Math.floor(inLen / speed));
  const grain = Math.max(2, Math.round(GRAIN_SECONDS * sr));
  const hop = Math.max(1, Math.round(HOP_SECONDS * sr));
  const channels = buffer.numberOfChannels;
  const out = ctx.createBuffer(channels, outLen, sr);
  const windowSum = new Float32Array(outLen);

  const sources = [];
  for (let c = 0; c < channels; c += 1) sources.push(buffer.getChannelData(c));
  const targets = [];
  for (let c = 0; c < channels; c += 1) targets.push(out.getChannelData(c));

  for (let at = 0; at < outLen; at += hop) {
    const read = at * speed;
    for (let i = 0; i < grain; i += 1) {
      const o = at + i;
      if (o >= outLen) break;
      const p = read + i * pitch;
      const pi = Math.floor(p);
      if (pi < 0 || pi + 1 >= inLen) continue;
      const frac = p - pi;
      const w = hann(i, grain);
      for (let c = 0; c < channels; c += 1) {
        const data = sources[c];
        targets[c][o] += (data[pi] * (1 - frac) + data[pi + 1] * frac) * w;
      }
      windowSum[o] += w;
    }
  }

  // Divide by the window sum where grains overlapped, so the gain stays even.
  for (let c = 0; c < channels; c += 1) {
    const data = targets[c];
    for (let i = 0; i < outLen; i += 1) if (windowSum[i] > 0.0001) data[i] /= windowSum[i];
  }
  return out;
}
