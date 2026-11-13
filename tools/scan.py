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
"""
import argparse, copy, json, re, subprocess, sys, tempfile
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


def read_page(image: Path, work: Path) -> Path:
    local = work / image.name
    if local != image:
        local.write_bytes(image.read_bytes())
    subprocess.run(['homr', str(local)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    result = local.with_suffix('.musicxml')
    if not result.exists():
        raise SystemExit(f'The scanner found no music on {image.name}.')
    return result


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
    args = ap.parse_args()

    slug = args.id or re.sub(r'[^a-z0-9]+', '-', args.title.lower()).strip('-') or 'piece'
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        images = [p for f in args.files for p in pages_of(f, work)]
        results = []
        for i, image in enumerate(images, start=1):
            print(f'Reading page {i} of {len(images)}…', flush=True)
            results.append(read_page(image, work))
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
    index['pieces'] = [p for p in index['pieces'] if p.get('id') != slug] + [entry]
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Added "{args.title}": {len(images)} page(s), {bars} bars, {notes} notes → library/{slug}.musicxml')
    print('Open it in Listen and check it against the paper before students use it.')


if __name__ == '__main__':
    main()
