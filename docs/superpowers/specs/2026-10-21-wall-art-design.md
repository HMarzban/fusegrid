# Walls: a living wall family for every world

**Date:** 2026-10-21 · **Status:** designed and prototyped, **not built** ·
**Issue:** HMarzban/fusegrid#17

> Owner: *"let's work on the walls … the visual improvment for classic 2d and
> the pixle and also the real 3d. also it would be good to have diffrent walls
> in order to have a diffrent variant and make the board more alive for each
> world."*

Today every room draws one wall block per look, recoloured per biome. This
round gives each world its own wall material, with variants spread over the
board. It is visual only, and it ships on today's boards.

---

## 1. How the round ran

1. **Owner rulings up front:** ship **soon, on today's boards**, and keep it
   **visual only**.
2. **Two designers in parallel:**
   - **Art director:** an audit of today's walls, three directions, a family
     per world, and measured readability.
   - **Render engineer:** the per-look implementation, the costs, the test
     re-pins and a release plan, backed by a throwaway measurement prototype.
3. **Owner pick:** direction **B · Living world, without cracks**, plus three
   detail calls (section 2).
4. **Prototype:** B built in a throwaway copy of the game, with real
   before/after captures of all 8 rooms in CLASSIC 2D, PIXEL and REAL 3D
   (section 6).

Working notes, concept sheets and the prototype are on the owner's machine,
listed in `.superpowers/sdd/PROTOTYPES-2026-10.md` (git-ignored, local only).

## 2. Owner rulings (2026-10-21)

| # | Ruling |
|---|---|
| W1 | **Timing:** ship soon on today's (gen-1) boards, not gated on the random-board work (#8). Pinned visual tests are re-pinned by ruling. |
| W2 | **Visual only:** every variant behaves exactly like today's WALL. It never breaks and blocks movement and blasts. |
| W3 | **Direction B, Living world, without cracks:** one material family per world. Every variant is *built* detail (seams, plates, studs, roots wrapped round, carvings, fittings), never damage, so no wall reads as breakable. |
| W4 | **Brighter REAL 3D walls:** the wall colour was applied twice (baked map × per-instance colour), so walls rendered darker than authored; VOID's cap was nearly black. The fix is a white instance colour over the baked map, in all 8 rooms. |
| W5 | **CROWN gilt frame:** a gold frame on stone separates CROWN walls from its gold bricks by value and shape, never by re-hue. |
| W6 | **Plain outer border:** the border is one continuous rampart with no variants; variants appear only on interior pillars. SHRINK walls use the base block. |

This replaces the narrower stage-1 plan in issue #17 (generic pillar
variants, gen 2 only, tint-only 3D).

## 3. The wall families

One shared grammar does the readability work in every world:

- a chamfered block (bricks stay rounded);
- a front face as tall as the biome's `hWall`, in all three looks;
- a 1 px edge ring.

Colours come only from each biome's palette slots (`wall`, `wallHi` and
derived steps). Each world has a base block, two variants (v1, v2) and one
rare accent per room.

| World | Material | v1 | v2 | Accent (one per room) |
|---|---|---|---|---|
| JUNGLE | temple stone | roots wrapped round | fret band | root-bound |
| ICE | glacier block | carved runes | icicles | frozen fringe |
| FACTORY | plate steel | weld seam | bolted strap | pipe run |
| WATER | pier stone | barnacles | algae drips | mooring cleat |
| ARENA | colosseum stone | tally marks | carved column | laurel |
| SAND | sandstone | sand drift | beam ends | step relief |
| VOID | obsidian monolith | crystal inlay | faceted cap with gem | rune slit |
| CROWN | royal masonry, gilt frame | gilt corners | gilt studs | keystone |

**The pick** is a render-side hash, `wallHash(seed, level, x, y)` (murmur
`fmix32`). It never touches `world.rng`, and the sim does not change. Measured
over 400 seeds × 8 rooms:

- pillars split base 53%, v1 22%, v2 21%, accent 4%;
- every room has exactly one accent.

ATTRACT, the intro show and the CLASSIC hash world use fixed seeds, so their
walls never change.

A wall-mask snapshot, taken when a new `world.grid` appears, tells SHRINK walls
apart from pillars, so a SHRINK ring never becomes a variant pillar or moves the
accent. The snapshot also refreshes variants on a new seed or board, which
gen-2 boards (#12) need.

## 4. Readability, measured

- **Wall vs floor edge contrast:**
  - In CLASSIC 2D, SAND and VOID rise from 0% to 100%.
  - In PIXEL, the six worlds that sat at 45–63% rise to 99–100%.
- **CROWN:** wall vs gold brick under tritan simulation rises from 14.6 to 17.1.
- **Colourblind gates:**
  - every pair that was under ΔE 14 drops by at most 0.5;
  - ARENA PIXEL protan sits at 6.5 → 6.4, within tolerance after the fix.
- **The MAKO swatch gate** shows 0 collapses in both looks.
- **Variant marks** cover at most 30% of a block: no ring or "+" shapes, no
  blast colours, nothing animated.

## 5. Per look

| Look | How | Cost |
|---|---|---|
| CLASSIC 2D | One shared shape list per world (`wallart.js`) feeds the baked tiles and the vector fallback, so Node tests see the walls. | Still one `drawImage` per wall. `drawGrid` 0.204 → 0.212 ms per frame. The baked tiles add 256 KB. Baking all 88 tiles took 31 ms on the laptop, over the 8 ms phone gate, so the build bakes one world at a time, on room entry. |
| REAL 3D | A per-instance cell index on the ONE wall InstancedMesh samples a strip copied from the CLASSIC bake: tops and sides from separate rows, white instance colour (W4). | **141 draws before and after**; GL calls and triangles identical in all 8 rooms. The near-wall cutaway, lights, camera and shadows are unchanged. |
| PIXEL | Cells generated from the same shape list (palette-slot grids). | 124,157 → 142,904 B, 17,976 B over the 122 KB cap. It needs the PIXEL dynamic import (#15) and its new lazy-tree cap first. |

## 6. Prototype results

Throwaway branch `worktree-agent-a531a182f96a26f7e`, based on v184, local only:

- **Tests:** 55/59 pass. The four failures are the expected re-pins:
  - the CLASSIC call-log hash `97480c1c:22630` → `186c1c19:27916`;
  - the PIXEL size cap;
  - the precache list (three new files);
  - the 3D checker-colour test (white by ruling W4).
- **Reference sheets** under `assets/2026-10-21/`: `walls-sheet-2d.png`,
  `walls-sheet-px.png` and `walls-sheet-3d.png` (all 8 rooms, live v184
  above the prototype), and `walls-closeup-families.png` (every world's base,
  v1, v2, accent, border and corner in all three looks; pillar codes forced by
  a debug override for the close-up).
- **Watch item:** in REAL 3D, the brighter border rampart reads as a pale
  frame in ICE and FACTORY. The owner's eye decides whether to step it down
  one value.

## 7. Release plan

| Release | Contents |
|---|---|
| v185 | CLASSIC 2D + REAL 3D walls (W1–W6), with re-pins by ruling and a `CACHE_NAME`/REV bump with the new files in PRECACHE. |
| #15 | PIXEL dynamic import with its lazy-tree cap (about 1 day). |
| v186 | PIXEL walls. |

Total effort is about 3.5–4.5 days. If the owner wants all three looks at
once, the fallback is a one-time PIXEL cap raise.

## Addendum (2026-10-23): art round 3, maturity pass

Owner: *"make the visual look better, more mature and add tinny details that
are matter in game and for gamers"*, then *"the real 3D need more effort to
make it better in visual effects and details"*.

An art-director review judged the detail pass at true size (40 px, grayscale)
and found two faults: wall faces carried brick-style courses and mortar
(the genre's "this breaks" cue on a block that never breaks), and causeless
speckle read as dirt. Round 3 is the art target for #17 and #31:

- **WALL never reads as BRICK, by shape.** Wall faces are monolithic (dressed
  blocks, tooling, one plinth or tide line at most); no horizontal stripe
  rhythm finer than half a tile and no perpend joints that echo the brick.
  BRICK keeps its courses (PIXEL) or pillow gloss (CLASSIC 2D, REAL 3D). The
  new `tools/walls/gray.mjs` counts stripes and perpends per face.
- **Every mark has a cause.** Stain under the cap lip, wet film on the WATER
  cap edge, damp below the tide line, a rust run under FACTORY bolts, a frost
  rim on ICE, sand drift at the SAND foot. Grain only on SAND. No dither
  wedges. Marks at least 2 texels in the 3D strip (388 → 0 below that).
- **One key from the top-left.** A crisp one-step cap bevel, warm bevel
  shadows on gold and sand (no grey or green `pxRamp` shadow).
- **No letters.** ICE v1 is one frost-filled crystal; the ARENA PIXEL tally
  is four bars and a slash.
- **REAL 3D effects in the one wall material:** a bump strip from the same
  shape lists (the key light rakes bevels and carvings), per-world gloss
  (ICE, WATER, FACTORY, CROWN glossy; VOID low; JUNGLE, ARENA, SAND matte)
  and contact AO toward the floor. 141 draws, triangles unchanged; wall
  texture memory 563 KB → 1.13 MB per room; the strip build costs 6–7.5 ms
  per room start on the laptop (phone and frame time unmeasured; needs
  headed real-GPU Chrome). Picked candidate C (relief 3, gloss 0.6, AO 0.2)
  for the lowest shimmer at play distance.
- **Costs:** PIXEL `art/walls.js` 17,640 B (prototype) → 12,824 B; the px
  tree is still over its cap until #15. CLASSIC bake 0.3–0.6 ms per world.
  Readability: no pair under 20 drops more than 0.5 (six CVD pairs dip by
  0.1–0.5, ARENA PIXEL wall vs brick protan 6.4 → 5.9 the largest).

Reference sheets under `assets/2026-10-23/`: `walls-round3-2d-px.png` and
`walls-round3-2d-px-gray.png` (every world's base, v1, v2, accent, border
and its BRICK, CLASSIC 2D and PIXEL), `walls-round3-3d-rooms.png` (rooms 1–8
at rig C) and `walls-round3-3d-candidates.png` (the 3D candidates).
Throwaway branch: `worktree-agent-ab0dfcf6e3434b2c3` (local, locked).
