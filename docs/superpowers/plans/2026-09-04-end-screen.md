# Honest End Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WIN/LOSE/PAUSE overlays speak SPACE/TAP, quote a copyable run stamp, and stop calling a full credit reset “retry”.

**Architecture:** Pure helpers next to `winHeadline` in `scenes.js`. Sim FIRE edges unchanged: mid-WIN advances, finale WIN → MENU, LOSE `startGame` → room 1 score 0. Clipboard is app-layer (`KeyC` in `main.js`) so `src/core` stays DOM-free.

**Tech Stack:** Pure ES modules, `node --test`. No clipboard in Node tests — pin the string only.

## Global Constraints

- Overlay stamp uses **raw** `world.score`, not `heatScore`.
- Do not change `startGame` / WIN / LOSE in `sim.js`.
- No new `SCREEN`. No “FIRE” in player-facing overlay copy.
- Play URL in the copied line: `https://hmarzban.github.io/fusegrid/` (trailing slash).

---

### Task 1: overlayCue + runStamp

**Files:**
- Modify: `src/render/scenes.js` (`drawOverlay` ~68–92)
- Test: `tests/heat.test.mjs` (already imports `winHeadline`)

**Interfaces:**
- Consumes: `isFinale`, `biomeOf`, `HEAT_NAME`, `clampHeat`, `world.{state,level,heat,score,finale}`
- Produces: `overlayCue(world) → string`; `runStamp(world) → "L3 FACTORY · PLUS · 1840"`

- [ ] **Step 1: Failing tests**

```js
import { overlayCue, runStamp } from "../src/render/scenes.js";

check(
  "overlayCue WIN mid",
  overlayCue({ state: "WIN", level: 3, finale: false, score: 10, heat: 0 }) ===
    "SPACE / TAP · next room",
);
check(
  "overlayCue WIN finale",
  overlayCue({ state: "WIN", level: 5, finale: false, score: 10, heat: 1 }) ===
    "SPACE / TAP · menu",
);
check(
  "overlayCue LOSE",
  overlayCue({ state: "LOSE", level: 4, score: 99, heat: 2 }) ===
    "SPACE / TAP · new run",
);
check(
  "overlayCue PAUSE names quit",
  overlayCue({ state: "PAUSE", heat: 1 }).includes("M / MENU"),
);
check(
  "runStamp is raw score + biome + heat",
  runStamp({ level: 3, heat: 1, score: 1840 }) === "L3 FACTORY · PLUS · 1840",
);
check(
  "runStamp CORE",
  runStamp({ level: 1, heat: 0, score: 0 }) === "L1 JUNGLE · CORE · 0",
);
```

- [ ] **Step 2:** `node --test tests/heat.test.mjs` — FAIL (exports missing)
- [ ] **Step 3: Implement**

```js
import { CFG, isFinale, biomeOf } from "../core/config.js";
import { HEAT_NAME, clampHeat } from "../core/heat.js";

export function overlayCue(world) {
  if (world.state === "WIN") {
    const fin = isFinale(world.level) || world.finale;
    return fin ? "SPACE / TAP · menu" : "SPACE / TAP · next room";
  }
  if (world.state === "LOSE") return "SPACE / TAP · new run";
  if (world.state === "PAUSE") return "P · resume · M / MENU · quit";
  return "";
}

export function runStamp(world) {
  const lv = world.level | 0;
  const bio = biomeOf(lv).name;
  const heat = HEAT_NAME[clampHeat(world.heat)];
  return "L" + lv + " " + bio + " · " + heat + " · " + (world.score | 0);
}

export function copyPayload(world) {
  return runStamp(world) + " https://hmarzban.github.io/fusegrid/";
}
```

`drawOverlay` WIN/LOSE: stamp at `cy+20`, cue + ` · C copy` at `cy+44` (extend `sub` with a `dy` arg). PAUSE: one line `overlayCue`. Delete the dead `world.state==="MENU"` overlay branch.

- [ ] **Step 4:** `node --test tests/heat.test.mjs tests/r3d.test.mjs` PASS
- [ ] **Step 5: Commit**

---

### Task 2: KeyC copy

**Files:**
- Modify: `src/main.js` `input.onUiKey`
- Test: pin `copyPayload` in `tests/heat.test.mjs`

```js
if (code === "KeyC" && app.screen === SCREEN.GAME) {
  if (world.state === "WIN" || world.state === "LOSE") {
    const t = copyPayload(world);
    if (typeof navigator !== "undefined" && navigator.clipboard)
      navigator.clipboard.writeText(t).catch(() => {});
  }
  return;
}
```

- [ ] **Step 1–4:** test + implement + `node --test tests/heat.test.mjs tests/headless.test.mjs`
- [ ] **Step 5:** PWA bump, MEMORY, commit

Headed: die → stamp visible → C → paste includes the Pages URL with slash.
