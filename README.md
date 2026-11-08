# LoL Transfer Radar

Collects LoL transfer / contract / roster content from GitHub, YouTube, newsletters (RSS) Sheep Esports and Google News searches,
classifies and scores it, stores it in SQLite (with full-text search) and exports a static dashboard.

    python radar.py run --demo        # offline, synthetic data -> open docs/index.html
    python radar.py run               # live run (needs the key below for YouTube)
    python radar.py search "jungle contract" --category "Transfers & Rumors"
    python radar.py stats
    python -m pytest tests

Pure Python 3.10+ standard library; pytest only for the tests.

## Keys (all optional; a source without credentials degrades or is skipped)
| Env var | Source | Notes |
|---|---|---|
| `GITHUB_TOKEN` | GitHub | raises search rate limit (auto-provided in Actions) |
| `YOUTUBE_API_KEY` | YouTube | required; free quota 10k units/day, each query costs ~100 |

## How it works
- `config.json`: GitHub queries, YouTube queries, newsletter feed URLs. Verified feeds: Esports Insider, Dexerto (LoL). Google News RSS (`radar/collectors/gnews.py`, queries in `config.json -> gnews`) pulls headlines from publications that block CI directly (Dot Esports, EGamersWorld, Insider Gaming, Hotspawn...); each publisher shows up as its own source, headline-only. Sheep Esports has no RSS, so `radar/collectors/sheep.py` reads its public sitemap and each new article's metadata (title, short description, tags; the `LEAK` tag marks scoops). Dot Esports and Inven Global have no working feed.
- `radar/classify.py`: keyword categories (editable), league/role tags, relevance 0-1. Items below 0.3 relevance are dropped.
- `radar/scoring.py`: quality 0-100 = engagement 35% + relevance 25% + source authority 20% + freshness 20%. Tiers: High 70+, Medium 45-69, Low <45. Breakdown stored per item (hover the score in the dashboard).
- `snapshots` table keeps every run's stars/views, so GitHub "stars this week" becomes real after a week of daily runs.
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
- `docs/contract/` is a copy of Contract Radar's `data.js`, `logos.js`, `roles-kr.js` and `regions.js`, refreshed by the daily Action (it keeps the committed copy if the fetch fails). The aligned-date calendar in `docs/rosters.js` mirrors Contract Radar's; update both together each year.
- `docs/common-words.js` is a generated English word list (wordfreq, top ~5.7k) used for the handle filter.

## Update cadence
- **Fast job** (`fast.yml`, every 10 min): Sheep + RSS feeds only. Commits only when a new article appears, so the repo doesn't fill with empty commits.
- **Full job** (`refresh.yml`, every 3 h): everything, including YouTube/GitHub, plus score refresh. Both share one concurrency group so they never run at once.
- **The page** re-reads `data.js` every minute while the tab is open and updates in place; GitHub Pages itself lags about a minute behind each push. Real per-minute freshness would need a small server (e.g. a Cloudflare Worker on a 1-minute cron) instead of Actions.

## League rankings on the roster cards
Each card also lists the team's **coaches** (from the same sheet; KR coaches aren't in the sheet, so those show a note). Cards are visual: team logo, an accent colour sampled from the logo, a five-segment slot bar, per-role status dots, region logos as the league selector, and a rank-ordered logo strip that scrolls to a card when clicked. In dark mode logos sit on a light plate so dark crests stay visible.

`docs/standings.js` orders each league's cards (rank badge + series record). It is **data copied from Leaguepedia's 2026 standings tables, not a live feed**: Leaguepedia's API rate-limits anonymous callers (it refused my queries), and every league lays its season out differently (LCK/LPL use groups, LCS/LEC/CBLOL a table per split, LCP a Swiss stage), so there is no single table to scrape unattended. Covered: LCK, LPL, LEC, LCS, CBLOL, LCP. Others fall back to A-Z. To refresh after a split ends, run `scripts/extract-standings.browser.js` on lol.fandom.com and paste the result in. `aliases` in that file maps Leaguepedia names to the contract sheet's names.
