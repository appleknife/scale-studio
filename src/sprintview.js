// sprintview.js — the Note Sprint screen: choose notes, read them, see how it went.
//
// Four panels in one view: the picker (a zoomed staff to tap or drag across),
// the run (one note at a time, a progress bar, the clock), the finish (stars and
// the personal best) and the student's own stats. The rules live in sprint.js;
// this file draws and listens.

import * as Sprint from './sprint.js?v=202611131720';
import { STAFF_GEOM, accidentalAt } from './staff.js?v=202611131720';
import { CLEF_PATH } from './clef.js?v=202611131720';
import { hearLevel } from './pitch.js?v=202611131720';
import { t } from './i18n.js?v=202611131720';

const SVG = 'http://www.w3.org/2000/svg';
const INK = '#221e19';
const GREY = '#d6ccbe';
const ON = '#2f5d4a';
const RIGHT = '#3f8a68';
const WRONG = '#a4534a';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const secs = (ms) => (ms / 1000).toFixed(1);

/**
 * deps:
 *   root            the view's <section>
 *   profileId()     whose stats to use
 *   openMic(emit)   resolves to the mic (its frames arrive through `frame`)
 *   closeMic()
 *   getMic()        the open mic, for its noise floor and audio context
 *   onFinish(run)   a finished sprint: log the day, feed the pet
 *   onBack()
 */
export function createSprintView(deps) {
  const root = deps.root;
  let stats = null;
  let panel = 'pick'; // 'pick' | 'play' | 'done' | 'stats'
  let picked = new Set();
  let run = null; // the sprint in progress
  let listening = false;
  let ticket = 0;
  let tick = 0;
  let lastResult = null;
  let clearArmed = false; // "clear my sprint history" waits for a second tap

  root.innerHTML = `
    <button class="back-btn" type="button" data-act="back"><span aria-hidden="true">←</span> ${t('sprint.back')}</button>
    <div class="head-row sprint-head">
      <div>
        <h2>${t('sprint.title')}</h2>
        <p class="subtle sprint-lead">${t('sprint.lead')}</p>
      </div>
    </div>
    <div class="segmented sprint-tabs" role="tablist">
      <button type="button" role="tab" data-tab="pick" aria-selected="true">${t('sprint.tab.play')}</button>
      <button type="button" role="tab" data-tab="stats" aria-selected="false">${t('sprint.tab.stats')}</button>
    </div>
    <div class="sprint-body"></div>`;
  const body = root.querySelector('.sprint-body');

  /* ── Panels ──────────────────────────────────────────────────────────── */

  function paint() {
    root.querySelector('.sprint-tabs').hidden = panel === 'play';
    root.querySelector('.sprint-lead').hidden = panel === 'play';
    root.querySelectorAll('[data-tab]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.tab === (panel === 'stats' ? 'stats' : 'pick')));
    });
    if (panel === 'pick') paintPick();
    else if (panel === 'play') paintPlay();
    else if (panel === 'done') paintDone();
    else paintStats();
  }

  /* ── The picker ──────────────────────────────────────────────────────── */

  // The staff, zoomed: a step (line to space) is STEP units, and every row of
  // sprint.rows() is one step, low G at the bottom to the top F. Heads and signs
  // are drawn at the staff's own proportions — a head is most of a space tall.
  const ROWS = Sprint.rows();
  const STEP = 14;
  const GAP = 2 * STEP;
  const TOP = 40;
  const COLS = { natural: 140, sharp: 285, flat: 400 };
  const WIDTH = 440;
  const HEIGHT = TOP + (ROWS.length - 1) * STEP + 40;
  const HEAD_RX = 0.52 * GAP;
  const HEAD_RY = 0.37 * GAP;
  const SIGN = 1.3; // accidentalAt's size, against its own 11-unit space
  const yOfRow = (i) => TOP + (ROWS.length - 1 - i) * STEP;
  const STAFF_ROWS = [5, 7, 9, 11, 13];
  const LEDGERS = [3, 1, 15, 17, 19];
  // Neighbouring notes are a step apart, closer than a head is tall, so they are
  // set the way a printed cluster is: line notes left, space notes right. Their
  // signs take three places in turn, so no two neighbours' signs touch.
  const zig = (i) => ((i - 5) % 2 === 0 ? -1 : 1) * (HEAD_RX + 0.5);
  const signX = (col, i) => col - HEAD_RX * 2 - 9 - (i % 3) * 15;

  function pickerSvg() {
    const parts = [];
    for (const i of STAFF_ROWS) parts.push(`<line x1="16" x2="${WIDTH - 8}" y1="${yOfRow(i)}" y2="${yOfRow(i)}" stroke="#bfb3a3" stroke-width="1.5"/>`);
    for (const i of LEDGERS) {
      for (const x of Object.values(COLS)) {
        parts.push(`<line x1="${x - HEAD_RX * 2 - 5}" x2="${x + HEAD_RX * 2 + 5}" y1="${yOfRow(i)}" y2="${yOfRow(i)}" stroke="#cfc5b7" stroke-width="1.5"/>`);
      }
    }
    // The clef, scaled to this staff (its spiral on the G line).
    const h = GAP * 7.1;
    const sc = h / STAFF_GEOM.CLEF_BBOX.h;
    const clefTop = yOfRow(5) - GAP - h * 0.615;
    parts.push(
      `<g transform="translate(${18 - STAFF_GEOM.CLEF_BBOX.x * sc} ${clefTop - STAFF_GEOM.CLEF_BBOX.y * sc}) scale(${sc})"><path d="${CLEF_PATH}" fill="#bfb3a3"/></g>`,
    );
    const heads = { natural: t('sprint.col.natural'), sharp: '\u266F', flat: '\u266D' };
    for (const [k, x] of Object.entries(COLS)) {
      parts.push(`<text x="${k === 'natural' ? x : x - 20}" y="18" text-anchor="middle" class="sprint-colhead">${heads[k]}</text>`);
    }
    ROWS.forEach((row, i) => {
      for (const kind of ['natural', 'sharp', 'flat']) {
        const n = row[kind];
        if (!n) continue;
        const on = picked.has(n.id);
        const x = COLS[kind] + zig(i);
        const y = yOfRow(i);
        const fill = on ? ON : GREY;
        parts.push(`<g class="sprint-cell${on ? ' is-on' : ''}" data-id="${n.id}">`);
        if (n.alter) parts.push(accidentalAt(n.alter, signX(COLS[kind], i), y, fill, SIGN));
        parts.push(`<ellipse cx="${x}" cy="${y}" rx="${HEAD_RX}" ry="${HEAD_RY}" transform="rotate(-20 ${x} ${y})" fill="${fill}"/>`);
        if (kind === 'natural') {
          parts.push(`<text x="${COLS.natural + 2 * HEAD_RX + 9}" y="${y + 4.5}" class="sprint-name${on ? ' is-on' : ''}">${n.letter}${n.octave}</text>`);
        }
        parts.push('</g>');
      }
    });
    return `<svg class="sprint-picker" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="group" aria-label="${esc(t('sprint.pick.aria'))}">${parts.join('')}</svg>`;
  }

  function paintPick() {
    const o = stats.opts;
    const count = picked.size;
    const presets = Sprint.PRESETS.map(
      (p) => `<button class="chip" type="button" data-preset="${p.id}">${t(`sprint.preset.${p.id}`)}</button>`,
    ).join('');
    const enough = count >= 2;
    body.innerHTML = `
      <p class="sprint-howto">${t('sprint.pick.howto')}</p>
      <div class="chip-row sprint-presets">${presets}<button class="chip is-quiet" type="button" data-act="clear">${t('sprint.clear')}</button></div>
      <div class="sprint-picker-wrap">${pickerSvg()}</div>
      <p class="sprint-count">${t(count === 1 ? 'sprint.count.one' : 'sprint.count', { n: count })}</p>
      <div class="sprint-opts">
        <label class="switch-row"><input type="checkbox" data-opt="repeats" ${o.repeats ? 'checked' : ''}/>
          <span><b>${t('sprint.opt.repeats')}</b><span class="switch-sub">${t(o.repeats ? 'sprint.opt.repeats.on' : 'sprint.opt.repeats.off', { n: count })}</span></span></label>
        ${
          o.repeats
            ? `<div class="sprint-length"><span>${t('sprint.opt.length')}</span>
                <div class="segmented small">${Sprint.LENGTHS.map((n) => `<button type="button" data-length="${n}" aria-selected="${o.length === n}">${n}</button>`).join('')}</div></div>
              <label class="switch-row"><input type="checkbox" data-opt="weak" ${o.weak ? 'checked' : ''}/>
                <span><b>${t('sprint.opt.weak')}</b><span class="switch-sub">${t('sprint.opt.weak.sub')}</span></span></label>`
            : ''
        }
        <label class="switch-row"><input type="checkbox" data-opt="helper" ${o.helper ? 'checked' : ''}/>
          <span><b>${t('sprint.opt.helper')}</b><span class="switch-sub">${t('sprint.opt.helper.sub')}</span></span></label>
      </div>
      <div class="sprint-actions">
        <button class="primary-btn" type="button" data-act="start" ${enough ? '' : 'disabled'}>${t('sprint.start')}</button>
        ${enough ? '' : `<p class="sprint-hint">${t('sprint.need2')}</p>`}
      </div>`;
    bindPicker(body.querySelector('.sprint-picker'));
  }

  /** Tap a note, or drag across several: the first note touched decides on or off. */
  function bindPicker(svg) {
    let painting = null; // true: turning on · false: turning off
    const cellAt = (ev) => {
      const box = svg.getBoundingClientRect();
      const sx = ((ev.clientX - box.left) / box.width) * WIDTH;
      const sy = ((ev.clientY - box.top) / box.height) * HEIGHT;
      const kind = sx < 215 ? 'natural' : sx < 335 ? 'sharp' : 'flat';
      if (!kind) return null;
      const i = Math.round((TOP + (ROWS.length - 1) * STEP - sy) / STEP);
      const row = ROWS[i];
      return row && row[kind] ? row[kind].id : null;
    };
    const setCell = (id, on) => {
      if (!id || picked.has(id) === on) return;
      if (on) picked.add(id);
      else picked.delete(id);
      const g = svg.querySelector(`[data-id="${id}"]`);
      if (!g) return;
      g.classList.toggle('is-on', on);
      g.querySelectorAll('ellipse, path').forEach((n) => {
        if (n.getAttribute('fill') && n.getAttribute('fill') !== 'none') n.setAttribute('fill', on ? ON : GREY);
        if (n.getAttribute('stroke') && n.getAttribute('stroke') !== 'none') n.setAttribute('stroke', on ? ON : GREY);
      });
      g.querySelector('text')?.classList.toggle('is-on', on);
    };
    svg.addEventListener('pointerdown', (ev) => {
      const id = cellAt(ev);
      if (!id) return;
      ev.preventDefault();
      painting = !picked.has(id);
      setCell(id, painting);
      svg.setPointerCapture(ev.pointerId);
    });
    svg.addEventListener('pointermove', (ev) => {
      if (painting == null) return;
      setCell(cellAt(ev), painting);
    });
    const end = () => {
      if (painting == null) return;
      painting = null;
      savePicked();
      // the count, the options and Start all follow the choice
      const scroll = window.scrollY;
      paintPick();
      window.scrollTo(0, scroll);
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
  }

  function savePicked() {
    stats.picked = Sprint.ALL_IDS.filter((id) => picked.has(id));
    Sprint.saveStats(deps.profileId(), stats);
  }

  /* ── A run ───────────────────────────────────────────────────────────── */

  async function start(chosen = stats.picked, opts = stats.opts) {
    const deck = Sprint.makeDeck(chosen, { ...opts, stats });
    if (deck.length < 2) return;
    run = {
      chosen: chosen.slice(),
      deck,
      index: 0,
      steps: [],
      wrong: [],
      ear: Sprint.createEar(),
      t0: null,
      clockStart: null,
      flash: null,
      miss: null,
      helper: Boolean(opts.helper),
      ghost: null, // the pitch being played (fractional midi), shown as a dot
      quietSince: null,
    };
    panel = 'play';
    paint();
    ticket += 1;
    const mine = ticket;
    let mic;
    try {
      mic = await deps.openMic();
    } catch (err) {
      if (mine !== ticket) return;
      body.querySelector('.sprint-status').textContent = deps.micError(err);
      return;
    }
    if (mine !== ticket || !run) {
      deps.closeMic();
      return;
    }
    listening = true;
    run.ear.show(Sprint.parseId(deck[0]).midi, 0);
    paintStatus();
  }

  function stopRun() {
    ticket += 1;
    listening = false;
    clearInterval(tick);
    tick = 0;
    if (run) deps.closeMic();
    run = null;
  }

  /** One frame from the microphone. */
  function frame(f) {
    if (!run || !listening) return;
    const mic = deps.getMic();
    const t = f.t;
    if (run.t0 == null) run.t0 = t;
    const time = t - run.t0;
    const voiced = f.freq > 0 && f.clarity >= 0.5 && f.rms > hearLevel(mic?.floor, f.clarity);
    let midi = voiced ? 69 + 12 * Math.log2(f.freq / 440) : null;
    // Outside the violin's reading range is not a note to judge — the chime that
    // says "right" sits above it on purpose.
    if (midi != null && (midi < 53.5 || midi > 90.5)) midi = null;
    if (run.helper) followGhost(time, midi);
    const ev = run.ear.frame(time, midi);
    if (!ev) return;
    if (run.clockStart == null && (ev.type === 'start' || ev.type === 'right' || ev.type === 'wrong')) {
      run.clockStart = performance.now();
      tick = setInterval(paintClock, 100);
    }
    if (ev.type === 'right') onRight(ev.ms, time);
    else if (ev.type === 'wrong') onWrong(ev.played);
  }

  function onRight(ms, time) {
    const id = run.deck[run.index];
    run.steps.push({ id, ms, wrong: run.wrong });
    run.wrong = [];
    chime();
    run.index += 1;
    if (run.index >= run.deck.length) {
      finish();
      return;
    }
    run.flash = id;
    run.miss = null;
    run.ghost = null;
    run.ear.show(Sprint.parseId(run.deck[run.index]).midi, time);
    run.ear.settle(time);
    paintNote();
    paintProgress();
  }

  function onWrong(played) {
    run.wrong.push(played);
    const want = Sprint.parseId(run.deck[run.index]).midi;
    run.miss = { dir: want > played ? 'up' : 'down', played };
    // Without the helper, this is the one moment the played note is shown: just
    // after the slip, where it landed beside where it should be.
    if (!run.helper) {
      run.ghost = played;
      clearTimeout(run.dotTimer);
      // a moment, then it goes: it shows where the slip landed, not a target to chase
      run.dotTimer = setTimeout(() => {
        if (run && !run.helper) {
          run.ghost = null;
          paintGhost();
        }
      }, 1600);
    }
    paintNote();
  }

  /**
   * The helper: a dot that follows the playing, every frame, like the tuner's
   * needle. It is smoothed — a little within a note, hardly at all across a
   * jump to a new one — so it glides rather than twitches; a short silence takes
   * it away.
   */
  function followGhost(time, midi) {
    if (midi == null) {
      if (run.quietSince == null) run.quietSince = time;
      if (run.ghost != null && time - run.quietSince > 0.2) {
        run.ghost = null;
        paintGhost();
      }
      return;
    }
    run.quietSince = null;
    const prev = run.ghost;
    run.ghost = prev == null || Math.abs(midi - prev) > 0.7 ? midi : prev * 0.55 + midi * 0.45;
    paintGhost();
  }

  function finish() {
    listening = false;
    clearInterval(tick);
    tick = 0;
    deps.closeMic();
    const result = Sprint.recordRun(stats, run.chosen, run.steps, Date.now(), { helper: run.helper });
    Sprint.saveStats(deps.profileId(), stats);
    lastResult = { ...result, helper: run.helper, chosen: run.chosen, opts: { ...stats.opts, helper: run.helper } };
    run = null;
    panel = 'done';
    paint();
    deps.onFinish(result);
  }

  /* ── The run, on screen ─────────────────────────────────────────────── */

  // One note on a zoomed staff.
  const NOTE_STEP = 9;
  const NOTE_W = 272;
  const DOT_X = 212; // the lane the dot moves in, right of the written note (x 150)
  const NOTE_H = 230;
  const NOTE_BOTTOM = 150; // the E4 line

  function noteSvg(id, state) {
    const n = Sprint.parseId(id);
    const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const pos = (n.octave - 4) * 7 + letters.indexOf(n.letter) - 2; // steps above E4
    const y = NOTE_BOTTOM - pos * NOTE_STEP;
    const x = 150;
    const gap = 2 * NOTE_STEP;
    const parts = [];
    for (let k = 0; k < 5; k++) {
      const ly = NOTE_BOTTOM - k * gap;
      parts.push(`<line x1="8" x2="${NOTE_W - 8}" y1="${ly}" y2="${ly}" stroke="#9c9083" stroke-width="1.4"/>`);
    }
    // ledger lines
    // only the lines between the staff and the note: B3 hangs from C4's line, it
    // does not sit on A3's
    for (let p = -2; p >= pos; p -= 2) {
      parts.push(`<line x1="${x - 19}" x2="${x + 19}" y1="${NOTE_BOTTOM - p * NOTE_STEP}" y2="${NOTE_BOTTOM - p * NOTE_STEP}" stroke="${INK}" stroke-width="1.6"/>`);
    }
    for (let p = 10; p <= pos; p += 2) {
      parts.push(`<line x1="${x - 19}" x2="${x + 19}" y1="${NOTE_BOTTOM - p * NOTE_STEP}" y2="${NOTE_BOTTOM - p * NOTE_STEP}" stroke="${INK}" stroke-width="1.6"/>`);
    }
    const h = gap * 7.1;
    const sc = h / STAFF_GEOM.CLEF_BBOX.h;
    const clefTop = NOTE_BOTTOM - gap - h * 0.615;
    parts.push(
      `<g transform="translate(${14 - STAFF_GEOM.CLEF_BBOX.x * sc} ${clefTop - STAFF_GEOM.CLEF_BBOX.y * sc}) scale(${sc})"><path d="${CLEF_PATH}" fill="${INK}"/></g>`,
    );
    const colour = state === 'right' ? RIGHT : state === 'wrong' ? WRONG : INK;
    if (n.alter) parts.push(accidentalAt(n.alter, x - 25, y, colour, 1.6));
    parts.push(`<ellipse cx="${x}" cy="${y}" rx="10.6" ry="7.8" transform="rotate(-18 ${x} ${y})" fill="${colour}"/>`);
    // a stem, the way it would be printed: down from the middle line up
    const up = pos < 4;
    parts.push(
      up
        ? `<line x1="${x + 9.6}" x2="${x + 9.6}" y1="${y - 2}" y2="${y - 63}" stroke="${colour}" stroke-width="1.8"/>`
        : `<line x1="${x - 9.6}" x2="${x - 9.6}" y1="${y + 2}" y2="${y + 63}" stroke="${colour}" stroke-width="1.8"/>`,
    );
    // The lane and the dot: drawn once, moved by paintGhost.
    parts.push(
      `<g class="sprint-ghost" style="display:none"><line class="sprint-lane" x1="${DOT_X}" x2="${DOT_X}" y1="6" y2="${NOTE_H - 8}"/>` +
        `<circle class="sprint-dot" cx="${DOT_X}" cy="0" r="7.5"/></g>`,
    );
    if (state === 'wrong' && run?.miss) {
      // the same arrow the scale screen uses: which way the written note lies
      const ax = x + 30;
      const dirUp = run.miss.dir === 'up';
      const tip = dirUp ? y - 18 : y + 18;
      const tail = dirUp ? y + 12 : y - 12;
      const back = dirUp ? 8 : -8;
      parts.push(
        `<g class="follow-arrow is-${run.miss.dir}"><line x1="${ax}" y1="${tail}" x2="${ax}" y2="${tip + back * 0.7}" stroke="${WRONG}" stroke-width="3" stroke-linecap="round"/>` +
          `<path d="M ${ax - 7} ${tip + back} L ${ax} ${tip} L ${ax + 7} ${tip + back} Z" fill="${WRONG}"/></g>`,
      );
    }
    return `<svg class="sprint-note" viewBox="0 ${NOTE_BOTTOM - 150} ${NOTE_W} ${NOTE_H}" aria-hidden="true">${parts.join('')}</svg>`;
  }

  function paintPlay() {
    body.innerHTML = `
      <div class="sprint-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${run.deck.length}" aria-valuenow="0"><span class="sprint-fill"></span></div>
      <div class="sprint-meta"><span class="sprint-left"></span><span class="sprint-clock">0.0 s</span></div>
      <div class="sprint-stage"></div>
      <p class="sprint-status" aria-live="polite"></p>
      <div class="sprint-actions"><button class="quiet-btn" type="button" data-act="stop">${t('sprint.stop')}</button></div>`;
    paintNote();
    paintProgress();
    paintStatus();
  }

  function paintNote() {
    if (!run) return;
    const stage = body.querySelector('.sprint-stage');
    if (!stage) return;
    const id = run.deck[run.index];
    stage.innerHTML = noteSvg(id, run.miss ? 'wrong' : null);
    stage.dataset.note = id; // which note is up, for tests and assistive tech
    const svg = stage.querySelector('svg');
    svg.classList.remove('is-in');
    void svg.getBoundingClientRect();
    if (!run.miss) svg.classList.add('is-in');
    else svg.classList.add('is-shake');
    paintGhost();
    paintStatus();
  }

  /**
   * Where a pitch sits on the staff, in steps above E4 — continuously. Between
   * two plain notes it sits partway (F♯ halfway from F to G). On the written
   * note's own pitch, though, it sits exactly on the written note — F♯ on the F
   * line, B♭ on the B line — and a little above or below it when sharp or flat.
   * So lined up always means right.
   */
  function staffPos(m, target) {
    const tPos = (target.octave - 4) * 7 + ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(target.letter) - 2;
    const off = m - target.midi;
    if (Math.abs(off) < 0.5) return { pos: tPos + off * 0.9, on: Math.abs(off) < 0.3 };
    const naturals = [];
    for (let o = 3; o <= 7; o++) {
      [0, 2, 4, 5, 7, 9, 11].forEach((pc, k) => naturals.push({ midi: 12 * (o + 1) + pc, pos: (o - 4) * 7 + k - 2 }));
    }
    let i = naturals.findIndex((n) => n.midi > m);
    if (i <= 0) i = 1;
    const a = naturals[i - 1];
    const b = naturals[i];
    return { pos: a.pos + ((m - a.midi) / (b.midi - a.midi)) * (b.pos - a.pos), on: false };
  }

  /** Moves the dot to the pitch being played, or hides it. */
  function paintGhost() {
    const layer = body.querySelector('.sprint-ghost');
    if (!layer || !run) return;
    const m = run.ghost;
    if (m == null) {
      layer.style.display = 'none';
      return;
    }
    const target = Sprint.parseId(run.deck[run.index]);
    const { pos, on } = staffPos(m, target);
    const y = Math.max(10, Math.min(NOTE_H - 12, NOTE_BOTTOM - pos * NOTE_STEP));
    layer.style.display = '';
    const dot = layer.querySelector('.sprint-dot');
    dot.setAttribute('cy', y.toFixed(1));
    dot.classList.toggle('is-on', on);
  }

  function paintProgress() {
    if (!run) return;
    const bar = body.querySelector('.sprint-progress');
    if (!bar) return;
    const done = run.index;
    bar.querySelector('.sprint-fill').style.width = `${(done / run.deck.length) * 100}%`;
    bar.setAttribute('aria-valuenow', String(done));
    body.querySelector('.sprint-left').textContent = t('sprint.left', { n: run.deck.length - done });
  }

  function paintClock() {
    if (!run || run.clockStart == null) return;
    const el = body.querySelector('.sprint-clock');
    if (el) el.textContent = `${secs(performance.now() - run.clockStart)} s`;
  }

  function paintStatus() {
    const el = body.querySelector('.sprint-status');
    if (!el || !run) return;
    if (!listening) el.textContent = t('sprint.status.opening');
    else if (run.miss) el.textContent = t(run.miss.dir === 'up' ? 'sprint.status.higher' : 'sprint.status.lower');
    else if (run.clockStart == null) el.textContent = t('sprint.status.ready');
    else el.textContent = '';
  }

  /** A soft two-note bell, above the violin's range so the ear never takes it for a note. */
  function chime() {
    const ctx = deps.getMic()?.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const [f, at, g] of [
      [1760, 0, 0.09],
      [2637, 0.06, 0.06],
    ]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.linearRampToValueAtTime(g, now + at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.3);
    }
  }

  /* ── The finish ──────────────────────────────────────────────────────── */

  function paintDone() {
    const r = lastResult;
    if (!r) {
      panel = 'pick';
      return paint();
    }
    const stars = [1, 2, 3]
      .map((k) => `<span class="sprint-star${k <= r.stars ? ' is-on' : ''}" style="animation-delay:${0.15 + k * 0.18}s">★</span>`)
      .join('');
    let headline;
    if (r.firstOfSet) headline = t('sprint.done.first');
    else if (r.best) headline = t('sprint.done.best');
    else headline = t('sprint.done.ok');
    const compare =
      r.previousBest != null && !r.best
        ? t('sprint.done.vsBest', { best: secs(r.previousBest), now: secs(r.avgMs) })
        : r.best && r.previousBest != null
          ? t('sprint.done.beat', { was: secs(r.previousBest), now: secs(r.avgMs) })
          : '';
    body.innerHTML = `
      <div class="sprint-done${r.best && !r.firstOfSet ? ' is-best' : ''}">
        <div class="sprint-stars" aria-label="${esc(t('sprint.stars', { n: r.stars }))}">${stars}</div>
        <h3>${headline}</h3>
        ${r.helper ? `<p class="sprint-helper-tag">${t('sprint.done.helper')}</p>` : ''}
        ${compare ? `<p class="sprint-compare">${compare}</p>` : ''}
        ${whyLine(r)}
        <div class="stat-grid sprint-tiles">
          <div class="stat-tile"><span class="stat-value">${secs(r.totalMs)} s</span><span class="stat-label">${t('sprint.tile.time')}</span></div>
          <div class="stat-tile"><span class="stat-value">${secs(r.avgMs)} s</span><span class="stat-label">${t('sprint.tile.avg')}</span></div>
          <div class="stat-tile"><span class="stat-value">${Math.round(r.perMinute)}</span><span class="stat-label">${t('sprint.tile.perMin')}</span></div>
          <div class="stat-tile"><span class="stat-value">${Math.round(r.firstTry * 100)}%</span><span class="stat-label">${t('sprint.tile.firstTry')}</span></div>
        </div>
        ${r.streakBest && r.longest >= 5 ? `<p class="sprint-compare">${t('sprint.done.streak', { n: r.longest })}</p>` : ''}
        <p class="sprint-starkey">${t('sprint.starkey', {
          two: secs(Sprint.STAR_MS.two),
          three: secs(Sprint.STAR_MS.three),
          p2: Math.round(Sprint.STAR_FIRST.two * 100),
          p3: Math.round(Sprint.STAR_FIRST.three * 100),
        })}</p>
        <div class="sprint-actions">
          <button class="primary-btn" type="button" data-act="again">${t('sprint.again')}</button>
          <button class="quiet-btn" type="button" data-act="change">${t('sprint.change')}</button>
          <button class="quiet-btn" type="button" data-act="see-stats">${t('sprint.seeStats')}</button>
        </div>
      </div>`;
    if (r.best && !r.firstOfSet) burst(body.querySelector('h3'));
    sparkleStars();
  }

  /** Each won star throws a few sparkles as it lands (timed to its pop). */
  function sparkleStars() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    body.querySelectorAll('.sprint-star.is-on').forEach((star) => {
      const delay = parseFloat(star.style.animationDelay) * 1000 + 220;
      setTimeout(() => {
        if (!star.isConnected) return;
        const box = star.getBoundingClientRect();
        for (let i = 0; i < 7; i++) {
          const n = document.createElement('span');
          n.className = 'star-spark';
          n.textContent = i % 2 ? '✦' : '✧';
          const angle = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
          const dist = 26 + Math.random() * 22;
          n.style.left = `${box.left + box.width / 2}px`;
          n.style.top = `${box.top + box.height / 2}px`;
          n.style.fontSize = `${10 + Math.random() * 8}px`;
          n.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
          n.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
          n.style.setProperty('--spin', `${(Math.random() - 0.5) * 120}deg`);
          document.body.appendChild(n);
          n.addEventListener('animationend', () => n.remove());
        }
      }, delay);
    });
  }

  /**
   * Stars are the lower of speed and right-first-time. When the two differ, say
   * which one held the run back and what the next star needs — a fast run with
   * one star otherwise looks like a mistake in the counting.
   */
  function whyLine(r) {
    if (r.speedStars == null || r.speedStars === r.firstTryStars) return '';
    const stars = (n) => '★'.repeat(n);
    const next = r.stars + 1;
    if (r.firstTryStars < r.speedStars) {
      return `<p class="sprint-why">${t('sprint.why.firstTry', {
        speed: stars(r.speedStars),
        pct: Math.round(r.firstTry * 100),
        stars: stars(r.stars),
        need: Math.round(Sprint.STAR_FIRST[next === 3 ? 'three' : 'two'] * 100),
        next: stars(next),
      })}</p>`;
    }
    return `<p class="sprint-why">${t('sprint.why.speed', {
      acc: stars(r.firstTryStars),
      avg: secs(r.avgMs),
      stars: stars(r.stars),
      need: secs(Sprint.STAR_MS[next === 3 ? 'three' : 'two']),
      next: stars(next),
    })}</p>`;
  }

  function burst(anchor) {
    if (!anchor || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = anchor.getBoundingClientRect();
    const glyphs = ['♪', '♫', '★', '♬'];
    for (let i = 0; i < 14; i++) {
      const n = document.createElement('span');
      n.className = 'note-burst';
      n.textContent = glyphs[i % glyphs.length];
      const angle = -Math.PI / 2 + (i / 13 - 0.5) * Math.PI * 1.3;
      const dist = 70 + Math.random() * 60;
      n.style.left = `${box.left + box.width / 2}px`;
      n.style.top = `${box.top + box.height / 2}px`;
      n.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      n.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      n.style.setProperty('--spin', `${(Math.random() - 0.5) * 90}deg`);
      n.style.animationDelay = `${300 + i * 25}ms`;
      n.style.color = ['#e0708a', '#e8a33d', '#4f9a7c', '#6a7fd0'][i % 4];
      document.body.appendChild(n);
      n.addEventListener('animationend', () => n.remove());
    }
  }

  /* ── Stats ───────────────────────────────────────────────────────────── */

  function paintStats() {
    const s = Sprint.summary(stats);
    if (!s.runs) {
      body.innerHTML = `<p class="sprint-empty">${t('sprint.stats.empty')}</p>`;
      return;
    }
    const tile = (v, k) => `<div class="stat-tile"><span class="stat-value">${v}</span><span class="stat-label">${t(k)}</span></div>`;
    let week = '';
    if (s.weekAvgMs != null && s.beforeAvgMs != null) {
      const faster = s.weekAvgMs < s.beforeAvgMs;
      week = t(faster ? 'sprint.stats.weekFaster' : 'sprint.stats.weekSlower', { now: secs(s.weekAvgMs), was: secs(s.beforeAvgMs) });
    }
    const list = (items, cls) =>
      items.length
        ? `<ul class="sprint-list ${cls}">${items.map((n) => `<li><b>${Sprint.displayName(n.id)}</b><span>${secs(n.avgMs)} s</span></li>`).join('')}</ul>`
        : `<p class="sprint-muted">${t('sprint.stats.more')}</p>`;
    const maxString = Math.max(...s.strings.map((x) => x.avgMs), 1);
    const strings = s.strings.length
      ? `<div class="sprint-bars">${['G', 'D', 'A', 'E']
          .map((name) => s.strings.find((x) => x.name === name))
          .filter(Boolean)
          .map(
            (x) =>
              `<div class="sprint-bar"><span class="sprint-bar-name">${t('sprint.string', { s: x.name })}</span><span class="sprint-bar-track"><span style="width:${(x.avgMs / maxString) * 100}%"></span></span><span class="sprint-bar-val">${secs(x.avgMs)} s</span></div>`,
          )
          .join('')}</div>`
      : `<p class="sprint-muted">${t('sprint.stats.more')}</p>`;
    const mixups = s.mixups.length
      ? `<ul class="sprint-list">${s.mixups
          .map((m) => `<li>${t('sprint.stats.mixup', { want: Sprint.displayName(m.want), played: Sprint.playedName(m.played) })}<span>×${m.n}</span></li>`)
          .join('')}</ul>`
      : `<p class="sprint-muted">${t('sprint.stats.noMixups')}</p>`;
    body.innerHTML = `
      <div class="stat-grid">
        ${tile(s.runs, 'sprint.stats.runs')}
        ${tile(s.notesRead, 'sprint.stats.notes')}
        ${tile(s.avgMs == null ? '—' : `${secs(s.avgMs)} s`, 'sprint.stats.avg')}
        ${tile(s.streak, 'sprint.stats.streak')}
      </div>
      ${week ? `<p class="sprint-compare">${week}</p>` : ''}
      <section class="sprint-card"><h4>${t('sprint.stats.trend')}</h4>${trendSvg(s.trend)}</section>
      <div class="sprint-cols">
        <section class="sprint-card"><h4>${t('sprint.stats.strong')}</h4>${list(s.strongest, 'is-strong')}</section>
        <section class="sprint-card"><h4>${t('sprint.stats.weak')}</h4>${list(s.weakest, 'is-weak')}
          ${s.weakest.length ? `<button class="quiet-btn small" type="button" data-act="drill-weak">${t('sprint.stats.drill')}</button>` : ''}</section>
      </div>
      <section class="sprint-card"><h4>${t('sprint.stats.strings')}</h4>${strings}</section>
      <section class="sprint-card"><h4>${t('sprint.stats.mixups')}</h4>${mixups}</section>
      ${s.helperRuns ? `<p class="sprint-muted">${t('sprint.stats.helper', { n: s.helperRuns })}</p>` : ''}
      <p class="sprint-muted">${t('sprint.stats.note')}</p>
      <div class="sprint-clear">
        <button class="quiet-btn small${clearArmed ? ' is-armed' : ''}" type="button" data-act="clear-history">${t(clearArmed ? 'sprint.clear.confirm' : 'sprint.clear.btn')}</button>
        ${
          clearArmed
            ? `<p class="sprint-clear-warn">${t('sprint.clear.warn')} <button class="link-btn" type="button" data-act="keep-history">${t('sprint.clear.keep')}</button></p>`
            : ''
        }
      </div>`;
  }

  /** Average seconds a note, one point per sprint. Lower is faster, and the line says so. */
  function trendSvg(points) {
    if (points.length < 2) return `<p class="sprint-muted">${t('sprint.stats.more')}</p>`;
    const W = 320;
    const H = 90;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const span = Math.max(1, max - min);
    const xy = points.map((v, i) => [12 + (i / (points.length - 1)) * (W - 24), 12 + ((v - min) / span) * (H - 24)]);
    const path = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const last = xy[xy.length - 1];
    return `<svg class="sprint-trend" viewBox="0 0 ${W} ${H + 16}" role="img" aria-label="${esc(t('sprint.stats.trend'))}">
      <path d="${path}" fill="none" stroke="#4f9a7c" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="#4f9a7c"/>
      <text x="12" y="${H + 12}" class="sprint-axis">${t('sprint.stats.slower', { s: secs(max) })}</text>
      <text x="${W - 12}" y="${H + 12}" text-anchor="end" class="sprint-axis">${t('sprint.stats.faster', { s: secs(min) })}</text>
    </svg>`;
  }

  /* ── Events ──────────────────────────────────────────────────────────── */

  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b || !root.contains(b)) return;
    if (b.dataset.act === 'back') {
      stopRun();
      deps.onBack();
    } else if (b.dataset.tab) {
      stopRun();
      clearArmed = false;
      panel = b.dataset.tab === 'stats' ? 'stats' : 'pick';
      paint();
    } else if (b.dataset.preset) {
      const p = Sprint.PRESETS.find((x) => x.id === b.dataset.preset);
      picked = new Set(p.notes);
      savePicked();
      paint();
    } else if (b.dataset.act === 'clear') {
      picked = new Set();
      savePicked();
      paint();
    } else if (b.dataset.length) {
      stats.opts.length = Number(b.dataset.length);
      Sprint.saveStats(deps.profileId(), stats);
      paint();
    } else if (b.dataset.act === 'start') {
      start();
    } else if (b.dataset.act === 'stop') {
      stopRun();
      panel = 'pick';
      paint();
    } else if (b.dataset.act === 'again') {
      start(lastResult.chosen, lastResult.opts);
    } else if (b.dataset.act === 'change') {
      panel = 'pick';
      paint();
    } else if (b.dataset.act === 'see-stats') {
      panel = 'stats';
      paint();
    } else if (b.dataset.act === 'clear-history') {
      if (!clearArmed) {
        clearArmed = true;
        paint();
        setTimeout(() => {
          if (clearArmed) {
            clearArmed = false;
            if (panel === 'stats') paint();
          }
        }, 8000);
        return;
      }
      // Everything this name has done in Note Sprint goes; the notes they picked
      // and their switches stay, so the next sprint is one tap away.
      clearArmed = false;
      const fresh = Sprint.emptyStats();
      stats = { ...fresh, picked: stats.picked, opts: stats.opts };
      Sprint.saveStats(deps.profileId(), stats);
      lastResult = null;
      paint();
    } else if (b.dataset.act === 'keep-history') {
      clearArmed = false;
      paint();
    } else if (b.dataset.act === 'drill-weak') {
      // the slowest few, with a neighbour or two so it is not a two-note guessing game
      const s = Sprint.summary(stats);
      const ids = s.perNote.slice(-6).map((n) => n.id);
      start(ids, { repeats: true, weak: true, length: 20, helper: stats.opts.helper });
    }
  });

  root.addEventListener('change', (ev) => {
    const box = ev.target.closest('input[data-opt]');
    if (!box) return;
    stats.opts[box.dataset.opt] = box.checked;
    Sprint.saveStats(deps.profileId(), stats);
    paint();
  });

  return {
    open() {
      stats = Sprint.loadStats(deps.profileId());
      picked = new Set(stats.picked);
      if (panel === 'play') panel = 'pick';
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
