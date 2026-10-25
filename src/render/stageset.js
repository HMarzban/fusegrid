/* STAGE SET (mockup C): the per-world diorama behind the board canvas. #set is a fixed
   page canvas under #wrap; src/render/stagepaint.js paints it once per room / look /
   stage move, never per frame. PIXEL gets a coarse buffer (1 backing px = 1 art px of the
   board) scaled with nearest-neighbour. Browser only: Node has no document, so mount is a no-op. */
import { biomeOf } from "../core/config.js";
import { paintSet } from "./stagepaint.js";

export function mountStageSet(set, board) {
  if (!set || !board || typeof window === "undefined" || !set.getContext) return () => {};
  let key = "", n = 0;
  const paint = (level, px, rc, W, H) => {
    const dpr = Math.min((typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1, 2), s = rc.width / 600, q = px ? Math.max(1, 2 * s) : 1 / dpr;
    const bw = Math.max(1, Math.ceil(W / q)), bh = Math.max(1, Math.ceil(H / q)), f = 1 / q, g = set.getContext("2d");
    set.width = bw; set.height = bh;
    set.style.imageRendering = px ? "pixelated" : "auto";
    set.style.width = bw * q + "px"; set.style.height = bh * q + "px";
    g.imageSmoothingEnabled = !px;
    paintSet(g, bw, bh, biomeOf(level), { x: rc.left * f, y: rc.top * f, w: rc.width * f, h: rc.height * f }, rc.width * f / 600, { idx: (Math.max(1, level) - 1) % 8, px });
    set.dataset.level = String(level); set.dataset.look = px ? "px" : "2d";
  };
  return function sync(level, kind) {
    const px = kind === "px", lv = level | 0 || 1;
    if (n++ % 10 && key.startsWith(lv + ":" + px + ":")) return;
    const rc = board.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight, k = lv + ":" + px + ":" + W + "x" + H + ":" + Math.round(rc.left) + "," + Math.round(rc.top) + "," + Math.round(rc.width);
    if (k === key) return;
    key = k;
    paint(lv, px, rc, W, H);
  };
}
