// Controller and keyboard diagrams and the position glyphs, on the menu kit's colours: vector only, no images, no maker shapes. Ids are positions.
import { ACCENT, TEXT, MUTED, WARM, font, sans } from "./menudraw.js";
import { rr } from "./icons.js";
import { CONST } from "./kit/tokens.js";
import { wallCell } from "./kit/paint.js";
import { layer, canMake } from "./kit/cache.js";

const WELL = "#0a0e18", CAP = "rgba(4,7,14,0.9)", BODY = "#16203a";

/** Reads an SVG-style path (M L H V C Q Z, absolute) into canvas calls, so the art draws on the headless stub too. */
export function trace(c, d) {
  const n = d.match(/[MLHVCQZ]|-?[\d.]+/g);
  let i = 0, x = 0, y = 0, op = "";
  const num = () => +n[i++];
  c.beginPath();
  while (i < n.length) {
    if (/[A-Z]/.test(n[i])) op = n[i++];
    if (op === "Z") { c.closePath(); continue; }
    if (op === "M") { x = num(); y = num(); c.moveTo(x, y); op = "L"; }
    else if (op === "L") { x = num(); y = num(); c.lineTo(x, y); }
    else if (op === "H") { x = num(); c.lineTo(x, y); }
    else if (op === "V") { y = num(); c.lineTo(x, y); }
    else if (op === "Q") { const a = num(), b = num(); x = num(); y = num(); c.quadraticCurveTo(a, b, x, y); }
    else if (op === "C") { const a = num(), b = num(), e = num(), f = num(); x = num(); y = num(); c.bezierCurveTo(a, b, e, f, x, y); }
  }
}

/* THE CONTROLLER (round 7, appendix 9.1): a front-view twin-grip controller, every size a fraction of the body width W, the outline one mirrored
   half of cubic segments. Shading is top-lit gradient FILLS (an approved exception) and hard offset drops: no filter, no blur. Bound inputs wear the
   world's brick (tok.lit / lit2), unbound ones are quiet dark caps; lock (no controller) puts the body in the wall's rule tone under the wall
   texture and every input unbound. Ids are positions: dpad LS RS SELECT START N E S W SHL SHR TRL TRR. */
export const PADG = Object.freeze({ LS: [0.215, 0.245, 0.078], DPAD: [0.36, 0.39, 0.088], RS: [0.64, 0.39, 0.078], fc: [0.785, 0.245], off: 0.088, br: 0.052, SEL: [0.44, 0.245], STA: [0.56, 0.245] });
export const HALF = Object.freeze([[0.5, 0.03], [[0.63, 0.03], [0.73, 0.04], [0.82, 0.065]], [[0.905, 0.09], [0.955, 0.14], [0.972, 0.23]], [[0.988, 0.32], [1.0, 0.42], [0.995, 0.5]],
  [[0.99, 0.6], [0.94, 0.648], [0.875, 0.645]], [[0.82, 0.642], [0.79, 0.6], [0.765, 0.555]], [[0.74, 0.51], [0.7, 0.49], [0.64, 0.488]], [[0.58, 0.487], [0.54, 0.49], [0.5, 0.49]]]);
export const BUMP = Object.freeze([[0.62, 0.034], [0.7, 0.036], [0.76, 0.05], [0.82, 0.065], [0.905, 0.09], [0.952, 0.135], [0.966, 0.19]]);
const [FX, FY] = PADG.fc, FO = PADG.off, MIR = (p) => [1 - p[0], p[1]];
/* where each input sits (W units): the dot a leader starts from */
export const PART_AT = Object.freeze({ LS: [PADG.LS[0], PADG.LS[1]], dpad: [PADG.DPAD[0], PADG.DPAD[1]], RS: [PADG.RS[0], PADG.RS[1]], SELECT: PADG.SEL, START: PADG.STA,
  N: [FX, FY - FO], E: [FX + FO, FY], S: [FX, FY + FO], W: [FX - FO, FY], SHR: BUMP[5], SHL: MIR(BUMP[5]), TRR: [0.833, 0.006], TRL: [0.167, 0.006] });
/* the appendix's obstacle radii (W units): stick and D-PAD wells, a face button's well, the pills */
export const PART_R = Object.freeze({ LS: PADG.LS[2], dpad: PADG.DPAD[2], RS: PADG.RS[2], N: PADG.br + 0.009, E: PADG.br + 0.009, S: PADG.br + 0.009, W: PADG.br + 0.009, SELECT: 0.03, START: 0.03 });
/** The body outline at body width W, moved dy down. */
export function bodyPath(c, W, dy = 0) {
  const P = (p, m) => [(m ? 1 - p[0] : p[0]) * W, p[1] * W + dy];
  c.beginPath(); c.moveTo(...P(HALF[0]));
  for (let i = 1; i < HALF.length; i++) c.bezierCurveTo(...P(HALF[i][0]), ...P(HALF[i][1]), ...P(HALF[i][2]));
  for (let i = HALF.length - 1; i >= 1; i--) c.bezierCurveTo(...P(HALF[i][1], 1), ...P(HALF[i][0], 1), ...P(i === 1 ? HALF[0] : HALF[i - 1][2], 1));
  c.closePath();
}
const n1 = (v) => +(v * 100).toFixed(1);
/** The same outline as an SVG-style string at W = 100, for trace(). */
export const BODY_PATH = (() => {
  const P = (p, m) => n1(m ? 1 - p[0] : p[0]) + "," + n1(p[1]);
  let d = "M" + P(HALF[0]);
  for (let i = 1; i < HALF.length; i++) d += " C" + P(HALF[i][0]) + " " + P(HALF[i][1]) + " " + P(HALF[i][2]);
  for (let i = HALF.length - 1; i >= 1; i--) d += " C" + P(HALF[i][1], 1) + " " + P(HALF[i][0], 1) + " " + P(i === 1 ? HALF[0] : HALF[i - 1][2], 1);
  return d + " Z";
})();
const OL = CONST.ol, TAU = Math.PI * 2, WH = "#ffffff", BK = "#000000";
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/* t of the way from h to the colour to: "h 74 % over white" is mix(h, WH, 0.26) */
export const mix = (h, to, t) => { const a = hx(h), b = hx(to); return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
/* gradient fills; a context without them (the headless stub) takes the flat colour, or skips an overlay (flat null) */
const lin = (c, y0, y1, st, flat) => { if (typeof c.createLinearGradient !== "function") return flat; const g = c.createLinearGradient(0, y0, 0, y1); if (!g) return flat; for (const [o, col] of st) g.addColorStop(o, col); return g; };
const rad = (c, x, y, r, st, flat) => { if (typeof c.createRadialGradient !== "function") return flat; const g = c.createRadialGradient(x, y, 0, x, y, r); if (!g) return flat; for (const [o, col] of st) g.addColorStop(o, col); return g; };
/* a radial in the SVG bounding-box units of the circle (x, y, R): centre (cx, cy) and radius r of its box */
const radBox = (c, x, y, R, cx, cy, r, st, flat) => rad(c, x - R + cx * 2 * R, y - R + cy * 2 * R, r * 2 * R, st, flat);
const ring0 = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); };
const alpha = (c, a, fn) => { const a0 = c.globalAlpha; c.globalAlpha = a0 * a; fn(); c.globalAlpha = a0; };
/* a capsule centred on x y, w x h, ends of radius h / 2 */
function capsule(c, x, y, w, h) {
  const r = h / 2, l = x - w / 2 + r, R = x + w / 2 - r;
  c.beginPath(); c.moveTo(l, y - r); c.lineTo(R, y - r); c.arc(R, y, r, -Math.PI / 2, Math.PI / 2); c.lineTo(l, y + r); c.arc(l, y, r, Math.PI / 2, Math.PI * 1.5); c.closePath();
}
const wellFill = (c, x, y, R, t) => radBox(c, x, y, R, 0.5, 0.42, 0.6, [[0, mix(t.key, BK, 0.6)], [1, "#050304"]], "#050304");
function well(c, x, y, R, t) {
  ring0(c, x, y, R); c.fillStyle = wellFill(c, x, y, R, t); c.fill(); c.strokeStyle = OL; c.lineWidth = 1.5; c.stroke();
  const rm = lin(c, y - R, y + R, [[0, "rgba(0,0,0,0.55)"], [0.55, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,0.3)"]], null);
  if (rm) { ring0(c, x, y, R - 1.5); c.strokeStyle = rm; c.lineWidth = 2; c.stroke(); }
}
const faceFill = (c, x, y, r, t, on) => (on ? radBox(c, x, y, r, 0.38, 0.3, 0.8, [[0, mix(t.lit, WH, 0.45)], [0.5, t.lit], [1, t.lit2]], t.lit) : radBox(c, x, y, r, 0.38, 0.3, 0.8, [[0, mix(t.key, WH, 0.38)], [0.55, t.key], [1, mix(t.key, BK, 0.55)]], t.key));
function face(c, x, y, W, t, on) {
  const r = PADG.br * W;
  well(c, x, y, r + 0.009 * W, t);
  alpha(c, 0.55, () => { ring0(c, x, y + 2, r); c.fillStyle = OL; c.fill(); });
  ring0(c, x, y, r); c.fillStyle = faceFill(c, x, y, r, t, on); c.fill(); c.strokeStyle = OL; c.lineWidth = 1.6; c.stroke();
  if (typeof c.ellipse === "function") alpha(c, 0.22, () => { c.fillStyle = WH; c.beginPath(); c.ellipse(x - 0.22 * r, y - 0.36 * r, 0.45 * r, 0.26 * r, 0, 0, TAU); c.fill(); });
}
const capFill = (c, y0, y1, t, on) => (on ? lin(c, y0, y1, [[0, mix(t.lit, WH, 0.4)], [1, t.lit2]], t.lit) : lin(c, y0, y1, [[0, mix(t.key, WH, 0.45)], [1, mix(t.key, BK, 0.45)]], t.key));
const dishFill = (c, y0, y1, t, on) => (on ? lin(c, y0, y1, [[0, t.lit2], [1, mix(t.lit, WH, 0.3)]], t.lit2) : lin(c, y0, y1, [[0, mix(t.key, BK, 0.55)], [1, mix(t.key, WH, 0.2)]], t.key));
function stick(c, x, y, W, R, t, on) {
  const rc = 0.056 * W, rd = 0.039 * W, rg = (rc + rd) / 2, n = Math.max(8, Math.round((TAU * rg) / 4));
  well(c, x, y, R, t);
  alpha(c, 0.6, () => { ring0(c, x, y + 3, rc); c.fillStyle = OL; c.fill(); });
  ring0(c, x, y, rc); c.fillStyle = capFill(c, y - rc, y + rc, t, on); c.fill(); c.strokeStyle = OL; c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = "rgba(0,0,0,0.28)"; c.lineWidth = 0.01 * W;
  for (let i = 0; i < n; i++) { const a = (i * TAU) / n; c.beginPath(); c.arc(x, y, rg, a, a + (TAU / n) * 0.4); c.stroke(); } // the grip ring's dashes as arcs: the headless stub has no line dash
  ring0(c, x, y, rd); c.fillStyle = dishFill(c, y - rd, y + rd, t, on); c.fill(); c.strokeStyle = "rgba(11,6,9,0.45)"; c.lineWidth = 1; c.stroke();
}
function pill(c, x, y, W, t, on) {
  const w = 0.05 * W, h = 0.026 * W;
  capsule(c, x, y, w + 5, h + 5); c.fillStyle = wellFill(c, x, y, (w + 5) / 2, t); c.fill(); c.strokeStyle = OL; c.lineWidth = 1.2; c.stroke();
  capsule(c, x, y, w, h); c.fillStyle = on ? capFill(c, y - h / 2, y + h / 2, t, true) : lin(c, y - h / 2, y + h / 2, [[0, mix(t.key, WH, 0.3)], [1, mix(t.key, BK, 0.4)]], t.key); c.fill(); c.strokeStyle = OL; c.lineWidth = 1.4; c.stroke();
}
function plus(c, a, t, q) {
  c.beginPath(); c.moveTo(-t + q, -a); c.lineTo(t - q, -a); c.quadraticCurveTo(t, -a, t, -a + q); c.lineTo(t, -t); c.lineTo(a - q, -t); c.quadraticCurveTo(a, -t, a, -t + q);
  c.lineTo(a, t - q); c.quadraticCurveTo(a, t, a - q, t); c.lineTo(t, t); c.lineTo(t, a - q); c.quadraticCurveTo(t, a, t - q, a); c.lineTo(-t + q, a); c.quadraticCurveTo(-t, a, -t, a - q);
  c.lineTo(-t, t); c.lineTo(-a + q, t); c.quadraticCurveTo(-a, t, -a, t - q); c.lineTo(-a, -t + q); c.quadraticCurveTo(-a, -t, -a + q, -t); c.lineTo(-t, -t); c.lineTo(-t, -a + q); c.quadraticCurveTo(-t, -a, -t + q, -a); c.closePath();
}
function dpad(c, x, y, W, t, on) {
  const a = 0.07 * W, h = 0.024 * W, q = 0.008 * W;
  well(c, x, y, PADG.DPAD[2] * W, t);
  c.save(); c.translate(x, y);
  c.save(); c.translate(0, 3); plus(c, a, h, q); alpha(c, 0.6, () => { c.fillStyle = OL; c.fill(); }); c.restore();
  plus(c, a, h, q); c.fillStyle = capFill(c, -a, a, t, on); c.fill(); c.strokeStyle = OL; c.lineWidth = 1.6; c.lineJoin = "round"; c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.3)"; c.lineWidth = 2; c.lineCap = "round"; c.beginPath(); c.moveTo(-h + 3, -a + 3); c.lineTo(h - 3, -a + 3); c.stroke(); c.lineCap = "butt";
  ring0(c, 0, 0, 0.016 * W); c.fillStyle = dishFill(c, -0.016 * W, 0.016 * W, t, on); c.fill(); c.strokeStyle = "rgba(11,6,9,0.4)"; c.lineWidth = 1; c.stroke();
  c.restore();
}
function trigger(c, W, m, t, on) {
  const w = 0.2 * W, h = 0.1 * W, r = 0.035 * W, P = Math.PI;
  c.save(); c.translate((m ? 0.24 : 0.76) * W, 0.02 * W); if (typeof c.rotate === "function") c.rotate(((m ? -9 : 9) * P) / 180);
  c.beginPath(); c.moveTo(-w / 2 + r, -h / 2); c.lineTo(w / 2 - r, -h / 2); c.arc(w / 2 - r, -h / 2 + r, r, -P / 2, 0); c.lineTo(w / 2, h / 2 - r); c.arc(w / 2 - r, h / 2 - r, r, 0, P / 2);
  c.lineTo(-w / 2 + r, h / 2); c.arc(-w / 2 + r, h / 2 - r, r, P / 2, P); c.lineTo(-w / 2, -h / 2 + r); c.arc(-w / 2 + r, -h / 2 + r, r, P, P * 1.5); c.closePath();
  c.fillStyle = on ? capFill(c, -h / 2, h / 2, t, true) : lin(c, -h / 2, h / 2, [[0, mix(t.key, BK, 0.3)], [1, mix(t.key, BK, 0.6)]], t.key); c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.stroke();
  c.restore();
}
function bumpPath(c, W, m) {
  const P = (p) => [(m ? 1 - p[0] : p[0]) * W, p[1] * W];
  c.beginPath(); c.moveTo(...P(BUMP[0])); c.bezierCurveTo(...P(BUMP[1]), ...P(BUMP[2]), ...P(BUMP[3])); c.bezierCurveTo(...P(BUMP[4]), ...P(BUMP[5]), ...P(BUMP[6]));
}
function bumper(c, W, m, t, on) {
  const w = 0.072 * W;
  c.lineCap = "round";
  bumpPath(c, W, m); c.strokeStyle = OL; c.lineWidth = w + 3.5; c.stroke();
  c.strokeStyle = on ? t.lit : mix(t.key, WH, 0.25); c.lineWidth = w; c.stroke();
  c.save(); c.translate(0, -0.022 * W); bumpPath(c, W, m); c.strokeStyle = "rgba(255,255,255,0.16)"; c.lineWidth = 2; c.stroke(); c.restore();
  c.lineCap = "butt";
}
/* the static drawing: triggers, bumpers, the body, then the inputs in the appendix's order */
function paintPad(c, W, t, on, lock, grips) {
  const lip = 0.026 * W, top = lock ? t.rule : t.band, y0 = 0.03 * W, y1 = 0.648 * W, clip = typeof c.clip === "function";
  trigger(c, W, 1, t, on.TRL); trigger(c, W, 0, t, on.TRR); bumper(c, W, 1, t, on.SHL); bumper(c, W, 0, t, on.SHR);
  bodyPath(c, W, 0.03 * W); alpha(c, 0.5, () => { c.fillStyle = BK; c.fill(); }); // the drop: a hard offset fill, never a blur
  bodyPath(c, W); c.fillStyle = lin(c, y0, y1, [[0, mix(t.key, BK, 0.3)], [1, mix(t.key, BK, 0.6)]], t.key); c.fill();
  c.save();
  if (clip) { bodyPath(c, W); c.clip(); }
  const gb = () => { bodyPath(c, W, -lip); c.fillStyle = lin(c, y0 - lip, y1 - lip, [[0, mix(top, WH, 0.26)], [0.3, mix(top, WH, 0.12)], [0.62, top], [1, mix(top, BK, 0.38)]], top); c.fill(); };
  gb();
  if (lock && clip) { // the wall texture at .3: the cells whole, then the body again at .7 over them (a cell's own shapes overlap, so a .3 alpha per shape would stack)
    const s = 0.15 * W;
    for (let y = 0; y < y1; y += s) for (let x = 0; x < W; x += s) wallCell(c, x, y, s, t, { code: 1, veil: true });
    alpha(c, 0.7, gb);
  }
  if (typeof c.ellipse === "function") for (const gx of [0.14, 0.86]) {
    c.beginPath(); c.ellipse(gx * W, 0.62 * W, 0.16 * W, 0.12 * W, 0, 0, TAU);
    const gg = radBox(c, gx * W, 0.62 * W, 0.16 * W, 0.5, 1, 0.9, [[0, "rgba(0,0,0,0.34)"], [1, "rgba(0,0,0,0)"]], null);
    if (gg) { c.fillStyle = gg; c.fill(); }
    if (grips) { c.strokeStyle = t.lit; c.lineWidth = 3; c.stroke(); } // VIBRATION: both grips light, in the brick
  }
  const hl = lin(c, y0 - lip, y1 - lip, [[0, "rgba(255,255,255,0.34)"], [0.18, "rgba(255,255,255,0)"]], null);
  if (hl) { bodyPath(c, W, -lip); c.fillStyle = hl; c.fill(); }
  c.restore();
  bodyPath(c, W); c.strokeStyle = OL; c.lineWidth = 2.5; c.lineJoin = "round"; c.stroke();
  const at = (id) => [PART_AT[id][0] * W, PART_AT[id][1] * W];
  stick(c, ...at("LS"), W, PADG.LS[2] * W, t, on.LS); dpad(c, ...at("dpad"), W, t, on.dpad); stick(c, ...at("RS"), W, PADG.RS[2] * W, t, on.RS);
  for (const id of ["N", "E", "S", "W"]) face(c, ...at(id), W, t, on[id]);
  pill(c, ...at("SELECT"), W, t, on.SELECT); pill(c, ...at("START"), W, t, on.START);
}
/** The drawing's reach past its W x 0.648 W body box (the triggers above, the drop below), in px from the body box's top-left. */
export const padBox = (W) => ({ x0: -3, y0: -0.06 * W - 3, x1: W + 3, y1: 0.68 * W + 3 });
/** The radius of the focus ring round a part: its button's radius + 3 + 1.5 (appendix 5). */
export const ringR = (id, W) => (id.length === 1 ? PADG.br * W : id === "SELECT" || id === "START" ? 0.025 * W + 2.5 : PART_R[id] ? PART_R[id] * W : 0.045 * W) + 4.5;
const devScale = (c) => { const m = typeof c.getTransform === "function" ? c.getTransform() : null; return m && m.a > 0 ? Math.min(3, Math.hypot(m.a, m.b || 0)) : 1; };
/** The controller at body width W, its body box's top-left at x y. o: {tok, lit:{id:true}, lock, ring:id, press:id, grips, reduced}. The static drawing
    is one kit/cache.js layer keyed by world, W, dpr and the lit set (painted straight where no layer canvas can be made); the ring and a press draw live. */
export function drawPad(c, x, y, W, o) {
  const q = o || {}, t = q.tok, lock = !!q.lock, on = lock ? {} : q.lit || {}, grips = !!q.grips && !lock, B = padBox(W);
  if (canMake() && typeof c.drawImage === "function") {
    const dpr = devScale(c), sig = (lock ? "L" : "") + (grips ? "G" : "") + Object.keys(on).filter((k) => on[k]).sort().join(","), w = Math.ceil((B.x1 - B.x0) * dpr), h = Math.ceil((B.y1 - B.y0) * dpr);
    const cv = layer({ layer: "pad", biome: t.name, level: sig, W: Math.round(W * 100) / 100, H: 0, dpr, look: "2d", textScale: 1 }, w, h, (g) => { g.scale(dpr, dpr); g.translate(-B.x0, -B.y0); paintPad(g, W, t, on, lock, grips); });
    c.drawImage(cv, x + B.x0, y + B.y0, w / dpr, h / dpr);
  } else { c.save(); c.translate(x, y); paintPad(c, W, t, on, lock, grips); c.restore(); }
  const p = q.press && !lock && q.press.length === 1 && PART_AT[q.press];
  if (p) { // a live press: the face drops 2 px and flashes (REDUCE FLASH: the drop only)
    const fx = x + p[0] * W, fy = y + p[1] * W + 2, r = PADG.br * W;
    ring0(c, fx, fy, r); c.fillStyle = on[q.press] ? t.lit : t.key; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.6; c.stroke();
    if (!q.reduced) alpha(c, 0.5, () => { ring0(c, fx, fy, r); c.fillStyle = "#fff3b0"; c.fill(); });
  }
  const g = !lock && q.ring && PART_AT[q.ring];
  if (g) { // the focused row's button: 3 px cream over a 5 px dark underlay at .7
    const rx = x + g[0] * W, ry = y + g[1] * W, R = ringR(q.ring, W);
    alpha(c, 0.7, () => { ring0(c, rx, ry, R); c.strokeStyle = OL; c.lineWidth = 5; c.stroke(); });
    ring0(c, rx, ry, R); c.strokeStyle = CONST.ink; c.lineWidth = 3; c.stroke();
  }
}
/** A plan's leaders and callouts (controlsgeo padPlan), the drawing's origin at x y: plain orthogonal lines, 1.5 px t2 over a 3.5 px dark underlay,
    a 3 px dot on the button; ACTION in cream over the position in t2, a FIXED tag after a fixed one. No cord, no spark. */
export function drawCallouts(c, x, y, plan) {
  c.lineJoin = "round";
  for (const L of plan.lines) for (const [col, w] of [[OL, 3.5], [CONST.t2, 1.5]]) {
    c.beginPath(); L.pts.forEach((p, i) => (i ? c.lineTo(x + p[0], y + p[1]) : c.moveTo(x + p[0], y + p[1]))); c.strokeStyle = col; c.lineWidth = w; c.stroke();
  }
  for (const L of plan.lines) if (L.dot) { ring0(c, x + L.pts[0][0], y + L.pts[0][1], 3); c.fillStyle = CONST.t2; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.2; c.stroke(); }
  c.textBaseline = "middle";
  for (const b of plan.labels) for (const ln of b.lines) {
    const bx = x + b.x, ly = y + ln.y, tw = ln.tag || 0, tx = b.side === "l" ? bx - tw - (tw ? 6 : 0) : bx;
    c.font = sans(ln.px, "700"); c.textAlign = b.side === "l" ? "right" : "left"; c.fillStyle = ln.act ? CONST.ink : CONST.t2;
    c.fillText(ln.s, tx, ly);
    if (tw) { // the FIXED tag: a dark wall chip, its legend in the locked ink
      const cx = b.side === "l" ? bx - tw : bx + ln.w + 6, th = ln.px + 4;
      c.fillStyle = OL; c.fillRect(cx, ly - th / 2, tw, th);
      c.fillStyle = CONST.off; c.textAlign = "left"; c.fillText(FIXED, cx + 4, ly);
    }
  }
}
export const FIXED = "FIXED";
/* One highlight rule for pad and keyboard, on the path already built: lit = solid accent with a soft edge, alias = accent outline, swap = gold outline. */
function paintBuilt(c, s) {
  if (s === "lit") {
    c.save();
    c.strokeStyle = ACCENT; c.lineJoin = "round";
    c.globalAlpha = 0.12; c.lineWidth = 10; c.stroke();
    c.globalAlpha = 0.25; c.lineWidth = 6; c.stroke();
    c.restore();
    c.fillStyle = ACCENT; c.fill();
    return;
  }
  c.fillStyle = CAP; c.fill();
  c.lineWidth = s ? 2 : 1;
  c.strokeStyle = s === "alias" ? ACCENT : s === "swap" ? WARM : MUTED;
  c.stroke();
}
/* Keyboard, u=20, true stagger. [id,label,x,w]; a null label is a ghost cap. */
const LETTERS = (s, x0) => [...s].map((ch, i) => ["Key" + ch, null, x0 + i * 20]);
export const KB_ROWS = [
  [30, [["Escape", "ESC", 0, 30]]],
  [52, [[0, null, 0, 28], ...LETTERS("QWERTYUIOP", 30)]],
  [72, [[0, null, 0, 34], ...LETTERS("ASDFGHJKL", 36), ["Enter", "ENTER", 216, 44]]],
  [92, [["ShiftLeft", null, 0, 44], ...LETTERS("ZXCVBNM", 46), ["Comma", null, 186], ["Period", null, 206], ["Slash", null, 226], ["ArrowUp", "U", 260]]],
  [112, [[0, null, 0, 30], [0, null, 32, 38], ["Space", "SPACE", 72, 122], [0, null, 196, 30], ["ArrowLeft", "L", 240], ["ArrowDown", "D", 260], ["ArrowRight", "R", 280]]],
];
const ARROW = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const shortKey = (id) => (id === "ShiftLeft" ? "SHIFT" : id === "Comma" ? "," : id === "Period" ? "." : id === "Slash" ? "/" : id.replace("Key", ""));
/** The keyboard. o: {keys:{code:state}, base:Set of always-labelled codes, names:{code:printed}, labels:[[points],x,y,align,word], fs}. Type floors at 10 px on screen. */
export function drawKeys(c, x, y, k, o) {
  const q = o || {}, st = q.keys || {}, base = q.base || new Set(), names = q.names || {};
  c.save(); c.translate(x, y); c.scale(k, k);
  rr(c, -6, 24, 312, 112, 6); c.fillStyle = BODY; c.fill();
  c.strokeStyle = MUTED; c.lineWidth = 1.5; c.stroke();
  for (const [ry, row] of KB_ROWS) for (const [id, lab0, kx, kw] of row) {
    const w = kw || 18, s = st[id], lab = lab0 || (id && (s || base.has(id)) ? (names[id] ? String(names[id]).toUpperCase() : shortKey(id)) : null);
    rr(c, kx + 0.5, ry + 0.5, w - 1, 17, 2);
    if (!lab) {
      c.fillStyle = CAP; c.fill();
      c.save(); c.globalAlpha = 0.45; c.strokeStyle = MUTED; c.lineWidth = 1; c.stroke(); c.restore();
      continue;
    }
    paintBuilt(c, s);
    const ink = s === "lit" ? WELL : s === "alias" ? ACCENT : s === "swap" ? WARM : TEXT;
    if (ARROW[id]) {
      const [dx, dy] = ARROW[id], mx = kx + w / 2, my = ry + 9;
      c.fillStyle = ink; c.beginPath();
      c.moveTo(mx + dx * 4, my + dy * 4); c.lineTo(mx - dx * 3 + dy * 4, my - dy * 3 + dx * 4); c.lineTo(mx - dx * 3 - dy * 4, my - dy * 3 - dx * 4);
      c.closePath(); c.fill();
    } else {
      c.fillStyle = ink; c.font = font(Math.max(lab.length > 1 ? 9 : 11, 10 / k), "900"); c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(lab, kx + w / 2, ry + 9.5);
    }
  }
  for (const [pts, lx, ly, al, word] of q.labels || []) {
    c.strokeStyle = ACCENT; c.lineWidth = 1.5;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.stroke();
    c.fillStyle = ACCENT; c.font = font((q.fs || 10) / k, "900"); c.textAlign = al; c.textBaseline = "middle";
    c.fillText(word, lx, ly);
  }
  c.restore();
}
/* A rounded rect with square bottom corners, for the trigger glyph. */
function rrTop(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x, y + h); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
  c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h); c.closePath();
}
/** A position glyph, box h tall, top-left at x,y-h/2; returns its width. Always shown beside a word. */
export function glyph(c, kind, x, y, h, v, col) {
  const k = h / 16, on = col || TEXT, off = MUTED;
  c.save(); c.translate(x, y - h / 2); c.scale(k, k); c.lineWidth = 1.2; c.lineJoin = "round";
  let w = 16;
  if (kind === "face") {
    const D = { N: [8, 3.5], E: [12.5, 8], S: [8, 12.5], W: [3.5, 8] };
    for (const f in D) { c.fillStyle = f === v ? on : off; c.beginPath(); c.arc(D[f][0], D[f][1], f === v ? 3 : 1.4, 0, 7); c.fill(); }
  } else if (kind === "dpad") {
    trace(c, "M5.5,1 H10.5 V5.5 H15 V10.5 H10.5 V15 H5.5 V10.5 H1 V5.5 H5.5 Z");
    c.strokeStyle = off; c.stroke();
    c.fillStyle = on;
    if (v === "all") c.fill();
    if (v === "U") c.fillRect(5.5, 1, 5, 5);
    if (v === "D") c.fillRect(5.5, 10, 5, 5);
    if (v === "L") c.fillRect(1, 5.5, 5, 5);
    if (v === "R") c.fillRect(10, 5.5, 5, 5);
  } else if (kind === "shoulder" || kind === "trigger") {
    rr(c, 1, 10, 14, 4, 2); c.strokeStyle = off; c.stroke();
    for (const m of [0, 1]) {
      const act = (m ? "R" : "L") === v;
      if (kind === "shoulder") rr(c, m ? 8.5 : 1.5, 6, 6, 3, 1);
      else if (act) rrTop(c, m ? 9 : 2, 1, 5, 8, 2.5);
      else rrTop(c, m ? 9 : 2, 4, 5, 5, 2.5);
      if (act) { c.fillStyle = on; c.fill(); } else { c.strokeStyle = off; c.stroke(); }
    }
  } else if (kind === "stick") {
    w = 18;
    for (const m of [0, 1]) {
      const act = (m ? "R" : "L") === v, cx = m ? 13.5 : 4.5;
      c.strokeStyle = act ? on : off; c.beginPath(); c.arc(cx, 8, act ? 4 : 2, 0, 7); c.stroke();
      if (act) { c.fillStyle = on; c.beginPath(); c.arc(cx, 8, 2.5, 0, 7); c.fill(); }
    }
  } else if (kind === "centre") {
    for (const [px, id] of [[0.5, "SELECT"], [8.5, "START"]]) {
      rr(c, px, 5.5, 7, 5, 2.5);
      if (v === id) { c.fillStyle = on; c.fill(); } else { c.strokeStyle = off; c.lineWidth = 1; c.stroke(); }
    }
  }
  c.restore();
  return w * k;
}
