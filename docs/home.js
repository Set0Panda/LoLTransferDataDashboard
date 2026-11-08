/* Home page: what the tool is, live numbers, and doors into the three views. */
(function () {
  const box = document.getElementById("viewHome");
  if (!box) return;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const MS = 864e5, ALIGNED = ["2026-11-16", "2027-11-15", "2028-11-20", "2029-11-19", "2030-11-18"];
  const MOVES = new Set(["Transfers & Rumors", "Contracts & Free Agency", "Roster Announcements"]);
  function render() {
    const NOW = Date.now(), R = window.RADAR || { items: [], meta: {} };
    const items = R.items.filter(i => i.type === "newsletter" && MOVES.has(i.category));
    const week = items.filter(i => NOW - Date.parse(i.published || i.seen) <= 7 * MS).length;
    const players = (window.GCD_ROWS || []).filter(r => ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"].includes(r[2])).length;
    const teams = (window.GCD_TEAMS || []).filter(t => t[1]).length;
    const nx = ALIGNED.find(d => Date.parse(d + "T23:59:00Z") >= NOW), days = nx ? Math.ceil((Date.parse(nx + "T23:59:00Z") - NOW) / MS) : null;
    const latest = items.slice().sort((a, b) => Date.parse(b.published || b.seen) - Date.parse(a.published || a.seen)).slice(0, 6);
    const ago = i => { const d = Math.max(0, Math.round((NOW - Date.parse(i.published || i.seen)) / MS)); return d === 0 ? "today" : d + "d ago"; };
    const t = typeof showTitle === "function" ? showTitle : (x => x);
    const tile = (n, l) => `<div class="hmtile"><b>${esc(n)}</b><span>${esc(l)}</span></div>`;
    const door = (go, h, p, cta) => `<button class="hmdoor" data-go-tab="${go}"><h3>${h}</h3><p>${p}</p><span class="hmcta">${cta} →</span></button>`;
    box.innerHTML = `
      <section class="hmhero"><h2>Every League of Legends roster move, rumour and contract expiry in one place.</h2>
        <p>LoL Transfer Radar combines Riot's contract database with transfer news from the LoL press, so you can see who is out of contract, who is linked with whom, and what each team's lineup could look like next season.</p></section>
      <div class="hmtiles">${tile(players ? players.toLocaleString() : "—", "players with a listed contract")}${tile(teams || "—", "teams across the major regions")}${tile(days != null ? days + (days === 1 ? " day" : " days") : "—", "to the aligned contract end date")}${tile(week, "moves and rumours in the last 7 days")}</div>
      <div class="hmdoors">
        ${door("rosters", "Provisional rosters", "Projected lineups for every team, ordered by league standing. See open slots, who is expiring, and rumoured moves, with the headlines behind them one click away.", "Open rosters")}
        ${door("feed", "Feed &amp; analytics", "The full transfer-news feed, scored for quality and filterable by source, category and date, with charts of where the news is coming from.", "Open the feed")}
        ${door("contract", "Contract Radar", "Every listed contract by end date, a market board by role, what changed since the last snapshot, and how fresh each region's data is.", "Open Contract Radar")}
      </div>
      <div class="hmcols">
        <section class="card"><h3 class="hmh">Latest moves and rumours</h3>${latest.length ? latest.map(i => `<div class="hmnews"><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(t(i.title))}</a><span class="dim">${esc(i.source)} · ${ago(i)}</span></div>`).join("") : '<span class="dim">Nothing recent yet.</span>'}<button class="linkbtn" data-go-tab="feed" style="margin-top:8px">See the whole feed</button></section>
        <section class="card"><h3 class="hmh">How it works</h3><ul class="hmlist">
          <li><b>News</b> is collected every few minutes from LoL outlets (including Sheep Esports via Google News), YouTube and GitHub, then filtered to League of Legends moves only.</li>
          <li><b>Contracts</b> come from Riot's League-Recognized Contract Database, refreshed daily. Each region's sheet is updated on its own schedule, so check how old it is.</li>
          <li><b>Rumours</b> are read from headlines and are unconfirmed. A listed end date is not confirmed free agency: extensions often are not on the sheet yet.</li></ul></section>
      </div>
      <p class="hint">Unofficial fan project, not affiliated with or endorsed by Riot Games. Team logos are trademarks of their owners. Data updated ${esc(R.meta && R.meta.generated ? new Date(R.meta.generated).toLocaleString() : "—")}.</p>`;
    box.querySelectorAll("[data-go-tab]").forEach(b => b.onclick = () => { showTab(b.dataset.goTab); window.scrollTo({ top: 0 }); });
  }
  window.HomeView = { render };
  render();
})();
