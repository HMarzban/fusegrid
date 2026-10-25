# Floor Tiles, Direction D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the round-3 emblem-in-a-frame floor tiles with direction D (hardware sunk into the floor for ICE / FACTORY / ARENA / VOID / CROWN, changed ground for JUNGLE / WATER / SAND) in CLASSIC 2D, PIXEL and REAL 3D, all 8 tiles, 3 heats.

**Architecture:** Swap the painters behind the existing seam. `src/render/featdraw.js` keeps `cellSpec` / `specKey` / `paintCell` / `drawFeat` (the one 2D painter that also bakes the REAL 3D atlas) and dispatches to new painter modules in `src/render/featart/`. `featpx.js` gets hand-pixelled cells. `three/featmesh.js` keeps its one InstancedMesh and atlas, and its shader effects are retargeted to geometry exported from one table (`featart/geo.js`) so art and shader cannot drift. Internal kind names stay (`BELT GLIDE BLOOM PLATE STREAM QUICK PORTAL GATE`); user-facing names are copy only.

**Tech Stack:** Pure ES modules, Canvas 2D, vendored three r160, `node --test`, headless Chrome through `tools/tileart/harness.mjs` for pixel gates. Zero npm deps.

**Spec:** `docs/superpowers/specs/2026-10-25-floor-tiles-direction-d-design.md` (look, picks, rules). Art sources: `.superpowers/sdd/2026-10-25-tile-art-d/source/` (`dirA.js`, `dirB.js`, `dirD.js` pick table, `lib.js` harness, `today-round3-2d-px-3d/` baselines). Options page: https://claude.ai/artifact/G12wGJ3x1AqY4rxKaTkb84.

## Global Constraints

- Build ONLY in a fresh worktree branch `tiles-d` cut from `worktree-agent-a3057d0a51e6a8d96` (round-3 floor). Never modify, merge or push any locked worktree or branch. Never push at all without the owner's say-so. Never merge the walls branches.
- Zero npm runtime deps; three r160 stays vendored. No comments unless the file already uses explanatory block comments; compact style, no space after `key:` where the file already omits it (match the file you edit).
- No new hex: biome slots (`bg0 bg1 floor0 floor1 wall wallHi`), slot mixes, `#000` / `#fff` at alpha. Never `brickA` / `brickB` / `brickHi`. VOID: nothing brighter than `wallHi`.
- Heat is shown by structure, count, value and tip shape, never colour: same slots at CORE, PLUS, MAX. A tile never starts damage on its own. No "+", no round disc as a whole tile idea, no raised chamfered slab.
- Nothing under 1.2 game units; every mark has a cause (no filler speckle); light from the top-left in BOARD space whatever a tile's direction.
- Judge at true size: 40 px CLASSIC 2D, k≈3 PIXEL, rig C in REAL 3D, and in grayscale.
- REAL 3D: ONE InstancedMesh, 142 draws in a tile room (141 elsewhere), frozen light recipe, NoToneMapping, no fog, PLAY-only effect clock (`world.featT`; PAUSE freezes everything), nothing flashes.
- PIXEL: palette-SLOT grids only (`tile.<field>[.step]`), never hex; every cell passes `validateCell`. `featpx.js` stays OUT of `src/render/pixel/**` (px tree has 771 B headroom; wiring waits for #15).
- CLASSIC 2D hash `97480c1c:22630` stays pinned (gen 1 has no tile layer). `src/core` stays DOM-free and deterministic; all new randomness is render-side `hsh`.
- Never write the private reference game's name in any file, comment, commit or image.
- Every owner rename holds: BOOSTER / ICE PATCH / CONVEYOR / STREAM / TRAP / QUICKSAND / PORTAL / GATE in copy; CORE (easy) / PLUS (normal) / MAX (hard).

## Review Focus

Failure modes the spec implies that no per-tile art task would test by itself. Each has a test in the task that owns the code.

1. **Rotated belts and streams** (`dir` 1..3): the key light must stay top-left. A naive 90° rotation flips bevels. Pinned in Task 3 (CONVEYOR) and Task 4 (STREAM).
2. **Run seams**: adjacent same-kind tiles must continue without a visible seam or a stray end cap; only run ends get caps; ICE patches of any shape (not just E-W) get rails only on sides with no same-kind neighbour. Tasks 3, 4.
3. **State coverage in the atlas**: a room with every state variant (BLOOM 3, PLATE up to 6, GATE 5, PORTAL pair 1..3) must fit the 64-cell atlas and never throw on a missing cell or an unknown kind. Task 5.
4. **VOID dim rule**: no PORTAL pixel in 2D, no PIXEL slot, and no 3D tint brighter than `wallHi`, at any heat, state or pair id, including the breathing core. Tasks 3, 6, 7.
5. **Heat separation at true size in grayscale**: CORE / PLUS / MAX of every tile must be pairwise distinguishable at 40 px, and no tile may read as BRICK, WALL, a pickup or a foe. Task 8 gates it numerically; Task 9 judges it by eye.

---

## File structure

- Create `src/render/featart/kit.js`: shared pure helpers (`mix hsh rgb hex`, shape and bevel helpers the painters share). One responsibility: no painter-specific art.
- Create `src/render/featart/geo.js`: the geometry table the painters AND the 3D shader both read (pip positions, kerb cells, roller band, channel band, funnel centre, core box).
- Create `src/render/featart/built.js`: painters ICE (GLIDE), CONVEYOR (BELT), TRAP (PLATE), PORTAL, GATE (from direction A).
- Create `src/render/featart/living.js`: painters BOOSTER (BLOOM), STREAM, QUICKSAND (QUICK) (from direction B).
- Modify `src/render/featdraw.js`: keep `tones`, `mix`, `edge`-free exports used elsewhere; drop the old painters; `cellSpec` gains `par` and `nb`; `paintCell` builds the painter's `k`.
- Modify `src/render/featpx.js`: new hand-pixelled cells.
- Modify `src/render/three/featmesh.js`: shader constants and effect regions from `geo.js`; `variants()` for the new states.
- Create `tests/lib/ctxrec.mjs` (a recording canvas context, same Proxy idea as `tests/lib/classichash.mjs`), `tests/tile-art-d.test.mjs`.
- Create `tools/tileart/gates.mjs`, `tools/tileart/pxdraft.mjs`; modify `tools/tileart/measure.mjs`, `harness.mjs` (`TILES`), `export.mjs`, `manifest.mjs`.
- Docs: `AGENTS.md`, `MEMORY.md`, `docs/architecture.md` pointer, `docs/diary.md`, the tiles record addendum.

## Painter contract (used by every task)

```js
// every painter: (c, k) => void, c = Canvas 2D ctx scaled to ONE tile, 40x40 units, clipped
// k = { bio, h, nb, par, on, dir, phase, state, lit, pair, gx, gy }
//   bio   BIOMES entry          h     0 CORE / 1 PLUS / 2 MAX
//   nb    {N,E,S,W} true where the SAME kind continues (outer sides = !nb[s])
//   par   (x+y)&1 checker parity (the bed it replaces)
//   dir   0..3 E,S,W,N for BELT and STREAM (flow direction); else 0
//   phase 0..39 belt/stream scroll offset in units (2D animation); else 0
//   state BLOOM 0 idle 1 flare 2 cooling; PLATE 0 idle 1 winding 2 cooling
//   lit   GATE 0..4 timer cells lit; PLATE 1..4 wind-up progress
//   pair  PORTAL id 1..3        gx,gy GLIDE tile coords (sheet-continuous marks)
export const BUILT = { GLIDE, BELT, PLATE, PORTAL, GATE }   // built.js
export const LIVING = { BLOOM, STREAM, QUICK }              // living.js
// BELT and STREAM are { mech(c,k), lit(c,k) }: mech is drawn in the rotated frame,
// lit (bevels, lips, AO) in the BOARD frame, so the key stays top-left at every dir.
```

---

### Task 1: Worktree, archive, baseline

**Files:**
- Create: worktree `.claude/worktrees/tiles-d` on branch `tiles-d`.
- Verify: `.superpowers/sdd/2026-10-25-tile-art-d/source/` exists (already archived).

**Interfaces:**
- Produces: a working checkout where `node --test` is green before any change.

- [ ] **Step 1: Create the worktree** from the round-3 branch without touching it: `git worktree add -b tiles-d .claude/worktrees/tiles-d worktree-agent-a3057d0a51e6a8d96`. Do not lock it; do not use `-B` or `--force`.
- [ ] **Step 2: Baseline run.** In the new worktree: `node --test`. Expected: 65 / 65 pass (the round-3 notes' number). If the number differs, record the real number in the task notes and use it as the baseline for every later "all green" check.
- [ ] **Step 3: Record the baselines** the gates compare against: `TILEART_OUT=<scratch>/baseline/ node tools/tileart/measure.mjs /src/render/featdraw.js <scratch>/baseline-measure.json` (round-3 painter) and the round-3 `featpx.js` byte size (13,110 B).
- [ ] **Step 4: Commit nothing** (no file changes yet). Note the worktree path in `MEMORY.md` at close-out.

### Task 2: Kit, geometry table and the painter contract

**Files:**
- Create: `src/render/featart/kit.js`, `src/render/featart/geo.js`, `tests/lib/ctxrec.mjs`, `tests/tile-art-d.test.mjs`.
- Modify: `src/render/featdraw.js` (`cellSpec`, `specKey`, `paintCell`).

**Interfaces:**
- Produces: `kit.js` exports `mix(top,bot,a) -> "#rrggbb"`, `hsh(a,b,c) -> [0,1)`, `rgb(hex) -> [r,g,b]`, `hex([r,g,b]) -> string`, and the shape helpers the two source files duplicate (`fillP`, `rect`, `line`, `bevel`, `ao`, `shade`; take their exact signatures from `dirA.js`).
- Produces: `geo.js` exports `GEO = { PORTAL:{pips:[[x,y,w,h]x3], core:[cx,cy,half]}, GATE:{kerb:[[x,y,w,h]x4]}, BELT:{band:[y0,y1] per heat}, STREAM:{half:number}, QUICK:{c:[20,20], rIn, rOut}, BLOOM:{c:[20,20], r}, PLATE:{well:[x,y,w,h]} }`. Values are filled by Tasks 3 and 4 as the painters fix them; this task defines the shape and exports placeholders equal to the round-3 values so the build stays green.
- Produces: `cellSpec(w,x,y)` now also returns `par: (x+y)&1` and `nb: {N,E,S,W}` (true where the neighbouring cell has the same `kind`); `specKey` includes both; `paintCell(c,b,s,o)` builds `k` from `s` and calls the painter table (old painters still behind it until Tasks 3, 4).
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Write the failing tests** in `tests/tile-art-d.test.mjs`: `cellSpec gives nb and par for a belt chain` (a 3-cell E-W BELT run at (5,5): middle `nb` is `{N:false,E:true,S:false,W:true}`, ends have one side false, `par` equals `(x+y)&1`); `specKey differs when par or nb differs`; `kit.mix matches the round-3 mix` (compare `mix("#ffffff","#000000",0.5)` to `"#808080"` and the same call in `featdraw.js`'s exported `mix`).
- [ ] **Step 2: Run** `node --test tests/tile-art-d.test.mjs`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** `kit.js` (move the shared helpers; keep `featdraw.js`'s `mix` export as a re-export so `featpx`, tools and tests keep working), `geo.js`, the `cellSpec` / `specKey` / `paintCell` changes, and `tests/lib/ctxrec.mjs` exporting `rec() -> {ctx, log}` (Proxy that logs every call and property write, `createLinearGradient` etc. return a recorder).
- [ ] **Step 4: Run** `node --test`. Expected: all green at the Task 1 baseline plus the new tests.
- [ ] **Step 5: Commit** `git add src/render/featart src/render/featdraw.js tests && git commit -m "feat: tile art kit, geometry table and painter contract"`.

### Task 3: Built painters (A): ICE, CONVEYOR, TRAP, PORTAL, GATE

**Files:**
- Create: `src/render/featart/built.js`.
- Modify: `src/render/featart/geo.js` (fill `BELT`, `PORTAL`, `GATE`, `PLATE`), `tests/tile-art-d.test.mjs`.
- Source: `.superpowers/sdd/2026-10-25-tile-art-d/source/dirA.js` (port `ICE CONVEYOR TRAP PORTAL GATE`; leave `BOOSTER STREAM QUICKSAND` behind).

**Interfaces:**
- Consumes: `kit.js` helpers, the painter contract, `GEO`.
- Produces: `BUILT = {GLIDE(c,k), BELT:{mech(c,k),lit(c,k)}, PLATE(c,k), PORTAL(c,k), GATE(c,k)}`; the dispatch in `paintCell` routes those kinds here.

Port rules (the source painters were written for a sheet, not the game):
- **GLIDE:** rails only on sides where `!k.nb[side]` (the source assumed an E-W run); the glaze streaks use `k.gx,k.gy` so marks are continuous across a patch; 1 / 2 / 3 grooves by `k.h`.
- **BELT:** roller period divides 40 (4 / 5 / 8 rollers = 10 / 8 / 5 units); `k.phase` translates the roller band only (rails, rivets, end caps are board-fixed); the end cap appears only when `!k.nb.E` in the local frame; `mech` draws in the rotated frame and `lit` in the board frame (the prototype's `belt()` shows the split).
- **PLATE:** state 0 idle; state 1 = the plate sinks deeper and `k.lit` 1..4 fills a four-notch progress strip along the well's lower lip (my call: the wind-up must stay telegraphed, A's source only had on/off); state 2 cooling = state 0 darkened one step. Cleats 1 / 2 / 3 are the reach.
- **PORTAL:** read `k.pair` (the source used a `k.pid` default of 2): 1 / 2 / 3 ticks on the lip; ring stack 2 / 3 / 4 by `k.h`. Maximum pixel stays under `wallHi`.
- **GATE:** the timer strip has exactly four cells so `k.lit` 0..4 maps 1:1 to the existing `featM` states; shut (`state` 1) shows bars raised. Bars 3 / 4 / 5 by `k.h`.
- Replace every `FG.floorTile` / `k.par` dependency with the in-contract `k.par`.

- [ ] **Step 1: Write the failing tests**: `built painters never throw for every kind x heat x state` (loop the 5 kinds, `h` 0..2, states, `lit` 0..4, `pair` 1..3, `nb` all 16 combinations, `dir` 0..3 with the `ctxrec` context); `painters use only allowed colours` (every recorded `fillStyle` / `strokeStyle` / gradient stop is `#000`, `#fff`, an `rgb()`/hex derived from the biome slots or a `mix` of two of them; assert by recomputing the allowed set from `BIOMES` and 11 mix steps); `PORTAL never exceeds wallHi` (relative luminance of every recorded opaque colour on VOID at most that of `#8a70b0`); `BELT roller period divides 40` (the three heats' roller counts times their period equal 40).
- [ ] **Step 2: Run** `node --test tests/tile-art-d.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** `built.js` per the port rules, fill `GEO` for the five kinds, route `paintCell`.
- [ ] **Step 4: Run** `node --test`. Expected: all green.
- [ ] **Step 5: Pixel gate in Chrome** (these cannot be Node tests): add `tools/tileart/gates.mjs` checks `rotation keeps the key top-left` (render BELT at `dir` 0..3 with `lit` and compare mean luminance of the NW 6-unit strip vs the SE 6-unit strip of the rail region: the sign must match across all four dirs) and `run seam` (render a 3-run and compare the 2-px column pair across each tile boundary: mean abs RGB difference ≤ 6). Run `node tools/tileart/gates.mjs built`. Expected: PASS for all.
- [ ] **Step 6: Commit** `git commit -m "feat: direction D built painters (ICE CONVEYOR TRAP PORTAL GATE)"`.

### Task 4: Living painters (B): BOOSTER, STREAM, QUICKSAND

**Files:**
- Create: `src/render/featart/living.js`.
- Modify: `src/render/featart/geo.js` (`STREAM`, `QUICK`, `BLOOM`), `tests/tile-art-d.test.mjs`.
- Source: `source/dirB.js` (`BOOSTER STREAM QUICKSAND` only).

**Interfaces:**
- Consumes: `kit.js`, contract, `GEO`.
- Produces: `LIVING = {BLOOM(c,k), STREAM:{mech(c,k),lit(c,k)}, QUICK(c,k)}`.

Port rules:
- **BLOOM:** the growth points East at `dir`-less rest (the blast direction is runtime, so the leaf keeps pointing East; state 1 flare brightens the spear; state 2 cooling shrinks side shoots to the heat-below count). Side shoots none / one pair / two pairs.
- **STREAM:** period of ripples divides 40; `k.phase` shifts the ripple band only; banks (light lip) only on sides with `!k.nb`; run ends get the channel mouth, middle tiles are seamless; `mech` rotated, `lit` board-frame as in Task 3.
- **QUICK:** the rim is intact at every heat; heat is 2 / 3 / 4 terraces, steeper and darker; the centre is `GEO.QUICK.c`; no random fragmentation (`hsh` seeded by `k.par` only).
- No chamfered raised squares anywhere; marks only where caused.

- [ ] **Step 1: Write the failing tests**: the same never-throws / allowed-colours loops for the three kinds, plus `STREAM ripple period divides 40` and `QUICK terrace count is 2,3,4 by heat` (count recorded concentric fill calls tagged by the painter through a `GEO.QUICK.terraces` table: `[2,3,4]`).
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement** `living.js`, fill `GEO`, route `paintCell`.
- [ ] **Step 4: Run** `node --test`. Expected: all green.
- [ ] **Step 5: Extend `gates.mjs`** with the `living` set (rotation, seam, channel mouth only at run ends: render a 3-run and assert the end tiles differ from the middle tile at the tile edge columns, the middle matches both neighbours). Run `node tools/tileart/gates.mjs living`. Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "feat: direction D living painters (BOOSTER STREAM QUICKSAND)"`.

### Task 5: Remove the old painters, fix the atlas variants

**Files:**
- Modify: `src/render/featdraw.js` (delete the round-3 painters and `edge` / `lip` / `sheen` if nothing else imports them; keep `tones`, `mix`, `cellSpec`, `specKey`, `paintCell`, `drawFeat`, `tierOf`), `src/render/three/featmesh.js` (`variants`), `tools/tileart/harness.mjs` (`TILES`), `tools/tileart/export.mjs`, `tests/tile-proto.test.mjs` if it imports removed names.

**Interfaces:**
- Consumes: `BUILT`, `LIVING`.
- Produces: `variants(w,x,y)` returns at most: BELT 1, STREAM 1, BLOOM 3, PLATE 6 (`state 0`, `state 1` x `lit` 1..4, `state 2`), GATE 5, PORTAL 1 (the pair id is in `aFx.z`, not in the cell, because pips are shader-lit), GLIDE and QUICK 1.

- [ ] **Step 1: Write the failing tests**: `atlas cap`: build a world whose `feat` holds every kind and every state at once and assert `new Set(variants...).size <= 64`; `unknown or zero feat code paints nothing and does not throw`; `PAUSE freezes`: `buildFeat(...).update(w)` twice with the same `featT` leaves `uTime`, `uT`, `uSt` unchanged.
- [ ] **Step 2: Run** the file. Expected: FAIL on the first test or on a removed import.
- [ ] **Step 3: Implement** the removals and variant list; update `harness.mjs` `TILES` so the isolated export still has the 8 kinds and their render-only codes; keep `tools/tileart/featdraw_r2.js` as the round-3 baseline.
- [ ] **Step 4: Run** `node --test`. Expected: all green; `tests/tile-proto.test.mjs` still asserts exactly +1 draw (142).
- [ ] **Step 5: Commit** `git commit -m "refactor: swap tile painters to direction D, atlas variants"`.

### Task 6: REAL 3D: retarget the shader effects

**Files:**
- Modify: `src/render/three/featmesh.js`, `src/render/featart/geo.js`, `tests/tile-art-d.test.mjs`.

**Interfaces:**
- Consumes: `GEO` (pip positions, kerb cells, roller band, channel half-width, funnel centre, core box).
- Produces: the shader's hard-coded constants (`6.9 / 10.7` pips, `KERB` boxes, `uBand`, the `across < 0.375` channel, `0.35` radius funnel, the TRAP edge pulse) replaced by uniforms or `#define`s generated from `GEO` at `buildFeat` time.

Effect map (all on `uTime = world.featT`; every tint `uHi` or black; nothing flashes; `uFxK` stays):

| Tile | Effect after D |
|---|---|
| ICE | specular sweep as today (art-agnostic) |
| BOOSTER CORE | leaves breathe, ±3.5 % about `GEO.BLOOM.c` |
| CONVEYOR | scroll only the roller band `GEO.BELT.band[h]`; rails, caps fixed |
| STREAM | scroll the channel `GEO.STREAM.half`; banks fixed |
| TRAP MAX | the well deepens and relaxes (value ×0.8 to 1.0, 2.6 s) on `GEO.PLATE.well` |
| QUICKSAND | dark inward drift about `GEO.QUICK.c` between `rIn` and `rOut` |
| PORTAL | core breathes toward `wallHi` (never past it; relief may only darken); pair ticks count up 1..n at 1.2 Hz at `GEO.PORTAL.pips` |
| GATE | lit timer cells glow (emissive, `wallHi`, ±0.06) at `GEO.GATE.kerb` |

- [ ] **Step 1: Write the failing tests**: `featmesh shader source contains every GEO constant` (build the fragment string through an exported `fragSource(GEO)`; assert each pip, kerb and band number appears); `still one draw`: `countDrawCalls` difference stays exactly 1; `effects are PLAY-clock only`: with `featT` fixed the shader uniforms do not change between two `update(w)` calls.
- [ ] **Step 2: Run** the file. Expected: FAIL (no `fragSource`).
- [ ] **Step 3: Implement** `fragSource(GEO)`, move the effect regions to uniforms or defines, keep the relief taps and `aFx` plumbing as is.
- [ ] **Step 4: Run** `node --test`. Expected: all green.
- [ ] **Step 5: Headless 3D check** with the real layer: `node tools/tileart/export.mjs` (isolated scenes at rig C, six-frame strips). Expected: 142 draws per scene as before, no console errors, no frame brighter than `wallHi` on VOID (pixel max check inside `gates.mjs 3d`).
- [ ] **Step 6: Commit** `git commit -m "feat: tile shader effects read the D geometry table"`.

### Task 7: PIXEL cells, hand-pixelled

**Files:**
- Modify: `src/render/featpx.js`, `tests/tile-proto.test.mjs` or `tests/tile-art-d.test.mjs`.
- Create: `tools/tileart/pxdraft.mjs`.

**Interfaces:**
- Consumes: `featPxCell(biome, s) -> {w:20,h:20,rows,pal}` signature and `palFor` (unchanged); `pxRamp` roles via `tile.<field>[.step]`.
- Produces: new grids per kind and heat for the 8 tiles plus states (BLOOM flare / cool, PLATE winding lit 1..4, GATE lit 0..4, PORTAL pair 1..3); rotation by `rot90` for BELT and STREAM; board-space lip and edge passes after rotation as today.

Process: `pxdraft.mjs` renders a tile's 2D painter at 20×20 and snaps each pixel to the nearest palette slot char (the `palFor` map plus the bed chars), emitting a grid draft that a human refines; the draft is a starting point only, never the shipped cell. Hand-edit rules from the critique: flat runs not checker dither, one-step bevels, 2-px minimum marks, no random flecks, silhouette first, one key from top-left. The craft skills (`pixel-art`, `pxl-pixel-art`) and the `art-director` agent are read-only critics; their `validations.md` conflicts with ruling R20 so it is not a rule here.

- [ ] **Step 1: Write the failing tests**: `every PIXEL tile cell is palette slots only and valid` for the 8 tiles x 3 heats x each state (use the existing `validateCell` loop in `tests/tile-proto.test.mjs` as the template, extended with the states); `PORTAL slots stay at or under wallHi` (the char map for VOID never resolves to a slot brighter than `tile.wallHi`); `featpx.js size`: file bytes at most 16,260 (the pre-round-3 size; my call: the hand grids are denser than round 3's 13,110, and it stays out of the px tree).
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement** `pxdraft.mjs`, then author the cells in two reviewable batches: built (ICE, CONVEYOR, TRAP, PORTAL, GATE) then living (BOOSTER, STREAM, QUICKSAND). After each batch run `node tools/tileart/pxexport.mjs` and look at k≈3 true size, in grayscale, next to the 2D tile.
- [ ] **Step 4: Run** `node --test`. Expected: all green, including the byte cap.
- [ ] **Step 5: Commit** one commit per batch: `feat: direction D PIXEL cells (built)` and `(living)`.

### Task 8: Numeric gates and the baseline comparison

**Files:**
- Modify: `tools/tileart/measure.mjs`, `tools/tileart/gates.mjs`, `tools/tileart/manifest.mjs`; create `.superpowers/sdd/2026-10-25-tile-art-d/notes.md` (numbers, local only).

**Interfaces:**
- Consumes: baseline JSON from Task 1.
- Produces: `node tools/tileart/gates.mjs all` exits non-zero on any failed gate and prints a table.

The round-3 gate "marks at most 30 %" used a marks-only render pass that the D painters do not have (they paint depth, not a marks layer). New gates, all measured on the 160 px render of the real painter:

1. **Figure coverage** (replaces marks coverage): share of pixels whose L* differs from the tile's median L* by at least 10. Gate: no tile at any heat or state exceeds its round-3 value from the baseline file by more than 10 points (my call; the intent is "no busier than today"; the owner can tighten it).
2. **Heat separation**: pairwise mean absolute L* difference between the 40-px downscaled CORE / PLUS / MAX tiles of each kind. Gate: at least the round-3 minimum for that kind, and never below 3.
3. **Readability**: figure-vs-bed dL at least 20 for CORE (as round 3), CVD (protan / deutan / tritan) dE at least 12, bed vs `brickB` dE at least 14 (SAND floor, as round 3).
4. **WALL / BRICK confusion**: mean dE between each tile's bed and the biome's `wall` and `brickA` slot colours at least 14, and the tile has no straight horizontal or vertical course pattern at a half-tile period (reuse `tools/walls/gray.mjs` from the walls branch only as a reference; do not merge it).
5. **VOID**: no pixel brighter than `wallHi` in the PORTAL render.
6. **Colour slots only**: every opaque pixel of every render is within dE 3 of a slot, a slot mix, black or white (sample against the allowed set computed from `BIOMES`).

- [ ] **Step 1: Write the failing test** `gates.mjs reports a failing gate`: a fixture painter that paints a pure red square must fail gate 6 (run through the same function the tool uses; unit-testable in Node over a pixel array).
- [ ] **Step 2: Run** `node --test tests/tile-art-d.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** the gates as pure functions over RGBA arrays (so Node tests can feed fixtures) and the Chrome driver that renders real painters.
- [ ] **Step 4: Run** `node tools/tileart/gates.mjs all`. Expected: a table; fix every FAIL by changing the painter, never the gate. Record the table in `notes.md`.
- [ ] **Step 5: Run** `node --test`. Expected: all green.
- [ ] **Step 6: Commit** `git commit -m "test: direction D readability and rule gates"`.

### Task 9: True-size review, exports, owner preview

**Files:**
- Create (local, git-ignored): `.superpowers/sdd/2026-10-25-tile-art-d/round1/{2d,px,3d,3d-anim}/`, QA frames.

- [ ] **Step 1: Export** with `node tools/tileart/export.mjs`, `pxexport.mjs`, `qa.mjs` (gen-2 rooms 1, 2, 3, 5, 6 at CORE and MAX; foes frozen), at the real in-game sizes.
- [ ] **Step 2: Critique.** Run the `art-director` agent read-only on the true-size sheets and the QA frames. Fix what it finds in the painters (not the gates), re-run Task 8, then one more critique pass. Open items go to the owner, not into silent compromises.
- [ ] **Step 3: Check the known weak spots by eye first**: ICE and CONVEYOR next to the FACTORY wall slabs and the white ICE brick, TRAP wind-up telegraph, STREAM tube read, QUICKSAND terrace count in grayscale.
- [ ] **Step 4: Update the owner preview page** `https://claude.ai/artifact/47wrvBBwmuzqiUrwKDn6A9` (read it first, publish by `url`) or publish a clean new one; keep it tiles-only (no board), with the true-size and grayscale toggles and the moving 3D strips. Say plainly in one line what is a preview.
- [ ] **Step 5: Real-GPU 3D look** in headed Chromium with a fresh profile and no service worker (stale SW serves old bytes): one visual pass at rig C. Frame-time claims need headed real-GPU Chrome, never the rAF shim or SwiftShader; make none without it.

### Task 10: Docs, memory, housekeeping

**Files:**
- Modify: `AGENTS.md` (Tiles bullet: direction D look, rules, status), `MEMORY.md` (dated entry), `docs/architecture.md` (one pointer line), `docs/diary.md` (dated entry), `docs/superpowers/specs/2026-10-21-difficulty-tiles-design.md` (addendum pointing at the 2026-10-25 record), `.superpowers/sdd/PROTOTYPES-2026-10.md` (add the `tiles-d` row).

- [ ] **Step 1: Write the docs** in arcade tone, facts exact; one owner per fact (link, do not copy). Record each owner ask from this round: the redesign, direction D, and "plan the real build" (this plan).
- [ ] **Step 2: Draft** (do not post) the update text for GitHub issues #16 and #23; the owner posts.
- [ ] **Step 3: Housekeeping**: stop any `PORT=0 node serve.js` and headless Chrome this plan started, by PID; delete scratch `--user-data-dir` profiles; leave the locked worktrees untouched; leave `tiles-d` unmerged and unpushed.
- [ ] **Step 4: `node --test`** one final time. Expected: all green. Commit docs: `git commit -m "docs: floor tiles direction D record"`.

---

## Order and parallelism

Task 1, then Task 2. Tasks 3 and 4 are independent (different files) and can run in parallel after Task 2. Task 5 needs both. Tasks 6 and 7 need Task 5 and are independent of each other. Task 8 needs 6 and 7. Tasks 9 and 10 close out. Never run two writers on `featdraw.js`, `featmesh.js` or `geo.js` at once.

## Calls I made (for you to veto)

- Internal kind names stay (`BELT`, `GLIDE`, `BLOOM`, `PLATE`, `QUICK`): renaming would touch sim, tests and tools for no visible gain.
- TRAP wind-up stays telegraphed through a four-notch progress strip, because A's source only had an on / off sink.
- Coverage gate is "no busier than round 3 by the same measure" because the D painters have no marks-only pass.
- `featpx.js` byte cap 16,260 (round 3 was 13,110).
- The build stays on the local prototype stack; porting to `main` waits for #28, #16 and #15.
- The sheet's auto-quantised PIXEL and relief 3D previews were only previews; Task 7 and Task 6 are the real work.

## Self-review

- **Spec coverage:** the look table → Tasks 3, 4, 7; rules → Global Constraints and Task 8 gates; REAL 3D budget and effects → Task 6; known weak spots → Task 9 step 3; non-goals → Global Constraints.
- **Type consistency:** `k` fields are defined once in the contract; `BUILT` / `LIVING` / `GEO` names are used the same in Tasks 2 to 6.
- **Proportion:** the plan fixes decisions the executor cannot make alone (file split, contract, state handling, gates). Painter bodies are not written here; the sources are archived and named.
- **Gaps checked:** rotated belts, seams, atlas cap, VOID cap, heat separation are in Review Focus with owning tasks.
