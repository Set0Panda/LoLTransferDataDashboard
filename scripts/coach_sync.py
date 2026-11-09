#!/usr/bin/env python3
"""Pull current LCK + LPL head coaches / coaches from Leaguepedia (Cargo: RosterChanges) into docs/coaches-extra.js.

Riot's contract sheet has no coaches for KR (LCK) or CN (LPL). Leaguepedia rate-limits anonymous API use, so this
logs in with a bot password (secrets LEAGUEPEDIA_USER / LEAGUEPEDIA_PASS). Without them it does nothing.

Safeguard (same principle as the other data): any failure, or a suspiciously small result, leaves the existing file
untouched and exits 0 so the main refresh is never blocked. Pass --dry to print what it would write.
"""
import http.cookiejar, json, os, re, sys, time, urllib.parse, urllib.request, datetime

API = "https://lol.fandom.com/api.php"
UA = "LoLTransferRadar/1.0 (https://github.com/Set0Panda/LoLTransferDataDashboard; contact via GitHub)"
OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "coaches-extra.js")
DATA = os.path.join(os.path.dirname(__file__), "..", "docs", "contract", "data.js")
MIN_ROWS = 8          # fewer than this = something is wrong, keep old file
DRY = "--dry" in sys.argv

cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.addheaders = [("User-Agent", UA)]
norm = lambda s: re.sub(r"[^a-z0-9]", "", (s or "").lower())

def call(params, post=False, tries=5):
    params = dict(params, format="json")
    for n in range(tries):
        data = urllib.parse.urlencode(params).encode()
        try:
            r = op.open(urllib.request.Request(API, data=data) if post else API + "?" + data.decode(), timeout=40)
            j = json.loads(r.read())
        except Exception as e:
            j = {"error": {"code": "exc", "info": str(e)}}
        if j.get("error", {}).get("code") == "ratelimited":
            time.sleep(20 * (n + 1)); continue
        return j
    return {"error": {"code": "gave_up"}}

def login(user, pw):
    t = call({"action": "query", "meta": "tokens", "type": "login"})["query"]["tokens"]["logintoken"]
    r = call({"action": "login", "lgname": user, "lgpassword": pw, "lgtoken": t}, post=True)
    return r.get("login", {}).get("result") == "Success", r

def our_teams():
    s = open(DATA, encoding="utf-8").read()
    teams = json.loads(re.search(r"GCD_TEAMS\s*=\s*(\[.*?\]);", s, re.S).group(1))
    return [t[2] for t in teams if t[1] in ("LCK", "LPL")]

def main():
    user, pw = os.environ.get("LEAGUEPEDIA_USER"), os.environ.get("LEAGUEPEDIA_PASS")
    if not (user and pw):
        print("coach_sync: no LEAGUEPEDIA_USER/PASS set, skipping"); return
    ok, r = login(user, pw)
    if not ok:
        print("coach_sync: login failed, keeping existing file:", json.dumps(r)[:300]); return
    mine = {norm(n): n for n in our_teams()}
    # all coach/staff roster events since mid-2024, oldest first, so the latest event per person wins
    events, off = [], 0
    while True:
        j = call({"action": "cargoquery", "tables": "RosterChanges",
                  "fields": "Date_Sort,Player,Direction,Team,Role,RolesStaff,Roles",
                  "where": "(Role LIKE '%Coach%' OR RolesStaff LIKE '%Coach%') AND Date_Sort>'2024-06-01'",
                  "order_by": "Date_Sort ASC", "limit": 500, "offset": off})
        if "cargoquery" not in j:
            print("coach_sync: query failed, keeping existing file:", json.dumps(j)[:300]); return
        rows = [x["title"] for x in j["cargoquery"]]
        events += rows
        if len(rows) < 500: break
        off += 500; time.sleep(3)
    state, unmatched = {}, set()
    for e in events:
        team = mine.get(norm(e.get("Team")))
        if not team:
            continue
        key = (team, e["Player"]); d = (e.get("Direction") or "").lower()
        if d.startswith("join"): state[key] = e["Date_Sort"][:10]
        elif d.startswith("leave"): state.pop(key, None)
    got = sorted(state)
    print(f"coach_sync: {len(events)} events, {len(got)} current coaches across {len({t for t, _ in got})} teams")
    for t, p in got: print("   ", t, "|", p, "| since", state[(t, p)])
    missing = [n for n in mine.values() if n not in {t for t, _ in got}]
    print("coach_sync: teams with no coach found:", missing)
    if len(got) < MIN_ROWS:
        print(f"coach_sync: only {len(got)} rows (< {MIN_ROWS}), keeping existing file"); return
    body = "// Written by scripts/coach_sync.py from Leaguepedia (RosterChanges). Do not edit by hand: use coaches-manual.js.\n" \
           "window.EXT_COACHES = " + json.dumps({"updated": datetime.date.today().isoformat(), "source": "Leaguepedia",
                                                 "rows": [[t, p, since] for (t, p), since in sorted(state.items())]}, ensure_ascii=False) + ";\n"
    if DRY: print("coach_sync: --dry, not writing"); return
    open(OUT, "w", encoding="utf-8").write(body); print("coach_sync: wrote", OUT)

try:
    main()
except Exception as e:      # never block the main refresh
    print("coach_sync: unexpected error, keeping existing file:", repr(e))
