# Local Plaques Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four local cabinet plaques on HIGH SCORES — first CLEAR, PLUS, MAX, CROWN — with no login API.

**Architecture:** Bitmask persist `nb.plaques.v1` (same helper shape as `pactstore.js`). Unlock on existing app edges (finale persist, heat of the finishing world, L8). Paint chips on the SCORES plate under the heat tabs. Needs scores-by-heat (plan 3) for plate space.

**Tech Stack:** Pure ES modules, `node --test`.

## Global Constraints

- Never unlock inside `step()`. App-layer only.
- Bits: `CLEAR=1`, `PLUS=2`, `MAX=4`, `CROWN=8`.
- No Newgrounds.io / Game Jolt. No new `SCREEN`.
- Do not add plaques for every Pact bit in this pass.

---

### Task 1: plaques module

**Files:**
- Create: `src/app/plaques.js`
- Test: `tests/plaques.test.mjs`
- Modify: `src/pwa/shell.js` SRC

**Interfaces:**
- `PLAQUE = {CLEAR:1,PLUS:2,MAX:4,CROWN:8}`
- `loadPlaques(store) → number` (0..15)
- `savePlaques(mask, store)`
- `unlockPlaques(mask, world) → number`

```js
export function unlockPlaques(mask, world) {
  let m = mask | 0;
  if (world.finale || isFinale(world.level)) m |= PLAQUE.CLEAR;
  if ((world.heat | 0) >= 1 && (world.finale || isFinale(world.level)))
    m |= PLAQUE.PLUS;
  if ((world.heat | 0) >= 2 && (world.finale || isFinale(world.level)))
    m |= PLAQUE.MAX;
  if ((world.level | 0) >= 8) m |= PLAQUE.CROWN;
  return m;
}
```

PLUS/MAX require a finale on that heat, not a mid-room death.

- [ ] **Step 1:** L5 CORE → CLEAR only; L5 PLUS → CLEAR|PLUS; L8 MAX → all four; L3 PLUS death → nothing
- [ ] **Step 2: FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: PASS + SRC**
- [ ] **Step 5: Commit**

---

### Task 2: Wire + paint

**Files:**
- Modify: `src/main.js` after persistScore / finale unlock
- Modify: `src/render/menudraw.js` `drawScores` — four chips
- Test: chrome-fit still holds

- [ ] **Step 1–5:** pin labels, implement, PWA bump, MEMORY, commit
