# Why the sight-reading passages sound the way they do

The level table in `src/sightreading.js` says what a passage must contain: the
keys, metres, range, rhythms, rests and largest interval of each NYSSMA level.
Many different passages satisfy it. The generator leans its random choices
towards the ones that sound like a tune. Nothing below changes what a level
contains; it changes which notes tend to be drawn inside those limits.

| Lean | What it does | Why |
|---|---|---|
| Small intervals, both ways | Steps are drawn far more often than leaps, going down as readily as up | Melodies in most repertoires are mostly small intervals (pitch proximity) |
| A leap is answered | After a leap the line steps back the other way | The "gap-fill" habit of tonal melody; statistically it is largely a leap towards the edge of the range coming back to the middle |
| Step momentum | A stepwise line tends to keep going the same way; sixteenths more so | Listeners expect small intervals to continue in the same direction |
| Phrases with a shape | Four two-bar phrases, each with its own register and an arch inside it; one highest note | The arch is the commonest phrase contour; a single climax gives the line a point |
| Implied chords | Each bar is given a chord (I, ii, IV, V or vi). Strong beats and held notes lean to that chord | A melody is heard against a harmony even when none is played |
| Question and answer | Bar 4 tends to pause on a note of the dominant chord; the last two bars go V–I | The period: an antecedent phrase ending on V, a consequent ending on I |
| Tendency tones | The leading note tends up to the tonic, the fourth down to the third; neither tends to be held | The unstable degrees resolve to their stable neighbours |
| A stepwise close | The last note (always the tonic) is reached from the note above or below | The usual melodic cadence: re–do or ti–do |
| Repetition | Bar 5 often takes bar 1's rhythm, and one bar's shape comes back later | Without repetition successive ideas sound unrelated |
| No rocking | A line avoids see-sawing between the same two notes | It reads as an exercise, not a phrase |

The strengths are the `LEAN` numbers near the top of the generator. Each is a
multiplier on a draw, so every note a level allows can still appear.

One thing changed that was a fault rather than a taste: downward steps used to
be given a token weight, so lines climbed by step and came down only by leaping
or by bouncing off the top of the range.

## Sources

- David Huron, "Tone and Voice: A Derivation of the Rules of Voice-Leading from
  Perceptual Principles", *Music Perception* 19/1 (2001), and *Voice Leading:
  The Science behind a Musical Art* (MIT Press, 2016): pitch proximity and the
  perceptual basis of the traditional rules.
- Paul von Hippel and David Huron, "Why Do Skips Precede Reversals?" *Music
  Perception* 18/1 (2000): the step back after a leap as regression to the
  middle of the range.
- Paul von Hippel, "Melodic-expectation rules as learned heuristics" (2002):
  listeners expect skip reversal and step momentum.
- Leonard Meyer, *Explaining Music* (1973): the leap as a gap to be filled.
- Carol Krumhansl, *Cognitive Foundations of Musical Pitch* (1990): the
  stability of the tonic, third and fifth.
- Percy Goetschius, *Exercises in Melody-Writing* (1900): open on the tonic
  triad, close on the tonic preceded by a note of the dominant.
- Standard accounts of the period (antecedent ending on V, consequent on I) and
  of melodic contour in tonal-composition textbooks.
