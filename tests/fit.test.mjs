import { FIT_RES, fitBox, mountFit } from "../src/app/fit.js";

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

console.log("\n  FIT RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
