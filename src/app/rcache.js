import { createJob, LOOK_LABEL, BANDS, prefetch } from "./jobs.js";

export const REL_T = 10000;

const STUB = () => ({ ctx: { save() {}, restore() {}, translate() {}, scale() {} }, render() {}, consumeEvents() {} });

/* v202 swap on ready: a lazy look (PIXEL, REAL 3D) is one job, fetch → construct
   on its own hidden canvas → prepare(job) → swap. Until the swap, get() returns
   the renderer on screen now (`shown`), never CLASSIC in between, and that look's
   canvases stay as they are. The swap runs only in an idle state (env.idle: not
   GAME + PLAY, not the INTRO show), in its own task, then pokes the frame gate so
   the next frame draws the new look. A RENDER change mid-job cancels the job and
   disposes the half-built renderer. A failure keeps the look on screen. */
export function mountRenderers(env) {
  const { canvas, rig, make, size, kind, onSwap, onReady, onFail, loadRenderer3D, loadRendererPx } = env;
  const opts = env.opts || {};
  const perf = () => (env.perf ? env.perf() : null);
  const idle = () => (env.idle ? !!env.idle() : true), hold = () => !!(env.hold && env.hold()), poke = () => { if (env.poke) env.poke(); };
  const pub = (s) => { if (env.onJob) env.onJob(s); };
  const el = (id) => (typeof document !== "undefined" && document && document.getElementById ? document.getElementById(id) : null);
  const cache = {}, seen = {}, slept = {}, shd = new WeakMap(); // shd: the SHADOWS tier a 3D renderer was built with
  const mk = { "3d": opts.createRenderer3D || null, px: opts.createPixelRenderer || null }, LD = { "3d": [loadRenderer3D, "createRenderer3D"], px: [loadRendererPx, "createPixelRenderer"] }, loading = {}, fails = {};
  let lastK = null, shown = null, job = null, relT = null, queued = false, lostNote = null;
  /* a lost WebGL context (v202): rcache listens on the 3D canvas it built on; the
     listener comes off BEFORE every dispose, whose forceContextLoss fires that event */
  const lostR = new Set(), ears = new WeakMap(), waiters = [];
  function listen(r, e) {
    if (!r || !e || typeof e.addEventListener !== "function") return;
    const on = () => { lostR.add(r); poke(); }, off = () => { lostR.delete(r); poke(); };
    e.addEventListener("webglcontextlost", on, false);
    e.addEventListener("webglcontextrestored", off, false);
    ears.set(r, () => { e.removeEventListener("webglcontextlost", on, false); e.removeEventListener("webglcontextrestored", off, false); });
  }
  function kill(r) {
    if (!r) return;
    const u = ears.get(r);
    if (u) { u(); ears.delete(r); }
    lostR.delete(r);
    if (r.dispose) r.dispose();
  }
  /* fetch first, evaluate when idle: the import waits for an idle state, re-checked in its own task (tick flushes) */
  const whenIdle = () => new Promise((res) => { const go = () => (idle() ? res() : waiters.push(go)); go(); });
  if (canvas && canvas.getContext) canvas.getContext("2d", { alpha: true });
  function sizeCanvases(k) {
    const { w, h } = size(k);
    if (canvas) {
      canvas.width = w;
      canvas.height = h;
    }
    for (const [e, ek] of [[el("gl"), "3d"], [el("px"), "px"]]) if (e) e.hidden = k !== ek;
    const f = env.fit && env.fit();
    if (f) f();
  }
  /* v202 G2: music pre-roll (audio.preroll, 0.4 s) before each synchronous step of
     a lazy look: the module import, the construct / prepare and the first frame
     of a new build. */
  const preroll = () => { const a = opts.audio; if (a && a.preroll) a.preroll(); };
  function build(k, glEl, K) {
    if (k === "3d" || k === "px") preroll();
    const o = { audio: opts.audio || null, perf: K };
    const r = k === "3d" ? mk["3d"](glEl, canvas, { ...o, rig, debug: !!env.debug }) : k === "px" ? mk.px(el("px"), canvas, o) : make["2d"](canvas, { kind: k, ...o });
    if (lastK && r && r.setPerf) r.setPerf(K || lastK);
    if (k === "3d" && r && (K || lastK)) shd.set(r, (K || lastK).shadow);
    if (k === "3d") listen(r, glEl);
    return r;
  }
  /* window.__load is index.html's loader (no page, no loader: Node and hosts stay
     synchronous unless env.jobs). With it, every lazy look build is a job: the bar
     is begun and painted BEFORE the fetch, fed each prepare phase (lb.progress, if
     the loader has it) and ended one frame after the new look's first render. */
  const bar = env.bar || null, LB = () => (bar && globalThis.__load) || null, async = () => !!(LB() || env.jobs);
  const lazy = (k) => k === "3d" || k === "px";
  /* the loader's plan, plus the files' share of the look's bar (jobs.js BANDS), so the counted phases after them still move it */
  const plan = (k, o) => ({ ...(bar && bar.lookPlan ? bar.lookPlan(k) : null), fb: BANDS[k].files.w, ...o });
  const pre = env.prefetch ? (typeof env.prefetch === "function" ? env.prefetch : prefetch) : null, root = env.root || new URL("../../", import.meta.url).href, quietL = {};
  function load(k, quiet) {
    if (mk[k]) return Promise.resolve();
    if (loading[k]) {
      /* a pick that joins a quiet (warm) fetch: its files began before this job, so no count */
      if (!quiet && quietL[k] && LB()) { delete quietL[k]; LB().begin(k, plan(k, { ind: true }), false); }
      return loading[k];
    }
    const [raw, fn] = LD[k], lb = quiet ? null : LB(), P = plan(k);
    if (quiet) quietL[k] = true;
    if (lb) lb.begin(k, P, false);
    const imp = () => { preroll(); return raw(); };
    /* v202 fetch first: plain fetch() of the tree (counted by the loader, nothing evaluates), then the import only in an idle state */
    const p = (pre && P.urls && LB() ? pre(P.urls.map((u) => root + u)).then(() => { if (LB()) LB().phase(k); return lb ? bar.paintYield() : null; }).then(whenIdle).then(imp) : lb ? bar.paintYield().then(imp) : new Promise((res) => res(imp()))).then((m) => {
      mk[k] = m[fn];
      if (LB()) LB().phase(k);
    });
    loading[k] = p.then(() => { delete loading[k]; delete quietL[k]; }, (e) => { delete loading[k]; delete quietL[k]; throw e; });
    /* a fetch nobody waits for any more (an eager boot load passed over) still settles */
    if (!quiet) loading[k].then(() => { if (!job || job.k !== k) settled(k, null); }, (e) => { if (!job || job.k !== k) { console.warn(k === "px" ? "PIXEL load failed" : "3D load failed", e); settled(k, null); } });
    return loading[k];
  }
  function settled(k, r, kept) {
    const lb = LB();
    if (lb) {
      if (r) { preroll(); bar.afterFirstRender(r, () => lb.end(k)); }
      else if (kept && lb.miss) lb.miss(k, kept); // a look that did not load: the chip and a polite line, never the boot card
      else lb.end(k);
    }
    if (k === "3d" || kind() !== "3d") onReady();
  }
  const snap = (J) => ({ k: J.k, state: J.state, phase: J.p.phase, done: J.p.done, total: J.p.total, f: J.p.f, fill: J.state === "loading" ? undefined : J.p.f, ind: J.p.ind, fails: fails[J.k] || 0, on: !!J.on, rebuild: J.rebuild, restore: !!J.restore });
  /* a warm job (warm on intent) is quiet: no app.lookJob, no loader, until a pick joins it */
  function note(J) {
    if (J.warm) return;
    const s = snap(J), lb = LB();
    pub(s);
    if (lb && lb.progress) lb.progress(J.k, s);
  }
  function begin(J) {
    const lb = LB();
    if (lb && mk[J.k]) lb.begin(J.k, plan(J.k), true);
  }
  /* a pick joins the warm job: from here on it is the player's, with its row note and chip */
  function promote(J) {
    J.warm = false;
    begin(J);
    if (!mk[J.k]) load(J.k).catch(() => {});
    note(J);
    if (J.due) queueSwap();
  }
  function startJob(k, o = {}) {
    if (job && job.k === k && !o.rebuild) { if (job.warm && !o.warm) promote(job); return job; }
    if (job) cancelJob();
    const J = { k, K: o.K || null, onFail: o.onFail || null, rebuild: !!o.rebuild, restore: !!o.restore, warm: !!o.warm, r: null, fresh: null, due: false, state: mk[k] ? "preparing" : "loading", p: { phase: null, done: 0, total: null, f: 0, ind: true } };
    J.j = createJob({ look: k, gate: idle, now: env.now, channel: env.channel, budgetMs: env.budgetMs, report: (p) => { if (job !== J) return; J.p = p; if (J.state === "loading" && p.phase !== "files") J.state = "preparing"; note(J); } });
    job = J;
    if (!J.warm) begin(J);
    note(J);
    load(k, J.warm)
      .then(() => {
        if (J.j.cancelled) throw { cancelled: true };
        J.j.report("eval", 1, 1);
        return LB() && !J.warm ? bar.paintYield() : null;
      })
      .then(() => J.j.step())
      .then(() => {
        const K = J.K || perf();
        if (k === "3d") {
          const oe = el("gl");
          if (oe && oe.cloneNode && oe.parentNode) {
            J.fresh = oe.cloneNode(false);
            if (J.fresh.removeAttribute) J.fresh.removeAttribute("id");
            J.fresh.hidden = true;
            oe.parentNode.insertBefore(J.fresh, oe.nextSibling);
          }
        }
        J.r = build(k, J.fresh || el(k === "3d" ? "gl" : "px"), K);
        if (J.rebuild && (!J.r || J.r.liveAA == null)) throw new Error("3D context rebuild failed");
        if (J.r && J.r.prepare) { J.j.world = env.world ? env.world() : null; preroll(); return J.r.prepare(J.j); } // job = {world, report, step} (contract)
      })
      .then(() => {
        if (job !== J || J.j.cancelled) return;
        J.due = true;
        J.state = "ready";
        note(J);
        queueSwap();
      })
      .catch((e) => {
        if (e && e.cancelled) return;
        if (job === J) lookFailed(J, e);
      });
    return J;
  }
  function dispose(J) {
    kill(J.r);
    if (J.fresh && J.fresh.parentNode && J.fresh.remove) J.fresh.remove();
    J.r = null;
    J.fresh = null;
  }
  function cancelJob() {
    const J = job;
    if (!J) return;
    job = null;
    J.j.cancel();
    dispose(J);
    if (J.warm) return;
    const lb = LB();
    if (lb) lb.end(J.k);
    pub(null);
  }
  function lookFailed(J, e) {
    if (!J.warm) console.warn(J.k === "px" ? "PIXEL load failed" : "3D load failed", e);
    job = null;
    J.j.cancel();
    dispose(J);
    if (J.warm) return; // a warm miss says nothing: the pick, if it comes, tries again
    if (J.restore) {
      /* the lost context could not be rebuilt: no 3D to keep, so CLASSIC 2D, said on the chip and the row */
      lostNote = null;
      drop3d();
      fails["3d"] = (fails["3d"] || 0) + 1;
      J.state = "failed";
      note(J);
      settled("3d", null, LOOK_LABEL["2d"]);
      if (onFail) onFail("3d", "2d");
      return;
    }
    const on = shown && !shown.boot ? shown.k : "2d";
    if (J.rebuild) {
      /* a failed 3D rebuild keeps the old context; a SHADOWS change it carried applies live on it (today's path) */
      const r3 = cache["3d"];
      if (r3 && J.K && shd.has(r3) && shd.get(r3) !== J.K.shadow) { shd.set(r3, J.K.shadow); if (r3.setPerf) r3.setPerf({ ...J.K, aa: r3.liveAA }); }
      pub(null);
      settled(J.k, null);
      if (J.onFail) J.onFail();
      return;
    }
    fails[J.k] = (fails[J.k] || 0) + 1;
    J.state = "failed";
    note(J);
    /* the centred card is boot-only now (design Q4): a look failure is __load.miss (chip +
       polite line), the RENDER row shows it (app.lookJob), and the pick reverts to the look on screen */
    settled(J.k, null, LOOK_LABEL[on]);
    if (onFail) onFail(J.k, on);
  }
  function show(k, r) {
    sizeCanvases(k);
    if (r && r.activate) r.activate();
    shown = { k, r };
  }
  function queueSwap() {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; swap(); }, 0);
  }
  /* the swap, in its own task (never inside a frame, so #c is never left cleared
     for a painted frame): replace the canvas (3D), size, activate, onSwap, then
     release the previous 3D */
  function swap() {
    const J = job;
    if (!J || !J.due || !idle()) return false;
    job = null;
    if (kind() !== J.k) {
      /* a warm PIXEL waits in the cache, prepared: the pick, when it comes, is a cache hit */
      if (J.warm && !cache[J.k]) { cache[J.k] = J.r; J.j.cancel(); return false; }
      dispose(J);
      pub(null);
      settled(J.k, null);
      return false;
    }
    const old = cache[J.k];
    if (J.fresh) {
      const oe = el("gl");
      if (oe && oe !== J.fresh && oe.replaceWith) oe.replaceWith(J.fresh);
      J.fresh.id = "gl";
    }
    cache[J.k] = J.r;
    J.j.cancel(); // a step still parked inside prepare never resolves now
    J.on = true;
    delete fails[J.k];
    delete seen[J.k];
    delete slept[J.k];
    if (J.restore) lostNote = null;
    show(J.k, J.r);
    onSwap(J.r, J.k);
    if (old && old !== J.r) kill(old);
    pub(snap(J));
    settled(J.k, J.r);
    poke();
    return true;
  }
  function get(k, inner) {
    if (k === "3d" && cache["3d"] && cache["3d"].dead && !(async() && shown && shown.r === cache["3d"])) drop3d(); // a dead context on screen is restored by tick, keeping the look
    if (!inner && LB()) LB().focus(k);
    if (job && job.k !== k) cancelJob();
    if (!job && shown && shown.k !== k) pub(null); // a real change of look clears a finished or failed note
    if (cache[k]) {
      delete slept[k];
      delete seen[k];
      if (cache[k].invalidate) cache[k].invalidate(true);
      show(k, cache[k]);
      return cache[k];
    }
    if (lazy(k) && (!mk[k] || async())) {
      startJob(k);
      if (shown && !shown.boot) return shown.r;
      /* boot (nothing on screen yet): the classic board draws behind the plate / veil */
      sizeCanvases(k);
      const r = cache["2d"] || (cache["2d"] = safeBuild("2d"));
      shown = { k: "2d", r, boot: true };
      return r;
    }
    sizeCanvases(k);
    delete slept[k];
    delete seen[k];
    cache[k] = safeBuild(k);
    if (cache[k].activate) cache[k].activate();
    shown = { k, r: cache[k] };
    return cache[k];
  }
  function safeBuild(k) {
    try {
      return build(k, el("gl"), perf());
    } catch (e) {
      console.warn("renderer init failed", e);
      return STUB();
    }
  }
  if (env.eager && !mk["3d"]) load("3d");
  if (env.eagerPx && !mk.px) load("px");
  function drop3d() {
    const r = cache["3d"];
    if (!r) return;
    delete cache["3d"];
    delete seen["3d"];
    if (shown && shown.r === r) shown = null;
    kill(r);
    const e = el("gl");
    if (e && e.cloneNode && e.replaceWith) e.replaceWith(e.cloneNode(false));
  }
  /* AA (and any 3D → 3D rebuild) goes through the job: built on a hidden clone,
     swapped only in an idle state; until then the old context keeps drawing.
     false = nothing to rebuild; an async failure calls onFail (frameloop reverts). */
  function rebuild3d(K, fail) {
    const old = cache["3d"], oe = el("gl");
    if (!old || !oe || !mk["3d"] || !oe.cloneNode || !oe.parentNode) return false;
    if (!async()) return rebuildNow(K, old, oe);
    if (job && job.k !== "3d" && !job.warm) return true; // another look is on its way in: never cancel it for a context it will replace
    if (job && job.restore) { job.K = K; return true; } // a lost context is being rebuilt: it takes the new knobs if it has not built yet
    if (job && job.k === "3d" && job.rebuild && job.K && job.K.aa === K.aa && job.K.shadow === K.shadow) return true;
    startJob("3d", { rebuild: true, K, onFail: fail || null });
    return true;
  }
  function rebuildNow(K, old, oe) {
    const fresh = oe.cloneNode(false);
    if (fresh.removeAttribute) fresh.removeAttribute("id");
    fresh.hidden = true;
    oe.parentNode.insertBefore(fresh, oe.nextSibling);
    let r = null;
    try {
      r = build("3d", fresh, K);
    } catch (e) {
      r = null;
    }
    if (!r || r.liveAA == null) {
      kill(r);
      if (fresh.remove) fresh.remove();
      return false;
    }
    oe.replaceWith(fresh);
    fresh.id = "gl";
    kill(old);
    cache["3d"] = r;
    if (kind() === "3d") {
      show("3d", r);
      onSwap(r, "3d");
    }
    return true;
  }
  /* REAL 3D · RESTORING before the rebuild starts (the browser gets DEAD_MS to give the context back) */
  function restoreNote() {
    const s = { k: "3d", state: "preparing", phase: null, done: 0, total: null, f: 0, ind: true, fails: 0, on: false, rebuild: true, restore: true }, lb = LB();
    pub(s);
    if (lb) { lb.begin("3d", plan("3d"), true); if (lb.progress) lb.progress("3d", s); }
  }
  function tick(t, k) {
    const r3 = cache["3d"], blind = !!r3 && async() && !!shown && shown.r === r3 && (lostR.has(r3) || !!r3.dead);
    /* the board on screen cannot draw: any way into live PLAY (RESUME, RESTART, a run start, a pick that moved on) pauses again (main: GAME + PLAY only) */
    if (blind && !idle() && env.onLost) env.onLost();
    if (blind && kind() === "3d") {
      /* v202: a lost context on screen keeps the look (never CLASSIC in between), and a dead one is rebuilt through the job */
      if (lostNote !== r3) { lostNote = r3; if (!job || !job.restore) restoreNote(); }
      if (r3.dead && !(job && job.restore)) startJob("3d", { rebuild: true, restore: true, K: lastK || perf() });
    } else {
      if (lostNote && !(job && job.restore)) { lostNote = null; if (!job) pub(null); if (LB()) LB().end("3d"); } // given back by the browser: no rebuild, and never an auto-resume
      if (r3 && r3.dead && !(async() && shown && shown.r === r3)) { // still on screen while another look is on its way in: the swap retires it, main never renders a disposed one
        drop3d();
        if (k === "3d") onSwap(get("3d"), "3d");
      }
    }
    if (waiters.length && idle()) for (const f of waiters.splice(0)) setTimeout(f, 0);
    if (job) {
      job.j.wake();
      if (job.due && idle()) queueSwap();
    }
    /* the release clock does not run on OPTIONS, GRAPHICS, CONTROLS or PAUSE's views */
    const dt = relT == null ? 0 : Math.max(0, t - relT), held = hold();
    relT = t;
    for (const c of Object.keys(cache)) {
      if (c === k) delete slept[c];
      if (c === k || seen[c] == null) seen[c] = t;
      else if (held) seen[c] += dt;
      else if (!slept[c] && t - seen[c] >= REL_T) {
        if (c === "3d") drop3d();
        else if (cache[c].sleep) {
          cache[c].sleep();
          slept[c] = true;
        }
      }
    }
  }
  return {
    get,
    sizeCanvases,
    setKnobs(K) {
      lastK = K;
      /* a SHADOWS tier change on a built 3D context is a rebuild (frameloop, through the job), never a live repin */
      for (const c in cache) {
        const r = cache[c], held = c === "3d" && shd.has(r) && shd.get(r) !== K.shadow;
        if (r.setPerf) r.setPerf(held ? { ...K, shadow: shd.get(r) } : K);
        if (c === "3d" && !shd.has(r)) shd.set(r, K.shadow);
      }
    },
    liveShadow: () => (cache["3d"] && shd.has(cache["3d"]) ? shd.get(cache["3d"]) : null),
    liveAA: () => (cache["3d"] && cache["3d"].liveAA != null ? cache["3d"].liveAA : null),
    rebuild3d,
    drop3d,
    invalidate() {
      for (const c in cache) if (cache[c].invalidate) cache[c].invalidate();
    },
    tick,
    swap,
    /* warm on intent (design Q3): resting on the RENDER row. PIXEL is fetched and prepared
       without a swap (a quiet job, parked in the cache); REAL 3D only fetched and
       evaluated, never built. Never in live PLAY, never over a job the player started. */
    warm(k) {
      if (!lazy(k) || !async() || !idle() || cache[k]) return;
      if (k === "px" && !job) startJob("px", { warm: true });
      else if (!mk[k]) load(k, true).catch(() => {});
    },
    shownKind: () => (shown && !shown.boot ? shown.k : null),
    job: () => (job ? snap(job) : null),
    has3d: () => !!mk["3d"],
    hasPx: () => !!mk.px,
  };
}
