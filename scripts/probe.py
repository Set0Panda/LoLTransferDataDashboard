import re, urllib.request, urllib.parse
UA = {"User-Agent": "Mozilla/5.0 (compatible; lol-transfer-radar)"}
def get(u):
    try:
        return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=25).read().decode("utf-8", "replace")
    except Exception as e:
        return "ERR %s" % e
def titles(x, n=12):
    for m in list(re.finditer(r"<item>.*?</item>", x, re.S))[:n]:
        t = re.search(r"<title>(.*?)</title>", m.group(0), re.S); d = re.search(r"<pubDate>(.*?)</pubDate>", m.group(0))
        print("  -", re.sub(r"<!\[CDATA\[|\]\]>", "", t.group(1))[:110], "|", d.group(1)[5:16] if d else "")
for q in ["league of legends (transfer OR rumor OR free agent OR signs OR joins) when:3d", "LCK OR LEC OR LCS OR LPL roster 2027 when:3d", "leagueoflegends esports contract extension when:3d"]:
    print("== GNEWS:", q); titles(get("https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en" % urllib.parse.quote(q)))
print("== HOTSPAWN"); titles(get("https://www.hotspawn.com/feed"), 10)
print("== BING"); titles(get("https://www.bing.com/news/search?q=league+of+legends+roster+transfer&format=rss"))
print("== LOLESPORTS links"); print(sorted(set(re.findall(r"/en-US/news/[a-z0-9-]+", get("https://lolesports.com/en-US/news"))))[:12])
