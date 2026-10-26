/* One measured run (#25): a gen-3 room (the gen-2 bold board + the fair
   start + the world.feat tile layer) under one arm, the real step() at
   CFG.STEP, a 120 s cap, pact 0, driven by the tile-aware fork. A row is a
   pure function of (cell, seed index): no clock or cpu in it.
   Arms (all on the SAME gen-3 loadLevel, so boards, spawns and items pair):
     A0 tiles off: loadLevel, then feat / featPair / featS / featM / featPend
        cleared, so the sim takes its no-tile path (re-nulled after every
        loadLevel in the run-level arm)
     A1 the dial (tier = heat)   A2 CORE knobs at every heat (featTier 0)
     A3 MAX knobs at every heat (featTier 2)
   Knobs: cell.prof, a 3-tier table of partial overrides ([{belt:{v:1.1}},
   {}, {plate:{near:4}}]) merged over FEAT_PROFILE and set as w.featProf
   AFTER loadLevel, so tile placement and the V17 foe spawn distances stay
   keyed to heat's stock profile (A0 is the same for every knob table).
   Never imported by src/. */
import { CFG, T, key } from "../../src/core/config.js";
import { tileOf } from "../../src/core/board.js";
import { createWorld, loadLevel, step } from "../../src/core/sim.js";
import { createDemobot } from "../../src/app/demobot.js";
import { FEAT_PROFILE, isBelt, BELT_PLACE } from "../../src/core/feat.js";
import { createTileBot } from "./demobot-tiles.mjs";
import { rulesOn, ruleKind, prof } from "./tilemodel.mjs";
import { probe } from "./escape.mjs";

/* #28 CONVEYOR placement variants: BELT_OPT='{"away":1,...}' (feat.js BELT_PLACE) */
if (process.env.BELT_OPT) Object.assign(BELT_PLACE, JSON.parse(process.env.BELT_OPT));
export const CAP = 120, STEPS = Math.round(CAP / CFG.STEP);
export const ARMS = Object.freeze(["A0", "A1", "A2", "A3"]);
export const fmix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
/* held-out seeds: a stream of its own (botsweep uses fmix((100000+s)*7919+13),
   the fairness sweep and CI their own); pilot s in [0, 200), main from 10000 */
export const seedOf = (s) => fmix((Math.imul(300000 + s, 104723) + 0x7a11) >>> 0);

export function mergeProf(over) {
  if (!over) return null;
  return [0, 1, 2].map((t) => {
    const o = over[t] || {}, b = FEAT_PROFILE[t], r = {};
    for (const kind of Object.keys(b)) r[kind] = { ...b[kind], ...(o[kind] || {}) };
    return r;
  });
}
function tilesOff(w) {
  w.feat = null; w.featPair = null; w.featS = null; w.featM = null; w.featPend = null; w.featT = 0;
}
export function armWorld(w, c) {
  if (c.arm === "A0") { tilesOff(w); return; }
  if (c.prof) w.featProf = mergeProf(c.prof);
  if (c.arm === "A2") w.featTier = 0;
  else if (c.arm === "A3") w.featTier = 2;
}
export function makeWorld(c, s) {
  const seed = seedOf(s), w = createWorld(seed, c.room);
  w.gen = 3; w.heat = c.heat; w.pact = 0; w.pace = c.pace || 0;
  BELT_PLACE.prof = process.env.BELT_SPAWN_STOCK ? null : mergeProf(c.prof);
  loadLevel(w, c.room, false);
  armWorld(w, c);
  w.state = "PLAY";
  return { w, seed };
}
const man = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

/* one room: the full metric row */
export function runRoom(c, s) {
  const { w, seed } = makeWorld(c, s);
  const bot = c.bot === "stock" ? createDemobot(seed) : createTileBot(seed);
  const tm = rulesOn(w), kind = ruleKind(w);
  const r = { room: c.room, heat: c.heat, pace: c.pace || 0, arm: c.arm, prof: c.profName || "", s, seed, tpl: w.layout ? w.layout.tpl : "", kind: kind || "", rules: tm ? 1 : 0,
    st: "TIMEOUT", t: CAP, hits: 0, absorbs: 0, firstHit: -1, hit5: 0, hit15: 0, hBlast: 0, hContact: 0, hTile: 0, ownRelay: 0, chainEarly: 0, nearMiss: 0,
    kills: 0, tileKills: 0, relayKills: 0, trapKills: 0, selfClears: 0, selfClearsArm: 0, rideKills: 0, deliveries: 0,
    noEsc: 0, noEscOn: 0, noEscPlant: 0, noEscHit: 0, noEscRide: 0, noEscIce: 0, dangerT: 0 };
  const nm = new Map(), armD = new Map(), seenBl = new WeakSet(), cutoff = c.metrics === false;
  let trapped = false, lastEsc = -99, pendHit = 0, had1 = false;
  const coreBelt = tm && kind === "BELT" && !prof(w).belt.actors;
  for (let i = 0; i < STEPS; i++) {
    const p0 = w.players[0], pk0 = key(tileOf(p0.x), tileOf(p0.y)), tNow = i * CFG.STEP;
    if (c.arm === "A0" && w.feat) throw new Error("A0 world carries a tile layer");
    if (!cutoff) {
      for (const b of w.bombs) {
        if (b.dead || b.timer > 0.5 || nm.has(b) || p0.iFrames > 0) continue;
        if (b.tx === tileOf(p0.x) && b.ty === tileOf(p0.y) || plainFoot(w, b).has(pk0)) nm.set(b, 1);
      }
      const pr = probe(w);
      if (pr) {
        r.dangerT += CFG.STEP;
        if (pr.forced && !trapped) {
          r.noEsc++; lastEsc = tNow; pendHit = 1;
          if (!had1) { if (w.bombs.some((b) => !b.dead && b.timer > (w.fuse ?? CFG.FUSE) - 0.05)) r.noEscPlant++; else r.noEscOn++; }
          if (isBelt(w.feat[pk0])) r.noEscRide++;
          if (w.feat[pk0] === 5) r.noEscIce++;
        }
        trapped = pr.forced;
        if (pr.e1) had1 = true;
      } else { trapped = false; had1 = false; }
    }
    const lives0 = w.lives, shield0 = w.players[0].shield;
    step(w, CFG.STEP, { 0: bot.intent(w) });
    const p = w.players[0], tt = (i + 1) * CFG.STEP, ptx = tileOf(p.x), pty = tileOf(p.y);
    const lost = lives0 - w.lives;
    let hurtEv = null;
    for (const e of w.events) {
      if (e.t === "hurt") hurtEv = e;
      else if (e.t === "plate") { const k = key(tileOf(e.x), tileOf(e.y)); armD.set(k, man(ptx, pty, tileOf(e.x), tileOf(e.y))); }
    }
    if (shield0 && !w.players[0].shield && hurtEv) r.absorbs++;
    if (lost > 0 && hurtEv) {
      r.hits += lost;
      if (r.firstHit < 0) r.firstHit = +tt.toFixed(4);
      if (tt < 5) r.hit5 = 1;
      if (tt < 15) r.hit15 = 1;
      if (pendHit && tt - lastEsc <= 3) { r.noEscHit++; pendHit = 0; }
      const hx = tileOf(hurtEv.x), hy = tileOf(hurtEv.y), hk = key(hx, hy);
      const bl = w.blades.filter((b) => b.tiles && b.tiles.some((q) => q.tx === hx && q.ty === hy));
      const onTile = tm && w.feat[hk] >= 1 && w.feat[hk] <= 7;
      if (bl.length) {
        r.hBlast++;
        if (bl.some((b) => b.src === "relay")) r.ownRelay++;
        if (bl.some((b) => b.early)) r.chainEarly++;
        if (bl.some((b) => b.src || b.rode || b.early) || onTile) r.hTile++;
      } else {
        r.hContact++;
        if (onTile || (p.beltT != null && tm && w.featT - p.beltT < 0.5)) r.hTile++;
      }
    }
    for (const e of w.events) {
      if (e.t !== "kill") continue;
      r.kills++;
      if (e.src || e.rode || e.early) r.tileKills++;
      if (e.src === "relay") r.relayKills++;
      if (e.rode) r.rideKills++;
      if (e.src === "plate") {
        r.trapKills++;
        const ex = tileOf(e.x), ey = tileOf(e.y);
        if (man(ptx, pty, ex, ey) > 4) r.selfClears++;
        const src = w.blades.filter((b) => b.src === "plate" && !seenBl.has(b) && b.tiles.some((q) => q.tx === ex && q.ty === ey));
        if (src.some((b) => (armD.get(key(tileOf(b.x), tileOf(b.y))) ?? 99) > 4)) r.selfClearsArm++;
      }
    }
    for (const bl of w.blades) {
      if (seenBl.has(bl)) continue;
      seenBl.add(bl);
      if (bl.rode && (bl.tiles.some((q) => q.brick) || w.events.some((e) => e.t === "kill" && e.rode))) r.deliveries++;
    }
    for (const [b] of nm) if (b.dead) { nm.delete(b); if (!(lost > 0)) r.nearMiss++; }
    w.events.length = 0;
    if (w.state === "WIN" || w.state === "LOSE") { r.st = w.state; r.t = +tt.toFixed(4); break; }
  }
  r.noEscEx = coreBelt ? 0 : r.noEsc;
  return r;
}
function plainFoot(w, b) {
  const s = new Set([key(b.tx, b.ty)]);
  const arms = b.line ? [b.dir || { x: 1, y: 0 }] : [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  for (const d of arms)
    for (let i = 1; i <= b.radius; i++) {
      const x = b.tx + d.x * i, y = b.ty + d.y * i, v = w.grid[key(x, y)];
      if (v === undefined || v === T.WALL) break;
      s.add(key(x, y));
      if (v === T.BRICK && !b.pierce && !b.line) break;
    }
  return s;
}

/* run level: rooms 1 -> 5 with progress kept, 120 s cap per room; the harness
   advances rooms itself (the bot never fires outside PLAY) */
export function runLevel(c, s) {
  const seed = fmix(seedOf(s) ^ 0x2b), w = createWorld(seed, 1);
  w.gen = 3; w.heat = c.heat; w.pact = 0; w.pace = c.pace || 0;
  const bot = createTileBot(seed);
  const load = (lv, keep) => { loadLevel(w, lv, keep); armWorld(w, c); w.state = "PLAY"; };
  const r = { run: 1, heat: c.heat, pace: c.pace || 0, arm: c.arm, prof: c.profName || "", s, seed, reached: 1, won: 0, st: "TIMEOUT", t: 0, hits: 0, lives: 0 };
  load(1, false);
  for (let lv = 1; lv <= 5; lv++) {
    if (lv > 1) load(lv, true);
    r.reached = lv;
    let i = 0;
    for (; i < STEPS; i++) {
      if (c.arm === "A0" && w.feat) throw new Error("A0 world carries a tile layer");
      const l0 = w.lives;
      step(w, CFG.STEP, { 0: bot.intent(w) });
      r.hits += Math.max(0, l0 - w.lives);
      w.events.length = 0;
      if (w.state !== "PLAY") break;
    }
    r.t = +(r.t + Math.min(STEPS, i + 1) * CFG.STEP).toFixed(4);
    if (w.state === "LOSE") { r.st = "LOSE"; break; }
    if (w.state !== "WIN") { r.st = "TIMEOUT"; break; }
    r.won++;
    if (lv === 5) r.st = "CLEAR";
  }
  r.lives = w.lives;
  return r;
}

/* the offline parity pin: one world driven by the STOCK intent, the fork
   asked the same question every tick; gen 3 with tiles off (c.gen 3) or gen 1 */
export function pinRun(c, s) {
  let w, seed;
  if (c.gen === 1) { seed = seedOf(s); w = createWorld(seed, c.room); w.heat = c.heat; w.pact = 0; w.pace = c.pace || 0; loadLevel(w, c.room, false); w.state = "PLAY"; }
  else ({ w, seed } = makeWorld({ ...c, arm: "A0" }, s));
  const a = createDemobot(seed), b = createTileBot(seed);
  const st = (o) => { const v = o.state; return JSON.stringify({ ...v, rng: v.rng >>> 0 }); };
  let i = 0;
  for (; i < STEPS && w.state === "PLAY"; i++) {
    const ia = a.intent(w), ib = b.intent(w);
    if (iser(ia) !== iser(ib) || st(a) !== st(b)) return { pin: 1, gen: c.gen || 3, room: c.room, heat: c.heat, s, ticks: i, bad: i };
    step(w, CFG.STEP, { 0: ia });
    w.events.length = 0;
  }
  return { pin: 1, gen: c.gen || 3, room: c.room, heat: c.heat, s, ticks: i, bad: -1 };
}

/* parity / control probe: per-tick intent + fork state, and a sim-state
   snapshot that leaves out the tile layer fields (feat*, p.gl / p.glBuf) */
export const iser = (i) => (i.move.x + 2) * 81 + (i.move.y + 2) * 27 + (i.fire ? 9 : 0) + (i.firePrev ? 3 : 0) + (i.shift ? 1 : 0) + (i.remote ? 100 : 0) + (i.kick ? 200 : 0);
export function simSnap(w) {
  const p = w.players[0];
  return JSON.stringify({ g: Array.from(w.grid), rs: w.rng.state, st: w.state, tk: w.tick, sc: w.score, lv: w.lives,
    p: [p.x, p.y, p.tx, p.ty, p.bombs, p.range, p.speed, p.alive, p.shield, p.bombKind, p.iFrames],
    en: w.enemies.map((e) => [e.type, e.x, e.y, e.tx, e.ty, e.dead]), bo: w.bombs.map((b) => [b.tx, b.ty, b.x, b.y, b.timer, b.radius]),
    bl: w.blades.map((b) => [b.x, b.y, b.t]), it: w.items.map((i) => [i.x, i.y, i.t, i.taken, i.buried]) });
}
export { T };
