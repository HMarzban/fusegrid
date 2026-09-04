/* window.__GAME__ debug/test hook — browser only, opt-in via opts.debug or
   ?debug=1. Pure surface exposure: every behaviour it reaches is a handler
   main.js already owns, so dropping the hook cannot change the game. Live
   refs (renderer, demo) come in as getters because both are swapped mid-run
   by the RENDER toggle and the ATTRACT harness. */
import { CFG } from "../core/config.js";
import { loadLevel, step } from "../core/sim.js";
import { SCREEN } from "./menuapp.js";

const SCREEN_NAME = [
  "BOOT",
  "INTRO",
  "MENU",
  "LEVEL",
  "HOWTO",
  "SCORES",
  "GAME",
  "ATTRACT",
  "ITEMS",
  "ENEMIES",
];

export function mountDebugHook(h) {
  if (typeof window === "undefined") return;
  const { world, input, app } = h;
  window.__GAME__ = {
    G: world,
    get renderer() {
      return h.renderer();
    },
    input,
    app,
    audio: h.audio,
    net: h.net,
    cam: h.cam,
    get demo() {
      return h.demo();
    },
    step: (n = 1) => {
      for (let i = 0; i < n; i++) {
        const it = input.intent();
        step(world, CFG.STEP, { 0: it });
        input.advance();
      }
      h.renderer().render(world, CFG.STEP * n);
    },
    state: () =>
      app.screen === SCREEN.GAME ? world.state : SCREEN_NAME[app.screen],
    reset: () => {
      app.toMenu();
    },
    begin: () => {
      app.startRun();
    },
    setKeys: (o) => input.setIntent(o),
    clearAllEnemies: () => {
      world.enemies.forEach((e) => {
        e.dead = true;
      });
      return world.enemies.length;
    },
    advance: () => {
      loadLevel(world, world.level + 1, true);
      world.state = "PLAY";
    },
    canvas: h.canvas,
  };
  window.__pause = h.onPause;
  window.__resume = () => {
    if (world.state === "PAUSE") world.state = "PLAY";
  };
}
