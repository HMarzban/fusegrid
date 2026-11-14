// CONTROLS drawings (UI upgrade v202 Task 6.1 / 6.2): the round 7 controller, its leaders and states, against the appendix (section 9).
import { readFileSync } from "node:fs";
import { layout } from "../src/render/menudraw.js";
import { PADG, HALF, PART_AT, drawPad, padBox, kbBox, ringR, KB_KEYS, KB_AT, KB_W, KB_H, keyRect, drawKeys, kbPrints, kbLegend } from "../src/render/padart.js";
import { DEF_PAD, DEF_KEY, BTN, rowsOf, padStates, padRing, padCallouts, padPlan, padFit, padCross, PAD_FULL, PAD_CAP, PAD_KEEP, PAD_TALL, KB_CAP, KB_FULL, kbPlan, keyStates, keyRing, keyCallouts, kbFit, kbCross } from "../src/render/controlsgeo.js";
import { controlsGeom, controlsHit, drawControlsPage, _dbg as pageDbg } from "../src/render/pages/controls.js";
/* Task 6.3: the page is pages/controls.js on the world kit; these adapters keep the drawing checks' calls (a menudraw layout, touch, CSS scale) */
const frameOf = (L, touch, scale) => ({ W: L.W, H: L.H, touch: !!touch, shell: false, css: scale });
const geoFor = (L, touch, narrow, scale, v) => controlsGeom(frameOf(L, touch, scale), v || {});
const geomOf = (i, G) => G.rows[G.order[i]];
const hitPage = (v, x, y, G) => controlsHit(v, x, y, G);
const drawControls = (c, L, v, u = {}) => drawControlsPage(c, frameOf(L, u.touch, u.scale), v, { level: u.level, tap: false });
import { worldTokens, CONST } from "../src/render/kit/tokens.js";
import { setTextScale } from "../src/render/kit/type.js";
import * as cache from "../src/render/kit/cache.js";
import * as model from "../src/app/controls.js";
import { createControlsPage } from "../src/app/controlspage.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const ROOT = new URL("..", import.meta.url);
/* A recorder: every call by name, every colour set, gradients as objects that keep their stops; uniform scale tracked for text sizes. */
function rec(o = {}) {
  const log = [], colours = [], texts = [], rects = [], stack = [];
  let sx = 1, tx = 0, ty = 0;
  const grad = (kind) => () => { const g = { kind, stops: [], addColorStop(at, col) { g.stops.push([at, col]); colours.push(col); }, toString() { return "grad"; } }; log.push(kind); return g; };
  const set = (k) => ({ get() { return this["_" + k]; }, set(v) { this["_" + k] = v; if (typeof v === "string") colours.push(v); } });
  const c = {
    font: "10px sans-serif", globalAlpha: 1, textAlign: "left", textBaseline: "alphabetic", lineWidth: 1, lineCap: "butt", lineJoin: "miter",
    save() { stack.push([sx, tx, ty]); log.push("save"); }, restore() { [sx, tx, ty] = stack.pop(); log.push("restore"); },
    translate(x, y) { tx += sx * x; ty += sx * y; log.push("t"); }, scale(k) { sx *= k; log.push("s"); }, rotate() { log.push("r"); },
    beginPath() { log.push("bp"); }, closePath() { log.push("cp"); }, clip() { log.push("clip"); }, rect() { log.push("rc"); }, strokeText() { log.push("xs"); },
    moveTo(x, y) { log.push("m" + (tx + sx * x).toFixed(1) + "," + (ty + sx * y).toFixed(1)); }, lineTo(x, y) { log.push("l" + (tx + sx * x).toFixed(1) + "," + (ty + sx * y).toFixed(1)); },
    arc(x, y, r) { log.push("a" + (tx + sx * x).toFixed(1) + "," + (ty + sx * y).toFixed(1) + "," + (sx * r).toFixed(2)); }, arcTo() { log.push("at"); }, ellipse() { log.push("el"); },
    bezierCurveTo() { log.push("bz"); }, quadraticCurveTo() { log.push("q"); },
    fill() { log.push("f" + (typeof c.fillStyle === "string" ? c.fillStyle : "grad")); }, stroke() { log.push("k" + (typeof c.strokeStyle === "string" ? c.strokeStyle : "grad")); },
    fillRect(x, y, w, h) { log.push("fr"); rects.push({ x: tx + sx * x, y: ty + sx * y, w: sx * w, h: sx * h, fill: c.fillStyle }); }, strokeRect() { log.push("sr"); }, drawImage() { log.push("img"); },
    measureText(s) { log.push("mt"); return { width: String(s).length * (+/([\d.]+)px/.exec(c.font)[1]) * 0.6 }; },
    fillText(s, x, y) { texts.push({ s: String(s), x: tx + sx * x, y: ty + sx * y, px: +/([\d.]+)px/.exec(c.font)[1] * sx, fill: c.fillStyle }); log.push("x" + s); },
  };
  Object.defineProperty(c, "fillStyle", set("fill")); Object.defineProperty(c, "strokeStyle", set("stroke"));
  c.fillStyle = "#000"; c.strokeStyle = "#000";
  if (o.grad) { c.createLinearGradient = grad("lg"); c.createRadialGradient = grad("rg"); }
  if (o.getTransform) c.getTransform = () => ({ a: o.getTransform, b: 0 });
  if (o.img === false) delete c.drawImage;
  return { c, log, colours, texts, rects };
}
const PR = { state: "ready", name: "CONTROLLER 1", rumble: true };
const keyV = (o) => ({ tab: "key", device: "key", row: 1, pad: { state: "none" }, key: DEF_KEY, binds: DEF_PAD, stick: "L", dead: 25, vib: 2, stickVal: [0, 0], reads: "", drift: 0, armed: false, swap: null, status: "", capture: null, echo: null, ...o });
const padV = (o) => keyV({ tab: "pad", device: "pad", pad: PR, ...o });
const CAP = { action: "THROW", prompt: "PRESS A BUTTON", sub: "NOW WEST", foot: "START CANCELS · WEST KEEPS IT" };
const DESK = layout(1366, 768), L600 = layout(600, 520);
const BOXES = [["desk 1366x768", DESK, false, false, undefined], ["desk 1024x700", layout(1024, 700), false, false, undefined], ["600x520 / PAUSE", L600, false, false, undefined], ["608x352 guard", layout(608, 352), false, false, undefined], ["touch #c 0.63", L600, true, false, 0.63], ["phone 436x946", layout(436, 946), true, true, 0.9]];
const tok = worldTokens(1);
const BINDABLE = Object.keys(BTN).filter((id) => model.refuseBtn(id) === "");

// ---- the body (appendix 9.1) ----
{
  check("the body is 1 : 0.648 across its grips", Math.max(...HALF.slice(1).flatMap((s) => s.map((p) => p[1]))) === 0.648 && Math.max(...HALF.slice(1).flatMap((s) => s.map((p) => p[0]))) === 1);
  const W = 300, r = rec();
  drawPad(r.c, 0, 0, W, { tok, lit: padStates(padV()) });
  const faces = ["N", "E", "S", "W"].map((id) => { const [x, y] = PART_AT[id], hit = r.log.filter((q) => q.startsWith("a" + (x * W).toFixed(1) + "," + (y * W).toFixed(1) + ",")).map((q) => +q.split(",")[2]); return Math.min(...hit) * 2 / W; });
  check("each face button is 0.10 ± 0.01 of the body width", faces.every((d) => Math.abs(d - 0.1) <= 0.01) && Math.abs(PADG.br * 2 - 0.104) < 1e-9, faces.map((d) => d.toFixed(3)).join());
  const wells = ["N", "E", "S", "W"].map((id) => PART_AT[id]);
  const gap = Math.min(...wells.flatMap((a, i) => wells.slice(i + 1).map((b) => Math.hypot(a[0] - b[0], a[1] - b[1]) - 2 * (PADG.br + 0.009))));
  check("neighbouring face wells keep a gap", gap > 0, (gap * W).toFixed(2));
  const at = (id) => PART_AT[id];
  check("layout: left stick upper-left, D-PAD lower-left, face diamond upper-right, right stick lower-right, the pills in the centre", at("LS")[0] < 0.5 && at("LS")[1] < at("dpad")[1] && at("dpad")[0] < 0.5 && at("RS")[0] > 0.5 && at("RS")[1] > at("E")[1] && at("SELECT")[0] < 0.5 && at("START")[0] > 0.5 && Math.abs(at("SELECT")[0] + at("START")[0] - 1) < 1e-9);
  check("no filter, no blur, no pixel read in the drawings' source", !/\.filter\s*=|shadowBlur|shadowColor|getImageData|toDataURL|setLineDash/.test(readFileSync(new URL("src/render/padart.js", ROOT), "utf8") + readFileSync(new URL("src/render/pages/controls.js", ROOT), "utf8")));
}

// ---- states: bound in the world's brick, unbound quiet, the ring, no controller ----
const fillAt = (r, id, W, x0 = 0, y0 = 0) => { const k = "a" + (x0 + PART_AT[id][0] * W).toFixed(1) + "," + (y0 + PART_AT[id][1] * W).toFixed(1) + "," + (PADG.br * W).toFixed(2), i = r.log.lastIndexOf(k); return i < 0 ? null : r.log.slice(i).find((q) => q[0] === "f"); };
{
  const W = 300;
  for (const lv of [1, 2, 8]) {
    const t = worldTokens(lv), r = rec();
    drawPad(r.c, 0, 0, W, { tok: t, lit: padStates(padV()) });
    check("world " + lv + ": a bound face (SOUTH) wears the brick, an unbound one (NORTH) the quiet key", fillAt(r, "S", W) === "f" + t.lit && fillAt(r, "N", W) === "f" + t.key, [fillAt(r, "S", W), fillAt(r, "N", W), t.lit, t.key].join());
    const g = rec({ grad: true });
    drawPad(g.c, 0, 0, W, { tok: t, lit: padStates(padV()) });
    check("world " + lv + ": with gradients the bound face's stops come from lit / lit2, top-lit", g.colours.includes(t.lit) && g.colours.includes(t.lit2) && g.log.includes("lg") && g.log.includes("rg"));
  }
  const lit = padStates(padV());
  check("the live frame lights D-PAD, L-STICK, SOUTH, WEST, EAST, SELECT, START and nothing else", Object.keys(lit).sort().join() === ["dpad", "LS", "S", "W", "E", "SELECT", "START"].sort().join(), Object.keys(lit).join());
  check("a right stick and a rebind follow the binds", padStates(padV({ stick: "R", binds: { ...DEF_PAD, BOMB: "SHL" } })).RS && padStates(padV({ stick: "R", binds: { ...DEF_PAD, BOMB: "SHL" } })).SHL && !padStates(padV({ stick: "R" })).LS);
  check("the ring follows the focused row: BOMB SOUTH, THROW WEST, MOVE the live stick, PAUSE its second button, none on SENSITIVITY / VIBRATION / RESET", padRing(padV(), "BOMB") === "S" && padRing(padV(), "THROW") === "W" && padRing(padV({ stick: "R" }), "MOVE") === "RS" && padRing(padV(), "PAUSE") === "SELECT" && [5, 6, 7].every((i) => padRing(padV(), rowsOf(padV())[i].id) === null));
  const r = rec();
  drawPad(r.c, 0, 0, W, { tok, lit, ring: "S" });
  const rk = "a" + (PART_AT.S[0] * W).toFixed(1) + "," + (PART_AT.S[1] * W).toFixed(1) + "," + ringR("S", W).toFixed(2), i = r.log.lastIndexOf(rk);
  check("the ring: 3 px cream at the button's radius + 4.5, over a dark underlay", i > 0 && r.log.slice(i).find((q) => q[0] === "k") === "k" + CONST.ink && r.log.includes("k" + CONST.ol) && Math.abs(ringR("S", W) - (PADG.br * W + 4.5)) < 1e-9);
  const off = rec();
  drawPad(off.c, 0, 0, W, { tok, lit, lock: true, ring: "S" });
  check("no controller: every input quiet, the body in the rule tone, no ring", ["N", "E", "S", "W"].every((id) => fillAt(off, id, W) === "f" + tok.key) && off.log.includes("f" + tok.rule) && !off.log.includes("f" + tok.band) && !off.log.includes("k" + CONST.ink));
}

// ---- no cord or spark colour, anywhere on the page ----
{
  const BAD = ["#ff8a3c", "#ff9d5a", "#b8582a"];
  const views = [padV(), padV({ row: 0 }), padV({ row: 4 }), padV({ row: 6 }), padV({ capture: CAP, row: 2 }), keyV(), keyV({ capture: { ...CAP, prompt: "PRESS A KEY", sub: "NOW E", foot: "ESC CANCELS" }, row: 2 }), keyV({ tab: "pad" }), padV({ pad: { state: "lost" } }), padV({ echo: "S" })];
  const hits = [];
  for (const [nm, Lx, touch, narrow, scale] of BOXES) for (const v of views) { const r = rec({ grad: true }); drawControls(r.c, Lx, v, { touch, narrow, scale, level: 1 }); for (const col of r.colours) if (BAD.includes(String(col).toLowerCase())) hits.push(nm + ":" + col); }
  check("no cord or spark colour in any state, any box", !hits.length, hits.slice(0, 4).join());
  const src = readFileSync(new URL("src/render/padart.js", ROOT), "utf8") + readFileSync(new URL("src/render/pages/controls.js", ROOT), "utf8");
  check("no spark painter and no fuse path left in the source", !/function spark|FUSE_PATH|spark\(/.test(src));
}

// ---- leaders: the crossing gate (round 7 window.GATE().cross, ported independently of controlsgeo's own check) ----
const X = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])), on = (p, q, r) => Math.min(p[0], q[0]) - 1e-6 <= r[0] && r[0] <= Math.max(p[0], q[0]) + 1e-6 && Math.min(p[1], q[1]) - 1e-6 <= r[1] && r[1] <= Math.max(p[1], q[1]) + 1e-6;
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return (o1 !== o2 && o3 !== o4 && o1 && o2 && o3 && o4) || (!o1 && on(a, b, c)) || (!o2 && on(a, b, d)) || (!o3 && on(c, d, a)) || (!o4 && on(c, d, b));
};
const dist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
/* a bound shoulder's or trigger's shape, sampled here from the appendix numbers (not controlsgeo's): the bumper centreline's two cubics
   (stroke 0.072 W), the trigger's long axis (0.2 W x 0.1 W at 0.24 / 0.76, 0.02 W, rotated -9 / +9 degrees) */
const BUMP_CP = [[0.62, 0.034], [0.7, 0.036], [0.76, 0.05], [0.82, 0.065], [0.905, 0.09], [0.952, 0.135], [0.966, 0.19]];
const cub = (p, t) => [0, 1].map((k) => (1 - t) ** 3 * p[0][k] + 3 * (1 - t) ** 2 * t * p[1][k] + 3 * (1 - t) * t * t * p[2][k] + t ** 3 * p[3][k]);
function boundShapes(lit, W) {
  const out = [];
  for (const id of ["SHL", "SHR"]) if (lit[id]) for (const seg of [BUMP_CP.slice(0, 4), BUMP_CP.slice(3, 7)]) for (let i = 0; i <= 8; i++) { const [x, y] = cub(seg, i / 8); out.push({ id, x: (id === "SHL" ? 1 - x : x) * W, y: y * W, r: 0.036 * W }); }
  for (const id of ["TRL", "TRR"]) if (lit[id]) { const m = id === "TRL", cx = m ? 0.24 : 0.76, a = ((m ? -9 : 9) * Math.PI) / 180; for (const d of [-0.05, 0, 0.05]) out.push({ id, x: (cx + d * Math.cos(a)) * W, y: (0.02 + d * Math.sin(a)) * W, r: 0.05 * W }); }
  return out;
}
const segBox = (a, b, r) => Math.max(a[0], b[0]) > r.x0 && Math.min(a[0], b[0]) < r.x1 && Math.max(a[1], b[1]) > r.y0 && Math.min(a[1], b[1]) < r.y1;
function crossings(plan, lit = {}) {
  const W = plan.W, out = [], segs = (L) => L.pts.slice(1).map((p, i) => [L.pts[i], p]);
  const fr = (PADG.br + 0.009) * W, circles = [["LS", PADG.LS[2] * W], ["dpad", PADG.DPAD[2] * W], ["RS", PADG.RS[2] * W], ...["N", "E", "S", "W"].map((k) => [k, fr]), ["SELECT", 0.03 * W], ["START", 0.03 * W]].map(([id, r]) => ({ id, x: PART_AT[id][0] * W, y: PART_AT[id][1] * W, r })).concat(boundShapes(lit, W));
  const own = (g) => (g === "MOVE" ? ["LS", "dpad", "RS"] : [g]);
  const boxes = plan.labels.flatMap((l) => l.lines.map((q) => { const w = q.w + (q.tag ? q.tag + 6 : 0); return { grp: l.grp, x0: l.side === "l" ? l.x - w : l.x, x1: l.side === "l" ? l.x : l.x + w, y0: q.y - 0.6 * q.px, y1: q.y + 0.6 * q.px }; }));
  for (const L of plan.lines) for (const [a, b] of segs(L)) for (const r of boxes) if (r.grp !== L.grp && segBox(a, b, r)) out.push(L.grp + " through the label of " + r.grp);
  for (let i = 0; i < plan.lines.length; i++) for (let j = i + 1; j < plan.lines.length; j++) {
    if (plan.lines[i].grp === plan.lines[j].grp) continue;
    for (const [a, b] of segs(plan.lines[i])) for (const [c, d] of segs(plan.lines[j])) if (X(a, b, c, d)) out.push(plan.lines[i].grp + " x " + plan.lines[j].grp);
  }
  for (const L of plan.lines) for (const [a, b] of segs(L)) for (const c of circles) if (!own(L.grp).includes(c.id) && dist([c.x, c.y], a, b) < c.r + 2) out.push(L.grp + " near " + c.id);
  return out;
}
const M = (ts) => ({ pri: 21 * ts, sec: 16 * ts, wOf: (s, px) => s.length * px * 0.6 }); // the callouts at the kit's row type (Task 6.3: the mock's callouts read at the rows' size, never under the text floors)
{
  const G = geoFor(DESK, false, false), A = { w: G.art.w, h: G.art.h };
  for (const ts of [1, 1.25]) {
    const F = padFit(A.w, A.h, padCallouts(padV()), M(ts), padStates(padV()));
    check("desk 1366x768 at text " + ts + ": the default binds draw every callout (W " + Math.round(F.W) + ")", !!F.plan && F.W >= PAD_FULL && F.plan.labels.length === 6 && !crossings(F.plan, padStates(padV())).length, F.plan && crossings(F.plan).join());
    const sw = padV({ binds: { ...DEF_PAD, BOMB: "E", REMOTE: "S" } }), F2 = padFit(A.w, A.h, padCallouts(sw), M(ts), padStates(sw));
    check("after a rebind (BOMB EAST, REMOTE SOUTH) the callouts follow, no crossing: text " + ts, !!F2.plan && F2.plan.labels.some((l) => l.grp === "E" && l.lines[0].s === "BOMB") && !crossings(F2.plan, padStates(sw)).length);
    const far = padV({ binds: { BOMB: "SELECT", THROW: "W", REMOTE: "E", PAUSE: "S" }, stick: "R" }), F3 = padFit(A.w, A.h, padCallouts(far), M(ts), padStates(far));
    check("an action bound on the far side (BOMB SELECT) and the right stick: drawn, no crossing: text " + ts, !!F3.plan && F3.plan.labels.some((l) => l.grp === "SELECT" && l.side === "l" && l.lines[0].s === "BOMB") && !crossings(F3.plan, padStates(far)).length, F3.plan && crossings(F3.plan, padStates(far)).join());
  }
  // every assignment of the four actions over every button the model lets you bind, both sticks, both text scales, three desk boxes
  const ART = [DESK, layout(1280, 720)].map((Lx) => { const g = geoFor(Lx, false, false); return [g.art.w, g.art.h]; });
  let n = 0, full = 0, bad = [];
  for (const ts of [1, 1.25]) for (const [aw, ah] of ART) for (const stick of ["L", "R"]) for (const B of BINDABLE) for (const T of BINDABLE) for (const R of BINDABLE) for (const P of BINDABLE) {
    if (new Set([B, T, R, P]).size < 4) continue;
    const v = padV({ binds: { BOMB: B, THROW: T, REMOTE: R, PAUSE: P }, stick }), F = padFit(aw, ah, padCallouts(v), M(ts), padStates(v));
    n++;
    if (!F.plan) continue;
    full++;
    const x = crossings(F.plan, padStates(v));
    if (x.length) bad.push([B, T, R, P, stick, ts, aw].join("/") + ": " + x[0]);
  }
  check("no drawn leader crosses another leader or a foreign button, in all " + n + " bindings (" + full + " with callouts, the rest none)", !bad.length && full > n * 0.5, bad.slice(0, 3).join(" | "));
  const p = padPlan(300, padCallouts(padV()), M(1));
  check("the leaders are orthogonal: every segment level or plumb", p.lines.every((L) => L.pts.slice(1).every((q, i) => q[0] === L.pts[i][0] || q[1] === L.pts[i][1])));
  check("SOUTH meets EAST, so its label drops through a knee in the gutter, inside the next label's gutter column", (() => { const s = p.lines.find((l) => l.grp === "S"); return s.pts.length === 4 && s.pts[1][0] > 300 && s.pts[3][1] > s.pts[0][1]; })());
  check("controlsgeo's own gate agrees with the port on the default plan", padCross(p, padStates(padV())).length === 0 && crossings(p, padStates(padV())).length === 0);
  for (const [nm, Lx, touch, narrow, scale] of [...BOXES, ["desk 1280x720", layout(1280, 720), false, false, undefined]]) {
    const r = rec(); drawControls(r.c, Lx, padV(), { touch, narrow, scale, level: 1 });
    const plan = pageDbg.last.live.plan, labels = plan ? plan.labels.flatMap((l) => l.lines.map((q) => q.s)) : [], drawn = new Set(r.texts.map((t) => t.s));
    const want = nm === "desk 1366x768" || nm === "desk 1280x720" ? ["BOMB", "SOUTH", "THROW", "WEST", "REMOTE", "EAST", "MOVE", "L-STICK", "D-PAD", "START", "SELECT"] : [];
    check("callouts where they fit (the desk at 1366x768 and 1280x720; a 1024 wide pane and every column draw none, the rows name every button): " + nm, want.every((w) => labels.includes(w) && drawn.has(w)) && (want.length || !plan), labels.join());
  }
}

// ---- capture: no countdown, its cancel copy (Task 6.3: on the desk the pane listens, the -capture frame) ----
{
  const v = padV({ capture: CAP, row: 2 }), a = rec(), b = rec();
  drawControls(a.c, DESK, v, { level: 1, t: 0 }); drawControls(b.c, DESK, v, { level: 1, t: 37 });
  const A0 = pageDbg.last.live.art;
  check("capture is static: two frames apart draw the same", a.log.join() === b.log.join());
  check("capture says how to cancel, label first and keycap last, and nothing counts down", ["CANCELS", "START", "KEEPS IT", "WEST"].every((w) => a.texts.some((t) => t.s === w)) && a.texts.some((t) => t.s === "PRESS A BUTTON FOR THROW") && !a.texts.some((t) => /^\d+(\.\d+)?s?$/.test(t.s) || /SECOND|TIME LEFT/.test(t.s)));
  const W0 = A0.W, px = A0.ox, py = A0.oy, ringK = "a" + (px + PART_AT.W[0] * W0).toFixed(1) + "," + (py + PART_AT.W[1] * W0).toFixed(1) + "," + ringR("W", W0).toFixed(2);
  check("capture on the controller: every input quiet but the action's own button (WEST), lit and ringed", fillAt(a, "W", W0, px, py) === "f" + tok.lit && ["N", "E", "S"].every((id) => fillAt(a, id, W0, px, py) === "f" + tok.key) && a.log.includes(ringK) && W0 > 100, [fillAt(a, "W", W0, px, py), W0.toFixed(1)].join());
}

// ---- no controller ----
{
  for (const [nm, Lx, touch, narrow, scale] of BOXES) {
    const seen = [], hits = [5, 6, 7].map((i) => { const v = keyV({ tab: "pad", row: i }), G = geoFor(Lx, touch, narrow, scale, v), r = rec(), g = geomOf(i, G); drawControls(r.c, Lx, v, { touch, narrow, scale, level: 1 }); seen.push(...r.texts.map((t) => t.s)); return hitPage(v, g.x + g.w / 2, g.y + g.h / 2, G).row; }); // a paged column shows each on its own page
    check("no controller keeps SENSITIVITY, VIBRATION, RESET drawn and tappable: " + nm, hits.join() === "5,6,7" && ["SENSITIVITY", "VIBRATION", "RESET CONTROLLER"].every((s) => seen.includes(s)), hits.join());
  }
  const q = { c: model.DEF_CONTROLS, said: [] }, p = createControlsPage({ get: () => q.c, set: (c) => { q.c = c; }, padView: () => ({ state: "none" }), say: (s) => q.said.push(s) });
  p.open("pad");
  const seen = [];
  for (let i = 0; i < 8; i++) { p.walk(1, 1); seen.push(p.view(0).row); }
  check("no controller: the walk still reaches SENSITIVITY, VIBRATION and RESET", [5, 6, 7].every((i) => seen.includes(i)), seen.join());
  const r = rec(); drawControls(r.c, DESK, keyV({ tab: "pad" }), { level: 1 });
  check("no controller: the NO CONTROLLER plaque and the line under it", r.texts.some((t) => t.s === "NO CONTROLLER") && r.texts.some((t) => t.s === "Connect one and press a button."));
}

// ---- the binding rule the drawing follows (owner R3): which buttons the model lets a player bind ----
check("the drawing routes a leader for every button the model accepts", BINDABLE.every((id) => PART_AT[id]), BINDABLE.join());

// ---- a steady frame blits the cached drawing ----
/* the page chrome's own measureText per steady frame (CONSOLE PANEL rows, kicker, foot, rule), measured on base c1f9bd9 with one context drawn twice:
   34 (controller) / 26 (keyboard). The drawings measure only when their fit changes and the rule lines are memoised: a steady frame measures exactly
   these, the page chrome's own (pinned; a change either way is a decision). */
const MT_BASE = { controller: 34, keyboard: 26 }, MT_NOW = { controller: 32, keyboard: 25 };
{
  const made = [];
  globalThis.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; made.push(this); } getContext() { return rec({ grad: true }).c; } };
  try {
    cache.release();
    for (const [tab, v] of [["controller", padV()], ["keyboard", keyV()]]) {
      const r0 = rec({ grad: true, getTransform: 2 }); // one context, as the page's own canvas: a frame, then a steady one
      drawControls(r0.c, DESK, v, { level: 1 });
      const m0 = cache._dbg.misses, n0 = r0.log.length;
      drawControls(r0.c, DESK, v, { level: 1 });
      const log = r0.log.slice(n0), mt = log.filter((q) => q === "mt").length;
      console.log("    (" + tab + " steady frame: " + log.length + " calls, " + mt + " measureText)");
      check("a steady CONTROLS frame, " + tab + " tab: 0 cache misses, every part at rest a blit (room, base, column, drawing, keycaps), <= 400 canvas calls", cache._dbg.misses === m0 && log.filter((q) => q === "img").length >= 4 && log.length <= 400, log.length);
      check("a steady frame measures nothing (" + tab + "): 0 measureText (the world kit page plans once; base c1f9bd9's CONSOLE PANEL page measured " + MT_BASE[tab] + ")", mt === 0, mt);
    }
    const w = rec({ grad: true, getTransform: 2 }); drawControls(w.c, DESK, padV(), { level: 1 }); // back on the controller tab (a tab switch may make its layers again), then the row move
    const m1 = cache._dbg.misses; drawControls(w.c, DESK, padV({ row: 2 }), { level: 1 });
    check("a row move re-blits the same layer: the ring is live, no miss", cache._dbg.misses === m1);
  } finally { delete globalThis.OffscreenCanvas; cache.release(); setTextScale(1); }
}

// ---- THE KEYBOARD (Task 6.2, appendix 9.3) ----
{
  const at = (id) => KB_AT[id];
  const W = { Tab: 1.5, CapsLock: 1.75, ShiftLeft: 2.25, ShiftRight: 2.75, Enter: 2.25, Backspace: 2, Space: 6.25, Escape: 1.5, ControlLeft: 1.75, AltLeft: 2, AltRight: 2, Fn: 1.25, ControlRight: 1.75, Backslash: 1.5 };
  check("key widths per the appendix: TAB 1.5, CAPS 1.75, SHIFT 2.25 / 2.75, ENTER 2.25, BACKSPACE 2, SPACE 6.25, ESC 1.5", Object.entries(W).every(([id, w]) => at(id) && at(id).w === w), Object.entries(W).filter(([id, w]) => !at(id) || at(id).w !== w).map(([id]) => id).join());
  const rows = {};
  for (const q of KB_KEYS) if (!q.id.startsWith("Arrow")) rows[q.y] = Math.max(rows[q.y] || 0, q.x + q.w);
  check("the F-row ends at 15 and every main row spans 15 units; the board is 18.5 x 6.5", Object.values(rows).every((v) => v === 15) && KB_W === 18.5 && KB_H === 6.5, JSON.stringify(rows));
  check("the F-row is ESC, a 0.5 gap, then 4-4-4 groups with 0.5 gaps", at("F1").x === 2 && at("F4").x === 5 && at("F5").x === 6.5 && at("F8").x === 9.5 && at("F9").x === 11 && at("F12").x === 14);
  check("the stagger: Q from 1.5, A from 1.75, Z from 2.25", at("KeyQ").x === 1.5 && at("KeyA").x === 1.75 && at("KeyZ").x === 2.25 && at("Space").x === 3.75);
  const ar = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].map(at);
  check("the arrows: an inverted T after a 0.5 u gap", ar.map((q) => q.x + "," + q.y).join(" ") === "16.5,4.5 15.5,5.5 16.5,5.5 17.5,5.5" && at("ArrowLeft").x - (at("ControlRight").x + at("ControlRight").w) === 0.5 && ar.every((q) => q.w === 1));
  const g = (k) => Math.max(2, 0.1 * k), r = keyRect(at("Space"), 30);
  check("a key's rect: (x k + g/2, y k + g/2), (w k - g) x (k - g)", r.x === 3.75 * 30 + g(30) / 2 && r.y === 5.5 * 30 + g(30) / 2 && r.w === 6.25 * 30 - g(30) && r.h === 30 - g(30));

  const lit = keyStates(keyV());
  check("bound keys lit: SPACE, E, Q, P, W A S D, the fixed ESC and arrows; J, X and ENTER never", ["Space", "KeyE", "KeyQ", "KeyP", "KeyW", "KeyA", "KeyS", "KeyD", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].every((q) => lit[q] === "lit") && !lit.KeyJ && !lit.KeyX && !lit.Enter && !lit.KeyK);
  check("a rebind lights the new key, not the old", keyStates(keyV({ key: { ...DEF_KEY, THROW: "KeyZ" } })).KeyZ && !keyStates(keyV({ key: { ...DEF_KEY, THROW: "KeyZ" } })).KeyE);
  check("the ring follows the row: SPACE on BOMB, W on MOVE, ENTER on CONFIRM, ESC on BACK, none on RESET", keyRing(keyV(), "BOMB") === "Space" && keyRing(keyV(), "MOVE") === "KeyW" && keyRing(keyV(), "CONFIRM") === "Enter" && keyRing(keyV(), "BACK") === "Escape" && keyRing(keyV(), "RESET") === null);
  for (const lv of [1, 2, 8]) {
    const t = worldTokens(lv), d = rec();
    drawKeys(d.c, 0, 0, 30, { tok: t, lit, ring: "Space", prints: kbPrints(30, lit, (s, px) => s.length * px * 0.6), px: kbLegend(30) });
    const sp = keyRect(at("Space"), 30), face = "f" + t.lit, off = "f" + t.key;
    check("world " + lv + ": lit keys in the brick, the rest the quiet key, the ring on SPACE", d.log.includes(face) && d.log.includes(off) && d.log.includes("k" + CONST.ink) && d.texts.some((x) => x.s === "SPACE" && x.fill === CONST.dk) && d.texts.some((x) => x.s === "G" && x.fill === CONST.off));
  }
  const C = keyCallouts(keyV());
  check("callouts: BACK ESC FIXED, REMOTE Q, THROW E, PAUSE P, BOMB SPACE, MOVE W A S D, MOVE ARROWS FIXED", C.map((q) => q.act + ":" + q.pos.join("") + (q.tag ? ":FIXED" : "")).join() === "BACK:ESC:FIXED,REMOTE:Q,THROW:E,PAUSE:P,BOMB:SPACE,MOVE:W A S D,MOVE:ARROWS:FIXED", C.map((q) => q.act + ":" + q.pos.join("")).join());
  check("a key off the drawing has no callout and draws no crash", !keyCallouts(keyV({ key: { ...DEF_KEY, THROW: "Numpad7" } })).some((q) => q.act === "THROW"));
  const G = geoFor(DESK, false, false), A = { w: G.art.w, h: G.art.h };
  for (const ts of [1, 1.25]) {
    const F = kbFit(A.w, A.h, C, M(ts));
    check("desk 1366x768 at text " + ts + ": the board draws every callout, prints its legends (k " + F.k + ")", !!F.plan && F.plan.labels.length === 7 && !kbCross(F.plan).length && kbLegend(F.k, ts) >= 10, F.plan && kbCross(F.plan).join());
    const fx = F.plan && F.plan.labels.filter((l) => l.lines.some((x) => x.tag)).map((l) => l.grp).sort().join();
    check("FIXED tags on BACK (ESC) and the arrows, nowhere else: text " + ts, fx === "ArrowDown,Escape", fx);
  }
  let bad = [], drawn = 0, n = 0;
  const codes = ["KeyQ", "KeyE", "KeyP", "KeyZ", "KeyM", "Digit1", "Digit0", "Space", "ShiftLeft", "Slash", "KeyJ", "Tab", "Backquote", "Semicolon", "KeyI"];
  for (const B of codes) for (const T of codes) for (const R of codes) for (const P of codes) {
    if (new Set([B, T, R, P]).size < 4 || [B, T, R, P].some((q) => DEF_KEY.MOVE.includes(q))) continue;
    n++;
    const F = kbFit(A.w, A.h, keyCallouts(keyV({ key: { ...DEF_KEY, BOMB: B, THROW: T, REMOTE: R, PAUSE: P } })), M(1));
    if (!F.plan) continue;
    drawn++;
    const x = kbCross(F.plan);
    if (x.length) bad.push([B, T, R, P].join("/") + ": " + x[0]);
  }
  check("rebinds: no drawn leader crosses another or runs through a key (" + drawn + " of " + n + " drawn with leaders)", !bad.length && drawn > n * 0.5, bad.slice(0, 3).join(" | "));
  /* the rows name every bound key as whole value tokens (a row's values split at " · ", the row's own label left out), in every box, and after a rebind */
  const rowTok = (r, G, i) => { const g = geomOf(i, G), lab = rowsOf(keyV())[i]; return r.texts.filter((t) => Math.abs(t.y - (g.y + g.h / 2)) < 1 && t.x >= g.x && t.x <= g.x + g.w && t.s !== (lab.label || lab.id)).flatMap((t) => t.s.split(" · ")); };
  for (const [nm, Lx, touch, narrow, scale] of [...BOXES, ["phone 393x852", layout(393, 852), true, true, 1]]) for (const [vn, v0, want] of [["defaults", keyV(), [[0, ["W", "A", "S", "D"]], [1, ["SPACE"]], [2, ["E"]], [3, ["Q"]], [4, ["P"]], [5, ["ENTER"]], [6, ["ESC"]]]], ["THROW on Z", keyV({ key: { ...DEF_KEY, THROW: "KeyZ" }, row: 2 }), [[2, ["Z"]], [1, ["SPACE"]]]]]) {
    /* Task 6.3 (the d-05-controls-keys frame): MOVE's set as its four keycaps, PAUSE its rebindable key (ESC always pauses: the row's status line); each row drawn on its own page */
    const v = v0, miss = want.flatMap(([i, w]) => { const vi = { ...v0, row: i }, r = rec(); drawControls(r.c, Lx, vi, { touch, narrow, scale, level: 1 }); const Gx = geoFor(Lx, touch, narrow, scale, vi); return w.filter((x) => !rowTok(r, Gx, i).includes(x)).map((x) => i + ":" + x); });
    check("the rows name every bound key as a whole token (" + vn + "): " + nm, !miss.length && (vn === "defaults" || keyStates(v).KeyZ === "lit"), miss.join());
  }
  const ph = rec(); drawControls(ph.c, layout(436, 946), keyV(), { touch: true, narrow: true, scale: 0.9, level: 1 });
  const pa = pageDbg.last.G.art;
  check("the phone column's board prints only the arrow glyphs (no legend at its pitch)", !!pa && !ph.texts.some((t) => (t.fill === CONST.dk || t.fill === CONST.off) && t.x >= pa.x && t.x <= pa.x + pa.w && t.y >= pa.y && t.y <= pa.y + pa.h));
}

// ---- the fits (fix round 1): the largest clean size the art box holds, centred; compact only when no clean size fits ----
{
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const padClean = (W, it, m, lit, aw, ah) => { const p = padPlan(W, it, m), e = p.ext; return p.ok && e.x1 - e.x0 <= aw && e.y1 - e.y0 <= ah && !padCross(p, lit).length; };
  const kbClean = (k, it, m, aw, ah) => { const p = kbPlan(k, it, m), e = p.ext; return p.ok && e.x1 - e.x0 <= aw && e.y1 - e.y0 <= ah && !kbCross(p).length; };
  const centred = (F, e, aw, ah) => near(F.ox + e.x0, (aw - (e.x1 - e.x0)) / 2) && near(F.oy + e.y0, (ah - (e.y1 - e.y0)) / 2);
  const bad = [];
  for (const [nm, Lx, touch, narrow, scale] of [["desk 1366x768", DESK, false, false, undefined], ["desk 1024x700", layout(1024, 700), false, false, undefined], ...BOXES]) for (const ts of [1, 1.25]) {
    const G = geoFor(Lx, touch, narrow, scale);
    if (!G.pane) continue;
    const aw = G.pane.w - 12, ah = G.art.h, m = M(ts);
    for (const v of [padV(), padV({ binds: { ...DEF_PAD, BOMB: "E", REMOTE: "S" } }), padV({ binds: { BOMB: "TRR", THROW: "W", REMOTE: "SHR", PAUSE: "N" } })]) {
      const it = padCallouts(v), lit = padStates(v), F = padFit(aw, ah, it, m, lit), top = Math.floor(Math.min(PAD_CAP, aw - 120)), Wc = Math.max(40, Math.min(PAD_CAP, aw - 8, (ah - 8) / PAD_TALL)), lo = Math.max(PAD_FULL, PAD_KEEP * Wc);
      if (F.plan) {
        if (!(padClean(F.W, it, m, lit, aw, ah) && (F.W === top || !padClean(F.W + 4, it, m, lit, aw, ah)) && centred(F, F.plan.ext, aw, ah))) bad.push("pad " + nm + " " + ts + " W " + F.W);
      } else {
        const anyClean = Array.from({ length: Math.max(0, Math.floor((top - lo) / 4) + 1) }, (_, i) => top - 4 * i).some((W) => padClean(W, it, m, lit, aw, ah));
        if (anyClean || !near(F.W, Wc) || !centred(F, padBox(F.W), aw, ah)) bad.push("pad compact " + nm + " " + ts + " W " + F.W);
      }
    }
    for (const v of [keyV(), keyV({ key: { ...DEF_KEY, THROW: "KeyZ" } })]) {
      const it = keyCallouts(v), F = kbFit(aw, ah, it, m), kc = Math.max(4, Math.min(KB_CAP, (aw - 8) / (KB_W + 0.8), (ah - 8) / (KB_H + 1.1)));
      if (F.plan) {
        if (!(kbClean(F.k, it, m, aw, ah) && (F.k === KB_CAP || !kbClean(F.k + 0.5, it, m, aw, ah)) && centred(F, F.plan.ext, aw, ah))) bad.push("kb " + nm + " " + ts + " k " + F.k);
      } else {
        const anyClean = Array.from({ length: Math.floor((KB_CAP - KB_FULL) / 0.5) + 1 }, (_, i) => KB_CAP - 0.5 * i).some((k) => kbClean(k, it, m, aw, ah));
        if (anyClean || !near(F.k, kc) || !centred(F, kbBox(F.k), aw, ah)) bad.push("kb compact " + nm + " " + ts + " k " + F.k);
      }
    }
  }
  check("padFit / kbFit take the largest clean size (one step larger fails, or the size is its cap), compact only when no clean size fits, centred in the art box", !bad.length, bad.slice(0, 4).join(" | "));
}

// ---- the armed reset row on the controller tab says it, or the rule line does ----
for (const [nm, Lx, touch, narrow, scale] of [["desk 1366x768", DESK, false, false, undefined], ...BOXES]) {
  const r = rec(), v = padV({ row: 7, armed: true }), G = geoFor(Lx, touch, narrow, scale), g = geomOf(7, G);
  drawControls(r.c, Lx, v, { touch, narrow, scale, level: 1 });
  const row = r.texts.filter((t) => Math.abs(t.y - (g.y + g.h / 2)) < 1).map((t) => t.s), rule = r.texts.some((t) => t.s === "PRESS AGAIN TO RESET THIS TAB");
  check("armed RESET CONTROLLER: the row says PRESS AGAIN (or AGAIN), else the rule line carries it: " + nm, row.includes("RESET CONTROLLER") && (row.includes("PRESS AGAIN") || row.includes("AGAIN") || rule) && rule, row.join());
}

// ---- the rule-line memo keys on the text scale: the same context at another scale measures its rule again ----
{
  const r0 = rec(), v = padV({ row: 6 });
  drawControls(r0.c, L600, v, { level: 1 }); drawControls(r0.c, L600, v, { level: 1 });
  const n0 = r0.log.length; drawControls(r0.c, L600, v, { level: 1 }); const same = r0.log.slice(n0).filter((q) => q === "mt").length;
  setTextScale(1.25); const n1 = r0.log.length; drawControls(r0.c, L600, v, { level: 1 }); const other = r0.log.slice(n1).filter((q) => q === "mt").length; setTextScale(1);
  check("the rule-line memo keys on the text scale (a new scale measures again on the same context)", other > same, same + "/" + other);
}

// ---- small parts: the FIXED plaque in the world's wall tone, a press covers the face at rest ----
{
  const t = worldTokens(1), r = rec({ grad: true }); drawControls(r.c, DESK, padV(), { level: 1 });
  const k = rec({ grad: true }); drawControls(k.c, DESK, keyV(), { level: 1 });
  const fixed = (R) => R.texts.filter((x) => x.s === "FIXED" && x.fill === CONST.t2).map((q) => q.fill === CONST.t2 && R.rects.some((b) => b.fill === t.band && q.x >= b.x && q.x + q.s.length * q.px * 0.6 <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h));
  check("each FIXED tag sits on its own plaque in the world's band tone, its legend in t2 (START on the controller; ESC and the arrows on the keyboard)", fixed(r).length === 1 && fixed(k).length === 2 && [...fixed(r), ...fixed(k)].every(Boolean), fixed(r).concat(fixed(k)).join());
  const W = 300, p = rec(); drawPad(p.c, 0, 0, W, { tok: t, lit: padStates(padV()), press: "S" });
  const [x, y] = PART_AT.S.map((v) => v * W), rest = p.log.lastIndexOf("a" + x.toFixed(1) + "," + y.toFixed(1) + "," + (PADG.br * W + 1).toFixed(2)), drop = p.log.lastIndexOf("a" + x.toFixed(1) + "," + (y + 2).toFixed(1) + "," + (PADG.br * W).toFixed(2));
  check("a press: the well covers the face at rest, then the face drops 2 px (no crescent of the old face)", rest > 0 && drop > rest && p.log[rest + 1] === "f#050304", [rest, drop, p.log[rest + 1]].join());
}

// ---- Task 6: the keyboard drawing prints the player's own layout (controlswire keyNames, through the page view's names) ----
{
  const t = worldTokens(1), lit = keyStates(keyV()), mw = (s, px) => s.length * px * 0.6, AZ = { KeyW: "Z", KeyA: "Q" };
  const legAt = (d, id) => { const r = keyRect(KB_AT[id], 30), f = { x: r.x + 0.08 * 30, w: r.w - 0.16 * 30 }; return d.texts.filter((x) => x.x >= f.x && x.x <= f.x + f.w && x.y >= r.y && x.y <= r.y + r.h).map((x) => x.s).join(); };
  const az = rec(); drawKeys(az.c, 0, 0, 30, { tok: t, lit, prints: kbPrints(30, lit, mw, 1, AZ), px: kbLegend(30), names: AZ });
  const df = rec(); drawKeys(df.c, 0, 0, 30, { tok: t, lit, prints: kbPrints(30, lit, mw), px: kbLegend(30) });
  check("names: the W key prints Z and the A key Q; S, D and SPACE as ever", legAt(az, "KeyW") === "Z" && legAt(az, "KeyA") === "Q" && legAt(az, "KeyS") === "S" && legAt(az, "Space") === "SPACE", legAt(az, "KeyW") + "/" + legAt(az, "KeyA"));
  check("no names: the W key prints W, the A key A", legAt(df, "KeyW") === "W" && legAt(df, "KeyA") === "A", legAt(df, "KeyW"));
  const sem = rec(); drawKeys(sem.c, 0, 0, 30, { tok: t, lit, prints: kbPrints(30, lit, mw, 1, { Semicolon: "M", Escape: "Q", Backspace: "Z", Tab: "Q" }), px: kbLegend(30), names: { Semicolon: "M", Escape: "Q", Backspace: "Z", Tab: "Q" } });
  check("a one-character legend takes the name (AZERTY's ; is M); ESC, TAB and ⌫ keep theirs", legAt(sem, "Semicolon") === "M" && legAt(sem, "Escape") === "ESC" && legAt(sem, "Tab") === "TAB" && legAt(sem, "Backspace") === "", legAt(sem, "Semicolon") + "/" + legAt(sem, "Escape"));
  check("kbPrints measures the name: a name wider than its face is left off", kbPrints(30, {}, mw, 1, { KeyW: "WWWWWW" }).KeyW === undefined && kbPrints(30, {}, mw).KeyW === true);
  const page = rec(); drawControls(page.c, DESK, keyV({ names: AZ }), { level: 1 });
  check("the CONTROLS page: its keyboard and callouts read Z Q S D", page.texts.some((x) => x.s === "Z") && page.texts.some((x) => x.s === "Z Q S D"), page.texts.map((x) => x.s).filter((q) => /^[A-Z ]{1,8}$/.test(q)).join("|"));
}

console.log(fail ? `PADART FAIL (${pass} pass, ${fail} fail)` : `PADART OK (${pass} pass)`);
process.exit(fail ? 1 : 0);
