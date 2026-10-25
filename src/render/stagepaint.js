/* STAGE SET painters (mockup C, 2026-10-25): the diorama BEYOND the board, one per world.
   paintSet(g, W, H, biome, R, k, o) paints a W x H canvas whose board box is R {x,y,w,h}
   (board units x k). Every colour is a BIOMES slot or a mix of two slots / black / white at
   alpha; no Math.random (seeded hash). o.flat = top-down ground only (the REAL 3D ground
   texture; upright props are meshes there). o.px = coarse buffer, posterised + Bayer-dithered.
   o.fade = fade the outer edge to bg1 (3D ground meets the clear colour). */
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mix = (a, b, t) => { const A = hx(a), B = hx(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const rgba = (h, a) => { const c = hx(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; };
const BLK = "#000000", WHT = "#ffffff";
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const inside = (x, y, R, m) => x > R.x - m && x < R.x + R.w + m && y > R.y - m && y < R.y + R.h + m;
function scatter(rn, n, W, H, R, m, fn) { for (let i = 0, t = 0; i < n && t < n * 8; t++) { const x = rn() * W, y = rn() * H; if (inside(x, y, R, m)) continue; fn(x, y, i++); } }
/* point on the ring d units outside the board box, t in [0,1) around it */
function ring(R, t, d) {
  const P = 2 * (R.w + R.h); let s = (((t % 1) + 1) % 1) * P;
  if (s < R.w) return [R.x + s, R.y - d, 0, -1]; s -= R.w;
  if (s < R.h) return [R.x + R.w + d, R.y + s, 1, 0]; s -= R.h;
  if (s < R.w) return [R.x + R.w - s, R.y + R.h + d, 0, 1]; s -= R.w;
  return [R.x - d, R.y + R.h - s, -1, 0];
}
function blob(g, x, y, rx, ry, rot, fill) { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, 6.2832); g.fill(); }
function glow(g, x, y, r, c, a) { const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, rgba(c, a)); q.addColorStop(1, rgba(c, 0)); g.fillStyle = q; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
function fillV(g, W, H, a, b) { const q = g.createLinearGradient(0, 0, 0, H); q.addColorStop(0, a); q.addColorStop(1, b); g.fillStyle = q; g.fillRect(0, 0, W, H); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const infl = (R, d) => ({ x: R.x - d, y: R.y - d, w: R.w + 2 * d, h: R.h + 2 * d });
function wob(rn, x0, y0, x1, y1, n, amp) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, w = Math.sin(t * 3.14159) * amp; o.push([x0 + (x1 - x0) * t + (rn() - 0.5) * w, y0 + (y1 - y0) * t + (rn() - 0.5) * w]); } return o; }

function jungle(g, W, H, B, R, k, rn, o, N) {
  fillV(g, W, H, mix(B.bg1, B.floor1, 0.4), mix(B.bg0, B.bg1, 0.35));
  scatter(rn, N(150), W, H, R, 0, (x, y) => blob(g, x, y, (16 + rn() * 34) * k, (9 + rn() * 20) * k, rn() * 3, rgba(rn() < 0.5 ? B.floor1 : BLK, 0.28)));
  scatter(rn, N(520), W, H, R, 0, (x, y) => {
    const a = rn() * 6.28, L = (5 + rn() * 6) * k, c = rn() < 0.5 ? B.floor0 : rn() < 0.5 ? B.brickB : B.wall;
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = rgba(c, 0.62); g.beginPath(); g.ellipse(0, 0, L, L * 0.45, 0, 0, 6.2832); g.fill();
    g.strokeStyle = rgba(BLK, 0.28); g.lineWidth = 0.8 * k; g.beginPath(); g.moveTo(-L, 0); g.lineTo(L, 0); g.stroke(); g.restore();
  });
  scatter(rn, N(60), W, H, R, 0, (x, y) => glow(g, x, y, (28 + rn() * 40) * k, mix(B.brickHi, B.bg0, 0.45), 0.13));
  const T = 11;
  for (let i = 0; i < T; i++) {
    const [ex, ey, nx, ny] = ring(R, (i + rn() * 0.6) / T, (1 + rn() * 5) * k), d = (110 + rn() * 130) * k, sx = ex + nx * d + (rn() - 0.5) * 90 * k, sy = ey + ny * d + (rn() - 0.5) * 90 * k;
    const c1x = sx + (ex - sx) * 0.35 + (rn() - 0.5) * 90 * k, c1y = sy + (ey - sy) * 0.35 + (rn() - 0.5) * 90 * k, c2x = sx + (ex - sx) * 0.7 + (rn() - 0.5) * 60 * k, c2y = sy + (ey - sy) * 0.7 + (rn() - 0.5) * 60 * k, pts = [];
    for (let j = 0; j <= 26; j++) { const t = j / 26, u = 1 - t; pts.push([u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex, u * u * u * sy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey]); }
    for (const [col, w0, w1, off] of [[mix(B.wall, B.bg1, 0.78), 17, 6, 0], [mix(B.wall, B.bg1, 0.52), 9, 3, -2.6]]) {
      for (let j = 1; j < pts.length; j++) { const t = j / pts.length; g.strokeStyle = col; g.lineCap = "round"; g.lineWidth = (w0 + (w1 - w0) * t) * k; g.beginPath(); g.moveTo(pts[j - 1][0] + off * k, pts[j - 1][1] + off * k); g.lineTo(pts[j][0] + off * k, pts[j][1] + off * k); g.stroke(); }
    }
    if (rn() < 0.5) blob(g, sx, sy, 20 * k, 11 * k, rn() * 3, rgba(B.brickB, 0.35));
  }
  scatter(rn, N(26), W, H, R, 6 * k, (x, y) => { for (let j = 0; j < 7; j++) { const a = -2.4 + j * 0.65, L = (16 + rn() * 12) * k; g.strokeStyle = rgba(rn() < 0.5 ? B.brickB : B.floor0, 0.8); g.lineWidth = 2.4 * k; g.lineCap = "round"; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5 - 6 * k, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); } });
  if (!o.flat) scatter(rn, N(22), W, H, R, 20 * k, (x, y) => blob(g, x, y, (50 + rn() * 90) * k, (30 + rn() * 50) * k, rn() * 3, rgba(BLK, 0.2)));
}

function ice(g, W, H, B, R, k, rn, o, N) {
  fillV(g, W, H, mix(B.sky, B.brickB, 0.5), mix(B.brickA, B.brickB, 0.45));
  scatter(rn, N(70), W, H, R, 0, (x, y) => { const rx = (26 + rn() * 70) * k, ry = rx * 0.38; blob(g, x + 4 * k, y + 5 * k, rx, ry, 0, rgba(B.floor1, 0.35)); blob(g, x, y, rx, ry, 0, rgba(B.brickA, 0.9)); blob(g, x - rx * 0.2, y - ry * 0.25, rx * 0.6, ry * 0.5, 0, rgba(WHT, 0.55)); });
  scatter(rn, N(40), W, H, R, 0, (x, y) => { const pts = wob(rn, x, y, x + (rn() - 0.5) * 120 * k, y + (rn() - 0.5) * 80 * k, 7, 28 * k); g.strokeStyle = rgba(B.floor1, 0.38); g.lineWidth = 1.2 * k; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); });
  scatter(rn, N(300), W, H, R, 0, (x, y) => { const s = (1.2 + rn() * 2.2) * k; g.fillStyle = rgba(WHT, 0.55 + rn() * 0.4); g.fillRect(x - s * 0.3, y - s, s * 0.6, s * 2); g.fillRect(x - s, y - s * 0.3, s * 2, s * 0.6); });
  if (!o.flat) scatter(rn, N(30), W, H, R, 10 * k, (x, y) => {
    const n = 2 + ((rn() * 3) | 0);
    for (let j = 0; j < n; j++) {
      const bx = x + (j - n / 2) * 13 * k, h = (24 + rn() * 46) * k, w = (7 + rn() * 5) * k;
      g.fillStyle = mix(B.brickHi, B.sky, 0.45); g.beginPath(); g.moveTo(bx - w, y); g.lineTo(bx, y - h); g.lineTo(bx, y); g.fill();
      g.fillStyle = mix(B.floor1, B.wall, 0.35); g.beginPath(); g.moveTo(bx, y - h); g.lineTo(bx + w, y); g.lineTo(bx, y); g.fill();
      g.fillStyle = rgba(BLK, 0.14); g.beginPath(); g.ellipse(bx + w * 1.4, y + 2 * k, w * 1.6, 3 * k, 0, 0, 6.2832); g.fill();
    }
  });
}

function factory(g, W, H, B, R, k, rn, o, N) {
  const cs = 64 * k;
  g.fillStyle = mix(B.floor1, B.bg1, 0.5); g.fillRect(0, 0, W, H);
  for (let iy = Math.floor(-R.y / cs) - 1; R.y + iy * cs < H; iy++) for (let ix = Math.floor(-R.x / cs) - 1; R.x + ix * cs < W; ix++) {
    const x = R.x + ix * cs, y = R.y + iy * cs, v = rn();
    g.fillStyle = mix(B.floor0, B.wall, 0.12 + v * 0.14); g.fillRect(x, y, cs, cs);
    if (v > 0.72) { g.strokeStyle = rgba(BLK, 0.22); g.lineWidth = 1.4 * k; for (let j = 6; j < 64; j += 8) { g.beginPath(); g.moveTo(x + 8 * k, y + j * k); g.lineTo(x + j * k, y + 8 * k); g.stroke(); } }
    g.strokeStyle = rgba(BLK, 0.55); g.lineWidth = 2 * k; g.strokeRect(x, y, cs, cs);
    g.strokeStyle = rgba(WHT, 0.1); g.lineWidth = 1.4 * k; g.beginPath(); g.moveTo(x + 1.5 * k, y + cs - 2 * k); g.lineTo(x + 1.5 * k, y + 1.5 * k); g.lineTo(x + cs - 2 * k, y + 1.5 * k); g.stroke();
    g.fillStyle = rgba(WHT, 0.16); for (const [a, b] of [[7, 7], [57, 7], [7, 57], [57, 57]]) { g.beginPath(); g.arc(x + a * k, y + b * k, 2.2 * k, 0, 6.2832); g.fill(); }
  }
  scatter(rn, N(30), W, H, R, 0, (x, y) => blob(g, x, y, (18 + rn() * 40) * k, (10 + rn() * 18) * k, rn() * 3, rgba(BLK, 0.18)));
  const hz = infl(R, 16 * k), th = 11 * k;
  g.save(); g.beginPath(); g.rect(hz.x - th, hz.y - th, hz.w + 2 * th, hz.h + 2 * th); g.rect(hz.x, hz.y, hz.w, hz.h); g.clip("evenodd");
  g.fillStyle = mix(B.bg1, B.floor1, 0.3); g.fillRect(hz.x - th, hz.y - th, hz.w + 2 * th, hz.h + 2 * th);
  g.fillStyle = B.brickA; const sp = 22 * k;
  for (let s = -H; s < W + H; s += sp) { g.beginPath(); g.moveTo(s, 0); g.lineTo(s + sp / 2, 0); g.lineTo(s + sp / 2 - H, H); g.lineTo(s - H, H); g.fill(); }
  g.restore();
  g.strokeStyle = rgba(BLK, 0.5); g.lineWidth = 1.6 * k; g.strokeRect(hz.x - th, hz.y - th, hz.w + 2 * th, hz.h + 2 * th);
  const T = 7;
  for (let i = 0; i < T; i++) {
    const [ex, ey, nx, ny] = ring(R, (i + 0.5 + (rn() - 0.5) * 0.4) / T, 27 * k), d = (150 + rn() * 200) * k, sx = ex + nx * d + (rn() - 0.5) * 60 * k, sy = ey + ny * d + (rn() - 0.5) * 60 * k;
    const c1x = sx - nx * d * 0.1 + (rn() - 0.5) * 140 * k, c1y = sy - ny * d * 0.1 + (rn() - 0.5) * 140 * k, c2x = ex + nx * d * 0.4 + (rn() - 0.5) * 100 * k, c2y = ey + ny * d * 0.4 + (rn() - 0.5) * 100 * k;
    const path = () => { g.beginPath(); g.moveTo(sx, sy); g.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey); };
    g.lineCap = "round"; g.strokeStyle = rgba(BLK, 0.3); g.lineWidth = 9 * k; g.save(); g.translate(2 * k, 3 * k); path(); g.stroke(); g.restore();
    g.strokeStyle = mix(B.bg1, B.floor1, 0.4); g.lineWidth = 8 * k; path(); g.stroke();
    g.strokeStyle = i % 3 === 0 ? B.brickA : i % 3 === 1 ? B.brickB : B.wall; g.lineWidth = 3.2 * k; g.save(); g.translate(-1.2 * k, -1.2 * k); path(); g.stroke(); g.restore();
    for (let j = 1; j < 5; j++) { const t = j / 5, u = 1 - t, x = u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex, y = u * u * u * sy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey; g.fillStyle = B.wall; g.fillRect(x - 5 * k, y - 5 * k, 10 * k, 10 * k); g.fillStyle = rgba(BLK, 0.5); g.fillRect(x - 5 * k, y + 2 * k, 10 * k, 3 * k); }
  }
}

function water(g, W, H, B, R, k, rn, o, N) {
  fillV(g, W, H, mix(B.bg0, B.floor0, 0.4), mix(B.bg1, B.bg0, 0.25));
  const lag = infl(R, 34 * k); g.fillStyle = rgba(B.floor0, 0.55); rr(g, lag.x, lag.y, lag.w, lag.h, 40 * k); g.fill();
  const lag2 = infl(R, 62 * k); g.fillStyle = rgba(B.floor0, 0.28); rr(g, lag2.x, lag2.y, lag2.w, lag2.h, 60 * k); g.fill();
  g.lineCap = "round";
  for (let i = 0; i < N(55); i++) { const y0 = rn() * H, x0 = rn() * W, L = (90 + rn() * 170) * k, A = (2 + rn() * 4) * k; g.strokeStyle = rgba(B.brickHi, 0.05 + rn() * 0.06); g.lineWidth = (1.4 + rn() * 1.6) * k; g.beginPath(); for (let s = 0; s <= 24; s++) { const t = s / 24; const x = x0 + t * L, y = y0 + Math.sin(t * 9 + i) * A; s ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  scatter(rn, N(34), W, H, R, 20 * k, (x, y) => { for (let j = 0; j < 3; j++) { g.strokeStyle = rgba(B.brickHi, 0.17 - j * 0.045); g.lineWidth = 1.6 * k; g.beginPath(); g.ellipse(x, y, (9 + j * 9) * k, (4 + j * 4) * k, 0, 0, 6.2832); g.stroke(); } });
  g.setLineDash([11 * k, 8 * k]); g.strokeStyle = rgba(WHT, 0.34); g.lineWidth = 3.6 * k; const f1 = infl(R, 9 * k); rr(g, f1.x, f1.y, f1.w, f1.h, 14 * k); g.stroke();
  g.setLineDash([5 * k, 12 * k]); g.strokeStyle = rgba(WHT, 0.2); g.lineWidth = 2 * k; const f2 = infl(R, 21 * k); rr(g, f2.x, f2.y, f2.w, f2.h, 24 * k); g.stroke(); g.setLineDash([]);
  scatter(rn, N(16), W, H, R, 36 * k, (x, y) => { const r = (9 + rn() * 7) * k; g.fillStyle = mix(B.brickB, B.bg1, 0.25); g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, 6.2832); g.fill(); g.strokeStyle = rgba(BLK, 0.35); g.lineWidth = 1.2 * k; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r, y - r * 0.15); g.stroke(); if (rn() < 0.4) { g.fillStyle = B.brickHi; g.beginPath(); g.arc(x + r * 0.2, y - r * 0.2, 2.2 * k, 0, 6.2832); g.fill(); } });
  if (!o.flat) scatter(rn, N(14), W, H, R, 40 * k, (x, y) => { for (let j = 0; j < 6; j++) { g.strokeStyle = rgba(j % 2 ? B.brickB : B.floor0, 0.9); g.lineWidth = 2.2 * k; g.lineCap = "round"; g.beginPath(); g.moveTo(x + (j - 3) * 3 * k, y); g.quadraticCurveTo(x + (j - 3) * 4 * k, y - 14 * k, x + (j - 3) * 6 * k + (rn() - 0.5) * 6 * k, y - (24 + rn() * 14) * k); g.stroke(); } });
}

function arena(g, W, H, B, R, k, rn, o, N) {
  const sand = mix(B.wall, B.floor0, 0.4);
  fillV(g, W, H, mix(sand, B.bg1, 0.55), mix(sand, B.bg1, 0.3));
  for (let i = 1; i < 14; i++) { const r = infl(R, i * 17 * k); g.strokeStyle = rgba(i % 2 ? WHT : BLK, i % 2 ? 0.06 : 0.13); g.lineWidth = 2.2 * k; rr(g, r.x, r.y, r.w, r.h, (14 + i * 17) * k); g.stroke(); }
  scatter(rn, N(260), W, H, R, 0, (x, y) => { const s = (1 + rn() * 2.6) * k; blob(g, x + k, y + k, s, s * 0.7, 0, rgba(BLK, 0.3)); blob(g, x, y, s, s * 0.7, 0, rgba(rn() < 0.5 ? B.wallHi : B.wall, 0.6)); });
  scatter(rn, N(34), W, H, R, 10 * k, (x, y) => { const a = rn() * 6.28; for (const s of [-1, 1]) blob(g, x + Math.cos(a + 1.57) * 4 * s * k, y + Math.sin(a + 1.57) * 4 * s * k, 3 * k, 5 * k, a, rgba(BLK, 0.17)); });
  scatter(rn, N(60), W, H, R, 0, (x, y) => blob(g, x, y, (22 + rn() * 50) * k, (10 + rn() * 14) * k, 0, rgba(B.bg1, 0.16)));
  if (o.flat) return;
  const poles = [];
  const sx = [R.x - 38 * k, R.x + R.w + 38 * k];
  for (const x of sx) for (let j = 0; j < 4; j++) poles.push([x, R.y + (0.14 + j * 0.27) * R.h]);
  for (let j = 0; j < 7; j++) poles.push([R.x + (j + 0.5) / 7 * R.w, R.y - 24 * k]);
  poles.forEach(([x, y], i) => {
    const w = 22 * k, h = (58 + (i % 3) * 10) * k, c = i % 2 ? B.brickA : B.brickB, c2 = i % 2 ? B.brickB : B.brickA;
    g.fillStyle = rgba(BLK, 0.28); g.beginPath(); g.ellipse(x + 6 * k, y + 4 * k, 12 * k, 4 * k, 0, 0, 6.2832); g.fill();
    g.fillStyle = mix(B.wall, B.bg1, 0.4); g.fillRect(x - 1.8 * k, y - h - 8 * k, 3.6 * k, h + 8 * k);
    g.fillStyle = B.wallHi; g.fillRect(x - w / 2 - 3 * k, y - h - 9 * k, w + 6 * k, 4 * k);
    g.fillStyle = c; g.beginPath(); g.moveTo(x - w / 2, y - h - 5 * k); g.lineTo(x + w / 2, y - h - 5 * k); g.lineTo(x + w / 2, y - 6 * k); g.lineTo(x, y - 17 * k); g.lineTo(x - w / 2, y - 6 * k); g.closePath(); g.fill();
    g.fillStyle = c2; g.beginPath(); g.moveTo(x - 4 * k, y - h * 0.82); g.lineTo(x + 4 * k, y - h * 0.82); g.lineTo(x, y - h * 0.5); g.closePath(); g.fill();
    g.fillStyle = rgba(BLK, 0.2); g.fillRect(x + w * 0.1, y - h - 5 * k, w * 0.4, h * 0.8);
  });
}

function sand(g, W, H, B, R, k, rn, o, N) {
  fillV(g, W, H, mix(B.floor0, B.brickHi, 0.1), mix(B.floor1, B.floor0, 0.3));
  const bands = Math.ceil(H / (62 * k)) + 2;
  for (let j = 0; j < bands; j++) {
    const y0 = j * 62 * k + rn() * 24 * k, A = (10 + rn() * 14) * k, la = (70 + rn() * 70) * k, ph = rn() * 6.28, wy = (x) => y0 + Math.sin(x / la + ph) * A + Math.sin(x / (la * 0.4) + ph * 2) * A * 0.25;
    g.beginPath(); g.moveTo(0, wy(0)); for (let x = 0; x <= W; x += 8 * k) g.lineTo(x, wy(x)); g.lineTo(W, wy(W) + 30 * k); for (let x = W; x >= 0; x -= 8 * k) g.lineTo(x, wy(x) + 30 * k); g.closePath();
    const q = g.createLinearGradient(0, y0, 0, y0 + 40 * k); q.addColorStop(0, rgba(B.bg1, 0.34)); q.addColorStop(1, rgba(B.bg1, 0)); g.fillStyle = q; g.fill();
    g.strokeStyle = rgba(B.brickHi, 0.34); g.lineWidth = 2.4 * k; g.beginPath(); for (let x = 0; x <= W; x += 8 * k) (x ? g.lineTo(x, wy(x)) : g.moveTo(x, wy(x))); g.stroke();
  }
  scatter(rn, N(260), W, H, R, 0, (x, y) => { const L = (6 + rn() * 12) * k; g.strokeStyle = rgba(B.bg1, 0.14); g.lineWidth = 1.2 * k; g.beginPath(); g.arc(x, y, L, 3.6, 5.6); g.stroke(); });
  glow(g, W * 0.12, H * 0.05, Math.max(W, H) * 0.45, B.brickHi, 0.2);
  scatter(rn, N(24), W, H, R, 6 * k, (x, y) => { const s = (6 + rn() * 12) * k; blob(g, x + 3 * k, y + 2 * k, s * 1.1, s * 0.4, 0, rgba(BLK, 0.28)); g.fillStyle = mix(B.wall, B.floor1, 0.35); g.beginPath(); g.ellipse(x, y - s * 0.2, s, s * 0.62, 0, 0, 6.2832); g.fill(); g.fillStyle = rgba(B.wallHi, 0.5); g.beginPath(); g.ellipse(x - s * 0.25, y - s * 0.45, s * 0.5, s * 0.22, 0, 0, 6.2832); g.fill(); });
}

function voidw(g, W, H, B, R, k, rn, o, N) {
  fillV(g, W, H, mix(B.bg1, B.brickB, 0.1), B.bg1);
  glow(g, W * 0.2, H * 0.22, Math.max(W, H) * 0.42, B.brickB, 0.3); glow(g, W * 0.82, H * 0.7, Math.max(W, H) * 0.38, B.brickA, 0.14); glow(g, W * 0.6, H * 0.1, Math.max(W, H) * 0.3, B.wall, 0.5);
  for (const [rx, ry, a] of [[330, 290, 0.5], [470, 420, 0.35], [650, 560, 0.22]]) { g.setLineDash([16 * k, 10 * k]); g.strokeStyle = rgba(mix(B.wall, B.wallHi, 0.4), a); g.lineWidth = 1.6 * k; g.beginPath(); g.ellipse(R.x + R.w / 2, R.y + R.h / 2, rx * k, ry * k, 0, 0, 6.2832); g.stroke(); } g.setLineDash([]);
  scatter(rn, N(1100), W, H, R, 0, (x, y) => { const s = (0.5 + rn() * rn() * 1.5) * Math.max(1, k * 0.9); g.fillStyle = rgba(B.wallHi, (o.px ? 0.4 : 0.12) + rn() * 0.6); g.fillRect(x, y, s, s); });
  scatter(rn, N(30), W, H, R, 0, (x, y) => { const s = (3 + rn() * 5) * k; g.strokeStyle = rgba(B.wallHi, 0.42); g.lineWidth = 1.1 * k; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke(); g.fillStyle = B.wallHi; g.fillRect(x - k, y - k, 2 * k, 2 * k); });
  if (!o.flat) scatter(rn, N(22), W, H, R, 8 * k, (x, y) => { const s = (5 + rn() * 10) * k, a = rn() * 3; g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = mix(B.wall, B.bg1, 0.1); g.beginPath(); g.moveTo(0, -s * 1.5); g.lineTo(s, 0); g.lineTo(0, s * 1.5); g.lineTo(-s, 0); g.closePath(); g.fill(); g.strokeStyle = rgba(B.wallHi, 0.5); g.lineWidth = k; g.stroke(); g.restore(); });
}

function crown(g, W, H, B, R, k, rn, o, N) {
  g.fillStyle = mix(B.bg1, B.wall, 0.22); g.fillRect(0, 0, W, H);
  const cs = 52 * k; g.fillStyle = rgba(BLK, 0.2);
  for (let iy = Math.floor(-R.y / cs) - 1; R.y + iy * cs < H; iy++) for (let ix = Math.floor(-R.x / cs) - 1; R.x + ix * cs < W; ix++) if ((ix + iy) & 1) g.fillRect(R.x + ix * cs, R.y + iy * cs, cs, cs);
  const car = infl(R, 74 * k); g.fillStyle = rgba(BLK, 0.3); rr(g, car.x + 4 * k, car.y + 6 * k, car.w, car.h, 6 * k); g.fill();
  g.fillStyle = mix(B.floor0, B.bg1, 0.2); rr(g, car.x, car.y, car.w, car.h, 6 * k); g.fill();
  g.save(); rr(g, car.x, car.y, car.w, car.h, 6 * k); g.clip(); g.strokeStyle = rgba(B.wall, 0.34); g.lineWidth = 1.6 * k;
  for (let s = -H; s < W + H; s += 34 * k) { g.beginPath(); g.moveTo(s, 0); g.lineTo(s + H, H); g.stroke(); g.beginPath(); g.moveTo(s + H, 0); g.lineTo(s, H); g.stroke(); }
  g.restore();
  for (const [d, c, w] of [[66 * k, mix(B.brickB, B.bg1, 0.25), 6 * k], [56 * k, rgba(mix(B.wallHi, B.brickB, 0.5), 0.7), 2 * k], [24 * k, mix(B.brickB, B.bg1, 0.2), 4 * k], [14 * k, rgba(mix(B.wallHi, B.brickB, 0.5), 0.6), 1.6 * k]]) { const r = infl(R, d); g.strokeStyle = c; g.lineWidth = w; rr(g, r.x, r.y, r.w, r.h, 4 * k); g.stroke(); }
  g.fillStyle = rgba(B.wallHi, 0.5); for (let i = 0; i < 40; i++) { const [x, y] = ring(R, i / 40, 40 * k); g.beginPath(); g.moveTo(x, y - 4 * k); g.lineTo(x + 3 * k, y); g.lineTo(x, y + 4 * k); g.lineTo(x - 3 * k, y); g.fill(); }
  if (o.flat) return;
  const cols = []; for (const x of [R.x - 94 * k, R.x + R.w + 94 * k]) for (let j = 0; j < 3; j++) cols.push([x, R.y + (0.2 + j * 0.34) * R.h]);
  cols.push([R.x + R.w * 0.22, R.y - 46 * k], [R.x + R.w * 0.78, R.y - 46 * k]);
  for (const [x, y] of cols) {
    const w = 15 * k, h = 130 * k;
    blob(g, x + 22 * k, y + 2 * k, 30 * k, 8 * k, 0, rgba(BLK, 0.3));
    g.fillStyle = mix(B.brickB, B.bg1, 0.3); g.fillRect(x - w - 5 * k, y - 8 * k, 2 * w + 10 * k, 10 * k);
    const q = g.createLinearGradient(x - w, 0, x + w, 0); q.addColorStop(0, B.wallHi); q.addColorStop(0.45, mix(B.wallHi, B.brickB, 0.45)); q.addColorStop(1, mix(B.brickB, B.bg1, 0.45)); g.fillStyle = q; g.fillRect(x - w, y - h, 2 * w, h - 8 * k);
    g.strokeStyle = rgba(BLK, 0.22); g.lineWidth = 1.2 * k; for (const dx of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(x + dx * w, y - h); g.lineTo(x + dx * w, y - 8 * k); g.stroke(); }
    g.fillStyle = B.wallHi; g.fillRect(x - w - 6 * k, y - h - 9 * k, 2 * w + 12 * k, 10 * k); g.fillStyle = mix(B.brickB, B.bg1, 0.2); g.fillRect(x - w - 3 * k, y - h - 1 * k, 2 * w + 6 * k, 3 * k);
  }
}

const PAINT = [jungle, ice, factory, water, arena, sand, voidw, crown];
export function paintSet(g, W, H, B, R, k, o = {}) {
  const idx = Math.max(0, o.idx | 0), rn = rng(0x5eed + idx * 7919), A = (W * H) / (k * k) / 1e6, N = (n) => Math.max(4, Math.round(n * A * (o.px ? 0.7 : 1)));
  g.save(); g.lineCap = "butt"; g.lineJoin = "round";
  PAINT[idx % PAINT.length](g, W, H, B, R, k, rn, o, N);
  g.restore();
  const cx = R.x + R.w / 2, cy = R.y + R.h / 2, rad = Math.max(W, H) * 0.78;
  const v = g.createRadialGradient(cx, cy, Math.min(R.w, R.h) * 0.5, cx, cy, rad); v.addColorStop(0, rgba(BLK, 0)); v.addColorStop(1, rgba(B.bg1, o.flat ? 0.45 : 0.62)); g.fillStyle = v; g.fillRect(0, 0, W, H);
  if (o.fade) { const f = Math.min(W, H) * 0.2; for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, f, 0, 0, 0, f, H], [W, 0, W - f, 0, W - f, 0, f, H], [0, 0, 0, f, 0, 0, W, f], [0, H, 0, H - f, 0, H - f, W, f]]) { const q = g.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, B.bg1); q.addColorStop(1, rgba(B.bg1, 0)); g.fillStyle = q; g.fillRect(rx, ry, rw, rh); } }
  if (o.px) posterize(g, W, H, o.levels || 8);
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function posterize(g, W, H, L) {
  let im; try { im = g.getImageData(0, 0, W, H); } catch { return; }
  const d = im.data, st = 255 / (L - 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, t = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5;
    for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, Math.round((d[i + c] / st + t * 0.8)) * st));
  }
  g.putImageData(im, 0, 0);
}
