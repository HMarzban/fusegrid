/* ATTRACT demo harness (spec §1): main owns nothing but the handle returned
   here — the shell machine only flips screens. Fixed seed, levels cycle
   1..3, 20s sim-time cap per cycle before rollover. Attract is ALWAYS CORE +
   pact=0 no matter what heat/pact the shell has selected. The bot (demobot.js)
   is out of the boot graph (v202): it fills this seam on import (src/app/lazyload.js
   in the title's first idle, a plain import in Node), MENU waits for it before
   ATTRACT, and a demo asked for with the seam empty throws. */
import { CFG } from "../core/config.js";
import { createWorld, loadLevel, step } from "../core/sim.js";

let mkBot = null;
export function setDemobot(fn) { mkBot = fn; }
export const demoReady = () => !!mkBot;

export const DEMO_SEED = 20260823,
  DEMO_CAP = 20;

export function newDemoWorld(lvl) {
  const w = createWorld(DEMO_SEED, lvl);
  w.heat = 0;
  w.pact = 0;
  loadLevel(w, lvl, false); // loadLevel sets MENU... CORE attract only
  w.state = "PLAY"; // ...so force PLAY explicitly
  return w;
}

export function createDemo() {
  if (!mkBot) throw new Error("ATTRACT demo requested but src/app/demobot.js is not loaded");
  const createDemobot = mkBot;
  return {
    world: newDemoWorld(1),
    bot: createDemobot(DEMO_SEED),
    cycle: 1,
    t: 0,
    acc: 0,
  };
}

export function rollDemo(demo) {
  demo.cycle = (demo.cycle % 3) + 1;
  demo.world = newDemoWorld(demo.cycle);
  demo.t = 0;
}

/* Same fixed-step accumulator discipline as the GAME branch in main.js. */
export function stepDemo(demo, dt) {
  demo.acc += dt;
  let n = 0;
  while (demo.acc >= CFG.STEP) {
    const it = demo.bot.intent(demo.world);
    step(demo.world, CFG.STEP, { 0: it });
    demo.t += CFG.STEP;
    demo.acc -= CFG.STEP;
    n++;
    if (
      demo.world.state === "LOSE" ||
      demo.world.state === "WIN" ||
      demo.t >= DEMO_CAP
    )
      rollDemo(demo);
    if (n > 6) {
      demo.acc = 0;
      break;
    } // same anti-spiral cap as GAME
  }
}
