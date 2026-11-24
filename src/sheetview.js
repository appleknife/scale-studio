// sheetview.js — the sheet-music shelf and the page reader.
//
// Two halves. The shelf is a local library of the music a student brings — PDFs
// from a teacher, photos of a part, a MusicXML file — held in IndexedDB so
// nothing is uploaded and nothing copyrighted has to live in the repository.
// The reader is a page on screen: turn it with a tap, a swipe or the arrows,
// zoom it, warm it or invert it for a dark stand, mark it with a pen, keep the
// place with a bookmark, and run a practice track underneath with its own speed,
// key and A–B loop.
//
// A browser cannot do what MobileSheets does with a licensed native renderer
// (Radaee) and a licensed stretcher (Superpowered), so the pieces here are
// pdf.js for the page, the browser's own image decoder for photos, OSMD for
// MusicXML, and `tempoaudio.js` for the stretch. The mechanics are the same;
// none of that app's code or art is copied.

import * as Lib from './sheetlib.js?v=202611232000';
import { renderStretched } from './tempoaudio.js?v=202611232000';
import { loadOsmd } from './listenview.js?v=202611232000';
import { t } from './i18n.js?v=202611232000';

const PDF_VENDOR = new URL('../vendor/pdfjs/', import.meta.url).href;
const PDF_SRC = PDF_VENDOR + 'pdf.js?v=202611232000';
const PDF_WORKER = PDF_VENDOR + 'pdf.worker.js?v=202611232000';
const PDF_ASSETS = PDF_VENDOR;
const MAX_DPR = 2;
const INK = '#1f4fa8';
const HIGHLIGHT = 'rgba(238, 196, 46, 0.38)';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let pdfjsPromise = null;
function loadPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = import(PDF_SRC)
    .then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = PDF_WORKER;
      window.pdfjsLib = mod;
      return mod;
    })
    .catch((err) => {
      pdfjsPromise = null;
      throw err;
    });
  return pdfjsPromise;
}

export function createSheetView(deps) {
  const root = deps.root;
  const profile = () => String(deps.profileId ? deps.profileId() : '');
  let sheets = [];
  let query = '';
  let sheet = null;
  let inkPages = {};
  let audioTracks = [];
  let readerOpen = false;

  root.innerHTML = `
    <button class="back-btn" type="button" data-act="back"><span aria-hidden="true">←</span> ${t('sheet.back')}</button>
    <div class="head-row sheet-head">
      <div>
        <h2>${t('sheet.title')}</h2>
        <p class="subtle sheet-lead">${t('sheet.lead')}</p>
      </div>
      <button class="primary-btn sheet-import" type="button" data-act="import">${t('sheet.import')}</button>
    </div>
    <div class="sheet-tools">
      <input class="sheet-search" type="search" placeholder="${t('sheet.search')}" aria-label="${t('sheet.search')}" />
      <span class="sheet-space subtle" data-el="space"></span>
    </div>
    <div class="sheet-shelf" data-el="shelf"></div>
    <p class="sheet-note subtle">${t('sheet.note')}</p>
    <input class="sheet-file" type="file" multiple hidden
      accept=".pdf,application/pdf,.musicxml,.xml,.mxl,application/vnd.recordare.musicxml+xml,image/*" />
    <input class="sheet-audio-file" type="file" multiple hidden accept="audio/*" />
    <div class="reader" data-el="reader" hidden></div>
    <div class="sheet-toast" data-el="toast" hidden></div>`;

  const shelfEl = root.querySelector('[data-el="shelf"]');
  const spaceEl = root.querySelector('[data-el="space"]');
  const searchEl = root.querySelector('.sheet-search');
  const fileEl = root.querySelector('.sheet-file');
  const audioFileEl = root.querySelector('.sheet-audio-file');
  const readerEl = root.querySelector('[data-el="reader"]');
  const toastEl = root.querySelector('[data-el="toast"]');

  let toastTimer = 0;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 3200);
  }

  function showShelf() {
    readerEl.hidden = true;
    readerOpen = false;
    closeReader();
    renderShelf();
    deps.onViewChange?.();
  }

  async function renderShelf() {
    try {
      sheets = await Lib.listSheets(profile());
    } catch {
      sheets = [];
    }
    const shown = sheets.filter((s) => {
      if (!query) return true;
      const hay = `${s.title} ${s.composer} ${(s.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(query.toLowerCase());
    });
    if (!sheets.length) {
      shelfEl.innerHTML = `
        <div class="sheet-empty">
          <p class="sheet-empty-mark" aria-hidden="true">𝄞</p>
          <h3>${t('sheet.empty.title')}</h3>
          <p class="subtle">${t('sheet.empty.lead')}</p>
          <button class="primary-btn" type="button" data-act="import">${t('sheet.import')}</button>
        </div>`;
    } else if (!shown.length) {
      shelfEl.innerHTML = `<p class="sheet-empty-line subtle">${t('sheet.noMatch')}</p>`;
    } else {
      shelfEl.innerHTML = `<div class="sheet-grid">${shown
        .map(
          (s) => `
        <article class="sheet-card" data-id="${esc(s.id)}">
          <button class="sheet-open" type="button" data-act="open" data-id="${esc(s.id)}">
            <span class="sheet-card-kind" aria-hidden="true">${kindMark(s.kind)}</span>
            <span class="sheet-card-title">${esc(s.title)}</span>
            <span class="sheet-card-sub">${esc(s.composer || t('sheet.untitledComposer'))}</span>
            <span class="sheet-card-meta">${t('sheet.cardMeta', { n: s.pageCount || 1 })}</span>
          </button>
          <button class="sheet-card-del ghost-btn" type="button" data-act="delete" data-id="${esc(s.id)}"
            aria-label="${t('sheet.delete')}">✕</button>
        </article>`,
        )
        .join('')}</div>`;
    }
    Lib.storageEstimate().then(({ used, quota }) => {
      spaceEl.textContent = quota ? t('sheet.space', { used: Lib.megabytes(used), quota: Lib.megabytes(quota) }) : '';
    });
  }

  function kindMark(kind) {
    if (kind === 'musicxml') return '♬';
    if (kind === 'image') return '▤';
    return 'PDF';
  }

  /* ── Import ──────────────────────────────────────────────────────────── */

  async function pageCountOf(file, kind) {
    if (kind !== 'pdf') return 1;
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: PDF_ASSETS + 'cmaps/',
      cMapPacked: true,
      standardFontDataUrl: PDF_ASSETS + 'standard_fonts/',
      wasmUrl: PDF_ASSETS + 'wasm/',
    }).promise;
    const n = doc.numPages || 1;
    doc.destroy();
    return n;
  }

  async function importFiles(list) {
    const files = [...list];
    let first = null;
    let failed = 0;
    for (const file of files) {
      const kind = Lib.fileKind(file);
      if (!kind) {
        if (Lib.audioKind(file) && sheet) {
          await importAudio(file);
          continue;
        }
        failed += 1;
        continue;
      }
      try {
        const { title, composer } = Lib.splitName(file.name);
        const made = Lib.emptySheet(profile(), { title, composer, kind });
        try {
          made.pageCount = await pageCountOf(file, kind);
        } catch {
          made.pageCount = 1; // the reader reports a damaged file; the card can still exist
        }
        await Lib.saveFile(made.id, file);
        await Lib.saveSheet(made);
        if (!first) first = made.id;
      } catch {
        failed += 1;
      }
    }
    await renderShelf();
    if (failed) toast(t('sheet.importFailed', { n: failed }));
    if (first) openSheet(first);
    else if (files.some(Lib.audioKind) && readerOpen) renderAudio();
  }

  /* ── The reader ──────────────────────────────────────────────────────── */

  let doc = null;
  let page = 1;
  let zoom = 1;
  let fitMode = 'page';
  let layout = 'single';
  let tool = null;
  let stroke = null;
  let eraseBox = null;
  let renderTicket = 0;
  let renderTask = null;
  let paintedPage = 0;
  let cropTimer = 0;
  const imageUrls = new Set();
  let saveTimer = 0;
  let inkTimer = 0;
  let stageW = 0;
  let stageH = 0;
  let awake = null;
  let osmd = null;
  const refs = {};

  readerEl.innerHTML = `
    <div class="reader-bar">
      <button class="reader-btn" type="button" data-act="back" aria-label="${t('sheet.close')}">←</button>
      <div class="reader-title-wrap">
        <h3 class="reader-title" data-el="title"></h3>
        <span class="reader-meta" data-el="meta"></span>
      </div>
      <div class="reader-bar-tools">
        <button class="reader-btn" type="button" data-act="bookmark" aria-label="${t('sheet.bookmark')}" title="${t('sheet.bookmark')}">🔖</button>
        <button class="reader-btn" type="button" data-act="ink" aria-label="${t('sheet.tools')}" title="${t('sheet.tools')}">✎</button>
        <button class="reader-btn" type="button" data-act="settings" aria-label="${t('sheet.settings')}" title="${t('sheet.settings')}">⚙</button>
        <button class="reader-btn" type="button" data-act="audio" aria-label="${t('sheet.audio')}" title="${t('sheet.audio')}">♫</button>
      </div>
    </div>
    <div class="reader-stage" data-el="stage" tabindex="0">
      <div class="reader-pages" data-el="pages"></div>
      <p class="reader-hint" data-el="hint" hidden></p>
    </div>
    <div class="reader-foot">
      <button class="reader-btn" type="button" data-act="prev" aria-label="${t('sheet.prev')}">‹</button>
      <input class="reader-slider" data-el="slider" type="range" min="1" max="1" value="1" aria-label="${t('sheet.page')}" />
      <span class="reader-pageno" data-el="pageno"></span>
      <button class="reader-btn" type="button" data-act="next" aria-label="${t('sheet.next')}">›</button>
      <button class="reader-btn" type="button" data-act="zoomOut" aria-label="${t('sheet.zoomOut')}">−</button>
      <button class="reader-btn" type="button" data-act="zoomIn" aria-label="${t('sheet.zoomIn')}">+</button>
    </div>
    <div class="reader-sheet reader-inkbar" data-el="inkbar" hidden>
      <div class="reader-row">
        <button class="reader-pill is-on" type="button" data-tool="pen">${t('sheet.pen')}</button>
        <button class="reader-pill" type="button" data-tool="highlight">${t('sheet.highlight')}</button>
        <button class="reader-pill" type="button" data-tool="erase">${t('sheet.eraser')}</button>
        <button class="reader-pill" type="button" data-act="undo">${t('sheet.undo')}</button>
        <button class="reader-pill" type="button" data-act="clearInk">${t('sheet.clearInk')}</button>
        <button class="reader-pill" type="button" data-act="inkOff">${t('sheet.done')}</button>
      </div>
      <p class="subtle reader-note">${t('sheet.inkNote')}</p>
    </div>
    <div class="reader-sheet" data-el="panel" hidden></div>`;

  Object.assign(refs, {
    title: readerEl.querySelector('[data-el="title"]'),
    meta: readerEl.querySelector('[data-el="meta"]'),
    stage: readerEl.querySelector('[data-el="stage"]'),
    pages: readerEl.querySelector('[data-el="pages"]'),
    hint: readerEl.querySelector('[data-el="hint"]'),
    slider: readerEl.querySelector('[data-el="slider"]'),
    pageno: readerEl.querySelector('[data-el="pageno"]'),
    inkbar: readerEl.querySelector('[data-el="inkbar"]'),
    panel: readerEl.querySelector('[data-el="panel"]'),
  });

  function pagesShowing() {
    const count = sheet?.pageCount || 1;
    return layout === 'spread' ? [page, page + 1].filter((p) => p >= 1 && p <= count) : [page];
  }

  function setHint(text) {
    refs.hint.textContent = text || '';
    refs.hint.hidden = !text;
  }

  function scheduleSave(delay = 800) {
    clearTimeout(saveTimer);
    if (!sheet) return;
    saveTimer = setTimeout(() => {
      if (!sheet) return;
      sheet.lastPage = page;
      sheet.lastOpenedAt = Date.now();
      Lib.saveSheet(sheet).catch(() => {});
    }, delay);
  }

  async function openSheet(id) {
    const found = await Lib.getSheet(id);
    if (!found) return;
    await closeReader();
    sheet = found;
    inkPages = await Lib.getInk(sheet.id).catch(() => ({}));
    audioTracks = await Lib.getAudio(sheet.id).catch(() => []);
    page = Lib.turnPage(sheet.lastPage || 1, sheet.pageCount || 1, 0);
    zoom = Lib.clampZoom(sheet.settings?.zoom || 1);
    fitMode = sheet.settings?.fit === 'width' ? 'width' : 'page';
    layout = sheet.settings?.spread ? 'spread' : 'single';
    readerEl.hidden = false;
    readerOpen = true;
    deps.onViewChange?.();
    refs.title.textContent = sheet.title;
    refs.meta.textContent = sheet.composer || '';
    refs.slider.max = String(Math.max(1, sheet.pageCount || 1));
    refs.pages.innerHTML = '';
    toastEl.hidden = true;

    if (sheet.settings?.keepAwake !== false) keepAwake(true);
    if (sheet.kind === 'pdf') {
      try {
        const pdfjs = await loadPdfjs();
        const file = await Lib.getFile(sheet.id);
        doc = await pdfjs.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
          cMapUrl: PDF_ASSETS + 'cmaps/',
          cMapPacked: true,
          standardFontDataUrl: PDF_ASSETS + 'standard_fonts/',
          wasmUrl: PDF_ASSETS + 'wasm/',
        }).promise;
        sheet.pageCount = doc.numPages || 1;
        refs.slider.max = String(sheet.pageCount);
      } catch (err) {
        console.error('sheet: pdf open failed', err);
        refs.meta.textContent = String(err && err.message || err);
        toast(t('sheet.openFailed'));
      }
    }

    await measure();
    await paint();
    if (sheet.autoplay && sheet.audioId) playTrack(sheet.audioId, true);
    refs.stage.focus({ preventScroll: true });
  }

  async function closeReader() {
    clearTimeout(saveTimer);
    clearTimeout(inkTimer);
    if (sheet) {
      sheet.lastPage = page;
      sheet.lastOpenedAt = Date.now();
      await Lib.saveSheet(sheet).catch(() => {});
      await Lib.saveInk(sheet.id, inkPages).catch(() => {});
    }
    stopAudio();
    stopMetronome();
    keepAwake(false);
    buffer = null;
    stash = null;
    currentTrack = null;
    loopA = 0;
    loopB = 0;
    rate = 1;
    semitones = 0;
    loopOn = false;
    if (doc) {
      try {
        doc.destroy();
      } catch {
        /* already gone */
      }
      doc = null;
    }
    osmd = null;
    sheet = null;
    inkPages = {};
    audioTracks = [];
    tool = null;
    paintedPage = 0;
    refs.pages.innerHTML = '';
    imageUrls.forEach((url) => URL.revokeObjectURL(url));
    imageUrls.clear();
    refs.panel.hidden = true;
    refs.inkbar.hidden = true;
  }

  async function measure() {
    stageW = refs.stage.clientWidth;
    stageH = refs.stage.clientHeight;
  }

  function scaleFor(view) {
    const fit = Lib.fitScale(view.width, view.height, stageW, stageH, fitMode);
    return Math.max(0.05, fit * zoom);
  }

  async function paint() {
    if (!sheet) return;
    const ticket = ++renderTicket;
    const keepScroll = paintedPage === page ? refs.stage.scrollTop : 0;
    try {
      renderTask?.cancel();
    } catch {
      /* already finished */
    }
    renderTask = null;
    const pages = pagesShowing();
    refs.pageno.textContent = Lib.pageLabel(page, sheet.pageCount || 1);
    refs.slider.value = String(page);
    refs.pages.dataset.layout = layout;
    refs.pages.innerHTML = '';
    imageUrls.forEach((url) => URL.revokeObjectURL(url));
    imageUrls.clear();
    for (const n of pages) refs.pages.appendChild(pageBox(n));
    if (tool) setHint(t('sheet.inkHint'));

    for (const n of pages) {
      const box = refs.pages.querySelector(`[data-page="${n}"]`);
      if (!box) continue;
      try {
        await paintPage(n, box, ticket);
      } catch (err) {
        if (err && err.name === 'RenderingCancelledException') return;
        if (ticket === renderTicket) {
          const media = box.querySelector('.page-media');
          if (media) media.innerHTML = `<p class="page-fail">${t('sheet.pageFailed')}</p>`;
        }
      }
      if (ticket !== renderTicket) return;
    }
    paintedPage = page;
    refs.stage.scrollTop = keepScroll;
    scheduleSave();
  }

  function pageBox(n) {
    const box = document.createElement('div');
    box.className = 'page-box';
    box.dataset.page = String(n);
    box.innerHTML = `
      <div class="page-frame">
        <div class="page-media"></div>
        <canvas class="page-ink"></canvas>
      </div>
      <span class="page-no" aria-hidden="true">${n}</span>`;
    wireInk(box.querySelector('.page-ink'), n);
    return box;
  }

  async function paintPage(n, box, ticket) {
    const media = box.querySelector('.page-media');
    const frame = box.querySelector('.page-frame');
    const ink = box.querySelector('.page-ink');

    let viewW = 612;
    let viewH = 792;
    if (sheet.kind === 'pdf' && doc) {
      const pdfPage = await doc.getPage(n);
      const base = pdfPage.getViewport({ scale: 1 });
      viewW = base.width;
      viewH = base.height;
    } else if (sheet.kind === 'image') {
      const file = await Lib.getFile(sheet.id);
      const url = URL.createObjectURL(file);
      imageUrls.add(url);
      media.innerHTML = `<img class="page-image" src="${url}" alt="" draggable="false" />`;
      const img = media.querySelector('img');
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      viewW = img.naturalWidth || 900;
      viewH = img.naturalHeight || 1200;
    }

    const crop = Lib.cropRect(sheet.settings?.crop);
    const scale =
      sheet.kind === 'musicxml'
        ? Math.max(0.2, (stageW - 24) / Math.max(1, viewW))
        : scaleFor({ width: viewW, height: viewH });
    const cssW = Math.max(20, viewW * scale * (1 / crop.width));
    const cssH = Math.max(20, viewH * scale * (1 / crop.height));

    box.style.width = `${viewW * scale}px`;
    box.style.height = `${viewH * scale}px`;
    frame.style.width = `${cssW}px`;
    frame.style.height = `${cssH}px`;
    frame.style.transform = `translate(${-crop.left * 100}%, ${-crop.top * 100}%)`;
    box.style.filter = Lib.toneFilter(sheet.settings?.tone, sheet.settings?.brightness);

    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    ink.width = Math.round(cssW * dpr);
    ink.height = Math.round(cssH * dpr);
    ink.style.width = `${cssW}px`;
    ink.style.height = `${cssH}px`;
    drawInk(ink, n);

    if (sheet.kind === 'pdf' && doc) {
      const pdfPage = await doc.getPage(n);
      const viewport = pdfPage.getViewport({ scale: scale * (1 / crop.width) * dpr });
      const canvas = document.createElement('canvas');
      canvas.className = 'page-image';
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      media.innerHTML = '';
      media.appendChild(canvas);
      if (ticket !== renderTicket) return;
      renderTask = pdfPage.render({ canvas, viewport });
      await renderTask.promise;
    } else if (sheet.kind === 'pdf') {
      media.innerHTML = `<p class="page-fail">${t('sheet.openFailed')}</p>`;
    } else if (sheet.kind === 'musicxml') {
      media.innerHTML = `<div class="page-music"></div>`;
      try {
        const lib = await loadOsmd();
        osmd = new lib.OpenSheetMusicDisplay(media.querySelector('.page-music'), {
          autoResize: false,
          backend: 'svg',
          drawTitle: true,
          drawComposer: true,
          drawPartNames: false,
        });
        await osmd.load(await (await Lib.getFile(sheet.id)).text());
        osmd.render();
        const svg = media.querySelector('svg');
        if (svg) {
          svg.removeAttribute('height');
          svg.style.width = '100%';
          svg.style.height = 'auto';
        }
        const tall = Math.max(240, media.scrollHeight);
        box.style.height = `${tall}px`;
        frame.style.height = `${tall}px`;
        ink.width = Math.round(box.clientWidth * dpr);
        ink.height = Math.round(tall * dpr);
        ink.style.width = `${box.clientWidth}px`;
        ink.style.height = `${tall}px`;
        drawInk(ink, n);
      } catch (err) {
        console.error('sheet: musicxml failed', err);
        media.innerHTML = `<p class="page-fail">${t('sheet.xmlFailed')} ${esc(err && err.message || err)}</p>`;
      }
    }
  }

  /* ── Ink ─────────────────────────────────────────────────────────────── */

  function pageInk(n) {
    if (!inkPages[n]) inkPages[n] = { strokes: [], undone: [] };
    return inkPages[n];
  }

  function saveInkSoon() {
    clearTimeout(inkTimer);
    inkTimer = setTimeout(() => {
      if (sheet) Lib.saveInk(sheet.id, inkPages).catch(() => {});
    }, 400);
  }

  function strokeStyle(s, width) {
    return { color: s.kind === 'highlight' ? HIGHLIGHT : INK, width: (s.width / 800) * width * (s.kind === 'highlight' ? 9 : 1) };
  }

  function strokePath(ctx, pts, w, h) {
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0][0] * w, pts[0][1] * h, Math.max(1.2, ctx.lineWidth / 2), 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
      return;
    }
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    ctx.stroke();
  }

  function drawInk(canvas, n) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const data = inkPages[n];
    if (data) {
      for (const s of data.strokes) {
        const style = strokeStyle(s, w);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = Math.max(1, style.width);
        strokePath(ctx, s.pts, w, h);
      }
    }
    if (stroke) {
      const style = strokeStyle(stroke, w);
      ctx.strokeStyle = style.color;
      ctx.lineWidth = Math.max(1, style.width);
      strokePath(ctx, stroke.pts, w, h);
    }
    if (eraseBox) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = 'rgba(192, 57, 43, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(eraseBox.x0 * w, eraseBox.y0 * h, (eraseBox.x1 - eraseBox.x0) * w, (eraseBox.y1 - eraseBox.y0) * h);
      ctx.setLineDash([]);
    }
  }

  function localPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return [
      Lib.clamp((event.clientX - rect.left) / rect.width, 0, 1),
      Lib.clamp((event.clientY - rect.top) / rect.height, 0, 1),
    ];
  }

  function wireInk(canvas, n) {
    const redraw = () => drawInk(canvas, n);
    canvas.addEventListener('pointerdown', (event) => {
      if (!tool) return;
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      const p = localPoint(canvas, event);
      if (tool === 'erase') eraseBox = { x0: p[0], y0: p[1], x1: p[0], y1: p[1] };
      else stroke = { kind: tool, width: tool === 'highlight' ? 18 : 2.6, pts: [p] };
      redraw();
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!stroke && !eraseBox) return;
      const p = localPoint(canvas, event);
      if (eraseBox) {
        eraseBox.x1 = p[0];
        eraseBox.y1 = p[1];
      } else if (stroke) {
        const prev = stroke.pts[stroke.pts.length - 1];
        if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 0.0015) stroke.pts.push(p);
      }
      redraw();
    });
    const up = () => {
      if (!tool) return;
      const data = pageInk(n);
      if (eraseBox) {
        const box = {
          x0: Math.min(eraseBox.x0, eraseBox.x1),
          x1: Math.max(eraseBox.x0, eraseBox.x1),
          y0: Math.min(eraseBox.y0, eraseBox.y1),
          y1: Math.max(eraseBox.y0, eraseBox.y1),
        };
        const before = data.strokes;
        const kept = before.filter((s) => !s.pts.some(([x, y]) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1));
        if (kept.length !== before.length) data.undone.push({ type: 'erase', strokes: before.filter((s) => !kept.includes(s)) });
        data.strokes = kept;
        eraseBox = null;
      } else if (stroke) {
        data.strokes.push(stroke);
        data.undone.push({ type: 'add' });
        stroke = null;
      }
      redraw();
      saveInkSoon();
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  function undoInk(n) {
    const data = inkPages[n];
    if (!data || !data.undone.length) return;
    const step = data.undone.pop();
    if (step.type === 'add') data.strokes.pop();
    else if (step.type === 'erase') data.strokes.push(...step.strokes);
    const canvas = refs.pages.querySelector(`[data-page="${n}"] .page-ink`);
    if (canvas) drawInk(canvas, n);
    saveInkSoon();
  }

  function setTool(next) {
    tool = next;
    refs.inkbar.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('is-on', b.dataset.tool === tool));
    refs.stage.classList.toggle('is-inking', Boolean(tool));
    refs.pages.querySelectorAll('.page-ink').forEach((c) => c.classList.toggle('is-active', Boolean(tool)));
    setHint(tool ? t('sheet.inkHint') : '');
  }

  /* ── Turning and zoom ────────────────────────────────────────────────── */

  function goTo(next) {
    const target = Lib.turnPage(next, sheet?.pageCount || 1, 0);
    if (target === page) return;
    page = target;
    paint();
  }

  function step(delta) {
    if (sheet?.settings?.halfPage && layout === 'single' && zoom <= 1.05) {
      const nearBottom = refs.stage.scrollTop + refs.stage.clientHeight >= refs.stage.scrollHeight - 8;
      const atTop = refs.stage.scrollTop <= 4;
      if (delta > 0 && !nearBottom) {
        refs.stage.scrollBy({ top: refs.stage.clientHeight * 0.82, behavior: 'smooth' });
        return;
      }
      if (delta < 0 && !atTop) {
        refs.stage.scrollBy({ top: -refs.stage.clientHeight * 0.82, behavior: 'smooth' });
        return;
      }
    }
    const size = layout === 'spread' ? 2 : 1;
    const next = Lib.turnPage(page, sheet?.pageCount || 1, delta * size);
    if (next !== page) {
      page = next;
      paint();
    }
  }

  function setZoom(next) {
    zoom = Lib.clampZoom(next);
    fitMode = 'free';
    if (sheet) sheet.settings = { ...sheet.settings, zoom, fit: fitMode };
    paint();
  }

  /* ── Panels ──────────────────────────────────────────────────────────── */

  function panelIs(name) {
    return !refs.panel.hidden && refs.panel.dataset.panel === name;
  }

  function closePanel() {
    refs.panel.hidden = true;
    refs.panel.dataset.panel = '';
  }

  function togglePanel(name) {
    if (panelIs(name)) return closePanel();
    refs.panel.hidden = false;
    refs.panel.dataset.panel = name;
    if (name === 'settings') renderSettings();
    else if (name === 'bookmarks') renderBookmarks();
    else if (name === 'audio') renderAudio();
  }

  function renderSettings() {
    const s = sheet.settings;
    refs.panel.innerHTML = `
      <div class="reader-row">
        <h4>${t('sheet.settings')}</h4>
        <button class="reader-pill" type="button" data-act="closePanel">${t('sheet.done')}</button>
      </div>
      <div class="reader-row">
        <span class="reader-label">${t('sheet.tone')}</span>
        <div class="segmented small" role="group">
          ${Lib.TONES.map(
            (tone) =>
              `<button type="button" data-tone="${tone}" aria-selected="${s.tone === tone}">${t('sheet.tone.' + tone)}</button>`,
          ).join('')}
        </div>
      </div>
      <label class="reader-row">
        <span class="reader-label">${t('sheet.brightness')}</span>
        <input type="range" data-set="brightness" min="0.55" max="1.5" step="0.05" value="${s.brightness}" />
      </label>
      <div class="reader-row">
        <span class="reader-label">${t('sheet.fit')}</span>
        <div class="segmented small" role="group">
          <button type="button" data-fit="page" aria-selected="${s.fit === 'page'}">${t('sheet.fit.page')}</button>
          <button type="button" data-fit="width" aria-selected="${s.fit === 'width'}">${t('sheet.fit.width')}</button>
        </div>
      </div>
      <div class="reader-row">
        <button class="reader-pill ${s.halfPage ? 'is-on' : ''}" type="button" data-toggle="halfPage">${t('sheet.halfPage')}</button>
        <button class="reader-pill ${s.spread ? 'is-on' : ''}" type="button" data-toggle="spread">${t('sheet.spread')}</button>
        <button class="reader-pill ${s.keepAwake !== false ? 'is-on' : ''}" type="button" data-toggle="keepAwake">${t('sheet.keepAwake')}</button>
      </div>
      <div class="reader-crop">
        <h5>${t('sheet.crop')}</h5>
        ${['l', 'r', 't', 'b'].map(
          (edge) => `
          <label class="reader-row">
            <span class="reader-label">${t('sheet.crop.' + edge)}</span>
            <input type="range" data-crop="${edge}" min="0" max="0.25" step="0.01" value="${s.crop?.[edge] || 0}" />
          </label>`,
        ).join('')}
        <button class="reader-pill" type="button" data-act="cropReset">${t('sheet.crop.reset')}</button>
      </div>`;
  }

  function renderBookmarks() {
    const marks = sheet.bookmarks || [];
    refs.panel.innerHTML = `
      <div class="reader-row">
        <h4>${t('sheet.bookmarks')}</h4>
        <button class="reader-pill" type="button" data-act="bookmarkPage">${t('sheet.addBookmark')}</button>
        <button class="reader-pill" type="button" data-act="closePanel">${t('sheet.done')}</button>
      </div>
      ${marks.length
        ? `<ul class="reader-list">${marks
            .map(
              (m) => `
          <li>
            <button class="reader-list-go" type="button" data-mark="${m.page}" data-mark-id="${esc(m.id)}">
              <strong>${esc(m.name || '')}</strong><span>${t('sheet.pageN', { n: m.page })}</span>
            </button>
            <button class="reader-pill" type="button" data-unmark="${esc(m.id)}">${t('sheet.remove')}</button>
          </li>`,
            )
            .join('')}</ul>`
        : `<p class="subtle">${t('sheet.noBookmarks')}</p>`}`;
  }

  /* ── The practice track ──────────────────────────────────────────────── */

  let ac = null;
  let out = null;
  let master = null;
  let stash = null; // the decoded recording, untouched
  let buffer = null; // the same recording at this speed and key
  let currentTrack = null;
  let source = null;
  let playing = false;
  let startedAt = 0;
  let startOffset = 0;
  let rate = 1;
  let semitones = 0;
  let volume = 0.8;
  let stretchJob = 0;
  let stretchTimer = 0;
  let loopOn = false;
  let loopA = 0;
  let loopB = 0;
  let ticker = 0;

  function ensureAudio() {
    if (ac) return true;
    const shared = deps.audio ? deps.audio() : null;
    ac = shared?.ctx || new (window.AudioContext || window.webkitAudioContext)();
    out = ac.destination;
    master = ac.createGain();
    master.gain.value = volume;
    master.connect(out);
    return true;
  }

  function position() {
    if (!playing) return startOffset;
    return Lib.clamp((ac ? ac.currentTime : 0) - startedAt + startOffset, 0, buffer?.duration || 0);
  }

  async function importAudio(file) {
    if (!sheet) return;
    try {
      const track = { id: Lib.uid(), name: file.name, volume: 0.8, rate: 1, semitones: 0, a: 0, b: 0 };
      const blob = file.slice(0, file.size, file.type);
      await Lib.saveAudioBlob(sheet.id, track.id, blob);
      audioTracks = [...audioTracks, { ...track, blob }];
      await saveAudioWithFiles(audioTracks.map(({ blob: b, ...rest }) => rest));
      renderAudio();
      toast(t('sheet.audioAdded'));
    } catch {
      toast(t('sheet.audioFailed'));
    }
  }

  async function saveAudioWithFiles(tracks) {
    if (!sheet) return;
    await Lib.saveAudio(sheet.id, tracks).catch(() => {});
  }

  const stripBlob = () => audioTracks.map(({ blob, ...rest }) => rest);

  async function reloadTracks() {
    const rows = await Lib.getAudio(sheet.id).catch(() => []);
    audioTracks = await Promise.all(rows.map(async (row) => ({ ...row, blob: await Lib.getAudioBlob(sheet.id, row.id) })));
  }

  async function selectTrack(id) {
    stopAudio();
    currentTrack = audioTracks.find((row) => row.id === id) || null;
    buffer = null;
    stash = null;
    if (!currentTrack) return;
    sheet.audioId = id;
    await Lib.saveSheet(sheet).catch(() => {});
    rate = currentTrack.rate || 1;
    semitones = currentTrack.semitones || 0;
    volume = currentTrack.volume ?? 0.8;
    loopA = currentTrack.a || 0;
    loopB = currentTrack.b || 0;
    ensureAudio();
    master.gain.value = volume;
    if (currentTrack.file) {
      try {
        stash = await ac.decodeAudioData(await currentTrack.file.arrayBuffer());
        buffer = stash;
        await restretch(true);
        startedAt = ac.currentTime;
        startOffset = 0;
        renderAudio();
        drawTrackClock();
        return;
      } catch {
        toast(t('sheet.audioFailed'));
      }
    } else if (currentTrack.id) {
      const blob = await Lib.getAudioBlob(sheet.id, currentTrack.id);
      if (blob) {
        currentTrack.file = blob;
        try {
          stash = await ac.decodeAudioData(await blob.arrayBuffer());
          buffer = stash;
          await restretch(true);
          startedAt = ac.currentTime;
          startOffset = 0;
        } catch {
          toast(t('sheet.audioFailed'));
        }
      }
    }
    renderAudio();
  }

  async function restretch(keep) {
    const job = ++stretchJob;
    if (!stash) return;
    const at = keep ? position() : 0;
    const wasPlaying = playing;
    if (wasPlaying) stopSource();
    const rendered = await Promise.resolve().then(() => renderStretched(ac, stash, rate, semitones));
    if (job !== stretchJob || !sheet) return;
    buffer = rendered;
    startOffset = Lib.clamp(at, 0, rendered.duration);
    if (wasPlaying) startSource();
    drawTrackClock();
  }

  function startSource() {
    if (!ac || !buffer) return;
    stopSource(true);
    const node = ac.createBufferSource();
    node.buffer = buffer;
    node.connect(master);
    node.onended = () => {
      window.__sheetEnd = ac.currentTime;
      if (source !== node) return;
      playing = false;
      source = null;
      startOffset = 0;
      drawTrackClock();
      renderAudio();
    };
    node.start(0, Lib.clamp(startOffset, 0, buffer.duration));
    window.__sheetStart = { at: ac.currentTime, off: startOffset, dur: buffer.duration };
    source = node;
    startedAt = ac.currentTime;
    playing = true;
    tick();
  }

  function stopSource(quiet) {
    if (source) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        /* already stopped */
      }
      source = null;
    }
    if (!quiet) playing = false;
  }

  async function playTrack(id, fromStart) {
    if (!sheet) return;
    try {
    window.__sheetErr = '';
    window.__sheetBuf = 0;
    window.__sheetBuf = buffer ? buffer.duration : -1;
    window.__sheetPlay = (window.__sheetPlay || 0) + 1;
    await ensureAudio();
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    if (!currentTrack || currentTrack.id !== id) {
      await reloadTracks();
      await selectTrack(id);
    } else if (!buffer && stash) {
      buffer = stash;
    }
    if (!buffer) return;
    if (fromStart) startOffset = 0;
    startSource();
    renderAudio();
    drawTrackClock();
    } catch (err) { window.__sheetErr = String(err && err.message || err); console.error(err); }
  }

  function pauseTrack() {
    startOffset = position();
    stopSource();
    playing = false;
    renderAudio();
    drawTrackClock();
  }

  function stopAudio() {
    loopOn = false;
    stopSource();
    playing = false;
    startOffset = 0;
    cancelAnimationFrame(ticker);
    ticker = 0;
  }

  function statusTime() {
    if (!buffer) {
      return '0:00';
    }
    return `${Lib.clock(startOffset)} / ${Lib.clock(buffer.duration)}`;
  }

  function seek(seconds) {
    startOffset = Lib.clamp(seconds, 0, (buffer?.duration || 0) - 0.02);
    if (playing) startSource();
    drawTrackClock();
  }

  function tick() {
    cancelAnimationFrame(ticker);
    const run = () => {
      if (!playing) return;
      if (loopOn && loopB - loopA > 0.2) {
        const now = position();
        if (now >= loopB) {
          seek(loopA);
        }
      }
      if (nowAtEnd()) {
        playing = false;
        startOffset = 0;
      }
      drawTrackClock();
      ticker = requestAnimationFrame(run);
    };
    ticker = requestAnimationFrame(run);
  }

  function nowAtEnd() {
    return playing && buffer && position() >= buffer.duration - 0.02;
  }

  function drawTrackClock() {
    window.__sheetPos = position();
    window.__sheetState = ac ? ac.state + ':' + ac.currentTime.toFixed(2) + ':' + (source ? 'src' : 'nosrc') : 'noctx';
    const clockEl = refs.panel.querySelector('[data-el="track-time"]');
    const slider = refs.panel.querySelector('[data-el="track-seek"]');
    const playBtn = refs.panel.querySelector('[data-act="trackPlay"]');
    if (clockEl) clockEl.textContent = statusTime();
    if (slider) slider.value = String(position());
    if (playBtn) playBtn.textContent = playing ? t('sheet.audioPause') : t('sheet.audioPlay');
  }

  function saveTrackSettings() {
    if (!currentTrack) return;
    currentTrack.rate = rate;
    currentTrack.semitones = semitones;
    currentTrack.volume = volume;
    currentTrack.a = loopA;
    currentTrack.b = loopB;
    saveAudioWithFiles(stripBlob());
  }

  function renderAudio() {
    if (!sheet) return;
    if (!refs.panel.dataset.panel || refs.panel.hidden) return;
    if (refs.panel.dataset.panel !== 'audio') return;
    const marks = loopA || loopB ? `A ${Lib.clock(loopA)} · B ${Lib.clock(loopB)}` : t('sheet.noLoop');
    refs.panel.innerHTML = `
      <div class="reader-row">
        <h4>${t('sheet.audio')}</h4>
        <button class="reader-pill" type="button" data-act="closePanel">${t('sheet.done')}</button>
      </div>
      <div class="reader-row">
        <button class="primary-btn" type="button" data-act="pickAudio">${t('sheet.addAudio')}</button>
        <label class="reader-check"><input type="checkbox" data-el="autoplay" ${sheet.autoplay ? 'checked' : ''} /> ${t('sheet.autoplay')}</label>
      </div>
      ${
        audioTracks.length
          ? `<ul class="reader-list">${audioTracks
              .map(
                (row) => `
            <li class="${row.id === currentTrack?.id ? 'is-current' : ''}">
              <button class="reader-list-go" type="button" data-track="${esc(row.id)}">
                <strong>${esc(row.name)}</strong>
              </button>
              <button class="reader-pill" type="button" data-track-del="${esc(row.id)}">${t('sheet.remove')}</button>
            </li>`,
              )
              .join('')}</ul>`
          : `<p class="subtle">${t('sheet.noAudio')}</p>`
      }
      <div class="reader-player ${currentTrack ? '' : 'is-off'}">
        <div class="reader-row">
          <button class="primary-btn" type="button" data-act="trackPlay" ${currentTrack ? '' : 'disabled'}>${
            playing ? t('sheet.audioPause') : t('sheet.audioPlay')
          }</button>
          <button class="reader-pill" type="button" data-act="trackStop" ${currentTrack ? '' : 'disabled'}>${t('sheet.audioRestart')}</button>
          <span class="reader-time" data-el="track-time">${statusTime()}</span>
        </div>
        <input class="reader-seek" data-el="track-seek" type="range" min="0" max="${buffer?.duration || 1}" step="0.05" value="${position()}" ${currentTrack ? '' : 'disabled'} />
        <label class="reader-row">
          <span class="reader-label">${t('sheet.speed')} <b data-el="rate-label">${rate.toFixed(2)}×</b></span>
          <input type="range" data-set="rate" min="0.5" max="1.5" step="0.05" value="${rate}" />
        </label>
        <label class="reader-row">
          <span class="reader-label">${t('sheet.pitch')} <b data-el="pitch-label">${semitones > 0 ? '+' : ''}${semitones}</b></span>
          <input type="range" data-set="pitch" min="-12" max="12" step="1" value="${semitones}" />
        </label>
        <label class="reader-row">
          <span class="reader-label">${t('sheet.volume')}</span>
          <input type="range" data-set="volume" min="0" max="1" step="0.02" value="${volume}" />
        </label>
        <div class="reader-row">
          <button class="reader-pill" type="button" data-act="loopA">${t('sheet.setA')}</button>
          <button class="reader-pill" type="button" data-act="loopB">${t('sheet.setB')}</button>
          <button class="reader-pill ${loopOn ? 'is-on' : ''}" type="button" data-act="loopToggle">${t('sheet.loop')}</button>
          <span class="subtle" data-el="loop">${marks}</span>
        </div>
        <p class="subtle reader-note">${t('sheet.audioNote')}</p>
      </div>
      <div class="reader-row reader-metro">
        <span class="reader-label">${t('sheet.metronome')}</span>
        <button class="reader-pill ${metro.on ? 'is-on' : ''}" type="button" data-act="metro">${metro.on ? t('sheet.stop') : t('sheet.start')}</button>
        <input type="range" data-set="bpm" min="40" max="208" step="2" value="${metro.bpm}" />
        <b data-el="bpm-label">${metro.bpm}</b>
      </div>`;
    drawTrackClock();
  }

  /* ── Metronome ───────────────────────────────────────────────────────── */

  const metro = { on: false, bpm: 88, beats: 4, timer: 0, next: 0, count: 0, gain: null };

  function metroClick(accent) {
    if (!ac || !metro.gain) return;
    const at = ac.currentTime;
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.frequency.value = accent ? 1568 : 1046;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, at + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    osc.connect(env).connect(metro.gain);
    osc.start(at);
    osc.stop(at + 0.07);
  }

  function metroSchedule() {
    if (!metro.on) return;
    const ahead = 0.12;
    while (metro.next < ac.currentTime + ahead) {
      const accent = metro.count % metro.beats === 0;
      const delay = Math.max(0, metro.next - ac.currentTime);
      setTimeout(() => metroClick(accent), delay * 1000);
      metro.count += 1;
      metro.next += 60 / metro.bpm;
    }
    metro.timer = setTimeout(metroSchedule, 25);
  }

  function startMetronome() {
    ensureAudio();
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    if (!metro.gain) {
      metro.gain = ac.createGain();
      metro.gain.gain.value = 0.8;
      metro.gain.connect(out);
    }
    metro.on = true;
    metro.count = 0;
    metro.next = ac.currentTime + 0.08;
    metroSchedule();
    renderAudio();
  }

  function stopMetronome() {
    metro.on = false;
    clearTimeout(metro.timer);
    metro.timer = 0;
    if (refs.panel && !refs.panel.hidden) renderAudio();
  }

  /* ── Screen awake ────────────────────────────────────────────────────── */

  async function keepAwake(on) {
    if (on) {
      if (awake || !navigator.wakeLock) return;
      try {
        awake = await navigator.wakeLock.request('screen');
        awake.addEventListener('release', () => {
          awake = null;
        });
      } catch {
        awake = null;
      }
    } else {
      try {
        await awake?.release();
      } catch {
        /* already released */
      }
      awake = null;
    }
  }

  /* ── Events ──────────────────────────────────────────────────────────── */

  const onRootClick = async (event) => {
    const btn = event.target.closest('[data-act], [data-tool], [data-tone], [data-fit], [data-toggle], [data-track], [data-track-del], [data-mark], [data-unmark]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (btn.dataset.tool) return setTool(btn.dataset.tool);
    if (btn.dataset.tone && sheet) {
      sheet.settings.tone = btn.dataset.tone;
      await Lib.saveSheet(sheet).catch(() => {});
      renderSettings();
      return paint();
    }
    if (btn.dataset.fit && sheet) {
      fitMode = btn.dataset.fit;
      sheet.settings.fit = fitMode;
      await Lib.saveSheet(sheet).catch(() => {});
      renderSettings();
      return paint();
    }
    if (btn.dataset.toggle && sheet) {
      const key = btn.dataset.toggle;
      if (key === 'spread') {
        layout = layout === 'spread' ? 'single' : 'spread';
        sheet.settings.spread = layout === 'spread';
        if (page > (sheet.pageCount || 1)) page = sheet.pageCount || 1;
      } else if (key === 'halfPage') {
        sheet.settings.halfPage = !sheet.settings.halfPage;
      } else if (key === 'keepAwake') {
        sheet.settings.keepAwake = sheet.settings.keepAwake === false;
        keepAwake(sheet.settings.keepAwake);
      }
      await Lib.saveSheet(sheet).catch(() => {});
      renderSettings();
      return paint();
    }
    if (btn.dataset.track) {
      await selectTrack(btn.dataset.track);
      return;
    }
    if (btn.dataset.trackDel) {
      audioTracks = audioTracks.filter((row) => row.id !== btn.dataset.trackDel);
      if (currentTrack?.id === btn.dataset.trackDel) {
        stopAudio();
        currentTrack = null;
        buffer = null;
        stash = null;
        sheet.audioId = null;
        await Lib.saveSheet(sheet).catch(() => {});
      }
      saveAudioWithFiles(stripBlob());
      renderAudio();
      return;
    }
    if (btn.dataset.mark) return goTo(Number(btn.dataset.mark.match(/^\d+/)?.[0] || 1));
    if (btn.dataset.unmark && sheet) {
      sheet.bookmarks = (sheet.bookmarks || []).filter((m) => m.id !== btn.dataset.unmark);
      await Lib.saveSheet(sheet).catch(() => {});
      renderBookmarks();
      return;
    }

    switch (act) {
      case 'back':
        if (readerOpen) showShelf();
        else deps.onBack?.();
        return;
      case 'import':
        fileEl.click();
        return;
      case 'open':
        openSheet(btn.dataset.id);
        return;
      case 'delete': {
        const card = sheets.find((s) => s.id === btn.dataset.id);
        if (!card) return;
        if (!window.confirm(t('sheet.deleteAsk', { title: card.title }))) return;
        await Lib.deleteSheet(card.id);
        renderShelf();
        return;
      }
      case 'prev':
        return step(-1);
      case 'next':
        return step(1);
      case 'zoomIn':
        return setZoom(zoom * 1.2);
      case 'zoomOut':
        return setZoom(zoom / 1.2);
      case 'bookmark':
        return togglePanel('bookmarks');
      case 'settings':
        return togglePanel('settings');
      case 'audio':
        ensureAudio();
        if (!currentTrack && sheet?.audioId) await selectTrack(sheet.audioId);
        return togglePanel('audio');
      case 'ink':
        refs.inkbar.hidden = !refs.inkbar.hidden;
        return setTool(refs.inkbar.hidden ? null : 'pen');
      case 'inkOff':
        refs.inkbar.hidden = true;
        return setTool(null);
      case 'undo':
        return undoInk(page);
      case 'clearInk':
        if (inkPages[page] && inkPages[page].strokes.length && window.confirm(t('sheet.clearInkAsk'))) {
          inkPages[page] = { strokes: [], undone: [] };
          const canvas = refs.pages.querySelector(`[data-page="${page}"] .page-ink`);
          if (canvas) drawInk(canvas, page);
          saveInkSoon();
        }
        return;
      case 'closePanel':
        return closePanel();
      case 'bookmarkPage': {
        if (!sheet) return;
        const name = window.prompt(t('sheet.bookmarkName'), t('sheet.pageN', { n: page }));
        if (name === null) return;
        sheet.bookmarks = [...(sheet.bookmarks || []), { id: `p${page}-${Lib.uid()}`, page, name: name.trim() || t('sheet.pageN', { n: page }) }];
        await Lib.saveSheet(sheet).catch(() => {});
        renderBookmarks();
        return;
      }
      case 'cropReset':
        sheet.settings.crop = { l: 0, r: 0, t: 0, b: 0 };
        await Lib.saveSheet(sheet).catch(() => {});
        renderSettings();
        return paint();
      case 'pickAudio':
        audioFileEl.click();
        return;
      case 'trackPlay':
        if (!currentTrack) return;
        if (playing) pauseTrack();
        else playTrack(currentTrack.id);
        return;
      case 'trackStop':
        stopAudio();
        renderAudio();
        drawTrackClock();
        return;
      case 'loopA':
        loopA = position();
        loopB = Math.max(loopB, loopA + 0.2);
        saveTrackSettings();
        renderAudio();
        return;
      case 'loopB':
        const win = Lib.loopWindow(loopA, position(), buffer?.duration || 0);
        loopA = win.a;
        loopB = win.b;
        loopOn = loopB - loopA >= 0.2;
        saveTrackSettings();
        renderAudio();
        return;
      case 'loopToggle':
        if (loopB - loopA < 0.2) {
          toast(t('sheet.loopFirst'));
          return;
        }
        loopOn = !loopOn;
        if (loopOn) seek(loopA);
        renderAudio();
        return;
      case 'metro':
        if (metro.on) {
          stopMetronome();
          renderAudio();
        } else startMetronome();
        return;
      default:
    }
  };
  root.addEventListener('click', onRootClick);
  readerEl.addEventListener('click', onRootClick);

  const onRootInput = (event) => {
    const el = event.target;
    if (el.dataset.set && sheet) {
      const kind = el.dataset.set;
      if (kind === 'brightness') {
        sheet.settings.brightness = Number(el.value);
        scheduleSave(500);
        refs.pages.querySelectorAll('.page-box').forEach((box) => {
          box.style.filter = Lib.toneFilter(sheet.settings.tone, sheet.settings.brightness);
        });
      } else if (kind === 'rate') {
        rate = Number(el.value);
        const label = refs.panel.querySelector('[data-el="rate-label"]');
        if (label) label.textContent = `${rate.toFixed(2)}×`;
        clearTimeout(stretchTimer);
        stretchTimer = setTimeout(() => restretch(true).then(saveTrackSettings), 260);
      } else if (kind === 'pitch') {
        semitones = Number(el.value);
        const label = refs.panel.querySelector('[data-el="pitch-label"]');
        if (label) label.textContent = `${semitones > 0 ? '+' : ''}${semitones}`;
        clearTimeout(stretchTimer);
        stretchTimer = setTimeout(() => restretch(true).then(saveTrackSettings), 260);
      } else if (kind === 'volume') {
        volume = Number(el.value);
        if (master) master.gain.value = volume;
        saveTrackSettings();
      } else if (kind === 'bpm') {
        metro.bpm = Number(el.value);
        const label = refs.panel.querySelector('[data-el="bpm-label"]');
        if (label) label.textContent = String(metro.bpm);
      }
      return;
    }
    if (el.dataset.crop && sheet) {
      sheet.settings.crop = { ...Lib.cropRect(sheet.settings.crop), ...{ [el.dataset.crop]: Number(el.value) } };
      sheet.settings.crop = {
        l: Number(refs.panel.querySelector('[data-crop="l"]')?.value || 0),
        r: Number(refs.panel.querySelector('[data-crop="r"]')?.value || 0),
        t: Number(refs.panel.querySelector('[data-crop="t"]')?.value || 0),
        b: Number(refs.panel.querySelector('[data-crop="b"]')?.value || 0),
      };
      clearTimeout(cropTimer);
      cropTimer = setTimeout(paint, 140);
    }
  };
  root.addEventListener('input', onRootInput);
  readerEl.addEventListener('input', onRootInput);

  refs.panel.addEventListener('change', async (event) => {
    const el = event.target;
    if (el.dataset.el === 'autoplay' && sheet) {
      sheet.autoplay = el.checked;
      await Lib.saveSheet(sheet).catch(() => {});
    }
  });

  refs.panel.addEventListener('input', (event) => {
    if (event.target.dataset.el === 'track-seek') seek(Number(event.target.value));
  });

  refs.slider.addEventListener('input', (event) => goTo(Number(event.target.value)));

  searchEl.addEventListener('input', () => {
    query = searchEl.value.trim();
    renderShelf();
  });

  fileEl.addEventListener('change', () => {
    if (fileEl.files?.length) importFiles(fileEl.files);
    fileEl.value = '';
  });
  audioFileEl.addEventListener('change', () => {
    if (audioFileEl.files?.length) importFiles(audioFileEl.files);
    audioFileEl.value = '';
  });

  let stageStart = null;
  let panFrom = null;
  let pinchFrom = null;
  const pointers = new Map();

  refs.stage.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchFrom = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      return;
    }
    if (event.target.closest('.page-ink.is-active')) return;
    stageStart = { x: event.clientX, y: event.clientY, scroll: refs.stage.scrollTop };
    if (zoom > 1.02) refs.stage.setPointerCapture?.(event.pointerId);
  });

  refs.stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchFrom && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(pinchFrom.zoom * (d / Math.max(1, pinchFrom.d)));
      return;
    }
    if (!stageStart || zoom <= 1.02) return;
    refs.stage.scrollTop = stageStart.scroll - (event.clientY - stageStart.y);
  });

  refs.stage.addEventListener('pointerup', (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchFrom = null;
    if (!stageStart) return;
    const dx = event.clientX - stageStart.x;
    const dy = event.clientY - stageStart.y;
    const quiet = Math.abs(dx) < 9 && Math.abs(dy) < 9;
    stageStart = null;
    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.4) return step(dx < 0 ? 1 : -1);
    if (!quiet) return;
    if (tool) return;
    const box = refs.stage.getBoundingClientRect();
    const share = (event.clientX - box.left) / Math.max(1, box.width);
    if (share < 0.28) step(-1);
    else if (share > 0.72) step(1);
    else {
      refs.inkbar.hidden = true;
      closePanel();
    }
  });
  refs.stage.addEventListener('pointercancel', () => {
    pointers.clear();
    stageStart = null;
    pinchFrom = null;
  });

  refs.stage.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey && zoom <= 1.02) return;
      event.preventDefault();
      setZoom(zoom * (event.deltaY < 0 ? 1.08 : 0.93));
    },
    { passive: false },
  );

  refs.stage.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'Escape') {
      if (!refs.panel.hidden) closePanel();
      else if (tool) {
        refs.inkbar.hidden = true;
        setTool(null);
      } else showShelf();
    } else if (event.key === '+' || event.key === '=') setZoom(zoom * 1.2);
    else if (event.key === '-') setZoom(zoom / 1.2);
  });

  const onResize = () => {
    if (readerOpen) {
      measure().then(paint);
    }
  };
  window.addEventListener('resize', onResize);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && sheet?.settings?.keepAwake !== false) keepAwake(true);
  });

  // The reader lives on the body, not inside the view: a screen that covers the
  // app must not sit inside the page's animated, padded shell.
  document.body.appendChild(readerEl);

  /* ── What the app calls ──────────────────────────────────────────────── */

  return {
    open() {
      showShelf();
      deps.onViewChange?.();
    },
    stop() {
      if (readerOpen) closeReader();
      readerEl.hidden = true;
      readerOpen = false;
      query = '';
      if (searchEl) searchEl.value = '';
      stopAudio();
      stopMetronome();
      keepAwake(false);
    },
    isOpen() {
      return readerOpen;
    },
    get sheetCount() {
      return sheets.length;
    },
  };
}
