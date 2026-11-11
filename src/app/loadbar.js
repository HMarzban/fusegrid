/* The loader's numbers for the lazy looks, DOM-free. index.html's inline
   window.__load owns the plate and the job math (it has to run before any module);
   tests/loadbar.test.mjs drives that script under a fake DOM and pins every number
   here and data-files there to the real import graphs:
   `node tests/loadbar.test.mjs --write` rewrites them after a graph change.
   Files count once finished (Resource Timing). `bigW` weighs a file by its bytes,
   so 18 small files of REAL 3D do not read as 95 % with 1.27 MB still to come. */
export const LOOK = Object.freeze({
  "3d": Object.freeze({ label: "REAL 3D", files: 21, re: /\/(render\/three\/|render\/logo\/draw3d\.js|vendor\/three\.module\.js)/, big: /\/vendor\/three\.module\.js/, bigW: 120 }),
  px: Object.freeze({ label: "PIXEL", files: 28, re: /\/render\/(pixel\/|featpx|hudart)/ }),
});

/* gen 3's tile code (src/app/lazyload.js): it loads in the title's first idle, so a run
   start waits behind this plate only on a link slower than the show */
export const TILES = Object.freeze({ label: "FLOOR TILES", files: 3, re: /\/core\/(board3|featplace|featchecks)\.js/, plate: true });

/* The lazy trees' own files (root-relative, sorted), pinned with the counts by
   `--write`: rcache fetches them first with plain fetch() (the HTTP / worker cache
   warms, nothing evaluates), and imports only in an idle state (v202). */
export const TREE = Object.freeze({
  "3d": Object.freeze(["src/render/logo/draw3d.js","src/render/three/ambientfx.js","src/render/three/blast.js","src/render/three/burstfx.js","src/render/three/entities.js","src/render/three/entityanim.js","src/render/three/featmesh.js","src/render/three/flythrough.js","src/render/three/gatebars.js","src/render/three/groundfx.js","src/render/three/lights.js","src/render/three/materials.js","src/render/three/particles.js","src/render/three/progpin.js","src/render/three/rimart.js","src/render/three/scene.js","src/render/three/textures.js","src/render/three/upload.js","src/render/three/wellfx.js","src/render/three/wrapper.js","vendor/three.module.js"]),
  px: Object.freeze(["src/render/featpx.js","src/render/featpxcells.js","src/render/hudart.js","src/render/pixel/ambient.js","src/render/pixel/anim.js","src/render/pixel/art/blast.js","src/render/pixel/art/bomb.js","src/render/pixel/art/feat.js","src/render/pixel/art/foes.js","src/render/pixel/art/fx.js","src/render/pixel/art/index.js","src/render/pixel/art/items.js","src/render/pixel/art/logo.js","src/render/pixel/art/mako.js","src/render/pixel/art/tiles.js","src/render/pixel/art/walls.js","src/render/pixel/atlas.js","src/render/pixel/entities.js","src/render/pixel/fallback.js","src/render/pixel/foegen.js","src/render/pixel/grid.js","src/render/pixel/manifest.js","src/render/pixel/oneshot.js","src/render/pixel/palette.js","src/render/pixel/renderer.js","src/render/pixel/snap.js","src/render/pixel/timing.js","src/render/pixel/world.js"]),
});

export function lookPlan(k, L = LOOK[k]) {
  return {
    label: L.label,
    files: L.files,
    urls: TREE[k],
    total: L.big ? L.files - 1 + L.bigW : L.files,
    weigh: (url) => (!L.re.test(url) ? 0 : L.big && L.big.test(url) ? L.bigW : 1),
    plate: !!L.plate,
  };
}

/* The look-load card for a pad's router (padroute.js): {live(padLast), press(id)} over the inline loader. A boot failure has no pad route. */
export function loadCard(host = globalThis) {
  return {
    live: (pad) => { const L = host.__load; return !!(L && L.padLive && L.padLive(pad)); },
    press: (id) => { const L = host.__load; if (L && L.padPress) L.padPress(id); },
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
