/* KIT PARTS (UI upgrade v202 Task 9.10): the parts SETTINGS (pages/settings.js) and CONTROLS (pages/controls.js) both paint, moved byte for byte
   from settings.js so neither page imports the other. meterCell a meter's brick cell, mark a page's small marks on the 16-unit grid, course a wall
   course between row groups, slab the pane: the world's floor framed in its own wall cells. slab's sub is the layer maker its wall cell goes
   through (a page that collects its small layers hands its own; default the kit cache's layer). Lazy: only the two lazy pages import it. */
import {CONST} from "./tokens.js";
import {glyph, wallCell, rfill as rr} from "./paint.js";
import {layer, canMake} from "./cache.js";
import {deviceScale} from "../logo/draw2d.js";

export const SLAB = 10;
/* the meter's cell: a small key, radius 3; lit = the brick standing up 2 px with its brickHi strip, mid = the brick's darker step, well = sunk */
export function meterCell(c, r, kind, tok) {
  const y = r.y - (kind === "lit" ? 2 : 0), ix = r.x + 2, iy = y + 2, iw = r.w - 4, ih = r.h - 4;
  if (kind !== "well") rr(c, r.x, y + 3, r.w, r.h, 3, CONST.ol);
  rr(c, r.x, y, r.w, r.h, 3, CONST.ol);
  if (kind === "lit") { c.fillStyle = tok.lit2; c.fillRect(ix, iy, iw, ih); c.fillStyle = tok.lit; c.fillRect(ix, iy, iw, ih * 0.54); c.fillStyle = tok.lithi; c.fillRect(ix, iy + 1, iw, 3); c.fillStyle = tok.lip; c.fillRect(ix, iy + ih - 4, iw, 4); }
  else if (kind === "mid") { c.fillStyle = tok.mid; c.fillRect(ix, iy, iw, ih); c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(ix, iy + ih - 4, iw, 4); }
  else { c.fillStyle = tok.well; c.fillRect(ix, iy, iw, ih); c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(ix, iy, iw, 3); }
}
/* the page's own marks on the 16-unit grid: the stepped arrows' chevrons, the arrow keycaps, reset and lock */
export function mark(c, n, x, y, s, col) {
  if (n === "chev" || n === "up" || n === "dn") return glyph(c, n, x, y, s, col);
  c.save(); c.translate(x, y); c.scale(s / 16, s / 16); c.strokeStyle = c.fillStyle = col; c.lineCap = c.lineJoin = "round"; c.beginPath();
  if (n === "chl") { c.lineWidth = 2.4; c.moveTo(10, 3); c.lineTo(5, 8); c.lineTo(10, 13); c.stroke(); }
  else if (n === "lf") { c.moveTo(11, 3); c.lineTo(5, 8); c.lineTo(11, 13); c.closePath(); c.fill(); }
  else if (n === "rt") { c.moveTo(5, 3); c.lineTo(11, 8); c.lineTo(5, 13); c.closePath(); c.fill(); }
  else if (n === "reset") { c.lineWidth = 2.2; c.arc(8, 8, 4.5, Math.PI, -Math.PI / 2, true); c.lineTo(5, 3.5); c.moveTo(6.5, 1); c.lineTo(4, 3.5); c.lineTo(6.5, 6); c.stroke(); }
  else if (n === "lock") { c.lineWidth = 2; c.moveTo(4.5, 7); c.lineTo(4.5, 5); c.arc(8, 5, 3.5, Math.PI, 0); c.lineTo(11.5, 7); c.stroke(); c.beginPath(); c.rect(3, 7, 10, 7.5); c.fill(); }
  c.restore();
}
export function course(c, r, tok) {
  c.fillStyle = CONST.ol; c.fillRect(r.x, r.y, r.w, 2);
  c.fillStyle = tok.band; c.fillRect(r.x, r.y + 2, r.w, 1);
  c.fillStyle = CONST.ol; for (let x = r.x + 16; x < r.x + r.w - 3; x += 32) c.fillRect(x, r.y - 1, 3, 4);
}
/* one wall cell at the slab's size and this context's density, a small layer the frame blits; with no canvas source (Node) the frame is the
   wall's flat colour */
function slabCell(c, tok, sub) {
  if (!canMake()) return null;
  const k = deviceScale(c), n = Math.max(1, Math.round(SLAB * k));
  return sub({layer: "settings.slab", biome: tok.name, level: 0, W: n, H: n, dpr: +k.toFixed(4), look: "2d", textScale: 1}, n, n, (g) => { g.scale(n / SLAB, n / SLAB); wallCell(g, 0, 0, SLAB, tok, {code: 1}); });
}
/* the pane: a slab of the world's floor framed in its own wall cells (the mock's slab()) */
export function slab(c, P, tok, sub = layer) {
  c.fillStyle = tok.pane; c.fillRect(P.x, P.y, P.w, P.h);
  c.save(); c.beginPath(); c.rect(P.x, P.y, P.w, P.h); c.rect(P.x + SLAB, P.y + SLAB, P.w - 2 * SLAB, P.h - 2 * SLAB); c.clip("evenodd");
  const cell = slabCell(c, tok, sub), put = (x, y) => (cell ? c.drawImage(cell, x, y, SLAB, SLAB) : c.fillRect(x, y, SLAB, SLAB));
  c.fillStyle = tok.wall;
  for (let x = P.x; x < P.x + P.w; x += SLAB) { put(x, P.y); put(x, P.y + P.h - SLAB); } // the frame only: top and bottom courses, then the two sides
  for (let y = P.y + SLAB; y < P.y + P.h - SLAB; y += SLAB) { put(P.x, y); put(P.x + P.w - SLAB, y); }
  c.fillStyle = "rgba(6,4,6,0.42)"; c.fillRect(P.x, P.y, P.w, P.h);
  c.restore();
  c.strokeStyle = CONST.ol; c.lineWidth = 2; c.strokeRect(P.x + 1, P.y + 1, P.w - 2, P.h - 2); c.strokeRect(P.x + SLAB - 1, P.y + SLAB - 1, P.w - 2 * SLAB + 2, P.h - 2 * SLAB + 2);
}
