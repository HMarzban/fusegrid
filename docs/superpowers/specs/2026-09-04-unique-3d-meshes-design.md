# Unique 3D meshes (2026-09-04)

Cabinet glyphs are on 2D / ITEMS / HOW TO / HUD. REAL 3D pickups are still
one shared cube. Foes already have per-type geos on `SLOT_MESH.enemy === 4`.
This pass gives each of the 12 pickups a cheap unique body **without**
adding children or leaving 186.

Public name Fusegrid / FUSE/GRID. Never Bomberman on any surface.

## Approaches

1. **Shared per-kind BufferGeometry in the existing item slot (pick).**
   One cached geo per `POWER.t`, swapped by reference like enemy geos.
   Ring child stays. `SLOT_MESH.item === 2`. Fat-world stays **186**.
   N FLAME still uses the FLAME geo 32 times (same slot count, not 32 extra
   draws). Skip atlas maps on non-cubes (glyph stretch); Lambert tint is
   `POWER.col`.

2. **InstancedMesh per kind.** N FLAME = 1 draw. Fat-world would drop
   (~146) and the item pool would stop being 32 Groups. Bigger ABI rewrite
   than this pass needs.

3. **Extra children per slot.** Readable, but +1 mesh × 32 items = 218
   and a silent child-index flex. Reject.

**Pick 1.** Frozen rig `{az:0, el:0.419, dist:1000}`. Kind `"2d"` must
not import three. Foe 3D stays on the existing 4-mesh slot (already unique).

## Rule

- `POWER[].t` / `apply` unchanged. `SLOT_MESH.item === 2`.
- `SLOT_MESH.enemy === 4`. Do not add foe children.
- Headless item body stays POWER-bright Lambert (never a dark plate).
- Ring still additive, tinted by `pdef.col`.
- Bob / spin / ring pulse stay render-side.
- `paintItemFace` / `item_*` atlas stay for 2D-family tests; 3D unique
  geos do not wear those maps.
- Deliberate ABI: `three.test.mjs` cube/`BoxGeometry` item pins update
  to the per-kind types. Draw-call pin stays **186** (not flexed).

## Geos

Cheap primitives or `mergeGeos` (no Extrude). Pairwise distinct
(type + vertex count + parameters):

| t | geo |
|---|---|
| fire | Cone 7-seg (spike) |
| bomb | Sphere 12×10 |
| speed | Octahedron r=0.26T |
| heart | two merged spheres |
| shield | Cylinder 8-seg |
| kick | Box (boot) |
| throw | Sphere 10×8 |
| pass | Box (brick slab) |
| line | Cylinder, rotated to a spear |
| power | Octahedron r=0.34T |
| pierce | Cone 5-seg |
| remote | Cylinder 10-seg (plunger) |

## Tests

`tests/pickup-3d.test.mjs` + `tests/three.test.mjs`:

- 12 live kinds do not share one body `uuid`.
- `SLOT_MESH.item === 2`. Fat-world === 186. `calls <= 500`.
- Headless fire body is not `BoxGeometry`; color stays `#ff8a3c`.
- Kind `"2d"` still has zero `three` imports.

## Out of scope

InstancedMesh rewrite, extra item/foe children, AI / applyPower / plant
rules, per-biome cameras, mid-run heat, Sudden Death, internet play.
