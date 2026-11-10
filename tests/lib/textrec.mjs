/* Shared canvas recorder for text-fit tests: measureText = len * widthK * px * scale (px from the live ctx.font); texts, rects, styles and calls are captured at call time. Unknown methods are logged no-ops.
   Geometry (kit painters): writes logs every property write as {k, v}; paints logs every fill / stroke / fillRect / strokeRect with the style, lineWidth, globalAlpha and fill rule
   at call time, plus box (the device-space bounds of the whole path after the live transform, cut to the bounds of the live clip; null when clipped away) and subs (one
   unclipped box per subpath). Arc, curve and clip bounds are conservative (a rounded clip counts as its bounding box). */
export function rec({ widthK = 0.6, scale = 1 } = {}) {
  const texts = [], rects = [], calls = [], styles = new Set(), stack = [], writes = [], paints = [];
  let m = [1, 0, 0, 1, 0, 0], path = [], sub = null, cb = null;
  const px = (f) => { const r = /(\d+(?:\.\d+)?)px/.exec(f || ""); return r ? +r[1] : 10; };
  const wOf = (s) => String(s).length * widthK * px(o.font) * scale;
  const note = (v) => { if (typeof v === "string") styles.add(v); return v; };
  const mul = (a, b, c, d, e, f) => { const [A, B, C, D, E, F] = m; m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F]; };
  const r3 = (v) => +v.toFixed(3);
  const dev = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const add = (...p) => { if (!sub) path.push((sub = [])); for (let i = 0; i < p.length; i += 2) sub.push(dev(p[i], p[i + 1])); };
  const open = (...p) => { path.push((sub = [])); add(...p); };
  const bb = (pts) => { if (!pts.length) return null; const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]), x = Math.min(...xs), y = Math.min(...ys); return { x: r3(x), y: r3(y), w: r3(Math.max(...xs) - x), h: r3(Math.max(...ys) - y) }; };
  const cut = (b) => { if (!b || !cb) return b; const x = Math.max(b.x, cb.x), y = Math.max(b.y, cb.y), w = Math.min(b.x + b.w, cb.x + cb.w) - x, h = Math.min(b.y + b.h, cb.y + cb.h) - y; return w < 0 || h < 0 ? null : { x: r3(x), y: r3(y), w: r3(w), h: r3(h) }; };
  const paint = (op, extra) => paints.push({ op, alpha: o.globalAlpha, lw: o.lineWidth, ...extra, box: cut(extra.box) });
  const o = {
    font: "10px sans-serif", fillStyle: "#000", strokeStyle: "#000", textAlign: "left", globalAlpha: 1, lineWidth: 1,
    measureText: (s) => ({ width: wOf(s) }),
    fillText(s, x, y) { texts.push({ s: String(s), x, y, w: wOf(s), font: o.font, fill: note(o.fillStyle), align: o.textAlign }); },
    strokeText(s, x, y) { texts.push({ s: String(s), x, y, w: wOf(s), font: o.font, fill: o.fillStyle, stroke: note(o.strokeStyle), align: o.textAlign }); },
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, fill: note(o.fillStyle) }); paint("fillRect", { style: o.fillStyle, box: bb([dev(x, y), dev(x + w, y + h)]) }); },
    strokeRect(x, y, w, h) { rects.push({ x, y, w, h, stroke: note(o.strokeStyle) }); paint("strokeRect", { style: o.strokeStyle, box: bb([dev(x, y), dev(x + w, y + h)]) }); },
    beginPath() { path = []; sub = null; },
    moveTo(x, y) { open(x, y); },
    lineTo(x, y) { add(x, y); },
    arcTo(x1, y1, x2, y2) { add(x1, y1, x2, y2); },
    quadraticCurveTo(a, b, x, y) { add(a, b, x, y); },
    bezierCurveTo(a, b, c, d, x, y) { add(a, b, c, d, x, y); },
    rect(x, y, w, h) { open(x, y, x + w, y, x + w, y + h, x, y + h); sub = null; },
    roundRect(x, y, w, h) { open(x, y, x + w, y, x + w, y + h, x, y + h); sub = null; },
    arc(x, y, r) { add(x - r, y - r, x + r, y + r); },
    ellipse(x, y, rx, ry) { add(x - rx, y - ry, x + rx, y + ry); },
    closePath() { sub = null; },
    clip() { cb = cut(bb(path.flat())) || { x: 0, y: 0, w: 0, h: 0 }; },
    fill(rule) { paint("fill", { style: o.fillStyle, rule: typeof rule === "string" ? rule : "nonzero", box: bb(path.flat()), subs: path.map(bb) }); },
    stroke() { paint("stroke", { style: o.strokeStyle, box: bb(path.flat()), subs: path.map(bb) }); },
    save() { stack.push({ m, font: o.font, fillStyle: o.fillStyle, strokeStyle: o.strokeStyle, textAlign: o.textAlign, globalAlpha: o.globalAlpha, lineWidth: o.lineWidth, cb }); },
    restore() { const s = stack.pop(); if (s) { m = s.m; o.font = s.font; o.fillStyle = s.fillStyle; o.strokeStyle = s.strokeStyle; o.textAlign = s.textAlign; o.globalAlpha = s.globalAlpha; o.lineWidth = s.lineWidth; cb = s.cb; } },
    translate(x, y) { mul(1, 0, 0, 1, x, y); },
    scale(x, y) { mul(x, 0, 0, y, 0, 0); },
    setTransform(a, b, c, d, e, f) { m = [a, b, c, d, e, f]; },
    resetTransform() { m = [1, 0, 0, 1, 0, 0]; },
    getTransform: () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }),
  };
  const fmt = (v) => (typeof v === "number" ? +v.toFixed(3) : v && typeof v === "object" ? "{o}" : v);
  const grad = () => ({ addColorStop() {} });
  const ctx = new Proxy(o, {
    get(t, k) {
      if (k in t) return typeof t[k] === "function" ? (...a) => { calls.push({ op: String(k), a: a.map(fmt) }); return t[k](...a); } : t[k];
      if (k === "canvas") return { width: 80, height: 80 };
      return (...a) => { calls.push({ op: String(k), a: a.map(fmt) }); return String(k).startsWith("create") ? grad() : undefined; };
    },
    set(t, k, v) { writes.push({ k: String(k), v: fmt(v) }); t[k] = v; return true; },
  });
  return { ctx, texts, rects, styles, calls, writes, paints };
}
