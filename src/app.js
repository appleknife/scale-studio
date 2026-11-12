// app.js — screen flow, microphone capture and rendering.

import { MAJOR_KEYS, MINOR_KEYS, buildScale, describeKey } from './music.js?v=202611120330';
import { renderStaff, keySignatureGlyphs } from './staff.js?v=202611120330';
import { createInk } from './ink.js?v=202611120330';
import { createFollower } from './follow.js?v=202611120330';
import { createPetRoom } from './petroom.js?v=202611120330';
import { createBuddy } from './buddy.js?v=202611120330';
import { createSprintView } from './sprintview.js?v=202611120330';
import { createListenView } from './listenview.js?v=202611120330';

// Which version this code is: the page checks it against its own, and an update
// caught halfway (new page, old code) heals itself. See the end of index.html.
window.__scaleStudioVersion = '202611120330';
import {
  PitchDetector,
  midiToFreq,
  nextFloor,
  quietLevel,
  hearLevel,
  strongLevel,
} from './pitch.js?v=202611120330';
import { analyzeTake, analyzeSightTake, gradeFor } from './analyze.js?v=202611120330';
import { initLang, setLang, getLang, applyStatic, t } from './i18n.js?v=202611120330';
import { generatePassage } from './sightreading.js?v=202611120330';
import { createPlayer, countInPlan, secondsPerQuarter } from './playback.js?v=202611120330';
import { renderScore } from './score.js?v=202611120330';
import { summariseIntonation } from './intonation.js?v=202611120330';
import * as Journal from './journal.js?v=202611120330';
import { canRecord, startRecording, recordStream, play as playRecording } from './recorder.js?v=202611120330';
import { startOffline, applyUpdate, downloadSamples, samplesStored } from './offline.js?v=202611120330';
import {
  STRINGS,
  FIFTHS,
  stringById,
  centsFrom,
  nearestString,
  foldOctave,
  isInTune,
} from './tuner.js?v=202611120330';

const LANG = initLang();

const $ = (id) => document.getElementById(id);

const el = {
  views: {
    choose: $('view-choose'),
    scales: $('view-scales'),
    practice: $('view-practice'),
    stats: $('view-stats'),
    result: $('view-result'),
    tune: $('view-tune'),
    sight: $('view-sight'),
    track: $('view-track'),
    'test-draw': $('view-test-draw'),
    'test-pick': $('view-test-pick'),
    'test-result': $('view-test-result'),
    pet: $('view-pet'),
    sprint: $('view-sprint'),
    listen: $('view-listen'),
  },
  openSprintBtn: $('openSprintBtn'),
  openListenBtn: $('openListenBtn'),
  openPetBtn: $('openPetBtn'),
  petBack: $('petBack'),
  menuPetArt: $('menuPetArt'),
  menuPetGrow: $('menuPetGrow'),
  petToast: $('petToast'),
  openSightBtn: $('openSightBtn'),
  sightBack: $('sightBack'),
  sightNewBtn: $('sightNewBtn'),
  sightHearBtn: $('sightHearBtn'),
  sightReplayBtn: $('sightReplayBtn'),
  sightTempoBtn: $('sightTempoBtn'),
  sightLevels: $('sightLevels'),
  sightSpeeds: $('sightSpeeds'),
  sightMeta: $('sightMeta'),
  sightStaff: $('sightStaff'),
  sightStart: $('sightStart'),
  sightStop: $('sightStop'),
  sightStatus: $('sightStatus'),
  sightResult: $('sightResult'),
  sightPct: $('sightPct'),
  sightGrade: $('sightGrade'),
  sightLine: $('sightLine'),
  sightParts: $('sightParts'),
  sightIntonationSum: $('sightIntonationSum'),
  sightTips: $('sightTips'),
  sightAgain: $('sightAgain'),
  sightNext: $('sightNext'),
  openLogBtn: $('openLogBtn'),
  openScalesBtn: $('openScalesBtn'),
  scalesBack: $('scalesBack'),
  openStatsBtn: $('openStatsBtn'),
  statsBack: $('statsBack'),
  statsSub: $('statsSub'),
  statsSummary: $('statsSummary'),
  statTabs: $('statTabs'),
  statSort: $('statSort'),
  statPanel: $('statPanel'),
  statManage: $('statManage'),
  statClear: $('statClear'),
  statClearWarn: $('statClearWarn'),
  statNote: $('statNote'),
  logBannerText: $('logBannerText'),
  trackBack: $('trackBack'),
  streakNum: $('streakNum'),
  goalLine: $('goalLine'),
  goalCount: $('goalCount'),
  goalTrack: $('goalTrack'),
  goalFill: $('goalFill'),
  goalChips: $('goalChips'),
  winsList: $('winsList'),
  streakPlan: $('streakPlan'),
  planSelect: $('planSelect'),
  restBtn: $('restBtn'),
  weekGrid: $('weekGrid'),
  weekDays: $('weekDays'),
  weekCount: $('weekCount'),
  todayChips: $('todayChips'),
  hardChips: $('hardChips'),
  readyList: $('readyList'),
  readyHint: $('readyHint'),
  readyCount: $('readyCount'),
  auditionLevels: $('auditionLevels'),
  recBtn: $('recBtn'),
  recStatus: $('recStatus'),
  logWarn: $('logWarn'),
  whoDialog: $('whoDialog'),
  whoTitle: $('whoTitle'),
  whoSearch: $('whoSearch'),
  whoList: $('whoList'),
  whoAdd: $('whoAdd'),
  whoAddInput: $('whoAddInput'),
  whoAddBtn: $('whoAddBtn'),
  whoNote: $('whoNote'),
  whoClose: $('whoClose'),
  logStatus: $('logStatus'),
  whoChips: $('whoChips'),
  homeWho: $('homeWho'),
  homeWhoChips: $('homeWhoChips'),
  nameForm: $('nameForm'),
  nameInput: $('nameInput'),
  nameSave: $('nameSave'),
  nameCancel: $('nameCancel'),
  nameList: $('nameList'),
  exportLog: $('exportLog'),
  importLog: $('importLog'),
  importFile: $('importFile'),
  recList: $('recList'),
  reverbToggle: $('reverbToggle'),
  lessonSheet: $('lessonSheet'),
  weekNote: $('weekNote'),
  copySheet: $('copySheet'),
  shareSheet: $('shareSheet'),
  clearLog: $('clearLog'),
  sightVolume: $('sightVolume'),
  sightLive: $('sightLive'),
  sightLevel: $('sightLevel'),
  sightAssist: $('sightAssist'),
  countIn: $('countIn'),
  countInNum: $('countInNum'),
  countInLabel: $('countInLabel'),
  sightLiveNote: $('sightLiveNote'),
  sightLiveCents: $('sightLiveCents'),
  sightMarker: $('sightMarker'),
  grid: $('scaleGrid'),
  gridNote: $('gridNote'),
  levelTabs: $('levelTabs'),
  // The two mock-audition screens carry the level too — see syncLevelTabs.
  pickLevels: $('pickLevels'),
  drawLevels: $('drawLevels'),
  modeTabs: $('modeTabs'),
  formTabs: $('formTabs'),
  testBannerText: $('testBannerText'),
  drawSub: $('drawSub'),
  octaveTabs: $('octaveTabs'),
  pickGrid: $('pickGrid'),
  pickTitle: $('pickTitle'),
  pickSub: $('pickSub'),
  pickHint: $('pickHint'),
  drawLevel: $('drawLevel'),
  levelRow: $('levelRow'),
  pickCount: $('pickCount'),
  pickContinue: $('pickContinue'),
  pickClear: $('pickClear'),
  pickBack: $('pickBack'),
  twoOctPanel: $('twoOctPanel'),
  twoOctRow: $('twoOctRow'),

  langBtn: $('langBtn'),
  themeBtn: $('themeBtn'),
  themeLabel: $('themeLabel'),
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
  staffHint: $('staffHint'),
  inkPen: $('inkPen'),
  inkErase: $('inkErase'),
  inkUndo: $('inkUndo'),
  memoryCard: $('memoryCard'),
  memoryName: $('memoryName'),
  memoryMeta: $('memoryMeta'),
  notationBtn: $('notationBtn'),
  spellingRow: $('spellingRow'),
  registerRow: $('registerRow'),
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
  resultIntonationSum: $('resultIntonationSum'),
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
  helpOffline: $('helpOffline'),
  offlineStatus: $('offlineStatus'),
  offlineBtn: $('offlineBtn'),
  updateNote: $('updateNote'),
  updateBtn: $('updateBtn'),
  updateLater: $('updateLater'),
};

/**
 * Which request for the microphone is the current one. Leaving a screen while
 * the browser is still asking bumps it, so the answer — which can come seconds
 * later — is closed instead of starting a take on a screen nobody is looking at
 * (and, for a scale, jumping to a result page out of nowhere).
 */
let micTicket = 0;

/** The pet room's controller, made once the logs are loaded (see below). */
let petRoom = null;
let sprintView = null;
let listenView = null;
/** The small pets that listen beside the music (see createBuddy, below). */
let listenBuddy = null;
let sightBuddy = null;
let resultBuddy = null;

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

// One set of marks for the scale staff; the buttons follow its state.
const ink = createInk({ onChange: (inkState) => paintInkTools(inkState) });

const REGISTER_KEY = 'scaleStudio.registers';

function loadRegisters() {
  try {
    const saved = JSON.parse(localStorage.getItem(REGISTER_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function saveRegisters() {
  try {
    localStorage.setItem(REGISTER_KEY, JSON.stringify(state.registers));
  } catch {
    /* private mode — the choice lasts until the page closes */
  }
}

/** The scale the practice screen shows, built from everything chosen on it. */
function practiceScale() {
  return buildScale(
    cardById(state.cardId),
    state.variantIndex,
    state.mode,
    state.form,
    state.practiceOctaves,
    state.registers[state.cardId],
  );
}

const state = {
  mode: 'major',
  form: 'melodic',
  cardId: 'C',
  variantIndex: 0,
  // Which octave a one-octave scale starts from, per card, where there is a
  // choice (A major: the G string or the open A). Missing means the default.
  registers: loadRegisters(),
  scale: null,
  phase: 'idle', // idle | requesting | armed | taking | finishing | between
  take: null,
  mic: null,
  // A mock audition: the three drawn scales, which one is being played, and
  // the result of each take. Null when practicing a single scale.
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

/** A written duration, as the words a teacher would use for it. */
const NOTE_VALUE_KEY = {
  1: 'noteValue.sixteenth',
  1.5: 'noteValue.dottedSixteenth',
  2: 'noteValue.eighth',
  3: 'noteValue.dottedEighth',
  4: 'noteValue.quarter',
  6: 'noteValue.dottedQuarter',
  8: 'noteValue.half',
  12: 'noteValue.dottedHalf',
  16: 'noteValue.whole',
};

/* ── Screens ──────────────────────────────────────────────────────────── */

function showView(name) {
  // Leaving the practice screen puts the pen down, so the next scale opens
  // swipeable. The marks themselves stay with their scale.
  if (name !== 'practice') ink.off();
  // The pet only lives while its room is on screen: no timers running behind
  // a scale take.
  if (name !== 'pet' && petRoom) petRoom.stop();
  // Note Sprint lets go of the microphone the moment its screen goes.
  if (name !== 'sprint' && sprintView) sprintView.stop();
  if (name !== 'listen' && listenView) listenView.stop();
  if (name !== 'sight') stopSightReplay();
  if (name === 'choose') paintMenuPet();
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
  // Today's practice, lit on the cards: which keys were played, and how often.
  const today = Journal.takesOnDay(journal, todayKey());
  el.grid.innerHTML = cards
    .map((card) => {
      const scale = buildScale(card, 0, state.mode, state.form);
      const names = card.variants.map((v) => v.name).join(' / ');
      const suffix = state.mode === 'minor' ? '<span class="minor-suffix"> minor</span>' : '';
      const glyphs = keySignatureGlyphs(scale.fifths);
      const times = today.get(card.id) || 0;
      const badge = times
        ? `<span class="key-today" aria-hidden="true">×${times}</span>
          <span class="visually-hidden">${times === 1 ? t('card.today.one') : t('card.today', { n: times })}</span>`
        : '';
      return `
        <button class="key-card${times ? ' is-practised' : ''}" type="button" data-id="${card.id}">
          ${badge}
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

const LEVEL_MARK = { '1-2': 'I–II', '3-4': 'III–IV', '5-6': 'V–VI' };

function updateLevelCopy() {
  el.gridNote.textContent = gridNoteText();

  const level = state.mode === 'minor' ? '5-6' : state.level;
  // The tile carries the same line the old banner did: what the draw will do, in
  // this level's terms. Its title stays put — the tile is a door, not a button
  // whose label changes.
  if (el.testBannerText) el.testBannerText.textContent = t(`banner.${level}`);
  if (el.drawLevel) el.drawLevel.textContent = LEVEL_MARK[level] || '';
}

/**
 * Marks the current level on every row that offers one.
 *
 * The level is one piece of state, but three screens show it — the scales grid,
 * the mock audition's picker and its draw — because it decides what each of them
 * does. They are kept in step here rather than in each place that changes it.
 */
function syncLevelTabs() {
  for (const row of [el.levelTabs, el.pickLevels, el.drawLevels]) {
    if (!row) continue;
    [...row.querySelectorAll('button')].forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.level === state.level)),
    );
  }
}

function setLevel(level) {
  state.level = level;
  state.practiceOctaves = LEVELS[level].octaves;
  syncLevelTabs();
  renderGrid();
}

function setMode(mode) {
  state.mode = mode;
  [...el.modeTabs.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.mode === mode)),
  );
  el.formTabs.hidden = mode !== 'minor';
  // Minor scales are only set at Level V–VI, so the level control goes with the
  // tabs — the whole row, or it would leave a label standing on its own.
  el.levelRow.hidden = mode === 'minor';
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
  syncLevelTabs();
  showView('test-draw');
  spinReels(animate);
}

/* ── Levels I–IV: the student chooses what they prepared ─────────────── */

function openPicker() {
  cancelListening();
  state.pick = { ids: [], twoOct: [] };
  syncLevelTabs();
  showView('test-pick');
  renderPicker();
}

/**
 * Changing the level from inside the mock audition.
 *
 * The level is not decoration on this screen: it decides whether the student
 * chooses their scales (I–IV) or the app draws them (V–VI), and how many octaves
 * each one is. So changing it moves the audition to that level's own flow — the
 * picker, or a fresh draw — rather than leaving a stale pick or a draw made for
 * another level on screen. Either way the selection starts clean, because a set of
 * seven chosen for III–IV cannot be a set of three for I–II.
 */
function changeTestLevel(level) {
  if (!LEVELS[level] || level === state.level) return;
  setLevel(level);
  if (LEVELS[level].choose) openPicker();
  else drawThree();
}

function canContinue() {
  const level = LEVELS[state.level];
  if (state.pick.ids.length !== level.choose) return false;
  if (level.twoOctave && state.pick.twoOct.length !== level.twoOctave) return false;
  return true;
}

/** The three that start on open strings and share one finger pattern. */
const SUGGESTED_KEYS = ['G', 'D', 'A'];

function renderPicker() {
  const level = LEVELS[state.level];
  const need = level.choose;
  const picked = state.pick.ids;
  const full = picked.length >= need;

  el.pickTitle.textContent = need === 3 ? t('test.pickTitle.3') : t('test.pickTitle.7');
  el.pickSub.textContent = need === 3 ? t('test.pickSub.3') : t('test.pickSub.7');

  // At Level I–II the student chooses their own three. The Manual allows any, but
  // G, D and A are the kind ones: each begins on an open string and all three use
  // the same finger pattern, so they are suggested with a soft glow rather than
  // picked for them.
  const suggest = need === 3;
  el.pickHint.hidden = !suggest;
  if (suggest) el.pickHint.textContent = t('test.pickHint');

  el.pickGrid.innerHTML = MAJOR_KEYS.map((card) => {
    const scale = buildScale(card, 0, 'major', 'melodic', level.octaves);
    const on = picked.includes(card.id);
    const disabled = full && !on;
    const gentle = suggest && SUGGESTED_KEYS.includes(card.id) && !on;
    return `<button class="pick-chip${gentle ? ' is-suggested' : ''}" type="button" data-id="${card.id}"
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

    // Which spin owns this reel. A stale one (its timer still pending when the
    // student spins again) must not write its name into the new one.
    const token = String(Number(reel.dataset.spin || 0) + 1);
    reel.dataset.spin = token;

    const land = () => {
      if (reel.dataset.spin !== token) return;
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

    const duration = 900 + i * 380;
    const animation = track.animate(
      [{ transform: 'translateY(0px)' }, { transform: `translateY(-${distance}px)` }],
      { duration, easing: 'cubic-bezier(.12,.7,.16,1)', fill: 'forwards' },
    );
    animation.onfinish = land;
    // A timer as well as the callback: a composited animation in a background
    // tab, or a browser that never fires `finish`, must not leave the student
    // looking at a stopped slot machine with Begin greyed out.
    setTimeout(land, duration + 120);
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
  // Only from the pause between scales: leaving the screen in that second and a
  // half used to bring the next scale up — armed, with no microphone — anyway.
  if (!state.test || state.phase !== 'between') return;
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
  const ticket = micTicket;
  let mic;
  try {
    // The tuner listens with the longer window: the G string needs the periods.
    mic = await openMic(routeFrame, { windowSize: 4096 });
  } catch (err) {
    // Leaving the tuner while the browser is still asking must not write to a
    // screen that is gone — that used to throw at a null `state.tune`.
    if (!state.tune || ticket !== micTicket) return;
    state.tune.listening = false;
    el.tuneMicBtn.hidden = false;
    el.tuneStatus.textContent = micErrorMessage(err);
    return;
  }
  if (!state.tune || ticket !== micTicket) {
    // The student walked away while the microphone was opening. Hand it back, or
    // it stays open (and the recording light stays on) behind a screen nobody is
    // looking at.
    mic.close();
    return;
  }
  state.mic = mic;
  state.micMode = 'tune';
  state.tune.listening = true;
  el.tuneMicBtn.hidden = true;
  paintNeedle();
}

function closeTuner() {
  micTicket += 1;
  closeMic();
  state.tune = null;
}

function onTuneFrame(frame) {
  const tune = state.tune;
  if (!tune) return;

  // The clarity bar is a little lower here than in a take. The tuner listens with
  // a long window and through a phone microphone that rolls off the lowest
  // string's fundamental, and a G3 reading can be a broad, shallow dip that a
  // 0.55 bar throws away — which is what "it does not pick up my G" looks like.
  if (!frame.freq || frame.clarity < 0.45 || frame.rms < hearLevel(state.mic?.floor, frame.clarity)) {
    tune.silentFor += 1;
    if (tune.silentFor > 20 && tune.cents != null) {
      tune.cents = null;
      paintNeedle();
    }
    return;
  }

  tune.silentFor = 0;
  // A low string read an octave high is folded back before anything else looks at
  // it: the G string is the one this happens to, and its octave is not a string.
  const freq = foldOctave(frame.freq);
  const heard = nearestString(freq) || stringById(tune.stringId);
  if (heard.id !== tune.stringId) {
    tune.stringId = heard.id;
    tune.hold = 0;
    renderStrings();
    renderDial();
  }

  tune.cents = centsFrom(freq, heard.freq);
  tune.hold = isInTune(tune.cents, heard) ? tune.hold + 1 : 0;
  if (tune.hold >= 8 && !tune.tuned.has(heard.id)) {
    tune.tuned.add(heard.id);
    renderStrings();
  }
  paintNeedle();
}

/* ── Sight reading ──────────────────────────────────────────────────── */

const sight = {
  level: 5,
  passage: null,
  // idle | armed | taking. `armed` means the microphone is open and the app is
  // waiting for the first note; nothing is scored until the student starts.
  phase: 'idle',
  take: null,
  // True while the passage is sounding through the playback voice, so the
  // screen can show a playhead and the button can turn into Stop.
  hearing: false,
  anchors: null,
  // The bar the reader has tapped, or null for the whole passage. Tapping a bar
  // marks it and turns the example into "start here", which is what a student
  // who has lost their place actually needs.
  pickedBar: null,
  replay: null, // the last take, recorded: { blob, lead, result, passage }
  replaying: null,
  // The speed the example and the assisted clicks run at. The printed marking is
  // the default — a student should hear what the page says the first time, and
  // drop to ½ or ¾ themselves if a level VI excerpt is a stretch. (Only VI is
  // brisk enough to need it; the teacher tried half as the default and asked for
  // the marking back.)
  rate: 1,
};

/* ── Hearing the passage ─────────────────────────────────────────────── */

const player = createPlayer();

/**
 * Fetches the teacher's recorded violin in the background, without blocking
 * anything. It happens while the student is reading the page, so by the time
 * they press *Hear the passage* the example is the real instrument; if it is not
 * ready — or cannot be fetched at all — the synth answers and nothing breaks.
 */
let voiceLoading = null;
function readyViolin() {
  if (voiceLoading) return voiceLoading;
  voiceLoading = player.loadVoice('samples/').catch(() => {
    voiceLoading = null; // a student on a bad connection keeps the synth, silently
    return null;
  });
  return voiceLoading;
}

/**
 * Where each of the passage's events sits in the drawing, and which staff it
 * belongs to. The notes are drawn in order — barlines, beams and slurs first,
 * then the events one by one — so the n-th note head (or rest) in the document is
 * the n-th event of the passage. That is what lets a playhead follow the music
 * without the renderer having to report its own geometry.
 */
function sightAnchors(passage, svg) {
  // Only the music's own heads: the cut-time tempo mark draws a half note too, and
  // counting it put the line one note behind for the rest of the page — it is
  // drawn after the first system, so the line jumped back to the top-left there.
  const nodes = [...svg.querySelectorAll('ellipse, g.score-rest')].filter(
    (n) => !n.closest('.score-tempo-mark'),
  );
  const lines = [...svg.querySelectorAll('g[stroke="#c3b49d"] line')].map((n) =>
    Number(n.getAttribute('y1')),
  );
  const staves = [];
  for (let i = 0; i + 4 < lines.length; i += 5) {
    staves.push({ top: lines[i], bottom: lines[i + 4] });
  }

  const anchors = [];
  let index = 0;
  for (let b = 0; b < passage.bars.length; b++) {
    for (const event of passage.bars[b]) {
      const node = nodes[index++];
      if (!node) continue;
      const box = node.getBBox();
      const y = box.y + box.height / 2;
      const staff = staves.reduce(
        (best, s) => (Math.abs((s.top + s.bottom) / 2 - y) < Math.abs((best.top + best.bottom) / 2 - y) ? s : best),
        staves[0] || { top: y - 22, bottom: y + 22 },
      );
      anchors.push({
        x: box.x + box.width / 2,
        y,
        top: staff.top,
        bottom: staff.bottom,
        start: b * passage.perBar + event.start,
        dur: event.dur,
      });
    }
  }
  return anchors;
}

let playhead = null;

/** Adds the playhead to the drawing, hidden, and returns its handle. */
function ensurePlayhead() {
  const svg = el.sightStaff.querySelector('svg');
  if (!svg) return null;
  if (playhead && playhead.svg === svg) return playhead;
  const ns = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(ns, 'g');
  group.setAttribute('class', 'sight-playhead');
  group.setAttribute('aria-hidden', 'true');
  const line = document.createElementNS(ns, 'line');
  line.setAttribute('stroke', '#2f5d4e');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-linecap', 'round');
  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('r', '3.2');
  dot.setAttribute('fill', '#2f5d4e');
  group.append(line, dot);
  svg.append(group);
  playhead = { svg, group, line, dot, visible: false };
  return playhead;
}

function hidePlayhead() {
  if (playhead) playhead.group.style.opacity = '0';
}

/**
 * Puts the playhead at `at` sixteenths into the passage. It glides between the
 * notes rather than jumping, unless the reader has asked for less motion — then
 * it steps from note to note, which is just as easy to follow.
 */
function movePlayhead(sight, at) {
  const anchors = sight.anchors;
  if (!anchors || !anchors.length || !playhead) return -1;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0;
  while (i + 1 < anchors.length && anchors[i + 1].start <= at) i += 1;
  const here = anchors[i];
  const next = anchors[i + 1];
  const through = Math.min(1, Math.max(0, (at - here.start) / Math.max(0.001, here.dur)));
  // The last note of a system must not be joined to the first note of the next
  // one: the line would slide all the way back to the left edge of the page and
  // then jump down a row. The glide only makes sense between notes on the same
  // staff, so across a system break the playhead waits at the note that is
  // sounding and lands on the next row's first note when it starts.
  const sameRow = Boolean(next) && Math.abs(next.top - here.top) < 1;
  const x = calm || !sameRow ? here.x : here.x + (next.x - here.x) * through;
  const top = Math.min(here.top, here.bottom) - 12;
  const bottom = Math.max(here.top, here.bottom) + 12;
  playhead.line.setAttribute('x1', String(x));
  playhead.line.setAttribute('x2', String(x));
  playhead.line.setAttribute('y1', String(top));
  playhead.line.setAttribute('y2', String(bottom));
  playhead.dot.setAttribute('cx', String(x));
  playhead.dot.setAttribute('cy', String(here.y));
  playhead.group.style.opacity = '0.85';
  // Which note it is sitting on, so a caller — or a test — can ask where the line
  // has got to without re-deriving it from the pixels.
  return i;
}

function stopHearing() {
  player.stop();
  sight.hearing = false;
  el.sightHearBtn.classList.remove('is-on');
  paintHearLabel();
  hidePlayhead();
}

/** The hear button's words follow the selection: whole passage, or from a bar. */
function paintHearLabel() {
  paintReplayButton();
  if (player.playing) return;
  el.sightHearBtn.textContent =
    sight.pickedBar == null ? t('sight.hear') : t('sight.hearFrom', { bar: sight.pickedBar + 1 });
}

/* ── Hearing yourself back ─────────────────────────────────────────────
   The take is recorded alongside the listening and kept in memory only, until
   the next take or the next page. It plays through the same synthetic hall as
   the practice log's recordings — a little of it: a home sounds dry — and from
   the picked bar when there is one. The bar is found in the audio from the
   notes the analysis matched: the first matched note at or after the bar, less
   however much of the bar came before it at the student's own pace. */

function clearSightReplay() {
  stopSightReplay();
  sight.replay = null;
  paintReplayButton();
}

function stopSightReplay() {
  if (sight.replaying) {
    sight.replaying.stop();
    sight.replaying = null;
    hidePlayhead();
  }
  paintReplayButton();
}

function paintReplayButton() {
  if (!el.sightReplayBtn) return;
  el.sightReplayBtn.hidden = !sight.replay;
  const hint = el.sightReplayBtn.nextElementSibling;
  if (hint) hint.hidden = !sight.replay;
  el.sightReplayBtn.classList.toggle('is-on', Boolean(sight.replaying));
  el.sightReplayBtn.textContent = sight.replaying
    ? t('sight.replayStop')
    : sight.pickedBar == null
      ? t('sight.replay')
      : t('sight.replayFrom', { bar: sight.pickedBar + 1 });
}

/** Seconds into the take where a bar was begun, from the matched notes. */
function sightBarTime(replay, bar) {
  const { result, passage } = replay;
  if (!result?.results || !passage) return bar ? null : 0;
  const from = bar * passage.perBar;
  const unit = result.unit || 0.15;
  const hit = result.results.find((r) => r.at != null && r.event.abs >= from);
  if (!hit) return bar ? null : 0;
  return Math.max(0, hit.at - (hit.event.abs - from) * unit);
}

/** Where the line belongs while the recording plays: between matched notes. */
function sightAbsAt(replay, takeTime) {
  const pts = (replay.result?.results || []).filter((r) => r.at != null).map((r) => [r.at, r.event.abs]);
  if (!pts.length) return null;
  if (takeTime <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (takeTime < pts[i][0]) {
      const [t0, a0] = pts[i - 1];
      const [t1, a1] = pts[i];
      return a0 + ((takeTime - t0) / Math.max(0.001, t1 - t0)) * (a1 - a0);
    }
  }
  return pts[pts.length - 1][1];
}

async function playSightReplay() {
  if (sight.replaying) {
    stopSightReplay();
    return;
  }
  const replay = sight.replay;
  if (!replay) return;
  if (player.playing) stopHearing();
  const barTime = sightBarTime(replay, sight.pickedBar || 0);
  if (barTime == null) {
    el.sightStatus.textContent = t('sight.replayNoBar');
    return;
  }
  // a breath before the bar, so its first note is not clipped
  const offset = Math.max(0, replay.lead + barTime - 0.4);
  try {
    const handle = await playRecording(replay.blob, { wet: 0.22, offset });
    sight.replaying = handle;
    paintReplayButton();
    ensurePlayhead();
    sight.anchors = sightAnchors(replay.passage, el.sightStaff.querySelector('svg'));
    const step = () => {
      if (sight.replaying !== handle) return;
      const at = sightAbsAt(replay, handle.position() - replay.lead);
      if (at != null) movePlayhead(sight, at);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    handle.ended.then(() => {
      if (sight.replaying === handle) {
        sight.replaying = null;
        hidePlayhead();
        paintReplayButton();
      }
    });
  } catch {
    el.sightStatus.textContent = t('sight.replayFail');
  }
}

/** Marks the picked bar in the drawing, and nothing else. */
function paintPickedBar() {
  el.sightStaff.querySelectorAll('.score-bar-box').forEach((box) => {
    box.classList.toggle('is-picked', Number(box.dataset.bar) === sight.pickedBar);
  });
  paintHearLabel();
}

function hearPassage() {
  if (player.playing) {
    stopHearing();
    return;
  }
  stopSightReplay();
  const passage = sight.passage;
  if (!passage) return;
  const fromBar = sight.pickedBar || 0;
  ensurePlayhead();
  sight.anchors = sightAnchors(passage, el.sightStaff.querySelector('svg'));
  sight.hearing = true;
  el.sightHearBtn.textContent = t('sight.stopHearing');
  el.sightHearBtn.classList.add('is-on');
  let plan = null;
  plan = player.play(passage, {
    rate: sight.rate,
    fromBar,
    // The playhead counts in sixteenths from the start of the *passage*, so the
    // bar the example starts from has to be added back on.
    onTick: (seconds) =>
      movePlayhead(sight, fromBar * passage.perBar + (seconds / plan.secondsPerQuarter) * 4),
    onEnd: () => stopHearing(),
  });
}

/**
 * Tapping a bar picks it out. Tapping it again lets it go. While a bar is
 * picked, the example starts there — the whole point of the gesture for a
 * student who has lost their place in the middle of a read.
 */
function pickBar(event) {
  const box = event.target.closest && event.target.closest('.score-bar-box');
  if (!box || !sight.passage) return;
  const bar = Number(box.dataset.bar);
  sight.pickedBar = sight.pickedBar === bar ? null : bar;
  paintPickedBar();
}

/**
 * The note glyph printed next to a tempo mark, as markup.
 *
 * The quarter and eighth characters (♩ ♪) are in every font. The half-note
 * symbol is not: it lives in Unicode's Musical Symbols block, and a phone renders
 * it as an empty box — which is exactly what the teacher saw on a cut-time page
 * ("a box of lines plus a box"). So the half note is drawn instead of typed:
 * one head, one stem, at the size of the text beside it. The head is hollow — a
 * filled head is a quarter note, and a cut-time marking is a minim.
 */
function tempoGlyphHtml(unit) {
  if (unit !== 'h') {
    return `<span class="tempo-glyph">${{ e: '\u266A', q: '\u2669', qd: '\u2669.' }[unit] || '\u2669'}</span>`;
  }
  return (
    '<svg class="tempo-glyph-svg" viewBox="0 0 18 25" width="15" height="21" aria-hidden="true">' +
    '<ellipse cx="6.6" cy="19.4" rx="5.6" ry="3.9" transform="rotate(-24 6.6 19.4)" ' +
    'fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<line x1="11.9" y1="18.4" x2="11.9" y2="2.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
    '</svg>'
  );
}

/** The same glyph as plain text, for anywhere that cannot take markup. */
function tempoGlyph(unit) {
  return { e: '\u266A', q: '\u2669', h: 'half', qd: '\u2669.' }[unit] || '\u2669';
}

/** That glyph's length in sixteenths, for turning a marking into a click. */
function unitLength(unit) {
  return { e: 2, q: 4, qd: 6, h: 8 }[unit] || 4;
}

function renderSight() {
  const passage = sight.passage;
  if (!passage) return;

  const keyName =
    getLang() === 'zh' ? `${passage.key.name}\u5927\u8c03` : `${passage.key.name} major`;
  const mark = tempoGlyph(passage.tempo.unit);
  // The meta line and the printed mark both draw the half note rather than typing
  // it: the character is missing from every phone font.
  el.sightMeta.innerHTML = `${keyName} \u00b7 ${passage.meter} \u00b7 ${tempoGlyphHtml(
    passage.tempo.unit,
  )} = ${passage.tempo.bpm}`;
  // A phone cannot show eight bars of music without shrinking the notes below
  // reading size, so under a comfortable width the passage is laid out two bars
  // to a system. The bar width inside the drawing is unchanged — the page is
  // simply narrower, so every note lands about twice as big.
  const wide = (el.sightStaff.clientWidth || 0) >= NARROW_SCORE_BELOW;
  sight.perSystem = wide ? 4 : 2;
  // A finished take leaves its intonation on the page: the same score, redrawn
  // with one stem under every note (see renderScore's lane).
  const cents =
    sight.result && sight.result.results
      ? sight.result.results.map((r) => (r.status === 'missed' ? null : r.cents))
      : null;
  el.sightStaff.innerHTML = renderScore(passage, {
    tempoText: `${mark} = ${passage.tempo.bpm}`,
    tempoMark:
      passage.tempo.unit === 'h' ? { unit: 'h', bpm: passage.tempo.bpm } : null,
    ariaLabel: t('aria.score'),
    barsPerSystem: sight.perSystem,
    intonation: cents,
  });

  [...el.sightLevels.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(Number(b.dataset.sightLevel) === sight.level)),
  );
  // The boxes are new elements after every redraw, so the mark has to be re-laid.
  paintPickedBar();
  // And the recorded violin starts loading the moment there is a passage to
  // hear, which is a second or two before anyone presses the button.
  readyViolin();
}

/** Below this width the passage is drawn two bars to a system. */
const NARROW_SCORE_BELOW = 560;

// Rotating a phone or resizing a window can cross that line. Redraw only when the
// choice actually changes, so a resize does not rebuild the passage.
window.addEventListener('resize', () => {
  if (!sight.passage || el.views.sight.hidden) return;
  const want = (el.sightStaff.clientWidth || 0) >= NARROW_SCORE_BELOW ? 4 : 2;
  if (want !== sight.perSystem) renderSight();
});

function newPassage(level = sight.level, seed = null) {
  sight.level = Math.min(6, Math.max(1, level));
  stopHearing();
  sight.passage = generatePassage({ level: sight.level, seed });
  sight.anchors = null;    // the drawing is about to be replaced
  sight.pickedBar = null;  // and a bar number means nothing on the next page
  sight.result = null;     // nor does the last take's intonation lane
  clearSightReplay();      // nor a recording of a different page
  playhead = null;
  stopSightTake(false);
  el.sightResult.hidden = true;
  el.sightStatus.textContent = '';
  renderSight();
  sightBuddy?.refresh();
}

function openSight(level = sight.level, seed = null) {
  cancelListening();
  stopSightTake(false);
  state.test = null;
  el.testBar.hidden = true;
  showView('sight');
  newPassage(level, seed);
}

/* ── Sight reading: listening ──────────────────────────────────────── */

async function startSightTake(options = {}) {
  if (!sight.passage || sight.phase !== 'idle') return;
  // The example stops the moment the student starts: hearing it underneath a
  // take would follow them into the microphone.
  stopHearing();
  el.sightStart.disabled = true;
  // A new take starts without the last one's lane under the notes.
  if (sight.result) {
    sight.result = null;
    renderSight();
  }
  el.sightStatus.textContent = t('sight.waitingMic');
  el.sightResult.hidden = true;

  if (state.mic && (state.micMode !== 'take' || state.mic.stalled)) closeMic();
  if (!state.mic) {
    const ticket = micTicket;
    try {
      const mic = await openMic(routeFrame);
      if (ticket !== micTicket) {
        mic.close();
        el.sightStart.disabled = false;
        return;
      }
      state.mic = mic;
      state.micMode = 'take';
      paintMicDiagnostics();
    } catch (err) {
      if (ticket !== micTicket) {
        el.sightStart.disabled = false;
        return;
      }
      el.sightStart.disabled = false;
      el.sightStatus.textContent = micErrorMessage(err);
      return;
    }
  }

  armSightTake(options);
  const take = sight.take;
  // The count-in does not begin until the microphone is actually delivering
  // sound. On a phone the capture path can take a second or two to wake up, and
  // a count-in during that window is worse than useless: the student plays on the
  // downbeat into a microphone that is not listening yet, and the first bar or two
  // come back as "not heard". So the first frame starts the count-in. The hook is
  // at the top of ingestSightFrame.
  if (assistOn()) {
    take.awaitWarm = true;
    el.sightStatus.textContent = t('sight.warmingMic');
    // If no frame ever arrives — the operating system held the stream back, or
    // the browser opened it and then went quiet — the screen must not sit at
    // "warming" for ever. The student gets told, and can press start again.
    setTimeout(() => {
      if (sight.take !== take || !take.awaitWarm) return;
      take.awaitWarm = false;
      stopSightTake(false);
      el.sightStatus.textContent = t('sight.noMicFrames');
    }, 8000);
  }
}

/* ── Assisted runs ───────────────────────────────────────────────────── */

// Stored as 'on' when the switch is ticked, i.e. when the student has asked for
// test conditions. A fresh key, because the old one meant the opposite.
const ASSIST_KEY = 'scaleStudio.testRun';

/**
 * Assistance is the default; the switch turns it OFF for a test run.
 *
 * Practice wants the count-in, the clicks and the line — they are what a student
 * needs while learning to read against a pulse. What the audition wants is the
 * page and nothing else, so "test" is the thing you opt into.
 */
function assistOn() {
  return !(el.sightAssist && el.sightAssist.checked);
}

/**
 * A count-in, then the clicks and the moving line while the student plays.
 *
 * This is the training-wheels mode: the metronome says where the beat is and the
 * playhead says where in the bar the music is, so a student who has never read a
 * passage against a pulse has something to follow. What it deliberately does NOT
 * do is play the passage's sound — the microphone is open, and the example
 * underneath the student would follow them into the scoring.
 *
 * The count is one bar, in the metre's own beats: 3 in 3/4, 2 in cut time, and 6
 * in 6/8, because that is how a student counts it aloud.
 */
function startAssistedRun() {
  const passage = sight.passage;
  const take = sight.take;
  if (!passage || !take) return;
  // The clicks and the line run at the speed the student chose — half by default.
  // A count-in at the printed tempo under a half-speed practice would be the
  // app contradicting itself.
  const base = countInPlan(passage.meter, passage.tempo);
  const plan = {
    clicks: base.clicks,
    interval: base.interval / sight.rate,
    seconds: base.seconds / sight.rate,
  };
  const ctx = player.context;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  // Nothing that sounds during the count-in is heard: the take's clock starts on
  // the downbeat, and a student who tries the first note early would otherwise
  // start the run before the bar had finished counting them in.
  take.counting = true;
  el.countIn.hidden = false;
  el.countInNum.textContent = String(plan.clicks);
  el.countInLabel.textContent = passage.meter;
  el.sightStatus.textContent = t('sight.assistCounting', { n: plan.clicks });

  const start = ctx.currentTime + 0.15;
  for (let i = 0; i < plan.clicks; i++) {
    clickAt(ctx, start + i * plan.interval, i === 0 ? 1 : 0.6);
  }
  // The numbers follow the clicks: one per beat, counting down.
  for (let i = 0; i < plan.clicks; i++) {
    setTimeout(() => {
      if (sight.take !== take) return;
      el.countInNum.textContent = String(plan.clicks - i);
    }, Math.max(0, (start - ctx.currentTime) * 1000 + i * plan.interval * 1000) - 150 + 150);
  }

  // After the bar of count-in the take's clock starts, and the click track and
  // the playhead run from the downbeat. A late entry costs, exactly as it would
  // with a judge — which is the point of practising with the wheels on.
  setTimeout(() => {
    if (sight.take !== take) return;
    el.countIn.hidden = true;
    take.counting = false;
    take.startAtNextFrame = true;
    take.assisted = true;
    // Where the clicks say the passage ends, in seconds from the downbeat. Until
    // then a short silence is a breath or a lost place, not the end of the take.
    take.endsAt =
      ((passage.bars.length * passage.perBar) / 4) * (secondsPerQuarter(passage.tempo) / sight.rate);
    el.sightStatus.textContent = t('sight.playing');
    runClickTrack(ctx, passage, plan);
    runAssistPlayhead(take, passage);
    // A watchdog: if no frame ever arrives — the microphone is open but silent,
    // or the browser has stopped feeding it — the take must still end rather
    // than leave the screen listening for ever.
    setTimeout(() => {
      if (sight.take === take && !take.started) finishSightTake();
    }, 8000);
  }, (plan.seconds + 0.15) * 1000);
}

/**
 * The clicks scheduled by an assisted run, so they can be stopped.
 *
 * Web Audio has no "cancel everything after now": a node that has been asked to
 * start in four seconds will start in four seconds whatever the app thinks. So
 * every click an assisted run creates is kept here and told to stop when the run
 * ends, or when the student leaves the screen.
 */
let assistClicks = [];

function stopAssistAudio() {
  for (const node of assistClicks) {
    try {
      node.stop();
      node.disconnect();
    } catch {
      /* already finished — nothing to stop */
    }
  }
  assistClicks = [];
  if (el.countIn) el.countIn.hidden = true;
}

/** One click, at a time on the audio clock, sharing the player's volume. */
function clickAt(ctx, when, strength = 0.6) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = strength >= 1 ? 1320 : 880;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(strength >= 1 ? 0.5 : 0.34, when + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
  osc.connect(gain).connect(player.output);
  osc.start(when);
  osc.stop(when + 0.09);
  assistClicks.push(osc);
  // A long session should not accumulate stopped nodes in this list.
  if (assistClicks.length > 200) assistClicks = assistClicks.slice(-40);
}

/** The clicks under the passage, at the printed tempo, one bar at a time. */
function runClickTrack(ctx, passage, plan) {
  const bars = passage.bars.length;
  const start = ctx.currentTime + 0.02;
  for (let i = 0; i < bars * plan.clicks; i++) {
    clickAt(ctx, start + i * plan.interval, i % plan.clicks === 0 ? 1 : 0.6);
  }
}

/** The playhead moving at the printed tempo, so the eye has somewhere to be. */
function runAssistPlayhead(take, passage) {
  ensurePlayhead();
  sight.anchors = sightAnchors(passage, el.sightStaff.querySelector('svg'));
  const spq = secondsPerQuarter(passage.tempo) / sight.rate;
  // The clock and the anchors have to be in the same unit, and both are in
  // **sixteenths** from the start of the passage — that is what movePlayhead()
  // takes, and what the example's own tick hands it (`bar × perBar + sixteenths
  // into the bar`). The length of the passage is therefore bars × perBar with no
  // conversion at all: dividing it by four gave a total in quarters while the
  // clock arrived in sixteenths, so the line stopped — and disappeared — after a
  // quarter of the page, which is exactly two bars of eight on a phone.
  const total = passage.bars.length * passage.perBar;
  const began = performance.now();
  const step = () => {
    if (sight.take !== take) return;
    const at = Math.min(total, ((performance.now() - began) / 1000 / spq) * 4);
    movePlayhead(sight, at);
    if (at < total) requestAnimationFrame(step);
    else hidePlayhead();
  };
  requestAnimationFrame(step);
}

/**
 * Get ready without touching the microphone — the take itself begins on the
 * student's first note. A mock audition will arm with { live: false } so the
 * needle gives nothing away while it is being judged.
 */
function armSightTake(options = {}) {
  sight.phase = 'armed';
  sightBuddy?.listen(true);
  sight.take = {
    frames: [],
    started: false,
    t0: 0,
    strong: 0,
    lastVoiced: 0,
    peak: 0,
    // How many notes the page asks for, and how many separate soundings have
    // been heard so far — the second against the first is what tells a stumble
    // from a finish (see the silence rule in ingestSightFrame).
    expected: sight.passage
      ? sight.passage.bars.reduce(
          (n, bar) => n + bar.filter((e) => !e.rest && e.note).length,
          0,
        )
      : 0,
    onsets: 0,
    voiced: false,
    live: options.live !== false,
    liveMidi: null,
    liveCents: null,
  };
  el.sightLive.hidden = true;
  if (el.sightLevel) el.sightLevel.hidden = false;
  resetSightLive();
  // Recorded from the moment the take is armed, so the first note's attack is
  // in it — hearing yourself back is the point (see the replay button).
  clearSightReplay();
  if (canRecord() && state.mic?.stream) {
    sight.take.rec = recordStream(state.mic.stream);
  }
  el.sightStart.disabled = false;
  el.sightStart.hidden = true;
  el.sightStop.hidden = false;
  el.sightStatus.textContent = t('sight.armed');
}

/** Puts the sight-reading needle back to nothing, ready for a fresh take. */
function resetSightLive() {
  el.sightLiveNote.textContent = '—';
  el.sightLiveCents.textContent = '';
  el.sightMarker.style.left = '50%';
  el.sightMarker.style.background = '';
  el.sightMarker.style.boxShadow = '';
}

/**
 * The live reading during a sight-reading take. Sixteenths go past quickly, so
 * the note name follows the nearest semitone at once while the cents are
 * smoothed a little — the needle should read as a number, not a twitch. A new
 * note resets the smoothing, so one note's offset never bleeds into the next.
 */
function updateSightLive(take, freq) {
  const midiFloat = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.round(midiFloat);
  const cents = (midiFloat - midi) * 100;
  const fresh = take.liveMidi == null || Math.abs(midiFloat - take.liveMidi) > 0.7;
  take.liveCents = fresh || take.liveCents == null ? cents : take.liveCents * 0.6 + cents * 0.4;
  take.liveMidi = midiFloat;
  paintLiveRead(el.sightLiveNote, el.sightLiveCents, el.sightMarker, midi, take.liveCents);
}

function ingestSightFrame(frame) {
  const take = sight.take;
  if (!take) return;
  take.peak = Math.max(take.peak || 0, frame.rms);

  // The first frame the microphone delivers is what starts an assisted run — see
  // the warm-up note in startSightTake. Everything before that is the capture
  // path waking up, and none of it belongs to the take.
  if (take.awaitWarm) {
    take.awaitWarm = false;
    startAssistedRun();
    return;
  }

  // A count-in is not part of anyone's playing, even if the student tries a note
  // over it. The take's clock starts on the downbeat that follows.
  if (take.counting) return;

  // An assisted run is timed from its count-in, not from the first note: the
  // clicks have already said where beat one is, so a late entry is a late entry,
  // exactly as it would be for a judge.
  if (take.startAtNextFrame && !take.started) {
    take.startAtNextFrame = false;
    take.started = true;
    sight.phase = 'taking';
    take.t0 = frame.t;
    take.perfT0 = performance.now();
    if (take.live) {
      el.sightLive.hidden = false;
      resetSightLive();
    }
  }

  if (!take.started) {
    const heard = frame.freq > 0 && frame.clarity > 0.5 && frame.rms > hearLevel(state.mic?.floor, frame.clarity);
    // The needle answers while the app is still deciding, exactly as it does on a
    // scale take — otherwise a test run shows "—" for however long the start rule
    // takes to be satisfied.
    if (heard && take.live) {
      el.sightLive.hidden = false;
      updateSightLive(take, frame.freq);
    }
    // Confident (3 frames) or merely held (6) — see the long note in onFrame: on a
    // phone the confident rule alone can take seconds to line up.
    const strong = frame.rms > strongLevel(state.mic?.floor) && frame.clarity > 0.62;
    take.strong = strong ? take.strong + 1 : 0;
    take.held = heard ? (take.held || 0) + 1 : 0;
    if (take.strong >= 3 || take.held >= 6) {
      take.started = true;
      sight.phase = 'taking';
      take.t0 = Math.max(0, frame.t - 0.1);
      take.perfT0 = performance.now() - (frame.t - take.t0) * 1000;
      el.sightStatus.textContent = t('sight.playing');
      if (take.live) {
        el.sightLive.hidden = false;
        resetSightLive();
      }
    }
    return;
  }

  const elapsed = Math.max(0, frame.t - take.t0);
  take.frames.push({ t: elapsed, freq: frame.freq, clarity: frame.clarity, rms: frame.rms });

  const voiced = frame.freq > 0 && frame.clarity > 0.5 && frame.rms > hearLevel(state.mic?.floor, frame.clarity);
  if (voiced) {
    take.lastVoiced = elapsed;
    if (!take.voiced) {
      take.onsets += 1;
      sightBuddy?.note();
    }
    if (take.live) updateSightLive(take, frame.freq);
  }
  take.voiced = voiced;

  // Ends on its own after a real pause once something has been played, so nobody
  // has to reach for a button with a violin under their chin. A take that is
  // still far from finished gets a longer silence, though: a student who has
  // stumbled and is working out where to come back in has not finished the
  // piece, and ending the take there would score their hesitation as the end of
  // the passage — the one place the app would be harsher than a judge. Once most
  // of the notes have been heard, the shorter wait returns.
  const quiet = elapsed - take.lastVoiced;
  const unfinished = take.expected > 0 && take.onsets < take.expected * 0.8;
  // An assisted run that has heard nothing at all is over: the student pressed
  // start, listened to the count-in, and did not play. Without this it would sit
  // there running the click track to the end of the passage, which reads as a
  // frozen app. A student who *has* played is never cut off by this — it only
  // fires while nothing has sounded.
  const neverStarted = take.assisted && take.onsets === 0 && elapsed > 6;
  // An assisted run is on a clock, so it knows whether the passage can be over:
  // before the last bar's time is up only a long silence ends it.
  const early = take.assisted && take.endsAt > 0 && elapsed < take.endsAt;
  const wait = early ? 6 : unfinished ? 4.5 : 2.2;
  if ((take.frames.length > 40 && quiet > wait) || neverStarted) {
    finishSightTake();
  }
}

function stopSightTake(analyse = true) {
  if (sight.phase === 'idle' && !sight.take) return;
  const take = sight.take;
  sightBuddy?.listen(false);
  sight.phase = 'idle';
  sight.take = null;
  el.sightStop.hidden = true;
  el.sightStart.hidden = false;
  el.sightLive.hidden = true;
  el.sightLive.hidden = true;
  if (el.sightLevel) el.sightLevel.hidden = true;
  // the clicks have to be told to stop — otherwise they play on after the take,
  // and after the student has left the screen. The count-in box and the line go
  // with them; a line left standing on the staff looks like a frozen app.
  stopAssistAudio();
  hidePlayhead();
  // Nothing stale left behind: a reading only exists while a take is running.
  resetSightLive();
  const keep = Boolean(analyse && take && take.started);
  if (take?.rec) {
    const rec = take.rec;
    take.rec = null;
    rec.stop().then((blob) => {
      if (!keep || !blob || sight.take) return;
      // Where the take began in the recording, in seconds — the bars are found
      // from there (see sightReplayOffset).
      sight.replay = { blob, lead: Math.max(0, ((take.perfT0 || rec.startedAt) - rec.startedAt) / 1000), result: sight.result, passage: sight.passage };
      paintReplayButton();
    });
  }
  if (analyse && take && take.started) {
    const result = analyzeSightTake(take.frames, sight.passage);
    // Compared against earlier readings at this level, before this one is filed.
    result.compared = Journal.compareTake(Journal.sightEntry(journal, sight.level), result.score);
    renderSightResult(result);
    noteTake('sight', null, result.score, {
      parts: {
        accuracy: result.accuracy,
        intonation: result.intonation,
        rhythm: result.rhythm,
        flow: result.continuity,
      },
      bpm: result.unit ? Math.round(60 / (result.unit * 4)) : 0,
      heard: result.heard,
      expected: result.expected,
      seconds: result.duration,
      // A run with the clicks and the line is kept, and kept apart: a score with
      // the wheels on is not the same claim as one without.
      assisted: Boolean(take.assisted),
    });
    if (lastTakeCounted) sightBuddy?.cheer();
    else sightBuddy?.curious();
  } else {
    el.sightStatus.textContent = '';
  }
}

function finishSightTake() {
  stopSightTake(true);
}

function renderSightResult(result) {
  el.sightResult.hidden = false;
  el.sightStatus.textContent = '';
  // Kept, so the score can carry the lane until the next passage replaces it.
  sight.result = result;

  if (!result.heard || result.heard < 3) {
    el.sightPct.textContent = '–';
    el.sightGrade.textContent = t('result.nothing.title');
    el.sightLine.textContent = t('result.nothing.body');
    el.sightParts.innerHTML = '';
    paintIntonationLine(el.sightIntonationSum, []);
    el.sightTips.innerHTML = '';
    return;
  }

  const grade = gradeFor(result.score);
  el.sightPct.textContent = `${result.score}%`;
  el.sightGrade.textContent = grade.label;
  const compared = result.compared ? compareLine(result.compared) : '';
  el.sightLine.textContent = compared ? `${grade.note} ${compared}` : grade.note;

  const pct = (v) => `${Math.round(v * 100)}%`;
  const rows = [
    [t('sight.partNotes'), pct(result.exact / Math.max(1, result.expected))],
    [t('sight.partTuned'), pct(result.intonation)],
    [t('sight.partPulse'), pct(result.rhythm)],
    [
      t('sight.partStops'),
      result.stops === 0
        ? t('test.noStops')
        : result.stops === 1
          ? t('test.stopOne')
          : t('test.stops', { n: result.stops }),
    ],
  ];
  const keys = ['sightNotes', 'sightTuned', 'sightPulse', 'sightStops'];
  el.sightParts.innerHTML = rows
    .map(
      ([label, value], i) =>
        `<li data-explain="${keys[i]}"><button class="part-btn" type="button" aria-expanded="false"><span>${label} <span class="explain-i" aria-hidden="true">ⓘ</span></span><span>${value}</span></button><p class="explain-text" hidden>${t(`explain.${keys[i]}`)}</p></li>`,
    )
    .join('');
  // The picture is drawn with the notes; this is the count under it.
  paintIntonationLine(el.sightIntonationSum, result.results);
  renderSight();


  // A handful of kind, specific observations rather than a verdict, ordered by
  // what a teacher would say first: where it broke, then how fast it went, then
  // the pitch.
  const tips = [];
  const missed = result.missed.length;
  if (missed > 0) {
    tips.push(t('sight.tipMissed', { n: missed, total: result.expected }));
  } else if (result.wrong + result.octaveErrors > 0) {
    tips.push(
      t('sight.tipWrong', { n: result.wrong + result.octaveErrors, total: result.expected }),
    );
  } else if (result.extras.length >= 3) {
    // Nothing was missing and nothing was wrong — the passage simply went round
    // part of itself. A student who has gone back to pick the piece up again
    // deserves to be told that is what the app heard, rather than "every note
    // was there", which is true and quietly misleading.
    tips.push(t('sight.tipRepeat', { n: result.extras.length }));
  } else {
    tips.push(t('sight.tipAllNotes'));
  }
  if (result.worstBars && result.worstBars.length) {
    const bars = result.worstBars.map((b) => b.bar).sort((a, b) => a - b);
    tips.push(
      t(bars.length === 1 ? 'sight.tipBar.one' : 'sight.tipBar.many', { bars: bars.join(' & ') }),
    );
  }
  if (result.tempo) {
    tips.push(
      t(result.tempo.faster ? 'sight.tipTempo.faster' : 'sight.tipTempo.slower', {
        played: result.tempo.played,
        printed: result.tempo.printed,
      }),
    );
  }
  const off = result.results.filter((r) => r.status === 'exact' && Math.abs(r.cents) > 25);
  if (off.length) {
    const first = off[0];
    tips.push(
      t('sight.tipIntonation', {
        n: off.length,
        dir: first.cents > 0 ? t('sight.sharp') : t('sight.flat'),
      }),
    );
  }
  if (result.rhythm < 0.75) tips.push(t('sight.tipPulse'));
  if (result.stops > 0) tips.push(t('sight.tipStops', { n: result.stops }));
  if (result.entries && result.entries.length) {
    const e = result.entries[0];
    tips.push(
      t(e.bias < 0 ? 'sight.tipEarly' : 'sight.tipLate', {
        value: t(NOTE_VALUE_KEY[e.dur] || 'noteValue.some'),
      }),
    );
  }
  // The one reading the app phrases as a question: a note's ending is decided by
  // when the sound stops, and a live room can shorten that in the evidence
  // without the player having done anything wrong.
  if (result.shortHeld) {
    tips.push(
      t('sight.tipShortHeld', { value: t(NOTE_VALUE_KEY[result.shortHeld.dur] || 'noteValue.some') }),
    );
  }
  // What the listening noticed rather than what it scored: a pitch that keeps
  // sitting off, or a take that sped up. Specific enough to act on tonight.
  if (result.habits && result.habits.bias) {
    const bias = result.habits.bias;
    tips.push(
      t(bias.cents > 0 ? 'tip.bias.high' : 'tip.bias.low', {
        n: bias.n,
        cents: Math.abs(bias.cents).toFixed(0),
      }),
    );
  }
  if (result.habits && result.habits.drift) {
    tips.push(
      t(result.habits.drift.faster ? 'tip.drift.faster.text' : 'tip.drift.slower.text', {
        pct: Math.abs((result.habits.drift.factor - 1) * 100).toFixed(0),
      }),
    );
  }

  el.sightTips.innerHTML = tips.slice(0, 4).map((text) => `<li>${text}</li>`).join('');
}

/**
 * Synthetic frames for a sight-reading take, so the result screen can be looked
 * at without a microphone — the same trick the scale demo uses.
 */
function sightDemoFrames(passage, unit = 0.32, centsByIndex = {}, voice = {}) {
  // A phone does not deliver a confident, perfectly periodic frame: the level is
  // lower and the first reading of a fresh bow attack is smeared. `voice` lets a
  // suite hand the app that kind of take instead of an ideal one.
  const clarity = voice.clarity ?? 0.95;
  const rms = voice.rms ?? 0.06;
  const silentRms = voice.silentRms ?? 0.0005;
  const events = [];
  passage.bars.forEach((barEvents, barIndex) => {
    for (const event of barEvents) {
      if (event.rest || !event.note) continue;
      events.push({ ...event, abs: barIndex * passage.perBar + event.start });
    }
  });
  const frames = [];
  events.forEach((event, i) => {
    const start = event.abs * unit;
    const dur = Math.max(0.12, event.dur * unit * 0.85);
    const cents = centsByIndex[i] || 0;
    const freq = midiToFreq(event.note.midi) * Math.pow(2, cents / 1200);
    for (let t = 0; t < dur; t += 0.03) {
      frames.push({ t: start + t, freq, clarity, rms });
    }
    frames.push({ t: start + dur + 0.01, freq: 0, clarity: 0, rms: silentRms });
  });
  return frames;
}

/**
 * Two bars of clicks at the passage's own tempo, with a heavier downbeat.
 *
 * The marking is in whatever note value the Manual prints — quarter in most
 * metres, half in cut time, eighth in level VI's 6/8 — so the click track
 * ticks at *that* value and puts the accent on each beat. A marking of
 * "♪ = 120" has to sound like 120 eighths, not 40 dotted quarters.
 */
function playTempo(passage) {
  // The clicks share the player's context and its volume: one audio context per
  // page (browsers hand out only a few), and one slider for every sound the app
  // makes, so turning the example down turns the metronome down with it.
  const clickCtx = player.context;
  if (clickCtx.state === 'suspended') clickCtx.resume().catch(() => {});

  const unit = unitLength(passage.tempo.unit);
  const tickSeconds = 60 / passage.tempo.bpm;
  const ticksPerBar = Math.max(1, Math.round(passage.perBar / unit));
  const ticksPerBeat = Math.max(1, Math.round(passage.beat / unit));
  const ticks = ticksPerBar * 2;
  const start = clickCtx.currentTime + 0.12;

  el.sightTempoBtn.disabled = true;
  setTimeout(() => {
    el.sightTempoBtn.disabled = false;
  }, (ticks * tickSeconds + 0.4) * 1000);

  for (let i = 0; i < ticks; i++) {
    const when = start + i * tickSeconds;
    const downbeat = i % ticksPerBar === 0;
    const beat = i % ticksPerBeat === 0;
    const osc = clickCtx.createOscillator();
    const gain = clickCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = downbeat ? 1320 : beat ? 880 : 760;
    // These levels are set against the example, not in the abstract: a click is
    // 70 ms of sine where a played note is a shaped tone held for a beat, so at
    // the old 0.22/0.12/0.07 the metronome was inaudible under the passage — the
    // teacher could hear the example at the same slider position and not this.
    // Roughly the same peak as the voice, which puts them at the same loudness.
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(downbeat ? 0.5 : beat ? 0.34 : 0.24, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    osc.connect(gain).connect(player.output);
    osc.start(when);
    osc.stop(when + 0.09);
  }
}

el.openSightBtn.addEventListener('click', () => openSight());
el.sightBack.addEventListener('click', goHome);
el.sightNewBtn.addEventListener('click', () => newPassage(sight.level));
el.sightStart.addEventListener('click', () => {
  stopSightReplay();
  startSightTake();
});
el.sightReplayBtn?.addEventListener('click', playSightReplay);
el.sightStop.addEventListener('click', () => stopSightTake(true));
el.sightAgain.addEventListener('click', () => {
  el.sightResult.hidden = true;
  startSightTake();
});
el.sightNext.addEventListener('click', () => newPassage(sight.level));
el.sightHearBtn.addEventListener('click', hearPassage);
// A bar in the drawing is a target: tap it to mark it, tap again to let it go.
el.sightStaff.addEventListener('click', pickBar);
// Speed applies to the next sounding. If the example is already playing, it is
// restarted from the same place at the new speed — reaching for the control and
// then having to press play again would be two gestures for one wish.
el.sightSpeeds.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-rate]');
  if (!btn) return;
  const wasPlaying = player.playing;
  if (wasPlaying) stopHearing();
  sight.rate = Number(btn.dataset.rate) || 1;
  [...el.sightSpeeds.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(b === btn)),
  );
  if (wasPlaying) hearPassage();
});

// The volume is remembered on the device: a student who needs the example louder
// should not have to find the slider again every visit.
const VOLUME_KEY = 'scaleStudio.volume';
function applyVolume(percent) {
  const value = Math.max(0, Math.min(100, Number(percent)));
  el.sightVolume.value = String(value);
  player.setVolume(value / 100);
  try {
    localStorage.setItem(VOLUME_KEY, String(value));
  } catch {
    /* private mode — the slider still works for this visit */
  }
}
let storedVolume = 80;
try {
  const saved = Number(localStorage.getItem(VOLUME_KEY));
  if (Number.isFinite(saved) && saved >= 0 && saved <= 100) storedVolume = saved;
} catch {
  /* no storage */
}
player.setVolume(storedVolume / 100);
el.sightVolume.value = String(storedVolume);
el.sightVolume.addEventListener('input', () => applyVolume(el.sightVolume.value));

// The switch is remembered like the volume, and it stores *test mode* — the
// thing you opt into. A student who wants the audition conditions this week
// should not have to find the switch again next time; everyone else gets the
// count-in and the clicks, which is the default.
try {
  el.sightAssist.checked = localStorage.getItem(ASSIST_KEY) === 'on';
} catch {
  /* no storage — assistance on by default */
}
el.sightAssist.addEventListener('change', () => {
  try {
    localStorage.setItem(ASSIST_KEY, el.sightAssist.checked ? 'on' : 'off');
  } catch {
    /* private mode */
  }
});
el.sightTempoBtn.addEventListener('click', () => {
  if (sight.passage) playTempo(sight.passage);
});
el.sightLevels.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-sight-level]');
  if (!btn) return;
  newPassage(Number(btn.dataset.sightLevel));
});

/* ── Practice log ─────────────────────────────────────────────────────── */

// Three children can share one tablet. The store holds a list of named logs and
// the one on screen; everything below reads `journal`, which is only ever the
// active log, so none of the rules had to learn about names.
const journalStore = Journal.loadStore();
let activeProfile = Journal.active(journalStore);
let journal = activeProfile.state;

/**
 * The pet is kept under the name's id, and on a new device that id is made
 * fresh on every load until the log is first saved — which used to be the
 * first take. An egg chosen before then was lost on a reload. So the first
 * time the pet room keeps anything, the log is saved too.
 */
let profileSaved = false;
function petProfileId() {
  if (!profileSaved) {
    profileSaved = true;
    try {
      if (!localStorage.getItem('scale-studio.journal.v2')) Journal.saveStore(journalStore);
    } catch {
      /* storage blocked: the pet lives for this visit, like the log */
    }
  }
  return activeProfile.id;
}

// The pet room. Each name on the device has its own pet; the room asks whose
// is on screen each time, so switching names switches pets.
petRoom = createPetRoom({
  els: {
    svg: $('petRoom'),
    notes: $('petNotes'),
    panel: $('petPanel'),
    foot: $('petFoot'),
    bubble: $('petBubble'),
    title: $('petTitle'),
    lead: $('petLead'),
  },
  profileId: () => petProfileId(),
  onPractise: () => openScales(),
  demo: params.get('pet') === 'demo',
  // `?hour=21` shows the room at that time of day, for looking at the evening at noon.
  hour: params.has('hour') && params.get('hour') !== '' ? Number(params.get('hour')) : null,
});

// Note Sprint: pick notes, read them against the clock. Its own screen and its
// own stats per name; it borrows the microphone through the same router.
sprintView = createSprintView({
  root: el.views.sprint,
  profileId: () => petProfileId(),
  openMic: async () => {
    cancelListening();
    closeMic();
    micTicket += 1;
    const mic = await openMic(routeFrame);
    state.mic = mic;
    state.micMode = 'sprint';
    return mic;
  },
  closeMic: () => {
    micTicket += 1;
    closeMic();
  },
  getMic: () => state.mic,
  micError: (err) => micErrorMessage(err),
  onFinish: (result) => {
    // A finished sprint is practice: it ticks the day and feeds the pet.
    // Every finished sprint counts, however short or quick: the trial filter
    // that guards scale takes (a cough, a tap) cannot happen here — a sprint
    // only finishes when every note on its list was played.
    noteTake('sprint');
  },
  onBack: () => goHome(),
});
el.openSprintBtn.addEventListener('click', () => {
  sprintView.open();
  showView('sprint');
});

// Listen (beta): free playing, or a piece against its MusicXML score. Same
// microphone router; a real take (twenty seconds or more of notes) is logged as
// practice on a piece.
listenView = createListenView({
  root: el.views.listen,
  openMic: async () => {
    cancelListening();
    closeMic();
    micTicket += 1;
    const mic = await openMic(routeFrame);
    state.mic = mic;
    state.micMode = 'listen';
    return mic;
  },
  closeMic: () => {
    micTicket += 1;
    closeMic();
  },
  getMic: () => state.mic,
  micError: (err) => micErrorMessage(err),
  onFinish: () => noteTake('piece'),
  onBack: () => goHome(),
});
el.openListenBtn.addEventListener('click', () => {
  listenView.open();
  showView('listen');
});
window.__listenView = listenView;

// The pet, small, beside the music: it listens while you play. One on the
// scale card, one by the sight-reading controls, one on the result page.
listenBuddy = createBuddy($('listenBuddy'), { profileId: () => activeProfile.id });
sightBuddy = createBuddy($('sightBuddy'), { profileId: () => activeProfile.id });
resultBuddy = createBuddy($('resultBuddy'), { profileId: () => activeProfile.id });


listenBuddy.refresh();
sightBuddy.refresh();

/** Whether the last take filed was a real one (and not a false start). */
let lastTakeCounted = false;

function openPet() {
  cancelListening();
  showView('pet');
  petRoom.open();
}

/**
 * The menu tile wears the pet's own face once there is one, and says how close
 * the next stage is: a goal you can see the end of is the one people finish.
 */
function paintMenuPet() {
  if (el.menuPetArt) el.menuPetArt.innerHTML = petRoom ? petRoom.portrait() : '';
  if (el.menuPetGrow) el.menuPetGrow.textContent = petRoom ? petRoom.progressLine() : '';
}

let toastTimer = 0;
/**
 * "+5 ♪" after a counted take: the pet noticed. A scale not yet played today
 * gets more: a bonus line, the total counting up, and a burst of notes.
 */
function petToast(amount, warmed, bonus = 0, kind = 'scale', grew = null, wished = 0, wishId = '') {
  if (!amount || !el.petToast) return;
  const name = petRoom.name();
  const line = grew
    ? t(grew === 'grown' ? 'pet.toast.grewUp' : 'pet.toast.grew', { name: esc(name) })
    : warmed
      ? t('pet.toast.warm')
      : name
        ? t('pet.toast.for', { name: esc(name) })
        : t('pet.toast.room');
  // Everything paid on top of the take itself: today's new key, and the key the
  // pet asked for. The take's own notes show at once and the rest counts up.
  const topped = bonus + wished;
  const extra = [
    bonus
      ? `<span class="pet-toast-bonus">${t(kind === 'sight' ? 'pet.toast.newSight' : kind === 'sprint' ? 'pet.toast.newSprint' : 'pet.toast.newScale', { n: bonus })}</span>`
      : '',
    wished
      ? `<span class="pet-toast-bonus pet-toast-wish">${t('pet.toast.keywish', { key: esc(keyName(wishId)) })}</span>`
      : '',
  ].join('');
  el.petToast.innerHTML =
    `${petRoom.portrait()}<span class="pet-toast-text"><span class="pet-toast-top">` +
    `<span class="pet-toast-n">+${topped ? amount - topped : amount} ♪</span>` +
    `<span class="pet-toast-line">${line}</span></span>${extra}</span>`;
  el.petToast.classList.toggle('has-bonus', Boolean(topped));
  el.petToast.hidden = false;
  el.petToast.classList.remove('is-in');
  void el.petToast.offsetWidth;
  el.petToast.classList.add('is-in');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.petToast.hidden = true;
    document.querySelectorAll('.note-burst').forEach((n) => n.remove());
  }, topped ? 4200 + (wished ? 600 : 0) : 3200);

  if (!topped) return;
  // Once the toast has landed, the total counts up by the bonus and notes burst
  // out of it. Reduced motion keeps the count and the line, without the burst.
  const counter = el.petToast.querySelector('.pet-toast-n');
  const from = amount - topped;
  setTimeout(() => {
    let shown = from;
    const step = setInterval(() => {
      shown += 1;
      counter.textContent = `+${shown} ♪`;
      counter.classList.remove('is-pop');
      void counter.offsetWidth;
      counter.classList.add('is-pop');
      if (shown >= amount) clearInterval(step);
    }, 110);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = counter.getBoundingClientRect();
    const glyphs = ['♪', '♫', '♩', '♬'];
    for (let i = 0; i < 12; i++) {
      const n = document.createElement('span');
      n.className = 'note-burst';
      n.textContent = glyphs[i % glyphs.length];
      const angle = -Math.PI / 2 + (i / 11 - 0.5) * Math.PI * 1.15;
      const dist = 60 + Math.random() * 50;
      n.style.left = `${box.left + box.width / 2}px`;
      n.style.top = `${box.top + box.height / 2}px`;
      n.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      n.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      n.style.setProperty('--spin', `${(Math.random() - 0.5) * 90}deg`);
      n.style.animationDelay = `${i * 25}ms`;
      n.style.color = ['#e0708a', '#e8a33d', '#4f9a7c', '#6a7fd0'][i % 4];
      document.body.appendChild(n);
      n.addEventListener('animationend', () => n.remove());
    }
  }, 450);
}
const recorder = { live: null, takes: [], playing: null };
// Set when the browser refuses to write. The screen says so rather than letting
// a whole term's log disappear at the next reload without a word.
let storageBlocked = false;
let nameMode = { kind: 'add' };

const esc = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/** The name as the reader should see it — an empty name is "Me". */
function displayName(profile) {
  return profile && profile.name ? profile.name : t('log.me');
}

function todayKey() {
  return Journal.dayKey();
}

function keyName(id) {
  const card = MAJOR_KEYS.find((k) => k.id === id);
  if (card) return card.variants[0].name;
  // A minor key is kept as "Gm"; say it the way the grid does.
  const minor = MINOR_KEYS.find((k) => k.id === id);
  if (minor) return `${minor.variants[0].name}${getLang() === 'zh' ? '小调' : ' minor'}`;
  return id;
}

function saveJournal() {
  storageBlocked = !Journal.saveStore(journalStore);
  if (el.logWarn) el.logWarn.hidden = !storageBlocked;
  if (Journal.lastTrim()) spaceTrimmed = true;
  renderLogBanner();
}

/** Whether a save this visit had to trim old take records to fit. */
let spaceTrimmed = false;

// ── Everyone on the device ─────────────────────────────────────────────────

/** "Practised today", "Last practised 3 Nov", or "Not yet". */
function lastPractisedLine(profile) {
  const key = Journal.lastPractised(profile);
  if (!key) return t('who.never');
  if (key === todayKey()) return t('who.today');
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d).toLocaleDateString(getLang() === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
  return t('who.last', { date });
}

function paintWhoList() {
  const query = el.whoSearch.value.trim().toLowerCase();
  const locale = getLang() === 'zh' ? 'zh-CN' : 'en-US';
  const people = journalStore.profiles
    .filter((p) => !query || displayName(p).toLowerCase().includes(query))
    .sort((a, b) => displayName(a).localeCompare(displayName(b), locale, { sensitivity: 'base' }));
  el.whoList.innerHTML = people.length
    ? people
        .map(
          (p) => `<li><button class="who-item" type="button" data-who="${esc(p.id)}" ${
            p.id === activeProfile.id ? 'aria-current="true"' : ''
          }>
            <span class="who-name">${esc(displayName(p))}</span>
            <span class="who-meta">${esc(lastPractisedLine(p))}</span>
            ${p.id === activeProfile.id ? '<span class="who-tick" aria-hidden="true">✓</span>' : ''}
          </button></li>`,
        )
        .join('')
    : `<li class="who-empty">${t('who.none')}</li>`;
  const count = journalStore.profiles.length;
  const full = count >= Journal.MAX_PROFILES;
  el.whoAdd.hidden = full;
  el.whoNote.textContent = [
    full ? t('who.full', { max: Journal.MAX_PROFILES }) : count > 10 ? t('who.count', { n: count, max: Journal.MAX_PROFILES }) : '',
    spaceTrimmed ? t('who.room') : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function openWhoDialog() {
  el.whoTitle.textContent = t('who.title');
  el.whoSearch.placeholder = t('who.search');
  el.whoAddInput.placeholder = t('who.newName');
  el.whoAddBtn.textContent = t('log.add');
  el.whoClose.textContent = t('who.done');
  el.whoSearch.value = '';
  // A search box for a long list; a short one is read at a glance.
  el.whoSearch.hidden = journalStore.profiles.length <= 8;
  paintWhoList();
  if (!el.whoDialog.open) el.whoDialog.showModal();
  if (!el.whoSearch.hidden && !matchMedia('(pointer: coarse)').matches) el.whoSearch.focus();
}

el.whoSearch.addEventListener('input', paintWhoList);
el.whoClose.addEventListener('click', () => el.whoDialog.close());
el.whoList.addEventListener('click', (event) => {
  const b = event.target.closest('[data-who]');
  if (!b) return;
  switchProfile(b.dataset.who);
  el.whoDialog.close();
});
el.whoAdd.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = el.whoAddInput.value.trim();
  if (!value) {
    el.whoAddInput.focus();
    return;
  }
  const before = journalStore.profiles.length;
  const profile = Journal.addProfile(journalStore, value);
  if (!profile) {
    el.whoNote.textContent = journalStore.profiles.length >= Journal.MAX_PROFILES ? t('who.full', { max: Journal.MAX_PROFILES }) : t('log.nameTaken');
    return;
  }
  // A name already on the list is simply switched to.
  journalStore.current = profile.id;
  Journal.touchProfile(journalStore, profile.id);
  activeProfile = profile;
  journal = profile.state;
  saveJournal();
  el.whoAddInput.value = '';
  renderWho();
  if (!el.views.track.hidden) renderLog();
  el.whoDialog.close();
  void before;
});

/** The one-line summary on the home card. */
function renderLogBanner() {
  if (!el.logBannerText) return;
  const today = todayKey();
  const days = Journal.streak(journal, today);
  const sheet = Journal.weekSheet(journal, today, []);
  // On a shared device the name belongs in the one-line summary, or the home
  // screen is quietly about nobody in particular — including when the log is
  // empty, which is exactly when somebody has just switched and needs to know
  // that the blank week in front of them is theirs.
  const who = journalStore.profiles.length > 1 ? displayName(activeProfile) : '';
  el.logBannerText.textContent = !days
    ? who
      ? t('log.banner.emptyNamed', { name: who })
      : t('log.banner.empty')
    : who
      ? t('log.banner.named', { name: who, n: days, days: sheet.days })
      : t('log.banner.streak', { n: days, days: sheet.days });
}

function chips(container, items, dataKey, isOn, label) {
  container.innerHTML = items
    .map(
      (item) =>
        `<button class="chip" type="button" data-${dataKey}="${item}" aria-pressed="${isOn(
          item,
        )}">${label(item)}</button>`,
    )
    .join('');
}

/**
 * The note to the student at the foot of the week sheet.
 *
 * The data picks the sentence (journal.weekNote); this only turns it into words.
 * One thing is noticed, then one thing is suggested — the shape a teacher uses,
 * and the shape the evidence supports: specific, comparative, and never a score
 * for a week that did not happen.
 */
function weekNoteText(ids, today) {
  const note = Journal.weekNote(journal, today, ids);
  const main = t(`note.${note.kind}`, {
    days: note.days,
    target: note.target,
    done: note.done,
  });

  // One extra sentence, chosen by what the week actually contains. Naming a
  // scale that came good beats a generic encouragement; if there is none, the
  // thing they said was hard is the next best; if neither, the run they are on.
  let extra = '';
  if (note.ready && note.ready.length) {
    extra = t('note.extra.ready', { names: note.ready.map((id) => keyName(id)).join(', ') });
  } else if (note.hard) {
    // The chip is a label ("Intonation"); inside a sentence it reads as a word.
    const thing = t(`log.hard.${note.hard}`);
    const inline = getLang() === 'zh' ? thing : thing.charAt(0).toLowerCase() + thing.slice(1);
    extra = t('note.extra.hard', { thing: inline });
  } else if (note.streak >= 3) {
    extra = t('note.extra.streak', { n: note.streak });
  } else {
    extra = t('note.extra.go');
  }
  return `${main} ${extra}`;
}

function sheetText() {
  const today = todayKey();
  const ids = MAJOR_KEYS.map((k) => k.id);
  const s = Journal.weekSheet(journal, today, ids);
  const date = new Date(...s.start.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))));
  const when = date.toLocaleDateString(getLang() === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
  // The sheet is copied out of the browser and onto a lesson page, so on a shared
  // device it has to say whose week it is.
  const headed =
    journalStore.profiles.length > 1
      ? `${displayName(activeProfile)} · ${t('log.sheet.week', { date: when })}`
      : t('log.sheet.week', { date: when });
  const lines = [headed];
  // The student's own goal, on the sheet the teacher reads: it turns "well done"
  // into "you said three days and you did four", which is the specific kind of
  // feedback the violin-learning evidence favours over general praise.
  const goal = Journal.goalProgress(journal, today, ids);
  if (goal) {
    const said =
      goal.kind === 'ready'
        ? t('log.goal.readyN', { n: goal.target })
        : t(goal.target === 1 ? 'log.goal.days1' : 'log.goal.daysN', { n: goal.target });
    lines.push(t('log.sheet.goal', { goal: said, done: goal.done, target: goal.target }));
  }
  // "Practiced 1 days" is exactly the sort of thing that makes an app feel
  // machine-written, and this sheet is read aloud in a lesson.
  const daysKey =
    s.days === 1
      ? s.rests === 1
        ? 'log.sheet.dayRest1'
        : s.rests === 0
          ? 'log.sheet.day1'
          : 'log.sheet.day1Rest'
      : s.rests === 1
        ? 'log.sheet.rest1'
        : s.rests === 0
          ? 'log.sheet.daysNone'
          : 'log.sheet.days';
  lines.push(t(daysKey, { n: s.days, rests: s.rests }));
  if (s.takes) lines.push(t('log.sheet.takes', { n: s.takes }));
  const tags = Object.entries(s.tags)
    .map(([tag, n]) => `${t(`log.tag.${tag}`)} ×${n}`)
    .join(', ');
  if (tags) lines.push(t('log.sheet.did', { list: tags }));
  if (s.hard.length) {
    const list = s.hard.map((h) => `${t(`log.hard.${h.key}`)} ×${h.n}`).join(', ');
    lines.push(t('log.sheet.hard', { list }));
  }
  lines.push(t('log.sheet.ready', { n: s.ready.length, total: s.total }));
  if (s.ready.length) lines.push(`  ${s.ready.map(keyName).join(', ')}`);
  return lines.join('\n');
}

function renderRecList() {
  el.recList.innerHTML = recorder.takes
    .map(
      (take, i) => `<li class="rec-item">
        <button class="quiet-btn small" type="button" data-play="${i}">▶</button>
        <span class="rec-name">${t('log.take', { n: recorder.takes.length - i })}</span>
        <span class="rec-len">${take.seconds ? `${take.seconds.toFixed(0)}″` : ''}</span>
      </li>`,
    )
    .join('');
}

/** The names row and the manage list — one source, so they cannot disagree. */
/** Up to this many names, the row shows them all; past it, the row is short. */
const WHO_ROW_MAX = 6;

/**
 * The chips for a names row. A family fits on one row, so it shows everyone. A
 * studio does not: the row then shows whoever is on, the few used most recently,
 * and "Everyone (n)", which opens the full, searchable list.
 */
function whoChipsMarkup(full) {
  const all = journalStore.profiles;
  const chip = (profile) =>
    `<button class="chip" type="button" data-who="${esc(profile.id)}" ` +
    `aria-pressed="${profile.id === activeProfile.id}">${esc(displayName(profile))}</button>`;
  if (all.length <= WHO_ROW_MAX) {
    return (
      all.map(chip).join('') +
      (full ? '' : `<button class="chip add-chip" type="button" data-who-add="1">${t('log.addName')}</button>`)
    );
  }
  const recent = all
    .filter((p) => p.id !== activeProfile.id)
    .sort((a, b) => (b.used || 0) - (a.used || 0))
    .slice(0, WHO_ROW_MAX - 2);
  return (
    [activeProfile, ...recent].map(chip).join('') +
    `<button class="chip add-chip" type="button" data-who-all="1">${t('who.all', { n: all.length })}</button>`
  );
}

function renderWho() {
  const full = journalStore.profiles.length >= Journal.MAX_PROFILES;
  const multiple = journalStore.profiles.length > 1;
  // The row is always on the home screen now, even for one name: with a single
  // "Me" chip and an Add beside it, a parent can see that more than one log is
  // possible without first having to find the log screen. Hiding it until a
  // second name existed made the feature undiscoverable — which is exactly what
  // the teacher reported.
  el.homeWho.hidden = false;
  el.homeWhoChips.innerHTML = whoChipsMarkup(full);
  el.homeWho.classList.toggle('is-single', !multiple);
  // Each name has its own pet: the menu tile and the little listeners follow.
  paintMenuPet();
  listenBuddy?.refresh();
  sightBuddy?.refresh();

  el.whoChips.innerHTML = whoChipsMarkup(full);

  const alone = journalStore.profiles.length < 2;
  el.nameList.innerHTML = journalStore.profiles
    .map(
      (profile) => `<li class="rec-item">
        <span class="rec-name">${esc(displayName(profile))}</span>
        <span class="name-actions">
          <button class="quiet-btn small" type="button" data-rename="${esc(profile.id)}">${t(
            'log.rename',
          )}</button>
          ${
            alone
              ? ''
              : `<button class="quiet-btn small" type="button" data-remove="${esc(
                  profile.id,
                )}">${t('log.remove')}</button>`
          }
        </span>
      </li>`,
    )
    .join('');
}

function renderLog() {
  const today = todayKey();
  const days = Journal.streak(journal, today);
  el.streakNum.textContent = String(days);
  renderWho();

  // The plan line repeats whatever the menu says, in the reader's language,
  // rather than keeping a second copy of the four phrases to drift out of step.
  el.planSelect.value = journal.plan || '';
  const option = el.planSelect.options[el.planSelect.selectedIndex];
  el.streakPlan.textContent = journal.plan
    ? t('log.planLine', { when: option ? option.textContent : '' })
    : t('log.planEmpty');

  const resting = Journal.isRest(journal, today);
  el.restBtn.textContent = resting ? t('log.resting') : t('log.rest');
  el.restBtn.setAttribute('aria-pressed', String(resting));

  el.weekGrid.innerHTML = Journal.weeks(journal, today, 5)
    .flat()
    .map((day) => {
      const cls = day.future ? 'day future' : day.practiced ? 'day on' : day.rest ? 'day rest' : 'day';
      return `<span class="${cls}${day.today ? ' today' : ''}" title="${day.key}"></span>`;
    })
    .join('');
  const sheet = Journal.weekSheet(journal, today, []);
  el.weekCount.textContent = t('log.thisWeek', { n: sheet.days });

  // The weekday letters come from the reader's own calendar, so a Chinese
  // student sees 一 to 日 instead of an English row they have to translate.
  const locale = getLang() === 'zh' ? 'zh-CN' : 'en-US';
  el.weekDays.innerHTML = Array.from({ length: 7 }, (_, i) => {
    const monday = new Date(2026, 2, 2 + i); // a Monday, so the week reads M to S
    return `<span>${monday.toLocaleDateString(locale, { weekday: 'narrow' })}</span>`;
  }).join('');

  chips(
    el.todayChips,
    Journal.TAGS,
    'tag',
    (tag) => Boolean(journal.days[today] && journal.days[today].tags.includes(tag)),
    (tag) => t(`log.tag.${tag}`),
  );
  chips(
    el.hardChips,
    Journal.HARD,
    'hard',
    (what) => Journal.hardThatDay(journal, today).includes(what),
    (what) => t(`log.hard.${what}`),
  );

  const ids = MAJOR_KEYS.map((k) => k.id);
  renderReady(ids);

  renderWeekWins(ids, today);

  el.weekNote.textContent = weekNoteText(ids, today);
  el.lessonSheet.textContent = sheetText();
  el.copySheet.textContent = t('log.copy');
  if (!el.shareSheet.hidden) el.shareSheet.textContent = t('log.share');
  if (!recorder.live) el.recBtn.textContent = t('log.record');
  renderRecList();
}

/**
 * The scales-ready section, framed by what the audition actually asks for.
 *
 * The Manual asks a level I student for *three* scales, one octave, chosen by
 * them. Showing twelve tiles and "0 of 2 days" under every one of them says the
 * opposite — that all twelve must come good — and that is the sort of quiet
 * pressure that makes a beginner put the app down. So the section carries the
 * level, the sentence and the count that go with it, and at levels I–IV it says
 * plainly that the student picks which ones.
 */
function renderReady(ids) {
  const p = Journal.auditionProgress(journal, ids);
  [...el.auditionLevels.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.audition === p.group)),
  );

  el.readyHint.textContent = t(`log.ready.hint.${p.group}`, { n: p.need });
  el.readyCount.textContent = t(
    p.met ? 'log.ready.met' : 'log.ready.count',
    { done: p.done, need: p.need },
  );
  el.readyCount.classList.toggle('is-met', p.met);

  const first = new Set(Journal.FIRST_THREE);
  el.readyList.innerHTML = Journal.scalesReady(journal, ids)
    .map((s) => {
      // At the beginner levels the usual first three are marked, so a student who
      // has no idea where to start is not choosing from twelve at random.
      const suggested = p.choose && p.group === '1-2' && first.has(s.id);
      const cls = ['ready-item', s.ready && 'is-ready', suggested && 'is-suggested']
        .filter(Boolean)
        .join(' ');
      // The dashed border is the only mark the suggested scales get: the sentence
      // above already names them, and a second line of text on three tiles out of
      // twelve made the grid ragged for no extra information.
      const sub = s.ready ? t('log.ready') : t('log.readyOf', { n: s.days, total: Journal.READY_DAYS });
      const hint = suggested ? ` title="${t('log.ready.suggested')}"` : '';
      return `<div class="${cls}"${hint}>
        <span class="ready-key">${keyName(s.id)}</span>
        <span class="ready-sub">${sub}</span>
      </div>`;
    })
    .join('');
}

el.auditionLevels.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-audition]');
  if (!btn) return;
  Journal.setAudition(journal, btn.dataset.audition);
  saveJournal();
  renderReady(MAJOR_KEYS.map((k) => k.id));
});

/**
 * The student's own goal for the week, and the week measured against it.
 *
 * Two rules from the evidence shape this. Progress that is *recorded* and
 * *shown back* is what changes behaviour ([Harkin et al., 2016]); and the goal
 * has to be specific, close at hand, and chosen by the student rather than
 * handed to them, because the need least met in the music-school data is
 * autonomy ([Wieser et al., 2024]). So: a short menu, no nagging, and a count
 * that can only say what the log actually holds.
 */
function renderWeekWins(ids, today) {
  const goal = Journal.goalProgress(journal, today, ids);
  if (!goal) {
    el.goalLine.textContent = t('log.goal.none');
    el.goalCount.textContent = '';
    el.goalTrack.hidden = true;
  } else {
    el.goalLine.textContent =
      goal.kind === 'ready'
        ? t(goal.target === 1 ? 'log.goal.ready1' : 'log.goal.readyN', { n: goal.target })
        : t(goal.kind === 'days' && goal.target === 1 ? 'log.goal.days1' : 'log.goal.daysN', {
            n: goal.target,
          });
    el.goalCount.textContent = t('log.goal.count', { done: goal.done, target: goal.target });
    el.goalTrack.hidden = false;
    el.goalFill.style.width = `${Math.round((goal.done / goal.target) * 100)}%`;
    el.goalFill.classList.toggle('is-met', goal.met);
  }

  const keys = Journal.GOALS.map(Journal.goalKey);
  chips(
    el.goalChips,
    keys,
    'goal',
    (key) => Journal.goalKey(journal.goal) === key,
    (key) => {
      const [kind, target] = key.split(':');
      const n = Number(target);
      return kind === 'days'
        ? t(n === 1 ? 'log.chip.day1' : 'log.chip.days', { n })
        : t(n === 1 ? 'log.chip.scale1' : 'log.chip.scales', { n });
    },
  );

  const wins = Journal.smallWins(journal, today, ids);
  const rows = [];
  if (!wins.hasAnyHistory) {
    rows.push(`<li class="win-empty">${t('log.win.none')}</li>`);
  } else {
    const compare = (now, before, one, many) => {
      if (before == null) return t('log.win.first');
      const diff = now - before;
      if (diff === 0) return t('log.win.same');
      return diff > 0 ? t('log.win.more', { n: diff }) : t('log.win.less', { n: -diff });
    };
    const days =
      wins.days === 1 ? t('log.win.day1') : t('log.win.daysN', { n: wins.days });
    rows.push(
      `<li><span class="win-label">${t('log.win.daysLabel')}</span>` +
        `<span class="win-value">${days}<em>${compare(wins.days, wins.lastDays)}</em></span></li>`,
    );

    // Naming the scales is the point: "2 scales ready" is a number, "G major,
    // D major" is an achievement.
    const named = wins.readyNames.map((id) => keyName(id));
    const readyValue =
      named.length === 0
        ? t('log.win.readyNone')
        : t(named.length === 1 ? 'log.win.ready1' : 'log.win.readyN', { n: named.length }) +
          `: ${named.join(', ')}`;
    rows.push(
      `<li><span class="win-label">${t('log.win.readyLabel')}</span>` +
        `<span class="win-value">${readyValue}</span></li>`,
    );

    rows.push(
      `<li><span class="win-label">${t('log.win.takesLabel')}</span>` +
        `<span class="win-value">${wins.takes}<em>${compare(wins.takes, wins.lastTakes)}</em></span></li>`,
    );
  }
  el.winsList.innerHTML = rows.join('');
}

el.goalChips.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-goal]');
  if (!btn) return;
  const key = btn.dataset.goal;
  const [kind, target] = key.split(':');
  // Tapping the goal already chosen lets it go, the same way a picked bar does.
  const same = Journal.goalKey(journal.goal) === key;
  Journal.setGoal(journal, same ? null : kind, same ? null : Number(target));
  saveJournal();
  renderLog();
});

function openTrack() {
  cancelListening();
  showView('track');
  renderLog();
}

/* ── Your stats ──────────────────────────────────────────────────────── */

const statsView = { tab: 'scale', sort: 'average' };

/**
 * A sparkline of the last dozen scores: no axes, no labels, just the shape.
 * Drawn as an SVG polyline so it stays sharp at any size and costs nothing.
 */
function sparkline(scores, { width = 104, height = 24 } = {}) {
  if (!scores || scores.length < 2) return '<span class="spark-empty">—</span>';
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = Math.max(6, max - min);
  const x = (i) => (i / (scores.length - 1)) * (width - 6) + 3;
  const y = (v) => height - 4 - ((v - min) / span) * (height - 8);
  const points = scores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = scores[scores.length - 1];
  return (
    `<svg class="spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">` +
    `<polyline points="${points}" fill="none" stroke="#2f5d4e" stroke-width="1.6" ` +
    `stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${x(scores.length - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="2.2" fill="#2f5d4e"/>` +
    '</svg>'
  );
}

const statRow = (key, value) => `<div class="stat-row"><span>${key}</span><strong>${value}</strong></div>`;

function renderStats() {
  const today = todayKey();
  const ids = MAJOR_KEYS.map((k) => k.id);
  const counted = Journal.recentTakes(journal, { counted: true });
  const scales = Journal.recentTakes(journal, { kind: 'scale', counted: true });
  const sightTakes = Journal.recentTakes(journal, { kind: 'sight', counted: true });
  const ignored = Journal.trialsIgnored(journal);

  // The summary is about practice, not about one tab.
  const days = Journal.weekSheet(journal, today, ids).days;
  const best = counted.reduce((m, t) => Math.max(m, t.score), 0);
  const lastTen = counted.slice(-10);
  const recentAvg = lastTen.length
    ? Math.round(lastTen.reduce((a, t) => a + t.score, 0) / lastTen.length)
    : null;
  const tiles = [
    [t('stats.takes'), counted.length],
    [t('stats.thisWeek'), days],
    [t('stats.best'), best ? `${best}%` : '—'],
    [t('stats.average'), recentAvg == null ? '—' : `${recentAvg}%`],
    [t('stats.streak'), Journal.streak(journal, today)],
  ];
  el.statsSummary.innerHTML = tiles
    .map(
      ([label, value]) =>
        `<div class="stat-tile"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`,
    )
    .join('');

  [...el.statTabs.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.statTab === statsView.tab)),
  );
  [...el.statSort.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.statSort === statsView.sort)),
  );

  if (statsView.tab === 'scale') {
    const rows = Journal.scaleTotals(journal, ids).sort((a, b) => {
      if (statsView.sort === 'attempts') return b.attempts - a.attempts;
      if (statsView.sort === 'best') return b.best - a.best;
      return b.average - a.average;
    });
    el.statPanel.innerHTML = rows.length
      ? `<div class="stat-table">
          <div class="stat-tr stat-th"><span>${t('stats.scale')}</span><span>${t('stats.shape')}</span><span>${t('stats.tries')}</span><span>${t('stats.average')}</span><span>${t('stats.best')}</span></div>` +
        rows
          .map(
            (row) => `<div class="stat-tr">
              <span class="stat-key">${keyName(row.id)}</span>
              <span class="stat-spark">${sparkline(row.recent)}</span>
              <span>${row.attempts}</span>
              <span>${Math.round(row.average)}%</span>
              <span class="stat-best">${row.best}%</span>
            </div>`,
          )
          .join('') +
        '</div>'
      : `<p class="stat-empty">${t(scales.length ? 'stats.noneMatching' : 'stats.noneScale')}</p>`;
  } else {
    /** One table per kind of run, so an assisted score never props up a solo one. */
    const table = (list, heading) => {
      const byLevel = new Map();
      for (const take of list) {
        const cell = byLevel.get(take.level) || { level: take.level, scores: [], best: 0 };
        cell.scores.push(take.score);
        cell.best = Math.max(cell.best, take.score);
        byLevel.set(take.level, cell);
      }
      const rows = [...byLevel.values()].sort((a, b) => Number(a.level) - Number(b.level));
      if (!rows.length) return '';
      return (
        (heading ? `<h4 class="stat-heading">${heading}</h4>` : '') +
        `<div class="stat-table is-sight">
          <div class="stat-tr stat-th"><span>${t('stats.level')}</span><span>${t('stats.shape')}</span><span>${t('stats.tries')}</span><span>${t('stats.average')}</span><span>${t('stats.best')}</span></div>` +
        rows
          .map((row) => {
            const avg = Math.round(row.scores.reduce((a, b) => a + b, 0) / row.scores.length);
            return `<div class="stat-tr">
              <span class="stat-key">${t('stats.levelN', { n: row.level })}</span>
              <span class="stat-spark">${sparkline(row.scores.slice(-12))}</span>
              <span>${row.scores.length}</span>
              <span>${avg}%</span>
              <span class="stat-best">${row.best}%</span>
            </div>`;
          })
          .join('') +
        '</div>'
      );
    };

    const solo = table(sightTakes.filter((take) => !take.assisted));
    const helped = table(
      sightTakes.filter((take) => take.assisted),
      t('stats.withHelp'),
    );
    el.statPanel.innerHTML = solo || helped
      ? solo + helped
      : `<p class="stat-empty">${t('stats.noneSight')}</p>`;
  }

  if (statsView.tab === 'takes') {
    // Every take, newest first, with the one thing that makes a row worth
    // deleting: what it was, when, and what it scored.
    const list = Journal.recentTakes(journal, { limit: 60 }).slice().reverse();
    el.statPanel.innerHTML = list.length
      ? `<ul class="take-list">${list.map(takeRow).join('')}</ul>`
      : `<p class="stat-empty">${t('stats.noneTakes')}</p>`;
  }

  el.statManage.hidden = statsView.tab !== 'takes';
  el.statNote.textContent = ignored
    ? t(ignored === 1 ? 'stats.ignoredOne' : 'stats.ignored', { n: ignored })
    : '';
}

/** One row of the take list. */
function takeRow(take) {
  const card = take.kind === 'sight' ? null : MAJOR_KEYS.find((k) => k.id === take.id);
  const what =
    take.kind === 'sight'
      ? t('stats.levelN', { n: take.level })
      : card
        ? card.variants.map((v) => v.name).join(' / ')
        : MINOR_KEYS.some((k) => k.id === take.id)
          ? keyName(take.id)
          : t('stats.takeOther');
  const when = new Date(take.at).toLocaleDateString(getLang() === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
  const tags = [when];
  if (take.assisted) tags.push(t('stats.withHelp'));
  if (take.counted === false) tags.push(t('stats.ignoredTag'));
  return `<li class="take-row">
    <span class="take-what">
      <strong>${what}</strong>
      <span class="take-when">${tags.join(' · ')}</span>
    </span>
    <span class="take-score">${take.score}%</span>
    <button class="take-del" type="button" data-del="${take.uid || take.at}"
      aria-label="${t('stats.delete')}" title="${t('stats.delete')}">×</button>
  </li>`;
}


/* ── Erasing ─────────────────────────────────────────────────────────── */

// Deleting a take is two taps: the × turns into "Delete?" and only a second
// tap on it erases. Anything else — another row, a few seconds — lets it go.
let delArmed = null;
let delTimer = 0;
function disarmDelete() {
  clearTimeout(delTimer);
  if (!delArmed) return;
  const b = el.statPanel.querySelector(`button[data-del="${CSS.escape(delArmed)}"]`);
  if (b) {
    b.classList.remove('is-armed');
    b.textContent = '×';
    b.setAttribute('aria-label', t('stats.delete'));
  }
  delArmed = null;
}

/**
 * Tapping a part of a result (Notes, Intonation, Steadiness, Flow; or the sight-
 * reading rows) opens a sentence on what it measures. One open at a time.
 */
function explainPart(event) {
  const btn = event.target.closest('[data-explain] > button');
  if (!btn) return;
  const holder = btn.parentElement;
  const text = holder.querySelector('.explain-text');
  const open = text.hidden;
  holder.parentElement.querySelectorAll('.explain-text').forEach((p) => (p.hidden = true));
  holder.parentElement.querySelectorAll('[data-explain] > button').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  holder.parentElement.querySelectorAll('[data-explain]').forEach((h) => h.classList.remove('is-open'));
  text.hidden = !open;
  holder.classList.toggle('is-open', open);
  btn.setAttribute('aria-expanded', String(open));
}
el.breakdown.addEventListener('click', explainPart);
el.sightParts.addEventListener('click', explainPart);

el.statPanel.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-del]');
  if (!btn) {
    disarmDelete();
    return;
  }
  if (delArmed !== btn.dataset.del) {
    disarmDelete();
    delArmed = btn.dataset.del;
    btn.classList.add('is-armed');
    btn.textContent = t('stats.deleteConfirm');
    btn.setAttribute('aria-label', t('stats.deleteConfirmAria'));
    delTimer = setTimeout(disarmDelete, 4000);
    return;
  }
  disarmDelete();
  // The records derived from takes are rebuilt inside the journal.
  if (!Journal.removeTake(journal, btn.dataset.del)) return;
  saveJournal();
  renderStats();
  renderLogBanner();
  if (!el.views.track.hidden) renderLog();
});

let clearArmed = false;
function disarmClear() {
  clearArmed = false;
  el.statClear.textContent = t('stats.clear');
  el.statClear.classList.remove('is-armed');
  el.statClearWarn.hidden = true;
}

el.statClear.addEventListener('click', (event) => {
  if (event.target.closest('[data-act="keep-stats"]')) return;
  if (!clearArmed) {
    // First tap arms it and says exactly what will go. The second one erases;
    // "Keep them" (in the warning) or a few seconds put it back.
    clearArmed = true;
    el.statClear.textContent = t('stats.clearConfirm');
    el.statClear.classList.add('is-armed');
    el.statClearWarn.hidden = false;
    el.statClearWarn.innerHTML = `${t('stats.clearWarn')} <button class="link-btn" type="button" data-act="keep-stats">${t('stats.keep')}</button>`;
    setTimeout(() => clearArmed && disarmClear(), 8000);
    return;
  }
  disarmClear();
  Journal.clearStats(journal);
  saveJournal();
  renderStats();
  renderLogBanner();
  if (!el.views.track.hidden) renderLog();
});
el.statClearWarn.addEventListener('click', (event) => {
  if (event.target.closest('[data-act="keep-stats"]')) disarmClear();
});
el.openStatsBtn.addEventListener('click', () => {
  cancelListening();
  showView('stats');
  renderStats();
});
el.statsBack.addEventListener('click', goHome);
el.statTabs.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-stat-tab]');
  if (!btn) return;
  statsView.tab = btn.dataset.statTab;
  renderStats();
});
el.statSort.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-stat-sort]');
  if (!btn) return;
  statsView.sort = btn.dataset.statSort;
  renderStats();
});

/** A finished take logs itself: nothing to type, and nothing to forget. */
function noteTake(tag, cardId = null, score = 0, details = null) {
  const today = todayKey();
  // A test run — a tap, a cough, a sibling — is recorded so nobody loses the fact
  // that it happened, but it is not allowed to tick the day, move a best score,
  // or reach the averages. The child's own numbers should only ever reflect
  // playing.
  const counted = (lastTakeCounted = !(
    details &&
    Journal.looksLikeTrial({
      heard: details.heard,
      expected: details.expected,
      seconds: details.seconds,
      score,
    })
  ));

  if (counted) Journal.logTake(journal, today, tag);
  // Real practice earns notes for the pet room; a false start earns nothing.
  if (counted && (tag === 'scales' || tag === 'sight' || tag === 'sprint')) {
    const kind = tag === 'scales' ? 'scale' : tag;
    const earned = petRoom.earnTake({ kind, id: cardId || '', dayKey: today, octaves: details?.octaves || 1 });
    petToast(earned.amount, earned.warmed, earned.bonus, kind, earned.grew, earned.wished, cardId || '');
  }
  if (cardId && counted) Journal.noteScale(journal, cardId, today, score);
  // Sight reading is filed per level, not per passage: a level VI page is a
  // level VI page whatever it happens to be in.
  if (tag === 'sight' && counted) Journal.noteSight(journal, sight.level, today, score);
  // And every take is kept whole — score, the four parts, what it was — because a
  // stat screen can only answer questions the data was asked.
  if (score > 0 && (tag === 'scales' || tag === 'sight')) {
    Journal.recordTake(journal, {
      kind: tag === 'sight' ? 'sight' : 'scale',
      id: cardId || '',
      level: tag === 'sight' ? sight.level : '',
      score,
      parts: details && details.parts,
      bpm: details && details.bpm,
      heard: details && details.heard,
      expected: details && details.expected,
      assisted: Boolean(details && details.assisted),
      counted,
      key: today,
    });
  }
  saveJournal();
  if (!el.views.track.hidden) renderLog();
}

el.openLogBtn.addEventListener('click', openTrack);
el.trackBack.addEventListener('click', goHome);

/* ── Whose log is on screen ───────────────────────────────────────────── */

function closeNameForm() {
  el.nameForm.hidden = true;
  el.nameInput.value = '';
}

function openNameForm(mode) {
  nameMode = mode;
  const profile =
    mode.kind === 'rename' ? journalStore.profiles.find((p) => p.id === mode.id) : null;
  el.nameInput.value = profile ? profile.name : '';
  el.nameSave.textContent = mode.kind === 'rename' ? t('log.saveName') : t('log.add');
  el.nameInput.placeholder = t('log.namePlaceholder');
  el.nameForm.hidden = false;
  el.nameInput.focus();
  el.nameInput.select();
}

function switchProfile(id) {
  const next = journalStore.profiles.find((p) => p.id === id);
  if (!next || next.id === activeProfile.id) return;
  Journal.saveStore(journalStore);
  journalStore.current = next.id;
  Journal.touchProfile(journalStore, next.id);
  activeProfile = next;
  journal = next.state;
  closeNameForm();
  el.logStatus.textContent = '';
  renderLog();
  renderLogBanner();
  // Both rows mark the new name, wherever the switch was made.
  renderWho();
}

// The same chips on the home screen, before anything personal is on it. Adding a
// name from here has to take the parent to the form, which lives in the log — so
// it opens the log first rather than leaving a form on a screen that has none.
el.homeWho.addEventListener('click', (event) => {
  if (event.target.closest('[data-who-all]')) {
    openWhoDialog();
    return;
  }
  if (event.target.closest('[data-who-add]')) {
    openTrack();
    openNameForm({ kind: 'add' });
    return;
  }
  const button = event.target.closest('[data-who]');
  if (button) switchProfile(button.dataset.who);
});

el.whoChips.addEventListener('click', (event) => {
  if (event.target.closest('[data-who-all]')) {
    openWhoDialog();
    return;
  }
  if (event.target.closest('[data-who-add]')) {
    openNameForm({ kind: 'add' });
    return;
  }
  const button = event.target.closest('[data-who]');
  if (button) switchProfile(button.dataset.who);
});

el.nameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = el.nameInput.value.trim();
  if (!value) {
    el.nameInput.focus();
    return;
  }

  if (nameMode.kind === 'rename') {
    if (!Journal.renameProfile(journalStore, nameMode.id, value)) {
      el.logStatus.textContent = t('log.nameTaken');
      return;
    }
    saveJournal();
  } else {
    const profile = Journal.addProfile(journalStore, value);
    if (!profile) {
      el.logStatus.textContent = t('log.nameTaken');
      return;
    }
    activeProfile = profile;
    journal = profile.state;
    saveJournal();
  }
  closeNameForm();
  el.logStatus.textContent = '';
  renderLog();
});

el.nameCancel.addEventListener('click', closeNameForm);

el.nameList.addEventListener('click', (event) => {
  const rename = event.target.closest('[data-rename]');
  if (rename) {
    openNameForm({ kind: 'rename', id: rename.dataset.rename });
    return;
  }
  const remove = event.target.closest('[data-remove]');
  if (!remove) return;
  const profile = journalStore.profiles.find((p) => p.id === remove.dataset.remove);
  if (!profile) return;
  if (!window.confirm(t('log.confirmRemoveName', { name: displayName(profile) }))) return;
  Journal.removeProfile(journalStore, profile.id);
  activeProfile = Journal.active(journalStore);
  journal = activeProfile.state;
  saveJournal();
  renderLog();
});

el.todayChips.addEventListener('click', (event) => {
  const chip = event.target.closest('button[data-tag]');
  if (!chip) return;
  const today = todayKey();
  const day = journal.days[today];
  const tag = chip.dataset.tag;
  const adding = !(day && day.tags.includes(tag));
  if (adding) Journal.log(journal, today, tag);
  else day.tags = day.tags.filter((k) => k !== tag);
  saveJournal();
  renderLog();
  // Logging a practice day by hand counts for the pet too, once a day: some of a
  // student's practice happens where the microphone cannot follow it.
  if (adding) {
    const earned = petRoom.earnPractice(today);
    if (earned && earned.amount) petToast(earned.amount, false, 0, 'practice');
  }
});

el.hardChips.addEventListener('click', (event) => {
  const chip = event.target.closest('button[data-hard]');
  if (!chip) return;
  Journal.toggleHard(journal, todayKey(), chip.dataset.hard);
  saveJournal();
  renderLog();
});

el.restBtn.addEventListener('click', () => {
  const result = Journal.markRest(journal, todayKey());
  if (result === 'limit') el.restBtn.textContent = t('log.restLimit');
  saveJournal();
  renderLog();
});

el.planSelect.addEventListener('change', () => {
  journal.plan = el.planSelect.value;
  saveJournal();
  renderLog();
});

// Sharing is the "reported to someone" half of progress monitoring: the effect of
// monitoring is larger when the result reaches another person. Phones and tablets
// have a share sheet, so the week can go to a teacher or a parent in one tap; a
// desktop copies it instead, which is the same thing done by hand.
if (typeof navigator !== 'undefined' && navigator.share) {
  el.shareSheet.hidden = false;
  el.shareSheet.textContent = t('log.share');
}

el.shareSheet.addEventListener('click', async () => {
  try {
    await navigator.share({ title: t('log.shareTitle'), text: el.lessonSheet.textContent });
  } catch {
    /* the share sheet was closed — that is an answer, not an error */
  }
});

el.copySheet.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(el.lessonSheet.textContent);
    el.copySheet.textContent = t('log.copied');
    setTimeout(() => {
      el.copySheet.textContent = t('log.copy');
    }, 1500);
  } catch {
    el.copySheet.textContent = t('log.copyFailed');
  }
});

el.clearLog.addEventListener('click', () => {
  if (!window.confirm(t('log.confirmClear'))) return;
  // Only this log: the name stays, and the other children's logs are untouched.
  Object.assign(journal, Journal.emptyState());
  saveJournal();
  if (el.logStatus) el.logStatus.textContent = '';
  renderLog();
  renderLogBanner();
});

/* ── A copy the student keeps ─────────────────────────────────────────── */

function exportLog() {
  const text = Journal.serialise(journal, new Date(), activeProfile.name);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `scale-studio-practice-log-${todayKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  el.logStatus.textContent = t('log.savedCopy', { n: Journal.totalDays(journal) });
}

async function importLog(file) {
  if (!file) return;
  let text = '';
  try {
    text = await file.text();
  } catch {
    el.logStatus.textContent = t('log.loadFailed');
    return;
  }
  const copy = Journal.parse(text);
  if (!copy) {
    el.logStatus.textContent = t('log.loadBad');
    return;
  }
  // A copy made under another name is not merged into this one: on a shared
  // tablet that is how one child's term quietly becomes another's. The message
  // says which name to switch to. Files from before names carry no name and are
  // taken at face value.
  if (copy.profile !== null && copy.profile.toLowerCase() !== activeProfile.name.toLowerCase()) {
    el.logStatus.textContent = t('log.loadOther', {
      name: copy.profile ? copy.profile : t('log.me'),
    });
    return;
  }
  const before = Journal.totalDays(journal);
  Object.assign(journal, Journal.merge(journal, copy.state));
  saveJournal();
  renderLog();
  const added = Journal.totalDays(journal) - before;
  el.logStatus.textContent = added
    ? t('log.loaded', { n: Journal.totalDays(journal), added })
    : t('log.loadedSame', { n: Journal.totalDays(journal) });
}

el.exportLog.addEventListener('click', exportLog);
el.importLog.addEventListener('click', () => el.importFile.click());
el.importFile.addEventListener('change', async () => {
  const file = el.importFile.files && el.importFile.files[0];
  // Read first, clear afterwards: emptying the input takes the file away from
  // it, and a read that is still in flight can then come back empty.
  await importLog(file);
  el.importFile.value = '';
});

/* ── Recording, with a hall on playback ───────────────────────────────── */

async function toggleRecording() {
  if (recorder.live) {
    el.recBtn.disabled = true;
    const started = Date.now();
    try {
      const blob = await recorder.live.stop();
      recorder.live = null;
      if (blob && blob.size) {
        recorder.takes.unshift({
          blob,
          url: URL.createObjectURL(blob),
          seconds: (Date.now() - started) / 1000,
        });
        // Keep the last eight in memory and let the older blobs go: a long
        // session must not quietly eat a phone's RAM.
        while (recorder.takes.length > 8) {
          URL.revokeObjectURL(recorder.takes.pop().url);
        }
        noteTake('recording');
        // A take kept to listen back to is practice too, so the pet notices —
        // once a day, and never at the cost of a take the app counted itself.
        const earned = petRoom.earnRecording();
        if (earned && earned.amount) petToast(earned.amount, false, 0, 'recording');
      }
      el.recStatus.textContent = '';
    } catch {
      el.recStatus.textContent = t('log.recFailed');
    }
    el.recBtn.disabled = false;
    el.recBtn.textContent = t('log.record');
    el.recBtn.classList.remove('is-recording');
    renderRecList();
    return;
  }

  if (!canRecord()) {
    el.recStatus.textContent = t('log.noRecorder');
    return;
  }
  try {
    recorder.live = await startRecording();
    el.recBtn.textContent = t('log.stop');
    el.recBtn.classList.add('is-recording');
    el.recStatus.textContent = t('log.recording');
  } catch (err) {
    el.recStatus.textContent = micErrorMessage(err);
  }
}

async function playTake(index) {
  if (recorder.playing) {
    recorder.playing.stop();
    recorder.playing = null;
  }
  const take = recorder.takes[index];
  if (!take) return;
  try {
    const handle = await playRecording(take.blob, { wet: el.reverbToggle.checked ? 0.34 : 0 });
    recorder.playing = handle;
    el.recStatus.textContent = t('log.playing');
    await handle.ended;
    if (recorder.playing === handle) {
      recorder.playing = null;
      el.recStatus.textContent = '';
    }
  } catch {
    el.recStatus.textContent = t('log.playFailed');
  }
}

el.recBtn.addEventListener('click', toggleRecording);
el.recList.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-play]');
  if (!btn) return;
  playTake(Number(btn.dataset.play));
});

/* ── Practice screen ──────────────────────────────────────────────────── */

function openScale(cardId, variantIndex = 0) {
  state.test = null;
  el.testBar.hidden = true;
  state.cardId = cardId;
  state.variantIndex = variantIndex;
  state.scale = practiceScale();
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

/** The grid's own screen: reached from the menu, and where a take goes back to. */
function openScales() {
  cancelListening();
  // The cards light up with today's takes, so they are drawn fresh each visit —
  // and after midnight they start the new day dark.
  renderGrid();
  showView('scales');
}

function renderPractice() {
  const scale = state.scale;
  listenBuddy?.refresh();
  el.scaleTitle.textContent = scale.title;
  el.scaleMeta.textContent = scale.meta;
  el.staffHost.innerHTML = renderStaff(scale.sequence, {
    fifths: scale.fifths,
    ariaLabel: t('aria.notation'),
  });
  // Each layout is its own page of marks: the same key in one octave or with the
  // other spelling puts its notes elsewhere, and ink written for one would sit
  // on the wrong notes of the other.
  ink.mount(
    el.staffHost.querySelector('svg.staff'),
    `${scale.title}|${scale.sequence.map((n) => n.name).join(' ')}`,
  );
  el.memoryName.textContent = scale.title;
  el.memoryMeta.textContent = `${scale.meta} · ${scale.rangeText}`;
  el.spellingRow.hidden = Boolean(state.test) || scale.spellings.length < 2;
  [...el.octaveTabs.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-selected', String(Number(b.dataset.oct) === scale.octaves)),
  );
  el.octaveTabs.hidden = Boolean(state.test);
  // One octave of A can start on the G string or the open A; both are asked for.
  const regs = scale.registers || [];
  el.registerRow.hidden = Boolean(state.test) || regs.length < 2;
  el.registerRow.innerHTML = regs
    .map(
      (r) =>
        `<button type="button" data-register="${r.id}" aria-pressed="${r.id === scale.register}" title="${t('reg.title', { from: r.from })}">${t(`reg.${r.id}`, { name: scale.name })}</button>`,
    )
    .join('');
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

/* ── Live marks: a wrong note gets an arrow toward the written one ─────── */

const SVG_NS = 'http://www.w3.org/2000/svg';
const WRONG = '#a4534a';

function followLayer(create = true) {
  const svg = el.staffHost.querySelector('svg.staff');
  if (!svg) return null;
  let layer = svg.querySelector('g.staff-follow');
  if (!layer && create) {
    layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('class', 'staff-follow');
    layer.setAttribute('aria-hidden', 'true');
    svg.appendChild(layer);
  }
  return layer;
}

function clearFollowMarks() {
  const svg = el.staffHost.querySelector('svg.staff');
  if (!svg) return;
  followLayer(false)?.remove();
  svg.querySelectorAll('ellipse.staff-head.is-wrong').forEach((head) => {
    head.classList.remove('is-wrong');
    head.setAttribute('fill', head.dataset.fill);
  });
}

/**
 * One event from the follower. A wrong note: tint the head that was due and
 * put an arrow on the side away from its stem — above if the stem hangs down,
 * below if it points up — pointing the way the written note lies. Put right
 * afterwards, the mark comes off; played past, it stays as a record.
 */
function paintFollow(event) {
  const svg = el.staffHost.querySelector('svg.staff');
  const head = svg?.querySelector(`ellipse.staff-head[data-i="${event.index}"]`);
  if (!head) return;
  const layer = followLayer();
  layer.querySelector(`[data-i="${event.index}"]`)?.remove();

  if (event.type === 'right') {
    if (head.classList.contains('is-wrong')) {
      head.classList.remove('is-wrong');
      head.setAttribute('fill', head.dataset.fill);
    }
    return;
  }

  const x = Number(head.getAttribute('cx'));
  const y = Number(head.getAttribute('cy'));
  if (!head.classList.contains('is-wrong')) head.dataset.fill = head.getAttribute('fill');
  head.classList.add('is-wrong');
  head.setAttribute('fill', WRONG);

  // The arrow sits on the side away from the stem, 9 units off the head, 17 long.
  const above = head.dataset.stem === 'down';
  const near = above ? y - 9 : y + 9;
  const far = above ? near - 17 : near + 17;
  const top = Math.min(near, far);
  const bottom = Math.max(near, far);
  const up = event.dir === 'up';
  const tip = up ? top : bottom;
  const tail = up ? bottom : top;
  const back = up ? 6 : -6; // from the tip back toward the tail
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', `follow-arrow is-${event.dir}`);
  g.dataset.i = String(event.index);
  g.innerHTML =
    `<line x1="${x}" y1="${tail}" x2="${x}" y2="${tip + back * 0.7}" stroke="${WRONG}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M ${x - 5} ${tip + back} L ${x} ${tip} L ${x + 5} ${tip + back} Z" fill="${WRONG}" stroke="${WRONG}" stroke-width="1.2" stroke-linejoin="round"/>`;
  layer.appendChild(g);
  revealOnStaff(x, svg);
}

/** On a phone the staff scrolls: bring a fresh mark into view if it is off-screen. */
function revealOnStaff(x, svg) {
  const host = el.staffHost;
  if (host.scrollWidth <= host.clientWidth + 2) return;
  const px = (x / svg.viewBox.baseVal.width) * svg.getBoundingClientRect().width;
  const left = host.scrollLeft;
  if (px < left + 24 || px > left + host.clientWidth - 24) {
    host.scrollTo({ left: Math.max(0, px - host.clientWidth / 2), behavior: 'smooth' });
  }
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

/* ── Marks on the staff ────────────────────────────────────────────── */

/**
 * The pen, the box eraser and undo on the scale staff (see ink.js). The buttons
 * say which tool is on, and on a phone the hint under the staff says how to get
 * swiping back, because a finger that draws cannot also scroll.
 */
function paintInkTools({ tool, canUndo }) {
  if (!el.inkPen) return;
  el.inkPen.setAttribute('aria-pressed', String(tool === 'pen'));
  el.inkErase.setAttribute('aria-pressed', String(tool === 'erase'));
  el.inkUndo.disabled = !canUndo;
  if (el.staffHint) {
    el.staffHint.textContent = t(
      tool === 'pen' ? 'ink.hint.pen' : tool === 'erase' ? 'ink.hint.erase' : 'ink.hint.swipe',
    );
    el.staffHint.classList.toggle('is-inking', Boolean(tool));
  }
}

/* ── Microphone ───────────────────────────────────────────────────────── */

/**
 * Opens the microphone.
 *
 * `windowSize` is how many samples the detector looks at. The take path uses 2048 —
 * 43 ms at 48 kHz, which is 30 frames a second and plenty for anything above the
 * open G. The tuner asks for 4096, because the lowest string is where the window
 * matters: G3 is 196 Hz, so 2048 samples hold barely seven periods, and a phone
 * microphone that rolls off the fundamental leaves a reading that wanders. At
 * 4096 there are fourteen periods to agree on, and the reading settles.
 */
async function openMic(emit, { windowSize = 2048 } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error('no-media');
    err.name = 'InsecureContext';
    throw err;
  }

  // Tell iOS what kind of audio this page is before anything opens. A page that
  // records *and* plays — the count-in, the clicks, the example — is
  // "play-and-record" to the system, and saying so keeps the session from being
  // treated as a phone call: routed to the earpiece, ducked, or interrupted by
  // whatever else the phone wants to play. Not every browser has the Audio
  // Session API, hence the feature test.
  if ('audioSession' in navigator) {
    try {
      navigator.audioSession.type = 'play-and-record';
    } catch {
      /* older Safari — nothing to set */
    }
  }

  // Create (and unlock) the audio context *inside* the click handler. iOS Safari
  // only lets audio start from a gesture, and awaiting getUserMedia first can
  // consume that gesture — the context then stays suspended and stays silent
  // (WebKit bug 180522: on iOS a context that is only analysing input still
  // needs a gesture before the analyser returns anything but zeros).
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
  // The window is a length of *time* — 43 ms — and 2048 samples is only that at
  // 44.1 or 48 kHz. An audio interface (or a PC whose sound settings say "studio
  // quality") runs at 96 or 192 kHz, where the same 2048 samples are 21 or 11
  // ms: two periods of the open G, which is not enough to agree on a pitch. So
  // read two or four times as many samples there and average them back down,
  // which leaves the detector with the window, and the work, it was built for.
  const thin = ctx.sampleRate > 128000 ? 4 : ctx.sampleRate > 64000 ? 2 : 1;
  analyser.fftSize = windowSize * thin;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);

  // The analyser is a sink and works without an output, so by default the
  // microphone graph never touches the speakers: one less thing for iOS to
  // reconfigure under the first second of a take. If a browser still refuses to
  // render a graph that goes nowhere — which shows up as *exact* zeros for the
  // first half-second — a silent path to the destination is added then (see
  // ensurePulled below).
  const sink = ctx.createGain();
  sink.gain.value = 0;
  let pulled = false;
  const ensurePulled = () => {
    if (pulled) return;
    pulled = true;
    try {
      analyser.connect(sink).connect(ctx.destination);
    } catch {
      /* nothing else to try — the analyser still works on its own */
    }
  };

  const buf = new Float32Array(analyser.fftSize);
  // What the detector is given: `buf` itself, or `buf` averaged down by `thin`.
  const frame = thin === 1 ? buf : new Float32Array(windowSize);
  const detector = new PitchDetector({
    sampleRate: ctx.sampleRate / thin,
    bufferSize: windowSize,
    minFreq: 150,
    // Up to the E three octaves above the open E string (2637 Hz). The ceiling
    // was 1800, and a ceiling does not make a higher note go unheard — it makes
    // it heard an octave low: the B flat above the staff's second ledger octave
    // and everything over it came back as the note below, confidently.
    maxFreq: 2800,
  });

  // What the browser actually gave us, not what we asked for: on iOS the three
  // processing constraints are largely ignored and the sample rate is whatever
  // the hardware is running at. Shown to the user in "What it can and can't
  // hear", because a teacher debugging a quiet phone should be able to see that
  // gain control is on.
  const track = stream.getAudioTracks()[0];
  let settings = {};
  try {
    settings = (track && track.getSettings && track.getSettings()) || {};
  } catch {
    settings = {};
  }

  let closed = false;
  let screenLock = null;
  const mic = {
    stream,
    ctx,
    // Held here only so the source node lives as long as the microphone does; a
    // node nothing references can be collected while the graph is still wanted.
    source,
    settings,
    sampleRate: ctx.sampleRate,
    // Room noise, learned as the page runs — see nextFloor() in pitch.js.
    floor: 0.0012,
    stalled: false,
    /**
     * Keep the screen on while the microphone is. A tablet on a music stand is
     * not being touched, so it dims and locks on its usual timer — and locking
     * suspends the audio, which ends the take with nothing scored. The lock is
     * the browser's to give (and it takes it back whenever the page is hidden,
     * so this is called again when the page returns); where there is no such
     * thing the screen simply behaves as it always did.
     */
    async holdScreen() {
      if (closed || screenLock || !navigator.wakeLock?.request) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (closed) {
          lock.release().catch(() => {});
          return;
        }
        screenLock = lock;
        lock.addEventListener('release', () => {
          if (screenLock === lock) screenLock = null;
        });
      } catch {
        /* low battery, or not allowed here — the screen keeps its own timer */
      }
    },
    close() {
      closed = true;
      if (screenLock) {
        screenLock.release().catch(() => {});
        screenLock = null;
      }
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      // Hand the audio session back. A page left in "play-and-record" can route
      // its *playback* to the earpiece — quietly — until capture starts again
      // (WebKit bug 218012, comment 49, seen on iOS 18.6), which is the example
      // and the metronome coming out of the wrong place after a take.
      if ('audioSession' in navigator) {
        try {
          navigator.audioSession.type = 'auto';
        } catch {
          /* older Safari — nothing to hand back */
        }
      }
    },
    /** Try to come back from an interruption — a call, a locked screen, a tab
     *  switch. iOS moves the context to "interrupted" and leaves it there. */
    async wake() {
      if (ctx.state === 'running') {
        mic.stalled = false;
        return true;
      }
      try {
        await ctx.resume();
      } catch {
        /* still not ours to resume */
      }
      if (ctx.state === 'running') {
        mic.stalled = false;
        return true;
      }
      // A context that is stuck interrupted occasionally comes back after a
      // suspend/resume pair (the workaround on WebKit bug 276016).
      try {
        await ctx.suspend();
        await ctx.resume();
      } catch {
        /* it did not come back */
      }
      mic.stalled = ctx.state !== 'running';
      return !mic.stalled;
    },
  };

  const startedAt = performance.now();
  let still = 0;
  let silentTicks = 0;
  let staleTicks = 0;
  let wasStalled = false;
  // A copy of the previous frame. A live microphone never delivers the same
  // buffer twice, bit for bit — room noise alone sees to that — so an exact
  // repeat means the graph has stopped rendering and the analyser is handing
  // back its last block. That looks like a held note, not silence, which is why
  // the zero check alone never caught it: the needle just froze.
  const last = new Float32Array(analyser.fftSize);
  const repeats = () => {
    let sound = false;
    for (let i = 0; i < buf.length; i += 1) {
      if (buf[i] !== last[i]) return false;
      if (buf[i] !== 0) sound = true;
    }
    // Exact zeros repeat too; those are silence, and the zero check below owns them.
    return sound;
  };
  const timer = setInterval(() => {
    if (ctx.state !== 'running') {
      // Before calling it an interruption, give the context the two things that
      // most often bring it back: a path to the destination, and a resume.
      if (still === 5) {
        ensurePulled();
        ctx.resume().catch(() => {});
      }
      // Reading an interrupted context yields the last buffer over and over —
      // which is worse than silence, because it looks like a held note. Half a
      // second of this is iOS reconfiguring the session around a new stream;
      // longer than that and it is not coming back on its own.
      still += 1;
      if (still > 15 && !mic.stalled) {
        mic.stalled = true;
        wasStalled = true;
        onMicStalled();
      }
      return;
    }
    still = 0;
    mic.stalled = false;
    if (wasStalled) {
      wasStalled = false;
      onMicResumed(mic);
    }
    analyser.getFloatTimeDomainData(buf);
    if (repeats()) {
      staleTicks += 1;
      if (staleTicks > 10) ensurePulled();
      // Report the stale frame as silence: the needle should fall back to idle,
      // not keep pointing at a note that ended a while ago.
      emit({ t: (performance.now() - startedAt) / 1000, freq: 0, clarity: 0, rms: 0 });
      return;
    }
    staleTicks = 0;
    last.set(buf);
    if (thin > 1) {
      for (let i = 0, j = 0; i < frame.length; i += 1, j += thin) {
        let sum = 0;
        for (let k = 0; k < thin; k += 1) sum += buf[j + k];
        frame[i] = sum / thin;
      }
    }
    const { freq, clarity, rms } = detector.detect(frame);
    // Pitched frames are the violin, and must never teach the room's level.
    mic.floor = nextFloor(mic.floor, rms, freq > 0 && clarity >= 0.5);
    if (rms === 0) {
      silentTicks += 1;
      if (silentTicks > 25) ensurePulled();
    } else {
      silentTicks = 0;
    }
    emit({ t: (performance.now() - startedAt) / 1000, freq, clarity, rms });
  }, 30);

  mic.holdScreen();

  ctx.addEventListener?.('statechange', () => {
    // Clearing a stall is always safe. Declaring one is left to the interval,
    // which waits half a second first: a session reconfiguring itself looks
    // suspended for a moment and is not an interruption.
    if (ctx.state === 'running') mic.stalled = false;
  });

  return mic;
}

/**
 * The phone took the microphone away.
 *
 * iOS moves an audio context to "interrupted" when the screen locks, a call
 * arrives, Control Center opens, or the browser goes to the background — and it
 * does not always hand it back. A take that is running at that moment must not
 * be scored: it would file silence as a bad performance. So every take is closed
 * without a score, and the screen says what happened and what to do.
 */
function onMicStalled() {
  if (sight.phase !== 'idle') {
    stopSightTake(false);
    el.sightStatus.textContent = t('mic.paused');
  }
  if (state.take) {
    state.take = null;
    state.phase = 'idle';
    el.stopBtn.hidden = true;
    el.startBtn.hidden = false;
    el.startBtn.disabled = false;
    el.startBtn.textContent = t('btn.startListening');
    el.live.hidden = true;
    el.levelBar.hidden = true;
    setStatus(false, t('mic.paused'));
    el.listenHint.textContent = t('mic.pausedHint');
  }
  if (state.tune?.listening) {
    state.tune.listening = false;
    state.tune.cents = null;
    paintNeedle();
    el.tuneStatus.textContent = t('mic.paused');
    // A tap reopens the microphone from a fresh gesture, which is what iOS wants
    // before it hands audio back. Without the button the dial just sat there.
    el.tuneMicBtn.hidden = false;
  }
}

/**
 * The microphone came back on its own. A take that was running has already been
 * closed without a score, so there is nothing to resume there — but the tuner
 * only ever *listens*, and it should pick up again without asking.
 */
function onMicResumed(mic) {
  if (state.mic !== mic) return;
  if (state.tune && state.micMode === 'tune' && !state.tune.listening) {
    state.tune.listening = true;
    el.tuneMicBtn.hidden = true;
    paintNeedle();
  }
}

/**
 * What the microphone actually granted, in the words the student can read.
 *
 * On a laptop this is dull and honest. On an iPhone it is the answer to "why did
 * that note not count": Safari reports — and applies — gain control and noise
 * suppression whatever the page asks for (WebKit bug 179411), and there is no
 * switch. Seeing it said out loud is better than the app quietly scoring it.
 */
function paintMicDiagnostics() {
  const mic = state.mic;
  const nodes = document.querySelectorAll('.mic-diag');
  if (!nodes.length) return;
  if (!mic) {
    nodes.forEach((node) => {
      node.hidden = true;
    });
    return;
  }
  const granted = mic.settings || {};
  const word = (value) =>
    value == null ? t('mic.unknown') : value ? t('mic.on') : t('mic.off');
  const text = t('mic.diag', {
    rate: Math.round(mic.sampleRate || 0),
    ec: word(granted.echoCancellation),
    ns: word(granted.noiseSuppression),
    agc: word(granted.autoGainControl),
  });
  nodes.forEach((node) => {
    node.textContent = text;
    node.hidden = false;
  });
}

/**
 * Coming back to a page iOS has interrupted.
 *
 * Locking the screen, taking a call or switching tabs moves an audio context to
 * "interrupted", and it is not always restored on its own (WebKit bugs 273511 and
 * 276016 — one of them leaves a context stuck there until the page is reloaded).
 * Returning to the page is the one moment a resume is allowed, so take it; if the
 * context will not come back, say so rather than pretending to listen.
 */
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !state.mic) return;
  // the browser let go of the screen lock when the page was hidden
  state.mic.holdScreen?.();
  state.mic.wake().then((awake) => {
    if (!awake) onMicStalled();
  });
});

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

/**
 * One microphone, several listeners. Every frame lands here and is handed to
 * whatever is asking for it — a sight-reading take, a scale take, or the tuner.
 * The stream is opened once and shared, which is also what keeps iOS happy
 * between takes.
 */
function routeFrame(frame) {
  paintMicLevel(frame.rms);
  if (sprintView?.listening) return sprintView.frame(frame);
  if (listenView?.listening) return listenView.frame(frame);
  if (sight.phase !== 'idle' && sight.take) return ingestSightFrame(frame);
  if (state.take) return onFrame(frame);
  if (state.tune?.listening) return onTuneFrame(frame);
}

/**
 * The little meters that say the microphone is alive.
 *
 * One frame arrives here whatever is listening, so this is the one place the
 * level is painted — the scale take, the tuner and a sight-reading take all show
 * the same bar, and a teacher can see the input move before they play.
 */
let levelSmooth = 0;

function paintMicLevel(rms) {
  levelSmooth = levelSmooth * 0.75 + (rms || 0) * 0.25;
  const percent = Math.min(100, Math.sqrt(levelSmooth) * 340);
  for (const meter of [el.levelBar, el.sightLevel]) {
    if (meter && meter.firstElementChild) meter.firstElementChild.style.width = `${percent}%`;
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
  if (state.mic && (state.micMode !== 'take' || state.mic.stalled)) closeMic();
  if (!state.mic) {
    const ticket = micTicket;
    try {
      const mic = await openMic(routeFrame);
      if (ticket !== micTicket) {
        mic.close();
        return;
      }
      state.mic = mic;
      state.micMode = 'take';
      paintMicDiagnostics();
    } catch (err) {
      if (ticket !== micTicket) return;
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
  listenBuddy?.listen(true);
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
    // Keeps place in the scale as it is played, and marks a wrong note on the
    // staff with which way the written one lies.
    follow: createFollower(
      state.scale.sequence.map((n) => n.midi),
      paintFollow,
    ),
  };
  clearFollowMarks();

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
      el.listenHint.textContent = t('hint.noSound');
    }
  }, 4500);

  // In an audition the app waits as long as it takes — but after a long silence
  // it is worth reminding the student that they can finish early.
  if (state.test) {
    setTimeout(() => {
      const take = state.take;
      if (state.phase === 'armed' && take && !take.started) {
        el.listenHint.textContent = t('hint.takeYourTime');
      }
    }, 45000);
  }
}

function onFrame(frame) {
  const take = state.take;
  if (!take || take.done) return;

  // The meter is painted by routeFrame, which sees every frame — this only keeps
  // the take's own peak, for the "was anything heard at all" question.
  take.peak = Math.max(take.peak || 0, frame.rms);

  const voiced = frame.freq > 0 && frame.clarity > 0.5 && frame.rms > hearLevel(state.mic?.floor, frame.clarity);

  // The needle answers the bow from the first frame, not from the first *scored*
  // note. A student watching for the app to hear them was looking at "—" for
  // seconds while the take's own start rule made up its mind; the readout is a
  // rehearsal aid, so it may as well tell the truth immediately.
  if (voiced) updateTuner(69 + 12 * Math.log2(frame.freq / 440));

  if (!take.started) {
    // Two ways to start, and the second one exists because a phone needed it.
    //
    // The first is the confident note: loud, clearly periodic, three frames in a
    // row. The second is simply a note that *holds* — quieter, less certain of its
    // own periodicity, but present for six frames (180 ms). The old rule was the
    // confident one alone (clarity 0.7 at a fixed 0.007), and on an iPhone it is
    // a lottery: the gain control is still winding up over the first second, and
    // YIN on a fresh bow attack is smeared, so a student who was already playing
    // watched a dead needle for four or five seconds before three frames happened
    // to line up. Room noise cannot pass either rule — a noise frame has no
    // periodicity, so clarity stays under 0.5.
    const strong = frame.rms > strongLevel(state.mic?.floor) && frame.clarity > 0.62;
    take.strong = strong ? take.strong + 1 : 0;
    take.held = voiced ? (take.held || 0) + 1 : 0;
    if (take.strong >= 3 || take.held >= 6) {
      take.started = true;
      devLog('take-started', {
        index: state.test ? state.test.index : -1,
        rms: Number(frame.rms.toFixed(4)),
        clarity: Number(frame.clarity.toFixed(3)),
        via: take.strong >= 3 ? 'strong' : 'held',
      });
      take.t0 = Math.max(0, frame.t - 0.1);
      setStatus(true, t('status.listeningScale'));
      el.listenHint.textContent = t('hint.allTheWay');
    }
    return;
  }

  const elapsed = Math.max(0, frame.t - take.t0);
  take.frames.push({ t: elapsed, freq: frame.freq, clarity: frame.clarity, rms: frame.rms });
  take.follow?.frame(elapsed, voiced ? 69 + 12 * Math.log2(frame.freq / 440) : null);

  if (voiced) {
    take.lastVoiced = elapsed;
    const midiFloat = 69 + 12 * Math.log2(frame.freq / 440);
    if (take.lastMidi == null || Math.abs(midiFloat - take.lastMidi) > 0.7) {
      take.noteCount += 1;
      take.lastMidi = midiFloat;
      listenBuddy?.note();
    }
  }

  const silence = elapsed - take.lastVoiced;
  const lastExpected = state.scale.sequence[state.scale.sequence.length - 1].midi;
  const nearEnd =
    take.noteCount >= state.scale.sequence.length - 2 &&
    take.lastMidi != null &&
    Math.round(take.lastMidi) === lastExpected;

  // How long a pause has to last before the take is called finished. These were
  // 1.3 s near the end and 3 s anywhere else, and real playing beat both: a
  // shift, a string crossing that loses the pitch for a moment, or a breath
  // before the last note ended a take that was not over. nearEnd can also come
  // true too early on two octaves, where the tonic sounds in the middle as well.
  // A student who is done has the Finish button; one who is not should never
  // be cut off, so the wait errs long.
  if (silence > (nearEnd ? 4.0 : 8.0) || elapsed > 100) finishTake();
}

/**
 * The count under the notes.
 *
 * The picture itself is drawn with the music — a lane under the staff, one stem
 * per note — so all that is left to say here is the arithmetic: how many sat
 * high, how many low, and how many were centred.
 */
function paintIntonationLine(sumEl, notes) {
  if (!sumEl) return;
  const summary = summariseIntonation(notes || []);
  sumEl.textContent = summary.heard ? intonationLine(summary) : '';
}

/** The sentence under the notes: counts of high, low and centred. */
function intonationLine(summary) {
  const { heard, sharp, flat } = summary;
  if (!sharp && !flat) return t('intonation.sum.clean', { n: heard });
  if (sharp && flat) return t('intonation.sum.both', { sharp, flat });
  return sharp ? t('intonation.sum.sharp', { n: sharp }) : t('intonation.sum.flat', { n: flat });
}

/**
 * One live reading: the note name, the cents beside it, and where the needle
 * sits. Shared by the scale take and the sight-reading take so a student reads
 * exactly the same thing in both places.
 */
function paintLiveRead(noteEl, centsEl, markerEl, midi, cents) {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);

  noteEl.textContent = name;
  centsEl.textContent = `${cents > 0 ? '+' : ''}${cents.toFixed(0)}¢`;

  const abs = Math.abs(cents);
  const colour = abs <= 15 ? '#2f5d4e' : abs <= 35 ? '#b0843f' : '#a4534a';
  noteEl.style.color = colour;
  markerEl.style.left = `${50 + Math.max(-1, Math.min(1, cents / 50)) * 47}%`;
  markerEl.style.background = colour;
  markerEl.style.boxShadow = `0 0 0 3px ${colour}22`;
}

function updateTuner(midiFloat) {
  const midi = Math.round(midiFloat);
  paintLiveRead(el.liveNote, el.liveCents, el.tunerMarker, midi, (midiFloat - midi) * 100);
}

function finishTake() {
  const take = state.take;
  if (!take || take.done) return;
  take.done = true;
  state.phase = 'finishing';

  el.stopBtn.hidden = true;
  el.live.hidden = true;
  el.levelBar.hidden = true;

  let result = analyzeTake(take.frames, state.scale);
  // In a mock audition a one-octave G or A may be played from either octave:
  // score the take against both and keep whichever the student actually played.
  if (state.test && state.scale.registers?.length === 2) {
    const other = buildScale(
      state.scale.card,
      state.scale.variantIndex,
      state.scale.mode,
      state.scale.form || 'melodic',
      1,
      state.scale.register === 'low' ? 'high' : 'low',
    );
    const alt = analyzeTake(take.frames, other);
    if (alt.score > result.score) {
      result = alt;
      state.scale = other;
      state.test.scales[state.test.index] = other;
    }
  }
  // The scale's own key, not state.cardId: a mock audition never sets that, so
  // every audition take used to be filed under whatever was practised last.
  const cardId = state.scale.cardId || state.cardId;
  // Before the take is logged: the comparison is against what came before it.
  result.compared = Journal.compareTake(Journal.scaleEntry(journal, cardId), result.score);
  noteTake('scales', cardId, result.score, {
    parts: {
      accuracy: result.components.accuracy,
      intonation: result.components.intonation,
      rhythm: result.components.steadiness,
      flow: result.components.continuity,
    },
    bpm: result.stats.bpm,
    heard: result.stats.heard,
    expected: result.stats.expected,
    seconds: result.stats.duration,
    octaves: state.scale.octaves || 1,
  });

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
      // Between audition scales the score stays hidden, but the pet can still
      // be pleased you played one.
      if (lastTakeCounted) listenBuddy?.cheer();
      else listenBuddy?.curious();
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
  listenBuddy?.listen(false);
  renderResult(result);
  resultBuddy?.refresh();
  // A beat after the page arrives, so the hop is seen.
  setTimeout(() => (lastTakeCounted ? resultBuddy?.cheer() : resultBuddy?.curious()), 450);

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

/** The scale the result screen is about — Try again plays this one. */
let lastResultScale = null;

function noteColour(entry) {
  if (entry.status !== 'exact') return '#c2b7a6';
  const c = Math.abs(entry.cents);
  if (c <= 15) return '#3f6d59';
  if (c <= 30) return '#b58a44';
  return '#a4534a';
}

/**
 * One sentence comparing this take with the ones before it.
 *
 * The rules, in order: a first take is a first take; beating your best is said
 * plainly; matching it is worth as much as beating it; and a take below your
 * best names the best rather than the shortfall alone, so the sentence still
 * contains something you did.
 */
function compareLine(compared) {
  if (compared.first) return t('compare.first');
  if (compared.isBest && compared.delta > 0) return t('compare.best', { n: compared.delta });
  if (compared.delta === 0) return t('compare.equalled', { n: compared.best });
  if (compared.delta >= -3) return t('compare.close', { n: compared.best });
  return t('compare.below', { n: compared.best });
}

function renderResult(result) {
  const scale = result.scale;
  lastResultScale = scale;
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
  const sub = s.bpm
    ? t('result.sub', {
        exact: s.exact,
        expected: s.expected,
        heard: s.heard,
        bpm: s.bpm,
        dur: s.duration.toFixed(0),
      })
    : t('result.subSimple', { exact: s.exact, expected: s.expected, heard: s.heard });
  // This time against the last few times. Specific and comparative, which is the
  // kind of feedback that raises self-efficacy — but never a scolding: being
  // below your best is stated as a fact and the best is named so it is still a
  // thing you have done.
  const compared = result.compared ? compareLine(result.compared) : '';
  el.resultSub.textContent = compared ? `${sub} · ${compared}` : sub;

  const ringColour =
    result.score >= 90 ? '#2f5d4e' : result.score >= 75 ? '#44796a' : result.score >= 60 ? '#b0843f' : '#a4534a';
  el.ringValue.style.stroke = ringColour;
  el.ringValue.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  el.ringValue.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
  requestAnimationFrame(() => {
    el.ringValue.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - result.score / 100));
  });

  const metrics = [
    [t('component.notes'), result.components.accuracy, 'notes'],
    [t('component.intonation'), result.components.intonation, 'intonation'],
    [t('component.steadiness'), result.components.steadiness, 'steadiness'],
    [t('component.flow'), result.components.continuity, 'flow'],
  ];
  // Each part is a button: tapping it says what it measures and how much of the
  // score it is (see explainPart).
  el.breakdown.innerHTML = metrics
    .map(
      ([label, value, key]) => `
        <div class="metric" data-explain="${key}">
          <button class="metric-label" type="button" aria-expanded="false"><span>${label} <span class="explain-i" aria-hidden="true">ⓘ</span></span><span class="metric-value">${Math.round(value * 100)}%</span></button>
          <div class="metric-bar"><span style="width:0%"></span></div>
          <p class="explain-text" hidden>${t(`explain.${key}`)}</p>
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
      intonation: result.notes.map((note) => (note.status === 'missed' ? null : note.cents)),
    },
  );
  paintIntonationLine(el.resultIntonationSum, result.notes);

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

// ── Light and dark ─────────────────────────────────────────────────────────
// The page starts in the device's own mode (the little script in <head> sets
// it before anything is drawn). Pressing the button picks one and keeps it;
// until then, the page follows the device as it changes, at sunset and all.
const THEME_KEY = 'scaleStudio.theme';
const darkQuery = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;

function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  // The button offers the other one.
  el.themeLabel.textContent = dark ? t('theme.toLight') : t('theme.toDark');
  el.themeBtn.setAttribute('aria-pressed', String(dark));
  el.themeBtn.setAttribute('aria-label', t('theme.aria'));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#191714' : '#faf7f1');
}

applyTheme(document.documentElement.dataset.theme);
el.themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* kept for this visit */
  }
  applyTheme(next);
});
if (darkQuery && darkQuery.addEventListener) {
  darkQuery.addEventListener('change', (e) => {
    if (!savedTheme()) applyTheme(e.matches ? 'dark' : 'light');
  });
}
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

// The mock audition's own two screens carry the level as well. On the scales
// screen a level change is just a different grid; here it moves the audition to
// that level's flow, because the level is what the draw is made of.
for (const row of [el.pickLevels, el.drawLevels]) {
  if (!row) continue;
  row.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-level]');
    if (btn) changeTestLevel(btn.dataset.level);
  });
}
// The three rows start on whatever level the app opened at.
syncLevelTabs();

el.octaveTabs.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-oct]');
  if (!btn) return;
  state.practiceOctaves = Number(btn.dataset.oct);
  state.scale = practiceScale();
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
  state.scale = practiceScale();
  renderPractice();
});

el.registerRow.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-register]');
  if (!btn || !state.scale) return;
  state.registers[state.cardId] = btn.dataset.register;
  saveRegisters();
  state.scale = practiceScale();
  renderPractice();
});

// A scale take goes back to the grid it came from; the menu is one step above it.
el.backBtn.addEventListener('click', openScales);
el.brandHome.addEventListener('click', goHome);
// Opened from the audition summary, Back goes back to that summary; otherwise
// to the grid the take came from.
el.resultBack.addEventListener('click', () => {
  if (state.test && state.test.results.length && state.phase === 'idle') showView('test-result');
  else openScales();
});
el.anotherBtn.addEventListener('click', openScales);
el.openScalesBtn.addEventListener('click', openScales);
el.scalesBack.addEventListener('click', goHome);

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
el.inkPen.addEventListener('click', () => ink.toggle('pen'));
el.inkErase.addEventListener('click', () => ink.toggle('erase'));
el.inkUndo.addEventListener('click', () => ink.undo());
// A double tap is two taps, never a zoom.
//
// `touch-action: manipulation` is the proper fix and every element now states it,
// but iPad Safari still zooms on some screens: it answers per element, and a
// heading or a card inside a scrolling body does not always get the page's
// policy. So a second tap landing within a third of a second and a finger's width
// of the first is cancelled outright. Only on things that are *not* controls —
// tapping the same button twice in a row is a real thing to do (a level, a chip, a
// snack), and its own tap handling must not be swallowed.
const CONTROL_SELECTOR =
  'button, a, label, input, select, textarea, summary, [role="button"], [role="tab"], [role="slider"]';
let tapAt = 0;
let tapX = 0;
let tapY = 0;
document.addEventListener(
  'touchend',
  (event) => {
    if (event.touches.length || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const now = performance.now();
    const twice =
      now - tapAt < 330 && Math.hypot(touch.clientX - tapX, touch.clientY - tapY) < 45;
    if (twice && !(event.target.closest && event.target.closest(CONTROL_SELECTOR))) {
      if (event.cancelable) event.preventDefault();
      tapAt = 0;
      return;
    }
    tapAt = now;
    tapX = touch.clientX;
    tapY = touch.clientY;
  },
  { passive: false },
);

// Ctrl+Z / ⌘Z undoes a mark while the practice screen is showing — unless the
// keyboard is busy in a text field, which has its own undo.
document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return;
  if (el.views.practice?.hidden !== false) return;
  if (event.target.closest?.('input, textarea, [contenteditable]')) return;
  if (!ink.count && el.inkUndo.disabled) return;
  event.preventDefault();
  ink.undo();
});

el.retryBtn.addEventListener('click', () => {
  // Retrying a single scale is practice, even if it came from a mock audition —
  // and it is the scale on the result screen. Opened from the audition summary
  // that is not the last one played, and the practice screen still had the
  // audition's layout (no notation, no octave switch) until it was redrawn.
  const scale = lastResultScale || state.scale;
  state.test = null;
  el.testBar.hidden = true;
  if (scale.mode && scale.mode !== state.mode) setMode(scale.mode);
  state.scale = scale;
  if (scale.cardId) state.cardId = scale.cardId;
  state.variantIndex = scale.variantIndex || 0;
  renderPractice();
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

/* ── Offline ──────────────────────────────────────────────────────────── */

/** Says what is actually on this device, and offers the missing piece. */
function paintOffline(message = null) {
  const stored = samplesStored();
  el.offlineStatus.textContent = message || (stored ? t('offline.ready') : t('offline.status'));
  el.offlineBtn.textContent = stored ? t('offline.refresh') : t('offline.download');
}

el.offlineBtn.addEventListener('click', async () => {
  el.offlineBtn.disabled = true;
  try {
    const result = await downloadSamples((done, total) => {
      el.offlineBtn.textContent = t('offline.progress', { done, total });
    });
    paintOffline(
      result.complete
        ? t('offline.done')
        : t('offline.partial', { n: result.missing, total: result.total }),
    );
  } catch {
    paintOffline(t('offline.failed'));
  } finally {
    el.offlineBtn.disabled = false;
  }
});

el.updateBtn.addEventListener('click', () => applyUpdate());
el.updateLater.addEventListener('click', () => {
  el.updateNote.hidden = true;
});

// Registered at the end of the boot, so it never delays a screen. Where service
// workers are missing — an old browser, a file:// copy, a private window that
// refuses — the app simply behaves as it did before.
startOffline({ onUpdateReady: () => { el.updateNote.hidden = false; } });
paintOffline();

function cancelListening() {
  micTicket += 1;
  listenBuddy?.listen(false);
  if (state.mic) {
    state.mic.close();
    state.mic = null;
  }
  state.phase = 'idle';
  state.take = null;
  // A sight-reading take has to go with the microphone. Left armed it would
  // keep swallowing frames — and scoring — on a screen nobody is looking at.
  stopSightTake(false);
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

/**
 * Synthetic pitch frames, so the result screen can be reviewed silently.
 * `base` maps a note index to how many cents it sits off; `offset` shifts the
 * whole take, which is how ?demo=test gets three different-looking takes.
 */
function demoFrames(scale, offset = 0, base = { 8: 34, 9: -31, 20: 42 }) {
  const frames = [];
  const step = 0.03;
  const detune = {};
  for (const [i, cents] of Object.entries(base)) detune[i] = cents + offset;
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
  // A take that is clean all the way through: every note green, every bar at
  // 100%, so the staff colours and the score can never contradict each other.
  renderResult(analyzeTake(demoFrames(state.scale, 0, { 8: 8, 20: -6 }), state.scale));
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
// Read-only views for the browser suites: the page on screen and the replay.
window.__sightPassage = () => sight.passage;
window.__sightReplay = () => (sight.replay ? { blob: sight.replay.blob, lead: sight.replay.lead, playing: Boolean(sight.replaying), at: sight.replaying?.position() ?? null, barTime: (b) => sightBarTime(sight.replay, b) } : null);

renderLogBanner();
// The names row has to be right on the first screen, not after a visit to the
// log: on a shared tablet it is the first question, and it is the only one that
// can be asked before anything personal appears.
renderWho();

if (params.has('help')) el.helpDialog.showModal();
if (params.has('pet')) openPet();
el.openPetBtn.addEventListener('click', openPet);
el.petBack.addEventListener('click', goHome);
paintMenuPet();
if (params.has('draw')) drawThree();
if (params.has('log')) openTrack();
if (params.has('statsdemo')) {
  // ?statsdemo seeds a few takes and opens the "Every take" tab, so the delete
  // list can be looked at without playing anything.
  const today = todayKey();
  for (const [kind, id, level, score] of [
    ['scale', 'G', '', 92],
    ['scale', 'D', '', 78],
    ['sight', '', '5', 84],
    ['scale', 'A', '', 61],
  ]) {
    Journal.recordTake(journal, {
      kind,
      id,
      level,
      score,
      key: today,
      counted: true,
      parts: { accuracy: score / 100, intonation: score / 100 },
    });
  }
  Journal.logTake(journal, today, 'scales');
  saveJournal();
  showView('stats');
  statsView.tab = 'takes';
  renderStats();
}
if (params.has('sightdemo')) {
  openSight(Number(params.get('sightdemo')) || 5, params.has('seed') ? Number(params.get('seed')) : 7);
  renderSightResult(analyzeSightTake(sightDemoFrames(sight.passage), sight.passage));
}
if (params.has('sightwalk')) {
  // ?sightwalk=5&seed=7 walks the moving line across the whole passage and
  // records what it did at each step — the drawing's own geometry, without a
  // microphone or an audio clock. A suite reads window.__sightWalk and fails if
  // the line is ever invisible, mis-sized or off the page.
  openSight(Number(params.get('sightwalk')) || 5, params.has('seed') ? Number(params.get('seed')) : 7);
  const walk = () => {
    const passage = sight.passage;
    ensurePlayhead();
    sight.anchors = sightAnchors(passage, el.sightStaff.querySelector('svg'));
    // Sixteenths, the same unit runAssistPlayhead() counts in.
    const total = passage.bars.length * passage.perBar;
    window.__sightWalkMeta = {
      perBar: passage.perBar,
      meter: passage.meter,
      tempo: passage.tempo,
      systems: sight.perSystem,
      events: passage.bars.map((bar, b) =>
        bar.map((e) => ({ b, start: e.start, dur: e.dur, rest: Boolean(e.rest) })),
      ),
      anchors: sight.anchors.map((a) => ({
        start: a.start,
        x: Math.round(a.x),
        y: Math.round(a.y),
        top: Math.round(a.top),
      })),
    };
    const steps = [];
    for (let k = 0; k <= 200; k++) {
      const at = (total * k) / 200;
      const anchor = movePlayhead(sight, at);
      const here = sight.anchors[anchor] || { start: 0 };
      steps.push({
        at,
        // The bar the line is actually on, read off the note it landed on — not
        // off the clock, so a clock that runs at the wrong speed shows up here.
        bar: Math.min(passage.bars.length, Math.floor(here.start / passage.perBar) + 1),
        x: Number(playhead.line.getAttribute('x1')),
        y1: Number(playhead.line.getAttribute('y1')),
        y2: Number(playhead.line.getAttribute('y2')),
        cy: Number(playhead.dot.getAttribute('cy')),
        opacity: playhead.group.style.opacity,
      });
    }
    window.__sightWalk = steps;
  };
  // A task later, so the drawing has been laid out and getBBox() has real
  // numbers in it. A timer rather than requestAnimationFrame: an iframe parked
  // off-screen — which is how the suite loads this — may never be given a frame,
  // and a walk that silently never happens cannot fail a test.
  setTimeout(walk, 0);
}
if (params.has('sight')) {
  // ?sight=5&seed=4471 reproduces one passage exactly — handy for a class
  openSight(Number(params.get('sight')) || 5, params.has('seed') ? Number(params.get('seed')) : null);
}
if (params.has('sightplay')) {
  // Plays a synthetic take through routeFrame — the same wire the microphone
  // uses — so the listening path can be checked without a microphone.
  // ?sightplay=5&seed=7            one whole take, scored
  // ?sightplay=5&hold=1400         stop early, needle left on screen
  // ?sightplay=5&detune            every note 42 cents sharp
  // ?sightplay=5&live=0            arm with the needle switched off
  // ?sightplay=5&assist           the same, with the count-in and the clicks
  openSight(Number(params.get('sightplay')) || 5, params.has('seed') ? Number(params.get('seed')) : 7);
  armSightTake({ live: params.get('live') !== '0' });
  const assisted = params.has('assist');
  // How many click nodes the run is still holding, so a suite can measure a leak
  // after leaving without an audio device.
  window.__assistClicks = () => assistClicks.length;
  // What iOS does to a take when it takes the microphone away — the screen has
  // to hand the buttons back and must not score the silence.
  window.__micStalled = () => onMicStalled();
  // `warm` walks the microphone warm-up: the take arms with awaitWarm and the
  // first frame — held back here, the way a phone's capture path holds it — is
  // what starts the count-in (see startSightTake and ingestSightFrame).
  const warming = assisted && params.has('warm');
  if (assisted) {
    el.sightAssist.checked = false;
    if (warming) {
      sight.take.awaitWarm = true;
      el.sightStatus.textContent = t('sight.warmingMic');
    } else {
      startAssistedRun();
    }
  }
  // ?sightplay=5&wobble — a take whose notes sit at a spread of cents, so the
  // picture of "how far off, and which way" can be looked at (and screenshotted)
  // without playing it.
  const wobble = [34, -12, 4, -28, 18, -6, 8, -38, 22, -16];
  const offsets = params.has('detune')
    ? Object.fromEntries([...Array(64).keys()].map((k) => [k, 42]))
    : params.has('wobble')
      ? Object.fromEntries([...Array(64).keys()].map((k) => [k, wobble[k % wobble.length]]))
      : {};
  // ?sightplay=5&soft — the same take through a phone's microphone: quiet, and
  // never quite certain of its own periodicity, which is what used to leave the
  // take waiting for a "confident" frame that never came.
  const frames = sightDemoFrames(
    sight.passage,
    0.32,
    offsets,
    params.has('soft') ? { clarity: 0.58, rms: 0.0045, silentRms: 0.0004 } : {},
  );
  const holdAt = params.has('hold') ? Number(params.get('hold')) / 1000 : Infinity;
  let i = 0;
  const step = () => {
    if (i >= frames.length) return finishSightTake();
    const frame = frames[i++];
    routeFrame(frame);
    // Let the picture settle while the needle is still up, for a screenshot.
    if (frame.t >= holdAt) return;
    setTimeout(step, 0);
  };
  // A count-in runs on the audio clock, in real seconds, while these frames carry
  // simulated time — so the feed waits for it, the way a student does.
  const feed = () => {
    if (sight.take && sight.take.counting) return setTimeout(feed, 50);
    step();
  };
  if (warming) {
    setTimeout(() => {
      routeFrame(frames[0]);
      i = 1;
      feed();
    }, 600);
  } else if (assisted) {
    setTimeout(feed, 50);
  } else {
    step();
  }
}
if (params.has('sightleak')) {
  // Walking away mid-take must stop the counting: arm, play a little, leave,
  // then play a lot more. Nothing should appear on the sight-reading screen.
  openSight(5, 7);
  armSightTake();
  const frames = sightDemoFrames(sight.passage);
  frames.slice(0, 40).forEach(routeFrame);
  goHome();
  frames.slice(40).forEach(routeFrame);
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
