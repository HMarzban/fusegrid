/* GAME OVER (UI upgrade v202 Task 5.4; design record §4 end screens, appendix 10.1, 10.5, 10.6; the round 7 E7-end frames d/p-12-gameover*). Lazy
   (R20: pages/lazy.js "endlose"; drawOverlay paints a LOADING plate until it lands). Its own mood, never WIN's: a cool grey veil over the board in all
   three looks (R18), a narrow left-weighted plate (desk: the burnt-out bomb in a 200 column, the facts in 400; a touch box: one column, the bomb beside
   the headline), the engraved (sunk) headline, "Reached level n of m." (m the run's finale level), the course (cleared bricks, the level fallen on
   cracked, wells ahead, locked walls past the cap), the score saved (score × difficulty, the multiplier named), then one line: the shortfall against
   the persisted best of the same bucket, saved to saved, or a quiet plaque when a record was saved (NEW BEST · bucket, or FURTHEST LEVEL YET), or the
   day's own line on a DAILY; nothing on a first run scoring 0. TRY AGAIN is the one yellow, with its board line (New board · level 1, or Same board
   on a DAILY / code run); MENU, COPY RESULT, COPY MAP under it, label first, keycap last. No ribbon, shelf, cross, confetti or coral headline.
   Motion (appendix 10.6, 1.4 s, downward, no overshoot): the veil deepens, the plate fades in, the headline settles, the spark gutters out, the crack
   draws, the smoke starts (a loop), TRY AGAIN takes focus; REDUCE FLASH or prefers-reduced-motion: the end state, one static puff, one 200 ms fade.
   At rest one cache layer; live: the smoke, the focus (bare bomb + ring) and the toast. Under the kit probe it records as "lose". */
import {worldTokens, CONST, rgba, toL} from "../kit/tokens.js";
import {plate, key} from "../kit/paint.js";
import {DEV, textScale} from "../kit/type.js";
import {endFacts, endGeom, scoreSplit, MOTION} from "./endgeom.js";
import {capsOf, pager, text, textW, fitOf, wrap, keyPart, focusKey, course, rrect, rpair, frame, live, prefersReduced, ease, toastTag, CAP_K} from "./endkit.js";

const OL = CONST.ol, CHAR = "#15181f", CHAR2 = "#07080b", STUB = "#3a302c", STUB2 = "#1a1614";
export const VEIL = Object.freeze({col: toL("#7f8794", 0.01), a0: 0.45, a: 0.65});
const dr = (G, r) => ({x: (r.x - G.plate.x) / G.u, y: (r.y - G.plate.y) / G.u, w: r.w / G.u, h: r.h / G.u});

/* the burnt-out bomb (appendix 10.5): the game bomb shape tipped 12 degrees onto its contact point, charred, cracked with cold lit edges, its cross
   dulled and sooted, a burnt stub of cord (no spark, no orange), a soot ring with the one soft edge (a radial gradient, never a filter), ash flecks.
   R the radius; cx, base the contact point. The tip of the stub is returned (the smoke rises from it). */
export function burnt(c, cx, base, R) {
  const cy = base - R * 1.0, by = cy + R * 0.08, u = R / 12;
  if (c) {
    const g = typeof c.createRadialGradient === "function" ? c.createRadialGradient(cx, base, 0, cx, base, R * 1.3) : null;
    if (g && typeof g.addColorStop === "function") {
      g.addColorStop(0, rgba(CHAR, 0.6)); g.addColorStop(0.75, rgba(CHAR, 0.35)); g.addColorStop(1, rgba(CHAR, 0));
      c.save(); c.translate(cx, base); c.scale(1, 0.22); c.translate(-cx, -base); c.fillStyle = g; c.beginPath(); c.arc(cx, base, R * 1.3, 0, 7); c.fill(); c.restore();
    }
    c.fillStyle = rgba("#8f8476", 0.55);
    for (const [dx, dy, s] of [[-1.15, -0.03, 0.07], [-0.95, 0.12, 0.05], [1.05, 0.08, 0.06], [1.22, -0.05, 0.045], [0.7, 0.2, 0.05], [-0.55, 0.22, 0.04], [0.3, 0.24, 0.035]]) { c.beginPath(); c.arc(cx + dx * R, base + dy * R, s * R, 0, 7); c.fill(); }
    c.save(); c.translate(cx, base); c.rotate(-0.21); c.translate(-cx, -base);
    c.fillStyle = CHAR; c.beginPath(); c.arc(cx, by, R, 0, 7); c.fill();
    c.save(); c.beginPath(); c.arc(cx, by, R - 1, 0, 7); c.clip();
    c.fillStyle = CHAR2;
    const blob = (pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(cx + x * R, by + y * R) : c.moveTo(cx + x * R, by + y * R))); c.closePath(); c.fill(); };
    blob([[0.25, 0.15], [0.62, -0.05], [1.05, 0.05], [1.05, 1.05], [0.15, 1.05], [-0.1, 0.72], [0.18, 0.52]]);
    blob([[-1.05, -0.25], [-0.7, -0.38], [-0.55, -0.12], [-0.8, 0.1], [-1.05, 0.2]]);
    blob([[-0.15, -1.05], [0.35, -1.05], [0.42, -0.72], [0.12, -0.6], [-0.08, -0.78]]);
    const crack = (pts, w) => {
      const P = pts.map(([x, y]) => [cx + x * R, by + y * R]);
      c.lineJoin = "miter"; c.lineCap = "round";
      c.strokeStyle = rgba(CONST.t2, 0.34); c.lineWidth = Math.max(1, 0.7 * u); c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x - 0.9 * u, y - 0.9 * u) : c.moveTo(x - 0.9 * u, y - 0.9 * u))); c.stroke();
      c.strokeStyle = "#030305"; c.lineWidth = w * u; c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    };
    crack([[1.0, -0.15], [0.62, -0.05], [0.5, 0.2], [0.22, 0.28], [0.1, 0.55]], 1.5);
    crack([[0.5, 0.2], [0.62, 0.5]], 1.0);
    crack([[-0.98, 0.35], [-0.7, 0.42], [-0.55, 0.7], [-0.3, 0.78]], 1.2);
    c.restore();
    c.strokeStyle = "#0a0d14"; c.lineWidth = Math.max(2, 1.75 * u); c.beginPath(); c.arc(cx, by, R, 0, 7); c.stroke();
    c.strokeStyle = rgba(CONST.t2, 0.22); c.lineWidth = Math.max(1.5, 0.9 * u); c.beginPath(); c.arc(cx, by, R - c.lineWidth, Math.PI * 1.02, Math.PI * 1.55); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.25)"; c.beginPath(); c.arc(cx - R * 0.3, cy - R * 0.18, R * 0.24, 0, 7); c.fill();
    c.strokeStyle = "rgba(236,228,218,0.82)"; c.lineWidth = 2.2 * u; c.lineCap = "butt"; c.beginPath();
    c.moveTo(cx - R * 0.28, by); c.lineTo(cx + R * 0.28, by); c.moveTo(cx, cy - R * 0.2); c.lineTo(cx, cy + R * 0.36); c.stroke();
    c.fillStyle = "rgba(7,8,11,0.78)"; c.beginPath(); c.ellipse(cx + R * 0.25, by + R * 0.12, R * 0.17, R * 0.13, 0.4, 0, 7); c.fill();
  }
  const P0 = [cx + R * 0.22, cy - R * 0.62], P1 = [cx + R * 0.48, cy - R * 0.95], P2 = [cx + R * 0.58, cy - R * 1.22];
  const B = (t) => [0, 1].map((i) => (1 - t) ** 2 * P0[i] + 2 * (1 - t) * t * P1[i] + t * t * P2[i]), tp = B(0.3);
  if (c) {
    const seg = (t0, t1, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.beginPath(); for (let i = 0; i <= 12; i++) { const p = B(t0 + ((t1 - t0) * i) / 12); i ? c.lineTo(...p) : c.moveTo(...p); } c.stroke(); };
    seg(0, 0.3, OL, 2.6 * u + 3); seg(0, 0.3, STUB, 2.6 * u); seg(0.14, 0.3, STUB2, 2.6 * u);
    c.strokeStyle = STUB2; c.lineWidth = 0.9 * u; c.lineCap = "round";
    for (const [dx, dy] of [[0.13, -0.12], [0.02, -0.17], [0.16, -0.02]]) { c.beginPath(); c.moveTo(...tp); c.lineTo(tp[0] + dx * R, tp[1] + dy * R); c.stroke(); }
    c.fillStyle = rgba("#8f8476", 0.8); c.beginPath(); c.arc(tp[0] + 0.02 * R, tp[1] - 0.02 * R, 0.07 * R, 0, 7); c.fill();
    c.restore();
  }
  const a = -0.21, dx = tp[0] - cx, dy = tp[1] - base;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), base + dx * Math.sin(a) + dy * Math.cos(a)];
}
/* the smoke (live): two wisps straight up from the stub and three puffs drifting up-left, t2 at .18 down to 0; t seconds since the loop began
   (each puff rises 3 L over 3.2 s, a new one every 1.1 s); reduced: one static puff at .12 */
export function smoke(c, tip, R, L, t, reduced) {
  if (!c) return;
  if (reduced) { c.fillStyle = rgba(CONST.t2, 0.12); c.beginPath(); c.arc(tip[0] - 0.62 * R, tip[1] - 0.92 * R, 0.55 * L, 0, 7); c.fill(); return; }
  c.lineCap = "round";
  for (const [w, al, k] of [[0.32, 0.3, 1], [0.22, 0.22, -1]]) {
    c.strokeStyle = rgba(CONST.t2, al); c.lineWidth = w * L; c.beginPath(); c.moveTo(tip[0], tip[1] - 0.06 * R);
    c.bezierCurveTo(tip[0] + 0.16 * R * k, tip[1] - 0.3 * R, tip[0] - 0.2 * R * k, tip[1] - 0.45 * R, tip[0] - 0.02 * R, tip[1] - 0.7 * R); c.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const age = (t + i * 1.1) % 3.3, f = age / 3.2;
    if (f > 1) continue;
    c.fillStyle = rgba(CONST.t2, 0.18 * (1 - f)); c.beginPath(); c.arc(tip[0] - f * 0.9 * R, tip[1] - 0.3 * R - f * 3 * L, ((0.8 + f * 0.7) * L) / 2, 0, 7); c.fill();
  }
}
/* the sunk headline: the display face with no outline and no drop, a dark band in the top of its glyphs and a slightly darker foot (engraved) */
function sunk(p, s, x, y, px) {
  const w = text(p, "display", s, x, y, px, {});
  const c = p.c, K = textScale(), capH = px * K * CAP_K;
  if (c) {
    const band = (y0, h, col) => { c.save(); c.beginPath(); c.rect(x - 4, y0, w + 8, h); c.clip(); c.fillStyle = col; c.fillText(s, x, y); c.restore(); };
    band(y - capH / 2 - 2, capH * 0.2, STUB); band(y - capH / 2 - 2 + capH * 0.2, capH * 0.04, "#7a6e66"); band(y + capH * 0.26, capH * 0.3, "#e2d0b9");
  }
  return w;
}
const CHECK = (c, x, y, s, col) => { c.strokeStyle = col; c.lineWidth = s * 0.17; c.lineCap = c.lineJoin = "round"; c.beginPath(); c.moveTo(x + s * 0.18, y + s * 0.53); c.lineTo(x + s * 0.38, y + s * 0.72); c.lineTo(x + s * 0.82, y + s * 0.26); c.stroke(); };
/* the salvaged plaque: a small wall-texture note 2.6 L tall, the check and the words on a dark inset chip; no tails, medal or brick */
function plaque(p, x, y, w, words, L, o) {
  const d = DEV[o.phone ? "p" : "d"], h = 2.6 * L + 4, s = fitOf(p, "label", words, d.pri, w - 60), tw = textW(p, "label", s, d.pri) + 16 + 28, W = Math.min(w, tw + 10);
  if (p.c) {
    key(p.c, x, y, W, h, "wall", {tok: o.tok});
    p.c.fillStyle = "rgba(11,6,9,0.88)"; p.c.fillRect(x + 5, y + 5, W - 10, h - 10);
    CHECK(p.c, x + 14, y + h / 2 - 8, 16, CONST.ink);
  }
  rrect(p, "plaque", x, y, W, h);
  text(p, "label", s, x + 38, y + h / 2, d.pri, {});
}

function scene(p, F, G, tok, caps, A) {
  const ph = G.ph, D = G.d, L = D.L, has = (n) => !!G.rects[n], R = (n) => dr(G, G.rects[n]), pw = G.plate.w / G.u, phh = G.plate.h / G.u, c = p.c, dd = DEV[ph ? "p" : "d"];
  if (c) plate(c, 0, 0, pw, phh, tok, {phone: ph});
  const first = Object.keys(G.rects).find((n) => !["pager", "try", "foot", "bomb"].includes(n)) || "try", col = R(first), x0 = col.x, rw = col.w, a = (t0, dur) => (A ? ease((A.t - t0) / dur) : 1);
  const BR = G.two ? 4.5 * L : 2.5 * L;
  if (has("kick")) { const k = R("kick"); text(p, "label", fitOf(p, "label", F.kick, dd.sec, rw), x0, k.y + k.h / 2, dd.sec, {col: CONST.t2, role: "secondary"}); }
  if (has("head")) {
    const hd = R("head"), hpx0 = D.hLose;
    if (!G.two) {
      burnt(c, x0 + BR + 2, hd.y + hd.h - 2, BR);
      const hx = x0 + 2 * BR + 14, room = rw - (hx - x0), hpx = Math.min(hpx0, (hpx0 * room) / textW(p, "display", F.head, hpx0));
      sunk(p, F.head, hx, hd.y + hd.h / 2 - 0.25 * hpx * (1 - a(0.2, 0.3)), hpx);
    } else {
      const hpx = Math.min(hpx0, (hpx0 * rw) / textW(p, "display", F.head, hpx0));
      sunk(p, F.head, x0, hd.y + hd.h / 2 - 0.25 * hpx * (1 - a(0.2, 0.3)), hpx);
    }
  }
  if (G.two && has("bomb") && G.page === 0) { const bb = R("bomb"); burnt(c, bb.x + bb.w / 2 - BR * 0.05, bb.y + Math.min(bb.h, 3.2 * BR), BR); }
  if (has("reached")) { const rc = R("reached"), px0 = (1.3 * L) / 0.72, w0 = textW(p, "label", F.reached, px0); text(p, "label", F.reached, x0, rc.y + rc.h / 2, w0 <= rw ? px0 : Math.max(dd.pri, (px0 * rw) / w0), {}); } // a narrow column sets it smaller, never under the primary size
  if (has("course")) {
    const co = R("course"), cs = G.cell, gap = ph ? 3 : 6, cells = F.course.map((q) => (q.st === "crack" && A && A.t < 0.8 ? {...q, st: "clear"} : q));
    course(p, x0, co.y + 2, cs, gap, cells, {tok, phone: ph});
    const at = (st) => F.course.findIndex((q) => q.st === st), cl = (i) => [x0 + i * (cs + gap), co.y + 2, cs, cs];
    if (at("clear") >= 0 && at("ahead") >= 0) rpair(p, "chosen", cl(at("clear")), cl(at("ahead")), {name: "cleared vs not reached"});
    if (at("crack") >= 0 && at("ahead") >= 0) rpair(p, "chosen", cl(at("crack")), cl(at("ahead")), {name: "cracked vs not reached"});
    const lit = at("clear") >= 0 ? at("clear") : at("crack"); // a lit brick: a cleared level, or the one fallen on (a death on level 1)
    const top = (i) => [x0 + i * (cs + gap) + 3, co.y, cs - 6, cs * 0.45], plain = (i) => [x0 + i * (cs + gap) + cs * 0.15, co.y + 2 + cs * 0.6, cs * 0.2, cs * 0.25]; // a lit brick's lit top; a well's plain lower-left (its number mid, its flag right)
    if (at("locked") >= 0 && lit >= 0) rpair(p, "locked", cl(at("locked")), top(lit), {name: "locked level", floor: plain(at("ahead") >= 0 ? at("ahead") : at("locked"))});
  }
  if (has("score")) {
    const sc = R("score"), spx = (1.6 * L) / 0.72, ts = textScale(), split = scoreSplit(F, D, rw, p.m), h1 = spx * ts * 1.15, sy = sc.y + h1 / 2;
    const lw = text(p, "label", F.scoreLine.label, x0, sy, dd.pri, {col: CONST.t2}), vw = text(p, "num", F.scoreLine.value, x0 + lw + 12, sy, spx, {role: "hud"});
    /* the multiplier named whole (×2 HARD DIFFICULTY): beside the score, or on a line of its own where the column is narrow (endgeom scoreSplit) */
    if (!split) text(p, "label", F.scoreLine.mult, x0 + lw + vw + 24, sy + 2, dd.sec, {col: CONST.t2, role: "secondary"});
    else text(p, "label", F.scoreLine.mult, x0, sc.y + h1 + 2 + (dd.sec * ts * 1.25) / 2, dd.sec, {col: CONST.t2, role: "secondary"});
  }
  if (has("tail")) {
    const tl = R("tail");
    if (F.tail.kind === "plaque") plaque(p, x0, tl.y, rw, F.tail.text, L, {tok, phone: ph});
    else {
      const px = dd.bod, lines = wrap(p, "body", F.tail.text, px, rw - 8), lh = tl.h / Math.max(1, lines.length);
      lines.forEach((ln, i) => {
        const y = tl.y + lh * (i + 0.5);
        if (i === 0 && F.tail.lead && ln.startsWith(F.tail.lead)) {
          const bw = text(p, "label", F.tail.lead, x0, y, px, {role: "body"});
          text(p, "body", ln.slice(F.tail.lead.length), x0 + bw, y, px, {role: "body", col: CONST.t2});
        } else text(p, "body", ln, x0, y, px, {role: "body", col: CONST.t2});
      });
    }
  }
  pager(p, G, tok);
  const K = (n) => dr(G, G.keys[n]);
  keyPart(p, "main", K("main"), "main", "TRY AGAIN", {tok, phone: ph, cap: caps.main, big: true, sub: F.keys.sub, center: ph});
  keyPart(p, "menu", K("menu"), "key", "MENU", {tok, phone: ph, cap: caps.menu, center: !caps.menu});
  keyPart(p, "copy", K("copy"), "key", "COPY RESULT", {tok, phone: ph, cap: caps.copy, center: !caps.copy});
  keyPart(p, "map", K("map"), "key", "COPY MAP", {tok, phone: ph, cap: caps.map, center: !caps.map});
}

/** Paints GAME OVER over the board: c drawOverlay's context, B its box {w, h}; run / tm / toast as drawOverlay hands them. */
export function drawLose(c, B, world, run, tm, toast) {
  const r = run || {}, F = endFacts(world, run, tm), G = endGeom(B, F, {lay: r.lay, css: r.css, page: r.page, m: typeof c.measureText === "function" ? c : null});
  if (!G) return;
  const tok = worldTokens(world.level | 0 || 1), touch = r.lay === "p" || r.lay === "l", caps = capsOf(touch), reduced = !!r.reduced || prefersReduced();
  const t = run && Number.isFinite(r.et) ? r.et : 9, anim = !reduced && t < MOTION.lose, A = anim ? {t} : null, ph = G.ph, L = G.d.L;
  c.save(); c.fillStyle = rgba(VEIL.col, anim ? VEIL.a0 + (VEIL.a - VEIL.a0) * ease(t / 0.5) : VEIL.a); c.fillRect(0, 0, B.w, B.h); c.restore();
  if (typeof c.rect !== "function" || typeof c.clip !== "function") return; // a context with no clip or rect (the headless renderer's): the veil only
  const key = JSON.stringify([F, G.plate, G.u, G.page, caps]);
  frame(c, "lose", B, G, tok, anim ? {anim: true, A, key, alpha: ease(t / 0.3)} : {alpha: reduced ? Math.min(1, t / 0.2) : 1, key}, (p, a) => scene(p, F, G, tok, caps, a));
  live(c, G, (p) => {
    const BR = G.two ? 4.5 * L : 2.5 * L, bb = G.two && G.page === 0 ? dr(G, G.rects.bomb) : null, hd = G.rects.head ? dr(G, G.rects.head) : null, kk = G.rects.kick ? dr(G, G.rects.kick) : null;
    const tip = bb ? burnt(null, bb.x + bb.w / 2 - BR * 0.05, bb.y + Math.min(bb.h, 3.2 * BR), BR) : !G.two && hd && kk ? burnt(null, kk.x + BR + 2, hd.y + hd.h - 2, BR) : null;
    if (tip && A && A.t >= 0.3 && A.t < 0.8) { const g = A.t - 0.3, on = g < 0.08 || (g >= 0.2 && g < 0.26) || (g >= 0.46 && g < 0.5); if (on && p.c) { p.c.fillStyle = CONST.cord; p.c.beginPath(); p.c.arc(tip[0], tip[1], 0.12 * BR, 0, 7); p.c.fill(); } }
    if (tip && (!A || A.t >= 1.1) && p.c) {
      const top = kk ? kk.y + kk.h : 0;
      p.c.save(); p.c.beginPath(); p.c.rect(0, top, G.plate.w / G.u, G.plate.h / G.u - top); p.c.clip(); // the smoke stays under the kicker line
      smoke(p.c, tip, BR, L, A ? A.t - 1.1 : t - 1.1, reduced);
      p.c.restore();
    }
    const m = dr(G, G.keys.main);
    if (!A || A.t >= 1.4) {
      const rest = dr(G, G.keys.menu);
      focusKey(p, m, {tok, phone: ph, rest: [rest.x - 6, rest.y - 6, Math.min(rest.w, m.w) + 12, m.h + 12], bed: ph ? [m.x + m.w * 0.3, m.y - 14, m.w * 0.4, 7] : [m.x - 16, m.y + 4, 8, m.h - 8]});
    }
    toastTag(p, G.plate.w / G.u / 2, 4, toast, {tok, phone: ph, reduced});
  });
}
