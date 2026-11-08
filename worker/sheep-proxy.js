// Cloudflare Worker: fetches Sheep Esports pages for the radar's GitHub Action, which Sheep's Cloudflare blocks
// when the request comes straight from GitHub's servers. Locked down: needs the shared TOKEN, and only ever
// fetches https://www.sheepesports.com/... (it is not an open proxy).
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const token = req.headers.get("x-token") || url.searchParams.get("token");
    if (!env.TOKEN || token !== env.TOKEN) return new Response("forbidden", { status: 403 });
    let target;
    try { target = new URL(url.searchParams.get("u") || ""); } catch { return new Response("bad url", { status: 400 }); }
    if (target.protocol !== "https:" || target.hostname !== "www.sheepesports.com")
      return new Response("host not allowed", { status: 403 });
    const r = await fetch(target.toString(), {
      headers: { "user-agent": "Mozilla/5.0 (compatible; lol-transfer-radar)", accept: req.headers.get("accept") || "*/*" },
      cf: { cacheTtl: 300, cacheEverything: true },          // sitemap/pages cached 5 min: polite to Sheep
    });
    return new Response(r.body, { status: r.status, headers: { "content-type": r.headers.get("content-type") || "text/plain" } });
  },
};
