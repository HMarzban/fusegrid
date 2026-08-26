# Enemy Identity 3D — translate the 2D character designs (2026-08-25)
Fixes "enemies 3D are not really close to the main game". Identity source: `drawEnemyBody`
(sprites.js:220-254) + `spawnEnemy` colors (entities.js:59). KEY INSIGHT: the 2D view is
TOP-DOWN, so every 2D sprite IS the from-above footprint — the 3D ground footprint must
reproduce that outline FIRST (silhouette beats texture at the 66° rig: az 0/el 1.152/dist 700).
Units: TILE=40. r per spawnEnemy: walker 13.6 · chaser 13.2 · fast 12.8 · stationary 12 ·
boomerang 12 · rocket 16. Local +Z = facing (slot yaw = atan2(dir)), +Y = up.

## §1 2D identity extraction (sprites.js drawEnemyBody)
| type | 2D silhouette (= top-down footprint) | colors | distinctive features |
|---|---|---|---|
| walker | CIRCLE | #8affc1 | white specular blob; 2 big dark eyes (sizes swap on fling); 2 dark FEET that stomp alternately |
| chaser | CIRCLE | #66c8ff | same blob DNA, 1.3× speed; nothing else — color is the cue |
| fast | CIRCLE | #ffd447 | blob + 3 fading yellow SPEED-TRAIL streaks behind |
| stationary | ROUNDED SQUARE-in-square | shell #2a1030, core #c58aff | horizontal dark visor SLIT; slow breathing pulse (1+.06sin3t) |
| boomerang | THICK 270° ARC spinning at t·10 | #ff9dd6 | white center HUB dot |
| rocket | UPRIGHT TRIANGLE (arrowhead) | #ff7a59 | brown PAD #3a1c10 under tail; flame dot flickering #ffde7a⇄#ff7a3a @10Hz |

## §2 Per-type 3D design (primitives only; geometry-scale/merge allowed — see crossedQuads precedent)
Blob trio shares DNA (2D truth): Phong{shininess 60} body (gloss = the painted specular),
chunkier feet Box(r*.52, r*.26, r*.60) #0a0f1a, and a BIG face plane children[2]:
Plane(r*1.7, r*0.9), pos (0, EH+r*.35, r*.70), rotX −0.45 (tilted at camera — today's
TILE*.34 strip is sub-legible from above). Bolden eye_<type> painters (bigger sclera/brows).
- WALKER — base Sphere(r) unscaled (baseline proportions). Above-read: mint disc + 2 boot dots.
- CHASER — base Sphere(r) baked-scale (.86, 1.22, .86) = TALL egg. child[0] dorsal crest
  Box(r*.22, r*.85, r*1.35) fore-aft on top (longitudinal ridge). child[1] snout wedge
  Box(r*.55, r*.26, r*.16) at z r*.95. Above-read: sky-blue tall oval + ridge = dart/seeker.
- FAST — base Sphere(r) baked-scale (1.20, .80, 1.05) = LOW wide puck. child[0] twin swept
  fins MERGED into one BufferGeometry (2× Box(r*.85, r*.24, r*.14), rake −0.55, ±x r*.5,
  z −r*.25). child[1] trail slab Box(r*1.15, r*.42, r*1.5) Basic #ffd447, additive, opacity
  .30, depthWrite:false, z −r*1.35 (the 2D streaks). Above: yellow wide oval + fin triangles
  + amber smear.
- STATIONARY — base Box(r*2.3)³ #2a1030 keep (square footprint = instant ID). child[0] core
  cube Box(r*1.2) Basic #c58aff centered (corners peek past shell). child[1] hood slab
  Box(r*1.5, r*.18, r*.30) #150a1c over the slit. children[2] plane BECOMES the slit:
  Plane(r*1.5, r*.38), z r*1.16, painter = dark slit + faint magenta rim (not eyes).
- BOOMERANG — FIX for "broken ring": old torus was a VERTICAL hoop (edge-on from above).
  New base Torus(r*.72, r*.19, 8, 26, 4.7).rotateX(−π/2) = FLAT C-arc at hover EH=r*.55 —
  the 2D arc verbatim. child[0] hub Sphere(r*.26) white #ffffff. child[1] tip bead
  Sphere(r*.12) pink at one arc end (marks spin). Slot yaw OVERRIDDEN to t*10 (spin beats
  facing, matches 2D rotate(t*10)). Above-read: fat pink C wheeling around a white dot.
- ROCKET — FIX for "naked cone on its side": DELETE g.rotateX(π/2); new base
  Cone(r*1.02, r*2.5, radialSegments=3), apex +Y = triangular PYRAMID standing nose-UP whose
  footprint is the 2D arrowhead. EH=r*1.25. child[0] pad Cylinder(r*.80, r*.92, r*.30, 12)
  #3a1c10 at y r*.15. child[1] flame Cone(r*.34, r*.66, 8).rotateX(π) tip-DOWN, Basic,
  y r*.10, mat swapped #ffde7a⇄#ff7a3a @10Hz (2D floor(t*10)%2). Above: biggest orange
  TRIANGLE on the board — unique.
EH table: walker r · chaser r*1.22 · fast r*.80 · stationary r*1.15 · boomerang r*.55 ·
rocket r*1.25. All geos/mats `_shared`; colors still sourced from PROTO/spawnEnemy table.

## §3 Player + bomb
NO geometry change: the S4/v2 bomberman stack and glossy Phong bomb already match their 2D
designs (critique targeted enemies only). Contracts kept: bomb children[0] body / [2] spark;
player 7-mesh stack, helmetMat tint. Zero Δ here.

## §4 Animation (render-side only; never touches sim state)
| element | motion |
|---|---|
| blob trio | BOB table kept; NEW foot stomp: children[0/1].position.y = base + max(0, sin(t*12+kπ))*r*.16 alternating (2D fling-feet) |
| boomerang | slot.rotation.y = t*10 (override facing yaw); hub/beads ride along |
| rocket | flame mat swap on floor(t*10)%2; slight yaw sway ±0.06sin(7t) optional |
| stationary | slot.scale = 1+0.04*sin(3t) (2D breathing) |
| all | invuln blink (floor(t*12)%2) kept; face planes inherit slot yaw |

## §5 Implementation file map
- EDIT src/render/three/entities.js ONLY (plus textures.js painters): rewrite GEO/EH/GD/MD/
  GT/GR/EYT tables per §2; update() gains 3 special-cases (boomerang spin override, foot
  stomp, rocket flame swap) + stationary breathe. POOL_CAPS / SLOT_MESH {player:7,enemy:4,
  bomb:5,item:2} / exports / pool structure UNCHANGED — merged fin geometry keeps the child
  count at 4 per enemy slot.
- EDIT src/render/three/textures.js: bolden eye_* ×5; stationary painter = slit style.
- UNTOUCHED: sim/, core/, net/, input/, scene.js, wrapper.js, materials.js, sprites.js.
- Draw budget: Δdraws = 0 ⇒ fat-world total stays 186 ≤ 500 gate.
- Node-testable: pure primitive construction, guarded atlas factory (headless ⇒ flat bright
  fallbacks), `_shared` flags so disposeGroup never frees cached resources.

## §6 Tests (tests/three.test.mjs)
1. Rocket base: ConeGeometry params radialSegments===3, and NO pre-rotation — bbox height
   (maxY−minY) === r*2.5, horizontal extent < height (proves nose-up stance).
2. Boomerang base: torus arc param ≈ 4.7 AND bbox y-extent ≤ tube*2.4 (proves FLAT).
3. Chaser/fast base bbox aspect: chaser y/x > 1.3, fast y/x < 0.75 (silhouette scaling live).
4. Contract: every enemy slot children.length===3; children[2] is the face/slit plane LAST;
   [0]/[1] swap by reference on type change (existing loop untouched).
5. Face planes: blob trio EYT y > EH and z > 0; stationary slit z ≈ r*1.16.
6. Fast fins merged: GD.e_fast[0].index.count > single-box count (12).
7. Spin override: advance world.time → boomerang slot.rotation.y ≈ (t*10) mod 2π, NOT atan2(dir).
8. Rocket flame material alternates across floor(t*10)%2 boundary.
9. Headless: eye/slit/trail fallback colors bright; no DOM access.
10. countDrawCalls fat-world formula UNCHANGED (186) and absolute ≤500 gate passes.

## §7 Acceptance
Serve + screenshot ICE biome with all six types on screen at DEF rig: each type identifiable
by FOOTPRINT SILHOUETTE + color alone (square=stationary, triangle=rocket, spinning C=boom-
erang, tall-oval+ridge=chaser, wide-oval+fins=fast, plain disc+boots=walker); rocket clearly
nose-UP with flame beneath; boomerang never edge-on; trio separable without zoom or texture
squinting; npm test battery green; git diff scope = entities.js, textures.js, three.test.mjs.
