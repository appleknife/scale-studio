# The Listen library

Pieces listed in `index.json` appear in Listen under "Pieces from your teacher".

## The easy way: the inbox

Upload a scanned PDF (or a folder of photos) to `library/inbox/` on GitHub,
named for the piece: `Gavotte - Gossec.pdf`. A few minutes later it is in the
app. See `library/inbox/README.md`.

Lines that the page labels as exercises ("Bonus exercise", "Warm-up", "Drill",
…) are left out; the list of words is `SKIP_WORDS` in `tools/scan.py`.

## By hand: from photos or a scanned PDF

On a computer with Python:

    pip install homr pymupdf
    python tools/scan.py page1.jpg page2.jpg --title "Gavotte" --composer "Gossec"
    python tools/scan.py etude.pdf --title "Etude no. 2" --composer "Wohlfahrt"

Photos go in page order. The scanner runs on your computer; nothing is uploaded.
It writes `library/<name>.musicxml` and adds the piece to `index.json`. Publish
those two files and the piece is in the app.

## It is not 100%

In tests on cleanly printed pages the scanner read 98–100% of notes correctly.
It can still misread a note, a rhythm, a time signature or a repeat, and it will
do worse on faint, crooked, handwritten or heavily marked pages. Take photos
flat, well lit and square-on. Open each new piece in Listen, press "Hear it
first", and follow along with the paper before students use it. The app shows
students a note saying the score was read by a computer.

## Adding a piece you already have as MusicXML

Put the file here and add an entry to `index.json` without `"scanned": true`:

    { "id": "my-piece", "title": "My Piece", "composer": "Me", "file": "my-piece.musicxml" }
