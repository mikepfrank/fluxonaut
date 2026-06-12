#!/usr/bin/env python3
"""Strip trailing NUL padding that the host file-sync sometimes appends."""
import sys, glob, os
base = os.path.join(os.path.dirname(__file__), '..')
for pat in ('js/*.js', 'test/*.mjs', '*.html', 'css/*.css'):
    for p in glob.glob(os.path.join(base, pat)):
        d = open(p, 'rb').read()
        n = d.rstrip(b'\x00')
        if n != d:
            open(p, 'wb').write(n)
            print('stripped NULs:', p)
