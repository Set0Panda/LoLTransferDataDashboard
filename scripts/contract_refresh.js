// Copied from Set0Panda/contract-radar/scripts/refresh.js so the dashboard pulls Riot's sheet itself on every full refresh (same guard, same output format).
// Usage here: node scripts/contract_refresh.js --out docs/contract
// Daily refresh: pulls Riot's League-Recognized Contract Database, rebuilds data.js (no contact emails, no legal names)
// and appends changes to history.js. Usage: node scripts/refresh.js [--from-file sheet_csv.json] [--out dir]
const fs=require('fs'),path=require('path');
const SHEET='1Y7k5kQ2AegbuyiGwEPsa62e883FYVtHqr6UVut9RC4o';
const GIDS={AME:0,CN:594163931,EMEA:148326031,KR:905624073,LCP:1177719586};
const args=process.argv.slice(2);const arg=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null};
const OUT=arg('--out')||path.join(__dirname,'..');
function parseCSV(t){const rows=[];let r=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}else if(c==='"')q=true;else if(c===','){r.push(f);f=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;r.push(f);rows.push(r);r=[];f=''}else f+=c}if(f!==''||r.length){r.push(f);rows.push(r)}return rows}
const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const p2=n=>String(n).padStart(2,'0');
function iso(y,m,d){return y+'-'+p2(m)+'-'+p2(d)}
function parseStamp(s){s=(s||'').trim();let m;
  if(m=s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})/))return iso(m[3],MON[m[1].toLowerCase()],m[2]);
  if(m=s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/))return iso(m[1],m[2],m[3]);
  if(m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))return iso(m[3],m[1],m[2]);
  return null}
function parseEnd(s){s=(s||'').trim();if(!s)return '';let m;
  if(m=s.match(/day after worlds\s*(\d{4})/i))return 'W'+m[1];
  if(m=s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})/))return MON[m[1].toLowerCase()]?iso(m[3],MON[m[1].toLowerCase()],m[2]):'';
  if(m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))return iso(m[3],m[1],m[2]);
  return ''}
function normRole(v){v=(v||'').trim().toLowerCase();if(!v)return '';
  if(v.includes('coach'))return 'COACH';
  if(/^sub(stitute)?\b/.test(v))return 'SUB';
  if(/^top(lane|laner)?\b/.test(v))return 'TOP';
  if(/^(jungle|jungler|jug|jg|jng)\b/.test(v))return 'JUNGLE';
  if(/^mid(lane|laner)?\b/.test(v))return 'MID';
  if(/^(bot|botlane|adc|ad carry)\b/.test(v))return 'BOT';
  if(/^(support|sup)\b/.test(v))return 'SUPPORT';
  if(/\b(manager|analyst|staff)\b/.test(v))return 'STAFF';
  return ''}
const ROLES=new Set(['TOP','JUNGLE','MID','BOT','SUPPORT','SUB','COACH','STAFF']);
function normRes(v){v=(v||'').toLowerCase();return v.includes('non')?'N':v.includes('resident')?'R':''}
async function getCSVs(){
  const f=arg('--from-file');if(f)return JSON.parse(fs.readFileSync(f,'utf8'));
  const out={};
  for(const [k,gid] of Object.entries(GIDS)){
    const url=`https://docs.google.com/spreadsheets/d/${SHEET}/pub?single=true&output=csv&gid=${gid}`;
    const r=await fetch(url,{redirect:'follow'});
    if(!r.ok)throw new Error(`${k}: HTTP ${r.status}`);
    out[k]=await r.text();
  }
  return out;
}
function buildFrom(csvs){
  const teams=[],tix={},rows=[],updated={};
  for(const reg of Object.keys(GIDS)){
    const all=parseCSV(csvs[reg]||'');
    const hi=all.findIndex(r=>(r[0]||'').trim()==='League');
    if(hi<0)throw new Error(`${reg}: header row not found`);
    const st=parseStamp(all[0][1]);if(!st)throw new Error(`${reg}: cannot read last-updated stamp "${all[0][1]}"`);
    updated[reg]=st;
    const H=all[hi].map(h=>(h||'').trim().toLowerCase());
    const find=fn=>H.findIndex(fn);
    const cRole=find(h=>h==='main role'||h==='position'),cEnd=find(h=>h.startsWith('end date')||h.startsWith('contract end')),
      cRes=find(h=>h==='residency'||h==='imp residency'),cSt=find(h=>h==='status'||h==='ltr status'),
      cCode=find(h=>h.endsWith('code'));
    for(const r of all.slice(hi+1)){
      const name=(r[2]||'').trim();if(!name)continue;
      let role,end,res,status=cSt>=0?(r[cSt]||'').trim():'';
      const lg=(r[0]||'').trim(),team=(r[1]||'').trim();
      if(!team)continue;
      // LCP shifted layout (LJL, PCS, VCS, FLS, WildCard): [league, team, summoner, first, family, role, residency, endDate]
      if(reg==='LCP'&&!ROLES.has(normRole(r[3]))&&ROLES.has(normRole(r[5]))){role=normRole(r[5]);res=normRes(r[6]);end=parseEnd(r[7])}
      else{role=cRole>=0?normRole(r[cRole]):'';end=cEnd>=0?parseEnd(r[cEnd]):'';res=cRes>=0?normRes(r[cRes]):''}
      const key=reg+'|'+lg+'|'+team;
      if(tix[key]==null){tix[key]=teams.length;teams.push([reg,lg,team,'',''])}
      const t=teams[tix[key]];
      if(!t[3]&&cCode>=0)t[3]=(r[cCode]||'').trim();
      rows.push([tix[key],name,role,end,res,status]);
    }
  }
  return {teams,rows,updated};
}
function loadWin(file){const w={};new Function('window',fs.readFileSync(file,'utf8'))(w);return w}
// Per-region validation against the previous snapshot. A region may change by up to BAND without comment. A bigger change is
// only believable if the sheet's own "last updated" stamp moved (retrieval time says nothing about the source); even then a drop of
// more than CAP_DROP (or growth over CAP_GROW) needs a human: re-run the workflow with "force" ticked (or pass --force) to accept it.
const BAND=0.15,CAP_DROP=0.5,CAP_GROW=1.0;
const FORCE=args.includes('--force')||process.env.ALLOW_BIG_CHANGE==='1';
function regionCounts(teams,rows){const c={};rows.forEach(r=>{const t=teams[r[0]];if(t)c[t[0]]=(c[t[0]]||0)+1});return c}
function checks(N,P){
  const e=[],w=[],ov=[];
  const regs=new Set(N.teams.map(t=>t[0]));for(const r of Object.keys(GIDS))if(!regs.has(r))e.push('region missing: '+r);
  const now=regionCounts(N.teams,N.rows);
  for(const g of Object.keys(GIDS))if(!now[g])e.push(g+': no rows parsed');
  if(P){
    const prev=regionCounts(P.GCD_TEAMS,P.GCD_ROWS),ps=(P.GCD_META&&P.GCD_META.updated)||{};
    for(const g of Object.keys(GIDS)){
      const a=prev[g]||0,b=now[g]||0;if(!a||!b)continue;
      const ch=(b-a)/a,pct=Math.round(ch*100)+'%',sheetNew=N.updated[g],sheetOld=ps[g];
      if(sheetOld&&sheetNew<sheetOld){e.push(`${g}: the sheet's last-updated stamp went backwards (${sheetOld} -> ${sheetNew})`);continue}
      if(Math.abs(ch)<=BAND)continue;
      const moved=!sheetOld||sheetNew>sheetOld;
      let msg=null;
      if(!moved)msg=`${g}: ${a} -> ${b} rows (${pct}) but the sheet's own last-updated stamp did not move (${sheetNew}). Looks like a partial or malformed fetch`;
      else if(ch<-CAP_DROP||ch>CAP_GROW)msg=`${g}: ${a} -> ${b} rows (${pct}) is beyond what is accepted automatically, even though the sheet stamp moved (${sheetOld} -> ${sheetNew}). Needs a human look`;
      if(msg){if(FORCE)w.push('FORCED, accepted anyway: '+msg);else ov.push(msg)}
      else w.push(`${g}: ${a} -> ${b} rows (${pct}); accepted because the sheet stamp moved (${sheetOld} -> ${sheetNew})`);
    }
  }
  N.rows.forEach(r=>{if(!N.teams[r[0]])e.push('row references missing team')});
  return {errors:e.concat(ov),overridable:ov.length>0,warnings:w}}
function writeData(N,today,dest){
  const head=`// Snapshot of Riot's League-Recognized Contract Database (GCD), pulled ${today}.\n// Legal names and team contact emails are intentionally omitted. role: TOP|JUNGLE|MID|BOT|SUPPORT|SUB|COACH|STAFF|"" ; end: ISO date | "W<year>" (day after Worlds) | ""\n// res: R = resident, N = non-resident, "" = not listed`;
  const body=head+'\nwindow.GCD_META = '+JSON.stringify({asOf:today,updated:N.updated})+';\nwindow.GCD_TEAMS = '+JSON.stringify(N.teams)+';\nwindow.GCD_ROWS = '+JSON.stringify(N.rows)+';\n';
  if(/@/.test(body))throw new Error('email address found in output; refusing to write');
  fs.writeFileSync(dest,body);
}
function index(D){const m=new Map();D.GCD_ROWS.forEach(r=>{const t=D.GCD_TEAMS[r[0]];const k=t[2]+'\u0001'+r[1].toLowerCase();const cur=m.get(k);const v={team:t[2],name:r[1],role:r[2],end:r[3]};if(!cur||(cur.role==='STAFF'&&r[2]!=='STAFF'))m.set(k,v)});return m}
function diff(P,N,H,today){
  const a=index(P),b=index(N),ev=[],add=[],rm=[];
  b.forEach((v,k)=>{const o=a.get(k);if(!o)add.push([today,v.team,v.name,'add','',v.end]);else{if(o.end!==v.end)ev.push([today,v.team,v.name,'end',o.end,v.end]);if(o.role!==v.role&&o.role!=='STAFF'&&v.role!=='STAFF')ev.push([today,v.team,v.name,'role',o.role,v.role])}});
  a.forEach((v,k)=>{if(!b.has(k))rm.push([today,v.team,v.name,'rm',v.end,''])});
  const bulk=add.length>150||rm.length>150;
  const out=bulk?[[today,'*','*','bulk',add.length,rm.length]].concat(ev):ev.concat(add,rm);
  const keep=H.events.filter(e=>e[0]!==today);
  const cutoff=new Date(Date.parse(today+'T00:00:00Z')-120*864e5).toISOString().slice(0,10);
  H.events=out.concat(keep).filter(e=>e[0]>=cutoff).slice(0,2500);
  return {H,stats:{add:add.length,rm:rm.length,changed:ev.length,bulk}}}
(async()=>{
  const csvs=await getCSVs();
  const N=buildFrom(csvs);
  const today=new Date().toISOString().slice(0,10);
  const dataFile=path.join(OUT,'data.js'),histFile=path.join(OUT,'history.js');
  let P=null,H={since:today,events:[]};
  if(fs.existsSync(dataFile)){try{P=loadWin(dataFile)}catch(e){}}
  if(fs.existsSync(histFile)){try{H=loadWin(histFile).GCD_HISTORY||H}catch(e){}}
  const chk=checks(N,P);
  chk.warnings.forEach(m=>console.warn('warning: '+m));
  if(chk.errors.length){console.error('SANITY CHECK FAILED, nothing written. Yesterday\'s data stays live.\n - '+chk.errors.join('\n - ')+(chk.overridable?'\nIf the change is real, re-run the workflow with "force" ticked (or run with --force).':''));process.exit(1)}
  if(P){const d=diff(P,{GCD_ROWS:N.rows,GCD_TEAMS:N.teams},H,today);H=d.H;console.log('changes',JSON.stringify(d.stats))}
  writeData(N,today,dataFile);
  fs.writeFileSync(histFile,'window.GCD_HISTORY='+JSON.stringify({since:H.since,events:H.events})+';\n');
  console.log(`wrote ${N.rows.length} rows, ${N.teams.length} teams; sheets updated`,JSON.stringify(N.updated));
})().catch(e=>{console.error('REFRESH FAILED: '+e.message);process.exit(1)});
