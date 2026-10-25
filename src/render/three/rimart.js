/* REAL 3D bezel strip (frame mockup A, 2026-10-25, THROWAWAY). One canvas
   painted from the SAME slot lists as the CLASSIC / PIXEL border (frameart.js
   rails and corner bosses, wallart FAM slots), laid out as a top-down picture
   of the whole rim ring (units x S px, centred on the board) with a strip of
   side face underneath. scene.js gives the ONE rim mesh its own UVs into it:
   top caps sample the ring picture by world (x, z), side faces sample the strip
   by (u along the run, height). Same mesh, same material count, no new draw. */
import {slot2d, FAM, paintShapes} from "../wallart.js";
import {railOf, bossOf} from "../frameart.js";

export const RIM_TEX = {rx: 336, rz: 296, S: 2, strip: 64};
export const rimSize = () => [RIM_TEX.rx * 2 * RIM_TEX.S, (RIM_TEX.rz * 2 + RIM_TEX.strip) * RIM_TEX.S];

const QUIET = 0.4;
const R = (x, y, w, h, c) => ({r: [x, y, w, h], c});
/* world-specific side-face detail: hh = face height; v = 0 at the top of the strip */
const SIDE = {
  JUNGLE: (hh, y0) => [...[10, 20, 30].map((x) => R(x, y0 + 3, 1, hh - 6, "face.pit")), R(18, y0 + 3, 4, hh - 6, "wall.shadow"), R(19, y0 + 5, 2, 2, "wall.outline")],
  ICE: (hh, y0) => [R(6, y0 + 5, 18, 1, "face.grain"), R(14, y0 + 8, 24, 1, "face.grain")],
  FACTORY: (hh, y0) => [R(0, y0 + 4, 40, 1, "face.pit"), ...[5, 15, 25, 35].map((x) => R(x, y0 + 6, 2, 2, "wall.outline"))],
  WATER: (hh, y0) => [R(0, y0 + Math.round(hh * 0.35), 40, 1, "face.grain"), R(0, y0 + Math.round(hh * 0.35) + 1, 40, hh, "wall.outline")],
  ARENA: (hh, y0) => [R(0, y0 + 5, 40, 1, "face.pit"), R(0, y0 + 6, 40, 1, "face.grain")],
  SAND: (hh, y0) => [R(0, y0 + 6, 40, 1, "wall.pit"), R(0, y0 + 11, 40, 1, "face.grain")],
  VOID: (hh, y0) => [R(0, y0 + Math.round(hh / 2), 40, 1, "wallHi")],
  CROWN: (hh, y0) => [R(0, y0 + 4, 40, 1, "wallHi"), R(0, y0 + hh - 6, 40, 1, "wallHi")],
};

/* one straight band of the ring in its own frame: u along (0..len), a across
   from the OUTER edge (0) to the inner edge (38); lo = the lit lip is on the
   outer edge (north / west), else on the inner edge (south / east) */
function band(c, B, res, len, lo) {
  const F = FAM[B.name], lit = "wall.light", shade = "wall.shadow", fill = (sl, x, y, w, h) => paintShapes(c, B, [R(x, y, w, h, sl)], 0, 0, res);
  fill("wall", 0, 0, len, 38);
  fill("wall.outline", 0, 0, len, 1); fill(lo ? lit : shade, 0, 1, len, 2); fill(lo ? shade : lit, 0, 35, len, 2); fill("wall.shadow", 0, 37, len, 1);
  c.save(); c.translate(0, 18 - 11);
  for (let k = 0; k * 40 < len; k++) { c.save(); c.translate(k * 40, 0); paintShapes(c, B, railOf(B, "h"), 0, 0, res); c.restore(); }
  c.restore();
  /* one step quieter than the walls: the rail is veiled toward the body */
  c.save(); c.globalAlpha = QUIET; c.fillStyle = slot2d(B, "wall"); c.fillRect(0, 7, len, 24); c.restore();
}
function corner(c, B, res, lx, ly) {
  const lit = "wall.light", shade = "wall.shadow", fill = (sl, x, y, w, h) => paintShapes(c, B, [R(x, y, w, h, sl)], 0, 0, res);
  /* lx / ly = +1 when the outer edge on that axis is a lit one (west / north) */
  fill("wall", 0, 0, 38, 38);
  const ox = lx > 0 ? 0 : 37, oy = ly > 0 ? 0 : 37, ix = lx > 0 ? 35 : 1, iy = ly > 0 ? 35 : 1;
  fill("wall.outline", ox, 0, 1, 38); fill("wall.outline", 0, oy, 38, 1);
  fill(lx > 0 ? lit : shade, lx > 0 ? 1 : 35, 0, 2, 38); fill(ly > 0 ? lit : shade, 0, ly > 0 ? 1 : 35, 38, 2);
  fill(lx > 0 ? shade : lit, ix, 0, 2, 38); fill(ly > 0 ? shade : lit, 0, iy, 38, 2);
  paintShapes(c, B, bossOf(B, 1.45, 19), 0, 0, res);
  c.save(); c.globalAlpha = QUIET * 0.8; c.fillStyle = slot2d(B, "wall"); c.fillRect(4, 4, 30, 30); c.restore();
}

/* paint the whole strip onto c (S px per unit); res = the slot resolver */
export function paintRim(c, B, res = slot2d, hWall = B.hWall, lip = 6) {
  const {rx, rz, S, strip} = RIM_TEX, F = FAM[B.name], x0 = -300, z0 = -260;
  c.save(); c.scale(S, S); c.translate(rx, rz);
  c.fillStyle = slot2d(B, "wall"); c.fillRect(-rx, -rz, rx * 2, rz * 2);
  const at = (x, y, f) => { c.save(); c.translate(x, y); f(); c.restore(); };
  at(x0, -rz, () => band(c, B, res, 600, true));
  at(x0, rz, () => { c.scale(1, -1); band(c, B, res, 600, false); });
  at(-rx, z0, () => { c.transform(0, 1, 1, 0, 0, 0); band(c, B, res, 520, true); });
  at(rx, z0, () => { c.transform(0, 1, -1, 0, 0, 0); band(c, B, res, 520, false); });
  at(-rx, -rz, () => corner(c, B, res, 1, 1));
  at(rx - 38, -rz, () => corner(c, B, res, -1, 1));
  at(-rx, rz - 38, () => corner(c, B, res, 1, -1));
  at(rx - 38, rz - 38, () => corner(c, B, res, -1, -1));
  c.restore();
  /* side face strip under the ring picture: v 0 = height strip, 64 units tall */
  const H = Math.min(strip, hWall + lip), y0 = strip - H, lit = "wall.light", fill = (sl, x, y, w, h) => paintShapes(c, B, [R(x, y, w, h, sl)], 0, 0, res);
  c.save(); c.translate(0, rz * 2 * S); c.scale(S, S);
  fill(F.face || "wall.shadow", 0, 0, rx * 2, strip);
  for (let k = 0; k * 40 < rx * 2; k++) {
    c.save(); c.translate(k * 40, 0);
    paintShapes(c, B, (SIDE[B.name] || (() => []))(H, y0), 0, 0, res);
    fill("face.pit", 0, y0 + 2, 1, H - 4);
    c.restore();
  }
  fill("wall.outline", 0, y0, rx * 2, 1); fill(lit, 0, y0 + 1, rx * 2, 2); fill("face.ao", 0, strip - 4, rx * 2, 4);
  c.restore();
}
