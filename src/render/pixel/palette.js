/* PIXEL palette. Every hex the px look uses is a verbatim repo hex (plan P2)
   read from config/entities/sprites, or one of the named constants below.
   Art grids never hold hex: a cell maps its characters to SLOTS, and a slot
   is "<src>" or "<src>.<step>" (step outline|shadow|base|light, default base).
   Sources:
     body fin feet      contextual (the entity being baked: MAKO hull or a
                        foe's spawn hex, p.color, feet or kick feet)
     hull eye bomb stroke fuse spark well shieldc passc
     ink spec           fixed singletons (no step)
     blast0..blast3     the blast ramp, fixed singletons
     foe.<type>         any spawnEnemy hex
     pow.<t>            any POWER colour
     tile.<field>       the baking biome's BIOMES field (floor0 wall brickA ...)
   pxRamp is the pinned OKLCH ramp (plan P1): outline and shadow shift cool
   toward the 3D fill hue, light shifts warm toward the key hue. */
import {BIOMES} from "../../core/config.js";
import {POWER, FOES} from "../../core/entities.js";
import {PLAYER_HULL} from "../sprites.js";

export const HEX = Object.freeze({
  hull: PLAYER_HULL, fin: "#37f0d0", eye: "#f2e6d2", ink: "#12121e", spec: "#fff8ec",
  feet: "#2e1a4e", kick: "#c07a3a", bomb: "#15181f", stroke: "#0a0d14", fuse: "#ff9d5a",
  spark: "#ffd447", sparkB: "#ff5d73", well: "#080c18", shieldc: "#6fb7ff", passc: "#77ff99",
  blast0: "#ffffff", blast1: "#fff3b0", blast2: "#ffb347", blast3: "#ff5d73",
});
export const STEPS = Object.freeze(["outline", "shadow", "base", "light"]);
const SINGLE = new Set(["ink", "spec", "blast0", "blast1", "blast2", "blast3"]);

const rgbOf = (h) => { const n = parseInt(String(h).slice(1), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const gam = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const hx = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
function toOk(h) {
  const [r, g, b] = rgbOf(h).map((v) => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(a, bb), ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360];
}
function fromOk([L, C, H]) {
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return hx([4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(gam));
}
const shiftH = (h, to, d) => { const x = ((to - h + 540) % 360) - 180; return h + Math.sign(x) * Math.min(Math.abs(x), d); };
const FILL_H = toOk("#bcd4ff")[2], KEY_H = toOk("#fff4e2")[2];
const RAMPS = new Map();
export function pxRamp(base) {
  const k = String(base).toLowerCase();
  let r = RAMPS.get(k);
  if (r) return r;
  const [L, C, H] = toOk(k);
  r = Object.freeze({
    outline: fromOk([L - 0.36, C * 0.7, shiftH(H, FILL_H, 24)]),
    shadow: fromOk([L - 0.12, C * 0.92, shiftH(H, FILL_H, 20)]),
    base: k,
    light: fromOk([Math.min(L + 0.07, 0.95), C * 0.9, shiftH(H, KEY_H, 8)]),
  });
  RAMPS.set(k, r);
  return r;
}
export function lumOf(h) { const [r, g, b] = rgbOf(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
const grey = (h) => { const v = Math.round(lumOf(h) * 0.82 * 255 + 18); const c = v.toString(16).padStart(2, "0"); return "#" + c + c + c; };
const FOE_HEX = Object.freeze(Object.fromEntries(FOES.map((f) => [f.t, f.col])));
const POW_HEX = Object.freeze(Object.fromEntries(POWER.map((p) => [p.t, p.col])));

/* Resolve one slot string to a hex. ctx: {body, fin, feet, biome, desat}.
   desat greys the contextual body/fin/feet ramps (the hurt corpse swap).
   Unknown slots return null so the validator can name them. */
export function resolveSlot(slot, ctx = {}) {
  if (slot == null || slot === ".") return null;
  const s = String(slot), dot = s.lastIndexOf(".");
  let src = s, step = "base";
  if (dot > 0 && STEPS.includes(s.slice(dot + 1))) { src = s.slice(0, dot); step = s.slice(dot + 1); }
  let base = null, ctxd = false;
  if (SINGLE.has(src)) return step === "base" ? HEX[src] : null;
  if (src === "body") { base = ctx.body || HEX.hull; ctxd = true; }
  else if (src === "fin") { base = ctx.fin || HEX.fin; ctxd = true; }
  else if (src === "feet") { base = ctx.feet || HEX.feet; ctxd = true; }
  else if (src.startsWith("foe.")) base = FOE_HEX[src.slice(4)] || null;
  else if (src.startsWith("pow.")) base = POW_HEX[src.slice(4)] || null;
  else if (src.startsWith("tile.")) { const b = ctx.biome || BIOMES[0], f = src.slice(5); base = /^#[0-9a-f]{6}$/i.test(b[f]) ? b[f] : null; }
  else if (Object.prototype.hasOwnProperty.call(HEX, src)) base = HEX[src];
  if (!base) return null;
  const hex = pxRamp(base)[step];
  return ctxd && ctx.desat ? grey(hex) : hex;
}
export function validSlot(slot) { return resolveSlot(slot, {}) != null; }
export function rgbaOf(hex) { const [r, g, b] = rgbOf(hex); return (255 << 24 | b << 16 | g << 8 | r) >>> 0; }
export { rgbOf };
