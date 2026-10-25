import { paintFloor } from "../floorart.js";
export const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
export const mix = (top, bot, a) => { const t = rgb(top), b = rgb(bot); return hex(t.map((v, i) => v * a + b[i] * (1 - a))); };
export const hsh = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/* the plain floor a tile sits in: the same painter the base floor uses, so the tile has no seam against its neighbours */
export const floorTile = (c, b, par) => paintFloor(c, b, par, 0);
