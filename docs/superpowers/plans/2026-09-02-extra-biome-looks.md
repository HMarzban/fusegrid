# Extra biome looks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rooms 6–8 get unique palettes (SAND / VOID / CROWN). Rooms 1–5 and music stay as they are.

**Architecture:** Append three `BIOMES` rows. Leave `biomeOf` as `% BIOMES.length`. Do not add tracks.

**Tech Stack:** Frozen `BIOMES` in `src/core/config.js`. No npm deps.

## Global Constraints

- Public copy never uses Bomberman.
- Entries 0–4 stay byte-identical.
- `hWall` ≤ ICE 36.
- Fat-world draw calls stay 186.
- `musicCue` stays `% 5`.
- No commit unless the user asks.

---

### Task 1: Pin 1–5 + unique 6–8

**Files:**
- Modify: `src/core/config.js` (`BIOMES`)
- Test: `tests/headless.test.mjs`

- [ ] **Step 1: Write the failing test**

Replace the `BIOMES.length===5` pin with:

```js
check("rooms 1-5 stay JUNGLE ICE FACTORY WATER ARENA",
  BIOMES.slice(0,5).map(b=>b.name).join()==="JUNGLE,ICE,FACTORY,WATER,ARENA"
  && biomeOf(1).name!==biomeOf(5).name
  && biomeOf(1).brickA==="#42f024" && biomeOf(2).hWall===36);
check("rooms 6-8 unique palettes SAND VOID CROWN",
  BIOMES.length===8
  && biomeOf(6).name==="SAND" && biomeOf(7).name==="VOID" && biomeOf(8).name==="CROWN"
  && biomeOf(6).name!==biomeOf(1).name
  && biomeOf(6).hWall<=36 && biomeOf(7).hWall<=36 && biomeOf(8).hWall<=36);
```

- [x] **Step 2: Run `node tests/headless.test.mjs`** — FAIL on length 8

- [x] **Step 3: Append three palette rows** (same field bag, `hWall` ≤ 36)

- [x] **Step 4: Run headless + `tests/three.test.mjs` + `tests/music.test.mjs`** — PASS, 186 unchanged, cues 1–5 unchanged

- [ ] **Step 5: Commit** — skip unless asked
