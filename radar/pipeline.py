import json, time
from datetime import datetime, timezone, timedelta
from . import db
from .classify import classify
from .scoring import score
from .collectors import github, reddit, youtube, rss
from .collectors.common import log

COLLECTORS = {"github": github, "reddit": reddit, "youtube": youtube, "newsletter": rss}
MIN_RELEVANCE = 0.3


def collect(con, cfg, only=None, fixtures=False):
    """Run collectors, classify, upsert. Returns per-source stats."""
    stats = {}
    for name, mod in COLLECTORS.items():
        if only and name not in only:
            continue
        log(f"[{name}] collecting...")
        t0 = time.time()
        try:
            items = mod.collect(cfg, fixtures=fixtures)
            status = "ok"
        except Exception as e:                 # one broken source must not kill the run
            items, status = [], f"error: {e}"
            log(f"  [{name}] FAILED: {e}")
        new = kept = 0
        for it in items:
            cat, tags, rel = classify(it)
            if rel < MIN_RELEVANCE:
                continue
            it["metrics"] = {**it["metrics"], **{"_" + k: v for k, v in it.get("extra", {}).items()}}
            iid, is_new = db.upsert(con, it)
            con.execute("UPDATE items SET category=?, tags=?, relevance=? WHERE id=?",
                        (cat, json.dumps(tags), rel, iid))
            kept += 1
            new += is_new
        con.execute("UPDATE sources SET last_run=?, last_status=? WHERE type=?", (db.now(), status, name))
        stats[name] = {"fetched": len(items), "kept": kept, "new": new, "status": status}
        log(f"  fetched {len(items)}, kept {kept} (relevant), {new} new in {time.time()-t0:.1f}s")
    con.commit()
    return stats


def rescore(con, cfg):
    """Quality depends on age, so rescore everything on every run, then rebuild the search index."""
    flair = set(cfg.get("trusted_reddit_flairs", []))
    for r in con.execute("SELECT * FROM items").fetchall():
        m = json.loads(r["metrics"])
        item = {"source_type": r["source_type"], "metrics": m, "relevance": r["relevance"],
                "published_at": r["published_at"], "flair": m.get("_flair"), "language": m.get("_language"),
                "summary": r["summary"], "authority": con.execute(
                    "SELECT authority FROM sources WHERE id=?", (r["source_id"],)).fetchone()[0]}
        q, tier, parts = score(item, flair_trusted=flair)
        con.execute("UPDATE items SET quality=?, quality_tier=?, quality_breakdown=? WHERE id=?",
                    (q, tier, json.dumps(parts), r["id"]))
    con.execute("DELETE FROM items_fts")
    con.execute("""INSERT INTO items_fts(rowid,title,summary,tags,source_name)
                   SELECT rowid,title,COALESCE(summary,''),tags,source_name FROM items""")
    con.commit()


def search(con, query, category=None, source=None, limit=20):
    q = " ".join(f'"{w}"*' for w in query.replace('"', " ").split())
    sql = """SELECT i.*, bm25(items_fts) AS rank FROM items_fts JOIN items i ON i.rowid=items_fts.rowid
             WHERE items_fts MATCH ?"""
    args = [q]
    if category:
        sql += " AND i.category=?"; args.append(category)
    if source:
        sql += " AND i.source_type=?"; args.append(source)
    sql += " ORDER BY rank - (i.quality/100.0) LIMIT ?"; args.append(limit)
    return con.execute(sql, args).fetchall()


def prune(con, days):
    cut = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    con.execute("DELETE FROM items WHERE published_at < ? AND quality_tier='Low'", (cut,))
    con.commit()
