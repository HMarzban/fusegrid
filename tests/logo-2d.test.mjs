/* Task 7.2: logo B in CLASSIC 2D (src/render/logo/draw2d.js), drawn from plan()'s layer list through kit/cache.js layers, the spark a live sprite.
   Every canvas is a stub (tests/lib/textrec.mjs under a wrapper that logs calls and property writes in one sequence); globalThis.OffscreenCanvas and
   the cache's factory both make it, so the painter's canvas rule and the cache agree. */
import { readFileSync, existsSync } from "node:fs";
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
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

const made = [];
function wrap(r) {
  const seq = [];
  const ctx = new Proxy(r.ctx, {
    get(t, k) { const v = t[k]; return typeof v === "function" ? (...a) => { seq.push({ op: String(k), a }); return v(...a); } : v; },
    set(t, k, v) { seq.push({ set: String(k), v }); t[k] = v; return true; },
  });
  return { ctx, seq };
}
class Cv {
  constructor(w, h) { this.width = w; this.height = h; this.r = rec(); const x = wrap(this.r); this.ctx = x.ctx; this.seq = x.seq; made.push(this); }
  getContext() { return this.ctx; }
}
const target = () => { const r = rec(), x = wrap(r); return { ...r, ctx: x.ctx, seq: x.seq }; };
globalThis.OffscreenCanvas = Cv;
const cache = await import("../src/render/kit/cache.js");
cache.setFactory((w, h) => new Cv(w, h));
const { BIOMES } = await import("../src/core/config.js");
const W = await import("../src/render/logo/worlds.js");
const G = await import("../src/render/logo/glyphs.js");
const D = await import("../src/render/logo/draw2d.js").catch((e) => { check("draw2d.js loads under Node", false, e.message); return null; });
const md = await import("../src/render/menudraw.js");
const NAMES = BIOMES.map((b) => b.name);
const YEL = "#ffd447";

/* (h) the painter's own imports */
{
  const f = join(ROOT, "src/render/logo/draw2d.js"), strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const EDGE = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^;"']*?\sfrom\s*)?["']([^"']+)["']/g;
  const own = existsSync(f) ? [...strip(readFileSync(f, "utf8")).matchAll(EDGE)].map((m) => m[1]) : [];
  check("(h) draw2d.js imports only ./glyphs.js, ./worlds.js and ../kit/*", own.length > 0 && own.every((p) => p === "./glyphs.js" || p === "./worlds.js" || /^\.\.\/kit\/[a-z]+\.js$/.test(p)), J(own));
  check("(h) no src/app, vendor, three or board3 anywhere in it", !own.some((p) => /app\/|vendor|three|board3/.test(p)));
  check("(h) three/wrapper.js still imports nothing from logo/", !/logo\//.test(strip(readFileSync(join(ROOT, "src/render/three/wrapper.js"), "utf8")).match(/import[^;]*/g)?.join("") || ""));
  /* (e) source scan, comments stripped, on assignment and call patterns (Array.prototype.filter is no canvas filter) */
  const BAN = /\.filter\s*=|shadowBlur|shadowColor|getImageData|putImageData|toDataURL|backdrop-filter/;
  const bad = ["draw2d.js", "glyphs.js", "worlds.js"].filter((n) => { const p = join(ROOT, "src/render/logo", n); return existsSync(p) && BAN.test(strip(readFileSync(p, "utf8"))); });
  check("(e) no filter, shadow, getImageData or toDataURL in src/render/logo/", bad.length === 0, bad.join());
}

if (D) {
  const { drawLogo2d, _dbg } = D;
  const draw = (o, t = target()) => { const n0 = made.length, m0 = cache._dbg.misses; const r = drawLogo2d(t.ctx, o); return { r, t, cvs: made.slice(n0), miss: cache._dbg.misses - m0 }; };
  const paintsOf = (cv) => cv.r.paints;
  const styles = (cvs) => cvs.flatMap((cv) => paintsOf(cv).map((p) => String(p.style).toLowerCase()));
  const blits = (t) => t.seq.filter((s) => s.op === "drawImage");
  const destOf = (b) => (b.a.length === 9 ? { x: b.a[5], y: b.a[6], w: b.a[7], h: b.a[8] } : { x: b.a[1], y: b.a[2], w: b.a[3], h: b.a[4] });
  const MENU = (level, o = {}) => ({ level, place: "menu", box: { x: -284, y: -81, w: 568, h: 91 }, dpr: 2, t: 0, ...o });
  const TITLE = (level, dev = "d", o = {}) => ({ level, place: "title", dev, box: { x: 12, y: 12, w: 576, h: 459 }, cy: 105, dpr: 1, t: 0, ...o });

  check("no canvas source: the painter counts the call and draws nothing (the Node shell suites)", (() => {
    const keep = globalThis.OffscreenCanvas; delete globalThis.OffscreenCanvas;
    const n = _dbg.ran, t = target(), r = drawLogo2d(t.ctx, MENU(1));
    globalThis.OffscreenCanvas = keep;
    return r === null && _dbg.ran === n + 1 && t.seq.length === 0;
  })());

  /* (b) all eight worlds draw the title (both builds) and the MENU, each composing plan()'s layers in order */
  for (const [i, nm] of NAMES.entries()) for (const [tag, o] of [["title line", TITLE(i + 1, "d")], ["title stacked", TITLE(i + 1, "p")], ["menu", MENU(i + 1)]]) {
    cache.release();
    let r = null, err = "";
    try { r = draw(o).r; } catch (e) { err = e.stack; }
    const want = r ? W.plan(nm, { cap: r.cap, ver: r.ver, dpr: r.dpr, build: r.build, dev: r.dev, place: r.place }).layers.map((l) => l.id) : [];
    check(`(b) ${nm} ${tag}: draws without throwing, composing plan().layers in order`, !!r && J(_dbg.trace) === J(want), err || J(_dbg.trace) + " vs " + J(want));
  }
  {
    cache.release();
    const t = draw(TITLE(1, "d")).r, p = draw(TITLE(1, "p")).r, m = draw(MENU(1)).r;
    check("builds: the desktop title is the full-colour line build on the kit plate, the phone title the stacked build, MENU the cream line build with no plate",
      t.build === "line" && t.ver === "full" && t.place === "title" && p.build === "stack" && p.dev === "p" && m.build === "line" && m.ver === "menu" && m.place === "menu" && m.tier === "menu", J([t, p, m].map((x) => [x.build, x.ver, x.tier, x.cap])));
    check("MENU caps at PLATE.menu.cap 36 (box units) inside today's slot; the titles fit the box", m.cap === 36 && t.cap > 60 && p.cap > 60, J([t.cap, p.cap, m.cap]));
  }

  /* (a) the MENU logo: no #ffd447 except in the spark; the title's FUSE face is that yellow (the scan sees it) */
  for (const [i, nm] of NAMES.entries()) {
    cache.release();
    const d = draw(MENU(i + 1)), sp = _dbg.last && _dbg.last.spark;
    const other = d.cvs.filter((cv) => cv !== sp), y = styles(other).filter((s) => s === YEL);
    check(`(a) ${nm} MENU: no ${YEL} fill or stroke outside the spark sprite (cached layers, work canvases, the live frame)`, !!sp && y.length === 0 && !styles([sp]).every((s) => s !== YEL) && !d.t.paints.some((p) => String(p.style).toLowerCase() === YEL), y.length + " hits");
  }
  { cache.release(); const d = draw(TITLE(1)); check("(a) the scan is live: the title's own canvases do paint the FUSE yellow", styles(d.cvs.filter((cv) => cv !== _dbg.last.spark)).includes(YEL)); }

  /* (c) a second identical frame: 0 misses, the frame is the blit and the spark only */
  for (const [tag, o] of [["MENU", MENU(3)], ["title", TITLE(8)], ["stacked title", TITLE(5, "p")]]) {
    cache.release();
    const a = draw(o), b = draw(o);
    const ops = b.t.seq.filter((s) => s.op).map((s) => s.op);
    check(`(c) ${tag}: the first frame fills (misses ${a.miss}), the second is all hits with no new canvas`, a.miss >= 2 && b.miss === 0 && b.cvs.length === 0, a.miss + " / " + b.miss);
    check(`(c) ${tag}: a steady frame is two blits (logo, spark) in <= 12 canvas calls`, blits(b.t).length === 2 && b.t.seq.length <= 12 && !ops.some((op) => /^(fill|stroke|fillRect|fillText|measureText|arc|lineTo)$/.test(op)), b.t.seq.length + ": " + ops.join(" "));
  }
  {
    cache.release();
    const n0 = made.length, a = draw(MENU(1)), calls = (cvs) => cvs.reduce((s, cv) => s + cv.seq.length, 0);
    const b = draw(MENU(2)), ti = (cache.release(), draw(TITLE(1))), tp = draw(TITLE(1, "p"));
    console.log(`    cold fill canvas calls (every stub canvas + the frame): MENU JUNGLE ${calls(a.cvs) + a.t.seq.length} (${a.cvs.length} canvases, ${a.miss} misses), then MENU ICE re-tint ${calls(b.cvs) + b.t.seq.length} (${b.miss} misses); title JUNGLE ${calls(ti.cvs) + ti.t.seq.length}, stacked ${calls(tp.cvs) + tp.t.seq.length}`);
    check("cycling the world re-tints: a second world at the same size misses only its own layer, never the masks or the spark", b.miss === 1, b.miss);
    void n0;
  }

  /* (d) the spark: floor(t*14)&1 live, frozen on frame 0's reduced form under prefers-reduced-motion or REDUCE FLASH */
  {
    cache.release();
    const cell = (o) => { const b = blits(draw(o).t); return b.length === 2 ? b[1].a.slice(1, 3).join() : "none"; };
    const f0 = cell(MENU(1, { t: 0 })), f1 = cell(MENU(1, { t: 1.5 / 14 })), f2 = cell(MENU(1, { t: 2.5 / 14 }));
    check("(d) live: frames at t with floor(t*14)&1 = 0, 1, 0 blit sprite cells A, B, A", f0 !== f1 && f0 === f2 && f0 !== "none", [f0, f1, f2].join(" | "));
    globalThis.matchMedia = (q) => ({ matches: /prefers-reduced-motion: reduce/.test(q) });
    const r0 = cell(MENU(1, { t: 0 })), r1 = cell(MENU(1, { t: 1.5 / 14 })), sp = _dbg.last.spark;
    delete globalThis.matchMedia;
    check("(d) prefers-reduced-motion (matchMedia stub): both clocks blit the same still cell, neither A nor B", r0 === r1 && r0 !== f0 && r0 !== f1, r0 + " | " + r1);
    const pts = (cv, x0, x1) => cv.r.paints.filter((p) => p.box && p.box.x >= x0 && p.box.x + p.box.w <= x1);
    const cw = sp.width / 3, still = styles([{ r: { paints: pts(sp, 2 * cw, 3 * cw) } }]);
    check("(d) the still cell is the reduced form: #ffb347 rays and core, no #ffd447, no embers", still.includes("#ffb347") && !still.includes(YEL) && !still.includes("#fff3b0"), J([...new Set(still)]));
    check("(d) REDUCE FLASH (reduced: true) takes the same still cell", cell(MENU(1, { t: 1.5 / 14, reduced: true })) === r0);
    const t2 = target(), q = drawLogo2d(t2.ctx, TITLE(1, "d", { run: 0.5 })), b = blits(t2)[1], dd = destOf(b), at = G.sparkAt("line", q.tier, 0.5), env = G.layout("line").env;
    check("intro run-up: run 0.5 puts the spark sprite's centre on sparkAt(build, tier, 0.5)", near(dd.x + dd.w / 2, q.lx + (at.x - env.l) * q.cap, 1) && near(dd.y + dd.h / 2, q.ly + (at.y - env.t) * q.cap, 1), J([dd, q.lx, q.ly]));
    const t3 = target(); drawLogo2d(t3.ctx, TITLE(1, "d", { run: 0.5, reduced: true })); const e3 = destOf(blits(t3)[1]), tip = G.sparkAt("line", q.tier);
    check("reduced: no run-up, the still spark sits at the tip", near(e3.x + e3.w / 2, q.lx + (tip.x - env.l) * q.cap, 1));
    const t4 = target(); drawLogo2d(t4.ctx, TITLE(1, "d", { spark: false }));
    check("spark: false draws the logo alone (one blit)", blits(t4).length === 1);
  }

  /* (e) runtime: no filter or shadow write, no pixel read, on any canvas the painter touched */
  {
    const seqs = [...made.map((cv) => cv.seq)];
    const w = seqs.flat().filter((s) => s.set && /^(filter|shadowBlur|shadowColor)$/.test(s.set)), r = seqs.flat().filter((s) => /^(getImageData|putImageData|toDataURL|toBlob|convertToBlob)$/.test(s.op || ""));
    check("(e) runtime: no filter / shadowBlur / shadowColor write and no pixel read on " + made.length + " canvases", w.length === 0 && r.length === 0, J([w.length, r.length]));
    check("(e) every work context turns smoothing off before its mask copies", made.filter((cv) => cv.seq.some((s) => s.op === "drawImage")).every((cv) => cv.seq.some((s) => s.set === "imageSmoothingEnabled")));
  }

  /* (f) never outside the box the call site gives: the title box of every layout and size, the MENU slot of every shell box */
  {
    const out = [];
    const inBox = (r, B, up = 0) => r.x >= B.x - 1e-6 && r.y >= B.y - up - 1e-6 && r.x + r.w <= B.x + B.w + 1e-6 && r.y + r.h <= B.y + B.h + 1e-6;
    const sparkBox = (q, c) => { let b = [1e9, 1e9, -1e9, -1e9]; for (const f of [0, 1]) for (const p of G.spark(f, { tier: q.tier, px: q.cap }).parts) { const e = p.k === "disc" ? [p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r] : p.k === "rect" ? [p.x, p.y, p.x + p.w, p.y + p.h] : (() => { const s = G.flat(p.d).flatMap((u) => u.pts), h = (p.w || 0) / 2; return [Math.min(...s.map((v) => v[0])) - h, Math.min(...s.map((v) => v[1])) - h, Math.max(...s.map((v) => v[0])) + h, Math.max(...s.map((v) => v[1])) + h]; })(); b = [Math.min(b[0], e[0]), Math.min(b[1], e[1]), Math.max(b[2], e[2]), Math.max(b[3], e[3])]; } return { x: c[0] + b[0] * q.capL, y: c[1] + b[1] * q.capL, w: (b[2] - b[0]) * q.capL, h: (b[3] - b[1]) * q.capL }; };
    const cases = [];
    for (const [Wd, Hd] of [[600, 520], [608, 352]]) for (const lay of ["d", "l", "p"]) for (const dpr of [1, 2]) cases.push(["title " + Wd + "x" + Hd + " " + lay + " dpr " + dpr, { level: 2, place: "title", ...md.titleLogoBox(Wd, Hd, lay), dpr }]);
    const { shellGeo } = await import("../src/app/fit.js");
    const boxes = [["#c 600x520", 600, 520, 1, false], ["iso 608x352", 608, 352, 1, false], ["#sh desktop 1366x768", 1366, 768, 2, false], ...[[393, 852], [360, 640], [430, 932]].map(([w, h]) => { const g = shellGeo(w, h, 600, 520, "p"); return ["#sh phone " + w + "x" + h, g.w, g.h, 3, true, g.logo]; })];
    for (const [nm, bw, bh, dpr, touch, lg] of boxes) { const L = md.layout(bw, bh, lg), m = md.menuLogo(L); cases.push(["MENU " + nm, { level: 8, place: "menu", box: md.menuLogoBox(L), k: m.s, dpr, touch }]); }
    for (const [nm, o] of cases) {
      cache.release();
      const t = target(), q = drawLogo2d(t.ctx, o), b = blits(t), B = o.box, logo = destOf(b[0]), sp = destOf(b[1]), c = [sp.x + sp.w / 2, sp.y + sp.h / 2];
      if (!inBox(logo, B) || !inBox(sparkBox(q, c), B, 0.0045 * q.capL)) out.push([nm, J(B), J(logo), q.cap]);
    }
    check(`(f) ${cases.length} call-site boxes: the logo layer (plate ring included) and both spark frames stay inside (frame B's ember may poke .0044C over the top)`, out.length === 0, J(out.slice(0, 3)));
    const wrong = [];
    for (const [i, nm] of NAMES.entries()) for (const o of [TITLE(i + 1), TITLE(i + 1, "p"), MENU(i + 1)]) {
      cache.release();
      drawLogo2d(target().ctx, o);
      const wv = _dbg.last.world, at = _dbg.last.atlas, rs = wv.seq.filter((s) => s.op === "drawImage").map((s) => J(s.a.slice(5))), r0 = rs.length ? JSON.parse(rs[0]) : null;
      if (!r0 || rs.some((r) => r !== rs[0]) || r0[2] !== at.width || r0[3] !== at.height / 7 || r0[0] < 0 || r0[1] < 0 || r0[0] + r0[2] > wv.width || r0[1] + r0[3] > wv.height) wrong.push([nm, o.place, o.dev, [...new Set(rs)]]);
    }
    check("(f) every composite onto a world layer (tints, bands, blits) lands on the logo canvas's one rect inside the layer: no padded mask edge can reach the plate", wrong.length === 0, J(wrong.slice(0, 2)));
    const tl = (Wd, Hd, lay) => { cache.release(); return drawLogo2d(target().ctx, { level: 1, place: "title", ...md.titleLogoBox(Wd, Hd, lay), dpr: 1 }).cap; };
    console.log("    title caps (box units): 600x520 d " + tl(600, 520, "d") + ", l " + tl(600, 520, "l") + ", p " + tl(600, 520, "p") + "; 608x352 d " + tl(608, 352, "d") + ", p " + tl(608, 352, "p"));
  }

  /* (g) minimums: device-px rules in device px, CSS-px rules in CSS (box) px, at dpr 1 and 2 */
  for (const dpr of [1, 2]) {
    cache.release();
    const d = draw(MENU(8, { dpr })), s = 36 * dpr;
    const all = d.cvs.flatMap((cv) => cv.seq), outs = [];
    for (let i = 0; i < all.length; i++) if (all[i].set === "globalCompositeOperation" && all[i].v === "destination-out") { const n = all.slice(i + 1).find((x) => x.op === "drawImage"); if (n) outs.push(n.a.length === 9 ? [n.a[5], n.a[6]] : [n.a[1], n.a[2]]); }
    const band = Math.max(0.02 * s, 1), shade = [-Math.max(0.04 * 36, 2) * dpr, -Math.max(0.06 * 36, 2) * dpr];
    check(`(g) dpr ${dpr}: CROWN's gilt catch line is max(.02C, 1 device px) = ${band.toFixed(2)} device px`, outs.some(([x, y]) => near(x, 0) && near(y, -band)), J(outs));
    check(`(g) dpr ${dpr}: the MENU shade band is max(.04C, 2 CSS px) x max(.06C, 2 CSS px) = ${shade.map((v) => v.toFixed(2))} device px`, outs.some(([x, y]) => near(x, shade[0]) && near(y, shade[1])), J(outs));
    const ink = 2 * Math.max(0.03 * s, 1.2), strokes = d.cvs.flatMap((cv) => cv.r.paints.filter((p) => p.op === "stroke" && p.style === "#0b0609").map((p) => p.lw * s));
    check(`(g) dpr ${dpr}: CROWN's gilt ink is max(.03C, 1.2 device px) each side = ${ink.toFixed(2)} device px across`, strokes.some((w) => near(w, ink, 1e-4)), J([...new Set(strokes.map((w) => +w.toFixed(3)))]));
  }
}

/* the call sites: the title and MENU draw through the painter; the old text wordmark is gone */
{
  const src = (p) => readFileSync(join(ROOT, p), "utf8");
  check("the old wordmark text is gone from scenes.js and menudraw.js", !/fillText\("FUSE"|strokeText\("FUSE"|strokeText\(word\[i\]/.test(src("src/render/scenes.js") + src("src/render/menudraw.js")));
  const n = D ? D._dbg.ran : 0;
  md.drawIntroChrome(target().ctx, 0, 1, 600, 520, "d", 1, { level: 3 });
  md.drawIntroChrome(target().ctx, 1, 0.1, 600, 520, "p", 1, { level: 3 });
  md.drawIntroChrome(target().ctx, 1, 0.5, 600, 520, "p", 1, { level: 3 });
  check("drawIntroChrome draws the logo through the painter on the title and inside the 0.3 s exit, not after it", !!D && D._dbg.ran === n + 2, D && D._dbg.ran - n);
}

console.log("\n  LOGO-2D RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
