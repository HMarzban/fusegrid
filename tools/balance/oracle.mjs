#!/usr/bin/env node
/* Real-sim escape oracle for flagged no-escape episodes (#28 CONVEYOR lane,
   all four tiles since #30). The timed-escape search (escape.mjs) never waits
   and treats a moving bomb as a static block, so an episode it flags may still
   be escapable. This walks the same run the sweep measures (same seed, the
   tile-aware bot's own intents, the same rising-edge logic as tilerun.mjs, so
   the flagged count equals the row's noEsc) and asks the REAL step() about each
   flagged tick, on deep clones, with iFrames cleared at the episode tick so a
   hit always counts:
     bot     the bot's own line, unchanged, takes no hit;
     plan    stand still, hold one direction, or one turn (0.1 s grid, up to 1.2 s);
     search  every 5-way input sequence on a 0.1 s, then 0.05 s grid, deduplicated
             by player pixel, glide state and bomb cells (a reachable-set BFS);
     blast   no clean sequence, but one survives every blast with foe contact
             off: forced in the real sim with a foe in the lane, so NOT counted
             as an escape (r = -R also shrinks the foes' blast hitboxes, so a
             foe may outlive a blast it would have died in; disclosed);
     forced  no input sequence survives even so, confirmed on a 0.05 s grid and
             with foe tiles and tile cooldowns added to the dedup key, so a
             pruned branch cannot fake it.
   A branch ends when the world is quiet (no bomb, wind-up or blade), capped at
   8 s. Any hurt fails it: blast, contact or an absorbed SHIELD. A branch may
   only move (a walk into a bomb kicks it if KICK is held): no new plant, no
   REMOTE (`remote` says if one was held). So "forced" is an upper bound.
   For a forced or blast episode:
     cause     the blade sources in the hit that ended the longest-lived branch;
     plainEsc  the same search with the tile layer nulled at that tick; true
               means the TILE took the escape away (tile-caused);
     realI     still hit with the player's real iFrames left in place;
     lastEsc   walking back: the last tick with an escape, and what changed
               on the step after it (own plant, trap armed, ...);
     age       the YOUNGEST live threat's age at lastEsc (-1: none yet). Grade
               of a tile-caused, real-iFrames episode: plant = the plant itself
               closed the last escape; warned = every threat had been on the
               board >= 0.25 s at the last chance; NOWARN = the rest, read by
               hand (youngest, so an old killer beside a new bomb lands here:
               it can only over-report);
     capped    the strict search hit its layer cap (a foe keeps arming traps,
               the key has foe tiles in it); the loose 0.05 s result stands.
   Reaction margin of an escapable episode: the longest of 0.1 / 0.2 / 0.3 /
   0.5 s of keeping the bot's last input that still leaves an escape; "0" = the
   escape must start now.
   Classes (as the sweep's noEscOn / noEscPlant): S = strict onset (no tile
   escape since the danger began, no fresh own plant), P = at a fresh own plant
   (< 0.05 s old), L = lost (the tile model had an escape earlier in the stretch).
     node tools/balance/oracle.mjs --rooms 1,2,3,5 --heats 0,1,2 --n 6000 --from 600000 --workers 8 --name oracle600k
   Output: tools/balance/out/<name>.jsonl (one row per episode) and a printed
   table. Workers are child processes, stopped by PID. Never imported by src/. */
import { fork } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CFG } from "../../src/core/config.js";
import { tileOf } from "../../src/core/board.js";
import { step } from "../../src/core/sim.js";
import { createRng } from "../../src/core/rng.js";
import { featProfile } from "../../src/core/feat.js";
import { makeWorld, STEPS, seedOf } from "./tilerun.mjs";
import { createTileBot } from "./demobot-tiles.mjs";
import { probe } from "./escape.mjs";

const ST = CFG.STEP, D = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], CAP_T = Math.ceil(8 / ST), CAP_LAYER = 1500, WARN = 0.25;
const HEAT = ["CORE", "PLUS", "MAX"], TILE_OF = { 1: "BOOSTER", 2: "ICE PATCH", 3: "CONVEYOR", 5: "TRAP" };

/* frozen tables and functions are shared, the rng is rebuilt from its state */
export function clone(v, seen = new Map()) {
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
const mv = (d) => ({ move: { x: D[d][0], y: D[d][1] }, fire: false, firePrev: false, shift: false, remote: false, kick: false });
const MV = D.map((_, d) => mv(d));
export const quiet = (w) => !w.blades.length && !w.bombs.some((b) => !b.dead) && !(w.featPend && w.featPend.length);
const hurtIn = (w) => w.events.some((e) => e.t === "hurt");
const over = (w) => w.state !== "PLAY" || quiet(w);
/* a branch world: iFrames gone; `noContact` turns foe contact off (checkContact
   tests dist^2 < (e.r + R)^2, so r = -R never holds) */
function branch(w0, noContact, keepI) {
  const w = clone(w0);
  if (!keepI) w.players[0].iFrames = 0;
  w.events.length = 0;
  if (noContact) for (const e of w.enemies) e.r = -CFG.TILE * CFG.CONTACT_R;
  return w;
}
function tilesOff(w) { w.feat = null; w.featPair = null; w.featS = null; w.featM = null; w.featPend = null; const p = w.players[0]; p.gl = null; p.glBuf = null; for (const b of w.bombs) if (b.carry) { b.carry = false; b.slide = null; b.prog = 0; b.x = (b.tx + 0.5) * CFG.TILE; b.y = (b.ty + 0.5) * CFG.TILE; } return w; }

/* the bot's own line through the danger */
function botLine(w0, bot0, seed) {
  const w = branch(w0), bot = createTileBot(seed);
  bot.state = bot0.state;
  for (let j = 0; j < CAP_T && !over(w); j++) {
    step(w, ST, { 0: bot.intent(w) });
    if (hurtIn(w)) return false;
    w.events.length = 0;
  }
  return true;
}
const PLANS = [{ t: 0, a: 0, b: 0 }];
for (let d = 1; d < 5; d++) PLANS.push({ t: 99, a: d, b: d });
for (let k = 1; k <= 12; k++) for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) if (a !== b) PLANS.push({ t: k * 0.1, a, b });
function planOk(w0, plan) {
  const w = branch(w0);
  for (let j = 0; j < CAP_T && !over(w); j++) {
    step(w, ST, { 0: MV[j * ST < plan.t ? plan.a : plan.b] });
    if (hurtIn(w)) return false;
    w.events.length = 0;
  }
  return true;
}
/* blade sources covering the player's hit */
function causeOf(w, e) {
  const hx = tileOf(e.x), hy = tileOf(e.y), out = new Set();
  for (const b of w.blades) if (b.tiles && b.tiles.some((q) => q.tx === hx && q.ty === hy)) out.add(b.src ? b.src : b.rode ? "rode" : b.early ? "early" : "bomb");
  if (!out.size) out.add("contact");
  return [...out].sort().join("+");
}
const sig = (w, strict) => {
  const p = w.players[0];
  let s = `${Math.round(p.x)},${Math.round(p.y)},${p.gl ? p.gl.x + 3 * p.gl.y : 9},${p.glBuf ? p.glBuf.x + 3 * p.glBuf.y : 9}`;
  for (const b of w.bombs) if (!b.dead) s += `;${b.tx},${b.ty}`;
  if (strict) {
    for (const e of w.enemies) s += e.dead ? "|x" : `|${e.tx},${e.ty}`;
    if (w.featM) for (let k = 0; k < w.featM.length; k++) if (w.featM[k]) s += `/${k}:${w.featM[k]}`;
    for (let k = 0; k < w.grid.length; k++) if (w.grid[k] === 1) s += k.toString(36);
  }
  return s;
};
/* reachable-set BFS over the real step(): true when some input sequence on an
   H-tick grid reaches a quiet world (or a room end) with no hurt; null when a
   strict search outgrows CAP_LAYER */
export function search(w0, { H = 6, noContact = false, info = null, strict = false, keepI = false } = {}) {
  let layer = [branch(w0, noContact, keepI)];
  if (over(layer[0])) return true;
  let nodes = 0, bestT = -1;
  for (let t = 0; t < CAP_T; t += H) {
    const seen = new Set(), next = [];
    for (const w of layer) {
      for (let d = 0; d < 5; d++) {
        const c = clone(w);
        let dead = false;
        for (let j = 0; j < H; j++) {
          step(c, ST, { 0: MV[d] });
          nodes++;
          if (hurtIn(c)) {
            dead = true;
            if (info && t + j > bestT) { bestT = t + j; info.cause = causeOf(c, c.events.find((e) => e.t === "hurt")); info.t = (t + j + 1) * ST; }
            break;
          }
          c.events.length = 0;
          if (over(c)) return true;
        }
        if (dead) continue;
        const g = sig(c, strict);
        if (seen.has(g)) continue;
        seen.add(g);
        next.push(c);
      }
    }
    if (!next.length) { if (info) info.nodes = nodes; return false; }
    if (strict && next.length > CAP_LAYER) return null;
    layer = next;
  }
  /* still danger at the cap (foes keep triggering traps): nobody was hit */
  return true;
}
/* any escape at all from this state: the plans first (cheap witnesses) */
export function hasEscape(w0, opts = {}) {
  for (const p of PLANS) if (planOk(w0, p)) return true;
  return search(w0, opts);
}
/* longest delay of keeping the last input that still leaves an escape */
function reaction(w0, last) {
  let best = 0;
  for (const d of [0.1, 0.2, 0.3, 0.5]) {
    const w = branch(w0);
    let dead = false;
    for (let j = 0; j < Math.round(d / ST) && !over(w); j++) {
      step(w, ST, { 0: last });
      if (hurtIn(w)) { dead = true; break; }
      w.events.length = 0;
    }
    if (dead) break;
    if (over(w) || hasEscape(w)) best = d; else break;
  }
  return best;
}

/* walk one run: every flagged episode gets a verdict; forced ones are then
   walked back from a fresh replay of the same run */
export function runOracle(c, s, { margins = true } = {}) {
  const { w, seed } = makeWorld(c, s), bot = createTileBot(seed), out = [];
  let trapped = false, had1 = false, last = MV[0];
  for (let i = 0; i < STEPS; i++) {
    const pr = probe(w);
    if (pr && pr.forced && !trapped) {
      const fresh = w.bombs.some((b) => !b.dead && b.timer > (w.fuse ?? CFG.FUSE) - 0.05);
      const ep = { room: c.room, heat: c.heat, s, seed: seedOf(s), tick: i, t: +(i * ST).toFixed(3), cls: had1 ? "L" : fresh ? "P" : "S", inv: w.players[0].iFrames > 0, stage: "", bot: false, margin: 0 };
      ep.bot = botLine(w, bot, seed);
      if (ep.bot) ep.stage = "bot";
      else if (PLANS.some((p) => planOk(w, p))) ep.stage = "plan";
      else if (search(w) || search(w, { H: 3 })) ep.stage = "search";
      else {
        const info = {}, p = w.players[0];
        search(w, { H: 3, info });
        const clean = search(w, { H: 3, strict: true });
        if (clean) ep.stage = "search";
        else {
          if (clean === null) ep.capped = true;
          const bl = search(w, { H: 3, noContact: true, strict: true });
          ep.stage = (bl === null ? search(w, { H: 3, noContact: true }) : bl) ? "blast" : "forced";
          ep.cause = info.cause || "?"; ep.hitIn = info.t; ep.remote = !!p.remote; ep.kick = !!p.kick;
          ep.plainEsc = !!hasEscape(tilesOff(clone(w)), { H: 3 });
          const kept = search(w, { H: 3, keepI: true });
          ep.realI = !kept;
          Object.assign(ep, walkBack(c, s, i));
          ep.grade = !ep.realI ? "iFrames" : !ep.plainEsc ? "plain" : (ep.onStep || "").split(",").includes("bomb") && ep.gapPlant ? "plant" : ep.age >= WARN ? "warned" : "NOWARN";
        }
      }
      if (ep.stage !== "forced" && ep.stage !== "blast" && margins) ep.margin = reaction(w, last);
      out.push(ep);
    }
    trapped = !!(pr && pr.forced);
    if (!pr) had1 = false; else if (pr.e1) had1 = true;
    if (w.state !== "PLAY") break;
    const it = bot.intent(w);
    last = { ...MV[0], move: { x: it.move.x, y: it.move.y } };
    step(w, ST, { 0: it });
    w.events.length = 0;
    if (w.state === "WIN" || w.state === "LOSE") break;
  }
  return out;
}
function atTick(c, s, i) {
  const { w, seed } = makeWorld(c, s), bot = createTileBot(seed);
  for (let j = 0; j < i && w.state === "PLAY"; j++) { step(w, ST, { 0: bot.intent(w) }); if (j < i - 1) w.events.length = 0; }
  return w;
}
/* the last tick (at most 4 s back) with an escape, and what the next step did */
function walkBack(c, s, i) {
  const has = (j) => hasEscape(atTick(c, s, j), { H: 3 });
  let j = i;
  while (j > 0 && i - j < 240) { j = Math.max(0, j - 6); if (has(j)) break; }
  if (i - j >= 240 || (j === 0 && !has(0))) return { lastEsc: -1 };
  let a = j, b = Math.min(i, j + 6);
  for (let q = a + 1; q < b; q++) { if (has(q)) a = q; else { b = q; break; } }
  const w0 = atTick(c, s, a), w = atTick(c, s, a + 1), n0 = w0.bombs.filter((b) => !b.dead).length, fz = w0.fuse ?? CFG.FUSE;
  const P = w0.feat ? featProfile(w0) : null, ages = w0.bombs.filter((b) => !b.dead).map((b) => fz - b.timer);
  for (const q of w0.featPend || []) ages.push((q.kind === "plate" ? P.plate.wind : P.bloom.delay) - w0.featS[q.k]);
  for (const bl of w0.blades) ages.push(bl.t);
  return { lastEsc: a, noReturn: +((i - a) * ST).toFixed(3), onStep: [...new Set(w.events.map((e) => e.t))].join(","), gapPlant: w.bombs.filter((b) => !b.dead).length > n0, age: ages.length ? +Math.min(...ages).toFixed(3) : -1 };
}

export function table(rows, meta = {}) {
  const L = [];
  L.push("| tile · heat | flagged | S / P / L | escape: bot line | one-turn plan | full search | forced, foe in the lane (blast-clean) | FORCED | real and tile-caused: plant / warned / NOWARN | not real or not the tile: iFrames / plain | margin < 0.1 s / 0.1 / 0.2 / >= 0.3 s (escapable) |", "|" + "---|".repeat(11));
  const rms = meta.rooms || [...new Set(rows.map((r) => r.room))], hts = meta.heats || [0, 1, 2];
  for (const room of rms) for (const heat of hts) {
    const g = rows.filter((r) => r.room === room && r.heat === heat), n = (f) => g.filter(f).length;
    const f = g.filter((r) => r.stage === "forced"), e = g.filter((r) => r.stage !== "forced" && r.stage !== "blast");
    L.push(`| ${TILE_OF[room] || room} · ${HEAT[heat]} | ${g.length} | ${n((r) => r.cls === "S")} / ${n((r) => r.cls === "P")} / ${n((r) => r.cls === "L")} | ${n((r) => r.stage === "bot")} | ${n((r) => r.stage === "plan")} | ${n((r) => r.stage === "search")} | ${n((r) => r.stage === "blast")} | ${f.length} | ${n((r) => r.grade === "plant")} / ${n((r) => r.grade === "warned")} / ${n((r) => r.grade === "NOWARN")} | ${n((r) => r.grade === "iFrames")} / ${n((r) => r.grade === "plain")} | ${e.filter((r) => r.margin < 0.1).length} / ${e.filter((r) => r.margin === 0.1).length} / ${e.filter((r) => r.margin === 0.2).length} / ${e.filter((r) => r.margin >= 0.3).length} |`);
  }
  const fo = rows.filter((r) => r.grade === "NOWARN" || r.grade === "plant");
  if (fo.length) {
    L.push("", "Forced, real and tile-caused, NOWARN and plant (first 60; blast = forced with a foe in the lane):", "", "| tile · heat | grade · stage | threat age s | s (seed) | tick (t s) | class | began in iFrames | hit even with real iFrames | cause | hit in s | tile-caused | REMOTE / KICK held | last escape tick | gap s | on the step after |", "|" + "---|".repeat(15));
    for (const r of fo.slice(0, 60)) L.push(`| ${TILE_OF[r.room] || r.room} · ${HEAT[r.heat]} | ${r.grade} · ${r.stage} | ${r.age} | ${r.s} (${r.seed}) | ${r.tick} (${r.t}) | ${r.cls} | ${r.inv ? "yes" : "no"} | ${r.realI ? "yes" : "no"} | ${r.cause} | ${(+r.hitIn).toFixed(2)} | ${r.plainEsc ? "YES" : "no"} | ${r.remote ? "R" : "–"} / ${r.kick ? "K" : "–"} | ${r.lastEsc} | ${r.noReturn ?? "–"} | ${r.onStep ?? "–"} |`);
  }
  return L.join("\n");
}

const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const isMain = process.argv[1] && process.argv[1].endsWith("oracle.mjs");
if (isMain && argv[0] === "--worker") {
  process.on("message", (m) => {
    if (m === "exit") process.exit(0);
    const rows = [];
    for (let s = m.s0; s < m.s1; s++) rows.push(...runOracle(m.cell, s, { margins: m.margins }));
    process.send({ id: m.id, rows });
  });
  process.send({ ready: 1 });
} else if (isMain) {
  const list = (k, d) => arg(k, d).split(",").map(Number);
  const rooms = list("--rooms", "1,2,3,5"), heats = list("--heats", "0,1,2"), n = +arg("--n", 300), from = +arg("--from", 600000), W = Math.min(8, +arg("--workers", 8));
  const prof = arg("--prof", null) ? JSON.parse(readFileSync(arg("--prof"), "utf8")) : undefined, name = arg("--name", "oracle");
  const jobs = [], CH = 50, margins = !argv.includes("--no-margins");
  for (const room of rooms) for (const heat of heats) for (let s = from; s < from + n; s += CH) jobs.push({ id: jobs.length, margins, cell: { room, heat, arm: "A1", prof, pace: +arg("--pace", 0) }, s0: s, s1: Math.min(from + n, s + CH) });
  const res = [], kids = new Set();
  const stop = () => { for (const k of kids) { try { process.kill(k.pid, "SIGTERM"); } catch {} } };
  process.on("SIGINT", () => { stop(); process.exit(130); });
  process.on("SIGTERM", () => { stop(); process.exit(143); });
  const t0 = Date.now();
  await new Promise((resolve, reject) => {
    let next = 0, live = 0, done = 0;
    for (let i = 0; i < Math.min(W, jobs.length); i++) {
      const k = fork(fileURLToPath(import.meta.url), ["--worker"], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
      kids.add(k); live++;
      const feed = () => { if (next < jobs.length) k.send(jobs[next++]); else k.send("exit"); };
      k.on("message", (m) => {
        if (m.ready) return feed();
        res.push(m); done++;
        if (done % Math.max(1, Math.round(jobs.length / 10)) === 0) console.log(`  ${done}/${jobs.length} jobs, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
        feed();
      });
      k.on("exit", (code, sig) => { kids.delete(k); live--; if (code || sig) { stop(); reject(new Error("worker " + k.pid + " exit " + (code || sig))); } else if (!live) resolve(); });
    }
  });
  const rows = res.sort((a, b) => a.id - b.id).flatMap((m) => m.rows);
  const out = join(dirname(fileURLToPath(import.meta.url)), "out", name);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out + ".jsonl", rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const md = table(rows, { rooms, heats });
  writeFileSync(out + ".md", md + "\n");
  console.log(md);
  console.log(`-> ${out}.jsonl (wall ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
