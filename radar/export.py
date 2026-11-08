"""DB -> docs/data.js. Loaded via <script> so it works from file:// and GitHub Pages alike."""
import json
from datetime import datetime, timezone, timedelta
from . import db


def star_delta(con, iid, days=7):
    cut = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    old = con.execute("SELECT value FROM snapshots WHERE item_id=? AND metric='stars' AND captured_at<=? "
                      "ORDER BY captured_at DESC LIMIT 1", (iid, cut)).fetchone()
    new = con.execute("SELECT value FROM snapshots WHERE item_id=? AND metric='stars' "
                      "ORDER BY captured_at DESC LIMIT 1", (iid,)).fetchone()
    return int(new[0] - old[0]) if old and new else None


def _existing_ids(path):
    try:
        txt = open(path, encoding='utf-8').read()
        return {i['id'] for i in json.loads(txt[len('window.RADAR = '):txt.rindex(';')])['items']}
    except Exception:
        return None


def export(con, out_path, max_items=4000, only_if_new_ids=False):
    rows = con.execute("""SELECT * FROM items ORDER BY COALESCE(published_at, first_seen_at) DESC LIMIT ?""",
                       (max_items,)).fetchall()
    items = []
    for r in rows:
        m = json.loads(r["metrics"])
        pub = {k: v for k, v in m.items() if not k.startswith("_")}
        if r["source_type"] == "github":
            d = star_delta(con, r["id"])
            if d is not None:
                pub["stars_7d"] = d
        items.append({"id": r["id"], "type": r["source_type"], "source": r["source_name"],
                      "title": r["title"], "url": r["url"], "author": r["author"],
                      "summary": r["summary"] or "", "published": r["published_at"], "seen": r["first_seen_at"],
                      "metrics": pub, "category": r["category"], "tags": json.loads(r["tags"]),
                      "quality": r["quality"], "tier": r["quality_tier"],
                      "breakdown": json.loads(r["quality_breakdown"]), "relevance": r["relevance"]})
    if only_if_new_ids and _existing_ids(out_path) == {i['id'] for i in items}:
        return 0          # nothing new: leave the file alone so the fast job makes no commit
    srcs = [dict(s) for s in con.execute("SELECT type,name,last_run,last_status,authority FROM sources")]
    meta = {"generated": db.now(), "demo": con.execute("SELECT value FROM meta WHERE key='demo'").fetchone() is not None,
            "sources": srcs}
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("window.RADAR = " + json.dumps({"meta": meta, "items": items}, ensure_ascii=False) + ";\n")
    return len(items)
