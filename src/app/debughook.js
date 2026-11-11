/* window.__GAME__ debug/test hook — browser only, opt-in via opts.debug or
   ?debug=1. Pure surface exposure: every behaviour it reaches is a handler
   main.js already owns, so dropping the hook cannot change the game. Live
   refs (renderer, demo) come in as getters because both are swapped mid-run
   by the RENDER toggle and the ATTRACT harness. `ui` (R15) is the page probe
   main hands in ({snap, on, textScale}: src/render/kit/probe.js and type.js,
   which src/app may not import): __GAME__.ui for tools/ui/shots.mjs, which
   alone switches it on (ui.on(true)), so a plain ?debug=1 session records
   nothing. */
import { CFG } from "../core/config.js";
import { loadLevel, step } from "../core/sim.js";
import { SCREEN } from "./menuapp.js";
import { recordScore, saveScores } from "./highscores.js";
import { recordBest, saveBests } from "./bests.js";
import { saveMedals } from "./medals.js";
import { savePlaques } from "./plaques.js";
import { clampStats, saveStats } from "./stats.js";

/* seedRecords (v202 fix round 1, for tools/ui/shots.mjs's scoresfull / statsfull captures): a played-looking cabinet written through the stores'
   own savers, so RECORDS draws a FILLED table, badges, medals and a STATS hero. One bucket's best score (8,120 on HARD) comes from a level-3 run
   while another bucket reached level 5, so the page's BEST SCORE and FURTHEST LEVEL read as the two separate maxima they are. Debug only. */
export function seedRecords(store) {
  let list = [];
  const P = [0, 1, 0, 3, 7, 0, 5, 2, 0, 15];
  for (let i = 0; i < 10; i++) list = recordScore(list, { s: 9640 - i * 731, l: 8 - (i % 6), d: "2026-11-" + String(10 - i).padStart(2, "0"), p: P[i] });
  saveScores(list, store);
  let b = {};
  for (const [k, sc, r] of [["0:0:1", 4820, 5], ["1:0:1", 8120, 3], ["2:0:1", 3100, 2], ["1:5:2", 6200, 4]]) b = recordBest(b, k, sc, r);
  saveBests(b, store);
  saveMedals(0b10100101, store);
  savePlaques(0b0101, store);
  saveStats(clampStats({ a: { runs: 47, secs: 11520, rooms: 132, kills: 588, picks: 214, deaths: 61, days: 9, sessions: 5, first: "2026-11-01", last: "2026-11-10" } }), store);
  return true;
}

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
  "SETTINGS",
  "GUIDE",
  "STATS",
  "TROPHIES",
  "GRAPHICS",
  "FLOOR",
  "CONTROLS",
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
    ctl: h.ctl,
    ga: h.ga,
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
      app.screen === SCREEN.GAME
        ? world.state
        : SCREEN_NAME[app.screen] || String(app.screen),
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
    ui: h.ui || null,
    seedRecords: () => seedRecords(),
  };
  window.__pause = h.onPause;
  window.__resume = () => {
    if (world.state === "PAUSE") world.state = "PLAY";
  };
}
