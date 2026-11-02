/* #24: the first-contact tile tips (coach v2 bits b g c x f q y o, then z = the
   ICE PATCH brake) and the FLOOR line on
   the LEVEL SELECT room card. Gen 3 only: a normal run must see neither. */
import { COACH2_DUR, COACH2_KEY, COACH_TILE_DUR, coach2Mark, coach2Seen, coach2Tick, coachAlpha, coachTip, loadCoach2 } from "../src/app/coach.js";
import "../src/core/board3.js";
import { FEAT_PROFILE, TILE_HELP, TILE_NAME, featKindOf, isBelt, tileTip } from "../src/core/feat.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { CFG, T, key } from "../src/core/config.js";
import { createGame } from "../src/main.js";
import { SCREEN } from "../src/app/menuapp.js";
import * as md from "../src/render/menudraw.js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function check(n, c, d) { c ? pass++ : fail++; console.log((c ? "  PASS " : "  FAIL ") + n + (d !== undefined ? " -> " + d : "")); }

const memStore = (init) => {
  const m = new Map(init);
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};
const ROOM = { BLOOM: 1, GLIDE: 2, BELT: 3, STREAM: 4, PLATE: 5, QUICK: 6, PORTAL: 7, GATE: 8 };
const KINDS = Object.keys(ROOM);
const room = (gen, seed, rm, heat) => { const w = createWorld(seed, rm); w.gen = gen; w.heat = heat; loadLevel(w, rm, false); w.state = "PLAY"; w.events = []; return w; };
const tileCell = (w, kind) => { for (let k = 0; k < w.feat.length; k++) if (featKindOf(w.feat[k]) === kind && w.grid[k] === T.EMPTY) return k; return -1; };
const stand = (w, k) => { const p = w.players[0]; p.tx = k % CFG.COLS; p.ty = (k / CFG.COLS) | 0; };
const clear = (w) => { const p = w.players[0]; p.tx = 1; p.ty = 1; w.events = []; };
const tick = (st, w, s, dt = 0.016, v1 = false) => coach2Tick(st, w, v1, dt, s);
const worldOn = (kind, heat = 0, seed = 4242) => { const w = room(3, seed, ROOM[kind], heat); const k = tileCell(w, kind); if (k >= 0) stand(w, k); return w; };

// ---- the copy: one source, right at each heat, one panel line, every layout ----
{
  const tips = {};
  for (const k of KINDS) tips[k] = FEAT_PROFILE.map((pr) => tileTip(k, pr));
  console.log(JSON.stringify(tips, null, 1));
  for (const k of KINDS) tips[k].forEach((s, h) => {
    check(`${k} heat ${h} starts with its name`, s.startsWith(TILE_NAME[k] + " · "), s);
    check(`${k} heat ${h} fits the 600 board panel (12px mono)`, s.length * 7.2 + 24 <= 600, s.length);
    check(`${k} heat ${h} names no key`, !/\b(SPACE|SHIFT|WASD|ARROW|ENTER|TAP)\b/.test(s), s);
  });
  check("ICE PATCH teaches the brake at MAX only", /PRESS BACK AS YOU LET GO/.test(tips.GLIDE[2]) && !/PRESS BACK/.test(tips.GLIDE[0] + tips.GLIDE[1]));
  check("TRAP never says lure above CORE", /LURE/.test(tips.PLATE[0]) && !/LURE/.test(tips.PLATE[1] + tips.PLATE[2]));
  check("TRAP at MAX: hurts only you, the 6 s window, no chain", /HURT ONLY YOU/.test(tips.PLATE[2]) && /FIRST 6 S SAFE/.test(tips.PLATE[2]) && /NO BOMB CHAIN/.test(tips.PLATE[2]), tips.PLATE[2]);
  check("every TRAP tip says it sets off no bomb", tips.PLATE.every((s) => /NO BOMB CHAIN/.test(s)));
  check("every TRAP tip points at the marks", tips.PLATE.every((s) => /MARKS/.test(s)));
  check("TRAP's MAX FLOOR line says it hurts only you", /HURTS ONLY YOU/.test(TILE_HELP.PLATE[2]) && !/IMMUNE/.test(TILE_HELP.PLATE[2]));
  check("PLUS TRAP spares the foe that sets it off", /SETS IT OFF LIVES/.test(tips.PLATE[1]));
  check("CONVEYOR says who rides at each heat", /NOT YOU/.test(tips.BELT[0]) && /YOU, NOT FOES/.test(tips.BELT[1]) && /BOMBS, YOU AND FOES/.test(tips.BELT[2]), tips.BELT.join(" | "));
  check("CONVEYOR teaches the step-off only when it carries you", !/STEP OFF/.test(tips.BELT[0]) && /HOLD A SIDE TO STEP OFF/.test(tips.BELT[1]) && /HOLD A SIDE TO STEP OFF/.test(tips.BELT[2]));
  check("BOOSTER spreads sideways at PLUS / MAX only, and warns at every heat", !/EACH SIDE/.test(tips.BLOOM[0]) && /1 EACH SIDE/.test(tips.BLOOM[1]) && /2 EACH SIDE/.test(tips.BLOOM[2]) && tips.BLOOM.every((s) => /CAN HURT YOU/.test(s)));
  // facts follow the profile, so a parallel retune cannot strand the copy
  const prof = FEAT_PROFILE.map((r) => ({ ...r, plate: { ...r.plate, inert: 5 } }));
  check("a retuned profile moves the tip's number", /FIRST 5 S SAFE/.test(tileTip("PLATE", prof[2])));
  const w = worldOn("PLATE", 2);
  w.featProf = prof;
  check("coachTip reads the run's own profile", /FIRST 5 S SAFE/.test(coachTip("PLATE", "d", w)));
  for (const k of KINDS) for (const h of [0, 1, 2]) {
    const wk = worldOn(k, h);
    check(`${k} heat ${h}: touch and keyboard read the same line`, coachTip(k, "p", wk) === coachTip(k, "d", wk) && coachTip(k, "l", wk) === tips[k][h]);
  }
  check("no world, no tip: a tile line is never guessed", coachTip("BELT", "d") === "");
  // the 6 s window at 3 words/s (an action game, the tip competes with play); a "·" is not a word
  const words = (s) => s.split(/\s+/).filter((x) => x !== "·").length;
  for (const k of KINDS) tips[k].forEach((s, h) => check(`${k} heat ${h} reads inside the ${COACH_TILE_DUR} s window at 3 words/s`, words(s) / 3 <= COACH_TILE_DUR, words(s) + " words"));
  // one source: the copy literals live in feat.js alone
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.js$/.test(f) ? [p] : []; });
  const lits = Object.values(TILE_HELP).flat().concat(["HURT ONLY YOU", "PRESS BACK AS YOU LET GO", "HOLD A SIDE TO STEP OFF", "NO BOMB CHAIN", '"ICE PATCH"', '"CONVEYOR"']);
  const strays = [];
  for (const f of walk("src")) {
    if (f === join("src", "core", "feat.js")) continue;
    const s = readFileSync(f, "utf8");
    for (const l of lits) if (s.includes(l)) strays.push(f + ": " + l);
  }
  check("no second literal of any tile copy in src/", strays.length === 0, strays.join("; "));
}

// ---- the record: seventeen bits, an old eight- or sixteen-bit record loads byte-stable ----
{
  const s = memStore([[COACH2_KEY, '{"k":1,"t":0,"r":1,"p":0,"l":0,"w":1,"i":0,"s":1}']]);
  const v = loadCoach2(s);
  check("an old eight-bit record keeps its bits and leads the record, the new bits at 0",
    JSON.stringify(v) === '{"k":1,"t":0,"r":1,"p":0,"l":0,"w":1,"i":0,"s":1,"b":0,"g":0,"c":0,"x":0,"f":0,"q":0,"y":0,"o":0,"z":0}', JSON.stringify(v));
  const once = KINDS.reduce((o, k) => coach2Mark(o, k), v);
  check("each tile has its own bit", once.b === 1 && once.g === 1 && once.c === 1 && once.x === 1 && once.f === 1 && once.q === 1 && once.y === 1 && once.o === 1 && KINDS.every((k) => coach2Seen(once, k)));
  check("the verbs' bits did not move", once.k === 1 && once.t === 0 && once.s === 1);
  const raw16 = '{"k":1,"t":0,"r":0,"p":1,"l":0,"w":0,"i":0,"s":0,"b":1,"g":1,"c":0,"x":0,"f":1,"q":0,"y":0,"o":1}';
  const v16 = loadCoach2(memStore([[COACH2_KEY, raw16]]));
  check("a sixteen-bit record keeps its bytes as the prefix, the brake bit at 0", JSON.stringify(v16) === raw16.slice(0, -1) + ',"z":0}', JSON.stringify(v16));
  check("a plain tile mark leaves the brake bit alone", coach2Mark(loadCoach2(memStore()), "GLIDE").z === 0);
  const br = coach2Mark(loadCoach2(memStore()), "BRAKE");
  check("the brake mark sets its own bit and GLIDE's, nothing else", br.z === 1 && br.g === 1 && Object.values(br).reduce((a, b) => a + b, 0) === 2, JSON.stringify(br));
}

// ---- first contact: opens, times out on the PLAY clock, once ever, pairs ----
for (const k of KINDS) {
  const s = memStore(), w = worldOn(k), st = { kind: null, t: 0 };
  if (tileCell(w, k) < 0) { check(`seed 4242 has a ${k} (a fixture check)`, false); continue; }
  let o = tick(st, w, s);
  check(`${k}: first contact opens the tip`, st.kind === k && o.length === 1 && o[0][0] === "coach_shown" && o[0][1].v === k, JSON.stringify(o));
  check(`${k}: not marked until it closes`, !coach2Seen(loadCoach2(s), k));
  const seen = [];
  for (let i = 0; i < 500 && st.kind; i++) seen.push(...tick(st, w, s, 1 / 60));
  check(`${k}: standing on it does not hold the clock, it closes rn:timeout`, !st.kind && seen.length === 1 && seen[0][0] === "coach_dismissed" && seen[0][1].rn === "timeout", JSON.stringify(seen));
  check(`${k}: marked seen, once ever`, coach2Seen(loadCoach2(s), k));
  const again = [];
  for (let i = 0; i < 10; i++) again.push(...tick(st, w, s));
  const fresh = { kind: null, t: 0 };
  again.push(...tick(fresh, worldOn(k, k === "GLIDE" ? 1 : 2), s)); // GLIDE at MAX is the brake tip's, below
  check(`${k}: never again, this run or the next, at any heat`, again.length === 0 && !st.kind && !fresh.kind, JSON.stringify(again));
}
{
  // the fade: full for most of the window, a verb's rule unchanged
  check("a tile tip holds full, then fades out by its own window", coachAlpha({ kind: "BELT", t: 2 }) === 1 && coachAlpha({ kind: "BELT", t: COACH_TILE_DUR - 0.75 }) === 0.5 && coachAlpha({ kind: "BELT", t: COACH_TILE_DUR }) === 0);
  check("a verb tip keeps the linear fade", coachAlpha({ kind: "kick", t: COACH2_DUR / 2 }) === 0.5 && coachAlpha({ kind: null, t: 0 }) === 1);
  // PAUSE cannot burn the clock
  const s = memStore(), w = worldOn("GLIDE"), st = { kind: null, t: 0 };
  tick(st, w, s);
  const t0 = st.t;
  w.state = "PAUSE";
  for (let i = 0; i < 600; i++) tick(st, w, s, 1 / 60);
  check("PAUSE burns no tile tip", st.kind === "GLIDE" && st.t === t0, st.t);
  w.state = "PLAY";
  // contact does not open outside PLAY
  const w2 = worldOn("BELT"), st2 = { kind: null, t: 0 };
  w2.state = "PAUSE";
  tick(st2, w2, s);
  check("no contact outside PLAY", !st2.kind);
}
{
  // other contacts: a bomb on a belt, a booster / trap going off; never a covered tile
  const s = memStore(), w = room(3, 4242, 3, 0), st = { kind: null, t: 0 }, k = tileCell(w, "BELT");
  clear(w);
  w.bombs = [{ tx: k % CFG.COLS, ty: (k / CFG.COLS) | 0, dead: false }];
  tick(st, w, s);
  check("a bomb riding a CONVEYOR opens its tip", st.kind === "BELT" && isBelt(w.feat[k]));
  const b = room(3, 4242, 1, 0), sb = { kind: null, t: 0 };
  clear(b);
  b.events = [{ t: "bloom", x: 1, y: 1 }];
  tick(sb, b, s);
  check("a booster going off opens its tip", sb.kind === "BLOOM");
  const p = room(3, 4242, 5, 2), sp = { kind: null, t: 0 };
  clear(p);
  p.events = [{ t: "plate", x: 1, y: 1 }];
  tick(sp, p, s);
  check("a trap arming opens its tip", sp.kind === "PLATE");
  const c = worldOn("GLIDE"), sc = { kind: null, t: 0 };
  c.grid[key(c.players[0].tx, c.players[0].ty)] = T.BRICK;
  tick(sc, c, s);
  check("a tile under a brick is no contact (the sim's own test)", !sc.kind);
  const d = worldOn("GLIDE"), sd = { kind: null, t: 0 };
  d.players[0].alive = false;
  tick(sd, d, s);
  check("a dead player meets nothing", !sd.kind);
}
{
}

// ---- the ICE PATCH brake (bit z): V19 at MAX assumes it, so CORE's tip cannot spend it ----
{
  const iceRun = (s, heat, prof) => { const w = worldOn("GLIDE", heat); if (prof) w.featProf = prof; const st = { kind: null, t: 0 }, log = [...tick(st, w, s)]; return { w, st, log }; };
  const drain = (a, s) => { for (let i = 0; i < 500 && a.st.kind; i++) a.log.push(...tick(a.st, a.w, s, 1 / 60)); for (let i = 0; i < 30; i++) a.log.push(...tick(a.st, a.w, s, 1 / 60)); };
  const shows = (a) => a.log.filter((o) => o[0] === "coach_shown").map((o) => o[1].v).join();
  // first ICE at MAX: one tip covering the brake, never two in a row
  let s = memStore(), a = iceRun(s, 2);
  const first = coachTip(a.st.kind, "d", a.w);
  check("first ICE at MAX: the tip names the brake", a.st.kind === "BRAKE" && /PRESS BACK AS YOU LET GO/.test(first), first);
  check("no second string: it IS the GLIDE line of this heat", first === tileTip("GLIDE", FEAT_PROFILE[2]));
  check("touch and keyboard read the same brake line", coachTip("BRAKE", "p", a.w) === first && coachTip("BRAKE", "l", a.w) === first);
  drain(a, s);
  check("first ICE at MAX: one tip, shown once, dismissed once, rn:timeout", shows(a) === "BRAKE" && a.log.length === 2 && a.log[1][0] === "coach_dismissed" && a.log[1][1].v === "BRAKE" && a.log[1][1].rn === "timeout", JSON.stringify(a.log));
  const both = loadCoach2(s);
  check("first ICE at MAX spends both bits", both.g === 1 && both.z === 1, JSON.stringify(both));
  for (const h of [0, 1, 2]) { const b = iceRun(s, h); drain(b, s); check(`after it, ICE at heat ${h} says nothing again`, b.log.length === 0 && !b.st.kind, JSON.stringify(b.log)); }
  // seen at CORE / PLUS, then MAX: the brake still comes, once
  for (const h of [0, 1]) {
    s = memStore(); a = iceRun(s, h);
    check(`ICE at heat ${h}: the plain tip, no brake in it`, a.st.kind === "GLIDE" && !/PRESS BACK/.test(coachTip(a.st.kind, "d", a.w)));
    drain(a, s);
    const v = loadCoach2(s);
    check(`ICE at heat ${h}: GLIDE's bit only, the brake still owed`, v.g === 1 && v.z === 0, JSON.stringify(v));
    const b = iceRun(s, 2);
    check(`seen at heat ${h}, then MAX: the brake tip opens`, b.st.kind === "BRAKE" && b.log.length === 1, JSON.stringify(b.log));
    drain(b, s);
    check(`seen at heat ${h}, then MAX: once, bit set`, shows(b) === "BRAKE" && loadCoach2(s).z === 1, JSON.stringify(b.log));
    const c = iceRun(s, 2);
    check(`seen at heat ${h}, then MAX twice: never again`, c.log.length === 0 && !c.st.kind, JSON.stringify(c.log));
  }
  // a CORE-seen record from before this bit gets the tip too
  s = memStore([[COACH2_KEY, '{"k":0,"t":0,"r":0,"p":0,"l":0,"w":0,"i":0,"s":0,"b":0,"g":1,"c":0,"x":0,"f":0,"q":0,"y":0,"o":0}']]);
  check("an old record with ICE seen still owes the brake at MAX", iceRun(s, 2).st.kind === "BRAKE");
  // the profile decides, never the heat index
  const noBrake = FEAT_PROFILE.map((r) => ({ ...r, glide: { ...r.glide, stop: undefined } }));
  s = memStore(); a = iceRun(s, 2, noBrake);
  check("a profile without the brake never tips it", a.st.kind === "GLIDE" && !/PRESS BACK/.test(coachTip(a.st.kind, "d", a.w)));
  drain(a, s);
  check("and leaves its bit at 0", loadCoach2(s).z === 0 && loadCoach2(s).g === 1);
  const plusBrake = FEAT_PROFILE.map((r, i) => (i === 1 ? { ...r, glide: { ...r.glide, coast: 3, stop: "brake" } } : r));
  s = memStore();
  check("a retuned profile with the brake at PLUS tips it at PLUS", iceRun(s, 1, plusBrake).st.kind === "BRAKE");
  const stepBrake = FEAT_PROFILE.map((r, i) => (i === 2 ? { ...r, glide: { ...r.glide, coast: 1, stop: "brake" } } : r));
  s = memStore(); a = iceRun(s, 2, stepBrake);
  check("a brake on a one-step coast: its line names no brake, so the plain tip, the bit kept", a.st.kind === "GLIDE" && !/PRESS BACK/.test(coachTip(a.st.kind, "d", a.w)));
  drain(a, s);
  check("and the brake is still owed", loadCoach2(s).z === 0);
  // same close rules as every tile tip
  s = memStore(); a = iceRun(s, 2);
  const next = room(3, 4242, 3, 2);
  clear(next);
  let o = tick(a.st, next, s);
  check("a live brake tip closes rn:room on a room change, both bits still 0", !a.st.kind && o.length === 1 && o[0][1].v === "BRAKE" && o[0][1].rn === "room" && loadCoach2(s).z === 0 && loadCoach2(s).g === 0, JSON.stringify(o));
  s = memStore(); a = iceRun(s, 2);
  check("it stays open on its own room, away from the ice", (() => { clear(a.w); return tick(a.st, a.w, s).length === 0 && a.st.kind === "BRAKE"; })());
  s = memStore(); a = iceRun(s, 2);
  a.w.players[0].kick = true;
  a.w.events = [{ t: "power", kind: "kick" }];
  o = tick(a.st, a.w, s);
  check("a pickup replaces it: dismissed first, re-queued, bits 0", a.st.kind === "kick" && a.st.q.join() === "BRAKE" && o[0][1].v === "BRAKE" && o[0][1].rn === "replace" && o[1][1].v === "kick" && loadCoach2(s).z === 0, JSON.stringify(o));
  a.w.events = [];
  o = [];
  for (let i = 0; i < 30; i++) o.push(...tick(a.st, a.w, s));
  check("still on the ice: no ping-pong", a.st.kind === "kick" && o.length === 0, JSON.stringify(o));
  o = [];
  for (let i = 0; i < 200 && a.st.kind === "kick"; i++) o.push(...tick(a.st, a.w, s, 1 / 60));
  check("the verb closes and the brake tip reopens", a.st.kind === "BRAKE" && o.at(-1)[1].v === "BRAKE", JSON.stringify(o));
  s = memStore();
  const w1 = worldOn("GLIDE", 2), st1 = { kind: null, t: 0 };
  tick(st1, w1, s, 0.016, true);
  check("v1 open: the brake queues", !st1.kind && st1.q.join() === "BRAKE");
  tick(st1, w1, s, 0.016, false);
  check("v1 closed: the queued brake opens (its room has ice)", st1.kind === "BRAKE" && st1.q.length === 0);
  check("the tile window and fade apply", coachAlpha({ kind: "BRAKE", t: 2 }) === 1 && coachAlpha({ kind: "BRAKE", t: COACH_TILE_DUR }) === 0);
  // another room's tile at MAX is untouched
  s = memStore();
  check("only ICE has a brake tip", iceRun(s, 2).st.kind === "BRAKE" && (() => { const st = { kind: null, t: 0 }; tick(st, worldOn("BELT", 2), memStore()); return st.kind === "BELT"; })());
}

// ---- gen 1 and gen 2 never: no feat layer, no tip, whatever the world does ----
for (const gen of [1, 2]) for (const rm of [1, 2, 3, 5]) {
  const s = memStore(), w = room(gen, 4242, rm, 2), st = { kind: null, t: 0 }, out = [];
  check(`gen ${gen} room ${rm} has no tile layer`, !w.feat);
  for (let y = 1; y < CFG.ROWS - 1; y++) for (let x = 1; x < CFG.COLS - 1; x++) { w.players[0].tx = x; w.players[0].ty = y; w.events = [{ t: "bloom" }, { t: "plate" }]; out.push(...tick(st, w, s)); }
  check(`gen ${gen} room ${rm}: no tile tip anywhere on the board`, out.length === 0 && !st.kind, JSON.stringify(out));
  check(`gen ${gen} room ${rm}: no store write`, s.m.size === 0);
}

// ---- the pair rules: v1 wins ties, replace re-queues both ways, no ping-pong ----
{
  const s = memStore(), w = worldOn("GLIDE"), st = { kind: null, t: 0 };
  let o = tick(st, w, s, 0.016, true);
  check("v1 open: contact queues, no second panel", !st.kind && st.q.join() === "GLIDE" && o.length === 0, JSON.stringify(st.q));
  for (let i = 0; i < 5; i++) tick(st, w, s, 0.016, true);
  check("a held contact queues once", st.q.length === 1);
  o = tick(st, w, s, 0.016, false);
  check("v1 closed: the queued tile tip opens", st.kind === "GLIDE" && st.q.length === 0 && o.length === 1, JSON.stringify(o));
}
{
  const s = memStore(), w = worldOn("GLIDE"), st = { kind: null, t: 0 };
  w.players[0].kick = true;
  tick(st, w, s);
  w.events = [{ t: "power", kind: "kick" }];
  let o = tick(st, w, s);
  check("a pickup replaces a live tile tip: dismissed first, tile re-queued, bit 0",
    st.kind === "kick" && st.q.join() === "GLIDE" && o[0][0] === "coach_dismissed" && o[0][1].v === "GLIDE" && o[0][1].rn === "replace" && o[1][0] === "coach_shown" && o[1][1].v === "kick" && !coach2Seen(loadCoach2(s), "GLIDE"), JSON.stringify(o));
  w.events = [];
  o = [];
  for (let i = 0; i < 30; i++) o.push(...tick(st, w, s));
  check("still on the tile: no ping-pong back to the tile tip", st.kind === "kick" && o.length === 0, JSON.stringify(o));
  o = [];
  for (let i = 0; i < 200 && st.kind === "kick"; i++) o.push(...tick(st, w, s, 1 / 60));
  check("the verb closes and the tile tip reopens", st.kind === "GLIDE" && o.at(-1)[0] === "coach_shown" && o.at(-1)[1].v === "GLIDE", JSON.stringify(o));
}
{
  const s = memStore(), w = room(3, 4242, 2, 0), st = { kind: null, t: 0 };
  clear(w);
  w.players[0].kick = true;
  w.events = [{ t: "power", kind: "kick" }];
  tick(st, w, s);
  stand(w, tileCell(w, "GLIDE"));
  w.events = [];
  const o = tick(st, w, s);
  check("contact replaces a live verb tip under the same rule, the verb re-queued, bit 0",
    st.kind === "GLIDE" && st.q.join() === "kick" && o[0][1].rn === "replace" && o[1][1].v === "GLIDE" && !coach2Seen(loadCoach2(s), "kick"), JSON.stringify(o));
}
{
  // leaving the room: never names a tile this room lacks
  const s = memStore(), w = worldOn("GLIDE"), st = { kind: null, t: 0 };
  tick(st, w, s);
  const next = room(3, 4242, 3, 0);
  clear(next);
  const o = tick(st, next, s);
  check("a live tile tip closes rn:room on a room change, bit still 0, and 'lost' never applies",
    !st.kind && o.length === 1 && o[0][1].v === "GLIDE" && o[0][1].rn === "room" && !coach2Seen(loadCoach2(s), "GLIDE"), JSON.stringify(o));
  const s2 = memStore(), a = worldOn("GLIDE"), st2 = { kind: null, t: 0 };
  tick(st2, a, s2, 0.016, true);
  const b = room(3, 4242, 3, 0);
  clear(b);
  const o2 = tick(st2, b, s2);
  check("a queued tile tip is dropped in a room without that tile", !st2.kind && st2.q.length === 0 && o2.length === 0, JSON.stringify(o2));
  const s3 = memStore(), c = worldOn("GLIDE"), st3 = { kind: null, t: 0 };
  tick(st3, c, s3);
  c.players[0].kick = false;
  c.players[0].alive = false;
  const o3 = tick(st3, c, s3);
  check("a hit never closes a tile tip", st3.kind === "GLIDE" && o3.length === 0, JSON.stringify(o3));
}

// ---- through the real loop: gen 3 shows the tip, the latch resets on every run start ----
function fakeCanvasTexts() {
  const texts = [];
  const rec = new Proxy(function () {}, {
    get: (t, p) => {
      if (p === Symbol.toPrimitive) return () => "";
      return (...a) => { if (p === "fillText") texts.push(String(a[0])); return rec; };
    },
    apply: () => rec,
    set: () => true,
  });
  return { texts, canvas: { getContext: () => rec, addEventListener() {}, style: {} } };
}
{
  const ls = memStore([["nb.coach.v1", "1"]]);
  globalThis.window = { localStorage: ls, addEventListener() {} };
  try {
    const { texts, canvas } = fakeCanvasTexts();
    const g = createGame(canvas, { autoplay: true, seed: 4242 });
    let t = 1000;
    g.loop(t);
    check("an ordinary run deals gen 3 with a tile layer", g.world.gen === 3 && !!g.world.feat, g.world.gen);
    const put = () => { const k = tileCell(g.world, "BLOOM"), p = g.world.players[0]; p.x = ((k % CFG.COLS) + 0.5) * CFG.TILE; p.y = (((k / CFG.COLS) | 0) + 0.5) * CFG.TILE; p.tx = k % CFG.COLS; p.ty = (k / CFG.COLS) | 0; };
    const seeTip = () => { put(); texts.length = 0; g.loop((t += 16)); g.loop((t += 16)); return texts.some((s) => s.startsWith("BOOSTER · ")); };
    check("the tip paints through the real loop", seeTip(), texts.filter((s) => s.includes("·")).join("|"));
    // PAUSE RESTART
    g.world.state = "PAUSE"; g.loop((t += 16));
    g.app.pauseCursor = 1;
    g.app.pauseView = 0;
    g.app.confirm();
    g.loop((t += 16));
    check("PAUSE RESTART is a run start, world back in PLAY", g.world.state === "PLAY");
    check("mid-tip restart: bit still 0", !coach2Seen(loadCoach2(ls), "BLOOM"));
    texts.length = 0;
    g.loop((t += 16));
    check("the latch reset on PAUSE RESTART: no carried panel", !texts.some((s) => s.startsWith("BOOSTER · ")), texts.join("|"));
    check("and contact opens it again", seeTip());
    // onStart
    g.app.startRun();
    g.loop((t += 16));
    texts.length = 0;
    const p = g.world.players[0];
    p.tx = 1; p.ty = 1; p.x = 1.5 * CFG.TILE; p.y = 1.5 * CFG.TILE;
    g.loop((t += 16));
    check("the latch reset on MENU START (onStart)", !texts.some((s) => s.startsWith("BOOSTER · ")), texts.join("|"));
    // the sim's LOSE retry, which never calls onStart
    check("contact before a LOSE retry", seeTip());
    g.world.state = "LOSE";
    g.loop((t += 16));
    g.world.state = "PLAY";
    { const q = g.world.players[0]; q.tx = 1; q.ty = 1; q.x = 1.5 * CFG.TILE; q.y = 1.5 * CFG.TILE; }
    texts.length = 0;
    g.loop((t += 16));
    check("the latch reset on a LOSE retry", !texts.some((s) => s.startsWith("BOOSTER · ")), texts.join("|"));
    // the window closes through the real loop and marks the bit
    check("contact after a retry reopens", seeTip());
    for (let i = 0; i < 480 && !coach2Seen(loadCoach2(ls), "BLOOM"); i++) g.loop((t += 16));
    check("the real loop marks it seen after the window", coach2Seen(loadCoach2(ls), "BLOOM"));
    check("the store round-trips seventeen fields", Object.keys(JSON.parse(ls.getItem(COACH2_KEY))).length === 17, ls.getItem(COACH2_KEY));
    g.stop && g.stop();
  } finally {
    delete globalThis.window;
  }
}
{
  const ls = memStore([["nb.coach.v1", "1"]]);
  globalThis.window = { localStorage: ls, addEventListener() {} };
  try {
    const { texts, canvas } = fakeCanvasTexts();
    const g = createGame(canvas, { seed: 4242 });
    let t = 1000;
    g.app.skip();
    g.app.playChallenge({ seed: 4242, heat: 0, pact: 0, pace: 0, gen: 2 });
    g.loop(t);
    g.world.events.push({ t: "bloom", x: 1, y: 1 }, { t: "plate", x: 1, y: 1 });
    texts.length = 0;
    for (let i = 0; i < 5; i++) g.loop((t += 16));
    check("an F2 run: gen 2, no tile layer, no tile tip", g.world.gen === 2 && !g.world.feat && !texts.some((s) => Object.values(TILE_NAME).some((n) => s.startsWith(n + " · "))), texts.join("|"));
    check("an F2 run's coach record gained no bit", Object.values(loadCoach2(ls)).every((v) => v === 0));
    g.stop && g.stop();
  } finally {
    delete globalThis.window;
  }
}
{
  // the DAILY deals the tile board too (v198)
  const ls = memStore([["nb.coach.v1", "1"]]);
  globalThis.window = { localStorage: ls, addEventListener() {} };
  try {
    const { texts, canvas } = fakeCanvasTexts();
    const g = createGame(canvas, { seed: 4242 });
    let t = 1000;
    g.app.skip();
    g.loop(t);
    g.app.cursor = 2; // DAILY
    g.app.confirm();
    g.world.events.push({ t: "bloom", x: 1, y: 1 });
    texts.length = 0;
    g.loop((t += 16));
    check("a DAILY: gen 3 with a tile layer", g.world.gen === 3 && !!g.world.feat, g.world.gen);
    g.stop && g.stop();
  } finally {
    delete globalThis.window;
  }
}

// ---- the FLOOR line on the ROOM CARD ----
function rec() {
  const log = [], texts = [], st = { font: "10px x", textAlign: "left", textBaseline: "middle", fillStyle: "#000", globalAlpha: 1, shadowBlur: 0 };
  const c = new Proxy({}, {
    get: (_, p) => {
      if (p === "measureText") return (s) => { const m = /(\d+)px/.exec(st.font); return { width: String(s).length * (m ? +m[1] : 10) * 0.6 }; };
      if (p in st) return st[p];
      return (...a) => {
        log.push(String(p) + "(" + a.map((x) => (typeof x === "object" ? "o" : String(x))).join(",") + ")");
        if (p === "fillText") texts.push({ s: String(a[0]), x: a[1], y: a[2], font: st.font, blur: st.shadowBlur });
        return { addColorStop() {} };
      };
    },
    set: (_, p, v) => { st[p] = v; log.push(String(p) + "=" + v); return true; },
  });
  return { c, log, texts };
}
const LAYOUTS = [["keyboard", 600, 520, false], ["touch", 600, 520, true], ["phone 393 box", 400, 760, true], ["phone wide box", 420, 760, true]];
const drawn = (W, H, T, rm, h, tiles, extra) => { const r = rec(); const L = md.layout(W, H, 140); md.drawLevelSelect(r.c, rm, L, 1.5, h, 0, true, 0, false, T, { kind: "2d", best: [], ...(tiles === undefined ? {} : { tiles }), ...extra }); return { ...r, L, G: md.levelGeom(L, true, T) }; };
for (const [name, W, H, T] of LAYOUTS) {
  for (const rm of [1, 2, 3, 4, 5, 6, 7, 8]) for (const h of [0, 1, 2]) {
    const { texts, G } = drawn(W, H, T, rm, h, true), P = G.pane, want = md.floorLine(rm, h);
    const kind = { 1: "BLOOM", 2: "GLIDE", 3: "BELT", 4: "STREAM", 5: "PLATE", 6: "QUICK", 7: "PORTAL", 8: "GATE" }[rm];
    check(`${name} room ${rm} heat ${h}: the line is its name and its one help string`, want === "FLOOR " + TILE_NAME[kind] + " · " + TILE_HELP[kind][h], want);
    const fl = texts.filter((x) => x.y >= P.y + 30 && x.y <= P.y + P.h && x.x === P.x + 10 && want.includes(x.s) && !/^(LIVES|✓|NO TIME)/.test(x.s) && x.s !== "");
    const joined = fl.map((x) => x.s).join(" · ");
    check(`${name} room ${rm} heat ${h}: drawn whole, never clipped`, joined === want && !fl.some((x) => x.s.includes("…")), joined);
    if (fl.length > 1) check(`${name} room ${rm} heat ${h}: two rows break between the name and its whole help string`, fl.length === 2 && fl[0].s === "FLOOR " + TILE_NAME[kind] && fl[1].s === TILE_HELP[kind][h], joined);
    for (const x of fl) {
      const px = +/(\d+)px/.exec(x.font)[1];
      check(`${name} room ${rm} heat ${h}: inside the pane`, x.x + x.s.length * px * 0.6 <= P.x + P.w - 8, x.s);
    }
    const heatY = texts.find((x) => x.s.startsWith("LIVES ")).y;
    const fTop = Math.min(...fl.map((x) => x.y));
    check(`${name} room ${rm} heat ${h}: sits above the heat line`, Math.max(...fl.map((x) => x.y)) <= heatY - 10);
    const others = texts.filter((x) => x.y > P.y + 30 && x.y < fTop && x.x >= P.x && x.x < P.x + P.w);
    check(`${name} room ${rm} heat ${h}: nothing crowds it from above`, others.every((x) => x.y <= fTop - 8), others.filter((x) => x.y > fTop - 8).map((x) => x.s + "@" + x.y).join());
    check(`${name} room ${rm} heat ${h}: the MODES / START rows are untouched (one geometry)`, JSON.stringify(G) === JSON.stringify(md.levelGeom(md.layout(W, H, 140), true, T)));
  }
  for (const rm of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const off = drawn(W, H, T, rm, 0, false), none = drawn(W, H, T, rm, 0, undefined);
    check(`${name} room ${rm}: tiles off draws no FLOOR line`, !off.texts.some((x) => /^FLOOR /.test(x.s)));
    check(`${name} room ${rm}: tiles off equals the old call (no field)`, off.log.join() === none.log.join());
  }
  const lock = drawn(W, H, T, 2, 1, true, { lockR: 7, lockT: 1.4 });
  check(`${name}: the locked peek card shows no FLOOR line`, !lock.texts.some((x) => x.s.startsWith("FLOOR ")));
}
{
  const pulse = drawn(600, 520, false, 3, 2, true, { heatT: 1.4 }), still = drawn(600, 520, false, 3, 2, true);
  const hot = pulse.texts.find((x) => x.s.startsWith("FLOOR ")), cold = still.texts.find((x) => x.s.startsWith("FLOOR "));
  check("the FLOOR line pulses on a heat change, like the heat line", hot.blur > 0 && cold.blur === 0, hot.blur);
  const help = Object.values(TILE_HELP).flat();
  const sch = (rm) => drawn(600, 520, false, rm, 0, true).log.find((l) => l.startsWith("strokeRect(") && l.includes(",106,92)")) || "";
  check("keyboard: the schematic keeps one size across a tile page's rooms", !!sch(3) && !!sch(4), sch(3) + " / " + sch(4));
  check("every help string stays <= 28 chars (the card's budget)", help.every((s) => s.length <= 28), Math.max(...help.map((s) => s.length)));
}
{
  // the real page: the FLOOR line reaches the card
  for (const want of [true]) {
    const ls = memStore();
    globalThis.window = { localStorage: ls, addEventListener() {} };
    try {
      const { texts, canvas } = fakeCanvasTexts();
      canvas.width = 600; canvas.height = 520;
      const g = createGame(canvas, { seed: 4242 });
      let t = 1000;
      g.app.skip();
      g.loop(t); g.loop((t += 16)); // shellview re-reads its cabinet on a screen entry, so enter LEVEL from MENU
      g.app.screen = SCREEN.LEVEL;
      g.loop((t += 16));
      texts.length = 0;
      g.loop((t += 16));
      check("LEVEL SELECT shows a FLOOR line", texts.some((s) => s.startsWith("FLOOR ")) === want, texts.filter((s) => s.startsWith("FLOOR ")).join("|"));
      g.stop && g.stop();
    } finally {
      delete globalThis.window;
    }
  }
}

console.log(`\ncoach-tiles: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
