import { mountRenderers, REL_T } from "../src/app/rcache.js";
import { readFileSync } from "node:fs";

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
    };
    return e;
  };
  parent.kids.push(mkEl("gl"), mkEl("px"));
  return { parent, getElementById: (id) => parent.kids.find((k) => k.id === id) || null };
}

function harness(o = {}) {
  const doc = mkDoc();
  const log = { swaps: [], ready: 0, loads: 0, built: [] };
  let k = o.kind || "2d";
  const mk = (tag) => (a, b, c) => {
    const opts = tag === "2d" ? b : c;
    const r = { tag, el: tag === "2d" ? null : a, opts, perfs: [], disposed: 0, invalidated: 0, slept: 0, liveAA: tag === "3d" ? (opts.perf ? opts.perf.aa : true) : undefined,
      render() {}, consumeEvents() {}, setPerf(K) { r.perfs.push(K); }, invalidate(re) { r.invalidated++; r.re = re; }, dispose() { r.disposed++; }, sleep() { r.slept++; } };
    if (o.fail3d && tag === "3d" && o.fail3d()) r.liveAA = null;
    log.built.push(r);
    return r;
  };
  let resolve3d, reject3d;
  const env = {
    canvas: { width: 0, height: 0 }, rig: {}, opts: { audio: null, createRenderer3D: o.pre3d ? mk("3d") : null },
    make: { "2d": o.throw2d ? () => { throw new Error("boom"); } : mk("2d"), px: mk("px") },
    size: () => ({ w: 600, h: 520 }), kind: () => k, perf: () => o.K || null,
    onSwap: (r) => log.swaps.push(r), onReady: () => log.ready++,
    loadRenderer3D: () => { log.loads++; return new Promise((res, rej) => { resolve3d = () => res({ createRenderer3D: mk("3d") }); reject3d = () => rej(new Error("404")); }); },
    fit: () => null, eager: !!o.eager,
  };
  const g0 = globalThis.document;
  globalThis.document = doc;
  const rc = mountRenderers(env);
  return { rc, doc, log, env, setKind: (v) => { k = v; }, resolve3d: () => resolve3d(), reject3d: () => reject3d(), done: () => { if (g0 === undefined) delete globalThis.document; else globalThis.document = g0; } };
}
const tickP = () => new Promise((r) => setTimeout(r, 0));
const warn0 = console.warn;
console.warn = () => {};

{
  const h = harness({ kind: "3d" });
  const r = h.rc.get("3d");
  check("lazy 3D: get(3d) before three loads returns the classic renderer and starts ONE load", r.tag === "2d" && h.log.loads === 1 && !h.rc.has3d(), r.tag + "/" + h.log.loads);
  h.rc.get("3d");
  check("a second get(3d) while loading starts no second load", h.log.loads === 1);
  h.resolve3d();
  await tickP();
  check("load resolve swaps in the 3D renderer when the kind is still 3d", h.log.swaps.length === 1 && h.log.swaps[0].tag === "3d" && h.rc.has3d());
  check("load settle calls onReady once", h.log.ready === 1);
  check("the 3D factory gets #gl and the rig", h.log.swaps[0].el === h.doc.getElementById("gl") && h.log.swaps[0].opts.rig === h.env.rig);
  h.done();
}
{
  const h = harness({ kind: "3d" });
  h.rc.get("3d");
  h.reject3d();
  await tickP();
  check("a failed three load still settles onReady (title never stranded)", h.log.ready === 1 && h.log.swaps.length === 0);
  h.done();
}
{
  const h = harness({ eager: true, kind: "2d" });
  check("eager (?render=3d) starts the load at mount", h.log.loads === 1);
  h.resolve3d();
  await tickP();
  check("eager resolve swaps the 3D renderer in and settles", h.log.swaps.length === 1 && h.log.swaps[0].tag === "3d" && h.log.ready === 1);
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
{
  const src = readFileSync(new URL("../src/app/rcache.js", import.meta.url), "utf8");
  check("rcache.js imports nothing from src/render (factories are injected)", !/from\s+["']\.\.\/render\//.test(src));
  const sites = src.match(/loadRenderer3D\(\)/g) || [];
  const settle = src.match(/loadRenderer3D\(\)\.then\(\(m\) => \{[^}]*\}\)\.catch\(\(e\) => console\.warn\("3D load failed", e\)\)\.then\(\(\) => onReady\(\)\)/g) || [];
  check("both loadRenderer3D sites catch then settle onReady", sites.length === 2 && settle.length === 2, sites.length + "/" + settle.length);
  check("rcache never assigns the #gl drawing buffer", !/\.width\s*=\s*[^;]*dpr/i.test(src) && !/glCanvas\.width\s*=/.test(src));
}

console.warn = warn0;
console.log(fail ? "RCACHE FAIL" : "RCACHE OK", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
