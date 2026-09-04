# Enemy 3D bodies (2026-09-04)

Follow-up to `2026-09-04-enemy-character-art-design.md`. That pass rebuilt all
nine foes in CLASSIC 2D as real characters and deliberately deferred REAL 3D,
touching only the `eye_<type>` face strip. The bodies in `ENEMY_3D` were still
spheres and boxes, so none of the 2D silhouette language existed in 3D.

This pass rebuilds the nine 3D bodies. Art only: no AI, no rosters, no speeds,
no camera, no lights, no `BIOMES` edits.

Public name Fusegrid / FUSE/GRID.

## What the frozen rig actually shows

The rig is `{az:0, el:0.62, dist:960, target:[0,-44,0]}` — the camera sits due
south of the board, **54.5° above the horizon**. 54.5 > 45, so the camera is
looking more down than across. Two consequences drive every decision below:

1. **The plan-view footprint is the primary read.** More screen area lands on
   an enemy's top faces than on its south faces. Nine distinguishable
   footprints beat nine distinguishable profiles.
2. **Anything below the waist is wasted.** Boots, skids and gorgets are
   almost entirely occluded by the body above them. They earn their place by
   grounding the shape and shaping its cast shadow, not by being seen.

The old bodies failed the first point hardest: `walker`, `chaser` and `fast`
were all scaled spheres, so in plan view they were three colored circles —
exactly the 2D defect the previous pass fixed.

## Approaches

1. **Merge per-type geometry into the existing four children (pick).**
   Build every body from primitives pre-transformed with
   `translate/rotate/scale`, then fuse them with a variadic `mergeGeos`. The
   slot keeps exactly four meshes, so `SLOT_MESH.enemy` stays 4 and fat-world
   draw calls stay 143. Cost is vertex count, which is free at 16 enemies.

2. **Add children (5-6 per slot).** Easiest to author — one mesh per part, its
   own material and transform, all ref-swapped. But `SLOT_MESH.enemy` goes to
   6, fat-world rises 143 -> 175, every `children[2]` face index in `update()`
   and in three tests shifts, and it buys nothing merging cannot. Rejected.

3. **Lathe/extrude profiles.** `LatheGeometry` revolves a 2D profile and
   `ExtrudeGeometry` sweeps a `THREE.Shape` — which is exactly how the 2D
   contours are already authored (`poly()` / `oval()` in `enemybody.js`). This
   is not an alternative to 1; it is the *content* of 1. Adopted inside it.

**Pick 1, filled with lathe profiles for the radially symmetric foes and
extruded shapes for the planar ones.** Lathe carries bell, ogive and cowl;
extrude carries the delta wing, the dorsal crest and the tail fins;
primitives carry everything else.

### Why four meshes is enough

The 2D build is five stacked beats. Three of them are free in 3D because the
frozen light rig already does them, which is why four meshes suffice:

| 2D beat | 3D equivalent |
|---|---|
| contact shade | the real cast shadow from the warm key (sole caster) |
| dark contour | the STRUCTURE detail mesh |
| inset body | the hull (slot base mesh) |
| upper-left sheen | Phong specular against the key at `(-240,560,320)` |
| sculpted eye | the `eye_<type>` face plane, plus an ACCENT detail mesh |

So each slot is a four-channel contract:

| child | channel | typical material |
|---|---|---|
| base | HULL — the contour that carries the footprint | identity color; Phong for creatures, Lambert for machines |
| `children[0]` | detail A | per type |
| `children[1]` | detail B | per type |
| `children[2]` | FACE — `eye_<type>` strip | unlit Basic, atlas-mapped |

Detail A/B are **not** globally "dark then accent". `stationary` puts its
magenta lens on A because `S2.F` and `S4.A` pin the magenta Basic core to
`children[0]`, and `walker` puts its left side on A and its right side on B so
the existing alternating stomp still has two independent transforms to drive.
Assigning the channels per type is what let this pass keep both pins alive.

### Brows are geometry, not paint

A one-material hull cannot paint a brow band. It can *cast* one: a step in a
lathe profile — radius flares out, then steps back in — produces a real
overhang whose top edge catches the key and whose underside shades the face
below it. `walker`'s brow band and `rocket`'s warning band are both profile
steps, not extra meshes. This is the single trick that made the 4-mesh budget
work.

## Per foe

Geometry approach, the silhouette cue that survives 54.5°, and cost in
vertices (hull + detail A + detail B).

| `t` | Geometry | Silhouette cue at the rig | Verts |
|---|---|---|---|
| `walker` | lathe bell with a brow step; A/B = mirrored shoulder plate + boot boxes | shouldered round footprint; two dark plates break the circle laterally; boots stomp alternately | 120 + 48 + 48 |
| `stationary` | 4-gon frustum `rotateY(pi/4)` wider at the base, plus a front embrasure; A = hex lens disc + core, flush on the frustum face; B = roof mortar stub + 4 rivets + skirt | square planted footprint with a flat south face; the only foe with a wider base than top, and the only one with no legs | 52 + 92 + 240 |
| `fast` | two stacked extruded deltas (plate + inset spine); A = twin raked fins + cockpit lens; B = 3 additive trailing chevrons | the only straight-edged footprint on the board — a pointed delta with no curve anywhere | 144 + 149 + 108 |
| `chaser` | scaled ellipsoid + rear cone, merged then `rotateX(0.2)` forward lean; A = raked dorsal crest + down-angled brow; B = twin skids | teardrop footprint, broad at the south face and tapering north, with a dark crest ridge running fore-aft over the spine | 208 + 43 + 48 |
| `boomerang` | C-torus arc 4.7 laid flat, translucent; A = 3 hem tatters; B = flat bezel ring at the hub | the only foe you see the floor through, and the only open (non-convex) footprint; the socket eye counter-spins so it holds still inside a spinning ring | 243 + 45 + 119 |
| `rocket` | lathe ogive with a warning-band step, hovering off the floor; A = 3 swept extruded tail fins at 120°; B = exhaust cone + hot core cone | tall narrow ogive with a triple-fin star footprint — the only foe that does not touch the floor | 143 + 108 + 78 |
| `burrow` | 3 scaled ellipsoids merged along Z, largest forward; A = 2 mandible wedges + carapace brow; B = 3 additive sand puffs behind | long low segmented footprint with visible plate seams and a plume trailing north; the only body far longer than it is tall | 343 + 54 + 189 |
| `shade` | lathe cowl + 4 uneven tatters, floating clear of the floor, casts **no** shadow; A = void interior disc raked up at the camera; B = additive floor glow ring | ragged asymmetric hem and a glowing floor pool where every other foe has a hard shadow | 151 + 76 + 38 |
| `knight` | 6-gon frustum tapering to a chin, flat south face + 3 crown spikes; Phong with a warm specular; A = 2 pauldrons + gorget; B = unlit pale nasal bar | widest shouldered footprint plus three spikes breaking the top outline — the room-8 boss read | 97 + 72 + 24 |

3080 vertices across all nine types, which is nothing next to a single board.
The cost of this approach is vertices, and vertices were never the constraint.
Draw calls were, and they did not move.

Every foe still gets the `eye_<type>` face plane, and `walker` drops to **one**
big eye in `paintEyes` to match its 2D body (the strip gave it two).

### Face planes move onto the bodies

They used to float above the hulls at `EYT[k][1] = h + r*0.35`, which is where
"big tilted face planes" came from in the 2026-08-25 identity wave. Every plane
now sits on the hull it belongs to — on the brow, in the cowl mouth, on the
visor face. `boomerang` is the exception: its plane lies **flat** (`rot.x =
-pi/2`) at the hub so the socket eye reads straight up into the camera.

### CROWN room-8 palette separation

Room 8 puts `knight` (gold `#d4b05a`), `fast` (gold `#ffd447`) and `burrow`
(sand `#c48a3a`) on a gold floor between gold walls. Separated with materials
and geometry only — `BIOMES` is untouched:

- `knight` becomes the only Phong-with-specular foe, so the key light puts a
  hard highlight on its crown and pauldrons that no flat gold surface has, and
  its unlit pale nasal bar sits well above every gold value in the room.
- `fast` keeps flat Lambert and carries dark fins plus a dark cockpit lens, so
  it separates by internal value contrast and by its straight-edge footprint.
- `burrow` keeps its duller Phong(40) and adds an additive sand plume, which is
  a lighter value than the floor and moves with the foe.

The CROWN biome itself is not restyled — out of scope.

## ABI re-pins

`tests/three.test.mjs` pins the enemy slot hard, and those pins are contract.
Six of them are re-pinned deliberately below; each new pin still fails on a
real regression. Nothing was loosened into a range and nothing was deleted.

**Unchanged (still guarding, verbatim):**

- `SLOT_MESH.enemy === 4`, and fat-world draw calls `=== 143`.
- `EYT.e_stationary[2] === r*1.16` — the frustum's south face lands at
  `r*1.15`, so the slit plane keeps its exact offset.
- `stationary` base Lambert `#2a1030`, magenta `#c58aff` Basic core on
  `children[0]`.
- The `GD.e_rocket` reference-swap probe.
- `EI.2` boomerang: the C-torus was already right, so its hull is the ONLY one
  this pass did not rebuild. It keeps `parameters.arc === 4.7` and the flatness
  bound verbatim; only its material (now translucent) and its details (hem
  tatters, hub bezel) changed.
- `EI.3` baked silhouettes: `chaser` bbox y/x > 1.3, `fast` y/x < 0.75.
- `EI.7` boomerang slot yaw `=== (t*10) mod 2pi`.
- `EI.8` rocket flame material swap `#ffde7a` <-> `#ff7a3a` on `children[1]`.
- `EI.9` fast trail `#ffd447` additive @0.30, headless face fallback `#f4f7ff`.

**Re-pinned:**

| Pin | Was | Now | Why |
|---|---|---|---|
| `S2.F wantGeo` | `Sphere/Sphere/Sphere/Box/Torus/Cone` | `BufferGeometry` for the five merged hulls, `CylinderGeometry` for `stationary` | the primitives are gone; the merged hulls report `BufferGeometry` |
| `S4.A wantDetail` | per-type primitive pairs | the new per-type pairs | every detail mesh changed |
| `S4.A` chaser crest | `parameters.width === r*0.22`, `parameters.depth === r*1.35` | bbox facts: thin across X (`< r*0.5`), long fore-aft (`> r*1.0`), top above the hull midline | merged geometry has no `.parameters`; the bbox pin guards the same thing — a fore-aft ridge, not a lump |
| `EI.1` rocket | `parameters.radialSegments === 3` | height still `r*2.5`, `dh < dy`, apex is a single vertex, widest radius sits **below** the apex | a lathe has `segments`, not `radialSegments`; the new pin guards the ogive, which is the actual contract |
| `EI.5` face planes | `EYT[k][1] > EH[k]` for the blob trio | for all nine: the plane sits **inside** the hull's world Y span and forward of center (`boomerang` exempted as flat-at-hub) | the old pin *required* the floating strip this pass removes; the new pin fails if a face ever floats off its body again |
| `EI.6` `GD.e_fast[0].index.count` | `72` | `372` | fins are no longer two boxes; the count is re-pinned exactly so a silent fin rebuild still fails |

## New pins

The old suite only exercised six of the nine types. Added:

- All **nine** types build a hull + 2 details + a face plane, and the nine
  hulls are nine distinct geometry objects.
- Per-type footprint facts, one per foe, each keyed to its silhouette cue:
  `walker` brow step flares then narrows; `stationary` base wider than top;
  `fast` flat and straight-edged; `chaser` leans forward; `boomerang` open;
  `rocket` and `shade` hulls float clear of the floor; `burrow` far longer
  than tall; `knight` carries three crown spikes above the helm top.
- `shade` is the only type with `castShadow === false`; the other eight cast.
- `boomerang` counter-spins its face plane against the slot yaw, so the socket
  eye holds a fixed world orientation while the hem spins.
- Every hull fits inside its tile footprint, so bodies never overlap walls.
- `mergeGeos` is variadic and accepts non-indexed inputs (`ExtrudeGeometry`
  emits no index), while the two-argument crossed-quad case stays exactly
  8 verts / 12 indices.

## Out of scope

`src/ai/enemies.js`, speeds, `hunt` flags, spawn tables, `heatRoster`, CORE v6
rosters, attract config, `src/audio/foe.js` kill tints, the camera rig, the
light recipe, `BIOMES`, the CROWN biome palette, mid-run heat, Sudden Death,
internet play. No image assets, no npm deps.

## Verification

Full loop `for f in tests/*.test.mjs` — 24/24. Headed REAL 3D on loopback for
rooms 1 (JUNGLE), 2 (ICE) and 8 (CROWN), with `#gl` confirmed at 1200x1040
against `#c` at 600x520 on dpr=2 — 2x, not quarter-cropped. PWA `CACHE_NAME`
and `sw.js` `REV` bump together (v17 -> v18) because shipped bytes changed.

### What the browser changed

Three bodies passed every Node pin and still read wrong at the rig. Node can
measure a bounding box; it cannot tell you a part looks detached. All three
fixes were geometry, not new meshes:

1. `stationary`'s lens sat at `-0.42r` and protruded to `z 1.30r` on a frustum
   face that only reaches `1.06r` at that height, so it hung under the hull
   like a tongue. Raised to `-0.05r` and flattened into two shallow discs that
   sit flush-proud.
2. `shade`'s cowl mouth and eye plane both stood near-vertical (`rot.x -0.25`),
   which is edge-on from 54.5° — the twin eyes vanished into the void. Both
   raked up to `-0.7`/`-0.9` so the camera looks DOWN into the hood. This is
   the clearest lesson of the pass: a face has to face the RIG, not the
   direction of travel.
3. `rocket`'s floor scorch was an opaque cream disc wider than the warhead,
   reading as a puddle rather than a glow, and its `#3a1c10` fins read as
   cracks in the hull. Scorch cut (the two cones carry the exhaust), fins
   lifted to `#7a3a26`, the 2D `dk(col,.5)` value.

CROWN was checked with bricks intact, since the real collision is `brickA`
`#ffd447` against `fast`'s identity colour — the same hex. All three golds
separate, though `fast` is the weakest: its hull hue genuinely matches the
bricks and the read rests entirely on its dark fins and straight edges.

A stale `fusegrid-shell-v9` service worker in the test browser served
pre-change bytes twice during this pass, and both times it looked exactly like
the art had not landed. Clear the SW before trusting a 3D screenshot.
