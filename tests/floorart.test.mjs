import { BIOMES } from "../src/core/config.js";
import { paintFloor, paintGround, FLOOR_V, floorVar, bedOf } from "../src/render/floorart.js";
import { dE, rgbOf, lum } from "../tools/tileart/gatefns.mjs";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

const rec = () => {
  const log = [], fills = new Set();
  const ctx = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : (...a) => { log.push(k + "(" + a.join(",") + ")"); }),
    set: (o, k, v) => { log.push(k + "=" + v); if (k === "fillStyle" || k === "strokeStyle") fills.add(v); o[k] = v; return true; },
  });
  return { ctx, log, fills };
};
const run = (b, par, v, mode) => { const r = rec(); paintFloor(r.ctx, b, par, v, mode); return r; };
const hex = (c) => "#" + c.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
const parse = (s) => (s[0] === "#" ? { rgb: rgbOf(s), a: 1 } : (m => ({ rgb: m.slice(0, 3), a: m[3] }))(s.slice(5, -1).split(",").map(Number)));

{
  const real = Math.random;
  Math.random = () => { throw new Error("Math.random in the floor painter"); };
  let ok = true;
  try { for (const b of BIOMES) for (let p = 0; p < 2; p++) for (let v = 0; v < FLOOR_V; v++) { if (run(b, p, v).log.join("|") !== run(b, p, v).log.join("|")) ok = false; } } catch (e) { ok = false; }
  Math.random = real;
  check("every biome x parity x variant paints the same twice, with no Math.random", ok);
}

for (const b of BIOMES) {
  const bgs = rgbOf(b.bg1).join(","), mossy = rgbOf(b.brickB).join(",");
  let bad = [], hiA = 0;
  for (let p = 0; p < 2; p++) for (let v = 0; v < FLOOR_V; v++) for (const mode of [0, 1, 2]) {
    const r = run(b, p, v, mode);
    for (const f of r.fills) {
      const c = parse(f);
      if (f[0] === "#") { if (![bedOf(b, p), b.floor0, b.floor1, "#f4f4f4"].map((h) => h.toLowerCase()).includes(f.toLowerCase())) bad.push(f); }
      else { const k = c.rgb.join(","); if (!["0,0,0", "255,255,255", bgs, mossy].includes(k)) bad.push(f); hiA = Math.max(hiA, c.a); }
    }
  }
  check(b.name + " floor uses only slot beds, black / white / bg1 / brickB alpha (no new hex)", !bad.length, bad.join(" "));
  check(b.name + " floor marks stay low contrast (alpha <= 0.35)", hiA <= 0.35, hiA);
}

for (const b of BIOMES) {
  const logs = new Set();
  for (let v = 0; v < FLOOR_V; v++) logs.add(run(b, 0, v).log.join("|"));
  check(b.name + " the " + FLOOR_V + " variants differ (no two cells wallpaper alike)", logs.size >= 3, logs.size);
  check(b.name + " the two parities differ", run(b, 0, 0).log.join("|") !== run(b, 1, 0).log.join("|"));
}

for (const b of BIOMES) {
  const w = rgbOf(b.wall), br = [b.brickA, b.brickB].map(rgbOf);
  for (let p = 0; p < 2; p++) {
    const bed = rgbOf(bedOf(b, p));
    const dBrick = Math.min(...br.map((c) => dE(bed, c)));
    check(b.name + " par " + p + " bed vs BRICK dE >= 14", dBrick >= 14, dBrick.toFixed(1));
    check(b.name + " par " + p + " bed vs WALL dE >= 10", dE(bed, w) >= 10, dE(bed, w).toFixed(1));
  }
}

{
  const v = BIOMES.find((b) => b.name === "VOID"), cap = lum(...rgbOf(v.wallHi));
  let worst = 0;
  for (let p = 0; p < 2; p++) {
    const bed = rgbOf(bedOf(v, p)), top = parse("rgba(255,255,255,0.4)");
    worst = Math.max(worst, lum(...bed.map((x) => x * (1 - top.a) + 255 * top.a)));
  }
  check("VOID floor stays under wallHi even under the heaviest white mark", worst <= cap, worst.toFixed(1) + " <= " + cap.toFixed(1));
}

{
  let ok = true;
  for (let x = 0; x < 15; x++) for (let y = 0; y < 13; y++) { const v = floorVar(x, y, 3); if (!(v >= 0 && v < FLOOR_V) || v !== floorVar(x, y, 3)) ok = false; }
  check("floorVar is stable and in range", ok);
  const seen = new Set();
  for (let x = 0; x < 15; x++) for (let y = 0; y < 13; y++) seen.add(floorVar(x, y, 1));
  check("a room uses every variant", seen.size === FLOOR_V, seen.size);
}

{
  const real = Math.random;
  Math.random = () => { throw new Error("Math.random in the ground painter"); };
  const g = (b, x, y, lv) => { const r = rec(); paintGround(r.ctx, b, x, y, lv); return r; };
  let det = true;
  try { for (const b of BIOMES) for (let x = 0; x < 15; x++) for (let y = 0; y < 13; y++) if (g(b, x, y, 2).log.join("|") !== g(b, x, y, 2).log.join("|")) det = false; } catch (e) { det = false; }
  Math.random = real;
  check("ground tone is deterministic per (biome, cell, room), no Math.random", det);
  for (const b of BIOMES) {
    const bgs = rgbOf(b.bg1).join(","), ok = ["0,0,0", "255,255,255", bgs, rgbOf(b.brickB).join(","), rgbOf(b.wall).join(","), rgbOf(b.wallHi).join(",")];
    let bad = [], hiA = 0, marks = new Set();
    for (let x = 0; x < 15; x++) for (let y = 0; y < 13; y++) { const r = g(b, x, y, 1); marks.add(r.log.join("|")); for (const f of r.fills) { const c = parse(f); if (!ok.includes(c.rgb.join(","))) bad.push(f); hiA = Math.max(hiA, c.a); } }
    check(b.name + " ground tone uses only slots and black / white alpha", !bad.length, bad.join(" "));
    check(b.name + " ground tone stays a quiet tint (alpha <= 0.25)", hiA <= 0.25, hiA);
    check(b.name + " ground tone varies across the room", marks.size >= 6, marks.size);
  }
}

console.log("\n  FLOOR ART RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
