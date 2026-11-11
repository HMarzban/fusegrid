/* KIT PAINTERS: the drawing vocabulary every menu page is built from (appendix sections 3 to 6). The world dresses the stage; the arcade bomber is the
   controls and the voice. Every painter takes a 2D context and the tokens of worldTokens(level) (tok), never a level, so a caller can cache what it paints.
   key    one shape for every pressable or valued part: 2 px #0b0609 outline, radius 6, a HARD drop (the shape moved down, no blur), face and insets by kind
          (KINDS: key main dng lit mid well wall). x y w h is the border box; insets are CSS inset shadows with no blur, cut from the padding box by a clip.
          lit is raised 2 px. o.label draws the legend in the kind's ink (wall: on a dark chip), o.ring the focus ring: 3 px #fff2df at offset 3, on top.
          o.bomb = the focused key's bomb (appendix 5): the bare bomb at the key's left + 8, and the legend centred past padding-left --bombs + 6.
   cap    a keycap (a key kind key, t2 legend at the secondary size), o.main = the cap on the yellow key; returns the width it drew; capW measures it.
   plate  the panel cut into the world's rampart: the bed (bedA / bedB checker, conic phase, bedB top-left) inside x y w h, the ring OUTSIDE it, T wide,
          from the game's own frameart railOf / bossOf and wallart paintShapes (appendix 6 steps 1-6). It reaches T + 2 past the box, T + 3 below it.
   band   the focused row's band with its 2 px inner outline.  focusBomb  the game's bomb body, bare (R8: no cord, spark, pulse or clock), x = the left of its
          size x size box (a row puts it 8 px in), cy = the row's centre (the box top sits 46 % of size above it).
   glyph  a row's small mark in col, top-left x y, s px square: chev (a door's chevron), ext (a link out), up / dn (the arrow keycaps' legends),
          flag (a finale level's mark, appendix 7.2 mark()).
   plaque the foot's sign plaque (radius 8, outline, hard 4 px drop, bed, keyhi strip).  rpath rfill  the rounded-rect path and its fill.
   wallCell floorCell brickCell  the board's own cell painters (wallart, floorart, sprites paintBrick) on tok.biome, scaled to s. Hard edges only.
   A painter scales the caller's globalAlpha and leaves it as it found it. A missing tok (or focusBomb size) throws a named error; a degenerate size
   (a ring T, bed tile or wall-tile step under 1 px, or a span that is not finite) skips that part, so no loop can run away. */
import {drawBombBody, paintBrick} from "../sprites.js";
import {wallShapes, paintShapes} from "../wallart.js";
import {railOf, bossOf} from "../frameart.js";
import {paintFloor} from "../floorart.js";
import {CONST, rgba} from "./tokens.js";
import {T, DEV, measure, textScale} from "./type.js";

const OL = CONST.ol;
export const KINDS = Object.freeze({
  key: Object.freeze({drop: 4, ink: "ink"}), main: Object.freeze({drop: 5, ink: "yelInk"}), dng: Object.freeze({drop: 4, ink: "cor"}),
  lit: Object.freeze({drop: 4, ink: "dk", lift: 2}), mid: Object.freeze({drop: 3, ink: "ink"}), well: Object.freeze({drop: 0, ink: "t2"}), wall: Object.freeze({drop: 0, ink: "off"}),
});
const dev = (o) => DEV[o && o.phone ? "p" : "d"];
const need = (tok, who) => { if (!tok || !tok.biome) throw new Error("kit " + who + ": tok is required (worldTokens(level))"); };
/* loop guards: a step under 1 px or a span that is not finite would never end (or take forever), so that part is skipped */
const runs = (step, ...span) => step >= 1 && span.every((v) => Number.isFinite(v));
export const rpath = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const sp = rpath;
export const rfill = (c, x, y, w, h, r, col) => { c.fillStyle = col; c.beginPath(); sp(c, x, y, w, h, r); c.fill(); };
const rf = rfill;
/* an inset shadow with no blur inside the clipped padding box: the box minus itself moved by dy, or minus itself shrunk by s */
const inset = (c, x, y, w, h, col, dy, s = 0) => { c.fillStyle = col; c.beginPath(); sp(c, x, y, w, h, 4); if (s) sp(c, x + s, y + s, w - 2 * s, h - 2 * s, Math.max(0, 4 - s)); else sp(c, x, y + dy, w, h, 4); c.fill("evenodd"); };
const FACE = {
  key: (c, x, y, w, h, t) => { c.fillStyle = t.key; c.fillRect(x, y, w, h); inset(c, x, y, w, h, t.keyhi, 2); },
  main: (c, x, y, w, h) => { c.fillStyle = CONST.yel; c.fillRect(x, y, w, h); inset(c, x, y, w, h, "#fff3b8", 2); inset(c, x, y, w, h, CONST.yelLip, -5); },
  dng: (c, x, y, w, h, t) => { c.fillStyle = t.key; c.fillRect(x, y, w, h); inset(c, x, y, w, h, CONST.cor, 0, 2); },
  lit: (c, x, y, w, h, t) => {
    c.fillStyle = t.lit2; c.fillRect(x, y, w, h); c.fillStyle = t.lit; c.fillRect(x, y, w, h * 0.54);
    c.fillStyle = t.lithi; c.fillRect(x + 3, y + 3, w - 6, 3); inset(c, x, y, w, h, t.lip, -4);
  },
  mid: (c, x, y, w, h, t) => { c.fillStyle = t.mid; c.fillRect(x, y, w, h); inset(c, x, y, w, h, "rgba(0,0,0,0.25)", -4); },
  well: (c, x, y, w, h, t) => { c.fillStyle = t.well; c.fillRect(x, y, w, h); inset(c, x, y, w, h, "rgba(0,0,0,0.6)", 3); },
  wall: (c, x, y, w, h, t) => {
    c.fillStyle = t.well; c.fillRect(x, y, w, h);
    if (runs(h, w)) for (let u = 0; u < w; u += h) wallCell(c, x + u, y, h, t, {code: 1, veil: true});
    inset(c, x, y, w, h, "rgba(0,0,0,0.4)", 2);
  },
};
const ring = (c, x, y, w, h) => { c.strokeStyle = CONST.ink; c.lineWidth = 3; c.beginPath(); sp(c, x - 4.5, y - 4.5, w + 9, h + 9, 10.5); c.stroke(); };
const legend = (c, s, cx, cy, font, col) => { c.font = font; c.fillStyle = col; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s, cx, cy); };

export function key(c, x, y, w, h, kind, o = {}) {
  const K = KINDS[kind], t = o.tok, y0 = y, d = dev(o);
  if (!K) throw new Error("kit key: unknown kind " + kind);
  need(t, "key");
  if (K.lift) y -= K.lift;
  if (K.drop) rf(c, x, y + K.drop, w, h, 6, OL);
  rf(c, x, y, w, h, 6, OL);
  c.save(); c.beginPath(); sp(c, x + 2, y + 2, w - 4, h - 4, 4); c.clip();
  FACE[kind](c, x + 2, y + 2, w - 4, h - 4, t);
  c.restore();
  if (o.bomb) focusBomb(c, x + 8, y0 + h / 2, d.bombs);
  if (o.label != null) {
    const s = String(o.label), cx = x + (w + (o.bomb ? d.bombs + 6 : 0)) / 2, cy = y + h / 2;
    if (kind === "wall") {
      const font = T.label(o.px || d.sec), cw = measure(c, font, s) + 16, ch = (o.px || d.sec) * textScale() + 4;
      rf(c, cx - cw / 2, cy - ch / 2, cw, ch, 4, OL);
      legend(c, s, cx, cy, font, CONST.off);
    } else legend(c, s, cx, cy, T.label(o.px || d.pri), t[K.ink]);
  }
  if (o.ring) ring(c, x, y, w, h);
}

export const capW = (c, s, o = {}) => { const d = dev(o); return Math.max(d.capw, Math.ceil(measure(c, T.label(d.sec), String(s))) + 20); };
export function cap(c, x, y, s, o = {}) {
  const d = dev(o), w = capW(c, s, o), h = d.caph;
  if (o.main) { rf(c, x, y + 3, w, h, 6, "#6a4a08"); rf(c, x, y, w, h, 6, OL); rf(c, x + 2, y + 2, w - 4, h - 4, 4, CONST.yelInk); }
  else key(c, x, y, w, h, "key", {tok: o.tok});
  legend(c, String(s), x + w / 2, y + h / 2, T.label(d.sec), o.main ? CONST.yel : CONST.t2);
  return w;
}

export function plate(c, x, y, w, h, tok, o = {}) {
  need(tok, "plate");
  const d = dev(o), T0 = o.T ?? d.T, s = (o.tile ?? d.tile) / 2, b = tok.biome, k = T0 / 22, W = w + 2 * T0, H = h + 2 * T0, a0 = c.globalAlpha;
  c.fillStyle = tok.bedA; c.fillRect(x, y, w, h);
  c.fillStyle = tok.bedB;
  if (runs(s, w, h)) for (let j = 0; j * s < h; j++) for (let i = j & 1; i * s < w; i += 2) c.fillRect(x + i * s, y + j * s, Math.min(s, w - i * s), Math.min(s, h - j * s));
  c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(x, y, 3, h);
  c.fillStyle = "rgba(0,0,0,0.45)"; c.fillRect(x, y, w, 3);
  if (!runs(T0, w, h)) return;
  c.save(); c.translate(x - T0, y - T0);
  c.fillStyle = OL; c.beginPath(); c.rect(-1, 2, W + 2, H + 1); c.rect(T0, T0, w, h); c.fill("evenodd");
  c.fillStyle = b.wall; c.beginPath(); c.rect(0, 0, W, H); c.rect(T0, T0, w, h); c.fill("evenodd");
  const rail = (bx, by, bw, bh, ax) => {
    c.save(); c.beginPath(); c.rect(bx, by, bw, bh); c.clip(); c.translate(bx, by); c.scale(k, k);
    const L = (ax === "h" ? bw : bh) / k;
    for (let u = 0; u < L + 40; u += 40) paintShapes(c, b, railOf(b, ax, 0, 40), ax === "h" ? u : 0, ax === "h" ? 0 : u);
    c.restore();
  };
  rail(T0, 0, w, T0, "h"); rail(T0, T0 + h, w, T0, "h"); rail(0, T0, T0, h, "v"); rail(T0 + w, T0, T0, h, "v");
  for (const [bx, by] of [[0, 0], [T0 + w, 0], [0, T0 + h], [T0 + w, T0 + h]]) {
    c.save(); c.translate(bx, by); c.scale(k, k); c.fillStyle = b.wall; c.fillRect(0, 0, 22, 22); paintShapes(c, b, bossOf(b, 1, 11), 0, 0); c.restore();
  }
  c.fillStyle = b.wallHi; c.globalAlpha = a0 * 0.6; c.fillRect(0, 0, W, 1.5); c.fillRect(0, 0, 1.5, H); c.globalAlpha = a0;
  c.strokeStyle = OL; c.lineWidth = 2; c.strokeRect(-1, -1, W + 2, H + 2); c.strokeRect(T0 - 1, T0 - 1, w + 2, h + 2);
  c.restore();
}

export function band(c, x, y, w, h, tok) {
  need(tok, "band");
  rf(c, x, y, w, h, 6, tok.band);
  c.fillStyle = OL; c.beginPath(); sp(c, x, y, w, h, 6); sp(c, x + 2, y + 2, w - 4, h - 4, 4); c.fill("evenodd");
}

export function plaque(c, x, y, w, h, tok) {
  need(tok, "plaque");
  rf(c, x, y + 4, w, h, 8, OL); rf(c, x, y, w, h, 8, OL); rf(c, x + 2, y + 2, w - 4, h - 4, 6, tok.bed);
  c.fillStyle = tok.keyhi; c.fillRect(x + 6, y + 2, w - 12, 2);
}

const BOMB = Object.freeze({timer: 1, variant: null}), BARE = Object.freeze({bare: true});
export function focusBomb(c, x, cy, size) {
  if (!(size > 0)) throw new Error("kit focusBomb: size must be > 0 (DEV.bombs)");
  c.save(); c.translate(x + size / 2, cy + size * 0.08); c.scale(size / 30, size / 30);
  drawBombBody(c, null, BOMB, BARE);
  c.restore();
}

export function glyph(c, name, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s / 16, s / 16);
  c.strokeStyle = c.fillStyle = col; c.lineCap = c.lineJoin = "round"; c.beginPath();
  if (name === "chev") { c.lineWidth = 2.4; c.moveTo(6, 3); c.lineTo(11, 8); c.lineTo(6, 13); c.stroke(); }
  else if (name === "ext") { c.lineWidth = 2; c.moveTo(9, 2); c.lineTo(14, 2); c.lineTo(14, 7); c.moveTo(14, 2); c.lineTo(7, 9); c.moveTo(12, 10); c.lineTo(12, 14); c.lineTo(2, 14); c.lineTo(2, 4); c.lineTo(6, 4); c.stroke(); }
  else if (name === "up") { c.moveTo(3, 11); c.lineTo(8, 5); c.lineTo(13, 11); c.closePath(); c.fill(); }
  else if (name === "dn") { c.moveTo(3, 5); c.lineTo(8, 11); c.lineTo(13, 5); c.closePath(); c.fill(); }
  else if (name === "flag") { c.lineWidth = 2; c.moveTo(4, 15); c.lineTo(4, 2); c.stroke(); c.beginPath(); c.moveTo(4, 2.5); c.lineTo(13, 2.5); c.lineTo(10.5, 5.5); c.lineTo(13, 8.5); c.lineTo(4, 8.5); c.closePath(); c.fill(); }
  c.restore();
}

const cell = (c, x, y, s, fn) => { c.save(); c.translate(x, y); c.scale(s / 40, s / 40); fn(); c.restore(); };
export function wallCell(c, x, y, s, tok, o = {}) {
  need(tok, "wallCell");
  cell(c, x, y, s, () => {
    paintShapes(c, tok.biome, wallShapes(tok.biome, o.code || 0), 0, 0);
    if (o.veil) { c.fillStyle = rgba(tok.wallTex.veil, tok.wallTex.a); c.fillRect(0, 0, 40, 40); }
  });
}
export function floorCell(c, x, y, s, tok, o = {}) { need(tok, "floorCell"); cell(c, x, y, s, () => paintFloor(c, tok.biome, o.par ? 1 : 0, o.v | 0)); }
export function brickCell(c, x, y, s, tok, state) {
  need(tok, "brickCell");
  if (state != null) throw new Error("kit brickCell: state " + state + " is built by the page that uses it");
  cell(c, x, y, s, () => paintBrick(c, tok.biome));
}
