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
