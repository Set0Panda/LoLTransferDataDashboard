/* Provisional rosters: Contract Radar sheet data + confirmed-move overrides + transfer-feed mentions.
   Needs: contract/data.js (GCD_*), contract/logos.js, contract/roles-kr.js, roster-overrides.js, data.js (RADAR). */
(function () {
  const box = document.getElementById("viewRosters");
  if (!box) return;
  if (!window.GCD_TEAMS || !window.GCD_ROWS) { box.innerHTML = '<div class="card empty">Contract data not found (docs/contract/data.js).</div>'; return; }

  const MS = 864e5, NOW = Date.now();
  const STARTERS = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];
  const REGS = ["AME", "CN", "EMEA", "KR", "LCP"];
  const ALIGNED = ["2026-11-16", "2027-11-15", "2028-11-20", "2029-11-19", "2030-11-18"];   // same calendar as Contract Radar
  const TOP_LG = { LEC: 1, LCS: 1, LPL: 1, LCK: 1, LCP: 1, CBLOL: 1 };
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const META = window.GCD_META || { updated: {} }, LOGOS = window.GCD_LOGOS || {}, XR = window.GCD_XROLES || {};
  const MENTION_CATS = new Set(["Transfers & Rumors", "Contracts & Free Agency", "Roster Announcements"]);
  const CODE_STOP = new Set(["RED", "LOS", "ES", "JL", "SR", "IJC", "BKR", "FAST8"]);
  const NAME_STOP = new Set(["top","mid","bot","support","jungle","sub","coach","team","gen","new","one","two","the","lol","riot","worlds","msi","lck","lec","lcs","lpl"]);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const fmtDate = iso => { const d = new Date(iso + "T00:00:00Z"); return d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear(); };

  // ---- aligned end date: slots count as "projected" if the contract runs past it ----
  const next = ALIGNED.find(d => Date.parse(d + "T23:59:00Z") >= NOW) || null;
  const cut = next ? Date.parse(next + "T23:59:00Z") + MS : null;   // sheets sometimes list the day after

  // ---- teams, rows (same cleaning rules as Contract Radar) ----
  const T = window.GCD_TEAMS.map((t, i) => ({ i, reg: t[0], lg: t[1] || "(no league)", name: t[2], code: t[3] }));
  const canon = T.map(t => t.i), seenK = {};
  T.forEach(t => { const k = t.reg + "|" + t.name; if (seenK[k] === undefined) seenK[k] = t.i; else if (t.lg === "(no league)") canon[t.i] = seenK[k]; });
  const HAS_X = Object.keys(XR).length > 0;
  const seen = {}, byKey = {};
  window.GCD_ROWS.forEach(r => (byKey[r[0] + "|" + r[1].toLowerCase()] = byKey[r[0] + "|" + r[1].toLowerCase()] || []).push(r));
  const rows = window.GCD_ROWS.filter(r => {
    const k = r.join("\u0001"); if (seen[k]) return false; seen[k] = 1;
    if (r[2] === "STAFF" && byKey[r[0] + "|" + r[1].toLowerCase()].some(x => x !== r && x[2] !== "STAFF")) return false;
    return true;
  });
  const byTeam = T.map(() => []);
  rows.forEach(r => {
    const ti = canon[r[0]], t = T[ti];
    const p = { name: r[1], role: r[2], end: r[3], res: r[4], ti };
    if (!p.role && t.reg === "KR" && XR[t.name + "|" + p.name]) p.role = XR[t.name + "|" + p.name];
    p.player = STARTERS.includes(p.role) || p.role === "SUB" || (p.role === "" && t.reg === "KR" && !HAS_X);
    p.ms = /^\d{4}-\d\d-\d\d$/.test(p.end) ? Date.parse(p.end + "T23:59:00Z") : null;
    if (p.player) byTeam[ti].push(p);
  });
  const teamByName = {}; T.forEach(t => { teamByName[norm(t.name)] = t.i; });

  // ---- overrides ----
  const OV = (window.ROSTER_OVERRIDES || []).filter(o => o && o.player && (o.from || o.to));
  const leaving = {}, incoming = T.map(() => []), rumorTags = T.map(() => []);
  OV.forEach(o => {
    const f = teamByName[norm(o.from || "")], to = teamByName[norm(o.to || "")];
    if (o.status === "confirmed") {
      if (f !== undefined) leaving[f + "|" + norm(o.player)] = o;
      if (to !== undefined) {
        const src = f !== undefined ? byTeam[f].find(p => norm(p.name) === norm(o.player)) : null;
        incoming[to].push({ name: o.player, role: o.role || (src && src.role) || "", from: o.from, o });
      }
    } else {
      [f, to].forEach(ix => { if (ix !== undefined) rumorTags[ix].push(o); });
    }
  });

  // ---- mentions from the transfer feed ----
  const items = ((window.RADAR && window.RADAR.items) || []).filter(i => MENTION_CATS.has(i.category) && !(window.RADAR.meta && window.RADAR.meta.demo));
  const COMMON = new Set((window.COMMON_WORDS || []).concat(["hype", "potential", "leave", "time", "life"]));   // handles that are also everyday words
  const handleIdx = new Map();      // lowercased handle -> [{ti, p}]
  T.forEach(t => byTeam[t.i].forEach(p => {
    const h = norm(p.name);
    if (h.length < 3 || /\s/.test(h) || NAME_STOP.has(h)) return;
    if (!handleIdx.has(h)) handleIdx.set(h, []); handleIdx.get(h).push({ ti: t.i, p });
  }));
  const teamPat = T.filter(t => t.i === canon[t.i]).map(t => {
    const pats = [norm(t.name)];
    const code = (t.code || "").trim();
    if (code.length >= 2 && !CODE_STOP.has(code.toUpperCase()) && code === code.toUpperCase()) pats.push({ code });
    return { t, pats };
  });
  const playerItems = new Map(), teamItems = T.map(() => []);
  items.forEach(it => {
    if (NOW - Date.parse(it.published || it.seen) > 45 * MS) return;
    const text = it.title + " " + (it.summary || "").slice(0, 300);
    let low = norm(text);
    const hitTeams = new Set();
    teamPat.forEach(({ t, pats }) => {
      for (const p of pats) {
        if (typeof p === "string" ? (p.length >= 4 && low.includes(p)) : new RegExp("(^|[^A-Za-z0-9])" + p.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^A-Za-z0-9]|$)").test(text)) {
          hitTeams.add(t.i); if (typeof p === "string") low = low.split(p).join(" ");   // "Hanwha Life" must not match a player called Life
          break;
        }
      }
    });
    const toks = new Set(low.split(/[^a-z0-9.']+/).filter(Boolean));
    const explicit = new Set(hitTeams), hitPlayers = [];
    toks.forEach(w => { if (handleIdx.has(w)) handleIdx.get(w).forEach(c => hitPlayers.push(c)); });
    hitPlayers.forEach(c => {
      // a handle that is also a common word ("Life", "Time") only counts when its own team is named too
      if (COMMON.has(norm(c.p.name)) && !explicit.has(c.ti)) return;
      // handle shared by several players: prefer the one whose team is also named in the item
      const same = handleIdx.get(norm(c.p.name)); if (same.length > 1 && !hitTeams.has(c.ti) && same.some(s => hitTeams.has(s.ti))) return;
      const k = c.ti + "|" + norm(c.p.name); if (!playerItems.has(k)) playerItems.set(k, []);
      if (!playerItems.get(k).includes(it)) playerItems.get(k).push(it);
      hitTeams.add(c.ti);
    });
    if (hitPlayers.length) hitTeams.forEach(ti => { if (!teamItems[ti].includes(it)) teamItems[ti].push(it); });
  });
  const rank = it => it.quality * Math.pow(.5, (NOW - Date.parse(it.published || it.seen)) / MS / 14);
  const best = arr => arr.slice().sort((a, b) => rank(b) - rank(a));

  // ---- view ----
  const S = { lg: null, q: "", only: false };
  const leaguesWithPlayers = [...new Set(T.filter(t => byTeam[t.i].length && t.i === canon[t.i] && t.lg !== "(no league)").map(t => t.reg + "|" + t.lg))]
    .sort((a, b) => { const [ra, la] = a.split("|"), [rb, lb] = b.split("|"); return REGS.indexOf(ra) - REGS.indexOf(rb) || (TOP_LG[la] ? 0 : 1) - (TOP_LG[lb] ? 0 : 1) || la.localeCompare(lb); });
  S.lg = leaguesWithPlayers.find(k => /\|LCK$/.test(k)) || leaguesWithPlayers[0];

  function logo(t) {
    const d = LOGOS[t.name];
    return d ? `<img class="rlogo" alt="" src="data:image/webp;base64,${d}">`
             : `<span class="rlogo ph" aria-hidden="true">${esc((t.code || t.name).replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase())}</span>`;
  }
  const flag = (arr, label) => arr && arr.length ? `<a class="rflag" href="${esc(best(arr)[0].url)}" target="_blank" rel="noopener" title="${esc(best(arr)[0].title)}">${arr.length} ${label}</a>` : "";

  function card(t) {
    const base = byTeam[t.i].filter(p => !leaving[t.i + "|" + norm(p.name)] || false);
    const gone = byTeam[t.i].filter(p => leaving[t.i + "|" + norm(p.name)]);
    let projected = 0, hasRumor = false, open = false;
    const slots = STARTERS.map(role => {
      const inRole = base.filter(p => p.role === role);
      const signed = inRole.filter(p => p.ms != null && p.ms > cut);
      const expiring = inRole.filter(p => p.ms != null && p.ms <= cut);
      const noDate = inRole.filter(p => p.ms == null);
      const joins = incoming[t.i].filter(x => x.role === role);
      const nm = p => { const m = playerItems.get(t.i + "|" + norm(p.name)); if (m && m.length) hasRumor = true; return `<span class="pl">${esc(p.name)}</span>${flag(m, m && m.length === 1 ? "mention" : "mentions")}`; };
      let main = "";
      joins.forEach(j => { projected++; main += `<div><span class="pl">${esc(j.name)}</span> <span class="tagc">CONFIRMED</span> <span class="ex">from ${esc(j.from || "?")}${j.o.url ? ` · <a href="${esc(j.o.url)}" target="_blank" rel="noopener">source</a>` : ""}</span></div>`; });
      if (signed.length) { projected += joins.length ? 0 : 1; main += signed.map(p => `<div>${nm(p)} <span class="ok">to ${esc(p.end.slice(0, 4))}</span></div>`).join(""); }
      if (!signed.length && !joins.length) { open = true; main += `<div class="open">Open</div>`; }
      if (expiring.length) main += `<div class="ex">${signed.length || joins.length ? "also " : ""}expiring: ${expiring.map(nm).join(", ")}</div>`;
      if (noDate.length) main += `<div class="ex">no end date: ${noDate.map(nm).join(", ")}</div>`;
      return `<div class="rrow"><span class="rl">${role}</span><div>${main}</div></div>`;
    }).join("");
    const subs = base.filter(p => !STARTERS.includes(p.role));
    const subHtml = subs.length ? `<div class="rrow"><span class="rl">OTHER</span><div class="ex">${subs.map(p => esc(p.name) + (p.ms != null ? (p.ms > cut ? ` (to ${esc(p.end.slice(0, 4))})` : " (expiring)") : "")).join(", ")}</div></div>` : "";
    const leftHtml = gone.length ? `<div class="rrow"><span class="rl">LEAVING</span><div class="ex">${gone.map(p => { const o = leaving[t.i + "|" + norm(p.name)]; return esc(p.name) + (o.to ? " → " + esc(o.to) : ""); }).join(", ")} <span class="tagc">CONFIRMED</span></div></div>` : "";
    const news = best(teamItems[t.i]).slice(0, 3);
    const rumorHtml = rumorTags[t.i].length ? rumorTags[t.i].map(o => `<div class="rnews"><span class="tagr">RUMOR</span> ${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">` : ""}${esc(o.player)}${o.from ? " from " + esc(o.from) : ""}${o.to ? " → " + esc(o.to) : ""}${o.url ? "</a>" : ""}${o.note ? ` <span class="ex">${esc(o.note)}</span>` : ""}</div>`).join("") : "";
    const newsHtml = (news.length || rumorHtml) ? `<div class="rnewswrap"><div class="rl">NEWS</div>${rumorHtml}${news.map(i => `<div class="rnews"><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a> <span class="ex">${esc(i.source)} · ${Math.max(0, Math.round((NOW - Date.parse(i.published || i.seen)) / MS))}d</span></div>`).join("")}</div>` : "";
    return { html: `<article class="rcard"><h3>${logo(t)}<span>${esc(t.name)}</span><small>${esc(t.code || "")}</small></h3>
      <p class="rsum">${projected} of 5 starting slots projected for ${next ? new Date(next).getUTCFullYear() + 1 : ""}${hasRumor ? ' · <span class="tagr">linked in news</span>' : ""}</p>${slots}${subHtml}${leftHtml}${newsHtml}</article>`,
      flagged: open || hasRumor || rumorTags[t.i].length > 0 || incoming[t.i].length > 0 };
  }

  function render() {
    if (!next) { box.innerHTML = '<div class="card empty">No aligned end date left in the calendar.</div>'; return; }
    const [reg, lg] = S.lg.split("|");
    const q = norm(S.q).trim();
    const teams = T.filter(t => t.i === canon[t.i] && byTeam[t.i].length && (q ? true : t.reg === reg && t.lg === lg))
      .filter(t => !q || norm(t.name).includes(q) || byTeam[t.i].some(p => norm(p.name).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
    let cards = teams.map(card);
    if (S.only) cards = cards.filter(c => c.flagged);
    const upd = META.updated && META.updated[reg], age = upd ? Math.floor((NOW - Date.parse(upd + "T00:00:00Z")) / MS) : null;
    const warn = age != null && age > 14 && !q ? `<div class="rwarn"><b>This region's sheet is ${age} days old</b> (last updated ${fmtDate(upd)}). Signings and releases since then aren't here unless you add them in <code>roster-overrides.js</code>.</div>` : "";
    const sel = REGS.map(g => {
      const ls = leaguesWithPlayers.filter(k => k.startsWith(g + "|")); if (!ls.length) return "";
      return `<div class="row"><span class="rreg">${g}</span>${ls.map(k => `<button class="chip" data-rlg="${esc(k)}" aria-pressed="${k === S.lg && !q}">${esc(k.split("|")[1])}</button>`).join("")}</div>`;
    }).join("");
    box.innerHTML = `<section class="filters"><div class="row"><input class="search" id="rq" type="search" placeholder="Search a team or player across all leagues…" value="${esc(S.q)}" aria-label="Search rosters">
      <button class="chip" id="ronly" aria-pressed="${S.only}">Only open or flagged teams</button></div>${sel}
      <div class="hint" style="margin:0">Projection for the ${new Date(next).getUTCFullYear() + 1} season: a slot counts as projected when the sheet lists a contract ending after ${fmtDate(next)}, or you've marked a confirmed signing. Open means nobody on the sheet is signed past that date, not that the slot is empty: extensions and signings often aren't on the sheet yet. "Mentions" are headlines from the feed that name the player.</div>${warn}</section>
      <div class="rgrid">${cards.map(c => c.html).join("") || '<div class="card empty">No teams match.</div>'}</div>
      <p class="hint">Contract data and logos come from <a href="https://set0panda.github.io/contract-radar/" target="_blank" rel="noopener">Contract Radar</a> (snapshot ${esc((META.asOf) || "?")}). Team logos are trademarks of their owners.</p>`;
    const rq = document.getElementById("rq");
    rq.oninput = e => { S.q = e.target.value; const pos = e.target.selectionStart; render(); const n = document.getElementById("rq"); n.focus(); n.setSelectionRange(pos, pos); };
    document.getElementById("ronly").onclick = () => { S.only = !S.only; render(); };
    box.querySelectorAll("[data-rlg]").forEach(b => b.onclick = () => { S.lg = b.dataset.rlg; S.q = ""; render(); });
  }
  window.Rosters = { render };
  render();
})();
