// v198: every ordinary run deals gen 3, so the page always has the tile code. The bare
// sim still imports without it (board2's seam), and a gen-3 ask with the seam empty throws.
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

check("src/main.js imports board3.js", /^import "\.\/core\/board3\.js";/m.test(readFileSync(join(ROOT, "src/main.js"), "utf8")));
for (const f of ["src/core/board3.js", "src/core/featchecks.js", "src/core/featplace.js"]) check("PRECACHE carries " + f, PRECACHE.includes("./" + f) || PRECACHE.includes(f));
check("src/core holds no import(): the sim stays synchronous", !["board2", "world", "sim", "feat"].some((m) => /\bimport\(/.test(readFileSync(join(ROOT, "src/core/" + m + ".js"), "utf8"))));

const CHILD = `
  const { createWorld, loadLevel } = await import("./src/core/sim.js");
  const { genBoard2 } = await import("./src/core/board2.js");
  const asks = [() => genBoard2(7, 3, 0, { feat: true }), () => { const w = createWorld(7, 3); w.gen = 3; loadLevel(w, 3, false); }];
  const threw = asks.map((f) => { try { f(); return null; } catch (e) { return e.message; } });
  const w2 = createWorld(7, 3); w2.gen = 2; loadLevel(w2, 3, false);
  await import("./src/core/board3.js");
  const w3 = createWorld(7, 3); w3.gen = 3; loadLevel(w3, 3, false);
  console.log(JSON.stringify({ threw, g2: !w2.feat, g3: !!w3.feat }));`;
const r = spawnSync(process.execPath, ["--input-type=module", "-e", CHILD], { cwd: ROOT, encoding: "utf8" });
const out = r.status === 0 ? JSON.parse(r.stdout.trim().split("\n").pop()) : null;
check("fresh process: the sim imports and deals gen 1/2 with the seam empty", !!out && out.g2, r.stderr.slice(0, 200));
check("seam empty: a gen-3 board THROWS, never a tile-free board", !!out && out.threw.every((m) => m && m.includes("board3.js")), out && out.threw.join(" | "));
check("board3.js imported: the board has tiles", !!out && out.g3);

console.log(fail ? "GEN3 BOOT FAIL" : "GEN3 BOOT OK", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
