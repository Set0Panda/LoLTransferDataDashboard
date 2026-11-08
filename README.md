# LoL Transfer Radar

Collects LoL transfer / contract / roster content from GitHub, Reddit, YouTube and newsletters (RSS),
classifies and scores it, stores it in SQLite (with full-text search) and exports a static dashboard.

    python radar.py run --demo        # offline, synthetic data -> open docs/index.html
    python radar.py run               # live run (needs the keys below for YouTube/Reddit)
    python radar.py search "jungle contract" --category "Transfers & Rumors"
    python radar.py stats
    python -m pytest tests

Pure Python 3.10+ standard library; pytest only for the tests.

## Keys (all optional; a source without credentials degrades or is skipped)
| Env var | Source | Notes |
|---|---|---|
| `GITHUB_TOKEN` | GitHub | raises search rate limit (auto-provided in Actions) |
| `YOUTUBE_API_KEY` | YouTube | required; free quota 10k units/day, each query costs ~100 |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | Reddit | create a "script" app at reddit.com/prefs/apps; without it the public .json is tried and is often 403 from CI |

## How it works
- `config.json`: GitHub queries, subreddits, YouTube queries, newsletter feed URLs. Verified feeds: Esports Insider, Dexerto (LoL). Sheep Esports has no RSS, so `radar/collectors/sheep.py` reads its public sitemap and each new article's metadata (title, short description, tags; the `LEAK` tag marks scoops). Dot Esports and Inven Global have no working feed.
- `radar/classify.py`: keyword categories (editable), league/role tags, relevance 0-1. Items below 0.3 relevance are dropped.
- `radar/scoring.py`: quality 0-100 = engagement 35% + relevance 25% + source authority 20% + freshness 20%. Tiers: High 70+, Medium 45-69, Low <45. Breakdown stored per item (hover the score in the dashboard).
- `snapshots` table keeps every run's stars/views/upvotes, so GitHub "stars this week" becomes real after a week of daily runs.
- `.github/workflows/refresh.yml`: daily run, commits `data/radar.db` + `docs/data.js`; served by GitHub Pages from `/docs`.

## Known limits
- GitHub has no trending API; "trending" = recently pushed + starred, then star velocity from snapshots.
- Newsletters expose no engagement numbers, so their score leans on authority, depth and freshness.
- Email-only newsletters need an RSS bridge (Substack/Ghost/Beehiiv have feeds; others via kill-the-newsletter.com).
- Categorisation is keyword-based: expect misses on slang and non-English titles. Tune the regexes after your first real run.

## Provisional rosters (tab on the site)
Per-team cards built from [Contract Radar](https://set0panda.github.io/contract-radar/)'s contract sheet, with logos.
- A starting slot is *projected* when the sheet shows a contract ending after the next aligned end date; otherwise it shows *Open* plus who is expiring.
- Headlines from the feed that name a player show as a "mentions" tag on the slot, and team-level news is listed on the card. Handles that are also everyday words ("Life", "Time") only count when their team is named too.
- The sheet lags reality. Put confirmed or rumoured moves in `docs/roster-overrides.js` (format in the file); confirmed ones move the player between cards.
- `docs/contract/` is a copy of Contract Radar's `data.js`, `logos.js` and `roles-kr.js`, refreshed by the daily Action (it keeps the committed copy if the fetch fails). The aligned-date calendar in `docs/rosters.js` mirrors Contract Radar's; update both together each year.
- `docs/common-words.js` is a generated English word list (wordfreq, top ~5.7k) used for the handle filter.

## Update cadence
- **Fast job** (`fast.yml`, every 10 min): Sheep + RSS feeds only. Commits only when a new article appears, so the repo doesn't fill with empty commits.
- **Full job** (`refresh.yml`, every 3 h): everything, including YouTube/GitHub/Reddit, plus score refresh. Both share one concurrency group so they never run at once.
- **The page** re-reads `data.js` every minute while the tab is open and updates in place; GitHub Pages itself lags about a minute behind each push. Real per-minute freshness would need a small server (e.g. a Cloudflare Worker on a 1-minute cron) instead of Actions.
