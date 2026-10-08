import {
  GHOST_KEY,
  GHOST_V,
  GHOST_MAX,
  GHOST_HZ,
  GHOST_CAP,
  KEY_RE,
  ghostKey,
  clampGhost,
  loadGhost,
  decodeGhost,
  createGhost,
  ghostTick,
  ghostAt,
} from "../src/app/ghost.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { createRenderer } from "../src/render/renderer.js";
import { GHOST_A, drawGhost } from "../src/render/sprites.js";

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

function mapStore() {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}
const mk = (o) =>
  Object.assign(
    { seed: 7, level: 1, heat: 0, pact: 0, pace: 0, state: "PLAY", grid: {},
      players: [{ x: 60, y: 60, face: { x: 0, y: 0 } }], events: [] },
    o || {},
  );
const blob = (st) => JSON.parse(st.getItem(GHOST_KEY));
/* A clear of exactly d tenths: PLAY padded in one tick, then the WIN frame at
   the same roomT (PLAY accumulation stops once the state is WIN). */
function clear(st, w, d, x) {
  const g = createGhost();
  w.grid = {};
  w.state = "PLAY";
  w.players[0].x = x || 60;
  const t = d / 10 + 0.05;
  ghostTick(g, w, t, st);
  w.state = "WIN";
  ghostTick(g, w, t, st);
  return g;
}

// ---- constants + key ----
check("constants are the spec's", GHOST_KEY === "nb.ghost.v1" && GHOST_V === 1 &&
  GHOST_MAX === 16 && GHOST_HZ === 10 && GHOST_CAP === 2400);
{
  const k = ghostKey(mk({ seed: 4294967295, level: 8, heat: 2, pact: 15, pace: 1 }));
  check("ghostKey is the full 5-tuple and matches KEY_RE", k === "4294967295:8:2:15:2" && KEY_RE.test(k), k);
  check("pace -1/0/1 maps to segment 0/1/2",
    [-1, 0, 1].map((p) => ghostKey(mk({ pace: p })).split(":")[4]).join() === "0,1,2");
}

// ---- 1. codec, through the real recorder + encoder + loadGhost ----
{
  const st = mapStore(), g = createGhost(), w = mk();
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const p = { x: 61 + 37 * i, y: 59 + 23 * i, fx: Math.floor(i / 3) - 1, fy: (i % 3) - 1 };
    pts.push(p);
    w.players[0].x = p.x; w.players[0].y = p.y; w.players[0].face = { x: p.fx * 0.7, y: p.fy };
    ghostTick(g, w, i / 10 + 0.05, st);
  }
  w.state = "WIN";
  ghostTick(g, w, 0.85, st);
  const e = loadGhost(st).g[ghostKey(w)];
  check("the recorder's entry survives loadGhost/clampGhost", !!e && e.d === 8 && e.s.length === 45,
    JSON.stringify(e));
  check("the encoder emits upper-case base 36 (the clamp drops lower case)", !!e && /[A-Z]/.test(e.s) && !/[a-z]/.test(e.s));
  const dec = e ? decodeGhost(e.s) : [];
  check("x/y round-trip within 1 px and every face pair in {-1,0,1}^2",
    dec.length === 9 && dec.every((s, i) => Math.abs(s.x - pts[i].x) <= 1 && Math.abs(s.y - pts[i].y) <= 1 &&
      s.fx === pts[i].fx && s.fy === pts[i].fy),
    JSON.stringify(dec.slice(0, 3)));
}

// ---- 2. clampGhost ----
{
  const ok = { d: 10, s: "0U0U4".repeat(11) };
  check("v:2 reads as empty", JSON.stringify(clampGhost({ v: 2, g: { "7:1:0:0:1": ok } })) === '{"v":1,"g":{}}');
  check("junk reads as empty", JSON.stringify(clampGhost(null)) === '{"v":1,"g":{}}');
  const c = clampGhost({ v: 1, g: {
    "7:1:0:0:1": ok, "7:9:0:0:1": ok, "7:1:0:0:3": ok, "x:1:0:0:1": ok,
    "8:1:0:0:1": { d: 0, s: ok.s }, "9:1:0:0:1": { d: 2401, s: ok.s },
    "10:1:0:0:1": { d: 10, s: "0U0U40U" }, "11:1:0:0:1": { d: 10, s: "0u0u4" },
    "12:1:0:0:1": { d: 1.5, s: ok.s }, "13:1:0:0:1": "x" } });
  check("drops a bad key, d 0, d 2401, s of length 7, lower-case s", JSON.stringify(Object.keys(c.g)) === '["7:1:0:0:1"]',
    JSON.stringify(Object.keys(c.g)));
  const g20 = {};
  for (let i = 1; i <= 20; i++) g20[i + ":1:0:0:1"] = ok;
  const k16 = Object.keys(clampGhost({ v: 1, g: g20 }).g);
  check("keeps the LAST 16 of 20", k16.length === 16 && k16[0] === "5:1:0:0:1" && k16[15] === "20:1:0:0:1", k16.join());
}

// ---- 3. LRU ----
{
  const fill = () => {
    const st = mapStore();
    for (let i = 1; i <= 16; i++) clear(st, mk({ seed: i }), 20);
    return st;
  };
  const a = fill();
  const g = createGhost();
  ghostTick(g, mk({ seed: 1 }), 0, a);
  check("a race-load touches the oldest key to the end", Object.keys(blob(a).g).pop() === "1:1:0:0:1" && !!g.race);
  clear(a, mk({ seed: 17 }), 20);
  const ka = Object.keys(blob(a).g);
  check("a race-loaded oldest key survives the next insert", ka.length === 16 && ka.includes("1:1:0:0:1") &&
    !ka.includes("2:1:0:0:1"), ka.join());
  const b = fill();
  clear(b, mk({ seed: 17 }), 20);
  const kb = Object.keys(blob(b).g);
  check("an un-touched oldest key is evicted", kb.length === 16 && !kb.includes("1:1:0:0:1"), kb.join());
}

// ---- 4. faster-only ----
{
  const st = mapStore(), w = mk(), k = ghostKey(w);
  const at = () => loadGhost(st).g[k];
  clear(st, w, 412, 60);
  check("d 412 is stored", at().d === 412 && at().s.length === 413 * 5);
  clear(st, w, 500, 80);
  check("d 500 leaves 412", at().d === 412);
  const s412 = at().s;
  clear(st, w, 412, 100);
  check("d 412 again leaves it untouched (strict)", at().d === 412 && at().s === s412);
  clear(st, w, 300, 120);
  check("d 300 replaces it", at().d === 300 && at().s.length === 301 * 5);
}

// ---- 5. PLAY-only sampling ----
{
  const g = createGhost(), w = mk();
  let roomT = 0;
  for (let i = 0; i < 192; i++) { roomT += 1 / 64; ghostTick(g, w, roomT, null); }
  check("3 s of PLAY at dt 1/64 gives 31 samples", roomT === 3 && g.n === 31 && g.s.length === 155, g.n);
  w.state = "PAUSE";
  for (let i = 0; i < 128; i++) ghostTick(g, w, roomT, null);
  check("2 s of PAUSE (roomT frozen) adds 0", g.n === 31, g.n);
  w.state = "PLAY";
  roomT += 0.25;
  ghostTick(g, w, roomT, null);
  check("a single dt of 0.25 s pads to the correct count", g.n === 33, g.n);
  const h = createGhost(), v = mk();
  let t60 = 0;
  for (let i = 0; i < 180; i++) { t60 += 1 / 60; ghostTick(h, v, t60, null); }
  check("dt 1/60 x180 lands below 3.0 and records 30 (no epsilon)", t60 < 3 && h.n === 30, t60 + "/" + h.n);
}

// ---- 6. room detection ----
{
  const st = mapStore(), w = mk();
  clear(st, w, 50);
  const g = createGhost();
  w.grid = {}; w.state = "PLAY";
  ghostTick(g, w, 1, st);
  check("a new grid object loads the tuple's race", !!g.race && g.race.length === 51 && g.n === 11);
  w.grid.k = 3;
  ghostTick(g, w, 2, st);
  check("the same grid mutated in place keeps recording", g.n === 21 && g.grid === w.grid);
  const old = w.grid;
  w.grid = {};
  check("ghostAt is null while world.grid !== g.grid", ghostAt(g, w, 1) === null && g.grid === old);
  ghostTick(g, w, 0.01, st);
  check("a new grid resets the recording", g.n === 1 && g.grid === w.grid && g.s.length === 5);
}

// ---- 7. cap ----
{
  const st = mapStore(), g = createGhost(), w = mk();
  ghostTick(g, w, 239.95, st);
  check("239.95 s still records (2400 samples)", g.n === GHOST_CAP && !g.done);
  ghostTick(g, w, 240, st);
  w.state = "WIN";
  ghostTick(g, w, 240, st);
  check("past 240 s the room is done and never saved", g.done && st.getItem(GHOST_KEY) === null);
}

// ---- 8. survival ----
{
  const st = mapStore(), w = mk();
  clear(st, w, 30);
  const thr = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
  const g = createGhost();
  let ok = true;
  try { ghostTick(g, w, 0.01, thr); } catch (_) { ok = false; }
  check("a throwing getItem gives no race and no throw", ok && g.race === null);
  const prev = st.getItem(GHOST_KEY);
  const half = { getItem: st.getItem, setItem: () => { throw new Error("quota"); } };
  ok = true;
  try { clear(half, w, 10, 90); clear(half, mk({ seed: 99 }), 10); } catch (_) { ok = false; }
  check("a throwing setItem does not throw and leaves the blob intact", ok && st.getItem(GHOST_KEY) === prev);
  const n = createGhost();
  ok = true;
  try { clear(null, w, 10); w.state = "PLAY"; ghostTick(n, w, 1, null); } catch (_) { ok = false; }
  check("a null store is a no-op", ok && n.race === null && n.n === 11);
}

// ---- 9. ghostAt ----
{
  const st = mapStore(), w = mk();
  const g = createGhost();
  for (let i = 0; i <= 10; i++) { w.players[0].x = 60 + 10 * i; w.players[0].face = { x: 1, y: 0 }; ghostTick(g, w, i / 10 + 0.01, st); }
  w.state = "WIN"; ghostTick(g, w, 1.01, st);
  const r = createGhost();
  w.grid = {}; w.state = "PLAY";
  ghostTick(r, w, 0, st);
  const m = ghostAt(r, w, 0.25);
  check("lerps the midpoint between two samples", !!m && m.x === 85 && m.y === 60 && m.fx === 1 && m.fy === 0,
    JSON.stringify(m));
  check("returns the last sample exactly at its clear time", !!ghostAt(r, w, 1) && ghostAt(r, w, 1).x === 160);
  check("returns null past the race's last sample", ghostAt(r, w, 1.01) === null);
  w.state = "PAUSE";
  const p1 = ghostAt(r, w, 0.5), p2 = ghostAt(r, w, 0.5);
  check("freezes in PAUSE (roomT frozen, same pose)", !!p1 && JSON.stringify(p1) === JSON.stringify(p2) && p1.x === 110);
  check("carries the PLAY-only clock as t", p1.t === 0.5 && m.t === 0.25, p1.t + "/" + m.t);
  w.state = "WIN";
  const win = ghostAt(r, w, 0.5);
  w.state = "LOSE";
  check("returns null in WIN/LOSE", win === null && ghostAt(r, w, 0.5) === null);
  w.state = "PLAY";
  check("returns null with no race", ghostAt(createGhost(), w, 0.5) === null && ghostAt(null, w, 0.5) === null);
}

// ---- 9b. drawGhost walks on g.t, not world.time: PAUSE holds the bob ----
{
  const w = mk(), g = { x: 100, y: 60, fx: 1, fy: 0, t: 0.5 };
  w.state = "PAUSE";
  const at = (time) => { const r = rec(); w.time = time; drawGhost(r.el.getContext(), w, g); return r.ops; };
  const a = at(3), b = at(3.37);
  const skip = (o) => o.filter((op) => op[0] !== "rotate");
  check("two PAUSE frames draw the same ghost but for the fin flick", a.length === b.length &&
    JSON.stringify(skip(a)) === JSON.stringify(skip(b)) && a.filter((op) => op[0] === "rotate").length === 1);
  check("the bob is sin(g.t*18)*1.8", a[2][0] === "translate" && a[3][0] === "translate" && a[3][1][1] === Math.sin(0.5 * 18) * 1.8,
    JSON.stringify(a.slice(0, 4)));
}

// ---- 10. tuple gate ----
{
  const st = mapStore();
  clear(st, mk(), 30);
  const race = (o) => { const g = createGhost(); ghostTick(g, mk(o), 0, st); return g.race; };
  check("the saved tuple races", !!race({}));
  check("not at pace 1, or with another seed, heat or pact",
    !race({ pace: 1 }) && !race({ seed: 8 }) && !race({ heat: 1 }) && !race({ pact: 1 }));
}

// ---- 11. read-only ----
{
  const w = createWorld(5, 1);
  loadLevel(w, 1, false);
  w.state = "PLAY";
  w.events.push({ t: "probe" });
  const snap = JSON.stringify(w), ev = w.events.length, st = mapStore(), g = createGhost();
  for (let i = 0; i < 599; i++) ghostTick(g, w, i / 60, st);
  const same = JSON.stringify(w) === snap;
  w.state = "WIN";
  const snapWin = JSON.stringify(w);
  ghostTick(g, w, 10, st);
  check("world deep-equals its snapshot after 600 ghostTick calls (the last one saves)",
    same && JSON.stringify(w) === snapWin && st.getItem(GHOST_KEY) !== null);
  check("world.events length is unchanged", w.events.length === ev && w.events[0].t === "probe");
}

// ---- 2D draw: under foes and the live player, at GHOST_A, op stream otherwise unchanged ----
function rec() {
  const ops = [], props = {};
  const ctx = new Proxy(props, {
    get: (t, p) => {
      if (typeof p === "symbol") return undefined;
      if (p in t) return t[p];
      return (...a) => {
        ops.push([p, a]);
        return p === "createLinearGradient" || p === "createRadialGradient" ? { addColorStop() {} } : undefined;
      };
    },
    set: (t, p, v) => { ops.push(["=" + String(p), v]); t[p] = v; return true; },
  });
  return { ops, el: { width: 600, height: 520, getContext: () => ctx } };
}
function frame(o) {
  const w = createWorld(11, 1);
  loadLevel(w, 1, false);
  w.state = "PLAY";
  w.players[0].face = { x: 1, y: 0 };
  const r = rec();
  createRenderer(r.el, { kind: "2d" }).render(w, 1 / 60, o);
  return { ops: r.ops, w };
}
{
  const G = { x: 222, y: 138, fx: 1, fy: 0 };
  const plain = frame(), none = frame({ hud: false }), withG = frame({ ghost: G });
  const ops = withG.ops;
  const s0 = ops.findIndex((op, i) => op[0] === "save" && ops[i + 1] && ops[i + 1][0] === "=globalAlpha" &&
    ops[i + 1][1] === GHOST_A && ops[i + 2] && ops[i + 2][0] === "translate" && ops[i + 2][1][0] === G.x && ops[i + 2][1][1] === G.y);
  let j = s0, depth = 0;
  for (; s0 >= 0 && j < ops.length; j++) {
    if (ops[j][0] === "save") depth++;
    else if (ops[j][0] === "restore" && --depth === 0) break;
  }
  const p = withG.w.players[0];
  const live = ops.findIndex((op, i) => i > j && op[0] === "translate" && op[1][0] === p.x && op[1][1] === p.y);
  const fills = ops.slice(s0, j).filter((op) => op[0] === "fill").length;
  let a = 1;
  const st = [], alphaAt = [];
  for (let i = s0; i <= j; i++) {
    const op = ops[i];
    if (op[0] === "save") st.push(a);
    else if (op[0] === "restore") a = st.pop();
    else if (op[0] === "=globalAlpha") a = op[1];
    else if (op[0] === "fill") alphaAt.push(a);
  }
  check("GHOST_A is 0.4", GHOST_A === 0.4);
  check("o.ghost draws one save/alpha/translate block before the live player", s0 >= 0 && live > j, s0 + "/" + j + "/" + live);
  check("every ghost body fill lands at globalAlpha 0.4", fills > 10 && alphaAt.length === fills &&
    alphaAt.every((v) => v === 0.4), fills + ":" + alphaAt.join());
  check("the ghost fins take the default teal (no re-hue)", ops.slice(s0, j).some((op) => op[0] === "=fillStyle" && op[1] === "#37f0d0"));
  const firstEnemy = withG.w.enemies[0];
  const enemyAt = firstEnemy ? ops.findIndex((op) => op[0] === "translate" && op[1][0] === firstEnemy.x && op[1][1] === firstEnemy.y) : -1;
  check("the ghost draws under the foes", !firstEnemy || enemyAt > j, enemyAt + "/" + j);
  const stripped = ops.slice(0, s0).concat(ops.slice(j + 1));
  check("without o.ghost the op stream is the same stream minus the ghost block",
    JSON.stringify(stripped) === JSON.stringify(plain.ops) && JSON.stringify(none.ops) === JSON.stringify(plain.ops));
  const iso = rec();
  const wi = createWorld(11, 1);
  loadLevel(wi, 1, false);
  wi.state = "PLAY";
  createRenderer(iso.el, { kind: "iso" }).render(wi, 1 / 60, { ghost: G });
  check("the iso branch draws no ghost", !iso.ops.some((q) => q[0] === "translate" && q[1][0] === G.x && q[1][1] === G.y));
}

console.log("\n  GHOST RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
