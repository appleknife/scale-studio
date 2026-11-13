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

import { readScore, readScoreFile, listParts, parseXml, sectionOf } from './musicxml.js?v=202611122010';
import { analyzeFree, analyzeScore, barStartTime, nameOf } from './listen.js?v=202611122010';
import { recordStream, play as playRecording, canRecord } from './recorder.js?v=202611122010';
import { t } from './i18n.js?v=202611122010';

const OSMD_SRC = './vendor/opensheetmusicdisplay.min.js?v=202611122010';
const MAX_SECONDS = 600; // ten minutes: enough for any audition piece
const MIN_SECONDS = 5;
const MIN_SECTION_SECONDS = 1.5; // a single bar is a fair thing to practise
const SPEED = { min: 30, max: 200, step: 2, fallback: 80 };

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
 *   player()        the app's one player (playback.js), for the example
 *   readyViolin()   resolves when the recorded violin has loaded
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
  // Practising a passage: written bar indexes, or null for the whole piece.
  let section = null;
  let anchor = false; // one end of the section tapped, waiting for the other
  let bpm = SPEED.fallback; // quarter notes a minute, for the example
  let hearing = false;
  let marked = false; // the score carries a take's colours
  let nowBar = null; // the written bar the example has reached
  const tries = new Map(); // what was practised → [{ exact, expected }]

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
         ${sectionHtml()}
         <p class="listen-hint">${
           section
             ? t('listen.sectionHint', { bars: playing().order.length, notes: playing().notes.length })
             : t('listen.scoreHint', { bars: source.score.order.length, notes: source.score.notes.length })
         }</p>
         ${hearHtml(true)}`
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
        ${source ? `<li>${t(section ? 'listen.tipSection' : 'listen.tipStraight')}</li>` : ''}
      </ul>
      <div class="listen-actions">
        <button class="primary-btn" type="button" data-act="record">${recordLabel()}</button>
      </div>
      <p class="listen-status" role="status"></p>`;
    paintHear();
  }

  const barNo = (mi) => source.score.measures[mi]?.number ?? mi + 1;

  function recordLabel() {
    if (!source) return t('listen.record');
    if (!section) return t('listen.recordScore');
    return section.from === section.to
      ? t('listen.recordBar', { a: esc(barNo(section.from)) })
      : t('listen.recordSection', { a: esc(barNo(section.from)), b: esc(barNo(section.to)) });
  }

  /** Whole piece or a passage, and which bars. */
  function sectionHtml() {
    const pick = (which) =>
      `<select class="listen-bar-select" data-end="${which}" aria-label="${esc(t(which === 'from' ? 'listen.firstBarAria' : 'listen.lastBarAria'))}">${source.score.measures
        .map((m, i) => `<option value="${i}"${section && section[which] === i ? ' selected' : ''}>${esc(m.number)}</option>`)
        .join('')}</select>`;
    return `
      <div class="listen-section">
        <span class="control-label">${t('listen.practise')}</span>
        <div class="segmented small" role="tablist">
          <button type="button" role="tab" data-act="whole" aria-selected="${section ? 'false' : 'true'}">${t('listen.whole')}</button>
          <button type="button" role="tab" data-act="section" aria-selected="${section ? 'true' : 'false'}">${t('listen.section')}</button>
        </div>
        ${section ? `<span class="listen-range">${t('listen.sectionRange', { from: pick('from'), to: pick('to') })}</span>` : ''}
      </div>
      ${section ? `<p class="listen-hint">${t('listen.sectionTap')}</p>` : ''}`;
  }

  /** The example: hear how it goes, at a speed to learn it at. */
  function hearHtml(withSpeed) {
    if (!source || !deps.player) return '';
    const marked = source.score.tempo ? Math.round(source.score.tempo) : null;
    const speed = withSpeed
      ? `<label class="listen-speed">${t('listen.speed')}
           <input type="range" class="listen-speed-range" min="${SPEED.min}" max="${SPEED.max}" step="${SPEED.step}" value="${bpm}" aria-label="${esc(t('listen.speedAria'))}" />
           <output class="listen-speed-out">♩ = ${bpm}</output>
         </label>
         ${marked && marked !== bpm ? `<button class="quiet-btn small" type="button" data-act="marked">${t('listen.tempoMarked', { bpm: marked })}</button>` : ''}`
      : '';
    return `<div class="listen-hear"><button class="ghost-btn" type="button" data-act="hear"></button>${speed}</div>`;
  }

  /** The score being practised: the passage, or all of it. */
  function playing() {
    if (!source) return null;
    return section ? sectionOf(source.score, section.from, section.to) : source.score;
  }
  const tryKey = () => `${source?.score.partId}:${section ? `${section.from}-${section.to}` : 'all'}`;

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
      ${hearHtml(false)}
      <p class="listen-status" role="status"></p>`;
    paintPlayButtons();
    paintHear();
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
      stopHearing();
      source = { xml, score, parts, fileName: file.name.replace(/\.(musicxml|xml|mxl)$/i, '') };
      resetPractice();
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
      stopHearing();
      source.score = score;
      resetPractice();
      result = null;
      pickedBar = null;
      panel = 'start';
      paint();
      drawScore();
    } catch {
      status(t('listen.errNoNotes'));
    }
  }

  function resetPractice() {
    section = null;
    anchor = false;
    tries.clear();
    const marked = Math.round(source?.score.tempo || SPEED.fallback);
    bpm = Math.max(SPEED.min, Math.min(SPEED.max, marked - (marked % SPEED.step)));
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
    if (!source || !osmd) return;
    const svg = scoreEl.querySelector('svg');
    if (!svg) return;
    const off = svg.getBoundingClientRect();
    const wrap = scoreWrap.getBoundingClientRect();
    const dx = off.left - wrap.left;
    const dy = off.top - wrap.top;
    const worst = new Set((result?.analysis.worst || []).map((b) => b.measure));
    const choosing = panel === 'start';
    measureBoxes().forEach((b, i) => {
      if (!b) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      const inside = section && i >= section.from && i <= section.to;
      btn.className = `listen-bar${worst.has(i) ? ' is-weak' : ''}${pickedBar === i ? ' is-picked' : ''}${
        section ? (inside ? ' is-in' : ' is-out') : ''
      }${nowBar === i ? ' is-now' : ''}`;
      btn.dataset.bar = String(i);
      btn.style.left = `${dx + b.x - 2}px`;
      btn.style.top = `${dy + b.y - b.h * 0.9}px`;
      btn.style.width = `${b.w + 4}px`;
      btn.style.height = `${b.h * 2.8}px`;
      btn.setAttribute('aria-label', t(choosing ? 'listen.barPickAria' : 'listen.barAria', { n: barNo(i) }));
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
    marked = true;
    render();
  }

  /* ── Listening ───────────────────────────────────────────────────────── */

  async function startTake() {
    stopPlayback();
    stopHearing();
    anchor = false;
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
    else placeBars();
    take.timer = setInterval(() => {
      const s = (performance.now() - take.began) / 1000;
      const el = root.querySelector('.listen-rec-time');
      if (el) el.textContent = clock(s);
      if (s >= MAX_SECONDS) finishTake();
    }, 250);
  }

  function markClear() {
    if (!osmd) return;
    if (!marked) return placeBars(); // nothing coloured: no need to engrave again
    marked = false;
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
    if (seconds < (source && section ? MIN_SECTION_SECONDS : MIN_SECONDS)) {
      panel = 'start';
      paint();
      status(t('listen.tooShort'));
      return;
    }
    let analysis;
    try {
      analysis = source ? analyzeScore(frames, playing()) : analyzeFree(frames);
    } catch {
      analysis = analyzeFree(frames);
    }
    if (!analysis.heard) {
      panel = 'start';
      paint();
      placeBars();
      status(t('listen.nothingHeard'));
      return;
    }
    noteTry(analysis);
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
    placeBars();
  }

  /** Keeps how each go at this passage went, so the next one has something to beat. */
  function noteTry(analysis) {
    if (!analysis.withScore) return;
    const k = tryKey();
    if (!tries.has(k)) tries.set(k, []);
    tries.get(k).push({ exact: analysis.exact, expected: analysis.expected });
  }

  /* ── Choosing a passage ──────────────────────────────────────────────── */

  function setSection(next, waiting = false) {
    stopHearing();
    section = next;
    anchor = waiting;
    result = null;
    pickedBar = null;
    panel = 'start';
    paint();
    markClear();
  }

  /** A tap on the score: the first names one end of the passage, the second the other. */
  function pickSectionBar(mi) {
    if (section && anchor) {
      setSection({ from: Math.min(section.from, mi), to: Math.max(section.from, mi) });
      return;
    }
    setSection({ from: mi, to: mi }, true);
    status(t('listen.sectionFirst', { n: barNo(mi) }));
  }

  /* ── The example ─────────────────────────────────────────────────────── */

  async function hearExample() {
    if (hearing) return stopHearing();
    const p = deps.player?.();
    const sc = playing();
    if (!p || !sc) return;
    stopPlayback();
    // Where to start: the bar tapped after a take, or the top.
    const starts = [];
    let q = 0;
    for (const mi of sc.order) {
      starts.push(q);
      q += sc.measures[mi].quarters;
    }
    const at = panel === 'done' && pickedBar != null ? sc.order.indexOf(pickedBar) : -1;
    const fromQ = at > 0 ? starts[at] : 0;
    const events = sc.notes
      .filter((n) => n.abs >= fromQ - 1e-6)
      .map((n) => ({ note: true, midi: n.midi, start: (n.abs - fromQ) * 4, dur: n.quarters * 4 }));
    if (!events.length) return;
    hearing = true;
    paintHear();
    try {
      // The context is made (and woken) inside the tap; the violin may take a
      // moment more, and the synth answers if it never arrives.
      const ctx = p.context;
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
      if (deps.readyViolin && !p.sampled) {
        await Promise.race([deps.readyViolin(), new Promise((r) => setTimeout(r, 1500))]);
      }
      if (!hearing) return;
      let plan = null;
      plan = p.play(
        { tempo: { bpm, unit: 'q' }, dynamic: 'mf', perBar: 16, bars: [events] },
        {
          onTick: (seconds) => {
            const here = fromQ + seconds / plan.secondsPerQuarter;
            let i = starts.length - 1;
            while (i > 0 && starts[i] > here + 1e-6) i--;
            showNow(sc.order[i]);
          },
          onEnd: () => stopHearing(true),
        },
      );
    } catch {
      hearing = false;
      paintHear();
      status(t('listen.hearFail'));
    }
  }

  function stopHearing(ended = false) {
    if (!hearing) return;
    hearing = false;
    if (!ended) deps.player?.().stop();
    showNow(null);
    paintHear();
  }

  function showNow(mi) {
    if (nowBar === mi) return;
    nowBar = mi;
    barsEl.querySelectorAll('.listen-bar').forEach((b) => b.classList.toggle('is-now', Number(b.dataset.bar) === mi));
  }

  function paintHear() {
    const b = root.querySelector('[data-act="hear"]');
    if (!b) return;
    b.classList.toggle('is-on', hearing);
    b.textContent = hearing ? t('listen.stopPlay') : t(panel === 'done' ? 'listen.hearExample' : 'listen.hear');
  }

  /* ── Listening back ──────────────────────────────────────────────────── */

  async function playFrom(seconds, what) {
    if (!result?.blob) {
      status(t('listen.noRecording'));
      return;
    }
    const same = player && player.what === what;
    stopHearing();
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

      const went = tries.get(tryKey()) || [];
      if (went.length >= 2) {
        const line = went
          .slice(-5)
          .map((x, i, shown) => t('listen.tryLine', { n: went.length - shown.length + i + 1, right: x.exact, of: x.expected }))
          .join(' · ');
        const first = went[0].exact;
        const now = went[went.length - 1].exact;
        cards.push(
          card(
            t(section ? 'listen.triesSection' : 'listen.triesPiece'),
            `<p>${line}</p>${now > first ? `<p class="listen-hint">${t('listen.triesUp', { was: first, now })}</p>` : ''}`,
          ),
        );
      }

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
            `<li>${b.start != null ? playBtn(b.start, `bar:${b.measure}`) : ''}<span class="listen-weak-text">${t('listen.weakBar', {
              n: b.number,
              right: b.exact,
              of: b.notes,
            })}</span>${
              section && section.from === b.measure && section.to === b.measure
                ? ''
                : `<button class="quiet-btn small" type="button" data-act="drill" data-bar="${b.measure}">${t('listen.drill')}</button>`
            }</li>`,
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
    if (bar) {
      if (panel === 'start') return pickSectionBar(Number(bar.dataset.bar));
      if (panel === 'done') return tapBar(Number(bar.dataset.bar));
      return;
    }
    const p = e.target.closest('[data-play][data-at]');
    if (p) return playFrom(Number(p.dataset.at), p.dataset.play);
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'back') return deps.onBack();
    if (act === 'pick') return fileInput.click();
    if (act === 'whole') return section ? setSection(null) : undefined;
    if (act === 'section') {
      if (section) return;
      return setSection({ from: 0, to: Math.min(3, source.score.measures.length - 1) });
    }
    if (act === 'drill') return setSection({ from: Number(btn.dataset.bar), to: Number(btn.dataset.bar) });
    if (act === 'hear') return hearExample();
    if (act === 'marked') {
      bpm = Math.max(SPEED.min, Math.min(SPEED.max, Math.round(source.score.tempo)));
      stopHearing();
      return paint();
    }
    if (act === 'noscore') {
      stopHearing();
      section = null;
      anchor = false;
      tries.clear();
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
      stopHearing();
      result = null;
      pickedBar = null;
      panel = 'start';
      paint();
      if (source) markClear();
      return;
    }
  });
  root.addEventListener('change', (e) => {
    const sel = e.target.closest('.listen-bar-select');
    if (!sel || !section) return;
    const v = Number(sel.value);
    const next = sel.dataset.end === 'from' ? { from: v, to: Math.max(v, section.to) } : { from: Math.min(v, section.from), to: v };
    setSection(next);
  });
  root.addEventListener('input', (e) => {
    const range = e.target.closest('.listen-speed-range');
    if (!range) return;
    bpm = Number(range.value);
    const out = root.querySelector('.listen-speed-out');
    if (out) out.textContent = `♩ = ${bpm}`;
    stopHearing();
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
      stopHearing();
      if (listening) cancelTake();
    },
    /** Test hooks: a score from text, and a take from frames. */
    async __loadXml(xml, name = 'test') {
      return openFile(new File([xml], `${name}.musicxml`, { type: 'application/xml' }));
    },
    __section(from, to) {
      setSection(from == null ? null : { from, to });
    },
    get __hearing() {
      return hearing;
    },
    __analyse(frames, blob = null) {
      const analysis = source ? analyzeScore(frames, playing()) : analyzeFree(frames);
      noteTry(analysis);
      result = { analysis, blob, seconds: frames.length ? frames[frames.length - 1].t : 0 };
      panel = 'done';
      paint();
      if (source && analysis.withScore) markNotes(analysis);
      return analysis;
    },
  };
}
