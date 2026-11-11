/* UI upgrade v202 Task 3.2: the next-run card (src/render/pages/card.js), on MENU's card slot (desk and phone; the compact arrangement has none).
   One module LEVEL SELECT (Task 3.3) reuses, fed names and values only. What it shows: the world, the lane (the representative start corner, MAKO on his
   spawn FLOOR cell), every roster foe (×n beside one met more than once, as the mock), the floor tile, LIVES / FUSE / SCORE; never the dealt board. Painted once into MENU's plate layer
   (keyed by what it shows), so the room layer's dpr stays >= 1.5 at 1366 x 768 @2 and a steady frame costs no call. Plus the shared Phase 3 list:
   every word whole at 1 and 1.25, inside the card and the plate at desk / l / p / iso, one yellow, the ring, 44 px, two idle frames equal. */
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
const P = await import("../src/render/pages/menu.js");
const C = await import("../src/render/pages/card.js");
const md = await import("../src/render/menudraw.js");
const W = await import("../src/render/words.js");
const { setTextScale } = await import("../src/render/kit/type.js");
const { worldTokens, CONST } = await import("../src/render/kit/tokens.js");
const probe = await import("../src/render/kit/probe.js");
const logo = await import("../src/render/logo/draw2d.js");
const { ITEMS, SCREEN, createMenuApp } = await import("../src/app/menuapp.js");
const { shellGeo, fitBox, stageCss } = await import("../src/app/fit.js");
const { setHints } = await import("../src/render/hintcopy.js");
const { wordsOf } = await import("../src/app/hints.js");
const { DEF_CONTROLS } = await import("../src/app/controls.js");
const SV = await import("../src/render/shellview.js");
const { heatRoster, heatProfile } = await import("../src/core/heat.js");
const { applyPact, PACT } = await import("../src/core/pact.js");
const { biomeOf, T, key, isFinale } = await import("../src/core/config.js");
const { HOME, TILE_NAME, TILE_HELP } = await import("../src/core/feat.js");
const { FOES } = await import("../src/core/entities.js");
const { genBoard } = await import("../src/core/board.js");

const PG = shellGeo(393, 852);
const BOX = {
  d1366: { W: 1366, H: 768, touch: false, shell: true, css: 1 },
  d1024: { W: 1024, H: 768, touch: false, shell: true, css: 1 },
  l1024: { W: 1024, H: 768, touch: true, shell: true, css: 1 },
  l1024x600: { W: 1024, H: 600, touch: true, shell: true, css: 1 },
  p393: { W: PG.w, H: PG.h, touch: true, shell: true, css: PG.s },
  c600: { W: 600, H: 520, touch: false, shell: false, css: 1 },
  iso: { W: 608, H: 352, touch: false, shell: false, css: 1 },
  c852x393: { W: 600, H: 520, touch: true, shell: false, css: stageCss(fitBox(852, 393, true, 600, 520).s, 600, 520, 1, 1) },
};
const CARDB = ["d1366", "d1024", "l1024", "l1024x600", "p393", "c600", "iso"];
const UI = (o) => ({ rows: ITEMS, focus: "PLAY", level: 1, run: { heat: 0, pace: 0, pact: 0 }, daily: null, best: null, look: 0, pages: 4, rev: "v201", note: "", pad: "", enterT: 9, ...o });
const inside = (a, b, e = 0.01) => a.x >= b.x - e && a.y >= b.y - e && a.x + a.w <= b.x + b.w + e && a.y + a.h <= b.y + b.h + e;
const over = (a, b) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
const fresh = () => { cache.release(); cache._dbg.misses = 0; made.length = 0; };
function frame(F, ui, o = {}) {
  const t = rec({ widthK: K8 });
  t.ctx.setTransform(o.dpr || 2, 0, 0, o.dpr || 2, 0, 0);
  const n0 = made.length, m0 = cache._dbg.misses;
  P.drawMenuPage(t.ctx, F, ui, o.t || 0);
  return { t, cvs: made.slice(n0), miss: cache._dbg.misses - m0 };
}
/* the strings the page drew this frame, live and in its plate layer (the card lives there) */
const drawnTexts = (f) => { const S = P._dbg.last.S; return [f.t, ...(S.plate ? [S.plate.r] : [])].flatMap((r) => r.texts).map((t) => t.s); };
const RUNS = [{ heat: 0, pace: 0, pact: 0 }, { heat: 1, pace: -1, pact: 0 }, { heat: 2, pace: 1, pact: 15, time: true }];

/* ---- one roster, from core ---- */
{
  const bad = [];
  for (let lv = 1; lv <= 8; lv++) for (let h = 0; h < 3; h++) {
    const want = [];
    for (const t of heatRoster(lv, h)) { const e = want.find((o) => o.t === t); if (e) e.n++; else want.push({ t, n: 1 }); }
    if (J(C.rosterOf(lv, h)) !== J(want)) bad.push([lv, h]);
  }
  check("rosterOf: heatRoster deduped in first-seen order, every level and heat; menudraw's rosterOf is the card's (one roster, not two)", bad.length === 0 && md.rosterOf === C.rosterOf, J(bad));
}
/* ---- the facts: LIVES / FUSE / SCORE from heatProfile through applyPact, the floor tile from core feat, FINALE from isFinale ---- */
{
  const bad = [];
  for (let lv = 1; lv <= 8; lv++) for (let h = 0; h < 3; h++) for (const pact of [0, PACT.LAST, 15]) {
    const f = C.cardFacts({ level: lv, heat: h, pact }), p = applyPact(heatProfile(h), pact), k = HOME[biomeOf(lv).name];
    if (f.world !== biomeOf(lv).name || f.lives !== p.lives || f.fuse !== p.fuse + "s" || f.score !== "×" + (h + 1) || f.tile.name !== TILE_NAME[k] || f.tile.help !== TILE_HELP[k][h] || f.fin !== isFinale(lv)) bad.push([lv, h, pact, f]);
  }
  check("cardFacts: the world, LIVES (ONE LIFE reads 1), FUSE n.ns unspaced, SCORE ×(heat + 1), the floor tile's name and its heat's help line, FINALE", bad.length === 0, J(bad.slice(0, 2)));
}

/* ---- every roster foe appears; ×n beside a foe met n > 1 times, no count beside a lone one (fix round 1, lead ruling: the approved mock) ---- */
{
  const bad = [];
  for (const ts of [1, 1.25]) for (const b of CARDB) for (let lv = 1; lv <= 8; lv++) for (const run of RUNS) {
    setTextScale(ts); fresh();
    const f = frame(BOX[b], UI({ level: lv, run })), card = P._dbg.last.P.card, texts = drawnTexts(f), ros = C.rosterOf(lv, run.heat);
    if (!card) { bad.push(b + " no card"); continue; }
    const ok = ros.filter((e) => { const it = card.foes.find((q) => q.t === e.t); return it && (e.n > 1 ? it.cnt && it.cnt.s === "×" + e.n && texts.includes("×" + e.n) : it.cnt === null); });
    const counts = card.texts.filter((t) => /^×\d+$/.test(t.s) && card.foes.some((q) => q.cnt === t)).length;
    if (ok.length !== ros.length || card.foes.length !== ros.length || counts !== ros.filter((e) => e.n > 1).length) bad.push(`${b} x${ts} L${lv} ${J(run)}: ${card.foes.map((q) => q.t + (q.cnt ? q.cnt.s : "")).join(",")}`);
  }
  setTextScale(1);
  check("every roster foe has its cell; a foe met n > 1 times shows ×n equal to its roster count, a lone foe shows none (levels 1-8, three runs, desk / l / p / iso, x1 and x1.25)", bad.length === 0, bad.slice(0, 4).join(" | "));
}

/* ---- the lane: MAKO on his spawn FLOOR cell, the foe and the tile on floor too; a strip, never the whole board ---- */
{
  const bad = [];
  for (const b of ["d1366", "p393", "iso"]) for (let lv = 1; lv <= 8; lv++) {
    fresh(); frame(BOX[b], UI({ level: lv }));
    const L = P._dbg.last.P.card.lane;
    const vis = (q) => q.y >= L.y - 0.01 && q.y + q.h <= L.y + L.h + 0.01 && q.x >= L.x - 0.01 && q.x + q.w <= L.x + L.w + 0.01;
    if (L.mako.kind !== T.EMPTY || L.foe.kind !== T.EMPTY || L.tile.kind !== T.EMPTY || !vis(L.mako) || !vis(L.foe) || !vis(L.tile) || L.mako.cx !== 1 || L.mako.cy !== 1) bad.push(`${b} L${lv} ${J(L.mako)} ${J(L.foe)} ${J(L.tile)}`);
    if (!(L.rows <= 3 + 1e-9 && L.cols <= 14)) bad.push(`${b} L${lv} lane ${L.cols}x${L.rows}`);
  }
  check("the lane: MAKO stands on his spawn cell (1,1), a FLOOR cell, shown whole; the room's foe and floor tile on FLOOR cells, shown whole; at most 14 x 3 cells (a strip)", bad.length === 0, bad.slice(0, 3).join(" | "));
}

/* ---- the card never claims the dealt board ---- */
{
  const words = [];
  for (const b of ["d1366", "p393"]) for (let lv = 1; lv <= 8; lv++) for (const run of RUNS) {
    fresh(); frame(BOX[b], UI({ level: lv, run }));
    for (const t of P._dbg.last.P.card.texts) if (/BOARD|SEED|THIS|TODAY|DEALT|LAYOUT/.test(t.s)) words.push(t.s);
  }
  check("no card word claims a board (BOARD, SEED, THIS, TODAY, DEALT, LAYOUT): the card names the world, the foes, the tile and the stats", words.length === 0, J(words));
  /* the deal moves the board, never the card: MENU drawn through the real drawShell over two worlds with different seeds and boards paints the same plate */
  const hash = (r) => { const s = J(r.calls); let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(16) + ":" + r.calls.length; };
  const app = createMenuApp({ settings: {} });
  app.screen = SCREEN.MENU; app.subT = 9; app.level = 3;
  const plateOf = (seed) => {
    fresh();
    const world = { state: "PLAY", time: 1, seed, level: 3, grid: genBoard(seed, 3, 0.3) };
    SV.drawShell(rec({ widthK: K8 }).ctx, app, world, null, "2d", () => [], () => 0, () => ({ top: [], daily: null }));
    return hash(P._dbg.last.S.plate ? P._dbg.last.S.plate.r : { calls: [] });
  };
  const g1 = genBoard(11, 3, 0.3), g2 = genBoard(977, 3, 0.3);
  check("the deal never reaches the card: two worlds with different seeds (different boards) paint the same MENU plate, card included", [...g1].some((v, i) => v !== g2[i]) && plateOf(11) === plateOf(977));
  const lg = C.cardLane(3);
  check("the lane is the representative start corner (kit laneGrid: the sealed spawn pocket over the fixed room look layout), not a dealt board", lg.grid[key(1, 1)] === T.EMPTY && lg.grid[key(2, 1)] === T.EMPTY && lg.grid[key(1, 2)] === T.EMPTY && lg.grid[key(5, 1)] === T.BRICK && lg.grid[key(1, 5)] === T.BRICK);
}

/* ---- every word whole at x1 and x1.25, inside the card's inner box, no two of its parts overlapping; the card inside the plate ---- */
{
  const bad = [];
  for (const ts of [1, 1.25]) for (const b of CARDB) for (const lv of [1, 3, 5, 8]) for (const run of RUNS) {
    setTextScale(ts); fresh();
    const f = frame(BOX[b], UI({ level: lv, run })), G = P.menuGeom(BOX[b]), card = P._dbg.last.P.card, d = G.d, texts = drawnTexts(f);
    const tag = `${b} x${ts} L${lv} ${J(run)}`;
    if (texts.some((s) => /…/.test(s))) bad.push(tag + " ellipsis");
    if (card.over) bad.push(tag + " over: the card's content does not fit its slot");
    if (!inside(card.box, d.card) || !inside(d.card, d.plate)) bad.push(tag + " card outside its slot or the plate");
    for (const t of card.texts) {
      const r = { x: t.align === "right" ? t.x - t.w : t.x, y: t.y - t.px * ts * 0.5, w: t.w, h: t.px * ts };
      if (!inside(r, card.inner, 0.5)) bad.push(tag + " text outside: " + t.s);
      if (!texts.includes(t.s)) bad.push(tag + " planned, not drawn: " + t.s);
    }
    const parts = card.parts;
    for (let i = 0; i < parts.length; i++) {
      if (!inside(parts[i], card.inner, 0.5)) bad.push(tag + " part outside: " + parts[i].name);
      for (let j = i + 1; j < parts.length; j++) if (over(parts[i], parts[j])) bad.push(tag + " overlap: " + parts[i].name + " / " + parts[j].name);
    }
    if (!card.texts.some((t) => t.s === biomeOf(lv).name || t.s === W.LABEL.LEVEL + " " + lv + " · " + biomeOf(lv).name)) bad.push(tag + " no world name");
    if (!card.texts.some((t) => t.s === TILE_NAME[HOME[biomeOf(lv).name]])) bad.push(tag + " no floor tile name");
  }
  setTextScale(1);
  check("the card: every word whole (no …), inside its inner box, its parts (lane, foe cells, counts, tile, stat cells, text lines) never overlapping, inside its slot and the plate; the world and the tile named (desk / l / p / iso / #c, x1 and x1.25)", bad.length === 0, bad.slice(0, 6).join(" | "));
}
/* the compact arrangement has no card slot: PLAY's tag carries the run */
{
  fresh(); frame(BOX.c852x393, UI({ level: 8, run: RUNS[2] }));
  check("compact (a landscape phone): no card", P._dbg.last.P.card === null && P.menuGeom(BOX.c852x393).card === null);
}
/* the desk card at 1366 x 768 follows the mock: kicker NEXT RUN · LEVEL n, the world in display type, the lane 14 cells across, YOU'LL MEET, the floor tile, three stat cells */
{
  fresh(); frame(BOX.d1366, UI({ level: 1 }));
  const card = P._dbg.last.P.card, s = card.texts.map((t) => t.s);
  const sentry = card.foes.find((q) => q.t === "stationary"), walker = card.foes.find((q) => q.t === "walker");
  check("desk card (JUNGLE): NEXT RUN · LEVEL 1, YOUR FIRST LEVEL, JUNGLE, YOU'LL MEET, FLOOR TILE, BOOSTER, LIVES, FUSE 2.5s, SCORE ×1; WALKER ×2, SENTRY bare; lane 14 cells, 2.5 rows; no finale flag", ["NEXT RUN · LEVEL 1", "YOUR FIRST LEVEL", "JUNGLE", "YOU'LL MEET", "FLOOR TILE", "BOOSTER", "LIVES", "FUSE", "2.5s", "SCORE", "×1"].every((w) => s.includes(w)) && walker.cnt && walker.cnt.s === "×2" && sentry.cnt === null && card.lane.cols === 14 && Math.abs(card.lane.rows - 2.5) < 1e-9 && card.hearts.length === 3 && card.glyphs.length === 0 && !s.includes("FINALE"), J(s));
  fresh(); frame(BOX.d1366, UI({ level: 8 }));
  const cw = P._dbg.last.P.card;
  check("desk card (CROWN, the mock's frame, review item 6): nine bare foe cells in ONE row at 40 px, the lane back at 2.5 rows", cw.foes.length === 9 && cw.foes.every((q) => q.s === 40 && q.y === cw.foes[0].y && q.cnt === null) && Math.abs(cw.lane.rows - 2.5) < 1e-9, J([cw.foes.map((q) => [q.s, q.y]), cw.lane.rows]));
  fresh(); frame(BOX.d1366, UI({ level: 8, run: { heat: 2, pace: 0, pact: PACT.LAST } }));
  const c8 = P._dbg.last.P.card, s8 = c8.texts.map((t) => t.s);
  check("desk card (CROWN, EXPERT, ONE LIFE): THE LAST FINALE, one heart, FUSE 2.1s, SCORE ×3, nine foes", s8.includes("THE LAST FINALE") && c8.hearts.length === 1 && s8.includes("2.1s") && s8.includes("×3") && c8.foes.length === 9, J(s8));
  for (const ts of [1, 1.25]) { // R1 kit leftover: the MENU phone's finale line is the flag + FINALE, never THE LAST FINALE (the desk's kicker words)
    setTextScale(ts); fresh(); frame(BOX.p393, UI({ level: 8, run: { heat: 2, pace: 0, pact: PACT.LAST } }));
    const p8 = P._dbg.last.P.card, t8 = p8.texts.map((t) => t.s), fl = p8.glyphs.filter((g) => g.n === "flag");
    check(`phone card x${ts} (CROWN, EXPERT, ONE LIFE): the finale line is the flag and FINALE, never THE LAST FINALE`, p8.dev === "p" && !t8.some((q) => /LAST FINALE/.test(q)) && t8.filter((q) => q === "FINALE").length === 1 && fl.length === 1 && t8.includes("LEVEL 8 · CROWN"), J(t8));
  }
  setTextScale(1);
  fresh(); frame(BOX.p393, UI({ level: 1 }));
  const cp = P._dbg.last.P.card, sp = cp.texts.map((t) => t.s);
  check("phone card: the lane on top (9 cells across), LEVEL 1 · JUNGLE, the foes, the floor tile, LIVES and FUSE", cp.lane.cols === 9 && cp.lane.y < Math.min(...cp.foes.map((q) => q.y)) && sp.includes("LEVEL 1 · JUNGLE") && sp.includes("BOOSTER") && sp.includes("LIVES") && sp.includes("2.5s"), J(sp));
}

/* ---- fix round 1, review item 4 (appendix 7.2 mark(glyph, word), tileCell labelled FLOOR TILE): the finale flag is the kit glyph beside FINALE on a
   finale level (desk beside the world, phone right of the level line), never a font character; the phone's tile row carries FLOOR TILE ---- */
{
  const bad = [];
  for (const ts of [1, 1.25]) for (const b of ["d1366", "d1024", "p393", "iso"]) for (let lv = 1; lv <= 8; lv++) {
    setTextScale(ts); fresh();
    const f = frame(BOX[b], UI({ level: lv })), card = P._dbg.last.P.card, s = card.texts.map((t) => t.s), fin = isFinale(lv), S = P._dbg.last.S;
    const flags = card.glyphs.filter((g) => g.n === "flag"), tag = `${b} x${ts} L${lv}`;
    if (fin && (flags.length !== 1 || !s.includes("FINALE"))) bad.push(tag + " no flag + FINALE");
    if (!fin && (flags.length || s.includes("FINALE"))) bad.push(tag + " a flag off a finale");
    if (s.filter((q) => q === "FINALE").length > 1) bad.push(tag + " FINALE twice");
    if (lv === 5 && card.dev === "d" && s.some((q) => /FINALE/.test(q) && q !== "FINALE")) bad.push(tag + " a second finale word in the kicker");
    if (drawnTexts(f).some((q) => /[⚑⚐]/.test(q))) bad.push(tag + " a flag font character");
    for (const g of flags) if (String(g.col).toLowerCase() === CONST.yel || String(g.col).toLowerCase() === CONST.cor) bad.push(tag + " flag in yellow or coral");
    if (card.dev === "p" && !s.includes("FLOOR TILE")) bad.push(tag + " phone tile row without FLOOR TILE");
    if (card.over || card.lane.rows < 1.85 - 1e-9) bad.push(tag + " over, or the lane under 1.85 rows");
  }
  setTextScale(1);
  check("finale levels (5, 8) show the kit flag glyph and FINALE once (no font flag, never yellow or coral; level 5's kicker carries no second FINALE); other levels none; the phone tile row reads FLOOR TILE; nothing over, the lane >= 1.85 rows (x1, x1.25)", bad.length === 0, bad.slice(0, 6).join(" | "));
  fresh(); probe.setOn(true); frame(BOX.d1366, UI({ level: 8 }));
  const snap = probe.snapshot(); probe.setOn(false);
  check("the flag glyph is recorded as an info pair with its colour (the gates measure it)", snap.pairs.some((q) => q.kind === "info" && /flag/.test(q.name || "") && !!q.col) && !snap.fault, J(snap.pairs.filter((q) => q.kind === "info").map((q) => q.name)));
  const fr = rec(); (await import("../src/render/kit/paint.js")).glyph(fr.ctx, "flag", 0, 0, 16, CONST.t2);
  check("kit glyph flag: a pole and a pennant drawn as paths (a stroke and a fill), no text", fr.paints.some((q) => q.op === "stroke") && fr.paints.some((q) => q.op === "fill") && fr.texts.length === 0);
}

/* ---- one yellow, the ring, 44 px: the card adds no yellow fill, no ring, no tap target; a tap on it does nothing ---- */
{
  const pageCvs = () => { const S = P._dbg.last.S, out = []; if (S.room) out.push(S.room); if (S.plate) out.push(S.plate); for (const q of S.feet || []) if (S.foot[q.v]) out.push(S.foot[q.v]); return out; };
  for (const b of ["d1366", "p393", "iso"]) for (const lv of [1, 2, 8]) {
    fresh(); logo._dbg.on = true;
    const f = frame(BOX[b], UI({ level: lv, run: RUNS[2] })), G = P.menuGeom(BOX[b]), S = P._dbg.last.S;
    const back = (q) => q && { x: S.pb.x + q.x * S.pb.w / S.plate.width, y: S.pb.y + q.y * S.pb.h / S.plate.height, w: q.w * S.pb.w / S.plate.width, h: q.h * S.pb.h / S.plate.height };
    const yel = S.plate.r.paints.filter((p) => (p.op === "fill" || p.op === "fillRect") && String(p.style).toLowerCase() === CONST.yel).map((p) => back(p.box)).filter((q) => q && over(q, G.card));
    check(`one yellow (${b}, level ${lv}): the card paints no #ffd447 (PLAY keeps the one)`, yel.length === 0, J(yel));
    const rings = [f.t, ...pageCvs().map((c) => c.r)].flatMap((r) => r.paints).filter((p) => p.op === "stroke" && String(p.style).toLowerCase() === CONST.ink && p.lw === 3);
    check(`the ring (${b}, level ${lv}): still one 3 px cream ring (PLAY's), none on the card`, rings.length === 1);
    const hit = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.9]].map(([a, c]) => P.menuHit(G.card.x + a * G.card.w, G.card.y + c * G.card.h, BOX[b]));
    check(`44 px (${b}): the card is no tap target (a tap on it is -1); every row still >= 44 CSS px on touch`, hit.every((v) => v === -1) && (!BOX[b].touch || ITEMS.every((l) => G.rows[l].h * BOX[b].css >= 43.95)), J(hit));
  }
}

/* ---- the frame: the card lives in the plate layer; two idle frames equal, 0 misses; a run change refills the plate once ---- */
{
  const hashOf = (calls) => { const s = J(calls); let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(16) + ":" + calls.length; };
  for (const b of ["d1366", "p393"]) {
    const ctx = rec({ widthK: K8 }); ctx.ctx.setTransform(2, 0, 0, 2, 0, 0);
    const one = (ui) => { const n0 = ctx.calls.length, m0 = cache._dbg.misses; P.drawMenuPage(ctx.ctx, BOX[b], ui, 0.5); const calls = ctx.calls.slice(n0); return { calls, miss: cache._dbg.misses - m0, hash: hashOf(calls), measure: calls.filter((c) => c.op === "measureText").length }; };
    fresh();
    const ui = UI({ level: 8, run: RUNS[2] });
    one(ui);
    const a = one(ui), c = one(ui);
    check(`two idle frames with the card (${b}, CROWN, every modifier): equal call-log hashes, 0 misses, <= 400 calls, <= 20 measureText`, a.hash === c.hash && a.miss === 0 && c.miss === 0 && a.calls.length <= 400 && a.measure <= 20, J([a.hash, c.hash, a.miss, a.calls.length, a.measure]));
    check(`the card paints nothing live (${b}): no foe, lane or stat text in the steady frame's own calls`, !a.calls.some((q) => q.op === "fillText" && /^(×\d|YOU'LL MEET|LIVES|FUSE|SCORE|FLOOR TILE)$/.test(String(q.a && q.a[0]))));
    const moves = ITEMS.map((l) => one(UI({ level: 8, run: RUNS[2], focus: l })));
    check(`a cursor move with the card (${b}) misses nothing`, moves.every((m) => m.miss === 0 && m.calls.length <= 400), J(moves.map((m) => [m.miss, m.calls.length])));
    const plate0 = P._dbg.last.S.plate, h1 = one(UI({ level: 8, run: { heat: 1, pace: 1, pact: 15, time: true } })), plate1 = P._dbg.last.S.plate, h2 = one(UI({ level: 8, run: { heat: 1, pace: 1, pact: 15, time: true } }));
    check(`a run change (heat) re-rasters the plate once (${b}): misses on the first frame, none on the next; the room keeps its canvas`, h1.miss >= 1 && h2.miss === 0 && plate1 !== plate0, J([h1.miss, h2.miss]));
  }
  /* the plate's key holds what the card shows, never the hint words: a device flip still re-rasters only the feet */
  fresh();
  const t = rec({ widthK: K8 }); t.ctx.setTransform(2, 0, 0, 2, 0, 0);
  const draw = (ui) => { const m0 = cache._dbg.misses; P.drawMenuPage(t.ctx, BOX.d1366, ui, 0.5); const S = P._dbg.last.S; return { plate: S.plate, room: S.room, miss: cache._dbg.misses - m0 }; };
  setHints(null); const k0 = draw(UI({ level: 8 }));
  setHints(wordsOf("pad", DEF_CONTROLS)); const k1 = draw(UI({ level: 8 }));
  setHints(null);
  check("desk: a key -> controller flip keeps the plate (card inside) and the room; only the feet miss", k1.plate === k0.plate && k1.room === k0.room && k1.miss === 3, J(k1.miss));
}

/* ---- memory (lead ruling 2; fix round 1, review Important 1): the foot reserve is the bare three-verb feet measured at the text scale in force, so
   at 1366 x 768 @2 with the card and the logo present the room's dpr is >= 1.5 at text scale 1 and >= DPR125 at 1.25 (the 125 % plate is 1180 wide:
   1.5 there leaves room for under one foot), the cache <= 24 MiB, for keys and a controller alike ---- */
{
  const DPR125 = 1.41;
  {
    const one = (ts, dev) => { setTextScale(ts); setHints(dev === "pad" ? wordsOf("pad", DEF_CONTROLS) : null); fresh(); logo._dbg.on = true; const t = rec({ widthK: K8 }); t.ctx.setTransform(2, 0, 0, 2, 0, 0); P.drawMenuPage(t.ctx, BOX.d1366, UI({ level: 8, run: RUNS[2] }), 0); P.drawMenuPage(t.ctx, BOX.d1366, UI({ level: 8, run: RUNS[2] }), 0); const S = P._dbg.last.S, L = logo._dbg.last || {}; return { rd: S.rd, total: cache._dbg.bytes, logo: !!(L.world && L.world.width), live: S.live, feet: S.feet.filter((q) => S.foot[q.v] && S.foot[q.v].width).length }; };
    const M = { "x1 keys": one(1, "key"), "x1 controller": one(1, "pad"), "x1.25 keys": one(1.25, "key"), "x1.25 controller": one(1.25, "pad") };
    setTextScale(1); setHints(null);
    console.log("  NOTE 1366x768@2 room dpr by text scale and device " + J(M));
    check(`1366x768 @2: room dpr >= 1.5 at text scale 1 and >= ${DPR125} at 1.25, keys and controller alike (the flip keeps the room key); the cache <= 24 MiB with the logo; the feet cached`, M["x1 keys"].rd >= 1.5 && M["x1 controller"].rd >= 1.5 && M["x1.25 keys"].rd >= DPR125 && M["x1.25 controller"].rd >= DPR125 && M["x1 keys"].rd === M["x1 controller"].rd && M["x1.25 keys"].rd === M["x1.25 controller"].rd && Object.values(M).every((m) => m.total <= cache.BUDGET && m.logo && !m.live && m.feet >= 2), J(M));
  }
  const run = (F, dpr, ui) => { fresh(); logo._dbg.on = true; const t = rec({ widthK: K8 }); t.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); P.drawMenuPage(t.ctx, F, ui, 0); P.drawMenuPage(t.ctx, F, ui, 0); const S = P._dbg.last.S, L = logo._dbg.last || {}; return { rd: S.rd, total: cache._dbg.bytes, logo: !!(L.world && L.world.width), room: S.room && S.room.width, plate: S.plate && S.plate.width }; };
  const R = {};
  for (const [nm, F, dpr] of [["1366x768@2", BOX.d1366, 2], ["1024x768@2", BOX.d1024, 2], ["2560x1440@2", { W: 2560, H: 1440, touch: false, shell: true, css: 1 }, 2], ["phone@2.7", BOX.p393, 2.7]]) for (const lv of [1, 8]) R[nm + " L" + lv] = run(F, dpr, UI({ level: lv, run: RUNS[2] }));
  console.log("  NOTE room dpr and cache bytes " + J(R));
  check("1366x768 @2: the room layer's dpr >= 1.5 with the card (in the plate layer) and the logo present", R["1366x768@2 L1"].rd >= 1.5 && R["1366x768@2 L8"].rd >= 1.5, J([R["1366x768@2 L1"].rd, R["1366x768@2 L8"].rd]));
  check("every box: the whole cache <= 24 MiB with the room, the plate (card inside) and the logo all live", Object.values(R).every((r) => r.total <= cache.BUDGET && r.logo && r.room && r.plate), J(R));
  /* a controller with the sound note (three feet, the widest words) overflows the fixed foot reserve: those feet paint live, the room keeps its dpr */
  setHints(wordsOf("pad", DEF_CONTROLS));
  const a = run(BOX.d1366, 2, UI({ level: 1 })), b = run(BOX.d1366, 2, UI({ level: 1, note: "NO SOUND YET · PRESS A KEY OR TAP" }));
  const t = rec({ widthK: K8 }); t.ctx.setTransform(2, 0, 0, 2, 0, 0);
  const n0 = t.calls.length, m0 = cache._dbg.misses;
  P.drawMenuPage(t.ctx, BOX.d1366, UI({ level: 1, note: "NO SOUND YET · PRESS A KEY OR TAP" }), 0.5);
  const calls = t.calls.slice(n0), texts = calls.filter((q) => q.op === "fillText").map((q) => q.a[0]);
  setHints(null);
  check("controller + sound note: the room's dpr does not move, the frame stays <= 400 calls with 0 misses, the note is drawn whole (live)", a.rd === b.rd && cache._dbg.misses === m0 && calls.length <= 400 && texts.includes("NO SOUND YET · PRESS A KEY OR TAP") && b.total <= cache.BUDGET, J([a.rd, b.rd, calls.length]));
}

/* ---- the probe: the card's texts and rect, each text with its colour and role ---- */
{
  for (const b of ["d1366", "p393"]) {
    fresh(); probe.setOn(true);
    frame(BOX[b], UI({ level: 2 }));
    const s = probe.snapshot(); probe.setOn(false);
    const card = P._dbg.last.P.card, cr = s.rects.find((r) => r.name === "card"), want = card.texts.map((t) => t.s);
    check(`probe (${b}): a card rect at the card's box, every card text recorded with a colour and a role, no fault`, !!cr && !s.fault && want.every((w) => s.texts.some((t) => t.s === w && !!t.col && !!t.role)) && !cr.touch, J({ fault: s.fault, missing: want.filter((w) => !s.texts.some((t) => t.s === w)) }));
  }
}

/* ---- carry-over fix (3.1 review): the desk SOURCE teaser is always the plain teaser colour; the phone's carries the note in cream ---- */
{
  const col = () => P._dbg.last.P.rows.SOURCE.tz && P._dbg.last.P.rows.SOURCE.tz.col;
  const pcol = () => { const S = P._dbg.last.S, t = S.plate.r.texts.find((q) => q.s === "GITHUB"); return t && String(t.fill).toLowerCase(); };
  fresh();
  frame(BOX.d1366, UI()); const c0 = col(), p0 = pcol();
  frame(BOX.d1366, UI({ note: "NO SOUND YET · PRESS A KEY OR TAP" })); const c1 = col(), p1 = pcol();
  frame(BOX.d1366, UI({ pad: "CONTROLLER READY" })); const c2 = col();
  frame(BOX.d1366, UI()); const c3 = col(), p3 = pcol();
  check("desk: SOURCE's GITHUB teaser stays the plain teaser colour before, while and after a note or a controller sign (plan and baked plate)", [c0, c1, c2, c3].every((c) => c === P.TZ) && [p0, p1, p3].every((c) => c === P.TZ.toLowerCase()), J([c0, c1, c2, c3, p0, p1, p3]));
  frame(BOX.p393, UI({ note: "NO SOUND YET · PRESS A KEY OR TAP" })); const q1 = col();
  frame(BOX.p393, UI()); const q0 = col();
  check("phone: SOURCE's teaser carries the note in cream, the build tag in the teaser colour", q1 === CONST.ink && q0 === P.TZ, J([q1, q0]));
}

/* ---- the kit parts (appendix 7.2): foeCell and tileCell, a 2 px outline with a hard 3 px drop, the art inside, the context left as found ---- */
{
  const room = await import("../src/render/kit/room.js"), bad = [];
  for (let lv = 1; lv <= 8; lv++) for (const [nm, fn] of [["foeCell", (c) => room.foeCell(c, 10, 20, 40, C.rosterOf(lv, 0)[0].t, lv)], ["tileCell", (c) => room.tileCell(c, 10, 20, 40, lv)]]) {
    const r = rec(); fn(r.ctx);
    const ol = r.paints.filter((p) => p.op === "fill" && p.style === CONST.ol).map((p) => p.box), sv = r.calls.filter((q) => q.op === "save").length, rs = r.calls.filter((q) => q.op === "restore").length;
    const drop = ol.some((b) => b && Math.abs(b.y - 23) < 0.01 && Math.abs(b.w - 40) < 0.01), face = ol.some((b) => b && Math.abs(b.y - 20) < 0.01 && Math.abs(b.h - 40) < 0.01), art = r.paints.length >= 5;
    if (!drop || !face || !art || sv !== rs) bad.push(`${nm} L${lv}: drop ${drop} face ${face} art ${r.paints.length} save/restore ${sv}/${rs}`);
  }
  check("kit foeCell / tileCell (every world): the outline, the hard 3 px drop, the art inside, save and restore balanced", bad.length === 0, bad.join(" | "));
}

/* ---- the source ---- */
{
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/render/pages/card.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  check("pages/card.js: no ctx.filter, shadowBlur, shadowColor, getImageData or toDataURL", !/\.filter\s*=|shadowBlur|shadowColor|getImageData|putImageData|toDataURL/.test(src));
  const imps = [...src.matchAll(/from\s+"([^"]+)"/g)].map((x) => x[1]);
  check("pages/card.js imports no src/app, board3, vendor or three, and no menudraw", imps.length > 3 && !imps.some((p) => /\/app\/|board3|vendor|three|menudraw/.test(p)), J(imps));
  const shell = readFileSync(new URL("../src/pwa/shell.js", import.meta.url), "utf8");
  check("card.js is in the PWA shell list (MENU is boot)", shell.includes('"src/render/pages/card.js"'));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
