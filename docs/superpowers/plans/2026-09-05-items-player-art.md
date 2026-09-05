# Items + Player Art Program — INDEX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The twelve pickups and the hero read as finished arcade art in CLASSIC 2D and REAL 3D, at the same craft level the 2026-09-04 enemy pass reached — no circles-from-above, no flat one-value bodies, no toy tells on the player.

**Architecture:** Five independently landable plans. `src/render/icons.js` becomes the shared cabinet-craft module (the five-beat helpers move in from `enemybody.js`, which keeps an imports-only diff) and grows the three tables every other plan reads: `ITEM_FAMILY`, `ITEM_SHAPE`, `ITEM_ACCENT`. The 2D glyph is authored first and the 3D body is translated from it, foe-pass order. Items keep `SLOT_MESH.item === 2` and earn their two-tone from geometry; the additive ring stops restating hue and carries family. The player collapses 7 kit-bashed children into a 5-mesh stack, moving fat-world 143 → 141.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, Canvas 2D, vendored Three.js r160. Zero npm runtime deps. Node v26, no build step.

**Spec:** `docs/superpowers/specs/2026-09-05-items-player-art-design.md`

---

## Global Constraints

Copied verbatim from the spec's "Refuses to change":

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

Plus, program-wide:

- Kind `"2d"` must not import three. `icons.js` imports `CFG` and nothing else.
- One clock: `world.time`, read render-side. `performance.now()` is forbidden.
- Per-instance phase is `ph = (it.x * 0.7 + it.y * 1.3) / CFG.TILE`, never `slot`.
- Additive accents never cast shadows; `castShadow = true` on every body, never on a ring.
- `lathe(pts, seg, r)` profiles run **bottom → top** or normals invert.
- `mergeGeos` fuses pre-transformed parts; never add a child to grow a slot.
- No comments unless the file already uses explanatory block comments (its style); match the compact, no-whitespace-after-key style.
- Never write the banned grid-bomb franchise name into any committed file. Two existing strings carry it and are rewritten in P4.
- Bump `CACHE_NAME` (`src/pwa/shell.js:1`) and the `REV` token (`sw.js:3`) **together**, `current vN → vN+1`, in every commit that changes bytes listed in `shell.js`'s `SRC`. Commits that touch only `AGENTS.md` / `MEMORY.md` / `media/` / `og.png` / `tests/` bump nothing.

---

## File map

| File | P1 | P2 | P3 | P4 | P5 |
|---|---|---|---|---|---|
| `src/render/icons.js` | Modify — helpers move in, `ITEM_FAMILY` / `ITEM_SHAPE` / `ITEM_ACCENT`, five-beat `drawIcon` | — | — | — | fixes from the loop only |
| `src/render/enemybody.js` | Modify — **imports-only** (delete six local defs, add one import) | — | — | — | — |
| `src/render/sprites.js` | Modify — `drawItemChrome`, `drawItemBody` | — | Modify — `drawPlayerBody` | — | fixes from the loop only |
| `src/render/three/entities.js` | — | Modify — `ITEM_MAKE` bodies, ring geos, `update()` | — | Modify — 5-mesh player, `SLOT_MESH.player` | — |
| `src/render/three/textures.js` | — | — | — | Modify — `paintVisor` | — |
| `tests/items-art.test.mjs` | **Create** (§4.1-8, §4.15-16) | — | Modify (+§4.9-14) | — | — |
| `tests/pickup-3d.test.mjs` | — | Modify (§4.17-19) | — | Modify (141) | — |
| `tests/three.test.mjs` | — | Modify (`fire` geo type) | — | Modify (S4.A rewrite, 141 ×2) | — |
| `tests/enemies-art.test.mjs` | zero edits (guard) | zero edits | zero edits | Modify — its one 143→141 literal | zero edits |
| `tests/pickups.test.mjs` / `menudraw.test.mjs` / `touch.test.mjs` / `r3d.test.mjs` / `media.test.mjs` | zero edits | zero edits | zero edits | zero edits | zero edits |
| `AGENTS.md` | — | — | — | Modify — four spec-named lines + one new bullet | Modify — `media/` provenance if the recipe changes |
| `MEMORY.md` | append | append | append | append | append |
| `src/pwa/shell.js` + `sw.js` | bump per commit | bump per commit | bump per commit | bump per source commit | only if source bytes change |
| `og.png`, `media/*.png`, `media/play.gif`, `media/README.md` | — | — | — | — | recapture + provenance |

---

## Shared interfaces — exact signatures

Spell these identically in every plan. A drift here is the one failure mode that makes two plans uncompilable together.

```js
/* src/render/icons.js — the shared cabinet-craft module */
export const RIM = "rgba(0,0,0,0.55)";
export function rr(c, x, y, w, h, r)
export function tone(col, k, to)                     /* moved from enemybody.js */
export const dk = (col, k) => tone(col, k, 0)        /* moved */
export const lt = (col, k) => tone(col, k, 255)      /* moved */
export function seal(c)                              /* moved */
export function poly(pts)                            /* moved: (c, r, k, ox, oy) => void */
export function oval(cy, rx, ry)                     /* moved: (c, r, k, ox, oy) => void */
export const ITEM_FAMILY = {
  fire: "cap", bomb: "cap", speed: "cap",
  heart: "vit", shield: "vit",
  kick: "utl", throw: "utl", pass: "utl", remote: "utl",
  line: "bls", power: "bls", pierce: "bls",
};
export const ITEM_SHAPE = { /* 12 keys; each an outline for poly(), <= 12 verts, s-units */ };
export const ITEM_ACCENT = { /* 12 keys; each (c, s, col) => void, <= 3 paint ops */ };
export function drawIcon(c, type, col, time)         /* arity stays 4; every call site passes time */

/* src/render/sprites.js */
export function drawItemChrome(c, fam, t, ph)        /* fam is an ITEM_FAMILY value */
export function drawItemBody(c, world, it)
export function drawPlayerBody(c, world, p)
export function paintItemFace(c, type, col)          /* unchanged */

/* src/render/three/entities.js */
const ITEM_MAKE = { /* 12 keys: () => Geometry. Identifier pinned by a source grep — never rename */ };
export const ITEM_GEO = {};                          /* sharedGeo(ITEM_MAKE[t]()) per POWER row */
const ITEM_RING_GEO = { cap, vit, utl, bls };        /* 4 sharedGeo rings, all .rotateX(-Math.PI/2) */
const RING_SCALE = { line: 0.86, pierce: 1.0, power: 1.16 };
export const SLOT_MESH = { player: 5, enemy: 4, bomb: 5, item: 2 };  /* player 7 -> 5 in P4 */

/* src/render/three/textures.js */
function paintVisor(c)                               /* 128x32 strip, repainted in P4 */
```

`src/render/three/entities.js` **imports** `ITEM_FAMILY` and `ITEM_SHAPE` from `../icons.js` (which imports only `CFG`, so the 2D no-three rule is untouched). The eight flat kinds' plan outlines are therefore literally one table shared by both renderers — that is what makes §5 acceptance line 13 ("both renderers agree on the story") structural rather than a review promise. The five upright kinds' 3D lathe profiles are 3D-only and live beside `ITEM_MAKE`.

Test helpers in `tests/items-art.test.mjs` (P1 authors them, P3 reuses them verbatim):

```js
function stub()                       /* records ["op", ...numeric args] and ["set", prop, String(value)] */
function box(opt)                     /* axis-aligned extent recorder; opt.noEllipse ignores ellipse ops */
const names = (ops) => ops.map((o) => o[0]);
const setsOf = (ops, prop) => ops.filter((o) => o[0] === "set" && o[1] === prop).map((o) => o[2]);
const paints = (ops) => names(ops).filter((n) => n === "fill" || n === "stroke" || n === "fillRect").length;
const maxAbs = (b) => Math.max(-b.x0, b.x1, -b.y0, b.y1);
```

---

## Execution order

```
P1 item-glyphs ──┬──> P2 item-3d ──────────┐
                 │                          ├──> P5 art-media
                 └──> P3 player-2d ──> P4 player-3d
```

| # | Plan | Depends on | Why |
|---|---|---|---|
| P1 | `2026-09-05-item-glyphs.md` | — | Publishes `ITEM_FAMILY` / `ITEM_SHAPE` / the moved five-beat helpers |
| P2 | `2026-09-05-item-3d.md` | P1 | Imports `ITEM_FAMILY` + `ITEM_SHAPE` |
| P3 | `2026-09-05-player-2d.md` | P1 | Uses the moved `dk` / `lt` / `poly` / `seal` |
| P4 | `2026-09-05-player-3d.md` | P3 | Silhouette is authored in 2D first, then translated — the enemy-pass order |
| P5 | `2026-09-05-art-media.md` | P1–P4 | The look must be final before any pixel is captured |

P1 and P3 are 2D-only and can land while P2 is in flight. P2 and P4 are the only plans that touch `src/render/three/`.

---

## Checkbox order

- [ ] **P1** `docs/superpowers/plans/2026-09-05-item-glyphs.md` — 3 tasks
- [ ] **P2** `docs/superpowers/plans/2026-09-05-item-3d.md` — 3 tasks
- [ ] **P3** `docs/superpowers/plans/2026-09-05-player-2d.md` — 2 tasks
- [ ] **P4** `docs/superpowers/plans/2026-09-05-player-3d.md` — 3 tasks
- [ ] **P5** `docs/superpowers/plans/2026-09-05-art-media.md` — 3 tasks

14 tasks total.

---

## ABI ledger — every pin the spec renegotiates, and the one plan that moves it

| Pin | Site | Today | New | Moves in |
|---|---|---|---|---|
| `fire` body geo type | `tests/three.test.mjs:752-762` | `"ConeGeometry"` | `"LatheGeometry"` | **P2** |
| plan-view anti-collapse, build split, 4 ring geos | `tests/pickup-3d.test.mjs` (new asserts) | — | added | **P2** |
| `SLOT_MESH.player` | `src/render/three/entities.js:49` | `7` | `5` | **P4** |
| S4.A `SLOT_MESH` assert | `tests/three.test.mjs:1000-1004` | `player===7` | `player===5` | **P4** |
| S4.A geometry histogram | `tests/three.test.mjs:1007-1016` | len 7, `>=3` Sphere, `>=2` Cylinder | len 5, 0 Sphere, 0 Cylinder, `===2` Box, `===1` each of Buffer / Lathe / Extrude | **P4** |
| S4.A hemisphere-dome probe | `tests/three.test.mjs:1017-1019` | `thetaLength===Math.PI/2` | deleted → crown flare probe | **P4** |
| S4.A visor-band probe | `tests/three.test.mjs:1020-1026` | open Cylinder | deleted → Phong + rake + hull-Lambert probe | **P4** |
| fat-world, formula | `tests/three.test.mjs:1401-1406` | `wantCalls===143` | `141` | **P4** |
| fat-world, formula | `tests/pickup-3d.test.mjs:209-221` | `want === 143` | `141` | **P4** |
| fat-world, bare literal | `tests/three.test.mjs:1662-1664` | `calls===143` + label | `141` | **P4** |
| fat-world, bare literal | `tests/enemies-art.test.mjs:461-462` | `calls === 143` + label + comment | `141` | **P4** |
| AGENTS.md fat-world ×3 | `AGENTS.md:83, 164, 203` | `143` | `141` | **P4** |
| AGENTS.md specular claim | `AGENTS.md:206` | "only bright-specular Phong body" | "…Phong **foe**; the player visor is the cast's one other Phong surface" | **P4** |
| AGENTS.md player bullet | new, beside the enemy-bodies bullet | — | 5-mesh stack line | **P4** |
| R.headless player probe **(spec §3 misses this one)** | `tests/three.test.mjs:716-728` | sphere body + dome + open-cylinder band | hull Lambert `#dfe7f2` + crown lathe + Phong visor `#0b1020` | **P4** |
| S2.R visor check name **(spec §3 misses this one)** | `tests/three.test.mjs:693` | "navy band + two glints" | "dark well + lit core bar + specular pip" — the assertion itself still passes | **P4** |
| banned-franchise strings | `three/entities.js` header (~11) and player block (771); `tests/three.test.mjs:1009-1010` | present | rewritten, word gone | **P4** |
| `og.png` / cover / stills / gif provenance | `media/README.md`, `AGENTS.md:197` | current art | recaptured | **P5** |

**Kept, and therefore edited by nobody:** the 12-unique-geometry `uuid` gate (`pickup-3d.test.mjs:268-283`), `fire`-is-not-a-cube (`276-283`), item draws `=== 24`, the `ITEM_MAKE` source grep, the `item_<t>` atlas keys, `SLOT_MESH.item / .enemy / .bomb`, and all of `pickups.test.mjs` / `menudraw.test.mjs` / `touch.test.mjs` / `r3d.test.mjs` / `media.test.mjs`.

**Resolved spec ambiguities, recorded here so no plan re-litigates them:**

1. §4.20 lists fat-world `=== 141` under P2, but P2 does not move `SLOT_MESH.player`, so fat-world is still **143** while P2 is landing. §6's P4 row is the binding one ("**all four** fat-world sites 143→141"). P2 therefore adds **no** new fat-world literal; it re-runs the existing formula gate unchanged and asserts only `<= 500`.
2. §2.3's geometry column writes the visor rake as `plate(...).rotateX(-0.6)`, but §3's replacement probe reads `-0.62 <= rotation.x <= -0.58` off the **mesh**. The probe is the ABI: the geometry is `plate(VISOR_P, 0.14, TILE*0.19)` (so `.type === "ExtrudeGeometry"` for the histogram) and the rake is `visor.rotation.x = -0.6` on the mesh.
3. §4.13 asks for `±1.10r` vertically, but §2.2's own beat-1 contact ellipse reaches `r*0.98 + r*0.20 = 1.18r` by construction. Neither authored number is changed: the gate splits into `±1.05r` horizontally, `±1.20r` vertically overall, and `±1.10r` vertically for **everything but the contact shade**. (P3.)
4. §1.6's `pass` row asks for "two mesa bars flanking the slot mouth — two extra plates, four merged in total" without naming the fourth outline. Resolved as shelf + back mesa slab + two flanking bars, and the two bars are the same coordinates P1's `pass` accent fills, so the 2D and 3D reads match. (P1 T2 / P2 T1.)
5. §1.6's `kick` row says the 2D accent is the motion chevron while §1.7's beat 5 says the accent sits where the mesa sits. Resolved by painting both — the toe lobe at the mesa position plus the heel chevron — two ops, inside the `<= 3` budget. (P1 T2.)
6. §4.5's vertex and accent-op budgets are not measurable from a canvas op stream, and §4.7's chrome signatures are not separable from the glyph's own paths. Resolved by making the data addressable: `ITEM_SHAPE` / `ITEM_ACCENT` become exports of `icons.js`, and the chrome becomes `drawItemChrome`. Both are in the shared-interfaces block above.
7. §3's quoted plan figure for `line` ("57 × 10.4") does not follow from `r = IT*0.26` (`2.2 × 10.4 = 22.9`); its ratio `5.5:1` does. No number is changed — the anti-collapse gate computes `w/d` and `maxR` from the built geometry at runtime, and P2 carries the hand-derived expected table.
