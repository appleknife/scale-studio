# Scale Studio

**Live:** <https://appleknife.github.io/scale-studio/> — works on phones and tablets.

![Scale Studio — choose a scale](preview.png)

A listening scale trainer for violin students preparing for **NYSSMA Levels I–VI**.

Pick a key, press *Start listening*, and play. The app waits until you actually
begin — there is no count-in and no timer — then follows the scale note by note
and shows a percentage with specific, encouraging feedback: which notes sat
high or low, whether the pulse wandered, and where you stopped.

Everything happens in the browser. Nothing is uploaded, there is no account, and
a recording you make stays in the tab and is gone when you close it.

---

## Running it

The microphone is only available to pages served from `localhost` (or HTTPS), so
the app needs to be opened through the little server that ships with it rather
than by double-clicking `index.html`.

**Windows:** double-click **`Start Scale Studio.cmd`**. A console window opens,
your browser opens the app, and you leave the console open while practising.

That little server is not an installation — it only hands the folder's files to the
browser over `http://localhost`. Opening `index.html` by double-clicking cannot work:
the page's scripts are ES modules, which browsers refuse to load from a `file://`
origin, and microphones are only offered to secure origins (`localhost` or HTTPS). If
you do double-click it, the page now explains this instead of sitting blank.

**macOS / Linux:** from this folder run `python3 -m http.server 8777` and open
<http://localhost:8777/>.

**On a tablet or Chromebook:** open the published link above. It is served from
GitHub Pages over HTTPS, which is what lets the microphone work on iOS and
Android. Any static host would do the same — nothing here needs a server-side
language.

**Sharing it:** the link is public, and nothing is stored: audio is analysed in
the page and thrown away, and there is no account, no database and no analytics.
Students can bookmark it or add it to their home screen.

### iPhone and iPad

It runs in Safari, and Chrome/Firefox on iOS (which use the same engine). Two things
to know:

* **It must be HTTPS.** An address like `http://192.168.1.20:8777` on your home
  network will load the app but the microphone will be refused — iOS only offers it
  to secure pages, and a LAN address is not one. Publish the folder to any static
  host and open the `https://…` link.
* **Add to Home Screen** (Share → Add to Home Screen) gives it an icon and runs it
  full screen without browser chrome. The manifest and touch icon are already here.

iOS applies its own automatic gain and (on some models) voice isolation to the
microphone, so readings are marginally less precise than on a laptop — still far
inside the ±20 cents the scoring cares about. Keep the screen awake: locking the
tablet suspends audio and ends the take.

> Browsers ask for microphone permission the first time. If it was blocked, click
> the lock icon in the address bar and allow it.

---

## What the app considers

| What | Weight | How it is judged |
| --- | --- | --- |
| Notes | 56% | Every expected note is matched one-by-one against what was heard. |
| Intonation | 20% | Cents away from the centre of each note (±15¢ counts as centred). |
| Steadiness | 12% | Spread of the gaps between note onsets — an even pulse scores well. |
| Flow | 12% | Silences long enough to break the phrase. |

The scoring is deliberately generous. A whole scale played slightly sharp, or a
tempo that drifts a little, still scores in the nineties; what actually moves the
number is stopped playing, missed notes and notes in the wrong place. Anything
worth fixing becomes one of the note-by-note tips under the result.

Notes are aligned with the printed scale using sequence alignment, so one extra
note or one skipped note costs only its own slot instead of throwing off
everything that follows.

---

## Tuner

The **Tuner** button in the header opens a needle dial for the open strings. Bow one
string at a time and the app follows whichever string it hears. The green band shows
where that string should sit — which is deliberately *not* dead centre:

* **A, D and E** want a hair above the note, deliberately. Soloists tune slightly high
  because the violin sounds a little brighter and carries further, and because strings
  drift down as you play — so starting a touch high keeps you closer to pitch for
  longer.
* **G** wants a hair below. It is the string that lifts most under bow weight, and it
  still has to sit a true fifth under the D.

The screen also carries the mechanics students actually need: fine tuners first, pegs
only for a big move, always arriving at a pitch from below (ease it flat, then come up),
never overshooting, resetting a fine tuner that has bottomed out — and extra care on the
E, which snaps first.

Then the part that matters more than any number on the dial: **the fifths**. A violin
is tuned in pure fifths while a tuner is equal-tempered, so the two disagree by a
couple of cents on every string. **A is the base:** hold each pair as a double stop and
tune outward from it — E to A, D to A, then G to D. Only the second string of each pair
moves, and the dial is re-checked afterwards because the fifth is the better judge.

The three pairs are a tick-list, not a measurement. A bowed double stop always
wobbles a little — bow pressure alone moves the loudness around more than the beat
does — so any automatic "is it pure?" judgement would cry wolf. Tick each pair off
once your ear is satisfied; the app's job here is only to keep the ritual in front of
you.

## Levels

The level tabs on the chooser decide what "a scale" means for you, and they follow
the Manual's three tiers:

| Level | What the Manual asks | What the app does |
| --- | --- | --- |
| **I–II** | three distinct major scales, one octave, chosen by you | you pick three; all one octave |
| **III–IV** | seven major scales, two of them in two octaves | you pick seven and mark your two; the app draws one two-octave and two one-octave |
| **V–VI** | fifteen major scales, all two octaves, chosen by the adjudicator | three drawn at random |

Practice follows the level as well — I–II opens scales in one octave, III–VI in two —
and the **1 oct / 2 oct** switch in the scale header overrides it for any single
scale, which is handy when a student is ready to stretch one key upwards.

## Mock audition

Every audition is three scales, played back to back, with one report at the end.
How those three arrive depends on the level: at I–II you choose them, at III–IV the
app draws from your seven, at V–VI it draws from the twelve keys. At V–VI the draw
spins three reels — three distinct keys, no repeats — and then you play them one
after another, exactly as in the audition:

* the microphone opens once and stays open, so there is no re-prompting between scales;
* the **notation is hidden** — only the key name and range are shown, because the
  Manual asks for the scales "from memory without any visual aid";
* the live tuner is hidden (a judge gives nothing away);
* no score appears until the third scale is finished;
* the app waits for your first note each time, so you can breathe between scales;
* **End audition** stops early and returns to the scale list.

The report gives an average, each scale's own score with a one-line verdict, the
single most useful tip from each scale, and an encouraging line drawn at random
from a small pool. Tap any scale row to open its full breakdown — score ring,
coloured staff, all the tips.

The draw is majors only, because that is what Levels 5–6 require, and it always
uses the familiar spelling: **B**, **F♯**, **C♯** — never C♭, G♭ or D♭.

### Matching the Manual

The string requirement for Levels V–VI reads:

> Fifteen (15) major scales from memory without any visual aid · all in two octaves ·
> ascending and descending in quarter notes at a moderate speed.
> Perform: three scales, all three chosen by the adjudicator.

The app follows that shape: two octaves tonic to tonic, notation hidden in an
audition, three scales drawn for you, and a tempo check that only nudges when a take
is very slow (the Manual says "moderate", not "fast").

### Why not C♭?

Because the Manual never names its fifteen scales. It only ever says "Fifteen (15)
major scales", so the list is an inference: C plus the seven sharp keys and the seven
flat keys. That counts B/C♭, F♯/G♭ and C♯/D♭ as separate scales even though they are
the same notes with the same fingerings — which is why the count comes out as fifteen
rather than twelve.

The 2026 review ([CUNY Academic Works](https://academicworks.cuny.edu/cgi/viewcontent.cgi?article=1000&context=yc_pubs))
points out that the Manual "does not indicate which fifteen", argues for twelve, and
notes that we do not even have statistics on how often a key like C♭ has ever been
picked by an adjudicator. Flesch and Galamian both use twelve. On the ground, the
enharmonic pairs are taught as one scale: a Long Island studio's NYSSMA video series
teaches D♭ for Levels 5–6 and says outright that it "is the same exact note as C
sharp".

So C♭ is here for completeness, but it is off by default. If you want to drill it,
open the B / C♭ card on the practice screen and switch the spelling.

## The scales

Levels 5–6 for violin/viola/cello require **fifteen major scales, all two octaves,
up and down, from memory**. Three of the fifteen share a pitch set with another
spelling, so the grid shows twelve cards:

| Card | Key signature | Starts on |
| --- | --- | --- |
| C | — | C4 (3rd finger, G string) |
| G | 1♯ | G3 (open G) |
| D | 2♯ | D4 (open D) |
| A | 3♯ | A3 (open A) |
| E | 4♯ | E4 (1st finger, D string) |
| B / C♭ | 5♯ / 7♭ | B3 (2nd finger, G string) |
| F♯ / G♭ | 6♯ / 6♭ | F♯4 (high 2nd finger, D string) |
| C♯ / D♭ | 7♯ / 5♭ | C♯4 (2nd finger, A string) |
| F | 1♭ | F4 (low 2nd finger, D string) |
| B♭ | 2♭ | B♭3 (low 2nd finger, G string) |
| E♭ | 3♭ | E♭4 (low 1st finger, D string) |
| A♭ | 4♭ | A♭3 (high 1st finger, G string) |

The **Minor scales** tab is extra (NYSSMA does not ask for them at these levels,
but a lot of the repertoire is minor) with natural, harmonic and melodic forms.

If your studio starts a scale in a different octave, change the `octave` value for
that key in [`src/music.js`](src/music.js) — the staff, the listening target and
the scoring all follow from it.

---

## How it listens

* **Pitch detection:** YIN (cumulative mean normalized difference) over a 2048-sample
  window, sampled about 30 times a second. It is monophonic and vibrato-tolerant;
  it reports the centre of a vibrato, not the wobble.
* **Note finding:** a note begins when a stable pitch appears and ends when the
  pitch moves or the sound stops. The first 20% and last 15% of each note are
  ignored so bow attacks do not distort the reading.
* **Scoring:** sequence alignment + per-note cents, onset spacing and gaps.

Tuning decisions live in `DEFAULTS` at the top of
[`src/analyze.js`](src/analyze.js) — for example `intonationPerfect: 15` and
`intonationZero: 55` control how strict intonation is, and `weights` sets the four
percentages above.

---

## Practical tips for students

* A quiet room and a microphone within a metre or two of the instrument is plenty.
* Don't hold back — a confident, even bow is easier for the app (and the
  adjudicator) to read than a cautious one.
* Let the first note ring for a moment; the take starts on the first sustained
  pitch it hears.
* Press **Finish early** if you want to stop a take without waiting for silence.
* If you have several microphones, the browser remembers the choice **per site**.
  Change it in the padlock/aA menu → Site settings → Microphone, then press *Start
  listening* again (a take already running stays on the old input).

Closing the console window (or Ctrl+C) stops the server, and the page stops loading
until you start it again. If port 8777 is already taken, run
`powershell -ExecutionPolicy Bypass -File server.ps1 -Port 9000` and open
<http://localhost:9000/>.

## Sight reading

A second kind of practice, next to the scales: **eight bars you have never seen**,
written to the level you pick (I–VI). Key, time signature, tempo, range, rhythms,
accidentals, rests, articulations and dynamics all come from the Manual's
sight-reading table for that level.

* **New passage** draws another one; each is eight bars on two systems.
* **Hear the tempo** clicks two bars at the printed speed, with a heavier downbeat.
* Every passage has a **seed**, so `?sight=5&seed=4471` always gives the same eight
  bars. A teacher can put one passage on a projector, or send the link to a class.
* The line sits on the staff, opens on a chord tone, steps more than it leaps,
  resolves its leaps, has one climax and cadences on the tonic — the conventions a
  human writes sight reading by.

* **Start listening** waits for your first note, then marks the passage: notes,
  intonation, pulse and stops, in the same forgiving spirit as the scales. Tempo is
  not scored and dynamics and articulation are out of reach — the card says so.
* **The needle** under the buttons is the same readout the scale take shows: the
  note you are sounding and how many cents off centre it sits. It is a rehearsal
  aid, so it only appears while a take is running; a mock audition will arm the
  take with `armSightTake({ live: false })` and hide it.
* A take left open when the student walks away is closed with the microphone, so
  nothing keeps counting on a screen nobody is watching.
* **What it can and can't hear** is a disclosure under the buttons, closed until
  someone opens it: notes and stops are reliable, pitch centre is reliable on a
  held note, steadiness is a fair judge, tempo is not scored, and dynamics, bowing
  and tone are not heard at all. The same words sit on the scale screen.

**Level I is deliberately plain.** D major only, one octave from D4 to D5, 2/4 or
4/4, quarter and half notes with the occasional whole note, and no leap wider than
a third — the page the Manual prints for level I. A whole note alone in a bar is
centred in it, the way an engraver sets one.

**Level II adds slurs and the dotted half.** Roughly two passages in five carry a
slurred pair or three notes, and a dotted half turns up in about half of them —
filling a 3/4 bar, or taking the first three beats of 4/4. Slurs start here and get
commoner with the level: three quarters of level III passages have one, and every
passage from level IV on.

### Drawing the notation

Everything on the page is drawn by hand in `src/score.js`, and the glyphs that gave
trouble are the ones where a stroked line is not good enough:

* Rests and note flags are **filled outlines**, not strokes. A quarter rest is a
  `ribbon` — a centreline with a width at every point — because the printed glyph is
  calligraphic: hair-thin at the tick, swelling through the belly, pinched at the
  waist. A single stroke width collapses it into a crescent.
* Beams are **filled quadrilaterals** built outward from `beam.at()`, which is where
  the stems end. A stroke's butt cap is cut square to the line, so slanted beams grew
  little wedges, and the second beam of a sixteenth run never sat parallel to the
  first.
* The eighth rest's measurements (bulb 0.30 of the glyph's height, stem 0.10, the
  hairline gap between them) were taken off a printed rest pixel by pixel, the same
  way the sharp in `src/staff.js` was. The sixteenth rest is that glyph with a
  second hook 0.48 of the way down, a shade smaller and nudged left so the notch
  between hook and stem survives.
* The **sharp** started as four stroked lines with measured proportions (uprights
  0.12 of a space wide, bars 0.38 thick, the two bars almost a whole space apart so
  a note head sits between them). It is now a single **traced path** in
  `src/staff.js`: the printed glyph was cut out of a scan at 728 × 736, the alpha
  edge traced with marching squares, simplified to 38 points and normalised into
  staff spaces — 0.96 wide, 2.91 tall, centred on the note's line or space. The
  path carries the printer's own lean and its counter (the gap enclosed by the two
  bars and the two uprights) as a second subpath, hence `fill-rule="evenodd"`. It
  agrees with the bitmap to 97.9% and, unlike the stroked version, never has its
  bar ends sheared by a butt cap. A traced path also stays crisp at any size, which
  an embedded bitmap would not.

If you change a glyph, compare it against a printed one at matched height before
believing it. Cropping the printed glyph and the render, scaling both to the same
height and putting them side by side settled every argument about these shapes;
judging them from two separate screenshots did not.

## Practice log

A fourth screen, reached from the home page, keeps a practice record on that device: a
streak, a five-week grid, one-tap tags for what you did, one-tap tags for what was
hard, a checklist of scales that are audition-ready, a recording you can hear back
in a hall, and a week summary you can copy into a lesson note.

The shape of it is not arbitrary. It follows what the research on music practice and
habit says keeps students playing:

* **The streak counts anything.** One tap is a day. Demanding a full session is what
  stops the habit forming. Duolingo found that separating the streak from the daily
  goal, so one small lesson kept it alive, raised 7-day streaks by more than 40%.
* **Two rest days a week, planned in advance.** A goal with emergency skips survives
  a missed day; a perfect record does not. A rest day neither adds to the streak nor
  breaks it, and a third in one week is refused rather than negotiated.
* **Nothing is ever marked as a miss.** A day with no practice is a blank square,
  never a red one: reminders that highlight failure are the ones that backfire.
* **"What was hard today?"** is one tap, because reflection is the step that turns
  playing into practicing, and it hands the teacher a starting point for the lesson.
* **A plan, not a reminder.** Reminders on their own do not build habits; an if-then
  plan ("I practice after dinner") does. That is what the little menu is for.
* **Ready means ready.** A scale counts once it has been played at 90% or better on
  two different days, which answers "am I ready?" far better than one good take.
* No leaderboards, no badges, no notifications, and the streak shows yesterday's run
  until today is logged, so a good habit does not look lost before breakfast.

Takes log themselves: finishing a scale in the trainer, or a sight-reading attempt,
adds a take to today without anything to type. A day with only "what was hard"
tapped does not count as practice, so a stray tap cannot keep a streak alive.

### Hearing yourself back

The record button keeps the take in memory as a blob and plays it back through a
synthesised hall: exponentially decaying, decorrelated stereo noise as an impulse
response, 2.6 seconds with 20 ms of pre-delay, generated in a few milliseconds
instead of the megabyte a sampled hall would cost. Hearing yourself in a concert
hall is one of the most motivating things a practice room can offer, and
self-recording is the technique conservatoire teachers rate highest of all.

Three honest limits, all of them said on the screen:

* The recording **never leaves the tab** and is not written to disk. Reloading or
  closing the page ends it. That is why it can live inside an app that promises not
  to upload anything.
* The hall is **playback only**. It is added on the way to your headphones and never
  touches the detector, so it cannot flatter a take into a better score.
* Eight takes are kept and older ones are let go, so a long session cannot quietly
  fill a phone's memory. Recording needs iOS 14.1 or later; the button says so
  instead of failing silently.

The log is held in `localStorage` under `scale-studio.journal.v1`, and *Start over*
clears it. It is per device and per browser, so a student's log on the school iPad
and the one at home are two different logs.

## Languages

The app is in English and Simplified Chinese. The switch is the pill in the top
right of the header; it remembers the choice on that device and reloads the page
so every screen comes back in the same language. A link can also force one, which
is handy for a parent's phone or an emailed link:

* <https://appleknife.github.io/scale-studio/?lang=zh> — Chinese
* <https://appleknife.github.io/scale-studio/?lang=en> — English

Everything is translated, including the generated feedback on the result screen and
the tuner's instructions, so a student who reads only Chinese can use the whole app
without translating anything. Scale names stay in letters (C大调, F♯大调) as they are
in Chinese music teaching. The wording of the tuner section in particular should be
read over by a native speaker before it goes to a parent — the terminology (弦轴,
微调器, 纯五度) is standard, but the sentences were written by a non-native hand.

## Files

```
index.html            the three screens
app.css               visual design
src/i18n.js           the English and Chinese text tables
src/music.js          note spelling, key signatures, scale library
src/pitch.js          YIN pitch detector
src/analyze.js        note segmentation, alignment, scoring, feedback
src/tuner.js          open-string targets and the fifth checklist
src/staff.js          treble-staff renderer (SVG)
src/score.js          eight bars of notation: beams, rests, dots, marks
src/sightreading.js   level table and seeded passage generator
src/onsets.js         bow-change detection (built, not wired in yet)
src/journal.js        practice-log rules: streak, rest days, ready scales, week sheet
src/recorder.js       in-memory recording and the synthesised hall
src/app.js            screens, microphone, results
tests/dsp.test.html   synthesised-audio tests for the detector and scoring
tests/sightreading.test.html  720 generated passages against the level rules
tests/onset-probe.html  can a bow change be heard? (parameter sweep)
tests/rhythm-probe.html why repeated notes merge today
tests/ui.test.html    click-through smoke test, including the mock-audition draw
tests/stem-audit.html  reads the drawn SVG back: every stem on its head's correct
                      side, every beam ending on a stem
tests/notation.test.html  renders 360 passages and measures the ink: no rest and
                      no slur may come within two units of another glyph
tests/i18n.test.html  translation coverage: no visible English left on any screen
tests/journal.test.html   the log's arithmetic: streaks, two rests a week, ready scales
tests/recorder.test.html  measures the synthesised hall: it decays, and it is stereo
tests/lab-server.ps1  test server that collects results from a headless browser
server.ps1            the local server used by Start Scale Studio.cmd
```

`tests/i18n.test.html` loads each screen with `?lang=zh`, walks the visible text and
reports anything still in English — the quick check after editing either table.

`tests/sightreading.test.html` generates 720 passages (6 levels × 120 seeds) and
checks the rules hold: bars add up, every note is in range, the phrase ends on the
tonic and opens on a chord tone, intervals stay inside the level's vocabulary, and a
seed always produces the same music. It also prints one passage per level, drawn,
for the eye — the notation bugs found so far were all found by looking at those.

`tests/stem-audit.html` renders 1,560 passages and then *reads the SVG back*
instead of trusting the generator: it pairs every stem with a note head and checks
the stem is on the side its direction demands, and that no beam begins or ends in
mid-air. That is the bug that kept appearing as "mutated" note pairs, so it is now
checked mechanically rather than by eye.

`tests/journal.test.html` pins today to a fixed date and walks a realistic week: a
day with only "what was hard" does not count as practice, a rest day holds the streak
together but a third one in a week is refused, today is not a broken streak before it
is over, and a scale becomes ready on its second clean day rather than its first.

`tests/recorder.test.html` cannot open a microphone headlessly, so it judges the room
by the impulse response itself: the tail decays from 0.28 to nothing, the level at
0.45 s is still audible and gone by 2.3 s, and the two channels correlate at r ≈ 0
(a normalised correlation, because a raw dot product of pure noise fails at random).
The live record path has to be tried by hand.

`tests/dsp.test.html` synthesises a violin-like scale in the browser, runs it
through the real detector and scorer, and reports pass/fail for a clean take,
out-of-tune notes, uneven timing with a pause, a skipped note, a wrong octave and
a slow-but-accurate performance.

---

## Limits worth knowing

* Monophonic only — no double stops or chords.
* Very short notes (faster than about sixteenths at ♩=120) may be merged.
* Laptop microphones vary; a student recorded very quietly may lose notes.
* It is a practice mirror, not an adjudicator: tone, bowing and musical shape are
  still your ears' job.

The treble clef glyph in `src/clef.js` is from
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Treble_clef.svg)
(public domain).
