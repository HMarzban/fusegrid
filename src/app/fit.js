/* Stage fit for the browser entry (src/main.js). Scales #c and #gl to the
   viewport minus a per-layout reserve and writes body[data-lay], the one
   predicate index.html keys the touch layout off: d desktop (no touch),
   p touch portrait (pad + bomb below the stage), l touch landscape (side
   gutters). Never assigns the #gl drawing buffer — the wrapper owns it. */
import { hasTouch } from "../touch.js";

export const FIT_RES = Object.freeze({ d: [40, 48], p: [16, 250], l: [332, 16] });

export function fitBox(W, H, touch, cw, ch) {
  const lay = !touch ? "d" : W > H ? "l" : "p";
  const [rw, rh] = FIT_RES[lay];
  return { lay, s: Math.max(0.3, Math.min((W - rw) / cw, (H - rh) / ch, 1.8)) };
}

export function mountFit(canvas) {
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
    if (document.body) document.body.setAttribute("data-lay", lay);
  };
  fit();
  if (typeof window !== "undefined") {
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
  }
  return fit;
}
