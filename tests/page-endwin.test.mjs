/* UI upgrade v202 Task 5.3: WIN on the world kit (src/render/pages/endwin.js through drawOverlay; endgeom.js the draw / tap contract; endkit.js the
   parts). Claims (a delta that cannot lie): every record piece comes from isRunEnd and the run-start best, never on a first zero-score run, a DAILY,
   ATTRACT (no run) or a mid-run WIN's score; a LEVEL SELECT start still records its score but never a FURTHEST form. Page rules: one yellow fill (the
   main key), the ring and bare bomb on the main key once the motion ends, every key's label left of its keycap, the longest strings whole at text
   scale 1 and 1.25, every text inside the plate inside the box (desktop, touch landscape, touch portrait, the iso guard), touch targets >= 44 CSS px
   on the touch boxes the page holds unscaled, the copy note kept (COPIED / COPY FAILED), the lazy LOADING plate, the cache (a steady frame and two
   idle frames: 0 misses, equal call logs), and the probe record the gates read. */
import { rec } from "./lib/textrec.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
const made = [];
class Cv { constructor(w, h) { this.width = w; this.height = h; this.r = rec(); made.push(this); } getContext() { return this.r.ctx; } }
const cache = await import("../src/render/kit/cache.js");
const lazy = await import("../src/render/pages/lazy.js");
const W = await import("../src/render/pages/endwin.js");
const { drawOverlay, overlayBox } = await import("../src/render/scenes.js");
const { endFacts, endGeom, endPlan, KEYS } = await import("../src/render/pages/endgeom.js");
const { setTextScale } = await import("../src/render/kit/type.js");
const probe = await import("../src/render/kit/probe.js");
const { setHints } = await import("../src/render/hintcopy.js");

const B = overlayBox("2d"), IB = overlayBox("iso");
const fin = (o = {}) => ({ state: "WIN", level: 5, score: 4820, heat: 0, pace: 0, pact: 0, ...o });
const mid = (o = {}) => ({ state: "WIN", level: 3, score: 900, heat: 1, pace: 0, pact: 0, ...o });
const RUN = { r: 5, k: 31, p: 9, t: 372, best: { s: 1480, r: 4 }, fromStart: true, cap: 5, medals: [], lk: 6, lp: 2, et: 9, lay: "d", css: 1.38 };
const draw = (world, run, tm, toast, box = B) => { const R = rec({ widthK: 0.6 * 1.08 }); drawOverlay(R.ctx, world, box.w, box.h, box.w / 2, box.h / 2, undefined, tm, run, toast); return R; };
const S = (R) => R.texts.map((t) => t.s);

// ---- LOADING until the lazy page lands; then the page ----
{
  const R0 = draw(mid(), RUN);
  check("before endwin is in: a LOADING plate, no headline", S(R0).includes("LOADING") && !S(R0).includes("LEVEL 3 CLEAR"), S(R0).join("|"));
  check("the lazy loader names endwin", lazy.NAMES.includes("endwin"));
  lazy._set("endwin", W);
  const R1 = draw(mid(), RUN);
  check("once in: the level clear (kicker, raised headline, three stat cards, NEXT LEVEL)", ["LEVEL 3 · FACTORY", "LEVEL 3 CLEAR", "TIME", "ENEMIES", "POWER-UPS", "NEXT LEVEL"].every((s) => S(R1).includes(s)), S(R1).join("|"));
  check("level clear: no score digits, no course", !S(R1).includes("SCORE · ×2 HARD DIFFICULTY") && !S(R1).includes("1"), S(R1).join("|"));
}
// ---- claims ----
const claims = (world, run, tm) => { const F = endFacts(world, run, tm); return F.pieces.map((p) => (p.kind === "rib" ? [].concat(p.name)[0] : p.kind === "medal" ? "MEDAL " + p.name : "MORE " + p.n)); };
check("finale over the run-start best: a score ribbon (bucket named), saved score × difficulty", J(claims(fin({ heat: 1, score: 2000 }), { ...RUN, best: { s: 1500, r: 5 } })) === J(["SCORE · HARD DIFFICULTY"]) && endFacts(fin({ heat: 1, score: 2000 }), RUN).score.digits === "4,000" && endFacts(fin({ heat: 1 }), RUN).score.sub === "SCORE · ×2 HARD DIFFICULTY");
check("finale under the run-start best: no score ribbon", J(claims(fin({ score: 1000 }), RUN)) === "[]");
check("finale, a first run (no best) scoring 0: no ribbon at all", J(claims(fin({ score: 0 }), { ...RUN, best: null })) === "[]");
check("finale, a first run scoring > 0: NEW BEST score", J(claims(fin({ score: 10 }), { ...RUN, best: null })) === J(["SCORE · NORMAL DIFFICULTY"]));
check("finale, a LEVEL SELECT start (fromStart false): its score still records, never a FURTHEST form", J(claims(fin({ score: 2000 }), { ...RUN, fromStart: false })) === J(["SCORE · NORMAL DIFFICULTY"]) && !J(endFacts(fin(), { ...RUN, fromStart: false })).includes("FURTHEST"));
check("finale, a DAILY: no score ribbon against the bests; the day's own line instead", J(claims(fin({ score: 99999 }), { ...RUN, daily: "2026-11-11", tries: 2, dbest: 5000 })) === "[]" && /^DAILY 2026-11-11 · NORMAL SPEED · TRY 2 · YOUR BEST 5000$/.test(endFacts(fin(), { ...RUN, daily: "2026-11-11", tries: 2, dbest: 5000 }).note));
check("ATTRACT (no run): no claim on a finale or a level clear", J(claims(fin({ score: 99999 }), undefined, { t: 1, best: 9 })) === "[]" && J(claims(mid(), undefined, undefined)) === "[]");
check("a mid-run WIN claims no score, only the level time the times store kept (faster than the best before the write, or the first)", J(claims(mid({ score: 99999 }), RUN, { t: 30, best: 40 })) === J(["LEVEL 3 TIME"]) && J(claims(mid(), RUN, { t: 50, best: 40 })) === "[]" && J(claims(mid(), RUN, { t: 50, best: null })) === J(["LEVEL 3 TIME"]));
check("medals: only the newly saved ones, as handed in; more than three pieces fold into +N MORE", J(claims(fin({ score: 2000 }), { ...RUN, medals: [["FLAWLESS", "x"], ["SPRINT", "y"], ["OVERDRIVE", "z"]] }, { t: 1, best: 2 })) === J(["SCORE · NORMAL DIFFICULTY", "LEVEL 5 TIME", "MORE 3"]) && J(claims(fin({ score: 1 }), { ...RUN, medals: [["FLAWLESS", "x"]] })) === J(["MEDAL FLAWLESS"]));
check("the course: the run's levels won (with the finale's medal), 6-8 locked while the cap is 5", J(endFacts(fin(), RUN).course.map((c) => c.st)) === J(["won", "won", "won", "won", "won", "locked", "locked", "locked"]) && J(endFacts(fin({ level: 8 }), { ...RUN, r: 3, cap: 8 }).course.map((c) => c.st)) === J(["clear", "clear", "clear", "clear", "clear", "won", "won", "won"]));
// ---- the finale that first opens 6-8 says so (lead ruling: main saves the unlock at the run end, run.opened) ----
{
  const OPEN = "LEVELS 6 TO 8 NOW OPEN";
  check("run.opened on a finale: the line, under the course; never on a later finale, a level clear, ATTRACT or GAME OVER",
    endFacts(fin(), { ...RUN, cap: 8, opened: true }).opened === OPEN && !endFacts(fin(), { ...RUN, cap: 8 }).opened && !endFacts(mid(), { ...RUN, opened: true }).opened &&
      !endFacts(fin(), undefined).opened && !endFacts({ ...fin(), state: "LOSE" }, { ...RUN, opened: true }).opened);
  check("the opened course: 6-8 open (ahead), none locked", J(endFacts(fin(), { ...RUN, cap: 8, opened: true }).course.map((c) => c.st)) === J(["won", "won", "won", "won", "won", "ahead", "ahead", "ahead"]));
  for (const [lay, css, box] of [["d", 1.38, B], ["p", 2.4, B], ["d", 1, IB]]) {
    const run = { ...RUN, cap: 8, opened: true, lay, css };
    const courseOf = (F) => { const G = endGeom(box, F, { lay, css }); for (let page = 0; page < G.pages; page++) { const g = endGeom(box, F, { lay, css, page }); if (g.rects.course) return [g.rects.course.h, G.pages]; } return [0, G.pages]; };
    const c0 = courseOf(endFacts(fin(), { ...RUN, cap: 8, lay, css })), c1 = courseOf(endFacts(fin(), run)), G1 = endGeom(box, endFacts(fin(), run), { lay, css });
    check("the line's room: the course row grows by it (" + lay + " " + box.w + "x" + box.h + ")", c1[0] > c0[0], J([c0, c1]));
    let seen = false;
    for (let pg = 0; pg < G1.pages; pg++) { const T = S(draw(fin(), { ...run, page: pg }, null, null, box)); if (T.includes(OPEN)) seen = true; }
    check("the line is drawn on one of the pages (" + lay + " " + box.w + "x" + box.h + ")", seen);
  }
  check("a later finale (already open) draws no line", !S(draw(fin(), { ...RUN, cap: 8 })).includes(OPEN));
  /* intended (the mock): on the finale that opens them, 6-8 show as plain wells in the same frame as the line; the locked pair records whenever a
     locked level is drawn (a finale whose run is still capped at 5: no run end yet, or a run handed in without the unlock) and never otherwise */
  const lockedOf = (run) => { probe.setOn(true); draw(fin(), run); const sn = probe.snapshot(); probe.setOn(false); return { pair: sn.pairs.find((q) => q.kind === "locked"), texts: sn.texts.map((t) => t.s) }; };
  const capped = lockedOf({ ...RUN, cap: 5 }), opening = lockedOf({ ...RUN, cap: 8, opened: true }), later = lockedOf({ ...RUN, cap: 8 });
  check("a finale still capped at 5 records the locked pair, its floor sample mapped into the box", !!capped.pair && !!capped.pair.floor && capped.pair.floor.x >= 0 && capped.pair.floor.x + capped.pair.floor.w <= B.w && !capped.texts.includes(OPEN), J(capped.pair));
  check("the opening finale: the line and no locked level in the same frame; a later finale: neither", opening.texts.includes(OPEN) && !opening.pair && !later.pair && !later.texts.includes(OPEN), J([!!opening.pair, !!later.pair]));
}
// ---- the finale plate is the mock's 840 where the box holds it; a medal's rule reads in sentence case (appendix 10.3) ----
{
  const G = endGeom(B, endFacts(fin(), RUN), { lay: "d", css: 1.6 }), G0 = endGeom(B, endFacts(fin(), RUN), { lay: "d", css: 1.38 });
  check("finale plate: 840 design px wide on a box that holds it, narrower only where the box is", Math.abs(G.plate.w * 1.6 - 840) < 0.5, G.plate.w * 1.6);
  check("finale plate on the 1366 x 768 frame (css 1.38): the box's width, under 840", G0.plate.w * 1.38 < 840 && G0.plate.w <= B.w, G0.plate.w * 1.38);
  const md = endFacts(fin({ score: 2000 }), { ...RUN, medals: [["FLAWLESS", "LEVELS 1-5 IN ONE RUN · NO LIFE LOST"], ["IRON CROWN", "LEVELS 6-8 IN ONE RUN ON EXPERT DIFFICULTY"]] }).pieces.filter((q) => q.kind === "medal").map((q) => q.desc);
  check("a medal's rule in sentence case, a setting's name kept in caps", J(md) === J(["Levels 1 to 5 in one run, no life lost.", "Levels 6 to 8 in one run on EXPERT DIFFICULTY."]), J(md));
}
// ---- the toast ----
for (const [s, ok] of [["COPIED", true], ["COPY FAILED", false], ["BOARD LINK COPIED", true]]) {
  const R = draw(fin(), RUN, null, { s, ok, t: 1 });
  check("the copy note shows " + s, S(R).includes(s), S(R).join("|"));
}
check("no toast, no note", !S(draw(fin(), RUN)).some((s) => /COPIED|COPY FAILED/.test(s)));
// ---- page rules across boxes and text scales ----
const LONG = ["FUSE/GRID CLEAR", "1,234,567", "LEVEL 5 · ARENA · NORMAL DIFFICULTY"];
/* the boxes (lane lesson 2): desk windows 1366x768 (stage css 1.38), 1366x657 (1.171), 1280x720 (1.292), 1024x768 (1.38, the same stage), a desk
   #c at css 1, touch landscape and portrait, the iso guard; every page of a paged run end is drawn and judged */
const BOXES = [["desk 1366x768", B, "d", 1.38], ["desk 1366x657", B, "d", 1.171], ["desk 1280x720", B, "d", 1.292], ["desk at css 1", B, "d", 1], ["touch landscape", B, "l", 0.9], ["touch portrait", B, "p", 0.635], ["iso guard", IB, "d", 1]];
const CAPF = { d: { primary: 14, secondary: 11, hud: 18 }, p: { primary: 11, secondary: 9, hud: 11 } }, BODYF = { d: 17.9, p: 14.1 };
for (const ts of [1, 1.25]) for (const [name, box, lay, css] of BOXES) for (const [mode, world, run] of [["clear", mid(), RUN], ["fin", fin({ score: 1234567 }), { ...RUN, best: null, medals: [["FLAWLESS", "LEVELS 1-5 IN ONE RUN · NO LIFE LOST"]] }]]) {
  setTextScale(ts);
  const tag = mode + " " + name + " ts " + ts, G0 = endGeom(box, endFacts(world, { ...run, lay, css }, { t: 30, best: 40 }), { lay, css, m: rec({ widthK: 0.6 * 1.08 }).ctx });
  const all = [];
  for (let page = 0; page < G0.pages; page++) {
    probe.setOn(true);
    const r = { ...run, lay, css, page }, R = draw(world, r, { t: 30, best: 40 }, null, box), snap = probe.snapshot();
    probe.setOn(false);
    all.push(...S(R));
    const pt = tag + (G0.pages > 1 ? " page " + (page + 1) + "/" + G0.pages : ""), plate = snap.rects.find((x) => x.name === "plate"), T = plate.plate;
    const yel = snap.rects.filter((x) => x.fill === "#ffd447");
    const inside = snap.texts.filter((t) => t.x < plate.x - 0.5 || t.y < plate.y - 0.5 || t.x + t.w > plate.x + plate.w + 0.5 || t.y + t.capH > plate.y + plate.h + 0.5).map((t) => t.s);
    const ringIn = plate.x - T >= -0.5 && plate.y - T >= -0.5 && plate.x + plate.w + T <= box.w + 0.5 && plate.y + plate.h + T <= box.h + 0.5;
    const keysL = snap.rects.filter((x) => KEYS.includes(x.name)), caps = snap.rects.filter((x) => / cap$/.test(x.name));
    const capRight = caps.every((cp) => { const k = keysL.find((x) => x.name + " cap" === cp.name); return k && cp.x > k.x + k.w / 2; });
    const dv = lay === "d" ? "d" : "p", under = snap.texts.filter((t) => (t.role === "body" ? t.px * css < BODYF[dv] - 0.05 : t.capH * css < CAPF[dv][t.role] - 0.05)).map((t) => t.s + " " + (t.role === "body" ? t.px * css : t.capH * css).toFixed(1));
    check(pt + ": one yellow fill (the main key)", yel.length === 1 && yel[0].name === "main", J(yel.map((x) => x.name)));
    check(pt + ": every text inside the plate, the plate's ring inside the box", inside.length === 0 && ringIn, J(inside) + " " + J(plate));
    check(pt + ": the focus (the main key) with band and ring pairs; every keycap right of its key's middle", snap.rects.some((x) => x.name === "focus" && x.focus) && snap.pairs.some((p) => p.kind === "band") && snap.pairs.some((p) => p.kind === "ring") && capRight, J(snap.pairs.map((p) => p.kind)));
    if (name !== "iso guard") check(pt + ": no text under its floor in CSS px (the page pages, never scales under)", under.length === 0 && !G0.scaled, J(under));
    if (lay !== "d") {
      const small = snap.rects.filter((x) => x.touch).filter((x) => Math.min(x.w, x.h) * css < 43.95).map((x) => x.name + " " + (Math.min(x.w, x.h) * css).toFixed(1));
      check(pt + ": every touch target >= 44 CSS px", small.length === 0, J(small));
    }
  }
  // a narrow column steps the kicker down by the words.js rules (pauseKickers: what differs from a default run, never cut), so there it is "LEVEL 5 · ARENA"
  const longs = (mode === "fin" ? LONG : ["LEVEL 3 CLEAR", "NEXT LEVEL"]).filter((s) => !all.includes(s) && !(s === "1,234,567" && all.includes("1")) && !(s.startsWith("LEVEL 5 · ARENA") && all.includes("LEVEL 5 · ARENA")));
  check(tag + ": the longest strings drawn whole across its pages, no ellipsis", longs.length === 0 && !all.some((s) => s.includes("…")), J(longs));
}
setTextScale(1);
// ---- focus waits for the motion; reduced motion fades in ----
{
  const cs = (R) => R.paints.filter((p) => p.op === "stroke" && p.style === "#fff2df" && p.lw === 3).length;
  check("the ring is not up during the motion (et 0.8), it is from 1.5 s", cs(draw(fin(), { ...RUN, et: 0.8 })) === 0 && cs(draw(fin(), { ...RUN, et: 1.6 })) === 1);
  check("REDUCE FLASH: the end state at once (the ring at et 0)", cs(draw(fin(), { ...RUN, et: 0, reduced: true })) === 1);
}
// ---- the keycaps follow the device; a touch layout shows none ----
{
  setHints({ dev: "pad", ok: "SOUTH", back: "EAST", tab: "SHOULDERS", pause: "START", bomb: "SOUTH", throw: "WEST", remote: "EAST", move: "D-PAD", moveAlt: "L-STICK", moveCaps: null, tapPage: false });
  const R = draw(fin(), RUN);
  check("a controller's caps: MENU … SOUTH, COPY RESULT … WEST, COPY MAP … NORTH", ["SOUTH", "WEST", "NORTH"].every((s) => S(R).includes(s)) && !S(R).includes("ENTER"), S(R).join("|"));
  setHints(null);
  const T = draw(fin(), { ...RUN, lay: "p", css: 0.635 });
  check("touch: no keycaps", !["ENTER", "C", "B"].some((s) => S(T).includes(s)), S(T).join("|"));
}
// ---- the cache: one layer at rest, a steady frame and an idle pair make no miss ----
{
  globalThis.OffscreenCanvas = Cv;
  cache.setFactory((w, h) => new Cv(w, h));
  const m0 = cache._dbg.misses, a = draw(fin(), RUN), m1 = cache._dbg.misses, b = draw(fin(), RUN), c2 = draw(fin(), RUN), m2 = cache._dbg.misses;
  check("the first frame at rest makes its layer (one miss)", m1 - m0 === 1, m1 - m0);
  const mtW = b.calls.filter((x) => x.op === "measureText").length;
  check("a steady frame: 0 misses, <= 400 canvas calls, <= 20 measureText, a blit", m2 === m1 && b.calls.length <= 400 && mtW <= 20 && b.calls.some((x) => x.op === "drawImage"), m2 - m1 + " misses, " + b.calls.length + " calls, " + mtW + " measureText");
  check("two idle frames: equal call logs", J(b.calls) === J(c2.calls));
  /* the real loop: ONE context frame after frame: the facts and geometry are kept per run end (endPlan), so a steady frame measures (almost) nothing */
  const Rs = rec({ widthK: 0.6 * 1.08 }), one = () => drawOverlay(Rs.ctx, fin(), B.w, B.h, B.w / 2, B.h / 2, undefined, null, { ...RUN, et: 9 }, null);
  one(); const n0 = Rs.calls.length, mm0 = cache._dbg.misses; one(); const fr = Rs.calls.slice(n0), mt = fr.filter((x) => x.op === "measureText").length;
  check("a steady frame on the loop's one context: 0 misses, <= 400 calls, <= 20 measureText", cache._dbg.misses === mm0 && fr.length <= 400 && mt <= 20, fr.length + " calls, " + mt + " measureText");
  const pa = endPlan(B, fin(), { ...RUN, et: 1 }, null, { lay: RUN.lay, css: RUN.css, m: Rs.ctx }), pb = endPlan(B, fin(), { ...RUN, et: 2.5 }, null, { lay: RUN.lay, css: RUN.css, m: Rs.ctx });
  const pc = endPlan(B, fin({ score: 7 }), { ...RUN, et: 2.5 }, null, { lay: RUN.lay, css: RUN.css, m: Rs.ctx }), pd = endPlan(B, fin(), { ...RUN, et: 2.5 }, null, { lay: RUN.lay, css: RUN.css, m: rec().ctx });
  check("endPlan: kept across the motion clock; a new score or another measuring context makes a new plan", pa === pb && pc !== pa && pd !== pa && pc.F.score.digits === "7");
  const d = draw(fin({ score: 5000 }), RUN), m3 = cache._dbg.misses;
  check("a page showing something else is another layer (one miss)", m3 - m2 === 1);
  void a; void d;
  delete globalThis.OffscreenCanvas;
}
// ---- the probe ----
{
  probe.setOn(true);
  draw(fin(), RUN);
  const s = probe.snapshot();
  probe.setOn(false);
  check("probe: page win on #c, the box, no fault", s.page === "win" && s.box.el === "c" && s.box.w === 600 && !s.fault, J(s.box));
  check("probe: chosen (won vs locked), locked and info pairs on the finale", ["chosen", "locked", "info", "band", "ring"].every((k) => s.pairs.some((p) => p.kind === k)), J(s.pairs.map((p) => p.kind)));
}

console.log(fail ? "PAGE ENDWIN FAIL " + fail + "/" + (pass + fail) : "PAGE ENDWIN OK " + pass);
process.exit(fail ? 1 : 0);
