/* REAL 3D's wider desktop stage (owner pick 2026-11-14, veto 2 "REAL 3D near corners at the default zoom", option D: "BOLDER: WIDER 3D STAGE,
   rig untouched"). On d, #gl's content box is GL_WIDE x #c's, centred on it; the wrapper widens the camera's frame with it, so the board keeps
   its pixel size and the cabinet rim's near corners land on the canvas. p and l keep #c's box. Rig, lens, rim and presets never move. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three.module.js";
import { CFG, BIOMES } from "../src/core/config.js";
import { createWorld, loadLevel } from "../src/core/world.js";
import { GL_WIDE, glBox, fitBox, hudGeo, mountFit } from "../src/app/fit.js";
import { createRenderer3D, projBoard } from "../src/render/three/wrapper.js";
import { createRig, applyOrbit, CAM_FOV, CAM_PRESET } from "../src/render/three/camrig.js";
import { RIM_W, RIM_LIP } from "../src/render/three/scene.js";
import { stageGlow } from "../src/render/frame.js";
import { rec } from "./lib/textrec.mjs";
import { hudGeom, hudState } from "../src/render/hud.js";

const W = CFG.COLS * CFG.TILE, H = CFG.ROWS * CFG.TILE;

test("glBox: on d the content box is GL_WIDE x #c's, centred (about 42 CSS px a side at 1366x768); p and l keep #c's box", () => {
  assert.equal(GL_WIDE, 1.12);
  const s = fitBox(1366, 768, false, 600, 520, true).s, sw = 600 * s, G = glBox(sw, 1, "d", 1366);
  assert.equal(G.gk, GL_WIDE);
  assert.ok(Math.abs(G.w - 2 - GL_WIDE * (sw - 2)) < 1e-9, "content box x GL_WIDE");
  assert.ok(Math.abs(G.left + (G.w - sw) / 2) < 1e-9 && Math.abs(G.gx - (G.w - sw) / 2) < 1e-9, "centred on #c");
  assert.ok(G.gx > 41 && G.gx < 43, "about 42 CSS px a side: " + G.gx);
  for (const lay of ["p", "l"]) { const B = glBox(sw, 1, lay, 1366); assert.deepEqual([B.gk, B.w, B.left, B.gx], [1, sw, 0, 0], lay); }
  const N = glBox(1000, 1, "d", 1040); // a window too narrow for the whole widening: never past the viewport, never under 1
  assert.ok(N.gk > 1 && N.gk < GL_WIDE && Math.abs(N.w - 1040) < 1e-9, JSON.stringify(N));
  assert.equal(glBox(1000, 1, "d", 900).gk, 1);
});

test("hudGeo hands the HUD the overhang on d (gx), none on p / l", () => {
  for (const [W0, H0] of [[1366, 768], [1280, 720]]) {
    const g = hudGeo(W0, H0, 600, 520, "d", true);
    assert.ok(Math.abs(g.gx - glBox(g.stage.w, 1, "d", W0).gx) < 1e-9 && g.gx > 30, W0 + " " + g.gx);
  }
  assert.ok(!hudGeo(393, 852, 600, 520, "p", true).gx);
  assert.ok(!hudGeo(844, 390, 600, 520, "l", true).gx);
});

test("mountFit: d writes #gl's wider box and data-gk; a touch layout keeps #c's box and drops both", () => {
  const gl = { style: {}, dataset: {} }, attrs = {}, hs = {};
  const win = { innerWidth: 1366, innerHeight: 768, addEventListener(t, f) { (hs[t] = hs[t] || []).push(f); } };
  const g0 = { window: globalThis.window, document: globalThis.document, gcs: globalThis.getComputedStyle };
  globalThis.window = win;
  globalThis.document = { getElementById: (id) => (id === "gl" ? gl : null), body: { setAttribute(k, v) { attrs[k] = v; } } };
  globalThis.getComputedStyle = () => ({ borderLeftWidth: "1px", borderTopWidth: "1px" });
  try {
    const cv = { width: 600, height: 520, style: {} };
    const fit = mountFit(cv), s = fitBox(1366, 768, false, 600, 520).s, G = glBox(600 * s, 1, "d", 1366);
    assert.equal(attrs["data-lay"], "d");
    assert.equal(gl.style.width, G.w + "px");
    assert.equal(gl.style.left, G.left + "px");
    assert.equal(gl.style.height, cv.style.height);
    assert.equal(+gl.dataset.gk, GL_WIDE);
    assert.equal(cv.style.width, 600 * s + "px", "#c untouched");
    win.ontouchstart = null; win.innerWidth = 844; win.innerHeight = 390;
    fit();
    assert.equal(attrs["data-lay"], "l");
    assert.equal(gl.style.width, cv.style.width);
    assert.ok(!gl.style.left, "left reset");
    assert.ok(!("gk" in gl.dataset), "data-gk dropped");
  } finally { globalThis.window = g0.window; globalThis.document = g0.document; globalThis.getComputedStyle = g0.gcs; }
});

/* a stub canvas (no getContext: stub mode, no GL) that carries fit's data-gk */
const mk = (gk) => { const cv = { style: {}, dataset: gk ? { gk: String(gk) } : {} }; return { cv, r: createRenderer3D(cv, null, { audio: null }) }; };
const play = () => { const w = createWorld(9, 1); loadLevel(w, 1, false); w.state = "PLAY"; return w; };

test("wrapper: data-gk widens the camera's frame (fullWidth W x gk, aspect gk x W/H); none keeps W x H", () => {
  const a = mk(GL_WIDE), b = mk(0), w = play();
  a.r.render(w, 1 / 60); b.r.render(w, 1 / 60);
  const ca = a.r._dbg.camera, cb = b.r._dbg.camera;
  assert.ok(Math.abs(ca.view.fullWidth - W * GL_WIDE) < 1e-9 && Math.abs(ca.aspect - GL_WIDE * W / H) < 1e-12, ca.view.fullWidth + " " + ca.aspect);
  assert.ok(ca.view.fullHeight === H && ca.fov === CAM_FOV);
  assert.ok(cb.view.fullWidth === W && Math.abs(cb.aspect - W / H) < 1e-12);
  a.cv.dataset.gk = ""; a.r.render(w, 1 / 60); // fit dropped it (a narrow window): back to the board box
  assert.equal(a.r._dbg.camera.view.fullWidth, W);
});

test("wrapper: the drawing buffer follows the wider frame (three's setSize W x gk, H)", () => {
  const cv = { style: {}, dataset: { gk: String(GL_WIDE) }, getContext: () => ({}), addEventListener() {}, removeEventListener() {} };
  let g = null;
  const r = createRenderer3D(cv, null, { audio: null, makeGL: () => (g = { ratio: 1, domElement: { width: 0, height: 0 }, shadowMap: { enabled: false },
    setPixelRatio(d) { g.ratio = d; }, setSize(w0, h0) { g.domElement.width = Math.floor(w0 * g.ratio); g.domElement.height = Math.floor(h0 * g.ratio); },
    render() {}, compile: null, dispose() {}, forceContextLoss() {} }) });
  r.render(play(), 1 / 60);
  assert.equal(g.domElement.width, Math.floor(W * GL_WIDE * g.ratio));
  assert.equal(g.domElement.height, Math.floor(H * g.ratio));
});

test("projBoard: a board point lands on the same #c px at every gk (dolly and shake included)", () => {
  const cam = (gk, dist, sh) => { const c = new THREE.PerspectiveCamera(CAM_FOV, W / H, 1, 3000); c.setViewOffset(W * gk, H, 0, 0, W * gk, H); const st = createRig(); st.dist = dist; applyOrbit(c, st, sh); c.updateMatrixWorld(true); return c; };
  let worst = 0;
  for (const dist of [...CAM_PRESET, 1200, 2400]) for (const sh of [{ x: 0, y: 0 }, { x: 7, y: -4 }]) {
    const a = cam(1, dist, sh), b = cam(GL_WIDE, dist, sh);
    for (let x = -60; x <= W + 60; x += 30) for (let y = -60; y <= H + 60; y += 26) for (const h of [0, 24, 60]) {
      const p = projBoard(a, x, y, h), q = projBoard(b, x, y, h);
      worst = Math.max(worst, Math.abs(p.x - q.x), Math.abs(p.y - q.y));
    }
  }
  assert.ok(worst < 1e-9, "worst " + worst);
  const bare = new THREE.PerspectiveCamera(CAM_FOV, W / H, 1, 3000); applyOrbit(bare, createRig(), { x: 0, y: 0 });
  assert.ok(Math.abs(projBoard(bare, W / 2, H / 2).x - projBoard(cam(1, CAM_PRESET[0], { x: 0, y: 0 }), W / 2, H / 2).x) < 1e-9, "a camera with no view reads aspect x H");
  const r = mk(GL_WIDE).r; r.render(play(), 1 / 60); // the live renderer's proj (HUD tile tips, pickup labels) on its widened camera
  const one = mk(0).r; one.render(play(), 1 / 60);
  for (const [x, y] of [[0, 0], [W, H], [W / 2, H / 3], [37, 401]]) { const p = r.proj(x, y, 0), q = one.proj(x, y, 0); assert.ok(Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9, x + "," + y); }
});

test("the near corners are ON the wider canvas at every preset: bezel |ndc| <= 0.97 at STANDARD, the board's own box framing unchanged", () => {
  const at = (gk, dist) => {
    const c = new THREE.PerspectiveCamera(CAM_FOV, W / H, 1, 3000); c.setViewOffset(W * gk, H, 0, 0, W * gk, H);
    const st = createRig(); st.dist = dist; applyOrbit(c, st, { x: 0, y: 0 }); c.updateMatrixWorld(true);
    let bez = 0, px = 0, py = 0;
    for (const b of BIOMES) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      for (const y of [0, b.hWall + RIM_LIP]) { const v = new THREE.Vector3(sx * (W / 2 + RIM_W), y, sz * (H / 2 + RIM_W)).project(c); bez = Math.max(bez, Math.abs(v.x), Math.abs(v.y)); }
      for (const y of [0, b.hWall]) { const v = new THREE.Vector3(sx * W / 2, y, sz * H / 2).project(c); px = Math.max(px, Math.abs(v.x)); py = Math.max(py, Math.abs(v.y)); }
    }
    return { bez, px, py };
  };
  const one = at(1, CAM_PRESET[0]), wide = at(GL_WIDE, CAM_PRESET[0]);
  assert.ok(one.bez > 1, "the board box still crops the near corners (p / l): " + one.bez);
  assert.ok(wide.bez <= 0.97, "STANDARD bezel on the wider canvas: " + wide.bez);
  assert.ok(Math.abs(wide.px * GL_WIDE - one.px) < 1e-9 && Math.abs(wide.py - one.py) < 1e-9, "the board's x is the old x / gk, y unchanged: same pixels");
  for (const d of CAM_PRESET) assert.ok(at(GL_WIDE, d).bez <= 0.97, "preset " + d);
  assert.ok(at(GL_WIDE, 1473.54).bez <= 1, "the dolly-in limit of the old 1.10 ceiling stays on the canvas");
});

test("the frame: #gl wears the glow on the wider stage, index.html drops #c's frame while #gl shows wide", () => {
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /#gl\[data-gk\]:not\(\[hidden\]\)~#c\{border-color:transparent;box-shadow:none!important\}/);
  const a = mk(GL_WIDE); a.r.render(play(), 1 / 60);
  assert.match(a.cv.style.boxShadow || "", /64px/, "the biome glow on #gl");
  const b = mk(0); b.r.render(play(), 1 / 60);
  assert.ok(!b.cv.style.boxShadow, "p / l: #gl keeps its CSS shadow, the glow stays #c's");
  const el = { style: {} };
  stageGlow(el, 3); assert.ok(el.style.boxShadow);
  stageGlow(el, null); assert.equal(el.style.boxShadow, "");
  const el2 = { style: { boxShadow: "keep" } }; stageGlow(el2, null); assert.equal(el2.style.boxShadow, "keep", "null only takes back a glow it put on");
});

test("HUD: in REAL 3D the tile tip and its leader's knee clear the wider stage; other looks keep today's column", () => {
  for (const [W0, H0] of [[1366, 768], [1280, 720]]) {
    const geo = hudGeo(W0, H0, 600, 520, "d", true), w = play(), st = hudState(w, { time: { t: 3 } });
    st.tip = { s: "CONVEYOR · It carries you along.", short: "", a: 1, t: [13, 6] };
    const at = [geo.stage.x + 13.5 * CFG.TILE * geo.s, geo.stage.y + 6.5 * CFG.TILE * geo.s];
    const G3 = hudGeom(rec().ctx, geo, st, { w: W0, h: H0, at, gx: geo.gx }), G2 = hudGeom(rec().ctx, geo, st, { w: W0, h: H0, at });
    const left = geo.stage.x, right = left + geo.stage.w, side = (b, gx) => Math.abs(b.x - (right + gx + 30)) < 1e-6 || Math.abs(b.x + b.w - (left - gx - 30)) < 1e-6; // beside the board, either side
    assert.ok(G3.tip && side(G3.tip.box, geo.gx), W0 + " 3d tip " + JSON.stringify(G3.tip && G3.tip.box) + " stage " + left + ".." + right + " gx " + geo.gx);
    assert.ok(G2.tip && side(G2.tip.box, 0), W0 + " 2d tip unchanged");
    const knee = G3.tip.lead && G3.tip.lead.length > 2 ? G3.tip.lead[1][0] : null;
    if (knee != null) assert.ok(knee >= right + geo.gx || knee <= left - geo.gx, "knee off the 3D strip");
  }
});
