# Floor tiles, waves 2 and 3: STREAM, QUICKSAND, GATE, PORTAL

Date: 2026-11-01. Issues: #26 (STREAM, QUICKSAND, GATE), #27 (PORTAL). Umbrella: #16.
Status: **built in shell v196, `?gen=3` only; the "As built" section at the end overrides this text where they differ.** It extends
[the tiles record](2026-10-21-difficulty-tiles-design.md), whose rulings still hold
(R1–R7, O1–O9). The owner skipped the design questions ("skip"), so every rule not
already in that record or the two issues is the writer's call, listed in section 8.

## 1. Why

Four floor tiles have art in all three looks and no rules. The game draws them on
`?gen=3` boards and they do nothing. This round writes the rules, the placement and
the fairness checks a builder needs, so each tile can be built and measured like wave 1.

The bar is the one wave 1 was held to: CORE is joy, MAX is challenge, a tile never
starts damage on its own, and every danger can be read from the board.

**Goals**

- One verb per tile: float, re-route, time it, jump.
- Every board keeps a provable escape from your own bomb with the tile active.
- Rules a player can state after one room.

**Non-goals**

- Default play. All of this stays on `?gen=3`. F3 codes and the daily stamp `g:3` wait
  until tiles go default.
- The GUIDE FLOOR page: built in 2026-10-25; only its copy changes here (#26's scope
  list is stale on this).
- Foe AI changes (O7). Foes never plan around a tile.

**Would be a failure even if it works**

- A death the player could not have seen coming: a mound or bar closing the only way
  out of a lit bomb, or a blast arriving from a portal with no warning.
- A tile that does nothing: a bar in an open field, a mound with an easy way round.

## 2. What the numbers say

A throwaway script (not committed) ran the real generator with the
`featchecks.js` escape engine on the art placements that exist today, then on candidate
rules. "Spot" means: a cell and flame length where your own bomb has an escape with the
tile off and none with it on. Own-bomb spots only. Foes are not in this model.

| Tile | Today's art placement (300 seeds, room's own heats) | With the rule below (150 seeds) |
|---|---|---|
| GATE, all shut | 53–58 % of boards have spots; 7 % split the map | 149 boards get 3 gates, 1 gets 2; 0 spots, 0 splits |
| QUICKSAND, all grown | 74–78 % of boards have spots | 0 spots on today's placement with the `hold` rule alone; all 150 boards get 5 tiles, mean detour 4.2 steps |
| STREAM, float + wade | 29–33 % of boards have spots; 32 % of runs flow toward the start; 44 % end at a wall | all 150 boards get 2 runs, about 11 tiles; 17 % of candidate runs refused for spots |
| PORTAL, MAX foes through | 58 % of boards break the foe distance | 0 by construction at 12 steps; all 150 boards still fit 2 pairs |

Three things changed the design:

1. **Today's placement is not usable for any of the four.** It was written for looks.
2. **QUICKSAND needs a rule, not just placement.** Fairness only breaks when a mound
   grows *after* a bomb is lit, so stopping growth near a lit bomb removes it.
3. **GATE is the opposite.** A room clock cannot wait, so fairness has to come from
   where gates may sit: every gate must pass with all of them shut for good, which
   proves every phase of the clock.

Fuses are 2.5 / 2.3 / 2.1 s. These figures are static. No bot has played any of this.

## 3. STREAM (WATER, room 4): float

**The rule.** Water carries bombs and slows walkers. Nobody rides.

| | CORE | PLUS | MAX |
|---|---|---|---|
| Bomb float (tiles/s × pace) | 0.8 | 1.0 | 1.2 |
| Walk speed in water, you and foes | ×1.0 | ×0.85 | ×0.75 |

- A resting bomb on a stream tile floats tile by tile down the run, the same way as
  CONVEYOR `thru`: only a WALL, BRICK or other bomb stops it, walkers do not. It stops
  on the first tile past the run. Fuse unchanged. `b.rode` stays set, so ride kills count.
- Wade reads the tile under the walker's centre, in any direction. It multiplies speed
  after the SPEED power. The player's is at `sim.js` `updatePlayer` (`sp`), the foe's at
  `enemies.js` `sp`. That is a movement scale, not a decision, so O7 holds.
- The player always outruns a float: worst case 2.17 tiles/s (MAX wade, EASY) against
  1.38 (MAX float, HARD).

**Why it isn't CONVEYOR.** CONVEYOR moves you. STREAM never does: it costs you speed,
and costs foes the same, so at MAX a stream is a moat that buys time for both sides.

**Placement (V28).** Replaces the art placement.

- 2 straight runs of 4–6 tiles, 12 tiles at most; runs never touch.
- Every run tile more than 4 steps from the start and off the doors.
- The tile past the run is not a WALL.
- The tile past the run is no nearer (1,1) in walking steps than the run's head. This is
  the record's "no carried bomb reaches the start corner" rule.
- SHRINK rings 1–4: a run cut by a ring still floats to the wall and stops (V20).

**Fairness (V29).** Add to V18 / V19 with float and wade costs. A run that adds a spot
at any heat is refused during placement, the BOOSTER way. V17 needs no change: water
only slows foes. A float bomb's cell at the fuse is known per pace, as on CONVEYOR.

## 4. QUICKSAND (SAND, room 6): re-route

**The rule.** Open ground regrows bricks on a visible timer, so a route you opened may
close behind you.

| | CORE | PLUS | MAX |
|---|---|---|---|
| Wait before growth | 30 s | 18 s | 10 s |
| Regrowths per tile | 1 | 3 | no limit |
| Foe speed on sand (**writer's pick, section 8**) | ×0.6 | ×1.0 | ×1.0 |

- A tile starts the room open, with the wait already running (today's placement forces
  it to floor, so there is never a first brick to clear).
- Growth takes 1.5 s, shown as the ripple art, passable throughout.
- **Occupied:** growth waits while a player, foe, bomb, blade or item is on the tile.
  Anything arriving mid-growth cancels it (H20).
- **`hold`:** growth neither starts nor finishes while a lit bomb lies within
  `max(its radius + 1, 4)` Manhattan tiles. This is what makes it fair.
- A cancelled or held growth retries 2 s after the tile is clear. A cancel costs no
  regrowth.
- A grown mound is a real BRICK: it stops blasts, blocks walkers, brick-passers go
  through. Breaking it restarts the wait. No regrowth left means open for good.
- **O6 as recommended:** a grown mound scores 0, hides no item and does not count in
  the STATS brick tally. `breakBrick` checks the tile and the `brick` event carries a
  flag.

**Placement (V30).** 3–5 single tiles, at least 4 Manhattan apart, more than 4 steps
from the start, off the doors, at least 2 open neighbours, and:

- with all of them grown on a brick-free grid, the map stays connected, so a mound can
  never seal a pocket by itself;
- blocking the tile adds a detour of at least 2 steps, else it does nothing.

**Fairness (V31).** V19 with mounds treated as WALL beyond the `hold` radius. Measured
at 0 spots. V18 needs no extra rule: mounds are far from the start.

## 5. GATE (CROWN, room 8): time it

**The rule.** Bars in corridors. They lower on a warning you can read and never hurt you.

| | CORE | PLUS | MAX |
|---|---|---|---|
| Trigger | you cross it | room clock | room clock |
| Open | until crossed | 6 s | 4 s |
| Warning (inside open) | 0.5 s | 1.0 s | 0.75 s |
| Shut | 3 s | 3 s | 4 s |
| Foes trigger it | never | no trigger | no trigger |

- **CORE** shuts 3 s after you leave its tile, stays shut 3 s, then opens (the reopen is
  a writer's call; the record never said). Joy: drop it in a hunter's face.
- **PLUS and MAX** run one clock per room from `featT`, every gate in step, starting
  open. All gates together is what makes it readable.
- The warning state is still passable, and blasts still pass.
- **Occupied:** a gate waits while anything is on its tile (H20), then shuts the moment
  the tile clears, if at least 0.5 s of its shut remains; otherwise it skips this shut.
- A shut gate writes `T.WALL` (H20): it stops walkers, bombs and blasts, so a shut bar
  is cover. Foes re-plan at their next `bfsNext`, no AI change.
- **SHRINK:** a gate on a ring tile is dead. It must never reopen and erase the ring.

**Placement (V32).** 2–3 gates on straight corridor tiles, at least 4 Manhattan apart,
more than 4 steps from the start, off the doors. Greedily add one only if, with every
kept gate shut for good:

- the brick-free map stays connected (never seals);
- no spot appears at any heat.

This proves every phase, so no timed check is needed. It is strict on purpose.

**Fairness (V33).** V32 re-checked on the finished board.

**Heat tell (from #33).** In CLASSIC 2D the open gate's heats differ by 2.14 L\* (bar 4),
and no value change gets past about 2.3. Fix it with structure: 1 / 2 / 3 raised posts
on each jamb while open, in all three looks. Removes the waiver `CVD_WAIVE`. Show the
owner a contact sheet.

**Render.** Per H20: gate tiles skipped in all three wall passes, PIXEL's SHRINK SLAM
skipped for them, bars at most `NEAR_H` 22 tall. REAL 3D adds one InstancedMesh, with a
real shadow. **#26's "143 / 144 draws" is stale:** fat-world is now 156 (158 worst), so
expect 157 / 159 in gate rooms, inside the 160 lane cap but with 1 to spare.

## 6. PORTAL (VOID, room 7): jump

**The rule.** Paired tiles. Step on one, come out of the other, facing the same way.

| | CORE | PLUS | MAX |
|---|---|---|---|
| You and moving bombs warp | yes | yes | yes |
| Blast arm reaching a portal | stops there | passes to the twin | passes to the twin |
| Foes warp | no | no | yes, with the exit guard |

**Warp**

- Fires when an entity's centre enters a portal tile. It is a relocation outside
  `moveEntity`: set position to the twin's centre, keep direction.
- **Latch:** nothing warps again until it has left the tile it arrived on, so no ping-pong.
- **Blocked for you** (you walk over it as plain floor, and the pair draws dim) while
  the twin has a bomb or a live blade on it, or a foe within 1 tile. A tile must not
  start damage, so it cannot drop you on one.
- A twin under a SHRINK ring kills the whole pair.

**Bombs**

- A kicked or carried bomb warps, keeps fuse and slide, and stops on the twin if the
  next tile is blocked. Blocked by a bomb on the twin: it stops short.
- A bomb planted on a portal, or landing on one from a throw, stays there and blocks it.

**Blast (`computeBlast`)**

- An arm reaching a portal includes that tile. At PLUS / MAX it also includes the twin
  and continues from there in the same direction with its leftover reach; the jump
  costs no reach (this rules on #27's open assumption).
- At most 2 jumps per arm, so two pairs cannot loop.
- A bomb sitting on a portal does not jump: only an arm that enters one does.
- Lit tiles reach the twin side, so BOMB chains and hits work with no other change.
- **Warning:** extend `relayTell` to mark continuation tiles from the moment the bomb is
  lit. Without it this is the unfair death from section 1. Required, not polish.

**Foes at MAX**

- Hunters never plan through a portal (no AI change). A foe warps only by walking onto one.
- **Exit guard: Manhattan, not walking.** A foe waits on the entry tile while the player
  is within 2 Manhattan of the twin. This overrules #27's "walking distance": Manhattan
  is stricter (it implies walking >= 3), needs no search each tick, and matches what the
  player sees.
- **Waiting is capped at 2 s,** then the foe walks on without warping. Otherwise standing
  near a twin freezes a foe for an easy kill. A waiting foe can be killed.

**Placement (V34).** 1–2 pairs, ticks 1–2 (#27's "1–3" assumes 3 pairs; no need).

- **Every portal at least 12 walking steps from (1,1), bricks passable.** Then a shortcut
  through a pair cannot put a foe under its fair-start distance, at any heat. All boards
  tested still fit 2 pairs. Portal-aware foe spawning was the alternative; it left 8 % of
  boards under 10 spawn tiles for a roster of 9.
- Twins at least 8 Manhattan and 8 walking steps apart; no two portals within 3.
- At least 2 open neighbours, so you can always step off.

**Fairness (V35).** The escape engine gains warp edges and continuation in the lethal
map, then V18 / V19 run with them; a pair that adds a spot is refused. Today's estimate
treats portals as untouchable: 0 spots even uncapped, but 50–53 % of boards fail within
the 4-step cap. That model is too harsh, since a warp usually *is* the escape. **This is
the least-settled number in this document.** Measure it first when building PORTAL.

**What counts as an escape.** A warp can be blocked by a foe the checks cannot see, so
the escape must hold **both ways**: once with every portal warping, and once with every
portal as plain floor. A route that only works through a warp does not pass.

**If too many pairs are refused.** At least 95 % of seeds must keep 1 pair or more; the
rest ship a tile-free gen-2 board (V23). Below that, drop to 1 pair first. Never relax
the both-ways rule or the 4-step cap to make the number. If 95 % is still out of reach,
stop and take it to the owner before building PORTAL's rules.

## 7. What every tile shares

- **State.** `featM` / `featS` as wave 1: profile rows in `FEAT_PROFILE` gain `stream`,
  `quick`, `gate`, `portal`, and the `w.featProf` harness seam carries them.
- **Teaching.** `TILE_HELP` and `tileTip` get four kinds; `nb.coach.v2` grows to 16 bits,
  byte-stable. The FLOOR page and room card lose LOOK ONLY as each lands.
  Suggested help:
  - STREAM: `CARRIES BOMBS` / `CARRIES BOMBS · SLOWS ALL` / `FAST · SLOWS ALL MORE`
  - QUICKSAND: `BRICK GROWS BACK ONCE` / `GROWS BACK, 3 TIMES` / `KEEPS GROWING BACK`
  - GATE: `SHUTS BEHIND YOU` / `SHUTS ON A CLOCK` / `SHUTS LONGER`
  - PORTAL: `YOU AND BOMBS JUMP` / `BLASTS JUMP TOO` / `FOES JUMP TOO`
- **Checks.** `RULE_TILES` gains the four; `featchecks.js` is in everyone's boot graph
  (33 KB today), so V28–V35 grow it, which feeds the pending call in section 8.
- **Placement changes reach only gen 3.** Gen 1 and gen 2 boards are byte-identical,
  and no F-code or daily can hold a gen-3 board. The CLASSIC tile pin (room 3) is not
  touched; art-room placement tests re-pin.
- **Bot.** The fork needs no gate or mound knowledge, since both are grid cells. It needs
  STREAM's wade in its timing and PORTAL's warp in its escape reasoning, or it dies to a
  warp and blames the tile, as happened with CONVEYOR's lure.

**Measure each tile with #25 (arms A0–A3), #30's targets:** CORE clears at least 10 %
faster with lose no worse, MAX lose +3 to +10 points, first-5 s hits at or under the
no-tile count, static checks 0. Report joy honestly: rooms 6–8 are hard and bots ignore
sand. BOOSTER precedent: a tile that fails MAX but plays well can be an assist tile.

**What blocks a release.** These releases only reach the `?gen=3` preview, as wave 1 did.

- **Blocks:** static checks V13–V35 at 0, first-5 s hits at or under the no-tile count,
  `npm test` green.
- **Reported, not blocking:** the CORE clear-time and lose targets and the MAX band. Each
  tile gets one tuning round if it misses, then the numbers go in the record as they stand.
  The bot does not learn to use gates or mounds: a bot cannot show CORE's joy on these,
  so a CORE miss there is expected and goes to the playtest.
- **Going default** is a separate decision, the owner's, after a playtest.

**Build order, one change per tile:** STREAM (smallest, reuses `thru`), GATE, QUICKSAND,
PORTAL (needs the escape-engine work, per #27 after #26). Each is its own shell release.
Capture looks with `shot.mjs` per the issues.

## 8. Calls made without the owner

Veto any of these. The first four change the game most.

1. **QUICKSAND's CORE joy (O10): foes slow to ×0.6 on sand at CORE only.** Otherwise
   CORE sand is one late brick. It's also what the name promises. May still be too thin;
   the playtest decides.
2. **O6: mounds score 0, hide nothing, not counted** (the issue's recommendation).
3. **GATE at CORE reopens after 3 s.** The record gave no reopen rule.
4. **PORTAL exit guard is Manhattan with a 2 s cap,** against #27's "hold until
   walking distance is >= 3". The cap is new.
5. QUICKSAND's `hold` rule and its 2 s retry (new).
6. Two STREAM runs of 4–6 tiles instead of the art's 1–2 of 3–6, for presence; wave 1's
   tiles did nothing when sparse.
7. A portal blocks while a foe is within 1 tile of its twin (new).
8. PORTAL pairs capped at 2, each portal at least 12 steps out.
9. PORTAL escapes must hold with and without the warp, and 95 % of seeds keep a pair.
10. Measured targets are reported, not release gates, on the preview (section 7).
11. The boot cost is not solved here: V28–V35 run inside the synchronous `genBoard3`, so
    the checks everyone downloads grow past today's 33 KB. A lazy load for `?gen=3` is
    its own job, and the 33 KB is already an open owner pick.

**Owner ruling 2026-11-01, first "After my playtest", then "let's work on the tiles and
wave and finish them all" and "boostup and work on all of them in parallel": built before
the #30 playtest.** #26 listed #30 as a dependency because wave 1's verdict may move these
numbers, so expect to re-measure after it. Foes are not in the static checks, and wave
1's foe-in-lane moments are still open; gates and mounds add the same kind of closing-lane
risk, so that is the first thing to watch. The calls above stay open to veto until then.

**Left to the builder:** field names, coach letters, event names, the exact dim look
for a blocked portal, the bar mesh, how `relayTell` walks portal arms, test layout.

## As built (shell v196, 2026-11-01)

Built by four parallel lanes, merged on `tiles-wave-2-3`, then one independent review.

**Changes from the sections above:**

- **STREAM:** MAX float is 1.4, not 1.2 (the one tuning round, chosen statically; the
  player still outruns it, 2.17 against 1.61 tiles/s). V29 is the V19 check on each SHRINK
  ring. CLASSIC water now scrolls. 2 runs of 4–6 tiles, mean 9.4 tiles.
- **QUICKSAND:** placement detour is at least 3, since an open-field tile scores 2. New rule
  from review: **growth also waits while a mound would box the player in**, that is, the
  floor you can walk touches the tile but has no cell off the line beside it. REAL 3D shows
  a low heap on the still-passable tile; CLASSIC and PIXEL show arcs only.
- **GATE:** placement wants 3, minimum 2. The fairness check moves on the shut grid and
  blasts on the open grid, **on the open board and after each SHRINK ring**, a hole the
  review found and replayed in the real sim. Draws are 158 in a gate room, 159 with a ghost,
  and ghosts cannot reach a gen-3 board today. `CVD_WAIVE` is gone: CLASSIC open-gate heat
  4.43, PIXEL 8.32, REAL 3D 3.93 (still a known gap against 4).
- **PORTAL:** **no foe warps in a MAX room's first 6 s** (`portal.inert`: foes warped at
  0.1 s and raised first-5 s hits). A pair is blocked by a foe on the twin or a *moving* foe
  orthogonally beside it, not a sentry or a diagonal, and **no foe spawns beside a portal**:
  the first rule left pairs dim 34–38 % of the time, now 14–22 %. Dim is per tile and is the
  truth for a walker. A slide stops short of a blocked portal, so a held kick cannot jitter.
  Added a `warp` sound. V35 both-ways holds with 299 of 300 seeds keeping 2 pairs, 1 keeping 1.

**Numbers of record** (n 2000 per cell, A0 against A1, seeds 900000+; rooms 7 and 8 after
the review fixes, rooms 4 and 6 before them, and QUICKSAND's guard and detour came after its
run; Δ lose in points, 95 % CI):

| Tile | CORE | PLUS | MAX |
|---|---|---|---|
| STREAM | −0.4 [−2.1, 1.6] | +1.2 [−1.4, 3.9] | −2.1 [−4.3, 0.2] |
| QUICKSAND | −0.2 [−2.2, 1.9] | −0.9 [−2.1, 0.4] | −1.5 [−2.8, −0.1] |
| PORTAL | −1.6 [−3.0, −0.2] | −1.1 [−2.3, 0.1] | −2.5 [−4.0, −1.1] |
| GATE | +0.8 [−0.1, 1.7] | +1.6 [−0.3, 3.5] | −2.6 [−4.2, −1.1] |

- **Passing:** static V13–V35 at 0 on all eight rooms, except STREAM V23 at 1.0 % of boards,
  on the "under 1 %" line. Gen 1, gen 2 and wave-1 gen-3 boards are byte-identical to main.
- **First-5 s hits:** at or under the no-tile count, except STREAM CORE, 19 → 23, under #30's
  ceiling of 27.7. Lead ruling: the ceiling is the gate, as in wave 1.
- **Missed, reported:** **no tile reaches MAX +3 to +10.** All four read as neutral or
  easier for this bot. It cannot use a gate or play around a mound, and the harness cannot
  see QUICKSAND or GATE (`rulesOn` covers neither, so `noEsc` and "fallback" mean nothing
  there, and `hTile` reads 0 in rooms 6–8). CORE faster clears are unresolved everywhere,
  with too few wins. These are open questions for the playtest, not passes.
- **STREAM no-escape:** 66 flagged moments at PLUS and MAX, 0 forced by the sim alone, 53
  escapable, 13 with a foe in the lane, 2 of those caused by the tile (a floating bomb).
- **Load (Node):** STREAM mean 22 ms, p95 47, worst 88–103. PORTAL 17, 25, 55. GATE about 5,
  QUICKSAND 1. Lead ruling: p95 is the gate on the preview; revisit before tiles go default.
  The tile checks and rules add about 37 KB uncompressed to everyone's boot graph, which
  feeds the open size pick.

**Not verified:** no human has played any of this. No real-GPU run. REAL 3D gate posts and
portal ticks on a phone, the 3D heap's read, and PIXEL MAX sand arcs at phone size are weak
or unconfirmed.
