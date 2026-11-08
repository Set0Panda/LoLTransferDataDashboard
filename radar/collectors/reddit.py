"""Reddit: top posts per subreddit. Uses OAuth app-only auth when REDDIT_CLIENT_ID/SECRET are set
(recommended - unauthenticated .json is often 403 from datacentre / CI IPs), else public .json."""
import base64, os, urllib.parse
from datetime import datetime, timezone
from ..http import get
from .common import fixture, clean, log


def _token():
    cid, sec = os.environ.get("REDDIT_CLIENT_ID"), os.environ.get("REDDIT_CLIENT_SECRET")
    if not (cid and sec):
        return None
    auth = base64.b64encode(f"{cid}:{sec}".encode()).decode()
    body = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    r = get("https://www.reddit.com/api/v1/access_token", headers={"Authorization": f"Basic {auth}"},
            data=body, as_json=True)
    return r["access_token"]


def collect(cfg, fixtures=False):
    c = cfg["reddit"]
    out = []
    token = None if fixtures else _safe_token()
    base = "https://oauth.reddit.com" if token else "https://www.reddit.com"
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    for sub in c["subreddits"]:
        try:
            data = fixture("reddit.json") if fixtures else get(
                f"{base}/r/{sub}/top.json", headers=headers, as_json=True,
                params={"t": c["time_filter"], "limit": c["limit"], "raw_json": 1})
        except Exception as e:
            log(f"  [reddit] r/{sub}: {e}")
            continue
        for ch in data["data"]["children"]:
            d = ch["data"]
            if d.get("stickied") or d.get("score", 0) < c["min_score"]:
                continue
            out.append({
                "source_type": "reddit", "source_name": f"r/{d['subreddit']}",
                "external_id": d["id"], "title": clean(d["title"], 300),
                "url": "https://www.reddit.com" + d["permalink"], "author": d.get("author"),
                "summary": clean(d.get("selftext", ""), 500),
                "published_at": datetime.fromtimestamp(d["created_utc"], timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "metrics": {"upvotes": d["score"], "comments": d["num_comments"],
                            "upvote_ratio": d.get("upvote_ratio", 0.5)},
                "authority": 0.55, "extra": {"flair": d.get("link_flair_text")},
            })
        if fixtures:
            break
    return out


def _safe_token():
    try:
        return _token()
    except Exception as e:
        log(f"  [reddit] OAuth failed, falling back to public JSON: {e}")
        return None
