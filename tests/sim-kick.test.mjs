import { step, createWorld, newIntent, loadLevel } from "../src/core/sim.js";
import { spawnEnemy, hurtPlayer } from "../src/core/entities.js";
import { CFG, T, key } from "../src/core/config.js";
import { tileOf, bfsNext } from "../src/core/board.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") +
      name +
      (detail !== undefined ? " -> " + detail : ""),
  );
}

function injectBomb(w, tx, ty, timer, radius) {
  w.bombs.push({
    x: tx * CFG.TILE + 20,
    y: ty * CFG.TILE + 20,
    tx,
    ty,
    timer,
    radius: radius || 1,
    pierce: false,
    line: false,
    dir: null,
    variant: "normal",
    dead: false,
  });
}
// ==================== RULES OVERHAUL: bombs are tile-solid ====================
/* Fresh PLAY world with a quiet board (no enemies/bombs/blades) for rule tests. */
function rulesWorld(seed) {
  const w = createWorld(seed || 1, 1);
  loadLevel(w, 1, false);
  w.state = "PLAY";
  w.enemies.length = 0;
  w.bombs.length = 0;
  w.blades.length = 0;
  w.items.length = 0;
  return w;
}
// ==================== RULES OVERHAUL: real sliding kick ====================
const KICK_LANE = 7; // hand-cleared corridor row used by the kick tests
function kickWorld(seed) {
  const w = rulesWorld(seed);
  // cols 2..13 open: (13,7) may be EMPTY or BRICK after pillar genBoard;
  // kickWorld already force-clears the lane to the col-14 border wall
  for (let x = 2; x <= 13; x++) w.grid[key(x, KICK_LANE)] = T.EMPTY;
  // parked far guard enemy: keeps the board "live" so the all-clear WIN
  // timer can't freeze the sim mid-slide (see demobot.test same trick)
  const far = spawnEnemy("stationary", 1, 11, 1, w.rng);
  far.invuln = false;
  far.invulnT = 0;
  w.enemies.push(far);
  return w;
}
function kickSetup(seed, kickPower) {
  const w = kickWorld(seed || 11);
  const p = w.players[0];
  p.kick = !!kickPower;
  p.x = 3.5 * CFG.TILE;
  p.y = (KICK_LANE + 0.5) * CFG.TILE;
  p.tx = 3;
  p.ty = KICK_LANE;
  injectBomb(w, 4, KICK_LANE, 99, 1);
  return w;
}

// R5) kick launches the bomb; it slides and halts before obstacles
{
  // a) slides across open tiles, halts against the border wall (col 14)
  const w = kickSetup(11, true);
  const b = w.bombs[0],
    p = w.players[0];
  const hold = { 0: { ...newIntent(), move: { x: 1, y: 0 }, kick: true } };
  let maxTx = 4;
  for (let i = 0; i < 400; i++) {
    step(w, CFG.STEP, hold);
    if (b.tx > maxTx) maxTx = b.tx;
  }
  check("R5a kick slides bomb >=3 tiles", maxTx >= 8, "maxTx=" + maxTx);
  check(
    "R5a slider halts before border wall",
    !b.dead && b.tx === 13 && !b.slide && Math.abs(b.x - 13.5 * CFG.TILE) < 1,
    "tx=" + b.tx + " x=" + b.x.toFixed(1) + " slide=" + JSON.stringify(b.slide),
  );

  // b) stops before another bomb, chain intact, fuse kept ticking
  const w2 = kickWorld(12);
  const p2 = w2.players[0];
  p2.kick = true;
  p2.x = 3.5 * CFG.TILE;
  p2.y = (KICK_LANE + 0.5) * CFG.TILE;
  p2.tx = 3;
  p2.ty = KICK_LANE;
  injectBomb(w2, 4, KICK_LANE, 99, 1);
  injectBomb(w2, 9, KICK_LANE, 99, 1);
  const hold2 = { 0: { ...newIntent(), move: { x: 1, y: 0 }, kick: true } };
  for (let i = 0; i < 400; i++) step(w2, CFG.STEP, hold2);
  const s = w2.bombs.find((bb) => bb.tx === 4 || bb.prog !== undefined);
  check(
    "R5b slider stops before another bomb",
    w2.bombs.some((bb) => bb.tx === 8 && !bb.slide) && w2.bombs.length === 2,
    JSON.stringify(w2.bombs.map((bb) => ({ tx: bb.tx, slide: !!bb.slide }))),
  );
  // fuse intact -> detonates on timer and chains the parked bomb
  const sl = w2.bombs.find((bb) => bb.tx === 8);
  if (sl) sl.timer = 0.01;
  for (let i = 0; i < 10; i++) step(w2, CFG.STEP, { 0: newIntent() });
  check(
    "R5b slider detonates + chains parked bomb",
    w2.bombs.length === 0,
    "bombs left " + w2.bombs.length,
  );

  // c) stops before an enemy tile; enemy untouched by the stop itself
  const w3 = kickWorld(13);
  const en = spawnEnemy("walker", 9, KICK_LANE, 1, w3.rng);
  en.invuln = false;
  en.invulnT = 0;
  en.cd = 99999;
  en.speed = 0;
  en.home = { x: 9, y: KICK_LANE };
  w3.enemies.push(en);
  const p3 = w3.players[0];
  p3.kick = true;
  p3.x = 3.5 * CFG.TILE;
  p3.y = (KICK_LANE + 0.5) * CFG.TILE;
  p3.tx = 3;
  p3.ty = KICK_LANE;
  injectBomb(w3, 4, KICK_LANE, 99, 1);
  const hold3 = { 0: { ...newIntent(), move: { x: 1, y: 0 }, kick: true } };
  for (let i = 0; i < 400; i++) step(w3, CFG.STEP, hold3);
  check(
    "R5c slider stops before enemy tile",
    w3.bombs.some((bb) => bb.tx === 8 && !bb.slide) && en.tx === 9 && !en.dead,
    "bomb " + w3.bombs.map((bb) => bb.tx) + " enemy " + en.tx,
  );

  // d) fuse ticks during the slide
  const w4 = kickSetup(14, true);
  const b4 = w4.bombs[0];
  const t0 = b4.timer;
  const hold4 = { 0: { ...newIntent(), move: { x: 1, y: 0 }, kick: true } };
  for (let i = 0; i < 20; i++) step(w4, CFG.STEP, hold4);
  check(
    "R5d fuse ticks while sliding",
    b4.timer < t0 && b4.timer > 0 && !b4.dead,
    t0.toFixed(2) + " -> " + b4.timer.toFixed(2),
  );
}

// R6) without the kick power nothing launches
{
  const w = kickSetup(15, false);
  const b = w.bombs[0];
  const hold = { 0: { ...newIntent(), move: { x: 1, y: 0 }, kick: true } };
  for (let i = 0; i < 120; i++) step(w, CFG.STEP, hold);
  check(
    "R6 no kick power => bomb never launches",
    b.tx === 4 && b.ty === KICK_LANE && !b.slide,
    "tx=" + b.tx + " slide=" + JSON.stringify(b.slide),
  );
}

// R7) kick no longer breaks bricks (old power removed)
{
  const w = rulesWorld(16);
  const p = w.players[0];
  p.kick = true;
  p.x = 2.5 * CFG.TILE;
  p.y = 1.5 * CFG.TILE;
  p.tx = 2;
  p.ty = 1;
  w.grid[key(3, 1)] = T.BRICK;
  const hold = { 0: { ...newIntent(), move: { x: 1, y: 0 }, kick: true } };
  for (let i = 0; i < 40; i++) step(w, CFG.STEP, hold);
  check(
    "R7 kick leaves bricks intact (brick-break kick removed)",
    w.grid[key(3, 1)] === T.BRICK,
    "grid=" + w.grid[key(3, 1)],
  );
}

// ==================== RULES OVERHAUL: chaser BFS routes around bombs ====================
{
  // fully open room rows 4..8 x cols 3..11: the bomb parked mid-lane at
  // (7,6) between chaser (4,6) and player (10,6) is the ONLY obstacle, so
  // any progress past column 7 must come from routing around its tile
  const w = rulesWorld(21);
  for (let y = 4; y <= 8; y++)
    for (let x = 3; x <= 11; x++) w.grid[key(x, y)] = T.EMPTY;
  const ch = spawnEnemy("chaser", 4, 6, 1, w.rng);
  ch.invuln = false;
  ch.invulnT = 0;
  ch.cd = 0.001;
  ch.dir = { x: 1, y: 0 };
  w.enemies.push(ch);
  injectBomb(w, 7, 6, 99, 1);
  const p = w.players[0];
  p.x = 10.5 * CFG.TILE;
  p.y = 6.5 * CFG.TILE;
  p.tx = 10;
  p.ty = 6;
  p.iFrames = 99999;
  let onBomb = false,
    past = false;
  for (let i = 0; i < 480; i++) {
    ch.cd = Math.min(ch.cd, 0.02); // test-side: force BFS re-decision every tick
    step(w, CFG.STEP, { 0: newIntent() });
    if (ch.tx === 7 && ch.ty === 6) onBomb = true;
    if (ch.tx >= 9 && ch.ty === 6) past = true;
  }
  check(
    "R8a chaser never enters bomb tile",
    !onBomb,
    "final " + ch.tx + "," + ch.ty + " dir " + JSON.stringify(ch.dir),
  );
  check(
    "R8b chaser BFS detours around bomb",
    past,
    "final " + ch.tx + "," + ch.ty + " dir " + JSON.stringify(ch.dir),
  );
}

// R9) board-level BFS unit: from the tile beside the bomb, the route must
// not step INTO the blocked bomb tile when a detour exists
{
  const w = rulesWorld(21);
  for (let y = 4; y <= 8; y++)
    for (let x = 3; x <= 11; x++) w.grid[key(x, y)] = T.EMPTY;
  const blocked = new Set([key(7, 6)]);
  const n = bfsNext(w.grid, 6, 6, 10, 6, false, blocked);
  check(
    "R9 bfsNext(blocked) detours off bomb tile",
    n !== null && !(n.x === 7 && n.y === 6),
    n ? "next " + n.x + "," + n.y : "null",
  );
}

// ==================== SIM RULES V4: center blast, chain after hit, fireEdge ====
{
  const w = rulesWorld();
  const p = w.players[0];
  p.iFrames = 0;
  p.shield = false;
  const lives0 = w.lives;
  injectBomb(w, tileOf(p.x), tileOf(p.y), 0, 1);
  step(w, CFG.STEP, { 0: newIntent() });
  check(
    "R10 stand on own bomb takes damage",
    w.lives < lives0 || p.iFrames > 0 || w.state === "LOSE",
    "lives " + w.lives + " iFrames " + p.iFrames + " state " + w.state,
  );
}

{
  const w = rulesWorld();
  const p = w.players[0];
  w.lives = 1;
  p.iFrames = 0;
  p.shield = false;
  p.x = 1.5 * CFG.TILE;
  p.y = 1.5 * CFG.TILE;
  p.tx = 1;
  p.ty = 1;
  for (let x = 1; x <= 4; x++) w.grid[key(x, 1)] = T.EMPTY;
  injectBomb(w, 1, 1, 0, 2);
  injectBomb(w, 3, 1, 99, 1);
  const b2 = w.bombs[1];
  step(w, CFG.STEP, { 0: newIntent() });
  check(
    "R11 lethal blast still chains second bomb",
    (w.state === "LOSE" || w.lives === 0) && b2.dead === true,
    "b2.dead=" + b2.dead + " lives=" + w.lives + " state=" + w.state,
  );
}

{
  const w = rulesWorld();
  const p = w.players[0];
  w.lives = 1;
  p.iFrames = 0;
  p.shield = false;
  p.x = 1.5 * CFG.TILE;
  p.y = 1.5 * CFG.TILE;
  const e1 = spawnEnemy("stationary", 1, 1, 1, w.rng);
  const e2 = spawnEnemy("stationary", 1, 1, 1, w.rng);
  e1.invuln = false;
  e1.invulnT = 0;
  e1.speed = 0;
  e1.x = p.x;
  e1.y = p.y;
  e2.invuln = false;
  e2.invulnT = 0;
  e2.speed = 0;
  e2.x = p.x;
  e2.y = p.y;
  w.enemies.push(e1, e2);
  step(w, CFG.STEP, { 0: newIntent() });
  step(w, CFG.STEP, { 0: newIntent() });
  const loses = w.events.filter((e) => e.t === "lose").length;
  check(
    "R12 LOSE then overlap does not double-hurt",
    w.lives === 0 && loses === 1,
    "lives=" + w.lives + " loseEvents=" + loses + " state=" + w.state,
  );
}

{
  const w = rulesWorld();
  const p = w.players[0];
  p.throw = true;
  p.face = { x: 1, y: 0 };
  p.x = 1.5 * CFG.TILE;
  p.y = 1.5 * CFG.TILE;
  p.tx = 1;
  p.ty = 1;
  w.grid[key(2, 1)] = T.EMPTY;
  const en = spawnEnemy("walker", 2, 1, 1, w.rng);
  en.invuln = false;
  en.invulnT = 0;
  en.dead = false;
  w.enemies.push(en);
  step(w, CFG.STEP, {
    0: { ...newIntent(), fire: true, firePrev: false, shift: true },
  });
  check(
    "R13 throw onto live enemy tile refused",
    w.bombs.length === 0,
    "bombs=" + w.bombs.length + " enemy " + en.tx + "," + en.ty,
  );
}

{
  const w = rulesWorld();
  const p = w.players[0];
  p.bombs = 8;
  p.x = 1.5 * CFG.TILE;
  p.y = 1.5 * CFG.TILE;
  p.tx = 1;
  p.ty = 1;
  w.grid[key(1, 1)] = T.EMPTY;
  w.grid[key(3, 1)] = T.EMPTY;
  const lock = {
    0: {
      move: { x: 0, y: 0 },
      fire: true,
      shift: false,
      remote: false,
      kick: false,
    },
  };
  step(w, CFG.STEP, lock);
  p.x = 3.5 * CFG.TILE;
  p.tx = 3;
  step(w, CFG.STEP, lock);
  check(
    "R14 lockstep fire without firePrev places exactly one",
    w.bombs.length === 1,
    "bombs=" + w.bombs.length,
  );
}

{
  const w = rulesWorld();
  w.lives = 3;
  injectBomb(w, 5, 5, 2.0, 1);
  w.blades.push({ tx: 4, ty: 5, ttl: 0.2, dead: false });
  const nB = w.bombs.length,
    nF = w.blades.length,
    bomb = w.bombs[0];
  const lost = hurtPlayer(w);
  check(
    "R15 survive keeps live bombs (COULD 7)",
    lost === false &&
      w.lives === 2 &&
      w.bombs.length === nB &&
      w.bombs[0] === bomb,
    "lost=" + lost + " lives=" + w.lives + " bombs=" + w.bombs.length,
  );
  check(
    "R15 survive keeps live blades (COULD 7)",
    w.blades.length === nF,
    "blades=" + w.blades.length,
  );
}

{
  const w = createWorld(1, 1);
  loadLevel(w, 1, false);
  check(
    "genBoard border is WALL",
    w.grid[key(0, 0)] === T.WALL &&
      w.grid[key(CFG.COLS - 1, 0)] === T.WALL &&
      w.grid[key(0, CFG.ROWS - 1)] === T.WALL &&
      w.grid[key(CFG.COLS - 1, CFG.ROWS - 1)] === T.WALL,
  );
  check("genBoard (1,1) spawn EMPTY", w.grid[key(1, 1)] === T.EMPTY);
  check(
    "genBoard interior even/even is WALL",
    w.grid[key(2, 2)] === T.WALL,
    "grid(2,2)=" + w.grid[key(2, 2)],
  );
}

{
  const w = createWorld(1, 1);
  loadLevel(w, 1, false);
  const types = w.enemies.map((e) => e.type);
  const banned = types.some(
    (t) =>
      t === "fast" || t === "chaser" || t === "rocket" || t === "boomerang",
  );
  check(
    "L1 roster has no fast/chaser/rocket/boomerang",
    !banned && types.includes("walker") && types.includes("stationary"),
    types.join(","),
  );
}

{
  const w = createWorld(1, 1);
  loadLevel(w, 1, false);
  w.state = "PLAY";
  const p = w.players[0];
  p.iFrames = 999;
  p.shield = false;
  w.grid[key(2, 1)] = T.BRICK;
  const bombs0 = p.bombs;
  const it = {
    x: 2.5 * CFG.TILE,
    y: 1.5 * CFG.TILE,
    t: "bomb",
    col: "#fff",
    pdef: { t: "bomb", apply: (ww, pl) => pl.bombs++ },
    taken: false,
    buried: true,
  };
  w.items.push(it);
  w.bombs.push({
    x: p.x,
    y: p.y,
    tx: 1,
    ty: 1,
    timer: 0.01,
    radius: 2,
    pierce: false,
    line: false,
    dir: null,
    variant: "normal",
    dead: false,
  });
  step(w, CFG.STEP, { 0: newIntent() });
  check(
    "revealItem leaves item on floor",
    it.taken === false && it.buried === false && p.bombs === bombs0,
    "taken=" + it.taken + " buried=" + it.buried + " bombs=" + p.bombs,
  );
  p.x = it.x;
  p.y = it.y;
  step(w, CFG.STEP, { 0: newIntent() });
  check(
    "walk onto revealed item applies",
    it.taken === true && p.bombs === bombs0 + 1,
    "taken=" + it.taken + " bombs=" + p.bombs,
  );
}

{
  const w = createWorld(1, 1);
  loadLevel(w, 1, false);
  w.state = "PLAY";
  const p = w.players[0];
  p.passing = true;
  p.iFrames = 999;
  w.grid[key(2, 1)] = T.BRICK;
  const hold = { 0: { ...newIntent(), move: { x: 1, y: 0 } } };
  for (let i = 0; i < 40; i++) step(w, CFG.STEP, hold);
  check(
    "pass does not clear BRICK",
    w.grid[key(2, 1)] === T.BRICK,
    "grid=" + w.grid[key(2, 1)] + " tx=" + tileOf(p.x),
  );
}

{
  const w = createWorld(1, 1);
  loadLevel(w, 1, false);
  w.state = "PLAY";
  const p = w.players[0];
  w.enemies.length = 0;
  p.iFrames = 999;
  for (let i = 1; i <= 5; i++) w.grid[key(1 + i, 1)] = T.BRICK;
  const enemy = {
    type: "walker",
    x: 6 * CFG.TILE + CFG.TILE / 2,
    y: 1 * CFG.TILE + CFG.TILE / 2,
    tx: 6,
    ty: 1,
    dir: { x: 1, y: 0 },
    speed: 0,
    r: 13,
    color: "#fff",
    dead: false,
    invuln: false,
    invulnT: 0,
    cd: 999,
    home: { x: 6, y: 1 },
    pass: false,
  };
  w.enemies.push(enemy);
  w.bombs.push({
    x: p.x,
    y: p.y,
    tx: tileOf(p.x),
    ty: tileOf(p.y),
    timer: 0.01,
    radius: 5,
    pierce: false,
    line: true,
    dir: { x: 1, y: 0 },
    variant: "line",
    dead: false,
  });
  for (let i = 0; i < 10; i++) step(w, CFG.STEP, { 0: newIntent() });
  check(
    "line kills through bricks AND bricks EMPTY",
    enemy.dead === true &&
      w.grid[key(2, 1)] === T.EMPTY &&
      w.grid[key(3, 1)] === T.EMPTY,
    "dead=" +
      enemy.dead +
      " g2=" +
      w.grid[key(2, 1)] +
      " g3=" +
      w.grid[key(3, 1)],
  );
}

{
  const w = createWorld(1, 1);
  loadLevel(w, 1, false);
  w.state = "PLAY";
  const p = w.players[0];
  w.enemies.length = 0;
  p.iFrames = 999;
  for (let i = 1; i <= 5; i++) w.grid[key(1 + i, 1)] = T.BRICK;
  const enemy = {
    type: "walker",
    x: 6 * CFG.TILE + CFG.TILE / 2,
    y: 1 * CFG.TILE + CFG.TILE / 2,
    tx: 6,
    ty: 1,
    dir: { x: 1, y: 0 },
    speed: 0,
    r: 13,
    color: "#fff",
    dead: false,
    invuln: false,
    invulnT: 0,
    cd: 999,
    home: { x: 6, y: 1 },
    pass: false,
  };
  w.enemies.push(enemy);
  w.bombs.push({
    x: p.x,
    y: p.y,
    tx: tileOf(p.x),
    ty: tileOf(p.y),
    timer: 0.01,
    radius: 5,
    pierce: true,
    line: false,
    dir: null,
    variant: "pierce",
    dead: false,
  });
  for (let i = 0; i < 10; i++) step(w, CFG.STEP, { 0: newIntent() });
  check(
    "pierce kills through bricks AND bricks EMPTY",
    enemy.dead === true &&
      w.grid[key(2, 1)] === T.EMPTY &&
      w.grid[key(3, 1)] === T.EMPTY,
    "dead=" +
      enemy.dead +
      " g2=" +
      w.grid[key(2, 1)] +
      " g3=" +
      w.grid[key(3, 1)],
  );
}

{
  const w = kickSetup(11, true);
  const b = w.bombs[0];
  const hold = { 0: { ...newIntent(), move: { x: 1, y: 0 }, kick: false } };
  for (let i = 0; i < 80; i++) step(w, CFG.STEP, hold);
  check(
    "walk-into kick without inp.kick launches",
    !!b.slide || b.tx > 4,
    "tx=" + b.tx + " slide=" + JSON.stringify(b.slide),
  );
}

console.log("\n  SIM-KICK RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
