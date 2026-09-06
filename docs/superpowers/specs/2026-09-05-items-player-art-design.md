# Items + player character art (2026-09-05)

> **Revision P1.5 — 2026-09-05.** The first glyph pass shipped and the user
> rejected it: *"the new itemts are not really intutive design graphic and
> people confiuse from the look, let's review it, and make more intiutive and
> more reall look."* Screenshot diagnosis: BOMB read as a berry, KICK as a
> slipper, THROW as a vague arrow, PASS as a magnet, LINE as a minnow, POWER
> as a generic sparkle, PIERCE as a magic spark, REMOTE as a folder. The pass
> had optimised plan-view distinctness and craft; players judge an icon by
> *"what nameable object is this?"* in one glance. §1.6, §1.7 and §4.5 are
> rewritten semantic-first below, and the outline / accent budgets are
> renegotiated to pay for it. Everything else in this spec stands.

Sixth pass on the 12 pickups, second on the hero. The 2026-09-04 enemy pass
made nine foes read as characters; items and the player did not get that
treatment and now look like the placeholder art in a cast of finished art.
This spec closes that gap in CLASSIC 2D and REAL 3D. Art only: no AI, no
`applyPower`, no sim, no rosters, no `CFG`.

Public name Fusegrid / FUSE/GRID.

## Why the current art reads as placeholder

Five defects, all visible in `media/still-jungle.png` and
`media/cover-630x500.png` with the frozen rig.

| # | Defect | Root cause | Fix |
|---|---|---|---|
| I1 | **Six of twelve pickups are circles from above.** `fire`/`pierce` cones, `bomb`/`throw` spheres, `shield`/`remote` cylinders differ only in radius at 59.1°. | Every `ITEM_MAKE` builder is a solid of revolution or a sphere, and a solid of revolution is a circle in plan view by definition. | The plan-view law (§1.1): low-`seg` lathes and flat-extruded plates only. |
| I2 | **The ring carries zero information.** All 12 rings are one `RingGeometry` restating `pdef.col`, which the body already states. | `ringForItem(t,col)` memoises one geo + a hue. | Ring becomes the family channel — four profiles (§1.4). |
| I3 | **Item bodies are one flat value.** One Lambert, one tint, no shaded facet, so a pickup is a colored nub with no volume — the item version of the "sticker" tell the enemy pass named. | No two-tone geometry; the enemy `lathe` flare-then-narrow trick was never applied to items. | Geometric value split (§1.2). |
| I4 | **The 2D glyphs have no shading beats.** Every `drawIcon` case is fill + `col` + flat accents. `enemybody.js` gives every foe five beats; `icons.js` gives every item one. | The 2026-09-03 pickup pass predates the character-art craft. | The cabinet five-beat (§1.7), on the shared helpers moved into `icons.js`. |
| P1 | **The player reads as a toy and as a foe.** Balloon dome ≈ half the stack, antenna rod + red ball, two big round cyan eyes; from above it is a teal ball, and WALKER (`#8affc1`) is a mint ball of the same size and value. | The 2026-08-25 stack was authored for a 45° orbit and never re-read at 59.1°; hue was expected to separate player from foe. | SIGNAL RUNNER (§2). Separation is by **structure and shape**, never hue — the three-golds lesson, third occurrence. |

## Approaches

1. **Plan-view-first rebuild of both, inside the existing pools (pick).**
   Items keep `SLOT_MESH.item === 2` and earn their two-tone from geometry;
   the ring becomes the family channel. The player collapses 7 kit-bashed
   children into a 5-mesh stack — one merged matte hull, one `p.color`
   crown, one specular visor, two boots — deleting the antenna outright.
   Fat-world **143 → 141**.

2. **Textured items: wire the dormant `atlas.item_<t>` onto the hull.**
   Exact 2D↔3D glyph parity for free. Rejected: it re-litigates the
   2026-09-04 decision that "3D unique geos do not wear those maps", needs
   per-kind UV authoring on every new hull, and a glyph painted on a facet
   is invisible in plan view — it fixes nothing about I1, the loudest
   defect. The atlas keys stay baked and stay unused.

3. **A third item mesh for a per-kind emissive accent.**
   `SLOT_MESH.item` 2→3, fat-world +12. Rejected: the ring is already the
   additive channel and is currently wasted (I2); a third additive
   InstancedMesh needs its own shadow gate; and the enemy pass proved a
   single-material hull can carry a two-tone read without one.

**Pick 1.** Kind `"2d"` must not import three. Frozen rig
`{az:0, el:0.54, dist:870, target:[0,-48,0]}` and the one global light
recipe are untouched.

## Refuses to change

- `POWER` catalog: 12 rows, the pinned `IDS` order, every `t` / `name` /
  `help` / `col` / `permanent` / `apply`. **No hue moves.** Not one hex in
  `src/core/entities.js`, `src/render/scenes.js:165-166`, or
  `src/render/sprites.js:482`.
- `applyPower` semantics, caps, spawn tables, `hurtPlayer` revert set.
- `createPlayer` numeric fields and `p.color = "#37f0d0"`. The player /
  WALKER collision is fixed by structure, not by re-tinting the hero — a
  color edit in `src/core` would make this pass non-art.
- `src/ai/enemies.js`, `spawnEnemy`, `heatRoster`, CORE v6 rosters, attract
  config, pace, heat, pact.
- `src/audio/item.js` (`itemOf` / `sfxOf` / `ITEM_CUE`), `foe.js`,
  `boom.js`. Twelve grab tints stay as authored.
- `SLOT_MESH.enemy === 4`, `SLOT_MESH.bomb === 5`, `SLOT_MESH.item === 2`,
  `POOL_CAPS`, the nine `ENEMY_3D` rows and every enemy child-index pin.
- The frozen camera rig, the one light recipe, `NoToneMapping`, no fog, no
  per-biome camera / light / entity table. VOID stays dark by albedo.
- `atlas.item_<t>` keys: still baked by `paintItemFace`, still applied to
  no material.
- The `ITEM_MAKE` identifier — `tests/pickup-3d.test.mjs:314-330` is a
  source-grep gate. Rebuild the table's contents; do not rename it.
- Draw-call budget `<= 500`.

---

## §1 Item visual language

### 1.1 The plan-view law

The camera sits 59.1° above the horizon, past 45°, so the **plan-view
footprint is the primary read**. Three facts follow, and they are the rule
an implementer must not regress:

- A **solid of revolution is always a circle in plan view.** `Cone`,
  `Cylinder`, `Sphere`, `Torus`, and a high-`seg` `lathe` all collapse.
  This is the entire cause of I1.
- A **low-`seg` `lathe(pts, seg, r)` is an N-gon in plan view.** `seg` is
  therefore a real identity axis: 3 = triangle, 4 = square, 6 = hexagon,
  8 = octagon. Non-uniform `.scale(sx, 1, sz)` elongates the N-gon.
- A **`plate(pts, thick, r).rotateX(-Math.PI/2)` has its authored outline
  AS its footprint.** Any 2D outline becomes a plan-view silhouette
  directly, which is the strongest tool available and the reason the two
  transient families are flat.

Corollary — **a spinning kind must separate on rotation-invariant
properties only** (side count, radius, elongation ratio). Outline
orientation is identity only for kinds that hold a fixed yaw. That is why
CAPACITY spins and UTILITY / BLAST-SPECIAL do not (§1.5).

### 1.2 The four families

The split is mechanical, already encoded in `POWER`, not an art bucket.

| Family | Kinds | Mechanic | Archetype | Build |
|---|---|---|---|---|
| **CAPACITY** | fire, bomb, speed | `permanent:true` — stat grows and stays | upright faceted **shard** | `lathe`, low `seg` |
| **VITALITY** | heart, shield | survival (life / one-hit save) | low **dome** | `lathe`, `seg` 6–8 |
| **UTILITY** | kick, throw, pass, remote | transient interaction toggle | flat **wedge** | flat `plate` + mesa |
| **BLAST-SPECIAL** | line, power, pierce | `bombKind` selector | flat radiating **star** | flat `plate` + mesa |

`export const ITEM_FAMILY = {fire:"cap", bomb:"cap", speed:"cap",
heart:"vit", shield:"vit", kick:"utl", throw:"utl", pass:"utl",
remote:"utl", line:"bls", power:"bls", pierce:"bls"}` lives in
**`src/render/icons.js`** — render-side, imports nothing but `CFG`, safe for
both the 2D path (which must not import three) and `three/entities.js`.
No new file, no core edit.

Cross-family rule: hue is per-kind identity exactly as authored. Families
separate on **silhouette archetype + ring profile + idle rhythm**, never on
hue, and never by nudging a kind toward its family's average color.

### 1.3 Value split — one hull material, geometry does the shading

Every body stays **one `MeshLambertMaterial`, flat `pdef.col`, no map, no
emissive.** The two-tone read is built the way the enemy hulls build it:

- **Upright families (`lathe`):** the profile **flares then narrows** once —
  the overhang catches the warm key and shades the taper under it. Profiles
  MUST run bottom → top or three emits inward normals and the body renders
  as a hole.
- **Flat families (`plate`):** two stacked plates fused with `mergeGeos` —
  an outer shelf and an inner **mesa**. Exact call chain, and the order
  matters (`plate` centres on its own Z, so the lift must come *after* the
  rotation):

  ```
  shelf = plate(OUT, 0.55, r).rotateX(-Math.PI/2)                        // y in [-0.275r, 0.275r]
  mesa  = plate(IN,  0.40, r).rotateX(-Math.PI/2).translate(0, 0.28*r, 0) // y in [ 0.08r,  0.48r]
  geo   = mergeGeos(shelf, mesa)
  ```

  The `0.205r` riser between shelf top and mesa top is the lit facet; the
  shelf falls into its own shade. One geometry, one draw.

### 1.4 The one accent channel — the ring

Per the enemy rule (one hull material + **at most one** accent channel,
additive accents never cast), the item's accent channel is the ring, and
nothing else on an item is emissive.

- The **per-kind bright tell** is the **mesa** (flat families) or the
  **flare band** (upright families) — geometry that catches the frozen warm
  key, placed on the kind's defining feature (§1.6). It is a facet, not a
  light.
- The **ring** is additive `MeshBasicMaterial`, `depthWrite:false`,
  `castShadow` false (InstancedMesh default — do not set it), and it now
  carries **family**, replacing the wasted hue restatement.

Four shared ring geometries replace the single `iringGeo`. Twelve ring
InstancedMeshes still draw 12 — geometry count is not draw count.

| Family | Ring geometry (all `.rotateX(-Math.PI/2)`, `IT = CFG.TILE`) |
|---|---|
| CAPACITY | `RingGeometry(IT*0.36, IT*0.41, 24)` — one hairline, tight |
| VITALITY | `mergeGeos(RingGeometry(IT*0.28,IT*0.32,24), RingGeometry(IT*0.42,IT*0.46,24))` — concentric double |
| UTILITY | `mergeGeos(...6 × RingGeometry(IT*0.32, IT*0.44, 3, 1, i*Math.PI/3, Math.PI/3*0.62))` — six dashes |
| BLAST-SPECIAL | `mergeGeos(RingGeometry(IT*0.30,IT*0.36,24), ...8 × RingGeometry(IT*0.36,IT*0.48,2,1, i*Math.PI/4-0.10, 0.20))` — ring + eight ticks |

Ring radius encodes blast reach inside BLAST-SPECIAL via the per-instance
scale already written every frame:
`RING_SCALE = {line:0.86, pierce:1.00, power:1.16}`, every other kind `1`.

### 1.5 Idle motion

**One clock: `world.time`, read render-side.** The sim is not touched and no
new clock is introduced — every existing animation (2D item pulse, enemy
bob, ring pulse, bomb squash, player bob) already reads it, so a wall clock
would desync CLASSIC 2D from REAL 3D and destroy the parity this spec is
built on. `performance.now()` is forbidden here.

**Per-instance phase comes from grid position, not slot index:**

```
const ph = (it.x * 0.7 + it.y * 1.3) / CFG.TILE;
```

replacing today's `slot * 0.9`. `slot` is a compaction index, so collecting
one pickup re-indexes its neighbours and their animation jumps. Grid phase
is stable, zero-alloc, and identical in both renderers.

| Family | 3D body | 3D ring opacity | 2D echo in `drawItemBody` |
|---|---|---|---|
| CAPACITY | `rot.y = 2.2*t + ph`; `y = IT*0.66 + 4*sin(3*t + ph)` | `0.30 + 0.10*sin(5*t)` | scale `1 + 0.07*sin(3*t + ph)` |
| VITALITY | `rot.y = 0`; `y = IT*0.62 + 5*sin(2.4*t + ph)` | `0.26 + 0.08*sin(2.4*t)` | translate y `1.8*sin(2.4*t + ph)`, no scale |
| UTILITY | `rot.y = 0`, `rot.z = 0.16*sin(7*t + ph)`; `y = IT*0.64 + 3*sin(3.4*t + ph)` | `0.34 + 0.06*sin(7*t)` | `rotate(0.10*sin(7*t + ph))` |
| BLAST-SPECIAL | `power`: `rot.y = 1.8*t + ph`; `line`/`pierce`: `rot.y = 0`; `y = IT*0.66 + 4*sin(3*t + ph)` | `0.30 + 0.30*sin(9*t)` | outer ring `globalAlpha = 0.5 + 0.4*abs(sin(9*t + ph))` |

Non-spinning kinds hold `rot.y = 0` so the authored plan outline is what the
player always sees — `ph` phases the rhythm, never the yaw. `power` spins
because a 4-fold cross is rotationally symmetric, so spin costs it no
identity and buys "the biggest one". Compose the UTILITY quaternion from a
module-level `THREE.Euler` (`_e.set(0, 0, 0.16*Math.sin(...))`) so the
per-frame path stays allocation-free.

`SLOT_MESH.item` stays **2**. Instancing stays 2 draws per `POWER.t`.

### 1.6 Per kind — all twelve

**The binding rule (P1.5).** Each glyph depicts a **real, nameable object** a
player recognises instantly at the ITEMS-menu chip (~44px) *and* at the HUD
chip (~16–20px). Semantics **win** any conflict with the plan-view
distinctness budget: when the two fight, the 2D glyph keeps the nameable
object and the **3D body** carries the plan-view separation instead. A glyph
that a reviewer has to be told the meaning of is a failed glyph, however
distinct its silhouette.

Two 2D↔3D carve-outs follow from that, and they are deliberate, not drift:

- **`bomb`.** The 2D glyph is the classic round orb (round body, collared
  neck, curling fuse, lit spark). A sphere is a circle in plan view, so the
  **3D** `bomb` stays the low-`seg` (4-gon) faceted lathe of §1.6's CAPACITY
  row — a square footprint wearing the fuse/spark read on its upper tier.
  The orb is the *2D* truth; the facets are the *3D* truth; the shared story
  is "banded charge with a lit fuse". §5 line 13 is scoped accordingly.
- **`kick` chevrons, `remote` antenna + signal arcs, `throw` arc-arrow,
  `pass` mortar, `pierce` shards.** These are 2D-glyph accents. Their 3D
  counterparts stay the mesa on the plate outline; a chevron drawn in plan
  view would be invisible from 59.1° anyway.

`IT = CFG.TILE` (40). Lathe profiles are `[radius, y]` in `r`-units and run
**bottom → top**. Flat outlines are plan coordinates in `r`-units, fed to
`plate(pts, thick, r).rotateX(-Math.PI/2)`; the second coordinate becomes Z,
`-` is the near/front edge.

**CAPACITY — upright shard. Within-family axis: side count.**

| kind | 3D shape (one line) | Plan-view silhouette | Accent (mesa / flare band) | 2D glyph upgrade |
|---|---|---|---|---|
| `fire` `#ff8a3c` | `lathe([[0.62,0],[0.92,0.30],[0.70,0.66],[0.34,1.26],[0,2.00]], 3, IT*0.22)` — one tall 3-sided spike | **equilateral triangle**, half-width 8.1, height 17.6 | the `0.62→0.92` flare at `y 0.30`, the brow of the spike | **a flame.** Teardrop, pointed licking tip, one notch on the left where the tongue peels off; the `#ffd447` inner tongue is the accent. 8 verts / 1 op |
| `bomb` `#ff5d73` | `lathe([[0.74,0],[1.00,0.26],[0.80,0.52],[1.00,0.80],[0.78,1.06],[0.40,1.44],[0,1.62]], 4, IT*0.24)` — **two** stacked flare bands | **square**, half-width 9.6, height 15.6 — wider and shorter than fire | the upper `0.80→1.00` band (the second tier) | **a bomb.** The classic orb: round body, squared collar, `#ffd447` fuse curling up-right to a lit spark, one white specular crescent on the body. The 2D↔3D carve-out above applies. 8 verts / 3 ops |
| `speed` `#3db4ff` | `lathe([[0.55,0],[0.86,0.34],[0.60,0.78],[0.26,1.50],[0,2.30]], 3, IT*0.20).scale(1.9, 1, 0.5)` — a blade-thin raked shard | **sliver triangle**, 13.1 × 3.4, elongation 3.8:1, sweeps under spin | the `0.55→0.86` flare on the leading edge | **a lightning bolt.** Kept byte-identical from P1 — it already read. 6 verts / 1 op |

**VITALITY — low dome. Within-family axis: notched vs unbroken.**

| kind | 3D shape | Plan-view silhouette | Accent | 2D glyph upgrade |
|---|---|---|---|---|
| `heart` `#ff3b5c` | `mergeGeos(D.clone().translate(-IT*0.12,0,0), D.clone().translate(IT*0.12,0,0))` where `D = lathe([[0.86,0],[1.00,0.22],[0.84,0.52],[0.50,0.82],[0,1.00]], 6, IT*0.16)` | **twin 6-gon lobes with a waist notch on the front and back perimeter**, 22.4 × 12.8, height 6.4 — the only twin-lobe footprint in the set | the two lobe crowns | **a heart.** Kept byte-identical from P1 — it already read. Also the HUD lives glyph, whose `>= 12` curve-op gate (`three.test.mjs` S4.D) depends on the quadratic lobes: do not re-author it as a polygon. 8 verts / 1 op |
| `shield` `#6fb7ff` | `lathe([[1.00,0],[1.06,0.18],[0.96,0.40],[0.66,0.72],[0,0.92]], 8, IT*0.21)` | **clean unbroken 8-gon**, half-width 8.9, height 7.7 — the only convex closed round *3D* outline in the 12 (P1.5: the 2D `bomb` glyph is now round too; the two never meet, since the 3D `bomb` stays a 4-gon) | the `1.00→1.06` rim flare | **a shield.** Kept byte-identical from P1 — heater crest + chevron already read. 8 verts / 1 op |

**UTILITY — flat wedge. Within-family axis: where the outline is cut.**

| kind | Plan outline (shared 2D↔3D, `r`) | 3D | Accent mesa | 2D glyph |
|---|---|---|---|---|
| `kick` `#c07a3a` | `mesa(ITEM_SHAPE.kick, [M_KICK], IT*0.24)` — the profile boot read as a flat plate | boot profile: long thin foot, short shaft; footprint ~21 × 21 | the toe lobe | **a boot, in profile, mid-kick.** Shaft up-left, ankle, foot running right and rising; the toe is a quadratic so it rounds. Accents: a `dk(col,0.62)` **sole** strip along the bottom edge (the single strongest "this is a shoe" cue), then `#ffce8a` toe cap + two trailing motion chevrons in one fill. The foot must stay **thin and ~2× the shaft's length** — equal masses read as an elbow, which is exactly how the P1 wedge failed. 8 verts / 2 ops |
| `throw` `#ffb347` | `mesa(ITEM_SHAPE.throw, [M_THROW], IT*0.23)` | orb-plus-nub plate, held yaw | the orb crown | **a bomb sailing along a thrown arc.** Body = the same orb BOMB uses at **half size**, pushed off centre to the lower right, with a fuse nub. Accent = the arc itself, drawn as a real filled **arrow** (tail lower-left, head upper-right) plus a `#ffd447` fuse spark. Mass distribution is the entire separation from BOMB: big centred orb there, small orb + long arc here. A bare curve reads as a sprout — the arrowhead is what makes it a verb. 8 verts / 2 ops |
| `pass` `#77ff99` | `mesa(ITEM_SHAPE.pass, [M_PASS, M_PASS_L, M_PASS_R], IT*0.24)` | **wall with a through-gap**, wider than deep. A simple polygon, no `Shape` hole | two mesa bars flanking the gap mouth | **a brick wall you walk through.** Body = a wall ~1.8× wider than tall with a gap notched **down from the top edge** (the wall stays solid across its lower course, which is what `M_PASS` mesas onto and what `M_PASS_L` / `M_PASS_R` flank). Accents: `dk(col,0.62)` **mortar courses** (one horizontal course + staggered verticals, one fill) so it is unmistakably masonry, then a `#fff3b0` arrow threading the gap bottom-to-top. **Wall-dominant** — that is what keeps it off PIERCE. 8 verts / 2 ops |
| `remote` `#e8c35a` | `mesa(ITEM_SHAPE.remote, [M_REMOTE], IT*0.24)` | box plate with the antenna spur in the outline | chip inside the box | **a hand detonator.** Body = a wide low box with a **thin antenna** standing off the right shoulder, both in the outline. Accents: one big round `#ff5d73` **plunger button** (four quadratics — never an `arc`, see §1.7) and two `#fff3b0` signal curves off the antenna tip. 8 verts / 2 ops |

**BLAST-SPECIAL — flat star. Within-family axis: point count (1 / 2 / 4).**

| kind | Plan outline (shared 2D↔3D, `r`) | 3D | Accent mesa | 2D glyph |
|---|---|---|---|---|
| `line` `#d0e4ff` | `mesa(ITEM_SHAPE.line, [M_LINE], IT*0.26)` | **directed bar**, long, holds yaw | the central spine | **a beam with an arrowhead.** Body = flared origin at the left, long shaft, arrowhead tip at the right — the asymmetry is what stops it reading as a plain double-headed arrow. Accents: a `#fff3b0` hot core down the shaft, and a white 8-spike **muzzle burst** at the origin. 9 verts / 2 ops |
| `power` `#ff4d5e` | `mesa(ITEM_SHAPE.power, [M_POWER], IT*0.24)` | **7-spike blast star**, spins (rotationally busy, so spin costs it no identity) | the arm spines | **an explosion.** Seven spikes of deliberately **uneven** length — the comic-boom outline. Even, regular arms read as a sparkle or a medical cross, which is precisely how the P1 8-point star failed. Accents: an inner `#fff3b0` flare ring and a white hot core. **14 verts** / 2 ops — the kind that spends the renegotiated budget |
| `pierce` `#8f8fff` | `mesa(ITEM_SHAPE.pierce, [M_PIERCE], IT*0.24)` | **1-point spike**, holds yaw | the forward spine | **an arrowhead punching through a brick.** Body = one broad **tip-dominant** arrowhead with a notched tail; no rectangle anywhere. Accents: four `#12203a` brick **shards** spraying behind the tip (one fill) and a `#fff3b0` edge highlight on the tip. Tip-dominant vs PASS's wall-dominant is the whole separation. 8 verts / 2 ops |

Geometry type after build: `fire` / `bomb` / `speed` / `shield` are
`LatheGeometry`; the other eight are `BufferGeometry` (merged). All twelve
geometry `uuid`s stay pairwise unique. `castShadow = true` on every body
InstancedMesh; never on a ring.

**Closest pairs, watch them in the headed loop (P1.5 replaces the old
`bomb`/`power` note).** The op-stream distinctness gates cannot catch either
of these — coordinates always differ — so they are review lines, not asserts:

1. **`pass` vs `pierce`** — both are "brick + arrow". They separate at
   **mass** level, never at detail level: `pass` is wall-dominant (whole
   brick, clean gap, thin arrow threading it), `pierce` is tip-dominant (big
   arrowhead, loose shards, no brick outline at all). At 16px a
   fragmenting-vs-intact brick distinction would not survive; a
   brick-dominant vs tip-dominant silhouette does.
2. **`bomb` vs `throw`** — both are "orb + curve". Same remedy: `bomb` is a
   large centred orb with a small fuse appendage; `throw` is a small
   off-centre orb at the end of a large sweeping arc-arrow.
3. **`line` vs `pierce`** at the 13px chip, where both collapse toward "an
   arrow". They hold apart on axis (`line` points right and holds yaw,
   `pierce` points up) plus `line`'s muzzle burst and `pierce`'s dark shards.

### 1.7 The 2D glyph — the cabinet five-beat

`icons.js` becomes the shared cabinet-craft module. **Move**
`tone` / `dk` / `lt` / `poly` / `oval` / `seal` out of `enemybody.js` into
`icons.js`; `enemybody.js` imports them. One craft for the whole cabinet,
`enemybody.js` shrinks, and because the helpers are pure the foe op streams
are byte-identical — `tests/enemies-art.test.mjs` must stay green with
**zero edits** in plans P1–P3 (see §3 for its one line in P4). If that suite
goes red, the move was done wrong; do not edit the suite to make it pass.

`enemybody.js`'s change is **imports-only**: delete the six local
definitions, add one import line. `ROCK`, `VOID`, the `S_*` contours, the
`BODY` table, and `drawEnemyBody` stay byte-identical.

Every glyph runs the same five beats, only its `poly()` outline varies. All
work in `s = CFG.TILE * 0.3` units, unchanged.

1. **form** — the outline at `k = 1`, offset `(+0.07s, +0.09s)` down-right
   (opposite the frozen warm key), filled `dk(col, 0.58)`. This is the
   drop/form shadow that lifts the glyph off the well plate. A floor
   ellipse is wrong here: a glyph in a `well()` is not standing on a floor.
2. **seal** — the outline at origin, stroked `RIM`, `lineWidth 2`.
3. **body** — the outline at origin, filled `col`.
4. **sheen** — the outline at `k = 0.62`, lifted `-0.10s`, filled
   `lt(col, 0.34)` — the upper-left lit facet.
5. **accent** — one small tell, ≤ 10% of the glyph area, in the kind's
   existing second color where it already has one (`fire` `#ffd447`,
   `bomb` `#ffd447`, `remote` `#ff5d73`, `pierce` `#12203a`,
   `shield` `#0d3f78`, `kick` `#ffce8a`) else `#fff3b0`, sitting where the
   3D mesa or flare band sits.

Legibility budget. The glyph is authored at `s = 12` and consumed at:
touch bomb pad 64px canvas at `1.4×` (largest, ~34px), in-arena board
~22–28px, ITEMS well `ws = clamp(ch-8, 16, 28)` then scaled
`(ws/28)*0.72` — **worst case `0.41×`, roughly a 10px glyph**, HUD/SCORES
well 14–22px. Rules that make one glyph serve all four:

- Outline is **≤ 14 vertices** (P1.5: was 12). Renegotiated, not waived. The
  twelve nameable objects cost 6–14 and only one kind — `power`'s
  seven-spike explosion — reaches the ceiling; every other glyph lands at
  6–9. The old 12 was a legibility heuristic, and the heuristic was wrong
  about *where* legibility comes from: an even, low-vertex outline is what
  made POWER a sparkle and BOMB a berry. Irregularity is the read.
- Accent ops **≤ 4** paint ops (P1.5: was 3) and the accent is a solid
  shape, never a hairline (`lineWidth >= s*0.12` on any stroke). Only `bomb`
  spends 3; nothing spends 4. The extra headroom exists so a kind can afford
  a **structural** accent (`kick`'s sole, `pass`'s mortar) *plus* its bright
  tell, instead of choosing. Note that multiple subpaths in one `beginPath`
  cost **one** op — `pass`'s five mortar bars and `pierce`'s four shards are
  one fill each, which is why the ceiling did not have to move further.
- Nothing paints outside **`±1.20 * s`** on either axis, so the well never
  clips the form-shadow offset. **Unchanged and non-negotiable** — this one
  is a real containment constraint from `well()`, not a heuristic. The
  headroom it leaves is **one-sided**: beat 1 repaints the outline offset by
  `(+0.07s, +0.09s)`, so a *positive* outline vertex may reach `1.13 / 1.11`
  while a negative one may use the full `-1.20`. Accents are drawn unoffset
  and get the full `1.20` in both directions.
- Arcs and ellipses are **banned in accents** except where a full circle is
  intended. The fit recorder bounds a partial `arc` by its whole circle, so
  a 40° signal arc would fail the gate for pixels it never paints. Draw
  curves as `quadraticCurveTo` — this is why `remote`'s signal arcs and its
  round plunger button are quadratics.
- No `fillText` in any glyph, ever (already pinned).

### 1.8 `drawItemBody` — family chrome and the 2D idle echo

The base disc (`rgba(8,12,24,0.92)` at `TILE*0.34`) stays for all 12. The
double `it.col` ring is replaced by the family echo, so the ring language a
player learns in REAL 3D is recognisable in CLASSIC 2D, which has no
additive ring at all:

| Family | 2D chrome |
|---|---|
| CAPACITY | one hairline circle at `TILE*0.36`, `lineWidth 1.5` |
| VITALITY | two circles at `TILE*0.30` and `TILE*0.42`, `lineWidth 1.5` |
| UTILITY | six 36° arcs at `TILE*0.38`, `lineWidth 2.5` |
| BLAST-SPECIAL | one circle at `TILE*0.33` plus eight radial ticks out to `TILE*0.46` |

Draw the dashes as arcs. `setLineDash` is not available on the headless
stub context and must not be used.

The 2D idle echo is the last column of §1.5's table, on the same
`ph = (it.x*0.7 + it.y*1.3)/CFG.TILE`.

### 1.9 Propagation — one glyph feeds them all

Rebuilding `drawIcon` + `drawItemBody` reaches, with no further edits:
the 2D board (`drawItems`), `paintItemFace` → the `item_<t>` atlas (baked,
unused), the ITEMS menu (`menudraw.js:494-540`), HOW TO PLAY
(`menudraw.js:424-491`), HUD chips (`scenes.js:128-177`), the touch bomb pad
(`sprites.js:485-505`), and the legacy iso renderer
(`r3d/scene3d.js:168`). `stampBombIcon`'s hardcoded `#ff5d73` needs no
companion edit because no hue moves.

---

## §2 Player — SIGNAL RUNNER

> **REVISION R1 — 2026-09-05.** The P1 build of this section was **rejected by
> the user**: *"the game's main character looks a bit too silly and doesn't
> feel mature enough. Let's revise the character's design and overall look."*
> At the live 28px size the P1 body read as a **white egg with a teal cap**:
> a near-circular outline filled at 90% luminance is a cute shape however many
> facets are cut into it, and the 3D hull read as a rounded boiler for the
> same reason. §2.1–§2.3 below are the R1 direction and supersede the P1 text
> wholesale; §2.0 records what did not change and why the failure happened.

### 2.0 What R1 keeps, and the lesson

**Kept, unchanged, because none of it was the problem:** the WALKER separation
story, `p.color` as the sole identity placement on the crown/crest, exactly
one specular surface (the visor), the five-beat 2D craft, the 5-mesh 3D stack
(`SLOT_MESH.player` stays **5**, fat-world stays **141**), the same five
geometry types, no antenna / ball / round eyes / dome, and every state mapping
in §2.4.

**The lesson, which is P1's lesson repeated one level up.** P1 optimised for
*plan-view distinctness from nine foes* and won that on paper — and the whole
suite stayed green through a body no human would call the hero. The gates
could see a fit box and an op stream; they could not see **roundness,
brightness or stubbiness**. R1 adds three gates that can (§2.5), each of which
fails on the P1 body. The general rule this program keeps re-learning: *an
agent judges the zoomed capture, the player judges the tiny live sprite* —
so the acceptance artefact is a 1:1 board with the hero **next to a foe**,
and only then a nearest-neighbour upscale of those same pixels.

### 2.1 Concept lock (R1)

- **Silhouette:** a **shouldered wedge** — a helmeted head over a short neck
  step, a hard shoulder **ledge** (out almost level, then a long vertical
  pauldron edge), a torso that sheds ~1.7× of its width within half a radius,
  and a stance carried by two long dark legs rather than by the hull's own
  base. Nothing in the nine-foe cast has a shoulder ledge; nothing else on the
  board has legs of this length.
- **Value:** the hull is **mid-value gunmetal `#8d97ac`** (Rec.709 L 0.59),
  down from P1's `#dfe7f2` (L 0.90). **Brightness was the cuteness.** A mid
  value also separates *better* from walker's mint `#8affc1`, and it leaves
  the white visor pip as the one genuinely bright element on the character.
  Floor: the hull must stay in **L 0.28–0.62** — dark enough not to read as a
  toy, light enough to hold against the dark biome floors, where the 3D hull
  (which has no dark contour) is the binding case, not the 2D one.
- **Shape language:** hard armour facets. Angular pauldron plates, a straight
  visor slit, a pointed crest — no soft sheen ellipse anywhere on the body.
- **`p.color` placement: the crest, and only the crest.** A **crest, not a
  cap**: pointed, and in 2D every vertex stays *inside* the helmet contour.
  R1 iteration 1 let the crest wings overhang and the horizontal underside
  instantly became a peaked-cap brim — the exact silliness the rejection
  named. Do not reintroduce an overhang.
- **Facing cue:** unchanged — yaw only in 3D (`atan2(face.x, face.y)`); in 2D
  the visor cluster slides on `face.x` and is replaced by a nape plate when
  `face.y < -0.5`.
- **Authority:** the hero must be the most **capable-looking** body on the
  board. The measurable form of that is §2.5's two 3D gates; the P1 stack
  failed both, at a 12.1 half-span against walker's 13.6 collision radius.

### 2.2 2D — `drawPlayerBody` five-beat (R1)

`r = CFG.TILE * 0.36` (unchanged). Silhouette, `poly()` in `r`-units:

```
S_RUNNER = [[-0.36,-1.00],[0.36,-1.00],[0.52,-0.80],[0.44,-0.54],
            [0.34,-0.46],[0.86,-0.40],[0.90,-0.06],[0.68,0.12],
            [0.56,0.32],[0.50,0.54],[-0.50,0.54],[-0.56,0.32],
            [-0.68,0.12],[-0.90,-0.06],[-0.86,-0.40],[-0.34,-0.46],
            [-0.44,-0.54],[-0.52,-0.80]]
CREST    = [[0,-1.09],[0.32,-0.96],[0.48,-0.80],[0.44,-0.70],
            [-0.44,-0.70],[-0.48,-0.80],[-0.32,-0.96]]
```

Numbers to hit: helmet half-width `0.52r`, shoulder half-width `0.90r`
(**1.73× the helmet** — the heroic ratio that is actually buildable at this
size), waist `0.50r`. The `(0.34,-0.46)` pair is a **neck step**: two pixels
of notch at 28px, and it is what stops the shoulders reading as if they
sprout from the ears. Hull height `1.54r`; legs add `0.52r` below it.

Beats, in paint order:

1. **contact shade** — `ellipse(0, r*1.00, r*0.60, r*0.18)`, `rgba(0,0,0,0.34)`.
   Narrower than P1's, to sit under a narrower stance.
2. **dark contour** — `S_RUNNER` at `k = 1`, `dk(HULL, 0.56)`, sealed `RIM`.
3. **inset lit body** — `S_RUNNER` at `k = 0.8`, lifted `-r*0.09`, `HULL`.
4. **armour facets** — the two pauldron **top plates**, `lt(HULL, 0.42)`,
   two subpaths in one `beginPath` so this is still one beat. These draw the
   shoulder ledge, which is the single strongest maturity cue at this size.
   P1's rotated sheen ellipse is gone; the zero-arc rule now holds absolutely
   for the body (the contact shade is the only `ellipse`).
5. **face** — `CREST` filled `col = p.color` and sealed (**the one and only
   `p.color` fill in the body**), then the visor: a `#0b1020` slot across
   `y ∈ [-0.68,-0.48]`, a `#7fe0ff` **hairline** core inside it, and one
   white specular pip — all quads, no `arc`. The core bar is deliberately
   thin: against a mid-value hull a fat cyan band becomes a second bright
   element and reads as a cartoon eye. Cluster shifts by
   `fx = clamp(p.face.x,-1,1) * r * 0.10`.
6. **grounding** — two **leg** contours (hip `y=0.42` to toe `y=1.06`, with
   an outward toe flick), `#0d3f78`, flipping to `#c07a3a` under `p.kick`.
   P1's `0.06r` boot chips glued to the egg's underside are gone.
7. **back pose** — `p.face.y < -0.5` swaps the visor cluster for a
   `dk(HULL,0.34)` nape bar and a `dk(HULL,0.62)` pack chip.

`p.shield` ring, `p.kick` cleats, `p.passing` ring, the iFrames flicker and
the walk/idle bob are unchanged.

### 2.3 3D — the 5-mesh stack (R1)

`SLOT_MESH.player` stays **5** and the geometry-type histogram is unchanged
(1 `BufferGeometry`, 1 `LatheGeometry`, 1 `ExtrudeGeometry`, 2 `BoxGeometry`)
— **every mesh was reshaped, none added, none retyped.**

| idx | mesh | geometry | `.type` | material | shadow |
|---|---|---|---|---|---|
| 0 | `hull` | `mergeGeos(torso, pauldronL, pauldronR)` | `BufferGeometry` | `hullMat` Lambert `PLAYER_HULL` | cast + receive |
| 1 | `crown` | `lathe(CROWN_P, 5, TILE*0.17).rotateY(PI/5)`, `y = TILE*0.54` | `LatheGeometry` | `crownMat` Lambert, `p.color` | cast |
| 2 | `visor` | `plate(VISOR_P, 0.14, TILE*0.19).rotateX(-0.6)`, `y = TILE*0.60`, `z = TILE*0.145` | `ExtrudeGeometry` | `visorMat` Phong `#0b1020`, `shininess 120`, `specular #ffffff`, `map: atlas.visor` when present | none |
| 3 | `bootL` | `BoxGeometry(TILE*0.15, TILE*0.26, TILE*0.26)` at `(-TILE*0.13, TILE*0.13, 0)` | `BoxGeometry` | `bootMat` Lambert | cast |
| 4 | `bootR` | same geometry at `(+TILE*0.13, ...)` | `BoxGeometry` | same | cast |

```
TORSO_P  = [[0.44,0.50],[0.38,0.88],[0.52,1.20],[0.86,1.44],
            [0.66,1.60],[0.42,1.74],[0.44,1.86]]   lathe(...,6, TILE*0.30)
CROWN_P  = [[0.60,0],[0.92,0.18],[1.00,0.42],[0.90,0.74],[0.56,1.02],[0,1.24]]
PAULD_P  = [[-0.46,-0.46],[0.52,-0.26],[0.52,0.26],[-0.46,0.46]]
           plate(pauldPts(s), 0.42, TILE*0.30).rotateX(-PI/2)
           .rotateZ(-s*0.34).translate(s*TILE*0.23, TILE*0.42, 0)
VISOR_P  = [[-0.52,-0.30],[0.52,-0.30],[0.42,0.26],[-0.42,0.26]]
```

Both profiles still run **bottom → top** and each still flares once then
narrows (`TORSO_P` at `1.44` is the shoulder line, `CROWN_P` at `0.42` the
brow), so one Lambert hull keeps its two-tone read.

**Three decisions that cost iterations and must not be undone:**

1. **The pauldron is a wedge, and it is mirrored by reversing its points.**
   A plate symmetric in `x` presents one big flat facet to the 59.1° rig and
   the pair reads as a **coat hanger** — an even slab has no inboard end to
   bury in the torso. `PAULD_P` is authored for the right shoulder (outer
   edge at `+x`), deep where it meets the ribs and shallow at the tip;
   `pauldPts(-1)` negates `x` **and reverses the order**, because
   `ExtrudeGeometry` takes its cap normals from the shape's signed area —
   the same trap `mesa()` documents. The `-s*0.34` cant drops the outer edge
   so the plate reads as armour rather than as a table.
2. **The crown is seg 5, turned a fifth.** three.js lathes start a *vertex*
   at `+Z`, so `rotateY(PI/5)` puts a flat **face** forward for the visor to
   sit on; a corner at `+Z` leaves the visor's ends floating off a ridge.
   Seg 4 (iteration 1) gives a square plan whose top facet reads as a **box**;
   seg 6 is a circle at this size. A pentagon has no parallel silhouette
   edges and its plan view is shared with no foe.
3. **The head must be far narrower than the shoulders.** Iteration 2 gave the
   crown the torso's own radius and the helmet simply *hid the chest* — the
   hero became a teal pentagon on a stand. Locked ratio: head plan width
   **12.9** against a **31.8** shoulder span (41%).

Derived numbers to hit (TILE 40): shoulder span **31.8**, plan depth **20.6**
(**aspect 1.54**), stack height **30.0**, head width **12.9**, leg height
**10.4**. Walker for comparison: `29.0 × 26.5 × 27.5`. The hero is now the
tallest and the widest body on the board and the only **shouldered** footprint
on it; P1 was neither.

`paintVisor` (`textures.js`) is **unchanged** — deep well, one thin lit core
bar, one white pip is already exactly the R1 visor, and the 2D core bar was
thinned to match it rather than the other way round.

### 2.4 State mapping — unchanged from P1

| state | mapping |
|---|---|
| `p.color` | `crownMat.color` (the only placement) |
| `p.shield` | `crownMat.emissive #6fb7ff` pulse + `visorMat.color` lerp |
| `p.kick` | `bootMat.color` `#c07a3a` / `#0d3f78` |
| `p.passing` | `hullMat.color` base `PLAYER_HULL`, lerp toward `#77ff99` 0.38 |
| iFrames flicker, `player.visible`, yaw, walk/idle bob | unchanged |

**One hull hex, one place.** `PLAYER_HULL` is exported from
`src/render/sprites.js` and imported by `src/render/three/entities.js`
(`sprites.js` pulls in `icons.js` / `config.js` / `enemybody.js` only, so the
module graph stays a DAG). P1 carried the literal twice and a future revision
would have moved one of them.

### 2.5 The five gates R1 adds

Three in `tests/items-art.test.mjs`, two in `tests/three.test.mjs`. All five
**fail on the P1 body** — that is the point of them.

| gate | P1 | R1 |
|---|---|---|
| hull sheds `>= 1.55×` its width `0.50r` below the shoulder line | **1.06** | 1.71 |
| `lum(PLAYER_HULL)` within `0.28 .. 0.62` — **retired by §2.6**, replaced by the per-biome separation gates | **0.90** | 0.59 |
| legs run `>= 0.50r` below the hull contour | **0.06** | 0.52 |
| 3D shoulder half-span `>= CFG.TILE*0.34` (its own collision radius) | **12.08** | 15.92 |
| 3D plan footprint `x/z >= 1.40` (shouldered, not a disc) | **1.36** | 1.54 |

The first is a **horizontal slice** of the recorded beat-2 contour, because a
fit box and an op stream structurally cannot tell a tapered torso from a
barrel — which is exactly how the egg shipped.

### 2.6 2D divergence — 2026-09-06, on user feedback

> **REVISION IONVEST — 2D ONLY.** The R1 2D body was **rejected by the user**:
> *"in the 2D the main charecter is terrible look"*, against a FACTORY room
> screenshot. The user **explicitly allowed 2D and 3D to look different**, so
> this is the point where the two renderers' palettes split. The 3D SIGNAL
> RUNNER of §2.3 is **untouched** and remains the spec for the 3D hero.

**Two measured defects, both fixed; R1's shape work otherwise kept.**

*Colour.* R1's `PLAYER_HULL` `#8d97ac` against FACTORY's `wall` `#8a96a4` is
`ΔL=0.008` and `Δhue=8.3°` — value **and** hue collapse on the **same**
swatch, so the dark-contour beat and the lit-body beat both land on the wall's
own value and a 2px 55%-alpha seal is left doing all the separation work at
29px. That is the blob. The 2D suit is now a **hued** `PLAYER_SUIT`
`#cd5ac3` orchid (L .479, chroma .451, hue 305°). 3D keeps gunmetal: it has no
dark contour, value alone separates it there, and it was not what was
rejected. **`PLAYER_HULL` keeps its value and its export** — `three/entities.js`
is unchanged.

*Proportion.* R1's figure was **29% head** (~3.4 heads) — adult proportions on
a 29px sprite, which is the other half of "blob": there were never enough
pixels for a face. The shoulder-ledge seam rises `-0.46r → -0.20r`, giving a
**41.4% head** (~2.4 heads), the small-sprite convention. Waist (`0.54r`) and
boot span (`0.42r..1.06r`) are unchanged; the pauldron facets and the visor
cluster move up with the seam and grow into the room.

*Added:* one swept **FIN** off the crest's rear-left flank — five vertices,
still zero-arc, still no brim — as the silhouette hook. `p.color` stays on the
**crest alone** (one-placement rule intact).

**Moved pins.** R1's `lum(PLAYER_HULL) ∈ [0.28,0.62]` is **retired**: a band on
one hex cannot see the backdrop, and it stayed green on the rejected build. It
is replaced by four gates in `tests/items-art.test.mjs`:

| gate | R1 body | IONVEST |
|---|---|---|
| no biome swatch collapses on **both** value and hue (`ΔL<0.12 ⟹ Δhue≥25°`), all 8 biomes × `{floor0,floor1,wall,brickA,brickB}` | **FAIL** — FACTORY.wall .008/8.3°, ICE.floor1 .021/16.6°, ICE.floor0 .095/16.2° | worst Δhue **41.1°** (ARENA.brickA) |
| suit chroma (normalised channel spread) `>= 0.35` | **0.122** | 0.451 |
| head module is 38–50% of the figure | **0.293** | 0.414 |
| contour band `>= 0.12` darker than the suit, and sealed | 0.332 | 0.270 |
| `PLAYER_HULL` stays the 3D gunmetal, `PLAYER_SUIT` is 2D-only | **FAIL** (one hex) | pinned |

**Deviation from the direction authority, recorded deliberately.**
`research-2d-hero.md` §5 gate 1 asks for `min ΔL >= 0.12` over all 40 swatches.
**That is not satisfiable by any hex** — the 40 swatches cover the value axis
densely enough that every colour is within 0.12 of one of them. The research's
own worst-case figure for its recommended `#b83fc0` (`floor ΔL=0.254`) is
ARENA `floor0`, not the minimum; the true minimum is JUNGLE `floor0` `#1a7a30`
at `ΔL=0.007`. The research's gate 2 names the real failure condition — both
axes collapsing on the **same** swatch — so **the AND is what ships**, and
gate 1 is folded into it rather than asserted standalone. A **chroma floor**
is added because it is what makes the hue axis mean anything: two *near-neutral*
colours at the same value are the same colour however far apart their nominal
hue angles sit, and that — not hue distance alone — is why gunmetal-on-gray
failed.

**Luminance formula.** All numbers here are **Rec.709** (`items-art.test.mjs`'s
own `lum`). The research tabulates Rec.601. The two agree on gunmetal (0.590
either way — it is near-neutral, so it could not discriminate between the
formulas) and diverge on a saturated suit. One formula per repo.

**Value chosen from rendered rooms, not from the table.** The research's
`#b83fc0` (L .384) shipped in capture iteration 1 and read *weakly in VOID*,
where `brickA` `#6a20c8` sat **32.0 Lab ΔE** away — the tightest pair in the
game. Lifting the same hue family to L .479 puts the worst pair at **44.6 ΔE**
and is the only value in the family that also clears **both** bright floors
(ICE .671, SAND .608) on value alone rather than on hue. ΔE was the
*selection* method; the shipped gate remains the ΔL/Δhue AND.

**Legal distance** is unchanged and if anything larger: hard-edged helmet,
crest, fin and lensed visor — non-round, non-white, no pompom, no centred
cartoon face.

---

## §3 ABI renegotiation

Every pin this program touches, its site, and its new value. Fat-world
`5 + SLOT_MESH.player + 16*4 + 8*5 + 12*2 + 2 + 1` = **`5+5+64+40+24+2+1`
= 141**, well inside the `<=500` gate.

| Pin | Site | Today | New | Kind |
|---|---|---|---|---|
| `SLOT_MESH.player` | `src/render/three/entities.js:49` | `7` | **`5`** | source |
| S4.A `SLOT_MESH` assert | `tests/three.test.mjs:1000-1004` | `player===7` | `player===5` | test |
| S4.A geometry histogram | `tests/three.test.mjs:1009-1015` | len 7, no Capsule, `>=3` Sphere, `>=2` Cylinder, `===2` Box | len 5, no Capsule, **0 Sphere, 0 Cylinder**, `===2` Box, `===1` BufferGeometry, `===1` LatheGeometry, `===1` ExtrudeGeometry | test |
| S4.A hemisphere-dome probe | `tests/three.test.mjs:1017-1019` | `thetaLength===Math.PI/2` | **deleted.** Replaced: crown is `LatheGeometry` with `>=6` profile points whose max radius is at neither end (flare-then-narrow) | test |
| S4.A visor-band probe | `tests/three.test.mjs:1020-1025` | open Cylinder, `thetaLength≈PI*1.1`, `y>TILE*0.3` | **deleted.** Replaced: the visor is the player's only `MeshPhongMaterial`, `shininess>=90`, `-0.62 <= rotation.x <= -0.58`, `position.y > TILE*0.5`; the hull material is Lambert | test |
| fat-world, **formula-derived** | `tests/three.test.mjs:1400-1406` | `wantCalls===143` | `wantCalls===141` | test |
| fat-world, **formula-derived** | `tests/pickup-3d.test.mjs:209-221` | `want===143` | `want===141` | test |
| fat-world, **bare literal** | `tests/three.test.mjs:1662-1664` | `calls===143` | `calls===141` | test — does **not** move with `SLOT_MESH`; hand edit or it goes red |
| fat-world, **bare literal** | `tests/enemies-art.test.mjs:461-462` | `calls===143` | `calls===141` | test — the **only** line this suite may take in the whole program |
| `fire` body geo type | `tests/three.test.mjs:752-762` | `"ConeGeometry"` | `"LatheGeometry"` (color `#ff8a3c` and both ring asserts unchanged) | test |
| `fire` not a leftover cube | `tests/pickup-3d.test.mjs:276-283` | `!== "BoxGeometry"` | **kept as-is** — `LatheGeometry` passes; the guard stays meaningful | test |
| 12 unique geo `uuid`s | `tests/pickup-3d.test.mjs:268-283` | 12 | **kept** — the new 12 are still pairwise unique | test |
| item draws `=== 24` | `three.test.mjs:421-426, 600-603`; `pickup-3d.test.mjs:231-235` | 24 | **kept** | test |
| `ITEM_MAKE` source grep | `tests/pickup-3d.test.mjs:314-330` | table named `ITEM_MAKE` | **kept — do not rename the table** | test |
| `item_<t>` atlas keys | `three.test.mjs:648-652, 704-711` | exist, applied nowhere | **kept, still applied nowhere** | test |
| `SLOT_MESH.item / .enemy / .bomb` | `entities.js:49` | `2 / 4 / 5` | **unchanged** | source |
| `POWER` ids, order, hexes, `apply` | `tests/pickups.test.mjs:52-95` | — | **byte-identical**; that suite takes **zero edits** | test |
| `drawIcon` distinct / `>=3` ops / no `fillText`; `paintItemFace` distinct / `>=4` ops | `tests/pickups.test.mjs:380-427` | pass | **still pass, zero edits** — the five-beat only adds ops | test |
| `stampBombIcon` fill `#ff5d73` | `touch.test.mjs:164-177` | pass | **zero edits** | test |
| `r3d.test.mjs` tier counters | invocation counts | pass | **zero edits** | test |
| `media.test.mjs` dimensions | 1200×630, 630×500, file list | pass | **zero edits** — files are recaptured in place | test |
| AGENTS.md fat-world | `AGENTS.md:83, 164, 203` | `143` | **`141`** | durable memory |
| AGENTS.md specular claim | `AGENTS.md:206` | "`knight` is the only bright-specular Phong body" | amend to "…the only bright-specular Phong **foe**; the player visor is the cast's one other Phong surface" | durable memory |
| AGENTS.md player line | `AGENTS.md` (new bullet beside the enemy-bodies bullet) | — | add: player is a 5-mesh stack — merged matte hull + `p.color` crown lathe + one Phong visor raked `-0.6` + two boots; no antenna, no sphere | durable memory |
| PWA `CACHE_NAME` / `REV` | `src/pwa/shell.js:1`, `sw.js:3` | `fusegrid-shell-v31` | one bump per landed plan (v32…v35, v36 only if P5 changes source) | source pair |

Nothing else in `three.test.mjs` moves. The `itemDraws` / `visOf` /
`slotsOf` / `itemLive` helpers (`three.test.mjs:43-49`) traverse by
`userData.tag`, so shape swaps are invisible to them — the tag/kind scheme
must therefore stay exactly as it is.

### §3.R1 — pins the 2026-09-05 R1 player revision moves

Everything in the table above stays as P4 left it: `SLOT_MESH.player` is
still 5, fat-world is still 141, and the geometry-type histogram is untouched
because R1 **reshaped profiles and retyped nothing**.

| Pin | Site | P1 | R1 | Kind |
|---|---|---|---|---|
| hull hex | `sprites.js` `PLAYER_HULL` (now **exported**, imported by `three/entities.js`) | `#dfe7f2` | **`#8d97ac`** | source |
| R.headless hull probe | `tests/three.test.mjs` | `#dfe7f2` | **`#8d97ac`** | test |
| S4.A `p.passing` base probe | `tests/three.test.mjs` | `!== "#dfe7f2"` | **`!== "#8d97ac"`** | test |
| taper / value / stance gates | `tests/items-art.test.mjs` | — | **3 new gates**, all RED on P1 (§2.5) | test |
| shoulder half-span / plan aspect | `tests/three.test.mjs` S4.A | — | **2 new gates**, both RED on P1 (§2.5) | test |
| `paintVisor` | `textures.js` | — | **byte-identical**; the 2D core bar was thinned to match *it* | source |

---

## §4 Tests

New file `tests/items-art.test.mjs`, built on the recording-canvas stub
pattern from `tests/enemies-art.test.mjs`. Its stub records `fillStyle` /
`strokeStyle` assignments **with their values** (not just op names) — several
gates below read colors, and the `pickups.test.mjs` stub records op names
only.

**Items, 2D**

1. All 12 `drawIcon` op streams pairwise distinct, each `>= 3` paints
   (existing floor) **and `>= 4` distinct `fillStyle` values** — proves the
   five-beat value stack landed and a flat re-skin did not.
2. Every glyph seals: a `strokeStyle` write of `RIM` followed by `stroke`.
3. Value order: the first `fillStyle` value a glyph writes is not the raw
   `col` passed in — proves the dark form precedes the lit body.
4. Chip fit: at `s = CFG.TILE*0.3`, no op coordinate outside `±1.20*s` on
   either axis.
5. Outline budget: `<= 14` vertices per glyph outline, `<= 4` accent paint
   ops, every accent writes at least one `fillStyle`, no stroke thinner than
   `s * 0.12` (P1.5 numbers — see §1.7 for why they moved).
5b. **Per-kind outline pins.** Vertex count plus the rounded outline bbox
   (`w`, `h` in `s`-units) pinned per kind, so a future "harmless re-skin"
   cannot silently undo the semantic pass the way a distinctness-only gate
   would allow. Plus a **mass-separation** gate over the three closest pairs
   of §1.6: `pass`/`pierce`, `bomb`/`throw` and `line`/`pierce` must each
   differ in outline aspect ratio by a real margin, which is the machine-
   checkable half of "they separate at mass level".
6. `ITEM_FAMILY` covers all 12 `POWER.t`, has exactly 4 distinct values, and
   its `"cap"` set is exactly the `permanent === true` set.
7. `drawItemBody` family chrome: four distinct ring signatures across
   families; kinds inside one family share a chrome signature; the base disc
   is present for all 12.
8. Idle echo is live and grid-phased: `world.time 0` vs `0.5` differ for
   every kind; two items of the same kind at the same `(x,y)` are identical;
   the same kind at different `(x,y)` differs at a fixed `t`.

**Player, 2D**

9. Five beats present: contact `ellipse`, a `RIM` `stroke`, `>= 4` distinct
   `fillStyle`, a `#0b1020` visor slot, a `#7fe0ff` core, a white pip.
10. One-placement rule: `p.color` appears **exactly once** as a `fillStyle`
    in the whole body.
11. **Toy tells gone — the zero-arc rule.** With `p.shield` and `p.passing`
    both false, `drawPlayerBody` emits **zero `arc` ops** and writes no
    `#ff5d73` fill. Today it emits five arcs (two eyes, two pupils, the
    antenna ball) and one `#ff5d73`. The contact shade is an `ellipse`, the
    visor core is a rect, the specular pip is a quad, so nothing legitimate
    needs an `arc`. The two status rings are the only arcs the function may
    ever draw.
12. Facing: `face {x:0,y:-1}` differs from `{x:0,y:1}` (back pose);
    `face.x = ±1` shifts the visor cluster; `p.kick` flips the boot fill.
13. Fit: at `r = CFG.TILE*0.36`, nothing paints outside `±1.05r`
    horizontally / `±1.10r` vertically.
14. No `fillText` in `drawIcon` or `drawPlayerBody`.

**Art-only proof**

15. Seed-42 L1 roster plus a fixed 180-step PLAY loop produce an unchanged
    fingerprint — the same gate `enemies-art.test.mjs` uses to prove the foe
    pass never touched AI.
16. `POWER` catalog fingerprint (ids, order, hexes, `permanent`) unchanged.

**3D, in `tests/pickup-3d.test.mjs`**

17. **Plan-view anti-collapse gate.** For each kind, project every vertex to
    XZ, take the bbox extents `w`/`d` and `maxR`. The 12 pairs
    `(Math.round(w/d*10)/10, Math.round(maxR))` must be **pairwise
    distinct**. Today's build fails this (`bomb` and `shield` both land on
    `(1.0, 9)`). If two collide, adjust the smaller kind's `r` by
    `±0.01*CFG.TILE` — never by re-huing.
18. Build split: `fire` / `bomb` / `speed` / `shield` are `LatheGeometry`;
    the other eight are `BufferGeometry`; 12 uuids still unique.
19. Ring geometry count: exactly **4** distinct ring geometries across the
    12 ring InstancedMeshes, and all 12 rings are additive with
    `depthWrite === false` and `castShadow === false`.
20. Fat-world `=== 141` (formula), `<= 500`.

**3D, in `tests/three.test.mjs`**

21. S4.A rewritten per §3 (count, histogram, crown flare probe, visor
    Phong + rake probe, hull Lambert probe).
22. `fire` body geometry type is `LatheGeometry`; material color, `map`
    absence, and the ring asserts stay.
23. `crownMat.color` follows `p.color`; the player has **exactly one**
    `MeshPhongMaterial` child and **zero** additive-blended children.
24. Fat-world formula `=== 141` and the bare literal at 1662-1664 `=== 141`.

**Must stay green with zero edits:** `pickups.test.mjs`,
`menudraw.test.mjs`, `touch.test.mjs`, `r3d.test.mjs`, `media.test.mjs`,
and `enemies-art.test.mjs` apart from its single 143→141 literal in P4.

---

## §5 Headed screenshot critique — mandatory

Node cannot render pixels; a green battery is not evidence this pass
landed. The 2026-09-04 record already contains one "mature silhouettes"
commit that never actually changed the picture. Every plan ends with this
loop, and P5 runs it across the whole surface.

**Before any capture:** unregister the service worker and delete its caches.
A stale SW serves pre-change bytes and is indistinguishable from a render
change that did not land.

**Capture set:** CLASSIC 2D board and REAL 3D board of the same seeded
JUNGLE room 1 with at least one pickup from each family plus the player and
a WALKER in frame; REAL 3D room 7 (VOID) for the dark-albedo check; the
ITEMS menu at its 16px well; HOW TO; the in-arena HUD chips; the touch bomb
pad.

**Loop:** implement → capture → review against the checklist below, writing
a pass/fail per line → fix → recapture. Do not declare done while any line
fails.

1. From the frozen rig at two tiles' distance, no two of the 12 pickups
   share a plan-view outline.
2. Every pickup reads as hovering — a visible gap and a separate cast
   shadow — not as a decal painted on the floor. The flat families are the
   risk here.
3. Family is readable from the ring alone: hairline / double / dashed /
   spiked.
4. The four idle rhythms are distinguishable when two families sit side by
   side.
5. **The player is not mistaken for WALKER at two tiles.** The named
   collision; if it fails, the fix is shape and value structure, never hue.
6. The crown carries `p.color` and nothing else on the player does.
7. Exactly one specular highlight on the player (the visor). The hull reads
   matte.
8. No antenna, no ball, no round double eyes, in either renderer, anywhere,
   including the ENEMIES/ITEMS plates and the attract loop.
9. Walking up-screen shows the nape, not the visor, in CLASSIC 2D.
10. Items stay legible in VOID with no per-biome table. If they die there,
    that is a finding for this loop, not a pre-locked emissive value.
11. ITEMS well at 16px and HUD chips at 14px: all 12 glyphs still separable.
12. The touch bomb pad still reads as BOMB.
13. Both renderers agree on the story: the notch/point/tier count a kind
    shows in 2D is the count it shows in 3D — **except** for the two
    carve-outs §1.6 names (`bomb`'s 2D orb vs its 3D 4-gon lathe, and the
    five 2D-only accents). Those are reviewed as "same story, different
    medium", not as "same outline".
14. **(P1.5 — the line the user actually applied, and the one that governs.)**
    At the ITEMS chip, and again at the HUD chip, **name the object** in each
    glyph in one second without reading its label. Twelve for twelve, or the
    pass is not done. "Distinct from its neighbours" is not a passing answer.

**Media recapture (P5, after the loop passes).** The 3D look ships again, so
every committed still is stale. Re-run the live capture
(`e2e-artifacts/capture/card.js`) for `og.png` (1200×630),
`media/cover-630x500.png` (630×500), `media/still-jungle.png`,
`still-ice.png`, `still-crown.png`, `still-menu.png`, and `media/play.gif`.
Dimensions are pinned by `tests/media.test.mjs` — recapture in place, never
crop from another asset. Hero stays a REAL screenshot of the live 3D board,
never generated key art. `og:image` stays the absolute Pages URL, `og.png`
stays out of the precache, and the Social-preview upload in repo Settings is
manual (no API).

---

## §6 Ship order

Five independently landable plans. Each ends with the §5 loop scoped to its
surface, each bumps `CACHE_NAME` + `sw.js` `REV` together by one, and each
appends a dated `MEMORY.md` line.

| # | Plan | Scope | Depends on |
|---|---|---|---|
| **P1** | `2026-09-05-item-glyphs` | `icons.js` becomes the shared craft module (move `tone`/`dk`/`lt`/`poly`/`oval`/`seal` in from `enemybody.js`, add `ITEM_FAMILY`); rebuild all 12 glyphs on the five-beat; `drawItemBody` family chrome + 2D idle echo. Propagates free to ITEMS / HOW TO / HUD / touch / iso. New `tests/items-art.test.mjs` (§4.1-8). PWA v32. | — |
| **P2** | `2026-09-05-item-3d` | Rebuild `ITEM_MAKE`'s twelve bodies per §1.6; four family ring geos + `RING_SCALE`; family idle motion + grid phase in `update()`. Test deltas §4.17-20 plus the `fire` geo type in `three.test.mjs`. PWA v33. | P1 (`ITEM_FAMILY`) |
| **P3** | `2026-09-05-player-2d` | `drawPlayerBody` rebuilt on the five beats: kite silhouette, crown band, visor slit, boots, back pose. Antenna and round eyes deleted. Adds §4.9-14 to `items-art.test.mjs`. PWA v34. | P1 (shared helpers) |
| **P4** | `2026-09-05-player-3d` | The 5-mesh stack; `SLOT_MESH.player` 7→5; `paintVisor` repaint; **all four** fat-world sites 143→141 (two formula, two literal); S4.A rewritten; the three AGENTS.md edits. PWA v35. | P3 (silhouette authored in 2D first, then translated — the enemy-pass order) |
| **P5** | `2026-09-05-art-media` | Full §5 loop across both renderers and every screen; fixes arising from it; recapture `og.png`, cover, four stills, gif; Social-preview upload note. PWA v36 only if source bytes change. | P1–P4 |

P1 and P3 are 2D-only and can land while P2 is in flight; P2 and P4 are the
only plans that touch `src/render/three/`.

## Out of scope

Mid-run heat, Sudden Death, internet play, new item kinds or powers, a
rarity color ramp, per-biome item or player variants, textured 3D pickups
(`atlas.item_<t>` stays dormant), a third item mesh, an eighth player mesh,
`CapsuleGeometry` in any form, new AI, retuned speeds or radii, image
assets, npm dependencies, and any edit to `src/core`.
