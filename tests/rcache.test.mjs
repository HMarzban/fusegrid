import { mountRenderers, REL_T } from "../src/app/rcache.js";
import { readFileSync } from "node:fs";
import "../src/core/board3.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

function mkDoc() {
  const parent = {
    kids: [],
    insertBefore(n, ref) { n.parentNode = parent; const i = ref ? parent.kids.indexOf(ref) : -1; parent.kids.splice(i < 0 ? parent.kids.length : i, 0, n); },
  };
  let seq = 0;
  const mkEl = (id) => {
    const e = {
      id, n: ++seq, hidden: false, parentNode: parent,
      cloneNode() { const c = mkEl(e.id); c.hidden = e.hidden; c.parentNode = null; return c; },
      removeAttribute(k) { if (k === "id") e.id = ""; },
      remove() { parent.kids.splice(parent.kids.indexOf(e), 1); e.parentNode = null; },
      replaceWith(n) { if (n.parentNode) n.remove(); const i = parent.kids.indexOf(e); parent.kids[i] = n; n.parentNode = parent; e.parentNode = null; },
      on: {},
      addEventListener(t, f) { (e.on[t] ||= []).push(f); },
      removeEventListener(t, f) { e.on[t] = (e.on[t] || []).filter((g) => g !== f); },
      fire(t) { for (const f of e.on[t] || []) f({ type: t }); },
    };
    return e;
  };
  parent.kids.push(mkEl("gl"), mkEl("px"));
  return { parent, getElementById: (id) => parent.kids.find((k) => k.id === id) || null };
}

function harness(o = {}) {
  const doc = mkDoc();
  const log = { swaps: [], kinds: [], ready: 0, loads: 0, pxLoads: 0, fails: [], ons: [], boots: [], built: [], jobs: [] };
  let k = o.kind || "2d";
  const mk = (tag) => (a, b, c) => {
    const opts = tag === "2d" ? b : c;
    const r = { tag, el: tag === "2d" ? null : a, opts, perfs: [], disposed: 0, invalidated: 0, slept: 0, liveAA: tag === "3d" ? (opts.perf ? opts.perf.aa : true) : undefined,
      render() {}, consumeEvents() {}, setPerf(K) { r.perfs.push(K); }, invalidate(re) { r.invalidated++; r.re = re; }, dispose() { r.disposed++; if (tag === "3d" && a && a.fire) a.fire("webglcontextlost"); /* forceContextLoss fires it */ }, sleep() { r.slept++; } };
    if (o.prep && tag !== "2d") {
      r.activated = 0; r.steps = 0;
      r.activate = () => { r.activated++; if (o.seq) o.seq.push("activate:" + tag); };
      /* a fake prepare: report, step until released, then resolve (or reject) */
      r.prepare = (job) => new Promise((res, rej) => {
        r.job = job; r.release = res; r.reject = rej;
        job.report(tag === "px" ? "bake" : "build", 1, 2);
        (async () => { try { while (!r.stop) { await job.step(); r.steps++; if (o.prepStepMs) o.clock.t += o.prepStepMs; await new Promise((z) => setTimeout(z, 0)); } } catch (e) { rej(e); } })();
      });
    }
    if (o.fail3d && tag === "3d" && o.fail3d()) r.liveAA = null;
    log.built.push(r);
    if (o.seq) o.seq.push("build:" + tag);
    return r;
  };
  let resolve3d, reject3d, resolvePx, rejectPx;
  const env = {
    canvas: { width: 0, height: 0 }, rig: {}, opts: { audio: o.audio || null, createRenderer3D: o.pre3d ? mk("3d") : null, createPixelRenderer: o.lazyPx ? null : mk("px") },
    make: { "2d": o.throw2d ? () => { throw new Error("boom"); } : mk("2d") },
    size: () => ({ w: 600, h: 520 }), kind: () => k, perf: () => o.K || null,
    onSwap: (r, kk) => { log.swaps.push(r); log.kinds.push(kk); }, onReady: () => log.ready++, onJob: (j) => log.jobs.push(j),
    jobs: !!o.jobs, world: o.world ? () => o.world : undefined, idle: o.idle || undefined, hold: o.hold || undefined, poke: () => { log.pokes = (log.pokes || 0) + 1; }, now: o.clock ? () => o.clock.t : undefined, budgetMs: o.budgetMs,
    loadRenderer3D: () => { log.loads++; if (o.seq) o.seq.push("import:3d"); return new Promise((res, rej) => { resolve3d = () => res({ createRenderer3D: mk("3d") }); reject3d = () => rej(new Error("404")); }); },
    loadRendererPx: () => { log.pxLoads++; if (o.seq) o.seq.push("import:px"); return new Promise((res, rej) => { resolvePx = () => res({ createPixelRenderer: mk("px") }); rejectPx = () => rej(new Error("404")); }); },
    onFail: (k, on, boot) => { log.fails.push(k); log.ons.push(on); log.boots.push(boot); },
    fit: () => null, eager: !!o.eager, eagerPx: !!o.eagerPx, bar: o.bar || null,
    prefetch: o.prefetch, root: o.root, onLost: () => { log.lost = (log.lost || 0) + 1; },
  };
  const g0 = globalThis.document;
  globalThis.document = doc;
  const rc = mountRenderers(env);
  return { rc, doc, log, env, setKind: (v) => { k = v; }, resolve3d: () => resolve3d(), reject3d: () => reject3d(), resolvePx: () => resolvePx(), rejectPx: () => rejectPx(), done: () => { if (g0 === undefined) delete globalThis.document; else globalThis.document = g0; } };
}
const tickP = () => new Promise((r) => setTimeout(r, 0));
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await tickP(); };
const warn0 = console.warn;
console.warn = (...a) => { if (process.env.RCW) console.error(...a); };

{
  const h = harness({ kind: "3d" });
  const r = h.rc.get("3d");
  check("lazy 3D: get(3d) before three loads returns the classic renderer and starts ONE load", r.tag === "2d" && h.log.loads === 1 && !h.rc.has3d(), r.tag + "/" + h.log.loads);
  h.rc.get("3d");
  check("a second get(3d) while loading starts no second load", h.log.loads === 1);
  h.resolve3d();
  await flush();
  check("load resolve swaps in the 3D renderer when the kind is still 3d", h.log.swaps.length === 1 && h.log.swaps[0].tag === "3d" && h.rc.has3d());
  check("load settle calls onReady once", h.log.ready === 1);
  check("the 3D factory gets #gl and the rig", h.log.swaps[0].el === h.doc.getElementById("gl") && h.log.swaps[0].opts.rig === h.env.rig);
  h.done();
}
{
  const h = harness({ kind: "3d" });
  h.rc.get("3d");
  h.reject3d();
  await flush();
  check("a failed three load still settles onReady (title never stranded)", h.log.ready === 1 && h.log.swaps.length === 0);
  h.done();
}
{
  const h = harness({ eager: true, kind: "3d" });
  check("eager (?render=3d) starts the load at mount", h.log.loads === 1);
  h.rc.get("3d"); // main's boot get(curKind): the job joins the eager fetch
  check("the boot get joins the eager fetch (no second import)", h.log.loads === 1);
  h.resolve3d();
  await flush();
  check("eager resolve swaps the 3D renderer in and settles", h.log.swaps.length === 1 && h.log.swaps[0].tag === "3d" && h.log.ready === 1);
  h.done();
}
{
  const h = harness({ eager: true, kind: "3d" });
  h.setKind("px");
  h.resolve3d();
  await flush();
  check("eager resolve after RENDER left 3D swaps nothing in (main would draw REAL 3D under PIXEL) but still settles and arms 3D", h.log.swaps.length === 0 && h.log.ready === 1 && h.rc.has3d(), h.log.swaps.map((r) => r.tag).join());
  h.done();
}
{
  const h = harness({ kind: "px", lazyPx: true });
  const r = h.rc.get("px");
  check("lazy PIXEL: get(px) before the tree loads returns the classic renderer and starts ONE load", r.tag === "2d" && h.log.pxLoads === 1 && !h.rc.hasPx() && h.log.loads === 0, r.tag + "/" + h.log.pxLoads);
  h.rc.get("px");
  check("a second get(px) while loading starts no second load", h.log.pxLoads === 1);
  check("#px is shown while it loads (the classic board keeps drawing under it)", h.doc.getElementById("px").hidden === false);
  h.resolvePx();
  await flush();
  check("load resolve swaps the PIXEL renderer in when the kind is still px", h.log.swaps.length === 1 && h.log.swaps[0].tag === "px" && h.rc.hasPx() && h.rc.get("px") === h.log.swaps[0]);
  check("the PIXEL factory gets #px", h.log.swaps[0].el === h.doc.getElementById("px"));
  check("load settle calls onReady once and never onFail", h.log.ready === 1 && h.log.fails.length === 0);
  h.done();
}
{
  const K = { aa: false, epoch: 1 };
  const h = harness({ kind: "px", lazyPx: true, K });
  h.rc.setKnobs(K);
  h.rc.get("px");
  h.resolvePx();
  await flush();
  check("a lazily built PIXEL renderer is armed with the current K", h.log.swaps[0].perfs.length === 1 && h.log.swaps[0].perfs[0] === K && h.log.swaps[0].opts.perf === K);
  h.done();
}
{
  const h = harness({ kind: "px", lazyPx: true, eagerPx: true });
  check("eagerPx (?render=px) starts the load at mount, once even after get(px)", h.log.pxLoads === 1 && (h.rc.get("px"), h.log.pxLoads === 1));
  h.resolvePx();
  await flush();
  check("eagerPx resolve swaps PIXEL in and settles", h.log.swaps.length === 1 && h.log.swaps[0].tag === "px" && h.log.ready === 1);
  h.done();
}
{
  const h = harness({ kind: "px", lazyPx: true });
  h.rc.get("px");
  h.setKind("2d");
  h.resolvePx();
  await flush();
  check("PIXEL resolve after RENDER left px swaps nothing in but arms px for the next flip", h.log.swaps.length === 0 && h.rc.hasPx());
  h.done();
}
{
  const h = harness({ kind: "px", lazyPx: true });
  h.rc.get("px");
  h.setKind("3d");
  h.resolvePx();
  await flush();
  check("a PIXEL settle while REAL 3D is still loading does not lift the board veil early", h.log.ready === 0);
  h.done();
}
{
  const h = harness({ kind: "px", lazyPx: true });
  const r2 = h.rc.get("px");
  h.rejectPx();
  await flush();
  check("a failed PIXEL load warns, calls onFail(px, 2d) once at boot, settles, and keeps the classic renderer", h.log.fails.join() === "px" && h.log.ons.join() === "2d" && h.log.ready === 1 && h.log.swaps.length === 0 && !h.rc.hasPx() && h.log.pxLoads === 1);
  check("lookJob reads failed (the RENDER row's state), with the try count", h.log.jobs[h.log.jobs.length - 1].state === "failed" && h.log.jobs[h.log.jobs.length - 1].fails === 1);
  check("a fresh pick of PIXEL after a failure retries the import (the RENDER row's retry)", h.rc.get("px") === r2 && h.log.pxLoads === 2);
  h.done();
}
{
  const h = harness({ throw2d: true });
  const r = h.rc.get("2d");
  check("a throwing factory falls back to the inert stub", typeof r.render === "function" && typeof r.consumeEvents === "function" && typeof r.ctx.save === "function");
  check("liveAA is null without a 3D renderer", h.rc.liveAA() === null);
  h.done();
}
{
  const K = { aa: false, dpr3d: 1.5, shadow: "sharp", epoch: 3 };
  const h = harness({ K, pre3d: true });
  const r2 = h.rc.get("2d"), r3 = h.rc.get("3d");
  check("construction receives perf() as opts.perf (every factory)", r2.opts.perf === K && r3.opts.perf === K);
  check("no setPerf before the first setKnobs (Node stays unarmed)", r2.perfs.length === 0 && r3.perfs.length === 0);
  check("#gl / #px hidden follow the kind", h.doc.getElementById("gl").hidden === false && h.doc.getElementById("px").hidden === true);
  h.rc.setKnobs(K);
  check("setKnobs forwards to every cached renderer", r2.perfs[0] === K && r3.perfs[0] === K);
  const rp = h.rc.get("px");
  check("a renderer built after setKnobs is armed with the current K", rp.perfs.length === 1 && rp.perfs[0] === K);
  check("liveAA reads the cached 3D renderer", h.rc.liveAA() === false);
  h.rc.invalidate();
  check("invalidate reaches every cached renderer and keeps the PAUSE latch", r2.invalidated === 1 && r3.invalidated === 1 && rp.invalidated === 1 && r3.re === undefined);
  check("a cache hit (RENDER swap back) returns the same renderer, forces its next raster and re-latches PAUSE", h.rc.get("3d") === r3 && r3.invalidated === 2 && r3.re === true && r2.invalidated === 1);
  h.done();
}
{
  const h = harness({ pre3d: true });
  const r3 = h.rc.get("3d"), rp = h.rc.get("px");
  h.rc.get("2d");
  const gl0 = h.doc.getElementById("gl");
  h.rc.tick(1000, "2d");
  h.rc.tick(1000 + REL_T - 1, "2d");
  check("REL_T is 10 s; nothing released before it", REL_T === 10000 && r3.disposed === 0 && rp.slept === 0);
  h.rc.tick(1000 + REL_T, "2d");
  check("an unused 3D renderer is disposed at 10 s and #gl is replaced by a fresh clone", r3.disposed === 1 && h.doc.getElementById("gl") !== gl0 && h.doc.getElementById("gl").id === "gl");
  check("an unused PIXEL renderer sleeps", rp.slept === 1);
  h.rc.tick(1000 + 3 * REL_T, "2d");
  check("sleep is not repeated while it stays unused; the slept renderer stays cached", rp.slept === 1 && h.rc.get("px") === rp);
  const r3b = h.rc.get("3d");
  check("the next get(3d) pays a fresh build", r3b !== r3 && r3b.tag === "3d");
  h.rc.get("px");
  h.rc.tick(1000 + 3 * REL_T + 16, "2d");
  check("a get() re-arms its kind's idle clock: one stale-kind tick right after waking PIXEL never re-sleeps it", rp.slept === 1, rp.slept);
  h.done();
}
{
  let failNext = true;
  const h = harness({ pre3d: true, kind: "3d", fail3d: () => failNext });
  failNext = false;
  const r3 = h.rc.get("3d");
  const gl0 = h.doc.getElementById("gl"), kids0 = h.doc.parent.kids.length;
  failNext = true;
  const ok = h.rc.rebuild3d({ aa: false });
  check("a failed rebuild3d returns false, keeps the old renderer and #gl, removes the fresh canvas",
    ok === false && h.rc.get("3d") === r3 && r3.disposed === 0 && h.doc.getElementById("gl") === gl0 && h.doc.parent.kids.length === kids0);
  failNext = false;
  h.rc.setKnobs({ aa: false });
  const ok2 = h.rc.rebuild3d({ aa: false });
  const r3b = h.rc.get("3d");
  check("rebuild3d builds first, then swaps: old disposed, onSwap(new), #gl id moved",
    ok2 === true && r3b !== r3 && r3.disposed === 1 && h.log.swaps[h.log.swaps.length - 1] === r3b && h.doc.getElementById("gl") === r3b.el && gl0.parentNode === null);
  check("the rebuilt context carries the new AA", h.rc.liveAA() === false && r3b.opts.perf.aa === false);
  r3b.dead = true;
  h.rc.tick(5, "3d");
  const r3c = h.rc.get("3d");
  check("a dead context is rebuilt on the next tick and swapped in", r3b.disposed === 1 && r3c !== r3b && h.log.swaps[h.log.swaps.length - 1] === r3c);
  h.rc.drop3d();
  check("drop3d disposes the cached 3D renderer", r3c.disposed === 1 && h.rc.liveAA() === null);
  h.done();
}
// v202 G2: the music pre-roll runs before each synchronous step of a lazy look
{
  const seq = [];
  const audio = { preroll() { seq.push("pre"); } };
  const bar = { lookPlan: () => null, paintYield: () => Promise.resolve(), afterFirstRender: (r, done) => { seq.push("first"); done(); } };
  const L0 = globalThis.__load;
  globalThis.__load = { begin() {}, phase() {}, end() { seq.push("end"); }, focus() {}, fail() {} };
  for (const k of ["3d", "px"]) {
    seq.length = 0;
    const h = harness({ kind: k, lazyPx: true, audio, bar, seq });
    h.rc.get(k);
    await tickP();
    if (k === "3d") h.resolve3d(); else h.resolvePx();
    for (let i = 0; i < 6; i++) await tickP();
    const at = (s) => seq.indexOf(s);
    check("pre-roll before the " + k + " import continuation", at("import:" + k) > 0 && seq[at("import:" + k) - 1] === "pre", seq.join(","));
    check("pre-roll right before the " + k + " build (PIXEL bake / 3D first build)", at("build:" + k) > 0 && seq[at("build:" + k) - 1] === "pre", seq.join(","));
    check("pre-roll before the " + k + " first frame of the new build", at("first") > at("build:" + k) && seq[at("first") - 1] === "pre", seq.join(","));
    h.done();
  }
  seq.length = 0;
  const h = harness({ kind: "3d", pre3d: true, audio, seq });
  delete globalThis.__load;
  h.rc.get("3d");
  h.rc.setKnobs({ aa: false });
  h.rc.rebuild3d({ aa: false });
  check("no loader: the synchronous 3D build and rebuild3d still pre-roll first", seq.join(",") === "pre,build:3d,pre,build:3d", seq.join(","));
  h.rc.get("2d");
  check("CLASSIC 2D builds never pre-roll", seq.slice(-1)[0] === "build:2d" && seq.filter((x) => x === "pre").length === 2, seq.join(","));
  h.done();
  if (L0 === undefined) delete globalThis.__load; else globalThis.__load = L0;
}
// ---- v202 swap on ready (fake renderers with prepare / activate, env.jobs) ----
const tagged = (h, t) => h.log.built.filter((r) => r.tag === t);
const lastJob = (h) => h.log.jobs[h.log.jobs.length - 1];
const showPx = async (h) => { h.rc.get("px"); await flush(); const rp = tagged(h, "px")[0]; rp.stop = true; rp.release(); await flush(); return rp; };
{
  const W = { level: 3 };
  const h = harness({ kind: "2d", prep: true, jobs: true, world: W });
  const r2 = h.rc.get("2d");
  h.setKind("px");
  const a = h.rc.get("px");
  check("swap on ready: get(px) before ready returns the renderer ON SCREEN (here CLASSIC), never a new one", a === r2);
  check("the look on screen keeps its canvases (#px stays hidden under CLASSIC)", h.doc.getElementById("px").hidden === true);
  await flush();
  const rp = tagged(h, "px")[0];
  check("the PIXEL renderer is built and prepare(job) gets {world, step(), report()} (the world on screen)", !!rp && !!rp.job && typeof rp.job.step === "function" && typeof rp.job.report === "function" && rp.job.world === W);
  check("lookJob = preparing, with the renderer's phase, counts and a band fill", lastJob(h).k === "px" && lastJob(h).state === "preparing" && lastJob(h).phase === "bake" && lastJob(h).done === 1 && lastJob(h).total === 2 && lastJob(h).fill > 0 && lastJob(h).fill < 1, JSON.stringify(lastJob(h)));
  check("no swap and no activate before prepare resolves; get still returns the old look", h.log.swaps.length === 0 && rp.activated === 0 && h.rc.get("px") === r2 && rp.steps > 0);
  rp.stop = true; rp.release();
  await flush();
  check("prepare resolved: onSwap(px renderer, 'px'), activate once, #px shown", h.log.swaps[0] === rp && h.log.kinds[0] === "px" && rp.activated === 1 && h.doc.getElementById("px").hidden === false && h.rc.shownKind() === "px");
  check("lookJob = ready and on screen after the swap; the swap poked the frame gate", lastJob(h).state === "ready" && lastJob(h).on === true && h.log.pokes >= 1);
  h.setKind("2d"); h.rc.get("2d"); h.setKind("px");
  check("a swap back to a cached look returns it at once and activates it again (idempotent)", h.rc.get("px") === rp && rp.activated === 2);
  h.done();
}
{
  const h = harness({ kind: "px", prep: true, jobs: true, pre3d: true });
  const rp = await showPx(h);
  const n2 = tagged(h, "2d").length, gl0 = h.doc.getElementById("gl");
  h.setKind("3d");
  check("PIXEL → REAL 3D: get(3d) returns PIXEL (the look on screen), no CLASSIC in between", h.rc.get("3d") === rp && h.doc.getElementById("px").hidden === false);
  await flush();
  const r3 = tagged(h, "3d")[0];
  check("REAL 3D builds on a hidden clone of #gl (no id), while PIXEL keeps drawing", !!r3 && r3.el !== gl0 && r3.el.hidden === true && r3.el.id === "" && h.rc.get("3d") === rp);
  r3.stop = true; r3.release();
  await flush();
  check("at the swap the clone becomes #gl, #px hides, onSwap(3d), and CLASSIC was never built in between", h.doc.getElementById("gl") === r3.el && r3.el.hidden === false && h.doc.getElementById("px").hidden === true && h.log.kinds.join() === "px,3d" && tagged(h, "2d").length === n2 && r3.activated === 1);
  h.done();
}
{
  const h = harness({ kind: "px", prep: true, jobs: true, pre3d: true });
  const rp = await showPx(h);
  const kids0 = h.doc.parent.kids.length;
  h.setKind("3d"); h.rc.get("3d");
  await flush();
  const r3 = tagged(h, "3d")[0];
  h.setKind("2d");
  const r2 = h.rc.get("2d");
  let rej = null;
  await r3.job.step().catch((e) => { rej = e; });
  await flush();
  check("a second RENDER change mid-job cancels it: the half-built 3D is disposed and its clone removed", r3.disposed === 1 && h.doc.parent.kids.length === kids0 && h.log.swaps.every((r) => r !== r3));
  check("the cancelled job's next step rejects with {cancelled:true}", !!rej && rej.cancelled === true);
  check("the cancel publishes lookJob = null and CLASSIC (a sync look) is on screen at once", h.log.jobs.includes(null) && r2.tag === "2d" && h.rc.shownKind() === "2d");
  h.setKind("3d"); h.rc.get("3d");
  await flush();
  const r3b = tagged(h, "3d")[1];
  h.setKind("px");
  check("3D → back to PIXEL mid-job: the cached PIXEL returns, the 3D job is dropped", h.rc.get("px") === rp && r3b.disposed === 1);
  h.done();
}
{
  let idleV = true;
  const clock = { t: 0 };
  const h = harness({ kind: "2d", prep: true, jobs: true, idle: () => idleV, budgetMs: 0, clock });
  h.rc.get("2d"); h.setKind("px"); h.rc.get("px");
  await flush();
  const rp = tagged(h, "px")[0];
  idleV = false;
  await flush(4);
  const s1 = rp.steps;
  await flush();
  check("GAME + PLAY / the INTRO show (idle false): no step resolves", rp.steps === s1 && rp.job.parked, s1 + "/" + rp.steps);
  idleV = true;
  h.rc.tick(1, "2d");
  await flush();
  check("the next idle state resumes the steps", rp.steps > s1);
  idleV = false;
  rp.stop = true; rp.release();
  await flush();
  check("a job that finishes in live PLAY parks its swap (lookJob ready, nothing swapped)", h.log.swaps.length === 0 && h.rc.job() && h.rc.job().state === "ready");
  idleV = true;
  h.rc.tick(2, "2d");
  await flush();
  check("the next idle state swaps it in", h.log.swaps.length === 1 && h.log.swaps[0] === rp);
  h.done();
}
{
  const h = harness({ kind: "3d", pre3d: true, prep: true, jobs: true });
  h.rc.get("3d");
  await flush();
  const r3 = tagged(h, "3d")[0];
  r3.stop = true; r3.release();
  await flush();
  const gl0 = h.doc.getElementById("gl");
  let failed = 0;
  const ok = h.rc.rebuild3d({ aa: false, shadow: 1 }, () => failed++);
  await flush();
  const r3b = tagged(h, "3d")[1];
  check("AA rebuild3d goes through the job: true, a hidden clone built with the new K, the old context keeps drawing", ok === true && !!r3b && r3b.opts.perf.aa === false && r3b.el !== gl0 && r3b.el.hidden === true && h.rc.get("3d") === r3 && r3.disposed === 0 && h.rc.liveAA() === true);
  check("a second rebuild for the same knobs joins the running job", h.rc.rebuild3d({ aa: false, shadow: 1 }) === true && tagged(h, "3d").length === 2);
  r3b.stop = true; r3b.release();
  await flush();
  check("at the swap #gl is the new canvas, onSwap(new) and only then the old context is disposed", h.doc.getElementById("gl") === r3b.el && h.log.swaps[h.log.swaps.length - 1] === r3b && r3.disposed === 1 && gl0.parentNode === null && h.rc.liveAA() === false && failed === 0);
  check("liveShadow reads the tier the live context was built with", h.rc.liveShadow() === 1);
  h.rc.setKnobs({ aa: false, shadow: 2 });
  check("a SHADOWS change is never a live repin on a built 3D context (frameloop rebuilds it through the job)", r3b.perfs[r3b.perfs.length - 1].shadow === 1 && h.rc.liveShadow() === 1);
  h.done();
}
{
  let failNext = false;
  const h = harness({ kind: "3d", pre3d: true, prep: true, jobs: true, fail3d: () => failNext });
  h.rc.get("3d");
  await flush();
  const r3 = tagged(h, "3d")[0];
  r3.stop = true; r3.release();
  await flush();
  const gl0 = h.doc.getElementById("gl"), kids0 = h.doc.parent.kids.length;
  failNext = true;
  let failed = 0;
  h.rc.rebuild3d({ aa: false }, () => failed++);
  await flush();
  check("a failed AA rebuild job keeps the old renderer and #gl, removes the clone and calls the revert hook (not onFail)", failed === 1 && h.rc.get("3d") === r3 && r3.disposed === 0 && h.doc.getElementById("gl") === gl0 && h.doc.parent.kids.length === kids0 && h.log.fails.length === 0);
  check("a failed rebuild clears lookJob (the RENDER row never sticks at PREPARING)", h.log.jobs[h.log.jobs.length - 1] === null);
  h.done();
}
{
  const misses = [];
  const L0 = globalThis.__load;
  globalThis.__load = { begin() {}, phase() {}, end() {}, focus() {}, fail() { misses.push("CARD"); }, miss(k, kept) { misses.push(k + ">" + kept); } };
  const bar = { lookPlan: () => ({}), paintYield: () => Promise.resolve(), afterFirstRender: (r, done) => done() };
  const h = harness({ kind: "px", prep: true, pre3d: true, bar });
  const rp = await showPx(h);
  const kids0 = h.doc.parent.kids.length;
  h.setKind("3d"); h.rc.get("3d");
  await flush();
  const r3 = tagged(h, "3d")[0];
  r3.reject(new Error("link"));
  await flush();
  check("a failed look keeps the look on screen: onFail(3d, px), PIXEL still shown and visible, nothing swapped", h.log.fails.join() === "3d" && h.log.ons.join() === "px" && h.rc.shownKind() === "px" && h.doc.getElementById("px").hidden === false && h.log.kinds.join() === "px" && rp.disposed === 0);
  check("the half-built 3D is disposed, its clone removed; lookJob = failed", r3.disposed === 1 && h.doc.parent.kids.length === kids0 && lastJob(h).state === "failed" && lastJob(h).k === "3d");
  check("a look failure is __load.miss(k, look kept), never the centred card (boot only)", misses.join() === "3d>PIXEL", misses.join());
  check("a look picked with another on screen is not a boot failure (main reverts the pick as built)", h.log.boots.join() === "false");
  h.done();
  if (L0 === undefined) delete globalThis.__load; else globalThis.__load = L0;
}
// review 3: a saved look that fails at BOOT (nothing on screen yet) keeps the saved setting
{
  const misses = [];
  const L0 = globalThis.__load;
  globalThis.__load = { begin() {}, phase() {}, end() {}, focus() {}, fail() { misses.push("CARD"); }, miss(k, kept) { misses.push(k + ">" + kept); } };
  const bar = { lookPlan: () => ({}), paintYield: () => Promise.resolve(), afterFirstRender: (r, done) => done() };
  const h = harness({ kind: "px", prep: true, bar });
  const r0 = h.rc.get("px");
  await flush();
  check("boot: a saved PIXEL is not on screen yet (the classic stand-in, shownKind null)", r0.tag === "2d" && h.rc.shownKind() === null);
  tagged(h, "px")[0].reject(new Error("offline"));
  await flush();
  check("a failure at boot: onFail(px, 2d, boot=true), so main shows CLASSIC for this session and keeps nb.settings.v1", h.log.fails.join() === "px" && h.log.ons.join() === "2d" && h.log.boots.join() === "true");
  check("the chip says it (miss, CLASSIC 2D kept), never the card; the title is released (onReady)", misses.join() === "px>CLASSIC 2D" && h.log.ready === 1 && lastJob(h).state === "failed");
  h.setKind("2d");
  check("the next frame's get(2d) puts CLASSIC on screen and keeps the failed note for the RENDER row", h.rc.get("2d").tag === "2d" && h.rc.shownKind() === "2d" && lastJob(h).state === "failed");
  h.done();
  if (L0 === undefined) delete globalThis.__load; else globalThis.__load = L0;
}
{
  const h = harness({ kind: "3d", pre3d: true, prep: true, jobs: true });
  h.rc.get("3d");
  await flush();
  const r3 = tagged(h, "3d")[0];
  r3.stop = true; r3.release();
  await flush();
  h.setKind("px"); h.rc.get("px");
  await flush();
  const rp = tagged(h, "px")[0];
  h.rc.rebuildAgain();
  check("an AA / SHADOWS rebuild while another look's job is pending never cancels it", h.rc.rebuild3d({ aa: false }) === true && tagged(h, "3d").length === 1 && h.rc.job() && h.rc.job().k === "px");
  check("review 5: it is queued, not dropped: rebuildAgain() asks frameloop to call again after that job, once per ask", h.rc.rebuildAgain() === true && h.rc.rebuildAgain() === false);
  rp.stop = true; rp.release();
  await flush();
  check("the PIXEL job still swaps in", h.log.swaps[h.log.swaps.length - 1] === rp && h.rc.shownKind() === "px");
  h.setKind("2d"); h.rc.get("2d");
  check("a real change of look clears the finished note (lookJob null)", h.log.jobs[h.log.jobs.length - 1] === null);
  h.done();
}
{
  let held = true;
  const h = harness({ pre3d: true, hold: () => held });
  const r3 = h.rc.get("3d"), rp = h.rc.get("px");
  h.rc.get("2d");
  h.rc.tick(0, "2d");
  h.rc.tick(30000, "2d");
  check("the release clock does not run while held (OPTIONS / GRAPHICS / CONTROLS / PAUSE views)", r3.disposed === 0 && rp.slept === 0);
  held = false;
  h.rc.tick(30000 + REL_T - 1, "2d");
  check("leaving the page resumes the clock where it stopped (no instant release)", r3.disposed === 0 && rp.slept === 0);
  h.rc.tick(30000 + REL_T, "2d");
  check("then the 10 s release runs as before", r3.disposed === 1 && rp.slept === 1);
  h.done();
}
{
  const msrc = readFileSync(new URL("../src/main.js", import.meta.url), "utf8"), asrc = readFileSync(new URL("../src/app/menuapp.js", import.meta.url), "utf8");
  check("main: one idle predicate (a held run start, or not GAME + PLAY and not the INTRO show) feeds both the frame gate and rcache", /const idleNow = \(\) => hold\.on \|\| \(!\(app\.screen === SCREEN\.GAME && world\.state === "PLAY"\) && !\(app\.screen === SCREEN\.INTRO && app\.introStage === 1\)\);/.test(msrc) && /mountFrames\(loop, \{[^}]*idle: idleNow/.test(msrc) && /mountRenderers\(\{[^\n]*idle: idleNow/.test(msrc));
  check("main: onSwap sets the look on screen (curKind) and arms the dt reset; failure goes to app.lookFailed (no _optRender(0))", /onSwap: \(r, k\) => \{ renderer = r; curKind = k; swapped = true; \}/.test(msrc) && /onFail: \(k, on, boot\) => app\.lookFailed\(k, on, boot\)/.test(msrc) && !/_optRender\(0\)/.test(msrc));
  check("main: a swap, a run start or a room start (a new world.grid) drops the long frame from the next dt", /if \(swapped \|\| world\.grid !== gPrev\) \{ swapped = false; gPrev = world\.grid; last = null; \}/.test(msrc));
  check("menuapp: lookJob exposed, lookHold covers OPTIONS / GRAPHICS / CONTROLS / PAUSE views", /lookJob: null/.test(asrc) && /lookHold\(\) \{/.test(asrc));
  const { createGame } = await import("../src/main.js");
  const { SCREEN } = await import("../src/app/menuapp.js");
  const g = createGame(null, { seed: 24 });
  g.app.skip();
  let t = 1000;
  g.loop(t); g.loop((t += 16));
  g.app.startRun();
  g.loop((t += 16));
  const wt = g.world.time;
  g.loop((t += 3000));
  check("dt reset (behaviour): the frame after a run start runs no sim, even after a 3 s stall", g.world.time === wt, wt + " -> " + g.world.time);
  g.loop((t += 16));
  check("the frame after that steps normally", g.world.time > wt);
  g.app._optRender(1);
  g.app.lookFailed("px", "2d");
  check("app.lookFailed reverts the pick to the look on screen", g.app.pixel === false && g.app.render3d === false);
  g.app._optRender(2);
  g.app.lookFailed("px", "2d");
  check("app.lookFailed leaves a pick that has moved on alone", g.app.render3d === true);
  g.app.lookJob = { k: "3d", state: "preparing" };
  check("app.lookNext: REAL 3D NEXT while it builds", g.app.lookNext === "REAL 3D NEXT");
  g.app.lookJob = { k: "3d", state: "ready" };
  check("app.lookNext: REAL 3D READY while its swap is parked; empty once on screen", g.app.lookNext === "REAL 3D READY" && ((g.app.lookJob = { k: "3d", state: "ready", on: true }), g.app.lookNext === ""));
  const held = (s, pv, ws) => { g.app.screen = s; g.app.pauseView = pv; g.app.worldState = ws; return g.app.lookHold(); };
  check("app.lookHold: OPTIONS, GRAPHICS, CONTROLS, PAUSE views 1-3 hold; MENU, PAUSE list and PLAY do not", held(SCREEN.SETTINGS, 0, null) && held(SCREEN.GRAPHICS, 0, null) && held(SCREEN.CONTROLS, 0, null) && held(SCREEN.GAME, 2, "PAUSE") && !held(SCREEN.MENU, 0, null) && !held(SCREEN.GAME, 0, "PAUSE") && !held(SCREEN.GAME, 1, "PLAY"));
}
// v202 step 2 E: fetch first, evaluate when idle
{
  let idleV = true, got = null, done = null;
  const seq = [];
  const bar = { lookPlan: (k) => ({ label: k, files: 2, total: 2, urls: ["src/render/pixel/a.js", "src/render/pixel/b.js"], weigh: () => 1 }), paintYield: () => Promise.resolve(), afterFirstRender: (r, f) => f() };
  const L0 = globalThis.__load, begins = [];
  globalThis.__load = { begin(k, p, ready) { begins.push([k, p, ready]); }, phase(k) { seq.push("phase:" + k); }, end() {}, focus() {}, fail() {}, miss() {}, progress() {} };
  const h = harness({ kind: "2d", lazyPx: true, prep: true, bar, seq, idle: () => idleV, root: "http://x/g/", prefetch: (urls) => { got = urls; seq.push("fetch"); return new Promise((r) => { done = r; }); } });
  h.rc.get("2d");
  h.setKind("px"); h.rc.get("px");
  await flush();
  check("fetch first: the look's files go to a plain fetch, root-relative to the game, before any import", JSON.stringify(got) === JSON.stringify(["http://x/g/src/render/pixel/a.js", "http://x/g/src/render/pixel/b.js"]) && h.log.pxLoads === 0, seq.join());
  check("the loader plan carries the files' band (jobs.js BANDS) so the later phases still move the bar", begins[0] && begins[0][0] === "px" && begins[0][1].fb > 0 && begins[0][1].fb < 1);
  idleV = false;
  done(2);
  await flush();
  check("files in: the loader hears phase() at once (no false SLOW CONNECTION while parked)", seq.includes("phase:px") && h.log.pxLoads === 0, seq.join());
  check("in live PLAY the import (module evaluation) waits", h.log.pxLoads === 0);
  h.rc.tick(1, "2d");
  await flush();
  check("still waiting while not idle, ticks or no ticks", h.log.pxLoads === 0);
  idleV = true;
  h.rc.tick(2, "2d");
  await flush();
  check("the next idle tick runs the import, in its own task", h.log.pxLoads === 1 && seq.indexOf("import:px") > seq.indexOf("fetch"), seq.join());
  globalThis.__load = L0;
  h.done();
}
{
  const bar = { lookPlan: () => ({ label: "PIXEL", files: 1, total: 1, urls: ["src/render/pixel/a.js"], weigh: () => 1 }), paintYield: () => Promise.resolve(), afterFirstRender: (r, f) => f() };
  let called = 0;
  const h = harness({ kind: "2d", lazyPx: true, prep: true, jobs: true, bar, idle: () => false, prefetch: () => { called++; throw new Error("no page"); } });
  h.rc.get("2d");
  h.setKind("px"); h.rc.get("px");
  await flush();
  check("no page loader (Node, createGame, the key matrix): no prefetch and no idle wait, the import is called as before", called === 0 && h.log.pxLoads === 1);
  h.done();
}
{
  let idleV = true;
  const h = harness({ kind: "3d", pre3d: true, prep: true, jobs: true, idle: () => idleV });
  h.rc.get("3d");
  await flush();
  const r3 = tagged(h, "3d")[0];
  r3.stop = true; r3.release();
  await flush();
  r3.el.fire("webglcontextlost");
  h.rc.tick(1, "3d");
  check("lost on an idle screen: nothing to pause yet", !h.log.lost && lastJob(h).restore === true);
  h.setKind("px"); h.rc.get("px");
  idleV = false;
  h.rc.tick(2, "px");
  check("a pick that moved on mid-restore, then live PLAY: the lost board is still on screen, so it pauses", h.log.lost === 1 && h.rc.get("px") === r3 && r3.disposed === 0);
  h.done();
}
// v202 step 2 E: warm on intent
{
  let idleV = true;
  const h = harness({ kind: "2d", lazyPx: true, prep: true, jobs: true, idle: () => idleV });
  h.rc.get("2d");
  const j0 = h.log.jobs.length;
  idleV = false;
  h.rc.warm("px");
  check("warm never runs in live PLAY", h.log.pxLoads === 0);
  idleV = true;
  h.rc.warm("px");
  h.resolvePx();
  await flush();
  const rp = tagged(h, "px")[0];
  check("warm PIXEL: fetched, built on its own canvas and prepared, with no swap", !!rp && !!rp.job && h.log.swaps.length === 0 && rp.activated === 0);
  rp.stop = true; rp.release();
  await flush();
  check("a prepared warm PIXEL is parked, never shown, never disposed, and the warm job said nothing (no lookJob)", h.log.swaps.length === 0 && rp.disposed === 0 && h.rc.shownKind() === "2d" && h.log.jobs.length === j0);
  h.setKind("px");
  check("the pick is then a cache hit: PIXEL on screen at once, activated", h.rc.get("px") === rp && rp.activated === 1 && h.rc.shownKind() === "px");
  h.rc.warm("3d");
  await flush();
  check("warm REAL 3D: fetch and evaluate only, never built", h.log.loads === 1 && tagged(h, "3d").length === 0);
  h.done();
}
{
  const h = harness({ kind: "2d", lazyPx: true, prep: true, jobs: true });
  h.rc.get("2d");
  h.rc.warm("px");
  h.resolvePx();
  await flush();
  const rp = tagged(h, "px")[0];
  check("before the pick: the warm job is quiet", !h.log.jobs.some((j) => j && j.k === "px"));
  h.setKind("px");
  check("a pick joins the warm job: no second build, the look on screen stays", h.rc.get("px").tag === "2d" && tagged(h, "px").length === 1);
  check("and it becomes the player's job: lookJob published", lastJob(h) && lastJob(h).k === "px" && lastJob(h).state === "preparing");
  rp.stop = true; rp.release();
  await flush();
  check("then it swaps in like any job", h.log.swaps[h.log.swaps.length - 1] === rp && h.rc.shownKind() === "px");
  h.done();
}
{
  const h = harness({ kind: "2d", lazyPx: true, prep: true });
  h.rc.get("2d");
  h.rc.warm("px");
  check("warm is a no-op without a loader or jobs (Node key matrix on OPTIONS imports nothing)", h.log.pxLoads === 0);
  h.done();
}
{
  const h = harness({ kind: "3d", pre3d: true, prep: true, jobs: true });
  h.rc.get("3d");
  await flush();
  const r3 = tagged(h, "3d")[0];
  r3.stop = true; r3.release();
  await flush();
  h.rc.warm("px");
  await flush();
  check("an AA rebuild cancels a warm PIXEL job (never the reverse)", h.rc.rebuild3d({ aa: false }) === true && tagged(h, "px")[0].disposed === 1 && h.rc.job() && h.rc.job().k === "3d");
  h.done();
}
// v202 step 2 E: a lost WebGL context keeps the look, pauses PLAY, rebuilds through the job
{
  let idleV = true;
  const h = harness({ kind: "3d", pre3d: true, prep: true, jobs: true, idle: () => idleV });
  h.rc.get("3d");
  await flush();
  const r3 = tagged(h, "3d")[0];
  r3.stop = true; r3.release();
  await flush();
  const n2 = tagged(h, "2d").length;
  idleV = false;
  r3.el.fire("webglcontextlost");
  h.rc.tick(1, "3d");
  check("lost in live PLAY: onLost (main pauses first), the RESTORING note is published", h.log.lost === 1 && lastJob(h).restore === true && lastJob(h).on === false);
  idleV = true;
  h.rc.tick(2, "3d");
  check("paused: no more onLost", h.log.lost === 1);
  idleV = false;
  h.rc.tick(2.5, "3d");
  check("back into live PLAY on a board that cannot draw (RESUME, RESTART, a run start): onLost again", h.log.lost === 2);
  check("the look on screen is kept: get(3d) is the lost renderer, never CLASSIC", h.rc.get("3d") === r3 && h.rc.shownKind() === "3d" && tagged(h, "2d").length === n2);
  idleV = true;
  r3.dead = true;
  h.rc.tick(3, "3d");
  await flush();
  const r3b = tagged(h, "3d")[1];
  check("dead (DEAD_MS): a restore job builds a new context on a hidden clone, the old one still on screen", !!r3b && r3b.el !== r3.el && r3b.el.hidden === true && h.rc.get("3d") === r3 && h.rc.job().restore === true);
  r3b.stop = true; r3b.release();
  await flush();
  check("ready: the new context swaps in, the lost one is disposed, CLASSIC never drawn", h.log.swaps[h.log.swaps.length - 1] === r3b && r3.disposed === 1 && h.doc.getElementById("gl") === r3b.el && tagged(h, "2d").length === n2 && lastJob(h).on === true);
  idleV = false;
  h.rc.tick(3.5, "3d");
  check("dispose's own forceContextLoss is not a loss (the listener came off first)", h.log.lost === 2);
  idleV = true;
  h.rc.drop3d();
  idleV = false;
  h.rc.tick(4, "2d");
  check("nor is a release's", h.log.lost === 2);
  h.done();
}
{
  const h = harness({ kind: "3d", pre3d: true, prep: true, jobs: true });
  h.rc.get("3d");
  await flush();
  const r3 = tagged(h, "3d")[0];
  r3.stop = true; r3.release();
  await flush();
  r3.el.fire("webglcontextlost");
  h.rc.tick(1, "3d");
  r3.el.fire("webglcontextrestored");
  h.rc.tick(2, "3d");
  check("given back by the browser before DEAD_MS: the note clears, no rebuild", lastJob(h) === null && tagged(h, "3d").length === 1 && r3.disposed === 0);
  h.done();
}
{
  let failNext = false;
  const h = harness({ kind: "3d", pre3d: true, prep: true, jobs: true, fail3d: () => failNext });
  h.rc.get("3d");
  await flush();
  const r3 = tagged(h, "3d")[0];
  r3.stop = true; r3.release();
  await flush();
  failNext = true;
  r3.el.fire("webglcontextlost");
  r3.dead = true;
  h.rc.tick(1, "3d");
  await flush();
  check("a lost context that cannot be rebuilt: said as a failure, the pick reverts to CLASSIC 2D", h.log.fails[h.log.fails.length - 1] === "3d" && h.log.ons[h.log.ons.length - 1] === "2d" && lastJob(h).state === "failed" && r3.disposed === 1);
  h.done();
}
// review 5: a pick that cancels an AA / SHADOWS rebuild queues it again
{
  const h = harness({ kind: "3d", pre3d: true, prep: true, jobs: true });
  h.rc.get("3d");
  await flush();
  const r3 = tagged(h, "3d")[0];
  r3.stop = true; r3.release();
  await flush();
  h.rc.rebuild3d({ aa: false });
  await flush();
  const rb = tagged(h, "3d")[1];
  check("(an AA rebuild job is running)", !!rb && h.rc.job() && h.rc.job().rebuild === true && h.rc.rebuildAgain() === false);
  h.setKind("px"); h.rc.get("px");
  check("a RENDER pick cancels it (half-built context disposed) and queues it: rebuildAgain() is true once", rb.disposed === 1 && h.rc.rebuildAgain() === true && h.rc.rebuildAgain() === false);
  h.done();
}
{
  const src = readFileSync(new URL("../src/app/rcache.js", import.meta.url), "utf8");
  check("rcache.js imports nothing from src/render (factories are injected)", !/from\s+["']\.\.\/render\//.test(src));
  check("the one lazy-load site (3D and PIXEL): one raw() import call, one onReady site (settled), reached by every failure", (src.match(/\braw\(\)/g) || []).length === 1 && (src.match(/onReady\(\)/g) || []).length === 1 && /function lookFailed[\s\S]*?settled\(J\.k, null[,)]/.test(src));
  check("rcache.js imports only ./jobs.js (both loaders and factories are injected)", (src.match(/^import\s/gm) || []).length === 1 && /^import \{ [\w, ]+ \} from "\.\/jobs\.js";/m.test(src));
  check("rcache never assigns the #gl drawing buffer", !/\.width\s*=\s*[^;]*dpr/i.test(src) && !/glCanvas\.width\s*=/.test(src));
}

console.warn = warn0;
console.log(fail ? "RCACHE FAIL" : "RCACHE OK", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
