"""Rumours listed on Rostermania (rostermania.lol), a fan-run transfer tracker. Only entries it labels "Rumour" are read, and
only the headline facts (player, role, from, to, date); each becomes a news item credited to Rostermania and linking to its
player page. Renewals, "out of league" rows and anything Confirmed/Done are skipped: Sheep, Leaguepedia and the contract
sheet already cover those. robots.txt allows /transfers; this runs with the 3-hourly refresh only, one request per league,
with a User-Agent that names this project."""
import html, re
from datetime import datetime
from ..http import get
from .common import log

UA = {"User-Agent": "LoLTransferRadar/1.0 (+https://github.com/Set0Panda/LoLTransferDataDashboard)"}
BASE = "https://rostermania.lol"
LEAGUES = {"lec": {"FNC": "Fnatic", "G2": "G2 Esports", "GX": "GIANTX", "KC": "Karmine Corp", "KCB": "Karmine Corp Blue",
                   "MKOI": "Movistar KOI", "NAVI": "Natus Vincere", "SK": "SK Gaming", "TH": "Team Heretics",
                   "VIT": "Team Vitality", "SHF": "Shifters", "LR": "Los Ratones", "SLY": "Solary"}}
ROLES = {"adc": "ADC", "top": "Top", "jungle": "Jungle", "mid": "Mid", "support": "Support", "coach": "Coach"}
TOK = re.compile(r'text-label-uppercase font-bold text-ink uppercase">([^<]+)</span>|<li class="relative">(.*?)</li>', re.S)


def parse(page, names, league="lec"):
    out, day = [], None
    for m in TOK.finditer(page):
        if m.group(1):
            try:
                day = datetime.strptime(m.group(1).strip(), "%b %d, %Y")
            except ValueError:
                day = None
            continue
        row = m.group(2)
        pl = re.search(r'href="/transfer/([^"]+)">([^<]+)</a>', row)
        badge = re.search(r'<span class="skew-x-6">([^<]*)</span>', row)
        teams = re.findall(r'<span class="max-w-\[18ch\] truncate">([^<]*)</span>', row)
        role = re.search(r'alt="([A-Za-z ]+)" title="\1"[^>]*role-icon', row)
        if not (day and pl and badge and len(teams) >= 2) or badge.group(1).strip().lower() != "rumour":
            continue
        frm, to = teams[0].strip(), teams[1].strip()
        if to not in names or "renewal" in row.lower():
            continue
        r = ROLES.get((role.group(1).strip().lower() if role else ""), "")
        name = html.unescape(pl.group(2)).strip()
        title = f"{name} set to join {names[to]}" + (f" as {r}" if r else "") + (f" from {names[frm]}" if frm in names else "")
        out.append({"source_type": "newsletter", "source_name": "Rostermania", "external_id": f"rm|{league}|{pl.group(1)}|{frm}|{to}",
                    "title": title, "url": f"{BASE}/transfer/{pl.group(1)}", "author": "Rostermania",
                    "summary": "Rumour listed on Rostermania (rostermania.lol).", "published_at": day.strftime("%Y-%m-%dT12:00:00Z"),
                    "metrics": {"words": 0, "leak": 1}, "authority": 0.6, "extra": {"lol": 1},
                    "category_hint": "Transfers & Rumors", "lol_ctx": True})
    return out


def collect(cfg, fixtures=False):
    if fixtures or not cfg.get("rostermania", {}).get("enabled", True):
        return []
    out = []
    for lg, names in LEAGUES.items():
        try:
            out += parse(get(f"{BASE}/{lg}/transfers", headers=UA, timeout=30), names, lg)
        except Exception as e:
            log(f"  [rostermania] {lg}: {e}")
    log(f"  [rostermania] {len(out)} rumours")
    return out
