# Score × Pact / fifth HIGH SCORES column (2026-09-03)

Persist-only metadata like heat grade — live HUD stays raw score.

## Storage

`nb.highscores.v1` rows: `{ s, l, d, t?, p? }`. Optional `p` is pact bitmask 1–15.
Rows without `p` load as 0 (backward compat).

## Display

Fifth column **PACT**: compact letters `L B T S` via `pactLabel()` (`—` when 0).
Score column `s` remains `heatScore(raw, t)` only — pact tags the run, no extra
multiplier in this pass.

## Sort / tie-break

`s` desc → `t` desc → `p` desc → `l` desc → `d` asc.

## Tests

- `tests/highscores.test.mjs`: round-trip `p`, legacy rows, sort tie-break.
