/* Stage fit for the browser entry (src/main.js). Scales #c, #gl, #px to the
   viewport minus a per-layout reserve and writes body[data-lay], the one
   predicate index.html keys the touch layout off: d desktop (no touch),
   p touch portrait (pad + bomb below the stage), l touch landscape (side
   gutters). Never assigns the #gl / #px drawing buffers (each renderer
   owns its own).
   Touch portrait is width-bound, so the slack is vertical: portraitGeo
   centres the stage in it (clamped to the FIT_RES.p split, 60 above for the
   pause pill, 190 below for the controls) and docks the pad + bomb to the
   thumb zone at the bottom, grown into the band. actGeo docks the touch
   THROW / REMOTE row (GAME only, shown while the player holds the power) to
   the bomb: a row above it (THROW over the bomb, REMOTE to its left), else
   a column in the pad-bomb gap (short phones: THROW over REMOTE), else a
   row below the bomb, else beside the pause pill above the stage.
   INTRO / MENU / ATTRACT keep
   that centred stage; while #touchpad shows (GAME only — touch.update flips
   its hidden on the GAME edge) the game geometry lifts the stage to just
   under the pause pill (PORT_GAME.top, never below the centred top) and the
   freed band goes to the controls, still docked to the thumb zone. A
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
   A devicePixelRatio change with no resize (a window dragged between
   monitors) re-fits through a one-shot matchMedia resolution query, re-armed
   at the new ratio. */
import { hasTouch } from "../touch.js";

export const FIT_RES = Object.freeze({ d: [40, 48], p: [16, 250], l: [332, 16] });

export function fitBox(W, H, touch, cw, ch) {
  const lay = !touch ? "d" : W > H ? "l" : "p";
  const [rw, rh] = FIT_RES[lay];
  return { lay, s: Math.max(0.3, Math.min((W - rw) / cw, (H - rh) / ch, 1.8)) };
}

export const PORT_GEO = Object.freeze({ top: 60, bot: 190, edge: 24, gap: 22, pad: [128, 176], side: [6, 14], mid: 24 });

export const PORT_GAME = Object.freeze({ top: 72, pad: 184, sd: "0.2s" });

export function portraitGeo(W, H, cw, ch, game) {
  const { s } = fitBox(W, H, true, cw, ch), G = PORT_GEO;
  const sw = cw * s, sh = ch * s, slack = H - sh;
  const mid = Math.floor(Math.max(G.top, Math.min(slack / 2, slack - G.bot)));
  const top = game ? Math.min(mid, PORT_GAME.top) : mid;
  const band = H - top - sh, roomW = (sw - G.side[0] - G.side[1] - G.mid) * 16 / 25;
  const pad = Math.floor(Math.max(G.pad[0], Math.min(game ? PORT_GAME.pad : G.pad[1], band - G.edge - G.gap, roomW)));
  const bomb = Math.round(pad * 9 / 16), padTop = Math.max(G.gap, Math.floor(band - G.edge - pad));
  return { top, pad, bomb, padTop, bombTop: padTop + Math.round((pad - bomb) / 2) };
}

export const ACT_GEO = Object.freeze({ max: 52, min: 44, gap: 8, pill: 44 });

export function actGeo(W, H, cw, ch) {
  const { s } = fitBox(W, H, true, cw, ch), sw = cw * s, sh = ch * s, g = portraitGeo(W, H, cw, ch, true), A = ACT_GEO, G = PORT_GEO, r = G.side[1];
  const band = H - g.top - sh, padR = G.side[0] + g.pad + A.gap, out = (mode, a, t0, r0, t1, r1) => ({ mode, act: a, thr: { r: r0, t: t0 }, rem: { r: r1, t: t1 } });
  for (let a = A.max; a >= A.min; a--) {
    const t = g.bombTop - A.gap - a;
    if (t >= A.gap && (sw - r - 2 * a - A.gap >= padR || t + a <= g.padTop - A.gap)) return out("up", a, t, r, t, r + a + A.gap);
  }
  for (let a = A.max; a >= A.min; a--) {
    const mid = sw - r - g.bomb - padR + A.gap, t = Math.max(A.gap, Math.min(band - A.gap - 2 * a - A.gap, g.bombTop + Math.round(g.bomb / 2) - a - A.gap / 2));
    if (mid >= a + 2 * A.gap && t >= A.gap) { const x = r + g.bomb + Math.floor((mid - a) / 2); return out("mid", a, t, x, t + a + A.gap, x); }
  }
  for (let a = A.max; a >= A.min; a--) {
    const t = g.bombTop + g.bomb + A.gap;
    if (t + a <= band - A.gap && sw - r - 2 * a - A.gap >= padR) return out("down", a, t, r, t, r + a + A.gap);
  }
  const a = A.min, t = -(sh + A.gap + a), x = A.pill + A.gap;
  return out("top", a, t, x, t, x + a + A.gap);
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

function fitPx(el, cssW, cssH) {
  const dpr = (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1, [bx, by] = bdr(el), B = pxBox(cssW, cssH, dpr, bx, by);
  el.style.boxSizing = "content-box";
  el.style.width = B.w + "px";
  el.style.height = B.h + "px";
  if (el.dataset) { el.dataset.bw = B.bw; el.dataset.bh = B.bh; }
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
  let was;
  const fit = () => {
    if (typeof window === "undefined") return;
    const { lay, s } = fitBox(window.innerWidth, window.innerHeight, hasTouch(window), canvas.width, canvas.height);
    canvas.style.width = canvas.width * s + "px";
    canvas.style.height = canvas.height * s + "px";
    if (typeof document === "undefined") return;
    const gl = document.getElementById && document.getElementById("gl"), px = document.getElementById && document.getElementById("px");
    if (gl) {
      gl.style.width = canvas.style.width;
      gl.style.height = canvas.style.height;
    }
    const body = document.body, tp = document.getElementById && document.getElementById("touchpad");
    const game = !!tp && !tp.hidden, flip = was !== undefined && game !== was;
    was = game;
    if (body) {
      body.setAttribute("data-lay", lay);
      if (lay === "p" && body.style && body.style.setProperty) {
        const g = portraitGeo(window.innerWidth, window.innerHeight, canvas.width, canvas.height, game);
        body.style.setProperty("--sd", flip ? PORT_GAME.sd : "0s");
        const a = actGeo(window.innerWidth, window.innerHeight, canvas.width, canvas.height);
        for (const [k, v] of [["st", g.top], ["tp", g.pad], ["tb", g.bomb], ["tpt", g.padTop], ["tbt", g.bombTop], ["ta", a.act], ["tthr", a.thr.r], ["ttht", a.thr.t], ["trem", a.rem.r], ["tret", a.rem.t]]) body.style.setProperty("--" + k, v + "px");
      }
    }
    if (px && px.style) fitPx(px, canvas.width * s, canvas.height * s);
  };
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
