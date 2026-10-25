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

export function blitCell(c, fs, cx, cy, s) {
  if (!fs.length) return;
  const f0 = fs[0], b = opaqueBox(f0);
  const X = Math.round(cx - (b.x + b.w / 2) * s), Y = Math.round(cy - (b.y + b.h / 2) * s);
  c.save();
  c.imageSmoothingEnabled = false;
  for (const f of fs) c.drawImage(f.im, X + (f0.ax - f.ax) * s, Y + (f0.ay - f.ay) * s, f.w * s, f.h * s);
  c.restore();
}

export function hudIcon(A) {
  const memo = {};
  return (c, type, col, x, y) => blitCell(c, memo[type] || (memo[type] = itemCell(A, type)), x, y, type === "heart" && y === 25 ? 2 : HUD_S);
}
