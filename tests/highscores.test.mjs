import {HS_KEY,DEFAULT_SCORES,loadScores,recordScore,qualifies,saveScores}
  from "../src/app/highscores.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }

function mapStore(){
  const m=new Map();
  return {
    getItem:k=>m.has(k)?m.get(k):null,
    setItem:(k,v)=>m.set(k,String(v)),
  };
}
function eq(a,b){ return JSON.stringify(a)===JSON.stringify(b); }

// ---- constants & defaults ----
check("HS_KEY is nb.highscores.v1", HS_KEY==="nb.highscores.v1", HS_KEY);
check("DEFAULT_SCORES has 10 rows", DEFAULT_SCORES.length===10, DEFAULT_SCORES.length);
check("DEFAULT_SCORES frozen (array+rows)",
  Object.isFrozen(DEFAULT_SCORES) && DEFAULT_SCORES.every(r=>Object.isFrozen(r)));
check("DEFAULT_SCORES rows shaped {s,l,d:'2026-08-23'}",
  DEFAULT_SCORES.every(r=>Number.isFinite(r.s)&&Number.isFinite(r.l)&&r.d==="2026-08-23"));
check("DEFAULT_SCORES sorted by s desc",
  DEFAULT_SCORES.every((r,i)=>i===0||DEFAULT_SCORES[i-1].s>=r.s));

// ---- loadScores: empty / missing store ----
{
  const got=loadScores(mapStore());
  check("empty store -> defaults copy", eq(got,DEFAULT_SCORES));
  got[0]={s:-1,l:-1,d:"x"};
  check("defaults copy is fresh (mutation-safe)", DEFAULT_SCORES[0].s===5000);
}
{
  const s=mapStore(); s.setItem(HS_KEY,"null");
  check("explicit null JSON -> defaults", eq(loadScores(s),DEFAULT_SCORES));
}

// ---- loadScores: corrupt payloads -> defaults ----
{
  const s=mapStore(); s.setItem(HS_KEY,"{not json");
  check("corrupt JSON -> defaults", eq(loadScores(s),DEFAULT_SCORES));
}
{
  const s=mapStore(); s.setItem(HS_KEY,'["a",1,null]');
  check("array-of-garbage -> defaults", eq(loadScores(s),DEFAULT_SCORES));
}
{
  const s=mapStore(); s.setItem(HS_KEY,'[{"s":100}]');
  check("row missing l/d -> defaults", eq(loadScores(s),DEFAULT_SCORES));
}
{
  const s=mapStore(); s.setItem(HS_KEY,'[{"s":"big","l":1,"d":"2026-08-23"}]');
  check("non-numeric s -> defaults", eq(loadScores(s),DEFAULT_SCORES));
}
{
  const s=mapStore(); s.setItem(HS_KEY,'{"a":1}');
  check("non-array JSON -> defaults", eq(loadScores(s),DEFAULT_SCORES));
}
{
  const s=mapStore();
  const rows=Array.from({length:11},(_,i)=>({s:i,l:1,d:"2026-08-23"}));
  s.setItem(HS_KEY,JSON.stringify(rows));
  check("array longer than 10 -> defaults", eq(loadScores(s),DEFAULT_SCORES));
}
{
  const s=mapStore();
  s.setItem(HS_KEY,JSON.stringify([{s:1,l:1,d:"x".repeat(33)}]));
  check("d longer than 32 -> defaults", eq(loadScores(s),DEFAULT_SCORES));
}
{
  const s=mapStore(); s.setItem(HS_KEY,42);
  check("non-string raw -> defaults", eq(loadScores(s),DEFAULT_SCORES));
}

// ---- loadScores: valid payload round-trip ----
{
  const s=mapStore();
  s.setItem(HS_KEY,'[{"s":777,"l":2,"d":"2026-01-02"},{"s":55,"l":1,"d":"2026-01-01"}]');
  check("valid stored list loads verbatim",
    eq(loadScores(s),[{s:777,l:2,d:"2026-01-02"},{s:55,l:1,d:"2026-01-01"}]));
}

// ---- loadScores: no store arg under Node (no window) never throws ----
{
  let ok=true, got=null;
  try{ got=loadScores(null); }catch(e){ ok=false; }
  check("loadScores(null) headless -> defaults, no throw", ok&&eq(got,DEFAULT_SCORES));
}

// ---- recordScore: sort + trim + tie-break + immutability ----
{
  const base=[];
  for(let i=0;i<10;i++) base.push({s:100*(10-i),l:1,d:"2026-08-23"});
  const inputCopy=JSON.parse(JSON.stringify(base));
  const out=recordScore(base,{s:950,l:5,d:"2026-09-01"});
  check("recordScore returns NEW array (input untouched)", eq(base,inputCopy)&&out!==base);
  check("recordScore inserts into sorted position", out[1].s===950&&out.length===10,
    "out[1].s="+out[1].s);
  check("recordScore trims to 10 (lowest dropped)", out[out.length-1].s===200,
    "last.s="+out[out.length-1].s);
}
{
  const short=[{s:50,l:1,d:"2026-08-23"}];
  const out=recordScore(short,{s:60,l:1,d:"2026-08-24"});
  check("recordScore keeps sub-10 lists intact", out.length===2&&out[0].s===60&&out[1].s===50);
}
{
  const ties=[
    {s:500,l:1,d:"2026-03-03"},{s:500,l:3,d:"2026-01-01"},{s:500,l:3,d:"2026-05-05"},
    {s:400,l:9,d:"2026-01-01"},
  ];
  const out=recordScore(ties,ties[0]);
  check("tie-break: equal s -> higher l first",
    out[0].l===3&&out[1].l===3&&out[2].l===1, JSON.stringify(out.slice(0,3).map(r=>r.l)));
  check("tie-break: equal s+l -> older d first",
    out[0].d==="2026-01-01"&&out[1].d==="2026-05-05");
}

// ---- qualifies boundary ----
{
  const full=[...DEFAULT_SCORES];
  check("qualifies: score===last.s -> false", qualifies(250,full)===false);
  check("qualifies: score>last.s -> true", qualifies(251,full)===true);
  check("qualifies: score<last.s -> false", qualifies(249,full)===false);
  check("qualifies: short list always true", qualifies(0,[...full].slice(0,3))===true);
  check("qualifies: empty list true", qualifies(1,[])===true);
}

// ---- save/load round-trip through Map store ----
{
  const s=mapStore();
  const list=recordScore(loadScores(s),{s:99999,l:5,d:"2026-08-23"});
  saveScores(list,s);
  check("save->load round-trip via Map store", loadScores(s)[0].s===99999);
}

// ---- saveScores best-effort: throwing store swallowed ----
{
  const boom={getItem(){return null;},setItem(){throw new Error("quota");}};
  let threw=false;
  try{ saveScores([{s:1,l:1,d:"2026-08-23"}],boom); }catch(e){ threw=true; }
  check("saveScores swallows store errors", threw===false);
}

// ---- recordScore entry shape normalization ----
{
  const out=recordScore([{s:1,l:1,d:"2026-08-23"}],{s:2,l:2,d:"2026-08-24",extra:"junk"});
  check("recordScore copies only {s,l,d}", !("extra" in out[0]), JSON.stringify(out[0]));
}

console.log("\n  HIGHSCORES RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
