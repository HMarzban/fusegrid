# Human-like attract demobot (2026-09-02)

Attract demo AI in `src/app/demobot.js`. Public copy never uses Bomberman.
Approved to implement in the same pass (not propose-only). Attract still
loads **CORE** heat and **pact=0**. `step()` 1P contract, frozen `CFG`,
mid-run heat, Easy/Hard, Sudden Death, and internet play stay parked.

## Player-facing

Idle MENU still becomes ATTRACT after 10s. The demo should read as a
competent casual on CORE rooms 1–3: it has a job (cube, foe, or a brick
that opens a lane), plants then leaves the tile, and does not stand in
its own blast or walk back onto a live bomb (plant-and-leave / R16).
Gold WALL is never a reason to plant. Short holds and brief pauses beat
per-tick axis chatter. Far floor FLAME / BOMB / KICK with a path get a
hunt; a far-corner HEART does not camp. Room 3 should leave the spawn
pocket to pressure a corridor foe. Dying instantly or camping a corner
still looks broken. Twenty-second room rolls stay as they are.

## Approaches

1. **Intent FSM + sticky heading (this pass).** One mode at a time
   (flee / escape / cube / foe / brick / wander). Danger always wins.
   A heading holds for many ticks. Seeded pauses. Testable contracts.
2. **Scored goals + hysteresis.** Re-score cube/foe/brick every tick
   with a stickiness bonus. Fewer modes, easier to flip, harder to pin
   plant-then-leave.
3. **Deep search / TAS.** Lookahead over fuse windows. Too perfect for
   attract, more code, worse “person on a stick.”

Picked **1**. The prior blast-pocket pass stays: `dangerTiles` is still
the live-bomb cross ∪ blades ∪ bomb tiles; `fleeMove` still walks
through danger, prefers a non-edge safe dest, and a later hop into
danger is cancelled.

## Rule

`createDemobot(seed)` is still app-layer, not read by `step()`. Own
mulberry32 stream only — never `world.rng`, `Math.random`, or `Date`.
State stays JSON-serializable.

`intent(world)` order:

1. `world.state!=="PLAY"` or player dead → `NOOP`, clear latch + sticky
   fields.
2. Build `danger` (unchanged footprint walk). Soft-block: live-enemy
   tiles and bomb tiles the player is no longer on (R16 re-entry).
3. **Flee** if the player tile is in `danger`. Same `fleeMove`.
4. **Escape** after a self-plant, or while standing on an own bomb,
   until the tile is safe *and* not adjacent to `danger` (no fuse-hug,
   no walk-back toward the blast). Then a short seeded pause is allowed.
5. Else if a pause timer is live, stand.
6. Else continue a legal held heading (dest empty, not danger, not a
   bomb re-entry, not an enemy tile).
7. Else pick a goal, in this order:
   - Floor cube (`!taken && !buried`, EMPTY path). Combat cubes
     (FLAME / BOMB / KICK) have **no Manhattan-8 cap** — hunt them when
     a safe corridor exists. Prefer those when visible. HEART and other
     soft cubes stay ≤ 8 so a far-corner heart does not camp.
   - Nearest live foe: adjacent or clear line ≤ `p.range` with a bomb
     slot and an escape after a hypothetical plant → plant (this frame
     **move=0** so the sim plants on the current tile). Do not step
     onto the foe.
   - Else if that foe has an EMPTY path, hunt it. Do **not** nibble an
     adjacent spawn brick when the foe is already reachable.
   - Else adjacent green BRICK whose hypothetical blast hits brick or a
     foe (never gold-only) and `fleeMove` still finds an exit → plant.
   - Wander: seeded legal `DIRS4`, hold 18–42 ticks. Sometimes a 6–14
     tick pause instead. If a live foe exists but has no path, bias the
     heading toward that foe / mid-board (still a sticky hold, not a
     per-tick search).
8. Fire is one rising edge per want episode: `fire=want&&!latch`, then
   `latch=want`. Holding want does not oscillate. Never fire in a pocket.
9. Last gate: cancel a hop onto danger, a bomb the player already left,
   or a live foe.

GOLD WALL never breaks; a plant must be useful (brick or foe in the
cross before a wall). Surviving a hit still leaves bombs/blades in the
world — those stay in `danger`.

## State

`{rng,latch,mode,gx,gy,hx,hy,hold,pause,esc}`. Extra fields beyond
`rng`/`latch` are allowed. Restore must reproduce the next intent.

## Tests

Keep attract CORE / pact=0 pins in `tests/headless.test.mjs`. Keep
demobot replay, flee-underfoot, wander legality, sealed NOOP, purity
grep, and the blast-pocket corridor.

New behavioral pins in `tests/demobot.test.mjs`:

- Fire latch is `t,f,f,f…` while want persists (no step).
- Adjacent foe: plant, leave the tile, do not re-enter it while the
  bomb is live, do not walk back onto a blast-adjacent tile after first
  reaching a non-edge safe tile, alive at detonation.
- Obvious floor FLAME on a clear +x lane, foe parked south: first steps
  go +x.
- Brick between bot and foe, escape pocket exists: plants.
- Wander with no live foes and no floor cubes: heading hold, not
  per-tick chatter.

Hunger pins (same FSM, hungrier goals):

- Far-ish floor FLAME / BOMB / KICK with an EMPTY path (Manhattan > 8):
  first steps hunt that cube, not a parked far foe.
- Visible combat cube beats a nearer HEART.
- Far-corner HEART with a path does not camp when a foe is reachable.
- Reachable corridor foe plus a spawn-adjacent brick: hunt the foe,
  do not plant the nibble brick. Room-3 / mid-board pressure is not
  spawn-locked.
- No path to a mid-board foe: first heading leaves the spawn axis
  toward that foe (hunger wander), still 18–42 hold.

## Out of this pass

`main.js` harness, Attract CORE/pact, heat, Pact, rooms 6–8, boom table,
per-biome cameras, kick/remote/throw in the demo, headed feel (still
needs a watch).
