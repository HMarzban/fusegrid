/* One look job (v202 delivery), DOM-free. A job slices a look's build into small
   units: the renderer's prepare(job) calls `await job.step()` between them, and
   step() resolves at once while the slice budget (about 8 ms) lasts, otherwise
   after a MessageChannel yield (a hidden tab still finishes; no rAF). A job is
   gated: while gate() is false (GAME + PLAY or the INTRO show) no step resolves,
   it parks until wake() finds the gate open again. cancel() rejects the next (or
   the parked) step with {cancelled:true}. Progress is a fixed band per phase per
   look, so the fill never moves back; a phase with no total is indeterminate. */
export const PHASES = Object.freeze(["files", "eval", "bake", "build", "shaders", "warm"]);
const band = (ps) => {
  const o = {}, s = 1 / ps.length;
  ps.forEach((p, i) => { o[p] = Object.freeze({ at: i * s, w: s }); });
  return Object.freeze(o);
};
/* Equal shares until measure.md has medians per phase (builder-check ruling 1). */
export const BANDS = Object.freeze({
  px: band(["files", "eval", "bake", "build", "warm"]),
  "3d": band(["files", "eval", "build", "shaders", "warm"]),
});
export const CANCELLED = Object.freeze({ cancelled: true });
export const LOOK_LABEL = Object.freeze({ "2d": "CLASSIC 2D", px: "PIXEL", "3d": "REAL 3D", iso: "CLASSIC 2D" });

export function fillOf(look, phase, done, total) {
  const b = BANDS[look] && BANDS[look][phase];
  if (!b) return null;
  return b.at + (total > 0 ? b.w * Math.min(Math.max(done, 0), total) / total : 0);
}

const nowOf = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
const chanOf = () => (typeof MessageChannel === "function" ? new MessageChannel() : null);

export function createJob(o = {}) {
  const budget = o.budgetMs != null ? o.budgetMs : 8, now = o.now || nowOf, gate = o.gate || (() => true), mkChan = o.channel || chanOf;
  let t0 = now(), wait = null, yielding = false, f = 0, phase = null, done = 0, total = null;
  const settle = (fn, v) => { const w = wait; wait = null; if (w) w[fn](v); };
  function yieldNow() {
    if (yielding || !wait) return;
    yielding = true;
    const back = () => {
      yielding = false;
      if (J.cancelled) return settle("rej", CANCELLED);
      if (!gate()) return; // parked: wake() picks it up in the next idle state
      t0 = now();
      settle("res");
    };
    const ch = mkChan();
    if (!ch) return void setTimeout(back, 0);
    ch.port1.onmessage = () => { if (ch.port1.close) ch.port1.close(); back(); };
    ch.port2.postMessage(0);
  }
  const J = {
    cancelled: false,
    get parked() { return !!wait && !yielding; },
    step() {
      if (J.cancelled) return Promise.reject(CANCELLED);
      if (gate() && now() - t0 < budget) return Promise.resolve();
      return new Promise((res, rej) => {
        wait = { res, rej };
        if (gate()) yieldNow();
      });
    },
    wake() { if (wait && !yielding && !J.cancelled && gate()) yieldNow(); },
    cancel() {
      if (J.cancelled) return;
      J.cancelled = true;
      if (!yielding) settle("rej", CANCELLED);
    },
    report(p, d, t) {
      const tot = t > 0 ? t : null, dn = tot == null ? 0 : Math.min(Math.max(d | 0, 0), tot);
      const v = fillOf(o.look, p, dn, tot);
      if (v != null) f = Math.max(f, v);
      phase = p; done = dn; total = tot;
      if (o.report) o.report(J.state());
    },
    state: () => ({ phase, done, total, f, ind: total == null }),
  };
  return J;
}

/* Fetch first (v202): a plain fetch() of each file of a look warms the HTTP /
   service-worker cache and evaluates nothing; each body is read to its end so the
   cache entry completes. A miss is no error here: the import that follows reports
   it. Resolves with the number of files that came in. */
export function prefetch(urls, get = (u) => globalThis.fetch(u)) {
  if (!urls || !urls.length) return Promise.resolve(0);
  let n = 0;
  const one = (u) => Promise.resolve().then(() => get(u)).then((r) => { if (!r || !r.ok) return; n++; return r.arrayBuffer ? r.arrayBuffer() : null; }).catch(() => {});
  return Promise.all(urls.map(one)).then(() => n);
}
