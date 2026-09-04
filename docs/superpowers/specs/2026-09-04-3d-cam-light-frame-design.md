# REAL 3D camera, lights, board frame (2026-09-04)

REAL 3D reads immature. Three faults, one pass:

1. **Ceiling security-cam.** `el:0.419` is 66° above horizon — nearly
   top-down. Cube sides project at 0.45 of top depth, so the board reads as a
   tilted map, not a 3D arena.
2. **Overlapping corner tabs.** The S4 border is four `wallHi` rails at one
   height. The two N/S rails span `W+TILE` (640 > 600), so they cross the E/W
   rails and stick out past every corner. It is the brightest thing on screen.
3. **Binary lighting.** Key `1.6` against ambient `0.25` with no fill and no
   back light. Lit faces blow out, shadowed faces crush to near-black.

Public name Fusegrid / FUSE/GRID. Never Bomberman on any surface.

## Approaches

### Camera

1. **Lower the frozen rig, keep `az=0` (pick).** Elevation is nearly free:
   the board is 15 wide by 13 deep, so the **X axis binds at every
   elevation** and the fitting distance moves only 900→970 across 66°→48°.
   Buy the 3/4 read for ~40 world units of dolly.
2. **Rotate to a diamond (`az≈π/4`).** Fills a square viewport best, but
   up/down/left/right stop mapping to screen axes. Kills lane readability in
   a grid game. Rejected.
3. **Per-biome camera** so ICE gets its own angle. Rejected by standing rule —
   one frozen rig, no per-biome tables.

Elevation is bounded below by occlusion, not by framing. A wall of height
`h` hides `h/tan(θ)` of the tile behind it:

| `el` | above horizon | side/top | hides @ICE 36 | hides @JUNGLE 22 |
|---|---|---|---|---|
| 0.419 (today) | 66.0° | 0.45 | 40% | 24% |
| 0.550 | 58.5° | 0.61 | 55% | 34% |
| **0.620 (pick)** | **54.5°** | **0.71** | **64%** | **39%** |
| 0.730 | 48.2° | 0.89 | 81% | 49% |

`el=0.62` buys +58% cube-side presence (0.45→0.71) while the tallest biome
still shows the top third of anything standing behind a pillar. Below ~0.66
ICE starts swallowing whole entities.

### Frame

1. **One extruded rim with a hole (pick).** `THREE.Shape` outer rect + inner
   rect hole → `ExtrudeGeometry` with a bevel, laid flat. Overlap is
   *geometrically impossible* — there are no corner pieces to cross. One
   mesh, so the border costs 1 draw call instead of 4.
2. **Four mitered rails.** Butt-joint lengths so nothing crosses. Fixes the
   tabs but keeps 4 draws and re-breaks the moment anyone edits a span.
3. **Drop the border.** Cheapest, but the arena loses its edge and reads
   unfinished.

The rim is a **solid band from the floor to just above the wall top**, not a
floating rail — it caps the outer wall ring so the arena sits in a cabinet
well. It is tinted *down* (`wall` lerped toward `bg1`), because a frame
should recede; the bevel catches the key light for the highlight edge.

### Lights

1. **Key + fill + hemi + ambient (pick).** Textbook three-point collapsed to
   two directionals. The fill sits opposite and behind, so it doubles as the
   back light that separates pieces from the background. Lights are free in
   the draw-call traverse.
2. **Raise ambient only.** Kills the crush but flattens everything.
3. **PCSS / soft-shadow shader.** Real penumbra, but a vendored shader patch
   for one board. Overkill.

`PCFSoftShadowMap` ignores `shadow.radius`, so softness comes from the
key/fill *ratio*, not from blur. Today's ratio is effectively 6:1; the new
recipe is 2.3:1.

## Rule

- **One** frozen rig `{az:0, el:0.62, dist:960, target:[0,-44,0]}` and **one**
  light recipe. No per-biome camera or light table. VOID stays dark via
  materials.
- The rig frames all four corners plus the tallest walls in **all eight**
  biomes: worst case ICE at `|ndc| = 0.913` (≈26px CSS margin at 600 wide),
  vertically centred to `cy = -0.001`.
- `flythrough.js` settles onto the same numbers (`BASE_DIST=960`, settle
  `el=0.62`, target y `-44`) so INTRO→GAME is seamless. The old handoff
  popped target y from `0` to `-25`.
- `sizeCanvases` must never assign `#gl.width` / `#gl.height` — the wrapper
  owns the drawing buffer via `setPixelRatio` + `setSize`. Stomping it
  crops WebGL to the bottom-left quarter at dpr=2.
- `SLOT_MESH` ABI unchanged. Kind `"2d"` still must not import three.
- Border goes 4 meshes → 1, so the fat-world budget drops **146 → 143**
  (gate stays ≤500).
- `BIOMES` heights, materials, and every entity mesh are untouched.

## Numbers

Rig: `az 0`, `el 0.62`, `dist 960`, `target [0,-44,0]`.
Clamps: `EL_MIN 0.18`, `EL_MAX 1.05` (widened to straddle the new default),
`DIST_MIN 560`, `DIST_MAX 1400` unchanged.

Lights:

| light | colour | intensity | position |
|---|---|---|---|
| key (shadow) | `#fff4e2` | 1.05 | `(-240, 560, 320)` |
| fill (no shadow) | `#bcd4ff` | 0.45 | `(300, 260, -220)` |
| hemi | `biome.sky` / `biome.bg1` | 0.55 | — |
| ambient | `#ffffff` | 0.18 | — |

Shadow: ortho `±420 / ±380`, `near 10`, `far 1400`, map `1024`,
`bias -0.0004`, `normalBias 0.02`.

Rim: `RIM_W 18` outward, `LIP 6` above the wall top, inner edge inset 4 into
the wall ring (no coplanar faces), bevel `2`.

## Tests

`tests/three.test.mjs` — rewrite the frozen numbers, plus new contracts:

- Rig defaults, `resetOrbit`, `g.rig`, and the intro settle frame all read
  `el 0.62 / dist 960 / target y -44`; clamps at `0.18` / `1.05`.
- **Framing gate**: for every one of the 8 biomes, project all four board
  corners at floor and at `hWall+LIP` through a real `PerspectiveCamera` on
  the frozen rig; assert `|ndc| <= 0.96` and vertical centre `|cy| < 0.05`.
  This is the regression that catches any future rig edit that crops ICE.
- **Frame gate**: exactly **one** mesh tagged `trim`; its geometry carries a
  hole; its bounding box is symmetric and no wider than `W + 2*RIM_W`. A
  4-rail regression fails on the count; a spanning-rail regression fails on
  the width.
- Lights: key/fill/hemi/amb colours, intensities, shadow ortho + `normalBias`;
  fill must **not** cast shadows.
- Fat-world draw calls pinned at **143**, still `<=500`.
- `sizeCanvases` regression: after a kind flip, `#gl.width` / `#gl.height`
  are untouched (the dpr=2 quarter-crop guard).

## Verify

Node covers the numbers; the *look* is not Node-testable. Play-verify headed
on room 1 (JUNGLE) and room 2 (ICE, tallest walls, worst framing case) after
the change, per the standing "play-verify in a browser after render changes"
rule.
