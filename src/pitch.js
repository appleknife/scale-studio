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

/** Median of a numeric array (does not modify the input). */
export function median(values) {
  if (!values.length) return 0;
  const arr = Array.from(values).sort((a, b) => a - b);
  const mid = arr.length >> 1;
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
