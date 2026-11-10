/* Shared canvas recorder for text-fit tests: measureText = len * widthK * px * scale (px from the live ctx.font); texts, rects, styles and calls are captured at call time. Unknown methods are logged no-ops. */
export function rec({ widthK = 0.6, scale = 1 } = {}) {
  const texts = [], rects = [], calls = [], styles = new Set(), stack = [];
  let m = [1, 0, 0, 1, 0, 0];
  const px = (f) => { const r = /(\d+(?:\.\d+)?)px/.exec(f || ""); return r ? +r[1] : 10; };
  const wOf = (s) => String(s).length * widthK * px(o.font) * scale;
  const note = (v) => { if (typeof v === "string") styles.add(v); return v; };
  const mul = (a, b, c, d, e, f) => { const [A, B, C, D, E, F] = m; m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F]; };
  const o = {
    font: "10px sans-serif", fillStyle: "#000", strokeStyle: "#000", textAlign: "left", globalAlpha: 1,
    measureText: (s) => ({ width: wOf(s) }),
    fillText(s, x, y) { texts.push({ s: String(s), x, y, w: wOf(s), font: o.font, fill: note(o.fillStyle), align: o.textAlign }); },
    strokeText(s, x, y) { texts.push({ s: String(s), x, y, w: wOf(s), font: o.font, fill: o.fillStyle, stroke: note(o.strokeStyle), align: o.textAlign }); },
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, fill: note(o.fillStyle) }); },
    strokeRect(x, y, w, h) { rects.push({ x, y, w, h, stroke: note(o.strokeStyle) }); },
    save() { stack.push({ m, font: o.font, fillStyle: o.fillStyle, strokeStyle: o.strokeStyle, textAlign: o.textAlign, globalAlpha: o.globalAlpha }); },
    restore() { const s = stack.pop(); if (s) { m = s.m; o.font = s.font; o.fillStyle = s.fillStyle; o.strokeStyle = s.strokeStyle; o.textAlign = s.textAlign; o.globalAlpha = s.globalAlpha; } },
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
    set(t, k, v) { t[k] = v; return true; },
  });
  return { ctx, texts, rects, styles, calls };
}
