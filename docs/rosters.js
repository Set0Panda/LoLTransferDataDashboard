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
  const META = window.GCD_META || { updated: {} }, LOGOS = new Proxy({}, { get: (_, k) => (window.GCD_LOGOS || {})[k] }), XR = window.GCD_XROLES || {};
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
  const teamByName = {}; T.forEach(t => { const k = norm(t.name); if (teamByName[k] === undefined || (T[teamByName[k]].lg === "(no league)" && t.lg !== "(no league)")) teamByName[k] = t.i; });   // same name twice (a league-less stub): use the one with a league

  // ---- coaches for regions Riot's sheet has none for (LCK, LPL): Leaguepedia list + manual file; marked * ----
  const noCoach = new Set(T.filter(t => !hasCoachData[t.reg]).map(t => t.reg));
  const extC = {};
  ((window.EXT_COACHES || {}).rows || []).forEach(r => { extC[norm(r[0]) + "|" + norm(r[1])] = { team: r[0], name: r[1] }; });
  (window.COACHES_MANUAL || []).forEach(r => { if (r && r.team && r.name) extC[norm(r.team) + "|" + norm(r.name)] = { team: r.team, name: r.name }; });
  Object.values(extC).forEach(c => {
    const ti = teamByName[norm(c.team)]; if (ti === undefined || !noCoach.has(T[ti].reg)) return;
    coaches[canon[ti]].push({ name: c.name, role: "COACH", end: "", res: "", ti: canon[ti], ms: null, ext: true });
  });

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
  const handleIdx = new Map();      // lowercased single-word handle -> [{ti, p}]
  const multiIdx = new Map();       // multi-word handles ("Naak Nako", "Hans Sama") -> [{ti, p}]; matched as phrases so their words never match other players
  T.forEach(t => byTeam[t.i].concat(coaches[t.i]).forEach(p => {
    const h = norm(p.name).replace(/\s+/g, " ").trim(), multi = / /.test(h);
    if (multi ? h.length < 5 : (h.length < 3 || NAME_STOP.has(h))) return;
    const idx = multi ? multiIdx : handleIdx;
    if (!idx.has(h)) idx.set(h, []); idx.get(h).push({ ti: t.i, p });
  }));
  const teamPat = T.filter(t => t.i === canon[t.i]).map(t => {
    const pats = [norm(t.name)];
    const code = (t.code || "").trim() || (t.name.length <= 3 && t.name === t.name.toUpperCase() ? t.name : "");   // "T1", "KRX" have no code column: the short name is the code
    if (code.length >= 2 && !CODE_STOP.has(code.toUpperCase()) && code === code.toUpperCase()) pats.push({ code });
    return { t, pats };
  });
  // "Karmine Corp Blue", "Fnatic Academy", "T1 Esports Academy": a team name followed by a sub-team word is the sub-team, not the main team
  const SUBW = /^[^a-z0-9]*(blue|academy|challengers?|youth|rookies|junior|bee|global|ii)(?![a-z0-9])/;
  const plainHit = (hay, needle, trail) => { let i = hay.indexOf(needle); while (i >= 0) { if (!SUBW.test(hay.slice(i + needle.length - (trail ? 0 : 0)))) return i; i = hay.indexOf(needle, i + 1); } return -1; };
  const codeHit = (text, code) => {
    const re = new RegExp("(^|[^A-Za-z0-9])" + code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9])", "g"); let m;
    while ((m = re.exec(text))) if (!SUBW.test(text.slice(m.index + m[0].length).toLowerCase())) return true;
    return false;
  };
  let playerItems = new Map(), teamItems = T.map(() => []), itemTeams = new Map(), itemAny = new Map();
  function buildMentions() {
    NOW = Date.now();
  const items = ((window.RADAR && window.RADAR.items) || []).filter(i => MENTION_CATS.has(i.category) && !(window.RADAR.meta && window.RADAR.meta.demo));
    playerItems = new Map(); teamItems = T.map(() => []); itemTeams = new Map(); itemAny = new Map();
  items.forEach(it => {
    if (NOW - Date.parse(it.published || it.seen) > 45 * MS) return;
    const text = it.title;      // headline only: a name buried in a summary or description is not what the story is about
    let low = norm(text);
    const hitTeams = new Set();
    teamPat.forEach(({ t, pats }) => {
      for (const p of pats) {
        if (typeof p === "string" ? (p.length >= 4 && plainHit(low, p) >= 0) : codeHit(text, p.code)) {
          hitTeams.add(t.i); if (typeof p === "string") low = low.split(p).join(" ");   // "Hanwha Life" must not match a player called Life
          break;
        }
      }
    });
    const hitPlayers = [];
    multiIdx.forEach((cands, h) => { if (new RegExp("(^|[^a-z0-9])" + h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)").test(low)) { cands.forEach(c => hitPlayers.push(c)); low = low.split(h).join(" "); } });
    const toks = new Set(low.split(/[^a-z0-9.']+/).filter(Boolean));
    const explicit = new Set(hitTeams); itemTeams.set(it, explicit);
    toks.forEach(w => { if (handleIdx.has(w)) handleIdx.get(w).forEach(c => hitPlayers.push(c)); });
    hitPlayers.forEach(c => {
      // a handle that is also a common word ("Life", "Time") only counts when its own team is named too
      if (COMMON.has(norm(c.p.name)) && !explicit.has(c.ti)) return;
      // wiki-sourced coaches have short everyday-name handles ("Tom", "Ben", "Leo"): only count them when their team is also named
      if (c.p.ext && norm(c.p.name).length < 6 && !explicit.has(c.ti)) return;
      // handle shared by several players: prefer the one whose team is also named in the item
      const same = handleIdx.get(norm(c.p.name)) || multiIdx.get(norm(c.p.name)) || [c]; if (same.length > 1 && !hitTeams.has(c.ti) && same.some(s => hitTeams.has(s.ti))) return;
      const k = c.ti + "|" + norm(c.p.name); if (!playerItems.has(k)) playerItems.set(k, []);
      if (!playerItems.get(k).includes(it)) playerItems.get(k).push(it);
      hitTeams.add(c.ti);
    });
    itemAny.set(it.url, explicit.size ? explicit : hitTeams);   // teams named in the headline decide the league; player handles only when no team is named
    hitTeams.forEach(ti => { if (!teamItems[ti].includes(it)) teamItems[ti].push(it); });   // named team or named player: it is that team's news
  });
  }
  // ---- rumoured moves, read from headlines ("X set to join TEAM as Head Coach", "TEAM pick X to replace Y", ...) ----
  const tnorm = x => " " + norm(x).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim() + " ";
  const RUM_DAYS = 21, ROLEWORDS = [["COACH", /coach|analyst|manager|staff/i], ["JUNGLE", /jungl/i], ["TOP", /\btop/i], ["MID", /\bmid/i], ["BOT", /\bbot|\badc|marksman/i], ["SUPPORT", /support/i]];
  const NOT_HANDLE = new Set(["team", "players", "player", "sources", "source", "star", "standout", "star", "veteran", "rookie", "new", "former", "legend", "duo", "trio", "pair", "roster", "lineup", "coach", "analyst", "jungler", "support", "midlaner", "toplaner", "adc", "botlaner"]);
  let rumIn = T.map(() => []), rumOut = new Map(), rumAway = new Map(), RUMITEMS = new Map();
  function teamsIn(str, atStartCodes) {          // canonical teams named in str, earliest first
    const hay = tnorm(str), out = [];
    teamPat.forEach(({ t, pats }) => {
      for (const p of pats) {
        const code = typeof p !== "string", needle = tnorm(code ? p.code : p);
        if (code ? !(atStartCodes && hay.startsWith(needle) && !SUBW.test(hay.slice(needle.length))) : (p.length < 4 || plainHit(hay, needle) < 0)) continue;
        out.push({ ti: t.i, at: code ? 0 : plainHit(hay, needle), len: needle.length }); break;
      }
    });
    return out.sort((a, b) => a.at - b.at || b.len - a.len);
  }
  const handleOf = str => {
    const toks = String(str || "").replace(/[“”"'‘’]/g, "").trim().split(/\s+/).map(x => x.replace(/[.,;:!?]+$/, "")).filter(Boolean);
    // multi-word handles first ("Naak Nako", "Hans Sama"): taking only the last word would turn them into other players ("Nako", "Sama")
    for (const n of [3, 2]) { if (toks.length >= n) { const j = toks.slice(-n).join(" "); if (multiIdx.has(norm(j))) return j; } }
    const w = toks.pop() || "";
    return /^[A-Za-z0-9ø.'-]{2,16}$/.test(w) && !NOT_HANDLE.has(w.toLowerCase()) ? w : null;
  };
  const roleFrom = str => { for (const [r, re] of ROLEWORDS) if (re.test(str || "")) return r; return ""; };
  function buildRumours() {
    rumIn = T.map(() => []); rumOut = new Map(); rumAway = new Map(); RUMITEMS = new Map();
    const items = ((window.RADAR && window.RADAR.items) || []).filter(i => MENTION_CATS.has(i.category) && !(window.RADAR.meta && window.RADAR.meta.demo) && NOW - Date.parse(i.published || i.seen) < RUM_DAYS * MS);
    const addIn = (name, ti, role, fromTi, it) => {
      const h = norm(name), cand = handleIdx.get(h) || multiIdx.get(h) || [];
      if (!role) { const c = cand.find(x => STARTERS.includes(x.p.role) || x.p.role === "COACH"); role = c ? c.p.role : ""; }
      const own = cand.find(c => c.ti === ti); if (own && own.p.ms != null && own.p.ms > cut) return;                    // already signed there on the sheet
      if (incoming[ti].some(x => norm(x.name) === h)) return;                                                         // already confirmed in overrides
      if (fromTi == null) { const c = cand.find(x => x.ti !== ti && (!role || x.p.role === role)) || cand.find(x => x.ti !== ti); if (c) fromTi = c.ti; }
      let r = rumIn[ti].find(x => norm(x.name) === h && x.role === role);
      if (!r) { r = { name, role, from: fromTi, items: [] }; rumIn[ti].push(r); }
      if (!r.items.includes(it)) r.items.push(it);
      const k = ti + "|" + h; if (!RUMITEMS.has(k)) RUMITEMS.set(k, []); if (!RUMITEMS.get(k).includes(it)) RUMITEMS.get(k).push(it);
      if (fromTi != null && fromTi !== ti) { const ak = fromTi + "|" + h; if (!rumAway.has(ak)) rumAway.set(ak, { to: ti, items: [] }); if (!rumAway.get(ak).items.includes(it)) rumAway.get(ak).items.push(it); }
    };
    const addOut = (name, ti, it) => { const k = ti + "|" + norm(name); if (!rumOut.has(k)) rumOut.set(k, []); if (!rumOut.get(k).includes(it)) rumOut.get(k).push(it); };
    items.forEach(it => {
      const raw = it.title.replace(/^\s*sources?:\s*/i, "").trim(), scoop = /^\s*sources?:|set to|reportedly|expected|rumou?r|linked|verbal agreement/i.test(it.title);
      let m;
      if ((m = raw.match(/^(.+?)\s+(?:is\s+|are\s+|reportedly\s+)*(?:set|expected|poised|close|likely)\s+to\s+join\s+(.+)$/i)) || (m = raw.match(/^(.+?)\s+reaches?\s+(?:a\s+)?verbal agreement with\s+(.+)$/i))) {
        const pl = handleOf(m[1]), tm = teamsIn(m[2], true)[0]; if (!pl || !tm) return;
        const asM = m[2].match(/\bas\s+(?:the\s+|a\s+|new\s+)*([a-z ]+?)(?:\s+(?:for|ahead|from|in|after|pending)\b|$)/i);
        const fr = (m[2].match(/\bfrom\s+(.+)$/i) || [])[1], ft = fr ? teamsIn(fr, true)[0] : null;
        addIn(pl, tm.ti, roleFrom(asM ? asM[1] : "") || roleFrom(m[1]), ft ? ft.ti : null, it); return;
      }
      if ((m = raw.match(/^(.+?)\s+(?:reportedly\s+)?replaces\s+(.+?)\s+in\s+(.+)$/i))) {
        const pl = handleOf(m[1]), out = handleOf(m[2]), tm = teamsIn(m[3], true)[0]; if (!tm) return;
        if (pl) addIn(pl, tm.ti, roleFrom(m[1]), null, it); if (out) addOut(out, tm.ti, it); return;
      }
      if (scoop && (m = raw.match(/^(.+?)\s+(?:set\s+to\s+)?part(?:s)?\s+ways\s+with\s+(.+?)(?:\s+(?:ahead|after|following|for|as|amid|in)\b.*)?$/i))) {
        const tm = teamsIn(m[1], true)[0], pl = handleOf(m[2]); if (tm && pl) addOut(pl, tm.ti, it); return;
      }
      if ((m = raw.match(/^(.+?)\s+(?:pick|picks|sign|signs|target|targets)\s+(.+?)\s+(?:as|to|for|from)\b(.*)$/i))) {
        const tm = teamsIn(m[1], true)[0], pl = handleOf(m[2]); if (!tm || !pl) return;
        const asM = m[3].match(/^\s*(?:as\s+)?(?:the\s+|a\s+|new\s+)*([a-z ]+?)(?:\s+(?:to|for|ahead|from|in|after)\b|$)/i);
        const rp = m[3].match(/\breplace\s+([A-Za-z0-9ø.'-]+)/i);
        addIn(pl, tm.ti, roleFrom(m[2]) || roleFrom(m[3].startsWith(" as") || /^\s*as\b/i.test(m[3]) ? (asM ? asM[1] : "") : ""), null, it);
        if (rp) addOut(rp[1], tm.ti, it);
      }
    });
    // Leaguepedia RosterRumors (docs/rumors-extra.js): open rumours only; confirmed ones reach the sheet/overrides, denied ones are dropped
    const wikiTeam = s => {
      let n = norm(s).replace(/[^a-z0-9]/g, ""); if (!n) return null;
      n = { karminecorpblue: "kcb", kcblue: "kcb" }[n] || n;
      const hit = T.find(t => t.i === canon[t.i] && (norm(t.name).replace(/[^a-z0-9]/g, "") === n || (t.code || "").toLowerCase() === n));
      if (hit) return hit.i; const m = teamsIn(s, true)[0]; return m ? canon[m.ti] : null;
    };
    const ER = window.EXT_RUMORS;
    if (ER && Array.isArray(ER.rows) && !(window.RADAR && window.RADAR.meta && window.RADAR.meta.demo)) ER.rows.forEach(([date, pl, ts, te, rs, re, status, site, url, over, denied]) => {
      const t0 = Date.parse(date); if (over || denied || !pl || !(NOW - t0 < RUM_DAYS * MS)) return;
      const a = wikiTeam(ts), b = wikiTeam(te), role = roleFrom(re || rs);
      if (a != null && a === b) return;                    // "set to continue with X": not a move
      const it = { title: pl + (a != null && b != null ? ` (${T[a].name} to ${T[b].name})` : b != null ? ` to ${T[b].name}` : a != null ? ` leaving ${T[a].name}` : ""), url, source: site || "Leaguepedia", category: "Leaguepedia rumour",
                   published: date, seen: date, quality: .8, wiki: { status: (status || "Rumour").replace(/^rumor$/i, "Rumour"), date } };
      if (b != null) addIn(pl, b, role, a, it); else if (a != null) addOut(pl, a, it);
    });
  }
  buildMentions(); buildRumours();
  const rank = it => it.quality * Math.pow(.5, (NOW - Date.parse(it.published || it.seen)) / MS / 14);
  const best = arr => arr.slice().sort((a, b) => rank(b) - rank(a));

  // ---- league rankings (docs/standings.js) ----
  const ST = window.STANDINGS || { leagues: {}, aliases: {} };
  const rankIdx = {};      // "LCK|normalised sheet name" -> {rank, rec}
  Object.entries(ST.leagues || {}).forEach(([lg, v]) => {
    const sheetNames = T.filter(t => t.lg === lg).map(t => t.name);
    // Rank = regular-season table order (matches the record shown). Playoff result (v.finish) is a badge, not the rank.
    const fin = (v.finish || []).map(n => n.toLowerCase());
    v.teams.forEach((x, i) => {
      const want = norm((ST.aliases || {})[x.name] || x.name).replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");
      const hit = sheetNames.find(n => norm(n).replace(/[^a-z0-9]/g, "") === want)
        || sheetNames.find(n => { const m = norm(n).replace(/[^a-z0-9]/g, ""); return m.includes(want) || want.includes(m); });
      if (hit) rankIdx[lg + "|" + norm(hit)] = { rank: i + 1, rec: x.sw + "-" + x.sl, place: ["Champion", "Runner-up", "3rd", "4th"][fin.indexOf(x.name.toLowerCase())] || "" };
    });
  });
  const rankOf = t => rankIdx[t.lg + "|" + norm(t.name)];

  // ---- view ----
  // Matrix by default on wide screens (all teams at a glance), Cards on narrow ones; an explicit choice is remembered.
  let VIEW = window.innerWidth >= 1100 ? "matrix" : "cards"; try { const v = localStorage.getItem("radar.rosterView"); if (v === "matrix" || v === "cards") VIEW = v; } catch (e) {}
  const S = { lg: null, q: "", only: false };
  const leaguesWithPlayers = [...new Set(T.filter(t => byTeam[t.i].length && t.i === canon[t.i] && t.lg !== "(no league)").map(t => t.reg + "|" + t.lg))]
    .sort((a, b) => { const [ra, la] = a.split("|"), [rb, lb] = b.split("|"); return REGS.indexOf(ra) - REGS.indexOf(rb) || (TOP_LG[la] ? 0 : 1) - (TOP_LG[lb] ? 0 : 1) || la.localeCompare(lb); });
  // league of a news item: the most common league among the teams and players its headline names, else a league tag
  const LG_TAGS = ["LCK", "LEC", "LCS", "LPL", "CBLOL", "LJL", "PCS", "VCS", "LCP"];
  const LG_SHORT = { "Circuito Desafiante": "CD" };
  const leagueOf = it => {      // up to two leagues, most-named first ("LPL · LCK" when a story spans both)
    const c = {}; (itemAny.get(it.url) || []).forEach(ti => { const l = T[ti] && T[ti].lg; if (l && l !== "(no league)") c[l] = (c[l] || 0) + 1; });
    const top = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => LG_SHORT[x[0]] || x[0]);
    return top.length ? top.join(" · ") : ((it.tags || []).find(x => LG_TAGS.includes(x)) || "");
  };
  // default league: the visitor's last choice, else the league with the most transfer news in the last 7 days, else LCK
  const hotLeague = () => {
    const c = {}; ((window.RADAR && window.RADAR.items) || []).forEach(it => {
      if (!MENTION_CATS.has(it.category) || NOW - Date.parse(it.published || it.seen) > 7 * MS) return;
      const lg = leagueOf(it).split(" · ")[0]; if (lg) c[lg] = (c[lg] || 0) + 1;
    });
    const top = Object.entries(c).filter(([lg]) => leaguesWithPlayers.some(k => k.endsWith("|" + lg))).sort((a, b) => b[1] - a[1])[0];
    return top ? leaguesWithPlayers.find(k => k.endsWith("|" + top[0])) : null;
  };
  let savedLg = null; try { savedLg = localStorage.getItem("radar.rosterLeague"); } catch (e) {}
  S.lg = (savedLg && leaguesWithPlayers.includes(savedLg) && savedLg) || hotLeague() || leaguesWithPlayers.find(k => /\|LCK$/.test(k)) || leaguesWithPlayers[0];
  const saveLg = () => { try { localStorage.setItem("radar.rosterLeague", S.lg); } catch (e) {} };

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
  const showTitle = t => { const x = String(t || "").replace(/^\s*sources?:\s*/i, ""); return x.charAt(0).toUpperCase() + x.slice(1); };
  const uniq = arr => { const seen = new Set(); return arr.filter(i => { const k = norm(i.title).replace(/[^a-z0-9]/g, ""); return seen.has(k) ? false : (seen.add(k), true); }); };   // same headline via two links
  const PARTS = {}, isScoop = i => /^\s*sources?:/i.test(i.title);
  const nSrc = items => new Set(items.map(i => i.source)).size;
  const LINK_SVG = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 014.5 9l1-1"/></svg>';
  const srcLink = items => { const it = best(items).sort((a, b) => (b.wiki ? 1 : 0) - (a.wiki ? 1 : 0))[0]; return it && it.url ? `<a class="rlink" href="${esc(it.url)}" target="_blank" rel="noopener" title="Open source: ${esc(it.source || "")}" aria-label="Open source: ${esc(it.source || "")}">${LINK_SVG}</a>` : ""; };
  const rumLine = (ti, r, tag = true) => `<div class="rum">${tag ? '<span class="tagr">RUMOUR</span> ' : ""}<span class="pl">${esc(r.name)}</span>${r.from != null ? ` <span class="ex">from ${esc(T[r.from].name)}</span>` : ""} <span class="rnw"><button type="button" class="rflag" data-tm="${ti}" data-pl="${esc(r.name)}">${r.items.length} ${r.items.length === 1 ? "report" : "reports"}</button>${srcLink(r.items)}</span></div>`;                       // per-team HTML pieces, reused by the side panel
  const ageD = i => Math.max(0, Math.round((NOW - Date.parse(i.published || i.seen)) / MS));

  function card(t) {
    const rk = rankOf(t);
    const base = byTeam[t.i].filter(p => !leaving[t.i + "|" + norm(p.name)] || false);
    const gone = byTeam[t.i].concat(coaches[t.i]).filter(p => leaving[t.i + "|" + norm(p.name)]);
    let projected = 0, hasRumor = false, open = false;
    const nm = p => { const m = playerItems.get(t.i + "|" + norm(p.name)); if (m && m.length) hasRumor = true; const k = t.i + "|" + norm(p.name), aw = rumAway.get(k), ou = rumOut.get(k); if (aw || ou) hasRumor = true;
      const mark = aw ? ` <span class="rumo" title="Rumour: ${esc(T[aw.to].name)}">&rarr; ${esc(T[aw.to].name)} (rumour)</span>` : ou ? ` <span class="rumo">may leave (rumour)</span>` : "";
      return `<span class="pn" data-h="${esc(norm(p.name))}"><span class="pl">${esc(p.name)}</span>${p.ext ? '<sup title="Not from Riot\'s sheet (Leaguepedia or entered by hand)">*</sup>' : ""}${mark}${flag(m, m && m.length === 1 ? "mention" : "mentions", t.i, p.name)}</span>`; };
    const sts = [], cells = {};
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
      rumIn[t.i].filter(r => r.role === role).forEach(r => { hasRumor = true; main += rumLine(t.i, r); });
      cells[role] = { st, html: main };
      return `<div class="rrow" data-s="${st}"><span class="rl">${role}</span><div>${main}</div></div>`;
    }).join("");
    const cs = coaches[t.i].filter(p => !leaving[t.i + "|" + norm(p.name)]);
    const cSigned = cs.filter(p => p.ms != null && p.ms > cut), cExp = cs.filter(p => p.ms != null && p.ms <= cut), cNo = cs.filter(p => p.ms == null);
    let coachMain = incoming[t.i].filter(x => x.role === "COACH").map(j => `<div><span class="pl">${esc(j.name)}</span> <span class="tagc">CONFIRMED</span> <span class="ex">from ${esc(j.from || "?")}${j.o.url ? ` · <a href="${esc(j.o.url)}" target="_blank" rel="noopener">source</a>` : ""}</span></div>`).join("");
    coachMain += cSigned.map(p => `<div>${nm(p)} <span class="ok">to ${esc(endYear(p))}</span></div>`).join("");
    if (cExp.length) coachMain += `<div class="ex">expiring: ${cExp.map(nm).join(", ")}</div>`;
    if (cNo.length) coachMain += `<div class="ex">no end date: ${cNo.map(nm).join(", ")}</div>`;
    rumIn[t.i].filter(r => r.role === "COACH").forEach(r => { hasRumor = true; coachMain += rumLine(t.i, r); });
    if (!coachMain) coachMain = `<div class="ex">${hasCoachData[t.reg] ? "none listed" : "not in this region's sheet"}</div>`;
    cells.COACH = { st: "", html: coachMain };
    const coachHtml = `<div class="rrow"><span class="rl">COACH</span><div>${coachMain}</div></div>`;
    const rumOther = rumIn[t.i].filter(r => !STARTERS.includes(r.role) && r.role !== "COACH");
    rumOther.forEach(() => { hasRumor = true; });
    const rumOtherHtml = rumOther.length ? `<div class="rrow"><span class="rl">RUMOUR</span><div>${rumOther.map(r => rumLine(t.i, r, false)).join("")}</div></div>` : "";
    const subs = base.filter(p => !STARTERS.includes(p.role));
    const subHtml = subs.length ? `<div class="rrow"><span class="rl">OTHER</span><div class="ex">${subs.map(p => esc(p.name) + (p.ms != null ? (p.ms > cut ? ` (to ${esc(endYear(p))})` : " (expiring)") : "")).join(", ")}</div></div>` : "";
    const leftHtml = gone.length ? `<div class="rrow"><span class="rl">LEAVING</span><div class="ex">${gone.map(p => { const o = leaving[t.i + "|" + norm(p.name)]; return esc(p.name) + (o.to ? " → " + esc(o.to) : ""); }).join(", ")} <span class="tagc">CONFIRMED</span></div></div>` : "";
    const teamUniq = uniq(best(teamItems[t.i])), news = teamUniq.slice(0, 3);
    const rumorHtml = rumorTags[t.i].length ? rumorTags[t.i].map(o => `<div class="rnews"><span class="tagr">RUMOR</span> ${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">` : ""}${esc(o.player)}${o.from ? " from " + esc(o.from) : ""}${o.to ? " → " + esc(o.to) : ""}${o.url ? "</a>" : ""}${o.note ? ` <span class="ex">${esc(o.note)}</span>` : ""}</div>`).join("") : "";
    const newsHtml = (news.length || rumorHtml) ? `<div class="rnewswrap"><div class="rl">NEWS${news.some(isScoop) ? ' <span class="rnote">&middot; includes unconfirmed reports from sources</span>' : ""}${teamUniq.length > news.length ? ` · <button type="button" class="linkbtn" data-tm="${t.i}">see all ${teamUniq.length}</button>` : ""}</div>${rumorHtml}${news.map(i => `<div class="rnews"><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(showTitle(i.title))}</a> <span class="ex">${esc(i.source)} · ${Math.max(0, Math.round((NOW - Date.parse(i.published || i.seen)) / MS))}d</span></div>`).join("")}</div>` : "";
        const bar = `<div class="rbar" title="${projected} of 5 starting slots projected; green = signed past the aligned date, amber = only expiring contracts, grey = open">${sts.map(x => `<i class="${x}"></i>`).join("")}</div>`;
    PARTS[t.i] = { cells, bar, rumOther, hasRumor, slots, coachHtml: coachHtml + rumOtherHtml, subHtml, leftHtml, projected, rumors: rumorHtml };
    const tone = projected >= 4 ? "g" : projected >= 2 ? "a" : "r";
        return { t, projected, tone, rank: rk ? rk.rank : null, html: `<article class="rcard" id="rc-${t.i}" data-n="${esc(t.name)}"><header class="rhead" data-tm="${t.i}" title="Open team panel">${logo(t)}<div class="rtitle"><h3>${esc(t.name)}</h3><div class="rmeta">${rk ? `<span class="rrank" title="Rank in ${esc(t.lg)}">#${rk.rank}</span> ${esc(rk.rec)}${rk.place ? ` <span class="rplace">${esc(rk.place)}</span>` : ""}` : esc(t.code || "")}</div></div>${bar}</header>
      <p class="rsum">${projected} of 5 starting slots projected for ${next ? new Date(next).getUTCFullYear() + 1 : ""}</p><div class="rlinked">${hasRumor ? `<button type="button" class="tagr tagbtn" data-tm="${t.i}">LINKED IN NEWS</button>` : ""}</div>${slots}${coachHtml}<div class="rxtra">${rumOtherHtml}${subHtml}${leftHtml}</div></article>`,
      flagged: open || hasRumor || rumorTags[t.i].length > 0 || incoming[t.i].length > 0 };
  }

  const MCOLS = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT", "COACH"];
  function matrix(cards) {
    const rows = cards.map(c => {
      const t = c.t, P = PARTS[t.i], rk = rankOf(t);
      const other = P.rumOther.length ? P.rumOther.map(r => rumLine(t.i, r)).join("") : "";
      return `<tr class="mrow" id="rc-${t.i}" data-n="${esc(t.name)}"><th class="mt" scope="row" data-tm="${t.i}" title="Open team panel">
        <div class="mtt">${logo(t)}<div><b>${esc(t.name)}</b><div class="rmeta">${rk ? `<span class="rrank">#${rk.rank}</span> ${esc(rk.rec)}` : esc(t.code || "")}</div></div></div>
        <div class="mtb">${P.bar}<span class="ex">${c.projected}/5</span></div>${other}</th>
        ${MCOLS.map(r => `<td class="mc s-${P.cells[r].st || "n"}" data-tm="${t.i}">${P.cells[r].html}</td>`).join("")}</tr>`;
    }).join("");
    return `<div class="mwrap"><table class="mx"><thead><tr><th>TEAM</th>${MCOLS.map(r => `<th>${r}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
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
    const strip = (VIEW === "cards" && !q && cards.length > 1) ? `<div class="rstrip">${cards.map(c => `<button class="rchip t-${c.tone}" data-go="rc-${c.t.i}" title="${esc(c.t.name)}: ${c.projected}/5 projected">${c.rank ? `<b>#${c.rank}</b>` : ""}${logo(c.t)}<span>${c.projected}/5</span></button>`).join("")}</div>` : "";
    const upd = META.updated && META.updated[reg], age = upd ? Math.floor((NOW - Date.parse(upd + "T00:00:00Z")) / MS) : null;
    const warn = age != null && age > 14 && !q ? `<div class="rwarn"><b>This region's sheet is ${age} days old</b> (last updated ${fmtDate(upd)}). Moves since then may be missing.</div>` : "";
    const sv = ST.leagues && ST.leagues[lg];
    const sAge = ST.asOf ? Math.floor((NOW - Date.parse(ST.asOf + "T00:00:00Z")) / MS) : null;
    const sWarn = sAge != null && sAge > 21 && !q ? `<div class="rwarn"><b>League rankings are ${sAge} days old</b> (as of ${esc(ST.asOf)}). They are copied by hand, so card order may have drifted. Refresh <code>standings.js</code> (see README).</div>` : "";
    const order = q ? "" : sv ? `<div class="hint" style="margin:0">Cards are ordered by the regular-season table: ${esc(sv.stage)}. ${sv.finishNote ? "Final result, " + esc(sv.finishNote) + ". " : ""}Source: ${esc(ST.source || "Leaguepedia")}, as of ${esc(ST.asOf || "?")}. Record shown is regular-season series wins-losses.</div>` : `<div class="hint" style="margin:0">No ranking data for ${esc(lg)} yet, so cards are A-Z.</div>`;
    const sel = REGS.map(g => {
      const ls = leaguesWithPlayers.filter(k => k.startsWith(g + "|")); if (!ls.length) return "";
      return `<div class="row">${regLogo(g)}${ls.map(k => `<button class="chip" data-rlg="${esc(k)}" aria-pressed="${k === S.lg && !q}">${esc(k.split("|")[1])}</button>`).join("")}</div>`;
    }).join("");
    box.innerHTML = `<section class="filters"><div class="row"><input class="search" id="rq" type="search" placeholder="Search a team or player across all leagues…" value="${esc(S.q)}" aria-label="Search rosters">
      <button class="chip" id="ronly" aria-pressed="${S.only}">Only open or flagged teams</button>
      <span class="seg" role="group" aria-label="Layout"><button class="chip" data-view="cards" aria-pressed="${VIEW === "cards"}">Cards</button><button class="chip" data-view="matrix" aria-pressed="${VIEW === "matrix"}">Matrix</button></span></div>${sel}
      <div class="hint" style="margin:0">Projection for the ${new Date(next).getUTCFullYear() + 1} season: a slot counts as projected when the sheet lists a contract ending after ${fmtDate(next)}, or you've marked a confirmed signing. Open means nobody on the sheet is signed past that date, not that the slot is empty: extensions and signings often aren't on the sheet yet. "Mentions" are headlines from the feed that name the player.</div>${order}${warn}${sWarn}</section>
      ${strip}
      ${VIEW === "matrix" ? (cards.length ? matrix(cards) : '<div class="card empty">No teams match.</div>') : `<div class="rgrid">${cards.map(c => c.html).join("") || '<div class="card empty">No teams match.</div>'}</div>`}
      <p class="hint">Contract data and logos come from <a href="https://set0panda.github.io/contract-radar/" target="_blank" rel="noopener">Contract Radar</a> (snapshot ${esc((META.asOf) || "?")}). Team logos are trademarks of their owners.</p>
      <p class="hint">${window.ATTRIB_LEAGUEPEDIA || ""}</p>
      ${Object.keys(extC).length ? `<p class="hint"><sup>*</sup> Coaches marked with an asterisk are not in Riot's sheet, which has none for LCK and LPL. They come from <a href="https://lol.fandom.com/wiki/Portal:Rosters" target="_blank" rel="noopener">Leaguepedia</a> roster changes${(window.EXT_COACHES || {}).updated ? ` (synced ${esc(window.EXT_COACHES.updated)})` : ""} and can lag the real world, since the wiki is volunteer-edited.</p>` : ""}`;
    const rq = document.getElementById("rq");
    rq.oninput = e => { S.q = e.target.value; const pos = e.target.selectionStart; render(); const n = document.getElementById("rq"); n.focus(); n.setSelectionRange(pos, pos); };
    document.getElementById("ronly").onclick = () => { S.only = !S.only; render(); };
    box.querySelectorAll(".rcard, .mrow").forEach(applyAccent);
    box.querySelectorAll("[data-view]").forEach(b => b.onclick = () => { VIEW = b.dataset.view; try { localStorage.setItem("radar.rosterView", VIEW); } catch (e) {} render(); });
    box.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { const el = document.getElementById(b.dataset.go); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("rpulse"); setTimeout(() => el.classList.remove("rpulse"), 1400); } });
    box.querySelectorAll("[data-rlg]").forEach(b => b.onclick = () => { S.lg = b.dataset.rlg; S.q = ""; saveLg(); render(); });
  }
  // ---- side panel: team + roster + every news item that names the team or a player ----
  const dr = document.getElementById("rdrawer"), back = document.getElementById("rd-back");
  let DR = null, lastFocus = null;
  const newsLi = i => `<li class="dn"><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(showTitle(i.title))}</a><div class="ex">${i.wiki ? `<b>${esc(i.wiki.status)}</b> · ${esc(i.source)} · ${esc(i.wiki.date)} · via Leaguepedia` : `${esc(i.source)} · ${ageD(i)}d · ${esc(i.category)}`}</div></li>`;
  function paint() {
    if (!dr || !DR) return;
    const t = T[DR.ti]; if (!PARTS[t.i]) card(t);
    const P = PARTS[t.i], rk = rankOf(t), pl = DR.pl;
    const mk = t.i + "|" + norm(pl || ""), mine = pl ? uniq(best((playerItems.get(mk) || []).concat((RUMITEMS.get(mk) || []).filter(i => !(playerItems.get(mk) || []).includes(i))))) : [];
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
        <h4>${pl ? "Other team news" : "Team news"} (${all.length})${all.concat(mine).some(isScoop) ? ' <span class="rnote">&middot; includes unconfirmed reports from sources</span>' : ""}</h4>${P.rumors ? `<div class="rdr">${P.rumors}</div>` : ""}<ul>${all.map(newsLi).join("") || '<li class="ex">No transfer, contract or roster headlines name this team or its players in the last 45 days. Match coverage is filtered out of the feed.</li>'}</ul>
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
    if (e.target.closest("a")) return;                 // real links keep working
    const o = e.target.closest("[data-tm]");
    if (o) { openDrawer(+o.dataset.tm, o.dataset.pl); return; }
    if (e.target.closest(".rdx") || e.target === back) closeDrawer();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && DR) closeDrawer(); });
  window.Rosters = { leagueOf, setLeague(k) { if (leaguesWithPlayers.includes(k)) { S.lg = k; S.q = ""; saveLg(); } }, render, rebuild() { buildMentions(); buildRumours(); render(); if (DR) paint(); } };
  render();
})();
