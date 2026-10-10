/* Dev-only Node RGBA canvas shim for the PIXEL tools and tests (zero deps).
   createRGBA(w,h) returns a canvas-like {width,height,data,getContext} whose
   2D context implements exactly what src/render/pixel/world.js needs:
   drawImage(img,dx,dy[,dw,dh]) (nearest; img is another RGBA image or an
   atlas surface {width,height,data}), fillRect with a #rrggbb fillStyle,
   clearRect, globalAlpha (source-over), save/restore/translate/setTransform
   (translation only), imageSmoothingEnabled. Every drawImage is logged in
   ctx.calls ([op,x,y,smoothing,alpha,src]) so tests can assert integer
   positions.
   Also: surfRGBA (the atlas surface factory), png(img) (node:zlib),
   nearest(img,M), bilinear(img,W,H), sharpBilinear(img,k), label(img,x,y,s,text,rgb)
   with a 3x5 bitmap font, and blank/paste helpers for contact sheets.
   unpng(buf) decodes an 8-bit RGB / RGBA, non-interlaced PNG (a CDP
   Page.captureScreenshot) back into an RGBA image. */
import {deflateSync, inflateSync} from "node:zlib";
import {pxM} from "../../src/render/pixel/snap.js";

export const surfRGBA = (w, h, rgba) => ({width: w, height: h, data: rgba});

export function createRGBA(w, h, bg) {
  const img = {width: w, height: h, data: new Uint8ClampedArray(w * h * 4)};
  if (bg) fillRGB(img, 0, 0, w, h, hexRGB(bg), 1);
  const st = [];
  const ctx = {
    canvas: img, globalAlpha: 1, fillStyle: "#000000", imageSmoothingEnabled: true, tx: 0, ty: 0, calls: [],
    save() { st.push([this.globalAlpha, this.fillStyle, this.tx, this.ty]); },
    restore() { const s = st.pop(); if (s) [this.globalAlpha, this.fillStyle, this.tx, this.ty] = s; },
    translate(x, y) { this.tx += x; this.ty += y; },
    setTransform(a, b, c, d, e, f) { this.tx = e || 0; this.ty = f || 0; },
    clearRect(x, y, w2, h2) { clearRGB(img, x + this.tx, y + this.ty, w2, h2); },
    fillRect(x, y, w2, h2) { this.calls.push(["fillRect", x + this.tx, y + this.ty, w2, h2]); fillRGB(img, x + this.tx, y + this.ty, w2, h2, hexRGB(this.fillStyle), this.globalAlpha); },
    drawImage(src, dx, dy, dw, dh) {
      this.calls.push(["drawImage", dx + this.tx, dy + this.ty, this.imageSmoothingEnabled, this.globalAlpha, src]);
      blitRGB(img, src, dx + this.tx, dy + this.ty, dw == null ? src.width : dw, dh == null ? src.height : dh, this.globalAlpha);
    },
  };
  img.getContext = () => ctx;
  return img;
}
export function hexRGB(h) { const s = String(h || "#000"); if (s[0] !== "#") return [0, 0, 0]; const n = parseInt(s.length === 4 ? s.slice(1).replace(/./g, "$&$&") : s.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function fillRGB(img, x, y, w, h, c, a) {
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y)), x1 = Math.min(img.width, Math.round(x + w)), y1 = Math.min(img.height, Math.round(y + h)), d = img.data;
  for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) { const o = (j * img.width + i) * 4; for (let k = 0; k < 3; k++) d[o + k] = d[o + k] * (1 - a) + c[k] * a; d[o + 3] = Math.max(d[o + 3], 255 * a); }
}
function clearRGB(img, x, y, w, h) { const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0), x1 = Math.min(img.width, x + w), y1 = Math.min(img.height, y + h); for (let j = y0; j < y1; j++) img.data.fill(0, (j * img.width + x0) * 4, (j * img.width + x1) * 4); }
function blitRGB(img, src, dx, dy, dw, dh, a) {
  const d = img.data, s = src.data, sw = src.width, sh = src.height, X = Math.round(dx), Y = Math.round(dy);
  for (let j = 0; j < dh; j++) {
    const ty = Y + j; if (ty < 0 || ty >= img.height) continue;
    const sy = Math.min(sh - 1, Math.floor((j * sh) / dh));
    for (let i = 0; i < dw; i++) {
      const tx = X + i; if (tx < 0 || tx >= img.width) continue;
      const sx = Math.min(sw - 1, Math.floor((i * sw) / dw)), so = (sy * sw + sx) * 4, sa = (s[so + 3] / 255) * a;
      if (sa <= 0) continue;
      const o = (ty * img.width + tx) * 4;
      for (let k = 0; k < 3; k++) d[o + k] = d[o + k] * (1 - sa) + s[so + k] * sa;
      d[o + 3] = Math.min(255, d[o + 3] + 255 * sa);
    }
  }
}
export function blank(w, h, bg) { return createRGBA(w, h, bg); }
export function paste(dst, src, x, y, M = 1) { blitRGB(dst, src, x, y, src.width * M, src.height * M, 1); }
export function nearest(img, M) { const o = createRGBA(img.width * M, img.height * M); paste(o, img, 0, 0, M); return o; }
export function bilinear(img, W, H) {
  const o = createRGBA(W, H), s = img.data, sw = img.width, sh = img.height;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = Math.max(0, Math.min(sw - 1, ((x + 0.5) * sw) / W - 0.5)), fy = Math.max(0, Math.min(sh - 1, ((y + 0.5) * sh) / H - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1), ax = fx - x0, ay = fy - y0, oo = (y * W + x) * 4;
    for (let k = 0; k < 4; k++) {
      const p = (X, Y) => s[(Y * sw + X) * 4 + k];
      o.data[oo + k] = (p(x0, y0) * (1 - ax) + p(x1, y0) * ax) * (1 - ay) + (p(x0, y1) * (1 - ax) + p(x1, y1) * ax) * ay;
    }
  }
  return o;
}
/* U2 sharp-bilinear at k device px per art px: nearest at the renderer's own
   M = pxM(k) (ceil, so the bilinear step is a downscale), then one bilinear
   step to round(w*k). */
export function sharpBilinear(img, k) { const M = pxM(k, 1); const n = nearest(img, M); return M === k ? n : bilinear(n, Math.round(img.width * k), Math.round(img.height * k)); }

const FONT = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100",
  G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100", Q: "010101101111011", R: "110101110101101",
  S: "011100010001110", T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111", 0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110",
  4: "101101111001001", 5: "111100110001110", 6: "011100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001110",
  ".": "000000000000010", "-": "000000111000000", "/": "001001010100100", ":": "000010000010000", "_": "000000000000111", "=": "000111000111000",
  "(": "010100100100010", ")": "010001001001010", "+": "000010111010000", " ": "000000000000000", "*": "000101010101000", "!": "010010010000010",
};
export function label(img, x, y, s, text, rgb = [240, 240, 240]) {
  let cx = x;
  for (const ch of String(text).toUpperCase()) {
    const g = FONT[ch] || FONT["*"];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === "1") fillRGB(img, cx + i * s, y + j * s, s, s, rgb, 1);
    cx += 4 * s;
  }
  return cx;
}
export const textW = (text, s) => String(text).length * 4 * s;

export function png(img) {
  const w = img.width, h = img.height, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, r = y * (w * 4 + 1) + 1 + x * 4; raw[r] = img.data[o]; raw[r + 1] = img.data[o + 1]; raw[r + 2] = img.data[o + 2]; raw[r + 3] = img.data[o + 3]; } }
  const T = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = T[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(t), data]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export function unpng(buf) {
  let o = 8, w = 0, h = 0, ct = 6;
  const ids = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), t = buf.toString("latin1", o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (t === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12] !== 0 || (ct !== 2 && ct !== 6)) throw new Error("unpng: 8-bit RGB/RGBA, non-interlaced only"); }
    else if (t === "IDAT") ids.push(d);
    else if (t === "IEND") break;
    o += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, st = w * bpp, raw = inflateSync(Buffer.concat(ids)), cur = Buffer.alloc(st), prev = Buffer.alloc(st), img = createRGBA(w, h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)], row = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
    for (let i = 0; i < st; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { const q = (y * w + x) * 4; img.data[q] = cur[x * bpp]; img.data[q + 1] = cur[x * bpp + 1]; img.data[q + 2] = cur[x * bpp + 2]; img.data[q + 3] = bpp === 4 ? cur[x * bpp + 3] : 255; }
    cur.copy(prev);
  }
  return img;
}
