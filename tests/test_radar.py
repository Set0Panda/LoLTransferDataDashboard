import sys, json, sqlite3, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))
from radar import db, pipeline, classify, scoring
from radar.collectors import rss
import tests.make_fixtures as mf

def item(**k):
    d = dict(source_type="reddit", source_name="r/leagueoflegends", title="", summary="", metrics={}); d.update(k); return d

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
