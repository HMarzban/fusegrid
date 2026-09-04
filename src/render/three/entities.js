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
  "burrow",
  "shade",
  "knight",
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
  BL_R = new THREE.Color("#ff5d73"),
  _axisY = new THREE.Vector3(0, 1, 0);

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
const ITEM_MAKE = {
  fire: () => new THREE.ConeGeometry(IT * 0.18, IT * 0.5, 7),
  bomb: () => new THREE.SphereGeometry(IT * 0.22, 12, 10),
  speed: () => new THREE.OctahedronGeometry(IT * 0.26, 0),
  heart: () => {
    const a = new THREE.SphereGeometry(IT * 0.15, 8, 6);
    a.translate(-IT * 0.09, IT * 0.06, 0);
    const b = new THREE.SphereGeometry(IT * 0.15, 8, 6);
    b.translate(IT * 0.09, IT * 0.06, 0);
    return mergeGeos(a, b);
  },
  shield: () => new THREE.CylinderGeometry(IT * 0.2, IT * 0.22, IT * 0.36, 8),
  kick: () => new THREE.BoxGeometry(IT * 0.2, IT * 0.16, IT * 0.38),
  throw: () => new THREE.SphereGeometry(IT * 0.16, 10, 8),
  pass: () => new THREE.BoxGeometry(IT * 0.38, IT * 0.14, IT * 0.28),
  line: () => {
    const g = new THREE.CylinderGeometry(IT * 0.055, IT * 0.055, IT * 0.52, 6);
    g.rotateZ(Math.PI / 2);
    return g;
  },
  power: () => new THREE.OctahedronGeometry(IT * 0.34, 0),
  pierce: () => new THREE.ConeGeometry(IT * 0.11, IT * 0.52, 5),
  remote: () => new THREE.CylinderGeometry(IT * 0.16, IT * 0.18, IT * 0.3, 10),
};
export const ITEM_GEO = {};
for (const pd of POWER) ITEM_GEO[pd.t] = sharedGeo(ITEM_MAKE[pd.t]());

/* Enemy identity: one ENEMY_3D[type] row (geo, mat, details, face, bob).
   GD/EH/EYT stay derived so the §6 ABI probes keep working. */
const DARK = sharedMat(new THREE.MeshLambertMaterial({ color: "#0a0f1a" }));
const FLAME_A = sharedMat(new THREE.MeshBasicMaterial({ color: "#ffde7a" }));
const FLAME_B = sharedMat(new THREE.MeshBasicMaterial({ color: "#ff7a3a" }));
export const GD = {},
  MD = {},
  GT = {},
  GR = {};
export const GF = {},
  EYR = {};
export const EYT = {};
const BOB = {};
export const ENEMY_3D = {};
function putEnemy(t, rec) {
  ENEMY_3D[t] = rec;
  const k = "e_" + t;
  GEO[k] = rec.geo;
  MATE[k] = rec.mat;
  EH[k] = rec.h;
  GD[k] = [rec.details[0].geo, rec.details[1].geo];
  MD[k] = [rec.details[0].mat, rec.details[1].mat];
  GT[k] = [rec.details[0].pos, rec.details[1].pos];
  GR[k] = [rec.details[0].rot, rec.details[1].rot];
  GF[k] = rec.face.geo;
  EYT[k] = rec.face.pos;
  EYR[k] = rec.face.rot;
  BOB[k] = rec.bob;
}
function phongMat(color, shininess) {
  return sharedMat(new THREE.MeshPhongMaterial({ color, shininess }));
}
function lambertMat(color) {
  return sharedMat(new THREE.MeshLambertMaterial({ color }));
}
{
  const r = PROTO.walker.r;
  const foot = sharedGeo(new THREE.BoxGeometry(r * 0.52, r * 0.26, r * 0.6));
  putEnemy("walker", {
    geo: sharedGeo(new THREE.SphereGeometry(r, 16, 12)),
    mat: phongMat(PROTO.walker.color, 60),
    h: r,
    details: [
      { geo: foot, mat: DARK, pos: [-r * 0.52, r * 0.14, r * 0.5], rot: [0, 0, 0] },
      { geo: foot, mat: DARK, pos: [r * 0.52, r * 0.14, r * 0.5], rot: [0, 0, 0] },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 1.7, r * 0.9)),
      pos: [0, r + r * 0.35, r * 0.7],
      rot: [-0.45, 0, 0],
    },
    bob: [1.8, 12],
  });
}
{
  const r = PROTO.chaser.r,
    h = r * 1.22;
  const g = new THREE.SphereGeometry(r, 16, 12);
  g.scale(0.86, 1.22, 0.86);
  putEnemy("chaser", {
    geo: sharedGeo(g),
    mat: phongMat(PROTO.chaser.color, 60),
    h,
    details: [
      { geo: sharedGeo(new THREE.BoxGeometry(r * 0.22, r * 0.85, r * 1.35)), mat: DARK, pos: [0, r * 1.22, 0], rot: [0, 0, 0] },
      { geo: sharedGeo(new THREE.BoxGeometry(r * 0.55, r * 0.26, r * 0.16)), mat: DARK, pos: [0, r * 1.15, r * 0.95], rot: [0, 0, 0] },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 1.7, r * 0.9)),
      pos: [0, h + r * 0.35, r * 0.7],
      rot: [-0.45, 0, 0],
    },
    bob: [1.2, 9],
  });
}
{
  const r = PROTO.fast.r,
    h = r * 0.8;
  const g = new THREE.SphereGeometry(r, 16, 12);
  g.scale(1.2, 0.8, 1.05);
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
  putEnemy("fast", {
    geo: sharedGeo(g),
    mat: phongMat(PROTO.fast.color, 60),
    h,
    details: [
      { geo: sharedGeo(mergeGeos(finA, finB)), mat: DARK, pos: [0, 0, 0], rot: [0, 0, 0] },
      { geo: sharedGeo(new THREE.BoxGeometry(r * 1.15, r * 0.42, r * 1.5)), mat: trailM, pos: [0, r * 0.55, -r * 1.35], rot: [0, 0, 0] },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 1.7, r * 0.9)),
      pos: [0, h + r * 0.35, r * 0.7],
      rot: [-0.45, 0, 0],
    },
    bob: [1.0, 16],
  });
}
{
  const r = PROTO.stationary.r;
  const coreM = sharedMat(new THREE.MeshBasicMaterial({ color: PROTO.stationary.color }));
  const hoodM = sharedMat(new THREE.MeshLambertMaterial({ color: "#150a1c" }));
  putEnemy("stationary", {
    geo: sharedGeo(new THREE.BoxGeometry(r * 2.3, r * 2.3, r * 2.3)),
    mat: lambertMat("#2a1030"),
    h: r * 1.15,
    details: [
      { geo: sharedGeo(new THREE.BoxGeometry(r * 1.2, r * 1.2, r * 1.2)), mat: coreM, pos: [0, r * 1.15, 0], rot: [0, 0, 0] },
      { geo: sharedGeo(new THREE.BoxGeometry(r * 1.5, r * 0.18, r * 0.3)), mat: hoodM, pos: [0, r * 1.38, r * 1.08], rot: [0, 0, 0] },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 1.5, r * 0.38)),
      pos: [0, r * 1.15, r * 1.16],
      rot: [0, 0, 0],
    },
    bob: [1.5, 3],
  });
}
{
  const r = PROTO.boomerang.r,
    h = r * 0.55;
  const g = new THREE.TorusGeometry(r * 0.72, r * 0.19, 8, 26, 4.7);
  g.rotateX(-Math.PI / 2);
  const hubM = sharedMat(new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  const beadM = sharedMat(new THREE.MeshBasicMaterial({ color: PROTO.boomerang.color }));
  putEnemy("boomerang", {
    geo: sharedGeo(g),
    mat: lambertMat(PROTO.boomerang.color),
    h,
    details: [
      { geo: sharedGeo(new THREE.SphereGeometry(r * 0.26, 10, 8)), mat: hubM, pos: [0, 0, 0], rot: [0, 0, 0] },
      { geo: sharedGeo(new THREE.SphereGeometry(r * 0.12, 8, 6)), mat: beadM, pos: [Math.cos(4.7) * r * 0.72, 0, -Math.sin(4.7) * r * 0.72], rot: [0, 0, 0] },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(CFG.TILE * 0.34, CFG.TILE * 0.16)),
      pos: [0, h + r * 0.15, r * 0.92],
      rot: [0, 0, 0],
    },
    bob: [2.0, 10],
  });
}
{
  const r = PROTO.rocket.r,
    h = r * 1.25;
  const padM = sharedMat(new THREE.MeshLambertMaterial({ color: "#3a1c10" }));
  const flameG = sharedGeo(new THREE.ConeGeometry(r * 0.34, r * 0.66, 8));
  flameG.rotateX(Math.PI);
  putEnemy("rocket", {
    geo: sharedGeo(new THREE.ConeGeometry(r * 1.02, r * 2.5, 3)),
    mat: lambertMat(PROTO.rocket.color),
    h,
    details: [
      { geo: sharedGeo(new THREE.CylinderGeometry(r * 0.8, r * 0.92, r * 0.3, 12)), mat: padM, pos: [0, r * 0.15, 0], rot: [0, 0, 0] },
      { geo: flameG, mat: FLAME_A, pos: [0, r * 0.1, 0], rot: [0, 0, 0] },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(CFG.TILE * 0.34, CFG.TILE * 0.16)),
      pos: [0, h + r * 0.15, r * 0.92],
      rot: [0, 0, 0],
    },
    bob: [1.4, 7],
  });
}
{
  const r = PROTO.burrow.r,
    h = r * 0.55;
  const g = new THREE.CylinderGeometry(r * 0.95, r * 0.82, r * 1.05, 10);
  g.rotateZ(Math.PI / 2);
  putEnemy("burrow", {
    geo: sharedGeo(g),
    mat: phongMat(PROTO.burrow.color, 40),
    h,
    details: [
      { geo: sharedGeo(new THREE.BoxGeometry(r * 0.22, r * 0.18, r * 0.55)), mat: DARK, pos: [-r * 0.55, r * 0.2, r * 0.55], rot: [0, 0.35, 0] },
      { geo: sharedGeo(new THREE.BoxGeometry(r * 0.22, r * 0.18, r * 0.55)), mat: DARK, pos: [r * 0.55, r * 0.2, r * 0.55], rot: [0, -0.35, 0] },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(CFG.TILE * 0.34, CFG.TILE * 0.16)),
      pos: [0, h + r * 0.15, r * 0.92],
      rot: [0, 0, 0],
    },
    bob: [1.1, 8],
  });
}
{
  const r = PROTO.shade.r,
    h = r * 1.05;
  const wispM = sharedMat(
    new THREE.MeshBasicMaterial({
      color: PROTO.shade.color,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  putEnemy("shade", {
    geo: sharedGeo(new THREE.OctahedronGeometry(r * 1.05, 0)),
    mat: lambertMat(PROTO.shade.color),
    h,
    details: [
      { geo: sharedGeo(new THREE.SphereGeometry(r * 0.16, 8, 6)), mat: wispM, pos: [-r * 0.85, r * 0.15, 0], rot: [0, 0, 0] },
      { geo: sharedGeo(new THREE.SphereGeometry(r * 0.12, 8, 6)), mat: wispM, pos: [r * 0.8, -r * 0.1, 0], rot: [0, 0, 0] },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(CFG.TILE * 0.34, CFG.TILE * 0.16)),
      pos: [0, h + r * 0.15, r * 0.92],
      rot: [0, 0, 0],
    },
    bob: [2.2, 6],
  });
}
{
  const r = PROTO.knight.r,
    h = r * 1.08;
  const plumeM = sharedMat(new THREE.MeshLambertMaterial({ color: "#8a6a28" }));
  putEnemy("knight", {
    geo: sharedGeo(new THREE.BoxGeometry(r * 1.55, r * 2.15, r * 1.45)),
    mat: lambertMat(PROTO.knight.color),
    h,
    details: [
      { geo: sharedGeo(new THREE.BoxGeometry(r * 0.16, r * 0.7, r * 0.12)), mat: plumeM, pos: [0, r * 1.55, 0], rot: [0, 0, 0] },
      { geo: sharedGeo(new THREE.BoxGeometry(r * 1.15, r * 0.2, r * 0.18)), mat: DARK, pos: [0, r * 0.35, r * 0.78], rot: [0, 0, 0] },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 1.7, r * 0.9)),
      pos: [0, h + r * 0.35, r * 0.7],
      rot: [-0.45, 0, 0],
    },
    bob: [1.3, 7],
  });
}

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
    bombs = [];
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
  const itemBodies = {},
    itemRingIM = {};
  for (const pd of POWER) {
    const body = new THREE.InstancedMesh(
      ITEM_GEO[pd.t],
      matForItem(pd.t, pd.col),
      POOL_CAPS.items,
    );
    body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    body.frustumCulled = false;
    body.castShadow = true;
    body.count = 0;
    body.userData.tag = "item";
    body.userData.kind = pd.t;
    itemBodies[pd.t] = body;
    group.add(body);
    const ring = new THREE.InstancedMesh(
      iringGeo,
      ringForItem(pd.t, pd.col),
      POOL_CAPS.items,
    );
    ring.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ring.frustumCulled = false;
    ring.count = 0;
    ring.userData.tag = "item";
    ring.userData.kind = pd.t;
    itemRingIM[pd.t] = ring;
    group.add(ring);
  }
  /* Blasts v2: crossed flame-gradient quads merged into ONE BufferGeometry
     per layer — outer amber cross keeps the exact prior ttl-shrink contract,
     inner white-hot core pops at spawn (overshoot easing settles by 20%
     ttl). Palette lives in the atlas.fire ramp texture. */
  function crossedQuads(sz) {
    const a = new THREE.PlaneGeometry(sz, sz),
      b = new THREE.PlaneGeometry(sz, sz);
    b.rotateY(Math.PI / 2);
    return sharedGeo(mergeGeos(a, b));
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

    const counts = {};
    for (const pd of POWER) counts[pd.t] = 0;
    let nLive = 0;
    const its = world.items || [];
    for (let i = 0; i < its.length && nLive < POOL_CAPS.items; i++) {
      const it = its[i];
      if (it.taken || it.buried) continue;
      nLive++;
      const kind = ITEM_GEO[it.t] ? it.t : "fire";
      const slot = counts[kind]++;
      const rs = 1 + 0.08 * Math.sin(5 * t);
      itemRingIM[kind].material.opacity = 0.3 + 0.22 * Math.sin(5 * t);
      _p.set(it.x - W2, CFG.TILE * 0.66 + 5 * Math.sin(3 * t), it.y - D2);
      _q.setFromAxisAngle(_axisY, 2.6 * t + slot * 0.9);
      _s.set(1, 1, 1);
      _m.compose(_p, _q, _s);
      itemBodies[kind].setMatrixAt(slot, _m);
      _p.set(it.x - W2, 1.5, it.y - D2);
      _q.identity();
      _s.set(rs, rs, rs);
      _m.compose(_p, _q, _s);
      itemRingIM[kind].setMatrixAt(slot, _m);
    }
    for (const pd of POWER) {
      const n = counts[pd.t] || 0;
      itemBodies[pd.t].count = n;
      itemBodies[pd.t].instanceMatrix.needsUpdate = true;
      itemRingIM[pd.t].count = n;
      itemRingIM[pd.t].instanceMatrix.needsUpdate = true;
    }

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
    itemBodies,
    itemRingIM,
    blades,
    cores,
    flashes,
    update,
  };
}
