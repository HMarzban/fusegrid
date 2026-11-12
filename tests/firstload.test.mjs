// The first load (v206, direction B · RICH): the title being made where the title paints. index.html's inline loader draws a stage, its
// floor, the kit plate and logo B at the title's own rects and lights the logo's fuse as the boot files finish. This runs that inline code
// under a fake DOM and pins every rect to the real geometry (fit.js fitBox / portraitGeo, menudraw titleLogoBox and the title prompt's
// backing, draw2d titleSpot over worlds.js titleFit) at five windows, its letters to glyphs.js, and walks its states.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fitBox, portraitGeo } from "../src/app/fit.js";
import { titleLogoBox, drawIntroChrome } from "../src/render/menudraw.js";
import { titleSpot } from "../src/render/logo/draw2d.js";
import { layout as glyphs } from "../src/render/logo/glyphs.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const J = JSON.stringify, near = (a, b, e = 0.05) => Math.abs(a - b) <= e;
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = (/<script id="loadjs"[^>]*>([\s\S]*?)<\/script>/.exec(html) || [])[1] || "";
const css = html.slice(html.indexOf("<style"), html.indexOf("</style>")).replace(/\/\*[\s\S]*?\*\//g, "");
const px = (v) => parseFloat(v);

/* the inline loader under a fake DOM: a W x H window, touch or not, saved settings, a search string, reduced motion */
function run(o = {}) {
  const els = {}, uses = [];
  const el = (id) => (els[id] ||= {
    id, hidden: id === "load" || id === "loadst", attrs: {}, style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } }, textContent: "", on: {},
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; },
    getBoundingClientRect() { return {}; }, addEventListener(t, f) { this.on[t] = f; }, focus() { this.focused = true; },
    getTotalLength() { return 50; }, getPointAtLength(l) { return { x: l, y: -l }; },
  });
  for (let i = 0; i < 8; i++) uses.push({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } });
  el("loadjs").attrs["data-files"] = String(o.files || 4);
  el("load").attrs["data-boot"] = "";
  let obs = null, t = o.t0 || 0, ivF = null;
  const timers = [], winOn = {};
  const ctx = {
    document: { getElementById: el, querySelectorAll: (q) => (/#xF use,#xG use/.test(q) ? uses : []), baseURI: "http://x/g/index.html", hidden: false, addEventListener() {} },
    location: { origin: "http://x", search: o.search || "", reload() {} },
    URL, performance: { now: () => t }, setInterval: (f) => { ivF = f; return 1; }, clearInterval: () => {}, setTimeout: (f, ms) => timers.push([f, ms]),
    addEventListener(k, f) { winOn[k] = f; },
    PerformanceObserver: class { constructor(f) { obs = f; } observe() {} },
  };
  if (o.W) { ctx.innerWidth = o.W; ctx.innerHeight = o.H; }
  if (o.touch) ctx.ontouchstart = null;
  if (o.settings) ctx.localStorage = { getItem: (k) => (k === "nb.settings.v1" ? JSON.stringify(o.settings) : null) };
  if (o.rm) ctx.matchMedia = (q) => ({ matches: /prefers-reduced-motion:\s*reduce/.test(q) });
  ctx.window = ctx;
  vm.runInNewContext(src, ctx);
  const files = (n) => obs && obs({ getEntries: () => Array.from({ length: n }, (_, i) => ({ name: "http://x/g/src/m" + i + ".js", startTime: 1e9 })) });
  return { L: ctx.__load, el, uses, files, timers, winOn, ctx, time: (v) => { t = v; ivF && ivF(); } };
}

/* the title's rects in CSS px, from the game's own functions: #c's border box is the stage (border-box, so the 1 px border is inside it);
   the title paints in #c's content box, 1 px in, scaled (600s - 2) / 600 across and (520s - 2) / 520 down */
function want(W, H, touch) {
  const { lay, s } = fitBox(W, H, touch, 600, 520, false);
  const X = (W - 600 * s) / 2, Y = lay === "p" ? portraitGeo(W, H, 600, 520, false).top : (H - 520 * s) / 2;
  const kx = (600 * s - 2) / 600, ky = (520 * s - 2) / 520, bx = (v) => X + 1 + v * kx, by = (v) => Y + 1 + v * ky;
  const B = titleLogoBox(600, 520, lay), { x, y, f } = titleSpot(B.box, B.cy, B.dev), lx = x - f.outer.x, ly = y - f.outer.y;
  const rec = [], c = { fillRect: (...a) => rec.push([c.fillStyle, ...a]), strokeRect() {}, fillText() {}, measureText: () => ({ width: 0 }), save() {}, restore() {}, translate() {}, globalAlpha: 1 };
  drawIntroChrome(c, 0, 1, 600, 520, lay);
  const pr = rec.find((r) => r[0] === "rgba(7,10,18,0.9)");
  return { lay, s, cap: f.cap, build: f.build, stage: [X, Y, 600 * s, 520 * s], plate: [bx(lx + f.box.x - f.T), by(ly + f.box.y - f.T), (f.box.w + 2 * f.T) * kx, (f.box.h + 2 * f.T) * ky, f.T * kx, f.tile * kx],
    logo: [bx(lx), by(ly), glyphs(f.build).env.w * f.cap * kx], prompt: pr && { cx: bx(pr[1] + pr[3] / 2), cy: by(pr[2] + pr[4] / 2), w: pr[3] * kx, h: pr[4] * ky, px: (pr[4] - 12) * ky }, cell: 40 * kx };
}
const SIZES = [[1366, 768, false], [1280, 720, false], [852, 393, true], [393, 852, true], [375, 667, true]];
for (const [W, H, touch] of SIZES) {
  const w = want(W, H, touch), b = run({ W, H, touch }), st = b.el("lsg").style, pl = b.el("lpl").style, lg = b.el("llg").style, E = b.el("load").style, tag = W + "x" + H + " " + w.lay + " ";
  const got = (s, ks) => ks.map((k) => px(s[k]));
  check(tag + "stage = #c's border box (fitBox" + (w.lay === "p" ? ", portraitGeo's top" : "") + ")", got(st, ["left", "top", "width", "height"]).every((v, i) => near(v, w.stage[i])), J([got(st, ["left", "top", "width", "height"]), w.stage.map((v) => +v.toFixed(2))]));
  const gp = got(pl, ["left", "top", "width", "height", "borderWidth"]);
  check(tag + "plate ring = the title's fitted kit plate (titleSpot, cap " + w.cap + ", " + w.build + " build)", gp.every((v, i) => near(v, w.plate[i])) && near(px(pl["--t"]), w.plate[5]), J([gp, px(pl["--t"]), w.plate.map((v) => +v.toFixed(2))]));
  check(tag + "logo B's canvas lands on the title's", got(lg, ["left", "top", "width"]).every((v, i) => near(v, w.logo[i])), J([got(lg, ["left", "top", "width"]), w.logo.map((v) => +v.toFixed(2))]));
  check(tag + "the floor's cell is a board cell (40 box units)", near(px(b.el("lsg").style["--c"]), w.cell), b.el("lsg").style["--c"] + " vs " + w.cell);
  const f = px(E["--lf"]), floor = touch ? 16 : 20;
  check(tag + "the status box is the title prompt's backing: centre, height and (at STARTING) width", near(px(E["--lx"]), w.prompt.cx) && near(px(E["--ly"]), w.prompt.cy) && near(px(E["--lw"]), w.prompt.w) && near(px(E["--lh"]), w.prompt.h + (f - w.prompt.px)), J([E["--lx"], E["--ly"], E["--lw"], E["--lh"], w.prompt]));
  check(tag + "its words hold the cap floor (" + floor + " px: 14 px cap desk, 11 phone) and are the prompt's size wherever that is above it", near(f, Math.max(floor, w.prompt.px)), f + " vs " + w.prompt.px);
  check(tag + "the card (stall, failure) sits under the plate, inside the window", px(E["--cy"]) >= w.plate[1] + w.plate[3] && px(E["--cw"]) <= W - 32 + 0.01 && near(px(E["--lx"]), W / 2), J([E["--cy"], E["--cw"]]));
  check(tag + (w.lay === "p" ? "the stacked build" : "the line build"), (b.el("llg").attrs.viewBox || "-20 -40 677 176") === (w.lay === "p" ? "-20 -40 414 306" : "-20 -40 677 176"), b.el("llg").attrs.viewBox);
}
{
  /* a rotation while it loads re-places it (the loader listens for resize while the boot job lives) */
  const b = run({ W: 393, H: 852, touch: true });
  b.ctx.innerWidth = 852; b.ctx.innerHeight = 393;
  b.winOn.resize && b.winOn.resize();
  const w = want(852, 393, true);
  check("a resize while booting re-places the stage and swaps the build", near(px(b.el("lsg").style.left), w.stage[0]) && b.el("llg").attrs.viewBox === "-20 -40 677 176", J([b.el("lsg").style.left, b.el("llg").attrs.viewBox]));
}

/* logo B is the game's own: the letters, the env (viewBox), the cord and the bomb from glyphs.js layout, both builds */
{
  const L = glyphs("line"), S = glyphs("stack"), r = (v) => Math.round(v * 100);
  const svg = (/<svg id="?llg"?[\s\S]*?<\/svg>/.exec(html) || [""])[0];
  const xs = [...svg.matchAll(/<use href=#g(\w)( x=(\d+))? \/>/g)].map((m) => [m[1], +(m[3] || 0)]);
  check("line build: the eight letters at glyphs.js layout(\"line\") x 100", J(xs) === J(L.letters.map((l) => [l.ch, r(l.x)])), J(xs));
  check("line build: the viewBox is the layout's env", new RegExp('viewBox="' + [L.env.l, L.env.t, L.env.w, L.env.h].map(r).join(" ") + '"').test(svg));
  const b = run({ W: 393, H: 852, touch: true }), order = L.letters.map((l) => l.ch), st = order.map((ch) => S.letters.find((l) => l.ch === ch));
  check("stack build: the script moves each letter to layout(\"stack\")", J(b.uses.map((u) => [+u.attrs.x, +u.attrs.y])) === J(st.map((l) => [r(l.x), r(l.y)])), J(b.uses.map((u) => u.attrs)));
  check("stack build: its viewBox is that layout's env", b.el("llg").attrs.viewBox === [S.env.l, S.env.t, S.env.w, S.env.h].map(r).join(" "));
  const dB = [r(S.bomb.x - L.bomb.x), r(S.bomb.y - L.bomb.y)];
  check("stack build: the bomb moves by the layouts' difference", b.el("lbm").attrs.transform === "translate(" + dB.join(" ") + ")" && b.el("lbo").attrs.transform === b.el("lbm").attrs.transform, b.el("lbm").attrs.transform + " vs " + dB);
  const cordD = (Lb) => "M" + r(Lb.collar[0]) + " " + r(Lb.collar[1]) + "L" + r(Lb.cord[0][0]) + " " + r(Lb.cord[0][1]) + "C" + Lb.cord.slice(1).map((p) => r(p[0]) + " " + r(p[1])).join(" ");
  check("the cord runs from the collar on the layout's own path (both builds)", svg.includes('d="' + cordD(L) + '"') && b.el("lcp").attrs.d === cordD(S), cordD(L) + " / " + b.el("lcp").attrs.d);
  check("the logo is inline SVG: no filter, no image, nothing fetched", !/filter|<image|xlink:href="http|href="http/.test(svg) && svg.length > 1000);
}

/* the states, driven through the real job math */
{
  const b = run({ W: 1366, H: 768, files: 122 }), cl = () => b.el("lcl").style.strokeDasharray, spk = () => b.el("lsp").attrs.transform, fl = () => [b.el("lfl").style["--r"], b.el("lfl").style["--q"]].map(Number);
  check("first paint: the stage shows, the fuse is dark, the spark waits at the collar, no floor", !b.el("loadst").hidden && /^0 /.test(cl()) && spk() === "translate(0 0)" && J(fl()) === "[0,0]" && b.el("loadmsg").textContent === "LOADING", J([cl(), spk(), fl()]));
  b.files(61);
  const g = 61 / 123, m = Math.round(195 * g);
  check("61 / 122 files: the fuse lights to 61 / 123 from the collar, the spark rides its front", near(parseFloat(cl()), 100 * g, 0.01) && spk() === "translate(" + 50 * g + " " + -50 * g + ")", cl() + " " + spk());
  check("the floor fills cell by cell with it: round(195 x 61 / 123) cells, whole rows from the bottom, then the rest left to right", J(fl()) === J([Math.floor(m / 15), m % 15]), J(fl()) + " " + m);
  check("the status box reads the count", b.el("loadmsg").textContent === "LOADING · 61 / 122 FILES");
  b.files(122);
  check("all in: STARTING, the fuse at 122 / 123 (never done), the floor one cell short at most", b.el("loadmsg").textContent === "STARTING" && near(parseFloat(cl()), 100 * 122 / 123, 0.01) && fl()[0] * 15 + fl()[1] === Math.round(195 * 122 / 123), cl());
  check("no hand-off yet: lit() says the loader is on screen only after its 150 ms", b.L.lit() === false);
  b.time(400);
  check("past 150 ms with the boot job alive the loader is on screen", b.L.lit() === true);
  b.L.end("boot");
  check("the hand-off: #load hides at once, the stage fades (data-end), then hides", b.el("load").hidden && "data-end" in b.el("loadst").attrs && !b.el("loadst").hidden && b.timers.some(([, ms]) => ms >= 180));
  b.timers.filter(([, ms]) => ms >= 180).forEach(([f]) => f());
  check("after the fade the stage is gone, and lit() stays true for the title", b.el("loadst").hidden && b.L.lit() === true);
}
{
  const b = run({ W: 1366, H: 768 });
  b.time(100);
  b.L.end("boot");
  check("a fast (cached) load ends before the 150 ms: the stage never shows, no fade, lit() false (the title plays its own reveal)", b.el("loadst").hidden && !("data-end" in b.el("loadst").attrs) && b.L.lit() === false);
}
{
  const b = run({ W: 1366, H: 768, files: 10 });
  b.files(4);
  b.time(11000);
  check("slow: the status box says SLOW CONNECTION · STILL TRYING, the count stays in the fuse", b.el("loadmsg").textContent === "SLOW CONNECTION · STILL TRYING" && "data-slow" in b.el("load").attrs && parseFloat(b.el("lcl").style.strokeDasharray) > 0);
  b.time(31000);
  check("stall: the card, its line, the count under it and RETRY", "data-act" in b.el("load").attrs && !b.el("loadact").hidden && b.el("loadsub").textContent === "LOADING · 4 / 10 FILES" && !("data-fail" in b.el("load").attrs));
  b.L.fail("boot");
  check("failed: a coral headline, its second line, RETRY focused", b.el("loadmsg").textContent === "COULD NOT LOAD THE GAME." && b.el("loadsub").textContent === "CHECK YOUR CONNECTION, THEN RETRY." && "data-fail" in b.el("load").attrs && b.el("loadretry").focused);
  check("failed: the fuse goes out (no spark, a dark cord)", "data-out" in b.el("loadst").attrs && /^0 /.test(b.el("lcl").style.strokeDasharray));
}
{
  const b = run({ W: 1366, H: 768 });
  b.L.end("boot");
  b.L.begin("px", { label: "PIXEL", files: 2, total: 2, weigh: () => 1 });
  b.L.fail("px", () => {}, () => {});
  check("a look's failure card after boot keeps its one sentence (no second line)", b.el("loadsub").textContent === "" && /PIXEL COULD NOT LOAD/.test(b.el("loadmsg").textContent));
}
{
  const r3 = run({ W: 1366, H: 768, settings: { r3d: 1 } }), px0 = run({ W: 1366, H: 768, settings: { r3d: 1 }, search: "?render=px" }), u3 = run({ W: 1366, H: 768, search: "?render=3d" }), p = run({ W: 1366, H: 768, settings: { px: 1 } });
  check("REAL 3D (saved r3d, or ?render=3d) skips the floor: its board is tilted", "data-3d" in r3.el("loadst").attrs && "data-3d" in u3.el("loadst").attrs);
  check("?render=px beats a saved r3d, and PIXEL keeps the floor", !("data-3d" in px0.el("loadst").attrs) && !("data-3d" in p.el("loadst").attrs));
  check("the floor's skip is CSS on data-3d", /#loadst\[data-3d\] #lfl\{display:none\}/.test(css));
  const still = run({ W: 1366, H: 768, settings: { flx: 1 } }), rm = run({ W: 1366, H: 768, rm: true }), live = run({ W: 1366, H: 768 });
  check("REDUCE FLASH (saved flx) or prefers-reduced-motion: the spark holds its reduced frame", "data-still" in still.el("loadst").attrs && "data-still" in rm.el("loadst").attrs && !("data-still" in live.el("loadst").attrs));
  check("touch: the card's words are the phone size and no keycap shows", "data-t" in run({ W: 393, H: 852, touch: true }).el("load").attrs && !("data-t" in live.el("load").attrs) && /#load\[data-t\] kbd\{display:none\}/.test(css));
  const none = run({});
  check("no window size (Node, an odd host): the states still run, nothing is placed", none.L && none.el("lsg").style.left === undefined && none.el("loadmsg").textContent === "LOADING");
}
{
  const rule = (sel) => (new RegExp("(?:^|\\})\\s*" + sel + "\\{([^}]*)\\}").exec(css) || [])[1] || "";
  check("the stage is beside #load, before #wrap (boot only: the chip and the docked card keep #load's own box)", html.indexOf('<div id="loadst"') < html.indexOf('<div id="load"') && /#loadst\{[^}]*position:fixed/.test(css) && /pointer-events:none/.test(rule("#loadst")));
  check("it is hidden in markup (no JS, no stage) and appears with #load's 150 ms delay", /<div id="loadst" hidden/.test(html) && /150ms/.test(rule("#loadst")));
  check("the floor and the plate wear the kit tokens (no raw hex)", /var\(--k-fl0\)/.test(rule("#lfl")) && /var\(--k-fl1\)/.test(rule("#lfl")) && /var\(--k-bedA\)/.test(rule("#lpl")) && /var\(--k-bedB\)/.test(rule("#lpl")) && !/#[0-9a-f]{3,6}\b/i.test(rule("#lfl") + rule("#lpl") + rule("#lsg")));
  check("the fuse eases, and stops easing under prefers-reduced-motion", /transition:stroke-dasharray/.test(rule("#llg \\.cl")) && /prefers-reduced-motion:reduce\)\{[^@]*#llg \.cl\{transition:none\}/.test(css));
  check("no glow, blur or filter on the stage", !/filter|blur|drop-shadow/.test(css.slice(css.indexOf("#loadst{"), css.indexOf("#loadst{") + 4000)));
  const yel = (css.match(/#ffd447/gi) || []).length;
  check("yellow only inside the logo (FUSE's face, the spark's frame A)", /\.fF\{fill:#ffd447\}/.test(css) && /\.fa use\{fill:#ffd447\}/.test(css) && yel === 2, yel);
  check("the status box: the title prompt's backing (fill and edge), cream words, no keycap", /background:rgba\(7,10,18,\.9\)/.test(rule("#load\\[data-boot\\]")) && /border:1px solid var\(--line\)/.test(rule("#load\\[data-boot\\]")));
}

{
  /* the hand-off, game side: one flag read where the title paints (shellview), never main.js */
  const { settledTitle, titleReady } = await import("../src/render/shellview.js");
  check("settledTitle reads __load.lit(); no loader (a host, Node) is unsettled", settledTitle({ __load: { lit: () => true } }) === true && settledTitle({ __load: { lit: () => false } }) === false && settledTitle({}) === false);
  const app = { boardReady: true, readyT: 0.1 };
  check("settled: the title's board veil is at rest from its first frame (the loader's floor already stood there); unsettled it eases over 0.4 s; 3D still waits on three",
    titleReady(app, true) === 1 && near(titleReady(app, false), 0.25, 1e-9) && titleReady({ boardReady: false, readyT: 9 }, true) === 0);
  const sv = readFileSync(new URL("../src/render/shellview.js", import.meta.url), "utf8"), mn = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  check("shellview hands drawIntroChrome both from the one flag; main.js never reads it", /drawIntroChrome\([^;]*titleReady\(app, settled\)[^;]*settled \}\)/.test(sv) && !/\blit\b/.test(mn));
  const rule = (sel) => (new RegExp("(?:^|\\})\\s*" + sel + "\\{([^}]*)\\}").exec(css) || [])[1] || "";
  check("the boot card's RETRY and its ENTER keycap are at the card's size (20 px desk / 16 phone: the cap floors), label first", /font-size:var\(--fs\)/.test(rule("#load\\[data-boot\\] #loadact button")) && /font-size:var\(--fs\)/.test(rule("#load\\[data-boot\\] #loadretryk")) && /--fs:20px/.test(rule("#load\\[data-boot\\]")) && /--fs:16px/.test(rule("#load\\[data-t\\]")) && /<span id="loadretryw">RETRY<\/span><kbd id="loadretryk">/.test(html));
  check("the status box is as wide as its words (max-content: a fixed box centred at the window's middle would wrap them), never past the window", /width:max-content/.test(rule("#load\\[data-boot\\]")) && /max-width:calc\(100vw - 16px\)/.test(rule("#load\\[data-boot\\]")));
}

console.log("FIRST LOAD", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
