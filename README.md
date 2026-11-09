# LoL Transfer Radar

A League of Legends transfer tracker: provisional rosters for every major region, rumours and roster news from the press, and a contract-expiry radar built on Riot's contract database. Unofficial fan project, not affiliated with Riot Games.

**Live site:** https://set0panda.github.io/LoLTransferDataDashboard/

## What's on the site

| Tab | What it shows |
|---|---|
| **Home** | What the tool is, headline numbers, links in |
| **Provisional rosters** | One card (or a matrix row) per team: starters, coach, who is out of contract, projected slots for next season, rumours and news mentions |
| **Feed & analytics** | Every collected item (LoL only), with filters, quality scores and trends |
| **Contract Radar** | Expiry radar, market board, what changed, data health (full issue list) |

## How it stays up to date

| Part | How |
|---|---|
| News (Google News, outlets, Sheep Esports, YouTube, GitHub) | `fast.yml` every 15 min, `refresh.yml` (full) every 3 h |
| External timer | cron-job.org triggers both workflows on time, because GitHub's own scheduler runs hours late. Uses a fine-grained token (Actions: read and write, this repo only). **The token expires after a year: renew it, or the timer stops** (the built-in schedules keep running as a slow backup) |
| Contract data + history | Pulled from Riot's sheet by `scripts/contract_refresh.js` on every full refresh |
| LCK / LPL coaches | `scripts/coach_sync.py` from Leaguepedia roster changes (secrets `LEAGUEPEDIA_USER`, `LEAGUEPEDIA_PASS`); shown with `*`. Riot's sheet has none for those two regions |
| Publishing and tests | GitHub Pages and `ci.yml` on every push |
| **Manual by design** | `docs/standings.js` (card order, copied from Leaguepedia; the site warns after 21 days), `docs/roster-overrides.js` (confirmed signings), `docs/coaches-manual.js` (coach fixes) |

The header shows when the update job last ran and when new items last landed; its dot turns amber, then red, if runs stop arriving.

## Safeguards: bad data never replaces good data

- **Contract sync** (`scripts/guard_contract.py`): up to 15% change per region passes; more needs the sheet's own "last updated" stamp to have moved. A drop over 50%, growth over 100%, a backwards stamp, a missing region or an email address always blocks.
- **Feed export** (`radar/export.py`): if a source type loses more than half its items in one run, `docs/data.js` is not rewritten.
- **Coach sync**: any failure or a suspiciously small result keeps the previous file.
- Override on purpose: run *Refresh radar (full)* manually and tick **force**.

## LoL-only filter

An item passes if it names League explicitly, or a known LoL player handle (after org names are stripped), or a known LoL team together with a League-only role word. A team name alone is not enough, because several orgs also field Valorant or CS. Items below 0.3 relevance are dropped.

## Known limits

- Riot's sheets lag: CN and EMEA are often weeks old. The Data health tab shows each region's age.
- Matching is keyword-based. Rumours are read from headlines and are unconfirmed; expect misses on slang and non-English titles.
- Leaguepedia is volunteer-edited, so coaches can lag the real world.
- GitHub Pages lags about a minute behind each push.

## Run it locally

Python 3.10+, standard library only (pytest for tests).

    python radar.py run --demo        # offline, synthetic data -> open docs/index.html
    python radar.py run               # live run (needs YOUTUBE_API_KEY)
    python radar.py search "jungle contract" --category "Transfers & Rumors"
    python -m pytest tests
    python scripts/bump_assets.py     # re-stamp script URLs after editing a script

| Env var | Used for |
|---|---|
| `YOUTUBE_API_KEY` | YouTube (free quota 10k units/day) |
| `GITHUB_TOKEN` | GitHub search rate limit (automatic in Actions) |
| `LEAGUEPEDIA_USER`, `LEAGUEPEDIA_PASS` | Coach sync (Actions secrets) |

Config lives in `config.json`; categories and scoring in `radar/classify.py` and `radar/scoring.py` (quality = engagement 35% + relevance 25% + authority 20% + freshness 20%).

Visit counts use GoatCounter (no cookies, no personal data); set `docs/site-config.js` to `""` to turn it off. Contract data and logos come from [Contract Radar](https://set0panda.github.io/contract-radar/). Team logos are trademarks of their owners.
