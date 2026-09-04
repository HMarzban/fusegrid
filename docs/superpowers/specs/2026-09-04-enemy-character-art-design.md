# Enemy character art (2026-09-04)

Third pass on the nine foes. The 2026-09-04 "mature enemies" pass claimed
readable silhouettes; on the board the 2D bodies still read as **stickers** —
a flat disc of `e.color` with a dark `fillRect` visor stamped on. This pass
rebuilds them as characters. Art only: no AI, no rosters, no speeds.

Public name Fusegrid / FUSE/GRID.

## Why the old bodies read as tokens

Five concrete defects, all visible in a CLASSIC 2D room-2 screenshot:

1. **One value.** Each body is a single flat fill of `e.color`. No shadow
   side, no lit top, so there is no volume — a colored decal.
2. **No ground contact.** Only `drawPlayerBody` lays a shadow ellipse.
   Enemies had none, so they float above the floor tiles like decals. This is
   the single loudest "sticker" tell.
3. **The face is a UI element.** A `fillRect` band with a translucent stripe
   inside is a nameplate, not a face. No socket, no iris, no specular, so the
   eye has no focal point.
4. **One silhouette family.** `walker` / `chaser` / `fast` all fall out of the
   same `else` branch: circle plus `c.scale()`. Only the aspect ratio differs,
   so at tile size they are three colored circles.
5. **No front or back.** `e.dir` was never read. A body that never turns
   toward its travel reads as an object, not a creature.

## Approaches

1. **Body + face with stacked-value shading and a contact shade (pick).**
   One shared pipeline every foe runs through — ground shade, dark
   silhouette pass, inset body pass, upper-left rim pass, sculpted eye — plus
   a per-foe contour function that is the only thing that varies. Nine
   genuinely different outlines; shading and eye craft are shared, so
   per-foe code stays short and the family stays coherent.

2. **Four-pose directional silhouettes.** Read `e.dir`, pick front / back /
   left / right art per foe. Strongest facing read, but nine foes × four
   poses is 36 bodies in one file, the ENEMIES dummy has no `dir` so the
   field guide would freeze one pose, and at ~28px a profile barely differs
   from a front view. Rejected as primary; the cheap half is stolen — see
   Facing below.

3. **Two-frame idle animation.** Keep the shapes, add squash and a walk
   cycle. Does not address the complaint: a bobbing flat circle is still a
   flat circle, and `drawEnemies` already bobs. Rejected as primary; kept as
   garnish (walker boot stomp, sentry breathe, fast hover shimmer).

**Pick 1**, with the cheap facing trick from 2 and the existing bob from 3.

### Why it reads at tile size

A tile is 40px and a foe is `r ~ 13.6`, so a character owns roughly 28px.
That budget cannot be spent on hue detail, so it is spent on three things:

- **Contour first.** Distinguishing nine foes at a glance without reading
  color means nine different outer shapes. Aspect-ratio variants of one
  circle do not survive the downscale; a bell, a trapezoid, a delta, and a
  ragged hood do.
- **Value over hue.** Two hues at the same lightness merge into mud when
  small. A three-step value ramp (dark rim, base, lit cap) survives, and it
  is built by stacking opaque shapes rather than gradients.
- **One high-contrast eye.** A dark socket with a bright iris and a white
  specular is the most legible facial feature available at 3-4px, and it is
  what makes the shape read as alive instead of as furniture.

### Shading without `clip` or gradients

The Node stub context in `tests/enemies-art.test.mjs` and the headless
fallback in `renderer.js` implement neither `clip()` nor a usable
`createLinearGradient`. Shading is therefore built the pixel-art way, from
stacked opaque fills: the contour is drawn three times through one `shell`
helper — full size in `dk(col)`, inset and lifted in `col`, small and pushed
up-left in `lt(col)`. The leftover dark crescent at lower-right is the form
shadow; the offset light matches the frozen 3D warm key, so 2D and REAL 3D
agree on where the light comes from.

Values come from the identity color itself (`dk` / `lt` lerp toward black and
white), so palettes stay the single source of truth in `spawnEnemy`.

### Facing

`const d = e.dir || {x:0,y:1}`. Bodies stay upright — top-down cabinet art
does not rotate a head. Instead:

- The face cluster shifts along `d.x` for a three-quarter turn.
- When `d.y < -0.5` (walking up-screen, away from the player) the head-bearing
  foes hide the eye and show a nape or backpack instead. That is a real
  front/back read and it is structural, so a test can see it.

Facing applies to `walker`, `chaser`, `fast`, `burrow`, `knight`. `stationary`
is bolted down and always front. `boomerang` spins. `rocket` and `shade` are
not heads.

No `c.scale()` anywhere in a body: the contour bakes its own `k`, so bounds
are exact and the field-guide fit is testable.

## Per-foe

Silhouette, palette, face, and what makes it read at 40px.

| `t` | Name | Before | After |
|---|---|---|---|
| `walker` | WALKER | mint circle, visor bar, two boot rects | **Domed grunt.** Bell hood with a brow ridge, shoulder plates, two boots that stomp on the bob, backpack when turned away. Mint `#8affc1` over its own dark. One big eye under a heavy brow. Reads because the dome plus stomping boots says "infantry that plods". |
| `stationary` | SENTRY | rounded purple square, dash slit | **Bunker turret.** Trapezoid pillbox, wider at the base, rivets, hexagonal lens head, no legs at all. Magenta `#c58aff`. Pulsing iris in the lens. Reads because a wide planted base with nothing to walk on says "bolted down". |
| `fast` | FAST | wide yellow lozenge, two dots, streaks | **Swept hover wedge.** Delta nose down-screen, fins swept back and out, hover shimmer under it, three trailing streaks. Gold `#ffd447`. Narrow slit eye. Reads because a pointed swept contour is the only foe with no curves — it looks aimed. |
| `chaser` | CHASER | tall blue oval, triangle antenna, visor | **Leaning hunter.** Forward-leaning teardrop hull with a dorsal crest along the back, skids, hunched shoulder line. Cyan `#66c8ff`. Big tracking eye under a down-angled brow. Reads because the lean and the angry brow both point at you. |
| `boomerang` | PHANTOM | rotating pink C-stroke, dark bead | **Spinning cloak ring.** Open C-ring with a torn hem, translucent so the floor shows through, spinning at `t*10`; the hollow socket eye in the middle does not spin. Pink `#ff9dd6`. Reads because it is the only foe you can see through — which is exactly what "phases bricks" means. |
| `rocket` | ROCKET | orange triangle, pad, flicker dot | **Warhead.** Ogive nose, banded body tube, swept tail fins, two-tone exhaust with a hot core. Orange `#ff7a59`. Single sensor eye in the nose band. Reads because a tall pointed tube with a flame is unmistakable ordnance. |
| `burrow` | BURROW | brown ellipse, bands, mandible triangles | **Segmented grub.** Three overlapping carapace plates, largest at the front, head plate with mandibles, sand plume kicked up behind. Sand `#c48a3a`. Two beady eyes. Reads because it is the only low, wide, segmented body — it hugs the ground. |
| `shade` | SHADE | navy diamond, blue diamond, dark circle | **Hooded wraith.** Pointed cowl, void-black interior, ragged hem that fades out instead of ending, a glow on the floor instead of a shadow. Indigo `#6b7cff`. Twin pinprick eyes deep in the hood. Reads because it has no feet and no hard bottom edge — nothing solid to stop. |
| `knight` | KNIGHT | gold pentagon, cross slit, plume | **Crowned great-helm.** Heavy helm with three crown points, cheek plates tapering to a chin, T-slit visor with a glow behind it, pauldrons, planted stance. Gold `#d4b05a`. Reads because it is the heaviest, widest silhouette on the board — the room-8 boss face. |

Every foe gets an eye. That shared beat is what turns nine props into nine
characters; the contour is what keeps them apart.

## REAL 3D

3D is secondary here and its ABI is pinned hard by `tests/three.test.mjs`:
`GD.e_fast[0].index.count === 72`, `EYT.e_stationary[2] === r*1.16`, the
`GD.e_rocket` reference-swap probe, and the blob-trio face-plane placement.
Geometry therefore does **not** move. The one change is `paintEyes` in
`src/render/three/textures.js`: the face strip switches from four flat
ellipses to the same socket / iris / specular / brow language as 2D, so the
character read matches across renderers. The strip stays 64x32 and still
emits at least four `arc`/`ellipse` ops, and `paintSlit` is untouched
(`eye_stationary` must contain no `ellipse`).

`SLOT_MESH.enemy` stays 4 and fat-world draw calls stay 143.

## Out of scope

`src/ai/enemies.js`, speeds, `hunt` flags, spawn tables, `heatRoster`, CORE
v6 rosters, attract config, `src/audio/foe.js` kill tints, mid-run heat,
Sudden Death, internet play. No image assets, no npm deps.

## Tests

`tests/enemies-art.test.mjs` grows the new character contract:

- All nine types paint, and their op streams stay pairwise distinct.
- Every type grounds itself (`ellipse` contact shade, or a glow for `shade`).
- Every type seals its contour with the icon-grade dark rim (`strokeStyle`
  plus `stroke`).
- Every type carries a sculpted eye (`arc`).
- Every type builds at least three tonal values (four or more `fillStyle`
  writes).
- Facing: `walker` / `chaser` / `fast` / `burrow` / `knight` draw a different
  op stream when `dir.y < -0.5`; `stationary` / `boomerang` / `rocket` /
  `shade` are `dir`-invariant.
- Field-guide fit: with `r = 14`, no body draws outside `+/-15.2` on either
  axis, so it stays inside the ENEMIES well at both 600x520 and 608x352.
- `drawIcon` still covers all twelve `POWER` ids.
- The seed-42 L1 roster and 180-step AI pins are unchanged, which is what
  proves this pass is art only.
- `SLOT_MESH.enemy === 4`, fat-world draw calls `=== 143`.

PWA `CACHE_NAME` and `sw.js` `REV` bump together (v16 to v17) because shipped
bytes changed.
