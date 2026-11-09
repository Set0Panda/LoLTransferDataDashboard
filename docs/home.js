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
    const CS = (window.ContractView && window.ContractView.stats) || {};
    const players = CS.players || (window.GCD_ROWS || []).filter(r => ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"].includes(r[2])).length;
    const teams = CS.teams || (window.GCD_TEAMS || []).filter(t => t[1]).length;
    const nx = ALIGNED.find(d => Date.parse(d + "T23:59:00Z") >= NOW), days = nx ? Math.ceil((Date.parse(nx + "T23:59:00Z") - NOW) / MS) : null;
    const latest = items.slice().sort((a, b) => Date.parse(b.published || b.seen) - Date.parse(a.published || a.seen)).slice(0, 6);
    const ago = i => { const d = Math.max(0, Math.round((NOW - Date.parse(i.published || i.seen)) / MS)); return d === 0 ? "today" : d + "d ago"; };
    const t = typeof showTitle === "function" ? showTitle : (x => x);
    const tile = (n, l, k) => `<div class="hmtile t${k}"><b>${esc(n)}</b><span>${esc(l)}</span></div>`;
    const RL = window.GCD_REGLOGOS || {}, REG = [["KR", "LCK"], ["EMEA", "LEC"], ["AME", "LCS"], ["CN", "LPL"], ["LCP", "LCP"]];
    const regs = REG.filter(([g]) => RL[g]).map(([g, l]) => `<button type="button" class="hmreg" data-league="${g}|${l}" title="Open ${l} rosters"><img alt="" src="data:image/webp;base64,${RL[g]}"><b>${l}</b></button>`).join("");
    const radar = `<svg class="hmradar" viewBox="0 0 240 240" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-opacity=".28"><circle cx="120" cy="120" r="108"/><circle cx="120" cy="120" r="76"/><circle cx="120" cy="120" r="44"/><path d="M120 12v216M12 120h216" stroke-opacity=".16"/></g><path class="hmsweep" d="M120 120L120 12A108 108 0 0 1 214 66Z" fill="var(--accent)" fill-opacity=".22"/><circle class="hmblip" cx="170" cy="70" r="5" fill="var(--ok)"/><circle class="hmblip b2" cx="70" cy="150" r="5" fill="var(--warn)"/><circle class="hmblip b3" cx="150" cy="170" r="5" fill="var(--accent)"/><circle class="hmblip b4" cx="92" cy="72" r="4" fill="var(--ok)"/></svg>`;
    const ico = {
      rosters: '<svg viewBox="0 0 24 24"><path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z"/></svg>',
      feed: '<svg viewBox="0 0 24 24"><path d="M4 5h16M4 10h16M4 15h10M4 20h7"/></svg>',
      contract: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>' };
    const door = (go, tone, h, p, cta) => `<button class="hmdoor ${tone}" data-go-tab="${go}"><span class="hmico">${ico[go]}</span><h3>${h}</h3><p>${p}</p><span class="hmcta">${cta} <i>→</i></span></button>`;
    box.innerHTML = `
      <section class="hmhero">${radar}<div class="hmhtxt"><span class="hmkick"><i class="live js-dot"></i><span class="js-status">${esc(window.statusTxt || "Live")}</span></span>
        <h2>Every League of Legends roster move, rumour and contract expiry <em>in one place.</em></h2>
        <p>LoL Transfer Radar combines Riot's contract database with transfer news from the LoL press, so you can see who is out of contract, who is linked with whom, and what each team's lineup could look like next season.</p>
        <div class="hmbtns"><button class="chip hmprimary" data-go-tab="rosters">See provisional rosters</button><button class="chip" data-go-tab="contract">Who is out of contract</button><button class="chip" data-go-tab="feed">Read the feed</button></div>
        <div class="hmregs">${regs}</div></div></section>
      <div class="hmtiles">${tile(players ? players.toLocaleString() : "—", "players with a listed contract", "a")}${tile(teams || "—", "teams across the major regions", "b")}${tile(days != null ? days + (days === 1 ? " day" : " days") : "—", "to the aligned contract end date", "c")}${tile(week, "moves and rumours in the last 7 days", "d")}</div>
      <div class="hmdoors">
        ${door("rosters", "g", "Provisional rosters", "Projected lineups for every team, ordered by league standing. See open slots, who is expiring, and rumoured moves, with the headlines behind them one click away.", "Open rosters")}
        ${door("feed", "b", "Feed &amp; analytics", "The full transfer-news feed, scored for quality and filterable by source, category and date, with charts of where the news is coming from.", "Open the feed")}
        ${door("contract", "a", "Contract Radar", "Every listed contract by end date, a market board by role, what changed since the last snapshot, and how fresh each region's data is.", "Open Contract Radar")}
      </div>
      <div class="hmcols">
        <section class="card"><h3 class="hmh">Latest moves and rumours</h3>${latest.length ? latest.map(i => `<div class="hmnews"><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(t(i.title))}</a><span class="dim">${(window.Rosters && Rosters.leagueOf(i)) ? `<span class="lgtag">${esc(Rosters.leagueOf(i))}</span> ` : ""}${esc(i.source)} · ${ago(i)}</span></div>`).join("") : '<span class="dim">Nothing recent yet.</span>'}<button class="linkbtn" data-go-tab="feed" style="margin-top:8px">See the whole feed</button></section>
        <section class="card"><h3 class="hmh">How it works</h3><ul class="hmlist">
          <li><b>News</b> is collected several times a day from LoL outlets (including Sheep Esports via Google News), YouTube and GitHub, then filtered to League of Legends moves only.</li>
          <li><b>Contracts</b> come from Riot's League-Recognized Contract Database, refreshed with every full update, every few hours (GitHub can run these late). Each region's sheet is updated on its own schedule, so check how old it is.</li>
          <li><b>Rumours</b> are read from headlines and are unconfirmed. A listed end date is not confirmed free agency: extensions often are not on the sheet yet.</li></ul></section>
      </div>
      <p class="hint">Unofficial fan project, not affiliated with or endorsed by Riot Games. Team logos are trademarks of their owners. Anonymous visit counts (no cookies) via GoatCounter.</p>
      <p class="hint">${window.ATTRIB_LEAGUEPEDIA || ""} <span class="js-status">${esc(window.statusTxt || "")}</span>.</p>`;
    box.querySelectorAll("[data-league]").forEach(b => b.onclick = () => {
      const [g, l] = b.dataset.league.split("|");
      if (window.Rosters && Rosters.setLeague) Rosters.setLeague(g + "|" + l);
      showTab("rosters"); window.scrollTo({ top: 0 });
    });
    box.querySelectorAll("[data-go-tab]").forEach(b => b.onclick = () => { showTab(b.dataset.goTab); window.scrollTo({ top: 0 }); });
  }
  window.HomeView = { render };
  render();
})();
