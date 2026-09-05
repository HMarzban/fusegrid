# S2 — OPTIONS Screen + Menu IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The nine-row flat list becomes eight rows with one OPTIONS page behind row 2, and every knob S1 built gets a home, a value token and a tap target.

**Architecture:** `SCREEN.SETTINGS = 10` is **appended**, never inserted. `ITEMS` drops to 8 and RENDER + SOUND fold into `OPTIONS`. The screen follows the HOWTO/ITEMS shell scaffold (`shell` → `head` → body → `foot`, `drawDim(0.72)`, `_push` transition reset, Esc/Backspace back) with LEVEL SELECT's live-adjust machinery bolted on — `move(dir, axis)` with axis 1 = row and axis 0 = adjust — because LEVEL is the only precedent for in-subscreen adjustment. `optRow` is its own cursor, so the MENU cursor survives the round trip. `togT` stops being a MENU concept and becomes a SETTINGS concept: `drawMenu` drops the arg entirely rather than being passed a dead `-1`. The build tag rides the head kicker, derived in `shellview.js` from `CACHE_NAME` — the SCORES precedent for a screen fed from outside `app`/`world`.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, Canvas 2D. Zero npm runtime deps. `menudraw.js` must not import from `src/app/` or `src/render/three/`; `shellview.js` is the only render module that may read `src/app/`, plus — new here — `src/pwa/shell.js` for the one build identifier.

**Spec:** `docs/superpowers/specs/2026-09-05-settings-menu-design.md`

**Index:** `docs/superpowers/plans/2026-09-05-settings-menu.md` — its **Shared interfaces** block is authoritative for every signature below.

**Depends on:** S1 (`docs/superpowers/plans/2026-09-05-settings-store.md`). There must be knobs to bind: `src/app/settings.js`, `audio.setVols`, `setFxOpts`, `camPreset` and `o.bright` all ship there.

## Global Constraints

- `SCREEN.SETTINGS = 10`, **appended after `ENEMIES:9`**. Inserting shifts every later frozen value and fails `menuapp.test.mjs:42-53` and `:888-897`.
- `ITEMS` is frozen at exactly 8 entries in the spec's order. **RENDER folds, it does not stay as a quick toggle** — a mirrored control is two write paths for one persisted value.
- **No HELP hub.** HOW TO / ITEMS / ENEMIES stay top-level (a pinned Learned Preference).
- **Rows never hide or reflow.** All nine draw at every canvas size; 3D-only rows (`CAMERA`, `BRIGHTNESS`) render at alpha 0.45 with value `—` and reject **both** adjust and cycle while `render3d === false`.
- `←/→` decrement/increment, **clamped, no wrap**. `Enter` cycles the row forward one stop **wrapping**. That is what gives touch full control, since a tap maps to Enter on the row it hits.
- SETTINGS joins `back()`'s poppable list but **not** the `confirm()`-is-back group that HOWTO / ITEMS / ENEMIES / SCORES share — Enter is consumed by the row under the cursor.
- Every change stamps `togT = subT`. A **rejected** change (clamped, or 3D-only in 2D) stamps nothing and returns `false`.
- Layout budget is fixed: `shell(c, L, 520)`, `y0 = S.headY + 22`, `noteY = S.footY - 30`, `rowH = Math.min(30, (noteY - 10 - y0) / 9)`. 19.30px rows at H=352 is exactly the density HIGH SCORES already ships (`layout().rowH = H*0.055 = 19.36`).
- Exact copy, byte-for-byte — foot `↑↓ ROW · ←→ ADJUST · ENTER CYCLE · ESC BACK`; note 1 `MOVE WASD/ARROWS · BOMB SPACE · THROW SHIFT+SPACE · REMOTE Q · KICK K+MOVE · PAUSE P`; note 2 `TOUCH · LEFT PAD MOVES · RIGHT BUTTON BOMBS · TAP PAUSE PILL`. Both notes are **always drawn**, not device-gated.
- **No remap.** The CONTROLS section is display-only bindings plus the touch note. HOW TO PLAY keeps the long form with icons.
- `?render=3d|iso` still wins at boot over the persisted `r3d`. `iso` stays flag-only.
- No comments unless the file already uses explanatory block comments (its style). `menuapp.js`, `menudraw.js` and `shellview.js` all do.
- Never write the banned grid-bomb franchise name into any committed file.
- PWA: bump `CACHE_NAME` (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`) **together**, `current vN → vN+1`, in every commit here. **Read the current value first — the P4 art program bumps the same two lines concurrently.**
- **`tests/three.test.mjs` belongs to P4 this week.** Locate its one edit here by the string `"RENDER toggle swaps to classic surface (no overlay key)"`, never by line number.

---

### Task 1: `SCREEN.SETTINGS`, the 8-row `ITEMS`, and the knob machine

**Files:**
- Modify: `src/app/menuapp.js` — `SCREEN` (15–26), `ITEMS` (27–37), new `OPT_ROWS`, app fields (48–70), `update` (89–98), `_tapMove` (179–195), `confirm` (196–240), `back` (241–251), `move` (268–295), new knob methods, the `return app` seeding
- Modify: `tests/menuapp.test.mjs` — `:54-64`, `:281-390`, `:1025-1075`, `:1077-1121`
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `clampSettings`, `DEFAULTS` (`src/app/settings.js`)
- Produces:
  - `SCREEN.SETTINGS === 10`
  - `ITEMS = ["PLAY","LEVEL SELECT","OPTIONS","HOW TO PLAY","ITEMS","ENEMIES","HIGH SCORES","SOURCE"]`
  - `OPT_ROWS = ["MUSIC","SFX","SOUND","RENDER","CAMERA","BRIGHTNESS","SCREEN SHAKE","REDUCE FLASH","RESET DEFAULTS"]`
  - `app.settings`, `app.optRow`, `app.optMove(dir)`, `app.optAdjust(dir)`, `app.optCycle()`, `app.optReset()`
  - `o.settings`, `o.onSettings(blob, key)`

- [ ] **Step 1: Write the failing tests**

Extend the `menuapp.test.mjs` import to `import { SCREEN, ITEMS, OPT_ROWS, SOURCE_URL, IDLE_T, createMenuApp } from "../src/app/menuapp.js";`, then **replace lines 54–64** (the `ITEMS frozen, 9 entries` check) with:

```js
check(
  "ITEMS frozen, 8 entries",
  Object.isFrozen(ITEMS) &&
    ITEMS.length === 8 &&
    ITEMS[0] === "PLAY" &&
    ITEMS[2] === "OPTIONS" &&
    ITEMS[7] === "SOURCE",
  JSON.stringify(ITEMS),
);
check(
  "SETTINGS appended at 10 — never inserted, or every later frozen value shifts",
  SCREEN.SETTINGS === 10 && SCREEN.ENEMIES === 9 && SCREEN.ITEMS === 8 && SCREEN.ATTRACT === 7,
  JSON.stringify(SCREEN),
);
check(
  "OPT_ROWS frozen, the nine spec rows in order",
  Object.isFrozen(OPT_ROWS) &&
    OPT_ROWS.join("|") ===
      "MUSIC|SFX|SOUND|RENDER|CAMERA|BRIGHTNESS|SCREEN SHAKE|REDUCE FLASH|RESET DEFAULTS",
  OPT_ROWS.join("|"),
);
```

**Replace lines 281–390** (the whole `// ---- confirm dispatch per item ----` run, whose `a.cursor = 2 → RENDER`, `= 3 → SOUND`, `= 4 → HOWTO` … `= 8 → SOURCE` literals are testing today's layout) with:

```js
// ---- confirm dispatch per cursor index (spec §1 table) ----
{
  let started = null;
  const a = createMenuApp({
    onStart: (x) => {
      started = x;
    },
  });
  a.screen = SCREEN.MENU;
  a.cursor = 0;
  a.confirm();
  check(
    "cursor 0 PLAY -> onStart({level}) + GAME + inGame",
    a.screen === SCREEN.GAME &&
      a.inGame === true &&
      started &&
      started.level === 1 &&
      typeof started.level === "number",
    JSON.stringify(started),
  );
}
{
  for (const [cur, screen] of [
    [1, SCREEN.LEVEL],
    [2, SCREEN.SETTINGS],
    [3, SCREEN.HOWTO],
    [4, SCREEN.ITEMS],
    [5, SCREEN.ENEMIES],
    [6, SCREEN.SCORES],
  ]) {
    const a = createMenuApp();
    a.screen = SCREEN.MENU;
    a.cursor = cur;
    a.confirm();
    check(
      "cursor " + cur + " (" + ITEMS[cur] + ") -> screen " + screen,
      a.screen === screen,
      String(a.screen),
    );
  }
  let srcHits = 0;
  const s = createMenuApp({
    onSource: () => {
      srcHits++;
    },
  });
  s.screen = SCREEN.MENU;
  s.cursor = 7;
  s.confirm();
  check(
    "cursor 7 SOURCE -> onSource(), screen stays MENU",
    srcHits === 1 && s.screen === SCREEN.MENU,
    srcHits + "/" + s.screen,
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  a.cursor = 2;
  a.confirm();
  check("OPTIONS entry resets optRow and clears togT", a.optRow === 0 && a.togT === -1);
  check(
    "SETTINGS joins back()'s poppable list",
    a.key("Escape") === true && a.screen === SCREEN.MENU,
    String(a.screen),
  );
  a.cursor = 2;
  a.confirm();
  check(
    "confirm on SETTINGS is NOT back — Enter is consumed by the row",
    a.confirm() === true && a.screen === SCREEN.SETTINGS,
    String(a.screen),
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.GAME;
  check(
    "confirm() in GAME is no-op",
    a.confirm() === false && a.screen === SCREEN.GAME,
  );
}

// ---- OPTIONS knobs: clamp, wrap, 3D gating, reset ----
{
  const seen = [];
  const a = createMenuApp({
    onSettings: (s, k) => {
      seen.push(k);
    },
  });
  a.screen = SCREEN.SETTINGS;
  check(
    "settings default to the shipped blob",
    a.settings.mus === 100 && a.settings.sfx === 100 && a.settings.bri === 100 && a.settings.cam === 0,
    JSON.stringify(a.settings),
  );
  a.cursor = 5;
  a.optMove(1);
  check("optMove moves optRow and never the MENU cursor", a.optRow === 1 && a.cursor === 5, a.optRow + "/" + a.cursor);
  a.optRow = 0;
  check("MUSIC left steps down by 10", a.move(-1, 0) === true && a.settings.mus === 90, a.settings.mus);
  for (let i = 0; i < 20; i++) a.move(-1, 0);
  check(
    "MUSIC clamps at 0 and reports no-change (adjust never wraps)",
    a.settings.mus === 0 && a.move(-1, 0) === false,
    a.settings.mus,
  );
  check("MUSIC Enter wraps 0 -> 10", a.optCycle() === true && a.settings.mus === 10, a.settings.mus);
  a.settings.mus = 100;
  check("MUSIC Enter wraps 100 -> 0", a.optCycle() === true && a.settings.mus === 0, a.settings.mus);
  a.optRow = 8;
  check(
    "RESET DEFAULTS restores every field",
    a.optCycle() === true && a.settings.mus === 100 && a.settings.bri === 100 && a.settings.shk === 1,
    JSON.stringify(a.settings),
  );
  check(
    "every accepted change reports through onSettings",
    seen.indexOf("mus") >= 0 && seen.indexOf("reset") >= 0,
    seen.join(","),
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.SETTINGS;
  a.optRow = 4;
  check("CAMERA rejects adjust in CLASSIC 2D", a.move(1, 0) === false && a.settings.cam === 0);
  check("CAMERA rejects Enter in CLASSIC 2D", a.optCycle() === false && a.settings.cam === 0);
  a.optRow = 5;
  check("BRIGHTNESS rejects adjust in CLASSIC 2D", a.move(1, 0) === false && a.settings.bri === 100);
  a.optRow = 3;
  a.optCycle();
  check("RENDER flips render3d and r3d together", a.render3d === true && a.settings.r3d === 1);
  a.optRow = 4;
  check("CAMERA cycles STANDARD -> WIDE in REAL 3D", a.optCycle() === true && a.settings.cam === 1);
  a.move(1, 0);
  check("CAMERA adjusts to FAR then clamps", a.settings.cam === 2 && a.move(1, 0) === false, a.settings.cam);
  check("CAMERA Enter wraps FAR -> STANDARD", a.optCycle() === true && a.settings.cam === 0);
  a.optRow = 5;
  for (let i = 0; i < 10; i++) a.move(1, 0);
  check("BRIGHTNESS clamps at 130", a.settings.bri === 130 && a.move(1, 0) === false, a.settings.bri);
  check("BRIGHTNESS Enter wraps 130 -> 70", a.optCycle() === true && a.settings.bri === 70, a.settings.bri);
  a.optRow = 3;
  a.optCycle();
  check("RENDER back to CLASSIC 2D re-locks the two 3D rows", a.render3d === false && a.settings.r3d === 0);
}
{
  let toggles = 0;
  const a = createMenuApp({
    audio: {
      toggle: () => {
        toggles++;
        return false;
      },
    },
  });
  a.screen = SCREEN.SETTINGS;
  a.optRow = 2;
  a.optCycle();
  check(
    "SOUND row drives audio.toggle() and syncs both flags",
    toggles === 1 && a.sound === false && a.settings.snd === 0,
    toggles + "/" + a.sound + "/" + a.settings.snd,
  );
  check("SOUND left is a no-op when already OFF", a.move(-1, 0) === false && toggles === 1);
}
{
  const a = createMenuApp();
  a.screen = SCREEN.SETTINGS;
  a.optRow = 8;
  a.optMove(1);
  check("optMove wraps 8 -> 0", a.optRow === 0, a.optRow);
  a.optMove(-1);
  check("optMove wraps 0 -> 8", a.optRow === 8, a.optRow);
  a.optRow = 0;
  a.key("ArrowDown");
  check("ArrowDown tap moves the row (axis 1)", a.optRow === 1, a.optRow);
  a.key("ArrowLeft");
  check("ArrowLeft tap adjusts the row (axis 0)", a.settings.sfx === 90, a.settings.sfx);
}
```

**Replace lines 1025–1075** (the `togT` block keyed to MENU cursor 2/3) with:

```js
// ---- togT flip timestamp (§2): stamped on every SETTINGS knob change ----
{
  const a = createMenuApp();
  a.screen = SCREEN.SETTINGS;
  check("togT exposed, sentinel -1 before any change", a.togT === -1, a.togT);
  frames(a, 10, DT);
  const tAt = a.subT;
  a.optRow = 6;
  a.optCycle();
  check(
    "knob change stamps togT=subT",
    a.togT === tAt && a.settings.shk === 0,
    a.togT + " vs " + tAt,
  );
  const hold = a.togT;
  frames(a, 7, DT);
  a.optMove(1);
  check("row moves leave togT untouched", a.togT === hold, a.togT);
  frames(a, 5, DT);
  a.optRow = 7;
  a.optCycle();
  check("second change re-stamps togT to the new subT", a.togT === a.subT && a.togT > hold, a.togT + "/" + hold);
  a.back();
  check("screen transition clears the togT sentinel", a.screen === SCREEN.MENU && a.togT === -1, a.togT);
}
{
  const a = createMenuApp();
  a.screen = SCREEN.SETTINGS;
  a.optRow = 4;
  frames(a, 10, DT);
  a.optCycle();
  check("a REJECTED 3D-only change never stamps togT", a.togT === -1, a.togT);
}
```

In the `want` map (lines ~1082–1092) replace the object with:

```js
  const want = {
    PLAY: SCREEN.GAME,
    "LEVEL SELECT": SCREEN.LEVEL,
    OPTIONS: SCREEN.SETTINGS,
    "HOW TO PLAY": SCREEN.HOWTO,
    ITEMS: SCREEN.ITEMS,
    ENEMIES: SCREEN.ENEMIES,
    "HIGH SCORES": SCREEN.SCORES,
    SOURCE: SCREEN.MENU,
  };
```

and its trailing check (lines ~1116–1120) with:

```js
  check(
    "confirm follows ITEMS labels (SOURCE stays MENU, PLAY starts the run)",
    ok && started === 1 && srcHits === 1 && want.OPTIONS === SCREEN.SETTINGS,
    det.join(" ") || "ok",
  );
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/menuapp.test.mjs
```

Expected: FAIL — `SyntaxError: The requested module '../src/app/menuapp.js' does not provide an export named 'OPT_ROWS'`.

- [ ] **Step 3: Implement** — `src/app/menuapp.js`

Add `import { clampSettings, DEFAULTS } from "./settings.js";` after line 14. Replace `SCREEN` and `ITEMS` (15–37) with:

```js
export const SCREEN = Object.freeze({
  BOOT: 0,
  INTRO: 1,
  MENU: 2,
  LEVEL: 3,
  HOWTO: 4,
  SCORES: 5,
  GAME: 6,
  ATTRACT: 7,
  ITEMS: 8,
  ENEMIES: 9,
  SETTINGS: 10, // appended — inserting shifts every frozen value after it
});
export const ITEMS = Object.freeze([
  "PLAY",
  "LEVEL SELECT",
  "OPTIONS",
  "HOW TO PLAY",
  "ITEMS",
  "ENEMIES",
  "HIGH SCORES",
  "SOURCE",
]);
/* OPTIONS rows, frozen and index-addressed: optRow, drawSettings and
   settingsHit all agree because they all count this array. */
export const OPT_ROWS = Object.freeze([
  "MUSIC",
  "SFX",
  "SOUND",
  "RENDER",
  "CAMERA",
  "BRIGHTNESS",
  "SCREEN SHAKE",
  "REDUCE FLASH",
  "RESET DEFAULTS",
]);
```

Add `const onSettings = o.onSettings || null;` beside the other opt handles (line 47). In the app literal, after `scoreHeat: 0,` (line 53) add:

```js
    settings: clampSettings(o.settings),
    optRow: 0, // OPTIONS row cursor — its OWN field, so the MENU cursor
    // survives a round trip through the page
```

and change the `togT` comment on line 67 to `togT: -1, // SETTINGS knob-flash timestamp (§2): subT at the last accepted`.

In `update()` (line 90) change `else if (this.screen === SCREEN.LEVEL) {` to:

```js
      else if (this.screen === SCREEN.LEVEL || this.screen === SCREEN.SETTINGS) {
```

In `_tapMove` (line 186), after the LEVEL branch add:

```js
      if (this.screen === SCREEN.SETTINGS && this.move(dir, lat ? 0 : 1)) {
        this._taps[dir + ":" + (lat ? 0 : 1)] = true;
        return true;
      }
```

In `confirm()`'s MENU switch (203–228), replace the `START GAME` / `LEVEL SELECT` / `RENDER` / `SOUND` cases with:

```js
            case "PLAY":
              return this.startRun();
            case "LEVEL SELECT":
              return this._push(SCREEN.LEVEL);
            case "OPTIONS":
              this.optRow = 0;
              return this._push(SCREEN.SETTINGS);
```

and add, immediately before the `case SCREEN.HOWTO:` group (line 233):

```js
        case SCREEN.SETTINGS:
          return this.optCycle();
```

In `back()` (242–248) add `|| this.screen === SCREEN.SETTINGS` to the condition.

In `move()`, after the `SCREEN.SCORES` branch (line 293) add:

```js
      if (this.screen === SCREEN.SETTINGS)
        return (axis | 0) === 1 ? this.optMove(dir) : this.optAdjust(dir);
```

After `adjustPace` (ends line 304) insert the knob machine:

```js
    /* OPTIONS knobs (spec §2). LEVEL SELECT is the only precedent for
       in-subscreen adjustment, so this copies its move(dir,axis) shape: axis 1
       = up/down = row, axis 0 = left/right = adjust. Adjust CLAMPS, Enter
       CYCLES (which is what gives touch full control, since a tap maps to
       Enter on the row it hits). Every accepted change stamps togT and reports
       through o.onSettings — the same shape onPaceChange already uses. */
    optMove(dir) {
      this.idleT = 0;
      const n = OPT_ROWS.length;
      this.optRow = (this.optRow + (dir < 0 ? -1 : 1) + n) % n;
      return true;
    },
    _optSet(key, v) {
      if (this.settings[key] === v) return false;
      this.settings[key] = v;
      if (key === "r3d") this.render3d = !!v;
      this.togT = this.subT;
      if (onSettings) onSettings(this.settings, key);
      return true;
    },
    /* SOUND is the one row whose truth lives outside the blob: audio.toggle()
       owns the mute, the blob only records where it landed. */
    _optSound(v) {
      if (this.settings.snd === (v ? 1 : 0)) return false;
      if (audio) this.sound = !!audio.toggle();
      else this.sound = !this.sound;
      this.settings.snd = this.sound ? 1 : 0;
      this.togT = this.subT;
      if (onSettings) onSettings(this.settings, "snd");
      return true;
    },
    _opt3dLocked(r) {
      return (r === "CAMERA" || r === "BRIGHTNESS") && !this.render3d;
    },
    optAdjust(dir) {
      this.idleT = 0;
      const r = OPT_ROWS[this.optRow],
        d = dir < 0 ? -1 : 1;
      if (this._opt3dLocked(r)) return false;
      if (r === "MUSIC" || r === "SFX") {
        const k = r === "MUSIC" ? "mus" : "sfx";
        return this._optSet(k, Math.min(100, Math.max(0, this.settings[k] + d * 10)));
      }
      if (r === "BRIGHTNESS")
        return this._optSet("bri", Math.min(130, Math.max(70, this.settings.bri + d * 10)));
      if (r === "CAMERA")
        return this._optSet("cam", Math.min(2, Math.max(0, this.settings.cam + d)));
      if (r === "SOUND") return this._optSound(d > 0 ? 1 : 0);
      if (r === "RENDER") return this._optSet("r3d", d > 0 ? 1 : 0);
      if (r === "SCREEN SHAKE") return this._optSet("shk", d > 0 ? 1 : 0);
      if (r === "REDUCE FLASH") return this._optSet("flx", d > 0 ? 1 : 0);
      return false;
    },
    optCycle() {
      this.idleT = 0;
      const r = OPT_ROWS[this.optRow];
      if (this._opt3dLocked(r)) return false;
      if (r === "MUSIC" || r === "SFX") {
        const k = r === "MUSIC" ? "mus" : "sfx";
        return this._optSet(k, this.settings[k] >= 100 ? 0 : this.settings[k] + 10);
      }
      if (r === "BRIGHTNESS")
        return this._optSet("bri", this.settings.bri >= 130 ? 70 : this.settings.bri + 10);
      if (r === "CAMERA") return this._optSet("cam", (this.settings.cam + 1) % 3);
      if (r === "SOUND") return this._optSound(this.settings.snd ? 0 : 1);
      if (r === "RENDER") return this._optSet("r3d", this.settings.r3d ? 0 : 1);
      if (r === "SCREEN SHAKE") return this._optSet("shk", this.settings.shk ? 0 : 1);
      if (r === "REDUCE FLASH") return this._optSet("flx", this.settings.flx ? 0 : 1);
      if (r === "RESET DEFAULTS") return this.optReset();
      return false;
    },
    /* Writes DEFAULTS and re-applies every knob live. Progress data
       (highscores / plaques / pact / pace) lives under other keys and is never
       touched. */
    optReset() {
      this.idleT = 0;
      const d = clampSettings(DEFAULTS);
      if (this.sound !== !!d.snd) {
        if (audio) this.sound = !!audio.toggle();
        else this.sound = !this.sound;
      }
      for (const k in d) this.settings[k] = d[k];
      this.settings.snd = this.sound ? 1 : 0;
      this.render3d = !!this.settings.r3d;
      this.togT = this.subT;
      if (onSettings) onSettings(this.settings, "reset");
      return true;
    },
```

Finally, replace `return app;` (line 411) with:

```js
  /* ?render=3d / opts.render3d win at boot over the persisted r3d, so the blob
     is re-seeded IN MEMORY to whatever actually took effect — display and
     storage never disagree, and a URL override is never written to disk. */
  app.settings.r3d = app.render3d ? 1 : 0;
  app.settings.snd = app.sound ? 1 : 0;
  return app;
```

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/menuapp.test.mjs tests/menu-level.test.mjs tests/settings.test.mjs
```

Expected: `menuapp.test.mjs` and `settings.test.mjs` green. `menu-level.test.mjs` passes with **zero edits** — its `a.cursor = 0` is still the run-start row. `menudraw.test.mjs` and `headless.test.mjs` are expected red until Tasks 2 and 3.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together, `current vN → vN+1`.

```bash
git add src/app/menuapp.js tests/menuapp.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Fold RENDER and SOUND into an OPTIONS screen at SCREEN.SETTINGS 10.

ITEMS drops to eight with PLAY at 0 and OPTIONS at 2. The knob machine copies
LEVEL SELECT's move(dir,axis) shape on its own optRow cursor: adjust clamps,
Enter cycles, and 3D-only rows reject both in CLASSIC 2D.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `drawSettings`, `settingsHit`, and `drawMenu` without `togT`

**Files:**
- Modify: `src/render/menudraw.js` — `drawMenu` (217–307), new `CAM_NAME` / `OPT_LABEL` / `OPT_3D` tables + `settingsRows` / `settingsGeom` / `settingsHit` / `drawSettings` after `drawScores` (ends 785)
- Modify: `tests/menudraw.test.mjs` — §13 smoke (83–133), §13b toggle-flash (135–183), §13c chrome fit (185–434), new §13d
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `shellBox`, `shell`, `head`, `foot`, `caret`, `plate`, `font`, `clamp01`, `ACCENT`/`TEXT`/`MUTED`
- Produces:
  - `export function settingsRows(vals, r3d)` → 9 display strings
  - `export function settingsGeom(L)` → `{S, y0, rowH, noteY}`
  - `export function settingsHit(x, y, L)` → 0..8 or -1
  - `export function drawSettings(c, L, t, ui)` — `ui = {row, vals, r3d, togT, rev}`
  - `drawMenu(c, ui, L, t)` with `ui.togT` **dropped**

- [ ] **Step 1: Write the failing tests**

In §13's smoke loop (after `md.drawScores(...)`, line ~124) add:

```js
      const sv = { mus: 100, sfx: 100, snd: 1, r3d: 0, cam: 0, bri: 100, shk: 1, flx: 0 };
      md.drawSettings(stub, L, 0.4, { row: 0, vals: sv, r3d: false, togT: -1, rev: "v0" });
      md.drawSettings(stub, L, 0.4, { row: 8, vals: sv, r3d: true, togT: 0.3, rev: "v0" });
      md.drawSettings(stub, L, 0.4, {});
```

**Replace §13b entirely** (lines 135–183) with:

```js
// 13b) toggle-flash (§2 pinned row): the changed OPTIONS value glows accent
//        for 120ms after the machine's togT stamp; idle sentinel draws clean
{
  const md = await import("../src/render/menudraw.js");
  const L = md.layout(600, 520);
  const vals = { mus: 100, sfx: 100, snd: 1, r3d: 1, cam: 0, bri: 100, shk: 1, flx: 0 };
  const mk = () => {
    const sets = [];
    const stub = new Proxy(function () {}, {
      get: (t, p) => (p === Symbol.toPrimitive ? () => "" : stub),
      apply: () => stub,
      set: (t, p, v) => {
        if (p === "shadowBlur") sets.push(v);
        return true;
      },
    });
    return { stub, sets };
  };
  {
    const { stub, sets } = mk();
    md.drawSettings(stub, L, 1.0, { row: 0, vals, r3d: true, togT: 0.97, rev: "v0" });
    check(
      "toggle-flash: mid-window glow on the changed row",
      sets.some((v) => v > 0 && v <= 14) && !sets.some((v) => v < 0),
      JSON.stringify(sets),
    );
  }
  {
    const { stub, sets } = mk();
    md.drawSettings(stub, L, 1.0, { row: 0, vals, r3d: true, togT: -1, rev: "v0" });
    check("toggle-flash: idle sentinel (-1) never glows", sets.length === 0, JSON.stringify(sets));
  }
  {
    const { stub, sets } = mk();
    md.drawSettings(stub, L, 1.0, { row: 0, vals, r3d: true, togT: 0.85, rev: "v0" });
    check("toggle-flash: window closed after 120ms", sets.length === 0, JSON.stringify(sets));
  }
  {
    const { stub, sets } = mk();
    md.drawMenu(
      stub,
      { cursor: 2, enterT: 1.0, togT: 0.97, items: ["PLAY|CORE", "LEVEL SELECT|CORE", "OPTIONS"] },
      L,
      1.0,
    );
    check(
      "drawMenu ignores a stray togT — the flash is a SETTINGS concept now",
      sets.length === 0,
      JSON.stringify(sets),
    );
  }
}
```

In §13c's menu block (lines ~250–285) replace the 9-entry `items` array with the shipped 8 and retarget the label lookup:

```js
          items: [
            "PLAY|CORE",
            "LEVEL SELECT|CORE",
            "OPTIONS",
            "HOW TO PLAY",
            "ITEMS",
            "ENEMIES",
            "HIGH SCORES",
            "SOURCE",
          ],
```

```js
      const start = texts.find((t) => t.s === "PLAY");
```

Then add, inside the same `for (const [W, H] of …)` loop:

```js
    {
      const { c, texts, rects } = rec();
      const g = md.settingsGeom(L);
      md.drawSettings(c, L, 1, {
        row: 4,
        vals: { mus: 100, sfx: 100, snd: 1, r3d: 1, cam: 2, bri: 130, shk: 1, flx: 0 },
        r3d: true,
        togT: -1,
        rev: "v99",
      });
      const p = plateOf(rects);
      const first = texts.find((t) => t.s === "MUSIC");
      const lastRow = texts.find((t) => t.s === "RESET DEFAULTS");
      const note = texts.find((t) => t.s.indexOf("BOMB SPACE") >= 0);
      const touch = texts.find((t) => t.s.indexOf("TAP PAUSE PILL") >= 0);
      const ft = texts.find((t) => t.s.indexOf("ENTER CYCLE") >= 0);
      const kick = texts.find((t) => t.s === "BUILD v99");
      check(
        `options plate: nine rows, both notes and the foot all inside at ${W}x${H}`,
        !!p &&
          !!first &&
          !!lastRow &&
          !!note &&
          !!touch &&
          !!ft &&
          !!kick &&
          first.y > p.y + 8 &&
          lastRow.y < note.y &&
          note.y < touch.y &&
          touch.y < ft.y &&
          ft.y < p.y + p.h - 8,
        JSON.stringify({ p, first, lastRow, note, touch, ft }),
      );
      check(
        `options row pitch matches the spec budget at ${W}x${H}`,
        Math.abs(g.rowH - (H === 520 ? 30 : 173.68 / 9)) < 0.01 &&
          Math.abs(g.y0 - (H === 520 ? 121.2 : 94.32)) < 0.01 &&
          Math.abs(g.noteY - (H === 520 ? 446 : 278)) < 0.01,
        [g.y0, g.rowH, g.noteY].join("/"),
      );
      check(
        `3D rows show a real value in REAL 3D at ${W}x${H}`,
        texts.some((t) => t.s === "FAR") && texts.some((t) => t.s === "130"),
        texts.map((t) => t.s).join("|"),
      );
    }
    {
      const { c, texts } = rec();
      md.drawSettings(c, L, 1, {
        row: 0,
        vals: { mus: 100, sfx: 100, snd: 1, r3d: 0, cam: 2, bri: 130, shk: 1, flx: 0 },
        r3d: false,
        togT: -1,
        rev: "v99",
      });
      check(
        `3D-only rows read an em dash in CLASSIC 2D at ${W}x${H}`,
        texts.filter((t) => t.s === "—").length === 2 && !texts.some((t) => t.s === "FAR"),
        texts.map((t) => t.s).join("|"),
      );
      check(
        `CLASSIC 2D still draws all nine labels — rows never hide at ${W}x${H}`,
        [
          "MUSIC",
          "SFX",
          "SOUND",
          "RENDER",
          "CAMERA",
          "BRIGHTNESS",
          "SCREEN SHAKE",
          "REDUCE FLASH",
          "RESET DEFAULTS",
        ].every((n) => texts.some((t) => t.s === n)),
        texts.map((t) => t.s).join("|"),
      );
    }
```

Add a new §13d block after §13c:

```js
// 13d) settingsHit: the tap map derived from the same shellBox the page draws
{
  const md = await import("../src/render/menudraw.js");
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    const g = md.settingsGeom(L);
    const mid = g.S.ix + g.S.iw / 2;
    let all = true;
    for (let i = 0; i < 9; i++) {
      const y = g.y0 + i * g.rowH + g.rowH / 2;
      if (md.settingsHit(mid, y, L) !== i) all = false;
    }
    check(`settingsHit maps every row centre at ${W}x${H}`, all);
    check(`settingsHit above the band is -1 at ${W}x${H}`, md.settingsHit(mid, g.y0 - 1, L) === -1);
    check(
      `settingsHit below the band is -1 at ${W}x${H}`,
      md.settingsHit(mid, g.y0 + 9 * g.rowH + 1, L) === -1,
    );
    check(`settingsHit left of the plate is -1 at ${W}x${H}`, md.settingsHit(g.S.ix - 2, g.y0 + 2, L) === -1);
    check(
      `settingsHit right of the plate is -1 at ${W}x${H}`,
      md.settingsHit(g.S.ix + g.S.iw + 2, g.y0 + 2, L) === -1,
    );
    check(
      `settingsHit rows are contiguous — no dead gutter at ${W}x${H}`,
      md.settingsHit(mid, g.y0 + g.rowH - 0.001, L) === 0 && md.settingsHit(mid, g.y0 + g.rowH, L) === 1,
      String(md.settingsHit(mid, g.y0 + g.rowH, L)),
    );
  }
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/menudraw.test.mjs
```

Expected: FAIL — `TypeError: md.drawSettings is not a function` in the §13 smoke block, then `md.settingsGeom is not a function` in §13c/§13d.

- [ ] **Step 3: Implement** — `src/render/menudraw.js`

**3a — `drawMenu` drops the flash.** Delete lines 228–231 (the `const fk = …` expression), delete lines 292–295 (`if (sel && fk > 0) { c.shadowColor = …; c.shadowBlur = …; }`) and line 297 (`if (sel && fk > 0) c.shadowBlur = 0;`). Replace the third and fourth sentences of the block comment (lines 219–222) with:

```
   entries may carry a value token ("PLAY|CORE") drawn in accent. The 120ms
   toggle-flash moved to drawSettings with the toggles themselves (§2), so
   ui.togT is gone rather than passed here as a permanent -1.
```

**3b — the OPTIONS page.** Append after `drawScores` (line 785):

```js
/* OPTIONS (spec §2): nine live knob rows on LEVEL SELECT's adjust model.
   ui = {row, vals, r3d, togT, rev}; vals is the nb.settings.v1 blob and rev is
   the build tag shellview derives from CACHE_NAME. Rows NEVER hide or reflow —
   the two 3D-only rows dim to 0.45 and read an em dash in CLASSIC 2D, so the
   list is the same nine lines in both kinds. CAM_NAME mirrors camrig.js's
   CAM_PRESET order; this file must not import from src/render/three (the 2D
   path never loads three), so the names are duplicated here the way
   PLAQUE_NAME is. */
const CAM_NAME = ["STANDARD", "WIDE", "FAR"];
const OPT_LABEL = [
  "MUSIC",
  "SFX",
  "SOUND",
  "RENDER",
  "CAMERA",
  "BRIGHTNESS",
  "SCREEN SHAKE",
  "REDUCE FLASH",
  "RESET DEFAULTS",
];
const OPT_3D = [false, false, false, false, true, true, false, false, false];
export function settingsRows(vals, r3d) {
  const v = vals || {};
  const on = (b) => (b ? "ON" : "OFF");
  return [
    String(v.mus | 0),
    String(v.sfx | 0),
    on(v.snd),
    r3d ? "REAL 3D" : "CLASSIC 2D",
    CAM_NAME[Math.min(2, Math.max(0, v.cam | 0))],
    String(v.bri | 0),
    on(v.shk),
    on(v.flx),
    "",
  ];
}
/* One source for the layout budget: the page draws it and settingsHit reads
   it, so a tap can never land on a row the plate did not paint. */
export function settingsGeom(L) {
  const S = shellBox(L, 520);
  const noteY = S.footY - 30;
  const y0 = S.headY + 22;
  return { S, noteY, y0, rowH: Math.min(30, (noteY - 10 - y0) / 9) };
}
export function settingsHit(x, y, L) {
  const g = settingsGeom(L);
  if (x < g.S.ix || x > g.S.ix + g.S.iw) return -1;
  const i = Math.floor((y - g.y0) / g.rowH);
  return i >= 0 && i < 9 ? i : -1;
}
export function drawSettings(c, L, t, ui) {
  const u = ui || {};
  const cur = u.row | 0,
    r3d = !!u.r3d;
  const vals = settingsRows(u.vals, r3d);
  const g = settingsGeom(L);
  const S = shell(c, L, 520);
  head(c, S, "OPTIONS", "BUILD " + (u.rev || ""));
  const fk =
    typeof u.togT === "number" && u.togT >= 0 ? 1 - clamp01((t - u.togT) / 0.12) : 0;
  for (let i = 0; i < 9; i++) {
    const y = g.y0 + i * g.rowH + g.rowH / 2;
    const sel = i === cur,
      dim = OPT_3D[i] && !r3d;
    c.globalAlpha = dim ? 0.45 : 1;
    if (sel) {
      c.fillStyle = "rgba(55,240,208,0.14)";
      c.fillRect(S.ix, y - g.rowH / 2 + 2, S.iw, g.rowH - 4);
      c.fillStyle = ACCENT;
      c.fillRect(S.ix, y - g.rowH / 2 + 2, 3, g.rowH - 4);
      caret(c, S.ix + 8, y, g.rowH - 4);
    }
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.font = font(g.rowH < 24 ? 10 : 12, sel ? "900" : "");
    c.fillStyle = sel ? TEXT : MUTED;
    c.fillText(OPT_LABEL[i], S.ix + 22, y);
    const val = dim ? "—" : vals[i];
    if (val) {
      c.textAlign = "right";
      c.fillStyle = sel ? ACCENT : TEXT;
      if (sel && fk > 0) {
        c.shadowColor = c.fillStyle;
        c.shadowBlur = 14 * fk;
      }
      c.fillText(val, S.ix + S.iw, y);
      if (sel && fk > 0) c.shadowBlur = 0;
    }
    c.globalAlpha = 1;
  }
  /* CONTROLS: display-only bindings plus the touch note. Always drawn, never
     device-gated — HOW TO PLAY keeps the long form with icons. */
  c.textAlign = "center";
  c.fillStyle = MUTED;
  c.font = font(9);
  c.fillText(
    "MOVE WASD/ARROWS · BOMB SPACE · THROW SHIFT+SPACE · REMOTE Q · KICK K+MOVE · PAUSE P",
    S.mid,
    g.noteY,
  );
  c.fillStyle = ACCENT;
  c.font = font(10);
  c.fillText(
    "TOUCH · LEFT PAD MOVES · RIGHT BUTTON BOMBS · TAP PAUSE PILL",
    S.mid,
    g.noteY + 14,
  );
  foot(c, S, "↑↓ ROW · ←→ ADJUST · ENTER CYCLE · ESC BACK");
}
```

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/menudraw.test.mjs tests/menuapp.test.mjs tests/items-art.test.mjs tests/touch.test.mjs
```

Expected: green. `items-art.test.mjs` and `touch.test.mjs` take **zero edits** — nothing here touches `drawIcon` or `paintBombPad`.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together, `current vN → vN+1`.

```bash
git add src/render/menudraw.js tests/menudraw.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Draw the OPTIONS plate: nine knob rows that fit both chrome boxes.

settingsGeom is the one layout budget the page paints and settingsHit reads, so
a tap can never land on a row the plate did not draw. 3D-only rows dim to an em
dash instead of reflowing, and the toggle-flash moves here from drawMenu.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Shell routing, the build kicker, and the persist wiring

**Files:**
- Modify: `src/render/shellview.js` — imports (7–12), new `REV`, MENU items array (56–66), new SETTINGS route (95–105 chain)
- Modify: `src/main.js` — `settings` declaration, `createMenuApp` opts (178–189), the `app.confirm` cue wrapper (208–222), the canvas `pointerdown` tap router (302–313)
- Modify: `tests/headless.test.mjs` (`:185-196`, `:215-230`), `tests/three.test.mjs` (the `"RENDER toggle swaps to classic surface"` block), `tests/menudraw.test.mjs` (§15 source-regex)
- Modify: `MEMORY.md`, `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `CACHE_NAME`, `drawSettings`, `settingsHit`, `loadSettings`, `saveSettings`, `applySettings`
- Produces: `SCREEN.SETTINGS` routed and persisted end to end

- [ ] **Step 1: Write the failing tests**

In `tests/headless.test.mjs`, replace lines 185–196 with:

```js
  g.app.cursor=2; cv.fire("pointerdown");       // OPTIONS
  check("C1 OPTIONS click pushes SETTINGS once",
    g.app.screen===SCREEN.SETTINGS&&g.app.optRow===0,String(g.app.screen));
  for(let i=11;i<=20;i++)g.loop(i*16);
  check("C1 push is not re-fired by rising edge next frame",
    g.app.screen===SCREEN.SETTINGS&&g.app.optRow===0);
  g.app.optRow=3; g.app.confirm();              // RENDER row
  check("C1 RENDER row toggles exactly once",
    g.app.render3d===true&&g.app.settings.r3d===1,
    "render3d="+g.app.render3d);
  g.app.key("Escape");
  g.app.cursor=3; cv.fire("pointerdown");       // HOW TO PLAY
  check("C1 subscreen click lands once", g.app.screen===SCREEN.HOWTO);
```

and lines 219–230 with:

```js
  g.app.screen=SCREEN.MENU; g.app.cursor=2; plays.length=0;
  g.app.confirm();                              // OPTIONS push
  check("I1 OPTIONS confirm -> uiSel + SETTINGS",
    plays.join()==="uiSel"&&g.app.screen===SCREEN.SETTINGS,
    JSON.stringify(plays));
  g.app.optRow=6; plays.length=0;
  g.app.confirm();                              // SCREEN SHAKE knob
  check("I1 SETTINGS knob confirm -> uiTog (never uiSel)",
    plays.join()==="uiTog"&&g.app.settings.shk===0,JSON.stringify(plays));
  g.app.key("Escape");
  g.app.cursor=3; plays.length=0;
  g.app.confirm();                              // push HOWTO
  g.app.key("Escape");                          // back
  check("I1 HOWTO enter->uiSel then Esc back->uiBack",
    plays.join()==="uiSel,uiBack",JSON.stringify(plays));
```

In `tests/three.test.mjs`, find the line whose check name is `"RENDER toggle swaps to classic surface (no overlay key)"` and replace the statement immediately above it with:

```js
  g.app.screen=10; g.app.optRow=3; g.app.confirm();  // OPTIONS RENDER row -> 2D
```

In `tests/menudraw.test.mjs`'s §15 wiring block, append before its closing brace:

```js
  check(
    "shellview derives the build kicker from CACHE_NAME and passes it as rev",
    /import\s*\{\s*CACHE_NAME\s*\}\s*from\s*"\.\.\/pwa\/shell\.js"/.test(shellSrc) &&
      /CACHE_NAME\.replace\("fusegrid-shell-",\s*""\)/.test(shellSrc) &&
      /rev:\s*REV/.test(shellSrc),
    shellSrc.match(/const REV[^\n]*/)?.[0],
  );
  check(
    "shellview routes SCREEN.SETTINGS to drawSettings with app.optRow + app.settings",
    /SCREEN\.SETTINGS/.test(shellSrc) &&
      /row:\s*app\.optRow/.test(shellSrc) &&
      /vals:\s*app\.settings/.test(shellSrc),
    shellSrc.match(/menudraw\.drawSettings\([^;]*\);/s)?.[0],
  );
  check(
    "main.js persists every settings change and re-applies it live",
    /onSettings:/.test(mainSrc) &&
      /saveSettings\(/.test(mainSrc) &&
      /applySettings\(/.test(mainSrc),
    mainSrc.match(/onSettings:[^\n]*\n(?:.*\n){0,3}/)?.[0],
  );
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/headless.test.mjs tests/menudraw.test.mjs
```

Expected: FAIL — `headless.test.mjs` reports `C1 OPTIONS click pushes SETTINGS once -> 2` (the tap router still calls `confirm()`, but the MENU dispatch already works, so the failure that actually bites is `I1 SETTINGS knob confirm -> uiTog` returning `uiSel` from the un-renegotiated wrapper); `menudraw.test.mjs` reports the three new source-regex checks failing because `shellview.js` has no `REV` and `main.js` has no `onSettings`.

- [ ] **Step 3: Implement**

**3a — `src/render/shellview.js`.** Add after line 9:

```js
import { CACHE_NAME } from "../pwa/shell.js";
```

and after the `dims` export (line 25):

```js
/* Build kicker for the OPTIONS head. CACHE_NAME is the only build identifier
   in the repo, and the PWA rule already forces it to change whenever shipped
   bytes do — same precedent as scores arriving through a getter: a screen fed
   from outside app/world gets its value handed in, not re-derived downstream. */
const REV = CACHE_NAME.replace("fusegrid-shell-", "");
```

Replace the MENU items array (56–66) with:

```js
        items: [
          ITEMS[0] + "|" + heatToken(app.heat),
          ITEMS[1] + "|" + heatToken(app.heat),
          ITEMS[2],
          ITEMS[3],
          ITEMS[4],
          ITEMS[5],
          ITEMS[6],
          ITEMS[7],
        ],
```

and delete the `togT: app.togT,` line (54) from the same `ui` object.

Append a SETTINGS branch to the subscreen chain, after the `SCORES` branch (line 105):

```js
  } else if (s === SCREEN.SETTINGS) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawSettings(c, L, app.subT, {
      row: app.optRow,
      vals: app.settings,
      r3d: app.render3d,
      togT: app.togT,
      rev: REV,
    });
  }
```

**3b — `src/main.js`.** Change S1's `const settings = loadSettings();` to `let settings = loadSettings();`, extend the settings import to `import { loadSettings, saveSettings } from "./app/settings.js";`, and in the `createMenuApp({…})` call add two options beside `onPaceChange`:

```js
    settings,
    onSettings: (s) => {
      saveSettings(s);
      applySettings(s);
    },
```

Immediately after the `const app = createMenuApp({…});` statement ends, add:

```js
  /* One live blob from here on: the machine clamped and re-seeded main's copy
     (?render=3d precedence), so onStart / KeyR / the render opts all read the
     object the OPTIONS rows actually mutate. */
  settings = app.settings;
  applySettings(settings);
```

Replace the `app.confirm` cue wrapper (208–222) with:

```js
    app.confirm = () => {
      const sB = app.screen,
        r = c0();
      if (!r) return r;
      if (sB === SCREEN.SETTINGS) audio.play("uiTog");
      else if (
        sB !== SCREEN.HOWTO &&
        sB !== SCREEN.SCORES &&
        sB !== SCREEN.ITEMS &&
        sB !== SCREEN.ENEMIES
      )
        audio.play("uiSel");
      return r;
    };
```

In the canvas `pointerdown` handler (302–313), route SETTINGS taps through `settingsHit` before falling back to `confirm()`. Add one new import line beside the other `./render/` imports (after line 10):

```js
import { settingsHit, layout as menuLayout } from "./render/menudraw.js";
```

`menudraw.js` is the module that owns both, so this is one import, not two — `main.js` has no other reason to reach into `menudraw` and does not gain one. `dims` is already imported from `shellview.js` and is used unchanged. Then replace the handler body's tail with:

```js
      if (app.screen === SCREEN.INTRO) app.skip();
      else if (app.screen === SCREEN.SETTINGS) {
        /* Tap a row = Enter on it; tap outside the band = back. Client px are
           divided by the CSS scale of the OVERLAY canvas — never #gl's Retina
           drawing buffer, which the wrapper owns. */
        const r = canvas.getBoundingClientRect();
        const k = canvas.width / (r.width || canvas.width);
        const { cw, ch } = dims(canvas, curKind);
        const row = settingsHit(
          (ev.clientX - r.left) / k,
          (ev.clientY - r.top) / k,
          menuLayout(cw, ch),
        );
        if (row < 0) app.back();
        else {
          app.optRow = row;
          app.confirm();
        }
      } else app.confirm();
```

and change the handler's signature from `() =>` to `(ev) =>` so the coordinates are available.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test tests/headless.test.mjs tests/menudraw.test.mjs tests/menuapp.test.mjs tests/three.test.mjs tests/settings.test.mjs
```

Then:

```bash
node --test
```

Expected: all green. `heat.test.mjs`, `coach.test.mjs`, `touch.test.mjs`, `pwa.test.mjs` and `music.test.mjs` take **zero edits** in S2 — the pause overlay, the toolbar and the touch pad are all S3's subject.

- [ ] **Step 5: PWA bump, MEMORY, commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together, `current vN → vN+1`. Append to `MEMORY.md` under a `## 2026-09-05 — OPTIONS screen + eight-row menu (S2)` heading (newest first, 1–2 lines): that `SCREEN.SETTINGS` is 10 and appended, that RENDER/SOUND folded into one page so there is one write path per persisted value, that `optRow` is a separate cursor from `cursor`, and that the head kicker reads `CACHE_NAME` so a player can self-diagnose stale cached bytes.

```bash
git add src/render/shellview.js src/main.js tests/headless.test.mjs tests/three.test.mjs tests/menudraw.test.mjs MEMORY.md src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Route SCREEN.SETTINGS and persist every knob through one store call.

shellview derives the OPTIONS build kicker from CACHE_NAME — the only build
identifier the repo has, and one the PWA rule already forces to move whenever
shipped bytes do. Taps map through settingsHit; outside the band backs out.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
