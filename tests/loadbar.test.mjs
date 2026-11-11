// The loader must not lie: its totals are the real import graphs, its fill never
// moves back, 100 % waits for the title. `node tests/loadbar.test.mjs --write`
// rewrites the pins after a graph change.
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { LOOK, TILES, TREE, lookPlan, paintYield, afterFirstRender, loadCard } from "../src/app/loadbar.js";
import { PRECACHE } from "../src/pwa/shell.js";
import { lookVal } from "../src/render/menudraw.js";
import { BANDS } from "../src/app/jobs.js";

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
/* v202 delivery 3a: what the title never runs, each behind its seam (src/app/lazyload.js) */
const treeG3 = graph(["src/core/board3.js"]).filter((f) => !boot.includes(f));
const LAZY = { gen3: treeG3, net: graph(["src/net/localpair.js"]).filter((f) => !boot.includes(f)), iso: ["src/render/r3d/scene3d.js"], bot: ["src/app/demobot.js"] };
const pinned = +/id="loadjs" data-files="(\d+)"/.exec(html)[1];
const bytes = (a) => a.reduce((n, f) => n + statSync(join(ROOT, f)).size, 0);
const bigW3 = Math.round(((tree3.length - 1) * statSync(join(ROOT, "vendor/three.module.js")).size) / (bytes(tree3) - statSync(join(ROOT, "vendor/three.module.js")).size));

const PRE = /(<!-- preload:begin -->\n)([\s\S]*?)(<!-- preload:end -->)/;
const preWant = [...boot].sort().map((f) => '<link rel="modulepreload" href="./' + f + '">\n').join("");
const preHave = (PRE.exec(html) || [])[2];

if (process.argv.includes("--write")) {
  writeFileSync(htmlPath, html.replace(/(id="loadjs" data-files=")\d+/, "$1" + boot.length).replace(PRE, (m, a, b, c) => a + preWant + c));
  const src = readFileSync(barPath, "utf8");
  writeFileSync(barPath, src.replace(/(label: "REAL 3D", files: )\d+/, "$1" + tree3.length).replace(/(label: "PIXEL", files: )\d+/, "$1" + treePx.length).replace(/("3d": Object\.freeze\()\[[^\]]*\]/, "$1" + JSON.stringify([...tree3].sort())).replace(/(  px: Object\.freeze\()\[[^\]]*\]/, "$1" + JSON.stringify([...treePx].sort())).replace(/(label: "FLOOR TILES", files: )\d+/, "$1" + treeG3.length));
  console.log("loader pins: boot " + boot.length + " (and its modulepreload block)" + ", REAL 3D " + tree3.length + ", PIXEL " + treePx.length);
  process.exit(0);
}

const FIX = " (fix: node tests/loadbar.test.mjs --write)";
check("the entry reaches main and audio", entries.includes("src/main.js") && entries.includes("src/audio.js"), entries.join());
check("every way the entry can die reaches the failure card: a failed file (the element's error event) and a rejected boot step (async, so the boot job ends only after it settles)", /<script type="module" onerror="__load\.fail\('boot'\)">/.test(html) && /Promise\.resolve\([\s\S]*\)\.then\(\(\)=>requestAnimationFrame\(\(\)=>L\.end\("boot"\)\),\(e\)=>\{console\.error\(e\);L\.fail\("boot"\);\}\)/.test(mod));
check("data-files = the real static boot graph" + FIX, pinned === boot.length, pinned + " vs " + boot.length);
check("the modulepreload block is the real static boot graph, sorted, one line per file" + FIX, preHave === preWant, preHave === undefined ? "no preload:begin / preload:end markers" : (preHave.match(/\n/g) || []).length + " lines vs " + boot.length);
{
  const hrefs = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]);
  const lazy = hrefs.filter((h) => /vendor\//.test(h) || tree3.includes(h.slice(2)) || treePx.includes(h.slice(2)) || Object.values(LAZY).flat().includes(h.slice(2)));
  check("modulepreload lists no file of a lazy tree (PIXEL, three, gen 3, net, iso, the bot; their seams are boot)", hrefs.length === boot.length && lazy.length === 0, lazy.join());
  check("modulepreload hrefs are relative ./ module files, and all precached", hrefs.every((h) => /^\.\/src\/[\w/.-]+\.js$/.test(h) && PRECACHE.includes(h)), hrefs.filter((h) => !PRECACHE.includes(h)).join());
  check("the block sits after the inline loader (its observer is up first) and before the entry", html.indexOf("<!-- preload:begin") > html.indexOf('id="loadjs"') && html.indexOf("<!-- preload:end") < html.indexOf('<script type="module"'));
}
check("REAL 3D files = its lazy tree" + FIX, LOOK["3d"].files === tree3.length, LOOK["3d"].files + " vs " + tree3.length);
check("PIXEL files = its lazy tree" + FIX, LOOK.px.files === treePx.length, LOOK.px.files + " vs " + treePx.length);
check("FLOOR TILES files = gen 3's lazy tree" + FIX, TILES.files === treeG3.length, TILES.files + " vs " + treeG3.length);
{
  const want = { gen3: ["src/core/board3.js", "src/core/featplace.js", "src/core/featchecks.js"], net: ["src/net/localpair.js", "src/net/lockstep.js", "src/net/protocol.js", "src/net/transport.js"], iso: ["src/render/r3d/scene3d.js"], bot: ["src/app/demobot.js"] };
  for (const [k, fs] of Object.entries(want)) {
    const inBoot = fs.filter((f) => boot.includes(f));
    check("boot graph leaves out " + k + " (" + fs.length + " files, behind src/app/lazyload.js)", inBoot.length === 0 && fs.every((f) => LAZY[k].includes(f)), inBoot.join());
    const off = fs.filter((f) => !PRECACHE.includes("./" + f));
    check(k + ": still precached, so offline still works", off.length === 0, off.join());
  }
  check("the seams that load them are boot (lazyload.js, renderer.js's loadIso)", boot.includes("src/app/lazyload.js") && boot.includes("src/render/renderer.js") && boot.includes("src/core/board2.js") && boot.includes("src/app/attract.js"));
  const tp = lookPlan(null, TILES);
  check("FLOOR TILES counts only gen 3's files", treeG3.every((f) => tp.weigh("http://x/" + f) === 1) && !tp.weigh("http://x/src/core/board2.js") && tp.total === treeG3.length);
}
for (const [k, tree] of [["3d", tree3], ["px", treePx]]) check(k + ": TREE (rcache's fetch-first list) = its lazy tree, sorted, and lookPlan hands it" + FIX, JSON.stringify(TREE[k]) === JSON.stringify([...tree].sort()) && lookPlan(k).urls === TREE[k], TREE[k].length + " vs " + tree.length);
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
{
  /* v202: the CONTROLS page and its paint load when CONTROLS opens (or in idle), rumble on the first pad; the first pad press still leaves the title from boot code. */
  const LAZY = ["src/app/controlspage.js", "src/app/capture.js", "src/app/rumble.js", "src/render/controlsdraw.js", "src/render/controlsgeo.js", "src/render/padart.js"];
  const KEEP = ["src/app/controls.js", "src/app/hints.js", "src/render/hintcopy.js", "src/app/gamepad.js", "src/app/padroute.js", "src/app/controlswire.js"];
  const lazyIn = LAZY.filter((f) => boot.includes(f)), keepOut = KEEP.filter((f) => !boot.includes(f)), off = LAZY.filter((f) => !PRECACHE.includes("./" + f));
  check("CONTROLS: the page, its paint and rumble are not in the boot graph", lazyIn.length === 0, lazyIn.join());
  check("CONTROLS: the binds, hints, pad poller, router and wire stay in boot", keepOut.length === 0, keepOut.join());
  check("CONTROLS: the lazy files stay in the service worker precache (offline still opens the page)", off.length === 0, off.join());
  const lazyPre = [...html.matchAll(/<link rel="modulepreload" href="\.\/([^"]+)">/g)].map((m) => m[1]).filter((f) => LAZY.includes(f));
  check("CONTROLS: no modulepreload for a lazy CONTROLS file", lazyPre.length === 0, lazyPre.join());
}

// CSS: compositor only, reduced motion, the hidden rule
const css = strip(html.slice(html.indexOf("<style"), html.indexOf("</style>")));
const rule = (sel) => (new RegExp("(?:^|\\n|\\})\\s*" + sel + "\\{([^}]*)\\}").exec(css) || [])[1] || "";
check("the plate is the CONSOLE PANEL plate, centred, off the pointer", /border:1px solid var\(--k-frame\)/.test(rule("#load")) && /border-radius:6px/.test(rule("#load")) && /pointer-events:none/.test(rule("#load")));
check("it appears only after 150 ms, with no JS involved", /150ms/.test(rule("#load")));
check("it is hidden in markup (no JS, no bar)", /<div id="load" hidden data-boot>/.test(html));
check("fill and glint move by transform only", /transition:transform/.test(rule("#loadfill")) && !/width|left/.test(rule("#loadfill").replace(/inset:0/, "")) && /@keyframes loadRun\{from\{transform:[^}]*\}to\{transform:[^}]*\}\}/.test(css));
check("prefers-reduced-motion stops the glint and the fill's glide", /prefers-reduced-motion:reduce\)\{#loadrun\{animation:none[^}]*\}#loadfill\{transition:none\}/.test(css));
{
  const rm = (/prefers-reduced-motion:reduce\)\{(#loadrun[\s\S]*?\})\}/.exec(css) || [])[1] || "";
  const st = (/#loadbar\[data-ind\]\{([^}]*)\}/.exec(rm) || [])[1] || "";
  check("reduced motion: a wait with no number is a still striped track, not an empty one", /repeating-linear-gradient/.test(st) && !/animation|transition/.test(st), st);
}
{
  const chip = rule("#load\\[data-dock\\]:not\\(\\[data-act\\]\\)");
  check("chip: one slim line (28 px) placed by --chip-x/-y, sized inside the stage", /height:28px/.test(chip) && /flex-direction:row/.test(chip) && /var\(--chip-y/.test(chip) && /var\(--chip-x/.test(chip) && /var\(--chip-w/.test(chip), chip);
  check("chip: its bar is 3 px along the bottom", /height:3px/.test(rule("#load\\[data-dock\\]:not\\(\\[data-act\\]\\) #loadbar")) && /bottom:0/.test(rule("#load\\[data-dock\\]:not\\(\\[data-act\\]\\) #loadbar")));
  check("chip: the failure note is the danger colour plus words", /var\(--k-cor\)/.test(rule("#load\\[data-note=bad\\] #loadmsg")));
  check("chip: no pointer (no data-act rule reaches it)", /pointer-events:none/.test(rule("#load")) && !/pointer-events/.test(chip));
}
check("the failure card's buttons show keyboard focus", /#loadact button:focus-visible\{outline:/.test(css));
{
  const tag = (/<div id="loadsay"[^>]*>/.exec(html) || [])[0] || "";
  const at = html.indexOf('id="loadsay"');
  check("one polite, atomic, visually hidden status for the loader", /aria-live="polite"/.test(tag) && /aria-atomic="true"/.test(tag) && /class="sr-only"/.test(tag) && !/\bhidden\b/.test(tag) && !/#loadsay/.test(css), tag);
  check("it sits outside #load (which hides) and outside #wrap, before the loader script", at > html.indexOf("</div></div>", html.indexOf('<div id="load"')) && at < html.indexOf('id="loadjs"') && at < html.indexOf('<div id="wrap"'));
}
check("progressbar role and range", /id="loadbar" role="progressbar"[^>]*aria-valuemin="0" aria-valuemax="100"/.test(html));

// ---- drive the real inline script under a fake DOM ----
function boot1(opts = {}) {
  const els = {};
  const el = (id) => (els[id] ||= {
    id, hidden: id === "load", attrs: {}, style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } }, textContent: "", onclick: null, on: {},
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; },
    getBoundingClientRect() { return {}; }, addEventListener(t, f) { this.on[t] = f; }, focus() { this.focused = true; },
  });
  el("loadjs").attrs["data-files"] = String(opts.files || 4);
  el("load").attrs["data-boot"] = "";
  let obs = null, t = 0, ivF = null;
  const winOn = {}, winCap = {};
  const ctx = {
    document: { getElementById: el, baseURI: "http://x/g/index.html", hidden: false, cap: {}, addEventListener(k, f, c) { if (c) (this.cap[k] ||= []).push(f); } },
    location: { origin: "http://x", reload() { ctx.reloaded = (ctx.reloaded || 0) + 1; } },
    URL, performance: { now: () => t }, setInterval: (f) => { ivF = f; return 1; }, clearInterval: () => {},
    addEventListener(k, f, c) { winOn[k] = f; winCap[k] = c; },
    PerformanceObserver: opts.noObs ? undefined : class { constructor(f) { obs = f; } observe(o) { ctx.obsOpts = o; } },
  };
  ctx.window = ctx;
  const src = /<script id="loadjs"[^>]*>([\s\S]*?)<\/script>/.exec(html)[1];
  vm.runInNewContext(src, ctx);
  const files = (names, st = 1e9, status) => obs && obs({ getEntries: () => names.map((n) => ({ name: n, startTime: st, responseStatus: status })) });
  const key = (k, o = {}) => { const e = { key: k, target: o.target || null, repeat: !!o.repeat, stopped: 0, prevented: 0, preventDefault() { this.prevented++; }, stopImmediatePropagation() { this.stopped++; } }; winOn.keydown(e); return e; };
  return { L: ctx.__load, ctx, el, files, time: (v) => { t = v; ivF && ivF(); }, winOn, winCap, key, say: () => el("loadsay").textContent };
}
const scale = (b) => +/scaleX\(([\d.]+)\)/.exec(b.el("loadfill").style.transform || "scaleX(0)")[1];
const U = (n) => "http://x/g/src/m" + n + ".js";
{
  const b = boot1();
  check("the first paint is visible and indeterminate, with no number", !b.el("load").hidden && "data-ind" in b.el("loadbar").attrs && !("aria-valuenow" in b.el("loadbar").attrs) && b.el("loadmsg").textContent === "LOADING");
  check("the observer takes buffered resource entries", b.ctx.obsOpts.type === "resource" && b.ctx.obsOpts.buffered === true);
  check("the live status opens with a stage, not a number", b.say() === "Loading.");
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
  check("no count ever reached the live status", !/\d/.test(b.say()), b.say());
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
  b.key("Enter", { target: b.el("loadretry") });
  check("Enter on the focused RETRY is left to the button (no double fire)", b.ctx.reloaded === 1);
  b.key("Enter");
  check("Enter retries even when focus has left RETRY", b.ctx.reloaded === 2);
  const e1 = b.key("Escape");
  check("Escape does nothing on the boot card (it has no other button)", !e1.stopped && b.ctx.reloaded === 2 && !b.el("load").hidden);
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
  b.time(9000);
  check("no slow note before 10 s", !/SLOW/.test(b.el("loadmsg").textContent) && b.el("loadact").hidden);
  b.time(11000);
  check("10 s with no finished file: the slow note, no RETRY yet", /· SLOW CONNECTION, STILL TRYING$/.test(b.el("loadmsg").textContent) && b.el("loadact").hidden && !("data-act" in b.el("load").attrs));
  check("the live status says it once, in words, with no count", b.say() === "Slow connection, still trying.");
  b.time(29000);
  check("still no RETRY before 30 s", b.el("loadact").hidden);
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
  {
    const t = boot1(); t.L.end("boot"); t.L.begin("tiles", lookPlan(null, TILES)); t.L.spot({ off: true });
    check("a run start waiting for gen 3 is the full plate, not the chip, even in GAME", !t.el("load").hidden && !("data-dock" in t.el("load").attrs) && t.el("loadmsg").textContent === "LOADING FLOOR TILES");
  }
  check("a look picked after boot docks at the top without the wordmark", !b.el("load").hidden && "data-dock" in b.el("load").attrs && b.el("loadmsg").textContent === "LOADING REAL 3D");
  check("a look's job says its stage", b.say() === "Loading REAL 3D.");
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
  check("the live status follows: Preparing REAL 3D.", b.say() === "Preparing REAL 3D.");
  b.L.end("3d");
  check("ending a shown chip's job: REAL 3D · READY on the chip for 0.8 s", !b.el("load").hidden && b.el("loadmsg").textContent === "REAL 3D · READY" && b.el("load").attrs["data-note"] === "ok" && !b.el("loadbar").hidden);
  b.time(b.ctx.performance.now() + 900);
  b.L.spot({ x: 1 });
  check("then the chip goes", b.el("load").hidden && !("data-note" in b.el("load").attrs));
  check("and says it is ready, once the plate is gone", b.say() === "REAL 3D ready.");
  b.L.begin("px", lookPlan("px"));
  b.L.focus("2d");
  b.L.end("px");
  check("a job that never got its files in never says ready", b.say() === "Loading PIXEL.");
}
// v202 step 2 E: progress(k, lookJob): the counted phases after the files, on the chip, the row's own words
{
  const b = boot1();
  b.L.end("boot");
  b.time(100);
  const fb = BANDS.px.files.w;
  b.L.begin("px", { ...lookPlan("px"), fb });
  b.files(["http://x/g/src/render/pixel/atlas.js", "http://x/g/src/render/pixel/renderer.js"], 200);
  check("with a files band, the files fill only their own share of the bar", scale(b) > 0 && scale(b) <= fb + 1e-9, String(scale(b)));
  b.L.phase("px");
  check("all files in: the bar sits at the band's end, PREPARING PIXEL", Math.abs(scale(b) - fb) < 1e-9 && b.el("loadmsg").textContent === "PREPARING PIXEL");
  const say0 = b.say(), J = (o) => ({ k: "px", state: "preparing", phase: null, done: 0, total: null, ind: true, ...o });
  b.L.progress("px", J({ phase: "eval", done: 1, total: 1, fill: 0.4, ind: false }));
  check("a phase without a word: PIXEL · PREPARING, the band fill, determinate", b.el("loadmsg").textContent === "PIXEL · PREPARING" && Math.abs(scale(b) - 0.4) < 1e-9 && !("data-ind" in b.el("loadbar").attrs));
  b.L.progress("px", J({ phase: "bake", done: 140, total: 255, fill: 0.5, ind: false }));
  check("PIXEL · ART 140 / 255, the same words as the RENDER row (menudraw lookVal)", b.el("loadmsg").textContent === "PIXEL · ART 140 / 255" && b.el("loadmsg").textContent === lookVal({ k: "px", st: "preparing", phase: "bake", done: 140, total: 255 })[0]);
  check("aria follows the fill and the words", b.el("loadbar").attrs["aria-valuenow"] === "50" && b.el("loadbar").attrs["aria-valuetext"] === "PIXEL · ART 140 / 255");
  b.L.progress("px", J({ phase: "bake", done: 141, total: 255, fill: 0.3, ind: false }));
  check("a lower fill never pulls the bar back", Math.abs(scale(b) - 0.5) < 1e-9 && b.el("loadmsg").textContent === "PIXEL · ART 141 / 255");
  b.el("loadmsg").textContent = "SENTINEL";
  b.L.progress("px", J({ phase: "bake", done: 141, total: 255, fill: 0.5, ind: false }));
  check("a repeat repaints nothing", b.el("loadmsg").textContent === "SENTINEL");
  b.L.progress("px", J({ phase: "warm", done: 0, total: 1, fill: 0.9, ind: false }));
  b.L.progress("px", J({ state: "ready", fill: 1 }));
  b.L.progress("px", J({ state: "failed" }));
  check("ready and failed are end() and miss()'s, never progress's", b.el("loadmsg").textContent === "PIXEL · PREPARING" && Math.abs(scale(b) - 0.9) < 1e-9);
  check("no count ever reaches the live status", b.say() === say0 && !/\d/.test(b.say()), b.say());
  b.L.end("px");
  b.L.begin("3d", { ...lookPlan("3d"), fb: BANDS["3d"].files.w }, true);
  b.L.progress("3d", { k: "3d", state: "preparing", phase: "shaders", done: 18, total: 31, fill: 0.7, ind: false });
  check("REAL 3D · SHADERS 18 / 31 (row words)", b.el("loadmsg").textContent === "REAL 3D · SHADERS 18 / 31" && b.el("loadmsg").textContent === lookVal({ k: "3d", st: "preparing", phase: "shaders", done: 18, total: 31 })[0]);
  b.L.progress("3d", { k: "3d", state: "preparing", phase: "build", done: 3, total: 5, fill: 0.72, ind: false });
  check("REAL 3D · BUILDING 3 / 5", b.el("loadmsg").textContent === "REAL 3D · BUILDING 3 / 5");
  b.L.end("3d");
  b.L.begin("3d", lookPlan("3d"), true);
  b.L.progress("3d", { k: "3d", state: "preparing", phase: null, done: 0, total: null, ind: true, restore: true, rebuild: true });
  check("a lost context: REAL 3D · RESTORING, indeterminate until a count comes", b.el("loadmsg").textContent === "REAL 3D · RESTORING" && "data-ind" in b.el("loadbar").attrs && b.say() === "Restoring REAL 3D.");
  b.L.progress("3d", { k: "3d", state: "preparing", phase: "build", done: 2, total: 9, fill: 0.5, ind: false, restore: true, rebuild: true });
  check("RESTORING keeps its word while the fill moves", b.el("loadmsg").textContent === "REAL 3D · RESTORING" && Math.abs(scale(b) - 0.5) < 1e-9 && b.say() === "Restoring REAL 3D.");
  b.L.begin("px", { ...lookPlan("px"), ind: true });
  b.files(["http://x/g/src/render/pixel/atlas.js"], 1e9);
  check("a pick that joins a warm fetch: no count (its files began before the job)", b.el("loadmsg").textContent === "LOADING PIXEL" && "data-ind" in b.el("loadbar").attrs);
  b.L.progress("zz", { state: "preparing" });
  check("progress for no job is ignored", b.el("loadmsg").textContent === "LOADING PIXEL");
}
// the chip (v202): the RENDER row owns a look's job while it is on screen; live PLAY shows nothing
{
  const b = boot1(), E = b.el("load");
  b.L.end("boot");
  b.L.spot({ row: true });
  b.L.begin("px", lookPlan("px"));
  check("chip: a look's job is down while its RENDER row is on screen", E.hidden && b.L.rowShown === true && b.L.wants());
  check("chip: the live status still speaks", b.say() === "Loading PIXEL.");
  b.L.rowShown = false;
  check("chip: leaving OPTIONS mid-load raises it (rowShown is a flag too)", !E.hidden && "data-dock" in E.attrs && b.el("loadmsg").textContent === "LOADING PIXEL");
  b.L.spot({ off: true, x: 300, y: 104, w: 584 });
  check("chip: never in live PLAY", E.hidden);
  check("chip: placed inside the drawn stage, top-centre", E.style["--chip-x"] === "300px" && E.style["--chip-y"] === "104px" && E.style["--chip-w"] === "584px");
  b.L.spot({ x: 300, y: 104, w: 584 });
  check("chip: back on PAUSE / the menus", !E.hidden);
  b.L.spot({});
  check("chip: no stage rect falls back to the CSS top", !("--chip-y" in E.style));
  b.L.miss("px", "CLASSIC 2D");
  check("chip: a failure points to SETTINGS › ART STYLE, in the danger form, no card, no buttons", !E.hidden && b.el("loadmsg").textContent === "PIXEL DID NOT LOAD · SETTINGS › ART STYLE" && E.attrs["data-note"] === "bad" && b.el("loadbar").hidden && b.el("loadact").hidden && !("data-act" in E.attrs));
  check("chip: the failure is spoken with the look kept", b.say() === "PIXEL did not load. CLASSIC 2D stays.");
  b.L.spot({ row: true });
  check("chip: on the RENDER row the row says it, the chip stays down", E.hidden);
  b.L.spot({});
  b.time(b.ctx.performance.now() + 4100);
  b.L.spot({ x: 2 });
  check("chip: the failure note lasts 4 s", E.hidden && !b.L.wants());
  b.L.begin("3d", lookPlan("3d"));
  b.L.phase("3d");
  b.L.spot({ row: true });
  b.L.end("3d");
  check("chip: a job that ends under the RENDER row flashes no chip READY (the row says it)", E.hidden);
  b.L.spot({});
  check("chip: nor after leaving", E.hidden);
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
  check("a look failure never grabs focus", !b.el("loadretry").focused);
  check("the keys listener runs in capture, ahead of the game's", b.winCap.keydown === true);
  const r1 = b.key("Enter", { repeat: true });
  check("a held key's repeat never answers the card", !r1.stopped && /^PIXEL STILL/.test(b.el("loadmsg").textContent));
  const r2 = b.key("ArrowUp");
  check("other keys pass to the game", !r2.stopped && !r2.prevented);
  const r3 = b.key("Escape");
  check("Escape is USE CLASSIC 2D: drops the look, closes the card, and the game never sees it", dropped === 1 && b.el("load").hidden && r3.stopped === 1 && r3.prevented === 1);
  const r4 = b.key("Escape");
  check("with no card up, keys pass through", !r4.stopped && dropped === 1);
  b.L.begin("px", lookPlan("px"));
  b.L.fail("px", () => dropped++);
  b.L.focus("2d");
  check("moving off the failed look closes the card without touching the row", b.el("load").hidden && dropped === 1);
  let again = 0;
  b.L.begin("px", lookPlan("px"));
  b.L.fail("px", () => {}, () => again++);
  check("a first look failure asks for a retry with no reload warning", /^PIXEL COULD NOT LOAD/.test(b.el("loadmsg").textContent) && !/RELOADS/.test(b.el("loadmsg").textContent));
  const r5 = b.key("Enter");
  check("Enter is RETRY: re-imports in place, never reloads the run away, and the game never sees it", again === 1 && !b.ctx.reloaded && r5.stopped === 1);
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
  check("pad last used: the buttons name their pad words", b.el("loadretry").textContent === "RETRY SOUTH" && b.el("loadkeep").textContent === "USE CLASSIC 2D EAST");
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

/* v202 fix round 1: the card's answers cancel an armed STATS reset (src/app/reset.js guardLoadCard, wired by main): its Enter / Escape (the inline
   script's own capture keydown calls the buttons' onclick), a tap on RETRY / USE CLASSIC 2D (a document capture listener for a target in #load) and a
   controller's SOUTH / EAST (padPress calls the same onclick). Run against the real inline script */
{
  const { guardLoadCard } = await import("../src/app/reset.js");
  const inLoad = new Set(["loadretry", "loadkeep", "loadmsg", "loadact", "loadbar", "loadfill"]);
  const arm = () => {
    const b = boot1(), E = b.el("load"), app = { resetArm: true };
    E.contains = (t) => !!t && (t === E || inLoad.has(t.id));
    const ok = guardLoadCard(b.ctx.document, () => { app.resetArm = false; });
    b.L.end("boot"); b.L.begin("tiles", lookPlan("px")); b.L.fail("tiles", () => {}, () => {});
    const cap = (ty, target) => (b.ctx.document.cap[ty] || []).forEach((f) => f({ type: ty, target }));
    return { b, app, ok, cap };
  };
  const rows = [];
  for (const [how, act] of [
    ["Enter", (t) => t.b.key("Enter")], ["Escape", (t) => t.b.key("Escape")],
    ["a tap on RETRY", (t) => { t.cap("pointerdown", t.b.el("loadretry")); }], ["a tap on USE CLASSIC 2D", (t) => { t.cap("pointerdown", t.b.el("loadkeep")); }],
    ["a click on RETRY (its onclick)", (t) => { t.cap("click", t.b.el("loadretry")); t.b.el("loadretry").onclick(); }],
    ["a controller's SOUTH", (t) => t.b.L.padPress("S")], ["a controller's EAST", (t) => t.b.L.padPress("E")],
  ]) { const t = arm(); act(t); rows.push([how, t.ok, t.app.resetArm]); }
  check("the load card's Enter / Escape, its RETRY / USE CLASSIC 2D taps and a controller's SOUTH / EAST each cancel an armed reset", rows.every(([, ok, arm]) => ok && arm === false), JSON.stringify(rows));
  const t = arm(); t.cap("pointerdown", { id: "c" }); t.b.key("ArrowUp");
  check("a tap or key that is not the card's leaves the reset armed (the game's own paths decide)", t.app.resetArm === true);
  check("no #load (Node, a page without the loader): guardLoadCard does nothing", guardLoadCard({ getElementById: () => null, addEventListener() {} }, () => {}) === false && guardLoadCard(null, () => {}) === false);
}

console.log("LOADBAR", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
