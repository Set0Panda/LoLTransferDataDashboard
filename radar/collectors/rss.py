"""Newsletters / publications via RSS or Atom (Substack, Ghost, WordPress, most media sites).
Add any feed to config.json -> newsletters."""
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from ..http import get
from .common import fixture, clean, log

NS = {"atom": "http://www.w3.org/2005/Atom", "content": "http://purl.org/rss/1.0/modules/content/",
      "dc": "http://purl.org/dc/elements/1.1/"}


def _date(s):
    if not s:
        return None
    try:
        d = parsedate_to_datetime(s)
    except Exception:
        try:
            d = datetime.fromisoformat(s.strip().replace("Z", "+00:00"))
        except Exception:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _txt(el, path):
    x = el.find(path, NS)
    return x.text.strip() if x is not None and x.text else ""


def parse(xml_text, name, authority):
    root = ET.fromstring(xml_text)
    out = []
    entries = root.findall(".//item") or root.findall(".//atom:entry", NS)
    for e in entries:
        link = _txt(e, "link")
        if not link:
            a = e.find("atom:link", NS)
            link = a.get("href") if a is not None else ""
        title = _txt(e, "title") or _txt(e, "atom:title")
        if not (title and link):
            continue
        body = _txt(e, "content:encoded") or _txt(e, "description") or _txt(e, "atom:summary") or _txt(e, "atom:content")
        words = len(clean(body, 100000).split())
        out.append({
            "source_type": "newsletter", "source_name": name,
            "external_id": _txt(e, "guid") or link, "title": clean(title, 300), "url": link,
            "author": _txt(e, "dc:creator") or _txt(e, "atom:author/atom:name") or name,
            "summary": clean(body, 500),
            "published_at": _date(_txt(e, "pubDate") or _txt(e, "atom:published") or _txt(e, "atom:updated")),
            "metrics": {"words": words},
            "authority": authority, "extra": {},
        })
    return out


def collect(cfg, fixtures=False):
    out = []
    for f in cfg["newsletters"]:
        try:
            xml_text = fixture("feed.xml", as_json=False) if fixtures else get(f["url"])
            out += parse(xml_text, f["name"], f.get("authority", 0.6))
        except Exception as e:
            log(f"  [newsletter] {f['name']}: {e}")
        if fixtures:
            break
    return out
