// PIXEL engine: pure modules (anim / snap / oneshot / renderkind / flags),
// the native draw through the Node RGBA shim, the sharp-bilinear blit chain,
// the CLASSIC 2D call-log pin, and import hygiene.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CFG, T, key } from "../src/core/config.js";
import { createWorld, loadLevel, step, newIntent } from "../src/core/sim.js";
import { spawnEnemy } from "../src/core/entities.js";
import { createGame } from "../src/main.js";
import { pxBox, pxQuant, snapOff, mountFit, fitBox } from "../src/app/fit.js";
import { heatProfile } from "../src/core/heat.js";
import { readFlags } from "../src/app/flags.js";
import { kindOf, bootRender, renderBits, renderVal } from "../src/app/renderkind.js";
import { snapArt, evenShake, pxM, finalMatrix, kOf } from "../src/render/pixel/snap.js";
import { PX_T } from "../src/render/pixel/timing.js";
import { facingOf, walkStep, newWalk, isIdle, bladeAgeFrame, bladePieces, bladeScratch, fuseFrame, bombFps, animClock, newClock, popFrame, F_FRONT, F_BACK, F_RIGHT, F_LEFT, P_CROSS, P_STRAIGHT, P_END } from "../src/render/pixel/anim.js";
import { createOneShots, feedShot, shotFrame, OS, OS_DUR } from "../src/render/pixel/oneshot.js";
import { createAtlas } from "../src/render/pixel/atlas.js";
import { createView, resetView, drawPixelWorld } from "../src/render/pixel/world.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { GHOST_A } from "../src/render/sprites.js";
import { createRGBA, surfRGBA, nearest as nearestRGBA, bilinear as bilinearRGBA } from "../tools/pixel/rgba.mjs";
import { stageWorld } from "../tools/pixel/board.mjs";
import { classicHash } from "./lib/classichash.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

// ---- renderkind + flags ----
{
  check("flags: ?render=px is a URL kind; ?render=4d still null",
    readFlags("?render=px").urlKind === "px" && readFlags("?render=4d").urlKind === null);
  const M = [["iso", {render3d: true, pixel: true}, "iso"], ["px", {render3d: true}, "px"], [null, {render3d: true, pixel: true}, "3d"],
    [null, {pixel: true}, "px"], [null, {}, "2d"], ["3d", {render3d: false}, "2d"], ["3d", {render3d: true}, "3d"]];
  check("kindOf precedence: iso > px (URL pins, staging) > r3d > px > 2d",
    M.every(([u, a, k]) => kindOf(u, a) === k), M.map(([u, a]) => kindOf(u, a)).join());
  const b = (u, o, s) => JSON.stringify(bootRender(u, o, s));
  check("bootRender: URL 3d|px wins, then r3d over px, old blob unchanged",
    b("3d", {}, {px: 1}) === '{"render3d":true,"pixel":false}' && b("px", {}, {r3d: 1}) === '{"render3d":false,"pixel":true}'
    && b(null, {}, {r3d: 1, px: 1}) === '{"render3d":true,"pixel":false}' && b(null, {}, {px: 1}) === '{"render3d":false,"pixel":true}'
    && b(null, {}, {r3d: 0}) === '{"render3d":false,"pixel":false}' && b(null, {render3d: true}, {}) === '{"render3d":true,"pixel":false}');
  check("renderBits/renderVal round-trip 0 CLASSIC, 1 PIXEL, 2 REAL 3D (clamped)",
    [0, 1, 2].every((v) => { const r = renderBits(v); return renderVal({render3d: !!r.r3d, pixel: !!r.px}) === v; })
    && renderBits(9).r3d === 1 && renderBits(-1).r3d === 0 && renderBits(-1).px === 0);
}

// ---- snap ----
{
  check("snapArt maps logical to whole art px", snapArt(20) === 10 && snapArt(41) === 21 && snapArt(-3) === -1);
  const sh = [-7.3, -3, -1, 0, 0.9, 1, 3, 5.5, 8.1].map(evenShake);
  check("shake snaps to even logical px", sh.every((v) => Number.isInteger(v) && v % 2 === 0), sh.join());
  check("pxM = clamp(ceil(k*z),1,8), floor only when k*z is whole or below 1",
    pxM(2.77, 1) === 3 && pxM(3.77, 1) === 4 && pxM(6.55, 1) === 7 && pxM(6.55, 2.5) === 8 && pxM(0.4, 1) === 1 && pxM(2.77, 1.12) === 4
    && pxM(3, 1) === 3 && pxM(3 + 1e-12, 1) === 3 && pxM(1.5, 2) === 3 && pxM(1, 1) === 1 && pxM(2.76, 0) === 3);
  let ok = true, worst = 0;
  for (let kz = 1; kz <= 8; kz += 0.0137) { const r = kz / pxM(kz, 1); worst = Math.max(worst, r); if (!(r > 0.5 && r <= 1 + 1e-12)) ok = false; }
  check("the smooth step is a DOWNscale: k*z/M in (0.5,1] for k*z in [1,8] (soft edge <= 1 device px)", ok, worst);
  check("past the cap (k*z > 8) the ratio is above 1 again (disclosed, not gated)", 9 / pxM(9, 1) > 1);
  const soft = (k, M) => { const img = createRGBA(30, 1); for (let x = 0; x < 30; x++) { const v = x & 1 ? 255 : 0; img.data.set([v, v, v, 255], x * 4); } const h = nearestRGBA(img, M), W = Math.round(30 * k), o = bilinearRGBA(h, W, 1);
    let worstN = 0; for (let j = 1; j < 30; j++) { const a = Math.floor((j - 0.5) * k), b = Math.floor((j + 0.5) * k); let n = 0; for (let x = a + 1; x < b; x++) { const v = o.data[x * 4]; if (v > 3 && v < 252) n++; } worstN = Math.max(worstN, n); } return worstN; };
  const ks = [2.39, 2.76, 3.75, 4.35, 5.36, 6.54], sp = ks.map((k) => [soft(k, Math.floor(k)), soft(k, pxM(k, 1))]);
  check("checker through the chain: floor M softens 2 device px per edge, pxM's ceil M at most 1 (k " + ks.join("/") + ")",
    sp.every(([, c]) => c <= 1) && sp.some(([f]) => f >= 2), JSON.stringify(sp));
  const m = finalMatrix([0, 0, 0, 0, 0, 0], 829, 718, {a: 1, b: 0, c: 0, d: 1, e: 0.4, f: 0}, 2, -2, 2);
  check("finalMatrix: device scale * 2/M, translation rounded to device px",
    Math.abs(m[0] - 829 / 600) < 1e-9 && m[1] === 0 && Number.isInteger(m[4]) && Number.isInteger(m[5]), m.join());
}

// ---- anim ----
{
  check("facingOf: axis-dominant, 3/4-left distinct from right",
    facingOf(1, 0) === F_RIGHT && facingOf(-1, 0) === F_LEFT && facingOf(0, -1) === F_BACK && facingOf(0, 1) === F_FRONT && facingOf(0, 0, F_LEFT) === F_LEFT);
  check("facingOf: diagonal hysteresis keeps a compatible facing",
    facingOf(1, 1, F_FRONT) === F_FRONT && facingOf(1, 1, F_RIGHT) === F_RIGHT && facingOf(1, 1, F_BACK) === F_RIGHT && facingOf(-1, -1, F_BACK) === F_BACK);
  const run = (hz, speed, secs = 1) => { const st = newWalk(); walkStep(st, 0, 0, 0); const n = Math.round(hz * secs); for (let i = 1; i <= n; i++) walkStep(st, (speed * i) / hz, 0, 1 / hz); return st; };
  const ns = [30, 60, 120].map((hz) => run(hz, 136).n);
  check("walk phases by DISTANCE: same count at 30/60/120 Hz (NORM 136 px/s)", ns.every((n) => n === 13), ns.join());
  const fast = [60, 120].map((hz) => run(hz, 400).n);
  check("walk rate capped at WALK_FPS_MAX (" + PX_T.WALK_FPS_MAX + ")", fast.every((n) => n <= PX_T.WALK_FPS_MAX + 1), fast.join());
  const st = run(60, 136, 0.5);
  let k = 0;
  while (!isIdle(st) && k < 20) { walkStep(st, st.x, 0, 1 / 60); k++; }
  check("idle within " + PX_T.IDLE_TICKS + " ticks of stopping", k === PX_T.IDLE_TICKS, k);
  const st2 = run(60, 136, 0.5), f0 = st2.f;
  for (let i = 0; i < 120; i++) walkStep(st2, st2.x + 3, 0, 0);
  check("dt 0 (PAUSE) never advances a walk phase", st2.f === f0);
  const ages = []; for (let a = 0; a < 1; a += 0.01) ages.push(bladeAgeFrame(a));
  check("blade ages cover [0,ttl) monotonic with no gap (cuts " + PX_T.BLADE_CUTS.join("/") + ")",
    ages[0] === 0 && ages[ages.length - 1] === 3 && ages.every((v, i) => !i || v === ages[i - 1] || v === ages[i - 1] + 1));
  const w = {blades: [{t: 0.2, ttl: 0.34, tiles: [{tx: 5, ty: 5}, {tx: 6, ty: 5}, {tx: 7, ty: 5}, {tx: 4, ty: 5}]}, {t: 0.02, ttl: 0.34, tiles: [{tx: 6, ty: 5}, {tx: 6, ty: 4}, {tx: 6, ty: 6}]}]};
  const sc = bladeScratch(), n = bladePieces(w, sc), at = (x, y) => sc.out.slice(0, n).find((o) => o.x === x && o.y === y);
  check("crossing blades: union, younger age wins at the crossing", n === 6 && Math.abs(at(6, 5).a - 0.02 / 0.34) < 1e-6, n);
  check("blade pieces: crossing = CROSS, arm = STRAIGHT, tips = END with rotation",
    at(6, 5).p === P_CROSS && at(5, 5).p === P_STRAIGHT && at(5, 5).r === 0 && at(7, 5).p === P_END && at(7, 5).r === 0
    && at(4, 5).p === P_END && at(4, 5).r === 2 && at(6, 4).p === P_END && at(6, 4).r === 3 && at(6, 6).r === 1);
  const fus = [2.5, 2.3, 2.1].map((F) => [fuseFrame(F, F), fuseFrame(F * 0.5, F), fuseFrame(0, F), bombFps(F * 0.15, F)]);
  check("fuse stages 0..3 and tempo 12 fps at f=0.85 for every heat",
    [0, 1, 2].every((h) => heatProfile(h).fuse > 0) && fus.every((r) => r[0] === 0 && r[1] === 2 && r[2] === 3 && r[3] === 12), JSON.stringify(fus));
  check("pop maps to the 3 materialize frames, then idle",
    popFrame(0.1) === 0 && popFrame(0.5) === 1 && popFrame(0.9) === 2 && popFrame(1) === -1 && popFrame(1.08) === -1);
  const W = createWorld(7, 1); loadLevel(W, 1); W.state = "PLAY";
  const clk = newClock(); animClock(clk, W);
  for (let i = 0; i < 30; i++) { step(W, CFG.STEP, {0: newIntent()}); animClock(clk, W); }
  const tPlay = clk.t;
  W.state = "PAUSE";
  for (let i = 0; i < 120; i++) { step(W, CFG.STEP, {0: newIntent()}); animClock(clk, W); }
  check("animClock advances in PLAY and is frozen across 120 PAUSE ticks", Math.abs(tPlay - 0.5) < 1e-6 && clk.t === tPlay, tPlay + " " + clk.t);
  W.state = "PLAY"; animClock(clk, W); const t1 = clk.t; W.time += 1.5; animClock(clk, W);
  check("animClock clamps a long frame to DT_MAX instead of dropping it", Math.abs(clk.dt - PX_T.DT_MAX) < 1e-9 && Math.abs(clk.t - t1 - PX_T.DT_MAX) < 1e-9, clk.dt);
  const V0 = createView({}); V0.pw = newWalk(); V0.pw.init = true; resetView(V0);
  check("resetView drops MAKO's walk state too (RENDER flip / new grid)", V0.pw === null);
}

// ---- one-shots ----
{
  check("brick crumble <= 340 ms", OS_DUR[OS.CRUMBLE] <= 0.34, OS_DUR[OS.CRUMBLE]);
  const s = createOneShots(8);
  const w = {players: [{x: 60, y: 60, alive: true}]};
  feedShot(s, {t: "hurt", x: 300, y: 300}, w, 0);
  check("a respawning hurt leaves a corpse and a materialize", !!s.live(OS.CORPSE) && !!s.live(OS.MAT) && s.count() === 2);
  s.reset();
  feedShot(s, {t: "hurt", x: 60, y: 60}, w, 0);
  check("a shield break (player did not move) leaves no corpse", s.count() === 0);
  feedShot(s, {t: "brick", x: 100, y: 100}, w, 0);
  const o = s.live(OS.CRUMBLE);
  check("crumble frames step every CRUMBLE_MS then expire", shotFrame(o, 0) === 0 && shotFrame(o, 0.085) === 1 && shotFrame(o, 0.3) === 3);
  s.expire(0.33);
  check("expired one-shots free their slot", s.count() === 0);
  for (let i = 0; i < 20; i++) feedShot(s, {t: "brick", x: i, y: 0}, w, i);
  check("the pool never grows past its cap (no per-event allocation)", s.pool.length === 8 && s.count() === 8);
  s.reset();
  feedShot(s, {t: "power", x: 220, y: 140, kind: "flame", col: "#ff6b3d"}, w, 0);
  const sp = s.live(OS.SPARKLE);
  check("a pickup grab leaves a 3-frame sparkle where the item stood",
    !!sp && sp.x === 220 && sp.y === 140 && shotFrame(sp, 0) === 0 && shotFrame(sp, PX_T.SPARKLE_MS / 1000 + 1e-3) === 1 && shotFrame(sp, 1) === PX_T.SPARKLE_N - 1 && OS_DUR[OS.SPARKLE] === PX_T.SPARKLE_MS * PX_T.SPARKLE_N / 1000);
}

// ---- native draw through the RGBA shim ----
const atlas = createAtlas(surfRGBA);
function fatWorld() {
  const w = createWorld(4242, 8); loadLevel(w, 8);
  const V = createView(atlas); V.shots = createOneShots(); V.t = 0.5;
  stageWorld(w, "all", V);
  return {w, V};
}
{
  const {w, V} = fatWorld();
  const img = createRGBA(300, 260), c = img.getContext();
  c.imageSmoothingEnabled = false;
  const n = drawPixelWorld(c, w, V);
  const di = c.calls.filter((q) => q[0] === "drawImage");
  check("fat world: every native blit lands on an integer art px", di.length > 200 && di.every((q) => Number.isInteger(q[1]) && Number.isInteger(q[2])), di.length);
  check("fat world: every fx square is integer", c.calls.filter((q) => q[0] === "fillRect").every((q) => q.slice(1).every(Number.isInteger)));
  check("fat world: <= 600 drawImage calls per frame", n <= 600 && n === di.length, n);
  const g = di.filter((q) => q[4] === GHOST_A);
  check("ghost = MAKO frames at blit alpha GHOST_A " + GHOST_A, g.length === 1);
  check("no blit runs with smoothing on at the native stage", di.every((q) => q[3] === false));
  const V2 = createView(atlas); V2.pop = 0;
  const c2 = createRGBA(300, 260).getContext(); drawPixelWorld(c2, w, V2);
  const V3 = createView(atlas); V3.pop = 0.5;
  const c3 = createRGBA(300, 260).getContext(); drawPixelWorld(c3, w, V3);
  const matF = atlas.mako(w.players[0].color, !!w.players[0].kick).mat[1].im;
  check("show pop: 0 hides MAKO, 0.5 blits materialize frame 1 (never a cell scale)",
    c3.calls.length === c2.calls.length + 3 && c3.calls.some((q) => q[5] === matF), c2.calls.length + " " + c3.calls.length);
  let nearWhite = 0;
  for (const im of [...atlas.mako(null, false).mat, ...atlas.mako(null, false).death, ...atlas.mako(null, false).corpse].map((f) => f.im)) {
    let on = 0, wh = 0;
    for (let i = 0; i < im.data.length; i += 4) if (im.data[i + 3]) { on++; if (im.data[i] > 235 && im.data[i + 1] > 235 && im.data[i + 2] > 235) wh++; }
    if (on && wh / on > 0.25) nearWhite++;
  }
  check("REDUCE FLASH: no MAKO one-shot frame is a near-white full-sprite flash", nearWhite === 0, nearWhite);
}

// ---- delivered means drawn: SHADE hem and the pickup sparkle reach the board ----
{
  const w = createWorld(4242, 7); loadLevel(w, 7); w.state = "PLAY";
  w.enemies.length = 0;
  w.enemies.push(spawnEnemy("shade", 7, 5, 7, null));
  const V = createView(atlas); V.shots = createOneShots(); V.t = 0.1;
  feedShot(V.shots, {t: "power", x: 140, y: 100, kind: "flame", col: "#ff6b3d"}, w, 0);
  const c = createRGBA(300, 260).getContext(); drawPixelWorld(c, w, V);
  const srcs = c.calls.filter((q) => q[0] === "drawImage").map((q) => q[5]);
  const sh = atlas.foe.shade, hemAt = srcs.indexOf(sh.extra.im), floatAt = Math.max(srcs.indexOf(sh.still[0].im), srcs.indexOf(sh.still[1].im));
  check("SHADE's hem (manifest foes/shade.hem) is blitted, over its float frame", hemAt >= 0 && floatAt >= 0 && hemAt > floatAt, hemAt + " " + floatAt);
  check("the pickup sparkle (manifest fx/sparkle0-2) is blitted at its frame", srcs.includes(atlas.fx.sparkle[1].im));
}

// ---- the px renderer: blit chain, overlay, reset ----
function recCanvas(w, h, log, tag) {
  const cv = {width: w, height: h, clientWidth: 0, clientHeight: 0, tf: null};
  const ctx = {imageSmoothingEnabled: true, imageSmoothingQuality: "high", globalAlpha: 1, fillStyle: "#000",
    getTransform: () => cv.tf || {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0},
    putImageData() {}};
  for (const k of ["save", "restore", "translate", "scale", "rotate", "fillRect", "strokeRect", "clearRect", "beginPath", "closePath", "moveTo", "lineTo", "arc", "arcTo", "bezierCurveTo", "quadraticCurveTo", "fill", "stroke", "ellipse", "transform", "fillText", "strokeText", "setLineDash", "rect", "clip", "measureText"])
    ctx[k] = (...a) => { log.push([tag, k, a, ctx.imageSmoothingEnabled]); return k === "measureText" ? {width: 10} : undefined; };
  ctx.setTransform = (...a) => log.push([tag, "setTransform", a]);
  ctx.drawImage = (src, ...a) => log.push([tag, "drawImage", a, ctx.imageSmoothingEnabled, src && src.tag, ctx.imageSmoothingQuality]);
  ctx.createLinearGradient = () => ({addColorStop() {}});
  ctx.createRadialGradient = () => ({addColorStop() {}});
  cv.getContext = () => ctx;
  cv.tag = tag;
  return cv;
}
{
  const log = [];
  let n = 0;
  const mk = (w, h) => recCanvas(w, h, log, ["probe", "native", "hi"][n++] || "x");
  const px = recCanvas(600, 520, log, "px"); px.clientWidth = 829; px.clientHeight = 718;
  const ov = recCanvas(600, 520, log, "ov");
  const r = createPixelRenderer(px, ov, {mkCanvas: mk, surf: surfRGBA});
  check("surface mirrors the wrapper contract (+ reset)", ["canvas", "overlay", "ctx", "render", "consumeEvents", "getShake", "reset"].every((k) => k in r) && r.canvas === px && r.overlay === ov);
  const w = createWorld(4242, 1); loadLevel(w, 1); w.state = "PLAY";
  log.length = 0;
  r.render(w, CFG.STEP, {hud: true});
  const nat = log.filter((q) => q[0] === "native" && q[1] === "drawImage");
  check("native stage: smoothing off on every blit", nat.length > 100 && nat.every((q) => q[3] === false), nat.length);
  const hi = log.filter((q) => q[0] === "hi" && q[1] === "drawImage");
  check("hi stage: one NEAREST blit of the native board at integer M=3 (k 2.76)", hi.length === 1 && hi[0][3] === false && hi[0][4] === "native" && hi[0][2][2] === 900 && hi[0][2][3] === 780, JSON.stringify(hi.map((q) => q[2])));
  const fin = log.filter((q) => q[0] === "px" && q[1] === "drawImage");
  const st = log.filter((q) => q[0] === "px" && q[1] === "setTransform").map((q) => q[2]);
  check("final stage: one SMOOTH blit of hi into #px at device px, smoothing quality low (no mipmap filter)", fin.length === 1 && fin[0][3] === true && fin[0][4] === "hi" && fin[0][5] === "low" && st.some((m) => Math.abs(m[0] - (829 / 600) * 2 / 3) < 1e-9), JSON.stringify(st));
  check("#px backing store owned by the px renderer (CSS x dpr)", px.width === 829 && px.height === 718);
  const ovl = log.filter((q) => q[0] === "ov");
  const ci = ovl.findIndex((q) => q[1] === "clearRect");
  check("overlay cleared under identity before anything else draws on it", ci > 0 && JSON.stringify(ovl[ci - 1][2]) === "[1,0,0,1,0,0]" && JSON.stringify(ovl[ci][2]) === "[0,0,600,520]");
  check("HUD chips draw on the overlay", ovl.some((q) => q[1] === "fillText"));
  const V = r._dbg.view;
  w.events.push({t: "brick", x: 100, y: 100}, {t: "kill", x: 140, y: 100, type: "walker", color: "#8affc1"});
  r.render(w, CFG.STEP);
  check("events feed one-shots once (drained like the wrapper)", V.shots.count() === 2 && w.events.length === 0, V.shots.count());
  r.reset();
  check("reset() clears one-shots (RENDER flip through the cached renderer)", V.shots.count() === 0);
  w.events.push({t: "brick", x: 100, y: 100});
  r.render(w, CFG.STEP);
  loadLevel(w, 2); w.state = "PLAY";
  r.render(w, CFG.STEP);
  check("a new grid (room change / run start) clears one-shots", V.shots.count() === 0);
  const t0 = r._dbg.clock.t;
  w.state = "PAUSE";
  for (let i = 0; i < 60; i++) { step(w, CFG.STEP, {0: newIntent()}); r.render(w, CFG.STEP); }
  check("the board freezes in PAUSE (renderer anim clock)", r._dbg.clock.t === t0);
  const stub = createPixelRenderer(null, null, {});
  let threw = false;
  try { stub.render(w, CFG.STEP, {hud: true}); stub.reset(); } catch (e) { threw = e; }
  check("Node / no-canvas stub mode renders without throwing", !threw, String(threw));
  check("bake on first px creation is within the 50 ms plan budget (Node, " + r._dbg.bakeMs.toFixed(1) + " ms)", r._dbg.bakeMs < 50);
}

// ---- R23: the composed hi -> device transform (overlay matrix, even shake, dpr) ----
function r23(dpr, tf, shake, css, ds) {
  const log = []; let n = 0;
  const mk = (w, h) => recCanvas(w, h, log, ["probe", "native", "hi"][n++] || "x");
  const px = recCanvas(600, 520, log, "px"); px.clientWidth = css[0]; px.clientHeight = css[1]; if (ds) px.dataset = ds;
  const ov = recCanvas(600, 520, log, "ov"); ov.tf = tf;
  globalThis.devicePixelRatio = dpr;
  try {
    const r = createPixelRenderer(px, ov, {mkCanvas: mk, surf: surfRGBA, getShake: () => shake});
    const w = createWorld(4242, 1); loadLevel(w, 1); w.state = "PLAY";
    log.length = 0;
    r.render(w, CFG.STEP);
    const st = log.filter((q) => q[0] === "px" && q[1] === "setTransform").map((q) => q[2]);
    const hi = log.find((q) => q[0] === "hi" && q[1] === "drawImage");
    return {px, st: st.find((m) => m[0] !== 1 || m[4] !== 0), hi: hi && hi[2], stat: r._dbg.stat};
  } finally { delete globalThis.devicePixelRatio; }
}
{
  const tf = {a: 2.5, b: 0, c: 0, d: 2.5, e: -300, f: -200}, shake = {x: 3, y: -3};
  for (const [dpr, css] of [[2, [414, 359]], [3, [276, 239]]]) {
    const R = r23(dpr, tf, shake, css), bw = css[0] * dpr, bh = css[1] * dpr, M = pxM(kOf(bw), 2.5), m = R.st, X = bw / 600, Y = bh / 520;
    check("R23 dpr " + dpr + ": backing = CSS x dpr (" + bw + "x" + bh + ")", R.px.width === bw && R.px.height === bh, R.px.width + "x" + R.px.height);
    check("R23 dpr " + dpr + ": hi stage at M = pxM(k, z 2.5) = " + M, M === pxM(bw / 300, 2.5) && R.hi[2] === 300 * M && R.hi[3] === 260 * M && R.stat.M === M, JSON.stringify(R.hi));
    check("R23 dpr " + dpr + ": final scale = (bw/600) * z * 2/M", Math.abs(m[0] - X * 2.5 * 2 / M) < 1e-9 && Math.abs(m[3] - Y * 2.5 * 2 / M) < 1e-9 && m[1] === 0 && m[2] === 0, m.join());
    check("R23 dpr " + dpr + ": translation is whole device px", Number.isInteger(m[4]) && Number.isInteger(m[5]), m[4] + "," + m[5]);
    const sx = evenShake(3), sy = evenShake(-3);
    check("R23 dpr " + dpr + ": odd shake (3,-3) reaches the matrix as even logical px (" + sx + "," + sy + ") through the overlay matrix",
      sx % 2 === 0 && sy % 2 === 0 && m[4] === Math.round(X * (2.5 * sx - 300)) && m[5] === Math.round(Y * (2.5 * sy - 200)) && m[4] !== Math.round(X * (2.5 * 3 - 300)), m[4] + "," + m[5]);
  }
  const R = r23(3, tf, {x: 0, y: 0}, [999, 999], {bw: "1243", bh: "1077"});
  check("R23: fit's snapped data-bw/bh wins over clientWidth x dpr (no layout read)", R.px.width === 1243 && R.px.height === 1077 && Math.abs(R.st[0] - (1243 / 600) * 2.5 * 2 / pxM(1243 / 300, 2.5)) < 1e-9, R.px.width + "x" + R.px.height);
  const log = []; let n = 0;
  const px = recCanvas(600, 520, log, "px"); px.clientWidth = 828; px.clientHeight = 718;
  const ov = recCanvas(600, 520, log, "ov");
  const r = createPixelRenderer(px, ov, {mkCanvas: (w, h) => recCanvas(w, h, log, ["probe", "native", "hi"][n++] || "x"), surf: surfRGBA, getShake: () => ({x: 0, y: 0})});
  const w = createWorld(4242, 1); loadLevel(w, 1); w.state = "PLAY";
  r.render(w, CFG.STEP); const big = r._dbg.hi, W0 = big.width;
  ov.tf = {a: 0.6, b: 0, c: 0, d: 0.6, e: 120, f: 104}; log.length = 0; r.render(w, CFG.STEP);
  const fin = log.find((q) => q[0] === "px" && q[1] === "drawImage"), M2 = pxM(828 / 300, 0.6);
  check("hi canvas only grows: a smaller M blits its top-left sub-rect, no realloc", r._dbg.hi === big && big.width === W0 && log.some((q) => q[0] === "hi" && q[1] === "clearRect")
    && fin[2].length === 8 && fin[2][2] === 300 * M2 && fin[2][3] === 260 * M2, JSON.stringify(fin && fin[2]));
}

// ---- fit: #px content box and origin snapped to device px ----
{
  let ok = true;
  const bad = [];
  for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3]) for (const s of [0.598, 0.69, 1.292, 1.381, 1.638]) {
    const b = dpr >= 1 ? Math.floor(dpr) / dpr : 1, B = pxBox(600 * s, 520 * s, dpr, b, b), q = pxQuant(dpr), l64 = (v) => Math.abs(v * 64 - Math.round(v * 64)) < 1e-6;
    if (Math.abs(B.w * dpr - B.bw) > 1e-6 || Math.abs(B.h * dpr - B.bh) > 1e-6 || !l64(B.w) || !l64(B.h) || Math.abs(B.w + 2 * b - 600 * s) > (q / 2) / dpr + 1e-9) { ok = false; bad.push([dpr, s, B.w, B.bw]); }
    const o = 267.61 * s, d = snapOff(o, dpr);
    const dv = (o + d) * dpr / q;
    if (Math.abs(dv - Math.round(dv)) > 1e-6 || Math.abs(d) > (q / 2) / dpr + 1e-9) { ok = false; bad.push(["off", dpr, s, d]); }
  }
  check("pxQuant: dpr 1/2 -> 1, 1.5/3 -> 3, 1.25 -> 5, 2.625 -> 21", pxQuant(1) === 1 && pxQuant(2) === 1 && pxQuant(3) === 3 && pxQuant(1.5) === 3 && pxQuant(1.25) === 5 && pxQuant(2.625) === 21);
  check("pxBox: content box x dpr is whole, a whole 1/64 CSS px (layout unit), within q/2 device px of the stage; snapOff lands the origin on a multiple of q device px (so it is a whole 1/64 CSS px too)", ok, JSON.stringify(bad));
  const hs = {}, wl = {}, gl = {style: {}};
  let left0 = 267.61, top0 = 10.3;
  const px = {style: {}, dataset: {}, hidden: false, getBoundingClientRect: () => ({left: left0 + parseFloat(px.style.left || 0), top: top0 + parseFloat(px.style.top || 0)})};
  const wrap = {addEventListener(t, f) { (wl[t] = wl[t] || []).push(f); }};
  globalThis.window = {innerWidth: 1440, innerHeight: 900, addEventListener(t, f) { (hs[t] = hs[t] || []).push(f); }};
  globalThis.document = {getElementById: (id) => ({gl, px, wrap})[id] || null, body: {setAttribute() {}}};
  globalThis.getComputedStyle = () => ({borderLeftWidth: "1px", borderTopWidth: "1px"});
  globalThis.devicePixelRatio = 2;
  try {
    const cv = {width: 600, height: 520, style: {}};
    mountFit(cv);
    const s = fitBox(1440, 900, false, 600, 520).s, onDev = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-6;
    check("mountFit: #gl keeps exactly #c's CSS box (REAL 3D untouched)", gl.style.width === cv.style.width && gl.style.height === cv.style.height && !("left" in gl.style));
    check("mountFit: #px goes content-box, data-bw/bh = its content box x dpr, a whole device px",
      px.style.boxSizing === "content-box" && +px.dataset.bw === Math.round((600 * s - 2) * 2) && +px.dataset.bh === Math.round((520 * s - 2) * 2) && parseFloat(px.style.width) * 2 === +px.dataset.bw, px.style.width + " " + px.dataset.bw);
    const r = px.getBoundingClientRect();
    check("mountFit: #px content origin (rect + border) lands on a device px", onDev(r.left + 1) && onDev(r.top + 1), r.left + "," + r.top);
    top0 = 61.37; (wl.transitionend || []).forEach((f) => f());
    check("the portrait lift's transitionend re-snaps the #px origin", (wl.transitionend || []).length === 1 && onDev(px.getBoundingClientRect().top + 1), px.style.top);
    px.hidden = true; px.style.left = "0.3px"; hs.resize.forEach((f) => f());
    check("a hidden #px still gets its backing size but no origin read", px.style.left === "0.3px" && +px.dataset.bw > 0);
  } finally { delete globalThis.window; delete globalThis.document; delete globalThis.getComputedStyle; delete globalThis.devicePixelRatio; }
}

// ---- createGame smoke through the real loop: ?render=px, RENDER flips, the no-#px stub ----
{
  const loc0 = globalThis.location;
  let threw = null;
  try {
    globalThis.location = {search: "?render=px"};
    const g = createGame(null, {seed: 5});
    let T = 0; const tick = (k) => { for (let i = 0; i < k; i++) { T += 16; g.loop(T); } };
    check("?render=px boots the px renderer (stub: no #px under Node)", !!(g.renderer._dbg && g.renderer._dbg.atlas));
    g.app.startRun(); tick(90);
    check("?render=px: a run steps through the real loop without throwing", g.world.time > 1, g.world.time);
  } catch (e) { threw = e; } finally { if (loc0 === undefined) delete globalThis.location; else globalThis.location = loc0; }
  check("?render=px loop raised nothing", !threw, String(threw && threw.stack));
  threw = null;
  try {
    const g = createGame(null, {seed: 6});
    let T = 0; const tick = (k) => { for (let i = 0; i < k; i++) { T += 16; g.loop(T); } };
    tick(3);
    const r2d = g.renderer;
    g.app.pixel = true; tick(2);
    const rpx = g.renderer;
    check("RENDER flip 2d -> px swaps to the px renderer", rpx !== r2d && !!(rpx._dbg && rpx._dbg.atlas));
    rpx._dbg.view.shots.push(1, 10, 10, rpx._dbg.clock.t);
    g.app.pixel = false; tick(2);
    check("RENDER flip px -> 2d returns the cached CLASSIC renderer", g.renderer === r2d);
    g.app.pixel = true; tick(1);
    check("px -> 2d -> px reuses the cached px renderer and reset() cleared its one-shots", g.renderer === rpx && rpx._dbg.view.shots.count() === 0, rpx._dbg.view.shots.count());
    g.app.startRun(); tick(60);
    check("a run under the flipped px renderer steps without throwing", g.world.time > 0.5, g.world.time);
  } catch (e) { threw = e; }
  check("RENDER flip smoke raised nothing", !threw, String(threw && threw.stack));
}

// ---- CLASSIC 2D unchanged ----
{
  const h = await classicHash((p) => import(pathToFileURL(join(ROOT, p)).href));
  check("CLASSIC 2D call-log hash unchanged (pinned from fe101c5)", h === "97480c1c:22630", h);
}

// ---- hygiene ----
{
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : []; });
  const src = (d) => walk(join(ROOT, d)).map((p) => [p.slice(ROOT.length + 1), readFileSync(p, "utf8")]);
  check("no src/core module imports render/pixel", src("src/core").every(([, s]) => !/render\/pixel/.test(s)));
  check("no src/app module imports src/render", src("src/app").every(([, s]) => !/from\s+["']\.\.\/render\//.test(s)), src("src/app").filter(([, s]) => /from\s+["']\.\.\/render\//.test(s)).map(([p]) => p).join());
  const px = src("src/render/pixel");
  check("the px path never imports vendor/three or render/three", px.every(([, s]) => !/vendor\/three|\/three\//.test(s)));
  check("no Math.random in src/render/pixel", px.every(([, s]) => !/Math\.random/.test(s)));
  const bytes = px.reduce((a, [, s]) => a + Buffer.byteLength(s), 0);
  check("px JS <= 120 KB (" + (bytes / 1024).toFixed(1) + " KB)", bytes <= 120 * 1024);
  const main = readFileSync(join(ROOT, "src/main.js"), "utf8");
  check("main.js never assigns #px's drawing buffer", !/pxCanvas\.(width|height)\s*=/.test(main));
  check("main.js routes kind px to createPixelRenderer", /kind === "px" \? createPixelRenderer\(pxCanvas, canvas/.test(main));
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  check("index.html: #px between #gl and #c, author [hidden] rule, image-rendering:auto",
    /<canvas id="gl" hidden><\/canvas><canvas id="px" hidden><\/canvas><canvas id="c"/.test(html) && /#px\[hidden\]\{display:none\}/.test(html) && /#px\{[^}]*image-rendering:auto/.test(html));
  check("the px renderer never asks #c for an opaque context", !/getContext\("2d",\s*\{alpha:\s*false\}\)/.test(readFileSync(join(ROOT, "src/render/pixel/renderer.js"), "utf8").split("makeOverlayCtx")[1].split("\n}")[0]));
}

console.log("\n  PIXEL RENDER RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
