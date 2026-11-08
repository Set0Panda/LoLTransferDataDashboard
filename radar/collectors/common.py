import json, os, re, html
from pathlib import Path

FIX = Path(__file__).resolve().parents[2] / "tests" / "fixtures"


def fixture(name, as_json=True):
    p = FIX / name
    txt = p.read_text(encoding="utf-8")
    return json.loads(txt) if as_json else txt


def clean(text, n=500):
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = html.unescape(re.sub(r"\s+", " ", text)).strip()
    return text[:n]


def log(msg):
    print(msg, flush=True)
