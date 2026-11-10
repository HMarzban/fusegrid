/* The Chrome-side readability gates of the UI upgrade appendix section 11, as pure functions over one capture: its decoded PNG (an RGBA image
   {width, height, data}, see tools/pixel/rgba.mjs unpng), its optional text-hidden twin, and the dump shots.mjs writes beside it ({flags, read, canvases,
   ui}: ui is window.__GAME__.ui.snap(), the page's own record of what it drew, src/render/kit/probe.js). Dev only, zero deps, never imported by src/.

   Coordinates: probe rects are logical box px on the canvas named by ui.box.el; mapper() turns them into CSS px through that canvas's CSS content
   box (canvases[el], border and padding already taken off by shots.mjs), and the capture holds CSS px x flags.dpr device px.
   Squint (the mock's round7/K7-kit/measure.mjs, ported): the capture box-filtered over k = round(2 x dpr) device px (4 px at a 2x capture), each
   box's 8-bit R G B averaged FIRST and only then linearised, Rec.709 Y; a squint px is 2 CSS px, so the image is greyscale at half size. A rect's
   stats are the mean / max / min / sd over the squint px it covers (x0 = round(x s), x1 = max(x0 + 1, round((x + w) s)), s = dpr / k).
   Contrast is (max + .05) / (min + .05) of two means, rounded to 2 places before it is judged (as the mock).
   The colour rule (text and info): the declared colour's luminance L against the background's brightest pixel when L > .18 (light on dark),
   (L + .05) / (max + .05), else against its darkest, (min + .05) / (L + .05); >= 4.5, >= 3 with o.lock. A colour must be opaque #rgb, #rrggbb or
   rgb(): a translucent one cannot be judged from its value and fails.

   Gates (value, threshold, and the pair or text it was measured on; every item is listed too):
     record   the probe record is whole: overflow (more than probe.CAP_N entries a frame) fails
     chosen   chosen pairs (chosen vs unchosen, keycap vs chosen): squint mean contrast >= 3
     band     band pairs (focus band vs bed): squint mean contrast >= 1.5
     ring     ring pairs: (ring max + .05) / (surround mean + .05) >= 3, squint
     locked   locked pairs: squint mean contrast of the whole locked part vs a chosen part >= 3; and the texture: the sd of the locked part's lip
              (x + 3, y + 3, w x .2, h - 6 in CSS px, the mocks' sub-rect, clear of the outline and the legend) / max(1e-4, the o.floor cell's sd) >= 2;
              a locked pair without o.floor leaves that item skipped
     info     NON-TEXT marks (chevrons, glyphs, icons, meters): the mark's declared o.col by the colour rule against b, the background region, on
              the text-hidden twin when there is one, else the capture; a only locates the mark
     text     every recorded text by the colour rule: o.col against the TEXT-HIDDEN twin under its cap band (the appendix method); a text without o.col
              is an unmeasured (skipped) item, and with no twin the gate is skipped
     cap      cap height in CSS px by role and device (desktop primary 14 / secondary 11 / hud 18, body font px 17.9; phone 11 / 9 / 11 / 14.1),
              0.05 tolerance as the mock's audit; the same floors at 125 %. An unknown role or body text without o.px fails
     inside   every text box inside the page box (0.5 px tolerance): count outside = 0
     plate    every plate rect keeps its ring inside the page box: o.plate a number = T in box px, true = the appendix T (16 desktop / 10 phone) in
              CSS px, taken through the box-to-CSS scale; count outside = 0
     yellow   distinct parts (name AND rect) whose o.fill is #ffd447 <= 1
     touch    touch captures only: every touch target >= 43.95 x 43.95 CSS px
     gap      touch captures only: >= 8 CSS px between two targets of one set, and between a target without o.set and every other target; members of
              one set of the same kind list|tab|bank|step are exempt, a target nested in another is skipped, an overlap is 0. With only exempt or
              nested pairs the gate passes with no value (nothing it forbids exists); with fewer than two targets it is skipped
   Bad data never measures as 0: a null or non-finite number in the dump fails its item (the probe throws on one while recording).
   Status: pass | fail | skipped (the gate needs data the capture lacks: no probe data, no canvas mapping, no text-hidden twin, a sample outside the
   capture, a required gate the page did not declare) | n/a (only touch and gap on a desktop capture). REQUIRED gates are default-deny: on an
   instrumented capture each one in `need` (tools/ui/lib/screens.mjs: all of REQUIRED but what the screen's row exempts, with a reason) that would
   be n/a is skipped, "required, not declared". tally().exit(strict) fails on a fail, on no capture, and under --strict on a skip; never on n/a. */
export const FLOOR = Object.freeze({ chosen: 3, band: 1.5, ring: 3, locked: 3, lockedSd: 2, info: 4.5, infoLock: 3, touch: 43.95, gap: 8, yellow: 1 });
export const CAP = Object.freeze({ d: Object.freeze({ primary: 14, secondary: 11, hud: 18, body: 17.9 }), p: Object.freeze({ primary: 11, secondary: 9, hud: 11, body: 14.1 }) });
export const GATES = Object.freeze(["record", "chosen", "band", "ring", "locked", "info", "text", "cap", "inside", "plate", "yellow", "touch", "gap"]);
export const REQUIRED = Object.freeze(["chosen", "band", "ring", "locked", "info", "text", "cap", "inside", "plate", "yellow"]);
export const PLATE_T = Object.freeze({ d: 16, p: 10 });
const TH = { record: null, chosen: FLOOR.chosen, band: FLOOR.band, ring: FLOOR.ring, locked: FLOOR.locked, info: FLOOR.info, text: FLOOR.info, cap: null, inside: 0, plate: 0, yellow: FLOOR.yellow, touch: FLOOR.touch, gap: FLOOR.gap };
const TOL = 0.05, EXEMPT = /^(list|tab|bank|step)$/, YEL = [255, 212, 71];

export const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const Y = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const r2 = (v) => +v.toFixed(2), r4 = (v) => +v.toFixed(4);
export const cr = (a, b) => r2((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
/* an opaque #rgb, #rrggbb (#rrggbbff), rgb() or rgba(.., 1) -> {rgb, L}; anything else {err} */
export function colOf(c) {
  const s = String(c == null ? "" : c).trim();
  let m, rgb = null, a = 1;
  if ((m = /^#([0-9a-f]{3})$/i.exec(s))) rgb = [...m[1]].map((h) => parseInt(h + h, 16));
  else if ((m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s))) { rgb = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)); if (m[2]) a = parseInt(m[2], 16) / 255; }
  else if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s))) { rgb = [+m[1], +m[2], +m[3]]; if (m[4] !== undefined) a = +m[4]; }
  if (!rgb || rgb.some((v) => !(v >= 0 && v <= 255))) return { err: "not a colour: " + JSON.stringify(c) };
  if (!(a >= 1)) return { err: "translucent colour " + s + " cannot be judged from its value" };
  return { rgb, L: Y(...rgb) };
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
const fin = (...v) => v.every((n) => typeof n === "number" && Number.isFinite(n));
const okRect = (r) => !!r && fin(r.x, r.y, r.w, r.h);
const okBox = (b) => !!b && fin(b.w, b.h) && b.w > 0 && b.h > 0;
/* box px -> CSS px through the canvas the page names in ui.box.el; null when the dump cannot say where the page sits */
export function mapper(d) {
  const u = d && d.ui, box = u && u.box, cv = okBox(box) && box.el && d.canvases ? d.canvases[box.el] : null;
  if (!cv || !fin(cv.x, cv.y, cv.w, cv.h) || !(cv.w > 0) || !(cv.h > 0)) return null;
  const sx = cv.w / box.w, sy = cv.h / box.h;
  return { sx, sy, css: (r) => ({ x: cv.x + r.x * sx, y: cv.y + r.y * sy, w: (r.w || 0) * sx, h: (r.h || 0) * sy }) };
}

const G = (status, o = {}) => ({ status, value: null, threshold: null, on: null, note: null, items: [], ...o });
/* one measurement (a finite value) judged >= threshold (minus o.tol: cap heights take the audit's 0.05); bad(): data that cannot be judged fails */
const item = (on, value, threshold, o = {}) => { const v = r2(value), { tol = 0, ...rest } = o; return { on, value: v, threshold, status: v >= threshold - tol ? "pass" : "fail", ...rest }; };
const bad = (on, threshold, note, o = {}) => ({ on, value: null, threshold, status: "fail", note, ...o });
const skip = (on, threshold, note, o = {}) => ({ on, value: null, threshold, status: "skipped", note, ...o });
/* the gate from its items: fail if any fails, else skipped if any could not be measured (or there is none), else pass; value from the worst
   measured item, on / note from the item that decides the status */
function sum(items, th) {
  if (!items.length) return G("skipped", { threshold: th, note: "nothing measured" });
  const meas = items.filter((i) => i.value != null).sort((a, b) => a.value / a.threshold - b.value / b.threshold);
  const st = items.some((i) => i.status === "fail") ? "fail" : items.some((i) => i.status === "skipped") ? "skipped" : "pass";
  const by = st === "pass" ? meas[0] : meas.find((i) => i.status === st) || items.find((i) => i.status === st);
  return G(st, { value: meas.length ? meas[0].value : null, threshold: by.threshold ?? th, on: by.on, note: by.note || null, items });
}
const nm = (p, i) => p.name || (p.a && p.b && p.a.name && p.b.name ? p.a.name + " vs " + p.b.name : p.kind + " #" + (i + 1));

export function evaluate(d, img, notext, need = REQUIRED) {
  const u = d && d.ui, rects = (u && u.rects) || [], texts = (u && u.texts) || [], pairs = (u && u.pairs) || [];
  if (!rects.length && !texts.length && !pairs.length && !(u && u.overflow)) return Object.fromEntries(GATES.map((g) => [g, G("skipped", { threshold: TH[g], note: "no probe data" })]));
  const f = d.flags || {}, dpr = +f.dpr || 1, phone = !!f.phone, box = u.box, boxBad = !!box && !okBox(box), m = mapper(d), sq = m && img ? squint(img, dpr) : null, out = {};
  const noMap = (g) => G(boxBad ? "fail" : "skipped", { threshold: TH[g], note: boxBad ? "the page box has a non-finite or empty size" : !box ? "no page box (begin without a box)" : !m ? "no canvas mapping (box.el names no captured canvas)" : "no capture PNG" });
  out.record = u.overflow ? G("fail", { note: "the probe record overflowed (more than probe.CAP_N entries a frame: a page recording without begin?)" }) : G("pass");
  const bgImg = notext || img;
  for (const k of ["chosen", "band", "ring", "locked", "info"]) {
    const ps = pairs.map((p, i) => [p, i]).filter(([p]) => p.kind === k);
    if (!ps.length) { out[k] = G("n/a", { threshold: TH[k], note: "no " + k + " pair declared" }); continue; }
    if (!sq) { out[k] = noMap(k); continue; }
    const items = [];
    for (const [p, i] of ps) {
      const on = nm(p, i), at = { a: p.a, b: p.b };
      if (!okRect(p.a) || !okRect(p.b)) { items.push(bad(on, TH[k], "a null or non-finite coordinate", at)); continue; }
      const A = m.css(p.a), B = m.css(p.b);
      if (k === "info") {
        const c = colOf(p.col), th = p.lock ? FLOOR.infoLock : FLOOR.info, bg = full(bgImg, dpr, B);
        if (c.err) { items.push(bad(on, th, "the mark's o.col: " + c.err, at)); continue; }
        if (!bg) { items.push(skip(on, th, "b is outside the capture", at)); continue; }
        const light = c.L > 0.18;
        items.push(item(on, light ? (c.L + 0.05) / (bg.max + 0.05) : (bg.min + 0.05) / (c.L + 0.05), th, { ...at, col: p.col, light, bgFrom: notext ? "twin" : "capture" }));
        continue;
      }
      const sa = stat(sq, A), sb = stat(sq, B);
      if (!sa || !sb) { items.push(skip(on, TH[k], "a sample outside the capture", at)); continue; }
      if (k === "ring") items.push(item(on, (sa.max + 0.05) / (sb.mean + 0.05), FLOOR.ring, { ...at, ringMax: r4(sa.max), plateMean: r4(sb.mean) }));
      else items.push(item(on, cr(sa.mean, sb.mean), FLOOR[k], { ...at, meanA: r4(sa.mean), meanB: r4(sb.mean) }));
      if (k !== "locked") continue;
      const tn = on + " texture sd";
      if (!p.floor) { items.push(skip(tn, FLOOR.lockedSd, "no floor cell declared (o.floor)")); continue; }
      if (!okRect(p.floor)) { items.push(bad(tn, FLOOR.lockedSd, "a null or non-finite floor coordinate")); continue; }
      const lip = { x: A.x + 3, y: A.y + 3, w: A.w * 0.2, h: A.h - 6 }, sl = stat(sq, lip), sf = stat(sq, m.css(p.floor));
      items.push(sl && sf ? item(tn, sl.sd / Math.max(1e-4, sf.sd), FLOOR.lockedSd, { lip: { x: r2(lip.x), y: r2(lip.y), w: r2(lip.w), h: r2(lip.h) }, lipSd: r4(sl.sd), floorSd: r4(sf.sd) }) : skip(tn, FLOOR.lockedSd, "the lip or the floor cell is outside the capture"));
    }
    out[k] = sum(items, TH[k]);
  }
  if (!texts.length) out.text = G("n/a", { threshold: TH.text, note: "no text recorded" });
  else if (!m) out.text = noMap("text");
  else if (!notext) out.text = G("skipped", { threshold: TH.text, note: "no text-hidden twin (shots.mjs takes one when a text declares o.col, or with --notext)" });
  else {
    out.text = sum(texts.map((t) => {
      const th = t.lock ? FLOOR.infoLock : FLOOR.info;
      if (!fin(t.x, t.y, t.w, t.capH)) return bad(t.s, th, "a null or non-finite coordinate");
      if (t.col == null) return skip(t.s, th, "no o.col: its contrast is not measured");
      const c = colOf(t.col), bg = full(notext, dpr, m.css({ x: t.x, y: t.y, w: t.w, h: t.capH }));
      if (c.err) return bad(t.s, th, c.err);
      if (!bg) return skip(t.s, th, "outside the capture");
      const light = c.L > 0.18;
      return item(t.s, light ? (c.L + 0.05) / (bg.max + 0.05) : (bg.min + 0.05) / (c.L + 0.05), th, { col: t.col, light });
    }), TH.text);
  }
  if (!texts.length) out.cap = G("n/a", { note: "no text recorded" });
  else if (!m) out.cap = noMap("cap");
  else {
    const F = CAP[phone ? "p" : "d"];
    out.cap = sum(texts.map((t) => {
      const th = F[t.role];
      if (th == null) return bad(t.s, null, "unknown role " + t.role);
      if (t.role === "body") return fin(t.px) && t.px > 0 ? item(t.s, t.px * m.sy, th, { role: t.role, unit: "font px", tol: TOL }) : bad(t.s, th, "body text without a finite o.px");
      return fin(t.capH) ? item(t.s, t.capH * m.sy, th, { role: t.role, tol: TOL }) : bad(t.s, th, "a null or non-finite cap height");
    }), null);
  }
  const outside = (x, y, w, h) => !fin(x, y, w, h) || x < -0.5 || y < -0.5 || x + w > box.w + 0.5 || y + h > box.h + 0.5;
  const count = (list, T, label) => {
    const o = list.filter((r) => outside(...T(r)));
    return G(o.length ? "fail" : "pass", { value: o.length, threshold: 0, on: o.length ? label(o[0]) : null, items: o.map((r) => ({ on: label(r), status: "fail" })) });
  };
  if (!texts.length) out.inside = G("n/a", { threshold: 0, note: "no text recorded" });
  else if (!box || boxBad) out.inside = noMap("inside");
  else out.inside = count(texts, (t) => [t.x, t.y, t.w, t.capH], (t) => t.s);
  const plates = rects.filter((r) => r.plate != null && r.plate !== false);
  if (!plates.length) out.plate = G("n/a", { threshold: 0, note: "no plate declared" });
  else if (!box || boxBad) out.plate = noMap("plate");
  else if (!m && plates.some((r) => typeof r.plate !== "number")) out.plate = noMap("plate");
  else out.plate = count(plates, (r) => {
    const tx = typeof r.plate === "number" ? r.plate : PLATE_T[phone ? "p" : "d"] / m.sx, ty = typeof r.plate === "number" ? r.plate : PLATE_T[phone ? "p" : "d"] / m.sy;
    return [r.x - tx, r.y - ty, r.w + 2 * tx, r.h + 2 * ty];
  }, (r) => r.name);
  const fills = rects.filter((r) => r.fill != null);
  if (!fills.length) out.yellow = G("n/a", { threshold: TH.yellow, note: "no fill declared" });
  else {
    const badFill = fills.find((r) => colOf(r.fill).err || !okRect(r));
    if (badFill) out.yellow = G("fail", { threshold: TH.yellow, on: badFill.name, note: colOf(badFill.fill).err || "a null or non-finite coordinate" });
    else {
      const y = [...new Map(fills.filter((r) => colOf(r.fill).rgb.every((v, i) => v === YEL[i])).map((r) => [[r.name, r.x, r.y, r.w, r.h].join("|"), r])).values()];
      out.yellow = G(y.length <= FLOOR.yellow ? "pass" : "fail", { value: y.length, threshold: FLOOR.yellow, on: y.map((r) => r.name).join(", ") || null, items: y.map((r) => ({ on: r.name, x: r.x, y: r.y, w: r.w, h: r.h, status: "counted" })) });
    }
  }
  const tg = rects.filter((r) => r.touch);
  if (!phone) { out.touch = G("n/a", { threshold: TH.touch, note: "desktop capture" }); out.gap = G("n/a", { threshold: TH.gap, note: "desktop capture" }); }
  else if (!tg.length) { out.touch = G("skipped", { threshold: TH.touch, note: "no touch target declared" }); out.gap = G("skipped", { threshold: TH.gap, note: "no touch target declared" }); }
  else if (!m) { out.touch = noMap("touch"); out.gap = noMap("gap"); }
  else {
    const C = tg.map((r) => ({ r, c: okRect(r) ? m.css(r) : null }));
    out.touch = sum(C.map(({ r, c }) => (c ? item(r.name, Math.min(c.w, c.h), FLOOR.touch, { w: r2(c.w), h: r2(c.h) }) : bad(r.name, FLOOR.touch, "a null or non-finite coordinate"))), TH.touch);
    const items = [];
    let exempt = 0;
    for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
      const A = C[i], B = C[j], on = A.r.name + " / " + B.r.name;
      if (A.r.set != null && B.r.set != null && A.r.set !== B.r.set) continue;
      if (A.r.set != null && A.r.set === B.r.set && A.r.kind && A.r.kind === B.r.kind && EXEMPT.test(A.r.kind)) { exempt++; continue; }
      if (!A.c || !B.c) { items.push(bad(on, FLOOR.gap, "a null or non-finite coordinate")); continue; }
      const a = A.c, b = B.c, inA = b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h, inB = a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
      if (inA || inB) { exempt++; continue; }
      const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)), dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
      items.push(item(on, dx === 0 && dy === 0 ? 0 : Math.max(dx, dy), FLOOR.gap, { set: A.r.set ?? B.r.set ?? null }));
    }
    out.gap = C.length < 2 ? G("skipped", { threshold: TH.gap, note: "fewer than two touch targets" })
      : items.length ? sum(items, TH.gap) : G("pass", { threshold: TH.gap, note: "every pair of targets is exempt (one set, one kind list|tab|bank|step) or nested: " + exempt });
  }
  for (const g of need) if (out[g] && out[g].status === "n/a") out[g] = { ...out[g], status: "skipped", note: "required, not declared (" + out[g].note + ")" };
  return out;
}

/* counts over [{gates}] and the exit code: 1 on a fail, on no capture at all, and (strict) on a skip; n/a never fails */
export function tally(caps) {
  const t = { captures: caps.length, pass: 0, fail: 0, skipped: 0, na: 0 };
  for (const c of caps) for (const g of Object.values(c.gates || {})) t[g.status === "n/a" ? "na" : g.status]++;
  t.exit = (strict) => (t.fail > 0 || t.captures === 0 || (strict && t.skipped > 0) ? 1 : 0);
  return t;
}
