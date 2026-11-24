// scanview.js — the scan screen: camera, corners, filter, pages.
//
// This is the part of Scanner Pro that matters for a sheet-music stand: point
// the camera at the page, let the quad settle (or drag the corners), take it,
// flatten it, choose how it should look. Multi-page, because a part is pages.
//
// The learned parts of the original (finger removal, curved-line flattening,
// document-type guessing) are not reproduced; what is here is the camera, the
// quad, the warp and the tone.

import { t } from './i18n.js?v=202611240700';
import {
  autoQuad,
  applyFilter,
  grabFrame,
  orderQuad,
  outputSize,
  quadArea,
  quadDistance,
  quadToPixels,
  smoothQuad,
  steadyEnough,
  warpPixels,
} from './scan.js?v=202611240700';

const ICON = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  torch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l1 5-2 3v10h-4V11L8 8z"/><path d="M9.5 15h5"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/></svg>',
  shutter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="7.4"/><circle cx="12" cy="12" r="4.6" fill="currentColor" stroke="none"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
};

const FILTERS = ['photo', 'color', 'clean', 'grey', 'bw'];
const PREVIEW = {
  photo: 'none',
  color: 'contrast(1.08) saturate(1.05)',
  clean: 'grayscale(1) contrast(1.35) brightness(1.12)',
  grey: 'grayscale(1) contrast(1.15)',
  bw: 'grayscale(1) contrast(2.1) brightness(1.05)',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createScanner(deps) {
  const root = deps.root;
  let stream = null;
  let track = null;
  let running = false;
  let quad = null; // normalised, ordered
  let suggested = null;
  let history = [];
  let lastFire = 0;
  let detectTimer = 0;
  let raf = 0;
  let auto = true;
  let filter = 'color';
  let torch = false;
  let torchOk = false;
  let busy = false;
  const pages = []; // JPEG data URLs

  root.innerHTML = `
    <div class="scan" data-el="scan" hidden>
      <div class="scan-stage" data-el="stage">
        <video class="scan-video" data-el="video" playsinline muted autoplay></video>
        <canvas class="scan-overlay" data-el="overlay"></canvas>
        <div class="scan-hint" data-el="hint"></div>
        <div class="scan-fail" data-el="fail" hidden></div>
      </div>
      <div class="scan-bar">
        <button class="scan-btn" type="button" data-act="close" aria-label="${t('scan.close')}" title="${t('scan.close')}">${ICON.close}</button>
        <span class="scan-title">${t('scan.title')}</span>
        <button class="scan-btn" type="button" data-act="torch" aria-label="${t('scan.torch')}" title="${t('scan.torch')}" hidden>${ICON.torch}</button>
        <button class="scan-btn is-on" type="button" data-act="auto" aria-pressed="true" aria-label="${t('scan.auto')}" title="${t('scan.auto')}">${ICON.auto}</button>
      </div>
      <div class="scan-tools">
        <div class="scan-filters" role="group" aria-label="${t('scan.filter')}">
          ${FILTERS.map((f) => `<button class="scan-filter ${f === filter ? 'is-on' : ''}" type="button" data-filter="${f}">${t('scan.filter.' + f)}</button>`).join('')}
        </div>
        <div class="scan-shoot">
          <button class="scan-thumbs" type="button" data-act="undo" aria-label="${t('scan.undo')}" hidden>${ICON.undo}<b data-el="count"></b></button>
          <button class="scan-shutter" type="button" data-act="shoot" aria-label="${t('scan.shoot')}">${ICON.shutter}</button>
          <button class="scan-thumbs scan-done" type="button" data-act="done" aria-label="${t('scan.done')}" hidden>${ICON.check}<b data-el="count2"></b></button>
        </div>
        <p class="scan-note" data-el="note">${t('scan.corners')}</p>
      </div>
    </div>`;

  const el = {
    scan: root.querySelector('[data-el="scan"]'),
    stage: root.querySelector('[data-el="stage"]'),
    video: root.querySelector('[data-el="video"]'),
    overlay: root.querySelector('[data-el="overlay"]'),
    hint: root.querySelector('[data-el="hint"]'),
    fail: root.querySelector('[data-el="fail"]'),
    note: root.querySelector('[data-el="note"]'),
    count: root.querySelector('[data-el="count"]'),
    count2: root.querySelector('[data-el="count2"]'),
  };
  const torchBtn = root.querySelector('[data-act="torch"]');
  const undoBtn = root.querySelector('[data-act="undo"]');
  const doneBtn = root.querySelector('[data-act="done"]');

  function hatchQuad(w, h) {
    const inset = 0.08;
    return [
      [inset, inset],
      [1 - inset, inset],
      [1 - inset, 1 - inset],
      [inset, 1 - inset],
    ];
  }

  function drawOverlay() {
    const canvas = el.overlay;
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const drawQuad = (q, color, fill, handles) => {
      if (!q) return;
      ctx.beginPath();
      q.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fill();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(fill ? [7, 5] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      if (handles) {
        for (const [x, y] of q) {
          ctx.beginPath();
          ctx.arc(x * w, y * h, 9, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = '#1f4fa8';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    };
    if (suggested && quadDistance(suggested, quad) > 0.03) drawQuad(suggested, 'rgba(255,255,255,0.75)', true, false);
    drawQuad(quad, '#8ec9ff', true, true);
  }

  function resizeOverlay() {
    const box = el.stage.getBoundingClientRect();
    el.overlay.width = Math.max(1, Math.round(box.width));
    el.overlay.height = Math.max(1, Math.round(box.height));
    drawOverlay();
  }

  function setQuad(next) {
    quad = orderQuad(next).map(([x, y]) => [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))]);
    drawOverlay();
  }

  function detectFrame() {
    if (!running || el.video.readyState < 2) return;
    const max = 220;
    const vw = el.video.videoWidth || 640;
    const vh = el.video.videoHeight || 480;
    const long = Math.max(vw, vh);
    const w = vw >= vh ? max : Math.round(max * (vw / long));
    const h = vh >= vw ? max : Math.round(max * (vh / long));
    const small = document.createElement('canvas');
    small.width = w;
    small.height = h;
    const ctx = small.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(el.video, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const found = autoQuad(data, w, h);
    if (!found) {
      suggested = null;
      if (auto) history = [];
      drawOverlay();
      return;
    }
    suggested = smoothQuad(suggested, found, 0.4);
    if (auto) {
      quad = quad ? smoothQuad(quad, suggested, 0.16) : suggested.map((p) => [...p]);
      history.push({ quad: quad.map((p) => [...p]), at: performance.now() });
      if (history.length > 7) history.shift();
      el.hint.textContent = steadyEnough(history) ? t('scan.hold') : t('scan.seek');
      el.hint.hidden = !el.hint.textContent;
      if (steadyEnough(history) && performance.now() - lastFire > 1500 && !busy) {
        lastFire = performance.now();
        shoot();
      }
    }
    drawOverlay();
  }

  async function start() {
    el.fail.hidden = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } },
      });
    } catch (err) {
      el.fail.hidden = false;
      el.fail.innerHTML = `<p>${t('scan.noCamera')}</p><button class="reader-pill" type="button" data-act="close">${t('scan.close')}</button>`;
      return;
    }
    track = stream.getVideoTracks()[0] || null;
    el.video.srcObject = stream;
    await el.video.play().catch(() => {});
    const vw = el.video.videoWidth || 4;
    const vh = el.video.videoHeight || 3;
    el.stage.style.aspectRatio = `${vw} / ${vh}`;
    running = true;
    resizeOverlay();
    quad = hatchQuad(el.overlay.width, el.overlay.height);
    const caps = track?.getCapabilities?.() || {};
    torchOk = Boolean(caps.torch);
    torchBtn.hidden = !torchOk;
    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (!detectTimer) {
        detectTimer = 1;
        setTimeout(() => {
          detectTimer = 0;
          detectFrame();
        }, 130);
      }
    };
    loop();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(detectTimer);
    detectTimer = 0;
    try {
      stream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* already gone */
    }
    stream = null;
    track = null;
    el.video.srcObject = null;
  }

  function updatePages() {
    const n = pages.length;
    undoBtn.hidden = !n;
    doneBtn.hidden = !n;
    el.count.textContent = String(n);
    el.count2.textContent = String(n);
    el.scan.classList.toggle('has-pages', n > 0);
  }

  async function shoot() {
    if (busy || !running) return;
    busy = true;
    el.scan.classList.add('is-busy');
    try {
      const frame = grabFrame(el.video, 2200);
      const sw = frame.width;
      const sh = frame.height;
      const q = quadToPixels(quad || hatchQuad(1, 1), sw, sh);
      const [ow, oh] = outputSize(q);
      const src = frame.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
      const warped = warpPixels(src, sw, sh, q, ow, oh);
      if (!warped) throw new Error('warp');
      const filtered = applyFilter(warped, ow, oh, filter);
      const out = document.createElement('canvas');
      out.width = ow;
      out.height = oh;
      out.getContext('2d').putImageData(new ImageData(filtered, ow, oh), 0, 0);
      pages.push(out.toDataURL('image/jpeg', 0.92));
      updatePages();
      history = [];
      if (navigator.vibrate) navigator.vibrate(25);
      el.hint.textContent = t('scan.taken');
      el.hint.hidden = false;
      setTimeout(() => {
        if (!busy) el.hint.hidden = true;
      }, 1200);
    } catch {
      el.fail.hidden = false;
      el.fail.innerHTML = `<p>${t('scan.failed')}</p>`;
    }
    busy = false;
    el.scan.classList.remove('is-busy');
    if (quad && auto) history = [];
  }

  async function finish() {
    if (!pages.length) return close();
    const files = await Promise.all(
      pages.map(async (url, i) => {
        const blob = await (await fetch(url)).blob();
        return new File([blob], `scan-${String(i + 1).padStart(2, '0')}.jpg`, { type: 'image/jpeg' });
      }),
    );
    const stamp = new Date();
    const title = `Scan ${stamp.toLocaleDateString()} ${stamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    stop();
    el.scan.hidden = true;
    deps.onSave?.(files, title);
  }

  function close() {
    stop();
    el.scan.hidden = true;
    pages.length = 0;
    updatePages();
    deps.onClose?.();
  }

  async function toggleTorch() {
    if (!track || !torchOk) return;
    torch = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch }] });
      torchBtn.classList.toggle('is-on', torch);
    } catch {
      torch = false;
    }
  }

  /* Corner dragging: four generous handles over the overlay. */
  let drag = null;
  function near(event) {
    const box = el.overlay.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    if (!quad) return -1;
    let best = -1;
    let bestD = 0.08;
    quad.forEach((p, i) => {
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }

  el.overlay.addEventListener('pointerdown', (event) => {
    const i = near(event);
    if (i < 0) return;
    event.preventDefault();
    drag = i;
    auto = false;
    el.scan.querySelector('[data-act="auto"]').classList.remove('is-on');
    el.overlay.setPointerCapture?.(event.pointerId);
  });
  el.overlay.addEventListener('pointermove', (event) => {
    if (drag == null) return;
    const box = el.overlay.getBoundingClientRect();
    const next = quad.map((p) => [...p]);
    next[drag] = [Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), Math.max(0, Math.min(1, (event.clientY - box.top) / box.height))];
    quad = orderQuad(next);
    drawOverlay();
  });
  const endDrag = () => {
    drag = null;
    history = [];
  };
  el.overlay.addEventListener('pointerup', endDrag);
  el.overlay.addEventListener('pointercancel', endDrag);

  root.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-act], [data-filter]');
    if (!btn || el.scan.hidden) return;
    if (btn.dataset.filter) {
      filter = btn.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('is-on', b === btn));
      el.video.style.filter = PREVIEW[filter] || 'none';
      return;
    }
    switch (btn.dataset.act) {
      case 'close':
        return close();
      case 'shoot':
        return shoot();
      case 'done':
        return finish();
      case 'undo':
        pages.pop();
        updatePages();
        return;
      case 'torch':
        return toggleTorch();
      case 'auto':
        auto = !auto;
        btn.classList.toggle('is-on', auto);
        btn.setAttribute('aria-pressed', String(auto));
        history = [];
        el.hint.hidden = true;
        return;
      default:
    }
  });

  window.addEventListener('resize', () => {
    if (!el.scan.hidden) resizeOverlay();
  });


  const api = {
    async open() {
      el.scan.hidden = false;
      el.video.style.filter = PREVIEW[filter] || 'none';
      updatePages();
      await start();
      if (running && !quad) quad = hatchQuad(1, 1);
    },
    close,
    stop,
    // Test hooks; harmless in the app.
    get pages() {
      return pages.length;
    },
    setQuad,
    shoot,
    finish,
    get running() {
      return running;
    },
  };
  window.__scanner = api;
  return api;
}
