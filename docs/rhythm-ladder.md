# The rhythm ladder — why it goes in this order

This page records the thinking behind the Rhythm mode. It is not a second copy of
the screen; the rules live in `src/rhythm.js` and the screen in `src/rhythmview.js`.

## How the mode works

The mode is a call-and-response cycle: hear one bar, answer it, and let a bar you
fumbled come back. The sounds are made with oscillators and the screen is drawn
here; no recording or outside code ships with it. The rules:

* one bar heard, one bar answered, with a two-bar count-in;
* an answer capped at the length of the example, so a pattern cannot sprawl;
* a target window that reaches halfway to the next written note, so every heard
  attack belongs to exactly one target;
* a match needs the attack to be close *and*, where the previous note was also
  matched and closer than a quarter, the gap to be close too;
* a failed bar comes back, up to six times, before the runner moves on;
* each bar has a private level from −2 to +2; a pass raises it, a fail lowers it,
  and the weakest bar is chosen next;
* the exercise ends when every bar is mastered, when it is clearly too easy, or
  at 24 answers, and the tempo steps up on clean work and down on a run of fails.

Three things were changed for a violinist on the web:

1. **No voice.** Every sound is a woodblock-style tick: accent on the bar, a
   beat in the middle, a softer tick on subdivisions. Pitch is not marked.
2. **Shorter, ordered ladder.** That app's 80-odd figures become ten rungs, each
   with a small family of figures and its own tempo ceiling.
3. **Interval-aware from the start, not only when "strict".** The gap check is
   what keeps a displaced-but-steady bar alive; the strict flag only halves its
   tolerance for the figures that are easier to mistime than to play.

## What a violinist needs first

Rhythm on a violin is a right-hand skill before it is a reading skill. The
progression therefore moves through the bow before it moves through notation:

| Rung | Demand | Why here |
| --- | --- | --- |
| 1. Pulse and whole bow | quarters and halves, down/up alternation | a steady pulse and a planned bow lane are the floor under everything else |
| 2. Long and short bows | halves against quarters, rests to plan | bow distribution: long note, long bow; short note, short bow |
| 3. Detaché eighths | two eighths in a beat | one bow per note, same speed, middle of the bow |
| 4. Rests and offbeats | bars that open in silence, up-bow offbeats | counting through silence; the offbeat is the commonest place an up bow is faked |
| 5. Eighths among quarters | pulse kept through short notes | returning to a full bow after subdivision |
| 6. Sixteenths | four to a beat | one lane of the bow, sautillé or light legato |
| 7. Dotted rhythms | long-short and short-long | the figures that are rightly treated as strict |
| 8. Triplets | three in the time of two | extrametric feel, slurred rather than three pushes |
| 9. Syncopation | accents between the beats | contrametric placement with the foot still moving |
| 10. Reading mix | two bars, every figure met so far | the figures interleaved, not blocked |

The order follows the metric classes used in rhythm pedagogy — metric,
intrametric, contrametric, extrametric (see the Wikipedia *Rhythm* article under
"Unit and gesture") — and the bowing list follows the standard right-hand
vocabulary of détaché, sautillé and bow division described in *Violin technique*.
It also matches the rhythm ladder the app already uses for NYSSMA sight reading:
quarters and halves at I–II, eighths at II, rests and dotted rhythms at III–IV,
triplets at V, syncopation at VI (`src/sightreading.js`). The mode is narrower
than that ladder on purpose: one new demand a rung, not three.

## Random bars, not random noise

Bars are built from metre-specific templates. A template is a whole bar of
cells; a cell is a plain note, a rest, or a **figure slot** the length of the
figure it will hold. Stage 3's `f` slot is one beat, so it can only take two
eighths, an eighth and a rest, or a rest and an eighth. Stage 7 has an eight-tick
slot for the dotted quarter and its eighth. Stage 8 has a twelve-tick slot for a
whole 6/8 bar of triplet eighths.

That gives variety without illegal bars: the arithmetic is checked by
`tests/rhythm.test.html` over two hundred seeds a rung. A filled weak-spot map
weights the figures the player has fumbled; the figure just played sits out a
turn. The first bar drawn always opens on the downbeat, except on the two rungs
where opening in silence *is* the lesson.

## Honesty

What is judged is the attack, not the note. A slide, a shift or an out-of-tune
note does not lose the bar by itself. The microphone gate, the high-band bow
detector and a pitch confirmation all have to agree before an attack counts, so
the click track is not mistaken for playing. The output latency of the device is
measured by the Calibrate pad (a median of eight taps) and applied in ticks; a
phone speaker will need a larger offset than headphones.

The mode cannot hear bow direction, weight, contact point, or whether the string
was crossed cleanly. Those stay with the teacher, and the on-screen chevrons are
a plan rather than a score.

## Sources

* NYSSMA level tables already transcribed in `src/sightreading.js` and
  `docs/sight-reading-plan.md`.
* *Rhythm*, Wikipedia, "Unit and gesture" (metric / intrametric / contrametric /
  extrametric).
* *Violin technique*, Wikipedia, "Bowing techniques" (détaché, sautillé, bow
  division and the right hand's role in rhythm).
