"""Hand-added items: data/manual_items.json is a list of {title, url, source, published}. For scoops the automatic
routes have not surfaced yet (Sheep Esports sits behind Cloudflare and Google News can lag by hours). They run through
the same classifier and dedup as everything else, so a later automatic copy of the same headline does not duplicate."""
import json, os
from .common import log

PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "manual_items.json")


def collect(cfg, fixtures=False):
    if fixtures or not os.path.exists(PATH):
        return []
    out = []
    for r in json.load(open(PATH, encoding="utf-8")):
        title, url = (r.get("title") or "").strip(), (r.get("url") or "").strip()
        if not (title and url):
            continue
        scoop = title.lower().startswith("sources:")
        out.append({
            "source_type": "newsletter", "source_name": r.get("source") or "Sheep Esports", "external_id": url, "title": title,
            "url": url, "author": r.get("source") or "Sheep Esports", "summary": "", "published_at": r.get("published"),
            "metrics": {"words": 0, "leak": int(scoop)}, "authority": 0.8, "extra": {"lol": 1},
            "category_hint": "Transfers & Rumors" if scoop else None, "lol_ctx": True,
        })
    log(f"  [manual] {len(out)} items")
    return out
