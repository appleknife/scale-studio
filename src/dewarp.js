// dewarp.js — taking the bow out of a page.
//
// A lifted page or an open book bends the lines on it. Scanner Pro's
// `DocumentPlanarizer` sits on Leptonica's `dewarpa`: find the long dark lines,
// measure how far each one bows, and move every pixel up or down by the amount
// that straightens its neighbours. No model — just line tracking and a
// displacement field.
//
// That suits a music stand better than a desk: staves are five long, regular
// lines, the best anchors there are. Text baselines work too, more weakly.
// Only vertical bowing is corrected; a gutter that squeezes a page sideways is
// left alone.

const DETECT_WIDTH = 560;
const MIN_RUN = 0.012; // of the page width, for one row fragment
const MIN_COVER = 0.35; // of the page width, for the whole line
const MAX_OFFSET = 0.12; // of the page height

/** Median of a small list, without sorting a copy of the whole page. */
function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function grey(data, w, h) {
  const g = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) g[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  return g;
}

function otsu(g) {
  const hist = new Uint32Array(256);
  for (const v of g) hist[v] += 1;
  const total = g.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let cut = 128;
  for (let i = 0; i < 256; i += 1) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      cut = i;
    }
  }
  return cut;
}

/**
 * The long near-horizontal lines, as x → y curves. Runs shorter than the cover
 * bar are dropped, as are blobs taller than a handful of rows (those are text).
 */
export function findLines(g, w, h) {
  const dark = new Uint8Array(w * h);
  const cut = Math.min(otsu(g), 190);
  for (let p = 0; p < g.length; p += 1) dark[p] = g[p] <= cut ? 1 : 0;
  const runs = new Array(h);
  for (let y = 0; y < h; y += 1) {
    const row = new Uint16Array(w);
    let x = 0;
    while (x < w) {
      if (!dark[y * w + x]) {
        x += 1;
        continue;
      }
      const start = x;
      let gap = 0;
      while (x < w && (dark[y * w + x] || gap < 3)) {
        if (dark[y * w + x]) gap = 0;
        else gap += 1;
        x += 1;
      }
      const end = x - gap;
      if (end - start >= w * MIN_RUN) {
        for (let k = start; k < end; k += 1) row[k] = 1;
      }
    }
    runs[y] = row;
  }
  const seen = new Uint8Array(w * h);
  const lines = [];
  const minRun = Math.max(20, Math.floor(w * MIN_COVER));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      if (!runs[y][x] || seen[p]) continue;
      // Grow the component, but only through rows close by: a line is thin.
      const stack = [p];
      seen[p] = 1;
      const cols = new Map();
      let top = y;
      let bottom = y;
      while (stack.length) {
        const q = stack.pop();
        const qy = Math.floor(q / w);
        const qx = q - qy * w;
        top = Math.min(top, qy);
        bottom = Math.max(bottom, qy);
        if (!cols.has(qx)) cols.set(qx, []);
        cols.get(qx).push(qy);
        for (let ny = qy - 1; ny <= qy + 1; ny += 1) {
          if (ny < 0 || ny >= h) continue;
          for (let nx = qx - 1; nx <= qx + 1; nx += 1) {
            if (nx < 0 || nx >= w) continue;
            const np = ny * w + nx;
            if (runs[ny][nx] && !seen[np]) {
              seen[np] = 1;
              stack.push(np);
            }
          }
        }
      }
      if (bottom - top > 16) continue; // a block of text, not a rule
      const xs = [...cols.keys()].sort((a, b) => a - b);
      const span = xs[xs.length - 1] - xs[0] + 1;
      if (span < minRun || xs.length < span * 0.5) continue;
      const curve = xs.map((x) => [x, median(cols.get(x))]);
      lines.push(curve);
    }
  }
  return smoothLines(lines, w);
}

/** One pass of a five-point median, and drop curves that jump about. */
function smoothLines(lines, w) {
  const out = [];
  for (const curve of lines) {
    const ys = curve.map((p) => p[1]);
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 1; i < ys.length - 1; i += 1) ys[i] = median([ys[i - 1], ys[i], ys[i + 1]]);
    }
    let jump = 0;
    for (let i = 1; i < ys.length; i += 1) jump = Math.max(jump, Math.abs(ys[i] - ys[i - 1]));
    if (jump > 3) continue;
    const cover = ys.length / w;
    if (cover < 0.3) continue;
    out.push(curve.map(([x], i) => [x, ys[i]]));
  }
  return out;
}

/**
 * A per-pixel vertical displacement that straightens the lines. Above the first
 * line and below the last the nearest line's offset is carried outward.
 */
export function buildDisparity(lines, w, h) {
  if (lines.length < 2) return null;
  const anchors = lines
    .map((curve) => {
      const ys = curve.map((p) => p[1]);
      const target = median(ys);
      return { curve, target };
    })
    .filter((a) => a.target > 2 && a.target < h - 3)
    .sort((a, b) => a.target - b.target);
  if (anchors.length < 2) return null;

  const disp = new Float32Array(w * h);
  const maxShift = h * MAX_OFFSET;
  for (let x = 0; x < w; x += 1) {
    const at = [];
    for (const a of anchors) {
      const sample = a.curve.find((p) => p[0] === x);
      if (sample) at.push({ y: a.target, d: sample[1] - a.target });
    }
    if (at.length < 2) continue;
    for (let y = 0; y < h; y += 1) {
      let d;
      if (y <= at[0].y) d = at[0].d;
      else if (y >= at[at.length - 1].y) d = at[at.length - 1].d;
      else {
        let k = 0;
        while (k < at.length - 1 && at[k + 1].y < y) k += 1;
        const a = at[k];
        const b = at[k + 1];
        const f = (y - a.y) / Math.max(1, b.y - a.y);
        d = a.d + (b.d - a.d) * f;
      }
      disp[y * w + x] = Math.max(-maxShift, Math.min(maxShift, d));
    }
  }
  // Smooth across columns so the shift does not step between tracked points.
  const smear = 5;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sum = 0;
      let n = 0;
      for (let k = -smear; k <= smear; k += 1) {
        const xx = x + k;
        if (xx < 0 || xx >= w) continue;
        sum += disp[y * w + xx];
        n += 1;
      }
      out[y * w + x] = n ? sum / n : 0;
    }
  }
  return out;
}

export function applyDisparity(data, w, h, disp) {
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const at = (y * w + x) * 4;
      const sy = y + disp[y * w + x];
      const y0 = Math.max(0, Math.min(h - 1, Math.floor(sy)));
      const y1 = Math.min(h - 1, y0 + 1);
      const f = Math.max(0, Math.min(1, sy - y0));
      const a = (y0 * w + x) * 4;
      const b = (y1 * w + x) * 4;
      for (let c = 0; c < 3; c += 1) out[at + c] = data[a + c] * (1 - f) + data[b + c] * f;
      out[at + 3] = 255;
    }
  }
  return out;
}

/** How much bowing was found: enough lines, enough movement, smooth. */
export function straightenConfidence(lines, w) {
  if (!lines || lines.length < 2) return 0;
  let curved = 0;
  let cover = 0;
  for (const curve of lines) {
    const ys = curve.map((p) => p[1]);
    const mid = median(ys);
    let bow = 0;
    for (const y of ys) bow = Math.max(bow, Math.abs(y - mid));
    if (bow >= 1) curved += 1;
    cover = Math.max(cover, ys.length / w);
  }
  return Math.min(1, curved / 4) * 0.7 + Math.min(1, cover) * 0.3;
}

/**
 * Straighten a warped page. Returns the new pixels and a 0–1 confidence; the
 * caller keeps the input when confidence is too low to be worth it.
 */
export function straighten(data, w, h, minConfidence = 0.45) {
  const scale = Math.min(1, DETECT_WIDTH / w);
  const dw = Math.max(80, Math.round(w * scale));
  const dh = Math.max(80, Math.round(h * scale));
  let small;
  if (scale === 1) small = data;
  else {
    small = new Uint8ClampedArray(dw * dh * 4);
    for (let y = 0; y < dh; y += 1) {
      const sy = Math.min(h - 1, Math.round(y / scale));
      for (let x = 0; x < dw; x += 1) {
        const sx = Math.min(w - 1, Math.round(x / scale));
        const a = (sy * w + sx) * 4;
        const b = (y * dw + x) * 4;
        small[b] = data[a];
        small[b + 1] = data[a + 1];
        small[b + 2] = data[a + 2];
        small[b + 3] = 255;
      }
    }
  }
  const lines = findLines(grey(small, dw, dh), dw, dh);
  const confidence = straightenConfidence(lines, dw);
  if (confidence < minConfidence) return { data, confidence, applied: false };
  const smallDisp = buildDisparity(lines, dw, dh);
  if (!smallDisp) return { data, confidence, applied: false };
  // Scale the field back to the page and apply it.
  const disp = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(dh - 1, Math.round(y * (dh / h)));
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(dw - 1, Math.round(x * (dw / w)));
      disp[y * w + x] = smallDisp[sy * dw + sx] * (h / dh);
    }
  }
  return { data: applyDisparity(data, w, h, disp), confidence, applied: true };
}
