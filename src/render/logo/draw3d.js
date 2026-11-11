/* LOGO B, REAL 3D (appendix 8.9): the overlay illustration of the extruded wordmark, drawn with Canvas 2D from glyphs.js / worlds.js alone (no three,
   no vendor import), registered with draw2d.js when it loads with the REAL 3D look (three/load.js), so the title shows CLASSIC until then.
   Placement, plate, spark (CLASSIC's unlit sprite), clock and cache are draw2d's; this file only fills the world layer:
   faces foreshortened LOOK3D.sy about the last baseline, a soft cast shadow and contact AO under everything, the 0.06C inverted-hull outline (no slab
   closing; VOID still closes at 0.16C before its rings), the side swept LOOK3D.drop, darkening to LOOK3D.deep at depth, one bevel (upper-left facets
   in the highlight hex, lower-right in face x 0.70), the motif with a hard drop, the Phong-look bomb and the tube cord.
   No filter, so the mock's blurred shadows become stacked offset fills at stepped alpha (SOFT: a hard core and a 0.02C fringe each way).
   SIDE.variant: "mix" is the built 70 / 30 mix of the lip hex and the world side colour (deviation 9); "lip" is the spec's lip hex darkening to
   x 0.80 (appendix 14 item 8), kept as the owner's veto option and in the cache key. Every mask is a padded canvas; only the logo rect is drawn. */
import {P, BD, BOMB, LOOK3D, SPARK, CORD, cordPath, faces} from "./glyphs.js";
import {motif} from "./worlds.js";
import {registerLogo, paintPlate, mk, fresh, word, part, dil, close} from "./draw2d.js";

export const SIDE = {variant: "mix"};
const TAU = 2 * Math.PI, A40 = (40 * Math.PI) / 180, SOFT = [[0, 0, .25], [.02, 0, .1], [-.02, 0, .1], [0, .02, .1], [0, -.02, .1]];
const rgb = (h) => [16, 8, 0].map((q) => (parseInt(h.slice(1), 16) >> q) & 255);
const css = (c, k = 1) => "rgb(" + c.map((v) => Math.max(0, Math.min(255, Math.round(v * k)))).join(",") + ")";
const mix = (a, b, t) => rgb(a).map((v, i) => v * (1 - t) + rgb(b)[i] * t);

function bomb3d(x, cx, cy, D, px) {
  const u = (v) => v * D, rx = u(.5), ry = u(.48), oy = cy + u(.02), ux = Math.sin(A40), uy = -Math.cos(A40);
  x.fillStyle = P.bombOl; x.beginPath(); x.ellipse(cx, oy, rx + u(.03), ry + u(.03), 0, 0, TAU); x.fill();
  x.save(); x.beginPath(); x.ellipse(cx, oy, rx, ry, 0, 0, TAU); x.clip();
  const g = x.createRadialGradient(cx - u(.18), cy - u(.2), u(.02), cx + u(.05), oy + u(.05), u(.62));
  g.addColorStop(0, "#3a4866"); g.addColorStop(.28, P.lobe); g.addColorStop(.62, P.bomb); g.addColorStop(1, P.bombOl);
  x.fillStyle = g; x.fillRect(cx - rx, oy - ry, 2 * rx, 2 * ry);
  x.save(); x.beginPath(); x.moveTo(cx, oy); x.arc(cx, oy, u(.8), -.1, 1.75); x.closePath(); x.clip();
  x.fillStyle = "rgba(188,212,255,.35)"; x.beginPath(); x.ellipse(cx, oy, rx, ry, 0, 0, TAU); x.ellipse(cx - u(.04), oy - u(.04), rx, ry, 0, 0, TAU); x.fill("evenodd"); x.restore();
  const h = x.createRadialGradient(cx - u(.22), cy - u(.26), 0, cx - u(.22), cy - u(.26), u(.13));
  h.addColorStop(0, "rgba(255,244,226,.95)"); h.addColorStop(.45, "rgba(255,244,226,.55)"); h.addColorStop(1, "rgba(255,244,226,0)");
  x.fillStyle = h; x.beginPath(); x.ellipse(cx - u(.22), cy - u(.26), u(.16), u(.11), -.6, 0, TAU); x.fill();
  x.restore();
  const cross = (dx, dy, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(cx - u(.14) + dx, cy + u(.04) + dy); x.quadraticCurveTo(cx + dx, cy + u(.08) + dy, cx + u(.14) + dx, cy + u(.04) + dy); x.moveTo(cx + dx, cy - u(.1) + dy); x.lineTo(cx + dx, cy + u(.18) + dy); x.stroke(); };
  x.lineCap = "round";
  const cw = Math.max(u(.08), 3 / px);
  cross(u(.02), u(.025), cw, "rgba(0,0,0,.55)"); cross(u(.006), u(.008), cw, "#c8ccd4"); cross(-u(.004), -u(.004), Math.max(u(.07), 2.5 / px), P.white);
  x.save(); x.translate(cx + ux * u(.52), oy + uy * u(.52)); x.rotate(A40);
  const cg = x.createLinearGradient(-u(.12), 0, u(.12), 0);
  cg.addColorStop(0, P.steelHi); cg.addColorStop(.45, P.steel); cg.addColorStop(1, "#4a5666");
  x.fillStyle = P.bombOl; x.beginPath(); x.roundRect(-u(.14), -u(.09), u(.28), u(.18), u(.05)); x.fill();
  x.fillStyle = cg; x.fillRect(-u(.12), -u(.07), u(.24), u(.14));
  x.fillStyle = P.steelHi; x.beginPath(); x.ellipse(0, -u(.07), u(.12), u(.04), 0, 0, TAU); x.fill();
  x.restore();
}
/* the cord's points, foreshortened like the faces (the CLASSIC path from the collar tip) */
const cord3 = (build, base) => cordPath(build).map((p) => ({...p, y: base + (p.y - base) * LOOK3D.sy}));

function fill3d(x, G) {
  paintPlate(x, G);
  const {L, env, s, Wd, Hd, P: Pl, dxL, dyL} = G, tier = Pl.tier, px = G.px, sy = LOOK3D.sy, base = L.base[L.base.length - 1], pp = Math.ceil(.22 * s) + 2, Wp = Wd + 2 * pp, Hp = Hd + 2 * pp;
  const ox = -env.l * s + pp, oy = -env.t * s + pp, pool = [], work = () => { const c = mk(Wp, Hp); pool.push(c); fresh(c); return c; };
  const T = (c, q = sy) => { const t = c.getContext("2d"); t.setTransform(s, 0, 0, s * q, ox, oy + base * (1 - q) * s); t.fillStyle = "#000"; return t; };
  const S1 = work(), id = () => x.setTransform(1, 0, 0, 1, 0, 0);
  const put = (src, col, a = 1, dx = 0, dy = 0, cut) => {
    const t = fresh(S1);
    t.drawImage(src, 0, 0);
    if (cut) cut(t);
    t.globalCompositeOperation = "source-in"; t.fillStyle = col; t.fillRect(0, 0, Wp, Hp); t.globalCompositeOperation = "source-over";
    id(); x.globalAlpha = a; x.drawImage(S1, pp, pp, Wd, Hd, dxL + dx, dyL + dy, Wd, Hd); x.globalAlpha = 1;
  };
  const minus = (src, dx, dy) => (t) => { t.globalCompositeOperation = "destination-out"; t.imageSmoothingEnabled = true; t.drawImage(src, dx, dy); t.imageSmoothingEnabled = false; };
  const F = [work(), work()], B = work(), sol = work(), ext = work(), ink = work(), tmp = work();
  F.forEach((c, w) => word(T(c), L, w));
  const bt = T(B, 1), by = base + (L.bomb.y - base) * sy;
  bt.beginPath(); bt.ellipse(L.bomb.x, by + BOMB.oy * BD, BOMB.rx * BD, BOMB.ry * BD, 0, 0, TAU); bt.fill();
  const so = fresh(sol);
  for (const c of [...F, B]) so.drawImage(c, 0, 0);
  const e = LOOK3D.drop * s, ex = fresh(ext);
  ex.imageSmoothingEnabled = true;
  for (let i = 0; i <= Math.ceil(e); i++) ex.drawImage(sol, 0, Math.min(i, e));
  const sh = LOOK3D.shadow;
  for (const [dx, dy, a] of SOFT) put(ext, "#000", a * sh.a / .45, (sh.dx + dx) * s, (sh.dy + dy) * s);
  for (const [dx, dy, a] of SOFT) put(ext, "#000", a * .6, dx * s, (.05 + dy) * s);
  dil(ink, ext, LOOK3D.hull * s, tmp);
  const R = G.w.ring, on = (r) => !!r && r.tiers.includes(tier);
  if (R && on(R.close)) {
    close(ink, work(), R.close.w * s, work());
    const r1 = work(), r2 = work();
    dil(r1, ink, R.inner.w * s, tmp);
    if (on(R.outer)) { dil(r2, r1, R.outer.w * s, tmp); put(r2, R.outer.col); }
    put(r1, R.inner.col);
  }
  put(ink, P.ol);
  const C = faces(tier), n = Math.max(1, Math.ceil(e)), side = G.w.side;
  for (let i = n; i >= 1; i--) {
    const f = i / n;
    for (const w of [0, 1]) { const lip = (w ? C.g : C.f)[1]; put(F[w], SIDE.variant === "lip" ? css(rgb(lip), 1 - .2 * f) : css(mix(lip, side, LOOK3D.mix), 1 - (1 - LOOK3D.deep) * f), 1, 0, i); }
    put(B, css([10, 12, 18], 1.6 - f), 1, 0, i);
  }
  if (G.w.gilt) put(ext, G.w.gilt.line.col, .8, 0, 0, (t) => { minus(ext, 0, -.05 * s)(t); t.globalCompositeOperation = "destination-in"; t.drawImage(sol, 0, .07 * s); });
  const b = .05 * s;
  for (const w of [0, 1]) {
    const [fc, , hi] = w ? C.g : C.f;
    put(F[w], fc);
    put(F[w], css(rgb(fc), .7), 1, 0, 0, minus(F[w], -.8 * b, -.8 * b));
    put(F[w], hi, 1, 0, 0, minus(F[w], .7 * b, .7 * b));
  }
  if (Pl.layers.some((l) => l.id === "motif")) {
    const M = work(), mx = T(M), parts = motif(G.w.name, G.build, tier, px), gl = work(), gx = T(gl);
    for (const q of parts) part(q.clip === "face" ? gx : mx, q);
    put(M, "#000", .45, .025 * s, .04 * s);
    id(); x.drawImage(M, pp, pp, Wd, Hd, dxL, dyL, Wd, Hd);
    const g2 = gl.getContext("2d");
    g2.setTransform(1, 0, 0, 1, 0, 0); g2.globalCompositeOperation = "destination-in"; g2.drawImage(sol, 0, 0);
    id(); x.drawImage(gl, pp, pp, Wd, Hd, dxL, dyL, Wd, Hd);
  }
  x.setTransform(s, 0, 0, s, dxL + ox - pp, dyL + oy - pp);
  bomb3d(x, L.bomb.x, by, BD, px);
  const pts = cord3(G.build, base), len = pts[pts.length - 1].s, wd = (q) => Math.max(CORD.w0 - (CORD.w0 - CORD.w1) * (q.s / len), CORD.min.px / px), ow = Math.max(CORD.ink.w, CORD.ink.min.px[tier] / px);
  const tube = (c, col, k = 1, from = 1) => { c.strokeStyle = col; c.lineCap = "round"; for (let i = from; i < pts.length; i++) { c.lineWidth = wd(pts[i]) * k + (col === P.ol ? 2 * ow : 0); c.beginPath(); c.moveTo(pts[i - 1].x, pts[i - 1].y); c.lineTo(pts[i].x, pts[i].y); c.stroke(); } };
  tube(x, P.ol);
  const rope = work(), rx = T(rope, 1), nrm = (q) => (q.tx - q.ty < q.ty - q.tx ? [-q.ty, q.tx] : [q.ty, -q.tx]);
  tube(rx, "#e8854a");
  rx.globalCompositeOperation = "source-atop";
  for (const [k, col, lw] of [[.22, P.cord, .5], [.3, P.amb, .28]]) { rx.strokeStyle = col; rx.lineWidth = CORD.w0 * lw; rx.beginPath(); pts.forEach((q, i) => { const m = nrm(q), d = wd(q) * k; rx[i ? "lineTo" : "moveTo"](q.x + m[0] * d, q.y + m[1] * d); }); rx.stroke(); }
  const st = CORD.braid.step[tier], a = (CORD.braid.rot * Math.PI) / 180;
  if (st) { rx.strokeStyle = P.cord2; rx.lineWidth = Math.max(CORD.braid.w, 1 / px); rx.lineCap = "butt"; for (let d = st * CORD.braid.first; d < len - CORD.braid.stop; d += st) { const q = pts.find((p) => p.s >= d), dx = q.tx * Math.cos(a) - q.ty * Math.sin(a), dy = q.tx * Math.sin(a) + q.ty * Math.cos(a), h = CORD.braid.len / 2; rx.beginPath(); rx.moveTo(q.x - dx * h, q.y - dy * h); rx.lineTo(q.x + dx * h, q.y + dy * h); rx.stroke(); } }
  if (CORD.burnt.tiers.includes(tier)) {
    tube(rx, P.cord2, CORD.burnt.k, pts.findIndex((q) => q.s > len - CORD.burnt.len));
    const q = pts[pts.length - 1], m = nrm(q), H = CORD.char;
    rx.strokeStyle = P.dk; rx.lineWidth = Math.max(H.w, H.min.px / px); rx.lineCap = "butt"; rx.beginPath();
    rx.moveTo(q.x + m[0] * H.half - q.tx * H.back, q.y + m[1] * H.half - q.ty * H.back); rx.lineTo(q.x - m[0] * H.half - q.tx * H.back, q.y - m[1] * H.half - q.ty * H.back); rx.stroke();
  }
  id(); x.drawImage(rope, pp, pp, Wd, Hd, dxL, dyL, Wd, Hd);
  for (const c of pool) c.width = c.height = 0;
}
export function look3d(G) {
  const e = cord3(G.build, G.L.base[G.L.base.length - 1]).at(-1), off = SPARK.off[G.P.tier] || 0;
  G.fw = fill3d; G.noRun = true; G.tip = {x: e.x + e.tx * off, y: e.y + e.ty * off};
  G.wk.layer += "." + SIDE.variant;
}
registerLogo("3d", look3d);
