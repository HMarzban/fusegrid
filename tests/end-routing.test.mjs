/* UI upgrade v202 Task 5.2: end-screen routing (R19). Through the real createGame: Enter keeps today's run-end actions (a GAME OVER deals a new board
   at level 1, a DAILY or ?code= run replays its board, a finale WIN goes to MENU, a mid-run WIN goes on), Esc and the controller's EAST go to MENU at a
   run end and only there, a tap acts through endgeom's keys (main / menu / copy / map, on its pointerup), and the NEW VERSION card's predicate is
   unchanged. Plus endgeom's pure contract: endMode, the key rects inside the plate inside the box, endHit on every key centre. */
import { createGame } from "../src/main.js";
import "../src/core/board3.js";
import { SCREEN, ITEMS } from "../src/app/menuapp.js";
import { encodeChallenge } from "../src/app/code.js";
import { updVisible } from "../src/app/update.js";
import { isRunEnd, overlayBox, endHitAt } from "../src/render/scenes.js";
import { endMode, endFacts, endGeom, endHit, KEYS } from "../src/render/pages/endgeom.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const noop = () => {}, J = (v) => JSON.stringify(v);
const L = {}, mem = {};
globalThis.window = { addEventListener: (ty, fn) => { (L[ty] = L[ty] || []).push(fn); }, removeEventListener: noop, innerWidth: 1440, innerHeight: 900,
  localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } } };
globalThis.location = { search: "", reload: noop };

/* a fake #c (600 x 520 buffer at 1 CSS px a unit) whose pointer listeners the test fires */
function mkCv() {
  const PL = {}, ctx = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : () => ctx), apply: () => ctx, set: () => true });
  const el = { width: 600, height: 520, style: {}, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 520 }),
    addEventListener: (ty, fn) => { (PL[ty] = PL[ty] || []).push(fn); }, removeEventListener: noop };
  el.tap = (g, x, y, up = true) => { (PL.pointerdown || []).forEach((f) => f({ clientX: x, clientY: y, button: 0, pointerType: "mouse" })); if (up) (PL.pointerup || []).forEach((f) => f({ clientX: x, clientY: y, button: 0, pointerType: "mouse" })); g.tick(3); };
  return el;
}
function mk(cv = null, search = "") {
  for (const k in L) delete L[k];
  globalThis.location.search = search;
  const g = createGame(cv, { seed: 42 });
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
const menu = (cv) => { const g = mk(cv); press(g, "KeyA"); g.tick(15); press(g, "Enter"); return g; };
const toRow = (g, i) => { for (let k = 0; k < i; k++) press(g, "ArrowDown"); };
const run = (cv) => { const g = menu(cv); press(g, "Enter"); return g; };
const lose = (g) => { g.tick(5); g.world.state = "LOSE"; g.tick(3); return g; };
const clearRoom = (g) => { g.world.enemies.forEach((e) => { e.dead = true; }); g.tick(150); };
const finale = (cv) => { const g = menu(cv); toRow(g, ITEMS.indexOf("LEVEL SELECT")); press(g, "Enter"); for (let i = 0; i < 4; i++) press(g, "ArrowRight"); press(g, "Enter"); clearRoom(g); return g; };

// ---- Enter keeps today's run-end actions ----
for (const code of ["Enter", "Space"]) {
  const g = lose(run()), seed = g.world.seed, next = g.world.nextSeed;
  press(g, code); g.tick(10);
  check("LOSE (ordinary) + " + code + " -> level 1 on a new board (the armed next seed)", g.world.state === "PLAY" && g.world.level === 1 && g.world.seed !== seed && g.world.seed === next >>> 0, g.world.seed + " vs " + seed);
}
{
  const g = menu(); toRow(g, ITEMS.indexOf("DAILY")); press(g, "Enter"); lose(g);
  const seed = g.world.seed;
  press(g, "Enter"); g.tick(10);
  check("LOSE (DAILY) + Enter -> level 1 on the same board", g.world.state === "PLAY" && g.world.level === 1 && g.world.seed === seed, g.world.seed + " vs " + seed);
}
{
  const code = encodeChallenge({ seed: 123456, heat: 1, pact: 0, pace: 0, gen: 3 });
  const g = mk(null, "?code=" + code); g.tick(30);
  const started = g.app.screen === SCREEN.GAME && g.world.seed === 123456;
  lose(g); press(g, "Enter"); g.tick(10);
  check("LOSE (?code=) + Enter -> level 1 on the same board", started && g.world.state === "PLAY" && g.world.level === 1 && g.world.seed === 123456, started + "/" + g.world.seed);
  globalThis.location.search = "";
}
{
  const g = finale(), at5 = g.world.state === "WIN" && g.world.level === 5;
  press(g, "Enter"); g.tick(5);
  check("finale WIN + Enter -> MENU", at5 && g.app.screen === SCREEN.MENU, at5 + "/" + g.app.screen);
}
{
  const g = run(); clearRoom(g);
  const mid = g.world.state === "WIN" && g.world.level === 1;
  press(g, "Enter"); g.tick(5);
  check("mid-run WIN + Enter -> the next level", mid && g.app.screen === SCREEN.GAME && g.world.state === "PLAY" && g.world.level === 2, g.world.state + "/" + g.world.level);
}
// ---- Esc: MENU at a run end, nothing on a mid-run WIN ----
{
  const g = lose(run());
  press(g, "Escape"); g.tick(5);
  check("LOSE + Esc -> MENU", g.app.screen === SCREEN.MENU && g.world.state === "MENU", g.app.screen + "/" + g.world.state);
  check("LOSE + Esc: the board is gone from the overlay (isRunEnd false once on MENU)", !isRunEnd(g.world));
}
{
  const g = finale(), at5 = g.world.state === "WIN";
  press(g, "Escape"); g.tick(5);
  check("finale WIN + Esc -> MENU (the sim's MENU edge: Pact unlocked)", at5 && g.app.screen === SCREEN.MENU && g.app.pactUnlocked === true, g.app.screen);
}
{
  const g = run(); clearRoom(g);
  for (const code of ["Escape", "Backspace", "KeyM"]) press(g, code);
  g.tick(5);
  check("mid-run WIN never shows MENU: Esc, Backspace, M do nothing", g.app.screen === SCREEN.GAME && g.world.state === "WIN" && g.world.level === 1, g.app.screen + "/" + g.world.state);
}
// ---- taps: the main key advances, MENU goes to MENU, off the keys is inert (while a mode has no page, its tap is the main key everywhere) ----
{
  const cv = mkCv(), g = lose(run(cv)), B = overlayBox("2d");
  const G = endGeom(B, endFacts(g.world, g.ro.run, g.ro.time), { lay: g.ro.run.lay, css: g.ro.run.css });
  const k = G.keys.main, x = k.x + k.w / 2, y = k.y + k.h / 2;
  check("endHitAt names the main key at its centre on a live GAME OVER", endHitAt(x, y, "2d", g.world, g.ro.run, g.ro.time) === "main");
  cv.tap(g, x, y, false);
  check("a pointerdown alone does nothing (the key acts on its pointerup)", g.world.state === "LOSE", g.world.state);
  cv.tap(g, x, y); g.tick(10);
  check("a tap on TRY AGAIN starts the new run at level 1", g.world.state === "PLAY" && g.world.level === 1, g.world.state);
}
{
  const cv = mkCv(), g = run(cv); clearRoom(g);
  cv.tap(g, 300, 300); g.tick(5);
  check("mid-run WIN: a tap never reaches MENU", g.app.screen === SCREEN.GAME, g.app.screen);
}
// ---- updVisible unchanged: a run end on GAME, never PLAY / PAUSE / a mid-run WIN ----
{
  const S = SCREEN, rows = [[S.GAME, "LOSE", true, true], [S.GAME, "WIN", true, true], [S.GAME, "WIN", false, false], [S.GAME, "PLAY", false, false], [S.GAME, "PAUSE", false, false], [S.MENU, "MENU", false, true], [S.INTRO, "PLAY", false, false], [S.ATTRACT, "PLAY", false, false]];
  check("updVisible: the same table as before Task 5.2", rows.every(([s, st, re, want]) => updVisible(s, st, re, S, false) === want) && !updVisible(S.GAME, "LOSE", true, S, true));
}
// ---- endgeom: modes, keys inside the plate inside the box, every key centre hits its key ----
{
  check("endMode: LOSE lose, WIN on 5 / 8 or finale fin, any other WIN clear, else null", endMode({ state: "LOSE", level: 3 }) === "lose" && endMode({ state: "WIN", level: 5 }) === "fin" && endMode({ state: "WIN", level: 8 }) === "fin" && endMode({ state: "WIN", level: 2, finale: true }) === "fin" && endMode({ state: "WIN", level: 6 }) === "clear" && endMode({ state: "PAUSE" }) === null && endMode(null) === null);
  const run0 = { r: 4, k: 9, p: 3, t: 200, best: { s: 900, r: 3 }, fromStart: true, cap: 5, medals: [], lk: 2, lp: 1 };
  const worlds = [{ state: "LOSE", level: 4, score: 500 }, { state: "WIN", level: 5, score: 1200 }, { state: "WIN", level: 2, score: 300 }];
  for (const [kind, B] of [["2d", overlayBox("2d")], ["iso", overlayBox("iso")]]) for (const lay of ["d", "l", "p"]) for (const css of [0.63, 1, 1.38]) for (const w of worlds) {
    const G = endGeom(B, endFacts(w, run0, { t: 30, best: 40 }), { lay, css }), P = G.plate, name = kind + " " + lay + " css " + css + " " + endMode(w);
    const inBox = P.x >= 0 && P.y >= 0 && P.x + P.w <= B.w && P.y + P.h <= B.h, keys = KEYS.filter((n) => G.keys[n]);
    const inPlate = keys.every((n) => { const r = G.keys[n]; return r.x >= P.x - 0.01 && r.y >= P.y - 0.01 && r.x + r.w <= P.x + P.w + 0.01 && r.y + r.h <= P.y + P.h + 0.01; });
    const hits = keys.every((n) => { const r = G.keys[n]; return endHit(r.x + r.w / 2, r.y + r.h / 2, G) === n; });
    if (!(inBox && inPlate && hits)) check(name + ": plate in the box, keys in the plate, every key centre hits its key", false, J({ P, keys: G.keys }));
    else pass++;
  }
  const G = endGeom(overlayBox("2d"), endFacts(worlds[0], run0), { lay: "d", css: 1.38 });
  check("endHit: a tap off the keys (the plate's top corner, outside the box) names nothing", endHit(G.plate.x + 2, G.plate.y + 2, G) === null && endHit(-5, -5, G) === null);
  check("keys by mode: GAME OVER main / menu / copy / map, finale main / copy / map, level clear main only",
    J(KEYS.filter((n) => G.keys[n])) === J(["main", "menu", "copy", "map"]) &&
    J(KEYS.filter((n) => endGeom(overlayBox("2d"), endFacts(worlds[1], run0), { lay: "d", css: 1.38 }).keys[n])) === J(["main", "copy", "map"]) &&
    J(KEYS.filter((n) => endGeom(overlayBox("2d"), endFacts(worlds[2], run0), { lay: "d", css: 1.38 }).keys[n])) === J(["main"]));
}

delete globalThis.window; delete globalThis.location;
console.log(fail ? "END ROUTING FAIL " + fail + "/" + (pass + fail) : "END ROUTING OK " + pass);
process.exit(fail ? 1 : 0);
