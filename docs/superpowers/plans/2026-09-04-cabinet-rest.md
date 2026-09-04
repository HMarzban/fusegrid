# Cabinet Rest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HOW TO, HUD chips, and planted bombs share the ITEMS `drawIcon` family without changing sim rules or the 186 draw-call ABI.

**Architecture:** Reuse `drawIcon` / POWER colors in `drawHowTo` and `drawHudChips`. Restyle `drawBombBody` to the BOMB pickup silhouette (dark charge, curved fuse, + pip). 3D bomb slot stays 5 children.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, no npm runtime deps.

## Global Constraints

- Public copy never uses Bomberman.
- Do not change plant / kick / throw / remote / `applyPower` / enemy AI.
- Plate fit: HOW TO still inside 600×520 and 608×352.
- Fat-world draw calls === 186. `SLOT_MESH.bomb === 5`.
- Kind `"2d"` must not import three.
- Do not start unique 3D pickup/foe meshes until this plan is green.

---

### Task 1: HOW TO catalog glyphs

**Files:**
- Modify: `tests/menudraw.test.mjs` (chrome-fit loop)
- Modify: `src/render/menudraw.js` `drawHowTo`

**Interfaces:**
- Consumes: `drawIcon`, `POWER[].t` / `name` / `col`
- Produces: HOW TO texts BOMB / THROW / REMOTE / KICK + `quadraticCurveTo`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run it — expect FAIL (HOW TO still says lowercase bomb)**
- [ ] **Step 3: `drawHowTo` wells + catalog names**
- [ ] **Step 4: Run menudraw tests — PASS**

### Task 2: HUD chip tints

**Files:**
- Modify: `tests/three.test.mjs` S4.D
- Modify: `src/render/scenes.js` `drawHudChips`

**Interfaces:**
- Consumes: `drawIcon("bomb"|"fire"|"heart")`
- Produces: fillStyles `#ff5d73` / `#ff8a3c` / `#ff3b5c`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run it — expect FAIL (BOMB chip is `#ffd447`)**
- [ ] **Step 3: Retint BOMB chip to POWER rose**
- [ ] **Step 4: Run three S4.D — PASS**

### Task 3: Planted bomb family

**Files:**
- Modify: `tests/pickups.test.mjs`
- Modify: `src/render/sprites.js` `drawBombBody`

**Interfaces:**
- Consumes: `CFG.TILE`, `world.time`, `world.fuse`, `bm.variant`
- Produces: `quadraticCurveTo` fuse + + pip; no chimney `fillRect`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run it — expect FAIL (chimney fillRect, no quad fuse)**
- [ ] **Step 3: Restyle `drawBombBody`**
- [ ] **Step 4: Full `tests/*.test.mjs` — PASS**
- [ ] **Step 5: PWA v6 → v7, MEMORY, commit, push**
