#!/usr/bin/env node
/* LOCKED-wall veil solver (UI upgrade ruling R17; dev only, zero deps, never imported by src/ and not part of the shipped app).

   The kit's LOCKED face is the world's own wall cell under a dark veil: wallShapes(b, 1) painted by paintShapes at 0,0 on a bare 40x40 canvas
   (b = uiBiome(world), no transform, no pre-fill), then fillRect(0, 0, 40, 40) in rgba(toL(b.bg1, 0.002), a). The alpha a is solved per world so the
   cell's mean relative luminance equals LUM.wallTex (0.06): 14 bisection steps from lo 0, hi 1 (a = (lo + hi) / 2; mean > target ? lo = a : hi = a),
   final a = (lo + hi) / 2. The mean is Rec.709 over linearised sRGB of the RGB that getImageData returns for all 1600 px, alpha ignored, exactly as
   the approved mock measured it: the chamfered corners the cell leaves transparent read as the veil colour (unpremultiplied).
   The result is committed as WALLTEX_A in src/render/kit/tokens.js, so the game never reads pixels back.

   Why a browser and not Node math: the V1 cell carries anti-aliased polygons and strokes at fractional coordinates (JUNGLE's 4.4 px root curve,
   CROWN's 1.2 px gilt strokes), the veil composites in sRGB, each pixel is quantised to 8 bits (premultiplied) and only then linearised. Coverage
   fractions would need a rasteriser, so the tool renders the real cell with the game's own painters in Chrome and bisects there. uiBiome, toL and
   LUM are imported from the served src/render/kit/tokens.js, so the shipped code is what gets measured. The default raster path (SwiftShader) is
   the one of record and gives byte-identical output run to run; on 2026-11-10 ANGLE Metal moved the achieved means in the fifth decimal and solved
   the same eight alphas, and the mock's own wallTex() returned the byte-identical PNG to this cell at each committed alpha.

   node tools/ui/walltex.mjs [--gpu] [--check]
     --gpu     launch chrome-headless-shell with ANGLE on Metal instead of the default SwiftShader (a cross-check, not the path of record)
     --check   compare the solved alphas with the committed WALLTEX_A and exit 1 on any difference (prints the same table)
   Prints per world the solved alpha and the mean it achieves, then a paste-ready WALLTEX_A line.

   Browser and server come from tools/pixel/shot.mjs: its own PORT=0 node serve.js, the newest installed chrome-headless-shell ($CHROME overrides)
   with a fresh --user-data-dir. The page is a same-origin 404 document (serve.js sends no CORS headers, so about:blank cannot import modules).
   Every child is stopped by PID, also on a crash, and the profile is deleted after Chrome exits. */
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {startServer, startChrome, stopChrome, stop, cdp} from "../pixel/shot.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const PAGE = `(async () => {
  const [{BIOMES}, wa, tk] = await Promise.all(["/src/core/config.js", "/src/render/wallart.js", "/src/render/kit/tokens.js"].map((p) => import(p)));
  const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const rgba = (h, a) => { const [r, g, b] = hx(h); return "rgba(" + r + "," + g + "," + b + "," + a + ")"; };
  const out = [];
  for (const b0 of BIOMES) {
    const b = tk.uiBiome(b0), veil = tk.toL(b.bg1, 0.002);
    const mk = (a) => { const cv = document.createElement("canvas"); cv.width = cv.height = 40; const c = cv.getContext("2d"); wa.paintShapes(c, b, wa.wallShapes(b, 1), 0, 0); c.fillStyle = rgba(veil, a); c.fillRect(0, 0, 40, 40); return cv; };
    const mean = (cv) => { const d = cv.getContext("2d").getImageData(0, 0, 40, 40).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); return s / (d.length / 4); };
    let lo = 0, hi = 1;
    for (let i = 0; i < 14; i++) { const a = (lo + hi) / 2; if (mean(mk(a)) > tk.LUM.wallTex) lo = a; else hi = a; }
    const a = (lo + hi) / 2;
    out.push({name: b.name, a, mean: mean(mk(a))});
  }
  return out;
})()`;

export async function solve(gpu = false) {
  const srv = await startServer();
  let chr, c;
  try {
    chr = await startChrome(gpu);
    c = await cdp(chr.ws);
    const {targetId} = await c.send("Target.createTarget", {url: "about:blank"});
    const {sessionId} = await c.send("Target.attachToTarget", {targetId, flatten: true});
    const S = (m, p) => c.send(m, p, sessionId);
    const ev = async (expression) => { const r = await S("Runtime.evaluate", {expression, awaitPromise: true, returnByValue: true}); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
    const origin = "http://127.0.0.1:" + srv.port;
    await S("Page.navigate", {url: origin + "/__walltex__"});
    for (let i = 0; i < 100 && (await ev("location.origin + '|' + document.readyState").catch(() => "")) !== origin + "|complete"; i++) await sleep(50);
    return await ev(PAGE);
  } finally {
    await stopChrome(chr, c);
    await stop(srv.proc);
  }
}

async function main(argv) {
  const gpu = argv.includes("--gpu"), check = argv.includes("--check");
  const bad = argv.filter((a) => a !== "--gpu" && a !== "--check");
  if (bad.length) throw new Error("unknown flag " + bad[0] + " (see the header of tools/ui/walltex.mjs)");
  const res = await solve(gpu);
  for (const r of res) console.log(r.name.padEnd(8) + " a " + String(r.a).padEnd(18) + " mean " + r.mean.toFixed(5));
  console.log("export const WALLTEX_A = deep({" + res.map((r) => r.name + ": " + r.a).join(", ") + "});");
  if (!check) return;
  const {WALLTEX_A} = await import(resolve(ROOT, "src/render/kit/tokens.js"));
  const off = res.filter((r) => WALLTEX_A[r.name] !== r.a).map((r) => r.name + " committed " + WALLTEX_A[r.name] + " solved " + r.a);
  if (Object.keys(WALLTEX_A).length !== res.length) off.push("committed has " + Object.keys(WALLTEX_A).length + " worlds, solved " + res.length);
  if (off.length) { console.error("walltex: committed WALLTEX_A differs\n  " + off.join("\n  ")); process.exitCode = 1; }
  else console.log("walltex: committed WALLTEX_A matches");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error("walltex: " + (e && e.message || e)); process.exitCode = 1; });
}
