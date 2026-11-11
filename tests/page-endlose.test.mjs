/* UI upgrade v202 Task 5.4: GAME OVER on the world kit (src/render/pages/endlose.js through drawOverlay; endgeom.js the contract; endkit.js the
   parts). Its own mood: no ribbon, no shelf, no yellow but TRY AGAIN. Every delta from isRunEnd and the run-start best, saved to saved (score ×
   difficulty): the shortfall under a saved best, nothing on a first run scoring 0, a quiet plaque on a record (NEW BEST or FURTHEST LEVEL YET, the
   latter only from level 1), the day's own line on a DAILY; "Reached level n of m." with m the run's finale; TRY AGAIN's board line (New board · level
   1, Same board on a DAILY / code run); the course (cleared, cracked on the level fallen, ahead, locked past the cap). Page rules as WIN's: inside the
   plate inside the box at 1 and 1.25, longest strings whole (the worst shortfall included), every keycap right of its key, the focus after the
   motion, the cache (0 misses on a steady frame), the grey veil, and the probe. */
import { rec } from "./lib/textrec.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
class Cv { constructor(w, h) { this.width = w; this.height = h; this.r = rec(); } getContext() { return this.r.ctx; } }
const cache = await import("../src/render/kit/cache.js");
const lazy = await import("../src/render/pages/lazy.js");
const P = await import("../src/render/pages/endlose.js");
const { drawOverlay, overlayBox } = await import("../src/render/scenes.js");
const { endFacts, endGeom, KEYS } = await import("../src/render/pages/endgeom.js");
const { setTextScale } = await import("../src/render/kit/type.js");
const probe = await import("../src/render/kit/probe.js");

const B = overlayBox("2d"), IB = overlayBox("iso");
const lose = (o = {}) => ({ state: "LOSE", level: 4, score: 1360, heat: 0, pace: 0, pact: 0, ...o });
const RUN = { r: 3, k: 12, p: 4, t: 200, best: { s: 1480, r: 4 }, fromStart: true, cap: 5, medals: [], et: 9, lay: "d", css: 1.38 };
const draw = (world, run, toast, box = B) => { const R = rec({ widthK: 0.6 * 1.08 }); drawOverlay(R.ctx, world, box.w, box.h, box.w / 2, box.h / 2, undefined, undefined, run, toast); return R; };
const S = (R) => R.texts.map((t) => t.s);

{
  const R0 = draw(lose(), RUN);
  check("before endlose is in: a LOADING plate, no headline", S(R0).includes("LOADING") && !S(R0).includes("GAME OVER"), S(R0).join("|"));
  check("the lazy loader names endlose", lazy.NAMES.includes("endlose"));
  lazy._set("endlose", P);
  const R1 = draw(lose(), RUN);
  check("once in: GAME OVER with its parts", ["GAME OVER", "Reached level 4 of 5.", "SCORE", "1,360", "TRY AGAIN", "New board · level 1", "MENU", "COPY RESULT", "COPY MAP"].every((s) => S(R1).includes(s)), S(R1).join("|"));
}
// ---- claims ----
const tail = (w, r) => endFacts(w, r).tail;
check("under the saved best: the shortfall, saved to saved", J(tail(lose(), RUN)) === J({ kind: "short", lead: "120 points short", text: "120 points short of your NORMAL DIFFICULTY best (1,480)." }));
check("HARD: the score saved ×2 and the shortfall in saved points", endFacts(lose({ heat: 1 }), RUN).scoreLine.value === "2,720" && endFacts(lose({ heat: 1 }), RUN).scoreLine.mult === "×2 HARD DIFFICULTY" && tail(lose({ heat: 1 }), RUN).text === "240 points short of your HARD DIFFICULTY best (2,960).");
check("a bucket with other rules names them", tail(lose({ pace: 1 }), RUN).text === "120 points short of your NORMAL DIFFICULTY · FAST SPEED best (1,480).");
check("no saved best: a first run scoring 0 prints no line at all", tail(lose({ score: 0 }), { ...RUN, best: null }) === null);
check("no saved best, a score: the NEW BEST plaque, never a shortfall", tail(lose({ score: 10 }), { ...RUN, best: null }).kind === "plaque" && tail(lose({ score: 10 }), { ...RUN, best: null }).text[0] === "NEW BEST · NORMAL DIFFICULTY");
check("over the saved best: the NEW BEST plaque", tail(lose({ score: 2000 }), RUN).kind === "plaque");
check("further than the saved level from level 1: FURTHEST LEVEL YET", J(tail(lose({ level: 5, score: 100 }), RUN)) === J({ kind: "plaque", text: ["FURTHEST LEVEL YET"] }));
check("a LEVEL SELECT start (above level 1) never claims FURTHEST", tail(lose({ level: 5, score: 100 }), { ...RUN, fromStart: false }).kind === "short");
check("matched the saved best: said plainly", tail(lose({ score: 1480 }), RUN).text === "Matched your NORMAL DIFFICULTY best (1,480).");
check("DAILY: the day's own line, never the bests; TRY AGAIN says Same board", J(tail(lose({ score: 99999 }), { ...RUN, daily: "2026-11-11", tries: 3, dbest: 900, fixed: true })) === J({ kind: "daily", text: "DAILY 2026-11-11 · NORMAL SPEED · TRY 3 · YOUR BEST 900" }) && endFacts(lose(), { ...RUN, daily: "2026-11-11", fixed: true }).keys.sub === "Same board");
check("a ?code= run (fixed board): Same board; an ordinary run: New board · level 1", endFacts(lose(), { ...RUN, fixed: true }).keys.sub === "Same board" && endFacts(lose(), RUN).keys.sub === "New board · level 1");
check("ATTRACT (no run): no claim", tail(lose({ score: 99999 }), undefined) === null);
check("Reached level n of m: m the run's finale (5, or 8 on levels 6-8)", endFacts(lose({ level: 7 }), { ...RUN, cap: 8 }).reached === "Reached level 7 of 8." && endFacts(lose({ level: 2 }), { ...RUN, cap: 8 }).reached === "Reached level 2 of 5.");
check("the course: cleared, cracked on the level fallen, ahead to the cap, locked past it", J(endFacts(lose(), RUN).course.map((c) => c.st)) === J(["clear", "clear", "clear", "crack", "ahead", "locked", "locked", "locked"]) && J(endFacts(lose(), { ...RUN, cap: 8 }).course.map((c) => c.st)) === J(["clear", "clear", "clear", "crack", "ahead", "ahead", "ahead", "ahead"]));
// ---- mood: no ribbon, no shelf, one yellow ----
{
  probe.setOn(true);
  const R = draw(lose({ score: 2000 }), RUN), s = probe.snapshot();
  probe.setOn(false);
  check("no ribbon, no shelf, no medal: a record is one quiet plaque (NEW BEST · NORMAL DIFFICULTY), never a ribbon's NEW BEST", !s.rects.some((r) => /^(ribbon|shelf|medal)/.test(r.name)) && s.rects.some((r) => r.name === "plaque") && (S(R).includes("NEW BEST · NORMAL DIFFICULTY") || S(R).includes("NEW BEST")) && !S(R).includes("FURTHEST LEVEL YET"), J(s.rects.map((r) => r.name)) + J(S(R)));
  check("one yellow fill: TRY AGAIN", J(s.rects.filter((r) => r.fill === "#ffd447").map((r) => r.name)) === J(["main"]));
  check("the grey veil (R18), never WIN's", R.rects[0].fill === "rgba(" + [1, 3, 5].map((i) => parseInt(P.VEIL.col.slice(i, i + 2), 16)).join(",") + ",0.65)", R.rects[0].fill);
  check("no coral headline, no yellow text but on TRY AGAIN's caps", !R.texts.some((t) => t.s === "GAME OVER" && /ff5d73/i.test(t.fill)));
}
// ---- page rules ----
const WORST = "9,999,999 points short of your EXPERT DIFFICULTY best (9,999,999).";
/* the boxes (lane lesson 2): desk windows 1366x768 (css 1.38), 1366x657 (1.171), 1280x720 (1.292), a desk #c at css 1, touch landscape and portrait,
   the iso guard; every page of a paged run end is drawn and judged */
const BOXES = [["desk 1366x768", B, "d", 1.38], ["desk 1366x657", B, "d", 1.171], ["desk 1280x720", B, "d", 1.292], ["desk at css 1", B, "d", 1], ["touch landscape", B, "l", 0.9], ["touch portrait", B, "p", 0.635], ["iso guard", IB, "d", 1]];
const CAPF = { d: { primary: 14, secondary: 11, hud: 18 }, p: { primary: 11, secondary: 9, hud: 11 } }, BODYF = { d: 17.9, p: 14.1 };
for (const ts of [1, 1.25]) for (const [name, box, lay, css] of BOXES) for (const [tag0, world, run] of [["short", lose({ heat: 2, score: 0 }), { ...RUN, best: { s: 3333333, r: 4 } }], ["plaque", lose({ score: 2000 }), RUN]]) {
  setTextScale(ts);
  const tag = tag0 + " " + name + " ts " + ts, r0 = { ...run, lay, css }, G0 = endGeom(box, endFacts(world, r0), { lay, css, m: rec({ widthK: 0.6 * 1.08 }).ctx }), all = [];
  for (let page = 0; page < G0.pages; page++) {
    probe.setOn(true);
    const R = draw(world, { ...r0, page }, null, box), snap = probe.snapshot();
    probe.setOn(false);
    all.push(...S(R));
    const pt = tag + (G0.pages > 1 ? " page " + (page + 1) + "/" + G0.pages : ""), plate = snap.rects.find((x) => x.name === "plate"), T = plate.plate;
    const outside = snap.texts.filter((t) => t.x < plate.x - 0.5 || t.y < plate.y - 0.5 || t.x + t.w > plate.x + plate.w + 0.5 || t.y + t.capH > plate.y + plate.h + 0.5).map((t) => t.s);
    const ringIn = plate.x - T >= -0.5 && plate.y - T >= -0.5 && plate.x + plate.w + T <= box.w + 0.5 && plate.y + plate.h + T <= box.h + 0.5;
    const keysL = snap.rects.filter((x) => KEYS.includes(x.name)), caps = snap.rects.filter((x) => / cap$/.test(x.name));
    const dv = lay === "d" ? "d" : "p", under = snap.texts.filter((t) => (t.role === "body" ? t.px * css < BODYF[dv] - 0.05 : t.capH * css < CAPF[dv][t.role] - 0.05)).map((t) => t.s + " " + (t.role === "body" ? t.px * css : t.capH * css).toFixed(1));
    check(pt + ": every text inside the plate, the ring inside the box", outside.length === 0 && ringIn, J(outside));
    check(pt + ": every keycap right of its key's middle; the focus on TRY AGAIN; one yellow (TRY AGAIN)", caps.every((cp) => { const k = keysL.find((x) => x.name + " cap" === cp.name); return k && cp.x > k.x + k.w / 2; }) && snap.rects.some((x) => x.name === "focus") && J(snap.rects.filter((x) => x.fill === "#ffd447").map((x) => x.name)) === J(["main"]));
    if (name !== "iso guard") check(pt + ": no text under its floor in CSS px (the page pages, never scales under)", under.length === 0 && !G0.scaled, J(under));
    if (lay !== "d") {
      const small = snap.rects.filter((x) => x.touch).filter((x) => Math.min(x.w, x.h) * css < 43.95).map((x) => x.name + " " + (Math.min(x.w, x.h) * css).toFixed(1));
      check(pt + ": every touch target >= 44 CSS px", small.length === 0, J(small));
    }
  }
  const prose = all.join(" ").replace(/\s+/g, " ");
  if (tag0 === "short") check(tag + ": the worst shortfall drawn whole across its lines and pages, no ellipsis", prose.includes(WORST) && !prose.includes("…"), prose);
  else check(tag + ": the plaque's words whole", all.includes("NEW BEST · NORMAL DIFFICULTY") || all.includes("NEW BEST"), J(all));
}
setTextScale(1);
// ---- motion, focus, reduced ----
{
  const ring = (R) => R.paints.filter((p) => p.op === "stroke" && p.style === "#fff2df" && p.lw === 3).length;
  check("TRY AGAIN takes focus at 1.4 s, not before", ring(draw(lose(), { ...RUN, et: 1.0 })) === 0 && ring(draw(lose(), { ...RUN, et: 1.5 })) === 1);
  check("REDUCE FLASH: the end state at once", ring(draw(lose(), { ...RUN, et: 0, reduced: true })) === 1);
}
// ---- the cache ----
{
  globalThis.OffscreenCanvas = Cv;
  cache.setFactory((w, h) => new Cv(w, h));
  const m0 = cache._dbg.misses; draw(lose(), RUN); const m1 = cache._dbg.misses, b = draw(lose(), RUN), c2 = draw(lose(), RUN), m2 = cache._dbg.misses;
  const mtL = b.calls.filter((x) => x.op === "measureText").length;
  check("rest: one layer, then a steady frame with 0 misses, <= 400 calls and <= 20 measureText; two idle frames differ only in the smoke's clock", m1 - m0 === 1 && m2 === m1 && b.calls.length <= 400 && mtL <= 20 && J(b.calls) === J(c2.calls), (m1 - m0) + " / " + (m2 - m1) + " / " + b.calls.length + " / " + mtL + " measureText");
  delete globalThis.OffscreenCanvas;
}
// ---- the probe ----
{
  probe.setOn(true);
  draw(lose(), RUN);
  const s = probe.snapshot();
  probe.setOn(false);
  check("probe: page lose on #c, no fault, its squint pairs", s.page === "lose" && s.box.el === "c" && !s.fault && ["chosen", "locked", "band", "ring"].every((k) => s.pairs.some((p) => p.kind === k)), J(s.pairs.map((p) => p.kind + " " + (p.name || ""))));
}

/* appendix 10.6 beats that draw (fix round 1): the cord burns down to the stub over 0.3-0.8 s, the crack strokes in over 0.8-1.0 s with one dust
   puff of 6 particles #c9793f; reduced motion: the end state (stub, crack, no dust) */
{
  check("cordK: the whole cord until 0.3 s, the stub from 0.8 s and at rest", P.cordK(0) === 1 && P.cordK(0.3) === 1 && Math.abs(P.cordK(0.8) - P.CORD_K) < 1e-9 && P.cordK(null) === P.CORD_K && P.cordK(0.55) < 1 && P.cordK(0.55) > P.CORD_K);
  check("crackK: none before 0.8 s, half at 0.9, whole from 1.0 and at rest", P.crackK(0.7) === 0 && Math.abs(P.crackK(0.9) - 0.5) < 1e-9 && P.crackK(1) === 1 && P.crackK(null) === 1);
  const dust = (R) => R.paints.filter((q) => q.op === "fill" && /201,\s*121,\s*63/.test(String(q.style))).length, cord = (R) => R.paints.some((q) => q.op === "stroke" && /^#b8582a$/i.test(String(q.style)));
  const w = lose({ level: 3 }), r = { ...RUN, r: 2 };
  const at5 = draw(w, { ...r, et: 0.5 }), at9 = draw(w, { ...r, et: 0.9 }), rest = draw(w, { ...r, et: 9 }), red = draw(w, { ...r, et: 0.9, reduced: true });
  check("0.5 s: the cord still burns (the live cord colour); at rest only the stub", cord(at5) && !cord(rest));
  check("0.9 s: one dust puff of 6 particles in #c9793f; at rest and under reduced motion none", dust(at9) === 6 && dust(rest) === 0 && dust(red) === 0, dust(at9) + "/" + dust(rest) + "/" + dust(red));
}
/* the locked pair's floor sample (the texture gate's plain floor): mapped to the box like its pair, inside a reached-not cell, clear of its number,
   at least 4 x 4 CSS px (desk, phone, and a death on level 1 and on the finale) */
for (const [lay, css, w] of [["d", 1.38, lose({ level: 1 })], ["d", 1.38, lose({ level: 4 })], ["p", 2.4, lose({ level: 1 })], ["p", 2.4, lose({ level: 5 })]]) {
  probe.setOn(true);
  draw(w, { ...RUN, r: w.level - 1, lay, css });
  const s = probe.snapshot(); probe.setOn(false);
  const lk = s.pairs.find((q) => q.kind === "locked"), f = lk && lk.floor, cells = s.rects.filter((r) => /^cell \d$/.test(r.name)), nums = s.texts.filter((t) => /^\d$/.test(t.s));
  const host = f && cells.find((r) => f.x >= r.x && f.y >= r.y && f.x + f.w <= r.x + r.w && f.y + f.h <= r.y + r.h);
  const hit = f && nums.some((t) => t.x < f.x + f.w && t.x + t.w > f.x && t.y < f.y + f.h && t.y + t.capH > f.y);
  check("the locked floor sample sits inside one cell, clear of the numbers, >= 4x4 CSS px (" + lay + " L" + w.level + ")", !!host && !hit && f.w * css >= 4 && f.h * css >= 4, J([f, host, hit]));
}
console.log(fail ? "PAGE ENDLOSE FAIL " + fail + "/" + (pass + fail) : "PAGE ENDLOSE OK " + pass);
process.exit(fail ? 1 : 0);
