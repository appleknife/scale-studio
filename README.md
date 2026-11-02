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

The level sits **above** the three cards, not below them, because it decides what
the mock audition draws as well as what the grid shows. On a phone that means the
answer is on screen next to the button that acts on it, instead of a scroll away;
the audition card also repeats the level beside its title so there is never a doubt
about which one is loaded.

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

At Level I–II the Manual lets the student choose, and any three are legal — but the
picker quietly suggests **G, D and A**: each begins on an open string and all three
use the same finger pattern, which is why they are the usual first three. They carry
a soft pulse and the three share one line of explanation; nothing is pre-selected,
because choosing is part of the exercise.

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

* **New passage** draws another one; each is eight bars on two systems — or four
  systems of two bars on a phone. Eight bars squeezed into a phone's width put a
  notehead at five pixels and turned every flag into a hairline; two bars to a line
  doubles both. The drawing itself is unchanged — the same bar width, the same
  flag — so the eighth note on a phone is the eighth note in the icon.
* **Hear the passage** plays it back, with a green playhead that follows the music
  through the staff. It is the same reading a student is about to do — the slurs are
  bowed in one stroke, the staccato notes are short, an accent has an edge, and the
  hairpin is actually performed rather than just printed. The voice is **the
  teacher's own violin**, recorded with `capture.html` and shipped in `samples/`
  (see *the recorded voice*); a synthesised bowed string stands in for any note the
  sample set cannot cover. The playhead is driven by the audio clock, not by a
  timer, so it cannot drift away from what is being heard.
* **Stop** ends the example — in sound, not just on screen. Every note of a passage
  is scheduled up front, so cancelling the playhead alone left the music running to
  the end of the bar. Each sounding now gets its own gain node, faded out over 40 ms
  (a hard cut clicks) and then torn down.
* **The volume slider** next to *Start listening* sets the level for the example and
  the metronome together — one audio context and one master gain for every sound the
  app makes — and it remembers the level on that device.
* **Hear the tempo** clicks two bars at the printed speed, with a heavier downbeat. Its
  clicks are set against the example rather than in the abstract — a 70 ms sine
  against a shaped note held for a beat — so the metronome is not the quiet thing
  under the passage at the same slider position.
* **A bar is a target.** The engraver lays an invisible box over each one, and the
  screen makes it clickable: tap a bar and it is marked in green, and *Hear the
  passage* becomes *Start at bar 6* — the example begins there, playhead and all.
  Tap it again and the pick is let go. It is the gesture a student who has lost
  their place actually needs, and it costs nothing to offer before a take.
* **Slow practice** — ½ speed, ¾ speed, at tempo — slows the example without
  changing a note of it. The clock is scaled once, in `schedule()`, so the shaping
  (slurs, staccato, the hairpin's ramp) keeps its proportions; the playhead follows
  the audio clock, so it slows with the music. Changing speed while it is sounding
  restarts it from the same place. The metronome keeps the printed tempo: its job
  is to be the printed tempo.
* Every passage has a **seed**, so `?sight=5&seed=4471` always gives the same eight
  bars. A teacher can put one passage on a projector, or send the link to a class.
* The line sits on the staff, opens on a chord tone, steps more than it leaps,
  resolves its leaps, has one climax and cadences on the tonic — the conventions a
  human writes sight reading by.

* **Start listening** waits for your first note, then marks the passage: notes,
  intonation, pulse and stops, in the same forgiving spirit as the scales. Tempo is
  not scored and dynamics and articulation are out of reach — the card says so.
* **A stumble can be picked up again.** The score is matched to what was heard by
  *pitch*, not by the clock, so a student who freezes in bar 3 and comes back in at
  bar 5 is followed: the notes they play land on the notes written where they
  resumed. What they abandoned counts as missed, exactly as a judge would mark it —
  measured on a synthetic take: 21 of 21 notes after the gap matched their own
  place, the 9 abandoned ones counted as missed, and the take scored 85 % instead
  of 100 %. And because a stumble is not a finish, a take that is still far from
  complete is given 4.5 s of silence before it closes instead of 2.2 s, so a
  student working out where to come back in is not cut off mid-thought.
* **Going *back* to pick it up is read differently, and deliberately.** A student
  who freezes in bar 5 and starts again from bar 3 is running *backwards* through
  the page, and no monotonic alignment can follow that. So the replay is heard as
  extra notes — nothing is marked wrong or missing, because every written note did
  sound — the jump back appears in the pulse as a stop, and the take comes out a
  few points below a clean read. Measured: 0 missed, 9 extra notes, 2 stops, 91 %
  against 100 % for the same passage played straight through. The matcher also
  credits the attempt that was right: in a take where the first pass of bar 3 went
  a semitone wrong and the replay was clean, that note scored *exact* and the wrong
  attempt was filed as an extra note. That is kinder than any audition, where the
  first attempt is the one the judge heard — which is worth saying out loud to a
  student who has learned to restart as a habit.
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

**How a passage is shaped.** Eight bars are four two-bar phrases, and the notes
are not one long random walk: each phrase occupies a register, the next one *leaps*
into a different one and stays there, the third answers from below and the last
comes home for the cadence. The lift follows the level — a third at I–II, a fourth
at III, a fifth at IV, a sixth at V–VI — so the leap is never wider than the level
the passage belongs to. On top of that, steps carry momentum (a line that has just
moved a step tends to go on the same way for a note or two, which is what makes a
run of small intervals sound intended) and every leap is answered by a step back.
Measured over 120 passages a level: the line now spans 13.7 semitones at III and
17–18 at V–VI, and three quarters of the passages from III up change register at a
phrase boundary, against almost none before.

**The top of the printed range is used, now and then.** Level VI's range picture
stops at F6 — three ledger lines above the staff — and level V's at D6. They were
decoration: the melody aimed at a phrase register, never at the edge of the range,
so no generated passage ever went near those notes. Levels V and VI now climb on
purpose about one passage in six, and when they do, the second phrase lives in that
register for both of its bars with the very top note touched once (three to five of
its notes sit within a step of it) — which is what makes it read as the high point
of a phrase rather than as a stray high note. In the draw, F6 turns up
in roughly one level VI passage in ten (only the keys with an F natural can reach
it), D6 in about one level V passage in six, and `sightreading.test.html` holds
both ends of that: it has to happen, and it has to stay special.

**Level I is deliberately plain.** D major only, one octave from D4 to D5, 2/4 or
4/4, quarter and half notes with the occasional whole note, and no leap wider than
a third — the page the Manual prints for level I. A whole note alone in a bar is
centred in it, the way an engraver sets one.

**Level II adds slurs and the dotted half.** Roughly two passages in five carry a
slurred pair or three notes, and a dotted half turns up in about half of them —
filling a 3/4 bar, or taking the first three beats of 4/4. Slurs start here and get
commoner with the level: three quarters of level III passages have one, and every
passage from level IV on.

**Level III is where silence arrives too** — one rest in most passages, two now
and then — and the **kinds are the level's own**: quarter and half only at III, the
**eighth rest from IV**, the **sixteenth rest at VI and nowhere else**. A quarter
rest is the one a sight-reader meets constantly and it is placed most often; a half
rest takes two beats of the bar and turns up about half as often; the eighth rest
fills in inside a beat; and the sixteenth rest only appears inside a run of
sixteenths, where it breaks the beam. Each kind is checked from both sides — one
that should not appear must not, and one that should must actually turn up.
A half rest is only written where there is a two-beat group to hold it — 3/4, 4/4
and 2/2 — because in 2/4 it would be a whole-bar rest and in 6/8 the beat is a
dotted quarter. Levels I and II have no rests at all, and `sightreading.test.html`
counts them by kind so they cannot quietly disappear again.

**Level III is also where sixteenths arrive** — the Manual's first level that uses
them, and its figure is the one a beat of four under a beam, the same group level
VI leans on. They arrive **once in every passage**: the bar that carries the run is
chosen up front (never the fourth, which ends on a note to breathe on, and never the
last), so a student who is given a level III page is always given the figure they
have to meet — left to the draw it turned up in about a third of them, which for
any one student is the same as never. A second run is still possible, but rare: 1.07
beats of sixteenths a passage on average. From level V on the runs multiply; level
VI, whose own printed example is built from them, gets them in almost every
passage.

**Level V is where the dotted rhythm arrives** — a dotted eighth (three sixteenths
and a dot) beamed to the sixteenth that completes its beat. It is the one figure in
the ladder that is easier to *mistime* than to play, which is why the Manual saves
it for the top two levels, and it was missing entirely: the rhythm tables had dotted
quarters and triplets but no dotted eighths at all. Levels V and VI now draw it in
about two passages out of three (78 and 83 of 120), and the suite checks that
nothing below V draws one. The engraver had to learn the shape too — a lone
sixteenth inside a beam is written with a *stub* of second beam, half a space long,
pointing back into its group, and without it the second note of the figure read as
an eighth. The stub also has to follow the beam's **slope**: drawn level beside a
slanted beam it met the beam at one end and drifted away at the other, which on a
leaping figure is the difference between a second beam and a stray dash.

**Cut time is felt two to the bar, so its shortest note is an eighth.** In 2/2 a
sixteenth is not a fast note but a blur — the half-note pulse is 76, which already
puts the quarter at 152 — so level VI's beat of four sixteenths and its
dotted-eighth-and-sixteenth were wrong there even though both belong in 4/4 at the
same level. The metre is filtered at the source now: anything shorter than an
eighth is dropped from every 2/2 pattern, at every level, so no table can put one
back. Triplets stay, in the eighth-note kind only. Level VI's cut-time table gained
eighth motion in their place (4+4+4+2+2, 8+4+2+2, 4+2+2+4+4) and keeps its
triplet, and `sightreading.test.html` walks every 2/2 passage it can draw to check
both directions: nothing shorter than an eighth, and the triplet still there.

The cut-time **tempo stays where it is** — half = 76, a quarter pulse of 152, a step
above the simple metres' 88 and level VI's 120 — and that is deliberate, not an
oversight. Cut time in this app is meant to run a little quicker than the other
metres, and it can, because the metre carries no sixteenths: the page is faster
without being harder to read. Both the table in `src/sightreading.js` and the
filter's comment say so, so a later tidy-up does not "fix" the speed to match the
quarter pulse.

### Drawing the notation

Everything on the page is drawn by hand in `src/score.js`, and the glyphs that gave
trouble are the ones where a stroked line is not good enough:

* **A half rest sits on a line; a whole rest hangs from one.** They are the same
  block, and the line it touches is the only thing that tells them apart: the half
  rest rests on the middle line and fills the space above it, the whole rest hangs
  from the fourth line into the space below. Drawn straddling the middle line —
  which is how both were placed at first — a half rest reads as either.
* Rests and note flags are **filled outlines**, not strokes. The **quarter rest**
  is now a traced path too: the glyph the teacher sent was cut out of its image and
  its outline walked at 59 × 178 pixels, simplified to 50 points and scaled into
  staff spaces — 0.83 wide, 2.6 tall, so it reaches a third of a space into the top
  space and hangs as far below the second line, where a printed one sits. Describing
  it instead as a stroked curve with a width at every point (an earlier attempt)
  flattened it into a wavy "S": the printed rest is a calligraphic zigzag whose
  belly swings nearly the full width of its box, whose waist pinches to a fifth of
  it, and whose foot runs out to a needle on the right before doubling back left and
  curling down to a point. Straight segments, not a spline: every one of those
  corners is a corner.
* The **flag** is traced, not generated: `FLAG_OUTER` / `FLAG_INNER` in `src/score.js`
  are the two edges of the note the app has used as its mark since the first
  version, measured off it row by row in staff units. A centreline with a width
  could not make that shape — it produced a fin, thick where it met the stem and
  blunt where it stopped, while the approved flag is slender at the stem tip, at
  its heaviest through the turn, and trails to a hairline almost at the note head.
  The same outline draws every flag on every staff and the note in the header and
  the home-screen icons, so the logo and the notation are one glyph.
  `tests/mark.test.html` holds the shape still: it measures the rendered flag at
  thirteen rows down the stem and fails if any edge is more than 0.7 staff units
  from the approved profile.
* A **dynamic marking goes under everything**, including articulations. It is
  placed below the deepest beam and the lowest head, and — the piece that was
  missing — below any accent or staccato dot, which hang off the *bottom* of an
  up-stem note and reach further down than the head does. A low note with an
  accent under it used to put the wedge through the "f".
* **A crescendo is a hairpin, not the word.** A ramp is two lines from a point to
  an open end, spanning the beats it applies to, and it is placed at the climax —
  the highest note — because that is where a ramp means anything: drawn over a
  phrase that never goes anywhere it teaches the wrong thing. Crescendos go on the
  beats *before* the peak, decrescendos on the beats after, from level IV (and
  decrescendos from V). The mouth opens with the length of the hairpin and stops at
  two spaces, because a hairpin is read by its angle: a fixed one-space opening on a
  four-beat ramp came out as a sliver that looked like a staff line. Under three
  spaces of span there is no room for a wedge at all, and the printed word —
  *cresc.*, *dim.* — is written instead, which is what an engraver does too. The
  ramp also carries the marking it arrives at, printed just past its open end, so
  a passage reads *mp < f* rather than a wedge that opens onto nothing — and the
  playback ramps to that marking's own level, not to an arbitrary one.
* **The markings grow a rung at a time**: *mf* at levels I–II, *f* from III, *mp*
  from IV, *p* from V. Fortissimo is not in the Manual's sight-reading criteria and
  is never drawn; level VI used to be the one level that never drew an *f* at all,
  which is the sort of thing only a teacher notices. The sightreading suite pins
  both — every passage uses a marking from its level's list, and every marking in
  that list turns up within 120 passages.
* The **tempo mark** is printed over the first bar, so it is placed last: the
  system records how high its music reaches and the mark goes above that, rather
  than through a beam that opens the passage high.
* A **down-stem flag stops short of the head**, and has to. Flags hang on the
  right of their stem; on an up stem the head is on the left, so the hook can trail
  almost to the head and still pass beside it — that is the approved drawing. On a
  down stem the head is on the *right*, the flag's own side, and the full length
  puts the tail on the head's edge: the gap between stem and flag closes and the
  note reads as a knot. A lone sixteenth then puts its second flag straight through
  the head. So a flag down a stem is drawn at the length that leaves half a head of
  air below the head, which is 92 % of the hook for an eighth and about 55 % for a
  sixteenth's second flag.
* Beams are **filled quadrilaterals** built outward from `beam.at()`, which is where
  the stems end. A stroke's butt cap is cut square to the line, so slanted beams grew
  little wedges, and the second beam of a sixteenth run never sat parallel to the
  first.
* The **eighth rest** is a table of fractions of its own height, measured off a
  printed rest pixel by pixel the same way the sharp was: a bulb 0.34 of the height
  across, a stem 0.063 thick that leans 15° from upright, and a hook sweeping from
  the bulb's underside up into the stem's own tip. The white wedge between hook and
  stem is the whole glyph — close it and the rest becomes a comma on a stick, widen
  it and a 9 appears beside one. Both ends of the hook finish *inside* the bulb;
  a hook that stops on its edge leaves a sliver of tail under the ball that the eye
  reads as a beak.
* The **sixteenth rest** is traced like the quarter rest, and deliberately is *not*
  the eighth rest with a second hook bolted on — that is how it was drawn, and the
  printed one is a different animal: each of its two bulbs takes about a fifth of
  the height where the eighth rest spends a third on its one, the stem runs longer
  and a little wider towards the foot, and both hooks hang off that same leaning
  line. Its reference box is 278 × 612, and it is set 2.2 spaces tall — a fifth
  taller than an eighth rest and a shade narrower, which is what the box says.
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

Three rules fall out of the engraved look, and each is now measured rather than
hoped for:

* **A slur never passes over a rest.** A slur is one stroke of the bow, so a rest
  under it is a contradiction. The generator used to filter the rests out *before*
  choosing the run, which is exactly how a curve ended up over a silence; it now
  takes a contiguous slice of the bar and refuses any slice containing a rest.
* **A slur neither begins nor ends beside a beamed group.** Its curve is drawn on the
  far side of its own stems, and a neighbouring group's beam lies across that path.
* **A slur is a bow.** Both of its control points sit outside both of its ends, on
  one side. The side is normally opposite the stems, but that is a preference, not
  a rule: on a phone the systems are close together, and a phrase that sits high
  leaves no room above it. The curve used to be pushed down to clear the system
  above until the arc sat *between* its own ends — an upside-down slur — so the
  side is now chosen: take whichever side can hold a real bow, and only fall back
  to a shallow one when neither can. Beams are part of what a side has to clear,
  or a slur pushed to the stems' side is drawn along a beam.
* **An accidental never lands on the note before it.** Bar spacing used to allow a
  fixed 22 units for a sign, relaxed to nothing when a bar was crowded — which is
  how a sharp ended up inside the flag of the note before it. The spacing now has an
  ink floor: what the two glyphs actually occupy, flag sweep and dot included, and
  measured across the barline too. The floor may not be relaxed; the house spacing
  above it may.
* **A beat of sixteenths is spaced as a group, not by the clock.** Space used to be
  proportional to time, which gave a quarter four times the room of a sixteenth: a
  run of sixteenths came out as a dark clump with the quarter after it a whole beat
  away, and neither read at sight. Each event now takes `4 + 30·d^0.6` of room (d
  in quarter notes) — the classic engraver's curve, where short notes get more than
  their time is worth because their heads, beams and flags are what the eye is
  picking apart, and long notes give some back — plus five units of air at a beat
  boundary, which is what separates one group from the next. Measured on a beat of
  four sixteenths followed by a quarter: the sixteenths go from 24 to 30 units
  apart and the gap after the group from 24 to 39, so the bar reads as
  `sixteenths — breath — quarter` instead of a clump and a hole.
* **Systems are spaced by what they hold.** One fixed gap had to serve the worst
  case of every level at once, and on a phone it was too small: the dynamic under
  one system met the tall notes of the next, and a high phrase had no room for its
  slur. `renderScore` now draws each system once to measure how far its music
  reaches above the staff and how far its dynamics hang below, then sets each gap
  to the sum — `NARROW_PITCH` and `SYSTEM_GAP` are only floors.

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

### More than one child on one device

A family with three children sharing a tablet gets one row of names at the top of
the log, each with its own streak, its own "what was hard", its own ready
checklist and its own week sheet. A shared streak would be worse than none: the
youngest's two days would hold the oldest's run together.

* **A name is a log.** Tapping a name switches logs; the count, the grid and the
  sheet all follow. The name is also the first line of the copied lesson sheet, so
  a teacher reading three of them knows whose is whose.
* **The first name takes over the empty log** every device starts with, rather
  than leaving a "Me" nobody owns beside three children. Once that log has a day
  in it, the next name gets a new log of its own.
* **Typing a name that already exists switches to it** instead of making a twin,
  and names are trimmed and capped at 24 characters. Eight names per device.
* **A copy carries its name.** Loading Maya's file while Jonah is on screen is
  refused with "that copy belongs to Maya — switch to that name first", because on
  a shared tablet that is exactly how one child's term quietly becomes another's.
  Files saved before names existed have no name and are taken at face value.
* **Start over** empties the log on screen and keeps the name and the other
  children's work untouched. Removing a name (in *Rename or remove a name*) is the
  only thing that deletes a log, and it asks first.
* A device from before names keeps its data: the old single log migrates to the
  first profile on load, with nothing lost.

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

### Keeping it

The logs are held in `localStorage` under `scale-studio.journal.v2` (one entry per
name, plus which one is on screen) and are per device
and per browser, so a student's log on the school iPad and the one at home are two
different logs. That also means four things can take it away:

* **Clearing the browser's website data** — the normal "clear history and data" —
  deletes it, and so does a private window.
* **Safari on iOS** caps storage for sites it has not seen for seven days. Adding the
  app to the home screen exempts it.
* **A different browser is a different log**, even on the same laptop.
* **Some browsers refuse to store anything at all** (a locked-down school Chromebook,
  for instance). The screen says so in a quiet banner instead of letting a term of
  practice disappear at the next reload.

So the log can be **saved to a file and loaded back**:

* *Save a copy* writes `scale-studio-practice-log-YYYY-MM-DD.json` — a small JSON file
  with an envelope (`app`, `kind`, `saved`) around the state, so a wrong file is
  recognised rather than half-imported.
* *Load a copy* merges it in: days, rest days and scale days are a **union**, takes
  are the **larger** of the two rather than the sum, and the plan is only taken when
  there is not one already. That makes loading idempotent — loading the same file
  twice, or an old copy after the log has moved on, cannot inflate a week.
* The file is read before the picker is emptied again, so a slow read cannot come
  back empty.

That is the whole backup story: one file, no account, no server. It is also how a
student carries a log between the practice room and the lesson.

## The icon

The home-screen icon, the Apple touch icon and the 160 px note in the header are all
the same eighth note the score is drawn with: `noteMarkSvg()` in `src/score.js` is
the one source, and `tests/icon-build.html` builds every PNG in `icons/` from it.
There is no separate drawing that could drift away from it — the header mark used
to be one, a 160 px raster kept alongside the vector, and it drifted: its flag was
a different curve from the one on the staff.

Two rules here, both learned the hard way:

* **Full bleed, no transparency.** iOS applies its own rounded-rectangle mask to
  whatever it is given. The first icons shipped with rounded corners and transparent
  outside them, so iOS rounded an already-rounded square and the corners showed
  through as dark notches — which is what made the home-screen icon look wrong.
  Every icon is now an opaque square of `#2f5d4e` with the note centred, and the
  platform does the rounding.
* **The note is a vector.** Every PNG is rendered from the SVG at 1024 and
  downsampled, so the 512 and the 180 are both crisp, and the header's 160 px mark is
  the same render rather than a drawing of its own.

To rebuild after changing the note, run `tests/icon-build.html` through
`tests/lab-server.ps1` and save what it POSTs: it renders the note at 1024, crops
to the ink, and writes `mark.png` (the crop at 160 px) plus the tiles at 70 % of
1024, 512 and 180 (56 % for the maskable one, which keeps it inside Android's safe
circle) — centring each on the green. Then run `tests/mark.test.html`, which guards
the shape three ways: whole and unclipped, note-shaped by aspect, and — row by row
down the stem — the flag edges the teacher approved, so a redrawn flag fails the
suite instead of quietly shipping. It also checks that `mark.png` still shows the
vector, so a stale header is caught too.

## For the teacher: recording the playback voice

The sight-reading screen is getting a *hear it* button: press it and the passage
plays, so a student can hear what they are about to read. It will not synthesise a
tone — an oscillator sounds like a keyboard even through a hall — it will play a
real violin: the teacher's own, recorded once. `capture.html` records that voice;
the playback itself is the next piece of work, and these are the files it needs.

`capture.html` is the tool that records it (`http://localhost:8777/capture.html`
locally, or the same path on the published site). It is **English only on purpose**:
it is a setup screen for an adult with a microphone, not a student screen, and the
long instructions are easier to keep honest in one language.

Seventy-two takes, in six passes:

| Pass | Takes | What |
|---|---|---|
| Smooth bow · medium | 18 | détaché, two seconds, even, at *mf* — the reference level |
| Smooth bow · loud | 18 | the same notes again at *f* — the loud layer |
| Smooth bow · soft | 18 | the same notes again at a real *p* — the soft layer |
| Short notes | 5 | staccato: a quarter of a second, stopped on the string |
| Accents | 5 | a hard attack, then let it ring |
| Slurs | 8 | two notes in one bow, the second with no new attack |

The smooth-bow ladder is **one sample every whole tone** from G3 (55) to F6 (89),
the full range the passages use. Whole tones, not semitones: playback stretches a
sample by at most a semitone, which is the point at which a stretched violin starts
to sound pinched, so a sample per semitone would double the session for nothing.
The dynamic layers are separate passes rather than a take per note per level — a bow
arm holds one level far better across eighteen notes than across fifty-four
alternations.

**The soft layer is recorded, not turned down.** The obvious cheap way to get a
piano is to scale an mf sample's gain, and it is the one that sounds wrong: a
violin played softly is *darker and slower to speak*, not merely quieter — less
weight in the bow, a slower stroke, and a contact point nearer the fingerboard
thin out the top of the sound in a way no gain change can imitate. A scaled-down
mf reads as "pressed, but hushed", which is the tell of a fake instrument. Three
layers is where small libraries stop for exactly this reason; the sampler will move
between neighbouring levels by gain, which is close enough over a step of loudness
and never has to invent a timbre from nothing.

The soft pass comes **last** on purpose: it takes the most control, so it is left
until the arm is warm and the ear has just heard what mf sounded like. If a whole
session is too much, the medium and loud passes can be recorded and downloaded
first and the soft pass added in a second sitting. A zip only carries the takes
that were kept, and both manifests key on the same take ids, so merging them is a
few lines of work whenever the samples actually arrive.

Each card prints the take with the app's own engraver (`renderBar()` in
`src/score.js`), so what is recorded is exactly the shape the playback has to
produce — the staccato card carries its dot, the accent its wedge, the slur pairs
their curve. `space` starts and stops a take, `enter` keeps it, `h` hears the pitch.
The page trims the silence, fades 6 ms at each end so no take clicks, and warns when
a take clips or barely registers.

Everything is held in the tab and handed back as one zip: 16-bit mono WAVs named
`G3-smooth-mf.wav`, `A4-B4-slur.wav` and so on, plus a `manifest.json` carrying each
take's pitch, style, level, length and peak. **Nothing is uploaded anywhere**, and
closing the tab throws the takes away — download first.

## The recorded voice

The first set of takes is recorded, measured and shipped: 36 files, 800 kB, in
`samples/` with an `index.json` beside them. `src/sampler.js` plays them; the
synthesised string in `src/playback.js` answers only for notes the set cannot cover.

**Building a new set from a zip** is a fixed four-step job, done once per recording
and never at run time: split the recorded slur pairs into their landing halves;
measure each take's mean pitch, RMS and onset; compute loop points from the
measured pitch; encode to 44.1 kHz mono AAC and write `index.json`. Nothing in that
chain is app-specific, so a later zip of *f* and *p* takes becomes another six
entries a note and the sampler prefers the real layer without a line changing.

**The takes were in tune per note, not with each other.** Measured against equal
temperament they sit between **27 cents flat and 23 cents sharp** — normal for a
human, fatal for a sample set, because played one after another the instrument would
sound like it cannot tune. So each entry carries its own `cents` and the playback
rate is shifted by exactly that much; the vibrato then moves around a true centre
instead of around a wrong one. The figure is the **median of the pitch frame by
frame**, not the mean of the whole take: with a vibrato 50 cents wide the mean
depends on where the player lingers, and the median is the centre the ear hears. On
the first pass the whole-note mean was used and some takes came out up to 8 cents
low, which the teacher heard.

**One deliberate offset sits on top of the measurements.** The teacher's ear said
the A takes sat a little low, so A3, A4 and A5 carry `tune: 8` — eight cents high,
the same thing a soloist does to the A string, and written into the index rather
than edited into the files, so it can be changed without re-recording anything.
`sampler.test.html` holds all of it: every corrected pitch lands on its own offset
within a hundredth of a cent, and only the three A takes carry one.

**The takes were not all played at the same level.** RMS differs by nearly 5 dB
across the set, so each entry carries a `gain` that flattens it to the median. That
is also why the recording page's "barely registers" warning means nothing here: the
quiet notes are quietly *recorded*, not badly recorded.

**Loud and soft are made from the mezzo-forte takes**, as asked — but with the
timbre nudged as well as the level, because a violin that is only turned down stops
sounding like a violin. `LEVEL_GAIN` sets the loudness (p ×0.45 … ff ×1.6) and
`LEVEL_TILT` shapes it: the soft layer is low-passed at 2.4 kHz with its top pulled
down 4 dB, so it is darker, not just quieter; the loud layer gets a 3.5 dB shelf up
at 1.6 kHz, so it has the edge of a forte. This is the one thing in the set that is
an impression rather than a recording — real *f* and *p* passes replace it the day
they exist, and nothing else has to change.

**The vibration you played is kept.** For a held note a recording with vibrato is
better than one without: it is what a student should hear, and it survives the
semitone of pitch-shifting the set needs. Two things to listen for, though. The same
pitch played twice uses the same take, so the vibrato repeats exactly — if that ever
sounds mechanical, the fix is to alternate between the two nearest takes. And a
sixteenth note is too short to show any vibrato at all, which is right: the sample
starts with the bow's own attack, and the vibrato has not developed yet.

**Articulations come from the takes recorded for them.** A staccato note uses a
staccato take when one is within three semitones (they were recorded every six, so
that covers the whole range), an accented note uses an accent take, and a slur's
second note uses the **landing half** of a recorded slur — the second note split out
of the pair, with no attack of its own, which is precisely what "one bow" means.

**Long notes loop.** A whole note at level I is four seconds; the takes are under
two. Each sustained take carries loop points measured as two positive-going zero
crossings an integer number of periods apart, so the join lands where the waveform
is silent and the loop cannot click.

**The files** are 44.1 kHz mono AAC at 96 kbps — 22 kB a take, 800 kB for the set,
which is fetched once while the student is reading the page. AAC rather than Opus
for one reason: iPhone and iPad. It was checked by decoding every file back to PCM
and comparing with the original: identical length, identical onset, 0.9995
correlation over the attack.

**A short note rings.** A staccato take is 0.4–0.6 s long and most of that is the
note's own ring: the bow has already stopped by then and the sound is dying away.
The voice used to cut the take at the written length — 70 ms for a staccato
sixteenth — which is what made every dotted note sound clipped. A short note now
lets its staccato take end by itself and simply runs under the next note; measured,
0.42 s instead of 0.07.

But not for as long as it likes. The teacher's next note on this was that the
dotted-eighth-and-sixteenth figure sounded *too* long, and the culprit was the
sixteenth: its written slot is 0.17 s, so a 0.42 s ring ran it a whole beat into the
music and the pair stopped reading as dotted-short. A ring is now capped at **one
and a half times the written length** — the sixteenth rings 0.26 s, the dotted
eighth before it still gets all 0.42 — so the note keeps a natural tail without
giving up its rhythm. A short note that has to borrow a *sustained* take is still
cut, because a sustained take has no ring to give and would only be a long note in
the wrong rhythm. `noteShape()` in `src/sampler.js` is the one place that decides
this, and `sampler.test.html` holds both halves of it.

**The set is lifted 16 dB on the way out.** The takes were recorded with a lot of
headroom — peaks between −25 and −13 dBFS, because the recording page asks for
"peak in the green" — so at first the example was about 20 dB quieter than the
metronome at the same slider position, which is what the teacher reported. Their
room tone sits 42 to 49 dB below the note, so the lift puts the noise floor around
−55 dBFS and is inaudible; `BANK_GAIN` in `src/sampler.js` is the one number that
sets it. The dynamic ladder is the sampler's own (`LEVEL_GAIN`), and a hairpin comes
through as a ratio on top of it — using the synth's absolute gains as well would
have counted every dynamic twice and made a piano 11 dB below a mezzo-forte.

## Offline

The app keeps itself on the device. A service worker (`sw.js`) caches the page and
the fourteen modules it imports the first time it is opened, and after that every
screen works with no connection at all — the scoring, the tuner, the sight-reading
generator, the practice log: none of them ever needed a server.

The **recorded violin is not cached with the shell**. It is 800 kB against the
shell's 200, and a student who never uses sight reading should not carry it. It is
fetched the first time something asks to hear a passage, and a teacher preparing a
classroom of tablets can press **"Store the violin on this device"** in *How it
works*, which fetches all 36 takes with a progress count and says when it is done.
If the takes are missing when a passage is played offline, the synth covers them —
a quieter app rather than a broken one.

Three things are deliberate:

* **The version moves with the stamps.** `sw.js` caches under a version string that
the publish step sets to the same number as every `?v=` in the HTML. Drift between
the two is silent and nasty — the page asks for files the cache calls something
else, and a student keeps last month's app — so `offline.test.html` fails if they
disagree, and also fails if the shell list names a file that is not there (a
missing file makes `addAll` reject and the install never happens, without a word).
* **A new version waits, and the page says so.** No `skipWaiting`: taking over
mid-session would swap the code under a running page. The page shows a quiet strip
at the foot — *A newer version is ready · Reload · Later* — and only then does the
worker take over.
* **The page is revalidated in the background.** The shell is served from the cache
instantly, and a navigation refreshes it when there is a connection, so an online
teacher gets the current drawing of a passage even before the worker turns over.

**What is not tested here.** Whether a worker really takes over and fills its cache
cannot be measured in this headless setup: the browser runs on a virtual clock and
the install's fetches never advance it — the same wall the audio decode hits. That
part is checked by hand on a real device in airplane mode, which is how a teacher
will meet it anyway.

**iOS.** Safari can clear caches for a site that has not been used for about a week
— unless the app has been added to the home screen, which the manifest already
supports. So the classroom instruction is: add it to the home screen, and it stays.
The practice log lives in `localStorage` rather than the cache and is unaffected;
the log's download/load-a-copy file remains the way to move a log between devices,
because offline is not sync.

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
capture.html          for the teacher: records the playback voice (see below)
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
src/journal.js        practice-log rules: streak, rest days, ready scales, week sheet,
                      and the save/load copy format
src/recorder.js       in-memory recording and the synthesised hall
src/capture.js        the sample-recording tool: take list, trimming, WAV and zip
src/playback.js       hearing the passage: the schedule, the player that drives the
                      playhead, and the synthesised fallback voice
src/sampler.js        the recorded violin: which take covers a note, the tuning
                      correction, the derived loud and soft layers
samples/              the recorded takes (36 m4a files) and index.json, which carries
                      each take's measured cents, gain, onset and loop points
tests/sampler.test.html   the sample set and the voice's arithmetic: every whole tone
                      present, every take's tuning corrected to within 0.01 of a
                      cent, articulation takes used when they are close enough,
                      and the dynamic ladder in order
src/app.js            screens, microphone, results
tests/dsp.test.html   synthesised-audio tests for the detector and scoring
tests/sightreading.test.html  720 generated passages against the level rules
tests/onset-probe.html  can a bow change be heard? (parameter sweep)
tests/rhythm-probe.html why repeated notes merge today
tests/ui.test.html    click-through smoke test, including the mock-audition draw
tests/stem-audit.html  reads the drawn SVG back: every stem on its head's correct
                      side, every beam ending on a stem
tests/notation.test.html  renders 540 passages — 60 a level four bars to a system,
                      30 a level two to a system, because a phone's page is a
                      different drawing with less room in it — and measures the ink:
                      no rest, slur, flag, dynamic, tempo mark or tuplet number may
                      touch another glyph, no flag may cross a note head, no two
                      note heads may touch, every slur must bow on one side of both
                      its ends, a half rest must sit on the middle line while a
                      whole rest hangs from the fourth, every rest's ink box must
                      still match the table it was measured into, the gap after a
                      beat of sixteenths must be at least 1.2× the gap inside it,
                      and every hairpin must be two lines that meet at a point, open
                      the way its name says, and sit in the dynamic lane.
                      Where a box would cry wolf it measures the drawing: a flag
                      against each head's ellipse, a wide slanted path (a beam)
                      against the text, and two heads against each other in the
                      ellipse's own frame.
tests/i18n.test.html  translation coverage: no visible English left on any screen
tests/journal.test.html   the log's arithmetic — streaks, two rests a week, ready
                      scales — and its save/load copy format
tests/recorder.test.html  measures the synthesised hall: it decays, and it is stereo
tests/playback.test.html  the playback's arithmetic — when every note sounds, how
                      loud, whether a slur continues the bow, where a hairpin ramps
                      — and that the voice takes every shape without throwing
tests/capture.test.html  the recording tool's arithmetic: every whole tone in the
                      range at both levels, the WAV header and sample scaling, the
                      zip's CRC and directory, and the notation each card prints
tests/mark.test.html  the icon's note is whole, note-shaped, unclipped, and still the
                      flag the teacher approved — thirteen rows down the stem — and
                      mark.png still shows it
tests/icon-build.html builds every PNG in icons/ from the vector and POSTs them
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

The same file covers the copy format: a saved log reads back with its takes, rest days
and scores intact; junk, someone else's JSON and an envelope with no log inside are
all refused; and merging a copy twice gives the same result as merging it once, so a
double click cannot double a week.

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
