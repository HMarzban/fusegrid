# Fusegrid — REAL 3D camera and phone fit, binding design (2026-10-08)

Binding spec for three items, shipped in this order: **C1** (rig, lens, zoom
reset), **C2** (`fit()` seam and phone layout), **T1** (tap targets for MEDALS
and Reset on STATS). C2 goes before T1 only because of the `main.js` line
budget (§5). Each item lands green, is committed and reviewed, and only then
does the next one start.

Every number below was re-measured at `2b4ffb4` with the §4b projection from
`tests/three.test.mjs`, run against the real `camrig.js` / `scene.js` /
`config.js`. The MAKO occlusion figures were re-run through the camera
study's raycast against the real `buildScene`. Where the study
(`.superpowers/sdd/2026-10-08-wave3/camera/study.md`, git-ignored) and the
re-measurement disagree, the measured value is written here, and §7 lists each
correction. Public copy never names the private reference game. The word
`leaderboard` stays out of `src/` and `tests/`.

## Rulings this spec is built on

- **Ruling 2026-10-08 (camera, user):** this is the third camera complaint.
  The user said "right now the camera angle in 3D world is not correct", and
  picked all four symptoms: too top-down and flat, board too small,
  skewed/off-centre, and wrong on phone. They asked to "review it again from
  top to down and ensure the board game will be visible for gamer". From the
  contact sheet (`camera-candidates.png`) they **picked candidate C**:
  - polar `el 0.66` (52.2° above the horizon)
  - vertical FOV 24
  - `dist 1503`
  - `target [0,-17,0]`
  - `az 0`
  - plus the new `fit()` reserves, and the phone layout with the pad and bomb
    off the board
- **Ruling 2026-10-08 (zoom, user):** the wheel/pinch dolly still works. `dist`
  **resets to the selected CAMERA preset at every room start and every run
  start**, so a stray trackpad scroll never persists.
- **Ruling 2026-10-08 (unchanged):** the whole board stays visible. There is no
  follow-cam, and there is one global rig, never one per biome. The light
  recipe stays as it is (`NoToneMapping`, no fog, key:fill 2.3333) unless the
  headed check proves a problem.
- **Ruling 2026-10-08 (touch reachability, user):** on touch devices, MEDALS
  (T on STATS) and Reset (two-press R on STATS) must be reachable by TAP. This
  supersedes the "Keyboard-only, by design" bullet of the wave-3 spec §7.4 (D3).
  The two-press confirm stays.
- This **supersedes** the AGENTS.md frozen rig
  `{el:0.54, dist:870, target y -48}` at FOV 45.

**Hard gates:**
- The `src/core` diff stays EMPTY.
- `main.js` stays inside the budget in §5.
- Each code commit gets one paired `CACHE_NAME` + `sw.js` REV bump (§6).
- The draw-call budget and fat-world 141 do not move. Nothing here adds a mesh.
- The iso/2D render paths (`r3d/`, `cameraCtl.js`, `renderer.js`) and the
  600×520 / 608×352 logical boxes are untouched. Only `fit()` changes, and it
  sizes every kind.

---

## 1. Diagnosis (measured at HEAD)

| | HEAD (45 / 870 / −48, el .54) | **C (24 / 1503 / −17, el .66)** |
|---|---|---|
| worst playfield corner, max abs ndc (ICE, near) | 0.9449 | **0.9397** |
| ndc_y span / centre `cy` | 1.3786 / 0.0005 | **1.3802 / 0.0005** |
| bezel, max abs ndc (gate ≤ 1.10) | 1.0974 | **1.0746** |
| board fill of the 600×520 canvas | 50.9% | **54.2%** |
| keystone, far/near floor width | 0.722 | **0.807** |
| side:top for a cube at rows 1 / 6 / 11 | 0.939 / 0.638 / **0.339** | 0.970 / 0.794 / **0.617** |
| tile width in canvas px, rows 1 / 6 / 11 | 26.95 / 30.29 / 34.58 | 30.35 / 32.85 / 35.79 |
| far ICE wall top / row-1 far edge (canvas y; HUD chips sit at y 10–40) | 80.7 / 117.8 | 80.4 / 121.3 |
| MAKO visible behind far ICE pillar, eyes/body | 96 / 46 % | 96 / 46 % |
| MAKO visible behind near ICE border, eyes/body | 100 / 97 % | 100 / 68 % |

- **"Security cam" and "skewed" are one defect.** At FOV 45 the viewing angle
  changes across the board. The near half (side:top 0.339) is *more* top-down
  than the rejected `el 0.419` rig (0.445), and the blocks splay outward
  (keystone 0.72). FOV 24 from further back flattens that. The rig is lower
  and still fills more of the frame.
- **"Off-centre" is the bezel, not a bug.** The near rim bleeds off both bottom
  corners while the far rim stays inside. `cy` is 0.0005, the dpr-2 buffer is
  uncropped, and `#gl`/`#c` share one CSS box.
- **"Too small" is mostly `fit()`.** It reserves 180 px of height everywhere
  (`main.js:89`), but only the touch pause pill needs that. A landscape phone
  gets 225×195 CSS px at scale 0.375.
- **Dolly.** A wheel/pinch change survives a room advance. Today `dist` resets
  only at `onStart` (`main.js:226-227`), on R in GAME (`:383-387`), and when
  OPTIONS applies (`:246`).

---

## 2. C1 — rig, lens, zoom reset

### 2.1 Values

| Where | Was | Becomes | Measured reason |
|---|---|---|---|
| `camrig.js:25` `DEF` | `{az:0,el:0.54,dist:870,target:[0,-48,0]}` | `{az:0,el:0.66,dist:1503,target:[0,-17,0]}` | The user's pick. The solver for worst 0.94 at el .66 / FOV 24 returns 1503 / −16.73 |
| `camrig.js` (new export) | — | `export const CAM_FOV=24;` | `wrapper.js` and the tests import it, so the lens has one source |
| `camrig.js:36` `CAM_PRESET` | `[870,960,1040]` | `[1503,1671,1827]` | Same worst-corner values as before: 0.9397 / 0.8323 / 0.7524 (old 0.9449 / 0.8322 / 0.7524). Bezel 1.0746 / 0.9495 / 0.8568 |
| `camrig.js:8` `DIST_MIN` / `DIST_MAX` | 560 / 1400 | **892 / 2529** | Same clamp extremes: 892 scores worst 1.7709 (560 scored 1.7718). 2529 scores 0.5255 (1400 scored 0.5256) |
| `camrig.js:27` `WHEEL_DOLLY_K` | 0.6 | **1.04** | 0.6 × 1503/870 = 1.0366, so one wheel tick dollies the same fraction of the default distance. Pinch is already multiplicative and does not change |
| `camrig.js:9` `SHAKE_3D_K` | 0.09 | **0.09 (no change)** | Shake relative to a tile is K·shake/TILE, which does not depend on the camera. On screen it grows 12.8%, exactly as the board does |
| `wrapper.js:70` | `PerspectiveCamera(45,W/H,1,2500)` | `PerspectiveCamera(CAM_FOV,W/H,1,3000)` | Furthest bezel corner at `DIST_MAX` 2529 is 2918.6 away, over every az and `EL_MIN..EL_MAX` (`?orbit=1`). Axis-aligned it is 2728.9 |
| `particles.js:38` `size` | 10 | **19.5** | `sizeAttenuation` ignores FOV, so point:tile scales with tan(fov/2). tan 22.5°/tan 12° = 1.9487 keeps every particle at its authored size relative to the board |
| `flythrough.js:14-15` | `BASE_DIST 870`, `SETTLE_EL 0.54`, `TARGET_Y −48` | `1503`, `0.66`, `−17` | The last intro frame must equal `createRig()`, so there is no pop at handoff |
| `flythrough.js:28` intro start el | `0.62` | **`0.74`** | Keeps the same 0.08 lift into the settle el, so "camera LIFTS into place" and the S3.C monotonic pin stay true |

- `EL_MIN` / `EL_MAX` / `DRAG_K` do not change.
- No preset may dolly in past 1503. The bezel limit is **1473.54**: 1474
  scores 1.0996, 1473 scores 1.1005, 1470 scores 1.1031.
- FAR stops at 1827, because 1905 drops the worst corner to 0.7180. That is the
  same edge that 1080 was on the old rig.
- **Fill vs elevation is now FOV-conditional.** At FOV 45, lowering the camera
  reduced fill. C is lower than HEAD and fills more (54.2% vs 50.9%), because
  the narrower lens widens the near edge less (keystone 0.81 vs 0.72). X still
  binds on the near ICE wall-top corner.
- Rewrite the `camrig.js` header and preset comments with these measurements,
  in their existing explanatory-comment style.
- **The `wrapper.js:95-98` fog comment is history, so make it past tense.** The
  far board corners *sat* at d 963 on the rig of that pass. Today they are at
  1038.2 on HEAD and 1689.9 on C (2700.4 at `DIST_MAX`). Fog would only bite
  harder now, so the reasoning stands.

### 2.2 Zoom reset (user ruling) — line-neutral in `main.js`

Add `rig.dist = camPreset(settings.cam);` at the three start edges that do not
already have it:
- **(WIN|LOSE)→PLAY edge.** Append it to `roomT = 0; bestPrev = null;`
  (`main.js:635`). This covers next room and the LOSE retry, which starts a new
  run.
- **Pause RESTART.** Append it to `roomT = 0;` (`main.js:289`).
- **`onStart`.** Already resets (`:226-227`). Unchanged.

Three things do **not** reset `dist`:
- PAUSE→PLAY. Resuming continues the room, and that path never passes the
  WIN/LOSE edge.
- ATTRACT.
- INTRO, which drives `introCam`, not the rig.

`resetOrbit` stays where it is. Only `dist` is in the ruling.

**The "selected" preset is already live at HEAD.** `menuapp` clamps its own
clone (`menuapp.js:86`, `settings.js:28-40`), but `main.js:304` rebinds
`settings = app.settings;` right after `createMenuApp` ("One live blob from
here on"). `_optSet` (`menuapp.js:439-445`) and `optReset` (`:508`) mutate
that same object in place. So `camPreset(settings.cam)` already follows
OPTIONS: pick WIDE, wheel out (HEAD clamps at 1400), press PLAY, and `onStart` sets 960; KeyR
gives 960 too. `onSettings` does not change, and C1 adds nothing to `main.js`
beyond the two appends above.

*Ruling 2026-10-08 (spec review): d9ba25d's "latent bug" and its
`settings = s` fix are withdrawn. `s === app.settings`, so the change was a
no-op and the bug does not exist.*

### 2.3 File map

| File | Change |
|---|---|
| `src/render/three/camrig.js` | `DEF`, `CAM_FOV`, `CAM_PRESET`, `DIST_MIN/MAX`, `WHEEL_DOLLY_K`, comments |
| `src/render/three/wrapper.js` | import `CAM_FOV`; fov + far 3000; fog comment to past tense |
| `src/render/three/particles.js` | `size:19.5` |
| `src/render/three/flythrough.js` | `BASE_DIST`/`SETTLE_EL`/`TARGET_Y`, start el 0.74 |
| `src/main.js` | the two appends (§2.2), +0 lines |
| `src/render/three/camrig.js:8` (trailing comment), `src/render/sprites.js:338`, `src/render/three/entities.js:165,295,882` | comment numbers `el 0.54` / 59.1 → `el 0.66` / 52.2 (still past 45°, so "more TOP than side" holds) |
| `src/render/three/camrig.js:23` | the bezel "bleed 2.4%" → 7.5% (see the AGENTS.md note below) |
| `tests/three.test.mjs` | §4, §4b, §CAM, S3.C, §SET (§2.4); comment at `:1082` |
| `tests/items-art.test.mjs:599` | comment 59.1 → 52.2 |
| `tests/headless.test.mjs:1022` | cap comment line (C1 +0) |
| `src/pwa/shell.js:1`, `sw.js:3` | `fusegrid-shell-v159` |
| `MEMORY.md` | one dated line |
| `AGENTS.md` | the default-rig paragraph and its Hazard (`:72-88`), MAKO "at `el:0.54`" (`:133`), the frozen rig/light fact (`:320`), the "At `el:0.54` … 59.1°" fact (`:322`) |

In AGENTS.md:
- The new rig text states that fill vs elevation is FOV-conditional.
- The Hazard becomes "STANDARD sits at 1.0746, dolly-in limit 1473.54".
- The playfield-basis sentence's "bezel may bleed ~2.4%" (`AGENTS.md:79`) is
  restated for the 1.0746 bezel: about 7.5% past the two bottom corners. The
  2.4% came from the 2026-09-04 bezel at |ndc| 1.0238, so it was already stale
  at HEAD's 1.0974 (9.7%).
- Add these to the stale lists: `el:0.54`, `dist:870`, `target:[0,-48,0]`,
  FOV 45, `|ndc| 0.9449`, fill 50.9%, bezel 1.0974, `CAM_PRESET [870,960,1040]`,
  `DIST 560/1400`.
- The light-recipe text does not change.

### 2.4 Pins (`tests/three.test.mjs`)

- **§4 (`:157`).**
  - Rig defaults are az 0, el 0.66 (52.2°), dist 1503, target y −17.
  - `dollBy` clamps to 2529 / 892.
  - `resetOrbit` restores 1503 / 0.66.
  - `SHAKE_3D_K===0.09`.
  - `WHEEL_DOLLY_K===1.04`.
- **§4b (`:194`).** The camera is `PerspectiveCamera(CAM_FOV,…)` and
  `CAM_FOV===24`. The existing gates keep their thresholds; the measured values
  are worst 0.9397, span 1.3802, `cy` 0.0005, bezel 1.0746. Add two floors that
  pin the complaint:
  - Near-row side:top ≥ **0.55**: C scores 0.617, 45/870 scored 0.339.
  - Keystone far/near ≥ **0.78**: C scores 0.807, 45/870 scored 0.722.
  - Update the comment's citations of the old rig.
- **§CAM (`:352`).**
  - Defaults are 1503 / 0.66.
  - Wheel clamps to 892 / 2529.
  - KeyR restores 1503.
  - **New, through `createGame`'s frame loop with `render3d`:** after a wheel
    out to 2529, the WIN→PLAY, LOSE→PLAY and pause-RESTART edges each restore
    `camPreset(settings.cam)`. A PAUSE→PLAY resume keeps 2529.
  - **New (regression guard):** set CAMERA to WIDE through OPTIONS
    (`app.settings` path), wheel out, cross a room edge → `rig.dist === 1671`.
    A run start → 1671 as well. The run-start (`onStart`) half already passes
    at HEAD because of `main.js:304`. Only the room-edge half goes red →
    green, through the new `main.js:635` append (the RESTART append is pinned
    red → green by the pin above).
- **S3.C (`:915`).**
  - The start dist is 1503/1.55 (969.677).
  - The end frame equals `createRig()`: dist 1503, el 0.66, target y −17,
    target z 0.
  - `dist*zoom==1503`.
  - The monotonic pin is unchanged.
  - **New:** `BASE_DIST===CAM_PRESET[0]`, `SETTLE_EL===createRig().el` and
    `TARGET_Y===createRig().target[1]`, so the handoff cannot drift.
- **§SET (`:2099`).** The `at()` helper uses `CAM_FOV` and far 3000.
  - `CAM_PRESET` is exactly `[1503,1671,1827]`.
  - No preset is < 1503. The cite is "1470 scores bezel 1.1031".
  - Every preset sits inside 892..2529.
  - STANDARD is `createRig()`, with el 0.66 and target y −17.
  - The bezel stays ≤ 1.10 at every preset.
  - FAR worst ≥ 0.75 (0.7524). The cite is "1905 scores 0.7180".
  - `camPreset` clamps to 1503 / 1671 / 1827.
- **New:** `r._dbg.camera.fov===CAM_FOV && r._dbg.camera.far===3000`, and
  `createParticles().points.material.size===19.5`.

### 2.5 Acceptance

- `node --test` is green, and only the pins above moved.
- **Headed check.** Unregister the SW and clear caches on both loopback origins
  first. At 1440×900, look at JUNGLE, ICE, VOID and CROWN:
  - all four corners and the ICE walls are visible
  - the board looks centred and reads as a 3/4 view on every row
  - MAKO and foe footprints read at 52.2°
  - CROWN's three golds still separate
  - the 3D ghost vs SHADE in VOID
  - ICE/VOID brightness is still right with the unchanged recipe
- Also check:
  - the intro hands off with no pop
  - wheel out → next room returns to the preset
  - blast particles keep their size on the board

---

## 3. C2 — `fit()` seam and phone layout

Build on HEAD and keep:
- v157's idea of gutter controls
- v158's `html,body{…width:100%}`, which already holds the side gutters, so
  the study's `#wrap{padding:8px 166px}` is **not** needed
- v156's bomb hide
- the v154/v155 tap mapping

### 3.1 `src/app/fit.js` (new entry seam, beside `flags` / `attract` / `debughook`)

```
export const FIT_RES = Object.freeze({ d: [40, 48], p: [16, 250], l: [332, 16] });
export function fitBox(W, H, touch, cw, ch)   // -> { lay, s }
  lay = !touch ? "d" : W > H ? "l" : "p"
  s   = max(0.3, min((W - rw) / cw, (H - rh) / ch, 1.8))   // [rw, rh] = FIT_RES[lay]
export function mountFit(canvas)               // -> fit()
```

- `fit()` does nothing without `window`.
- It calls `fitBox(innerWidth, innerHeight, hasTouch(window), canvas.width,
  canvas.height)`, using `hasTouch` from `src/touch.js`. That is the same
  predicate that decides whether the pad mounts.
- It sizes `#c` and `#gl` exactly as `main.js:94-101` does today, and never
  assigns the `#gl` buffer.
- It sets `document.body` `data-lay` to `lay`.
- `mountFit` calls `fit()` once and registers it on **both** `resize` and
  `orientationchange`.

**One predicate.** The CSS keys off `body[data-lay]`, which `fit()` writes, and
not off its own media query. A tall touch landscape such as 1180×820 therefore
cannot get the 16 px height reserve while its pause pill still sits above the
stage: that pill needs 52 px, and the stage would leave 42.5. The v157
`@media (max-height:500px) and (min-aspect-ratio:4/3)` block (`index.html:77-80`)
is replaced by the rules below.

| Viewport | lay | scale (HEAD → new) | stage CSS px | tile px, mid row (HEAD → new) |
|---|---|---|---|---|
| 1440×900 | d | 1.385 → 1.638 | 983×852 | 41.9 → 53.8 |
| 1280×720 | d | 1.038 → 1.292 | 775×672 | 31.5 → 42.5 |
| 375×812 | p | 0.558 → 0.598 | 359×311 | 16.9 → 19.7 |
| 390×844 | p | 0.583 → 0.623 | 374×324 | 17.7 → 20.5 |
| 812×375 | l | 0.375 → 0.690 | 414×359 | 11.4 → 22.7 |
| 667×375 | l | 0.375 → 0.558 | 335×290 | 11.4 → 18.3 |

### 3.2 `index.html`

Remove the `@media` block at `:77-80`. Add these rules after the `#tpause`
rules:

```
body[data-lay=p] #wrap{padding:60px 8px 190px}
body[data-lay=p] #tpad{top:calc(100% + 22px);bottom:auto;left:6px}
body[data-lay=p] #tbomb{top:calc(100% + 50px);bottom:auto;right:14px}
body[data-lay=l] #tpad{left:auto;right:calc(100% + 22px);bottom:0}
body[data-lay=l] #tbomb{right:auto;left:calc(100% + 40px);bottom:10px}
body[data-lay=l] #tpause{right:auto;bottom:auto;left:calc(100% + 54px);top:0}
```

**Portrait.**
- The padding is 60 + 190 = 250 = `FIT_RES.p` height, and 8 + 8 = 16 = the
  width reserve.
- Height-bound, the stage top sits at exactly 60, so the pill (8 + 44 = 52)
  always clears.
- The pad needs 22 + 128 = 150 ≤ 190 below the stage. The bomb needs
  50 + 72 = 122.
- The study's `padding-bottom:190px` alone puts the stage top at 37 on a
  height-bound portrait such as 700×720, which clips the pill by 15 px.

**Landscape.**
- Width-bound, the gutter is (W − 600s)/2 = 332/2 = 166.
- The pad needs 22 + 128 = 150, the bomb 40 + 72 = 112, and the pill
  54 + 44 = 98.
- The pill (`top:0`) and the bomb (`bottom:10`) share the right gutter. They
  need a stage height of at least 126, and the 0.3 floor gives 156.
- `#wrap`'s default 14 px padding overflows the 16 px reserve by 12 px. Body
  centres it, so the stage top lands at 8.

**Desktop (`d`).** `#wrap`'s 28 px of padding fits inside the 40/48 reserve.

- The base `#tpause` rule stays without `top:`.
- Each `data-lay` rule carries no `display:`.
- Update the touch-controls explanatory comment (`index.html:57-60`) to match.
- Update the `#tpause` comment (`index.html:81-84`). It says the pill "sits
  ABOVE the stage" and "fit() keeps >=90px clear above the stage". Both turn
  false: landscape moves the pill to the right gutter, desktop reserves 48
  (24 px a side), and portrait gets a 60 px top pad.

### 3.3 `main.js`

`:82-105` (24 lines) becomes the following, plus a `mountFit` import line:

```
let fit = null;
if (canvas) {
  canvas.width = CFG.COLS * CFG.TILE;
  canvas.height = CFG.ROWS * CFG.TILE;
  fit = mountFit(canvas);
}
```

That is −17 lines in total. `sizeCanvases` keeps calling `fit()` (`:546`).
`src/pwa/shell.js` SRC gains `"src/app/fit.js"`, alphabetised after
`demobot.js`.

**File map**

| File | Change |
|---|---|
| `src/app/fit.js` (new) | `FIT_RES`, `fitBox`, `mountFit` |
| `src/main.js` | the fit block → `mountFit`, plus the import (−17) |
| `index.html` | `@media` block out, six `body[data-lay]` rules in, the touch-controls comment (`:57-60`) and the `#tpause` comment (`:81-84`) |
| `src/pwa/shell.js`, `sw.js` | SRC + `fusegrid-shell-v160` |
| `tests/fit.test.mjs` (new) | §3.4 |
| `tests/touch.test.mjs` | D5 rewrite, `#tpause` pin |
| `tests/headless.test.mjs:1024` | cap 812 → 799, plus the comment line |
| `AGENTS.md`, `MEMORY.md` | the `fit.js` seam beside flags/attract/debughook; one dated line |

### 3.4 Pins

- **New `tests/fit.test.mjs`.**
  - `FIT_RES` is frozen and has exactly the values above.
  - `fitBox` returns `lay` `d` / `l` / `p` according to touch and `W>H`.
  - The six table rows above hold, to 3 dp.
  - The 0.3 floor and the 1.8 cap hold.
  - `mountFit` with a stub `window` (`ontouchstart`, 812×375) and a stub
    `document`:
    - sets `#c` and `#gl` style to `600s`×`520s`
    - sets body `data-lay` to `l`
    - registers `resize` **and** `orientationchange`
    - swapping to 375×812 and firing `orientationchange` re-fits to `p`
  - A headless call (no `window`) is a no-op.
- **`tests/touch.test.mjs`.**
  - **The D5 block (`:270-304`) is rewritten** to import `FIT_RES`/`fitBox`.
    It parses the gaps from the `body[data-lay=…]` rules and sweeps touch
    viewports.
    - **Landscape:** W 560–1400 × H 280–1000, W>H. Every gutter fits the pad,
      the bomb and the pill. The stage height is ≥ 126. The pad's top edge
      stays on screen (it always does for H ≥ 280, so this guards a future
      reserve change rather than a current case).
    - **Portrait:** W 320–1000 × H 480–1400, H≥W. The stage top is ≥ 52. The
      space below is ≥ 150 for the pad and ≥ 122 for the bomb. The stage
      width is ≥ 6 + 128 + 14 + 72.
    - Plus the named phones (812×375, 667×375, 568×320, 915×412, 932×430,
      320×568, 375×667, 390×844, 430×932), and 1180×820 / 1024×768 /
      768×1024.
  - **`#tpause` (`:191-200`):**
    - the base-rule regex is anchored to the base rule, not a `data-lay` one
    - the base rule still has no `top:`
    - the portrait `#wrap` top padding (60) is ≥ 44 + gap (8)
  - The `[hidden]` guard and "no `display:` in the layout rules" pins stay.
    The body-spans-viewport pin stays.
  - No pin may regex `main.js` for `innerWidth` / `innerHeight` any more.

### 3.5 Acceptance

- Green under `node --test`.
- **Headed check, in Chromium device emulation with touch on.** Viewports:
  375×812, 390×844, 812×375, 667×375, 1180×820 and 768×1024, plus 1440×900
  without touch.
  - `elementFromPoint` at the centres of `#tpad`, `#tbomb` and `#tpause` hits
    each of them.
  - None of the three overlaps the board.
  - Pad → `move.x=1`; pad + bomb → `fire:true`; release clears.
  - Rotating 375×812 ↔ 812×375 re-fits with no reload.
  - The whole board is visible in 3D and 2D.

---

## 4. T1 — tap MEDALS and Reset on STATS

### 4.1 `menudraw.js`

- **Hoist** the two foot literals (`:895-896`) into module constants:
  - `STATS_FOOT = "T MEDALS · C COPY MY STATS · R RESET · ESC BACK"`
  - `RESET_FOOT = "R AGAIN ERASES + RELOADS · ANY OTHER KEY CANCELS · KEEPS OPTIONS + PACE"`
- `drawStats` still paints each string with **one** `fillText`. The pins at
  `menudraw.test.mjs:648,736` and `stats.test.mjs:728` do not move.
- **New `statsHit(x, y, L, arm)`** goes beside `menuHit`. It returns
  `"KeyT"`, `"KeyR"` or `null`.
  - `S = shellBox(L, 480)`, which is the same plate `drawStats` paints.
  - **Band:** `S.footY − 12 <= y <= S.y + S.h`.
  - **Tokens:** split the painted string on `" · "`.
  - **Advance:** 10 px × 0.6 em = 6 px per character. That is the same width
    assumption the wave-3 spec §7.4 uses. The string starts at
    `x0 = S.mid − len·3`.
  - **Zone:** a token with characters `[a,b)` covers
    `[x0 + 6(a − 1.5), x0 + 6(b + 1.5)]`, which is half a separator on each
    side.
  - **Idle:** token 0 (`T MEDALS`) → `"KeyT"`, token 2 (`R RESET`) → `"KeyR"`.
  - **Armed:** token 0 (`R AGAIN ERASES + RELOADS`) → `"KeyR"`.
  - Everything else → `null`.

| Plate | idle T zone | idle R zone | armed R zone | band y |
|---|---|---|---|---|
| 600×520 | x 150–216 | x 324–384 | x 78–240 | 464–492 |
| 608×352 (iso) | x 154–220 | x 328–388 | x 82–244 | 296–324 |

### 4.2 `main.js`

Add a STATS branch to the canvas `pointerdown` non-GAME chain (`:462-485`; the
screen if/else runs `:467-485`). It
uses the same overlay-canvas mapping as v154/v155:
- `getBoundingClientRect` and `k = canvas.width / r.width`
- `dims(canvas, curKind)` and `menuLayout(cw, ch)`

`statsHit` rides the existing menudraw import line. Then:

```
if (hit) app.key(hit); else if (app.resetArm) app.resetArm = false; else app.confirm();
```

- A tap on MEDALS is KeyT, so it pushes TROPHIES.
- A tap on RESET is KeyR, so it arms. A tap on the armed `R AGAIN` label
  confirms, which runs `onReset`, `clearCabinet` and the reload.
- **An off-label tap while armed cancels and stays on STATS**, like the
  arrow keys. An off-label tap while idle backs out to MENU, as it does today.
- This is +4 lines. `app.key` already owns the two-press semantics
  (`menuapp.js:242-246`), so nothing changes in `menuapp.js`.

**File map**

| File | Change |
|---|---|
| `src/render/menudraw.js` | `STATS_FOOT` / `RESET_FOOT` constants, `statsHit` |
| `src/main.js` | the STATS tap branch, plus `statsHit` on the existing import line (+4) |
| `src/pwa/shell.js`, `sw.js` | `fusegrid-shell-v161` |
| `tests/menudraw.test.mjs`, `tests/headless.test.mjs` | §4.3, plus the cap comment line |
| `AGENTS.md`, `MEMORY.md` | the TROPHIES/Reset "or a tap" wording; one dated line |

### 4.3 Pins

- **`tests/menudraw.test.mjs`.**
  - At both plates, `statsHit` returns `KeyT` / `KeyR` / `null` at the centre
    of each idle token, and `KeyR` / `null` for the armed tokens.
  - It returns `null` 1 px above the band and outside the zone edges.
  - The zones are derived from the same constants that `drawStats` paints.
- **`tests/headless.test.mjs`.** These go through the **real pointer path**,
  on a canvas stub whose CSS rect is half the buffer (k = 2, the v154
  pattern):
  - On STATS, a tap at the T zone centre → `SCREEN.TROPHIES`.
  - Tap RESET → `resetArm` is true. Tap the armed label → `onReset` runs once:
    the CLEAR keys are gone, the KEEP keys stay, and the reload stub is called
    once.
  - Tap RESET, then an off-label tap → still STATS, disarmed, nothing cleared.
  - An idle off-label tap → MENU.

### 4.4 Acceptance

- Green under `node --test`.
- **Headed check at 375×812 with touch on.** The two target zones are about
  39×17 CSS px there, which is the same order as a MENU row's 19 px.
  - Tap MEDALS → the MEDALS page → tap → back to STATS.
  - Tap RESET → the armed red copy.
  - Tap off-label → disarmed, still on STATS.
  - Tap RESET, then `R AGAIN` → reload into the first-visit boot, with OPTIONS
    and pace kept.

---

## 5. `main.js` line budget (pin `tests/headless.test.mjs:1024`, `split("\n").length`)

| step | delta | measured | cap |
|---|---|---|---|
| start (`2b4ffb4`) | — | 812 | 812 |
| C1 | 0 (two appends) | 812 | 812 |
| C2 | −17 (24-line block → 6 lines + 1 import) | 795 | **799** |
| T1 | +4 (STATS tap branch) | 799 | 799 |

- C2 tightens the cap to 799. That is its measured length plus T1's stated +4.
- If T1 lands under +4, it tightens the cap to the measured length.
- Each step appends its one-line reason to the pin's comment block.

---

## 6. Ship order, PWA bumps, docs

- The order is **C1 → C2 → T1**, each green, committed and reviewed.
- **PWA:** one paired `CACHE_NAME` (`src/pwa/shell.js:1`) + `sw.js:3` REV bump
  per code commit, +1 from the value read at that moment: **v159** (C1),
  **v160** (C2, SRC gains `src/app/fit.js`), **v161** (T1).
- This spec commit is docs-only and bumps nothing.
- Each step appends one dated `MEMORY.md` line.
- **CHANGELOG.md** gets one player-facing entry, for shell v161, in a separate
  close-out commit after T1 (as `2b4ffb4` did for wave 3). It covers the new
  camera, the phone fit, and tappable MEDALS / RESET. It also corrects the v158
  entry's "MEDALS and Reset stay keyboard-only by design" and "Press `T` on
  STATS" lines, which T1 makes incomplete.
- AGENTS.md edits:
  - C1: the rig, the Hazard, the facts, the stale lists (§2.3)
  - C2: a `src/app/fit.js` mention among the `main.js` seams, with the
    `data-lay` predicate
  - T1: `SCREEN.TROPHIES` is "opened from STATS by `T` or a tap" rather than
    "keyboard only", and Reset is tappable

---

## 7. Corrections to the study (verified at HEAD)

1. **Intro elevation.** The study let the intro settle lower. Instead, start at
   0.74 so the same 0.08 lift survives, and the monotonic pin and comment stay
   true.
2. **Particle size.** It is ×1.9487 (tan ratio → 19.5), not ×1.73.
   `sizeAttenuation` ignores FOV, so ×1.73 would shrink particles relative to
   the board.
3. **`SHAKE_3D_K` stays 0.09.** Shake relative to a tile does not depend on the
   camera. The "~0.08" option is rejected.
4. **The far plane cites 2918.6**, the worst case over every orbit at
   `DIST_MAX`, not 2729.
5. **`WHEEL_DOLLY_K` is exactly 1.04.** **The dolly-in limit is 1473.54.**
6. **Portrait `#wrap` is `padding:60px 8px 190px`**, not `padding-bottom:190px`
   alone (§3.2).
7. **The landscape `#wrap{padding:8px 166px}` is dropped.** v158's
   `width:100%` already holds the gutters.
8. **The layout predicate is `body[data-lay]` written by `fit()`**, not a
   separate CSS media query.
9. **Ship order is C1 → C2 → T1** for the line budget.

The study was right that `camPreset(settings.cam)` already follows OPTIONS
(`main.js:304`); see the §2.2 ruling.

## 8. Accepted trade-offs and assumptions

- **(a)** Behind the near ICE border, MAKO's body is 68% visible (97% at HEAD),
  and fins 75% (100%). The eyes stay 100%. Behind the mid pillar the body is
  54% (62%). This is the price of the lower 3/4 view the user picked from the
  sheet.
- **(b)** The 3D canvas stays 600×520. A 600×440 canvas would gain 10–18% on
  height-limited screens (desktop, touch landscape), but it ripples every menu
  fit pin, so it is left for later. It would not help phone portrait, which is
  width-limited: 15 tiles span ~359 CSS px at 375 wide and the board already
  fills ~94% of the canvas width.
- **(c)** The T1 zones assume the 0.6 em mono advance, as waves 1–3 did, and
  are checked headed.
- **(d)** A touch laptop (`ontouchstart` present) gets the touch reserves. That
  matches today, where it already shows the pad.
