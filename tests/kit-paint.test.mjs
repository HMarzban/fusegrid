import { readFileSync } from "node:fs";
import { rec as textrec } from "./lib/textrec.mjs";
import { rec as ctxrec } from "./lib/ctxrec.mjs";
import { drawBombBody, paintBrick } from "../src/render/sprites.js";
import { wallShapes, paintShapes } from "../src/render/wallart.js";
import { railOf } from "../src/render/frameart.js";
import { paintFloor } from "../src/render/floorart.js";
import { CONST, worldTokens } from "../src/render/kit/tokens.js";
import { key, cap, capW, plate, band, focusBomb, wallCell, floorCell, brickCell, KINDS } from "../src/render/kit/paint.js";
import { setTextScale, textScale, T, DEV, dsp, lbl, body, nums, measure } from "../src/render/kit/type.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const ALL = [];
const rec = (o) => { const r = textrec(o); ALL.push(r); return r; };
const J = (v) => JSON.stringify(v);
const eqBox = (a, b) => !!a && !!b && ["x", "y", "w", "h"].every((k) => Math.abs(a[k] - b[k]) < 1e-6);
const rgbaOf = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
const balanced = (r) => r.calls.filter((q) => q.op === "save").length === r.calls.filter((q) => q.op === "restore").length && J(r.ctx.getTransform()) === J({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

/* ---- R8: drawBombBody o.bare. The default path is pinned to the call log recorded at fd71988 (before o.bare existed) ---- */
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const bombLog = (...o) => {
  const r = ctxrec();
  for (const w of [{ time: 0.37, fuse: 2.5 }, { time: 1.234 }, { time: 0 }]) for (const v of ["normal", "line", "power", "pierce", null]) for (const t of [3, 1, 0, -0.5]) {
    r.ctx.save(); drawBombBody(r.ctx, w, { timer: t, variant: v }, ...o); r.ctx.restore();
  }
  return fnv(r.log.map((l) => l.op + "(" + l.a.join(",") + ")").join("\n")) + ":" + r.log.length;
};
const BOMB_PIN = "04a73df1:3252";
check("drawBombBody without o.bare draws the pre-R8 call log", bombLog() === BOMB_PIN, bombLog());
check("o = {} and o.bare false draw the same log", bombLog({}) === BOMB_PIN && bombLog({ bare: false }) === BOMB_PIN);
const clock = { get time() { throw new Error("world clock read"); }, get fuse() { throw new Error("world fuse read"); } };
const HOT = ["#ff9d5a", "#ffd447", "#ff5d73"];
let bareErr = "";
const br = rec();
try { for (const v of [null, "normal", "pierce"]) drawBombBody(br.ctx, clock, { timer: 1, variant: v }, { bare: true }); } catch (e) { bareErr = e.message; }
check("bare reads no world clock and no fuse (pierce included)", bareErr === "", bareErr);
check("bare: no cord, no spark, no pulse", !br.paints.some((p) => HOT.includes(p.style)) && !br.writes.some((w) => HOT.includes(w.v)) && !br.calls.some((q) => q.op === "quadraticCurveTo" || q.op === "scale"), J(br.calls.map((q) => q.op)));
check("bare keeps the body, its outline, the shine and the + pip", br.paints.some((p) => p.op === "fill" && p.style === "#15181f") && br.paints.some((p) => p.op === "stroke" && p.style === "#0a0d14") && br.paints.some((p) => p.style === "rgba(255,255,255,0.45)") && br.paints.some((p) => p.op === "stroke" && p.style === "#fff"));

/* ---- focus bomb (appendix 5): the bare body, translate(w/2, h/2 + h*.04) scale(w/30) inside a box whose top is cy - 46 % ---- */
for (const s of [30, 28]) {
  const r = rec();
  focusBomb(r.ctx, 100, 200, s);
  const b = r.paints.find((p) => p.op === "fill" && p.style === "#15181f"), k = s / 30, cy = 200 + 0.08 * s + 0.96 * k;
  check(`focusBomb ${s}: the body sits at the row start, centred on the box, scaled ${s}/30`, eqBox(b && b.box, { x: 100 + s / 2 - 12 * k, y: cy - 12 * k, w: 24 * k, h: 24 * k }), J(b && b.box));
  check(`focusBomb ${s}: no #ff9d5a, no #ffd447, no #ff5d73 anywhere`, !r.paints.some((p) => HOT.includes(p.style)) && !r.writes.some((w) => HOT.includes(w.v)) && !r.texts.length);
  check(`focusBomb ${s}: transform and state restored`, balanced(r));
}

/* ---- the key (appendix 3) ---- */
const APPX = { key: 4, main: 5, dng: 4, lit: 4, mid: 3, well: 0, wall: 0 };
const INK = { key: "#fff2df", main: "#2a1426", dng: "#ff5d73", lit: "#1e1216", mid: "#fff2df", well: "#dccbb8", wall: "#8f8476" };
check("the seven kinds, with the appendix drops", J(Object.keys(KINDS).sort()) === J(Object.keys(APPX).sort()) && Object.keys(APPX).every((k) => KINDS[k].drop === APPX[k]), J(KINDS));
const X = 100, Y = 50, W = 120, H = 30;
const tok = worldTokens(3);
const drawKey = (kind, o = {}, t = tok) => { const r = rec(); key(r.ctx, X, Y, W, H, kind, { tok: t, ...o }); return r; };
const used = (r) => new Set([...r.paints.map((p) => p.style), ...r.texts.map((t) => t.fill)]);
for (const kind of Object.keys(APPX)) {
  const r = drawKey(kind, { label: "GO" }), y0 = kind === "lit" ? Y - 2 : Y, d = APPX[kind];
  const ol = r.paints.filter((p) => p.op === "fill" && p.style === CONST.ol);
  const low = Math.max(...r.paints.filter((p) => p.box).map((p) => p.box.y + p.box.h));
  check(`${kind}: drop ${d} px is the key shape moved down, hard (no blur), drawn first`, d ? eqBox(r.paints[0].box, { x: X, y: y0 + d, w: W, h: H }) && r.paints[0].style === CONST.ol && eqBox(ol[1].box, { x: X, y: y0, w: W, h: H }) : eqBox(ol[0].box, { x: X, y: y0, w: W, h: H }), J(r.paints[0]));
  check(`${kind}: nothing below the drop`, Math.abs(low - (y0 + H + d)) < 1e-6, low);
  const t = r.texts.find((q) => q.s === "GO");
  check(`${kind}: legend in ${INK[kind]}, label font, centred`, t && t.fill === INK[kind] && t.align === "center" && t.x === X + W / 2 && t.y === y0 + H / 2 && t.font === T.label(kind === "wall" ? DEV.d.sec : DEV.d.pri) && /^700 /.test(t.font), J(t));
  check(`${kind}: no ring unless asked`, !r.paints.some((p) => p.op === "stroke" && p.style === CONST.ink));
  check(`${kind}: transform and clip restored`, balanced(r));
  const g = drawKey(kind, { ring: true }), last = g.paints[g.paints.length - 1];
  check(`${kind}: the ring strokes 3 px in #fff2df, 3 px outside the key, on top`, last.op === "stroke" && last.style === "#fff2df" && last.lw === 3 && eqBox(last.box, { x: X - 4.5, y: y0 - 4.5, w: W + 9, h: H + 9 }), J(last));
}
const face = (kind) => drawKey(kind).paints;
const has = (ps, style, box) => ps.some((p) => p.style === style && (!box || eqBox(p.box, box)));
const IN = { x: X + 2, y: Y + 2, w: W - 4, h: H - 4 }, INL = { ...IN, y: Y };
check("key: the world's key face, keyhi top inset", has(face("key"), tok.key, IN) && has(face("key"), tok.keyhi, IN));
check("main: #ffd447 face, #fff3b8 top inset, #c8981e bottom inset over it", has(face("main"), "#ffd447", IN) && face("main").findIndex((p) => p.style === "#fff3b8") < face("main").findIndex((p) => p.style === "#c8981e"));
const dr = face("dng").find((p) => p.style === "#ff5d73");
check("dng: key face and a 2 px coral inner ring", has(face("dng"), tok.key, IN) && dr.rule === "evenodd" && eqBox(dr.subs[0], IN) && eqBox(dr.subs[1], { x: X + 4, y: Y + 4, w: W - 8, h: H - 8 }), J(dr));
check("lit: brick two-tone (lit 54 % over lit2), lithi strip 3 px at inset 3, lip bottom inset, raised 2",
  has(face("lit"), tok.lit2, INL) && has(face("lit"), tok.lit, { ...INL, h: (H - 4) * 0.54 }) && has(face("lit"), tok.lithi, { x: X + 5, y: Y + 3, w: W - 10, h: 3 }) && has(face("lit"), tok.lip, INL));
check("mid: mid face, dark bottom inset at .25", has(face("mid"), tok.mid, IN) && has(face("mid"), "rgba(0,0,0,0.25)", IN));
check("well: well face, dark top inset at .6, no drop", has(face("well"), tok.well, IN) && has(face("well"), "rgba(0,0,0,0.6)", IN));
const wr = face("wall"), veil = rgbaOf(tok.wallTex.veil, tok.wallTex.a);
check("wall: well base, the world's wall cell (code 1) veiled, dark top inset at .4", has(wr, tok.well, IN) && wr.filter((p) => p.style === veil).length >= 1 && has(wr, "rgba(0,0,0,0.4)", IN) && wr.findIndex((p) => p.style === veil) < wr.findIndex((p) => p.style === "rgba(0,0,0,0.4)"));
const cell = rec(); wallCell(cell.ctx, X + 2, Y + 2, H - 4, tok, { code: 1, veil: true });
check("wall: the texture's first tile is wallCell(code 1, veil) at the inner height", J(wr.slice(2, 2 + cell.paints.length).map((p) => [p.op, p.style])) === J(cell.paints.map((p) => [p.op, p.style])), wr.length);
const wch = drawKey("wall", { label: "LOCKED" }), chip = wch.paints.filter((p) => p.style === CONST.ol).pop(), wt = wch.texts.find((q) => q.s === "LOCKED");
check("wall: its legend sits on a dark chip in #8f8476, secondary size", chip && chip.box.x < wt.x - wt.w / 2 && chip.box.x + chip.box.w > wt.x + wt.w / 2 && wt.font === T.label(DEV.d.sec), J(chip && chip.box));
for (const lv of [1, 2, 3, 4, 5, 6, 7, 8]) {
  const t = worldTokens(lv), by = Object.fromEntries(Object.keys(APPX).map((k) => [k, used(drawKey(k, { label: "GO", ring: true }, t))]));
  check(`${t.name}: main is the only kind that uses #ffd447, dng the only one that uses #ff5d73`, Object.keys(by).every((k) => by[k].has("#ffd447") === (k === "main") && by[k].has("#ff5d73") === (k === "dng")), J(Object.keys(by).map((k) => [k, by[k].has("#ffd447"), by[k].has("#ff5d73")])));
}
let unk = "";
try { key(rec().ctx, 0, 0, 10, 10, "gold", { tok }); } catch (e) { unk = e.message; }
check("an unknown kind throws", /gold/.test(unk), unk);

/* ---- keycaps (appendix 2, 3: .k.cap, and the cap on the main key) ---- */
{
  const r = rec(), w = capW(r.ctx, "ESC", { tok }), w2 = cap(r.ctx, 10, 20, "ESC", { tok });
  const t = r.texts.find((q) => q.s === "ESC");
  check("cap returns the width it drew: legend + 2x8 padding + 2x2 border", w === Math.ceil(3 * 0.6 * 16) + 20 && w2 === w && eqBox(r.paints[1].box, { x: 10, y: 20, w, h: 30 }), [w, w2]);
  check("cap: a plain key (drop 4, key face), t2 legend at the secondary size, centred", eqBox(r.paints[0].box, { x: 10, y: 24, w, h: 30 }) && has(r.paints, tok.key) && t.fill === CONST.t2 && t.font === T.label(16) && t.x === 10 + w / 2 && t.y === 35);
  const m = rec(), wm = cap(m.ctx, 0, 0, "M", { tok });
  check("cap: min width 34 x 30 on desktop", wm === 34 && capW(m.ctx, "M", { tok }) === 34);
  const p = rec(), wp = cap(p.ctx, 0, 0, "M", { tok, phone: true });
  check("cap: min width 30 x 28 on phone, 13.5 px legend", wp === 30 && eqBox(p.paints[1].box, { x: 0, y: 0, w: 30, h: 28 }) && p.texts[0].font === T.label(13.5));
  const y = rec(), wy = cap(y.ctx, 0, 0, "ESC", { tok, main: true });
  check("cap on the main key: yelInk face, yellow legend, hard 3 px #6a4a08 drop", wy === w && eqBox(y.paints[0].box, { x: 0, y: 3, w, h: 30 }) && y.paints[0].style === "#6a4a08" && has(y.paints, "#2a1426") && y.texts[0].fill === "#ffd447" && !y.paints.some((q) => q.style === "#ffd447"));
}

/* ---- the plate (appendix 6): ring outside the box, the bed inside ---- */
const plateRun = (o, t = tok) => { const r = rec(); plate(r.ctx, 200, 100, 300, 220, t, o); return r; };
const PB = { x: 200, y: 100, w: 300, h: 220 };
const outside = (b) => !b || b.x + b.w <= PB.x + 1e-6 || b.x >= PB.x + PB.w - 1e-6 || b.y + b.h <= PB.y + 1e-6 || b.y >= PB.y + PB.h - 1e-6;
const inside = (b) => b.x >= PB.x - 1e-6 && b.y >= PB.y - 1e-6 && b.x + b.w <= PB.x + PB.w + 1e-6 && b.y + b.h <= PB.y + PB.h + 1e-6;
for (const lv of [1, 2, 8]) {
  const t = worldTokens(lv), b = t.biome, r = plateRun({}, t);
  const BED = [t.bedA, t.bedB, "rgba(0,0,0,0.45)", "rgba(0,0,0,0.3)"];
  const bed = r.paints.filter((p) => BED.includes(p.style)), ring = r.paints.filter((p) => !BED.includes(p.style));
  check(`${t.name} plate: the bed (checker + inset shades) stays inside the box`, bed.length > 4 && bed.every((p) => inside(p.box)) && eqBox(bed[0].box, PB) && bed[0].style === t.bedA);
  const hole = (p) => p.rule === "evenodd" && p.subs.length === 2 && eqBox(p.subs[1], PB);
  const rim = (p) => p.op === "strokeRect" && p.box.x + p.lw / 2 <= PB.x && p.box.y + p.lw / 2 <= PB.y && p.box.x + p.box.w - p.lw / 2 >= PB.x + PB.w && p.box.y + p.box.h - p.lw / 2 >= PB.y + PB.h;
  check(`${t.name} plate: every ring paint lies outside the box (the evenodd fills cut the box out, the ink lines' inner edges stay on or past it)`, ring.length > 20 && ring.every((p) => outside(p.box) || hole(p) || rim(p)), J(ring.find((p) => !(outside(p.box) || hole(p) || rim(p)))));
  const eo = ring.filter(hole);
  check(`${t.name} plate: drop (#0b0609, 1 px wider, 3 px lower) then base (b.wall), T 16 wide`, eo.length === 2 && eo[0].style === CONST.ol && eqBox(eo[0].subs[0], { x: 183, y: 86, w: 334, h: 253 }) && eo[1].style === b.wall && eqBox(eo[1].subs[0], { x: 184, y: 84, w: 332, h: 252 }), J(eo.map((p) => p.subs[0])));
  const boss = ring.filter((p) => p.op === "fillRect" && p.style === b.wall).map((p) => p.box);
  check(`${t.name} plate: four corner bosses T x T on b.wall`, J(boss) === J([{ x: 184, y: 84, w: 16, h: 16 }, { x: 500, y: 84, w: 16, h: 16 }, { x: 184, y: 320, w: 16, h: 16 }, { x: 500, y: 320, w: 16, h: 16 }]), J(boss));
  const lit = ring.filter((p) => p.style === b.wallHi && p.alpha === 0.6 && p.op === "fillRect").map((p) => p.box);
  check(`${t.name} plate: the wallHi light on the top and left edges at .6`, J(lit) === J([{ x: 184, y: 84, w: 332, h: 1.5 }, { x: 184, y: 84, w: 1.5, h: 252 }]), J(lit));
  const ink = ring.filter((p) => p.op === "strokeRect");
  check(`${t.name} plate: two 2 px #0b0609 ink lines, the outer edge and the hole's edge`, ink.length === 2 && ink.every((p) => p.style === CONST.ol && p.lw === 2 && p.alpha === 1) && eqBox(ink[0].box, { x: 183, y: 83, w: 334, h: 254 }) && eqBox(ink[1].box, { x: 199, y: 99, w: 302, h: 222 }));
  const railR = rec(); paintShapes(railR.ctx, b, railOf(b, "h", 0, 40), 0, 0);
  const styles = new Set(ring.map((p) => p.style));
  check(`${t.name} plate: the rails are the game's railOf shapes, inside their bands`, [...new Set(railR.paints.map((p) => p.style))].every((s) => styles.has(s)) && ring.filter((p) => p.box && (p.box.y < 100 || p.box.y >= 320) && p.box.x >= 200 && p.box.x < 500).length > 0);
  check(`${t.name} plate: state restored`, balanced(r));
}
{
  const r = plateRun(), bB = r.paints.filter((p) => p.style === tok.bedB).map((p) => p.box);
  check("plate bed: 80 px tile, conic phase (bedB top-left and bottom-right of each tile)", eqBox(bB[0], { x: 200, y: 100, w: 40, h: 40 }) && bB.some((b) => eqBox(b, { x: 240, y: 140, w: 40, h: 40 })) && !bB.some((b) => b.x === 240 && b.y === 100) && bB.some((b) => eqBox(b, { x: 480, y: 140, w: 20, h: 40 })) && bB.some((b) => eqBox(b, { x: 240, y: 300, w: 40, h: 20 })), J(bB.slice(0, 4)));
  const sh = r.paints.filter((p) => p.style === "rgba(0,0,0,0.45)" || p.style === "rgba(0,0,0,0.3)");
  check("plate bed: hard inset shades, left 3 px at .3 under top 3 px at .45", sh.length === 2 && sh[0].style === "rgba(0,0,0,0.3)" && eqBox(sh[0].box, { x: 200, y: 100, w: 3, h: 220 }) && eqBox(sh[1].box, { x: 200, y: 100, w: 300, h: 3 }));
  const p = plateRun({ phone: true }), pB = p.paints.filter((q) => q.style === tok.bedB).map((q) => q.box), pe = p.paints.filter((q) => q.rule === "evenodd");
  check("plate on a phone: T 10, 56 px tile", eqBox(pB[0], { x: 200, y: 100, w: 28, h: 28 }) && eqBox(pe[1].subs[0], { x: 190, y: 90, w: 320, h: 240 }));
  const e = plateRun({ T: 8 }), ee = e.paints.filter((q) => q.rule === "evenodd");
  check("plate: T as an option", eqBox(ee[1].subs[0], { x: 192, y: 92, w: 316, h: 236 }));
}

/* ---- band (appendix 4 .row.sel, 5) ---- */
{
  const r = rec();
  band(r.ctx, 10, 20, 200, 40, tok);
  check("band: band token fill, radius 6, then a 2 px #0b0609 inner outline", r.paints[0].style === tok.band && eqBox(r.paints[0].box, { x: 10, y: 20, w: 200, h: 40 }) && r.paints[1].style === CONST.ol && r.paints[1].rule === "evenodd" && eqBox(r.paints[1].subs[0], { x: 10, y: 20, w: 200, h: 40 }) && eqBox(r.paints[1].subs[1], { x: 12, y: 22, w: 196, h: 36 }) && r.paints.length === 2);
}

/* ---- board cells: the game's own painters with tok.biome ---- */
const via = (ref, t = tok) => { const r = rec(); r.ctx.save(); r.ctx.translate(5, 7); r.ctx.scale(0.5, 0.5); ref(r.ctx, t.biome); r.ctx.restore(); return J(r.paints); };
const got = (fn) => { const r = rec(); fn(r.ctx); return J(r.paints); };
for (const lv of [1, 2, 7]) {
  const t = worldTokens(lv);
  check(`${t.name} wallCell = wallart paintShapes(wallShapes(b, code)) scaled to s`, got((c) => wallCell(c, 5, 7, 20, t, { code: 2 })) === via((c, b) => paintShapes(c, b, wallShapes(b, 2), 0, 0), t) && got((c) => wallCell(c, 5, 7, 20, t)) === via((c, b) => paintShapes(c, b, wallShapes(b, 0), 0, 0), t));
  check(`${t.name} floorCell = floorart paintFloor(b, par, v)`, got((c) => floorCell(c, 5, 7, 20, t, { par: 1, v: 2 })) === via((c, b) => paintFloor(c, b, 1, 2), t) && got((c) => floorCell(c, 5, 7, 20, t)) === via((c, b) => paintFloor(c, b, 0, 0), t));
  check(`${t.name} brickCell = the CLASSIC paintBrick`, got((c) => brickCell(c, 5, 7, 20, t)) === via((c, b) => paintBrick(c, b), t));
  const v = rec(); wallCell(v.ctx, 5, 7, 20, t, { veil: true });
  const last = v.paints[v.paints.length - 1];
  check(`${t.name} wallCell veil: rgba(wallTex.veil, wallTex.a) over the whole cell`, last.style === rgbaOf(t.wallTex.veil, t.wallTex.a) && eqBox(last.box, { x: 5, y: 7, w: 20, h: 20 }), J(last));
}
let bst = "";
try { brickCell(rec().ctx, 0, 0, 40, tok, "won"); } catch (e) { bst = e.message; }
check("brickCell: a state no page has built yet throws", /won/.test(bst), bst);

/* ---- device metrics (appendix 2) ---- */
check("DEV: the appendix device table, desktop and phone", J(DEV) === J({
  d: { pri: 21, sec: 16, hud: 27, bod: 18, ttl: 40, rowh: 40, keyh: 30, btnh: 50, capw: 34, caph: 30, rkw: 64, mcw: 12, mch: 26, bkh: 36, lch: 40, lcw: 40, sdw: 38, sdh: 52, sdf: 34, tg: 26, bombs: 30, labx: 50, T: 16, tile: 80 },
  p: { pri: 16, sec: 13.5, hud: 20, bod: 15, ttl: 30, rowh: 52, keyh: 44, btnh: 52, capw: 30, caph: 28, rkw: 54, mcw: 9, mch: 28, bkh: 44, lch: 44, lcw: 36, sdw: 32, sdh: 46, sdf: 28, tg: 24, bombs: 28, labx: 42, T: 10, tile: 56 },
}), J(DEV));

/* ---- type (appendix 2) ---- */
const FONTS = () => [T.display(40), T.label(21), T.body(18), T.num(27)];
check("text scale starts at 1", textScale() === 1);
check("every type font is the system sans stack, never monospace", FONTS().every((f) => f.includes("system-ui") && !/mono/i.test(f)), J(FONTS()));
check("weights: display 900, label 700, body 400, numbers 800", J(FONTS().map((f) => f.split(" ")[0])) === J(["900", "700", "400", "800"]));
check("fonts at scale 1", J(FONTS().map((f) => f.split(" ")[1])) === J(["40px", "21px", "18px", "27px"]));
setTextScale(1.25);
check("setTextScale(1.25) scales every font px", textScale() === 1.25 && J(FONTS().map((f) => f.split(" ")[1])) === J(["50px", "26.25px", "22.5px", "33.75px"]) && T.label(13.5).startsWith("700 16.875px "), J(FONTS()));
const ts = rec();
dsp(ts.ctx, "PAUSED", 0, 0, 34); lbl(ts.ctx, "PLAY", 0, 0, 21); body(ts.ctx, "Sentence.", 0, 0, 18); nums(ts.ctx, "1,240", 0, 0, 27);
check("at 1.25 every helper draws with a scaled system-ui font", ts.texts.length > 6 && ts.texts.every((t) => t.font.includes("system-ui") && !/mono/i.test(t.font)) && ts.texts.some((t) => t.font.startsWith("900 42.5px ")) && ts.texts.some((t) => t.font.startsWith("400 22.5px ")));
setTextScale(1);
{
  const r = rec(), n = () => r.calls.filter((q) => q.op === "measureText").length;
  const a = measure(r.ctx, T.label(21), "PLAY"), n1 = n(), b = measure(r.ctx, T.label(21), "PLAY"), n2 = n();
  check("measure: one measureText, then the memo answers the second call", a === 4 * 0.6 * 21 && b === a && n1 === 1 && n2 === 1, [n1, n2]);
  setTextScale(1.25);
  measure(r.ctx, "700 21px x", "PLAY"); measure(r.ctx, "700 21px x", "PLAY");
  setTextScale(1);
  measure(r.ctx, "700 21px x", "PLAY");
  check("measure: the memo is keyed on text scale too", n() === 3, n());
}
{
  const r = rec();
  const w = dsp(r.ctx, "PAUSED", 50, 60, 40);
  const [d1, d2, s1, f1] = r.texts;
  check("dsp: hard drop (+0.08 em, #0b0609) first, then the 0.12 em outline, then the cream face", r.texts.length === 4 && d1.stroke === CONST.ol && Math.abs(d1.y - 63.2) < 1e-9 && d2.fill === CONST.ol && Math.abs(d2.y - 63.2) < 1e-9 && !d2.stroke && s1.stroke === CONST.ol && s1.y === 60 && f1.fill === CONST.ink && f1.y === 60 && !f1.stroke && r.writes.some((q) => q.k === "lineWidth" && q.v === 4.8) && r.writes.some((q) => q.k === "lineJoin" && q.v === "round") && w === 6 * 0.6 * 40, J(r.texts.map((t) => [t.y, t.fill, t.stroke])));
  const y = rec(); dsp(y.ctx, "GO", 0, 0, 40, { col: CONST.yel, align: "center" });
  check("dsp: face colour and alignment are options", y.texts[3].fill === CONST.yel && y.texts.every((t) => t.align === "center"));
  const l = rec(), lw = lbl(l.ctx, "PLAY", 5, 6, 21), bb = rec(); body(bb.ctx, "Hi.", 5, 6, 18);
  check("lbl: 700 cream; body: 400 t2; both return their width", l.texts[0].fill === CONST.ink && l.texts[0].font === T.label(21) && lw === 4 * 0.6 * 21 && bb.texts[0].fill === CONST.t2 && bb.texts[0].font === T.body(18));
}
{
  const W8 = { 0: 9, 1: 4, 2: 8, 4: 9, 8: 9, ",": 3 };
  const prop = () => { const r = rec(); r.ctx.measureText = (s) => ({ width: [...String(s)].reduce((a, ch) => a + (W8[ch] ?? 7), 0) }); return r; };
  const a = prop(), wa = nums(a.ctx, "111", 0, 10, 27), b = prop(), wb = nums(b.ctx, "888", 0, 10, 27);
  check("nums: every digit in one fixed cell (the widest digit), so 111 and 888 are as wide", wa === 27 && wb === 27 && J(a.texts.map((t) => t.x)) === J([4.5, 13.5, 22.5]) && a.texts.every((t) => t.align === "center" && t.font === T.num(27)), J(a.texts.map((t) => t.x)));
  const c = prop(), wc = nums(c.ctx, "1,240", 100, 10, 27, { align: "right" });
  check("nums: separators keep their own width; right alignment ends at x", wc === 9 + 3 + 27 && Math.abs(c.texts[4].x - (100 - 4.5)) < 1e-9 && Math.abs(c.texts[1].x - (100 - wc + 9 + 1.5)) < 1e-9 && c.texts.map((t) => t.s).join("") === "1,240", J(c.texts.map((t) => [t.s, t.x])));
  const u = prop(), wu = nums(u.ctx, "2.5s", 0, 0, 27);
  check("nums: units unspaced, cream by default", u.texts.map((t) => t.s).join("") === "2.5s" && wu === 9 + 7 + 9 + 7 && u.texts.every((t) => t.fill === CONST.ink));
}

/* ---- no filter, no blur, no DOM ---- */
const SRC = ["paint.js", "type.js"].map((f) => readFileSync(new URL("../src/render/kit/" + f, import.meta.url), "utf8"));
check("kit painters name no filter / shadowBlur / shadowColor / getImageData / toDataURL", SRC.every((s) => !/\bfilter\b|shadowBlur|shadowColor|getImageData|toDataURL/.test(s)));
check("kit painters touch no window / document / navigator", SRC.every((s) => !/\b(window|document|navigator)\b/.test(s)));
const BAN = ["filter", "shadowBlur", "shadowColor"];
check("no painter wrote filter / shadowBlur / shadowColor in this run", ALL.every((r) => !r.writes.some((w) => BAN.includes(w.k))) && ALL.length > 50, ALL.length);

console.log(pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
