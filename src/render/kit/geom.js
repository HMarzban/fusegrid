/* KIT GEOMETRY: the shapes every page measures with (R1 kit harmonisation). Pure.
   deep   freezes an object and every object inside it (a page's frozen size tables).
   R      a rect {x, y, w, h}.  sc  a rect scaled by u (design px to box units), null stays null.
   okBox  a frame with a finite, non-zero box (a zero or non-finite box draws nothing and hits nothing).
   inR    (r, x, y, ex = 0, ey = ex) the point inside r grown by ex / ey; right and bottom edges open; a missing r is never hit.
   big    a text scale over 1.1 takes a page's 125 % sizes. */
export const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
export const R = (x, y, w, h) => ({x, y, w, h});
export const sc = (r, u) => (r ? {x: r.x * u, y: r.y * u, w: r.w * u, h: r.h * u} : null);
export const okBox = (F) => !!F && F.W > 0 && F.H > 0 && Number.isFinite(F.W) && Number.isFinite(F.H);
export const inR = (r, x, y, ex = 0, ey = ex) => !!r && x >= r.x - ex && x < r.x + r.w + ex && y >= r.y - ey && y < r.y + r.h + ey;
export const big = (ts) => ts > 1.1;
