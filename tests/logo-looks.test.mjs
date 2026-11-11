/* Task 7.3: logo B in PIXEL and REAL 3D. The look is picked through a setter seam in draw2d.js (setLogoLook from shellview with the look on screen,
   registerLogo from each lazy tree when it loads): PIXEL is src/render/pixel/logo.js over the palette-slot grids in pixel/art/logo.js, REAL 3D is
   src/render/logo/draw3d.js, three-free, loaded with the look by three/load.js. Every canvas is a stub (tests/lib/textrec.mjs under a wrapper that
   logs calls in one sequence per canvas), as in tests/logo-2d.test.mjs. Import order matters: draw2d first, then the PIXEL tree, then draw3d. */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rec } from "./lib/textrec.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
const src = (p) => readFileSync(join(ROOT, p), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const EDGE = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^;"']*?\sfrom\s*)?["']([^"']+)["']/g;
const edges = (p) => [...strip(src(p)).matchAll(EDGE)].map((m) => m[1]);

const made = [];
function wrap(r, cv) {
  const seq = [];
  const ctx = new Proxy(r.ctx, {
    get(t, k) { const v = t[k]; if (typeof v !== "function") return v; return (...a) => { const e = { op: String(k), a }; if (e.op === "drawImage") e.m = t.getTransform(); seq.push(e); return v(...a); }; },
    set(t, k, v) { seq.push({ set: String(k), v }); t[k] = v; return true; },
  });
  return { ctx, seq };
}
class Cv { constructor(w, h) { this.width = w; this.height = h; this.r = rec(); const x = wrap(this.r, this); this.ctx = x.ctx; this.seq = x.seq; made.push(this); } getContext() { return this.ctx; } }
const target = () => { const r = rec(), x = wrap(r, "target"); return { ...r, ctx: x.ctx, seq: x.seq }; };
globalThis.OffscreenCanvas = Cv;
const cache = await import("../src/render/kit/cache.js");
cache.setFactory((w, h) => new Cv(w, h));
const { BIOMES } = await import("../src/core/config.js");
const D = await import("../src/render/logo/draw2d.js");
D._dbg.on = true;
const md = await import("../src/render/menudraw.js");
const kp = await import("../src/render/kit/probe.js");
const NAMES = BIOMES.map((b) => b.name), YEL = "#ffd447";
const blits = (t) => t.seq.filter((s) => s.op === "drawImage");
const destOf = (b) => (b.a.length === 9 ? { x: b.a[5], y: b.a[6], w: b.a[7], h: b.a[8] } : { x: b.a[1], y: b.a[2], w: b.a[3], h: b.a[4] });
const T0 = md.titleLogoBox(600, 520, "d"), TP = md.titleLogoBox(600, 520, "p");
const TITLE = (level, o = {}) => ({ level, place: "title", box: T0.box, cy: T0.cy, dev: T0.dev, dpr: 1, t: 0, ...o });
const MENU = (level, o = {}) => ({ level, place: "menu", box: { x: -284, y: -81, w: 568, h: 91 }, dpr: 2, t: 0, ...o });
const draw = (o) => { const t = target(), m0 = cache._dbg.misses, n0 = made.length, r = D.drawLogo2d(t.ctx, o); return { r: r && { ...r }, t, miss: cache._dbg.misses - m0, cvs: made.slice(n0) }; };
const styles = (cvs) => cvs.flatMap((cv) => cv.r.paints.map((p) => String(p.style).toLowerCase()));

/* the seam and the imports */
{
  check("draw2d.js exports the look seam (setLogoLook, registerLogo, logoLook) and the shared plate painter", ["setLogoLook", "registerLogo", "logoLook", "paintPlate", "logoProbe"].every((k) => typeof D[k] === "function"));
  const d3 = edges("src/render/logo/draw3d.js");
  check("draw3d.js imports nothing from vendor/ or render/three (only ./glyphs, ./worlds, ./draw2d)", d3.length > 0 && d3.every((p) => /^\.\/(glyphs|worlds|draw2d)\.js$/.test(p)), J(d3));
  check("three/wrapper.js imports no logo/", !edges("src/render/three/wrapper.js").some((p) => /logo\//.test(p)) && !/logo\//.test(strip(src("src/render/three/wrapper.js")).match(/import[^;]*/g)?.join("") || ""));
  check("three/load.js loads draw3d.js with the REAL 3D look (a dynamic import beside wrapper.js; a failed logo never fails the look)", /import\("\.\/wrapper\.js"\)/.test(src("src/render/three/load.js")) && /import\("\.\.\/logo\/draw3d\.js"\)\.catch/.test(src("src/render/three/load.js")) && edges("src/render/three/load.js").length === 0);
  check("the PIXEL logo hangs off the px renderer (pixel/renderer.js imports ./logo.js) and never imports vendor/ or render/three", edges("src/render/pixel/renderer.js").includes("./logo.js") && edges("src/render/pixel/logo.js").every((p) => !/vendor|three/.test(p)));
  check("the logo is not in the boot graph's px or 3D trees: draw2d.js imports neither look", !edges("src/render/logo/draw2d.js").some((p) => /draw3d|pixel/.test(p)));
  const BAN = /\.filter\s*=|shadowBlur|shadowColor|getImageData|putImageData|toDataURL/;
  check("no filter, shadow or pixel read in draw3d.js, pixel/logo.js or pixel/art/logo.js", ["src/render/logo/draw3d.js", "src/render/pixel/logo.js", "src/render/pixel/art/logo.js"].every((p) => !BAN.test(strip(src(p)))));
}

/* PIXEL: palette slots only, the appendix's grids, the byte budget */
const art = await import("../src/render/pixel/art/logo.js");
const { resolveSlot } = await import("../src/render/pixel/palette.js");
{
  const hex = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/;
  check("pixel/logo.js and pixel/art/logo.js hold no hex: every colour is a palette slot", !hex.test(strip(src("src/render/pixel/logo.js"))) && !hex.test(src("src/render/pixel/art/logo.js")));
  const T = src("docs/superpowers/specs/2026-11-10-ui-upgrade-v202-tables.md").split("\n"), at = (re) => T.findIndex((l) => re.test(l));
  const b0 = at(/^logo_bomb18 \(18x18\)/), b18 = [], b11 = [];
  for (let i = b0 + 1; i < b0 + 19; i++) { const [a, b] = T[i].trim().split(/\s+/); b18.push(a); if (b) b11.push(b); }
  const s0 = at(/^A: \.\.s\.\./), sA = [], sB = [];
  for (let i = s0; i < s0 + 5; i++) { const p = T[i].replace(/^[AB]:/, "").replace(/B:/, "").trim().split(/\s+/); sA.push(p[0]); sB.push(p[1]); }
  const g0 = at(/^F\(7\)\s+U\(8\)/), G = { F: [], U: [], S: [], E: [], G: [], R: [], I: [], D: [] };
  for (let i = g0 + 1; i < g0 + 13; i++) T[i].trim().split(/\s+/).forEach((r, k) => G["FUSEGRID"[k]].push(r));
  check("the 12-cap glyphs are the appendix 8.7 hand grids, row for row", Object.keys(G).every((k) => J(art.G12[k]) === J(G[k])), J(Object.keys(G).filter((k) => J(art.G12[k]) !== J(G[k]))));
  check("logo_bomb18 and logo_bomb11 are the appendix 8.6 grids, row for row", J(art.BOMB[18]) === J(b18) && J(art.BOMB[11]) === J(b11) && b18.length === 18 && b11.length === 11);
  check("the 5x5 spark frames A and B are the appendix 8.7 grids", J(art.SPARK5) === J([sA, sB]));
  check("the bomb letters map to bomb.js slots", J(art.BPAL) === J({ o: "stroke", k: "bomb", r: "pow.line.outline", q: "pow.shield.outline", h: "pow.line.shadow", w: "spec" }));
  const bytes = ["src/render/pixel/logo.js", "src/render/pixel/art/logo.js"].reduce((a, p) => a + Buffer.byteLength(src(p)), 0);
  console.log("    PIXEL logo bytes in the px tree: " + bytes);
  /* the PIXEL logo's sub-budget of the px tree is 9 KB (lead ruling, fix round 1 of Task 7.3; the plan said 8 KB) */
  const PIN = 9216;
  check("the PIXEL logo stays inside its 9 KB sub-budget of the px tree (" + bytes + " B <= " + PIN + " B)", bytes <= PIN, bytes);
}

/* the swap: PIXEL picked, px tree not loaded -> CLASSIC; the tree lands -> PIXEL on the next frame, never a blank one */
{
  D.setLogoLook("px");
  cache.release();
  const f1 = draw(TITLE(1)), f1b = draw(TITLE(1));
  check("PIXEL picked with the px tree unloaded: the title paints the CLASSIC build (look 2d), logo and spark both blitted", f1.r.look === "2d" && blits(f1.t).length === 2 && f1b.miss === 0, J([f1.r.look, blits(f1.t).length, f1b.miss]));
  await import("../src/render/pixel/renderer.js");
  const f2 = draw(TITLE(1)), f3 = draw(TITLE(1));
  check("the px tree lands: the very next frame paints the PIXEL build (no blank frame: its logo and spark are blitted in that same call)", f2.r.look === "px" && blits(f2.t).length === 2 && f2.miss >= 1, J([f2.r.look, blits(f2.t).length, f2.miss]));
  check("then a steady PIXEL frame: 0 cache misses, two blits", f3.r.look === "px" && f3.miss === 0 && blits(f3.t).length === 2, J([f3.miss, blits(f3.t).length]));
  D.setLogoLook("2d");
  check("back on CLASSIC, the CLASSIC build again", draw(TITLE(1)).r.look === "2d");
  D.setLogoLook("iso");
  check("iso (no logo of its own) paints CLASSIC", draw(TITLE(1)).r.look === "2d");
}

const PX = await import("../src/render/pixel/logo.js");
/* PIXEL bakes: every slot resolves, CROWN keeps clear of the spark yellow, MENU has no yellow but the spark */
{
  const bad = [], crown = [], near = (h) => { const a = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), y = [255, 212, 71]; return a.every((v, i) => Math.abs(v - y[i]) <= 6); };
  for (const [i, wn] of NAMES.entries()) for (const [A, st, ti] of [[24, false, "title"], [24, true, "title"], [12, false, "menu"]]) {
    const col = PX._bake(A, st, wn, ti), biome = BIOMES[i], slots = [...new Set(col.filter(Boolean))];
    for (const s of slots) { const h = resolveSlot(s, { biome }); if (!h) bad.push([wn, A, s]); else if (wn === "CROWN" && /^tile\./.test(s) && near(h)) crown.push([s, h]); }
    if (ti === "menu" && slots.some((s) => /^spark\b|^spark\./.test(s) && s.split(".")[0] === "spark" && !/shadow/.test(s))) bad.push([wn, "menu wears the spark face", slots.filter((s) => /^spark/.test(s))]);
  }
  check("every PIXEL bake (8 worlds x title line, title stacked, MENU) is palette slots that resolve in its world", bad.length === 0, J(bad.slice(0, 4)));
  check("CROWN: no PIXEL motif or side slot lands within 6 per channel of #ffd447 (brickA is never used)", crown.length === 0, J(crown));
  D.setLogoLook("px");
  const yel = [];
  for (let l = 1; l <= 8; l++) { cache.release(); const f = draw(MENU(l)), w = D._dbg.last.world, s = D._dbg.last.spark; if (styles(f.cvs.filter((cv) => cv !== s)).some((x) => x === YEL)) yel.push(l); }
  check("MENU in PIXEL: no #ffd447 anywhere but the spark sprite, all 8 worlds (cream eye faces)", yel.length === 0, J(yel));
  /* true scale (appendix 8.7: the cap is A art px, MENU 12 x3 = 36): the art's own height (A + its envelope, 24 at 12, 43 at 24) at cap / A; the
     PIXEL canvas is taller and wider than CLASSIC's envelope, so the layer grows round it instead of shrinking the art */
  const art = (o, A, H) => { cache.release(); const f = draw(o), wv = D._dbg.last.world, b = wv.seq.filter((s) => s.op === "drawImage").at(-1), k = o.k || 1; return [destOf(b).h / (o.dpr * k), (H * f.r.capL) / A, f]; };
  const Lm = md.layout(1366, 768), mg = md.menuGeom(Lm, 7, false), [mh, me, mf] = art({ level: 1, place: "menu", box: mg.lbox, k: mg.lk, dpr: 2, t: 0 }, 12, 24), [th, te] = art(TITLE(1), 24, 43);
  check("PIXEL at true scale: MENU on the desktop #sh at cap 36 / 12, the 600x520 title at cap / 24 (no shrink to CLASSIC's envelope)", Math.abs(mh - me) < 1e-6 && Math.abs(th - te) < 1e-6 && mf.r.capL === 36, J([mh, me, th, te, mf.r.capL]));
}

/* REAL 3D: registered on import, three-free, same placement */
const D3 = await import("../src/render/logo/draw3d.js");
{
  D.setLogoLook("3d");
  cache.release();
  const a = draw(TITLE(1)), b = draw(TITLE(1));
  check("REAL 3D: draw3d.js registers on import; the title paints the 3D build, then a steady frame with 0 misses", a.r.look === "3d" && blits(a.t).length === 2 && b.miss === 0 && blits(b.t).length === 2, J([a.r.look, b.miss]));
  const yel = [];
  for (let l = 1; l <= 8; l++) { cache.release(); const f = draw(MENU(l)), s = D._dbg.last.spark; if (styles(f.cvs.filter((cv) => cv !== s)).some((x) => x === YEL)) yel.push(l); }
  check("MENU in REAL 3D: no #ffd447 anywhere but the spark sprite, all 8 worlds", yel.length === 0, J(yel));
  const seqs = made.flatMap((cv) => cv.seq), w = seqs.filter((s) => s.set && /^(filter|shadowBlur|shadowColor)$/.test(s.set)), r = seqs.filter((s) => /^(getImageData|putImageData|toDataURL)$/.test(s.op || ""));
  check("runtime, every look so far: no filter or shadow write, no pixel read, on " + made.length + " canvases", w.length === 0 && r.length === 0, J([w.length, r.length]));
  const before = D._dbg.last.world;
  D3.SIDE.variant = "lip"; D.registerLogo("3d", D3.look3d);
  const v = draw(TITLE(1));
  check("the spec's side variant (lip hex to x 0.80, the owner's veto option) is its own cached layer", v.miss >= 1 && D._dbg.last.world !== before);
  D3.SIDE.variant = "mix"; D.registerLogo("3d", D3.look3d);
}

/* the painted extent of the PIXEL MENU build: the inked rows and columns of all 8 worlds' bakes (art px, line build, 12 cap, 24 rows) */
let INK = null;
function inkPx() {
  if (INK) return INK;
  const H = 24, cols = NAMES.map((wn) => PX._bake(12, false, wn, "menu")), W = cols[0].length / H, r = { W, H, x0: W, x1: -1, y0: H, y1: -1 };
  for (const col of cols) col.forEach((c, k) => { if (!c) return; const x = k % W, y = (k / W) | 0; r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x); r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y); });
  return (INK = r);
}
/* both looks: inside every call-site box, reduced motion still, spark on the cord tip */
{
  const inBox = (r, B) => r.x >= B.x - 1e-6 && r.y >= B.y - 1e-6 && r.x + r.w <= B.x + B.w + 1e-6 && r.y + r.h <= B.y + B.h + 1e-6;
  const cases = [];
  for (const [Wd, Hd] of [[600, 520], [608, 352]]) for (const lay of ["d", "l", "p"]) for (const dpr of [1, 2]) { const T = md.titleLogoBox(Wd, Hd, lay); cases.push(["title " + Wd + "x" + Hd + " " + lay + " dpr " + dpr, { level: 2, place: "title", box: T.box, cy: T.cy, dev: T.dev, dpr, t: 0 }]); }
  const { shellGeo } = await import("../src/app/fit.js");
  /* PLAY's focus ring stands RING design px above its key (kit/paint.js: the ring's outer edge 4.5 + 3 / 2 outside it, a lit key lifted 2) */
  const RING = 8, compact = [];
  for (const [nm, bw, bh, dpr, touch, lg, css] of [["#c 600x520", 600, 520, 1, false], ["#sh 1366x768", 1366, 768, 2, false], ...[[393, 852], [360, 640]].map(([w, h]) => { const g = shellGeo(w, h, 600, 520, "p"); return ["#sh phone " + w + "x" + h, g.w, g.h, 3, true, g.logo]; }),
    ["#c compact 600x520 css 0.62 (a 568x320 phone)", 600, 520, 1, true, undefined, 0.62], ["#c compact 608x352 css 0.9 (the below: 8 end)", 608, 352, 1, true, undefined, 0.9]]) {
    const L = md.layout(bw, bh, lg, css || (touch ? 0.9 : undefined)), m = md.menuGeom(L, 7, touch);
    if (css) compact.push(m.mode);
    cases.push(["MENU " + nm, { level: 8, place: "menu", box: m.lbox, k: m.lk, dpr, touch, t: 0 }, { x: m.lbox.x, y: (m.plate.y + m.T) / m.lk, w: m.lbox.w, h: (m.rows.PLAY.y - RING * m.u - m.plate.y - m.T) / m.lk }]);
  }
  check("the two compact touch boxes really are MENU's compact arrangement", compact.length === 2 && compact.every((x) => x === "compact"), J(compact));
  for (const lk of ["px", "3d"]) {
    D.setLogoLook(lk);
    const out = [];
    for (const [nm, o, head] of cases) {
      cache.release();
      const f = draw(o), b = blits(f.t), L0 = destOf(b[0]), S0 = destOf(b[1]);
      if (f.r.look !== lk || b.length !== 2) { out.push([nm, f.r.look, b.length]); continue; }
      if (!(lk === "px" && head)) { if (!inBox(L0, o.box) || !inBox(S0, o.box)) out.push([nm, J([L0, S0])]); continue; }
      /* PIXEL MENU: the layer keeps the box's width; what it PAINTS (the 8 worlds' inked rows and columns, and the spark) stays in the header */
      const wv = D._dbg.last.world, a = destOf(wv.seq.filter((q) => q.op === "drawImage").at(-1)), sx = L0.w / wv.width, sy = L0.h / wv.height, ink = inkPx();
      const P = { x: L0.x + (a.x + ink.x0 * a.w / ink.W) * sx, y: L0.y + (a.y + ink.y0 * a.h / ink.H) * sy, w: (ink.x1 - ink.x0 + 1) * (a.w / ink.W) * sx, h: (ink.y1 - ink.y0 + 1) * (a.h / ink.H) * sy };
      if (L0.x < o.box.x - 1e-6 || L0.x + L0.w > o.box.x + o.box.w + 1e-6 || !inBox(P, head) || !inBox(S0, head)) out.push([nm, J({ P, S0, head })]);
    }
    check(lk + ": " + cases.length + " call-site boxes (title 600x520 / 608x352 x d l p x dpr 1 2, MENU #c, #sh, phones, two compact): logo layer and spark inside the box" + (lk === "px" ? " (MENU: the layer keeps the box's width; its taller envelope is mostly blank, and what it paints stays inside the plate's header, under its ring and above PLAY's focus ring)" : ""), out.length === 0, J(out.slice(0, 2)));
    cache.release();
    const s0 = blits(draw(TITLE(1, { reduced: true, t: 0 })).t)[1].a.slice(1, 3), s1 = blits(draw(TITLE(1, { reduced: true, t: 1 / 28 })).t)[1].a.slice(1, 3);
    const l0 = blits(draw(TITLE(1, { t: 0 })).t)[1].a.slice(1, 3), l1 = blits(draw(TITLE(1, { t: 1 / 14 })).t)[1].a.slice(1, 3);
    check(lk + ": REDUCE FLASH holds the reduced spark still; live, frames A and B alternate at 14 Hz", J(s0) === J(s1) && s0[0] > 0 && J(l0) !== J(l1), J([s0, s1, l0, l1]));
  }
}

/* shellview, by behaviour: drawShell sets the logo's look from the kind it is handed (the look on screen) and flushes the logo's probe record
   after the page, so the title's record names the look that painted */
{
  const sv = await import("../src/render/shellview.js"), { SCREEN } = await import("../src/app/menuapp.js");
  const app = { screen: SCREEN.INTRO, introStage: 0, subT: 1.2, level: 1, boardReady: true, readyT: 1, settings: {} }, cv = { width: 600, height: 520 };
  const looks = [];
  kp.setOn(true);
  for (const kind of ["px", "3d", "2d", "iso"]) { cache.release(); sv.drawShell(target().ctx, app, {}, cv, kind, () => [], () => [], () => ({})); const s = kp.snapshot(); looks.push(s.page + ":" + (s.rects.find((r) => /^logo (2d|px|3d)$/.test(r.name)) || {}).name); }
  kp.setOn(false);
  check("shellview: drawShell hands the logo the kind on screen and flushes its probe record after the page (title px, 3d, 2d; iso paints CLASSIC)", J(looks) === J(["title:logo px", "title:logo 3d", "title:logo 2d", "title:logo 2d"]), J(looks));
  D.setLogoLook("2d");
}

/* the Chrome face gate's record: under the probe, after a page begins, the logo names its look and each face against bare bed (lock 3:1) */
{
  D.setLogoLook("px");
  kp.setOn(true);
  kp.begin("title", { w: 600, h: 520, dpr: 1, el: "c" });
  cache.release();
  draw(TITLE(1));
  D.logoProbe();
  const s = kp.snapshot(), info = s.pairs.filter((p) => p.kind === "info" && /^logo /.test(p.name));
  check("probe: the title records 'logo px', the plate with its ring, both faces (#ffd447 FUSE, #ff5d73 GRID) and two locked info pairs against the bed", s.rects.some((r) => r.name === "logo px") && s.rects.some((r) => r.name === "logo plate" && r.plate > 0) && info.length === 2 && info.every((p) => p.lock === true) && J(info.map((p) => p.col)) === J([YEL, "#ff5d73"]), J({ rects: s.rects.map((r) => r.name), info: info.map((p) => [p.col, p.lock]) }));
  const bed = info[0].b, logo = s.rects.find((r) => r.name === "logo px"), plate = s.rects.find((r) => r.name === "logo plate");
  check("probe: the bed strip lies inside the plate and clear of the logo canvas (the plate's left pad)", bed.x >= plate.x && bed.x + bed.w <= logo.x + 1e-6 && bed.w > 0 && bed.h > 0, J({ bed, logo, plate }));
  kp.setOn(false);
  draw(TITLE(1));
  D.logoProbe();
  check("probe off: nothing is held or recorded (one boolean test a frame)", kp.snapshot().pairs.length === 0);
  kp.setOn(true);
  for (let i = 0; i < 20; i++) draw(TITLE(1));
  kp.begin("title", { w: 600, h: 520, dpr: 1, el: "c" });
  D.logoProbe();
  const held = kp.snapshot().rects.filter((r) => /^logo (2d|px|3d)$/.test(r.name)).length;
  kp.setOn(false);
  check("probe: a caller that never flushes holds at most 8 logo records (20 draws, then one flush)", held > 0 && held <= 8, held);
  D.setLogoLook("2d");
}

console.log("\n  LOGO-LOOKS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
