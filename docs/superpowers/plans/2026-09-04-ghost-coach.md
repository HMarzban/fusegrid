# Ghost Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First unseen GAME shows ~3s ghost WASD + SPACE on the board, then never again.

**Architecture:** Persist + pure phase in `src/app/coach.js` (same shape as `pacestore.js`). Draw via `drawCoach` on the GAME PLAY overlay. Dismiss on first plant event or `world.time >= 3`. No `SCREEN`. Sim / AI untouched.

**Tech Stack:** Pure ES modules, `node --test`. Headed play-verify once.

## Global Constraints

- `COACH_DUR = 3`. Persist key `nb.coach.v1`, value `"1"`.
- `?play=1` still shows the coach if unseen.
- Attract / MENU / HOW TO unchanged.
- Art only — do not retune plant-and-leave, heat, or enemy AI.

---

### Task 1: coach module (TDD)

**Files:**
- Create: `src/app/coach.js`
- Test: `tests/coach.test.mjs`
- Modify: `src/pwa/shell.js` SRC list

**Interfaces:**
- `COACH_KEY = "nb.coach.v1"`
- `COACH_DUR = 3`
- `loadCoachSeen(store) → boolean`
- `saveCoachSeen(store) → void`
- `coachOpen(seen, time, planted) → boolean`

- [ ] **Step 1: Failing tests**

```js
import {
  COACH_DUR,
  loadCoachSeen,
  saveCoachSeen,
  coachOpen,
} from "../src/app/coach.js";

const mem = new Map();
const store = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
};

check("unseen store is false", loadCoachSeen(store) === false);
check("open at t=0", coachOpen(false, 0, false) === true);
check("closed after DUR", coachOpen(false, COACH_DUR, false) === false);
check("closed after plant", coachOpen(false, 0.4, true) === false);
check("seen never opens", coachOpen(true, 0, false) === false);
saveCoachSeen(store);
check("round-trip", loadCoachSeen(store) === true);
```

- [ ] **Step 2:** `node --test tests/coach.test.mjs` — FAIL
- [ ] **Step 3:** Mirror `src/app/pacestore.js` (`getItem === "1"`)
- [ ] **Step 4: PASS + add path to `SRC` in `shell.js`**
- [ ] **Step 5: Commit**

---

### Task 2: Draw + dismiss

**Files:**
- Modify: `src/render/scenes.js` — `drawCoach(c, world, open)`
- Modify: `src/main.js` — latch plant from `world.events` (grep the real tag first; expected `t==="bomb"` or plant)
- Modify: GAME PLAY draw path to call `drawCoach` when `coachOpen(...)`

```js
if (world.events.some((e) => e.t === "bomb")) coachPlanted = true;
if (coachShown && !coachOpen(coachSeen, world.time, coachPlanted)) {
  saveCoachSeen();
  coachSeen = true;
}
```

`drawCoach`: faded W A S D near spawn (1,1) + SPACE pill. Alpha `1 - time/COACH_DUR`. Inside the 15×13 board. No `c.scale` if you add a bounds pin.

- [ ] **Step 1:** Pin fillText includes `W` and `SPACE` when open; silent when `open===false`
- [ ] **Step 2: FAIL**
- [ ] **Step 3: Draw + wire**
- [ ] **Step 4:** `node --test tests/coach.test.mjs tests/pwa.test.mjs tests/headless.test.mjs`
- [ ] **Step 5:** PWA bump, MEMORY, commit

Headed: wipe `nb.coach.v1`, START, ghosts, plant, gone; second run, none.
