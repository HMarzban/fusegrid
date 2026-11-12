import { createGate, createGovernor, limitHint, IV_STALL } from "./perf.js";
import { resolve } from "./gfx.js";
import { SCREEN } from "./menuapp.js";

const HELD_FPS = 60;
/* the menu kit's offscreen layers (render/kit/cache.js release, handed in by main as env.release): freed after KIT_FREE ms of GAME PLAY on a
   PLAY-only clock (reset by any other screen; PAUSE and a run end hold it) and on pagehide; the next shell frame refills them */
export const KIT_FREE = 10000;
const DEV0 = Object.freeze({ lay: "d", dpr: 1, scale: 1 });
const on = (o, t, f, opt) => { if (o && typeof o.addEventListener === "function") o.addEventListener(t, f, opt); };
const same = (a, b) => { if (!a || !b) return false; for (const k in b) if (k !== "epoch" && a[k] !== b[k]) return false; return true; };

export function mountFrames(loop, env = {}) {
  const win = env.win !== undefined ? env.win : typeof window !== "undefined" ? window : null;
  const doc = env.doc !== undefined ? env.doc : typeof document !== "undefined" ? document : null;
  const now = env.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  const rafOf = () => env.raf || (typeof globalThis.requestAnimationFrame === "function" ? (f) => globalThis.requestAnimationFrame(f) : null);
  const rc = () => (env.rc ? env.rc() : null);
  const gate = createGate(), gov = createGovernor();
  let S = null, base = null, K = null, epoch = 0, pushed = -1, fold = false, pending = false;
  let tPrev = null, tRun = null, runs = 0, fps = 0, infoT = null, raw = [], rawSum = 0;
  let lk = null, ll = null, aaEp = -1, prevAA = null, wasIdle = true, gc = null, playMs = 0, freed = false;
  const free = () => { if (typeof env.release === "function") env.release(); };
  const readDev = () => {
    try {
      const c = env.canvas, b = doc && doc.body, r = c && typeof c.getBoundingClientRect === "function" ? c.getBoundingClientRect() : null;
      const dpr = (win && win.devicePixelRatio) || globalThis.devicePixelRatio || 1, sc = r && c.width ? r.width / c.width : 1;
      return { lay: (b && b.dataset && b.dataset.lay) || "d", dpr: dpr > 0 ? dpr : 1, scale: sc > 0 ? sc : 1 };
    } catch (e) { return DEV0; }
  };
  let dev = readDev();
  const remake = () => {
    if (!base) return K;
    const n = { ...base };
    if (fold && base.dyn) n.dpr3d = gov.level(base.dpr3d);
    if (same(K, n)) return K;
    n.epoch = ++epoch;
    return (K = n);
  };
  const redev = () => { dev = readDev(); if (S) { base = resolve(S, dev); remake(); } };
  const info = () => ({
    fps, hz: gate.hz, d: gate.d, kind: lk, dpr3d: K ? K.dpr3d : null, dprPx: K ? K.dprPx : null, liveAA: ll,
    pendingAA: lk === "3d" && ll != null && !!K && ll !== K.aa, limit: !!K && limitHint(raw, K.fpsCap),
    gov: gc != null && fold && K && K.dyn ? K.dpr3d : null,
  });
  const publish = (a) => { if (a) a.gfx = info(); };
  function tick(t, a, r, idle, cap) {
    const k = env.kind ? env.kind() : "2d";
    lk = k; fold = k === "3d"; remake();
    ll = r && typeof r.liveAA === "function" ? r.liveAA() : null;
    if (epoch !== pushed) {
      pushed = epoch;
      if (r && r.setKnobs) r.setKnobs(K);
      const f = env.fit && env.fit();
      if (f && typeof f.setPxCap === "function") f.setPxCap(K.dprPx);
      gate.poke(); publish(a);
    }
    if (a && r && ll != null && K) {
      const onPage = a.screen === SCREEN.GRAPHICS || (a.screen === SCREEN.GAME && a.pauseView === 2);
      if (ll === K.aa && S) prevAA = S.aa;
      const ls = typeof r.liveShadow === "function" ? r.liveShadow() : null, stale = ll !== K.aa || (ls != null && ls !== K.shadow); // v202: SHADOWS rebuilds through the same job as AA
      if (typeof r.rebuildAgain === "function" && r.rebuildAgain()) aaEp = -1; // queued, never dropped: a rebuild deferred behind another look's job or cancelled by a pick runs once that job ends (or the stale 3D is released if the look moved off it)
      if (!onPage && stale && aaEp !== epoch) {
        aaEp = epoch;
        if (k === "3d") { const pv = prevAA ?? (K.aa ? 0 : 1), back = () => { if (a.setGfx) a.setGfx("aa", pv); }; if (r.rebuild3d && !r.rebuild3d(K, back)) back(); } // v202: the rebuild is a look job; a later failure reverts through back too
        else if (r.drop3d) r.drop3d();
        ll = typeof r.liveAA === "function" ? r.liveAA() : null;
      }
    }
    const w0 = now();
    loop(t);
    const work = now() - w0;
    if (!(fold && K && K.dyn && a && a.screen !== SCREEN.INTRO && (!idle || a.screen === SCREEN.ATTRACT))) gc = null;
    else if (cap !== gc || tRun == null) { gov.reset(); gc = cap; }
    else gov.feed(t - tRun, work, 1000 / Math.min(cap, gate.hz || 60));
    tRun = t; runs++;
  }
  function cb(t) {
    pending = false;
    if (env.running && !env.running()) return;
    const iv = tPrev == null ? 0 : t - tPrev;
    tPrev = t;
    if (iv > IV_STALL || iv < 0) { raw = []; rawSum = 0; tRun = null; }
    else if (iv > 0) { raw.push(iv); rawSum += iv; while (rawSum > 2000 && raw.length > 1) rawSum -= raw.shift(); }
    if (env.pre && env.pre(t)) gate.poke(); // the pad polls on every rAF: the idle floor of 20 fps can miss a tap
    const a = env.app ? env.app() : null, r = rc();
    const idle = (wasIdle = !!(env.idle && env.idle()));
    if (!a || a.screen !== SCREEN.GAME) { playMs = 0; freed = false; }
    else if (!idle && !freed && iv > 0 && iv <= IV_STALL && (playMs += iv) >= KIT_FREE) { freed = true; free(); }
    /* A held menu direction repeats on the frames app.update gets: 60 Hz while it is held, or the repeat lands on idle frames. */
    const cap = !K ? Infinity : idle && a && a.repDir ? Math.min(HELD_FPS, K.fpsCap) : idle ? K.idleFps : K.fpsCap;
    if (gate.tick(t, cap)) tick(t, a, r, idle, cap);
    if (r && typeof r.tick === "function") r.tick(now(), env.kind ? env.kind() : lk); // re-read: loop() may have just flipped RENDER
    if (infoT == null || iv > IV_STALL || iv < 0) { infoT = t; runs = 0; }
    else if (t - infoT >= 500) { fps = Math.round((runs * 1000) / (t - infoT)); runs = 0; infoT = t; publish(a); }
    const raf = rafOf();
    if (raf) { pending = true; raf(cb); }
  }
  const poke = () => gate.poke(), inPoke = (e) => { if (wasIdle && !(e && e.repeat)) gate.poke(); };
  on(win, "keydown", inPoke, { capture: true, passive: true });
  on(win, "pointerdown", inPoke, { capture: true, passive: true });
  on(doc, "visibilitychange", () => {
    gate.reset(); gov.reset(); tPrev = null; tRun = null; raw = []; rawSum = 0;
    const r = rc();
    if (r && typeof r.invalidate === "function") r.invalidate();
  });
  on(win, "pagehide", free);
  on(win, "resize", redev);
  on(win, "orientationchange", redev);
  const watchDpr = () => {
    try {
      if (!win || typeof win.matchMedia !== "function") return;
      const q = win.matchMedia("(resolution: " + dev.dpr + "dppx)");
      if (q && typeof q.addEventListener === "function") q.addEventListener("change", () => { redev(); watchDpr(); }, { once: true });
    } catch (e) {}
  };
  watchDpr();
  return {
    kick() {
      const raf = rafOf();
      if (pending || !raf) return;
      pending = true;
      raf(cb);
    },
    apply(s) { S = s; base = resolve(s, dev); return remake(); },
    knobs() { return K; },
    info,
    poke,
  };
}
