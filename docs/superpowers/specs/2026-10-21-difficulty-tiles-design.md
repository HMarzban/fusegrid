# Difficulty tiles: eight floor tiles that are fun on easy and tough on hard

**Date:** 2026-10-21 · **Status:** designed, first wave in prototype, **not
built** · **Issue:** HMarzban/fusegrid#16 (sub-tasks listed in section 9) ·
**Builds on:** [level variety](2026-10-20-level-variety-design.md)

> Owner: *"diffrent custom tile is needed … the challange must be base on the
> dificullity of the game, it mean in the easy state, the tile give more joy
> and in the hard and dificult give more challenge."*

Each biome gets one floor tile. The tile keeps one rule at every difficulty,
and **Heat** turns its numbers. On CORE it helps you, on PLUS it is a mix,
and on MAX it pushes you, always visibly and always with a way out. Nothing
here is in the game yet.

---

## 1. How the round ran

1. **Shared brief** with the hard constraints: a deterministic `world.feat`
   layer (gen 1 gets none), no AI retune, the fair start, readability in all
   three looks, the draw and PIXEL budgets, and the banned name.
2. **Three designers in parallel:**
   - **Game designer:** a tile catalogue with per-heat dials.
   - **Balance designer:** the dial model, fairness rules, the checks and the
     measurement plan, with genre research.
   - **Art designer:** one visual language, how heat is signalled, per-look
     cost and a concept sheet.
3. **Critic pass:** merged two catalogues into one, ruled on six conflicts and
   picked the first wave.
4. **Prototype round** (in progress): the first wave on the bold gen-2 boards
   in a throwaway worktree, real-renderer captures and a tile-aware bot test.

Working notes, the concept sheet and the prototype live in the git-ignored
`.superpowers/sdd/2026-10-21-tiles/` on the owner's machine.

## 2. Rulings

| # | Question | Ruling |
|---|---|---|
| R1 | Two catalogues | The game designer's eight rules, wearing the art designer's skins. VINES, PAD, CRUMBLE, PORTAL and VENT become skins or are parked. MIRROR and the steam jet are retired. |
| R2 | Damage | **A tile never starts damage on its own.** It may relay a blast that reached it (BLOOM) or answer a foe's step (PLATE). It never fires on your own step or on a clock. Any blast it makes is the real blast, credited to you. |
| R3 | BELT | CORE carries bombs only. One speed per heat for everything that rides. The MAX reversal is cut. |
| R4 | Heat or pace | **Heat turns the dial; pace only scales tile speeds** (owner question Q1). |
| R5 | Placement | Tiles are fixed per seed and room, so heat changes behaviour only. The level-variety ruling 7 holds. |
| R6 | Teaching | A one-time coach tip per tile is required, plus a FLOOR line on the LEVEL SELECT room card. A GUIDE page waits for wave 2. Tip copy comes from one `TILE[].help` table. |
| R7 | First wave | BELT → GLIDE → BLOOM → PLATE (rooms 3, 2, 1, 5). Shared helpers: `featCarry` (push and carry) and `featBlast` (relay and plate blasts). |

The owner may veto any ruling; the open questions are in section 8.

## 3. The eight tiles

Numbers are CORE / PLUS / MAX. Speeds are in tiles per second and scale with
pace like all movement.

| Tile | Biome | Verb | CORE (joy) | PLUS | MAX (challenge) |
|---|---|---|---|---|---|
| **BLOOM** | JUNGLE | aim through | relays a blast +2 forward, at once | +2 forward, 1 to each side, 0.15 s later | +2 forward, 2 to each side, 0.30 s flare |
| **GLIDE** | ICE | commit | ×1.25 speed; you stop when you let go | coast to the next tile centre | coast to the edge (≤ 3 tiles); tighter turn window |
| **BELT** | FACTORY | ride and deliver | bombs ride at 1.0 | bombs, you and foes at 1.0 | everything at 1.2 |
| **CURRENT** | WATER | float | bombs float at 0.8; no wading | float 1.0; wade ×0.85 | float 1.2; wade ×0.75 |
| **PLATE** | ARENA | lure | a foe sets it off: wind-up 0.5 s, reach 1 | 0.8 s, reach 2 | 1.0 s, reach 3 |
| **DUNE** | SAND | re-route | a cleared tile regrows a brick after 30 s, once | after 18 s, up to 3 times | after 10 s, no limit |
| **RIFT** | VOID | jump | paired warps for you and moving bombs | blasts pass through too | foes warp too (never out within 3 tiles of you) |
| **GATE** | CROWN | time it | shuts 3 s behind you; foes never trigger it | room clock: 6 s open, 3 s shut | 4 s open, 4 s shut |

More detail:

- **BLOOM** has a 1 s cooldown.
- **GLIDE** is player only. Turn windows are 0.35, 0.20 and 0.10 tiles.
- **PLATE** cooldowns are 3, 4 and 3 s. It stays inert for 2 s after the room
  starts.
- **DUNE** regrowth takes a visible 1.5 s, and stepping on the tile cancels it.
- **GATE** gives a 0.5, 1.0 and 0.75 s warning while it lowers and is still
  passable. It never crushes and never seals you in.

Speed limits:

- A belt moves at most 0.6× the slowest moving foe in that room, so foes keep
  at least 40% of their speed walking against it.
- You keep at least 50% of yours, 65% at MAX.
- Tile speeds never drop as heat rises, so harder never looks slower.

## 4. Fairness

- **Never unfair:** no damage from the tile itself, no hidden timers, no
  frame-perfect inputs. Every MAX behaviour is telegraphed and has
  counterplay. Bombs carried by a tile never reach the start corner.
- **Fair start still holds:** brick-door spawn pocket; foes at least 10
  walking steps away, hunters at least 12, now measured in *time* with tile
  speeds counted (V17).
- **Checks V13–V27** extend the level-variety checks V1–V12. They are pure
  functions over `(grid, feat, roster, heatProfile, pace)`, and behaviour
  checks run per heat.
  - **V13:** layer sanity. Gen 1 has no layer; one tile type per room,
    matching the biome.
  - **V14:** exclusion. No tile within 4 steps of spawn, on a door or on a foe
    spawn tile; no SENTRY on a belt.
  - **V15:** belt chains are open, 4–9 tiles long, with a step-off.
  - **V16:** belt speed stays under the foe speed bound.
  - **V17:** time-weighted foe distance.
  - **V18:** the safe first bomb, checked per heat with tile costs. A bomb on a
    plate's arms counts with fuse = the plate's wind-up.
  - **V19:** the tile adds no trap that was not already there.
  - **V20:** tiles survive SHRINK rings.
  - **V21:** the layer is the same at every heat.
  - **V22:** determinism.
  - **V23:** if tile placement fails, keep the layout and drop the tiles.
  - **V24:** GLIDE runs are at most 3 in a row.
  - **V25:** 2–4 BLOOMs, spaced.
  - **V26:** 3–5 PLATEs, spaced.
  - **V27:** every plate line has a side exit within 1 tile.
- **Known tight spot:** PLATE at MAX is fair only by stepping off the line:
  0.62 s to clear against a 1.0 s wind-up. The straight-run margin is 0.09
  tiles, which the design counts as zero, hence V27.

## 5. Look (art approach C)

A tile is a **flush floor inlay**:

- The checker pattern drops out under it, it carries thin marks in the
  biome's own mark colour, and its outer edge has a keyline.
- Never raised (a wall), never round (a pickup or bomb), never a bright full
  fill (a blast), never a "+".
- Marks cover at most 30% of the tile.

**Heat is shown by edge, mark count, brightness and tip shape, never by
colour:**

| Heat | Edge | Marks | Tips |
|---|---|---|---|
| CORE | soft keyline | 1 per tile, dimmer | round |
| PLUS | dashed | 2 | square |
| MAX | 5 px hazard band on the danger edge (hatch in built biomes, teeth in natural ones) | 3, full brightness | sharp |

All of it reads in a PAUSE still. A colour swap (teal to amber) was rejected:

- Amber collides with the blast under colourblind simulation (ΔE 7.2–13.5).
- `#ffb347` is the THROW pickup's colour.
- Teal is MAKO's fin colour.

A heat badge was rejected too: its PLUS mark would be a "+".

**Cost:**

| Look | Cost |
|---|---|
| CLASSIC 2D | A baked canvas replaces the floor draw, so 0 extra draws. The `97480c1c:22630` hash stays pinned because gen 1 has no layer; add a gen-2 pin. |
| REAL 3D | One InstancedMesh with a 512² atlas: 141 → 142 draws (143 with a ghost). GATE's shut bars would add one more. |
| PIXEL | About 19 cells for all eight. Over the 771 B headroom, so it waits for the dynamic import (#15). Gen 2 should not become the default before #15. |

## 6. Measuring "joy on easy, challenge on hard"

- **Four bot arms** on the bold boards:
  - no tiles;
  - the heat dial;
  - CORE tile settings at every heat;
  - MAX tile settings at every heat.

  Comparing the last two isolates the dial from heat.
- **Bots:** the stock demobot can't see tiles, so a tile-aware fork judges
  pass/fail. The fork must match the stock bot exactly on boards with no
  tiles.
- **Statistics:** paired 95% confidence intervals, with seed counts sized from
  a 200-seed pilot. Anything unresolved is reported as unresolved.
- **Targets:**
  - CORE clears at least 10% faster with lose % no worse.
  - MAX lose % rises 3–10 points.
  - At every heat, first-5 s hits stay at or below the no-tile count, and
    tile-forced traps stay at 0.
- A human playtest decides.

## 7. Waves

| Wave | Tiles | Blockers |
|---|---|---|
| 1 | BELT, GLIDE, BLOOM, PLATE | Prototype in progress |
| 2 | CURRENT, DUNE, GATE, plus the GUIDE page | GATE needs REAL 3D to redraw walls that appear mid-room. That is the same bug as SHRINK walls in REAL 3D, and its fix was started on 2026-10-21. |
| 3 | RIFT | The highest cost: warp continuation and V17 rift edges |

## 8. Owner questions

| # | Question | Recommendation |
|---|---|---|
| Q1 | Should Heat or Pace turn the dial? | **Heat.** Under pace, the daily (pinned to NORM) would play the PLUS column, and EASY + MAX would lose the tile challenge. Swapping is one line. |
| Q2 | May a tile relay your blast (BLOOM), and may a foe set off a plate (PLATE)? | **Yes.** |
| Q3 | Wave 1 puts BLOOM in room 1, which every run meets. | **Yes.** |
| Q4 | DUNE's CORE joy is thin. | Accept it for now and revisit in wave 2. |
| Q5 | A coach tip per tile plus a FLOOR line on the room card. | **Yes.** |

## 9. Tasks

Umbrella #16 (under #8). Its sub-tasks:

| Issue | Task |
|---|---|
| #18 | Shared plumbing: `world.feat`, the per-heat tile profile, `featCarry` / `featBlast`, placement, checks V13–V23 |
| #19 | Wave 1: BELT |
| #20 | Wave 1: GLIDE |
| #21 | Wave 1: BLOOM |
| #22 | Wave 1: PLATE |
| #23 | Art system (approach C), CLASSIC 2D + REAL 3D, PIXEL after #15 |
| #24 | Teaching: one-time coach tip per tile + FLOOR line |
| #25 | Balance test: tile-aware bot, four arms, targets |
| #26 | Wave 2: CURRENT, DUNE, GATE |
| #27 | Wave 3: RIFT |
