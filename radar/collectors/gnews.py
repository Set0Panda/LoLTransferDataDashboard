"""Google News RSS searches: one cheap, unblocked route to many publications at once (Dot Esports, EGamersWorld,
Insider Gaming, Hotspawn, Sheep Esports...). Several of those sit behind Cloudflare and refuse GitHub's runners
when fetched directly, but they all show up here. We keep headline, publisher, link and time only -
no tags, no body - so categorising works from the headline. Each publisher becomes its own source in the
dashboard; unknown publishers get a default authority."""
import re, urllib.parse
import xml.etree.ElementTree as ET
from datetime import timezone
from email.utils import parsedate_to_datetime
from ..http import get
from .common import clean, log

URL = "https://news.google.com/rss/search"
UA = {"User-Agent": "Mozilla/5.0 (compatible; lol-transfer-radar)"}


def parse(xml_text, authority, default_auth=0.55, lol=False):
    out = []
    for it in ET.fromstring(xml_text).findall(".//item"):
        link = (it.findtext("link") or "").strip()
        raw = (it.findtext("title") or "").strip()
        pub_el = it.find("source")
        publisher = (pub_el.text or "").strip() if pub_el is not None else ""
        title = raw
        if " - " in raw:                                   # "Headline - Publisher"
            head, tail = raw.rsplit(" - ", 1)
            if not publisher or tail.strip().lower() == publisher.lower():
                title, publisher = head, publisher or tail.strip()
        title = clean(title, 300)
        if not (link and title and publisher):
            continue
        try:
            when = parsedate_to_datetime(it.findtext("pubDate")).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            when = None
        sources_scoop = title.lower().startswith("sources:")
        out.append({
            "source_type": "newsletter", "source_name": publisher, "external_id": link, "title": title,
            "url": link, "author": publisher, "summary": "", "published_at": when,
            "metrics": {"words": 0, "leak": int(sources_scoop)}, "authority": authority.get(publisher, default_auth),
            "extra": {"lol": int(lol)}, "category_hint": "Transfers & Rumors" if sources_scoop else None, "lol_ctx": lol,
        })
    return out


def collect(cfg, fixtures=False):
    c = cfg.get("gnews", {})
    if fixtures or not c.get("enabled"):
        return []
    seen, out = set(), []
    for q in c.get("queries", []):
        hl, gl, lol = "en-US", "US", False             # a query can be {"q":..., "hl":"ko", "gl":"KR", "lol":true}
        if isinstance(q, dict):                        # lol: the query itself guarantees LoL (e.g. contains LCK), so
            q, hl, gl, lol = q["q"], q.get("hl", hl), q.get("gl", gl), q.get("lol", False)   # CJK headlines need no English keywords
        try:
            xml = get(URL, params={"q": f"{q} when:{c.get('days', 7)}d", "hl": hl, "gl": gl, "ceid": f"{gl}:{hl.split('-')[0]}"},
                      headers=UA, timeout=30)
            items = parse(xml, c.get("authority", {}), c.get("default_authority", 0.55), lol)
        except Exception as e:
            log(f"  [gnews] {q[:40]}...: {e}")
            continue
        new = [i for i in items if i["external_id"] not in seen][: c.get("per_query", 40)]
        seen.update(i["external_id"] for i in new)
        out += new
        log(f"  [gnews] {len(items)} results, {len(new)} new for: {q[:60]}")
    return out
