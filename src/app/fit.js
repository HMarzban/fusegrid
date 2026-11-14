/* Stage fit for the browser entry (src/main.js). Scales #c, #gl, #px to the
   viewport minus a per-layout reserve and writes body[data-lay], the one
   predicate index.html keys the touch layout off: d desktop (no touch),
   p touch portrait (pad + bomb below the stage), l touch landscape (side
   gutters). Never assigns the #gl / #px drawing buffers (each renderer
   owns its own).
   Touch portrait is width-bound, so the slack is vertical: portraitGeo
   centres the stage in it (clamped to the PORT_GEO split, 60 above for the
   pause pill, 190 below for the controls) and sizes the controls' band at the
   thumb zone at the bottom, grown into the band; stripGeo lays the touch
   strip in it (D-PAD box, BOMB, and the THROW / REMOTE halves above BOMB,
   GAME only, each shown while the player holds the power).
   INTRO / MENU / ATTRACT keep
   that centred stage; while #touchpad shows (GAME only — touch.update flips
   its hidden on the GAME edge) the game geometry puts the stage right under
   the HUD plate (PORT_GAME.top = HUD_RES.p.top) and docks the controls to the
   thumb zone, the band between them for the power-ups bar and the tip. A
   MutationObserver on that one hidden attribute re-fits, and --sd glides the
   lift on that edge only (0s on resize / rotation).
   #px (PIXEL) is snapped on top of that: it switches to content-box sizing
   and its CSS width / height are set so the content box is a whole number of
   device px AND a whole number of 1/64 CSS px (the layout unit; at dpr 3 an
   unrepresentable third came back as 973.97 device px and was resampled),
   then left/top nudge the content origin onto a multiple of pxQuant(dpr)
   device px, which is a whole 1/64 CSS px too (re-run when the portrait
   lift's transition ends; at a fractional dpr #px may sit up to q/2 device
   px off #c, e.g. 10 at dpr 2.625). The snapped backing goes on data-bw /
   data-bh, which the px renderer reads instead of a layout per frame, so the
   browser composites #px 1:1 and never runs a second resample over it.
   fit.setPxCap(c) (GRAPHICS RESOLUTION) re-fits with the backing at
   min(dpr, c) x the same snapped content box: the CSS box, its snapping and
   origin still follow the real dpr, so only the density drops, never the
   board size; at c >= dpr data-bw / data-bh are exactly the snapped values.
   A devicePixelRatio change with no resize (a window dragged between
   monitors) re-fits through a one-shot matchMedia resolution query, re-armed
   at the new ratio.
   Shell box (every layout, UI upgrade Task 1.0): shellGeo gives MENU and
   the plated pages their own logical box on #sh, a fixed overlay canvas over
   the whole viewport. d and l: the window at scale 1 (never under
   WIN_SHELL.min 600 x 520, the classic page box: a narrower page clips its
   text, so the menus stay on #c as before; every landscape phone is under
   it); a landscape tablet is the desktop form with touch pitches. p: the
   menus are width-bound at the board's 600 too, so a 393 px phone shows them
   at ~0.63 in a third of the screen; the scale is the one that fits a
   PORT_SHELL.w-clamped width into the stage's width (~0.9 on a phone, so
   every size grows ~1.4x; a tablet keeps 600 and only grows taller) and the
   box is the viewport at that scale (never under 520 tall, else no shell
   box). logo is the board's own logo line (0.27 of the centred stage) in box
   units, so MENU's logo still sits on the board behind it. The board
   canvases never see it:
   #c / #gl / #px keep the board box and their own fit. #sh's backing is the
   box at device density (q = s x dpr, cap 3 on p, WIN_SHELL.dpr 2 on d and
   l, smoothing off for the PIXEL cells) under a q transform, so its text is
   crisp where #c's is upscaled.
   fit.shell(on) shows #sh, clears it and hands back {ctx, box}; box is the
   logical canvas stand-in ({width, height} = the box, its rect and document)
   that drawShell and the tap map both measure, so a tap lands where it is
   drawn; its css is the box's CSS px per unit (shellGeo s). fit also writes
   #c's CSS px per unit as canvas.css, so a page laid out in CSS px on #c
   (MENU's touch floors) reads the same number for paint and tap and never
   measures a rect per frame: stageCss, the CONTENT box's scale (the stage
   minus #c's border, the tighter axis), so a 44 CSS px target measures 44
   inside the border, never 43.77 (R1 landscape). on 2 (the stage, Task 9.12:
   PAUSE, its views and every WIN / LOSE off p, and p with no over box) lays
   #sh exactly on #c's content box at device density (pxBox / snapOff, the
   #px rule: whole device px, origin on a whole 1/64 CSS px), on every layout
   whether it has a shell box or not, click-through so taps stay #c's, clears
   it every frame and hands back {ctx, box: #c} under a #c-units -> device px
   transform: #c's 600 x 520 backing is upscaled ~2.3x by CSS, so an overlay
   drawn there was soft beside PIXEL's #px and REAL 3D's #gl. fit.box() is
   null while it lasts; a page or the over box puts the shell box back.
   Off (or no shell box) hides #sh and returns null.
   HUD reserves (UI upgrade Task 8.1, round 5 09-hud; CSS px, never board units, so the HUD's type floors hold at any stage
   scale). d: the chip plate above the board (HUD_RES.d.top: 9 air + the plate's 10 px ring + its 74 px box + ring + its 3 px
   drop) and the power-ups bar below (bot: 8 gap + 42 bar + 7 air), so FIT_RES.d's height is exactly top + bot and the board
   gives up those rows and no more (at the mock's own 1366 x 768 the board is 0.84 of the old scale, the mock's HK); #wrap's
   padding carries them (--ht / --hb). p in GAME: the chip plate (12 air, ring, a two-row 126 px box, ring, drop, 3 air)
   above the stage, the power-ups bar and the tile tip in the band under it, the controls docked below; FIT_RES.p's height
   is that stack at its smallest (one bar row, the PORT_GEO.pad floor). l: no rows taken; the chips stand in the side
   gutters beside the pad and the bomb, so a landscape phone keeps its whole board. hudGeo is the one geometry (viewport
   CSS px) the HUD painter and the touch strip read; #hud is its canvas (fixed, the viewport, click-through, over the
   board canvases and under #sh, #touchpad and the cards), backing owned here like #sh's; data-r is the right / bottom
   reach of the stage plus its rows, which the analytics card clears. */
import { hasTouch } from "../touch.js";

export const HUD_RES = Object.freeze({
  d: Object.freeze({ top: 106, bot: 57, air: 9, ring: 10, box: 74, gap: 8, bar: 42, tip: Object.freeze({ gap: 30, edge: 22, min: 220, max: 360, card: 184 }) }),
  p: Object.freeze({ top: 160, air: 8, ring: 10, box: 126, gap: 10, bar: 38, side: 12 }),
  l: Object.freeze({ edge: 8, gap: 12, pad: 152, padR: 8, act: 142, bomb: Object.freeze([40, 10, 72]), thr: Object.freeze([40, 90, 52]), rem: Object.freeze([100, 90, 52]) }),
});

/* FIT_RES: the reserves while the HUD shows (GAME, PAUSE and run ends included); FIT_BASE: everywhere else (INTRO, the show, ATTRACT,
   the menus keep the v202 board scale; lead ruling R2, fix round 1) */
export const FIT_RES = Object.freeze({ d: [40, 163], p: [16, 388], l: [332, 16] });
export const FIT_BASE = Object.freeze({ d: [40, 48], p: [16, 250], l: [332, 16] });

/* REAL 3D's wider stage on d (owner pick D, 2026-11-14, veto 2 "REAL 3D near corners at the default zoom"): #gl's content box is gk x #c's
   content box across (gk GL_WIDE, never past the viewport) and centred on it, so the cabinet rim's near corners land on the canvas while
   the board keeps its pixel size: the wrapper widens the camera's frustum with the canvas (data-gk), rig and lens untouched. p and l keep
   #c's box (gk 1; l's side gutters are the HUD's). gx: the CSS px #gl overhangs #c on each side. Only #gl: #c and #px never change. */
export const GL_WIDE = 1.12;
export function glBox(sw, bx, lay, W) {
  const c0 = sw - 2 * bx, gk = lay === "d" && c0 > 0 ? Math.max(1, Math.min(GL_WIDE, (W - 2 * bx) / c0)) : 1, w = gk * c0 + 2 * bx;
  return { gk, w, left: (sw - w) / 2, gx: (w - sw) / 2 };
}

export const stageCss = (s, cw, ch, bx = 0, by = 0) => Math.min((cw * s - 2 * bx) / cw, (ch * s - 2 * by) / ch);

export function fitBox(W, H, touch, cw, ch, hud) {
  const lay = !touch ? "d" : W > H ? "l" : "p";
  const [rw, rh] = (hud ? FIT_RES : FIT_BASE)[lay];
  return { lay, s: Math.max(0.3, Math.min((W - rw) / cw, (H - rh) / ch, 1.8)) };
}

/* The phone's touch strip in GAME (round 5 09-hud), from the controls' band portraitGeo docks to the thumb zone: the D-PAD
   box (pad: three keys and two STRIP.gap gaps across, so a key is never under 44 at the PORT_GEO.pad floor) at STRIP.dpad
   from the viewport's left, and a column STRIP.col wide at STRIP.right from its right: BOMB (the yellow key) at its foot,
   above it one row of two fixed halves, THROW left and REMOTE right, so neither moves when the other appears. Offsets are
   the CSS ones on #touchpad (the stage's box): tops below the stage's bottom edge, l from its left, r from its right, so
   a stage narrower than the viewport still docks the strip to the viewport's sides. */
export const STRIP = Object.freeze({ dpad: 20, gap: 10, gapMin: 8, right: 16, col: 130, air: 4, row: 14, bomb: 90 / 176 });

/* pad: the GAME strip's D-PAD floor and cap (148 keeps 44 keys 8 apart); menu: the floor off GAME, where #touchpad is hidden and the
   board keeps today's scale (R2), so a 300-wide phone's 190 band below the board still holds it */
export const PORT_GEO = Object.freeze({ top: 60, bot: 190, edge: 24, gap: 22, pad: [148, 176], menu: 128, side: [6, 14], mid: 24 });

export const PORT_GAME = Object.freeze({ top: HUD_RES.p.top, pad: 176, sd: "0.2s" });

export function portraitGeo(W, H, cw, ch, game) {
  const { s } = fitBox(W, H, true, cw, ch, game), G = PORT_GEO, gap = game ? HUD_RES.p.gap + HUD_RES.p.bar + 8 : G.gap;
  const sw = cw * s, sh = ch * s, slack = H - sh;
  const mid = Math.floor(Math.max(G.top, Math.min(slack / 2, slack - G.bot)));
  const roomW = W - STRIP.dpad - STRIP.right - 8 - (2 * 44 + 8);
  /* GAME: the stage sits right under the HUD plate (PORT_GAME.top) and the controls dock to the thumb zone; the band
     between holds the power-ups bar and the tile tip (at least gap: one bar row) */
  const top = game ? PORT_GAME.top : mid, band = H - top - sh;
  const pad = Math.floor(Math.max(game ? G.pad[0] : G.menu, Math.min(game ? PORT_GAME.pad : G.pad[1], band - G.edge - gap, roomW)));
  return { top, pad, padTop: Math.max(gap, Math.floor(band - G.edge - pad)) };
}

/* The HUD's slots in viewport CSS px (null off GAME on p, where no HUD shows). stage: the board's CSS box. d: plate = the
   chip plate's box (its ring and drop outside it, above the stage), bar = the power-ups bar, tip = the tile tip's column
   right of the board (y0..y1 the room it may take; null when the window is too narrow), kept above the analytics card's
   corner. p: plate, band (bar on top, tip at its foot), ctl (the controls' band) and strip (stripGeo in viewport px: the D-PAD box with
   its key size, BOMB, THROW, REMOTE). l: left and right gutter columns from the viewport's top, above the pad (left) and above THROW /
   REMOTE and the bomb (right; the PAUSE key heads it), and strip (the gutter controls index.html places with HUD_RES.l's numbers). */
export function hudGeo(W, H, cw, ch, lay, game) {
  const { s } = fitBox(W, H, lay !== "d", cw, ch, true), sw = cw * s, sh = ch * s, sx = (W - sw) / 2, R = (x, y, w, h) => ({ x, y, w, h });
  if (lay === "d") {
    const D = HUD_RES.d, T = D.tip, sy = Math.max(0, (H - D.top - sh - D.bot) / 2) + D.top, tx = sx + sw + T.gap, tw = Math.min(T.max, W - T.edge - tx);
    const pt = sy - D.top + D.air + D.ring;
    return { lay, s, gx: glBox(sw, 1, lay, W).gx, stage: R(sx, sy, sw, sh), plate: R(sx, pt, sw, D.box), bar: R(sx, sy + sh + D.gap, sw, D.bar),
      tip: tw >= T.min ? { x: tx, w: tw, y0: pt, y1: Math.min(sy + sh, H - T.card) } : null };
  }
  if (lay === "p") {
    if (!game) return null;
    const P = HUD_RES.p, g = portraitGeo(W, H, cw, ch, true), sy = g.top, sb = sy + sh, ct = sb + g.padTop;
    const a = stripGeo(W, H, cw, ch), sr = sx + sw, k = (o) => R(sr - o.r - o.w, sb + o.t, o.w, o.h);
    return { lay, s, stage: R(sx, sy, sw, sh), plate: R(P.side + P.ring, P.air + P.ring, W - 2 * (P.side + P.ring), P.box),
      band: R(P.side, sb + P.gap, W - 2 * P.side, ct - 8 - sb - P.gap), ctl: R(0, ct, W, g.pad),
      strip: { pad: { ...R(sx + a.pad.l, sb + a.pad.t, a.pad.s, a.pad.s), key: a.pad.key, gap: a.pad.gap }, bomb: k(a.bomb), thr: k(a.thr), rem: k(a.rem) } };
  }
  const L = HUD_RES.l, sy = (H - sh) / 2, rx = sx + sw + L.gap, sb = sy + sh, sr = sx + sw, k = ([l, b, w]) => R(sr + l, sb - b - w, w, w);
  return { lay, s, stage: R(sx, sy, sw, sh), left: R(L.edge, L.edge, sx - L.gap - L.edge, sy + sh - L.pad - 8 - L.edge),
    right: R(rx, L.edge, W - L.edge - rx, sy + sh - L.act - 8 - L.edge),
    strip: { pad: { ...R(sx - L.padR - L.pad, sb - L.pad, L.pad, L.pad), key: Math.floor((L.pad - 2 * STRIP.gap) / 3), gap: STRIP.gap }, bomb: k(L.bomb), thr: k(L.thr), rem: k(L.rem) } };
}

/* the right / bottom reach of the stage and its HUD rows (the plate's ring, the bar), never the tip's column: the analytics
   card clears this (cardClears) on a keyboard layout */
export function hudReach(g) {
  if (!g) return null;
  const r = HUD_RES.d.ring, b = [g.stage, g.bar].filter(Boolean);
  let right = Math.max(...b.map((q) => q.x + q.w)), bottom = Math.max(...b.map((q) => q.y + q.h));
  if (g.plate) right = Math.max(right, g.plate.x + g.plate.w + r);
  return { right, bottom };
}

/* The over box (Task 9.8): on p, PAUSE (its list and inline views), LEVEL CLEAR, the finale and GAME OVER take the whole space under the HUD
   plate (PORT_GAME.top, the board's top in a run) down to the viewport's bottom safe area, on #sh at its scale s: {top, h} in #sh's box units.
   d and l have none (their overlays keep #c's box). safeBot reads env(safe-area-inset-bottom) as body's scroll-padding-bottom (index.html). */
export const overGeo = (W, H, lay, s, sab = 0) => (lay === "p" && s > 0 ? { top: PORT_GAME.top / s, h: Math.max(0, H - Math.max(0, sab) - PORT_GAME.top) / s } : null);
const safeBot = (body) => { try { const v = typeof getComputedStyle === "function" && body ? parseFloat(getComputedStyle(body).scrollPaddingBottom) : 0; return Number.isFinite(v) ? v : 0; } catch (e) { return 0; } };

export const PORT_SHELL = Object.freeze({ s: 0.9, w: [400, 600], logo: 0.27 });
export const WIN_SHELL = Object.freeze({ min: [600, 520], dpr: 2 });

export function shellGeo(W, H, cw = 600, ch = 520, lay = "p") {
  const P = PORT_SHELL, b = fitBox(W, H, lay !== "d", cw, ch).s;
  const g = fitBox(W, H, lay !== "d", cw, ch, true).s; // play: the board's scale in a run on this layout (the HUD reserves), per box unit: the room behind a page
  if (lay !== "p") return W < WIN_SHELL.min[0] || H < WIN_SHELL.min[1] ? null : { w: Math.floor(W), h: Math.floor(H), s: 1, left: 0, top: 0, logo: (H - ch * b) / 2 + 1 + P.logo * ch * b, play: g };
  const aw = W - FIT_RES.p[0], s = Math.min(1.8, aw / Math.round(Math.max(P.w[0], Math.min(P.w[1], aw / P.s)))), w = Math.floor(W / s), h = Math.floor(H / s);
  return h < 520 ? null : { w, h, s, left: 0, top: 0, logo: (portraitGeo(W, H, cw, ch, false).top + 1 + P.logo * ch * b) / s, play: g / s };
}

export function stripGeo(W, H, cw, ch) {
  const { s } = fitBox(W, H, true, cw, ch, true), sx = (W - cw * s) / 2, g = portraitGeo(W, H, cw, ch, true), S = STRIP;
  const gap = Math.max(S.gapMin, Math.min(S.gap, Math.floor((g.pad - 3 * 44) / 2))), key = Math.floor((g.pad - 2 * gap) / 3), col = Math.min(S.col, W - S.right - 8 - S.dpad - g.pad), half = Math.floor((col - 8) / 2);
  const bh = Math.round(g.pad * S.bomb), rh = g.pad - 2 * S.air - bh - S.row, r = S.right - sx;
  return { pad: { l: S.dpad - sx, t: g.padTop, s: g.pad, key, gap }, bomb: { r, t: g.padTop + g.pad - S.air - bh, w: col, h: bh },
    thr: { r: r + col - half, t: g.padTop + S.air, w: half, h: rh }, rem: { r, t: g.padTop + S.air, w: half, h: rh } };
}

export function pxQuant(dpr) {
  for (let q = 1; q <= 64; q++) { const v = (q * 64) / dpr; if (Math.abs(v - Math.round(v)) < 1e-6) return q; }
  return 1;
}

export function pxBox(cssW, cssH, dpr, bx, by) {
  const d = dpr > 0 ? dpr : 1, q = pxQuant(d), sn = (v) => Math.max(q, q * Math.round(v / q));
  const bw = sn((cssW - 2 * bx) * d), bh = sn((cssH - 2 * by) * d);
  return { bw, bh, w: bw / d, h: bh / d };
}

export function snapOff(o, dpr) {
  const q = pxQuant(dpr), v = o * dpr;
  return (q * Math.round(v / q) - v) / dpr;
}

function bdr(el) {
  let cs = null;
  try { cs = typeof getComputedStyle === "function" ? getComputedStyle(el) : null; } catch { cs = null; }
  return cs ? [parseFloat(cs.borderLeftWidth) || 0, parseFloat(cs.borderTopWidth) || 0] : [0, 0];
}

export function pxBack(B, dpr, cap) {
  return cap > 0 && cap < dpr ? { bw: Math.max(1, Math.round(B.w * cap)), bh: Math.max(1, Math.round(B.h * cap)) } : { bw: B.bw, bh: B.bh };
}

function fitPx(el, cssW, cssH, cap) {
  const dpr = (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1, [bx, by] = bdr(el), B = pxBox(cssW, cssH, dpr, bx, by), K = pxBack(B, dpr, cap);
  el.style.boxSizing = "content-box";
  el.style.width = B.w + "px";
  el.style.height = B.h + "px";
  if (el.dataset) { el.dataset.bw = K.bw; el.dataset.bh = K.bh; }
  snapPxOrigin(el);
}

function snapPxOrigin(el) {
  if (!el || el.hidden || typeof el.getBoundingClientRect !== "function") return;
  const dpr = (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1, [bx, by] = bdr(el);
  el.style.left = "0px";
  el.style.top = "0px";
  const r = el.getBoundingClientRect();
  el.style.left = snapOff(r.left + bx, dpr) + "px";
  el.style.top = snapOff(r.top + by, dpr) + "px";
}

export function mountFit(canvas) {
  let wG = null, was, cap = Infinity, shG = null, shO = null, shM = 0, shLay = "d", stG = null, hG = null, hQ = 1, hGen = 0, hudOn = false, hBW = 1, hBH = 1;
  const shEl = () => (typeof document !== "undefined" && document.getElementById && document.getElementById("sh")) || null;
  const hudEl = () => (typeof document !== "undefined" && document.getElementById && document.getElementById("hud")) || null;
  const fit = () => {
    if (typeof window === "undefined") return;
    const tp0 = typeof document !== "undefined" && document.getElementById && document.getElementById("touchpad");
    const { lay, s } = fitBox(window.innerWidth, window.innerHeight, hasTouch(window), canvas.width, canvas.height, hudOn || (!!tp0 && !tp0.hidden));
    canvas.style.width = canvas.width * s + "px";
    canvas.style.height = canvas.height * s + "px";
    const [bx, by] = bdr(canvas);
    canvas.css = stageCss(s, canvas.width, canvas.height, bx, by);
    if (typeof document === "undefined") return;
    const gl = document.getElementById && document.getElementById("gl"), px = document.getElementById && document.getElementById("px");
    if (gl) {
      const G = glBox(canvas.width * s, bx, lay, window.innerWidth);
      if (G.gk > 1) { gl.style.width = G.w + "px"; gl.style.left = G.left + "px"; }
      else { gl.style.width = canvas.style.width; if (gl.style.left) gl.style.left = ""; }
      if (gl.dataset) { if (G.gk > 1) gl.dataset.gk = String(G.gk); else delete gl.dataset.gk; }
      gl.style.height = canvas.style.height;
      wG = G.gk > 1 ? { gx: G.gx, sw: canvas.width * s, sh: canvas.height * s, bx, by } : null;
    } else wG = null;
    const body = document.body, tp = document.getElementById && document.getElementById("touchpad");
    const game = !!tp && !tp.hidden, flip = was !== undefined && game !== was;
    was = game;
    if (body) {
      body.setAttribute("data-lay", lay);
      const sh = shEl();
      shG = sh ? shellGeo(window.innerWidth, window.innerHeight, canvas.width, canvas.height, lay) : null;
      stG = null; shLay = lay;
      if (shM !== 2) { if (shG) shPlace(sh, lay); else if (sh && !sh.hidden) sh.hidden = true; } // the stage re-lays itself next frame, over #c where this fit put it
      shO = shG ? overGeo(window.innerWidth, window.innerHeight, lay, shG.s, safeBot(body)) : null;
      const hud = hudEl();
      hG = hudGeo(window.innerWidth, window.innerHeight, canvas.width, canvas.height, lay, game);
      const st = body.style;
      if (st && st.setProperty) {
        if (lay === "d" && hudOn) { st.setProperty("--ht", HUD_RES.d.top + "px"); st.setProperty("--hb", HUD_RES.d.bot + "px"); }
        else if (st.removeProperty) { st.removeProperty("--ht"); st.removeProperty("--hb"); }
      }
      if (hud) {
        hQ = Math.min(lay === "p" ? 3 : WIN_SHELL.dpr, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);
        hBW = Math.round(window.innerWidth * hQ); hBH = Math.round(window.innerHeight * hQ);
        if (hudOn) { if (hud.width !== hBW) { hud.width = hBW; hGen++; } if (hud.height !== hBH) { hud.height = hBH; hGen++; } }
        hud.style.width = window.innerWidth + "px";
        hud.style.height = window.innerHeight + "px";
        if (hud.dataset && hud.dataset.r && !(hudOn && lay === "d")) hud.dataset.r = ""; // data-r is the painter's (hud.js reachOf, as drawn); off it reads nothing
      }
      if (lay === "p" && body.style && body.style.setProperty) {
        const g = portraitGeo(window.innerWidth, window.innerHeight, canvas.width, canvas.height, game);
        body.style.setProperty("--sd", flip ? PORT_GAME.sd : "0s");
        const a = stripGeo(window.innerWidth, window.innerHeight, canvas.width, canvas.height);
        for (const [k, v] of [["st", g.top], ["tp", a.pad.s], ["tpl", a.pad.l], ["tpt", a.pad.t], ["tbw", a.bomb.w], ["tbh", a.bomb.h], ["tbr", a.bomb.r], ["tbt", a.bomb.t], ["taw", a.thr.w], ["tah", a.thr.h], ["tthr", a.thr.r], ["ttht", a.thr.t], ["trem", a.rem.r], ["tret", a.rem.t]]) body.style.setProperty("--" + k, v + "px");
      }
    }
    if (px && px.style) fitPx(px, canvas.width * s, canvas.height * s, cap);
  };
  const put = (el, bw, bh, st) => {
    if (el.width !== bw) el.width = bw;
    if (el.height !== bh) el.height = bh;
    for (const k in st) if (el.style[k] !== st[k] + "px") el.style[k] = st[k] + "px";
  };
  const shPlace = (sh, lay) => {
    const q = Math.min(lay === "p" ? 3 : WIN_SHELL.dpr, shG.s * ((typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1));
    put(sh, Math.round(shG.w * q), Math.round(shG.h * q), { left: shG.left, top: shG.top, width: shG.w * shG.s, height: shG.h * shG.s });
  };
  const stagePlace = (sh) => {
    if (!stG) {
      const dpr = (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1, [bx, by] = bdr(canvas), r = canvas.getBoundingClientRect(), B = pxBox(r.width, r.height, dpr, bx, by), x = r.left + bx, y = r.top + by;
      stG = { bw: B.bw, bh: B.bh, st: { left: x + snapOff(x, dpr), top: y + snapOff(y, dpr), width: B.w, height: B.h } };
    }
    put(sh, stG.bw, stG.bh, stG.st);
  };
  fit.sh = shEl();
  fit.box = () => { const sh = shG && shEl(); return sh && !sh.hidden && shM !== 2 && shM !== 3 ? { width: shG.w, height: shG.h, logo: shG.logo, css: shG.s, play: shG.play, ownerDocument: sh.ownerDocument, getBoundingClientRect: () => sh.getBoundingClientRect() } : null; };
  /* the over box (Task 9.8): on p, PAUSE and the run ends draw on #sh in the space under the HUD plate (shO, box units), so the box's own
     (0, 0) is #sh's (0, top); its rect is that band, so a tap maps through it as a page's does through fit.box() */
  fit.over = () => {
    const sh = shO && shM === 3 && shEl();
    if (!sh || sh.hidden) return null;
    return { width: shG.w, height: shO.h, top: shO.top, full: [shG.w, shG.h], over: true, css: shG.s, ownerDocument: sh.ownerDocument,
      getBoundingClientRect: () => { const r = sh.getBoundingClientRect(), k = r.height / shG.h; return { left: r.left, top: r.top + shO.top * k, width: r.width, height: shO.h * k }; } };
  };
  fit.shell = (on) => {
    if (on === 2 || (on === 3 && !shO)) {
      const el = shEl();
      if (!el || typeof canvas.getBoundingClientRect !== "function") { if (el && !el.hidden) el.hidden = true; shM = 0; return null; }
      if (shM !== 2) stG = null;
      stagePlace(el);
      if (el.hidden) el.hidden = false;
      if (el.style.pointerEvents !== "none") el.style.pointerEvents = "none";
      shM = 2;
      const ctx = el.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.width, el.height);
      ctx.setTransform(el.width / canvas.width, 0, 0, el.height / canvas.height, 0, 0);
      ctx.imageSmoothingEnabled = true; // as #c's: the pages' cached layers blit near 1:1 at a fractional offset
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; // one context for the stage and the pages: no state carries over
      return { ctx, box: canvas, el };
    }
    const sh = shEl();
    if (!sh || !shG || !on) { if (sh && !sh.hidden) sh.hidden = true; shM = 0; return null; }
    if (shM === 2) shPlace(sh, shLay);
    if (sh.hidden) sh.hidden = false;
    if (sh.style.pointerEvents !== "") sh.style.pointerEvents = "";
    shM = on === 3 ? 3 : 1;
    const ctx = sh.getContext("2d"), ky = sh.height / shG.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, sh.width, sh.height);
    ctx.setTransform(sh.width / shG.w, 0, 0, ky, 0, shM === 3 ? shO.top * ky : 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    return { ctx, box: shM === 3 ? fit.over() : fit.box(), el: sh };
  };
  /* the HUD canvas: on shows it and hands back {ctx (CSS px transform), geo (hudGeo), w, h}; off (or no #hud, or no slots: p
     off GAME) hides it. Never clears: the HUD painter clears what it repaints, and only on a change. */
  fit.hud = (on) => {
    const el = hudEl(), want = !!on;
    if (want !== hudOn) { hudOn = want; fit(); } // the HUD's reserve comes and goes with it (R2): the stage re-fits once on the edge
    if (!el) return null;
    if (!on || !hG) {
      if (!el.hidden) el.hidden = true;
      if (el.width !== 1 || el.height !== 1) { el.width = 1; el.height = 1; hGen++; } // off GAME the backing sleeps (a full-viewport canvas is real memory)
      if (el.dataset && el.dataset.r) el.dataset.r = "";
      return null;
    }
    if (el.width !== hBW || el.height !== hBH) { el.width = hBW; el.height = hBH; hGen++; }
    if (el.hidden) el.hidden = false;
    const ctx = el.getContext("2d");
    ctx.setTransform(hQ, 0, 0, hQ, 0, 0);
    return { ctx, geo: hG, w: el.width / hQ, h: el.height / hQ, el };
  };
  fit.hudGeo = () => hG;
  fit.hudGen = () => hGen; // bumped whenever #hud's backing is reassigned (which clears it): the HUD repaints then, change or not
  /* REAL 3D's wider stage (glBox): the board's washes (the title's veil, a blast's flash, PAUSE's and the run ends' veils) are whole-box
     fills on #c or on the stage (#sh, on 2), so they would stop at the board box and leave the rim's near corners bare beside them. #wl /
     #wr, the two strips #gl overhangs (its content box beyond #c's), carry the source's own column x (its backing px; the right one mirrored)
     across, once a frame after the source paints, so a wash reads as the whole stage's. src null (or no wider stage on screen) hides them. */
  const wEl = (id) => (typeof document !== "undefined" && document.getElementById && document.getElementById(id)) || null;
  fit.wash = (src, x = 0) => {
    const gl = wEl("gl"), on = !!(src && wG && gl && !gl.hidden && src.width > 2 * x + 1 && src.height > 0);
    ["wl", "wr"].forEach((id, i) => {
      const el = wEl(id);
      if (!el) return;
      if (!on) { if (!el.hidden) el.hidden = true; return; }
      const h = src.height | 0, st = { left: i ? wG.sw - wG.bx : wG.bx - wG.gx, top: wG.by, width: wG.gx, height: wG.sh - 2 * wG.by };
      if (el.width !== 1) el.width = 1;
      if (el.height !== h) el.height = h;
      for (const k in st) if (el.style[k] !== st[k] + "px") el.style[k] = st[k] + "px";
      if (el.hidden) el.hidden = false;
      const c = el.getContext("2d");
      c.clearRect(0, 0, 1, h);
      c.drawImage(src, i ? src.width - 1 - x : x, 0, 1, h, 0, 0, 1, h);
    });
  };
  fit.setPxCap = (c) => { const v = c > 0 ? c : Infinity; if (v !== cap) { cap = v; fit(); } };
  fit();
  if (typeof window !== "undefined") {
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    const tp = typeof document !== "undefined" && document.getElementById && document.getElementById("touchpad");
    if (tp && typeof MutationObserver === "function") new MutationObserver(fit).observe(tp, { attributes: true, attributeFilter: ["hidden"] });
    const wrap = typeof document !== "undefined" && document.getElementById && document.getElementById("wrap");
    if (wrap && wrap.addEventListener) wrap.addEventListener("transitionend", () => snapPxOrigin(document.getElementById("px")));
    const dpq = () => {
      const q = typeof window.matchMedia === "function" && typeof devicePixelRatio !== "undefined" ? window.matchMedia("(resolution: " + devicePixelRatio + "dppx)") : null;
      if (q && q.addEventListener) q.addEventListener("change", () => { fit(); dpq(); }, { once: true });
    };
    dpq();
  }
  return fit;
}
