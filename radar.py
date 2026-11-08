#!/usr/bin/env python3
"""LoL Transfer Radar CLI.
  python radar.py run                 collect all sources, score, export dashboard data
  python radar.py run --only github,reddit
  python radar.py run --demo          offline run on synthetic fixtures (separate demo DB)
  python radar.py search "jungler contract" [--category "Transfers & Rumors"] [--source reddit]
  python radar.py stats
"""
import argparse, json, sys
from pathlib import Path
from radar import db, pipeline, export
ROOT = Path(__file__).parent


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run"); r.add_argument("--only"); r.add_argument("--demo", action="store_true")
    s = sub.add_parser("search"); s.add_argument("query"); s.add_argument("--category"); s.add_argument("--source")
    s.add_argument("--limit", type=int, default=15); s.add_argument("--demo", action="store_true")
    t = sub.add_parser("stats"); t.add_argument("--demo", action="store_true")
    a = ap.parse_args()
    cfg = json.loads((ROOT / "config.json").read_text())
    con = db.connect(ROOT / "data" / ("demo.db" if a.demo else "radar.db"))

    if a.cmd == "run":
        if a.demo:
            import tests.make_fixtures as mf; mf.main()
            con.execute("INSERT OR REPLACE INTO meta VALUES('demo','1')")
        stats = pipeline.collect(con, cfg, set(a.only.split(",")) if a.only else None, fixtures=a.demo)
        pipeline.rescore(con, cfg)
        pipeline.prune(con, cfg["max_age_days"])
        n = export.export(con, ROOT / "docs" / "data.js")
        print(f"exported {n} items -> docs/data.js")
        if any(v["status"] != "ok" for v in stats.values()):
            sys.exit(0)  # partial failures are logged, never fatal
    elif a.cmd == "search":
        for x in pipeline.search(con, a.query, a.category, a.source, a.limit):
            print(f"[{x['quality']:>3} {x['quality_tier']:<6}] {x['source_type']:<10} {x['category']:<24} {x['title'][:80]}\n      {x['url']}")
    elif a.cmd == "stats":
        for row in con.execute("SELECT source_type, category, COUNT(*) n, ROUND(AVG(quality)) q FROM items GROUP BY 1,2 ORDER BY 1,3 DESC"):
            print(f"{row[0]:<11}{row[1]:<26}{row[2]:>5}  avg quality {row[3]:.0f}")

if __name__ == "__main__":
    main()
