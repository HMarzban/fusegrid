/* KIT PAGER (R1): the one pager (AGENTS.md "pager"). Whole items per page, the page on screen the focused item's; ▲ ▼ keys PAGE_KEY CSS px
   square (keySide: in a page's design px), PAGE_GAP apart (scaled with k), at the strip's right end, PAGE n OF m left of them. */
import {R, inR} from "./geom.js";
import {key, glyph} from "./paint.js";
import {text} from "./type.js";
import {CONST} from "./tokens.js";

export const PAGE_KEY = 46, PAGE_GAP = 10;
export const keySide = (css, u) => PAGE_KEY / ((css > 0 ? css : 1) * (u > 0 ? u : 1));
export function paginate(hs, gs, cap) {
  const pages = [];
  let cur = [], used = 0;
  hs.forEach((h, i) => {
    const add = (cur.length ? gs[i] : 0) + h;
    if (cur.length && used + add > cap + 1e-6) { pages.push(cur); cur = [i]; used = h; } else { cur.push(i); used += add; }
  });
  if (cur.length) pages.push(cur);
  return pages;
}
export const pageOfFocus = (pageOf, name) => (name != null && pageOf[name] != null ? pageOf[name] : 0);
export function pagerKeys(x, y, w, k) {
  const up = R(x + w - 2 * k - k * PAGE_GAP / PAGE_KEY, y, k, k);
  return {strip: R(x, y, w, k), up, dn: R(x + w - k, y, k, k), label: R(x, y, up.x - 12 - x, k)};
}
export const pageLabel = (p, n) => "PAGE " + (p + 1) + " OF " + n;
export const pagerHit = (Q, x, y) => (!Q ? 0 : inR(Q.up, x, y) ? -1 : inR(Q.dn, x, y) ? 1 : 0);
export function paintPager(c, Q, p, n, tok, o = {}) {
  if (o.f) text(c, pageLabel(p, n), Q.label.x, Q.label.y + Q.label.h / 2, o.f, CONST.t2);
  for (const [r, on, g] of [[Q.up, p > 0, "up"], [Q.dn, p < n - 1, "dn"]]) {
    key(c, r.x, r.y, r.w, r.h, on ? "key" : "well", {tok, phone: !!o.phone});
    glyph(c, g, r.x + r.w / 2 - 10, r.y + r.h / 2 - 10, 20, on ? CONST.ink : CONST.off);
  }
}
