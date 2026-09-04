import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { CFG } from "../src/core/config.js";
import { FOES } from "../src/core/entities.js";
import { drawEnemyBody } from "../src/render/sprites.js";
import { SLOT_MESH } from "../src/render/three/entities.js";
import { countDrawCalls } from "../src/render/three/scene.js";
import { createRenderer3D } from "../src/render/three/wrapper.js";
import * as audioMod from "../src/audio.js";
import { createAudio } from "../src/audio.js";

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

const NAMES = {
  walker: "WALKER",
  stationary: "SENTRY",
  fast: "FAST",
  chaser: "CHASER",
  boomerang: "PHANTOM",
  rocket: "ROCKET",
  burrow: "BURROW",
  shade: "SHADE",
  knight: "KNIGHT",
};
const TYPES = Object.keys(NAMES);

function stub() {
  const ops = [];
  const c = {
    _ops: ops,
    save() {
      ops.push("save");
    },
    restore() {
      ops.push("restore");
    },
    translate() {
      ops.push("translate");
    },
    scale() {
      ops.push("scale");
    },
    rotate() {
      ops.push("rotate");
    },
    beginPath() {
      ops.push("beginPath");
    },
    closePath() {
      ops.push("closePath");
    },
    moveTo() {
      ops.push("moveTo");
    },
    lineTo() {
      ops.push("lineTo");
    },
    quadraticCurveTo() {
      ops.push("quad");
    },
    bezierCurveTo() {
      ops.push("bez");
    },
    arc() {
      ops.push("arc");
    },
    arcTo() {
      ops.push("arcTo");
    },
    ellipse() {
      ops.push("ellipse");
    },
    fill() {
      ops.push("fill");
    },
    stroke() {
      ops.push("stroke");
    },
    fillRect() {
      ops.push("fillRect");
    },
  };
  return new Proxy(c, {
    set(t, p, v) {
      if (typeof p !== "symbol") t._ops.push("set:" + String(p));
      t[p] = v;
      return true;
    },
  });
}
/* Axis-aligned extent recorder. The ENEMIES well is a square of side ws
   centred on the icon and menudraw scales bodies by ws/30, so at r=14 a body
   has to stay inside +-15 local units or it paints over the cell. Only
   boomerang rotates, about the origin, which preserves max radius. */
function bounds() {
  const b = { x0: 0, x1: 0, y0: 0, y1: 0 };
  const at = (x, y) => {
    if (typeof x !== "number" || typeof y !== "number") return;
    b.x0 = Math.min(b.x0, x);
    b.x1 = Math.max(b.x1, x);
    b.y0 = Math.min(b.y0, y);
    b.y1 = Math.max(b.y1, y);
  };
  const box = (x, y, w, h) => {
    at(x, y);
    at(x + w, y + h);
  };
  return {
    _b: b,
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    beginPath() {},
    closePath() {},
    fill() {},
    stroke() {},
    moveTo: at,
    lineTo: at,
    quadraticCurveTo(x1, y1, x, y) {
      at(x1, y1);
      at(x, y);
    },
    bezierCurveTo(a1, b1, a2, b2, x, y) {
      at(a1, b1);
      at(a2, b2);
      at(x, y);
    },
    arc(x, y, rad) {
      box(x - rad, y - rad, rad * 2, rad * 2);
    },
    arcTo(x1, y1, x, y) {
      at(x1, y1);
      at(x, y);
    },
    ellipse(x, y, rx, ry) {
      box(x - rx, y - ry, rx * 2, ry * 2);
    },
    fillRect: box,
    strokeRect: box,
  };
}
function dummy(type, dir) {
  return {
    type,
    color: "#ffffff",
    r: 14,
    home: { x: 1, y: 1 },
    invuln: false,
    dir,
  };
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
  check("FOES catalog is 9", FOES.length === 9, String(FOES.length));
  const got = FOES.map((f) => f.t + ":" + f.name).join(",");
  const want = TYPES.map((t) => t + ":" + NAMES[t]).join(",");
  check(
    "FOES names are WALKER SENTRY FAST CHASER PHANTOM ROCKET BURROW SHADE KNIGHT",
    got === want,
    got,
  );
}

{
  const sigs = {};
  for (const t of TYPES) {
    const c = stub();
    drawEnemyBody(c, { time: 0 }, dummy(t));
    sigs[t] = JSON.stringify(c._ops);
    const paints = c._ops.filter(
      (o) => o === "fill" || o === "stroke" || o === "fillRect" || o === "beginPath",
    ).length;
    check("drawEnemyBody paints " + t, paints >= 3, String(paints));
  }
  let distinct = true;
  for (let i = 0; i < TYPES.length; i++)
    for (let j = i + 1; j < TYPES.length; j++)
      if (sigs[TYPES[i]] === sigs[TYPES[j]]) distinct = false;
  check("drawEnemyBody silhouettes are distinct", distinct);
  const noGround = [],
    noRim = [],
    noEye = [],
    flat = [],
    scaled = [];
  for (const t of TYPES) {
    const c = stub();
    drawEnemyBody(c, { time: 0 }, dummy(t));
    if (!c._ops.includes("ellipse")) noGround.push(t);
    if (!(c._ops.includes("set:strokeStyle") && c._ops.includes("stroke")))
      noRim.push(t);
    if (!c._ops.includes("arc")) noEye.push(t);
    if (c._ops.filter((o) => o === "set:fillStyle").length < 4) flat.push(t);
    if (c._ops.includes("scale")) scaled.push(t);
  }
  check("every foe lays a contact shade on the floor", !noGround.length, noGround.join(","));
  check("every foe seals its contour with a dark rim", !noRim.length, noRim.join(","));
  check("every foe carries a sculpted eye", !noEye.length, noEye.join(","));
  check("every foe builds three tonal values", !flat.length, flat.join(","));
  check("no body leaves an ambient scale on the ctx", !scaled.length, scaled.join(","));
  const HEADS = ["walker", "chaser", "fast", "burrow", "knight"];
  const PLANTED = ["stationary", "boomerang", "rocket", "shade"];
  const noTurn = [],
    drifted = [];
  for (const t of TYPES) {
    const f = stub(),
      b = stub();
    drawEnemyBody(f, { time: 0 }, dummy(t, { x: 0, y: 1 }));
    drawEnemyBody(b, { time: 0 }, dummy(t, { x: 0, y: -1 }));
    const turns = JSON.stringify(f._ops) !== JSON.stringify(b._ops);
    if (HEADS.includes(t) && !turns) noTurn.push(t);
    if (PLANTED.includes(t) && turns) drifted.push(t);
  }
  check("head-bearing foes turn their back walking away", !noTurn.length, noTurn.join(","));
  check("planted, spinning and headless foes ignore dir", !drifted.length, drifted.join(","));
  const over = [];
  for (const t of TYPES) {
    let m = 0;
    for (const time of [0, 0.31, 0.77, 1.4]) {
      const c = bounds();
      drawEnemyBody(c, { time }, dummy(t));
      m = Math.max(m, -c._b.x0, c._b.x1, -c._b.y0, c._b.y1);
    }
    if (!(m <= 15.2)) over.push(t + ":" + m.toFixed(1));
  }
  check("every body fits the ENEMIES well at r=14", !over.length, over.join(" "));
}

{
  const w = createWorld(42, 1);
  loadLevel(w, 1, false);
  w.state = "PLAY";
  const start = w.enemies
    .map((e) => e.type + "," + e.x.toFixed(2) + "," + e.y.toFixed(2))
    .join("|");
  check(
    "AI smoke start roster seed 42",
    start === "walker,180.00,220.00|walker,300.00,100.00|stationary,300.00,140.00",
    start,
  );
  const intent = {
    move: { x: 0, y: 0 },
    fire: false,
    firePrev: false,
    shift: false,
    remote: false,
    kick: false,
  };
  for (let i = 0; i < 180; i++) step(w, CFG.STEP, { 0: intent });
  const end = w.enemies
    .map(
      (e) =>
        e.type + "," + (e.dead ? 1 : 0) + "," + e.x.toFixed(2) + "," + e.y.toFixed(2),
    )
    .join("|");
  check(
    "AI smoke 180 PLAY steps unchanged",
    end === "walker,0,182.16,220.00|walker,0,300.00,100.00|stationary,0,300.00,140.00",
    end,
  );
}

{
  const sfxOf = audioMod.sfxOf;
  check(
    "sfxOf routes kill+type to foe_*",
    typeof sfxOf === "function" &&
      sfxOf({ t: "kill", type: "walker", color: "#8affc1" }) === "foe_walker",
  );
  check(
    "sfxOf leaves action and bare kill alone",
    sfxOf({ t: "kick" }) === "kick" &&
      sfxOf({ t: "kill" }) === "kill" &&
      sfxOf({ t: "power", kind: "heart" }) === "item_heart",
  );
  const foeOf = audioMod.foeOf;
  const CUE = audioMod.FOE_CUE;
  check("FOE_CUE covers 9 types", !!CUE && TYPES.every((t) => CUE[t]));
  if (typeof foeOf === "function" && CUE) {
    const f0s = TYPES.map((t) => foeOf(t).f0);
    check(
      "foeOf f0 is unique per type",
      f0s.every((f) => typeof f === "number") && new Set(f0s).size === 9,
      f0s.join(","),
    );
    const extras = ["burrow", "shade", "knight"];
    check(
      "foe_burrow foe_shade foe_knight are first-class cues",
      extras.every((t) => CUE[t] && sfxOf({ t: "kill", type: t }) === "foe_" + t),
      extras.map((t) => sfxOf({ t: "kill", type: t })).join(","),
    );
    const recipes = TYPES.map((t) => {
      const c = foeOf(t);
      return c.f0 + ":" + c.osc + ":" + c.dur;
    });
    check(
      "foe recipes unique (f0+osc+dur), new three sit apart",
      new Set(recipes).size === 9 &&
        extras.every((t) => {
          const c = foeOf(t);
          return (
            c.f0 !== foeOf("boomerang").f0 &&
            c.f0 !== foeOf("rocket").f0 &&
            c.f0 !== foeOf("walker").f0
          );
        }),
      recipes.join("|"),
    );
  }
}

{
  function auto(v0) {
    return {
      value: v0 || 0,
      setValueAtTime(v) {
        if (this._f0 == null) this._f0 = v;
        this.value = v;
      },
      exponentialRampToValueAtTime(v) {
        this.value = v;
      },
    };
  }
  const ac = {
    currentTime: 0,
    state: "running",
    sampleRate: 44100,
    destination: { name: "dest" },
    starts: [],
    createOscillator() {
      const o = {
        type: "",
        frequency: auto(0),
        connect() {},
        start() {
          ac.starts.push({
            f0: o.frequency._f0 != null ? o.frequency._f0 : o.frequency.value,
            type: o.type,
          });
        },
        stop() {},
      };
      return o;
    },
    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: auto(350),
        Q: { value: 1 },
        connect() {},
      };
    },
    createBuffer() {
      return { getChannelData() { return new Float32Array(8); } };
    },
    createBufferSource() {
      return {
        buffer: null,
        connect() {},
        start() {
          ac.starts.push({ type: "noise", f: 0 });
        },
        stop() {},
      };
    },
    createGain() {
      return {
        gain: {
          value: 0,
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    },
    resume() {},
  };
  class FakeAC {
    constructor() {
      return ac;
    }
  }
  globalThis.window = { AudioContext: FakeAC };
  const a = createAudio();
  a.unlock();
  let threw = false;
  try {
    TYPES.forEach((t) => a.play("foe_" + t));
    a.play("kill");
    a.play("kick");
  } catch (e) {
    threw = true;
  }
  check("foe_* and action SFX names no-throw", !threw);
}

{
  check("SLOT_MESH.enemy stays 4", SLOT_MESH.enemy === 4, JSON.stringify(SLOT_MESH));
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
  // 143 since the 4-rail border collapsed to one extruded cabinet rim
  check("fat-world draw calls stay 143", calls === 143, String(calls));
}

{
  let bodies = null,
    same = false;
  try {
    bodies = await import("../src/render/enemybody.js");
    same = bodies.drawEnemyBody === drawEnemyBody;
  } catch (_) {}
  check(
    "drawEnemyBody lives in enemybody.js and sprites re-exports it",
    !!bodies && typeof bodies.drawEnemyBody === "function" && same,
  );
  const icons = await import("../src/render/icons.js");
  check(
    "foe rim is the item-glyph rim (one shared constant)",
    icons.RIM === "rgba(0,0,0,0.55)",
    String(icons.RIM),
  );
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
