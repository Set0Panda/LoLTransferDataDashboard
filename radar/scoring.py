"""Quality score 0-100 = engagement 35% + relevance 25% + source authority 20% + freshness 20%.
Absolute log scales (not percentiles) so scores are stable on small datasets and between runs."""
import math, json
from datetime import datetime, timezone

W = {"engagement": 0.35, "relevance": 0.25, "authority": 0.20, "freshness": 0.20}
HALF_LIFE = {"newsletter": 7, "reddit": 5, "youtube": 30, "github": 60}   # days
TIERS = [(70, "High"), (45, "Medium"), (0, "Low")]


def _log(x, cap):
    return min(1.0, math.log10(max(x, 0) + 1) / math.log10(cap + 1))


def engagement(t, m):
    if t == "github":
        return 0.7 * _log(m.get("stars", 0), 1500) + 0.3 * _log(m.get("forks", 0), 200)
    if t == "reddit":
        disc = _log(m.get("comments", 0), 800)
        return 0.6 * _log(m.get("upvotes", 0), 6000) + 0.3 * disc + 0.1 * max(0, (m.get("upvote_ratio", .5) - .5) * 2)
    if t == "youtube":
        v = max(m.get("views", 0), 1)
        like_rate = min(m.get("likes", 0) / v / 0.05, 1)          # 5% like rate = excellent
        return 0.8 * _log(v, 500_000) + 0.2 * like_rate
    # newsletters expose no engagement: reward depth (reads like an article, not a blurb)
    return min(m.get("words", 0) / 700, 1.0)


def freshness(t, published, now=None):
    if not published:
        return 0.3
    now = now or datetime.now(timezone.utc)
    d = datetime.fromisoformat(published.replace("Z", "+00:00"))
    age = max((now - d).total_seconds() / 86400, 0)
    return 0.5 ** (age / HALF_LIFE[t])


def authority(item, flair_trusted):
    a = item.get("authority", 0.5)
    if item["source_type"] == "reddit" and item.get("flair") in flair_trusted:
        a = min(1.0, a + 0.25)
    if item["source_type"] == "github":
        a = 0.35 + 0.35 * min(len((item.get("summary") or "")) / 120, 1) + (0.15 if item.get("language") else 0)
    return a


def score(item, now=None, flair_trusted=()):
    parts = {
        "engagement": engagement(item["source_type"], item["metrics"]),
        "relevance": item["relevance"],
        "authority": authority(item, flair_trusted),
        "freshness": freshness(item["source_type"], item.get("published_at"), now),
    }
    total = round(100 * sum(W[k] * v for k, v in parts.items()))
    tier = next(n for lo, n in TIERS if total >= lo)
    return total, tier, {k: round(v * 100) for k, v in parts.items()}
