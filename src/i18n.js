// i18n.js — English (the source) and Simplified Chinese.
//
// Two tables:
//   S      sentence-level strings built in JavaScript, as [english, chinese]
//   STATIC exact matches for text that lives in index.html
//
// Switching language reloads the page, which keeps every screen consistent
// without tracking a translation of live state.

let lang = 'en';

export function getLang() {
  return lang;
}

export function initLang() {
  const forced = new URLSearchParams(location.search).get('lang');
  let stored = null;
  try {
    stored = localStorage.getItem('scaleStudio.lang');
  } catch {
    stored = null;
  }
  lang = (forced || stored) === 'zh' ? 'zh' : 'en';
  try {
    if (forced) localStorage.setItem('scaleStudio.lang', lang);
  } catch {
    /* private mode — the URL still works */
  }
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en';
  return lang;
}

export function setLang(next) {
  try {
    localStorage.setItem('scaleStudio.lang', next === 'zh' ? 'zh' : 'en');
  } catch {
    /* ignore */
  }
  const url = new URL(location.href);
  url.searchParams.set('lang', next === 'zh' ? 'zh' : 'en');
  location.href = url.toString();
}

/** Translate a sentence key. `{name}` placeholders are filled from params. */
export function t(key, params) {
  const entry = S[key];
  if (!entry) return key;
  let text = entry[lang === 'zh' ? 1 : 0];
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (match, name) =>
      params[name] == null ? match : String(params[name]),
    );
  }
  return text;
}

/** Translate the static text in the page (and any [data-i18n] blocks). */
export function applyStatic(root = document.body) {
  if (lang !== 'zh' || !root) return;

  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const html = STATIC[el.dataset.i18n];
    if (html) el.innerHTML = html;
  });

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
      if (parent.closest('[data-i18n]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const raw = node.nodeValue;
    const key = raw.trim().replace(/\s+/g, ' ');
    const translated = STATIC[key];
    if (typeof translated === 'string') {
      const leading = raw.match(/^\s*/)[0];
      const trailing = raw.match(/\s*$/)[0];
      node.nodeValue = leading + translated + trailing;
    }
  });

  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const text = STATIC[el.dataset.i18nTitle];
    if (text) el.setAttribute('title', text);
  });

  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset.i18nAria;
    if (S[key]) el.setAttribute('aria-label', t(key));
  });
}

/* ── Sentences built in code ──────────────────────────────────────────── */

export const S = {
  'banner.5-6': [
    'The app draws three scales at random — the way a judge does. Play them one after another, no feedback until the end.',
    '系统会像评委一样，随机抽三条音阶。一条接一条拉完，最后才给反馈。',
  ],
  'banner.3-4': [
    'Choose the seven you have prepared; the app picks one two-octave and two one-octave scales, the way a judge does.',
    '选出你准备好的七条音阶，系统会像评委一样，挑一条两个八度的、两条一个八度的。',
  ],
  'banner.1-2': [
    'At Level I–II you choose the three scales you prepared. The app listens to all three, then gives you one report.',
    '一至二级由你自己选三条准备好的音阶。系统听完三条，再给一份总的反馈。',
  ],
  'btn.draw3': ['Draw three scales', '抽三条音阶'],
  'btn.drawAgain': ['Draw again', '重新抽'],
  'btn.chooseAgain': ['Choose again', '重新选'],
  'test.praise.title': ['Nothing to fix', '没有需要改的'],
  'test.praise.text': [
    'All three scales landed, centred and unbroken. That is exactly the shape of an audition you can trust.',
    '三条音阶都落准了、也没有断。这正是可以放心的考试状态。',
  ],
  'btn.choose3': ['Choose my three', '选择我的三条'],
  'btn.choose7': ['Choose my seven', '选择我的七条'],

  'note.1-2': [
    'Level I–II: three major scales, one octave, and you choose which three. G, D and A are the usual first three — the same finger pattern, all from open strings.',
    '一至二级：三条大调音阶，一个八度，由你自己选。最常用的前三条是 G、D、A——指法相同，都从空弦开始。',
  ],
  'note.3-4': [
    'Level III–IV: seven major scales, two of them in two octaves. The adjudicator picks one two-octave and two one-octave scales.',
    '三至四级：七条大调音阶，其中两条拉两个八度。评委会挑一条两个八度的、两条一个八度的。',
  ],
  'note.5-6': [
    'Levels V–VI require fifteen major scales — C plus the seven sharp keys and the seven flat keys — all two octaves, up and down, from memory.',
    '五至六级要求十五条大调音阶——C 调加上七个升号调、七个降号调——全部两个八度，上下行，背谱演奏。',
  ],
  'note.minor': [
    'Minor scales are not part of the NYSSMA scale requirement, but a lot of the level 5–6 repertoire is in a minor key — so here they are.',
    'NYSSMA 的音阶要求里没有小调，但五、六级的曲目很多是小调——所以放在这里备用。',
  ],

  'meta.1': ['1 octave · up and down · {n} notes', '一个八度 · 上下行 · {n} 个音'],
  'meta.2': ['{o} octaves · up and down · {n} notes', '{o} 个八度 · 上下行 · {n} 个音'],
  'key.none': ['no sharps or flats', '没有升降号'],
  'key.sharp': ['{n} sharp', '{n} 个升号'],
  'key.sharps': ['{n} sharps', '{n} 个升号'],
  'key.flat': ['{n} flat', '{n} 个降号'],
  'key.flats': ['{n} flats', '{n} 个降号'],
  'card.sub': ['{key} · {o} octaves', '{key} · {o} 个八度'],

  'status.ready': ['Ready when you are', '准备好了就开始'],
  'status.listening': ['Listening — play whenever you are ready', '正在聆听——随时开始'],
  'status.listeningScale': ['Listening to your scale', '正在听这条音阶'],
  'status.finished': ['Take finished', '这一次结束了'],
  'status.scaleDone': ['Scale {n} done', '第 {n} 条完成'],
  'status.waitingMic': ['Waiting for the microphone', '正在等待麦克风'],
  'status.micUnavailable': ['Microphone unavailable', '麦克风不可用'],

  'hint.begin': [
    'No rush — the take begins the moment you play your first note.',
    '不用急——你拉出第一个音，它才开始记录。',
  ],
  'hint.beginTest': [
    'Feedback comes at the end — play it the way you would for the judge.',
    '最后才给反馈——就当评委在听。',
  ],
  'hint.playing': [
    'The take starts with your first note and ends after you stop.',
    '从你第一个音开始，停下来之后自动结束。',
  ],
  'hint.allTheWay': ['All the way up, then back down.', '一路上去，再原路下来。'],
  'hint.next': [
    'Next scale in a moment — breathe, then play when you are ready.',
    '马上到下一条——先缓一下，准备好了再开始。',
  ],
  'hint.noSound': [
    'No sound is reaching the app yet — check which microphone this site is allowed to use, and that it is not muted.',
    '还没有收到声音——检查一下这个网站允许使用的麦克风，以及麦克风有没有被静音。',
  ],
  'hint.takeYourTime': [
    'Take your time. When you are done for now, press “End audition” above.',
    '慢慢来。如果先结束，就按上面的“结束考试”。',
  ],

  'btn.hideNotation': ['Hide notation', '隐藏乐谱'],
  'btn.showNotation': ['Show notation', '显示乐谱'],
  'btn.startListening': ['Start listening', '开始聆听'],
  'btn.starting': ['Starting…', '正在启动…'],

  'eyebrow.result': ['{title} · {o} octaves', '{title} · {o} 个八度'],
  'result.nothing.title': ['Nothing to score yet', '还没有可以评分的'],
  'result.nothing.body': [
    "The microphone didn't pick up a clear note. Move a little closer, keep the bow moving, and try again.",
    '麦克风没有收到清楚的音。靠近一点，弓继续拉，再试一次。',
  ],
  'result.sub': [
    '{exact} of {expected} notes centred · {heard} notes heard · ♩ ≈ {bpm} · {dur}s',
    '{expected} 个音里 {exact} 个准 · 听到 {heard} 个音 · ♩ ≈ {bpm} · {dur} 秒',
  ],
  'result.subSimple': ['{exact} of {expected} notes centred · {heard} notes heard', '{expected} 个音里 {exact} 个准 · 听到 {heard} 个音'],

  'component.notes': ['Notes', '音符'],
  'component.intonation': ['Intonation', '音准'],
  'component.steadiness': ['Steadiness', '节奏'],
  'component.flow': ['Flow', '连贯'],

  'grade.96.label': ['Exceptional', '非常出色'],
  'grade.96.note': ['That is adjudication-ready.', '这个水平可以直接上考场了。'],
  'grade.90.label': ['Excellent', '优秀'],
  'grade.90.note': ['Clean, centred and even.', '干净、准、节奏稳。'],
  'grade.82.label': ['Very good', '很好'],
  'grade.82.note': ['A small polish and it is there.', '再打磨一点就成了。'],
  'grade.72.label': ['Good work', '不错'],
  'grade.72.note': ['The shape is secure — now the details.', '框架已经稳了，接下来是细节。'],
  'grade.60.label': ['Coming along', '在进步'],
  'grade.60.note': ['The notes are arriving; keep the pulse steady.', '音都出来了，接下来把节奏稳住。'],
  'grade.0.label': ['Keep building', '继续加油'],
  'grade.0.note': ['Slow it down and let each note settle.', '放慢一点，让每个音站稳。'],

  'test.grade.93': ['An audition-ready set', '这一套可以直接上考场'],
  'test.grade.84': ['A strong set', '一套很稳的音阶'],
  'test.grade.70': ['A good set', '一套不错的音阶'],
  'test.grade.58': ['Coming together', '渐渐成形了'],
  'test.grade.0': ['A set worth repeating', '值得再练一遍'],

  'verdict.clean': ['clean', '干净'],
  'verdict.solid': ['solid', '稳'],
  'verdict.stoppedOne': ['stopped once', '停了一次'],
  'verdict.stopped': ['stopped {n} times', '停了 {n} 次'],
  'verdict.missedOne': ['1 note missed', '漏了 1 个音'],
  'verdict.missed': ['{n} notes missed', '漏了 {n} 个音'],
  'verdict.offCentre': ['a few notes off-centre', '几个音偏了'],
  'verdict.pulse': ['the pulse wandered', '节奏有些飘'],
  'verdict.nothing': ['nothing heard', '没听到声音'],

  'test.step': ['Scale {i} of {n}', '第 {i} / {n} 条'],
  'test.sub': [
    '{n} scales · {centred} of {total} notes centred · {stops}',
    '{n} 条音阶 · {total} 个音里 {centred} 个准 · {stops}',
  ],
  'test.noStops': ['no stops', '没有停顿'],
  'test.stops': ['{n} stops', '{n} 次停顿'],
  'test.stopOne': ['1 stop', '1 次停顿'],
  'test.sub.1-2': ['The three you chose — one octave each.', '你选的三条——每条一个八度。'],
  'test.sub.3-4': [
    'One two-octave and two one-octave scales, drawn from your seven.',
    '从你的七条里抽出：一条两个八度，两条一个八度。',
  ],
  'test.sub.5-6': ['Drawn from the twelve NYSSMA keys — no repeats.', '从十二个 NYSSMA 调里抽出——不重复。'],
  'test.pickTitle.3': ['Choose three scales', '选三条音阶'],
  'test.pickTitle.7': ['Choose seven scales', '选七条音阶'],
  'test.pickSub.3': [
    'Pick the three you know best — you will play them one after another.',
    '挑你最有把握的三条——会一条接一条拉。',
  ],
  'test.pickSub.7': [
    'These are the seven you have prepared. The app then picks one to play in two octaves and two in one octave, the way a judge would.',
    '这七条是你准备好的。系统会像评委一样，从中挑一条拉两个八度、两条拉一个八度。',
  ],
  'test.count': ['{n} of {need} chosen', '已选 {n} / {need}'],

  'mic.denied': [
    'Microphone access was blocked. Allow it for this page (the icon at the left of the address bar) and press start again.',
    '麦克风被拦住了。在这个页面允许使用（地址栏左边的图标），再按一次开始。',
  ],
  'mic.notFound': [
    'No microphone was found. Check that one is plugged in and selected in your sound settings.',
    '找不到麦克风。检查一下有没有接上、系统声音设置里有没有选对。',
  ],
  'mic.busy': [
    'Another app is using the microphone. Close it and try again.',
    '另一个程序正在用麦克风。先关掉它，再试一次。',
  ],
  'mic.insecure': [
    'This browser will not share the microphone on a local file. Start the app with “Start Scale Studio” (or serve it over localhost) and it will work.',
    '浏览器不会在本地文件上打开麦克风。用“Start Scale Studio”启动（或通过 localhost 打开），就可以用了。',
  ],
  'mic.generic': [
    'The microphone could not start{detail}.',
    '麦克风启动不了{detail}。',
  ],
  'boot.title': ['This page needs its little server', '这个页面需要本地小服务'],
  'boot.body': [
    'Double-click <strong>Start Scale Studio.cmd</strong> in the app folder and use the page it opens (<code>http://localhost:8777/</code>). Leave the black window open while you practise — closing it stops the app.',
    '双击文件夹里的 <strong>Start Scale Studio.cmd</strong>，用它打开的页面（<code>http://localhost:8777/</code>）。练习时那个黑窗口要一直开着——关掉它，应用就停了。',
  ],
  'boot.detail': [
    'Browsers block a page’s scripts — and the microphone — when the page is opened straight from a file.',
    '直接从文件打开时，浏览器会拦住页面的脚本，也会拦住麦克风。',
  ],
  'boot.errorTitle': ['The app did not start', '应用没有启动'],
  'boot.errorBody': [
    'Something stopped the scripts from loading. Reload the page, and if it keeps happening open the browser’s developer console for the error.',
    '有东西让脚本没能加载。刷新一下；如果一直这样，打开浏览器开发者工具看一下报错。',
  ],

  'tip.intonation.title': ['A few notes sat off-centre', '有几个音偏了一点'],
  'tip.intonation.text': [
    '{list}. Slow those notes down and listen for the ring — the pitch should feel like it locks into place rather than being placed.',
    '{list}。把这几处放慢，听那个“落定”的感觉——音准是找出来的，不是按上去的。',
  ],
  'tip.high.title': ['You sat a little high overall', '整体偏高了一点'],
  'tip.high.text': [
    'Across the scale you averaged {cents}¢ sharp. Check your open strings against a drone before you start — most of the time it is the A string creeping up.',
    '整条音阶平均高了 {cents} 音分。开始前先用持续音对一下空弦——多数情况是 A 弦慢慢跑高了。',
  ],
  'tip.low.title': ['You sat a little low overall', '整体偏低了一点'],
  'tip.low.text': [
    'Across the scale you averaged {cents}¢ flat. That is often a bow-speed or hand-frame thing rather than a listening thing — play the scale again with a fuller, slower bow.',
    '整条音阶平均低了 {cents} 音分。这常常是运弓速度或手型的问题，不只是听的问题——用更饱满、更慢的弓再拉一遍。',
  ],
  'tip.rhythm.title': ['The pulse wandered a little', '节奏有点飘'],
  'tip.rhythm.text': [
    'The notes were mostly even, but the spacing drifted{tempo}. Set a metronome a notch slower and let each note take exactly the same space before adding speed.',
    '音大多还匀，但间隔有点飘{tempo}。把节拍器调慢一档，让每个音占一样长，再慢慢加快。',
  ],
  'tip.rhythm.tempo': [' around ♩={bpm}', '（大约 ♩={bpm}）'],
  'tip.tempo.title': ['There is room to move a little', '可以再流动一点'],
  'tip.tempo.text': [
    'You played around ♩={bpm}. The Manual asks for “a moderate speed” — not fast, just flowing. Once the notes feel secure, nudge toward ♩=60–72; scales usually get easier there, not harder.',
    '你大约拉在 ♩={bpm}。考纲要的是“中等的速度”——不是快，是流动。等音都稳了，试着往 ♩=60–72 靠；音阶到了这个速度通常更顺，不会更难。',
  ],
  'tip.flow.titleOne': ['You stopped once', '中间停了一次'],
  'tip.flow.title': ['You stopped {n} times', '中间停了 {n} 次'],
  'tip.flow.text': [
    '{long}Stops usually mean the next note is not yet automatic — loop that spot on its own three times, then rejoin the scale from two notes before it.',
    '{long}停顿通常说明下一个音还没变成习惯——把那两三个音单独练三遍，再从前面两个音接进来。',
  ],
  'tip.flow.long': ['Some of those were long enough to break the phrase. ', '其中有几次停得比较久，把句子断开了。'],
  'tip.notes.titleOne': ['1 note not heard', '有 1 个音没听到'],
  'tip.notes.title': ['{n} notes not heard', '有 {n} 个音没听到'],
  'tip.notes.text': [
    'Either a note was skipped, or it was too quiet for the microphone. Play the scale again at a confident dynamic — a clear, even bow helps the app hear every note.',
    '可能是漏了一个音，也可能是太轻了麦克风没收到。用更有把握的音量再拉一遍——清楚、均匀的弓能帮它听到每个音。',
  ],
  'tip.range.titleHigh': ['You started an octave above the written range', '起音比谱面高了一个八度'],
  'tip.range.titleLow': ['You started an octave below the written range', '起音比谱面低了一个八度'],
  'tip.range.text': [
    'This scale runs {range}. The notes were right — just in the other octave — so reset the hand to the note shown in the diagram and begin there.',
    '这条音阶的范围是 {range}。音都对了，只是低/高了一个八度——把手位调回图上那个起音，从那里开始。',
  ],
  'tip.praise.title': ['Nothing to fix', '没有需要改的'],
  'tip.praise.text': [
    'Every note landed and stayed centred. Try it once more at a slightly quicker tempo, or take it up a third of the bow.',
    '每个音都落准了。可以稍微加快一点再来一遍，或者把弓段往中上弓移一些。',
  ],

  'encourage.excellent.1': [
    'Three scales, cold, in a row — and they all held together. That is what prepared sounds like.',
    '三条音阶，没有热身，一条接一条——全都立住了。这就是“准备好了”的声音。',
  ],
  'encourage.excellent.2': [
    'You played the set like one piece of music. Judges hear that confidence before they hear anything else.',
    '你把这三条拉成了一整段音乐。评委最先听到的就是这份底气。',
  ],
  'encourage.excellent.3': [
    'Nothing in that set needed apologising for. Keep this tempo; it is clearly yours.',
    '这一套没什么需要抱歉的地方。记住这个速度，它已经是你的了。',
  ],
  'encourage.strong.1': [
    'A genuinely solid set. What is left is small, and small things polish quickly.',
    '很扎实的一套。剩下的都是小地方，而小地方修起来最快。',
  ],
  'encourage.strong.2': [
    'Three scales in a row takes stamina, and you had it. One or two notes slipped — that is all.',
    '连着三条音阶是要体力的，你有。只滑了一两个音，就这些。',
  ],
  'encourage.strong.3': [
    'That is already a confident audition. Pick one line from the list below and it becomes a strong one.',
    '这已经是一次有把握的考试了。从下面挑一条去练，它就会变成很稳的一套。',
  ],
  'encourage.growing.1': [
    'Good bones. The notes are all there — now let them settle instead of going to find them.',
    '框架很好，音都在——接下来是让它们“落下来”，而不是去找它们。',
  ],
  'encourage.growing.2': [
    'You kept going, which matters more than any single note. Here is what to tidy next.',
    '你坚持下来了，这比任何一个音都重要。下面是接下来要收拾的地方。',
  ],
  'encourage.growing.3': [
    'This is the stage where it starts to feel easy. Slow, even repetitions of the list below will get you there.',
    '到了这个阶段，它会开始变得轻松。把下面几条慢慢地、均匀地重复，就能到。',
  ],
  'encourage.keep.1': [
    'Every one of these runs counts as practice. Start with the first line below — just that.',
    '每拉一遍都算练习。先从下面第一条开始——只做这一条。',
  ],
  'encourage.keep.2': [
    'The shape of all three scales is already in your hands. Now it is steadiness, not new notes.',
    '三条音阶的形状已经在你手上了。现在要的是稳，不是新东西。',
  ],
  'encourage.keep.3': [
    'Nothing here is a mystery: the same two or three habits. Take them one at a time.',
    '这里没有神秘的东西：就是那两三个习惯。一次拿一个。',
  ],

  'tuner.stringsNote': ['{s} is sitting where you want it.', '{s} 弦正好。'],
  'tuner.close': ['A touch {dir} — ease it {move}.', '稍微{dir}了一点——往{move}松一点。'],
  'tuner.far': ['{n}¢ {dir} — bring the peg {move}.', '{dir}了 {n} 音分——把弦轴往{move}放。'],
  'tuner.dirHigh': ['sharp', '高'],
  'tuner.dirLow': ['flat', '低'],
  'tuner.moveDown': ['down', '下'],
  'tuner.moveUp': ['up', '上'],
  'tuner.idle': ['Bow a string — the dial follows it.', '拉一根空弦，指针会跟着走。'],
  'tuner.noMic': ['Press “Start listening” to use the microphone.', '按“开始聆听”来使用麦克风。'],
  'tuner.pairHint': ['tune {tune} to {base}', '{tune} 对 {base}'],

  'oct.short': ['{n} oct', '{n} 个八度'],

  /* screen-reader labels (also used by [data-i18n-aria] in the HTML) */
  'aria.back': ['Back to scale list', '回到音阶列表'],
  'aria.level': ['NYSSMA level', 'NYSSMA 级别'],
  'aria.family': ['Scale family', '音阶类型'],
  'aria.form': ['Minor form', '小调形式'],
  'aria.octaves': ['Octaves', '八度'],
  'aria.notation': ['Scale notation', '音阶乐谱'],
  'aria.dial': ['Tuning dial', '调音表盘'],
};

/* ── Static text that lives in index.html ─────────────────────────────── */

export const STATIC = {
  /* chrome */
  'Tuner': '调音',
  'How it works': '评分说明',
  'English': 'English',
  '中文': '中文',
  'NYSSMA Levels I–VI · violin': 'NYSSMA 一至六级 · 小提琴',
  'Tuned to A = 440 Hz': '以 A = 440 Hz 为准',
  'Nothing is recorded or uploaded — audio is analysed in your browser.':
    '不录音、不上传——声音只在这个浏览器里分析。',

  /* chooser */
  'Which scale today?': '今天练哪条音阶？',
  'Pick a key and press start. The app stays quiet until you play your first note, then listens to the whole scale and tells you what it heard — no timer, no rush.':
    '选一个调，点“开始”。你拉出第一个音之前它只是安静地等着；之后它会完整听一遍，告诉你听到了什么——不计时，不催你。',
  'Mock audition': '模拟考试',
  'Level': '级别',
  'Scales': '音阶',
  'NYSSMA majors': 'NYSSMA 大调',
  'Minor scales': '小调',
  'natural': '自然',
  'harmonic': '和声',
  'melodic': '旋律',

  /* practice */
  '← All scales': '← 全部音阶',
  'All scales': '全部音阶',
  'From memory': '背谱演奏',
  '1 oct': '1 个八度',
  '2 oct': '2 个八度',
  'Finish early': '提前结束',
  'in tune': '准',
  '♭ 50': '♭ 50',
  '50 ♯': '50 ♯',

  /* results */
  'Where it landed': '每个音的落点',
  'centred': '准',
  'slightly off': '略偏',
  'off': '偏了',
  'not heard': '没听到',
  'Play it again': '再拉一次',
  'Choose another scale': '换一条音阶',

  /* audition */
  'Your three scales': '抽到的三条音阶',
  'Begin audition': '开始考试',
  'End audition': '结束考试',
  'What to work on': '接下来练什么',
  'Play these three again': '再考这三条',
  'Draw three new': '重新抽三条',
  'Which two will you play in two octaves?': '哪两条要拉两个八度？',
  'Continue': '继续',
  'Clear': '清空',

  /* tuner */
  'Tune': '调音',
  'How to tune it': '怎么调',
  'Pegs and fine tuners': '弦轴和微调器',
  'Check the fifths — this matters most': '检查五度——这一步最重要',
  'Play a string to begin.': '拉一根空弦开始。',
  'Start listening': '开始聆听',
  'Bow one string at a time — the app follows whichever string it hears.':
    '一次拉一根空弦——它会自动跟着听到的那根。',

  /* help dialog */
  'How the score works': '分数是怎么来的',
  'Got it': '知道了',

  'help.intro':
    '每次拉完，都会和屏幕上那条音阶逐个音比较。29 个音一一对应，所以多一个音或漏一个音，只影响它自己那一格，不会把后面的都算错。',
  'help.legend':
    '<li><strong>音符</strong><span>56%</span><em>音高对不对，顺序对不对？</em></li>' +
    '<li><strong>音准</strong><span>20%</span><em>每个音离正中多远，以音分计。</em></li>' +
    '<li><strong>节奏</strong><span>12%</span><em>每个音的间隔是否均匀。</em></li>' +
    '<li><strong>连贯</strong><span>12%</span><em>有没有停到把句子断掉。</em></li>',
  'help.generous':
    '评分是故意宽松的：15 音分以内都算准，节奏略微不匀几乎不扣分。真正影响分数的是明显的停顿、错音和漏音。',
  'help.audition':
    '模拟考试永远是三条音阶，一条接一条，中途没有调音器、也不给分数。五至六级由系统抽签；一至四级你自己选准备好的，系统从里面挑。',
  'help.mic':
    '在安静的房间里，离麦克风近一些，第一个音多拉一会儿——它从听到的第一个稳定的音开始。',

  'guide.howToTitle': '怎么调',
  'guide.howTo':
    '<li><strong>先调 A 弦。</strong>其他弦都以它为准，所以先把 A 弦定下来。</li>' +
    '<li><strong>A、D、E 要比正中略高一点——这是故意的。</strong>独奏者会调得稍高，有两个原因：琴声会更亮、传得更远；而且弦拉久了会慢慢变低，起手高一点，就能在更长的时间里保持准。</li>' +
    '<li><strong>G 弦是例外：略低一点。</strong>它是对运弓最敏感的一根，用力一压音就上去了，所以调低一点反而更稳——而且它仍要和 D 弦成纯五度。</li>' +
    '<li><strong>然后让琴自己对齐自己。</strong>调音器只能把你带到附近，最后是五度说了算。</li>',
  'guide.pegsIntro':
    '大多数时候调音只是微调器转一点点。只有在弦离目标很远时才用弦轴——而弦轴要小心：转一点，音高就走很多，弦就是这样断的。',
  'guide.pegs':
    '<li><strong>先用微调器，几乎总是这样。</strong>音差不多的时候，微调器拧一点就够了。</li>' +
    '<li><strong>只有大幅调整才用弦轴</strong>——换新弦、弦轴滑了、天气变了。每次转一点点，转完看一眼表盘。</li>' +
    '<li><strong>先把琴扶好。</strong>用另一只手把琴顶住，抵住推弦轴的力。调上面的弦轴时，扶琴头或弦轴箱，<em>不要</em>扶琴身：一边按弦轴一边抓琴身下半部，会让琴颈受扭，琴颈就是这样断的。</li>' +
    '<li><strong>转的时候往里按。</strong>转动时轻轻把弦轴往弦轴箱里压。弦轴靠摩擦力固定，不往里压，一松手它就会滑回去。</li>' +
    '<li><strong>从低处往上调，别冲过头。</strong>先把弦松到略低，再往上调到音准。从下面上来能让弦轴坐稳，也就不用越过目标再退回来——那正是让弦接近断裂的动作。</li>' +
    '<li><strong>微调器拧到底了</strong>，就重置：先把微调器松回去大半，用弦轴把弦拉回音准，再用微调器收尾。微调器到底了，就什么也调不了。</li>',
  'guide.warning':
    '<strong>E 弦最容易断。</strong>最细、张力最高——转得最小，弦轴卡住了也绝不要硬拧。',
  'guide.fifthsIntro1':
    '小提琴按纯五度定弦，而调音器是十二平均律，两者在每根弦上都差几个音分。把每一对当双音按住，听有没有干净的共鸣、有没有慢悠悠的晃动。',
  'guide.fifthsIntro2':
    '<strong>以 A 为基准。</strong>先把 E 对 A，再把 D 对 A，最后把 G 对 D。每对只动后面那根弦——调完再回来看一眼表盘，因为五度比表盘更准。',
  'guide.fifthsIntro3':
    '这一段只能靠耳朵——系统判断不了双音。听起来对了，就打勾。',
  'guide.selfCheck': '用双音检查每一对。',

  /* the rest of the static sheet */
  'eyebrow.test': '模拟考试 · 三条音阶',
  'You can breathe between scales — the app waits for your first note each time.':
    '两条之间可以缓一口气——每一条它都会等你的第一个音。',
};
