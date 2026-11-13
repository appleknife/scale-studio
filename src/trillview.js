// trillview.js — the trill trainer's screen. The rules are in trill.js; this
// file draws them and listens.
//
// Three panels: choosing (which string, which two fingers, which step of the
// ladder), playing (a count-in, then the pitch drawn as it goes up and down
// between the two notes, against the click), and what was heard (four plain
// measurements and one thing to try).
//
// The picture while playing is the same idea as the dot in Note Sprint — a dot
// that rides the pitch — with two things added: the two notes drawn as lines to
// travel between, and a trail behind the dot, so the shape of the last few
// seconds stays on the page. An even trill draws an even wave; a finger left
// down too long draws a wave with flat tops. Most of what the result panel says
// can be seen there first.

import * as Trill from './trill.js?v=202611131640';
import { t } from './i18n.js?v=202611131640';
import { hearLevel } from './pitch.js?v=202611131640';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const TRAIL_SECONDS = 4; // how much of the past the picture keeps
const LEAD = 0.5; // a breath between pressing Start and the first click

export function createTrillView(deps) {
  const root = deps.root;
  let stats = null;
  let panel = 'pick'; // 'pick' | 'play' | 'done'
  let stepId = null; // the step chosen; null = the next one not yet done
  let run = null;
  let listening = false;
  let ticket = 0;
  let last = null; // the last result, for the 'done' panel
  let raf = 0;

  root.innerHTML = `
    <button class="back-btn" type="button" data-act="back"><span aria-hidden="true">←</span> ${t('trill.back')}</button>
    <div class="head-row trill-head">
      <div>
        <h2>${t('trill.title')} <span class="menu-new">${t('trill.beta')}</span></h2>
        <p class="subtle trill-lead">${t('trill.lead')}</p>
      </div>
    </div>
    <div class="trill-body"></div>`;
  const body = root.querySelector('.trill-body');

  const notesNow = () => Trill.notesFor(stats.opts.string, stats.opts.pair, stats.opts.spacing);
  const stepNow = () => (stepId ? Trill.stepById(stepId) : Trill.nextStep(stats, notesNow()));
  const save = () => Trill.saveStats(deps.profileId(), stats);
  const finger = (n) => t(`trill.finger.${n}`);
  const oneDp = (n) => (Math.round(n * 10) / 10).toFixed(1);

  function paint() {
    cancelAnimationFrame(raf);
    if (panel === 'play') paintPlay();
    else if (panel === 'done') paintDone();
    else if (panel === 'stats') paintStats();
    else paintPick();
  }

  // ── Choosing ───────────────────────────────────────────────────────────

  function paintPick() {
    const o = stats.opts;
    const notes = notesNow();
    const step = stepNow();
    const done = Trill.doneFor(stats, notes);
    const set = stats.sets[Trill.setKey(notes)];
    const strings = Trill.STRINGS.map(
      (s) => `<button class="chip" type="button" data-string="${s.id}" aria-pressed="${o.string === s.id}">${t('trill.string', { s: s.id })}</button>`,
    ).join('');
    const pairs = Trill.PAIRS.map(
      (p) =>
        `<button class="chip" type="button" data-pair="${p.id}" aria-pressed="${o.pair === p.id}">${t(`trill.pair.${p.id}`)}</button>`,
    ).join('');
    const ladder = Trill.STEPS.map((s) => {
      const isDone = done.includes(s.id);
      const on = s.id === step.id;
      return `<button class="trill-step${on ? ' is-on' : ''}${isDone ? ' is-done' : ''}" type="button" data-step="${s.id}" aria-pressed="${on}">
          <span class="trill-step-n">${s.per ? s.per : '∞'}</span>
          <span class="trill-step-label">${t(`trill.step.${s.id}`)}</span>
          <span class="trill-step-tick" aria-hidden="true">${isDone ? '✓' : ''}</span>
        </button>`;
    }).join('');
    body.innerHTML = `
      <p class="trill-howto">${t('trill.pick.howto')}</p>
      <div class="trill-group">
        <span class="trill-label">${t('trill.label.string')}</span>
        <div class="chip-row">${strings}</div>
      </div>
      <div class="trill-group">
        <span class="trill-label">${t('trill.label.fingers')}</span>
        <div class="chip-row">${pairs}</div>
      </div>
      <div class="trill-group">
        <span class="trill-label">${t('trill.label.spacing')}</span>
        <div class="segmented small">
          <button type="button" data-spacing="whole" aria-selected="${notes.spacing === 'whole'}">${t('trill.spacing.whole')}</button>
          <button type="button" data-spacing="half" aria-selected="${notes.spacing === 'half'}">${t('trill.spacing.half')}</button>
        </div>
      </div>
      <p class="trill-notes">
        <span class="trill-note is-low"><b>${esc(notes.lowName.replace(/\d+$/, ''))}</b> ${t(notes.lowFinger === 0 ? 'trill.hold.open' : 'trill.hold', { finger: finger(notes.lowFinger) })}</span>
        <span class="trill-arrow" aria-hidden="true">⇄</span>
        <span class="trill-note is-high"><b>${esc(notes.highName.replace(/\d+$/, ''))}</b> ${t('trill.tap', { finger: finger(notes.highFinger) })}</span>
      </p>
      <div class="trill-group">
        <span class="trill-label">${t('trill.label.step')}</span>
        <div class="trill-ladder">${ladder}</div>
      </div>
      <p class="trill-ask">${
        step.per
          ? t('trill.ask.measured', { n: step.per, bpm: o.bpm, beats: Trill.TAKE_BEATS })
          : t('trill.ask.free', { secs: Trill.FREE_SECONDS })
      }</p>
      <div class="trill-opts">
        <div class="trill-tempo" ${step.per ? '' : 'hidden'}>
          <span>${t('trill.tempo')}</span>
          <button class="quiet-btn small" type="button" data-tempo="-1" aria-label="${t('trill.tempo.slower')}">−</button>
          <b class="trill-bpm">♩ = ${o.bpm}</b>
          <button class="quiet-btn small" type="button" data-tempo="1" aria-label="${t('trill.tempo.faster')}">+</button>
        </div>
        <label class="switch-row" ${step.per ? '' : 'hidden'}><input type="checkbox" data-opt="click" ${o.click ? 'checked' : ''}/>
          <span><b>${t('trill.opt.click')}</b><span class="switch-sub">${t('trill.opt.click.sub')}</span></span></label>
      </div>
      <div class="trill-actions">
        <button class="primary-btn" type="button" data-act="start">${t('trill.start')}</button>
        <button class="quiet-btn" type="button" data-act="stats">${t('trill.stats.open')}</button>
      </div>
      ${set && set.best ? `<p class="trill-best">${t('trill.best', { n: oneDp(set.best) })}</p>` : ''}
      <details class="trill-tips">
        <summary>${t('trill.tips.title')}</summary>
        <ul>
          <li>${t('trill.tips.contact')}</li>
          <li>${t('trill.tips.clear')}</li>
          <li>${t('trill.tips.travel')}</li>
          <li>${t('trill.tips.lift')}</li>
          <li>${t('trill.tips.down')}</li>
          <li>${t('trill.tips.pairs')}</li>
        </ul>
      </details>`;
  }

  // ── Playing ────────────────────────────────────────────────────────────

  function paintPlay() {
    const notes = run.notes;
    body.innerHTML = `
      <p class="trill-doing">${t('trill.doing', {
        string: run.notes.string,
        low: esc(notes.lowName.replace(/\d+$/, '')),
        high: esc(notes.highName.replace(/\d+$/, '')),
      })} · ${run.step.per ? t('trill.doing.per', { n: run.step.per, bpm: run.bpm }) : t('trill.step.free')}</p>
      <div class="trill-stage">
        <canvas class="trill-canvas" aria-hidden="true"></canvas>
        <div class="trill-count" hidden></div>
      </div>
      <p class="trill-status" aria-live="polite"></p>
      <div class="trill-actions"><button class="quiet-btn" type="button" data-act="stop">${t('trill.stop')}</button></div>`;
    run.canvas = body.querySelector('.trill-canvas');
    run.countEl = body.querySelector('.trill-count');
    run.statusEl = body.querySelector('.trill-status');
    sizeCanvas();
    run.statusEl.textContent = t('trill.status.opening');
    draw();
  }

  function sizeCanvas() {
    const c = run.canvas;
    const ratio = Math.min(2.5, window.devicePixelRatio || 1);
    const box = c.getBoundingClientRect();
    c.width = Math.max(300, Math.round(box.width * ratio));
    c.height = Math.max(160, Math.round(box.height * ratio));
    run.ratio = ratio;
  }

  /** The seconds since the microphone opened, now, between frames. */
  function clock() {
    if (!run || run.lastT == null) return 0;
    return run.lastT + (performance.now() - run.lastAt) / 1000;
  }

  /** One short, unpitched tick. A click with a pitch would be heard as a note. */
  function tick(when, strong) {
    const audio = deps.audio && deps.audio();
    if (!audio || !audio.ctx) return;
    const ctx = audio.ctx;
    const length = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = strong ? 2600 : 1900;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.value = strong ? 0.9 : 0.6;
    src.connect(filter).connect(gain).connect(audio.out);
    src.start(Math.max(ctx.currentTime, when));
  }

  /**
   * The clicks, a little ahead of time: every beat that falls in the next third
   * of a second is handed to the audio clock, so stopping early leaves nothing
   * queued and a busy page never makes one late.
   */
  function scheduleClicks(now) {
    const audio = deps.audio && deps.audio();
    if (!audio || !audio.ctx || !run) return;
    const beat = 60 / run.bpm;
    while (run.nextClick < run.totalBeats) {
      const at = run.beat0 + run.nextClick * beat;
      if (at > now + 0.35) break;
      const counting = run.nextClick < Trill.COUNT_IN;
      if (counting || (run.step.per && run.click)) tick(audio.ctx.currentTime + Math.max(0, at - now), run.nextClick % 4 === 0);
      run.nextClick += 1;
    }
  }

  async function start() {
    const mine = (ticket += 1);
    const notes = notesNow();
    const step = stepNow();
    const bpm = step.per ? stats.opts.bpm : Trill.TEMPO.start;
    const beat = 60 / bpm;
    run = {
      notes,
      step,
      bpm,
      click: stats.opts.click,
      frames: [], // everything heard during the take itself
      trail: [], // { t, p } for the picture, count-in included
      lastT: null,
      lastAt: 0,
      beat0: null,
      nextClick: 0,
      // a measured take is counted in beats; a free one in seconds, shown as beats of the count-in tempo
      totalBeats: Trill.COUNT_IN + (step.per ? Trill.TAKE_BEATS : Math.ceil(Trill.FREE_SECONDS / beat)),
      takeFrom: 0,
      takeTo: 0,
      dot: null,
    };
    panel = 'play';
    paint();
    try {
      const audio = deps.audio && deps.audio();
      if (audio && audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      await deps.openMic();
    } catch (err) {
      if (mine !== ticket) return;
      run = null;
      panel = 'pick';
      paint();
      const note = document.createElement('p');
      note.className = 'trill-error';
      note.textContent = deps.micError(err);
      body.prepend(note);
      return;
    }
    if (mine !== ticket) {
      deps.closeMic();
      return;
    }
    listening = true;
  }

  function stopRun() {
    ticket += 1;
    listening = false;
    cancelAnimationFrame(raf);
    if (run) deps.closeMic();
    run = null;
  }

  /** One frame from the microphone. */
  function frame(f) {
    if (!run || !listening) return;
    run.lastT = f.t;
    run.lastAt = performance.now();
    if (run.beat0 == null) {
      // The first frame is the clock starting: the count-in is placed from here.
      run.beat0 = f.t + LEAD;
      run.takeFrom = run.beat0 + Trill.COUNT_IN * (60 / run.bpm);
      run.takeTo = run.step.per
        ? run.takeFrom + Trill.TAKE_BEATS * (60 / run.bpm)
        : run.takeFrom + Trill.FREE_SECONDS;
    }
    scheduleClicks(f.t);

    const mic = deps.getMic();
    const loud = f.rms > hearLevel(mic?.floor, f.clarity);
    const p = loud ? Trill.placeOf(f, run.notes) : null;
    run.trail.push({ t: f.t, p });
    while (run.trail.length && run.trail[0].t < f.t - TRAIL_SECONDS - 0.5) run.trail.shift();
    // The dot glides: a little smoothing inside a note, none across the jump.
    run.dot = p == null ? null : run.dot == null || Math.abs(p - run.dot) > 0.35 ? p : run.dot * 0.5 + p * 0.5;

    if (f.t >= run.takeFrom && f.t <= run.takeTo) {
      run.frames.push({ t: f.t, freq: loud ? f.freq : 0, clarity: f.clarity });
    }
    paintStatus(f.t);
    if (f.t > run.takeTo + 0.12) finish();
  }

  function paintStatus(now) {
    if (!run || !run.statusEl) return;
    const beat = 60 / run.bpm;
    if (now < run.takeFrom) {
      const left = Math.max(1, Math.ceil((run.takeFrom - now) / beat));
      const shown = Math.min(Trill.COUNT_IN, left);
      if (run.countEl.textContent !== String(shown)) {
        run.countEl.textContent = String(shown);
        run.countEl.hidden = false;
        run.countEl.classList.remove('is-pop');
        void run.countEl.offsetWidth;
        run.countEl.classList.add('is-pop');
      }
      run.statusEl.textContent = t('trill.status.ready');
    } else {
      run.countEl.hidden = true;
      const secs = Math.max(0, Math.ceil(run.takeTo - now));
      run.statusEl.textContent = t('trill.status.go', { n: secs });
    }
  }

  /** The picture: two lines, the beats, the trail, the dot. */
  function draw() {
    if (!run || !run.canvas || panel !== 'play') return;
    const c = run.canvas;
    const g = c.getContext('2d');
    const w = c.width;
    const h = c.height;
    const k = run.ratio;
    const css = getComputedStyle(root);
    const ink = css.getPropertyValue('--ink').trim() || '#2b2118';
    const muted = css.getPropertyValue('--muted').trim() || '#8a7f73';
    const line = css.getPropertyValue('--line-strong').trim() || '#d8ccba';
    const accent = css.getPropertyValue('--accent').trim() || '#2f6b52';
    const gold = css.getPropertyValue('--gold').trim() || '#b8863b';
    g.clearRect(0, 0, w, h);

    const now = clock();
    const nowX = w * 0.8;
    const pxPerSec = nowX / TRAIL_SECONDS;
    const x = (time) => nowX + (time - now) * pxPerSec;
    const yLow = h * 0.74;
    const yHigh = h * 0.26;
    const y = (p) => yLow + (yHigh - yLow) * p;

    // the stretch of time that is being measured
    if (run.beat0 != null) {
      const a = Math.max(0, x(run.takeFrom));
      const b = Math.min(w, x(run.takeTo));
      if (b > a) {
        g.fillStyle = accent;
        g.globalAlpha = 0.06;
        g.fillRect(a, 0, b - a, h);
        g.globalAlpha = 1;
      }
      // beats: a tick for each, heavier on the count-in's first
      const beat = 60 / run.bpm;
      g.lineWidth = 1 * k;
      for (let i = 0; i < run.totalBeats + 1; i += 1) {
        const bx = x(run.beat0 + i * beat);
        if (bx < 0 || bx > w) continue;
        g.strokeStyle = line;
        g.globalAlpha = i < Trill.COUNT_IN ? 0.5 : 1;
        g.beginPath();
        g.moveTo(bx, h * 0.1);
        g.lineTo(bx, h * 0.9);
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    // the two notes
    g.lineWidth = 2 * k;
    g.setLineDash([6 * k, 6 * k]);
    for (const [yy, colour] of [
      [yLow, muted],
      [yHigh, gold],
    ]) {
      g.strokeStyle = colour;
      g.globalAlpha = 0.7;
      g.beginPath();
      g.moveTo(0, yy);
      g.lineTo(w, yy);
      g.stroke();
    }
    g.setLineDash([]);
    g.globalAlpha = 1;

    // the trail: where the pitch has been
    g.strokeStyle = accent;
    g.lineWidth = 3 * k;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.beginPath();
    let pen = false;
    let prev = null;
    for (const pt of run.trail) {
      if (pt.p == null || (prev && pt.t - prev.t > 0.12)) {
        pen = false;
        prev = pt.p == null ? null : pt;
        if (pt.p == null) continue;
      }
      const px = x(pt.t);
      const py = y(Math.max(-0.25, Math.min(1.25, pt.p)));
      if (!pen) g.moveTo(px, py);
      else g.lineTo(px, py);
      pen = true;
      prev = pt;
    }
    g.stroke();

    // The names of the two notes, to the right of "now" where the trail never
    // reaches, so the wave cannot run over them.
    g.font = `600 ${13 * k}px ${css.getPropertyValue('--sans') || 'sans-serif'}`;
    g.textAlign = 'right';
    g.textBaseline = 'bottom';
    g.fillStyle = gold;
    g.fillText(run.notes.highName.replace(/\d+$/, ''), w - 10 * k, yHigh - 5 * k);
    g.fillStyle = muted;
    g.fillText(run.notes.lowName.replace(/\d+$/, ''), w - 10 * k, yLow - 5 * k);
    g.font = `500 ${11 * k}px ${css.getPropertyValue('--sans') || 'sans-serif'}`;
    g.textBaseline = 'top';
    g.fillStyle = gold;
    g.fillText(finger(run.notes.highFinger), w - 10 * k, yHigh + 5 * k);
    g.fillStyle = muted;
    g.fillText(finger(run.notes.lowFinger), w - 10 * k, yLow + 5 * k);
    g.textAlign = 'left';

    // "now", and the dot that rides the pitch
    g.strokeStyle = line;
    g.lineWidth = 1.5 * k;
    g.beginPath();
    g.moveTo(nowX, h * 0.06);
    g.lineTo(nowX, h * 0.94);
    g.stroke();
    if (run.dot != null) {
      const near = Math.min(Math.abs(run.dot), Math.abs(run.dot - 1)) * run.notes.interval * 100 < 28;
      g.fillStyle = near ? accent : ink;
      g.beginPath();
      g.arc(nowX, y(Math.max(-0.25, Math.min(1.25, run.dot))), 9 * k, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 2 * k;
      g.stroke();
    }
    raf = requestAnimationFrame(draw);
  }

  function finish() {
    listening = false;
    cancelAnimationFrame(raf);
    deps.closeMic();
    const result = Trill.analyse(run.frames, run.notes, { bpm: run.bpm, step: run.step });
    const filed = Trill.recordRun(stats, run.notes, run.step, result, new Date().toISOString().slice(0, 10));
    save();
    last = { result, filed, notes: run.notes, step: run.step, bpm: run.bpm };
    run = null;
    panel = 'done';
    paint();
    // A take with a trill in it is practice, whatever was said about it.
    if (result.cycles >= 4) deps.onFinish(last);
  }

  // ── What was heard ─────────────────────────────────────────────────────

  function paintDone() {
    const { result: r, filed, notes, step, bpm } = last;
    const v = r.verdict;
    const judged = r.cycles >= 4;
    const next = Trill.STEPS[Trill.STEPS.findIndex((s) => s.id === step.id) + 1];
    const tile = (label, value, sub, tone = '') =>
      `<div class="trill-tile${tone ? ` is-${tone}` : ''}"><span class="trill-tile-label">${label}</span><b>${value}</b><span class="trill-tile-sub">${sub}</span></div>`;
    const pace = step.per
      ? tile(
          t('trill.m.pace'),
          oneDp(r.perBeat),
          t('trill.m.pace.per', { n: step.per }),
          Math.abs(r.perBeat / step.per - 1) < 0.16 ? 'good' : 'off',
        )
      : tile(t('trill.m.pace'), oneDp(r.rate), t('trill.m.pace.sec'));
    const share = Math.round(r.balance * 100);
    const tiles = judged
      ? `<div class="trill-tiles">
          ${pace}
          ${tile(t('trill.m.even'), `${r.even}%`, t(r.even >= 88 ? 'trill.m.even.very' : r.even >= Trill.EVEN_PASS ? 'trill.m.even.ok' : 'trill.m.even.no'), r.even >= Trill.EVEN_PASS ? 'good' : 'off')}
          ${tile(t('trill.m.balance'), `${100 - share} : ${share}`, t(r.balance > 0.63 ? 'trill.m.balance.top' : r.balance < 0.37 ? 'trill.m.balance.bottom' : 'trill.m.balance.ok'), r.balance > 0.63 || r.balance < 0.37 ? 'off' : 'good')}
          ${tile(t('trill.m.reach'), r.reach < -12 ? t('trill.m.reach.cents', { n: Math.abs(r.reach) }) : '✓', t(r.reach < -30 ? 'trill.m.reach.low' : r.reach < -12 ? 'trill.m.reach.near' : 'trill.m.reach.ok'), r.reach < -30 ? 'off' : 'good')}
        </div>`
      : '';
    const high = esc(notes.highName.replace(/\d+$/, ''));
    body.innerHTML = `
      <div class="trill-done${v.pass ? ' is-pass' : ''}">
        <p class="trill-verdict">${t(`trill.v.${v.id}.title`)}</p>
        <p class="trill-advice">${t(`trill.v.${v.id}.text`, { finger: finger(notes.highFinger), high, n: step.per, bpm })}</p>
        ${filed.newStep && step.per ? `<p class="trill-badge">${t('trill.done.step', { n: step.per })}</p>` : ''}
        ${filed.newBest ? `<p class="trill-badge">${t('trill.done.best', { n: oneDp(filed.best) })}</p>` : ''}
      </div>
      ${tiles}
      <div class="trill-actions">
        ${v.pass && next ? `<button class="primary-btn" type="button" data-act="next" data-next="${next.id}">${t(next.per ? 'trill.next' : 'trill.next.free', { n: next.per })}</button>` : ''}
        <button class="${v.pass && next ? 'quiet-btn' : 'primary-btn'}" type="button" data-act="again">${t('trill.again')}</button>
        <button class="quiet-btn" type="button" data-act="change">${t('trill.change')}</button>
        <button class="quiet-btn" type="button" data-act="stats">${t('trill.stats.open')}</button>
      </div>`;
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  function paintStats() {
    const sum = Trill.summary(stats);
    const total = Trill.STEPS.length;
    const backRow = `<div class="trill-actions"><button class="primary-btn" type="button" data-act="change">${t('trill.stats.back')}</button></div>`;
    if (!sum.runs) {
      body.innerHTML = `<h3 class="trill-stats-title">${t('trill.stats.title')}</h3><p class="trill-howto">${t('trill.stats.empty')}</p>${backRow}`;
      return;
    }
    const tile = (label, value, sub) =>
      `<div class="trill-tile"><span class="trill-tile-label">${label}</span><b>${value}</b><span class="trill-tile-sub">${sub}</span></div>`;
    const dots = (n) =>
      `<span class="trill-dots" role="img" aria-label="${esc(t('trill.stats.stepsOf', { n, total }))}">${Trill.STEPS.map((_, i) => `<i class="${i < n ? 'is-on' : ''}"></i>`).join('')}</span>`;
    const pairRows = sum.pairs
      .map(
        (p) => `<tr${p.runs ? '' : ' class="is-untried"'}>
          <th scope="row">${t(`trill.pair.${p.id}`)}</th>
          <td>${dots(p.steps)}</td>
          <td>${p.best ? oneDp(p.best) : '–'}</td>
          <td>${p.even == null ? '–' : `${p.even}%`}</td>
          <td>${p.runs}</td></tr>`,
      )
      .join('');
    const grid = sum.grid
      .map(
        (row) =>
          `<tr><th scope="row">${esc(row.string)}</th>${row.cells
            .map(
              (c) =>
                `<td><button class="trill-cell lv-${c.steps}${c.runs ? '' : ' is-untried'}" type="button" data-go-string="${row.string}" data-go-pair="${c.pair}"
                   aria-label="${esc(t('trill.stats.cellAria', { s: row.string, pair: t(`trill.pair.${c.pair}`), n: c.steps, total }))}">${c.runs ? `${c.steps}/${total}` : '·'}</button></td>`,
            )
            .join('')}</tr>`,
      )
      .join('');
    // The last takes, as a line: how even each one was, with the pass mark drawn.
    const pts = sum.recent;
    let chart = '';
    if (pts.length >= 2) {
      const W = 300;
      const H = 90;
      const x = (i) => 8 + (i * (W - 16)) / (pts.length - 1);
      const y = (e) => H - 10 - (Math.max(30, Math.min(100, e)) - 30) * ((H - 20) / 70);
      chart = `
        <h4 class="trill-stats-sub">${t('trill.stats.recent', { n: pts.length })}</h4>
        <svg class="trill-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('trill.stats.chartAria'))}">
          <path class="trill-chart-pass" d="M0 ${y(Trill.EVEN_PASS)} H${W}"/>
          <text class="trill-chart-text" x="2" y="${H - 1}">┄ ${t('trill.stats.passLine')}</text>
          <path class="trill-chart-line" d="${pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.e).toFixed(1)}`).join(' ')}"/>
          ${pts.map((p, i) => `<circle class="${p.p ? 'is-pass' : 'is-miss'}" cx="${x(i).toFixed(1)}" cy="${y(p.e).toFixed(1)}" r="3.4"/>`).join('')}
        </svg>
        <p class="trill-stats-note">${t('trill.stats.chartNote')}</p>`;
    }
    body.innerHTML = `
      <h3 class="trill-stats-title">${t('trill.stats.title')}</h3>
      <div class="trill-tiles">
        ${tile(t('trill.stats.takes'), sum.runs, t('trill.stats.days', { n: sum.days }))}
        ${tile(t('trill.stats.steps'), sum.steps, t('trill.stats.steps.sub'))}
        ${tile(t('trill.stats.fastest'), sum.best ? oneDp(sum.best) : '–', t(sum.best ? 'trill.m.pace.sec' : 'trill.stats.fastest.none'))}
      </div>
      ${
        sum.behind
          ? `<p class="trill-stats-nudge">${t('trill.stats.behind', { pair: t(`trill.pair.${sum.behind}`) })}
               <button class="quiet-btn small" type="button" data-go-pair="${sum.behind}">${t('trill.stats.go', { pair: t(`trill.pair.${sum.behind}`) })}</button></p>`
          : ''
      }
      <h4 class="trill-stats-sub">${t('trill.stats.byPair')}</h4>
      <div class="trill-table-wrap"><table class="trill-table">
        <thead><tr><th scope="col">${t('trill.label.fingers')}</th><th scope="col">${t('trill.stats.col.steps')}</th><th scope="col">${t('trill.stats.col.best')}</th><th scope="col">${t('trill.stats.col.even')}</th><th scope="col">${t('trill.stats.col.takes')}</th></tr></thead>
        <tbody>${pairRows}</tbody>
      </table></div>
      <h4 class="trill-stats-sub">${t('trill.stats.grid')}</h4>
      <div class="trill-table-wrap"><table class="trill-grid">
        <thead><tr><th></th>${Trill.PAIRS.map((p) => `<th scope="col">${t(`trill.pair.${p.id}`)}</th>`).join('')}</tr></thead>
        <tbody>${grid}</tbody>
      </table></div>
      <p class="trill-stats-note">${t('trill.stats.gridNote', { total })}</p>
      ${chart}
      ${backRow}`;
  }

  // ── Wiring ─────────────────────────────────────────────────────────────

  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b || !stats) return;
    if (b.dataset.act === 'back') {
      stopRun();
      panel = 'pick';
      deps.onBack();
    } else if (b.dataset.goPair) {
      // from the stats page: straight to that pair (and string, from the grid)
      if (b.dataset.goString) stats.opts.string = b.dataset.goString;
      stats.opts.pair = b.dataset.goPair;
      stats.opts.spacing = '';
      stepId = null;
      panel = 'pick';
      save();
      paint();
    } else if (b.dataset.act === 'stats') {
      panel = 'stats';
      paint();
      root.scrollIntoView({ block: 'start' });
    } else if (b.dataset.string) {
      stats.opts.string = b.dataset.string;
      stepId = null;
      save();
      paint();
    } else if (b.dataset.pair) {
      stats.opts.pair = b.dataset.pair;
      stats.opts.spacing = ''; // each pair comes in its usual spacing first
      stepId = null;
      save();
      paint();
    } else if (b.dataset.spacing) {
      stats.opts.spacing = b.dataset.spacing;
      stepId = null;
      save();
      paint();
    } else if (b.dataset.step) {
      stepId = b.dataset.step;
      paint();
    } else if (b.dataset.tempo) {
      const to = stats.opts.bpm + Number(b.dataset.tempo) * Trill.TEMPO.step;
      stats.opts.bpm = Math.min(Trill.TEMPO.max, Math.max(Trill.TEMPO.min, to));
      save();
      paint();
    } else if (b.dataset.act === 'start' || b.dataset.act === 'again') {
      if (b.dataset.act === 'again' && last) stepId = last.step.id;
      start();
    } else if (b.dataset.act === 'next') {
      stepId = b.dataset.next;
      start();
    } else if (b.dataset.act === 'stop') {
      stopRun();
      panel = 'pick';
      paint();
    } else if (b.dataset.act === 'change') {
      stepId = null;
      panel = 'pick';
      paint();
    }
  });

  root.addEventListener('change', (ev) => {
    const box = ev.target.closest('input[data-opt]');
    if (!box || !stats) return;
    stats.opts[box.dataset.opt] = box.checked;
    save();
  });

  window.addEventListener('resize', () => {
    if (run && run.canvas && panel === 'play') sizeCanvas();
  });

  return {
    open() {
      stats = Trill.loadStats(deps.profileId());
      stepId = null;
      if (panel !== 'pick') panel = 'pick';
      paint();
    },
    stop() {
      if (run) {
        stopRun();
        panel = 'pick';
      }
    },
    frame,
    get listening() {
      return listening;
    },
  };
}
