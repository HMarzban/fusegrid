export const REL_T = 10000;

const STUB = () => ({ ctx: { save() {}, restore() {}, translate() {}, scale() {} }, render() {}, consumeEvents() {} });

export function mountRenderers(env) {
  const { canvas, rig, make, size, kind, onSwap, onReady, onFail, loadRenderer3D, loadRendererPx } = env;
  const opts = env.opts || {};
  const perf = () => (env.perf ? env.perf() : null);
  const el = (id) => (typeof document !== "undefined" && document && document.getElementById ? document.getElementById(id) : null);
  const cache = {}, seen = {}, slept = {};
  const mk = { "3d": opts.createRenderer3D || null, px: opts.createPixelRenderer || null }, LD = { "3d": [loadRenderer3D, "createRenderer3D"], px: [loadRendererPx, "createPixelRenderer"] }, loading = {}, ready = {};
  let lastK = null;
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
  function build(k, glEl, K) {
    const o = { audio: opts.audio || null, perf: K };
    const r = k === "3d" ? mk["3d"](glEl, canvas, { ...o, rig }) : k === "px" ? mk.px(el("px"), canvas, o) : make["2d"](canvas, { kind: k, ...o });
    if (lastK && r && r.setPerf) r.setPerf(K || lastK);
    return r;
  }
  /* window.__load is index.html's loader (no page, no loader: Node and hosts stay
     synchronous). With it, every first build of a lazy look is a job: the bar is
     up and painted BEFORE the fetch and again BEFORE the synchronous bake, and
     stays until the first frame of that build has been drawn. */
  const bar = env.bar || null, LB = () => (bar && globalThis.__load) || null;
  function fetchLook(k) {
    const [raw, fn] = LD[k], lb = LB();
    if (!lb) return raw;
    const have = !!mk[k];
    lb.begin(k, bar.lookPlan(k), have);
    return () => bar.paintYield().then(() => (have ? { [fn]: mk[k] } : raw())).then((m) => {
      lb.phase(k);
      return bar.paintYield().then(() => { ready[k] = true; return m; });
    });
  }
  function lookFailed(k, e) {
    console.warn(k === "px" ? "PIXEL load failed" : "3D load failed", e);
    const lb = LB(), drop = () => { if (onFail) onFail(k); };
    if (lb && kind() === k) lb.fail(k, drop); // the pick stays until the player answers: RETRY reloads into it
    else if (k === "px") drop();
  }
  function settled(k) {
    const lb = LB();
    if (!lb) return;
    delete loading[k];
    delete ready[k];
    if (kind() === k && cache[k]) bar.afterFirstRender(cache[k], () => lb.end(k));
    else lb.end(k);
  }
  function load(k) {
    if (loading[k]) return loading[k];
    const [, fn] = LD[k], ld = fetchLook(k);
    return (loading[k] = ld().then((m) => {
      mk[k] = m[fn];
      if (kind() === k) onSwap(get(k));
    }).catch((e) => {
      lookFailed(k, e);
    }).then(() => { if (k === "3d" || kind() !== "3d") onReady(); }).then(() => settled(k)));
  }
  function get(k, inner) {
    if (k === "3d" && cache["3d"] && cache["3d"].dead) drop3d();
    if (!inner && LB()) LB().focus(k);
    sizeCanvases(k);
    delete slept[k];
    delete seen[k];
    if (cache[k]) {
      if (cache[k].invalidate) cache[k].invalidate(true);
      return cache[k];
    }
    if ((k === "3d" || k === "px") && (!mk[k] || (LB() && !ready[k]))) {
      load(k);
      return cache["2d"] || get("2d", true);
    }
    try {
      cache[k] = build(k, el("gl"), perf());
    } catch (e) {
      console.warn("renderer init failed", e);
      cache[k] = STUB();
    }
    return cache[k];
  }
  if (env.eager && !mk["3d"]) load("3d");
  if (env.eagerPx && !mk.px) load("px");
  function drop3d() {
    const r = cache["3d"];
    if (!r) return;
    delete cache["3d"];
    delete seen["3d"];
    if (r.dispose) r.dispose();
    const e = el("gl");
    if (e && e.cloneNode && e.replaceWith) e.replaceWith(e.cloneNode(false));
  }
  function rebuild3d(K) {
    const old = cache["3d"], oe = el("gl");
    if (!old || !oe || !mk["3d"] || !oe.cloneNode || !oe.parentNode) return false;
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
      if (r && r.dispose) r.dispose();
      if (fresh.remove) fresh.remove();
      return false;
    }
    oe.replaceWith(fresh);
    fresh.id = "gl";
    if (old.dispose) old.dispose();
    cache["3d"] = r;
    if (kind() === "3d") {
      sizeCanvases("3d");
      onSwap(r);
    }
    return true;
  }
  function tick(t, k) {
    const r3 = cache["3d"];
    if (r3 && r3.dead) {
      drop3d();
      if (k === "3d") onSwap(get("3d"));
    }
    for (const c of Object.keys(cache)) {
      if (c === k) delete slept[c];
      if (c === k || seen[c] == null) seen[c] = t;
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
      for (const c in cache) if (cache[c].setPerf) cache[c].setPerf(K);
    },
    liveAA: () => (cache["3d"] && cache["3d"].liveAA != null ? cache["3d"].liveAA : null),
    rebuild3d,
    drop3d,
    invalidate() {
      for (const c in cache) if (cache[c].invalidate) cache[c].invalidate();
    },
    tick,
    has3d: () => !!mk["3d"],
    hasPx: () => !!mk.px,
  };
}
