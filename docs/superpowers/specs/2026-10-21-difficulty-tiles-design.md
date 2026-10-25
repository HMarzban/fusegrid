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

---

## Addendum (2026-10-21, evening): wave-1 prototype results

The four wave-1 tiles ran in a throwaway build: the bold gen-2 boards plus
every section 3 number, art approach C in CLASSIC 2D and REAL 3D (measured at
142 draws), and 64/64 tests passing. Gen 1 and the control rooms stayed
byte-identical (1800 of 1800 rows).

**Bot test:** 3000 paired seeds per cell, a tile-aware bot, Δ = with tiles
minus without, as a 95% interval.

| Tile | CORE Δ lose | MAX Δ lose | Notes |
|---|---|---|---|
| BLOOM | +0.3 pp | −1.0 pp | Barely fires (0.02 relay kills per run); traps 7 / 51 / 117 |
| GLIDE | +0.9 pp | +1.2 pp | Clean at CORE and PLUS; 22 traps at MAX |
| BELT | +0.8 pp | +0.9 pp | Clear times unresolved; first-5 s hits 63 → 100 at MAX |
| PLATE | −20.9 pp | −20.4 pp | Foes set plates off and kill themselves (1.8–2.3 per room) |

**Verdict: the dial does not work yet.**

- No tile reaches the +3 to +10 point MAX target.
- PLATE makes every heat about 20 points easier.
- The pooled MAX early-hit ceiling fails: 152 → 183 against 177, driven by
  foes riding belts toward the player. V17 did not close it.
- The tile-trap gate (= 0) fails for BLOOM, BELT at PLUS and MAX, PLATE, and
  GLIDE at MAX.
- The bot rarely clears a room, so run-level joy is unresolved, and most
  results rest on a weak bot.

**What the next design pass must fix before any build:**

- **PLATE:** arm only near the player, or make foes avoid plates. Arming near
  the player alone still leaves MAX 5.5 points easier.
- **BELT:** never point a chain's downstream end toward the start corner or
  the player's lane at MAX, and add a V17-style check for belt-ridden foes.
- **BLOOM:** placement must put blooms on real blast lanes, or it adds
  nothing.
- **Traps:** close V14 and V18–V20 as static checks.
- **The dial:** it needs a stronger MAX lever, such as more tiles or tighter
  numbers at MAX. Owner ruling R5 (tiles fixed across heats) limits the
  lever, so the owner may need to revisit it.
- **Play-test:** human play-testing decides joy.

**Deviations from section 3** in the prototype:

- straight belts only;
- GLIDE as rings around a pillar;
- V18–V20 not run as static checks;
- pickups can sit on plates (a V14 gap);
- no coach tip or FLOOR line.

Prototype notes, captures and the patch are in the git-ignored
`.superpowers/sdd/2026-10-21-tiles/proto/`, and the code is on the local branch
`worktree-agent-a9489bfefcc2ae31f`, never to be merged.

---

## Addendum (2026-10-21, late): owner rename

> Owner: *"the naming is not intiutive and most people can confiuse ha? let's
> use moste commone naming in there if it is possible."*

| Old (used above in this record) | New | Biome |
|---|---|---|
| BELT | **CONVEYOR** | FACTORY |
| GLIDE | **ICE PATCH** | ICE |
| BLOOM | **BOOSTER** | JUNGLE |
| CURRENT | **STREAM** | WATER |
| PLATE | **TRAP** | ARENA |
| DUNE | **QUICKSAND** | SAND |
| RIFT | **PORTAL** | VOID |
| GATE | GATE (unchanged) | CROWN |

- **Difficulty labels:** written `CORE (easy) / PLUS (normal) / MAX (hard)`
  on tile pages and issues.
- **"Tile-forced trap" is now a no-escape spot.** The fairness term was
  renamed so it never collides with the TRAP tile.
- **Rules unchanged:** the rules and numbers above are the same; only the
  names changed.
- **Where the new names are:** issues #16–#30 carry them.
- **Where the old names stay:** this record keeps its original text as a dated
  record, and older comments, images and prototype code keep the old names too.

---

## Addendum (2026-10-21, late): visual references

Three reference sheets, under `assets/2026-10-21/` beside this record:

- **`tiles-before-after.png`** (prototype): the four wave-1 tiles at MAX
  (hard), same seed and room. Each row shows the tile layer off, the tile
  layer on, and REAL 3D.
- **`tiles-storyboards-wave1.png`** (prototype, staged): CONVEYOR, ICE PATCH,
  BOOSTER and TRAP, with one 4-frame beat at CORE (easy) and one at MAX
  (hard). Every frame is the real sim stepped by scripted keys.
- **`tiles-storyboards-wave2-3.png`** (concept drawings): STREAM, QUICKSAND,
  PORTAL and GATE, with one beat at CORE (easy) and one at MAX (hard).

What the storyboards showed, for design pass 2 (#28):

- **CONVEYOR at MAX (hard).** The conveyor pushed MAKO off-centre, so a wall
  corner caught the step-off. MAKO rode on into its own blast and lost a
  life, while the conveyor carried the foe clear. A conveyor that carries the
  player needs a forgiving step-off (corner assist), or MAX reads as unfair
  rather than hard.
- **TRAP.** Its 2 s inert window had to be skipped to film the beat, and a
  walking foe had to be slowed to 0.01 tiles/s to ride the conveyor. Both are
  staging only, not rule changes.
- **Concept assumptions the spec does not settle yet** (#26, #27):
  - PORTAL's 3-tile exit guard counts Manhattan tiles.
  - A guarded foe waits on the entry portal.
  - A blast arm keeps its leftover reach after passing through a portal.

## Addendum (2026-10-23): art round 3, maturity pass

Owner: *"make the visual look better, more mature and add tinny details that
are matter in game and for gamers"*, then *"put more efferts for floor
tiles"*. An art-director review at true size (40 px, grayscale) drove the
changes; this is the art target for #23 and each tile issue:

- **Gameplay reads first.**
  - QUICKSAND: one dark diamond dimple with 1 / 2 / 3 spiral arms that
    converge (the parallel arcs read as STREAM).
  - STREAM: tapered flow ripples replace the caustic web (it read as a
    cracked tile); the CORE arrow is one value step up.
  - PORTAL: pair pips 1 / 2 / 3 (2.8 units, 2×2 px in PIXEL) in the
    top-left bracket.
  - GATE: each kerb side is one whole timer segment (gilt lit, dark slot
    unlit).
  - TRAP: CORE chevrons lifted (dL 18.3 → 24.4), reach ticks cross the rim.
- **Heat tells at a glance.** Heavier PLUS dashes on ICE PATCH; MAX on ICE
  PATCH wears frost teeth, never a hatch parallel to its streaks; TRAP PLUS
  ticks are notches across the dashed rim.
- **Causeless marks deleted:** the BOOSTER vein network, leaf flecks, ICE
  scratches and frost specks, the PIXEL checker dithers and flecks, the
  PORTAL core notch.
- **REAL 3D effects** in the one tile InstancedMesh (142 draws), on the
  PLAY-only clock (PAUSE freezes them), `wallHi` or black tints only,
  nothing flashes: relief lit from the top-left (all), a specular sweep (ICE
  PATCH), breathing leaves (BOOSTER CORE), a band value pulse (TRAP MAX), bed
  scroll + soft shimmer (STREAM), an inward dark drift (QUICKSAND), a core
  breathe capped at `wallHi` with pips counting up (PORTAL), lit kerb strokes
  (GATE).
- **Gates:** coverage ≤ 30% every tile and heat, CORE dL ≥ 20, QUICKSAND bed
  vs `brickB` 17.6–18.8, no new hex, VOID marks capped at `wallHi` (PIXEL
  MAX had broken the dim rule), all 24 PIXEL cells pass `validateCell`,
  `featpx.js` 16,260 → 13,110 B.
- **Open:** the 1.2-unit minimum mark is 1.92 atlas texels (widening pushes
  three tiles past 30%); PIXEL heats share a mark value on VOID, CROWN and
  SAND (edge, count and tip still separate them).

Reference sheets under `assets/2026-10-23/`: `tiles-round3-2d-a.png` /
`-2d-b.png` and `tiles-round3-px-a.png` / `-px-b.png` (runs at CORE, PLUS,
MAX with a grayscale copy), `tiles-round3-3d.png` (all 8 tiles × 3 heats in
REAL 3D), and six-frame strips `tiles-round3-3d-anim-{portal,quicksand,icepatch}.png`.
Throwaway branch: `worktree-agent-a3057d0a51e6a8d96` (local, locked).

## Addendum (2026-10-25): direction D

Owner ruling: "Go with D, the A+B mix." The round-3 emblem-in-a-frame look
(art approach C, section 5 above, and the round-3 addendum) is superseded by
hardware sunk into the floor for ICE PATCH, CONVEYOR, TRAP, PORTAL and GATE
and the ground itself changed for BOOSTER, STREAM and QUICKSAND. Sim rules,
dials and fairness checks are unchanged. The look, the per-tile picks and the
rules that still bind are in
[2026-10-25-floor-tiles-direction-d-design.md](2026-10-25-floor-tiles-direction-d-design.md);
the build plan is
[../plans/2026-10-25-floor-tiles-direction-d.md](../plans/2026-10-25-floor-tiles-direction-d.md).
