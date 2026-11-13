"""Checks the rule that leaves exercise lines out.  Run:  python tools/test_scan.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from scan import SKIP_WORDS, exercise_staves, skip_pattern


class Flat:
    def __init__(self, top, left=100):
        self.top, self.left = top, left

    def span(self, x):
        return self.top, self.top + 40


P = skip_pattern(SKIP_WORDS)
staves = [Flat(100), Flat(250), Flat(400), Flat(550), Flat(700), Flat(850)]
text = lambda words, top, height=20, left=100, right=400: (words, left, top, right, top + height)
checks = [
    ('a labelled exercise goes, and the piece after its own heading stays',
     [text('12. Lightly Row', 60, 30), text('Bonus Exercise: bow lifts', 370), text('13. Song of the Wind', 660, 30)], [2, 3]),
    ('small print inside an exercise does not end it',
     [text('Warm-up', 70, 24), text('pizz.', 380, 12), text('use whole bows here', 380, 12), text('Minuet', 510, 28)], [0, 1, 2]),
    ('a musical direction is not a heading, however large', [text('Finger pattern drill', 220, 20), text('Allegro', 370, 26)], [1, 2, 3, 4, 5]),
    ('a label in the left margin marks its own line', [text('Exercise 4', 410, 18, left=10, right=90), text('Gavotte', 520, 28)], [2]),
    ('a piece with no labels loses nothing', [text('Gavotte', 60, 30), text('dolce', 230, 12)], []),
    ('"exercises" hiding inside another word does not count', [text('Exerciseful Tune', 60, 30), text('Predrilled', 220, 30)], []),
]
bad = 0
for what, texts, want in checks:
    got = sorted(exercise_staves(staves, texts, P))
    if got != want:
        bad += 1
        print(f'FAILED {what}: got {got}, wanted {want}')
print('SCAN RULES FAILED' if bad else 'SCAN RULES OK')
sys.exit(1 if bad else 0)
