"""YouTube Data API v3. Needs YOUTUBE_API_KEY. Cost per run ~ 100 quota units per query
(search.list) + 1 per 50 videos (videos.list); free quota is 10,000/day."""
import os
from datetime import datetime, timedelta, timezone
from ..http import get
from .common import fixture, clean, log

API = "https://www.googleapis.com/youtube/v3"


def collect(cfg, fixtures=False):
    c = cfg["youtube"]
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key and not fixtures:
        log("  [youtube] YOUTUBE_API_KEY not set - skipping")
        return []
    after = (datetime.now(timezone.utc) - timedelta(days=c["published_after_days"])).strftime("%Y-%m-%dT%H:%M:%SZ")
    vids = {}
    for q in c["queries"]:
        try:
            if fixtures:
                res = fixture("youtube.json")
                vids.update({v["id"]: v for v in res["items"]})
                break
            s = get(f"{API}/search", as_json=True, params={
                "part": "id", "type": "video", "q": q, "order": "viewCount", "maxResults": c["per_query"],
                "publishedAfter": after, "relevanceLanguage": "en", "key": key})
            ids = [i["id"]["videoId"] for i in s.get("items", [])]
            if not ids:
                continue
            d = get(f"{API}/videos", as_json=True, params={
                "part": "snippet,statistics,contentDetails", "id": ",".join(ids), "key": key})
            vids.update({v["id"]: v for v in d.get("items", [])})
        except Exception as e:
            log(f"  [youtube] '{q}': {e}")
    out = []
    for v in vids.values():
        sn, st = v["snippet"], v.get("statistics", {})
        out.append({
            "source_type": "youtube", "source_name": sn["channelTitle"], "external_id": v["id"],
            "title": clean(sn["title"], 300), "url": f"https://www.youtube.com/watch?v={v['id']}",
            "author": sn["channelTitle"], "summary": clean(sn.get("description", ""), 500),
            "published_at": sn["publishedAt"],
            "metrics": {"views": int(st.get("viewCount", 0)), "likes": int(st.get("likeCount", 0)),
                        "comments": int(st.get("commentCount", 0))},
            "authority": 0.55, "extra": {},
        })
    return out
