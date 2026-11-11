import { STRIP, FIT_RES, FIT_BASE, HUD_RES, PORT_GAME, PORT_GEO, PORT_SHELL, stripGeo, shellGeo, fitBox, mountFit, portraitGeo, pxBox, pxBack } from "../src/app/fit.js";

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
    JSON.stringify({ d: [40, 163], p: [16, 388], l: [332, 16] }) && JSON.stringify(FIT_BASE) === JSON.stringify({ d: [40, 48], p: [16, 250], l: [332, 16] }) && Object.isFrozen(FIT_BASE),
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

check("PORT_GEO is frozen: 60/190 menu split, 24 edge, 22 gap, pad 148..176; FIT_RES.p is the GAME stack (HUD plate, one bar row, the pad floor, the edge)",
  Object.isFrozen(PORT_GEO) && JSON.stringify(PORT_GEO) === JSON.stringify(
    { top: 60, bot: 190, edge: 24, gap: 22, pad: [148, 176], menu: 128, side: [6, 14], mid: 24 }) &&
    PORT_GAME.top + HUD_RES.p.gap + HUD_RES.p.bar + 8 + PORT_GEO.pad[0] + PORT_GEO.edge === FIT_RES.p[1],
  JSON.stringify(PORT_GEO));

for (const [W, H, g] of [
  [375, 812, { top: 250, pad: 176, padTop: 50 }],
  [390, 844, { top: 259, pad: 176, padTop: 60 }],
  [412, 915, { top: 285, pad: 176, padTop: 86 }],
  [375, 667, { top: 165, pad: 144, padTop: 22 }],
  [600, 700, { top: 60, pad: 144, padTop: 22 }],
  [768, 1024, { top: 182, pad: 144, padTop: 22 }],
]) {
  const got = portraitGeo(W, H, 600, 520);
  check(W + "x" + H + " portrait geometry " + JSON.stringify(g), JSON.stringify(got) === JSON.stringify(g), JSON.stringify(got));
}

check("PORT_GAME is frozen: GAME puts the stage at the HUD plate's foot (160), pad cap 176, 0.2s glide",
  Object.isFrozen(PORT_GAME) && JSON.stringify(PORT_GAME) === JSON.stringify({ top: 160, pad: 176, sd: "0.2s" }) &&
    PORT_GAME.top >= 44 + 8 && PORT_GAME.top >= PORT_GEO.top && PORT_GAME.pad >= PORT_GEO.pad[1],
  JSON.stringify(PORT_GAME));

// UI upgrade Task 8.1: GAME puts the stage at the HUD plate's foot (164) and docks the controls' band to the thumb zone; the band between holds the power-ups bar and the tip
for (const [W, H, g] of [
  [375, 812, { top: 160, pad: 176, padTop: 140 }],
  [390, 844, { top: 160, pad: 176, padTop: 159 }],
  [412, 915, { top: 160, pad: 176, padTop: 211 }],
  [375, 667, { top: 160, pad: 148, padTop: 56 }],
  [320, 568, { top: 160, pad: 148, padTop: 56 }],
  [600, 700, { top: 160, pad: 148, padTop: 56 }],
  [768, 1024, { top: 160, pad: 148, padTop: 56 }],
]) {
  const got = portraitGeo(W, H, 600, 520, true);
  check(W + "x" + H + " GAME geometry " + JSON.stringify(g), JSON.stringify(got) === JSON.stringify(g), JSON.stringify(got));
}

check("portraitGeo's game flag defaults off: the 4-arg call is the INTRO / MENU geometry",
  [[375, 812], [600, 700], [768, 1024]].every(([W, H]) =>
    JSON.stringify(portraitGeo(W, H, 600, 520)) === JSON.stringify(portraitGeo(W, H, 600, 520, false))));

{
  const sh = 520 * fitBox(375, 812, true, 600, 520).s, g = portraitGeo(375, 812, 600, 520);
  check("width-bound phone: the stage sits centred in the slack (INTRO / MENU bands equal within 1px)",
    Math.abs(g.top - (812 - g.top - sh)) <= 1, g.top + " / " + (812 - g.top - sh).toFixed(2));
  check("width-bound phone: the controls' band docks to the thumb zone, its bottom exactly edge above the viewport bottom",
    Math.abs(812 - (g.top + sh + g.padTop + g.pad) - PORT_GEO.edge) < 1,
    (812 - (g.top + sh + g.padTop + g.pad)).toFixed(2));
}

{
  const bad = [], worse = [];
  const G = PORT_GEO, low = HUD_RES.p.gap + HUD_RES.p.bar + 8;
  for (const game of [false, true]) for (let W = 300; W <= 1000; W += 3) for (let H = Math.max(W, 552); H <= 1400; H += 3) {
    const { s } = fitBox(W, H, true, 600, 520, game), sh = 520 * s;
    const g = portraitGeo(W, H, 600, 520, game), below = H - g.top - sh;
    const ok = g.top >= 44 + 8 && g.top >= G.top && below >= G.bot - 1e-9 &&
      g.padTop >= (game ? low : G.gap) && g.top + sh + g.padTop + g.pad <= H - G.edge + 1e-9 &&
      g.pad >= (game ? G.pad[0] : G.menu) && g.pad <= (game ? PORT_GAME.pad : G.pad[1]) && W >= STRIP.dpad + g.pad + 8 + 2 * 44 + 8 + STRIP.right &&
      Number.isInteger(g.top) && Number.isInteger(g.pad) && Number.isInteger(g.padTop);
    if (!ok && bad.length < 4) bad.push((game ? "GAME " : "MENU ") + W + "x" + H + " " + JSON.stringify(g));
    if (game) {
      const m = portraitGeo(W, H, 600, 520);
      if (!(g.top === PORT_GAME.top && (Math.abs(H - G.edge - (g.top + sh + g.padTop + g.pad)) < 1 || g.padTop === low) && g.pad >= Math.min(m.pad, PORT_GAME.pad)) && worse.length < 4)
        worse.push(W + "x" + H + " " + JSON.stringify(m) + " -> " + JSON.stringify(g));
    }
  }
  check("every portrait 300..1000 x 552..1400 (the shortest the GAME stack fits at the 0.3 scale floor), MENU and GAME: pill room above,"
    + " the controls' band under the board (gap >= 22; GAME >= one power-ups row), inside the viewport, pad 148..176 (MENU, hidden: 128..176), the strip fits across",
    bad.length === 0, bad.join(" | ") || "clean");
  check("GAME: the stage sits at the HUD plate's foot, the controls keep the thumb dock, and the pad is never smaller than MENU's",
    worse.length === 0, worse.join(" | ") || "clean");
}

check("STRIP is frozen: D-PAD 20 from the left, keys 10 apart (8 at the least, so a 148 pad keeps 44 keys); a 130 column 16 from the right, BOMB 90/176 of the band",
  Object.isFrozen(STRIP) && JSON.stringify(STRIP) === JSON.stringify({ dpad: 20, gap: 10, gapMin: 8, right: 16, col: 130, air: 4, row: 14, bomb: 90 / 176 }), JSON.stringify(STRIP));

{
  const a = stripGeo(393, 852, 600, 520), sx = (393 - 600 * fitBox(393, 852, true, 600, 520, true).s) / 2;
  check("393x852 (the round 5 phone frame): D-PAD 176 box, 52 keys 10 apart at x 20; BOMB 130x90 and THROW / REMOTE 61x64 halves at 16 from the right",
    a.pad.s === 176 && a.pad.key === 52 && a.pad.gap === 10 && Math.abs(a.pad.l + sx - 20) < 1e-9 && a.bomb.w === 130 && a.bomb.h === 90 &&
      Math.abs(a.bomb.r + sx - 16) < 1e-9 && a.thr.w === 61 && a.thr.h === 64 && a.rem.w === 61 && a.rem.r === a.bomb.r && a.thr.r === a.bomb.r + 69, JSON.stringify(a));
}

{
  const sep = (a, b, m) => a[2] + m <= b[0] + 1e-6 || b[2] + m <= a[0] + 1e-6 || a[3] + m <= b[1] + 1e-6 || b[3] + m <= a[1] + 1e-6;
  const bad = [];
  for (let W = 300; W <= 1000; W += 3) for (let H = Math.max(W, 552); H <= 1400; H += 3) {
    const { s } = fitBox(W, H, true, 600, 520, true), sw = 600 * s, sh = 520 * s, g = portraitGeo(W, H, 600, 520, true), A = stripGeo(W, H, 600, 520), sx = (W - sw) / 2;
    const vb = (o) => [sx + sw - o.r - o.w, g.top + sh + o.t, sx + sw - o.r, g.top + sh + o.t + o.h], T = vb(A.thr), R = vb(A.rem), B = vb(A.bomb);
    const P = [sx + A.pad.l, g.top + sh + A.pad.t, sx + A.pad.l + A.pad.s, g.top + sh + A.pad.t + A.pad.s], k = A.pad.key;
    const keys = [[k + A.pad.gap, 0], [0, k + A.pad.gap], [2 * (k + A.pad.gap), k + A.pad.gap], [k + A.pad.gap, 2 * (k + A.pad.gap)]].map(([x, y]) => [P[0] + x, P[1] + y, P[0] + x + k, P[1] + y + k]);
    const band = [0, g.top + sh, W, g.top + sh + HUD_RES.p.gap + HUD_RES.p.bar + 8];
    const inV = (q) => q[0] >= 4 && q[2] <= W - 4 && q[1] >= 4 && q[3] <= H - 4;
    const big = (q) => q[2] - q[0] >= 44 - 1e-9 && q[3] - q[1] >= 44 - 1e-9;
    const all = [T, R, B, P], ok = [...keys, T, R, B].every(big) && sep(T, R, 8) && sep(T, B, 8) && sep(R, B, 8) && [T, R, B].every((q) => sep(q, P, 8)) &&
      keys.every((q, i) => keys.every((o, j) => i === j || sep(q, o, 8))) && all.every((q) => inV(q) && sep(q, band, 0));
    if (!ok && bad.length < 4) bad.push(W + "x" + H + " " + JSON.stringify(A));
  }
  check("every GAME portrait 300..1000 x 552..1400: D-PAD keys, THROW, REMOTE and BOMB are >= 44px, 8px apart, off the board and the power-ups row, inside the viewport",
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
    const g = portraitGeo(375, 812, 600, 520), a = stripGeo(375, 812, 600, 520);
    check("touch portrait: mountFit writes --st from portraitGeo and the strip's D-PAD / BOMB vars from stripGeo",
      attrs["data-lay"] === "p" && props["--st"] === g.top + "px" && props["--tp"] === a.pad.s + "px" && props["--tpl"] === a.pad.l + "px" &&
        props["--tpt"] === a.pad.t + "px" && props["--tbw"] === a.bomb.w + "px" && props["--tbh"] === a.bomb.h + "px" &&
        props["--tbr"] === a.bomb.r + "px" && props["--tbt"] === a.bomb.t + "px",
      JSON.stringify(props));
    check("touch portrait: mountFit writes the THROW / REMOTE slots --taw/--tah/--tthr/--ttht/--trem/--tret from stripGeo",
      props["--taw"] === a.thr.w + "px" && props["--tah"] === a.thr.h + "px" && props["--tthr"] === a.thr.r + "px" && props["--ttht"] === a.thr.t + "px" &&
        props["--trem"] === a.rem.r + "px" && props["--tret"] === a.rem.t + "px", JSON.stringify(props));
    for (const k in props) delete props[k];
    win.innerWidth = 812; win.innerHeight = 375; fit();
    check("touch landscape writes no portrait vars (l / d rules never read them)",
      attrs["data-lay"] === "l" && Object.keys(props).length === 0, JSON.stringify(props));
    delete win.ontouchstart; win.innerWidth = 1280; win.innerHeight = 720; fit();
    check("desktop writes no portrait vars, and no HUD rows while the HUD is off (R2)", attrs["data-lay"] === "d" && Object.keys(props).length === 0, JSON.stringify(props));
    fit.hud(1);
    check("desktop with the HUD on writes only the HUD rows' --ht / --hb", JSON.stringify(props) === JSON.stringify({ "--ht": HUD_RES.d.top + "px", "--hb": HUD_RES.d.bot + "px" }), JSON.stringify(props));
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
}

{
  const props = {}, attrs = {}, obs = [];
  const tp = { hidden: true };
  const win = { ontouchstart: null, innerWidth: 375, innerHeight: 812, addEventListener() {} };
  globalThis.window = win;
  globalThis.MutationObserver = class { constructor(f) { this.f = f; } observe(el, o) { obs.push([el, o, this.f]); } };
  globalThis.document = { getElementById: (id) => (id === "touchpad" ? tp : null),
    body: { setAttribute(k, v) { attrs[k] = v; }, style: { setProperty(k, v) { props[k] = v; } } } };
  try {
    const cv = { width: 600, height: 520, style: {} };
    const fit = mountFit(cv);
    const m = portraitGeo(375, 812, 600, 520), g = portraitGeo(375, 812, 600, 520, true);
    check("mountFit observes #touchpad's hidden attribute only (no subtree), calling fit",
      obs.length === 1 && obs[0][0] === tp && obs[0][2] === fit && obs[0][1].attributes === true &&
        JSON.stringify(obs[0][1].attributeFilter) === '["hidden"]' && !obs[0][1].subtree, JSON.stringify(obs.map((o) => o[1])));
    check("hidden #touchpad (INTRO / MENU / ATTRACT): centred menu geometry, no glide",
      props["--st"] === m.top + "px" && props["--tp"] === m.pad + "px" && props["--sd"] === "0s", JSON.stringify(props));
    tp.hidden = false; obs[0][2]();
    const a = stripGeo(375, 812, 600, 520);
    check("#touchpad shown (GAME edge): game geometry, glided by --sd " + PORT_GAME.sd,
      props["--st"] === g.top + "px" && props["--tp"] === a.pad.s + "px" && props["--tbh"] === a.bomb.h + "px" &&
        props["--tpt"] === a.pad.t + "px" && props["--tbt"] === a.bomb.t + "px" && props["--sd"] === PORT_GAME.sd, JSON.stringify(props));
    fit();
    check("a re-fit inside GAME (resize, kind swap, pause toggling pad/bomb) keeps the game geometry with no glide",
      props["--st"] === g.top + "px" && props["--sd"] === "0s", JSON.stringify(props));
    win.innerWidth = 390; win.innerHeight = 844; fit();
    check("rotating / resizing mid-run lands on that viewport's GAME geometry",
      props["--st"] === portraitGeo(390, 844, 600, 520, true).top + "px" && props["--tpt"] === stripGeo(390, 844, 600, 520).pad.t + "px", JSON.stringify(props));
    tp.hidden = true; obs[0][2]();
    check("#touchpad hidden again (leaving GAME): back to the centred menu geometry, glided",
      props["--st"] === portraitGeo(390, 844, 600, 520).top + "px" && props["--sd"] === PORT_GAME.sd, JSON.stringify(props));
    for (const k in props) delete props[k];
    tp.hidden = false; win.innerWidth = 812; win.innerHeight = 375; fit();
    delete win.ontouchstart; win.innerWidth = 1280; win.innerHeight = 720; fit();
    check("landscape / desktop still write no portrait vars, even with #touchpad shown (no HUD rows while the HUD is off)",
      attrs["data-lay"] === "d" && Object.keys(props).length === 0, JSON.stringify(props));
  } finally {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.MutationObserver;
  }
}

{
  const tiny = [[200, 300], [0, 0], [240, 320]].flatMap(([W, H]) => [portraitGeo(W, H, 600, 520), portraitGeo(W, H, 600, 520, true)]);
  const st = [[200, 300], [0, 0], [240, 320]].map(([W, H]) => stripGeo(W, H, 600, 520));
  check("portraitGeo (MENU and GAME) on a tiny viewport never puts the controls over the board (padTop >= gap; the strip's keys below it)",
    tiny.every((g) => g.padTop >= PORT_GEO.gap) && st.every((a) => a.pad.t >= PORT_GEO.gap && a.bomb.t >= PORT_GEO.gap && a.thr.t >= PORT_GEO.gap), JSON.stringify(tiny));
}

{
  const cv = { width: 600, height: 520, style: {} }, fit = mountFit(cv);
  let threw = false; try { fit.setPxCap(1.5); fit.setPxCap(0); } catch (e) { threw = e; }
  check("headless: fit.setPxCap exists on the no-op fit and never throws", typeof fit.setPxCap === "function" && !threw && Object.keys(cv.style).length === 0, String(threw));
  const B = pxBox(829.25, 718.5, 2, 1, 1);
  check("pxBack: cap >= dpr (or none) is exactly the snapped backing; cap < dpr scales the same CSS content box",
    JSON.stringify(pxBack(B, 2, 2)) === JSON.stringify({ bw: B.bw, bh: B.bh }) && JSON.stringify(pxBack(B, 2, 3)) === JSON.stringify({ bw: B.bw, bh: B.bh }) &&
      JSON.stringify(pxBack(B, 2, Infinity)) === JSON.stringify({ bw: B.bw, bh: B.bh }) && JSON.stringify(pxBack(B, 2, 0)) === JSON.stringify({ bw: B.bw, bh: B.bh }) &&
      JSON.stringify(pxBack(B, 2, 1.5)) === JSON.stringify({ bw: Math.round(B.w * 1.5), bh: Math.round(B.h * 1.5) }) && pxBack(B, 2, 1).bw === Math.round(B.w), JSON.stringify(pxBack(B, 2, 1.5)));
}

for (const [lay, W, H, touch, dpr] of [["d", 1440, 900, false, 2], ["p", 390, 844, true, 3], ["l", 844, 390, true, 3]]) {
  const px = { style: {}, dataset: {}, hidden: false, getBoundingClientRect: () => ({ left: 12.37 + parseFloat(px.style.left || 0), top: 40.61 + parseFloat(px.style.top || 0) }) };
  const win = { innerWidth: W, innerHeight: H, addEventListener() {} };
  if (touch) win.ontouchstart = null;
  globalThis.window = win;
  globalThis.document = { getElementById: (id) => (id === "px" ? px : null), body: { setAttribute() {}, style: { setProperty() {} } } };
  globalThis.getComputedStyle = () => ({ borderLeftWidth: "1px", borderTopWidth: "1px" });
  globalThis.devicePixelRatio = dpr;
  try {
    const cv = { width: 600, height: 520, style: {} }, fit = mountFit(cv);
    const snap = () => JSON.stringify([px.style, px.dataset, cv.style]), box = () => JSON.stringify([px.style, cv.style]);
    const base = snap(), b0 = box(), bw0 = +px.dataset.bw, bh0 = +px.dataset.bh, cssW = parseFloat(px.style.width), cssH = parseFloat(px.style.height);
    fit.setPxCap(dpr);
    const same = snap() === base;
    fit.setPxCap(dpr + 1);
    const above = snap() === base;
    fit.setPxCap(1.5);
    check(lay + " dpr " + dpr + ": pxCap >= dpr is byte-identical to no cap (style, data-bw/bh, #c)", same && above, snap());
    check(lay + " dpr " + dpr + ": pxCap 1.5 re-fits at once with data-bw/bh = round(CSS content box x 1.5); the CSS box, origin and #c are identical (U2: density only)",
      box() === b0 && +px.dataset.bw === Math.round(cssW * 1.5) && +px.dataset.bh === Math.round(cssH * 1.5) && +px.dataset.bw < bw0 && +px.dataset.bw <= 1.5 * cssW + 0.5,
      px.dataset.bw + "x" + px.dataset.bh + " vs " + bw0 + "x" + bh0);
    fit.setPxCap(1);
    check(lay + " dpr " + dpr + ": pxCap 1 (RESOLUTION LOW) backs #px at its CSS size", +px.dataset.bw === Math.round(cssW) && box() === b0, px.dataset.bw);
    fit();
    check(lay + " dpr " + dpr + ": the cap survives a resize re-fit", +px.dataset.bw === Math.round(cssW), px.dataset.bw);
    fit.setPxCap(Infinity);
    check(lay + " dpr " + dpr + ": lifting the cap restores today's backing exactly", snap() === base, snap());
  } finally {
    delete globalThis.window; delete globalThis.document; delete globalThis.getComputedStyle; delete globalThis.devicePixelRatio;
  }
}

// shell box (polish 2026-10-19): touch portrait MENU + plated pages get their
// own logical box on #sh — the whole viewport at a scale that fits a
// 400..600-wide box into the stage's width, so a phone reads ~1.4x bigger;
// the logo line is the centred board's own 0.27; too short a viewport has none
check("PORT_SHELL is frozen: target scale 0.9, width clamp 400..600, logo 0.27 of the board",
  Object.isFrozen(PORT_SHELL) && JSON.stringify(PORT_SHELL) === JSON.stringify({ s: 0.9, w: [400, 600], logo: 0.27 }));
for (const [W, H, s, w] of [[393, 852, 0.9, 436], [390, 844, 0.9, 433], [360, 640, 0.86, 418], [430, 932, 0.9, 477], [768, 1024, 1.2533, 612]]) {
  const g = shellGeo(W, H, 600, 520), b = fitBox(W, H, true, 600, 520).s, top = portraitGeo(W, H, 600, 520).top;
  check(`shellGeo ${W}x${H}: scale ${s}, box ${w} wide, full viewport, logo on the centred board's 0.27 line`,
    !!g && Math.abs(g.s - s) < 0.002 && g.w === w && g.h === Math.floor(H / g.s) && g.left === 0 && g.top === 0 &&
      g.w * g.s <= W + 1e-9 && g.h * g.s <= H + 1e-9 && Math.abs(g.logo * g.s - (top + 1 + 0.27 * 520 * b)) < 1e-6 && g.s >= b - 1e-9, // a tablet keeps the board scale and only grows taller
    JSON.stringify(g));
}
check("shellGeo: no shell box when the viewport is under 520 box units tall", shellGeo(400, 420, 600, 520) === null && !!shellGeo(400, 470, 600, 520));

console.log("\n  FIT RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
