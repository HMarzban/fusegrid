// The loader must not lie: its totals are the real import graphs, its fill never
// moves back, 100 % waits for the title. `node tests/loadbar.test.mjs --write`
// rewrites the pins after a graph change.
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { LOOK, lookPlan, paintYield, afterFirstRender, loadCard } from "../src/app/loadbar.js";
import { PRECACHE } from "../src/pwa/shell.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const EDGE = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^;"']*?\sfrom\s*)?["']([^"']+)["']/g;
function graph(entries) {
  const seen = new Set(), todo = entries.map((e) => join(ROOT, e));
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    if (!existsSync(f)) continue;
    for (const m of strip(readFileSync(f, "utf8")).matchAll(EDGE)) if (m[1].startsWith(".")) todo.push(join(dirname(f), m[1]));
  }
  return [...seen].map((f) => relative(ROOT, f));
}

const htmlPath = join(ROOT, "index.html"), barPath = join(ROOT, "src/app/loadbar.js");
const html = readFileSync(htmlPath, "utf8");
const mod = /<script type="module"[^>]*>([\s\S]*?)<\/script>/.exec(html)[1];
const entries = [...strip(mod).matchAll(EDGE)].map((m) => m[1].replace(/^\.\//, ""));
const boot = graph(entries), tree3 = graph(["src/render/three/wrapper.js"]).filter((f) => !boot.includes(f)), treePx = graph(["src/render/pixel/renderer.js"]).filter((f) => !boot.includes(f));
const pinned = +/id="loadjs" data-files="(\d+)"/.exec(html)[1];
const bytes = (a) => a.reduce((n, f) => n + statSync(join(ROOT, f)).size, 0);
const bigW3 = Math.round(((tree3.length - 1) * statSync(join(ROOT, "vendor/three.module.js")).size) / (bytes(tree3) - statSync(join(ROOT, "vendor/three.module.js")).size));

if (process.argv.includes("--write")) {
  writeFileSync(htmlPath, html.replace(/(id="loadjs" data-files=")\d+/, "$1" + boot.length));
  const src = readFileSync(barPath, "utf8");
  writeFileSync(barPath, src.replace(/(label: "REAL 3D", files: )\d+/, "$1" + tree3.length).replace(/(label: "PIXEL", files: )\d+/, "$1" + treePx.length));
  console.log("loader pins: boot " + boot.length + ", REAL 3D " + tree3.length + ", PIXEL " + treePx.length);
  process.exit(0);
}

const FIX = " (fix: node tests/loadbar.test.mjs --write)";
check("the entry reaches main and audio", entries.includes("src/main.js") && entries.includes("src/audio.js"), entries.join());
check("every way the entry can die reaches the failure card: a failed file (the element's error event) and a rejected boot step (async, so the boot job ends only after it settles)", /<script type="module" onerror="__load\.fail\('boot'\)">/.test(html) && /Promise\.resolve\([\s\S]*\)\.then\(\(\)=>requestAnimationFrame\(\(\)=>L\.end\("boot"\)\),\(e\)=>\{console\.error\(e\);L\.fail\("boot"\);\}\)/.test(mod));
check("data-files = the real static boot graph" + FIX, pinned === boot.length, pinned + " vs " + boot.length);
check("REAL 3D files = its lazy tree" + FIX, LOOK["3d"].files === tree3.length, LOOK["3d"].files + " vs " + tree3.length);
check("PIXEL files = its lazy tree" + FIX, LOOK.px.files === treePx.length, LOOK.px.files + " vs " + treePx.length);
for (const [k, tree] of [["3d", tree3], ["px", treePx]]) {
  const w = lookPlan(k).weigh;
  const miss = tree.filter((f) => !(w("http://x/" + f) > 0));
  check(k + ": every file of the lazy tree is counted", miss.length === 0, miss.join());
  check(k + ": no boot-menu file is counted by a stranger's name", !w("http://x/src/app/menuapp.js") && !w("http://x/src/render/renderer.js"));
  const off = tree.filter((f) => !PRECACHE.includes("./" + f));
  check(k + ": the tree is precached", off.length === 0, off.join());
  check(k + ": total is the sum of the weights", tree.reduce((n, f) => n + w("http://x/" + f), 0) === lookPlan(k).total);
}
const share = LOOK["3d"].bigW / lookPlan("3d").total, real = statSync(join(ROOT, "vendor/three.module.js")).size / bytes(tree3);
check("three's weight is its real share of the REAL 3D bytes, within 5 points (bigW " + bigW3 + " is exact)", Math.abs(share - real) < 0.05, share.toFixed(3) + " vs " + real.toFixed(3));
check("loadbar.js is precached and in the boot graph (rcache reads it)", PRECACHE.includes("./src/app/loadbar.js") && boot.includes("src/app/loadbar.js"));

// CSS: compositor only, reduced motion, the hidden rule
const css = strip(html.slice(html.indexOf("<style"), html.indexOf("</style>")));
const rule = (sel) => (new RegExp("(?:^|\\n|\\})\\s*" + sel + "\\{([^}]*)\\}").exec(css) || [])[1] || "";
check("the plate is the CONSOLE PANEL plate, centred, off the pointer", /border:1px solid #2a3550/.test(rule("#load")) && /border-radius:6px/.test(rule("#load")) && /pointer-events:none/.test(rule("#load")));
check("it appears only after 150 ms, with no JS involved", /150ms/.test(rule("#load")));
check("it is hidden in markup (no JS, no bar)", /<div id="load" hidden data-boot>/.test(html));
check("fill and glint move by transform only", /transition:transform/.test(rule("#loadfill")) && !/width|left/.test(rule("#loadfill").replace(/inset:0/, "")) && /@keyframes loadRun\{from\{transform:[^}]*\}to\{transform:[^}]*\}\}/.test(css));
check("prefers-reduced-motion stops the glint and the fill's glide", /prefers-reduced-motion:reduce\)\{#loadrun\{animation:none[^}]*\}#loadfill\{transition:none\}/.test(css));
check("progressbar role and range", /id="loadbar" role="progressbar"[^>]*aria-valuemin="0" aria-valuemax="100"/.test(html));

// ---- drive the real inline script under a fake DOM ----
function boot1(opts = {}) {
  const els = {};
  const el = (id) => (els[id] ||= {
    id, hidden: id === "load", attrs: {}, style: {}, textContent: "", onclick: null, on: {},
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; },
    getBoundingClientRect() { return {}; }, addEventListener(t, f) { this.on[t] = f; }, focus() { this.focused = true; },
  });
  el("loadjs").attrs["data-files"] = String(opts.files || 4);
  el("load").attrs["data-boot"] = "";
  let obs = null, t = 0, ivF = null;
  const winOn = {};
  const ctx = {
    document: { getElementById: el, baseURI: "http://x/g/index.html", hidden: false },
    location: { origin: "http://x", reload() { ctx.reloaded = (ctx.reloaded || 0) + 1; } },
    URL, performance: { now: () => t }, setInterval: (f) => { ivF = f; return 1; }, clearInterval: () => {},
    addEventListener(k, f) { winOn[k] = f; },
    PerformanceObserver: opts.noObs ? undefined : class { constructor(f) { obs = f; } observe(o) { ctx.obsOpts = o; } },
  };
  ctx.window = ctx;
  const src = /<script id="loadjs"[^>]*>([\s\S]*?)<\/script>/.exec(html)[1];
  vm.runInNewContext(src, ctx);
  const files = (names, st = 1e9, status) => obs && obs({ getEntries: () => names.map((n) => ({ name: n, startTime: st, responseStatus: status })) });
  return { L: ctx.__load, ctx, el, files, time: (v) => { t = v; ivF && ivF(); }, winOn };
}
const scale = (b) => +/scaleX\(([\d.]+)\)/.exec(b.el("loadfill").style.transform || "scaleX(0)")[1];
const U = (n) => "http://x/g/src/m" + n + ".js";
{
  const b = boot1();
  check("the first paint is visible and indeterminate, with no number", !b.el("load").hidden && "data-ind" in b.el("loadbar").attrs && !("aria-valuenow" in b.el("loadbar").attrs) && b.el("loadmsg").textContent === "LOADING");
  check("the observer takes buffered resource entries", b.ctx.obsOpts.type === "resource" && b.ctx.obsOpts.buffered === true);
  b.files([U(1)]);
  check("a finished file turns it determinate and says how many", !("data-ind" in b.el("loadbar").attrs) && b.el("loadmsg").textContent === "LOADING · 1 / 4 FILES" && b.el("loadbar").attrs["aria-valuenow"] === "20");
  b.files([U(1), "http://x/g/og.png", "http://y/src/a.js"]);
  check("repeats, non-modules and other origins do not count", b.el("loadmsg").textContent === "LOADING · 1 / 4 FILES");
  b.files([U(9)], 1e9, 404);
  check("a 404 is not a finished file", b.el("loadmsg").textContent === "LOADING · 1 / 4 FILES");
  const seq = [];
  for (const i of [2, 3, 4, 5, 6]) { b.files([U(i)]); seq.push(scale(b)); }
  check("the fill never moves back and never reaches 100 on files alone", seq.every((v, i) => !i || v >= seq[i - 1]) && Math.max(...seq) < 1, seq.join());
  check("all files in: STARTING, not done", b.el("loadmsg").textContent === "STARTING" && !b.el("load").hidden);
  check("the stage stays hidden behind the first-load plate", "data-boot" in b.el("load").attrs && /#load\[data-boot\]~#wrap\{visibility:hidden\}/.test(css));
  b.L.end("boot");
  check("end(boot) hides it and lets the stage show", b.el("load").hidden && !("data-boot" in b.el("load").attrs));
}
{
  const b = boot1({ noObs: true });
  check("no PerformanceObserver: indeterminate, no fake number", "data-ind" in b.el("loadbar").attrs && b.el("loadmsg").textContent === "LOADING");
}
{
  const b = boot1();
  b.L.fail("boot");
  check("boot failure: plain message, RETRY up and focused, the bar gone, the plate takes pointers", /COULD NOT LOAD THE GAME/.test(b.el("loadmsg").textContent) && !b.el("loadact").hidden && b.el("loadretry").focused && b.el("loadbar").hidden && "data-act" in b.el("load").attrs && b.el("loadkeep").hidden && b.el("loadmsg").attrs.role === "alert");
  b.el("loadretry").onclick();
  check("RETRY reloads", b.ctx.reloaded === 1);
  b.L.focus("2d");
  b.L.end("boot");
  check("a late end or focus never clears a boot failure", !b.el("load").hidden && /COULD NOT/.test(b.el("loadmsg").textContent));
}
{
  const b = boot1();
  b.winOn.error({ filename: "http://elsewhere/ext.js" });
  check("a stranger's script error is ignored", !b.el("loadbar").hidden);
  b.winOn.error({ filename: "http://x/g/src/main.js" });
  check("a throw in our code before the title paints shows the failure", b.el("loadbar").hidden && /COULD NOT/.test(b.el("loadmsg").textContent));
  const c = boot1();
  c.L.end("boot");
  c.winOn.error({ filename: "http://x/g/src/main.js" });
  check("after the title, a runtime error is not a load failure", c.el("load").hidden);
}
{
  const b = boot1();
  b.time(29000);
  check("no stall note before 30 s", !/SLOW/.test(b.el("loadmsg").textContent) && b.el("loadact").hidden);
  b.time(31000);
  check("30 s with no finished file: says so and offers RETRY, never a silent stuck bar", /SLOW CONNECTION/.test(b.el("loadmsg").textContent) && !b.el("loadact").hidden);
  b.files([U(1)]);
  check("the next finished file clears the note", !/SLOW/.test(b.el("loadmsg").textContent) && b.el("loadact").hidden);
}
{
  const b = boot1();
  b.L.end("boot");
  b.time(100);
  b.L.begin("3d", lookPlan("3d"));
  check("a look picked after boot docks at the top without the wordmark", !b.el("load").hidden && "data-dock" in b.el("load").attrs && b.el("loadmsg").textContent === "LOADING REAL 3D");
  b.files(["http://x/g/src/render/three/camrig.js"], 50);
  check("a file fetched before the job does not count", b.el("loadmsg").textContent === "LOADING REAL 3D");
  b.files(["http://x/g/src/render/three/scene.js", "http://x/g/src/render/pixel/atlas.js"], 200);
  check("a file of the other look does not count", b.el("loadmsg").textContent === "REAL 3D · 1 / " + LOOK["3d"].files + " FILES");
  check("a small file moves the fill by bytes, not by file count", scale(b) < 0.02, String(scale(b)));
  b.files(["http://x/g/vendor/three.module.js"], 200);
  check("three moves it most of the way", scale(b) > 0.85, String(scale(b)));
  const v0 = scale(b);
  b.L.phase("3d");
  check("all fetched: PREPARING, the fill never back, not 100", b.el("loadmsg").textContent === "PREPARING REAL 3D" && scale(b) >= v0 && scale(b) < 1);
  b.L.end("3d");
  check("ending the job hides it", b.el("load").hidden);
}
{
  const b = boot1();
  b.L.begin("px", lookPlan("px"));
  check("a job begun during boot stays centred and takes over the plate", !("data-dock" in b.el("load").attrs) && b.el("loadmsg").textContent === "LOADING PIXEL");
  b.L.end("boot");
  check("the title painting leaves the look's bar up", !b.el("load").hidden && b.el("loadmsg").textContent === "LOADING PIXEL");
  let dropped = 0;
  b.L.fail("px", () => dropped++);
  check("a last look failure: names the look, warns about the reload, offers both", /^PIXEL STILL WILL NOT LOAD/.test(b.el("loadmsg").textContent) && /RUN IN PROGRESS/.test(b.el("loadmsg").textContent) && !b.el("loadkeep").hidden);
  check("a look failure never grabs focus (the game keeps its keys)", !b.el("loadretry").focused);
  b.el("loadkeep").onclick();
  check("USE CLASSIC 2D drops the look and closes the card", dropped === 1 && b.el("load").hidden);
  b.L.begin("px", lookPlan("px"));
  b.L.fail("px", () => dropped++);
  b.L.focus("2d");
  check("moving off the failed look closes the card without touching the row", b.el("load").hidden && dropped === 1);
  let again = 0;
  b.L.begin("px", lookPlan("px"));
  b.L.fail("px", () => {}, () => again++);
  check("a first look failure asks for a retry with no reload warning", /^PIXEL COULD NOT LOAD/.test(b.el("loadmsg").textContent) && !/RELOADS/.test(b.el("loadmsg").textContent));
  b.el("loadretry").onclick();
  check("its RETRY re-imports in place and never reloads the run away", again === 1 && !b.ctx.reloaded);
  b.L.begin("px", lookPlan("px"));
  check("the new attempt puts the bar back, not the alert", !b.el("loadbar").hidden && b.el("loadact").hidden && !("role" in b.el("loadmsg").attrs));
  b.time(1e6);
  check("a stalled look says so but offers no reload (it could end a run)", /SLOW CONNECTION/.test(b.el("loadmsg").textContent) && b.el("loadact").hidden);
  b.L.focus("2d");
  b.L.begin("3d", lookPlan("3d"), true);
  check("a rebuild with nothing to fetch is indeterminate", "data-ind" in b.el("loadbar").attrs && b.el("loadmsg").textContent === "PREPARING REAL 3D");
  b.L.focus("2d");
  check("moving off a look hides its bar", b.el("load").hidden);
}

// ---- helpers ----
{
  let ran = 0;
  await paintYield(() => {}, 5).then(() => ran++);
  check("paintYield still resolves when rAF never fires (a hidden tab)", ran === 1);
  let cb = null, done = 0;
  const r = { render(x) { return x + 1; } }, r0 = r.render;
  afterFirstRender(r, () => done++, (f) => { cb = f; }, 60000);
  check("afterFirstRender waits for the first render call", done === 0 && cb === null);
  check("the render call passes through", r.render(1) === 2);
  check("then one more frame, and the wrapper is gone", done === 0 && r.render === r0);
  cb();
  check("then done, once", done === 1);
}

// ---- T14: the look-load card on a pad ----
{
  check("loadCard with no loader is inert", (() => { const c = loadCard({}); c.press("S"); return c.live(true) === false; })());
  const b = boot1(), c = loadCard(b.ctx);
  check("no failure: nothing to answer", c.live(true) === false);
  b.L.begin("px", lookPlan("px"));
  let again = 0, dropped = 0;
  b.L.fail("px", () => dropped++, () => again++);
  check("a look failure is live for a pad; keys leave the labels alone", c.live(false) === true && !/SOUTH/.test(b.el("loadretry").textContent) && !/EAST/.test(b.el("loadkeep").textContent));
  c.live(true);
  check("pad last used: the buttons name their pad words", b.el("loadretry").textContent === "SOUTH RETRY" && b.el("loadkeep").textContent === "EAST USE CLASSIC 2D");
  c.live(false);
  check("back on keys: the plain labels", b.el("loadretry").textContent === "RETRY" && b.el("loadkeep").textContent === "USE CLASSIC 2D");
  c.press("W"); c.press("N"); c.press("START");
  check("only SOUTH and EAST act", again === 0 && dropped === 0);
  c.press("S");
  check("SOUTH is RETRY", again === 1 && dropped === 0);
  c.press("E");
  check("EAST is USE CLASSIC 2D", dropped === 1 && c.live(true) === false);
  const n = boot1(), nc = loadCard(n.ctx);
  n.L.fail("boot");
  check("a boot failure stays off the pad's table", nc.live(true) === false && (nc.press("S"), !n.ctx.reloaded));
}

console.log("LOADBAR", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
