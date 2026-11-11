/* KIT GEOMETRY (R1): deep freeze, rects, a finite box, a hit (grown by ex / ey, right and bottom open), the 125 % switch. */
export const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
export const R = (x, y, w, h) => ({x, y, w, h});
export const sc = (r, u) => (r ? {x: r.x * u, y: r.y * u, w: r.w * u, h: r.h * u} : null);
export const okBox = (F) => !!F && F.W > 0 && F.H > 0 && Number.isFinite(F.W) && Number.isFinite(F.H);
export const inR = (r, x, y, ex = 0, ey = ex) => !!r && x >= r.x - ex && x < r.x + r.w + ex && y >= r.y - ey && y < r.y + r.h + ey;
export const big = (ts) => ts > 1.1;
