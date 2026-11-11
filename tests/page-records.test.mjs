/* UI upgrade v202 Tasks 4.1 / 4.2: RECORDS on the world kit (src/render/pages/records.js, a lazy page, pages/lazy.js "records"). One geometry for draw
   and tap (recordsGeom, the same for every tab so the strip never moves), the kit tabs (bricks in a wall trough), SCORES' DIFFICULTY filter (reachable by
   key, controller and tap), its badges and its table (the MODIFIERS count, R10; placeholders never read as a played run), MEDALS' tiles; the shared
   page list of the plan (every drawn rect's centre taps to it, the probe's rects are the geometry's, the longest strings whole at text scale 1 and 1.25,
   inside the plate on desktop, landscape, phone and the iso guard; one yellow, the ring, 44 px; label before keycap; two idle frames equal with 0
   misses), the cache (the room shared with MENU, a focus move and a filter step miss nothing, a tab step paints its own layer once) and the LOADING
   stand-in. Every canvas is a textrec stub. */
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
const lazy = await import("../src/render/pages/lazy.js");
const RP = await import("../src/render/pages/records.js");
lazy._set("records", RP);
const MP = await import("../src/render/pages/menu.js");
const md = await import("../src/render/menudraw.js");
const W = await import("../src/render/words.js");
const { setTextScale, DEV } = await import("../src/render/kit/type.js");
const { CONST, worldTokens } = await import("../src/render/kit/tokens.js");
const probe = await import("../src/render/kit/probe.js");
const { ITEMS, SCREEN, createMenuApp } = await import("../src/app/menuapp.js");
const { shellGeo, fitBox, stageCss } = await import("../src/app/fit.js");
const { setHints } = await import("../src/render/hintcopy.js");
const { wordsOf } = await import("../src/app/hints.js");
const { DEF_CONTROLS } = await import("../src/app/controls.js");
const SV = await import("../src/render/shellview.js");
const { SCREENS } = await import("../tools/ui/lib/screens.mjs");
const { medalRows, MEDAL_ROWS } = await import("../src/app/medals.js");
const { DEFAULT_SCORES, isPlaceholder, scoresForHeat } = await import("../src/app/highscores.js");

const PG = shellGeo(393, 852), LG = shellGeo(1024, 768, 600, 520, "l");
const BOX = {
  d1366: { W: 1366, H: 768, touch: false, shell: true, css: 1 },
  d1920: { W: 1920, H: 1080, touch: false, shell: true, css: 1 },
  d1024: { W: 1024, H: 768, touch: false, shell: true, css: 1 },
  /* laptop windows (a 1366 x 768 screen's browser viewport is about 657 tall): the desk gives way before it scales (v202 fix round 1) */
  d1366s: { W: 1366, H: 657, touch: false, shell: true, css: 1 },
  d1280s: { W: 1280, H: 650, touch: false, shell: true, css: 1 },
  d1024s: { W: 1024, H: 600, touch: false, shell: true, css: 1 },
  c600: { W: 600, H: 520, touch: false, shell: false, css: 1 },
  iso: { W: 608, H: 352, touch: false, shell: false, css: 1 },
  p393: { W: PG.w, H: PG.h, touch: true, shell: true, css: PG.s },
  l1024: { W: LG.w, H: LG.h, touch: true, shell: true, css: LG.s },
  c600t: { W: 600, H: 520, touch: true, shell: false, css: 1 },
};
for (const [w, h] of [[852, 393], [740, 360]]) BOX["c" + w + "x" + h] = { W: 600, H: 520, touch: true, shell: false, css: stageCss(fitBox(w, h, true, 600, 520).s, 600, 520, 1, 1) };
const ALL = Object.keys(BOX), TOUCHB = ALL.filter((b) => BOX[b].touch);
const near = (a, b, e = 0.51) => Math.abs(a - b) <= e;
const nearR = (a, b, e) => near(a.x, b.x, e) && near(a.y, b.y, e) && near(a.w, b.w, e) && near(a.h, b.h, e);
const inside = (a, b, e = 0.01) => { const h = a.h != null ? a.h : a.capH; return a.x >= b.x - e && a.y >= b.y - e && a.x + a.w <= b.x + b.w + e && a.y + h <= b.y + b.h + e; }; // a probe text's box is its cap band
const css = (r, s) => ({ x: r.x * s, y: r.y * s, w: r.w * s, h: r.h * s });
const mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const LONG = Array.from({ length: 10 }, (_, i) => ({ s: 1234567 - i * 1111, l: 8 - (i % 8), d: "2026-11-" + String(10 + i).padStart(2, "0"), t: 2, p: [15, 1, 0, 3, 7, 8, 5, 2, 12, 15][i] }));
const ROWS8 = medalRows(0b10100101);
const UI = (o) => ({ page: "scores", level: 1, focus: "tabs", heat: 0, scores: LONG, plaques: 0b0101, rows: ROWS8, ...o });
function frame(F, ui, o = {}) {
  const t = o.t0 || rec({ widthK: K8 });
  const n0 = t.calls.length, m0 = cache._dbg.misses;
  RP.drawRecordsPage(t.ctx, F, ui, 0);
  return { t, calls: t.calls.slice(n0), miss: cache._dbg.misses - m0 };
}
const snap = (F, ui) => { probe.setOn(true); const f = frame(F, ui); const s = probe.snapshot(); probe.setOn(false); return { ...f, s }; };
/* a paged tab (fix round 1b) read over every page: one probe snapshot per page, in page order */
const pagesOf = (F, ui) => Array.from({ length: RP.recPages(F, ui.page, (ui.scores || []).length) }, (_, p) => snap(F, { ...ui, spage: p }).s);

/* ---- the frame: the mock's metrics (round 7 S7-pages d-08-records-stats: plate 980 wide centred, tabs 150 x 36 in the trough, the foot under it) ---- */
{
  const G = RP.recordsGeom(BOX.d1366), d = G.d;
  check("desktop 1366x768: u 1, the plate 980 wide centred, three tabs 150 x 36 six apart over an 11 px trough, the pane under it, the foot 24 under the plate",
    G.mode === "desk" && G.u === 1 && d.plate.w === 980 && near(d.plate.x, (1366 - 980) / 2, 0.01) && d.tabs.every((r, i) => r.w === 150 && r.h === 36 && near(r.x, d.tabs[0].x + i * 156, 0.01) && r.y === d.tabs[0].y) &&
      near(d.trough.y, d.tabs[0].y + 36, 0.01) && d.trough.h === 11 && near(d.pane.y, d.trough.y + 11 + 10, 0.01) && near(d.foot.y, d.plate.y + d.plate.h + 24, 0.01), J({ plate: d.plate, tabs: d.tabs, pane: d.pane, foot: d.foot }));
  setTextScale(1.25);
  const H = RP.recordsGeom(BOX.d1366);
  setTextScale(1);
  check("desktop at 125 %: the plate 1080 wide (the mock's t125), tabs 170", H.d.plate.w === 1080 && H.d.tabs[0].w === 170 && H.u <= 1, J([H.d.plate, H.u]));
  const Q = RP.recordsGeom(BOX.p393), q = (r) => r; // the phone column is laid out in CSS px (u = 1 / css): its design rects are CSS px
  check("phone 393x852 (#sh at ~0.9): the column 12 CSS px in from each side, a 44 px BACK key, three equal 44 px tabs across, the pane to the plate's foot",
    Q.mode === "phone" && near(q(Q.d.plate).x, 12, 0.6) && near(q(Q.d.plate).w, 369, 1.2) && near(q(Q.d.back).h, 44, 0.01) && Q.d.tabs.every((r) => near(r.w, Q.d.tabs[0].w, 0.01) && near(q(r).h, 44, 0.01)) && !Q.foot,
    J([q(Q.d.plate), q(Q.d.back), Q.d.tabs.map(q)]));
  check("1920x1080: the mock's plate (980) centred, nothing stretched; 600x520 #c and 608x352 iso: the desk scaled as one piece", RP.recordsGeom(BOX.d1920).u === 1 && RP.recordsGeom(BOX.d1920).d.plate.w === 980 && RP.recordsGeom(BOX.c600).u < 1 && RP.recordsGeom(BOX.iso).u < 1);
}
/* inside: every part (and its focus ring, 6 px out) inside the plate, the plate's ring inside the box, the foot inside the box */
for (const b of ALL) for (const ts of [1, 1.25]) {
  setTextScale(ts);
  const G = RP.recordsGeom(BOX[b]), u = G.u, d = G.d, ring = { x: G.plate.x - G.T - 2 * u, y: G.plate.y - G.T - 2 * u, w: G.plate.w + 2 * G.T + 4 * u, h: G.plate.h + 2 * G.T + 5 * u };
  const parts = [...G.tabs, ...G.keys, ...(G.back ? [G.back] : [])].map((r) => ({ x: r.x - 6 * u, y: r.y - 8 * u, w: r.w + 12 * u, h: r.h + 14 * u })), out = parts.filter((r) => !inside(r, G.plate));
  const bodies = ["scores", "medals"].every((p) => { const B = d.bodies[p]; return (B.tiles || B.keys).every((r) => inside(r, d.pane)) && (!B.rows || inside(B.rows, d.pane)); });
  check(`inside (${b}${ts > 1 ? " t125" : ""}): every tab, difficulty and BACK key with its ring inside the plate, both bodies inside the pane, the plate's ring${G.foot ? " and the foot" : ""} inside the box`,
    out.length === 0 && bodies && inside(ring, { x: 0, y: 0, w: G.W, h: G.H }) && (!G.foot || inside(G.foot, { x: 0, y: 0, w: G.W, h: G.H })), J({ out, ring, foot: G.foot }));
  setTextScale(1);
}
/* touch: every target >= 44 CSS px; targets of different sets (BACK, the tabs, the difficulties) >= 8 apart; one set's own keys sit as one control */
for (const b of TOUCHB) {
  const G = RP.recordsGeom(BOX[b]), s = BOX[b].css, sets = [[G.back], G.tabs, G.keys].map((a) => a.filter(Boolean).map((r) => css(r, s)));
  const small = sets.flat().filter((r) => r.w < 43.95 || r.h < 43.95);
  let gap = Infinity;
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) for (const a of sets[i]) for (const c of sets[j]) gap = Math.min(gap, Math.max(c.x - (a.x + a.w), a.x - (c.x + c.w), c.y - (a.y + a.h), a.y - (c.y + c.h)));
  check(`touch (${b}): BACK, the tabs and the difficulties >= 44 x 44 CSS px; >= 8 px between sets`, small.length === 0 && gap >= 8, J({ small, gap }));
}

/* ---- hit: draw = tap ---- */
for (const b of ALL) {
  const F = BOX[b], G = RP.recordsGeom(F), P = G.pane;
  const tabs = G.tabs.map((r) => RP.tabHit(...mid(r), F)), keys = G.keys.map((r) => RP.scoresHit(...mid(r), F));
  let clash = 0;
  for (let y = G.plate.y; y < G.plate.y + G.plate.h; y += 2) for (let x = G.plate.x; x < G.plate.x + G.plate.w; x += 3) if (RP.tabHit(x, y, F) >= 0 && RP.scoresHit(x, y, F) >= 0) clash++;
  check(`hit (${b}): each tab's centre is that tab, each difficulty's that difficulty; the pane is inert (-2), off the plate -1${G.back ? ", BACK -1" : ""}; no point is both`,
    J(tabs) === J([0, 1, 2]) && J(keys) === J([0, 1, 2]) && RP.scoresHit(P.x + P.w / 2, P.y + P.h - 6 * G.u, F) === -2 && RP.scoresHit(1, 1, F) === -1 && RP.tabHit(P.x + P.w / 2, P.y + P.h / 2, F) === -1 && (!G.back || RP.scoresHit(...mid(G.back), F) === -1) && clash === 0, J({ tabs, keys, clash }));
  const L = md.layout(F.W, F.H, F.shell ? 200 : undefined, F.css);
  check(`menudraw's entry names delegate (${b}): recTabHit and scoresHit agree with the page`, G.tabs.every((r, i) => md.recTabHit(...mid(r), L, 0, F.touch) === i && md.recTabHit(...mid(r), L, 2, F.touch) === i) && G.keys.every((r, i) => md.scoresHit(...mid(r), L, F.touch) === i));
}
/* the probe's rects are the geometry's, in three worlds alike (ICE and CROWN wear JUNGLE's layout) */
for (const b of ["d1366", "p393", "c600"]) {
  const F = BOX[b], G = RP.recordsGeom(F), rects = [1, 2, 8].map((lv) => snap(F, UI({ level: lv })).s.rects);
  const R0 = rects[0], by = (n) => R0.find((r) => r.name === n);
  const ok = G.tabs.every((r, i) => { const q = by("tab " + W.RECORD_TABS[i]); return q && near(q.x, r.x, 0.01) && near(q.w, r.w, 0.01) && near(q.y, i === 0 ? r.y - 2 * G.u : r.y, 0.01); }) &&
    G.keys.every((r, i) => { const q = by("difficulty " + W.DIFF[i]); return q && near(q.x, r.x, 0.01) && near(q.y, i === 0 ? r.y - 2 * G.u : r.y, 0.01); }) && (!G.back || nearR(by("BACK"), G.back, 0.01)) && nearR(by("plate"), G.plate, 0.01);
  const same = rects.slice(1).every((R) => R.length === R0.length && R.every((r, i) => r.name === R0[i].name && nearR(r, R0[i], 0.01)));
  check(`probe = geometry (${b}): the drawn tabs, difficulties${G.back ? ", BACK" : ""} and plate are recordsGeom's; ICE and CROWN draw JUNGLE's rects`, ok && same && R0.length >= 8, J(R0.slice(0, 6)));
}

/* ---- SCORES: the table, the modifiers count (R10), the badges, the empty state; the longest strings whole at 1 and 1.25 ---- */
const PIN_SHORT = { "p393 t125": [2] }, SHORT_DATES = {}; // box (+ t125) -> the stacked rows whose date stepped down to MM-DD (pinned: fix round 1b review)
for (const b of ALL) for (const ts of [1, 1.25]) {
  setTextScale(ts);
  const F = BOX[b], G = RP.recordsGeom(F), Ps = pagesOf(F, UI({ focus: "body", heat: 2 })), s = Ps[0], T = Ps.flatMap((q) => q.texts), B = G.d.bodies.scores, u = G.u;
  const rowsBox = { x: B.rows.x * u - 9 * u, y: B.head.y * u, w: B.rows.w * u + 18 * u, h: (B.rows.y + B.rows.h - B.head.y) * u + 0.01 };
  const plan0 = RP._dbg.last.P.scores.table, mc = plan0.stack ? null : plan0.cols.find((c) => c.n === W.LABEL.MODIFIERS), mx = mc ? (B.rows.x + mc.x * B.k) * u : (B.rows.x + plan0.l2x * B.k) * u;
  const scoresTx = T.filter((t) => /^\d{1,3}(,\d{3})+$/.test(t.s)), modsTx = T.filter((t) => Math.abs(t.x - mx) < 0.5 && t.y > (B.head.y + B.head.h) * u - 1 && (mc || / · |MODIFIER/.test(t.s)));
  const allIn = T.every((t) => inside(t, { x: G.plate.x, y: G.plate.y, w: G.plate.w, h: G.plate.h + (G.foot ? G.foot.y + G.foot.h - G.plate.y - G.plate.h : 0) }, 0.6));
  const tbl = T.filter((t) => t.y >= B.head.y * u - 0.5 && t.y < (B.rows.y + B.rows.h) * u);
  const plan = RP._dbg.last.P.scores.table, cols = plan.cols;
  const noOverlap = cols.every((c, i) => i === 0 || c.x >= cols[i - 1].x + cols[i - 1].w);
  check(`SCORES strings whole (${b}${ts > 1 ? " t125" : ""}): ten 7-digit scores, every table cell inside the table and every text inside the plate (or the foot); no ellipsis; the columns never overlap`,
    scoresTx.length === 10 && tbl.every((t) => inside(t, rowsBox, 0.6)) && allIn && !T.some((t) => /…/.test(t.s)) && noOverlap, J({ n: scoresTx.length, out: tbl.filter((t) => !inside(t, rowsBox, 0.6)).slice(0, 3), level: plan.level }));
  check(`SCORES modifiers (${b}${ts > 1 ? " t125" : ""}): a count by words.js modsCount (4 MODIFIERS, 1 MODIFIER; — for none in a column, a bare count where it steps down; a narrow table's second line names them, NO MODIFIERS, then the full date, or its month and day where a page at full size cannot hold the year: fix round 1b), never the old L/B/T/S letters`,
    (plan.stack && modsTx.forEach((t, i) => { if (t.s.split(" · ")[1] === LONG[i].d.slice(5)) (SHORT_DATES[b + (ts > 1 ? " t125" : "")] ||= []).push(i); }), true) &&
    modsTx.length === 10 && (plan.stack ? J(modsTx.map((t) => t.s.split(" · ")[0])) === J(["4 MODIFIERS", "1 MODIFIER", "NO MODIFIERS", "2 MODIFIERS", "3 MODIFIERS", "1 MODIFIER", "2 MODIFIERS", "1 MODIFIER", "2 MODIFIERS", "4 MODIFIERS"]) && modsTx.every((t, i) => t.s.split(" · ")[1] === LONG[i].d || t.s.split(" · ")[1] === LONG[i].d.slice(5)) : plan.level >= 1 ? modsTx.map((t) => t.s).join() === "4,1,—,2,3,1,2,1,2,4" : modsTx.map((t) => t.s).join() === ["4 MODIFIERS", "1 MODIFIER", "—", "2 MODIFIERS", "3 MODIFIERS", "1 MODIFIER", "2 MODIFIERS", "1 MODIFIER", "2 MODIFIERS", "4 MODIFIERS"].join()) && !T.some((t) => /^[LBTS]+$/.test(t.s)), J(modsTx.map((t) => t.s)));
  setTextScale(1);
}
/* the boxes where a full-size page cannot hold a stacked row's year, pinned exactly (every other box keeps the full date) */
check("SCORES: the date steps down to month and day only on the pinned boxes and rows", J(SHORT_DATES) === J(PIN_SHORT), J(SHORT_DATES));
{
  const F = BOX.d1366, G = RP.recordsGeom(F), B = G.d.bodies.scores;
  check("desktop: the table keeps its full words (MODIFIERS counts and full dates) at text scale 1", (snap(F, UI({ focus: "body" })), RP._dbg.last.P.scores.table.level === 0));
  for (const [nm, F2] of [["600x520", BOX.c600], ["608x352", BOX.iso]]) {
    const { s } = snap(F2, UI({ scores: DEFAULT_SCORES.map((r) => ({ ...r })) })), G2 = RP.recordsGeom(F2), u = G2.u, B2 = G2.d.bodies.scores, T = s.texts;
    const keys = W.DIFF.map((n) => T.find((t) => t.s === n && t.y < B2.badges.y * u)), ten = T.find((t) => t.s === "10"), dates = T.filter((t) => t.s === "2026-08-23"), foot = s.rects.find((r) => r.name === "foot");
    check(`SCORES at ${nm}: the NORMAL / HARD / EXPERT difficulties above ten rows (ten dates), the table inside the plate, the foot under it inside the box`,
      keys.every(Boolean) && keys.every((t) => t.y < ten.y) && !!ten && dates.length === 10 && ten.y + ten.capH <= G2.plate.y + G2.plate.h && dates.every((t) => t.y > G2.plate.y) && !!foot && foot.y >= G2.plate.y + G2.plate.h && foot.y + foot.h <= F2.H, J({ ten, foot }));
    const e = snap(F2, UI({ heat: 1, scores: [] })).s.texts;
    check(`SCORES at ${nm}: an empty HARD table says NO HARD DIFFICULTY RUNS YET and how to set one`, e.some((t) => t.s === "NO HARD DIFFICULTY RUNS YET") && e.some((t) => t.s === "PICK HARD DIFFICULTY ON LEVEL SELECT TO SET ONE"), e.map((t) => t.s).join("|"));
  }
  /* the badges (the four plaques, src/app/plaques.js bits): earned in the medal outline, not yet a lock tag in the off ink, full alpha, on their own row between
     the difficulties and the table, all inside the plate (was menudraw.test 13d) */
  const BADGE = { CLEAR: 1, PLUS: 2, MAX: 4, CROWN: 8 };
  for (const [nm, F2] of [["600x520", BOX.c600], ["608x352", BOX.iso], ["1366x768", F]]) for (const mask of [BADGE.CLEAR | BADGE.MAX, 0, 15]) {
    const t = snap(F2, UI({ plaques: mask })), G2 = RP.recordsGeom(F2), u = G2.u, B2 = G2.d.bodies.scores, row = B2.badges;
    const tags = W.BADGE_NAMES.map((n) => t.s.texts.find((x) => x.s === n && near(x.y + x.capH / 2, (row.y + row.h / 2) * u, 2 * u + 1)));
    const want = [1, 2, 4, 8].map((bit) => (mask & bit ? CONST.ink : CONST.off)), prs = (t.s.pairs || []).filter((q) => /^badge /.test(q.name || (q.o && q.o.name) || ""));
    const pcol = W.BADGE_NAMES.map((n) => { const q = prs.find((x) => (x.name || (x.o && x.o.name)) === "badge " + n); return q ? q.col || (q.o && q.o.col) : null; });
    const alphaOK = t.t.paints.filter((p) => p.op === "fillText" || true).every((p) => p.alpha === 1 || p.alpha === undefined) && t.t.writes.filter((w) => w.k === "globalAlpha").every((w) => w.v === 1);
    /* fix round 1: the medal colour is only an outline: an earned badge's word is ink inside its medal-colour outline and glyph (the info pair's colour) */
    check(`badges at ${nm}, mask ${mask}: CLEAR / HARD / EXPERT / CROWN on their own row inside the plate, between the difficulties and the table; earned = an ink word in the medal-colour outline, the rest in the off ink, at full alpha`,
      tags.every(Boolean) && tags.every((x, i) => x.col === want[i]) && pcol.every((col, i) => col === (mask & [1, 2, 4, 8][i] ? CONST.medal : CONST.off)) && tags.every((x) => inside(x, G2.plate)) && row.y > B2.bank.y + B2.bank.h && row.y + row.h < B2.head.y && alphaOK, J(tags.map((x) => x && [x.s, x.col])));
  }
}
/* placeholders never read as a played run: main's getter drops the seeded rows (a fresh profile's SCORES is the empty table), the page draws what it is
   handed; the MENU teaser reads the same played-runs list (getCab top) */
{
  const fresh = scoresForHeat(DEFAULT_SCORES.map((r) => ({ ...r })), 0).filter((r) => !isPlaceholder(r));
  const t = snap(BOX.d1366, UI({ scores: fresh })).s.texts;
  check("a fresh profile (only the seeded table): the getter hands SCORES nothing, so it reads NO NORMAL DIFFICULTY RUNS YET and prints no score", fresh.length === 0 && t.some((x) => x.s === "NO NORMAL DIFFICULTY RUNS YET") && !t.some((x) => /^\d{1,3},\d{3}$/.test(x.s)));
  const { readFileSync } = await import("node:fs"), src = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  check("main's SCORES getter and MENU's teaser getter both drop isPlaceholder rows", /getScoresForHeat = \(heat\) => scoresForHeat\(loadScores\(\), heat\)\.filter\(\(r\) => !isPlaceholder\(r\)\)/.test(src) && /top: scoresForHeat\(loadScores\(\), 0\)\.filter\(\(r\) => !isPlaceholder\(r\)\)/.test(src));
}

/* ---- MEDALS: eight tiles, every name and every whole goal (wrapped at spaces, never cut), the n/8 count; earned in the medal outline (was menudraw.test 13f
   and the iso guard) ---- */
for (const b of ALL) for (const ts of [1, 1.25]) {
  setTextScale(ts);
  const F = BOX[b], G = RP.recordsGeom(F), Ps = pagesOf(F, UI({ page: "medals" })), s = { pairs: Ps.flatMap((q) => q.pairs) }, T = Ps.flatMap((q) => q.texts);
  const tiles = Ps.flatMap((q) => q.rects.filter((r) => /^medal /.test(r.name)).map((r) => ({ ...r, q })));
  const ofTile = (r) => r.q.texts.filter((t) => inside(t, r, 0.6)), whole = MEDAL_ROWS.every(([n, desc], i) => { const tx = ofTile(tiles[i]); return tx[0] && tx[0].s === n && tx.slice(1).map((t) => t.s).join(" ") === desc; });
  const count = Ps[0].texts.filter((t) => t.y < tiles[0].y).map((t) => t.s), on = ROWS8.map((r) => r[2]);
  const glyphs = s.pairs.filter((p) => /^medal glyph /.test(p.name)).map((p) => p.col);
  check(`MEDALS (${b}${ts > 1 ? " t125" : ""}): eight tiles inside the pane, each with its name and its whole goal inside it, no ellipsis; 4/8 EARNED above them`,
    tiles.length === 8 && tiles.every((r) => inside(r, { x: G.d.pane.x * G.u, y: G.d.pane.y * G.u, w: G.d.pane.w * G.u, h: G.d.pane.h * G.u }, 0.6)) && whole && !T.some((t) => /…/.test(t.s)) && count.join(" ").indexOf("EARNED") >= 0 && J(count.slice(-2)) === J(["4/8", "EARNED"]),
    J({ count, first: ofTile(tiles[0]).map((t) => t.s), tiles: tiles.length, inPane: tiles.map((r) => inside(r, { x: G.d.pane.x * G.u, y: G.d.pane.y * G.u, w: G.d.pane.w * G.u, h: G.d.pane.h * G.u }, 0.6)), whole: MEDAL_ROWS.filter(([n, desc], i) => { const tx = ofTile(tiles[i]); return !(tx[0] && tx[0].s === n && tx.slice(1).map((t) => t.s).join(" ") === desc); }).map(([n, d]) => n + ": " + d), ell: T.filter((t) => /…/.test(t.s)).map((t) => t.s) }));
  check(`MEDALS (${b}${ts > 1 ? " t125" : ""}): an earned medal's glyph is the medal colour (with its dot), a goal's the quiet t2 outline; earned names in ink, goals in t2`,
    J(glyphs) === J(on.map((x) => (x ? CONST.medal : CONST.t2))) && MEDAL_ROWS.every(([n], i) => T.find((t) => t.s === n).col === (on[i] ? CONST.ink : CONST.t2)), J(glyphs));
  setTextScale(1);
}
{
  const t = snap(BOX.c600, UI({ page: "medals", rows: undefined })).s.texts;
  check("MEDALS with rows undefined: eight name-free placeholders, 0/8, nothing earned, no throw", t.filter((x) => x.s === "—").length === 8 && J(t.filter((x) => /^\d\/8$/.test(x.s)).map((x) => x.s)) === J(["0/8"]) && !MEDAL_ROWS.some(([n]) => t.some((x) => x.s === n)));
}
/* restored from the old menudraw 13f (fix round 1): rows undefined draws no earned glyph (no medal-colour paint at all, in the frame or its layers),
   and the page leaves globalAlpha at 1 (every paint on the target at full alpha, both with and without earned rows) */
for (const rows of [undefined, medalRows(255)]) {
  cache.release();
  const m0 = made.length, f = frame(BOX.c600, UI({ page: "medals", rows })), all = [f.t, ...made.slice(m0).map((q) => q.r)];
  const med = all.reduce((n, t) => n + t.paints.filter((p) => String(p.style).toLowerCase() === CONST.medal).length, 0);
  const alpha = f.t.ctx.globalAlpha === 1 && f.t.paints.every((p) => p.alpha === 1 || p.alpha === undefined); // left at 1, and every paint on the target at full alpha
  check(`MEDALS (rows ${rows ? "all earned" : "undefined"}): ${rows ? "earned glyphs in the medal colour" : "no earned glyph (no medal-colour paint)"}; globalAlpha left at 1`, (rows ? med > 0 : med === 0) && alpha, J({ med, alpha }));
}

/* every key's legend inside its key (the focused one past its bomb, or the ring alone where the bomb would push it out), at 1 and 1.25 on every box */
for (const b of ALL) for (const ts of [1, 1.25]) {
  setTextScale(ts);
  const bad = [];
  for (const focus of ["tabs", "body"]) {
    const { s } = snap(BOX[b], UI({ focus }));
    for (const r of s.rects.filter((q) => /^(tab |difficulty |BACK$)/.test(q.name))) {
      const word = r.name.replace(/^(tab|difficulty) /, ""), t = s.texts.find((x) => x.s === word && x.y > r.y - 1 && x.y < r.y + r.h);
      if (r.name === "BACK" && r.w / RP.recordsGeom(BOX[b]).u <= 60) { if (t) bad.push("a chevron-only BACK printed its word"); continue; } // a narrow compact header: BACK steps down to its chevron
      if (!t || !inside(t, r, 0.6)) bad.push(focus + ":" + r.name);
    }
  }
  setTextScale(1);
  check(`legends (${b}${ts > 1 ? " t125" : ""}): every tab, difficulty and BACK legend sits whole inside its key, focused or not`, bad.length === 0, bad.join());
}

/* ---- focus, yellow, label first ---- */
/* every #ffd447 FILL the recorder saw (fill, fillRect, fillText), by colour, not only the probe's rects (fix round 1): the medal is an outline, a stroke,
   never a fill, so a page with earned badges and medals still fills no #ffd447 */
const yelPaints = (t) => t.paints.filter((p) => (p.op === "fill" || p.op === "fillRect") && String(p.style).toLowerCase() === CONST.yel).length + t.texts.filter((x) => String(x.fill).toLowerCase() === CONST.yel).length;
/* the focus is the bare bomb + the ring; a touch box shows it only with a controller (tap mode shows no focus, as LEVEL SELECT; fix round 1) */
for (const b of ["d1366", "p393", "c600", "c600t", "c740x360"]) {
  const F = BOX[b], G = RP.recordsGeom(F);
  for (const [page, focus] of [["scores", "tabs"], ["scores", "body"], ["medals", "tabs"]]) {
    if (F.touch) {
      setHints(null);
      const t = snap(F, UI({ page, focus })), tr = t.t.paints.filter((p) => p.op === "stroke" && p.style === CONST.ink && p.lw === 3);
      check(`tap mode (${b}, ${page} ${focus}): no ring, no focused rect`, tr.length === 0 && !t.s.rects.some((r) => r.focus), J({ rings: tr.length }));
      setHints(wordsOf("pad", DEF_CONTROLS));
    }
    const f = snap(F, UI({ page, focus })), rings = f.t.paints.filter((p) => p.op === "stroke" && p.style === CONST.ink && p.lw === 3);
    const target = page === "scores" && focus === "body" ? G.keys[0] : G.tabs[page === "scores" ? 0 : 2];
    const yel = yelPaints(f.t), foc = f.s.rects.filter((r) => r.focus);
    check(`focus (${b}, ${page} ${focus}): one 3 px cream ring round ${focus === "body" ? "the chosen difficulty" : "the open tab"}; one focused rect; no yellow fill (the page's main action is none)`,
      rings.length === 1 && rings[0].box.x < target.x && rings[0].box.x + rings[0].box.w > target.x + target.w && foc.length === 1 && yel === 0, J({ rings: rings.map((r) => r.box), foc: foc.map((r) => r.name), yel }));
    setHints(null);
  }
}
/* the bomb is never dropped (fix round 1): with the focus shown (a keyboard box, or a controller on a touch box), every focused tab and difficulty,
   at 1 and 1.25, has its legend whole inside the key and clear of the bare bomb (left + 8, DEV bombs wide) */
{
  const bad = [];
  for (const b of ALL) for (const ts of [1, 1.25]) {
    setTextScale(ts); setHints(BOX[b].touch ? wordsOf("pad", DEF_CONTROLS) : null);
    const F = BOX[b], G = RP.recordsGeom(F), dv = DEV[G.dev], u = G.u;
    for (const [page, focus, h] of [["scores", "tabs", 0], ["medals", "tabs", 0], ["scores", "body", 0], ["scores", "body", 1], ["scores", "body", 2]]) {
      const { s } = snap(F, UI({ page, focus, heat: h })), fr = s.rects.find((r) => r.focus);
      if (!fr) { bad.push(b + " " + ts + " " + page + " " + focus + ": no focus"); continue; }
      const word = fr.name.replace(/^(tab|difficulty) /, ""), t = s.texts.find((x) => x.s === word && x.x >= fr.x - 0.5 && x.x + x.w <= fr.x + fr.w + 0.5 && x.y >= fr.y - 4 && x.y < fr.y + fr.h);
      if (!t || t.x < fr.x + (8 + dv.bombs) * u - 0.01 || t.x + t.w > fr.x + fr.w - 2 * u + 0.01) bad.push(b + " " + ts + " " + page + " " + focus + " " + word + ": " + J(t && [t.x, t.w]) + " in " + J([fr.x, fr.w]));
    }
    setHints(null); setTextScale(1);
  }
  check("the focus bomb is never dropped: every focused legend, every box, 1 and 1.25, sits whole in its key clear of the bomb", bad.length === 0, bad.slice(0, 6).join(" | "));
}
{
  /* every foot reads label first, keycaps last, for keys and a controller */
  const bad = [];
  for (const dev of ["key", "pad"]) for (const [page, foc] of [["scores", "tabs"], ["scores", "body"], ["medals", "tabs"]]) {
    const it = RP.footItems(page, foc, dev === "pad" ? wordsOf("pad", DEF_CONTROLS) : wordsOf("key", DEF_CONTROLS));
    if (!it.every((x) => typeof x.t === "string" && x.t && Array.isArray(x.caps) && x.caps.length)) bad.push(dev + page + foc);
  }
  setHints(null);
  frame(BOX.d1366, UI({ focus: "body" }));
  const parts = RP._dbg.last.S.feet.find((q) => q.v === "body").fp.parts;
  const order = parts.every((p, i) => !p.cap || (i > 0 && (parts[i - 1].t || parts[i - 1].cap)) ) && parts[0].t;
  const xs = parts.map((p) => p.x);
  check("every RECORDS foot item is a label and its keycaps, drawn label first (left of its caps), left to right", bad.length === 0 && order && xs.every((x, i) => !i || x > xs[i - 1]), J({ bad, parts: parts.map((p) => p.t || p.sep || p.cap) }));
}

/* ---- the filter by key, controller and tap ---- */
{
  const a = createMenuApp({ onStats() {}, onMedals() {} });
  a.screen = SCREEN.MENU; a.cursor = ITEMS.indexOf("RECORDS"); a.confirm();
  a.key("ArrowDown"); a.key("ArrowRight");
  check("filter by key: ↓ into the body, → steps NORMAL -> HARD", a.screen === SCREEN.SCORES && a.recFocus === 1 && a.scoreHeat === 1, a.recFocus + "/" + a.scoreHeat);
  const { Input } = await import("../src/input.js"), { createPad } = await import("../src/app/gamepad.js"), { createPadRouter } = await import("../src/app/padroute.js");
  const raw = { list: [{ connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) }] }, pad = createPad({ getGamepads: () => raw.list });
  const r = createPadRouter({ input: new Input(null), app: a, SCREEN, binds: () => DEF_CONTROLS, world: () => ({ state: "PLAY" }), onPause() {}, onUiKey: (c) => a.key(c), page: null });
  let t = 0; const run = () => r.route(pad.poll((t += 16)), t); run();
  const tap = (i) => { raw.list[0].buttons[i] = { pressed: true, value: 1 }; run(); raw.list[0].buttons[i] = { pressed: false, value: 0 }; run(); };
  tap(5);
  check("filter by controller: R SHOULDER in the body steps HARD -> EXPERT", a.scoreHeat === 2, a.scoreHeat);
  tap(15); tap(14);
  check("filter by controller: the D-PAD ← steps it back", a.scoreHeat === 1, a.scoreHeat);
  /* tap: through the real mountPointer on the page's own frame (desktop #c and the phone's #sh) */
  const { mountPointer } = await import("../src/app/pointer.js"), sc = await import("../src/render/scenes.js");
  const HIT = { overlayBox: sc.overlayBox, pauseHit: sc.pauseHit, touchLay: sc.touchLay, controlsHit: SV.controlsHit, dims: SV.dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, recTabHit: md.recTabHit, layout: md.layout };
  for (const kind of ["d", "p"]) {
    const L0 = {}, el = (w, h, rect, lay) => ({ width: w, height: h, style: {}, getBoundingClientRect: () => rect, ownerDocument: { body: { getAttribute: () => lay } }, addEventListener(ty, fn) { (L0[ty] = L0[ty] || []).push(fn); }, fire(ty, ev) { (L0[ty] || []).forEach((fn) => fn(ev)); } });
    const b = createMenuApp({ onStats() {}, onMedals() {} }); b.screen = SCREEN.SCORES; b.scoreHeat = 0;
    let cv, fit = null, surf;
    if (kind === "d") surf = cv = el(600, 520, { left: 0, top: 0, width: 600, height: 520 }, "d");
    else { const rect = { left: 0, top: 0, width: PG.w * PG.s, height: PG.h * PG.s }, sh = el(PG.w * 2, PG.h * 2, rect, "p"); surf = { width: PG.w, height: PG.h, logo: PG.logo, ownerDocument: sh.ownerDocument, getBoundingClientRect: () => rect }; cv = el(600, 520, rect, "p"); fit = { sh, box: () => surf }; L0.sh = sh; }
    mountPointer({ canvas: cv, fit, input: { _intent: { fire: false }, onUiKey: (c) => b.key(c) }, app: b, world: { state: "PLAY" }, kind: () => "2d", ctl: () => null, hit: HIT });
    const D = SV.dims(surf, "2d"), G = RP.recordsGeom({ W: D.cw, H: D.ch, touch: kind !== "d", shell: kind !== "d", css: D.css }), [x, y] = mid(G.keys[2]), r0 = surf.getBoundingClientRect(), k = r0.width / surf.width;
    (fit ? fit.sh : cv).fire("pointerdown", { clientX: x * k, clientY: y * k, currentTarget: fit ? fit.sh : cv, pointerType: "touch" });
    check(`filter by tap (${kind}): a tap on EXPERT sets it and focuses the body`, b.scoreHeat === 2 && b.recFocus === 1, b.scoreHeat + "/" + b.recFocus);
  }
}

/* ---- cache: steady frames, focus moves, filter steps, tab steps; the room shared with MENU ---- */
{
  cache.release(); cache._dbg.misses = 0;
  const F = BOX.d1366, t0 = rec({ widthK: K8 });
  MP.drawMenuPage(t0.ctx, F, { rows: ITEMS, focus: "PLAY", level: 1, rev: "v201", pages: 4, enterT: 9 }, 0);
  const menuRoom = MP._dbg.last.S.roomK;
  const ctx = rec({ widthK: K8 }), one = (ui) => { const n0 = ctx.calls.length, m0 = cache._dbg.misses; RP.drawRecordsPage(ctx.ctx, F, ui, 0); const calls = ctx.calls.slice(n0); return { calls, miss: cache._dbg.misses - m0, measure: calls.filter((c) => c.op === "measureText").length, hash: J(calls) }; };
  const first = one(UI({}));
  check("RECORDS after MENU: the room is MENU's layer (same key, no room raster), the total stays within the 24 MiB budget", RP._dbg.last.S.roomK === menuRoom && cache.touch(menuRoom) && cache._dbg.bytes <= cache.BUDGET && first.miss === 3, J({ miss: first.miss, MB: (cache._dbg.bytes / 1048576).toFixed(1) }));
  const a = one(UI({})), b = one(UI({}));
  check("two steady frames: equal call logs, 0 cache misses, <= 400 canvas calls, <= 20 measureText", a.hash === b.hash && a.miss === 0 && b.miss === 0 && a.calls.length <= 400 && a.measure <= 20, J({ calls: a.calls.length, measure: a.measure, miss: [a.miss, b.miss] }));
  const fm = one(UI({ focus: "body" }));
  const st = one(UI({ focus: "body", heat: 1, scores: LONG.slice(3) }));
  check("a focus move (tab row -> body) and a filter step paint no layer (0 misses)", fm.miss === 0 && st.miss === 0, J([fm.miss, st.miss]));
  const tb = one(UI({ page: "medals" })), tb2 = one(UI({ page: "medals" }));
  check("a tab step paints its own page layer and its own foot once (2 misses: MEDALS' foot names no DIFFICULTY), then holds (0)", tb.miss === 2 && tb2.miss === 0 && tb2.calls.length <= 400, J([tb.miss, tb2.miss, tb2.calls.length]));
  setTextScale(1.25); const big = one(UI({})); setTextScale(1);
  check("a text-scale change refills (the layers are keyed by it)", big.miss >= 1);
  check("shellview: SCORES and MEDALS cover the board (main passes covered); STATS joins with Task 4.2", SV.shellCovers(SCREEN.SCORES) && SV.shellCovers(SCREEN.TROPHIES));
}

/* ---- R1 train: RECORDS (SCORES, STATS, MEDALS and their LOADING plate) fill MENU's own roomLayer at MENU's room dpr (pages/menu.js roomDpr, the one
   rule LEVEL SELECT, SETTINGS and GUIDE use; no logo reserve: RECORDS shows no logo), so MENU -> RECORDS -> MENU never refills the room, whichever
   page MENU last painted; the whole cache stays inside the budget ---- */
{
  const bad = [];
  for (const [b, dpr] of [["d1366", 2], ["d1920", 2], ["d1024", 2], ["l1024", 2], ["p393", 2.7]]) for (const ts of [1, 1.25]) for (const page of ["scores", "stats", "medals"]) for (const loading of [false, true]) {
    setTextScale(ts); cache.release(); cache._dbg.misses = 0;
    const F = BOX[b], t = rec({ widthK: K8 }); t.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const MUI = { rows: ITEMS, focus: "RECORDS", level: 2, run: {}, rev: "v201", pages: 4, enterT: 9 };
    MP.drawMenuPage(t.ctx, F, MUI, 0);
    const room0 = MP._dbg.last.S.room, mrd = MP._dbg.last.S.rd, n0 = made.length;
    MP._dbg.last = null; // RECORDS may not lean on MENU's last frame: the rule itself must land on MENU's key
    const ui = UI({ page, level: 2, rev: "v201" });
    if (loading) { const w0 = md._rec.want; md._rec.want = () => new Promise(() => {}); lazy._set("records", null); md.drawScores(t.ctx, ui, { ...md.layout(F.W, F.H, 300, F.css), shell: true }, 0, F.touch); lazy._set("records", RP); md._rec.want = w0; }
    RP.drawRecordsPage(t.ctx, F, ui, 0);
    const S = RP._dbg.last.S, rooms = made.slice(n0).filter((cv) => cv.width === room0.width && cv.height === room0.height), peak = cache._dbg.bytes;
    const n1 = made.length;
    MP.drawMenuPage(t.ctx, F, MUI, 0.1);
    const back = MP._dbg.last.S.room, remade = made.slice(n1).includes(back);
    if (!(S.room === room0 && S.rd === mrd && rooms.length === 0 && back === room0 && !remade && room0.width > 0 && peak <= cache.BUDGET))
      bad.push(J({ b, dpr, ts, page, loading, same: S.room === room0, rd: [S.rd, mrd], rooms: rooms.length, back: back === room0, remade, peak }));
  }
  setTextScale(1);
  check("shared room: SCORES, STATS and MEDALS (and their LOADING plate) blit MENU's room canvas at MENU's room dpr without reading MENU's last frame, and MENU finds the same canvas again: 0 room refills, within the budget, on every box (desk 1366 / 1920 / 1024, the touch tablet 1024 x 768, the phone @2.7; text 1 and 1.25)", bad.length === 0, bad.slice(0, 3).join(" | "));
}

/* ---- the lazy page: LOADING until it lands, every hit inert ---- */
{
  const w00 = md._rec.want;
  md._rec.want = () => new Promise(() => {}); // an import still in flight
  lazy._set("records", null);
  const t = rec({ widthK: K8 }), L = md.layout(1366, 768, 300, 1);
  md.drawScores(t.ctx, UI({}), L, 0, false);
  const G = RP.recordsGeom(BOX.d1366), p0 = t.calls.find((c) => c.op !== "getTransform" && c.op !== "measureText"); // the first call that paints (R1 train: MENU's room rule measures MENU's feet first, painting nothing)
  check("before the module lands: SCORES paints the room and a LOADING plate, and every RECORDS hit is inert (-2)", t.texts.some((x) => x.s === "LOADING") && p0 && p0.op === "drawImage" && J(p0.a.slice(1)) === J([0, 0, 1366, 768]) &&
    md.scoresHit(...mid(G.keys[1]), L, false) === -2 && md.recTabHit(...mid(G.tabs[1]), L, 0, false) === -2 && md.recTabHit(...mid(G.tabs[1]), L, 2, false) === -2);
  const { mountPointer } = await import("../src/app/pointer.js"), sc = await import("../src/render/scenes.js"), log = [];
  const HIT = { overlayBox: sc.overlayBox, pauseHit: sc.pauseHit, touchLay: sc.touchLay, controlsHit: SV.controlsHit, dims: SV.dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, recTabHit: md.recTabHit, layout: md.layout };
  const LL = {}, cv = { width: 600, height: 520, getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 520 }), addEventListener(ty, fn) { (LL[ty] = LL[ty] || []).push(fn); } };
  for (const scr of [SCREEN.SCORES, SCREEN.TROPHIES]) {
    const app = { screen: scr, scoreHeat: 0, recFocus: 0, resetArm: false, confirm: () => log.push("confirm"), back: () => log.push("back"), recTab: () => log.push("recTab"), move: () => log.push("move") };
    for (const k in LL) delete LL[k];
    mountPointer({ canvas: cv, fit: null, input: { _intent: { fire: false }, onUiKey: (c) => log.push(c) }, app, world: { state: "PLAY" }, kind: () => "2d", ctl: () => null, hit: HIT });
    LL.pointerdown.forEach((fn) => fn({ clientX: 300, clientY: 300 }));
    LL.pointerdown.forEach((fn) => fn({ clientX: 2, clientY: 2 }));
  }
  check("a tap on SCORES or MEDALS while the page loads does nothing (never backs out)", log.length === 0, J(log));
  /* fix round 1, I2: every LOADING frame asks for the page again, so a failed import is retried (want keeps one in flight, a failed one is dropped) */
  const asks = [], w0 = w00;
  let n = 0;
  md._rec.want = (name) => { asks.push(name); return ++n === 1 ? Promise.reject(new Error("network blip")) : (lazy._set("records", RP), Promise.resolve(RP)); };
  lazy._set("records", null);
  md.drawScores(rec({ widthK: K8 }).ctx, UI({}), L, 0, false);
  await new Promise((r) => setTimeout(r, 0));
  const still = lazy.get("records");
  md.drawStats(rec({ widthK: K8 }).ctx, UI({}), L, 0, false);
  await new Promise((r) => setTimeout(r, 0));
  check("a LOADING frame asks for the page; a rejected import (a network blip) leaves LOADING, and the next LOADING frame asks again and the page lands",
    J(asks) === J(["records", "records"]) && still === null && lazy.get("records") === RP, J({ asks, still: !!still }));
  md._rec.want = w0;
  lazy._set("records", RP);
}
/* fix round 1, I2: MENU's frame asks lazy.idle() for every page once, in the first idle callback after it */
{
  const g = globalThis, had = g.requestIdleCallback, ric = [];
  g.requestIdleCallback = (f) => { ric.push(f); return ric.length; };
  const { createMenuApp } = await import("../src/app/menuapp.js"), app = createMenuApp({ settings: {} });
  app.screen = SCREEN.MENU; app.subT = 9;
  SV.drawShell(rec({ widthK: K8 }).ctx, app, {}, null, "2d", () => [], () => 0);
  SV.drawShell(rec({ widthK: K8 }).ctx, app, {}, null, "2d", () => [], () => 0);
  check("MENU's frame calls lazy.idle(): one idle callback is queued (asked once, not per frame)", ric.length === 1, ric.length);
  if (had) g.requestIdleCallback = had; else delete g.requestIdleCallback;
}

/* ---- the capture recipes and the gates' rows ---- */
check("tools/ui: scores and medals wait for the lazy page; every exemption carries a reason", SCREENS.scores.wait === "records" && SCREENS.medals.wait === "records" && Object.values(SCREENS.scores.exempt).every((s) => s.length > 10));


/* ==== Task 4.2: STATS and a two-step reset ==== */
const { CLEAR_KEYS, KEEP_KEYS } = await import("../src/app/reset.js");
const { statsView, statsNotes, clampStats } = await import("../src/app/stats.js");
const { recordBest } = await import("../src/app/bests.js");
const SV0 = statsView(clampStats({ a: { runs: 47, rooms: 132, deaths: 61, kills: 588, picks: 214, secs: 11520, sessions: 5, days: 9, first: "2026-11-01", last: "2026-11-10" } }),
  recordBest(recordBest(recordBest({}, "0:0:1", 4820, 5), "1:0:1", 8120, 5), "2:0:1", 3100, 3), 0b10100100);
const NOTES = statsNotes({ a: { sessions: 5, first: "2026-11-01", last: "2026-11-10" } }, { d: "2026-11-10", best: 900, played: 2, g: 3 }, "2026-11-10");
const SUI = (o) => ({ page: "stats", level: 1, focus: "tabs", view: SV0, notes: NOTES, wipe: [CLEAR_KEYS, KEEP_KEYS], arm: false, unlocked: false, ...o });
for (const b of ["d1366", "p393", "c600"]) for (const ui of [UI({ plaques: 15 }), UI({ page: "medals", rows: medalRows(255) }), UI({ page: "stats", view: { ...SV0, medals: 8 }, notes: NOTES, wipe: [CLEAR_KEYS, KEEP_KEYS] })]) {
  cache.release(); // every layer repaints, so the layers' own paints are seen (the recorder canvases made below)
  const m0 = made.length, f = frame(BOX[b], ui), all = [f.t, ...made.slice(m0).map((q) => q.r)];
  const yel = all.reduce((n, t) => n + yelPaints(t), 0), strokes = all.reduce((n, t) => n + t.paints.filter((p) => p.op === "stroke" && String(p.style).toLowerCase() === CONST.medal).length, 0);
  /* STATS' one allowed fill is the POWER-UPS line's FLAME pickup icon (its own game palette); SCORES and MEDALS fill none */
  check(`one yellow (${b}, ${ui.page}, everything earned): ${ui.page === "stats" ? "at most the FLAME icon's one" : "no"} #ffd447 fill, by colour, in the frame and its layers; the medal colour only strokes (${strokes})`, yel <= (ui.page === "stats" ? 1 : 0) && strokes > 0, J({ yel, strokes }));
}
/* the laptop windows at text scale 1: the page gives way (margins, pads, the bodies) instead of scaling, so every word keeps its floor (gates cap:
   desktop primary 14 / secondary 11 / hud 18 cap px, body 17.9 font px, 0.05 tolerance), on every tab, the armed reset included */
{
  const FLOOR = { primary: 14, secondary: 11, hud: 18 };
  for (const b of ["d1366s", "d1280s", "d1024s"]) {
    setTextScale(1);
    const F = BOX[b], G = RP.recordsGeom(F), bad = [];
    for (const ui of [UI({}), UI({ page: "medals" }), UI({ page: "stats", level: 1, focus: "tabs", view: SV0, notes: NOTES, wipe: [CLEAR_KEYS, KEEP_KEYS] }), UI({ page: "stats", view: SV0, notes: NOTES, wipe: [CLEAR_KEYS, KEEP_KEYS], arm: true })]) {
      for (const t of snap(F, ui).s.texts) {
        if (t.role === "body" ? t.px < 17.9 - 0.05 : FLOOR[t.role] != null && t.capH < FLOOR[t.role] - 0.05) bad.push([ui.page + (ui.arm ? " armed" : ""), t.s, t.role, +(t.capH || 0).toFixed(2), t.px]);
      }
    }
    check(`laptop ${F.W}x${F.H} at 100 %: the desk gives way (step ${G.d.sl}) before it scales: u ${G.u.toFixed(3)} >= ${RP.FIT_U}, every text at its floor on SCORES, MEDALS, STATS and the armed reset`,
      G.u >= RP.FIT_U && G.d.sl > 0 && bad.length === 0, J({ u: G.u, sl: G.d.sl, bad: bad.slice(0, 4) }));
  }
  const a = RP.recordsGeom(BOX.d1366), c = RP.recordsGeom(BOX.c600);
  check("the 1366x768 reference frame gives nothing way (step 0); #c's 600x520 cannot fit, so it scales at step 3 with every word kept (MENU kicker, course)", a.d.sl === 0 && a.u === 1 && c.d.sl === RP.KEEP_SL && !!c.d.kick && !!c.d.bodies.stats.course, J({ a: a.d.sl, c: c.d.sl }));
}
/* the sentence names every CLEAR and KEEP group, derived from reset.js's own lists */
{
  const keys = Object.keys(W.RESET_GROUP).sort(), lists = [...CLEAR_KEYS, ...KEEP_KEYS].sort(), s = W.resetSentence(CLEAR_KEYS, KEEP_KEYS);
  check("words.js RESET_GROUP names exactly reset.js's CLEAR and KEEP stores (a new store must join both)", J(keys) === J(lists), J({ keys, lists }));
  const word = { tips: "first-time tips", locks: "locks levels 6–8, modifiers and time trial" }, [er, kp] = s.split(" Keeps your ");
  const missC = CLEAR_KEYS.filter((k) => er.indexOf(word[W.RESET_GROUP[k]] || W.RESET_GROUP[k]) < 0), missK = KEEP_KEYS.filter((k) => !kp || kp.indexOf(W.RESET_GROUP[k]) < 0);
  check("the armed sentence erases every CLEAR group and keeps every KEEP group, by name", missC.length === 0 && missK.length === 0 && /^Erases every /.test(s) && /\.$/.test(s), J({ s, missC, missK }));
  check("RESET_DEFAULT is that sentence (the confirm plate's height is sized for it)", W.RESET_DEFAULT === s);
  check("a CLEAR group moved to KEEP moves in the sentence", W.resetSentence(CLEAR_KEYS.filter((k) => k !== "nb.ghost.v1"), [...KEEP_KEYS, "nb.ghost.v1"]).indexOf("ghost") > W.resetSentence(CLEAR_KEYS.filter((k) => k !== "nb.ghost.v1"), [...KEEP_KEYS, "nb.ghost.v1"]).indexOf("Keeps"));
}
/* STATS draws the facts it is handed, whole, at 1 and 1.25 in every box; armed, the confirm plate says the sentence, whole */
for (const b of ALL) for (const ts of [1, 1.25]) {
  setTextScale(ts);
  /* a paged body (fix round 1b) is read over every page: each fact on some page, every text of every page inside the plate */
  const F = BOX[b], G = RP.recordsGeom(F), np = RP.statsPages(F), shots = Array.from({ length: np }, (_, p) => snap(F, SUI({ spage: p })).s), s = shots[0];
  const all = shots.flatMap((q) => q.texts), T = all.map((t) => t.s), joined = T.join("|");
  const want = ["BEST SCORE", "8", "1", "2", "0", "FURTHEST LEVEL 5 · ARENA", "RUNS", "47", "PLAY TIME", "3h12m", "MEDALS", "3/8", "LIFETIME", "LEVELS CLEARED", "132", "KILLS", "588", "POWER-UPS", "214", "DEATHS", "61", "DAYS PLAYED", "9", "4,820", "8,120", "3,100", "NORMAL DIFFICULTY", "HARD DIFFICULTY", "EXPERT DIFFICULTY", "LEVEL 3"];
  const miss = want.filter((w) => !T.includes(w)), plateBox = { x: G.plate.x, y: G.plate.y, w: G.plate.w, h: G.plate.h + (G.foot ? G.foot.y + G.foot.h - G.plate.y - G.plate.h : 0) };
  const out = all.filter((t) => !inside(t, plateBox, 0.6));
  check(`STATS (${b}${ts > 1 ? " t125" : ""}${np > 1 ? ", " + np + " pages" : ""}): every fact drawn (the hero's qualifier, digits, course, the tiles, LIFETIME, BEST BY DIFFICULTY), inside the plate, no ellipsis`, miss.length === 0 && out.length === 0 && !/…/.test(joined) && T.some((x) => /HARD DIFFICULTY/.test(x)), J({ miss, out: out.slice(0, 3) }));
  const B = G.d.bodies.stats, kl = RP._dbg.last.P.stats.bestK, kt = kl.map((l) => s.texts.find((t) => t.s === l));
  /* fix round 1: at 100 % too, measured at the recorder's +8 % width: each kicker line ends before the wall course and inside its column */
  if (B.div) check(`STATS (${b}${ts > 1 ? " t125" : ""}): the BEST BY DIFFICULTY kicker breaks once where one line would pass its column; each line ends before the wall course`, kt.every((t) => t && t.x + t.w <= B.div.x * G.u + 0.01 && t.x + t.w <= (B.bestK.x + B.bestK.w) * G.u + 0.01) && (kl.length === 2 || kt[0].w <= B.bestK.w * G.u), J({ kl, kt, div: B.div.x * G.u }));
  const a = snap(F, SUI({ arm: true })).s, f = a.rects.find((r) => r.name === "confirm"), body = a.texts.filter((t) => t.role === "body");
  check(`STATS armed (${b}${ts > 1 ? " t125" : ""}): ERASE ALL RECORDS? and the whole sentence (a landscape phone's plate: the words.js short form, R1 release ruling) inside the confirm plate, AGAIN ERASES focused, COPY beside it`,
    !!f && body.map((t) => t.s).join(" ") === (G.d.confirm.cover ? W.RESET_SHORT : W.RESET_DEFAULT) && body.every((t) => inside(t, f, 0.6)) && a.texts.some((t) => /ERASE ALL/.test(t.s)) && a.rects.some((r) => r.name === "AGAIN ERASES" && r.focus) && a.rects.some((r) => /^COPY/.test(r.name)), J({ f, body: body.map((t) => t.s) }));
  setTextScale(1);
}
/* a phone at 100 %: the STATS body steps down (closer gaps, no level course, a 27 LIFETIME pitch, then one-line bests) instead of shrinking its
   words below their floors. The 393x852 reference keeps two-line bests; a shorter phone's one-line level sits between difficulty and score,
   overlapping neither, or steps out */
{
  const G = RP.recordsGeom(BOX.p393), B = G.d.bodies.stats, { s } = snap(BOX.p393, SUI({}));
  check("STATS on the 393x852 phone at 100 %: the body is not scaled (k 1), the course dropped, the bests keep two lines and every level",
    B.k === 1 && B.course === null && B.one === false && !s.rects.some((r) => /^level /.test(r.name)) && ["FURTHEST LEVEL 5 · ARENA", "LEVEL 3"].every((w) => s.texts.some((t) => t.s === w)), J({ k: B.k, one: B.one }));
  const PS = shellGeo(390, 844), F = { W: PS.w, H: PS.h, touch: true, shell: true, css: PS.s }, B2 = RP.recordsGeom(F).d.bodies.stats, s2 = snap(F, SUI({})).s;
  const cy = (t) => t.y + (t.h != null ? t.h : t.capH) / 2, row = (n) => s2.texts.find((t) => t.s === n);
  const bad = [["NORMAL DIFFICULTY", "4,820"], ["HARD DIFFICULTY", "8,120"], ["EXPERT DIFFICULTY", "3,100"]].filter(([l, n]) => {
    const a = row(l), z = a && s2.texts.filter((t) => /^LEVEL \d$/.test(t.s)).find((t) => Math.abs(cy(t) - cy(a)) < 4), m = a && s2.texts.filter((t) => t.s === n).find((t) => Math.abs(cy(t) - cy(a)) < 4);
    return !a || !m || (z && (z.x < a.x + a.w || z.x + z.w > m.x));
  });
  check("STATS on a 390x844 phone at 100 %: k 1; a level drawn on a best's line sits clear of its difficulty and its score", B2.k === 1 && bad.length === 0, J({ k: B2.k, one: B2.one, bad }));
  /* fix round 1: the tighter tiles (step 4) bring 375x812 to scale 1 as well */
  const P3 = shellGeo(375, 812), B3 = RP.recordsGeom({ W: P3.w, H: P3.h, touch: true, shell: true, css: P3.s }).d.bodies.stats;
  check("STATS on a 375x812 phone at 100 %: k 1 (the tiles tighten before the body scales)", B3.k === 1 && B3.tl === RP.TILE.t, J({ k: B3.k }));
  const D = RP.recordsGeom(BOX.d1366).d.bodies.stats;
  check("STATS on the desk keeps the mock's layout: two-line bests and the level course", D.one === false && !!D.course && D.k === 1, J({ one: D.one, k: D.k }));
}
/* fix round 1b (lead ruling, lane rules lesson 1): STATS on a small phone PAGES instead of scaling under the floors. 360x780, 375x667 and 393x852 at
   100 %: the body unscaled (k 1), every text on every page at the phone floors (primary 11, secondary 9, hud 11 cap CSS px), whole sections per page
   (each fact on exactly one page), the ▲ / ▼ page keys >= 44 CSS px and >= 8 apart, drawn in tap mode too; a tap on them is PageUp / PageDown */
{
  const FL = { primary: 11, secondary: 9, hud: 11 }, rep = [];
  for (const [w, h] of [[360, 780], [375, 667], [393, 852]]) for (const ts of [1, 1.25]) {
    setTextScale(ts);
    const PS = shellGeo(w, h), F = { W: PS.w, H: PS.h, touch: true, shell: true, css: PS.s }, G = RP.recordsGeom(F), B = G.d.bodies.stats, n = RP.statsPages(F), u = G.u;
    const bad = [], seen = new Map();
    for (let p = 0; p < n; p++) {
      const { s } = snap(F, SUI({ spage: p }));
      for (const t of s.texts) {
        if (FL[t.role] != null && t.capH / u < FL[t.role] - 0.05) bad.push([p, t.s, t.role, +(t.capH / u).toFixed(2)]);
        if (/^(BEST SCORE|RUNS|LIFETIME|NORMAL DIFFICULTY)$/.test(t.s)) seen.set(t.s, (seen.get(t.s) || 0) + 1);
      }
      if (n > 1) {
        const up = s.rects.find((r) => r.name === "PAGE UP"), dn = s.rects.find((r) => r.name === "PAGE DOWN");
        const css = (r) => ({ w: r.w / u, h: r.h / u }), gap = (dn.x - (up.x + up.w)) / u;
        if (!up || !dn || css(up).h < 43.95 || css(up).w < 43.95 || css(dn).h < 43.95 || gap < 7.95 || !up.touch) bad.push([p, "page keys", up && css(up), gap]);
        if (!s.texts.some((t) => t.s === "PAGE " + (p + 1) + " OF " + n)) bad.push([p, "no PAGE n OF m"]);
        const mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
        if (RP.statsHit(...mid(up), F, false) !== "PageUp" || RP.statsHit(...mid(dn), F, false) !== "PageDown" || ["PageDown", "KeyR"].includes(RP.statsHit(...mid(dn), F, true))) bad.push([p, "page key hits"]); // armed, the confirm plate is modal: never a page step, never the erase
      }
    }
    const once = ["BEST SCORE", "RUNS", "LIFETIME", "NORMAL DIFFICULTY"].every((x) => seen.get(x) === 1);
    rep.push(`${w}x${h}@${ts}: ${n} page(s), k ${B.k.toFixed(3)}`);
    if (ts === 1) check(`STATS on a ${w}x${h} phone at 100 %: unscaled (k 1), ${n} page(s) of whole sections (each fact on exactly one page), every text at the phone floors, the page keys 44 CSS px and 8 apart, tapping PageUp / PageDown (armed: the modal plate's, never a page or the erase)`,
      B.k === 1 && bad.length === 0 && once && (w === 393 ? n === 1 : n > 1), J({ k: B.k, n, bad: bad.slice(0, 4), seen: [...seen] }));
    else check(`STATS on a ${w}x${h} phone at 125 %: unscaled (k 1), paged where it must be, every text at the floors`, B.k === 1 && bad.length === 0 && once, J({ k: B.k, n, bad: bad.slice(0, 4) }));
    setTextScale(1);
  }
  console.log("  (report) " + rep.join(" | "));
  /* tap mode keeps the page keys (setHints(null) on a touch box is tap mode) */
  const PS = shellGeo(360, 780), F = { W: PS.w, H: PS.h, touch: true, shell: true, css: PS.s };
  setHints(null);
  const t = snap(F, SUI({ spage: 1 })).s;
  check("STATS paged, tap mode: the page keys are drawn (PAGE 2 OF n, ▲ on, ▼ a well on the last page)", t.rects.some((r) => r.name === "PAGE UP" && r.fill !== worldTokens(1).well) && t.texts.some((x) => /^PAGE 2 OF/.test(x.s)));
  /* the armed confirm plate stays one page: the same plate on page 0 and the last page */
  const A0 = snap(F, SUI({ arm: true, spage: 0 })).s.rects.find((r) => r.name === "confirm"), A1 = snap(F, SUI({ arm: true, spage: RP.statsPages(F) - 1 })).s.rects.find((r) => r.name === "confirm");
  check("STATS paged, armed: the confirm plate is one page, the same on every page", !!A0 && J(A0) === J(A1), J([A0, A1]));
}
/* the armed confirm plate on the small phones (fix round 1b): one page, under the tabs and the trough (never over them), AGAIN ERASES above the idle
   COPY STATS / RESET keys, its sentence at the body floor (14.1 font px) and its title and cancel line at their cap floors, at 1 and 1.25 */
{
  const bad = [];
  for (const [w, h] of [[360, 780], [375, 667], [393, 852], [375, 812]]) for (const ts of [1, 1.25]) {
    setTextScale(ts);
    const PS = shellGeo(w, h), F = { W: PS.w, H: PS.h, touch: true, shell: true, css: PS.s }, G = RP.recordsGeom(F), f = G.d.confirm, u = G.u, a = G.d.bodies.stats.acts;
    const { s } = snap(F, SUI({ arm: true })), low = s.texts.filter((t) => (t.role === "body" ? t.px / u < 14.1 - 0.05 : t.role === "primary" ? t.capH / u < 10.95 : t.role === "secondary" ? t.capH / u < 8.95 : false) && t.y > f.box.y * u);
    if (f.box.y < G.d.trough.y + G.d.trough.h || f.again.y + f.again.h > a.copy.y || low.length) bad.push([w, h, ts, f.box.y < G.d.trough.y + G.d.trough.h, f.again.y + f.again.h > a.copy.y, low.map((t) => t.s).slice(0, 2)]);
    setTextScale(1);
  }
  check("STATS armed on the small phones: the confirm plate under the tabs, AGAIN ERASES above the idle keys, every word at its floor (1 and 1.25)", bad.length === 0, J(bad));
}
/* keys, a controller and taps carry the page (menuapp, every RECORDS tab): STATS and SCORES: ↓ into the body then down the pages, ↑ back up and out
   to the tab row; MEDALS (no body): ↓ / ↑ on the tab row walk its pages; the page keys step and clamp; every tab arrival opens page 0 */
{
  const { createMenuApp, ITEMS: IT } = await import("../src/app/menuapp.js");
  let n = 3;
  const a = createMenuApp({ recPages: (scr) => (scr === SCREEN.STATS || scr === SCREEN.SCORES || scr === SCREEN.TROPHIES ? n : 1), onStats() {}, onMedals() {} });
  a.screen = SCREEN.MENU; a.cursor = IT.indexOf("RECORDS"); a.confirm(); a.recTab(1);
  const walk = () => { const t = [[a.recFocus, a.recPage]]; for (const d of [1, 1, 1, 1, -1, -1, -1, -1]) { a.move(d, 1); t.push([a.recFocus, a.recPage]); } return t; };
  const BODY = [[0, 0], [1, 0], [1, 1], [1, 2], [1, 2], [1, 1], [1, 0], [0, 0], [0, 0]];
  const st = walk();
  check("STATS paged by keys / a controller's D-PAD (move on the vertical axis): tabs → page 1 → 2 → 3 (clamped), then back up to the tab row", J(st) === J(BODY), J(st));
  a.recTab(-1); const sc = walk();
  check("SCORES paged the same way (its body is the difficulty filter, ←/→ unchanged)", a.screen === SCREEN.SCORES && J(sc) === J(BODY), J(sc));
  a.recTab(2); const md = walk();
  check("MEDALS (no body): ↓ / ↑ on the tab row walk its pages, the focus never leaves the tab row", a.screen === SCREEN.TROPHIES && J(md) === J([[0, 0], [0, 1], [0, 2], [0, 2], [0, 2], [0, 1], [0, 0], [0, 0], [0, 0]]), J(md));
  a.recTab(-1); a.recFocus = 0;
  const taps = [a.recPageStep(1), a.recPage, a.recFocus, a.recPageStep(1), a.recPageStep(1), a.recPage, a.recPageStep(-1), a.recPage];
  check("STATS page keys (taps): one page a tap, clamped, the body focused", J(taps) === J([true, 1, 1, true, false, 2, true, 1]), J(taps));
  a.resetArm = true; a.recPageStep(-1);
  check("a page-key tap cancels an armed reset (input that is not the second R)", a.resetArm === false);
  a.recTab(1); a.recTab(-1);
  check("every tab arrival opens page 0", a.recPage === 0 && a.screen === SCREEN.STATS);
  n = 1; a.recFocus = 1; const one = a.move(1, 1);
  check("an unpaged tab: ↓ in the body does nothing, ↑ returns to the tabs", one === false && a.recPage === 0 && (a.move(-1, 1), a.recFocus === 0));
}
/* page state (fix round 1b review): re-opening RECORDS through the MENU row opens page 0 (not only a tab step), and a resize that unpages or shortens
   the body clamps the page on the next update */
{
  const { createMenuApp, ITEMS: IT } = await import("../src/app/menuapp.js");
  let n = 3;
  const a = createMenuApp({ recPages: () => n, onStats() {} });
  a.screen = SCREEN.MENU; a.cursor = IT.indexOf("RECORDS"); a.confirm();
  a.move(1, 1); a.move(1, 1); a.move(1, 1);
  const deep = [a.screen, a.recFocus, a.recPage];
  a.key("Escape");
  const out = a.screen;
  a.cursor = IT.indexOf("RECORDS"); a.confirm();
  check("RECORDS re-opened through the MENU row from page 3 opens page 0 on the tab row", J(deep) === J([SCREEN.SCORES, 1, 2]) && out === SCREEN.MENU && a.screen === SCREEN.SCORES && a.recPage === 0 && a.recFocus === 0, J({ deep, out, now: [a.screen, a.recPage] }));
  a.move(1, 1); a.move(1, 1); a.move(1, 1);
  n = 2; a.update(0.016);
  const shorter = a.recPage;
  n = 1; a.update(0.016);
  check("a resize that shortens the body clamps the page (3 -> 2 pages: page 2), and one that unpages it opens page 1", shorter === 1 && a.recPage === 0, J({ shorter, now: a.recPage }));
}
/* SCORES' pages follow the rows it draws (fix round 1b review): an empty table is one page (no pager, no PAGE 1 OF n), a table that fits one page
   has no keys, and a full one has exactly the pages its rows fill (never a header-only page) */
{
  const PS = shellGeo(375, 667), F = { W: PS.w, H: PS.h, touch: true, shell: true, css: PS.s }, B = RP.recordsGeom(F).d.bodies.scores, per = B.per;
  const empty = snap(F, UI({ scores: [] })).s, few = snap(F, UI({ scores: LONG.slice(0, per) })).s, mid = (r) => [(r.x + r.w / 2) * RP.recordsGeom(F).u, (r.y + r.h / 2) * RP.recordsGeom(F).u];
  const noPager = (q) => !q.rects.some((r) => /^PAGE /.test(r.name)) && !q.texts.some((t) => /^PAGE \d/.test(t.s));
  check(`SCORES on a 375x667 phone (${per} rows a page): an empty table and a ${per}-row table are one page with no page keys and no PAGE 1 OF n; ten rows take ${Math.ceil(10 / per)} pages`,
    !!B.pager && RP.recPages(F, "scores", 0) === 1 && RP.recPages(F, "scores", per) === 1 && RP.recPages(F, "scores", 10) === Math.ceil(10 / per) && noPager(empty) && noPager(few) &&
      RP.pageKeyHit(...mid(B.pager.dn), F, "scores", per) === null && J(RP.pageKeyHit(...mid(B.pager.dn), F, "scores", 10)) === J({ k: "page", d: 1, to: 1 }), J({ per, pages: [0, per, 10].map((r) => RP.recPages(F, "scores", r)) }));
  const last = pagesOf(F, UI({ scores: LONG.slice(0, per + 1) })), rowsOn = last.map((q) => q.texts.filter((t) => /^\d{1,3}(,\d{3})+$/.test(t.s)).length);
  check("SCORES: every page draws at least one row (one past a page: two pages, the second with its one row)", last.length === 2 && rowsOn[0] === per && rowsOn[1] === 1, J(rowsOn));
}
/* SCORES and MEDALS on the small phones page too (fix round 1b): unscaled, every text at the phone floors on every page, ten rows and eight medals
   across the pages, each once; the page keys tap -1 / +1 through pageKeyHit */
{
  const FL = { primary: 11, secondary: 9, hud: 11 }, rep = [];
  for (const [w, h] of [[360, 780], [375, 667], [393, 852]]) for (const ts of [1, 1.25]) {
    setTextScale(ts);
    const PS = shellGeo(w, h), F = { W: PS.w, H: PS.h, touch: true, shell: true, css: PS.s }, G = RP.recordsGeom(F), u = G.u, bad = [];
    const sb = G.d.bodies.scores, mb = G.d.bodies.medals;
    for (const [page, ui] of [["scores", UI({ focus: "body" })], ["medals", UI({ page: "medals" })]]) {
      const Ps = pagesOf(F, ui), T = Ps.flatMap((q) => q.texts);
      for (const t of T) if (FL[t.role] != null && t.capH / u < FL[t.role] - 0.05) bad.push([page, t.s, +(t.capH / u).toFixed(2)]);
      const n = Ps.length, items = page === "scores" ? T.filter((t) => /^\d{1,3}(,\d{3})+$/.test(t.s)).length : Ps.flatMap((q) => q.rects.filter((r) => /^medal /.test(r.name))).length;
      if (items !== (page === "scores" ? 10 : 8)) bad.push([page, "items", items]);
      if (n > 1) {
        const b = G.d.bodies[page].pager, mid = (r) => [(r.x + r.w / 2) * u, (r.y + r.h / 2) * u];
        if (J(RP.pageKeyHit(...mid(b.up), F, page, 10)) !== J({ k: "page", d: -1, to: -1 }) || J(RP.pageKeyHit(...mid(b.dn), F, page, 10)) !== J({ k: "page", d: 1, to: 1 }) || b.up.h * u / u < 43.95) bad.push([page, "keys"]);
      }
      rep.push(`${page} ${w}x${h}@${ts}: ${n}`);
    }
    check(`SCORES and MEDALS on a ${w}x${h} phone at ${ts === 1 ? "100" : "125"} %: unscaled (k 1), every text at the phone floors on every page, ten rows and eight medals across the pages`,
      sb.k === 1 && mb.k === 1 && bad.length === 0, J({ sk: sb.k, mk: mb.k, bad: bad.slice(0, 4) }));
    setTextScale(1);
  }
  console.log("  (report pages) " + rep.join(" | "));
}
/* R1 cohesion 2 (lane lesson 6): a controller on a touch layout gets RECORDS' cue line, label first, keycap last: TAB [D-PAD] · BACK [EAST], and on
   STATS COPY [WEST] · MEDALS [NORTH] first (dropped whole where the line is short); the keyboard's touch layout has none; the line sits inside the plate */
{
  const { setHints } = await import("../src/render/hintcopy.js"), { wordsOf } = await import("../src/app/hints.js"), { DEF_CONTROLS } = await import("../src/app/controls.js");
  const bad = [];
  for (const b of ["p393", "c852x393", "c600t"]) for (const page of ["scores", "stats", "medals"]) {
    if (!BOX[b]) continue;
    setHints(wordsOf("pad", DEF_CONTROLS));
    const t = rec({ widthK: K8 }); RP.drawRecordsPage(t.ctx, BOX[b], UI({ page }), 0);
    const G = RP.recordsGeom(BOX[b]), s = t.texts.map((x) => x.s), want = page === "stats" ? ["COPY", "WEST", "MEDALS", "NORTH", "TAB", "D-PAD", "BACK", "EAST"] : ["TAB", "D-PAD", "BACK", "EAST"];
    const cue = RP._dbg.last && RP._dbg.last.S && RP._dbg.last.S.P.cue, seq = cue ? cue.parts.filter((p) => !p.sep).map((p) => p.t || p.cap) : [];
    const tail = want.slice(-seq.length);
    if (!G.d.cue || !cue || J(seq) !== J(tail) || seq.length < 4 || !(G.d.cue.y + G.d.cue.h <= G.d.plate.y + G.d.plate.h) || cue.parts.some((p) => p.x + p.w > G.d.cue.x + G.d.cue.w + 0.5)) bad.push(b + " " + page + " " + J(seq));
    if (!s.includes("TAB") || !s.includes("EAST")) bad.push(b + " " + page + " not painted");
    setHints(wordsOf("key", DEF_CONTROLS));
    if (RP.recordsGeom(BOX[b]).d.cue) bad.push(b + " " + page + " keyboard has a cue");
  }
  setHints(null);
  check("RECORDS with a controller on a phone / landscape phone: the cue line (label first, keycap last; STATS adds COPY WEST, MEDALS NORTH first), inside the plate; none on keys", bad.length === 0, bad.join(" | "));
}
/* the pointer: a tap on a page key (any RECORDS tab) is app.pageKey (which steps recPageStep), never a back-out */
{
  const { mountPointer } = await import("../src/app/pointer.js"), sc = await import("../src/render/scenes.js"), log = [];
  for (const [scr, k] of [[SCREEN.STATS, -1], [SCREEN.SCORES, 1], [SCREEN.TROPHIES, 1]]) {
    const HIT = { overlayBox: sc.overlayBox, pauseHit: sc.pauseHit, touchLay: sc.touchLay, controlsHit: SV.controlsHit, dims: SV.dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, levelHit: md.levelHit, scoresHit: () => -1, statsHit: () => "back", recTabHit: () => -1, recPageHit: () => ({ k: "page", d: k, to: k }), layout: md.layout };
    const LL = {}, cv = { width: 600, height: 520, getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 520 }), addEventListener(ty, fn) { (LL[ty] = LL[ty] || []).push(fn); } };
    const app = { screen: scr, recFocus: 1, resetArm: false, confirm: () => log.push("confirm"), back: () => log.push("back"), pageKey: (d) => log.push("page " + d) }; // THE page-key step (R1 cohesion 9)
    mountPointer({ canvas: cv, fit: null, input: { _intent: { fire: false }, onUiKey: (c) => log.push(c) }, app, world: { state: "PLAY" }, kind: () => "2d", ctl: () => null, hit: HIT });
    LL.pointerdown.forEach((fn) => fn({ clientX: 300, clientY: 300 }));
  }
  check("pointer: a tap on ▲ / ▼ steps the page on STATS, SCORES and MEDALS, and nothing else (no back-out)", J(log) === J(["page -1", "page 1", "page 1"]), J(log));
}
/* no best run yet: the hero says so and shows no score or course; the three bests each draw "—" (fix round 1, the old R12 coverage) */
{
  const { s } = snap(BOX.d1366, SUI({ view: { ...SV0, hero: null, far: null, bests: [null, null, null] } }));
  const dash = ["NORMAL DIFFICULTY", "HARD DIFFICULTY", "EXPERT DIFFICULTY"].map((l) => { const a = s.texts.find((t) => t.s === l); return !!a && s.texts.some((t) => t.s === "—" && Math.abs(t.y - a.y) < 6 && t.x > a.x + a.w); });
  check("STATS with no saved run: BEST SCORE · NO RUNS YET, no digits, no course, no FURTHEST line; each empty best draws — on its line", s.texts.some((t) => t.s === "BEST SCORE") && s.texts.some((t) => t.s === "NO RUNS YET") && !s.rects.some((r) => /^(digit|level) /.test(r.name)) && !s.texts.some((t) => /^FURTHEST/.test(t.s)) && dash.every(Boolean), J(dash));
}
/* lead ruling, fix round 1: nb.bests.v1 keeps each bucket's score and level as SEPARATE maxima, so the page never pairs them as one run: BEST SCORE (the
   highest score, its bucket's qualifier) and, apart, FURTHEST LEVEL (the highest level any bucket saved), with the course lit to that level only */
{
  const two = recordBest(recordBest({}, "1:0:1", 8120, 3), "0:0:1", 500, 5), v = statsView(clampStats({ a: { runs: 2 } }), two, 0);
  check("statsView: the best score and the furthest level come from their own maxima (score 8,120 from a level-3 run, level 5 from a 500-point run); the hero carries no level", v.hero && v.hero.s === 8120 && v.hero.heat === 1 && !("r" in v.hero) && v.far === 5, J(v));
  const one = recordBest({}, "0:0:1", 900, 2), v1 = statsView(clampStats({ a: { runs: 1 } }), recordBest(one, "0:0:1", 100, 4), 0);
  check("statsView: one bucket whose score and level came from different runs still reads as two maxima (900, level 4)", v1.hero.s === 900 && v1.far === 4, J(v1));
  for (const b of ["d1366", "p393"]) {
    const { s } = snap(BOX[b], SUI({ view: { ...SV0, hero: v.hero, far: v.far } })), T = s.texts.map((t) => t.s);
    const lv = s.rects.filter((r) => /^level /.test(r.name)), key = lv.find((r) => r.fill === worldTokens(1).key);
    check(`STATS (${b}): BEST SCORE 8,120 (HARD DIFFICULTY) and FURTHEST LEVEL 5 · ARENA as two labelled facts; no REACHED wording; the course (where drawn) raises level 5 only`,
      T.includes("BEST SCORE") && T.includes("FURTHEST LEVEL 5 · ARENA") && !T.some((x) => /REACHED|BEST RUN/.test(x)) && (lv.length === 0 || (!!key && key.name === "level 5")), J({ lv: lv.map((r) => [r.name, r.fill]) }));
  }
}
/* fix round 1: __GAME__.seedRecords (debug only, tools/ui/shots.mjs scoresfull / statsfull) writes a played-looking cabinet through the stores' own
   savers: ten played NORMAL rows (no placeholder), badges, medals, and a best score whose run did not reach the furthest level */
{
  const { seedRecords } = await import("../src/app/debughook.js"), { loadScores, scoresForHeat, isPlaceholder } = await import("../src/app/highscores.js");
  const { loadBests } = await import("../src/app/bests.js"), { loadStats } = await import("../src/app/stats.js"), { loadMedals } = await import("../src/app/medals.js"), { loadPlaques } = await import("../src/app/plaques.js");
  const m = new Map(), st = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  seedRecords(st);
  const rows = scoresForHeat(loadScores(st), 0), v = statsView(loadStats(st), loadBests(st), loadMedals(st));
  check("seedRecords: ten played NORMAL rows with modifiers, badges CLEAR + EXPERT, four medals, and a STATS hero of 8,120 (HARD) beside a furthest level 5",
    rows.length === 10 && !rows.some(isPlaceholder) && rows.some((r) => r.p) && loadPlaques(st) === 5 && v.medals === 4 && v.hero.s === 8120 && v.hero.heat === 1 && v.far === 5 && v.runs === 47, J({ n: rows.length, hero: v.hero, far: v.far, med: v.medals }));
}
/* fix round 1, Important 3: a foot zone answers only in the armed state it was painted in: a second click on RESET that lands before the armed frame
   paints reads the idle foot's zones as nothing, never the second R */
{
  const F = BOX.d1366, G = RP.recordsGeom(F), u = G.u;
  frame(F, SUI({ arm: false }));
  const fp = RP._dbg.last.S.feet.find((q) => q.v === "tabs").fp, z = fp.zones.find((q) => q.key === "KeyR"), x = ((z.x0 + z.x1) / 2) * u, y = fp.mid * u;
  const idle = RP.statsHit(x, y, F, false), stale = RP.statsHit(x, y, F, true);
  frame(F, SUI({ arm: true }));
  const armed = RP.statsHit(x, y, F, true);
  check("STATS: RESET (idle frame) is R; a second click before the armed frame paints is cancel, never R; once armed is painted, the same point is still not R", idle === "KeyR" && stale === "cancel" && armed !== "KeyR", J({ idle, stale, armed }));
}
/* the hits: the armed page answers R (AGAIN ERASES) and C (COPY) only; everything else is "cancel" */
for (const b of ["d1366", "p393", "c600", "l1024"]) {
  const F = BOX[b], G = RP.recordsGeom(F), f = G.d.confirm, u = G.u, c = (r) => [(r.x + r.w / 2) * u, (r.y + r.h / 2) * u];
  frame(F, SUI({ arm: true }));
  const hits = [RP.statsHit(...c(f.again), F, true), RP.statsHit(...c(f.copy), F, true), RP.statsHit(...c(G.d.pane), F, true), RP.statsHit(1, 1, F, true), RP.statsHit(...mid(G.tabs[0]), F, true)];
  check(`STATS armed hits (${b}): AGAIN ERASES is R, COPY is C, the pane, off the plate and a tab are cancel`, J(hits) === J(["KeyR", "KeyC", "cancel", "cancel", "cancel"]), J(hits));
  frame(F, SUI({}));
  const a = G.d.bodies.stats.acts, idle = [RP.statsHit(...c(G.d.pane), F, false), RP.statsHit(1, 1, F, false), ...(a ? [RP.statsHit(...c(a.copy), F, false), RP.statsHit(...c(a.reset), F, false)] : [])];
  check(`STATS idle hits (${b}): the pane is inert (plate), off the plate backs out${a ? ", COPY STATS is C, RESET is R" : ""}`, J(idle) === J(["plate", "back", ...(a ? ["KeyC", "KeyR"] : [])]), J(idle));
}
/* the desk foot: label first, keycap last, and a tap on a label (or its keycaps) is its key; a controller's foot offers no reset */
{
  const F = BOX.d1366;
  setHints(null);
  frame(F, SUI({}));
  const fp = RP._dbg.last.S.feet.find((q) => q.v === "tabs").fp, words = fp.parts.map((p) => p.t || p.sep || (Array.isArray(p.cap) ? "[" + p.cap[0] + "]" : "[" + p.cap + "]")).join(" ");
  check("STATS foot (keys, tab row): COPY MY STATS C · RESET R · TAB ← → · BACK ESC", words === "COPY MY STATS [C] · RESET [R] · TAB [lf] [rt] · BACK [ESC]", words);
  const at = (t) => { const p = fp.parts.find((q) => q.t === t); return [(p.x + p.w / 2) * RP.recordsGeom(F).u, fp.mid * RP.recordsGeom(F).u]; };
  check("a tap on the foot's COPY MY STATS is C, on RESET is R, on BACK backs out", RP.statsHit(...at("COPY MY STATS"), F, false) === "KeyC" && RP.statsHit(...at("RESET"), F, false) === "KeyR" && RP.statsHit(...at("BACK"), F, false) === "back");
  frame(F, SUI({ arm: true }));
  const fa = RP._dbg.last.S.feet.find((q) => q.v === "arm").fp, wa = fa.parts.map((p) => p.t || p.sep || "[" + p.cap + "]").join(" ");
  check("STATS armed foot: ERASE R · COPY C · ANY OTHER KEY CANCELS", wa === "ERASE [R] · COPY [C] · ANY OTHER KEY CANCELS", wa);
  setHints(wordsOf("pad", DEF_CONTROLS));
  frame(F, SUI({}));
  const wp = RP._dbg.last.S.feet.find((q) => q.v === "tabs").fp.parts.map((p) => p.t || p.sep || "[" + p.cap + "]").join(" ");
  check("STATS controller foot: COPY MY STATS WEST · MEDALS NORTH · TAB D-PAD · BACK EAST; no reset anywhere", wp === "COPY MY STATS [WEST] · MEDALS [NORTH] · TAB [D-PAD] · BACK [EAST]" && !/RESET/.test(wp), wp);
  setHints(null);
}
/* the app: R then a tab move disarms and never wipes; R, tab, R does not wipe; R R wipes once */
{
  const n = { reset: 0, stats: 0 }, a = createMenuApp({ onReset: () => n.reset++, onStats: () => n.stats++, onMedals() {} });
  a.screen = SCREEN.MENU; a.cursor = ITEMS.indexOf("RECORDS"); a.confirm(); a.recTab(1);
  a.key("KeyR"); const armed = a.resetArm; a.key("KeyE");
  check("R then a tab move (E): disarmed, on MEDALS, nothing wiped", armed && a.resetArm === false && a.screen === SCREEN.TROPHIES && n.reset === 0);
  a.key("KeyQ"); a.key("KeyR");
  check("R, tab, R: the second R only arms, nothing wiped", a.screen === SCREEN.STATS && a.resetArm === true && n.reset === 0);
  a.key("KeyR");
  check("R, R: wipes once", n.reset === 1 && a.resetArm === false);
}
/* no controller path reaches the wipe: armed by a key, every button cancels; unarmed, no button arms (padroute through the real shell) */
{
  const { Input } = await import("../src/input.js"), { createPad } = await import("../src/app/gamepad.js"), { createPadRouter } = await import("../src/app/padroute.js");
  const bad = [];
  const { PAD_IDX } = await import("../src/app/controls.js");
  for (const i of Object.keys(PAD_IDX).map(Number)) for (const armedFirst of [true, false]) { // every button the poller reads (the stick clicks 10 / 11 are read by no route)
    const n = { reset: 0 }, a = createMenuApp({ onReset: () => n.reset++, onStats() {}, onMedals() {} });
    a.screen = SCREEN.MENU; a.cursor = ITEMS.indexOf("RECORDS"); a.confirm(); a.recTab(1);
    const raw = { list: [{ connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) }] }, pad = createPad({ getGamepads: () => raw.list });
    const r = createPadRouter({ input: new Input(null), app: a, SCREEN, binds: () => DEF_CONTROLS, world: () => ({ state: "PLAY" }), onPause() {}, onUiKey: (c) => { if (c !== "KeyR" && c !== "Escape" && c !== "Backspace") a.resetArm = false; a.key(c); }, page: null }); // main's onUiKey rule
    let t = 0; const run = () => r.route(pad.poll((t += 16)), t); run();
    for (let k = 0; k < 3; k++) {
      if (armedFirst && a.screen === SCREEN.STATS) a.key("KeyR");
      raw.list[0].buttons[i] = { pressed: true, value: 1 }; run(); raw.list[0].buttons[i] = { pressed: false, value: 0 }; run();
      if (n.reset || (a.screen === SCREEN.STATS && a.resetArm)) bad.push(i + (armedFirst ? " armed" : ""));
    }
  }
  check("no controller button reaches the wipe: armed, any button cancels; unarmed, none arms", bad.length === 0, bad.join());
  { /* close-first (R1 cohesion ruling): armed, EAST cancels the reset only; a second EAST leaves for MENU */
    const a = createMenuApp({ onReset() {}, onStats() {}, onMedals() {} });
    a.screen = SCREEN.MENU; a.cursor = ITEMS.indexOf("RECORDS"); a.confirm(); a.recTab(1);
    const raw = { list: [{ connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) }] }, pad = createPad({ getGamepads: () => raw.list });
    const r = createPadRouter({ input: new Input(null), app: a, SCREEN, binds: () => DEF_CONTROLS, world: () => ({ state: "PLAY" }), onPause() {}, onUiKey: (c) => { if (c !== "KeyR" && c !== "Escape" && c !== "Backspace") a.resetArm = false; a.key(c); }, page: null });
    let t = 0; const run = () => r.route(pad.poll((t += 16)), t), east = () => { raw.list[0].buttons[1] = { pressed: true, value: 1 }; run(); raw.list[0].buttons[1] = { pressed: false, value: 0 }; run(); }; // button 1: EAST (controls.js PAD_IDX)
    run(); a.key("KeyR");
    const armed = a.resetArm; east(); const one = [a.screen, a.resetArm]; east();
    check("STATS armed, EAST closes first: the reset cancels and STATS stays; a second EAST backs out to MENU", armed && one[0] === SCREEN.STATS && one[1] === false && a.screen === SCREEN.MENU, J(one));
  }
}
/* the wipe guards (four gaps found in review, each reached R, <input>, R in the live game): any input that is not the second plain R disarms */
{
  const { mountPointer } = await import("../src/app/pointer.js"), sc = await import("../src/render/scenes.js");
  const HIT = { overlayBox: sc.overlayBox, pauseHit: sc.pauseHit, touchLay: sc.touchLay, controlsHit: SV.controlsHit, dims: SV.dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, recTabHit: md.recTabHit, layout: md.layout };
  const rig = () => {
    const n = { reset: 0 }, keys = [], a = createMenuApp({ onReset: () => n.reset++, onStats() {}, onMedals() {} });
    a.screen = SCREEN.MENU; a.cursor = ITEMS.indexOf("RECORDS"); a.confirm(); a.recTab(1);
    a.stats = { view: SV0, notes: NOTES, wipe: [CLEAR_KEYS, KEEP_KEYS], trophies: [] };
    const LL = {}, cv = { width: 600, height: 520, getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 520 }), addEventListener(ty, fn) { (LL[ty] = LL[ty] || []).push(fn); } };
    const input = { _intent: { fire: false }, onUiKey: (c) => { keys.push(c); if (c !== "KeyR") a.resetArm = false; a.key(c); } };
    mountPointer({ canvas: cv, fit: null, input, app: a, world: { state: "PLAY" }, kind: () => "2d", ctl: () => null, hit: HIT });
    const fire = (ty, x, y, pt) => (LL[ty] || []).forEach((f) => f({ clientX: x, clientY: y, pointerType: pt }));
    const draw = () => { const t = rec({ widthK: K8 }); SV.drawShell(t.ctx, a, { state: "PLAY", time: 1, level: 1 }, cv, "2d", () => [], () => 0, () => ({})); };
    return { a, n, keys, fire, draw };
  };
  const F = { W: 600, H: 520, touch: false, shell: false, css: 1 }, G = RP.recordsGeom(F), u = G.u, c = (r) => [(r.x + r.w / 2) * u, (r.y + r.h / 2) * u];
  /* (1) a touch C deferred to its pointerup disarms at once: a pointercancel or pointerleave in between leaves the reset disarmed, and copies nothing */
  for (const end of ["pointercancel", "pointerleave"]) {
    const t = rig();
    t.a.key("KeyR"); t.draw();
    const armed = t.a.resetArm;
    t.fire("pointerdown", ...c(G.d.confirm.copy), "touch");
    const after = t.a.resetArm;
    t.fire(end, 0, 0); t.fire("pointerup", 0, 0); t.a.key("KeyR");
    check(`gap 1: armed, a touch C then ${end}: disarmed at pointerdown, copies nothing; the next R only arms again (no wipe)`, armed && after === false && t.keys.length === 0 && t.n.reset === 0 && t.a.resetArm === true, J({ armed, after, keys: t.keys, reset: t.n.reset }));
  }
  {
    const t = rig();
    t.a.key("KeyR"); t.draw();
    t.fire("pointerdown", ...c(G.d.confirm.copy), "touch"); t.fire("pointerup", 0, 0);
    check("C while armed (touch): disarms and copies on pointerup (KeyC once)", t.a.resetArm === false && J(t.keys) === J(["KeyC"]) && t.n.reset === 0, J(t.keys));
    t.a.key("KeyR"); t.draw();
    t.fire("pointerdown", ...mid(G.tabs[2]), "mouse");
    check("armed: a tab tap only cancels (the confirm plate is modal): disarmed, still on STATS, nothing wiped", t.a.resetArm === false && t.a.screen === SCREEN.STATS && t.n.reset === 0);
    for (const [nm, pt] of [["the pane", c(G.d.pane)], ["off the plate", [1, 1]]]) {
      t.a.key("KeyR"); t.draw(); t.fire("pointerdown", ...pt, "mouse");
      check(`armed: a tap on ${nm} cancels, stays on STATS, wipes nothing`, t.a.resetArm === false && t.a.screen === SCREEN.STATS && t.n.reset === 0);
    }
    t.a.key("KeyR"); t.draw(); t.fire("pointerdown", ...c(G.d.confirm.again), "mouse");
    check("armed: a tap on AGAIN ERASES is the second R: wipes once", t.n.reset === 1);
  }
  /* (3) a controller press that answers a card, or is swallowed after a connect, still cancels; so does a direction */
  {
    const { Input } = await import("../src/input.js"), { createPad } = await import("../src/app/gamepad.js"), { createPadRouter } = await import("../src/app/padroute.js");
    const mkR = (o = {}) => {
      const n = { reset: 0, card: [] }, a = createMenuApp({ onReset: () => n.reset++, onStats() {}, onMedals() {} });
      a.screen = SCREEN.MENU; a.cursor = ITEMS.indexOf("RECORDS"); a.confirm(); a.recTab(1);
      if (o.card) a.padCards = [{ live: () => true, press: (id) => n.card.push(id) }];
      const raw = { list: o.first ? [null] : [{ connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) }] }, pad = createPad({ getGamepads: () => raw.list });
      const r = createPadRouter({ input: new Input(null), app: a, SCREEN, binds: () => DEF_CONTROLS, world: () => ({ state: "PLAY" }), onPause() {}, onUiKey: (k) => { if (k !== "KeyR") a.resetArm = false; a.key(k); }, page: null });
      let t = 0; const run = () => r.route(pad.poll((t += 16)), t);
      if (!o.first) run();
      return { a, n, raw, run, tick: (k) => { for (let i = 0; i < k; i++) run(); } };
    };
    for (const id of [0, 1]) {
      const R0 = mkR({ card: true });
      R0.tick(40); R0.a.key("KeyR");
      R0.raw.list[0].buttons[id] = { pressed: true, value: 1 }; R0.run();
      check(`gap 3: armed, a controller ${id ? "EAST" : "SOUTH"} that answers a card (NEW VERSION READY / the load card) cancels the reset`, R0.a.resetArm === false && R0.n.card.length === 1 && R0.n.reset === 0, J({ arm: R0.a.resetArm, card: R0.n.card }));
    }
    const R1 = mkR({ first: true });
    R1.a.key("KeyR");
    R1.raw.list = [{ connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0, value: i === 0 ? 1 : 0 })) }];
    R1.run();
    check("gap 3: armed, the first press after a controller connects (swallowed) still cancels", R1.a.resetArm === false && R1.n.reset === 0 && R1.a.screen === SCREEN.STATS, J({ arm: R1.a.resetArm, scr: R1.a.screen }));
    const R2 = mkR();
    R2.a.key("KeyR"); R2.raw.list[0].axes[1] = 1; R2.run();
    check("armed: a controller direction cancels", R2.a.resetArm === false && R2.n.reset === 0);
  }
}

/* STATS' layout facts (was menudraw.test 13c / 13g / 13h and the iso guard): the BEST BY DIFFICULTY caption sits between the hero and the three bests
   wherever data is (or is not); the desk shows the cabinet notes; no JSON; tile words inside their tiles; armed, the coral title, the armed foot in
   place of the idle one; a double tap on RESET or on COPY never lands on AGAIN ERASES */
for (const b of ["c600", "iso", "d1366", "p393"]) {
  const F = BOX[b], G = RP.recordsGeom(F), u = G.u, B = G.d.bodies.stats;
  const s0 = snap(F, SUI({})).s, s1 = snap(F, SUI({ view: { ...SV0, hero: null, bests: [null, null, null] }, notes: [] })).s;
  const cap = (s) => s.texts.find((t) => /^BEST BY DIFFICULTY/.test(t.s)), nd = s0.texts.find((t) => t.s === "NORMAL DIFFICULTY"), reached = s0.texts.find((t) => /^FURTHEST/.test(t.s));
  check(`STATS (${b}): the BEST BY DIFFICULTY caption sits under the hero and over NORMAL DIFFICULTY, in the same place with no data`, !!cap(s0) && !!nd && cap(s0).y < nd.y && cap(s0).y > reached.y && cap(s1).y === cap(s0).y, J([cap(s0), cap(s1)]));
  check(`STATS (${b}): no JSON on the page`, !s0.texts.some((t) => /[{}\[\]]/.test(t.s)));
  const tiles = s0.rects.filter((r) => /^tile /.test(r.name)), tx = (r) => s0.texts.filter((t) => t.x >= r.x - 0.5 && t.x < r.x + r.w && t.y >= r.y - 0.5 && t.y < r.y + r.h);
  check(`STATS (${b}): each tile's value and name inside it (RUNS 47, PLAY TIME 3h12m, MEDALS 3/8)`, tiles.length === 3 && tiles.every((r) => tx(r).length === 2 && tx(r).every((t) => inside(t, r, 0.6))) && J(tiles.map((r) => tx(r).map((t) => t.s))) === J([["47", "RUNS"], ["3h12m", "PLAY TIME"], ["3/8", "MEDALS"]]), J(tiles.map((r) => tx(r).map((t) => t.s))));
  if (G.mode === "desk") check(`STATS (${b}): the desk shows the cabinet notes (the DAILY line, SINCE / LAST / SESSIONS), wrapped whole`, NOTES.every((n) => s0.texts.map((t) => t.s).join(" ").indexOf(n.split(" · ")[0]) >= 0) && s0.texts.some((t) => /SESSIONS/.test(t.s)));
  const a = snap(F, SUI({ arm: true })).s, title = a.texts.find((t) => /ERASE ALL/.test(t.s));
  check(`STATS armed (${b}): the title is coral, the AGAIN ERASES legend cream on the band`, !!title && title.col === CONST.cor && a.texts.some((t) => t.s === "AGAIN ERASES" && t.col === CONST.ink));
  if (G.mode === "desk") {
    const idleFoot = s0.texts.filter((t) => t.y > G.plate.y + G.plate.h).map((t) => t.s), armFoot = a.texts.filter((t) => t.y > G.plate.y + G.plate.h).map((t) => t.s);
    check(`STATS armed (${b}): the armed foot (ERASE R · COPY C · ANY OTHER KEY CANCELS) replaces the idle one`, idleFoot.includes("RESET") && !armFoot.includes("RESET") && armFoot.includes("ERASE") && armFoot.includes("ANY OTHER KEY CANCELS"), J([idleFoot, armFoot]));
  }
}
/* double tap: a point on the idle RESET or COPY target, tapped again once armed, is never AGAIN ERASES; armed, AGAIN ERASES and COPY sit inside
   the plate. Every box at 1 and 1.25 (a short compact box clamps the confirm plate toward the plate's top and shrinks its words, fk) */
for (const b of ALL) for (const ts of [1, 1.25]) {
  setTextScale(ts);
  const F = BOX[b], G = RP.recordsGeom(F), u = G.u, B = G.d.bodies.stats, f = G.d.confirm;
  frame(F, SUI({}));
  const zones = [];
  const fp = G.mode === "desk" ? RP._dbg.last.S.feet.find((q) => q.v === "tabs").fp : null;
  if (fp) for (const z of fp.zones) if (z.key === "KeyR" || z.key === "KeyC") zones.push(R4(z.x0, fp.y, z.x1 - z.x0, fp.h));
  if (B.acts) zones.push(B.acts.copy, B.acts.reset);
  let bad = 0;
  frame(F, SUI({ arm: true }));
  for (const z of zones) for (let y = z.y; y < z.y + z.h; y += 2) for (let x = z.x; x < z.x + z.w; x += 2) if (RP.statsHit(x * u, y * u, F, true) === "KeyR") bad++;
  const P = G.d.plate, inP = (r) => inside(r, P, 0.01);
  check(`STATS armed (${b}${ts > 1 ? " t125" : ""}): no point of the idle RESET or COPY targets is AGAIN ERASES (a double tap never erases); AGAIN ERASES and COPY inside the plate`, zones.length >= 2 && bad === 0 && inP(f.again) && inP(f.copy) && inP(f.box), J({ bad, box: f.box, P }));
  setTextScale(1);
}
function R4(x, y, w, h) { return { x, y, w, h }; }
/* the foot's tap zones end at their label and keycaps (+6 px): just past either edge of RESET is not R */
{
  const F = BOX.d1366, u = RP.recordsGeom(F).u;
  frame(F, SUI({}));
  const fp = RP._dbg.last.S.feet.find((q) => q.v === "tabs").fp, z = fp.zones.find((q) => q.key === "KeyR"), y = fp.mid * u;
  check("STATS foot: RESET taps R from its label to its keycap (6 px slack), and not 7 px past either edge", RP.statsHit((z.x0 - 5) * u, y, F, false) === "KeyR" && RP.statsHit((z.x1 + 5) * u, y, F, false) === "KeyR" && RP.statsHit((z.x0 - 8) * u, y, F, false) !== "KeyR" && RP.statsHit((z.x1 + 8) * u, y, F, false) !== "KeyR");
}
/* STATS' cache: steady frames, arming paints the armed page once */
{
  const F = BOX.d1366, ctx = rec({ widthK: K8 }), one = (ui) => { const n0 = ctx.calls.length, m0 = cache._dbg.misses; RP.drawRecordsPage(ctx.ctx, F, ui, 0); const calls = ctx.calls.slice(n0); return { calls, miss: cache._dbg.misses - m0, measure: calls.filter((c) => c.op === "measureText").length, hash: J(calls) }; };
  cache.release(); one(SUI({}));
  const a = one(SUI({})), b = one(SUI({})), f = one(SUI({ focus: "body" }));
  check("STATS: two steady frames equal, 0 misses, <= 400 calls, <= 20 measureText; a focus move misses nothing", a.hash === b.hash && a.miss === 0 && a.calls.length <= 400 && a.measure <= 20 && f.miss === 0, J({ calls: a.calls.length, measure: a.measure, f: f.miss }));
  const arm = one(SUI({ arm: true })), arm2 = one(SUI({ arm: true }));
  check("STATS: arming paints the armed page and its foot once, then holds (<= 400 calls)", arm.miss === 2 && arm2.miss === 0 && arm2.calls.length <= 400, J([arm.miss, arm2.miss, arm2.calls.length]));
}
/* main's KeyC on STATS still fires when STATS was reached by a tab step (onStats ran, the toast says so) */
{
  const { createGame } = await import("../src/main.js");
  await import("../src/core/board3.js");
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} };
  const g = createGame(null, { seed: 7 });
  g.app.screen = SCREEN.MENU; g.app.cursor = ITEMS.indexOf("RECORDS"); g.app.confirm(); g.app.recTab(1);
  const st = g.app.stats;
  g.input.onUiKey("KeyC");
  check("main's KeyC on STATS reached by a tab step: copies (its toast speaks) and STATS has its view and its wipe lists", g.app.screen === SCREEN.STATS && !!g.app.toast && !!g.app.toast.s && !!(st && st.view && st.wipe && st.wipe[0] === CLEAR_KEYS), J(g.app.toast));
}

console.log("\n  PAGE RECORDS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
