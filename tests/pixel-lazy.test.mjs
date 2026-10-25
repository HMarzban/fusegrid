// #15: the PIXEL tree is a lazy chunk. Walks the STATIC import graph of the browser entry
// (dynamic import() is not an edge) and pins what CLASSIC 2D downloads and parses.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const EDGE = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^;"']*?\sfrom\s*)?["']([^"']+)["']/g;
function staticGraph(entry) {
  const seen = new Set(), todo = [join(ROOT, entry)], missing = [];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    if (!existsSync(f)) { missing.push(f); continue; }
    const src = strip(readFileSync(f, "utf8"));
    for (const m of src.matchAll(EDGE)) if (m[1].startsWith(".")) todo.push(join(dirname(f), m[1]));
  }
  return { files: [...seen].map((f) => relative(ROOT, f)), missing };
}

const g = staticGraph("src/main.js");
const px = g.files.filter((f) => f.startsWith("src/render/pixel/")).sort();
const SEAM = ["src/render/pixel/load.js"];

check("the walker is not vacuous: main.js reaches the classic renderer, the shell and the 3D loader seam", g.files.length > 60 && g.files.includes("src/render/renderer.js") && g.files.includes("src/render/menudraw.js") && g.files.includes("src/render/three/load.js"), String(g.files.length));
check("every static import from main.js resolves to a file", g.missing.length === 0, g.missing.join());
check("CLASSIC boot path statically reaches ONLY the one px seam file (load.js)", px.join() === SEAM.join(), px.join());
check("main.js imports the loader seam, never the renderer", /from "\.\/render\/pixel\/load\.js"/.test(strip(readFileSync(join(ROOT, "src/main.js"), "utf8"))) && !g.files.includes("src/render/pixel/renderer.js"));
check("CLASSIC boot never reaches the px renderer, atlas or art sheets", !g.files.some((f) => /^src\/render\/pixel\/(renderer|atlas|world|oneshot|manifest|art\/)/.test(f)));
check("CLASSIC boot never reaches vendor/three or the three wrapper", !g.files.some((f) => /^vendor\/|^src\/render\/three\/wrapper\.js$/.test(f)), g.files.filter((f) => /^vendor\/|wrapper/.test(f)).join());

const seam = (f) => strip(readFileSync(join(ROOT, f), "utf8"));
check("pixel/load.js is the one dynamic import of renderer.js and statically imports nothing", /import\("\.\/renderer\.js"\)/.test(seam("src/render/pixel/load.js")) && [...seam("src/render/pixel/load.js").matchAll(EDGE)].length === 0);
check("hudart.js (the shared registry menudraw reads) imports nothing", [...seam("src/render/hudart.js").matchAll(EDGE)].length === 0);
check("main.js has no inline import()", !/\bimport\(/.test(seam("src/main.js")));

const full = staticGraph("src/render/pixel/renderer.js");
check("the lazy chunk (renderer.js) still reaches the whole px tree it needs", full.missing.length === 0 && full.files.filter((f) => f.startsWith("src/render/pixel/")).length >= 15, String(full.files.length));

console.log(fail ? "PIXEL LAZY FAIL" : "PIXEL LAZY OK", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
