/* UI upgrade v202 Task 3.1: MENU on the world kit (src/render/pages/menu.js). One geometry for draw and tap (rows by name), the round 7 S7-menu /
   L7-logo frames' metrics (desktop 1366 x 768 at 1 box unit per CSS px; phone 393 x 852 in CSS px on the PORT_SHELL box), the focus (bare bomb, band on a
   door, the 3 px cream ring), one yellow fill, no cord or spark colour outside the logo, the longest strings whole at text scale 1 and 1.25, the
   cached static parts (0 misses on a steady frame or a cursor move, one refill on a world or text-scale change), the covered render flag, the
   cache's recency touch and its budget with the title's layers present, and the probe record the gates read. Every canvas is a textrec stub; the
   page's layer canvases and the logo's are told apart through the logo painter's _dbg. */
import { rec } from "./lib/textrec.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
const K8 = 0.6 * 1.08; // the recorder's width factor 8 % above the default (appendix 11)
const made = [];
class Cv { constructor(w, h) { this.width = w; this.height = h; this.r = rec({ widthK: K8 }); made.push(this); } getContext() { return this.r.ctx; } }
globalThis.OffscreenCanvas = Cv;
const cache = await import("../src/render/kit/cache.js");
cache.setFactory((w, h) => new Cv(w, h));
const P = await import("../src/render/pages/menu.js");
const md = await import("../src/render/menudraw.js");
const W = await import("../src/render/words.js");
const { setTextScale } = await import("../src/render/kit/type.js");
const { worldTokens, CONST } = await import("../src/render/kit/tokens.js");
const probe = await import("../src/render/kit/probe.js");
const logo = await import("../src/render/logo/draw2d.js");
const { ITEMS, SCREEN, createMenuApp } = await import("../src/app/menuapp.js");
const { shellGeo } = await import("../src/app/fit.js");
const { setHints } = await import("../src/render/hintcopy.js");
const { wordsOf } = await import("../src/app/hints.js");
const { DEF_CONTROLS } = await import("../src/app/controls.js");
const SV = await import("../src/render/shellview.js");
const { SCREENS } = await import("../tools/ui/lib/screens.mjs");

const PG = shellGeo(393, 852);
const BOX = {
  d1366: { W: 1366, H: 768, touch: false, shell: true, css: 1 },
  d1920: { W: 1920, H: 1080, touch: false, shell: true, css: 1 },
  d1024: { W: 1024, H: 768, touch: false, shell: true, css: 1 },
  l1024: { W: 1024, H: 768, touch: true, shell: true, css: 1 },
  p393: { W: PG.w, H: PG.h, touch: true, shell: true, css: PG.s },
  c600: { W: 600, H: 520, touch: false, shell: false, css: 1 },
  c600t: { W: 600, H: 520, touch: true, shell: false, css: 1 },
  iso: { W: 608, H: 352, touch: false, shell: false, css: 1 },
};
const SIX = ["d1366", "d1920", "d1024", "p393", "c600", "iso"];
const UI = (o) => ({ rows: ITEMS, focus: "PLAY", level: 1, run: { heat: 0, pace: 0, pact: 0 }, daily: null, best: null, look: 0, pages: 4, rev: "v201", note: "", pad: "", enterT: 9, ...o });
const near = (a, b, e = 0.51) => Math.abs(a - b) <= e;
const nearR = (a, b, e) => near(a.x, b.x, e) && near(a.y, b.y, e) && near(a.w, b.w, e) && near(a.h, b.h, e);
const inside = (a, b, e = 0.01) => a.x >= b.x - e && a.y >= b.y - e && a.x + a.w <= b.x + b.w + e && a.y + a.h <= b.y + b.h + e;
const css = (r, s) => ({ x: r.x * s, y: r.y * s, w: r.w * s, h: r.h * s });
/* paint one frame on a fresh target at dpr; returns the target, the canvases made that frame and the misses */
function frame(F, ui, o = {}) {
  const t = rec({ widthK: K8 });
  if (o.dpr) t.ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  const n0 = made.length, m0 = cache._dbg.misses;
  P.drawMenuPage(o.c || t.ctx, F, ui, o.t || 0);
  return { t, cvs: made.slice(n0), miss: cache._dbg.misses - m0 };
}
const fresh = () => { cache.release(); cache._dbg.misses = 0; };

/* ---- order and words ---- */
check("rows: words.js MENU_ROWS is menuapp ITEMS, PLAY, LEVEL SELECT, DAILY, RECORDS, SETTINGS, GUIDE, SOURCE", J(W.MENU_ROWS) === J(ITEMS) && J(ITEMS) === J(["PLAY", "LEVEL SELECT", "DAILY", "RECORDS", "SETTINGS", "GUIDE", "SOURCE"]));
for (const b of SIX) {
  const G = P.menuGeom(BOX[b]), ys = ITEMS.map((l) => G.rows[l].y);
  if (G.mode === "desk") check(`order (${b}): one list top to bottom in ITEMS order, one column`, ys.every((y, i) => !i || y > ys[i - 1]) && ITEMS.every((l) => G.rows[l].x === G.rows.PLAY.x), J(ys));
  else {
    const r = G.rows;
    check(`order (${b}): PLAY, LEVEL SELECT, the card's slot, DAILY | RECORDS, SETTINGS | GUIDE, SOURCE`, r.PLAY.y < r["LEVEL SELECT"].y && r["LEVEL SELECT"].y + r["LEVEL SELECT"].h < G.card.y && G.card.y + G.card.h < r.DAILY.y && r.DAILY.y === r.RECORDS.y && r.DAILY.x < r.RECORDS.x && r.SETTINGS.y === r.GUIDE.y && r.SETTINGS.y > r.DAILY.y && r.SETTINGS.x === r.DAILY.x && r.SOURCE.y > r.GUIDE.y && r.SOURCE.w === r.PLAY.w);
  }
}

/* ---- the mock's metrics (round 7 L7-logo m1-menu, DOM rects in CSS px) ---- */
{
  const G = P.menuGeom(BOX.d1366), r = G.rows, M = { PLAY: [179, 191.36, 480, 64], "LEVEL SELECT": [179, 279.36, 480, 46], DAILY: [179, 333.36, 480, 46], RECORDS: [179, 387.36, 480, 46], SETTINGS: [179, 441.36, 480, 46], GUIDE: [179, 511.36, 480, 46], SOURCE: [179, 565.36, 480, 46] };
  const bad = ITEMS.filter((l) => !nearR(r[l], { x: M[l][0], y: M[l][1], w: M[l][2], h: M[l][3] }, 0.01));
  check("desktop 1366x768: every row at the mock's rect (PLAY 64, doors 46, 8 px pitch, 24 px breaks after PLAY and before GUIDE)", bad.length === 0, J(bad.map((l) => [l, r[l]])));
  check("desktop 1366x768: the plate at (153, 70, 1060, 567.36), the logo's header at y 100 (63.36 tall), the card's slot (685, 191.36, 502, 420), the foot at y 655.36",
    nearR(G.plate, { x: 153, y: 70, w: 1060, h: 567.36 }, 0.01) && near(G.logo.y, 100, 0.01) && near(G.logo.h, 63.36, 0.01) && nearR(G.card, { x: 685, y: 191.36, w: 502, h: 420 }, 0.01) && near(G.foot.y, 655.36, 0.01), J([G.plate, G.logo, G.card, G.foot]));
  setTextScale(1.25);
  const H = P.menuGeom(BOX.d1366), h = H.rows;
  setTextScale(1);
  check("desktop at 125 %: the mock's t125 frame (plate 1180 wide from y 56, PLAY 520 x 72 at (117, 163.36), doors 49 at (117, 259.36))", near(H.plate.w, 1180, 0.01) && near(H.plate.y, 56, 0.01) && nearR(h.PLAY, { x: 117, y: 163.36, w: 520, h: 72 }, 0.01) && nearR(h["LEVEL SELECT"], { x: 117, y: 259.36, w: 520, h: 49 }, 0.01) && near(h.SOURCE.y, 560.36, 0.01), J([H.plate, h.PLAY, h.SOURCE]));
  const Q = P.menuGeom(BOX.p393), s = BOX.p393.css, q = (l) => css(Q.rows[l], s), MP = { PLAY: [24, 153.36, 345, 62], "LEVEL SELECT": [24, 225.36, 345, 50], DAILY: [24, 632, 167.5, 58], RECORDS: [201.5, 632, 167.5, 58], SETTINGS: [24, 700, 167.5, 58], GUIDE: [201.5, 700, 167.5, 58], SOURCE: [24, 768, 345, 50] };
  const badp = ITEMS.filter((l) => !nearR(q(l), { x: MP[l][0], y: MP[l][1], w: MP[l][2], h: MP[l][3] }, 1.2));
  check("phone 393x852 (#sh at ~0.9): every row at the mock's CSS rect within 1.2 px (PLAY 62, doors 50, tiles 58, one 10 px pitch)", badp.length === 0, J(badp.map((l) => [l, q(l)])));
  check("phone: the plate at the mock's (12, 40, 369, 792) CSS px, the logo 18 px into the plate's header, the card's slot ~ (24, 285, 345, 337)", nearR(css(Q.plate, s), { x: 12, y: 40, w: 369, h: 792 }, 1.2) && near(css(Q.logo, s).y, 70, 0.6) && nearR(css(Q.card, s), { x: 24, y: 285.36, w: 345, h: 336.64 }, 1.5), J([css(Q.plate, s), css(Q.card, s)]));
}
/* ICE and CROWN wear the JUNGLE layout exactly: the probe's rects in three worlds */
{
  for (const b of ["d1366", "p393"]) {
    const rects = [1, 2, 8].map((lv) => { probe.setOn(true); frame(BOX[b], UI({ level: lv })); const s = probe.snapshot(); probe.setOn(false); return s.rects; });
    const same = rects[1].length === rects[0].length && rects.slice(1).every((R) => R.every((r, i) => r.name === rects[0][i].name && nearR(r, rects[0][i], 2)));
    check(`ICE and CROWN rects equal JUNGLE's within 2 px (${b}, ${rects[0].length} rects)`, same && rects[0].length >= 8, J(rects.map((R) => R.length)));
  }
}
/* sizes: the mock's plate keeps its size and centres; a narrower window narrows only the card's column; the iso guard and #c scale as one piece */
{
  const g = (b) => P.menuGeom(BOX[b]), a = g("d1366"), w = g("d1920"), n = g("d1024"), k4 = P.menuGeom({ W: 3840, H: 2160, touch: false, shell: true, css: 1 });
  check("1920x1080 and 3840x2160: the mock's plate (1060 x 567.36) centred, 70 from the top, nothing stretched", [w, k4].every((G) => near(G.plate.w, 1060, 0.01) && near(G.plate.h, 567.36, 0.01) && near(G.plate.x, (G.W - 1060) / 2, 0.01) && near(G.plate.y, 70, 0.01) && G.u === 1 && G.rows.PLAY.w === 480));
  check("1024x768: no scale (u 1), the list keeps 480, the card's column narrows (>= 360)", n.u === 1 && n.rows.PLAY.w === 480 && n.card.w >= 360 && n.card.w < a.card.w && n.plate.x >= 26, J([n.u, n.card.w, n.plate]));
  check("600x520 board and 608x352 iso: the desk geometry scaled as one piece (u < 1)", g("c600").u < 1 && g("iso").u < 1 && g("c600").mode === "desk" && g("iso").mode === "desk", J([g("c600").u, g("iso").u]));
}
/* every rect inside the plate, the plate's ring inside the box, on the six boxes (and touch #c, landscape tablet) */
for (const b of [...SIX, "c600t", "l1024"]) {
  const G = P.menuGeom(BOX[b]), T = G.T, ring = { x: G.plate.x - T - 2 * G.u, y: G.plate.y - T - 2 * G.u, w: G.plate.w + 2 * T + 4 * G.u, h: G.plate.h + 2 * T + 5 * G.u };
  const out = ITEMS.filter((l) => !inside({ x: G.rows[l].x - 6 * G.u, y: G.rows[l].y - 6 * G.u, w: G.rows[l].w + 12 * G.u, h: G.rows[l].h + 12 * G.u }, G.plate));
  const lb = { x: G.lbox.x * G.lk, y: G.lbox.y * G.lk, w: G.lbox.w * G.lk, h: G.lbox.h * G.lk }, P0 = G.rows.PLAY;
  check(`inside (${b}): every row and its focus ring inside the plate, the plate's ring inside the box${G.foot ? ", the foot too" : ""}; the logo's box inside the plate, clear of PLAY's ring`, out.length === 0 && inside(ring, { x: 0, y: 0, w: G.W, h: G.H }) && (!G.foot || inside(G.foot, { x: 0, y: 0, w: G.W, h: G.H })) && inside(lb, G.plate) && lb.y + lb.h <= P0.y - 6 * G.u && inside(G.card, G.plate), J({ out, ring, W: G.W, H: G.H, foot: G.foot, lb }));
}
/* touch targets >= 44 CSS px with >= 8 px gaps, on the touch boxes that have a shell box */
for (const b of ["p393", "l1024"]) {
  const G = P.menuGeom(BOX[b]), s = BOX[b].css, R = ITEMS.map((l) => css(G.rows[l], s));
  const small = R.filter((r) => r.w < 43.95 || r.h < 43.95);
  let gap = Infinity;
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i], c = R[j], dx = Math.max(c.x - (a.x + a.w), a.x - (c.x + c.w)), dy = Math.max(c.y - (a.y + a.h), a.y - (c.y + c.h)); gap = Math.min(gap, Math.max(dx, dy)); }
  check(`touch (${b}): every row >= 44 x 44 CSS px, >= 8 px apart`, small.length === 0 && gap >= 8 - 1e-9, J({ small, gap }));
}

/* ---- hit: the centre of every drawn row is that row; off the rows is -1 ---- */
for (const b of [...SIX, "c600t", "l1024"]) {
  const G = P.menuGeom(BOX[b]), F = BOX[b];
  const bad = ITEMS.filter((l, i) => P.menuHit(G.rows[l].x + G.rows[l].w / 2, G.rows[l].y + G.rows[l].h / 2, F) !== i);
  const off = [[2, 2], [G.W - 2, G.H - 2], [G.card.x + G.card.w / 2, G.card.y + G.card.h / 2], [G.logo.x + G.logo.w / 2, G.logo.y + G.logo.h / 2], [G.plate.x + G.plate.w / 2, G.plate.y + 4 * G.u]].filter(([x, y]) => P.menuHit(x, y, F) !== -1);
  const L = md.layout(F.W, F.H, F.shell ? 200 : undefined, F.css);
  check(`hit (${b}): each row's centre taps it; the card's slot, the logo, the plate's top and off the plate are -1; menudraw.menuHit agrees`, bad.length === 0 && off.length === 0 && ITEMS.every((l, i) => md.menuHit(G.rows[l].x + 2, G.rows[l].y + 2, L, 7, F.touch) === i), J({ bad, off }));
  const gaps = ITEMS.slice(0, -1).every((l, i) => { const r = G.rows[l], nx = G.rows[ITEMS[i + 1]]; if (G.mode !== "desk") return true; const yMid = (r.y + r.h + nx.y) / 2; return P.menuHit(r.x + 10, yMid - 0.5, F) === i && P.menuHit(r.x + 10, yMid + 0.5, F) === i + 1; });
  check(`hit (${b}): a row owns half of each gap beside it (no dead gutter between rows)`, gaps);
}

/* ---- taps through the real mountPointer: desktop and landscape with a shell box, the phone's #sh, the board canvas with none ---- */
{
  const { mountPointer } = await import("../src/app/pointer.js");
  const sc = await import("../src/render/scenes.js");
  const HIT = { overlayBox: sc.overlayBox, pauseHit: sc.pauseHit, touchLay: sc.touchLay, controlsHit: SV.controlsHit, dims: SV.dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, recTabHit: md.recTabHit, layout: md.layout };
  const el = (w, h, rect, lay) => { const L = {}; return { width: w, height: h, style: {}, ownerDocument: { body: { getAttribute: (k) => (k === "data-lay" ? lay : null) } }, getBoundingClientRect: () => rect, addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, fire(t, ev) { (L[t] || []).slice().forEach((f) => f(ev)); } }; };
  const g = shellGeo(393, 852);
  const CASES = [
    ["desktop #sh 1366x768", "d", 1366, 768, { left: 0, top: 0, width: 1366, height: 768 }, true],
    ["landscape #sh 1024x768", "l", 1024, 768, { left: 0, top: 0, width: 1024, height: 768 }, true],
    ["phone #sh 393x852", "p", g.w, g.h, { left: 0, top: 0, width: g.w * g.s, height: g.h * g.s }, true],
    ["board #c 600x520 (no shell box, scaled x0.5)", "l", 600, 520, { left: 10, top: 20, width: 300, height: 260 }, false],
  ];
  for (const [nm, lay, w, h, rect, shell] of CASES) {
    const cv = el(600, 520, shell ? { left: 0, top: 0, width: 600, height: 520 } : rect, lay), sh = shell ? el(Math.round(w * 2), Math.round(h * 2), rect, lay) : null;
    const box = shell ? { width: w, height: h, logo: 200, ownerDocument: sh.ownerDocument, getBoundingClientRect: () => rect } : null;
    const app = createMenuApp({ settings: {} }), opened = [];
    app.screen = SCREEN.MENU;
    app.confirm = function () { opened.push(this.cursor); };
    mountPointer({ canvas: cv, fit: shell ? { sh, box: () => box } : null, input: { _intent: { fire: false }, onUiKey() {} }, app, world: { state: "PLAY" }, kind: () => "2d", ctl: () => null, hit: HIT });
    const tgt = shell ? sh : cv, kx = rect.width / w, ky = rect.height / h;
    const L = md.layout(w, h, shell ? 200 : undefined, shell ? rect.width / w : undefined), G = md.menuGeom(L, 7, lay !== "d");
    for (const l of ITEMS) { const r = G.rows[l]; tgt.fire("pointerdown", { clientX: rect.left + (r.x + r.w / 2) * kx, clientY: rect.top + (r.y + r.h / 2) * ky, currentTarget: tgt }); }
    check(`tap (${nm}): the centre of every drawn row opens that row (Enter on it)`, J(opened) === J(ITEMS.map((_, i) => i)), J(opened));
    opened.length = 0;
    for (const [x, y] of [[1, 1], [G.card.x + G.card.w / 2, G.card.y + G.card.h / 2], [G.logo.x + G.logo.w / 2, G.logo.y + G.logo.h / 2]]) tgt.fire("pointerdown", { clientX: rect.left + x * kx, clientY: rect.top + y * ky, currentTarget: tgt });
    check(`tap (${nm}): off the plate, the card's slot and the logo do nothing (a root list)`, opened.length === 0 && app.screen === SCREEN.MENU, J(opened));
  }
}
/* the band: a focused door's band rect is the geometry's row rect, in the paint and in the probe */
{
  for (const b of ["d1366", "p393"]) for (const foc of ["DAILY", "SOURCE"]) {
    fresh(); probe.setOn(true);
    frame(BOX[b], UI({ focus: foc }), { dpr: 2 });
    const s = probe.snapshot(); probe.setOn(false);
    const band = s.pairs.find((q) => q.kind === "band"), fr = s.rects.find((r) => r.focus), G = P.menuGeom(BOX[b]);
    check(`band (${b}, ${foc} focused): the recorded focus rect and the band pair's rect equal the geometry's ${foc} rect`, !!band && nearR(band.a, G.rows[foc], 1e-9) && fr && fr.name === foc && nearR(fr, G.rows[foc], 1e-9), J([band && band.a, fr]));
  }
}

/* ---- paint: focus, one yellow, no cord or spark colours, drawn whole ---- */
/* the page's own layer canvases (the room, the plate, the foot verbs), each with its box-unit origin and scale, so a layer paint maps back into the box */
const pageCvs = () => { const S = P._dbg.last.S, out = []; if (S.room) out.push({ cv: S.room, b: { x: 0, y: 0, w: P._dbg.last.G.W, h: P._dbg.last.G.H } }); if (S.plate) out.push({ cv: S.plate, b: S.pb }); for (const q of S.feet || []) if (S.foot[q.v]) out.push({ cv: S.foot[q.v], b: q.b }); return out; };
const back = (q, L) => (q && { x: L.b.x + q.x * L.b.w / L.cv.width, y: L.b.y + q.y * L.b.h / L.cv.height, w: q.w * L.b.w / L.cv.width, h: q.h * L.b.h / L.cv.height });
logo._dbg.on = true;
{
  for (const b of ["d1366", "p393", "c600"]) {
    fresh();
    for (const foc of ITEMS) {
      const F = BOX[b], G = P.menuGeom(F), f = frame(F, UI({ focus: foc })), k = G.rows[foc], u = G.u;
      const ring = f.t.paints.filter((p) => p.op === "stroke" && String(p.style).toLowerCase() === CONST.ink && p.lw === 3);
      const exp = { x: k.x - 4.5 * u, y: k.y - 4.5 * u, w: k.w + 9 * u, h: k.h + 9 * u }; // the stroke's centre line: 3 px wide, 3 px off the key
      check(`focus ${foc} (${b}): one 3 px cream ring, offset 3 px, round the focused key`, ring.length === 1 && nearR(ring[0].box, exp, 0.6 * u + 0.01), J(ring.map((p) => p.box)) + " want " + J(exp));
      const tok = worldTokens(1), bandFill = f.t.paints.filter((p) => p.op === "fill" && p.style === tok.band);
      check(`focus ${foc} (${b}): ${foc === "PLAY" ? "no band (the yellow key)" : "the band on the focused door, its rect the geometry's"}`, foc === "PLAY" ? bandFill.length === 0 : bandFill.length === 1 && nearR(bandFill[0].box, k, 0.01), J(bandFill.map((p) => p.box)));
    }
  }
}
{
  fresh();
  for (const b of ["d1366", "p393"]) for (const lv of [1, 2, 8]) {
    logo._dbg.last = null;
    const f = frame(BOX[b], UI({ level: lv, best: 9640, daily: 2 })), Ls = pageCvs(), k = P.menuGeom(BOX[b]).rows.PLAY;
    const yel = (r, L) => r.paints.filter((p) => (p.op === "fill" || p.op === "fillRect") && String(p.style).toLowerCase() === CONST.yel).map((p) => (L ? back(p.box, L) : p.box));
    const fills = [...yel(f.t.r || f.t), ...Ls.flatMap((L) => yel(L.cv.r, L))];
    check(`one yellow fill (${b}, level ${lv}): only PLAY's face (at rest in the plate layer, focused live: the same key)`, fills.length >= 1 && fills.every((q) => q && inside(q, k, 0.6)), J(fills));
    const BAN = [CONST.cord, CONST.cord2, CONST.cor].map((x) => x.toLowerCase()), rs = [f.t, ...Ls.map((L) => L.cv.r)];
    const hits = [...rs.flatMap((r) => r.paints.map((p) => String(p.style).toLowerCase())), ...rs.flatMap((r) => r.texts.map((t) => String(t.fill).toLowerCase()))].filter((x) => BAN.includes(x));
    check(`no cord (#ff9d5a, #b8582a) and no spark coral on the page (its canvases and its live paints; the logo's own layers excepted) (${b}, level ${lv})`, hits.length === 0, J(hits));
  }
}
/* the longest strings MENU can show, drawn whole at text scale 1 and 1.25 (recorder width +8 %), inside their keys and the plate */
{
  const RUNS = [{}, { heat: 2, pace: 1, pact: 15, time: true }, { heat: 1, pace: -1, pact: 0 }, { heat: 0, pace: 0, pact: 1 }];
  for (const ts of [1, 1.25]) for (const b of ["d1366", "p393", "l1024", "d1024"]) for (const run of RUNS) for (const [daily, best] of [[null, null], [12, 1234567]]) {
    setTextScale(ts); fresh();
    const F = BOX[b], G = P.menuGeom(F), f = frame(F, UI({ run, daily, best, level: 8 })), texts = [f.t, ...pageCvs().map((L) => L.cv.r)].flatMap((r) => r.texts);
    const ell = texts.filter((t) => /…/.test(t.s));
    const tl = P._dbg.last.P.rows.PLAY.tag, tag = tl && P.playTags({ run, level: 8 }).includes(tl.lines.join(" ")) && tl.lines.every((q) => texts.some((t) => t.s === q));
    const want = b === "p393" ? null : "NEW · TODAY'S BOARD";
    check(`drawn whole (${b}, x${ts}, run ${J(run)}, daily ${daily}): no ellipsis; PLAY's tag is one whole candidate${want && daily == null ? "; " + want : ""}`, ell.length === 0 && !!tag && (!want || daily != null || texts.some((t) => t.s === want)), J({ ell: ell.map((t) => t.s), tags: P.playTags({ run, level: 8 }), drawn: texts.map((t) => t.s) }));
    const last = P._dbg.last, outs = [];
    for (const l of ITEMS) {
      const o = last.P.rows[l], r = o.r;
      const spans = o.k === "main" ? [[o.word.foc, o.word.foc + o.word.w], o.tag && [o.tag.x - o.tag.w, o.tag.x], o.cap && [o.cap.x, o.cap.x + o.cap.w]].filter(Boolean) : [[o.foc.x, o.foc.x + o.label.w], ...(o.tz ? o.tz.lines.map((s) => o.tz.align === "right" ? [o.tz.x - o.tz.w, o.tz.x] : [o.tz.fx, o.tz.fx + o.tz.w]) : [])];
      for (const [x0, x1] of spans) if (x0 < r.x + 2 || x1 > r.x + r.w - 2) outs.push(l + " " + x0.toFixed(1) + ".." + x1.toFixed(1));
      if (o.k !== "main" && o.tz && o.tz.align === "right" && o.foc.x + o.label.w + 12 > o.tz.x - o.tz.w + 0.01) outs.push(l + ": label meets its teaser");
      if (o.k === "main" && o.tag && o.word.foc + o.word.w + 12 > o.tag.x - o.tag.w + 0.01) outs.push("PLAY meets its tag");
    }
    check(`every word inside its key, label never meets value, focused or not (${b}, x${ts}, ${J(run)})`, outs.length === 0, outs.join(" | "));
  }
  setTextScale(1);
}
/* every key reads label first, keycap last: PLAY's word before its ENTER cap; each foot prompt's word before its caps */
{
  fresh();
  for (const [dev, words] of [["key", null], ["pad", wordsOf("pad", DEF_CONTROLS)]]) {
    setHints(words);
    frame(BOX.d1366, UI());
    const S = P._dbg.last.P, k = S.rows.PLAY, F = S.foot[W.MENU_WORDS.START];
    const order = [];
    let word = null;
    for (const p of F.parts) { if (p.t) word = p; else if (p.cap) order.push(word && word.x + word.w <= p.x); }
    check(`label left of keycap (${dev}): PLAY before its ${k.cap && k.cap.s} cap; the foot's ${F.parts.filter((p) => p.cap).length} caps each after their word`, !!k.cap && k.word.foc + k.word.w < k.cap.x && order.length >= 2 && order.every(Boolean), J(F.parts.map((p) => p.t || p.sep || J(p.cap))));
    check(`foot words (${dev}): MOVE then ${W.MENU_WORDS.START}, the build tag after a bar`, F.parts.some((p) => p.t === W.MENU_WORDS.MOVE) && F.parts.some((p) => p.t === "v201") && F.parts.some((p) => p.sep === "|"));
  }
  setHints(null);
  frame(BOX.l1024, UI());
  const S = P._dbg.last.P;
  check("touch landscape: no keycaps; the foot says TAP A ROW and the build tag", !S.rows.PLAY.cap && S.verbs.length === 1 && S.foot[""].parts.some((p) => p.t === W.MENU_WORDS.TAP) && !S.foot[""].parts.some((p) => p.cap));
  frame(BOX.p393, UI());
  const Q = P._dbg.last.P;
  check("phone: no keycaps, no foot; SOURCE's teaser is the build tag (the mock's phone frame)", !Q.rows.PLAY.cap && Q.verbs.length === 0 && Q.rows.SOURCE.tz && Q.rows.SOURCE.tz.lines[0] === "v201");
  frame(BOX.d1366, UI({ pad: "CONTROLLER READY" }));
  check("a controller's arrival: the foot carries CONTROLLER READY · SETTINGS › CONTROLS and the build tag", P._dbg.last.P.foot[""].parts.some((p) => p.t === "CONTROLLER READY · SETTINGS › CONTROLS") && P._dbg.last.P.foot[""].parts.some((p) => p.t === "v201"));
  frame(BOX.p393, UI({ note: "NO SOUND YET · PRESS A KEY OR TAP" }));
  check("phone: the sound note rides SOURCE's teaser, stepped down to fit", /^NO SOUND YET/.test(P._dbg.last.P.rows.SOURCE.tz.lines[0]));
}
/* teasers keep today's facts: DAILY new or today's tries, RECORDS only played runs, SETTINGS the art style, GUIDE its pages; units unspaced (none here) */
{
  frame(BOX.d1366, UI({ daily: 2, best: 9640, look: 2 }));
  const R = P._dbg.last.P.rows, tz = (l) => R[l].tz && R[l].tz.lines.join(" ");
  check("teasers (desktop): DAILY YOUR TRIES TODAY · 2, RECORDS BEST 9,640 (+ NORMAL DIFFICULTY where it fits), SETTINGS REAL 3D, GUIDE 4 PAGES, SOURCE GITHUB", tz("DAILY") === "YOUR TRIES TODAY · 2" && /^BEST 9,640( · NORMAL DIFFICULTY)?$/.test(tz("RECORDS")) && tz("SETTINGS") === "REAL 3D" && tz("GUIDE") === "4 PAGES" && tz("SOURCE") === "GITHUB", J(ITEMS.map(tz)));
  frame(BOX.d1366, UI());
  const S = P._dbg.last.P.rows;
  check("teasers (desktop, nothing played): DAILY NEW · TODAY'S BOARD, RECORDS NO RUNS YET, PLAY LEVEL 1 · JUNGLE", S.DAILY.tz.lines[0] === "NEW · TODAY'S BOARD" && S.RECORDS.tz.lines[0] === "NO RUNS YET" && J(S.PLAY.tag.lines) === J(["LEVEL 1 · JUNGLE"]));
  frame(BOX.p393, UI({ daily: 2 }));
  const Q = P._dbg.last.P.rows;
  check("teasers (phone): DAILY TRIES TODAY · 2 or TRIES · 2, RECORDS NO RUNS YET, no LEVEL SELECT teaser", /^TRIES( TODAY)? · 2$/.test(Q.DAILY.tz.lines.join(" ")) && Q.RECORDS.tz.lines[0] === "NO RUNS YET" && !Q["LEVEL SELECT"].tz);
  check("PLAY's tag: a default run names LEVEL n · WORLD; otherwise only what differs (tagFor), then its modifier count", J(P.playTags({ level: 3, run: {} })) === J(["LEVEL 3 · FACTORY"]) && P.playTags({ level: 3, run: { heat: 2, pace: 1, pact: 1 } })[0] === "EXPERT DIFFICULTY · FAST SPEED · ONE LIFE" && P.playTags({ level: 3, run: { pact: 15 } }).includes("4 MODIFIERS"));
}

/* ---- the frame: static parts cached, a steady frame blits, a cursor move never misses ---- */
{
  const hashOf = (r) => { const s = J(r.calls); let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(16) + ":" + r.calls.length; };
  const ctx = rec({ widthK: K8 });
  ctx.ctx.setTransform(2, 0, 0, 2, 0, 0);
  const one = (ui, t) => { const n0 = ctx.calls.length, m0 = cache._dbg.misses, s0 = ctx.calls.filter((c) => c.op === "measureText").length; P.drawMenuPage(ctx.ctx, BOX.d1366, ui, t); const calls = ctx.calls.slice(n0); return { calls, miss: cache._dbg.misses - m0, measure: calls.filter((c) => c.op === "measureText").length, hash: hashOf({ calls }) }; };
  fresh();
  const cold = one(UI(), 0.5), a = one(UI(), 0.5), b = one(UI(), 0.5);
  check("a cold frame fills the room, the plate, both foot verbs and the logo's layers", cold.miss >= 5, cold.miss);
  check("two steady frames: equal call-log hashes, 0 cache misses, <= 400 canvas calls, <= 20 measureText", a.hash === b.hash && a.miss === 0 && b.miss === 0 && a.calls.length <= 400 && a.measure <= 20, J({ a: a.hash, b: b.hash, miss: [a.miss, b.miss], calls: a.calls.length, measure: a.measure }));
  const moves = ITEMS.map((l) => one(UI({ focus: l }), 0.5));
  check("a cursor move (every row focused in turn) causes 0 misses and stays <= 400 calls", moves.every((m) => m.miss === 0 && m.calls.length <= 400), J(moves.map((m) => [m.miss, m.calls.length])));
  const w2 = one(UI({ level: 2 }), 0.5), w2b = one(UI({ level: 2 }), 0.5);
  check("a world change (LEVEL SELECT moved app.level) refills once: misses on the first frame, none on the next", w2.miss > 0 && w2b.miss === 0, J([w2.miss, w2b.miss]));
  setTextScale(1.25);
  const t1 = one(UI({ level: 2 }), 0.5), t2 = one(UI({ level: 2 }), 0.5);
  setTextScale(1);
  check("a text-scale change refills once", t1.miss > 0 && t2.miss === 0, J([t1.miss, t2.miss]));
  const steady = one(UI(), 0.5);
  check("the steady frame only blits (the room, the plate, one foot, the logo) and draws the focused row live: no plate() rail or bed loop", steady.calls.filter((c) => c.op === "drawImage").length >= 4 && steady.calls.filter((c) => c.op === "fillRect").length < 20, J(steady.calls.filter((c) => c.op === "drawImage").length));
  fresh();
  cache.release();
  const after = one(UI(), 0.5);
  check("after cache.release() the next frame refills (a cold fill, no blank frame: the room is blitted)", after.miss >= 4 && after.calls.some((c) => c.op === "drawImage" && c.a[1] === 0 && c.a[2] === 0 && c.a[3] === 1366 && c.a[4] === 768), after.miss);
}
/* the first MENU frame's backdrop is opaque: the room at alpha 1 over the whole box; the plate fades in over 0.25 s */
{
  fresh();
  const r = rec({ widthK: K8 }), alphas = [];
  const c = new Proxy(r.ctx, { get: (t, k) => (k === "drawImage" ? (...a) => { alphas.push([t.globalAlpha, a.slice(1)]); return t.drawImage(...a); } : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
  P.drawMenuPage(c, BOX.d1366, UI({ enterT: 0 }), 0);
  check("first MENU frame: the room blitted first, opaque (alpha 1) over the whole box; the plate drawn at alpha 0 (it fades in, not the backdrop)", J(alphas[0]) === J([1, [0, 0, 1366, 768]]) && alphas[1][0] === 0, J(alphas.slice(0, 2)));
  const room = made.find((cv) => cv.width === Math.round(1366 * cv.width / 1366) && cv.r.paints.some((p) => p.op === "fillRect" && p.box && p.box.w >= cv.width - 1 && p.box.h >= cv.height - 1 && p.alpha === 1));
  check("the room layer starts with one opaque fill of the whole layer (no hole for the board to show through)", !!room);
}

/* ---- the cache: recency touch and the 24 MB budget beside the title's layers ---- */
{
  fresh();
  const K = (n) => ({ layer: "t" + n, biome: "", level: 0, W: 1, H: 1, dpr: 1, look: "2d", textScale: 1 });
  const big = 6 * 1024 * 1024 / 4, held = cache.layer(K("held"), big, 1, () => {});
  for (let i = 0; i < 2; i++) cache.layer(K("stale" + i), big, 1, () => {});
  let evictedHeld = false, staleLeft = true;
  for (let i = 0; i < 6; i++) { cache.touch(K("held")); cache.layer(K("new" + i), big, 1, () => {}); if (!held.width) evictedHeld = true; }
  check("touch(): a layer a painter blits each frame without asking layer() is never evicted while a stale one exists", !evictedHeld && held.width > 0, cache._dbg.bytes);
  check("touch() answers whether the key is live, by key object or keyOf string", cache.touch(K("held")) === true && cache.touch(cache.keyOf(K("held"))) === true && cache.touch(K("gone")) === false);
  void staleLeft;
}
{
  fresh();
  const t = rec({ widthK: K8 });
  t.ctx.setTransform(3, 0, 0, 3, 0, 0);
  const tb = md.titleLogoBox(600, 520, "p");
  logo.drawLogo2d(t.ctx, { level: 1, place: "title", box: tb.box, cy: tb.cy, dev: "p", dpr: 3, touch: true, t: 0 });
  const titleW = logo._dbg.last.world, titleBytes = cache._dbg.bytes;
  const sh = rec({ widthK: K8 });
  sh.ctx.setTransform(2.7, 0, 0, 2.7, 0, 0);
  let peak = 0, gone = [];
  for (let i = 0; i < 3; i++) {
    P.drawMenuPage(sh.ctx, BOX.p393, UI(), i * 0.1);
    peak = Math.max(peak, cache._dbg.bytes);
    const S = P._dbg.last;
    void S;
  }
  const L = logo._dbg.last;
  gone = [L.world, L.spark].filter((c) => !c || !c.width);
  check("phone: the title's layers present, MENU's layers arrive: the cache stays <= 24 MB and nothing MENU shows is evicted (the title's layers go)", peak <= cache.BUDGET && gone.length === 0 && titleW.width === 0, J({ titleBytes, peak, gone: gone.length, titleKept: titleW.width }));
}
/* the page's own layer bytes (report): desktop 1366x768 and 2560x1440 at dpr 2, the phone */
{
  const bytesFor = (F, dpr) => { fresh(); const n0 = made.length; const t = rec({ widthK: K8 }); t.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); logo._dbg.last = null; P.drawMenuPage(t.ctx, F, UI(), 0); const L = logo._dbg.last || {}; const mine = made.slice(n0).filter((c) => c !== L.world && c !== L.spark && c !== L.atlas && c.width); return { page: mine.reduce((n, c) => n + c.width * c.height * 4, 0), total: cache._dbg.bytes, sizes: mine.map((c) => c.width + "x" + c.height) }; };
  const R = { "1366x768@2": bytesFor(BOX.d1366, 2), "2560x1440@2": bytesFor({ W: 2560, H: 1440, touch: false, shell: true, css: 1 }, 2), "phone 393x852@3": bytesFor(BOX.p393, 2.7) };
  console.log("  NOTE page layer bytes " + J(R));
  check("every box's page + logo layers stay inside the 24 MB budget", Object.values(R).every((r) => r.total <= cache.BUDGET), J(R));
}

/* ---- covered: one predicate, MENU only today; main passes it to the renderer ---- */
{
  check("shellCovers: MENU covers; GAME, LEVEL, SETTINGS, INTRO and ATTRACT do not (each page task adds its screen)", SV.shellCovers(SCREEN.MENU) && ![SCREEN.GAME, SCREEN.LEVEL, SCREEN.SETTINGS, SCREEN.INTRO, SCREEN.ATTRACT, SCREEN.GUIDE].some(SV.shellCovers));
  const { createGame } = await import("../src/main.js");
  const ctx = rec().ctx;
  const g = createGame({ getContext: () => ctx, addEventListener() {}, style: {}, width: 600, height: 520 }, { seed: 7 });
  const seen = [];
  const r0 = g.renderer, raw = r0.render.bind(r0);
  r0.render = (w, dt, o) => { seen.push({ screen: g.app.screen, covered: !!(o && o.covered) }); return raw(w, dt, o); };
  g.app.cabinetSeen = true; g.app.skip();
  g.loop(16); g.loop(32);
  const menuF = seen.filter((s) => s.screen === SCREEN.MENU);
  g.app.cursor = 0; g.app.confirm(); g.loop(48); g.loop(64);
  const gameF = seen.filter((s) => s.screen === SCREEN.GAME);
  check("main: a MENU frame calls render with covered:true, a GAME frame does not", menuF.length > 0 && menuF.every((s) => s.covered) && gameF.length > 0 && gameF.every((s) => !s.covered), J(seen));
  g.stop();
}

/* ---- the probe record the gates read; the menu row's exemptions ---- */
{
  for (const b of ["d1366", "p393"]) {
    fresh(); probe.setOn(true);
    frame(BOX[b], UI(), { dpr: 2 });
    const s = probe.snapshot(); probe.setOn(false);
    const rows = s.rects.filter((r) => ITEMS.includes(r.name)), G = P.menuGeom(BOX[b]), foc = rows.filter((r) => r.focus);
    check(`probe (${b}): begin menu on ${BOX[b].shell ? "sh" : "c"}; a rect for every row, touch on touch layouts, one focused (PLAY), PLAY's fill #ffd447`, s.page === "menu" && s.box.el === "sh" && rows.length === 7 && rows.every((r) => !!r.touch === BOX[b].touch) && foc.length === 1 && foc[0].name === "PLAY" && rows.find((r) => r.name === "PLAY").fill === "#ffd447" && !s.fault, J({ page: s.page, n: rows.length, fault: s.fault }));
    check(`probe (${b}): the focused rect equals the geometry's focused-row rect; the plate rect with its ring width`, nearR(foc[0], G.rows.PLAY, 1e-9) && s.rects.some((r) => r.name === "plate" && r.plate === G.T));
    const kinds = new Set(s.pairs.map((p) => p.kind)), texts = s.texts.map((t) => t.s);
    check(`probe (${b}): band, ring and info pairs; a text for every row label and teaser, each with its colour`, kinds.has("band") && kinds.has("ring") && kinds.has("info") && ITEMS.every((l) => texts.includes(l)) && s.texts.every((t) => !!t.col), J([...kinds]));
  }
  const m = SCREENS.menu;
  check("screens.mjs menu row: exempts chosen and locked with a reason each; needs band, ring, info, text, cap, inside, plate, yellow, touch, gap", J(Object.keys(m.exempt).sort()) === J(["chosen", "locked"]) && Object.values(m.exempt).every((v) => v.length > 10) && ["band", "ring", "info", "text", "cap", "inside", "plate", "yellow", "touch", "gap"].every((g) => m.need.includes(g)));
}

/* ---- the source: no filters, no pixel reads, imports ---- */
{
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/render/pages/menu.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  check("pages/menu.js: no ctx.filter, shadowBlur, shadowColor, getImageData or toDataURL", !/\.filter\s*=|shadowBlur|shadowColor|getImageData|putImageData|toDataURL/.test(src));
  const imps = [...src.matchAll(/from\s+"([^"]+)"/g)].map((x) => x[1]);
  check("pages/menu.js imports no src/app, board3, vendor or three", imps.length > 5 && !imps.some((p) => /\/app\/|board3|vendor|three/.test(p)), J(imps));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
