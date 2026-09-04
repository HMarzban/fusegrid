# Cabinet rest (2026-09-04)

Finish the cabinet so HOW TO, HUD chips, and planted bombs speak the same
visual language as the 12-item glyphs (`drawIcon` / ITEMS) and 6 foe
silhouettes (`drawEnemyBody` / ENEMIES). **Not new rules.** Plant / kick /
throw / remote / `applyPower` / enemy AI stay bit-identical.

Public name Fusegrid / FUSE/GRID. Never Bomberman on any surface.

## Approaches

1. **Same glyphs, same names, same bomb family (pick).** HOW TO paints
   `drawIcon` wells for BOMB / THROW / REMOTE / KICK and uses those catalog
   names. HUD chips already call `drawIcon`; retint BOMB to POWER `#ff5d73`
   (drop leftover gold). 2D `drawBombBody` shares the pickup silhouette
   (round charge, curved fuse, spark, white + pip) while staying dark
   `#15181f` so live ordinance is not a rose cube. 3D bomb slot stays
   body+fuse+spark+ring+cap (`SLOT_MESH.bomb === 5`). Fat-world stays
   **186**.

2. **New HOW TO page + unique 3D bomb stack.** A second plate or extra
   bomb children would break the 600×520 / 608×352 fit ABI and the 186 pin.

3. **Copy-only.** Faster, HOW TO still looks like leftover text next to
   the ITEMS / ENEMIES bars.

**Pick 1.** No image assets. Kind `"2d"` must not import three. Frozen
rig `{az:0, el:0.419, dist:1000}`. No per-biome cameras.

## Rule

- `POWER[].t` / `name` / `apply` / `permanent` unchanged.
- `FOES[].t` / `name` / `col` / `rooms` / `help` unchanged.
- HOW TO keeps the 2-column × 3-row plate. Icon wells sit on the left of
  the four power rows only. WASD / MOVE and P / PAUSE stay text (no blob
  placeholders).
- Copy uses catalog names: BOMB, THROW, REMOTE, KICK (not leftover
  lowercase `bomb`). Footer drops the stale “5 rooms” line; rooms 6–8
  already exist after CLEAR.
- HUD: hearts / BOMB / FLAME call `drawIcon("heart"|"bomb"|"fire")` with
  POWER colors `#ff3b5c` / `#ff5d73` / `#ff8a3c`.
- Planted bomb: dark charge + curved fuse (`quadraticCurveTo`) + flicker
  spark + white + pip. Variant spikes / pierce rays / line extras stay.
  Pulse / `world.fuse` contract unchanged.
- 3D bomb: no new children. Glossy body stays `#15181f` Phong. Pulse and
  variant rings unchanged.
- Touch `#tbomb` is a blank pad (not a stale glyph). Leave it. Page
  `.hint` may match catalog names; no new DOM icons.
- Plate layout ABI: HOW TO / HUD still fit 600×520 and 608×352.
- Do not start unique 3D pickup/foe meshes in this spec.

## Tests

`tests/menudraw.test.mjs` + `tests/three.test.mjs` S4.D + `tests/pickups.test.mjs`:

- HOW TO texts include BOMB / THROW / REMOTE / KICK at both canvas sizes.
- HOW TO records `quadraticCurveTo` (bomb fuse) and stays inside the plate
  (title + four names + ESC BACK).
- HUD still paints BOMB / FLAME labels + counts; chip fills include
  `#ff5d73` / `#ff8a3c` / `#ff3b5c`.
- `drawBombBody` uses `quadraticCurveTo` and a + pip (`moveTo`/`lineTo`
  cross); no chimney `fillRect` stem.
- Fat-world draw calls === 186. `SLOT_MESH.bomb === 5`.

## Out of scope

Unique 3D pickup/foe meshes (next spec, gated on 186 / ≤500). Mid-run
heat, Sudden Death, internet play, AI retune, plant/kick/throw/remote
rules, extra item or foe types.
