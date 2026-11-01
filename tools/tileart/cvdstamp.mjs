/* What the committed CLASSIC 2D colour-vision golden (cvdgold.json) was measured from: an FNV-1a hash of the whole painter call stream of the Chrome recipe (cvdpaint.mjs),
   recorded in Node with every argument and property write (a biome hex edit moves it), Path2D / DOMMatrix contents inlined (an edit inside a path moves it), gradient stops
   included, plus the tile list, the scale and the measuring code (simCVD, cvdSep, the matrices). Numbers are rounded to 3 decimals, also inside rgba() strings, so a last-bit
   float difference between Node builds cannot move it. Any canvas method the painters start to use is logged by name, so it moves the stamp too. */
import {BIOMES} from "../../src/core/config.js";
import * as F from "../../src/render/featdraw.js";
import * as FL from "../../src/render/floorart.js";
import * as SP from "../../src/render/sprites.js";
import {cvdRecipe} from "./cvdpaint.mjs";
import {CVD_ENT} from "./cvdsets.mjs";
import {CVD, simCVD, cvdSep} from "./gatefns.mjs";

const num = (v) => v.toFixed(3);
class RecPath { constructor(p) { this.log = p instanceof RecPath ? [...p.log] : p != null ? ["svg:" + p] : []; } }
for (const m of ["moveTo", "lineTo", "closePath", "rect", "arc", "arcTo", "ellipse", "bezierCurveTo", "quadraticCurveTo", "roundRect", "addPath"]) RecPath.prototype[m] = function (...a) { this.log.push(m + "(" + a.map(fmt).join(",") + ")"); };
class RecMatrix { constructor(a = []) { this.a = Array.from(a); } }
function fmt(v) {
  if (typeof v === "number") return num(v);
  if (typeof v === "string") return v.replace(/-?\d*\.\d+/g, (x) => num(+x));
  if (v instanceof RecPath) return "P[" + v.log.join(";") + "]";
  if (v instanceof RecMatrix) return "M[" + v.a.map(num).join(",") + "]";
  if (v && v.tag) return v.tag;
  return String(v);
}
function recorder(log) {
  let grads = 0;
  const rec = (tag) => new Proxy({tag}, {
    get(o, k) {
      if (k in o || typeof k !== "string") return o[k];
      if (k === "canvas") return {width: 160, height: 160};
      return (...a) => { log.push(tag + k + "(" + a.map(fmt).join(",") + ")"); return k.startsWith("create") ? rec("g" + grads++ + ".") : undefined; };
    },
    set(o, k, v) { log.push(tag + k + "=" + fmt(v)); o[k] = v; return true; },
  });
  return rec("");
}
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
/* mods may replace a module or the tile list (the tests' bite probes). A painter that read Math.random would make the stream unrepeatable, so it throws here */
export function cvdStamp(mods = {}) {
  const M = {F, FL, SP, C: {BIOMES}, ...mods}, log = [], P0 = globalThis.Path2D, D0 = globalThis.DOMMatrix, R0 = Math.random;
  globalThis.Path2D = RecPath; globalThis.DOMMatrix = RecMatrix;
  Math.random = () => { throw new Error("a CVD painter read Math.random: the call stream would not be reproducible"); };
  try {
    cvdRecipe(M, mods.ENT || CVD_ENT, (fn) => { log.push("cell"); const g = recorder(log); g.scale(4, 4); fn(g); return null; });
  } finally { globalThis.Path2D = P0; globalThis.DOMMatrix = D0; Math.random = R0; }
  log.push(JSON.stringify(mods.ENT || CVD_ENT), JSON.stringify(CVD), String(simCVD), String(cvdSep));
  const s = log.join("\n");
  return fnv(s) + ":" + log.length;
}
