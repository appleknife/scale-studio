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

import * as Lib from './sheetlib.js?v=202611251645';
import { renderStretched } from './tempoaudio.js?v=202611251645';
import { loadOsmd } from './listenview.js?v=202611251645';
import { t } from './i18n.js?v=202611251645';
import { readScoreFile } from './musicxml.js?v=202611251645';
import { createScanner } from './scanview.js?v=202611241000';
import * as Dropbox from './dropbox.js?v=202611241000';
import * as Keys from './sheetkeys.js?v=202611241000';

const PDF_VENDOR = new URL('../vendor/pdfjs/', import.meta.url).href;
const PDF_SRC = PDF_VENDOR + 'pdf.js?v=202611251645';
const PDF_WORKER = PDF_VENDOR + 'pdf.worker.js?v=202611251645';
const PDF_ASSETS = PDF_VENDOR;
const MAX_DPR = 2;
const INK = '#1f4fa8';
const HIGHLIGHT = 'rgba(238, 196, 46, 0.38)';

// One stroke icon set for the reader, so the bar reads as one family instead of
// a mix of emoji and type glyphs. 24-unit grid, drawn in currentColor.
const svg = (d, extra = '') =>
  `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;
const ICON = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  prev: svg('<path d="M14.5 6l-6 6 6 6"/>'),
  next: svg('<path d="M9.5 6l6 6-6 6"/>'),
  bookmark: svg('<path d="M7 4h10v16l-5-3.6L7 20z"/>'),
  pen: svg('<path d="M4 20l4.2-1 10.6-10.6a2 2 0 0 0 0-2.8l-.4-.4a2 2 0 0 0-2.8 0L5 15.8z"/><path d="M13.5 6.5l4 4"/>'),
  sliders: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  note: svg('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  minus: svg('<path d="M6 12h12"/>'),
  plus: svg('<path d="M12 6v12M6 12h12"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>'),
  pause: svg('<path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none"/>'),
  restart: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v4h4"/>'),
  trash: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>'),
  highlight: svg('<path d="M6 20h12"/><path d="M8.5 15.5l7.8-7.8a1.6 1.6 0 0 0 0-2.3l-.7-.7a1.6 1.6 0 0 0-2.3 0l-7.8 7.8L5 16z"/>'),
  eraser: svg('<path d="M8.5 19l-4-4a1.5 1.5 0 0 1 0-2.1l8.4-8.4a1.5 1.5 0 0 1 2.1 0l4 4a1.5 1.5 0 0 1 0 2.1L12 19z"/><path d="M8.5 19H20M9 9l6 6"/>'),
  undo: svg('<path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  music: svg('<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>', ' stroke-width="1.5"'),
  cloud: svg('<path d="M7 18h9.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 6.4 9.3 4.2 4.2 0 0 0 7 18z"/>'),
  scan: svg('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.4-2h5.2L16 6h1.5A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.6"/>'),
  folder: svg('<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>'),
  file: svg('<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4"/>'),
  upload: svg('<path d="M12 16V5M7.5 9.5L12 5l4.5 4.5"/><path d="M4.5 19h15"/>'),
  key: svg('<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h.01M11 12h.01M15 12h.01"/>'),
};

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

/** Free a PDF and its worker. The loading task owns them in this pdf.js. */
function dropPdf(pdf) {
  try {
    const owner = pdf && pdf.loadingTask && typeof pdf.loadingTask.destroy === 'function' ? pdf.loadingTask : pdf;
    const done = owner && typeof owner.destroy === 'function' ? owner.destroy() : null;
    if (done && done.catch) done.catch(() => {});
  } catch {
    /* already gone */
  }
}

export function createSheetView(deps) {
  const root = deps.root;
  const profile = () => String(deps.profileId ? deps.profileId() : '');
  let sheets = [];
  let query = '';
  let sheet = null;
  let addTarget = null;
  let inkPages = {};
  let audioTracks = [];
  let readerOpen = false;
  let keyMap = Keys.loadMap();
  let learning = null;
  let cloudReady = false;

  root.innerHTML = `
    <button class="back-btn" type="button" data-act="back"><span aria-hidden="true">←</span> ${t('sheet.back')}</button>
    <div class="head-row sheet-head">
      <div>
        <h2>${t('sheet.title')}</h2>
        <p class="subtle sheet-lead">${t('sheet.lead')}</p>
      </div>
      <div class="sheet-head-actions">
        <button class="sheet-cloud-btn" type="button" data-act="scan">${ICON.scan}${t('sheet.scan')}</button>
        <button class="sheet-cloud-btn" type="button" data-act="cloud">${ICON.cloud}${t('sheet.cloud')}</button>
        <button class="primary-btn sheet-import" type="button" data-act="import">${t('sheet.import')}</button>
      </div>
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
    <div class="cloud" data-el="cloud" hidden></div>
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

  async function showShelf() {
    readerEl.hidden = true;
    readerOpen = false;
    await closeReader();
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
    root.classList.toggle('sheet-is-empty', !sheets.length);
    if (!sheets.length) {
      shelfEl.innerHTML = `
        <div class="sheet-empty">
          <svg class="sheet-empty-art" viewBox="0 0 120 96" aria-hidden="true">
            <rect x="30" y="8" width="60" height="76" rx="3" class="art-page" />
            ${[22, 30, 38, 46].map((y) => `<path d="M38 ${y}h44M38 ${y + 2.5}h44M38 ${y + 5}h44" class="art-staff" />`).join('')}
            <circle cx="50" cy="31" r="2.6" class="art-note" /><path d="M52.4 31V21" class="art-stem" />
            <circle cx="66" cy="47" r="2.6" class="art-note" /><path d="M68.4 47V37" class="art-stem" />
            <path d="M22 86h76" class="art-ledge" /><path d="M60 86v8" class="art-ledge" />
          </svg>
          <h3>${t('sheet.empty.title')}</h3>
          <p class="subtle">${t('sheet.empty.lead')}</p>
          <button class="primary-btn" type="button" data-act="import">${t('sheet.import')}</button>
        </div>`;
    } else if (!shown.length) {
      shelfEl.innerHTML = `<p class="sheet-empty-line subtle">${t('sheet.noMatch')}</p>`;
    } else {
      shelfEl.innerHTML = `<div class="sheet-grid">${shown.map(cardHtml).join('')}</div>`;
      queueThumbs(shown);
    }
    Lib.storageEstimate().then(({ used }) => {
      spaceEl.textContent = used ? t('sheet.space', { used: Lib.megabytes(used) }) : '';
    });
  }

  function cardMeta(s) {
    const n = s.pageCount || 1;
    if (s.lastOpenedAt && n > 1 && (s.lastPage || 1) > 1) return t('sheet.cardAt', { n: s.lastPage, total: n });
    return n === 1 ? t('sheet.cardMeta1') : t('sheet.cardMeta', { n });
  }

  function coverHtml(s) {
    if (s.thumb) return `<img class="sheet-cover-img" src="${esc(s.thumb)}" alt="" draggable="false" />`;
    // No picture yet (or MusicXML, which has none until it is engraved): a
    // drawn page with the title, so the shelf still reads as music.
    return `
      <span class="sheet-cover-blank" aria-hidden="true">
        <span class="sheet-cover-title">${esc(s.title)}</span>
        ${'<i></i>'.repeat(5)}
      </span>`;
  }

  function cardHtml(s) {
    return `
        <article class="sheet-card" data-id="${esc(s.id)}">
          <button class="sheet-open" type="button" data-act="open" data-id="${esc(s.id)}">
            <span class="sheet-cover" data-cover="${esc(s.id)}">
              ${coverHtml(s)}
              <span class="sheet-card-kind">${kindMark(s.kind)}</span>
            </span>
            <span class="sheet-card-text">
              <span class="sheet-card-title">${esc(s.title)}</span>
              <span class="sheet-card-sub">${esc(s.composer || t('sheet.untitledComposer'))}</span>
              <span class="sheet-card-meta">${cardMeta(s)}</span>
            </span>
          </button>
          <button class="sheet-card-del" type="button" data-act="delete" data-id="${esc(s.id)}"
            aria-label="${t('sheet.delete')}" title="${t('sheet.delete')}">${ICON.trash}</button>
        </article>`;
  }

  /* Covers are drawn once, small, and kept on the record, so the shelf opens fast. */
  let thumbQueue = Promise.resolve();
  const thumbTried = new Set();

  function queueThumbs(list) {
    for (const s of list) {
      if (s.thumb || s.kind === 'musicxml' || thumbTried.has(s.id)) continue;
      thumbTried.add(s.id);
      thumbQueue = thumbQueue.then(() => makeThumb(s.id)).catch(() => {});
    }
  }

  async function makeThumb(id) {
    const rec = await Lib.getSheet(id);
    if (!rec || rec.thumb) return;
    const W = 300;
    const canvas = document.createElement('canvas');
    if (rec.kind === 'pdf') {
      const pdfjs = await loadPdfjs();
      const file = await Lib.getFile(rec.id);
      if (!file) return;
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        cMapUrl: PDF_ASSETS + 'cmaps/',
        cMapPacked: true,
        standardFontDataUrl: PDF_ASSETS + 'standard_fonts/',
        wasmUrl: PDF_ASSETS + 'wasm/',
      }).promise;
      try {
        const first = await pdf.getPage(1);
        const base = first.getViewport({ scale: 1 });
        const viewport = first.getViewport({ scale: W / base.width });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await first.render({ canvas, viewport }).promise;
      } finally {
        dropPdf(pdf);
      }
    } else {
      const blob = await Lib.getFile(rec.kind === 'images' ? Lib.pageKey(rec.id, 1) : rec.id);
      if (!blob) return;
      const bmp = await createImageBitmap(blob);
      canvas.width = W;
      canvas.height = Math.round((bmp.height / Math.max(1, bmp.width)) * W);
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close?.();
    }
    const thumb = canvas.toDataURL('image/jpeg', 0.82);
    // Read again before writing: the reader may have saved the record meanwhile.
    const latest = (await Lib.getSheet(id)) || rec;
    latest.thumb = thumb;
    await Lib.saveSheet(latest);
    if (sheet && sheet.id === id) sheet.thumb = thumb;
    const slot = shelfEl.querySelector(`[data-cover="${CSS.escape(id)}"]`);
    if (slot) {
      const img = document.createElement('img');
      img.className = 'sheet-cover-img is-new';
      img.alt = '';
      img.draggable = false;
      img.src = thumb;
      slot.querySelector('.sheet-cover-blank, .sheet-cover-img')?.replaceWith(img);
    }
  }

  function kindMark(kind) {
    if (kind === 'musicxml') return 'XML';
    if (kind === 'images' || kind === 'image') return t('sheet.kindPhoto');
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
    dropPdf(doc);
    return n;
  }

  async function appendImages(target, images) {
    if (!target || !images.length) return;
    const start = target.pageCount || 0;
    try {
      for (let i = 0; i < images.length; i += 1) await Lib.saveFile(Lib.pageKey(target.id, start + i + 1), images[i]);
      target.pageCount = start + images.length;
      await Lib.saveSheet(target);
      if (sheet && sheet.id === target.id) {
        await measure();
        await paint();
        renderSettings();
      } else {
        await renderShelf();
      }
    } catch {
      toast(t('sheet.importFailed', { n: images.length }));
    }
  }

  async function saveScan(files, title) {
    if (!files.length) return;
    try {
      if (readerOpen && sheet && sheet.kind === 'images') {
        await appendImages(sheet, files);
        toast(t('scan.taken'));
        return;
      }
      const made = Lib.emptySheet(profile(), { title, composer: '', kind: 'images', pageCount: files.length });
      for (let i = 0; i < files.length; i += 1) await Lib.saveFile(Lib.pageKey(made.id, i + 1), files[i]);
      await Lib.saveSheet(made);
      await renderShelf();
      openSheet(made.id);
    } catch {
      toast(t('scan.failed'));
    }
  }

  async function importFiles(list) {
    const picked = [...list];
    let first = null;
    let failed = 0;

    // Audio picked with a piece open belongs to that piece.
    for (const f of picked) {
      if (Lib.fileKind(f)) continue;
      if (Lib.audioKind(f) && sheet) await importAudio(f);
      else failed += 1;
    }

    // Photos picked together are one part, in the order given: pages of a
    // piece, not one piece per photo.
    const images = picked.filter((f) => Lib.fileKind(f) === 'image');
    if (images.length) {
      try {
        const { title, composer } = Lib.splitName(images[0].name);
        const made = Lib.emptySheet(profile(), {
          title,
          composer,
          kind: 'images',
          pageCount: images.length,
        });
        for (let i = 0; i < images.length; i += 1) await Lib.saveFile(Lib.pageKey(made.id, i + 1), images[i]);
        await Lib.saveSheet(made);
        first = made.id;
      } catch {
        failed += images.length;
      }
    }

    for (const file of picked) {
      const kind = Lib.fileKind(file);
      if (kind !== 'pdf' && kind !== 'musicxml') continue;
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
  }

  /* ── Dropbox ─────────────────────────────────────────────────────────── */

  const cloudEl = root.querySelector('[data-el="cloud"]');
  let cloudPath = '';
  let cloudBusy = false;
  let cloudTicket = 0;
  let cloudAutoOpen = false;

  function cloudClose() {
    cloudEl.hidden = true;
    cloudEl.innerHTML = '';
  }

  function cloudBox(titleKey, body) {
    cloudEl.innerHTML = `
      <div class="cloud-box" role="dialog" aria-modal="true" aria-labelledby="cloudTitle">
        <div class="cloud-head">
          <span class="cloud-mark" aria-hidden="true">${ICON.cloud}</span>
          <h3 id="cloudTitle">${t(titleKey)}</h3>
          <button class="reader-icon-btn" type="button" data-act="cloudClose" aria-label="${t('sheet.done')}" title="${t('sheet.done')}">${ICON.close}</button>
        </div>
        ${body}
      </div>`;
    cloudEl.hidden = false;
  }

  function cloudNote(text) {
    return `<p class="cloud-note subtle">${text}</p>`;
  }

  async function cloudOpen() {
    if (!Dropbox.saved()?.appKey) return cloudSetup();
    if (!Dropbox.isConnected()) return cloudSignIn();
    return cloudBrowse(cloudPath);
  }

  function cloudSetup() {
    const redirect = Dropbox.redirectUri();
    cloudBox(
      'sheet.cloudSetup',
      `
      <p class="cloud-lead">${t('sheet.cloudSetupLead')}</p>
      <ol class="cloud-steps">
        <li>${t('sheet.cloudStepApp')}</li>
        <li>${t('sheet.cloudStepScopes')}</li>
        <li>${t('sheet.cloudStepRedirect', { url: `<code class="cloud-url">${esc(redirect)}</code>` })}</li>
      </ol>
      <div class="cloud-row">
        <a class="reader-pill" href="${Dropbox.CONSOLE_URL}" target="_blank" rel="noopener noreferrer">${t('sheet.cloudConsole')}</a>
        <button class="reader-pill" type="button" data-act="cloudCopy">${t('sheet.cloudCopy')}</button>
      </div>
      <label class="cloud-field">
        <span>${t('sheet.cloudKey')}</span>
        <input data-el="appkey" autocomplete="off" spellcheck="false" placeholder="xxxxxxxxxxxxxxx" value="${esc(Dropbox.saved()?.appKey || '')}" />
      </label>
      <div class="cloud-row">
        <button class="primary-btn" type="button" data-act="cloudSaveKey">${t('sheet.cloudSaveKey')}</button>
      </div>
      ${cloudNote(t('sheet.cloudNote'))}`,
    );
    cloudEl.querySelector('[data-el="appkey"]')?.focus();
  }

  function cloudSignIn() {
    cloudBox(
      'sheet.cloud',
      `
      <p class="cloud-lead">${t('sheet.cloudSignInLead')}</p>
      ${cloudNote(t('sheet.cloudSignInNote'))}
      <div class="cloud-row">
        <button class="primary-btn" type="button" data-act="cloudConnect">${t('sheet.cloudConnect')}</button>
        <button class="reader-pill" type="button" data-act="cloudForgetKey">${t('sheet.cloudChangeKey')}</button>
      </div>`,
    );
  }

  async function cloudBrowse(path) {
    const ticket = ++cloudTicket;
    cloudPath = path || '';
    cloudBox(
      'sheet.cloud',
      `${cloudBusy ? `<p class="cloud-note subtle">${t('sheet.cloudLoading')}</p>` : ''}
      <div class="cloud-crumbs">
        <button class="reader-icon-btn" type="button" data-act="cloudUp" ${cloudPath ? '' : 'disabled'} aria-label="${t('sheet.cloudUp')}">${ICON.back}</button>
        <code>/Dropbox${esc(cloudPath)}</code>
        <button class="reader-icon-btn" type="button" data-act="cloudSignOut" aria-label="${t('sheet.cloudSignOut')}" title="${t('sheet.cloudSignOut')}">${ICON.close}</button>
      </div>
      <div class="cloud-list" data-el="cloudList">${cloudBusy ? '' : `<p class="cloud-note subtle">${t('sheet.cloudLoading')}</p>`}</div>
      ${cloudNote(sheet ? t('sheet.cloudAudioOpen') : t('sheet.cloudPickPiece'))}`,
    );
    cloudBusy = true;
    try {
      const entries = await Dropbox.listFolder(cloudPath);
      if (ticket !== cloudTicket) return;
      cloudBusy = false;
      const list = cloudEl.querySelector('[data-el="cloudList"]');
      if (!list) return;
      list.innerHTML = entries.length
        ? entries
            .map((entry) => {
              const folder = entry['.tag'] === 'folder';
              const audio = !folder && Dropbox.isAudioName(entry.name);
              return `
            <div class="cloud-item">
              <button class="cloud-item-go" type="button" data-act="${folder ? 'cloudDir' : audio ? 'cloudAudio' : 'cloudGet'}"
                data-path="${esc(Dropbox.joinPath(cloudPath, entry.name))}" data-name="${esc(entry.name)}">
                <span class="cloud-item-icon ${folder ? 'is-folder' : audio ? 'is-audio' : ''}">${folder ? ICON.folder : audio ? ICON.note : ICON.file}</span>
                <span class="cloud-item-name">${esc(entry.name)}</span>
                <span class="cloud-item-size">${folder ? '' : esc(sizeLabel(entry.size))}</span>
                ${folder ? '' : `<span class="cloud-item-act">${audio ? t('sheet.cloudUseTrack') : t('sheet.cloudImport')}</span>`}
              </button>
            </div>`;
            })
            .join('')
        : `<p class="cloud-note subtle">${t('sheet.cloudEmpty')}</p>`;
      if (cloudPath && !cloudEl.querySelector('[data-act="cloudUp"]:not([disabled])')) cloudSignIn();
    } catch (err) {
      cloudBusy = false;
      const list = cloudEl.querySelector('[data-el="cloudList"]');
      if (list) list.innerHTML = `<p class="cloud-note is-error">${esc(cloudError(err))}</p>`;
      return;
    }
    cloudBusy = false;
  }

  function sizeLabel(bytes) {
    const n = Number(bytes) || 0;
    if (!n) return '';
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function cloudError(err) {
    const code = err && err.code;
    if (code === 'signed-out') return t('sheet.cloudExpired');
    if (code === 'expired') return t('sheet.cloudExpired');
    if (code === 'network') return t('sheet.cloudNetwork');
    if (code === 'path') return t('sheet.cloudNotFound');
    return t('sheet.cloudFailed');
  }

  async function cloudImport(path, name, audio) {
    cloudBusy = true;
    const list = cloudEl.querySelector('[data-el="cloudList"]');
    if (list) list.innerHTML = `<p class="cloud-note subtle">${t('sheet.cloudDownloading', { name })}</p>`;
    try {
      const blob = await Dropbox.download(path);
      const file = new File([blob], name, { type: blob.type || '' });
      if (audio) {
        if (!sheet) {
          toast(t('sheet.cloudNeedPiece'));
        } else {
          await importAudio(file);
          toast(t('sheet.audioAdded'));
          cloudClose();
        }
        cloudBusy = false;
        return;
      }
      cloudBusy = false;
      cloudClose();
      await importFiles([file]);
    } catch (err) {
      cloudBusy = false;
      if (list) list.innerHTML = `<p class="cloud-note is-error">${esc(cloudError(err))}</p>`;
    }
  }

  async function copyRedirect() {
    const url = Dropbox.redirectUri();
    try {
      await navigator.clipboard.writeText(url);
      toast(t('sheet.cloudCopied'));
    } catch {
      toast(url);
    }
  }

  async function cloudConnect() {
    const appKey = String(Dropbox.saved()?.appKey || '').trim();
    if (!appKey) return cloudSetup();
    const verifier = Dropbox.randomVerifier();
    const state = Dropbox.randomVerifier(24);
    const challenge = await Dropbox.challengeFor(verifier);
    try {
      sessionStorage.setItem('scaleStudio.dropboxPkce', JSON.stringify({ verifier, state, at: Date.now() }));
    } catch {
      /* private mode — the state check just falls back */
    }
    location.assign(Dropbox.authUrl({ appKey, redirect: Dropbox.redirectUri(), challenge, state }));
  }

  /** Back from Dropbox: check the state, exchange the code, clean the address. */
  async function cloudCallback() {
    const cb = Dropbox.parseCallback(location.search);
    if (!cb.code && !cb.error) return false;
    let pending = null;
    try {
      pending = JSON.parse(sessionStorage.getItem('scaleStudio.dropboxPkce') || 'null');
      sessionStorage.removeItem('scaleStudio.dropboxPkce');
    } catch {
      pending = null;
    }
    const clean = () => {
      const url = new URL(location.href);
      url.search = '';
      history.replaceState(null, '', url);
    };
    if (cb.error) {
      clean();
      toast(cb.description || t('sheet.cloudDenied'));
      return true;
    }
    if (!pending || (cb.state && pending.state !== cb.state) || !Dropbox.saved()?.appKey) {
      clean();
      toast(t('sheet.cloudState'));
      return true;
    }
    try {
      await Dropbox.exchange({
        code: cb.code,
        verifier: pending.verifier,
        appKey: Dropbox.saved().appKey,
        redirect: Dropbox.redirectUri(),
      });
      clean();
      toast(t('sheet.cloudConnected'));
      cloudAutoOpen = true;
    } catch {
      clean();
      toast(t('sheet.cloudToken'));
    }
    return true;
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
  let saveTimer = 0;
  let inkTimer = 0;
  let stageW = 0;
  let stageH = 0;
  let awake = null;
  let osmd = null;
  const refs = {};

  readerEl.innerHTML = `
    <div class="reader-bar">
      <button class="reader-btn" type="button" data-act="back" aria-label="${t('sheet.close')}" title="${t('sheet.close')}">${ICON.back}</button>
      <div class="reader-title-wrap">
        <h3 class="reader-title" data-el="title"></h3>
        <span class="reader-meta" data-el="meta"></span>
      </div>
      <div class="reader-bar-tools">
        <button class="reader-btn" type="button" data-act="bookmark" data-chrome="bookmarks" aria-label="${t('sheet.bookmark')}" title="${t('sheet.bookmark')}">${ICON.bookmark}</button>
        <button class="reader-btn" type="button" data-act="ink" data-chrome="ink" aria-label="${t('sheet.tools')}" title="${t('sheet.tools')}">${ICON.pen}</button>
        <button class="reader-btn" type="button" data-act="settings" data-chrome="settings" aria-label="${t('sheet.settings')}" title="${t('sheet.settings')}">${ICON.sliders}</button>
        <button class="reader-btn reader-btn-audio" type="button" data-act="audio" data-chrome="audio" aria-label="${t('sheet.audio')}" title="${t('sheet.audio')}">${ICON.note}<i class="reader-live" aria-hidden="true"></i></button>
      </div>
    </div>
    <div class="reader-stage" data-el="stage" tabindex="0">
      <div class="reader-pages" data-el="pages"></div>
      <div class="reader-spinner" aria-hidden="true"></div>
      <p class="reader-hint" data-el="hint" hidden></p>
    </div>
    <div class="reader-foot">
      <button class="reader-btn" type="button" data-act="prev" aria-label="${t('sheet.prev')}" title="${t('sheet.prev')}">${ICON.prev}</button>
      <input class="reader-slider reader-range" data-el="slider" type="range" min="1" max="1" value="1" aria-label="${t('sheet.page')}" />
      <span class="reader-pageno" data-el="pageno"></span>
      <button class="reader-btn" type="button" data-act="next" aria-label="${t('sheet.next')}" title="${t('sheet.next')}">${ICON.next}</button>
      <span class="reader-key" data-el="lastkey" hidden></span>
      <span class="reader-foot-gap" aria-hidden="true"></span>
      <div class="reader-zoom" role="group">
        <button class="reader-btn" type="button" data-act="zoomOut" aria-label="${t('sheet.zoomOut')}" title="${t('sheet.zoomOut')}">${ICON.minus}</button>
        <button class="reader-btn" type="button" data-act="zoomIn" aria-label="${t('sheet.zoomIn')}" title="${t('sheet.zoomIn')}">${ICON.plus}</button>
      </div>
    </div>
    <div class="reader-sheet reader-inkbar" data-el="inkbar" hidden>
      <div class="reader-tools">
        <button class="reader-tool is-on" type="button" data-tool="pen">${ICON.pen}<span>${t('sheet.pen')}</span></button>
        <button class="reader-tool" type="button" data-tool="highlight">${ICON.highlight}<span>${t('sheet.highlight')}</span></button>
        <button class="reader-tool" type="button" data-tool="erase">${ICON.eraser}<span>${t('sheet.eraser')}</span></button>
        <span class="reader-tools-rule" aria-hidden="true"></span>
        <button class="reader-tool" type="button" data-act="undo">${ICON.undo}<span>${t('sheet.undo')}</span></button>
        <button class="reader-tool" type="button" data-act="clearInk">${ICON.trash}<span>${t('sheet.clearInk')}</span></button>
        <button class="reader-done" type="button" data-act="inkOff">${t('sheet.done')}</button>
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
    lastkey: readerEl.querySelector('[data-el="lastkey"]'),
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
    addTarget = null;
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
      dropPdf(doc);
      doc = null;
    }
    osmd = null;
    sheet = null;
    inkPages = {};
    audioTracks = [];
    tool = null;
    paintedPage = 0;
    dropUrls([...refs.pages.children]);
    refs.pages.innerHTML = '';
    refs.panel.hidden = true;
    refs.panel.dataset.panel = '';
    refs.inkbar.hidden = true;
    readerEl.classList.remove('is-immersive');
    syncChrome();
  }

  async function measure() {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    stageW = refs.stage.clientWidth;
    stageH = refs.stage.clientHeight;
  }

  function scaleFor(view) {
    const fit = Lib.fitScale(view.width, view.height, stageW, stageH, fitMode);
    return Math.max(0.05, fit * zoom);
  }

  // Which way the last turn went, so the new page slides in from that side.
  let turnDir = 0;

  const boxUrls = (box) => box._urls || [];
  const dropUrls = (boxes) => boxes.forEach((box) => boxUrls(box).forEach((url) => URL.revokeObjectURL(url)));

  /**
   * Draw the pages showing. The old page stays on screen until the new one is
   * drawn and then they swap, so a turn never flashes a blank stand. MusicXML is
   * the exception: OSMD measures itself, so it has to be drawn in place.
   */
  async function paint() {
    if (!sheet) return;
    const ticket = ++renderTicket;
    const keepScroll = paintedPage === page ? refs.stage.scrollTop : 0;
    const dir = turnDir;
    turnDir = 0;
    try {
      renderTask?.cancel();
    } catch {
      /* already finished */
    }
    renderTask = null;
    const pages = pagesShowing();
    refs.pageno.textContent = Lib.pageLabel(page, sheet.pageCount || 1);
    refs.slider.value = String(page);
    refs.slider.style.setProperty('--fill', `${sheet.pageCount > 1 ? ((page - 1) / (sheet.pageCount - 1)) * 100 : 0}%`);
    refs.pages.dataset.layout = layout;
    refs.stage.classList.toggle('is-zoomed', zoom > 1.02);
    if (tool) setHint(t('sheet.inkHint'));

    const old = [...refs.pages.children];
    const boxes = pages.map((n) => pageBox(n));
    const inPlace = sheet.kind === 'musicxml' || !old.length;
    if (inPlace) {
      dropUrls(old);
      refs.pages.replaceChildren(...boxes);
    }
    const slow = setTimeout(() => refs.stage.classList.add('is-loading'), inPlace ? 0 : 220);

    for (const box of boxes) {
      try {
        await paintPage(Number(box.dataset.page), box, ticket);
      } catch (err) {
        if (err && err.name === 'RenderingCancelledException') break;
        if (ticket === renderTicket) {
          const media = box.querySelector('.page-media');
          if (media) media.innerHTML = `<p class="page-fail">${t('sheet.pageFailed')}</p>`;
        }
      }
      if (ticket !== renderTicket) break;
    }
    clearTimeout(slow);
    if (ticket !== renderTicket) {
      if (!inPlace) dropUrls(boxes);
      return;
    }
    refs.stage.classList.remove('is-loading');
    if (!inPlace) {
      dropUrls(old);
      refs.pages.replaceChildren(...boxes);
    }
    if (dir) boxes.forEach((box) => box.classList.add(dir > 0 ? 'turn-next' : 'turn-prev'));
    if (tool) boxes.forEach((box) => box.querySelector('.page-ink')?.classList.add('is-active'));
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
    } else if (sheet.kind === 'image' || sheet.kind === 'images') {
      const key = sheet.kind === 'images' ? Lib.pageKey(sheet.id, n) : sheet.id;
      const file = await Lib.getFile(key);
      const url = URL.createObjectURL(file);
      (box._urls ||= []).push(url);
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
    // The tone goes on the page, not the box, so night mode does not invert the
    // box's shadow into a grey glow; the box behind takes the toned paper colour.
    frame.style.filter = Lib.toneFilter(sheet.settings?.tone, sheet.settings?.brightness);
    box.dataset.tone = sheet.settings?.tone || 'paper';

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
        await osmd.load(await readScoreFile(await Lib.getFile(sheet.id)));
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

  /** The bar buttons show which sheet is up, and the note glows while a track plays. */
  function syncChrome() {
    const open = refs.panel.hidden ? '' : refs.panel.dataset.panel;
    readerEl.querySelectorAll('[data-chrome]').forEach((btn) => {
      const name = btn.dataset.chrome;
      const on = name === 'ink' ? !refs.inkbar.hidden : open === name;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', String(on));
    });
  }

  function setTool(next) {
    tool = next;
    refs.inkbar.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('is-on', b.dataset.tool === tool));
    refs.stage.classList.toggle('is-inking', Boolean(tool));
    refs.pages.querySelectorAll('.page-ink').forEach((c) => c.classList.toggle('is-active', Boolean(tool)));
    setHint(tool ? t('sheet.inkHint') : '');
    syncChrome();
  }

  /* ── Turning and zoom ────────────────────────────────────────────────── */

  function goTo(next) {
    const target = Lib.turnPage(next, sheet?.pageCount || 1, 0);
    if (target === page) return;
    turnDir = target > page ? 1 : -1;
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
      turnDir = delta;
      page = next;
      paint();
    } else {
      // At either cover: a small nudge says there is no further to go.
      const box = refs.pages.firstElementChild;
      if (box) {
        box.classList.remove('bump-next', 'bump-prev');
        void box.offsetWidth;
        box.classList.add(delta > 0 ? 'bump-next' : 'bump-prev');
      }
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
    syncChrome();
  }

  function togglePanel(name) {
    if (panelIs(name)) return closePanel();
    refs.panel.hidden = false;
    refs.panel.dataset.panel = name;
    // One sheet at a time: the pen bar and a panel would stack over the page.
    if (!refs.inkbar.hidden) {
      refs.inkbar.hidden = true;
      setTool(null);
    }
    syncChrome();
    if (name === 'settings') renderSettings();
    else if (name === 'bookmarks') renderBookmarks();
    else if (name === 'audio') renderAudio();
  }

  /** The top of a sliding panel: its name and a close button. */
  function head(key) {
    return `
      <div class="sheet-panel-head">
        <h4>${t(key)}</h4>
        <button class="reader-icon-btn" type="button" data-act="closePanel" aria-label="${t('sheet.done')}" title="${t('sheet.done')}">${ICON.close}</button>
      </div>`;
  }

  function renderSettings() {
    const s = sheet.settings;
    const crop = s.crop || {};
    const cropped = ['l', 'r', 't', 'b'].some((e) => Number(crop[e]) > 0);
    const seg = (attr, value, on, label) =>
      `<button type="button" data-${attr}="${value}" aria-pressed="${on}" class="${on ? 'is-on' : ''}">${label}</button>`;
    const sw = (key, on, label) => `
        <button class="reader-switch" type="button" data-toggle="${key}" role="switch" aria-checked="${on}">
          <span>${label}</span><i aria-hidden="true"></i>
        </button>`;
    refs.panel.innerHTML = `
${head('sheet.settings')}
      <div class="sheet-panel-grid">
        <span class="reader-label">${t('sheet.tone')}</span>
        <div class="reader-seg reader-tones">
          ${Lib.TONES.map((tone) => seg('tone', tone, s.tone === tone, `<i class="tone-chip tone-${tone}" aria-hidden="true"></i>${t('sheet.tone.' + tone)}`)).join('')}
        </div>
        <label class="reader-label" for="sheet-bright">${t('sheet.brightness')}</label>
        <input id="sheet-bright" class="reader-range" type="range" data-set="brightness" min="0.55" max="1.5" step="0.05" value="${s.brightness}" />
        <span class="reader-label">${t('sheet.fit')}</span>
        <div class="reader-seg">
          ${seg('fit', 'page', s.fit === 'page', t('sheet.fit.page'))}
          ${seg('fit', 'width', s.fit === 'width', t('sheet.fit.width'))}
        </div>
      </div>
      <div class="reader-switches">
        ${sw('halfPage', Boolean(s.halfPage), t('sheet.halfPage'))}
        ${sw('spread', Boolean(s.spread), t('sheet.spread'))}
        ${sw('keepAwake', s.keepAwake !== false, t('sheet.keepAwake'))}
      </div>
      ${sheet.kind === 'images' ? `<div class="reader-row"><button class="reader-pill" type="button" data-act="addPages">${ICON.plus}${t('sheet.addPages')}</button><button class="reader-pill" type="button" data-act="scan">${ICON.scan}${t('sheet.scanPages')}</button></div>` : ''}
      <details class="reader-crop" ${cropped ? 'open' : ''}>
        <summary>${t('sheet.crop')}${cropped ? ' ·' : ''}</summary>
        <div class="sheet-panel-grid">
          ${['l', 'r', 't', 'b']
            .map(
              (edge) => `
            <label class="reader-label" for="sheet-crop-${edge}">${t('sheet.crop.' + edge)}</label>
            <input id="sheet-crop-${edge}" class="reader-range" type="range" data-crop="${edge}" min="0" max="0.25" step="0.01" value="${crop[edge] || 0}" />`,
            )
            .join('')}
        </div>
        <button class="reader-pill" type="button" data-act="cropReset">${t('sheet.crop.reset')}</button>
      </details>
      <details class="reader-keys" ${learning ? 'open' : ''}>
        <summary>${ICON.key}${t('sheet.turner')}</summary>
        <p class="subtle reader-note">${t('sheet.turnerNote')}</p>
        ${Keys.ACTIONS.map(
          (action) => `
          <div class="reader-keyrow" data-keyrow="${action}">
            <span>${t('sheet.turn.' + action)}</span>
            <span class="reader-keychips">${(keyMap[action] || []).map((k) => `<kbd>${esc(Keys.keyLabel(k))}</kbd>`).join('')}</span>
            <button class="reader-pill ${learning === action ? 'is-on' : ''}" type="button" data-act="learn" data-action="${action}">
              ${learning === action ? t('sheet.pressKey') : t('sheet.change')}
            </button>
          </div>`,
        ).join('')}
        <div class="reader-row">
          <button class="reader-pill" type="button" data-act="keysReset">${t('sheet.turnerReset')}</button>
          <span class="reader-key-live" data-el="learned">${t('sheet.turnerLast')} <b>—</b></span>
        </div>
      </details>
`;
    paintRanges();
  }

  async function addBookmark() {
    if (!sheet) return;
    const name = window.prompt(t('sheet.bookmarkName'), t('sheet.pageN', { n: page }));
    if (name === null) return;
    sheet.bookmarks = [...(sheet.bookmarks || []), { id: `p${page}-${Lib.uid()}`, page, name: name.trim() || t('sheet.pageN', { n: page }) }];
    await Lib.saveSheet(sheet).catch(() => {});
    renderBookmarks();
  }

  function renderBookmarks() {
    const marks = [...(sheet.bookmarks || [])].sort((x, y) => x.page - y.page);
    refs.panel.innerHTML = `
${head('sheet.bookmarks')}
      <button class="reader-pill reader-wide" type="button" data-act="bookmarkPage">${ICON.bookmark}${t('sheet.addBookmark')}</button>
      ${marks.length
        ? `<ul class="reader-list">${marks
            .map(
              (m) => `
          <li class="${m.page === page ? 'is-current' : ''}">
            <button class="reader-list-go" type="button" data-mark="${m.page}" data-mark-id="${esc(m.id)}">
              <span class="reader-list-page">${m.page}</span><strong>${esc(m.name || '')}</strong>
            </button>
            <button class="reader-icon-btn" type="button" data-unmark="${esc(m.id)}" aria-label="${t('sheet.remove')}" title="${t('sheet.remove')}">${ICON.trash}</button>
          </li>`,
            )
            .join('')}</ul>`
        : `<p class="reader-empty">${ICON.bookmark}<span>${t('sheet.noBookmarks')}</span></p>`}`;
  }

  /** Range inputs fill up to the thumb in the accent colour (WebKit has no ::-moz-range-progress). */
  function paintRanges() {
    refs.panel.querySelectorAll('.reader-range').forEach(fillRange);
  }
  function fillRange(el) {
    const lo = Number(el.min) || 0;
    const hi = Number(el.max) || 1;
    const v = Number(el.value) || 0;
    el.style.setProperty('--fill', `${hi > lo ? ((v - lo) / (hi - lo)) * 100 : 0}%`);
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
    const before = buffer?.duration || stash.duration;
    const rendered = await Promise.resolve().then(() => renderStretched(ac, stash, rate, semitones));
    if (job !== stretchJob || !sheet) return;
    // Positions are seconds of the stretched track: at half speed the same bar
    // is twice as far in, so the spot and the A–B loop move with the speed.
    const k = rendered.duration / Math.max(0.001, before);
    buffer = rendered;
    startOffset = Lib.clamp(at * k, 0, rendered.duration);
    loopA *= k;
    loopB *= k;
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
      if (source !== node) return;
      playing = false;
      source = null;
      startOffset = 0;
      drawTrackClock();
      renderAudio();
    };
    node.start(0, Lib.clamp(startOffset, 0, buffer.duration));
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
    } catch (err) {
      console.error(err);
    }
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
    const clockEl = refs.panel.querySelector('[data-el="track-time"]');
    const slider = refs.panel.querySelector('[data-el="track-seek"]');
    const playBtn = refs.panel.querySelector('[data-act="trackPlay"]');
    if (clockEl) clockEl.textContent = statusTime();
    if (slider) {
      slider.max = String(buffer?.duration || 1);
      slider.value = String(position());
    }
    if (playBtn && playBtn.dataset.playing !== String(playing)) {
      playBtn.dataset.playing = String(playing);
      playBtn.innerHTML = playing ? ICON.pause : ICON.play;
      playBtn.setAttribute('aria-label', playing ? t('sheet.audioPause') : t('sheet.audioPlay'));
    }
    if (slider) fillRange(slider);
    readerEl.querySelector('.reader-btn-audio')?.classList.toggle('is-playing', playing || metro.on);
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
    const hasLoop = loopB - loopA >= 0.2;
    const marks = hasLoop ? `A ${Lib.clock(loopA)} – B ${Lib.clock(loopB)}` : t('sheet.noLoop');
    const tracks = audioTracks.length
      ? `<ul class="reader-list reader-tracks">${audioTracks
          .map(
            (row) => `
          <li class="${row.id === currentTrack?.id ? 'is-current' : ''}">
            <button class="reader-list-go" type="button" data-track="${esc(row.id)}">
              <span class="reader-list-page">${ICON.note}</span><strong>${esc(row.name)}</strong>
            </button>
            <button class="reader-icon-btn" type="button" data-track-del="${esc(row.id)}" aria-label="${t('sheet.remove')}" title="${t('sheet.remove')}">${ICON.trash}</button>
          </li>`,
          )
          .join('')}</ul>`
      : `<p class="reader-empty">${ICON.music}<span>${t('sheet.noAudio')}</span></p>`;
    const player = currentTrack
      ? `
      <div class="reader-player">
        <div class="reader-transport">
          <button class="reader-play" type="button" data-act="trackPlay" aria-label="${playing ? t('sheet.audioPause') : t('sheet.audioPlay')}">${playing ? ICON.pause : ICON.play}</button>
          <div class="reader-scrub">
            <input class="reader-seek reader-range" data-el="track-seek" type="range" min="0" max="${buffer?.duration || 1}" step="0.05" value="${position()}" aria-label="${t('sheet.audio')}" />
            <div class="reader-scrub-row">
              <span class="reader-time" data-el="track-time">${statusTime()}</span>
              <button class="reader-icon-btn" type="button" data-act="trackStop" aria-label="${t('sheet.audioRestart')}" title="${t('sheet.audioRestart')}">${ICON.restart}</button>
            </div>
          </div>
        </div>
        <div class="sheet-panel-grid">
          <label class="reader-label" for="sheet-rate">${t('sheet.speed')}</label>
          <div class="reader-valued"><input id="sheet-rate" class="reader-range" type="range" data-set="rate" min="0.5" max="1.5" step="0.05" value="${rate}" /><b data-el="rate-label">${rate.toFixed(2)}×</b></div>
          <label class="reader-label" for="sheet-pitch">${t('sheet.pitch')}</label>
          <div class="reader-valued"><input id="sheet-pitch" class="reader-range" type="range" data-set="pitch" min="-12" max="12" step="1" value="${semitones}" /><b data-el="pitch-label">${semitones > 0 ? '+' : ''}${semitones}</b></div>
          <label class="reader-label" for="sheet-vol">${t('sheet.volume')}</label>
          <div class="reader-valued"><input id="sheet-vol" class="reader-range" type="range" data-set="volume" min="0" max="1" step="0.02" value="${volume}" /><b>${Math.round(volume * 100)}</b></div>
        </div>
        <div class="reader-loop">
          <div class="reader-seg">
            <button type="button" data-act="loopA">${t('sheet.setA')}</button>
            <button type="button" data-act="loopB">${t('sheet.setB')}</button>
            <button type="button" data-act="loopToggle" aria-pressed="${loopOn}" class="${loopOn ? 'is-on' : ''}" ${hasLoop ? '' : 'disabled'}>${t('sheet.loop')}</button>
          </div>
          <span class="reader-time" data-el="loop">${marks}</span>
        </div>
        <p class="subtle reader-note">${t('sheet.audioNote')}</p>
      </div>`
      : '';
    refs.panel.innerHTML = `
${head('sheet.audio')}
      ${tracks}
      <div class="reader-track-actions">
        <button class="reader-pill" type="button" data-act="pickAudio">${ICON.plus}${t('sheet.addAudio')}</button>
        ${audioTracks.length ? `<label class="reader-check"><input type="checkbox" data-el="autoplay" ${sheet.autoplay ? 'checked' : ''} /> ${t('sheet.autoplay')}</label>` : ''}
      </div>
      ${player}
      <div class="reader-metro">
        <button class="reader-metro-btn ${metro.on ? 'is-on' : ''}" type="button" data-act="metro" aria-pressed="${metro.on}">
          <i class="reader-metro-dot" aria-hidden="true"></i>${t('sheet.metronome')}
        </button>
        <button class="reader-icon-btn" type="button" data-act="bpmDown" aria-label="−">${ICON.minus}</button>
        <b class="reader-bpm" data-el="bpm-label">${metro.bpm}</b>
        <button class="reader-icon-btn" type="button" data-act="bpmUp" aria-label="+">${ICON.plus}</button>
        <input class="reader-range" type="range" data-set="bpm" min="40" max="208" step="2" value="${metro.bpm}" aria-label="${t('sheet.metronome')}" />
      </div>`;
    paintRanges();
    drawTrackClock();
  }

  /* ── Metronome ───────────────────────────────────────────────────────── */

  const metro = { on: false, bpm: 88, beats: 4, timer: 0, next: 0, count: 0, gain: null };

  function metroClick(accent, when) {
    if (!ac || !metro.gain) return;
    const at = Math.max(ac.currentTime, when);
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
      metroClick(accent, metro.next);
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
    else drawTrackClock();
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
      zoom = 1;
      sheet.settings.fit = fitMode;
      sheet.settings.zoom = 1;
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
      Lib.deleteAudioBlob(sheet.id, btn.dataset.trackDel).catch(() => {});
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
      case 'cloud':
        return cloudOpen();
      case 'cloudClose':
        return cloudClose();
      case 'cloudCopy':
        return copyRedirect();
      case 'cloudSaveKey': {
        const key = cloudEl.querySelector('[data-el="appkey"]')?.value.trim();
        if (!key) return;
        Dropbox.saveAppKey(key);
        toast(t('sheet.cloudKeySaved'));
        return cloudSignIn();
      }
      case 'cloudConnect':
        return cloudConnect();
      case 'cloudForgetKey':
        Dropbox.forget();
        return cloudSetup();
      case 'cloudSignOut':
        Dropbox.forget();
        return cloudSignIn();
      case 'cloudUp':
        return cloudBrowse(Dropbox.parentPath(cloudPath));
      case 'cloudDir':
        return cloudBrowse(btn.dataset.path);
      case 'cloudGet':
        return cloudImport(btn.dataset.path, btn.dataset.name, false);
      case 'cloudAudio':
        return cloudImport(btn.dataset.path, btn.dataset.name, true);
      case 'learn':
        learning = btn.dataset.action;
        return renderSettings();
      case 'scan':
        return scanner.open();
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
        if (refs.inkbar.hidden) closePanel();
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
      case 'keysReset':
        keyMap = Keys.resetMap();
        return renderSettings();
      case 'bookmarkPage':
        return addBookmark();
      case 'cropReset':
        sheet.settings.crop = { l: 0, r: 0, t: 0, b: 0 };
        await Lib.saveSheet(sheet).catch(() => {});
        renderSettings();
        return paint();
      case 'addPages':
        addTarget = sheet;
        fileEl.click();
        return;
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
      case 'bpmDown':
      case 'bpmUp': {
        metro.bpm = Lib.clamp(metro.bpm + (act === 'bpmUp' ? 2 : -2), 40, 208);
        const label = refs.panel.querySelector('[data-el="bpm-label"]');
        if (label) label.textContent = String(metro.bpm);
        const range = refs.panel.querySelector('[data-set="bpm"]');
        if (range) {
          range.value = String(metro.bpm);
          fillRange(range);
        }
        return;
      }
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
    if (el.classList?.contains('reader-range')) fillRange(el);
    if (el.dataset.set === 'volume') {
      const b = el.parentElement?.querySelector('b');
      if (b) b.textContent = String(Math.round(Number(el.value) * 100));
    }
    if (el.dataset.set && sheet) {
      const kind = el.dataset.set;
      if (kind === 'brightness') {
        sheet.settings.brightness = Number(el.value);
        scheduleSave(500);
        refs.pages.querySelectorAll('.page-frame').forEach((frame) => {
          frame.style.filter = Lib.toneFilter(sheet.settings.tone, sheet.settings.brightness);
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
    if (addTarget && fileEl.files?.length) {
      const images = [...fileEl.files].filter((f) => Lib.fileKind(f) === 'image');
      const target = addTarget;
      addTarget = null;
      appendImages(target, images);
    } else if (fileEl.files?.length) importFiles(fileEl.files);
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

  // A pinch shows its size with a CSS scale while the fingers move and draws
  // the page once when they lift: re-rendering a PDF on every move flickers.
  let pinchZoom = 0;
  let pinched = false; // a pinch is never also a tap or a swipe

  function endPinch() {
    if (!pinchFrom) return;
    pinchFrom = null;
    refs.pages.style.transform = '';
    refs.pages.style.transformOrigin = '';
    if (pinchZoom) setZoom(pinchZoom);
    pinchZoom = 0;
  }

  refs.stage.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) pinched = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const rect = refs.pages.getBoundingClientRect();
      pinchFrom = {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        zoom,
        ox: (a.x + b.x) / 2 - rect.left,
        oy: (a.y + b.y) / 2 - rect.top,
      };
      pinched = true;
      stageStart = null;
      return;
    }
    if (event.target.closest('.page-ink.is-active')) return;
    stageStart = { x: event.clientX, y: event.clientY, scroll: refs.stage.scrollTop, left: refs.stage.scrollLeft };
    if (zoom > 1.02) refs.stage.setPointerCapture?.(event.pointerId);
  });

  refs.stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchFrom && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      pinchZoom = Lib.clampZoom(pinchFrom.zoom * (d / Math.max(1, pinchFrom.d)));
      refs.pages.style.transformOrigin = `${pinchFrom.ox}px ${pinchFrom.oy}px`;
      refs.pages.style.transform = `scale(${pinchZoom / pinchFrom.zoom})`;
      return;
    }
    if (!stageStart || zoom <= 1.02) return;
    // Zoomed in: the finger drags the page both ways.
    refs.stage.scrollTop = stageStart.scroll - (event.clientY - stageStart.y);
    refs.stage.scrollLeft = stageStart.left - (event.clientX - stageStart.x);
  });

  refs.stage.addEventListener('pointerup', (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) endPinch();
    if (pinched || !stageStart) return;
    const dx = event.clientX - stageStart.x;
    const dy = event.clientY - stageStart.y;
    const quiet = Math.abs(dx) < 9 && Math.abs(dy) < 9;
    stageStart = null;
    // A swipe turns the page; zoomed in, the same drag was moving the page.
    if (zoom <= 1.02 && Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.4) return step(dx < 0 ? 1 : -1);
    if (!quiet) return;
    if (tool) return;
    const box = refs.stage.getBoundingClientRect();
    const share = (event.clientX - box.left) / Math.max(1, box.width);
    if (share < 0.28) step(-1);
    else if (share > 0.72) step(1);
    else if (!refs.panel.hidden) closePanel();
    else if (!refs.inkbar.hidden) {
      refs.inkbar.hidden = true;
      setTool(null);
    } else {
      readerEl.classList.toggle('is-immersive');
      measure().then(paint);
    }
  });
  refs.stage.addEventListener('pointercancel', (event) => {
    pointers.delete(event.pointerId);
    stageStart = null;
    if (pointers.size < 2) endPinch();
  });

  refs.stage.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setZoom(zoom * (event.deltaY < 0 ? 1.08 : 0.93));
    },
    { passive: false },
  );

  let keyTimer = 0;
  function flashKey(label) {
    if (!refs.lastkey) return;
    refs.panel.querySelector('[data-el="learned"] b')?.replaceChildren(document.createTextNode(label));
    refs.lastkey.textContent = label;
    refs.lastkey.hidden = false;
    clearTimeout(keyTimer);
    keyTimer = setTimeout(() => {
      refs.lastkey.hidden = true;
    }, 1600);
  }

  const KEY_ACTION = {
    prev: () => step(-1),
    next: () => step(1),
    first: () => goTo(1),
    last: () => goTo(sheet?.pageCount || 1),
    bookmark: () => addBookmark(),
    audio: () => {
      ensureAudio();
      togglePanel('audio');
    },
  };

  /**
   * Pedals, keyboards and remotes all arrive here. The listener is on the
   * document, not the page, so a pedal press works wherever the focus sits —
   * and it is captured, so a button's own Space handling does not eat it.
   */
  function onKey(event) {
    if (!readerOpen) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = Keys.normalKey(event);
    if (learning) {
      event.preventDefault();
      if (key !== 'Escape') {
        keyMap = Keys.assign(keyMap, learning, key);
        Keys.saveMap(keyMap);
      }
      learning = null;
      renderSettings();
      flashKey(Keys.keyLabel(key));
      return;
    }
    if (key === 'Escape') {
      if (!refs.panel.hidden) closePanel();
      else if (tool) {
        refs.inkbar.hidden = true;
        setTool(null);
      } else showShelf();
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      return setZoom(zoom * 1.2);
    }
    if (event.key === '-') {
      event.preventDefault();
      return setZoom(zoom / 1.2);
    }
    const action = Keys.actionFor(key, keyMap);
    if (!action) return;
    event.preventDefault();
    flashKey(Keys.keyLabel(key));
    (KEY_ACTION[action] || (() => {}))();
  }
  document.addEventListener('keydown', onKey, true);


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

  const scanHost = document.createElement('div');
  document.body.appendChild(scanHost);
  const scanner = createScanner({
    root: scanHost,
    onSave: saveScan,
    onClose: () => {
      if (readerOpen) refs.stage.focus({ preventScroll: true });
      else renderShelf();
    },
  });

  cloudEl.addEventListener('click', (event) => {
    if (event.target === cloudEl) cloudClose();
  });

  /* ── What the app calls ──────────────────────────────────────────────── */

  return {
    open() {
      if (!cloudReady) {
        cloudReady = true;
        cloudCallback().then((handled) => {
          if (handled && cloudAutoOpen) cloudOpen();
        });
      } else if (cloudAutoOpen) {
        cloudAutoOpen = false;
        cloudOpen();
      }
      showShelf();
      deps.onViewChange?.();
    },
    stop() {
      scanner.close();
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
