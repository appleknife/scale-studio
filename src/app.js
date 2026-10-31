// app.js — screen flow, microphone capture and rendering.

import { MAJOR_KEYS, MINOR_KEYS, buildScale, describeKey } from './music.js?v=202610302307';
import { renderStaff } from './staff.js?v=202610302307';
import { PitchDetector, midiToFreq } from './pitch.js?v=202610302307';
import { analyzeTake, gradeFor } from './analyze.js?v=202610302307';
import {
  STRINGS,
  FIFTHS,
  stringById,
  centsFrom,
  nearestString,
  isInTune,
} from './tuner.js?v=202610302307';

const $ = (id) => document.getElementById(id);

const el = {
  views: {
    choose: $('view-choose'),
    practice: $('view-practice'),
    result: $('view-result'),
    tune: $('view-tune'),
    'test-draw': $('view-test-draw'),
    'test-pick': $('view-test-pick'),
    'test-result': $('view-test-result'),
  },
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
          <span class="key-sub">${describeKey(scale.fifths)} · ${state.practiceOctaves} octave${
            state.practiceOctaves === 1 ? '' : 's'
          }</span>
        </button>`;
    })
    .join('');

  updateLevelCopy();
}

function gridNoteText() {
  if (state.mode === 'minor') {
    return 'Minor scales are not part of the NYSSMA scale requirement, but a lot of the level 5–6 repertoire is in a minor key — so here they are.';
  }
  if (state.level === '1-2') {
    return 'Level I–II: three major scales, one octave, and you choose which three. G, D and A are the usual first three — the same finger pattern, all from open strings.';
  }
  if (state.level === '3-4') {
    return 'Level III–IV: seven major scales, two of them in two octaves. The adjudicator picks one two-octave and two one-octave scales.';
  }
  return 'Levels V–VI require fifteen major scales — C plus the seven sharp keys and the seven flat keys — all two octaves, up and down, from memory.';
}

function updateLevelCopy() {
  el.gridNote.textContent = gridNoteText();

  if (state.mode === 'minor') {
    el.testBannerText.textContent =
      'The app draws three scales at random — the way a judge does. Play them one after another, no feedback until the end.';
    el.drawBtn.textContent = 'Draw three scales';
    return;
  }

  if (state.level === '1-2') {
    el.testBannerText.textContent =
      'At Level I–II you choose the three scales you prepared. The app listens to all three, then gives you one report.';
    el.drawBtn.textContent = 'Choose my three';
  } else if (state.level === '3-4') {
    el.testBannerText.textContent =
      'Choose the seven you have prepared; the app picks one two-octave and two one-octave scales, the way a judge does.';
    el.drawBtn.textContent = 'Choose my seven';
  } else {
    el.testBannerText.textContent =
      'The app draws three scales at random — the way a judge does. Play them one after another, no feedback until the end.';
    el.drawBtn.textContent = 'Draw three scales';
  }
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

const ENCOURAGEMENT = {
  excellent: [
    'Three scales, cold, in a row — and they all held together. That is what prepared sounds like.',
    'You played the set like one piece of music. Judges hear that confidence before they hear anything else.',
    'Nothing in that set needed apologising for. Keep this tempo; it is clearly yours.',
  ],
  strong: [
    'A genuinely solid set. What is left is small, and small things polish quickly.',
    'Three scales in a row takes stamina, and you had it. One or two notes slipped — that is all.',
    'That is already a confident audition. Pick one line from the list below and it becomes a strong one.',
  ],
  growing: [
    'Good bones. The notes are all there — now let them settle instead of going to find them.',
    'You kept going, which matters more than any single note. Here is what to tidy next.',
    'This is the stage where it starts to feel easy. Slow, even repetitions of the list below will get you there.',
  ],
  keep: [
    'Every one of these runs counts as practice. Start with the first line below — just that.',
    'The shape of all three scales is already in your hands. Now it is steadiness, not new notes.',
    'Nothing here is a mystery: the same two or three habits. Take them one at a time.',
  ],
};

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
  el.redrawBtn.textContent = state.level === '1-2' ? 'Choose again' : 'Draw again';
  el.drawSub.textContent =
    state.level === '1-2'
      ? 'The three you chose — one octave each.'
      : state.level === '3-4'
        ? 'One two-octave and two one-octave scales, drawn from your seven.'
        : 'Drawn from the twelve NYSSMA keys — no repeats.';
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

  el.pickTitle.textContent = need === 3 ? 'Choose three scales' : 'Choose seven scales';
  el.pickSub.textContent =
    need === 3
      ? 'Pick the three you know best — you will play them one after another.'
      : 'These are the seven you have prepared. The app then picks one to play in two octaves and two in one octave, the way a judge would.';

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

  el.pickCount.textContent = `${picked.length} of ${need} chosen`;

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
      sig.textContent = `${keyGlyphs(target)} · ${target.octaves} oct`;
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
  el.testStep.textContent = `Scale ${i + 1} of ${state.test.scales.length}`;
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
  const pool = ENCOURAGEMENT[band];
  let line = pool[Math.floor(Math.random() * pool.length)];
  if (line === lastEncouragement && pool.length > 1) {
    line = pool[(pool.indexOf(line) + 1) % pool.length];
  }
  lastEncouragement = line;
  return line;
}

function testGradeLabel(score) {
  if (score >= 93) return 'An audition-ready set';
  if (score >= 84) return 'A strong set';
  if (score >= 70) return 'A good set';
  if (score >= 58) return 'Coming together';
  return 'A set worth repeating';
}

function shortVerdict(result) {
  if (result.stats.heard < 3) return 'nothing heard';
  if (result.stats.stops) {
    return result.stats.stops === 1 ? 'stopped once' : `stopped ${result.stats.stops} times`;
  }
  if (result.stats.missed) {
    return `${result.stats.missed} note${result.stats.missed === 1 ? '' : 's'} missed`;
  }
  const outliers = result.notes.filter(
    (note) => note.status === 'exact' && Math.abs(note.cents) > 30,
  ).length;
  if (outliers) return 'a few notes off-centre';
  if (result.components.steadiness < 0.88) return 'the pulse wandered';
  return result.score >= 95 ? 'clean' : 'solid';
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
  el.testSub.textContent = `${results.length} scales · ${centred} of ${total} notes centred · ${
    stops ? `${stops} stop${stops === 1 ? '' : 's'}` : 'no stops'
  }`;

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
          <span class="ts-name">${r.scale.title}<em class="ts-oct">${r.scale.octaves} oct</em></span>
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
         <h4>Nothing to fix</h4>
         <p>All three scales landed, centred and unbroken. That is exactly the shape of an audition you can trust.</p>
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

  el.dialHost.innerHTML = `<svg viewBox="0 0 480 250" role="img" aria-label="Tuning dial">${parts.join(
    '',
  )}</svg>`;
  needleEl = el.dialHost.querySelector('.dial-needle');
  paintNeedle();
}

function paintNeedle() {
  const t = state.tune;
  if (!t || !needleEl) return;
  const string = stringById(t.stringId);

  el.tuneNote.textContent = string.id;

  if (t.cents == null) {
    needleEl.style.transform = 'rotate(0deg)';
    needleEl.dataset.state = 'idle';
    el.tuneCents.textContent = '—';
    el.tuneStatus.textContent = t.listening
      ? 'Bow a string — the dial follows it.'
      : 'Press “Start listening” to use the microphone.';
    return;
  }

  const cents = t.cents;
  const error = cents - string.offset;
  const good = Math.abs(error) <= 3;

  needleEl.style.transform = `rotate(${dialAngle(cents)}deg)`;
  needleEl.dataset.state = good ? 'good' : 'idle';
  el.tuneCents.textContent = `${cents > 0 ? '+' : ''}${cents.toFixed(0)}¢`;

  if (good) {
    el.tuneStatus.textContent = `${string.id} is sitting where you want it.`;
  } else if (Math.abs(error) <= 12) {
    el.tuneStatus.textContent = `A touch ${error > 0 ? 'sharp' : 'flat'} — ease it ${
      error > 0 ? 'down' : 'up'
    }.`;
  } else {
    el.tuneStatus.textContent = `${Math.abs(error).toFixed(0)}¢ ${
      error > 0 ? 'sharp' : 'flat'
    } — bring the peg ${error > 0 ? 'down' : 'up'}.`;
  }
}

function renderStrings() {
  const t = state.tune;
  el.tuneStrings.innerHTML = STRINGS.map(
    (s) => `<span class="string-chip" data-id="${s.id}" data-active="${
      s.id === t.stringId
    }" data-tuned="${t.tuned.has(s.id)}">
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
  const t = state.tune;
  el.pairRows.innerHTML = FIFTHS.map(
    (pair) => `<button class="pair" type="button" data-pair="${pair.id}" aria-pressed="${
      t.fifths.has(pair.id)
    }">
      <span class="pair-tick" aria-hidden="true"></span>
      <span class="pair-name">${pair.lower} + ${pair.upper}</span>
      <span class="pair-hint">move ${pair.upper} until the pair rings</span>
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
  const t = state.tune;
  if (!t) return;

  if (!frame.freq || frame.clarity < 0.55 || frame.rms < 0.004) {
    t.silentFor += 1;
    if (t.silentFor > 20 && t.cents != null) {
      t.cents = null;
      paintNeedle();
    }
    return;
  }

  t.silentFor = 0;
  const heard = nearestString(frame.freq) || stringById(t.stringId);
  if (heard.id !== t.stringId) {
    t.stringId = heard.id;
    t.hold = 0;
    renderStrings();
    renderDial();
  }

  t.cents = centsFrom(frame.freq, heard.freq);
  t.hold = isInTune(t.cents, heard) ? t.hold + 1 : 0;
  if (t.hold >= 8 && !t.tuned.has(heard.id)) {
    t.tuned.add(heard.id);
    renderStrings();
  }
  paintNeedle();
}

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
  history.replaceState(null, '', location.pathname + location.search);
  showView('choose');
}

function renderPractice() {
  const scale = state.scale;
  el.scaleTitle.textContent = scale.title;
  el.scaleMeta.textContent = scale.meta;
  el.staffHost.innerHTML = renderStaff(scale.sequence, { fifths: scale.fifths });
  el.memoryName.textContent = scale.title;
  el.memoryMeta.textContent = `${scale.meta.replace(/ · \d+ notes$/, '')} · ${scale.rangeText}`;
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
  el.notationBtn.textContent = state.showNotation ? 'Hide notation' : 'Show notation';
  el.notationBtn.setAttribute('aria-pressed', String(!state.showNotation));
}

function resetListenUI() {
  el.listenCard.classList.remove('is-live');
  el.listenStatus.classList.remove('is-live');
  el.listenText.textContent = 'Ready when you are';
  el.listenHint.textContent = 'No rush — the take begins the moment you play your first note.';
  el.live.hidden = true;
  el.levelBar.hidden = true;
  el.stopBtn.hidden = true;
  el.startBtn.hidden = false;
  el.startBtn.disabled = false;
  el.startBtn.textContent = 'Start listening';
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
      return 'Microphone access was blocked. Allow it for this page (the icon at the left of the address bar) and press start again.';
    case 'NotFoundError':
      return 'No microphone was found. Check that one is plugged in and selected in your sound settings.';
    case 'NotReadableError':
      return 'Another app is using the microphone. Close it and try again.';
    case 'InsecureContext':
      return 'This browser will not share the microphone on a local file. Start the app with “Start Scale Studio” (or serve it over localhost) and it will work.';
    default:
      return `The microphone could not start${err?.message ? `: ${err.message}` : '.'}`;
  }
}

/* ── Listening ────────────────────────────────────────────────────────── */

async function startListening() {
  if (['requesting', 'taking', 'armed'].includes(state.phase)) return;

  state.phase = 'requesting';
  el.startBtn.disabled = true;
  el.startBtn.hidden = false;
  el.startBtn.textContent = 'Starting…';
  setStatus(false, 'Waiting for the microphone');

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
      el.startBtn.textContent = 'Start listening';
      setStatus(false, 'Microphone unavailable');
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

  setStatus(true, 'Listening — play whenever you are ready');
  el.listenHint.textContent = state.test
    ? 'Feedback comes at the end — play it the way you would for the judge.'
    : 'The take starts with your first note and ends after you stop.';

  el.startBtn.hidden = true;
  el.startBtn.disabled = false;
  el.startBtn.textContent = 'Start listening';
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
      setStatus(true, 'Listening to your scale');
      el.listenHint.textContent = 'All the way up, then back down.';
    }
    return;
  }

  const t = Math.max(0, frame.t - take.t0);
  take.frames.push({ t, freq: frame.freq, clarity: frame.clarity, rms: frame.rms });

  const voiced = frame.freq > 0 && frame.clarity > 0.5 && frame.rms > 0.004;
  if (voiced) {
    take.lastVoiced = t;
    const midiFloat = 69 + 12 * Math.log2(frame.freq / 440);
    if (take.lastMidi == null || Math.abs(midiFloat - take.lastMidi) > 0.7) {
      take.noteCount += 1;
      take.lastMidi = midiFloat;
    }
    updateTuner(midiFloat);
  }

  const silence = t - take.lastVoiced;
  const lastExpected = state.scale.sequence[state.scale.sequence.length - 1].midi;
  const nearEnd =
    take.noteCount >= state.scale.sequence.length - 2 &&
    take.lastMidi != null &&
    Math.round(take.lastMidi) === lastExpected;

  if (silence > (nearEnd ? 1.3 : 3.0) || t > 100) finishTake();
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
      setStatus(false, `Scale ${state.test.index + 1} done`);
      el.listenHint.textContent = 'Next scale in a moment — breathe, then play when you are ready.';
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
  setStatus(false, 'Take finished');
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

  el.resultEyebrow.textContent = `${scale.title} · ${scale.octaves} octave${
    scale.octaves === 1 ? '' : 's'
  }`;

  if (result.stats.heard < 3) {
    el.resultGrade.textContent = 'Nothing to score yet';
    el.resultLine.textContent =
      "The microphone didn't pick up a clear note. Move a little closer, keep the bow moving, and try again.";
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
  const bits = [`${s.exact} of ${s.expected} notes centred`, `${s.heard} notes heard`];
  if (s.bpm) bits.push(`♩ ≈ ${s.bpm}`);
  bits.push(`${s.duration.toFixed(0)}s`);
  el.resultSub.textContent = bits.join(' · ');

  const ringColour =
    result.score >= 90 ? '#2f5d4e' : result.score >= 75 ? '#44796a' : result.score >= 60 ? '#b0843f' : '#a4534a';
  el.ringValue.style.stroke = ringColour;
  el.ringValue.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  el.ringValue.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
  requestAnimationFrame(() => {
    el.ringValue.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - result.score / 100));
  });

  const metrics = [
    ['Notes', result.components.accuracy],
    ['Intonation', result.components.intonation],
    ['Steadiness', result.components.steadiness],
    ['Flow', result.components.continuity],
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
    { fifths: scale.fifths, colors: result.notes.map(noteColour) },
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
        <h4>Nothing to fix</h4>
        <p>Every note landed and stayed centred. Try it once more at a slightly quicker tempo, or take it up a third of the bow.</p>
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
  setStatus(true, 'Listening — play whenever you are ready');
  el.listenHint.textContent = 'Feedback comes at the end — play it the way you would for the judge.';
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
  setStatus(true, 'Listening to your scale');
  el.listenHint.textContent = 'All the way up, then back down.';
  el.levelBar.firstElementChild.style.width = '58%';
  updateTuner(79.28);
}
