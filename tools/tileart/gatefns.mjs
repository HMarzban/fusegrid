/* Direction D gate functions: pure over RGBA arrays (Node-testable), used by gates.mjs and tests/tile-art-d.test.mjs. */
const L = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
/* lit-only pass: white strips must sit NW of black strips (key light top-left) */
export function litSkew(a, S) {
  let w = 0, wx = 0, bk = 0, bx = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 8) continue;
    const p = (i / 4) | 0, x = p % S, y = (p / S) | 0, v = a[i] > 128 ? 1 : 0, al = a[i + 3] / 255;
    if (v) { w += al; wx += al * (x + y); } else { bk += al; bx += al * (x + y); }
  }
  return {white: w, black: bk, dSkew: bk && w ? bx / bk - wx / w : 0};
}
/* mean abs RGB difference between two edge columns/rows of S-px tiles */
export function seam(a, b, S, axis) {
  let d = 0;
  for (let t = 0; t < S; t++) for (let c = 0; c < 3; c++) {
    const ia = axis === "x" ? (t * S + S - 1) * 4 + c : ((S - 1) * S + t) * 4 + c, ib = axis === "x" ? (t * S) * 4 + c : t * 4 + c;
    d += Math.abs(a[ia] - b[ib]);
  }
  return d / (S * 3);
}
/* channel light: the sunk channel's NW inner band must be darker than its SE inner band (mean L over 3-unit bands) */
export function channelLight(a, S, hw, dir) {
  const U = S / 40, band = (lo, hi) => { let t = 0, n = 0; for (let y = 0; y < S; y++) for (let x = 8 * U; x < 32 * U; x++) { const u = dir % 2 === 0 ? y : x, v = dir % 2 === 0 ? x : y; if (u >= lo * U && u < hi * U && v >= 8 * U && v < 32 * U) { const i = (y * S + x) * 4; t += L(a[i], a[i + 1], a[i + 2]); n++; } } return t / n; };
  return band(20 + hw - 3, 20 + hw) - band(20 - hw, 20 - hw + 3);
}
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const lab = ([r, g, b]) => { const R = lin(r), G = lin(g), B = lin(b), X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883, f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]; };
export const dE = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
const gam = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);
const CVD = {protan: [[0.11238, 0.88762, 0], [0.11238, 0.88762, 0], [0.00401, -0.00401, 1]], deutan: [[0.29275, 0.70725, 0], [0.29275, 0.70725, 0], [-0.02234, 0.02234, 1]], tritan: [[1, 0.14461, -0.14461], [0, 0.85659, 0.14341], [0, 0.85659, 0.14341]]};
const sim = (c, m) => { const l = c.map(lin); return m.map((r) => Math.max(0, Math.min(255, gam(r[0] * l[0] + r[1] * l[1] + r[2] * l[2])))); };
export const rgbOf = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const median = (a) => { const b = Float64Array.from(a).sort(); return b[b.length >> 1]; };
/* the bed = per-channel median colour; the figure = pixels whose L* differs from the median L* by >= 10 */
export function figure(a) {
  const px = []; for (let i = 0; i < a.length; i += 4) px.push([a[i], a[i + 1], a[i + 2]]);
  const bed = [0, 1, 2].map((c) => median(px.map((p) => p[c]))), Lb = lab(bed)[0], fig = [];
  for (const p of px) if (Math.abs(lab(p)[0] - Lb) >= 10) fig.push(p);
  const fc = fig.length ? [0, 1, 2].map((c) => fig.reduce((t, p) => t + p[c], 0) / fig.length) : bed;
  return {bed, cov: (100 * fig.length) / px.length, dL: fig.length ? fig.reduce((t, p) => t + Math.abs(lab(p)[0] - Lb), 0) / fig.length : 0, cvd: Math.min(...Object.values(CVD).map((m) => dE(sim(fc, m), sim(bed, m))))};
}
/* mean abs L* difference of two S-px renders after a 4x4 box downscale (the 40-px view) */
export function heatSep(a, b, S) {
  const n = S / 4; let t = 0;
  const m = (arr, bx, by) => { let r = 0, g = 0, bl = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const i = ((by * 4 + y) * S + bx * 4 + x) * 4; r += arr[i]; g += arr[i + 1]; bl += arr[i + 2]; } return [r / 16, g / 16, bl / 16]; };
  for (let by = 0; by < n; by++) for (let bx = 0; bx < n; bx++) t += Math.abs(lab(m(a, bx, by))[0] - lab(m(b, bx, by))[0]);
  return t / (n * n);
}
/* dE76 from a colour to the convex hull of the points V, Frank-Wolfe with 160 steps (error well under 2 dE for 8 points) */
export function hullDist(c, V) {
  let w = V.map(() => 1 / V.length);
  for (let t = 0; t < 160; t++) {
    const p = [0, 1, 2].map((k) => V.reduce((s, v, i) => s + w[i] * v[k], 0)), g = V.map((v) => [0, 1, 2].reduce((s, k) => s + (p[k] - c[k]) * v[k], 0));
    let m = 0; for (let i = 1; i < V.length; i++) if (g[i] < g[m]) m = i;
    const st = 2 / (t + 3); w = w.map((x, i) => (1 - st) * x + (i === m ? st : 0));
  }
  return dE(c, [0, 1, 2].map((k) => V.reduce((s, v, i) => s + w[i] * v[k], 0)));
}
/* worst dE of an opaque render's (sampled) distinct colours from the hull of the biome's six slots + black + white */
export function slotOnly(a, V, cap = 300) {
  const seen = new Map();
  for (let i = 0; i < a.length; i += 4) { if (a[i + 3] < 250) continue; const k = (a[i] >> 3) + "," + (a[i + 1] >> 3) + "," + (a[i + 2] >> 3); if (!seen.has(k)) seen.set(k, [a[i], a[i + 1], a[i + 2]]); }
  const cols = [...seen.values()], step = Math.max(1, Math.floor(cols.length / cap)); let worst = 0;
  for (let i = 0; i < cols.length; i += step) worst = Math.max(worst, hullDist(cols[i], V));
  return worst;
}
export const maxLum = (a) => { let m = 0; for (let i = 0; i < a.length; i += 4) if (a[i + 3] > 250) m = Math.max(m, L(a[i], a[i + 1], a[i + 2])); return m; };
export const lum = L;

/* busyness at the 40-px view: mean |dL*| between neighbouring pixels (x and y) after a 4x4 box downscale */
export function edgeEnergy(a, S) {
  const n = S / 4, Lm = new Float64Array(n * n);
  for (let by = 0; by < n; by++) for (let bx = 0; bx < n; bx++) { let r = 0, g = 0, b = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const i = ((by * 4 + y) * S + bx * 4 + x) * 4; r += a[i]; g += a[i + 1]; b += a[i + 2]; } Lm[by * n + bx] = lab([r / 16, g / 16, b / 16])[0]; }
  let t = 0, c = 0; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { if (x + 1 < n) { t += Math.abs(Lm[y * n + x + 1] - Lm[y * n + x]); c++; } if (y + 1 < n) { t += Math.abs(Lm[(y + 1) * n + x] - Lm[y * n + x]); c++; } }
  return t / c;
}
