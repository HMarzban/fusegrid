// PIXEL W5 (ruling R19): HUD item chips and GUIDE ITEMS / ENEMIES / HOW TO
// show the atlas cells in PIXEL at integer logical scale (x1 chip, x2 GUIDE
// when every cell on the page fits), text stays the shared vector font, and
// CLASSIC 2D / REAL 3D / iso call logs never change with px art (HUD pinned
// from HEAD f732450, before W5; GUIDE pages re-pinned at the 2026-10-19
// ATLAS menu pages, keyboard and touch, with no px art registered — the
// px-registered pass must hit the very same pins, so px art never leaks;
// HOW TO re-pinned 2026-10-21 for issue #6: its KICK key reads WALK INTO BOMB).
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as md from "../src/render/menudraw.js";
import { drawHudChips } from "../src/render/scenes.js";
import { drawShell } from "../src/render/shellview.js";
import { SCREEN } from "../src/app/menuapp.js";
import { POWER, FOES } from "../src/core/entities.js";
import { createAtlas } from "../src/render/pixel/atlas.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { setPixelArt, pixelArt, hudIcon, opaqueBox, itemCell, foeCell, pageScale, HUD_S, GUIDE_S, SLOT_PAD } from "../src/render/hudart.js";
import { surfRGBA } from "../tools/pixel/rgba.mjs";
import { PRECACHE } from "../src/pwa/shell.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
function rec() {
  const log = [], ops = [];
  const fmt = (v) => (typeof v === "number" ? v.toFixed(3) : typeof v === "string" ? v : v && typeof v === "object" ? "{o}" : String(v));
  const mk = (tag) => new Proxy({}, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === "canvas") return {width: 600, height: 520};
      return (...a) => { log.push(tag + String(k) + "(" + a.map(fmt).join(",") + ")"); ops.push([String(k), a, o.imageSmoothingEnabled]); return String(k).startsWith("create") ? mk("g.") : String(k) === "measureText" ? {width: 10} : undefined; };
    },
    set(o, k, v) { log.push(tag + String(k) + "=" + fmt(v)); o[k] = v; return true; },
  });
  return {c: mk(""), log, ops};
}
const H = (log) => { let h = 0x811c9dc5; const s = log.join("\n"); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0") + ":" + log.length; };
const HUDW = (lives) => ({players: [{bombs: 2, range: 3}], lives, level: 4, enemies: [1, 2], heat: 1, score: 1234});
const HUDS = [[0, null], [3, {on: true, t: 12.3}], [8, null]];
const PAGES = ["drawHowTo", "drawItemsHelp", "drawEnemiesHelp"], BOXES = [[600, 520], [600, 360]];
const PIN = {
  hud0: "7c298753:175", hud3: "60b2bf24:349", hud8: "2aa8d78c:508",
  drawHowTo520: "5687af4d:457", drawItemsHelp520: "8a7f1cfd:1195", drawEnemiesHelp520: "1c590ad6:1149",
  drawHowTo360: "1938cac7:457", drawItemsHelp360: "b3039a60:1195", drawEnemiesHelp360: "b0a1000c:1149",
  drawHowTo520T: "e582bb4f:457", drawItemsHelp520T: "2aa3e9c5:1195", drawEnemiesHelp520T: "5682c5e5:1149",
  drawHowTo360T: "7a30cea6:457", drawItemsHelp360T: "9e918ade:1195", drawEnemiesHelp360T: "46aa50d5:1149",
  "shell.2d.HOWTO": "7107614c:459", "shell.2d.ITEMS": "4fc3c574:1197", "shell.2d.ENEMIES": "0cc384f9:1151",
  "shell.3d.HOWTO": "7107614c:459", "shell.3d.ITEMS": "4fc3c574:1197", "shell.3d.ENEMIES": "0cc384f9:1151",
  "shell.iso.HOWTO": "3851fddd:459", "shell.iso.ITEMS": "bc8afea6:1197", "shell.iso.ENEMIES": "9d742abb:1151",
};
const hud = (lv, tm, ico) => { const r = rec(); drawHudChips(r.c, HUDW(lv), tm, ico); return r; };
const page = (f, w, h, kind, touch) => { const r = rec(); md[f](r.c, md.layout(w, h), 1.25, kind, touch); return r; };
const shell = (k, s) => { const r = rec(); drawShell(r.c, {screen: SCREEN[s], subT: 1.25}, {}, null, k, () => [], () => 0); return r; };
function unchanged(tag) {
  const bad = [];
  for (const [lv, tm] of HUDS) if (H(hud(lv, tm).log) !== PIN["hud" + lv]) bad.push("hud" + lv);
  for (const [w, h] of BOXES) for (const f of PAGES) for (const t of [false, true]) for (const k of [undefined, "2d", "3d", "iso"]) if (H(page(f, w, h, k, t).log) !== PIN[f + h + (t ? "T" : "")]) bad.push(f + h + (t ? "T" : "") + ":" + k);
  for (const k of ["2d", "3d", "iso"]) for (const s of ["HOWTO", "ITEMS", "ENEMIES"]) if (H(shell(k, s).log) !== PIN["shell." + k + "." + s]) bad.push(k + "." + s);
  check("CLASSIC 2D / REAL 3D / iso HUD chips (pre-W5) and GUIDE pages (ATLAS, keyboard + touch) match their pins (" + tag + ")", bad.length === 0, bad.join());
}
const text = (log) => log.filter((l) => /^(fillText|font=|textAlign=|textBaseline=)/.test(l)).join("\n");
const draws = (r) => r.ops.filter((o) => o[0] === "drawImage");
const integral = (d) => d[1].slice(1).every((v) => Number.isInteger(v));

// ---- CLASSIC / 3D / iso unchanged, with and without a px atlas registered ----
setPixelArt(null);
unchanged("no px art");
{
  const r = page("drawItemsHelp", 600, 520, "px");
  check("kind px with nothing registered falls back to the vector page, never throws", H(r.log) === PIN.drawItemsHelp520);
}
const A = createAtlas(surfRGBA);
setPixelArt(A);
unchanged("px art registered: it never leaks into another kind");

// ---- hudart primitives ----
{
  const f = A.items.glyph.bomb, b = opaqueBox(f);
  check("opaqueBox is the cell's opaque rect, cached per frame", b.w > 0 && b.w <= f.w && b.h <= f.h && opaqueBox(f) === b, JSON.stringify(b));
  check("scales are integers: x1 chip, x2 GUIDE, slot pad 8 (4 px a side)", HUD_S === 1 && GUIDE_S === 2 && SLOT_PAD === 8);
  const sh = foeCell(A, "shade");
  check("foe cells: front step frame, still frame, shade carries its hem overlay", foeCell(A, "walker")[0] === A.foe.walker.face[0][0] && foeCell(A, "stationary")[0] === A.foe.stationary.still[0] && sh.length === 2 && sh[1] === A.foe.shade.extra);
  const big = {im: {width: 20, height: 20, data: new Uint8ClampedArray(1600).fill(255)}, w: 20, h: 20, ax: 10, ay: 10};
  check("pageScale: one oversize cell drops the whole page to x1", pageScale([itemCell(A, "fire"), [big]], 36) === 1 && pageScale([[big]], 40) === 2);
}

// ---- HUD chips in PIXEL ----
{
  const ico = hudIcon(A);
  for (const [lv, tm] of HUDS) {
    const px = hud(lv, tm, ico), v = hud(lv, tm), d = draws(px);
    const want = Math.min(lv, 6) + 2;
    const ims = d.map((o) => o[1][0]), exp = [...Array(Math.min(lv, 6)).fill(A.items.glyph.heart.im), A.items.glyph.bomb.im, A.items.glyph.fire.im];
    check("HUD px lives " + lv + ": hearts + BOMB + FLAME glyphs are the atlas frames, by identity", d.length === want && ims.every((im, i) => im === exp[i]), d.length + "/" + want);
    check("HUD px lives " + lv + ": hearts x2, chips x1, whole logical px, smoothing off", d.every((o, i) => { const m = i < Math.min(lv, 6) ? 2 : HUD_S; return integral(o) && o[1][3] === o[1][0].width * m && o[1][4] === o[1][0].height * m && o[2] === false; }));
    check("HUD px lives " + lv + ": text identical to CLASSIC (shared vector font)", text(px.log) === text(v.log));
  }
  const d = draws(hud(1, null, ico)), f = A.items.glyph.heart, b = opaqueBox(f);
  check("HUD px heart centred on the CLASSIC heart centre (16,25) by its opaque box", d[0][1][1] === Math.round(16 - (b.x + b.w / 2) * 2) && d[0][1][2] === Math.round(25 - (b.y + b.h / 2) * 2));
}

// ---- GUIDE pages in PIXEL ----
{
  const cellsOf = {drawHowTo: () => ["bomb", "throw", "remote", "kick"].map((t) => itemCell(A, t)), drawItemsHelp: () => POWER.map((p) => itemCell(A, p.t)), drawEnemiesHelp: () => FOES.map((f) => foeCell(A, f.t))};
  const N = {drawHowTo: 4, drawItemsHelp: POWER.length, drawEnemiesHelp: FOES.length + FOES.filter((f) => f.t === "shade").length};
  const seen = {};
  for (const [w, h] of BOXES) for (const f of PAGES) {
    const px = page(f, w, h, "px"), v = page(f, w, h, "2d"), d = draws(px);
    const allowed = new Set(cellsOf[f]().flat().map((x) => x.im));
    const scales = new Set(d.map((o) => o[1][3] / o[1][0].width));
    seen[f + h] = [...scales].join();
    check(f + "@" + h + " px: every cell drawn from the live atlas (" + d.length + ")", d.length === N[f] && d.every((o) => allowed.has(o[1][0])), d.length + "/" + N[f]);
    check(f + "@" + h + " px: one integer scale for the page, whole logical px, smoothing off", scales.size === 1 && [1, 2].includes([...scales][0]) && d.every((o) => integral(o) && o[1][4] === o[1][0].height * [...scales][0] && o[2] === false), seen[f + h]);
    check(f + "@" + h + " px: text and row chrome calls identical to CLASSIC", text(px.log) === text(v.log) && px.log.filter((l) => /^strokeRect\(/.test(l)).join() === v.log.filter((l) => /^strokeRect\(/.test(l)).join());
    check(f + "@" + h + " px: no scaled vector glyph block (CLASSIC has one scale( per row, px none)", !px.log.some((l) => /^scale\(/.test(l)) && v.log.some((l) => /^scale\(/.test(l)));
  }
  check("ENEMIES at 600x520 reaches x2 (a 20-px cell at x2 fits its 32-px well + 8 slot)", seen.drawEnemiesHelp520 === "2", seen.drawEnemiesHelp520);
  console.log("  GUIDE px scales: " + JSON.stringify(seen));
  for (const s of ["HOWTO", "ITEMS", "ENEMIES"]) {
    const d = draws(shell("px", s));
    check("drawShell threads kind px into " + s + " (atlas cells drawn)", d.length > 0 && d.every((o) => o[0] === "drawImage"));
  }
}

// ---- px renderer wires the HUD painter and registers its atlas ----
{
  const r0 = rec();
  const ov = {width: 600, height: 520, getContext: () => r0.c};
  const R = createPixelRenderer(null, ov, {surf: surfRGBA});
  check("createPixelRenderer registers its atlas for the GUIDE pages", pixelArt() === R._dbg.atlas);
  const w = {players: [{bombs: 1, range: 2, x: 30, y: 30}], lives: 2, level: 1, enemies: [], heat: 0, score: 0, state: "PLAY", events: [], items: [], bombs: [], blades: [], time: 0, grid: {}};
  R.render(w, 1 / 60, {hud: true});
  const ims = draws(r0).map((o) => o[1][0]), G = R._dbg.atlas.items.glyph;
  check("px renderer draws HUD chips with the atlas glyphs (hearts, BOMB, FLAME)", [G.heart.im, G.heart.im, G.bomb.im, G.fire.im].every((im) => ims.includes(im)), ims.length);
  setPixelArt(A);
}

// ---- hygiene ----
{
  const src = (p) => readFileSync(join(ROOT, p), "utf8");
  check("scenes.js stays atlas-free (painter arrives as a parameter)", !/pixel\//.test(src("src/render/scenes.js")));
  check("hudart.js imports nothing (no bake at boot, no atlas pull)", !/^import /m.test(src("src/render/hudart.js")));
  check("hudart.js is in the PWA precache", PRECACHE.includes("./src/render/hudart.js"));
  check("shellview passes kind (and the touch layout) to the three GUIDE pages", ["drawHowTo", "drawItemsHelp", "drawEnemiesHelp"].every((f) => new RegExp("menudraw\\." + f + "\\(c, L, app\\.subT, kind, touchLay\\(canvas\\)\\)").test(src("src/render/shellview.js"))));
}

console.log("\n  PIXEL HUD/GUIDE RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
