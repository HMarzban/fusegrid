// PIXEL W5 (ruling R19): HUD item chips and GUIDE ITEMS / ENEMIES / HOW TO
// show the atlas cells in PIXEL at integer logical scale (x1 chip, x2 GUIDE
// when every cell on the page fits), text stays the shared vector font, and
// CLASSIC 2D / REAL 3D / iso call logs never change with px art (HUD pinned
// from HEAD f732450, before W5; GUIDE pages re-pinned at the 2026-10-19
// ATLAS menu pages, keyboard and touch, with no px art registered — the
// px-registered pass must hit the very same pins, so px art never leaks;
// HOW TO re-pinned 2026-10-21 for issue #6: its KICK key reads WALK INTO BOMB;
// 2026-11-02 for CONTROLS: its THROW key reads E, the one fillText that changed;
// ITEMS the same day: POWER help opens with E, and on touch both key lines name the button;
// 2026-11-10 for the player words (UI upgrade v202 Task 2.1): only fillText strings changed, same
// call count and coordinates — POWER-UPS for ITEMS / PICKUPS / CUBE, POWER BOMB, LEVELS for ROOMS,
// and HOW TO's glossary line cut to "* NEEDS ITS POWER-UP"; the HUD pins did not move;
// fix round 1: ENEMIES prints LEVEL 8, not LEVELS 8, for KNIGHT's one level, the one fillText that changed;
// Task 9.6: HOW TO on the 600 x 520 keyboard box centres its plate + foot, the log the old one with every y 31.58 design px lower, nothing else).
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as md from "../src/render/menudraw.js";
import { drawHud, hudGeom, hudState, pxScale } from "../src/render/hud.js";
import { hudGeo } from "../src/app/fit.js";
import { worldTokens } from "../src/render/kit/tokens.js";
import { drawShell } from "../src/render/shellview.js";
import { SCREEN } from "../src/app/menuapp.js";
import { POWER, FOES } from "../src/core/entities.js";
import { createAtlas } from "../src/render/pixel/atlas.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { setPixelArt, pixelArt, hudIcon, opaqueBox, itemCell, foeCell, foeAnim, itemAnim, pageScale, HUD_S, GUIDE_S, SLOT_PAD } from "../src/render/hudart.js";
import { surfRGBA } from "../tools/pixel/rgba.mjs";
import { PRECACHE } from "../src/pwa/shell.js";
import { _set as setLazyPage } from "../src/render/pages/lazy.js";
setLazyPage("guide", await import("../src/render/pages/guide.js")); // the lazy GUIDE pages (v202 Task 3.5), as if their import had landed

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
  hud0: "5188aeeb:8158", hud3: "9c9cdb21:8263", hud8: "40b3ec83:8158", // fix round 1: the HARD word left LEVEL (R1), the BOMBS glyph cream // the HUD on #hud (hud.js, UI upgrade Task 8.2)
  /* v202 Task 3.5 fix round 1: pages/guide.js's call logs, re-pinned (a 600 x 520 / 600 x 360 #c box, keyboard and touch; the shell through drawShell
     on the classic box per kind: iso keeps its own box, so its own pins) */
  drawHowTo520: "ce79d89d:21065", drawItemsHelp520: "4b731a9a:13296", drawEnemiesHelp520: "daf197f6:93094",
  drawHowTo360: "1df6ba7e:21237", drawItemsHelp360: "eb60eb99:13283", drawEnemiesHelp360: "c6e3a685:78040",
  /* R1 kit harmonisation: the paged touch pages take the kit pager (PAGE n OF m beside the keys, the glyphs centred), re-pinned; same call counts */
  drawHowTo520T: "72bdb384:28033", drawItemsHelp520T: "ed9a705f:11758", drawEnemiesHelp520T: "169bcbea:13883",
  drawHowTo360T: "f6b11d67:25944", drawItemsHelp360T: "1083cb07:10559", drawEnemiesHelp360T: "49b6f472:10106", // R1 landscape leftovers: a 600 x 360 touch #c: ENEMIES' compact tooltip never covers the page keys (the one-line points rule where the full copy does not fit) (was 5428557f:10316)
  "shell.2d.HOWTO": "ce79d89d:21065", "shell.2d.ITEMS": "4b731a9a:13296", "shell.2d.ENEMIES": "3018d168:93529",
  "shell.3d.HOWTO": "ce79d89d:21065", "shell.3d.ITEMS": "4b731a9a:13296", "shell.3d.ENEMIES": "3018d168:93529",
  "shell.iso.HOWTO": "ccc7496f:21777", "shell.iso.ITEMS": "d9f28577:13470", "shell.iso.ENEMIES": "7e158d1a:78475",
};
/* and relational: every non-PIXEL kind (none, 2d, 3d, iso) paints the identical page call log, with or without a px atlas registered */
const GPIN = {};
/* the HUD (hud.js, UI upgrade Task 8.2) on the 1366x768 desktop slots; px = the PIXEL look (its glyphs are the registered atlas's cells) */
const HG = hudGeo(1366, 768, 600, 520, "d");
const hudG = (lv, tm) => { const r = rec(), st = hudState({...HUDW(lv), state: "PLAY"}, {time: tm || {t: 0}}); return {r, st, G: hudGeom(r.c, HG, st, {w: 1366, h: 768})}; };
const hud = (lv, tm, px) => { const {r, st, G} = hudG(lv, tm); drawHud(r.c, G, st, worldTokens(4), {px: !!px}); r.G = G; return r; };
const page = (f, w, h, kind, touch) => { const r = rec(); md[f](r.c, md.layout(w, h), 1.25, kind, touch); return r; };
const shell = (k, s) => { const r = rec(); drawShell(r.c, {screen: SCREEN[s], subT: 1.25}, {}, null, k, () => [], () => 0); return r; };
function unchanged(tag) {
  const bad = [];
  for (const [lv, tm] of HUDS) if (H(hud(lv, tm).log) !== PIN["hud" + lv]) bad.push("hud" + lv);
  for (const [w, h] of BOXES) for (const f of PAGES) for (const t of [false, true]) for (const k of [undefined, "2d", "3d", "iso"]) { const id = f + h + (t ? "T" : ""), v = H(page(f, w, h, k, t).log); if (!(id in GPIN)) GPIN[id] = v; if (GPIN[id] !== v || PIN[id] !== v) bad.push(id + ":" + k + "=" + v); }
  for (const k of ["2d", "3d", "iso"]) for (const s of ["HOWTO", "ITEMS", "ENEMIES"]) { const v = H(shell(k, s).log); if (PIN["shell." + k + "." + s] !== v) bad.push(k + "." + s + "=" + v); }
  check("the HUD's vector glyphs (CLASSIC 2D, REAL 3D, iso) and GUIDE pages (ATLAS, keyboard + touch) match their pins (" + tag + ")", bad.length === 0, bad.join());
}
const text = (log) => log.filter((l) => /^(fillText|font=|textAlign=|textBaseline=)/.test(l)).join("\n");
const draws = (r) => r.ops.filter((o) => o[0] === "drawImage");
const integral = (d) => d[1].slice(1).every((v) => Number.isInteger(v));

// ---- CLASSIC / 3D / iso unchanged, with and without a px atlas registered ----
setPixelArt(null);
unchanged("no px art");
{
  const r = page("drawItemsHelp", 600, 520, "px");
  check("kind px with nothing registered falls back to the vector page, never throws", H(r.log) === GPIN.drawItemsHelp520 && H(r.log) === H(page("drawItemsHelp", 600, 520, "2d").log));
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

// ---- HUD chips in PIXEL (the HUD on #hud, hud.js): the atlas cells by identity, x1, whole px, smoothing off, text as CLASSIC ----
{
  for (const [lv, tm] of HUDS) {
    const px = hud(lv, tm, true), v = hud(lv, tm), d = draws(px), n = lv >= 1 && lv <= 5 ? lv : 1;
    const ims = d.map((o) => o[1][0]), exp = [...Array(n).fill(A.items.glyph.heart.im), A.items.glyph.bomb.im, A.items.glyph.fire.im];
    check("HUD px lives " + lv + ": hearts + BOMBS + FLAME glyphs are the atlas frames, by identity, then the foe cell", d.length === n + 3 && exp.every((im, i) => ims[i] === im), d.length + "/" + (n + 3));
    check("HUD px lives " + lv + ": every cell at one whole scale (as large as fits its glyph box, by its opaque rect), whole logical px, smoothing off", d.every((o) => { const k = o[1][3] / o[1][0].width; return Number.isInteger(k) && k >= 1 && o[1][4] === o[1][0].height * k && integral(o) && o[2] === false; }) && d.some((o) => o[1][3] / o[1][0].width >= 2));
    check("HUD px lives " + lv + ": text identical to CLASSIC (shared kit type)", text(px.log) === text(v.log));
  }
  const r = hud(1, null, true), d = draws(r), f = A.items.glyph.heart, b = opaqueBox(f), c = r.G.chips.lives, s = 22, k = pxScale(f, s);
  check("HUD px heart centred on the CLASSIC heart's centre (its glyph box) by its opaque box", d[0][1][1] === Math.round(c.x + 10 + s / 2 - (b.x + b.w / 2) * k), JSON.stringify(d[0][1].slice(1)));
}

// ---- GUIDE cells move in PIXEL (pure function of the page clock) ----
{
  let moving = 0;
  for (const f of FOES) {
    if (foeAnim(A, f.t, 0.4).fs.some((x, j) => x !== foeAnim(A, f.t, 0.4 + 0.5).fs[j]) || foeAnim(A, f.t, 0.4).fs.length !== foeAnim(A, f.t, 0.9).fs.length) moving++;
  }
  check("PIXEL guide foes animate: most frames change within 0.5 s", moving >= FOES.length - 2, moving + "/" + FOES.length);
  check("PIXEL guide foes and pickups are deterministic (same time, same frames)", FOES.every((f) => foeAnim(A, f.t, 1.37).fs.every((x, j) => x === foeAnim(A, f.t, 1.37).fs[j])) && POWER.every((p) => itemAnim(A, p.t, 2.2).fs.every((x, j) => x === itemAnim(A, p.t, 2.2).fs[j])));
  check("PIXEL guide reads the board's own rates (the atlas carries pixel/timing.js PX_T)", A.timing && A.timing.FLAME_FPS === 10 && A.timing.RING_FPS === 2);
  check("PIXEL guide blink follows the motion spec input (o.blink picks the blink twin)", FOES.some((f) => { const a = foeAnim(A, f.t, 0.3, { idleW: 3, blink: true }).fs[0], b = foeAnim(A, f.t, 0.3, { idleW: 3, blink: false }).fs[0]; return a !== b && b.blink === a; }));
  check("PIXEL guide pickups carry ring + glyph and hover at most one art px", POWER.every((p) => { const a = itemAnim(A, p.t, 0.7); return a.fs.length === 2 && a.fs[1] === A.items.glyph[p.t] && Math.abs(a.dy) <= 1; }));
}
// ---- GUIDE pages in PIXEL ----
{
  const cellsOf = {drawHowTo: () => ["bomb", "throw", "remote", "kick"].map((t) => itemCell(A, t)), drawItemsHelp: () => POWER.map((p) => itemCell(A, p.t)), drawEnemiesHelp: () => FOES.map((f) => foeCell(A, f.t))};
  /* v202 Task 3.5: the cells are baked at a fixed time (only ENEMIES' focused foe animates), so a pickup is its glyph alone; HOW TO adds the walker on
     its first rule's slab */
  const N = {drawHowTo: 5, drawItemsHelp: POWER.length, drawEnemiesHelp: FOES.length + FOES.filter((f) => f.t === "shade" || f.t === "burrow").length};
  const imsOf = (o, out = new Set(), seen = new Set()) => { if (!o || typeof o !== "object" || seen.has(o)) return out; seen.add(o); if (o.im) out.add(o.im); for (const k in o) imsOf(o[k], out, seen); return out; };
  const seen = {};
  for (const [w, h] of BOXES) for (const f of PAGES) {
    const px = page(f, w, h, "px"), v = page(f, w, h, "2d"), d = draws(px);
    const allowed = imsOf(f === "drawEnemiesHelp" ? A.foe : f === "drawHowTo" ? [A.items, A.foe] : A.items);
    const scales = new Set(d.map((o) => o[1][3] / o[1][0].width));
    seen[f + h] = [...scales].join();
    check(f + "@" + h + " px: every cell drawn from the live atlas (" + d.length + ")", d.length === N[f] && d.every((o) => allowed.has(o[1][0])), d.length + "/" + N[f]);
    check(f + "@" + h + " px: one integer scale for the page, whole logical px, smoothing off", scales.size === 1 && [1, 2].includes([...scales][0]) && d.every((o) => integral(o) && o[1][4] === o[1][0].height * [...scales][0] && o[2] === false), seen[f + h]);
    check(f + "@" + h + " px: text and row chrome calls identical to CLASSIC", text(px.log) === text(v.log) && px.log.filter((l) => /^strokeRect\(/.test(l)).join() === v.log.filter((l) => /^strokeRect\(/.test(l)).join());
    const sc = (r) => r.log.filter((l) => /^scale\(/.test(l)).length; // the floor and wall cells under the art stay the board's vector painters in every look
    check(f + "@" + h + " px: no scaled vector glyph block (CLASSIC scales once per art cell, px blits instead)", sc(v) - sc(px) >= N[f] - FOES.filter((q) => f === "drawEnemiesHelp" && (q.t === "shade" || q.t === "burrow")).length, sc(v) + " vs " + sc(px));
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
  setPixelArt(A);
  const R = createPixelRenderer(null, ov, {surf: surfRGBA});
  check("createPixelRenderer leaves the GUIDE pages' art alone until activate (v202)", pixelArt() === A && !R._dbg.built);
  R.activate();
  check("activate() registers its atlas for the GUIDE pages", pixelArt() === R._dbg.atlas && pixelArt() !== A);
  const w = {players: [{bombs: 1, range: 2, x: 30, y: 30}], lives: 2, level: 1, enemies: [], heat: 0, score: 0, state: "PLAY", events: [], items: [], bombs: [], blades: [], time: 0, grid: {}};
  R.render(w, 1 / 60, {hud: true});
  const ims = draws(r0).map((o) => o[1][0]), G = R._dbg.atlas.items.glyph;
  check("px renderer draws no HUD chip on its overlay (the HUD is on #hud)", ![G.heart.im, G.bomb.im, G.fire.im].some((im) => ims.includes(im)), ims.length);
  const hp = hud(2, null, true), hims = draws(hp).map((o) => o[1][0]);
  check("the HUD in the PIXEL look blits the renderer's registered atlas (hearts, BOMBS, FLAME)", [G.heart.im, G.bomb.im, G.fire.im].every((im) => hims.includes(im)), hims.length);
  setPixelArt(A);
}

// ---- hygiene ----
{
  const src = (p) => readFileSync(join(ROOT, p), "utf8");
  check("scenes.js stays atlas-free (painter arrives as a parameter)", !/pixel\//.test(src("src/render/scenes.js")));
  check("hudart.js imports nothing (no bake at boot, no atlas pull)", !/^import /m.test(src("src/render/hudart.js")));
  check("hudart.js is in the PWA precache", PRECACHE.includes("./src/render/hudart.js"));
  check("shellview passes kind (and the touch layout) to the GUIDE pages", ["drawHowTo", "drawItemsHelp", "drawEnemiesHelp", "drawFloorHelp"].every((f) => new RegExp("menudraw\\." + f + "\\b").test(src("src/render/shellview.js"))) && /\(c, LG, app\.subT, kind, t, o\)/.test(src("src/render/shellview.js")) && /const t = touchLay\(canvas\), LG = /.test(src("src/render/shellview.js")));
}

console.log("\n  PIXEL HUD/GUIDE RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
