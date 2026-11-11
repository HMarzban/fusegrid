/* R1 landscape: the touch floors on a landscape phone, where every R1 page draws on the board canvas #c (no shell box). Every R1 screen, every page
   of it, at text scale 1 and 1.25, painted through the real drawShell routing with the probe on, then judged by tools/ui/gates.mjs's own evaluate()
   against #c's CSS CONTENT box (the stage fit.js applied, minus #c's 1 px border, pinned below against index.html): every touch target >= 44 CSS
   px measured (the gate's 43.95), >= 8 apart. The #c pages read fit.js stageCss (the content box's scale), so a 44 CSS px target measures 44 after
   the border, never 43.77. */
import { readFileSync } from "node:fs";
import { rec } from "./lib/textrec.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
const lazy = await import("../src/render/pages/lazy.js");
const MODS = {};
for (const n of ["settings", "guide", "records"]) lazy._set(n, (MODS[n] = await import("../src/render/pages/" + n + ".js")));
await import("../src/render/pages/menu.js");
const { setTextScale } = await import("../src/render/kit/type.js");
const probe = await import("../src/render/kit/probe.js");
const { SCREEN, optRows, createMenuApp } = await import("../src/app/menuapp.js");
const { fitBox, stageCss } = await import("../src/app/fit.js");
const SV = await import("../src/render/shellview.js");
const { evaluate, FLOOR } = await import("../tools/ui/lib/gatelib.mjs");
const { setHints } = await import("../src/render/hintcopy.js");
const { wordsOf } = await import("../src/app/hints.js");
const { DEF_CONTROLS } = await import("../src/app/controls.js");
const { statsRows, statsNotes, clampStats } = await import("../src/app/stats.js");
const { medalRows } = await import("../src/app/medals.js");
const { recordBest } = await import("../src/app/bests.js");
const { gfxView } = await import("../src/app/gfx.js");
const { ITEMS } = await import("../src/app/menuapp.js");
const W = await import("../src/render/words.js");
const { GFX_LABELS } = MODS.settings;
const { POWER, FOES } = await import("../src/core/entities.js");
const { TILE_NAME } = await import("../src/core/feat.js");

/* #c's border, from index.html's one canvas rule: the content box the gate measures is the stage minus it on each side */
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8"), bm = /\n\s*canvas\{[^}]*?border:(\d+(?:\.\d+)?)px solid/.exec(html), BORDER = bm ? +bm[1] : NaN;
check("#c's border is index.html's canvas rule (1 px): the content box the gates measure", BORDER === 1, bm && bm[0]);
check("stageCss is the content box's scale on the tighter axis (852 x 393: 0.725 -> (377 - 2) / 520)", Math.abs(stageCss(0.725, 600, 520, 1, 1) - 375 / 520) < 1e-12 && stageCss(0.5, 600, 520) === 0.5);

setHints(wordsOf("touch", DEF_CONTROLS));
const st0 = clampStats({ a: { runs: 3, rooms: 7, deaths: 2, kills: 40, picks: 9, bricks: 70, secs: 900, sessions: 2, days: 2, first: "2026-11-01", last: "2026-11-10" } });
const bests0 = recordBest(recordBest(recordBest({}, "0:0:1", 1840, 5), "1:0:1", 2210, 4), "2:0:1", 99, 1);
const STATS = { rows: statsRows(st0, bests0), notes: statsNotes(st0, { d: "2026-11-10", best: 900, played: 2, g: 3 }, "2026-11-10"), trophies: medalRows(0b10100101) };
const TOP = Array.from({ length: 10 }, (_, i) => ({ s: 99999 - i * 777, l: 8 - (i % 8), d: "2026-11-0" + (i % 9 + 1), t: 0, p: i % 16 })); // ten NORMAL rows: SCORES pages its whole table
const CAB = () => ({ tiles: true, times: { b: { "1:0:0:1": 389 } }, medals: 165, stats: { a: { days: 4, runs: 9, rooms: 21, kills: 300 } }, daily: { played: 2, best: 900 }, top: TOP });

const LAND = [[852, 393], [932, 430], [740, 360], [667, 375]];
const boxOf = ([w, h]) => { const s = fitBox(w, h, true, 600, 520).s, css = stageCss(s, 600, 520, BORDER, BORDER); return { s, css, cv: { width: 600, height: 520, css, ownerDocument: { body: { getAttribute: () => "l" } }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 600 * s, height: 520 * s }) }, content: { x: 0, y: 0, w: 600 * s - 2 * BORDER, h: 520 * s - 2 * BORDER } }; };
const app = (B, scr, o) => {
  const a = Object.assign(createMenuApp({ settings: { fpm: 0 }, anaOpen: () => true, pageCount: SV.guidePageCount, recPages: (sc) => SV.recPagesOf(B.cv, "2d", sc, TOP.length) }), { screen: scr, subT: 5, stats: STATS, dailyTag: "PLAYED", lastDev: "touch", pactUnlocked: true }, o);
  if (scr === SCREEN.GRAPHICS) a.gfxView = () => gfxView(a.settings, "2d", {});
  return a;
};
/* one frame through the real routing; its probe record and the gates over it (no image: the measuring gates only) */
function frame(B, scr, o) {
  const R = rec({ widthK: 0.6 * 1.08 });
  probe.setOn(true);
  let err = null;
  try { SV.drawShell(R.ctx, app(B, scr, o), { state: "PLAY", time: 1, level: 1 }, B.cv, "2d", () => TOP, () => 0, CAB); } catch (e) { err = e; }
  const snap = probe.snapshot(); probe.setOn(false);
  return { snap, err, g: evaluate({ flags: { dpr: 3, phone: true }, canvases: { c: B.content }, ui: snap }, null, null) };
}
/* every state of a screen that shows a different part of it: each focused row (a row's page is the focused row's), each page of a paged one */
const STATES = {
  menu: [SCREEN.MENU, () => [0, 1, 2, 3, 4, 5, 6].map((c) => ({ cursor: c }))],
  level: [SCREEN.LEVEL, () => [0, 1, 2, 3, 4].map((r) => ({ levelRow: r })).concat([0, 1, 2, 3, 4].map((c) => ({ levelRow: 3, modOpen: true, modeCur: c })))],
  options: [SCREEN.SETTINGS, () => [false, true].flatMap((r3d) => optRows(r3d).map((_, i) => ({ render3d: r3d, optRow: i })))],
  graphics: [SCREEN.GRAPHICS, () => [0, 1, 2, 3, 4, 5, 6, 7].map((r) => ({ gfxRow: r }))],
  guide: [SCREEN.GUIDE, () => [0, 1, 2, 3].map((r) => ({ guideRow: r }))],
  howto: [SCREEN.HOWTO, "pg"], items: [SCREEN.ITEMS, "pg"], enemies: [SCREEN.ENEMIES, () => FOES.map((_, i) => ({ foeRow: i }))], floor: [SCREEN.FLOOR, "pg"], // ENEMIES' page is the focused foe's
  scores: [SCREEN.SCORES, "rec"], stats: [SCREEN.STATS, "rec"], medals: [SCREEN.TROPHIES, "rec"],
};
function statesOf(B, name) {
  const [scr, v] = STATES[name];
  if (v === "pg") { frame(B, scr, {}); return Array.from({ length: SV.guidePageCount() }, (_, p) => ({ infoPg: p })); }
  if (v === "rec") return Array.from({ length: SV.recPagesOf(B.cv, "2d", scr, TOP.length) }, (_, p) => ({ recFocus: 1, recPage: p })).concat([{ recFocus: 0 }]);
  return v();
}
const sweep = (boxes, each) => {
  for (const ts of [1, 1.25]) for (const wh of boxes) {
    setTextScale(ts);
    const B = boxOf(wh), at = wh.join("x") + (ts > 1 ? " 125%" : "");
    for (const name of Object.keys(STATES)) each(B, at, name, statesOf(B, name).map((o) => ({ o, ...frame(B, STATES[name][0], o) })));
  }
  setTextScale(1);
};

const loadingFrame = (B, scr, name) => { lazy._set(name, null); const r = frame(B, scr, {}); lazy._set(name, MODS[name]); return r; };
const GUIDE_WORDS = { guide: ["HOW TO PLAY", "POWER-UPS", "ENEMIES", "FLOOR"], howto: ["CLEAR EVERY ENEMY", "GOLD WALL NEVER BREAKS", "MOVE", "PAUSE"], items: POWER.map((p) => p.name), enemies: FOES.map((f) => f.name), floor: Object.values(TILE_NAME) };
/* what each screen must show on some page of it: every row, door, item, foe, tile, score, medal and STATS part (reachable by paging) */
const MUST = {
  menu: ITEMS, level: [W.LABEL.LEVEL, W.LABEL.DIFFICULTY, W.LABEL.GAME_SPEED, W.LABEL.MODIFIERS, "START", ...Object.values(W.MOD), W.TIME_TRIAL], options: [...optRows(true)], graphics: [...GFX_LABELS],
  ...GUIDE_WORDS, scores: [W.LABEL.DIFFICULTY, ...W.BADGE_NAMES, ...TOP.map((r) => W.sep3 ? W.sep3(r.s) : String(r.s).replace(/\B(?=(\d{3})+(?!\d))/g, ","))],
  stats: [W.STATS_WORDS.BEST_SCORE, W.STATS_WORDS.LIFETIME, W.STATS_WORDS.CLEARED, W.STATS_WORDS.KILLS, W.STATS_WORDS.PICKS, W.STATS_WORDS.DEATHS, W.STATS_WORDS.DAYS, W.STATS_WORDS.RUNS, W.STATS_WORDS.PLAY_TIME, W.STATS_WORDS.COPY_SHORT, W.STATS_WORDS.RESET],
  medals: STATS.trophies.map((r) => r[0]),
};
const LOADS = { options: ["settings", SCREEN.SETTINGS], graphics: ["settings", SCREEN.GRAPHICS], guide: ["guide", SCREEN.GUIDE], howto: ["guide", SCREEN.HOWTO], items: ["guide", SCREEN.ITEMS], enemies: ["guide", SCREEN.ENEMIES], floor: ["guide", SCREEN.FLOOR], scores: ["records", SCREEN.SCORES], stats: ["records", SCREEN.STATS], medals: ["records", SCREEN.TROPHIES] };
const GATES = ["touch", "gap", "cap", "inside", "plate"];
const worst = (fs, k) => Math.min(...fs.map((f) => (f.g[k] && f.g[k].value != null ? f.g[k].value : Infinity)));

/* ---- the landscape phones: every touch target >= 44 CSS px measured inside #c's border, >= 8 apart; every text at the phone's cap floors;
   everything inside the box and every plate's ring inside it; every row / item reachable by paging; each page's LOADING plate too ---- */
{
  const bad = [], seen = new Set(), pages = {};
  sweep(LAND, (B, at, name, frames) => {
    for (const { o, snap, err, g } of frames) {
      const w = at + " " + name + " " + J(o);
      if (err || snap.fault) { bad.push(w + " threw " + (err ? err.message : snap.fault)); continue; }
      if (!snap.box || snap.box.el !== "c") bad.push(w + " drew on #" + (snap.box && snap.box.el));
      for (const k of GATES) if (g[k].status !== "pass") bad.push(w + " " + k + " " + g[k].status + " " + g[k].on + " " + g[k].value + (g[k].note ? " (" + g[k].note + ")" : ""));
      seen.add(name);
    }
    const all = " " + frames.flatMap((f) => f.snap.texts.map((t) => t.s)).join(" ") + " ", miss = MUST[name].filter((m) => !all.includes(" " + m + " ") && !String(m).split(" ").every((x) => all.includes(" " + x + " ")));
    if (miss.length) bad.push(at + " " + name + " never shows " + J(miss));
    pages[at + " " + name] = frames.length;
    if (LOADS[name]) { const L = loadingFrame(B, LOADS[name][1], LOADS[name][0]); for (const k of ["cap", "inside", "plate"]) if (L.g[k].status !== "pass") bad.push(at + " " + name + " LOADING " + k + " " + L.g[k].status + " " + L.g[k].on + " " + L.g[k].value); if (L.snap.page !== "loading") bad.push(at + " " + name + " LOADING not drawn"); }
  });
  check("landscape phones (" + LAND.map((b) => b.join("x")).join(", ") + ") at text 1 and 1.25: every R1 page and its LOADING plate pass the gates' touch (>= " + FLOOR.touch + " CSS px inside #c's border), gap (>= " + FLOOR.gap + "), cap (phone floors), inside and plate; every row, item, foe, tile, score, medal and STATS part shows on some page",
    bad.length === 0 && seen.size === Object.keys(STATES).length, bad.slice(0, 12).join(" | ") + " (" + bad.length + ")");
  if (process.env.LAND_PRINT) console.log(J(pages));
}

/* ---- a controller on a landscape phone (lane lesson 6): the paged SETTINGS / GRAPHICS strip keeps BACK + its keycap under PAGE n OF m, at the floors ---- */
{
  const bad = [];
  setHints(wordsOf("pad", DEF_CONTROLS));
  for (const ts of [1, 1.25]) for (const wh of LAND) {
    setTextScale(ts);
    const B = boxOf(wh);
    for (const [scr, o] of [[SCREEN.SETTINGS, { optRow: 0, lastDev: "pad" }], [SCREEN.GRAPHICS, { gfxRow: 0, lastDev: "pad" }]]) {
      const f = frame(B, scr, o), at = wh.join("x") + " " + ts + " " + scr, H = MODS.settings._dbg.last.Pl.hint;
      if (!H || J(H.ps.map((q) => q.t || q.cap)) !== J(["BACK", wordsOf("pad", DEF_CONTROLS).back])) bad.push(at + " no strip hint");
      for (const k of GATES) if (f.g[k].status !== "pass") bad.push(at + " " + k + " " + f.g[k].on + " " + f.g[k].value);
    }
  }
  setTextScale(1); setHints(wordsOf("touch", DEF_CONTROLS));
  check("a controller on the landscape phones: SETTINGS / GRAPHICS keep BACK + its keycap on the pager strip, every gate passing", bad.length === 0, bad.slice(0, 8).join(" | "));
}

/* ---- lead ruling (R1 landscape leftovers): ENEMIES' compact tooltip holds its words inside its own plate for every foe at 667x375 and 852x393, text 1
   and 1.25: the full tip where it fits, else the one-line points rule (words.js POINTS_RULE), never scaled; it may cover the page head under the BACK row,
   never BACK, the page keys or the focused foe's row ---- */
{
  const GP = MODS.guide, bad = [];
  for (const ts of [1, 1.25]) for (const wh of [[852, 393], [667, 375]]) {
    setTextScale(ts);
    const B = boxOf(wh), G = GP.guideGeom({ W: 600, H: 520, touch: true, shell: false, css: B.css }, "ENEMIES"), D = G.d, at = wh.join("x") + " " + ts;
    if (Math.abs(G.u * B.css - 1) > 1e-9) bad.push(at + " scales " + (G.u * B.css).toFixed(3));
    const ov = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    D.tips.forEach((t, i) => {
      const it = D.items[D.order[i]], P = D.plate, U = t.U, keys = D.pager ? [D.pager.up, D.pager.dn] : [];
      if (t.r.h + 0.01 < t.need) bad.push(at + " " + FOES[i].name + " tip " + t.r.h.toFixed(1) + " < " + t.need.toFixed(1));
      if (U.x < P.x - 0.01 || U.y < P.y - 0.01 || U.x + U.w > P.x + P.w + 0.01 || U.y + U.h > P.y + P.h + 0.01) bad.push(at + " " + FOES[i].name + " tip off the plate");
      if (ov(U, it.r) || ov(U, D.head.back) || keys.some((k) => ov(U, k))) bad.push(at + " " + FOES[i].name + " tip covers its row, BACK or a page key");
      if (t.short && t.n !== 1) bad.push(at + " " + FOES[i].name + " short tip on " + t.n + " lines");
    });
  }
  setTextScale(1);
  check("ENEMIES' compact tooltip: inside its own plate for every foe (667x375, 852x393 at 1 and 1.25), never scaled, never over BACK, a page key or its row; the short form one line", bad.length === 0, bad.slice(0, 8).join(" | "));
}
/* ---- LEVEL SELECT's finale flag: cream on an open level's well, dark on the lit one, >= 4.5 against that key's face in every world ---- */
{
  const { worldTokens, CONST } = await import("../src/render/kit/tokens.js"), { colOf, cr } = await import("../tools/ui/lib/gatelib.mjs"), LP = await import("../src/render/pages/level.js"), bad = [];
  for (let lv = 1; lv <= 8; lv++) { const tok = worldTokens(lv); for (const [k, face] of [["well", tok.well], ["lit", tok.lit]]) { const c = cr(colOf(LP.FLAG_INK[k]).L, colOf(face).L); if (c < 4.5) bad.push(lv + " " + k + " " + c); } }
  check("LEVEL SELECT's finale flag reads >= 4.5 against its key's face (well: cream, lit: dark) in all eight worlds", bad.length === 0 && LP.FLAG_INK.well === CONST.ink, bad.join(" | "));
}

/* ---- the one named exemption: a 568 x 320 phone (#c 236 x 204 CSS px; three RECORDS tabs and BACK do not fit 44 CSS px across, nor one GUIDE
   band a page): there the pages that cannot page whole scale as one piece, their last give-way. Asserted at their measured best (today's values,
   floored to 0.1: a regression fails), and never a throw, an overflow (inside, plate) or a LOADING plate under the floors ---- */
const EX568 = { touch: { menu: 31, level: 30.4, options: 43.9, graphics: 35.8, guide: 28, howto: 30.9, items: 23.6, enemies: 24.2, floor: 25.5, scores: 40.6, stats: 40.6, medals: 40.6 },
  cap: { menu: 7.9, level: 8.1, options: 11.2, graphics: 9.5, guide: 7.3, howto: 8.1, items: 6.4, enemies: 5.9, floor: 7.6, scores: 0.3, stats: 0.5, medals: 1.8 } };
{
  const bad = [], got = {};
  sweep([[568, 320]], (B, at, name, frames) => {
    for (const { o, snap, err, g } of frames) {
      const w = at + " " + name + " " + J(o);
      if (err || snap.fault) { bad.push(w + " threw " + (err ? err.message : snap.fault)); continue; }
      for (const k of ["inside", "plate"]) if (g[k].status !== "pass") bad.push(w + " " + k + " " + g[k].on);
    }
    const t = worst(frames, "touch"), c = worst(frames, "cap");
    got[at + " " + name] = [t, c];
    if (t < EX568.touch[name] || c < EX568.cap[name]) bad.push(at + " " + name + " under its measured best " + J([t, c]) + " < " + J([EX568.touch[name], EX568.cap[name]]));
    if (LOADS[name]) { const L = loadingFrame(B, LOADS[name][1], LOADS[name][0]); for (const k of ["inside", "plate"]) if (L.g[k].status !== "pass") bad.push(at + " " + name + " LOADING " + k); }
  });
  if (process.env.LAND_PRINT) console.log(J(got));
  check("568x320 (the named exemption): no throw, no overflow, every page at or over its measured best touch and cap", bad.length === 0, bad.slice(0, 10).join(" | "));
}

/* ---- R1 cohesion 3: one arrangement rule on a touch landscape shell box (a landscape tablet, AGENTS "a landscape tablet is the desktop form with
   touch pitches"): MENU, LEVEL SELECT, SETTINGS, GUIDE and RECORDS all take the desk form at clear tablet sizes, and RECORDS' touch-desk keeps the
   touch floors (tabs, the DIFFICULTY bank, STATS' COPY STATS / RESET keys >= 44 CSS px) and taps its keys ---- */
{
  const MP = await import("../src/render/pages/menu.js"), LP = await import("../src/render/pages/level.js"), RP = MODS.records, out = [];
  for (const [w, h] of [[1366, 1024], [1280, 800], [1180, 820], [1024, 768], [1366, 768]]) for (const css of [1, 1.25]) {
    const F = { W: w / css, H: h / css, touch: true, shell: true, css };
    const modes = { menu: MP.menuGeom(F).mode, level: LP.levelGeom(F, { unlocked: true }).d.mode, settings: MODS.settings.settingsGeom(F, optRows(false)).mode, guide: MODS.guide.guideGeom(F, "GUIDE").mode, records: RP.recordsGeom(F).mode };
    if (Object.values(modes).some((m) => m !== "desk")) out.push(w + "x" + h + "@" + css + " " + J(modes));
  }
  check("a landscape tablet (a touch l shell box at 1366x1024, 1280x800, 1180x820, 1024x768, 1366x768, CSS scale 1 and 1.25): MENU, LEVEL SELECT, SETTINGS, GUIDE and RECORDS all take the desk form", out.length === 0, out.join(" | "));
  const bad = [];
  for (const [w, h] of [[1366, 1024], [1024, 768]]) {
    const F = { W: w, H: h, touch: true, shell: true, css: 1 }, G = RP.recordsGeom(F), d = G.d, u = G.u, a = d.bodies.stats.acts, mid = (r) => [(r.x + r.w / 2) * u, (r.y + r.h / 2) * u];
    for (const [n, r] of [["tab", d.tabs[1]], ["bank", d.bodies.scores.keys[0]], ["copy", a && a.copy], ["reset", a && a.reset]]) if (!r || r.h * u * F.css < 43.95) bad.push(w + "x" + h + " " + n + " " + J(r));
    if (!a || RP.statsHit(...mid(a.copy), F, false) !== "KeyC" || RP.statsHit(...mid(a.reset), F, false) !== "KeyR" || RP.tabHit(...mid(d.tabs[2]), F) !== 2 || RP.scoresHit(...mid(d.bodies.scores.keys[2]), F) !== 2) bad.push(w + "x" + h + " hits");
    if (J(RP.footItems("scores", "tabs", wordsOf("touch", DEF_CONTROLS), true)) !== J([{ t: W.REC_WORDS.TAP }]) || J(RP.footItems("stats", "arm", wordsOf("touch", DEF_CONTROLS), true)) !== J([{ t: W.STATS_WORDS.TAP_CANCEL }])) bad.push("tap foot");
    if (G.mode !== "desk" || !G.foot) bad.push(w + "x" + h + " not the desk form with a foot");
  }
  check("RECORDS' touch-desk: tabs, DIFFICULTY bank and STATS' COPY STATS / RESET keys >= 44 CSS px and tapped (C, R, a tab, a difficulty); its tap-mode foot is REC_WORDS.TAP (armed: TAP ANYWHERE ELSE TO CANCEL)", bad.length === 0, bad.join(" | "));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
