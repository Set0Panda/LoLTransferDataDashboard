"""GitHub: repo search per query. 'Trending' = recently pushed + starred; true star velocity
comes from our own snapshots table once the pipeline has run on more than one day."""
import os
from datetime import datetime, timedelta, timezone
from ..http import get
from .common import fixture, clean, log

API = "https://api.github.com/search/repositories"


def collect(cfg, fixtures=False):
    c = cfg["github"]
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    since = (datetime.now(timezone.utc) - timedelta(days=cfg.get("max_age_days", 120))).strftime("%Y-%m-%d")
    seen, out = set(), []
    for q in c["queries"]:
        try:
            if fixtures:
                data = fixture("github.json")
            else:
                data = get(API, headers=headers, as_json=True,
                           params={"q": f"{q} pushed:>{since} stars:>={c['min_stars']}",
                                   "sort": "stars", "order": "desc", "per_page": c["per_query"]})
        except Exception as e:
            log(f"  [github] '{q}': {e}")
            continue
        for r in data.get("items", []):
            if r["full_name"] in seen:
                continue
            seen.add(r["full_name"])
            out.append({
                "source_type": "github", "source_name": r["owner"]["login"],
                "external_id": r["full_name"], "title": r["full_name"], "url": r["html_url"],
                "author": r["owner"]["login"],
                "summary": clean((r.get("description") or "") + " " + " ".join(r.get("topics", []))),
                "published_at": r.get("pushed_at") or r.get("created_at"),
                "metrics": {"stars": r["stargazers_count"], "forks": r["forks_count"],
                            "issues": r.get("open_issues_count", 0),
                            "age_days": _age(r.get("created_at"))},
                "authority": 0.5,
                "extra": {"language": r.get("language"), "archived": r.get("archived", False)},
            })
        if fixtures:
            break
    return [r for r in out if not r["extra"]["archived"]]


def _age(iso):
    if not iso:
        return 0
    d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - d).days
