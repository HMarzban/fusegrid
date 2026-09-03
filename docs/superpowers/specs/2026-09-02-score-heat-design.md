# Score × heat (2026-09-02)

Plate A after Heat / Pact / rooms 6–8. Adviser-validated: persist-only
multiply. Public copy never uses Bomberman. CORE board numbers stay raw
`world.score` (×1). Sim does not change.

## Player-facing

Live HUD and WIN/LOSE overlay keep showing raw `world.score` plus the
heat token already shipped. No `×2` chrome. No fifth column. LEVEL still
folds the mark: `3·` `4+` `5×`. The SCORE plate prints stored `r.s`, so
after persist a PLUS/MAX row shows the scaled number. Do not multiply
again in `menudraw.js`.

The board stores the scaled score. Same raw 1200 run:

| Heat | Stored `s` | `t` |
|---|---|---|
| CORE | 1200 | missing or 0 |
| PLUS | 2400 | 1 |
| MAX | 3600 | 2 |

## Rule

`heatScore(raw, heat) = (raw|0) * (1 + clampHeat(heat))`

Integers only. CORE 1 / PLUS 2 / MAX 3. No floats. No `Math.round`.
Helper lives next to `clampHeat` in `src/core/heat.js`. Callers apply it
when building the persist payload. `recordScore` stays a store: it writes
what it is given.

## Persist (all three writes)

Today only `noteWorldEdge` (LOSE) carries `t`. M-from-PAUSE, toolbar Menu,
and the L5/L8 finale path call `persistScore()` with `{s,l,d}` only.
Missing `t` is CORE. A MAX M-quit would land as a CORE god-score if we
multiply from `t` and then drop `t`.

Every persist write is:

```
{ s: heatScore(world.score, world.heat), l: world.level, d, t: world.heat|0 }
```

Sites in `src/main.js`: `persistScore` (~303; KeyM ~325, finale ~642,
toolbar Menu ~770) and the GAME-loop `noteWorldEdge` payload (~617).
Key stays `nb.highscores.v1`. Sort already does score, then heat, then
room, then date. `qualifies` is unused in production; leave it.

Do not multiply inside `recordScore`. Do not touch award sites
(`sim.js` item +50 / brick +10 / kill 100|250|300, `entities.js` −20,
`enemies.js` level bonus).

Attract never records. Pact does not multiply.

## Tests

- `heatScore`: CORE 1200→1200, PLUS→2400, MAX→3600; clamp junk heat.
- `persistScore` / Menu write includes `t` (headless Menu persist today
  pins `r.s===1234` on a CORE world — still 1234).
- `recordScore` still stores what it is given. No sim award goldens.

## Out of this pass

Award-time multiply, `world.scoreMult`, CFG thaw, score × Pact, per-room
factors, live HUD `×2`, a fifth column, mid-run heat, always-on Sudden
Death, Easy/Hard, internet play, new biomes (plate C next).
