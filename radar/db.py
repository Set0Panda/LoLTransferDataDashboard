import sqlite3, json, hashlib
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL, url TEXT,
  authority REAL DEFAULT 0.5, last_run TEXT, last_status TEXT,
  UNIQUE(type, name)
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,                    -- sha1(source_type:external_id)
  source_id INTEGER REFERENCES sources(id),
  source_type TEXT NOT NULL,              -- github | reddit | youtube | newsletter
  source_name TEXT NOT NULL,              -- repo owner / subreddit / channel / publication
  external_id TEXT NOT NULL,
  title TEXT NOT NULL, url TEXT NOT NULL, author TEXT, summary TEXT,
  published_at TEXT, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
  metrics TEXT DEFAULT '{}',              -- json: stars, upvotes, comments, views, ...
  category TEXT, tags TEXT DEFAULT '[]',
  relevance REAL DEFAULT 0, quality INTEGER DEFAULT 0, quality_tier TEXT,
  quality_breakdown TEXT DEFAULT '{}',
  UNIQUE(source_type, external_id)
);
CREATE INDEX IF NOT EXISTS idx_items_pub ON items(published_at);
CREATE INDEX IF NOT EXISTS idx_items_cat ON items(category);
CREATE TABLE IF NOT EXISTS snapshots (       -- metric history: gives real star/view velocity
  item_id TEXT, captured_at TEXT, metric TEXT, value REAL
);
CREATE INDEX IF NOT EXISTS idx_snap ON snapshots(item_id, metric, captured_at);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
  title, summary, tags, source_name, tokenize='porter unicode61'
);
"""


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def connect(path):
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    return con


def item_id(source_type, external_id):
    return hashlib.sha1(f"{source_type}:{external_id}".encode()).hexdigest()[:16]


def source_id(con, type_, name, url=None, authority=0.5):
    con.execute("INSERT OR IGNORE INTO sources(type,name,url,authority) VALUES(?,?,?,?)",
                (type_, name, url, authority))
    return con.execute("SELECT id FROM sources WHERE type=? AND name=?", (type_, name)).fetchone()[0]


def is_duplicate(con, it):
    """Same headline from the same publisher under a different link (Google News can hand out several) is one story."""
    if it["source_type"] != "newsletter":
        return False
    return con.execute("SELECT 1 FROM items WHERE source_name=? AND lower(title)=lower(?) AND id<>?",
                       (it["source_name"], it["title"], item_id(it["source_type"], it["external_id"]))).fetchone() is not None


def upsert(con, it):
    """it: dict with source_type, source_name, external_id, title, url, author, summary,
    published_at, metrics(dict), authority. Returns (id, is_new)."""
    iid = item_id(it["source_type"], it["external_id"])
    ts = now()
    sid = source_id(con, it["source_type"], it["source_name"], it.get("source_url"), it.get("authority", 0.5))
    row = con.execute("SELECT id FROM items WHERE id=?", (iid,)).fetchone()
    metrics = json.dumps(it.get("metrics", {}))
    if row:
        con.execute("UPDATE items SET title=?, summary=?, metrics=?, last_seen_at=? WHERE id=?",
                    (it["title"], it.get("summary"), metrics, ts, iid))
    else:
        con.execute("""INSERT INTO items(id,source_id,source_type,source_name,external_id,title,url,author,
                       summary,published_at,first_seen_at,last_seen_at,metrics)
                       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (iid, sid, it["source_type"], it["source_name"], it["external_id"], it["title"], it["url"],
                     it.get("author"), it.get("summary"), it.get("published_at"), ts, ts, metrics))
    for k, v in it.get("metrics", {}).items():
        if isinstance(v, (int, float)):
            con.execute("INSERT INTO snapshots VALUES(?,?,?,?)", (iid, ts, k, v))
    return iid, row is None
