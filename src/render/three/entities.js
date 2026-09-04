/* Entity pools (real3d spec §2 + elements-redesign 2026-08-25 §2/§4):
   fixed-capacity, visibility-toggled meshes. update(world) writes transforms
   in array order from live entries; unused slots visible=false. No per-frame
   allocation: geometries/materials are module-cached and swapped BY
   REFERENCE, matrices reuse scratch objects, blade instances live in fixed
   InstancedMeshes (count-culled), flash lights are a fixed 3-light pool.
   Identity colors come from the sim's spawnEnemy table (single source of
   truth, biome-independent); atlas maps merge only when they are real
   THREE.Textures, so headless keeps flat bright fallbacks. v2 silhouettes:
   capsule-box pickups + additive glow rings, glossy Phong bombs with variant
   base rings, bomberman player stack, crossed-quad flame blasts. Enemy
   identity 2026-08-25: per-type 3D designs translated silhouette-first from
   the TOP-DOWN 2D sprites (blob trio = glossy Phong spheres with baked
   scale + big tilted face planes, stationary square shell + magenta core +
   visor slit, boomerang flat C-torus with hub/bead spinning at t*10,
   rocket upright 3-sided pyramid on a pad with flickering flame). Idle
   bob/stomp/spin/breathe are render-side only (never touch sim state). */
import * as THREE from "../../../vendor/three.module.js";
import { CFG } from "../../core/config.js";
import { POWER, spawnEnemy } from "../../core/entities.js";

const W2 = (CFG.COLS * CFG.TILE) / 2,
  D2 = (CFG.ROWS * CFG.TILE) / 2;
export const ENEMY_TYPES = [
  "walker",
  "chaser",
  "fast",
  "stationary",
  "boomerang",
  "rocket",
];
const PROTO = {};
for (const t of ENEMY_TYPES) PROTO[t] = spawnEnemy(t, 0, 0, 1, null);
export const ENEMY_COLORS = {};
for (const t of ENEMY_TYPES) ENEMY_COLORS[t] = PROTO[t].color;

export const POOL_CAPS = {
  player: 1,
  enemies: 16,
  bombs: CFG.MAX_BOMBS,
  items: 32,
  blades: 16 * (1 + 4 * CFG.MAX_RANGE),
};
/* Mesh counts per pool slot (base + art children) — feed the draw-call
   budget formula. */
export const SLOT_MESH = { player: 7, enemy: 4, bomb: 5, item: 2 };
export const FLASH_CAP = 3;

const _m = new THREE.Matrix4(),
  _p = new THREE.Vector3(),
  _q = new THREE.Quaternion(),
  _s = new THREE.Vector3(),
  _c = new THREE.Color();
const BL_W = new THREE.Color("#ffffff"),
  BL_A = new THREE.Color("#ffb347"),
  BL_R = new THREE.Color("#ff5d73");

/* per-type geometry + material caches (shared across pool slots & rebuilds:
   flagged _shared so disposeGroup never frees them mid-flight). Enemy-
   identity 2026-08-25 §2: every base reproduces the TOP-DOWN 2D footprint
   first (silhouette beats texture at the 66° rig). Blob trio = glossy
   Phong(60) spheres with baked silhouette scale; stationary keeps the
   #2a1030 square shell; boomerang is a FLAT C-torus; rocket is an upright
   3-sided pyramid (apex +Y, no pre-rotation). */
const GEO = {},
  MATE = {};
export const EH = {};
function sharedGeo(g) {
  g._shared = true;
  return g;
}
function sharedMat(m) {
  m._shared = true;
  return m;
}
for (const t of ENEMY_TYPES) {
  const r = PROTO[t].r;
  let g, h, m;
  if (t === "walker") {
    g = new THREE.SphereGeometry(r, 16, 12);
    h = r;
    m = new THREE.MeshPhongMaterial({ color: PROTO[t].color, shininess: 60 });
  } else if (t === "chaser") {
    g = new THREE.SphereGeometry(r, 16, 12);
    g.scale(0.86, 1.22, 0.86);
    h = r * 1.22;
    m = new THREE.MeshPhongMaterial({ color: PROTO[t].color, shininess: 60 });
  } else if (t === "fast") {
    g = new THREE.SphereGeometry(r, 16, 12);
    g.scale(1.2, 0.8, 1.05);
    h = r * 0.8;
    m = new THREE.MeshPhongMaterial({ color: PROTO[t].color, shininess: 60 });
  } else if (t === "stationary") {
    g = new THREE.BoxGeometry(r * 2.3, r * 2.3, r * 2.3);
    h = r * 1.15;
    m = new THREE.MeshLambertMaterial({ color: "#2a1030" });
  } else if (t === "boomerang") {
    g = new THREE.TorusGeometry(r * 0.72, r * 0.19, 8, 26, 4.7);
    g.rotateX(-Math.PI / 2);
    h = r * 0.55;
    m = new THREE.MeshLambertMaterial({ color: PROTO[t].color });
  } else {
    g = new THREE.ConeGeometry(r * 1.02, r * 2.5, 3);
    h = r * 1.25;
    m = new THREE.MeshLambertMaterial({ color: PROTO[t].color });
  }
  GEO["e_" + t] = sharedGeo(g);
  EH["e_" + t] = h;
  MATE["e_" + t] = sharedMat(m);
}

/* merge two indexed BufferGeometries into one draw call (crossedQuads
   precedent) — used for the fast twin fins so the slot child count stays
   at the fixed 4-mesh contract. */
function mergeGeos(a, b) {
  const g = new THREE.BufferGeometry(),
    na = a.attributes.position.count;
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        ...Array.from(a.attributes.position.array),
        ...Array.from(b.attributes.position.array),
      ],
      3,
    ),
  );
  g.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      [
        ...Array.from(a.attributes.normal.array),
        ...Array.from(b.attributes.normal.array),
      ],
      3,
    ),
  );
  g.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      [
        ...Array.from(a.attributes.uv.array),
        ...Array.from(b.attributes.uv.array),
      ],
      2,
    ),
  );
  g.setIndex([
    ...Array.from(a.index.array),
    ...Array.from(b.index.array).map((v) => v + na),
  ]);
  return g;
}

const IT = CFG.TILE;
function itemGeoFor(t) {
  let g;
  if (t === "fire") g = new THREE.ConeGeometry(IT * 0.18, IT * 0.5, 7);
  else if (t === "bomb") g = new THREE.SphereGeometry(IT * 0.22, 12, 10);
  else if (t === "speed") g = new THREE.OctahedronGeometry(IT * 0.26, 0);
  else if (t === "heart") {
    const a = new THREE.SphereGeometry(IT * 0.15, 8, 6);
    a.translate(-IT * 0.09, IT * 0.06, 0);
    const b = new THREE.SphereGeometry(IT * 0.15, 8, 6);
    b.translate(IT * 0.09, IT * 0.06, 0);
    g = mergeGeos(a, b);
  } else if (t === "shield")
    g = new THREE.CylinderGeometry(IT * 0.2, IT * 0.22, IT * 0.36, 8);
  else if (t === "kick") g = new THREE.BoxGeometry(IT * 0.2, IT * 0.16, IT * 0.38);
  else if (t === "throw") g = new THREE.SphereGeometry(IT * 0.16, 10, 8);
  else if (t === "pass") g = new THREE.BoxGeometry(IT * 0.38, IT * 0.14, IT * 0.28);
  else if (t === "line") {
    g = new THREE.CylinderGeometry(IT * 0.055, IT * 0.055, IT * 0.52, 6);
    g.rotateZ(Math.PI / 2);
  } else if (t === "power") g = new THREE.OctahedronGeometry(IT * 0.34, 0);
  else if (t === "pierce") g = new THREE.ConeGeometry(IT * 0.11, IT * 0.52, 5);
  else g = new THREE.CylinderGeometry(IT * 0.16, IT * 0.18, IT * 0.3, 10);
  return sharedGeo(g);
}
export const ITEM_GEO = {};
for (const pd of POWER) ITEM_GEO[pd.t] = itemGeoFor(pd.t);

/* Enemy detail silhouettes: exactly 2 child meshes per slot, per-type
   geometry/material/transform caches swapped BY REFERENCE on type change
   (the big face/slit plane rides children[2], appended separately). Local
   frame: +Z is the facing direction (slot rotation.y = atan2(dir)). */
const DARK = sharedMat(new THREE.MeshLambertMaterial({ color: "#0a0f1a" }));
/* rocket flame flicker mats: #ffde7a⇄#ff7a3a on floor(t*10)%2 (2D parity) */
const FLAME_A = sharedMat(new THREE.MeshBasicMaterial({ color: "#ffde7a" }));
const FLAME_B = sharedMat(new THREE.MeshBasicMaterial({ color: "#ff7a3a" }));
export const GD = {},
  MD = {},
  GT = {},
  GR = {};
{
  let r, K;
  K = "e_walker";
  r = PROTO.walker.r;
  const foot = sharedGeo(new THREE.BoxGeometry(r * 0.52, r * 0.26, r * 0.6));
  GD[K] = [foot, foot];
  MD[K] = [DARK, DARK];
  GT[K] = [
    [-r * 0.52, r * 0.14, r * 0.5],
    [r * 0.52, r * 0.14, r * 0.5],
  ];
  GR[K] = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  K = "e_chaser";
  r = PROTO.chaser.r;
  GD[K] = [
    sharedGeo(new THREE.BoxGeometry(r * 0.22, r * 0.85, r * 1.35)),
    sharedGeo(new THREE.BoxGeometry(r * 0.55, r * 0.26, r * 0.16)),
  ];
  MD[K] = [DARK, DARK];
  GT[K] = [
    [0, r * 1.22, 0],
    [0, r * 1.15, r * 0.95],
  ];
  GR[K] = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  K = "e_fast";
  r = PROTO.fast.r;
  const finA = new THREE.BoxGeometry(r * 0.85, r * 0.24, r * 0.14);
  finA.rotateX(-0.55);
  finA.translate(-r * 0.5, r * 0.6, -r * 0.25);
  const finB = new THREE.BoxGeometry(r * 0.85, r * 0.24, r * 0.14);
  finB.rotateX(-0.55);
  finB.translate(r * 0.5, r * 0.6, -r * 0.25);
  const trailM = sharedMat(
    new THREE.MeshBasicMaterial({
      color: "#ffd447",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  GD[K] = [
    sharedGeo(mergeGeos(finA, finB)),
    sharedGeo(new THREE.BoxGeometry(r * 1.15, r * 0.42, r * 1.5)),
  ];
  MD[K] = [DARK, trailM];
  GT[K] = [
    [0, 0, 0],
    [0, r * 0.55, -r * 1.35],
  ];
  GR[K] = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  K = "e_stationary";
  r = PROTO.stationary.r;
  const coreM = sharedMat(
    new THREE.MeshBasicMaterial({
      color: PROTO.stationary.color,
    }),
  );
  const hoodM = sharedMat(new THREE.MeshLambertMaterial({ color: "#150a1c" }));
  GD[K] = [
    sharedGeo(new THREE.BoxGeometry(r * 1.2, r * 1.2, r * 1.2)),
    sharedGeo(new THREE.BoxGeometry(r * 1.5, r * 0.18, r * 0.3)),
  ];
  MD[K] = [coreM, hoodM];
  GT[K] = [
    [0, r * 1.15, 0],
    [0, r * 1.38, r * 1.08],
  ];
  GR[K] = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  K = "e_boomerang";
  r = PROTO.boomerang.r;
  const hubM = sharedMat(new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  const beadM = sharedMat(
    new THREE.MeshBasicMaterial({
      color: PROTO.boomerang.color,
    }),
  );
  GD[K] = [
    sharedGeo(new THREE.SphereGeometry(r * 0.26, 10, 8)),
    sharedGeo(new THREE.SphereGeometry(r * 0.12, 8, 6)),
  ];
  MD[K] = [hubM, beadM];
  GT[K] = [
    [0, 0, 0],
    [Math.cos(4.7) * r * 0.72, 0, -Math.sin(4.7) * r * 0.72],
  ];
  GR[K] = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  K = "e_rocket";
  r = PROTO.rocket.r;
  const padM = sharedMat(new THREE.MeshLambertMaterial({ color: "#3a1c10" }));
  const flameG = sharedGeo(new THREE.ConeGeometry(r * 0.34, r * 0.66, 8));
  flameG.rotateX(Math.PI);
  GD[K] = [
    sharedGeo(new THREE.CylinderGeometry(r * 0.8, r * 0.92, r * 0.3, 12)),
    flameG,
  ];
  MD[K] = [padM, FLAME_A];
  GT[K] = [
    [0, r * 0.15, 0],
    [0, r * 0.1, 0],
  ];
  GR[K] = [
    [0, 0, 0],
    [0, 0, 0],
  ];
}
/* face/slit plane placement per type (children[2]): blob trio gets a BIG
   plane tilted at the camera (identity §2), stationary's IS the visor slit,
   boomerang/rocket keep the small legacy strip. */
export const GF = {},
  EYR = {};
export const EYT = {};
for (const t of ENEMY_TYPES) {
  const r = PROTO[t].r,
    k = "e_" + t;
  if (t === "stationary") {
    GF[k] = sharedGeo(new THREE.PlaneGeometry(r * 1.5, r * 0.38));
    EYT[k] = [0, r * 1.15, r * 1.16];
    EYR[k] = [0, 0, 0];
  } else if (t === "walker" || t === "chaser" || t === "fast") {
    GF[k] = sharedGeo(new THREE.PlaneGeometry(r * 1.7, r * 0.9));
    EYT[k] = [0, EH[k] + r * 0.35, r * 0.7];
    EYR[k] = [-0.45, 0, 0];
  } else {
    GF[k] = sharedGeo(
      new THREE.PlaneGeometry(CFG.TILE * 0.34, CFG.TILE * 0.16),
    );
    EYT[k] = [0, EH[k] + r * 0.15, r * 0.92];
    EYR[k] = [0, 0, 0];
  }
}
/* idle bob per type [amp, freq] — render-side breathing only */
const BOB = {
  e_walker: [1.8, 12],
  e_chaser: [1.2, 9],
  e_fast: [1.0, 16],
  e_stationary: [1.5, 3],
  e_boomerang: [2.0, 10],
  e_rocket: [1.4, 7],
};

/* Bomb v2: ONE glossy Phong body (variants never recolor it) + colored base
   TORUS rings per bombKind; normal hides its ring. */
const BODY_B = sharedMat(
  new THREE.MeshPhongMaterial({
    color: "#15181f",
    shininess: 110,
    specular: new THREE.Color("#ffffff"),
  }),
);
const RING_COL = {
  power: "#ff4d5e",
  pierce: "#8f8fff",
  line: "#ffd447",
  remote: "#9aa3c0",
};
const RINGM = {};
for (const k in RING_COL)
  RINGM["b_" + k] = sharedMat(
    new THREE.MeshLambertMaterial({ color: RING_COL[k] }),
  );
/* fuse spark is an unlit Basic glow (2D parity flicker 1±.23sin(30t)). */
const SPARK_A = sharedMat(new THREE.MeshBasicMaterial({ color: "#ff5d73" }));
const SPARK_B = sharedMat(new THREE.MeshBasicMaterial({ color: "#ffd447" }));

export function createPools(biome, atlas) {
  const group = new THREE.Group();

  /* Player v2: bomberman stack — white sphere body, p.color hemisphere dome,
     open visor band segment facing +Z, antenna rod+ball, two boots. Slot
     group carries the ground origin; children stack upward. */
  const player = new THREE.Group();
  player.userData.tag = "player";
  const helmetMat = sharedMat(
    new THREE.MeshLambertMaterial({ color: "#37f0d0" }),
  );
  const bodyMat = sharedMat(
    new THREE.MeshLambertMaterial({ color: "#f4f7ff" }),
  );
  const T4 = CFG.TILE * 0.01;
  const body = new THREE.Mesh(
    sharedGeo(new THREE.SphereGeometry(CFG.TILE * 0.26, 16, 12)),
    bodyMat,
  );
  body.position.y = CFG.TILE * 0.3;
  body.castShadow = true;
  body.receiveShadow = true;
  const helmet = new THREE.Mesh(
    sharedGeo(
      new THREE.SphereGeometry(
        CFG.TILE * 0.29,
        16,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ),
    ),
    helmetMat,
  );
  helmet.position.y = CFG.TILE * 0.34;
  helmet.castShadow = true;
  const visorMat = new THREE.MeshBasicMaterial({ transparent: true });
  let visorBase = "#0b1020";
  if (atlas && atlas.visor instanceof THREE.Texture) {
    visorMat.map = atlas.visor;
    visorMat.color.set("#ffffff");
    visorBase = "#ffffff";
  } else visorMat.color.set("#0b1020");
  const visor = new THREE.Mesh(
    sharedGeo(
      new THREE.CylinderGeometry(
        CFG.TILE * 0.245,
        CFG.TILE * 0.245,
        CFG.TILE * 0.11,
        16,
        1,
        true,
        -Math.PI * 0.55,
        Math.PI * 1.1,
      ),
    ),
    visorMat,
  );
  visor.position.y = CFG.TILE * 0.33;
  const rodMat = sharedMat(new THREE.MeshLambertMaterial({ color: "#0b1020" }));
  const rod = new THREE.Mesh(
    sharedGeo(
      new THREE.CylinderGeometry(T4 * 0.9, T4 * 0.9, CFG.TILE * 0.14, 6),
    ),
    rodMat,
  );
  rod.position.y = CFG.TILE * 0.7;
  const ballMat = sharedMat(new THREE.MeshBasicMaterial({ color: "#ff5d73" }));
  const ball = new THREE.Mesh(
    sharedGeo(new THREE.SphereGeometry(T4 * 0.62, 8, 6)),
    ballMat,
  );
  ball.position.y = CFG.TILE * 0.82;
  const footGeo = sharedGeo(
    new THREE.BoxGeometry(CFG.TILE * 0.22, CFG.TILE * 0.1, CFG.TILE * 0.26),
  );
  const bootMat = sharedMat(
    new THREE.MeshLambertMaterial({ color: "#0d3f78" }),
  );
  const footL = new THREE.Mesh(footGeo, bootMat);
  footL.position.set(-CFG.TILE * 0.15, CFG.TILE * 0.05, 0);
  const footR = new THREE.Mesh(footGeo, bootMat);
  footR.position.set(CFG.TILE * 0.15, CFG.TILE * 0.05, 0);
  footL.castShadow = footR.castShadow = true;
  player.add(body, helmet, visor, rod, ball, footL, footR);

  const enemies = [],
    bombs = [],
    items = [];
  const eyeMats = {};
  function eyeFor(t) {
    let m = eyeMats[t];
    if (!m) {
      m = new THREE.MeshBasicMaterial({ transparent: true });
      if (atlas && atlas["eye_" + t] instanceof THREE.Texture) {
        m.map = atlas["eye_" + t];
        m.color.set("#ffffff");
      } else m.color.set("#f4f7ff");
      eyeMats[t] = m;
    }
    return m;
  }
  for (let i = 0; i < POOL_CAPS.enemies; i++) {
    const s = new THREE.Mesh(GEO.e_walker, MATE.e_walker);
    s.userData.tag = "enemy";
    s.userData.k = "e_walker";
    s.castShadow = true;
    s.receiveShadow = true;
    s.visible = false;
    for (let j = 0; j < 2; j++) {
      const d = new THREE.Mesh(GD.e_walker[j], MD.e_walker[j]);
      d.position.set(...GT.e_walker[j]);
      d.rotation.set(...GR.e_walker[j]);
      d.castShadow = true;
      s.add(d);
    }
    const ey = new THREE.Mesh(GF.e_walker, eyeFor("walker"));
    ey.position.set(...EYT.e_walker);
    ey.rotation.set(...EYR.e_walker);
    s.add(ey);
    enemies.push(s);
    group.add(s);
  }
  /* Bombs v2: glossy black sphere + thin tilted fuse rod + variant base ring
     + metal cap (children[0] body / [2] spark contract kept). */
  const bombBodyGeo = sharedGeo(
    new THREE.SphereGeometry(CFG.TILE * 0.3, 16, 12),
  );
  const fuseGeo = sharedGeo(new THREE.CylinderGeometry(1.5, 1.8, 11, 6));
  const sparkGeo = sharedGeo(new THREE.SphereGeometry(2.7, 8, 6));
  const vringGeo = sharedGeo(
    (() => {
      const g = new THREE.TorusGeometry(CFG.TILE * 0.315, 1.6, 8, 24);
      g.rotateX(Math.PI / 2);
      return g;
    })(),
  );
  const capGeo = sharedGeo(
    new THREE.CylinderGeometry(
      CFG.TILE * 0.07,
      CFG.TILE * 0.09,
      CFG.TILE * 0.1,
      10,
    ),
  );
  const fuseMat = sharedMat(
    new THREE.MeshLambertMaterial({ color: "#3a2c1a" }),
  );
  const capMatB = sharedMat(
    new THREE.MeshLambertMaterial({ color: "#9aa3c0" }),
  );
  for (let i = 0; i < POOL_CAPS.bombs; i++) {
    const s = new THREE.Group();
    s.userData.tag = "bomb";
    const b = new THREE.Mesh(bombBodyGeo, BODY_B);
    b.castShadow = true;
    b.position.y = CFG.TILE * 0.32;
    const f = new THREE.Mesh(fuseGeo, fuseMat);
    f.rotation.z = 0.35;
    f.position.y = CFG.TILE * 0.72;
    const sp = new THREE.Mesh(sparkGeo, SPARK_A);
    sp.position.y = CFG.TILE * 0.84;
    const rg = new THREE.Mesh(vringGeo, RINGM.b_power);
    rg.visible = false;
    rg.position.y = 3;
    const cap = new THREE.Mesh(capGeo, capMatB);
    cap.position.y = CFG.TILE * 0.63;
    s.add(b, f, sp, rg, cap);
    s.visible = false;
    bombs.push(s);
    group.add(s);
  }
  /* Items: unique shared geo per POWER.t + additive floor glow ring. */
  const iringGeo = sharedGeo(
    (() => {
      const g = new THREE.RingGeometry(CFG.TILE * 0.3, CFG.TILE * 0.46, 20);
      g.rotateX(-Math.PI / 2);
      return g;
    })(),
  );
  const itemMats = {},
    itemRings = {};
  function matForItem(t, col) {
    let m = itemMats[t];
    if (!m) {
      m = sharedMat(new THREE.MeshLambertMaterial());
      m.color.set(col || "#ffffff");
      itemMats[t] = m;
    }
    return m;
  }
  function ringForItem(t, col) {
    let m = itemRings[t];
    if (!m) {
      m = sharedMat(
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      m.color.set(col || "#ffffff");
      itemRings[t] = m;
    }
    return m;
  }
  for (let i = 0; i < POOL_CAPS.items; i++) {
    const s = new THREE.Group();
    s.userData.tag = "item";
    const q = new THREE.Mesh(ITEM_GEO.fire, matForItem("fire", "#ff8a3c"));
    q.castShadow = true;
    const rg = new THREE.Mesh(iringGeo, ringForItem("fire", "#ff8a3c"));
    rg.position.y = 1.5;
    s.add(q, rg);
    s.visible = false;
    items.push(s);
    group.add(s);
  }
  /* Blasts v2: crossed flame-gradient quads merged into ONE BufferGeometry
     per layer — outer amber cross keeps the exact prior ttl-shrink contract,
     inner white-hot core pops at spawn (overshoot easing settles by 20%
     ttl). Palette lives in the atlas.fire ramp texture. */
  function crossedQuads(sz) {
    const a = new THREE.PlaneGeometry(sz, sz),
      b = new THREE.PlaneGeometry(sz, sz);
    b.rotateY(Math.PI / 2);
    const g = new THREE.BufferGeometry(),
      n = a.attributes.position.count;
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          ...Array.from(a.attributes.position.array),
          ...Array.from(b.attributes.position.array),
        ],
        3,
      ),
    );
    g.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(
        [
          ...Array.from(a.attributes.normal.array),
          ...Array.from(b.attributes.normal.array),
        ],
        3,
      ),
    );
    g.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(
        [
          ...Array.from(a.attributes.uv.array),
          ...Array.from(b.attributes.uv.array),
        ],
        2,
      ),
    );
    g.setIndex([
      ...Array.from(a.index.array),
      ...Array.from(b.index.array).map((v) => v + n),
    ]);
    return sharedGeo(g);
  }
  const bladeGeo = crossedQuads(CFG.TILE * 0.98);
  const bladeMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  if (atlas && atlas.fire instanceof THREE.Texture) {
    bladeMat.map = atlas.fire;
    bladeMat.color.set("#ffffff");
  } else bladeMat.color.set("#ffb347");
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, POOL_CAPS.blades);
  blades.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blades.frustumCulled = false; // count varies per frame
  blades.castShadow = false;
  blades.receiveShadow = false;
  blades.count = 0;
  blades.userData.tag = "blade";
  group.add(blades);
  const coreGeo = new THREE.BoxGeometry(CFG.TILE * 0.4, 12, CFG.TILE * 0.4);
  const coreMat = new THREE.MeshBasicMaterial({
    color: "#fff3b0",
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const cores = new THREE.InstancedMesh(coreGeo, coreMat, POOL_CAPS.blades);
  cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cores.frustumCulled = false;
  cores.castShadow = false;
  cores.receiveShadow = false;
  cores.count = 0;
  cores.userData.tag = "blade";
  group.add(cores);
  /* flash pool: <=3 concurrent point lights riding the freshest blast
     centers; intensity tracks per-blade freshness, spares stay dark. */
  const flashes = [];
  for (let i = 0; i < FLASH_CAP; i++) {
    const L = new THREE.PointLight("#ffd447", 0, CFG.TILE * 3.6, 2);
    L.userData.tag = "flash";
    flashes.push(L);
    group.add(L);
  }
  group.add(player);

  function update(world) {
    const t = world.time || 0;
    const p = world.players && world.players[0];
    if (
      p &&
      p.alive !== false &&
      !(p.iFrames > 0 && Math.floor(p.iFrames * 12) % 2 === 1)
    ) {
      player.visible = true;
      const moving = !!(p.face && (p.face.x || p.face.y)) && !(p.iFrames > 0);
      player.position.set(
        p.x - W2,
        CFG.TILE * 0.05 +
          (moving ? Math.sin(p.walk * 18) * 1.8 : Math.sin(t * 4) * 1.0),
        p.y - D2,
      );
      player.rotation.y = Math.atan2(
        p.face ? p.face.x : 0,
        p.face ? p.face.y : 1,
      );
      helmetMat.color.set(p.color || "#37f0d0");
      const pulse = 0.5 + 0.5 * Math.sin(t * 8);
      if (p.shield) {
        helmetMat.emissive.set("#6fb7ff");
        helmetMat.emissiveIntensity = 0.35 + 0.65 * pulse;
        visorMat.color
          .set(visorBase)
          .lerp(_c.set("#6fb7ff"), 0.4 + 0.5 * pulse);
      } else {
        helmetMat.emissive.set("#000000");
        helmetMat.emissiveIntensity = 1;
        visorMat.color.set(visorBase);
      }
      bootMat.color.set(p.kick ? "#c07a3a" : "#0d3f78");
      bodyMat.color.set("#f4f7ff");
      if (p.passing) bodyMat.color.lerp(_c.set("#77ff99"), 0.38);
    } else player.visible = false;

    let ei = 0;
    const ens = world.enemies || [];
    for (let i = 0; i < ens.length && ei < POOL_CAPS.enemies; i++) {
      const e = ens[i];
      if (e.dead) continue;
      const s = enemies[ei++];
      s.visible = !(e.invuln && Math.floor(t * 12) % 2 === 1);
      const kk = GEO["e_" + e.type] ? "e_" + e.type : "e_walker";
      if (s.userData.k !== kk) {
        s.userData.k = kk;
        s.geometry = GEO[kk];
        s.material = MATE[kk];
        const d = s.children;
        for (let j = 0; j < 2; j++) {
          d[j].geometry = GD[kk][j];
          d[j].material = MD[kk][j];
          d[j].position.set(GT[kk][j][0], GT[kk][j][1], GT[kk][j][2]);
          d[j].rotation.set(GR[kk][j][0], GR[kk][j][1], GR[kk][j][2]);
        }
        d[2].geometry = GF[kk];
        d[2].material = eyeFor(kk.slice(2));
        d[2].position.set(EYT[kk][0], EYT[kk][1], EYT[kk][2]);
        d[2].rotation.set(EYR[kk][0], EYR[kk][1], EYR[kk][2]);
      }
      const bb = BOB[kk];
      s.position.set(
        e.x - W2,
        EH[kk] + bb[0] * Math.sin(t * bb[1] + (e.home ? e.home.x * 0.7 : 0)),
        e.y - D2,
      );
      /* identity §4: boomerang spin overrides facing yaw; stationary
         breathes 1+.04sin(3t); walker feet stomp alternately; rocket flame
         swaps on the 10Hz parity. All render-side, zero-alloc. */
      if (kk === "e_boomerang") s.rotation.y = (t * 10) % (Math.PI * 2);
      else s.rotation.y = Math.atan2(e.dir ? e.dir.x : 0, e.dir ? e.dir.y : 1);
      s.scale.setScalar(kk === "e_stationary" ? 1 + 0.04 * Math.sin(t * 3) : 1);
      if (kk === "e_walker") {
        const st = Math.sin(t * 12),
          fr = PROTO.walker.r * 0.16;
        s.children[0].position.y = GT.e_walker[0][1] + Math.max(0, st) * fr;
        s.children[1].position.y = GT.e_walker[1][1] + Math.max(0, -st) * fr;
      } else if (kk === "e_rocket")
        s.children[1].material = Math.floor(t * 10) % 2 ? FLAME_B : FLAME_A;
    }
    for (; ei < POOL_CAPS.enemies; ei++) enemies[ei].visible = false;

    let bi = 0;
    const bs = world.bombs || [];
    for (let i = 0; i < bs.length && bi < POOL_CAPS.bombs; i++) {
      const b = bs[i];
      const s = bombs[bi++];
      s.visible = true;
      s.position.set(b.x - W2, 1, b.y - D2);
      const fuse =
        1 - Math.max(0, b.timer) / (world.fuse == null ? CFG.FUSE : world.fuse);
      const sw = Math.sin(t * 18) * fuse,
        k = 1 + 0.1 * sw;
      s.scale.set(k, k * (1 - 0.06 * sw), k); // squash-stretch pulse
      const vk = RINGM["b_" + b.variant] ? "b_" + b.variant : "b_normal";
      if (s.userData.v !== vk) {
        s.userData.v = vk;
        const rg = s.children[3];
        if (vk === "b_normal") rg.visible = false;
        else {
          rg.visible = true;
          rg.material = RINGM[vk];
        }
      }
      s.children[2].material = Math.floor(t * 14) % 2 ? SPARK_B : SPARK_A;
      s.children[2].scale.setScalar(1 + Math.sin(t * 30) * 0.23);
    }
    for (; bi < POOL_CAPS.bombs; bi++) bombs[bi].visible = false;

    let ii = 0;
    const its = world.items || [];
    for (let i = 0; i < its.length && ii < POOL_CAPS.items; i++) {
      const it = its[i];
      if (it.taken || it.buried) continue;
      const s = items[ii++];
      s.visible = true;
      s.position.set(it.x - W2, 0, it.y - D2);
      const pk = s.children[0],
        rg = s.children[1];
      pk.position.y = CFG.TILE * 0.66 + 5 * Math.sin(3 * t);
      pk.rotation.y = 2.6 * t + ii * 0.9;
      const pg = ITEM_GEO[it.t] || ITEM_GEO.fire;
      if (pk.geometry !== pg) pk.geometry = pg;
      const pm = matForItem(it.t, it.col);
      if (pk.material !== pm) pk.material = pm;
      const rm = ringForItem(it.t, it.col);
      if (rg.material !== rm) rg.material = rm;
      rm.opacity = 0.3 + 0.22 * Math.sin(5 * t);
      const rs = 1 + 0.08 * Math.sin(5 * t);
      rg.scale.set(rs, rs, rs);
    }
    for (; ii < POOL_CAPS.items; ii++) items[ii].visible = false;

    let n = 0,
      maxSc = 0;
    const bls = world.blades || [];
    for (let i = 0; i < bls.length; i++) {
      const bl = bls[i],
        tls = bl.tiles;
      if (!tls) continue;
      const sc = Math.max(0.001, 1 - bl.t / (bl.ttl || 1));
      if (sc > maxSc) maxSc = sc;
      const pop = 1 + 0.6 * Math.max(0, 1 - bl.t / ((bl.ttl || 1) * 0.15));
      for (let j = 0; j < tls.length && n < POOL_CAPS.blades; j++) {
        const tl = tls[j];
        _p.set(
          tl.tx * CFG.TILE + CFG.TILE / 2 - W2,
          5,
          tl.ty * CFG.TILE + CFG.TILE / 2 - D2,
        );
        _s.setScalar(sc);
        _m.compose(_p, _q, _s);
        blades.setMatrixAt(n, _m);
        const age = Math.min(1, bl.t / (bl.ttl || 1));
        if (age < 0.5) _c.copy(BL_W).lerp(BL_A, age * 2);
        else _c.copy(BL_A).lerp(BL_R, (age - 0.5) * 2);
        blades.setColorAt(n, _c);
        _s.setScalar(sc * 0.55 * pop);
        _m.compose(_p, _q, _s);
        cores.setMatrixAt(n, _m);
        n++;
      }
    }
    blades.count = n;
    blades.instanceMatrix.needsUpdate = true;
    if (blades.instanceColor) blades.instanceColor.needsUpdate = true;
    cores.count = n;
    cores.instanceMatrix.needsUpdate = true;
    /* flame-cross opacity: sc*(.55+.45*sin24t) freshness flicker; ember off */
    bladeMat.opacity =
      n > 0 ? Math.max(0, maxSc * (0.55 + 0.45 * Math.sin(t * 24))) : 0;
    /* flash lights: ride the first FLASH_CAP blasts, brightness =
       remaining life; overflow blasts share nothing (pool capped). */
    for (let i = 0; i < FLASH_CAP; i++) {
      const L = flashes[i],
        bl = bls[i];
      if (bl && bl.tiles && bl.tiles.length) {
        L.intensity = 2.4 * Math.max(0, Math.min(1, 1 - bl.t / (bl.ttl || 1)));
        L.position.set(bl.x - W2, 26, bl.y - D2);
      } else L.intensity = 0;
    }
  }

  update({
    players: [],
    enemies: [],
    bombs: [],
    items: [],
    blades: [],
    time: 0,
  });
  return {
    group,
    player,
    enemies,
    bombs,
    items,
    blades,
    cores,
    flashes,
    update,
  };
}
