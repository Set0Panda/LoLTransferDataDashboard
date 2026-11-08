/* Provisional rosters: Contract Radar sheet data + confirmed-move overrides + transfer-feed mentions.
   Needs: contract/data.js (GCD_*), contract/logos.js, contract/roles-kr.js, roster-overrides.js, data.js (RADAR). */
(function () {
  const box = document.getElementById("viewRosters");
  if (!box) return;
  if (!window.GCD_TEAMS || !window.GCD_ROWS) { box.innerHTML = '<div class="card empty">Contract data not found (docs/contract/data.js).</div>'; return; }

  const MS = 864e5; let NOW = Date.now();
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
  const norm = s => (s || "").toLowerCase().replace(/ø/g, "o").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
  const byTeam = T.map(() => []), coaches = T.map(() => []), hasCoachData = {};
  const endYear = p => (p.end || "").replace(/^W/, "").slice(0, 4);   // "2027-11-15" and "W2027" (day after Worlds 2027) both -> 2027
  rows.forEach(r => {
    const ti = canon[r[0]], t = T[ti];
    const p = { name: r[1], role: r[2], end: r[3], res: r[4], ti };
    if (!p.role && t.reg === "KR" && XR[t.name + "|" + p.name]) p.role = XR[t.name + "|" + p.name];
    p.player = STARTERS.includes(p.role) || p.role === "SUB" || (p.role === "" && t.reg === "KR" && !HAS_X);
    const wm = /^W(\d{4})$/.exec(p.end || ""), wal = wm && ALIGNED.find(d => d.startsWith(wm[1]));
    p.ms = /^\d{4}-\d\d-\d\d$/.test(p.end) ? Date.parse(p.end + "T23:59:00Z") : wal ? Date.parse(wal + "T23:59:00Z") : null;   // coaches often list "W<year>" = day after Worlds
    if (p.player) byTeam[ti].push(p);
    if (p.role === "COACH") { coaches[ti].push(p); hasCoachData[t.reg] = true; }
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
        const src = f !== undefined ? byTeam[f].concat(coaches[f]).find(p => norm(p.name) === norm(o.player)) : null;
        incoming[to].push({ name: o.player, role: o.role || (src && src.role) || "", from: o.from, o });
      }
    } else {
      [f, to].forEach(ix => { if (ix !== undefined) rumorTags[ix].push(o); });
    }
  });

  // ---- mentions from the transfer feed ----
  const COMMON = new Set((window.COMMON_WORDS || []).concat(["hype", "potential", "leave", "time", "life"]));   // handles that are also everyday words
  const handleIdx = new Map();      // lowercased handle -> [{ti, p}]
  T.forEach(t => byTeam[t.i].concat(coaches[t.i]).forEach(p => {
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
  let playerItems = new Map(), teamItems = T.map(() => []), itemTeams = new Map();
  function buildMentions() {
    NOW = Date.now();
  const items = ((window.RADAR && window.RADAR.items) || []).filter(i => MENTION_CATS.has(i.category) && !(window.RADAR.meta && window.RADAR.meta.demo));
    playerItems = new Map(); teamItems = T.map(() => []); itemTeams = new Map();
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
    const explicit = new Set(hitTeams), hitPlayers = []; itemTeams.set(it, explicit);
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
    hitTeams.forEach(ti => { if (!teamItems[ti].includes(it)) teamItems[ti].push(it); });   // named team or named player: it is that team's news
  });
  }
  buildMentions();
  const rank = it => it.quality * Math.pow(.5, (NOW - Date.parse(it.published || it.seen)) / MS / 14);
  const best = arr => arr.slice().sort((a, b) => rank(b) - rank(a));

  // ---- league rankings (docs/standings.js) ----
  const ST = window.STANDINGS || { leagues: {}, aliases: {} };
  const rankIdx = {};      // "LCK|normalised sheet name" -> {rank, rec}
  Object.entries(ST.leagues || {}).forEach(([lg, v]) => {
    const sheetNames = T.filter(t => t.lg === lg).map(t => t.name);
    v.teams.forEach((x, i) => {
      const want = norm((ST.aliases || {})[x.name] || x.name).replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");
      const hit = sheetNames.find(n => norm(n).replace(/[^a-z0-9]/g, "") === want)
        || sheetNames.find(n => { const m = norm(n).replace(/[^a-z0-9]/g, ""); return m.includes(want) || want.includes(m); });
      if (hit) rankIdx[lg + "|" + norm(hit)] = { rank: i + 1, rec: x.sw + "-" + x.sl };
    });
  });
  const rankOf = t => rankIdx[t.lg + "|" + norm(t.name)];

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
  const RL = window.GCD_REGLOGOS || {};
  const regLogo = g => `<span class="rreg" title="${g}">${RL[g] ? `<img class="rreglogo" alt="${g}" src="data:image/webp;base64,${RL[g]}">` : g}</span>`;
  const accCache = {};
  function applyAccent(card) {          // colour accent sampled from the team logo
    const img = card.querySelector("img.rlogo"); if (!img) return;
    const key = card.dataset.n, set = c => card.style.setProperty("--ac", c);
    if (accCache[key]) { set(accCache[key]); return; }
    const go = () => { try {
      const cv = document.createElement("canvas"); cv.width = cv.height = 24; const x = cv.getContext("2d"); x.drawImage(img, 0, 0, 24, 24);
      const d = x.getImageData(0, 0, 24, 24).data; let r = 0, g = 0, b = 0, w = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); const sat = (mx - mn) / (mx || 1), wt = sat * sat * (mx / 255); if (wt < .02) continue; r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt; }
      if (w > .5) { const c = `rgb(${r / w | 0},${g / w | 0},${b / w | 0})`; accCache[key] = c; set(c); }
    } catch (e) {} };
    img.complete ? go() : (img.onload = go);
  }
  const flag = (arr, label, ti, name) => arr && arr.length ? `<button type="button" class="rflag" data-tm="${ti}" data-pl="${esc(name)}" title="${esc(best(arr)[0].title)}">${arr.length} ${label}</button>` : "";
  const PARTS = {};                       // per-team HTML pieces, reused by the side panel
  const ageD = i => Math.max(0, Math.round((NOW - Date.parse(i.published || i.seen)) / MS));

  function card(t) {
    const rk = rankOf(t);
    const base = byTeam[t.i].filter(p => !leaving[t.i + "|" + norm(p.name)] || false);
    const gone = byTeam[t.i].concat(coaches[t.i]).filter(p => leaving[t.i + "|" + norm(p.name)]);
    let projected = 0, hasRumor = false, open = false;
    const nm = p => { const m = playerItems.get(t.i + "|" + norm(p.name)); if (m && m.length) hasRumor = true; return `<span class="pn" data-h="${esc(norm(p.name))}"><span class="pl">${esc(p.name)}</span>${flag(m, m && m.length === 1 ? "mention" : "mentions", t.i, p.name)}</span>`; };
    const sts = [];
    const slots = STARTERS.map(role => {
      const inRole = base.filter(p => p.role === role);
      const signed = inRole.filter(p => p.ms != null && p.ms > cut);
      const expiring = inRole.filter(p => p.ms != null && p.ms <= cut);
      const noDate = inRole.filter(p => p.ms == null);
      const joins = incoming[t.i].filter(x => x.role === role);
      const st = (signed.length || joins.length) ? "ok" : expiring.length ? "exp" : "open"; sts.push(st);
      let main = "";
      joins.forEach(j => { projected++; main += `<div><span class="pl">${esc(j.name)}</span> <span class="tagc">CONFIRMED</span> <span class="ex">from ${esc(j.from || "?")}${j.o.url ? ` · <a href="${esc(j.o.url)}" target="_blank" rel="noopener">source</a>` : ""}</span></div>`; });
      if (signed.length) { projected += joins.length ? 0 : 1; main += signed.map(p => `<div>${nm(p)} <span class="ok">to ${esc(endYear(p))}</span></div>`).join(""); }
      if (!signed.length && !joins.length) { open = true; main += `<div class="open">Open</div>`; }
      if (expiring.length) main += `<div class="ex">${signed.length || joins.length ? "also " : ""}expiring: ${expiring.map(nm).join(", ")}</div>`;
      if (noDate.length) main += `<div class="ex">no end date: ${noDate.map(nm).join(", ")}</div>`;
      return `<div class="rrow" data-s="${st}"><span class="rl">${role}</span><div>${main}</div></div>`;
    }).join("");
    const cs = coaches[t.i].filter(p => !leaving[t.i + "|" + norm(p.name)]);
    const cSigned = cs.filter(p => p.ms != null && p.ms > cut), cExp = cs.filter(p => p.ms != null && p.ms <= cut), cNo = cs.filter(p => p.ms == null);
    let coachMain = incoming[t.i].filter(x => x.role === "COACH").map(j => `<div><span class="pl">${esc(j.name)}</span> <span class="tagc">CONFIRMED</span> <span class="ex">from ${esc(j.from || "?")}${j.o.url ? ` · <a href="${esc(j.o.url)}" target="_blank" rel="noopener">source</a>` : ""}</span></div>`).join("");
    coachMain += cSigned.map(p => `<div>${nm(p)} <span class="ok">to ${esc(endYear(p))}</span></div>`).join("");
    if (cExp.length) coachMain += `<div class="ex">expiring: ${cExp.map(nm).join(", ")}</div>`;
    if (cNo.length) coachMain += `<div class="ex">no end date: ${cNo.map(nm).join(", ")}</div>`;
    if (!coachMain) coachMain = `<div class="ex">${hasCoachData[t.reg] ? "none listed" : "not in this region's sheet"}</div>`;
    const coachHtml = `<div class="rrow"><span class="rl">COACH</span><div>${coachMain}</div></div>`;
    const subs = base.filter(p => !STARTERS.includes(p.role));
    const subHtml = subs.length ? `<div class="rrow"><span class="rl">OTHER</span><div class="ex">${subs.map(p => esc(p.name) + (p.ms != null ? (p.ms > cut ? ` (to ${esc(endYear(p))})` : " (expiring)") : "")).join(", ")}</div></div>` : "";
    const leftHtml = gone.length ? `<div class="rrow"><span class="rl">LEAVING</span><div class="ex">${gone.map(p => { const o = leaving[t.i + "|" + norm(p.name)]; return esc(p.name) + (o.to ? " → " + esc(o.to) : ""); }).join(", ")} <span class="tagc">CONFIRMED</span></div></div>` : "";
    const news = best(teamItems[t.i]).slice(0, 3);
    const rumorHtml = rumorTags[t.i].length ? rumorTags[t.i].map(o => `<div class="rnews"><span class="tagr">RUMOR</span> ${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">` : ""}${esc(o.player)}${o.from ? " from " + esc(o.from) : ""}${o.to ? " → " + esc(o.to) : ""}${o.url ? "</a>" : ""}${o.note ? ` <span class="ex">${esc(o.note)}</span>` : ""}</div>`).join("") : "";
    const newsHtml = (news.length || rumorHtml) ? `<div class="rnewswrap"><div class="rl">NEWS${teamItems[t.i].length > news.length ? ` · <button type="button" class="linkbtn" data-tm="${t.i}">see all ${teamItems[t.i].length}</button>` : ""}</div>${rumorHtml}${news.map(i => `<div class="rnews"><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a> <span class="ex">${esc(i.source)} · ${Math.max(0, Math.round((NOW - Date.parse(i.published || i.seen)) / MS))}d</span></div>`).join("")}</div>` : "";
    PARTS[t.i] = { slots, coachHtml, subHtml, leftHtml, projected, rumors: rumorHtml };
    const tone = projected >= 4 ? "g" : projected >= 2 ? "a" : "r";
    const bar = `<div class="rbar" title="${projected} of 5 starting slots projected; green = signed past the aligned date, amber = only expiring contracts, grey = open">${sts.map(x => `<i class="${x}"></i>`).join("")}</div>`;
    return { t, projected, tone, rank: rk ? rk.rank : null, html: `<article class="rcard" id="rc-${t.i}" data-n="${esc(t.name)}"><header class="rhead" data-tm="${t.i}" title="Open team panel">${logo(t)}<div class="rtitle"><h3>${esc(t.name)}</h3><div class="rmeta">${rk ? `<span class="rrank" title="Rank in ${esc(t.lg)}">#${rk.rank}</span> ${esc(rk.rec)}` : esc(t.code || "")}</div></div>${bar}</header>
      <p class="rsum">${projected} of 5 starting slots projected for ${next ? new Date(next).getUTCFullYear() + 1 : ""}</p>${hasRumor ? `<div class="rlinked"><button type="button" class="tagr tagbtn" data-tm="${t.i}">LINKED IN NEWS</button></div>` : ""}${slots}${coachHtml}${subHtml}${leftHtml}${newsHtml}</article>`,
      flagged: open || hasRumor || rumorTags[t.i].length > 0 || incoming[t.i].length > 0 };
  }

  function render() {
    if (!next) { box.innerHTML = '<div class="card empty">No aligned end date left in the calendar.</div>'; return; }
    const [reg, lg] = S.lg.split("|");
    const q = norm(S.q).trim();
    const teams = T.filter(t => t.i === canon[t.i] && byTeam[t.i].length && (q ? true : t.reg === reg && t.lg === lg))
      .filter(t => !q || norm(t.name).includes(q) || byTeam[t.i].some(p => norm(p.name).includes(q)))
      .sort((a, b) => { const ra = rankOf(a), rb = rankOf(b); return q ? a.name.localeCompare(b.name) : ((ra ? ra.rank : 999) - (rb ? rb.rank : 999)) || a.name.localeCompare(b.name); });
    let cards = teams.map(card);
    if (S.only) cards = cards.filter(c => c.flagged);
    const strip = (!q && cards.length > 1) ? `<div class="rstrip">${cards.map(c => `<button class="rchip t-${c.tone}" data-go="rc-${c.t.i}" title="${esc(c.t.name)}: ${c.projected}/5 projected">${c.rank ? `<b>#${c.rank}</b>` : ""}${logo(c.t)}<span>${c.projected}/5</span></button>`).join("")}</div>` : "";
    const upd = META.updated && META.updated[reg], age = upd ? Math.floor((NOW - Date.parse(upd + "T00:00:00Z")) / MS) : null;
    const warn = age != null && age > 14 && !q ? `<div class="rwarn"><b>This region's sheet is ${age} days old</b> (last updated ${fmtDate(upd)}). Signings and releases since then aren't here unless you add them in <code>roster-overrides.js</code>.</div>` : "";
    const sv = ST.leagues && ST.leagues[lg];
    const order = q ? "" : sv ? `<div class="hint" style="margin:0">Cards are ordered by league ranking: ${esc(sv.stage)}. Source: ${esc(ST.source || "Leaguepedia")}, as of ${esc(ST.asOf || "?")}. Record shown is series wins-losses.</div>` : `<div class="hint" style="margin:0">No ranking data for ${esc(lg)} yet, so cards are A-Z.</div>`;
    const sel = REGS.map(g => {
      const ls = leaguesWithPlayers.filter(k => k.startsWith(g + "|")); if (!ls.length) return "";
      return `<div class="row">${regLogo(g)}${ls.map(k => `<button class="chip" data-rlg="${esc(k)}" aria-pressed="${k === S.lg && !q}">${esc(k.split("|")[1])}</button>`).join("")}</div>`;
    }).join("");
    box.innerHTML = `<section class="filters"><div class="row"><input class="search" id="rq" type="search" placeholder="Search a team or player across all leagues…" value="${esc(S.q)}" aria-label="Search rosters">
      <button class="chip" id="ronly" aria-pressed="${S.only}">Only open or flagged teams</button></div>${sel}
      <div class="hint" style="margin:0">Projection for the ${new Date(next).getUTCFullYear() + 1} season: a slot counts as projected when the sheet lists a contract ending after ${fmtDate(next)}, or you've marked a confirmed signing. Open means nobody on the sheet is signed past that date, not that the slot is empty: extensions and signings often aren't on the sheet yet. "Mentions" are headlines from the feed that name the player.</div>${order}${warn}</section>
      ${strip}
      <div class="rgrid">${cards.map(c => c.html).join("") || '<div class="card empty">No teams match.</div>'}</div>
      <p class="hint">Contract data and logos come from <a href="https://set0panda.github.io/contract-radar/" target="_blank" rel="noopener">Contract Radar</a> (snapshot ${esc((META.asOf) || "?")}). Team logos are trademarks of their owners.</p>`;
    const rq = document.getElementById("rq");
    rq.oninput = e => { S.q = e.target.value; const pos = e.target.selectionStart; render(); const n = document.getElementById("rq"); n.focus(); n.setSelectionRange(pos, pos); };
    document.getElementById("ronly").onclick = () => { S.only = !S.only; render(); };
    box.querySelectorAll(".rcard").forEach(applyAccent);
    box.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { const el = document.getElementById(b.dataset.go); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("rpulse"); setTimeout(() => el.classList.remove("rpulse"), 1400); } });
    box.querySelectorAll("[data-rlg]").forEach(b => b.onclick = () => { S.lg = b.dataset.rlg; S.q = ""; render(); });
  }
  // ---- side panel: team + roster + every news item that names the team or a player ----
  const dr = document.getElementById("rdrawer"), back = document.getElementById("rd-back");
  let DR = null, lastFocus = null;
  const newsLi = i => `<li class="dn"><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a><div class="ex">${esc(i.source)} · ${ageD(i)}d · ${esc(i.category)}</div></li>`;
  const uniq = arr => { const seen = new Set(); return arr.filter(i => { const k = norm(i.title).replace(/[^a-z0-9]/g, ""); return seen.has(k) ? false : (seen.add(k), true); }); };   // same story via two links
  function paint() {
    if (!dr || !DR) return;
    const t = T[DR.ti]; if (!PARTS[t.i]) card(t);
    const P = PARTS[t.i], rk = rankOf(t), pl = DR.pl;
    const mine = pl && playerItems.get(t.i + "|" + norm(pl)) ? uniq(best(playerItems.get(t.i + "|" + norm(pl)))) : [];
    const mineT = new Set(mine.map(i => norm(i.title))), all = uniq(best(teamItems[t.i])).filter(i => !mineT.has(norm(i.title)));
    let note = "";
    if (mine.length) {              // the sheet can lag: when the headlines mostly name another team, say so
      const away = new Map(); let n = 0;
      mine.forEach(i => { const ts = itemTeams.get(i); if (ts && ts.size && !ts.has(t.i)) { n++; ts.forEach(x => away.set(x, (away.get(x) || 0) + 1)); } });
      const top = [...away.entries()].sort((a, b) => b[1] - a[1])[0];
      if (n * 2 > mine.length && top) note = `<div class="rdnote"><b>Possible move.</b> ${n} of ${mine.length} headlines name ${esc(T[top[0]].name)}, not ${esc(t.name)}. The contract sheet may be out of date for ${esc(pl)}.</div>`;
    }
    dr.style.setProperty("--ac", accCache[t.name] || "var(--line)");
    dr.innerHTML = `<div class="rdhead">${logo(t)}<div class="rtitle"><h3>${esc(t.name)}</h3><div class="rmeta">${esc(t.lg)}${rk ? ` · <span class="rrank">#${rk.rank}</span> ${esc(rk.rec)}` : ""}</div></div><button type="button" class="rdx" aria-label="Close panel">&times;</button></div>
      <p class="rsum">${P.projected} of 5 starting slots projected for ${new Date(next).getUTCFullYear() + 1}</p>
      ${P.slots}${P.coachHtml}${P.subHtml}${P.leftHtml}
      <div class="rdnews">${pl ? `<h4>Mentions of ${esc(pl)} (${mine.length})</h4>${note}<ul>${mine.map(newsLi).join("") || '<li class="ex">None in the last 45 days.</li>'}</ul>` : ""}
        <h4>${pl ? "Other team news" : "Team news"} (${all.length})</h4>${P.rumors ? `<div class="rdr">${P.rumors}</div>` : ""}<ul>${all.map(newsLi).join("") || '<li class="ex">No transfer, contract or roster headlines name this team or its players in the last 45 days. Match coverage is filtered out of the feed.</li>'}</ul>
        <p class="hint">Headlines come from the feed and are matched by team name and player handle, so a hit can be about a different player with the same handle. Only moves, contracts and rosters are kept: match results and previews are filtered out.</p></div>`;
    dr.querySelectorAll(".pn").forEach(e => { if (pl && e.dataset.h === norm(pl)) e.classList.add("hl"); });
    const hl = dr.querySelector(".pn.hl"); if (hl) hl.scrollIntoView({ block: "center" });
  }
  function openDrawer(ti, pl) {
    if (!dr) return;
    lastFocus = document.activeElement; DR = { ti, pl: pl || null }; paint();
    dr.classList.add("open"); back.hidden = false; dr.setAttribute("aria-hidden", "false");
    const x = dr.querySelector(".rdx"); if (x) x.focus();
  }
  function closeDrawer() {
    if (!dr) return; DR = null; dr.classList.remove("open"); back.hidden = true; dr.setAttribute("aria-hidden", "true");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener("click", e => {
    const o = e.target.closest("[data-tm]");
    if (o) { openDrawer(+o.dataset.tm, o.dataset.pl); return; }
    if (e.target.closest(".rdx") || e.target === back) closeDrawer();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && DR) closeDrawer(); });
  window.Rosters = { render, rebuild() { buildMentions(); render(); if (DR) paint(); } };
  render();
})();
