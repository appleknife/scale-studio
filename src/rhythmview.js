// rhythmview.js — the call-and-response rhythm screen. The rules are rhythm.js;
// this file draws the bar, keeps the clock and listens.
//
// The sounds are made with oscillators and the screen is drawn here; no
// recording is shipped and nothing comes in from outside the repo.
//
// The cycle is short and fixed: two bars of count-in, the bar you hear, the bar
// you answer, then the verdict. Nothing changes length with the pattern, so the
// page never surprises the player between the example and their turn.
//
// Two inputs, one timestamp. The microphone hears the bow catch the string; the
// pad (or Space) is there for a device without a microphone, and for working on
// the rhythm away from the instrument. Both are stamped on the audio clock, so
// the judge never sees two different clocks.

import * as Rhythm from './rhythm.js?v=202611261400';
import { t } from './i18n.js?v=202611261400';

const STRINGS = [
  { id: 'G3', name: 'G', freq: 196 },
  { id: 'D4', name: 'D', freq: 293.66 },
  { id: 'A4', name: 'A', freq: 440 },
  { id: 'E5', name: 'E', freq: 659.25 },
];

const LEAD = 0.35; // a breath after Start
const COUNT_IN_BARS = 2;
const RESULT_PAUSE = 1.6; // seconds the verdict stays before the next bar
const RETRIES = 4;
const ESC = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const ICON_CHECK =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
const ICON_LOCK =
  '<svg class="rhythm-lock" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>';

export function createRhythmView(deps) {
  const root = deps.root;
  let stats = Rhythm.loadStats(deps.profileId());
  let panel = 'ladder'; // 'ladder' | 'play' | 'done' | 'calibrate'
  let stage = Rhythm.stageById(stats.stage);
  let pool = null;
  let session = null;
  let ticket = 0;
  let raf = 0;
  let pollTimer = 0;
  let analyser = null;
  let source = null;
  let listening = false;
  let lastResult = null;
  let calib = null;

  root.innerHTML = `
    <button class="back-btn" type="button" data-act="back"><span aria-hidden="true">←</span> ${t('rhythm.back')}</button>
    <div class="head-row rhythm-head">
      <div>
        <h2>${t('rhythm.title')}</h2>
        <p class="subtle rhythm-lead">${t('rhythm.lead')}</p>
      </div>
    </div>
    <div class="rhythm-body"></div>`;
  const body = root.querySelector('.rhythm-body');
  body.addEventListener('pointerdown', onPad);

  /* ── Small helpers ───────────────────────────────────────────────────── */

  const save = () => Rhythm.saveStats(deps.profileId(), stats);
  const stageName = (id) => t(`rhythm.stage.${id}`);
  const stageDesc = (id) => t(`rhythm.stage.${id}.desc`);
  const accuracy = () => Rhythm.ACCURACY_BY_ID.get(stats.accuracy) || Rhythm.ACCURACY_BY_ID.get('normal');
  const stringNow = () => STRINGS.find((s) => s.id === stats.string) || STRINGS[1];
  const latency = () => (stats.latency == null ? defaultLatency() : stats.latency / 1000);

  function defaultLatency() {
    const ctx = deps.audio?.()?.ctx;
    return (Number(ctx?.outputLatency) || 0) + (Number(ctx?.baseLatency) || 0);
  }

  function levelsFor(stageId) {
    return stats.levels[stageId] || {};
  }

  function poolFor(stageId, fresh = false) {
    const stageNow = Rhythm.stageById(stageId);
    const seed = fresh || !stats.pools[stageId] ? Math.floor(Math.random() * 2 ** 31) : stats.pools[stageId];
    stats.pools[stageId] = seed;
    const weak = stats.focus ? stats.weak[stageId] || {} : {};
    const built = Rhythm.makePool(stageId, seed, weak);
    const levels = (stats.levels[stageId] = stats.levels[stageId] || {});
    for (const p of built) if (levels[p.sig] == null) levels[p.sig] = 0;
    save();
    return { stage: stageNow, pool: built };
  }

  function ensurePool(stageId, fresh = false) {
    if (pool && !fresh && stage.id === stageId && pool.length) return pool;
    const made = poolFor(stageId, fresh);
    stage = made.stage;
    pool = made.pool;
    return pool;
  }

  /* ── The ladder ──────────────────────────────────────────────────────── */

  function paintLadder() {
    if (stats.stage) stage = Rhythm.stageById(stats.stage);
    ensurePool(stage.id);
    const open = Rhythm.unlockedStages(stats);
    const levels = levelsFor(stage.id);
    const done = Rhythm.stageDone(pool, levels);
    const cleared = new Set(stats.cleared || []);
    const dotsFor = (id) => {
      const lv = levelsFor(id);
      return (stats.pools[id] ? Rhythm.makePool(id, stats.pools[id], {}) : []).map((p) => {
        const level = lv[p.sig] || 0;
        return `<span class="rhythm-dot${level >= 2 ? ' is-mastered' : level === 1 ? ' is-half' : level < 0 ? ' is-weak' : ''}"></span>`;
      }).join('');
    };
    const rows = Rhythm.RHYTHM_STAGES.map((s) => {
      const isOpen = open[s.index];
      const isClear = cleared.has(s.id);
      const on = s.id === stage.id;
      const dots = dotsFor(s.id);
      return `<button class="rhythm-stage${on ? ' is-on' : ''}${isClear ? ' is-clear' : ''}${isOpen ? '' : ' is-locked'}" type="button" data-stage="${s.id}" ${isOpen ? '' : 'disabled'}>
        <span class="rhythm-stage-n">${isClear ? ICON_CHECK : s.index + 1}</span>
        <span class="rhythm-stage-text"><b>${stageName(s.id)}</b><span>${stageDesc(s.id)}</span></span>
        <span class="rhythm-stage-side">${isClear ? '' : isOpen ? `<span class="rhythm-dots">${dots}</span>` : ICON_LOCK}</span>
      </button>`;
    }).join('');

    const tempo = Rhythm.tempoFor(stats, stage);
    body.innerHTML = `
      <section class="rhythm-card">
        <div class="rhythm-card-head">
          <span class="rhythm-rung-badge" aria-hidden="true"><b>${stage.index + 1}</b><i>/ ${Rhythm.RHYTHM_STAGES.length}</i></span>
          <div class="rhythm-card-title">
            <span class="rhythm-eyebrow">${t('rhythm.stage.label')} ${stage.index + 1}</span>
            <h3>${stageName(stage.id)}</h3>
          </div>
        </div>
        <p class="rhythm-stage-desc">${stageDesc(stage.id)}</p>
        <div class="rhythm-meter-row">
          <div class="rhythm-stepper" role="group" aria-label="${t('rhythm.tempo', { bpm: tempo })}">
            <button type="button" data-tempo="-4" aria-label="${t('rhythm.slower')}">−</button>
            <span class="rhythm-tempo"><b>${tempo}</b><small>${t('rhythm.bpm')}</small></span>
            <button type="button" data-tempo="4" aria-label="${t('rhythm.faster')}">+</button>
          </div>
          <div class="segmented small rhythm-accuracy" role="group" aria-label="${t('rhythm.accuracy')}">
            ${Rhythm.ACCURACY.map(
              (a) => `<button type="button" data-accuracy="${a.id}" aria-selected="${stats.accuracy === a.id}">${t(`rhythm.acc.${a.id}`)}</button>`,
            ).join('')}
          </div>
        </div>
        <p class="rhythm-note">${t('rhythm.target', { strings: STRINGS.map((s) => s.name).join(' · ') })}</p>
        <div class="chip-row rhythm-strings">
          ${STRINGS.map(
            (s) => `<button class="chip" type="button" data-string="${s.id}" aria-pressed="${stringNow().id === s.id}">${t('rhythm.onString', { s: s.name })}</button>`,
          ).join('')}
        </div>
        <div class="rhythm-progress-row">
          <div class="rhythm-dots rhythm-progress" aria-hidden="true">${dotsFor(stage.id)}</div>
          <p class="rhythm-progress-line">${done ? t('rhythm.stage.done') : t('rhythm.stage.progress', { done: pool.filter((p) => (levels[p.sig] || 0) >= 2).length, n: pool.length })}</p>
        </div>
        <div class="rhythm-actions">
          <button class="primary-btn" type="button" data-act="start">${done ? t('rhythm.start.stretch') : t('rhythm.start')}</button>
          <button class="quiet-btn" type="button" data-act="reroll">${t('rhythm.reroll')}</button>
          <button class="quiet-btn" type="button" data-act="calibrate">${t('rhythm.calibrate')}${stats.latency == null ? '' : ` (${Math.round(stats.latency)} ms)`}</button>
        </div>
      </section>
      <div class="rhythm-ladder" role="list">${rows}</div>
      <label class="switch-row rhythm-focus"><input type="checkbox" data-opt="focus" ${stats.focus ? 'checked' : ''}/>
        <span><b>${t('rhythm.focus')}</b><span class="switch-sub">${t('rhythm.focus.sub')}</span></span></label>
      <label class="switch-row"><input type="checkbox" data-opt="metronome" ${stats.metronome !== false ? 'checked' : ''}/>
        <span><b>${t('rhythm.metronome')}</b><span class="switch-sub">${t('rhythm.metronome.sub')}</span></span></label>
      <details class="hear-note">
        <summary>${t('rhythm.about.title')}</summary>
        <p>${t('rhythm.about.body')}</p>
      </details>`;
  }

  /* ── The bar ─────────────────────────────────────────────────────────── */

  // Pixels per tick for the bar on screen: as wide as the lane allows (so the
  // bar fills it, on a phone or a tablet), never cramped, never sprawling.
  let col = 22;
  function fitCol(per) {
    const lane = root.querySelector('.rhythm-lane');
    const room = lane ? lane.clientWidth - 22 : 0;
    col = room > 0 ? Math.max(14, Math.min(64, (room - 8) / per)) : 22;
    return col;
  }

  /** Where tick `ticks` of the bar sits, in pixels from the lane's left edge. */
  function laneX(ticks) {
    const svgEl = root.querySelector('.rhythm-strip');
    const scroll = root.querySelector('.rhythm-scroll');
    const left = (svgEl?.offsetLeft || 0) - (scroll?.scrollLeft || 0);
    return left + 4 + ticks * col;
  }

  function strip(pattern, { reveal = false } = {}) {
    const per = pattern.perBar;
    const COL = col;
    const width = per * COL + 8;
    const height = 138;
    const top = 44;
    const bows = Rhythm.bowPlan(pattern);
    const parts = [];
    const felt = Rhythm.ticksPerBeat(pattern.meter);
    for (let beat = 0; beat < Rhythm.METERS[pattern.meter].beats; beat++) {
      const at = beat * felt * COL + 4;
      parts.push(`<line class="rhythm-beatline" x1="${at}" y1="18" x2="${at}" y2="116"/>`);
      parts.push(`<text class="rhythm-beatnum" x="${at + 2}" y="134">${beat + 1}</text>`);
    }
    parts.push(`<line class="rhythm-barline" x1="${width - 4}" y1="18" x2="${width - 4}" y2="116"/>`);
    for (const e of pattern.events) {
      const x = 4 + e.start * COL;
      const w = Math.max(3, e.dur * COL - 2);
      if (e.rest) {
        parts.push(`<rect class="rhythm-rest" x="${x + 2}" y="${top + 12}" width="${Math.max(4, w - 4)}" height="24" rx="5"/>`);
        continue;
      }
      parts.push(`<g class="rhythm-note-g" data-at="${e.start}">`);
      parts.push(`<rect class="rhythm-slot" x="${x}" y="${top + 6}" width="${w}" height="36" rx="9"/>`);
      parts.push(`<ellipse class="rhythm-notehead" cx="${x + 10}" cy="${top + 30}" rx="5.6" ry="4.1" transform="rotate(-20 ${x + 10} ${top + 30})"/>`);
      parts.push(`<line class="rhythm-stem" x1="${x + 15.2}" y1="${top + 29}" x2="${x + 15.2}" y2="${top + 11}"/>`);
      parts.push(`<text class="rhythm-verdict-tag" x="${x + 4}" y="${top + 60}"></text>`);
      parts.push(`</g>`);
      const bow = bows.get(e.start);
      if (bow) parts.push(`<path class="rhythm-bow" d="${bow === 'down' ? `M${x + 4} ${top - 11} h11 v6 M${x + 4} ${top - 11} v6 M${x + 15} ${top - 11} v6` : `M${x + 4} ${top - 4} L${x + 9.5} ${top - 13} L${x + 15} ${top - 4}`}"/>`);
    }
    return `<svg class="rhythm-strip${reveal ? ' is-reveal' : ''}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${t('rhythm.strip.aria')}">${parts.join('')}</svg>`;
  }

  function resultMarks(features) {
    return features
      .filter((f) => f.status !== 'ok')
      .map((f) => {
        const label = f.status === 'missed' ? t('rhythm.mark.missed') : f.status === 'extra' ? t('rhythm.mark.extra') : t(`rhythm.mark.${f.status}`);
        return `<span class="rhythm-mark is-${f.status}">${label} · ${t('rhythm.mark.beat', { n: beatName(session.meter, f.target) })}</span>`;
      })
      .join('');
  }

  function beatName(meter, ticks) {
    const per = Rhythm.METERS[meter].perBar / Rhythm.METERS[meter].beats;
    const beat = Math.floor(ticks / per) + 1;
    const part = Math.round(((ticks % per) / per) * 4);
    return part === 0 ? String(beat) : t('rhythm.beat.and', { n: beat, p: ['', 'e', '&', 'a'][part] || part });
  }

  /* ── Sound ───────────────────────────────────────────────────────────── */

  function ctxNow() {
    return deps.audio?.()?.ctx?.currentTime ?? 0;
  }

  function tick(when, kind = 'soft', metronome = false) {
    const audio = deps.audio?.();
    const ctx = audio?.ctx;
    const out = audio?.out;
    if (!ctx || !out) return null;
    const at = Math.max(ctx.currentTime, when);
    const gain = ctx.createGain();
    const peak = metronome ? (kind === 'accent' ? 0.2 : 0.11) : kind === 'accent' ? 0.24 : kind === 'beat' ? 0.16 : 0.1;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + (metronome ? 0.07 : 0.09));
    gain.connect(out);
    const osc = ctx.createOscillator();
    osc.type = metronome ? 'sine' : 'triangle';
    osc.frequency.value = metronome ? (kind === 'accent' ? 1550 : 1120) : kind === 'accent' ? 880 : kind === 'beat' ? 640 : 510;
    osc.connect(gain);
    osc.start(at);
    osc.stop(at + 0.1);
    if (!metronome) {
      const noise = ctx.createBufferSource();
      const len = Math.max(1, Math.floor(ctx.sampleRate * 0.03));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
      const ng = ctx.createGain();
      ng.gain.value = kind === 'accent' ? 0.16 : 0.1;
      noise.buffer = buf;
      noise.connect(ng).connect(gain);
      noise.start(at);
    }
    session?.nodes?.push(osc);
    return osc;
  }

  function patternKind(event) {
    const at = event.start % session.pattern.perBar;
    if (at === 0 || (session.pattern.perBar === 16 && at === 8)) return 'accent';
    if (at % 4 === 0) return 'beat';
    return 'soft';
  }

  /* ── Microphone ──────────────────────────────────────────────────────── */

  let voicedAt = 0;
  let lastBlock = 0;

  function ensureAnalyser() {
    if (analyser || !deps.getMic) return;
    const mic = deps.getMic();
    const ctx = mic?.ctx;
    if (!ctx || !mic.stream) return;
    source = ctx.createMediaStreamSource(mic.stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let y = [0, 0, 0];
    let px = [0, 0, 0];
    let prevHi = 0;
    let pending = null;
    let lastPoll = 0;
    const recent = [];
    const a = 1 / (1 + (2 * Math.PI * 6000) / ctx.sampleRate);
    lastBlock = 0;
    clockGaps.length = 0;
    pollTimer = setInterval(() => {
      if (!session || !listening) return;
      const now = ctx.currentTime;
      // Only the samples that arrived since the last look. The analyser hands
      // back its whole window every time, and filtering that window again on
      // each poll ran the filter across a jump back in time: a spike every
      // 5 ms, which a held note turned into a stream of phantom bow changes.
      const fresh = Math.min(buf.length, Math.round((now - lastPoll) * ctx.sampleRate));
      if (lastPoll && fresh <= 0) return;
      const n = lastPoll ? fresh : 256;
      lastPoll = now;
      noteClock(now);
      analyser.getFloatTimeDomainData(buf);
      const from = buf.length - n;
      let rms = 0;
      let hi = 0;
      for (let i = from; i < buf.length; i++) {
        let x = buf[i];
        for (let p = 0; p < 3; p++) {
          y[p] = a * (y[p] + x - px[p]);
          px[p] = x;
          x = y[p];
        }
        rms += buf[i] * buf[i];
        hi += x * x;
      }
      rms = Math.sqrt(rms / n);
      hi = Math.sqrt(hi / n);
      recent.push(hi);
      if (recent.length > 120) recent.shift();
      const sorted = [...recent].sort((m, k) => m - k);
      const floor = sorted[sorted.length >> 1] || 1e-9;
      const flux = Math.max(0, hi - prevHi) / (floor + 1e-9);
      prevHi = hi;
      const micNow = deps.getMic();
      const gate = Math.max(0.008, (micNow?.floor || 0.0012) * 7);
      // The answer window, on the speaker's clock, moved by the delay between a
      // click leaving and the student's note reaching the microphone.
      const heard = toPlayer(now);
      const late = latency();
      const inAnswer = heard > session.answerAt + late - 0.08 && heard < session.answerEnd + late + 0.12;
      if (inAnswer && rms > gate && flux > 1.5 && now - lastBlock > 0.065) {
        lastBlock = now;
        pending = { at: now, time: now - n / ctx.sampleRate / 2 };
      }
      // A bow change is a broadband transient, so wait for the pitched frame
      // that follows it before calling it playing. That keeps the click track
      // (also a transient, but not a note) out of the answer.
      if (pending) {
        if (voicedAt >= pending.time - 0.06) {
          addOnset(toPlayer(pending.time));
          pending = null;
        } else if (now - pending.at > 0.16) {
          pending = null;
        }
      }
    }, 5);
  }

  /* The microphone and the speaker are two audio contexts with two clocks that
     started at different moments. Everything the exercise schedules is on the
     speaker's; what the microphone hears is moved onto it here, by the median
     gap between the two clocks read side by side. */
  const clockGaps = [];
  function noteClock(micNow) {
    const play = deps.audio?.()?.ctx;
    if (!play) return;
    clockGaps.push(play.currentTime - micNow);
    if (clockGaps.length > 61) clockGaps.shift();
  }
  function toPlayer(micTime) {
    if (!clockGaps.length) return micTime;
    const sorted = [...clockGaps].sort((m, k) => m - k);
    return micTime + sorted[sorted.length >> 1];
  }

  function stopAnalyser() {
    clearInterval(pollTimer);
    pollTimer = 0;
    try {
      source?.disconnect();
    } catch {
      /* already gone */
    }
    source = null;
    analyser = null;
  }

  /* ── Play ────────────────────────────────────────────────────────────── */

  function start(fresh = false) {
    if (listening) stopSession();
    const mine = (ticket += 1);
    panel = 'play';
    stage = Rhythm.stageById(stats.stage);
    if (fresh || (pool && Rhythm.stageDone(pool, levelsFor(stage.id)))) {
      stats.levels[stage.id] = {};
      fresh = true;
    }
    pool = ensurePool(stage.id, fresh);
    const levels = levelsFor(stage.id);
    const last = session?.lastSig || null;
    const pattern = Rhythm.chooseNext(pool, levels, last);
    const bpm = Rhythm.tempoFor(stats, stage);
    session = {
      pattern,
      bpm,
      meter: pattern.meter,
      secTick: 60 / bpm / Rhythm.ticksPerBeat(pattern.meter),
      phase: 'wait',
      onsets: [],
      nodes: [],
      retries: {},
      lastSig: pattern.sig,
      streak: 0,
      failStreak: 0,
      answers: 0,
      passes: 0,
      judged: false,
      tapped: false,
    };
    listening = true;
    paintPlay();
    begin(mine);
  }

  async function begin(mine) {
    const audio = deps.audio?.();
    if (audio?.ctx?.state === 'suspended') audio.ctx.resume().catch(() => {});
    let mic = null;
    if (stats.input !== 'tap') {
      try {
        mic = await deps.openMic();
      } catch (err) {
        if (mine !== ticket) return;
        stats.input = 'tap';
        save();
        showHint(deps.micError(err));
      }
    }
    if (mine !== ticket || !session) return;
    ensureAnalyser();
    const ctx = audio?.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + LEAD;
    const barSec = session.secTick * Rhythm.METERS[session.meter].perBar;
    const countTicks = COUNT_IN_BARS * Rhythm.METERS[session.meter].perBar;
    session.t0 = t0;
    session.exampleAt = t0 + countTicks * session.secTick;
    session.answerAt = session.exampleAt + session.pattern.ticks * session.secTick;
    session.answerEnd = session.answerAt + session.pattern.ticks * session.secTick;
    // the last note reaches the microphone a speaker-delay after it is due
    session.judgeAt = session.answerEnd + latency() + 0.2;

    // Count-in: the felt beats of two bars, accented on each bar.
    for (let bar = 0; bar < COUNT_IN_BARS; bar++) {
      const beats = Rhythm.METERS[session.meter].beats;
      for (let b = 0; b < beats; b++) {
        tick(t0 + (bar * Rhythm.METERS[session.meter].perBar + b * Rhythm.ticksPerBeat(session.meter)) * session.secTick, b === 0 ? 'accent' : 'beat', true);
      }
    }
    if (stats.metronome !== false) {
      const clickTicks = Rhythm.ticksPerBeat(session.meter);
      for (let k = 0; k < session.pattern.ticks; k += clickTicks) {
        tick(session.answerAt + k * session.secTick, 'beat', true);
      }
    }
    for (const event of session.pattern.events) {
      if (event.rest) continue;
      tick(session.exampleAt + event.start * session.secTick, patternKind(event), false);
    }
    session.phase = 'countin';
    raf = requestAnimationFrame(frameTick);
    if (barSec < 0.4) showHint(t('rhythm.hint.slow'));
  }

  function frameTick() {
    if (!session || !listening) return;
    const ctx = deps.audio?.()?.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const phase = now < session.exampleAt ? 'countin' : now < session.answerAt ? 'example' : now < session.answerEnd ? 'answer' : 'verdict';
    if (phase !== session.phase) {
      session.phase = phase;
      root.querySelector('.rhythm-lane')?.setAttribute('data-phase', phase);
      root.querySelectorAll('[data-steps] li').forEach((li) => {
        const order = ['countin', 'example', 'answer', 'verdict'];
        const at = order.indexOf(phase);
        const mine = order.indexOf(li.dataset.step);
        li.classList.toggle('is-now', mine === at);
        li.classList.toggle('is-past', mine < at);
      });
      const status = root.querySelector('[data-status]');
      if (status) {
        status.textContent = phase === 'countin' ? t('rhythm.phase.countin') : phase === 'example' ? t('rhythm.phase.listen') : phase === 'answer' ? t('rhythm.phase.play') : t('rhythm.phase.judge');
        status.className = `rhythm-status is-${phase}`;
      }
    }
    paintPulse(now);
    const stripEl = root.querySelector('.rhythm-strip');
    const line = root.querySelector('.rhythm-playhead');
    if (line && stripEl) {
      const at = session.phase === 'answer' || session.phase === 'verdict' ? session.answerAt : session.exampleAt;
      const ticks = (now - at) / session.secTick;
      // on the bar's own grid, so it crosses each note as it sounds
      line.style.left = `${laneX(clamp(ticks, -0.5, session.pattern.ticks + 0.5)).toFixed(1)}px`;
    }
    if (!session.judged && now >= session.judgeAt) {
      finishAnswer();
      return;
    }
    raf = requestAnimationFrame(frameTick);
  }

  /** The beat lights, the big count-in numbers, and the note that is sounding. */
  function paintPulse(now) {
    const meter = Rhythm.METERS[session.meter];
    const tpb = Rhythm.ticksPerBeat(session.meter);
    let ticks;
    if (now < session.exampleAt) ticks = (now - session.t0) / session.secTick;
    else if (now < session.answerAt) ticks = (now - session.exampleAt) / session.secTick;
    else ticks = (now - session.answerAt) / session.secTick;
    const inBar = ((ticks % meter.perBar) + meter.perBar) % meter.perBar;
    const beat = ticks < 0 || session.phase === 'verdict' ? -1 : Math.floor(inBar / tpb);
    if (beat !== session.beatShown) {
      session.beatShown = beat;
      root.querySelectorAll('[data-beats] i').forEach((el, i) => {
        el.classList.toggle('is-on', i === beat);
        el.classList.toggle('is-down', i === beat && i === 0);
      });
      const count = root.querySelector('[data-count]');
      if (count) {
        // Count-in: the beats of the last bar are counted out loud, big.
        const show = session.phase === 'countin' && beat >= 0;
        count.textContent = show ? String(beat + 1) : '';
        count.classList.remove('is-pop');
        if (show) {
          void count.offsetWidth;
          count.classList.add('is-pop');
        }
      }
    }
    // the note under the playhead lights as it sounds (example) or is due (answer)
    if (session.phase === 'example' || session.phase === 'answer') {
      let lit = null;
      for (const e of session.pattern.events) if (!e.rest && ticks >= e.start && ticks < e.start + e.dur) lit = e.start;
      if (lit !== session.litShown) {
        session.litShown = lit;
        root.querySelectorAll('.rhythm-note-g').forEach((g) => g.classList.toggle('is-lit', Number(g.dataset.at) === lit));
      }
    } else if (session.litShown != null) {
      session.litShown = null;
      root.querySelectorAll('.rhythm-note-g.is-lit').forEach((g) => g.classList.remove('is-lit'));
    }
  }

  function addOnset(time) {
    if (!session || session.judged) return;
    const start = session.answerAt;
    const ticks = (time - start) / session.secTick - latency() / session.secTick;
    if (ticks < -1 || ticks > session.pattern.ticks + 1) return;
    session.onsets.push(ticks);
    const dot = document.createElement('span');
    dot.className = 'rhythm-onset';
    dot.style.left = `${(laneX(clamp(ticks, 0, session.pattern.ticks)) - 4.5).toFixed(1)}px`;
    root.querySelector('.rhythm-lane')?.append(dot);
    setTimeout(() => dot.remove(), 900);
  }

  function onPad(event) {
    const node = event.target?.closest ? event.target : null;
    const pad = node?.closest?.('[data-pad]');
    if (pad) {
      pad.classList.remove('is-hit');
      void pad.offsetWidth;
      pad.classList.add('is-hit');
    }
    if (panel === 'calibrate' && calib && !calib.done) {
      if (node?.closest('button') && !node.closest('[data-pad]')) return;
      event.preventDefault();
      calib.taps.push(ctxNow());
      const status = root.querySelector('[data-calib-status]');
      if (status) status.textContent = t('rhythm.calibrate.listening', { n: calib.taps.length });
      return;
    }
    if (!session || !listening) return;
    if (node?.closest('button, input, summary, label') && !node.closest('[data-pad]')) return;
    // By the clock, not the screen's phase: the screen turns to "Your turn" on
    // the next frame, and a tap a hair early on beat one (as most are) was lost.
    const now = ctxNow();
    const beat = session.secTick * Rhythm.ticksPerBeat(session.meter);
    if (now < session.answerAt - beat * 0.45 || now > session.answerEnd + latency() + 0.15) return;
    event.preventDefault();
    session.tapped = true;
    addOnset(now);
  }

  function finishAnswer() {
    if (!session || session.judged) return;
    session.judged = true;
    const pattern = session.pattern;
    const result = Rhythm.judge(
      pattern.attacks.map((e) => e.start),
      session.onsets,
      { strict: pattern.strict, ticksPerBeat: Rhythm.ticksPerBeat(pattern.meter), coeff: accuracy().coeff },
    );
    lastResult = result;
    session.lastClean = result.clean;
    session.answers++;
    if (result.clean) {
      session.passes++;
      session.streak++;
      session.failStreak = 0;
    } else {
      session.streak = 0;
      session.failStreak++;
      for (const figure of pattern.figures) {
        stats.weak[stage.id] = stats.weak[stage.id] || {};
        stats.weak[stage.id][figure] = (stats.weak[stage.id][figure] || 0) + 1;
      }
    }
    const levels = levelsFor(stage.id);
    levels[pattern.sig] = Rhythm.bumpLevel(levels[pattern.sig] || 0, result.clean);
    stats.streak = result.clean ? (stats.streak || 0) + 1 : 0;
    stats.bestStreak = Math.max(stats.bestStreak || 0, stats.streak);
    stats.tempo[stage.id] = Rhythm.tempoAfter(session.bpm, stage, {
      clean: result.clean,
      streak: session.streak,
      failStreak: session.failStreak,
    });
    stats.runs.push({ at: Date.now(), stage: stage.id, clean: result.clean, missed: result.missed, extra: result.extra, bad: result.bad });
    if (stats.runs.length > 400) stats.runs = stats.runs.slice(-400);
    save();
    const card = root.querySelector('.rhythm-card');
    card?.classList.add(result.clean ? 'is-clean' : 'is-fail');
    // Each note says how it went, on the bar itself.
    for (const f of result.features) {
      const g = root.querySelector(`.rhythm-note-g[data-at="${f.target}"]`);
      if (!g) continue;
      g.classList.add(`is-${f.status}`);
      const tag = g.querySelector('.rhythm-verdict-tag');
      if (tag) tag.textContent = f.status === 'ok' ? '✓' : f.status === 'missed' ? t('rhythm.mark.missed') : t(`rhythm.mark.${f.status}`);
    }
    const badge = root.querySelector('[data-badge]');
    if (badge) {
      badge.textContent = result.clean ? '✓' : result.empty ? '?' : '↺';
      badge.className = `rhythm-badge is-show ${result.clean ? 'is-good' : 'is-bad'}`;
    }
    deps.cheer?.(result.clean);
    const status = root.querySelector('[data-status]');
    if (status) {
      status.textContent = result.clean ? t('rhythm.verdict.clean') : result.empty ? t('rhythm.verdict.empty') : t('rhythm.verdict.again');
      status.className = `rhythm-status ${result.clean ? 'is-good' : 'is-bad'}`;
    }
    const marks = root.querySelector('[data-marks]');
    if (marks) marks.innerHTML = result.clean ? `<span class="rhythm-mark is-ok">${t('rhythm.mark.all')}</span>` : resultMarks(result.features);
    const lane = root.querySelector('.rhythm-lane');
    for (const f of result.features) {
      if (f.status === 'ok' || f.status === 'missed') continue;
      const dot = document.createElement('span');
      dot.className = `rhythm-feature is-${f.status}`;
      dot.style.left = `${laneX(clamp(f.onset, 0, pattern.ticks)).toFixed(1)}px`;
      lane?.append(dot);
    }
    const timing = Math.round(Math.abs(result.drift) * session.secTick * 1000);
    // The average only means something over the notes that landed.
    const landed = result.features.filter((f) => f.status === 'ok').length;
    if (marks && !result.clean && result.bad && landed && timing >= 15) {
      marks.innerHTML += `<span class="rhythm-drift">${t('rhythm.drift', { n: timing })}</span>`;
    }
    clearTimeout(session.timer);
    // In milliseconds. Once written as seconds (1.5 ms), which wiped the
    // verdict before anyone could see it; a miss stays up longer, to be read.
    session.timer = setTimeout(next, (result.clean ? RESULT_PAUSE : RESULT_PAUSE + 0.9) * 1000);
  }

  function next() {
    if (!session) return;
    const levels = levelsFor(stage.id);
    if (Rhythm.stageDone(pool, levels)) return stageClear();
    const pattern = session.pattern;
    const retry = !session.lastClean && (session.retries[pattern.sig] || 0) < RETRIES;
    if (retry) session.retries[pattern.sig] = (session.retries[pattern.sig] || 0) + 1;
    else session.retries[pattern.sig] = 0;
    const nextPattern = retry ? pattern : Rhythm.chooseNext(pool, levels, pattern.sig);
    session.lastSig = pattern.sig;
    const bpm = Rhythm.tempoFor(stats, stage);
    session = {
      ...session,
      pattern: nextPattern,
      bpm,
      meter: nextPattern.meter,
      secTick: 60 / bpm / Rhythm.ticksPerBeat(nextPattern.meter),
      onsets: [],
      nodes: [],
      phase: 'wait',
      judged: false,
      lastSig: nextPattern.sig,
      timer: 0,
    };
    paintPlay();
    begin((ticket += 1)).catch(() => {});
  }

  function stageClear() {
    if (!(stats.cleared || []).includes(stage.id)) stats.cleared = [...(stats.cleared || []), stage.id];
    stats.stage = stage.id;
    save();
    const finished = session;
    stopSession();
    stopAnalyser();
    if (stats.input !== 'tap') deps.closeMic?.();
    deps.onFinish?.(finished);
    lastResult = null;
    panel = 'done';
    paintDone();
  }

  function stopSession() {
    ticket += 1;
    listening = false;
    cancelAnimationFrame(raf);
    clearTimeout(session?.timer);
    for (const node of session?.nodes || []) {
      try {
        node.stop();
      } catch {
        /* not started, or done */
      }
    }
    session = null;
  }

  function paintPlay() {
    const pattern = session.pattern;
    const retries = session.retries[pattern.sig] || 0;
    body.innerHTML = `
      <section class="rhythm-card rhythm-play">
        <div class="rhythm-play-head">
          <div>
            <span class="rhythm-eyebrow">${stageName(stage.id)}</span>
            <h3>${pattern.meter} · ${t('rhythm.tempo', { bpm: session.bpm })}</h3>
          </div>
          <div class="segmented small">
            <button type="button" data-play-tempo="-4" aria-label="${t('rhythm.slower')}">−</button>
            <button type="button" data-play-tempo="4" aria-label="${t('rhythm.faster')}">+</button>
          </div>
        </div>
        <ol class="rhythm-steps" data-steps>
          <li data-step="countin">${t('rhythm.step.count')}</li>
          <li data-step="example">${t('rhythm.step.listen')}</li>
          <li data-step="answer">${t('rhythm.step.play')}</li>
          <li data-step="verdict">${t('rhythm.step.result')}</li>
        </ol>
        <p class="rhythm-status" data-status>${t('rhythm.phase.countin')}</p>
        <div class="rhythm-lane" data-phase="countin">
          <div class="rhythm-beats" data-beats>${Array.from({ length: Rhythm.METERS[pattern.meter].beats }, (_, i) => `<i data-b="${i}"></i>`).join('')}</div>
          <span class="rhythm-count" data-count aria-hidden="true"></span>
          <span class="rhythm-badge" data-badge aria-hidden="true"></span>
          <div class="rhythm-scroll">${strip(pattern, { reveal: true })}</div>
          <span class="rhythm-playhead"></span>
          <div class="rhythm-marks" data-marks>${retries ? t('rhythm.retry', { n: retries }) : ''}</div>
        </div>
        <button class="rhythm-pad" type="button" data-pad>
          <span class="rhythm-pad-icon" aria-hidden="true">◉</span>
          <span>${stats.input === 'tap' ? t('rhythm.tap.pad') : t('rhythm.tap.play')}</span>
        </button>
        <div class="rhythm-play-actions">
          <button class="quiet-btn" type="button" data-act="input">${stats.input === 'tap' ? t('rhythm.useMic') : t('rhythm.useTap')}</button>
          <button class="quiet-btn" type="button" data-act="end">${t('rhythm.end')}</button>
        </div>
        <p class="rhythm-hint" data-hint>${stats.input === 'tap' ? t('rhythm.hint.tap') : t('rhythm.hint.mic', { s: stringNow().name })}</p>
        <div class="rhythm-live-meter" aria-hidden="true"><span></span></div>
      </section>`;
    fitCol(pattern.perBar);
    const scroll = root.querySelector('.rhythm-scroll');
    if (scroll) scroll.innerHTML = strip(pattern, { reveal: true });
  }

  function showHint(text) {
    const hint = root.querySelector('[data-hint]');
    if (hint) hint.textContent = text;
  }

  function paintDone() {
    const answers = stats.runs.filter((r) => r.stage === stage.id);
    const clean = answers.filter((r) => r.clean).length;
    const tempo = Rhythm.tempoFor(stats, stage);
    body.innerHTML = `
      <section class="rhythm-card rhythm-finish">
        <div class="rhythm-finish-burst" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--a:${i * 25.7}deg;--d:${(i % 4) * 0.05}s"></i>`).join('')}</div>
        <span class="rhythm-finish-medal" aria-hidden="true">${ICON_CHECK}</span>
        <span class="rhythm-eyebrow">${t('rhythm.done.eyebrow')}</span>
        <h3>${t('rhythm.done.title', { stage: stageName(stage.id) })}</h3>
        <p class="rhythm-finish-body">${t('rhythm.done.body')}</p>
        <div class="rhythm-finish-stats">
          <span><b>${clean}</b>${t('rhythm.done.clean')}</span>
          <span><b>${stats.bestStreak || 0}</b>${t('rhythm.done.streak')}</span>
          <span><b>${tempo}</b>${t('rhythm.bpm')}</span>
        </div>
        <div class="rhythm-actions">
          <button class="primary-btn" type="button" data-act="next-stage">${t('rhythm.done.next')}</button>
          <button class="quiet-btn" type="button" data-act="ladder">${t('rhythm.done.ladder')}</button>
        </div>
      </section>`;
  }

  /* ── Calibration ─────────────────────────────────────────────────────── */

  function openCalibrate() {
    panel = 'calibrate';
    calib = { clicks: [], taps: [], done: false };
    const audio = deps.audio?.();
    if (audio?.ctx?.state === 'suspended') audio.ctx.resume().catch(() => {});
    const ctx = audio?.ctx;
    const t0 = (ctx?.currentTime || 0) + 0.7;
    for (let i = 0; i < 8; i++) {
      const at = t0 + i * 0.6;
      calib.clicks.push(at);
      tick(at, i % 4 === 0 ? 'accent' : 'beat', true);
    }
    paintCalibrate();
    // milliseconds: this was once written as seconds, which showed the result
    // before the first click had sounded
    calib.timer = setTimeout(calibResult, (0.7 + 8 * 0.6 + 0.5) * 1000);
    calib.t0 = t0;
    const light = () => {
      if (!calib || calib.done || panel !== 'calibrate') return;
      const now = ctxNow();
      const i = Math.floor((now - calib.t0) / 0.6 + 0.0001);
      root.querySelectorAll('[data-calib-beats] i').forEach((el, k) => {
        el.classList.toggle('is-on', k === i && now - (calib.t0 + k * 0.6) < 0.18);
        el.classList.toggle('is-past', k < i);
      });
      requestAnimationFrame(light);
    };
    requestAnimationFrame(light);
  }

  function paintCalibrate() {
    body.innerHTML = `
      <section class="rhythm-card rhythm-calibrate">
        <span class="rhythm-eyebrow">${t('rhythm.calibrate.title')}</span>
        <p>${t('rhythm.calibrate.body')}</p>
        <div class="rhythm-beats rhythm-calib-beats" data-calib-beats>${'<i></i>'.repeat(8)}</div>
        <button class="rhythm-pad" type="button" data-pad><span class="rhythm-pad-icon" aria-hidden="true">◉</span><span>${t('rhythm.calibrate.tap')}</span></button>
        <p class="rhythm-status" data-calib-status>${t('rhythm.calibrate.listening', { n: calib.taps.length })}</p>
        <div class="rhythm-actions"><button class="quiet-btn" type="button" data-act="ladder">${t('rhythm.calibrate.cancel')}</button></div>
      </section>`;
  }

  function calibResult() {
    if (!calib) return;
    const offset = Rhythm.calibrationOffset(calib.clicks, calib.taps);
    calib.done = true;
    const value = offset == null ? Math.round(defaultLatency() * 1000) : Math.round(offset * 1000);
    body.innerHTML = `
      <section class="rhythm-card rhythm-calibrate">
        <span class="rhythm-eyebrow">${t('rhythm.calibrate.title')}</span>
        <p class="rhythm-calib-value">${offset == null ? t('rhythm.calibrate.none') : t('rhythm.calibrate.result', { n: value })}</p>
        <p class="rhythm-hint">${t('rhythm.calibrate.note')}</p>
        <div class="rhythm-actions">
          <button class="primary-btn" type="button" data-act="save-calib" data-value="${value}" ${offset == null ? 'disabled' : ''}>${t('rhythm.calibrate.save')}</button>
          <button class="quiet-btn" type="button" data-act="calibrate">${t('rhythm.calibrate.again')}</button>
          <button class="quiet-btn" type="button" data-act="ladder">${t('rhythm.calibrate.cancel')}</button>
        </div>
      </section>`;
  }

  /* ── Events ──────────────────────────────────────────────────────────── */

  function onClick(event) {
    const target = event.target.closest('[data-act], [data-stage], [data-tempo], [data-play-tempo], [data-accuracy], [data-string]');
    if (!target) return;
    if (target.dataset.stage) {
      if (!Rhythm.unlockedStages(stats)[Rhythm.RHYTHM_STAGES.findIndex((s) => s.id === target.dataset.stage)]) return;
      stats.stage = target.dataset.stage;
      stage = Rhythm.stageById(stats.stage);
      pool = null;
      save();
      paintLadder();
      return;
    }
    if (target.dataset.tempo) {
      stats.tempo[stage.id] = clamp(Rhythm.tempoFor(stats, stage) + Number(target.dataset.tempo), 40, stage.cap);
      save();
      paintLadder();
      return;
    }
    if (target.dataset.playTempo && session) {
      session.bpm = clamp(session.bpm + Number(target.dataset.playTempo), 40, stage.cap);
      stats.tempo[stage.id] = session.bpm;
      save();
      session.secTick = 60 / session.bpm / Rhythm.ticksPerBeat(session.meter);
      paintPlay();
      return;
    }
    if (target.dataset.accuracy) {
      stats.accuracy = target.dataset.accuracy;
      save();
      paintLadder();
      return;
    }
    if (target.dataset.string) {
      stats.string = target.dataset.string;
      save();
      paintLadder();
      return;
    }
    switch (target.dataset.act) {
      case 'back':
        goBack();
        break;
      case 'start':
        start(false);
        break;
      case 'reroll':
        start(true);
        break;
      case 'calibrate':
        openCalibrate();
        break;
      case 'save-calib':
        stats.latency = Number(target.dataset.value);
        save();
        panel = 'ladder';
        paintLadder();
        break;
      case 'input':
        stats.input = stats.input === 'tap' ? 'violin' : 'tap';
        save();
        if (session) {
          stopAnalyser();
          if (stats.input === 'violin') {
            deps.openMic().then(ensureAnalyser).catch((err) => {
              stats.input = 'tap';
              save();
              showHint(deps.micError(err));
            });
          }
          paintPlay();
        }
        break;
      case 'end':
        endSession();
        break;
      case 'ladder':
        clearTimeout(calib?.timer);
        calib = null;
        panel = 'ladder';
        paintLadder();
        break;
      case 'next-stage': {
        const id = Rhythm.nextStageId(stats);
        if (id) {
          stats.stage = id;
          stage = Rhythm.stageById(id);
          pool = null;
          save();
        }
        panel = 'ladder';
        paintLadder();
        break;
      }
      default:
        break;
    }
  }

  function onKey(event) {
    if (panel !== 'play' || !session) {
      if (event.key === 'Escape' && panel !== 'ladder') {
        clearTimeout(calib?.timer);
        calib = null;
        panel = 'ladder';
        paintLadder();
      }
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      if (event.repeat) return; // a held key is one attack, not a drum roll
      if (event.target.closest('button, input, textarea, summary')) return;
      event.preventDefault();
      onPad(event);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      endSession();
    }
  }

  function onChange(event) {
    if (event.target.dataset.opt === 'focus') {
      stats.focus = event.target.checked;
      save();
    }
    if (event.target.dataset.opt === 'metronome') {
      stats.metronome = event.target.checked;
      save();
    }
  }

  function endSession() {
    const answered = session?.answers || 0;
    stopSession();
    stopAnalyser();
    if (stats.input !== 'tap') deps.closeMic?.();
    panel = 'ladder';
    paintLadder();
    if (answered >= 4) deps.onFinish?.({ passed: false });
  }

  function goBack() {
    if (panel === 'play') {
      endSession();
      return;
    }
    stop();
    deps.onBack?.();
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  body.addEventListener('click', onClick);
  body.addEventListener('change', onChange);
  window.addEventListener('keydown', onKey);

  function open(stageId) {
    if (stageId && Rhythm.unlockedStages(stats)[Rhythm.RHYTHM_STAGES.findIndex((s) => s.id === stageId)]) {
      stats.stage = stageId;
      save();
    }
    stage = Rhythm.stageById(stats.stage);
    pool = null;
    panel = 'ladder';
    paintLadder();
  }

  function stop() {
    stopSession();
    stopAnalyser();
    clearTimeout(calib?.timer);
    calib = null;
    listening = false;
    if (stats.input !== 'tap') deps.closeMic?.();
  }

  function frame(f) {
    if (!listening) return;
    // The open strings sit between 196 and 660 Hz; the metronome ticks at 1120
    // and 1550, so the ceiling keeps the clicks from confirming themselves.
    if (f.freq > 0 && f.freq < 900 && f.clarity >= 0.62) voicedAt = deps.getMic()?.ctx?.currentTime || 0;
    const meter = root.querySelector('.rhythm-live-meter span');
    if (meter) meter.style.width = `${Math.min(100, Math.sqrt(f.rms) * 340)}%`;
  }

  function micStalled() {
    if (!session) return;
    stopSession();
    panel = 'ladder';
    paintLadder();
  }

  // Turning a tablet re-fits the bar to the new width.
  window.addEventListener('resize', () => {
    if (panel !== 'play' || !session) return;
    fitCol(session.pattern.perBar);
    const scroll = root.querySelector('.rhythm-scroll');
    if (scroll) scroll.innerHTML = strip(session.pattern, { reveal: true });
  });

  paintLadder();

  return {
    open,
    stop,
    frame,
    micStalled,
    get listening() {
      return listening;
    },
    /** Test hook: the answer in progress and what was heard. */
    get __session() {
      return session && { onsets: [...session.onsets], answerAt: session.answerAt, secTick: session.secTick, phase: session.phase, ticks: session.pattern.ticks, attacks: session.pattern.attacks.map((e) => e.start) };
    },
    get __last() {
      return lastResult;
    },
    __now: () => ctxNow(),
  };
}
