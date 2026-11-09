/* Contract Radar view: native version of the Contract Radar site, built from the same snapshot (contract/data.js + history.js).
   Sub-tabs: Expiry radar, Market board, What changed, Data health. Region cards filter all of them. */
(function () {
  const box = document.getElementById("viewContract");
  if (!box) return;
  if (!window.GCD_TEAMS || !window.GCD_ROWS) { box.innerHTML = '<div class="card empty">Contract data not found (docs/contract/data.js).</div>'; return; }

  const MS = 864e5, MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const STARTERS = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"], ROLES = STARTERS.concat(["SUB", "COACH", "STAFF"]);
  const REGS = ["AME", "CN", "EMEA", "KR", "LCP"];
  const ALIGNED = ["2026-11-16", "2027-11-15", "2028-11-20", "2029-11-19", "2030-11-18"];
  const META = window.GCD_META || { updated: {} }, LOGOS = new Proxy({}, { get: (_, k) => (window.GCD_LOGOS || {})[k] }), XR = window.GCD_XROLES || {}, RL = window.GCD_REGLOGOS || {};
  const HIST = (window.GCD_HISTORY && window.GCD_HISTORY.events) || [], SINCE = window.GCD_HISTORY && window.GCD_HISTORY.since;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const fmt = iso => { const d = new Date(iso + "T00:00:00Z"); return d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear(); };
  const dayAfter = iso => new Date(Date.parse(iso + "T00:00:00Z") + MS).toISOString().slice(0, 10);
  const ALSET = {}; ALIGNED.forEach(d => { ALSET[d] = 1; ALSET[dayAfter(d)] = 1; });
  let NOW = Date.now();
  const alignedEnd = d => Date.parse(d + "T23:59:00Z");
  const nextAligned = () => ALIGNED.find(d => alignedEnd(d) >= NOW) || null;
  const prevAligned = () => { let p = null; ALIGNED.forEach(d => { if (alignedEnd(d) < NOW) p = d; }); return p; };

  // ---- rows (same cleaning rules as Contract Radar) ----
  const T = window.GCD_TEAMS.map((t, i) => ({ i, reg: t[0], lg: t[1] || "(no league)", name: t[2], code: t[3] }));
  const canon = T.map(t => t.i), seenK = {};
  T.forEach(t => { const k = t.reg + "|" + t.name; if (seenK[k] === undefined) seenK[k] = t.i; else if (t.lg === "(no league)") canon[t.i] = seenK[k]; });
  const HAS_X = Object.keys(XR).length > 0;
  const byKey = {}, seen = {}; let dupes = {};
  window.GCD_ROWS.forEach(r => (byKey[r[0] + "|" + r[1].toLowerCase()] = byKey[r[0] + "|" + r[1].toLowerCase()] || []).push(r));
  const P = [];
  window.GCD_ROWS.forEach(r => {
    const k = r.join("\u0001"), t = T[canon[r[0]]];
    if (seen[k]) { dupes[t.reg] = (dupes[t.reg] || 0) + 1; return; } seen[k] = 1;
    if (r[2] === "STAFF" && byKey[r[0] + "|" + r[1].toLowerCase()].some(x => x !== r && x[2] !== "STAFF")) return;
    const p = { name: r[1], role: r[2], end: r[3] || "", res: r[4], t };
    let xr = false;
    if (!p.role && t.reg === "KR" && XR[t.name + "|" + p.name]) { p.role = XR[t.name + "|" + p.name]; xr = true; }
    p.xr = xr;
    p.player = STARTERS.includes(p.role) || p.role === "SUB" || (p.role === "" && t.reg === "KR" && !HAS_X);
    const wm = /^W(\d{4})$/.exec(p.end), wal = wm && ALIGNED.find(d => d.startsWith(wm[1]));
    p.ms = /^\d{4}-\d\d-\d\d$/.test(p.end) ? Date.parse(p.end + "T23:59:00Z") : wal ? alignedEnd(wal) : null;
    P.push(p);
  });
  const regCount = {}; P.forEach(p => { if (p.player) regCount[p.t.reg] = (regCount[p.t.reg] || 0) + 1; });

  // ---- state ----
  const S = { sub: "radar", regs: new Set(), q: "", lg: "", role: "", win: "all", ended: false, noEnd: false, staff: false, sort: "ms", dir: 1, shown: 100, mwin: "aligned", hopen: false, hsev: "", hkey: "", hq: "", hshown: 60 };
  const days = p => Math.ceil((p.ms - NOW) / MS);
  const age = reg => { const u = META.updated && META.updated[reg]; return u ? Math.floor((NOW - Date.parse(u + "T00:00:00Z")) / MS) : null; };
  const ageTag = a => a == null ? ["Unknown", "r"] : a <= 14 ? ["Current", "g"] : a <= 45 ? ["Aging", "a"] : ["Stale", "r"];
  const logo = t => LOGOS[t.name] ? `<img class="rlogo" alt="" src="data:image/webp;base64,${LOGOS[t.name]}">` : `<span class="rlogo ph" aria-hidden="true">${esc((t.code || t.name).replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase())}</span>`;
  const regLogo = g => RL[g] ? `<img class="rreglogo" alt="${g}" src="data:image/webp;base64,${RL[g]}">` : `<b>${g}</b>`;
  const endCell = p => p.ms == null ? '<span class="dim">no end date</span>' : p.ms < NOW ? `${esc(fmt(new Date(p.ms).toISOString().slice(0, 10)))} <span class="crt r">ended</span>`
    : `${esc(p.end.startsWith("W") ? "After Worlds " + p.end.slice(1) : fmt(p.end))} <span class="dim">· ${days(p)}d</span>`;
  const base = skip => P.filter(p => {
    if (S.regs.size && !S.regs.has(p.t.reg)) return false;
    if (!S.staff && !p.player) return false;
    if (S.lg && p.t.lg !== S.lg) return false;
    if (S.role && p.role !== S.role) return false;
    if (S.q) { const q = norm(S.q); if (!norm(p.name).includes(q) && !norm(p.t.name).includes(q)) return false; }
    return true;
  });

  // ---- header: countdown + region freshness ----
  function head() {
    const nx = nextAligned(), pv = prevAligned();
    let al;
    if (pv && NOW - alignedEnd(pv) < 21 * MS) al = `<b>Free agency opened</b> after the aligned end date (${esc(fmt(pv))}). Listed contracts ending on or before it have expired.`;
    else if (nx) { const d = Math.ceil((alignedEnd(nx) - NOW) / MS); al = `<b>${d} day${d === 1 ? "" : "s"}</b> to the aligned contract end date (${esc(fmt(nx))}, 23:59 UTC). Free agency opens the day after.`; }
    else al = "No aligned end date left in the calendar.";
    const cards = REGS.filter(g => regCount[g]).map(g => {
      const a = age(g), [lab, tone] = ageTag(a), n30 = P.filter(p => p.t.reg === g && p.player && p.ms != null && p.ms >= NOW && p.ms - NOW <= 30 * MS).length;
      return `<button class="crreg" data-reg="${g}" aria-pressed="${S.regs.has(g)}"><span class="crrl">${regLogo(g)}<b>${g}</b><span class="crt ${tone}">${lab}</span></span><span class="crrn">${regCount[g]} players · ${n30} end within 30 days</span><span class="dim">sheet ${a == null ? "date unknown" : a + " days old"}</span></button>`;
    }).join("");
    return `<div class="crbar">${al}</div><div class="crregs">${cards}</div>`;
  }

  // ---- Expiry radar ----
  const SORTS = { name: p => norm(p.name), role: p => ROLES.indexOf(p.role), team: p => norm(p.t.name), lg: p => p.t.lg, reg: p => REGS.indexOf(p.t.reg), ms: p => p.ms == null ? 9e15 : p.ms };
  function radar() {
    const cut = nextAligned() ? alignedEnd(nextAligned()) + MS : null;
    let list = base().filter(p => {
      if (S.win === "ended") return p.ms != null && p.ms < NOW;
      if (p.ms == null) return S.noEnd;
      if (p.ms < NOW && !S.ended) return false;
      if (S.win === "30") return p.ms >= NOW && p.ms - NOW <= 30 * MS;
      if (S.win === "60") return p.ms >= NOW && p.ms - NOW <= 60 * MS;
      if (S.win === "aligned") return cut != null && p.ms >= NOW && p.ms <= cut;
      return true;
    });
    const f = SORTS[S.sort]; list.sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * S.dir || norm(a.name).localeCompare(norm(b.name)); });
    const lgs = [...new Set(base().map(p => p.t.lg))].sort(), shown = list.slice(0, S.shown);
    const th = (k, l) => `<button class="crth" data-sort="${k}">${l}${S.sort === k ? (S.dir > 0 ? " ↑" : " ↓") : ""}</button>`;
    return `<section class="filters"><div class="row"><input class="search" id="cq" type="search" placeholder="Search a player or team…" value="${esc(S.q)}" aria-label="Search">
      <select id="clg" aria-label="League"><option value="">All leagues</option>${lgs.map(l => `<option ${l === S.lg ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
      <select id="cwin" aria-label="Window">${[["all", "All current contracts"], ["30", "Ends within 30 days"], ["60", "Ends within 60 days"], ["aligned", "Ends by the aligned date"], ["ended", "Already ended (still listed)"]].map(([v, l]) => `<option value="${v}" ${S.win === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="row">${["", ...ROLES].map(r => `<button class="chip" data-role="${r}" aria-pressed="${S.role === r}">${r || "All roles"}</button>`).join("")}
      <span class="seg"><button class="chip" id="cended" aria-pressed="${S.ended}">Include ended</button><button class="chip" id="cnoend" aria-pressed="${S.noEnd}">Include no end date</button><button class="chip" id="cstaff" aria-pressed="${S.staff}">Coaches &amp; staff</button></span></div></section>
      <div class="hint" style="margin:0 0 8px"><b>${list.length}</b> listings. Listed end dates are not confirmed free agency: extensions can be signed at any time and may not be on the sheet yet. Res: R = resident, N = non-resident.</div>
      <div class="tablewrap"><div class="crtbl"><div class="crrow crhd">${th("name", "Player")}${th("role", "Role")}${th("team", "Team")}${th("lg", "League")}${th("ms", "Contract ends")}<span>Res</span></div>
      ${shown.map(p => `<div class="crrow"><b>${esc(p.name)}</b><span>${esc(p.role || "—")}${p.xr ? ' <span class="dim" title="Role from Leaguepedia, not Riot">*</span>' : ""}</span><span class="crteam">${logo(p.t)}${esc(p.t.name)}</span><span>${esc(p.t.lg)} <span class="dim">· ${p.t.reg}</span></span><span>${endCell(p)}</span><span class="dim">${esc(p.res || "")}</span></div>`).join("") || '<div class="card empty" style="margin:10px">Nothing matches these filters.</div>'}</div></div>
      ${list.length > shown.length ? `<button class="chip" id="cmore" style="margin-top:10px">Show ${Math.min(100, list.length - shown.length)} more (${list.length - shown.length} hidden)</button>` : ""}`;
  }

  // ---- Market board ----
  function market() {
    const nx = nextAligned(), cuts = [];
    if (nx) cuts.push(["aligned", `By ${fmt(dayAfter(nx))} (aligned end date)`, alignedEnd(nx) + MS]);
    cuts.push(["d30", "Next 30 days", NOW + 30 * MS], ["eoy", "By 31 Dec " + new Date(NOW).getUTCFullYear(), Date.parse(new Date(NOW).getUTCFullYear() + "-12-31T23:59:00Z")], ["any", "Any listed end date", 9e15]);
    if (!cuts.some(c => c[0] === S.mwin)) S.mwin = cuts[0][0];
    const cut = cuts.find(c => c[0] === S.mwin)[2];
    const rows = base().filter(p => p.player && p.ms != null && p.ms >= NOW && p.ms <= cut).sort((a, b) => a.ms - b.ms);
    const cols = STARTERS.map(r => [r, rows.filter(p => p.role === r)]);
    return `<section class="filters"><div class="row">${cuts.map(c => `<button class="chip" data-mwin="${c[0]}" aria-pressed="${S.mwin === c[0]}">${esc(c[1])}</button>`).join("")}</div></section>
      <div class="hint" style="margin:0 0 10px"><b>${rows.length}</b> players have a listed contract ending in this window${S.regs.size ? " in " + [...S.regs].join(", ") : ""}. This shows who is exposed, not who is available: renewals may not be on the sheet yet.</div>
      <div class="crmk">${cols.map(([r, l]) => `<div class="card crcol"><h3>${r}<em>${l.length}</em></h3>${l.slice(0, 40).map(p => `<div class="crmp"><span class="crteam">${logo(p.t)}<span><b>${esc(p.name)}</b><br><span class="dim">${esc(p.t.name)}</span></span></span><span class="dim">${esc(p.end.startsWith("W") ? p.end.slice(1) : p.end.slice(5).replace("-", "/") + " · " + days(p) + "d")}</span></div>`).join("") || '<span class="dim">Nobody in this window.</span>'}${l.length > 40 ? `<span class="dim">+${l.length - 40} more (narrow by region)</span>` : ""}</div>`).join("")}</div>`;
  }

  // ---- What changed ----
  function changes() {
    const ev = HIST.filter(e => !S.regs.size || e[1] === "*" || P.some(p => p.t.name === e[1] && S.regs.has(p.t.reg)));
    const label = { add: ["New listing", "g"], rm: ["Removed", "r"], end: ["End date moved", "a"], role: ["Role changed", "a"], bulk: ["Bulk update", "a"] };
    const byDay = {}; ev.forEach(e => (byDay[e[0]] = byDay[e[0]] || []).push(e));
    const ds = Object.keys(byDay).sort().reverse();
    return `<div class="hint" style="margin:0 0 10px">Changes between daily snapshots of the sheet${SINCE ? ", tracked since " + esc(fmt(SINCE)) : ""}. A new listing, a removed one, a moved end date or a role change. It fills in as the sheet changes.</div>` +
      (ds.length ? ds.map(d => `<div class="card" style="margin-bottom:10px"><h3 style="margin:0 0 6px;font-size:14px">${esc(fmt(d))}</h3>${byDay[d].map(e => {
        const [l, tone] = label[e[3]] || [e[3], "a"];
        return `<div class="crch"><span class="crt ${tone}">${l}</span>${e[3] === "bulk" ? `${e[4]} added, ${e[5]} removed (too many to list)` : `<b>${esc(e[2])}</b> <span class="dim">${esc(e[1])}</span>${e[3] === "add" ? ` ends ${esc(e[5] || "—")}` : e[3] === "rm" ? "" : ` ${esc(e[4] || "—")} → ${esc(e[5] || "—")}`}`}</div>`;
      }).join("")}</div>`).join("") : `<div class="card empty">No changes recorded yet${SINCE ? " since " + esc(fmt(SINCE)) : ""}. The sheet is checked daily and anything that moves shows up here.</div>`);
  }

  // ---- Data health: every individual issue (port of Contract Radar's checks, on the cleaned rows) ----
  const TOP_LG = { LEC: 1, LCS: 1, LPL: 1, LCK: 1, LCP: 1, CBLOL: 1 }, SEVN = { high: "High", med: "Medium", low: "Low" };
  let FINDINGS = null;
  function buildFindings() {
    const F = [], add = (sev, key, label, t, detail, reg) => F.push({ sev, key, label, t, detail, reg: t ? t.reg : reg });
    const short = iso => { const d = new Date(iso + "T00:00:00Z"); return d.getUTCDate() + " " + MON[d.getUTCMonth()]; };
    const list = (a, n, f) => a.slice(0, n).map(f).join(", ") + (a.length > n ? " and " + (a.length - n) + " more" : "");
    REGS.forEach(g => {
      const a = age(g), u = META.updated && META.updated[g]; if (a == null) return;
      if (a > 60) add("high", "stale", "Region sheet looks stale", null, `${g} sheet last updated ${fmt(u)} (${a} days ago). Contract ends and rosters may be out of date.`, g);
      else if (a > 30) add("med", "stale", "Region sheet looks stale", null, `${g} sheet last updated ${fmt(u)} (${a} days ago).`, g);
    });
    const byT = {}, L = {}, hasCoach = {};
    P.forEach(p => { (byT[p.t.i] = byT[p.t.i] || []).push(p); if (p.role === "COACH") hasCoach[p.t.reg] = 1; });
    Object.keys(byT).forEach(i => { const t = T[i], o = L[t.lg] = L[t.lg] || { reg: t.reg, players: 0, end: 0, res: 0, role: 0, teams: {} }; o.teams[i] = 1;
      byT[i].forEach(r => { if (!r.player) return; o.players++; if (r.end) o.end++; if (r.res) o.res++; if (r.role) o.role++; }); });
    Object.keys(L).forEach(lg => { const o = L[lg], nt = Object.keys(o.teams).length; if (!o.players) return;
      if (!o.end) add("low", "cov-end", "League publishes no end dates", null, `${lg}: ${o.players} players across ${nt} teams have no contract end date.`, o.reg);
      if (!o.res) add("low", "cov-res", "League publishes no residency", null, `${lg}: none of the ${o.players} players has a residency status.`, o.reg); });
    const AN = nextAligned();
    Object.keys(byT).forEach(i => {
      const t = T[i], rows = byT[i], L0 = L[t.lg] || {}, players = rows.filter(r => r.player);
      if (t.reg === "KR") { if (players.length && players.length < 5) add("high", "thin", "Roster looks too thin", t, `Only ${players.length} players listed.`); }
      else {
        const have = {}; players.forEach(r => { have[r.role] = 1; });
        const sev = TOP_LG[t.lg] ? "high" : "med";
        if (!players.length) add(sev, "no-players", "No players listed", t, `Only staff rows (${rows.length}) are listed for this team.`);
        else { const miss = STARTERS.filter(x => !have[x]); if (miss.length && L0.role) add(sev, "missing-role", "Starting role missing", t, `No ${miss.join(", ")} listed. ${players.length} player${players.length === 1 ? "" : "s"} on the sheet.`); }
        if (hasCoach[t.reg] && TOP_LG[t.lg] && !rows.some(r => r.role === "COACH")) add("med", "no-coach", "No coach listed", t, "Top-flight team with no coach row.");
      }
      const seen = {}; rows.forEach(r => { (seen[r.name.toLowerCase()] = seen[r.name.toLowerCase()] || []).push(r); });
      Object.values(seen).forEach(g => { if (g.length < 2) return;
        if (g.every(r => r.role === g[0].role)) add("high", "dup-in-team", "Duplicate entry on the same team", t, `“${g[0].name}” is listed ${g.length} times as ${g[0].role || "N/A"}.`);
        else add("low", "multi-role", "Same person under two roles", t, `“${g[0].name}”: ${g.map(r => r.role || "N/A").join(" and ")}.`); });
      const exp = rows.filter(r => r.ms != null && r.ms < NOW).sort((a, b) => a.ms - b.ms);
      if (exp.length) { const oldest = Math.max(...exp.map(r => Math.floor((NOW - r.ms) / MS)));
        add(oldest > 30 ? "med" : "low", "expired", "Contract end date already passed", t, `${exp.length} listing${exp.length === 1 ? "" : "s"}, oldest ended ${oldest} days ago: ${list(exp, 4, r => `${r.name} (${short(r.end)})`)}.`); }
      if (AN) { const offc = players.filter(r => r.ms != null && /^\d{4}-/.test(r.end) && r.end > dayAfter(AN) && !ALSET[r.end]).sort((a, b) => a.ms - b.ms);
        if (offc.length) add("low", "off-cal", "End date off the aligned calendar", t, `Contracts should end on an aligned date (${short(AN)} next) or be short deals ending before it. Check: ${list(offc, 5, r => `${r.name} (${short(r.end)})`)}. May be a typo, or a league with its own rules.`); }
      if (L0.end) { const ne = players.filter(r => !r.end); if (ne.length) add("low", "no-end", "Player missing an end date", t, list(ne, 5, r => r.name) + "."); }
      if (L0.res) { const nr = players.filter(r => !r.res); if (nr.length) add("low", "no-res", "Player missing residency", t, list(nr, 5, r => r.name) + "."); }
    });
    const names = {};
    P.forEach(r => { if (!r.player || r.name.length < 3) return; (names[r.name.toLowerCase()] = names[r.name.toLowerCase()] || []).push(r); });
    Object.values(names).forEach(g => { const ids = [...new Set(g.map(r => r.t.i))]; if (ids.length < 2) return;
      add("med", "dup-across", "Same name on more than one team", T[ids[0]], `“${g[0].name}” appears on ${ids.map(i => `${T[i].name} (${T[i].lg})`).join(" and ")}. Name match only, so verify it is a transfer or a different player.`); });
    const rank = { high: 0, med: 1, low: 2 };
    return F.sort((a, b) => rank[a.sev] - rank[b.sev] || a.label.localeCompare(b.label) || (a.t ? a.t.name : "").localeCompare(b.t ? b.t.name : ""));
  }
  const findingsOpen = () => {
    if (!FINDINGS) FINDINGS = buildFindings();
    const inReg = f => !S.regs.size || S.regs.has(f.reg), pool = FINDINGS.filter(inReg);
    const cnt = { high: 0, med: 0, low: 0 }; pool.forEach(f => cnt[f.sev]++);
    const keys = {}; pool.forEach(f => { keys[f.key] = f.label; });
    const q = S.hq.trim().toLowerCase();
    const shown = pool.filter(f => (!S.hsev || f.sev === S.hsev) && (!S.hkey || f.key === S.hkey) &&
      (!q || (f.label + " " + f.detail + " " + (f.t ? f.t.name + " " + f.t.lg : "")).toLowerCase().includes(q)));
    const tone = { high: "r", med: "a", low: "" };
    const rows = shown.slice(0, S.hshown).map(f => `<div class="crfi"><span class="crt ${tone[f.sev]}">${SEVN[f.sev]}</span><b>${esc(f.label)}</b>
      <span class="crfm">${f.t ? `<span class="crteam">${logo(f.t)}<span>${esc(f.t.name)}</span></span> <span class="dim">${esc(f.t.lg)} · ${f.t.reg}</span>` : `<span class="dim">Region ${f.reg}</span>`}</span>
      <span class="crfd">${esc(f.detail)}</span></div>`).join("");
    return `<details class="card crfind" id="cfind"${S.hopen ? " open" : ""}><summary><b>All issues</b> <span class="dim">(${pool.length}${S.regs.size ? ", filtered to selected regions" : ""})</span>
        ${["high", "med", "low"].map(k => `<span class="crt ${tone[k]}">${cnt[k]} ${SEVN[k].toLowerCase()}</span>`).join(" ")}</summary>
      <div class="hint" style="margin:8px 0">Checks run on the snapshot. High means the sheet is probably wrong or unusable for that team; medium and low need a human look. A finding is a lead, not proof of an error.</div>
      <div class="crfilters"><span class="seg" style="margin-left:0">${["high", "med", "low"].map(k => `<button class="chip" data-hsev="${k}" aria-pressed="${S.hsev === k}">${SEVN[k]} <span class="n">${cnt[k]}</span></button>`).join("")}</span>
        <select id="hkey" aria-label="Check"><option value="">All checks</option>${Object.keys(keys).sort((a, b) => keys[a].localeCompare(keys[b])).map(k => `<option value="${k}"${S.hkey === k ? " selected" : ""}>${esc(keys[k])}</option>`).join("")}</select>
        <input type="search" id="hq" placeholder="Team, player or text" value="${esc(S.hq)}"></div>
      ${rows || '<div class="empty">No findings match.</div>'}
      <div class="dim" style="margin:8px 2px">${shown.length > S.hshown ? `<button class="chip" id="hmore">Show more (${shown.length - S.hshown} left of ${shown.length})</button>` : `${shown.length} finding${shown.length === 1 ? "" : "s"}`}</div></details>`;
  };

  // ---- Data health ----
  function health() {
    const regs = REGS.filter(g => (regCount[g] || (META.updated && META.updated[g])) && (!S.regs.size || S.regs.has(g)));
    const rows = regs.map(g => {
      const pl = P.filter(p => p.t.reg === g && p.player), a = age(g), [lab, tone] = ageTag(a);
      const ended = pl.filter(p => p.ms != null && p.ms < NOW).length, noEnd = pl.filter(p => p.ms == null).length;
      const noRole = P.filter(p => p.t.reg === g && !p.role).length;
      const off = pl.filter(p => p.ms != null && /^\d{4}-\d\d-\d\d$/.test(p.end) && !ALSET[p.end] && p.ms >= NOW).length;
      return `<tr><th>${regLogo(g)} ${g}</th><td><span class="crt ${tone}">${lab}</span> <span class="dim">${a == null ? "" : a + "d"}</span></td><td>${ended}</td><td>${noEnd}</td><td>${noRole}</td><td>${dupes[g] || 0}</td><td>${off}</td></tr>`;
    }).join("");
    return `<div class="hint" style="margin:0 0 10px">Problems in the source sheets, so you know what not to trust. An old sheet means old dates; "off calendar" end dates are not on Riot's aligned dates, which is normal for mid-season deals.</div>
      <div class="tablewrap"><table class="crhl"><thead><tr><th>Region</th><th>Sheet</th><th>Ended, still listed</th><th>No end date</th><th>Missing role</th><th>Duplicates removed</th><th>Off-calendar end dates</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${findingsOpen()}
      <p class="hint">KR roles are not in Riot's sheet; they come from Leaguepedia and are marked * in the radar. Contract data: Riot's League-Recognized Contract Database, via <a href="https://set0panda.github.io/contract-radar/" target="_blank" rel="noopener">Contract Radar</a> (snapshot ${esc(META.asOf || "?")}). Unofficial fan project, not affiliated with Riot Games.</p>`;
  }

  const SUBS = [["radar", "Expiry radar", radar], ["market", "Market board", market], ["changes", "What changed", changes], ["health", "Data health", health]];
  function render() {
    NOW = Date.now();
    const body = SUBS.find(s => s[0] === S.sub)[2]();
    box.innerHTML = `<div class="crsubs"><span class="seg" style="margin-left:0">${SUBS.map(([k, l]) => `<button class="chip" data-sub="${k}" aria-pressed="${S.sub === k}">${l}${k === "changes" && HIST.length ? ` <span class="n">${HIST.length}</span>` : ""}</button>`).join("")}</span></div>${head()}${body}`;
    const on = (sel, ev, fn) => box.querySelectorAll(sel).forEach(e => e[ev] = fn);
    on("[data-sub]", "onclick", e => { S.sub = e.currentTarget.dataset.sub; render(); });
    on("[data-reg]", "onclick", e => { const g = e.currentTarget.dataset.reg; S.regs.has(g) ? S.regs.delete(g) : S.regs.add(g); S.lg = ""; S.shown = 100; render(); });
    on("[data-role]", "onclick", e => { S.role = e.currentTarget.dataset.role; S.shown = 100; render(); });
    on("[data-sort]", "onclick", e => { const k = e.currentTarget.dataset.sort; S.dir = S.sort === k ? -S.dir : 1; S.sort = k; render(); });
    on("[data-mwin]", "onclick", e => { S.mwin = e.currentTarget.dataset.mwin; render(); });
    const q = box.querySelector("#cq"); if (q) q.oninput = e => { S.q = e.target.value; S.shown = 100; const pos = e.target.selectionStart; render(); const n = box.querySelector("#cq"); n.focus(); n.setSelectionRange(pos, pos); };
    const sl = box.querySelector("#clg"); if (sl) sl.onchange = e => { S.lg = e.target.value; S.shown = 100; render(); };
    const sw = box.querySelector("#cwin"); if (sw) sw.onchange = e => { S.win = e.target.value; S.shown = 100; render(); };
    [["#cended", "ended"], ["#cnoend", "noEnd"], ["#cstaff", "staff"]].forEach(([id, k]) => { const b = box.querySelector(id); if (b) b.onclick = () => { S[k] = !S[k]; S.shown = 100; render(); }; });
    const fd = box.querySelector("#cfind"); if (fd) fd.ontoggle = () => { S.hopen = fd.open; };
    on("[data-hsev]", "onclick", e => { const k = e.currentTarget.dataset.hsev; S.hsev = S.hsev === k ? "" : k; S.hshown = 60; S.hopen = true; render(); });
    const hk = box.querySelector("#hkey"); if (hk) hk.onchange = e => { S.hkey = e.target.value; S.hshown = 60; S.hopen = true; render(); };
    const hq = box.querySelector("#hq"); if (hq) hq.oninput = e => { S.hq = e.target.value; S.hshown = 60; S.hopen = true; const pos = e.target.selectionStart; render(); const n = box.querySelector("#hq"); n.focus(); n.setSelectionRange(pos, pos); };
    const hm = box.querySelector("#hmore"); if (hm) hm.onclick = () => { S.hshown += 60; S.hopen = true; render(); };
    const mo = box.querySelector("#cmore"); if (mo) mo.onclick = () => { S.shown += 100; render(); };
  }
  window.ContractView = { render };
  render();
})();
