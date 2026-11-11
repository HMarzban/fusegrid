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
for (const n of ["settings", "guide", "records"]) lazy._set(n, await import("../src/render/pages/" + n + ".js"));
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

/* #c's border, from index.html's one canvas rule: the content box the gate measures is the stage minus it on each side */
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8"), bm = /\n\s*canvas\{[^}]*?border:(\d+(?:\.\d+)?)px solid/.exec(html), BORDER = bm ? +bm[1] : NaN;
check("#c's border is index.html's canvas rule (1 px): the content box the gates measure", BORDER === 1, bm && bm[0]);
check("stageCss is the content box's scale on the tighter axis (852 x 393: 0.725 -> (377 - 2) / 520)", Math.abs(stageCss(0.725, 600, 520, 1, 1) - 375 / 520) < 1e-12 && stageCss(0.5, 600, 520) === 0.5);

setHints(wordsOf("touch", DEF_CONTROLS));
const st0 = clampStats({ a: { runs: 3, rooms: 7, deaths: 2, kills: 40, picks: 9, bricks: 70, secs: 900, sessions: 2, days: 2, first: "2026-11-01", last: "2026-11-10" } });
const bests0 = recordBest(recordBest(recordBest({}, "0:0:1", 1840, 5), "1:0:1", 2210, 4), "2:0:1", 99, 1);
const STATS = { rows: statsRows(st0, bests0), notes: statsNotes(st0, { d: "2026-11-10", best: 900, played: 2, g: 3 }, "2026-11-10"), trophies: medalRows(0b10100101) };
const TOP = Array.from({ length: 10 }, (_, i) => ({ s: 99999 - i * 777, l: 8 - (i % 8), d: "2026-11-0" + (i % 9 + 1), t: i % 3, p: i % 16 }));
const CAB = () => ({ tiles: true, times: { b: { "1:0:0:1": 389 } }, medals: 165, stats: { a: { days: 4, runs: 9, rooms: 21, kills: 300 } }, daily: { played: 2, best: 900 }, top: TOP });

const LAND = [[852, 393], [932, 430], [740, 360]];
const boxOf = ([w, h]) => { const s = fitBox(w, h, true, 600, 520).s, css = stageCss(s, 600, 520, BORDER, BORDER); return { s, css, cv: { width: 600, height: 520, css, ownerDocument: { body: { getAttribute: () => "l" } }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 600 * s, height: 520 * s }) }, content: { x: 0, y: 0, w: 600 * s - 2 * BORDER, h: 520 * s - 2 * BORDER } }; };
const app = (B, scr, o) => {
  const a = Object.assign(createMenuApp({ settings: { fpm: 0 }, anaOpen: () => true, pageCount: SV.guidePageCount, recPages: (sc) => SV.recPagesOf(B.cv, "2d", sc, STATS.rows) }), { screen: scr, subT: 5, stats: STATS, dailyTag: "PLAYED", lastDev: "touch", pactUnlocked: true }, o);
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
  howto: [SCREEN.HOWTO, "pg"], items: [SCREEN.ITEMS, "pg"], enemies: [SCREEN.ENEMIES, "pg"], floor: [SCREEN.FLOOR, "pg"],
  scores: [SCREEN.SCORES, "rec"], stats: [SCREEN.STATS, "rec"], medals: [SCREEN.TROPHIES, "rec"],
};
function statesOf(B, name) {
  const [scr, v] = STATES[name];
  if (v === "pg") { frame(B, scr, {}); return Array.from({ length: SV.guidePageCount() }, (_, p) => ({ infoPg: p })); }
  if (v === "rec") return Array.from({ length: SV.recPagesOf(B.cv, "2d", scr, STATS.rows) }, (_, p) => ({ recFocus: 1, recPage: p })).concat([{ recFocus: 0 }]);
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

/* ---- the touch half: every touch target >= 44 CSS px measured inside #c's border, >= 8 apart (the gate's own numbers) ---- */
{
  const bad = [], seen = new Set();
  sweep(LAND, (B, at, name, frames) => {
    for (const { o, snap, err, g } of frames) {
      const w = at + " " + name + " " + J(o);
      if (err || snap.fault) { bad.push(w + " threw " + (err ? err.message : snap.fault)); continue; }
      if (snap.box && snap.box.el !== "c") bad.push(w + " drew on #" + snap.box.el);
      for (const k of ["touch", "gap"]) {
        if (g[k].status === "pass") { seen.add(name); continue; }
        bad.push(w + " " + k + " " + g[k].status + " " + g[k].on + " " + g[k].value + (g[k].note ? " (" + g[k].note + ")" : ""));
      }
    }
  });
  check("landscape phones (852x393, 932x430, 740x360) at text 1 and 1.25: every touch target on every R1 page >= " + FLOOR.touch + " CSS px measured inside #c's border and >= " + FLOOR.gap + " apart",
    bad.length === 0 && seen.size === Object.keys(STATES).length, bad.slice(0, 12).join(" | ") + " (" + bad.length + ") seen " + J([...seen]));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
