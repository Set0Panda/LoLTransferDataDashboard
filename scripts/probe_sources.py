#!/usr/bin/env python3
"""One-off probe (run in Actions): what do Leaguepedia RosterRumors and Reddit RSS return from GitHub's servers?"""
import http.cookiejar, json, os, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
UA = "LoLTransferRadar/1.0 (https://github.com/Set0Panda/LoLTransferDataDashboard)"
API = "https://lol.fandom.com/api.php"
cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj)); op.addheaders = [("User-Agent", UA)]
def get(url, data=None):
    try:
        r = op.open(urllib.request.Request(url, data=data), timeout=40); return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e: return e.code, e.read().decode("utf-8", "replace")[:300]
    except Exception as e: return 0, repr(e)
def lp(params, post=False):
    params = dict(params, format="json"); q = urllib.parse.urlencode(params)
    for n in range(4):
        st, body = get(API, q.encode()) if post else get(API + "?" + q)
        if "ratelimited" in body: time.sleep(20); continue
        return st, body
    return st, body
t = json.loads(lp({"action": "query", "meta": "tokens", "type": "login"})[1])["query"]["tokens"]["logintoken"]
print("LOGIN", lp({"action": "login", "lgname": os.environ["LEAGUEPEDIA_USER"], "lgpassword": os.environ["LEAGUEPEDIA_PASS"], "lgtoken": t}, True)[1][:120])
print("FIELDS", lp({"action": "cargofields", "table": "RosterRumors"})[1][:1500]); time.sleep(3)
print("SAMPLE", lp({"action": "cargoquery", "tables": "RosterRumors", "fields": "_pageName,Date_Sort,Player,Team,Status,Roles,Source,Tags,Confirmation,Date", "order_by": "Date_Sort DESC", "limit": 8})[1][:1800]); time.sleep(3)
print("SAMPLE2", lp({"action": "cargoquery", "tables": "RosterRumors", "fields": "Date_Sort", "where": "Date_Sort>'2026-09-01'", "limit": 500})[1].count("Date Sort"), "rows since 1 Sep")
for name, url in [("r/lolesports new", "https://www.reddit.com/r/lolesports/new/.rss"),
                  ("r/LeagueOfLegends rumors search", "https://www.reddit.com/r/leagueoflegends/search.rss?q=flair%3ARumor&restrict_sr=1&sort=new"),
                  ("r/leagueoflegends new", "https://www.reddit.com/r/leagueoflegends/new/.rss")]:
    st, body = get(url); print("REDDIT", name, st, len(body), body[:200].replace("\n", " "))
