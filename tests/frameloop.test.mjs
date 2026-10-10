import { mountFrames } from "../src/app/frameloop.js";
import { SCREEN } from "../src/app/menuapp.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const AUTO = () => ({ fps: 1, res: 1, shd: 2, aa: 1, fxq: 1, dmo: 1, fpm: 0 });
const target = () => {
  const L = {};
  return { L, addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, fire(t, e) { for (const f of L[t] || []) f(e || {}); } };
};
/* one harness: injected raf queue + fake clock; step(n, per) drives n vsyncs */
function rig(o = {}) {
  const q = [], clock = { t: 0 }, win = Object.assign(target(), { devicePixelRatio: o.dpr || 1 }), doc = Object.assign(target(), { body: { dataset: { lay: o.lay || "d" } } });
  const calls = [], st = { running: true, idle: false, kind: o.kind || "2d", app: o.app || { screen: SCREEN.GAME, pauseView: 0 } };
  const loop = (t) => { calls.push(t); if (o.work) clock.t += o.work; };
  const env = {
    running: () => st.running, idle: () => st.idle, kind: () => st.kind, app: () => st.app,
    rc: o.rc ? () => o.rc : undefined, fit: o.fit ? () => o.fit : undefined, canvas: o.canvas || null,
    win, doc, raf: (f) => q.push(f), now: () => clock.t,
  };
  const F = mountFrames(loop, env);
  let vt = 0;
  const step = (n, per) => {
    let ran = 0;
    for (let i = 0; i < n; i++) {
      if (o.vsync) clock.t = vt += per; else clock.t += per;
      const f = q.shift();
      if (!f) break;
      const c0 = calls.length;
      f(clock.t);
      ran += calls.length - c0;
    }
    return ran;
  };
  return { F, q, calls, st, step, win, doc, clock };
}

// ---- 1. inert in Node, TDZ-safe mount/apply ----
{
  const boom = () => { throw new Error("getter called"); };
  let threw = null, K = null, F = null;
  try {
    F = mountFrames(() => {}, { running: boom, idle: boom, kind: boom, rc: boom, app: boom, fit: boom, canvas: null, win: null, doc: null });
    K = F.apply(AUTO());
    F.knobs(); F.kick();
  } catch (e) { threw = e.message; }
  check("mountFrames / apply / knobs / kick never call a lazy getter (main's TDZ)", threw === null, threw);
  check("apply returns K synchronously (main's setFxOpts reads partK)", K && K.partK === 1 && K.fpsCap === 60 && K.idleFps === 30 && K.epoch === 1 && F.knobs() === K);
  check("apply of an identical blob keeps the epoch", F.apply(AUTO()) === K && K.epoch === 1);
  check("apply of a changed blob bumps the epoch", F.apply({ ...AUTO(), fxq: 0 }).epoch === 2 && F.knobs().partK === 0.5);
  check("no requestAnimationFrame (Node): kick is a no-op and never throws", typeof globalThis.requestAnimationFrame === "undefined");
  let t2 = null;
  try {
    const G = mountFrames(() => {}, { canvas: { width: 600 }, win: { addEventListener: 1 }, doc: {} });
    G.apply(AUTO());
    const H = mountFrames(() => {}, { canvas: { get width() { throw new Error("x"); }, getBoundingClientRect: () => ({ width: 1 }) }, win: {}, doc: null });
    t2 = H.apply(AUTO()).dpr3d;
  } catch (e) { t2 = e.message; }
  check("device read is total: stub canvas, fake doc, throwing canvas -> desktop dpr 1", t2 === 1, t2);
}

// ---- 2. gated callbacks only; kick never doubles; stop ends the chain ----
{
  const R = rig();
  R.F.apply(AUTO());
  R.F.kick(); R.F.kick();
  check("kick twice queues one chain", R.q.length === 1);
  const warm = R.step(16, 1000 / 120);
  const ran = R.step(1200, 1000 / 120);
  check("120 Hz, GAME PLAY at FRAME RATE 60: loop runs on every 2nd callback (600 +-2 in 10 s)", Math.abs(ran - 600) <= 2, warm + "/" + ran);
  R.st.idle = true;
  R.step(8, 1000 / 120);
  const idle = R.step(1200, 1000 / 120);
  check("idle tier: 30 runs/s at 120 Hz (300 +-2 in 10 s)", Math.abs(idle - 300) <= 2, idle);
  R.st.idle = false;
  check("the chain re-requests itself exactly once per callback", R.q.length === 1);
  R.st.running = false;
  R.step(1, 1000 / 120);
  check("stop: the next callback ends the chain (no re-request)", R.q.length === 0);
  R.st.running = true;
  R.F.kick(); R.F.kick();
  check("start after stop: one fresh chain", R.q.length === 1);
  R.st.running = false; R.F.kick();
  R.st.running = true; R.F.kick();
  check("stop then start before the pending callback fires: still one chain", R.q.length === 1);
  const M = rig();
  M.F.apply({ ...AUTO(), fps: 2 });
  M.F.kick();
  check("FRAME RATE MAX runs every 120 Hz callback", M.step(600, 1000 / 120) === 600);
  const N = rig();
  N.F.apply({ ...AUTO(), fps: 0 });
  N.F.kick(); N.step(16, 1000 / 60);
  check("FRAME RATE 30 on a 60 Hz panel runs every 2nd callback", Math.abs(N.step(600, 1000 / 60) - 300) <= 2);
}

// ---- 3. knob pushes ride the next gated tick, only on an epoch change ----
{
  const log = [];
  const rc = { setKnobs: (K) => log.push(["k", K.epoch, K.fpsCap]), liveAA: () => null, tick: (t, k) => log.push(["t", k]) };
  const fit = { setPxCap: (c) => log.push(["px", c]) };
  const R = rig({ rc, fit, dpr: 2 });
  R.F.apply(AUTO());
  check("apply pushes nothing synchronously", log.length === 0);
  R.F.kick(); R.step(1, 16);
  const k = log.filter((e) => e[0] === "k"), px = log.filter((e) => e[0] === "px");
  check("first gated tick pushes setKnobs(K) and fit.setPxCap(K.dprPx) once", k.length === 1 && k[0][1] === 1 && px.length === 1 && px[0][1] === 2, JSON.stringify(log));
  R.step(30, 1000 / 60);
  check("no push while the epoch holds", log.filter((e) => e[0] === "k").length === 1);
  check("rc.tick(now, kind) runs on every callback", log.filter((e) => e[0] === "t").length === 31 && log.find((e) => e[0] === "t")[1] === "2d");
  R.F.apply({ ...AUTO(), fps: 2 });
  check("a settings change still pushes nothing until the next tick", log.filter((e) => e[0] === "k").length === 1);
  R.step(1, 1000 / 60);
  const k2 = log.filter((e) => e[0] === "k");
  check("the next gated tick pushes the new epoch", k2.length === 2 && k2[1][1] === 2 && k2[1][2] === Infinity);
}

// ---- 4. AA applies on leaving the page; drop3d off 3D; a failed rebuild reverts ----
{
  let live = true, ok = true;
  const log = [];
  const app = { screen: SCREEN.GAME, pauseView: 2, setGfx: (k, v) => log.push(["set", k, v]) };
  const rc = { setKnobs() {}, liveAA: () => live, rebuild3d: (K) => { log.push(["rb", K.aa]); if (ok) live = K.aa; return ok; }, drop3d: () => { log.push(["drop"]); live = null; } };
  const R = rig({ rc, kind: "3d", app });
  const S = AUTO();
  R.F.apply(S);
  R.F.kick(); R.step(5, 16);
  S.aa = 0; R.F.apply(S);
  R.step(20, 16);
  check("on the page (pause view 2): no rebuild while AA is pending", log.length === 0);
  R.F.kick(); R.step(1, 16);
  R.F.info();
  app.pauseView = 0;
  R.step(1, 16);
  check("leaving the page rebuilds the 3D context once with the new AA", log.length === 1 && log[0][0] === "rb" && log[0][1] === false, JSON.stringify(log));
  R.step(30, 16);
  check("never twice for the same epoch", log.length === 1);
  app.screen = SCREEN.GRAPHICS; S.aa = 2; R.F.apply(S); ok = false;
  R.step(10, 16);
  check("GRAPHICS menu page defers too", log.length === 1);
  check("info().pendingAA while the change waits", R.F.info().pendingAA === true);
  app.screen = SCREEN.MENU;
  R.step(1, 16);
  check("a failed rebuild keeps the old renderer and reverts through app.setGfx", log.length === 3 && log[1][0] === "rb" && log[2][0] === "set" && log[2][1] === "aa" && log[2][2] === 0, JSON.stringify(log));
  R.F.apply({ ...S, fxq: 0 });
  R.st.kind = "2d"; ok = true;
  R.step(2, 16);
  check("off 3D a stale cached context is dropped, not rebuilt", log[log.length - 1][0] === "drop");
}

// ---- 5. visibility, input poke, info ----
{
  let inv = 0;
  const R = rig({ rc: { invalidate: () => inv++ } });
  R.st.idle = true;
  R.F.apply(AUTO());
  R.F.kick(); R.step(40, 1000 / 120);
  R.doc.fire("visibilitychange");
  check("visibilitychange invalidates the renderers", inv === 1);
  R.step(40, 1000 / 120);
  let skip = -1;
  for (let i = 0; i < 6 && skip < 0; i++) if (R.step(1, 1000 / 120) === 0) skip = i;
  R.win.fire("keydown", { code: "KeyX" });
  const poked = R.step(1, 1000 / 120);
  check("idle tier: a keydown pokes the gate, the next callback runs (one-vsync menu latency)", skip >= 0 && poked === 1);
  R.win.fire("pointerdown");
  check("a pointerdown pokes too, and junk events never throw", R.step(1, 1000 / 120) === 1 && R.win.L.keydown.length === 1);
  const K = rig();
  K.F.apply(AUTO());
  K.F.kick(); K.step(40, 1000 / 120);
  const pat = [];
  for (let i = 0; i < 400; i++) { if (i % 4 === 0) K.win.fire("keydown", { code: "ArrowLeft", repeat: i % 8 !== 0 }); pat.push(K.step(1, 1000 / 120)); }
  let alt = true;
  for (let i = 1; i < pat.length; i++) if (pat[i] === pat[i - 1]) alt = false;
  check("GAME PLAY at 120 Hz: held-key autorepeat and fresh presses never break the every-2nd cadence (input pokes are idle-tier only)", alt, pat.slice(0, 16).join(""));
  const I = rig();
  I.st.idle = true;
  I.F.apply(AUTO()); I.F.kick(); I.step(40, 1000 / 120);
  let sk = -1;
  for (let i = 0; i < 4 && sk < 0; i++) if (I.step(1, 1000 / 120) === 0) sk = i;
  I.win.fire("keydown", { code: "ArrowDown", repeat: true });
  check("an autorepeat keydown never pokes", I.step(1, 1000 / 120) === 0);
  const app = { screen: SCREEN.MENU };
  const P = rig({ app });
  P.F.apply(AUTO());
  P.F.kick(); P.step(130, 1000 / 120);
  check("app.gfx is published twice a second with the gated rate", app.gfx && Math.abs(app.gfx.fps - 60) <= 2 && app.gfx.hz === 120 && app.gfx.d === 2 && app.gfx.kind === "2d", JSON.stringify(app.gfx));
  check("info() carries the documented shape", ["fps", "hz", "d", "kind", "dpr3d", "dprPx", "liveAA", "pendingAA", "limit", "gov"].every((k) => k in P.F.info()));
}

// ---- 6. device + governor fold ----
{
  const canvas = { width: 600, getBoundingClientRect: () => ({ width: 300 }) };
  const R = rig({ lay: "p", dpr: 3, canvas, kind: "3d" });
  check("touch AUTO 3D DPR is display-matched: min(1.5, scale*dpr)", R.F.apply(AUTO()).dpr3d === 1.5 && R.F.knobs().dprPx === 1.5);
  R.doc.body.dataset.lay = "d";
  R.win.fire("resize");
  check("resize re-reads the device and re-resolves K", R.F.knobs().dpr3d === 2 && R.F.knobs().epoch === 2);
  const log = [];
  const G = rig({ dpr: 2, kind: "3d", work: 14, rc: { setKnobs: (K) => log.push(K.dpr3d), liveAA: () => null } });
  G.F.apply(AUTO());
  G.F.kick(); G.step(80, 1000 / 60);
  check("REAL 3D AUTO resolution: one 2 s window of long frames steps the governor down 2 -> 1.75", G.F.knobs().dpr3d === 1.75 && log[log.length - 1] === 1.75, JSON.stringify(log));
  G.F.apply({ ...AUTO(), res: 2 });
  G.step(1, 1000 / 60);
  check("FULL resolution ignores the governor", G.F.knobs().dpr3d === 2 && G.F.knobs().dyn === false);
  const H = rig({ dpr: 2, kind: "3d", work: 14, app: { screen: SCREEN.MENU } });
  H.st.idle = true;
  H.F.apply(AUTO()); H.F.kick(); H.step(400, 1000 / 60);
  check("the governor is frozen off GAME PLAY / ATTRACT", H.F.knobs().dpr3d === 2);
  check("info().gov is null while the governor is unfed", H.F.info().gov === null);
  const pl = [], app = { screen: SCREEN.ATTRACT, pauseView: 0 };
  const W = rig({ dpr: 2, kind: "3d", work: 2, vsync: true, app, rc: { setKnobs: (K) => pl.push(K.dpr3d), liveAA: () => null } });
  W.F.apply(AUTO()); W.F.kick();
  const v120 = 1000 / 120;
  for (const split of [0.4, 0.9, 1.3, 1.7]) {
    app.screen = SCREEN.ATTRACT; W.st.idle = true; W.step(Math.round((30 + split) * 120), v120);
    app.screen = SCREEN.GAME; W.st.idle = false; W.step(4 * 120, v120);
    app.screen = SCREEN.MENU; W.st.idle = true; W.step(3 * 120, v120);
  }
  check("healthy 3D AUTO: ATTRACT (30) <-> GAME PLAY (60) <-> MENU at four split offsets never steps the governor (one push, dpr3d 2)", W.F.knobs().dpr3d === 2 && pl.join() === "2", pl.join());
  const al = [];
  const A = rig({ dpr: 2, kind: "3d", work: 14, vsync: true, app: { screen: SCREEN.ATTRACT }, rc: { setKnobs: (K) => al.push(K.dpr3d), liveAA: () => null } });
  A.st.idle = true;
  A.F.apply(AUTO()); A.F.kick(); A.step(12 * 120, v120);
  check("ATTRACT is judged against its own 30 fps budget: 14 ms work at 33 ms never steps down", A.F.knobs().dpr3d === 2 && al.join() === "2", al.join());
  const C = rig({ dpr: 2, kind: "2d", work: 14 });
  C.F.apply(AUTO()); C.F.kick(); C.step(400, 1000 / 60);
  check("the governor never runs outside REAL 3D", C.F.knobs().dpr3d === 2);
}

// ---- close-out review: rc.tick reads the kind AFTER loop(), so a RENDER flip inside loop never sleeps the renderer it just woke ----
{
  const q = [], clock = { t: 0 }, ticks = [];
  let kind = "2d";
  const tg = () => ({ addEventListener() {} });
  const F = mountFrames(() => { if (clock.t >= 48) kind = "px"; }, {
    running: () => true, idle: () => false, kind: () => kind, app: () => ({ screen: SCREEN.GAME, pauseView: 0 }),
    rc: () => ({ tick: (t, k) => ticks.push(k) }), win: Object.assign(tg(), { devicePixelRatio: 1 }), doc: Object.assign(tg(), { body: { dataset: { lay: "d" } } }),
    raf: (f) => q.push(f), now: () => clock.t,
  });
  F.apply(AUTO()); F.kick();
  for (let i = 0; i < 4; i++) { clock.t += 16; q.shift()(clock.t); }
  check("the flip frame hands rc.tick the NEW kind (a stale one slept a just-woken PIXEL to 1x1)", ticks.join() === "2d,2d,px,px", ticks.join());
}

console.log("\n  FRAMELOOP RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
