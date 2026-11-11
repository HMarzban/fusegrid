/* v202 delivery, the RENDER row's job states and the loader spot (lane D). The row
   carries a look's job in its value slot plus a 2 px line along the band bottom;
   nothing reflows; the words fit the slot at every layout. shellview hands
   index.html's loader where the chip may show. */
import * as md from "../src/render/menudraw.js";
import { loaderSpot, stepLookNote } from "../src/render/shellview.js";
import { overlayBox } from "../src/render/scenes.js";
import { setHints } from "../src/render/hintcopy.js";
import { SCREEN, optRows } from "../src/app/menuapp.js";

let pass = 0, fail = 0;
const check = (name, ok, detail) => { ok ? pass++ : fail++; console.log((ok ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : "")); };

/* Measures on the safe side of real fonts: mono 12 px advances 0.6 em, system-ui
   600 caps run about 0.69 em, so 0.62 / 0.72 over-estimate both. */
const px = (f) => +(/(\d+)px/.exec(f) || [0, 12])[1];
function recCtx() {
  const c = { font: "12px x", fillStyle: "#000", texts: [], rects: [], globalAlpha: 1 };
  return new Proxy(c, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "measureText") return (s) => ({ width: String(s).length * px(t.font) * (/monospace/.test(t.font) ? 0.62 : 0.72) });
      if (k === "fillText") return (s, x, y) => t.texts.push({ s: String(s), x, y, col: t.fillStyle, font: t.font });
      if (k === "fillRect") return (x, y, w, h) => t.rects.push({ x, y, w, h, col: t.fillStyle });
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

// ---- lookNote: the memo timeline ----
{
  let m = null, r;
  const job = { k: "px", state: "loading", phase: "files", done: 3, total: 26 };
  r = md.lookNote(m, job, 10, "px"); m = r.m;
  check("a live wait shows nothing new under 400 ms", r.n === null);
  r = md.lookNote(m, job, 10.39, "px"); m = r.m;
  check("... still nothing at 390 ms", r.n === null);
  r = md.lookNote(m, job, 10.41, "px"); m = r.m;
  check("past 400 ms the files count shows", r.n && r.n.st === "loading" && r.n.done === 3 && r.n.total === 26);
  const f0 = r.n.fill;
  r = md.lookNote(m, { k: "px", state: "preparing", phase: "bake", done: 140, total: 255 }, 10.6, "px"); m = r.m;
  check("PREPARING with a count: the fill moves on, never back", r.n.st === "preparing" && r.n.fill > f0, r.n.fill + " > " + f0);
  const f1 = r.n.fill;
  r = md.lookNote(m, { k: "px", state: "preparing", phase: "warm", done: 0, total: 0 }, 10.7, "px"); m = r.m;
  check("a phase with no count: still stripes (fill -1), never a made-up share", r.n.fill === -1);
  r = md.lookNote(m, { k: "px", state: "loading", done: 1, total: 26 }, 10.75, "px"); m = r.m;
  check("the fill is monotonic inside a job", r.n.fill >= f1);
  r = md.lookNote(m, null, 11, "px"); m = r.m;
  check("the job ends: READY", r.n && r.n.st === "ready" && r.n.fill === 1);
  r = md.lookNote(m, null, 11.79, "px"); m = r.m;
  check("READY holds 0.8 s", r.n && r.n.st === "ready");
  r = md.lookNote(m, null, 11.81, "px"); m = r.m;
  check("then the plain value", r.n === null && m === null);
}
{
  let r = md.lookNote(null, { k: "3d", state: "loading", done: 0, total: 20 }, 0, "3d");
  r = md.lookNote(r.m, null, 0.2, "3d");
  check("a job that finished unseen flashes no READY (switching within cache is silent)", r.n === null && r.m === null);
  r = md.lookNote(null, { k: "3d", state: "preparing", phase: "shaders", done: 18, total: 31 }, 0, "3d");
  r = md.lookNote(r.m, { k: "3d", state: "preparing", phase: "shaders", done: 18, total: 31 }, 0.5, "3d");
  r = md.lookNote(r.m, null, 0.6, "2d");
  check("a changed mind (pick moved off the look) shows no READY", r.n === null);
  r = md.lookNote(null, { k: "px", state: "failed" }, 5, "2d");
  check("a failure shows at once, whatever the saved value reverted to", r.n && r.n.st === "fail");
  r = md.lookNote(r.m, null, 5.1, "2d");
  check("a failure cleared reads plain, no READY", r.n === null);
  r = md.lookNote(null, { k: "3d", state: "ready" }, 1, "3d");
  check("a ready job never seen loading shows nothing", r.n === null);
  r = md.lookNote(null, { k: "2d", state: "loading" }, 1, "2d");
  check("only PIXEL and REAL 3D carry a job", r.n === null && r.m === null);
}

// ---- lookVal: the words ----
{
  const w = (n, t) => md.lookVal(n, t)[0];
  check("files", w({ k: "px", st: "loading", done: 12, total: 26 }) === "PIXEL · 12 / 26");
  check("no count", w({ k: "px", st: "loading", total: 0 }) === "PIXEL · LOADING");
  check("slow", w({ k: "3d", st: "loading", done: 2, total: 20, slow: true }) === "REAL 3D · SLOW, STILL TRYING");
  check("art", w({ k: "px", st: "preparing", phase: "bake", done: 140, total: 255 }) === "PIXEL · ART 140 / 255");
  check("shaders", w({ k: "3d", st: "preparing", phase: "shaders", done: 18, total: 31 }) === "REAL 3D · SHADERS 18 / 31");
  check("preparing", w({ k: "3d", st: "preparing", phase: "warm", done: 0, total: 1 }) === "REAL 3D · PREPARING" && w({ k: "3d", st: "preparing" }) === "REAL 3D · PREPARING");
  check("ready", w({ k: "px", st: "ready" }) === "PIXEL · READY");
  check("failure, keyboard", w({ k: "px", st: "fail" }, false) === "PIXEL · DID NOT LOAD · ENTER RETRY");
  check("failure, touch", w({ k: "px", st: "fail" }, true) === "PIXEL · DID NOT LOAD · TAP TO RETRY");
  setHints({ dev: "pad", ok: "SOUTH", back: "EAST" });
  check("failure, controller: its confirm word", w({ k: "3d", st: "fail" }, true) === "REAL 3D · DID NOT LOAD · SOUTH RETRY");
  setHints(null);
}

// ---- every state fits the value slot at every layout ----
const NOTES = [
  { k: "3d", st: "loading", done: 19, total: 20 },
  { k: "3d", st: "loading", total: 0 },
  { k: "3d", st: "loading", done: 1, total: 20, slow: true },
  { k: "px", st: "preparing", phase: "bake", done: 255, total: 255 },
  { k: "3d", st: "preparing", phase: "shaders", done: 118, total: 131 },
  { k: "3d", st: "preparing", phase: "build", done: 5, total: 5 },
  { k: "3d", st: "preparing" },
  { k: "3d", st: "ready" },
  { k: "3d", st: "fail" },
];
const RI = optRows(false).indexOf("ART STYLE"), V = optRows(false); // ART STYLE: row 3 in the ten (CLASSIC 2D / PIXEL) and in the twelve
function slot(c, L, touch, R) {
  const g = md.settingsGeom(L, touch, R), S = g.S;
  return md.valueRoom(c, S.iw + 16, g.rowH - 2, "ART STYLE", touch);
}
const boxes = [
  ["keyboard 600x520", md.layout(600, 520), false, true],
  ["keyboard iso 608x352", md.layout(608, 352), false, true],
  ["touch landscape 600x520", md.layout(600, 520), true, true],
  ["PAUSE 2D", md.layout(overlayBox("2d").w, overlayBox("2d").h), true, true],
  ["PAUSE iso", md.layout(overlayBox("iso").w, overlayBox("iso").h), false, true],
];
for (const w of [400, 444, 480, 520, 560, 600]) boxes.push(["touch shell box " + w + "x" + Math.round(w * 2), md.layout(w, Math.round(w * 2), w * 0.6), true, false]);
for (const dev of ["key", "touch", "pad"]) for (const R of [optRows(false), optRows(true)]) {
  setHints(dev === "pad" ? { dev: "pad", ok: "SOUTH", back: "EAST" } : null);
  for (const [name0, L, touch, full] of boxes) {
    const name = name0 + " (" + R.length + " rows)", c = recCtx(), room = slot(c, L, touch, R);
    let worst = "", ok = true, fullOk = true;
    for (const n of NOTES) {
      const cands = md.lookVal(n, touch), v = md.fitVal(c, cands, room);
      c.font = md.font(12);
      if (!cands.includes(v) || md.mw(c, v) > room) { ok = false; worst = v; }
      if (v !== cands[0]) fullOk = false;
    }
    check("fits the slot, never clipped: " + name + " · " + dev, ok, worst + " in " + Math.round(room));
    if (full) check("the full words, look named: " + name + " · " + dev, fullOk);
  }
}
setHints(null);

// ---- drawSettings: the row in place, no reflow ----
{
  const L = md.layout(600, 520);
  for (const touch of [false, true]) {
    const g = md.settingsGeom(L, touch, V), y = g.y0 + RI * g.rowH + 1, h = g.rowH - 2;
    const a = recCtx(), b = recCtx();
    md.drawSettings(a, L, 1, { rows: V, row: "ART STYLE", vals: {}, px: true, touch });
    md.drawSettings(b, L, 1, { rows: V, row: "ART STYLE", vals: {}, px: true, touch, job: { k: "px", st: "preparing", phase: "bake", done: 140, total: 255, fill: 0.6 } });
    const lab = (r) => r.texts.filter((t) => t.s !== "PIXEL" && !/^PIXEL ·/.test(t.s)).map((t) => t.s + "@" + t.x + "," + t.y).join("|");
    check("no reflow: every other text lands where it did" + (touch ? " (touch)" : ""), lab(a) === lab(b));
    check("the value slot reads the job" + (touch ? " (touch)" : ""), b.texts.some((t) => t.s === "PIXEL · ART 140 / 255" && Math.abs(t.y - (y + h / 2)) < 0.01 && /monospace/.test(t.font)));
    const line = b.rects.filter((r) => r.h === 2 && Math.abs(r.y - (y + h - 2)) < 0.01);
    const tr = line.find((r) => r.col === md.LINE), fl = line.find((r) => r.col === md.ACCENT);
    check("a 2 px line along the band bottom: track + honest fill" + (touch ? " (touch)" : ""), tr && fl && Math.abs(fl.w - Math.round(tr.w * 0.6)) <= 1 && fl.x === tr.x, JSON.stringify(line));
    check("the line stays inside the band" + (touch ? " (touch)" : ""), tr && tr.y >= y && tr.y + 2 <= y + h);
  }
  const c = recCtx(), g = md.settingsGeom(L, false, V), y = g.y0 + RI * g.rowH + 1, h = g.rowH - 2;
  md.drawSettings(c, L, 1, { rows: V, row: "MUSIC", vals: {}, px: true, job: { k: "px", st: "loading", total: 0, fill: -1 } });
  const st = c.rects.filter((r) => r.h === 2 && Math.abs(r.y - (y + h - 2)) < 0.01 && r.col === md.ACCENT);
  check("no count: still stripes, many short dashes, no single fill", st.length > 20 && st.every((r) => r.w <= 4));
  const f = recCtx();
  md.drawSettings(f, L, 1, { rows: V, row: "ART STYLE", vals: {}, job: { k: "px", st: "fail", fill: -1 } });
  check("failure: the danger colour plus words, no line", f.texts.some((t) => t.s === "PIXEL · DID NOT LOAD · ENTER RETRY" && t.col === md.DANGER) && !f.rects.some((r) => r.h === 2 && Math.abs(r.y - (y + h - 2)) < 0.01));
  check("failure on the selected row: the band selects red", f.rects.some((r) => r.col === "rgba(255,93,115,0.12)"));
  const p = recCtx();
  md.drawSettings(p, md.layout(overlayBox("2d").w, overlayBox("2d").h), 1, { kicker: "PAUSED · ROOM 2", rows: optRows(true), row: "MUSIC", vals: {}, r3d: true, job: { k: "3d", st: "preparing", phase: "shaders", done: 18, total: 31 } });
  check("PAUSE's OPTIONS view draws the same row", p.texts.some((t) => t.s === "REAL 3D · SHADERS 18 / 31"));
  const z = recCtx();
  md.drawSettings(z, L, 1, { rows: V, row: "MUSIC", vals: {}, px: true });
  check("no job: the plain value and no line", z.texts.some((t) => t.s === "PIXEL") && !z.rects.some((r) => r.h === 2 && Math.abs(r.y - (y + h - 2)) < 0.01));
}

// ---- shellview: the job note through app.lookJob, and the loader spot ----
{
  let J = { k: "px", state: "loading", done: 4, total: 26 };
  const app = { pixel: true, get lookJob() { return J; } };
  check("app.lookJob read as a getter: held under 400 ms", stepLookNote(app, 100) === null);
  const n = stepLookNote(app, 100.5);
  check("... then shown", n && n.st === "loading" && n.done === 4);
  const fn = { pixel: true, lookJob: () => J };
  check("app.lookJob as a function works too", stepLookNote(fn, 100.6).st === "loading");
  J = null;
  check("null = no job: READY then plain", stepLookNote(app, 100.7).st === "ready" && stepLookNote(app, 102) === null);
}
{
  const got = [];
  const host = { __load: { spot: (o) => got.push(o), wants: () => true } };
  const cv = { width: 600, height: 520, getBoundingClientRect: () => ({ left: 100, top: 50, width: 600, height: 520 }) };
  const at = (app, world) => { loaderSpot(app, world, cv, host); return got[got.length - 1]; };
  check("OPTIONS: the row is on screen", at({ screen: SCREEN.SETTINGS }, { state: "PLAY" }).row === true);
  check("PAUSE view 1: the row is on screen", at({ screen: SCREEN.GAME, pauseView: 1 }, { state: "PAUSE" }).row === true);
  const pv2 = at({ screen: SCREEN.GAME, pauseView: 2 }, { state: "PAUSE" });
  check("PAUSE GRAPHICS / list: no row, chip allowed", pv2.row === false && pv2.off === false);
  check("live PLAY: chip off", at({ screen: SCREEN.GAME, pauseView: 0 }, { state: "PLAY" }).off === true);
  check("the INTRO show: chip off; the title is not", at({ screen: SCREEN.INTRO, introStage: 1 }, {}).off === true && at({ screen: SCREEN.INTRO, introStage: 0 }, {}).off === false);
  const m = at({ screen: SCREEN.MENU }, { state: "PLAY" });
  check("MENU: top-centre inside the drawn stage", m.row === false && m.off === false && m.x === 400 && m.y === 54 && m.w === 584);
  host.__load.wants = () => false;
  const q = at({ screen: SCREEN.MENU }, {});
  check("nothing docked: no rect read", q.x === null && q.y === null);
  check("no loader (Node, hosts): nothing", loaderSpot({ screen: SCREEN.MENU }, {}, cv, {}) === null);
  /* chip height 28 css + 4 inset, in logical px at the phone's ~0.63 board scale, stays above the MENU logo's top */
  const L = md.layout(600, 520), lg = md.menuLogo(L), logoTop = lg.cy - 81 * lg.s;
  check("the chip clears the MENU logo line on a phone board stage (0.63)", (4 + 28) / 0.63 < logoTop, (32 / 0.63).toFixed(1) + " < " + logoTop.toFixed(1));
}

console.log("\n  RENDERROW RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
