/* The loader's numbers for the lazy looks, DOM-free. index.html's inline
   window.__load owns the plate and the job math (it has to run before any module);
   tests/loadbar.test.mjs drives that script under a fake DOM and pins every number
   here and data-files there to the real import graphs:
   `node tests/loadbar.test.mjs --write` rewrites them after a graph change.
   Files count once finished (Resource Timing). `bigW` weighs a file by its bytes,
   so 18 small files of REAL 3D do not read as 95 % with 1.27 MB still to come. */
export const LOOK = Object.freeze({
  "3d": Object.freeze({ label: "REAL 3D", files: 19, re: /\/(render\/three\/|vendor\/three\.module\.js)/, big: /\/vendor\/three\.module\.js/, bigW: 120 }),
  px: Object.freeze({ label: "PIXEL", files: 26, re: /\/render\/(pixel\/|featpx)/ }),
});

export function lookPlan(k) {
  const L = LOOK[k];
  return {
    label: L.label,
    files: L.files,
    total: L.big ? L.files - 1 + L.bigW : L.files,
    weigh: (url) => (!L.re.test(url) ? 0 : L.big && L.big.test(url) ? L.bigW : 1),
  };
}

const rafOf = (raf) => raf || (typeof globalThis.requestAnimationFrame === "function" ? (f) => globalThis.requestAnimationFrame(f) : null);

/* Resolves once a frame has been given the chance to commit, so a compositor
   animation is running before the caller blocks the main thread. rAF never fires
   in a hidden tab, hence the timer. */
export function paintYield(raf, ms = 100) {
  return new Promise((res) => {
    const f = rafOf(raf);
    setTimeout(res, ms);
    if (f) f(() => setTimeout(res, 0));
  });
}

/* done() runs one frame after r's next render call: the first frame of a new build
   is the slow one (REAL 3D compiles there), and the gated loop may skip rAFs. The
   timer only covers a loop that never draws again (a stopped game). */
export function afterFirstRender(r, done, raf, ms = 3000) {
  let fin = false;
  const go = () => { if (!fin) { fin = true; done(); } };
  const r0 = r.render, f = rafOf(raf);
  setTimeout(go, ms);
  r.render = function (...a) {
    r.render = r0;
    const o = r0.apply(this, a);
    if (f) f(go); else go();
    return o;
  };
}
