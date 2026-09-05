import { atlasSources } from "../src/render/three/textures.js";
import {
  createPools,
  SLOT_MESH,
  ENEMY_TYPES,
  ITEM_GEO,
} from "../src/render/three/entities.js";
import * as entMod from "../src/render/three/entities.js";
import { readFileSync } from "node:fs";
import { buildScene, countDrawCalls } from "../src/render/three/scene.js";
import { createRenderer3D } from "../src/render/three/wrapper.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { CFG, BIOMES } from "../src/core/config.js";
import { POWER } from "../src/core/entities.js";
import { drawIcon } from "../src/render/sprites.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") +
      name +
      (detail !== undefined ? " -> " + detail : ""),
  );
}

function roundArg(v) {
  return typeof v === "number" ? Math.round(v * 100) / 100 : v;
}
function recFactory() {
  const canvases = [];
  const mk = () => {
    const ops = [];
    const cv = { style: {}, _ops: ops };
    let wd = 0,
      ht = 0;
    Object.defineProperty(cv, "width", {
      get: () => wd,
      set: (v) => {
        wd = v;
        ops.push("size:" + v);
      },
    });
    Object.defineProperty(cv, "height", {
      get: () => ht,
      set: (v) => {
        ht = v;
        ops.push("sizeH:" + v);
      },
    });
    const ctx = new Proxy(
      {},
      {
        get: (t, p) => {
          if (typeof p === "symbol") return undefined;
          if (p === "createLinearGradient" || p === "createRadialGradient")
            return (...a) => {
              ops.push([String(p), a.map(roundArg)]);
              return {
                addColorStop: (...s) =>
                  ops.push(["addColorStop", s.map(roundArg)]),
              };
            };
          return (...a) => {
            ops.push([String(p), a.map(roundArg)]);
          };
        },
        set: (t, p, v) => {
          if (typeof p !== "symbol")
            ops.push(["set:" + String(p), [roundArg(v)]]);
          return true;
        },
      },
    );
    cv.getContext = () => ctx;
    canvases.push(cv);
    return cv;
  };
  return { mk, canvases };
}
function recCtx() {
  const ops = [];
  const ctx = new Proxy(
    {},
    {
      get: (t, p) => {
        if (typeof p === "symbol") return undefined;
        return (...a) => {
          ops.push(String(p));
        };
      },
      set: (t, p, v) => {
        if (typeof p !== "symbol") ops.push("set:" + String(p));
        return true;
      },
    },
  );
  return { ctx, ops };
}
function cmdBag(ops) {
  const bag = {};
  for (const o of ops) {
    const k = Array.isArray(o) ? o[0] : o;
    if (typeof k === "string") bag[k] = (bag[k] || 0) + 1;
  }
  return bag;
}
const FACE_KEYS = [
  "quadraticCurveTo",
  "bezierCurveTo",
  "arc",
  "fillRect",
  "arcTo",
  "lineTo",
  "closePath",
];
function coversFace(face, icon) {
  return FACE_KEYS.every((k) => (face[k] || 0) >= (icon[k] || 0));
}
function mkE(type, x, y) {
  return {
    type,
    x,
    y,
    tx: Math.floor(x / CFG.TILE),
    ty: Math.floor(y / CFG.TILE),
    dir: { x: 0, y: 1 },
    speed: 1,
    color: "#ffffff",
    r: CFG.TILE * 0.34,
    pass: false,
    dead: false,
    invuln: false,
    invulnT: 0,
    cd: 4,
    home: { x: 1, y: 1 },
  };
}

{
  check(
    "SLOT_MESH.item stays 2 (body + ring)",
    SLOT_MESH.item === 2,
    JSON.stringify(SLOT_MESH),
  );
  const f = recFactory();
  const src = atlasSources(f.mk);
  const sigs = {};
  let coverOk = true,
    coverDet = [];
  for (const pd of POWER) {
    const icon = recCtx();
    drawIcon(icon.ctx, pd.t, pd.col, 0);
    const cv = src["item_" + pd.t];
    if (!cv || cv.width !== 64 || cv.height !== 64) {
      coverOk = false;
      coverDet.push(pd.t + ":missing");
      continue;
    }
    if (!coversFace(cmdBag(cv._ops), cmdBag(icon.ops))) {
      coverOk = false;
      coverDet.push(pd.t);
    }
    sigs[pd.t] = JSON.stringify(cv._ops);
  }
  check(
    "12 item_* 3D faces cover drawIcon path commands",
    coverOk && POWER.length === 12,
    coverDet.join(" ") || "ok",
  );
  let distinct = true;
  const ids = POWER.map((d) => d.t);
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      if (sigs[ids[i]] === sigs[ids[j]]) distinct = false;
  check("12 item_* 3D face signatures are distinct", distinct);
}

{
  const wf = createWorld(77, 1);
  loadLevel(wf, 1, false);
  wf.enemies = [];
  wf.items = [];
  for (let i = 0; i < 16; i++) wf.enemies.push(mkE("walker", 60 + i * 30, 80));
  for (let i = 0; i < 32; i++)
    wf.items.push({
      x: 60 + i * 15,
      y: 120,
      t: "fire",
      col: "#ff8a3c",
      taken: false,
      pdef: null,
    });
  const nb = Math.min(CFG.MAX_BOMBS, 8);
  for (let i = 0; i < nb; i++)
    wf.bombs.push({
      x: 60 + i * 40,
      y: 160,
      tx: i,
      ty: 2,
      timer: CFG.FUSE,
      variant: "normal",
    });
  wf.blades = [{ x: 200, y: 120, tiles: [{ tx: 5, ty: 3 }], t: 0, ttl: CFG.BLADE_TTL }];
  const r = createRenderer3D(null, null, { audio: null, hud: null });
  let calls = -1;
  try {
    r.render(wf, 1 / 60);
    calls = countDrawCalls(r._dbg.scene);
  } catch (e) {
    console.log(e.message);
  }
  const want =
    5 + /* plane + checker + wall + brick + one cabinet rim */
    SLOT_MESH.player +
    16 * SLOT_MESH.enemy +
    nb * SLOT_MESH.bomb +
    POWER.length * SLOT_MESH.item +
    2 +
    1;
  check(
    "fat-world draw calls stay 143",
    calls === want && want === 143 && calls <= 500,
    String(calls),
  );
  const im = [];
  try {
    r._dbg.scene.traverse((o) => {
      if (o.isInstancedMesh && o.userData.tag === "item") im.push(o);
    });
  } catch (e) {}
  const fire = im.find(
    (o) => o.userData.kind === "fire" && o.geometry.type === "LatheGeometry",
  );
  check(
    "item draws are 12 kinds × body+ring InstancedMesh",
    im.length === 24,
    String(im.length),
  );
  check(
    "N FLAME = 1 draw",
    !!fire && fire.count === 32,
    fire ? String(fire.count) : "missing",
  );
  const pools = createPools(BIOMES[0], null);
  check(
    "headless item slot is InstancedMesh body + ring (no Group pool)",
    SLOT_MESH.item === 2
      && !!pools.itemBodies
      && !!pools.itemRingIM
      && !pools.items
      && pools.itemBodies.fire.isInstancedMesh
      && pools.itemRingIM.fire.isInstancedMesh,
    pools.items ? "ghost items[] still allocated" : "ok",
  );
  const mix = POWER.map((pd, i) => ({
    x: 60 + i * 15,
    y: 120,
    t: pd.t,
    col: pd.col,
    taken: false,
    pdef: null,
  }));
  pools.update({
    players: [],
    enemies: [],
    bombs: [],
    items: mix,
    blades: [],
    time: 0,
  });
  const uuids = POWER.map((pd) => pools.itemBodies?.[pd.t]?.geometry?.uuid);
  check(
    "12 pickup body geos are unique (not one shared cube)",
    uuids.every(Boolean) && new Set(uuids).size === 12,
    uuids.join(" ").slice(0, 80),
  );
  const fireGeo = pools.itemBodies?.fire?.geometry;
  const fireMat = pools.itemBodies?.fire?.material;
  check(
    "headless fire body is not a leftover cube",
    !!fireGeo
      && fireGeo.type !== "BoxGeometry"
      && fireMat
      && "#" + fireMat.color.getHexString() === "#ff8a3c",
    fireGeo ? fireGeo.type : "missing",
  );
  buildScene(wf);
}

{
  const missing = [];
  for (const t of ENEMY_TYPES) {
    const r = entMod.ENEMY_3D && entMod.ENEMY_3D[t];
    if (
      !r ||
      !r.geo ||
      !r.mat ||
      !r.details ||
      r.details.length !== 2 ||
      !r.face ||
      !r.bob ||
      r.bob.length !== 2 ||
      !Number.isFinite(r.h)
    )
      missing.push(t);
  }
  check(
    "ENEMY_3D has one row per type (geo, mat, details, face, bob)",
    missing.length === 0 && ENEMY_TYPES.length === 9,
    missing.join(" ") || "ok",
  );
  check(
    "ITEM_GEO has a row per POWER kind",
    POWER.every((pd) => ITEM_GEO[pd.t] && ITEM_GEO[pd.t].isBufferGeometry),
    POWER.filter((pd) => !ITEM_GEO[pd.t]).map((pd) => pd.t).join(" ") || "ok",
  );
  const entSrc = readFileSync("src/render/three/entities.js", "utf8");
  let geoSrc = "";
  try {
    geoSrc = readFileSync("src/render/three/geos.js", "utf8");
  } catch (_) {}
  const src = entSrc + geoSrc;
  check(
    "item geos are ITEM_MAKE table, not itemGeoFor if-else",
    !/function itemGeoFor/.test(src) && /ITEM_MAKE/.test(src),
  );
  check(
    "crossedQuads calls mergeGeos (no copied merge)",
    /function crossedQuads[\s\S]{0,250}mergeGeos\(/.test(src) &&
      !/function crossedQuads[\s\S]{0,800}setAttribute\(\s*"position"/.test(
        src,
      ),
  );
}

{
  const pairs = {};
  for (const pd of POWER) {
    const pos = ITEM_GEO[pd.t].attributes.position;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, maxR = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
      const rr = Math.sqrt(x * x + z * z);
      if (rr > maxR) maxR = rr;
    }
    pairs[pd.t] =
      Math.round(((x1 - x0) / (z1 - z0)) * 10) / 10 + "/" + Math.round(maxR);
  }
  check(
    "plan-view footprints are pairwise distinct (w/d, maxR)",
    new Set(Object.values(pairs)).size === 12,
    POWER.map((pd) => pd.t + " " + pairs[pd.t]).join("  "),
  );
  const LATHE = ["fire", "bomb", "speed", "shield"];
  const wrong = POWER.filter((pd) =>
    LATHE.includes(pd.t)
      ? ITEM_GEO[pd.t].type !== "LatheGeometry"
      : ITEM_GEO[pd.t].type !== "BufferGeometry",
  ).map((pd) => pd.t + ":" + ITEM_GEO[pd.t].type);
  check(
    "build split: fire/bomb/speed/shield lathe, the other eight merged",
    !wrong.length,
    wrong.join(" ") || "ok",
  );
  const roundy = POWER.filter((pd) =>
    /Cone|Cylinder|Sphere|Torus|Octahedron|Box/.test(ITEM_GEO[pd.t].type),
  ).map((pd) => pd.t);
  check(
    "no pickup is a solid of revolution or a leftover primitive",
    !roundy.length,
    roundy.join(" ") || "ok",
  );
  const wrongUp = POWER.filter((pd) => !LATHE.includes(pd.t)).filter((pd) => {
    const nor = ITEM_GEO[pd.t].attributes.normal;
    let up = 0;
    for (let i = 0; i < nor.count; i++) if (nor.getY(i) > 0.9) up++;
    return up === 0;
  }).map((pd) => pd.t);
  check(
    "every flat body has upward-facing cap normals",
    !wrongUp.length,
    wrongUp.join(" ") || "ok",
  );
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
