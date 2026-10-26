/* #25 balance harness (tools/balance), the small-sample gates; the full pin
   and the sweeps run offline (tools/balance/tilesweep.mjs).
   - parity: with feat = null (gen-3 worlds after loadLevel, A0) and on gen 1,
     the fork's intent AND private state equal the stock demobot's tick by
     tick (rooms 1-8 x 3 heats x 2 seeds);
   - controls: rooms with no rule tile (4, 6-8 carry art-only codes) give
     A0 == A1 byte for byte: the result row (bar the arm field), the
     per-tick intent stream, and a sim-state snapshot that leaves out only
     the tile-layer fields (feat*, p.gl / p.glBuf, which the sim's glide
     path touches on any truthy feat);
   - reproducibility: the same (cell, seed) gives the same row;
   - the no-escape counter: ICE PATCH CORE reports 0 tile-forced spots, and
     every probed state there escapes with tiles whenever it escapes without
     (the boost only speeds you up, so a monotone search cannot lose one);
   - the featProfile seam: unset or set to the stock table plays the same,
     a changed knob changes play. */
import { CFG, T, key } from "../src/core/config.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { createDemobot } from "../src/app/demobot.js";
import { FEAT_PROFILE, featProfile } from "../src/core/feat.js";
import { createTileBot } from "../tools/balance/demobot-tiles.mjs";
import { runRoom, makeWorld, iser, simSnap } from "../tools/balance/tilerun.mjs";
import { probe, escape, lethalMap } from "../tools/balance/escape.mjs";
import { rulesOn } from "../tools/balance/tilemodel.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const t0 = Date.now();
const st = (b) => { const s = b.state; return JSON.stringify({ ...s, rng: s.rng >>> 0 }); };

/* ---- parity ---- */
function parity(w, seed, ticks) {
  const a = createDemobot(seed), b = createTileBot(seed);
  for (let i = 0; i < ticks && w.state === "PLAY"; i++) {
    const ia = a.intent(w), ib = b.intent(w);
    if (iser(ia) !== iser(ib) || st(a) !== st(b)) return i;
    step(w, CFG.STEP, { 0: ia });
    w.events.length = 0;
  }
  return -1;
}
{
  let bad = [], runs = 0;
  for (let room = 1; room <= 8; room++) for (const heat of [0, 1, 2]) for (const s of [0, 1]) {
    const { w, seed } = makeWorld({ room, heat, arm: "A0" }, s);
    if (w.feat) bad.push(`r${room}h${heat}s${s} feat`);
    const at = parity(w, seed, 7200);
    runs++;
    if (at >= 0) bad.push(`r${room}h${heat}s${s}@${at}`);
  }
  check(`parity, gen-3 A0 (feat null): fork intent + state == stock, tick by tick (${runs} runs)`, !bad.length, bad.slice(0, 4).join(" "));
  bad = [];
  for (let room = 1; room <= 8; room++) {
    const w = createWorld(4242 + room, room);
    w.heat = room % 3; loadLevel(w, room, false); w.state = "PLAY";
    const at = parity(w, 4242 + room, 7200);
    if (at >= 0) bad.push(`r${room}@${at}`);
  }
  check("parity, gen 1 rooms 1-8: fork == stock tick by tick", !bad.length, bad.join(" "));
}

/* ---- controls ---- */
{
  let bad = [], rows = 0;
  for (const room of [4, 6, 7, 8]) for (const heat of [0, 1, 2]) for (const s of [0, 1]) {
    const a = runRoom({ room, heat, arm: "A0" }, s), b = runRoom({ room, heat, arm: "A1" }, s);
    rows++;
    if (b.rules) bad.push(`r${room} carries rule tiles`);
    if (JSON.stringify({ ...a, arm: "" }) !== JSON.stringify({ ...b, arm: "" })) bad.push(`r${room}h${heat}s${s}`);
  }
  check(`controls: A0 row == A1 row, rooms 4/6/7/8 x 3 heats x 2 seeds (${rows} pairs)`, !bad.length, bad.slice(0, 4).join(" "));
  bad = [];
  for (const room of [4, 6, 7, 8]) {
    const A = makeWorld({ room, heat: 2, arm: "A0" }, 3), B = makeWorld({ room, heat: 2, arm: "A1" }, 3);
    if (!B.w.feat) { bad.push(`r${room} no art layer`); continue; }
    const ba = createTileBot(A.seed), bb = createTileBot(B.seed);
    for (let i = 0; i < 7200 && A.w.state === "PLAY"; i++) {
      const ia = ba.intent(A.w), ib = bb.intent(B.w);
      if (iser(ia) !== iser(ib)) { bad.push(`r${room} intent@${i}`); break; }
      step(A.w, CFG.STEP, { 0: ia }); step(B.w, CFG.STEP, { 0: ib });
      A.w.events.length = 0; B.w.events.length = 0;
      if (simSnap(A.w) !== simSnap(B.w)) { bad.push(`r${room} state@${i}`); break; }
    }
  }
  check("controls: A0 == A1 intent stream + sim snapshot every tick (MAX, art layer present)", !bad.length, bad.join(" "));
}

/* ---- reproducibility ---- */
{
  const cells = [{ room: 3, heat: 2, arm: "A1" }, { room: 5, heat: 1, arm: "A1" }, { room: 1, heat: 0, arm: "A3" }, { room: 2, heat: 2, arm: "A2" }];
  const same = cells.every((c) => JSON.stringify(runRoom(c, 7)) === JSON.stringify(runRoom(c, 7)));
  check("reproducibility: the same (cell, seed) gives the same row (4 tile cells)", same);
}

/* ---- no-escape counter ---- */
{
  let spots = 0, probes = 0, viol = 0, rooms = 0;
  for (let s = 0; s < 12; s++) {
    const { w, seed } = makeWorld({ room: 2, heat: 0, arm: "A1" }, s);
    if (!rulesOn(w)) continue;
    rooms++;
    const bot = createTileBot(seed);
    for (let i = 0; i < 7200 && w.state === "PLAY"; i++) {
      const pr = probe(w);
      if (pr) { probes++; if (pr.forced) spots++; if (pr.e0 && !pr.e1) viol++; }
      step(w, CFG.STEP, { 0: bot.intent(w) });
      w.events.length = 0;
    }
  }
  check(`no-escape self-test: ICE PATCH CORE = 0 tile-forced spots (${rooms} rooms, ${probes} probed ticks)`, spots === 0 && probes > 200, spots);
  check("no-escape monotone on ICE PATCH CORE: with-tile escape whenever plain escape", viol === 0, viol);
  const rowSpots = [0, 1, 2, 3].reduce((n, s) => n + runRoom({ room: 2, heat: 0, arm: "A1" }, s).noEsc, 0);
  check("no-escape: ICE PATCH CORE rows report 0", rowSpots === 0, rowSpots);
}
/* synthetic: a 1-wide corridor, bomb 2 tiles east of the player; the only
   way out is west. Fast enough = escape; a fuse too short = no escape; and a
   blade already on the only exit is never entered, even though it ends. */
{
  const w = createWorld(1, 1);
  loadLevel(w, 1, false); w.state = "PLAY";
  w.grid.fill(T.WALL);
  for (let x = 1; x <= 9; x++) w.grid[key(x, 5)] = T.EMPTY;
  const p = w.players[0];
  p.x = 5.5 * CFG.TILE; p.y = 5.5 * CFG.TILE; p.speed = 3;
  w.enemies = []; w.blades = [];
  const bomb = (tx, timer, radius = 3) => ({ x: (tx + 0.5) * CFG.TILE, y: 5.5 * CFG.TILE, tx, ty: 5, timer, radius, pierce: false, line: false, dir: null, variant: "normal", dead: false });
  w.bombs = [bomb(7, 2.5)];
  check("escape: corridor, fuse 2.5 s, 3 t/s -> escapes west", escape(w, false) === true);
  w.bombs = [bomb(7, 0.6)];
  check("escape: corridor, fuse 0.6 s -> no escape", escape(w, false) === false);
  w.bombs = [bomb(7, 2.5)];
  w.blades = [{ x: 3.5 * CFG.TILE, y: 5.5 * CFG.TILE, tiles: [{ tx: 3, ty: 5 }], t: 0.3, ttl: 0.34 }];
  check("escape: a live blade on the only exit is never entered (monotone, no wait-out)", escape(w, false) === false);
  w.bombs = [bomb(7, 2.5), bomb(4, 9, 3)];
  w.blades = [];
  const L = lethalMap(w, false);
  check("lethal map: a covered bomb chains to the earlier blast (float64 times)", L[key(1, 5)] === 2.5 && L[key(4, 5)] === 2.5, `${L[key(1, 5)]} ${L[key(4, 5)]}`);
  /* a BOOSTER at x 3 relays the bomb's west arm 2 tiles on at fuse + delay
     (MAX 0.3 s): the plain model escapes west to x 2, the tile model cannot
     (east is behind the bomb), so the spot is tile-forced */
  const NN = CFG.COLS * CFG.ROWS;
  w.heat = 2; w.feat = new Uint8Array(NN); w.feat[key(3, 5)] = 6;
  w.featM = new Uint8Array(NN); w.featS = new Float32Array(NN); w.featPend = []; w.featT = 9;
  w.bombs = [bomb(5, 2.5, 2)];
  p.x = 4.5 * CFG.TILE;
  const L0 = lethalMap(w, false), L1 = lethalMap(w, true), pr = probe(w);
  check("lethal map: BOOSTER relay lands at fuse + delay, only in the tile model", L0[key(1, 5)] === Infinity && Math.abs(L1[key(1, 5)] - 2.8) < 1e-9, `${L0[key(1, 5)]} ${L1[key(1, 5)]}`);
  check("probe: relay cover makes the corridor spot tile-forced", pr && pr.e0 && !pr.e1 && pr.forced);
  w.featM[key(3, 5)] = 2;
  check("lethal map: a cooling BOOSTER does not relay", lethalMap(w, true)[key(1, 5)] === Infinity);
}

/* ---- the featProfile seam ---- */
{
  const w = createWorld(1, 1);
  check("featProfile(w) without w.featProf is the stock tier row", featProfile({ heat: 1 }) === FEAT_PROFILE[1] && featProfile({ heat: 0, featTier: 2 }) === FEAT_PROFILE[2] && w.featProf === undefined);
  const a = runRoom({ room: 5, heat: 2, arm: "A1" }, 2);
  const b = runRoom({ room: 5, heat: 2, arm: "A1", prof: [{}, {}, {}] }, 2);
  const c = runRoom({ room: 5, heat: 2, arm: "A1", prof: [{}, {}, { plate: { near: 0, wind: 0.2 } }] }, 2);
  check("seam: an all-stock knob table plays exactly as no table", JSON.stringify(a) === JSON.stringify(b));
  check("seam: a changed TRAP knob (near 0, wind 0.2) changes play", JSON.stringify(a) !== JSON.stringify(c));
}

const ms = Date.now() - t0;
check("suite under 10 s", ms < 10000, ms + " ms");
console.log("\n  DEMOBOT-TILES RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
