// GRAPHICS integration: the browser always arms render-on-change (frameloop's
// first gated tick calls setKnobs), so desktop AUTO must stay byte-identical
// ARMED, not only unarmed. CLASSIC: the armed call log equals the unarmed one
// except the cached biome gradient (built once, not per frame). PIXEL: every
// PLAY frame's native board and the #px call log are identical.
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { classicHash } from "./lib/classichash.mjs";
import { CFG } from "../src/core/config.js";
import { createWorld, loadLevel, step, newIntent } from "../src/core/sim.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { initFx } from "../src/render/fx.js";
import { resolve } from "../src/app/gfx.js";
import { DEFAULTS } from "../src/app/settings.js";
import { createRGBA, surfRGBA } from "../tools/pixel/rgba.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const K = { ...resolve(DEFAULTS, { lay: "d", dpr: 1, scale: 1 }), epoch: 1 };

{
  const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
  const a = await classicHash(imp, null, true), b = await classicHash(imp, K, true);
  const grad = (l) => l.startsWith("createLinearGradient") || l.startsWith("g.");
  const fa = a.filter((l) => !grad(l)), fb = b.filter((l) => !grad(l));
  check("CLASSIC armed AUTO: call log equals unarmed outside the gradient build", fa.length === fb.length && fa.every((l, i) => l === fb[i]), fa.length + " vs " + fb.length);
  check("CLASSIC armed AUTO: the biome gradient is built once, not per frame", a.filter((l) => l.startsWith("createLinearGradient")).length === 3 && b.filter((l) => l.startsWith("createLinearGradient")).length === 1);
}

function rec(w, h, log, tag) {
  const cv = { width: w, height: h, clientWidth: 0, clientHeight: 0, tag };
  const ctx = { imageSmoothingEnabled: true, imageSmoothingQuality: "high", globalAlpha: 1, fillStyle: "#000", getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), putImageData() {} };
  for (const k of ["save", "restore", "translate", "scale", "rotate", "strokeRect", "clearRect", "beginPath", "closePath", "moveTo", "lineTo", "arc", "arcTo", "bezierCurveTo", "quadraticCurveTo", "fill", "stroke", "ellipse", "transform", "fillText", "strokeText", "setLineDash", "rect", "clip"]) ctx[k] = () => {};
  ctx.measureText = () => ({ width: 10 });
  ctx.fillRect = (...a) => log.push([tag, "fillRect", a, ctx.fillStyle, ctx.globalAlpha]);
  ctx.setTransform = (...a) => log.push([tag, "setTransform", a]);
  ctx.drawImage = (src, ...a) => log.push([tag, "drawImage", a, src && src.tag]);
  ctx.createLinearGradient = () => ({ addColorStop() {} });
  ctx.createRadialGradient = () => ({ addColorStop() {} });
  cv.getContext = () => ctx;
  return cv;
}
function pixelRun(arm) {
  let s = 777;
  const real = Math.random;
  Math.random = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  try {
    initFx();
    const log = [];
    let n = 0, native = null;
    const mk = (w, h) => { const i = n++; if (i === 1) { native = createRGBA(w, h); return native; } return rec(w, h, log, i ? "hi" : "probe"); };
    const px = rec(600, 520, log, "px"); px.clientWidth = 829; px.clientHeight = 718;
    const r = createPixelRenderer(px, rec(600, 520, log, "ov"), { mkCanvas: mk, surf: surfRGBA });
    if (arm) r.setPerf(arm);
    const w = createWorld(4242, 1); loadLevel(w, 1); w.state = "PLAY";
    const hs = [];
    for (let f = 0; f < 180; f++) {
      const it = newIntent();
      it.fire = f % 40 === 5;
      it.move = { x: f % 80 < 40 ? 1 : -1, y: 0 };
      step(w, CFG.STEP, { 0: it });
      r.render(w, CFG.STEP, { hud: true });
      hs.push(native ? createHash("sha1").update(native.data).digest("hex") : "-");
    }
    return { hs, px: createHash("sha1").update(JSON.stringify(log.filter((q) => q[0] === "px"))).digest("hex"), armed: r._dbg.armed };
  } finally { Math.random = real; }
}
{
  const a = pixelRun(null), b = pixelRun(K);
  check("PIXEL armed AUTO really armed", b.armed === true && a.armed === false);
  check("PIXEL armed AUTO: all 180 PLAY native boards byte-identical", a.hs.length === 180 && a.hs.every((h, i) => h === b.hs[i]), a.hs.filter((h, i) => h !== b.hs[i]).length + " differ");
  check("PIXEL armed AUTO: #px blit log identical", a.px === b.px);
}

console.log(fail ? "GFX IDENTITY FAIL" : "GFX IDENTITY OK", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
