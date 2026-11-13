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
  'test.pickHint': [
    'A good first three: G, D and A. Each starts on an open string, and all three use the same finger pattern.',
    '刚开始可以先选 G、D、A 三条：它们都从空弦开始，指法也一样。',
  ],
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
  /* the pet room */
  'pet.title': ['Pet room', '宠物小屋'],
  'pet.lead.choose': ['Five eggs, five friends. Pick the one you like — practising keeps it warm until it hatches.', '五颗蛋，五个小伙伴。选一颗你喜欢的——练琴能让它保持温暖，直到孵出来。'],
  'pet.lead.newborn': ['It hatched! Every new friend needs a name.', '孵出来啦！新朋友需要一个名字。'],
  'pet.lead.egg': ['Your egg is snug in its nest. Practising keeps it warm.', '你的蛋在窝里暖暖的。练琴能让它保持温暖。'],
  'pet.lead.pet': ['Your {kind}. Tap to pat — it loves hearing you play.', '你的{kind}。点一点摸摸它——它最喜欢听你拉琴。'],
  'pet.kind.dog': ['puppy', '小狗'],
  'pet.kind.cat': ['kitten', '小猫'],
  'pet.kind.hamster': ['hamster', '仓鼠'],
  'pet.kind.chicken': ['chick', '小鸡'],
  'pet.kind.fish': ['goldfish', '金鱼'],
  'pet.hint.dog': ['Paw prints… something that loves a walk?', '小脚印……是喜欢散步的小家伙吗？'],
  'pet.hint.cat': ['Stripes… something that purrs?', '条纹……是会呼噜呼噜的小家伙吗？'],
  'pet.hint.hamster': ['Seeds… something with chubby cheeks?', '瓜子……是有圆鼓鼓脸颊的小家伙吗？'],
  'pet.hint.chicken': ['Speckles… something that peeps?', '小斑点……是会叽叽叫的小家伙吗？'],
  'pet.hint.fish': ['Shimmery scales… something that swims?', '闪亮的鳞片……是会游泳的小家伙吗？'],
  'pet.choose': ['Tap an egg to look closer.', '点一颗蛋看看。'],
  'pet.choose.btn': ['This one!', '就选这颗！'],
  'pet.egg.chosen': ['It wiggled!', '它动了一下！'],
  'pet.egg.warm': ['Warmth {n} of {total}', '温暖度 {n}/{total}'],
  'pet.egg.howto': ['Every real scale or sight-reading take warms it. Three, and it hatches.', '每拉完一条音阶或一段视奏，蛋就暖一点。三次就会孵出来。'],
  'pet.practise': ['Go play a scale', '去拉一条音阶'],
  'pet.hatching': ['Something is happening…!', '有动静了……！'],
  'pet.born': ['Hello!', '你好呀！'],
  'pet.name.ask': ['Say hello! What will you call them?', '打个招呼吧！给它起个什么名字？'],
  'pet.name.ok': ['That’s the name', '就叫这个'],
  'pet.name.hello': ['Hi, I’m {name}!', '我是{name}！'],
  'pet.back': ['You’re back!!', '你回来啦！！'],
  'pet.wish': ['A snack would be nice…', '想吃点心……'],
  'pet.say.yawn': ['*yawn*', '（打哈欠）'],
  'pet.say.whee': ['Wheee!', '飞起来啦！'],
  'pet.say.again': ['Again, again!', '再来一次！'],
  'pet.say.cosy': ['Ooh, cosy…', '好舒服……'],
  'pet.say.nice': ['Ooh, I like it there!', '放这儿真好看！'],
  'pet.tip.drag': ['Tip: drag the furniture wherever you like — you can pick {name} up, too.', '小提示：家具可以随意拖动，{name} 也可以抱起来哦。'],
  'pet.tip.dragFish': ['Tip: drag the furniture wherever you like.', '小提示：家具可以随意拖动。'],
  'pet.say.dog1': ['Woof!', '汪！'],
  'pet.say.dog2': ['*wag wag*', '（摇尾巴）'],
  'pet.say.cat1': ['Purrr~', '呼噜~'],
  'pet.say.cat2': ['Mew!', '喵！'],
  'pet.say.hamster1': ['Squeak!', '吱！'],
  'pet.say.hamster2': ['*nibble*', '（啃啃）'],
  'pet.say.chicken1': ['Peep!', '叽！'],
  'pet.say.chicken2': ['Peep peep!', '叽叽！'],
  'pet.say.fish1': ['Blub!', '咕噜！'],
  'pet.say.fish2': ['*splash*', '（扑通）'],
  'pet.say.yum': ['Yum!', '好吃！'],
  'pet.say.favourite': ['My favourite!!', '我最爱吃这个！！'],
  'listen.back': ['Home', '主页'],
  'listen.title': ['Listen', '聆听'],
  'listen.beta': ['Beta', '测试版'],
  'listen.lead': ['Play anything — a piece, an étude, a bit of practice — and the app tells you what it noticed: tuning, vibrato, loud and soft, where you stopped. Bring your music as a MusicXML file and it can check every note and bar too.', '拉什么都行——乐曲、练习曲、随便练一段——应用会告诉你它听到了什么：音准、揉弦、强弱、在哪里停了。如果你有乐谱的 MusicXML 文件，它还能逐音逐小节检查。'],
  'listen.freeTitle': ['Just listen', '直接听'],
  'listen.freeText': ['No music needed. Without the score the app cannot know which note you meant, so it reports tendencies — which notes lean sharp or flat, your vibrato, your loud and soft — not right or wrong.', '不需要乐谱。没有乐谱，应用不知道你想拉哪个音，所以只说倾向——哪些音偏高偏低、揉弦、强弱——不判对错。'],
  'listen.scoreTitle': ['Use my score', '用我的乐谱'],
  'listen.scoreText': ['A MusicXML file (.musicxml, .xml or .mxl) — MuseScore, Finale, Sibelius and Dorico all export it, and most score-scanning apps make one from a photo or PDF (check it against the paper: scanners misread a note now and then). Then every note and bar gets checked.', 'MusicXML 文件（.musicxml、.xml 或 .mxl）——MuseScore、Finale、Sibelius、Dorico 都能导出，大多数扫谱应用也能把照片或 PDF 转成它（要对照纸质乐谱检查：扫谱偶尔会读错音）。这样每个音、每个小节都能检查。'],
  'listen.pickScore': ['Choose a score file', '选择乐谱文件'],
  'listen.otherScore': ['Another score', '换一份乐谱'],
  'listen.noScore': ['No score', '不用乐谱'],
  'listen.scoreLoaded': ['Score: <b>{title}</b>', '乐谱：<b>{title}</b>'],
  'listen.scoreHint': ['{bars} bars with the repeats, {notes} notes to play.', '算上反复共 {bars} 小节，{notes} 个音。'],
  'listen.part': ['Part', '声部'],
  'listen.scoreAria': ['Your score', '你的乐谱'],
  'listen.drawing': ['Drawing the score…', '正在显示乐谱…'],
  'listen.reading': ['Reading the file…', '正在读取文件…'],
  'listen.errFile': ['That file could not be read as MusicXML. Export it again as .musicxml or .mxl and try once more.', '这个文件无法作为 MusicXML 读取。请重新导出为 .musicxml 或 .mxl 再试。'],
  'listen.errTimewise': ['This score is saved "timewise", which the app cannot read yet. Export it again in the usual (partwise) MusicXML.', '这份乐谱是"按时间"格式保存的，暂时无法读取。请用常规（按声部）MusicXML 重新导出。'],
  'listen.errNoNotes': ['No notes were found in that part. Pick another part, or check the file.', '这个声部里没有找到音符。请换一个声部，或检查文件。'],
  'listen.errDraw': ['The score could not be drawn, but the take will still be checked against it.', '乐谱无法显示，但录音仍会按它来检查。'],
  'listen.tipQuiet': ['A quiet room, phone a metre or two away, pointing at you.', '安静的房间，手机离你一两米，对着你。'],
  'listen.tipHeadphones': ['Playing with a recording or piano? Put the accompaniment in headphones, or the app hears both and gets confused.', '跟着录音或钢琴拉？把伴奏放进耳机里，否则应用会同时听到两者而混淆。'],
  'listen.tipStraight': ['Play the repeats as written. D.C. and D.S. are not followed yet — stop at the jump, or play straight through.', '反复按谱演奏。D.C. 和 D.S. 暂时还不支持——跳转处停下，或者一直往下拉。'],
  'listen.record': ['Start listening', '开始聆听'],
  'listen.recordScore': ['Start — play from the top', '开始——从头拉'],
  'listen.opening': ['Opening the microphone…', '正在打开麦克风…'],
  'listen.recording': ['Listening — play whenever you are ready', '正在听——准备好就开始拉'],
  'listen.stop': ['I am done', '拉完了'],
  'listen.cancel': ['Cancel', '取消'],
  'listen.tooShort': ['That was very short — play for a little longer and try again.', '时间太短了——多拉一会儿再试。'],
  'listen.nothingHeard': ['No notes were heard. Is the microphone close enough?', '没有听到音符。麦克风够近吗？'],
  'listen.again': ['Play again', '再拉一次'],
  'listen.playAll': ['▶ Hear yourself', '▶ 听自己'],
  'listen.stopPlay': ['■ Stop', '■ 停止'],
  'listen.playHere': ['Listen from here', '从这里听'],
  'listen.noRecording': ['This browser could not record the take, so there is nothing to play back.', '这个浏览器无法录音，所以没有可回放的内容。'],
  'listen.playFail': ['The recording could not be played.', '录音无法播放。'],
  'listen.barAria': ['Bar {n}: listen from here', '第 {n} 小节：从这里听'],
  'listen.barNotPlayed': ['Bar {n} was not heard in the take.', '录音里没有听到第 {n} 小节。'],
  'listen.fromBar': ['Playing from bar {n}. Tap again to stop.', '从第 {n} 小节播放。再点一下停止。'],
  'listen.libTitle': ['Pieces from your teacher', '老师放进来的曲子'],
  'listen.libText': ['Ready to use: pick one and every note and bar gets checked.', '直接可用：选一首，每个音、每个小节都会检查。'],
  'listen.scannedTag': ['scanned', '扫描'],
  'listen.scannedNote': ['This score was read from a photo of the printed page by a computer, so it may not be 100% right: a note, a rhythm or a repeat can be misread. If the app and your printed music disagree, trust the paper and tell your teacher.', '这份乐谱是电脑从纸质乐谱的照片里读出来的，不一定百分之百准确：某个音、节奏或反复记号可能读错。如果应用和你的纸质乐谱不一样，以纸质乐谱为准，并告诉老师。'],
  'listen.libFail': ['That piece could not be opened. Check the connection and try again.', '这首曲子打不开。检查一下网络再试一次。'],
  'listen.practise': ['Practise', '练习'],
  'listen.whole': ['Whole piece', '整首'],
  'listen.section': ['A section', '一段'],
  'listen.sectionRange': ['bars {from} to {to}', '第 {from} 到 {to} 小节'],
  'listen.firstBarAria': ['First bar of the section', '这一段的第一个小节'],
  'listen.lastBarAria': ['Last bar of the section', '这一段的最后一个小节'],
  'listen.sectionTap': ['Or tap the first bar and then the last bar on the score.', '也可以在乐谱上先点第一个小节，再点最后一个小节。'],
  'listen.sectionFirst': ['Bar {n} picked. Tap the last bar of your section, or start with just this bar.', '选了第 {n} 小节。再点这一段的最后一个小节，或者就练这一个小节。'],
  'listen.sectionHint': ['Bars in this section: {bars}. Notes to play: {notes}.', '这一段：{bars} 个小节，{notes} 个音。'],
  'listen.recordSection': ['Start — play bars {a}–{b}', '开始——拉第 {a}–{b} 小节'],
  'listen.recordBar': ['Start — play bar {a}', '开始——拉第 {a} 小节'],
  'listen.tipSection': ['Play just the section, once, straight through. Then press “Play again” and try to beat your last go.', '只拉这一段，一遍，不反复。然后按“再拉一次”，争取比上一次更好。'],
  'listen.barPickAria': ['Bar {n}: choose for your section', '第 {n} 小节：选进这一段'],
  'listen.hear': ['▶ Hear it first', '▶ 先听一遍'],
  'listen.hearExample': ['▶ Hear the example', '▶ 听示范'],
  'listen.hearFail': ['The example could not be played on this device.', '这台设备播放不了示范。'],
  'listen.speed': ['Speed', '速度'],
  'listen.speedAria': ['Speed of the example, in quarter notes a minute', '示范的速度，每分钟多少个四分音符'],
  'listen.tempoMarked': ['As marked: {bpm}', '按谱面：{bpm}'],
  'listen.triesSection': ['This section so far', '这一段到现在'],
  'listen.triesPiece': ['This piece so far', '这首曲子到现在'],
  'listen.tryLine': ['Go {n}: {right} of {of}', '第 {n} 次：{of} 个音对了 {right} 个'],
  'listen.triesUp': ['Up from {was} right notes to {now}. That is the practice working.', '对的音从 {was} 个涨到 {now} 个。这就是练习的效果。'],
  'listen.drill': ['Practise this bar', '单练这一小节'],
  'listen.tapBar': ['Tap any bar on the score to hear yourself from there.', '点乐谱上任何一个小节，从那里听自己。'],
  'listen.noticed': ['What I noticed', '我听到的'],
  'listen.accompaniment': ['It sounds like something else was playing along — a piano, an orchestra, a recording. I can only follow the violin clearly on its own, so the notes and tuning below may be off. Next time, try the accompaniment in headphones.', '听起来还有别的声音一起在响——钢琴、乐队或录音。只有小提琴单独演奏时我才能听清楚，所以下面的音符和音准可能不准。下次试试把伴奏放进耳机。'],
  'listen.cardNotes': ['Notes', '音符'],
  'listen.notesRight': ['{right} of {of} notes right', '{of} 个音中对了 {right} 个'],
  'listen.notesWrong': ['{n} different', '{n} 个不同'],
  'listen.notesMissed': ['{n} not heard', '{n} 个没听到'],
  'listen.reached': ['The take reached bar {n} of {of} (with the repeats).', '录音拉到了第 {n} 小节（共 {of} 小节，含反复）。'],
  'listen.mark.good': ['right', '对'],
  'listen.mark.tune': ['right, out of tune', '对，但音不准'],
  'listen.mark.wrong': ['different note', '不同的音'],
  'listen.mark.missed': ['not heard', '没听到'],
  'listen.cardTempo': ['Pulse', '速度'],
  'listen.pulse': ['Your pulse: about {bpm} beats a minute.', '你的速度：每分钟大约 {bpm} 拍。'],
  'listen.marked': ['(The music says {bpm}.)', '（谱上标的是 {bpm}。）'],
  'listen.steady': ['The pulse held steady.', '速度很稳。'],
  'listen.fairlySteady': ['The pulse was fairly steady, with a few wobbles.', '速度比较稳，有几处晃动。'],
  'listen.unsteady': ['The pulse moved around quite a bit — try it with a metronome.', '速度变化挺大——试试跟节拍器。'],
  'listen.rushing': ['Faster in bar {bars}.', '第 {bars} 小节变快了。'],
  'listen.dragging': ['Slower in bar {bars}.', '第 {bars} 小节变慢了。'],
  'listen.cardBars': ['Bars to look at', '值得再看的小节'],
  'listen.weakBar': ['Bar {n}: {right} of {of} notes right', '第 {n} 小节：{of} 个音对了 {right} 个'],
  'listen.cardTuning': ['Tuning', '音准'],
  'listen.inTune': ['{p}% of the held notes sat close to an in-tune pitch.', '{p}% 的长音接近准确音高。'],
  'listen.inTuneScore': ['{p}% of the right notes were in tune.', '拉对的音里 {p}% 音准是准的。'],
  'listen.leanSharp': ['Overall the notes leaned sharp (high).', '总体来说音偏高。'],
  'listen.leanFlat': ['Overall the notes leaned flat (low).', '总体来说音偏低。'],
  'listen.noteSharp': ['{note} tends to sit high — about {c} cents ({n} times).', '{note} 往往偏高——大约 {c} 音分（{n} 次）。'],
  'listen.noteFlat': ['{note} tends to sit low — about {c} cents ({n} times).', '{note} 往往偏低——大约 {c} 音分（{n} 次）。'],
  'listen.stringSharp': ['On the {s} string, notes ran about {c} cents high.', '{s} 弦上的音大约偏高 {c} 音分。'],
  'listen.stringFlat': ['On the {s} string, notes ran about {c} cents low.', '{s} 弦上的音大约偏低 {c} 音分。'],
  'listen.driftUp': ['Over the take the pitch crept up by about {c} cents.', '整段录音中音高慢慢升高了大约 {c} 音分。'],
  'listen.driftDown': ['Over the take the pitch sank by about {c} cents.', '整段录音中音高慢慢降低了大约 {c} 音分。'],
  'listen.cardVibrato': ['Vibrato', '揉弦'],
  'listen.vibNone': ['Not enough long notes to say anything about vibrato.', '长音不够多，没法判断揉弦。'],
  'listen.vibOff': ['No vibrato heard on the {n} long notes.', '{n} 个长音上没有听到揉弦。'],
  'listen.vibShare': ['Vibrato on {p}% of the {n} long notes.', '{n} 个长音中 {p}% 有揉弦。'],
  'listen.vibHow': ['It was {speed} ({rate} waves a second) and {size} ({width} cents wide).', '速度{speed}（每秒 {rate} 次），幅度{size}（{width} 音分宽）。'],
  'listen.speed.slow': ['slow', '慢'],
  'listen.speed.medium': ['medium speed', '中等'],
  'listen.speed.fast': ['fast', '快'],
  'listen.size.narrow': ['narrow', '窄'],
  'listen.size.medium': ['medium width', '中等'],
  'listen.size.wide': ['wide', '宽'],
  'listen.cardDynamics': ['Loud and soft', '强弱'],
  'listen.dynFlat': ['Your loudest and softest were only {db} dB apart — mostly one level. Try more contrast.', '最强和最弱只差 {db} 分贝——基本是一个音量。试试拉出更多对比。'],
  'listen.dynSome': ['Your loudest and softest were {db} dB apart — some contrast.', '最强和最弱相差 {db} 分贝——有一些对比。'],
  'listen.dynWide': ['Your loudest and softest were {db} dB apart — a wide range.', '最强和最弱相差 {db} 分贝——对比很大。'],
  'listen.curveStart': ['start', '开始'],
  'listen.curveEnd': ['end', '结束'],
  'listen.cardTake': ['The take', '这次录音'],
  'listen.length': ['{time} long, {n} notes heard.', '时长 {time}，听到 {n} 个音。'],
  'listen.range': ['From {low} up to {high}.', '从 {low} 到 {high}。'],
  'listen.stopAt': ['Stopped at {at} for {secs} s', '在 {at} 停了 {secs} 秒'],
  'listen.noStops': ['No long stops.', '没有长时间停顿。'],
  'listen.limitsFree': ['Beta: this is what a microphone can hear, not a teacher’s judgement. Fast passages, double stops and very soft notes are hard for it.', '测试版：这是麦克风能听到的，不是老师的评价。快速段落、双音和很弱的音对它来说比较难。'],
  'listen.limitsScore': ['Beta: grace notes and the lower notes of chords are not checked, and D.C./D.S. jumps are not followed. A very wrong start can confuse the matching for a few notes.', '测试版：装饰音和和弦的下方音不检查，D.C./D.S. 跳转不跟随。开头错得太多，可能会让后面几个音对不上。'],
  'sprint.back': ['Home', '主页'],
  'trill.back': ['Home', '主页'],
  'trill.title': ['Trill Trainer', '颤音练习'],
  'trill.beta': ['New', '新'],
  'trill.lead': ['Two fingers, one string. Start slow and even against the click, then let it go.', '两根手指，一根弦。先跟着节拍慢而均匀，再放开来拉。'],
  'trill.pick.howto': ['Choose a string and two fingers. The lower one stays down; the upper one taps.', '选一根弦和两根手指。下面的手指按住不动，上面的手指来敲。'],
  'trill.label.string': ['String', '弦'],
  'trill.label.fingers': ['Fingers', '手指'],
  'trill.label.spacing': ['Apart', '间距'],
  'trill.label.step': ['Notes to a beat', '每拍几个音'],
  'trill.string': ['{s} string', '{s} 弦'],
  'trill.pair.01': ['Open – 1', '空弦 – 1'],
  'trill.pair.12': ['1 – 2', '1 – 2'],
  'trill.pair.23': ['2 – 3', '2 – 3'],
  'trill.pair.34': ['3 – 4', '3 – 4'],
  'trill.spacing.whole': ['Whole step', '全音'],
  'trill.spacing.half': ['Half step', '半音'],
  'trill.finger.0': ['open', '空弦'],
  'trill.finger.1': ['1st finger', '1 指'],
  'trill.finger.2': ['2nd finger', '2 指'],
  'trill.finger.3': ['3rd finger', '3 指'],
  'trill.finger.4': ['4th finger', '4 指'],
  'trill.hold': ['{finger}, stays down', '{finger}，按住不动'],
  'trill.hold.open': ['open string', '空弦'],
  'trill.tap': ['{finger}, taps', '{finger}，来敲'],
  'trill.step.two': ['two', '两个'],
  'trill.step.three': ['three', '三个'],
  'trill.step.four': ['four', '四个'],
  'trill.step.six': ['six', '六个'],
  'trill.step.eight': ['eight', '八个'],
  'trill.step.free': ['Free trill', '自由颤音'],
  'trill.ask.measured': ['{n} notes to each click at ♩ = {bpm}, for {beats} beats. Four clicks count you in.', '♩ = {bpm}，每一下节拍拉 {n} 个音，共 {beats} 拍。先数四拍预备。'],
  'trill.ask.free': ['After four clicks, trill for {secs} seconds: as fast as you can keep it clear and even, and no faster. To go faster, make the finger’s movement smaller, not harder.', '四拍预备之后，颤 {secs} 秒：在保持清楚、均匀的前提下尽量快，不要更快。想更快，就把手指的动作做小，而不是更用力。'],
  'trill.tempo': ['Click', '节拍'],
  'trill.tempo.slower': ['Slower', '慢一点'],
  'trill.tempo.faster': ['Faster', '快一点'],
  'trill.opt.click': ['Click while I play', '拉的时候也打节拍'],
  'trill.opt.click.sub': ['The count-in always clicks. Headphones help if the click is loud.', '预备拍总会响。如果节拍声太大，戴耳机会更好。'],
  'trill.start': ['Start', '开始'],
  'trill.stop': ['Stop', '停止'],
  'trill.best': ['Your quickest even trill on these two notes: {n} notes a second.', '这两个音上你最快的均匀颤音：每秒 {n} 个音。'],
  'trill.tips.title': ['How to trill well', '怎样把颤音拉好'],
  'trill.tips.contact': ['<b>All the way down, all the way off.</b> Each time, the trilling finger presses the string fully onto the fingerboard, and each lift lets the string come completely free. That clean contact, both ways, is most of what makes a trill sound good.', '<b>按到底，抬干净。</b>颤的那根手指每次都把弦完全按到指板上，每次抬起都让弦完全离开指板。一按一抬都干净，颤音好听主要就靠这个。'],
  'trill.tips.clear': ['<b>Clear and even beats fast.</b> How good a trill sounds comes far more from every note being clean and the same length than from speed. Keep the click where it is and fit more notes in: two, three, four, six, eight.', '<b>清楚、均匀，比快更重要。</b>颤音好不好听，主要看每个音是不是干净、一样长，而不是看速度。节拍不变，往里放更多的音：两个、三个、四个、六个、八个。'],
  'trill.tips.travel': ['<b>For speed, move less.</b> The biggest thing that slows a trill is a finger that travels a long way. Keep it close above the string and make the movement small: just enough to free the string, no higher.', '<b>想要快，就少动。</b>拖慢颤音的头号原因是手指抬得太高、走得太远。让它贴近弦的上方，动作要小：刚好让弦离开指板就够了，不要更高。'],
  'trill.tips.lift': ['<b>Think “lift”, not “hit”.</b> Lift the finger as if the string were hot and let it fall back by itself. Stay light: if your hand gets tight, stop and shake it out.', '<b>想着“抬”，不是“砸”。</b>像弦很烫一样把手指抬起来，让它自己落回去。保持放松：手一紧就停下来甩一甩。'],
  'trill.tips.down': ['<b>The lower finger stays down.</b> Only the upper one moves.', '<b>下面的手指按住不动。</b>只有上面的手指在动。'],
  'trill.tips.pairs': ['<b>Do every pair.</b> 3 – 4 is the weak one for everybody, so it needs the most turns.', '<b>每一对手指都要练。</b>3 – 4 对谁来说都最弱，所以要练得最多。'],
  'trill.doing': ['{string} string: {low} ⇄ {high}', '{string} 弦：{low} ⇄ {high}'],
  'trill.doing.per': ['{n} to a beat, ♩ = {bpm}', '每拍 {n} 个，♩ = {bpm}'],
  'trill.status.opening': ['Opening the microphone…', '正在打开麦克风…'],
  'trill.status.ready': ['Get ready — lower finger down, bow on the string.', '准备——下面的手指按好，弓放在弦上。'],
  'trill.status.go': ['Trill! {n} s to go', '颤！还有 {n} 秒'],
  'trill.m.pace': ['Pace', '速度'],
  'trill.m.pace.per': ['notes a beat (asked: {n})', '每拍几个音（要求：{n}）'],
  'trill.m.pace.sec': ['notes a second', '每秒几个音'],
  'trill.m.even': ['Evenness', '均匀'],
  'trill.m.even.very': ['very even', '非常均匀'],
  'trill.m.even.ok': ['even enough', '够均匀'],
  'trill.m.even.no': ['uneven', '不均匀'],
  'trill.m.balance': ['Lower : upper', '下音 : 上音'],
  'trill.m.balance.ok': ['time shared evenly', '时间分得均匀'],
  'trill.m.balance.top': ['too long on the upper note', '上音停得太久'],
  'trill.m.balance.bottom': ['too short on the upper note', '上音停得太短'],
  'trill.m.reach': ['Upper note', '上音'],
  'trill.m.reach.cents': ['{n}¢ low', '低 {n} 音分'],
  'trill.m.reach.ok': ['reaches its pitch', '音高到位'],
  'trill.m.reach.near': ['nearly there', '差一点到位'],
  'trill.m.reach.low': ['falls short', '没到位'],
  'trill.v.none.title': ['No trill heard yet', '还没听到颤音'],
  'trill.v.none.text': ['Hold the lower note with a long bow, then tap the {finger} on and off for {high}. Start as slowly as you like.', '用长弓拉住下面的音，然后用{finger}一按一抬拉出 {high}。多慢都可以。'],
  'trill.v.short.title': ['Only a few wiggles', '只听到几下'],
  'trill.v.short.text': ['Keep the trill going for the whole stretch, with one long, steady bow.', '用一弓平稳的长弓，把颤音一直拉到最后。'],
  'trill.v.reach.title': ['The upper note is falling short', '上音没有到位'],
  'trill.v.reach.text': ['{high} is coming out low. Let the {finger} land on its spot each time; go one step slower until it rings true.', '{high} 拉低了。让{finger}每次都落在自己的位置上；先慢一档，等音准了再加快。'],
  'trill.v.stuck.title': ['The finger is staying down too long', '手指按得太久'],
  'trill.v.stuck.text': ['Think “up”. Lift the {finger} the instant it lands, as if the string were hot — just far enough for the string to come completely free.', '想着“抬”。{finger}一落下就马上抬起来，像弦很烫一样——抬到弦刚好完全离开指板就够了。'],
  'trill.v.dab.title': ['The finger is only brushing the string', '手指只是蹭了一下弦'],
  'trill.v.dab.text': ['{high} is too short to hear properly. Let the {finger} press the string all the way onto the fingerboard before it lifts — still light, but fully down.', '{high} 太短，听不清。让{finger}把弦完全按到指板上再抬起——还是要轻，但要按到底。'],
  'trill.v.uneven.title': ['Not even yet', '还不够均匀'],
  'trill.v.uneven.text': ['Some wiggles are longer than others. Even comes before fast: stay on this step, or go back one, until every note is the same length.', '有的音长，有的音短。先均匀，再求快：留在这一档，或者退回一档，直到每个音一样长。'],
  'trill.v.slow.title': ['Even, but behind the click', '很均匀，但比节拍慢'],
  'trill.v.slow.text': ['Nicely even. Now fit all {n} notes into each click, or slow the click down a little first.', '很均匀。现在把 {n} 个音都放进每一拍里，或者先把节拍调慢一点。'],
  'trill.v.fast.title': ['Even, but ahead of the click', '很均匀，但比节拍快'],
  'trill.v.fast.text': ['You are playing more than {n} notes to a beat. Hold back and let the click place them — that control is the skill.', '你每拍拉的音超过了 {n} 个。收一收，让节拍来安排它们——这种控制力就是本事。'],
  'trill.v.good.title': ['That was a good trill', '这个颤音拉得好'],
  'trill.v.good.text': ['Even, balanced, and {high} rang true. Is your hand still loose? Then go on.', '均匀、平衡，{high} 也准。手还是松的吗？那就继续。'],
  'trill.done.step': ['Step done: {n} notes to a beat ✓', '完成一档：每拍 {n} 个音 ✓'],
  'trill.done.best': ['Your quickest even trill yet: {n} notes a second', '到目前为止你最快的均匀颤音：每秒 {n} 个音'],
  'trill.next': ['Next: {n} to a beat', '下一档：每拍 {n} 个'],
  'trill.next.free': ['Next: free trill', '下一档：自由颤音'],
  'trill.again': ['Again', '再来一次'],
  'trill.change': ['Change fingers or string', '换手指或换弦'],
  'pet.toast.newTrill': ['First trills today! +{n} bonus', '今天的第一次颤音练习！额外 +{n}'],
  'pet.mem.trill': ['First trill practice', '第一次颤音练习'],
  'log.tag.trill': ['Trills', '颤音'],
  'sprint.title': ['Note Sprint', '音符冲刺'],
  'sprint.lead': ['Choose the notes you know. Each one appears on the staff — play it, and the next one is there. The clock starts with your first note.', '选出你认识的音。每个音会出现在五线谱上——拉对了，下一个就出来。第一个音响起时开始计时。'],
  'sprint.tab.play': ['Sprint', '冲刺'],
  'sprint.tab.stats': ['My stats', '我的统计'],
  'sprint.col.natural': ['♮', '♮'],
  'sprint.pick.aria': ['Notes to read: tap or drag to choose', '要读的音：点按或拖动来选择'],
  'sprint.pick.howto': ['Tap a note to choose it, or drag up and down to choose several. Start on a chosen note and drag to clear them.', '点一个音来选它，或上下拖动一次选好几个。从已选的音开始拖动，就是取消。'],
  'sprint.preset.open': ['Open strings', '空弦'],
  'sprint.preset.staff': ['On the staff', '五线谱内'],
  'sprint.preset.first': ['First position', '第一把位'],
  'sprint.preset.below': ['Low ledger lines', '下加线'],
  'sprint.preset.above': ['High ledger lines', '上加线'],
  'sprint.clear': ['Clear', '清空'],
  'sprint.count': ['{n} notes chosen', '已选 {n} 个音'],
  'sprint.count.one': ['1 note chosen', '已选 1 个音'],
  'sprint.opt.repeats': ['Repeat notes', '音可以重复'],
  'sprint.opt.repeats.on': ['Notes come up more than once (never twice in a row).', '音会出现不止一次（但不会连续两次）。'],
  'sprint.opt.repeats.off': ['Each note once: {n} notes.', '每个音一次：共 {n} 个。'],
  'sprint.opt.length': ['How many', '数量'],
  'sprint.opt.weak': ['Weaker notes more often', '弱的音多练几次'],
  'sprint.opt.helper': ['Show what I’m playing', '显示我正在拉的音'],
  'sprint.opt.helper.sub': ['A dot beside the note follows your playing, like a tuner — it turns green when you line up. Great for getting started; these sprints keep their own bests.', '音符旁边有一个小圆点跟着你拉的音移动，像调音器一样——对上了就变绿。适合刚开始练；这些冲刺有自己的最佳纪录。'],
  'sprint.done.helper': ['With “Show what I’m playing” on — compared only with your other helper sprints.', '开着“显示我正在拉的音”——只和你其他开着提示的冲刺比较。'],
  'sprint.stats.helper': ['{n} sprints with “Show what I’m playing” on are counted but not timed here.', '有 {n} 次开着“显示我正在拉的音”的冲刺：计入次数，但不计入这里的速度。'],
  'sprint.opt.weak.sub': ['Notes you read slowly or miss come up more.', '读得慢或常出错的音会出现得更多。'],
  'sprint.start': ['Start', '开始'],
  'sprint.need2': ['Choose at least two notes.', '至少选两个音。'],
  'sprint.stop': ['Stop', '停止'],
  'sprint.left': ['{n} to go', '还剩 {n} 个'],
  'sprint.status.opening': ['Opening the microphone…', '正在打开麦克风……'],
  'sprint.status.ready': ['Play this note. The clock starts when you do.', '拉出这个音。你一开始拉，就开始计时。'],
  'sprint.status.higher': ['Not quite — the written note is higher.', '差一点——谱上的音更高。'],
  'sprint.status.lower': ['Not quite — the written note is lower.', '差一点——谱上的音更低。'],
  'sprint.done.first': ['Done! That’s your first time for this set.', '完成！这是你第一次练这组音。'],
  'sprint.done.best': ['New personal best!', '新的个人最佳！'],
  'sprint.done.ok': ['Done!', '完成！'],
  'sprint.done.vsBest': ['Your best for these notes: {best} s a note. This time: {now} s.', '这组音你的最佳：每个音 {best} 秒。这次：{now} 秒。'],
  'sprint.done.beat': ['{now} s a note — faster than your old best of {was} s.', '每个音 {now} 秒——比你以前的最佳 {was} 秒更快。'],
  'sprint.done.streak': ['{n} right in a row — your longest yet!', '连续对了 {n} 个——你的新纪录！'],
  'sprint.stars': ['{n} of 3 stars', '3 颗星中的 {n} 颗'],
  'sprint.tile.time': ['Total time', '总时间'],
  'sprint.tile.avg': ['A note', '每个音'],
  'sprint.tile.perMin': ['Notes a minute', '每分钟音数'],
  'sprint.tile.firstTry': ['Right first time', '一次就对'],
  'sprint.starkey': ['★★ under {two} s a note and {p2}% right first time · ★★★ under {three} s and {p3}%', '★★ 每个音少于 {two} 秒，且 {p2}% 一次就对 · ★★★ 少于 {three} 秒，且 {p3}%'],
  'sprint.why.firstTry': ['Your speed earned {speed} — but {pct}% right first time keeps it at {stars}. Get {need}% right first time for {next}.', '你的速度够 {speed}——但一次就对只有 {pct}%，所以是 {stars}。一次就对达到 {need}%，就能得 {next}。'],
  'sprint.why.speed': ['Right first time earned {acc} — {avg} s a note keeps it at {stars}. Under {need} s a note gets {next}.', '一次就对够 {acc}——每个音 {avg} 秒，所以是 {stars}。每个音少于 {need} 秒，就能得 {next}。'],
  'sprint.again': ['Again', '再来一次'],
  'sprint.change': ['Change notes', '换音'],
  'sprint.seeStats': ['My stats', '我的统计'],
  'sprint.stats.empty': ['Finish a sprint and your numbers will appear here.', '完成一次冲刺，你的数据就会出现在这里。'],
  'sprint.stats.runs': ['Sprints', '冲刺次数'],
  'sprint.stats.notes': ['Notes read', '读过的音'],
  'sprint.stats.avg': ['Average a note', '平均每个音'],
  'sprint.stats.streak': ['Longest run right', '最长连对'],
  'sprint.stats.weekFaster': ['This week: {now} s a note, faster than before ({was} s).', '这周：每个音 {now} 秒，比以前（{was} 秒）快。'],
  'sprint.stats.weekSlower': ['This week: {now} s a note (before: {was} s). New notes take time.', '这周：每个音 {now} 秒（以前：{was} 秒）。新的音需要时间。'],
  'sprint.stats.trend': ['Time a note, sprint by sprint', '每次冲刺的平均用时'],
  'sprint.stats.slower': ['{s} s', '{s} 秒'],
  'sprint.stats.faster': ['{s} s · faster ↑', '{s} 秒 · 更快 ↑'],
  'sprint.stats.strong': ['Quickest notes', '最快的音'],
  'sprint.stats.weak': ['Notes to work on', '要多练的音'],
  'sprint.stats.drill': ['Sprint these', '练这些音'],
  'sprint.stats.strings': ['By string', '按琴弦'],
  'sprint.string': ['{s} string', '{s} 弦'],
  'sprint.stats.mixups': ['Mix-ups', '常混淆'],
  'sprint.stats.mixup': ['Wanted {want}, played {played}', '应该是 {want}，拉成了 {played}'],
  'sprint.stats.noMixups': ['No mix-ups yet.', '还没有混淆。'],
  'sprint.stats.more': ['A few more sprints and this fills in.', '再多练几次，这里就会有数据。'],
  'sprint.clear.btn': ['Clear my sprint history', '清空我的冲刺记录'],
  'sprint.clear.confirm': ['Tap again to erase it', '再点一次，全部清除'],
  'sprint.clear.warn': ['Every sprint, best time and note speed under this name on this device goes. Your chosen notes stay. It cannot be undone.', '这个名字在这台设备上的每次冲刺、最佳时间和每个音的速度都会被删掉。选好的音会保留。无法恢复。'],
  'sprint.clear.keep': ['Keep it', '保留'],
  'sprint.stats.note': ['Only your own numbers, kept on this device. Strings are counted as first position; notes above B5 count as the E string.', '只有你自己的数据，保存在这台设备上。琴弦按第一把位计算；B5 以上的音算作 E 弦。'],
  'pet.toast.newSprint': ['First sprint today! +{n} bonus', '今天的第一次冲刺！额外 +{n}'],
  'pet.tab.pets': ['Pets', '宠物'],
  'pet.tab.book': ['Memories', '回忆'],
  'pet.plan.ask': ['When will {name} hear you next?', '{name} 下次什么时候能听你练琴？'],
  'pet.plan.cue.morning': ['Before school', '上学前'],
  'pet.plan.cue.afterSchool': ['After school', '放学后'],
  'pet.plan.cue.afterDinner': ['After dinner', '晚饭后'],
  'pet.plan.cue.beforeBed': ['Before bed', '睡觉前'],
  'pet.plan.when.morning': ['before school', '上学前'],
  'pet.plan.when.afterSchool': ['after school', '放学后'],
  'pet.plan.when.afterDinner': ['after dinner', '晚饭后'],
  'pet.plan.when.beforeBed': ['before bed', '睡觉前'],
  'pet.plan.set': ['Next time: {when}. {name} will be listening.', '下次：{when}。{name} 会等着听。'],
  'pet.plan.change': ['Change', '改一下'],
  'pet.plan.thanks': ['It’s a plan!', '说好啦！'],
  'pet.plan.kept': ['You came back, just like we planned!', '你回来了，跟我们说好的一样！'],
  'pet.book.day1': ['Practised on 1 day', '练了 1 天'],
  'pet.book.days': ['Practised on {n} days', '练了 {n} 天'],
  'pet.book.take1': ['1 take', '1 次'],
  'pet.book.takes': ['{n} takes', '{n} 次'],
  'pet.book.keys': ['Keys {name} has heard: {n} of 12 majors', '{name} 听过的调：12 个大调里的 {n} 个'],
  'pet.book.minor1': ['and 1 minor', '还有 1 个小调'],
  'pet.book.minors': ['and {n} minors', '还有 {n} 个小调'],
  'pet.book.empty': ['Memories will collect here as you practise.', '练琴的回忆会收在这里。'],
  'pet.book.new': ['New', '新'],
  'pet.mem.major': ['{key} major', '{key} 大调'],
  'pet.mem.minor': ['{key} minor', '{key} 小调'],
  'pet.mem.take': ['Your first take together', '第一次一起练琴'],
  'pet.mem.hatched': ['A {kind} hatched', '一只{kind}孵出来了'],
  'pet.mem.key': ['First time playing {key}', '第一次拉 {key}'],
  'pet.mem.allMajors': ['All twelve major keys played!', '十二个大调都拉过了！'],
  'pet.mem.twoOctaves': ['First two-octave scale', '第一条两个八度的音阶'],
  'pet.mem.sight': ['First sight-reading take', '第一次视奏'],
  'pet.mem.sprint': ['First Note Sprint', '第一次音符冲刺'],
  'pet.mem.takes': ['{n} takes played', '一共练了 {n} 次'],
  'pet.mem.days': ['{n} days of practice', '练琴满 {n} 天'],
  'pet.mem.grew.kid': ['{name} grew into a kid', '{name} 长成小朋友了'],
  'pet.mem.grew.grown': ['{name} is all grown up', '{name} 长大了'],
  'pet.confirm.item': ['{name} for ♪ {cost}? You’ll have ♪ {left} left.', '{name}要 ♪ {cost}，买吗？之后还剩 ♪ {left}。'],
  'pet.confirm.snack': ['{name} for ♪ {cost}? You’ll have ♪ {left} left.', '{name}要 ♪ {cost}，喂吗？之后还剩 ♪ {left}。'],
  'pet.confirm.buy': ['Buy', '买'],
  'pet.confirm.feed': ['Feed', '喂'],
  'pet.confirm.cancel': ['Not now', '先不要'],
  'pet.stage.baby': ['Baby', '宝宝'],
  'pet.stage.kid': ['Kid', '小朋友'],
  'pet.stage.grown': ['Grown up', '长大啦'],
  'pet.grow.toKid': ['{done} of {need} practice takes until {name} grows a little bigger', '再练 {done}/{need} 次，{name} 就会长大一点'],
  'pet.grow.toGrown': ['{done} of {need} practice takes until {name} is all grown up', '再练 {done}/{need} 次，{name} 就完全长大了'],
  'pet.grown': ['{name} is all grown up ★', '{name} 已经长大啦 ★'],
  'pet.next.btn': ['Choose a new egg', '选一颗新蛋'],
  'pet.next.ask': ['Pick your next egg. {name} will wait in the pet book and can come back any time.', '选下一颗蛋吧。{name} 会在宠物图鉴里等你，随时可以回来。'],
  'pet.next.cancel': ['Not yet', '先不要'],
  'pet.next.wait': ['A new egg comes once every pet has grown up.', '等所有宠物都长大了，就会有新蛋。'],
  'pet.rename': ['Rename', '改名'],
  'pet.rename.ask': ['A new name? Type it in.', '想换个名字吗？在这里输入。'],
  'pet.rename.cancel': ['Keep the old name', '还是用原来的名字'],
  'pet.yours': ['Your pets', '你的宠物'],
  'pet.here': ['In the room', '在屋里'],
  'pet.bring': ['Bring in', '请进来'],
  'pet.bring.egg': ['After the egg hatches', '等蛋孵出来以后'],
  'pet.book': ['Pet book · {found} of {total} found', '宠物图鉴 · 已发现 {found}/{total}'],
  'pet.unknown': ['Not found yet', '还没发现'],
  'pet.rare.label': ['Rare colour', '稀有颜色'],
  'pet.rare.say': ['Ooh — a rare colour!', '哇——稀有的颜色！'],
  'pet.grew.kid': ['I grew!', '我长大了一点！'],
  'pet.grew.grown': ['I’m all grown up!', '我完全长大啦！'],
  'pet.toast.grew': ['{name} grew a little!', '{name} 长大了一点！'],
  'pet.toast.grewUp': ['{name} is all grown up!', '{name} 完全长大啦！'],
  'pet.feed': ['Snacks', '点心'],
  'pet.decorate': ['Decorate', '装饰'],
  'pet.fav': ['favourite', '最爱'],
  'pet.feed.note': ['Snacks are treats — {name} never goes hungry, and nothing bad happens if you skip a day.', '点心只是奖励——{name}不会饿着，哪天没喂也不会有坏事。'],
  'pet.boost.offer': ['A snack today and {name}’s next {n} practice takes count double for growing.', '今天喂一次点心，{name}接下来的 {n} 次练习都会算双倍成长。'],
  'pet.boost.left': ['Fed today: {n} more takes count double for {name}', '今天吃饱了：还有 {n} 次练习算双倍成长'],
  'pet.boost.used': ['Fed today — {name} used all of today’s double growth. More tomorrow!', '今天吃饱了——{name}今天的双倍成长用完了，明天还有！'],
  'pet.boost.say': ['I feel big and strong!', '我觉得自己又大又壮！'],
  'pet.trick.progress': ['Favourite snack ({fav}): {done}/{need} until {name} learns a new trick', '最爱的点心（{fav}）：{done}/{need}，{name}就会学会新把戏'],
  'pet.trick.tada': ['Ta-da!', '当当！'],
  'pet.trick.all': ['{name} knows every trick!', '{name}已经学会所有把戏啦！'],
  'pet.trick.learned': ['I learned a trick: {trick}!', '我学会新把戏了：{trick}！'],
  'pet.trick.watch': ['Watch this!', '看我的！'],
  'pet.trick.spin': ['a spin', '转圈'],
  'pet.trick.jump': ['a big jump', '大跳'],
  'pet.trick.dance': ['a dance', '跳舞'],
  'pet.trick.roll': ['a roll', '打滚'],
  'pet.food.berry': ['Strawberry', '草莓'],
  'pet.food.cookie': ['Cookie', '饼干'],
  'pet.food.cake': ['Cake', '蛋糕'],
  'pet.food.fishtreat': ['Fish treat', '小鱼干'],
  'pet.food.bone': ['Bone', '骨头'],
  'pet.food.seeds': ['Sunflower seeds', '葵花籽'],
  'pet.food.corn': ['Corn', '玉米'],
  'pet.food.flakes': ['Fish flakes', '鱼食'],
  'pet.item.rug': ['Rug', '地毯'],
  'pet.item.window': ['Window', '窗户'],
  'pet.item.plant': ['Plant', '盆栽'],
  'pet.item.ball': ['Ball', '小球'],
  'pet.item.bed': ['Bed', '小床'],
  'pet.item.picture': ['Violin picture', '小提琴画'],
  'pet.item.lamp': ['Lamp', '落地灯'],
  'pet.item.bunting': ['Bunting', '彩旗'],
  'pet.item.stand': ['Music stand', '谱架'],
  'pet.item.wall-mint': ['Mint stripes', '薄荷条纹'],
  'pet.item.wall-dots': ['Pink dots', '粉色圆点'],
  'pet.item.wall-stars': ['Starry blue', '蓝色星星'],
  'pet.item.out': ['Out ✓', '已摆出 ✓'],
  'pet.item.away': ['Put away', '已收起'],
  'pet.notes.aria': ['{n} notes to spend', '可用音符 {n} 个'],
  'pet.aria.pat': ['Pat {name}', '摸摸{name}'],
  'pet.aria.egg': ['Your egg', '你的蛋'],
  'pet.foot': ['Notes ♪ come from real practice: every scale or sight-reading take earns some, a two-octave scale earns more than a one-octave one, a scale you haven’t played yet today earns a bonus, and so does the first take of the day. Every take also helps your pet grow up.', '音符 ♪ 来自真正的练习：每拉完一条音阶或一段视奏都能得到一些，两个八度的音阶比一个八度的多，今天还没拉过的音阶有额外奖励，每天第一次练习也有奖励。每次练习也会让你的宠物长大一点。'],
  'pet.demo': ['Pretend I practised', '假装我练过了'],
  'pet.toast.for': ['for {name}', '送给{name}'],
  'pet.toast.warm': ['The egg got warmer', '蛋更暖和了'],
  'pet.toast.room': ['for the pet room', '存进宠物小屋'],
  'pet.toast.newScale': ['New scale today! +{n} bonus', '今天的新音阶！额外 +{n}'],
  'pet.toast.newSight': ['First sight reading today! +{n} bonus', '今天第一次视奏！额外 +{n}'],
  'pet.toast.keywish': ['{key} major — how did you know?', '{key} 大调——你怎么知道的？'],
  // The wish is an invitation: the pet names one key a day and says nothing
  // reproachful if the day goes another way.
  // No indefinite article: "a A major scale" and "a E major scale" are both wrong.
  'pet.keywish.ask': ['{name} would love to hear {key} major today.', '{name} 今天很想听 {key} 大调。'],
  'pet.keywish.done': ['{name} loved that {key} major scale!', '{name} 好喜欢那条 {key} 大调音阶！'],
  'pet.need': ['{n} more ♪ to go', '还差 {n} 个 ♪'],
  'pet.menu.egg': ['{n} more ♪ to hatch', '再 {n} 个 ♪ 就孵出来了'],
  'pet.menu.hatch': ['Say hello to it!', '给它起个名字吧！'],
  'pet.menu.grow': ['{done} of {need} to growing up', '再 {done}/{need} 就长大一点'],
  'pet.menu.grown': ['All grown up ★', '已经长大啦 ★'],
  'who.title': ['Who’s practicing?', '谁在练习？'],
  'who.all': ['Everyone ({n})', '全部（{n}）'],
  'who.search': ['Find a name', '找名字'],
  'who.newName': ['A new name', '新名字'],
  'who.done': ['Done', '完成'],
  'who.never': ['Not yet practised', '还没练过'],
  'who.today': ['Practised today', '今天练过'],
  'who.last': ['Last practised {date}', '上次练习 {date}'],
  'who.none': ['No name matches.', '没有匹配的名字。'],
  'who.count': ['{n} of {max} names on this device.', '这台设备上有 {n}/{max} 个名字。'],
  'who.full': ['This device holds {max} names — remove one in the practice log to add another.', '这台设备最多 {max} 个名字——请在练习记录里删掉一个再添加。'],
  'who.room': ['Storage was getting full, so the oldest take records were trimmed. Days practised and best scores are all kept.', '存储空间快满了，所以删去了最早的练习记录。练习天数和最好成绩都保留着。'],
  'theme.toDark': ['Dark', '深色'],
  'theme.toLight': ['Light', '浅色'],
  'theme.aria': ['Night mode', '夜间模式'],
  'card.today': ['Played {n} times today', '今天练了 {n} 次'],
  'card.today.one': ['Played once today', '今天练了 1 次'],

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
    '{exact} of {expected} notes matched · {heard} notes heard · ♩ ≈ {bpm} · {dur}s',
    '{expected} 个音里 {exact} 个对上 · 听到 {heard} 个音 · ♩ ≈ {bpm} · {dur} 秒',
  ],
  'result.subSimple': ['{exact} of {expected} notes matched · {heard} notes heard', '{expected} 个音里 {exact} 个对上 · 听到 {heard} 个音'],

  'component.notes': ['Notes', '音符'],
  'component.intonation': ['Intonation', '音准'],
  'component.steadiness': ['Steadiness', '节奏'],
  'component.flow': ['Flow', '连贯'],
  'explain.notes': ['How many of the scale’s notes came out as the right note. A missed note earns nothing, a wrong one almost nothing, the right note in the wrong octave a little; extra notes take a bit off. The biggest part of the score — about half.', '音阶里有多少个音拉对了。漏掉的音不得分，拉错的几乎不得分，对的音但八度错了得一点；多拉的音会扣一点。这是分数里最大的一部分——大约一半。'],
  'explain.intonation': ['How in tune the right notes were. Within 15 cents of the centre counts as perfectly in tune; the credit fades to nothing by 55 cents (about half a semitone). One fifth of the score.', '拉对的音有多准。离正中 15 音分以内算完全准；到 55 音分（大约半个半音）就不得分了。占分数的五分之一。'],
  'explain.steadiness': ['How even the notes were: the same time for each note. Any speed is fine — it measures evenness, not tempo. The held top note doesn’t count, and pauses are scored under Flow instead.', '每个音的时长是否一样平均。快慢都可以——量的是均匀，不是速度。最高音停留多久不算在内，停顿算在“连贯”里。'],
  'explain.flow': ['Whether the scale kept going. Each stop — a gap longer than about a note — takes some off, and stops over a second take more.', '音阶是否一直往下走。每一次停顿（比一个音还长的空隙）都会扣分，超过一秒的停顿扣得更多。'],
  'explain.sightNotes': ['How many of the written notes were played exactly — right letter, right sharp or flat, right octave.', '谱上的音有多少拉得完全对——音名、升降号和八度都对。'],
  'explain.sightTuned': ['How in tune the right notes were. Within 15 cents of the centre is perfectly in tune; nothing by 55 cents.', '拉对的音有多准。离正中 15 音分以内算完全准；到 55 音分就不得分。'],
  'explain.sightPulse': ['Whether the note lengths kept to the written rhythm against your own beat. Any tempo is fine; a note within a quarter of a beat of where it belongs gets full credit.', '音的长短是否按照谱上的节奏，以你自己的拍子为准。快慢都可以；离该在的位置不到四分之一拍就算满分。'],
  'explain.sightStops': ['Places where the playing stopped — a gap of nearly three beats where the music kept going. Each one takes some off.', '演奏停下来的地方——谱上还在继续，却空了将近三拍。每一次都会扣一点分。'],

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
    '{n} scales · {centred} of {total} notes matched · {stops}',
    '{n} 条音阶 · {total} 个音里 {centred} 个对上 · {stops}',
  ],
  'test.noStops': ['no stops', '没有停顿'],

  // ── Sight reading: hearing it first ──
  'sight.hear': ['Hear the passage', '听一遍谱子'],
  'sight.stopHearing': ['Stop the example', '停止试听'],
  'sight.hearFrom': ['Start at bar {bar}', '从第 {bar} 小节开始'],
  'sight.replay': ['▶ Hear yourself', '▶ 听听自己'],
  'sight.replayFrom': ['▶ Hear yourself from bar {bar}', '▶ 从第 {bar} 小节听自己'],
  'sight.replayStop': ['■ Stop', '■ 停止'],
  'sight.replayNoBar': ['That bar wasn’t heard in the take, so there’s nowhere to start it from.', '这次录音里没听到那一小节，所以没法从那里开始。'],
  'sight.replayFail': ['This browser couldn’t play the recording back.', '这个浏览器无法播放这段录音。'],

  // ── Offline ──
  'offline.status': [
    'This copy of the app is stored on this device, so it opens without a connection once it has been used here once.',
    '这个应用已经存在这台设备上，用过一次之后没有网络也能打开。',
  ],
  'offline.ready': [
    'This copy of the app and the recorded violin are both stored on this device — everything works without a connection.',
    '应用和录音小提琴都已存在这台设备上——没有网络也能完整使用。',
  ],
  'offline.download': ['Store the violin on this device', '把小提琴录音存到本机'],
  'offline.refresh': ['Check the violin again', '重新检查小提琴录音'],
  'offline.progress': ['Storing the violin… {done}/{total}', '正在存小提琴录音… {done}/{total}'],
  'offline.done': [
    'The violin is on this device now. Nothing else needs a connection.',
    '小提琴录音已存到本机，其他功能都不需要网络。',
  ],
  'offline.partial': [
    '{n} of {total} files could not be downloaded — try again on a better connection.',
    '有 {n} / {total} 个文件没下载成功，网络好一点时再试一次。',
  ],
  'offline.failed': [
    'The download could not start. Check the connection and try again.',
    '下载没能开始，检查一下网络再试。',
  ],
  'update.ready': ['A newer version is ready.', '有新版本了。'],
  'update.reload': ['Reload', '刷新'],
  'update.later': ['Later', '稍后'],
  'intonation.sum.clean': [
    'All {n} notes sat within 15 cents of centre — in tune by any ear.',
    '{n} 个音全部落在正中 15 音分以内——怎么听都是准的。',
  ],
  'intonation.sum.sharp': [
    '{n} sat high; the rest are within 15 cents.',
    '有 {n} 个偏高，其余都在 15 音分以内。',
  ],
  'intonation.sum.flat': [
    '{n} sat low; the rest are within 15 cents.',
    '有 {n} 个偏低，其余都在 15 音分以内。',
  ],
  'intonation.sum.both': [
    '{sharp} sat high and {flat} sat low; the rest are centred.',
    '{sharp} 个偏高、{flat} 个偏低，其余基本准。',
  ],
  'aria.intonation': [
    'How far above or below centre each note sat, in cents',
    '每个音偏高或偏低的音分数',
  ],
  'sight.speedAria': ['Playback speed', '回放速度'],

  // ── Sight reading: listening ──
  'sight.waitingMic': ['Asking for the microphone…', '正在请求麦克风…'],
  'sight.warmingMic': [
    'Waking the microphone up — the count-in starts the moment it can hear you.',
    '正在唤醒麦克风——等它能听见你，预备拍才开始。',
  ],
  'sight.noMicFrames': [
    'The microphone did not send anything through. Check the microphone permission for this page in the browser, then press start again.',
    '麦克风什么也没送过来。检查一下浏览器里这个页面的麦克风权限，再点一次开始。',
  ],
  'sight.armed': [
    'Ready when you are — the app starts on your first note.',
    '准备好了就开始，应用会在你第一个音时开始。',
  ],
  'sight.playing': ['Listening…', '正在聆听…'],
  'sight.partNotes': ['Notes right', '音对了'],
  'sight.partTuned': ['In tune', '音准'],
  'sight.partPulse': ['Steady pulse', '节拍稳定'],
  'sight.partStops': ['Stops', '停顿'],
  'sight.tipMissed': [
    '{n} of {total} notes did not come out — mark them and try that bar alone.',
    '{total} 个音里有 {n} 个没拉出来，把那几处标出来，单独练一下那一小节。',
  ],
  'sight.tipAllNotes': ['Every note was there.', '每个音都拉出来了。'],
  'sight.tipRepeat': [
    '{n} notes came out that the page does not ask for — a bar played again, or a slip. Fine while you practice; in an audition, carry on from where you stopped.',
    '有 {n} 个多出来的音，谱子上没有——可能是重来了一小节，也可能多拉了音。练习时没关系，考试时从停下的地方接着往下拉就好。',
  ],
  'sight.tipWrong': [
    '{n} of {total} notes came out as a different pitch — slowly, bar by bar.',
    '{total} 个音里有 {n} 个拉成了别的音，慢一点，一小节一小节来。',
  ],
  'sight.tipIntonation': ['{n} note(s) sat a little {dir}.', '有 {n} 个音稍微偏{dir}。'],
  'sight.sharp': ['high', '高'],
  'sight.flat': ['low', '低'],
  'sight.tipPulse': [
    'The pulse wandered in places — count eighths out loud and it settles.',
    '节拍有些地方跑了，用八分音符数出声就会稳。',
  ],
  'sight.tipStops': [
    '{n} stop(s). Read it a bar at a time, slowly, until it flows.',
    '停顿了 {n} 次。一小节一小节慢慢读，直到顺下来。',
  ],
  // Where it broke, how fast it went, and which kind of note drifted off the beat.
  'sight.tipBar.one': [
    'Bar {bars} is where it came apart — take that one on its own, twice slowly, then put it back.',
    '第 {bars} 小节散了——单独把那一小节慢慢来两遍，再放回整首里。',
  ],
  'sight.tipBar.many': [
    'Bars {bars} are where it came apart — those two are worth a slow pass on their own.',
    '第 {bars} 小节散了——这两小节值得单独慢练一遍。',
  ],
  // The tempo is reported, not prescribed: a first read at half the printed speed
  // is the normal way to learn a page, and the app has no business hurrying it.
  'sight.tipTempo.faster': [
    'You took it at about {played}; the page asks for {printed} — a touch quicker than the marking.',
    '你大约用 {played} 的速度拉的，谱子上写的是 {printed}——比谱面稍微快了一点。',
  ],
  'sight.tipTempo.slower': [
    'You took it at about {played}; the page asks for {printed} — slower than the marking, which is exactly right for a first read.',
    '你大约用 {played} 的速度拉的，谱子上写的是 {printed}——比谱面慢一些，第一次读这样刚刚好。',
  ],
  'sight.tipShortHeld': [
    'I might have heard your {value} notes coming out a little short — check whether you are holding them for their full value. If you are, ignore me: a room with any ring in it can make a held note look shorter than it was.',
    '我可能听到你的{value}稍微短了一点——看看是不是没把时值拉满。如果本来就是拉满的，就不用管我：房间里有点回声时，长音在测量里会显得短一些。',
  ],
  'sight.tipEarly': [
    'The {value} notes kept arriving early. Count them out loud once and they will sit on the beat.',
    '{value}总是来得偏早。出声数一遍，它们就会落在拍子上。',
  ],
  'sight.tipLate': [
    'The {value} notes kept arriving late. They are usually the ones your bow is not quite ready for — prepare the stroke sooner.',
    '{value}总是来得偏晚。通常是弓还没准备好——把运弓提前一点。',
  ],
  // ── The note at the foot of the week sheet ──
  //
  // Written to sound like a teacher who was listening rather than a dashboard:
  // short sentences, second person, one thing noticed and one thing to do. It
  // never congratulates a week that did not happen, and it never scolds.
  'note.start': [
    'Nothing logged yet, and that is allowed. Pick a small goal below — three days of ten minutes is a real week — and this page will start to keep count for you.',
    '还没有记录，这没关系。在下面挑一个小目标——比如三天、每天十分钟，也是一周——这一页就会替你记着。',
  ],
  'note.goalMet': [
    'You said {target} days this week, and you practiced {days}. That is the promise kept, and it is the hard part — the next week is easier because of it.',
    '你说这周练 {target} 天，结果练了 {days} 天。说到的做到了，这才是最难的部分——正因为这样，下一周会容易些。',
  ],
  'note.goalNear': [
    'One more day and the goal you set is met — {done} of {target} so far. If today is still free, ten minutes is enough to finish it.',
    '再练一天，你自己定的目标就完成了——现在是 {done} / {target}。如果今天还有空，十分钟就够了。',
  ],
  'note.goalShort': [
    'You have practiced {days} of the {target} days you picked. Not every week lands the way we plan it — the days you did were still real practice, and this one starts again on Monday.',
    '你定了 {target} 天，练了 {days} 天。不是每一周都能按计划走——练过的那些天都是真的进步，下周一开始重新算。',
  ],
  'note.plenty': [
    '{days} days this week. That is a lot of playing, and it shows in the numbers below — take a rest day on purpose, so the week does not turn into a grind.',
    '这周练了 {days} 天，相当多了，下面的数字看得出来——记得主动休息一天，别让练习变成负担。',
  ],
  'note.some': [
    '{days} days this week. Steady is worth more than big — if you want, set a small goal below and let it do the remembering.',
    '这周练了 {days} 天。稳稳地练比一次练很多更有用——如果愿意，在下面定个小目标，让它帮你记着。',
  ],
  'note.quiet': [
    'A quiet week so far. It happens to everyone, and it says nothing about you — the easiest way back is ten minutes on the thing you already like playing.',
    '这周到目前为止比较安静。谁都会有这样的时候，这并不能说明什么——最容易回来的办法，是拿那个你已经喜欢的曲子练十分钟。',
  ],
  'note.extra.ready': [
    '{names} came good this week — two clean days is what it takes, so that one is ready for the audition.',
    '这周 {names} 拉好了——两个干净的日子就算过，这条可以去考试了。',
  ],
  'note.extra.hard': [
    'You said {thing} was the hard one. Bring it to your lesson first, before the pieces — that is what the note is for.',
    '你说难的是{thing}。上课时先拿这个出来，再练曲子——记下来就是为了这个。',
  ],
  'note.extra.streak': [
    '{n} days in a row now. The days are doing the work even when a session feels small.',
    '已经连续 {n} 天了。就算某天只练了一点点，这些天也在起作用。',
  ],
  'note.extra.go': [
    'Play one bar you already know well, slowly, and stop while it still feels good — that is how the next day gets easier.',
    '挑一小节你已经很熟的地方，慢慢拉，感觉还好的时候就停——这样第二天才更容易开始。',
  ],
  'noteValue.sixteenth': ['sixteenth-note', '十六分音符'],
  'noteValue.dottedSixteenth': ['dotted-sixteenth', '附点十六分音符'],
  'noteValue.eighth': ['eighth-note', '八分音符'],
  'noteValue.dottedEighth': ['dotted-eighth', '附点八分音符'],
  'noteValue.quarter': ['quarter-note', '四分音符'],
  'noteValue.dottedQuarter': ['dotted-quarter', '附点四分音符'],
  'noteValue.half': ['half-note', '二分音符'],
  'noteValue.dottedHalf': ['dotted-half', '附点二分音符'],
  'noteValue.whole': ['whole-note', '全音符'],
  'noteValue.some': ['some', '有些'],

  // What the listening noticed, as opposed to what it scored.
  'tip.bias.title': ['The {note} kept sitting off', '{note} 总是偏一点'],
  'tip.bias.high': [
    '{n} of them sat {cents} cents high — the same finger, or the same string.',
    '这些音里有 {n} 个偏高了 {cents} 音分——可能是同一个手指，或者同一根弦。',
  ],
  'tip.bias.low': [
    '{n} of them sat {cents} cents low — the same finger, or the same string.',
    '这些音里有 {n} 个偏低了 {cents} 音分——可能是同一个手指，或者同一根弦。',
  ],
  'tip.drift.faster.title': ['It sped up towards the end', '后半段越拉越快'],
  'tip.drift.faster.text': [
    'About {pct}% quicker by the end. Set the metronome a notch slower and keep the last four notes at the speed you started.',
    '到后面快了大约 {pct}%。把节拍器降一格，最后四个音保持开头那个速度。',
  ],
  'tip.drift.slower.title': ['It settled slower', '后半段慢下来了'],
  'tip.drift.slower.text': [
    'About {pct}% slower by the end. Start at the speed you finished — the music is not asking for a ritardando.',
    '到后面慢了大约 {pct}%。用结尾那个速度起头——谱子上并没有渐慢。',
  ],
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
  'mic.paused': [
    'The phone paused the microphone — nothing was scored.',
    '手机把麦克风暂停了——这一次没有计分。',
  ],
  'mic.pausedHint': [
    'A locked screen, a call or another app will do that. Bring this page back to the front and press start again.',
    '锁屏、来电或切到别的应用都会这样。回到这一页，再点一次开始就好。',
  ],
  'mic.on': ['on', '开'],
  'mic.off': ['off', '关'],
  'mic.unknown': ['not reported', '未知'],
  'mic.diag': [
    'This device is capturing at {rate} Hz — echo cancellation: {ec}; noise suppression: {ns}; gain control: {agc}.',
    '这台设备以 {rate} Hz 采集——回声消除：{ec}；降噪：{ns}；自动增益：{agc}。',
  ],
  'boot.title': ['This page needs its little server', '这个页面需要本地小服务'],
  'boot.body': [
    'Double-click <strong>Start Scale Studio.cmd</strong> in the app folder and use the page it opens (<code>http://localhost:8777/</code>). Leave the black window open while you practice — closing it stops the app.',
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
  'tip.wrong.titleOne': ['1 note was a different note', '有 1 个音拉成了别的音'],
  'tip.wrong.title': ['{n} notes were different notes', '有 {n} 个音拉成了别的音'],
  'tip.wrong.text': [
    'Look at {list}{more} — a different pitch came out there. Check the key signature first: a sharp or flat left out is the usual reason. Then play just those notes slowly, with the note before each one.',
    '看看 {list}{more}——这里拉出来的是另一个音高。先对一下调号：最常见的原因是漏了升号或降号。然后把这几个音连同它前面的一个音，慢慢单独练。',
  ],
  'tip.wrong.more': [' and others', ' 等'],
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
  'aria.inkTools': ['Marking tools', '标记工具'],
  'ink.hint.swipe': ['Swipe the staff to see every note →', '左右滑动五线谱，查看所有音 →'],
  'ink.hint.pen': ['Pen is on — tap Pen again to swipe the staff.', '笔已打开——再点一次“笔”即可滑动五线谱。'],
  'ink.hint.erase': ['Drag a box over marks to erase them. Tap Erase again to swipe.', '拖一个框盖住标记即可擦除。再点一次“擦除”即可滑动。'],
  'tuner.idle': ['Bow a string — the dial follows it.', '拉一根空弦，指针会跟着走。'],
  'tuner.noMic': ['Press “Start listening” to use the microphone.', '按“开始聆听”来使用麦克风。'],
  'tuner.pairHint': ['tune {tune} to {base}', '{tune} 对 {base}'],

  'oct.short': ['{n} oct', '{n} 个八度'],
  'reg.low': ['Low {name}', '低音 {name}'],
  'reg.high': ['High {name}', '高音 {name}'],
  'reg.title': ['Starts on {from}', '从 {from} 开始'],
  'aria.register': ['Starting octave', '起始八度'],

  /* screen-reader labels (also used by [data-i18n-aria] in the HTML) */
  'aria.back': ['Back to scale list', '回到音阶列表'],
  'aria.level': ['NYSSMA level', 'NYSSMA 级别'],
  'aria.family': ['Scale family', '音阶类型'],
  'aria.form': ['Minor form', '小调形式'],
  'aria.octaves': ['Octaves', '八度'],
  'aria.notation': ['Scale notation', '音阶乐谱'],
  'aria.dial': ['Tuning dial', '调音表盘'],
  'aria.score': ['Sight-reading passage', '视奏乐谱'],
  'Volume': ['Volume', '音量'],

  /* Practice log, as the screen says it */
  'log.banner.streak': ['{n} days in a row · {days} this week', '{n} 天连续 · 本周 {days} 天'],
  'log.banner.empty': ['Start the log — one tap is enough.', '开始记录吧——点一下就算。'],
  'log.banner.emptyNamed': [
    '{name} · nothing logged yet today',
    '{name} · 今天还没有记录',
  ],
  // ── The week: the student's own goal, and what actually happened ──
  'log.goal.none': [
    'What would you like this week to look like?',
    '这周想练成什么样？',
  ],
  'log.goal.days1': ['Practice on 1 day', '本周练 1 天'],
  'log.goal.daysN': ['Practice on {n} days', '本周练 {n} 天'],
  'log.goal.ready1': ['Get 1 more scale ready for the audition', '再让 1 条音阶达到考试标准'],
  'log.goal.readyN': ['Get {n} more scales ready for the audition', '再让 {n} 条音阶达到考试标准'],
  'log.goal.count': ['{done} of {target}', '{done} / {target}'],
  'log.chip.day1': ['1 day', '1 天'],
  'log.chip.days': ['{n} days', '{n} 天'],
  'log.chip.scale1': ['1 scale', '1 条音阶'],
  'log.chip.scales': ['{n} scales', '{n} 条音阶'],
  'log.win.daysLabel': ['Days practiced', '练习天数'],
  'log.win.day1': ['1 day', '1 天'],
  'log.win.daysN': ['{n} days', '{n} 天'],
  'log.win.more': ['{n} more than last week', '比上周多 {n}'],
  'log.win.less': ['{n} fewer than last week', '比上周少 {n}'],
  'log.win.same': ['same as last week', '和上周一样'],
  'log.win.first': ['a first week — nothing to compare yet', '第一周——还没有可比较的'],
  'log.win.readyLabel': ['Came good this week', '本周变好的'],
  'log.win.ready1': ['1 scale ready', '1 条音阶就绪'],
  'log.win.readyN': ['{n} scales ready', '{n} 条音阶就绪'],
  'log.win.readyNone': ['not yet — two clean days makes one', '还没有——两个干净的日子才算一条'],
  'log.win.takesLabel': ['Takes', '练习次数'],
  // ── Your stats ──
  'stats.takes': ['takes counted', '计入的次数'],
  'stats.thisWeek': ['days this week', '本周天数'],
  'stats.best': ['best score', '最好成绩'],
  'stats.average': ['recent average', '近期平均'],
  'stats.streak': ['days in a row', '连续天数'],
  'stats.scale': ['Scale', '音阶'],
  'stats.level': ['Level', '级别'],
  'stats.shape': ['Last few', '最近走势'],
  'stats.tries': ['Tries', '次数'],
  'stats.levelN': ['Level {n}', '{n} 级'],
  'stats.noneScale': [
    'No scale takes yet. Play one scale and press start — this page fills in from there.',
    '还没有音阶记录。拉一条音阶、点开始——这一页就会开始积累。',
  ],
  'stats.noneSight': [
    'No sight-reading takes yet. Open the sight-reading section and try a passage.',
    '还没有视奏记录。去视奏页面读一段试试。',
  ],
  'stats.noneMatching': ['Nothing here yet for the scales in this level.', '这个级别还没有对应的记录。'],
  'stats.ignored': [
    '{n} take(s) were set aside as test runs — a tap, a cough, or a take that ended before it began. They are not in any of these numbers.',
    '有 {n} 次被当作测试录音排除了（点了一下、咳嗽，或者刚开始就结束的）——上面的数字里都没有它们。',
  ],
  'log.win.totalLabel': ['Ready for the audition', '考试就绪'],
  'stats.ignored': [
    '{n} takes were set aside as test runs — a tap, a cough, or one that ended before it began. None of them are in these numbers.',
    '有 {n} 次被当作测试录音排除了（点了一下、咳嗽，或者刚开始就结束的）——上面的数字里都没有它们。',
  ],
  'stats.ignoredOne': [
    '1 take was set aside as a test run — a tap, a cough, or one that ended before it began. It is not in any of these numbers.',
    '有 1 次被当作测试录音排除了（点了一下、咳嗽，或者刚开始就结束的）——上面的数字里没有它。',
  ],
  'stats.withHelp': ['With the clicks and the line', '开着节拍和指示线时'],
  'stats.noneTakes': [
    'Nothing here yet — every take you play is listed here with a delete beside it.',
    '这里还没有记录——每拉一次都会出现在这里，旁边有删除按钮。',
  ],
  'stats.takeOther': ['a take', '一次练习'],
  'stats.delete': ['Delete this take', '删除这一次'],
  'stats.deleteConfirm': ['Delete?', '删除？'],
  'stats.deleteConfirmAria': ['Tap again to delete this take', '再点一次删除这一次记录'],
  'stats.keep': ['Keep them', '保留'],
  'stats.ignoredTag': ['not counted', '未计入'],
  'stats.clear': ['Clear all my stats', '清空我的全部数据'],
  'stats.clearConfirm': ['Tap again to erase everything', '再点一次，全部清除'],
  'stats.clearWarn': [
    'This removes every take, every day and every best under this name on this device. It cannot be undone.',
    '这个名字下在这台设备上的每一次记录、每一天、每个最好成绩都会被删掉，无法恢复。',
  ],
  'sight.assist': ['Assisted — count-in, clicks and the moving line', '辅助模式——预备拍、节拍和移动指示线'],
  'sight.assistCounting': ['Counting you in — {n}', '预备拍——{n}'],
  'log.win.total': ['{n} of {total} scales', '{n} / {total} 条音阶'],
  'log.win.none': [
    'Nothing logged yet. One tap on a day below starts it.',
    '还没有记录。在下面点一下“今天”就开始了。',
  ],
  'log.planLine': ['You practice {when}.', '你的计划：{when}。'],
  'log.planEmpty': ['Pick a time and it will show here.', '选一个时间，会显示在这里。'],
  'log.rest': ['Mark today as rest', '把今天标为休息'],
  'log.resting': ['Resting today · tap to undo', '今天休息 · 点一下取消'],
  'log.restLimit': ['Two rest days a week is the limit', '一周只有两天休息'],
  'log.thisWeek': ['{n} of 7 days', '7 天里有 {n} 天'],
  'log.tag.scales': ['Scales', '音阶'],
  'log.tag.sight': ['Sight reading', '视奏'],
  'log.tag.sprint': ['Note Sprint', '音符冲刺'],
  'log.tag.tuner': ['Tuning', '调音'],
  'log.tag.piece': ['A piece', '曲子'],
  'log.tag.recording': ['Recording', '录音'],
  'log.tag.other': ['Something else', '其他'],
  'log.hard.intonation': ['Intonation', '音准'],
  'log.hard.rhythm': ['Rhythm', '节奏'],
  'log.hard.shifts': ['Shifts', '换把'],
  'log.hard.reading': ['Reading', '读谱'],
  'log.hard.tone': ['Tone and bow', '音色与运弓'],
  'log.ready': ['Ready', '已就绪'],
  'log.readyOf': ['{n} of {total} days', '{n}/{total} 天'],
  'log.ready.suggested': ['One of the usual first three — open strings, one pattern', '常见的第一批之一——空弦起步，同一套指法'],
  // What the level asks for, in its own words.
  'log.ready.hint.1-2': [
    'Level I–II asks for {n} scales, one octave each — you choose which three. G, D and A are the usual first ones: they start on open strings and use the same finger pattern. A scale is ready after two clean days.',
    '一至二级只要 {n} 条音阶，每条一个八度——三条由你自己挑。通常先学 G、D、A：它们都从空弦开始，指法也一样。一条在两个不同日子拉干净就算就绪。',
  ],
  'log.ready.hint.3-4': [
    'Level III–IV asks for {n} scales, two of them in two octaves — you choose the seven. A scale is ready after two clean days.',
    '三至四级要 {n} 条音阶，其中两条是两八度——七条由你自己挑。一条在两个不同日子拉干净就算就绪。',
  ],
  'log.ready.hint.5-6': [
    'Level V–VI asks for {n} major scales, all in two octaves. The Manual counts fifteen, which in this app is twelve keys: C♯ and D♭ are one scale played one way. A scale is ready after two clean days.',
    '五至六级要 {n} 条大调音阶，全部两个八度。手册上算十五条，这里是十二个调：升 C 和降 D 是同一条音阶的两种写法。一条在两个不同日子拉干净就算就绪。',
  ],
  'log.ready.count': ['{done} of {need} ready', '{done} / {need} 已就绪'],
  'log.ready.met': [
    '{done} of {need} — the ones this level asks for are ready',
    '{done} / {need}——这一级要求的已经够了',
  ],
  'log.record': ['Record', '录音'],
  'log.stop': ['Stop', '停止'],
  'log.recording': [
    'Recording — play something you are working on.',
    '正在录音——拉一段你正在练的。',
  ],
  'log.recFailed': ['That recording did not save. Try again.', '这次录音没有成功，再试一次。'],
  'log.noRecorder': ['This browser cannot record audio.', '这个浏览器不能录音。'],
  'log.playing': ['Playing back…', '正在播放…'],
  'log.playFailed': ['Could not play that back.', '这段放不出来。'],
  'log.take': ['Take {n}', '第 {n} 段'],
  'log.sheet.week': ['Week of {date}', '本周（{date} 起）'],
  'log.sheet.goal': ['Goal: {goal} · {done} of {target}', '目标：{goal} · {done} / {target}'],
  'log.sheet.days': ['Practiced {n} days, rested {rests}', '练了 {n} 天，休息 {rests} 天'],
  'log.sheet.daysNone': ['Practiced {n} days, no rest days', '练了 {n} 天，没有休息日'],
  'log.sheet.day1': ['Practiced 1 day', '练了 1 天'],
  'log.sheet.day1Rest': ['Practiced 1 day, rested {rests}', '练了 1 天，休息 {rests} 天'],
  'log.sheet.rest1': ['Practiced {n} days, rested 1 day', '练了 {n} 天，休息 1 天'],
  'log.sheet.dayRest1': ['Practiced 1 day, rested 1 day', '练了 1 天，休息 1 天'],
  'log.savedCopy': [
    'Saved {n} days to a file — look in your downloads.',
    '已把 {n} 天的记录存成文件——在「下载」里。',
  ],
  'log.loaded': [
    'Loaded. The log now has {n} days ({added} new).',
    '已载入。记录现在有 {n} 天（新增 {added} 天）。',
  ],
  'log.loadedSame': [
    'That copy is already here — still {n} days.',
    '这份副本已经在这里了——仍然是 {n} 天。',
  ],
  'log.loadFailed': ['That file could not be read.', '这个文件读不出来。'],
  'log.loadBad': ['That is not a Scale Studio log.', '这不是 Scale Studio 的记录文件。'],
  'log.sheet.takes': ['{n} takes heard and scored', '听完并打分的次数：{n}'],
  'log.sheet.did': ['Did: {list}', '练了：{list}'],
  'log.sheet.hard': ['Hard this week: {list}', '这周觉得难的地方：{list}'],
  'log.sheet.ready': ['Scales ready: {n} of {total}', '就绪的音阶：{n}/{total}'],
  // ── This take against the last few ──
  'compare.first': [
    'First time on this one, so there is nothing to beat yet.',
    '这是第一次练它，暂时还没有可比较的。',
  ],
  'compare.best': ['{n} points above your best.', '比你的最好成绩高 {n} 分。'],
  'compare.equalled': ['Level with your best of {n}.', '和你的最好成绩 {n} 分持平。'],
  'compare.close': ['Your best is {n} — close behind it.', '你的最好成绩是 {n} 分，很接近了。'],
  'compare.below': ['Your best is {n}; this one sat a little below it.', '你的最好成绩是 {n} 分，这次稍微低一点。'],
  'log.share': ['Share the week', '分享这周'],
  'log.shareTitle': ['My practice week', '我这周的练习'],
  'log.copy': ['Copy the week', '复制这一周'],
  'log.copied': ['Copied', '已复制'],
  'log.me': ['Me', '我'],
  'log.addName': ['+ Add a name', '+ 加一个名字'],
  'log.rename': ['Rename', '改名'],
  'log.remove': ['Remove', '删除'],
  'log.add': ['Add', '添加'],
  'log.saveName': ['Save', '保存'],
  'log.namePlaceholder': ['Your name', '你的名字'],
  'log.nameTaken': [
    'That name is already here, or the list is full.',
    '这个名字已经有了，或者名字已经满了。',
  ],
  'log.confirmRemoveName': [
    'Remove {name} and their whole log? This cannot be undone.',
    '删除 {name} 和 TA 的全部记录？删了就找不回来了。',
  ],
  'log.loadOther': [
    'That copy belongs to {name}. Switch to that name first — or add it.',
    '这份副本是 {name} 的。先切换到那个名字，或者先把名字加上。',
  ],
  'log.banner.named': [
    '{name} · {n} days in a row · {days} this week',
    '{name} · {n} 天连续 · 本周 {days} 天',
  ],
  'log.copyFailed': ['Could not copy', '复制不了'],
  'log.confirmClear': [
    'Clear this log? The name stays and the other names are untouched, but the days cannot come back.',
    '清空这份记录？名字和其他人的记录都会保留，但日子找不回来了。',
  ],
};

/* ── Static text that lives in index.html ─────────────────────────────── */

export const STATIC = {
  'Listen': '聆听',
  'Beta': '测试版',
  'Play a piece and hear what the app noticed — tuning, vibrato, pulse. Bring a MusicXML score and it checks every bar.': '拉一首曲子，听听应用注意到了什么——音准、揉弦、速度。带上 MusicXML 乐谱，它会检查每个小节。',
  /* chrome */
  'Dark': '深色',
  'Pet room': '宠物小屋',
  'Tap a bar on the page to start from there.': '点谱子上的一个小节，就从那里开始。',
  'Note Sprint': '音符冲刺',
  'Trill Trainer': '颤音练习',
  'Two fingers, one string. Build a trill from slow and even to fast, and watch your pitch draw the wave.': '两根手指，一根弦。把颤音从慢而均匀练到快，看着自己的音高画出波浪。',
  'Pick the notes you know, then read them as fast as you can. The app listens.': '选出你认识的音，然后尽快读出来、拉出来。应用会听。',
  'New': '新',
  'Hatch a pet and look after it. Every scale you play — and every practice day you log — earns notes for snacks and toys.':
    '孵一只小宠物，好好照顾它。每拉一条音阶、每记一次练习，都能赚音符换点心和玩具。',
  'Tuner': '调音',
  'How it works': '评分说明',
  'English': 'English',
  '中文': '中文',
  'NYSSMA Levels I–VI · violin': 'NYSSMA 一至六级 · 小提琴',
  'Tuned to A = 440 Hz': '以 A = 440 Hz 为准',
  'Audio is analysed in your browser. Nothing is uploaded, and a recording lives only in this tab.':
    '声音只在这个浏览器里分析。不会上传；录音也只留在这个标签页里。',

  /* chooser */
  'Which scale today?': '今天练哪条音阶？',
  'Pick a key and press start. The app stays quiet until you play your first note, then listens to the whole scale and tells you what it heard — no timer, no rush.':
    '选一个调，点“开始”。你拉出第一个音之前它只是安静地等着；之后它会完整听一遍，告诉你听到了什么——不计时，不催你。',
  'Mock audition': '模拟考试',
  'Level': '级别',
  'Slow practice': '慢练',
  '½ speed': '½ 速度',
  '¾ speed': '¾ 速度',
  'At tempo': '原速',
  'Scales': '音阶',
  'Preparing for': '准备级别',
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
  'I’m finished': '我拉完了',
  Pen: '笔',
  Erase: '擦除',
  Undo: '撤销',
  'Marks stay until you reload the page.': '标记会保留到刷新页面为止。',
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

  /* sight reading */
  'Sight reading': '视奏',
  'Hear the passage': '听一遍谱子',
  'Open sight reading': '开始视奏',
  'Hear the tempo': '听一下速度',
  'New passage': '换一段',
  'Eight bars you have never seen, written to your level — key, time signature, rhythms and range all from the Manual.':
    '八小节没见过的乐谱，按你的级别写出来——调号、拍号、节奏、音域都照考纲。',
  'Eight bars, your level, drawn fresh each time. Study it, hear the tempo, then play.':
    '八小节，按你的级别，每次都不一样。先看谱，听一下速度，再开始拉。',
  Finish: '完成',
  'Try again': '再试一次',
  'Support Scale Studio': '支持 Scale Studio',
  'This week': '这周',

  /* offline */
  'Make the violin available offline': '把小提琴录音存到本机',

  'sight.intro':
    '先看一遍，听一下速度，然后开始拉——应用会等你第一个音。点一下某一小节，可以把它标出来，试听就从那里开始。它只听音高和节拍；力度和弓法它判断不了，速度也比评委宽容。',
  'help.support':
    'Scale Studio 一直免费，也会一直免费。如果它对你或你的学生有帮助，也可以<a href="https://ko-fi.com/apple" target="_blank" rel="noopener noreferrer">请我喝杯咖啡</a>——这样我才能继续把这类东西做下去。',

  /* What the listening can and cannot hear — the same words on both screens. */
  'hear.summary': '它能听出什么，听不出什么',
  'hear.list':
    '<li><strong>音符</strong>——很可靠。每个音都会对上谱上的那一个，所以漏一个或多一个，只影响它自己那一格。</li>' +
    '<li><strong>音准</strong>——音拉得住的时候可靠。左右 15 音分以内都算准；揉弦很重、音很短的时候会模糊。</li>' +
    '<li><strong>节奏</strong>——判断得还算准。它不管你快慢，只看间隔是否均匀；四分之一拍以内的偏差算在噪声里。</li>' +
    '<li><strong>停顿</strong>——可靠。停顿超过大约两拍才算一次。</li>' +
    '<li><strong>速度</strong>——不打分。比标记慢一点没关系。</li>' +
    '<li><strong>力度、弓法、音色</strong>——听不出来。一支麦克风分不清渐强和加弓压，也分不清断弓和连弓。</li>' +
    '<li><strong>重复音</strong>——同一个音连着拉，可能会合成一个音；换弓的位置它只能大致听出来。</li>' +
    '<li><strong>音分</strong>——一个半音的百分之一，100 音分就是下一个音。10 音分以内怎么听都是准的，25 音分已经明显偏了，50 音分正好在两个音中间。</li>',
  'intonation.title': '偏高还是偏低，差多少',
  'intonation.legend':
    '向上是偏高、向下是偏低，长短就是差多少；中间那条浅色带是 15 音分以内，怎么听都算准。空心圈表示应用没听到那个音。',
  'cents.note':
    '<strong>音分是什么。</strong>一个半音——一个指位、一个品格——等于 100 音分。相差 10 音分以内，怎么听都是准的；25 音分已经能明显听出偏了；50 音分正好到下一个音的正中间，应用就会开始把它当成那个音。',
  'hear.ios':
    '<strong>在 iPhone 或 iPad 上</strong>，Safari 会自己对麦克风做处理——自动增益、降噪，还有一层不在录音里的滤波——网页没法关掉，原生调音器却可以。所以同一个音在这里可能显得更轻。如果有时听不到音，注意别挡住设备底部的麦克风，拉得肯定一点。',

  /* Practice log — what the sheet markup and the date menu say */
  'log.plan.none': '随时都可以',
  'log.plan.afterSchool': '放学以后',
  'log.plan.afterDinner': '晚饭以后',
  'log.plan.beforeBed': '睡觉之前',
  'What you played, what was hard, and how close the scales are to ready.':
    '练了什么、哪里难、音阶离就绪还有多远。',
  'Open the log': '打开记录',
  'Everything here lives on this device. Nothing is uploaded, and a recording lasts only as long as this tab is open.':
    '这些只存在这台设备上。不会上传；录音也只在这个标签页开着的时候存在。',
  'days in a row': '天连续',
  "Who's practicing?": '谁在练习？',
  'Rename or remove a name': '改名或删除名字',
  'Your name': '你的名字',
  'Two rest days a week are yours to take. A day off you planned is not a broken streak.':
    '每周有两天可以安排休息。计划好的休息，不算中断。',
  'I practice': '我练习的时间',
  'Last five weeks': '最近五周',
  'Today': '今天',
  'One tap is enough — a minute counts.': '点一下就够了——一分钟也算。',
  'What was hard today?': '今天哪里觉得难？',
  'Scales ready for the audition': '可以上场的音阶',
  'A scale counts as ready once you have played it cleanly on two different days.':
    '一条音阶在两个不同的日子都拉得干净，就算就绪。',
  'Practice log': '练习记录',
  'stats.manageNote':
    '删掉一次记录，它就不再参与这些数字。这是你自己的记录，所以这里不设限制——这些按钮是给“弟弟在旁边喊了一声”或者“麦克风听错了东西”的那种记录用的。',
  'Your stats': '我的数据',
  'Open the stats': '打开数据页',
  'What are we doing today?': '今天想做什么？',
  'Choose a space. Scales is where most days start — pick a key, press start, and the app listens to the whole scale.':
    '选一个空间。大多数时候都是先练音阶——挑一个调，点开始，应用会听完整条音阶。',
  'Menu': '菜单',
  'Home': '主页',
  'Test — no clicks, no line, just the page': '考试模式——没有节拍、没有指示线，只有谱子',
  'NYSSMA tempo': 'NYSSMA 原速',
  'The clicks come out of the speaker and the microphone is open — headphones keep one out of the other. Test runs are kept in your stats under their own heading.':
    '节拍声从扬声器出来，而麦克风是开着的——戴上耳机就不会互相串。考试模式的成绩在数据页里单独列出来。',
  'With the clicks and the line': '开着节拍和指示线时',
  'Twelve majors and the minor forms, levels I–VI. Play one and the app listens.':
    '十二个大调加上小调的各种形式，一至六级。拉一条，应用就听着。',
  'Eight bars you have never seen, written to your level.':
    '八小节你没见过的谱子，按你的级别写。',
  'Your own records: best scores, what is improving, days played.':
    '你自己的记录：最好成绩、在进步的地方、练过的天数。',
  'Every take, every scale, your own records — best scores, what is improving, and the days you actually played.':
    '每一次录音、每一条音阶，都是你自己的记录——最好成绩、在进步的地方，还有真正练过的日子。',
  'Keeping it safe': '留住这份记录',
  'This log lives in this browser on this device. Save a copy to keep it, or to carry it to another one.':
    '这份记录只存在这台设备的这个浏览器里。存一份副本可以留住它，也可以带到别的设备。',
  'This browser is not letting the app save anything, so this log will be gone when the page reloads. Save a copy before you leave.':
    '这个浏览器不让应用保存任何东西，刷新页面后记录就会消失。离开前先存一份副本。',
  'Save a copy': '存一份副本',
  'Load a copy': '载入副本',
  'What can lose it': '什么情况下会丢',
  'log.safety.data':
    '<strong>清除浏览器的网站数据</strong>——就是常说的“清除历史记录和数据”——会把它删掉；无痕窗口也一样。',
  'log.safety.ios':
    '<strong>在 iPhone 或 iPad 上</strong>，Safari 可能会清掉七天没有访问的网站所存的数据。把 Scale Studio 加到主屏幕就不会。',
  'log.safety.device':
    '<strong>换一台设备就是另一份记录。</strong>学校的 iPad 和家里的电脑各记各的——载入副本可以把其中一份带过去。',
  'log.safety.copy':
    '存副本会写一个小文件，文件名带当天的日期。载入时缺的补上、已有的保留，所以同一个文件载两次也没关系。',
  'Copy the week': '复制这一周',
  'Listen back': '听回放',
  'Add a hall': '加一点厅堂混响',
  'The reverb is only in your headphones — it does not touch the scoring, and the recording disappears when you close the tab.':
    '混响只在你耳机里——它不参与打分；录音在关闭这个标签页后就没了。',
  'Take this to your lesson': '带去上课用',
  'Start over': '重新开始',
  'whenever it happens': '随时都可以',
  'after school': '放学以后',
  'after dinner': '晚饭以后',
  'before bed': '睡觉之前',

  /* the rest of the static sheet */
  'eyebrow.test': '模拟考试 · 三条音阶',
  'You can breathe between scales — the app waits for your first note each time.':
    '两条之间可以缓一口气——每一条它都会等你的第一个音。',
};
