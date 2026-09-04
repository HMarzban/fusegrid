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
/* merge N BufferGeometries into ONE draw call (crossedQuads precedent).
   The whole enemy-body budget rides on this: nine silhouettes have to fit
   the fixed 4-mesh slot contract, so parts are pre-transformed and fused
   here instead of added as children. Inputs may be indexed or not —
   ExtrudeGeometry emits no index, so one is synthesised. */
export function mergeGeos(...gs) {
  const g = new THREE.BufferGeometry(),
    pos = [],
    nor = [],
    uvs = [],
    idx = [];
  let base = 0;
  for (const a of gs) {
    const n = a.attributes.position.count;
    pos.push(...Array.from(a.attributes.position.array));
    nor.push(...Array.from(a.attributes.normal.array));
    uvs.push(...Array.from(a.attributes.uv.array));
    if (a.index) for (const v of a.index.array) idx.push(v + base);
    else for (let i = 0; i < n; i++) idx.push(base + i);
    base += n;
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}
/* lathe(pts,seg,r): revolve a profile authored in r-units as [radius, y].
   Points MUST run bottom -> top; reversed, three emits inward normals and
   the body renders as a hole. A radius that flares then narrows is how a
   brow band or a warning band is built — the overhang catches the frozen
   warm key and shades whatever sits below it, which is the one trick that
   lets a single-material hull carry a two-tone detail. */
function lathe(pts, seg, r) {
  return new THREE.LatheGeometry(
    pts.map((p) => new THREE.Vector2(Math.max(1e-4, p[0] * r), p[1] * r)),
    seg,
  );
}
/* plate(pts,thick,r): a THREE.Shape extruded to thick and centred on its own
   Z so callers can rotate it into place. Same authoring language as the 2D
   poly() contours in enemybody.js, which is why the delta wing and the tail
   fins can be lifted straight across. */
function plate(pts, thick, r) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0] * r, pts[0][1] * r);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0] * r, pts[i][1] * r);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thick * r,
    bevelEnabled: false,
  });
  g.translate(0, 0, (-thick * r) / 2);
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
/* The nine bodies (enemy-3d-bodies 2026-09-04). Translated silhouette-first
   from the 2D characters in enemybody.js, for the FROZEN rig only: az 0,
   el 0.54 = 59.1 deg above the horizon. Past 45 deg the camera reads more
   top than side, so the PLAN-VIEW FOOTPRINT is the primary cue and nine
   distinguishable footprints beat nine distinguishable profiles. Detail
   below the waist is spent on grounding and shadow shape, not on being seen.

   Each slot stays four meshes — hull + two ref-swapped details + face plane —
   because the frozen light rig already performs three of the 2D shading
   beats: the sole-caster warm key is the contact shade, its angle is the
   upper-left sheen, and Phong specular is the highlight. The details carry
   what light cannot: the dark contour and the glow. Channel order is PER
   TYPE, not global — stationary puts its magenta lens on detail A because
   S2.F/S4.A pin the Basic core to children[0], and walker splits into
   mirrored left/right halves so the alternating stomp still has two
   transforms to drive. */
{
  const r = PROTO.walker.r;
  /* Domed grunt. The bell profile flares to r*.94 then steps back to r*.72:
     that overhang IS the brow band, and it shades the eye strip beneath it. */
  const side = (s) => {
    const boot = new THREE.BoxGeometry(r * 0.44, r * 0.28, r * 0.62);
    boot.translate(s * r * 0.46, -r * 0.86, r * 0.3);
    const pad = new THREE.BoxGeometry(r * 0.4, r * 0.26, r * 0.72);
    pad.rotateZ(s * 0.24);
    pad.translate(s * r * 0.84, -r * 0.1, 0);
    return sharedGeo(mergeGeos(boot, pad));
  };
  putEnemy("walker", {
    geo: sharedGeo(
      lathe(
        [[0.58, -1], [0.88, -0.8], [0.9, -0.16], [0.86, 0.3], [0.94, 0.44],
          [0.72, 0.56], [0.56, 0.84], [0.001, 1.02]],
        14,
        r,
      ),
    ),
    mat: phongMat(PROTO.walker.color, 60),
    h: r,
    details: [
      { geo: side(-1), mat: DARK, pos: [0, 0, 0], rot: [0, 0, 0] },
      { geo: side(1), mat: DARK, pos: [0, 0, 0], rot: [0, 0, 0] },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 1.3, r * 0.6)),
      pos: [0, r * 0.16, r * 0.92],
      rot: [-0.3, 0, 0],
    },
    bob: [1.8, 12],
  });
}
{
  const r = PROTO.stationary.r;
  /* Bunker turret. A 4-gon frustum rotated so a FLAT face aims +Z, wider at
     the base than the top so it reads bolted down, and legless. The
     embrasure box brings that face out to r*1.14 at slit height, which is
     what keeps the pinned EYT z of r*1.16 sitting ON the hull instead of
     floating in front of it. */
  const cell = new THREE.CylinderGeometry(r * 1.244, r * 1.626, r * 2.3, 4, 1);
  cell.rotateY(Math.PI / 4);
  const emb = new THREE.BoxGeometry(r * 1.3, r * 0.5, r * 0.4);
  emb.translate(0, r * 0.34, r * 0.94);
  const coreM = sharedMat(
    new THREE.MeshBasicMaterial({ color: PROTO.stationary.color }),
  );
  const hoodM = sharedMat(new THREE.MeshLambertMaterial({ color: "#150a1c" }));
  const hex = new THREE.CylinderGeometry(r * 0.4, r * 0.4, r * 0.16, 6);
  hex.rotateX(Math.PI / 2);
  hex.translate(0, -r * 0.05, r * 0.98);
  const core = new THREE.CylinderGeometry(r * 0.17, r * 0.17, r * 0.1, 8);
  core.rotateX(Math.PI / 2);
  core.translate(0, -r * 0.05, r * 1.06);
  const barrel = new THREE.CylinderGeometry(r * 0.17, r * 0.21, r * 0.8, 8);
  barrel.rotateX(0.95);
  barrel.translate(0, r * 1.24, r * 0.26);
  const riv = [];
  for (const rx of [-0.62, -0.22, 0.22, 0.62]) {
    const c = new THREE.CylinderGeometry(r * 0.1, r * 0.1, r * 0.07, 6);
    c.rotateX(Math.PI / 2);
    c.translate(r * rx, -r * 0.72, r * 1.11);
    riv.push(c);
  }
  const skirt = new THREE.CylinderGeometry(r * 1.7, r * 1.72, r * 0.22, 4);
  skirt.rotateY(Math.PI / 4);
  skirt.translate(0, -r * 1.02, 0);
  putEnemy("stationary", {
    geo: sharedGeo(mergeGeos(cell, emb)),
    mat: lambertMat("#2a1030"),
    h: r * 1.15,
    details: [
      {
        geo: sharedGeo(mergeGeos(hex, core)),
        mat: coreM,
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      },
      {
        geo: sharedGeo(mergeGeos(barrel, ...riv, skirt)),
        mat: hoodM,
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 1.2, r * 0.42)),
      pos: [0, r * 0.34, r * 1.16],
      rot: [0, 0, 0],
    },
    bob: [1.5, 3],
  });
}
{
  const r = PROTO.fast.r;
  /* Delta wing — the only straight-edged footprint on the board. Authored in
     the 2D plan with -y forward, then rotateX(-pi/2) lays it flat with the
     nose at +Z. Two stacked extrusions give the plate plus a raised spine. */
  const DELTA = [[0, -0.92], [0.38, -0.16], [0.76, 0.3], [0.5, 0.44],
    [0, 0.26], [-0.5, 0.44], [-0.76, 0.3], [-0.38, -0.16]];
  const SPINE = [[0, -0.9], [0.2, -0.2], [0.34, 0.24], [0, 0.14],
    [-0.34, 0.24], [-0.2, -0.2]];
  const wing = plate(DELTA, 0.3, r);
  wing.rotateX(-Math.PI / 2);
  const spine = plate(SPINE, 0.22, r);
  spine.rotateX(-Math.PI / 2);
  spine.translate(0, r * 0.3, 0);
  const fin = (s) => {
    const f = plate([[0, 0], [0.62, 0], [0.58, 0.48], [0.26, 0.3]], 0.1, r);
    f.rotateY(Math.PI / 2);
    f.translate(s * r * 0.6, r * 0.14, r * 0.1);
    return f;
  };
  const lens = new THREE.SphereGeometry(r * 0.22, 10, 6);
  lens.scale(1, 0.5, 1.6);
  lens.translate(0, r * 0.36, r * 0.44);
  const chev = [];
  for (let i = 0; i < 3; i++) {
    const w = 0.62 - i * 0.14;
    const c = plate([[-w, 0.12], [0, -0.1], [w, 0.12], [0, 0.02]], 0.05, r);
    c.rotateX(-Math.PI / 2);
    c.translate(0, r * 0.16, -r * (0.66 + i * 0.3));
    chev.push(c);
  }
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
    geo: sharedGeo(mergeGeos(wing, spine)),
    mat: phongMat(PROTO.fast.color, 60),
    h: r * 0.3,
    details: [
      {
        geo: sharedGeo(mergeGeos(fin(-1), fin(1), lens)),
        mat: DARK,
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      },
      {
        geo: sharedGeo(mergeGeos(...chev)),
        mat: trailM,
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 0.9, r * 0.4)),
      pos: [0, r * 0.38, r * 0.5],
      rot: [-0.6, 0, 0],
    },
    bob: [1.0, 16],
  });
}
{
  const r = PROTO.chaser.r,
    h = r * 1.25;
  /* Leaning hunter. Broad chest at +Z tapering to a tail cone at -Z, the
     whole hull tilted 0.2 rad so the crown overhangs the base toward travel:
     from the rig the lean itself points at you. Detail A is the dorsal ridge
     (raked crest + down-angled brow), B the skids that ground it. */
  const chest = new THREE.SphereGeometry(r, 14, 10);
  chest.scale(0.74, 1.26, 0.9);
  const tail = new THREE.ConeGeometry(r * 0.5, r * 0.95, 10);
  tail.rotateX(-Math.PI / 2);
  tail.translate(0, 0, -r * 0.85);
  const hull = mergeGeos(chest, tail);
  hull.rotateX(0.2);
  const crest = new THREE.ConeGeometry(r * 0.5, r * 0.95, 4);
  crest.scale(0.3, 1, 1.35);
  crest.rotateX(-0.35);
  crest.translate(0, r * 0.86, -r * 0.1);
  const brow = new THREE.BoxGeometry(r * 0.96, r * 0.16, r * 0.3);
  brow.rotateX(0.5);
  brow.translate(0, r * 0.3, r * 0.74);
  const skid = (s) => {
    const g = new THREE.BoxGeometry(r * 0.24, r * 0.16, r * 1.05);
    g.translate(s * r * 0.46, -r * 1.16, -r * 0.05);
    return g;
  };
  putEnemy("chaser", {
    geo: sharedGeo(hull),
    mat: phongMat(PROTO.chaser.color, 60),
    h,
    details: [
      {
        geo: sharedGeo(mergeGeos(crest, brow)),
        mat: DARK,
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      },
      {
        geo: sharedGeo(mergeGeos(skid(-1), skid(1))),
        mat: DARK,
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 1.1, r * 0.5)),
      pos: [0, -r * 0.05, r * 0.95],
      rot: [-0.25, 0, 0],
    },
    bob: [1.2, 9],
  });
}
{
  const r = PROTO.boomerang.r,
    h = r * 0.55;
  /* Spinning cloak ring. The flat C-torus keeps its 4.7 arc — the open gap
     IS the silhouette, the only non-convex footprint in the cast — and turns
     TRANSLUCENT so the floor shows through, which is what "phases bricks"
     looks like. Detail A is the torn hem and spins with the slot; detail B
     is the hub bezel, and the socket eye lies FLAT and counter-spins (see
     update) so it stares straight up while the cloak turns around it. */
  const ring = new THREE.TorusGeometry(r * 0.72, r * 0.19, 8, 26, 4.7);
  ring.rotateX(-Math.PI / 2);
  const tat = [];
  const AZ = [0.5, 2.1, 3.6],
    LN = [0.44, 0.3, 0.56];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.ConeGeometry(r * 0.17, r * LN[i], 3);
    c.rotateZ(-Math.PI / 2);
    c.rotateY(-AZ[i]);
    c.translate(Math.cos(AZ[i]) * r * 0.78, 0, Math.sin(AZ[i]) * r * 0.78);
    tat.push(c);
  }
  const bez = new THREE.TorusGeometry(r * 0.34, r * 0.06, 6, 16);
  bez.rotateX(-Math.PI / 2);
  const hemM = sharedMat(
    new THREE.MeshLambertMaterial({
      color: PROTO.boomerang.color,
      transparent: true,
      opacity: 0.82,
    }),
  );
  const bezM = sharedMat(new THREE.MeshBasicMaterial({ color: "#ffd9f0" }));
  putEnemy("boomerang", {
    geo: sharedGeo(ring),
    mat: sharedMat(
      new THREE.MeshLambertMaterial({
        color: PROTO.boomerang.color,
        transparent: true,
        opacity: 0.72,
      }),
    ),
    h,
    details: [
      {
        geo: sharedGeo(mergeGeos(...tat)),
        mat: hemM,
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      },
      { geo: sharedGeo(bez), mat: bezM, pos: [0, 0, 0], rot: [0, 0, 0] },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 0.52, r * 0.26)),
      pos: [0, r * 0.16, 0],
      rot: [-Math.PI / 2, 0, 0],
    },
    bob: [2.0, 10],
  });
}
{
  const r = PROTO.rocket.r,
    h = r * 1.45;
  /* Warhead. An ogive lathe whose profile steps out to r*.52 and back for
     the warning band, HOVERING r*.2 off the floor so the exhaust has
     somewhere to go — the only foe that never touches the boards, which is
     also what pass:true means. Detail A is three swept tail fins at 120 deg
     (a star footprint from above); detail B is the exhaust — outer cone, hot
     core and a floor scorch disc, all on the flame material so the 10 Hz
     swap still reads two-tone. */
  const finM = sharedMat(new THREE.MeshLambertMaterial({ color: "#7a3a26" }));
  const fins = [];
  for (let i = 0; i < 3; i++) {
    const f = plate([[0, 0.7], [0.58, 0.06], [0.58, -0.3], [0, -0.3]], 0.1, r);
    f.translate(r * 0.4, -r * 0.66, 0);
    f.rotateY((i * Math.PI * 2) / 3);
    fins.push(f);
  }
  const ex = new THREE.ConeGeometry(r * 0.34, r * 0.2, 10);
  ex.rotateX(Math.PI);
  ex.translate(0, -r * 1.34, 0);
  const hot = new THREE.ConeGeometry(r * 0.18, r * 0.2, 8);
  hot.rotateX(Math.PI);
  hot.translate(0, -r * 1.34, 0);
  putEnemy("rocket", {
    geo: sharedGeo(
      lathe(
        [[0.001, -1.25], [0.3, -1.18], [0.44, -0.98], [0.44, -0.18],
          [0.52, -0.1], [0.52, 0.06], [0.44, 0.14], [0.44, 0.42],
          [0.36, 0.76], [0.22, 1.04], [0.001, 1.25]],
        12,
        r,
      ),
    ),
    mat: lambertMat(PROTO.rocket.color),
    h,
    details: [
      {
        geo: sharedGeo(mergeGeos(...fins)),
        mat: finM,
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      },
      {
        geo: sharedGeo(mergeGeos(ex, hot)),
        mat: FLAME_A,
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 0.62, r * 0.3)),
      pos: [0, r * 0.1, r * 0.5],
      rot: [-0.1, 0, 0],
    },
    bob: [1.4, 7],
  });
}
{
  const r = PROTO.burrow.r,
    h = r * 0.57;
  /* Segmented grub. Three carapace plates merged along Z, largest forward,
     so the plan view carries plate seams no other foe has and the body reads
     far longer than it is tall. Detail A is the mandibles plus the carapace
     brow, B an additive sand plume trailing north. */
  const seg = (rad, sx, sy, y, z, w, hs) => {
    const g = new THREE.SphereGeometry(r * rad, w, hs);
    g.scale(sx, sy, 0.92);
    g.translate(0, r * y, r * z);
    return g;
  };
  const mand = (s) => {
    const c = new THREE.ConeGeometry(r * 0.2, r * 0.46, 3);
    c.rotateX(Math.PI / 2);
    c.rotateY(-s * 0.42);
    c.translate(s * r * 0.4, -r * 0.1, r * 1.14);
    return c;
  };
  const cbrow = new THREE.BoxGeometry(r * 1.02, r * 0.14, r * 0.3);
  cbrow.rotateX(-0.3);
  cbrow.translate(0, r * 0.3, r * 0.88);
  const puff = [];
  const PS = [0.24, 0.2, 0.15],
    PZ = [-1.4, -1.58, -1.72],
    PY = [0.2, 0.28, 0.34];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.SphereGeometry(r * PS[i], 8, 6);
    g.translate(r * (i % 2 ? 0.12 : -0.1), r * PY[i], r * PZ[i]);
    puff.push(g);
  }
  const plumeM = sharedMat(
    new THREE.MeshBasicMaterial({
      color: "#e8c48a",
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  putEnemy("burrow", {
    geo: sharedGeo(
      mergeGeos(
        seg(0.86, 0.9, 0.66, 0.02, 0.52, 14, 8),
        seg(0.74, 0.94, 0.62, -0.04, -0.3, 12, 8),
        seg(0.56, 0.96, 0.56, -0.1, -1, 12, 6),
      ),
    ),
    mat: phongMat(PROTO.burrow.color, 40),
    h,
    details: [
      {
        geo: sharedGeo(mergeGeos(mand(-1), mand(1), cbrow)),
        mat: DARK,
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      },
      {
        geo: sharedGeo(mergeGeos(...puff)),
        mat: plumeM,
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 1.05, r * 0.44)),
      pos: [0, r * 0.1, r * 1.04],
      rot: [-0.3, 0, 0],
    },
    bob: [1.1, 8],
  });
}
{
  const r = PROTO.shade.r,
    h = r * 1.44;
  /* Hooded wraith. A lathe cowl with FOUR uneven tatters at four uneven
     azimuths, floating clear of the floor — no feet, no hard bottom edge,
     nothing solid to stop. It is the only foe that casts no shadow (see
     update): detail B is an additive floor glow standing in for one, which
     is the 2D beat exactly, and detail A is the void interior the twin
     glowing eyes sit in. */
  const hood = lathe(
    [[0.001, -0.86], [0.56, -0.8], [0.8, -0.6], [0.76, -0.16], [0.58, 0.3],
      [0.32, 0.72], [0.001, 1.06]],
    12,
    r,
  );
  const tat = [];
  const AZ = [0.4, 1.9, 3.3, 5.0],
    LN = [0.4, 0.62, 0.3, 0.52];
  for (let i = 0; i < 4; i++) {
    const c = new THREE.ConeGeometry(r * 0.15, r * LN[i], 3);
    c.rotateX(Math.PI);
    c.translate(
      Math.cos(AZ[i]) * r * 0.72,
      -r * (0.72 + LN[i] / 2),
      Math.sin(AZ[i]) * r * 0.72,
    );
    tat.push(c);
  }
  const cav = new THREE.CylinderGeometry(r * 0.48, r * 0.48, r * 0.14, 12);
  cav.rotateX(Math.PI / 2);
  cav.rotateX(-0.7);
  cav.translate(0, r * 0.16, r * 0.56);
  const glow = new THREE.RingGeometry(r * 0.2, r * 0.78, 18);
  glow.rotateX(-Math.PI / 2);
  const voidM = sharedMat(new THREE.MeshLambertMaterial({ color: "#080a16" }));
  const glowM = sharedMat(
    new THREE.MeshBasicMaterial({
      color: PROTO.shade.color,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  putEnemy("shade", {
    geo: sharedGeo(mergeGeos(hood, ...tat)),
    mat: lambertMat(PROTO.shade.color),
    h,
    details: [
      { geo: sharedGeo(cav), mat: voidM, pos: [0, 0, 0], rot: [0, 0, 0] },
      {
        geo: sharedGeo(glow),
        mat: glowM,
        pos: [0, -r * 1.43, 0],
        rot: [0, 0, 0],
      },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 0.8, r * 0.38)),
      pos: [0, r * 0.3, r * 0.62],
      rot: [-0.9, 0, 0],
    },
    bob: [2.2, 6],
  });
}
{
  const r = PROTO.knight.r,
    h = r * 1.02;
  /* Crowned great-helm. A 6-gon frustum tapering DOWN to the chin with a
     flat face at +Z, three crown spikes breaking the top outline, and the
     only Phong-with-bright-specular body in the cast: that highlight is what
     separates gold knight from gold floor and gold walls in CROWN without
     touching the biome palette. Detail A is pauldrons + gorget; B the UNLIT
     pale nasal bar the eyes sit behind, pale enough to beat any gold value
     in the room whatever the light does. */
  const helm = new THREE.CylinderGeometry(r * 0.72, r * 0.55, r * 2.02, 6, 1);
  helm.rotateY(Math.PI / 6);
  const spike = (rad, sh, x, y) => {
    const c = new THREE.ConeGeometry(r * rad, r * sh, 4);
    c.translate(r * x, r * y, 0);
    return c;
  };
  const paul = (s) => {
    const g = new THREE.BoxGeometry(r * 0.44, r * 0.26, r * 0.78);
    g.rotateZ(s * 0.28);
    g.translate(s * r * 0.72, r * 0.3, 0);
    return g;
  };
  const gorget = new THREE.BoxGeometry(r * 0.86, r * 0.2, r * 0.3);
  gorget.translate(0, -r * 0.8, r * 0.4);
  const nasal = new THREE.BoxGeometry(r * 0.14, r * 0.92, r * 0.1);
  nasal.translate(0, r * 0.12, r * 0.6);
  const barM = sharedMat(new THREE.MeshBasicMaterial({ color: "#fff0c8" }));
  putEnemy("knight", {
    geo: sharedGeo(
      mergeGeos(
        helm,
        spike(0.19, 0.54, 0, 1.28),
        spike(0.15, 0.38, -0.42, 1.2),
        spike(0.15, 0.38, 0.42, 1.2),
      ),
    ),
    mat: sharedMat(
      new THREE.MeshPhongMaterial({
        color: PROTO.knight.color,
        shininess: 90,
        specular: new THREE.Color("#fff3d0"),
      }),
    ),
    h,
    details: [
      {
        geo: sharedGeo(mergeGeos(paul(-1), paul(1), gorget)),
        mat: DARK,
        pos: [0, 0, 0],
        rot: [0, 0, 0],
      },
      { geo: sharedGeo(nasal), mat: barM, pos: [0, 0, 0], rot: [0, 0, 0] },
    ],
    face: {
      geo: sharedGeo(new THREE.PlaneGeometry(r * 1.0, r * 0.44)),
      pos: [0, r * 0.16, r * 0.58],
      rot: [-0.1, 0, 0],
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
        /* shade alone casts nothing — its additive floor glow IS its ground
           contact, exactly as in 2D. Additive accents (trail, plume,
           exhaust, glow) never cast either: a hard shadow under a glow reads
           as a bug. Both ride the type edge, so the per-frame path stays
           allocation- and branch-free. */
        const cast = kk !== "e_shade";
        s.castShadow = cast;
        const d = s.children;
        for (let j = 0; j < 2; j++) {
          d[j].geometry = GD[kk][j];
          d[j].material = MD[kk][j];
          d[j].castShadow =
            cast && MD[kk][j].blending !== THREE.AdditiveBlending;
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
      if (kk === "e_boomerang") {
        s.rotation.y = (t * 10) % (Math.PI * 2);
        /* the socket eye must NOT spin (2D parity). Its plane lies flat
           (rot.x = -pi/2), so an in-plane rot.z cancels the parent yaw about
           world Y and the eye holds a fixed world orientation. */
        s.children[2].rotation.z = -s.rotation.y;
      } else
        s.rotation.y = Math.atan2(e.dir ? e.dir.x : 0, e.dir ? e.dir.y : 1);
      s.scale.setScalar(kk === "e_stationary" ? 1 + 0.04 * Math.sin(t * 3) : 1);
      if (kk === "e_walker") {
        const st = Math.sin(t * 12),
          fr = PROTO.walker.r * 0.16;
        s.children[0].position.y = GT.e_walker[0][1] + Math.max(0, st) * fr;
        s.children[1].position.y = GT.e_walker[1][1] + Math.max(0, -st) * fr;
      } else if (kk === "e_rocket")
        s.children[1].material = Math.floor(t * 10) % 2 ? FLAME_B : FLAME_A;
      else if (kk === "e_stationary")
        s.children[0].scale.setScalar(1 + 0.1 * Math.sin(t * 3));
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
