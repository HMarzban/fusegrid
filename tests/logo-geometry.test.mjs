/* Task 7.1: logo B geometry and world dressing (appendix section 8, its 14 builder deviations binding). Pure data and geometry in cap units: the letters,
   the fixed layout box per build, the cord, the two spark frames, the logo bomb, and per world the side colour, the plate and one motif. Coverage is
   measured on a 1/500 C sample grid (even-odd glyph fill, every motif part counted with its ink edge); contrast is token math on the plate bed. */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { BIOMES } from "../src/core/config.js";
import { lum, worldTokens } from "../src/render/kit/tokens.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const deg = (d) => (d * Math.PI) / 180;
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const NAMES = ["JUNGLE", "ICE", "FACTORY", "WATER", "ARENA", "SAND", "VOID", "CROWN"];
const BUILDS = ["line", "stack"];
const FILES = ["src/render/logo/glyphs.js", "src/render/logo/worlds.js"];

/* ---- (g) the import graph and the source: no DOM, clock, randomness or banned module ---- */
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const EDGE = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^;"']*?\sfrom\s*)?["']([^"']+)["']/g;
  check("both logo modules exist", FILES.every((f) => existsSync(join(ROOT, f))), FILES.filter((f) => !existsSync(join(ROOT, f))).join());
  const own = (f) => (existsSync(join(ROOT, f)) ? [...strip(readFileSync(join(ROOT, f), "utf8")).matchAll(EDGE)].map((m) => m[1]) : null);
  check("glyphs.js imports only kit/tokens.js", J(own(FILES[0])) === J(["../kit/tokens.js"]), J(own(FILES[0])));
  check("worlds.js imports only core config, kit/tokens.js and ./glyphs.js", J((own(FILES[1]) || []).slice().sort()) === J(["../../core/config.js", "../kit/tokens.js", "./glyphs.js"]), J(own(FILES[1])));
  const seen = new Set(), todo = FILES.map((f) => join(ROOT, f));
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f) || !existsSync(f)) continue;
    seen.add(f);
    for (const m of strip(readFileSync(f, "utf8")).matchAll(EDGE)) if (m[1].startsWith(".")) todo.push(join(dirname(f), m[1]));
  }
  const graph = [...seen].map((f) => relative(ROOT, f));
  check("the logo graph never reaches src/app, vendor, render/three, board3, featplace or featchecks", graph.length >= 4 && !graph.some((f) => /^src\/app\/|^vendor\/|^src\/render\/three\/|core\/(board3|featplace|featchecks)\.js$/.test(f)), graph.join());
  const BAN = /\bdocument\b|\bwindow\b|Path2D|Math\.random|\bDate\b|performance|getImageData|requestAnimationFrame|matchMedia|setTimeout|getContext|\bcanvas\b|\.filter\s*=/;
  const bad = FILES.filter((f) => existsSync(join(ROOT, f)) && BAN.test(strip(readFileSync(join(ROOT, f), "utf8"))));
  check("no DOM, canvas, clock or Math.random in either module (comments stripped)", bad.length === 0, bad.join());
  const wrap = strip(readFileSync(join(ROOT, "src/render/three/wrapper.js"), "utf8"));
  check("three/wrapper.js imports nothing from logo/", ![...wrap.matchAll(EDGE)].some((m) => /logo\//.test(m[1])));
}

const G = await import("../src/render/logo/glyphs.js").catch((e) => { check("glyphs.js loads under Node with no DOM", false, e.message); return null; });
const W = await import("../src/render/logo/worlds.js").catch((e) => { check("worlds.js loads under Node with no DOM", false, e.message); return null; });

if (G && W) {
  check("both modules load under Node with no DOM stub in place", typeof globalThis.document === "undefined" && typeof globalThis.Path2D === "undefined");
  const { P, GL, GAP, OVER, BD, glyph, wordW, layout, cordPath, atS, CORD, spark, sparkAt, SPARK, bomb, BOMB, faces, STACK, flat, inGlyph, pxEnv, PX_SCALE, LOOK3D, MONO } = G;
  const { WORLDS, worldOf, tierOf, motif, MOTIF } = W;

  /* ---- geometry helpers of the test's own (point in polygon, distances, part hit and bounds) ---- */
  const inPoly = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const evenodd = (rings, x, y) => rings.reduce((c, r) => (inPoly(r, x, y) ? !c : c), false);
  const segD = (x, y, [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0; return Math.hypot(x - ax - t * dx, y - ay - t * dy); };
  const pathD = (subs, x, y) => { let d = Infinity; for (const s of subs) { const p = s.pts, n = p.length; for (let i = 1; i < n; i++) d = Math.min(d, segD(x, y, p[i - 1], p[i])); if (s.closed && n > 1) d = Math.min(d, segD(x, y, p[n - 1], p[0])); if (n === 1) d = Math.min(d, Math.hypot(x - p[0][0], y - p[0][1])); } return d; };
  const FLAT = new WeakMap(), flatOf = (part) => { if (!FLAT.has(part)) FLAT.set(part, flat(part.d)); return FLAT.get(part); };
  const hit = (q, x, y) => {
    if (q.k === "disc") return Math.hypot(x - q.x, y - q.y) <= q.r;
    if (q.k === "ring") return Math.abs(Math.hypot(x - q.x, y - q.y) - q.r) <= q.w / 2;
    if (q.k === "rect") return x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h;
    const s = flatOf(q);
    if (q.k === "line") return pathD(s, x, y) <= q.w / 2;
    return evenodd(s.map((r) => r.pts), x, y) || (q.ink > 0 && pathD(s, x, y) <= q.ink / 2);
  };
  const boxOf = (q) => {
    if (q.k === "disc") return [q.x - q.r, q.y - q.r, q.x + q.r, q.y + q.r];
    if (q.k === "ring") { const r = q.r + q.w / 2; return [q.x - r, q.y - r, q.x + r, q.y + r]; }
    if (q.k === "rect") return [q.x, q.y, q.x + q.w, q.y + q.h];
    const pad = q.k === "line" ? q.w / 2 : (q.ink || 0) / 2, b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const s of flatOf(q)) for (const [x, y] of s.pts) { b[0] = Math.min(b[0], x - pad); b[1] = Math.min(b[1], y - pad); b[2] = Math.max(b[2], x + pad); b[3] = Math.max(b[3], y + pad); }
    return b;
  };
  const inEnv = (b, env, e = 1e-9) => b[0] >= env.l - e && b[1] >= env.t - e && b[2] <= env.l + env.w + e && b[3] <= env.t + env.h + e;
  const deepFrozen = (o) => !o || typeof o !== "object" || (Object.isFrozen(o) && Object.values(o).every(deepFrozen));

  /* ---- 8.1 palette ---- */
  check("P is appendix 8.1", J(P) === J({ ol: "#0b0609", dk: "#1e1216", cream: "#fff2df", t2: "#dccbb8", white: "#ffffff", yel: "#ffd447", yelLip: "#c8981e", pale: "#fff3b0", cor: "#ff5d73", corLip: "#c23058", corHi: "#ffc0d0", amb: "#ffb347", cord: "#ff9d5a", cord2: "#b8582a", bomb: "#15181f", bombOl: "#0a0d14", lobe: "#2a3550", steel: "#8a96a4", steelHi: "#d0d8e0", steelDk: "#3d4a58", fillRim: "#2e4a78", spec: "#fff8ec", key: "#fff4e2", fill: "#bcd4ff" }), J(P));

  /* ---- 8.2 letters ---- */
  const GL82 = {
    F: { w: 0.58, sh: [[[[0, 0, .08], [.58, 0, .02], [.58, .23, .02], [.26, .23, .05], [.26, .345, .05], [.40, .345, .02], [.40, .575, .02], [.26, .575, .05], [.26, 1, .02], [0, 1, .08]]]], bot: [[0, .26]], top: [[.04, .56]] },
    U: { w: 0.70, sh: [[[[0, 0, .02], [.25, 0, .02], [.25, .77, .05], [.45, .77, .05], [.45, 0, .02], [.70, 0, .02], [.70, 1, .30], [0, 1, .30]]]], bot: [[.12, .58]], top: [[.02, .23], [.47, .68]] },
    S: { w: 0.66, sh: [[[[.02, 0, .30], [.64, 0, .22], [.64, .30, .02], [.38, .30, .02], [.38, .22, .05], [.28, .22, .05], [.28, .40, .05], [.66, .40, .30], [.66, 1, .30], [0, 1, .22], [0, .70, .02], [.26, .70, .02], [.26, .78, .05], [.40, .78, .05], [.40, .60, .05], [.02, .60, .30]]]], bot: [[.10, .54]] },
    E: { w: 0.60, sh: [[[[0, 0, .08], [.60, 0, .02], [.60, .23, .02], [.26, .23, .05], [.26, .395, .05], [.50, .395, .02], [.50, .605, .02], [.26, .605, .05], [.26, .77, .05], [.60, .77, .02], [.60, 1, .02], [0, 1, .08]]]], bot: [[.04, .56]], top: [[.04, .56]] },
    G: { w: 0.72, sh: [[[[0, 0, .30], [.72, 0, .22], [.72, .30, .02], [.46, .30, .02], [.46, .23, .05], [.26, .23, .05], [.26, .77, .05], [.46, .77, .05], [.46, .70, .02], [.40, .70, .02], [.40, .50, .02], [.72, .50, .04], [.72, 1, .30], [0, 1, .30]]]], bot: [[.12, .60]], top: [[.14, .66]] },
    R: { w: 0.68, sh: [[[[0, 0, .08], [.68, 0, .30], [.68, .55, .30], [.26, .55, .02], [.26, 1, .02], [0, 1, .08]], [[.26, .22, .05], [.42, .22, .05], [.42, .34, .05], [.26, .34, .05]]], [[[.30, .50, .02], [.5175, .50, .02], [.68, 1, .02], [.40, 1, .02], [.268, .59, .02]]]], bot: [[0, .26], [.40, .68]], top: [[.04, .50]] },
    I: { w: 0.28, sh: [[[[0, 0, .06], [.28, 0, .06], [.28, 1, .06], [0, 1, .06]]]], bot: [[0, .28]], top: [[.02, .26]] },
    D: { w: 0.70, sh: [[[[0, 0, .08], [.70, 0, .38], [.70, 1, .38], [0, 1, .08]], [[.26, .23, .05], [.46, .23, .12], [.46, .77, .12], [.26, .77, .05]]]], bot: [[.04, .50]], top: [[.04, .46]] },
  };
  check("GL is appendix 8.2 (rings, widths, bot and top runs)", Object.keys(GL82).every((c) => J(GL[c].sh) === J(GL82[c].sh) && GL[c].w === GL82[c].w && J(GL[c].bot) === J(GL82[c].bot) && J(GL[c].top || null) === J(GL82[c].top || null)) && J(Object.keys(GL)) === J(Object.keys(GL82)));
  check("GAP, OVER and BD are appendix 8.2 / 8.3", J(GAP) === J({ FU: .07, US: .09, SE: .09, GR: .10, RI: .09, ID: .11 }) && OVER === 0.015 && BD === 0.72);
  check("FUSE is 2.79C wide, GRID 2.68C (section 14 item 6: the built 2.68)", near(wordW("FUSE"), 2.79) && near(wordW("GRID"), 2.68), wordW("FUSE") + " / " + wordW("GRID"));
  const areas = {};
  for (const ch of Object.keys(GL)) {
    const g = glyph(ch), pts = g.d.flatMap((ops) => flat(ops).flatMap((s) => s.pts)), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    check(`(d) ${ch}: every outline point inside its advance box [0, w] x [-OVER, 1 + OVER]`, g.w === GL[ch].w && Math.min(...xs) >= -1e-9 && Math.max(...xs) <= g.w + 1e-9 && Math.min(...ys) >= -OVER - 1e-9 && Math.max(...ys) <= 1 + OVER + 1e-9, [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map((v) => v.toFixed(4)).join());
    const rings = g.d.map((ops) => flat(ops).map((s) => s.pts)), N = 500;
    let n = 0, agree = 0, tot = 0;
    for (let y = -8; y < N + 8; y++) for (let x = 0; x < g.w * N; x++) { const px = (x + 0.5) / N, py = (y + 0.5) / N, a = rings.some((r) => evenodd(r, px, py)); if (a) n++; if (y % 7 === 0 && x % 7 === 0) { tot++; if (a === inGlyph(ch, px, py)) agree++; } }
    areas[ch] = n / (N * N);
    check(`${ch}: inGlyph agrees with the even-odd fill of the glyph's own outline`, agree === tot, agree + "/" + tot);
  }
  check("R and D carry one counter ring each; R has a second shape (the leg)", glyph("D").d.length === 1 && flat(glyph("D").d[0]).length === 2 && glyph("R").d.length === 2 && flat(glyph("R").d[0]).length === 2);
  check("round tops and bottoms overshoot 0.015C, flat stems do not", glyph("U").d.flatMap((o) => flat(o).flatMap((s) => s.pts)).some((p) => near(p[1], 1 + OVER, 1e-6)) && !glyph("F").d.flatMap((o) => flat(o).flatMap((s) => s.pts)).some((p) => p[1] < -1e-9 || p[1] > 1 + 1e-9));

  /* ---- 8.3 layout ---- */
  const LN = layout("line"), ST = layout("stack");
  const xs = (L, w) => L.letters.filter((l) => l.word === w).map((l) => +l.x.toFixed(4));
  check("line: FUSE at 0 / .65 / 1.44 / 2.19, GRID at 3.69 / 4.51 / 5.28 / 5.67 (FUSE end + .90), all on y 0", J(xs(LN, 0)) === J([0, .65, 1.44, 2.19]) && J(xs(LN, 1)) === J([3.69, 4.51, 5.28, 5.67]) && LN.letters.every((l) => l.y === 0) && J(LN.letters.map((l) => l.ch).join("")) === J("FUSEGRID"));
  check("line: bomb centre (FUSE end + .10 + BD/2, 1 - BD/2) = (3.25, .64), face 6.37 x 1, env {-.20, -.40, 6.77, 1.76}", near(LN.bomb.x, 3.25) && near(LN.bomb.y, .64) && LN.bomb.d === BD && J(LN.face) === J({ w: 6.37, h: 1 }) && near(LN.env.l, -.2) && near(LN.env.t, -.4) && near(LN.env.w, 6.77) && near(LN.env.h, 1.76), J(LN.env));
  check("stack: GRID first (i 0-3) at y 1.30 from x 0, FUSE after (i 4-7) at y 0 indented .504 (built), E gap to the cord .100", J(ST.letters.map((l) => l.ch).join("")) === J("GRIDFUSE") && J(xs(ST, 1)) === J([0, .82, 1.59, 1.98]) && ST.letters.every((l) => l.y === (l.word ? 1.3 : 0)) && near(ST.letters[4].x, .504, 5e-4) && near(ST.indent, .504) && near(ST.eGap, .1) && ST.letters.every((l, i) => l.i === i));
  check("stack: bomb centre (GRID end + .10 + BD/2, 2.30 - BD/2) = (3.14, 1.94), face 3.74 x 2.30, env {-.20, -.40, 4.14, 3.06}, baselines 1 and 2.30", near(ST.bomb.x, 3.14) && near(ST.bomb.y, 1.94) && J(ST.face) === J({ w: 3.74, h: 2.3 }) && near(ST.env.w, 4.14) && near(ST.env.h, 3.06) && J(ST.base) === J([1, 2.3]) && J(LN.base) === J([1]));
  for (const L of [LN, ST]) {
    check(`(d) ${L.build}: every letter sits inside the face box and the envelope (overshoot allowed)`, L.letters.every((l) => l.x >= -1e-9 && l.x + GL[l.ch].w <= L.face.w + 1e-9 && l.y - OVER >= -OVER - 1e-9 && l.y + 1 + OVER <= L.face.h + OVER + 1e-9 && inEnv([l.x, l.y - OVER, l.x + GL[l.ch].w, l.y + 1 + OVER], L.env)));
    check(`${L.build}: letters keep the GAP table face to face`, [0, 1].every((w) => { const ls = L.letters.filter((l) => l.word === w); return ls.every((l, i) => !i || near(l.x - (ls[i - 1].x + GL[ls[i - 1].ch].w), GAP[ls[i - 1].ch + l.ch])); }));
  }
  check("(a) layout takes the build only: no world can size the box", layout.length === 1 && layout("line") === LN && layout("stack") === ST);
  let threw = false; try { layout("square"); } catch { threw = true; }
  check("an unknown build throws", threw);

  /* ---- (e) cord: 6 lead segments from the collar tip to P0, then 90 samples of the cubic ---- */
  const CP = { line: [[.31, .73], [.39, .82], [.40, 1.03], [.54, 1.18]], stack: [[.31, .73], [.45, .95], [.22, 1.55], [.42, 2.46]] };
  for (const b of BUILDS) {
    const L = layout(b), pts = cordPath(b), base = b === "line" ? 1 : 2.3, Q = CP[b].map(([x, y]) => [L.bomb.x + x, base - y]);
    const a40 = deg(40), tip = [L.bomb.x + Math.sin(a40) * .6 * BD, L.bomb.y + .02 * BD - Math.cos(a40) * .6 * BD];
    check(`${b}: the control points are the appendix's (origin the baseline point under the bomb, y up)`, L.cord.every((p, i) => near(p[0], Q[i][0]) && near(p[1], Q[i][1])), J(L.cord));
    check(`(e) ${b}: 97 points; [0] the collar tip, [6] P0, [96] P3`, pts.length === 97 && near(pts[0].x, tip[0]) && near(pts[0].y, tip[1]) && near(L.collar[0], tip[0]) && near(L.collar[1], tip[1]) && near(pts[6].x, Q[0][0]) && near(pts[6].y, Q[0][1]) && near(pts[96].x, Q[3][0]) && near(pts[96].y, Q[3][1]), J([pts[0], pts[6], pts[96]]));
    check(`(e) ${b}: arc length grows, tangents are unit, every point inside the envelope`, pts.every((p, i) => (!i ? p.s === 0 : p.s > pts[i - 1].s) && near(Math.hypot(p.tx, p.ty), 1, 1e-9)) && pts.every((p) => inEnv([p.x, p.y, p.x, p.y], L.env)));
    check(`(e) ${b}: the widest cord with its outline stays inside the envelope`, pts.every((p) => inEnv([p.x - (CORD.w0 / 2 + CORD.ol), p.y - (CORD.w0 / 2 + CORD.ol), p.x + CORD.w0 / 2 + CORD.ol, p.y + CORD.w0 / 2 + CORD.ol], L.env)));
    const m = atS(pts, pts[96].s / 2);
    check(`${b}: atS walks the arc (half length lands between the ends)`, m.y < pts[0].y && m.y > pts[96].y && near(atS(pts, 1e9).x, pts[96].x));
    const mono = cordPath(b, "mono");
    check(`${b}: the mono cord starts at bomb + MONO.start (.23, -.27), not the collar`, near(mono[0].x, L.bomb.x + .23) && near(mono[0].y, L.bomb.y - .27) && near(mono[96].x, Q[3][0]) && J(MONO.start) === J([.23, -.27]));
  }
  check("deviation 7: the line cord tip is .18C above the cap line (P2 y 1.03, P3 1.18), the stacked tip .16C (P3 2.46)", near(cordPath("line")[96].y, -.18) && near(cordPath("stack")[96].y, -.16));
  check("CORD is appendix 8.5 (0.11 -> 0.09C, min 3 px, outline .035C / 1.2 px / 2 px small, braid .025C x .2C at 35 deg every .10 / .16C, key light .015C, burnt .07C at 1.3x, char .03C)", CORD.w0 === .11 && CORD.w1 === .09 && CORD.minPx === 3 && CORD.ol === .035 && CORD.olPx === 1.2 && CORD.olPxSmall === 2 && CORD.braid.w === .025 && CORD.braid.len === .2 && CORD.braid.deg === 35 && J(CORD.braid.step) === J({ title: .10, token: .16 }) && CORD.light.w === .015 && CORD.light.col === "#fff3b0" && CORD.burnt.len === .07 && CORD.burnt.k === 1.3 && CORD.char.w === .03 && CORD.char.col === "#1e1216" && CORD.col === "#ff9d5a" && CORD.braid.col === "#b8582a" && CORD.lead === 6 && CORD.n === 90);

  /* ---- spark: frame A / B, reduced still; pure in the frame index ---- */
  const rays = (sp) => sp.parts.filter((q) => q.k === "fill");
  const tipOf = (q) => flat(q.d)[0].pts[1];
  const A = spark(0), B = spark(1), R = spark(0, { reduced: true });
  check("frame A: 4 rays .17C at 15 + k90 deg in #ffd447, root .05C", rays(A).length === 4 && rays(A).every((q, i) => q.col === "#ffd447" && near(Math.hypot(...tipOf(q)), .17) && near(Math.atan2(tipOf(q)[1], tipOf(q)[0]), Math.atan2(Math.sin(deg(15 + 90 * i)), Math.cos(deg(15 + 90 * i))))) && SPARK.root === .05);
  check("frame B: 4 rays .13C at 45 + k90 deg in #ff5d73", rays(B).length === 4 && rays(B).every((q, i) => q.col === "#ff5d73" && near(Math.hypot(...tipOf(q)), .13) && near(Math.atan2(tipOf(q)[1], tipOf(q)[0]), Math.atan2(Math.sin(deg(45 + 90 * i)), Math.cos(deg(45 + 90 * i))))));
  const emb = (sp) => sp.parts.filter((q) => q.k === "rect").map((q) => [+(q.x + q.w / 2).toFixed(6), +(q.y + q.h / 2).toFixed(6), +q.w.toFixed(6)]);
  check("embers: .03C #ffb347 squares at A (+.18, +.08) (-.10, +.16) and B (+.12, +.18) (+.20, -.04), y up in the appendix (y down here)", J(emb(A)) === J([[.18, -.08, .03], [-.1, -.16, .03]]) && J(emb(B)) === J([[.12, -.18, .03], [.2, .04, .03]]) && A.parts.filter((q) => q.k === "rect").every((q) => q.col === "#ffb347"), J([emb(A), emb(B)]));
  const core = (sp) => sp.parts.filter((q) => q.k === "disc").map((q) => [+q.r.toFixed(9), q.col]);
  check("core: r .065C #fff3b0 over a .025C #0b0609 ring", J(core(A)) === J([[.09, "#0b0609"], [.065, "#fff3b0"]]) && J(core(B)) === J(core(A)));
  check("reduced: frame A geometry, rays and core #ffb347, no embers", R.frame === 0 && rays(R).every((q, i) => q.col === "#ffb347" && J(q.d) === J(rays(A)[i].d)) && emb(R).length === 0 && J(core(R)) === J([[.09, "#0b0609"], [.065, "#ffb347"]]) && J(spark(1, { reduced: true })) === J(R));
  check("pure in the frame index: same frame, same parts; frames read floor(t*14)&1 (2 -> A, 3 -> B)", J(spark(0)) === J(A) && J(spark(2)) === J(A) && J(spark(3)) === J(B) && A.frame === 0 && B.frame === 1);
  check("ray ink max(.02C, 1 px) drawn under the rays as their outline, no embers at the menu and 40 px tiers", A.parts.slice(0, 4).every((q) => q.k === "line" && q.col === "#0b0609" && near(q.w, .04)) && near(spark(0, { tier: "token", px: 20 }).parts[0].w, .1) && emb(spark(0, { tier: "menu", px: 36 })).length === 0 && emb(spark(0, { tier: "small", px: 24 })).length === 0);
  check("deviation 7: spark centre .04C past the tip at the title tier, 0 at token / MENU, -.04C at the 40 px build", J(SPARK.off) === J({ title: .04, token: 0, menu: 0, small: -.04 }) && BUILDS.every((b) => { const e = cordPath(b)[96], s = sparkAt(b, "title"), z = sparkAt(b, "menu"), m = sparkAt(b, "small"); return near(s.x, e.x + e.tx * .04) && near(s.y, e.y + e.ty * .04) && near(z.x, e.x) && near(m.y, e.y - e.ty * .04); }));
  check("40 px build spark: at least 8 px across (k = max(1, 8 / (.34 cap)))", near(spark(0, { tier: "small", px: 20 }).k, 8 / (.34 * 20)) && spark(0, { tier: "title", px: 20 }).k === 1);
  const sparkCaps = { title: [64, 120], token: [40, 63], menu: [32, 39], small: [20, 40 / 1.76, 31] }, pokes = [];
  for (const b of BUILDS) for (const [tier, caps] of Object.entries(sparkCaps)) for (const cap of caps) for (const f of [0, 1, "R"]) {
    const c = sparkAt(b, tier), sp = spark(f === "R" ? 0 : f, { tier, px: cap, reduced: f === "R" }), env = layout(b).env;
    for (const q of sp.parts) { const [x0, y0, x1, y1] = boxOf(q), o = Math.max(env.l - (x0 + c.x), env.t - (y0 + c.y), x1 + c.x - (env.l + env.w), y1 + c.y - (env.t + env.h)); if (o > 1e-9) pokes.push([b, tier, +cap.toFixed(2), f, q.k, +o.toFixed(4)]); }
  }
  check("(a) frames A and the reduced still, every build, tier and cap: the spark with its ink stays inside the envelope", !pokes.some((p) => p[3] !== 1), J(pokes.filter((p) => p[3] !== 1)));
  check("(a) frame B stays inside except its upper ember on the line build's title tier, .0044C above the top (built geometry, reported)", pokes.every((p) => p[3] === 1 && p[0] === "line" && p[1] === "title" && p[4] === "rect" && p[5] <= .005) && pokes.length === 2, J(pokes));

  /* ---- the logo bomb (units of D, origin the bomb centre, y down) ---- */
  const hb = bomb(100), mb = bomb(40), sb = bomb(16);
  check("bomb tiers by diameter in px: >= 60 hero, >= 26 the 40 recipe, else the 24 recipe (built thresholds)", hb.tier === "hero" && bomb(60).tier === "hero" && bomb(59.9).tier === "40" && bomb(26).tier === "40" && bomb(25.9).tier === "24" && sb.tier === "24" && BOMB.hero === 60 && BOMB.mid === 26);
  const kinds = (b) => b.parts.map((q) => q.k + (q.clip ? "@" + q.clip : "") + (q.tf ? "@tf" : "")).join(" ");
  check("hero: outline, body, lobe, key rim, fill rim, highlight, pin, cross shadow, cross, collar (ink, cap ink, face, cap, band, 2 rivets)", kinds(hb) === "ell ell disc@body rim@body rim@body ell@body disc@body line line rrect@tf ell@tf rrect@tf ell@tf line@tf disc@tf disc@tf disc@tf disc@tf", kinds(hb));
  check("40: no band line, no rivets, no cross shadow; 24: no lobe, rims or pin, a one-tone collar block", kinds(mb) === "ell ell disc@body rim@body rim@body ell@body disc@body line rrect@tf ell@tf rrect@tf ell@tf" && kinds(sb) === "ell ell ell@body line rect@tf rect@tf", kinds(mb) + " | " + kinds(sb));
  const body = hb.parts[1], ol = hb.parts[0];
  check("body: ellipse .50 x .48D at (0, +.02) #15181f, outline .05D #0a0d14 (2 px below the hero tier)", body.rx === .5 && body.ry === .48 && body.y === .02 && body.col === "#15181f" && near(ol.rx - body.rx, .05) && ol.col === "#0a0d14" && near(mb.parts[0].rx - .5, 2 / 40));
  check("lobe r .36 at (-.10, -.12) #2a3550; key rim #8a96a4 8 to 11 o'clock; fill rim #2e4a78 (built -5 to 95 deg)", J(hb.parts[2]) === J({ k: "disc", x: -.1, y: -.12, r: .36, col: "#2a3550", clip: "body" }) && hb.parts[3].col === "#8a96a4" && near(hb.parts[3].a0, deg(150)) && near(hb.parts[3].a1, deg(240)) && hb.parts[4].col === "#2e4a78" && near(hb.parts[4].a0, deg(-5)) && near(hb.parts[4].a1, deg(95)));
  check("highlight: .20 x .12 at (-.20, -.24) rotated -35 deg, white at .45; pin r .035 #fff8ec at (-.27, -.30)", hb.parts[5].rx === .1 && hb.parts[5].ry === .06 && near(hb.parts[5].rot, deg(-35)) && hb.parts[5].a === .45 && hb.parts[5].col === "#ffffff" && J(hb.parts[6]) === J({ k: "disc", x: -.27, y: -.3, r: .035, col: "#fff8ec", clip: "body" }));
  check("cross .08D white, round caps, shadow #0a0d14 at (+.015, +.02); 4 px at the 40 tier, 3 px at 24", hb.parts[8].w === .08 && hb.parts[8].col === "#ffffff" && hb.parts[8].cap === "round" && hb.parts[7].col === "#0a0d14" && near(flat(hb.parts[7].d)[0].pts[0][0], -.14 + .015) && near(flat(hb.parts[7].d)[0].pts[0][1], .04 + .02) && near(mb.parts[7].w, 4 / 40) && near(sb.parts[3].w, 3 / 16));
  const a40 = deg(40);
  check("collar at 40 deg, centre .52D along the axis from (0, .02); tip .60D", hb.parts.filter((q) => q.tf).every((q) => near(q.tf[0], Math.sin(a40) * .52) && near(q.tf[1], .02 - Math.cos(a40) * .52) && near(q.tf[2], a40)) && near(hb.tip[0], Math.sin(a40) * .6) && near(hb.tip[1], .02 - Math.cos(a40) * .6) && J(sb.tip) === J(hb.tip));
  check("the layout's collar tip is the bomb's tip at D = BD", BUILDS.every((b) => { const L = layout(b); return near(L.collar[0], L.bomb.x + hb.tip[0] * BD) && near(L.collar[1], L.bomb.y + hb.tip[1] * BD); }));
  check("standalone contact shadow: ellipse .40 x .09 at (0, +.49), #000000 at .35", J(BOMB.shadow) === J({ k: "ell", x: 0, y: .49, rx: .2, ry: .045, rot: 0, col: "#000000", a: .35 }));
  const bombBox = (q) => {
    if (q.k === "rim") return [-q.rx, q.y - q.ry, q.rx, q.y + q.ry];
    const loc = q.k === "ell" ? (() => { const r = Math.max(q.rx, q.ry); return [q.x - r, q.y - r, q.x + r, q.y + r]; })() : q.k === "rrect" || q.k === "rect" ? [q.x, q.y, q.x + q.w, q.y + q.h] : boxOf(q);
    if (!q.tf) return loc;
    const [tx, ty, a] = q.tf, c = Math.cos(a), s = Math.sin(a), cs = [[loc[0], loc[1]], [loc[2], loc[1]], [loc[0], loc[3]], [loc[2], loc[3]]].map(([x, y]) => [tx + x * c - y * s, ty + x * s + y * c]);
    return [Math.min(...cs.map((p) => p[0])), Math.min(...cs.map((p) => p[1])), Math.max(...cs.map((p) => p[0])), Math.max(...cs.map((p) => p[1]))];
  };
  for (const b of BUILDS) for (const bb of [hb, mb, sb]) {
    const L = layout(b), out = bb.parts.map(bombBox).map(([x0, y0, x1, y1]) => [L.bomb.x + x0 * BD, L.bomb.y + y0 * BD, L.bomb.x + x1 * BD, L.bomb.y + y1 * BD]).filter((bx) => !inEnv(bx, L.env));
    check(`(a) ${b}: the ${bb.tier} bomb stays inside the envelope`, !out.length, J(out));
  }

  /* ---- faces, layer stack, tiers ---- */
  check("faces never change by world: title / token / small FUSE #ffd447 #c8981e #fff3b0, GRID #ff5d73 #c23058 #ffc0d0", ["title", "token", "small"].every((t) => J(faces(t)) === J({ f: ["#ffd447", "#c8981e", "#fff3b0"], g: ["#ff5d73", "#c23058", "#ffc0d0"] })) && faces.length <= 2);
  check("MENU is cream #fff2df, shade #dccbb8, light #ffffff on both words; mono is one colour (cream, or #0b0609 for ink)", J(faces("menu")) === J({ f: ["#fff2df", "#dccbb8", "#ffffff"], g: ["#fff2df", "#dccbb8", "#ffffff"] }) && J(faces("mono")) === J({ f: ["#fff2df"], g: ["#fff2df"] }) && J(faces("mono", "ink")) === J({ f: ["#0b0609"], g: ["#0b0609"] }));
  check("STACK is appendix 8.4 (outline .10C, extrusion .14C, close .08C, shade (-.04, -.06), light (+.025, +.035), plate .94)", STACK.ol === .1 && STACK.ext === .14 && STACK.close === .08 && J(STACK.shade) === J([-.04, -.06]) && J(STACK.light) === J([.025, .035]) && STACK.plateA === .94 && STACK.side === "#1e1216" && STACK.smallPx === 2 && STACK.shadePx === 2 && J(STACK.lightTiers) === J(["title", "menu"]));
  const T = [[{ cap: 19.9 }, "mono"], [{ cap: 20 }, "small"], [{ cap: 31.9 }, "small"], [{ cap: 32 }, "menu"], [{ cap: 39.9 }, "menu"], [{ cap: 40 }, "token"], [{ cap: 63.9 }, "token"], [{ cap: 64 }, "title"], [{ cap: 200 }, "title"], [{ cap: 88, ver: "menu" }, "menu"], [{ cap: 88, ver: "mono" }, "mono"], [{ cap: 88, ver: "ink" }, "mono"], [{ cap: 50, ver: "full" }, "token"]];
  check("tierOf: < 20 or mono / ink -> mono; MENU or 32-39 -> menu; < 32 small; 40-63 token; >= 64 title", T.every(([o, t]) => tierOf(o) === t), J(T.map(([o]) => tierOf(o))));

  /* ---- worlds: side, plate, frame from the world tokens (ICE: the kit's glacier cyan, lead ruling) ---- */
  const MOCK = { JUNGLE: ["#0e4a28", "#062416", "#d4a030", "#ffe878", "tile.bg0"], FACTORY: ["#3d4a58", "#0e1218", "#8a96a4", "#d0d8e0", "tile.bg0"], WATER: ["#0a3a48", "#041820", "#6a7a88", "#c0d0dc", "tile.bg0"], ARENA: ["#4a2058", "#140818", "#6a6460", "#c8b8b0", "tile.bg0"], SAND: ["#6a4a18", "#241808", "#c4a070", "#f0e0c0", "tile.bg0"], VOID: ["#3a1070", "#020108", "#1a1428", "#8a70b0", "tile.brickB"], CROWN: ["#c49020", "#140808", "#8a6040", "#f0d080", "tile.brickB"] };
  check("WORLDS: the eight worlds in BIOMES order", J(Object.keys(WORLDS)) === J(NAMES) && J(BIOMES.map((b) => b.name)) === J(NAMES) && NAMES.every((n, i) => WORLDS[n].level === i + 1 && WORLDS[n].name === n));
  check("seven worlds equal the mock's built rows (side, bed, frame, frame highlight, PIXEL side slot)", Object.entries(MOCK).every(([n, r]) => J([WORLDS[n].side, WORLDS[n].bed, WORLDS[n].frame, WORLDS[n].frameHi, WORLDS[n].px]) === J(r)), J(Object.keys(MOCK).map((n) => [WORLDS[n].side, WORLDS[n].bed, WORLDS[n].frame, WORLDS[n].frameHi])));
  const ice = WORLDS.ICE, it = worldTokens(2);
  check("ICE (lead ruling, section 14 item 13): bed tok.bg1 #0f2429, side and frame the tinted wall #3a4d54, frame highlight tok.boss #dae6ea, slot tile.wall", ice.bed === "#0f2429" && ice.bed === it.bg1 && ice.side === "#3a4d54" && ice.side === it.wall && ice.frame === it.frame && ice.frameHi === "#dae6ea" && ice.frameHi === it.boss && ice.px === "tile.wall", J(ice));
  check("one colour source: every row reads worldTokens (bed = bg1, frame = frame, frame highlight = boss, side = the slot named by px)", NAMES.every((n, i) => { const t = worldTokens(i + 1), r = WORLDS[n]; return r.bed === t.bg1 && r.frame === t.frame && r.frameHi === t.boss && r.side === t.biome[r.px.slice(5)] && r.a === .94; }));
  check("rows carry no face colour: faces stay yellow and coral in every world", NAMES.every((n) => !Object.values(WORLDS[n]).some((v) => v === "#ffd447" || v === "#ff5d73")) && P.yel === "#ffd447" && P.cor === "#ff5d73");
  check("worldOf takes a name or a level (9 wraps to JUNGLE)", worldOf("SAND") === WORLDS.SAND && worldOf(6) === WORLDS.SAND && worldOf(9) === WORLDS.JUNGLE && worldOf("NOPE") === null);
  check("ICE frost rim #f4fcff; VOID rings .04 + .04C (#6a20c8 then #3a1070) after a .16C close; CROWN gilt .02C #fff0a8 catch line, .03C ink line", ice.frost === "#f4fcff" && J(WORLDS.VOID.ring) === J({ close: .16, w: [.04, .04], col: ["#6a20c8", "#3a1070"] }) && J(WORLDS.CROWN.gilt) === J({ line: .02, linePx: 1, col: "#fff0a8", ink: .03, inkPx: 1.2 }) && NAMES.filter((n) => WORLDS[n].frost || WORLDS[n].ring || WORLDS[n].gilt).join() === "ICE,VOID,CROWN");
  check("plate corner marks (mock screen.css): FACTORY bolts, ARENA studs, CROWN filigree, none elsewhere", J(NAMES.map((n) => WORLDS[n].corner && WORLDS[n].corner.kind)) === J([null, null, "bolt", null, "stud", null, null, "filigree"]));

  /* ---- L1 twin: every face colour >= 3:1 on its world's plate bed, by token math ---- */
  const table = NAMES.map((n) => [n, ratio(P.yel, WORLDS[n].bed), ratio(P.cor, WORLDS[n].bed), ratio(P.cream, WORLDS[n].bed)]);
  console.log("    contrast vs plate bed (FUSE / GRID / MENU cream): " + table.map(([n, f, g, c]) => `${n} ${f.toFixed(2)} / ${g.toFixed(2)} / ${c.toFixed(2)}`).join(", "));
  check("L1 (token math): FUSE and GRID faces >= 3:1 against every world's plate bed", table.every(([, f, g]) => f >= 3 && g >= 3), J(table.filter(([, f, g]) => f < 3 || g < 3)));
  check("L1 (token math): the cream MENU faces >= 3:1 against every plate bed", table.every(([, , , c]) => c >= 3));

  /* ---- motifs ---- */
  const TIERS = ["title", "token", "menu"], CAPS = { title: [64, 72, 120], token: [40, 63], menu: [32, 39] };
  check("no motif at the small and mono tiers, and none for CROWN at the MENU tier (the coronet goes down to cap 40)", NAMES.every((n) => BUILDS.every((b) => !motif(n, b, "small", 24).length && !motif(n, b, "mono", 16).length)) && !motif("CROWN", "line", "menu", 36).length && motif("CROWN", "line", "token", 40).length > 0);
  check("the MENU tier wears the token motif", NAMES.filter((n) => n !== "CROWN").every((n) => J(motif(n, "line", "menu", 36)) === J(motif(n, "line", "token", 36))));
  check("VOID draws no motif part (its rings are a layer of the stack)", BUILDS.every((b) => TIERS.every((t) => !motif("VOID", b, t, 64).length)));
  check("every part names the letter it sits on (or the bomb)", NAMES.every((n) => BUILDS.every((b) => TIERS.every((t) => motif(n, b, t, 64).every((q) => "FUSEGRID".includes(q.on) && q.on.length === 1 || q.on === "bomb")))));
  const lettersOn = (n, t) => [...new Set(motif(n, "line", t, 64).map((q) => q.on))].sort().join("");
  check("motif table: JUNGLE F U D (token F), ICE caps + icicles (token F G), FACTORY U S E G D (token U D), WATER drips U E R D + bubbles (token U D), ARENA every letter (token F D), SAND every letter, CROWN I",
    lettersOn("JUNGLE", "title") === "DFU" && lettersOn("JUNGLE", "token") === "F" && lettersOn("ICE", "title") === "DEFGIRU" && lettersOn("ICE", "token") === "FG" && lettersOn("FACTORY", "title") === "DEGSU" && lettersOn("FACTORY", "token") === "DU" && lettersOn("WATER", "token") === "DU" && motif("WATER", "line", "title", 64).some((q) => q.on === "bomb") && lettersOn("ARENA", "title") === "DEFGIRSU" && lettersOn("ARENA", "token") === "DF" && lettersOn("SAND", "title") === "DEFGIRSU" && lettersOn("CROWN", "title") === "I",
    ["JUNGLE", "ICE", "FACTORY", "WATER", "ARENA", "SAND", "CROWN"].map((n) => n + ":" + lettersOn(n, "title") + "/" + lettersOn(n, "token")).join(" "));
  check("SAND grain is fixed: the same parts every call (seeded by letter index, no Math.random)", J(motif("SAND", "stack", "title", 72)) === J(motif("SAND", "stack", "title", 72)) && motif("SAND", "line", "title", 72).filter((q) => q.k === "rect").length > 100);

  /* (a) whatever a world draws stays inside the one envelope; the stack's own reach fits its margins */
  let outside = [];
  for (const n of NAMES) for (const b of BUILDS) for (const t of TIERS) for (const cap of CAPS[t]) for (const q of motif(n, b, t, cap)) if (!inEnv(boxOf(q), layout(b).env)) outside.push([n, b, t, cap, q.on, boxOf(q).map((v) => +v.toFixed(3))]);
  check("(a) every world's motif, every build, tier and cap, lies inside the fixed envelope", !outside.length, J(outside.slice(0, 4)));
  const rw = WORLDS.VOID.ring.w[0] + WORLDS.VOID.ring.w[1];
  check("(a) the layer stack fits the envelope margins: sides outline + VOID rings <= .20, below extrusion + outline + rings <= .36, above outline + rings <= .40", STACK.ol + rw <= .2 + 1e-9 && STACK.ext + STACK.ol + rw <= .36 + 1e-9 && STACK.ol + rw <= .4, [STACK.ol + rw, STACK.ext + STACK.ol + rw].map((v) => v.toFixed(3)).join());

  /* (b) coverage: motif area (fill + ink edge, every part) over the letter's own face area, on a 1/500 C grid */
  const N = 500, MASK = {};
  for (const ch of Object.keys(GL)) {
    const g = glyph(ch), rings = g.d.map((ops) => flat(ops).map((s) => s.pts)), cols = Math.ceil(g.w * N), rows = N + 16, m = new Uint8Array(cols * rows), ctr = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const px = (x + 0.5) / N, py = (y - 8 + 0.5) / N; if (rings.some((r) => evenodd(r, px, py))) m[y * cols + x] = 1; else if (rings.some((r) => r.slice(1).some((c) => inPoly(c, px, py)))) ctr[y * cols + x] = 1; }
    MASK[ch] = { cols, rows, m, ctr, n: m.reduce((a, v) => a + v, 0) };
  }
  const cover = (n, b, t, cap) => {
    const L = layout(b), parts = motif(n, b, t, cap).map((q) => [q, boxOf(q)]), res = {};
    for (const l of L.letters) {
      const M = MASK[l.ch], hitM = new Uint8Array(M.cols * M.rows);
      let inCtr = 0;
      for (const [q, bx] of parts) {
        const x0 = Math.max(0, Math.floor((bx[0] - l.x) * N)), x1 = Math.min(M.cols - 1, Math.ceil((bx[2] - l.x) * N)), y0 = Math.max(0, Math.floor((bx[1] - l.y) * N) + 8), y1 = Math.min(M.rows - 1, Math.ceil((bx[3] - l.y) * N) + 8);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = y * M.cols + x; if ((M.m[k] || (M.ctr[k] && q.clip !== "face")) && !hitM[k] && hit(q, l.x + (x + 0.5) / N, l.y + (y - 8 + 0.5) / N)) { hitM[k] = 1; if (M.ctr[k]) inCtr++; } }
      }
      let c = 0; for (let k = 0; k < hitM.length; k++) if (hitM[k] && M.m[k]) c++;
      res[l.ch] = { pct: (100 * c) / M.n, inCtr };
    }
    return res;
  };
  const worst = {};
  const over = [], ctrHit = [];
  for (const n of NAMES) for (const b of BUILDS) for (const t of TIERS) for (const cap of CAPS[t]) {
    const r = cover(n, b, t, cap);
    for (const [ch, v] of Object.entries(r)) {
      const key = n + " " + t;
      if (!worst[key] || v.pct > worst[key][1]) worst[key] = [ch, v.pct, b, cap];
      if (v.pct > 12) over.push([n, b, t, cap, ch, v.pct.toFixed(2)]);
      if (v.inCtr) ctrHit.push([n, b, t, cap, ch, v.inCtr]);
    }
  }
  console.log("    letter areas (C^2): " + Object.entries(areas).map(([c, a]) => c + " " + a.toFixed(4)).join(", "));
  console.log("    worst motif coverage per world and tier: " + Object.entries(worst).map(([k, [ch, p, b, cap]]) => `${k} ${ch} ${p.toFixed(2)}% (${b} cap ${cap})`).join("; "));
  check("(b) L2: no motif covers more than 12 % of any letter's face, every world, build, tier and cap", !over.length, J(over));
  check("L2: no motif part enters a counter", !ctrHit.length, J(ctrHit));

  /* (c) CROWN never uses the FUSE yellow */
  const near6 = (h) => { const a = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), y = [0xff, 0xd4, 0x47]; return a.every((v, i) => Math.abs(v - y[i]) <= 6); };
  const crownCols = [...new Set([...BUILDS.flatMap((b) => TIERS.flatMap((t) => motif("CROWN", b, t, 64).map((q) => q.col))), WORLDS.CROWN.side, WORLDS.CROWN.frame, WORLDS.CROWN.frameHi, WORLDS.CROWN.gilt.col])];
  check("(c) no CROWN motif, side, frame or gilt colour within 6 per channel of #ffd447", crownCols.length >= 5 && !crownCols.some(near6), crownCols.join());

  /* ---- (f) the 14 builder deviations, each number pinned at its built value ---- */
  const ringR = GL.R.sh[0];
  check("dev 1: R bowl bars .22 / .21C (counter .22 to .34, bowl to .55): counter .12C tall", ringR[1][0][1] === .22 && ringR[1][2][1] === .34 && ringR[0][2][1] === .55 && near(.55 - .34, .21) && near(ringR[1][2][1] - ringR[1][0][1], .12));
  const S = GL.S.sh[0][0];
  check("dev 2: the S spine is a .20C horizontal bar (y .40 to .60), not a diagonal", S[6][1] === .4 && S[7][1] === .4 && S[14][1] === .6 && S[15][1] === .6 && near(.6 - .4, .2));
  check("dev 3: the R ink trap is the leg's top-left corner pulled .04C off the stem (x .30 vs stem .26)", GL.R.sh[1][0][0][0] === .3 && near(GL.R.sh[1][0][0][0] - GL.R.sh[0][0][3][0], .04));
  const jt = motif("JUNGLE", "line", "title", 64), vines = jt.filter((q) => q.k === "line" && q.col === "#14a018" && q.w === MOTIF.vine.w);
  check("dev 4: JUNGLE vine .036C with a .015C ink edge (ink line .066C), two front passes across the F stem", MOTIF.vine.w === .036 && MOTIF.vine.ink === .015 && J(MOTIF.vine.pass) === J([.5, .82]) && vines.length === 4 && jt.filter((q) => q.k === "line" && q.col === "#0b0609").every((q) => near(q.w, .066)) && vines.filter((q) => q.on === "F" && flat(q.d)[0].pts[0][0] < .0).length === 2);
  check("dev 5: ICE snow caps sit .045 to .065C into the face (.035 to .05C at the token tier)", J(MOTIF.snow.title) === J([.045, .065]) && J(MOTIF.snow.token) === J([.035, .05]) && motif("ICE", "line", "title", 64).filter((q) => q.k === "fill" && q.col === "#f4fcff").every((q) => Math.max(...flat(q.d)[0].pts.map((p) => p[1])) <= .065 + 1e-9));
  const st = motif("ARENA", "line", "title", 64).filter((q) => q.col === "#0b0609"), rv = motif("FACTORY", "line", "title", 64).filter((q) => q.col === "#d0d8e0"), bu = motif("WATER", "line", "title", 64).filter((q) => q.k === "ring" && q.col === "#b8fff4");
  check("dev 6: ARENA studs .12C across, FACTORY rivets .045C radius, WATER bubbles .05 / .035C radii", MOTIF.stud.h === .06 && st.every((q) => { const p = flat(q.d)[0].pts, x = p.map((v) => v[0]); return near(Math.max(...x) - Math.min(...x), .12 + .04); }) && MOTIF.rivet.r === .045 && rv.length === 10 && rv.every((q) => q.r === .045) && J(bu.map((q) => q.r)) === J([.05, .035]));
  check("dev 7: spark offset and cord tip (pinned above)", SPARK.off.title === .04 && SPARK.off.small === -.04 && near(cordPath("line")[96].y, -.18));
  check("dev 8: PIXEL envelope top max(ceil(.40A), 7) art px (7 at cap 12), bottom ceil(.36A), sides ceil(.20A); x3 title and MENU, x2 the 40 px build", J(pxEnv(12)) === J({ t: 7, b: 5, s: 3 }) && J(pxEnv(24)) === J({ t: 10, b: 9, s: 5 }) && J(PX_SCALE) === J({ title: 3, menu: 3, small: 2 }));
  check("dev 9: REAL 3D side = 70 / 30 mix of the lip hex and the world side, x .72 at depth; .06C inverted-hull outline", LOOK3D.mix === .3 && LOOK3D.deep === .72 && LOOK3D.hull === .06 && LOOK3D.drop === .135 && LOOK3D.sy === .93);
  check("dev 10: VOID rings .04 + .04C after a .16C close (pinned above)", J(WORLDS.VOID.ring.w) === J([.04, .04]) && WORLDS.VOID.ring.close === .16);
  check("dev 11: REAL 3D soft shadow sigma .02C at (+.08, +.12)C, alpha .45", J(LOOK3D.shadow) === J({ dx: .08, dy: .12, sigma: .02, a: .45 }));

  /* ---- (h) frozen, and the same on every call ---- */
  const outs = [P, GL, GAP, CORD, SPARK, BOMB, STACK, LOOK3D, MONO, PX_SCALE, WORLDS, MOTIF, LN, ST, glyph("R"), cordPath("line"), cordPath("stack", "mono"), atS(cordPath("line"), .2), A, R, hb, sb, sparkAt("line", "title"), faces("title"), pxEnv(12), motif("JUNGLE", "line", "title", 64), motif("SAND", "stack", "token", 40), motif("CROWN", "stack", "title", 88)];
  check("(h) every export and every result is deep-frozen", outs.every(deepFrozen), outs.findIndex((o) => !deepFrozen(o)));
  let mut = false; try { LN.env.w = 99; } catch { mut = true; }
  check("(h) mutating a result throws and changes nothing", mut && LN.env.w !== 99 && near(layout("line").env.w, 6.77));
  check("(h) repeat calls give the same numbers", J(cordPath("stack")) === J(cordPath("stack")) && glyph("S") === glyph("S") && J(bomb(100)) === J(hb) && J(motif("ICE", "line", "title", 72)) === J(motif("ICE", "line", "title", 72)) && J(spark(1)) === J(B));
}

console.log(pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
