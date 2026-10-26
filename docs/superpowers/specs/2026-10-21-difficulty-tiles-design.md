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

Status (2026-10-25): all eight tiles are built in the three looks on the local
branch `tiles-d`, merged into the owner's local `main` the same day (not
pushed); the GUIDE FLOOR page lists them. STREAM, QUICKSAND, PORTAL and GATE appear on gen-2 rooms
4 / 6 / 7 / 8 as **art-only** placements (codes 8..14, no sim effect) so every
world shows its look; their rules wait for #19 to #22 and the dial for #28.

---

## Addendum (2026-10-26): design pass 2, the dial works (issue #28)

The wave-1 dial did not work in the 2026-10-21 prototype. This pass re-measured
it on today's boards and fixed it tile by tile, as four parallel lanes. Owner
rulings R1–R7 above stay readable; lines this pass supersedes are named below,
not deleted.

### How it was measured

- **Tools (on `main`):** the #25 harness `tools/balance/` (a tile-aware fork of
  the demobot, proven tick-for-tick equal to the stock bot on tile-free boards:
  9600 runs, 0 divergent) and the static checks V13–V27
  `tools/balance/featchecks.mjs` + `featreport.mjs` (no bot). `w.featProf` is a
  harness-only knob seam in `featProfile`; unset, every pin is byte-identical.
- **A0 is re-baselined on today's code** (gen-3 boards = the bold gen-2 board
  with ~17 fewer bricks, the `fair.js` gate, brick-passers at 12 steps). The
  2026-10-21 table above ran on the older mockup and is not comparable.
- **Arms share one world:** A0 is the same gen-3 world with the tile layer
  nulled after `loadLevel`; A1 the dial; A2 / A3 CORE / MAX knobs at every
  heat. Never gen 2 vs gen 3 (gen 3 forces tile cells open).
- Paired bootstrap 95% CIs; confirm runs on held-out seeds never used for
  tuning; NORM pace unless named.

### Owner decisions (2026-10-26)

| # | Ruling |
|---|---|
| O1 | **Heat** turns the dial; pace scales tile speeds only. |
| O3 | MAX-only extra tiles only if knobs + placement + rules all miss MAX +3 pp. **Not used by any tile.** |
| O7 | **No AI retune** (foes do not learn to avoid traps). |
| O8 | Foes may trigger traps and relays if trap self-clears stay ≤ 1 per room. |
| O9 | BOOSTER stays in room 1. |
| T1 | **TRAP rule changes accepted** (below): no chain, `off` / `hold` arming, PLUS spares the trigger foe, MAX kills no foe. Supersedes R2's "any blast it makes is the real blast" for PLUS / MAX and #22's "it chains bombs on its arms". |
| I1 | **ICE PATCH:** CORE ×1.0 (no speed boost; ×1.1 failed the CORE gate) and a MAX **brake**. |
| B1 | **BOOSTER is an assist tile at every heat:** its MAX gate is *not easier than A0* (CI lower bound ≥ −3 pp), not +3 to +10. |
| C1 | **CONVEYOR at EASY pace** may add no MAX difficulty (−0.1 pp); accepted, the #30 playtest may revisit. |

### Results (confirm runs, Δ lose = with tiles − A0, pp, 95% CI)

| Tile (room) | n / cell | CORE | PLUS | MAX | Static V19 spots | Verdict |
|---|---|---|---|---|---|---|
| TRAP (5) | 6000 | −4.1 [−4.8, −3.5] | +0.3 [−0.4, 0.9] | **+5.9 [5.1, 6.8]** | 0 / 0 / 0 (was 1000 boards each) | dial works |
| ICE PATCH (2) | 6000 | +0.1 [−0.5, 0.8] | +1.1 [0.0, 2.1] | **+4.6 [3.7, 5.5]** | 0 / 0 / 0 (MAX was 616 boards) | dial works |
| CONVEYOR (3) | 3700 | −1.1 [−2.4, 0.2] | +2.4 [0.8, 3.9] | **+5.4 [3.6, 7.2]** | 0 / 1 cap / 0 (V17, V20 also 0) | dial works; A3 − A2 = +8.9 … +13.8 (was ≤ 3) |
| BOOSTER (1) | 2000 | −0.2 [−1.2, 0.9] | −0.1 [−1.4, 1.3] | −0.9 [−3.0, 1.3] | 0 / 0 / 0 (was 101 / 391 / 449 boards) | assist tile (B1); useful relays/run 0.63 / 1.07 / 1.61 (×3) |

- Order checks pass: CORE < PLUS < MAX lose, and A2 ≤ A1 ≤ A3, for TRAP,
  ICE PATCH and CONVEYOR. Trap self-clears 0.19 / 0.13 / 0.00 per room (O8 ≤ 1).
- Pace: TRAP MAX +5.5 EASY / +5.8 HARD; ICE PATCH MAX +5.6 HARD; CONVEYOR
  MAX +6.9 HARD, −0.1 EASY (C1).
- First-5 s hits stay under the pooled ceiling in every confirmed cell; hits
  under 15 s are the usable early-hit signal at the fair start.
- **Clear time ("CORE 10% faster") is unresolved for every tile:** the bot wins
  too few rooms. The #30 human playtest decides joy.

### Final specs (reference patches on local branches, not merged)

The tuned rule and placement code lives on four local branches, one per
build issue: `pass2-trap` (#22), `pass2-ice` (#20), `pass2-conveyor` (#19),
`pass2-booster` (#21). Each also edits the shared harness models for its own
rule; #18 integrates them. Help strings below replace the `TILE_HELP`
placeholders.

**TRAP (ARENA, room 5).** Placement: 3–5 traps (V26), SHRINK-safe spots first
(V20 463 → 81 boards). All heats: `chain:false` (a trap blast sets off no bomb),
`off 1` (never arms while you are on or within 1 tile of its lines), `hold`
(never arms while a lit bomb's blast covers its lines).

| | wind / r / cd | inert | arms when | foes |
|---|---|---|---|---|
| CORE | 0.5 / 1 / 3 | 2 s | you within 4 | blast kills all (the lure) |
| PLUS | 0.8 / 2 / 4 | 2 s | you within 4 | spares the foe that set it off |
| MAX | 1.0 / 3 / 3 | 6 s | anywhere | kills no foe (pure hazard) |

Help: `LURE FOES ON · SHORT` / `TRIGGER FOE LIVES · LONG` / `FOES IMMUNE · HUGE`.

**ICE PATCH (ICE, room 2).** Placement: two rings of 8 around the pillars
whose rings hold the most open floor, in the open lane band (~16 tiles, ~14
open at start); V24 unchanged; foes may start on ice, SENTRY never.

| | speed on ice | on release | turns | opposite press |
|---|---|---|---|---|
| CORE | ×1.0 | stop | corner assist 0.35 | — |
| PLUS | ×1.25 | coast to next centre | buffered 0.20 | — |
| MAX | ×1.5 | coast to a block or off the sheet | buffered 0.10 | **brake** (stop at the next centre) |

Edge cases (#20): a coast into a bomb stops; a plant while coasting drops on
the tile being crossed; KICK works on ice at every heat; the glide state clears
on a hit and on a room load. Help: `SMOOTH ICE, STOP ANY TIME` /
`FAST ICE, SLIDES A STEP` / `SLIDES ON · BACK TO STOP`. The brake must be taught
(coach tip / FLOOR line, #24): a player who never brakes takes more first-5 s
hits at MAX.

**CONVEYOR (FACTORY, room 3).** Placement: two chains on always-open floor
only, landing never nearer the start than the head, SHRINK-safe rings 1–4
built in (V20 974 → 0), V15 shape rules kept; `beltDist` uses the half-cell V17
model per edge.

| | who rides | speed (× pace) |
|---|---|---|
| CORE | your bombs | 0.6 |
| PLUS | your bombs and you | 1.0 |
| MAX | bombs, you and foes | 1.2 |

Rule flags: `thru` (a ridden bomb stops only at a WALL, BRICK or bomb, so its
blow cell is readable from the board), `snap` (holding toward an open side cell
steps you off without a sideways shove; this is the forgiving step-off),
`endHalt` (riders stop at the chain's end), `wallStop` (a chain ending at a
SHRINK wall carries no one). Help: `CARRIES YOUR BOMBS` /
`CARRIES BOMBS AND YOU` / `CARRIES ALL, FOES TOO`.

**BOOSTER (JUNGLE, room 1).** Knobs unchanged from section 3 (CORE +2
forward; PLUS +2 and 1 each side, 0.15 s; MAX +2 and 2 each side, 0.30 s
flare; cooldown 1.0 s; relays stay real). Placement: 3–5 boosters on (odd, odd),
≥ 2 Manhattan from the pocket and doors (was 4), no two within 3 in a line,
nearer the start; each booster kept only if V18 and V19 pass on all three
heats' grids (same layer at every heat). V25 becomes 3–5 with pocket gap 2.
Help: `THROWS YOUR BLAST 2 ON` / `2 ON + 1 EACH SIDE` / `2 ON + 2 EACH SIDE, LATE`.
Art candidate (#23): the flare lights the relay's reach along each arm during
the delay. Optional rule `bloom.safe` (a CORE relay cannot hurt you) is wired
and **off**: the bot played greedier with it (+1.5 pp).

### Lead rulings on the gates

- **Tile-hit gate:** "hit while standing on a tile" over-counts once tiles sit
  on main corridors (ICE PATCH 29 % at CORE with ice adding 0 hits vs A0). The
  gate becomes **hits the tile causes**: the paired Δ hits vs A0.
- **No-escape:** the gate of record is **static V19 = 0**, met by all four
  tiles. The live harness counter is pessimistic (CONVEYOR's real-sim oracle
  `tools/balance/oracle.mjs` found all 886 flagged episodes escapable) and
  still flags residuals (BOOSTER 15 / 84 / 164 per 2000 runs, mostly the bot
  planting while its own blade or a flare is live). #25 / #30 replay them
  through the oracle and either exempt own fresh plants or give the bot a
  timed pre-plant escape check.
- **Art "marks ≤ 30 %"** is superseded by direction D (owner: "the current
  tile art are great"); the TRAP MAX band fix is moot.
- **The open CROWN GATE heat tell** (#33's finding) is a wave-2 item (#26).

### Open items for the build

- **V14:** floor and buried items land on tiles on 26–92 % of boards; the fix
  is `loadLevel`'s free list and the brick fill (#18). Every result above must
  be re-confirmed after it, because A0 changes too.
- **Merge blocker (BOOSTER):** `pass2-booster` imports
  `tools/balance/featchecks.mjs` from `src/core/board2.js`; #18 moves the
  checks into `src/core` first (and limits the room-1 check to cells near each
  booster: ~78 ms per load today).
- **Shared harness edits** on the four branches overlap (`tilemodel.mjs`,
  `escape.mjs`, `featchecks.mjs`, `tilerun.mjs`); #18 merges them once.
- Copy and art follow-ups: CONVEYOR CORE / PLUS no longer carry foes or you
  (#19 copy, #23 art); TRAP MAX is a hazard, not a lure (#22 copy); the coach
  tip and FLOOR line teach the ICE brake and the trap rules (#24).
- MAX near misses do not rise for any tile (the counter sees plain bomb
  footprints only); PLUS / MAX tile-assisted kills fall under the old 10 % gate
  for TRAP by design (T1).
- Human playtest (#30): joy on CORE, the ICE brake, and whether MAX feels
  harder by the margins measured here.
