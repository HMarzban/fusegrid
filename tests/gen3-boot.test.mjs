// v198 made gen 3 every ordinary run's board; v202 (delivery 3a) takes its code back out of
// the boot graph: src/app/lazyload.js loads board3.js in the title's first idle, and a run
// start that comes first holds, the world frozen, until it is in. The bare sim still imports
// without it (board2's seam), and a gen-3 ask with the seam empty throws.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRECACHE } from "../src/pwa/shell.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const src = (f) => readFileSync(join(ROOT, f), "utf8");

check("src/main.js no longer imports board3.js", !/board3/.test(src("src/main.js").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
check("src/app/lazyload.js loads it with a dynamic import()", /import\("\.\.\/core\/board3\.js"\)/.test(src("src/app/lazyload.js")));
for (const f of ["src/core/board3.js", "src/core/featchecks.js", "src/core/featplace.js", "src/app/lazyload.js"]) check("PRECACHE carries " + f, PRECACHE.includes("./" + f) || PRECACHE.includes(f));
check("src/core holds no import(): the sim stays synchronous", !["board2", "world", "sim", "feat"].some((m) => /\bimport\(/.test(src("src/core/" + m + ".js"))));

const run = (code) => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: ROOT, encoding: "utf8" });
  return { out: r.status === 0 ? JSON.parse(r.stdout.trim().split("\n").pop()) : null, err: r.stderr.slice(0, 300) };
};

const SEAM = `
  const { createWorld, loadLevel, step } = await import("./src/core/sim.js");
  const { genBoard2 } = await import("./src/core/board2.js");
  const asks = [() => genBoard2(7, 3, 0, { feat: true }), () => { const w = createWorld(7, 3); w.gen = 3; loadLevel(w, 3, false); }];
  const threw = asks.map((f) => { try { f(); return null; } catch (e) { return e.message; } });
  const w2 = createWorld(7, 3); w2.gen = 2; loadLevel(w2, 3, false);
  /* a gen-2 run's later loads (the LOSE restart, the next room) never reach the seam */
  const fire = { 0: { move: { x: 0, y: 0 }, fire: true, firePrev: false, shift: false, remote: false } };
  let later = null;
  try { w2.state = "LOSE"; w2.fireEdge = false; step(w2, 1 / 60, fire); w2.state = "WIN"; w2.fireEdge = false; step(w2, 1 / 60, fire); later = w2.level + ":" + w2.state + ":" + w2.gen; } catch (e) { later = "threw " + e.message; }
  await import("./src/core/board3.js");
  const w3 = createWorld(7, 3); w3.gen = 3; loadLevel(w3, 3, false);
  console.log(JSON.stringify({ threw, g2: !w2.feat, later, g3: !!w3.feat }));`;
{
  const { out, err } = run(SEAM);
  check("fresh process: the sim imports and deals gen 1/2 with the seam empty", !!out && out.g2, err);
  check("seam empty: a gen-3 board THROWS, never a tile-free board", !!out && out.threw.every((m) => m && m.includes("board3.js")), out && out.threw.join(" | "));
  check("seam empty: a gen-2 run's GAME OVER restart and next room load inside step() and stay gen 2", !!out && out.later === "2:PLAY:2", out && out.later);
  check("board3.js imported: the board has tiles", !!out && out.g3);
}

/* the real createGame with no board3 import: PLAY holds, frozen, until lazyload brings gen 3 in */
const HOLD = `
  const mem = {};
  globalThis.window = { addEventListener() {}, removeEventListener() {}, innerWidth: 1440, innerHeight: 900, open() {},
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } } };
  globalThis.location = { search: "", reload() {} };
  const { createGame } = await import("./src/main.js");
  const { hasGen3 } = await import("./src/core/board2.js");
  const { createWorld, loadLevel } = await import("./src/core/sim.js");
  const g = createGame(null, { seed: 42 });
  let t = 0;
  const tick = (n) => { for (let i = 0; i < n; i++) { t += 1000 / 60; g.loop(t); } };
  tick(2);
  const before = hasGen3(), t0 = g.world.tick, grid0 = g.world.grid;
  let threw = null;
  try { g.app.startRun(); tick(40); } catch (e) { threw = e.message; }
  const held = { tick: g.world.tick - t0, same: g.world.grid === grid0, gen: g.world.gen, screen: g.app.screen };
  for (let i = 0; i < 200 && !hasGen3(); i++) await new Promise((r) => setTimeout(r, 5));
  await new Promise((r) => setTimeout(r, 0));
  tick(40);
  const ref = createWorld(42, 1); ref.gen = 3; loadLevel(ref, 1, false);
  console.log(JSON.stringify({ before, threw, held, after: { gen: g.world.gen, feat: !!g.world.feat, ticks: g.world.tick, same: g.world.seed === 42 && JSON.stringify(g.world.feat) === JSON.stringify(ref.feat) && g.world.grid.join() === ref.grid.join() } }));
  process.exit(0);`;
{
  const { out, err } = run(HOLD);
  check("createGame boots and shows the title with gen 3 not loaded", !!out && out.before === false, err);
  check("PLAY before gen 3 is in: no throw, the shell is in GAME, the sim does not step and the board is not dealt", !!out && !out.threw && out.held.tick === 0 && out.held.same && out.held.gen === 1 && out.held.screen === 6, out && JSON.stringify(out.held) + " " + out.threw);
  check("gen 3 in: the held start runs, a gen-3 board with tiles, and the run steps", !!out && out.after.gen === 3 && out.after.feat && out.after.ticks > 0, out && JSON.stringify(out.after));
  check("the held start deals the same board a direct start would (seed 42, room 1)", !!out && out.after.same);
}

console.log(fail ? "GEN3 BOOT FAIL" : "GEN3 BOOT OK", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
