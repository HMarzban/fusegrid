# MEMORY.md

Episodic log — dated, append-only notes of what a session/agent did, decided,
or left for the next person. Newest first. One or two lines per entry.

This file is auto-loaded by opencode (see `instructions` in `opencode.json`)
and is a standing instruction target: `AGENTS.md` requires every session to
append an entry when it makes a non-trivial change.

## Format

```
## YYYY-MM-DD — <one-line subject>
- what changed / decided, and why (or: what was left open for later).
```

## Log

## 2026-08-23 — Determinism baseline v2
- Purged transcendentals from sim (squared distances, integer substeps, render-only bob),
  deduped enemy candidate dirs. Replays valid only from commits ≥ this point.

## 2026-08-23 — T8 executed (balance tunables hoisted into frozen CFG; pure rename)
- `4329aec`: 12 new CFG keys (CONTACT_R…ENEMY_INVULN_T) replace scattered literals across
  sim/world/entities/enemies — values verbatim, killEnemy ternary left structural. All
  suites green. Note: `tests/determinism.test.mjs` from the plan doesn't exist; replay
  checks live in sim/protocol tests. Report: task-report-t8.md

## 2026-08-23 — T6+T7 executed (input latch/axes fixed; WIN state + win/lose events live)
- `4caea59`: pointer down/up split (_onFireDown/_onFireUp) + setIntent sign fix (routed
  through `input` getter — brief's literal `_held.` crashes fresh headless Input).
  `32e90de`: board clear → WIN+win event, fire edge advances with carry; hurtPlayer emits
  lose. Suite 22/22 sim, all green; browser smoke of overlays left to user.
  Report: .superpowers/sdd/2026-08-23-master-plan/task-report-t6-t7.md

## 2026-08-23 — T4+T5 executed (contact damage via hurtPlayer; chain by blast coverage)
- `041cdec`: checkContact now calls hurtPlayer (shield→hurt event, else life loss); `aad680b`:
  detonate() chains any bomb on a blast-covered tile (was Manhattan-1). Suite 14/14 sim green.
- Two brief-test drifts fixed minimally, documented: T4 needed e.home={x:1,y:1} (stationary
  branch teleports y to home each tick); T5 bomb-A radius 1→2 (radius-1 footprint can't reach
  distance 2 — wall case was vacuous). Auto-advance stayed green; no superseded markers.
  Report: .superpowers/sdd/2026-08-23-master-plan/task-report-t4-t5.md

## 2026-08-23 — T3 executed (serve.js hardened: traversal/400/ACAO/stream/loopback)
- `4893b30`: path.relative containment (kills string-prefix sibling leak — proven 200 TOPSECRET
  pre-fix via raw socket), decode-before-join → 400 on bad %, ACAO:* deleted, stream error→404,
  binds 127.0.0.1 + prints server.address().port for PORT=0. tests/serve.test.mjs: traversal
  checks MUST use raw sockets — fetch/curl collapse ../ AND %2e%2e client-side. Stream-error
  handler untested (race-prone); browser smoke left to user. Report:
  .superpowers/sdd/2026-08-23-master-plan/task-report-t3.md

## 2026-08-23 — T1+T2 executed (replay harness feeds inputs; headless import fixes)
- T1 `e12fbff`: runSteps now applies inputFn output (full map or bare intent); new
  check 1b proves rightward input moves x (was 60 vs 60 vacuous). T2 `84bfc3e`:
  main.js debug globals guarded by `typeof window` (`__GAME__` name kept), renderer
  null-canvas fallback is a real noop ctx — brief's list missed arcTo/bezierCurveTo/
  quadraticCurveTo, added them. Full suite 3/3 green. Report:
  .superpowers/sdd/2026-08-23-master-plan/task-report-t1-t2.md

## 2026-08-23 — Master plan finalized (planning team: architect + test strategist + design calls)
- Wrote docs/superpowers/plans/2026-08-23-master-plan.md: P0 harness/env fixes →
  P1 gameplay bugs → P2 determinism purge (ONE baseline-v2 bump) → P3 fx out of world →
  P4 dimetric renderer (spec steps 1–7) → P5 cleanup. Design calls locked: WIN-state
  routing for level clear (fanfare/confetti wired), audio.prime deleted not wired,
  debug globals gated behind ?debug=1, all balance tunables hoisted to CFG.
- Spec §5.1 (hypot stays) and step-4 fx source amended BY the plan tasks before P4 runs.

## 2026-08-23 — Five-agent codebase review (arch/code-quality/dead-code/tests/security)
- Ran 5 parallel review agents. Verified live bugs: enemy contact damage never calls
  `hurtPlayer` (enemies.js:75 only emits an event); determinism test harness discards its
  generated inputs (sim.test.mjs:17-18, replay tests are vacuous); pointer `pointerup`
  latches fire=true; chain detonation only chains distance-1 bombs (sim.js:170).
- serve.js prefix-match traversal gap (`startsWith(ROOT)` without sep) + `ACAO:*`.
- Open decisions left: wire-vs-delete fx "win" branch & audio.prime; gate debug globals;
  snapshot completeness vs lockstep-only netcode (applySnapshot fabricates enemy dynamics).

## 2026-08-16 — Initialized opencode for rollblock
- Added `opencode.json` (schema + `instructions` + `permission`) and `AGENTS.md`
   (architecture, commands, conventions).
- Established this episodic-memory convention; agents must append here after
  any non-trivial change.

## 2026-08-16 — git baseline commit
- `git init` + `.gitignore` (ignores `.DS_Store`, `node_modules/`, the two
  unreferenced ~5.6MB `Gemini_Generated_Image_*.jpeg` moodboard assets, logs/.env).
- Committed baseline `d3975af`: full deterministic single-player sim + procedural
  render + netcode seam, 16/16 tests passing. Not yet a remote/VCS-tracked branch.

## 2026-08-16 — 2D→3D direction-set (research team, 4 agents)
- Ran a parallel research team (engine landscape / determinism-netcode / architecture-preserving migration / scope-perf-assets). Consensus: "need a heavy engine" is the wrong instinct — the decoupled deterministic `src/core` makes 3D a *renderer* change; a heavy engine (Three/Babylon/WebGPU) buys zero determinism value and breaks the zero-dep + no-build invariants.
- DECISION (user): (1) keep zero-dependency — no Three.js, no build; (2) target option (b) **pseudo-3D dimetric** — tilt camera ~30°, extrude bricks/walls to depth-sorted blocks on Canvas-2D. Touches NO sim/protocol code; all 16 tests stay green. Deferred: option (c) full 3D arena (forces sim+protocol changes; big swing).
- Determinism rule locked: all spatial/visual math stays in the renderer; sim collision/kill/fuse stay keyed to fixed integers; camera is a render-only input stream, never fed to `step()`. Silent-killer noted: any sim float feeding a branch/count (e.g. `board.js:78` `Math.ceil(Math.hypot(...))`) is the ULP desync risk.
- Next: design the dimetric renderer (renderer adapter + camera view + depth-sort + faux extrude/shadow). Implementation gate held pending design approval.
