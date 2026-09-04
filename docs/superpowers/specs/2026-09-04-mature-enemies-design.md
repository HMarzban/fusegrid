# Mature enemies + room-exclusive faces (2026-09-04)

Visual + roster pass so every room introduces a **new body**, and every
foe reads as a mature arcade threat at 40px (ENEMIES plate, CLASSIC 2D,
REAL 3D faces). Public name Fusegrid / FUSE/GRID. Never Bomberman.

## Approaches

1. **Redraw the six + exclusive extras on rooms 6–8 via `ROOM_EXTRA` (pick).**
   CORE / PLUS / MAX strings for rooms **1–5 stay bit-identical**. Replace
   `ROOM_EXTRA` `fast,chaser,rocket` with three new types that reuse wander /
   phase / chase. Mature `drawEnemyBody` + matching 3D face paints. Keep
   `SLOT_MESH.enemy === 4` and fat-world **186**. Existing six 3D base geos
   stay sphere / box / torus / cone (child-index ABI).

2. **New AI per extra room.** Burrow teleports, shade blinks, knight charges.
   New `updateEnemies` branches, new seed pins, easy to break v6. Reject.

3. **Art-only, no new types.** Palette-swap the current L6–8 extras. Fails
   “clearing into a new room shows a new body.” Reject.

**Pick 1.** Kind `"2d"` must not import three. Frozen rig
`{az:0, el:0.419, dist:1000}`. Attract stays CORE / pact=0.

## Rule

- Rooms 1–5 `heatRoster` strings unchanged (CORE / PLUS / MAX).
- `spawnEnemy` speeds, colors, radii, `pass`, and `cd` for the original six
  unchanged. New types only add rows.
- `updateEnemies` algorithm unchanged. Hunt types set `e.hunt` at spawn
  (`chaser`, `fast`, `knight`); AI reads `e.hunt` instead of a type list.
  Phase types still use `e.pass`.
- Event `{ t: "kill", type }` still routes `foe_<t>`.
- Plant / kick / throw / remote / `item_*` cues unchanged.
- `SLOT_MESH.enemy === 4`. No extra foe children. Fat-world **186**.
- Unique 3D pickup geos (`ITEM_GEO`, slot 2) stay. Do not revert them.

## Roster (room → new face)

| Room | Look | First exclusive body | AI reuse |
|---|---|---|---|
| 1 | JUNGLE | WALKER (grunt visor) + SENTRY (bunker) | wander / still |
| 2 | ICE | FAST (hover drone) | hunt |
| 3 | FACTORY | CHASER (hunter helm) | hunt |
| 4 | WATER | PHANTOM (wraith cloak) | wander + pass |
| 5 | ARENA | ROCKET (cruise missile) | wander + pass |
| 6 | SAND | **BURROW** (`burrow`) scarab | wander |
| 7 | VOID | **SHADE** (`shade`) void wraith | wander + pass |
| 8 | CROWN | **KNIGHT** (`knight`) plate helm | hunt |

L5 CORE carry still rides into 6–8; each extra room **appends** one exclusive
type (`ROOM_EXTRA = burrow, shade, knight`). PLUS / MAX L6–8 append the same
extras on top of the L5 PLUS / MAX base.

## Per-foe (silhouette · color · intro · SFX · AI)

Colors for the original six stay the spawnEnemy table (cabinet + 3D identity).

| `t` | Name | Color | Rooms | Help / score | SFX `f0` | AI |
|---|---|---|---|---|---|---|
| walker | WALKER | `#8affc1` | 1–8 | wanders the lanes · 100 | 196 | wander |
| stationary | SENTRY | `#c58aff` | 1–3, 5–8 | stands still · touch still hurts | 110 | still |
| fast | FAST | `#ffd447` | 2–8 | twice as fast · hunts you · 100 | 880 | hunt |
| chaser | CHASER | `#66c8ff` | 3–8 | hunts you down · 100 | 494 | hunt |
| boomerang | PHANTOM | `#ff9dd6` | 4–8 | walks through green bricks · 250 | 740 | wander + pass |
| rocket | ROCKET | `#ff7a59` | 5–8 | through bricks · 300 · room 5 | 82 | wander + pass |
| burrow | BURROW | `#c48a3a` | 6–8 | crawls the sand · 150 | 147 | wander |
| shade | SHADE | `#6b7cff` | 7–8 | phases through bricks · 250 | 311 | wander + pass |
| knight | KNIGHT | `#d4b05a` | 8 | hunts in plate · 200 | 262 | hunt |

`killEnemy` scoring: rocket 300, phantom/shade 250, knight 200, burrow 150,
else 100. Rooms 1–5 never spawn the new three, so CORE v6 scores stay.

### Silhouettes (canvas `drawEnemyBody`, readable at r≈14 / 40px)

No cute sclerae / googly pupils. Armor, visor, drone, wraith, missile.

- **WALKER** — rounded helm, mint visor bar, shoulder plates, boots. Infantry
  grunt, not a smiling disc.
- **SENTRY** — dark bunker square, magenta core, visor slit, stub barrel.
- **FAST** — wide hover disc, twin intakes, gold chevron trail.
- **CHASER** — tall hunter helm, dorsal horn, cyan visor, jaw plate.
- **PHANTOM** — spinning C-cloak (phase tell), hollow core (not a white bead).
- **ROCKET** — nose cone, side fins, pad, exhaust flicker.
- **BURROW** — oval carapace, sand bands, mandibles.
- **SHADE** — kite/diamond cloak, void hollow, two wisps.
- **KNIGHT** — shield helm, gold plume, T-slit visor, pauldrons.

ENEMIES lists all nine (`FOES`). At 9 rows, the plate uses **3 columns** so
the 608×352 3D shell still fits name + help + `ROOMS`.

## 3D

- Original six: keep pinned base geos (sphere / scaled sphere / box / torus /
  cone) and the 4-mesh slot (base + 2 details + face plane). Do not flex
  child-index. Chaser crest pin stays.
- New three: same 4-mesh contract. Base geos **Cylinder** (burrow grub),
  **Octahedron** (shade), **Box** helm (knight, taller than SENTRY cube).
- Face plane `eye_<t>` paints a **visor / lens / slit**, not cartoon eyes.
  `paintEyes` is rewritten; the old “4 ellipses” ABI is replaced on purpose.
- Idle bob / stomp / spin / flame stay render-side.

## Tests

- CORE L1–5 roster strings unchanged (including seed-42 L1 start + 180-step
  pin).
- L6 includes `burrow`; L7 `shade`; L8 `knight`. L6 does **not** gain an
  extra `fast`.
- `FOES.length === 9`; every `col` matches `spawnEnemy`.
- `drawEnemyBody` signatures pairwise distinct; each paints ≥ 3 ops.
- ENEMIES plate lists all nine names + ESC inside the shell at 600×520 and
  608×352.
- `sfxOf({t:"kill",type:"burrow"}) === "foe_burrow"`; nine distinct `foeOf.f0`.
- `SLOT_MESH.enemy === 4`; fat-world draw calls === 186.
- Original-six 3D geo / detail-child pins stay.

## Out of scope

Mid-run heat, Sudden Death, internet play, new AI algorithms, per-biome
cameras, extra foe children, reverting unique 3D pickup geos.
