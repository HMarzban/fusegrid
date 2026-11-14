// Controller and keyboard diagrams and the position glyphs, on the menu kit's colours: vector only, no images, no maker shapes (the face legends follow the
// controller in hand, R-LABELS). Ids are positions.
import { TEXT, MUTED, sans } from "./menudraw.js";
import { rr } from "./icons.js";
import { CONST } from "./kit/tokens.js";
import { wallCell, glyph as kitGlyph, PAD_GLYPH } from "./kit/paint.js";
import { PAD_FAMILY_WORDS } from "./words.js";
import { layer, canMake } from "./kit/cache.js";


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
/* R-LABELS: the face buttons' legends in the family of the controller in hand (words.js PAD_FAMILY_WORDS: a letter, or a kit glyph where the word is one);
   a generic pad has none, as before. The body stays the generic twin-grip one. */
function faceLegends(c, W, t, on, fam) {
  const T = PAD_FAMILY_WORDS[fam], r = PADG.br * W;
  if (!T || fam === "generic") return;
  for (const id of ["N", "E", "S", "W"]) {
    const [x, y] = [PART_AT[id][0] * W, PART_AT[id][1] * W], s = T[id].w, col = on[id] ? OL : CONST.ink, g = PAD_GLYPH[s];
    if (g) { const z = r * 1.15; kitGlyph(c, g, x - z / 2, y - z / 2, z, col); continue; }
    c.font = sans(Math.round(r * 1.1), "800"); c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = col; c.fillText(s, x, y + 0.5);
  }
}
function paintPad(c, W, t, on, lock, grips, fam) {
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
  if (fam && !lock) faceLegends(c, W, t, on, fam);
}
/** The drawing's reach past its W x 0.648 W body box (the triggers above, the drop below), in px from the body box's top-left. */
export const padBox = (W) => ({ x0: -3, y0: -0.06 * W - 3, x1: W + 3, y1: 0.68 * W + 3 });
/** The radius of the focus ring round a part: its button's radius + 3 + 1.5 (appendix 5). */
export const ringR = (id, W) => (id.length === 1 ? PADG.br * W : id === "SELECT" || id === "START" ? 0.025 * W + 2.5 : PART_R[id] ? PART_R[id] * W : 0.045 * W) + 4.5;
const devScale = (c) => { const m = typeof c.getTransform === "function" ? c.getTransform() : null; return m && m.a > 0 ? Math.min(3, Math.hypot(m.a, m.b || 0)) : 1; };
/** The controller at body width W, its body box's top-left at x y. o: {tok, lit:{id:true}, lock, ring:id, press:id, grips, reduced}. The static drawing
    is one kit/cache.js layer keyed by world, W, dpr and the lit set (painted straight where no layer canvas can be made); the ring and a press draw live. */
export function drawPad(c, x, y, W, o) {
  const q = o || {}, t = q.tok, lock = !!q.lock, on = lock ? {} : q.lit || {}, grips = !!q.grips && !lock, B = padBox(W), fam = q.fam && q.fam !== "generic" && PAD_FAMILY_WORDS[q.fam] ? q.fam : null;
  if (canMake() && typeof c.drawImage === "function") {
    const dpr = devScale(c), sig = (lock ? "L" : "") + (grips ? "G" : "") + (fam && !lock ? fam + ":" : "") + Object.keys(on).filter((k) => on[k]).sort().join(","), w = Math.ceil((B.x1 - B.x0) * dpr), h = Math.ceil((B.y1 - B.y0) * dpr);
    const cv = layer({ layer: "pad", biome: t.name, level: sig, W: Math.round(W * 100) / 100, H: 0, dpr, look: "2d", textScale: 1 }, w, h, (g) => { g.scale(dpr, dpr); g.translate(-B.x0, -B.y0); paintPad(g, W, t, on, lock, grips, fam); });
    c.drawImage(cv, x + B.x0, y + B.y0, w / dpr, h / dpr);
  } else { c.save(); c.translate(x, y); paintPad(c, W, t, on, lock, grips, fam); c.restore(); }
  const p = q.press && !lock && q.press.length === 1 && PART_AT[q.press];
  if (p) { // a live press: the face drops 2 px and flashes (REDUCE FLASH: the drop only)
    const fx = x + p[0] * W, fy = y + p[1] * W + 2, r = PADG.br * W;
    ring0(c, fx, fy - 2, r + 1); c.fillStyle = "#050304"; c.fill(); // the well first, so no crescent of the face at rest shows over the drop
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
export function drawCallouts(c, x, y, plan, tok) {
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
    if (tw) { // the FIXED tag: a wall plaque (the world's band tone, the dark outline), its legend in t2
      const cx = b.side === "l" ? bx - tw : bx + ln.w + 6, th = ln.px + 4;
      c.fillStyle = tok ? tok.band : CONST.dk; c.fillRect(cx, ly - th / 2, tw, th);
      c.strokeStyle = OL; c.lineWidth = 1.5; c.strokeRect(cx + 0.75, ly - th / 2 + 0.75, tw - 1.5, th - 1.5);
      c.fillStyle = CONST.t2; c.textAlign = "left"; c.fillText(FIXED, cx + 4, ly);
    }
  }
}
export const FIXED = "FIXED";
/* THE KEYBOARD (round 7, appendix 9.3): a tenkeyless board in key units k. ESC / F-row with the 4-4-4 groups, the main block in real widths and
   stagger (TAB 1.5, CAPS 1.75, SHIFT 2.25 / 2.75, ENTER 2.25, BACKSPACE 2, SPACE 6.25), the arrows an inverted T after a 0.5 u gap. A row entry is
   [code, width (default 1), legend (default the code's own)]; "_" is a gap. Codes are KeyboardEvent codes, so a bind lights its own key. */
const KR = (y, list) => [y, list.map((q) => (Array.isArray(q) ? q : [q]))];
const K1 = (s, pre = "Key") => [...s].map((ch) => [pre + ch, 1, ch]);
export const KB_ROWS = Object.freeze([
  KR(0, [["Escape", 1.5, "ESC"], ["_", 0.5], ...[1, 2, 3, 4].map((n) => ["F" + n]), ["_", 0.5], ...[5, 6, 7, 8].map((n) => ["F" + n]), ["_", 0.5], ...[9, 10, 11, 12].map((n) => ["F" + n])]),
  KR(1.5, [["Backquote", 1, "`"], ...K1("1234567890", "Digit"), ["Minus", 1, "-"], ["Equal", 1, "="], ["Backspace", 2, "⌫"]]),
  KR(2.5, [["Tab", 1.5, "TAB"], ...K1("QWERTYUIOP"), ["BracketLeft", 1, "["], ["BracketRight", 1, "]"], ["Backslash", 1.5, "\\"]]),
  KR(3.5, [["CapsLock", 1.75, "CAPS"], ...K1("ASDFGHJKL"), ["Semicolon", 1, ";"], ["Quote", 1, "'"], ["Enter", 2.25, "ENTER"]]),
  KR(4.5, [["ShiftLeft", 2.25, "SHIFT"], ...K1("ZXCVBNM"), ["Comma", 1, ","], ["Period", 1, "."], ["Slash", 1, "/"], ["ShiftRight", 2.75, "SHIFT"]]),
  KR(5.5, [["ControlLeft", 1.75, "CTRL"], ["AltLeft", 2, "ALT"], ["Space", 6.25, "SPACE"], ["AltRight", 2, "ALT"], ["Fn", 1.25, "FN"], ["ControlRight", 1.75, "CTRL"]]),
]);
export const KB_W = 18.5, KB_H = 6.5, KB_ARROWS = Object.freeze([["ArrowUp", 16.5, 4.5], ["ArrowLeft", 15.5, 5.5], ["ArrowDown", 16.5, 5.5], ["ArrowRight", 17.5, 5.5]]);
/** Every key in units: {id, x, y, w, leg, f (an F-row key)}. */
export const KB_KEYS = Object.freeze((() => {
  const out = [];
  for (const [y, row] of KB_ROWS) { let x = 0; for (const [id, w = 1, leg = id] of row) { if (id !== "_") out.push(Object.freeze({ id, x, y, w, leg, f: /^F\d+$/.test(id) })); x += w; } }
  for (const [id, x, y] of KB_ARROWS) out.push(Object.freeze({ id, x, y, w: 1, leg: "", f: false }));
  return out;
})());
export const KB_AT = Object.freeze(Object.fromEntries(KB_KEYS.map((q) => [q.id, q])));
/** A key's drawn rect at pitch k: the gap g = max(2, 0.1 k) is split round it. */
export const keyRect = (q, k) => { const g = Math.max(2, 0.1 * k); return { x: q.x * k + g / 2, y: q.y * k + g / 2, w: q.w * k - g, h: k - g }; };
/** A key's top face inside its rect: set back more at the front, so the skirt shows below. */
const faceOf = (r, k) => ({ x: r.x + 0.08 * k, y: r.y + 0.04 * k, w: r.w - 0.16 * k, h: r.h - 0.22 * k });
const rrect = (c, x, y, w, h, r) => { // corners as arcs (the drawing's own art, never a kit corner)
  r = Math.max(0, Math.min(r, w / 2, h / 2)); const P = Math.PI;
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -P / 2, 0); c.lineTo(x + w, y + h - r); c.arc(x + w - r, y + h - r, r, 0, P / 2);
  c.lineTo(x + r, y + h); c.arc(x + r, y + h - r, r, P / 2, P); c.lineTo(x, y + r); c.arc(x + r, y + r, r, P, P * 1.5); c.closePath();
};
/** The legend size at pitch k and text scale ts (desktop 15.8, never under the 10 px floor: 0 = no print). */
export const kbLegend = (k, ts = 1) => { const px = Math.min(15.8 * ts, 0.5 * k); return px >= 10 && k - Math.max(2, 0.1 * k) - 0.22 * k >= px * 0.75 + 2 ? px : 0; };
/** A key's legend in the player's own layout: names (code to printed letter, the wire's keyNames) replace a one-character legend; ESC, TAB, the
    F-row, ⌫ and the arrows keep theirs. */
export const legOf = (q, names) => (names && names[q.id] && q.leg.length === 1 && q.id !== "Backspace" ? String(names[q.id]).toUpperCase() : q.leg);
/* the legends names change, as a layer key part: "" with none, so a default board keeps its key; one slot by identity (the wire hands a new names
   object only when a name changes), so a steady frame walks no KB_KEYS */
let lsOf = null, lsSig = "";
const legSig = (names) => { if (names !== lsOf) { lsOf = names; lsSig = names ? KB_KEYS.filter((q) => legOf(q, names) !== q.leg).map((q) => q.id + "=" + legOf(q, names)).join() : ""; } return lsSig; };
/** Which legends print at pitch k: a legend wider than its top face is left off (a lit key gets the face's whole width), the F-row prints all or
    none, and with no legend size at all only the arrow glyphs print (the rows name every key). mw(s, px) measures; names as legOf. */
export function kbPrints(k, lit, mw, ts = 1, names) {
  const px = kbLegend(k, ts), out = {};
  if (!px) return out;
  const fits = (q) => { const f = faceOf(keyRect(q, k), k); return q.id === "Backspace" ? f.w >= 24 : mw(legOf(q, names), px) <= f.w - (lit[q.id] ? 0 : 4); };
  const F = KB_KEYS.filter((q) => q.f), fAll = F.every(fits);
  for (const q of KB_KEYS) if (q.leg && (q.f ? fAll : fits(q))) out[q.id] = true;
  return out;
}
/** The board's reach past its 18.5 x 6.5 k box: the deck margin 0.38 k and its drop. */
export const kbBox = (k) => ({ x0: -0.38 * k - 2, y0: -0.38 * k - 2, x1: KB_W * k + 0.38 * k + 2, y1: KB_H * k + 0.38 * k + 0.3 * k + 2 });
function arrowGlyph(c, id, cx, cy, s, col) {
  const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[id], [dx, dy] = d;
  c.fillStyle = col; c.beginPath(); c.moveTo(cx + dx * s, cy + dy * s); c.lineTo(cx - dx * s * 0.7 + dy * s, cy - dy * s * 0.7 + dx * s); c.lineTo(cx - dx * s * 0.7 - dy * s, cy - dy * s * 0.7 - dx * s); c.closePath(); c.fill();
}
function paintKeys(c, k, t, lit, prints, px, names) {
  const dk = 0.38 * k, W = KB_W * k + 2 * dk, H = KB_H * k + 2 * dk;
  rrect(c, -dk, -dk + 0.3 * k, W, H, 0.32 * k); alpha(c, 0.55, () => { c.fillStyle = BK; c.fill(); }); // the deck's drop: a hard offset fill, never a soft shadow
  rrect(c, -dk, -dk, W, H, 0.32 * k); c.fillStyle = lin(c, -dk, H - dk, [[0, mix(t.band, WH, 0.2)], [0.3, t.band], [1, mix(t.band, BK, 0.3)]], t.band); c.fill();
  c.save(); if (typeof c.clip === "function") { c.clip(); c.fillStyle = mix(t.key, BK, 0.4); c.fillRect(-dk, H - dk - 0.18 * k, W, 0.18 * k); c.fillStyle = "rgba(255,255,255,0.16)"; c.fillRect(-dk, -dk, W, 2); } c.restore();
  rrect(c, -dk, -dk, W, H, 0.32 * k); c.strokeStyle = OL; c.lineWidth = 2.5; c.stroke();
  for (const q of KB_KEYS) {
    const r = keyRect(q, k), f = faceOf(r, k), on = !!lit[q.id];
    alpha(c, 0.6, () => { rrect(c, r.x, r.y + 1, r.w, r.h, 0.16 * k); c.fillStyle = BK; c.fill(); });
    rrect(c, r.x, r.y, r.w, r.h, 0.16 * k); c.fillStyle = on ? lin(c, r.y, r.y + r.h, [[0, t.lit2], [1, t.lip]], t.lit2) : lin(c, r.y, r.y + r.h, [[0, mix(t.key, BK, 0.3)], [1, mix(t.key, BK, 0.65)]], t.key); c.fill();
    c.strokeStyle = OL; c.lineWidth = 1.5; c.stroke();
    rrect(c, f.x, f.y, f.w, f.h, 0.11 * k); c.fillStyle = on ? lin(c, f.y, f.y + f.h, [[0, mix(t.lit, WH, 0.3)], [0.6, t.lit]], t.lit) : lin(c, f.y, f.y + f.h, [[0, mix(t.key, WH, 0.12)], [0.3, t.key], [1, mix(t.key, BK, 0.15)]], t.key); c.fill();
    c.strokeStyle = on ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.35)"; c.lineWidth = 1; c.stroke();
    const ink = on ? CONST.dk : CONST.off, cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    if (!q.leg) arrowGlyph(c, q.id, cx, cy, Math.min(f.w, f.h) * 0.28, ink);
    else if (prints[q.id] && q.id === "Backspace") { c.strokeStyle = ink; c.lineWidth = 2.2; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath(); c.moveTo(cx + 10, cy); c.lineTo(cx - 7, cy); c.moveTo(cx - 3, cy - 4.5); c.lineTo(cx - 8, cy); c.lineTo(cx - 3, cy + 4.5); c.stroke(); c.lineCap = "butt"; }
    else if (prints[q.id]) { c.fillStyle = ink; c.font = sans(px, "700"); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(legOf(q, names), cx, cy + 0.5); }
  }
}
/** The keyboard at pitch k, its 18.5 x 6.5 k box's top-left at x y. o: {tok, lit:{code:true}, ring:code, prints:{code:true}, px, names}: the static
    board is one kit/cache.js layer keyed by world, k, dpr, the lit set, the printed set and the legends names change; the focus ring draws live,
    3 px cream at offset 3. */
export function drawKeys(c, x, y, k, o) {
  const q = o || {}, t = q.tok, lit = q.lit || {}, prints = q.prints || {}, px = q.px || 0, names = q.names, B = kbBox(k), ns = legSig(names);
  if (canMake() && typeof c.drawImage === "function") {
    const dpr = devScale(c), sig = Object.keys(lit).filter((i) => lit[i]).sort().join(",") + "|" + Object.keys(prints).length + "|" + px + (ns ? "|" + ns : ""), w = Math.ceil((B.x1 - B.x0) * dpr), h = Math.ceil((B.y1 - B.y0) * dpr);
    const cv = layer({ layer: "keys", biome: t.name, level: sig, W: Math.round(k * 100) / 100, H: 0, dpr, look: "2d", textScale: 1 }, w, h, (g) => { g.scale(dpr, dpr); g.translate(-B.x0, -B.y0); paintKeys(g, k, t, lit, prints, px, names); });
    c.drawImage(cv, x + B.x0, y + B.y0, w / dpr, h / dpr);
  } else { c.save(); c.translate(x, y); paintKeys(c, k, t, lit, prints, px, names); c.restore(); }
  const r = q.ring && KB_AT[q.ring] && keyRect(KB_AT[q.ring], k);
  if (r) {
    alpha(c, 0.7, () => { rrect(c, x + r.x - 4.5, y + r.y - 4.5, r.w + 9, r.h + 9, 0.16 * k + 4.5); c.strokeStyle = OL; c.lineWidth = 5; c.stroke(); });
    rrect(c, x + r.x - 4.5, y + r.y - 4.5, r.w + 9, r.h + 9, 0.16 * k + 4.5); c.strokeStyle = CONST.ink; c.lineWidth = 3; c.stroke();
  }
}
/* A rounded rect with square bottom corners, for the trigger glyph. */
function rrTop(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x, y + h); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
  c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h); c.closePath();
}
/** A position glyph, box h tall, top-left at x,y-h/2; returns its width. Always shown beside a word. */
export function glyph(c, kind, x, y, h, v, col, offCol) {
  const k = h / 16, on = col || TEXT, off = offCol || MUTED;
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
