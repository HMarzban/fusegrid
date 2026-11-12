/* KIT PROBE (R15): what a page says it drew, for tools/ui/gates.mjs (a canvas has no DOM rects). Pages record as they paint; main hands snapshot()
   and setOn() to the debug hook as window.__GAME__.ui, and only tools/ui/shots.mjs switches it on (__GAME__.ui.on(true)): a plain ?debug=1 session,
   tools/pixel/shot.mjs included, and every normal page load pay one property read per call. It records only, never draws. No DOM at import.
   Coordinates are the page's logical box px, x y the top-left corner; every number must be finite, every region must have area (w and h > 0: the
   mocks sample element rects only, never a point), and every colour must be an opaque #rrggbb, #rgb, rgb() or rgba(.., 1) with channels 0..255
   (an 8-digit hex is refused, here and in gates.mjs). While on, a bad value throws, as do an unknown pair kind or text role and body text without
   o.px; the first such fault is kept in the record (`fault`, until setOn) before the throw, so a page that stops painting half-way can never hand
   gates.mjs a short record that passes: the record gate fails on it.
   begin(page, box)            once per frame, first: clears the last frame and names the page; box = {w, h, dpr, el}, the logical box the page measured
                               against, its backing dpr and the id of the canvas it drew on ("sh" or "c"), which gates.mjs needs to find it in a capture;
                               gates.mjs maps the box onto that canvas's whole CSS content box (true of #sh's shell box and of #c's 600 x 520).
   place(o)                    where the next pages' boxes sit (Task 9.8), until place(null): o = {el, oy, fw, fh}, a box that is a band of a canvas
                               (a phone's over box on #sh: its top oy and the canvas's whole box fw x fh, box units); begin then records el, oy, fw
                               and fh, and gates.mjs maps the box onto that band.
   rect(name, x, y, w, h, o)   a drawn part. o.touch a touch target (o.set its target set, o.kind list|tab|bank|step: same-kind members of a set are exempt
                               from the gap floor), o.focus the focused part, o.fill its face colour (#ffd447 parts are counted), o.plate its ring width T in
                               box px (true: the appendix T, 16 desktop / 10 phone CSS px).
   text(s, x, y, w, capH, o)   a drawn string's cap band: x y its top-left, w the drawn width, capH the cap height; o.role primary (default) | secondary |
                               hud | body, o.px the font px (required for body: body is gated on it), o.col the text colour (the contrast gate needs it),
                               o.lock a locked legend or separator (3:1).
   pair(kind, a, b, o)         a declared squint pair. kind chosen (chosen vs unchosen; keycap vs chosen), band (focus band vs bed), ring (a the ring,
                               b the plate around it), locked (a the locked part, b a chosen part; o.floor a floor cell for the texture sd), info (a NON-TEXT
                               mark, a chevron, glyph, icon or meter, with its colour o.col, required; b the background around it: gates.mjs masks a out
                               of b). a b are rects {x, y, w, h} or arrays [x, y, w, h]. o.name labels the pair, o.lock the 3:1 floor.
   snapshot()                  a plain JSON copy {page, box, rects, texts, pairs, frames, overflow, fault}; setOn(false) clears it. Only primitive o fields are
                               kept. Each list holds at most CAP_N entries a frame: more (a page recording without begin) sets overflow, a gate fail.
   Record outside cache.layer paint callbacks: a cached paint runs on a miss only, so its calls would vanish at the next frame's begin. */
export const PAIR_KINDS = Object.freeze(["chosen", "band", "ring", "info", "locked"]);
export const ROLES = Object.freeze(["primary", "secondary", "hud", "body"]);
export const CAP_N = 2048;
export const probe = { on: false, page: "", box: null, rects: [], texts: [], pairs: [], frames: 0, overflow: false, fault: null, at: null };

/* every throw is a fault the record keeps (the first one, until setOn) */
const bad = (what) => { const m = "kit probe: " + what; if (!probe.fault) probe.fault = m; throw new Error(m); };
const num = (v, what) => (typeof v === "number" && Number.isFinite(v) ? v : bad(what + " is not a finite number: " + v));
const pos = (v, what) => (num(v, what) > 0 ? v : bad(what + " must be > 0 (a region needs area): " + v));
const COL = /^(?:#([0-9a-f]{3}|[0-9a-f]{6})|rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*1(?:\.0*)?\s*)?\))$/i;
const col = (v, what) => {
  const m = typeof v === "string" && COL.exec(v.trim());
  return m && (m[1] || [m[2], m[3], m[4]].every((c) => +c <= 255)) ? v.trim() : bad(what + " is not an opaque #rrggbb, #rgb, rgb() or rgba(.., 1) colour: " + v);
};
const prim = (o, r = {}) => {
  if (o) for (const k in o) { const v = o[k]; if (v === null || (v !== undefined && typeof v !== "object" && typeof v !== "function")) r[k] = v; }
  return r;
};
const region = (p, what) => {
  if (Array.isArray(p)) return { x: num(p[0], what + " x"), y: num(p[1], what + " y"), w: pos(p[2], what + " w"), h: pos(p[3], what + " h") };
  if (!p || typeof p !== "object") bad(what + " is not a rect");
  return Object.assign(prim(p), { x: num(p.x, what + " x"), y: num(p.y, what + " y"), w: pos(p.w, what + " w"), h: pos(p.h, what + " h") });
};
const push = (list, v) => { if (list.length >= CAP_N) probe.overflow = true; else list.push(v); };
const clear = () => { probe.page = ""; probe.box = null; probe.rects = []; probe.texts = []; probe.pairs = []; probe.overflow = false; };

export function setOn(b) {
  probe.on = !!b;
  if (!probe.on) { clear(); probe.frames = 0; probe.fault = null; }
}
export function place(o) { probe.at = o ? { el: String(o.el), oy: num(o.oy, "place oy"), fw: pos(o.fw, "place fw"), fh: pos(o.fh, "place fh") } : null; }
export function begin(page, box) {
  if (!probe.on) return;
  clear();
  probe.frames++;
  probe.page = String(page);
  if (!box) return;
  const w = pos(box.w, "box w"), h = pos(box.h, "box h"), dpr = box.dpr === undefined ? 1 : pos(box.dpr, "box dpr"), at = probe.at;
  probe.box = at ? { w, h, dpr, el: at.el, oy: at.oy, fw: at.fw, fh: at.fh } : { w, h, dpr, el: box.el ? String(box.el) : null };
}
export function rect(name, x, y, w, h, o) {
  if (!probe.on) return;
  const r = prim(o), what = "rect " + name;
  if (o && o.fill !== undefined) r.fill = col(o.fill, what + " fill");
  if (o && o.plate !== undefined && o.plate !== true && o.plate !== false) r.plate = pos(o.plate, what + " plate");
  push(probe.rects, Object.assign(r, { name: String(name), x: num(x, what + " x"), y: num(y, what + " y"), w: pos(w, what + " w"), h: pos(h, what + " h") }));
}
export function text(s, x, y, w, capH, o) {
  if (!probe.on) return;
  const t = prim(o), role = (o && o.role) || "primary", what = "text " + JSON.stringify(String(s));
  if (!ROLES.includes(role)) bad(what + ": unknown role " + role);
  if (role === "body" && (!o || o.px === undefined)) bad(what + ": body text needs o.px");
  if (o && o.px !== undefined) t.px = pos(o.px, what + " px");
  if (o && o.col !== undefined) t.col = col(o.col, what + " col");
  push(probe.texts, Object.assign(t, { s: String(s), x: num(x, what + " x"), y: num(y, what + " y"), w: pos(w, what + " w"), capH: pos(capH, what + " capH"), role }));
}
export function pair(kind, a, b, o) {
  if (!probe.on) return;
  if (!PAIR_KINDS.includes(kind)) bad("unknown pair kind " + kind);
  const p = prim(o);
  if (kind === "info" || (o && o.col !== undefined)) p.col = col(o && o.col, kind + " pair col (an info pair names its mark's colour)");
  Object.assign(p, { kind, a: region(a, kind + " pair a"), b: region(b, kind + " pair b") });
  if (o && o.floor !== undefined) p.floor = region(o.floor, kind + " pair floor");
  push(probe.pairs, p);
}
export const snapshot = () => JSON.parse(JSON.stringify({ page: probe.page, box: probe.box, rects: probe.rects, texts: probe.texts, pairs: probe.pairs, frames: probe.frames, overflow: probe.overflow, fault: probe.fault }));
