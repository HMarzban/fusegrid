/* WIN (UI upgrade v202 Task 5.3; design record §4 end screens, appendix 10.1-10.4; the round 7 E7-end frames d/p-11-win*). Lazy (R20: pages/lazy.js
   "endwin"; drawOverlay paints a LOADING plate until it lands). Two modes of one page, over the board on #c:
   clear (a mid-run WIN): the kicker LEVEL n · WORLD, the raised headline LEVEL n CLEAR, three stat cards (TIME, ENEMIES, POWER-UPS of this level), at
     most one ribbon (the level time the times store kept at the WIN edge), NEXT LEVEL.
   fin (FUSE/GRID CLEAR): the kicker with the run's difficulty (and its other rules, stepped down to fit), the headline over a static blast cross and
     a warm core, the saved score (score × difficulty) on the world's bricks with the multiplier named, the course with check notches (6-8 stay
     locked until a finale opens them: endRun saves it on the run-end edge, and that finale says LEVELS 6 TO 8 NOW OPEN under the course), the run's ENEMIES / POWER-UPS / TIME, the shelf (a score record, a time record, the medals newly
     saved; a fourth and later fold into +N MORE), MENU as the main key and COPY RESULT / COPY MAP.
   Every claim comes from endFacts (isRunEnd and the run-start best). The world of the level played dresses it. The motion beats run on run.et
   (appendix 10.4: plate in, headline drop, digits flip, cells pop, pieces swing, focus at 1.5 s); REDUCE FLASH or prefers-reduced-motion: the end
   state with one 200 ms fade. At rest one cache layer; live: the focus (bare bomb + ring) and the toast. Under the kit probe it records as "win". */
import {END_WORDS as EW, MENU} from "../words.js";
import {worldTokens, CONST, rgba} from "../kit/tokens.js";
import {plate, key} from "../kit/paint.js";
import {DEV, textScale} from "../kit/type.js";
import {endPlan, pieceWidth, pieceName, MOTION} from "./endgeom.js";
import {capsOf, pager, wrap, scaledPen, text, textW, fitOf, keyPart, focusKey, statTile, ledger, course, shelf, ribbon, medal, pieceW, rrect, rpair, frame, live, prefersReduced, ease, toastTag, WARM} from "./endkit.js";

const OL = CONST.ol;
const dr = (G, r) => ({x: (r.x - G.plate.x) / G.u, y: (r.y - G.plate.y) / G.u, w: r.w / G.u, h: r.h / G.u});
export {capsOf};
/* the beat state at t seconds (appendix 10.4) */
export function beats(t) {
  const back = (x) => { const s = 1.70158 * 0.6; x = Math.max(0, Math.min(1, x)) - 1; return x * x * ((s + 1) * x + s) + 1; };
  return {t, plate: 0.96 + 0.04 * ease(t / 0.16), head: t < 0.12 ? null : back((t - 0.12) / 0.2), digit: (i) => Math.max(0, Math.min(1, (t - 0.3 - 0.06 * i) / 0.12)),
    cell: (i) => Math.max(0, Math.min(1, (t - 0.6 - 0.05 * i) / 0.12)), swing: t < 1 ? -8 : t < 1.25 ? -8 + 12 * ease((t - 1) / 0.25) : 4 - 4 * ease((t - 1.25) / 0.25), focus: t >= 1.5};
}
const scaled = (c, cx, cy, sx, sy, f) => { if (!c || (sx === 1 && sy === 1)) return f(); c.save(); c.translate(cx, cy); c.scale(sx, sy); c.translate(-cx, -cy); f(); c.restore(); };

function blast(c, cx, cy, L, fin) {
  const band = (x, y, w, h, vert) => {
    const g = vert ? c.createLinearGradient(x, y, x, y + h) : c.createLinearGradient(x, y, x + w, y);
    if (!g || typeof g.addColorStop !== "function") return; // a context with no gradients (the headless renderer's)
    g.addColorStop(0, rgba(WARM, 0)); g.addColorStop(vert ? 0.22 : 0.09, rgba(WARM, 0.08)); g.addColorStop(vert ? 0.72 : 0.91, rgba(WARM, 0.08)); g.addColorStop(1, rgba(WARM, 0));
    c.fillStyle = g; c.fillRect(x, y, w, h);
  };
  const [hw, hh, vw, vh, vt] = fin ? [54, 6.2, 6.2, 13, -8] : [30, 4.6, 4.6, 8.5, -5];
  band(cx - (hw * L) / 2, cy - (hh * L) / 2, hw * L, hh * L, false);
  band(cx - (vw * L) / 2, cy + vt * L, vw * L, vh * L, true);
  if (fin) {
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, 13 * L);
    if (!g || typeof g.addColorStop !== "function") return;
    g.addColorStop(0, rgba(WARM, 0.1)); g.addColorStop(1, rgba(WARM, 0));
    c.save(); c.translate(cx, cy); c.scale(1, 9 / 26); c.translate(-cx, -cy); c.fillStyle = g; c.fillRect(cx - 13 * L, cy - 13 * L, 26 * L, 26 * L); c.restore();
  }
}

/* the score digits on the world's bricks: one lit brick cell per digit (3.4 L tall, 2.6 L on a phone), the separators in a narrow well */
function digits(p, s, cx, y, L, tok, A, ph) {
  const h = (ph ? 2.6 : 3.4) * L, w = h * 0.74, sw = h * 0.36, gap = ph ? 3 : 6, ch = [...s], tw = ch.reduce((a, q) => a + (q === "," ? sw : w), 0) + (ch.length - 1) * gap, px = h * 0.62;
  let x = cx - tw / 2, i = 0;
  for (const q of ch) {
    const cw = q === "," ? sw : w, f = A ? A.digit(i) : 1;
    if (f > 0) scaled(p.c, x + cw / 2, y + h / 2, 1, f, () => {
      if (p.c) key(p.c, x, y, cw, h, q === "," ? "well" : "lit", {tok});
      text(p, "num", q, x + cw / 2, y + h / 2 - (q === "," ? 0 : 2), px, {align: "center", col: q === "," ? CONST.t2 : CONST.dk, role: "hud"});
    });
    if (q !== ",") i++;
    x += cw + gap;
  }
  rrect(p, "score", cx - tw / 2, y, tw, h);
  return tw;
}

function scene(p, F, G, tok, caps, A) {
  const ph = G.ph, D = G.d, L = D.L, has = (n) => !!G.rects[n], R = (n) => dr(G, G.rects[n]), pw = G.plate.w / G.u, phh = G.plate.h / G.u, c = p.c, ts = textScale(), dd = DEV[ph ? "p" : "d"];
  if (c) plate(c, 0, 0, pw, phh, tok, {phone: ph});
  const col = R(Object.keys(G.rects).find((n) => n !== "pager" && n !== "keys") || "keys"), inner = col.w, cx = col.x + col.w / 2;
  if (has("band")) {
    const band = R("band"), kpx = D.sec, hpx0 = F.mode === "fin" ? D.hFin : D.hClear, head = F.head, hpx = textW(p, "display", head, hpx0) <= inner ? hpx0 : (hpx0 * inner) / textW(p, "display", head, hpx0);
    const ky = band.y + (kpx * ts * 1.25) / 2, hy = band.y + band.h - (hpx * ts * 1.08) / 2;
    if (c) blast(c, cx, hy + hpx * 0.1, L, F.mode === "fin" && !ph);
    text(p, "label", fitOf(p, "label", F.kick, kpx, inner), cx, ky, kpx, {align: "center", col: CONST.t2, role: "secondary"});
    if (!A || A.head != null) text(p, "display", head, cx, hy + (A ? -0.5 * hpx * (1 - A.head) : 0), hpx, {align: "center", outline: true});
  }
  let dw = 0;
  if (has("score")) {
    const s = R("score"), dh = (ph ? 2.6 : 3.4) * L;
    dw = digits(p, F.score.digits, cx, s.y, L, tok, A, ph);
    let sy = s.y + dh + (ph ? 0.6 : 0.8) * L + (dd.sec * ts * 1.25) / 2;
    text(p, "label", fitOf(p, "label", F.score.subs, dd.sec, inner), cx, sy, dd.sec, {align: "center", col: CONST.t2, role: "secondary"});
    if (F.note) for (const ln of wrap(p, "label", F.note, dd.sec, inner)) text(p, "label", ln, cx, (sy += dd.sec * ts * 1.25 + (sy === s.y ? 6 : 0)), dd.sec, {align: "center", col: CONST.t2, role: "secondary"});
  }
  if (has("course")) {
    const co = R("course"), cs = G.cell, gap = ph ? 3 : 6, cw = F.course.length * cs + (F.course.length - 1) * gap, x0 = cx - cw / 2;
    F.course.forEach((cl, i) => {
      const f = A ? A.cell(i) : 1;
      if (f > 0) scaled(c, x0 + i * (cs + gap) + cs / 2, co.y + 2 + cs / 2, 0.6 + 0.4 * f, 0.6 + 0.4 * f, () => course(p, x0 + i * (cs + gap), co.y + 2, cs, gap, [cl], {tok, phone: ph}));
    });
    const won = F.course.findIndex((q) => q.st === "won"), other = F.course.findIndex((q) => q.st === "ahead" || q.st === "locked");
    if (won >= 0 && other >= 0) rpair(p, "chosen", [x0 + won * (cs + gap), co.y + 2, cs, cs], [x0 + other * (cs + gap), co.y + 2, cs, cs], {name: "won vs " + F.course[other].st});
    if (F.opened) { let oy = co.y + 2 + cs + 6; const lh = D.sec * ts * 1.25; for (const ln of wrap(p, "label", F.opened, D.sec, inner)) { text(p, "label", ln, cx, oy + lh / 2, D.sec, {align: "center", col: CONST.ink, role: "secondary"}); oy += lh; } }
    const lk = F.course.findIndex((q) => q.st === "locked");
    const sr = G.rects.score ? R("score") : null; // a plain floor: the bed at the score row's left end (beside the digits, never under them)
    if (lk >= 0 && won >= 0) rpair(p, "locked", [x0 + lk * (cs + gap), co.y + 2, cs, cs], [x0 + won * (cs + gap) + 2, co.y + 2, cs * 0.5, cs * 0.5], {name: "locked level", floor: sr && dw ? [sr.x + 2, sr.y + 2, Math.max(6, Math.min(24, (sr.w - dw) / 2 - 8)), 3.4 * L * 0.6] : [x0 - 34, co.y + 2, 28, cs]}); // the won brick's lit top, clear of its notch
  }
  if (has("tally")) {
    const ta = R("tally");
    if (ph) ledger(p, ta, F.stats, {tok});
    else {
      const n = F.stats.length, gw = L, w = Math.min((ta.w - (n - 1) * gw) / n, F.mode === "fin" ? 230 * (ts > 1.1 ? 1.13 : 1) : 1e9), tx = ta.x + (ta.w - (n * w + (n - 1) * gw)) / 2;
      F.stats.forEach((st, i) => statTile(p, "stat " + st[1], {x: tx + i * (w + gw), y: ta.y, w, h: ta.h}, st, {tok, L}));
    }
  }
  for (const [name, ix] of Object.entries(G.shelves || {})) {
    const sh = R(name), gp = (ph ? 0.9 : 1.6) * L, items = ix.map((j) => F.pieces[j]), ws = items.map((q) => pieceWidth(q, L, ph, p.m));
    const tot = ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * gp, barW = F.mode === "fin" ? sh.w : Math.min(sh.w, Math.max(15 * L, tot + 2 * L));
    shelf(p, cx - barW / 2, sh.y, barW, L, {tok});
    const top = sh.y + 0.9 * L + 0.5 * L, rh = (ph ? 15 : 17) + ts * (dd.sec * 1.2 + 3 + dd.pri * 1.2 + 3 + (1.6 * L) / 0.72);
    let x = cx - tot / 2;
    items.forEach((q, i) => {
      const w = ws[i], hx = x + w / 2, ang = A ? A.swing : 0, draw = () => {
        if (q.kind === "medal") medal(p, x, top, w, q, L, {tok, phone: ph});
        else ribbon(p, x, top, w, rh, {...q, name: pieceName(q, L, ph, p.m)}, L, {tok, phone: ph});
      };
      if (c && ang) { c.save(); c.translate(hx, top - 0.6 * L); c.rotate((ang * Math.PI) / 180); c.translate(-hx, -(top - 0.6 * L)); draw(); c.restore(); } else draw();
      x += w + gp;
    });
  }
  pager(p, G, tok);
  const K = G.keys, k = (n) => dr(G, K[n]);
  keyPart(p, "main", k("main"), "main", F.keys.main, {tok, phone: ph, cap: caps.main, big: true});
  if (K.copy) { const ln = G.lines || {}; keyPart(p, "copy", k("copy"), "key", EW.COPY, {tok, phone: ph, cap: caps.copy, center: !caps.copy, lines: ln.copy}); keyPart(p, "map", k("map"), "key", EW.MAP, {tok, phone: ph, cap: caps.map, center: !caps.copy, lines: ln.map}); }
}

/** Paints WIN over the board: c drawOverlay's context, B its box {w, h}; run / tm / toast as drawOverlay hands them. */
export function drawWin(c, B, world, run, tm, toast) {
  const r = run || {}, plan = endPlan(B, world, run, tm, {lay: r.lay, css: r.css, page: r.page, m: typeof c.measureText === "function" ? c : null}), F = plan.F, G = plan.G; // kept per run end (endPlan), not rebuilt each frame
  if (!G) return;
  const tok = worldTokens(world.level | 0 || 1), touch = r.lay === "p" || r.lay === "l", caps = capsOf(touch), reduced = !!r.reduced || prefersReduced();
  const t = run && Number.isFinite(r.et) ? r.et : MOTION.win, anim = !reduced && t < MOTION.win, A = anim ? beats(t) : null, ph = G.ph;
  c.save(); c.fillStyle = rgba(OL, 0.45); c.fillRect(0, 0, B.w, B.h); c.restore();
  if (typeof c.rect !== "function" || typeof c.clip !== "function") return; // a context with no clip or rect (the headless renderer's): the veil only
  const key = plan.sig + JSON.stringify(caps);
  if (anim) {
    const P = G.plate, s = A.plate;
    c.save(); c.translate(P.x + P.w / 2, P.y + P.h / 2); c.scale(s, s); c.translate(-(P.x + P.w / 2), -(P.y + P.h / 2));
    frame(c, "win", B, G, tok, {anim: true, A, key}, (p, a) => scene(p, F, G, tok, caps, a));
    c.restore();
  } else frame(c, "win", B, G, tok, {alpha: reduced ? Math.min(1, t / 0.2) : 1, key}, (p) => scene(p, F, G, tok, caps, null));
  live(c, G, (p) => {
    const m = dr(G, G.keys.main);
    if (!A || A.focus) {
      const rest = G.keys.copy ? dr(G, G.keys.copy) : dr(G, G.rects.tally || G.rects.band || G.rects.shelf), sd = G.d.side;
      focusKey(p, m, {tok, phone: ph, rest: [rest.x - 6, rest.y - 6, Math.min(rest.w, m.w) + 12, m.h + 12], bed: sd >= 20 ? [m.x - sd + 2, m.y, sd - 10, m.h] : [m.x + m.w * 0.3, m.y - 16, m.w * 0.4, 8]});
    }
    toastTag(p, G.plate.w / G.u / 2, 4, toast, {tok, phone: ph, reduced});
  });
}
