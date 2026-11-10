// v202 step 2 E: PAUSE's kicker carries the look the player picked mid-run (Q1):
// "· REAL 3D NEXT" while it builds, "· REAL 3D READY" parked for the swap, "· REAL 3D · RESTORING"
// for a lost context; run context drops from the end until it fits; no tail = today's draw.
import { drawOverlay, pauseKick, pauseKicker, pauseGeom, overlayBox } from "../src/render/scenes.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
/* a recording ctx; a spaced 10 px sans glyph measures 7 px (a little over the real ~6.4, so a fit here fits there) */
function ctx() {
  const log = [];
  const c = new Proxy({ log, canvas: null, letterSpacing: "0px" }, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === "measureText") return (s) => { log.push(["measureText", s]); return { width: String(s).length * 7 }; };
      return (...a) => { log.push([k, ...a]); };
    },
    set(o, k, v) { o[k] = v; log.push(["set:" + String(k), v]); return true; },
  });
  return c;
}
const W = { level: 8, heat: 2, pace: 1, pact: 15, state: "PAUSE" };
const longest = pauseKicker(W, { daily: true });
{
  const c = ctx();
  check("no tail: the kicker is today's, with no font set and nothing measured", pauseKick(c, longest, "", 316) === longest && c.log.length === 0);
}
for (const [name, B, touch] of [["keyboard 600x520", overlayBox("2d"), false], ["touch 600x520", overlayBox("2d"), true], ["iso", overlayBox("iso"), false]]) {
  const g = pauseGeom(B, touch), c = ctx();
  c.canvas = null;
  drawOverlay(c, W, B.w, B.h, B.cx, B.cy, { view: 0, cursor: 0, touch, next: "REAL 3D NEXT" }, null, { daily: true });
  const texts = c.log.filter((e) => e[0] === "fillText").map((e) => e[1]);
  const k = texts.find((s) => /REAL 3D NEXT$/.test(s));
  check(name + ": the longest real kicker keeps the tail and fits the plate (" + g.w + " wide)", !!k && k.length * 7 <= g.w - 24, k);
  check(name + ": what stays is the kicker's own start (room, then biome ...), dropped from the end", !!k && longest.startsWith(k.replace(/ · REAL 3D NEXT$/, "")) && /^LEVEL 8/.test(k), k);
}
{
  const c = ctx();
  check("a short kicker keeps all of it", pauseKick(c, "ROOM 1 · JUNGLE · CORE · NORM", "REAL 3D READY", 316) === "ROOM 1 · JUNGLE · CORE · NORM · REAL 3D READY");
  check("letter spacing is put back after measuring", c.letterSpacing === "0px");
  check("a note (CONTROLLER LOST) outranks the run context and keeps the tail", pauseKick(ctx(), "CONTROLLER LOST", "REAL 3D · RESTORING", 316) === "CONTROLLER LOST · REAL 3D · RESTORING");
  check("no room at all: the tail alone", pauseKick(ctx(), "ROOM 1 · JUNGLE", "REAL 3D NEXT", 90) === "REAL 3D NEXT");
}
{
  const B = overlayBox("2d"), a = ctx(), b = ctx();
  drawOverlay(a, W, B.w, B.h, B.cx, B.cy, { view: 0, cursor: 0, touch: false }, null, null);
  drawOverlay(b, W, B.w, B.h, B.cx, B.cy, { view: 0, cursor: 0, touch: false, next: "" }, null, null);
  check("an empty tail draws byte-for-byte what no tail draws (hash pins hold)", JSON.stringify(a.log) === JSON.stringify(b.log) && !a.log.some((e) => e[0] === "measureText" && /NEXT|READY/.test(e[1])));
}
{
  const { loaderSpot } = await import("../src/render/shellview.js");
  const { SCREEN } = await import("../src/app/menuapp.js");
  const spots = [], host = { __load: { spot: (o) => spots.push(o), wants: () => false } };
  const app = { screen: SCREEN.GAME, pauseView: 0, lookNext: "REAL 3D NEXT" };
  loaderSpot(app, { state: "PAUSE" }, null, host);
  app.lookNext = "";
  loaderSpot(app, { state: "PAUSE" }, null, host);
  check("one indicator: on the PAUSE list the kicker carries the look, so the chip stays down; with no tail the chip may show", spots[0].row === true && spots[1].row === false);
}
console.log("\n  PAUSEKICK RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
