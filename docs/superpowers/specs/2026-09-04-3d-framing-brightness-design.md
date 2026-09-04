# REAL 3D framing + brightness (2026-09-04)

Supersedes the rig and light numbers in `2026-09-04-3d-cam-light-frame-design.md`.
That pass fixed the *border* (four crossing rails -> one extruded cabinet rim)
and replaced a binary 1.6-key/0.25-ambient recipe with a two-directional
key+fill. It left two defects the player sees immediately.

The user's words: *"the camera angle is sooo bad ... and also it is too dark."*

Rig and lights only. No AI, no rosters, no speeds, no `BIOMES` edits, no 2D
renderer changes, no new meshes. Public name Fusegrid / FUSE/GRID.

## The two defects

**1. The board floats in a large empty field.** At `{el:0.62, dist:960,
target:[0,-44,0]}` the playfield quad covers **38.9%** of the 600x520 canvas.
It reaches 91% of the width but only 306px of the 520px height, leaving ~103px
of flat `bg1` above and below. It reads as a small object dropped in a void.

**2. Everything is murky.** Two separate causes, neither of them the light
values:

- `scene.fog = Fog(bg1, 700, 1600)` while the far board corners sit at
  **d 1086**. The far corners were **42.9%** replaced by `bg1` — the darkest
  colour in every biome. At the `DIST_MAX` 1400 dolly clamp it reaches 89%.
  The far half of the board was being erased toward black, and because it is a
  gradient it read as "murk" rather than as a bug.
- `ACESFilmicToneMapping` at exposure 1.0. Its transfer on greys:

  | linear in | ACES out | factor |
  |---|---|---|
  | 0.02 | 0.0073 | x0.36 |
  | 0.05 | 0.0317 | x0.63 |
  | 0.10 | 0.0942 | x0.94 |
  | 0.30 | 0.3743 | x1.25 |
  | 1.00 | 0.7634 | **x0.76** |

  So it crushed the deep shadows ~2.8x, boosted the mid-tones (which is why
  raising the lights alone would not have helped much), and capped white at
  0.763 linear = **226/255** — nothing in the scene could ever reach white.
  Worse, the ACES input matrix mixes channels, so low channels get annihilated:
  JUNGLE `floor0` shaded out as `0, 74, 17` — **no red at all** — and VOID
  `floor0` as `0, 0, 2`, a dead black hole.

## Framing arithmetic

Board 600x520, bezel `RIM_W` 18. Camera `PerspectiveCamera(45, 600/520)`, so
`tan(vfov/2)` = 0.414214 and `tan(hfov/2)` = 0.477939. `el` is polar from +Y;
elevation above the horizon is `90deg - el`.

### X binds the fit at every elevation

Solving for the `(dist, ty)` that centres the board vertically and puts the
worst corner exactly on `|ndc| = 0.96`, sweeping `el` from 0.18 to 1.00: the
worst corner is **ICE on the x-axis at every single elevation**, and horizontal
fill is pinned at 96.0% (576px of 600) throughout. The vertical axis has slack
everywhere. The binding point is the *near* ICE wall-top corner, because near
corners project widest.

### Lowering the camera makes the framing worse, not better

The brief assumed a lower camera (larger `el`) fills more canvas height.
It does not. With X binding the fit, vertical fill is **monotonically
decreasing** in `el`:

| el | above horizon | vFill | ICE hides | side:top |
|---|---|---|---|---|
| 0.34 | 70.5deg | 419px | 0.32 tile | 0.354 |
| 0.50 | 61.4deg | 378px | 0.49 tile | 0.546 |
| 0.62 | 54.5deg | 343px | 0.64 tile | 0.714 |
| 0.70 | 49.9deg | 320px | 0.76 tile | 0.842 |

Tilting away from vertical foreshortens the depth axis; the near edge grows but
the far edge shrinks faster, and the near edge is also what pushes `dist` out.
Occlusion moves the same way, so **there is no elevation trade to manage**: a
higher camera fills more frame *and* hides less. The real cost of `el` is the
3/4 read, which this repo already measures as `side:top = tan(el)` — the
projected cube side depth over the projected top depth. That metric is why
`el:0.419` was rejected as a ceiling security-cam (0.445) and `el:0.62` chosen
(0.714).

### Tightening the existing fit buys almost nothing

The brief noted ~9% margin at the current worst case (0.9134 vs 0.96). Spending
all of it at `el:0.62` moves vertical fill 330px -> 343px and area 38.9% ->
42.1%. The dead space is structural, not a slack-in-the-fit bug.

### The real lever: fit the playfield, not the bezel

The shipping gate pins the **bezel** outer corners (`|x| <= 318`, `|z| <= 278`,
`y <= hWall + RIM_LIP`). The hard constraint is about the *board* — all four
corners plus ICE's tall walls. The playfield is `|x| <= 300`, `|z| <= 260`,
`y <= hWall`, which is exactly the outer top corner of the border wall cubes
(column 14 spans x 260..300). Fitting there instead of on the decorative bezel
recovers 6% in X and the 6-unit rim lip in Y — worth **+24% board area at
identical `el`**, for free.

## Approaches considered

1. **Playfield fit + a modest lift of the camera (pick).**
   `el 0.62 -> 0.54`, fit basis playfield. Area 38.9% -> 50.9%. `side:top`
   0.714 -> 0.599, which is 35% above the rejected 0.445 and clearly still a
   3/4. ICE occlusion improves 0.64 -> 0.54 tile. The bezel's ICE near outer
   top corner bleeds 2.4% off frame — about 7px at the two bottom corners,
   where a cabinet well running past the screen edge is the correct read.

2. **Tighten the fit only, `el` untouched.** Zero look risk, but 38.9% ->
   42.1% does not answer a complaint about 40% dead height. Rejected as
   insufficient.

3. **Widen `RIM_W` 18 -> ~218 so the cabinet fills the surround.** This is the
   only way to remove the background band completely, and it stays 1 draw call.
   But it hides `scene.background` entirely, and the biome `bg1`/`sky` tint is
   part of each room's identity. A 5.5-tile flat lambert slab on all four sides
   is a much larger look change than the brief authorises, and it cannot be
   validated without the user's eye. Rejected for this pass; recorded as the
   next lever if the residual band still reads as a void.

## Decision — the new rig

```
{az:0, el:0.54, dist:870, target:[0,-48,0]}
```

`el 0.54` = **59.1deg above the horizon** (still past 45deg, so the plan-view
footprint remains an enemy's primary cue — the enemy-body contract is intact).

| | shipping | new |
|---|---|---|
| playfield worst \|ndc\| | 0.8439 @ICE | **0.9449 @ICE** |
| playfield vertical span | 1.1767 (306px of 520) | **1.3786 (358px)** |
| playfield area of canvas | 38.9% | **50.9%** (+31%) |
| vertical centre | 0.0074 | **0.0005** |
| bezel outer worst \|ndc\| | 0.9134 | 1.0238 (bleeds 2.4%) |
| `side:top` cube read | 0.714 | 0.599 |
| ICE wall occlusion | 0.64 tile | **0.54 tile** |
| far corner distance | 1086 | 963 |

`dist 870` deliberately lands the worst corner at 0.9449 rather than exactly on
0.96, leaving 1.6% margin so the gate is a pin and not a knife edge.

`flythrough.js` must follow or the intro pops on handoff: `BASE_DIST` 960 ->
870, `SETTLE_EL` 0.62 -> 0.54, `TARGET_Y` -44 -> -48.

## Decision — brightness

Three changes, in descending order of how much they matter.

**1. `NoToneMapping`.** The product is REAL 3D <-> CLASSIC 2D over *one*
authored palette; the 2D renderer blits `#42f024` literally while ACES
regraded it. Removing tone mapping is palette parity, not a taste call. It also
restores the top end and un-crushes the shadows. Additive blast cores and the
helmet emissive now clip to white instead of rolling off, which is the wanted
direction for "no punch".

**2. Drop `scene.fog`.** A board that must stay fully legible at every point in
the dolly clamp cannot have distance fog over it. There is no range that both
does something useful and leaves the board alone.

**3. Lift the recipe, ratio preserved.** One global recipe, no per-biome
lights or cameras.

| | shipping | new |
|---|---|---|
| warm key `#fff4e2` (sole caster) | 1.05 | **1.26** |
| cool fill `#bcd4ff` (never casts) | 0.45 | **0.54** |
| key:fill | 2.3333 | **2.3333** |
| hemisphere (sky/bg1 tinted) | 0.55 | **0.72** |
| ambient `#ffffff` | 0.18 | **0.30** |

Light positions are unchanged. The key:fill ratio is preserved *exactly*
because `PCFSoftShadowMap` ignores `shadow.radius` — softness is the ratio, so
changing it would change shadow character, which was not the complaint.

Three r160 runs `_useLegacyLights = false`, so `scaleFactor` is 1 and
`BRDF_Lambert` carries `RECIPROCAL_PI`: `reflected = irradiance * albedo / PI`.
Up-facing irradiance goes 1.6748 -> 2.1537 lit (x1.286) and 0.9157 -> 1.2429
shadowed (x1.357). Peak reflected for a 1.0 albedo is **0.6855 linear =
216/255**, so nothing clips from the light rig alone.

Resulting pixels (lit, up-facing):

| surface | old near | old far (43% fog) | new | delta near / far |
|---|---|---|---|---|
| JUNGLE `floor0` | 0, 74, 17 | 0, 55, 13 | 16, 95, 39 | +37% / +84% |
| JUNGLE `brickA` | 50,179, 29 | 0,145, 11 | 47,190, 28 | +5% / +42% |
| JUNGLE `wall` | 149,115, 25 | 112, 87, 17 | 158,125, 39 | +9% / +44% |
| ICE `brickA` | 184,190,195 | 151,160,169 | 195,206,214 | +8% / +29% |
| CROWN `brickA` | 197,160, 48 | 163,124, 27 | 214,166, 48 | +5% / +34% |
| VOID `floor0` | 0, 0, 2 | 0, 0, 1 | 11, 7, 19 | (from black) |

Shadowed JUNGLE `floor0` goes `0, 39, 9` -> `7, 67, 29`, +80%.

**VOID stays the darkest room by a wide margin** — `11, 7, 19` against JUNGLE's
`16, 95, 39`. Its darkness comes from its albedo, not from the rig, so one
global recipe preserves it. That was the requirement.

## Testing

The `§4b` framing gate moves to the playfield basis and gains two floors, so it
fails in *both* directions. A ceiling alone would have passed the defect being
fixed here.

1. `worst |ndc| <= 0.96` — nothing cropped. (new 0.9449)
2. `worst |ndc| >= 0.90` — the frame is actually filled. **The shipping rig
   scores 0.8439 and fails this.**
3. `vertical span >= 1.32` NDC — the dead-space gate. **The shipping rig
   scores 1.1767 and fails this.**
4. `|vertical centre| < 0.05` — no drift. (new 0.0005)
5. `bezel outer |ndc| <= 1.10` — the cabinet may run past the corners but must
   not fly off screen. (new 1.0238)

Both floors are chosen to fail today's rig, so they are real gates and not
restatements of the new constants. Also pinned: `toneMapping === NoToneMapping`
and `scene.fog == null`.

Draw calls stay **143** — nothing is added or removed, and the rim is still one
extruded ring.

## Out of scope

Per-biome cameras or lights, mid-run heat, `RIM_W`, the 2D renderer, the enemy
bodies, and the `SLOT_MESH`/child-index ABI. CORE + NORM stays v6
bit-identical: none of this touches `step()`.
