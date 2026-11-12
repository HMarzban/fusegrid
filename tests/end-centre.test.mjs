/* The run ends sit in the middle of the board (owner 2026-11-12: "why this menu is not in center of page?", a FUSE/GRID CLEAR plate low on
   the board). Since the HUD left the board (v206, Task 8.2) no look draws anything in #c's top band, so LEVEL CLEAR, the finale and GAME
   OVER centre their plate in the whole box on a desk and a landscape #c (a portrait phone's over box was already free, Task 9.8). */
const { endGeom, endFacts } = await import("../src/render/pages/endgeom.js");
const { overlayBox } = await import("../src/render/scenes.js");

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const RUN = { r: 5, k: 31, p: 9, t: 372, best: { s: 1480, r: 4 }, fromStart: true, cap: 5, medals: [], lk: 6, lp: 2, et: 9, lay: "d", css: 1.38 };
const worlds = {
  clear: { state: "WIN", level: 3, score: 900, heat: 1, pace: 0, pact: 0 },
  fin: { state: "WIN", level: 5, score: 1750, heat: 0, pace: 0, pact: 2 },
  lose: { state: "LOSE", level: 2, score: 300, heat: 0, pace: 0, pact: 0 },
};
for (const kind of ["2d", "iso"]) {
  const B = overlayBox(kind);
  for (const lay of ["d", "l"]) for (const [m, w] of Object.entries(worlds)) {
    const run = { ...RUN, lay, css: lay === "l" ? 0.62 : 1.38 }, G = endGeom(B, endFacts(w, run, { t: 69.4, best: 80 }), { lay, css: run.css });
    const p = G && G.plate, mid = p ? p.y + p.h / 2 : NaN;
    check(`${kind} ${lay} ${m}: the plate's middle is the box's (±1)`, Math.abs(mid - B.h / 2) <= 1, p && JSON.stringify({ y: p.y, h: p.h, mid, box: B.h }));
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
