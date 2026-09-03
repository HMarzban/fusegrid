# Score × heat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist CORE ×1 / PLUS ×2 / MAX ×3 on the high-score board without changing live `world.score`.

**Architecture:** `heatScore(raw, heat)` lives next to `clampHeat`. `src/main.js` applies it on every persist write and always sends `t`. Sim awards and `recordScore` stay raw stores.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, no npm runtime deps.

## Global Constraints

- Public copy never uses Bomberman.
- CORE recorded `s` equals raw `world.score`.
- Integers only: `s * (1 + clampHeat(heat))`.
- Do not multiply in `recordScore`, HUD, or `menudraw.js`.
- Do not touch award sites in `sim.js` / `entities.js` / `enemies.js`.
- Key stays `nb.highscores.v1`. No fifth column. No commit unless the user asks.

---

### Task 1: `heatScore` helper

**Files:**
- Modify: `src/core/heat.js` (after `clampHeat`)
- Test: `tests/sim.test.mjs` (already imports heat)

**Interfaces:**
- Produces: `export function heatScore(raw, heat)` → `(raw|0) * (1 + clampHeat(heat))`

- [x] **Step 1: Write the failing test**

Add to `tests/sim.test.mjs` imports: `heatScore`.

```js
check("heatScore CORE 1200 stays 1200", heatScore(1200, 0) === 1200);
check("heatScore PLUS 1200 -> 2400", heatScore(1200, 1) === 2400);
check("heatScore MAX 1200 -> 3600", heatScore(1200, 2) === 3600);
check("heatScore clamps junk heat to CORE", heatScore(1200, -3) === 1200);
check("heatScore clamps 99 heat to MAX", heatScore(1200, 99) === 3600);
```

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/sim.test.mjs`
Expected: FAIL (`heatScore` is not exported)

- [x] **Step 3: Write minimal implementation**

In `src/core/heat.js` after `clampHeat`:

```js
export function heatScore(raw, heat) {
  return (raw | 0) * (1 + clampHeat(heat));
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node tests/sim.test.mjs`
Expected: PASS on the five `heatScore` checks

- [ ] **Step 5: Commit**

Skip unless the user asks.

---

### Task 2: Persist writes use `heatScore` + `t`

**Files:**
- Modify: `src/main.js` (`persistScore` ~303, `noteWorldEdge` payload ~617)
- Test: `tests/headless.test.mjs` (Menu persist ~470)

**Interfaces:**
- Consumes: `heatScore` from `./core/heat.js`
- Produces: every persist row `{ s: heatScore(world.score, world.heat), l, d, t: world.heat|0 }`

- [x] **Step 1: Write the failing test**

Keep CORE Menu persist `r.s===1234`. After that block, add:

```js
g.world.score = 1234;
g.world.heat = 2;
delete mem["nb.highscores.v1"];
dispatch(stubs.btnMenu);
check(
  "menu-btn MAX persist stores s*3 and t=2",
  loadScores().some((r) => r.s === 3702 && r.t === 2 && r.l === 1),
  JSON.stringify(loadScores().slice(0, 3)),
);
```

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/headless.test.mjs`
Expected: FAIL (MAX row stored as 1234 with no `t`)

- [x] **Step 3: Write minimal implementation**

`src/main.js` import `heatScore`. Change `persistScore` and the GAME-loop entry to:

```js
{
  s: heatScore(world.score, world.heat),
  l: world.level,
  d: dateStr(),
  t: world.heat | 0,
}
```

- [x] **Step 4: Run tests**

Run: `node tests/headless.test.mjs && node tests/highscores.test.mjs && node tests/sim.test.mjs`
Expected: PASS. `recordScore` still stores what it is given.

- [ ] **Step 5: Commit**

Skip unless the user asks.
