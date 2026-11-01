/* Paired statistics for the balance harness (#25). Pure, deterministic
   (its own mulberry32 stream), never imported by src/.
   - pairedCI: bootstrap over seed pairs of mean(b - a), 95% percentile CI;
   - medianRatio: clear-time median of wins b / a - 1, bootstrapped over seeds,
     UNRESOLVED below WIN_FLOOR wins in either arm or when the CI straddles
     the -10% joy line;
   - nNeed: n >= 15.4 * d / margin^2 (d = discordant share of the pairs). */
import { createRng } from "../../src/core/rng.js";

export const B = 2000, WIN_FLOOR = 50;
const pct = (v, q) => { const s = Float64Array.from(v).sort(); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))]; };
const med = (v) => { if (!v.length) return NaN; const s = Float64Array.from(v).sort(), m = s.length >> 1; return s.length & 1 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const median = med;

export function pairedCI(a, b, seed = 0x25) {
  const n = a.length, rng = createRng(seed >>> 0), d = new Float64Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) { d[i] = b[i] - a[i]; m += d[i]; }
  if (!n) return { mean: NaN, lo: NaN, hi: NaN };
  const bs = new Float64Array(B);
  for (let r = 0; r < B; r++) { let s = 0; for (let i = 0; i < n; i++) s += d[rng.int(0, n - 1)]; bs[r] = s / n; }
  return { mean: m / n, lo: pct(bs, 0.025), hi: pct(bs, 0.975) };
}
/* bootstrap over seed pairs of f(sum a, sum b): share (b - a) / b, ratio b / a - 1 */
export function pairedRatioCI(a, b, f, seed = 0x27) {
  const n = a.length, rng = createRng(seed >>> 0);
  if (!n) return { mean: NaN, lo: NaN, hi: NaN };
  const bs = new Float64Array(B);
  for (let r = 0; r < B; r++) { let x = 0, y = 0; for (let i = 0; i < n; i++) { const j = rng.int(0, n - 1); x += a[j]; y += b[j]; } bs[r] = f(x, y); }
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += a[i]; y += b[i]; }
  return { mean: f(x, y), lo: pct(bs, 0.025), hi: pct(bs, 0.975) };
}
export function medianRatio(ta, tb, seed = 0x26) {
  /* ta / tb: per seed clear time or NaN when that arm did not win */
  const n = ta.length, wa = ta.filter((x) => x === x), wb = tb.filter((x) => x === x);
  const out = { a: med(wa), b: med(wb), winsA: wa.length, winsB: wb.length, ratio: NaN, lo: NaN, hi: NaN, status: "" };
  if (wa.length < WIN_FLOOR || wb.length < WIN_FLOOR) { out.ratio = out.b / out.a - 1; out.status = `unresolved (wins ${wa.length}/${wb.length} < ${WIN_FLOOR})`; return out; }
  const rng = createRng(seed >>> 0), bs = [];
  for (let r = 0; r < B; r++) {
    const xa = [], xb = [];
    for (let i = 0; i < n; i++) { const j = rng.int(0, n - 1); if (ta[j] === ta[j]) xa.push(ta[j]); if (tb[j] === tb[j]) xb.push(tb[j]); }
    if (xa.length && xb.length) bs.push(med(xb) / med(xa) - 1);
  }
  out.ratio = out.b / out.a - 1; out.lo = pct(bs, 0.025); out.hi = pct(bs, 0.975);
  out.status = out.hi < -0.1 ? "faster by >= 10%" : out.lo > -0.1 ? "not 10% faster" : "unresolved (CI straddles -10%)";
  return out;
}
export const discordant = (a, b) => { let k = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) k++; return a.length ? k / a.length : 0; };
export const nNeed = (d, margin) => Math.ceil(15.4 * d / (margin * margin));
