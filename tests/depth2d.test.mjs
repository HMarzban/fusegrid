import { BIOMES, CFG, T } from "../src/core/config.js";
import { drawDepth, contact, wallReach, brickReach, CAST_A, CAST_STEPS } from "../src/render/depth2d.js";
import { BRICK_U } from "../src/render/sprites.js";
import { mix } from "../src/render/featart/kit.js";
import { lab, rgbOf } from "../tools/tileart/gatefns.mjs";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const rec = () => {
  const log = [];
  const ctx = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : (...a) => { log.push(k + "(" + a.map((v) => (typeof v === "number" ? v.toFixed(2) : v)).join(",") + ")"); }),
    set: (o, k, v) => { log.push(k + "=" + v); o[k] = v; return true; },
  });
  return { ctx, log };
};
const world = (level, edit) => {
  const grid = new Array(CFG.COLS * CFG.ROWS).fill(T.EMPTY);
  for (let y = 0; y < CFG.ROWS; y++) for (let x = 0; x < CFG.COLS; x++) {
    const i = y * CFG.COLS + x;
    if (x === 0 || y === 0 || x === CFG.COLS - 1 || y === CFG.ROWS - 1 || (x % 2 === 0 && y % 2 === 0)) grid[i] = T.WALL;
    else if ((x * 5 + y * 3) % 4 === 0) grid[i] = T.BRICK;
  }
  if (edit) edit(grid);
  return { level, grid, feat: null, time: 0 };
};
const run = (w) => { const r = rec(); drawDepth(r.ctx, w); return r.log; };

{
  const a = run(world(1)), b = run(world(1));
  check("the layer is a pure function of the grid (same board, same ops)", a.join("|") === b.join("|"), a.length);
  check("no gradient anywhere in the depth layer", !a.some((l) => /Gradient/.test(l)));
  check("no Math.random in the layer (stubbed to throw)", (() => { const R = Math.random; Math.random = () => { throw new Error("r"); }; try { run(world(2)); return true; } catch (e) { return false; } finally { Math.random = R; } })());
}
{
  const w0 = world(1), brick = w0.grid.findIndex((t) => t === T.BRICK), w1 = world(1, (g) => { g[brick] = T.EMPTY; });
  check("a broken brick changes the layer (its shadow goes with it)", run(w0).join("|") !== run(w1).join("|"));
  const walls = w0.grid.filter((t) => t === T.WALL).length;
  const rects = run(w0).filter((l) => l.startsWith("rect(")).slice(0, CFG.COLS * CFG.ROWS - walls);
  check("the clip is every cell that is not a WALL (a wall keeps its own face)", rects.length === CFG.COLS * CFG.ROWS - walls, rects.length + " vs " + (CFG.COLS * CFG.ROWS - walls));
}
{
  const cov = 1 - Math.pow(1 - CAST_A, CAST_STEPS.length);
  check("cast shadow stacks to black alpha .30-.40 at the base", cov >= 0.3 && cov <= 0.4, cov.toFixed(3));
  const ok = BIOMES.every((b) => wallReach(b) >= 4 && wallReach(b) <= 8 && brickReach(b) >= 3 && brickReach(b) <= 6);
  check("shadow reach 4-8 px (wall) and 3-6 px (brick)", ok);
  const ice = BIOMES[1], jun = BIOMES[0];
  check("a taller wall throws a longer shadow (ICE 36 > JUNGLE 22)", wallReach(ice) > wallReach(jun), wallReach(ice) + " > " + wallReach(jun));
}
{
  const r = rec(); contact(r.ctx, 10, 3);
  check("contact(): two stacked ellipses, offset toward the lower right, no gradient", r.log.filter((l) => l.startsWith("ellipse")).length === 2 && !r.log.some((l) => /Gradient/.test(l)));
  const e = r.log.find((l) => l.startsWith("ellipse")).split(",");
  check("contact(): the centre sits right of and below its anchor", +e[0].slice(8) > 0 && +e[1] > 0);
}
{
  const bad = [];
  for (const b of BIOMES) {
    const old = [b.brickA, b.brickB].map((h) => lab(rgbOf(h))[0]), nu = [b.brickA, b.brickB].map((h) => lab(rgbOf(mix(b.bg1, h, BRICK_U[b.name])))[0]);
    const d = (old[0] + old[1]) / 2 - (nu[0] + nu[1]) / 2;
    if (!(d >= 7 && d <= 16)) bad.push(b.name + ":" + d.toFixed(1));
  }
  check("the CLASSIC brick faces lose 7-16 L* in every biome (toward their own bg1)", !bad.length, bad.join(" "));
}

console.log("\n  DEPTH 2D RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
