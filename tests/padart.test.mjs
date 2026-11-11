// CONTROLS drawings (UI upgrade v202 Task 6.1 / 6.2): the round 7 controller, its leaders and states, against the appendix (section 9).
import { readFileSync } from "node:fs";
import { layout } from "../src/render/menudraw.js";
import { PADG, HALF, PART_AT, drawPad, padBox, ringR } from "../src/render/padart.js";
import { DEF_PAD, DEF_KEY, BTN, geoFor, geomOf, hitPage, rowsOf, padStates, padRing, padCallouts, padPlan, padFit, padCross, PAD_FULL } from "../src/render/controlsgeo.js";
import { drawControls } from "../src/render/controlsdraw.js";
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
  const log = [], colours = [], texts = [], stack = [];
  let sx = 1, tx = 0, ty = 0;
  const grad = (kind) => () => { const g = { kind, stops: [], addColorStop(at, col) { g.stops.push([at, col]); colours.push(col); }, toString() { return "grad"; } }; log.push(kind); return g; };
  const set = (k) => ({ get() { return this["_" + k]; }, set(v) { this["_" + k] = v; if (typeof v === "string") colours.push(v); } });
  const c = {
    font: "10px sans-serif", globalAlpha: 1, textAlign: "left", textBaseline: "alphabetic", lineWidth: 1, lineCap: "butt", lineJoin: "miter",
    save() { stack.push([sx, tx, ty]); log.push("save"); }, restore() { [sx, tx, ty] = stack.pop(); log.push("restore"); },
    translate(x, y) { tx += sx * x; ty += sx * y; log.push("t"); }, scale(k) { sx *= k; log.push("s"); }, rotate() { log.push("r"); },
    beginPath() { log.push("bp"); }, closePath() { log.push("cp"); }, clip() { log.push("clip"); },
    moveTo(x, y) { log.push("m" + (tx + sx * x).toFixed(1) + "," + (ty + sx * y).toFixed(1)); }, lineTo(x, y) { log.push("l" + (tx + sx * x).toFixed(1) + "," + (ty + sx * y).toFixed(1)); },
    arc(x, y, r) { log.push("a" + (tx + sx * x).toFixed(1) + "," + (ty + sx * y).toFixed(1) + "," + (sx * r).toFixed(2)); }, arcTo() { log.push("at"); }, ellipse() { log.push("el"); },
    bezierCurveTo() { log.push("bz"); }, quadraticCurveTo() { log.push("q"); },
    fill() { log.push("f" + (typeof c.fillStyle === "string" ? c.fillStyle : "grad")); }, stroke() { log.push("k" + (typeof c.strokeStyle === "string" ? c.strokeStyle : "grad")); },
    fillRect() { log.push("fr"); }, strokeRect() { log.push("sr"); }, drawImage() { log.push("img"); },
    measureText(s) { return { width: String(s).length * (+/([\d.]+)px/.exec(c.font)[1]) * 0.6 }; },
    fillText(s, x, y) { texts.push({ s: String(s), x: tx + sx * x, y: ty + sx * y, px: +/([\d.]+)px/.exec(c.font)[1] * sx, fill: c.fillStyle }); log.push("x" + s); },
  };
  Object.defineProperty(c, "fillStyle", set("fill")); Object.defineProperty(c, "strokeStyle", set("stroke"));
  c.fillStyle = "#000"; c.strokeStyle = "#000";
  if (o.grad) { c.createLinearGradient = grad("lg"); c.createRadialGradient = grad("rg"); }
  if (o.getTransform) c.getTransform = () => ({ a: o.getTransform, b: 0 });
  if (o.img === false) delete c.drawImage;
  return { c, log, colours, texts };
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
  check("no filter, no blur, no pixel read in the drawings' source", !/\.filter\s*=|shadowBlur|shadowColor|getImageData|toDataURL|setLineDash/.test(readFileSync(new URL("src/render/padart.js", ROOT), "utf8") + readFileSync(new URL("src/render/controlsdraw.js", ROOT), "utf8")));
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
  const src = readFileSync(new URL("src/render/padart.js", ROOT), "utf8") + readFileSync(new URL("src/render/controlsdraw.js", ROOT), "utf8");
  check("no spark painter and no fuse path left in the source", !/function spark|FUSE_PATH|spark\(/.test(src));
}

// ---- leaders: the crossing gate (round 7 window.GATE().cross, ported independently of controlsgeo's own check) ----
const X = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])), on = (p, q, r) => Math.min(p[0], q[0]) - 1e-6 <= r[0] && r[0] <= Math.max(p[0], q[0]) + 1e-6 && Math.min(p[1], q[1]) - 1e-6 <= r[1] && r[1] <= Math.max(p[1], q[1]) + 1e-6;
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return (o1 !== o2 && o3 !== o4 && o1 && o2 && o3 && o4) || (!o1 && on(a, b, c)) || (!o2 && on(a, b, d)) || (!o3 && on(c, d, a)) || (!o4 && on(c, d, b));
};
const dist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
function crossings(plan) {
  const W = plan.W, out = [], segs = (L) => L.pts.slice(1).map((p, i) => [L.pts[i], p]);
  const fr = (PADG.br + 0.009) * W, circles = [["LS", PADG.LS[2] * W], ["dpad", PADG.DPAD[2] * W], ["RS", PADG.RS[2] * W], ...["N", "E", "S", "W"].map((k) => [k, fr]), ["SELECT", 0.03 * W], ["START", 0.03 * W]].map(([id, r]) => ({ id, x: PART_AT[id][0] * W, y: PART_AT[id][1] * W, r }));
  const own = (g) => (g === "MOVE" ? ["LS", "dpad", "RS"] : [g]);
  for (let i = 0; i < plan.lines.length; i++) for (let j = i + 1; j < plan.lines.length; j++) {
    if (plan.lines[i].grp === plan.lines[j].grp) continue;
    for (const [a, b] of segs(plan.lines[i])) for (const [c, d] of segs(plan.lines[j])) if (X(a, b, c, d)) out.push(plan.lines[i].grp + " x " + plan.lines[j].grp);
  }
  for (const L of plan.lines) for (const [a, b] of segs(L)) for (const c of circles) if (!own(L.grp).includes(c.id) && dist([c.x, c.y], a, b) < c.r + 2) out.push(L.grp + " near " + c.id);
  return out;
}
const M = (ts) => ({ pri: 13 * ts, sec: 11 * ts, wOf: (s, px) => s.length * px * 0.6 });
{
  const G = geoFor(DESK, false, false), A = { w: G.pane.w - 12, h: G.art.h - 13 };
  for (const ts of [1, 1.25]) {
    const F = padFit(A.w, A.h, padCallouts(padV()), M(ts), padStates(padV()));
    check("desk 1366x768 at text " + ts + ": the default binds draw every callout (W " + Math.round(F.W) + ")", !!F.plan && F.W >= PAD_FULL && F.plan.labels.length === 6 && !crossings(F.plan).length, F.plan && crossings(F.plan).join());
    const sw = padV({ binds: { ...DEF_PAD, BOMB: "E", REMOTE: "S" } }), F2 = padFit(A.w, A.h, padCallouts(sw), M(ts), padStates(sw));
    check("after a rebind (BOMB EAST, REMOTE SOUTH) the callouts follow, no crossing: text " + ts, !!F2.plan && F2.plan.labels.some((l) => l.grp === "E" && l.lines[0].s === "BOMB") && !crossings(F2.plan).length);
    const far = padV({ binds: { BOMB: "SELECT", THROW: "W", REMOTE: "E", PAUSE: "S" }, stick: "R" }), F3 = padFit(A.w, A.h, padCallouts(far), M(ts), padStates(far));
    check("an action bound on the far side (BOMB SELECT) and the right stick: drawn, no crossing: text " + ts, !!F3.plan && F3.plan.labels.some((l) => l.grp === "SELECT" && l.side === "l" && l.lines[0].s === "BOMB") && !crossings(F3.plan).length, F3.plan && crossings(F3.plan).join());
  }
  // every assignment of the four actions over every button the model lets you bind, both sticks, both text scales, three desk boxes
  const ART = [DESK, layout(1024, 700), layout(1280, 720)].map((Lx) => { const g = geoFor(Lx, false, false); return [g.pane.w - 12, g.art.h - 13]; });
  let n = 0, full = 0, bad = [];
  for (const ts of [1, 1.25]) for (const [aw, ah] of ART) for (const stick of ["L", "R"]) for (const B of BINDABLE) for (const T of BINDABLE) for (const R of BINDABLE) for (const P of BINDABLE) {
    if (new Set([B, T, R, P]).size < 4) continue;
    const v = padV({ binds: { BOMB: B, THROW: T, REMOTE: R, PAUSE: P }, stick }), F = padFit(aw, ah, padCallouts(v), M(ts), padStates(v));
    n++;
    if (!F.plan) continue;
    full++;
    const x = crossings(F.plan);
    if (x.length) bad.push([B, T, R, P, stick, ts, aw].join("/") + ": " + x[0]);
  }
  check("no drawn leader crosses another leader or a foreign button, in all " + n + " bindings (" + full + " with callouts, the rest none)", !bad.length && full > n * 0.5, bad.slice(0, 3).join(" | "));
  const p = padPlan(300, padCallouts(padV()), M(1));
  check("the leaders are orthogonal: every segment level or plumb", p.lines.every((L) => L.pts.slice(1).every((q, i) => q[0] === L.pts[i][0] || q[1] === L.pts[i][1])));
  check("SOUTH meets EAST, so its label drops through a knee in the gutter, inside the next label's gutter column", (() => { const s = p.lines.find((l) => l.grp === "S"); return s.pts.length === 4 && s.pts[1][0] > 300 && s.pts[3][1] > s.pts[0][1]; })());
  check("controlsgeo's own gate agrees with the port on the default plan", padCross(p, padStates(padV())).length === 0 && crossings(p).length === 0);
  for (const [nm, Lx, touch, narrow, scale] of BOXES) {
    const r = rec(); drawControls(r.c, Lx, padV(), { touch, narrow, scale, level: 1 });
    const labels = r.texts.filter((t) => t.fill === CONST.ink || t.fill === CONST.t2).map((t) => t.s);
    const want = nm.startsWith("desk") ? ["BOMB", "SOUTH", "THROW", "WEST", "REMOTE", "EAST", "MOVE", "L-STICK", "D-PAD", "START", "SELECT"] : [];
    check("callouts where they fit (the desk), none in a small pane or the phone column: " + nm, want.every((w) => labels.includes(w)) && (want.length || !labels.length), labels.join());
  }
}

// ---- capture: no countdown, its cancel copy ----
{
  const v = padV({ capture: CAP, row: 2 }), a = rec(), b = rec();
  drawControls(a.c, L600, v, { level: 1, t: 0 }); drawControls(b.c, L600, v, { level: 1, t: 37 });
  check("capture is static: two frames apart draw the same", a.log.join() === b.log.join());
  check("capture says how to cancel, and nothing counts down", a.texts.some((t) => t.s === CAP.foot) && !a.texts.some((t) => /^\d+(\.\d+)?s?$/.test(t.s) || /SECOND|TIME LEFT/.test(t.s)));
  const G = geoFor(L600, false, false), C = G.cap, room = C.h - 100, W0 = Math.min(150, C.w - 40, room / 0.74), B = padBox(W0), px = C.x + C.w / 2 - W0 / 2, py = C.y + 48 + (room - (B.y1 - B.y0)) / 2 - B.y0;
  const ringK = "a" + (px + PART_AT.W[0] * W0).toFixed(1) + "," + (py + PART_AT.W[1] * W0).toFixed(1) + "," + ringR("W", W0).toFixed(2);
  check("capture on the controller: every input quiet but the action's own button (WEST), lit and ringed", fillAt(a, "W", W0, px, py) === "f" + tok.lit && ["N", "E", "S"].every((id) => fillAt(a, id, W0, px, py) === "f" + tok.key) && a.log.includes(ringK) && W0 > 100, [fillAt(a, "W", W0, px, py), W0.toFixed(1)].join());
}

// ---- no controller ----
{
  for (const [nm, Lx, touch, narrow, scale] of BOXES) {
    const v = keyV({ tab: "pad", row: 1 }), G = geoFor(Lx, touch, narrow, scale), r = rec();
    drawControls(r.c, Lx, v, { touch, narrow, scale, level: 1 });
    const hits = [5, 6, 7].map((i) => { const g = geomOf(i, G); return hitPage(v, g.x + g.w / 2, g.y + g.h / 2, G).row; });
    check("no controller keeps SENSITIVITY, VIBRATION, RESET drawn and tappable: " + nm, hits.join() === "5,6,7" && ["SENSITIVITY", "VIBRATION", "RESET CONTROLLER"].every((s) => r.texts.some((t) => t.s === s)), hits.join());
  }
  const q = { c: model.DEF_CONTROLS, said: [] }, p = createControlsPage({ get: () => q.c, set: (c) => { q.c = c; }, padView: () => ({ state: "none" }), say: (s) => q.said.push(s) });
  p.open("pad");
  const seen = [];
  for (let i = 0; i < 8; i++) { p.walk(1, 1); seen.push(p.view(0).row); }
  check("no controller: the walk still reaches SENSITIVITY, VIBRATION and RESET", [5, 6, 7].every((i) => seen.includes(i)), seen.join());
  const r = rec(); drawControls(r.c, DESK, keyV({ tab: "pad" }), { level: 1 });
  check("no controller: the NO CONTROLLER plaque and the line under it", r.texts.some((t) => t.s === "NO CONTROLLER") && r.texts.some((t) => t.s === "PRESS ANY BUTTON ON A CONTROLLER"));
}

// ---- the binding rule the drawing follows (owner R3): which buttons the model lets a player bind ----
check("the drawing routes a leader for every button the model accepts", BINDABLE.every((id) => PART_AT[id]), BINDABLE.join());

// ---- a steady frame blits the cached drawing ----
{
  const made = [];
  globalThis.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; made.push(this); } getContext() { return rec({ grad: true }).c; } };
  try {
    cache.release();
    const frame = () => { const r = rec({ grad: true, getTransform: 2 }); drawControls(r.c, DESK, padV(), { level: 1 }); return r; };
    frame();
    const m0 = cache._dbg.misses, r = frame();
    check("a steady CONTROLS frame: 0 cache misses, the drawing one blit, <= 400 canvas calls", cache._dbg.misses === m0 && r.log.filter((q) => q === "img").length === 1 && r.log.length <= 400, r.log.length);
    const m1 = cache._dbg.misses, w = rec({ grad: true, getTransform: 2 }); drawControls(w.c, DESK, padV({ row: 2 }), { level: 1 });
    check("a row move re-blits the same layer: the ring is live, no miss", cache._dbg.misses === m1);
  } finally { delete globalThis.OffscreenCanvas; cache.release(); setTextScale(1); }
}

console.log(fail ? `PADART FAIL (${pass} pass, ${fail} fail)` : `PADART OK (${pass} pass)`);
process.exit(fail ? 1 : 0);
