// listenview.js — Listen (beta): play anything, and hear back what the app noticed.
//
// Two ways in. "Just listen" takes free playing — a piece, an étude, anything —
// and reports tendencies, never verdicts: without the music the app cannot know
// which note was meant. "Use my score" takes a MusicXML file (.musicxml, .xml or
// .mxl — what MuseScore, Finale, Sibelius and Dorico export, and what most scan
// apps produce), draws it, and after the take marks every written note and lets
// the student tap a bar to hear themselves from there.
//
// The rules live in listen.js and musicxml.js; this file draws and listens. The
// score is drawn by OpenSheetMusicDisplay (BSD-3, vendor/), loaded only when a
// score is opened, so the rest of the app never pays for it.

import { readScore, readScoreFile, listParts, parseXml } from './musicxml.js?v=202611121925';
import { analyzeFree, analyzeScore, barStartTime, nameOf } from './listen.js?v=202611121925';
import { recordStream, play as playRecording, canRecord } from './recorder.js?v=202611121925';
import { t } from './i18n.js?v=202611121925';

const OSMD_SRC = './vendor/opensheetmusicdisplay.min.js?v=202611121925';
const MAX_SECONDS = 600; // ten minutes: enough for any audition piece
const MIN_SECONDS = 5;

// How a written note is marked after the take.
const MARK = {
  good: '#2f7d5b', // right note, in tune
  tune: '#c07a1c', // right note, more than 20 cents off
  wrong: '#c0392b', // a different note
  missed: '#9a9086', // nothing heard for it
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clock = (s) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};
const pctOf = (x) => Math.round(x * 100);
const signed = (c) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(Math.round(c))}`;

let osmdLoading = null;
function loadOsmd() {
  if (window.opensheetmusicdisplay) return Promise.resolve(window.opensheetmusicdisplay);
  if (osmdLoading) return osmdLoading;
  osmdLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = OSMD_SRC;
    s.onload = () => (window.opensheetmusicdisplay ? resolve(window.opensheetmusicdisplay) : reject(new Error('osmd')));
    s.onerror = () => {
      osmdLoading = null;
      reject(new Error('osmd'));
    };
    document.head.appendChild(s);
  });
  return osmdLoading;
}

/**
 * deps:
 *   root            the view's <section>
 *   openMic()       resolves to the mic (its frames arrive through `frame`)
 *   closeMic()
 *   getMic()        the open mic: { stream, floor }
 *   micError(err)   words for a microphone failure
 *   onFinish(info)  a finished take worth logging: { seconds, heard }
 *   onBack()
 */
export function createListenView(deps) {
  const root = deps.root;
  let panel = 'start'; // 'start' | 'rec' | 'done'
  let source = null; // { xml, score, parts, fileName } when a score is open
  let listening = false;
  let take = null; // { frames, rec, started, timer }
  let result = null; // { analysis, blob, seconds }
  let player = null; // the playback in progress
  let pickedBar = null; // written measure index tapped on the score
  let osmd = null;
  let ticket = 0;

  root.innerHTML = `
    <button class="back-btn" type="button" data-act="back"><span aria-hidden="true">←</span> ${t('listen.back')}</button>
    <div class="head-row">
      <div>
        <h2>${t('listen.title')} <span class="beta-tag">${t('listen.beta')}</span></h2>
        <p class="subtle listen-lead">${t('listen.lead')}</p>
      </div>
    </div>
    <div class="listen-body"></div>
    <div class="listen-score-wrap score-card" hidden>
      <div class="listen-score-head">
        <span class="listen-score-title"></span>
        <label class="listen-part" hidden>${t('listen.part')} <select class="listen-part-select"></select></label>
      </div>
      <div class="listen-score" aria-label="${esc(t('listen.scoreAria'))}"></div>
      <div class="listen-bars" aria-hidden="true"></div>
    </div>
    <div class="listen-results"></div>
    <input class="listen-file" type="file" accept=".musicxml,.xml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml" hidden />`;
  const body = root.querySelector('.listen-body');
  const resultsEl = root.querySelector('.listen-results');
  const scoreWrap = root.querySelector('.listen-score-wrap');
  const scoreEl = root.querySelector('.listen-score');
  const barsEl = root.querySelector('.listen-bars');
  const fileInput = root.querySelector('.listen-file');
  const partSelect = root.querySelector('.listen-part-select');

  /* ── Panels ──────────────────────────────────────────────────────────── */

  function paint() {
    root.querySelector('.listen-lead').hidden = panel !== 'start';
    if (panel === 'start') paintStart();
    else if (panel === 'rec') paintRec();
    else paintDone();
  }

  function paintStart() {
    resultsEl.innerHTML = '';
    const scoreLine = source
      ? `<p class="listen-file-line">${t('listen.scoreLoaded', { title: esc(source.score.title || source.fileName) })}
           <button class="quiet-btn" type="button" data-act="pick">${t('listen.otherScore')}</button>
           <button class="quiet-btn" type="button" data-act="noscore">${t('listen.noScore')}</button></p>
         <p class="listen-hint">${t('listen.scoreHint', { bars: source.score.order.length, notes: source.score.notes.length })}</p>`
      : '';
    body.innerHTML = `
      ${
        source
          ? scoreLine
          : `<div class="listen-choices">
              <div class="listen-choice">
                <h4>${t('listen.freeTitle')}</h4>
                <p>${t('listen.freeText')}</p>
              </div>
              <div class="listen-choice">
                <h4>${t('listen.scoreTitle')}</h4>
                <p>${t('listen.scoreText')}</p>
                <button class="ghost-btn" type="button" data-act="pick">${t('listen.pickScore')}</button>
              </div>
            </div>`
      }
      <ul class="listen-tips">
        <li>${t('listen.tipQuiet')}</li>
        <li>${t('listen.tipHeadphones')}</li>
        ${source ? `<li>${t('listen.tipStraight')}</li>` : ''}
      </ul>
      <div class="listen-actions">
        <button class="primary-btn" type="button" data-act="record">${t(source ? 'listen.recordScore' : 'listen.record')}</button>
      </div>
      <p class="listen-status" role="status"></p>`;
  }

  function paintRec() {
    resultsEl.innerHTML = '';
    body.innerHTML = `
      <div class="listen-rec">
        <span class="listen-rec-dot" aria-hidden="true"></span>
        <span class="listen-rec-time">0:00</span>
        <span class="listen-rec-note">${t('listen.recording')}</span>
      </div>
      <div class="listen-actions">
        <button class="primary-btn" type="button" data-act="stop">${t('listen.stop')}</button>
        <button class="quiet-btn" type="button" data-act="cancel">${t('listen.cancel')}</button>
      </div>
      <p class="listen-status" role="status"></p>`;
  }

  function paintDone() {
    body.innerHTML = `
      <div class="listen-actions">
        <button class="primary-btn" type="button" data-act="again">${t('listen.again')}</button>
        <button class="ghost-btn" type="button" data-act="playall">${t('listen.playAll')}</button>
      </div>
      <p class="listen-status" role="status"></p>`;
    paintPlayButtons();
    resultsEl.innerHTML = result ? resultsHtml(result.analysis) : '';
  }

  const status = (text) => {
    const s = root.querySelector('.listen-status');
    if (s) s.textContent = text || '';
  };

  /* ── The score ───────────────────────────────────────────────────────── */

  async function openFile(file) {
    if (!file) return;
    status(t('listen.reading'));
    try {
      const xml = await readScoreFile(file);
      const doc = parseXml(xml);
      const parts = listParts(doc);
      const score = readScore(xml);
      if (!score.notes.length) throw new Error('no-notes');
      source = { xml, score, parts, fileName: file.name.replace(/\.(musicxml|xml|mxl)$/i, '') };
      result = null;
      pickedBar = null;
      panel = 'start';
      paint();
      await drawScore();
    } catch (err) {
      const why = String(err?.message || '');
      status(
        why === 'timewise'
          ? t('listen.errTimewise')
          : why === 'no-notes' || why === 'no-part'
            ? t('listen.errNoNotes')
            : t('listen.errFile'),
      );
    } finally {
      fileInput.value = '';
    }
  }

  function choosePart(id) {
    if (!source) return;
    try {
      const score = readScore(source.xml, id);
      source.score = score;
      result = null;
      pickedBar = null;
      panel = 'start';
      paint();
      drawScore();
    } catch {
      status(t('listen.errNoNotes'));
    }
  }

  async function drawScore() {
    if (!source) {
      scoreWrap.hidden = true;
      return;
    }
    scoreWrap.hidden = false;
    root.querySelector('.listen-score-title').textContent = source.score.title || source.fileName;
    const partLabel = root.querySelector('.listen-part');
    partLabel.hidden = source.parts.length < 2;
    partSelect.innerHTML = source.parts
      .map((p) => `<option value="${esc(p.id)}"${p.id === source.score.partId ? ' selected' : ''}>${esc(p.name)}</option>`)
      .join('');
    const mine = ++ticket;
    scoreEl.innerHTML = `<p class="listen-hint">${t('listen.drawing')}</p>`;
    barsEl.innerHTML = '';
    try {
      const lib = await loadOsmd();
      if (mine !== ticket) return;
      scoreEl.innerHTML = '';
      osmd = new lib.OpenSheetMusicDisplay(scoreEl, {
        backend: 'svg',
        autoResize: false,
        drawTitle: false,
        drawSubtitle: false,
        drawComposer: false,
        drawLyricist: false,
        drawPartNames: false,
        drawCredits: false,
        coloringEnabled: true,
      });
      await osmd.load(source.xml);
      if (mine !== ticket) return;
      const at = source.parts.findIndex((p) => p.id === source.score.partId);
      osmd.Sheet.Instruments.forEach((ins, i) => {
        ins.Visible = i === (at < 0 ? 0 : at);
      });
      render();
    } catch {
      if (mine === ticket) scoreEl.innerHTML = `<p class="listen-hint">${t('listen.errDraw')}</p>`;
    }
  }

  function render() {
    if (!osmd) return;
    const width = scoreEl.clientWidth || 360;
    osmd.zoom = width < 520 ? 0.62 : width < 800 ? 0.78 : 0.9;
    osmd.render();
    placeBars();
  }

  /** The violin staff of every written measure, as boxes to tap. */
  function measureBoxes() {
    const list = osmd?.GraphicSheet?.MeasureList || [];
    const unit = 10 * osmd.zoom;
    return list.map((staves) => {
      const m = (staves || []).find((x) => x && x.ParentStaff?.ParentInstrument?.Visible);
      if (!m) return null;
      const p = m.PositionAndShape;
      return {
        m,
        x: p.AbsolutePosition.x * unit,
        y: p.AbsolutePosition.y * unit,
        w: p.Size.width * unit,
        h: 4 * unit,
      };
    });
  }

  function placeBars() {
    barsEl.innerHTML = '';
    if (!result || !osmd) return;
    const svg = scoreEl.querySelector('svg');
    if (!svg) return;
    const off = svg.getBoundingClientRect();
    const wrap = scoreWrap.getBoundingClientRect();
    const dx = off.left - wrap.left;
    const dy = off.top - wrap.top;
    const worst = new Set((result.analysis.worst || []).map((b) => b.measure));
    measureBoxes().forEach((b, i) => {
      if (!b) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `listen-bar${worst.has(i) ? ' is-weak' : ''}${pickedBar === i ? ' is-picked' : ''}`;
      btn.dataset.bar = String(i);
      btn.style.left = `${dx + b.x - 2}px`;
      btn.style.top = `${dy + b.y - b.h * 0.9}px`;
      btn.style.width = `${b.w + 4}px`;
      btn.style.height = `${b.h * 2.8}px`;
      btn.setAttribute('aria-label', t('listen.barAria', { n: source.score.measures[i]?.number ?? i + 1 }));
      barsEl.appendChild(btn);
    });
  }

  /** Colours every written note by how the take went (the worst pass wins). */
  function markNotes(analysis) {
    if (!osmd) return;
    const rank = { good: 0, tune: 1, missed: 2, wrong: 3 };
    const verdict = new Map(); // `${measure}:${at}:${midi}` → mark
    for (const r of analysis.results) {
      const mark =
        r.status === 'missed'
          ? 'missed'
          : r.status === 'exact'
            ? Math.abs(r.cents) > 20
              ? 'tune'
              : 'good'
            : 'wrong';
      const key = `${r.measure}:${r.beat.toFixed(3)}:${r.midi}`;
      const was = verdict.get(key);
      if (!was || rank[mark] > rank[was]) verdict.set(key, mark);
    }
    const boxes = measureBoxes();
    boxes.forEach((b, mi) => {
      if (!b) return;
      for (const se of b.m.staffEntries || []) {
        const at = se.relInMeasureTimestamp.RealValue * 4;
        for (const gve of se.graphicalVoiceEntries || []) {
          for (const gn of gve.notes || []) {
            const n = gn.sourceNote;
            if (!n || n.isRest()) continue;
            const midi = n.halfTone + 12;
            const mark = verdict.get(`${mi}:${at.toFixed(3)}:${midi}`);
            n.NoteheadColor = mark ? MARK[mark] : undefined;
          }
        }
      }
    });
    render();
  }

  /* ── Listening ───────────────────────────────────────────────────────── */

  async function startTake() {
    stopPlayback();
    status(t('listen.opening'));
    let mic;
    try {
      mic = await deps.openMic();
    } catch (err) {
      status(deps.micError(err));
      return;
    }
    take = {
      frames: [],
      rec: canRecord() && mic?.stream ? recordStream(mic.stream) : null,
      began: performance.now(),
      timer: 0,
    };
    if (take.rec) take.began = take.rec.startedAt;
    listening = true;
    result = null;
    pickedBar = null;
    panel = 'rec';
    paint();
    if (source) markClear();
    take.timer = setInterval(() => {
      const s = (performance.now() - take.began) / 1000;
      const el = root.querySelector('.listen-rec-time');
      if (el) el.textContent = clock(s);
      if (s >= MAX_SECONDS) finishTake();
    }, 250);
  }

  function markClear() {
    if (!osmd) return;
    measureBoxes().forEach((b) => {
      for (const se of b?.m.staffEntries || [])
        for (const gve of se.graphicalVoiceEntries || []) for (const gn of gve.notes || []) if (gn.sourceNote) gn.sourceNote.NoteheadColor = undefined;
    });
    render();
  }

  function frame(f) {
    if (!listening || !take) return;
    take.frames.push({ t: (performance.now() - take.began) / 1000, freq: f.freq, clarity: f.clarity, rms: f.rms });
  }

  async function endListening() {
    listening = false;
    if (take?.timer) clearInterval(take.timer);
    const rec = take?.rec;
    deps.closeMic();
    return rec ? rec.stop() : null;
  }

  async function finishTake() {
    if (!listening) return;
    const frames = take.frames;
    const blob = await endListening();
    const seconds = frames.length ? frames[frames.length - 1].t : 0;
    take = null;
    if (seconds < MIN_SECONDS) {
      panel = 'start';
      paint();
      status(t('listen.tooShort'));
      return;
    }
    let analysis;
    try {
      analysis = source ? analyzeScore(frames, source.score) : analyzeFree(frames);
    } catch {
      analysis = analyzeFree(frames);
    }
    if (!analysis.heard) {
      panel = 'start';
      paint();
      status(t('listen.nothingHeard'));
      return;
    }
    result = { analysis, blob, seconds };
    panel = 'done';
    paint();
    if (source && analysis.withScore) markNotes(analysis);
    if (seconds >= 20 && analysis.heard >= 15) deps.onFinish?.({ seconds, heard: analysis.heard });
  }

  async function cancelTake() {
    await endListening();
    take = null;
    panel = 'start';
    paint();
  }

  /* ── Listening back ──────────────────────────────────────────────────── */

  async function playFrom(seconds, what) {
    if (!result?.blob) {
      status(t('listen.noRecording'));
      return;
    }
    const same = player && player.what === what;
    stopPlayback();
    if (same) return; // a second tap on the same button stops it
    try {
      const handle = await playRecording(result.blob, { wet: 0.22, offset: Math.max(0, seconds - 0.4) });
      player = { handle, what };
      paintPlayButtons();
      handle.ended.then(() => {
        if (player?.handle === handle) {
          player = null;
          paintPlayButtons();
        }
      });
    } catch {
      status(t('listen.playFail'));
    }
  }

  function stopPlayback() {
    if (!player) return;
    player.handle.stop();
    player = null;
    paintPlayButtons();
  }

  function paintPlayButtons() {
    root.querySelectorAll('[data-play]').forEach((b) => {
      const on = player?.what === b.dataset.play;
      b.classList.toggle('is-on', on);
      if (b.dataset.act === 'playall') b.textContent = on ? t('listen.stopPlay') : t('listen.playAll');
      else b.textContent = on ? '■' : '▶';
    });
    const all = root.querySelector('[data-act="playall"]');
    if (all) {
      all.dataset.play = 'all';
      const on = player?.what === 'all';
      all.classList.toggle('is-on', on);
      all.textContent = on ? t('listen.stopPlay') : t('listen.playAll');
      all.hidden = !result?.blob;
    }
  }

  function tapBar(mi) {
    if (!result?.analysis?.withScore) return;
    const at = barStartTime(result.analysis, mi);
    pickedBar = mi;
    barsEl.querySelectorAll('.listen-bar').forEach((b) => b.classList.toggle('is-picked', Number(b.dataset.bar) === mi));
    if (at == null) {
      status(t('listen.barNotPlayed', { n: source.score.measures[mi]?.number ?? mi + 1 }));
      stopPlayback();
      return;
    }
    status(t('listen.fromBar', { n: source.score.measures[mi]?.number ?? mi + 1 }));
    playFrom(at, `bar:${mi}`);
  }

  /* ── What it noticed ─────────────────────────────────────────────────── */

  function playBtn(seconds, id) {
    return `<button class="listen-play" type="button" data-play="${esc(id)}" data-at="${seconds.toFixed(2)}" aria-label="${esc(t('listen.playHere'))}">▶</button>`;
  }

  function resultsHtml(a) {
    const cards = [];
    cards.push(`<p class="listen-noticed">${t('listen.noticed')}</p>`);
    if (a.accompaniment?.likely) {
      cards.push(`<div class="listen-warn">${t('listen.accompaniment')}</div>`);
    }

    // With the score: notes, how far, the pulse, the bars to look at.
    if (a.withScore) {
      const rows = [];
      rows.push(
        `<li>${t('listen.notesRight', { right: a.exact, of: a.expected })}${
          a.wrong ? ` · ${t('listen.notesWrong', { n: a.wrong })}` : ''
        }${a.missed ? ` · ${t('listen.notesMissed', { n: a.missed })}` : ''}</li>`,
      );
      if (a.reached.bar >= 0 && a.reached.bar < a.reached.of - 1) {
        rows.push(`<li>${t('listen.reached', { n: a.reached.bar + 1, of: a.reached.of })}</li>`);
      }
      cards.push(card(t('listen.cardNotes'), `<ul class="listen-list">${rows.join('')}</ul>${legend()}<p class="listen-hint">${t('listen.tapBar')}</p>`));

      const tp = a.tempo;
      if (tp.bpm) {
        const r = [];
        r.push(
          `<li>${t('listen.pulse', { bpm: Math.round(tp.bpm) })}${
            tp.marked ? ` ${t('listen.marked', { bpm: Math.round(tp.marked) })}` : ''
          }</li>`,
        );
        if (tp.steadiness != null) r.push(`<li>${t(steadyKey(tp.steadiness))}</li>`);
        if (tp.rushing.length) r.push(`<li>${t('listen.rushing', { bars: barList(tp.rushing) })}</li>`);
        if (tp.dragging.length) r.push(`<li>${t('listen.dragging', { bars: barList(tp.dragging) })}</li>`);
        cards.push(card(t('listen.cardTempo'), `<ul class="listen-list">${r.join('')}</ul>`));
      }

      if (a.worst.length) {
        const r = a.worst.map(
          (b) =>
            `<li>${b.start != null ? playBtn(b.start, `bar:${b.measure}`) : ''}${t('listen.weakBar', {
              n: b.number,
              right: b.exact,
              of: b.notes,
            })}</li>`,
        );
        cards.push(card(t('listen.cardBars'), `<ul class="listen-list">${r.join('')}</ul>`));
      }
    }

    // Tuning: with a score, against the written note; without, the nearest one.
    const into = a.intonation;
    if (into) {
      const r = [`<li>${t(a.withScore ? 'listen.inTuneScore' : 'listen.inTune', { p: pctOf(into.inTune) })}</li>`];
      const lean = into.sharp > into.flat + 0.1 ? 'sharp' : into.flat > into.sharp + 0.1 ? 'flat' : null;
      if (lean) r.push(`<li>${t(lean === 'sharp' ? 'listen.leanSharp' : 'listen.leanFlat')}</li>`);
      for (const td of (into.tendencies || []).filter((x) => Math.abs(x.mean) >= 8).slice(0, 3)) {
        r.push(`<li>${t(td.mean > 0 ? 'listen.noteSharp' : 'listen.noteFlat', { note: td.name, c: Math.abs(Math.round(td.mean)), n: td.n })}</li>`);
      }
      for (const s of (into.byString || []).filter((x) => Math.abs(x.mean) >= 8)) {
        r.push(`<li>${t(s.mean > 0 ? 'listen.stringSharp' : 'listen.stringFlat', { s: s.string, c: Math.abs(Math.round(s.mean)) })}</li>`);
      }
      if (into.drift != null && Math.abs(into.drift) >= 10) {
        r.push(`<li>${t(into.drift > 0 ? 'listen.driftUp' : 'listen.driftDown', { c: Math.abs(Math.round(into.drift)) })}</li>`);
      }
      cards.push(card(t('listen.cardTuning'), `<ul class="listen-list">${r.join('')}</ul>`));
    }

    // Vibrato, in words.
    const v = a.vibrato;
    if (v) {
      let text;
      if (v.share == null) text = t('listen.vibNone');
      else if (!v.used) text = t('listen.vibOff', { n: v.held });
      else
        text = `${t('listen.vibShare', { p: pctOf(v.share), n: v.held })} ${t('listen.vibHow', {
          speed: t(`listen.speed.${v.speed}`),
          rate: v.rate.toFixed(1),
          size: t(`listen.size.${v.size}`),
          width: Math.round(v.width),
        })}`;
      cards.push(card(t('listen.cardVibrato'), `<p>${text}</p>`));
    }

    // Loud and soft, with the shape of the take.
    const d = a.dynamics;
    if (d) {
      const range = Math.round(d.range);
      const key = range < 8 ? 'listen.dynFlat' : range < 15 ? 'listen.dynSome' : 'listen.dynWide';
      cards.push(card(t('listen.cardDynamics'), `<p>${t(key, { db: range })}</p>${curveSvg(d.curve)}`));
    }

    // Where the playing stopped, to hear what happened there.
    const r = [];
    if (a.stops.length) {
      for (const s of a.stops.slice(0, 6)) {
        r.push(`<li>${playBtn(Math.max(0, s.t - 2.5), `stop:${s.t.toFixed(1)}`)}${t('listen.stopAt', { at: clock(s.t), secs: s.length.toFixed(1) })}</li>`);
      }
    }
    const meta = [`<li>${t('listen.length', { time: clock(a.duration), n: a.heard })}</li>`];
    if (a.range) meta.push(`<li>${t('listen.range', { low: nameOf(a.range.low), high: nameOf(a.range.high) })}</li>`);
    cards.push(
      card(
        t('listen.cardTake'),
        `<ul class="listen-list">${meta.join('')}${r.join('')}</ul>${
          a.stops.length ? '' : `<p class="listen-hint">${t('listen.noStops')}</p>`
        }`,
      ),
    );
    cards.push(`<p class="listen-hint listen-limits">${t(a.withScore ? 'listen.limitsScore' : 'listen.limitsFree')}</p>`);
    return cards.join('');
  }

  const card = (title, html) => `<section class="sprint-card lb-card"><h4>${title}</h4>${html}</section>`;
  const steadyKey = (s) => (s >= 0.85 ? 'listen.steady' : s >= 0.65 ? 'listen.fairlySteady' : 'listen.unsteady');
  const barList = (bars) => [...new Set(bars.map((b) => b.number))].slice(0, 6).join(', ');
  const legend = () =>
    `<p class="listen-legend">${['good', 'tune', 'wrong', 'missed']
      .map((k) => `<span><i style="background:${MARK[k]}"></i>${t(`listen.mark.${k}`)}</span>`)
      .join('')}</p>`;

  function curveSvg(curve) {
    if (!curve || curve.length < 3) return '';
    const vals = curve.filter((x) => x != null);
    if (vals.length < 3) return '';
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = Math.max(6, hi - lo);
    const W = 300;
    const H = 46;
    const pts = curve
      .map((c, i) => (c == null ? null : `${((i / (curve.length - 1)) * W).toFixed(1)},${(H - 4 - ((c - lo) / span) * (H - 8)).toFixed(1)}`))
      .filter(Boolean)
      .join(' ');
    return `<svg class="listen-curve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>
      <p class="listen-axis"><span>${t('listen.curveStart')}</span><span>${t('listen.curveEnd')}</span></p>`;
  }

  /* ── Events ──────────────────────────────────────────────────────────── */

  root.addEventListener('click', (e) => {
    const bar = e.target.closest('.listen-bar');
    if (bar) return tapBar(Number(bar.dataset.bar));
    const p = e.target.closest('[data-play][data-at]');
    if (p) return playFrom(Number(p.dataset.at), p.dataset.play);
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'back') return deps.onBack();
    if (act === 'pick') return fileInput.click();
    if (act === 'noscore') {
      source = null;
      osmd = null;
      ticket += 1;
      scoreEl.innerHTML = '';
      scoreWrap.hidden = true;
      return paint();
    }
    if (act === 'record') return startTake();
    if (act === 'stop') return finishTake();
    if (act === 'cancel') return cancelTake();
    if (act === 'playall') return playFrom(0, 'all');
    if (act === 'again') {
      stopPlayback();
      result = null;
      pickedBar = null;
      panel = 'start';
      paint();
      if (source) markClear();
      return;
    }
  });
  fileInput.addEventListener('change', () => openFile(fileInput.files?.[0]));
  partSelect.addEventListener('change', () => choosePart(partSelect.value));

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (root.hidden || !osmd) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 200);
  });

  paint();

  return {
    get listening() {
      return listening;
    },
    frame,
    open() {
      if (panel === 'rec') return;
      paint();
    },
    /** Leaving the screen: let go of the microphone and the speaker. */
    stop() {
      stopPlayback();
      if (listening) cancelTake();
    },
    /** Test hooks: a score from text, and a take from frames. */
    async __loadXml(xml, name = 'test') {
      return openFile(new File([xml], `${name}.musicxml`, { type: 'application/xml' }));
    },
    __analyse(frames, blob = null) {
      const analysis = source ? analyzeScore(frames, source.score) : analyzeFree(frames);
      result = { analysis, blob, seconds: frames.length ? frames[frames.length - 1].t : 0 };
      panel = 'done';
      paint();
      if (source && analysis.withScore) markNotes(analysis);
      return analysis;
    },
  };
}
