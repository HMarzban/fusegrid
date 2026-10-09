/* OPENING (spec 2026-10-09-opening-design): two phases inside SCREEN.INTRO.
   Title (stage 0) loops silently until a press; the show (stage 1) is 32 menu
   track steps, so its grid is the music's grid. The show world is a throwaway
   CORE room 1 like attract's: foes held at speed 0, a scripted plant whose
   boom (not the clock) reveals MENU. Pure, DOM-free, Node-testable. */
import { CFG } from "../core/config.js";
import { createWorld, loadLevel, step } from "../core/sim.js";

export const SHOW_STEP = 0.137; // MUSIC_TRACKS.menu.A.STEP (pinned)
export const SHOW_DUR = 32 * SHOW_STEP;
export const SHOW_PLANT = SHOW_DUR - CFG.FUSE; // derived: a FUSE retune moves the plant, never the reveal
export const SKIP_GUARD = 0.2;
export const SHOW_SEED = 20261009;
const PLANT_N = Math.round(SHOW_PLANT / CFG.STEP);
/* [show step count reached by this step, move x, move y, fire]. Authored around
   the plant step: walk right to the brick, plant, step back and down to the
   diagonal-safe tile, then NOOP so flames and fx finish on MENU. */
export const SHOW_SCRIPT = Object.freeze([
  [0, 0, 0, 0],
  [PLANT_N - 65, 1, 0, 0],
  [PLANT_N - 8, 0, 0, 0],
  [PLANT_N, 0, 0, 1],
  [PLANT_N + 2, -1, 0, 0],
  [PLANT_N + 20, 0, 1, 0],
  [PLANT_N + 50, 0, 0, 0],
].map(Object.freeze));

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const TAU = 2 * Math.PI;

/* CLASSIC 2D canvas transform. Title: zoom 1.12 drifting on incommensurate
   periods; show: push to 1.8 on MAKO's spawn corner by 8S, hold, pull back to
   MENU's untransformed frame exactly at SHOW_DUR. Pan is clamped so no edge
   gap ever shows. introPhase(1,0,pT) equals introPhase(0,pT): no pop. */
const title = (t) => ({ zoom: 1.12, camX: 0.5 + 0.04 * Math.sin((TAU * t) / (32 * SHOW_STEP)),
  camY: 0.5 + 0.03 * Math.sin((TAU * t) / (24 * SHOW_STEP)) });
const CLOSE = { zoom: 1.8, camX: (1.5 * CFG.TILE) / (CFG.COLS * CFG.TILE), camY: (1.5 * CFG.TILE) / (CFG.ROWS * CFG.TILE) };
export function introPhase(stage, t, pressT = 0) {
  if (stage !== 1) return { ...title(t), veil: 0.45 };
  const s = Math.max(0, t);
  if (s >= SHOW_DUR) return { zoom: 1, camX: 0.5, camY: 0.5, veil: 0.12 };
  const a = title(pressT), k1 = easeInOutCubic(seg(s, 0, 8 * SHOW_STEP)), k2 = easeInOutCubic(seg(s, 16 * SHOW_STEP, SHOW_DUR));
  const f = (x, y, z) => { const m = x + (y - x) * k1; return k2 > 0 ? z + (m - z) * (1 - k2) : m; };
  const zoom = f(a.zoom, CLOSE.zoom, 1), lo = 0.5 / zoom;
  return { zoom, camX: clamp(f(a.camX, CLOSE.camX, 0.5), lo, 1 - lo), camY: clamp(f(a.camY, CLOSE.camY, 0.5), lo, 1 - lo),
    veil: 0.45 + (0.12 - 0.45) * k1 };
}

/* MAKO's pop-in scale: 0 until 4S, easeOutBack over 0.25 s (overshoot ~1.1), then 1. */
export function popOf(t) {
  return t < 4 * SHOW_STEP ? 0 : easeOutBack(seg(t, 4 * SHOW_STEP, 4 * SHOW_STEP + 0.25));
}

export function createShow() {
  const w = createWorld(SHOW_SEED, 1);
  w.heat = 0;
  w.pact = 0;
  w.pace = 0;
  loadLevel(w, 1, false);
  w.state = "PLAY";
  for (const e of w.enemies) e.speed = 0; // the throwaway world's own foes, never CFG
  w.players[0].iFrames = 0; // no spawn blink: MAKO pops in once, solid
  return { world: w, n: 0, acc: 0,
    it: { move: { x: 0, y: 0 }, fire: false, firePrev: false, shift: false, remote: false, kick: false } };
}

/* Same accumulator + anti-spiral cap as stepDemo. Steps only when live (the
   show and after, never the title). Sets app.showBoom on the show bomb's boom
   before the renderer drains world.events. */
export function stepShow(show, dt, app, live) {
  if (!live) return;
  show.acc += dt;
  let k = 0;
  while (show.acc >= CFG.STEP) {
    show.n++;
    let r = SHOW_SCRIPT[0];
    for (const s of SHOW_SCRIPT) if (show.n >= s[0]) r = s;
    show.it.move.x = r[1];
    show.it.move.y = r[2];
    show.it.fire = !!r[3];
    const ev = show.world.events, e0 = ev.length;
    step(show.world, CFG.STEP, { 0: show.it });
    for (let i = e0; i < ev.length; i++) if (ev[i].t === "boom" && app) app.showBoom = true;
    show.acc -= CFG.STEP;
    if (++k > 6) { show.acc = 0; break; }
  }
}
