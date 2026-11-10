/* The Chrome-side readability gates of the UI upgrade appendix section 11, as pure functions over one capture: its decoded PNG (an RGBA image
   {width, height, data}, see tools/pixel/rgba.mjs unpng), its optional text-hidden twin, and the dump shots.mjs writes beside it ({flags, read, canvases,
   ui}: ui is window.__GAME__.ui.snap(), the page's own record of what it drew, src/render/kit/probe.js). Dev only, zero deps, never imported by src/.

   Coordinates: probe rects are logical box px on the canvas named by ui.box.el; mapper() turns them into CSS px through that canvas's CSS content
   box (canvases[el], border and padding already taken off by shots.mjs), and the capture holds CSS px x flags.dpr device px.
   Squint (the mock's round7/K7-kit/measure.mjs, ported): the capture box-filtered over k = round(2 x dpr) device px (4 px at a 2x capture), each
   box's 8-bit R G B averaged FIRST and only then linearised, Rec.709 Y; a squint px is 2 CSS px, so the image is greyscale at half size. A rect's
   stats are the mean / max / min / sd over the squint px it covers (x0 = round(x s), x1 = max(x0 + 1, round((x + w) s)), s = dpr / k).
   Contrast is (max + .05) / (min + .05) of two means.

   Gates (value, threshold, and the pair or text it was measured on; each item is listed too):
     chosen   chosen pairs (chosen vs unchosen, keycap vs chosen): squint mean contrast >= 3
     band     band pairs (focus band vs bed): squint mean contrast >= 1.5
     ring     ring pairs: (ring max + .05) / (surround mean + .05) >= 3, squint
     locked   locked pairs: squint mean contrast vs a chosen part >= 3; with o.floor, the locked texture sd / max(1e-4, the floor cell's sd) >= 2
     info     info pairs at full resolution: a holds the text, b its background; light text (a's max sits further above b's mean than a's min below
              it) is (a max + .05) / (b max + .05), dark text (b min + .05) / (a min + .05); >= 4.5, >= 3 with o.lock
     text     every text with o.col against the TEXT-HIDDEN capture under its cap band (the appendix method): light text (L > .18) vs the brightest
              pixel under it, dark text vs the darkest; >= 4.5, >= 3 with o.lock
     cap      cap height in CSS px by role and device (desktop primary 14 / secondary 11 / hud 18, body font px 17.9; phone 11 / 9 / 11 / 14.1),
              0.05 tolerance as the mock's audit; the same floors at 125 %
     inside   every text box inside the page box (0.5 px tolerance): count outside = 0
     plate    every plate rect (o.plate = its ring width T) keeps the ring inside the page box: count outside = 0
     touch    phone only: every touch target >= 43.95 x 43.95 CSS px
     gap      phone only: >= 8 CSS px between targets of one set (o.set); members of the same kind list|tab|bank|step are exempt, nested ones skipped
     yellow   distinct part names filled #ffd447 (o.fill) <= 1
   Status: pass | fail | skipped (the gate needs data the capture lacks: no probe data, no canvas mapping, no text-hidden capture, a sample outside the
   capture) | n/a (it does not apply: a desktop capture for touch, no part of that kind declared). A skip is never a pass; tally().exit(strict) fails a
   skip only under --strict, never an n/a. */
export const FLOOR = Object.freeze({ chosen: 3, band: 1.5, ring: 3, locked: 3, lockedSd: 2, info: 4.5, infoLock: 3, touch: 43.95, gap: 8, yellow: 1 });
export const CAP = Object.freeze({ d: Object.freeze({ primary: 14, secondary: 11, hud: 18, body: 17.9 }), p: Object.freeze({ primary: 11, secondary: 9, hud: 11, body: 14.1 }) });
export const GATES = Object.freeze(["chosen", "band", "ring", "locked", "info", "text", "cap", "inside", "plate", "touch", "gap", "yellow"]);
const TH = { chosen: FLOOR.chosen, band: FLOOR.band, ring: FLOOR.ring, locked: FLOOR.locked, info: FLOOR.info, text: FLOOR.info, cap: null, inside: 0, plate: 0, touch: FLOOR.touch, gap: FLOOR.gap, yellow: FLOOR.yellow };
const TOL = 0.05, EXEMPT = /^(list|tab|bank|step)$/, YEL = /^#ffd447$/i;

export const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const Y = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const r2 = (v) => (v == null ? null : +v.toFixed(2));
export const cr = (a, b) => r2((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
/* #rgb, #rrggbb, rgb() / rgba() -> relative luminance, else null */
export function lumOf(c) {
  const s = String(c || "").trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return Y(...[...m[1]].map((h) => parseInt(h + h, 16)));
  if ((m = /^#([0-9a-f]{6})/i.exec(s))) return Y(...[0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)));
  if ((m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s))) return Y(+m[1], +m[2], +m[3]);
  return null;
}

export function squint(img, dpr) {
  const k = Math.max(1, Math.round(2 * dpr)), W = img.width, w = Math.floor(W / k), h = Math.floor(img.height / k), L = new Float32Array(w * h), d = img.data, n = k * k;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let R = 0, G = 0, B = 0;
    for (let b = 0; b < k; b++) { let o = ((j * k + b) * W + i * k) * 4; for (let a = 0; a < k; a++, o += 4) { R += d[o]; G += d[o + 1]; B += d[o + 2]; } }
    L[j * w + i] = Y(R / n, G / n, B / n);
  }
  return { w, h, L, s: dpr / k };
}
const span = (v0, v1, n) => { const a = Math.max(0, v0), b = Math.min(n, Math.max(v0 + 1, v1)); return a < b ? [a, b] : null; };
function acc(get, xs, ys) {
  if (!xs || !ys) return null;
  let n = 0, m = 0, q = 0, mx = -Infinity, mn = Infinity;
  for (let j = ys[0]; j < ys[1]; j++) for (let i = xs[0]; i < xs[1]; i++) { const v = get(i, j); n++; m += v; q += v * v; if (v > mx) mx = v; if (v < mn) mn = v; }
  m /= n;
  return { n, mean: m, max: mx, min: mn, sd: Math.sqrt(Math.max(0, q / n - m * m)) };
}
/* a CSS px rect on the squint image */
export function stat(sq, r) {
  const s = sq.s, x0 = Math.round(r.x * s), y0 = Math.round(r.y * s);
  return acc((i, j) => sq.L[j * sq.w + i], span(x0, Math.round((r.x + (r.w || 0)) * s), sq.w), span(y0, Math.round((r.y + (r.h || 0)) * s), sq.h));
}
/* a CSS px rect at full resolution, per device px */
export function full(img, dpr, r) {
  const d = img.data, W = img.width, x0 = Math.floor(r.x * dpr), y0 = Math.floor(r.y * dpr);
  return acc((i, j) => { const o = (j * W + i) * 4; return Y(d[o], d[o + 1], d[o + 2]); }, span(x0, Math.ceil((r.x + (r.w || 0)) * dpr), W), span(y0, Math.ceil((r.y + (r.h || 0)) * dpr), img.height));
}
/* box px -> CSS px through the canvas the page names in ui.box.el; null when the dump cannot say where the page sits */
export function mapper(d) {
  const u = d && d.ui, box = u && u.box, cv = box && box.el && d.canvases ? d.canvases[box.el] : null;
  if (!box || !(box.w > 0) || !(box.h > 0) || !cv || !(cv.w > 0) || !(cv.h > 0)) return null;
  const sx = cv.w / box.w, sy = cv.h / box.h;
  return { sx, sy, css: (r) => ({ x: cv.x + r.x * sx, y: cv.y + r.y * sy, w: (r.w || 0) * sx, h: (r.h || 0) * sy }) };
}

const G = (status, o = {}) => ({ status, value: null, threshold: null, on: null, note: null, items: [], ...o });
/* one measurement; the rounded value is what is judged (the mock rounds to 2 places first); o.tol lowers a floor (cap heights: the audit's 0.05) */
const item = (on, value, threshold, lo = true, o = {}) => {
  const v = r2(value), { tol = 0, ...rest } = o;
  return { on, value: v, threshold, status: v == null || threshold == null ? "skipped" : (lo ? v >= threshold - tol : v <= threshold) ? "pass" : "fail", ...rest };
};
const r4 = (v) => +v.toFixed(4);
/* the gate from its items: fail if any fails, else skipped if any could not be measured, else pass; value / on from the worst measured item */
function sum(items, th, lo = true) {
  const meas = items.filter((i) => i.value != null), bad = items.find((i) => i.status === "fail") ? "fail" : items.some((i) => i.status === "skipped") ? "skipped" : "pass";
  const w = meas.slice().sort((a, b) => (lo ? a.value / a.threshold - b.value / b.threshold : b.value - a.value))[0];
  const sk = items.find((i) => i.status === "skipped");
  return G(bad, { value: w ? w.value : null, threshold: w ? w.threshold : th, on: w ? w.on : sk ? sk.on : null, note: bad === "skipped" && sk ? sk.note || null : null, items });
}
const nm = (p, i) => p.name || (p.a.name && p.b.name ? p.a.name + " vs " + p.b.name : p.kind + " #" + (i + 1));

export function evaluate(d, img, notext) {
  const u = d && d.ui, rects = (u && u.rects) || [], texts = (u && u.texts) || [], pairs = (u && u.pairs) || [];
  if (!rects.length && !texts.length && !pairs.length) return Object.fromEntries(GATES.map((g) => [g, G("skipped", { threshold: TH[g], note: "no probe data" })]));
  const f = d.flags || {}, dpr = +f.dpr || 1, phone = !!f.phone, m = mapper(d), box = u.box, sq = m && img ? squint(img, dpr) : null, out = {};
  const noMap = (g) => G("skipped", { threshold: TH[g], note: !box ? "no page box (begin without a box)" : !m ? "no canvas mapping (box.el names no captured canvas)" : "no capture PNG" });
  const kinds = (k) => pairs.map((p, i) => [p, i]).filter(([p]) => p.kind === k);
  for (const k of ["chosen", "band", "ring", "locked", "info"]) {
    const ps = kinds(k);
    if (!ps.length) { out[k] = G("n/a", { threshold: TH[k], note: "no " + k + " pair declared" }); continue; }
    if (!sq) { out[k] = noMap(k); continue; }
    const items = [];
    for (const [p, i] of ps) {
      const A = m.css(p.a), B = m.css(p.b), on = nm(p, i), at = { a: p.a, b: p.b };
      if (k === "info") {
        const fa = full(img, dpr, A), fb = full(img, dpr, B), th = p.lock ? FLOOR.infoLock : FLOOR.info;
        if (!fa || !fb) { items.push(item(on, null, th, true, { ...at, note: "a sample outside the capture" })); continue; }
        const light = fa.max - fb.mean >= fb.mean - fa.min;
        items.push(item(on, light ? (fa.max + 0.05) / (fb.max + 0.05) : (fb.min + 0.05) / (fa.min + 0.05), th, true, { ...at, light }));
        continue;
      }
      const sa = stat(sq, A), sb = stat(sq, B);
      if (!sa || !sb) { items.push(item(on, null, TH[k], true, { ...at, note: "a sample outside the capture" })); continue; }
      if (k === "ring") items.push(item(on, (sa.max + 0.05) / (sb.mean + 0.05), FLOOR.ring, true, { ...at, ringMax: r4(sa.max), plateMean: r4(sb.mean) }));
      else items.push(item(on, cr(sa.mean, sb.mean), FLOOR[k], true, { ...at, meanA: r4(sa.mean), meanB: r4(sb.mean) }));
      if (k === "locked" && p.floor) {
        const sf = stat(sq, m.css(p.floor));
        items.push(sf ? item(on + " texture sd", sa.sd / Math.max(1e-4, sf.sd), FLOOR.lockedSd, true, { a: p.a, floor: p.floor }) : item(on + " texture sd", null, FLOOR.lockedSd, true, { note: "the floor cell is outside the capture" }));
      }
    }
    out[k] = sum(items, TH[k]);
  }
  const col = texts.filter((t) => t.col != null);
  if (!col.length) out.text = G("n/a", { threshold: TH.text, note: "no text colour declared" });
  else if (!m) out.text = noMap("text");
  else if (!notext) out.text = G("skipped", { threshold: TH.text, note: "no text-hidden capture (shots.mjs takes one when a text declares o.col, or with --notext)" });
  else {
    out.text = sum(col.map((t) => {
      const Lt = lumOf(t.col), th = t.lock ? FLOOR.infoLock : FLOOR.info, bg = full(notext, dpr, m.css({ x: t.x, y: t.y, w: t.w, h: t.capH }));
      if (Lt == null || !bg) return item(t.s, null, th, true, { note: Lt == null ? "unreadable colour " + t.col : "outside the capture" });
      const light = Lt > 0.18;
      return item(t.s, light ? (Lt + 0.05) / (bg.max + 0.05) : (bg.min + 0.05) / (Lt + 0.05), th, true, { col: t.col, light });
    }), TH.text);
  }
  if (!texts.length) out.cap = G("n/a", { note: "no text recorded" });
  else if (!m) out.cap = noMap("cap");
  else {
    const F = CAP[phone ? "p" : "d"];
    out.cap = sum(texts.map((t) => {
      const th = F[t.role];
      if (th == null) return item(t.s, null, null, true, { note: "unknown role " + t.role });
      if (t.role === "body") return t.px > 0 ? item(t.s, t.px * m.sy, th, true, { role: t.role, unit: "font px", tol: TOL }) : item(t.s, null, th, true, { note: "body text without o.px" });
      return item(t.s, t.capH * m.sy, th, true, { role: t.role, tol: TOL });
    }), null);
  }
  const outside = (x, y, w, h) => x < -0.5 || y < -0.5 || x + w > box.w + 0.5 || y + h > box.h + 0.5;
  if (!texts.length) out.inside = G("n/a", { threshold: 0, note: "no text recorded" });
  else if (!box) out.inside = G("skipped", { threshold: 0, note: "no page box (begin without a box)" });
  else {
    const o = texts.filter((t) => outside(t.x, t.y, t.w, t.capH));
    out.inside = G(o.length ? "fail" : "pass", { value: o.length, threshold: 0, on: o.length ? o[0].s : null, items: o.map((t) => ({ on: t.s, x: t.x, y: t.y, w: t.w, h: t.capH, status: "fail" })) });
  }
  const plates = rects.filter((r) => r.plate != null && r.plate !== false);
  if (!plates.length) out.plate = G("n/a", { threshold: 0, note: "no plate declared" });
  else if (!box) out.plate = G("skipped", { threshold: 0, note: "no page box (begin without a box)" });
  else {
    const o = plates.filter((r) => { const T = typeof r.plate === "number" ? r.plate : phone ? 10 : 16; return outside(r.x - T, r.y - T, r.w + 2 * T, r.h + 2 * T); });
    out.plate = G(o.length ? "fail" : "pass", { value: o.length, threshold: 0, on: o.length ? o[0].name : null, items: o.map((r) => ({ on: r.name, status: "fail" })) });
  }
  const tg = rects.filter((r) => r.touch);
  if (!phone) { out.touch = G("n/a", { threshold: TH.touch, note: "desktop capture" }); out.gap = G("n/a", { threshold: TH.gap, note: "desktop capture" }); }
  else if (!tg.length) { out.touch = G("skipped", { threshold: TH.touch, note: "no touch target declared" }); out.gap = G("skipped", { threshold: TH.gap, note: "no touch target declared" }); }
  else if (!m) { out.touch = noMap("touch"); out.gap = noMap("gap"); }
  else {
    const C = tg.map((r) => ({ r, c: m.css(r) }));
    out.touch = sum(C.map(({ r, c }) => item(r.name, Math.min(c.w, c.h), FLOOR.touch, true, { w: r2(c.w), h: r2(c.h) })), TH.touch);
    const items = [];
    for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
      const A = C[i], B = C[j];
      if (A.r.set == null || A.r.set !== B.r.set || (A.r.kind && A.r.kind === B.r.kind && EXEMPT.test(A.r.kind))) continue;
      const a = A.c, b = B.c, inA = b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h, inB = a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
      if (inA || inB) continue;
      const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)), dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
      items.push(item(A.r.name + " / " + B.r.name, dx === 0 && dy === 0 ? 0 : Math.max(dx, dy), FLOOR.gap, true, { set: A.r.set }));
    }
    out.gap = items.length ? sum(items, TH.gap) : G(tg.some((r) => r.set != null) ? "n/a" : "skipped", { threshold: TH.gap, note: tg.some((r) => r.set != null) ? "no two targets share a set" : "no target set declared (o.set)" });
  }
  const fills = rects.filter((r) => r.fill != null);
  if (!fills.length) out.yellow = G("n/a", { threshold: TH.yellow, note: "no fill declared" });
  else {
    const y = [...new Set(fills.filter((r) => YEL.test(String(r.fill))).map((r) => r.name))];
    out.yellow = G(y.length <= FLOOR.yellow ? "pass" : "fail", { value: y.length, threshold: FLOOR.yellow, on: y.join(", ") || null, items: y.map((n) => ({ on: n, status: "counted" })) });
  }
  return out;
}

/* counts over [{gates}] and the exit code: 1 on a fail, on no capture at all, and (strict) on a skip; n/a never fails */
export function tally(caps) {
  const t = { captures: caps.length, pass: 0, fail: 0, skipped: 0, na: 0 };
  for (const c of caps) for (const g of Object.values(c.gates || {})) t[g.status === "n/a" ? "na" : g.status]++;
  t.exit = (strict) => (t.fail > 0 || t.captures === 0 || (strict && t.skipped > 0) ? 1 : 0);
  return t;
}
