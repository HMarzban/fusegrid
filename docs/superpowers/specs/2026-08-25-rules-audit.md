# Rules Audit — Bomb Solidity & Power Canon (2026-08-25)

Scope: `src/core/{sim,board,entities,config}.js`, `src/ai/enemies.js`. Read-only audit; ruleset decision below is binding for the fix campaign.

## §1 Rule matrix — canon vs ours

| Interaction | Canon (SB/NES era) | OURS TODAY | Verdict |
|---|---|---|---|
| Player × own bomb (just placed, standing on it) | May stand + walk off; tile then solid, no re-entry | Fully walk-through both ways | DEVIATION |
| Player × any bomb | Solid wall | Non-solid (`solidAt`=grid only) | DEVIATION |
| Walker/fast/chaser/stationary × bomb | Solid | Non-solid | DEVIATION |
| Pass-type enemies (boomerang, rocket, `pass:true`) × bomb | Phase through | Non-solid — correct outcome by accident | Keep (make explicit) |
| Chaser BFS × bomb tile | Routes around | Paths straight through (board.js:30 checks WALL/BRICK only) | DEVIATION |
| Kick power | Walking into bomb LAUNCHES it; slides until wall/bomb/enemy | Breaks the brick in front (sim.js:74-82) | WRONG POWER |
| Throw | Arcs over obstacles to far tile | Instant-place 1.1 tiles ahead (sim.js:90-91); target validated (empty + no dup bomb) | Partial (acceptable v1) |
| Bomb × sliding bomb | Slider stops | N/A (no slider exists) | Add with kick |

## §2 VERDICT on player report ("a bomb is like a block and enemy can not move through it")

FALSE today — neither half holds. Bombs are intangible to everyone: player walks
through own/enemy-relevant bombs freely, all six enemy types cross them, and chaser
BFS treats bomb tiles as open floor. The report is therefore a CANON REQUEST: the
player expects Super-Bomberman solidity and isn't getting it. Root cause: bombs
live only in `world.bombs`; no collision function ever consults them.

## §3 Recommended ruleset (DECISION)

- MUST 1 — Tile-solidity: a bomb occupies its tile as a blocker for the player and
  all non-pass enemies. Exemption: an entity whose CENTER tile equals the bomb tile
  may move within/leave it (r=0.34 < 0.5 ⇒ no adjacent-tile overlap, so
  membership test is exact). Once the center exits, re-entry is blocked.
- MUST 2 — Real kick: replace brick-breaking (sim.js:74-82). With `p.kick`,
  moving into a bomb launches it along facing axis at `CFG.KICK_SPEED`;
  slides tile-to-tile (snapped centers, deterministic substeps), stops on
  WALL/BRICK/bomb/enemy tile; fuse keeps ticking; blast/chain unchanged.
- MUST 3 — BFS reroute: `bfsNext` accepts a blocked-key Set (bomb tiles);
  chaser/fast callers pass live bomb tiles. Fallback direction scan (enemies.js:40-45)
  adds the same test for non-pass enemies.
- SHOULD 4 — Pass-type enemies explicitly exempt everywhere (single `e.pass` gate).
- SHOULD 5 — Thrown-bomb landing refuses tiles occupied by enemies (currently only grid+duplicate checked) — prevents spawn-inside-enemy cheese.
- COULD 6 — Enemy candidates DIRS8→DIRS4 (kills free diagonal movement; canon 4-way).
- COULD 7 — `hurtPlayer` stops wiping `world.bombs/blades` (entities.js:42); canon persists bombs across death.

## §4 Sim touch points (⚠ all invalidate replay baseline → pin baseline-v3)

- board.js: `solidAt`/`circleHitsSolid` gain optional blockers Set (or new
  `circleHitsSolidEx(g,px,py,r,ownKey)`); `moveEntity(e,g,dx,dy,passBrick,blockers)`
  threads it; `bfsNext(...,passBrick,blocked)` skips blocked keys (start tile exempt).
- sim.js: `updatePlayer` movement calls pass bomb-key set (minus own-tile key);
  delete kick-brick branch → `launchSlider()`; `updateBombs` advances sliders
  (pos lerp toward target tile center, stop-check before commit, snap on arrive).
- enemies.js:35 BFS call + :40-45 candidate scan get bomb awareness (`e.pass` gate).
- config.js: freeze `KICK_SPEED` (suggest 4.5 tiles/s), `SLIDER_STOP_*`.
- world.js: death-reset semantics only if COULD 7 taken. Protocol/input intents
  UNCHANGED (`kick` field already exists) — lockstep-safe.

## §5 Acceptance tests (tests/sim.test.mjs + new rules.test.mjs)

1. RED-first: place bomb, step off, reverse input ⇒ player x/y stays outside bomb tile.
2. Stand-on-own-bomb at placement: no push-out; all open directions exit cleanly.
3. Walker cannot enter bomb tile; boomerang + rocket can (`pass` gate).
4. Chaser BFS detours around a bomb when an alternate route exists.
5. Kick: bomb crosses ≥3 open tiles, halts before wall/bomb/enemy tile, fuse intact, detonates + chains.
6. No kick power ⇒ bomb never launches.
7. Slider stops when its next tile holds an enemy (contact damage still independent).
8. Determinism: same seed+input twin-run identical post-change (baseline-v3 hash pinned).
9. Regressions: pierce/line/chain/brick-blast byte-equivalent behaviors stay green (full battery 15 files).
