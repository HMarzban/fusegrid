/* ?net=local — the local two-world harness follows the real run. Driven
   through the REAL createGame (keys and loop): B derives every board itself
   from A's seed / gen / heat / pact / pace, and the full state hash of the two
   worlds stays equal on every tick across a new run, a PAUSE, a PAUSE RESTART,
   a room change and the GAME OVER restart. A local proof, never netplay. */
import { createGame } from "../src/main.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { PAUSE_ITEMS, SCREEN } from "../src/app/menuapp.js";
import { runSeed } from "../src/core/rng.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { createLocalPair } from "../src/net/localpair.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const noop = () => {};
const L = {}, mem = {};
globalThis.window = {
  addEventListener: (ty, fn) => { (L[ty] = L[ty] || []).push(fn); },
  removeEventListener: noop, innerWidth: 1440, innerHeight: 900,
  localStorage: { getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
  open: noop,
};
globalThis.location = { search: "", reload: noop };

/* FNV-1a over the whole world but `events`, which A's renderer drains and B
   has no renderer to drain. Nothing is picked by hand, so nothing can hide. */
function stateHash(w) {
  const s = JSON.stringify(w, (k, v) => (k === "events" ? undefined : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mk(o = {}) {
  for (const k in L) delete L[k];
  const g = createGame(null, { seed: 42, netLocal: true, createPixelRenderer, ...o });
  g.t = 0;
  g.tick = (n = 1) => { for (let i = 0; i < n; i++) { g.t += 1000 / 60; g.loop(g.t); } };
  g.tick();
  return g;
}
const down = (code) => (L.keydown || []).forEach((f) => f({ code, key: code, repeat: false, preventDefault: noop }));
const up = (code) => (L.keyup || []).forEach((f) => f({ code, key: code, preventDefault: noop }));
const press = (g, code, hold = 3) => { down(code); g.tick(hold); up(code); g.tick(2); };
const menu = (o) => { const g = mk(o); press(g, "KeyA"); g.tick(15); press(g, "Enter"); return g; };
const toRow = (g, i) => { for (let k = 0; k < i; k++) press(g, "ArrowDown"); };
/* Ticks n frames, comparing the hashes on every one. */
function mirrored(g, name, n = 90) {
  const a = g.world, b = g.net.wB, t0 = a.tick;
  let bad = 0, first = -1;
  for (let i = 0; i < n; i++) {
    g.tick();
    if (stateHash(a) !== stateHash(b)) { bad++; if (first < 0) first = i; }
  }
  check(name + ": A and B hash equal on all " + n + " frames", bad === 0 && a.tick > t0, "bad " + bad + " first " + first + " ticks " + (a.tick - t0));
}
const both = (g, f) => { f(g.world); f(g.net.wB); };

// ---- the hash can see a divergence, or every check below proves nothing ----
{
  const w = createWorld(7, 1); loadLevel(w, 1, false); w.state = "PLAY";
  const stub = { intent: () => ({ move: { x: 0, y: 0 }, fire: false, shift: false, remote: false }), advance() {} };
  const pair = createLocalPair(w, stub);
  for (let i = 0; i < 30; i++) pair.drive();
  check("stateHash: equal once built and driven", stateHash(w) === stateHash(pair.wB));
  pair.wB.rng.state ^= 1;
  check("stateHash: a one-bit rng change moves it", stateHash(w) !== stateHash(pair.wB));
  pair.wB.rng.state ^= 1;
  pair.wB.enemies[0].x += 1;
  check("stateHash: one foe moved by a unit moves it", stateHash(w) !== stateHash(pair.wB));
}

// ---- a new run, PAUSE, PAUSE RESTART, a room, GAME OVER ----
{
  const g = menu();
  const a = g.world, b = g.net.wB;
  press(g, "Enter");
  check("PLAY start: A is on gen 2, run 0's seed", g.app.screen === SCREEN.GAME && a.gen === 2 && a.seed === runSeed(42, 0), a.gen + "/" + a.seed);
  check("PLAY start: B follows gen, seed and deals the board itself", b.gen === 2 && b.seed === a.seed && b.grid !== a.grid && b.grid.join() === a.grid.join(), b.gen + "/" + b.seed);
  down("KeyD"); down("Space"); mirrored(g, "new run, walking and planting"); up("KeyD"); up("Space");
  g.tick(2);

  press(g, "Escape");
  check("PAUSE: B pauses with A", a.state === "PAUSE" && b.state === "PAUSE", a.state + "/" + b.state);
  mirrored(g, "PAUSE", 20);
  press(g, "Escape");
  check("PAUSE -> PLAY: B resumes with A", a.state === "PLAY" && b.state === "PLAY", a.state + "/" + b.state);
  mirrored(g, "after RESUME", 30);

  const s0 = a.seed;
  press(g, "Escape"); toRow(g, PAUSE_ITEMS.indexOf("RESTART")); press(g, "Enter"); g.tick();
  check("PAUSE RESTART: A deals the next board, B follows", a.seed !== s0 && a.seed === runSeed(42, 1) && b.seed === a.seed && a.state === "PLAY", s0 + " -> " + a.seed + "/" + b.seed);
  down("KeyS"); down("Space"); mirrored(g, "PAUSE RESTART"); up("KeyS"); up("Space");

  both(g, (w) => w.enemies.forEach((e) => { e.dead = true; }));
  g.tick(150);
  check("room clear: both WIN", a.state === "WIN" && b.state === "WIN", a.state + "/" + b.state);
  press(g, "Space"); g.tick();
  check("next room: both on room 2 with no new seed", a.level === 2 && b.level === 2 && a.state === "PLAY" && a.seed === runSeed(42, 1), a.level + "/" + b.level);
  mirrored(g, "next room");

  const s1 = a.seed;
  both(g, (w) => { w.lives = 1; w.players[0].iFrames = 0; });
  press(g, "Space");
  for (let i = 0; i < 400 && a.state === "PLAY"; i++) g.tick();
  check("the bomb at their feet is GAME OVER in both", a.state === "LOSE" && b.state === "LOSE", a.state + "/" + b.state);
  g.tick(30);
  check("LOSE: the next board is armed in both", a.nextSeed === runSeed(42, 2) && b.nextSeed === a.nextSeed, a.nextSeed + "/" + b.nextSeed);
  press(g, "Space"); g.tick();
  check("GAME OVER restart: both deal the armed seed on room 1", a.seed !== s1 && a.seed === runSeed(42, 2) && b.seed === a.seed && a.level === 1 && b.level === 1 && a.state === "PLAY", a.seed + "/" + b.seed);
  mirrored(g, "GAME OVER restart");

  press(g, "Escape"); press(g, "KeyM");
  check("M from PAUSE: back on MENU", g.app.screen === SCREEN.MENU, g.app.screen);
  const t0 = a.tick; g.tick(10);
  check("MENU: neither world steps", a.tick === t0 && b.tick === t0, a.tick + "/" + b.tick);
  g.app.heat = 2; g.app.pace = 1;
  press(g, "Enter"); g.tick();
  check("a later PLAY start copies heat and pace too", a.heat === 2 && b.heat === 2 && a.pace === 1 && b.pace === 1 && b.seed === a.seed, [a.heat, b.heat, a.pace, b.pace].join());
  mirrored(g, "MAX HARD run");
}

// ---- a finale WIN drops to MENU; the next PLAY start deals the next board ----
{
  const g = menu();
  const a = g.world, b = g.net.wB;
  press(g, "Enter"); g.tick(5);
  both(g, (w) => { w.level = 5; w.enemies.forEach((e) => { e.dead = true; }); });
  g.tick(150);
  check("finale clear: both WIN", a.state === "WIN" && b.state === "WIN", a.state + "/" + b.state);
  const s = a.seed;
  press(g, "Space"); g.tick();
  check("finale: back on MENU", g.app.screen === SCREEN.MENU, g.app.screen);
  press(g, "Enter"); g.tick();
  check("the next PLAY start: a new board on room 1, B follows", a.seed !== s && b.seed === a.seed && a.level === 1 && b.level === 1 && a.state === "PLAY", s + " -> " + a.seed + "/" + b.seed);
  mirrored(g, "after the finale");
}

// ---- a fixed board and the tile preview boards ----
{
  const g = menu();
  const a = g.world, b = g.net.wB;
  toRow(g, 2); press(g, "Enter"); g.tick();
  const s = a.seed;
  check("DAILY: B on the daily's seed and generation", g.app.screen === SCREEN.GAME && b.seed === s && b.gen === a.gen && a.nextSeed === null && b.nextSeed === null, s + "/" + b.seed);
  mirrored(g, "DAILY", 40);
  press(g, "Escape"); toRow(g, PAUSE_ITEMS.indexOf("RESTART")); press(g, "Enter"); g.tick();
  check("DAILY RESTART: the same board in both", a.seed === s && b.seed === s);
  mirrored(g, "DAILY RESTART", 40);
}
{
  location.search = "?gen=3";
  const g = menu();
  location.search = "";
  const a = g.world, b = g.net.wB;
  check("?gen=3 boot: B starts on A's generation", a.gen === 3 && b.gen === 3, a.gen + "/" + b.gen);
  press(g, "Enter"); g.tick();
  check("?gen=3 run: B carries the tile layer", a.gen === 3 && b.gen === 3 && !!b.feat === !!a.feat, a.gen + "/" + b.gen);
  mirrored(g, "gen 3", 60);
}

// ---- default play has no pair at all ----
{
  const g = menu({ netLocal: false });
  check("no ?net=local: no mirror world exists", g.net === null);
  press(g, "Enter"); g.tick(5);
  check("no ?net=local: the run steps", g.world.tick > 0 && g.world.state === "PLAY", g.world.tick);
}

delete globalThis.window; delete globalThis.location;
console.log(fail ? "NET-LOCAL FAIL " + fail + "/" + (pass + fail) : "NET-LOCAL OK " + pass);
process.exit(fail ? 1 : 0);
