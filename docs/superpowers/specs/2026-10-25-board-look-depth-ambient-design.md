# The board look: outline, depth, ambient motion, foes and items (2026-10-25)

Owner asks, in order: "let's do the refactor correctly and refactor all with
the new wall and floor, I do not see a new look or changes a lot at all";
"the outline of the board must also upgrade what can we do?"; "Mock up A, B
and C side by side in parallel before building"; "Go with A and B together:
world bezel plus the recessed well"; "can we work on the depth of the
graphics and work on the details more? can you improve it?"; "Do the ambient
motion round next: motes, glints, steam, drift on the PLAY clock in all three
looks, in parallel lanes"; "now can you work on the enemies and the Items also in order to improve the details and animations like what we have done for floor and walls? run team of agents and run the related skills and also agents".

This record owns the integrated board look. Tile look: [direction D
record](2026-10-25-floor-tiles-direction-d-design.md). Wall family:
[wall art record](2026-10-21-wall-art-design.md). Tile sim and dials:
[difficulty tiles record](2026-10-21-difficulty-tiles-design.md).

**Status: built on branch `tiles-d` and merged into the owner's LOCAL `main`
(2026-10-25, `64662c3`); not pushed, not in the live game (shell v184).** Play it
with `PORT=8091 node serve.js` in the main checkout, then
`http://127.0.0.1:8091/index.html?play=1` (`&render=3d`, `&render=px`; clear
site data first, the v184 service worker caches old bytes). Shipping needs the
owner's push with `CACHE_NAME` / `REV` v185 and the release docs.

## What the branch holds

| Layer | What it is | Where |
|---|---|---|
| Walls | wall art round 3 merged (W1: CLASSIC hash re-pinned; W4: white 3D instance colour) | `wallart.js`, `wallvar.js`, `pixel/art/walls.js`, `three/` |
| Floor tiles | direction D, all 8 tiles x 3 heats x 3 looks | `featart/`, `featpx.js`, `three/featmesh.js` |
| Base floor | per-biome quiet material, 4 variants x 2 parities | `floorart.js`, `sprites.js`, `three/textures.js` |
| Art-only tiles | STREAM, QUICKSAND, PORTAL, GATE placed on gen-2 rooms 4 / 6 / 7 / 8 (no sim yet) | `core/feat.js` `HOME`, `core/board2.js` |
| PIXEL | tile cells wired, floor and shadows, the whole px tree a lazy import (#15) | `pixel/`, `pixel/load.js`, `hudart.js` now in `src/render/` |
| Board outline | option A world bezel + option B recessed well | `frame.js`, `frameart.js`, `three/rimart.js`, `three/wellfx.js` |
| Depth | shadows, AO, contact shadows, brick value down, floor detail, 3D relief | `depth2d.js`, `three/groundfx.js`, `three/materials.js`, `three/textures.js` |
| Ambient motion | one spec, three painters | `ambient.js`, `ambient2d.js`, `three/ambientfx.js`, `pixel/ambient.js` |
| Foes and items | one shared motion spec, four lanes | `motion.js`, `entityfx.js`, `enemybody.js`, `itemdraw.js`, `fx.js`, `three/entities.js`, `three/entityanim.js`, `three/burstfx.js`, `pixel/entities.js`, `pixel/foegen.js` |

A real page plays gen-2 boards (the ones that carry floor tiles) by default.
`?gen=1` or `?code=` keep today's boards. Node worlds stay gen 1 (the page
check is `location.href`), so the test suite and the sim never see gen 2 by
accident.

## Rulings made this round (owner may veto)

- **Outline: A + B, C parked.** A (world bezel: each world's own material as
  a continuous rail with corner pieces) **supersedes ruling W6** ("the border is
  a plain rampart"). B (recessed well: inner shadow, AO, lit lip, corner caps,
  biome glow, one joined HUD plate) keeps the border art and adds depth. C
  (stage set: a diorama per world beyond the board) sits unmerged on branch
  `frame-c`; at the fixed 3D camera it only shows as thin strips.
- **3D stage background is CSS on `#gl`** (`scene.background` is null).
- **Brick value:** the brick face loses 8 to 14 L* in every biome (PIXEL one
  palette step, about 14), hue identity and top highlight kept, because bricks
  were the loudest thing on the board. Hierarchy to hold in a squint test:
  floor < tiles < walls < bricks < pickups < foes.
- **Light:** upper-left everywhere. 2D and PIXEL cast shadows fall lower-right;
  REAL 3D shadows fall right and away from the camera because the light recipe
  is frozen.
- **px JS cap 160 KB** (was 122, then 140, 145, 152; 160 for the hand-drawn tiles): the px tree is a lazy import,
  so CLASSIC visitors no longer pay for it; the cap stays as a growth tripwire.
- **CLASSIC call-log hash pin** `9fb48f0a:72431` (was `97480c1c:22630`;
  re-pinned for walls, floor, bezel, well, depth, ambient and the foe/item round, each time with
  the diff proven to be the intended art).
- **Gates:** the old "marks <= 30 %" gate became edge-energy busyness <= 1.6x
  round 3, plus heat separation >= 4 at 40 px, bed vs BRICK dE >= 14, slot hull,
  VOID dim, seams and key light (`tools/tileart/gates.mjs all`).

## Ambient motion

One deterministic spec, `src/render/ambient.js`: `particleAt(spec, group, i, t)`
is a pure function, so CLASSIC, PIXEL and REAL 3D agree. It runs on a
renderer-owned PLAY-only clock (`ambientClock`): `world.time` keeps ticking in
PAUSE, so it is never used. Menus, the title and ATTRACT draw none.

| World | Motion |
|---|---|
| JUNGLE | pollen motes, falling leaf flakes |
| ICE | twinkles, drifting snow |
| FACTORY | steam puffs, rising sparks |
| WATER | ripples, bubbles |
| ARENA | dust, embers |
| SAND | wind streaks, blown grains |
| VOID | twinkles, wisps (never past wallHi) |
| CROWN | gold dust, sparkle |

Rules: alpha <= 0.34 (dots 3 px or less, big shapes fainter), nothing cycles
faster than 2.4 s, EFFECTS LOW halves the count, prefers-reduced-motion turns it
off, 2D costs at most about 27 cheap fills per frame, REAL 3D adds one draw
(142, 143 in a tile room, 144 with a ghost), PIXEL steps at 8 Hz.

## Foes and items (animation and detail)

`src/render/motion.js` is the one timing spec for all three looks (pure, frozen
tables, hash-based, no `Math.random`, never `world.time`): `FOE_M[type]` (bob,
idle, breathe, blink, lean, sway), `phaseOf` (from the foe's spawn home, never
an array index), `blinkAt`, `spawnK` (pop 0.4 to 1.1 to 1 over 0.25 s plus a
floor ring, then a slow breathe, alpha continuous), `deathK` (0.35 s: squash
wide and low, one flash frame, shrink; the flash is a tint under REDUCE FLASH),
`hitK`, `leanAt`, `itemIdle` (hover +-2 px, a ground shadow that tightens at
the apex, a glint sweep every 2.8 s) and `COLLECT[kind]` / `collectParticle`
(per-kind bursts: ring for shield / pass / remote, fan for fire / bomb / throw /
power, trail for speed / line / pierce, rising diamonds for heart, pop for
kick; never plus shapes). `entityfx.js` (`fxOf(world, look)`) turns the sim's
`kill` and `power` events into short render-side ghosts and bursts on each look's
own PLAY-frozen clock. Nothing in the sim changed: no entity id, spawn event or
hunter windup exists, so everything is derived from `home`, `invulnT`, `hunt`
and the existing events.

- **CLASSIC 2D:** foes blink, breathe and bob from the spec, with a rim light and
  one surface detail each; spawn pop, death squash, a visible hunter cue (narrowed
  eyes, brow furrow, a slow halo and floor ring). Pickups hover on a soft shadow
  with a glint; the old whole-disc scale (which blurred the outline) moved to the
  ring; four families read apart by ring pattern in grayscale; per-kind bursts
  (round 3 px dots with a dark rim, 2 px rings).
- **REAL 3D:** foes move by transforms only (the four-mesh child ABI is intact):
  blink on the eye plane, personality, smoothed facing, hunter lean, spawn pop,
  death through a pool of 3 ghost bodies. Pickups are glyph badges (the same
  glyph as 2D on a raked face plate, one ring, family sets the silhouette).
  Collect bursts are one extra `Points` draw tinted to the kind. Fat-world
  draw count is **156** (158 worst case), under the 160 cap.
- **PIXEL:** a 4-phase walk for walker, chaser, knight, burrow and fast, idle
  breath and blink frames, hem and flame frames, a stepped spawn ring, a wide-low
  death frame, 1 px contour on the small foes, diagonal glints on the bomb /
  throw / kick / line pickups (no plus shapes), kind-specific bursts drawn
  straight onto the board so they never evict kill puffs. The px tree is about
  146 KB of the 152 KB cap. The 2D silhouettes are canon for all three looks.
- **Loose ends of this round:** hunter windup needs a sim field (out of scope);
  REAL 3D spawn and death now fade on per-slot transparent material clones (closed 2026-10-25, `tests/foefade3d.test.mjs`);
  (closed 2026-10-25: PIXEL detail for chaser, burrow, boomerang, rocket and fast was thickened, and REAL 3D death / burst now run on a pause-corrected clock, `tests/render3d-pauseclock.test.mjs`); PIXEL guide frames are a pure function of the page clock, not the sim, so they match the board only by sharing its frame tables; no real-GPU frame
  time for the new motion.

## Loose ends (what is NOT done)

1. **Not shipped.** Nothing is on `main` or Pages. Shipping needs the owner's
   go, a `CACHE_NAME` / REV bump (v185), the release docs and a real-GPU check.
2. **Gen 2 as the default for everyone** is issues #10 to #13 (random board every
   run, the daily, F2 codes, fairness): only a page-level default exists here.
3. **Sim:** only BOOSTER, ICE PATCH, CONVEYOR and TRAP have rules. STREAM,
   QUICKSAND, PORTAL and GATE are art only. The heat dial is issue #28.
4. **Teaching:** the GUIDE has a FLOOR page (the fourth door, `SCREEN.FLOOR` 15, 2026-10-25) and says honestly which tiles have no rule yet; still no coach tip and no FLOOR line on the room card.
5. **Closed 2026-10-25:** PIXEL tile cells are hand-drawn palette-slot frames
   (`pixel/art/feat.js`; CONVEYOR and STREAM are hand-drawn parts assembled in
   code), after a polish pass took PIXEL heat-separation failures from 13 to 0.
   ICE PATCH, GATE and CONVEYOR stayed close to the builder look. px lazy-tree
   cap 160 KB (158.8 KB).
6. **Performance** is unmeasured on a headed real GPU (floor texture, rim
   shaders, contact AO, ambient Points).
7. **Colourblind check for the new tiles** was dropped with the old marks gate
   and needs a version that fits full-bleed fixtures.
8. **Closed 2026-10-25:** ATTRACT now shows ambient (`main.js` hands `{hud:false, amb:true}`, all three renderers read `o.amb`); 3D JUNGLE and ARENA motes got a per-world gain; ICE and SAND rims were lifted (`RIM_LIFT` in `three/scene.js`).
9. **Closed 2026-10-25:** the HUD plate now ends in a cap at each top corner and the top corner boss sits just below it on the side rail (CLASSIC and PIXEL, `frame.js`, `tests/frame-corners.test.mjs`; REAL 3D already cleared the plate). Phone: checked in iOS Safari on an iPhone 17 simulator (all three looks, menus, GUIDE FLOOR, touch, audio); the title pan was trimmed so the bezel crops evenly. A physical device is still untested.
10. **Tracking:** the gameplay gaps are issue #35 (hunter windup #32, colour-vision gate #33, real-GPU frame times #34, plus #10-#13, #24, #26-#28, #30). Progress comments are on #8, #15, #16, #17, #23, #24, #26, #27, #31.
11. **Housekeeping:** branches `frame-a`, `frame-b` (merged), `frame-c` (not
    merged) and their worktrees; the automated security review of the commits
    could not run (credentials rejected).
