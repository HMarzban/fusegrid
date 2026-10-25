export const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
export const mix = (top, bot, a) => { const t = rgb(top), b = rgb(bot); return hex(t.map((v, i) => v * a + b[i] * (1 - a))); };
export const hsh = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function floorTile(c, b, par) {
  c.fillStyle = par ? b.floor1 : b.floor0; c.fillRect(0, 0, 40, 40);
  c.save(); c.globalAlpha = 0.25; c.strokeStyle = par ? b.floor0 : b.floor1; c.lineWidth = 1; c.strokeRect(1.5, 1.5, 37, 37); c.restore();
}
