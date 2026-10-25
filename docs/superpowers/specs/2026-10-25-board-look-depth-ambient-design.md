# The board look: outline, depth and ambient motion (2026-10-25)

Owner asks, in order: "let's do the refactor correctly and refactor all with
the new wall and floor, I do not see a new look or changes a lot at all";
"the outline of the board must also upgrade what can we do?"; "Mock up A, B
and C side by side in parallel before building"; "Go with A and B together:
world bezel plus the recessed well"; "can we work on the depth of the
graphics and work on the details more? can you improve it?"; "Do the ambient
motion round next: motes, glints, steam, drift on the PLAY clock in all three
looks, in parallel lanes."

This record owns the integrated board look. Tile look: [direction D
record](2026-10-25-floor-tiles-direction-d-design.md). Wall family:
[wall art record](2026-10-21-wall-art-design.md). Tile sim and dials:
[difficulty tiles record](2026-10-21-difficulty-tiles-design.md).

**Status: built and playable on the local branch `tiles-d`; never pushed, not in
the live game (shell v184).** Play it with `PORT=8091 node serve.js` in
`.claude/worktrees/tiles-d`, then `http://127.0.0.1:8091/index.html?play=1`
(`&render=3d`, `&render=px`).

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
- **px JS cap 152 KB** (was 122, then 140, 145): the px tree is a lazy import,
  so CLASSIC visitors no longer pay for it; the cap stays as a growth tripwire.
- **CLASSIC call-log hash pin** `c7b4c843:71320` (was `97480c1c:22630`;
  re-pinned for walls, floor, bezel, well, depth and ambient, each time with
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

## Loose ends (what is NOT done)

1. **Not shipped.** Nothing is on `main` or Pages. Shipping needs the owner's
   go, a `CACHE_NAME` / REV bump (v185), the release docs and a real-GPU check.
2. **Gen 2 as the default for everyone** is issues #10 to #13 (random board every
   run, the daily, F2 codes, fairness): only a page-level default exists here.
3. **Sim:** only BOOSTER, ICE PATCH, CONVEYOR and TRAP have rules. STREAM,
   QUICKSAND, PORTAL and GATE are art only. The heat dial is issue #28.
4. **Teaching:** no coach tip, FLOOR line on the room card or GUIDE page for tiles.
5. **PIXEL tile cells are code-built** (drafted from the painters, then
   rebuilt by hand-written builders), not frame-by-frame art.
6. **Performance** is unmeasured on a headed real GPU (floor texture, rim
   shaders, contact AO, ambient Points).
7. **Colourblind check for the new tiles** was dropped with the old marks gate
   and needs a version that fits full-bleed fixtures.
8. **ATTRACT shows no ambient** (the renderer cannot tell it from menus without a
   flag from `main.js`); 3D JUNGLE and ARENA motes are very faint; ICE and SAND
   rims may read dark (one table in `three/scene.js`).
9. **Top corner bosses** are mostly hidden by the HUD plate; phone portrait is
   checked in screenshots only.
10. **Housekeeping:** branches `frame-a`, `frame-b` (merged), `frame-c` (not
    merged) and their worktrees; the automated security review of the commits
    could not run (credentials rejected).
