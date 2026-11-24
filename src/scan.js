// scan.js — paper on a phone camera, straightened out.
//
// Scanner Pro's camera holds a quad over the page and filters it so it does not
// jump (Kalman and one-euro filters in the app; a plain smoothed average here),
// waits for the device to be still, then fires. The page is warped flat with a
// homography, and a filter is applied before it is saved. That much is
// reproducible in a page: the camera through getUserMedia, the quad from a
// downscaled frame, and the warp in canvas pixels.
//
// What is not here: the learned parts of the original — finger segmentation and
// inpainting, curved-line flattening, document-type classification. Those need
// models the app ships; the browser has none of them.

export const SCAN_MAX_EDGE = 2200;

export function orderQuad(points) {
  const pts = points.map(([x, y]) => [Number(x), Number(y)]);
  if (pts.length !== 4) return pts;
  const bySum = [...pts].sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const tl = bySum[0];
  const br = bySum[3];
  const rest = pts.filter((p) => p !== tl && p !== br);
  const [tr, bl] = rest[0][0] - rest[0][1] > rest[1][0] - rest[1][1] ? rest : [rest[1], rest[0]];
  return [tl, tr, br, bl];
}

export function quadArea(q) {
  if (!q || q.length !== 4) return 0;
  let sum = 0;
  for (let i = 0; i < 4; i += 1) {
    const [x1, y1] = q[i];
    const [x2, y2] = q[(i + 1) % 4];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function quadCenter(q) {
  return [q.reduce((s, p) => s + p[0], 0) / 4, q.reduce((s, p) => s + p[1], 0) / 4];
}

/** How far, in fractions of the frame, two quads sit from one another. */
export function quadDistance(a, b) {
  if (!a || !b) return 1;
  let worst = 0;
  for (let i = 0; i < 4; i += 1) {
    worst = Math.max(worst, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
  }
  return worst;
}

export function smoothQuad(prev, next, alpha = 0.28) {
  if (!prev) return next;
  return next.map((p, i) => [prev[i][0] + (p[0] - prev[i][0]) * alpha, prev[i][1] + (p[1] - prev[i][1]) * alpha]);
}

/**
 * Whether a run of quads is still enough to fire the shutter: the document has
 * been found for a while and has not moved.
 */
export function steadyEnough(history, minArea = 0.18) {
  if (!history || history.length < 5) return false;
  const q = history[history.length - 1].quad;
  if (!q || quadArea(q) < minArea) return false;
  for (let i = 1; i < history.length; i += 1) {
    if (quadDistance(history[i - 1].quad, history[i].quad) > 0.012) return false;
    if (Math.abs(quadArea(history[i].quad) - quadArea(q)) / quadArea(q) > 0.12) return false;
  }
  return true;
}

export function outputSize(quad, maxEdge = SCAN_MAX_EDGE) {
  const wTop = Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]);
  const wBottom = Math.hypot(quad[2][0] - quad[3][0], quad[2][1] - quad[3][1]);
  const hLeft = Math.hypot(quad[3][0] - quad[0][0], quad[3][1] - quad[0][1]);
  const hRight = Math.hypot(quad[2][0] - quad[1][0], quad[2][1] - quad[1][1]);
  let w = Math.max(wTop, wBottom);
  let h = Math.max(hLeft, hRight);
  const scale = maxEdge / Math.max(w, h);
  if (scale < 1) {
    w *= scale;
    h *= scale;
  }
  return [Math.max(16, Math.round(w)), Math.max(16, Math.round(h))];
}

/** Solve an 8×8 system for the homography that takes dest → source. */
export function homography(dest, src) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = dest[i];
    const [u, v] = src[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  for (let col = 0; col < 8; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 8; row += 1) if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    if (Math.abs(A[pivot][col]) < 1e-9) return null;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    const div = A[col][col];
    for (let k = col; k < 8; k += 1) A[col][k] /= div;
    b[col] /= div;
    for (let row = 0; row < 8; row += 1) {
      if (row === col) continue;
      const f = A[row][col];
      if (!f) continue;
      for (let k = col; k < 8; k += 1) A[row][k] -= f * A[col][k];
      b[row] -= f * b[col];
    }
  }
  return b;
}

function sample(data, w, h, x, y, out) {
  const cx = Math.min(w - 1, Math.max(0, x));
  const cy = Math.min(h - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  for (let c = 0; c < 3; c += 1) {
    const p00 = data[(y0 * w + x0) * 4 + c];
    const p10 = data[(y0 * w + x1) * 4 + c];
    const p01 = data[(y1 * w + x0) * 4 + c];
    const p11 = data[(y1 * w + x1) * 4 + c];
    out[c] = p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy;
  }
  out[3] = 255;
}

/** Warp the quad in `source` (RGBA, source pixels) to a flat rectangle. */
export function warpPixels(source, sw, sh, quad, outW, outH) {
  const [tw, th] = [outW, outH];
  const dest = [
    [0, 0],
    [tw, 0],
    [tw, th],
    [0, th],
  ];
  const H = homography(dest, quad);
  if (!H) return null;
  const out = new Uint8ClampedArray(tw * th * 4);
  const px = [0, 0, 0, 255];
  for (let y = 0; y < th; y += 1) {
    for (let x = 0; x < tw; x += 1) {
      const d = H[6] * x + H[7] * y + 1;
      const sx = (H[0] * x + H[1] * y + H[2]) / d;
      const sy = (H[3] * x + H[4] * y + H[5]) / d;
      sample(source, sw, sh, sx, sy, px);
      const at = (y * tw + x) * 4;
      out[at] = px[0];
      out[at + 1] = px[1];
      out[at + 2] = px[2];
      out[at + 3] = 255;
    }
  }
  return out;
}

export function otsu(gray) {
  const hist = new Uint32Array(256);
  for (const v of gray) hist[v] += 1;
  const total = gray.length;
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
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      cut = i;
    }
  }
  return cut;
}

/** A grey copy, for detection and the grey filter. */
export function greyOf(data, w, h) {
  const g = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    g[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  return g;
}

/** Box average through an integral image — the local paper brightness. */
function localMean(gray, w, h, radius) {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let row = 0;
    for (let x = 0; x < w; x += 1) {
      row += gray[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      const sum =
        integral[(y1 + 1) * (w + 1) + x1 + 1] -
        integral[y0 * (w + 1) + x1 + 1] -
        integral[(y1 + 1) * (w + 1) + x0] +
        integral[y0 * (w + 1) + x0];
      out[y * w + x] = sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
    }
  }
  return out;
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * The page treatments. `color` is a gentle white balance and contrast, `clean`
 * flattens the light across the page before contrasting, `grey` and `bw` are
 * what they say. Returns a new buffer; the input is untouched.
 */
export function applyFilter(data, w, h, mode) {
  const out = new Uint8ClampedArray(data);
  if (!mode || mode === 'photo') return out;
  const gray = greyOf(out, w, h);
  const radius = Math.max(8, Math.round(Math.max(w, h) / 40));
  const paper = localMean(gray, w, h, radius);
  if (mode === 'clean') {
    for (let p = 0; p < gray.length; p += 1) {
      const flat = (gray[p] / Math.max(24, paper[p])) * 235;
      const v = clamp((flat - 128) * 1.45 + 140);
      const at = p * 4;
      out[at] = v;
      out[at + 1] = v;
      out[at + 2] = v;
    }
    return out;
  }
  if (mode === 'grey') {
    for (let p = 0; p < gray.length; p += 1) {
      const v = clamp((gray[p] - 128) * 1.2 + 132);
      const at = p * 4;
      out[at] = v;
      out[at + 1] = v;
      out[at + 2] = v;
    }
    return out;
  }
  if (mode === 'bw') {
    const cut = otsu(gray);
    for (let p = 0; p < gray.length; p += 1) {
      // Against the local paper rather than a global cut, so a shadowed corner
      // does not turn into a black block.
      const v = gray[p] < Math.min(cut, paper[p] * 0.86) ? 24 : 248;
      const at = p * 4;
      out[at] = v;
      out[at + 1] = v;
      out[at + 2] = v;
    }
    return out;
  }
  // color: grey-world balance off the bright paper, then contrast.
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let p = 0, at = 0; p < gray.length; p += 1, at += 4) {
    if (gray[p] < paper[p] * 0.7) continue;
    sr += out[at];
    sg += out[at + 1];
    sb += out[at + 2];
    n += 1;
  }
  if (!n) return out;
  const avg = (sr + sg + sb) / (3 * n);
  const gain = [avg / Math.max(1, sr / n), avg / Math.max(1, sg / n), avg / Math.max(1, sb / n)];
  for (let at = 0; at < out.length; at += 4) {
    for (let c = 0; c < 3; c += 1) {
      let v = out[at + c] * gain[c];
      if (paper[at / 4] > 40) v = (v / paper[at / 4]) * 225;
      out[at + c] = clamp((v - 128) * 1.12 + 134);
    }
  }
  return out;
}

/**
 * Guess the page's four corners from a small frame. Two candidates are tried —
 * the bright sheet against a darker desk, and the strongest outer edges — and
 * the more page-shaped one wins. Coordinates come back in 0–1 units.
 */
export function autoQuad(data, w, h) {
  const gray = greyOf(data, w, h);
  const cut = otsu(gray);
  const bright = new Uint8Array(w * h);
  let brightCount = 0;
  for (let p = 0; p < gray.length; p += 1) {
    if (gray[p] > cut) {
      bright[p] = 1;
      brightCount += 1;
    }
  }
  const candidates = [];
  const paper = brightQuad(bright, w, h);
  if (paper) candidates.push(paper);
  const edges = edgeQuad(gray, w, h);
  if (edges) candidates.push(edges);
  let best = null;
  let bestScore = 0;
  for (const q of candidates) {
    const area = quadArea(q);
    if (area < 0.12 || area > 0.97) continue;
    const center = quadCenter(q);
    const centered = 1 - Math.min(1, Math.hypot(center[0] - 0.5, center[1] - 0.5) * 2.5);
    const score = area * 0.6 + centered * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = q;
    }
  }
  return best;
}

function quadFromExtremes(points) {
  if (!points.length) return null;
  let tl = points[0];
  let br = points[0];
  let tr = points[0];
  let bl = points[0];
  for (const p of points) {
    if (p[0] + p[1] < tl[0] + tl[1]) tl = p;
    if (p[0] + p[1] > br[0] + br[1]) br = p;
    if (p[0] - p[1] > tr[0] - tr[1]) tr = p;
    if (p[0] - p[1] < bl[0] - bl[1]) bl = p;
  }
  return [tl, tr, br, bl];
}

function paperShape(q) {
  if (!q) return 0;
  const area = quadArea(q);
  if (area < 0.1 || area > 0.98) return 0;
  const center = quadCenter(q);
  return area + (1 - Math.min(1, Math.hypot(center[0] - 0.5, center[1] - 0.5) * 2)) * 0.5;
}

function brightQuad(bright, w, h) {
  const seen = new Uint8Array(w * h);
  let best = null;
  let bestScore = 0;
  const stack = [];
  for (let y = 1; y < h - 1; y += 4) {
    for (let x = 1; x < w - 1; x += 4) {
      const start = y * w + x;
      if (!bright[start] || seen[start]) continue;
      let minx = w;
      let maxx = 0;
      let miny = h;
      let maxy = 0;
      let count = 0;
      const pts = [];
      stack.length = 0;
      stack.push(start);
      seen[start] = 1;
      while (stack.length) {
        const p = stack.pop();
        const py = Math.floor(p / w);
        const px = p - py * w;
        count += 1;
        if (count > w * h) break;
        minx = Math.min(minx, px);
        maxx = Math.max(maxx, px);
        miny = Math.min(miny, py);
        maxy = Math.max(maxy, py);
        if (count % 7 === 0) pts.push([px / w, py / h]);
        for (const [nx, ny] of [
          [px + 1, py],
          [px - 1, py],
          [px, py + 1],
          [px, py - 1],
        ]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = ny * w + nx;
          if (bright[np] && !seen[np]) {
            seen[np] = 1;
            stack.push(np);
          }
        }
      }
      const area = ((maxx - minx + 1) * (maxy - miny + 1)) / (w * h);
      const q = quadFromExtremes(pts);
      const score = paperShape(q) - Math.abs(area - quadArea(q)) * 2;
      if (score > bestScore) {
        bestScore = score;
        best = q;
      }
    }
  }
  return best;
}

function edgeQuad(gray, w, h) {
  const pts = [];
  let total = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const gx = gray[y * w + x + 1] - gray[y * w + x - 1];
      const gy = gray[(y + 1) * w + x] - gray[(y - 1) * w + x];
      const m = Math.abs(gx) + Math.abs(gy);
      total += m;
      if (m > 48) pts.push([x / w, y / h]);
    }
  }
  if (pts.length < 24) return null;
  const mean = total / ((w * h) / 4);
  if (mean < 4) return null;
  return quadFromExtremes(pts);
}

/** Draw `video` into a canvas at its own size, no larger than `maxEdge`. */
export function grabFrame(video, maxEdge = SCAN_MAX_EDGE) {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const scale = Math.min(1, maxEdge / Math.max(vw, vh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vw * scale);
  canvas.height = Math.round(vh * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function quadToPixels(q, w, h) {
  return q.map(([x, y]) => [x * w, y * h]);
}
