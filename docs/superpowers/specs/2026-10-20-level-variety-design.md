# Level variety: a random board every run, bold mazes per biome

**Date:** 2026-10-20 · **Status:** design approved by the owner, **not built** ·
**Issue:** HMarzban/fusegrid#8 (tasks #10 #11 #12 #13 #15 #16 #17)

> Owner report: *"all game level are the same, it mean when gamer open the
> first level the game board is the same game board with the same maze like
> before."*

This record keeps every step of the 2026-10-20 round: the measurement that
proved the report, the research team, each owner ruling in order, the design
those rulings produced, and the mockups that showed it. Nothing here is in
the game yet. The tasks are linked under #8.

---

## 1. The problem, measured

Sweep: `genBoard` over 1000 seeds × rooms 1–8 × CORE / PLUS / MAX.

| Fact | Number |
|---|---|
| Tiles identical in every room of every seed | **128 of 195** (the wall lattice plus a fixed brick ring on rows 1/11 and columns 1/13) |
| Tiles that can ever change | 67, only bricks with x,y in [2, C-3] |
| Mean difference between two boards | 29.2 tiles (CORE), 27.0 (PLUS), 24.5 (MAX) |
| Distinct wall layouts | **1**, the same for every room, seed and biome |
| Tiles within 3 steps of spawn that ever change | **0 of 17** |
| Same seed, CORE vs MAX | 5.2 tiles apart |
| One session | Room N is byte-identical on every run (800 of 800 rebuilds) |

Why:

- `genBoard` (`src/core/board.js`) hard-codes the border, the even-tile
  pillar grid and the spawn pockets, and only removes interior bricks at
  `carve` 0.32 / 0.28 / 0.24.
- `bootSeed` (`src/main.js`) is drawn once per page load. PLAY, LEVEL SELECT,
  a run from ATTRACT, GAME OVER → Space and PAUSE → RESTART all reuse it.
- Biomes change palette, music and foes, never geometry.
- The spawn-pocket code also deletes pillars (2,10) and (12,10) by accident,
  so today's board is 80 walls (52 border + 28 pillars).

Fairness findings on today's generator:

- 16.9% of CORE boards (13.3% PLUS, 10.0% MAX) have an open 5-step lane from
  spawn to a tile where a foe can start. On those boards the demobot is hit in
  its first 5 s in 15–39% of runs, against 0–15% on sealed boards.
- `SPAWN_CLEAR` is a straight-line check, so 371 hunter placements in 24 000
  rooms (about 1.5%) start within 8 walking steps of spawn.

## 2. How the round ran

1. **Lead measurement** (above), then a shared brief with the hard
   constraints: determinism, shared codes and dailies, pinned tests,
   seed-keyed stores, render budgets, AI off-limits, and the banned name.
2. **Five research lenses in parallel:** systems auditor, level designer,
   procedural-generation designer, player-experience and trust researcher,
   environment artist. Each wrote a report; two built and swept prototype
   generators.
3. **Critic pass:** re-ran the load-bearing claims (all confirmed, one wall
   count corrected) and merged the two generator designs.
4. **Issue #8** filed with the findings and 13 owner questions.
5. **Owner rulings** (section 3), then nine task issues #9–#17.
6. **UI mockup round:** three designers drew the screens, the new boards and
   the new tiles through the real renderers in throwaway worktrees.
7. **Owner simplification:** random boards, no new UI. #9 and #14 closed.
8. **Biome mazes:** 2–3 base layouts for WATER, ARENA and CROWN, captured.
9. **Bold:** every layout made bold, recaptured, bot-tested.
10. **Fair start:** the start sealed and foes moved farther away, bot-tested
    again (section 6).

The working notes, prototypes, sweeps and captures stay in the git-ignored
`.superpowers/sdd/2026-10-20-levels/` on the owner's machine.

## 3. Owner rulings, in order

| # | Ruling | Answer |
|---|---|---|
| 1 | A fresh board on every ordinary run | Yes |
| 2 | GAME OVER: Enter = new board, G = same board | Withdrawn by the simplification |
| 3 | PAUSE RESTART keeps the board | Withdrawn: every run is random |
| 4 | Board code on PAUSE, WIN/LOSE, LEVEL SELECT | Withdrawn by the simplification |
| 5 | Two record tiers (ANY BOARD + THIS BOARD) | Withdrawn by the simplification |
| 6 | Bests | *"the time and score is base on the dificulity of game and the level not related to the shuffle board"*: bests stay keyed by difficulty + room, old records carry over |
| 7 | Layouts are biome identity; heat changes only bricks | Yes |
| 8 | Gen 2 + F2 codes; F1 codes and past dailies keep today's boards forever | Yes |
| 9 | Daily switches to gen 2 | Immediately on release |
| 10 | Art after geometry; PIXEL decor after the PIXEL dynamic import | Yes |
| 11 | ATTRACT and the intro show on new boards | No |
| 12 | Move the spawn off (1,1) | No; flips give the same effect |
| 13 | New tile types | Yes, in scope |
| S | Simplification | *"why we have to mention new board, just a random board"* |
| L | Base layouts | WATER, ARENA and CROWN get 2–3 each; the rest keep one |
| B | Bold layouts | *"should be bold, I think it gave more enjoy and more chalenging"* |
| F | Fair start for bold layouts | *"yes do it and ensure you document all this steps"* |

The simplification means the player sees no board code, no NEW/SAME BOARD
label and no new key. Every run (PLAY, LEVEL SELECT, ATTRACT → run, GAME OVER
restart, PAUSE RESTART) deals a random board. Losing a life keeps the current
board. DAILY and `?code=` links keep their fixed board.

## 4. The design

### 4.1 Seeds and versions

- Every run seeds from `mix(bootSeed, runIndex)`. This replaces the
  2026-09-07 `bootSeed`-per-session mechanism and keeps its intent: a run is
  the same whether or not a daily was played.
- `world.gen` defaults to 1. Gen 1 stays byte-identical for F1 codes, past
  dailies, ATTRACT, the intro show and every pinned test. A prototype with
  this field broke 0 of 59 test files.
- Gen 2 boards get **F2** codes. The B copy-link emits the prefix of the
  board played. DAILY uses gen 2 from release day; its record carries a `g`
  stamp, as pace does today.
- The ghost key (`nb.ghost.v1`) gains `gen`, or a gen-1 ghost replays through
  gen-2 walls. Times and bests keep their keys (ruling 6).
- **Bug to fix with this:** REAL 3D (`three/scene.js`) rebuilds walls only
  when the room number changes. A new board on the same room needs a rebuild
  on a grid change too.

### 4.2 Gen 2 layout grammar

Two stages: the **layout** comes from seed + room, then the **fill** from
seed + room + heat. Heat changes only bricks, so a room is the same place at
CORE, PLUS and MAX.

- The base is the pillar lattice. Walls only on the pillar grid
  (even, even), the lanes between two pillars, and the border. Never on an
  (odd, odd) intersection, so every + blast runs along a visible straight
  line.
- Seeded transforms: identity, H-flip, V-flip, 180°. No 90° turn (the board
  is 15×13).
- Four edits: **RUIN** (remove a pillar), **PLAZA** (a ruin plus a forced
  empty 3×3), **JOINH** and **JOINV** (fuse two pillars into a 3-long wall).
  Every edit is checked against the structural rules and undone if it fails.
- **Bold:** each layout's signature is reserved EMPTY floor, so the shape
  reads from the first second. Bold rooms hold about 17–20 fewer bricks than
  today's; JUNGLE, the teaching room, only about 6 fewer.
- East-west joins only where the biome's wall height is ≤ 22, because taller
  walls hide the row behind them in REAL 3D.

### 4.3 The 14 layouts

| Room | Biome | Layouts |
|---|---|---|
| 1 | JUNGLE | CLEARING: today's grid with overgrown gaps; the mildest room |
| 2 | ICE | LANES: long open lanes |
| 3 | FACTORY | CONVEYOR: corridors joined by open gates |
| 4 | WATER | ISLANDS · RIVER (2 tiles wide, with crossings) · ATOLL (reef ring around a lagoon) |
| 5 | ARENA (finale) | RING · PIT (four pits joined by gates) · GAUNTLET (open centre lane, side bays) |
| 6 | SAND | RUINS: a broken buried city |
| 7 | VOID | DRIFT: open sky, few pillars |
| 8 | CROWN (finale) | THRONE · COURT (open court with columns) · VAULT (throne alcove behind pillar doors) |

The finales mirror their brick fill too. CROWN only uses flips that keep the
throne opposite the spawn. VAULT uses north-south walls only, so its throne
room hides nothing from the REAL 3D camera.

### 4.4 The fairness check

A deterministic generate → check → re-roll loop with a bounded number of
tries, then a fall back to today's board. It must pass on every board:

- **V1:** every non-wall tile can be reached by bombing.
- **V2:** a safe first bomb. Within 4 steps of spawn there is a spot where a
  range-1 bomb hits a brick, with an escape that clears a range-8 blast in
  time at the slowest pace and the shortest fuse.
- **V3:** the free tiles hold the full foe roster plus floor items.
- **V4:** foes start far enough away by walking distance (values in section 6).
- **V5:** a brick band, and at least 3 bricks per buried item.
- **V6:** room 1 still guarantees FLAME and BOMB.
- **V7:** the board stays connected through the first 4 SHRINK rings.
- **V8:** at most 4 dead ends, none deeper than 3.
- **V9:** walls on the pillar grid only.
- **V10:** east-west joins only where wall height ≤ 22.
- **V11:** bounded re-rolls, then today's board.
- **V12:** finale mirroring; CROWN's throne opposite the spawn.
- **Sealed start:** no open path from the spawn pocket to the rest of the
  board; its exits are bricks the player bombs (section 6).

### 4.5 New tiles (ruling 13)

Tiles live on a separate per-tile layer, `world.feat`, not a new `T` value.
Collision, BFS, blasts, spawning and AI are unchanged; gen 1 gets `null`.

- **BELT (FACTORY), ship first:**
  - Pushes the player and moving foes along its arrows at 0.9 tiles/s × pace, through `moveEntity` with `e.dir` masked.
  - Bombs ride it on the kick slider, and a kick beats the belt.
  - Never under a SENTRY.
- **GLIDE (ICE):** player only. You can't stop on it and can turn only at tile centres.
- **CURRENT (WATER):** bombs float downstream; the player and foes wade at 0.75×.
- **Cost:**
  - REAL 3D: one InstancedMesh, 141 → 142 draws.
  - CLASSIC 2D: no extra draws with baked rail masks.
  - PIXEL: about 6.9 KB for all three tiles, so the PIXEL dynamic import (#15) comes first. The PIXEL tree has 771 B of headroom under the 122 KB cap.
- GLIDE in REAL 3D and CURRENT in PIXEL need a contrast step before they ship.

### 4.6 Wall art (Phase 3)

Seed-keyed pillar variants (plain, cracked, chipped, rare glyph), chosen by a
render-side hash of seed, level and tile, never `world.rng`.

- CLASSIC 2D: 0 extra calls.
- REAL 3D: per-instance colour in the one wall InstancedMesh, 0 extra draws.
- PIXEL: waits for #15.

Variants use wall palette slots only, with no ring or "+" shapes, no blast
colours, no continuous floor stripes and nothing animated.

## 5. Bold vs today: bot test

The demobot (tuned on today's boards, so the numbers are relative) played
300 seeds per cell through the real `step()`, before the fair-start fix:

- Wins cleared about twice as fast (FACTORY 76 s → 39 s); room 1 got slightly
  easier.
- From room 2 on the bot lost about twice as often (VOID at MAX: 65% → 94%).
- Hits in the first 5 s jumped: WATER 13 → 53 runs, VOID 17 → 69, CROWN at
  MAX 46 → 96. Foes started 7+ steps away, but on open floor they cover that
  in under 5 s. That is unfair, not challenging, so the owner approved the
  fair-start fix.

## 6. Fair start

Approved by the owner on 2026-10-20 and tuned in the mockup prototype.

**Rules:**

- **Sealed start.** Every non-wall tile next to the spawn pocket is a brick
  door: (5,1), (1,5), (3,3) and any ruined pillar there. The player bombs out.
  0 leaks in 24 000 boards; the safe first bomb (V2) still exists inside the
  pocket.
- **Foe distance (V4).** Measured as a walking route with bricks counted as
  passable, the real route once the doors open. Every foe starts at least
  **10** steps away, and hunters (FAST / CHASER / KNIGHT) at least **12**.
  Brick-passers (PHANTOM / SHADE / BURROW) follow the same rule. 10/12 is the
  smallest setting that keeps every room and heat at or below today's
  first-5-second hits; 8/10 and 9/11 left room 8 at MAX over.
- **Everything else holds:**
  - 0 fallbacks.
  - No roster cut.
  - The same layout counts.
  - Bricks within 0.3 of the bold numbers.
  - All check rules pass.

**Bot test** (16 cells: rooms 1–8 at CORE and MAX × 300 held-out seeds, the
real `step()`, a 120 s cap per run, so most runs time out rather than win):

| | Today | Bold | Bold + fair start |
|---|---|---|---|
| Runs hit in the first 5 s | 280 | 585 | **171** |
| Runs hit in the first 15 s | 1003 | 2531 | 2344 |
| Mean lose % | 33.8 | 57.0 | 52.3 |
| Mean win % | 4.5 | 5.2 | 5.2 |

- The first seconds are now fairer than today.
- Bold rooms stay harder once you bomb out of the corner onto open floor.
  The bot loses more in rooms 2–8, most in:

  | Room | CORE lose % | MAX lose % |
  |---|---|---|
  | VOID | 34 → 70 | 65 → 88 |
  | CROWN | 42 → 60 | 64 → 83 |
  | WATER | 19 → 42 | 43 → 74 |

- Wins clear faster (FACTORY 76 → 44 s), and room 1 plays about as hard as
  today.
- Raising foe distance further barely helps (12/14 only brings 15 s hits to
  2144).
- If the 5–15 s pressure feels cheap in real play, the next levers are fewer
  open lanes back toward the start corner, or one more brick ring outside the
  doors.
- Play-testing by a human decides; the bot is casual and was tuned on today's
  boards.

## 7. Tasks

| Issue | Task |
|---|---|
| #10 | A random board every run (no new UI); fix the REAL 3D wall rebuild |
| #11 | The fairness check (a test-only diagnostic first, then the gen-2 gate) |
| #12 | Gen-2 generator: the 14 bold layouts, seeded flips and edits |
| #13 | F2 codes, daily on gen 2 from release day, `gen` in the ghost key |
| #15 | PIXEL dynamic import (prerequisite for #16 and #17's PIXEL part) |
| #16 | New tiles: BELT first, then GLIDE and CURRENT |
| #17 | Wall art: seed-keyed pillar variants, later room dressing |

Closed by the simplification: #9 (board code on screen), #14 (record tiers).

**Picks still open:** the BELT look (A chevrons, the designer's pick, or B
rollers) and the tile ship order.
