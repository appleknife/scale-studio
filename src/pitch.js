// pitch.js — monophonic pitch detection for a violin (YIN).
//
// A tuner needs to be quick and forgiving; this one is deliberately simple:
// difference function -> cumulative mean normalized difference -> first dip
// below a threshold -> parabolic interpolation. That is the classic YIN
// algorithm (de Cheveigné & Kawahara, 2002), which is far more reliable than
// plain autocorrelation on a bowed string with strong upper harmonics.

const A4 = 440;

export function midiToFreq(midi) {
  return A4 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq) {
  return 69 + 12 * Math.log2(freq / A4);
}

export class PitchDetector {
  constructor({
    sampleRate,
    bufferSize = 2048,
    minFreq = 150,
    maxFreq = 1800,
    threshold = 0.16,
  } = {}) {
    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
    this.minFreq = minFreq;
    this.maxFreq = maxFreq;
    this.threshold = threshold;

    this.minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
    this.maxLag = Math.min(
      Math.floor(sampleRate / minFreq),
      Math.floor(bufferSize * 0.75),
    );
    // A fixed analysis window keeps every lag comparison equally long, which
    // reduces the pull toward octave errors on short buffers.
    this.nEff = bufferSize - this.maxLag;

    this._diff = new Float32Array(this.maxLag + 2);
    this._cmnd = new Float32Array(this.maxLag + 2);
    this._signal = new Float32Array(bufferSize);
  }

  /** @returns {{freq:number, clarity:number, rms:number}} */
  detect(buf, rmsOverride) {
    const n = this.bufferSize;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += buf[i];
    mean /= n;

    let energy = 0;
    for (let i = 0; i < n; i++) {
      const v = buf[i] - mean;
      energy += v * v;
    }
    const rms = rmsOverride != null ? rmsOverride : Math.sqrt(energy / n);

    if (rms < 0.0015) return { freq: 0, clarity: 0, rms };

    // Work on the mean-removed signal.
    const x = this._signal;
    for (let i = 0; i < n; i++) x[i] = buf[i] - mean;

    const { minLag, maxLag, nEff } = this;
    const diff = this._diff;
    const cmnd = this._cmnd;

    for (let tau = 1; tau <= maxLag; tau++) {
      let sum = 0;
      for (let i = 0; i < nEff; i++) {
        const d = x[i] - x[i + tau];
        sum += d * d;
      }
      diff[tau] = sum;
    }

    let running = 0;
    cmnd[0] = 1;
    for (let tau = 1; tau <= maxLag; tau++) {
      running += diff[tau];
      cmnd[tau] = running > 1e-12 ? (diff[tau] * tau) / running : 1;
    }

    // First dip below the threshold...
    let tauEst = -1;
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (cmnd[tau] < this.threshold) {
        while (tau + 1 <= maxLag && cmnd[tau + 1] < cmnd[tau]) tau++;
        tauEst = tau;
        break;
      }
    }

    // ...otherwise fall back to the best dip, as long as it is convincing.
    if (tauEst < 0) {
      let best = Infinity;
      let bestTau = -1;
      for (let tau = minLag; tau <= maxLag; tau++) {
        if (cmnd[tau] < best) {
          best = cmnd[tau];
          bestTau = tau;
        }
      }
      if (bestTau < 0 || best > 0.45) return { freq: 0, clarity: 0, rms };
      tauEst = bestTau;
    }

    // Parabolic interpolation around the dip for sub-sample accuracy.
    const y0 = cmnd[tauEst - 1];
    const y1 = cmnd[tauEst];
    const y2 = cmnd[tauEst + 1];
    const denom = 2 * (2 * y1 - y2 - y0);
    const shift = denom !== 0 ? (y2 - y0) / denom : 0;
    const period = tauEst + Math.max(-0.5, Math.min(0.5, shift));

    let freq = this.sampleRate / period;
    if (!isFinite(freq) || freq < this.minFreq * 0.9 || freq > this.maxFreq * 1.1) {
      return { freq: 0, clarity: 0, rms };
    }

    // Guard against the most common failure: reporting the octave above.
    // If half the period correlates almost as well and the second harmonic is
    // weak, prefer the lower octave.
    const clarity = Math.max(0, Math.min(1, 1 - y1));
    return { freq, clarity, rms };
  }
}

/**
 * How loud a frame has to be before the app calls it a note.
 *
 * This used to be two fixed numbers — 0.004 for "a note is sounding" and 0.007
 * for "a confident start" — which is fine on a laptop and wrong on a phone. An
 * iPhone's built-in microphone goes through Safari's own input processing: it
 * has automatic gain control, a noise gate and a high-pass filter, none of which
 * a web page can switch off (WebKit bug 179411 — the echoCancellation /
 * noiseSuppression / autoGainControl constraints are largely ignored on iOS). A
 * softly bowed note can arrive at a third of the level the same note has on a
 * laptop, and a fixed 0.004 then reports "nothing heard".
 *
 * So the floor is *learned* instead. `nextFloor` tracks room noise — it follows
 * quiet frames down and up, but a loud frame does not raise it, because a loud
 * frame is the instrument. `quietLevel` is the line above that floor, and the
 * two constants keep it inside a sane range: at the default floor of 0.0012 the
 * line lands on 0.0036, almost exactly the old 0.004, so a device that was
 * already working behaves the same.
 */
export function nextFloor(floor, rms) {
  const current = Number.isFinite(floor) && floor > 0 ? floor : 0.0012;
  const measured = Number.isFinite(rms) && rms > 0 ? rms : 0;
  // Only frames that could plausibly be room noise teach the estimate anything.
  if (measured > current * 3) return current;
  return current * 0.995 + measured * 0.005;
}

/** The level a frame has to clear to count as a note rather than room noise. */
export function quietLevel(floor) {
  const current = Number.isFinite(floor) && floor > 0 ? floor : 0.0012;
  return Math.min(0.012, Math.max(0.0016, current * 3));
}

/** The level a frame has to clear to *start* a take — a confident note. */
export function strongLevel(floor) {
  return Math.min(0.026, quietLevel(floor) * 2.2);
}

/** Median of a numeric array (does not modify the input). */
export function median(values) {
  if (!values.length) return 0;
  const arr = Array.from(values).sort((a, b) => a - b);
  const mid = arr.length >> 1;
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
