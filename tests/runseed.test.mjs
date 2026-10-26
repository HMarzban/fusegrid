/* #10: a random board every ordinary run, no new UI. Ordinary run i of a page
   load plays runSeed(bootSeed, i) (run 0 = bootSeed); every ordinary start
   (onStart, PAUSE RESTART, the sim's GAME OVER / finale restart) consumes the
   armed seed and arms the next. A DAILY or ?code= run is fixed: its restarts
   replay its board and it never uses or advances the index. Driven through
   the real createGame keydown/keyup listeners, the keys.test pattern. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createGame } from "../src/main.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { runSeed } from "../src/core/rng.js";
import { CFG, T, key } from "../src/core/config.js";
import { SCREEN, ITEMS, IDLE_T } from "../src/app/menuapp.js";
import { dailySeed } from "../src/app/daily.js";
import { encodeChallenge, decodeChallenge } from "../src/app/code.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const noop = () => {};
const flush = () => new Promise((r) => setImmediate(r));

const L = {}, mem = {}, clip = [];
globalThis.window = {
  addEventListener: (ty, fn) => { (L[ty] = L[ty] || []).push(fn); },
  removeEventListener: noop, innerWidth: 1440, innerHeight: 900,
  localStorage: { getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
  open: noop,
};
globalThis.location = { search: "", reload: noop };
const navDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
Object.defineProperty(globalThis, "navigator", {
  value: { clipboard: { writeText: (s) => { clip.push(s); return Promise.resolve(); } } }, configurable: true,
});

function mk(o = {}) {
  for (const k in L) delete L[k];
  for (const k in mem) delete mem[k];
  const g = createGame(null, { seed: 42, ...o });
  g.t = 0;
  g.tick = (n = 1) => { for (let i = 0; i < n; i++) { g.t += 1000 / 60; g.loop(g.t); } };
  const r = g.renderer, r0 = r.render.bind(r);
  r.render = (w, dt, ro) => { g.ro = ro; return r0(w, dt, ro); };
  g.tick();
  return g;
}
const down = (code) => (L.keydown || []).forEach((f) => f({ code, key: code, repeat: false, preventDefault: noop }));
const up = (code) => (L.keyup || []).forEach((f) => f({ code, key: code, preventDefault: noop }));
const press = (g, code, hold = 3) => { down(code); g.tick(hold); up(code); g.tick(2); };
const menu = (o) => { const g = mk(o); press(g, "KeyA"); g.tick(15); press(g, "Enter"); return g; };
const toRow = (g, i) => { for (let k = 0; k < i; k++) press(g, "ArrowDown"); };
const bricks = (w) => {
  const out = [];
  for (let y = 0; y < CFG.ROWS; y++) for (let x = 0; x < CFG.COLS; x++) if (w.grid[key(x, y)] === T.BRICK) out.push(x + "," + y);
  return out.join(" ");
};
const walls = (w) => {
  const out = [];
  for (let y = 0; y < CFG.ROWS; y++) for (let x = 0; x < CFG.COLS; x++) if (w.grid[key(x, y)] === T.WALL) out.push(x + "," + y);
  return out.join(" ");
};
/* the board a start dealt, read on its first frames (nothing blown yet) */
const board = (g) => ({ seed: g.world.seed, b: bricks(g.world), w: walls(g.world) });
const play = (g) => { g.app.cursor = ITEMS.indexOf("PLAY"); press(g, "Enter"); return board(g); };
const quit = (g) => { press(g, "KeyP"); press(g, "KeyM"); };
const restart = (g) => { press(g, "KeyP"); toRow(g, 1); press(g, "Enter"); g.tick(5); return board(g); };
const gameOver = (g) => { g.world.state = "LOSE"; g.tick(3); press(g, "Enter"); g.tick(5); return board(g); };
const daily = (g) => { g.app.cursor = ITEMS.indexOf("DAILY"); press(g, "Enter"); return board(g); };
const p2 = (n) => (n < 10 ? "0" + n : "" + n);
const d0 = new Date();
const local = d0.getFullYear() + "-" + p2(d0.getMonth() + 1) + "-" + p2(d0.getDate());

try {
  // ---- 1. runSeed: pure, run 0 is bootSeed, a full-range avalanche ----
  {
    const boots = [0, 1, 42, 777, 123456789, 0x80000000, 0xFFFFFFFF];
    check("runSeed(b, 0) === b for every boot seed", boots.every((b) => runSeed(b, 0) === b >>> 0));
    check("runSeed is pure: the same (b, i) gives the same seed", boots.every((b) => runSeed(b, 7) === runSeed(b, 7)));
    let distinct = true, ranged = true;
    for (const b of boots) {
      const seen = new Set();
      for (let i = 0; i < 2000; i++) { const s = runSeed(b, i); seen.add(s); if (!(s >>> 0 === s)) ranged = false; }
      if (seen.size !== 2000) distinct = false;
    }
    check("2000 consecutive runs of a page load all get distinct seeds", distinct);
    check("every run seed is an unsigned 32-bit int", ranged);
    check("neighbouring boot seeds give unrelated run-1 seeds (avalanche)", runSeed(42, 1) !== runSeed(43, 1) &&
      Math.abs(runSeed(42, 1) - runSeed(43, 1)) > 1000, runSeed(42, 1) + " / " + runSeed(43, 1));
    check("a run seed survives the B copy-link round trip (codes carry the full 32 bits)",
      [runSeed(42, 1), runSeed(0xFFFFFFFF, 3), 0x80000000, 0xFFFFFFFF].every((s) =>
        decodeChallenge(encodeChallenge({ seed: s, heat: 0, pact: 0, pace: 0 })).seed === s));
    const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".js") ? [join(d, e.name)] : []);
    const dirty = walk("src/core").filter((f) => /Math\.random|\bDate\b/.test(readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")));
    check("no Math.random or Date in src/core", dirty.length === 0, dirty.join(","));
  }

  // ---- 2. the sim hand-off: startGame consumes world.nextSeed, null keeps the seed ----
  {
    const fire = { 0: { fire: true, move: { x: 0, y: 0 } } };
    for (const st of ["LOSE", "MENU"]) {
      const w = createWorld(5, 1); loadLevel(w, 1, false);
      check("createWorld starts with nextSeed null", w.nextSeed === null);
      const b0 = bricks(w);
      w.state = st; w.fireEdge = false; step(w, CFG.STEP, fire);
      check("a " + st + " fire with nextSeed null replays the same seed and board (replays / lockstep unchanged)",
        w.state === "PLAY" && w.seed === 5 && bricks(w) === b0, w.seed);
      w.nextSeed = 99; w.state = st; w.fireEdge = false; step(w, CFG.STEP, fire);
      check("a " + st + " fire with nextSeed armed plays it, clears it, and deals that board",
        w.state === "PLAY" && w.seed === 99 && w.nextSeed === null && bricks(w) !== b0, w.seed + "/" + w.nextSeed);
    }
  }

  // ---- 3. ordinary runs: every start a new board ----
  {
    const g = menu();
    const a = play(g); quit(g);
    const b = play(g);
    check("with opts.seed set, run 0 plays opts.seed", a.seed === 42, a.seed);
    check("two consecutive PLAY runs of room 1 deal different bricks", a.b !== b.b && b.seed === runSeed(42, 1), a.seed + " -> " + b.seed);
    check("gen 1 walls never change between runs", a.w === b.w);
    check("the next GAME OVER restart is already armed while the run plays", g.world.nextSeed === runSeed(42, 2), g.world.nextSeed);
  }
  {
    const g = menu();
    const a = play(g), b = gameOver(g);
    check("a GAME OVER restart (LOSE + Enter, the sim's startGame) deals a new board",
      g.world.state === "PLAY" && g.world.level === 1 && b.seed === runSeed(42, 1) && a.b !== b.b, a.seed + " -> " + b.seed);
    check("and main re-arms the next restart off the sim's consumption", g.world.nextSeed === runSeed(42, 2), g.world.nextSeed);
  }
  {
    const g = menu();
    const a = play(g), b = restart(g);
    check("a PAUSE RESTART deals a new board", g.world.state === "PLAY" && b.seed === runSeed(42, 1) && a.b !== b.b, a.seed + " -> " + b.seed);
  }
  {
    const g = menu();
    const a = play(g), b = restart(g), c = gameOver(g);
    check("PLAY, PAUSE RESTART, GAME OVER deal three distinct boards",
      new Set([a.b, b.b, c.b]).size === 3 && [a.seed, b.seed, c.seed].join() === [0, 1, 2].map((i) => runSeed(42, i)).join(),
      [a.seed, b.seed, c.seed].join(" -> "));
    const h = menu();
    const x = play(h), y = gameOver(h), z = restart(h);
    check("PLAY, GAME OVER, PAUSE RESTART deal three distinct boards",
      new Set([x.b, y.b, z.b]).size === 3 && [x.seed, y.seed, z.seed].join() === [0, 1, 2].map((i) => runSeed(42, i)).join(),
      [x.seed, y.seed, z.seed].join(" -> "));
  }
  {
    const g = menu();
    const a = play(g);
    g.tick(140); // past the spawn i-frames
    const p = g.world.players[0], e = g.world.enemies.find((q) => !q.dead);
    const lives = g.world.lives, grid0 = g.world.grid;
    e.x = p.x; e.y = p.y; p.iFrames = 0; p.shield = false;
    let n = 0; while (g.world.lives === lives && n++ < 30) g.tick();
    check("losing a life keeps the board (same seed, same grid object, still PLAY)",
      g.world.lives === lives - 1 && g.world.state === "PLAY" && g.world.seed === a.seed && g.world.grid === grid0 && bricks(g.world) === a.b && g.world.nextSeed === runSeed(42, 1),
      lives + " -> " + g.world.lives + " / " + g.world.state);
  }
  {
    const g = menu();
    play(g); g.tick(5); g.world.state = "LOSE"; g.tick(3);
    press(g, "Enter"); g.tick(5); // run 1: a random board, not the boot seed
    g.world.state = "LOSE"; g.tick(3);
    clip.length = 0; press(g, "KeyB"); await flush();
    const c = decodeChallenge((clip[0] || "").split("code=")[1] || "");
    check("WIN/LOSE B copies the random board just played", !!c && c.seed === g.world.seed && g.world.seed === runSeed(42, 1),
      clip[0] + " / " + g.world.seed);
  }

  // ---- 4. fixed boards: DAILY and ?code= replay theirs, never touch the index ----
  {
    const g = menu();
    const a = daily(g);
    check("a DAILY run plays today's daily board", a.seed === dailySeed(local) && g.world.nextSeed === null, a.seed);
    const b = gameOver(g), c = restart(g), d = gameOver(g);
    check("DAILY: GAME OVER and PAUSE RESTART replay the same board",
      [b, c, d].every((x) => x.seed === a.seed && x.b === a.b), [a.seed, b.seed, c.seed, d.seed].join(" -> "));
    check("and the daily stays a daily (the overlay still reads the run's daily date)",
      g.ro && g.ro.run && g.ro.run.daily === local, g.ro && g.ro.run && g.ro.run.daily);
  }
  {
    const g = menu();
    play(g); quit(g); // an ordinary run leaves a seed armed
    const a = daily(g), b = gameOver(g);
    check("a DAILY started after an ordinary run disarms its seed: GAME OVER replays the daily",
      a.seed === dailySeed(local) && b.seed === a.seed && b.b === a.b, a.seed + " -> " + b.seed);
  }
  {
    const code = encodeChallenge({ seed: 555, heat: 1, pact: 0, pace: 0 });
    globalThis.location = { search: "?code=" + code, reload: noop };
    for (const k in L) delete L[k];
    for (const k in mem) delete mem[k];
    const g = createGame(null, { seed: 42 });
    globalThis.location = { search: "", reload: noop };
    g.t = 0; g.tick = (n = 1) => { for (let i = 0; i < n; i++) { g.t += 1000 / 60; g.loop(g.t); } };
    g.tick(3);
    const a = board(g);
    const b = gameOver(g), c = restart(g), d = gameOver(g);
    check("a ?code= run plays the code's board", g.app.screen === SCREEN.GAME && a.seed === 555, a.seed);
    check("?code=: GAME OVER and PAUSE RESTART replay the same board",
      [b, c, d].every((x) => x.seed === 555 && x.b === a.b), [a.seed, b.seed, c.seed, d.seed].join(" -> "));
    quit(g);
    const e = play(g);
    check("the first ordinary run after a code run is run 0 (the code never advanced the index)", e.seed === runSeed(42, 0), e.seed);
  }
  {
    const g = menu();
    const k0 = play(g); quit(g);
    const k1 = play(g); quit(g);
    const dl = daily(g); quit(g);
    const k2 = play(g); quit(g);
    g.app.cursor = ITEMS.indexOf("LEVEL SELECT"); press(g, "Enter"); press(g, "Enter");
    const k3 = board(g);
    check("ordinary runs k and k+1 that bracket a DAILY get runSeed(boot, k) and runSeed(boot, k+1)",
      k0.seed === runSeed(42, 0) && k1.seed === runSeed(42, 1) && dl.seed === dailySeed(local) &&
        k2.seed === runSeed(42, 2) && k3.seed === runSeed(42, 3) && g.app.screen === SCREEN.GAME,
      [k0.seed, k1.seed, dl.seed, k2.seed, k3.seed].join(" -> "));
  }
  {
    const g = menu();
    play(g); quit(g);
    let n = 0; while (g.app.screen !== SCREEN.ATTRACT && n++ < IDLE_T * 70) g.tick();
    const att = g.app.screen === SCREEN.ATTRACT;
    press(g, "KeyA");
    check("a run started from ATTRACT is an ordinary start: the next run seed, the one after armed",
      att && g.app.screen === SCREEN.GAME && g.world.seed === runSeed(42, 1) && g.world.nextSeed === runSeed(42, 2),
      att + "/" + g.app.screen + "/" + g.world.seed);
  }
} finally {
  delete globalThis.window;
  delete globalThis.location;
  if (navDesc) Object.defineProperty(globalThis, "navigator", navDesc);
  else delete globalThis.navigator;
}

console.log(`\n  RUNSEED RESULT: ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
