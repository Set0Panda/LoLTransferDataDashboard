"""Keyword categoriser + relevance. Deliberately transparent (no ML): edit the dicts to tune."""
import re

CATEGORIES = {   # name -> (weight per hit, patterns)
    "Transfers & Rumors": (3, r"sources?:|set to (join|leave|sign|replace|remain|continue)|verbal agreement|explore options|transfer|rumou?rs?|linked to|in talks|signs?\b|signed|signing|joins?\b|joined|leaves?\b|leaving|departs?|departure|released?\b|poach|swap|benched|retire[sd]?|replac(e|es|ed|ing)|sources? (say|claim)|roster (move|change|shuffle)|moves? to"
        r"|이적|영입|합류|결별|방출|은퇴|새 둥지|트레이드|단독|떠난다|잔류|"
        r"转会|加盟|离队|退役|官宣|消息称|爆料|入队|解约|被解雇|开除|퇴출|해임|경질"
        r"|fired|fires\b|sacked|dismiss(ed|es|al)|parts? ways|terminat(ed|es|ion)|suspend(ed|s)|rebuild|overhaul|shake-?up|reshuffle"
        r"|\b(targets?|targeted|offers?|bids?)\b|\bmarket\b|interest (from|in)|eyes?\b"),
    "Contracts & Free Agency": (3, r"contracts?|free[- ]agen(t|cy)|buy-?out|expir(e|es|ing|y)|extension|renew(s|ed|al)?|salary|salaries|clause|rdc|league[- ]recognized|restricted agent|waiv|계약|재계약|자유계약|연장|바이아웃|续约|签约|合同|自由球员"),
    "Roster Announcements": (2, r"roster|line-?up|announce[sd]?|welcomes?|farewell|academy (call|promot)|promot(e|ed|es)|starting five|substitute|coach(ing staff)?|로스터|엔트리|선수단|감독|코치|阵容|首发|教练|名单"),
    "Analysis & Stats": (2, r"analysis|stats?\b|statistics|win ?rate|breakdown|power rankings?|preview|recap|deep dive|data[- ]driven|metrics?|projection|model"),
    "Tools & Data": (2, r"\bapi\b|wrapper|scrap(er|ing)|dataset|leaguepedia|parser|bot\b|cli\b|library|sdk|open[- ]source|dashboard|tracker|database|pipeline|riot-?api|gol\.gg|oracle'?s elixir"),
    "Tutorials & Guides": (3, r"tutorial|how to|guide|learn(ing)?|walkthrough|course|beginner|step[- ]by[- ]step|explained|101"),
    "Community Discussion": (2, r"discussion|thread|opinion|unpopular|what do you think|ama\b|megathread|hot take|\bpoll\b"),
}
# Headlines we never want in a transfer tracker: betting, guides, results pages, other games.
NOISE = re.compile(
    r"\bodds\b|odds (&|and) picks|betting|sportsbook|토토|배팅|베팅|竞猜|赔率"
    r"|patch (notes?|\d+\.\d+)|champion rotation|free rotation|tier list|build guide|\brunes?\b"
    r"|\bvs\.?\b.*\||\d\s?[–-]\s?\d\s*\||matches, roster and results"
    r"|valorant|\bvct\b|\bcs2?\b|counter-strike|\bcsgo\b|rocket league|\brlcs\b|game changers|dota|overwatch|apex legends"
    r"|fortnite|\btft\b|teamfight tactics|wild rift|발로란트|瓦罗兰特|\biem\b|\bblast\b|\bpgl\b|mobile legends|\bmlbb\b"
    r"|call of duty|rainbow six", re.I)

SOURCE_DEFAULT = {"github": "Tools & Data", "youtube": "Analysis & Stats", "newsletter": "Roster Announcements"}

LOL_CONTEXT = re.compile(r"league of legends|\blol\b|lolesports|\blck\b|\blec\b|\blcs\b|\blta\b|\blpl\b|cblol|\bljl\b|\bpcs\b|\bvcs\b|\bworlds\b|\bmsi\b|riot games|riot api|leaguepedia|summoner|esports|롤드컵|리그 ?오브 ?레전드|\b롤\b|페이커|英雄联盟|全球总决赛|世界赛|电竞", re.I)
LOL_SOURCE = re.compile(r"league|lol|lck|lec|lcs|lpl|sheep|inven|dot ?esports|esports", re.I)
LEAGUES = {"LCK": r"\blck\b", "LEC": r"\blec\b", "LCS": r"\blcs\b|\blta\b", "LPL": r"\blpl\b",
           "CBLOL": r"cblol", "LJL": r"\bljl\b", "PCS": r"\bpcs\b", "VCS": r"\bvcs\b",
           "Worlds": r"\bworlds\b", "MSI": r"\bmsi\b", "Academy/ERL": r"\berl\b|academy|lfl|superliga|prime league|ultraliga"}
ROLES = {"Top": r"\btop(laner)?\b", "Jungle": r"\bjungle(r)?\b", "Mid": r"\bmid(laner)?\b",
         "ADC": r"\badc\b|\bbot ?laner\b", "Support": r"\bsupport\b"}


def classify(item):
    text = f"{item['title']} {item.get('summary') or ''}"
    scores = {}
    for name, (w, pat) in CATEGORIES.items():
        n = len(re.findall(pat, text, re.I))
        if n:
            # title hits count double: headlines carry the topic
            n += len(re.findall(pat, item["title"], re.I))
            scores[name] = n * w
    ctx = bool(LOL_CONTEXT.search(text)) or bool(LOL_SOURCE.search(item["source_name"])) or bool(item.get("lol_ctx"))
    topic_hits = sum(1 for k in ("Transfers & Rumors", "Contracts & Free Agency", "Roster Announcements") if k in scores)
    relevance = 0.0
    if ctx:
        relevance = min(1.0, 0.3 + 0.2 * topic_hits + 0.1 * min(len(scores), 3)
                        + (0.2 if "Transfers & Rumors" in scores else 0))
    if item["source_type"] == "newsletter" and NOISE.search(item["title"]):
        relevance = 0.0
    elif item["source_type"] == "newsletter" and topic_hits == 0:
        relevance = min(relevance, 0.2)        # a news item must be about a move, a contract or a roster
    default = SOURCE_DEFAULT[item["source_type"]]
    hint = item.get("category_hint")
    if scores:
        best = max(scores, key=lambda k: (scores[k], k == default))
        # a repo is always a tool/dataset; its topical categories survive as tags
        if item["source_type"] == "github":
            best = "Tools & Data"
    else:
        best = default
    if hint:                      # explicit signal from the source (e.g. Sheep's LEAK tag)
        scores.setdefault(hint, 0); best = hint
        if ctx and not NOISE.search(item["title"]): relevance = max(relevance, 0.7)
    tags = [k for k in scores if k != best][:3]
    tags += [k for k, p in LEAGUES.items() if re.search(p, text, re.I)]
    tags += [k for k, p in ROLES.items() if re.search(p, text, re.I)][:2]
    return best, tags, round(relevance, 2)
