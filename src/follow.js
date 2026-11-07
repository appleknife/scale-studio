// follow.js — keeping place in a scale while it is played, note by note.
//
// The score at the end lines the whole take up against the scale at once,
// which is easy: it can see what came after a mistake. This has to decide as
// the notes arrive, so it does the simplest thing a teacher's ear does — it
// knows which note is due next and compares each new note against it.
//
//   right note        move on.
//   a note or two on  the student skipped one; move on to where they are.
//   anything else     wrong. Mark the note that was due: up if the written
//                     note is higher than what was played, down if lower.
//
// A wrong note does not move the place on. Usually the student either fixes it
// (the mark comes off) or carries on to the next note (the mark stays, as a
// record). Two wrong notes in a row move on only when the second is plainly a
// try at the *next* note — at least as close to it as to the one already marked.
//
// What it refuses to judge, because the pitch tracker and a bow both make these
// without the student doing anything wrong:
//   - anything shorter than a beat of a note (MIN_SECONDS): slides, shifts,
//     the scratch of a bow change;
//   - anything further than MAX_WRONG semitones from the note that was due,
//     which is an octave slip in the tracker or a stray open string, not a
//     wrong finger.

const MIN_SECONDS = 0.1;
const MAX_WRONG = 3;

/**
 * @param {number[]} expected the scale's midi numbers, in playing order
 * @param {(event) => void} onEvent called with
 *   {type:'right', index} | {type:'wrong', index, dir:'up'|'down'}
 */
export function createFollower(expected, onEvent = () => {}) {
  let pos = 0; // the index of the note that is due
  let cand = null; // the semitone being held, not yet long enough to count
  let candSince = 0;
  let counted = false; // whether the held semitone has been judged already
  let last = null; // the last semitone judged, so a re-bowed note is not news
  let wrongAt = -1; // where the most recent wrong note was marked

  function judge(m) {
    if (m === last) return;
    last = m;

    // The note due, or a skip of one or two.
    for (let k = pos; k <= Math.min(pos + 2, expected.length - 1); k++) {
      if (expected[k] === m) {
        onEvent({ type: 'right', index: k });
        pos = k + 1;
        wrongAt = -1;
        return;
      }
    }
    if (pos >= expected.length) return;

    // Wrong. Which written note was it a try at?
    let at = pos;
    if (wrongAt === pos && pos + 1 < expected.length) {
      // Already wrong here once: a second wrong note at least as near the next
      // written note is the student moving on, not trying this one again.
      if (Math.abs(expected[pos + 1] - m) <= Math.abs(expected[pos] - m)) at = pos + 1;
    }
    const gap = expected[at] - m;
    if (Math.abs(gap) > MAX_WRONG) return;
    onEvent({ type: 'wrong', index: at, dir: gap > 0 ? 'up' : 'down' });
    pos = at;
    wrongAt = at;
  }

  return {
    /**
     * One pitch reading. `midi` is the fractional midi number, or null for a
     * frame with no clear pitch. `t` is seconds.
     */
    frame(t, midi) {
      if (midi == null) {
        cand = null;
        return;
      }
      const m = Math.round(midi);
      if (m !== cand) {
        cand = m;
        candSince = t;
        counted = false;
        return;
      }
      if (!counted && t - candSince >= MIN_SECONDS) {
        counted = true;
        judge(m);
      }
    },
    get position() {
      return pos;
    },
  };
}
