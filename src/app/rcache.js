export const REL_T = 10000;

const STUB = () => ({ ctx: { save() {}, restore() {}, translate() {}, scale() {} }, render() {}, consumeEvents() {} });

export function mountRenderers(env) {
  const { canvas, rig, make, size, kind, onSwap, onReady, loadRenderer3D } = env;
  const opts = env.opts || {};
  const perf = () => (env.perf ? env.perf() : null);
  const el = (id) => (typeof document !== "undefined" && document && document.getElementById ? document.getElementById(id) : null);
  const cache = {}, seen = {}, slept = {};
  let mk3d = opts.createRenderer3D || null, threeP = null, lastK = null;
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
    const r = k === "3d" ? mk3d(glEl, canvas, { ...o, rig }) : k === "px" ? make.px(el("px"), canvas, o) : make["2d"](canvas, { kind: k, ...o });
    if (lastK && r && r.setPerf) r.setPerf(K || lastK);
    return r;
  }
  function get(k) {
    if (k === "3d" && cache["3d"] && cache["3d"].dead) drop3d();
    sizeCanvases(k);
    delete slept[k];
    if (cache[k]) {
      if (cache[k].invalidate) cache[k].invalidate(true);
      return cache[k];
    }
    if (k === "3d" && !mk3d) {
      if (!threeP)
        threeP = loadRenderer3D().then((m) => {
          mk3d = m.createRenderer3D;
          if (kind() === "3d") onSwap(get("3d"));
        }).catch((e) => console.warn("3D load failed", e)).then(() => onReady());
      return cache["2d"] || get("2d");
    }
    try {
      cache[k] = build(k, el("gl"), perf());
    } catch (e) {
      console.warn("renderer init failed", e);
      cache[k] = STUB();
    }
    return cache[k];
  }
  if (env.eager && !mk3d)
    loadRenderer3D().then((m) => {
      mk3d = m.createRenderer3D;
      onSwap(get("3d"));
    }).catch((e) => console.warn("3D load failed", e)).then(() => onReady());
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
    if (!old || !oe || !mk3d || !oe.cloneNode || !oe.parentNode) return false;
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
    has3d: () => !!mk3d,
  };
}
