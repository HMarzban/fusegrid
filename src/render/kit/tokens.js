/* KIT WORLD TOKENS: the world dresses the stage. Every UI state colour takes its HUE from the world's own board slots (core BIOMES: floors, wall,
   bricks) and its LIGHTNESS from one relative luminance per state (LUM), pinned by toL, so every world reads the same. ICE's UI hue moves to glacier
   cyan through TINT (uiBiome); every other world paints with its game slots. Derivation copied from the approved round 7 kit (appendix section 1).
   worldTokens(level) is cached per biome and frozen; level maps to a world exactly as biomeOf does. WALLTEX_A is the LOCKED veil alpha per biome,
   solved offline by tools/ui/walltex.mjs (R17) so the veiled wall cell's mean luminance is LUM.wallTex. Pure colour math: no DOM, no canvas. */
import {biomeOf} from "../../core/config.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
export const CONST = deep({ink: "#fff2df", t2: "#dccbb8", off: "#8f8476", dk: "#1e1216", ol: "#0b0609",
  yel: "#ffd447", yelInk: "#2a1426", yelLip: "#c8981e", cor: "#ff5d73", cord: "#ff9d5a", cord2: "#b8582a", medal: "#ffd447"});
export const LUM = deep({bed: 0.012, bedA: 0.010, bedB: 0.014, pane: 0.006, well: 0.007, key: 0.022, band: 0.07,
  mid: 0.24, lit: 0.72, lit2: 0.5, lip: 0.22, rule: 0.03, wallTex: 0.06});
export const TINT = deep({ICE: {h: 192, s: 0.62, brick: {h: 190, s: 1.1}, frame: {h: 196, s: 0.5, warm: 0.06}}});
export const WALLTEX_A = deep({JUNGLE: 0.605865478515625, ICE: 0.531402587890625, FACTORY: 0.594146728515625, WATER: 0.515716552734375, ARENA: 0.496063232421875, SAND: 0.649017333984375, VOID: 0.119598388671875, CROWN: 0.488250732421875});

const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
export const lum = (h) => { const [r, g, b] = hx(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const hex = (a) => "#" + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mixA = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgba = (h, a) => { const [r, g, b] = hx(h); return `rgba(${r},${g},${b},${a})`; };
export function toL(h, target) {
  const c = hx(h), dark = lum(h) > target, to = dark ? [0, 0, 0] : [255, 255, 255];
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; const L = lum(hex(mixA(c, to, m))); if ((L > target) === dark) lo = m; else hi = m; }
  return hex(mixA(c, to, (lo + hi) / 2));
}
const toHsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };
const fromHsl = ([h, s, l]) => { const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return [f(0), f(8), f(4)].map((v) => v * 255); };
export function tint(h, t) {
  if (!t) return h;
  const [, S, Lh] = toHsl(hx(h));
  let c = fromHsl([t.h, Math.min(1, S * t.s), Lh]);
  if (t.warm) c = mixA(c, hx("#fff2df"), t.warm);
  return hex(c);
}
export function uiBiome(b) {
  const t = TINT[b.name];
  if (!t) return b;
  const f = t.frame || t, keepL = (h, tt) => toL(tint(h, tt), lum(h));
  return {...b, bg0: keepL(b.bg0, t), bg1: keepL(b.bg1, t), floor0: keepL(b.floor0, t), floor1: keepL(b.floor1, t),
    wall: keepL(b.wall, f), wallHi: keepL(b.wallHi, f),
    brickA: keepL(b.brickA, t.brick || t), brickB: keepL(b.brickB, t.brick || t), brickHi: keepL(b.brickHi, t.brick || t)};
}
function tokens(b0) {
  const b = Object.freeze({...uiBiome(b0)});
  return deep({...CONST,
    bed: toL(b.bg1, LUM.bed), bedA: toL(b.floor0, LUM.bedA), bedB: toL(b.floor1, LUM.bedB), pane: toL(b.bg1, LUM.pane),
    well: toL(b.floor0, LUM.well), key: toL(b.wall, LUM.key), keyhi: rgba(b.wallHi, 0.22), band: toL(b.wallHi, LUM.band), rule: toL(b.wall, LUM.rule),
    lit: toL(b.brickA, LUM.lit), lithi: rgba(toL(b.brickHi, 0.92), 0.7), lit2: toL(b.brickB, LUM.lit2), lip: toL(b.brickB, LUM.lip), mid: toL(b.brickB, LUM.mid),
    wall: b.wall, wallHi: b.wallHi, bg1: b.bg1, glow: rgba(b.name === "ICE" ? b.bg0 : b.brickA, 0.25),
    brickA: b.brickA, brickB: b.brickB, floor0: b.floor0, floor1: b.floor1, frame: b.wall, boss: b.wallHi,
    wallTex: {veil: toL(b.bg1, 0.002), a: WALLTEX_A[b.name]}, name: b.name, biome: b});
}
const memo = new Map();
export function worldTokens(level) {
  const b = biomeOf(level);
  let t = memo.get(b);
  if (!t) memo.set(b, (t = tokens(b)));
  return t;
}
