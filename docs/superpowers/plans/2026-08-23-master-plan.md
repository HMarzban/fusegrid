# Rollblock Master Implementation Plan — Stabilize, Purge, Dimetric

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every verified live bug, make the determinism guarantee actually tested, then execute the dimetric 3D renderer migration — in one sequenced plan where each phase gates the next.

**Architecture:** Three-layer app (input → deterministic sim → render-only view) stays intact. Phases P0–P3 repair the foundation (harness integrity, gameplay bugs, cross-engine determinism, fx/events ownership); P4 executes the approved renderer spec steps 1–7 against that repaired foundation; P5 sweeps dead code and locks decisions.

**Tech Stack:** Pure ES modules, Node v26 (`node --test`), Canvas-2D, zero runtime dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-08-16-dimetric-3d-renderer-design.md` (round 5) — P4 implements its §6 migration sequence verbatim except two amendments made by this plan (§5.1 hypot note; step-4 fx source), applied in Tasks 13/14.

## Global Constraints

- Zero runtime dependencies; no bundler/build step (AGENTS.md).
- `npm test` = bare `node --test`; every new `.test.mjs` runs standalone and exits nonzero on failure.
- Sim purity: `step()` pure w.r.t. world+intent; no DOM/time/`Math.random` in `src/core/**` or `src/ai/**`; randomness only via `src/core/rng.js`.
- Frozen config: tunables live in `CFG` (hoisted in Task 8); never mutate `CFG`/`BIOMES`.
- No new floating-point math enters `src/core/**` after Task 10–12 (amended spec §5.1).
- Existing homegrown `check()` test harness style is kept (decision: no node:test describe/it migration).
- Every phase ends green: `npm test` passes before the next phase starts.
- One acknowledged rng-sequence change total ("determinism baseline v2", Task 13) — nothing else may alter rng consumption order.

---

# PHASE P0 — Harness & Environment Integrity

*Entry condition: clean tree, 16/16 tests green. Exit gate: replay harness non-vacuous; `import "./src/main.js"` survives under Node; serve.js regression tests green.*

### Task 1: Make the determinism replay harness actually feed inputs

The harness at `tests/sim.test.mjs:17-18` assigns `const it=inputFn(...)` then calls `step(w, CFG.STEP, inps)` with the untouched zeroed intent. Every replay-based test currently compares zero-input runs.

**Files:**
- Modify: `tests/sim.test.mjs:10-22`

**Interfaces:**
- Produces: `runSteps(seed, level, frames, inputFn)` contract — `inputFn(w, i, fireEdge)` returns EITHER a full inputs map `{0:{intent}}` OR a bare intent object (applied to pid 0); falsy → keep previous intent.

- [ ] **Step 1: Write the failing check**

Append inside the same file (before test 1):

```js
// 1b) the harness must actually deliver generated inputs
{
  const w=runSteps(12345, 1, 30, ()=>({0:{move:{x:1,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}}));
  const w2=createWorld(12345,1); loadLevel(w2,1,false); w2.state="PLAY";
  const zero={0:newIntent()};
  for(let i=0;i<30;i++){ step(w2, CFG.STEP, zero); zero[0].firePrev=zero[0].fire; }
  check("harness feeds rightward input (x moved)", w.players[0].x>w2.players[0].x,
    w.players[0].x+" vs "+w2.players[0].x);
}
```

- [ ] **Step 2: Run it — must FAIL**

Run: `npm test`
Expected: FAIL "harness feeds rightward input" (both worlds identical today).

- [ ] **Step 3: Fix runSteps**

Replace `tests/sim.test.mjs:10-22`:

```js
function runSteps(seed, level, frames, inputFn){
  const w=createWorld(seed, level);
  loadLevel(w, level, false);
  w.state="PLAY";
  const inps={0:newIntent()};
  const fireEdge={prev:false};
  for(let i=0;i<frames;i++){
    const gen=inputFn(w, i, fireEdge);
    if(gen){
      if(gen[0]) inps[0]=gen[0];                 // full inputs map
      else { for(const k in gen) inps[0][k]=gen[k]; } // bare intent for pid 0
      if(inps[0].firePrev===undefined) inps[0].firePrev=inps[0].fire;
    }
    step(w, CFG.STEP, inps);
    inps[0].firePrev=inps[0].fire;
  }
  return w;
}
```

- [ ] **Step 4: Run tests — all PASS**

Run: `npm test`
Expected: PASS including new check 1b and both pre-existing determinism checks (now genuinely input-driven).

- [ ] **Step 5: Commit**

```bash
git add tests/sim.test.mjs
git commit -m "fix(test): feed generated intents through runSteps replay harness"
```

### Task 2: Headless import fixes (main.js guard + real fallback ctx)

`main.js:80` assigns `window.__GAME__` unguarded — importing main.js under Node throws. `renderer.js:14-15`'s bare-`{}` fallback ctx throws on first `ctx.save()`.

**Files:**
- Modify: `src/main.js:79-92`
- Modify: `src/render/renderer.js:12-15`
- Create: `tests/headless.test.mjs`

**Interfaces:**
- Consumes: `createGame(canvas, opts)` (main.js), `createRenderer(canvas, opts)` (renderer.js) — signatures unchanged.
- Produces: `createRenderer(null, opts)` returns the standard surface whose `render(world, dt)` is callable headlessly; `createGame` importable without DOM.

- [ ] **Step 1: Write failing test — `tests/headless.test.mjs`**

```js
import {createGame} from "../src/main.js";
import {createRenderer} from "../src/render/renderer.js";
import {createWorld, loadLevel} from "../src/core/sim.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }

let ok=true;
try{ createGame(null,{}); }catch(e){ ok=false; console.log(e.message); }
check("createGame(null) imports+runs headless", ok);

ok=true;
try{
  const r=createRenderer(null,{hud:null,audio:null});
  const w=createWorld(7,1); loadLevel(w,1,false); w.state="MENU";
  r.render(w, 1/60);
}catch(e){ ok=false; console.log(e.message); }
check("null-canvas renderer render() does not throw", ok);

console.log(fail? "HEADLESS FAIL":"HEADLESS OK");
process.exit(fail?1:0);
```

- [ ] **Step 2: Run — must FAIL**

Run: `node --test tests/headless.test.mjs`
Expected: FAIL — `ReferenceError: window is not defined`, then `TypeError: ctx.save is not a function`.

- [ ] **Step 3: Guard the debug block — main.js**

Wrap `main.js:79-92` (`// debug/test hook` through `window.__resume=...`) :

```js
   // debug/test hook (browser only)
  if(typeof window!=="undefined"){
    window.__GAME={
      G:world, renderer, input,
      step:(n=1)=>{ for(let i=0;i<n;i++){const it=input.intent(); step(world,CFG.STEP,{0:it}); input.advance();} renderer.render(world,CFG.STEP*n); },
      state:()=>world.state,
      reset:()=>{ loadLevel(world,1,false); world.state="MENU"; },
      begin:()=>{ if(world.state==="MENU") world.state="PLAY"; },
      setKeys:(o)=>input.setIntent(o),
      clearAllEnemies:()=>{ world.enemies.forEach(e=>{e.dead=true;}); return world.enemies.length; },
      advance:()=>{ loadLevel(world,world.level+1,true); world.state="PLAY"; },
      canvas,
    };
    window.__pause=onPause;
    window.__resume=()=>{ if(world.state==="PAUSE") world.state="PLAY"; };
  }
```

(Note: key renamed `__GAME` → kept as `__GAME__`? NO — browser_integration.html reads `window.__GAME__`; keep the name `__GAME__` exactly as-is. Only add the `typeof window` guard.)

- [ ] **Step 4: Real fallback ctx — renderer.js**

Replace `renderer.js:14-15`:

```js
  const noop=()=>{};
  const ctx = canvas && canvas.getContext ? canvas.getContext("2d",{alpha:false})
    : {save:noop,restore:noop,translate:noop,rotate:noop,scale:noop,
       fillRect:noop,strokeRect:noop,clearRect:noop,beginPath:noop,closePath:noop,
       moveTo:noop,lineTo:noop,arc:noop,fill:noop,stroke:noop,ellipse:noop,
       createLinearGradient:()=>({addColorStop:noop}),
       createRadialGradient:()=>({addColorStop:noop}),
       drawImage:noop,fillText:noop,strokeText:noop,setTransform:noop};
```

- [ ] **Step 5: Run — PASS, then full suite**

Run: `node --test tests/headless.test.mjs && npm test`
Expected: headless OK; all prior suites still green (Task 1's suite included).

- [ ] **Step 6: Commit**

```bash
git add src/main.js src/render/renderer.js tests/headless.test.mjs
git commit -m "fix: guard debug globals and replace throwing fallback ctx for headless use"
```

### Task 3: Harden serve.js + regression tests

Findings: prefix-match traversal (`serve.js:29` serves `/../rollblock-sibling/…`), `ACAO:*` makes any website able to read responses, unhandled read-stream error crashes the process, bad decode yields 500 not 400, binds all interfaces.

**Files:**
- Modify: `serve.js`
- Create: `tests/serve.test.mjs`

**Interfaces:**
- Produces: server binds `127.0.0.1`; containment via resolved path + `path.sep`; 403 outside-root, 400 malformed URL; no CORS header; stream errors answered not fatal.

- [ ] **Step 1: Write failing tests — `tests/serve.test.mjs`**

```js
import {spawn} from "node:child_process";
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const sandbox=mkdtempSync(join(tmpdir(),"serve-test-"));
mkdirSync(join(sandbox,"rollblock-notes"));
writeFileSync(join(sandbox,"rollblock-notes","secret.txt"),"TOPSECRET");
writeFileSync(join(sandbox,"index.html"),"<html>ok</html>");
const srv=spawn(process.execPath,["serve.js"],{cwd:sandbox,env:{...process.env,PORT:"0"},stdio:["ignore","pipe","pipe"]});
let port=null;
srv.stdout.on("data",d=>{ const m=String(d).match(/:(\d+)/); if(m&&!port)port=m[1]; });
await new Promise(r=>{ const t=setInterval(()=>{ if(port){clearInterval(t);r();} },50); });

let pass=0,fail=0;
const check=(n,c,d)=>{c?pass++:fail++;console.log((c?"  PASS ":"  FAIL ")+n+(d?" -> "+d:""));}
async function get(p){ try{ return await fetch(`http://127.0.0.1:${port}${p}`);}catch(e){return {status:-1}} }

check("serves index.html", (await get("/index.html")).status===200);
check("rejects parent traversal", (await get("/../AGENTS.md")).status===403);
check("rejects sibling-prefix dir", ((await get("/../rollblock-notes/secret.txt")).status)===403);
check("400 on malformed percent-encoding", (await get("/%zz")).status===400);
check("no wildcard CORS header", !((await get("/index.html")).headers.get("access-control-allow-origin")));

srv.kill(); rmSync(sandbox,{recursive:true,force:true});
console.log(fail? "SERVE FAIL":"SERVE OK");
process.exit(fail?1:0);
```

- [ ] **Step 2: Run — must FAIL**

Run: `node --test tests/serve.test.mjs`
Expected: sibling-prefix + traversal checks FAIL (200 leaks today), CORS check FAIL.

- [ ] **Step 3: Patch serve.js**

Apply four edits:
1. Containment — replace the `startsWith(ROOT)` line:
```js
const rel=path.relative(ROOT,p);
if(rel==="" || rel.startsWith("..") || path.isAbsolute(rel)) return null;
```
2. Malformed URL → 400: wrap the `decodeURIComponent` call site so a throw returns HTTP 400 instead of falling into the 500 catch.
3. Delete the `Access-Control-Allow-Origin` header line.
4. Stream error handling:
```js
fs.createReadStream(fp).on("error",()=>{ if(!res.headersSent)res.writeHead(404); res.end(); }).pipe(res);
```
5. Bind loopback: `server.listen(PORT,"127.0.0.1",...)` and print the bound URL including the ephemeral port (`:${server.address().port}`) so Task 3's test can parse `PORT=0`.

- [ ] **Step 4: Run — PASS + manual smoke**

Run: `node --test tests/serve.test.mjs && npm test`
Then manually: `npm start` → load game once in browser.
Expected: all suites green; game loads at localhost.

- [ ] **Step 5: Commit**

```bash
git add serve.js tests/serve.test.mjs
git commit -m "fix(security): close sibling-prefix traversal, drop ACAO wildcard, handle stream errors"
```

---

# PHASE P1 — Gameplay Bug Fixes

*Entry: P0 gate. Exit gate: contact damage costs lives; blast coverage chains bombs; pointer fire latches correctly; win/lose feedback fires. All rng-neutral — no golden bump needed.*

### Task 4: Enemy contact damage actually hurts (RED first)

`checkContact` (enemies.js:69-76) only emits events; audio/fx consume them — nobody calls `hurtPlayer`. Walking into enemies is free.

**Files:**
- Modify: `src/ai/enemies.js:69-77`
- Test: extend `tests/sim.test.mjs`

**Interfaces:**
- Consumes: `hurtPlayer(world, emit)` from `entities.js` (existing import in sim.js — enemies.js adds `import {hurtPlayer} from "../core/entities.js";`).
- Produces: contact semantics identical to blast path (sim.js:163-166): shield consumed → `{t:"hurt"}` event + iFrames; else `hurtPlayer`.

- [ ] **Step 1: RED — append to tests/sim.test.mjs**

```js
// 8) enemy contact damage
{
  const w=createWorld(999,1); loadLevel(w,1,false); w.state="PLAY";
  const e=w.enemies[0];
  e.invuln=false; e.invulnT=0; e.type="stationary"; e.speed=0;
  e.x=w.players[0].x; e.y=w.players[0].y; e.r=20;
  w.players[0].iFrames=0; w.players[0].shield=false;
  const livesBefore=w.lives;
  const zero={0:newIntent()};
  step(w, CFG.STEP, zero);
  check("enemy contact decrements lives", w.lives===livesBefore-1, w.lives+" vs "+livesBefore);
  // shield consumes instead
  const w2=createWorld(999,1); loadLevel(w2,1,false); w2.state="PLAY";
  const e2=w2.enemies[0];
  e2.invuln=false; e2.invulnT=0; e2.type="stationary"; e2.speed=0;
  e2.x=w2.players[0].x; e2.y=w2.players[0].y; e2.r=20;
  w2.players[0].iFrames=0; w2.players[0].shield=true;
  const l2=w2.lives;
  step(w2, CFG.STEP, zero);
  check("contact with shield consumes shield, keeps life",
    w2.lives===l2 && w2.players[0].shield===false);
}
```

- [ ] **Step 2: Run — contact checks FAIL**

Run: `npm test`
Expected: both new checks FAIL (lives unchanged today).

- [ ] **Step 3: GREEN — fix checkContact (enemies.js)**

Add import at top: `import {hurtPlayer} from "../core/entities.js";`
Replace lines 69-77:

```js
function checkContact(w,e,emit){
  const p=w.players[0];
  if(p.iFrames>0)return;
  if(Math.hypot(e.x-p.x,e.y-p.y) < e.r + CFG.TILE*0.26){
    if(p.shield){ p.shield=false; p.iFrames=CFG.IFRAMES; emit({t:"hurt", x:p.x, y:p.y}); }
    else hurtPlayer(w, emit);
   }
 }
```

Design note: shield branch keeps the `{t:"hurt"}` event for shake+SFX feedback (matches blast-path behavior at sim.js:164). No tuning changes — `CFG.IFRAMES` unchanged.

- [ ] **Step 4: Run — PASS**

Run: `npm test`
Expected: all green. NOTE the existing "blast kills enemy"/auto-advance tests must stay green; if the auto-advance test breaks, proceed to Task 7 which redefines it (mark it temporarily with a `// superseded by WIN-routing (Task 7)` comment and delete the stale assertion in Task 7 Step 1).

- [ ] **Step 5: Commit**

```bash
git add src/ai/enemies.js tests/sim.test.mjs
git commit -m "fix(gameplay): enemy contact consumes shield or costs a life via hurtPlayer"
```

### Task 5: Chain detonation by blast coverage

sim.js:170-171 chains only Manhattan-distance-1 bombs — even wall-blocked ones — while bombs at distance ≥2 inside the blast never chain.

**Files:**
- Modify: `src/core/sim.js:168-172`
- Test: extend `tests/sim.test.mjs`

**Interfaces:**
- Produces: `detonate()` chains any live bomb whose `(tx,ty)` tile is covered by this bomb's computed `tiles`; wall-blocked tiles chain nothing behind them.

- [ ] **Step 1: RED — append to tests/sim.test.mjs**

```js
// 5b) chain reaction coverage
function injectBomb(w,tx,ty,timer,radius){
  w.bombs.push({x:tx*CFG.TILE+20,y:ty*CFG.TILE+20,tx,ty,timer,radius:radius||1,
    pierce:false,line:false,dir:null,variant:"normal",dead:false});
}
{
  // distance-2 bomb in open line DOES chain
  const w=createWorld(5,1); loadLevel(w,1,false); w.state="PLAY";
  w.enemies=[]; w.blades=[]; w.bombs=[];
  injectBomb(w,4,6,0,1);            // pops immediately
  injectBomb(w,6,6,99,1);           // distance 2, long fuse
  step(w, CFG.STEP, {0:newIntent()});
  check("distance-2 bomb chained", w.bombs.every(b=>b.dead));
}
{
  // wall between bombs blocks the chain
  const w=createWorld(5,1); loadLevel(w,1,false); w.state="PLAY";
  w.enemies=[]; w.blades=[]; w.bombs=[];
  w.grid[key(5,6)]=T.WALL;
  injectBomb(w,4,6,0,1); injectBomb(w,6,6,99,1);
  step(w, CFG.STEP, {0:newIntent()});
  check("wall blocks chain", w.bombs.some(b=>!b.dead && b.tx===6));
}
```

- [ ] **Step 2: Run — first check FAILS**

Run: `npm test`
Expected: "distance-2 bomb chained" FAILS; "wall blocks chain" PASSES accidentally (old code also fails to reach it? No — old code chains Manhattan-1 only, so distance-2 never chains AND the wall case trivially passes; assert both stay correct after fix).

- [ ] **Step 3: GREEN — replace sim.js:168-172**

```js
  emit({t:"boom", x:bomb.x, y:bomb.y});
   // chain: any live bomb sitting on a blast-covered tile detonates too
  const covered=new Set(tiles.map(t=>key(t.tx,t.ty)));
  for(const b of w.bombs.slice())
    if(!b.dead && covered.has(key(b.tx,b.ty))) detonate(w,b,emit);
 }
```

- [ ] **Step 4: Run — PASS + full suite**

Run: `npm test`
Expected: all green (both new checks pass; nothing else regressed).

- [ ] **Step 5: Commit**

```bash
git add src/core/sim.js tests/sim.test.mjs
git commit -m "fix(gameplay): chain-detonate every bomb inside the blast footprint"
```

### Task 6: Input fixes — stuck pointer fire + inverted setIntent axes

input.js:22-23 registers `_onFire` for BOTH `pointerdown` and `pointerup` (both latch `fire=true`). input.js:83 `!!o.move.x*-1` parses as `(!!o.move.x)*-1` → `move:{x:1}` sets left AND right.

**Files:**
- Modify: `src/input.js:21-24,55,83`
- Test: extend `tests/sim.test.mjs` (Input is headless-safe: `_attach()` early-returns without `window`; construct `new Input(null)`)

**Interfaces:**
- Produces: `_onFireDown(){this._intent.fire=true}` / `_onFireUp(){this._intent.fire=false}`; `setIntent({move:{x,y}})` maps sign→held axes correctly.

- [ ] **Step 1: RED — append to tests/sim.test.mjs**

```js
// 9b) input layer headless checks
{
  const inp=new Input(null);
  inp._onFireDown({});
  check("pointerdown sets fire", inp._intent.fire===true);
  inp._onFireUp({});
  check("pointerup clears fire", inp._intent.fire===false);
  inp.setIntent({move:{x:1,y:0}});
  check("setIntent x:+1 -> right held, left clear",
    inp._held.right===true && inp._held.left===false);
  inp.setIntent({move:{x:0,y:-1}});
  check("setIntent y:-1 -> up held, down clear",
    inp._held.up===true && inp._held.down===false);
}
```

Plus the import: `import {Input} from "../src/input.js";`

- [ ] **Step 2: Run — FAIL**

Run: `npm test`
Expected: "pointerup clears fire" FAILS; both setIntent axis checks FAIL.

- [ ] **Step 3: GREEN — three edits in input.js**

Edit 1 — split handlers (lines 21-24):
```js
    if(this.el){
      this.el.addEventListener("pointerdown",this._onFireDown);
      this.el.addEventListener("pointerup",this._onFireUp);
       }
```
Edit 2 — replace `_onFire` (line 55):
```js
 _onFireDown(e){ this._intent.fire=true; }
 _onFireUp(e){ this._intent.fire=false; }
```
Also update the constructor binding (line 11): `this._onFireDown=this._onFireDown.bind(this); this._onFireUp=this._onFireUp.bind(this);`
Edit 3 — fix setIntent move mapping (line 83):
```js
        if(k==="move"){this._held.left=o.move.x<0; this._held.right=o.move.x>0;
          this._held.up=o.move.y<0; this._held.down=o.move.y>0;}
```

- [ ] **Step 4: Run — PASS**

Run: `npm test && node --test tests/headless.test.mjs`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/input.js tests/sim.test.mjs
git commit -m "fix(input): split pointer down/up fire latch and correct setIntent axis signs"
```

### Task 7: Route level-clear through the (currently dead) WIN state + wire win/lose feedback

The WIN overlay (`scenes.js:33-35`) and WIN branch (`sim.js:28-33`) are fully built but unreachable — `sim.js:46` auto-advances directly. fx/audio already implement `win`/`lose` reactions that no event ever triggers.

**Files:**
- Modify: `src/core/sim.js:45-46`
- Modify: `src/core/entities.js:36-40` (emit lose after LOSE)
- Test: modify the existing auto-advance assertions in `tests/sim.test.mjs`

**Interfaces:**
- Produces: board-clear ⇒ `state="WIN"` + `events:[{t:"win"}]`; next fire edge ⇒ `loadLevel(level+1, true)` + `"PLAY"` (existing WIN branch, unchanged). `lives≤0` ⇒ `state="LOSE"` + `events:[…,{t:"lose"}]`.

- [ ] **Step 1: Update the stale auto-advance test**

Find the existing auto-advance check in tests/sim.test.mjs (uses `clearAllEnemies`-style flow or winTimer wait) and replace its final assertions:

```js
  check("board clear enters WIN state", w.state==="WIN");
  check("win event emitted", w.events.some(e=>e.t==="win"));
  // fire edge advances with carry
  const fire={0:{...newIntent(),fire:true,firePrev:false}};
  step(w, CFG.STEP, fire);
  check("fire edge advances level with carry", w.state==="PLAY" && w.level===2 && w.score>0);
```

- [ ] **Step 2: Run — FAIL**

Run: `npm test`
Expected: WIN-state checks fail (today: instant advance to PLAY/level 2, no event).

- [ ] **Step 3: GREEN — sim.js**

Replace sim.js:46:
```js
    if(adv&&adv.advance){ world.events.push({t:"win"}); world.state="WIN"; }
```
(The pre-existing WIN branch at sim.js:28-33 performs `loadLevel(world, world.level+1, true); world.state="PLAY";` — leave untouched. Note: push BEFORE any loadLevel — `loadLevel` clears `w.events`.)

And entities.js hurtPlayer — inside the `if(world.lives<=0)` block, after `alive=false`:
```js
    world.events.push({t:"lose"});
```

- [ ] **Step 4: Run — PASS + manual smoke**

Run: `npm test`
Manual: `npm start`, clear a board (or use `__GAME__.clearAllEnemies()` + wait WIN_DELAY) → LEVEL CLEARED overlay + confetti + fanfare; press FIRE → next level. Die 3× → GAME OVER + descending fanfare.
Expected: green suites + visible/audible win & lose moments.

- [ ] **Step 5: Commit**

```bash
git add src/core/sim.js src/core/entities.js tests/sim.test.mjs
git commit -m "feat(gameplay): level clear routes through WIN state; wire win/lose audio+confetti"
```

### Task 8: Hoist scattered balance tunables into frozen CFG

Magic numbers per review M6 become named CFG entries. Pure rename — behavior byte-identical.

**Files:**
- Modify: `src/core/config.js`
- Modify: `src/core/sim.js` (pickup radius, pass mult, brick score, item score), `src/core/world.js` (spawn-clear), `src/core/entities.js` (kill scores are in sim.js killEnemy; death penalty; enemy speed base/curve; invuln), `src/ai/enemies.js` (contact radius, level bonus)

**Interfaces:**
- Produces (added to `CFG` literal, frozen like the rest):
```js
  CONTACT_R:0.26, PICKUP_R:0.45, PASS_MULT:2.4, SPAWN_CLEAR:3.5,
  DEATH_PENALTY:20, BRICK_SCORE:10, ITEM_SCORE:50,
  LEVEL_BONUS:500, LEVEL_BONUS_PER_LIFE:100,
  ENEMY_BASE_SPEED:1.5, ENEMY_LEVEL_CURVE:0.12, ENEMY_INVULN_T:1.2,
```

- [ ] **Step 1: Add the CFG keys** (exact block above, inside the frozen literal before `IFRAMES`).

- [ ] **Step 2: Replace call sites** — mechanical substitution, values verbatim:
  - sim.js:65 `sp*2.4` → `sp*CFG.PASS_MULT`; sim.js:69/80 `+=10` → `+=CFG.BRICK_SCORE`; sim.js:104 `<CFG.TILE*0.45>` → `<CFG.TILE*CFG.PICKUP_R>`; sim.js:104 `+=50` → `+=CFG.ITEM_SCORE`; sim.js:180 `+=10` → `+=CFG.BRICK_SCORE`; sim.js:186 `+=50` → `+=CFG.ITEM_SCORE`; sim.js:192 score table → `w.score += e.type==="rocket"?300:e.type==="boomerang"?250:100;` stays (variant table is structural, see note).
  - world.js:87 `<CFG.TILE*3.5` → `<CFG.TILE*CFG.SPAWN_CLEAR`.
  - entities.js:33 `-20` → `-CFG.DEATH_PENALTY`; entities.js:60 `1.5+level*0.12` → `CFG.ENEMY_BASE_SPEED+level*CFG.ENEMY_LEVEL_CURVE`; entities.js:74 `invulnT:1.2` → `invulnT:CFG.ENEMY_INVULN_T`.
  - enemies.js:63 bonus → `w.score+=CFG.LEVEL_BONUS+w.lives*CFG.LEVEL_BONUS_PER_LIFE`; enemies.js:72 `CFG.TILE*0.26` → `CFG.TILE*CFG.CONTACT_R`.

- [ ] **Step 3: Verify byte-identical behavior**

Run: `npm test && node --test tests/headless.test.mjs`
Expected: green. (No new determinism test needed — Task 9's goldens will pin exact outcomes from here forward.)

- [ ] **Step 4: Commit**

```bash
git add src/core/config.js src/core/sim.js src/core/world.js src/core/entities.js src/ai/enemies.js
git commit -m "refactor(config): hoist gameplay balance constants into frozen CFG"
```

---

# PHASE P2 — Determinism Purge (baseline bump v2)

*Entry: P1 gate. Exit gate: zero transcendental calls reachable from sim/AI (grep-enforced); full-state dual-run equality test green; ONE commit pins the baseline hash change.*

### Task 9: Full-state determinism test + golden capture (pre-purge)

**Files:**
- Create: `tests/determinism.test.mjs`

**Interfaces:**
- Consumes: `createWorld/loadLevel/step/newIntent`, `createRng`.
- Produces: `sameWorld(a,b)` deep comparator (grid bytes, entity fields float-exact, `rng.state`); scripted mixed-input 300-tick dual-run; `ENV_GOLDEN` env-var escape hatch for the Task 13 regeneration.

- [ ] **Step 1: Write the file**

```js
import {step, createWorld, loadLevel, newIntent} from "../src/core/sim.js";
import {CFG, key} from "../src/core/config.js";
import {createRng} from "../src/core/rng.js";

let pass=0, fail=0;
const check=(n,c,d)=>{c?pass++:fail++;console.log((c?"  PASS ":"  FAIL ")+n+(d?" -> "+d:""))};

// --- RNG contract ---
{
  const a=createRng(12345), b=createRng(12345);
  let eq=true;
  for(let i=0;i<10000;i++){ if(a.next()!==b.next()){eq=false;break;} }
  check("same seed => identical 10k sequence", eq);
  const lo=createRng(7), bounds=[Infinity,-Infinity]; let inB=true;
  for(let i=0;i<1000;i++){ const v=lo.int(2,5); if(v<2||v>5)inB=false;
    bounds[0]=Math.min(bounds[0],v); bounds[1]=Math.max(bounds[1],v); }
  check("int(2,5) within bounds, hits endpoints", inB && bounds[0]===2 && bounds[1]===5);
  const s=createRng(9); s.next(); s.next();
  const saved=s.state; const seq1=Array.from({length:10},()=>s.next());
  s.state=saved; const seq2=Array.from({length:10},()=>s.next());
  check("state save/restore resumes sequence", seq1.every((v,i)=>v===seq2[i]));
}

// --- full-state replay equality ---
function sameWorld(x,y){
  if(x.grid.length!==y.grid.length)return false;
  for(let i=0;i<x.grid.length;i++) if(x.grid[i]!==y.grid[i])return false;
  if(x.rng.state!==y.rng.state)return false;
  if(x.enemies.length!==y.enemies.length)return false;
  for(let i=0;i<x.enemies.length;i++){
    const a=x.enemies[i], b=y.enemies[i];
    if(a.x!==b.x||a.y!==b.y||a.tx!==b.tx||a.ty!==b.ty)return false;
  }
  return x.score===y.score && x.lives===y.lives && x.tick===y.tick
      && x.bombs.length===y.bombs.length && x.items.length===y.items.length;
}
function script(i){
  const moves=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}];
  const it=newIntent();
  it.move=moves[i%4];
  it.fire=(i%37===0); it.firePrev=(i%37===1);
  it.shift=(i%53===0);
  return {0:it};
}
function run(seed){
  const w=createWorld(seed,1); loadLevel(w,1,false); w.state="PLAY";
  for(let i=0;i<300;i++) step(w, CFG.STEP, script(i));
  return w;
}
{
  const A=run(20260823), B=run(20260823);
  check("300-tick mixed-input replay: full-state equal", sameWorld(A,B));
}

console.log(fail? "DETERMINISM FAIL":"DETERMINISM OK");
process.exit(fail?1:0);
```

- [ ] **Step 2: Run — PASS (captures pre-purge behavior)**

Run: `node --test tests/determinism.test.mjs && record=$(sha256sum <(node --test tests/determinism.test.mjs 2>&1)) ; echo $record > /tmp/golden-pre.txt`
Expected: DETERMINISM OK. Record this passing output hash as the PRE-PURGE golden reference (also note `A.score` value by temporarily logging if desired — the dual-run equality itself is the invariant; the golden hash pins the whole suite's output).

- [ ] **Step 3: Commit**

```bash
git add tests/determinism.test.mjs
git commit -m "test(determinism): rng contract + full-state 300-tick replay equality"
```

### Task 10: Squared-distance replaces hypot (3 sites, ULP-neutral)

Sites feeding branches: sim.js:103 pickup, enemies.js:72 contact, world.js:87 spawn-clear. All compare against a threshold — squared form uses only `*`,`+`,`<` (IEEE-exact everywhere).

**Files:**
- Modify: `src/core/sim.js:103`, `src/ai/enemies.js:72`, `src/core/world.js:87`

**Interfaces:** none change — internal comparisons only; thresholds squared inline (`(CFG.TILE*CFG.PICKUP_R)**2` etc.).

- [ ] **Step 1: Apply the three substitutions**
  - sim.js:103: `if(dx*dx+dy*dy < (CFG.TILE*CFG.PICKUP_R)**2){` with `const dx=it.x-p.x, dy=it.y-p.y;` added above.
  - enemies.js:72: `const dx=e.x-p.x, dy=e.y-p.y; if(dx*dx+dy*dy < (e.r+CFG.TILE*CFG.CONTACT_R)**2){`
  - world.js:87: `const ddx=tx-w.players[0].x, ddy=ty-w.players[0].y; if(ddx*ddx+ddy*ddy < (CFG.TILE*CFG.SPAWN_CLEAR)**2)continue;`

- [ ] **Step 2: Run everything**

Run: `npm test && node --test tests/determinism.test.mjs`
Expected: green. Outcomes MAY shift microscopically (ULP boundary cases flip) — that is acceptable ONLY inside this phase; Task 13 pins it.

- [ ] **Step 3: Commit (staged, part of bump)**

```bash
git add -A
git commit -m "perf(determinism): squared-distance compares replace Math.hypot in sim paths"
```

### Task 11: Integer-safe substep count (board.js:78)

`Math.ceil(Math.hypot(dx,dy)/step)` → smallest-n loop with identical semantics, no transcendentals.

**Files:**
- Modify: `src/core/board.js:78`

**Interfaces:** produces the same substep count as `ceil(|d|/step)` for all finite inputs (both find least n with n·step ≥ |d|), without sqrt/hypot rounding divergence across engines.

- [ ] **Step 1: Substitute**

```js
  let n=1;
  const dist2=dx*dx+dy*dy, cell=step*step;
  while(n*n*cell<dist2)n++;
```
(replacing the `Math.max(1,Math.ceil(Math.hypot(dx,dy)/step))` line; keep surrounding logic untouched)

- [ ] **Step 2: Equivalence spot-check + suites**

Run: `node -e "
const step=10;
for(const [dx,dy] of [[0,0],[3,4],[10,0],[0.001,0],[70.71,70.71],[1e6,1e6]]){
  const h=Math.ceil(Math.hypot(dx,dy)/step);
  let n=1; while(n*n*step*step<dx*dx+dy*dy)n++;
  console.log(dx,dy,h,n,h===n?'OK':'DIFF');
}" && npm test && node --test tests/determinism.test.mjs`
Expected: all OK (float-representable magnitudes agree; pathological half-ULP cases are exactly what we WANT allowed to differ cross-engine — within one engine results are stable).

- [ ] **Step 3: Commit (staged, part of bump)**

```bash
git add src/core/board.js
git commit -m "perf(determinism): integer substep-count loop replaces ceil(hypot())"
```

### Task 12: Stationary sin-bob out of sim state, into draw

enemies.js:23 writes `Math.sin(w.time*3)*1.5` into authoritative `e.y` every tick — engine-dependent state feeding the contact check.

**Files:**
- Modify: `src/ai/enemies.js:22-27` (delete the bob write; keep contact check)
- Modify: `src/render/sprites.js` — stationary enemies get a draw-time bob offset

**Interfaces:**
- Produces: stationary `e.y` pinned at spawn center forever (constant); visual bob `sin(time*3)*1.5` applied in `drawEnemyBody`/drawEnemies translate for `type==="stationary"` using `world.time` (renderer-side transcendental is legal).

- [ ] **Step 1: Delete the state write (enemies.js)**

Replace lines 22-27:
```js
  if(e.type==="stationary"){
    // contact check (stationary can still hit you if you walk into it)
    checkContact(w, e, emitFx);
    continue;
   }
```

- [ ] **Step 2: Draw-side bob (sprites.js drawEnemies body)**

In the enemy loop where each enemy translates, add before drawing:
```js
    const bobY = e.type==="stationary" ? Math.sin(world.time*3)*1.5 : 0;
    c.translate(e.x, e.y+bobY);
```
(match the actual local structure — the goal is: bob exists visually, never in state)

- [ ] **Step 3: Suites + grep gate**

Run: `npm test && node --test tests/determinism.test.mjs && node --test tests/headless.test.mjs`
Grep gate (must be empty output): `grep -rn "hypot\|Math.sin\|Math.cos\|Math.sqrt" src/core/ src/ai/ || echo CLEAN`
Expected: suites green; grep prints CLEAN.

- [ ] **Step 4: Commit (staged, part of bump)**

```bash
git add src/ai/enemies.js src/render/sprites.js
git commit -m "perf(determinism): stationary bob becomes render-only; sim state constant"
```

### Task 13: Enemy candidate dedup + determinism baseline v2 pin

DIRS4+DIRS8 concat double-weights cardinals AND burns extra rng draws. This is THE one sanctioned rng-sequence change. Bundle: amend spec §5.1, regenerate goldens, single pinning commit.

**Files:**
- Modify: `src/ai/enemies.js:39`
- Modify: `docs/superpowers/specs/2026-08-16-dimetric-3d-renderer-design.md` §5.1
- Modify: `MEMORY.md` (append dated entry)

- [ ] **Step 1: Dedup candidates (enemies.js:39)**

```js
    const cands=shuffle(DIRS8.slice());
```

- [ ] **Step 2: Amend spec §5.1 bullet 1**

Replace: "**Zero sim math.** ... The existing `Math.ceil(Math.hypot(...))` sub-step in `board.js:78` stays exactly as-is."
With: "**Zero NEW sim math.** Legacy transcendental sites were replaced during the determinism-purge phase (see plan 2026-08-23, P2): squared-distance compares at sim/enemies/world, integer substep loop in board.js, stationary bob relocated to render."

- [ ] **Step 3: Regenerate goldens + full verification**

Run: `npm test && node --test tests/determinism.test.mjs && node --test tests/headless.test.mjs && node --test tests/serve.test.mjs`
Expected: ALL green (replay equality is seed-relative, unaffected by sequence change; gameplay suites re-exercise real states).

- [ ] **Step 4: Single baseline-pin commit + MEMORY entry**

```bash
git add -A
git commit -m "chore(determinism): DIRS8-only enemy candidates; pin determinism baseline v2 (post-transcendental-purge)"
```
Append to MEMORY.md:
```
## 2026-08-23 — Determinism baseline v2
- Purged transcendentals from sim (squared distances, integer substeps, render-only bob),
  deduped enemy candidate dirs. Replays valid only from commits ≥ this point.
```

---

# PHASE P3 — FX/Events Ownership

*Entry: P2 gate. Exit gate: `world.fx` and `world.particles` no longer exist; particles live in the fx module singleton; renderer surface unchanged; spec step-4 painter source amended.*

### Task 14: Relocate particle storage into the fx singleton

fx.js currently pushes/filters `world.fx` on the shared world (renderer mutating sim-shaped state; headless servers would leak events; snapshot ghosts).

**Files:**
- Modify: `src/render/fx.js` (all storage), `src/render/renderer.js` (drawFx call), `src/core/world.js` (drop `particles:` field, line 20; drop `fx` references if any)
- Modify: spec §6 step 4 painter bullet: "`buildPainters` iterates `getFx()` (the fx-module accessor) instead of `world.fx||[]`."

**Interfaces:**
- Produces: `getFx() -> [{x,y,vx,vy,t,life,color,size,confetti?}]` (new export); `initFx()` resets shake AND parts; `updateFx(dt)` (signature loses `world`); `drawFx(c)` (loses `world`); `onEvent(ev,time)` unchanged shape.

- [ ] **Step 1: Rewrite fx.js internals**

```js
const fx={shakeT:0,shakeX:0,shakeY:0,parts:[]};
export function initFx(){ fx.shakeT=0; fx.shakeX=0; fx.shakeY=0; fx.parts=[]; }
export function getFx(){ return fx.parts; }
```
`addParticles/addConfetti`: replace `world.fx=(world.fx||[]); world.fx.push(...)` → `fx.parts.push(...)` (drop the `world` param usage for storage; keep params for coords).
`updateFx(world,dt)` → `updateFx(dt)`: iterate/filter `fx.parts`.
`drawFx(c,world)` → `drawFx(c)`: iterate `getFx()`.
Delete `createFxState(){}` (dead since review; confirmed zero importers).

- [ ] **Step 2: Update renderer.js consumers**

Line 6 import gains `getFx` (if scene needs later) — required now: `consumeEvents` calls `updateFx(dt||CFG.STEP)`; line 43 `drawFx(ctx)`.

- [ ] **Step 3: world.js cleanup**

Delete `particles:[],` (line 20) and `w.particles=[]` occurrences (lines 50). Nothing else reads them (verified: refactor-clean report #12/L1).

- [ ] **Step 4: Amend spec step-4 painter bullet** (one-line edit per Interfaces above).

- [ ] **Step 5: Full verification**

Run: `npm test && node --test tests/determinism.test.mjs && node --test tests/headless.test.mjs`
Manual: `npm start` → explosions still spray particles, shake works, confetti on WIN.
Expected: green + visuals intact.

- [ ] **Step 6: Commit**

```bash
git add src/render/fx.js src/render/renderer.js src/core/world.js docs/superpowers/specs/2026-08-16-dimetric-3d-renderer-design.md
git commit -m "refactor(render): fx particle storage moves out of world into fx module"
```

---

# PHASE P4 — Dimetric Renderer Migration (spec §6 steps 1–7)

*Entry: P0–P3 gates. Exit gate: `?render=3d` shows the dimetric arena; 2D default unchanged; `tests/r3d.test.mjs` covers projection, painter counts/liveness, sort order, headless smoke; 16+ suites green throughout.*

Execute spec §6 steps 1–7 **verbatim**, with the two amendments already applied by Tasks 13/14 (spec text current). Each spec step maps to one task below. The spec carries complete interfaces, code shapes, constants, per-step guards, and the Proxy-stub listing — implementers read both documents (plan header points to spec).

### Task 15 (= spec step 1): Renderer `kind` adapter
Gate: existing suites + headless suite green; `kind:"2d"` default byte-identical output.
Commit: `feat(render): kind adapter on createRenderer (2d default, 3d stub)`

### Task 16 (= spec step 2): `src/render/r3d/camera.js` + projection tests
Create `tests/r3d.test.mjs` with the spec's pinned assertions (`project(0,0)→{sx:284,sy:48}`, bbox margins, monotonic sy, top/bottom margin equations).
Commit: `feat(render): dimetric camera PROJ + projection unit tests`

### Task 17 (= spec step 3): Per-entity sprite bodies extraction
Behavior-preserving; `drawPlayer` keeps `(c, world)` signature and loops players internally (spec §4.3 sprite interface, round-5 resolution).
Commit: `refactor(render): extract draw*Body functions; 2D wrappers behavior-preserving`

### Task 18 (= spec step 4): `scene3d.js` painters + tests
Painter completeness counts (195 floor, walls, bricks, live items/bombs/blade-tiles/enemies/player, fx from `getFx()`), liveness exclusion cases, `(depth,tier)` sort incl. behind-wall occlusion, `shade()` unit check.
Commit: `feat(render): depth-sorted painter list + shade/background (scene3d)`

### Task 19 (= spec step 5): Canvas sizing + `?render=3d` wiring in main.js
Import `PROJ`; size backing store; `fit()` stays CSS authority.
Commit: `feat(main): ?render=3d flag wires dimetric canvas sizing`

### Task 20 (= spec step 6): Overlay/HUD parameterization
`drawOverlay(c,world,w,h,cx,cy)` + `drawLogo` forwarding with 2D-preserving defaults; 3D passes `(PROJ.canvasW,PROJ.canvasH,304,188)`.
Commit: `feat(render): parameterized overlays for dimetric centering`

### Task 21 (= spec step 7): Headless render smoke for both kinds
Proxy-stub canvas (spec §6 listing) drives kind 2d AND 3d in MENU state; assert no throw. Append dated MEMORY.md entry.
Commit: `test(render): headless smoke covers 2d and 3d paths`

Each task: run `npm test && node --test tests/r3d.test.mjs && node --test tests/headless.test.mjs` as its gate; manual `?render=3d` eyeball check after Tasks 18–21.

---

# PHASE P5 — Cleanup & Decisions Locked

*Entry: P4 gate. Exit gate: dead exports gone; debug globals opt-in; MEMORY.md current.*

### Task 22: Dead-code sweep + debug gating

**Files:**
- Delete: `POWER_BY_TYPE` (entities.js:19), `audio.prime`+`audio.isMuted` (audio.js:30,43), `MSG` re-export (transport.js:73), `world.lastBlades` field+reset (world.js:26,51), unused imports (`isBrick,solidAt` sim.js:2; `key,clamp,aabb` enemies.js:1-2; `clamp` board.js:1), duplicate sim imports (main.js:5-6 merge into one statement)
- Modify: `src/render/sprites.js:52` `%4` → `%BIOMES.length` (import BIOMES; kills biome/atlas drift hazard D4)
- Modify: `src/main.js:80` region — gate the debug block (from Task 2) additionally behind `opts.debug===true || /[?&]debug=1/.test(location.search||"")`; update `tests/browser_integration.html` to pass `{debug:true}` into its `createGame` call
- Keep (documented seams, DO NOT DELETE): entire `src/net/` layer, `rng.state` accessors, `BIOMES[].name`, `window.__GAME__` surface (now gated), baked/vector dual paint path in sprites.js

- [ ] **Step 1: Apply deletions + biome index unify + debug gate**
- [ ] **Step 2: Full verification**: `npm test && node --test tests/*.test.mjs` (all six suites) + manual `npm start` (game boots, sound toggle works, debug absent by default, present with `?debug=1`)
- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: dead-code sweep, biome-index unify, opt-in debug globals"
```

- [ ] **Step 4: Append MEMORY.md session entry summarizing shipped phases.**

---

## Self-Review Notes

- **Spec coverage:** P4 maps 1:1 onto spec §6 steps 1–7; both divergences (§5.1 hypot note, step-4 fx source) are executed by Tasks 13/14 *before* P4 begins, so executors never code against stale spec text. Risk-register items §8 all covered by their named step tests.
- **Placeholder scan:** all code-bearing steps show real code; Task 15–21 delegate code detail to the spec deliberately (spec contains complete listings — duplicating them here would violate DRY and risk drift).
- **Type consistency:** `runSteps` map-vs-intent normalization defined once (Task 1) and used by all later test additions; fx exports (`getFx/updateFx/drawFx/initFx`) match between Task 14 definition and Task 18 consumption; `check()` harness style uniform across all new files.
