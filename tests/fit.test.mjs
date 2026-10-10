import { FIT_RES, PORT_GEO, fitBox, mountFit, portraitGeo } from "../src/app/fit.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") +
      name +
      (detail !== undefined ? " -> " + detail : ""),
  );
}

check("FIT_RES is frozen with the desktop / portrait / landscape reserves",
  Object.isFrozen(FIT_RES) && JSON.stringify(FIT_RES) ===
    JSON.stringify({ d: [40, 48], p: [16, 250], l: [332, 16] }),
  JSON.stringify(FIT_RES));

check("lay is d without touch, l for touch W>H, p for touch H>=W",
  fitBox(812, 375, false, 600, 520).lay === "d" &&
    fitBox(812, 375, true, 600, 520).lay === "l" &&
    fitBox(375, 812, true, 600, 520).lay === "p" &&
    fitBox(500, 500, true, 600, 520).lay === "p");

for (const [W, H, t, lay, s] of [
  [1440, 900, false, "d", 1.638],
  [1280, 720, false, "d", 1.292],
  [375, 812, true, "p", 0.598],
  [390, 844, true, "p", 0.623],
  [812, 375, true, "l", 0.69],
  [667, 375, true, "l", 0.558],
]) {
  const b = fitBox(W, H, t, 600, 520);
  check(W + "x" + H + (t ? " touch" : "") + " -> " + lay + " scale " + s,
    b.lay === lay && b.s.toFixed(3) === s.toFixed(3), b.lay + " " + b.s);
}

check("PORT_GEO is frozen: 60/190 split of FIT_RES.p, 24 edge, 22 gap, pad 128..176",
  Object.isFrozen(PORT_GEO) && JSON.stringify(PORT_GEO) === JSON.stringify(
    { top: 60, bot: 190, edge: 24, gap: 22, pad: [128, 176], side: [6, 14], mid: 24 }) &&
    PORT_GEO.top + PORT_GEO.bot === FIT_RES.p[1],
  JSON.stringify(PORT_GEO));

for (const [W, H, g] of [
  [375, 812, { top: 250, pad: 176, bomb: 99, padTop: 50, bombTop: 89 }],
  [390, 844, { top: 259, pad: 176, bomb: 99, padTop: 60, bombTop: 99 }],
  [412, 915, { top: 285, pad: 176, bomb: 99, padTop: 86, bombTop: 125 }],
  [375, 667, { top: 165, pad: 144, bomb: 81, padTop: 22, bombTop: 54 }],
  [600, 700, { top: 60, pad: 144, bomb: 81, padTop: 22, bombTop: 54 }],
  [768, 1024, { top: 182, pad: 144, bomb: 81, padTop: 22, bombTop: 54 }],
]) {
  const got = portraitGeo(W, H, 600, 520);
  check(W + "x" + H + " portrait geometry " + JSON.stringify(g), JSON.stringify(got) === JSON.stringify(g), JSON.stringify(got));
}

{
  const sh = 520 * fitBox(375, 812, true, 600, 520).s, g = portraitGeo(375, 812, 600, 520);
  check("width-bound phone: the stage sits centred in the slack (INTRO / MENU bands equal within 1px)",
    Math.abs(g.top - (812 - g.top - sh)) <= 1, g.top + " / " + (812 - g.top - sh).toFixed(2));
  check("width-bound phone: pad + bomb dock to the thumb zone, pad bottom exactly edge above the viewport bottom",
    Math.abs(812 - (g.top + sh + g.padTop + g.pad) - PORT_GEO.edge) < 1 &&
      g.bombTop + g.bomb / 2 === g.padTop + Math.round((g.pad - g.bomb) / 2) + g.bomb / 2,
    (812 - (g.top + sh + g.padTop + g.pad)).toFixed(2));
}

{
  const bad = [];
  const G = PORT_GEO;
  for (let W = 300; W <= 1000; W += 3) for (let H = Math.max(W, 460); H <= 1400; H += 3) {
    const { s } = fitBox(W, H, true, 600, 520), sw = 600 * s, sh = 520 * s;
    const g = portraitGeo(W, H, 600, 520), below = H - g.top - sh;
    const ok = g.top >= 44 + 8 && g.top >= G.top && below >= G.bot - 1e-9 &&
      g.padTop >= G.gap && g.bombTop >= G.gap && g.top + sh + g.padTop + g.pad <= H - G.edge + 1e-9 &&
      g.top + sh + g.bombTop + g.bomb <= H && g.pad >= G.pad[0] && g.pad <= G.pad[1] &&
      g.bomb === Math.round(g.pad * 9 / 16) && sw >= G.side[0] + g.pad + G.side[1] + g.bomb &&
      Number.isInteger(g.top) && Number.isInteger(g.pad) && Number.isInteger(g.padTop);
    if (!ok && bad.length < 4) bad.push(W + "x" + H + " " + JSON.stringify(g));
  }
  check("every portrait 300..1000 x 460..1400: pill room above, pad/bomb under the board"
    + " (gap >= 22), inside the viewport, pad 128..176, bomb 9/16 pad, no horizontal overlap",
    bad.length === 0, bad.join(" | ") || "clean");
}

check("scale floors at 0.3 and caps at 1.8",
  fitBox(200, 200, true, 600, 520).s === 0.3 &&
    fitBox(5000, 4000, false, 600, 520).s === 1.8);

{
  const cv = { width: 600, height: 520, style: {} };
  const fit = mountFit(cv);
  fit();
  check("headless (no window): mountFit returns a fit() that does nothing",
    typeof fit === "function" && Object.keys(cv.style).length === 0,
    JSON.stringify(cv.style));
}

{
  const hs = {};
  const attrs = {};
  const gl = { style: {} };
  const win = { ontouchstart: null, innerWidth: 812, innerHeight: 375,
    addEventListener(t, f) { (hs[t] = hs[t] || []).push(f); } };
  globalThis.window = win;
  globalThis.document = { getElementById: (id) => (id === "gl" ? gl : null),
    body: { setAttribute(k, v) { attrs[k] = v; } } };
  try {
    const cv = { width: 600, height: 520, style: {} };
    const fit = mountFit(cv);
    const s = fitBox(812, 375, true, 600, 520).s;
    check("mountFit sizes #c and #gl to 600s x 520s on mount",
      cv.style.width === 600 * s + "px" && cv.style.height === 520 * s + "px" &&
        gl.style.width === cv.style.width && gl.style.height === cv.style.height,
      cv.style.width + " " + cv.style.height);
    check("mountFit writes body data-lay=l on a touch landscape",
      attrs["data-lay"] === "l", attrs["data-lay"]);
    check("mountFit re-fits on resize AND orientationchange",
      (hs.resize || []).includes(fit) && (hs.orientationchange || []).includes(fit),
      Object.keys(hs).join());
    win.innerWidth = 375;
    win.innerHeight = 812;
    hs.orientationchange.forEach((f) => f());
    const p = fitBox(375, 812, true, 600, 520).s;
    check("rotating to 375x812 re-fits to portrait",
      attrs["data-lay"] === "p" && cv.style.width === 600 * p + "px",
      attrs["data-lay"] + " " + cv.style.width);
    cv.width = 608;
    cv.height = 352;
    fit();
    check("fit() reads the live canvas box (sizeCanvases swaps it per kind)",
      cv.style.width === 608 * fitBox(375, 812, true, 608, 352).s + "px",
      cv.style.width);
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
}

{
  const props = {}, attrs = {};
  const win = { ontouchstart: null, innerWidth: 375, innerHeight: 812, addEventListener() {} };
  globalThis.window = win;
  globalThis.document = { getElementById: () => null,
    body: { setAttribute(k, v) { attrs[k] = v; }, style: { setProperty(k, v) { props[k] = v; } } } };
  try {
    const cv = { width: 600, height: 520, style: {} };
    const fit = mountFit(cv);
    const g = portraitGeo(375, 812, 600, 520);
    check("touch portrait: mountFit writes --st/--tp/--tb/--tpt/--tbt from portraitGeo",
      attrs["data-lay"] === "p" && props["--st"] === g.top + "px" && props["--tp"] === g.pad + "px" &&
        props["--tb"] === g.bomb + "px" && props["--tpt"] === g.padTop + "px" && props["--tbt"] === g.bombTop + "px",
      JSON.stringify(props));
    for (const k in props) delete props[k];
    win.innerWidth = 812; win.innerHeight = 375; fit();
    check("touch landscape writes no portrait vars (l / d rules never read them)",
      attrs["data-lay"] === "l" && Object.keys(props).length === 0, JSON.stringify(props));
    delete win.ontouchstart; win.innerWidth = 1280; win.innerHeight = 720; fit();
    check("desktop writes no portrait vars", attrs["data-lay"] === "d" && Object.keys(props).length === 0, JSON.stringify(props));
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
}

{
  const tiny = [[200, 300], [0, 0], [240, 320]].map(([W, H]) => portraitGeo(W, H, 600, 520));
  check("portraitGeo on a tiny viewport never puts pad/bomb over the board (padTop, bombTop >= gap)",
    tiny.every((g) => g.padTop >= PORT_GEO.gap && g.bombTop >= PORT_GEO.gap), JSON.stringify(tiny));
}

console.log("\n  FIT RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
