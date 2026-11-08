import sys, json, sqlite3, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))
from radar import db, pipeline, classify, scoring
from radar.collectors import rss
import tests.make_fixtures as mf

def item(**k):
    d = dict(source_type="newsletter", source_name="Test", title="", summary="", metrics={}); d.update(k); return d

def test_classify():
    c, tags, rel = classify.classify(item(title="[Rumor] Kairo linked to Nova Wolves for LCK 2027, sources say"))
    assert c == "Transfers & Rumors" and "LCK" in tags and rel >= 0.6
    assert classify.classify(item(source_type="github", source_name="x", title="x/riot-api-wrapper", summary="league of legends api wrapper signed"))[0] == "Tools & Data"
    assert classify.classify(item(source_type="youtube", source_name="Cooking", title="Best pasta recipe"))[2] == 0

def test_scoring_monotonic():
    base = dict(source_type="github", relevance=.8, published_at=db.now(), summary="x"*130, language="Python", authority=.5)
    lo = scoring.score({**base, "metrics": {"stars": 5}})[0]
    hi = scoring.score({**base, "metrics": {"stars": 900, "forks": 90}})[0]
    assert hi > lo + 10

def test_rss_atom_and_rss():
    rssx = '<rss><channel><item><title>A</title><link>http://a</link><pubDate>Sat, 01 Nov 2026 10:00:00 GMT</pubDate><description>hi there</description></item></channel></rss>'
    atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>B</title><link href="http://b"/><published>2026-11-01T10:00:00Z</published><summary>yo</summary></entry></feed>'
    assert rss.parse(rssx, "n", .5)[0]["url"] == "http://a"
    assert rss.parse(atom, "n", .5)[0]["url"] == "http://b"

def test_pipeline_idempotent_and_search():
    mf.main(); cfg = json.loads((Path(__file__).parents[1] / "config.json").read_text())
    con = db.connect(Path(tempfile.mkdtemp()) / "t.db")
    pipeline.collect(con, cfg, fixtures=True); pipeline.rescore(con, cfg)
    n1 = con.execute("select count(*) from items").fetchone()[0]
    s2 = pipeline.collect(con, cfg, fixtures=True); pipeline.rescore(con, cfg)
    assert con.execute("select count(*) from items").fetchone()[0] == n1       # re-run adds nothing
    assert all(v["new"] == 0 for v in s2.values())
    assert con.execute("select count(*) from snapshots").fetchone()[0] > n1    # but snapshots accumulate
    assert pipeline.search(con, "free agency", category="Transfers & Rumors")

def test_sheep_parse_and_hint():
    from radar.collectors import sheep
    page = ('<html><meta property="og:title" content="Sources: Tactical allowed to explore options by Cloud9"/>'
            '<meta content="Cloud9 allow &amp; explore" property="og:description"/>'
            '<meta property="article:published_time" content="2026-11-08T02:18:00.000Z"/>'
            '<meta property="article:tag" content="LoL"/><meta property="article:tag" content="LEAK"/>'
            '<article><p>one two three</p></article></html>')
    a = sheep.parse_article(page)
    assert a["title"].startswith("Sources:") and a["tags"] == ["LoL", "LEAK"] and a["desc"] == "Cloud9 allow & explore" and a["words"] == 3
    sm = ('<url><loc>https://www.sheepesports.com/en/articles/x/en</loc><lastmod>2999-01-01T00:00:00.000Z</lastmod></url>'
          '<url><loc>https://www.sheepesports.com/de/articles/y/de</loc><lastmod>2999-01-01T00:00:00.000Z</lastmod></url>'
          '<url><loc>https://www.sheepesports.com/en/articles/old/en</loc><lastmod>2020-01-01T00:00:00.000Z</lastmod></url>')
    assert sheep.recent_urls(sm, 14) == ["https://www.sheepesports.com/en/articles/x/en"]
    c, tags, rel = classify.classify(item(source_type="newsletter", source_name="Sheep Esports", title="Anything", category_hint="Transfers & Rumors"))
    assert c == "Transfers & Rumors" and rel >= .7


def test_cjk_headlines_classify():
    from radar.classify import classify
    ko = {"title": "[단독] 한화생명 제우스 재계약 협상 난항", "summary": "", "source_name": "X", "source_type": "newsletter", "lol_ctx": True}
    zh = {"title": "英雄联盟 LPL官宣：选手转会加盟新战队", "summary": "", "source_name": "X", "source_type": "newsletter"}
    nba = {"title": "NBA 이적 소식 농구", "summary": "", "source_name": "X", "source_type": "newsletter"}
    assert classify(ko)[0] == "Transfers & Rumors" and classify(ko)[2] >= 0.3
    assert classify(zh)[0] == "Transfers & Rumors" and classify(zh)[2] >= 0.3
    assert classify(nba)[2] < 0.3
