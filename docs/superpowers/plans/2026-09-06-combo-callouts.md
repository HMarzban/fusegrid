# R2 — Combo / chain-blast callout + close-call flash — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A multi-kill chain says so — `DOUBLE` / `TRIPLE` / `QUAD` /
`CHAIN ×7` fades in over the board for 0.9 s — and a blast that stopped one
tile short of the player pulses a 6 px border instead of going unremarked. Both
are render-layer feedback: no score changes, no new sound, no `sim.js` edit.

**Architecture:** All new logic lives in `src/render/fx.js`. `feedFx(world, dt)`
is called inside `consumeEvents`, between the existing `syncFx(world)` and the
`world.events.length=0` wipe, in **both** renderers — so it sees byte-identically
the same batch `main.js` already reads non-destructively for the ghost coach, in
the same frame, with **zero `main.js` diff** and automatic 2D+3D parity.
`comboOf` and `nearMissOf` are pure functions over that batch plus read-only
world state; `feedFx` is the only stateful piece, and it **owns the decay of
every R2 timer** and no-ops entirely outside `world.state === "PLAY"` — because
`renderer.render(...)` runs every frame regardless of world state
(`main.js:649`), so an ungated feed would decay a paused player's group on a
paused clock and paint the callout on top of the PAUSED list.
`updateFx` is untouched: shake, flash and confetti must keep running through WIN.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, Canvas 2D.
Zero npm runtime deps. `src/render/fx.js` imports `CFG` and nothing else.

**Spec:** `docs/superpowers/specs/2026-09-06-retention-wave1-design.md` §2

**Index:** `docs/superpowers/plans/2026-09-06-retention-wave1.md` — its
**Shared interfaces** block is authoritative for every signature below.

**Depends on:** nothing. R2 is first in the wave precisely because its diff is
`fx.js` plus two one-line hooks per renderer.

## Global Constraints

- **No `src/core`, no `src/app`, no `main.js`, no `scenes.js`, no
  `menudraw.js`.** That is what keeps R2 clear of `tests/coach.test.mjs`,
  `tests/menudraw.test.mjs` and `tests/three.test.mjs`, all three **dirty in
  `git status`** right now.
- **Zero `sim.js` edits. No scoring change of any kind.** A combo is a callout,
  not a multiplier.
- **`feedFx` returns immediately unless `world.state === "PLAY"`, and it — not
  `updateFx` — owns the decay of `cmbT`, `calT`, `nmT` and `nmCd`.** A group
  open when the player pauses stays open, at the same remaining time, and
  resolves when play resumes.
- **`updateFx` (`fx.js:89-101`) is not touched.** The confetti has to keep
  falling on the CLEARED veil.
- **`initFx()` must not reset `flashK` / `shakeK`** (`fx.js:15-19`) — they are
  user preference, and every renderer construction calls `initFx()`.
- **R2 adds no shake.** `feedFx` never writes `fx.shakeT`. The existing per-event
  shake already scales with a combo — every kill adds `0.08`, every boom `0.22`
  (`fx.js:46-48`), all routed through `shakeK`. **Pinned as an absence.**
- **REDUCE FLASH ⇒ no close-call flash at all**, checked at *feed* time so
  `fx.nmT` is never set. `main.js:189` maps `flx` to `flashK: 0.25` (damped, not
  zero); for a brand-new light source that is not good enough.
- **No blink, no scale-pop, no colour cycling.** The callout is a static label
  that fades, which is why it needs no REDUCE FLASH gate of its own.
- **A new callout replaces the current one; callouts never stack.**
- **Sound is out of scope** — report §6: "Sound after `src/audio/*` lands".
- Comments only where the file already uses them: `fx.js` and `renderer.js` both
  carry explanatory block comments. Match the compact, no-whitespace-after-key
  style.
- Never write the banned grid-bomb franchise name into any committed file.
- PWA: bump `CACHE_NAME` (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`)
  **together**, `current vN → vN+1`, in **every** commit here — all three touch
  `fx.js`, which is precached. **Read the current value first** (it is
  `fusegrid-shell-v103` as this plan is written); other sessions bump the same
  two lines.

---

### Task 1: The pure detectors — `comboOf`, `comboLabel`, `nearMissOf`

**Files:**
- Modify: `src/render/fx.js` — three new exported pure functions after
  `getFx()` (`:33`), before `syncFx` (`:37`)
- Create: `tests/fx.test.mjs`
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `CFG` (already imported at `fx.js:1`)
- Produces:
  - `comboOf(events)` → int
  - `comboLabel(n)` → string
  - `nearMissOf(world, events)` → boolean, `events` defaulting to
    `world && world.events`

- [ ] **Step 1: Write the failing tests** — create `tests/fx.test.mjs`

```js
import { CFG } from "../src/core/config.js";
import { comboOf, comboLabel, nearMissOf } from "../src/render/fx.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") +
      name +
      (detail !== undefined ? " -> " + detail : ""),
  );
}

/* Tile centres are (t + 0.5) * TILE, so tile 5 centres at 220px. Every dmin
   below is a Chebyshev distance from the player point to a blade tile CENTRE,
   which is the same geometry sim.js:342's aabb call tests. */
const ctr = (t) => (t + 0.5) * CFG.TILE;
const blade = (...tiles) => ({ tiles: tiles.map(([tx, ty]) => ({ tx, ty })) });
const mkW = (px, py, blades, events, over) => ({
  state: "PLAY",
  seed: 1,
  level: 1,
  players: [Object.assign({ alive: true, iFrames: 0, x: px, y: py }, over || {})],
  blades: blades || [],
  events: events || [],
});

// ---- 1. comboOf: the boom gate is the discriminator ----
{
  const kills = Object.freeze([
    Object.freeze({ t: "kill" }),
    Object.freeze({ t: "kill" }),
    Object.freeze({ t: "kill" }),
  ]);
  check(
    "comboOf: a boom-free batch is blade attrition, scores 0",
    comboOf(kills) === 0,
    comboOf(kills),
  );
  const chain = Object.freeze(kills.concat([Object.freeze({ t: "boom" })]));
  check(
    "comboOf: 3 kills that arrive with a boom are a 3-combo",
    comboOf(chain) === 3,
    comboOf(chain),
  );
  check(
    "comboOf: a boom with no kills is 0",
    comboOf([{ t: "boom" }]) === 0 && comboOf([{ t: "boom" }, { t: "brick" }]) === 0,
  );
  check(
    "comboOf: deep-frozen input, no throw and no mutation",
    kills.length === 3 && chain.length === 4 && comboOf(kills) === 0,
  );
  check(
    "comboOf: junk input is 0, never a throw",
    comboOf(null) === 0 && comboOf(undefined) === 0 && comboOf([]) === 0,
  );
}

// ---- 2. comboLabel: the locked tier copy ----
{
  const want = [
    [0, ""],
    [1, ""],
    [2, "DOUBLE"],
    [3, "TRIPLE"],
    [4, "QUAD"],
    [5, "CHAIN ×5"],
    [11, "CHAIN ×11"],
  ];
  const bad = want.filter(([n, s]) => comboLabel(n) !== s);
  check(
    "comboLabel: 1 silent, 2 DOUBLE, 3 TRIPLE, 4 QUAD, >=5 CHAIN ×n",
    !bad.length,
    JSON.stringify(bad.map(([n]) => [n, comboLabel(n)])),
  );
}

// ---- 3. nearMissOf: a Chebyshev annulus, 32 < dmin <= 44 ----
{
  check(
    "nearMissOf: dmin 0 (standing in the blast) is not a near miss",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([5, 5])])) === false,
  );
  check(
    "nearMissOf: dmin 32 is a HIT (the aabb envelope), not a near miss",
    nearMissOf(mkW(228, ctr(5), [blade([6, 5])])) === false,
  );
  check(
    "nearMissOf: dmin 40 (one aligned tile away) is a near miss",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])])) === true,
  );
  check(
    "nearMissOf: dmin 44 is the outer bound, still a near miss",
    nearMissOf(mkW(216, ctr(5), [blade([6, 5])])) === true,
  );
  check(
    "nearMissOf: dmin 48 is just a blast somewhere, not a near miss",
    nearMissOf(mkW(212, ctr(5), [blade([6, 5])])) === false,
  );
  check(
    "nearMissOf: iFrames > 0 disqualifies",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [], { iFrames: 0.5 })) === false,
  );
  check(
    "nearMissOf: a dead player disqualifies",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [], { alive: false })) === false,
  );
  check(
    "nearMissOf: a {t:'hurt'} in the batch disqualifies (the shielded hit)",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [{ t: "hurt" }])) === false,
  );
  check(
    "nearMissOf: no blades, no near miss",
    nearMissOf(mkW(ctr(5), ctr(5), [])) === false &&
      nearMissOf(mkW(ctr(5), ctr(5), [{ tiles: [] }])) === false,
  );
  /* The MINIMUM over all blades is what stops a player standing inside one
     blast from being congratulated for a second one next door: tile (8,4)
     centres 40 away (dx 20, dy 40) and alone reads as a near miss; tile (8,5)
     centres 20 away and kills it. */
  check(
    "nearMissOf: a single blade at dmin 40 reads as a near miss",
    nearMissOf(mkW(320, ctr(5), [blade([8, 4])])) === true,
  );
  check(
    "nearMissOf: a second blade at dmin 20 takes the minimum and disqualifies",
    nearMissOf(mkW(320, ctr(5), [blade([8, 4]), blade([8, 5])])) === false,
  );
  check(
    "nearMissOf: events defaults to world.events, and the explicit arg wins",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [{ t: "hurt" }])) === false &&
      nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [{ t: "hurt" }]), []) === true,
  );
  const w = mkW(ctr(5), ctr(5), [blade([6, 5])]);
  const before = JSON.stringify(w);
  nearMissOf(w);
  check("nearMissOf: pure — the world is not mutated", JSON.stringify(w) === before);
}

console.log("\n  FX RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/fx.test.mjs
```

Expected: FAIL — `SyntaxError: The requested module '../src/render/fx.js' does
not provide an export named 'comboOf'`.

- [ ] **Step 3: Implement** — `src/render/fx.js`

Insert after `export function getFx(){ return fx.parts; }` (`:33`) and before
the `syncFx` block comment (`:35`):

```js
/* R2 detectors — PURE, exported, pinned (tests/fx.test.mjs). Both read the
   drained batch and read-only world state; neither touches the fx singleton,
   so feedFx below is the only stateful piece of R2.
   comboOf's boom gate is the discriminator for "from one detonation chain":
   detonate() is synchronous and recursive (sim.js:353-379), so one chain lands
   entirely inside one world.events batch as [kills...][boom] groups. A
   boom-FREE batch is blade attrition — updateBombs re-runs applyBlastHits for
   every live blade each tick (sim.js:257-259) — and scores nothing. */
export function comboOf(events){
  if(!events||!events.length) return 0;
  let boom=false, n=0;
  for(let i=0;i<events.length;i++){
    const e=events[i]; if(!e) continue;
    if(e.t==="boom") boom=true; else if(e.t==="kill") n++;
  }
  return boom?n:0;
}
export function comboLabel(n){
  const k=n|0;
  if(k<2) return "";
  if(k===2) return "DOUBLE";
  if(k===3) return "TRIPLE";
  if(k===4) return "QUAD";
  return "CHAIN ×"+k;
}
/* Close-call envelope, measured against the REAL hit test: applyBlastHits hits
   via aabb(w.grid,t.tx,t.ty,p.x,p.y,CFG.TILE*0.3) (sim.js:339-349), so the hit
   envelope reaches CFG.TILE*0.3 past the tile rect. "Own tile is not a blast
   tile" is therefore NOT "survived" — the inner bound is that call's own
   geometry. The outer bound is a design pick: an aligned adjacent tile is
   exactly 40px and a half-tile-diagonal offset is 44.7px and does not count,
   so the flash means "the arm stopped one tile short of you". */
const HIT_D=CFG.TILE*0.5+CFG.TILE*0.3, NEAR_D=CFG.TILE*1.10;
export function nearMissOf(world, events){
  if(!world) return false;
  const p=world.players&&world.players[0];
  if(!p||!p.alive||p.iFrames>0) return false;
  const ev=events!==undefined?events:world.events;
  if(ev&&ev.length) for(let i=0;i<ev.length;i++)
    if(ev[i]&&ev[i].t==="hurt") return false;
  const bs=world.blades;
  if(!bs||!bs.length) return false;
  let dmin=Infinity;
  for(const bl of bs){
    if(!bl||!bl.tiles) continue;
    for(const t of bl.tiles){
      const d=Math.max(Math.abs(p.x-(t.tx+0.5)*CFG.TILE),
                       Math.abs(p.y-(t.ty+0.5)*CFG.TILE));
      if(d<dmin) dmin=d;
    }
  }
  return dmin>HIT_D&&dmin<=NEAR_D;
}
```

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/fx.test.mjs
```

Expected: green, `FX RESULT: 19 PASS / 0 FAIL` (5 `comboOf`, 1 `comboLabel`,
13 `nearMissOf`).

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/render/fx.js tests/fx.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add the R2 pure detectors: comboOf, comboLabel and nearMissOf.

comboOf gates on a {t:"boom"} in the batch, which is what separates one
detonation chain from blade attrition — detonate() is recursive and lands a
whole chain in one world.events batch, while a lingering blade kills alone on
a later tick. nearMissOf is a Chebyshev annulus whose inner bound is the 32px
the aabb hit test actually reaches past a tile rect, so the flash can never
fire on the frame the player takes damage. No state, no wiring yet.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `feedFx` — the accumulator, the PLAY-only gate, and both `consumeEvents` seams

**Files:**
- Modify: `src/render/fx.js` — the `fx` singleton literal (`:13`), `initFx`
  (`:28-30`), `syncFx` (`:37-40`), new `feedFx` / `getCallout` / `getNearMiss`
- Modify: `src/render/renderer.js` — one line inside `consumeEvents` (`:34-41`)
- Modify: `src/render/three/wrapper.js` — one line inside `consumeEvents`
  (`:104-111`)
- Modify: `tests/fx.test.mjs` — extend the import, append blocks 4–6 and 8
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `comboOf`, `comboLabel`, `nearMissOf` (Task 1), the module-local
  `flashK`
- Produces:
  - `feedFx(world, dt)` — PLAY-only; owns `cmbT` / `calT` / `nmT` / `nmCd` decay
  - `getCallout()` → string (`""` when none is live)
  - `getNearMiss()` → number (`fx.nmT`)
  - `syncFx` / `initFx` additionally zero `cmbN cmbT calS calT nmT nmCd`

- [ ] **Step 1: Write the failing tests**

Extend the `tests/fx.test.mjs` import to:

```js
import {
  comboOf,
  comboLabel,
  nearMissOf,
  feedFx,
  getCallout,
  getNearMiss,
  initFx,
  syncFx,
  onEvent,
  updateFx,
  getShake,
  setFxOpts,
} from "../src/render/fx.js";
import { readFileSync } from "node:fs";
```

Append, immediately before the `console.log("\n  FX RESULT: ...")` summary:

```js
/* A PLAY world whose drained batch is n kills plus the boom that produced
   them — the [kills...][boom] group detonate() actually pushes. */
const chainW = (n, px, py, blades) => {
  const ev = [];
  for (let i = 0; i < n; i++) ev.push({ t: "kill", x: 0, y: 0 });
  ev.push({ t: "boom", x: 0, y: 0 });
  return mkW(px === undefined ? ctr(1) : px, py === undefined ? ctr(1) : py,
    blades || [], ev);
};

// ---- 4. REDUCE FLASH suppresses the close-call ENTIRELY, at feed time ----
{
  initFx();
  setFxOpts({ flashK: 0.25 });
  const near = chainW(1, ctr(5), ctr(5), [blade([6, 5])]);
  syncFx(near);
  feedFx(near, CFG.STEP);
  check(
    "REDUCE FLASH: flashK 0.25 means nmT is never even set",
    getNearMiss() === 0,
    getNearMiss(),
  );
  initFx();
  setFxOpts({ flashK: 1 });
  const near2 = chainW(1, ctr(5), ctr(5), [blade([6, 5])]);
  syncFx(near2);
  feedFx(near2, CFG.STEP);
  check(
    "REDUCE FLASH off: the same frame does set nmT",
    getNearMiss() > 0,
    getNearMiss(),
  );
  const first = getNearMiss();
  const near3 = chainW(1, ctr(5), ctr(5), [blade([6, 5])]);
  feedFx(near3, CFG.STEP);
  check(
    "close-call cooldown: a second near-miss frame does not re-arm inside 0.60s",
    getNearMiss() < first,
    getNearMiss() + " vs " + first,
  );
}

// ---- 5. R2 adds NO shake (pinned as an absence, with a live control) ----
{
  setFxOpts({ flashK: 1, shakeK: 1 });
  initFx();
  const w = chainW(5);
  const evs = w.events.slice();
  feedFx(w, CFG.STEP);
  updateFx(CFG.STEP);
  const s1 = getShake();
  check(
    "feedFx contributes no shake on a 5-kill boom batch",
    s1.x === 0 && s1.y === 0,
    JSON.stringify(s1),
  );
  initFx();
  for (const e of evs) onEvent(w, e, 0);
  let moved = false;
  for (let i = 0; i < 8; i++) {
    updateFx(CFG.STEP);
    const s = getShake();
    if (s.x !== 0 || s.y !== 0) moved = true;
  }
  check(
    "control: the existing onEvent path DOES shake, so the pin above is not vacuous",
    moved,
  );
}

// ---- 6. syncFx clears an open group across a world-identity change ----
{
  initFx();
  const w = chainW(2);
  syncFx(w);
  feedFx(w, CFG.STEP);
  check("group open, nothing emitted yet", getCallout() === "", getCallout());
  const next = Object.assign({}, w, { level: 2, events: [] });
  syncFx(next);
  check(
    "syncFx on a changed seed:level emits nothing",
    getCallout() === "",
    getCallout(),
  );
  feedFx(next, CFG.BLADE_TTL + 0.01);
  check(
    "and the group is gone, not merely paused — the window passes silently",
    getCallout() === "",
    getCallout(),
  );
}

// ---- 8. PLAY-only gate: feedFx owns the decay, and freezes outside PLAY ----
{
  initFx();
  const w = chainW(3);
  syncFx(w);
  feedFx(w, CFG.STEP);
  check("PLAY frame opens a 3-group, emits nothing yet", getCallout() === "");
  feedFx(Object.assign({}, w, { state: "PAUSE", events: [] }), 0.5);
  check(
    "PAUSE freezes the group — a paused clock never closes it",
    getCallout() === "",
    getCallout(),
  );
  feedFx(Object.assign({}, w, { state: "WIN", events: [] }), 0.5);
  check(
    "WIN freezes it too — no callout over the CLEARED veil",
    getCallout() === "",
    getCallout(),
  );
  feedFx(Object.assign({}, w, { events: [] }), CFG.BLADE_TTL);
  check(
    "back on PLAY the group resolves at its ORIGINAL remaining time",
    getCallout() === "TRIPLE",
    getCallout(),
  );
  const held = getCallout();
  updateFx(0.5);
  updateFx(0.5);
  check(
    "updateFx alone never advances the R2 timers — feedFx owns the decay",
    getCallout() === held,
    getCallout(),
  );
  feedFx(Object.assign({}, w, { events: [] }), 1.0);
  check("a PLAY frame past the ttl clears the callout", getCallout() === "");
}

// ---- wiring: feedFx sits between syncFx and the length=0 wipe, both paths ----
{
  for (const f of ["src/render/renderer.js", "src/render/three/wrapper.js"]) {
    const src = readFileSync(f, "utf8");
    const i = src.indexOf("syncFx(world);"),
      j = src.indexOf("feedFx(world"),
      k = src.indexOf("world.events.length=0");
    check(
      f + ": feedFx runs after syncFx and BEFORE the events wipe",
      i >= 0 && j > i && k > j,
      JSON.stringify({ i, j, k }),
    );
    check(
      f + ": feedFx is dt-guarded exactly like the updateFx beneath it",
      /feedFx\(world,\s*dt\s*\|\|\s*CFG\.STEP\)/.test(src),
      (src.match(/feedFx\([^)]*\)/) || [])[0],
    );
  }
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/fx.test.mjs
```

Expected: FAIL — `SyntaxError: The requested module '../src/render/fx.js' does
not provide an export named 'feedFx'`.

- [ ] **Step 3: Implement**

**3a — `src/render/fx.js`.** Replace the singleton literal (`:13`):

```js
const fx={shakeT:0,shakeX:0,shakeY:0,flashT:0,parts:[],
  cmbN:0,cmbT:0,calS:"",calT:0,nmT:0,nmCd:0};
```

Replace `initFx` (`:28-30`):

```js
export function initFx(){
  fx.shakeT=0; fx.shakeX=0; fx.shakeY=0; fx.flashT=0; fx.parts=[];
  clearR2();
}
function clearR2(){
  fx.cmbN=0; fx.cmbT=0; fx.calS=""; fx.calT=0; fx.nmT=0; fx.nmCd=0;
}
```

Replace `syncFx` (`:37-40`) — the block comment above it gains one clause:

```js
/* Wipes particles whenever the world identity (seed:level) changes — replaces
   the old loadLevel `w.particles=[]` wipe now that storage lives here. R2's
   timers go with them, WITHOUT emitting the open group: feedFx also runs for
   the attract demo world, so an open combo would otherwise leak across the
   attract <-> live boundary or a room change. */
export function syncFx(world){
  const t=world ? world.seed+":"+world.level : null;
  if(t!==tag){ tag=t; fx.parts=[]; clearR2(); }
}
```

Append after `nearMissOf` (Task 1's last addition):

```js
/* R2 feed. Called from consumeEvents in BOTH renderers, between syncFx and the
   world.events wipe, so it reads the same batch main.js reads non-destructively
   for the ghost coach — same frame, zero main.js diff, 2D+3D parity for free.
   PLAY-ONLY, and it owns the decay of every timer below. render() runs on
   PAUSE/WIN/LOSE frames too (main.js:649), so an ungated feed would close a
   group on a paused clock and paint the callout on top of the PAUSED list.
   This is main.js:547's `if(world.state==="PLAY") coachT+=dt` applied to the
   fx layer. updateFx is deliberately NOT the owner: shake, flash and confetti
   must keep running through WIN. */
export function feedFx(world, dt){
  if(!world||world.state!=="PLAY") return;
  const d=dt||CFG.STEP, ev=world.events||[];
  const n=comboOf(ev);
  if(n>0){ fx.cmbN+=n; fx.cmbT=CFG.BLADE_TTL; }
  if(fx.cmbT>0&&(fx.cmbT-=d)<=0){
    if(fx.cmbN>=2){ fx.calS=comboLabel(fx.cmbN); fx.calT=0.90; }
    fx.cmbN=0; fx.cmbT=0;
  }
  fx.calT=Math.max(0,fx.calT-d);
  fx.nmT=Math.max(0,fx.nmT-d);
  fx.nmCd=Math.max(0,fx.nmCd-d);
  /* Evaluated only on frames whose batch carries a boom — "the frame the blast
     was born" — which reuses the read comboOf already did and removes a
     freshness constant. REDUCE FLASH (flashK<1) suppresses the flash ENTIRELY
     at feed time, so nmT is never even set: main.js:189 only damps flx to 0.25,
     and for a brand-new light source damped is not good enough. */
  if(flashK>=1&&fx.nmCd<=0&&hasBoom(ev)&&nearMissOf(world,ev)){
    fx.nmT=0.18; fx.nmCd=0.60;
  }
}
function hasBoom(ev){
  for(let i=0;i<ev.length;i++) if(ev[i]&&ev[i].t==="boom") return true;
  return false;
}
export function getCallout(){ return fx.calT>0?fx.calS:""; }
export function getNearMiss(){ return fx.nmT; }
```

**3b — `src/render/renderer.js`.** Inside `consumeEvents` (`:34-41`), add one
line directly beneath `syncFx(world);`:

```js
    syncFx(world);
    feedFx(world, dt||CFG.STEP);
```

and extend the `fx.js` import (`:7`) to include `feedFx` and `drawFxOverlay`
(the second is wired in Task 3; import it now so Task 3 is a one-line diff):

```js
import {onEvent, updateFx, drawFx, drawFxOverlay, feedFx, getShake, getFlash, initFx, syncFx} from "./fx.js";
```

**3c — `src/render/three/wrapper.js`.** The same one line beneath its own
`syncFx(world);` inside `consumeEvents`, and the same two names added to its
`fx.js` import.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green. Note in particular that `tests/three.test.mjs` §S4 and
`tests/heat.test.mjs` are untouched — `feedFx` writes no shake, no flash and no
particles, so every existing fx pin holds byte-for-byte.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/render/fx.js src/render/renderer.js src/render/three/wrapper.js tests/fx.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Feed the R2 combo and close-call timers from inside consumeEvents.

feedFx sits between syncFx and the world.events wipe in both renderers, so it
sees the same batch main.js already reads for the ghost coach — same frame,
no main.js diff, 2D and REAL 3D in parity for free. It is PLAY-only and owns
the decay of all four R2 timers: render() runs on PAUSE/WIN/LOSE frames too,
so an ungated feed would close a group on a paused clock. updateFx keeps
owning shake, flash and the confetti that falls on the CLEARED veil. syncFx
now drops an open group across a room or attract boundary without emitting it.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `drawFxOverlay` — the callout and the close-call border

**Files:**
- Modify: `src/render/fx.js` — new `drawFxOverlay(c)` at the end of the file
- Modify: `src/render/renderer.js` — one line in the `o.hud===true` block
  (locate by the string `drawHudChips(ctx, world`)
- Modify: `src/render/three/wrapper.js` — one line in its `o.hud===true` block
  (locate by the string `drawHudChips(ovCtx,world`)
- Modify: `tests/fx.test.mjs` — append block 7
- Modify: `MEMORY.md`, `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `fx.calS` / `fx.calT` / `fx.nmT` (Task 2)
- Produces: `drawFxOverlay(c)` — paints the close-call border then the callout,
  both in overlay/HUD space, the same space `drawHudChips` and `drawCoach` use

- [ ] **Step 1: Write the failing tests**

Append to `tests/fx.test.mjs`, before the summary (and add `drawFxOverlay` to
the import list):

```js
// ---- 7. drawFxOverlay: the callout text and the close-call border ----
{
  const recCtx = () => {
    const texts = [],
      strokes = [],
      rects = [];
    const noop = () => {};
    const c = {
      save: noop,
      restore: noop,
      translate: noop,
      scale: noop,
      beginPath: noop,
      fill: noop,
      stroke: noop,
      fillText: (s) => texts.push(String(s)),
      strokeText: (s) => strokes.push(String(s)),
      fillRect: (x, y, w, h) => rects.push({ x, y, w, h, fill: c.fillStyle }),
    };
    return { c, texts, strokes, rects };
  };

  setFxOpts({ flashK: 1, shakeK: 1 });
  initFx();
  const w = chainW(3);
  syncFx(w);
  feedFx(w, CFG.BLADE_TTL + 0.01);
  const a = recCtx();
  drawFxOverlay(a.c);
  check(
    "drawFxOverlay paints the TRIPLE callout, outlined then filled",
    a.texts.includes("TRIPLE") && a.strokes.includes("TRIPLE"),
    a.texts.join("|"),
  );

  initFx();
  const b = recCtx();
  drawFxOverlay(b.c);
  check(
    "drawFxOverlay paints nothing when no callout and no flash are live",
    b.texts.length === 0 && b.rects.length === 0,
    b.texts.join("|") + " / " + b.rects.length,
  );

  initFx();
  const near = chainW(1, ctr(5), ctr(5), [blade([6, 5])]);
  syncFx(near);
  feedFx(near, CFG.STEP);
  const d = recCtx();
  drawFxOverlay(d.c);
  const band = d.rects.filter((r) => r.fill === "#fff8d8");
  check(
    "close-call paints a 6px inner border of the 600x520 board box in #fff8d8",
    band.length === 4 &&
      band.some((r) => r.w === CFG.COLS * CFG.TILE && r.h === 6) &&
      band.some((r) => r.h === CFG.ROWS * CFG.TILE - 12 && r.w === 6),
    JSON.stringify(band),
  );
}

// ---- wiring: drawFxOverlay is gated on o.hud===true, so ATTRACT stays silent ----
{
  for (const [f, chips] of [
    ["src/render/renderer.js", "drawHudChips(ctx, world"],
    ["src/render/three/wrapper.js", "drawHudChips(ovCtx,world"],
  ]) {
    const src = readFileSync(f, "utf8");
    const line = (src.match(/^.*drawFxOverlay\(.*$/m) || [""])[0];
    check(
      f + ": drawFxOverlay is drawn only under o.hud===true",
      /o\s*&&\s*o\.hud\s*===\s*true/.test(line),
      line.trim(),
    );
    check(
      f + ": it sits between the HUD chips and the coach",
      src.indexOf(chips) < src.indexOf("drawFxOverlay(") &&
        src.indexOf("drawFxOverlay(") < src.lastIndexOf("drawCoach("),
      line.trim(),
    );
  }
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/fx.test.mjs
```

Expected: FAIL — `SyntaxError: The requested module '../src/render/fx.js' does
not provide an export named 'drawFxOverlay'`.

- [ ] **Step 3: Implement**

**3a — `src/render/fx.js`.** Append at the end of the file, after `drawFx`:

```js
/* R2 overlay. Deliberately NOT folded into drawFx, which renderer.js calls
   TWICE in a WIN/LOSE frame (:66 and :79) and which the 3D path never calls at
   all (wrapper feeds getFx() to three particles instead). Drawn in overlay/HUD
   space — the same space drawHudChips and drawCoach use — so CLASSIC 2D and
   REAL 3D are identical.
   The close-call is a 6px inner border, not the existing full-screen flashT
   wash: a new light source over the whole board is exactly the over-juicing
   report §4 R2 names as the risk. The callout is a static label that fades —
   no blink, no scale-pop, no colour cycling — which is why it needs no REDUCE
   FLASH gate of its own; there is nothing to flash. */
export function drawFxOverlay(c){
  const BW=CFG.COLS*CFG.TILE, BH=CFG.ROWS*CFG.TILE;
  if(fx.nmT>0){
    c.save();
    c.globalAlpha=0.22*(fx.nmT/0.18);
    c.fillStyle="#fff8d8";
    c.fillRect(0,0,BW,6); c.fillRect(0,BH-6,BW,6);
    c.fillRect(0,6,6,BH-12); c.fillRect(BW-6,6,6,BH-12);
    c.globalAlpha=1;
    c.restore();
  }
  if(fx.calT>0&&fx.calS){
    c.save();
    c.globalAlpha=Math.min(1,fx.calT/0.35);
    c.textAlign="center"; c.textBaseline="middle";
    c.font="900 26px ui-monospace,monospace";
    c.lineWidth=5; c.lineJoin="round"; c.strokeStyle="#0a0d14";
    c.strokeText(fx.calS,BW/2,96);
    c.fillStyle="#ffd447";
    c.fillText(fx.calS,BW/2,96);
    c.globalAlpha=1;
    c.restore();
  }
}
```

`y = 96` is clear of the HUD chip row, which ends at `y = 40`
(`scenes.js` `chip(x, 10, w, 30)`).

**3b — `src/render/renderer.js`.** In the `o.hud===true` block, add the middle
line (the import was already extended in Task 2):

```js
    if(o&&o.hud===true) drawHudChips(ctx, world);
    if(o&&o.hud===true) drawFxOverlay(ctx);
    if(o&&o.hud===true) drawCoach(ctx, (o&&o.coach)||0);
```

**3c — `src/render/three/wrapper.js`.** The same, in its own block:

```js
      if(o&&o.hud===true)drawHudChips(ovCtx,world);
      if(o&&o.hud===true)drawFxOverlay(ovCtx);
      if(o&&o.hud===true)drawCoach(ovCtx,(o&&o.coach)||0);
```

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green.

- [ ] **Step 5: Headed play-verify** (AGENTS.md: "Visual 3D feel is not covered
by Node")

Unregister the service worker and delete its caches first — a stale SW serves
pre-change bytes and looks exactly like a render change that did not land.
Then, on `http://127.0.0.1:8080/index.html` (`npm start`):

1. **CLASSIC 2D, chain of ≥3.** Plant beside a brick cluster with two live
   bombs so the chain recurses. Confirm one static `TRIPLE` (or higher) at
   board centre, ~96 px down, that fades over the last third of its life and
   does **not** blink or pop.
2. **REAL 3D (`?render=3d`), same chain.** Confirm the callout lands in the
   same place on the overlay canvas, identical size and colour.
3. **Close-call.** Stand one tile off an exploding arm. Confirm a single short
   border pulse, and that a wall of blades does **not** strobe (the 0.60 s
   cooldown).
4. **REDUCE FLASH.** OPTIONS → REDUCE FLASH on. Confirm the border pulse is
   **gone entirely** and the callout still appears.
5. **PAUSE mid-chain.** Press `P` on the frame the chain lands. Confirm no
   callout paints over the PAUSED list, and that it appears once play resumes.
6. **ATTRACT.** Idle at MENU for 10 s. Confirm the demo bot's chains are
   silent.

- [ ] **Step 6: PWA bump, MEMORY, commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`. Append to `MEMORY.md` under a new
`## 2026-09-06 — R2 combo callout + close-call flash` heading (newest first,
1–2 lines): that multi-kill chains now call out `DOUBLE`/`TRIPLE`/`QUAD`/
`CHAIN ×n` and a blast that stops one tile short pulses a border, both fed from
inside `consumeEvents` with no `main.js` and no `sim.js` diff; and that `feedFx`
— not `updateFx` — owns the R2 decay and freezes outside PLAY, so a paused
player's group survives the pause instead of closing on a paused clock.

```bash
git add src/render/fx.js src/render/renderer.js src/render/three/wrapper.js tests/fx.test.mjs MEMORY.md src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Draw the combo callout and the close-call border in HUD space.

drawFxOverlay is its own entry point rather than part of drawFx, which the 2D
path calls twice on a WIN frame and the 3D path never calls at all. It sits
between the HUD chips and the ghost coach under the same o.hud===true gate, so
ATTRACT's demo chains stay silent and both renderers paint it identically. The
close-call is a 6px inner border rather than a second full-screen wash, and
REDUCE FLASH suppresses it outright instead of damping it.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```
