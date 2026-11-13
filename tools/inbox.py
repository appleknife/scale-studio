#!/usr/bin/env python3
"""Reads everything waiting in library/inbox into the Listen library.

Run by .github/workflows/scan.yml when a file is added to the inbox, or by hand:
    python tools/inbox.py
A file or folder named "Title - Composer" becomes that piece; "[all]" at the end
of the name keeps the lines labelled as exercises. What was read is removed.
"""
import re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / 'library' / 'inbox'
PAGES = {'.pdf', '.png', '.jpg', '.jpeg', '.webp'}


def natural(path):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', path.name)]


def main():
    jobs = []
    for entry in sorted(INBOX.iterdir(), key=natural) if INBOX.exists() else []:
        if entry.is_dir():
            files = sorted((f for f in entry.iterdir() if f.suffix.lower() in PAGES), key=natural)
            if files:
                jobs.append((entry, entry.name, files))
        elif entry.suffix.lower() in PAGES:
            jobs.append((entry, entry.stem, [entry]))
    failed = 0
    for entry, name, files in jobs:
        keep_all = bool(re.search(r'\[all\]\s*$', name, re.I))
        name = re.sub(r'\s*\[all\]\s*$', '', name, flags=re.I).replace('_', ' ').strip()
        title, _, composer = (part.strip() for part in name.partition(' - '))
        cmd = [sys.executable, str(ROOT / 'tools' / 'scan.py'), *map(str, files), '--title', title or name]
        if composer:
            cmd += ['--composer', composer]
        if keep_all:
            cmd.append('--keep-all')
        print(f'── {entry.name}', flush=True)
        done = subprocess.run(cmd)
        if done.returncode:
            failed += 1
            print(f'   could not be read; left in the inbox', flush=True)
            continue
        shutil.rmtree(entry) if entry.is_dir() else entry.unlink()
    print(f'{len(jobs) - failed} read, {failed} left in the inbox')
    return 1 if failed and failed == len(jobs) else 0


if __name__ == '__main__':
    sys.exit(main())
