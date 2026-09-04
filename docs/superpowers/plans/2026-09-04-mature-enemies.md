# Mature Enemies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mature redraw of the six Fusegrid foes plus one exclusive new body on rooms 6, 7, and 8, without changing CORE v6 rooms 1–5 spawn lists.

**Architecture:** Catalog + spawn + roster first (`FOES`, `spawnEnemy`, `heatRoster`). Hunt is a spawn flag (`e.hunt`) so `updateEnemies` does not grow a type list. Canvas `drawEnemyBody` is the identity source; ENEMIES and 3D face planes reuse it / matching visor paints. 3D keeps the 4-mesh enemy slot and 186 fat-world pin.

**Tech Stack:** Pure ES modules, Node `--test` / `tests/*.test.mjs`, Canvas 2D, vendored Three.js r160. Zero npm runtime deps.

## Global Constraints

- CORE / PLUS / MAX `heatRoster` strings for rooms 1–5 stay bit-identical.
- Attract is CORE / pact=0.
- Do not retune wander / still / chase / phase algorithms; only add `e.hunt` and new spawn rows.
- `SLOT_MESH.enemy === 4`; fat-world draw calls === 186; do not silently flex original-six child-index pins.
- Unique 3D pickup `ITEM_GEO` stays; do not revert cabinet rest HOW TO / HUD / bombs.
- Frozen 3D rig `{az:0, el:0.419, dist:1000}`. No per-biome cameras.
- Zero npm runtime deps. Never Bomberman on public surfaces.
- PWA: bump `CACHE_NAME` and `sw.js` REV together when shipped bytes change.

---

### Task 1: Roster + catalog (TDD)

**Files:**
- Modify: `tests/heat.test.mjs`, `tests/enemies-art.test.mjs`, `tests/sim.test.mjs`
- Modify: `src/core/heat.js`, `src/core/entities.js`, `src/ai/enemies.js`, `src/core/sim.js`

**Interfaces:**
- Consumes: existing `heatRoster(level, heat)`, `spawnEnemy(type, x, y, level, rng, opts)`, `FOES`
- Produces: `ROOM_EXTRA = ["burrow","shade","knight"]`; `FOES.length === 9`; `e.hunt` on chaser/fast/knight; `e.pass` on shade; scores burrow 150 / shade 250 / knight 200

- [ ] **Step 1: Write the failing tests**

Update R22 so L6 includes `burrow` (not +1 fast), L7 `shade`, L8 `knight`, and L1–5 CORE strings stay. Expand FOES catalog to 9 named types. Keep seed-42 L1 AI pin.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/heat.test.mjs && node tests/enemies-art.test.mjs && node tests/sim.test.mjs`

Expected: FAIL on L6 extra-fast / FOES.length === 6

- [ ] **Step 3: Minimal catalog + roster + hunt flag**

`ROOM_EXTRA` → burrow/shade/knight. Add three `FOES` rows and `spawnEnemy` specs. Set `hunt` for chaser/fast/knight. AI uses `e.hunt`. `killEnemy` scoring as spec.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/heat.test.mjs && node --test tests/sim.test.mjs && node tests/enemies-art.test.mjs`

Expected: heat + sim catalog green; art still fails on 6-name list until Task 2 updates that file’s NAMES (do that in the same edit as Step 1).

---

### Task 2: Mature 2D bodies + kill tints

**Files:**
- Modify: `src/render/sprites.js` (`drawEnemyBody`)
- Modify: `src/audio/foe.js`
- Modify: `src/render/menudraw.js` (`drawEnemiesHelp` 3 columns)
- Modify: `tests/enemies-art.test.mjs`, `tests/menudraw.test.mjs`

**Interfaces:**
- Consumes: `FOES[].t/col/name/rooms/help`
- Produces: pairwise-distinct `drawEnemyBody` ops; `FOE_CUE` for 9 types with unique `f0`; ENEMIES lists WALKER…KNIGHT

- [ ] **Step 1: Extend art/menu tests for 9 distinct mature silhouettes**
- [ ] **Step 2: Run to verify fail**
- [ ] **Step 3: Redraw `drawEnemyBody` (no cute eyes); add three FOE cues; 3-col ENEMIES**
- [ ] **Step 4: Run art + menudraw + heat tests green**

---

### Task 3: 3D types + visor faces

**Files:**
- Modify: `src/render/three/entities.js` (`ENEMY_TYPES`, GEO/GD/BOB for burrow/shade/knight)
- Modify: `src/render/three/textures.js` (`paintEyes` → visor/lens)
- Modify: `tests/three.test.mjs` (eye-strip ABI only; keep original-six geo/child pins)

**Interfaces:**
- Consumes: `spawnEnemy` proto colors/radii
- Produces: 9 `ENEMY_TYPES`; still 4 meshes/slot; 186 draws

- [ ] **Step 1: Update eye-strip test from “4 ellipses” to visor/lens ops; add 3-type geo smoke**
- [ ] **Step 2: Run `node tests/three.test.mjs` to verify the eye ABI fails**
- [ ] **Step 3: Add 3D caches + rewrite `paintEyes`; do not touch `ITEM_GEO` or slot counts**
- [ ] **Step 4: three + enemies-art fat-world 186 green**

---

### Task 4: Docs, PWA, full loop, ship

**Files:**
- Modify: `AGENTS.md`, `MEMORY.md`, `src/pwa/shell.js`, `sw.js`

- [ ] Bump `CACHE_NAME` / `REV` to `fusegrid-shell-v8`
- [ ] AGENTS: ENEMIES / `drawEnemyBody` now visor/drone/wraith + L6–8 exclusives
- [ ] MEMORY: dated 1–2 line entry
- [ ] `npm test` full suite
- [ ] Browser: ENEMIES plate + a room-6 body
- [ ] Commit + push (HEREDOC). No force-push. No `.cursor/`.
