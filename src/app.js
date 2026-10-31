// app.js — screen flow, microphone capture and rendering.

import { MAJOR_KEYS, MINOR_KEYS, buildScale, describeKey } from './music.js?v=202610310132';
import { renderStaff } from './staff.js?v=202610310132';
import { PitchDetector, midiToFreq } from './pitch.js?v=202610310132';
import { analyzeTake, gradeFor } from './analyze.js?v=202610310132';
import { initLang, setLang, getLang, applyStatic, t } from './i18n.js?v=202610310132';
import { generatePassage } from './sightreading.js?v=202610310132';
import { renderScore } from './score.js?v=202610310132';
import {
  STRINGS,
  FIFTHS,
  stringById,
  centsFrom,
  nearestString,
  isInTune,
} from './tuner.js?v=202610310132';

const LANG = initLang();

const $ = (id) => document.getElementById(id);

const el = {
  views: {
    choose: $('view-choose'),
    practice: $('view-practice'),
    result: $('view-result'),
    tune: $('view-tune'),
    sight: $('view-sight'),
    'test-draw': $('view-test-draw'),
    'test-pick': $('view-test-pick'),
    'test-result': $('view-test-result'),
  },
  openSightBtn: $('openSightBtn'),
  sightBack: $('sightBack'),
  sightNewBtn: $('sightNewBtn'),
  sightTempoBtn: $('sightTempoBtn'),
  sightLevels: $('sightLevels'),
  sightMeta: $('sightMeta'),
  sightStaff: $('sightStaff'),
  grid: $('scaleGrid'),
  gridNote: $('gridNote'),
  levelTabs: $('levelTabs'),
  modeTabs: $('modeTabs'),
  formTabs: $('formTabs'),
  testBannerText: $('testBannerText'),
  drawSub: $('drawSub'),
  octaveTabs: $('octaveTabs'),
  pickGrid: $('pickGrid'),
  pickTitle: $('pickTitle'),
  pickSub: $('pickSub'),
  pickCount: $('pickCount'),
  pickContinue: $('pickContinue'),
  pickClear: $('pickClear'),
  pickBack: $('pickBack'),
  twoOctPanel: $('twoOctPanel'),
  twoOctRow: $('twoOctRow'),

  langBtn: $('langBtn'),
  tuneBtn: $('tuneBtn'),
  tuneBack: $('tuneBack'),
  tuneMicBtn: $('tuneMicBtn'),
  tuneStrings: $('tuneStrings'),
  dialHost: $('dialHost'),
  tuneNote: $('tuneNote'),
  tuneCents: $('tuneCents'),
  tuneStatus: $('tuneStatus'),
  pairRows: $('pairRows'),
  brandHome: $('brandHome'),

  scaleTitle: $('scaleTitle'),
  scaleMeta: $('scaleMeta'),
  staffCard: $('staffCard'),
  staffHost: $('staffHost'),
  memoryCard: $('memoryCard'),
  memoryName: $('memoryName'),
  memoryMeta: $('memoryMeta'),
  notationBtn: $('notationBtn'),
  spellingRow: $('spellingRow'),
  backBtn: $('backBtn'),

  listenCard: $('listenCard'),
  listenStatus: $('listenStatus'),
  listenText: $('listenText'),
  listenHint: $('listenHint'),
  live: $('live'),
  liveNote: $('liveNote'),
  liveCents: $('liveCents'),
  tunerMarker: $('tunerMarker'),
  levelBar: $('levelBar'),
  startBtn: $('startBtn'),
  stopBtn: $('stopBtn'),

  resultBack: $('resultBack'),
  scoreRing: $('scoreRing'),
  ringValue: $('ringValue'),
  scoreNumber: $('scoreNumber'),
  resultEyebrow: $('resultEyebrow'),
  resultGrade: $('resultGrade'),
  resultLine: $('resultLine'),
  resultSub: $('resultSub'),
  breakdown: $('breakdown'),
  resultStaff: $('resultStaff'),
  tips: $('tips'),
  retryBtn: $('retryBtn'),
  anotherBtn: $('anotherBtn'),

  drawBtn: $('drawBtn'),
  reels: $('reels'),
  beginBtn: $('beginBtn'),
  redrawBtn: $('redrawBtn'),
  drawBack: $('drawBack'),

  testBar: $('testBar'),
  testStep: $('testStep'),
  testDots: $('testDots'),
  endTestBtn: $('endTestBtn'),

  testScore: $('testScore'),
  testRingValue: $('testRingValue'),
  testGrade: $('testGrade'),
  testLine: $('testLine'),
  testSub: $('testSub'),
  testScales: $('testScales'),
  testTips: $('testTips'),
  againBtn: $('againBtn'),
  newDrawBtn: $('newDrawBtn'),
  testHomeBtn: $('testHomeBtn'),
  testResultBack: $('testResultBack'),

  helpBtn: $('helpBtn'),
  helpDialog: $('helpDialog'),
  closeHelp: $('closeHelp'),
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
const params = new URLSearchParams(location.search);
// Development helpers (undocumented): ?demo renders a sample result,
// ?autostart begins listening immediately, ?dev reports the take back.
const DEV = params.has('dev');

/** Verbose progress reporting for the headless test harness only. */
function devLog(stage, data = {}) {
  if (!DEV) return;
  fetch('/result', { method: 'POST', body: JSON.stringify({ stage, ...data }) }).catch(() => {});
}

const state = {
  mode: 'major',
  form: 'melodic',
  cardId: 'C',
  variantIndex: 0,
  scale: null,
  phase: 'idle', // idle | requesting | armed | taking | finishing | between
  take: null,
  mic: null,
  // A mock audition: the three drawn scales, which one is being played, and
  // the result of each take. Null when practising a single scale.
  test: null,
  // Practice shows the notation by default; the audition never does, because
  // the Manual asks for the scales "from memory without any visual aid".
  showNotation: true,
  // NYSSMA level tier: it decides how many octaves practice uses by default and
  // how an audition is assembled (see LEVELS).
  level: '5-6',
  practiceOctaves: 2,
  // What the student picked on the audition picker (Levels I–IV).
  pick: { ids: [], twoOct: [] },
  // The tuner's live state, null when the tuner is closed.
  tune: null,
  micMode: null, // 'take' | 'tune'
};

// The Manual's three tiers of string scale requirements.
const LEVELS = {
  '1-2': { label: 'I–II', choose: 3, twoOctave: 0, octaves: 1 },
  '3-4': { label: 'III–IV', choose: 7, twoOctave: 2, octaves: 2 },
  '5-6': { label: 'V–VI', choose: 0, twoOctave: 0, octaves: 2 },
};

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/* ── Screens ──────────────────────────────────────────────────────────── */

function showView(name) {
  Object.entries(el.views).forEach(([key, node]) => {
    node.hidden = key !== name;
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cardList() {
  return state.mode === 'major' ? MAJOR_KEYS : MINOR_KEYS;
}

function cardById(id) {
  return cardList().find((c) => c.id === id) || cardList()[0];
}

/* ── Scale chooser ────────────────────────────────────────────────────── */

function renderGrid() {
  const cards = cardList();
  el.grid.innerHTML = cards
    .map((card) => {
      const scale = buildScale(card, 0, state.mode, state.form);
      const names = card.variants.map((v) => v.name).join(' / ');
      const suffix = state.mode === 'minor' ? '<span class="minor-suffix"> minor</span>' : '';
      const glyphs =
        scale.fifths === 0
          ? ''
          : (scale.fifths > 0 ? '\u266F' : '\u266D').repeat(Math.abs(scale.fifths));
      return `
        <button class="key-card" type="button" data-id="${card.id}">
          <span class="key-name">${names}${suffix}</span>
          <span class="sig-glyphs" aria-hidden="true">${glyphs || '&nbsp;'}</span>
          <span class="key-sub">${t('card.sub', {
            key: describeKey(scale.fifths),
            o: state.practiceOctaves,
          })}</span>
        </button>`;
    })
    .join('');

  updateLevelCopy();
}

function gridNoteText() {
  if (state.mode === 'minor') return t('note.minor');
  return t(`note.${state.level}`);
}

function updateLevelCopy() {
  el.gridNote.textContent = gridNoteText();

  const level = state.mode === 'minor' ? '5-6' : state.level;
  el.testBannerText.textContent = t(`banner.${level}`);
  el.drawBtn.textContent =
    level === '1-2' ? t('btn.choose3') : level === '3-4' ? t('btn.choose7') : t('btn.draw3');
}

function setLevel(level) {
  state.level = level;
  state.practiceOctaves = LEVELS[level].octaves;
  [...el.levelTabs.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.level === level)),
  );
  renderGrid();
}

function setMode(mode) {
  state.mode = mode;
  [...el.modeTabs.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.mode === mode)),
  );
  el.formTabs.hidden = mode !== 'minor';
  el.levelTabs.hidden = mode === 'minor';
  if (mode === 'minor') state.practiceOctaves = 2;
  else state.practiceOctaves = LEVELS[state.level].octaves;
  renderGrid();
}

function setForm(form) {
  state.form = form;
  [...el.formTabs.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.form === form)),
  );
  renderGrid();
}

/* ── Mock audition: drawing three scales ──────────────────────────────── */

const TEST_COUNT = 3;
const REEL_ROW_FALLBACK = 104;

let lastEncouragement = '';

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * Three distinct keys — one spelling of each enharmonic pair, and always the
 * familiar one (B, F♯, C♯). The NYSSMA Manual never names its fifteen scales,
 * and in practice nobody is asked for C♭ when B major is the same notes; the
 * practice screen still offers the other spelling for anyone who wants it.
 */
function drawThreeScales() {
  return shuffle(MAJOR_KEYS.slice())
    .slice(0, TEST_COUNT)
    .map((card) => buildScale(card, 0, 'major', 'melodic', 2));
}

function keyGlyphs(scale) {
  if (!scale.fifths) return '\u266E';
  return (scale.fifths > 0 ? '\u266F' : '\u266D').repeat(Math.abs(scale.fifths));
}

function drawThree() {
  showDraw(drawThreeScales(), true);
}

function showDraw(scales, animate) {
  cancelListening();
  history.replaceState(null, '', location.pathname + location.search);
  state.test = { scales, index: 0, results: [] };
  state.scale = scales[0];
  el.testBar.hidden = true;
  el.redrawBtn.textContent = state.level === '1-2' ? t('btn.chooseAgain') : t('btn.drawAgain');
  el.drawSub.textContent = t(`test.sub.${state.level}`);
  showView('test-draw');
  spinReels(animate);
}

/* ── Levels I–IV: the student chooses what they prepared ─────────────── */

function openPicker() {
  cancelListening();
  state.pick = { ids: [], twoOct: [] };
  showView('test-pick');
  renderPicker();
}

function canContinue() {
  const level = LEVELS[state.level];
  if (state.pick.ids.length !== level.choose) return false;
  if (level.twoOctave && state.pick.twoOct.length !== level.twoOctave) return false;
  return true;
}

function renderPicker() {
  const level = LEVELS[state.level];
  const need = level.choose;
  const picked = state.pick.ids;
  const full = picked.length >= need;

  el.pickTitle.textContent = need === 3 ? t('test.pickTitle.3') : t('test.pickTitle.7');
  el.pickSub.textContent = need === 3 ? t('test.pickSub.3') : t('test.pickSub.7');

  el.pickGrid.innerHTML = MAJOR_KEYS.map((card) => {
    const scale = buildScale(card, 0, 'major', 'melodic', level.octaves);
    const on = picked.includes(card.id);
    const disabled = full && !on;
    return `<button class="pick-chip" type="button" data-id="${card.id}"
      aria-pressed="${on}" ${disabled ? 'disabled' : ''}>
      <span class="pc-name">${card.variants.map((v) => v.name).join(' / ')}</span>
      <span class="pc-sig" aria-hidden="true">${keyGlyphs(scale)}</span>
    </button>`;
  }).join('');

  el.pickCount.textContent = t('test.count', { n: picked.length, need });

  const showTwo = level.twoOctave > 0 && picked.length === need;
  el.twoOctPanel.hidden = !showTwo;
  if (showTwo) {
    el.twoOctRow.innerHTML = picked
      .map((id) => {
        const card = MAJOR_KEYS.find((c) => c.id === id);
        const on = state.pick.twoOct.includes(id);
        return `<button type="button" data-id="${id}" aria-pressed="${on}">${card.variants
          .map((v) => v.name)
          .join(' / ')}</button>`;
      })
      .join('');
  }

  el.pickContinue.disabled = !canContinue();
}

function togglePick(id) {
  const level = LEVELS[state.level];
  const ids = state.pick.ids;
  const index = ids.indexOf(id);
  if (index >= 0) ids.splice(index, 1);
  else if (ids.length < level.choose) ids.push(id);

  if (level.twoOctave) {
    state.pick.twoOct = state.pick.twoOct.filter((x) => ids.includes(x));
    // Once all seven are in, pre-mark the first two so Continue is one tap away.
    if (ids.length === level.choose) {
      for (const candidate of ids) {
        if (state.pick.twoOct.length >= level.twoOctave) break;
        if (!state.pick.twoOct.includes(candidate)) state.pick.twoOct.push(candidate);
      }
    }
  }

  renderPicker();
}

function startFromPicks() {
  if (!canContinue()) return;
  const level = LEVELS[state.level];

  const scales = state.pick.ids.map((id) => {
    const card = MAJOR_KEYS.find((c) => c.id === id);
    const octaves = level.twoOctave && state.pick.twoOct.includes(id) ? 2 : 1;
    return buildScale(card, 0, 'major', 'melodic', octaves);
  });

  if (level.twoOctave) {
    // One of the two-octave scales, then two of the one-octave ones.
    const two = scales.filter((s) => s.octaves === 2);
    const one = shuffle(scales.filter((s) => s.octaves === 1));
    const chosen = [two[Math.floor(Math.random() * two.length)], ...one.slice(0, 2)];
    showDraw(shuffle(chosen), true);
  } else {
    showDraw(scales, false);
  }
}

function spinReels(animate = true) {
  const reels = [...el.reels.querySelectorAll('.reel')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pool = MAJOR_KEYS.flatMap((card) => card.variants.map((v) => v.name));

  el.beginBtn.disabled = true;

  reels.forEach((reel, i) => {
    const track = reel.querySelector('.reel-track');
    const sig = reel.querySelector('.reel-sig');
    const target = state.test.scales[i];

    const stops = reduce || !animate ? 0 : 9 + i * 4;
    const names = [];
    for (let k = 0; k < stops; k++) names.push(pool[Math.floor(Math.random() * pool.length)]);
    names.push(target.name);

    // A previous spin may still be filling forwards; clear it or it wins over inline styles.
    track.getAnimations().forEach((animation) => animation.cancel());
    track.innerHTML = names.map((name) => `<span>${name}</span>`).join('');
    reel.classList.remove('is-landed');
    sig.textContent = '';
    track.style.transform = 'translateY(0px)';

    const row = track.firstElementChild?.getBoundingClientRect().height || REEL_ROW_FALLBACK;
    const distance = (names.length - 1) * row;

    const land = () => {
      track.style.transform = `translateY(-${distance}px)`;
      reel.classList.add('is-landed');
      sig.textContent = `${keyGlyphs(target)} · ${t('oct.short', { n: target.octaves })}`;
      if (i === reels.length - 1) {
        el.beginBtn.disabled = false;
        el.beginBtn.focus({ preventScroll: true });
      }
    };

    if (reduce || !animate) {
      land();
      return;
    }

    const animation = track.animate(
      [{ transform: 'translateY(0px)' }, { transform: `translateY(-${distance}px)` }],
      { duration: 900 + i * 380, easing: 'cubic-bezier(.12,.7,.16,1)', fill: 'forwards' },
    );
    animation.onfinish = land;
  });
}

function updateTestBar() {
  if (!state.test) {
    el.testBar.hidden = true;
    return;
  }
  const i = state.test.index;
  el.testBar.hidden = false;
  el.testStep.textContent = t('test.step', { i: i + 1, n: state.test.scales.length });
  [...el.testDots.children].forEach((dot, k) => {
    dot.dataset.state = k < i ? 'done' : k === i ? 'current' : 'todo';
  });
}

async function beginTest() {
  if (!state.test) return;
  devLog('beginTest', { scales: state.test.scales.map((s) => s.title) });
  state.test.index = 0;
  state.test.results = [];
  state.scale = state.test.scales[0];
  renderPractice();
  updateTestBar();
  showView('practice');
  await startListening();
}

function nextTestScale() {
  if (!state.test) return;
  state.test.index += 1;
  state.scale = state.test.scales[state.test.index];
  renderPractice();
  updateTestBar();
  beginTake();
}

function endTest() {
  cancelListening();
  state.test = null;
  el.testBar.hidden = true;
  goHome();
}

function pickEncouragement(score) {
  const band = score >= 93 ? 'excellent' : score >= 84 ? 'strong' : score >= 70 ? 'growing' : 'keep';
  const index = 1 + Math.floor(Math.random() * 3);
  let key = `encourage.${band}.${index}`;
  if (key === lastEncouragement) key = `encourage.${band}.${(index % 3) + 1}`;
  lastEncouragement = key;
  return t(key);
}

function testGradeLabel(score) {
  const band = score >= 93 ? 93 : score >= 84 ? 84 : score >= 70 ? 70 : score >= 58 ? 58 : 0;
  return t(`test.grade.${band}`);
}

function shortVerdict(result) {
  if (result.stats.heard < 3) return t('verdict.nothing');
  if (result.stats.stops) {
    return result.stats.stops === 1 ? t('verdict.stoppedOne') : t('verdict.stopped', { n: result.stats.stops });
  }
  if (result.stats.missed) {
    return result.stats.missed === 1
      ? t('verdict.missedOne')
      : t('verdict.missed', { n: result.stats.missed });
  }
  const outliers = result.notes.filter(
    (note) => note.status === 'exact' && Math.abs(note.cents) > 30,
  ).length;
  if (outliers) return t('verdict.offCentre');
  if (result.components.steadiness < 0.88) return t('verdict.pulse');
  return result.score >= 95 ? t('verdict.clean') : t('verdict.solid');
}

function renderTestResult() {
  const results = state.test.results;
  const average = Math.round(results.reduce((sum, r) => sum + r.score, 0) / Math.max(1, results.length));

  showView('test-result');
  el.testBar.hidden = true;

  el.testScore.textContent = String(average);
  el.testGrade.textContent = testGradeLabel(average);
  el.testLine.textContent = pickEncouragement(average);

  const centred = results.reduce((sum, r) => sum + r.stats.exact, 0);
  const total = results.reduce((sum, r) => sum + r.stats.expected, 0);
  const stops = results.reduce((sum, r) => sum + r.stats.stops, 0);
  el.testSub.textContent = t('test.sub', {
    n: results.length,
    centred,
    total,
    stops: stops
      ? stops === 1
        ? t('test.stopOne')
        : t('test.stops', { n: stops })
      : t('test.noStops'),
  });

  const colour = average >= 90 ? '#2f5d4e' : average >= 76 ? '#44796a' : average >= 60 ? '#b0843f' : '#a4534a';
  el.testRingValue.style.stroke = colour;
  el.testRingValue.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  el.testRingValue.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
  requestAnimationFrame(() => {
    el.testRingValue.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - average / 100));
  });

  el.testScales.innerHTML = results
    .map(
      (r, i) => `
        <button class="test-scale" type="button" data-index="${i}">
          <span class="ts-name">${r.scale.title}<em class="ts-oct">${t('oct.short', {
            n: r.scale.octaves,
          })}</em></span>
          <span class="ts-bar"><span></span></span>
          <span class="ts-score">${r.score}%</span>
          <span class="ts-note">${shortVerdict(r)}</span>
          <span class="ts-open" aria-hidden="true">›</span>
        </button>`,
    )
    .join('');

  requestAnimationFrame(() => {
    [...el.testScales.querySelectorAll('.ts-bar span')].forEach((bar, i) => {
      bar.style.width = `${results[i].score}%`;
    });
  });

  const tips = results.filter((r) => r.tips.length).map((r) => ({ ...r.tips[0], scale: r.scale.title }));
  el.testTips.innerHTML = tips.length
    ? tips
        .map(
          (tip) => `
          <article class="tip" data-kind="${tip.kind}">
            <h4>${tip.scale} — ${tip.title}</h4>
            <p>${tip.text}</p>
          </article>`,
        )
        .join('')
    : `<article class="tip" data-kind="praise">
         <h4>${t('test.praise.title')}</h4>
         <p>${t('test.praise.text')}</p>
       </article>`;

  state.phase = 'idle';

  if (DEV) {
    fetch('/result', {
      method: 'POST',
      body: JSON.stringify({
        stage: 'test',
        scales: results.map((r) => r.scale.title),
        scores: results.map((r) => r.score),
        average,
        verdicts: results.map(shortVerdict),
      }),
    }).catch(() => {});
  }
}

/* ── Tuner ────────────────────────────────────────────────────────────── */

const DIAL = { cx: 240, cy: 208, r: 168, degPerCent: 0.9 };
let needleEl = null;

function dialAngle(cents) {
  return Math.max(-50, Math.min(50, cents)) * DIAL.degPerCent;
}

function dialPoint(radius, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [DIAL.cx + radius * Math.cos(rad), DIAL.cy + radius * Math.sin(rad)];
}

function dialArc(radius, fromCents, toCents) {
  const [x1, y1] = dialPoint(radius, dialAngle(fromCents));
  const [x2, y2] = dialPoint(radius, dialAngle(toCents));
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function renderDial() {
  const string = stringById(state.tune.stringId);
  const r = DIAL.r;
  const parts = [`<path class="dial-arc" d="${dialArc(r, -50, 50)}"/>`];

  for (let c = -50; c <= 50; c += 5) {
    const major = c % 10 === 0;
    const [x1, y1] = dialPoint(r - (major ? 20 : 12), dialAngle(c));
    const [x2, y2] = dialPoint(r - 4, dialAngle(c));
    parts.push(
      `<line class="dial-tick${major ? ' major' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(
        1,
      )}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`,
    );
  }

  [-50, -25, 0, 25, 50].forEach((c) => {
    const [x, y] = dialPoint(r - 38, dialAngle(c));
    parts.push(
      `<text class="dial-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${c > 0 ? '+' + c : c}</text>`,
    );
  });

  // The green band is where this string wants to sit — a hair sharp for A, D, E
  // and a hair flat for the G. The wider halo makes it easy to see at a glance.
  parts.push(
    `<path class="dial-zone-halo" d="${dialArc(r, string.offset - 3, string.offset + 3)}"/>`,
  );
  parts.push(`<path class="dial-zone" d="${dialArc(r, string.offset - 3, string.offset + 3)}"/>`);
  parts.push(
    `<g class="dial-needle"><line x1="${DIAL.cx}" y1="${DIAL.cy}" x2="${DIAL.cx}" y2="${
      DIAL.cy - (r - 24)
    }"/><circle cx="${DIAL.cx}" cy="${DIAL.cy}" r="7"/></g>`,
  );

  el.dialHost.innerHTML = `<svg viewBox="0 0 480 250" role="img" aria-label="${t(
    'aria.dial',
  )}">${parts.join(
    '',
  )}</svg>`;
  needleEl = el.dialHost.querySelector('.dial-needle');
  paintNeedle();
}

function paintNeedle() {
  const tune = state.tune;
  if (!tune || !needleEl) return;
  const string = stringById(tune.stringId);

  el.tuneNote.textContent = string.id;

  if (tune.cents == null) {
    needleEl.style.transform = 'rotate(0deg)';
    needleEl.dataset.state = 'idle';
    el.tuneCents.textContent = '—';
    el.tuneStatus.textContent = tune.listening ? t('tuner.idle') : t('tuner.noMic');
    return;
  }

  const cents = tune.cents;
  const error = cents - string.offset;
  const good = Math.abs(error) <= 3;

  needleEl.style.transform = `rotate(${dialAngle(cents)}deg)`;
  needleEl.dataset.state = good ? 'good' : 'idle';
  el.tuneCents.textContent = `${cents > 0 ? '+' : ''}${cents.toFixed(0)}¢`;

  if (good) {
    el.tuneStatus.textContent = t('tuner.stringsNote', { s: string.id });
  } else if (Math.abs(error) <= 12) {
    el.tuneStatus.textContent = t('tuner.close', {
      dir: t(error > 0 ? 'tuner.dirHigh' : 'tuner.dirLow'),
      move: t(error > 0 ? 'tuner.moveDown' : 'tuner.moveUp'),
    });
  } else {
    el.tuneStatus.textContent = t('tuner.far', {
      n: Math.abs(error).toFixed(0),
      dir: t(error > 0 ? 'tuner.dirHigh' : 'tuner.dirLow'),
      move: t(error > 0 ? 'tuner.moveDown' : 'tuner.moveUp'),
    });
  }
}

function renderStrings() {
  const tune = state.tune;
  el.tuneStrings.innerHTML = STRINGS.map(
    (s) => `<span class="string-chip" data-id="${s.id}" data-active="${
      s.id === tune.stringId
    }" data-tuned="${tune.tuned.has(s.id)}">
      <span class="sc-dot"></span>
      <span class="sc-name">${s.id}</span>
      <span class="sc-note">${s.note}</span>
    </span>`,
  ).join('');
}

/**
 * A tick-list, not a measurement: a real double stop always wobbles a little, so
 * judging a fifth is the student's ear's job. The app only keeps the ritual straight.
 */
function renderFifths() {
  const tune = state.tune;
  el.pairRows.innerHTML = FIFTHS.map(
    (pair) => `<button class="pair" type="button" data-pair="${pair.id}" aria-pressed="${
      tune.fifths.has(pair.id)
    }">
      <span class="pair-tick" aria-hidden="true"></span>
      <span class="pair-name">${pair.label}</span>
      <span class="pair-hint">${t('tuner.pairHint', { tune: pair.tune, base: pair.base })}</span>
    </button>`,
  ).join('');
}

function openTuner(withMic = true) {
  cancelListening();
  state.tune = {
    stringId: 'A',
    cents: null,
    tuned: new Set(),
    fifths: new Set(),
    silentFor: 0,
    hold: 0,
    listening: false,
  };
  showView('tune');
  renderStrings();
  renderDial();
  renderFifths();
  if (withMic) startTunerMic();
}

async function startTunerMic() {
  if (!state.tune) return;
  closeMic();
  try {
    state.mic = await openMic(onTuneFrame);
    state.micMode = 'tune';
    state.tune.listening = true;
    el.tuneMicBtn.hidden = true;
  } catch (err) {
    state.tune.listening = false;
    el.tuneMicBtn.hidden = false;
    el.tuneStatus.textContent = micErrorMessage(err);
    return;
  }
  paintNeedle();
}

function closeTuner() {
  closeMic();
  state.tune = null;
}

function onTuneFrame(frame) {
  const tune = state.tune;
  if (!tune) return;

  if (!frame.freq || frame.clarity < 0.55 || frame.rms < 0.004) {
    tune.silentFor += 1;
    if (tune.silentFor > 20 && tune.cents != null) {
      tune.cents = null;
      paintNeedle();
    }
    return;
  }

  tune.silentFor = 0;
  const heard = nearestString(frame.freq) || stringById(tune.stringId);
  if (heard.id !== tune.stringId) {
    tune.stringId = heard.id;
    tune.hold = 0;
    renderStrings();
    renderDial();
  }

  tune.cents = centsFrom(frame.freq, heard.freq);
  tune.hold = isInTune(tune.cents, heard) ? tune.hold + 1 : 0;
  if (tune.hold >= 8 && !tune.tuned.has(heard.id)) {
    tune.tuned.add(heard.id);
    renderStrings();
  }
  paintNeedle();
}

/* ── Sight reading ──────────────────────────────────────────────────── */

const sight = { level: 5, passage: null };

/** The note glyph printed next to a tempo mark. */
function tempoGlyph(unit) {
  return { q: '\u2669', h: '\u{1D15E}', qd: '\u2669.' }[unit] || '\u2669';
}

function renderSight() {
  const passage = sight.passage;
  if (!passage) return;

  const keyName =
    getLang() === 'zh' ? `${passage.key.name}\u5927\u8c03` : `${passage.key.name} major`;
  const mark = tempoGlyph(passage.tempo.unit);
  el.sightMeta.textContent = `${keyName} \u00b7 ${passage.meter} \u00b7 ${mark} = ${passage.tempo.bpm}`;
  el.sightStaff.innerHTML = renderScore(passage, {
    tempoText: `${mark} = ${passage.tempo.bpm}`,
    ariaLabel: t('aria.score'),
  });

  [...el.sightLevels.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(Number(b.dataset.sightLevel) === sight.level)),
  );
}

function newPassage(level = sight.level, seed = null) {
  sight.level = Math.min(6, Math.max(1, level));
  sight.passage = generatePassage({ level: sight.level, seed });
  renderSight();
}

function openSight(level = sight.level, seed = null) {
  cancelListening();
  state.test = null;
  el.testBar.hidden = true;
  showView('sight');
  newPassage(level, seed);
}

let clickCtx = null;

/** Two bars of clicks at the passage's own tempo, with a heavier downbeat. */
function playTempo(passage) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!clickCtx) clickCtx = new Ctx();
  if (clickCtx.state === 'suspended') clickCtx.resume();

  const beatSeconds = 60 / passage.tempo.bpm;
  const beatsPerBar = Math.max(1, Math.round(passage.perBar / passage.beat));
  const beats = beatsPerBar * 2;
  const start = clickCtx.currentTime + 0.12;

  el.sightTempoBtn.disabled = true;
  setTimeout(() => {
    el.sightTempoBtn.disabled = false;
  }, (beats * beatSeconds + 0.4) * 1000);

  for (let i = 0; i < beats; i++) {
    const when = start + i * beatSeconds;
    const downbeat = i % beatsPerBar === 0;
    const osc = clickCtx.createOscillator();
    const gain = clickCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = downbeat ? 1320 : 880;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(downbeat ? 0.22 : 0.12, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    osc.connect(gain).connect(clickCtx.destination);
    osc.start(when);
    osc.stop(when + 0.09);
  }
}

el.openSightBtn.addEventListener('click', () => openSight());
el.sightBack.addEventListener('click', goHome);
el.sightNewBtn.addEventListener('click', () => newPassage(sight.level));
el.sightTempoBtn.addEventListener('click', () => {
  if (sight.passage) playTempo(sight.passage);
});
el.sightLevels.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-sight-level]');
  if (!btn) return;
  newPassage(Number(btn.dataset.sightLevel));
});

/* ── Practice screen ──────────────────────────────────────────────────── */

function openScale(cardId, variantIndex = 0) {
  state.test = null;
  el.testBar.hidden = true;
  state.cardId = cardId;
  state.variantIndex = variantIndex;
  state.scale = buildScale(cardById(cardId), variantIndex, state.mode, state.form, state.practiceOctaves);
  state.phase = 'idle';
  renderPractice();
  showView('practice');
  history.replaceState(null, '', hashFor());
}

function goHome() {
  cancelListening();
  state.test = null;
  state.tune = null;
  el.testBar.hidden = true;
  const url = new URL(location.href);
  url.searchParams.delete('sight');
  url.searchParams.delete('seed');
  history.replaceState(null, '', url.pathname + url.search);
  showView('choose');
}

function renderPractice() {
  const scale = state.scale;
  el.scaleTitle.textContent = scale.title;
  el.scaleMeta.textContent = scale.meta;
  el.staffHost.innerHTML = renderStaff(scale.sequence, {
    fifths: scale.fifths,
    ariaLabel: t('aria.notation'),
  });
  el.memoryName.textContent = scale.title;
  el.memoryMeta.textContent = `${scale.meta} · ${scale.rangeText}`;
  el.spellingRow.hidden = Boolean(state.test) || scale.spellings.length < 2;
  [...el.octaveTabs.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(Number(b.dataset.oct) === scale.octaves)),
  );
  el.octaveTabs.hidden = Boolean(state.test);
  applyNotationVisibility();
  if (scale.spellings.length > 1) {
    el.spellingRow.innerHTML = scale.spellings
      .map(
        (name, i) =>
          `<button type="button" data-variant="${i}" aria-pressed="${i === state.variantIndex}">${name}</button>`,
      )
      .join('');
  }
  resetListenUI();
}

function applyNotationVisibility() {
  const hide = Boolean(state.test) || !state.showNotation;
  el.staffCard.hidden = hide;
  el.memoryCard.hidden = !hide;
  el.notationBtn.hidden = Boolean(state.test);
  el.notationBtn.textContent = state.showNotation ? t('btn.hideNotation') : t('btn.showNotation');
  el.notationBtn.setAttribute('aria-pressed', String(!state.showNotation));
}

function resetListenUI() {
  el.listenCard.classList.remove('is-live');
  el.listenStatus.classList.remove('is-live');
  el.listenText.textContent = t('status.ready');
  el.listenHint.textContent = t('hint.begin');
  el.live.hidden = true;
  el.levelBar.hidden = true;
  el.stopBtn.hidden = true;
  el.startBtn.hidden = false;
  el.startBtn.disabled = false;
  el.startBtn.textContent = t('btn.startListening');
}

function setStatus(live, text) {
  el.listenStatus.classList.toggle('is-live', live);
  el.listenText.textContent = text;
  el.listenCard.classList.toggle('is-live', live);
}

/* ── Microphone ───────────────────────────────────────────────────────── */

async function openMic(onFrame) {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error('no-media');
    err.name = 'InsecureContext';
    throw err;
  }

  // Create (and unlock) the audio context *inside* the click handler. iOS Safari
  // only lets audio start from a gesture, and awaiting getUserMedia first can
  // consume that gesture — the context then stays suspended and stays silent.
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const unlocked = ctx.resume().catch(() => {});

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
      video: false,
    });
  } catch (err) {
    ctx.close().catch(() => {});
    throw err;
  }

  await unlocked;
  await ctx.resume().catch(() => {});

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);

  const buf = new Float32Array(analyser.fftSize);
  const detector = new PitchDetector({
    sampleRate: ctx.sampleRate,
    bufferSize: analyser.fftSize,
    minFreq: 150,
    maxFreq: 1800,
  });

  const startedAt = performance.now();
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    const { freq, clarity, rms } = detector.detect(buf);
    onFrame({ t: (performance.now() - startedAt) / 1000, freq, clarity, rms });
  }, 30);

  return {
    stream,
    ctx,
    close() {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
  };
}

function micErrorMessage(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return t('mic.denied');
    case 'NotFoundError':
      return t('mic.notFound');
    case 'NotReadableError':
      return t('mic.busy');
    case 'InsecureContext':
      return t('mic.insecure');
    default:
      return t('mic.generic', { detail: err?.message ? `：${err.message}` : '' });
  }
}

/* ── Listening ────────────────────────────────────────────────────────── */

async function startListening() {
  if (['requesting', 'taking', 'armed'].includes(state.phase)) return;

  state.phase = 'requesting';
  el.startBtn.disabled = true;
  el.startBtn.hidden = false;
  el.startBtn.textContent = t('btn.starting');
  setStatus(false, t('status.waitingMic'));

  // The microphone is opened once and kept for a whole mock audition, so the
  // audio context stays unlocked between takes (important on iOS). The tuner
  // uses the same stream object, so hand it back before listening for a take.
  if (state.mic && state.micMode !== 'take') closeMic();
  if (!state.mic) {
    try {
      state.mic = await openMic(onFrame);
      state.micMode = 'take';
    } catch (err) {
      state.phase = 'idle';
      el.startBtn.disabled = false;
      el.startBtn.textContent = t('btn.startListening');
      setStatus(false, t('status.micUnavailable'));
      el.listenHint.textContent = micErrorMessage(err);
      return;
    }
  }

  beginTake();
}

/** Arm the app for one take. The take starts on the student's first note. */
function beginTake() {
  state.phase = 'armed';
  devLog('beginTake', { index: state.test ? state.test.index : -1 });
  state.take = {
    frames: [],
    started: false,
    t0: 0,
    lastVoiced: 0,
    strong: 0,
    noteCount: 0,
    lastMidi: null,
    done: false,
    peak: 0,
  };

  setStatus(true, t('status.listening'));
  el.listenHint.textContent = state.test ? t('hint.beginTest') : t('hint.playing');

  el.startBtn.hidden = true;
  el.startBtn.disabled = false;
  el.startBtn.textContent = t('btn.startListening');
  el.stopBtn.hidden = false;
  // No tuner during a mock audition: a judge gives nothing away either.
  el.live.hidden = Boolean(state.test);
  el.levelBar.hidden = false;
  el.liveNote.textContent = '—';
  el.liveCents.textContent = '';
  el.tunerMarker.style.left = '50%';

  // If nothing at all reaches the microphone, say so rather than looking
  // broken — usually the wrong input is selected for the site.
  setTimeout(() => {
    const take = state.take;
    if (state.phase === 'armed' && take && !take.started && (take.peak || 0) < 0.002) {
      el.listenHint.textContent =
        'No sound is reaching the app yet — check which microphone this site is allowed to use, and that it is not muted.';
    }
  }, 4500);

  // In an audition the app waits as long as it takes — but after a long silence
  // it is worth reminding the student that they can finish early.
  if (state.test) {
    setTimeout(() => {
      const take = state.take;
      if (state.phase === 'armed' && take && !take.started) {
        el.listenHint.textContent =
          'Take your time. When you are done for now, press “End audition” above.';
      }
    }, 45000);
  }
}

let levelSmooth = 0;

function onFrame(frame) {
  const take = state.take;
  if (!take || take.done) return;

  // A gentle mic-level indicator so it is obvious the app is hearing something.
  take.peak = Math.max(take.peak || 0, frame.rms);
  levelSmooth = levelSmooth * 0.75 + frame.rms * 0.25;
  const level = Math.min(100, Math.sqrt(levelSmooth) * 340);
  el.levelBar.firstElementChild.style.width = `${level}%`;

  if (!take.started) {
    const strong = frame.rms > 0.007 && frame.clarity > 0.7;
    take.strong = strong ? take.strong + 1 : 0;
    if (take.strong >= 3) {
      take.started = true;
      devLog('take-started', { index: state.test ? state.test.index : -1, rms: Number(frame.rms.toFixed(4)) });
      take.t0 = Math.max(0, frame.t - 0.1);
      setStatus(true, t('status.listeningScale'));
      el.listenHint.textContent = t('hint.allTheWay');
    }
    return;
  }

  const elapsed = Math.max(0, frame.t - take.t0);
  take.frames.push({ t: elapsed, freq: frame.freq, clarity: frame.clarity, rms: frame.rms });

  const voiced = frame.freq > 0 && frame.clarity > 0.5 && frame.rms > 0.004;
  if (voiced) {
    take.lastVoiced = elapsed;
    const midiFloat = 69 + 12 * Math.log2(frame.freq / 440);
    if (take.lastMidi == null || Math.abs(midiFloat - take.lastMidi) > 0.7) {
      take.noteCount += 1;
      take.lastMidi = midiFloat;
    }
    updateTuner(midiFloat);
  }

  const silence = elapsed - take.lastVoiced;
  const lastExpected = state.scale.sequence[state.scale.sequence.length - 1].midi;
  const nearEnd =
    take.noteCount >= state.scale.sequence.length - 2 &&
    take.lastMidi != null &&
    Math.round(take.lastMidi) === lastExpected;

  if (silence > (nearEnd ? 1.3 : 3.0) || elapsed > 100) finishTake();
}

function updateTuner(midiFloat) {
  const midi = Math.round(midiFloat);
  const cents = (midiFloat - midi) * 100;
  const name = NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);

  el.liveNote.textContent = name;
  el.liveCents.textContent = `${cents > 0 ? '+' : ''}${cents.toFixed(0)}¢`;

  const abs = Math.abs(cents);
  const colour = abs <= 15 ? '#2f5d4e' : abs <= 35 ? '#b0843f' : '#a4534a';
  el.liveNote.style.color = colour;
  el.tunerMarker.style.left = `${50 + Math.max(-1, Math.min(1, cents / 50)) * 47}%`;
  el.tunerMarker.style.background = colour;
  el.tunerMarker.style.boxShadow = `0 0 0 3px ${colour}22`;
}

function finishTake() {
  const take = state.take;
  if (!take || take.done) return;
  take.done = true;
  state.phase = 'finishing';

  el.stopBtn.hidden = true;
  el.live.hidden = true;
  el.levelBar.hidden = true;

  const result = analyzeTake(take.frames, state.scale);

  // In a mock audition the microphone stays open, the score stays hidden, and
  // the next scale arrives after a short pause.
  if (state.test) {
    state.test.results.push(result);

    if (DEV) {
      fetch('/result', {
        method: 'POST',
        body: JSON.stringify({
          stage: 'test-take',
          index: state.test.index,
          scale: state.scale.title,
          score: result.score,
        }),
      }).catch(() => {});
    }

    if (state.test.index < state.test.scales.length - 1) {
      state.phase = 'between';
      state.take = null;
      setStatus(false, t('status.scaleDone', { n: state.test.index + 1 }));
      el.listenHint.textContent = t('hint.next');
      setTimeout(nextTestScale, 1700);
      return;
    }

    closeMic();
    state.phase = 'idle';
    renderTestResult();
    return;
  }

  closeMic();
  el.startBtn.hidden = false;
  setStatus(false, t('status.finished'));
  renderResult(result);

  if (DEV) {
    // Lets the headless test harness read what the app actually computed.
    fetch('/result', {
      method: 'POST',
      body: JSON.stringify({
        stage: 'take',
        scale: state.scale.title,
        score: result.score,
        components: result.components,
        stats: result.stats,
        tips: result.tips.map((t) => t.title),
      }),
    }).catch(() => {});
  }
}

/* ── Results ──────────────────────────────────────────────────────────── */

function closeMic() {
  if (state.mic) {
    state.mic.close();
    state.mic = null;
  }
}

function noteColour(entry) {
  if (entry.status !== 'exact') return '#c2b7a6';
  const c = Math.abs(entry.cents);
  if (c <= 15) return '#3f6d59';
  if (c <= 30) return '#b58a44';
  return '#a4534a';
}

function renderResult(result) {
  const scale = result.scale;
  showView('result');

  el.resultEyebrow.textContent = t('eyebrow.result', { title: scale.title, o: scale.octaves });

  if (result.stats.heard < 3) {
    el.resultGrade.textContent = t('result.nothing.title');
    el.resultLine.textContent = t('result.nothing.body');
    el.resultSub.textContent = '';
    el.scoreNumber.textContent = '–';
    el.ringValue.style.strokeDashoffset = RING_CIRCUMFERENCE;
    el.breakdown.innerHTML = '';
    el.tips.innerHTML = '';
    el.resultStaff.innerHTML = '';
    return;
  }

  const grade = gradeFor(result.score);
  el.resultGrade.textContent = grade.label;
  el.resultLine.textContent = grade.note;
  el.scoreNumber.textContent = String(result.score);

  const s = result.stats;
  el.resultSub.textContent = s.bpm
    ? t('result.sub', {
        exact: s.exact,
        expected: s.expected,
        heard: s.heard,
        bpm: s.bpm,
        dur: s.duration.toFixed(0),
      })
    : t('result.subSimple', { exact: s.exact, expected: s.expected, heard: s.heard });

  const ringColour =
    result.score >= 90 ? '#2f5d4e' : result.score >= 75 ? '#44796a' : result.score >= 60 ? '#b0843f' : '#a4534a';
  el.ringValue.style.stroke = ringColour;
  el.ringValue.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  el.ringValue.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
  requestAnimationFrame(() => {
    el.ringValue.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - result.score / 100));
  });

  const metrics = [
    [t('component.notes'), result.components.accuracy],
    [t('component.intonation'), result.components.intonation],
    [t('component.steadiness'), result.components.steadiness],
    [t('component.flow'), result.components.continuity],
  ];
  el.breakdown.innerHTML = metrics
    .map(
      ([label, value]) => `
        <div class="metric">
          <div class="metric-label"><span>${label}</span><span class="metric-value">${Math.round(value * 100)}%</span></div>
          <div class="metric-bar"><span style="width:0%"></span></div>
        </div>`,
    )
    .join('');
  requestAnimationFrame(() => {
    [...el.breakdown.querySelectorAll('.metric-bar span')].forEach((bar, i) => {
      bar.style.width = `${Math.round(metrics[i][1] * 100)}%`;
    });
  });

  el.resultStaff.innerHTML = renderStaff(
    scale.sequence,
    {
      fifths: scale.fifths,
      colors: result.notes.map(noteColour),
      ariaLabel: t('aria.notation'),
    },
  );

  if (result.tips.length) {
    el.tips.innerHTML = result.tips
      .map(
        (tip) => `
        <article class="tip" data-kind="${tip.kind}">
          <h4>${tip.title}</h4>
          <p>${tip.text}</p>
        </article>`,
      )
      .join('');
  } else {
    el.tips.innerHTML = `
      <article class="tip" data-kind="praise">
        <h4>${t('tip.praise.title')}</h4>
        <p>${t('tip.praise.text')}</p>
      </article>`;
  }
}

/* ── Wiring ───────────────────────────────────────────────────────────── */

el.grid.addEventListener('click', (event) => {
  const card = event.target.closest('.key-card');
  if (card) openScale(card.dataset.id);
});

el.modeTabs.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-mode]');
  if (btn) setMode(btn.dataset.mode);
});

el.langBtn.addEventListener('click', () => setLang(LANG === 'zh' ? 'en' : 'zh'));
if (LANG === 'zh') {
  el.langBtn.textContent = 'English';
  applyStatic();
}

el.tuneBtn.addEventListener('click', () => openTuner());

el.tuneBack.addEventListener('click', () => {
  closeTuner();
  goHome();
});

el.tuneMicBtn.addEventListener('click', startTunerMic);

el.pairRows.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-pair]');
  if (!btn || !state.tune) return;
  const id = btn.dataset.pair;
  if (state.tune.fifths.has(id)) state.tune.fifths.delete(id);
  else state.tune.fifths.add(id);
  renderFifths();
});

el.levelTabs.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-level]');
  if (btn) setLevel(btn.dataset.level);
});

el.octaveTabs.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-oct]');
  if (!btn) return;
  state.practiceOctaves = Number(btn.dataset.oct);
  state.scale = buildScale(
    cardById(state.cardId),
    state.variantIndex,
    state.mode,
    state.form,
    state.practiceOctaves,
  );
  renderPractice();
});

el.pickGrid.addEventListener('click', (event) => {
  const chip = event.target.closest('.pick-chip');
  if (!chip || chip.disabled) return;
  togglePick(chip.dataset.id);
});

el.twoOctRow.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-id]');
  if (!btn) return;
  const set = state.pick.twoOct;
  const index = set.indexOf(btn.dataset.id);
  if (index >= 0) set.splice(index, 1);
  else if (set.length < LEVELS[state.level].twoOctave) set.push(btn.dataset.id);
  renderPicker();
});

el.pickContinue.addEventListener('click', startFromPicks);

el.pickClear.addEventListener('click', () => {
  state.pick = { ids: [], twoOct: [] };
  renderPicker();
});

el.pickBack.addEventListener('click', goHome);

el.formTabs.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-form]');
  if (btn) setForm(btn.dataset.form);
});

el.notationBtn.addEventListener('click', () => {
  state.showNotation = !state.showNotation;
  applyNotationVisibility();
});

el.spellingRow.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-variant]');
  if (!btn) return;
  state.variantIndex = Number(btn.dataset.variant);
  state.scale = buildScale(
    cardById(state.cardId),
    state.variantIndex,
    state.mode,
    state.form,
    state.practiceOctaves,
  );
  renderPractice();
});

el.backBtn.addEventListener('click', goHome);
el.brandHome.addEventListener('click', goHome);
el.resultBack.addEventListener('click', goHome);
el.anotherBtn.addEventListener('click', goHome);

el.drawBtn.addEventListener('click', () => {
  if (LEVELS[state.level].choose) openPicker();
  else drawThree();
});

el.redrawBtn.addEventListener('click', () => {
  if (state.level === '1-2') openPicker();
  else if (state.level === '3-4') startFromPicks();
  else drawThree();
});
el.drawBack.addEventListener('click', goHome);
el.beginBtn.addEventListener('click', beginTest);
el.endTestBtn.addEventListener('click', endTest);
el.againBtn.addEventListener('click', beginTest);
el.newDrawBtn.addEventListener('click', drawThree);
el.testHomeBtn.addEventListener('click', goHome);
el.testResultBack.addEventListener('click', goHome);

el.startBtn.addEventListener('click', startListening);
el.stopBtn.addEventListener('click', finishTake);

el.retryBtn.addEventListener('click', () => {
  // Retrying a single scale is practice, even if it came from a mock audition.
  state.test = null;
  el.testBar.hidden = true;
  resetListenUI();
  showView('practice');
  startListening();
});

el.testScales.addEventListener('click', (event) => {
  const row = event.target.closest('.test-scale');
  if (!row || !state.test) return;
  const result = state.test.results[Number(row.dataset.index)];
  if (result) renderResult(result);
});

el.helpBtn.addEventListener('click', () => {
  // <dialog> needs Safari 15.4; fall back to showing it inline on older iOS.
  if (typeof el.helpDialog.showModal === 'function') el.helpDialog.showModal();
  else el.helpDialog.setAttribute('open', '');
});

el.closeHelp.addEventListener('click', () => {
  if (typeof el.helpDialog.close === 'function') el.helpDialog.close();
  else el.helpDialog.removeAttribute('open');
});

function cancelListening() {
  if (state.mic) {
    state.mic.close();
    state.mic = null;
  }
  state.phase = 'idle';
  state.take = null;
}

window.addEventListener('pagehide', cancelListening);

/* ── Deep links & dev helpers ──────────────────────────────────────── */

function hashFor() {
  return `#${state.mode}/${state.cardId}`;
}

function applyHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (!raw) return false;
  const [mode, cardId] = raw.split('/');
  if ((mode === 'major' || mode === 'minor') && cardId) {
    setMode(mode);
    openScale(cardId);
    return true;
  }
  return false;
}

/** Synthetic pitch frames, so the result screen can be reviewed silently. */
function demoFrames(scale, offset = 0) {
  const frames = [];
  const step = 0.03;
  const detune = { 8: 34 + offset, 9: -31 + offset, 20: 42 + offset };
  let t = 0.6;
  scale.sequence.forEach((note, i) => {
    const cents = detune[i] || 0;
    const freq = midiToFreq(note.midi + cents / 100);
    const duration = 0.55 + (i === 14 ? 1.2 : 0);
    for (let x = 0; x < duration; x += step) {
      frames.push({ t: t + x, freq, clarity: 0.95, rms: 0.06 });
    }
    t += duration + 0.02;
  });
  return frames;
}

/* ── Boot ─────────────────────────────────────────────────────────────── */

state.scale = buildScale(cardById(state.cardId), 0, state.mode, state.form);
renderGrid();

if (!applyHash()) showView('choose');

if (params.has('demo') && params.get('demo') !== 'test') {
  renderResult(analyzeTake(demoFrames(state.scale), state.scale));
}
if (params.get('demo') === 'test') {
  const cards = ['C', 'F#', 'Ab'].map((id) => MAJOR_KEYS.find((c) => c.id === id));
  const scales = cards.map((card) => buildScale(card, 0, 'major', 'melodic'));
  state.test = {
    scales,
    index: 2,
    results: scales.map((scale, i) => analyzeTake(demoFrames(scale, [0, 16, -9][i]), scale)),
  };
  renderTestResult();
}
if (params.has('autostart')) {
  startListening();
}
window.__scaleStudioReady = true;

if (params.has('help')) el.helpDialog.showModal();
if (params.has('draw')) drawThree();
if (params.has('sight')) {
  // ?sight=5&seed=4471 reproduces one passage exactly — handy for a class
  openSight(Number(params.get('sight')) || 5, params.has('seed') ? Number(params.get('seed')) : null);
}
if (params.has('pick')) {
  // Visual check of the picker with a full selection.
  state.level = LEVELS[params.get('pick')] ? params.get('pick') : '1-2';
  state.practiceOctaves = LEVELS[state.level].octaves;
  [...el.levelTabs.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.level === state.level)),
  );
  openPicker();
  for (let i = 0; i < LEVELS[state.level].choose; i++) togglePick(MAJOR_KEYS[i].id);
}
if (params.has('tune')) {
  // Visual check of the tuner without a microphone.
  openTuner(false);
  state.tune.cents = Number(params.get('tune')) || 6;
  state.tune.tuned = new Set(['G', 'D']);
  renderStrings();
  paintNeedle();
}
if (params.has('testauto')) {
  drawThree();
  setTimeout(beginTest, 2200);
}
if (params.has('testbar')) {
  // Visual check of the in-audition screen, without a microphone.
  const scales = ['C', 'F#', 'Ab'].map((id) =>
    buildScale(MAJOR_KEYS.find((c) => c.id === id), 0, 'major', 'melodic'),
  );
  state.test = { scales, index: 1, results: [] };
  state.scale = scales[1];
  renderPractice();
  updateTestBar();
  showView('practice');
  setStatus(true, t('status.listening'));
  el.listenHint.textContent = t('hint.beginTest');
  el.startBtn.hidden = true;
  el.stopBtn.hidden = false;
  el.levelBar.hidden = false;
  el.levelBar.firstElementChild.style.width = '46%';
}
if (params.has('live')) {
  // Paints the listening state without a microphone (visual checks only).
  el.startBtn.hidden = true;
  el.stopBtn.hidden = false;
  el.live.hidden = false;
  el.levelBar.hidden = false;
  setStatus(true, t('status.listeningScale'));
  el.listenHint.textContent = t('hint.allTheWay');
  el.levelBar.firstElementChild.style.width = '58%';
  updateTuner(79.28);
}
