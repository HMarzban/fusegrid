# Level variety: the 14 bold layout templates (appendix)

**Date:** 2026-10-21 · **Status:** owner-approved layouts, **not built** ·
**Issue:** HMarzban/fusegrid#12 (gen-2 generator), under #8 ·
**Appendix to:** [level variety](2026-10-20-level-variety-design.md) §4.2–§4.4 and §6

This appendix makes the approved layouts rebuildable from the repo. The grids
and rules below are transcribed from the throwaway prototype
`src/core/board2.js`, which was never merged (local branch
`worktree-agent-ac4f113e8ef46ecff`, commit `f8a21cf`, "fair start"). They are
the boards the owner approved in the contact sheets below. A builder
reimplements them from this page; the prototype code is not in the repo.

Reference captures (MOCKUP tagged, CLASSIC 2D, CORE, fair start applied):

- [Rooms 1–4](assets/2026-10-21/bold-sheet-rooms1-4.png):
  JUNGLE CLEARING · ICE LANES · FACTORY CONVEYOR · WATER ISLANDS / RIVER / ATOLL.
- [Rooms 5–8](assets/2026-10-21/bold-sheet-rooms5-8.png):
  ARENA RING / PIT / GAUNTLET · SAND RUINS · VOID DRIFT · CROWN THRONE / COURT / VAULT.
- [Fair start, before and after](assets/2026-10-21/fairstart-before-after.png):
  WATER · RIVER, room 4, seed 2193589889.

A capture is one seed of a layout: bricks, flips and seeded edits vary per
seed. The template is the contract, not the picture.

---

## 1. Board and coordinates

- 15 × 13 tiles (`CFG.COLS` × `CFG.ROWS`), x 0–14 left to right, y 0–12 top
  to bottom, `key(x, y) = y * 15 + x`.
- The spawn is (1,1), top-left, in every layout (owner ruling 12).
- Slot classes:
  - **pillar**: (even, even);
  - **lane slot**: (odd, even) is an east-west join between two pillars;
    (even, odd) is a north-south join;
  - **intersection**: (odd, odd), never a wall (V9).

## 2. Template legend

| Char | Meaning |
|---|---|
| `#` | WALL (border, pillar or authored join) |
| `x` | a pillar that may be **ruined** (becomes fill) with p = 0.25, or 0.35 in rooms 6–8; drawn once per mirror orbit |
| `o` | a lane slot that may **join** (becomes a wall) with p = 0.35. Defined in the prototype but **unused** by every template |
| `.` | **reserved floor**: always EMPTY. This is the "bold" signature, so the shape reads from the first second |
| `b` | reserved BRICK (reef bricks, vault door) |
| `?` | fill: brick or empty, chosen by the fill stage |
| `s` | sparse fill: like `?`, but 2.2× as likely to be carved open |

Template symmetry (`sym`) is the **mirror orbit** used to keep a
template's random choices symmetric: `h` mirrors left-right, `hv` both ways,
`none` no mirror. A random `x` choice and every seeded edit apply to the whole
orbit. The finales (ARENA, CROWN) also carve their fill on those orbits (V12).
`sym` is not the board transform (§3.2).

## 3. Edit grammar

Stage 1, the **layout** (skeleton), is keyed `(seed, room, attempt)` only.
Heat never reaches it, so a room is the same place at CORE, PLUS and MAX
(ruling 7). Stage 2, the **fill**, is keyed `(seed, room, heat, attempt)` and
changes bricks only.

### 3.1 Stage 1: layout

1. Pick a template: one of the biome's 1 or 3 templates, uniformly.
2. Resolve `x` (and `o`) per mirror orbit.
3. Apply the biome's **stamps** (seeded edits). Each kind is applied `n`
   times, with `n` uniform in `[lo, hi]`:

   | Biome | Stamps `[kind, lo, hi]` |
   |---|---|
   | JUNGLE | RUIN 0–2, PLAZA 0–1 |
   | ICE | JOINV 1–3, RUIN 0–2 |
   | FACTORY | JOINH 1–3, RUIN 0–1 |
   | WATER | RUIN 1–3, JOINV 0–2, PLAZA 0–1 |
   | ARENA | JOINV 0–2, RUIN 0–2 |
   | SAND | RUIN 1–3, JOINH 0–1 |
   | VOID | RUIN 1–3 |
   | CROWN | JOINV 0–2, RUIN 0–2 |

   - **RUIN** removes a pillar (an even/even WALL becomes fill).
   - **PLAZA** is a ruin plus a forced EMPTY 3×3 around it.
   - **JOINH** turns an (odd, even) lane slot into WALL, fusing two pillars into a 3-long east-west wall.
   - **JOINV** does the same on an (even, odd) slot, north-south.
   - A target is drawn in x 2–12, y 2–10, up to 20 tries. It must not land, after the board transform, in the spawn quadrant x ≤ 4, y ≤ 4.
   - **Guard:** an edit is skipped when it touches an authored feature. A JOIN on a `.` or `b` tile is skipped. A RUIN next to a `b` or an authored join is skipped. A PLAZA whose 3×3 contains a `.`, a `b` or an authored join is skipped.
   - Every applied edit is checked against the structural rules (V1, V7, V8, V9) with the spawn pocket open, and undone if any fails.
   - JOINH is stamped only in FACTORY (hWall 16) and SAND (14), so seeded edits never break V10.
4. **Board transform** (`flip`): identity, H-flip, V-flip or 180°, uniform.
   **CROWN** draws only V-flip or 180°, so the throne end always sits
   opposite the spawn (V12). There is no 90° turn (the board is not square).
   - The 2026-10-20 mockup notes say "non-finale templates mirror left-right
     only". That sentence is about the template symmetry `sym`, not the
     transform: the code flips all four ways.
5. **Fair-start stamps**, applied after the transform, in final coordinates:
   §4.

### 3.2 Stage 2: fill (exact brick budget)

- **Target** = the brick count of the gen-1 board for the same
  `(seed, room, heat)` (`genBoard(seed, room, carve)` with carve
  0.32 / 0.28 / 0.24), **minus `CUT`**: JUNGLE 6 (the teaching room stays
  mild), every other biome 17.
  - Gen 2 therefore reads `genBoard`. The gen-1 generator is frozen for gen 2
    as well as for F1 codes.
- Fixed bricks (`b`, pocket doors and the seal) count toward the target. The
  remaining fill cells (`?`, `s`) are carved open until the target holds.
- **Carve order:**
  - 1–3 random "blobs" (centre in x 2–12, y 2–10, radius 1.5–4.0) weight a
    cell by `0.35 + Σ exp(−d²/r²)`;
  - `s` cells weigh 2.2×;
  - each cell (each mirror orbit on a finale) draws an exponential key
    `−ln(1−u)/w`;
  - cells are carved in ascending key order.
- **Measured** (1000 seeds): CORE bricks about 53–55 per room (JUNGLE 65.6)
  against 71–72 today. COURT runs about −20 to −24 and PIT at MAX −22.

### 3.3 Re-roll and fallback

- Up to 8 layout attempts. The **first** layout that passes the structural
  rules gets up to 8 fill attempts. If no fill passes, the loop stops (it is
  not a full 8 × 8).
- **Fallback** (HoE ruling H11, 2026-10-21): the gen-1 `genBoard` grid **with
  the §4 seal and the §5 foe placement applied**, never the raw gen-1 board,
  which fails the fair start by design. The prototype measured 0 fallbacks
  in 24 000 boards. A test forces one fallback; the CI sample gates
  fallbacks = 0.
- Play rules checked on each fill (§4.4 of the design record): an escape
  ≤ 4 steps from a bomb on (1,1) at every reach 1–10, PIERCE and LINE in
  each direction (V2); the roster plus floor items fit (V3); the brick band
  40–90 with ≥ 3 bricks per buried item (V5).

## 4. The fair-start pocket

Applied after the transform:

- **Pocket** (always EMPTY), 9 tiles:
  (1,1) (2,1) (3,1) (4,1) (1,2) (3,2) (1,3) (2,3) (1,4).
  (2,2) is a pillar.
- **Doors:** (5,1) and (1,5) are BRICK.
- **Seal:** every non-wall 4-neighbour of a pocket tile that is not in the
  pocket becomes BRICK. In practice that is (5,1), (1,5), (3,3), plus any
  ruined pillar next to the pocket. There is no EMPTY path out; the player
  bombs a door.
  - Measured: 0 leaks in 24 000 boards. The safe first bomb holds inside the
    pocket: a bomb on (1,1) at any reach or kind leaves (3,2) and (2,3) safe,
    3 steps away.
- **The other three corners:** each corner tile (13,1), (1,11) and (13,11),
  plus its interior non-pillar 4-neighbours, is forced EMPTY (unless WALL). Gen 2
  keeps all four corner pockets open (gen 1 deletes pillars (2,10) and
  (12,10) by accident; gen 2 does not copy that).

## 5. The foe pocket (gen-2 foe placement)

Owned by #12 (HoE ruling H10). Gen 1 keeps `SPAWN_CLEAR` byte-identical.

- Distance is the walking route from (1,1) with **BRICK counted as passable
  and WALL blocking**: the real route once the doors open.
- Every foe starts **≥ 10** steps away. `e.hunt` foes (FAST, CHASER, KNIGHT)
  start **≥ 12** steps away.
- A tile with no such route counts as far enough.
- Brick-passers in the code are PHANTOM (`boomerang`), ROCKET (`rocket`) and
  SHADE (`shade`). BURROW is not one. They need no extra rule, because the
  measure already walks through bricks.
- `loadLevel` (`src/core/world.js`) builds the free list exactly as today,
  **keeping** the straight-line `SPAWN_CLEAR` filter, and shuffles it with
  `world.rng`. Then, for each roster entry in order, it takes the first
  unused free tile that passes the walking rule. The picks go first and the
  unused tiles follow, so floor items take the rest. Both filters together
  are what the prototype measured.
- V3 (room fit) counts the free tiles that pass the hunter rule. The
  prototype cut 0 rosters short.
- 10 / 12 is the smallest setting that keeps every room × heat at or below
  today's first-5-second hits (8/10 and 9/11 left room 8 at MAX over).

## 6. V10 and the tall biomes

**V10 (one wording, HoE ruling H3, 2026-10-21):** an interior WALL on an
east-west lane slot (odd x, even y), whether authored or made by a JOINH
edit, must be ≤ `NEAR_H` 22 tall in REAL 3D.

- JUNGLE (22), FACTORY (16), ARENA (20) and SAND (14) meet this at full
  height.
- In ICE (36), WATER (28), VOID (32) and CROWN (24), such a wall is allowed
  only if REAL 3D caps that instance at `min(hWall, NEAR_H)` by per-instance
  Y-scale (0 draws, the near-row cutaway mechanism) **and** the occlusion
  probe in `tests/three.test.mjs` passes.

Measured from the templates below:
- ICE, WATER and VOID have no E-W lane wall.
- CROWN THRONE has 5 and COURT has 1 (listed above each grid); both are capped.
- VAULT is N-S only.
- FACTORY CONVEYOR (10) and ARENA RING / PIT (1 / 2) are legal at full
  height.

## 7. The 14 templates

The grids are exactly the prototype's strings. The x and y rulers are
added. "Interior E-W lane walls" lists the template's own (odd, even) walls
before any transform.

#### JUNGLE · CLEARING (room 1)

Template symmetry: `h` (left-right mirror orbit). Interior E-W lane walls (odd x, even y): none.

```
  x  012345678901234
y  0 ###############
y  1 #?????????????#
y  2 #?#?#?#?#?#?#?#
y  3 #?????????????#
y  4 #?#?#?x?x?#?#?#
y  5 #????.....????#
y  6 #?#?#.#.#.#?#?#
y  7 #????.....????#
y  8 #?#?#?x?x?#?#?#
y  9 #?????????????#
y 10 #?#?#?#?#?#?#?#
y 11 #?????????????#
y 12 ###############
```

#### ICE · LANES (room 2)

Template symmetry: `h` (left-right mirror orbit). Interior E-W lane walls (odd x, even y): none.

```
  x  012345678901234
y  0 ###############
y  1 #?????????????#
y  2 #?#?#?#?#?#?#?#
y  3 #?????#?#?????#
y  4 #?#?#?#?#?#?#?#
y  5 #.............#
y  6 #?#?#.....#?#?#
y  7 #.............#
y  8 #?#?#?#?#?#?#?#
y  9 #?????#?#?????#
y 10 #?#?#?#?#?#?#?#
y 11 #?????????????#
y 12 ###############
```

#### FACTORY · CONVEYOR (room 3)

Template symmetry: `h` (left-right mirror orbit). Interior E-W lane walls (odd x, even y): (5,4) (7,4) (9,4) (1,6) (3,6) (11,6) (13,6) (5,8) (7,8) (9,8).

```
  x  012345678901234
y  0 ###############
y  1 #???#?????#???#
y  2 #?#?#?#?#?#?#?#
y  3 #?????????????#
y  4 #?#.#######.#?#
y  5 #ss.........ss#
y  6 #####.#?#.#####
y  7 #ss.........ss#
y  8 #?#.#######.#?#
y  9 #?????????????#
y 10 #?#?#?#?#?#?#?#
y 11 #???#?????#???#
y 12 ###############
```

#### WATER · ISLANDS (room 4)

Template symmetry: `h` (left-right mirror orbit). Interior E-W lane walls (odd x, even y): none.

```
  x  012345678901234
y  0 ###############
y  1 #??????.??????#
y  2 #?#?#?#.#?#?#?#
y  3 #??????.??????#
y  4 #?#?#?#.#?#?#?#
y  5 #.............#
y  6 #?#?#?#.#?#?#?#
y  7 #.............#
y  8 #?#?#?#.#?#?#?#
y  9 #??????.??????#
y 10 #?#?#?#.#?#?#?#
y 11 #??????.??????#
y 12 ###############
```

#### WATER · RIVER (room 4)

Template symmetry: `none`. Interior E-W lane walls (odd x, even y): none.

```
  x  012345678901234
y  0 ###############
y  1 #?????????..??#
y  2 #?#?#?#?#?..#?#
y  3 #??????.....#?#
y  4 #?#?#?#.....#?#
y  5 #?????#..?????#
y  6 #?#?#?#..?#?#?#
y  7 #??......?????#
y  8 #?#......?#?#?#
y  9 #?#..?????????#
y 10 #?#..?#?#?#?#?#
y 11 #??..?????????#
y 12 ###############
```

#### WATER · ATOLL (room 4)

Template symmetry: `h` (left-right mirror orbit). Interior E-W lane walls (odd x, even y): none.

```
  x  012345678901234
y  0 ###############
y  1 #?????????????#
y  2 #?#?#b#b#b#?#?#
y  3 #???#.....#???#
y  4 #?#?#.#.#.#?#?#
y  5 #???b.....b???#
y  6 #?#?#.....#?#?#
y  7 #???b.....b???#
y  8 #?#?#.#.#.#?#?#
y  9 #???#.....#???#
y 10 #?#?#b#b#b#?#?#
y 11 #?????????????#
y 12 ###############
```

#### ARENA · RING (room 5)

Template symmetry: `hv` (both mirrors). Interior E-W lane walls (odd x, even y): (7,6).

```
  x  012345678901234
y  0 ###############
y  1 #?????????????#
y  2 #?#?#?#?#?#?#?#
y  3 #??sssssssss??#
y  4 #?#s.......s#?#
y  5 #??s.......s??#
y  6 #?#s...x...s#?#
y  7 #??s.......s??#
y  8 #?#s.......s#?#
y  9 #??sssssssss??#
y 10 #?#?#?#?#?#?#?#
y 11 #?????????????#
y 12 ###############
```

#### ARENA · PIT (room 5)

Template symmetry: `h` (left-right mirror orbit). Interior E-W lane walls (odd x, even y): (3,6) (11,6).

```
  x  012345678901234
y  0 ###############
y  1 #?????????????#
y  2 #?#?#?#?#?#?#?#
y  3 #??...#?#...??#
y  4 #?#...#?#...#?#
y  5 #??...???...??#
y  6 #?###?#.#?###?#
y  7 #??...???...??#
y  8 #?#...#?#...#?#
y  9 #??...#?#...??#
y 10 #?#?#?#?#?#?#?#
y 11 #?????????????#
y 12 ###############
```

#### ARENA · GAUNTLET (room 5)

Template symmetry: `h` (left-right mirror orbit). Interior E-W lane walls (odd x, even y): none.

```
  x  012345678901234
y  0 ###############
y  1 #?????????????#
y  2 #?#?#?#?#?#?#?#
y  3 #?#?#?#?#?#?#?#
y  4 #?#?#?#?#?#?#?#
y  5 #??.........??#
y  6 #?#.........#?#
y  7 #??.........??#
y  8 #?#?#?#?#?#?#?#
y  9 #?#?#?#?#?#?#?#
y 10 #?#?#?#?#?#?#?#
y 11 #?????????????#
y 12 ###############
```

#### SAND · RUINS (room 6)

Template symmetry: `none`. Interior E-W lane walls (odd x, even y): none.

```
  x  012345678901234
y  0 ###############
y  1 #?????ss??????#
y  2 #?#?#?x?#?x?#?#
y  3 #????s?...????#
y  4 #?x?#?#...#?#?#
y  5 #??s???...?s??#
y  6 #?#?x?#?#?x?#?#
y  7 #??...??s...?s#
y  8 #?#...x?#...x?#
y  9 #??...???...??#
y 10 #?x?#?#?x?#?#?#
y 11 #??????s??????#
y 12 ###############
```

#### VOID · DRIFT (room 7)

Template symmetry: `h` (left-right mirror orbit). Interior E-W lane walls (odd x, even y): none.

```
  x  012345678901234
y  0 ###############
y  1 #?????????????#
y  2 #?#?x?x?x?x?#?#
y  3 #?ssssssssss??#
y  4 #?x?#?x?#?x?x?#
y  5 #?...........?#
y  6 #?x.........x?#
y  7 #?...........?#
y  8 #?x?#?x?#?x?x?#
y  9 #?ssssssssss??#
y 10 #?#?x?x?x?x?#?#
y 11 #?????????????#
y 12 ###############
```

#### CROWN · THRONE (room 8)

Template symmetry: `h` (left-right mirror orbit). Interior E-W lane walls (odd x, even y): (7,2) (5,4) (9,4) (5,8) (9,8). These five are capped at `NEAR_H` 22 in REAL 3D (V10, §6).

```
  x  012345678901234
y  0 ###############
y  1 #?????...?????#
y  2 #?#?#?###?#?#?#
y  3 #?????...?????#
y  4 #?#?###.###?#?#
y  5 #?????...?????#
y  6 #?#?#?#.#?#?#?#
y  7 #?????...?????#
y  8 #?#?###.###?#?#
y  9 #?????...?????#
y 10 #?#?#?#.#?#?#?#
y 11 #?????...?????#
y 12 ###############
```

#### CROWN · COURT (room 8)

Template symmetry: `h` (left-right mirror orbit). Interior E-W lane walls (odd x, even y): (7,2). Capped at `NEAR_H` 22 in REAL 3D (V10, §6).

```
  x  012345678901234
y  0 ###############
y  1 #?????s.s?????#
y  2 #?#?#?###?#?#?#
y  3 #??.........??#
y  4 #?#.#.#.#.#.#?#
y  5 #??.........??#
y  6 #?#.#.#.#.#.#?#
y  7 #??.........??#
y  8 #?#?#?#.#?#?#?#
y  9 #?????s.s?????#
y 10 #?#?#?#.#?#?#?#
y 11 #?????s.s?????#
y 12 ###############
```

#### CROWN · VAULT (room 8)

Template symmetry: `h` (left-right mirror orbit). Interior E-W lane walls (odd x, even y): none.

```
  x  012345678901234
y  0 ###############
y  1 #???#.#.#.#???#
y  2 #?#?#.#.#.#?#?#
y  3 #???#.....#???#
y  4 #?#?#.#b#.#?#?#
y  5 #?????...?????#
y  6 #?#?#?#.#?#?#?#
y  7 #?????...?????#
y  8 #?#?#?#.#?#?#?#
y  9 #?????...?????#
y 10 #?#?#?#.#?#?#?#
y 11 #?????...?????#
y 12 ###############
```

## 8. What the build pins

- **Golden hashes:** a gen-2 grid hash per layout for one fixed seed each
  (the seed that first deals it). Gen 1 stays byte-identical, so no existing
  pin moves.
- **Structural sweep (CI sample, 200 seeds × 8 rooms × 3 heats):**
  - 0 walls on (odd, odd);
  - 0 heat-dependent walls;
  - 0 fallbacks;
  - 0 rosters cut;
  - 0 pocket leaks;
  - every foe ≥ 10 steps and hunters ≥ 12.
- **Variety gate (full 1000-seed sweep, offline `tools/` script):** distinct
  wall layouts per 1000 seeds at or above the per-room floor (HoE ruling H4):

  | Room | Floor | Measured |
  |---|---|---|
  | 1 | 200 | 211 |
  | 2 | 60 | 68 |
  | 3 | 60 | 70 |
  | 4 | 500 | 555 |
  | 5 | 80 | 85 |
  | 6 | 900 | 999 |
  | 7 | 900 | 949 |
  | 8 | 250 | 287 |

  ARENA GAUNTLET deals only 7 wall variants; that is disclosed and accepted.
- **Occlusion probe** for the capped CROWN walls (§6).
