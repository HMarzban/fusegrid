# Enemy redesign (2026-09-04)

Visual + SFX pass for the 6 Fusegrid foes so ENEMIES and in-arena 2D
match item-cabinet quality. **Not new AI.** `src/ai/enemies.js` step
outcomes stay bit-identical on a fixed seed. Catalog stays 6.

Public name Fusegrid / FUSE/GRID. Never Bomberman on any surface.

Names (FOES / `drawEnemiesHelp`): WALKER, SENTRY (`stationary`), FAST,
CHASER, PHANTOM (`boomerang`), ROCKET.

## Approaches

1. **Cabinet 2D silhouettes + kill tints (pick).** Rewrite `drawEnemyBody`
   so the blob trio is not three colored circles: WALKER disc + boots +
   pack, CHASER tall egg + crest, FAST wide puck + trail. SENTRY / PHANTOM
   / ROCKET keep their square / C-arc / pyramid, with a darker outline.
   Kill event gains `type` so `sfxOf` can play `foe_<type>` from a 6-tint
   table in `src/audio/foe.js`. REAL 3D meshes stay (already distinct).
   Fat-world draw calls stay **186**.

2. **New 3D mesh stacks per foe.** Readable from the 66° rig, but any extra
   child blows `SLOT_MESH.enemy === 4` and the 186 pin.

3. **Color-only polish.** Faster, still six blobs on ENEMIES.

**Pick 1.** No streamed files. Kind `"2d"` must not import three.

## Rule

- `FOES[].t` / `name` / `col` / `rooms` / `help` unchanged.
- `spawnEnemy` speeds, colors, radii, `pass` unchanged.
- `updateEnemies` / `src/ai/enemies.js` untouched.
- Event `{ t: "kill", x, y, color }` gains `type: e.type`. Missing type
  still plays generic `kill`.
- Plant / kick / throw / remote / `item_*` cues unchanged.
- `SLOT_MESH.enemy === 4`. Frozen rig. No per-biome cameras.

## Tests

`tests/enemies-art.test.mjs`:

- 6 FOES names and ids.
- `drawEnemyBody` signatures pairwise distinct.
- WALKER has boots+pack (`fillRect` ≥ 3). CHASER / FAST call `scale`.
- Seed 42 / 180 PLAY steps: same roster fingerprint as today.
- `sfxOf({t:"kill",type:"walker"}) === "foe_walker"`; `sfxOf({t:"kick"})`
  stays `kick`. Six distinct `foeOf.f0`.
- Fat-world draw calls === 186.

## Out of scope

Mid-run heat, Sudden Death, internet play, extra foe types, AI retune,
3D mesh count changes.
