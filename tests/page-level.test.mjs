/* UI upgrade v202 Task 3.3: LEVEL SELECT on the world kit (src/render/pages/level.js). One geometry for draw and tap (rects by name), the round 7
   S7-menu d-03 / p-03 frames' metrics (desktop 1366 x 768 at 1 box unit per CSS px; phone 393 x 852 in CSS px on the PORT_SHELL box), the touch
   floors on every touch box, the focus (a row's band and bare bomb; START, a door key or a list entry's 3 px cream ring), one yellow fill, the level
   keys (finale flags, wall-locked 6-8), the banks, the MODIFIERS door and its inline list reachable by key, controller and tap, the one next-run card
   with BEST, the longest strings whole at text scale 1 and 1.25, the cached static parts (0 misses on a steady frame or a focus move, one refill on a
   level change), the room's dpr floors in the 24 MiB budget beside MENU's layers, the covered render flag, tap mode (ruling 4: a key or a controller
   leaves it, a tap re-enters it) and the probe record the gates read. Every canvas is a textrec stub. */
import { rec } from "./lib/textrec.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
const K8 = 0.6 * 1.08;
const made = [];
class Cv { constructor(w, h) { this.width = w; this.height = h; this.r = rec({ widthK: K8 }); made.push(this); } getContext() { return this.r.ctx; } }
globalThis.OffscreenCanvas = Cv;
const cache = await import("../src/render/kit/cache.js");
cache.setFactory((w, h) => new Cv(w, h));
const P = await import("../src/render/pages/level.js");
const MP = await import("../src/render/pages/menu.js");
const C = await import("../src/render/pages/card.js");
const md = await import("../src/render/menudraw.js");
const W = await import("../src/render/words.js");
const { setTextScale } = await import("../src/render/kit/type.js");
const { worldTokens, CONST } = await import("../src/render/kit/tokens.js");
const probe = await import("../src/render/kit/probe.js");
const { ITEMS, SCREEN, LEVEL_ROWS, createMenuApp } = await import("../src/app/menuapp.js");
const { shellGeo, fitBox } = await import("../src/app/fit.js");
const { setHints } = await import("../src/render/hintcopy.js");
const { wordsOf } = await import("../src/app/hints.js");
const { DEF_CONTROLS } = await import("../src/app/controls.js");
const SV = await import("../src/render/shellview.js");
const { SCREENS } = await import("../tools/ui/lib/screens.mjs");
const { PACT } = await import("../src/core/pact.js");
const { FOES } = await import("../src/core/entities.js");

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
for (const [w, h] of [[1024, 600], [800, 600], [600, 520], [1280, 650]]) BOX["l" + w + "x" + h] = { W: w, H: h, touch: true, shell: true, css: 1 };
for (const [w, h] of [[852, 393], [932, 430], [740, 360], [667, 375]]) BOX["c" + w + "x" + h] = { W: 600, H: 520, touch: true, shell: false, css: fitBox(w, h, true, 600, 520).s };
const SHORT = ["l1024x600", "l800x600", "l600x520", "l1280x650"], LAND = ["c852x393", "c932x430", "c740x360", "c667x375"], TOUCHB = ["p393", "l1024", ...SHORT, ...LAND, "c600t"];
const SIX = ["d1366", "d1920", "d1024", "p393", "c600", "iso"], ALLB = [...SIX, "c600t", "l1024", ...SHORT, ...LAND];
const [N_LEVEL, N_DIFF, N_SPEED, N_MODS, N_START] = LEVEL_ROWS;
const UI = (o) => ({ level: 1, heat: 0, pace: 0, pact: 0, time: false, unlocked: true, best: null, row: N_LEVEL, open: false, cur: -1, trig: -1, tap: false, enterT: 9, ...o });
const near = (a, b, e = 0.51) => Math.abs(a - b) <= e;
const nearR = (a, b, e) => !!a && !!b && near(a.x, b.x, e) && near(a.y, b.y, e) && near(a.w, b.w, e) && near(a.h, b.h, e);
const inside = (a, b, e = 0.01) => a.x >= b.x - e && a.y >= b.y - e && a.x + a.w <= b.x + b.w + e && a.y + a.h <= b.y + b.h + e;
const css = (r, s) => ({ x: r.x * s, y: r.y * s, w: r.w * s, h: r.h * s });
const ctr = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const gap = (a, c) => Math.max(c.x - (a.x + a.w), a.x - (c.x + c.w), c.y - (a.y + a.h), a.y - (c.y + c.h));
function frame(F, ui, o = {}) {
  const t = rec({ widthK: K8 });
  if (o.dpr) t.ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  const n0 = made.length, m0 = cache._dbg.misses;
  P.drawLevelPage(o.c || t.ctx, F, ui, o.t || 0);
  return { t, cvs: made.slice(n0), miss: cache._dbg.misses - m0 };
}
const fresh = () => { cache.release(); cache._dbg.misses = 0; };
/* every tap target of a geometry, with the hit it must give */
const targets = (G) => [...(G.pageKeys || []).flatMap((r, i) => { const dir = i ? 1 : -1, p = G.page + dir; return p >= 0 && p < G.pages ? [[r, "page", dir]] : []; }), ...G.room.map((r, i) => [r, i < G.cap ? "room" : "lock", i]), ...G.heat.map((r, i) => [r, "heat", i]), ...G.pace.map((r, i) => [r, "pace", i]), ...(G.mods ? [[G.mods, "mods"]] : []), ...G.mode.map((r, i) => [r, "mode", i]), [G.start, "start"], ...(G.back ? [[G.back, "back"]] : [])];

/* ---- rows and words ---- */
check("rows: pages/level.js LV is menuapp LEVEL_ROWS (LEVEL, DIFFICULTY, GAME SPEED, MODIFIERS, START)", J(Object.values(P.LV)) === J(LEVEL_ROWS));
check("the list: the four modifier names in MOD_BITS order, then TIME TRIAL (the Digit1-5 order)", J(P.ENTRIES) === J(["ONE LIFE", "NO FLOOR ITEMS", "FEWER ITEMS", "SHRINK", "TIME TRIAL"]));
check("menudraw delegates: levelGeom, levelHit and drawLevelSelect reach pages/level.js; LEVEL_TAP / LEVEL_TAP_LIST are the page's", md.LEVEL_TAP === P.LEVEL_TAP && md.LEVEL_TAP_LIST === P.LEVEL_TAP_LIST && J(md.levelGeom(md.layout(1366, 768, 200), true, false).rows) === J(P.levelGeom(BOX.d1366, { unlocked: true }).rows));
check("the old painter is gone from menudraw (roomCard, schem, heroRoom, chip, segs, capCell, levelNarrow, floorLine, heatLine)", !md.schem && !md.floorLine && !md.heatLine && typeof md.setupVals === "function");

/* ---- the mock's metrics (round 7 S7-menu d-03 / p-03, CSS px) ---- */
{
  const G = P.levelGeom(BOX.d1366, { unlocked: true }), d = G.d;
  check("desktop 1366x768: the plate 1110 wide, centred (x 128); the list column 640 at x 150, a row 64 tall, pitch 74 (row 64 + gap 10)", near(G.S.w, 1110, 0.01) && near(G.S.x, 128, 0.01) && near(G.rows[N_LEVEL].x, 150, 0.01) && G.rows[N_LEVEL].w === 640 && G.rows[N_LEVEL].h === 64 && near(G.rows[N_DIFF].y - G.rows[N_LEVEL].y, 74, 0.01) && near(G.rows[N_MODS].y - G.rows[N_SPEED].y, 74, 0.01), J([G.S, G.rows[N_LEVEL]]));
  const k = G.room;
  check("desktop: 8 level keys 48 x 44, 6 apart, right-aligned 12 in from the row's end, centred in the LEVEL row", k.every((r) => r.w === 48 && r.h === 44) && k.every((r, i) => !i || near(r.x - (k[i - 1].x + 48), 6, 1e-9)) && near(k[7].x + 48, 150 + 640 - 12, 1e-9) && near(k[0].y + 22, G.rows[N_LEVEL].y + 32, 1e-9), J(k[0]));
  check("desktop: the banks' cells 112 x 36 in a 3 px frame, 4 apart, right-aligned like the keys", G.heat.every((r) => near(r.w, 112, 1e-9) && r.h === 36) && near(G.heat[2].x + 112 + 3, 778, 1e-9) && near(G.pace[1].x - G.pace[0].x, 116, 1e-9), J(G.heat));
  check("desktop: the card's column 404 wide at x 812, START 74 tall under it (16 over), the foot under the plate", near(G.pane.x, 812, 0.01) && near(G.pane.w, 404, 0.01) && G.start.h === 74 && near(G.start.y - (G.pane.y + G.pane.h), 16, 1e-9) && G.foot.y > G.S.y + G.S.h, J([G.pane, G.start, G.foot]));
  check("desktop: the MODIFIERS door is its row; the list's region is reserved under it, open or shut (opening it moves nothing)", nearR(G.mods, G.rows[N_MODS], 1e-9) && J(P.levelGeom(BOX.d1366, { unlocked: true, open: true }).rows) === J(G.rows) && G.list.y >= G.mods.y + G.mods.h);
  setTextScale(1.25);
  const H = P.levelGeom(BOX.d1366, { unlocked: true });
  setTextScale(1);
  check("desktop at 125 %: the plate 1220 wide, the list column 700, rows 58, level keys 50 wide, bank cells 140, START 84", near(H.S.w, 1220, 0.01) && H.rows[N_LEVEL].w === 700 && H.rows[N_LEVEL].h === 58 && H.room[0].w === 50 && near(H.heat[0].w, 140, 1e-9) && H.start.h === 84, J([H.S, H.rows[N_LEVEL]]));
  const Q = P.levelGeom(BOX.p393, { unlocked: true }), s = BOX.p393.css, q = (r) => css(r, s);
  check("phone 393x852: the plate at (12, 20, 369, 812) CSS px, BACK 117 x 44 in its head, 4 x 2 level keys 46 tall 10 apart across 345", nearR(q(Q.S), { x: 12, y: 20, w: 369, h: 812 }, 1.2) && near(q(Q.back).w, 117, 0.6) && near(q(Q.back).h, 44, 0.6) && near(q(Q.room[0]).h, 46, 0.6) && near(q(Q.room[4]).y - q(Q.room[0]).y, 56, 0.6) && near(q(Q.room[3]).x + q(Q.room[3]).w - q(Q.room[0]).x, 345, 1.2), J([q(Q.S), q(Q.room[0])]));
  check("phone: the banks 50 tall across the column, the door 52, START 66 at the plate's foot, the card's slot between (>= 234 CSS px)", near(q(Q.heat[0]).h, 44, 0.6) && near(q(Q.mods).h, 52, 0.6) && near(q(Q.start).h, 66, 0.6) && near(q(Q.start).y + q(Q.start).h, 820, 1.2) && q(Q.pane).h >= 234 && Q.pane.y > Q.mods.y + Q.mods.h && Q.start.y > Q.pane.y + Q.pane.h, J([q(Q.mods), q(Q.pane), q(Q.start)]));
}
/* ICE and CROWN wear the JUNGLE layout exactly */
for (const b of ["d1366", "p393"]) {
  const rects = [1, 2, 8].map((lv) => { probe.setOn(true); frame(BOX[b], UI({ level: lv })); const s = probe.snapshot(); probe.setOn(false); return s.rects.filter((r) => !/^(card|lane|foe|tile|stats|text|finale)/.test(r.name)); });
  const same = rects.slice(1).every((R) => R.length === rects[0].length && R.every((r, i) => r.name === rects[0][i].name && nearR(r, rects[0][i], 1e-9)));
  check(`ICE and CROWN page rects equal JUNGLE's (${b}, ${rects[0].length} rects)`, same && rects[0].length >= 16, J(rects.map((R) => R.length)));
}
/* sizes: the plate keeps its size and centres; a narrower window narrows only the card's column; #c and the iso guard scale as one piece */
{
  const g = (b) => P.levelGeom(BOX[b], { unlocked: true }), w = g("d1920"), n = g("d1024");
  check("1920x1080: the mock's plate (1110) centred at u 1", near(w.S.w, 1110, 0.01) && near(w.S.x, (1920 - 1110) / 2, 0.01) && w.u === 1);
  check("1024x768: the columns give way before the page scales (lane lessons: desk floors bind 1024x768): u 1, the card's column >= 360 (its slot then taller), the list column >= 572", n.u === 1 && n.d.pane.w >= 360 - 1e-9 && n.d.pane.h >= 380 - 1e-9 && n.rows.LEVEL.w >= 572 - 1e-9, J([n.u, n.d.pane, n.rows.LEVEL.w]));
  check("600x520 and the 608x352 iso guard: the desk scaled as one piece", g("c600").u < 1 && g("iso").u < 1 && g("c600").lay === "desk" && g("iso").lay === "desk", J([g("c600").u, g("iso").u]));
}
/* the desk text floors bind ordinary windows (lane lessons, 2026-11-11): 1366x768, 1366x657, 1280x720 and 1024x768 at text 1 and 1.25 keep primary
   >= 14 / secondary >= 11 px cap height (system sans 700: 0.705 em) and body >= 17.9 px, and the plate inside the window */
{
  const out = [];
  for (const ts of [1, 1.25]) for (const [w, h] of [[1366, 768], [1366, 657], [1280, 720], [1024, 768]]) {
    setTextScale(ts);
    const G = P.levelGeom({ W: w, H: h, touch: false, shell: true, css: 1 }, { unlocked: true }), u = G.u, cap = (px) => px * ts * 0.705 * u;
    if (cap(21) < 14 - 1e-9 || cap(16) < 11 - 1e-9 || 18 * ts * u < 17.9 - 1e-9 || G.S.y - G.T < 0 || G.foot.y + G.foot.h > h) out.push(w + "x" + h + " x" + ts + " u " + u.toFixed(3) + " give " + G.d.give);
  }
  setTextScale(1);
  check("desk text floors at 1366x768, 1366x657, 1280x720, 1024x768 (text 1 and 1.25): the margins, kicker and columns give way first; no floor broken", out.length === 0, out.join(" | "));
}
/* inside: every target, its focus mark and the card inside the plate; the plate's ring inside the box; the foot in the box; open and shut */
for (const b of ALLB) for (const U of [false, true]) for (const open of U ? [false, true] : [false]) {
  const G = P.levelGeom(BOX[b], { unlocked: U, open }), T = G.T, u = G.u, ring = { x: G.S.x - T - 2 * u, y: G.S.y - T - 2 * u, w: G.S.w + 2 * T + 4 * u, h: G.S.h + 2 * T + 5 * u };
  const out = [...targets(G).map(([r, k, i]) => [{ x: r.x - 6 * u, y: r.y - 6 * u, w: r.w + 12 * u, h: r.h + 12 * u }, k + (i ?? "")]), ...LEVEL_ROWS.filter((l) => G.rows[l]).map((l) => [G.rows[l], l]), ...(G.pane ? [[G.pane, "card"]] : []), ...(G.list ? [[G.list, "list"]] : [])].filter(([r]) => !inside(r, G.S));
  check(`inside (${b}${U ? ", offered" : ""}${open ? ", list open" : ""}, ${G.lay}): every target and its ring, every band, the card and the list inside the plate; the ring and the foot inside the box`, out.length === 0 && inside(ring, { x: 0, y: 0, w: G.W, h: G.H }) && (!G.foot || inside(G.foot, { x: 0, y: 0, w: G.W, h: G.H })), J({ out: out.map((o) => o[1]), ring }));
}
/* touch targets >= 44 CSS px; between targets of two rows >= 8 (a course, a bank and the list are one set each, their members' own gaps exempt) */
{
  const sizes = {};
  for (const ts of [1, 1.25]) for (const b of TOUCHB) for (const open of [false, true]) {
    setTextScale(ts);
    for (const row of open ? [N_MODS] : [N_LEVEL, N_DIFF, N_SPEED]) {
    const G = P.levelGeom(BOX[b], { unlocked: true, open, row }), s = BOX[b].css, T = targets(G).filter(([, k]) => !(open && G.mode.length && G.d.mode === "compact" && /room|lock|heat|pace/.test(k))).map(([r, k, i]) => ({ r: css(r, s), set: k === "lock" ? "room" : k, i }));
    const small = T.filter((t) => t.r.w < 43.95 || t.r.h < 43.95);
    let g0 = Infinity;
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (T[i].set !== T[j].set) g0 = Math.min(g0, gap(T[i].r, T[j].r));
    sizes[b + (open ? " open" : "")] = G.lay + " min " + Math.min(...T.map((t) => Math.min(t.r.w, t.r.h))).toFixed(1) + " gap " + g0.toFixed(1);
    if (row !== N_LEVEL && G.pages === 1) continue; // one page: the LEVEL row's geometry is the page
    check(`touch (${b}${ts > 1 ? " x1.25" : ""}${open ? ", list open" : ""}, ${G.lay}${G.pages > 1 ? ", page " + (G.page + 1) + " of " + G.pages : ""}): every target >= 44 x 44 CSS px, targets of two rows >= 8 apart`, small.length === 0 && g0 >= 8 - 1e-9, J({ small: small.map((t) => t.set + t.i + " " + t.r.w.toFixed(1) + "x" + t.r.h.toFixed(1)), g0 }));
    }
  }
  setTextScale(1);
  console.log("  NOTE touch LEVEL SELECT in CSS px " + J(sizes));
  const mode = (b) => P.levelGeom(BOX[b], { unlocked: true }).lay;
  check("arrangement: the portrait phone is the phone column; the landscape phones, 800x600 and 600x520 go compact; the landscape tablet and the keyboard boxes keep the desk", mode("p393") === "phone" && LAND.every((b) => mode(b) === "compact") && mode("l800x600") === "compact" && mode("l600x520") === "compact" && mode("l1024") === "desk" && SIX.filter((b) => b !== "p393").every((b) => mode(b) === "desk"), J(Object.fromEntries(Object.keys(BOX).map((b) => [b, mode(b)]))));
}

/* ---- hit: the centre of every target is that target; off the plate backs out; the card and the head are inert ---- */
for (const b of ALLB) for (const U of [false, true]) for (const open of U ? [false, true] : [false]) {
  const F = BOX[b], o = { unlocked: U, open }, G = P.levelGeom(F, o);
  const bad = targets(G).filter(([r, k, i]) => { const h = P.levelHit(...ctr(r), F, o); return h.k !== k || (i != null && h.i !== i); }).filter(([, k]) => !(open && G.d.mode === "compact" && /room|lock|heat|pace/.test(k)));
  const inert = [...(G.pane && !(open && G.d.mode === "phone") ? [ctr(G.pane)] : []), [G.S.x + G.S.w / 2, G.S.y + 2 * G.u]].filter(([x, y]) => P.levelHit(x, y, F, o).k !== "none");
  const off = [[1, 1], [G.W - 1, G.H - 1]].filter(([x, y]) => P.levelHit(x, y, F, o).k !== "back");
  const L = md.layout(F.W, F.H, F.shell ? 200 : undefined, F.css), dg = targets(G).every(([r, k]) => md.levelHit(...ctr(r), L, U, F.touch, open).k === k || (open && G.d.mode === "compact" && /room|lock|heat|pace/.test(k)));
  check(`hit (${b}${U ? ", offered" : ""}${open ? ", list open" : ""}): every target's centre taps it; the card and the plate's head are inert; off the plate backs out; menudraw.levelHit agrees`, bad.length === 0 && inert.length === 0 && off.length === 0 && dg, J({ bad: bad.map(([, k, i]) => k + (i ?? "")), inert, off }));
}
{
  const F = BOX.d1366, G = P.levelGeom(F, { unlocked: false });
  check("before the first CLEAR: keys 6-8 tap as lock (never a selection), MODIFIERS has no row and no door", [5, 6, 7].every((i) => P.levelHit(...ctr(G.room[i]), F, { unlocked: false }).k === "lock") && G.rows[N_MODS] === null && G.mods === null && G.mode.length === 0);
  const g = P.levelGeom(F, { unlocked: true }), half = (g.room[1].x - g.room[0].x - g.room[0].w) / 2;
  check("a key owns half the gap beside it (no dead gutter in the course)", P.levelHit(g.room[0].x + g.room[0].w + half - 0.01, g.room[0].y + 4, F, { unlocked: true }).i === 0 && P.levelHit(g.room[0].x + g.room[0].w + half + 0.01, g.room[0].y + 4, F, { unlocked: true }).i === 1);
}

/* ---- the modifier toggles: by key, by controller (tests/keys.test.mjs T14 + the open list's SOUTH), by tap ---- */
const HITS = async () => { const sc = await import("../src/render/scenes.js"); return { overlayBox: sc.overlayBox, pauseHit: sc.pauseHit, touchLay: sc.touchLay, controlsHit: SV.controlsHit, dims: SV.dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, recTabHit: md.recTabHit, layout: md.layout }; };
{
  const a = createMenuApp({ pactUnlocked: true });
  a.screen = SCREEN.MENU; a.cursor = ITEMS.indexOf("LEVEL SELECT"); a.confirm();
  a.key("Digit1"); a.key("Digit4"); a.key("Digit5");
  check("keys: 1, 4 and 5 toggle ONE LIFE, SHRINK and TIME TRIAL from any row", a.pact === (PACT.LAST | PACT.SHRINK) && a.timeAttack === true, J([a.pact, a.timeAttack]));
  a.levelRow = LEVEL_ROWS.indexOf(N_MODS); a.key("Enter"); a.key("ArrowDown"); a.key("Enter");
  check("keys: Enter on MODIFIERS opens the list, ↓ then Enter toggles NO FLOOR ITEMS", a.modOpen && a.modeCur === 1 && (a.pact & PACT.BARE) !== 0, J([a.modOpen, a.modeCur, a.pact]));
}
{
  const { mountPointer } = await import("../src/app/pointer.js");
  const HIT = await HITS();
  const el = (w, h, rect, lay) => { const L = {}; return { width: w, height: h, style: {}, ownerDocument: { body: { getAttribute: (k) => (k === "data-lay" ? lay : null) } }, getBoundingClientRect: () => rect, addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, fire(t, ev) { (L[t] || []).slice().forEach((f) => f(ev)); } }; };
  for (const [nm, lay, w, h, s, shell] of [["desktop #sh 1366x768", "d", 1366, 768, 1, true], ["phone #sh", "p", PG.w, PG.h, PG.s, true], ["landscape phone #c 852x393", "l", 600, 520, fitBox(852, 393, true, 600, 520).s, false]]) {
    const rect = { left: 0, top: 0, width: w * s, height: h * s }, cv = el(600, 520, shell ? { left: 0, top: 0, width: 600, height: 520 } : rect, lay), sh = shell ? el(Math.round(w * 2), Math.round(h * 2), rect, lay) : null;
    if (!shell) cv.css = s;
    const box = shell ? { width: w, height: h, logo: 200, css: s, ownerDocument: sh.ownerDocument, getBoundingClientRect: () => rect } : null;
    const app = createMenuApp({ pactUnlocked: true, settings: {} });
    app.screen = SCREEN.MENU; app.cursor = ITEMS.indexOf("LEVEL SELECT"); app.confirm();
    mountPointer({ canvas: cv, fit: shell ? { sh, box: () => box } : null, input: { _intent: { fire: false }, onUiKey: (k) => app.key(k) }, app, world: { state: "PLAY" }, kind: () => "2d", ctl: () => null, hit: HIT });
    const tgt = shell ? sh : cv, F = { W: w, H: h, touch: lay !== "d", shell, css: lay !== "d" ? s : 1 };
    const tap = (r) => tgt.fire("pointerdown", { clientX: (r.x + r.w / 2) * s, clientY: (r.y + r.h / 2) * s, currentTarget: tgt });
    const geo = (o = {}) => P.levelGeom(F, { unlocked: true, row: LEVEL_ROWS[app.levelRow], open: app.modOpen, ...o });
    for (let n = 0; n < 4 && !geo().mods; n++) tap(geo().pageKeys[1]); // a paged compact: the page keys bring MODIFIERS' page (its first row focused)
    tap(geo().mods);
    const G = geo();
    check(`tap (${nm}): the MODIFIERS door opens the list (the row focused)`, app.modOpen === true && app.levelRow === LEVEL_ROWS.indexOf(N_MODS), J([app.modOpen, app.levelRow]));
    for (let i = 0; i < 5; i++) tap(G.mode[i]);
    check(`tap (${nm}): each list entry toggles its modifier (ONE LIFE, NO FLOOR ITEMS, FEWER ITEMS, SHRINK, TIME TRIAL), the list cursor on the last tapped`, app.pact === 15 && app.timeAttack === true && app.modeCur === 4, J([app.pact, app.timeAttack, app.modeCur]));
    if (G.mods) tap(G.mods); else tgt.fire("pointerdown", { clientX: 1, clientY: 1, currentTarget: tgt }); // the door, or (a paged compact: the list covers it) off the plate
    check(`tap (${nm}): the door again (or off the plate) closes the list`, app.modOpen === false && app.screen === SCREEN.LEVEL);
    const G2 = geo();
    if (G2.back) { tap(G2.back); check(`tap (${nm}): BACK leaves for MENU`, app.screen === SCREEN.MENU); }
  }
}

/* ---- paint: focus, one yellow, the kit ring, no cord ---- */
const pageCvs = () => { const S = P._dbg.last.S, out = []; if (S.roomL && S.roomL.cv) out.push({ cv: S.roomL.cv, b: S.roomL.b }); for (const q of Object.values(S.L)) if (q.cv) out.push({ cv: q.cv, b: q.b }); return out; };
const back = (q, L) => q && { x: L.b.x + q.x * L.b.w / L.cv.width, y: L.b.y + q.y * L.b.h / L.cv.height, w: q.w * L.b.w / L.cv.width, h: q.h * L.b.h / L.cv.height };
/* the focused part's paints in box units: LEVEL's from its focus layer, every other part's live on the target (drawn under scale(u)) */
const focusPaints = (f) => { const L = P._dbg.last; if (L.foc === N_LEVEL) { const q = L.S.L.focL; return q.cv.r.paints.map((p) => ({ ...p, box: back(p.box, { cv: q.cv, b: q.b }) })); } return f.t.paints; };
{
  for (const b of ["d1366", "p393", "c852x393"]) for (const row of LEVEL_ROWS) for (const open of row === N_MODS ? [false, true] : [false]) {
    fresh();
    const F = BOX[b], G = P.levelGeom(F, { unlocked: true, open, row }), f = frame(F, UI({ row, open, cur: open ? 2 : -1 })), tok = worldTokens(1), ps = focusPaints(f);
    const ring = ps.filter((p) => p.op === "stroke" && String(p.style).toLowerCase() === CONST.ink && p.lw === 3).map((p) => p.box);
    const bandF = ps.filter((p) => p.op === "fill" && p.style === tok.band).map((p) => p.box);
    const k = open ? G.mode[2] : G.rows[row], u = G.u, key = open || row === N_START || (row === N_MODS && G.d.mode !== "desk");
    const exp = { x: k.x - 4.5 * u, y: k.y - 4.5 * u, w: k.w + 9 * u, h: k.h + 9 * u };
    if (key) check(`focus ${open ? "list entry 2" : row} (${b}): one 3 px cream ring, offset 3, round the focused key`, ring.length === 1 && nearR(ring[0], exp, 0.6 * u + 0.05), J(ring) + " want " + J(exp));
    else check(`focus ${row} (${b}): the row's band (its rect = rows[${row}]) and no ring`, ring.length === 0 && bandF.length >= 1 && nearR(bandF[0], G.rows[row], 0.3), J([ring, bandF[0], G.rows[row]]));
  }
}
{
  fresh();
  for (const b of ["d1366", "p393"]) for (const lv of [1, 2, 8]) for (const row of [N_LEVEL, N_START]) {
    const f = frame(BOX[b], UI({ level: lv, row, best: "0:38.4" })), Ls = pageCvs(), k = P.levelGeom(BOX[b], { unlocked: true }).start;
    const yel = (r, L) => r.paints.filter((p) => (p.op === "fill" || p.op === "fillRect") && String(p.style).toLowerCase() === CONST.yel).map((p) => (L ? back(p.box, L) : p.box));
    const fills = [...yel(f.t.r || f.t), ...Ls.flatMap((L) => yel(L.cv.r, L))];
    check(`one yellow fill (${b}, level ${lv}, ${row}): only START's face`, fills.length >= 1 && fills.every((q) => q && inside(q, k, 0.6)), J(fills));
    const BAN = [CONST.cord, CONST.cord2, CONST.cor].map((x) => x.toLowerCase()), rs = [f.t, ...Ls.map((L) => L.cv.r)];
    const hits = [...rs.flatMap((r) => r.paints.map((p) => String(p.style).toLowerCase())), ...rs.flatMap((r) => r.texts.map((t) => String(t.fill).toLowerCase()))].filter((x) => BAN.includes(x));
    check(`no cord and no coral on the page (${b}, level ${lv})`, hits.length === 0, J(hits));
  }
}
/* the level keys: the chosen one lit, the rest wells, a flag on 5 and 8, 6-8 wall keys with a lock until offered */
{
  for (const U of [false, true]) {
    fresh(); frame(BOX.d1366, UI({ level: 3, unlocked: U }));
    const K = P._dbg.last.P.keys.filter((q) => q.set === "level");
    check(`level keys (${U ? "offered" : "before the first CLEAR"}): 3 lit, ${U ? "the rest wells" : "1, 2, 4, 5 wells, 6-8 wall keys with a lock"}; flags on 5 and 8 only`, K[2].kind === "lit" && K.every((q, i) => i === 2 || q.kind === (!U && i >= 5 ? "wall" : "well")) && K.every((q, i) => q.fin === (i === 4 || i === 7)) && K.every((q, i) => q.lock === (!U && i >= 5)), J(K.map((q) => q.kind)));
  }
}

/* ---- words: the card with BEST, the CROWN copy, the door teaser, START's tag, the foot, units ---- */
{
  fresh(); frame(BOX.d1366, UI({ best: "0:38.4" }));
  const card = P._dbg.last.P.card, ts = card.texts.map((t) => t.s);
  check("card: LEVEL SELECT's is the one card (cardPlan) with BEST in place of the level's mark", ts.includes("✓ BEST 0:38.4") && ts.includes("NEXT RUN · LEVEL 1") && !ts.includes("YOUR FIRST LEVEL"), J(ts));
  frame(BOX.d1366, UI({ unlocked: true }));
  check("card: no saved time once TIME is open reads NO TIME YET", P._dbg.last.P.card.texts.some((t) => t.s === "NO TIME YET"));
  frame(BOX.d1366, UI({ unlocked: false }));
  check("card: before TIME is open, no time claim (no BEST, no NO TIME YET; the level's mark where it fits)", !P._dbg.last.P.card.texts.some((t) => /TIME|BEST/.test(t.s)));
  const c = rec({ widthK: K8 }).ctx, bad = [];
  for (let lv = 1; lv <= 8; lv++) for (let h = 0; h < 3; h++) {
    const ros = C.rosterOf(lv, h), each = ros.length === FOES.length && ros.every((e) => e.n === 1), P1 = C.cardPlan(c, { x: 0, y: 0, w: 502, h: 420 }, { level: lv, heat: h }, "d"), says = P1.texts.some((t) => t.s === W.CARD_WORDS.ALL_EACH);
    if (says !== each) bad.push([lv, h, says]);
  }
  check("CROWN copy (ruling 3): YOU'LL MEET reads ALL NINE · ONE OF EACH exactly where the roster is every foe kind once (level 8 at NORMAL), on MENU's card and LEVEL SELECT's", bad.length === 0 && W.CARD_WORDS.ALL_EACH === "ALL NINE · ONE OF EACH", J(bad));
  fresh(); frame(BOX.d1366, UI({ level: 8, unlocked: true }));
  const lc = P._dbg.last.P.card.texts.map((t) => t.s);
  MP.drawMenuPage(rec({ widthK: K8 }).ctx, { W: 1366, H: 768, touch: false, shell: true, css: 1 }, { rows: ITEMS, focus: "PLAY", level: 8, run: { heat: 0 }, enterT: 9 }, 0);
  const mc = MP._dbg.last.P.card.texts.map((t) => t.s);
  check("CROWN copy on both pages' cards (level 8, NORMAL)", lc.includes("ALL NINE · ONE OF EACH") && mc.includes("ALL NINE · ONE OF EACH"), J([lc, mc]));
}
{
  check("door teaser: the names that are on, then their count; NONE with none; the phone the count", J(P.doorTeasers({ pact: PACT.LAST | PACT.SHRINK, time: true })) === J(["ONE LIFE · SHRINK · TIME TRIAL", "3 ON"]) && J(P.doorTeasers({ pact: 0 })) === J(["NONE"]) && J(P.doorTeasers({ pact: PACT.BARE }, true)) === J(["1 ON"]));
  check("door teaser: a controller's TRIGGER cursor with the list shut names its entry and state", J(P.doorTeasers({ pact: PACT.THIN, trig: 2 })) === J(["FEWER ITEMS · ON"]) && J(P.doorTeasers({ pact: 0, trig: 4 })) === J(["TIME TRIAL · OFF"]));
  check("START's tag: each setting named (never a bare NORMAL), then the modifier count, then EXPERT bare; DEFAULT RULES for a default run", J(P.startTags({ heat: 1, pace: 1, pact: PACT.LAST | PACT.SHRINK, time: true })) === J(["HARD DIFFICULTY · FAST SPEED · ONE LIFE · SHRINK · TIME TRIAL", "HARD DIFFICULTY · FAST SPEED · 2 MODIFIERS · TIME TRIAL"]) && J(P.startTags({})) === J(["DEFAULT RULES"]) && P.startTags({ heat: 2, pact: 15 }).includes("EXPERT · 4 MODIFIERS"));
  const kw = wordsOf("key", DEF_CONTROLS), pw = wordsOf("pad", DEF_CONTROLS);
  check("foot (keys): label first, keycap last, by the focus: ROW ↑↓ · CHANGE ←→ · START ENTER · BACK ESC; MODIFIERS OPEN; START no CHANGE; the list PICK / TOGGLE / CLOSE",
    P.footText(P.footItems(N_LEVEL, false, kw)) === "ROW ↑↓ · CHANGE ←→ · START ENTER · BACK ESC" && P.footText(P.footItems(N_MODS, false, kw)) === "ROW ↑↓ · OPEN ENTER · BACK ESC" && P.footText(P.footItems(N_START, false, kw)) === "ROW ↑↓ · START ENTER · BACK ESC" && P.footText(P.footItems(N_MODS, true, kw)) === "PICK ↑↓ · TOGGLE ENTER · CLOSE ESC");
  check("foot (controller): the controller's words", P.footText(P.footItems(N_DIFF, false, pw)) === "ROW D-PAD · CHANGE D-PAD · START SOUTH · BACK EAST" && P.footText(P.footItems(N_MODS, true, pw)) === "PICK D-PAD · TOGGLE SOUTH · CLOSE EAST");
  check("help: the level's sentence, a modifier's in the list; units unspaced (25s, 2.3s)", P.helpOf({ level: 3, unlocked: true }) === "Level 3 of 8. Levels 5 and 8 end in a finale." && P.helpOf({ level: 3, unlocked: false }) === "Level 3 of 8. Clear level 5 to open 6 to 8." && P.helpOf({ open: true, cur: 3 }) === "Walls close in from 25s." && !/\d s\b/.test(W.LEVEL_WORDS.MOD_HELP.join(" ")));
}
/* label left of keycap: START's word before its ENTER cap; each foot prompt's word before its caps */
{
  for (const [dev, words] of [["keys", null], ["controller", wordsOf("pad", DEF_CONTROLS)]]) {
    setHints(words); fresh(); frame(BOX.d1366, UI({ row: N_DIFF }));
    const L = P._dbg.last, st = L.P.start, F = L.P.foot.value, order = [];
    let word = null;
    for (const p of F.parts) { if (p.t) word = p; else if (p.cap) order.push(!!word && word.x + word.w <= p.x); }
    check(`label left of keycap (${dev}): START before its ${st.cap && st.cap.s} cap; the foot's caps each after their word`, !!st.cap && st.word.foc + st.word.w < st.cap.x && order.length >= 4 && order.every(Boolean), J(F.parts.map((p) => p.t || p.sep || J(p.cap))));
  }
  setHints(null);
  frame(BOX.l1024, UI({ tap: true }));
  check("touch landscape (tap mode): no keycaps; the foot is the tap rule", !P._dbg.last.P.start.cap && P._dbg.last.verb === "tap" && P._dbg.last.P.foot.tap.parts[0].t === P.LEVEL_TAP);
  frame(BOX.l1024, UI({ tap: true, open: true, cur: 0, row: N_MODS }));
  check("touch landscape, the list open: TAP OUTSIDE TO CLOSE", P._dbg.last.P.foot.taplist.parts[0].t === P.LEVEL_TAP_LIST && P.LEVEL_TAP_LIST === "TAP START TO PLAY · TAP OUTSIDE TO CLOSE");
  frame(BOX.p393, UI({ tap: true }));
  check("phone: no keycaps, no foot (the BACK key)", !P._dbg.last.P.start.cap && P._dbg.last.verb === null && !!P._dbg.last.P.back);
}
/* a controller on a touch layout keeps a cue line (lane lessons 2026-11-11): the phone and compact have no foot, so their reserved line under the
   card (phone) or START (compact) names the controls, label first, keycap word last, stepping down by whole items to fit; keys or touch: none */
{
  const bad = [];
  for (const ts of [1, 1.25]) for (const b of ["p393", "c852x393", "c667x375", "c600t"]) for (const [dev, words] of [["pad", wordsOf("pad", DEF_CONTROLS)], ["touch", wordsOf("touch", DEF_CONTROLS)]]) {
    setTextScale(ts); setHints(words); fresh();
    for (const row of [N_LEVEL, N_MODS]) {
      const f = frame(BOX[b], UI({ row })), cue = P._dbg.last.P.cue, G = P._dbg.last.G, items = P.footItems(row, false, words);
      const ok = dev === "pad" ? !!cue && f.t.texts.some((t) => t.s === cue.s) && items.map((it) => P.footText([it])).some((w) => cue.s.includes(w)) && cue.s.includes("BACK " + words.back) && cue.w <= G.d.cue.w + 0.01 : !cue;
      if (!ok) bad.push(b + " x" + ts + " " + dev + " " + row + " " + (cue && cue.s));
    }
  }
  setTextScale(1); setHints(null);
  check("a controller's cue line on the phone and compact (BACK EAST at least; whole items, inside its line); none for keys or touch", bad.length === 0, bad.join(" | "));
}
/* the longest strings drawn whole at text scale 1 and 1.25, inside their parts and the plate */
{
  const RUNS = [{}, { heat: 2, pace: 1, pact: 15, time: true }, { heat: 1, pace: -1, pact: 0 }, { heat: 0, pace: 0, pact: 1 }];
  for (const ts of [1, 1.25]) for (const b of ["d1366", "p393", "l1024", "d1024", "l1024x600", "l600x520", "c852x393", "c667x375", "c600", "iso"]) for (const run of RUNS) for (const [open, best] of [[false, null], [true, "12:38.4"]]) {
    setTextScale(ts); fresh();
    const F = BOX[b], f = frame(F, UI({ ...run, level: 8, open, cur: 1, row: open ? N_MODS : N_LEVEL, best })), L = P._dbg.last, texts = [f.t, ...pageCvs().map((Q) => Q.cv.r)].flatMap((r) => r.texts);
    const ell = texts.filter((t) => /…/.test(t.s)), outs = [];
    const st = L.P.start;
    /* START's tag is one whole candidate or dropped (the banks and the door beside it show the run): never cut */
    if (st.tag && !P.startTags({ ...run }).some((s) => s === st.tag.lines.join(" · ") || s === st.tag.lines.join(" "))) outs.push("START tag " + J(st.tag && st.tag.lines));
    if (st.tag && st.word.foc + st.word.w + 12 > st.tag.x - st.tag.w + 0.01) outs.push("START meets its tag");
    if (st.tag && st.tag.x > st.r.x + st.r.w - 2) outs.push("START tag out");
    for (const q of L.P.keys) { const x0 = q.center ? q.x - q.w / 2 : q.x, x1 = x0 + q.w; if (x0 < q.r.x + 2 || x1 > q.r.x + q.r.w - 2) outs.push(q.set + " " + q.s); }
    for (const q of L.P.list) q.ws.forEach((w, i) => { if (q.r.x + 8 + 30 + w > q.r.x + q.r.w - 2) outs.push("entry " + q.lines[i]); });
    const mo = L.P.rows[N_MODS];
    if (mo && mo.tz && mo.label.fx + mo.label.w + 12 > mo.tz.x - mo.tz.w + 0.01) outs.push("MODIFIERS meets its teaser");
    if (L.G.lay !== "compact" && (!mo || !mo.tz)) outs.push("MODIFIERS teaser dropped"); // compact's half-width door drops it (the open list names them)
    for (const l of [N_LEVEL, N_DIFF, N_SPEED]) { if (!L.P.rows[l]) continue; /* a paged compact: another page, checked below */ const lab = L.P.rows[l].label, r = L.G.d.rows[l]; if (lab.fx + lab.w > r.x + r.w - 2) outs.push(l + " label out"); }
    if (L.G.d.labels === "left") for (const [l, k] of [[N_LEVEL, L.G.d.room[0]], [N_DIFF, L.G.d.heatB], [N_SPEED, L.G.d.paceB]]) { const lab = L.P.rows[l].label; if (lab.x + lab.w + 12 > k.x) outs.push(l + " label meets its control"); }
    if (L.P.card && L.P.card.over) outs.push("card over");
    if (L.P.title.x + L.P.title.w > L.G.d.plate.x + L.G.d.plate.w) outs.push("title out");
    check(`drawn whole (${b}, x${ts}, ${J(run)}${open ? ", list open" : ""}): no ellipsis; every legend inside its key; no label meets its value; the card fits its slot`, ell.length === 0 && outs.length === 0, J({ ell: ell.map((t) => t.s), outs }));
  }
  setTextScale(1);
}
/* a paged compact (the least landscape phones): every page drawn whole, each group's legends inside their keys and its label inside its band, at 1
   and 1.25; the page keys >= 44 CSS px; every row on exactly one page; the open list's keys >= 44 CSS px over the head and the groups */
{
  const outs = [], seen = {};
  for (const ts of [1, 1.25]) for (const b of [...LAND, "c600t", "l600x520", "l800x600"]) {
    setTextScale(ts); fresh();
    const F = BOX[b], s = F.css, G0 = P.levelGeom(F, { unlocked: true, row: N_LEVEL });
    seen[b + " x" + ts] = G0.pages;
    const all = [];
    for (let p = 0; p < G0.pages; p++) {
      const row = G0.d.pages[p][0], G = P.levelGeom(F, { unlocked: true, row });
      frame(F, UI({ row, heat: 2, pace: 1 }));
      const L = P._dbg.last;
      all.push(...G0.d.pages[p]);
      if (G.page !== p) outs.push(b + " page " + p + " not shown for " + row);
      for (const q of L.P.keys) { const x0 = q.center ? q.x - q.w / 2 : q.x; if (x0 < q.r.x + 2 || x0 + q.w > q.r.x + q.r.w - 2) outs.push(b + " " + q.set + " " + q.s); }
      for (const l of G0.d.pages[p]) { const lab = L.P.rows[l].label, r = G.d.rows[l]; if (lab.fx + lab.w > r.x + r.w - 2) outs.push(b + " " + l + " label out"); }
      if (G.pageKeys && G.pageKeys.some((r) => r.w * s < 43.95 || r.h * s < 43.95)) outs.push(b + " page keys small");
    }
    if (J([...all].sort()) !== J([N_LEVEL, N_DIFF, N_SPEED, ...(G0.pages > 1 ? [N_MODS] : [])].sort())) outs.push(b + " rows " + J(all)); // paged, MODIFIERS is a page's group
    const O = P.levelGeom(F, { unlocked: true, open: true, row: N_MODS });
    if (O.mode.some((r) => r.w * s < 43.95 || r.h * s < 43.95 || (O.pageKeys || []).some((k) => gap(r, k) * s < 8 - 1e-6) || gap(r, O.start) * s < 8 - 1e-6) || O.back || (G0.pages > 1 && O.mods)) outs.push(b + " open list");
  }
  setTextScale(1);
  console.log("  NOTE compact pages " + J(seen));
  check("a paged compact: every page drawn whole, every row on one page, the page keys and the open list's keys >= 44 CSS px, the list 8 clear of the page keys and START (BACK and the page's door under it)", outs.length === 0 && Object.values(seen).some((n) => n > 1), outs.slice(0, 8).join(" | "));
}
/* the card never overflows its slot: 8 levels x 3 heats x pact 0 / 15 x BEST, every box with a card, both text scales */
{
  const c = rec({ widthK: K8 }).ctx, bad = [];
  for (const ts of [1, 1.25]) for (const b of ["d1366", "d1920", "d1024", "p393", "l1024", "l1024x600", "l1280x650", "c600", "iso"]) {
    setTextScale(ts);
    const G = P.levelGeom(BOX[b], { unlocked: true });
    if (!G.d.pane) continue;
    for (let lv = 1; lv <= 8; lv++) for (let h = 0; h < 3; h++) for (const pact of [0, 15]) for (const best of ["", "✓ BEST 12:38.4"]) if (C.cardPlan(c, G.d.pane, { level: lv, heat: h, pact, best }, G.d.dev).over) bad.push([b, ts, lv, h, pact, best]);
  }
  setTextScale(1);
  check("the card's slot holds the card (cardPlan never over) on every box with a card, both text scales, every level, heat, pact and BEST", bad.length === 0, J(bad.slice(0, 6)));
}

/* ---- the frame: static parts cached, a steady frame blits, a focus move never misses ---- */
{
  const hashOf = (r) => { const s = J(r.calls); let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(16) + ":" + r.calls.length; };
  for (const b of ["d1366", "p393", "c667x375"]) { // c667x375: a paged compact (its pages' layers made at once: a focus move across pages never misses)
    const ctx = rec({ widthK: K8 });
    ctx.ctx.setTransform(2, 0, 0, 2, 0, 0);
    const one = (ui, t) => { const n0 = ctx.calls.length, m0 = cache._dbg.misses; P.drawLevelPage(ctx.ctx, BOX[b], ui, t); const calls = ctx.calls.slice(n0); return { calls, miss: cache._dbg.misses - m0, measure: calls.filter((c) => c.op === "measureText").length, hash: hashOf({ calls }) }; };
    fresh();
    const cold = one(UI({ heat: 1, pace: 1, pact: 9, time: true, best: "0:38.4" }), 0.5), base = UI({ heat: 1, pace: 1, pact: 9, time: true, best: "0:38.4" });
    const a = one(base, 0.5), c2 = one(base, 0.5);
    check(`(${b}) a cold frame fills the room, the plate, the focus layers${b === "d1366" ? " and the feet" : ""}`, cold.miss >= 6, cold.miss);
    check(`(${b}) two steady frames: equal call-log hashes, 0 cache misses, <= 400 canvas calls, <= 20 measureText`, a.hash === c2.hash && a.miss === 0 && c2.miss === 0 && a.calls.length <= 400 && a.measure <= 20, J({ a: a.hash, b: c2.hash, miss: [a.miss, c2.miss], calls: a.calls.length, measure: a.measure }));
    const moves = LEVEL_ROWS.map((row) => one({ ...base, row }, 0.5));
    check(`(${b}) a focus move (every row in turn) causes 0 misses and stays <= 400 calls`, moves.every((m) => m.miss === 0 && m.calls.length <= 400), J(moves.map((m) => [m.miss, m.calls.length])));
    one({ ...base, row: N_MODS, open: true, cur: 0 }, 0.5);
    const lm = [0, 1, 2, 3, 4, 3].map((cur) => one({ ...base, row: N_MODS, open: true, cur }, 0.5));
    check(`(${b}) in the open list a cursor move causes 0 misses, <= 400 calls`, lm.every((m) => m.miss === 0 && m.calls.length <= 400), J(lm.map((m) => [m.miss, m.calls.length])));
    const rowsCv = () => { const L = P._dbg.last; return L.S.L["rows" + L.G.page].cv; }, s0 = rowsCv(), sh = one({ ...base, row: N_MODS }, 0.5);
    check(`(${b}) opening and closing the list never re-rasters the plate's rows (0 misses closing it)`, (b === "c667x375" || rowsCv() === s0) && sh.miss === 0, sh.miss); // a paged compact's open page hides its door: the shut page's layer (made before) comes back, no miss
    const w2 = one({ ...base, level: 2 }, 0.5), w2b = one({ ...base, level: 2 }, 0.5);
    check(`(${b}) a level change refills once (the world and the card change): misses on the first frame, none on the next`, w2.miss > 0 && w2b.miss === 0, J([w2.miss, w2b.miss]));
    const steady = one({ ...base, level: 2 }, 0.5);
    check(`(${b}) the steady frame only blits (room, plate, the focused part${b === "d1366" ? ", one foot" : ""}) and paints the door's teaser, the help line and START's tag live`, steady.calls.filter((c) => c.op === "drawImage").length >= 3 && steady.calls.filter((c) => c.op === "fillRect").length < 20, J(steady.calls.filter((c) => c.op === "drawImage").length));
  }
}
/* the first frame's backdrop is opaque: the room at alpha 1 over the whole box */
{
  fresh();
  const r = rec({ widthK: K8 }), alphas = [];
  const c = new Proxy(r.ctx, { get: (t, k) => (k === "drawImage" ? (...a) => { alphas.push([t.globalAlpha, a.slice(1)]); return t.drawImage(...a); } : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
  P.drawLevelPage(c, BOX.d1366, UI({ enterT: 0 }), 0);
  check("first frame: the room blitted first, opaque, over the whole box; the plate fades in", J(alphas[0]) === J([1, [0, 0, 1366, 768]]) && alphas[1][0] === 0, J(alphas.slice(0, 2)));
}
/* a zero or non-finite box draws nothing and taps nothing */
{
  const bad = [];
  for (const F of [{ W: 0, H: 0 }, { W: NaN, H: 520 }, { W: -5, H: 520 }, { W: Infinity, H: 520 }]) {
    const t = rec({ widthK: K8 });
    let threw = null;
    try { P.drawLevelPage(t.ctx, { ...F, touch: false, shell: true, css: 1 }, UI(), 0); } catch (err) { threw = err; }
    if (threw || t.calls.length || P.levelHit(1, 1, F).k !== "none") bad.push(J(F) + (threw ? " " + threw.message : " " + t.calls.length));
  }
  check("a zero / NaN / negative / infinite box: draws nothing, throws nothing, taps nothing", bad.length === 0, bad.join(" | "));
}

/* ---- the cache: the room's dpr floors and the 24 MiB budget beside MENU's layers (ruling 6) ---- */
{
  const run = (ts) => {
    setTextScale(ts); fresh();
    const t = rec({ widthK: K8 }); t.ctx.setTransform(2, 0, 0, 2, 0, 0);
    MP.drawMenuPage(t.ctx, { W: 1366, H: 768, touch: false, shell: true, css: 1 }, { rows: ITEMS, focus: "PLAY", level: 1, run: {}, enterT: 9 }, 0);
    const menuRd = MP._dbg.last.S.rd;
    let peak = 0;
    for (let i = 0; i < 3; i++) { P.drawLevelPage(t.ctx, BOX.d1366, UI({ row: LEVEL_ROWS[i] }), i * 0.1); peak = Math.max(peak, cache._dbg.bytes); }
    const S = P._dbg.last.S, mine = [S.roomL.cv, ...Object.values(S.L).map((q) => q.cv)];
    setTextScale(1);
    return { rd: S.rd, menuRd, peak, gone: mine.filter((cv) => !cv || !cv.width).length, bytes: mine.reduce((n, cv) => n + (cv ? cv.width * cv.height * 4 : 0), 0) };
  };
  const a = run(1), b = run(1.25);
  console.log("  NOTE LEVEL SELECT layers at 1366x768@2 " + J({ t1: a, t125: b }));
  check("1366x768@2, text scale 1: the room's dpr >= 1.5 (MENU's floor) with MENU's layers drawn first; <= 24 MiB; nothing LEVEL SELECT shows evicted", a.rd >= 1.5 && a.peak <= cache.BUDGET && a.gone === 0, J(a));
  check("1366x768@2, text scale 1.25: the room's dpr >= 1.41; <= 24 MiB; nothing evicted", b.rd >= 1.41 && b.peak <= cache.BUDGET && b.gone === 0, J(b));
  fresh();
  const t = rec({ widthK: K8 }); t.ctx.setTransform(2.7, 0, 0, 2.7, 0, 0);
  P.drawLevelPage(t.ctx, BOX.p393, UI({ open: true, cur: 1, row: N_MODS }), 0);
  check("phone at dpr 2.7 (capped 2 on touch), list open: <= 24 MiB", cache._dbg.bytes <= cache.BUDGET, cache._dbg.bytes);
}

/* ---- covered (ruling 1), tap mode (ruling 4), the real drawShell path ---- */
{
  check("shellCovers: MENU and LEVEL SELECT cover; GAME, SETTINGS, INTRO and ATTRACT do not", SV.shellCovers(SCREEN.MENU) && SV.shellCovers(SCREEN.LEVEL) && ![SCREEN.GAME, SCREEN.SETTINGS, SCREEN.INTRO, SCREEN.ATTRACT, SCREEN.GUIDE].some(SV.shellCovers));
  const box = (w, h, lay, logo, s) => ({ width: w, height: h, logo, css: s, ownerDocument: { body: { getAttribute: (k) => (k === "data-lay" ? lay : null) } }, getBoundingClientRect: () => ({ left: 0, top: 0, width: w * s, height: h * s }) });
  const a = createMenuApp({ pactUnlocked: true, settings: { fpm: 0 } });
  a.screen = SCREEN.LEVEL; a.levelRow = LEVEL_ROWS.indexOf(N_DIFF); a.heat = 1; a.subT = 9;
  const shot = (cv) => { SV.drawShell(rec({ widthK: K8 }).ctx, a, { state: "PLAY", time: 1, level: 1 }, cv, "2d", () => [], () => 0, () => ({})); return P._dbg.last; };
  const ph = box(PG.w, PG.h, "p", PG.logo, PG.s);
  a.lastDev = "touch";
  check("tap mode (ruling 4): a touch layout read by touch focuses START (the page's one action), no row band", shot(ph).foc === N_START);
  a.lastDev = "key";
  check("tap mode (ruling 4): a key press on a touch layout leaves it: the focused row (DIFFICULTY) shows", shot(ph).foc === N_DIFF);
  a.lastDev = "pad";
  check("tap mode (ruling 4): a controller press leaves it too", shot(ph).foc === N_DIFF);
  a.lastDev = "touch";
  check("tap mode (ruling 4): a tap re-enters it", shot(ph).foc === N_START);
  const ls = box(1024, 768, "l", 200, 1);
  a.lastDev = "key";
  const k = shot(ls);
  check("a hardware keyboard on the landscape tablet: the focus foot (ROW · CHANGE · START · BACK), never the tap rule", k.verb === "value" && k.foc === N_DIFF, J([k.verb, k.foc]));
  a.lastDev = "touch";
  check("…and a tap brings the tap rule back", shot(ls).verb === "tap");
  a.lastDev = "key"; a.modOpen = true; a.levelRow = LEVEL_ROWS.indexOf(N_MODS); a.modeCur = 2;
  const o = shot(ph);
  check("Enter on MODIFIERS from a hardware keyboard on a touch layout: the open list's focused entry shows (not a lit START)", o.foc === "M2", o.foc);
  a.modOpen = false; a.modeCur = -1;
  /* the real listeners: a keydown on a touch layout sets lastDev key; a touch pointerdown sets it back to touch */
  const { createGame } = await import("../src/main.js");
  const Lw = {}, noop = () => {};
  globalThis.window = { addEventListener: (ty, fn) => { (Lw[ty] = Lw[ty] || []).push(fn); }, removeEventListener: noop, innerWidth: 393, innerHeight: 852, localStorage: { getItem: () => null, setItem: noop, removeItem: noop } };
  const g = createGame(null, { seed: 7 });
  const fire = (ty, ev) => (Lw[ty] || []).slice().forEach((fn) => fn({ preventDefault: noop, stopPropagation: noop, ...ev }));
  fire("pointerdown", { pointerType: "touch", clientX: 1, clientY: 1 });
  const t1 = g.app.lastDev;
  fire("keydown", { code: "ArrowDown", key: "ArrowDown", repeat: false });
  const t2 = g.app.lastDev;
  fire("pointerdown", { pointerType: "touch", clientX: 1, clientY: 1 });
  check("the real listeners (createGame): a touch pointerdown sets lastDev touch, a keydown key, a tap touch again", t1 === "touch" && t2 === "key" && g.app.lastDev === "touch", J([t1, t2, g.app.lastDev]));
  g.stop();
}

/* ---- the probe record the gates read; the level row's exemptions ---- */
{
  for (const [b, ui] of [["d1366", UI({ unlocked: false })], ["p393", UI({ tap: true })], ["d1366", UI({ row: N_START, pact: 1 })], ["p393", UI({ open: true, cur: 1, pact: 1, row: N_MODS, tap: false })]]) {
    fresh(); probe.setOn(true);
    frame(BOX[b], ui, { dpr: 2 });
    const s = probe.snapshot(); probe.setOn(false);
    const tgt = s.rects.filter((r) => r.touch !== undefined && r.set), kinds = new Set(s.pairs.map((p) => p.kind)), foc = s.rects.filter((r) => r.focus);
    const yel = s.rects.filter((r) => r.fill === "#ffd447");
    check(`probe (${b}, ${ui.open ? "list open" : ui.tap ? "tap mode" : ui.row}): begin level on sh; a rect for every target (touch on touch layouts), one focused, one yellow (START); no fault`, s.page === "level" && s.box.el === "sh" && tgt.length >= 15 && tgt.every((r) => r.touch === BOX[b].touch) && foc.length === 1 && yel.length === 1 && yel[0].name === "START" && !s.fault, J({ n: tgt.length, foc: foc.map((r) => r.name), fault: s.fault }));
    const want = ["chosen", "band", "info", ...(ui.unlocked === false ? ["locked"] : []), ...(ui.tap || ui.row === N_START || ui.open ? ["ring"] : [])];
    check(`probe (${b}): ${want.join(", ")} pairs; every text with its colour; the plate rect with its ring width`, want.every((k) => kinds.has(k)) && s.texts.every((t) => !!t.col) && s.rects.some((r) => r.name === "plate" && r.plate > 0), J([...kinds]));
  }
  const m = SCREENS.level;
  check("screens.mjs level row: exempts ring and locked, each with a reason; needs chosen, band, info, text, cap, inside, plate, yellow, touch, gap", J(Object.keys(m.exempt).sort()) === J(["locked", "ring"]) && Object.values(m.exempt).every((v) => v.length > 20) && ["chosen", "band", "info", "text", "cap", "inside", "plate", "yellow", "touch", "gap"].every((g) => m.need.includes(g)));
}

/* ---- the source ---- */
{
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/render/pages/level.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  check("pages/level.js: no ctx.filter, shadowBlur, shadowColor, getImageData or toDataURL", !/\.filter\s*=|shadowBlur|shadowColor|getImageData|putImageData|toDataURL/.test(src));
  const imps = [...src.matchAll(/from\s+"([^"]+)"/g)].map((x) => x[1]);
  check("pages/level.js imports no src/app, board3, vendor or three; no schematic", imps.length > 5 && !imps.some((p) => /\/app\/|board3|vendor|three/.test(p)) && !/schem/.test(src), J(imps));
  const mdSrc = readFileSync(new URL("../src/render/menudraw.js", import.meta.url), "utf8");
  check("menudraw keeps no LEVEL SELECT painter (roomCard, schem, chip, capCell, levelNarrow, focusRing, heroRoom, heatLine, floorLine, modeHelp)", !/function\s+(roomCard|schem|chip|capCell|levelNarrow|focusRing|heroRoom|heatLine|floorLine|modeHelp)\b/.test(mdSrc));
  const shell = readFileSync(new URL("../src/pwa/shell.js", import.meta.url), "utf8");
  check("the page is in the boot precache (src/pwa/shell.js), not lazy", shell.includes('"src/render/pages/level.js"'));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
