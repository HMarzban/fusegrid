// Download size: the tile checks and tile placement are a lazy chunk only ?gen=3 pays for.
// Walks the STATIC import graph of what index.html imports (dynamic import() is not an edge).
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PRECACHE } from "../src/pwa/shell.js";
import { gen3Boot } from "../src/app/gen3load.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const EDGE = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^;"']*?\sfrom\s*)?["']([^"']+)["']/g;
function staticGraph(entries) {
  const seen = new Set(), todo = entries.map((e) => join(ROOT, e)), missing = [];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    if (!existsSync(f)) { missing.push(f); continue; }
    for (const m of strip(readFileSync(f, "utf8")).matchAll(EDGE)) if (m[1].startsWith(".")) todo.push(join(dirname(f), m[1]));
  }
  return { files: [...seen].map((f) => relative(ROOT, f)), missing };
}

const html = readFileSync(join(ROOT, "index.html"), "utf8");
const script = html.slice(html.lastIndexOf('<script type="module"'), html.lastIndexOf("</script>"));
const entries = [...script.matchAll(EDGE)].map((m) => m[1].replace(/^\.\//, ""));
const LAZY = ["src/core/board3.js", "src/core/featchecks.js", "src/core/featplace.js"];
const g = staticGraph(entries);

check("the walker is not vacuous: index.html reaches main.js, the sim, board2 and the seam", g.files.length > 60 && ["src/main.js", "src/core/sim.js", "src/core/board2.js", "src/app/gen3load.js"].every((f) => g.files.includes(f)), entries.join());
check("every static import resolves to a file", g.missing.length === 0, g.missing.join());
for (const f of LAZY) check(f + " is out of the boot graph", !g.files.includes(f));

const lazy = staticGraph(["src/core/board3.js"]);
for (const f of LAZY) check("the lazy chunk (board3.js) reaches " + f, lazy.files.includes(f));
const seam = strip(readFileSync(join(ROOT, "src/app/gen3load.js"), "utf8"));
check("gen3load.js holds the one dynamic import of board3.js", /import\("\.\.\/core\/board3\.js"\)/.test(seam));
check("index.html boots through the seam", /gen3Boot\(location\.search,/.test(script));
for (const f of [...LAZY, "src/app/gen3load.js"]) check("PRECACHE carries " + f + " (?gen=3 offline)", PRECACHE.includes("./" + f) || PRECACHE.includes(f));
check("src/core holds no import(): the sim stays synchronous", !["board2", "world", "sim", "feat"].some((m) => /\bimport\(/.test(strip(readFileSync(join(ROOT, "src/core/" + m + ".js"), "utf8")))));

let ran = 0;
const sync = gen3Boot("", () => { ran++; return "booted"; });
check("no flag: go() runs in the same tick and nothing is fetched", ran === 1 && sync === "booted");
ran = 0;
gen3Boot("?gen=3&code=F1ABCDEFGHJK", () => { ran++; });
check("a ?code= never plays gen 3, so it never loads it", ran === 1);

const CHILD = `
  const { createWorld, loadLevel } = await import("./src/core/sim.js");
  const { genBoard2 } = await import("./src/core/board2.js");
  const { gen3Boot } = await import("./src/app/gen3load.js");
  const asks = [() => genBoard2(7, 3, 0, { feat: true }), () => { const w = createWorld(7, 3); w.gen = 3; loadLevel(w, 3, false); }];
  const threw = asks.map((f) => { try { f(); return null; } catch (e) { return e.message; } });
  const w2 = createWorld(7, 3); w2.gen = 2; loadLevel(w2, 3, false);
  let w3 = null;
  await gen3Boot("?gen=3", () => { w3 = createWorld(7, 3); w3.gen = 3; loadLevel(w3, 3, false); });
  console.log(JSON.stringify({ threw, g2: !w2.feat, g3: !!(w3 && w3.feat) }));`;
const r = spawnSync(process.execPath, ["--input-type=module", "-e", CHILD], { cwd: ROOT, encoding: "utf8" });
const out = r.status === 0 ? JSON.parse(r.stdout.trim().split("\n").pop()) : null;
check("fresh process: the sim imports and deals gen 1/2 with the seam empty", !!out && out.g2, r.stderr.slice(0, 200));
check("seam empty: a gen-3 board THROWS, through genBoard2 and loadLevel, never a tile-free board", !!out && out.threw.every((m) => m && m.includes("board3.js")), out && out.threw.join(" | "));
check("gen3Boot loads the seam BEFORE go(): the first board it deals has tiles", !!out && out.g3);

console.log(fail ? "GEN3 LAZY FAIL" : "GEN3 LAZY OK", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
