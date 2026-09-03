# Global Easy / Hard pace (2026-09-03)

Separate from Heat grades. Heat changes roster/fuse/lives; **pace** scales movement
sim-time multiplier on `world.pace` (not frozen `CFG`).

## Values

| pace | label | mul |
|------|-------|-----|
| −1   | EASY  | 0.85 |
| 0    | NORM  | 1.00 |
| +1   | HARD  | 1.15 |

Applied to player `updatePlayer` and enemy `enemies.js` step distance only.
Bomb fuse / AI cadence unchanged.

## UI

LEVEL SELECT: three PACE chips; `[` / `]` cycle. Persist `nb.pace.v1`.
Attract stays CORE/pact=0/pace=0.

## Replay baseline

CORE v6 bit-identical when `heat=CORE` and `pace=NORM (0)`.
