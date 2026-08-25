# Elements Redesign — real3D art pass v2 (2026-08-25)

Fixes the five player critiques on `campaign/real3d`. Units: TILE=CFG.TILE=40 world px.
Zero-dep: primitives + canvas textures only; draw-call gate ≤500 (current fat-world ≈138 total / ≈79 scene).
Sim, net, input, core and sprites.js draw fns byte-untouched; sprites stay texture SOURCES only.

## §1 Critiques → fixes
| # | Critique | Root cause | Fix |
|---|----------|-----------|-----|
| C1 | Items = flat black quads ("placards") | PlaneGeometry DoubleSide Lambert whose map is the 2D sprite's dark plate; unlit back reads black | Lit capsule-box pickup, icon on all 6 faces, additive floor ring (§2.1) |
| C2 | Bomb = purple cube + peg | legacy purple BOMB_COL tints; box fuse reads as peg | Glossy black Phong sphere, thin tilted cylinder fuse, variants = colored base TORUS; body never recolored (§2.2) |
| C3 | Enemies featureless spheres | no face/identity cue | eye-strip texture plane per enemy + sharper per-type detail parts (§2.3) |
| C4 | Player plain capsule | capsule torso dominates silhouette | bomberman stack: white sphere body + helmet dome + visor band + antenna + boots (§2.4) |
| C5 | Blades thin near-black shards | Lambert #101010, emissive too weak at grazing angle | crossed flame-gradient quads + hot core, additive orange/yellow (§2.5) |

## §2 Element specs
### 2.1 ITEMS — CHOSEN: capsule-box pickup + icon-on-all-faces + glow ring
Why: at the 45° orbit camera a box shows top+two sides toward the viewer in EVERY spin phase,
so one 64² icon reads from any yaw; per-type 3D icon stacks (12 powers × ~3 meshes) cost 3× slots
and read as blobs at distance; keeps today's matForItem ref-swap (zero new per-frame logic).
- Pickup BoxGeometry(TILE*0.44³); BoxGeometry UVs map the FULL texture per face ⇒ ONE Lambert{map:atlas.item_<t>} lights all 6 faces. Headless fallback Lambert{color:pdef.col} — bright, NEVER dark.
- Ring RingGeometry(TILE*0.30,TILE*0.46,20).rotateX(-π/2), y=1.5, Basic{color:pdef.col, transparent:.4, additive, depthWrite:false}.
- Slot group {pickup(castShadow), ring}; SLOT_MESH.item=2.

### 2.2 BOMB — classic glossy sphere
- Body children[0]: Sphere(TILE*0.30,16,12) Phong{#15181f, shininess:110, specular:#ffffff} — REAL highlight replaces painted blob (delete hi child).
- Cap cylinder y=TILE*0.63 kept; NEW fuse Cylinder(1.5,1.8,11,6), rotZ .35, y=TILE*0.72, Lambert #3a2c1a (thin rod, not peg).
- Spark children[2] Basic flicker kept, y→TILE*0.84.
- Variant ring NEW: Torus(TILE*0.315,1.6,8,24).rotateX(π/2), y=3, Lambert per variant power#ff4d5e pierce#8f8fff line#ffd447 remote#9aa3c0; normal ⇒ visible=false; ref-swapped in update's userData.v branch.
- Pulse k=1+.10·sin(18t)·fuse ⇒ scale.set(k, k·(1−.06·sin(18t)·fuse), k).
- Slot stays 5 meshes; children[0] body / [2] spark test contract PRESERVED.

### 2.3 ENEMIES — identity via face + sharpened parts
- Base geos/colors UNCHANGED (spawnEnemy table = single source of truth).
- EYES appended children[2] (detail swap loop j<2 untouched): Plane(TILE*0.34,TILE*0.16), z=r·0.92, y=EH+r·0.15, Basic{transparent, map:atlas.eye_<type>}, fallback Basic #f4f7ff; slot yaw already faces dir. Stationary (box base): z=r·1.18, y=EH·0.55.
- Detail upgrades (still exactly 2 ref-swapped children): walker feet nubs keep · chaser nose cone → visor wedge Box(r·.55,r·.28,r·.14) z r·.95 tiltX −.2 · fast trail planes → swept fins Box(r·.75,r·.30,r·.10) at ±x·r·.55 · stationary barrel+sphere keep · boomerang wing pinwheel keeps · rocket fins keep, tip cone uses ID material (brighter nose).

### 2.4 PLAYER — bomberman stack (7 meshes, count unchanged)
- body Sphere(TILE*0.26,16,12) white #f4f7ff y=TILE*0.30 (replaces capsule).
- helmet Sphere(TILE*0.29,16,12, 0,2π, 0,π/2) dome y=TILE*0.34 carries the live p.color tint (capMat renamed helmetMat — tint logic unchanged).
- visor band Cylinder(TILE*0.245,TILE*0.245,TILE*0.11,16,1,true, −π·0.55, π·1.1) open segment facing +Z, y=TILE*0.33, Basic{transparent, map:atlas.visor}, fallback #0b1020.
- antenna rod y=TILE*0.70 + ball y=TILE*0.82, boots keep. Walk-bob/yaw logic unchanged.

### 2.5 BLASTS — volumetric flame cross
- blades geometry → crossedQuads(): two PlaneGeometry(TILE*0.98) merged about Y at 0°/90° into ONE BufferGeometry (indexed 8 verts / 12 idx) — still one instance per tile, still exactly 2 draw calls for ALL blasts.
- blades mat → MeshBasicMaterial{map:atlas.fire, transparent, additive, depthWrite:false, side:DoubleSide}; palette lives in the texture ramp — DELETE Lambert/emissive-intensity machinery. Opacity = sc·(.55+.45·fresh).
- cores keep (additive #fff3b0, shrink to TILE*0.40); pop overshoot curve + flash pool FLASH_CAP=3 all keep.

## §3 Texture-pipeline additions (textures.js)
| key | canvas | content |
|-----|--------|---------|
| item_<t> ×12 (REPLACES capture of drawItemBody) | 64² transparent | bold glyph per POWER.t — flame / bomb-dot+bolt / bolt / heart / shield / boot / arc / double-arrow / bars / star / drill / antenna — stroked 6px pdef.col + white inner highlight; NO backing plate |
| eye_<type> ×6 | 64×32 | two white sclera ellipses + dark pupils + angled brows; pupil offset/brow angle varies per type |
| visor | 128×32 | navy band, two cyan glints |
| fire | 64² | vertical ramp #fff3b0→#ffb347→#ff5d2e, alpha fades at top edge |

Rules: guarded mk factory (headless ⇒ null ⇒ flat fallbacks), NearestFilter+sRGB, `_shared` flag so disposeGroup never frees mid-flight. atlasSources/buildAtlas signatures unchanged; wall/brick bake path untouched.

## §4 Animations (render-side only; world.time / p.walk driven)
| element | motion |
|---------|--------|
| item | bob ±5 @ sin(3t) about y=TILE*0.66; spin rotation.y=2.6t+phase; ring opacity .30+.22·sin(5t), scale 1+.08·sin(5t) |
| bomb | squash pulse §2.2; spark 14Hz material swap + .23 scale flicker (kept) |
| enemy | BOB table kept; boomerang wing pinwheel kept; eye plane inherits slot yaw |
| player | walk-bob sin(walk·18)·1.8 + idle sin(4t); yaw atan2(face) kept |
| blast | pop 1+.6·max(0,1−t/(ttl·.15)); global sc=1−t/ttl; opacity=sc·(.55+.45·sin(24t)) when fresh |

## §5 Files & tests
- EDIT src/render/three/entities.js — pools per §2; export SLOT_MESH={player:7,enemy:4,bomb:5,item:2}; POOL_CAPS unchanged.
- EDIT src/render/three/textures.js — §3 painters.
- TEST tests/three.test.mjs — exact SLOT_MESH counts; fat-world scene countDrawCalls formula updated (79+48=127) AND absolute ≤500 gate; item slot = pickup+ring w/ additive ring material; bomb children[0]/[2] contract + variant-ring visibility/color matrix (normal hidden); enemy children.length===3 w/ eyes last; player 7 meshes incl. hemisphere dome (parameters.thetaLength===Math.PI/2); crossedQuads position.count===8 && index.count===12; headless ⇒ fire/eye/visor/item maps null + fallback colors asserted; atlasSources exposes new keys under stub factory.
- UNTOUCHED: sim/, net/, input/, core/, sprites.js draw fns, wrapper.js API, materials.js, scene.js structure.
Budget: Δ = items +32, enemies +16, bombs/player/blades 0 ⇒ 138+48=186 ≤500.

## §6 Acceptance checklist
1. [ ] No black quad anywhere: headless item fallback = POWER color; textured path shows glyph on ≥3 simultaneously visible faces
2. [ ] Item legible at default 45° zoom from ≥2 tiles away (glyph contrast vs floor, ring visible)
3. [ ] Bomb = glossy near-black sphere with visible specular; 4 variants differ ONLY by base-ring hue
4. [ ] All 6 enemy types identifiable by silhouette alone at default camera
5. [ ] Every enemy shows eyes oriented to its travel direction
6. [ ] Player reads as bomberman (white body + colored helmet dome + visor + antenna), not a capsule
7. [ ] Blast tiles render orange/yellow additive flame cross + white core; no #101010-dominated pixels
8. [ ] npm test green incl. updated exact draw-call formula; ≤500 gate passes
9. [ ] Headless-safe: no DOM access outside guarded factories; full node --test battery passes
10. [ ] git diff scope = entities.js, textures.js, three.test.mjs ONLY (sim/net/core/sprites/scene/wrapper byte-identical)
