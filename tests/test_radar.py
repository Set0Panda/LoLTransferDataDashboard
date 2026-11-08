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
    c, tags, rel = classify.classify(item(source_type="newsletter", source_name="Sheep Esports", title="Anything", category_hint="Transfers & Rumors", lol_ctx=True))
    assert c == "Transfers & Rumors" and rel >= .7


def test_cjk_headlines_classify():
    from radar.classify import classify
    ko = {"title": "[단독] 한화생명 제우스 재계약 협상 난항", "summary": "", "source_name": "X", "source_type": "newsletter", "lol_ctx": True}
    zh = {"title": "英雄联盟 LPL官宣：选手转会加盟新战队", "summary": "", "source_name": "X", "source_type": "newsletter"}
    nba = {"title": "NBA 이적 소식 농구", "summary": "", "source_name": "X", "source_type": "newsletter"}
    assert classify(ko)[0] == "Transfers & Rumors" and classify(ko)[2] >= 0.3
    assert classify(zh)[0] == "Transfers & Rumors" and classify(zh)[2] >= 0.3
    assert classify(nba)[2] < 0.3


def test_non_transfer_headline_is_not_a_transfer():
    from radar.classify import classify
    d = {"title": "Worlds 2026 final preview: Gen.G vs T1", "summary": "", "source_name": "X", "source_type": "newsletter"}
    assert classify(d)[0] != "Transfers & Rumors"
    k = {"title": "[롤드컵] 젠지, 드디어 결승 간다", "summary": "", "source_name": "X", "source_type": "newsletter", "lol_ctx": True}
    assert classify(k)[0] != "Transfers & Rumors"



def test_noise_is_dropped_and_real_moves_kept():
    from radar.classify import classify
    mk = lambda t: {"title": t, "summary": "", "source_name": "Sheep Esports", "source_type": "newsletter"}
    for junk in ["Gen.G vs Invictus Gaming odds & picks - Lol Worlds 2026", "Cloud9 vs Team Liquid 1\u20133 | LCS 2026",
                 "Boaster Parts Ways With Fnatic After Nearly Six Years in VALORANT", "LoL patch 25.15 notes deliver champion nerfs",
                 "Gen.G sweep IG and become the first finalists of Worlds 2026"]:
        assert classify(mk(junk))[2] < 0.3, junk
    for real in ["Sources: Zicssi set to join SK Gaming for the 2027 LEC season", "Perkz Dismissed by G2 Esports Over Controversial Comments",
                 "Team Vitality Target SK Standout Jopa as LEC Botlane Market Freezes", "G2 Esports Begin LEC Rebuild as SkewMond Exits Starting Roster"]:
        assert classify(mk(real))[2] >= 0.3, real


def test_same_headline_same_publisher_is_a_duplicate():
    from radar import db
    con = db.connect(":memory:")
    a = dict(source_type="newsletter", source_name="Sheep Esports", external_id="https://g/1", title="Looki is set to remain with KCB", url="u", author="x", summary="", published_at=None, metrics={}, authority=.9)
    b = dict(a, external_id="https://g/2"); c = dict(a, source_name="Dot Esports", external_id="https://g/3")
    db.upsert(con, a)
    assert db.is_duplicate(con, b) and not db.is_duplicate(con, c) and not db.is_duplicate(con, a)


def test_export_guard_blocks_big_drop(tmp_path):
    import json, pytest
    from radar import export
    p = tmp_path / "d.js"
    p.write_text("window.RADAR = " + json.dumps({"items": [{"id": i, "type": "newsletter"} for i in range(60)]}) + ";\n")
    with pytest.raises(export.ExportBlocked):
        export._guard(str(p), [{"type": "newsletter"}] * 5, False)
    export._guard(str(p), [{"type": "newsletter"}] * 5, True)          # force accepts it
    export._guard(str(p), [{"type": "newsletter"}] * 40, False)        # normal churn passes


def test_contract_guard_rejects_email_and_halved_region(tmp_path):
    import importlib.util
    spec = importlib.util.spec_from_file_location("g", "scripts/guard_contract.py"); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
    old = "window.GCD_META = {\"updated\":{\"EU\":\"2026-01-01\"}};\nwindow.GCD_TEAMS = [[\"EU\",\"LEC\",\"A\",\"A\",\"\"]];\nwindow.GCD_ROWS = " + str([[0, "p%d" % i, "TOP", "2027-01-01"] for i in range(20)]).replace("'", '"') + ";\n"
    half = old.replace('"p%d"' % 0, '"p0"')
    import json
    rows = json.dumps([[0, "p%d" % i, "TOP", "2027-01-01"] for i in range(8)])
    new = old.split("window.GCD_ROWS")[0] + "window.GCD_ROWS = " + rows + ";\n"
    (tmp_path / "o.js").write_text(old); (tmp_path / "n.js").write_text(new); (tmp_path / "m.js").write_text(old + "// a@b.co\n")
    assert g.main([str(tmp_path / "o.js"), str(tmp_path / "o.js")]) == 0
    assert g.main([str(tmp_path / "o.js"), str(tmp_path / "n.js")]) == 1        # -60%, stamp did not move
    assert g.main([str(tmp_path / "o.js"), str(tmp_path / "m.js")]) == 1        # e-mail
