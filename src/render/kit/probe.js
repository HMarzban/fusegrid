/* KIT PROBE (R15): what a page says it drew, for tools/ui/gates.mjs (a canvas has no DOM rects). Pages record as they paint; the debug hook (?debug=1)
   switches it on and hands snapshot() out as window.__GAME__.ui.snap. Off by default: every recorder returns at once unless setOn(true) (the debug hook,
   or a test), so a normal page load pays one property read per call. It records only, never draws. No DOM at import.
   Coordinates are the page's logical box px, x y the top-left corner.
   begin(page, box)            once per frame, first: clears the last frame and names the page; box = {w, h, dpr, el}, the logical box the page measured
                               against, its backing dpr and the id of the canvas it drew on ("sh" or "c"), which gates.mjs needs to find it in a capture;
                               gates.mjs maps the box onto that canvas's whole CSS content box (true of #sh's shell box and of #c's 600 x 520).
   rect(name, x, y, w, h, o)   a drawn part. o.touch a touch target (o.set its target set, o.kind list|tab|bank|step: same-kind members of a set are exempt
                               from the gap floor), o.focus the focused part, o.fill its face colour (#ffd447 parts are counted), o.plate the ring width T.
   text(s, x, y, w, capH, o)   a drawn string's cap band: x y its top-left, w the drawn width, capH the cap height; o.role primary (default) | secondary |
                               hud | body, o.px the font px (body is gated on it), o.col the text colour, o.lock a locked legend or separator (3:1).
   pair(kind, a, b, o)         a declared squint pair. kind chosen (chosen vs unchosen; keycap vs chosen), band (focus band vs bed), ring (a the ring,
                               b the plate around it), info (a the text, b its background), locked (a the locked part, b a chosen part; o.floor a floor
                               cell for the texture sd); a b are points {x, y} or rects {x, y, w, h}, or arrays [x, y, w, h]. o.name labels the pair.
   snapshot()                  a plain JSON copy {page, box, rects, texts, pairs, frames}; setOn(false) clears it. Only primitive o fields are kept.
   Record outside cache.layer paint callbacks: a cached paint runs on a miss only, so its calls would vanish at the next frame's begin. */
export const KINDS = Object.freeze(["chosen", "band", "ring", "info", "locked"]);
export const probe = { on: false, page: "", box: null, rects: [], texts: [], pairs: [], frames: 0 };

const prim = (o, r = {}) => {
  if (o) for (const k in o) { const v = o[k]; if (v === null || (v !== undefined && typeof v !== "object" && typeof v !== "function")) r[k] = v; }
  return r;
};
const area = (p) => (Array.isArray(p) ? { x: +p[0], y: +p[1], w: +(p[2] || 0), h: +(p[3] || 0) } : Object.assign(prim(p), { x: +p.x, y: +p.y, w: +(p.w || 0), h: +(p.h || 0) }));
const clear = () => { probe.page = ""; probe.box = null; probe.rects = []; probe.texts = []; probe.pairs = []; };

export function setOn(b) {
  probe.on = !!b;
  if (!probe.on) { clear(); probe.frames = 0; }
}
export function begin(page, box) {
  if (!probe.on) return;
  clear();
  probe.frames++;
  probe.page = String(page);
  probe.box = box ? { w: +box.w, h: +box.h, dpr: +box.dpr || 1, el: box.el ? String(box.el) : null } : null;
}
export function rect(name, x, y, w, h, o) {
  if (!probe.on) return;
  probe.rects.push(Object.assign(prim(o), { name: String(name), x: +x, y: +y, w: +w, h: +h }));
}
export function text(s, x, y, w, capH, o) {
  if (!probe.on) return;
  probe.texts.push(Object.assign(prim(o), { s: String(s), x: +x, y: +y, w: +w, capH: +capH, role: (o && o.role) || "primary" }));
}
export function pair(kind, a, b, o) {
  if (!probe.on) return;
  if (!KINDS.includes(kind)) throw new Error("kit probe: unknown pair kind " + kind);
  const p = Object.assign(prim(o), { kind, a: area(a), b: area(b) });
  if (o && o.floor) p.floor = area(o.floor);
  probe.pairs.push(p);
}
export const snapshot = () => JSON.parse(JSON.stringify({ page: probe.page, box: probe.box, rects: probe.rects, texts: probe.texts, pairs: probe.pairs, frames: probe.frames }));
