# HIGH SCORES by Heat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SCORES tabs CORE / PLUS / MAX so a MAX clear is not buried under CORE padding.

**Architecture:** Persist list unchanged (`nb.highscores.v1`, still 10 rows global). Filter at draw time. `app.scoreHeat` is display-only (`clampHeat`), cycled with `←/→` on SCORES — same axis as LEVEL room, not a new SCREEN.

**Tech Stack:** Pure ES modules, `node --test`.

## Global Constraints

- Do not change `recordScore` sort or the 10-row cap.
- CORE tab includes legacy rows with missing `t` (DEFAULT_SCORES).
- Foot: `← → HEAT · ESC BACK`. Plate still fits 600×520 and 608×352.
- No online boards.

---

### Task 1: scoresForHeat

**Files:**
- Modify: `src/app/highscores.js`
- Test: `tests/highscores.test.mjs`

**Interfaces:**
- Consumes: `clampHeat`, list of `{s,l,d,t?,p?}`
- Produces: `scoresForHeat(list, heat) → array`

- [ ] **Step 1: Failing tests**

```js
import { scoresForHeat, DEFAULT_SCORES } from "../src/app/highscores.js";

check(
  "CORE tab includes rows with no t",
  scoresForHeat(DEFAULT_SCORES, 0).length === DEFAULT_SCORES.length,
);
const mixed = [
  { s: 100, l: 1, d: "2026-09-04" },
  { s: 200, l: 2, d: "2026-09-04", t: 1 },
  { s: 300, l: 3, d: "2026-09-04", t: 2 },
];
check("PLUS tab is only t===1", scoresForHeat(mixed, 1).map((r) => r.s).join() === "200");
check("MAX tab is only t===2", scoresForHeat(mixed, 2).map((r) => r.s).join() === "300");
check("empty PLUS is empty array", scoresForHeat(DEFAULT_SCORES, 1).length === 0);
```

- [ ] **Step 2:** `node --test tests/highscores.test.mjs` — FAIL
- [ ] **Step 3:**

```js
export function scoresForHeat(list, heat) {
  const h = clampHeat(heat);
  const rows = Array.isArray(list) ? list : [];
  return rows.filter((r) => (r.t | 0) === h);
}
```

- [ ] **Step 4: PASS + commit**

---

### Task 2: Shell + plate

**Files:**
- Modify: `src/app/menuapp.js` — `scoreHeat: 0`; `move` + `_tapMove` on SCORES
- Modify: `src/render/menudraw.js` `drawScores(c, scores, L, t, heat)`
- Modify: scores caller in `shellview.js` / menudraw router
- Test: `tests/menuapp.test.mjs`, `tests/menudraw.test.mjs`

**Interfaces:**
- Consumes: `scoresForHeat`, `HEAT_NAME`, `HEAT_COL`
- Produces: `app.scoreHeat` 0..2; filtered table; empty `NO PLUS RUNS YET`

- [ ] **Step 1: Failing shell tests**

```js
const a = createMenuApp();
a.screen = SCREEN.SCORES;
check("scoreHeat defaults CORE", (a.scoreHeat | 0) === 0);
check("SCORES right heats PLUS", a.move(1, 0) === true && a.scoreHeat === 1);
check("SCORES right again MAX", a.move(1, 0) && a.scoreHeat === 2);
check("SCORES right sticks at MAX", a.move(1, 0) === false && a.scoreHeat === 2);
check("SCORES left back to PLUS", a.move(-1, 0) && a.scoreHeat === 1);
a.screen = SCREEN.MENU;
check("MENU left/right do not touch scoreHeat", a.move(1, 0) === false && a.scoreHeat === 1);
```

`_tapMove`: if SCORES and `lat`, `move(dir, 0)`. `move`: if SCORES and axis 0, `clampHeat(scoreHeat + dir)`.

- [ ] **Step 2: FAIL**
- [ ] **Step 3: Draw tabs + `scoresForHeat`; foot `← → HEAT · ESC BACK`; keep chrome-fit 608×352 and 600×520**
- [ ] **Step 4:** `node --test tests/highscores.test.mjs tests/menuapp.test.mjs tests/menudraw.test.mjs`
- [ ] **Step 5:** PWA bump, MEMORY, commit

Headed: PLUS run → HIGH SCORES → `→` PLUS tab shows it; CORE still has defaults.
