/* KIT PROBE (R15): what a page says it drew, for tools/ui/gates.mjs (a canvas has no DOM rects). Pages record as they paint; main hands snapshot()
   and setOn() to the debug hook as window.__GAME__.ui, and only tools/ui/shots.mjs switches it on (__GAME__.ui.on(true)): a plain ?debug=1 session,
   tools/pixel/shot.mjs included, and every normal page load pay one property read per call. It records only, never draws. No DOM at import.
   Coordinates are the page's logical box px, x y the top-left corner; every number must be finite and every colour an opaque #rrggbb, #rgb or rgb():
   while on, a bad value throws (a page bug the gates could not judge), as do an unknown pair kind or text role and body text without o.px.
   begin(page, box)            once per frame, first: clears the last frame and names the page; box = {w, h, dpr, el}, the logical box the page measured
                               against, its backing dpr and the id of the canvas it drew on ("sh" or "c"), which gates.mjs needs to find it in a capture;
                               gates.mjs maps the box onto that canvas's whole CSS content box (true of #sh's shell box and of #c's 600 x 520).
   rect(name, x, y, w, h, o)   a drawn part. o.touch a touch target (o.set its target set, o.kind list|tab|bank|step: same-kind members of a set are exempt
                               from the gap floor), o.focus the focused part, o.fill its face colour (#ffd447 parts are counted), o.plate its ring width T in
                               box px (true: the appendix T, 16 desktop / 10 phone CSS px).
   text(s, x, y, w, capH, o)   a drawn string's cap band: x y its top-left, w the drawn width, capH the cap height; o.role primary (default) | secondary |
                               hud | body, o.px the font px (required for body: body is gated on it), o.col the text colour (the contrast gate needs it),
                               o.lock a locked legend or separator (3:1).
   pair(kind, a, b, o)         a declared squint pair. kind chosen (chosen vs unchosen; keycap vs chosen), band (focus band vs bed), ring (a the ring,
                               b the plate around it), locked (a the locked part, b a chosen part; o.floor a floor cell for the texture sd), info (a NON-TEXT
                               mark, a chevron, glyph, icon or meter, with its colour o.col, required; b the background around it). a b are points {x, y},
                               rects {x, y, w, h} or arrays [x, y, w, h]. o.name labels the pair, o.lock the 3:1 floor.
   snapshot()                  a plain JSON copy {page, box, rects, texts, pairs, frames, overflow}; setOn(false) clears it. Only primitive o fields are
                               kept. Each list holds at most CAP_N entries a frame: more (a page recording without begin) sets overflow, a gate fail.
   Record outside cache.layer paint callbacks: a cached paint runs on a miss only, so its calls would vanish at the next frame's begin. */
export const PAIR_KINDS = Object.freeze(["chosen", "band", "ring", "info", "locked"]);
export const ROLES = Object.freeze(["primary", "secondary", "hud", "body"]);
export const CAP_N = 2048;
export const probe = { on: false, page: "", box: null, rects: [], texts: [], pairs: [], frames: 0, overflow: false };

const bad = (what) => { throw new Error("kit probe: " + what); };
const num = (v, what) => (typeof v === "number" && Number.isFinite(v) ? v : bad(what + " is not a finite number: " + v));
const opt = (v, what) => (v === undefined ? 0 : num(v, what));
const COL = /^(#[0-9a-f]{6}|#[0-9a-f]{3}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*1(\.0*)?\s*)?\))$/i;
const col = (v, what) => (typeof v === "string" && COL.test(v.trim()) ? v.trim() : bad(what + " is not an opaque #rrggbb, #rgb or rgb() colour: " + v));
const prim = (o, r = {}) => {
  if (o) for (const k in o) { const v = o[k]; if (v === null || (v !== undefined && typeof v !== "object" && typeof v !== "function")) r[k] = v; }
  return r;
};
const area = (p, what) => {
  if (Array.isArray(p)) return { x: num(p[0], what + " x"), y: num(p[1], what + " y"), w: opt(p[2], what + " w"), h: opt(p[3], what + " h") };
  if (!p || typeof p !== "object") bad(what + " is not a point or a rect");
  return Object.assign(prim(p), { x: num(p.x, what + " x"), y: num(p.y, what + " y"), w: opt(p.w, what + " w"), h: opt(p.h, what + " h") });
};
const push = (list, v) => { if (list.length >= CAP_N) probe.overflow = true; else list.push(v); };
const clear = () => { probe.page = ""; probe.box = null; probe.rects = []; probe.texts = []; probe.pairs = []; probe.overflow = false; };

export function setOn(b) {
  probe.on = !!b;
  if (!probe.on) { clear(); probe.frames = 0; }
}
export function begin(page, box) {
  if (!probe.on) return;
  clear();
  probe.frames++;
  probe.page = String(page);
  if (!box) return;
  const w = num(box.w, "box w"), h = num(box.h, "box h"), dpr = box.dpr === undefined ? 1 : num(box.dpr, "box dpr");
  if (!(w > 0 && h > 0 && dpr > 0)) bad("box w, h and dpr must be > 0");
  probe.box = { w, h, dpr, el: box.el ? String(box.el) : null };
}
export function rect(name, x, y, w, h, o) {
  if (!probe.on) return;
  const r = prim(o);
  if (o && o.fill !== undefined) r.fill = col(o.fill, "rect " + name + " fill");
  if (o && o.plate !== undefined && o.plate !== true && o.plate !== false) r.plate = num(o.plate, "rect " + name + " plate");
  push(probe.rects, Object.assign(r, { name: String(name), x: num(x, "rect x"), y: num(y, "rect y"), w: num(w, "rect w"), h: num(h, "rect h") }));
}
export function text(s, x, y, w, capH, o) {
  if (!probe.on) return;
  const t = prim(o), role = (o && o.role) || "primary", what = "text " + JSON.stringify(String(s));
  if (!ROLES.includes(role)) bad(what + ": unknown role " + role);
  if (role === "body" && !(num(o.px, what + " px") > 0)) bad(what + ": body text needs o.px > 0");
  if (o && o.px !== undefined) t.px = num(o.px, what + " px");
  if (o && o.col !== undefined) t.col = col(o.col, what + " col");
  push(probe.texts, Object.assign(t, { s: String(s), x: num(x, what + " x"), y: num(y, what + " y"), w: num(w, what + " w"), capH: num(capH, what + " capH"), role }));
}
export function pair(kind, a, b, o) {
  if (!probe.on) return;
  if (!PAIR_KINDS.includes(kind)) bad("unknown pair kind " + kind);
  const p = prim(o);
  if (kind === "info" || (o && o.col !== undefined)) p.col = col(o && o.col, kind + " pair col (an info pair names its mark's colour)");
  Object.assign(p, { kind, a: area(a, kind + " pair a"), b: area(b, kind + " pair b") });
  if (o && o.floor) p.floor = area(o.floor, kind + " pair floor");
  push(probe.pairs, p);
}
export const snapshot = () => JSON.parse(JSON.stringify({ page: probe.page, box: probe.box, rects: probe.rects, texts: probe.texts, pairs: probe.pairs, frames: probe.frames, overflow: probe.overflow }));
