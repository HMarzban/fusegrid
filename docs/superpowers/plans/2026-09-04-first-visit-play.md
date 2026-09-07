# First-Visit Play Now Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A brand-new player’s first gesture on INTRO starts CORE room 1. Returning players still get the cabinet MENU.

**Architecture:** Persist `nb.cabinet.v1`. Unseen = INTRO confirm/skip uses the same CORE handoff as `playFromAttract`. Seen (or pact-unlock) = today’s MENU. **Requires plan 1.** Extract `coreHandoff()` if the two paths would duplicate.

**Tech Stack:** Pure ES modules, `node --test`.

## Global Constraints

- After attract-starts-run only.
- Do not delete INTRO art. The gesture is the start.
- Veterans: `nb.cabinet.v1==="1"` or `loadPactUnlocked()`. Default score rows do not count as played.
- No portal SDK. No new `SCREEN`.

---

### Task 1: cabinetseen + skip branch

**Files:**
- Create: `src/app/cabinetseen.js` (`CABINET_KEY="nb.cabinet.v1"`)
- Modify: `src/app/menuapp.js` INTRO `skip` / `confirm`
- Modify: `src/main.js` — pass `cabinetSeen` / `markCabinet`
- Test: `tests/cabinetseen.test.mjs`, `tests/menuapp.test.mjs`, `tests/headless.test.mjs`
- Modify: `src/pwa/shell.js` SRC

```js
bootFromIntro() {
  if (this.screen !== SCREEN.INTRO) return false;
  if (o.cabinetSeen) return this._push(SCREEN.MENU);
  const args = { level: 1, heat: 0, pact: 0, pace: this.pace | 0 };
  this.screen = SCREEN.GAME;
  this.inGame = true;
  if (o.markCabinet) o.markCabinet();
  if (onStart) onStart(args);
  return args;
}
```

INTRO `skip()` and `confirm()` both call `bootFromIntro()`. Watching the full 5s then auto-skip also starts for first-timers (portal rule).

- [ ] **Step 1:** unseen INTRO Enter → GAME CORE; seen INTRO Enter → MENU
- [ ] **Step 2: FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4:** `node --test tests/cabinetseen.test.mjs tests/menuapp.test.mjs tests/headless.test.mjs`
- [ ] **Step 5:** PWA bump, MEMORY, commit

Headed: wipe site data, tap intro → JUNGLE CORE; reload, tap intro → MENU.
