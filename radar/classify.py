"""Keyword categoriser + relevance. Deliberately transparent (no ML): edit the dicts to tune."""
import re

CATEGORIES = {   # name -> (weight per hit, patterns)
    "Transfers & Rumors": (3, r"transfer|rumou?rs?|linked to|in talks|signs?\b|signed|signing|joins?\b|joined|leaves?\b|leaving|departs?|departure|released?\b|poach|swap|benched|retire[sd]?|replac(e|es|ed|ing)|sources? (say|claim)|roster (move|change|shuffle)|moves? to"),
    "Contracts & Free Agency": (3, r"contracts?|free[- ]agen(t|cy)|buy-?out|expir(e|es|ing|y)|extension|renew(s|ed|al)?|salary|salaries|clause|rdc|league[- ]recognized|restricted agent|waiv"),
    "Roster Announcements": (2, r"roster|line-?up|announce[sd]?|welcomes?|farewell|academy (call|promot)|promot(e|ed|es)|starting five|substitute|coach(ing staff)?"),
    "Analysis & Stats": (2, r"analysis|stats?\b|statistics|win ?rate|breakdown|power rankings?|preview|recap|deep dive|data[- ]driven|metrics?|projection|model"),
    "Tools & Data": (2, r"\bapi\b|wrapper|scrap(er|ing)|dataset|leaguepedia|parser|bot\b|cli\b|library|sdk|open[- ]source|dashboard|tracker|database|pipeline|riot-?api|gol\.gg|oracle'?s elixir"),
    "Tutorials & Guides": (3, r"tutorial|how to|guide|learn(ing)?|walkthrough|course|beginner|step[- ]by[- ]step|explained|101"),
    "Community Discussion": (2, r"discussion|thread|opinion|unpopular|what do you think|ama\b|megathread|hot take|\bpoll\b"),
}
SOURCE_DEFAULT = {"github": "Tools & Data", "reddit": "Community Discussion",
                  "youtube": "Analysis & Stats", "newsletter": "Roster Announcements"}

LOL_CONTEXT = re.compile(r"league of legends|\blol\b|lolesports|\blck\b|\blec\b|\blcs\b|\blta\b|\blpl\b|cblol|\bljl\b|\bpcs\b|\bvcs\b|\bworlds\b|\bmsi\b|riot games|riot api|leaguepedia|summoner|esports", re.I)
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
    ctx = bool(LOL_CONTEXT.search(text)) or bool(LOL_SOURCE.search(item["source_name"]))
    topic_hits = sum(1 for k in ("Transfers & Rumors", "Contracts & Free Agency", "Roster Announcements") if k in scores)
    relevance = 0.0
    if ctx:
        relevance = min(1.0, 0.3 + 0.2 * topic_hits + 0.1 * min(len(scores), 3)
                        + (0.2 if "Transfers & Rumors" in scores else 0))
    default = SOURCE_DEFAULT[item["source_type"]]
    if scores:
        best = max(scores, key=lambda k: (scores[k], k == default))
        # a repo is always a tool/dataset; its topical categories survive as tags
        if item["source_type"] == "github":
            best = "Tools & Data"
    else:
        best = default
    tags = [k for k in scores if k != best][:3]
    tags += [k for k, p in LEAGUES.items() if re.search(p, text, re.I)]
    tags += [k for k, p in ROLES.items() if re.search(p, text, re.I)][:2]
    return best, tags, round(relevance, 2)
