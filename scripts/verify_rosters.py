#!/usr/bin/env python3
"""Cross-check every player on the contract sheet against Leaguepedia roster changes since 2026-01-01.
Prints players whose latest wiki event says they left / moved, and wiki joiners missing from the sheet.
Needs LEAGUEPEDIA_USER/PASS. Read-only: writes nothing, just a report (review before editing roster-overrides.js)."""
import json, os, re, sys, time
sys.argv = [sys.argv[0]]                      # reuse coach_sync helpers without running its main()
import importlib.util
spec = importlib.util.spec_from_file_location("cs", os.path.join(os.path.dirname(__file__), "coach_sync.py"))
src = open(spec.origin).read().replace("\ntry:\n    main()", "\ntry:\n    pass")
cs = type(sys)("cs"); cs.__file__ = spec.origin; exec(compile(src, spec.origin, "exec"), cs.__dict__)
norm, call = cs.norm, cs.call

s = open(cs.DATA, encoding="utf-8").read()
T = json.loads(re.search(r"GCD_TEAMS\s*=\s*(\[.*?\]);", s, re.S).group(1))
R = json.loads(re.search(r"GCD_ROWS\s*=\s*(\[.*?\]);", s, re.S).group(1))
ok, r = cs.login(os.environ["LEAGUEPEDIA_USER"], os.environ["LEAGUEPEDIA_PASS"])
if not ok: print("login failed", r); sys.exit(1)
ev, off = [], 0
while True:
    j = call({"action": "cargoquery", "tables": "RosterChanges", "fields": "Date_Sort,Player,Direction,Team,Role",
              "where": "Date_Sort>='2026-01-01' AND Role IN ('Top','Jungle','Mid','Bot','Support')",
              "order_by": "Date_Sort ASC", "limit": 500, "offset": off})
    if "cargoquery" not in j: print("query failed", json.dumps(j)[:300]); sys.exit(1)
    rows = [x["title"] for x in j["cargoquery"]]; ev += rows
    if len(rows) < 500: break
    off += 500; time.sleep(3)
print("events:", len(ev))
day = lambda e: (e.get("Date Sort") or e.get("Date_Sort") or "")[:10]
ev.sort(key=lambda e: (day(e), 0 if (e.get("Direction") or "").lower().startswith("leave") else 1))
last = {}
for e in ev: last[norm(re.sub(r"\s*\(.*?\)\s*$", "", e["Player"]))] = (day(e), (e.get("Direction") or "").lower()[:5], e.get("Team"), e.get("Role"))
nm = lambda x: norm(x).replace("esports", "").replace("gaming", "")
same = lambda a, b: nm(a) == nm(b) or (len(nm(a)) > 3 and len(nm(b)) > 3 and (nm(a) in nm(b) or nm(b) in nm(a)))
sheet = {}
print("\n== SHEET PLAYERS WHOSE LATEST WIKI EVENT DISAGREES ==")
for reg_i, name, role, *_ in R:
    if role not in ("TOP", "JUNGLE", "MID", "BOT", "SUPPORT"): continue
    t = T[reg_i]; sheet.setdefault(t[2], set()).add(norm(name))
    l = last.get(norm(name))
    if not l: continue
    d, dirn, team, wrole = l
    if dirn.startswith("leave") and same(team, t[2]): print(f"LEFT   {t[1]:8} {t[2]:28} {name:14} left {team} on {d} ({wrole})")
    elif dirn.startswith("join") and not same(team, t[2]): print(f"MOVED  {t[1]:8} {t[2]:28} {name:14} joined {team} on {d} ({wrole})")
print("\n== WIKI JOINERS (latest event = join) AT OUR TEAMS BUT NOT ON THE SHEET ==")
for p, (d, dirn, team, wrole) in sorted(last.items(), key=lambda x: x[1][0]):
    if not dirn.startswith("join"): continue
    for t in T:
        if t[1] in ("LCK", "LPL", "LEC", "LCS", "LCP") and same(team, t[2]) and p not in sheet.get(t[2], set()):
            print(f"JOINED {t[1]:8} {t[2]:28} {p:14} {d} ({wrole})"); break
