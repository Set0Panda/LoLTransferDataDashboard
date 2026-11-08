"""Generates SYNTHETIC API-shaped fixtures with timestamps relative to now. Teams/players are
fictional - demo mode must never look like real transfer news."""
import json, random
from datetime import datetime, timezone, timedelta
from pathlib import Path

FIX = Path(__file__).parent / "fixtures"
TEAMS = ["Nova Wolves", "Ember Crown", "Tidal Vanguard", "Iron Lotus", "Pale Harbor", "Storm Cartel", "Violet Dynasty", "Gilded Owls"]
PLAYERS = ["Kairo", "Vexel", "Mirin", "Dozu", "Tarkin", "Sael", "Orrin", "Lyth", "Bastion", "Quill"]
ROLES = ["top", "jungle", "mid", "ADC", "support"]
LEAGUES = ["LCK", "LEC", "LCS", "LPL", "CBLOL"]
NEWS = [
 "{p} to leave {t} after one split, sources say", "{t} sign {r}laner {p} from {t2}", "Rumor: {p} linked to {t} for 2027",
 "{t} announce roster for {l} spring split", "{p} contract expires: free agency preview for {l}", "{t} release {p} and promote academy {r}",
 "{p} extension signed with {t} through 2028", "Buyout talks: {t} in talks with {t2} over {p}", "{l} power rankings after week 3: {t} rise",
 "Analysis: how {t}'s {r} swap changed their win rate", "{p} retires after {l} season", "Free agent tracker: every {l} {r} still unsigned",
 "{t} replace coach as {l} roster shuffle continues", "Why {p} leaving {t} makes sense: a data breakdown",
]
VIDEOS = [
 "{t} roster changes explained | {l} offseason", "Every {l} transfer so far - rumor roundup", "How to track LoL esports contracts with Python (tutorial)",
 "{p} to {t}? Free agency analysis", "Learn the Leaguepedia API in 20 minutes - beginner guide", "{l} transfer window: grading every signing",
 "Scraping esports rosters step by step | data tutorial", "{t} vs {t2} full match highlights {l}",
]
REDDIT = [
 "[Rumor] {p} expected to sign with {t}", "{p} has left {t} - official announcement", "Discussion: is {t} making a mistake releasing {p}?",
 "I built a free contract expiry tracker for {l} players", "{l} free agency thread - who is still unsigned?", "Unpopular opinion: {r} imports are overpaid in {l}",
 "{t} roster for next year (confirmed)", "Why do contract buyouts take so long? Explainer",
]
REPOS = [("lol-roster-tracker", "Track LoL esports roster changes and contract expiry from Leaguepedia"), ("leaguepedia-py", "Python wrapper for the Leaguepedia API"),
 ("esports-transfer-db", "Open dataset of League of Legends pro player transfers"), ("riot-api-wrapper", "Typed Riot Games API client for League of Legends"),
 ("lol-esports-stats", "Scrapers and dashboard for LoL esports match data"), ("transfer-rumor-bot", "Discord bot that posts LoL transfer rumors from reddit"),
 ("lolpro-contracts", "Contract database parser for League-recognized pro contracts"), ("lol-skin-changer", "Skin changer for league of legends client")]


def iso(dt): return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def main(seed=7):
    rnd = random.Random(seed)
    now = datetime.now(timezone.utc)
    fill = lambda s: s.format(p=rnd.choice(PLAYERS), t=rnd.choice(TEAMS), t2=rnd.choice(TEAMS), r=rnd.choice(ROLES), l=rnd.choice(LEAGUES))
    FIX.mkdir(exist_ok=True)

    gh = []
    for i, (n, d) in enumerate(REPOS * 2):
        gh.append({"full_name": f"demo-user{i}/{n}-{i}", "html_url": f"https://github.com/demo-user{i}/{n}-{i}", "description": d,
                   "owner": {"login": f"demo-user{i}"}, "stargazers_count": int(rnd.lognormvariate(4.5, 1.4)) + 3,
                   "forks_count": rnd.randint(0, 80), "open_issues_count": rnd.randint(0, 20), "language": rnd.choice(["Python", "TypeScript", "Go", "Rust", None]),
                   "topics": ["league-of-legends", "esports"], "archived": False,
                   "created_at": iso(now - timedelta(days=rnd.randint(30, 900))), "pushed_at": iso(now - timedelta(days=rnd.randint(0, 40)))})
    (FIX / "github.json").write_text(json.dumps({"items": gh}))

    rd = []
    for i in range(48):
        title = fill(rnd.choice(REDDIT)); age = rnd.random() ** 1.8 * 7
        rd.append({"data": {"id": f"d{i:03d}", "title": title, "selftext": "Demo discussion body about " + title.lower(), "subreddit": rnd.choice(["leagueoflegends", "CompetitiveLoL", "lolesports"]),
                  "author": f"demo_user_{rnd.randint(1, 30)}", "permalink": f"/r/leagueoflegends/comments/d{i:03d}/demo/", "score": int(rnd.lognormvariate(6.2, 1.2)),
                  "num_comments": int(rnd.lognormvariate(4.5, 1.2)), "upvote_ratio": round(rnd.uniform(.7, .98), 2), "stickied": False,
                  "link_flair_text": rnd.choice(["Esports", "Discussion", "Rumor", None]), "created_utc": (now - timedelta(days=age)).timestamp()}})
    (FIX / "reddit.json").write_text(json.dumps({"data": {"children": rd}}))

    yt = []
    for i in range(30):
        title = fill(rnd.choice(VIDEOS)); views = int(rnd.lognormvariate(10.2, 1.5))
        yt.append({"id": f"demoVid{i:04d}", "snippet": {"title": title, "description": "Demo video: " + title, "channelTitle": rnd.choice(["Demo Esports Daily", "Rift Ledger", "Draft Pick Data", "Offseason Lab"]),
                   "publishedAt": iso(now - timedelta(days=rnd.random() ** 1.3 * 55))},
                   "statistics": {"viewCount": str(views), "likeCount": str(int(views * rnd.uniform(.01, .06))), "commentCount": str(int(views * .004))}})
    (FIX / "youtube.json").write_text(json.dumps({"items": yt}))

    items = ""
    for i in range(36):
        title = fill(rnd.choice(NEWS)); d = now - timedelta(days=rnd.random() ** 1.5 * 25)
        body = (f"{title}. " + "Demo article text about roster moves and contracts. " * rnd.randint(8, 90))
        items += (f"<item><title>{title}</title><link>https://example.com/demo/{i}</link><guid>demo-{i}</guid>"
                  f"<pubDate>{d.strftime('%a, %d %b %Y %H:%M:%S +0000')}</pubDate><dc:creator>Demo Writer</dc:creator>"
                  f"<description><![CDATA[<p>{body}</p>]]></description></item>")
    (FIX / "feed.xml").write_text('<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" '
                                  'xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Demo</title>' + items + "</channel></rss>")

if __name__ == "__main__":
    main()
