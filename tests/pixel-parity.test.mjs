// PIXEL parity outside the board art: the WIN cheer one-shot, one-shot reset
// at a run start through the real step(), death / materialize from the real
// hurtPlayer, the PAUSE freeze (R16: clock, particles, shake and flash),
// SHAKE off and REDUCE FLASH through the fx.js settings getters.
import { createHash } from "node:crypto";
import { CFG } from "../src/core/config.js";
import { createWorld, loadLevel, step, newIntent } from "../src/core/sim.js";
import { hurtPlayer } from "../src/core/entities.js";
import { PX_T } from "../src/render/pixel/timing.js";
import { createOneShots, feedShot, shotFrame, OS, OS_DUR } from "../src/render/pixel/oneshot.js";
import { createAtlas } from "../src/render/pixel/atlas.js";
import { createView, drawPixelWorld } from "../src/render/pixel/world.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { finalMatrix } from "../src/render/pixel/snap.js";
import { getFx, setFxOpts } from "../src/render/fx.js";
import { createRGBA, surfRGBA } from "../tools/pixel/rgba.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

function rec(w, h, log, tag) {
  const cv = {width: w, height: h, clientWidth: 0, clientHeight: 0, tag};
  const ctx = {imageSmoothingEnabled: true, imageSmoothingQuality: "high", globalAlpha: 1, fillStyle: "#000",
    getTransform: () => cv.tf || {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0}, putImageData() {}};
  for (const k of ["save", "restore", "translate", "scale", "rotate", "strokeRect", "clearRect", "beginPath", "closePath", "moveTo", "lineTo", "arc", "arcTo", "bezierCurveTo", "quadraticCurveTo", "fill", "stroke", "ellipse", "transform", "fillText", "strokeText", "setLineDash", "rect", "clip"])
    ctx[k] = () => {};
  ctx.measureText = () => ({width: 10});
  ctx.fillRect = (...a) => log.push([tag, "fillRect", a, ctx.fillStyle, ctx.globalAlpha]);
  ctx.setTransform = (...a) => log.push([tag, "setTransform", a]);
  ctx.drawImage = (src, ...a) => log.push([tag, "drawImage", a, src && src.tag]);
  ctx.createLinearGradient = () => ({addColorStop() {}});
  ctx.createRadialGradient = () => ({addColorStop() {}});
  cv.getContext = () => ctx;
  return cv;
}
/* probe + hi are recorders; the native board is a real RGBA image, so a
   frozen board can be hashed byte for byte. */
function rig() {
  const log = [];
  let n = 0, native = null;
  const mk = (w, h) => { const i = n++; if (i === 1) { native = createRGBA(w, h); return native; } return rec(w, h, log, i ? "hi" : "probe"); };
  const px = rec(600, 520, log, "px"); px.clientWidth = 829; px.clientHeight = 718;
  const ov = rec(600, 520, log, "ov");
  const r = createPixelRenderer(px, ov, {mkCanvas: mk, surf: surfRGBA});
  return {r, log, px, ov, native: () => native};
}
const hash = (img) => createHash("sha1").update(img.data).digest("hex");
const play = (lvl = 1) => { const w = createWorld(4242, lvl); loadLevel(w, lvl); w.state = "PLAY"; return w; };
const lastPxMatrix = (log) => { const m = log.filter((q) => q[0] === "px" && q[1] === "setTransform" && q[2][0] !== 1); return m.length ? m[m.length - 1][2] : null; };
const unshaken = () => finalMatrix([0, 0, 0, 0, 0, 0], 829, 718, {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0}, 0, 0, 3);

// ---- WIN cheer one-shot ----
{
  check("OS.WIN is appended (11), earlier one-shot codes keep their indices",
    OS.WIN === 11 && OS.SPARKLE === 10 && OS.CRUMBLE === 1 && OS_DUR.length === 12 && OS_DUR[OS.SPARKLE] === PX_T.SPARKLE_MS * PX_T.SPARKLE_N / 1000);
  const s = createOneShots(8), w = {players: [{x: 300, y: 260, alive: true}]};
  feedShot(s, {t: "win"}, w, 2);
  const o = s.live(OS.WIN), f = 1 / PX_T.WIN_FPS;
  check("a room clear anchors the cheer at its own t0: f0, f1, f0 at the WIN_FPS beat",
    !!o && o.x === 300 && o.y === 260 && shotFrame(o, 2) === 0 && shotFrame(o, 2 + f + 1e-6) === 1 && shotFrame(o, 2 + 2 * f + 1e-6) === 0 && shotFrame(o, 2 + f - 1e-3) === 0);
  s.expire(500);
  check("the cheer lives until reset (the next grid), expire never frees it", s.live(OS.WIN) === o);
  s.reset();
  check("reset() frees the cheer", s.count() === 0);

  const atlas = createAtlas(surfRGBA), wd = play(1);
  wd.state = "WIN";
  const p = wd.players[0], set = atlas.mako(p.color, !!p.kick);
  const mako = (t0, t) => {
    const V = createView(atlas); V.shots = createOneShots(); V.t = t;
    if (t0 != null) V.shots.push(OS.WIN, p.x, p.y, t0);
    const c = createRGBA(300, 260).getContext(); drawPixelWorld(c, wd, V);
    const srcs = c.calls.filter((q) => q[0] === "drawImage").map((q) => q[5]);
    return set.win.findIndex((fr) => srcs.includes(fr.im));
  };
  check("in WIN, MAKO's cheer starts on f0 at the clear whatever the clock phase",
    mako(0.37, 0.37) === 0 && mako(0.37, 0.37 + f + 1e-6) === 1 && mako(0.12, 0.12) === 0, [mako(0.37, 0.37), mako(0.37, 0.37 + f + 1e-6), mako(0.12, 0.12)].join());
  check("without a cheer shot (flipped in mid-WIN) MAKO still cheers on the clock", mako(null, 0.3) === 1 && mako(null, 0.1) === 0);
  let nearWhite = 0;
  for (const fr of set.win) {
    let on = 0, wh = 0;
    for (let i = 0; i < fr.im.data.length; i += 4) if (fr.im.data[i + 3]) { on++; if (fr.im.data[i] > 235 && fr.im.data[i + 1] > 235 && fr.im.data[i + 2] > 235) wh++; }
    if (on && wh / on > 0.25) nearWhite++;
  }
  check("REDUCE FLASH: no cheer frame is a near-white full-sprite flash", nearWhite === 0, nearWhite);
}

// ---- one-shots clear at every run start, through the real step() ----
{
  const {r} = rig(), V = r._dbg.view, w = play(1), fire = {0: {...newIntent(), fire: true}}, idle = {0: newIntent()};
  r.render(w, CFG.STEP);
  w.events.push({t: "brick", x: 100, y: 100}, {t: "kill", x: 140, y: 100, type: "walker", color: "#8affc1"});
  r.render(w, CFG.STEP);
  const before = V.shots.count();
  const g0 = w.grid;
  w.state = "LOSE"; w.fireEdge = false;
  step(w, CFG.STEP, fire);
  r.render(w, CFG.STEP);
  check("LOSE -> fire -> startGame: a new grid, and the px one-shots are cleared", before === 2 && w.state === "PLAY" && w.grid !== g0 && V.shots.count() === 0, before + " " + w.state + " " + V.shots.count());
  step(w, CFG.STEP, idle);
  w.events.push({t: "win"}); w.state = "WIN";
  r.render(w, CFG.STEP);
  const cheer = !!V.shots.live(OS.WIN), g1 = w.grid;
  w.fireEdge = false;
  step(w, CFG.STEP, fire);
  r.render(w, CFG.STEP);
  check("WIN -> fire -> next room: the cheer and every other one-shot are cleared", cheer && w.state === "PLAY" && w.level === 2 && w.grid !== g1 && V.shots.count() === 0);
}

// ---- death / materialize from the real hurtPlayer ----
{
  const s = createOneShots(8), w = play(1), p = w.players[0];
  p.x = 7.5 * CFG.TILE; p.y = 5.5 * CFG.TILE; w.lives = 2; w.events.length = 0;
  hurtPlayer(w);
  for (const ev of w.events) feedShot(s, ev, w, 1);
  const c = s.live(OS.CORPSE), m = s.live(OS.MAT);
  check("a life lost: the corpse where MAKO fell, the materialize at the spawn", !!c && !!m && c.x === 7.5 * CFG.TILE && m.x === 1.5 * CFG.TILE && m.y === 1.5 * CFG.TILE && !s.live(OS.DEATH));
  s.reset(); w.events.length = 0; p.x = 7.5 * CFG.TILE; w.lives = 1;
  hurtPlayer(w);
  for (const ev of w.events) feedShot(s, ev, w, 1);
  check("the last life: one death sequence, no corpse and no materialize", !!s.live(OS.DEATH) && !s.live(OS.CORPSE) && !s.live(OS.MAT) && s.count() === 1);
  check("death is LOSE_N frames over LOSE_MS", shotFrame(s.live(OS.DEATH), 1) === 0 && shotFrame(s.live(OS.DEATH), 1 + PX_T.LOSE_MS / 1000 - 1e-3) === PX_T.LOSE_N - 1);
}

// ---- R16: PAUSE freezes the whole board ----
{
  setFxOpts({flashK: 1, shakeK: 1});
  const {r, log, native} = rig(), w = play(1);
  r.render(w, CFG.STEP);
  w.events.push({t: "boom", x: 300, y: 260}, {t: "kill", x: 140, y: 100, type: "walker", color: "#8affc1"});
  r.render(w, CFG.STEP);
  const nParts = getFx().length;
  w.state = "PAUSE";
  log.length = 0;
  const hs = new Set(), t0 = r._dbg.clock.t, p0 = JSON.stringify(getFx().map((p) => [p.x, p.y, p.t]));
  for (let i = 0; i < 60; i++) { step(w, CFG.STEP, {0: newIntent()}); r.render(w, CFG.STEP); hs.add(hash(native())); }
  check("PAUSE: 60 renders paint a byte-identical native board (live particles, shake and flash pending)", hs.size === 1 && nParts > 20, hs.size + " " + nParts);
  check("PAUSE: the particles hold still (updateFx skipped) and the anim clock is frozen", JSON.stringify(getFx().map((p) => [p.x, p.y, p.t])) === p0 && r._dbg.clock.t === t0);
  const ms = log.filter((q) => q[0] === "px" && q[1] === "setTransform" && q[2][0] !== 1).map((q) => q[2]), u = unshaken();
  check("PAUSE: the final blit carries no shake term", ms.length === 60 && ms.every((m) => m[4] === u[4] && m[5] === u[5]), JSON.stringify(ms[0]));
  check("PAUSE: no flash wash over the paused board", !log.some((q) => q[0] === "ov" && q[1] === "fillRect" && q[3] === "#ffe8a8"));
  w.state = "PLAY";
  step(w, CFG.STEP, {0: newIntent()}); r.render(w, CFG.STEP);
  check("PLAY resumes the particles where they stopped", getFx().length > 0 && JSON.stringify(getFx().map((p) => [p.x, p.y, p.t])) !== p0);
  w.events.push({t: "boom", x: 300, y: 260});
  r.render(w, CFG.STEP);
  w.state = "PAUSE"; r.render(w, CFG.STEP);
  loadLevel(w, 1); w.state = "PLAY";
  log.length = 0;
  r.render(w, CFG.STEP);
  const m2 = lastPxMatrix(log);
  check("a new grid straight out of PAUSE (RESTART) opens with no held flash wash and no shake",
    !log.some((q) => q[0] === "ov" && q[1] === "fillRect" && q[3] === "#ffe8a8") && m2 && m2[4] === u[4] && m2[5] === u[5], JSON.stringify(m2));
}

// ---- SHAKE off / REDUCE FLASH (fx.js settings getters, px honours both) ----
{
  setFxOpts({shakeK: 0, flashK: 0.25});
  const {r, log} = rig(), w = play(1);
  r.render(w, CFG.STEP);
  let worst = 0, flashes = 0, shaken = 0;
  for (let i = 0; i < 20; i++) {
    log.length = 0;
    w.events.push({t: "boom", x: 300, y: 260}, {t: "lose"});
    r.render(w, CFG.STEP);
    const m = lastPxMatrix(log), u = unshaken();
    if (!m || m[4] !== u[4] || m[5] !== u[5]) shaken++;
    for (const q of log) if (q[0] === "ov" && q[1] === "fillRect" && q[3] === "#ffe8a8") { flashes++; worst = Math.max(worst, q[4]); }
  }
  check("SHAKE off: twenty booms never move the final blit", shaken === 0, shaken);
  check("REDUCE FLASH: the boom wash is drawn at <= 0.07 alpha (0.28 x 0.25)", flashes > 0 && worst <= 0.07 + 1e-9, flashes + " " + worst);
  setFxOpts({shakeK: 1, flashK: 1});
  let moved = 0;
  for (let i = 0; i < 20; i++) {
    log.length = 0;
    w.events.push({t: "boom", x: 300, y: 260}, {t: "lose"});
    r.render(w, CFG.STEP);
    const m = lastPxMatrix(log), u = unshaken();
    if (m && (m[4] !== u[4] || m[5] !== u[5])) moved++;
    if (m && ((m[4] - u[4]) % 1 || (m[5] - u[5]) % 1)) moved = -99;
  }
  check("SHAKE on: booms shake the final blit, on whole device px", moved > 0, moved);
}

console.log("\n  PIXEL PARITY RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
