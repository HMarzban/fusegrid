# S1 — Settings Store + Live Knobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every knob the OPTIONS screen will drive exists, persists and applies live — with no UI. At default settings nothing changes on screen or in the mix, and every existing pin passes byte-identically.

**Architecture:** `src/app/settings.js` is one `nb.settings.v1` JSON blob on the `store.js` / `defaultStore()` / try-catch scaffold. Four apply seams, each the cheapest one that already exists: audio scales the **value** at the two peak-amplitude ramp sites (never a new node, or `music.test.mjs:496-529` fails outright); `fx.js` damps **inside** the two existing getters (so both render paths and both call sites are covered without touching either draw site); `lights.js` publishes `LIGHT_BASE` so the live path and the rebuild path read one table; and CAMERA is `rig.dist` in `main.js`, because `dist` is already a live player axis and `main.js:129` already owns the rig object it hands to the wrapper. `createRig()`, the frozen light recipe at `k = 1`, and the wrapper's surface keys are all untouched.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, vendored three.js r160. Zero npm runtime deps. `src/app/settings.js` imports `defaultStore` and nothing else.

**Spec:** `docs/superpowers/specs/2026-09-05-settings-menu-design.md`

**Index:** `docs/superpowers/plans/2026-09-05-settings-menu.md` — its **Shared interfaces** block is authoritative for every signature below.

## Global Constraints

- **One authoritative home per setting.** `step()` is untouched: every value here is app/render layer, none of it reaches the sim.
- **Persistence: one key, one module.** `nb.settings.v1`, one JSON object, `store.js` scaffold verbatim. Any parse failure, any missing field, any non-object → that field's default. **Never throws.**
- **SFX volume: scale the value, do not add a node.** `tests/music.test.mjs:496-529` stays exactly as written — **zero edits**. If it goes red, the change was done wrong; do not edit the suite to make it pass.
- `sfxVol === 0` early-returns beside `muted` at the top of `voice()`/`noise()` — `exponentialRampToValueAtTime(0)` throws, and zero volume means no node at all.
- **Defaults are 100 / 100.** At `musVol = sfxVol = 1` every existing audio pin is byte-identical: `Math.max(MUS_FLOOR, MUS_BASE * 1) === 0.5`, `Math.max(MUS_FLOOR, MUS_DUCK * 1) === 0.16`, `vol * 1 === vol`. `music.test.mjs:437-493` (the duck ramps) takes **zero edits**.
- **`createRig()` takes no parameter** and still returns `{az:0, el:0.54, dist:870, target:[0,-48,0]}`. `three.test.mjs:154-189` and `:191-233` take zero edits.
- **`createLights(biome)` with no `k` is byte-identical to today.** `k` defaults to 1. `three.test.mjs`'s §6 lights block pins 0.72 / 1.26 / 0.54 / 0.30 through a bare call and takes zero edits.
- **Key:fill stays 2.3333:1 at every `k`** because the scale is uniform. Never per-biome, never `toneMappingExposure` — `three.test.mjs:235-252` source-greps for `NoToneMapping` and against `ACESFilmicToneMapping`.
- **No preset dollies in.** Every `CAM_PRESET` value is `>= 870` and inside `[DIST_MIN, DIST_MAX]`. `FAR` stops at 1040.
- **`initFx()` must not reset `flashK`/`shakeK`.** They are user preference, not fx state, and every renderer construction calls `initFx()` — resetting them would silently drop the knobs on a RENDER toggle.
- The wrapper's surface keys stay exactly `canvas,consumeEvents,ctx,getShake,overlay,render`. `o.bright` is an **additive render opt**, never a surface key.
- No comments unless the file already uses explanatory block comments (its style). `audio.js`, `fx.js`, `lights.js`, `camrig.js`, `wrapper.js` and `main.js` all do — sparse, at decision points. `settings.js` follows `plaques.js`'s compact store style.
- Never write the banned grid-bomb franchise name into any committed file.
- PWA: bump `CACHE_NAME` (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`) **together**, `current vN → vN+1`, in every commit here. **Read the current value first — the P4 art program bumps the same two lines concurrently.**
- **`tests/three.test.mjs` belongs to P4 this week.** Re-read it before editing, append new blocks immediately before its `console.log(fail? "THREE FAIL":"THREE OK");` summary, and never edit it by line number.

---

### Task 1: `src/app/settings.js` — the blob, the clamp table, the store

**Files:**
- Create: `src/app/settings.js`
- Create: `tests/settings.test.mjs`
- Modify: `src/pwa/shell.js` (`SRC` array + `CACHE_NAME` line 1), `sw.js:3`

**Interfaces:**
- Consumes: `defaultStore` (`src/app/store.js`)
- Produces:
  - `export const SETTINGS_KEY = "nb.settings.v1"`
  - `export const DEFAULTS = Object.freeze({mus:100,sfx:100,snd:1,r3d:0,cam:0,bri:100,shk:1,flx:0})`
  - `export function clampSettings(raw)` → a fresh 8-key object, key order matching `DEFAULTS`, never throws
  - `export function loadSettings(store)` → clamped object
  - `export function saveSettings(v, store)` → clamps then writes one JSON string

- [ ] **Step 1: Write the failing test** — create `tests/settings.test.mjs`

```js
import {
  SETTINGS_KEY,
  DEFAULTS,
  clampSettings,
  loadSettings,
  saveSettings,
} from "../src/app/settings.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""),
  );
}

/* Map-backed store, the shape every nb.* suite injects. */
const mkStore = () => {
  const mem = new Map();
  return {
    mem,
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
  };
};
const KEYS = "mus,sfx,snd,r3d,cam,bri,shk,flx";
const DEF_JSON =
  '{"mus":100,"sfx":100,"snd":1,"r3d":0,"cam":0,"bri":100,"shk":1,"flx":0}';

check("key is nb.settings.v1", SETTINGS_KEY === "nb.settings.v1", SETTINGS_KEY);
check(
  "DEFAULTS frozen, 100/100 mix and the six spec flags",
  Object.isFrozen(DEFAULTS) && JSON.stringify(DEFAULTS) === DEF_JSON,
  JSON.stringify(DEFAULTS),
);
check(
  "empty store loads DEFAULTS",
  JSON.stringify(loadSettings(mkStore())) === DEF_JSON,
  JSON.stringify(loadSettings(mkStore())),
);
check(
  "no store at all still loads DEFAULTS (headless)",
  JSON.stringify(loadSettings(null)) === DEF_JSON,
);
check("clampSettings returns a fresh object, never DEFAULTS itself", clampSettings(null) !== DEFAULTS);
check(
  "clampSettings key order matches DEFAULTS and carries no extras",
  Object.keys(clampSettings({ mus: 10, zz: 1 })).join() === KEYS,
  Object.keys(clampSettings({ mus: 10, zz: 1 })).join(),
);

{
  const c = clampSettings({ mus: 37, sfx: -40, snd: "yes", r3d: 9, cam: 7, bri: 5, shk: 0, flx: 2 });
  check("mus 37 snaps to the nearest 10", c.mus === 40, c.mus);
  check("sfx -40 clamps up to 0", c.sfx === 0, c.sfx);
  check("snd truthy string -> 1", c.snd === 1, c.snd);
  check("r3d 9 -> 1", c.r3d === 1, c.r3d);
  check("cam 7 clamps down to 2", c.cam === 2, c.cam);
  check("bri 5 clamps up to 70", c.bri === 70, c.bri);
  check("shk 0 stays 0 (a real off, not a missing key)", c.shk === 0, c.shk);
  check("flx 2 -> 1", c.flx === 1, c.flx);
}
{
  const c = clampSettings({ mus: 104, bri: 129, cam: -3, sfx: 95 });
  check("mus 104 clamps down to 100", c.mus === 100, c.mus);
  check("bri 129 snaps to 130", c.bri === 130, c.bri);
  check("cam -3 clamps up to 0", c.cam === 0, c.cam);
  check("sfx 95 rounds half-up to 100", c.sfx === 100, c.sfx);
  check(
    "missing keys fall back to their own default, not to zero",
    c.snd === 1 && c.r3d === 0 && c.shk === 1 && c.flx === 0,
    [c.snd, c.r3d, c.shk, c.flx].join(),
  );
}
{
  for (const bad of [null, undefined, 42, "x", true, []]) {
    check(
      "clampSettings(" + JSON.stringify(bad) + ") is DEFAULTS",
      JSON.stringify(clampSettings(bad)) === DEF_JSON,
      JSON.stringify(clampSettings(bad)),
    );
  }
}
{
  for (const raw of ["", "{", "null", "[1,2]", '"nope"', "undefined", '{"mus":"loud"}']) {
    const st = mkStore();
    st.mem.set(SETTINGS_KEY, raw);
    let threw = false,
      got = null;
    try {
      got = loadSettings(st);
    } catch (_) {
      threw = true;
    }
    check(
      "corrupt " + JSON.stringify(raw) + " self-heals without throwing",
      !threw && !!got && Object.keys(got).join() === KEYS && got.snd === 1 && got.bri === 100 && got.mus === 100,
      threw ? "THREW" : JSON.stringify(got),
    );
  }
}
{
  const st = mkStore();
  saveSettings({ mus: 40, sfx: 0, snd: 0, r3d: 1, cam: 2, bri: 130, shk: 0, flx: 1 }, st);
  check(
    "Map-store round-trip is byte-exact",
    JSON.stringify(loadSettings(st)) ===
      '{"mus":40,"sfx":0,"snd":0,"r3d":1,"cam":2,"bri":130,"shk":0,"flx":1}',
    JSON.stringify(loadSettings(st)),
  );
  check(
    "one JSON object under one key (no six-module fan-out)",
    st.mem.size === 1 && st.mem.has(SETTINGS_KEY),
    [...st.mem.keys()].join(),
  );
  saveSettings({ mus: 37, bri: 1000 }, st);
  check(
    "save clamps on the way out too",
    loadSettings(st).mus === 40 && loadSettings(st).bri === 130,
    JSON.stringify(loadSettings(st)),
  );
}
{
  let threw = false;
  try {
    saveSettings(DEFAULTS, {
      setItem() {
        throw new Error("quota");
      },
    });
    saveSettings(DEFAULTS, null);
    loadSettings({
      getItem() {
        throw new Error("blocked");
      },
    });
  } catch (_) {
    threw = true;
  }
  check("a throwing store never escapes load/save", !threw);
}

console.log("\n  SETTINGS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/settings.test.mjs
```

Expected: FAIL — `Cannot find module '.../src/app/settings.js'` (`ERR_MODULE_NOT_FOUND`).

- [ ] **Step 3: Implement** — create `src/app/settings.js`

```js
import { defaultStore } from "./store.js";

export const SETTINGS_KEY = "nb.settings.v1";
/* One blob, one key. Stored as whole percent, consumed as a scalar
   (mus/100, sfx/100, bri/100) so the JSON stays readable and the clamp table
   below is the only place a range lives. Per-key would mean six modules, six
   SRC entries and six load/save pairs for one screen's state. */
export const DEFAULTS = Object.freeze({
  mus: 100,
  sfx: 100,
  snd: 1,
  r3d: 0,
  cam: 0,
  bri: 100,
  shk: 1,
  flx: 0,
});

const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
const step10 = (v, lo, hi, d) =>
  Math.min(hi, Math.max(lo, Math.round(num(v, d) / 10) * 10)) | 0;
const bit = (v, d) => {
  if (v === undefined || v === null) return d ? 1 : 0;
  if (typeof v === "number") return isFinite(v) && v ? 1 : 0;
  return v ? 1 : 0;
};

export function clampSettings(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  return {
    mus: step10(o.mus, 0, 100, DEFAULTS.mus),
    sfx: step10(o.sfx, 0, 100, DEFAULTS.sfx),
    snd: bit(o.snd, DEFAULTS.snd),
    r3d: bit(o.r3d, DEFAULTS.r3d),
    cam: Math.min(2, Math.max(0, num(o.cam, DEFAULTS.cam) | 0)),
    bri: step10(o.bri, 70, 130, DEFAULTS.bri),
    shk: bit(o.shk, DEFAULTS.shk),
    flx: bit(o.flx, DEFAULTS.flx),
  };
}

export function loadSettings(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return clampSettings(null);
    const raw = st.getItem(SETTINGS_KEY);
    if (raw === null) return clampSettings(null);
    return clampSettings(JSON.parse(raw));
  } catch (_) {
    return clampSettings(null);
  }
}

export function saveSettings(v, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(SETTINGS_KEY, JSON.stringify(clampSettings(v)));
  } catch (_) {}
}
```

In `src/pwa/shell.js`, add `"src/app/settings.js"` to `SRC` between `"src/app/plaques.js"` and `"src/app/store.js"` (the array is alphabetical).

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/settings.test.mjs tests/pwa.test.mjs
```

Expected: all green. `pwa.test.mjs` covers the `SRC`→`PRECACHE` derivation and the `REV === CACHE_NAME` string match.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, then bump `CACHE_NAME` and `sw.js:3` `REV` together, `current vN → vN+1`.

```bash
git add src/app/settings.js tests/settings.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add settings.js: one nb.settings.v1 blob with a clamp table.

Eight knobs in one JSON object on the store.js scaffold — corrupt, partial and
non-object payloads all self-heal per field, and nothing here ever throws.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: MUSIC + SFX volume — scale the value, never add a node

**Files:**
- Modify: `src/audio.js` — closure state beside `muted` (line ~45), `voice` (91–118), `noise` (174–197), `unlock` (251–265), `duck` (269–274), `toggle` (433–444), the returned surface
- Modify: `tests/music.test.mjs` — append before the `console.log("\n  MUSIC RESULT: …")` summary
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `MUS_BASE 0.5`, `MUS_DUCK 0.16`, `MUS_FLOOR 0.0001`
- Produces: `setVols({mus, sfx})` on the `createAudio()` surface → `{mus, sfx}`

- [ ] **Step 1: Write the failing tests** — insert into `tests/music.test.mjs` immediately before its `console.log("\n  MUSIC RESULT: " + pass + " PASS / " + fail + " FAIL");` line

```js
// ---- settings volumes (S1): SFX scales the value, music scales its targets ----
{
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  a.unlock();
  check(
    "setVols reports 1/1 by default and clamps to 0..1",
    JSON.stringify(a.setVols({})) === '{"mus":1,"sfx":1}' &&
      JSON.stringify(a.setVols({ mus: 5, sfx: -2 })) === '{"mus":1,"sfx":0}',
    JSON.stringify(a.setVols({})),
  );
  a.setVols({ mus: 1, sfx: 1 });
  ac.starts.length = 0;
  a.play("uiMove");
  const full = ac.starts[0].g.gain._l.find((e) => e[0] === "ramp")[1];
  a.setVols({ sfx: 0.5 });
  ac.starts.length = 0;
  a.play("uiMove");
  const half = ac.starts[0].g.gain._l.find((e) => e[0] === "ramp")[1];
  check("sfxVol 0.5 halves the peak ramp", near(half, full * 0.5), full + " -> " + half);
  check(
    "sfx still routes direct-to-destination at a scaled volume",
    ac.starts.every((s) => sink(s.g) === ac.destination),
    String(ac.starts.length),
  );
  a.setVols({ sfx: 0 });
  ac.starts.length = 0;
  a.play("uiMove");
  a.play("boom");
  check(
    "sfxVol 0 creates no node at all (exponentialRamp to 0 would throw)",
    ac.starts.length === 0,
    String(ac.starts.length),
  );
  a.setVols({ sfx: 1 });
  ac.starts.length = 0;
  a.play("uiMove");
  check("sfxVol back to 1 restores the authored peak", near(ac.starts[0].g.gain._l.find((e) => e[0] === "ramp")[1], full));
}
{
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  a.setVols({ mus: 0.5 });
  a.unlock();
  a.pump();
  const mg = ac.starts.length ? ac.starts[0].g._dst : null;
  check("musicGain init scales with musVol", !!mg && near(mg.gain.value, 0.25), String(mg && mg.gain.value));
  const lastRamp = () => {
    const l = mg.gain._l;
    for (let i = l.length - 1; i >= 0; i--) if (l[i][0] === "ramp") return l[i];
    return null;
  };
  a.duck(true);
  check("duck target scales too (0.16 * 0.5)", near(lastRamp()[1], 0.08), JSON.stringify(lastRamp()));
  a.duck(false);
  check("duck-out restores the scaled base", near(lastRamp()[1], 0.25), JSON.stringify(lastRamp()));
  a.setVols({ mus: 0 });
  check("musVol 0 floors at MUS_FLOOR, never a literal 0", near(lastRamp()[1], 0.0001), JSON.stringify(lastRamp()));
  a.setVols({ mus: 1 });
  check(
    "musVol 1 is byte-identical to today's MUS_BASE",
    near(lastRamp()[1], 0.5),
    JSON.stringify(lastRamp()),
  );
  a.toggle();
  check("mute still wins over any musVol", near(lastRamp()[1], 0.0001), JSON.stringify(lastRamp()));
  a.toggle();
  check("unmute returns to the scaled base", near(lastRamp()[1], 0.5), JSON.stringify(lastRamp()));
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/music.test.mjs
```

Expected: FAIL — `TypeError: a.setVols is not a function` on the first new block.

- [ ] **Step 3: Implement** — `src/audio.js`

Beside `let ctx = null, muted = false, ok = true;` (line ~44), add:

```js
  /* Settings volumes (nb.settings.v1). Stored as 0..1 scalars and applied by
     SCALING THE VALUE: SFX multiply their one peak-amplitude ramp, music
     multiplies its three gain targets. No sfxGain node — that would re-couple
     duck() to SFX and fail the direct-to-destination pin. At 1/1 every number
     below is byte-identical to the authored mix. */
  let musVol = 1,
    sfxVol = 1;
  const musBase = () => Math.max(MUS_FLOOR, MUS_BASE * musVol);
  const musDuck = () => Math.max(MUS_FLOOR, MUS_DUCK * musVol);
```

In `voice()` (line 92) and `noise()` (line 175), replace each guard line:

```js
    if (muted || sfxVol <= 0 || !ensure()) return;
```

In `voice()` replace line 113 with `g.gain.exponentialRampToValueAtTime(vol * sfxVol, t + 0.004);`, and in `noise()` replace line 192 with `g.gain.exponentialRampToValueAtTime(vol * sfxVol, t + 0.003);`. The `g.connect(c.destination)` line in each is **not** touched, and neither is any of the ~2 dozen `voice`/`noise` call sites.

In `unlock()` replace line 257 with `musicGain.gain.value = muted ? MUS_FLOOR : musBase();`.

In `duck()` replace line 273 with `rampMusicGain(on ? musDuck() : musBase(), on ? 0.35 : 0.6);`.

In `toggle()` replace the `rampMusicGain(...)` argument list (lines 440–441) with:

```js
          muted ? MUS_FLOOR : ducked ? musDuck() : musBase(),
          muted ? 0.01 : 0.6,
```

Add to the returned object, immediately after `unlocked,` (line 446):

```js
    setVols(v) {
      const c = (x) => (typeof x === "number" && isFinite(x) ? Math.max(0, Math.min(1, x)) : 1);
      if (v && v.mus != null) musVol = c(v.mus);
      if (v && v.sfx != null) sfxVol = c(v.sfx);
      if (musicGain)
        rampMusicGain(muted ? MUS_FLOOR : ducked ? musDuck() : musBase(), 0.12);
      return { mus: musVol, sfx: sfxVol };
    },
```

- [ ] **Step 4: Run to PASS — and the zero-edit audio guard**

```bash
node --test tests/music.test.mjs tests/menuapp.test.mjs tests/headless.test.mjs
```

Expected: all green. `music.test.mjs:496-529` (SFX direct-to-destination) and `:437-493` (the `0.5 → 0.16` duck ramps) must pass with **zero edits to those blocks** — at the default `musVol = sfxVol = 1` every target is the same number it was. If either goes red, the scaling was applied in the wrong place; revert and redo. Do not touch the suite.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together, `current vN → vN+1`.

```bash
git add src/audio.js tests/music.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Scale SFX and music volume by value, not by a new gain node.

voice/noise multiply their one peak ramp and early-return at sfxVol 0; the
three musicGain targets multiply and floor at MUS_FLOOR. SFX stay wired
direct-to-destination, so duck() still never touches them.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `setFxOpts`, `LIGHT_BASE` and the `o.bright` live path

**Files:**
- Modify: `src/render/fx.js` — module state beside `let tag=null;` (line 14), `getShake` (19), `getFlash` (20), `initFx` (16–18)
- Modify: `src/render/three/lights.js` — `LIGHT_BASE`, `createLights(biome, k)`, `applyBright`
- Modify: `src/render/three/scene.js` — `buildScene(world, atlas, bright)`, expose `lights` on the returned scene
- Modify: `src/render/three/wrapper.js` — `brightK` state, `rebuild`, `render`'s `o.bright`
- Modify: `tests/settings.test.mjs` — fx block
- Modify: `tests/three.test.mjs` — **append** a `§SET` lights block before the `THREE OK` summary
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `fx.flashT`, `fx.shakeX/Y`, `LIGHT_BASE`
- Produces:
  - `export function setFxOpts({flashK, shakeK})` → `{flashK, shakeK}`
  - `export function getFxOpts()` → `{flashK, shakeK}`
  - `export const LIGHT_BASE = Object.freeze({hemi:0.72, key:1.26, fill:0.54, amb:0.30})`
  - `export function createLights(biome, k)` — `k` defaults to 1
  - `export function applyBright(L, k)` → `L`
  - `buildScene(world, atlas, bright)`; the returned scene object gains `lights`
  - `render(world, dt, o)` honours `o.bright`

- [ ] **Step 1: Write the failing tests**

Extend `tests/settings.test.mjs`'s imports with:

```js
import {
  setFxOpts,
  getFxOpts,
  getShake,
  getFlash,
  initFx,
  onEvent,
  updateFx,
} from "../src/render/fx.js";
```

and insert before its `console.log("\n  SETTINGS RESULT: …")` summary:

```js
{
  initFx();
  setFxOpts({ flashK: 1, shakeK: 1 });
  check(
    "setFxOpts defaults are 1/1",
    JSON.stringify(getFxOpts()) === '{"flashK":1,"shakeK":1}',
    JSON.stringify(getFxOpts()),
  );
  onEvent({ seed: 1, level: 1 }, { t: "boom", x: 10, y: 10 }, 0);
  updateFx(0);
  const rawFlash = getFlash(),
    rawShake = getShake();
  check(
    "boom leaves a live flash and a live shake to damp",
    rawFlash > 0 && (Math.abs(rawShake.x) > 0 || Math.abs(rawShake.y) > 0),
    rawFlash + "/" + JSON.stringify(rawShake),
  );
  setFxOpts({ flashK: 0.25 });
  check(
    "flashK 0.25 quarters getFlash() (the #ffe8a8 wash peaks at 0.07, not 0.28)",
    Math.abs(getFlash() - rawFlash * 0.25) < 1e-9,
    rawFlash + " -> " + getFlash(),
  );
  setFxOpts({ shakeK: 0 });
  check("shakeK 0 zeroes BOTH getShake axes", getShake().x === 0 && getShake().y === 0, JSON.stringify(getShake()));
  setFxOpts({ flashK: 1, shakeK: 1 });
  check(
    "restoring 1/1 returns the raw values untouched",
    Math.abs(getFlash() - rawFlash) < 1e-9 && Math.abs(getShake().x - rawShake.x) < 1e-9,
    getFlash() + "/" + getShake().x,
  );
  setFxOpts({ flashK: 0.25, shakeK: 0 });
  initFx();
  check(
    "initFx() clears fx state but NOT the user knobs (every renderer build calls it)",
    getFlash() === 0 && JSON.stringify(getFxOpts()) === '{"flashK":0.25,"shakeK":0}',
    JSON.stringify(getFxOpts()),
  );
  check(
    "setFxOpts clamps out of range and ignores missing keys",
    JSON.stringify(setFxOpts({ flashK: 5 })) === '{"flashK":1,"shakeK":0}' &&
      JSON.stringify(setFxOpts({ shakeK: -1 })) === '{"flashK":1,"shakeK":0}',
    JSON.stringify(getFxOpts()),
  );
  setFxOpts({ flashK: 1, shakeK: 1 });
}
```

In `tests/three.test.mjs`, extend the lights import to `import {createLights, LIGHT_BASE, applyBright} from "../src/render/three/lights.js";`, then append immediately before `console.log(fail? "THREE FAIL":"THREE OK");`:

```js
// ---- §SET brightness: one uniform multiplier over the frozen recipe ----
{
  const b=BIOMES[0];
  const L1=createLights(b), L0=createLights(b,1);
  check("§SET bare createLights(biome) is byte-identical to k=1 and to"
      +" LIGHT_BASE",
    L1.hemi.intensity===L0.hemi.intensity&&L1.dir.intensity===L0.dir.intensity
    &&L1.fill.intensity===L0.fill.intensity&&L1.amb.intensity===L0.amb.intensity
    &&L1.hemi.intensity===LIGHT_BASE.hemi&&L1.dir.intensity===LIGHT_BASE.key
    &&L1.fill.intensity===LIGHT_BASE.fill&&L1.amb.intensity===LIGHT_BASE.amb,
    [L1.hemi.intensity,L1.dir.intensity,L1.fill.intensity,
      L1.amb.intensity].join("/"));
  for(const k of [0.7,1.3]){
    const L=createLights(b,k);
    check("§SET createLights scales all four intensities at k="+k,
      Math.abs(L.hemi.intensity-LIGHT_BASE.hemi*k)<1e-9
      &&Math.abs(L.dir.intensity-LIGHT_BASE.key*k)<1e-9
      &&Math.abs(L.fill.intensity-LIGHT_BASE.fill*k)<1e-9
      &&Math.abs(L.amb.intensity-LIGHT_BASE.amb*k)<1e-9,
      [L.hemi.intensity,L.dir.intensity,L.fill.intensity,
        L.amb.intensity].join("/"));
    check("§SET key:fill stays 2.3333 at k="+k+" (a uniform scale cannot"
        +" move a ratio)",
      Math.abs(L.dir.intensity/L.fill.intensity-1.26/0.54)<1e-9,
      (L.dir.intensity/L.fill.intensity).toFixed(4));
    check("§SET k="+k+" leaves the shadow rig frozen",
      L.dir.castShadow===true&&L.fill.castShadow===false
      &&L.dir.shadow.mapSize.width===1024&&L.dir.shadow.camera.left===-420
      &&L.dir.shadow.camera.far===1400);
   }
  const A=createLights(b,1);
  applyBright(A,1.3);
  check("§SET applyBright rescales from LIGHT_BASE, never from the current"
      +" value (repeat calls do not compound)",
    Math.abs(A.dir.intensity-LIGHT_BASE.key*1.3)<1e-9,String(A.dir.intensity));
  applyBright(A,1.3);
  check("§SET applyBright is idempotent",
    Math.abs(A.dir.intensity-LIGHT_BASE.key*1.3)<1e-9,String(A.dir.intensity));
  applyBright(A,1);
  check("§SET applyBright(L,1) restores the frozen recipe exactly",
    A.hemi.intensity===LIGHT_BASE.hemi&&A.dir.intensity===LIGHT_BASE.key
    &&A.fill.intensity===LIGHT_BASE.fill&&A.amb.intensity===LIGHT_BASE.amb);
}
{
  const r=createRenderer3D(null,null,{audio:null,hud:null});
  const w=createWorld(11,1); loadLevel(w,1,false); w.state="PLAY";
  const key=()=>{ let d=null;
    r._dbg.scene.traverse(o=>{ if(o.isDirectionalLight&&o.castShadow)d=o; });
    return d; };
  r.render(w,1/60);
  check("§SET default render leaves the key at LIGHT_BASE (k=1 is a no-op)",
    key().intensity===LIGHT_BASE.key,String(key().intensity));
  r.render(w,1/60,{bright:1.3});
  check("§SET o.bright rescales the live lights in place",
    Math.abs(key().intensity-LIGHT_BASE.key*1.3)<1e-9,String(key().intensity));
  loadLevel(w,2,false);
  r.render(w,1/60,{bright:1.3});
  check("§SET a level rebuild keeps the stored brightness",
    Math.abs(key().intensity-LIGHT_BASE.key*1.3)<1e-9,String(key().intensity));
  r.render(w,1/60,{bright:1});
  check("§SET back to k=1 restores the frozen recipe",
    key().intensity===LIGHT_BASE.key,String(key().intensity));
  check("§SET wrapper surface keys unchanged by the brightness opt",
    Object.keys(r).sort().join(",")
      ==="canvas,consumeEvents,ctx,getShake,overlay,render",
    Object.keys(r).sort().join(","));
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/settings.test.mjs
node --test tests/three.test.mjs
```

Expected: `settings.test.mjs` FAILs with `SyntaxError: The requested module '../src/render/fx.js' does not provide an export named 'setFxOpts'`; `three.test.mjs` FAILs with the same shape for `LIGHT_BASE`.

- [ ] **Step 3: Implement**

**3a — `src/render/fx.js`.** After `let tag=null;` (line 14) add:

```js
/* Settings damping (nb.settings.v1). Applied INSIDE the two getters so both
   render paths and both call sites are covered without touching either draw
   site. NOT reset by initFx(): these are user preference, and every renderer
   construction calls initFx() — a RENDER toggle would otherwise drop them. */
let flashK=1, shakeK=1;
const k01=(v,d)=>(typeof v==="number"&&isFinite(v)?Math.max(0,Math.min(1,v)):d);
export function setFxOpts(o){
  if(o){ if(o.flashK!=null)flashK=k01(o.flashK,flashK);
    if(o.shakeK!=null)shakeK=k01(o.shakeK,shakeK); }
  return {flashK,shakeK};
}
export function getFxOpts(){ return {flashK,shakeK}; }
```

then replace lines 19–20 with:

```js
export function getShake(){ return {x:fx.shakeX*shakeK, y:fx.shakeY*shakeK}; }
export function getFlash(){ return fx.flashT*flashK; }
```

`initFx()` (16–18) is unchanged — it must keep resetting only `shakeT/shakeX/shakeY/flashT/parts`.

**3b — `src/render/three/lights.js`.** Add above `createLights`:

```js
/* The frozen recipe as data, so the live BRIGHTNESS path and the rebuild path
   read ONE table. A uniform multiplier cannot move key:fill (2.3333), which
   is the whole softness budget under PCFSoftShadowMap. */
export const LIGHT_BASE=Object.freeze({hemi:0.72,key:1.26,fill:0.54,amb:0.30});
const briK=(k)=>(typeof k==="number"&&isFinite(k)&&k>0?k:1);
```

change the signature to `export function createLights(biome,k){` and open it with `const m=briK(k);`, then replace the four intensity literals: `0.72` → `LIGHT_BASE.hemi*m`, `1.26` → `LIGHT_BASE.key*m`, `0.54` → `LIGHT_BASE.fill*m`, `0.30` → `LIGHT_BASE.amb*m`. Everything else in the file — colours, positions, shadow camera, bias — is byte-identical. Then append:

```js
/* Live rescale for the OPTIONS BRIGHTNESS row: always from LIGHT_BASE, never
   from the current intensity, so repeated applies never compound. */
export function applyBright(L,k){
  const m=briK(k);
  if(!L)return L;
  L.hemi.intensity=LIGHT_BASE.hemi*m;
  L.dir.intensity=LIGHT_BASE.key*m;
  L.fill.intensity=LIGHT_BASE.fill*m;
  L.amb.intensity=LIGHT_BASE.amb*m;
  return L;
}
```

**3c — `src/render/three/scene.js`.** Change the signature to `export function buildScene(world,atlas,bright){`, change line 125 to `const lights=createLights(biome,bright);`, and add `lights` to the returned scene object so line 130 reads:

```js
  const scene={group,level:world.level,brick,pools,lights,
```

The lights are exposed deliberately: `scene3.traverse(o=>o.isLight)` would also catch S4's pooled flash `PointLight`s, whose intensity is animated per frame.

**3d — `src/render/three/wrapper.js`.** Extend the lights import — the file imports `buildScene` from `./scene.js` already, so add a new line after it:

```js
import {applyBright} from "./lights.js";
```

Beside `let sc=null;` (line 89) add `let brightK=1;`, change `rebuild`'s body line 93 to `sc=buildScene(world,getAtlas(world),brightK);`, and in `render()` replace line 116 with:

```js
    const bk=o&&typeof o.bright==="number"&&isFinite(o.bright)?o.bright:brightK;
    const bChanged=bk!==brightK;
    brightK=bk;
    if(!sc||sc.update(world))rebuild(world);   // brick rescan / level rebuild
    else if(bChanged&&sc.lights)applyBright(sc.lights,brightK);
```

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/settings.test.mjs tests/three.test.mjs tests/r3d.test.mjs tests/pickups.test.mjs tests/menudraw.test.mjs tests/headless.test.mjs
```

Expected: all green, and `three.test.mjs`'s §6 lights block, §4b framing gate, §6b NoToneMapping gate and §1 wrapper surface contract all pass with **zero edits** — `k` defaults to 1 everywhere.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together, `current vN → vN+1`.

```bash
git add src/render/fx.js src/render/three/lights.js src/render/three/scene.js src/render/three/wrapper.js tests/settings.test.mjs tests/three.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add the flash/shake damp and the uniform brightness multiplier.

setFxOpts lands inside the two fx getters, so both render paths and both call
sites are covered without touching a draw site. LIGHT_BASE gives the live path
and the rebuild path one table; key:fill stays 2.3333 at every k.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `CAM_PRESET` and the boot-apply wiring in `main.js`

**Files:**
- Modify: `src/render/three/camrig.js` — `CAM_PRESET`, `CAM_NAME`, `camPreset` beside `DEF` (line 25)
- Modify: `src/main.js` — imports (24–42), the settings block after `onSource` (line 177), `onStart` (165), `input.onUiKey`'s `KeyR` (255–260), the render-opts ternary (536–557)
- Modify: `tests/three.test.mjs` — **append** a `§SET` camera block
- Modify: `MEMORY.md`, `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `loadSettings`, `setFxOpts`, `audio.setVols`, `applyOrbit`, `DIST_MIN`, `DIST_MAX`
- Produces:
  - `export const CAM_PRESET = Object.freeze([870, 960, 1040])`
  - `export const CAM_NAME = Object.freeze(["STANDARD", "WIDE", "FAR"])`
  - `export function camPreset(i)` → clamped dist
  - `main.js` closure `settings` + `applySettings(S)`

- [ ] **Step 1: Write the failing tests** — in `tests/three.test.mjs`, extend the camrig import to

```js
import {createRig, orbitBy, dollBy, resetOrbit, applyOrbit,
  SHAKE_3D_K, DRAG_K, DIST_MIN, DIST_MAX,
  CAM_PRESET, CAM_NAME, camPreset} from "../src/render/three/camrig.js";
```

then append before `console.log(fail? "THREE FAIL":"THREE OK");`:

```js
// ---- §SET camera presets: persisted dolly stops, not new rigs ----
/* Re-runs §4b's own projection at each preset. The rig's el/az/target never
   move — only dist — so the only gate that can break is the bezel, which is
   monotonically increasing as dist shrinks: 870 already sits at 1.0974 of
   1.10 and dist 860 scores 1.1148. The two §4b FLOORS bind the authored
   default only; they are not a ceiling on where a player may dolly, which the
   always-live wheel already proves (DIST_MAX 1400 scores 0.5256 today). */
{
  const W4=CFG.COLS*CFG.TILE, D4=CFG.ROWS*CFG.TILE;
  const at=(dist)=>{
    const cam=new THREE.PerspectiveCamera(45,W4/D4,1,2500);
    const st=createRig(); st.dist=dist;
    applyOrbit(cam,st,{x:0,y:0});
    cam.updateMatrixWorld(true);
    const ndc=(x,y,z)=>new THREE.Vector3(x,y,z).project(cam);
    let worst=0, bez=0;
    for(const b of BIOMES)
      for(const sx of [-1,1])for(const sz of [-1,1]){
        for(const y of [0,b.hWall]){
          const v=ndc(sx*W4/2,y,sz*D4/2);
          worst=Math.max(worst,Math.abs(v.x),Math.abs(v.y));
         }
        for(const y of [0,b.hWall+RIM_LIP]){
          const v=ndc(sx*(W4/2+RIM_W),y,sz*(D4/2+RIM_W));
          bez=Math.max(bez,Math.abs(v.x),Math.abs(v.y));
         }
       }
    return {worst,bez};
   };
  check("§SET CAM_PRESET is exactly [870,960,1040], frozen",
    Object.isFrozen(CAM_PRESET)&&CAM_PRESET.join()==="870,960,1040",
    CAM_PRESET.join());
  check("§SET CAM_NAME is STANDARD/WIDE/FAR, frozen, same arity",
    Object.isFrozen(CAM_NAME)&&CAM_NAME.join()==="STANDARD,WIDE,FAR"
    &&CAM_NAME.length===CAM_PRESET.length, CAM_NAME.join());
  check("§SET no preset dollies IN past the authored 870 (dist 860 scores"
      +" bezel 1.1148 and fails outright)",
    CAM_PRESET.every(d=>d>=870), CAM_PRESET.join());
  check("§SET every preset sits inside the live dolly clamps",
    CAM_PRESET.every(d=>d>=DIST_MIN&&d<=DIST_MAX),
    DIST_MIN+".."+DIST_MAX);
  check("§SET STANDARD IS the authored rig — a bare createRig() is unmoved",
    CAM_PRESET[0]===createRig().dist&&createRig().el===0.54
    &&createRig().az===0&&createRig().target[1]===-48,
    JSON.stringify(createRig()));
  for(let i=0;i<CAM_PRESET.length;i++){
    const r=at(CAM_PRESET[i]);
    check("§SET "+CAM_NAME[i]+" keeps the cabinet bezel on screen"
        +" (|ndc|<=1.10)", r.bez<=1.10, r.bez.toFixed(4));
   }
  check("§SET FAR still holds the worst playfield corner above 0.75"
      +" (dist 1080 scores 0.7180 = a board in a void)",
    at(1040).worst>=0.75, at(1040).worst.toFixed(4));
  check("§SET camPreset clamps every out-of-range index",
    camPreset(-5)===870&&camPreset(0)===870&&camPreset(1)===960
    &&camPreset(2)===1040&&camPreset(99)===1040&&camPreset(undefined)===870,
    [camPreset(-5),camPreset(99),camPreset(undefined)].join());
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/three.test.mjs
```

Expected: FAIL — `SyntaxError: The requested module '../src/render/three/camrig.js' does not provide an export named 'CAM_PRESET'`.

- [ ] **Step 3: Implement**

**4a — `src/render/three/camrig.js`.** After the `DEF` block comment and `const DEF=…` (line 25), add:

```js
/* CAMERA presets are persisted starting DOLLY positions, not new rigs: el, az
   and target never move. dist is already a live player axis (wheel/pinch runs
   unguarded in GAME+3d within DIST_MIN/DIST_MAX), so a preset is that same
   axis made discoverable. Measured against the §4b projection at RIM_W 36 /
   RIM_LIP 6: bezel 1.0974 / 0.9622 / 0.8673 against the 1.10 gate, worst
   playfield corner 0.9449 / 0.8322 / 0.7524. No preset dollies IN (860 scores
   1.1148); FAR stops at 1040 because 1080 drops the corner to 0.7180. */
export const CAM_PRESET=Object.freeze([870,960,1040]);
export const CAM_NAME=Object.freeze(["STANDARD","WIDE","FAR"]);
export function camPreset(i){
  const n=typeof i==="number"&&isFinite(i)?i|0:0;
  return CAM_PRESET[n<0?0:n>2?2:n];
}
```

**4b — `src/main.js` imports.** Add `import { loadSettings } from "./app/settings.js";` beside the other `./app/` store imports (after line 24), add `import { setFxOpts } from "./render/fx.js";` after line 11, and extend line 41 to:

```js
import { createRig, resetOrbit, mountOrbitCtl, camPreset } from "./render/three/camrig.js";
```

**4c — the settings block.** Immediately after `const onSource = () => {…};` (ends line 177) and **before** `const app = createMenuApp({`:

```js
  /* SETTINGS (nb.settings.v1, src/app/settings.js): loaded once at boot and
     pushed into every live knob. S1 ships no UI — these are the seams S2's
     OPTIONS rows drive. At the shipped defaults applySettings is a no-op in
     every direction: vols 1/1, flashK/shakeK 1/1, dist 870, bright 1. */
  const settings = loadSettings();
  if (settings.snd === 0 && audio && audio.toggle) audio.toggle();
  const applySettings = (S) => {
    if (audio && audio.setVols)
      audio.setVols({ mus: S.mus / 100, sfx: S.sfx / 100 });
    setFxOpts({ flashK: S.flx ? 0.25 : 1, shakeK: S.shk ? 1 : 0 });
    rig.dist = camPreset(S.cam);
  };
  applySettings(settings);
```

**4d — `createMenuApp`'s two seeded fields.** Replace line 180 with `sound: settings.snd !== 0,` and line 185 with:

```js
    render3d: urlKind === "3d" || opts.render3d === true || settings.r3d === 1,
```

`?render=3d` and `opts.render3d` still win; the blob only decides when neither is set.

**4e — re-apply the preset wherever the rig resets.** In `onStart`, after `resetOrbit(rig);` (line 165) add `rig.dist = camPreset(settings.cam);`. In `input.onUiKey`'s `KeyR` branch, after `resetOrbit(rig);` (line 259) add the same line — `KeyR` restores the authored rig and then re-applies the preset, which at the default `STANDARD` is 870 exactly, so `three.test.mjs:320-375` is unmoved.

**4f — thread `o.bright`.** Replace the `renderer.render(…)` call (536–557) with a hoisted opts variable:

```js
    let ro = attract
      ? { hud: false }
      : app.screen === SCREEN.INTRO && curKind === "3d"
        ? { intro: app.subT }
        : app.screen === SCREEN.GAME
          ? {
              hud: true, // S4 overlay HUD chips
              // ghost coach: GAME screen (not ATTRACT, whose demo world is
              // state PLAY too) AND world.state==="PLAY" (not PAUSE/WIN/LOSE).
              // Fade alpha (not a bool) computed here from COACH_DUR so
              // render/scenes.js never re-derives that constant.
              coach:
                world.state === "PLAY" &&
                coachOpen(coachSeen, coachT, coachPlanted)
                  ? Math.max(0, 1 - coachT / COACH_DUR)
                  : 0,
            }
          : undefined;
    // BRIGHTNESS is 3D only: CLASSIC 2D blits the authored hex, and a canvas
    // filter over it would regrade the palette the 3D pass exists to match.
    if (curKind === "3d") ro = { ...(ro || {}), bright: settings.bri / 100 };
    renderer.render(attract && demo ? demo.world : world, dt, ro);
```

`{bright:1}` where `undefined` used to go is behaviourally identical: `o.hud` is `undefined`, and `!(o && o.hud === false)` is still `true`, so `updateHud` runs exactly as before.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test tests/three.test.mjs tests/settings.test.mjs tests/music.test.mjs tests/headless.test.mjs tests/coach.test.mjs
```

Then:

```bash
node --test
```

Expected: all green, with **zero edits** to any suite other than `settings.test.mjs`, `music.test.mjs` and `three.test.mjs`. This is the S1 acceptance property: at the shipped defaults nothing changed on screen or in the mix, so every pre-existing pin still holds.

- [ ] **Step 5: PWA bump, MEMORY, commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together, `current vN → vN+1`. Append to `MEMORY.md` under a `## 2026-09-05 — Settings store + live knobs (S1)` heading (newest first, 1–2 lines): that `nb.settings.v1` is one clamped blob, that SFX/music scale by value rather than through a new gain node so the direct-to-destination pin never moved, that `LIGHT_BASE` gives the live and rebuild brightness paths one table, and that CAMERA is `rig.dist` from a three-stop preset list, all `>= 870`.

```bash
git add src/render/three/camrig.js src/main.js tests/three.test.mjs MEMORY.md src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Wire every settings knob to its live seam at boot.

CAMERA is the dist axis the wheel already drives, three stops all >= 870 so no
preset dollies past the 1.10 bezel gate. main loads nb.settings.v1 once and
pushes it into audio volumes, the fx damps, the rig and o.bright.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
