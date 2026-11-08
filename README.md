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
- `config.json`: GitHub queries, subreddits, YouTube queries, newsletter feed URLs. **Feed URLs are unverified guesses - replace with the ones you follow.**
- `radar/classify.py`: keyword categories (editable), league/role tags, relevance 0-1. Items below 0.3 relevance are dropped.
- `radar/scoring.py`: quality 0-100 = engagement 35% + relevance 25% + source authority 20% + freshness 20%. Tiers: High 70+, Medium 45-69, Low <45. Breakdown stored per item (hover the score in the dashboard).
- `snapshots` table keeps every run's stars/views/upvotes, so GitHub "stars this week" becomes real after a week of daily runs.
- `.github/workflows/refresh.yml`: daily run, commits `data/radar.db` + `docs/data.js`; served by GitHub Pages from `/docs`.

## Known limits
- GitHub has no trending API; "trending" = recently pushed + starred, then star velocity from snapshots.
- Newsletters expose no engagement numbers, so their score leans on authority, depth and freshness.
- Email-only newsletters need an RSS bridge (Substack/Ghost/Beehiiv have feeds; others via kill-the-newsletter.com).
- Categorisation is keyword-based: expect misses on slang and non-English titles. Tune the regexes after your first real run.
