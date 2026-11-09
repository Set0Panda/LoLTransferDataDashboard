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
RUM_OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "rumors-extra.js")
RUM_DAYS = 45
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

# Leaguepedia name -> name used on Contract Radar, where they differ beyond case/punctuation
ALIAS = {"teamwe": "Xi'an Team WE", "jdgaming": "Beijing JDG Esports", "lngesports": "Suzhou LNG Esports",
         "ninjasinpyjamas": "Shenzhen NINJAS IN PYJAMAS", "nongshimredforce": "NS REDFORCE", "kiwoomdrx": "KRX", "drx": "KRX",
         "weibogaming": "WeiboGaming", "ultraprimeesports": "Ultra Prime"}

def our_teams():
    s = open(DATA, encoding="utf-8").read()
    teams = json.loads(re.search(r"GCD_TEAMS\s*=\s*(\[.*?\]);", s, re.S).group(1))
    return [t[2] for t in teams if t[1] in ("LCK", "LPL")]

def rumors():
    """Recent RosterRumors rows (all regions) -> docs/rumors-extra.js. Failure keeps the old file."""
    since = (datetime.date.today() - datetime.timedelta(days=RUM_DAYS)).isoformat()
    rows, off = [], 0
    while True:
        j = call({"action": "cargoquery", "tables": "RosterRumors",
                  "fields": "Date,Player,TeamStart,TeamEnd,RoleStart,RoleEnd,Status,SourceSite,SourceLink,IsOver,NotHappening",
                  "where": f"Date>='{since}'", "order_by": "Date DESC", "limit": 500, "offset": off})
        if "cargoquery" not in j:
            print("rumors: query failed, keeping existing file:", json.dumps(j)[:300]); return
        part = [x["title"] for x in j["cargoquery"]]; rows += part
        if len(part) < 500 or off >= 1000: break
        off += 500; time.sleep(3)
    clean = lambda v: re.sub(r"\s+", " ", (v or "")).strip()
    out = []
    for r in rows:
        link = clean(r.get("SourceLink"))
        if not clean(r.get("Player")) or not (link.startswith("http://") or link.startswith("https://")): continue
        out.append([(r.get("Date") or "")[:10], re.sub(r"\s*\(.*?\)\s*$", "", clean(r["Player"])), clean(r.get("TeamStart")), clean(r.get("TeamEnd")),
                    clean(r.get("RoleStart")), clean(r.get("RoleEnd")), clean(r.get("Status")), clean(r.get("SourceSite")), link,
                    1 if clean(r.get("IsOver")) in ("1", "Yes", "yes") else 0, 1 if clean(r.get("NotHappening")) in ("1", "Yes", "yes") else 0])
    print(f"rumors: {len(rows)} rows, {len(out)} kept ({sum(1 for o in out if not o[9] and not o[10])} open)")
    if not out:
        print("rumors: nothing usable, keeping existing file"); return
    body = "// Written by scripts/coach_sync.py from Leaguepedia (RosterRumors). Do not edit by hand.\n" \
           "window.EXT_RUMORS = " + json.dumps({"updated": datetime.date.today().isoformat(), "rows": out}, ensure_ascii=False) + ";\n"
    if DRY: print("rumors: --dry, not writing"); return
    open(RUM_OUT, "w", encoding="utf-8").write(body); print("rumors: wrote", RUM_OUT)

def main():
    user, pw = os.environ.get("LEAGUEPEDIA_USER"), os.environ.get("LEAGUEPEDIA_PASS")
    if not (user and pw):
        print("coach_sync: no LEAGUEPEDIA_USER/PASS set, skipping"); return
    ok, r = login(user, pw)
    if not ok:
        print("coach_sync: login failed, keeping existing file:", json.dumps(r)[:300]); return
    if "--probe" in sys.argv:
        variants = [
            ("Role only", "Date_Sort,Player,Direction,Team,Role", "Role LIKE '%Coach%'"),
            ("Roles HOLDS", "Date_Sort,Player,Direction,Team,Roles", "Roles HOLDS LIKE '%Coach%'"),
            ("RolesStaff HOLDS", "Date_Sort,Player,Direction,Team,RolesStaff", "RolesStaff HOLDS LIKE '%Coach%'"),
            ("RoleDisplay", "Date_Sort,Player,Direction,Team,RoleDisplay", "RoleDisplay LIKE '%Coach%'"),
            ("no where, T1", "Date_Sort,Player,Direction,Team,Role,Roles,RolesStaff,RoleDisplay", "Team='T1'"),
        ]
        for name, f, w in variants:
            j = call({"action": "cargoquery", "tables": "RosterChanges", "fields": f, "where": w + " AND Date_Sort>'2025-06-01'",
                      "order_by": "Date_Sort DESC", "limit": 5}); time.sleep(3)
            print("PROBE", name, "->", json.dumps(j, ensure_ascii=False)[:900])
        return
    try: rumors()
    except Exception as e: print("rumors: unexpected error, keeping existing file:", repr(e))
    time.sleep(3)
    mine = {norm(n): n for n in our_teams()}
    # all coach/staff roster events since mid-2024, oldest first, so the latest event per person wins
    events, off = [], 0
    while True:
        j = call({"action": "cargoquery", "tables": "RosterChanges",
                  "fields": "Date_Sort,Player,Direction,Team,Role",
                  "where": "Role LIKE '%Coach%' AND Date_Sort>'2024-06-01'",
                  "order_by": "Date_Sort ASC", "limit": 500, "offset": off})
        if "cargoquery" not in j:
            print("coach_sync: query failed, keeping existing file:", json.dumps(j)[:300]); return
        rows = [x["title"] for x in j["cargoquery"]]
        events += rows
        if len(rows) < 500: break
        off += 500; time.sleep(3)
    state, unmatched = {}, set()
    day = lambda e: (e.get("Date Sort") or e.get("Date_Sort") or "")[:10]
    # same-day leave+join (a move) must end as "joined": process leaves first
    events.sort(key=lambda e: (day(e), 0 if (e.get("Direction") or "").lower().startswith("leave") else 1))
    for e in events:
        n = norm(e.get("Team")); team = mine.get(n) or mine.get(norm(ALIAS.get(n, "")))
        if not team:
            continue
        key = (team, re.sub(r"\s*\(.*?\)\s*$", "", e["Player"]).strip()); d = (e.get("Direction") or "").lower()   # "Viod (Lu Fan)" -> "Viod"
        if d.startswith("join"): state[key] = day(e)
        elif d.startswith("leave"): state.pop(key, None)
    # someone current at two teams = a move whose "leave" was never logged: keep the most recent join
    latest = {}
    for (t, p), since in state.items():
        if p not in latest or since > state[(latest[p], p)]: latest[p] = t
    state = {k: v for k, v in state.items() if latest[k[1]] == k[0]}
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
