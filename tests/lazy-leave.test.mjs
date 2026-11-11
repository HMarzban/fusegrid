// R1 cohesion 1 (integration review, lane lesson 5): a touch player is never stuck on a lazy page. While SETTINGS / GRAPHICS, GUIDE or RECORDS
// loads, a tap on its LOADING plate does nothing; once the import failed (the plate says DID NOT LOAD), a tap OFF the plate backs out on every
// one of them, through the real pointer and the real hits, and a tap ON it stays inert. Fresh process: no lazy page module is in.
import { mountPointer } from "../src/app/pointer.js";
import { SCREEN, optRows } from "../src/app/menuapp.js";
import { overlayBox, pauseHit, touchLay } from "../src/render/scenes.js";
import { controlsHit, dims } from "../src/render/shellview.js";
import * as md from "../src/render/menudraw.js";
import { loadBox } from "../src/render/kit/room.js";
import * as cache from "../src/render/kit/cache.js";
import * as lazy from "../src/render/pages/lazy.js";
import { rec } from "./lib/textrec.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) { cond ? pass++ : fail++; console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : "")); }
const J = JSON.stringify;
class Cv { constructor(w, h) { this.width = w; this.height = h; this.r = rec({ widthK: 0.6 }); } getContext() { return this.r.ctx; } }
cache.setFactory((w, h) => new Cv(w, h));

/* a touch-portrait phone's #sh box (393 x 852 CSS px at 1 box unit per CSS px) and a landscape phone's #c (600 x 520 at 0.6 CSS px a unit) */
function mkEl(w, h, css, lay) {
  const L = {};
  return { width: w, height: h, css, logo: lay === "p" ? 120 : undefined, getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    addEventListener(ty, fn) { (L[ty] = L[ty] || []).push(fn); }, fire(ty, ev) { (L[ty] || []).forEach((fn) => fn(ev)); },
    ownerDocument: { body: { getAttribute: (k) => (k === "data-lay" ? lay : null) } } };
}
const HIT = { overlayBox, pauseHit, touchLay, controlsHit, dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, enemiesHit: md.enemiesHit,
  guideReadHit: md.guideReadHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, recTabHit: md.recTabHit, layout: md.layout };
const PAGES = [["settings", SCREEN.SETTINGS], ["settings", SCREEN.GRAPHICS], ["guide", SCREEN.GUIDE], ["guide", SCREEN.HOWTO], ["guide", SCREEN.ITEMS], ["guide", SCREEN.ENEMIES], ["guide", SCREEN.FLOOR],
  ["records", SCREEN.SCORES], ["records", SCREEN.STATS], ["records", SCREEN.TROPHIES]];
const BOXES = [["phone #sh", 393, 852, 1, "p"], ["landscape #c", 600, 520, 0.6, "l"]];
const paint = (scr, c, L, t) => {
  const touch = true, o = { level: 1 };
  if (scr === SCREEN.SETTINGS) md.drawSettings(c, L, 0, { touch, rows: optRows(false), row: "MUSIC", vals: {}, level: 1 });
  else if (scr === SCREEN.GRAPHICS) md.drawGraphics(c, L, 0, { touch, level: 1 });
  else if (scr === SCREEN.GUIDE) md.drawGuide(c, L, 0, 0, "2d", touch, o);
  else if (scr === SCREEN.HOWTO) md.drawHowTo(c, L, 0, "2d", touch, o);
  else if (scr === SCREEN.ITEMS) md.drawItemsHelp(c, L, 0, "2d", touch, o);
  else if (scr === SCREEN.ENEMIES) md.drawEnemiesHelp(c, L, 0, "2d", touch, o);
  else if (scr === SCREEN.FLOOR) md.drawFloorHelp(c, L, 0, "2d", touch, o);
  else (scr === SCREEN.SCORES ? md.drawScores : scr === SCREEN.STATS ? md.drawStats : md.drawTrophies)(c, { level: 1 }, L, 0, touch);
};
function tapAll(failed) {
  const out = [];
  for (const [bn, W, H, css, lay] of BOXES) for (const [name, scr] of PAGES) {
    const cv = mkEl(W, H, css, lay), { cw, ch, lg } = dims(cv, "2d"), L = md.layout(cw, ch, lg, css), t = rec({ widthK: 0.6 });
    paint(scr, t.ctx, L, t);
    const B = loadBox({ W: cw, H: ch, touch: true, shell: lay === "p", css }), log = [];
    const app = { screen: scr, optRows: () => optRows(false), optRow: 0, gfxRow: 0, guideRow: 0, foeRow: 0, foeTip: false, infoPg: 0, recFocus: 0, recPage: 0, scoreHeat: 0, resetArm: false, pauseView: 0, level: 1 };
    for (const m of ["confirm", "back", "recTab", "recPageStep", "move", "foeTap", "foeFocus", "guideFocus", "infoStep"]) app[m] = (...a) => { log.push(m); return true; };
    app.foeClose = () => false;
    mountPointer({ canvas: cv, fit: null, input: { _intent: { fire: false }, onUiKey: (k) => log.push(k) }, app, world: { state: "PLAY" }, kind: () => "2d", ctl: () => null, hit: HIT });
    cv.fire("pointerdown", { clientX: B.x + B.w / 2, clientY: B.y + B.h / 2, pointerType: "touch" });
    const on = log.slice();
    log.length = 0;
    cv.fire("pointerdown", { clientX: 3, clientY: 3, pointerType: "touch" });
    out.push({ at: bn + " " + name + " " + scr, on, off: log.slice(), drew: t.texts.map((x) => x.s) });
  }
  return out;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

/* in flight: every tap on and off the LOADING plate is inert, SETTINGS' off-plate tap excepted (its rule since Task 3.4) */
md._rec.want = () => new Promise(() => {});
let r = tapAll(false);
check("an import in flight: LOADING on every lazy page, and GUIDE / RECORDS ignore every tap (a slow import is not a failure)",
  r.every((q) => q.drew.includes("LOADING") && q.on.length === 0 && (/^.* settings /.test(q.at) ? true : q.off.length === 0)), J(r.filter((q) => q.on.length || (!/ settings /.test(q.at) && q.off.length)).map((q) => [q.at, q.on, q.off])));

/* the import failed: DID NOT LOAD; a tap off the plate leaves (back / confirm = back on a read-only page), a tap on it stays inert */
md._rec.want = () => Promise.reject(new Error("offline"));
tapAll(true);
await flush(); await flush();
r = tapAll(true);
const left = (q) => q.off.length === 1 && (q.off[0] === "back" || q.off[0] === "confirm");
check("DID NOT LOAD on SETTINGS, GRAPHICS, the five GUIDE pages and the three RECORDS tabs, on a phone and a landscape #c: a touch tap off the plate backs out, one on it does nothing",
  r.length === 20 && r.every((q) => q.drew.includes("DID NOT LOAD") && q.on.length === 0 && left(q)), J(r.filter((q) => !(q.drew.includes("DID NOT LOAD") && q.on.length === 0 && left(q))).map((q) => [q.at, q.on, q.off])));
{
  const L = md.layout(393, 852, 120, 1), F = { W: 393, H: 852, touch: true, shell: true, css: 1 }, B = loadBox(F), cx = B.x + B.w / 2, cy = B.y + B.h / 2;
  check("the failed hits are SETTINGS' loadHit: -2 on the plate, -1 off it (guideHit, enemiesHit, guideReadHit, recTabHit, scoresHit; statsHit plate / back)",
    md.guideHit(cx, cy, L, 4, true) === -2 && md.guideHit(3, 3, L, 4, true) === -1 && md.enemiesHit(cx, cy, L, true) === -2 && md.enemiesHit(3, 3, L, true) === -1 &&
    md.guideReadHit(cx, cy, L, true, "FLOOR", 0) === -2 && md.guideReadHit(3, 3, L, true, "FLOOR", 0) === -1 && md.recTabHit(cx, cy, L, 0, true) === -2 && md.recTabHit(3, 3, L, 0, true) === -1 &&
    md.scoresHit(cx, cy, L, true) === -2 && md.scoresHit(3, 3, L, true) === -1 && md.statsHit(cx, cy, L, false, true, true) === "plate" && md.statsHit(3, 3, L, false, true, true) === "back" &&
    md.settingsHit(cx, cy, L, optRows(false), true) === -2 && md.settingsHit(3, 3, L, optRows(false), true) === -1);
}
console.log("\n  LAZY LEAVE RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
