#!/usr/bin/env python3
"""Stamp the dashboard's own scripts with a content hash (?v=...) so browsers never mix a cached old script with a new page."""
import hashlib, pathlib, re
d = pathlib.Path(__file__).resolve().parent.parent / "docs"
p = d / "index.html"; s = p.read_text(encoding="utf-8")
def stamp(m):
    f = d / m.group(1)
    return f'<script src="{m.group(1)}?v={hashlib.sha1(f.read_bytes()).hexdigest()[:8]}"></script>' if f.exists() else m.group(0)
s2 = re.sub(r'<script src="((?:rosters|contract|home|roster-overrides|coaches-extra|coaches-manual|standings|common-words)\.js)(?:\?v=\w+)?"></script>', stamp, s)
if s2 != s: p.write_text(s2, encoding="utf-8"); print("stamped")
