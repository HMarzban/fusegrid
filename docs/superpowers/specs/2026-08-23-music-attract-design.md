# SPEC — Music Everywhere (ducking) + Idle Attract Bot — 2026-08-23
Branch `campaigns/touch-render-net` · zero-dep · sim untouched · Node-testable.
Locked: A music full-vol outside GAME, ducked inside; B deterministic bot in `src/app/demobot.js`;
C MENU idle ≥10s → ATTRACT (seed 20260823, levels cycle 1..3, 20s cap, any input → MENU).
Existing flows byte-identical until idle fires; `?play=1` unaffected.
## §1 Flow/state changes (`src/app/menuapp.js`)
`SCREEN.ATTRACT=7` appended (0..6 indices stable); main's `SCREEN_NAME` gains `"ATTRACT"`.
New field `idleT=0`; export `IDLE_T=10`. In `update`: after the GAME early-return add
`if(screen===ATTRACT)return;` (subT already advanced → hint blink); else existing path plus
`if(screen===MENU){idleT+=d; if(idleT>=IDLE_T)enterAttract();}else idleT=0;`.
Activity resets `idleT=0` at top of `move`, `confirm`, `key`, `_tapMove`.
`enterAttract()`: screen=ATTRACT, subT/repT/repDir/_hot/_taps reset; cursor PRESERVED.
`exitAttract()`: only from ATTRACT → `idleT=0; _push(SCREEN.MENU)`; true/false return.
`key(code)` FIRST line: `if(this.screen===SCREEN.ATTRACT)return this.exitAttract();`
(any code exits incl KeyM/P/Escape; onPause already no-ops outside GAME). Same guard first
line of `confirm()` (pointer path calls confirm today). Machine never creates worlds;
main owns harness `demo={world,bot,cycle,t,acc}`: create on seeing ATTRACT&&!demo; discard
(demo=null) on exit. Cycle level `(cycle%3)+1`; end = world.state LOSE/WIN after a step OR
`t>=20` → cycle++, fresh `createWorld(20260823,lvl)`+`loadLevel(w,lvl,false)`+`w.state="PLAY"`
(loadLevel sets MENU). Demo steps via SAME fixed-step accumulator (`while(acc>=CFG.STEP)`),
intent=`bot.intent(dw)` fed as `{0:intent}`; `t+=CFG.STEP` per step (sim time, not wall).
## §2 `src/app/demobot.js` (NEW)
```js
import {CFG,T,key,DIRS4} from "../core/config.js";
import {tileOf,solidAt,bfsNext} from "../core/board.js";
import {createRng} from "../core/rng.js";
export const NOOP=Object.freeze({move:{x:0,y:0},fire:false,firePrev:false,
  shift:false,remote:false,kick:false});
export function createDemobot(seed){let rng=createRng(seed>>>0),latch=false;
  return {intent(world){/*...*/},get state(){return{rng:rng.state,latch};}};}
```
`intent(world)` order: (1) `world.state!=="PLAY"||!p.alive` → NOOP (+latch=false).
(2) DANGER set: each live bomb's cross footprint (arms4 walk to radius, stop at wall/brick —
mirror sim's computeBlast inline; do NOT import from sim.js) ∪ active blade tiles ∪ bomb tiles.
(3) Player tile ∈ danger → FLEE: BFS EMPTY-only to nearest safe tile, single-axis move toward
first hop; keep facing on ties. (4) Else nearest-alive-enemy by Manhattan; `bfsNext(grid,p.tx,
p.ty,e.tx,e.ty,false)`; enemy adjacent (|dx|+|dy|===1) or same row/col clear line ≤ p.range,
and `bombs.length<p.bombs`, and player tile safe ⇒ wantBomb. (5) Else CHASE one bfsNext hop;
null → WANDER: legal DIRS4 via `rng.int(0,3)`, ≤8 retries then NOOP. Fire-edge mirrors sim:
`prev=latch; out.fire=want&&!prev; out.firePrev=prev; latch=out.fire;`
Purity: reads world fields only; own mulberry32 stream; NO Date/Math.random/DOM; serializable state.
## §3 Music engine (inside `src/audio.js`, oscillator-only)
Graph: per-note `osc→noteGain→musicGain→ctx.destination`; SFX beeps stay direct-to-destination
(duck never touches them). musicGain base 0.5, built lazily in `unlock()`. Scheduler honesty:
NO setInterval/setTimeout for notes — frame-driven lookahead: `pump()` once per RAF from main,
uses ONLY `ctx.currentTime`: while `nextT<=currentTime+0.12` emit step note {f,d,t,v}
(osc type t freq f; noteGain v→0.0001 ramp over d; stop at nextT+d+0.03), `nextT+=STEP`,
`stepIdx=(stepIdx+1)%LEN` (seamless wrap). Muted (existing flag) ⇒ pump emits nothing and
musicGain ramps instantly to 0.0001; unmute restores base. API added to returned object:
`unlock()` (idempotent: ensure()+resume(), build musicGain, nextT=currentTime+0.05),
`duck(on)`, `pump()`, `unlocked()`. Headless (no AC): all no-op. Pattern pure & exported:
```js
export const MUSIC_PATTERN=(()=>{const S=.15,L=64,bass=[],lead=[],hat=[];
 const roots=[[55,82.4],[55,82.4],[43.65,65.4],[49,73.42],
              [55,82.4],[55,82.4],[43.65,65.4],[49,73.42]];
 roots.forEach(([r,q],b)=>{const o=b*8;bass.push([o,r,2],[o+2,r,2],[o+4,q,2],[o+6,r,2]);});
 const ph=[[[0,220],[2,261.6],[3,293.7],[4,329.6],[6,293.7]],[[0,261.6],[1,392],[3,329.6]],
   [[0,246.9],[2,293.7],[3,349.2],[5,329.6]],[[0,220],[2,196],[4,246.9]]];
 ph.forEach((bar,i)=>bar.forEach(([s,f])=>{lead.push([i*8+s,f,2]);
   lead.push([32+i*8+s,f*2,2]);}));
 for(let i=1;i<L;i+=2)hat.push([i,4800,1]);
 const E=(a,t,v)=>a.map(([s,f,d])=>({f,d:d*S,t,v}));
 return Object.freeze({STEP:S,LEN:L,bass:Object.freeze(E(bass,"square",.10)),
  lead:Object.freeze(E(lead,"square",.07)),hat:Object.freeze(E(hat,"triangle",.02))});})();
```
8 bars @100BPM eighths (A-A-F-G ×2), lead octave-up bars 5–8, offbeat hats. bass/lead/hat are
sparse [step,freqHz,durSteps] lists over absolute steps 0..63; pump looks each up by stepIdx.
## §4 Ducking rules
Frame-polled in main (noteWorldEdge style): every frame
`audio.duck(app.screen===SCREEN.GAME&&audio.unlocked())`. Idempotent, self-heals across
onStart/M-quit/btnRestart/LOSE with zero transition enumeration. musicGain ramps
(`exponentialRampToValueAtTime`, floor 0.0001): duck-in 0.5→0.16 over 0.35s; restore 0.16→0.5
over 0.6s. SFX/jingle/blips unaffected. Unlock point: main installs `{once:true}` window
`keydown`+`pointerdown` → `audio.unlock()` (window-level catches canvas AND #stage pad taps).
Toolbar-button pointerdown unlocks but does NOT exit attract. Exit triggers: any keydown;
pointerdown on canvas/#stage.
## §5 Integration edits (per file)
1. `menuapp.js` §1 only + export IDLE_T. 2. `demobot.js` NEW per §2 (~90 lines).
3. `audio.js`: graph + MUSIC_PATTERN + unlock/duck/pump/unlocked; `toggle()` silences loop too
(same `muted` flag gates pump AND ramps gain — single source of truth); jingle/blips coexist.
4. `main.js`: SCREEN_NAME append; demo harness + loop ATTRACT branch (re-read app.screen AFTER
app.update same frame — machine may enter/exit mid-frame); render call becomes
`renderer.render(attract&&demo?demo.world:world, dt, attract?{hud:false}:undefined)`;
drawShell ATTRACT branch: no dim, `menudraw.drawAttractHint(c,L,cw,chh,app.subT)`; canvas
pointerdown gains ATTRACT case before confirm; unlock listeners; frame-polled duck;
`audio.pump()` per frame; expose read-only `demo` getter on handle for tests.
5. `renderer.js` additive opts: `render(world,dt,o)` skips updateHud when `o&&o.hud===false`;
`consumeEvents(world,dt,playSfx=true)` keeps fx onEvent, gates audio.play. Defaults identical.
6. `menudraw.js`: NEW tiny drawAttractHint (blink `subT%1<0.6`, layout reuse, fillText).
7. tests NEW demobot/music/attract .test.mjs; extend `headless.test.mjs`.
## §6 Tests headless vs manual
demobot: replay determinism (same seed ×2 runs, N=1800 ticks ⇒ identical intents+worlds);
state purity (snapshot restore ⇒ identical next intent); flee (forced bomb, advance fuse ⇒ bot
leaves footprint within FUSE); fire edge (standing want-bomb never double-places);
wander legality (NOOP or legal dir always); grep gate: /Math\.random|Date\./ absent in
demobot.js and audio.js scheduling code. music: PATTERN frozen/finite/LEN constant, hats on odd
steps; fake-clock ctx stub records starts ⇒ monotonic times, exact wrap at LEN×STEP, mute stops
scheduling, duck ramps hit 0.16/0.5. attract(menuapp): 9.9s empty updates stays MENU; ≥10s enters
ATTRACT; key()/confirm exits to MENU, cursor preserved; nav axes ignored in ATTRACT; idleT reset
outside MENU blocks entry from LEVEL. headless main: force MENU, drive loop(t) synthetic >10s ⇒
demo exists; 40s simulated incl deaths ⇒ loadScores() equals pre-copy, live world.score unchanged,
no demo value ever reaches recordScore; rollover 1→2→3→1 verified. Manual: silent-until-gesture,
duck audibility, 2D↔3D toggle mid-attract, pad tap exits, low-end perf.
## §7 Acceptance checklist
1. Full battery green; existing suite counts hold. 2. <10s idle in MENU ⇒ byte-identical frames
vs pre-spec. 3. 10s idle ⇒ ATTRACT plays seed-20260823 demo visibly. 4. Cycles roll 1→2→3→1 on
death/clear/cap; no PAUSE ghost, no HUD numbers from demo. 5. Any keydown / canvas+stage
pointerdown ⇒ instant MENU, demo discarded, cursor preserved. 6. Loop silent until first gesture,
then plays everywhere outside GAME incl subscreens. 7. GAME enter ducks (≈0.35s), menu restore
(≈0.6s). 8. SOUND toggle kills loop+jingle+blips together; re-enable restores all. 9. After 10min
attract incl deaths, localStorage scores byte-equal baseline; live world pristine. 10. node --check
clean; no Math.random/Date in demobot/audio scheduling; zero new deps.
## §8 Out of scope
Real songs/assets, stereo/panning, biome themes, attract score display, ?net=local interaction
(unaffected, no demo there), mobile pad during ATTRACT, volume UI beyond SOUND toggle.
