# Finishing the floor tiles (shell v199)

Date: 2026-11-02. Status: built on `main`; live once the owner says to push.

The owner asked to finish all tile and floor tasks, in parallel, before the next phase. This
round covers everything an agent can do alone. Real-device checks, the owner's veto round, the
human playtest and its verdict (#30) still need people.

## Built

- **TRAP warning (#22).** `relayTell` now marks every tile a trap in wind-up will hit, by the
  sim's own rule, read-only, in all three looks, plus a short arm sound. Seen in a browser at MAX
  in all three looks. The sound hasn't been heard.
- **TRAP copy.** The FLOOR line at MAX reads `HURTS ONLY YOU · HUGE`, and the tips point at the
  marks. Lead call: `off` and `hold` are safety rules that need no teaching.
- **A tile may not close your only way out.** Two new rules, at every heat, on gen 3 only:
  - `carryPins` (`sim.js`): a CONVEYOR or STREAM waits rather than carry a bomb to where it would
    leave the player no reachable tile outside the blast, if leaving it put would leave one.
  - `gatePins` (`tilegate.js`): a GATE holds at its last warning step rather than shut, if the shut
    would leave the player fewer than `GATE_ROOM` 10 safe cells, fewer than with it open, and a foe
    or blast is on that ground.
- **Faster board building.** `featchecks.js` lost most of its per-bomb allocation. No check's
  decision changed: 24,000 boards hash identical to v198, and 6,524 old-versus-new check
  comparisons show 0 differences.
- **Bot and harness.** `tools/balance/` now see QUICKSAND and GATE, and the fork bot waits at bars
  and plays around mounds. `verdict.mjs` prints #30's targets per tile and heat.
- **Coverage.** `makeSnapshot` carries tile state on gen 3, `determinism.test` replays all eight
  tile rooms at all heats with no nondeterminism found, and the PIXEL manifest derives tile cells
  from `FEAT`.

## Rulings

| Item | Call | Who |
|---|---|---|
| BOOSTER flare | Dropped. It adds no useful warning and looks like fire too early. Code stays on the local `flare-candidate` branch | Owner, on the lead's recommendation |
| CONVEYOR art and copy | No change; art and copy match the rules | Lead |
| GAUNTLET | Stays ARENA's mild layout. Hall floor spots would reach MAX +3.2 but break V26 and push PLUS to -4.3 | Lead, owner may veto |
| MAX knobs for the four newer tiles | No change. Nothing tried reached the target | Lead |
| Carried bomb jump-back | Accepted. A pin found on arrival snaps the bomb back to its tile, up to about a tile, rarely. Removing that check lets a bomb seal a dead end | Lead |

## Numbers

Bot, n 2000 per cell, seeds 900000+, change in lose rate against no tiles, points, 95 % CI. This
sweep ran before the review's one-line gate fix; room 8 was re-run after it and read the same.

| Tile | CORE | PLUS | MAX |
|---|---|---|---|
| BOOSTER | -0.1 [-1.1, 0.9] | +0.4 [-0.9, 1.9] | -2.5 [-4.5, -0.4] (assist tile, owner B1) |
| ICE PATCH | -0.4 [-1.4, 0.8] | +1.9 [0.1, 3.7] | +2.6 [1.1, 4.2] |
| CONVEYOR | -1.1 [-2.5, 0.2] | +2.1 [0.1, 4.0] | +6.5 [4.0, 8.9] |
| STREAM | -0.3 [-2.0, 1.6] | +1.2 [-1.4, 3.9] | -2.2 [-4.5, 0.1] |
| TRAP | -4.5 [-5.7, -3.3] | +0.8 [-0.3, 1.9] | +5.3 [3.8, 6.9] |
| QUICKSAND | -0.2 [-2.2, 1.9] | -0.9 [-2.1, 0.4] | -1.5 [-2.8, -0.1] |
| PORTAL | -1.6 [-3.0, -0.2] | -1.1 [-2.3, 0.1] | -2.5 [-4.0, -1.1] |
| GATE | -0.1 [-0.9, 0.8] | +1.6 [-0.3, 3.5] | -2.9 [-4.6, -1.5] |

**Why STREAM, QUICKSAND, PORTAL and GATE miss MAX +3 to +10.** 88 to 94 % of the bot's hits in those
rooms are foe contact, and these tiles mostly slow or block foes. A slowed foe, a shut bar and a
warped foe all read as relief. Rooms 7 and 8 already lose 84 to 92 % without tiles, so +3 is near the
top of the scale. The bot never lures a hunter into a bar, warps for offence or uses a mound as cover,
so bot lose rate is a weak judge of these four. One option not built: foes warp only when the twin
brings them closer to the player.

**Forced moments with a foe in the lane**, per 2000 runs, before and after, seeds 600000+ unless
stated. No moment is proven unavoidable by the tile, but the target of 0 isn't reached.

| Tile | Before | After |
|---|---|---|
| CONVEYOR | 12 | 4 |
| CONVEYOR, held-out seeds | 18 | 5 |
| GATE | 21 | 14 |
| STREAM | 2 | 1 |

GATE's remaining cases are mostly fast foes in rooms with up to 10 of them; fixing the rest would
mean changing foe AI, which is off limits. The oracle's search only moves, so these are upper bounds.

**Board build time**, ms, 6x slowed CPU, 40 seeds, p95 and max, v198 then v199:

| Room | v198 | v199 |
|---|---|---|
| 1 | 186, 187 | 26, 46 |
| 4 | 728, 803 | 64, 69 |
| 7 | 321, 401 | 51, 67 |
| 8 | 98, 107 | 27, 31 |

The p95 goal of 50 ms is met on a 300-seed sample on every room, but not on this 40-seed run in
rooms 4 and 7, or on cold first boards in rooms 1 (51) and 4 (73, n 5), with the machine heavily
loaded. Re-measured on a quiet machine on the final build, 40 seeds at 6x: p95 at most 38 ms (room 7) and
max at most 62 ms (room 4). A stand-in, not a phone.

## Known and accepted

- **Same board, new rules.** F3 links and dailies keep their boards, but carry and gate holds change
  how they play. Same-day daily tries and ghosts can span v198 and v199.
- **MAX gets slightly softer** in rooms 3, 4 and 8, since both rules fire at every heat. They fire
  rarely: about 1 % of gate shuts at PLUS and MAX.
- **False holds.** `carryOpen` and `freeCells` treat bricks and bombs as blocking even with PASS, and
  count every foe as a threat. These only make a room easier.
- **Static model drift.** `bombMap`, the fuse model and `tilemodel.mjs` `beltPath` assume a carried
  bomb's cell is known from the board, which a hold breaks. No failing case was built.
- **Flaky under load.** `pixel-render`'s 50 ms bake check failed when many agents shared the machine
  (103.9 ms). It passes alone.
- **Pre-existing.** `hide` in `featchecks.js` overflows on a belt cycle, which `belt()` never places.
- **Copy.** "SHUTS ON A CLOCK" and "CARRIES YOUR BOMBS" don't mention the rare holds, and "FIRST 6 S
  SAFE" doesn't say what the 6 s counts from. The tip limit leaves no room.

## Not verified

No human has played any of this. No real phone, Safari or Firefox. No real-GPU frame times. The TRAP
arm sound hasn't been heard. The TRAP wash at MAX wasn't checked on a phone. The CONVEYOR's direction is
weak in a still frame outside PIXEL, left as is.
