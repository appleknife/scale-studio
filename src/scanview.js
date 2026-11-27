// scanview.js — the scan screen: camera, corners, pages, and the edit step.
//
// Shooting and correcting are separate on purpose. A frame is taken as it is,
// with the corners the camera found; the page is straightened and toned later,
// on a still picture, where a corner can be placed precisely and a look can be
// compared without the camera moving underneath. That is also how the original
// works: auto-capture at the camera, crop and colour mode on the page after.
//
// The learned parts of Scanner Pro (finger removal, curved-page flattening,
// document-type guessing) are not reproduced; the camera, the quad, the warp
// and the tone are.

import { t } from './i18n.js?v=202611271900';
import {
  applyFilter,
  autoQuad,
  grabFrame,
  orderQuad,
  outputSize,
  quadArea,
  quadDistance,
  quadToPixels,
  smoothQuad,
  warpPixels,
} from './scan.js?v=202611271900';
import { straighten } from './dewarp.js?v=202611271900';

const ICON = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  torch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l1 5-2 3v10h-4V11L8 8z"/><path d="M9.5 15h5"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/></svg>',
  shutter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="7.4"/><circle cx="12" cy="12" r="4.6" fill="currentColor" stroke="none"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  pages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3.5" width="10" height="17" rx="1.5"/><path d="M9.5 8h5M9.5 11.5h5M9.5 15h3"/></svg>',
  wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18l9.5-9.5"/><path d="M16.5 4v3M15 5.5h3M19.5 10v2M18.5 11h2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
};

const FILTERS = ['clean', 'color', 'photo', 'grey', 'bw'];
const PREVIEW = {
  photo: 'none',
  color: 'contrast(1.08) saturate(1.05)',
  clean: 'grayscale(1) contrast(1.35) brightness(1.12)',
  grey: 'grayscale(1) contrast(1.15)',
  bw: 'grayscale(1) contrast(2.1) brightness(1.05)',
};
const FIRE_AT = 1;
const COOLDOWN = 1200;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createScanner(deps) {
  const root = deps.root;
  let stream = null;
  let track = null;
  let running = false;
  let mode = 'camera'; // camera | edit
  let quad = null;
  let suggested = null;
  let history = [];
  let hold = 0; // 0..1 towards firing
  let lastFire = 0;
  let detectTimer = 0;
  let raf = 0;
  let auto = true;
  let filter = 'clean'; // default look for new pages
  let torch = false;
  let torchOk = false;
  let busy = false;
  let misses = 0;
  let editing = -1;
  const pages = []; // {raw, quad, filter}

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
        <span class="scan-title"><span data-el="title">${t('scan.title')}</span> <span class="experimental-tag">${t('sheet.scanBeta')}</span>
          <small class="scan-beta-note">${t('sheet.scanBetaNote')}</small></span>
        <button class="scan-btn" type="button" data-act="torch" aria-label="${t('scan.torch')}" title="${t('scan.torch')}" hidden>${ICON.torch}</button>
        <button class="scan-btn is-on" type="button" data-act="auto" aria-pressed="true" aria-label="${t('scan.auto')}" title="${t('scan.auto')}">${ICON.auto}</button>
      </div>
      <div class="scan-tools" data-el="tools">
        <div class="scan-filters" role="group" aria-label="${t('scan.filter')}">
          ${FILTERS.map((f) => `<button class="scan-filter ${f === filter ? 'is-on' : ''}" type="button" data-filter="${f}">${t('scan.filter.' + f)}</button>`).join('')}
        </div>
        <div class="scan-shoot">
          <button class="scan-thumbs" type="button" data-act="undo" aria-label="${t('scan.undo')}" hidden>${ICON.undo}<b data-el="count"></b></button>
          <button class="scan-shutter" type="button" data-act="shoot" aria-label="${t('scan.shoot')}">
            <span class="scan-ring" data-el="ring" aria-hidden="true"></span>
            ${ICON.shutter}
          </button>
          <button class="scan-thumbs scan-done" type="button" data-act="done" aria-label="${t('scan.done')}" hidden>${ICON.check}<b data-el="count2"></b></button>
        </div>
        <p class="scan-note" data-el="note">${t('scan.corners')}</p>
      </div>
      <div class="scan-strip" data-el="strip" hidden></div>

      <div class="scan-edit" data-el="edit" hidden>
        <div class="scan-edit-stage" data-el="editStage">
          <canvas class="scan-edit-img" data-el="editPreview"></canvas>
          <canvas class="scan-overlay" data-el="editOverlay"></canvas>
        </div>
        <div class="scan-edit-bar">
          <button class="scan-btn" type="button" data-act="editBack" aria-label="${t('scan.back')}" title="${t('scan.back')}">${ICON.back}</button>
          <span class="scan-edit-title" data-el="editTitle"></span>
          <button class="scan-btn" type="button" data-act="editDelete" aria-label="${t('scan.delete')}" title="${t('scan.delete')}">${ICON.trash}</button>
          <button class="scan-thumbs" type="button" data-act="editPrev" aria-label="${t('scan.prev')}">${ICON.back}</button>
          <button class="scan-thumbs" type="button" data-act="editNext" aria-label="${t('scan.next')}">${ICON.back.replace('M15 5l-7 7 7 7', 'M9 5l7 7-7 7')}</button>
        </div>
        <div class="scan-edit-tools">
          <div class="scan-filters" role="group" aria-label="${t('scan.filter')}">
            ${FILTERS.map((f) => `<button class="scan-filter" type="button" data-editfilter="${f}">${t('scan.filter.' + f)}</button>`).join('')}
          </div>
          <button class="reader-switch scan-straight" type="button" data-act="editStraighten" role="switch" aria-checked="true"><span>${t('scan.straighten')}</span><i aria-hidden="true"></i></button>
          <button class="primary-btn scan-apply" type="button" data-act="editApply">${ICON.check}${t('scan.apply')}</button>
          <p class="scan-note">${t('scan.editNote')}</p>
        </div>
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
    ring: root.querySelector('[data-el="ring"]'),
    strip: root.querySelector('[data-el="strip"]'),
    edit: root.querySelector('[data-el="edit"]'),
    editStage: root.querySelector('[data-el="editStage"]'),
    editPreview: root.querySelector('[data-el="editPreview"]'),
    editOverlay: root.querySelector('[data-el="editOverlay"]'),
    editTitle: root.querySelector('[data-el="editTitle"]'),
  };
  const torchBtn = root.querySelector('[data-act="torch"]');
  const autoBtn = root.querySelector('[data-act="auto"]');

  function hatchQuad() {
    const inset = 0.08;
    return [[inset, inset], [1 - inset, inset], [1 - inset, 1 - inset], [inset, 1 - inset]];
  }

  function drawQuadOn(canvas, q, color, fill, handles) {
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h || !q) return;
    const ctx = canvas.getContext('2d');
    if (!fill) ctx.clearRect(0, 0, w, h);
    else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      q.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    q.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(handles ? [] : [7, 5]);
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
  }

  function drawOverlay() {
    const canvas = el.overlay;
    if (!canvas.width) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    if (suggested && (!quad || quadDistance(suggested, quad) > 0.03)) drawQuadOn(canvas, suggested, 'rgba(255,255,255,0.6)', true, false);
    if (quad) drawQuadOn(canvas, quad, hold > 0.45 ? '#bfe8c9' : '#8ec9ff', true, true);
  }

  function sizeOverlay(canvas, host) {
    const box = host.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(box.width));
    canvas.height = Math.max(1, Math.round(box.height));
  }

  function resizeOverlay() {
    sizeOverlay(el.overlay, el.stage);
    drawOverlay();
    resizeEdit();
  }

  function setQuad(next, target = 'camera') {
    const q = orderQuad(next).map(([x, y]) => [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))]);
    if (target === 'edit' && editing >= 0) {
      pages[editing].quad = q;
      drawEdit();
      return;
    }
    quad = q;
    drawOverlay();
  }

  function setHint(text, kind = '') {
    el.hint.textContent = text || '';
    el.hint.dataset.kind = kind;
    el.hint.hidden = !text;
  }

  function paintRing() {
    el.ring.style.setProperty('--p', hold.toFixed(3));
    el.ring.classList.toggle('is-armed', hold > 0.05);
  }

  function detectFrame() {
    if (!running || mode !== 'camera' || el.video.readyState < 2) return;
    const max = 260;
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
    const found = autoQuad(ctx.getImageData(0, 0, w, h).data, w, h);

    if (!found) {
      suggested = null;
      history = [];
      hold = Math.max(0, hold - 0.2);
      if (auto) quad = null;
      setHint(auto ? t('scan.seek') : '');
      paintRing();
      drawOverlay();
      return;
    }

    misses = 0;
    suggested = smoothQuad(suggested, found.quad, 0.45);
    if (!auto) {
      setHint(t('scan.found'), 'found');
      drawOverlay();
      return;
    }

    const previous = quad;
    quad = previous ? smoothQuad(previous, suggested, 0.2) : suggested.map((p) => [...p]);
    const stable = !previous || quadDistance(previous, quad) < 0.014;
    history.push({ quad: quad.map((p) => [...p]), at: performance.now(), score: found.score });
    if (history.length > 8) history.shift();
    hold = Math.max(0, Math.min(FIRE_AT, hold + (stable ? 0.23 : -0.18)));
    paintRing();
    if (hold >= FIRE_AT) {
      setHint(t('scan.hold'), 'fire');
      el.ring.classList.add('is-fire');
      if (performance.now() - lastFire > COOLDOWN && !busy) {
        lastFire = performance.now();
        hold = 0;
        setTimeout(() => el.ring.classList.remove('is-fire'), 500);
        shoot();
      }
    } else {
      setHint(hold > 0.1 ? t('scan.hold') : t('scan.found'), hold > 0.1 ? 'hold' : 'found');
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
    } catch {
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
        }, 120);
      }
    };
    loop();
    setHint(t('scan.seek'));
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

  function renderStrip() {
    const n = pages.length;
    root.querySelector('[data-act="undo"]').hidden = !n;
    root.querySelector('[data-act="done"]').hidden = !n;
    el.count.textContent = String(n);
    el.count2.textContent = String(n);
    el.strip.hidden = !n;
    el.strip.innerHTML = pages
      .map(
        (p, i) => `<button class="scan-thumb ${i === editing ? 'is-current' : ''}" type="button" data-page="${i}" aria-label="${t('scan.pageN', { n: i + 1 })}"><img src="${p.thumb || p.raw}" alt="" /></button>`,
      )
      .join('');
    el.scan.classList.toggle('has-pages', n > 0);
  }

  /** Render one page through its quad and filter at a working size. */
  function renderPage(page, maxEdge) {
    const img = new Image();
    img.src = page.raw;
    return img.decode().then(() => {
      const sw = img.naturalWidth;
      const sh = img.naturalHeight;
      const q = quadToPixels(page.quad || hatchQuad(), sw, sh);
      const [ow, oh] = outputSize(q, maxEdge);
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = sw;
      srcCanvas.height = sh;
      const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
      sctx.drawImage(img, 0, 0);
      const warped = warpPixels(sctx.getImageData(0, 0, sw, sh).data, sw, sh, q, ow, oh);
      let pixels = warped;
      if (page.straighten !== false) {
        const res = straighten(warped, ow, oh);
        page.straightenOk = res.confidence >= 0.45;
        if (res.applied) pixels = res.data;
        else page.straighten = false;
      }
      const out = document.createElement('canvas');
      out.width = ow;
      out.height = oh;
      out.getContext('2d').putImageData(new ImageData(applyFilter(pixels, ow, oh, page.filter), ow, oh), 0, 0);
      return out;
    });
  }

  async function makeThumb(index) {
    const page = pages[index];
    if (!page) return;
    try {
      const canvas = await renderPage(page, 260);
      page.thumb = canvas.toDataURL('image/jpeg', 0.7);
      if (mode === 'camera') renderStrip();
    } catch {
      /* a thumb is not worth blocking on */
    }
  }

  async function shoot() {
    if (busy || !running || mode !== 'camera') return;
    busy = true;
    el.scan.classList.add('is-busy');
    try {
      const frame = grabFrame(el.video, 2400);
      const page = { raw: frame.toDataURL('image/jpeg', 0.94), quad: (quad || hatchQuad()).map((p) => [...p]), filter, straighten: true, thumb: '' };
      pages.push(page);
      renderStrip();
      makeThumb(pages.length - 1);
      history = [];
      if (navigator.vibrate) navigator.vibrate(25);
      setHint(t('scan.taken'), 'found');
      setTimeout(() => {
        if (mode === 'camera' && !busy) setHint(auto ? t('scan.seek') : '');
      }, 1100);
    } catch {
      el.fail.hidden = false;
      el.fail.innerHTML = `<p>${t('scan.failed')}</p>`;
    }
    busy = false;
    el.scan.classList.remove('is-busy');
  }

  let previewJob = 0;
  let previewTimer = 0;

  function paintStraightenButton(page) {
    const btn = el.edit.querySelector('[data-act="editStraighten"]');
    if (!btn) return;
    const available = page.straightenOk !== false;
    btn.setAttribute('aria-checked', String(Boolean(page.straighten) && available));
    btn.classList.toggle('is-on', Boolean(page.straighten) && available);
    btn.disabled = !available;
    btn.title = available ? t('scan.straightenNote') : t('scan.straightenNone');
  }

  /** Draw the page as the current corners, look and straighten would save it. */
  function refreshEdit(delay = 90) {
    const job = ++previewJob;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      const page = pages[editing];
      if (!page) return;
      try {
        const canvas = await renderPage(page, 900);
        if (job !== previewJob) return;
        el.editPreview.width = canvas.width;
        el.editPreview.height = canvas.height;
        el.editPreview.getContext('2d').drawImage(canvas, 0, 0);
        el.editStage.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
        sizeOverlay(el.editOverlay, el.editStage);
        drawEdit();
        paintStraightenButton(page);
        el.edit.querySelectorAll('[data-editfilter]').forEach((b) => b.classList.toggle('is-on', b.dataset.editfilter === page.filter));
      } catch {
        /* keep the last preview */
      }
    }, delay);
  }

  function openEdit(index) {
    if (!pages[index]) return;
    editing = index;
    mode = 'edit';
    el.scan.classList.add('is-editing');
    el.edit.hidden = false;
    const page = pages[index];
    page.straightenOk = page.straightenOk !== false;
    if (page.straighten === undefined) page.straighten = true;
    if (!page.quad) page.quad = hatchQuad();
    el.editTitle.textContent = t('scan.pageN', { n: index + 1 });
    el.edit.querySelectorAll('[data-editfilter]').forEach((b) => b.classList.toggle('is-on', b.dataset.editfilter === page.filter));
    paintStraightenButton(page);
    el.edit.querySelector('[data-act="editPrev"]').hidden = index === 0;
    el.edit.querySelector('[data-act="editNext"]').hidden = index === pages.length - 1;
    refreshEdit(0);
    history = [];
  }

  function resizeEdit() {
    if (el.edit.hidden) return;
    sizeOverlay(el.editOverlay, el.editStage);
    drawEdit();
  }

  function drawEdit() {
    const page = pages[editing];
    if (!page) return;
    el.editOverlay.getContext('2d').clearRect(0, 0, el.editOverlay.width, el.editOverlay.height);
    drawQuadOn(el.editOverlay, page.quad, '#8ec9ff', true, true);
  }

  function applyEdit() {
    if (editing < 0) return;
    const page = pages[editing];
    page.filter = el.edit.querySelector('.scan-filter.is-on')?.dataset.editfilter || 'clean';
    makeThumb(editing);
    const next = editing + 1;
    if (next < pages.length) openEdit(next);
    else closeEdit();
  }

  function closeEdit() {
    mode = 'camera';
    editing = -1;
    el.edit.hidden = true;
    el.scan.classList.remove('is-editing');
    hold = 0;
    paintRing();
    renderStrip();
    setHint(auto ? t('scan.seek') : '');
    const box = el.stage.getBoundingClientRect();
    if (box.width) sizeOverlay(el.overlay, el.stage);
    drawOverlay();
  }

  function deleteEditing() {
    if (editing < 0) return;
    pages.splice(editing, 1);
    if (!pages.length) {
      closeEdit();
      return;
    }
    openEdit(Math.min(editing, pages.length - 1));
  }

  async function finish() {
    if (!pages.length) return close();
    const files = [];
    for (let i = 0; i < pages.length; i += 1) {
      try {
        const canvas = await renderPage(pages[i], 2200);
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
        files.push(new File([blob], `scan-${String(i + 1).padStart(2, '0')}.jpg`, { type: 'image/jpeg' }));
      } catch {
        /* skip a bad page rather than lose the rest */
      }
    }
    const stamp = new Date();
    const title = `Scan ${stamp.toLocaleDateString()} ${stamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    stop();
    el.scan.hidden = true;
    pages.length = 0;
    renderStrip();
    deps.onSave?.(files, title);
  }

  function close() {
    stop();
    el.scan.hidden = true;
    el.edit.hidden = true;
    pages.length = 0;
    mode = 'camera';
    editing = -1;
    renderStrip();
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

  /* Corner dragging, on whichever canvas is in front. */
  let drag = null;
  function near(event, canvas, q) {
    const box = canvas.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    if (!q) return -1;
    let best = -1;
    let bestD = 0.09;
    q.forEach((p, i) => {
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }

  function wireDrag(canvas, getter, setter) {
    canvas.addEventListener('pointerdown', (event) => {
      const q = getter();
      const i = near(event, canvas, q);
      if (i < 0) return;
      event.preventDefault();
      drag = i;
      if (mode === 'camera') {
        auto = false;
        autoBtn.classList.remove('is-on');
        autoBtn.setAttribute('aria-pressed', 'false');
        hold = 0;
        paintRing();
      }
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (drag == null) return;
      const box = canvas.getBoundingClientRect();
      const q = getter().map((p) => [...p]);
      q[drag] = [Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), Math.max(0, Math.min(1, (event.clientY - box.top) / box.height))];
      setter(orderQuad(q));
    });
    const end = () => {
      drag = null;
      history = [];
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  wireDrag(el.overlay, () => quad || hatchQuad(), (q) => setQuad(q, 'camera'));
  wireDrag(el.editOverlay, () => pages[editing]?.quad || hatchQuad(), (q) => setQuad(q, 'edit'));

  // With auto off, a tap on the page is the shutter.
  let tapAt = null;
  el.overlay.addEventListener('pointerdown', (event) => {
    tapAt = { x: event.clientX, y: event.clientY };
  });
  el.overlay.addEventListener('pointerup', (event) => {
    if (!tapAt) return;
    const moved = Math.hypot(event.clientX - tapAt.x, event.clientY - tapAt.y);
    tapAt = null;
    if (moved < 8 && !auto && mode === 'camera' && quad) shoot();
  });

  root.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-act], [data-filter], [data-editfilter], [data-page]');
    if (!btn || el.scan.hidden) return;
    if (btn.dataset.page) return openEdit(Number(btn.dataset.page));
    if (btn.dataset.filter) {
      filter = btn.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('is-on', b === btn));
      el.video.style.filter = PREVIEW[filter] || 'none';
      return;
    }
    if (btn.dataset.editfilter) {
      const page = pages[editing];
      if (!page) return;
      page.filter = btn.dataset.editfilter;
      paintStraightenButton(page);
      refreshEdit();
      el.edit.querySelectorAll('[data-editfilter]').forEach((b) => b.classList.toggle('is-on', b === btn));
      return;
    }
    switch (btn.dataset.act) {
      case 'close':
        return close();
      case 'shoot':
        return shoot();
      case 'done':
        return finish();
      case 'review':
        return pages.length ? openEdit(0) : null;
      case 'undo':
        pages.pop();
        renderStrip();
        return;
      case 'torch':
        return toggleTorch();
      case 'auto':
        auto = !auto;
        autoBtn.classList.toggle('is-on', auto);
        autoBtn.setAttribute('aria-pressed', String(auto));
        hold = 0;
        history = [];
        paintRing();
        setHint(auto ? t('scan.seek') : '');
        return;
      case 'editBack':
        return closeEdit();
      case 'editApply':
        return applyEdit();
      case 'editDelete':
        return deleteEditing();
      case 'editPrev':
        if (editing > 0) openEdit(editing - 1);
        return;
      case 'editNext':
        if (editing < pages.length - 1) openEdit(editing + 1);
        return;
      default:
    }
  });

  window.addEventListener('resize', () => {
    if (!el.scan.hidden) resizeOverlay();
  });

  renderStrip();

  const api = {
    async open() {
      el.scan.hidden = false;
      el.video.style.filter = PREVIEW[filter] || 'none';
      renderStrip();
      await start();
    },
    close,
    stop,
    get pages() {
      return pages.length;
    },
    setQuad,
    shoot,
    finish,
    openEdit,
    get running() {
      return running;
    },
    get mode() {
      return mode;
    },
  };
  window.__scanner = api;
  return api;
}
