/* Task 7.2: logo B in CLASSIC 2D (src/render/logo/draw2d.js), drawn from plan()'s layer list through kit/cache.js layers, the spark a live sprite.
   Every canvas is a stub (tests/lib/textrec.mjs under a wrapper that logs calls and property writes in one sequence per canvas and one log across
   all of them, each paint with the live fill, stroke and composite op and each drawImage with the live transform); globalThis.OffscreenCanvas and the
   cache's factory both make it, so the painter's canvas rule and the cache agree. */
import { readFileSync, existsSync, readdirSync } from "node:fs";
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

const made = [], LOG = [];
const PAINT = /^(fill|stroke|fillRect|strokeRect)$/;
function wrap(r, cv) {
  const seq = [];
  const ctx = new Proxy(r.ctx, {
    get(t, k) {
      const v = t[k];
      if (typeof v !== "function") return v;
      return (...a) => {
        const e = { cv, op: String(k), a };
        if (PAINT.test(e.op)) Object.assign(e, { fill: t.fillStyle, stroke: t.strokeStyle, gco: t.globalCompositeOperation || "source-over", lw: t.lineWidth });
        if (e.op === "drawImage") e.m = t.getTransform();
        seq.push(e); LOG.push(e);
        return v(...a);
      };
    },
    set(t, k, v) { const e = { cv, set: String(k), v }; seq.push(e); LOG.push(e); t[k] = v; return true; },
  });
  return { ctx, seq };
}
class Cv {
  constructor(w, h) { this.width = w; this.height = h; this.r = rec(); const x = wrap(this.r, this); this.ctx = x.ctx; this.seq = x.seq; made.push(this); }
  getContext() { return this.ctx; }
}
const target = () => { const r = rec(), x = wrap(r, "target"); return { ...r, ctx: x.ctx, seq: x.seq }; };
globalThis.OffscreenCanvas = Cv;
const cache = await import("../src/render/kit/cache.js");
cache.setFactory((w, h) => new Cv(w, h));
const { BIOMES } = await import("../src/core/config.js");
const W = await import("../src/render/logo/worlds.js");
const G = await import("../src/render/logo/glyphs.js");
const { worldTokens } = await import("../src/render/kit/tokens.js");
const D = await import("../src/render/logo/draw2d.js").catch((e) => { check("draw2d.js loads under Node", false, e.message); return null; });
const md = await import("../src/render/menudraw.js");
const NAMES = BIOMES.map((b) => b.name);
const YEL = "#ffd447";

/* (h) the painter's own imports; (e) the logo directory's source */
{
  const f = join(ROOT, "src/render/logo/draw2d.js"), strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const EDGE = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^;"']*?\sfrom\s*)?["']([^"']+)["']/g;
  const own = existsSync(f) ? [...strip(readFileSync(f, "utf8")).matchAll(EDGE)].map((m) => m[1]) : [];
  check("(h) draw2d.js imports only ./glyphs.js, ./worlds.js and ../kit/*", own.length > 0 && own.every((p) => p === "./glyphs.js" || p === "./worlds.js" || /^\.\.\/kit\/[a-z]+\.js$/.test(p)), J(own));
  check("(h) no src/app, vendor, three or board3 anywhere in it", !own.some((p) => /app\/|vendor|three|board3/.test(p)));
  check("(h) three/wrapper.js still imports nothing from logo/", !/logo\//.test(strip(readFileSync(join(ROOT, "src/render/three/wrapper.js"), "utf8")).match(/import[^;]*/g)?.join("") || ""));
  const BAN = /\.filter\s*=|shadowBlur|shadowColor|getImageData|putImageData|toDataURL|backdrop-filter/, dir = join(ROOT, "src/render/logo"), files = readdirSync(dir).filter((n) => n.endsWith(".js"));
  const bad = files.filter((n) => BAN.test(strip(readFileSync(join(dir, n), "utf8"))));
  check("(e) no filter, shadow, getImageData or toDataURL in any of src/render/logo/ (" + files.join(", ") + ")", files.includes("draw2d.js") && bad.length === 0, bad.join());
}

if (D) {
  const { drawLogo2d, _dbg, _seam } = D;
  _dbg.on = true;
  const draw = (o, t = target()) => { const n0 = made.length, m0 = cache._dbg.misses; const r = drawLogo2d(t.ctx, o); return { r: r && { ...r, spark: r.spark && { ...r.spark } }, t, cvs: made.slice(n0), miss: cache._dbg.misses - m0 }; };
  const styles = (cvs) => cvs.flatMap((cv) => cv.r.paints.map((p) => String(p.style).toLowerCase()));
  const blits = (t) => t.seq.filter((s) => s.op === "drawImage");
  const destOf = (b) => (b.a.length === 9 ? { x: b.a[5], y: b.a[6], w: b.a[7], h: b.a[8] } : { x: b.a[1], y: b.a[2], w: b.a[3], h: b.a[4] });
  const devRect = (b) => { const d = destOf(b), m = b.m, xs = [d.x, d.x + d.w].map((x) => m.a * x + m.e), ys = [d.y, d.y + d.h].map((y) => m.d * y + m.f); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.abs(xs[1] - xs[0]), h: Math.abs(ys[1] - ys[0]) }; };
  const MENU = (level, o = {}) => ({ level, place: "menu", box: { x: -284, y: -81, w: 568, h: 91 }, dpr: 2, t: 0, ...o });
  const TITLE = (level, dev = "d", o = {}) => ({ level, place: "title", dev, box: { x: 12, y: 12, w: 576, h: 459 }, cy: 105, dpr: 1, t: 0, ...o });

  check("no canvas source: the painter counts the call and draws nothing (the Node shell suites)", (() => {
    const keep = globalThis.OffscreenCanvas; delete globalThis.OffscreenCanvas;
    const n = _dbg.ran, t = target(), r = drawLogo2d(t.ctx, MENU(1));
    globalThis.OffscreenCanvas = keep;
    return r === null && _dbg.ran === n + 1 && t.seq.length === 0;
  })());

  /* (b) the world layer's own draw sequence follows plan().layers: each tint's source-in colour, the plate's bed, the gilt ink and the motif
     groups, the atlas blits of bomb, cord ink and rope, in that order; the spark paints nothing there (it is the live sprite) */
  const observe = (world, atlas) => {
    const Hd = atlas.height / 7, tok = [];
    for (const e of LOG) {
      if (e.set || !e.op) continue;
      if (e.cv === world) {
        if (e.op === "drawImage" && e.a[0] === atlas) tok.push("C" + e.a[2] / Hd);
        else if (PAINT.test(e.op)) { const st = String(e.op.startsWith("stroke") ? e.stroke : e.fill).toLowerCase(), last = tok[tok.length - 1]; if (last && typeof last === "object") last.push(st); else tok.push([st]); }
      } else if (e.cv !== atlas && e.op === "fillRect" && e.gco === "source-in") tok.push("T" + String(e.fill).toLowerCase());
    }
    return tok;
  };
  const expect = (nm, q) => {
    const p = W.plan(nm, q.place === "title" ? { fit: q.fit, dev: q.dev, dpr: q.dpr, css: q.css } : { cap: q.cap, ver: "menu", dpr: q.dpr, css: q.css, build: q.build, dev: q.dev, place: "menu" }), out = [];
    for (const l of p.layers) {
      if (l.id === "plate") out.push({ g: (s) => s[0] === worldTokens(l.level).bedA.toLowerCase(), id: l.id });
      else if (["ringOuter", "ringInner", "outline", "side", "gilt"].includes(l.id)) out.push("T" + l.col.toLowerCase());
      else if (l.id === "giltInk") out.push({ g: (s) => s.every((c) => c === l.col.toLowerCase()), id: l.id });
      else if (["face", "shade", "light"].includes(l.id)) out.push("T" + l.col[0].toLowerCase(), "T" + l.col[1].toLowerCase());
      else if (l.id === "motif") { const ps = W.motif(nm, p.build, p.tier, q.cap * (q.css || 1)).filter((m) => m.clip !== "face"); if (ps.length) out.push({ g: (s) => s.includes(ps[0].col.toLowerCase()), id: l.id }); }
      else if (l.id === "bomb") out.push("C4");
      else if (l.id === "cordInk") out.push("C5");
      else if (l.id === "rope") out.push("C6");
      else if (l.id !== "spark") out.push("?" + l.id);
    }
    return out;
  };
  const matches = (obs, exp) => obs.length === exp.length && exp.every((x, i) => (typeof x === "string" ? obs[i] === x : Array.isArray(obs[i]) && x.g(obs[i])));
  for (const [i, nm] of NAMES.entries()) for (const [tag, o] of [["title line", TITLE(i + 1, "d")], ["title stacked", TITLE(i + 1, "p")], ["menu", MENU(i + 1)]]) {
    cache.release(); LOG.length = 0;
    let r = null, err = "";
    try { r = draw(o).r; } catch (e) { err = e.stack; }
    const B = o.box, k = 1, fitBox = { w: (B.w - 4) * k, h: (B.h - 4) * k };
    const obs = r ? observe(_dbg.last.world, _dbg.last.atlas) : [], exp = r ? expect(nm, { place: o.place, fit: fitBox, dev: o.dev, dpr: r.dpr, cap: r.cap, build: r.build }) : [];
    check(`(b) ${nm} ${tag}: the world layer paints plan().layers in order (${exp.length} steps; the spark is live, not in the layer)`, !!r && matches(obs, exp),
      err || J(obs.map((x) => (Array.isArray(x) ? "G[" + x.length + "]" : x))) + " vs " + J(exp.map((x) => (typeof x === "string" ? x : "G:" + x.id))));
  }
  {
    cache.release();
    const t = draw(TITLE(1, "d")).r, p = draw(TITLE(1, "p")).r, m = draw(MENU(1)).r;
    check("builds: the title is plan's fitted placement (line on desktop, stacked on touch portrait), tier title; MENU the cream line build at the menu tier, no plate",
      t.build === "line" && t.ver === "full" && t.place === "title" && t.tier === "title" && p.build === "stack" && p.dev === "p" && p.tier === "title" && m.build === "line" && m.ver === "menu" && m.place === "menu" && m.tier === "menu", J([t, p, m].map((x) => [x.build, x.ver, x.tier, x.cap])));
    check("MENU caps at PLATE.menu.cap 36 (box units) inside today's slot; the titles take titleFit's cap for the box less the edge", m.cap === 36 && t.cap === W.titleFit("d", 572, 455).cap && p.cap === W.titleFit("p", 572, 455).cap, J([t.cap, p.cap, m.cap]));
    for (const dev of ["d", "p"]) {
      cache.release();
      draw(TITLE(2, dev));
      const pl = W.plan("ICE", { fit: { w: 572, h: 455 }, dev, dpr: 1 }).layers[0], f = _dbg.last.world.seq.find((e) => e.op === "fillRect");
      check(`the ${dev === "p" ? "stacked" : "line"} title's plate bed is plan()'s own box (the fitted plate layer), drawn in box units`, !!f && J(f.a.map((v) => +v.toFixed(6))) === J([pl.box.x, pl.box.y, pl.box.w, pl.box.h].map((v) => +v.toFixed(6))), J([f && f.a, pl.box]));
    }
  }

  /* (a) the MENU logo: no #ffd447 except in the spark; the title's FUSE face is that yellow (the scan sees it) */
  for (const [i, nm] of NAMES.entries()) {
    cache.release();
    const d = draw(MENU(i + 1)), sp = _dbg.last && _dbg.last.spark;
    const other = d.cvs.filter((cv) => cv !== sp), y = styles(other).filter((s) => s === YEL);
    check(`(a) ${nm} MENU: no ${YEL} fill or stroke outside the spark sprite (cached layers, work canvases, the live frame)`, !!sp && y.length === 0 && styles([sp]).includes(YEL) && !d.t.paints.some((p) => String(p.style).toLowerCase() === YEL), y.length + " hits");
  }
  { cache.release(); const d = draw(TITLE(1)); check("(a) the scan is live: the title's own canvases do paint the FUSE yellow", styles(d.cvs.filter((cv) => cv !== _dbg.last.spark)).includes(YEL)); }

  /* (c) steady frames: no plan(), no miss, no new canvas, two blits */
  {
    const real = _seam.plan;
    let plans = 0;
    _seam.plan = (...a) => { plans++; return real(...a); };
    for (const [tag, o] of [["MENU", MENU(3)], ["title", TITLE(8)], ["stacked title", TITLE(5, "p")]]) {
      cache.release();
      const p0 = plans, a = draw(o), p1 = plans, b = draw({ ...o, t: 0.5 }), c = draw({ ...o, box: { ...o.box }, t: 1 });
      const ops = b.t.seq.filter((s) => s.op).map((s) => s.op);
      check(`(c) ${tag}: the first frame plans once and fills (misses ${a.miss}); two steady frames (new t, an equal box object) plan 0 times, miss 0, make no canvas`, p1 - p0 === 1 && plans === p1 && b.miss === 0 && c.miss === 0 && b.cvs.length === 0 && c.cvs.length === 0, [p1 - p0, plans - p1, a.miss, b.miss, c.miss].join());
      check(`(c) ${tag}: a steady frame is two blits (logo, spark) in <= 12 canvas calls`, blits(b.t).length === 2 && b.t.seq.length <= 12 && !ops.some((op) => /^(fill|stroke|fillRect|fillText|measureText|arc|lineTo)$/.test(op)), b.t.seq.length + ": " + ops.join(" "));
    }
    cache.release();
    const a = draw(MENU(1)), held = _dbg.last.world;
    cache.release();
    const b = draw(MENU(1));
    check("(c) a held layer the cache freed (0x0) is asked for again, never drawn", held.width === 0 && b.miss >= 1 && _dbg.last.world !== held && blits(b.t)[0].a[0] === _dbg.last.world && _dbg.last.world.width > 0, [held.width, b.miss].join());
    _seam.plan = real;
    void a;
  }
  {
    cache.release();
    const calls = (cvs) => cvs.reduce((s, cv) => s + cv.seq.length, 0);
    const a = draw(MENU(1)), b = draw(MENU(2)), ti = (cache.release(), draw(TITLE(1))), tp = draw(TITLE(1, "p"));
    console.log(`    cold fill canvas calls (every stub canvas + the frame): MENU JUNGLE ${calls(a.cvs) + a.t.seq.length} (${a.cvs.length} canvases, ${a.miss} misses), then MENU ICE re-tint ${calls(b.cvs) + b.t.seq.length} (${b.miss} misses); title JUNGLE ${calls(ti.cvs) + ti.t.seq.length}, stacked ${calls(tp.cvs) + tp.t.seq.length}`);
    check("cycling the world re-tints: a second world at the same size misses only its own layer, never the masks or the spark", b.miss === 1, b.miss);
  }

  /* (d) the spark: floor(t * SPARK.hz) & 1 live, frozen on frame 0's reduced form under prefers-reduced-motion or REDUCE FLASH; the cell holds it */
  {
    cache.release();
    const hz = G.SPARK.hz, cell = (o) => { const b = blits(draw(o).t); return b.length === 2 ? b[1].a.slice(1, 3).join() : "none"; };
    const f0 = cell(MENU(1, { t: 0 })), f1 = cell(MENU(1, { t: 1.5 / hz })), f2 = cell(MENU(1, { t: 2.5 / hz }));
    check("(d) live: frames at t with floor(t x SPARK.hz) & 1 = 0, 1, 0 blit sprite cells A, B, A", f0 !== f1 && f0 === f2 && f0 !== "none", [f0, f1, f2].join(" | "));
    globalThis.matchMedia = (q) => ({ matches: /prefers-reduced-motion: reduce/.test(q) });
    const r0 = cell(MENU(1, { t: 0 })), r1 = cell(MENU(1, { t: 1.5 / hz })), sp = _dbg.last.spark;
    delete globalThis.matchMedia;
    check("(d) prefers-reduced-motion (matchMedia stub): both clocks blit the same still cell, neither A nor B", r0 === r1 && r0 !== f0 && r0 !== f1, r0 + " | " + r1);
    const cw = sp.width / 3, in3 = (x0, x1) => sp.r.paints.filter((p) => p.box && p.box.x >= x0 && p.box.x + p.box.w <= x1), still = styles([{ r: { paints: in3(2 * cw, 3 * cw) } }]);
    check("(d) the still cell is the reduced form: #ffb347 rays and core, no #ffd447, no embers", still.includes("#ffb347") && !still.includes(YEL) && !still.includes("#fff3b0"), J([...new Set(still)]));
    check("(d) REDUCE FLASH (reduced: true) takes the same still cell", cell(MENU(1, { t: 1.5 / hz, reduced: true })) === r0);
    const s = draw(MENU(1)).r, sc = s.cap * s.dpr, out = [];
    for (const [i, p] of sp.r.paints.entries()) { if (!p.box) continue; const h = p.op === "stroke" ? (p.lw * sc) / 2 : 0, c = Math.floor((p.box.x + p.box.w / 2) / cw); if (p.box.x - h < c * cw - 1e-6 || p.box.x + p.box.w + h > (c + 1) * cw + 1e-6 || p.box.y - h < -1e-6 || p.box.y + p.box.h + h > cw + 1e-6) out.push(i); }
    check("the spark cell is the spark's own reach: every part of frames A, B and the reduced form (ink included) lies inside its cell", sp.r.paints.length >= 30 && out.length === 0, out.length + " outside, cell " + cw);
    const t2 = target(), q = drawLogo2d(t2.ctx, TITLE(1, "d", { run: 0.5 })), dd = destOf(blits(t2)[1]), at = G.sparkAt("line", q.tier, 0.5), env = G.layout("line").env;
    check("the run-up path stays reachable through o.run: run 0.5 puts the spark sprite's centre on sparkAt(build, tier, 0.5)", near(dd.x + dd.w / 2, q.lx + (at.x - env.l) * q.capL, 1) && near(dd.y + dd.h / 2, q.ly + (at.y - env.t) * q.capL, 1), J([dd, q.lx, q.ly]));
    const t3 = target(); drawLogo2d(t3.ctx, TITLE(1, "d", { run: 0.5, reduced: true })); const e3 = destOf(blits(t3)[1]), tip = G.sparkAt("line", q.tier);
    check("reduced: no run-up, the still spark sits at the tip", near(e3.x + e3.w / 2, q.lx + (tip.x - env.l) * q.capL, 1));
    const t4 = target(); drawLogo2d(t4.ctx, TITLE(1, "d", { spark: false }));
    check("spark: false draws the logo alone (one blit)", blits(t4).length === 1);
    check("TITLE_RUNUP is off (lead ruling): the title's exit never runs the spark up the cord", D.TITLE_RUNUP === false);
    const tip0 = (stage, tt) => { const t = target(); md.drawIntroChrome(t.ctx, stage, tt, 600, 520, "d", 1, { level: 1 }); const b = blits(t); return { n: b.length, run: _dbg.run, c: b[1] && devRect(b[1]), l: b[0] && devRect(b[0]) }; };
    const w0 = tip0(0, 2), x1 = tip0(1, 0.05), x2 = tip0(1, 0.2), off = (r) => [r.c.x + r.c.w / 2 - r.l.x, r.c.y + r.c.h / 2 - r.l.y];
    check("the title waits lit (spark at the tip) and keeps it there, flickering, through the exit: no run, the spark's place on the layer never moves",
      w0.n === 2 && x1.n === 2 && x2.n === 2 && x1.run === undefined && x2.run === undefined && near(off(w0)[0], off(x1)[0], 1.01) && near(off(w0)[1], off(x2)[1], 1.01), J([off(w0), off(x1), off(x2)]));
  }

  /* (e) runtime: no filter or shadow write, no pixel read, on any canvas the painter touched */
  {
    const seqs = [...made.map((cv) => cv.seq)];
    const w = seqs.flat().filter((s) => s.set && /^(filter|shadowBlur|shadowColor)$/.test(s.set)), r = seqs.flat().filter((s) => /^(getImageData|putImageData|toDataURL|toBlob|convertToBlob)$/.test(s.op || ""));
    check("(e) runtime: no filter / shadowBlur / shadowColor write and no pixel read on " + made.length + " canvases", w.length === 0 && r.length === 0, J([w.length, r.length]));
    check("(e) every work context turns smoothing off before its mask copies", made.filter((cv) => cv.seq.some((s) => s.op === "drawImage")).every((cv) => cv.seq.some((s) => s.set === "imageSmoothingEnabled")));
  }

  /* (f) never outside the box the call site gives; the title pop's peak stays on the canvas */
  {
    const out = [];
    const inBox = (r, B, up = 0) => r.x >= B.x - 1e-6 && r.y >= B.y - up - 1e-6 && r.x + r.w <= B.x + B.w + 1e-6 && r.y + r.h <= B.y + B.h + 1e-6;
    const sparkBox = (q, c) => { let b = [1e9, 1e9, -1e9, -1e9]; for (const f of [0, 1]) for (const p of G.spark(f, { tier: q.tier, px: q.cap }).parts) { const e = p.k === "disc" ? [p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r] : p.k === "rect" ? [p.x, p.y, p.x + p.w, p.y + p.h] : (() => { const s = G.flat(p.d).flatMap((u) => u.pts), h = (p.w || 0) / 2; return [Math.min(...s.map((v) => v[0])) - h, Math.min(...s.map((v) => v[1])) - h, Math.max(...s.map((v) => v[0])) + h, Math.max(...s.map((v) => v[1])) + h]; })(); b = [Math.min(b[0], e[0]), Math.min(b[1], e[1]), Math.max(b[2], e[2]), Math.max(b[3], e[3])]; } return { x: c[0] + b[0] * q.capL, y: c[1] + b[1] * q.capL, w: (b[2] - b[0]) * q.capL, h: (b[3] - b[1]) * q.capL }; };
    const cases = [];
    for (const [Wd, Hd] of [[600, 520], [608, 352]]) for (const lay of ["d", "l", "p"]) for (const dpr of [1, 2]) { const T = md.titleLogoBox(Wd, Hd, lay); cases.push(["title " + Wd + "x" + Hd + " " + lay + " dpr " + dpr, { level: 2, place: "title", box: T.box, cy: T.cy, dev: T.dev, dpr }]); }
    const { shellGeo } = await import("../src/app/fit.js");
    const boxes = [["#c 600x520", 600, 520, 1, false], ["iso 608x352", 608, 352, 1, false], ["#sh desktop 1366x768", 1366, 768, 2, false], ...[[393, 852], [360, 640], [430, 932]].map(([w, h]) => { const g = shellGeo(w, h, 600, 520, "p"); return ["#sh phone " + w + "x" + h, g.w, g.h, 3, true, g.logo]; })];
    for (const [nm, bw, bh, dpr, touch, lg] of boxes) { const L = md.layout(bw, bh, lg), m = md.menuLogo(L); cases.push(["MENU " + nm, { level: 8, place: "menu", box: md.menuLogoBox(L), k: m.s, dpr, touch }]); }
    for (const [nm, o] of cases) {
      cache.release();
      const t = target(), q = drawLogo2d(t.ctx, o), b = blits(t), B = o.box, logo = destOf(b[0]), sp = destOf(b[1]), c = [sp.x + sp.w / 2, sp.y + sp.h / 2];
      if (!inBox(logo, B) || !inBox(sparkBox(q, c), B, 0.0045 * q.capL)) out.push([nm, J(B), J(logo), q.cap]);
    }
    check(`(f) ${cases.length} call-site boxes: the logo layer (plate ring included) and both spark frames stay inside (frame B's ember may poke .0044C over the top)`, out.length === 0, J(out.slice(0, 3)));
    const ebPeak = Math.max(...Array.from({ length: 2001 }, (_, i) => { const u = i / 2000 - 1; return 1 + 2.70158 * u ** 3 + 1.70158 * u ** 2; })), peak = 0.92 + 0.08 * ebPeak, offc = [];
    for (const [Wd, Hd] of [[600, 520], [608, 352]]) for (const lay of ["d", "l", "p"]) {
      cache.release();
      const T = md.titleLogoBox(Wd, Hd, lay), t = target();
      drawLogo2d(t.ctx, { level: 1, place: "title", box: T.box, cy: T.cy, dev: T.dev, dpr: 1, scale: peak });
      for (const b of blits(t)) { const r = devRect(b); if (r.x < -1e-6 || r.y < -1e-6 || r.x + r.w > Wd + 1e-6 || r.y + r.h > Hd + 1e-6) offc.push([Wd, Hd, lay, J(r)]); }
      for (const tt of [0.25, 0.26, 0.27]) { const ti = target(); md.drawIntroChrome(ti.ctx, 0, tt, Wd, Hd, lay, 1, { level: 1 }); for (const b of blits(ti)) { const r = devRect(b); if (r.x < -1e-6 || r.y < -1e-6 || r.x + r.w > Wd + 1e-6 || r.y + r.h > Hd + 1e-6) offc.push([Wd, Hd, lay, tt, J(r)]); } }
    }
    check(`(f) the title pop's peak (x ${peak.toFixed(4)} about the logo's centre, and the title's own slide and bob at that moment) keeps the plate on the canvas at every layout and size`, offc.length === 0, J(offc.slice(0, 2)));
    const wrong = [];
    for (const [i, nm] of NAMES.entries()) for (const o of [TITLE(i + 1), TITLE(i + 1, "p"), MENU(i + 1)]) {
      cache.release();
      drawLogo2d(target().ctx, o);
      const wv = _dbg.last.world, at = _dbg.last.atlas, rs = wv.seq.filter((s) => s.op === "drawImage").map((s) => J(s.a.slice(5))), r0 = rs.length ? JSON.parse(rs[0]) : null;
      if (!r0 || rs.some((r) => r !== rs[0]) || r0[2] !== at.width || r0[3] !== at.height / 7 || r0[0] < 0 || r0[1] < 0 || r0[0] + r0[2] > wv.width || r0[1] + r0[3] > wv.height) wrong.push([nm, o.place, o.dev, [...new Set(rs)]]);
    }
    check("(f) every composite onto a world layer (tints, bands, blits) lands on the logo canvas's one rect inside the layer: no padded mask edge can reach the plate", wrong.length === 0, J(wrong.slice(0, 2)));
    const tl = (Wd, Hd, lay) => { cache.release(); const T = md.titleLogoBox(Wd, Hd, lay); return drawLogo2d(target().ctx, { level: 1, place: "title", box: T.box, cy: T.cy, dev: T.dev, dpr: 1 }).cap; };
    console.log("    title caps (box units): 600x520 d " + tl(600, 520, "d") + ", l " + tl(600, 520, "l") + ", p " + tl(600, 520, "p") + "; 608x352 d " + tl(608, 352, "d") + ", p " + tl(608, 352, "p"));
  }

  /* (g) every minimum the plan and the geometry carry, in its own unit: device minimums in device px, CSS minimums in CSS px (o.css CSS px per box
     unit), on MENU and on the fitted title, at dpr 1 and 2 and css 1 and 0.6 */
  {
    const outsAfter = (cvs) => { const all = cvs.flatMap((cv) => cv.seq), o = []; for (let i = 0; i < all.length; i++) if (all[i].set === "globalCompositeOperation" && all[i].v === "destination-out") { const n = all.slice(i + 1).find((x) => x.op === "drawImage"); if (n) o.push(n.a.length === 9 ? [n.a[5], n.a[6]] : [n.a[1], n.a[2]]); } return o; };
    const widths = (cvs, col, s, op = "stroke") => [...new Set(cvs.flatMap((cv) => cv.r.paints.filter((p) => p.op === op && String(p.style).toLowerCase() === col).map((p) => +(p.lw * s).toFixed(4))))];
    const has = (list, v) => list.some((w) => near(w, v, 2e-3));
    const pathS = G.cordPath, bad = [];
    for (const place of ["menu", "title"]) for (const dpr of [1, 2]) for (const css of [1, 0.6]) {
      const run = (nm) => { cache.release(); const o = place === "menu" ? MENU(nm === "CROWN" ? 8 : 1, { dpr, css }) : TITLE(nm === "CROWN" ? 8 : 1, "d", { dpr, css }); const d = draw(o); return { ...d, q: d.r, sp: _dbg.last.spark }; };
      const cr = run("CROWN"), jg = run("JUNGLE"), q = jg.q, s = q.cap * q.dpr, pxD = q.dpr / css, tier = q.tier, tag = `${place} dpr ${dpr} css ${css}`;
      const want = (nm, ok, got) => { if (!ok) bad.push(tag + ": " + nm + " " + J(got)); };
      const g = outsAfter(cr.cvs), band = Math.max(0.02 * cr.q.cap * cr.q.dpr, 1);
      want("gilt line max(.02C, 1 device px)", g.some(([x, y]) => near(x, 0) && near(y, -band)), [band, g]);
      want("gilt ink max(.03C, 1.2 device px) each side", has(widths(cr.cvs, "#0b0609", cr.q.cap * cr.q.dpr), 2 * Math.max(0.03 * cr.q.cap * cr.q.dpr, 1.2)), 2 * Math.max(0.03 * cr.q.cap * cr.q.dpr, 1.2));
      const sh = tier === "title" ? [-0.04 * s, -0.06 * s] : [-Math.max(0.04 * s, 2 * pxD), -Math.max(0.06 * s, 2 * pxD)], jo = outsAfter(jg.cvs);
      want("shade band (2 CSS px at token / MENU, exact at the title)", jo.some(([x, y]) => near(x, sh[0]) && near(y, sh[1])), [sh, jo]);
      want("light band (no minimum)", jo.some(([x, y]) => near(x, 0.025 * s) && near(y, 0.035 * s)), jo);
      const len = pathS(q.build).at(-1).s, s1 = pathS(q.build)[1].s, rope0 = Math.max(0.11 - (0.02 * s1) / len, 3 / (q.cap * css)), ow = Math.max(0.035, 1.2 / (q.cap * css));
      want("cord ink max(.035C, 1.2 CSS px) each side of the rope (min 3 CSS px)", has(widths(jg.cvs, "#0b0609", s), (rope0 + 2 * ow) * s), [(rope0 + 2 * ow) * s]);
      want("rope max(.11C tapering, 3 CSS px)", has(widths(jg.cvs, "#ff9d5a", s), rope0 * s), [rope0 * s, widths(jg.cvs, "#ff9d5a", s).slice(0, 3)]);
      want("cord key light max(.015C, 1 CSS px)", has(widths(jg.cvs, "#fff3b0", s), Math.max(0.015 * s, pxD)), Math.max(0.015 * s, pxD));
      if (tier === "title") want("braid max(.025C, 1 CSS px)", has(widths(jg.cvs, "#b8582a", s), Math.max(0.025 * s, pxD)), Math.max(0.025 * s, pxD));
      want("char ring max(.03C, 1.5 CSS px)", has(widths(jg.cvs, "#1e1216", s), Math.max(0.03 * s, 1.5 * pxD)), Math.max(0.03 * s, 1.5 * pxD));
      const k1 = G.spark(0, { tier, px: q.cap * css }).k;
      want("spark ink max(.02C, 1 CSS px) each side of a ray", has(widths([jg.sp], "#0b0609", s), 2 * Math.max(0.02 * k1 * s, pxD)), 2 * Math.max(0.02 * k1 * s, pxD));
      want("motif ink edge max(.05C, 2 CSS px) across (JUNGLE's inked leaf)", has(widths(jg.cvs, "#0b0609", s), Math.max(0.05 * s, 2 * pxD)), Math.max(0.05 * s, 2 * pxD));
      want("the bomb recipe is read at the CSS diameter (BD x cap x css)", jg.q && G.bomb(G.BD * q.cap * css).tier === (G.BD * q.cap * css >= 60 ? "hero" : G.BD * q.cap * css >= 26 ? "40" : "24"), G.BD * q.cap * css);
    }
    check("(g) every minimum on MENU and the fitted title, at dpr 1 and 2 and css 1 and 0.6, is applied in its own unit (gilt line and ink in device px; shade, cord ink, rope, key light, braid, char, spark ink and motif ink in CSS px)", bad.length === 0, J(bad.slice(0, 3)));
    cache.release();
    const a = draw(MENU(1, { dpr: 1, css: 0.6 })).r, b = draw(MENU(1, { dpr: 1 })).r;
    check("(g) o.css changes the minimums only: the cap, the tier and the size stay; the layers are new keys", a.cap === b.cap && a.tier === b.tier && a.w === b.w && a.css === 0.6 && b.css === 1);
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
  check("titleLogoBox and menuLogoBox keep their last answer (a steady frame allocates no box)", md.titleLogoBox(600, 520, "d") === md.titleLogoBox(600, 520, "d") && md.menuLogoBox(md.layout(600, 520)) === md.menuLogoBox(md.layout(600, 520)));
}

console.log("\n  LOGO-2D RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
