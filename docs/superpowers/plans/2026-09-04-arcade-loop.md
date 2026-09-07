# Arcade Loop Implementation Plan (index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the arcade-loop spec as seven independently testable plans so a player from itch or a tweet is in a room, can quote a score, and can start again without thinking.

**Architecture:** App-layer only except overlay copy. `playFromAttract` / coach persist / score tabs / plaques never enter `src/core/sim.js`. Each step has its own plan file; this index is the order and the shared interfaces.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, zero npm runtime deps, vendored Three unused on these paths.

## Global Constraints

- Public copy never names the other grid-bomb franchise.
- No new `SCREEN` values. PAUSE/WIN/LOSE stay `world.state`.
- `step()` stays pure. No time / DOM / `Math.random` in `src/core`.
- Attract demo stays CORE / pact=0 / seed `20260823`.
- Score × heat stays persist-only. Overlay stamp uses **raw** `world.score`.
- Zero npm runtime deps. No portal SDK, ads, or login boards.
- Bump `CACHE_NAME` and `sw.js` `REV` together when precache bytes change.
- Do not commit `.cursor/` or `e2e-artifacts/`.

## File map (locked)

| Plan | Creates | Modifies |
|---|---|---|
| [attract-starts-run](2026-09-04-attract-starts-run.md) | — | `menuapp.js`, `main.js`, `menudraw.js`, attract tests |
| [end-screen](2026-09-04-end-screen.md) | — | `scenes.js`, `main.js` (KeyC), overlay tests |
| [scores-by-heat](2026-09-04-scores-by-heat.md) | — | `highscores.js` filter, `menuapp.js` `scoreHeat`, `menudraw.js` |
| [ghost-coach](2026-09-04-ghost-coach.md) | `src/app/coach.js` | `main.js`, `scenes.js` or `shellview.js` |
| [local-plaques](2026-09-04-local-plaques.md) | `src/app/plaques.js` | `main.js` persist edge, `menudraw.js` SCORES |
| [listing-pack](2026-09-04-listing-pack.md) | `media/*` | `register.js`, `pwa` tests |
| [first-visit-play](2026-09-04-first-visit-play.md) | `src/app/cabinetseen.js` | `menuapp.js` `skip`, `main.js` |

## Shared interfaces

```js
playFromAttract()
// false if not ATTRACT; else {level:1,heat:0,pact:0,pace:app.pace|0}
// must NOT write app.level / app.heat / app.pact

overlayCue(world) // string, WIN/LOSE/PAUSE only
runStamp(world)   // "L3 FACTORY · PLUS · 1840"
scoresForHeat(list, heat) // filter; CORE includes missing t
```

## Order

- [x] Plan 1 — attract starts a run
- [x] Plan 2 — honest end screen (can overlap 1)
- [x] Plan 3 — HIGH SCORES by Heat (can overlap 1)
- [x] Plan 4 — ghost coach
- [x] Plan 5 — local plaques (needs 3)
- [x] Plan 6 — listing pack (can overlap anything)
- [x] Plan 7 — first-visit Play Now (needs 1)

Spec: `docs/superpowers/specs/2026-09-04-arcade-loop-design.md`.
