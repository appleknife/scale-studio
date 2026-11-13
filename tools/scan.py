#!/usr/bin/env python3
"""Turn photos or a scanned PDF of violin music into a piece in the Listen library.

    python tools/scan.py page1.jpg page2.jpg --title "Gavotte" --composer "Gossec"
    python tools/scan.py etude.pdf --title "Etude no. 2" --composer "Wohlfahrt"

The reading is done by homr (https://github.com/liebharc/homr), which runs on
this computer; nothing is uploaded. Needs:  pip install homr pymupdf

What comes out is library/<id>.musicxml and a line in library/index.json. Every
piece made here is marked "scanned", and the app tells the student so: a scanner
gets most notes right, not all of them. Open the piece in Listen and compare it
with the paper before students use it.

Lines that the page itself labels as an exercise are left out. A method book
often prints a "Bonus exercise" or a "Warm-up" between the pieces; the words in
SKIP_WORDS below, printed above a line of music, mark that line (and the lines
after it, up to the next heading) as not part of the piece. What was left out is
printed and recorded in index.json. Use --keep-all to read every line, or
--skip "word,word" to use your own words.
"""
import argparse, copy, json, re, sys, tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIBRARY = ROOT / 'library'


def pages_of(path: Path, work: Path):
    """A PDF becomes one image a page; a picture is itself."""
    if path.suffix.lower() != '.pdf':
        return [path]
    import pymupdf
    out = []
    with pymupdf.open(path) as doc:
        for i, page in enumerate(doc):
            target = work / f'{path.stem}-p{i + 1:02d}.png'
            page.get_pixmap(dpi=200).save(target)
            out.append(target)
    return out


# Words that mark a line of music as teaching material rather than the piece.
SKIP_WORDS = [
    'bonus', 'exercise', 'exercises', 'warm-up', 'warm up', 'warmup', 'drill', 'drills',
    'preparatory', 'preparation', 'practice line', 'practice drill', 'skill builder',
    'technique builder', 'technique trainer', 'finger pattern', 'rhythm practice', 'rhythm drill',
    'theory', 'review', 'teaching point', 'study tip',
]
# Printed in the music itself, and never a heading however large.
MUSIC_WORDS = {
    'allegro', 'allegretto', 'andante', 'andantino', 'moderato', 'adagio', 'largo', 'lento', 'presto',
    'vivace', 'maestoso', 'cresc', 'crescendo', 'dim', 'diminuendo', 'decresc', 'rit', 'ritardando',
    'rall', 'accel', 'a tempo', 'tempo', 'pizz', 'arco', 'fine', 'coda', 'segno', 'dolce', 'cantabile',
    'legato', 'staccato', 'poco', 'molto', 'simile', 'sempre', 'tutti', 'solo', 'div', 'unis',
}


def skip_pattern(words):
    parts = [re.escape(w.strip().lower()).replace(r'\ ', r'[\s-]*').replace(r'\-', r'[\s-]*') for w in words if w.strip()]
    return re.compile(r'(?<![a-z])(' + '|'.join(parts) + r')(?![a-z])') if parts else None


def exercise_staves(staves, texts, pattern):
    """Which staves a page labels as exercises.

    `staves` run from the top of the page down; each has `.left` and `.span(x)`,
    the top and bottom staff line where x is (a photographed page is never quite
    level, so where a staff is depends on where you look). `texts` are
    (text, left, top, right, bottom). A label counts when it sits in the gap above
    a staff (or in the margin beside it) and matches `pattern`. The lines from
    there on are exercise lines, until a heading that is not: text above a later
    staff, at least as tall as the label was, that is not a musical direction.
    Returns { staff index: label }.
    """
    if not pattern:
        return {}
    marks = {}  # staff index -> ('skip' | 'keep', text height, text)
    for text, left, top, right, bottom in texts:
        clean = re.sub(r'\s+', ' ', text).strip()
        letters = re.sub(r'[^a-z]', '', clean.lower())
        if len(letters) < 3:
            continue
        mid = (top + bottom) / 2
        spans = [st.span((left + right) / 2) for st in staves]
        inside = next((i for i, (st, sb) in enumerate(spans) if st <= mid <= sb), None)
        if inside is not None:
            # level with a staff: only a label out in the left margin counts
            if right > staves[inside].left:
                continue
            target = inside
        else:
            target = next((i for i, (st, sb) in enumerate(spans) if st > mid), None)
            if target is None:
                continue
        height = bottom - top
        is_skip = bool(pattern.search(clean.lower()))
        if not is_skip and (clean.lower().strip('.:,') in MUSIC_WORDS or len(letters) < 4):
            continue
        kind = 'skip' if is_skip else 'keep'
        old = marks.get(target)
        # a label beats a plain heading on the same line; otherwise the taller text wins
        if old is None or (kind == 'skip' and old[0] == 'keep') or (kind == old[0] and height > old[1]):
            marks[target] = (kind, height, clean)
    out = {}
    label = None
    for i in range(len(staves)):
        mark = marks.get(i)
        if mark and mark[0] == 'skip':
            label = mark
        elif mark and label and mark[1] >= 0.8 * label[1]:
            label = None  # a heading of its own: the piece goes on from here
        if label:
            out[i] = label[2]
    return out


class StaffSpan:
    """One system on the page, as exercise_staves() wants it."""

    def __init__(self, multi):
        self.staffs = multi.staffs
        self.left = min(s.min_x for s in multi.staffs)

    def span(self, x):
        tops, bottoms = [], []
        for s in self.staffs:
            at = min(max(x, s.min_x), s.max_x)
            point = s.get_at(at) or min(s.grid, key=lambda p: abs(p.x - at))
            tops.append(min(point.y))
            bottoms.append(max(point.y))
        return min(tops), max(bottoms)


_ready = False


def read_page(image: Path, work: Path, pattern):
    """One page → (MusicXML path, [labels of what was left out])."""
    import xml.etree.ElementTree as XET
    from homr import main as H
    from homr import title_detection as TD
    from homr.music_xml_generator import XmlGeneratorArguments, generate_xml
    from homr.staff_parsing import parse_staffs
    from homr.system_repair import repair_systems
    from homr.transformer.configs import Config

    global _ready
    if not _ready:
        H.download_weights(False, False, False)
        if TD._reader is None:
            TD.download_ocr_weights()
        _ready = True

    local = work / image.name
    if local != image:
        local.write_bytes(image.read_bytes())
    config = H.ProcessingConfig(False, False, False, False, -1, False, False, False, False)
    multi_staffs, page, debug, _title, _count, to_input = H.detect_staffs_in_image(str(local), config)
    multi_staffs = sorted(multi_staffs, key=lambda m: m.staffs[0].min_y)

    left_out = []
    if pattern:
        staves = [StaffSpan(m) for m in multi_staffs]
        found = TD._reader(debug.original_image)
        texts = []
        if found and found.boxes is not None:
            boxes = [TD.TextBox(text, box) for box, text in zip(found.boxes, found.txts)]
            texts = [(b.text, b.left, b.top, b.right, b.bottom) for b in TD._merge_texts(boxes)]
        skip = exercise_staves(staves, texts, pattern)
        if skip:
            for label in dict.fromkeys(skip.values()):
                left_out.append({'label': label, 'lines': sum(1 for v in skip.values() if v == label)})
            multi_staffs = [m for i, m in enumerate(multi_staffs) if i not in skip]
    if not multi_staffs:
        return None, left_out

    multi_staffs = repair_systems(debug, multi_staffs)
    engine = Config()
    engine.use_gpu_inference = False
    engine.use_coreml_encoder = False
    result = parse_staffs(debug, multi_staffs, page, selected_staff=-1, config=engine, page_to_input_image=to_input)
    xml = generate_xml(XmlGeneratorArguments(), result, '')
    target = local.with_suffix('.musicxml')
    XET.ElementTree(xml).write(target, encoding='unicode', xml_declaration=True)
    debug.clean_debug_files_from_previous_runs()
    return target, left_out


def join(pages, title, composer):
    """One part from the pages, in order, bars numbered through."""
    first = ET.parse(pages[0]).getroot()
    part = first.find('part')
    for later in pages[1:]:
        measures = ET.parse(later).getroot().find('part').findall('measure')
        if measures:
            # A time signature is printed once, at the top of the piece. On a later
            # page the scanner has none to read and guesses; the guess is dropped.
            for attributes in measures[0].findall('attributes'):
                for time in attributes.findall('time'):
                    attributes.remove(time)
        for m in measures:
            part.append(copy.deepcopy(m))
    for n, m in enumerate(part.findall('measure'), start=1):
        m.set('number', str(n))
    for old in first.findall('work') + first.findall('movement-title') + first.findall('identification'):
        first.remove(old)
    work = ET.Element('work')
    ET.SubElement(work, 'work-title').text = title
    first.insert(0, work)
    ident = ET.Element('identification')
    if composer:
        ET.SubElement(ident, 'creator', {'type': 'composer'}).text = composer
    enc = ET.SubElement(ident, 'encoding')
    ET.SubElement(enc, 'software').text = 'Scale Studio tools/scan.py (homr)'
    first.insert(1, ident)
    notes = sum(1 for n in part.iter('note') if n.find('rest') is None)
    return first, len(part.findall('measure')), notes


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('files', nargs='+', type=Path, help='photos (jpg, png) in page order, or one PDF')
    ap.add_argument('--title', required=True)
    ap.add_argument('--composer', default='')
    ap.add_argument('--credit', default='', help='edition or source, shown small under the title')
    ap.add_argument('--id', default='', help='file name in the library (made from the title if left out)')
    ap.add_argument('--keep-all', action='store_true', help='read every line, exercises included')
    ap.add_argument('--skip', default='', help='your own comma-separated words that mark an exercise line')
    args = ap.parse_args()
    pattern = None if args.keep_all else skip_pattern(args.skip.split(',') if args.skip else SKIP_WORDS)

    slug = args.id or re.sub(r'[^a-z0-9]+', '-', args.title.lower()).strip('-') or 'piece'
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        images = [p for f in args.files for p in pages_of(f, work)]
        results = []
        left_out = []
        for i, image in enumerate(images, start=1):
            print(f'Reading page {i} of {len(images)}…', flush=True)
            xml, skipped = read_page(image, work, pattern)
            if xml:
                results.append(xml)
            for item in skipped:
                left_out.append({'page': i, **item})
                print(f'  Left out {item["lines"]} line(s) on page {i}, labelled "{item["label"]}"')
        if not results:
            raise SystemExit('Nothing left to read: every line was labelled as an exercise. Try --keep-all.')
        score, bars, notes = join(results, args.title, args.composer)

    LIBRARY.mkdir(exist_ok=True)
    ET.indent(score)
    (LIBRARY / f'{slug}.musicxml').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(score, encoding='unicode'), encoding='utf-8')
    index_path = LIBRARY / 'index.json'
    index = json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() else {'pieces': []}
    entry = {'id': slug, 'title': args.title, 'composer': args.composer, 'file': f'{slug}.musicxml',
             'scanned': True, 'pages': len(images), 'bars': bars, 'notes': notes}
    if args.credit:
        entry['credit'] = args.credit
    if left_out:
        entry['leftOut'] = left_out
    index['pieces'] = [p for p in index['pieces'] if p.get('id') != slug] + [entry]
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Added "{args.title}": {len(images)} page(s), {bars} bars, {notes} notes → library/{slug}.musicxml')
    print('Open it in Listen and check it against the paper before students use it.')


if __name__ == '__main__':
    main()
