/* Home: the offseason as a live board of moves, newest first. One row per player and destination,
   built from the same parsing the roster cards use (window.Rosters.moves), so the two never disagree. */
(function () {
  const box = document.getElementById("viewHome");
  if (!box) return;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const MOVES = new Set(["Transfers & Rumors", "Contracts & Free Agency", "Roster Announcements"]);
  const ORDER = ["LCK", "LPL", "LEC", "LCS", "CBLOL", "LCP"], SHORT = { "Circuito Desafiante": "CD" };
  const ROLE = { TOP: "Top", JUNGLE: "Jungle", MID: "Mid", BOT: "Bot", SUPPORT: "Support", COACH: "Coach", SUB: "Sub" };
  const S = { lg: "", st: "", n: 30 };
  try { const v = JSON.parse(localStorage.getItem("radar.board") || "{}"); S.lg = v.lg || ""; S.st = v.st || ""; } catch (e) {}
  const save = () => { try { localStorage.setItem("radar.board", JSON.stringify({ lg: S.lg, st: S.st })); } catch (e) {} };

  const ago = (t, now) => {
    const m = Math.max(0, Math.round((now - t) / 6e4));
    return m < 60 ? m + " min" : m < 60 * 36 ? Math.round(m / 60) + " h" : Math.round(m / 1440) + " d";
  };
  const when = t => new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const lgOf = t => SHORT[t.lg] || t.lg;

  function render() {
    const NOW = Date.now(), R = window.RADAR || { items: [] };
    const all = (window.Rosters && Rosters.moves) ? Rosters.moves() : [];
    const logo = t => (window.Rosters && Rosters.logo) ? Rosters.logo(t) : "";
    const counts = {}; all.forEach(m => { const l = lgOf(m.to); counts[l] = (counts[l] || 0) + 1; });
    const leagues = ORDER.filter(l => counts[l]).concat(Object.keys(counts).filter(l => !ORDER.includes(l) && l !== "(no league)").sort((a, b) => counts[b] - counts[a]));
    if (S.lg && !counts[S.lg]) S.lg = "";
    const shown = all.filter(m => (!S.lg || lgOf(m.to) === S.lg) && (!S.st || m.status === S.st));
    const signed = all.filter(m => m.status === "signed").length, rum = all.length - signed;

    const newest = all.find(m => m.last);
    const fresh = newest ? `Last scoop <b>${ago(newest.last, NOW)} ago</b>: ${esc(newest.name)} to ${esc(newest.to.name)}, reported by ${esc(newest.items[newest.items.length - 1].source)}.` : "";

    const row = m => {
      const first = m.first, more = m.items.length - 1;
      const src = first ? `<a href="${esc(first.url)}" target="_blank" rel="noopener">${esc(first.source)}</a>${more > 0 ? ` <span class="mvmore">and ${more} more</span>` : ""}`
                        : (m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">Announcement</a>` : `<span class="mvmore">Checked by hand</span>`);
      const from = m.stay ? `<span class="mvteam mvnone">Stays at</span>` : m.from ? `<span class="mvteam">${logo(m.from)}<span>${esc(m.from.name)}</span></span>` : `<span class="mvteam mvnone">Unknown</span>`;
      return `<li class="mv mv-${m.status}">
        <time datetime="${m.last ? new Date(m.last).toISOString() : ""}" title="${m.last ? esc(when(m.last)) : ""}">${m.last ? ago(m.last, NOW) : ""}</time>
        <span class="mvlg">${esc(lgOf(m.to))}</span>
        <button type="button" class="mvpl" data-tm="${m.to.i}" data-pl="${esc(m.name)}" title="Open ${esc(m.to.name)}'s roster panel">${esc(m.name)}${m.role ? `<small>${esc(ROLE[m.role] || m.role)}</small>` : ""}</button>
        <span class="mvroute">${from}${m.stay ? "" : `<svg class="mvarr" viewBox="0 0 16 10" aria-label="to"><path d="M1 5h13M10 1l4 4-4 4"/></svg>`}<span class="mvteam mvto">${logo(m.to)}<span>${esc(m.to.name)}</span></span></span>
        <span class="mvst">${m.status === "signed" ? (m.stay ? "Re-signed" : "Signed") : "Rumour"}</span>
        <span class="mvsrc">${first ? "First: " : ""}${src}</span>
      </li>`;
    };

    const used = new Set(); all.forEach(m => m.items.forEach(i => used.add(i.url)));
    const other = (R.items || []).filter(i => i.type === "newsletter" && MOVES.has(i.category) && !i.lang && !used.has(i.url))
      .sort((a, b) => Date.parse(b.published || b.seen) - Date.parse(a.published || a.seen)).slice(0, 8);

    const chip = (key, val, label, n) => `<button type="button" class="bchip" data-${key}="${esc(val)}" aria-pressed="${S[key] === val}">${esc(label)}${n != null ? `<span>${n}</span>` : ""}</button>`;

    box.innerHTML = `
      <section class="board">
        <div class="bhead">
          <h2>The 2027 offseason</h2>
          <p class="bfresh">${fresh} <span class="bcheck">The press is checked every 15 minutes.</span></p>
        </div>
        <div class="bfilters">
          <div class="bgroup" role="group" aria-label="League">${chip("lg", "", "All leagues", all.length)}${leagues.map(l => chip("lg", l, l, counts[l])).join("")}</div>
          <div class="bgroup" role="group" aria-label="Status">${chip("st", "", "Everything")}${chip("st", "signed", "Signed", signed)}${chip("st", "rumour", "Rumours", rum)}</div>
        </div>
        ${shown.length ? `<ol class="mvlist">${shown.slice(0, S.n).map(row).join("")}</ol>` :
          `<p class="bempty">No ${S.st === "signed" ? "signings" : S.st === "rumour" ? "rumours" : "moves"}${S.lg ? " in the " + esc(S.lg) : ""} yet. A move appears here as soon as a headline names a player and a team.</p>`}
        ${shown.length > S.n ? `<button type="button" class="btn bmore">Show ${Math.min(30, shown.length - S.n)} more of ${shown.length - S.n}</button>` : ""}
      </section>
      <div class="bcols">
        <section class="bside">
          <h3>Other headlines</h3>
          <p class="bnote">Roster news that doesn't name one player and one team, so it isn't on the board.</p>
          ${other.length ? `<ul class="olist">${other.map(i => `<li><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a><span>${esc(i.source)}, ${ago(Date.parse(i.published || i.seen), NOW)} ago</span></li>`).join("")}</ul>` : `<p class="bnote">Nothing else right now.</p>`}
          <button type="button" class="btn" data-go-tab="feed">Open the full feed</button>
        </section>
        <section class="bside">
          <h3>How this works</h3>
          <p>Headlines from Sheep Esports, Dot Esports, Korean and Chinese outlets and others are read every 15 minutes. A headline that names a player and a team becomes a row. "Signed" means a team announced it or an outlet reported it as done; everything else is a rumour until then.</p>
          <p>Each row credits the outlet that reported it first. Rosters for every team, with who is under contract for 2027, are on the <button type="button" class="linkbtn" data-go-tab="rosters">Rosters</button> tab; expiring deals from Riot's contract database are on <button type="button" class="linkbtn" data-go-tab="contract">Contract Radar</button>.</p>
        </section>
      </div>
      <p class="hint">Unofficial fan project, not affiliated with or endorsed by Riot Games. Team logos are trademarks of their owners. Anonymous visit counts (no cookies) via GoatCounter.</p>
      <p class="hint">${window.ATTRIB_LEAGUEPEDIA || ""}</p>`;

    box.querySelectorAll("[data-lg]").forEach(b => b.onclick = () => { S.lg = b.dataset.lg; S.n = 30; save(); render(); });
    box.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { S.st = b.dataset.st; S.n = 30; save(); render(); });
    const more = box.querySelector(".bmore"); if (more) more.onclick = () => { S.n += 30; render(); };
    box.querySelectorAll("[data-go-tab]").forEach(b => b.onclick = () => { showTab(b.dataset.goTab); window.scrollTo({ top: 0 }); });
  }
  window.HomeView = { render };
  render();
})();
