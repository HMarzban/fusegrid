# Delivery: loading that never stalls the player (design, shell v202)

**Status:** design, 2026-11-06. Built on local branch `feature/delivery`, cut from `feature/controls`; shell v201
ships on 2026-11-08 untouched, so this is v202. Inputs (git-ignored): `.superpowers/sdd/notes/v202-delivery/`
`ux.md` (loading UX), `architecture.md` (code audit), `measure.md` (timings). The owner skipped the question round
("boost up and work on them in parallel"), so every choice below marked **ruling** is the lead's, open to veto.

The owner: "we have to work on delivery, what I mean, I mean loading the files and those new size, so as I mention
before, we need a loading progress to have more mature UX and also UI. let's work on it and ensure in all over places
user not face a lagging screen beacuse something loading in background. like first load, or when they switch between
pixle art and 2d and 3d word."

## Why

The v197 loading bar is honest, but four things still make the game feel unfinished while it loads:

- **The wrong look flashes.** While PIXEL or REAL 3D loads, the screen drops to CLASSIC 2D (`rcache.js` `get`), and a
  failed load lands the player on CLASSIC 2D, a look they never chose (`main.js` `onFail` → `_optRender(0)`).
- **The freeze lands after the download.** The art bake (PIXEL) and the context, textures, scene and shader link
  (REAL 3D) run in one or two long main-thread tasks inside the first render of the new look. The AA rebuild freezes
  with no indicator at all.
- **A freeze can cost play.** A look picked from PAUSE can finish building in live PLAY, and `dt` is clamped only to
  0.25 s, so the sim then runs a quarter second the player could not answer.
- **Music skips.** The music schedules 0.12 s ahead (`audio.js` `LOOKAHEAD`), so any block over ~70 ms in a menu is an
  audible gap: the lag a player hears first.

And the boot graph grew: 114 files, 1,065 KB raw, 386 KB gzip (v197 recorded 807 KB), found in 5 import waves; gen-3
tiles (~83 KB) came back into boot in v198 and CONTROLS added ~117 KB. On a first visit the service worker downloads
the whole boot graph a second time (`cache:"reload"`).

## Goals (measurable; ruling: replaces "never freezes", which no browser can promise)

- **G1.** During any load (first visit, look switch, rebuild, run start, room change) no main-thread task over **50 ms**
  on the reference laptop at **6x** CPU throttle, except the listed unsplittable steps (three's module evaluation, a
  shader link without `KHR_parallel_shader_compile`, a single large texture upload), each run with the current look
  still on screen and the music pre-rolled.
- **G2.** The music never drops out during a load.
- **G3.** Every wait over 150 ms shows progress whose number comes from code (files, art cells, build steps, shader
  programs), never a made-up or eased percentage (the v197 rule stands).
- **G4.** The look on screen changes only when the new look can draw its first frame: swap on ready, never a third look
  in between.
- **G5.** A load never spends the player's time: no build step runs in live PLAY or the intro show, and a long frame
  never turns into a burst of sim.

## Non-goals and anti-goals

- No size or time claims we cannot source ("ABOUT 3 S", "1.3 MB") unless derived from the pinned graph.
- No loading surface over live PLAY; no modal for a look failure while another look still draws; no colour-only cues;
  no flashy fills or sounds for the game's own background work; never two indicators for one job.
- No npm dependency, no bundler, no change to the sim's results (`determinism.test` and the board hash sets stay
  identical).
- Not a phone tuning pass (#36 still needs a real phone).

## What the player sees (from `ux.md`, rulings applied)

Three surfaces, one CONSOLE PANEL kit:

1. **Full plate** (`#load`, exists): only for the first boot, a boot failure, and a return visit whose saved look is
   not ready when the title would paint. `LOADING · 37 / 114 FILES` → `STARTING`; `PREPARING REAL 3D` on a return
   visit; after 10 s with no new file `· SLOW CONNECTION, STILL TRYING` (today 30 s; RETRY still at 30 s).
2. **RENDER row** (new, OPTIONS and PAUSE's OPTIONS view): the value slot carries the state and a 2 px accent line along
   the band bottom shows the honest fill; no reflow. `PIXEL · 12 / 26` → `PIXEL · PREPARING` (or `PIXEL · ART 140 /
   255`, `REAL 3D · SHADERS 18 / 31` where a count exists) → `PIXEL · READY` for 0.8 s → `PIXEL`. Failure:
   `PIXEL · DID NOT LOAD · ENTER RETRY` (touch `TAP TO RETRY`, controller the confirm word), danger colour plus words.
   The docked plate is suppressed while this row is on screen.
3. **Chip** (slimmed `data-dock`, one line, 3 px bar, no pointer, no keys): only when the player left OPTIONS mid-load;
   never in live PLAY. **Ruling Q2: top-centre**, sized to clear the MENU logo line.

Rules: under 150 ms nothing shows; a live wait (the old look still drawing) shows its row note after ~400 ms; a frozen
wait has its indicator painted before the block and animated on the compositor; a shown note stays at least 400 ms
(never holding the player). Under reduced motion an indeterminate state is a static striped track, not an empty one.
One polite live status announces stages, never counts ("Preparing REAL 3D." "REAL 3D ready." "REAL 3D did not load.
PIXEL stays.").

Rulings:

- **Q1, a look still loading when a run starts: next safe point.** The run starts in the look on screen; the build and
  swap wait for PAUSE, the WIN/LOSE overlay or the menus. PAUSE's kicker adds `· REAL 3D NEXT`, then `· REAL 3D READY`.
- **Q3, warm on intent:** resting ~400 ms on the RENDER row starts the next look's job up to its last step before the
  swap, PIXEL always, REAL 3D only if `measure.md` puts three's 6x evaluation under 50 ms; never idle-warm every look.
- **Q4 / owner decision 5, a failed look: stay on the look on screen.** Inline on the RENDER row with retry; the saved
  value reverts to the look on screen; off OPTIONS the chip reads `PIXEL DID NOT LOAD · OPTIONS › RENDER` for 4 s. The
  centred failure card stays for boot only and gains a keyboard route (focus RETRY, Enter retries).
- **Q5:** no sound or vibration on arrival; the swap is its own feedback.
- **Release policy:** the 10 s release clock does not run while the player is on OPTIONS, GRAPHICS or PAUSE's views,
  so comparing looks never pays a rebuild.

## How it works (from `architecture.md`)

### One job runner, one painter

- The inline `window.__load` in `index.html` stays the only painter (it runs before any module; its compositor plate is
  proven), and gains the row-state feed and the chip form.
- New DOM-free `src/app/jobs.js`: a job is an ordered list of phases, each with an honest unit: `files` (byte-weighted
  from the pinned graph), `eval` (one step), `bake` (art cells), `build` (fixed steps), `shaders` (unique programs),
  `warm` (one step). Each phase owns a fixed band of the bar pinned per look, so the fill never moves back; a phase with
  no count shows the glint.
- A slicer `slice(steps, budgetMs≈8)` yields through a `MessageChannel` (a hidden tab still finishes), checks
  `performance.now()`, and can be cancelled.
- **Scheduling rule:** no slice, idle item or unsplittable step runs while GAME + PLAY or the INTRO show is on screen;
  a job still running then parks until the next menu, PAUSE or WIN/LOSE overlay.

### Swap on ready (the core)

- `rcache` keeps drawing the **current** look until the new one is ready, never CLASSIC in between.
- Each lazy renderer splits into `prepare(world, report)` (builds atlases, textures, scene and programs on its own
  hidden canvas, no shared side effects) and `activate()` (canvas sizing and visibility, `initFx`, `setPixelArt`,
  stage background and glow, the first overlay clear).
- One staged build covers first use, the AA rebuild, a SHADOWS change and the return after release. A RENDER change
  mid-job cancels and disposes the half-built renderer. The old 3D is released only after the swap; two 3D contexts
  live together only in the AA case, as today.
- **PIXEL:** `createAtlas` becomes a list of steps reporting `cells done / 255`, sliced; the lazy per-biome tile and
  fin bakes move into the job for the current biome. The atlas stays byte-identical (hash test). A worker only if the
  sliced bake still measures over 50 ms.
- **REAL 3D:** texture painting one texture per slice (the rim is ~7 MB), then context, scene, `compileAsync` sliced by
  material group with `rimTwin` in scene; progress counts unique programs via `properties.get(m).currentProgram`; one
  small synchronous warm shadow render remains; without KHR the warm pass is sliced by material group.
  `checkShaderErrors` stays on under `?debug=1` only.

### Delivery

- `<link rel="modulepreload">` for the boot graph in `index.html`, written by `loadbar.test --write` from the same
  walker that pins `data-files`; lazy trees never listed. Five discovery round trips become one.
- Service worker install fetches with `cache:"no-cache"` (Pages sends ETag / Last-Modified: an unchanged file is a
  304), and registration moves to the first idle after the title paints. The full precache stays, so offline keeps
  working (**ruling**, owner decision 3).
- Gen 3 (`board3`, `featplace`, `featchecks`, ~83 KB) leaves boot and loads in title idle, with a synchronous path
  once loaded; `?play=1` and `?code=F3…` wait behind the boot plate; Node tests import it themselves.
- CONTROLS paint (`controlsdraw`, `controlsgeo`, `padart`, `controlspage`, `capture`, ~57 KB) loads when CONTROLS opens,
  `rumble.js` on the first controller seen; `controls.js`, `hints.js`, `hintcopy.js`, `gamepad.js`, `padroute.js`,
  `controlswire.js` stay in boot (a browser reports a controller only after a press, and that press leaves the title).
- The audio prime stays before the title (**ruling**, owner decision 4).

### Music and play time

- `audio.pump(0.4)` schedules 400 ms ahead before every unsplittable step, then returns to `LOOKAHEAD`.
- After a run start, a room change or a look swap, the next frame's `dt` is reset, so a long first frame shows the
  board instead of a burst of sim; the room clock starts on the first drawn frame. A lost WebGL context during PLAY
  pauses first (like `CONTROLLER LOST`) and rebuilds through the job.

## Order (ruling, owner decision 2)

1. **Step 1, small and safe:** modulepreload, service worker `no-cache` + deferred registration, music pre-roll, slow
   note at 10 s, reduced-motion stripes, live status, keyboard route on the boot card.
2. **Step 2, the core:** `jobs.js`, swap on ready with `prepare` / `activate`, staged REAL 3D with async compile, sliced
   PIXEL bake, the scheduling rule, the RENDER row states, the chip, inline failure that keeps the look, release clock
   paused on OPTIONS, `dt` reset after a swap or room start, warm on intent.
3. **Step 3, lighter boot:** gen 3 out of boot, CONTROLS paint and rumble lazy.

## Tests

- Node (repo style): `loadbar.test` pins the modulepreload block, the byte weights and the absence of gen 3 and the
  lazy CONTROLS files in boot, and checks the phase bands sum to 1 with a monotonic fill; new `jobs.test` (fake clock
  and channel: yields past budget, cancel, never done > total, indeterminate without a total); `rcache` with fake
  renderers (no swap before prepare, old look keeps rendering, cancel disposes, AA goes through the job, prepare leaves
  shared state alone, no slice in GAME + PLAY or the show, a failed look keeps the current one); PIXEL chunked atlas
  byte-identical and the CLASSIC / px hash pins unmoved; 3D fake-GL program totals, the no-KHR sliced path, and
  `three.test` draw counts and child-index ABI unchanged; `pwa.test` asserts `no-cache` and deferred registration;
  gen-3 lazy keeps `determinism.test` and the board hash sets identical; `audio` `pump(ahead)` returns to `LOOKAHEAD`.
- Headed real-GPU Chrome only (never the rAF shim or SwiftShader): max task and max long-animation frame per
  transition at 1x and 6x, with KHR present and stubbed absent; cold first visit on throttled Fast 4G; music recorded
  for gaps over 20 ms; the first visit fetches `src/main.js` once plus one 304.

## Builder-check rulings (2026-11-06)

A fresh reviewer read this as the builder; these answer its questions (lead's calls).

1. **Measurements.** `measure.md` is the analyst's baseline (step 0). Until it lands, warm on intent is PIXEL only, and
   band shares start equal per phase, re-pinned from the medians afterwards.
2. **Return visit with a saved PIXEL or REAL 3D look:** the title waits behind the plate (`PREPARING REAL 3D`), as the
   3D veil already does; it never paints CLASSIC and then swaps. `rcache.get` before ready returns the look already on
   screen, or nothing at boot (the plate covers it).
3. **A look picked in PAUSE:** its job runs while PAUSE (or the WIN/LOSE overlay, or a menu) is on screen. RESUME never
   waits for it: the remaining steps park and continue at the next idle state, the run plays on in the old look, and
   the swap happens only in an idle state. PAUSE → PLAY → PAUSE just resumes the parked job. Live PLAY shows nothing.
4. **G1 is a target, not a release gate.** A miss is measured and disclosed in the record, like earlier disclosed
   items, and the worker fallbacks are built only when a sliced step still measures over 50 ms.
5. **Contexts:** `prepare` for REAL 3D always builds on a fresh hidden clone canvas, the pattern `rebuild3d` already
   uses; coming from CLASSIC or PIXEL only one 3D context exists. The old 3D context is released after the swap, so
   two 3D contexts overlap only for a 3D → 3D rebuild (AA, SHADOWS, return after release). No offscreen-target rework of
   `createRenderer3D`; draw counts and the child-index ABI stay pinned.
6. **Gen 3 not loaded yet when a run starts:** the start waits behind the plate until it is in (in practice it is,
   since it loads in title idle). Never a silent fallback to gen 2: DAILY and F3 records are stamped with the generation.
7. **Service worker:** a first visit still installs the full list, but `no-cache` turns every file the page already
   fetched into a 304 served from the HTTP cache, so the bytes cross the network once. A player who goes offline before
   the first idle after the title has no worker yet; accepted.
8. **Chip on touch:** placed from `fit.js` geometry under the logo line on the board stage, and on the `#sh` shell box
   under its plate top; never over the PAUSE pill or the touch pad.

## What the measurements changed (2026-11-06, `measure.md`)

- **The biggest waits are network, not CPU.** Slow 4G, raw bytes: first title 6.9 s, first REAL 3D 7.9 s, first PIXEL
  1.9 s; the service worker re-downloaded 168 files / 3.07 MB raw (three included, for CLASSIC players too) and only
  activated at 26.5 s, so the whole first session ran uncached while the page and the worker fetched the same files.
  **Ruling: a two-stage precache.** Install caches only the boot graph (`no-cache`, so it is 304s); the looks (PIXEL
  tree, three and the 3D tree) are cached by the activated worker in its own idle stage, one look at a time, PIXEL
  first; a look the player picks before that is fetched once through the worker and cached on the way. Offline still
  ends up complete (owner decision 3 holds); the first session just stops competing with itself. Step 1.
- **The one freeze that matters is REAL 3D's build:** a single 87–131 ms task on every first build and every rebuild
  after the 10 s release (also when only passing through the menus), and a 35–60 ms frame at a 3D run start. PIXEL's
  bake, second-time switches, switches to CLASSIC and room changes all stayed under 50 ms. Step 2 starts with the 3D
  staged build; PIXEL slicing stays in scope but is second.
- **three's evaluation at 1x is about 70 ms or less**, so warm on intent includes REAL 3D's fetch and evaluation, but
  not its build.
- **More boot candidates** for step 3: `net/*` (~22 KB, `?net=local` only), the iso `r3d` scene (~9 KB, `?render=iso`
  only) and `demobot` (~11 KB, ATTRACT only), beside gen 3 and the CONTROLS paint.

## Left to the builder

Exact slice boundaries, band shares (from `measure.md` medians), the chip's pixel size inside the kit, file splits
inside `rcache.js` and the renderers, and test names. Not decidable by agents: a real phone (#36), Safari and Firefox
module Resource Timing, a screen reader run.
