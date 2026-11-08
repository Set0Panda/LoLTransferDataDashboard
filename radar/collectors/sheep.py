"""Sheep Esports has no RSS feed, so: read its public article sitemap, then fetch the page of each NEW
LoL article and take only the metadata (title, short description, publish time, tags). We store a
title, a short excerpt, tags and a link back - nothing is copied wholesale and nothing is used for AI training
(robots.txt: Content-Signal search=yes, ai-train=no, use=reference).
Polite by design: one sitemap fetch per run, pages only for URLs not stored yet, capped, with a delay."""
import html as H, re, time
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timedelta, timezone
from ..http import get
from .common import clean, log

BASE = "https://www.sheepesports.com"


def _attrs(tag):
    return {m.group(1): H.unescape(m.group(2)) for m in re.finditer(r'([\w:-]+)="([^"]*)"', tag)}


def parse_article(page):
    metas = [_attrs(m.group(0)) for m in re.finditer(r"<meta\s[^>]*>", page)]
    one = lambda k: next((a.get("content", "") for a in metas if (a.get("property") or a.get("name")) == k), "")
    tags = [a.get("content", "") for a in metas if a.get("property") == "article:tag"]
    art = re.search(r"<article[\s\S]*?</article>", page)
    body = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", art.group(0)) if art else ""
    return {"title": one("og:title"), "desc": one("og:description") or one("description"),
            "published": one("article:published_time"), "tags": tags, "words": len(clean(body, 10**6).split())}


def recent_urls(sitemap_xml, days):
    cut = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    out = []
    for m in re.finditer(r"<loc>([^<]+/en/articles/[^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>", sitemap_xml):
        if m.group(2)[:10] >= cut:
            out.append(m.group(1))
    return out


GNEWS = "https://news.google.com/rss/search"


def parse_gnews(xml_text, known=()):
    """Fallback when the sitemap is blocked (Cloudflare 403s GitHub's runners): Google News RSS for
    site:sheepesports.com gives headline, link and time only - no tags, no LEAK flag, no body."""
    out = []
    for it in ET.fromstring(xml_text).findall(".//item"):
        link = (it.findtext("link") or "").strip()
        title = clean(re.sub(r"\s+-\s+Sheep Esports\s*$", "", it.findtext("title") or ""), 300)
        if not link or not title or link in known:
            continue
        try:
            pub = parsedate_to_datetime(it.findtext("pubDate")).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            pub = None
        out.append({
            "source_type": "newsletter", "source_name": "Sheep Esports", "external_id": link, "title": title,
            "url": link, "author": "Sheep Esports", "summary": "", "published_at": pub,
            "metrics": {"words": 0, "leak": int(title.lower().startswith("sources:"))},
            "authority": 0.9, "extra": {},
            "category_hint": "Transfers & Rumors" if title.lower().startswith("sources:") else None,
        })
    return out


def collect_gnews(c, known):
    q = f'site:sheepesports.com (LoL OR "League of Legends") when:{min(c.get("days", 14), 14)}d'
    xml = get(GNEWS, params={"q": q, "hl": "en-US", "gl": "US", "ceid": "US:en"}, timeout=30,
              headers={"User-Agent": "Mozilla/5.0 (compatible; lol-transfer-radar)"})
    items = parse_gnews(xml, known)
    log(f"  [sheep] fallback via Google News: {len(items)} unseen headlines")
    return items


def collect(cfg, fixtures=False):
    c = cfg.get("sheep", {})
    if fixtures or not c.get("enabled"):
        return []
    known = cfg.get("_known", set())
    try:
        sitemap = get(BASE + "/sitemap-articles.xml", timeout=40)
    except Exception as e:
        log(f"  [sheep] sitemap blocked ({e}); using Google News fallback")
        return collect_gnews(c, known)
    urls = [u for u in recent_urls(sitemap, c.get("days", 14)) if u not in known]
    log(f"  [sheep] {len(urls)} unseen English articles in the last {c.get('days', 14)} days")
    out = []
    for u in urls[: c.get("max_pages", 60)]:
        time.sleep(c.get("delay", 0.6))
        try:
            a = parse_article(get(u, timeout=25))
        except Exception as e:
            log(f"  [sheep] {u}: {e}")
            continue
        tags = [t for t in a["tags"] if t]
        if "lol" not in [t.lower() for t in tags] or not a["title"]:
            continue                                   # other games / non-articles
        leak = any(t.upper() == "LEAK" for t in tags)
        out.append({
            "source_type": "newsletter", "source_name": "Sheep Esports", "external_id": u, "title": clean(a["title"], 300),
            "url": u, "author": "Sheep Esports", "summary": clean(a["desc"], 300) + (" Tags: " + " ".join(tags) if tags else ""),
            "published_at": a["published"] or None,
            "metrics": {"words": a["words"], "leak": int(leak)},
            "authority": 0.9, "extra": {},
            "category_hint": "Transfers & Rumors" if leak or a["title"].lower().startswith("sources:") else None,
        })
    return out
