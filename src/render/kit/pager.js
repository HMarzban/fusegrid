/* KIT PAGER (R1 kit harmonisation): one pager for every page that pages (SETTINGS / GRAPHICS, GUIDE, RECORDS, LEVEL SELECT's compact). Where whole
   items do not fit at the floors the page pages: whole items per page, the page on screen the focused item's, so keys and a controller turn it by
   moving the focus past a page's end; a tap on a page key opens the page before or after; tap mode keeps the keys. A page keeps only what an item
   is; this module owns the rest. PAGE_KEY is a key's side in CSS px (GUIDE's 46: 44 and the #c border), PAGE_GAP the gap between the two keys.
   keySide     (css, u) a PAGE_KEY key in a page's design px (css CSS px per box unit, u box units per design px).
   paginate    (hs, gs, cap) item indices per page: heights hs and the gap before each, at most cap tall (a page's first item drops its gap).
   pageOfFocus (pageOf, name) the page on screen: the focused item's (pageOf maps an item's name to its page), 0 without one.
   pagerKeys   (x, y, w, k) the strip under the items, ▲ then ▼ at its right end (k square, apart by PAGE_GAP scaled as k is from PAGE_KEY, so
               a keySide key keeps 10 CSS px), the label's room left of them.
   pageLabel   (p, n) PAGE p+1 OF n.  pagerHit  (Q, x, y) -1 on ▲, 1 on ▼, else 0.
   paintPager  (c, Q, p, n, tok, o) the label (o.f, its font; none without) and the keys: a key with no page to open is a well. */
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
