# S3 — Pause Menu + Chrome Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The pause overlay becomes a real RESUME / RESTART / OPTIONS / QUIT list that owns the run-time verbs, and the HTML toolbar and keyboard legend that were standing in for it go away.

**Architecture:** `world.state === "PAUSE"` **stays a world state** — the shell stays `GAME` throughout, which is what keeps the room's track playing, the HUD gate open, the touch gate honest and every `screen === SCREEN.GAME` guard true. `update(dt, input)`'s GAME branch stops early-returning unconditionally: while `PAUSE` it runs the same repeat/cursor machinery against the pause list (or S2's settings rows when `pauseView === 1`); while `PLAY` it keeps today's reset-and-return so menu repeat state can never leak into play. **OPTIONS from pause is an inline page, not a screen jump** — jumping to `SCREEN.SETTINGS` would flip `musicCue` from the room's biome track to the menu track mid-run, hide the touch pad, close the HUD gate and falsify every `screen === GAME` guard, for a page the player will close in four seconds. `pauseView = 1` swaps the overlay's contents for the same nine rows, drawn by the same `drawSettings` body: one implementation, two hosts. One exported `overlayBox(kind)` names the coordinate space and feeds both `drawOverlay` call sites and both hit tests, so list, page and tap map can never disagree by a pixel.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, Canvas 2D. Zero npm runtime deps. `src/render/` may not import `src/app/` (only `shellview.js` may), so `scenes.js` duplicates the four row labels the way `menudraw.js` duplicates `PLAQUE_NAME`.

**Spec:** `docs/superpowers/specs/2026-09-05-settings-menu-design.md`

**Index:** `docs/superpowers/plans/2026-09-05-settings-menu.md` — its **Shared interfaces** block is authoritative for every signature below.

**Depends on:** S2 (`docs/superpowers/plans/2026-09-05-options-screen.md`). The pause page hosts `drawSettings` / `settingsHit` / `optRow` / `optCycle` inline; none of them exist before S2.

## Global Constraints

- `world.state === "PAUSE"` **never becomes a `SCREEN`.** AGENTS.md: "PAUSE/WIN/LOSE stay `world.state`, not shell screens. Do not add them as `SCREEN` values."
- **OPTIONS from pause is inline.** No `_push(SCREEN.SETTINGS)` from GAME, ever.
- `pauseCursor` (0–3) and `pauseView` (0 list / 1 options) both reset to 0 on **every** `PLAY → PAUSE` edge.
- **`RESTART` persists the score first.** The toolbar's silent score loss was an accident of the button, not a decision; two adjacent rows must not have different score semantics. `persistScore()` → `loadLevel(world,1,false)` → `world.score = 0` → `state = "PLAY"`.
- **`QUIT TO MENU` is today's `KeyM` wave verbatim:** `persistScore()` → `quitToMenu("PAUSE")` → `world.state = "PLAY"`.
- `onPause` gains one guard: **when `app.pauseView === 1`, `P` / `Escape` returns to the pause list and does NOT resume.** `KeyM` keeps working from either view.
- `drawOverlay`'s `ui.view === 1` **paints the veil only and returns**, so the settings plate never lands on top of a live `PAUSED` headline. The `WIN` and `LOSE` branches are untouched — only `PAUSE` changes.
- Hit-test conversion is the `camrig.js:70-73` `ptOf` pattern — CSS `getBoundingClientRect` scale against the **overlay canvas**, never `#gl`'s Retina drawing buffer, which the wrapper owns and `sizeCanvases` must not read.
- The `#hud` strip is **kept**, gated: `hudEl.hidden = app.screen !== SCREEN.GAME` once per frame. Full opacity, not dimmed — it is DOM outside the canvas, nothing overlays it.
- The **`Source` anchor stays as a menu item** (`SOURCE`), not as page chrome — a pinned Learned Preference. The `#controls` toolbar and the `.hint` legend both go.
- **Audio unlock survives the toolbar deletion.** `src/main.js:330-337` binds `keydown` and `pointerdown` on `window` with `{once:true}`, so the first gesture anywhere in the document unlocks — canvas and `#stage` taps unlock identically. The toolbar's documented role (`main.js:314-316`) was only that it sits *outside* `#stage`, so a click there does not exit ATTRACT; it was never the unlock path.
- `#tpad` + `#tbomb` hide whenever `world.state !== "PLAY"`; `#tpause` stays. Otherwise the 128px move pad and the 72px bomb button swallow taps aimed at pause-menu rows in the same corners.
- `pwa.test.mjs:319-332` and `headless.test.mjs:730-745` (manifest, favicon, og:image, meta description, no root-absolute hrefs) must stay green with **zero edits** — the removed toolbar and hint touch none of them.
- No comments unless the file already uses explanatory block comments (its style).
- Never write the banned grid-bomb franchise name into any committed file.
- PWA: bump `CACHE_NAME` (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`) **together**, `current vN → vN+1`, in every commit here — `index.html` is precached, so its edits count. **Read the current value first.**

---

### Task 1: The pause list, its coordinate space, and the inline OPTIONS page

**Files:**
- Modify: `src/app/menuapp.js` — `PAUSE_ITEMS`, `pauseCursor` / `pauseView`, `_repeat`, `update`'s GAME branch, `move`, `_tapMove`, `confirm`, new `confirmPause` / `pauseBack` / `enterPause`
- Modify: `src/render/scenes.js` — `PROJ` import, `PAUSE_ROWS` / `PAUSE_ROW_H`, `overlayBox`, `pauseHit`, `overlayCue`'s PAUSE line, `drawOverlay`'s 7th arg + PAUSE branch
- Modify: `src/render/renderer.js:77-81`, `src/render/three/wrapper.js:136-150` — the two `drawOverlay` call sites
- Modify: `src/render/shellview.js:28-29` — the paused-OPTIONS route
- Modify: `src/main.js` — `app.update` inside the GAME branch, `onPause` guard, `onPauseCmd`, `o.pause`, the canvas `pointerdown` pause router
- Modify: `tests/heat.test.mjs` (`:64-65` + new geometry block), `tests/headless.test.mjs` (new P1 block)
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `PROJ`, `settingsHit`, `layout`, `drawSettings`, `persistScore`, `quitToMenu`
- Produces:
  - `export const PAUSE_ITEMS = Object.freeze(["RESUME","RESTART","OPTIONS","QUIT TO MENU"])`
  - `app.pauseCursor`, `app.pauseView`, `app.confirmPause()`, `app.pauseBack()`, `app.enterPause()`, `o.onPauseCmd(cmd)`
  - `export const PAUSE_ROWS`, `export const PAUSE_ROW_H = 26`
  - `export function overlayBox(kind)` → `{w, h, cx, cy}`
  - `export function pauseHit(x, y, box)` → 0..3 or -1
  - `drawOverlay(c, world, w, h, cx, cy, ui)` — `ui = {view, cursor}`, default `{view:0, cursor:0}`

- [ ] **Step 1: Write the failing tests**

In `tests/heat.test.mjs`, extend the scenes import to:

```js
import { winHeadline, overlayCue, runStamp, copyPayload, drawOverlay,
  overlayBox, pauseHit, PAUSE_ROWS, PAUSE_ROW_H } from "../src/render/scenes.js";
```

replace lines 63–66 (the `overlayCue PAUSE names quit` check) with:

```js
check(
  "overlayCue PAUSE is the pause-list cue, exactly",
  overlayCue({ state: "PAUSE", heat: 1 }) ===
    "↑↓ SELECT · ENTER CONFIRM · P RESUME · M QUIT",
  overlayCue({ state: "PAUSE", heat: 1 }),
);
```

and append before the file's summary `console.log`:

```js
// ---- pause chrome: one named box feeds both draws and both hit tests ----
{
  check(
    "PAUSE_ROWS is the four-verb list, frozen, pitch 26",
    Object.isFrozen(PAUSE_ROWS) &&
      PAUSE_ROWS.join("|") === "RESUME|RESTART|OPTIONS|QUIT TO MENU" &&
      PAUSE_ROW_H === 26,
    PAUSE_ROWS.join("|"),
  );
  const b2 = overlayBox("2d"),
    b3 = overlayBox("3d"),
    bi = overlayBox("iso");
  check(
    "overlayBox: 2d and real 3d share the 600x520 centred box",
    b2.w === 600 && b2.h === 520 && b2.cx === 300 && b2.cy === 260 &&
      JSON.stringify(b3) === JSON.stringify(b2),
    JSON.stringify(b2),
  );
  check(
    "overlayBox: iso keeps today's projected box at 304,188",
    bi.w === 608 && bi.h === 352 && bi.cx === 304 && bi.cy === 188,
    JSON.stringify(bi),
  );
  for (const B of [b2, bi]) {
    const tag = B.w + "x" + B.h;
    let all = true;
    for (let i = 0; i < 4; i++)
      if (pauseHit(B.cx, B.cy - 30 + i * PAUSE_ROW_H, B) !== i) all = false;
    check("pauseHit maps every row centre in " + tag, all);
    check(
      "pauseHit vertical band is +-13 in " + tag,
      pauseHit(B.cx, B.cy - 30 + 13, B) === 0 && pauseHit(B.cx, B.cy - 30 - 14, B) === -1,
    );
    check(
      "pauseHit horizontal band is +-130 in " + tag,
      pauseHit(B.cx + 130, B.cy - 30, B) === 0 && pauseHit(B.cx + 131, B.cy - 30, B) === -1,
    );
    check(
      "pauseHit off the rows is -1 in " + tag,
      pauseHit(B.cx, B.cy + 86, B) === -1 && pauseHit(B.cx, B.cy - 70, B) === -1,
    );
    check(
      "the whole list (cy-70 .. cy+86) clears the " + tag + " box",
      B.cy - 70 > 0 && B.cy + 86 < B.h,
      B.cy - 70 + ".." + (B.cy + 86),
    );
  }
}
{
  const texts = [];
  const c = new Proxy(function () {}, {
    get: (t, p) => {
      if (p === Symbol.toPrimitive) return () => "";
      return (...a) => {
        if (p === "fillText") texts.push(String(a[0]));
        return c;
      };
    },
    apply: () => c,
    set: () => true,
  });
  const B = overlayBox("2d");
  drawOverlay(c, { state: "PAUSE" }, B.w, B.h, B.cx, B.cy);
  check(
    "drawOverlay PAUSE defaults to the list at cursor 0",
    texts.includes("PAUSED") &&
      PAUSE_ROWS.every((r) => texts.includes(r)) &&
      texts.includes("↑↓ SELECT · ENTER CONFIRM · P RESUME · M QUIT"),
    texts.join("|"),
  );
  texts.length = 0;
  drawOverlay(c, { state: "PAUSE" }, B.w, B.h, B.cx, B.cy, { view: 1, cursor: 0 });
  check(
    "drawOverlay view 1 paints the veil only — no PAUSED under the settings plate",
    texts.length === 0,
    texts.join("|"),
  );
  texts.length = 0;
  drawOverlay(
    c,
    { state: "WIN", level: 3, finale: false, score: 10, heat: 0 },
    B.w, B.h, B.cx, B.cy,
    { view: 1, cursor: 2 },
  );
  check(
    "drawOverlay WIN/LOSE branches ignore ui entirely",
    texts.some((s) => s.indexOf("CLEARED") >= 0),
    texts.join("|"),
  );
}
```

In `tests/headless.test.mjs`, append before its summary `console.log`:

```js
// ---- P1 PAUSE list: every row's wave, and the score semantics they inherit ----
{
  const noop=()=>{};
  const mem={};
  globalThis.window={addEventListener:noop,removeEventListener:noop,
    localStorage:{getItem:(k)=>(k in mem?mem[k]:null),
      setItem:(k,v)=>{mem[k]=String(v);}}};
  try{
    {
      const g=createGame(null,{autoplay:true});
      g.input.onPause();
      check("P1 P pauses inside GAME and resets the list",
        g.world.state==="PAUSE"&&g.app.pauseCursor===0&&g.app.pauseView===0,
        g.world.state+"/"+g.app.pauseCursor+"/"+g.app.pauseView);
      check("P1 the shell stays GAME through PAUSE (music/HUD/touch gates)",
        g.app.screen===SCREEN.GAME,String(g.app.screen));
      g.loop(16);
      g.app.confirm();                        // row 0 RESUME
      check("P1 RESUME returns to PLAY",g.world.state==="PLAY",g.world.state);
    }
    {
      delete mem["nb.highscores.v1"];
      const g=createGame(null,{autoplay:true});
      g.world.score=1500; g.world.level=3;
      g.input.onPause(); g.loop(16);
      g.app.pauseCursor=1; g.app.confirm();   // RESTART
      check("P1 RESTART reloads L1 at PLAY with the score zeroed",
        g.world.level===1&&g.world.state==="PLAY"&&g.world.score===0,
        g.world.level+"/"+g.world.state+"/"+g.world.score);
      check("P1 RESTART BANKS the run first (the toolbar button lost it)",
        loadScores().some(r=>r.s===1500),
        JSON.stringify(loadScores().slice(0,3)));
    }
    {
      delete mem["nb.highscores.v1"];
      const g=createGame(null,{autoplay:true});
      g.world.score=1234;
      g.input.onPause(); g.loop(16);
      g.app.pauseCursor=3; g.app.confirm();   // QUIT TO MENU
      check("P1 QUIT lands on MENU with no PAUSE ghost",
        g.app.screen===SCREEN.MENU&&g.world.state==="PLAY",
        g.app.screen+"/"+g.world.state);
      check("P1 QUIT records the score exactly like KeyM",
        loadScores().some(r=>r.s===1234&&r.l===1),
        JSON.stringify(loadScores().slice(0,3)));
      delete mem["nb.highscores.v1"];
      const gMax=createGame(null,{autoplay:true});
      gMax.world.score=1234; gMax.world.heat=2;
      gMax.input.onPause(); gMax.loop(16);
      gMax.app.pauseCursor=3; gMax.app.confirm();
      check("P1 QUIT MAX persist stores s*3 and t=2",
        loadScores().some(r=>r.s===3702&&r.t===2&&r.l===1),
        JSON.stringify(loadScores().slice(0,3)));
    }
    {
      const g=createGame(null,{autoplay:true});
      g.input.onPause(); g.loop(16);
      g.app.pauseCursor=2; g.app.confirm();   // OPTIONS
      check("P1 OPTIONS opens inline — pauseView 1, shell still GAME",
        g.app.pauseView===1&&g.app.screen===SCREEN.GAME
        &&g.world.state==="PAUSE",
        g.app.pauseView+"/"+g.app.screen+"/"+g.world.state);
      g.app.optRow=6; g.app.confirm();
      check("P1 the paused page drives the SAME knob code",
        g.app.settings.shk===0,String(g.app.settings.shk));
      g.input.onPause();
      check("P1 P on the paused page returns to the LIST, never to play",
        g.app.pauseView===0&&g.world.state==="PAUSE",
        g.app.pauseView+"/"+g.world.state);
      g.input.onPause();
      check("P1 P on the list resumes",g.world.state==="PLAY",g.world.state);
    }
    {
      const g=createGame(null,{autoplay:true});
      g.input.onPause(); g.loop(16);
      g.input._onKey({code:"ArrowDown",preventDefault(){}});
      check("P1 ArrowDown taps down the pause list",g.app.pauseCursor===1,
        String(g.app.pauseCursor));
      g.app.pauseCursor=0;
      g.input._onKey({code:"ArrowUp",preventDefault(){}});
      check("P1 ArrowUp wraps to the last row",g.app.pauseCursor===3,
        String(g.app.pauseCursor));
      g.app.pauseView=1;
      g.input.onUiKey("KeyM");
      check("P1 KeyM quits from the OPTIONS view too",
        g.app.screen===SCREEN.MENU,String(g.app.screen));
    }
    {
      const g=createGame(null,{autoplay:true});
      g.input._onKey({code:"Space",preventDefault(){}});
      let t=0; g.loop(t); t+=20; g.loop(t);
      g.input.onPause();
      t+=20; g.loop(t);
      check("P1 a held fire across the PLAY->PAUSE edge does not confirm a row"
        +" (app.update runs every GAME frame, so prevConfirm never resets)",
        g.world.state==="PAUSE",g.world.state);
    }
   }finally{ delete globalThis.window; }
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/heat.test.mjs
node --test tests/headless.test.mjs
```

Expected: `heat.test.mjs` FAILs with `SyntaxError: The requested module '../src/render/scenes.js' does not provide an export named 'overlayBox'`; `headless.test.mjs` FAILs at `P1 P pauses inside GAME and resets the list -> PAUSE/undefined/undefined`.

- [ ] **Step 3: Implement**

**3a — `src/app/menuapp.js`.** After `OPT_ROWS` add:

```js
/* PAUSE list (spec §3). world.state stays PAUSE and the shell stays GAME —
   that is what keeps the room's track playing, the HUD gate open, the touch
   gate honest and every screen===GAME guard true. */
export const PAUSE_ITEMS = Object.freeze([
  "RESUME",
  "RESTART",
  "OPTIONS",
  "QUIT TO MENU",
]);
```

Add `const onPauseCmd = o.onPauseCmd || null;` beside the other opt handles. After `optRow: 0,` in the app literal add:

```js
    pauseCursor: 0,
    pauseView: 0, // 0 list / 1 inline OPTIONS; both reset on the PLAY->PAUSE edge
```

Replace the `SCREEN.GAME` early-return in `update()` (lines 78–84) with:

```js
      if (this.screen === SCREEN.GAME) {
        if (this.worldState === "PAUSE") {
          const ax = (input && input.input) || {};
          let dir = 0,
            axis = 1;
          if (this.pauseView === 1 && (ax.left || ax.right)) {
            dir = ax.left ? -1 : 1;
            axis = 0;
          } else dir = ax.up ? -1 : ax.down ? 1 : 0;
          this._repeat(d, dir, axis);
          if (rising) this.confirm();
          this._taps = {};
          return;
        }
        this.repT = 0;
        this.repDir = 0;
        this._hot = false;
        this._taps = {};
        return;
      }
```

Replace the inline repeat block (lines 99–122) with `this._repeat(d, dir, axis);` and add the extracted method beside `_tapMove`:

```js
    /* Shared hold-to-repeat: first move at REP_FIRST, then REP_NEXT. The
       _taps map is how key()'s discrete channel and this held-axis channel
       avoid double-moving on the same frame. */
    _repeat(d, dir, axis) {
      if (dir) {
        if (this.repDir !== dir || this.repAxis !== axis) {
          this.repDir = dir;
          this.repAxis = axis;
          this.repT = 0;
          this._hot = false;
          if (!this._taps[dir + ":" + axis]) this.move(dir, axis);
        } else {
          this.repT += d;
          let g = 0;
          while (g++ < 64) {
            const thr = this._hot ? REP_NEXT : REP_FIRST;
            if (this.repT < thr) break;
            this.move(dir, axis);
            this.repT -= thr;
            this._hot = true;
          }
        }
      } else {
        this.repDir = 0;
        this.repAxis = 0;
        this.repT = 0;
        this._hot = false;
      }
    },
```

In `_tapMove`, immediately after the INTRO line add:

```js
      if (
        this.screen === SCREEN.GAME &&
        this.worldState === "PAUSE" &&
        this.move(dir, lat ? 0 : 1)
      ) {
        this._taps[dir + ":" + (lat ? 0 : 1)] = true;
        return true;
      }
```

In `move()`, immediately after `this.idleT = 0;` add:

```js
      if (this.screen === SCREEN.GAME) {
        if (this.worldState !== "PAUSE") return false;
        if (this.pauseView === 1)
          return (axis | 0) === 1 ? this.optMove(dir) : this.optAdjust(dir);
        if ((axis | 0) !== 1) return false;
        const n = PAUSE_ITEMS.length;
        this.pauseCursor = (this.pauseCursor + (dir < 0 ? -1 : 1) + n) % n;
        return true;
      }
```

In `confirm()`'s switch, add before `case SCREEN.MENU:`:

```js
        case SCREEN.GAME:
          return this.worldState === "PAUSE" ? this.confirmPause() : false;
```

Add three methods beside `optReset`:

```js
    /* OPTIONS here is an INLINE page, not a screen jump: jumping to
       SCREEN.SETTINGS would flip musicCue from the room's biome track to the
       menu track mid-run, hide the touch pad and falsify every screen===GAME
       guard, for a page the player closes in four seconds. */
    confirmPause() {
      if (this.pauseView === 1) return this.optCycle();
      const cmd = PAUSE_ITEMS[this.pauseCursor];
      if (cmd === "OPTIONS") {
        this.pauseView = 1;
        this.optRow = 0;
        this.togT = -1;
        return true;
      }
      if (onPauseCmd) onPauseCmd(cmd);
      return true;
    },
    pauseBack() {
      if (this.pauseView !== 1) return false;
      this.pauseView = 0;
      this.togT = -1;
      return true;
    },
    enterPause() {
      this.pauseCursor = 0;
      this.pauseView = 0;
      this.togT = -1;
      return true;
    },
```

`key()`'s `Escape` branch is **unchanged** — it still returns `false` in GAME. The `pauseView` guard lives in `main.js`'s `onPause`, which `Escape` also reaches through `input.js:48`.

**3b — `src/render/scenes.js`.** Add `import { PROJ } from "./r3d/camera.js";` after line 4, and after `copyPayload` (line 54):

```js
/* Pause-list row copy mirrors src/app/menuapp.js PAUSE_ITEMS — render/ must
   not import src/app (only shellview.js may), so the labels are duplicated
   here the way menudraw's PLAQUE_NAME is. */
export const PAUSE_ROWS = Object.freeze([
  "RESUME",
  "RESTART",
  "OPTIONS",
  "QUIT TO MENU",
]);
export const PAUSE_ROW_H = 26;
/* The ONE named coordinate space for pause chrome: it feeds both drawOverlay
   call sites and both hit tests, so the list, the inline OPTIONS page and the
   tap map can never disagree by a pixel. */
export function overlayBox(kind) {
  if (kind === "iso")
    return { w: PROJ.canvasW, h: PROJ.canvasH, cx: 304, cy: 188 };
  const w = CFG.COLS * CFG.TILE,
    h = CFG.ROWS * CFG.TILE;
  return { w, h, cx: w / 2, cy: h / 2 };
}
export function pauseHit(x, y, box) {
  const B = box || overlayBox("2d");
  if (Math.abs(x - B.cx) > 130) return -1;
  for (let i = 0; i < PAUSE_ROWS.length; i++)
    if (Math.abs(y - (B.cy - 30 + i * PAUSE_ROW_H)) <= 13) return i;
  return -1;
}
```

Replace `overlayCue`'s PAUSE line (43) with:

```js
  if (world.state === "PAUSE") return "↑↓ SELECT · ENTER CONFIRM · P RESUME · M QUIT";
```

Change `drawOverlay`'s signature (55–62) to take a 7th parameter `ui = { view: 0, cursor: 0 },` and replace its PAUSE branch (89–92) with:

```js
  } else if (world.state === "PAUSE") {
    const u = ui || {};
    /* view 1 = the inline OPTIONS page: veil only, so drawShell's settings
       plate never lands on top of a live PAUSED headline. */
    if ((u.view | 0) === 1) return;
    const cur = u.cursor | 0;
    c.font = "900 40px ui-monospace,monospace";
    c.strokeText("PAUSED", cx, cy - 70);
    c.fillStyle = "#ffd447";
    c.fillText("PAUSED", cx, cy - 70);
    for (let i = 0; i < PAUSE_ROWS.length; i++) {
      const y = cy - 30 + i * PAUSE_ROW_H,
        on = i === cur;
      if (on) {
        c.fillStyle = "rgba(55,240,208,0.14)";
        c.fillRect(cx - 130, y - 13, 260, 26);
        c.fillStyle = "#37f0d0";
        c.fillRect(cx - 130, y - 13, 3, 26);
      }
      c.font = "900 " + (on ? 16 : 15) + "px ui-monospace,monospace";
      c.fillStyle = on ? "#dfe7f5" : "#7385ad";
      c.fillText(PAUSE_ROWS[i], cx, y);
    }
    sub(overlayCue(world), "#9fb3d8", 86);
  }
```

**3c — the two call sites.** In `src/render/renderer.js`, add `overlayBox` to the `./scenes.js` import (line 8) and replace lines 77–81 with:

```js
    if(world.state!=="PLAY"){
      const B=overlayBox(kind==="3d"?"iso":"2d");
      drawOverlay(ctx, world, B.w, B.h, B.cx, B.cy, o&&o.pause);
      if(world.state==="WIN"||world.state==="LOSE") drawFx(ctx);
    }
```

In `src/render/three/wrapper.js`, add `overlayBox` to the `../scenes.js` import (line 18) and replace line 147 with:

```js
      if(ov){ const B=overlayBox("3d");
        drawOverlay(ovCtx,world,B.w,B.h,B.cx,B.cy,o&&o.pause); }
```

**3d — `src/render/shellview.js`.** Add `overlayBox` to the `./scenes.js` import (line 11) and replace line 29 with:

```js
  if (s === SCREEN.BOOT) return;
  if (s === SCREEN.GAME) {
    /* All shell chrome routing stays in the one module whose job it is. The
       paused OPTIONS page measures against overlayBox — the SAME box the
       pause list uses — never dims(canvas, kind), so list and page never
       disagree by a pixel. */
    if (world.state === "PAUSE" && app.pauseView === 1) {
      const B = overlayBox(kind);
      menudraw.drawDim(c, 0.72, B.w, B.h);
      menudraw.drawSettings(c, menudraw.layout(B.w, B.h), app.subT, {
        row: app.optRow,
        vals: app.settings,
        r3d: app.render3d,
        togT: app.togT,
        rev: REV,
      });
    }
    return;
  }
```

**3e — `src/main.js`.** Extend the `./render/scenes.js` import to `import { makeHud, copyPayload, overlayBox, pauseHit } from "./render/scenes.js";`.

Call the shell machine every GAME frame, immediately after `prevSt = world.state;` in the loop's GAME branch:

```js
      /* The shell machine runs during GAME too — unconditionally, not only
         while paused. prevConfirm is only written inside update(), so skipping
         PLAY frames would leave it false and a player holding fire when they
         press P would get a rising edge (= instant RESUME) on the first paused
         frame. Placed after noteWorldEdge so the pause branch reads a fresh
         app.worldState. */
      app.update(dt, shellInput);
```

Replace `onPause` (284–295) with:

```js
  const onPause = () => {
    if (app.screen !== SCREEN.GAME) return; // I2: pause exists only inside GAME;
    // outside it the world is a frozen backdrop and PAUSE would ghost-render
    if (app.pauseView === 1) {
      app.pauseBack(); // P/Escape on the inline page backs to the LIST, never to play
      return;
    }
    if (world.state === "PLAY") {
      world.state = "PAUSE";
      app.enterPause();
    } else if (world.state === "PAUSE") world.state = "PLAY";
  };
```

Add `onPauseCmd` to the `createMenuApp({…})` options, beside `onSettings`:

```js
    onPauseCmd: (cmd) => {
      if (cmd === "RESUME") {
        world.state = "PLAY";
        return;
      }
      if (cmd === "RESTART") {
        // the toolbar button dropped the run silently; two adjacent rows must
        // not have different score semantics
        persistScore();
        loadLevel(world, 1, false);
        world.score = 0;
        world.state = "PLAY";
        world.fireEdge = true; // a held fire CONFIRMED the row; never a same-frame plant
        prevSt = "PLAY";
        coachPlanted = false;
        return;
      }
      if (cmd === "QUIT TO MENU") {
        persistScore();
        app.quitToMenu("PAUSE");
        if (world.state === "PAUSE") world.state = "PLAY";
        prevSt = null;
      }
    },
```

Add the pause state to the GAME render opts, beside `coach:`:

```js
              pause: { view: app.pauseView | 0, cursor: app.pauseCursor | 0 },
```

Replace the canvas `pointerdown` handler's opening (S2 already made it `(ev) =>`) so GAME no longer returns early while paused:

```js
    canvas.addEventListener("pointerdown", (ev) => {
      if (app.screen === SCREEN.GAME) {
        if (world.state !== "PAUSE") return;
        input._intent.fire = false;
        /* camrig's ptOf pattern: client px / the CSS scale of the OVERLAY
           canvas — never #gl's Retina drawing buffer, which the wrapper owns. */
        const r = canvas.getBoundingClientRect();
        const k = canvas.width / (r.width || canvas.width);
        const px = (ev.clientX - r.left) / k,
          py = (ev.clientY - r.top) / k;
        const B = overlayBox(curKind);
        if (app.pauseView === 1) {
          const row = settingsHit(px, py, menuLayout(B.w, B.h));
          if (row < 0) app.pauseBack();
          else {
            app.optRow = row;
            app.confirm();
          }
          return;
        }
        const row = pauseHit(px, py, B);
        if (row >= 0) {
          app.pauseCursor = row;
          app.confirm();
        }
        return;
      }
      input._intent.fire = false;
```

(the rest of the handler — ATTRACT / INTRO / SETTINGS / `app.confirm()` — is unchanged from S2).

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/heat.test.mjs tests/headless.test.mjs tests/menuapp.test.mjs tests/three.test.mjs tests/r3d.test.mjs tests/menudraw.test.mjs
```

Expected: green. The toolbar blocks at `headless.test.mjs:467-563` still pass here — the toolbar is still mounted; Task 2 deletes them along with it.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together, `current vN → vN+1`.

```bash
git add src/app/menuapp.js src/render/scenes.js src/render/renderer.js src/render/three/wrapper.js src/render/shellview.js src/main.js tests/heat.test.mjs tests/headless.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Turn the pause overlay into a real RESUME/RESTART/OPTIONS/QUIT list.

world.state stays PAUSE and the shell stays GAME, so the room's track keeps
playing and every screen===GAME guard stays true. OPTIONS is an inline page on
the same drawSettings body, and RESTART now banks the run before zeroing it.
overlayBox names the one coordinate space both draws and both hit tests read.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Delete the toolbar and the keyboard legend; gate the HUD strip

**Files:**
- Modify: `index.html` — delete `#controls` (111–117) and `.hint` (118–123); delete the `.btn` / `.btn:hover` / `.btn:active` (79–83), `#controls` (84) and `.hint` / `.hint kbd` (86–88) CSS rules
- Delete: `src/app/toolbar.js`
- Modify: `src/pwa/shell.js` — drop `"src/app/toolbar.js"` from `SRC`
- Modify: `src/main.js` — the `toolbar.js` import (17), five `setBtn` call sites (166, 276, 289, 292, 491), the `mountToolbar({…})` block (564–591), `setBtn` on the returned surface (636), `hudEl` + its frame gate, the render-opts `undefined` branches
- Modify: `tests/headless.test.mjs` — delete `:467-563` and the toolbar half of `:890-897`; add the HUD gate pins
- Modify: `tests/coach.test.mjs` — `:239-272` rewritten through pause `RESTART`
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `overlayCue`, `app.screen`, `world.state`
- Produces: `#hud` gated to `SCREEN.GAME`; `{hud:false}` on every non-GAME render; `mountToolbar` / `setBtn` gone

- [ ] **Step 1: Write the failing tests**

Replace `tests/coach.test.mjs` lines 239–272 (the whole `// ---- parked: toolbar Restart …` block, including its `stubs` bag and `try/finally`) with:

```js
// ---- parked: pause RESTART has the same loadLevel/fireEdge hole onStart used
// to. A Space held across the confirm must not plant on frame 1. ----
{
  const { canvas } = fakeCanvasTexts();
  const g = createGame(canvas, { autoplay: true, seed: 77 });
  g.input._onKey({ code: "Space", preventDefault() {} });
  let t = 0;
  g.loop(t);
  t += 20;
  g.loop(t);
  check("held fire after autoplay onStart has not planted", g.world.bombs.length === 0);
  g.input.onPause();
  t += 20;
  g.loop(t);
  g.app.pauseCursor = 1;
  g.app.confirm(); // RESTART
  check("pause RESTART reloads L1 PLAY", g.world.level === 1 && g.world.state === "PLAY");
  t += 20;
  g.loop(t);
  t += 20;
  g.loop(t);
  check(
    "held fire across pause RESTART plants no bomb",
    g.world.bombs.length === 0,
    JSON.stringify(g.world.bombs),
  );
}
```

In `tests/headless.test.mjs`, **delete** lines 467–563 (the `F3 toolbar GAME-gates` block and the `MENU BUTTON wave` block — both waves are now asserted through the P1 pause pins added in Task 1) and **delete** the `toolbar + debug hook` block's toolbar half at 890–897 (keep the `mountDebugHook` block that follows it). Then append to the renderer-opts block at `:438-465`:

```js
{
  const hudEl={hidden:false};
  const els={hud:hudEl};
  const noop=()=>{};
  globalThis.document={addEventListener:noop,removeEventListener:noop,
    getElementById:(id)=>els[id]||null};
  try{
    const g=createGame(null,{seed:41});
    g.app.cabinetSeen=true; g.app.skip();       // seen cabinet -> MENU
    g.loop(16);
    check("#hud strip is hidden outside GAME",hudEl.hidden===true,
      String(hudEl.hidden));
    g.app.cursor=0; g.app.confirm();            // PLAY
    g.loop(32);
    check("#hud strip is shown inside GAME",hudEl.hidden===false,
      String(hudEl.hidden));
    g.input.onPause();
    g.loop(48);
    check("#hud stays visible through PAUSE (world.state, not a SCREEN)",
      hudEl.hidden===false,String(hudEl.hidden));
   }finally{ delete globalThis.document; }
}
{
  const src=readFileSync(join(ROOT,"src/main.js"),"utf8");
  check("main.js passes {hud:false} on every non-GAME render, closing the"
    +" undefined gap that wrote the frozen backdrop's zeros",
    /:\s*\{\s*hud:\s*false\s*\}/.test(src)&&!/:\s*undefined;/.test(src),
    (src.match(/let ro =[\s\S]{0,600}?renderer\.render/)||[])[0]);
  check("toolbar.js is gone and main.js no longer imports it",
    !/toolbar\.js|mountToolbar|setBtn/.test(src));
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/headless.test.mjs tests/coach.test.mjs
```

Expected: FAIL — `#hud strip is hidden outside GAME -> false` (nothing gates it today), plus `toolbar.js is gone…` failing on the live import.

- [ ] **Step 3: Implement**

**3a — `index.html`.** Delete the `#controls` block (111–117) and the `.hint` block (118–123) in the body, and the `.btn`, `.btn:hover`, `.btn:active`, `#controls`, `.hint` and `.hint kbd` rules from the `<style>` (79–88, leaving `.muted` and `.sr-only` alone). Everything the toolbar covered has a home: `#btnPause` → `P`/`Escape` + the touch pill · `#btnRestart` → pause `RESTART`, its only home anywhere · `#btnMenu` → pause `QUIT TO MENU` + `KeyM` · `#btnSound` → the OPTIONS `SOUND` row, reachable mid-run through pause OPTIONS. The `Source` anchor's job is the menu's `SOURCE` row.

**3b — delete the module.**

```bash
git rm src/app/toolbar.js
```

and remove `"src/app/toolbar.js"` from `SRC` in `src/pwa/shell.js`.

**3c — `src/main.js`.** Delete the import on line 17. Delete `setBtn("btnPause", "Pause");` from `onStart` (166), from `input.onUiKey`'s `KeyM` branch (276), from the finale-WIN handler (491), and both calls inside `onPause` (289, 292 — already gone if 3e of Task 1 was applied as written; confirm none remain). Delete the whole `mountToolbar({ … });` block (564–591) and the `setBtn,` entry on the returned object (636).

Hoist the HUD element beside `glCanvas` (line 348):

```js
  const hudEl =
    typeof document !== "undefined" && document
      ? document.getElementById("hud")
      : null;
```

and gate it once per frame in `loop`, beside `touch.update(…)`:

```js
    /* HUD is a live-gameplay artifact: the DOM strip shows only inside GAME.
       PAUSE/WIN/LOSE are world.state, so GAME already covers them. Full
       opacity, not dimmed — it is DOM outside the canvas, nothing overlays it. */
    if (hudEl) hudEl.hidden = app.screen !== SCREEN.GAME;
```

Close the `undefined` gap in the render opts (S1 Task 4 hoisted them into `let ro = …`): change the INTRO+3d branch to `{ intro: app.subT, hud: false }` and the trailing `: undefined` to `: { hud: false }`, so `updateHud` stops writing the frozen backdrop's zeros on every menu screen.

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/headless.test.mjs tests/coach.test.mjs tests/pwa.test.mjs tests/serve.test.mjs tests/touch.test.mjs
```

Expected: green. `pwa.test.mjs:319-332` and `headless.test.mjs`'s `index.html` pins (relative favicon, no root-absolute hrefs, meta description, OG/Twitter card) pass with **zero edits** — the removed toolbar and hint touch none of those attributes.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together, `current vN → vN+1`.

```bash
git add index.html src/main.js src/pwa/shell.js sw.js tests/headless.test.mjs tests/coach.test.mjs
git commit -m "$(cat <<'EOF'
Retire the HTML toolbar and the keyboard legend; gate the HUD strip.

Every toolbar verb now lives in the pause list or the OPTIONS page, and audio
unlock never depended on it — main binds keydown/pointerdown on window with
{once:true}, so canvas and #stage gestures unlock identically. #hud shows only
inside GAME, and non-GAME renders pass {hud:false} so the frozen backdrop's
zeros stop reaching the DOM.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The touch pause pill and the two-argument pad gate

**Files:**
- Modify: `index.html` — `#tpause` markup inside `#touchpad`, `#tpause` CSS beside `#tbomb`
- Modify: `src/touch.js` — `#tpause` build + bind, mount normalization, `update(inGame, playing)`
- Modify: `src/main.js` — `touch.update(app.screen === SCREEN.GAME, world.state === "PLAY")`
- Modify: `tests/touch.test.mjs`
- Modify: `MEMORY.md`, `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `input.onPause`
- Produces: `update(inGame, playing)`; `#tpause` mounted and bound

- [ ] **Step 1: Write the failing tests** — append to `tests/touch.test.mjs`, before its summary `console.log`

```js
// ---- §PAUSE pill: the touch-only pause affordance, inside #touchpad ----
{
  const html=readFileSync(new URL("../index.html", import.meta.url),"utf8");
  check("#touchpad hosts a #tpause pill with a button role",
    /id="tpause"[\s\S]{0,80}?aria-label="Pause"/.test(html)
    &&/id="tpause"[\s\S]{0,80}?role="button"/.test(html),
    (html.match(/<div id="tpause"[^>]*>/)||[])[0]);
  check("#tpause is a 44px round pill drawn from bars, never a canvas",
    /#tpause\{[^}]*width:44px[^}]*height:44px/.test(html)
    &&/border-radius:50%/.test((html.match(/#tpause\{[^}]*\}/)||[""])[0])
    &&/#tpause::before/.test(html)&&/#tpause::after/.test(html),
    (html.match(/#tpause\{[^}]*\}/)||[])[0]);
  check("the toolbar and the keyboard legend are gone from index.html",
    !/id="controls"/.test(html)&&!/class="hint"/.test(html)
    &&!/btnPause|btnSound|btnRestart|btnMenu/.test(html),
    (html.match(/id="controls"[^>]*/)||["clean"])[0]);
}
{
  const inp=new Input(null);
  const t=mountTouch(inp,null);
  let threw=false;
  try{ t.update(true,true); t.update(true,false); t.update(false,false); }
  catch(e){ threw=true; }
  check("headless stub takes the two-arg update silently",threw===false);
}
{
  const els=new Map();
  const mk=(id)=>{ const e={id,hidden:false,style:{},children:[],
    setAttribute(){}, appendChild(c){ e.children.push(c); },
    querySelector(sel){ return sel[0]==="#"?(els.get(sel.slice(1))||null):null; },
    addEventListener(){}, removeEventListener(){},
    getBoundingClientRect(){ return {left:0,top:0,width:44,height:44}; },
    getContext(){ return null; }};
    els.set(id,e); return e; };
  const box=mk("touchpad"), pad=mk("tpad"), bomb=mk("tbomb"),
    pill=mk("tpause"), stage=mk("stage");
  box.children.push(pad,bomb,pill);
  globalThis.window={ontouchstart:null};
  globalThis.document={getElementById:(id)=>els.get(id)||null,
    createElement:(tag)=>mk("_"+tag)};
  try{
    const inp=new Input(null);
    const t=mountTouch(inp,stage);
    check("mount normalises to hidden-box / visible-children",
      box.hidden===true&&pad.hidden===false&&bomb.hidden===false
      &&pill.hidden===false,
      [box.hidden,pad.hidden,bomb.hidden,pill.hidden].join());
    t.update(false,false);
    check("outside GAME the whole pad box hides",box.hidden===true);
    t.update(true,true);
    check("GAME + PLAY shows box, pad, bomb and pill",
      box.hidden===false&&pad.hidden===false&&bomb.hidden===false
      &&pill.hidden===false,
      [box.hidden,pad.hidden,bomb.hidden,pill.hidden].join());
    inp.setIntent({move:{x:1,y:0}}); inp.padFire(true);
    t.update(true,false);
    check("GAME + PAUSE hides the 128px pad and the 72px bomb, keeps the pill"
      +" (they sit in the same corners as the pause rows)",
      box.hidden===false&&pad.hidden===true&&bomb.hidden===true
      &&pill.hidden===false,
      [box.hidden,pad.hidden,bomb.hidden,pill.hidden].join());
    check("hiding the pad clears every held intent",
      !inp.input.up&&!inp.input.down&&!inp.input.left&&!inp.input.right
      &&!inp._intent.fire);
    t.update(true,true);
    check("resuming brings the pad and bomb back",
      pad.hidden===false&&bomb.hidden===false);
   }finally{ delete globalThis.window; delete globalThis.document; }
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/touch.test.mjs
```

Expected: FAIL — `#touchpad hosts a #tpause pill with a button role -> undefined` and `mount normalises to hidden-box / visible-children -> false,false,false,false`.

- [ ] **Step 3: Implement**

**3a — `index.html`.** Add the pill as the third child of `#touchpad` (after `#tbomb`):

```html
      <div id="tpause" role="button" aria-label="Pause"></div>
```

and its CSS immediately after the `#tbomb canvas` rule:

```css
  /* pause pill: 44px is the minimum comfortable target (#tbomb is 72, #tpad
     128). Two bars via ::before/::after — no canvas. */
  #tpause{width:44px;height:44px;border-radius:50%;
    top:10px;right:10px}
  #tpause::before,#tpause::after{content:"";position:absolute;top:13px;
    width:4px;height:14px;background:#dfe7f5;border-radius:2px}
  #tpause::before{left:14px}
  #tpause::after{left:22px}
```

It inherits `#touchpad>div`'s `position:absolute`, `pointer-events:auto`, `var(--panel)` background, border, opacity and `:active` accent from its siblings.

**3b — `src/touch.js`.** After the `padEl`/`bombEl` lookup (line 71) add:

```js
  let pauseEl=box.querySelector("#tpause");
  if(!pauseEl){   // static skeleton missing the pill: build it
    pauseEl=document.createElement("div"); pauseEl.id="tpause";
    pauseEl.setAttribute("role","button");
    pauseEl.setAttribute("aria-label","Pause");
    box.appendChild(pauseEl);
   }
```

After `const unbindPad=bind(padEl,"pad"), unbindBomb=bind(bombEl,"bomb");` (line 95) add:

```js
  /* The pill is not a PadMapper control — it has no zones and no claim, it
     just calls the same onPause the P key does. */
  const onPauseTap=(e)=>{ if(e&&e.preventDefault)e.preventDefault();
    if(input.onPause)input.onPause(); };
  pauseEl.addEventListener("pointerdown",onPauseTap);
  const unbindPause=()=>pauseEl.removeEventListener("pointerdown",onPauseTap);
  box.hidden=true; padEl.hidden=false; bombEl.hidden=false;
  pauseEl.hidden=false;
```

Replace `let shown=false;` and the returned object (96–105) with:

```js
  let shown=false, played=false;
  return {
    /* Visible ONLY in GAME; INSIDE game the move pad and the bomb button
       additionally hide whenever the world is not PLAYing, because a 128px pad
       and a 72px button sit in the same corners as the pause rows and would
       swallow taps aimed at them. The pill stays — it is how a touch player
       resumes. Hiding either clears held state. */
    update(inGame, playing){
      const ig=!!inGame, pl=playing===undefined?ig:!!playing;
      if(ig!==shown){ shown=ig; box.hidden=!ig; if(!ig)map.clear(); }
      if(pl!==played){
        played=pl; padEl.hidden=!pl; bombEl.hidden=!pl;
        if(!pl)map.clear();
       }
     },
    unmount(){ unbindPad(); unbindBomb(); unbindPause();
      shown=false; played=false; box.hidden=true; map.clear(); }
   };
```

**3c — `src/main.js`.** Replace the `touch.update(…)` call in `loop` (line 435) with:

```js
    touch.update(app.screen === SCREEN.GAME, world.state === "PLAY");
```

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test tests/touch.test.mjs tests/headless.test.mjs tests/coach.test.mjs tests/heat.test.mjs tests/pwa.test.mjs
```

Then:

```bash
node --test
```

Expected: everything green.

- [ ] **Step 5: Headed acceptance pass**

Unregister the service worker and delete its caches first — a stale SW serves pre-change bytes and looks exactly like a change that did not land.

```bash
node serve.js
# then, in the browser: DevTools > Application > Service Workers > Unregister,
# Storage > Clear site data, hard reload http://127.0.0.1:8080/index.html
```

Score each line pass/fail and fix until every one passes:

- [ ] MENU shows 8 rows, no HUD strip, no toolbar, no keyboard legend under the canvas
- [ ] `OPTIONS` opens; all nine rows visible and readable at both 2D (600×520) and REAL 3D (608×352) without the plate clipping
- [ ] `MUSIC` and `SFX` move the mix live; `SOUND OFF` silences both; `SFX 0` throws nothing in the console
- [ ] `RENDER` flips 2D ⇄ 3D live; reload keeps the choice; `?render=3d` still overrides it
- [ ] `CAMERA` STANDARD → WIDE → FAR visibly pulls back with the whole board and the cabinet bezel still on screen at every stop
- [ ] `BRIGHTNESS` 70 → 130 lifts the 3D board without washing JUNGLE's floor or lightening CLASSIC 2D; the rows read `—` and reject adjust in 2D
- [ ] `REDUCE FLASH` visibly damps the boom wash; `SCREEN SHAKE OFF` stills the board in both kinds
- [ ] `P` mid-run shows the pause list; every row does what it says; `OPTIONS` opens inline with the room's music still playing; `Escape` there returns to the list, not to play
- [ ] On a touch device: the pause pill pauses, the move pad and bomb button disappear while paused, pause rows and settings rows respond to taps, and a tap outside the rows backs out
- [ ] Reload: every setting persisted, and high scores / plaques / pact unlock untouched by `RESET DEFAULTS`

- [ ] **Step 6: PWA bump, MEMORY, commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together, `current vN → vN+1`. Append to `MEMORY.md` under a `## 2026-09-05 — Pause menu + chrome removal (S3)` heading (newest first, 1–2 lines): that the pause overlay is now a four-verb list with `world.state` still PAUSE and the shell still GAME, that OPTIONS from pause is an inline `pauseView` page rather than a screen jump (a jump would flip the music cue and close the HUD/touch gates mid-run), that `RESTART` now banks the score the toolbar button used to drop, and that the toolbar and legend are gone with audio unlock riding `main.js`'s window-level `{once:true}` gesture listeners.

```bash
git add index.html src/touch.js src/main.js tests/touch.test.mjs MEMORY.md src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add the touch pause pill and hide the pad while the world is not playing.

A 128px move pad and a 72px bomb button sit in the same corners as the pause
rows, so they hide on any non-PLAY state while the 44px pill stays — it is how
a touch player resumes.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
