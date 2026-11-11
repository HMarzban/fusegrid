/* UI upgrade v202 Task 3.5: GUIDE and its four pages on the world kit (src/render/pages/guide.js, lazy through pages/lazy.js). One geometry for draw and
   tap (doors and foes by name); the ENEMIES points as brick digits + PTS, the levels each foe appears in, the tooltip on the focused points value (the
   design record's KNIGHT copy, whole slots covered, inside the plate for every foe on every box); the read-only pages back out on any tap; the shared
   page rules (band = geometry, the 3 px cream ring, one yellow, touch >= 44 / gaps >= 8, label before keycap, strings whole at 1 and 1.25, inside the
   plate on desktop, landscape, phone and the iso guard, two idle frames equal with 0 misses, the room layer shared with MENU), the probe record, the
   ENEMIES focus in menuapp, the LOADING plate before the module is in, and the source rules. Every canvas is a textrec stub. */
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
const P = await import("../src/render/pages/guide.js");
const lazy = await import("../src/render/pages/lazy.js");
lazy._set("guide", P); // menudraw's delegates reach the page as if its lazy import had landed
const md = await import("../src/render/menudraw.js");
const MP = await import("../src/render/pages/menu.js");
const { setTextScale } = await import("../src/render/kit/type.js");
const { worldTokens, CONST } = await import("../src/render/kit/tokens.js");
const probe = await import("../src/render/kit/probe.js");
const { ITEMS, SCREEN, GUIDE_ROWS, createMenuApp } = await import("../src/app/menuapp.js");
const { shellGeo, fitBox, stageCss } = await import("../src/app/fit.js");
const { setHints } = await import("../src/render/hintcopy.js");
const { wordsOf } = await import("../src/app/hints.js");
const { DEF_CONTROLS } = await import("../src/app/controls.js");
const SV = await import("../src/render/shellview.js");
const { SCREENS } = await import("../tools/ui/lib/screens.mjs");
const { FOES, POWER, helpOf } = await import("../src/core/entities.js");
const { TILE_HELP, TILE_NAME } = await import("../src/core/feat.js");
const { DIFF, levelsOf, POINTS_RULE } = await import("../src/render/words.js");

const PG = shellGeo(393, 852);
const BOX = {
  d1366: { W: 1366, H: 768, touch: false, shell: true, css: 1 },
  d1920: { W: 1920, H: 1080, touch: false, shell: true, css: 1 },
  d1024: { W: 1024, H: 768, touch: false, shell: true, css: 1 },
  l1024: { W: 1024, H: 768, touch: true, shell: true, css: 1 },
  p393: { W: PG.w, H: PG.h, touch: true, shell: true, css: PG.s },
  c600: { W: 600, H: 520, touch: false, shell: false, css: 1 },
  d1280: { W: 1280, H: 720, touch: false, shell: true, css: 1 }, // fix round 1 (R2): desk windows that page rather than scale
  d1366s: { W: 1366, H: 657, touch: false, shell: true, css: 1 },
  iso: { W: 608, H: 352, touch: false, shell: false, css: 1 },
  c852: { W: 600, H: 520, touch: true, shell: false, css: stageCss(fitBox(852, 393, true, 600, 520).s, 600, 520, 1, 1) },
};
const ALL = Object.keys(BOX), TOUCHB = ["l1024", "p393", "c852"];
const PAGES = ["GUIDE", "HOW TO PLAY", "POWER-UPS", "ENEMIES", "FLOOR"];
const UI = (page, o) => ({ page, focus: page === "GUIDE" ? "ENEMIES" : page === "ENEMIES" ? 8 : null, tip: page === "ENEMIES", level: 1, look: "2d", ...o });
const near = (a, b, e = 0.51) => Math.abs(a - b) <= e;
const nearR = (a, b, e) => near(a.x, b.x, e) && near(a.y, b.y, e) && near(a.w, b.w, e) && near(a.h, b.h, e);
const inside = (a, b, e = 0.01) => a.x >= b.x - e && a.y >= b.y - e && a.x + a.w <= b.x + b.w + e && a.y + a.h <= b.y + b.h + e;
const sc = (r, u) => ({ x: r.x * u, y: r.y * u, w: r.w * u, h: r.h * u });
function frame(F, ui, o = {}) {
  const t = rec({ widthK: K8 });
  t.ctx.setTransform(o.dpr || 2, 0, 0, o.dpr || 2, 0, 0);
  const n0 = made.length, m0 = cache._dbg.misses;
  P.drawGuidePage(o.c || t.ctx, F, ui, o.t || 0);
  return { t, cvs: made.slice(n0), miss: cache._dbg.misses - m0 };
}
const fresh = () => { cache.release(); cache._dbg.misses = 0; };
/* every text the page painted this frame, live and in its layers (design px: the page paints under scale(u)) */
const textsOf = (f) => [...f.t.texts, ...made.flatMap((c) => c.r.texts)];

/* ---- words, order, points ---- */
check("doors: pages/guide.js DOORS is menuapp GUIDE_ROWS (HOW TO PLAY, POWER-UPS, ENEMIES, FLOOR)", J(P.DOORS) === J(GUIDE_ROWS) && J(GUIDE_ROWS) === J(["HOW TO PLAY", "POWER-UPS", "ENEMIES", "FLOOR"]));
check("each page records under its tools/ui/lib/screens.mjs capture name", PAGES.every((p) => !!SCREENS[P.SHOT[p]]), J(P.SHOT));
{
  const { createWorld, loadLevel, step, newIntent } = await import("../src/core/sim.js");
  const { CFG, T, key } = await import("../src/core/config.js");
  /* a real kill per type: one foe on a floor tile, a bomb under it about to blow; the score delta less the bricks the blast broke */
  const killPts = (type) => {
    const w = createWorld(7, 1); loadLevel(w, 1); w.state = "PLAY";
    let tx = -1, ty = -1;
    for (let y = 5; y < CFG.ROWS - 1 && tx < 0; y++) for (let x = 5; x < CFG.COLS - 1; x++) if (w.grid[key(x, y)] === T.EMPTY) { tx = x; ty = y; break; }
    w.enemies = [{ ...w.enemies[0], type, x: (tx + 0.5) * CFG.TILE, y: (ty + 0.5) * CFG.TILE, dead: false, invuln: false, hunt: false }];
    w.bombs.push({ x: (tx + 0.5) * CFG.TILE, y: (ty + 0.5) * CFG.TILE, tx, ty, timer: 0.001, radius: 1, pierce: false, line: false, dir: null, variant: null, dead: false });
    const s0 = w.score;
    let kills = 0, bricks = 0;
    for (let i = 0; i < 3; i++) { step(w, 1 / 60, [newIntent()]); for (const ev of w.events) { if (ev.t === "kill") kills++; if (ev.t === "brick" && !ev.mound) bricks++; } w.events.length = 0; }
    return kills === 1 ? w.score - s0 - bricks * CFG.BRICK_SCORE : null;
  };
  const got = Object.fromEntries(FOES.map((f) => [f.t, killPts(f.t)]));
  check("PTS is what a real kill scores, per foe (sim.js killEnemy): the page's numbers are true", FOES.every((f) => got[f.t] === P.PTS[f.t]), J(got));
}
/* ---- the KNIGHT tip, exact ---- */
check("tip copy: KNIGHT, word for word (design record §4 GUIDE · ENEMIES)", P.tipText("KNIGHT") === "What you score each time your blast takes out a KNIGHT. Saved scores count ×2 on HARD and ×3 on EXPERT." && P.POINTS === "POINTS");
for (const b of ["d1366", "p393"]) for (const ts of [1, 1.25]) {
  setTextScale(ts); fresh();
  frame(BOX[b], UI("ENEMIES", { focus: 8, tip: true }));
  const tip = P._dbg.last.P.tips[8], words = tip.filter((o) => o.op === "text").map((o) => o.s), dig = tip.find((o) => o.op === "digits");
  check(`tip (${b}, x${ts}): POINTS, the brick digits 200 and the KNIGHT copy whole across its lines`, words[0] === "POINTS" && dig && dig.v === 200 && words.slice(1).join(" ") === P.tipText("KNIGHT"), J(words));
}
setTextScale(1);

/* ---- geometry: inside the plate, the plate's ring inside the box, every box, both text scales ---- */
for (const ts of [1, 1.25]) for (const b of ALL) for (const page of PAGES) {
  setTextScale(ts);
  const F = BOX[b], G = P.guideGeom(F, page), D = G.d, u = G.u, T = D.T + 2, ring = { x: D.plate.x - T, y: D.plate.y - T, w: D.plate.w + 2 * T, h: D.plate.h + 2 * T + 1 };
  const out = D.order.filter((n) => !inside(D.items[n].r, D.plate));
  const focusOut = page === "GUIDE" ? D.order.filter((n) => !inside({ x: D.items[n].r.x - 6, y: D.items[n].r.y - 6, w: D.items[n].r.w + 12, h: D.items[n].r.h + 12 }, ring)) : page === "ENEMIES" ? D.order.filter((n) => !inside({ x: D.items[n].pts.x - 6, y: D.items[n].pts.y - 6, w: D.items[n].pts.w + 12, h: D.items[n].pts.h + 12 }, D.plate)) : [];
  const boxOK = inside(sc(ring, u), { x: 0, y: 0, w: G.W, h: G.H }, 0.6) && (!D.foot || inside(sc(D.foot, u), { x: 0, y: 0, w: G.W, h: G.H }, 0.6));
  check(`inside (${b}, x${ts}, ${page}, ${G.mode}): every slot${page === "ENEMIES" ? " and focused points ring" : page === "GUIDE" ? " and its focus ring" : ""} inside the plate, the plate's ring and the foot inside the box`, out.length === 0 && focusOut.length === 0 && boxOK, J({ out, focusOut, plate: D.plate, u, W: G.W, H: G.H }));
}
setTextScale(1);
{
  const m = (b, p) => P.guideGeom(BOX[b], p).mode;
  check("arrangements: keyboard boxes are the desk; the touch-portrait shell box is the phone column; a landscape phone (#c) is compact", ["d1366", "d1920", "d1024", "c600", "iso"].every((b) => PAGES.every((p) => m(b, p) === "desk")) && PAGES.every((p) => m("p393", p) === "phone" && m("c852", p) === "compact"));
  const G = P.guideGeom(BOX.d1366, "ENEMIES");
  check("desktop 1366x768: ENEMIES is three cards a row (the round 6 frame), the plate centred, nothing scaled", G.u === 1 && G.order.slice(0, 3).every((n, i, a) => !i || G.items[n].y === G.items[a[0]].y) && G.items.CHASER.y > G.items.WALKER.y && near(G.plate.x + G.plate.w / 2, 683, 0.6), J(G.plate));
  const D = P.guideGeom(BOX.d1366, "GUIDE");
  check("desktop 1366x768: GUIDE is a 2 x 2 of doors; the phone stacks the four", D.items["HOW TO PLAY"].y === D.items["POWER-UPS"].y && D.items.ENEMIES.y > D.items["HOW TO PLAY"].y && (() => { const Q = P.guideGeom(BOX.p393, "GUIDE"); return Q.order.every((n, i, a) => !i || Q.items[n].y > Q.items[a[i - 1]].y); })());
}

/* ---- fix round 1, rulings R1 / R2: desk windows hold u = 1 where MENU does by letting margins, columns and the pane give way, and page (never
   scale under the desktop floors) where they still cannot hold; compact boxes page at their own scale; the ▲ / ▼ page keys are >= 44 CSS px ---- */
{
  const DESK = { "d1366x768": [1366, 768, false], "d1280x720": [1280, 720, false], "d1024x768": [1024, 768, false], "l1024x768": [1024, 768, true], "d1366x657": [1366, 657, false] };
  for (const ts of [1, 1.25]) for (const [nm, [W, H, touch]] of Object.entries(DESK)) {
    setTextScale(ts);
    const F = { W, H, touch, shell: true, css: 1 }, rows = PAGES.map((page) => { const G = P.guideGeom(F, page); return [page, G.mode, +G.u.toFixed(4), G.pages]; });
    check(`desk floors (${nm}, x${ts}): every GUIDE page holds u = 1 (primary cap >= 14, secondary >= 11, body >= 17.9 px), paging where it must`, rows.every((r) => r[1] === "desk" && r[2] === 1) && P.uFloor(ts) <= 1, J(rows));
  }
  for (const ts of [1, 1.25]) for (const b of ["c852", "p393"]) {
    setTextScale(ts);
    const F = BOX[b], rows = PAGES.map((page) => { const G = P.guideGeom(F, page), k = G.u * F.css; return { page, k: +k.toFixed(4), pages: G.pages, keys: G.pager ? [G.pager.up, G.pager.dn].map((r) => [r.w / F.css, r.h / F.css].map((v) => +v.toFixed(1))) : null }; });
    check(`compact / phone floors (${b}, x${ts}): every page at its own scale (1 box unit per CSS px, never under), its page keys >= 44 x 44 CSS px`, rows.every((r) => r.k >= 1 - 1e-6 && (!r.keys || r.keys.every(([w, h]) => w >= 43.95 && h >= 43.95))), J(rows));
  }
  setTextScale(1);
  { // a landscape phone pages; each page draws only its own slots, and the pager reads PAGE n OF m (the kit pager's label) with its two keys
    const G = P.guideGeom(BOX.c852, "ENEMIES");
    fresh(); frame(BOX.c852, UI("ENEMIES", { focus: 4, tip: false }));
    const L = P._dbg.last, pg = L.pg, on = L.P.rest.filter((o) => o.pg === pg && o.op === "text" && FOES.some((e) => e.name === o.s)).map((o) => o.s);
    check("c852 ENEMIES pages: the focused foe's page on screen, its foes alone, PAGE n OF m", G.pages > 1 && pg === G.pageOf.PHANTOM && J(on) === J(G.order.filter((n) => G.pageOf[n] === pg)) && L.P.rest.some((o) => o.pg === pg && o.s === "PAGE " + (pg + 1) + " OF " + G.pages), J({ pages: G.pages, pg, on }));
  }
}
{ // page keys tap: GUIDE on a landscape phone pages its doors; ▼ is the kit's {k: "page", d: 1, to: the next page's first door}, a key with no page that way to null (inert)
  const F = BOX.c852, G = P.guideGeom(F, "GUIDE"), c = (r) => [r.x + r.w / 2, r.y + r.h / 2], nx = GUIDE_ROWS.findIndex((n) => G.pageOf[n] === 1);
  check("c852 GUIDE pages its doors; its ▼ key opens the next page on its first door, its ▲ on page 1 and its ▼ on the last answer to null (inert)", G.pages === 2 && nx > 0 && J(P.guideHit(...c(G.pager.dn), F, 0)) === J({ k: "page", d: 1, to: nx }) && J(P.guideHit(...c(G.pager.up), F, 0)) === J({ k: "page", d: -1, to: null }) && J(P.guideHit(...c(G.pager.dn), F, nx)) === J({ k: "page", d: 1, to: null }) && J(P.guideHit(...c(G.pager.up), F, nx)) === J({ k: "page", d: -1, to: 0 }), J({ pages: G.pages, nx }));
  /* ENEMIES with its tooltip open: a tap inside the tooltip (the slots or page keys under it included) only closes it (-1) */
  const E = P.guideGeom(F, "ENEMIES"), t = E.tips[0].U;
  check("ENEMIES c852: a tap inside the open tooltip is -1 (it closes), even over a page key; shut, the same spot taps what is under it", P.enemiesHit(t.x + t.w / 2, t.y + t.h - 2, F, 0, true) === -1 && P.enemiesHit(...c(E.pager.dn), F, 0, false).k === "page", J(t));
}
{ // the controller cue on a touch layout: a flip re-lays the page (its layers miss once, never a stale blit) and every cue keycap sits inside the plate
  setTextScale(1.25); fresh();
  frame(BOX.p393, UI("ENEMIES", { focus: 0, tip: false }));
  const a = P._dbg.last.G; setHints(wordsOf("pad", DEF_CONTROLS));
  const f = frame(BOX.p393, UI("ENEMIES", { focus: 0, tip: false })), b = P._dbg.last.G, pl = b.d.plate, cue = b.d.head.cue;
  const caps = P._dbg.last.P.rest.filter((o) => o.op === "cap" && cue && o.y >= cue.y - 1 && o.y <= cue.y + cue.h);
  check("p393 x1.25: the pad's cue line re-lays ENEMIES (a miss, the new geometry) and its keycaps sit inside the plate", !a.d.head.cue && !!cue && f.miss > 0 && caps.length >= 2 && caps.every((o) => o.x >= pl.x && o.x + o.w <= pl.x + pl.w), J({ miss: f.miss, caps: caps.map((o) => [o.s, o.x, o.w]) }));
  setHints(null); setTextScale(1);
}
{ // fix round 1, Important 5: desk ENEMIES at 125 % follows the t125 frame: one page, no kicker, the points key on the name's line wherever the measure fits it
  setTextScale(1.25);
  const G = P.guideGeom(BOX.d1366, "ENEMIES"), D = G.d, inl = D.order.filter((n) => D.items[n].pts.y < D.items[n].nameY);
  check("d1366 x1.25 ENEMIES: one page, u 1, no kicker; the points key rides the name's line (" + inl.length + " of 9 by the recorder's 0.648 em; the browser measures)", G.pages === 1 && G.u === 1 && !D.head.kick && inl.length >= 5, J(inl));
  /* R1 kit leftover: with a measurer near the system sans (0.55 em, the Chrome captures' width) at least 8 of the 9 points keys ride the name's line */
  P._measureWith(rec({ widthK: 0.55 }).ctx);
  const G55 = P.guideGeom(BOX.d1366, "ENEMIES"), D55 = G55.d, inl55 = D55.order.filter((n) => D55.items[n].pts.y < D55.items[n].nameY);
  check("d1366 x1.25 ENEMIES at a realistic 0.55 em: one page, u 1, and >= 8 of 9 points keys inline", G55.pages === 1 && G55.u === 1 && inl55.length >= 8, inl55.length + " " + J(inl55));
  P._measureWith(undefined);
  /* minor: an unfocused points key under the name starts at the name's left edge (the focused key's bomb pushes only the focused digits) */
  const off = D.order.filter((n) => { const q = D.items[n]; return !(q.pts.y < q.nameY) && Math.abs(q.dig.x - q.tx) > 1e-6; });
  check("desk ENEMIES: an unfocused points key under the name lines up with the name's left edge", off.length === 0, J(off));
  setTextScale(1);
}
{ // minor: the phone tooltip is sized by the measured words: the fewest whole rows that hold them (the frame's two at the browser's measure)
  const G = P.guideGeom(BOX.p393, "ENEMIES"), D = G.d, bad = [];
  D.tips.forEach((t, i) => {
    const need = 12 + 36 + 6 + t.n * 15 * 1.4 + 14 + 2 * t.Tt + 5, rows = t.cover.map((j) => D.items[D.order[j]].r), far = rows.reduce((a, r) => (Math.abs(r.y - D.items[D.order[i]].r.y) > Math.abs(a.y - D.items[D.order[i]].r.y) ? r : a), rows[0]);
    if (!rows.length || t.U.h < need - 1e-6 || (rows.length > 1 && t.U.h - far.h >= need)) bad.push([D.order[i], rows.length, +t.U.h.toFixed(1), +need.toFixed(1)]);
  });
  check("p393 ENEMIES: each tooltip covers the fewest whole rows its measured words need", bad.length === 0, J(bad));
}

/* ---- the tooltip: whole slots, inside the plate, its text inside it, never over the focused foe; for every foe on every box ---- */
for (const ts of [1, 1.25]) for (const b of ALL) {
  setTextScale(ts); fresh();
  const F = BOX[b], G = P.guideGeom(F, "ENEMIES"), D = G.d, bad = [];
  for (let i = 0; i < FOES.length; i++) {
    const tg = D.tips[i], q = D.items[D.order[i]];
    /* the plaque with its ring (T + 2 round it, T + 3 below) fills the slots it covers, U; its hard drop is cut to U */
    const ring = { x: tg.r.x - tg.Tt - 2, y: tg.r.y - tg.Tt - 2, w: tg.r.w + 2 * tg.Tt + 4, h: tg.r.h + 2 * tg.Tt + 5 }, outer = tg.U;
    if (!inside(outer, D.plate, 0.6) || !inside(ring, outer, 0.01)) bad.push(D.order[i] + " outside the plate or its slots");
    if (tg.cover.includes(i) || [q.r, q.pts].some((r) => r.x < outer.x + outer.w - 1e-6 && r.x + r.w > outer.x + 1e-6 && r.y < outer.y + outer.h - 1e-6 && r.y + r.h > outer.y + 1e-6)) bad.push(D.order[i] + " covers its own foe");
    const covered = tg.cover.map((j) => D.items[D.order[j]].r), U = tg.U;
    if (!covered.every((r) => inside(r, U))) bad.push(D.order[i] + " cuts a slot");
    frame(F, UI("ENEMIES", { focus: i, tip: true }));
    const lines = P._dbg.last.P.tips[i].filter((o) => o.op === "text");
    const lb = lines[lines.length - 1];
    if (lb.y + lb.px * ts * 0.7 > tg.r.y + tg.r.h + 0.01) bad.push(D.order[i] + " text below its tip");
    /* R1 landscape (lead ruling): a compact tip that cannot hold the full copy beside its row is the one-line points rule (words.js POINTS_RULE), no POINTS row */
    const want = tg.short ? [POINTS_RULE] : [P.POINTS, P.tipText(FOES[i].name)], got = tg.short ? lines.map((o) => o.s) : [lines[0] && lines[0].s, lines.slice(1).map((o) => o.s).join(" ")];
    if (J(got) !== J(want) || (tg.short && D.mode !== "compact") || lines.some((o) => o.x + o.mw > tg.r.x + tg.r.w - tg.pad + 0.01)) bad.push(D.order[i] + " text not whole inside");
    const p = tg.ptr;
    if (Math.abs(p.dir) === 2) { if (p.y < tg.r.y || p.y > tg.r.y + tg.r.h || Math.sign(q.pts.x + q.pts.w / 2 - p.x) !== Math.sign(p.dir)) bad.push(D.order[i] + " pointer off"); } // compact: across, toward the value's column
    else if (p.x < tg.r.x || p.x > tg.r.x + tg.r.w || (tg.up ? p.y + p.h > q.pts.y + q.pts.h : p.y - p.h < q.r.y - 14)) bad.push(D.order[i] + " pointer off");
  }
  check(`tooltip (${b}, x${ts}, ${G.mode}): for every foe, whole slots covered, inside the plate with its ring and drop, never over the foe it explains, its words whole inside it, the pointer toward the value`, bad.length === 0, bad.join(" | "));
}
setTextScale(1);

/* ---- hits: every drawn rect taps to itself; off the plate backs out; GUIDE's plate is inert; ENEMIES elsewhere is -1 ---- */
for (const b of ALL) {
  const F = BOX[b], G = P.guideGeom(F, "GUIDE"), E = P.guideGeom(F, "ENEMIES"), ctr = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const doors = G.order.every((n, i) => P.guideHit(...ctr(G.items[n]), F, i) === i && P.guideHit(...ctr(G.hit[n]), F, i) === i);
  const foes = E.order.every((n, i) => P.enemiesHit(...ctr(E.hit[n]), F, i) === i);
  const L = md.layout(F.W, F.H, F.shell ? 200 : undefined, F.css);
  const off = P.guideHit(1, 1, F) === -1 && P.enemiesHit(1, 1, F) === -1 && md.guideHit(1, 1, L, 4, F.touch) === -1;
  const plateMiss = P.guideHit(G.plate.x + 4, G.plate.y + 4, F) === -2;
  const back = !G.back || (P.guideHit(...ctr(G.back), F) === -1 && P.enemiesHit(...ctr(E.back), F) === -1);
  check(`hit (${b}): each door's and each foe's centre taps it (menudraw agrees); off the plate is -1, GUIDE's plate inert (-2), the BACK key -1`, doors && foes && off && plateMiss && back && G.order.every((n, i) => md.guideHit(...ctr(G.items[n]), L, 4, F.touch, i) === i) && E.order.every((n, i) => md.enemiesHit(...ctr(E.hit[n]), L, F.touch, i) === i), J({ doors, foes, off, plateMiss, back }));
  /* doors own half of each gap: the midpoint between two neighbours belongs to one of them, never to nothing */
  const gaps = [];
  for (const a of G.order) for (const c of G.order) { const A = G.items[a], C = G.items[c]; if (C.x > A.x + A.w && near(C.y, A.y)) gaps.push([(A.x + A.w + C.x) / 2, A.y + A.h / 2, 1, 0]); if (C.y > A.y + A.h && near(C.x, A.x)) gaps.push([A.x + A.w / 2, (A.y + A.h + C.y) / 2, 0, 1]); }
  check(`hit (${b}): no dead gutter between two doors (${gaps.length} gaps; just either side of each midpoint, across the gap)`, gaps.length >= 3 && gaps.every(([x, y, ax, ay]) => [-0.01, 0.01].every((e) => P.guideHit(x + ax * e, y + ay * e, F) >= 0)), J(gaps));
}
/* read-only pages back out on any tap; ENEMIES: a points value opens its tooltip, any other tap closes it, then backs out (the real mountPointer) */
{
  const { mountPointer } = await import("../src/app/pointer.js");
  const sc0 = await import("../src/render/scenes.js");
  const HIT = { overlayBox: sc0.overlayBox, pauseHit: sc0.pauseHit, touchLay: sc0.touchLay, controlsHit: SV.controlsHit, dims: SV.dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, enemiesHit: md.enemiesHit, guideReadHit: md.guideReadHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, recTabHit: md.recTabHit, layout: md.layout };
  const el = (w, h, rect, lay) => { const L = {}; return { width: w, height: h, style: {}, ownerDocument: { body: { getAttribute: (k) => (k === "data-lay" ? lay : null) } }, getBoundingClientRect: () => rect, addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, fire(t, ev) { (L[t] || []).slice().forEach((f) => f(ev)); } }; };
  for (const [nm, lay, w, h, touch] of [["desktop #sh 1366x768", "d", 1366, 768, false], ["phone #sh", "p", PG.w, PG.h, true]]) {
    const rect = { left: 0, top: 0, width: w * (touch ? PG.s : 1), height: h * (touch ? PG.s : 1) }, k = rect.width / w;
    const mk = (screen) => {
      const cv = el(600, 520, { left: 0, top: 0, width: 600, height: 520 }, lay), sh = el(Math.round(w * 2), Math.round(h * 2), rect, lay);
      const box = { width: w, height: h, logo: 200, css: touch ? PG.s : undefined, ownerDocument: sh.ownerDocument, getBoundingClientRect: () => rect };
      const app = createMenuApp({ settings: {} });
      app.screen = SCREEN.GUIDE; app.guideRow = GUIDE_ROWS.indexOf(screen === SCREEN.HOWTO ? "HOW TO PLAY" : screen === SCREEN.ITEMS ? "POWER-UPS" : screen === SCREEN.FLOOR ? "FLOOR" : "ENEMIES"); app.confirm();
      mountPointer({ canvas: cv, fit: { sh, box: () => box }, input: { _intent: { fire: false }, onUiKey() {} }, app, world: { state: "PLAY" }, kind: () => "2d", ctl: () => null, hit: HIT });
      return { app, tap: (x, y) => sh.fire("pointerdown", { clientX: x * k, clientY: y * k, currentTarget: sh }) };
    };
    const F = { W: w, H: h, touch, shell: true, css: touch ? PG.s : 1 };
    for (const s of [SCREEN.HOWTO, SCREEN.ITEMS, SCREEN.FLOOR]) {
      const page = s === SCREEN.HOWTO ? "HOW TO PLAY" : s === SCREEN.ITEMS ? "POWER-UPS" : "FLOOR", G = P.guideGeom(F, page);
      const spots = [[2, 2], [G.plate.x + G.plate.w / 2, G.plate.y + G.plate.h / 2], ...G.order.slice(0, 3).map((n) => [G.items[n].x + 4, G.items[n].y + 4])];
      const ok = spots.every(([x, y]) => { const r = mk(s); const was = r.app.screen; r.tap(x, y); return was === s && r.app.screen === SCREEN.GUIDE; });
      check(`read-only ${page} (${nm}): any tap backs out to GUIDE (off the plate, its middle, on a row)`, ok);
    }
    const E = P.guideGeom(F, "ENEMIES"), r = mk(SCREEN.ENEMIES), c = (q) => [q.x + q.w / 2, q.y + q.h / 2];
    r.tap(...c(E.hit.KNIGHT));
    const a = r.app.screen === SCREEN.ENEMIES && r.app.foeRow === 8 && r.app.foeTip;
    r.tap(...c(E.hit.WALKER).map((v, i) => (i ? v : v)));
    const moved = r.app.foeRow === 0 && r.app.foeTip; // a points value focuses its foe and opens its tooltip
    r.tap(2, 2);
    const closed = r.app.screen === SCREEN.ENEMIES && !r.app.foeTip;
    r.tap(2, 2);
    check(`ENEMIES (${nm}): a points value opens its tooltip (KNIGHT, then WALKER), a tap off them closes it, the next backs out`, a && moved && closed && r.app.screen === SCREEN.GUIDE, J([a, moved, closed, r.app.screen]));
  }
}

/* ---- focus: the band is the geometry's rect, the ring 3 px cream at 3 px; the bare bomb; tap mode shows none ---- */
{
  for (const b of ["d1366", "p393", "c600"]) for (const [page, foc] of [["GUIDE", "POWER-UPS"], ["GUIDE", "FLOOR"], ["ENEMIES", 4], ["ENEMIES", 8]]) {
    fresh(); setHints(b === "p393" ? wordsOf("pad", DEF_CONTROLS) : null); // a phone's focus shows with a controller (tap mode shows none)
    const F = BOX[b], G = P.guideGeom(F, page), u = G.u, f = frame(F, UI(page, { focus: foc, tip: false }), { dpr: 1 });
    const k = page === "GUIDE" ? G.d.items[foc].r : G.d.items[G.d.order[foc]].pts, kb = sc(k, u);
    const tok = worldTokens(1), bandFill = f.t.paints.filter((p) => p.op === "fill" && p.style === tok.band);
    const ring = f.t.paints.filter((p) => p.op === "stroke" && String(p.style).toLowerCase() === CONST.ink && near(p.lw, 3));
    const exp = { x: kb.x - 4.5 * u, y: kb.y - 4.5 * u, w: kb.w + 9 * u, h: kb.h + 9 * u };
    check(`focus ${page} ${foc} (${b}): one band, its rect the geometry's; one 3 px cream ring, offset 3 px`, bandFill.length === 1 && nearR(bandFill[0].box, kb, 0.6) && ring.length === 1 && nearR(ring[0].box, exp, 0.6 * u + 0.6), J({ band: bandFill.map((p) => p.box), kb, ring: ring.map((p) => p.box), exp }));
    probe.setOn(true); frame(F, UI(page, { focus: foc, tip: false }), { dpr: 1 }); const s = probe.snapshot(); probe.setOn(false);
    const bp = s.pairs.find((q) => q.kind === "band"), fr = s.rects.filter((r) => r.focus);
    check(`probe band (${page} ${foc}, ${b}): the band pair's rect and the one focused rect equal the geometry's`, !!bp && nearR(bp.a, kb, 1e-6) && fr.length === 1 && (G.touch && page === "ENEMIES" ? nearR(fr[0], G.hit[G.d.order[foc]], 1e-6) : nearR(fr[0], kb, 1e-6)), J([bp && bp.a, fr, kb]));
  }
  setHints(null);
  fresh();
  const f = frame(BOX.p393, UI("GUIDE", { focus: "ENEMIES" })), tok = worldTokens(1);
  fresh();
  const fk = frame({ ...BOX.p393, tap: false }, UI("GUIDE", { focus: "ENEMIES" }));
  check("tap mode (a phone, R1 cohesion ruling 5): GUIDE shows no door focused (no band, no ring); the same phone driven by keys shows its cursor door (one band, one ring)", f.t.paints.filter((p) => p.op === "fill" && p.style === tok.band).length === 0 && f.t.paints.filter((p) => p.op === "stroke" && near(p.lw, 3)).length === 0 &&
    fk.t.paints.filter((p) => p.op === "fill" && p.style === tok.band).length === 1 && fk.t.paints.filter((p) => p.op === "stroke" && near(p.lw, 3)).length === 1);
  const e = frame(BOX.p393, UI("ENEMIES", { focus: 3, tip: true }));
  check("tap mode: ENEMIES shows the tapped value's focus with its open tooltip", e.t.paints.some((p) => p.op === "fill" && p.style === tok.band) && P._dbg.last.tipOn);
}

/* ---- one yellow, no cord or spark colours; the yellow only inside art cells (FAST's own body), never a kit part ---- */
{
  for (const b of ["d1366", "p393"]) for (const page of PAGES) for (const lv of [1, 2, 8]) {
    fresh(); made.length = 0;
    const f = frame(BOX[b], UI(page, { level: lv }), { dpr: 1 }), Pl = P._dbg.last.P, G = P.guideGeom(BOX[b], page);
    probe.setOn(true); frame(BOX[b], UI(page, { level: lv }), { dpr: 1 }); const s = probe.snapshot(); probe.setOn(false);
    const yel = s.rects.filter((r) => String(r.fill || "").toLowerCase() === CONST.yel);
    const BAN = [CONST.cord, CONST.cord2].map((x) => x.toLowerCase()), all = [f.t, ...made.map((c) => c.r)];
    const kitYel = all.flatMap((r) => r.paints.filter((p) => String(p.style).toLowerCase() === CONST.yel && p.lw !== undefined && p.op === "fillRect" && p.box && p.box.w > 60 && p.box.h > 30));
    const cord = all.flatMap((r) => r.paints.map((p) => String(p.style).toLowerCase())).filter((x) => BAN.includes(x));
    check(`one yellow (${b}, ${page}, level ${lv}): no recorded part is #ffd447 (the main action belongs to MENU), no wide yellow kit fill, no cord colour`, yel.length === 0 && kitYel.length === 0 && cord.length === 0, J({ yel: yel.length, kitYel: kitYel.length, cord }));
    void Pl; void G;
  }
}

/* ---- touch: >= 44 CSS px, >= 8 px between targets of different sets (and between doors) ---- */
for (const b of TOUCHB) for (const page of ["GUIDE", "ENEMIES", "HOW TO PLAY"]) {
  const F = BOX[b], G = P.guideGeom(F, page), s = F.css;
  const T = [...G.order.filter((n) => G.hit[n]).map((n) => ({ n, r: sc(G.hit[n], s), set: page })), ...(G.back ? [{ n: "BACK", r: sc(G.back, s), set: "back" }] : [])];
  const small = T.filter((t) => t.r.w < 43.95 || t.r.h < 43.95);
  let gap = Infinity;
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    if (T[i].set === T[j].set && page === "ENEMIES") continue; // one list: the rows touch, the gate exempts one set of one kind
    const a = T[i].r, c = T[j].r, dx = Math.max(c.x - (a.x + a.w), a.x - (c.x + c.w)), dy = Math.max(c.y - (a.y + a.h), a.y - (c.y + c.h));
    gap = Math.min(gap, page === "GUIDE" && T[i].set === T[j].set ? Infinity : Math.max(dx, dy));
  }
  const doorGap = page === "GUIDE" ? Math.min(...G.order.flatMap((a, i) => G.order.slice(i + 1).filter((c) => G.pageOf[c] === G.pageOf[a]).map((c) => { const A = sc(G.items[a], s), C = sc(G.items[c], s); return Math.max(C.x - (A.x + A.w), A.x - (C.x + C.w), C.y - (A.y + A.h), A.y - (C.y + C.h)); }))) : Infinity;
  check(`touch (${b}, ${page}, ${G.mode}): every target >= 44 x 44 CSS px, the BACK key >= 8 px from the rest, the doors >= 8 apart`, small.length === 0 && gap >= 8 - 1e-9 && doorGap >= 8 - 1e-9, J({ small: small.map((t) => [t.n, t.r.w.toFixed(1), t.r.h.toFixed(1)]), gap, doorGap }));
}

/* ---- every key reads label first, keycap last: the foot, the HOW TO rows, the HOW TO door's strip ---- */
{
  for (const [dev, words] of [["key", null], ["pad", wordsOf("pad", DEF_CONTROLS)]]) {
    setHints(words);
    for (const page of PAGES) {
      fresh(); frame(BOX.d1366, UI(page));
      const L = P._dbg.last.P, F = L.foot, order = [];
      let word = null;
      for (const p of F.parts) { if (p.t) word = p; else if (p.cap) order.push(!!word && word.x + word.w <= p.x); else word = null; }
      check(`label before keycap (${dev}, ${page} foot): every cap after its word`, order.length >= 1 && order.every(Boolean) && F.parts.some((p) => p.t === "BACK"), J(F.parts.map((p) => p.t || p.sep || J(p.cap))));
      if (page === "HOW TO PLAY") {
        const rows = L.rest.filter((o) => o.op === "text" && o.name && /^(MOVE|BOMB|THROW \*|REMOTE \*|KICK \*|PAUSE)$/.test(o.name)), caps = L.rest.filter((o) => o.op === "cap");
        check(`label before keycap (${dev}, HOW TO rows): every row's keycaps right of its label`, rows.length === 6 && caps.length >= 6 && caps.every((c) => rows.some((t) => near(t.y, c.y + 15, 1) && t.x + t.mw < c.x)), J(caps.map((c) => [c.s, c.x])));
      }
      if (page === "GUIDE") {
        const st = L.strips["HOW TO PLAY"].ops, caps = st.filter((o) => o.op === "cap"), words2 = st.filter((o) => o.op === "text");
        check(`label before keycap (${dev}, the HOW TO door's strip): MOVE then its cap, BOMB then its cap, whole pairs only`, caps.length >= 2 && caps.length === words2.length && caps.every((c, i) => words2[i].x + words2[i].mw < c.x) && words2[0].s === "MOVE" && words2[1].s === "BOMB", J(st.map((o) => o.s)));
      }
    }
  }
  setHints(null);
}

/* ---- strings whole at text scale 1 and 1.25: no ellipsis; every help, tile line and name drawn whole (wrapped lines join back) or dropped by rule; inside the plate ---- */
{
  for (const ts of [1, 1.25]) for (const b of ALL) for (const page of PAGES) for (const [dev, words] of [["key", null], ["pad", wordsOf("pad", DEF_CONTROLS)]]) {
    setTextScale(ts); setHints(words); fresh(); made.length = 0;
    const F = BOX[b], f = frame(F, UI(page, { tip: false, narrow: F.W < 560 })), Lp = P._dbg.last, D = Lp.G.d, tx = Lp.P.rest.filter((o) => o.op === "text"), joined = " " + tx.map((o) => o.s).join(" ") + " ";
    const ell = textsOf(f).filter((t) => /…/.test(t.s)), bad = [];
    const plate = D.plate;
    for (const o of tx) { const x0 = o.align === "right" ? o.x - o.mw : o.align === "center" ? o.x - o.mw / 2 : o.x; if (x0 < plate.x - 0.01 || x0 + o.mw > plate.x + plate.w + 0.01 || o.y < plate.y || o.y > plate.y + plate.h) bad.push("out: " + o.s); }
    if (page === "POWER-UPS") {
      const tap = !!F.touch && dev !== "pad", lines = D.items[D.order[0]].lines;
      for (const p of POWER) { if (!joined.includes(" " + p.name + " ")) bad.push("name " + p.name); const h = tap && F.W < 560 ? helpOf(p, { throw: "tap", remote: "tap" }) : helpOf(p, words || wordsOf("key", DEF_CONTROLS), tap); if (lines && !joined.includes(" " + h + " ")) bad.push("help " + h); }
    }
    /* ENEMIES: every name, its levels line (APPEARS IN dropped where the card is too narrow: the documented step-down) and its help (dropped only on
       the phone / compact at 125 %, the round 6 phone frame's step-down), each whole */
    if (page === "ENEMIES") for (const e of FOES) {
      const q = D.items[e.name], help = e.help.replace(/\s*·\s*\d+$/, ""), hs = help.charAt(0).toUpperCase() + help.slice(1);
      if (!joined.includes(" " + e.name + " ")) bad.push("foe " + e.name);
      if (!joined.includes(" " + levelsOf(e.rooms) + " ")) bad.push("levels " + e.name);
      if ((D.mode === "desk" || q.helpY != null) && !joined.includes(" " + hs + " ")) bad.push("help " + e.name);
      if (D.mode !== "desk" && !(ts > 1.1) && q.helpY == null) bad.push("help dropped at x1 " + e.name);
    }
    /* HOW TO: both rules, the six rows and the note, whole */
    if (page === "HOW TO PLAY") for (const t of ["CLEAR EVERY ENEMY", "GOLD WALL NEVER BREAKS", "MOVE", "BOMB", "THROW *", "REMOTE *", "KICK *", "PAUSE", F.touch && dev !== "pad" ? "TOUCH · D-PAD MOVES · RIGHT BUTTON BOMBS" : "* NEEDS ITS POWER-UP"]) if (!joined.includes(" " + t + " ")) bad.push("how " + t);
    /* FLOOR: every tile's NORMAL and EXPERT lines, never a drop (fix round 1, Important 1), and its level line on every row */
    if (page === "FLOOR") {
      if ((D.mode === "desk" || D.fdk) !== tx.some((o) => o.s === "DIFFICULTY")) bad.push("the head names DIFFICULTY where it fits (the desk, or a title row with room), drops it whole elsewhere");
      for (const [k, h] of Object.entries(TILE_HELP)) { if (!joined.includes(" " + TILE_NAME[k] + " ")) bad.push("tile " + k); for (const s of [DIFF[0] + " · " + h[0], DIFF[2] + " · " + h[2]]) if (!joined.includes(" " + s + " ")) bad.push(s); }
      const lv = tx.filter((o) => /^LEVEL \d · /.test(o.s));
      if (lv.length !== 8 || new Set(lv.map((o) => o.s)).size !== 8) bad.push("level lines " + lv.length);
      if (D.order.some((n) => "lean" in D.items[n])) bad.push("a lean row");
    }
    if (page === "GUIDE") for (const l of GUIDE_ROWS) if (!joined.includes(" " + l + " ")) bad.push("door " + l);
    /* the one wrap rule: words break only at their spaces and a slot grows (or the page pages) to hold every line, so every page-body text sits
       inside its own slot (or the note, or the pager's strip), never past it */
    const inS = (r, x0, o) => !!r && x0 >= r.x - 0.01 && x0 + o.mw <= r.x + r.w + 0.01 && o.y >= r.y - 0.01 && o.y <= r.y + r.h + 0.01;
    for (const o of tx) if (o.pg != null) { const x0 = o.align === "right" ? o.x - o.mw : o.align === "center" ? o.x - o.mw / 2 : o.x; if (!D.order.some((n) => D.items[n].page === o.pg && inS(D.items[n].r, x0, o)) && !inS(D.note && D.note.r, x0, o) && !inS(D.pager && D.pager.label, x0, o)) bad.push("past its slot: " + o.s); }
    check(`drawn whole (${b}, x${ts}, ${dev}, ${page}): no ellipsis, every name / help / tile line whole, every word inside its slot and the plate`, ell.length === 0 && bad.length === 0, J({ ell: ell.map((t) => t.s), bad: bad.slice(0, 6) }));
  }
  setTextScale(1); setHints(null);
  const units = PAGES.flatMap((page) => { fresh(); frame(BOX.d1366, UI(page)); return P._dbg.last.P.rest.filter((o) => o.op === "text" && /\d\s(s|ms|px)\b/.test(o.s)).map((o) => o.s); });
  check("units unspaced: no '2 s' on any GUIDE page", units.length === 0, J(units));
}

/* ---- the frame: static parts cached, a steady frame blits, a move never misses; the room is MENU's own layer ---- */
{
  const hashOf = (calls) => { const s = J(calls); let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(16) + ":" + calls.length; };
  const ctx = rec({ widthK: K8 });
  ctx.ctx.setTransform(2, 0, 0, 2, 0, 0);
  const one = (F, ui, t) => { const n0 = ctx.calls.length, m0 = cache._dbg.misses; P.drawGuidePage(ctx.ctx, F, ui, t); const calls = ctx.calls.slice(n0); return { calls, miss: cache._dbg.misses - m0, measure: calls.filter((c) => c.op === "measureText").length, hash: hashOf(calls) }; };
  for (const b of ["d1366", "p393"]) for (const page of PAGES) {
    fresh();
    const F = BOX[b], cold = one(F, UI(page), 0.5), a = one(F, UI(page), 0.5), c = one(F, UI(page), 0.5);
    check(`${page} (${b}): a cold frame fills its layers; two steady frames equal, 0 misses, <= 400 calls, <= 20 measureText`, cold.miss >= 2 && a.hash === c.hash && a.miss === 0 && c.miss === 0 && a.calls.length <= 400 && a.measure <= 20, J({ cold: cold.miss, a: a.hash, c: c.hash, n: a.calls.length, m: a.measure }));
    const foci = page === "GUIDE" ? GUIDE_ROWS : page === "ENEMIES" ? FOES.map((_, i) => i) : [null];
    const moves = foci.flatMap((fo) => [one(F, UI(page, { focus: fo, tip: true }), 0.5), one(F, UI(page, { focus: fo, tip: false }), 0.9)]);
    check(`${page} (${b}): a move (every ${page === "GUIDE" ? "door" : page === "ENEMIES" ? "foe, its tooltip open and shut" : "frame"}) 0 misses, <= 400 calls`, moves.every((m) => m.miss === 0 && m.calls.length <= 400), J(moves.map((m) => [m.miss, m.calls.length])));
  }
  fresh();
  const w2 = one(BOX.d1366, UI("ENEMIES", { level: 2 }), 0.5), w2b = one(BOX.d1366, UI("ENEMIES", { level: 2 }), 0.5);
  check("a world change refills once", w2.miss > 0 && w2b.miss === 0, J([w2.miss, w2b.miss]));
  /* only the focused foe animates live: two frames apart in time differ, and only in the live part */
  fresh(); one(BOX.d1366, UI("ENEMIES", { focus: 0 }), 0.1);
  const t1 = one(BOX.d1366, UI("ENEMIES", { focus: 0 }), 0.1), t2 = one(BOX.d1366, UI("ENEMIES", { focus: 0 }), 1.3);
  check("ENEMIES: the focused foe animates on the page clock (frames differ in time), the cells at rest never re-raster (0 misses)", t1.hash !== t2.hash && t2.miss === 0 && t1.calls.filter((c) => c.op === "drawImage").length === t2.calls.filter((c) => c.op === "drawImage").length);
  /* MENU then GUIDE then MENU: one room layer, the same canvas, no room miss on either hop */
  fresh();
  const mui = { rows: ITEMS, focus: "GUIDE", level: 3, run: {}, daily: null, best: null, look: 0, pages: 4, rev: "v0", enterT: 9 };
  for (const b of ["d1366", "p393", "d1920"]) {
    const F = BOX[b];
    MP.drawMenuPage(ctx.ctx, F, mui, 0); const mRoom = MP._dbg.last.S.room;
    const m0 = cache._dbg.misses; P.drawGuidePage(ctx.ctx, F, UI("GUIDE", { level: 3, rev: "v0" }), 0); const gRoom = P._dbg.last.S.room;
    const roomMiss = gRoom !== mRoom;
    MP.drawMenuPage(ctx.ctx, F, mui, 0);
    check(`room (${b}): GUIDE blits MENU's own room layer (one key: MENU's dpr rule), so the hop never re-rasters the world`, !roomMiss && MP._dbg.last.S.room === mRoom && P._dbg.last.S.rd === MP._dbg.last.S.rd && cache._dbg.bytes <= cache.BUDGET, J({ rd: [P._dbg.last.S.rd, MP._dbg.last.S.rd], m: cache._dbg.misses - m0 }));
  }
  const bytes = {};
  for (const b of ["d1366", "p393"]) for (const page of PAGES) { fresh(); one(BOX[b], UI(page), 0); bytes[b + " " + page] = (cache._dbg.bytes / 1048576).toFixed(1); }
  console.log("  NOTE page layer MiB (room included) " + J(bytes));
  check("every page's layers stay inside the 24 MiB budget with the room", Object.values(bytes).every((v) => +v <= 24));
}

/* ---- the probe record ---- */
{
  for (const b of ["d1366", "p393"]) for (const page of PAGES) {
    const BF = { ...BOX[b], tap: false }; // a keyboard on the phone too: its focus shows (tap mode hides GUIDE's door focus, ruling 5)
    fresh(); probe.setOn(true);
    frame(BF, UI(page), { dpr: 2 });
    const s = probe.snapshot(); probe.setOn(false);
    const G = P.guideGeom(BF, page), kinds = new Set(s.pairs.map((p) => p.kind)), texts = s.texts.map((t) => t.s);
    const need = page === "GUIDE" || page === "ENEMIES" ? ["band", "ring", "info"] : page === "POWER-UPS" ? ["info"] : [];
    check(`probe (${b}, ${page}): begin ${P.SHOT[page]} on sh, the plate with its ring and fill, ${need.join(", ") || "no"} pairs, the title and every text with a colour, no fault`,
      s.page === P.SHOT[page] && s.box.el === "sh" && s.rects.some((r) => r.name === "plate" && r.plate === G.T && r.fill) && need.every((k) => kinds.has(k)) && texts.includes(page) && s.texts.every((t) => !!t.col) && !s.fault && !s.overflow, J({ page: s.page, kinds: [...kinds], fault: s.fault }));
    if (page === "ENEMIES") {
      const tip = s.rects.find((r) => r.name === "tip"), tg = G.d.tips[8], hid = tg.cover.map((j) => G.d.order[j]);
      check(`probe (${b}, ENEMIES): the open tooltip records its plate rect (ring ${tg.Tt}) and its words; the texts it covers are not recorded`, !!tip && tip.plate === tg.Tt * G.u && texts.includes("POINTS") && hid.every((n) => !texts.includes(n)) && texts.includes("KNIGHT"), J({ tip, hid }));
    }
  }
  { // the body floor is gated on the drawn font px: the record carries the text scale (18 x 1.25 x u at 125 %)
    setTextScale(1.25); fresh(); probe.setOn(true); frame(BOX.d1366, UI("ENEMIES"), { dpr: 2 }); const s = probe.snapshot(); probe.setOn(false); setTextScale(1);
    const G = P.guideGeom({ ...BOX.d1366, ts: 1.25 }, "ENEMIES"), bodies = s.texts.filter((t) => t.role === "body");
    check("probe at 125 %: a body text's px is the font px drawn (18 x 1.25 x u)", bodies.length > 5 && bodies.every((t) => near(t.px, 18 * 1.25 * G.u, 1e-6)), J(bodies.slice(0, 2).map((t) => t.px)));
  }
  const ex = (n) => J(Object.keys(SCREENS[n].exempt).sort());
  check("screens.mjs: guide and enemies exempt chosen and locked only; howto, items and floor also band, ring and gap (no focus, one tap target); howto and floor info (no non-text mark)",
    ex("guide") === J(["chosen", "locked"]) && ex("enemies") === J(["chosen", "locked"]) && ex("items") === J(["band", "chosen", "gap", "locked", "ring"]) && ex("howto") === J(["band", "chosen", "gap", "info", "locked", "ring"]) && ex("floor") === J(["band", "chosen", "gap", "info", "locked", "ring"]) && ["guide", "howto", "items", "enemies", "floor"].every((n) => Object.values(SCREENS[n].exempt).every((v) => v.length > 10)));
  check("screens.mjs: the enemies capture walks to KNIGHT and opens its tooltip (← from WALKER, then Enter)", J(SCREENS.enemies.key) === J(["ArrowLeft", "Enter"]));
}

/* ---- the shell: covered, routed, lazy ---- */
{
  check("shellCovers: GUIDE, HOW TO, POWER-UPS, ENEMIES and FLOOR cover the board (their room is opaque)", [SCREEN.GUIDE, SCREEN.HOWTO, SCREEN.ITEMS, SCREEN.ENEMIES, SCREEN.FLOOR].every(SV.shellCovers));
  check("lazy.js: guide is one of the lazy pages", lazy.NAMES.includes("guide"));
  /* before the module is in: the LOADING plate over the world, every hit inert (-2) */
  lazy._set("guide", null);
  const t = rec({ widthK: K8 }), L = md.layout(1366, 768, 200, 1);
  md.drawGuide(t.ctx, L, 0, 0, "2d", false, { level: 2 });
  md.drawEnemiesHelp(t.ctx, L, 0, "2d", false, { level: 2 });
  const loading = t.texts.filter((x) => x.s === "LOADING").length;
  check("not loaded: GUIDE and ENEMIES paint the LOADING plate; guideHit and enemiesHit are -2 (inert: a tap while it loads never backs out); guideGeom is null", loading === 2 && md.guideHit(683, 300, L, 4, false) === -2 && md.enemiesHit(683, 300, L, false) === -2 && md.guideGeom(L, false) === null);
  /* R1 kit: GUIDE's LOADING is THE plate (kit room.js loadingPlate: title + one line), and every LOADING frame asks for the module again, so a
     failed import recovers (lane rules lesson 5; GUIDE used to wait for lazy.idle() alone) and the plate says DID NOT LOAD while it has failed */
  {
    await new Promise((r) => setTimeout(r, 0)); // the plates above asked already: let those asks land first
    lazy._set("guide", null);
    const asks = [], w0 = md._rec.want;
    let n = 0;
    md._rec.want = (name) => { asks.push(name); return ++n === 1 ? Promise.reject(new Error("network blip")) : (lazy._set("guide", P), Promise.resolve(P)); };
    const t1 = rec({ widthK: K8 });
    md.drawFloorHelp(t1.ctx, L, 0, "2d", false, { level: 2 });
    await new Promise((r) => setTimeout(r, 0));
    const t2 = rec({ widthK: K8 });
    md.drawFloorHelp(t2.ctx, L, 0, "2d", false, { level: 2 });
    const failed = t2.texts.some((x) => x.s === "DID NOT LOAD") && t2.texts.some((x) => x.s === "FLOOR");
    await new Promise((r) => setTimeout(r, 0));
    check("GUIDE LOADING: the title and LOADING; a LOADING frame asks for the page, a failed import shows DID NOT LOAD and the next frame asks again and lands",
      t1.texts.some((x) => x.s === "FLOOR") && t1.texts.some((x) => x.s === "LOADING") && failed && J(asks) === J(["guide", "guide"]) && lazy.get("guide") === P, J({ asks, failed }));
    md._rec.want = w0;
  }
  lazy._set("guide", P);
  /* shellview hands the page app.level, ENEMIES' focus and tooltip */
  const app = createMenuApp({ settings: {} });
  app.screen = SCREEN.ENEMIES; app.level = 7; app.foeRow = 5; app.foeTip = true; app.subT = 1;
  const box = { width: 1366, height: 768, logo: 200, ownerDocument: { body: { getAttribute: () => "d" } }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1366, height: 768 }) };
  SV.drawShell(rec({ widthK: K8 }).ctx, app, { state: "PLAY", time: 1 }, box, "2d", () => [], () => 0, () => ({}));
  check("drawShell routes ENEMIES with the world (app.level), the focused foe (app.foeRow) and its tooltip (app.foeTip)", P._dbg.last.G.page === "ENEMIES" && P._dbg.last.S.ui.level === 7 && P._dbg.last.foc === 5 && P._dbg.last.tipOn);
}

/* ---- the source ---- */
{
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/render/pages/guide.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  check("pages/guide.js: no ctx.filter, shadowBlur, shadowColor, getImageData or toDataURL", !/\.filter\s*=|shadowBlur|shadowColor|getImageData|putImageData|toDataURL/.test(src));
  const imps = [...src.matchAll(/from\s+"([^"]+)"/g)].map((x) => x[1]);
  check("pages/guide.js imports no src/app, board3, vendor or three", imps.length > 5 && !imps.some((p) => /\/app\/|board3|vendor|three/.test(p)), J(imps));
  const { BOOT, PRECACHE, LOOK_LATER } = await import("../src/pwa/shell.js");
  check("the PWA precaches guide.js in the idle stage (never install's BOOT) and lazy.js at boot", PRECACHE.includes("./src/render/pages/guide.js") && LOOK_LATER.includes("./src/render/pages/guide.js") && !BOOT.includes("./src/render/pages/guide.js") && BOOT.includes("./src/render/pages/lazy.js"));
  const mdsrc = readFileSync(new URL("../src/render/menudraw.js", import.meta.url), "utf8");
  check("menudraw: the CONSOLE PANEL GUIDE painters are gone (no FLOOR_ROWS, keyCap, howRows or floorAt), it delegates through lazy.get", !/FLOOR_ROWS|function keyCap|howRows|function floorAt|function itemAt/.test(mdsrc) && /\blazy\.get\("guide"\)/.test(mdsrc) && !/from "\.\/pages\/guide\.js"/.test(mdsrc));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
