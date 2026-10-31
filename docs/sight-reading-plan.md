# Sight reading — what it would take

> **Status.** Phase 0 (can a bow change be heard?) and Phase 1 (generator +
> notation + tempo preview) are built, and so are listening and scoring: the take
> starts on the first note, a needle shows the intonation as you play, and the
> passage is marked for notes, intonation, pulse and stops. Phases 4–5 — weakness
> memory and a mock audition that hides the needle — are not built. The screen says
> what it cannot hear rather than pretending.

A sight-reading trainer is not a "nice to have" for this app; it is the one NYSSMA
component the app currently cannot help with at all, and it is the one students
most often lose points on. The good news is that roughly two thirds of the machinery
already exists. The bad news is the two specific pieces that do not are the two the
feature depends on.

This document is a plan, not a promise. Nothing here is built yet.

---

## 1. What is already in the box

| Piece | Where it lives | Reusable for sight reading? |
| --- | --- | --- |
| Pitch detector (YIN, ±10¢) | `src/pitch.js` | **Yes, unchanged** |
| Note segmentation, cents per note | `src/analyze.js` | **Partly** — see §2 |
| Alignment (extra/skipped notes cost only their slot) | `src/analyze.js` | **Yes, reuse** |
| Stop / gap detection | `src/analyze.js` | **Yes** |
| Staff rendering, key signatures, accidentals | `src/staff.js`, `src/music.js` | **Extend** — no durations yet |
| Gentle feedback + grade bands | `src/analyze.js`, `src/i18n.js` | **Yes, new tips** |
| Bilingual text, tests, deploy | `src/i18n.js`, `tests/`, GitHub Pages | **Yes** |

The important structural point: `analyzeTake(frames, expected)` takes anything with a
`.sequence` of notes. A sight-reading passage is *exactly* that shape. So the day a
melody exists as data, the intonation half of the report works.

---

## 2. The experiment I ran first (and what it says)

`tests/rhythm-probe.html` synthesises passages with a violin-like tone and pushes them
through the real detector. Current output:

| Case | Result |
| --- | --- |
| Eight repeated A4s, detaché, 40 ms between bows | **1 note found**, 2.52 s long |
| Eight repeated A4s, legato | **1 note** |
| Half + 2 quarters + 4 eighths, pitches changing | 7 of 7 found, correct boundaries |
| Same passage through the *scale* scorer | `steady 0% · bpm 182` — nonsense |

Two conclusions, both important:

1. **The detector separates notes only on silence or a pitch change.** A repeated
   note — the most common thing in a sight-reading line, and where students most
   often fudge the rhythm — is invisible today. The gap between two bow strokes has to
   be long enough to drop two consecutive 30 ms frames below the noise gate, and a
   normal detaché does not.
2. **The current scorer must not be reused as-is.** It assumes every note is a quarter
   note, so a correctly played half note reads as "the pulse wandered".

So the work is not "point the scale trainer at eight bars". It is:

* a **new onset detector** (energy dip + attack noise burst), which is what hears a
  bow change even when the pitch does not move;
* a **new, rhythm-aware scorer** that knows a half note is *supposed* to last two
  beats.

Both are solvable. Neither is a one-liner. Everything else in §3 builds on top.

### The bow-change experiment (Phase 0, done)

`src/onsets.js` finds a bow change by looking at the band above 4–6 kHz — where bow
noise lives and a violin's harmonics are weak — and asking how fast that band *rises*.
`tests/onset-probe.html` sweeps the parameters against synthetic playing:

| Case | Found | Timing error |
| --- | --- | --- |
| Eight repeated A4, detaché, 40 ms gaps | 8/8 | 3 ms mean, 5 ms worst |
| The same at the 16 ms hop a running app can manage | 9/8 (one stray) | 14 ms mean |
| Eight repeated A4, legato — no gap, 30 % dip | 8/8 | 3 ms |
| A phrase that changes pitch | 7/7, no false onsets | 3 ms |
| Six eighths in 6/8 at 250 ms spacing | 6/6 | 10 ms |

Two things follow. A bow change is comfortably audible — 3–5 ms is a sixtieth of a
beat at any sight-reading tempo. And the parameter search was honest about the
first two attempts being wrong: a first-difference "high band" and a one-pole
filter both failed, because a 3 kHz harmonic of an A4 leaks straight through them.

The stray onset at the coarse hop is left alone: the scorer's alignment absorbs an
extra event by design, and these numbers come from synthetic audio, not a violin.
Real recordings should re-tune `sensitivity` before anything is graded.

### What is built (Phase 1, done)

* `src/sightreading.js` — the level table transcribed from the Manual, a seeded
generator, and the musical rules (open on a chord tone, step more than leap, resolve
a leap by step, one climax, cadence on the tonic, stay inside the level's interval
vocabulary and range).
* `src/score.js` — eight bars on two systems of four, with clefs, key and time
signatures, a tempo mark, beams, dots, rests, accidentals, articulations, dynamics.
* A screen with six level tabs, **New passage**, **Hear the tempo** (two bars of
clicks), and the passage printed at its own tempo. `?sight=5&seed=4471` reproduces
one passage exactly, so a teacher can give a class the same eight bars.
* `tests/sightreading.test.html` — 720 generated passages across all six levels,
checked for bar arithmetic, range, cadence, opening chord tone, interval vocabulary,
keys and meters, and seed reproducibility. It caught three real bugs: the key
signature was read off the wrong field (so every key came out as C), the cadence
search never moved, and the melody climbed to the top of its range instead of
sitting on the staff.

---

## 3. What the microphone can and cannot judge

This is the honest table, mapped to the columns of the NYSSMA sheet.

| Column | Judged? | How | Confidence |
| --- | --- | --- | --- |
| Correct notes, right order | Yes | pitch track + alignment (exists) | high |
| Intonation | Yes | cents per note (exists) | high |
| Rhythm / pulse | Yes, new scorer | onset times against the notated grid, measured *relative to the student's own beat* | high |
| Rests | Yes | sound where the page says nothing — a classic sight-reading slip | high |
| Stops | Yes | exists | high |
| Tempo | Estimated, **not scored** | §5 | high |
| Staccato vs detaché vs legato | Partly | sounding-time ÷ notated-time: staccato ≈ 40–60%, detaché ≈ 85–95%, legato ≈ 100% with no gap | medium |
| Slurs | Indirectly | "did the notes under the slur join without a gap" — which is the thing that actually matters | medium |
| Martelé | Weakly | attack sharpness + silence before the stroke. Too unstable to grade fairly | low |
| *mf* / *f* / *ff* | **Relative only** | loudness against the student's own median, never an absolute level | medium |
| cresc. / decresc. | **Relative only** | does the loudness *rise* across the marked bars | medium |

Two caveats worth writing on the wall:

* **Absolute dynamics are unmeasurable.** Mic distance, input gain and the room decide
  the number, not the bow. Only "was bar 6 louder than bar 2" is a real question.
* **iOS auto-gain.** iPhones and iPads apply automatic gain control, which actively
  flattens exactly the thing a crescendo measures. On a tablet, dynamics advice should
  be quieter or off.

**Proposal:** notes, intonation, pulse and flow decide the score. Articulation and
dynamics are *reported as advice and never weighted*. A student should not lose points
because their laptop has a cheap microphone — that is not a judgement a teacher would
make either.

---

## 4. Generating the passage

Eight bars, monophonic, generated from a per-level table transcribed from the Manual.

### 4.1 The level table

From the sheet (needs confirming — see §8):

| Level | Keys (cumulative) | Time | Tempo | Range | Intervals | Adds |
| --- | --- | --- | --- | --- | --- | --- |
| I | D | 2/4, 4/4 | ♩=60 | D & A strings, 1st pos. | 2nds, 3rds | quarters, halves; detaché, legato; *mf* |
| II | + G | + 3/4 | ♩=72 | G, D, A strings; no high 3rd | same | eighth pairs |
| III | + C, F | same | ♩=80 | all strings, 1st pos. | + 4ths, 5ths | staccato, martelé; *f*, *ff* |
| IV | + B♭, A | + cut time | ♩=88, half=76 | G3 to high D on E | all within an octave | dotted rhythms, rests |
| V | + E♭ | + 6/8 | ♩=60, dotted-♩=60 in 6/8 | same | same | triplets; *mp* |
| VI | + E, A♭ | same | ♩=72, ♩=120, dotted-♩=72 in 6/8 | G3 to high F on E | same | syncopation |

### 4.2 Making it sound like music, not dice

A random walk inside the level's rules still looks like an exercise. The generator
needs the conventions a human would follow:

1. Open on a chord tone — tonic or dominant.
2. Bar 4 may close on the dominant; the last bar closes on the tonic, on a long note.
3. Weight steps heavily. The level's interval list is a *permission*, not a target:
   2nds common, 3rds occasional, 4ths/5ths rare and never two in a row.
4. After a leap, move by step in the opposite direction.
5. One climax, around bars 5–6, approached by step.
6. No pitch three times in a row (except at Level I where it is good practice).
7. Stay inside the level's string/position box, so nothing needs a shift.
8. Avoid the same rhythmic figure more than twice in a row.
9. Rests land where a phrase breathes, not mid-word.

### 4.3 Seeded

`seed → passage`. One seed reproduces one passage exactly. A teacher can say "Level V,
#4471" and the whole class reads the same eight bars; a student can retry *the same*
passage instead of getting a new one, which is how sight reading is actually practised.

### 4.4 "Lean on my weak spots"

Keep a tally, in `localStorage`, of the categories a student keeps missing: leaps,
dotted rhythms, syncopation, triplets, accidentals, rests, staccato, 6/8, keys with
many accidentals. When they tap **Focus on my weak spots**, generation weights those
cells about 3×. The passage says why: *"this one leans on dotted rhythms and 4ths."*

No account, no upload — the same promise the rest of the app makes.

---

## 5. Scoring it the way a judge would

1. **Onsets.** Pitch change (exists) + energy dip and attack burst (new) → events
   `{ start, end, pitch, voicedFraction }`.
2. **Find their pulse.** Search 40–160 bpm for the beat that makes the most onsets sit
   on the grid. This is a cheap one-dimensional search.
3. **Align** events to the notated grid with a DP that costs pitch mismatch *and*
   timing error, so one extra note costs one slot and does not smear the rest.
4. **Score:**

| Component | Weight | Measure |
| --- | --- | --- |
| Notes | 45% | right pitch, right order |
| Intonation | 20% | cents from centre, ±15¢ is fine |
| Pulse | 20% | onset error as a *fraction of a beat*, at the student's own tempo |
| Flow | 10% | stops, and sound during notated rests |

5. **Tempo is not scored.** This is the important one. A student who reads it steadily
   at ♩=62 when the page says ♩=88 has done the hard part; judges mark the pulse, not
   the metronome number. Only when the tempo is under about 60% of the mark is there
   one gentle line: *"the notes are secure — next time, try to let it move."*

6. **Point at the bar.** The alignment knows where each error sits, so feedback can
   say *"bar 5, beat 2 — the leap to the high D arrived early"* instead of a percentage.
   That is worth more to a student than any score.

Wording stays in the app's voice: name what happened, name one thing to do, never
scold. `tip.*` keys in `src/i18n.js` already work this way.

---

## 6. Drawing it

The current staff draws pitches, key signature and accidentals — no durations, no
barlines, no beams, no rests. Eight bars of real notation needs:

* barlines, a time signature, a tempo mark
* note values: whole, half, quarter, eighth, dotted
* beams for eighths (and triplet brackets at V–VI)
* rests: quarter, eighth, half
* articulations (staccato dot, accent), slurs, dynamics text

Two ways:

**a) Extend `src/staff.js`** (~500–700 lines). Keeps the app's own look — the same
treble clef and note heads as the scale staves, which matters because the two screens
will be seen side by side. Everything is hand-drawn SVG, no dependency, no download.

**b) VexFlow.** A mature notation engine; beams, dots, rests, slurs and dynamics come
free. But it brings its own font (Bravura) and a ~400 KB dependency, and its staff
will not look like the app's current staff.

**Recommendation: (a), with (b) as the escape hatch** if the beams fight back. The
first three levels only need quarters, halves, beamed eighth pairs and quarter rests —
that is a day's work, not a week's. Triplets and syncopation at V–VI reuse the same
primitives.

The result screen can reuse what already exists: colour the notes *on the passage
itself* by how each one landed, exactly like the scale result does today.

---

## 7. Where it plugs in, and in what order

Each phase is useful on its own, which matters — if the listening part needs another
round of tuning, Phase 1 is still a teaching tool.

| Phase | What | Usable when finished | Risk |
| --- | --- | --- | --- |
| **0. Spike** ✅ | Onset detection on real bow changes | done — see above | — |
| **1. Generator + notation + tempo preview** ✅ | Level tables, seeds, 8 bars drawn on screen, "hear the tempo". No microphone. | **yes — a sight-reading *generator*** a teacher can project or print from | done |
| **2. Notes + intonation** | Feed the passage to the existing report: right notes, wrong notes, cents per note, coloured staff | yes | low |
| **3. Pulse + flow** | Beat estimation, rhythm scoring, rest/stop detection, bar-and-beat feedback | yes — the full idea | medium |
| **4. Shape + memory** | Articulation and dynamics *advice*, weakness tally, "focus on my weak spots" | yes | low |
| **5. Chinese + polish** | The whole thing through `src/i18n.js`, tests, deploy | yes | low |

Phase 0 is the one that decides the shape of the feature. If a 40 ms bow change
cannot be heard reliably, the fallback is a generator that avoids unbroken repeated
notes until the detector improves — the trainer still works, it just grades a slightly
easier repertoire.

---

## 8. Questions I need a teacher to answer

1. **The rhythm cells per level.** The sheet's little staff snippets are too small to
   read reliably at this resolution. In words: what does each level *add*? (My reading:
   I quarters/halves; II eighth pairs; III 4ths and 5ths with staccato/martelé;
   IV dotted rhythms, cut time, rests; V triplets, 6/8; VI syncopation.)
2. **Level IV range: "Low G to high D on the E string."** Is that G3 up to D6 — i.e. the
   student is expected to shift? And Level VI "high F on E" = F6?
3. **Cut time at Level IV: "♩=88, dotted=76."** Is 76 the half-note pulse (so a quarter
   would be 152), or is the printed quarter mark 76?
4. **Does the passage ever repeat?** Repeats and second endings would change the page
   layout and the timing model.
5. **Level II: "No high 3rd finger."** Does that mean the A-string D5 is out of range at
   II, or simply that the line avoids the high-3rd shape?
6. **Should the last bar always land on the tonic?** And are all the sight-reading
   examples major, as the key list suggests — no minor?
