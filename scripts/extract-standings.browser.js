// Refresh docs/standings.js. Open https://lol.fandom.com in a browser, open the console, paste this file, run it.
// It reads each league's 2026 season page (normal page views, not the rate-limited API) and prints JSON.
// Paste the printed "leagues" object into docs/standings.js (keep "aliases", "asOf", "source").
// PLAN: league -> which standings tables on its season page to use, in order (0-based). Group formats list several
// tables: they're concatenated in that order (e.g. LCK Legend group then Rise group). Check the indices when a
// league's format changes (new split, new stage); the page's table order is what moves.
(async () => {
  const PLAN = { LCK: [3, 4], LPL: [3, 4], LEC: [2], LCS: [2], CBLOL: [2], LCP: [2] };
  const STAGE = { LCK: "2026 Season: Legend group, then Rise group", LPL: "2026 second group stage: Ascend group, then Nirvana group",
                  LEC: "2026 Summer", LCS: "2026 Summer", CBLOL: "2026 Split 2", LCP: "2026 Split 3 Swiss stage" };
  const out = {};
  for (const [lg, idx] of Object.entries(PLAN)) {
    const html = await (await fetch(`/wiki/${lg}/2026_Season`)).text();
    const tabs = [...new DOMParser().parseFromString(html, "text/html").querySelectorAll("table.standings")];
    let teams = [];
    for (const i of idx) for (const r of tabs[i].querySelectorAll("tr")) {
      const c = [...r.querySelectorAll("td,th")];
      if (!/^\d+$/.test((c[0]?.innerText || "").trim())) continue;
      const a = c[1]?.querySelector("a"), s = (c[2]?.innerText || "").match(/(\d+)\s*-\s*(\d+)/);
      const g = (c[4]?.innerText || "").match(/(\d+)\s*-\s*(\d+)/);        // Swiss tables have no games column
      if (a && s) teams.push({ name: a.getAttribute("title"), sw: +s[1], sl: +s[2], gw: g && c.length >= 7 ? +g[1] : 0, gl: g && c.length >= 7 ? +g[2] : 0 });
    }
    out[lg] = { stage: STAGE[lg], teams };
    await new Promise(r => setTimeout(r, 1200));       // be gentle
  }
  console.log(JSON.stringify(out, null, 1));
  return out;
})();
