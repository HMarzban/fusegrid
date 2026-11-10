/* KIT TYPE: zero downloaded fonts. Display is the system sans at 900 in the logo recipe (a 0.12 em #0b0609 outline under the face, a hard 0.08 em drop, never a glow);
   labels 700, body 400, numbers 800 in fixed-width digit cells (nums: canvas has no tabular-nums, so every digit takes the widest digit's cell), units unspaced.
   DEV is the appendix section 2 device table (d desktop, p phone; pri sec hud bod ttl are type px before the text scale, tile is the plate bed tile). The text scale
   (R14) is module level, default 1, set only by tests and shots.mjs --t125; it is not a player setting. measure memoizes per context on (font, text, text scale);
   a hit does not set c.font. */
import {CONST} from "./tokens.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
export const SANS = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
export const DEV = deep({
  d: {pri: 21, sec: 16, hud: 27, bod: 18, ttl: 40, rowh: 40, keyh: 30, btnh: 50, capw: 34, caph: 30, rkw: 64, mcw: 12, mch: 26, bkh: 36, lch: 40, lcw: 40, sdw: 38, sdh: 52, sdf: 34, tg: 26, bombs: 30, labx: 50, T: 16, tile: 80},
  p: {pri: 16, sec: 13.5, hud: 20, bod: 15, ttl: 30, rowh: 52, keyh: 44, btnh: 52, capw: 30, caph: 28, rkw: 54, mcw: 9, mch: 28, bkh: 44, lch: 44, lcw: 36, sdw: 32, sdh: 46, sdf: 28, tg: 24, bombs: 28, labx: 42, T: 10, tile: 56},
});
let K = 1;
export const setTextScale = (k) => { K = k > 0 ? +k : 1; };
export const textScale = () => K;
const face = (wt) => (px) => `${wt} ${+(px * K).toFixed(3)}px ${SANS}`;
export const T = Object.freeze({display: face(900), label: face(700), body: face(400), num: face(800)});

const memo = new WeakMap();
export function measure(c, font, text) {
  let m = memo.get(c);
  if (!m) memo.set(c, (m = new Map()));
  const k = font + "\n" + text + "\n" + K;
  let w = m.get(k);
  if (w === undefined) {
    if (m.size >= 4096) m.clear();
    c.font = font;
    w = c.measureText(text).width;
    m.set(k, w);
  }
  return w;
}

const set = (c, font, col, o) => { c.font = font; c.fillStyle = col; c.textAlign = o.align || "left"; c.textBaseline = o.base || "middle"; };
export function dsp(c, text, x, y, px, o = {}) {
  const font = T.display(px), em = px * K, s = String(text), dy = em * 0.08;
  set(c, font, CONST.ol, o);
  c.lineJoin = "round"; c.lineWidth = em * 0.12; c.strokeStyle = CONST.ol;
  c.strokeText(s, x, y + dy); c.fillText(s, x, y + dy);
  c.strokeText(s, x, y);
  c.fillStyle = o.col || CONST.ink; c.fillText(s, x, y);
  return measure(c, font, s);
}
export function lbl(c, text, x, y, px, o = {}) {
  const font = T.label(px), s = String(text);
  set(c, font, o.col || CONST.ink, o); c.fillText(s, x, y);
  return measure(c, font, s);
}
export function body(c, text, x, y, px, o = {}) {
  const font = T.body(px), s = String(text);
  set(c, font, o.col || CONST.t2, o); c.fillText(s, x, y);
  return measure(c, font, s);
}
const DIG = "0123456789";
export function nums(c, text, x, y, px, o = {}) {
  const font = T.num(px), ch = [...String(text)];
  let cell = 0;
  for (const d of DIG) cell = Math.max(cell, measure(c, font, d));
  const ws = ch.map((q) => (DIG.includes(q) ? cell : measure(c, font, q))), tw = ws.reduce((a, b) => a + b, 0);
  let cx = o.align === "right" ? x - tw : o.align === "center" ? x - tw / 2 : x;
  set(c, font, o.col || CONST.ink, {base: o.base, align: "center"});
  ch.forEach((q, i) => { c.fillText(q, cx + ws[i] / 2, y); cx += ws[i]; });
  return tw;
}
