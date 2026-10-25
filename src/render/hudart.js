/* PIXEL HUD and GUIDE art (ruling R19, wave W5). In PIXEL the HUD item chips
   and the GUIDE ITEMS / ENEMIES / HOW TO pages show the board's own cells,
   read LIVE from the atlas the px renderer registered (setPixelArt), so
   finished art replaces a placeholder with no copy and no second bake. A cell
   lands on whole logical px at an integer scale, centred on its opaque box,
   smoothing off: x1 in a HUD chip (the life hearts, in the y 25 row, x2: 2D hearts are about 22 px); on a GUIDE page x2 only when EVERY cell on
   that page fits the slot at x2 (pageScale), else x1 for the whole page, so
   one grid never mixes sizes. The slot is the vector well plus 4 px a side.
   Nothing registered => null, and the caller paints vector. Text stays the
   shared vector font. */
let art = null;
export const setPixelArt = (a) => { art = a || null; };
export const pixelArt = () => art;
export const HUD_S = 1, GUIDE_S = 2, SLOT_PAD = 8;

const boxes = new WeakMap();
export function opaqueBox(f) {
  let b = boxes.get(f);
  if (b) return b;
  const im = f.im, w = f.w, h = f.h;
  let d = im && im.data;
  if (!d && im && im.getContext) { try { d = im.getContext("2d").getImageData(0, 0, w, h).data; } catch (e) { d = null; } }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  if (d) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  b = x1 < 0 ? {x: 0, y: 0, w, h} : {x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1};
  boxes.set(f, b);
  return b;
}

export const itemCell = (A, t) => (A.items.glyph[t] ? [A.items.glyph[t]] : []);
export function foeCell(A, t) {
  const s = A.foe[t] || A.foe.walker;
  if (s.face) return [s.face[0][0]];
  return s.layout === "shade" && s.extra ? [s.still[0], s.extra] : [s.still[0]];
}

export function pageScale(cells, slot) {
  for (const fs of cells) { if (!fs.length) continue; const b = opaqueBox(fs[0]); if (Math.max(b.w, b.h) * GUIDE_S > slot) return HUD_S; }
  return GUIDE_S;
}

export function blitCell(c, fs, cx, cy, s, ref) {
  if (!fs.length) return;
  const f0 = ref || fs[0], b = opaqueBox(f0);
  const X = Math.round(cx - (b.x + b.w / 2) * s), Y = Math.round(cy - (b.y + b.h / 2) * s);
  c.save();
  c.imageSmoothingEnabled = false;
  for (const f of fs) c.drawImage(f.im, X + (f0.ax - f.ax) * s, Y + (f0.ay - f.ay) * s, f.w * s, f.h * s);
  c.restore();
}

/* The GUIDE pages are alive in PIXEL: the same frames the board plays (idle breath + blink, rocket flame, sentry pulse, spin, shade hem, burrow plume,
   pickup ring flip + hover), picked by a pure function of the page clock at the board's own rates (A.timing = pixel/timing.js PX_T, registered with the
   atlas, so this file imports nothing). o = {idleW, blink} from motion.js (menudraw passes foeM(type).idleW and blinkAt > 0.5), the same inputs the board
   uses. {fs, ref}: blitCell centres on ref (the still frame), so no frame shifts the cell. */
const SEQ3 = [0, 1, 0, 2], PULSE = [0, 1, 2, 1], tick = (t, fps, n) => Math.floor(Math.max(0, t) * fps + 1e-9) % n;
const DEF_T = { FLAME_FPS: 10, PULSE_FPS: 1.5, SPIN_FPS: 12.7, HEM_FPS: 4, PLUME_FPS: 6, RING_FPS: 2 };
export const seedOf = (k) => { let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0; return (h & 255) / 255; };
export function foeAnim(A, t, time, o) {
  const s = A.foe[t] || A.foe.walker, ref = foeCell(A, t)[0], T = time || 0, L = s.layout, X = A.timing || DEF_T, ph = seedOf(t), bl = !!(o && o.blink);
  const iw = o && o.idleW ? o.idleW : 3.1416;
  let f, fs;
  if (s.walk) { f = s.idle[0][((T * iw / 6.2832 + ph) % 1) < 0.62 ? 0 : 1]; fs = [f.blink && bl ? f.blink : f]; if (L === "burrow" && s.extra) fs.push(s.extra[tick(T, X.PLUME_FPS, 3)]); }
  else if (L === "rocket") fs = [s.face[0][SEQ3[tick(T + ph, X.FLAME_FPS, 4)]]];
  else if (L === "still") { f = s.still[PULSE[tick(T + ph, X.PULSE_FPS, 4)]]; fs = [f.blink && bl ? f.blink : f]; }
  else if (L === "spin") fs = [s.still[tick(T, X.SPIN_FPS, 8)]];
  else if (s.still) { f = s.still[SEQ3[tick(T + ph, X.HEM_FPS, 4)]]; fs = [f.blink && bl ? f.blink : f]; if (s.extra) fs.push(s.extra); }
  else fs = foeCell(A, t);
  return { fs, ref };
}
export function itemAnim(A, t, time) {
  const g = A.items.glyph[t], r = A.items.ring && A.items.ring[t], T = time || 0, X = A.timing || DEF_T;
  if (!g) return { fs: [], ref: null };
  const hov = Math.round(Math.sin(2.4 * T + seedOf(t) * 6.28));
  return { fs: r ? [r[tick(T + seedOf(t), X.RING_FPS, 2)], g] : [g], ref: g, dy: hov };
}
export function blitAnim(c, a, cx, cy, s) {
  if (a.fs.length) blitCell(c, a.fs, cx, cy + (a.dy || 0) * s * 0.5, s, a.ref);
}

export function hudIcon(A) {
  const memo = {};
  return (c, type, col, x, y) => blitCell(c, memo[type] || (memo[type] = itemCell(A, type)), x, y, type === "heart" && y === 25 ? 2 : HUD_S);
}
