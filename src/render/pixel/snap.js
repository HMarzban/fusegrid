/* PIXEL snapping (panel rulings R12, R17, R20). One art px is 2 logical px.
   Positions and shake snap to whole art px (even logical px). Zoom is NOT
   quantized: sharp-bilinear blits the native board nearest at an integer M,
   then once with smoothing, so any zoom stays uniform at the hi stage. */
export const ART = 2, NATIVE_W = 300, NATIVE_H = 260, M_MAX = 8;
export const snapArt = (v) => Math.round(v / ART);
export const evenShake = (v) => ART * Math.round((v || 0) / ART);
export const kOf = (backingW) => backingW / NATIVE_W;
export const pxM = (k, z) => Math.max(1, Math.min(M_MAX, Math.floor((k * (z > 0 ? z : 1)) + 1e-9)));
export const zOf = (a, b) => Math.hypot(a || 0, b || 0) || 1;
/* Final hi->device matrix: device scale (bw/600, bh/520) * main's overlay
   matrix [a b c d e f] * translate(shake) * scale(2/M). Translation rounded to
   whole device px. Writes into out (no allocation). */
export function finalMatrix(out, bw, bh, m, sx, sy, M) {
  const X = bw / (NATIVE_W * ART), Y = bh / (NATIVE_H * ART), s = ART / M;
  out[0] = X * m.a * s; out[1] = Y * m.b * s; out[2] = X * m.c * s; out[3] = Y * m.d * s;
  out[4] = Math.round(X * (m.a * sx + m.c * sy + m.e));
  out[5] = Math.round(Y * (m.b * sx + m.d * sy + m.f));
  return out;
}
