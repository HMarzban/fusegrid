# Attract Starts a Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tap or confirm on ATTRACT starts a CORE room-1 run; Escape still returns to MENU.

**Architecture:** New `playFromAttract()` on the shell. `exitAttract()` stays MENU-only (Escape + P2 veil). Pointer / confirm / non-Escape keys call play. `onStart` already loads the live world — reuse it with forced CORE args so LEVEL SELECT picks survive.

**Tech Stack:** Pure ES modules, `node --test`, no DOM in `menuapp.js`.

## Global Constraints

- Attract demo world stays CORE / pact=0 / seed 20260823.
- `playFromAttract` must not write `app.level`, `app.heat`, or `app.pact`.
- No new `SCREEN`. Idle `IDLE_T=10` unchanged.
- Public copy: `DEMO — TAP TO PLAY`. Never the other grid-bomb franchise.

---

### Task 1: Shell — playFromAttract

**Files:**
- Modify: `src/app/menuapp.js` (`exitAttract` ~314, `confirm` ~188, `key` ~129)
- Test: `tests/menuapp.test.mjs` (ATTRACT block ~778)

**Interfaces:**
- Consumes: `onStart`, `SCREEN.ATTRACT`, `SCREEN.GAME`, `this.pace`
- Produces: `playFromAttract()` → `false` or `{level:1,heat:0,pact:0,pace:number}`

- [ ] **Step 1: Write the failing tests** (in the existing ATTRACT block)

```js
{
  const started = [];
  const a = createMenuApp({
    onStart: (args) => started.push(args),
  });
  a.screen = SCREEN.MENU;
  a.level = 4;
  a.heat = 2;
  a.pact = 1;
  a.pace = 1;
  a.cursor = 3;
  a.enterAttract();
  const args = a.playFromAttract();
  check(
    "playFromAttract starts CORE L1 and keeps LEVEL SELECT picks",
    a.screen === SCREEN.GAME &&
      a.inGame === true &&
      args.level === 1 &&
      args.heat === 0 &&
      args.pact === 0 &&
      args.pace === 1 &&
      a.level === 4 &&
      a.heat === 2 &&
      a.pact === 1 &&
      started.length === 1,
    JSON.stringify(args) + " heat=" + a.heat,
  );
  const b = createMenuApp();
  check(
    "playFromAttract outside ATTRACT is false",
    b.playFromAttract() === false && b.screen === SCREEN.INTRO,
  );
  const c = createMenuApp({ onStart: (args) => started.push(args) });
  c.enterAttract();
  check(
    "Escape still exits to MENU (no run)",
    c.key("Escape") === true &&
      c.screen === SCREEN.MENU &&
      started.length === 1,
  );
  c.enterAttract();
  check(
    "confirm on ATTRACT plays",
    c.confirm() && c.screen === SCREEN.GAME,
  );
}
```

Replace the old pins that now lie:

- `"key(any code incl KeyM) exits to MENU"` → KeyM from ATTRACT plays (spec: most keys play).
- `"confirm() exits ATTRACT (pointer path…)"` → `confirm()` → GAME.

Keep: axes ignored, `exitAttract()` no-op outside ATTRACT, idle re-entry after **Escape**.

- [ ] **Step 2: Run to verify fail**

```bash
node --test tests/menuapp.test.mjs
```

Expected: FAIL — `playFromAttract` is not a function / confirm still MENU.

- [ ] **Step 3: Implement**

Add on the app object, after `exitAttract`:

```js
playFromAttract() {
  if (this.screen !== SCREEN.ATTRACT) return false;
  const args = {
    level: 1,
    heat: 0,
    pact: 0,
    pace: this.pace | 0,
  };
  this.screen = SCREEN.GAME;
  this.inGame = true;
  this.subT = 0;
  this.repT = 0;
  this.repDir = 0;
  this._hot = false;
  this._taps = {};
  this.togT = -1;
  this.idleT = 0;
  if (onStart) onStart(args);
  return args;
},
```

Leave `exitAttract()` as MENU.

`key` ATTRACT branch (top of `key`):

```js
if (this.screen === SCREEN.ATTRACT) {
  if (code === "Escape" || code === "Backspace") return this.exitAttract();
  return this.playFromAttract();
}
```

`confirm` ATTRACT branch:

```js
if (this.screen === SCREEN.ATTRACT) return this.playFromAttract();
```

Do **not** call `startRun()` here — that would use `this.level` / `this.heat`.

- [ ] **Step 4: Run menuapp tests — PASS**

```bash
node --test tests/menuapp.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add src/app/menuapp.js tests/menuapp.test.mjs
git commit -m "$(cat <<'EOF'
Start a CORE run from the attract demo instead of dumping back to MENU.

Escape still leaves the demo so the skip-fade path stays.
EOF
)"
```

---

### Task 2: Browser wiring + hint

**Files:**
- Modify: `src/main.js` (~269, ~286) — pointer / stage currently call `exitAttract()`
- Modify: `src/render/menudraw.js` `drawAttractHint` (~692)
- Test: `tests/headless.test.mjs` (~287–291), `tests/menudraw.test.mjs`

**Interfaces:**
- Consumes: `app.playFromAttract`, `app.exitAttract`
- Produces: canvas/stage pointer → play; Escape-only MENU

- [ ] **Step 1: Failing headless pins**

Replace `attract: any key exits instantly to MENU` with two checks:

```js
g.app.cursor=4;
const esc=g.app.key("Escape");
check("attract: Escape exits to MENU", esc===true && g.app.screen===SCREEN.MENU);
for(let i=0;i<640;i++){ t+=16; g.loop(t); }
check("attract: re-entered after Escape", g.app.screen===SCREEN.ATTRACT);
const play=g.app.key("Enter");
check("attract: Enter starts a CORE run",
  play && g.app.screen===SCREEN.GAME
  && g.world.level===1 && (g.world.heat|0)===0 && (g.world.pact|0)===0
  && g.world.state==="PLAY" && g.app.cursor===4);
```

P2 block (`g.app.key("Escape")`) stays — still MENU + veil.

Add in `tests/menudraw.test.mjs`:

```js
check("attract hint says TAP TO PLAY", /* fillText dump */ texts.some((t) => t.includes("TAP TO PLAY")));
```

- [ ] **Step 2: Run — expect FAIL on Enter → MENU / old hint**

```bash
node --test tests/headless.test.mjs tests/menudraw.test.mjs
```

- [ ] **Step 3: Wire main + copy**

`src/main.js` canvas pointer and `#stage` pointer: `app.playFromAttract()` instead of `exitAttract()`.

`drawAttractHint` fillText: `"DEMO — TAP TO PLAY"`. Widen pill `w` 220 → 240 if it clips.

Toolbar buttons stay unlock-only (do not play).

- [ ] **Step 4: Related suite PASS**

```bash
node --test tests/menuapp.test.mjs tests/headless.test.mjs tests/menudraw.test.mjs
```

Headed: idle 10s → demo → tap → CORE L1; Esc from demo → MENU + veil; LEVEL SELECT heat still MAX after the run if it was MAX.

- [ ] **Step 5: PWA v20 → v21 (`menudraw.js` + `main.js` + `menuapp.js` are precached), MEMORY, commit**
