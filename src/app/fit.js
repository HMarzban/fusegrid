/* Stage fit for the browser entry (src/main.js). Scales #c and #gl to the
   viewport minus a per-layout reserve and writes body[data-lay], the one
   predicate index.html keys the touch layout off: d desktop (no touch),
   p touch portrait (pad + bomb below the stage), l touch landscape (side
   gutters). Never assigns the #gl drawing buffer — the wrapper owns it.
   Touch portrait is width-bound, so the slack is vertical: portraitGeo
   centres the stage in it (clamped to the FIT_RES.p split, 60 above for the
   pause pill, 190 below for the controls) and docks the pad + bomb to the
   thumb zone at the bottom, grown into the band. INTRO / MENU / ATTRACT keep
   that centred stage; while #touchpad shows (GAME only — touch.update flips
   its hidden on the GAME edge) the game geometry lifts the stage to just
   under the pause pill (PORT_GAME.top, never below the centred top) and the
   freed band goes to the controls, still docked to the thumb zone. A
   MutationObserver on that one hidden attribute re-fits, and --sd glides the
   lift on that edge only (0s on resize / rotation). */
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

export function mountFit(canvas) {
  let was;
  const fit = () => {
    if (typeof window === "undefined") return;
    const { lay, s } = fitBox(window.innerWidth, window.innerHeight, hasTouch(window), canvas.width, canvas.height);
    canvas.style.width = canvas.width * s + "px";
    canvas.style.height = canvas.height * s + "px";
    if (typeof document === "undefined") return;
    const glEl = document.getElementById && document.getElementById("gl");
    if (glEl) {
      glEl.style.width = canvas.style.width;
      glEl.style.height = canvas.style.height;
    }
    const body = document.body, tp = document.getElementById && document.getElementById("touchpad");
    const game = !!tp && !tp.hidden, flip = was !== undefined && game !== was;
    was = game;
    if (!body) return;
    body.setAttribute("data-lay", lay);
    if (lay !== "p" || !body.style || !body.style.setProperty) return;
    const g = portraitGeo(window.innerWidth, window.innerHeight, canvas.width, canvas.height, game);
    body.style.setProperty("--sd", flip ? PORT_GAME.sd : "0s");
    for (const [k, v] of [["st", g.top], ["tp", g.pad], ["tb", g.bomb], ["tpt", g.padTop], ["tbt", g.bombTop]]) body.style.setProperty("--" + k, v + "px");
  };
  fit();
  if (typeof window !== "undefined") {
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    const tp = typeof document !== "undefined" && document.getElementById && document.getElementById("touchpad");
    if (tp && typeof MutationObserver === "function") new MutationObserver(fit).observe(tp, { attributes: true, attributeFilter: ["hidden"] });
  }
  return fit;
}
