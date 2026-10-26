#!/usr/bin/env node
/* Real-sim escape oracle for flagged no-escape episodes (#28, CONVEYOR lane).
   The timed-escape search (escape.mjs) never waits and treats a moving bomb
   as a static block, so an episode it flags may still be escapable. For each
   rising edge it flags, this replays the same run (same seed, the tile-aware
   bot's own intents) up to that tick, then branches the REAL step() through a
   scripted set for one fuse: stand still; hold one of 4 directions for t then
   turn to any direction (t 0.1 .. 1.2 s); stand still for t then hold one
   direction. An episode is ESCAPABLE when any branch ends the window with no
   blast hit (iFrames cleared at the episode tick, so a hit always counts); else FORCED (bounded search: one turn, 0.1 s grid; disclosed).
   Classes: S = strict onset (no tile escape since the danger began, no fresh
   own plant), P = at a fresh own plant (< 0.05 s old), L = lost (the tile
   model had an escape earlier in the danger stretch).
     node tools/balance/oracle.mjs --heats 1,2 --n 1500 [--from 0] [--prof t.json]
   Never imported by src/. */
import { readFileSync } from "node:fs";
import { CFG, key } from "../../src/core/config.js";
import { tileOf } from "../../src/core/board.js";
import { step } from "../../src/core/sim.js";
import { makeWorld, STEPS } from "./tilerun.mjs";
import { createTileBot } from "./demobot-tiles.mjs";
import { probe } from "./escape.mjs";
import { createRng } from "../../src/core/rng.js";

const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const heats = arg("--heats", "1,2").split(",").map(Number), n = +arg("--n", 300), from = +arg("--from", 0), room = +arg("--room", 3);
const prof = arg("--prof", null) ? JSON.parse(readFileSync(arg("--prof"), "utf8")) : undefined;
const D = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const ST = CFG.STEP;

function episodes(c, s) {
  const { w, seed } = makeWorld(c, s), bot = createTileBot(seed), out = [];
  let trapped = false, had1 = false;
  for (let i = 0; i < STEPS && w.state === "PLAY"; i++) {
    const pr = probe(w);
    if (pr && pr.forced && !trapped) {
      const fresh = w.bombs.some((b) => !b.dead && b.timer > (w.fuse ?? CFG.FUSE) - 0.05);
      out.push({ inv: w.players[0].iFrames > 0, i, cls: had1 ? "L" : fresh ? "P" : "S", win: Math.max(0, ...w.bombs.filter((b) => !b.dead).map((b) => b.timer), ...(w.featPend || []).map((q) => w.featS[q.k])) + CFG.BLADE_TTL + 0.1 });
    }
    trapped = !!(pr && pr.forced);
    if (!pr) had1 = false; else if (pr.e1) had1 = true;
    step(w, ST, { 0: bot.intent(w) });
    w.events.length = 0;
  }
  return out;
}
/* the run replayed to tick i once, then deep-cloned per branch (the rng is
   rebuilt from its state, frozen tables and functions are shared) */
function clone(v, seen = new Map()) {
  if (v === null || typeof v !== "object") return v;
  if (seen.has(v)) return seen.get(v);
  if (ArrayBuffer.isView(v)) { const c = v.slice(); seen.set(v, c); return c; }
  if (typeof v.next === "function" && typeof v.int === "function" && "state" in v) { const c = createRng(v.state); seen.set(v, c); return c; }
  if (Object.isFrozen(v)) return v;
  const c = Array.isArray(v) ? [] : Object.create(Object.getPrototypeOf(v));
  seen.set(v, c);
  for (const k of Object.keys(v)) c[k] = clone(v[k], seen);
  return c;
}
function at(c, s, i) {
  const { w, seed } = makeWorld(c, s), bot = createTileBot(seed);
  for (let j = 0; j < i; j++) { step(w, ST, { 0: bot.intent(w) }); w.events.length = 0; }
  return w;
}
const mv = (d) => ({ move: { x: D[d][0], y: D[d][1] }, fire: false, firePrev: false, shift: false, remote: false, kick: false });
function survives(w0, ep, plan) {
  const w = clone(w0), T = Math.ceil(ep.win / ST);
  w.players[0].iFrames = 0;
  for (let j = 0; j < T && w.state === "PLAY"; j++) {
    const t = j * ST, d = t < plan.t ? plan.a : plan.b;
    step(w, ST, { 0: mv(d) });
    for (const e of w.events) if (e.t === "hurt") {
      const hx = tileOf(e.x), hy = tileOf(e.y);
      if (w.blades.some((b) => b.tiles && b.tiles.some((q) => q.tx === hx && q.ty === hy))) return false;
    }
    w.events.length = 0;
  }
  return true;
}
const PLANS = [{ t: 0, a: 0, b: 0 }];
for (let k = 1; k <= 12; k++) for (let a = 0; a < 5; a++) for (let b = 1; b < 5; b++) if (a !== b) PLANS.push({ t: k * 0.1, a, b });
for (let d = 1; d < 5; d++) PLANS.push({ t: 99, a: d, b: d });

/* control: the bot's own line through the same window (validates the hit test) */
function botHit(c, s, ep) {
  const { w, seed } = makeWorld(c, s), bot = createTileBot(seed), T = ep.i + Math.ceil(ep.win / ST);
  for (let j = 0; j < T && w.state === "PLAY"; j++) {
    if (j === ep.i) w.players[0].iFrames = 0;
    step(w, ST, { 0: bot.intent(w) });
    if (j >= ep.i) for (const e of w.events) if (e.t === "hurt") { const hx = tileOf(e.x), hy = tileOf(e.y); if (w.blades.some((b) => b.tiles && b.tiles.some((q) => q.tx === hx && q.ty === hy))) return true; }
    w.events.length = 0;
  }
  return false;
}
const tally = {};
for (const heat of heats) {
  const c = { room, heat, arm: "A1", prof, pace: +arg("--pace", 0) };
  for (let s = from; s < from + n; s++) for (const ep of episodes(c, s)) {
    const w0 = at(c, s, ep.i), ok = PLANS.some((p) => survives(w0, ep, p));
    const k = heat + ":" + ep.cls;
    (tally[k] ||= { n: 0, esc: 0, bot: 0, inv: 0, forced: [] }).n++;
    if (ep.inv) tally[k].inv++;
    if (botHit(c, s, ep)) tally[k].bot++;
    if (ok) tally[k].esc++; else tally[k].forced.push(s + "@" + (ep.i * ST).toFixed(2));
  }
}
for (const [k, v] of Object.entries(tally).sort()) console.log(`heat ${k.split(":")[0]} class ${k.split(":")[1]}: ${v.n} flagged, ${v.esc} escapable in the real sim, ${v.n - v.esc} forced; the bot's own line was blast-hit in ${v.bot}; ${v.inv} began in iFrames (cleared for every branch)${v.forced.length ? " (" + v.forced.slice(0, 8).join(", ") + ")" : ""}`);
