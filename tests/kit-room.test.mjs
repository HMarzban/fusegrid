/* Task 1.4: the room look backdrop (R4), the next-run lane (R5) and the renderers' covered frame. The lane's only true facts are the sealed spawn pocket
   (fair.js SEAL, checked with fair.js's own predicate), the room's CORE roster and its floor tile; a covered frame skips the board raster in every look
   but still drains world.events exactly as an uncovered one. */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { rec } from "./lib/textrec.mjs";
import { CFG, T, key, biomeOf } from "../src/core/config.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { POCKET, DOORS, CORNERS, sealed } from "../src/core/fair.js";
import { heatRoster } from "../src/core/heat.js";
import { F, HOME, featKindOf } from "../src/core/feat.js";
import { FOES, POWER } from "../src/core/entities.js";
import { fxOf } from "../src/render/entityfx.js";
import { worldTokens, toL } from "../src/render/kit/tokens.js";
import { setFactory, release, _dbg as cacheDbg } from "../src/render/kit/cache.js";
import { wallCell, floorCell, brickCell } from "../src/render/kit/paint.js";
import { paintCell } from "../src/render/featdraw.js";
import { createRenderer } from "../src/render/renderer.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { createRenderer3D } from "../src/render/three/wrapper.js";
import { initFx, getFx } from "../src/render/fx.js";
import { surfRGBA } from "../tools/pixel/rgba.mjs";

globalThis.Path2D ??= class { moveTo() {} lineTo() {} closePath() {} rect() {} addPath() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} ellipse() {} };
globalThis.DOMMatrix ??= class { constructor() {} };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
const C = CFG.COLS, R = CFG.ROWS, STEP = CFG.STEP;
const near = (a, b) => Math.abs(a - b) < 1.5e-3; /* the recorder logs numbers at 3 decimals */
const eqBox = (a, b) => !!a && !!b && ["x", "y", "w", "h"].every((k) => near(a[k], b[k]));
const rgbaOf = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
const balanced = (r) => r.calls.filter((q) => q.op === "save").length === r.calls.filter((q) => q.op === "restore").length && J(r.ctx.getTransform()) === J({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
const hsh = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/* the cell wrapper of kit paint.js (wallCell / floorCell / brickCell): save, translate to the cell, scale s/40 */
const cellsOf = (r, k) => {
  const at = new Map();
  for (let i = 0; i + 2 < r.calls.length; i++) {
    const [a, b, c] = [r.calls[i], r.calls[i + 1], r.calls[i + 2]];
    if (a.op === "save" && b.op === "translate" && c.op === "scale" && near(c.a[0], k) && near(c.a[1], k)) { const p = b.a.join(","); at.set(p, (at.get(p) || 0) + 1); }
  }
  return at;
};

const room = await import("../src/render/kit/room.js").catch((e) => { check("src/render/kit/room.js loads", false, e.message); return null; });

/* ---- the import graph: room.js never reaches board3.js, src/app, vendor or render/three ---- */
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const EDGE = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^;"']*?\sfrom\s*)?["']([^"']+)["']/g;
  const seen = new Set(), todo = [join(ROOT, "src/render/kit/room.js")], missing = [];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    if (!existsSync(f)) { missing.push(relative(ROOT, f)); continue; }
    for (const m of strip(readFileSync(f, "utf8")).matchAll(EDGE)) if (m[1].startsWith(".")) todo.push(join(dirname(f), m[1]));
  }
  const files = [...seen].map((f) => relative(ROOT, f));
  check("the walk is not vacuous: room.js reaches fair.js, heat.js, feat.js, featdraw.js and the kit painters", ["src/core/fair.js", "src/core/heat.js", "src/core/feat.js", "src/render/featdraw.js", "src/render/kit/paint.js", "src/render/kit/cache.js"].every((f) => files.includes(f)), files.length);
  check("every static import from room.js resolves", missing.length === 0, missing.join());
  check("room.js never reaches board3.js, featplace.js or featchecks.js", !files.some((f) => /src\/core\/(board3|featplace|featchecks)\.js$/.test(f)), files.filter((f) => /board3|featplace|featchecks/.test(f)).join());
  check("room.js never reaches src/app, vendor or src/render/three", !files.some((f) => /^src\/app\/|^vendor\/|^src\/render\/three\//.test(f)), files.filter((f) => /^src\/app\/|^vendor\/|three\//.test(f)).join());
  const src = existsSync(join(ROOT, "src/render/kit/room.js")) ? strip(readFileSync(join(ROOT, "src/render/kit/room.js"), "utf8")) : "";
  check("room.js: no filter, shadowBlur, shadowColor, getImageData, toDataURL or Math.random", !!src && !/\.filter\s*=|shadowBlur|shadowColor|getImageData|toDataURL|Math\.random/.test(src));
}

if (room) {
  const { roomLook, roomLayer, laneGrid, lane, LANE_COLS } = room;

  /* ---- laneGrid: pure, the sealed pocket, a CORE roster foe and the world's tile on FLOOR, for all 8 levels ---- */
  for (let lv = 1; lv <= 8; lv++) {
    const L = laneGrid(lv), g = L.grid, b = biomeOf(lv), at = (x, y) => g[key(x, y)];
    const kind = (v) => (v === T.WALL ? "WALL" : v === T.BRICK ? "BRICK" : v === T.EMPTY ? "FLOOR" : String(v));
    check(`L${lv}: the full board, ${C} x ${R} T codes`, L.cols === C && L.rows === R && g.length === C * R && [...g].every((v) => v === T.EMPTY || v === T.WALL || v === T.BRICK));
    check(`L${lv}: MAKO stands on the spawn FLOOR cell (1,1)`, L.mako.x === 1 && L.mako.y === 1 && at(1, 1) === T.EMPTY, kind(at(1, 1)));
    const f = L.foe, inP = (x, y) => POCKET.includes(key(x, y)), isDoor = (x, y) => DOORS.includes(key(x, y));
    check(`L${lv}: the foe stands on FLOOR outside the pocket and off the doors`, at(f.x, f.y) === T.EMPTY && !inP(f.x, f.y) && !isDoor(f.x, f.y), J(f) + " " + kind(at(f.x, f.y)));
    check(`L${lv}: the foe is a type of the room's real CORE roster (${f.type})`, heatRoster(lv, 0).includes(f.type) && FOES.some((q) => q.t === f.type));
    const t = L.tile;
    check(`L${lv}: the floor tile is ${b.name}'s own (${HOME[b.name]})`, !!t && featKindOf(t.code) === HOME[b.name], J(t));
    check(`L${lv}: the tile sits on FLOOR outside the pocket, off the doors, apart from MAKO and the foe`, at(t.x, t.y) === T.EMPTY && !inP(t.x, t.y) && !isDoor(t.x, t.y) && !(t.x === f.x && t.y === f.y) && !(t.x === 1 && t.y === 1));
    check(`L${lv}: the spawn pocket is sealed by fair.js's own SEAL predicate`, sealed(g));
    check(`L${lv}: pocket cells FLOOR, doors (5,1) and (1,5) BRICK`, POCKET.every((k) => g[k] === T.EMPTY) && DOORS.every((k) => g[k] === T.BRICK) && at(5, 1) === T.BRICK && at(1, 5) === T.BRICK);
    let rep = true;
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      const wall = x === 0 || y === 0 || x === C - 1 || y === R - 1 || (x % 2 === 0 && y % 2 === 0);
      if (wall !== (at(x, y) === T.WALL)) rep = false;
    }
    check(`L${lv}: walls are the border and the even-even pillars of the representative layout`, rep);
    check(`L${lv}: MAKO, the foe and the tile sit in row 1 inside the first 8 columns, so even a 9-column crop shows them`, f.y === 1 && t.y === 1 && f.x <= 7 && t.x <= 7, J([f, t]));
  }
  {
    const a = laneGrid(3), b = laneGrid(3);
    check("laneGrid is deterministic per level", J([...a.grid]) === J([...b.grid]) && J(a.foe) === J(b.foe) && J(a.tile) === J(b.tile));
    a.grid[key(1, 1)] = T.WALL; a.foe.x = 99;
    const c = laneGrid(3);
    check("laneGrid hands out a fresh grid every call (a caller's edit never leaks)", c.grid[key(1, 1)] === T.EMPTY && c.foe.x !== 99);
    const L = laneGrid(1), skip = new Set([...POCKET, ...DOORS, ...CORNERS, key(L.foe.x, L.foe.y), key(L.tile.x, L.tile.y)]);
    for (const k of POCKET) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) skip.add(key((k % C) + dx, ((k / C) | 0) + dy));
    let free = 0, same = true;
    for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) {
      if ((x % 2 === 0 && y % 2 === 0) || skip.has(key(x, y))) continue;
      free++;
      if ((L.grid[key(x, y)] === T.BRICK) !== (!(x + y <= 3 || x + y >= C + R - 5) && hsh(x, y, 10) < 0.42)) same = false;
    }
    check("outside the stamp and the two actor cells, bricks follow the appendix hash (seed 7 + 3)", same && free > 80, free);
  }

  /* ---- roomLook: bg1, the board scaled to cover the box and centred, the veil last ---- */
  {
    const tok = worldTokens(1), box = { x: 10, y: 20, w: 300, h: 260 }, r = rec();
    roomLook(r.ctx, box, 1, tok);
    const first = r.paints[0], last = r.paints[r.paints.length - 1];
    check("roomLook fills the real bg1 over the box first", first.op === "fillRect" && first.style === biomeOf(1).bg1 && eqBox(first.box, box), J(first));
    check("roomLook draws the veil last: rgba(toL(bg1, 0.004), 0.5) over the box at alpha 1", last.op === "fillRect" && last.style === rgbaOf(toL(tok.bg1, 0.004), 0.5) && last.alpha === 1 && eqBox(last.box, box), J(last));
    const tr = r.calls.findIndex((q) => q.op === "translate" && near(q.a[0], 10) && near(q.a[1], 20));
    check("box 300 x 260: the board scales by max(w/600, h/520) = 0.5 from the box corner", tr >= 0 && r.calls[tr + 1].op === "scale" && near(r.calls[tr + 1].a[0], 0.5) && near(r.calls[tr + 1].a[1], 0.5), J(r.calls[tr + 1]));
    const at = cellsOf(r, 1), want = new Map();
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      const wall = x === 0 || y === 0 || x === C - 1 || y === R - 1 || (x % 2 === 0 && y % 2 === 0), brick = !wall && !(x + y <= 3 || x + y >= C + R - 5) && hsh(x, y, 10) < 0.42;
      want.set(x * 40 + "," + y * 40, brick ? 2 : 1);
    }
    check("the representative layout: 195 cells, each painted once, a brick cell is its floor then its brick (appendix hash, seed 7)", at.size === 195 && [...want].every(([p, n]) => at.get(p) === n), at.size + " cells, bricks " + [...at.values()].filter((n) => n === 2).length + " / " + [...want.values()].filter((n) => n === 2).length);
    check("roomLook leaves the transform and the clip as it found them", balanced(r));
    check("roomLook sets no filter, shadowBlur or shadowColor", !r.writes.some((w) => /^(filter|shadowBlur|shadowColor)$/.test(w.k)));
    const wide = rec();
    roomLook(wide.ctx, { x: 0, y: 0, w: 600, h: 200 }, 1, tok);
    check("a wide box crops top and bottom: scale 1, centred at y (200 - 520) / 2", wide.calls.some((q, i) => q.op === "translate" && near(q.a[0], 0) && near(q.a[1], -160) && wide.calls[i + 1].op === "scale" && near(wide.calls[i + 1].a[0], 1)));
    const k = rec();
    roomLook(k.ctx, { x: 0, y: 0, w: 600, h: 200 }, 1, tok, { veil: 0.72, k: 1.5 });
    const kl = k.paints[k.paints.length - 1];
    check("o.k zooms the cover scale, o.veil sets the veil alpha", k.calls.some((q, i) => q.op === "translate" && near(q.a[0], -150) && near(q.a[1], -290) && k.calls[i + 1].op === "scale" && near(k.calls[i + 1].a[0], 1.5)) && kl.style === rgbaOf(toL(tok.bg1, 0.004), 0.72), kl.style);
    const ice = worldTokens(2), ir = rec();
    roomLook(ir.ctx, { x: 0, y: 0, w: 300, h: 260 }, 2, ice);
    check("ICE: the veil is the tinted bg1 (cyan), as the appendix", ir.paints[ir.paints.length - 1].style === rgbaOf(toL(ice.bg1, 0.004), 0.5) && ice.bg1 !== biomeOf(2).bg1);
  }

  /* ---- the real board art (appendix 1.3; lead ruling 2026-11-10): the backdrop and the lane paint the level's untinted BIOMES entry, as the mock does
     (kit5.js boardBg and S7-menu lane use K.W = the BIOMES entry); only the veil takes the tinted bg1. A palette is every string style the cell
     painters (walls 0..10, floors, the brick) and the world's tile paint for one biome object. ---- */
  {
    const SLOTS = ["bg0", "bg1", "floor0", "floor1", "wall", "wallHi", "brickA", "brickB", "brickHi"];
    const TABLE2 = ["#5c9faf", "#0f2429", "#8bb9c4", "#6a9eab", "#3a4d54", "#dae6ea", "#f4fcfe", "#a7dfea", "#ffffff"];
    const styles = (ps) => new Set(ps.map((p) => p.style).filter((v) => typeof v === "string"));
    const palette = (b) => {
      const r = rec(), t = { biome: b };
      for (let code = 0; code <= 10; code++) wallCell(r.ctx, 0, 0, 40, t, { code });
      for (const par of [0, 1]) for (let v = 0; v < 4; v++) floorCell(r.ctx, 0, 0, 40, t, { par, v });
      brickCell(r.ctx, 0, 0, 40, t);
      paintCell(r.ctx, b, { kind: HOME[b.name], h: 0, par: 1, dir: 0, outer: ["N", "E", "S", "W"], exit: true, entry: true, phase: 0, state: 0, lit: 0, pair: 1, gx: 6, gy: 1 });
      return styles(r.paints);
    };
    const raw = biomeOf(2), ice = worldTokens(2), P = palette(raw), Q = palette(ice.biome);
    const tintOnly = [...Q].filter((v) => !P.has(v)), rawOnly = [...P].filter((v) => !Q.has(v));
    check("ICE: the tinted slots are appendix 1.4's second table, so the test's premise holds", J(SLOTS.map((k) => ice.biome[k])) === J(TABLE2) && SLOTS.some((k) => raw[k] !== ice.biome[k]), J(SLOTS.map((k) => ice.biome[k])));
    check("ICE: the real and the tinted cell art paint different colours (the palettes tell them apart)", tintOnly.length >= 5 && rawOnly.length >= 5, tintOnly.length + " tinted-only / " + rawOnly.length + " real-only");
    const bad = (S) => [...S].filter((v) => tintOnly.includes(v) || TABLE2.slice(0, 8).includes(v));
    const box = { x: 0, y: 0, w: 300, h: 260 }, r = rec();
    roomLook(r.ctx, box, 2, ice);
    const first = r.paints[0], last = r.paints[r.paints.length - 1], S = styles(r.paints.slice(1, -1));
    check("ICE roomLook: the first fill is the real ICE bg1 " + raw.bg1, first.op === "fillRect" && first.style === raw.bg1 && raw.bg1 === "#0a2048", first.style);
    check("ICE roomLook: the board paints the real ICE art (real-only colours present)", rawOnly.filter((v) => S.has(v)).length >= 5, rawOnly.filter((v) => S.has(v)).length);
    check("ICE roomLook: no tinted ICE colour on the board (none of table 2, no tinted-only shade)", bad(S).length === 0, bad(S).join());
    check("ICE roomLook: only the veil is tinted: rgba(toL(tinted bg1 #0f2429, 0.004), 0.5), drawn last", last.style === rgbaOf(toL("#0f2429", 0.004), 0.5) && ice.bg1 === "#0f2429", last.style);
    const l = rec();
    lane(l.ctx, 20, 30, 280, 2.5, 2, ice);
    const LS = styles(l.paints.slice(1, -1));
    check("ICE lane: the cells and the tile paint the real ICE art, as the mock's lane (S7-menu screen.js K.W)", rawOnly.filter((v) => LS.has(v)).length >= 5, rawOnly.filter((v) => LS.has(v)).length);
    check("ICE lane: no tinted ICE colour in the cells or the tile", bad(LS).length === 0, bad(LS).join());
    check("ICE lane: the bed under the cells is the UI token (tok.bed)", l.paints[0].style === ice.bed);
    const jt = worldTokens(1), jr = biomeOf(1);
    check("JUNGLE: tinted and real slots are equal, so nothing changes outside ICE", SLOTS.every((k) => jt.biome[k] === jr[k]) && J([...palette(jt.biome)]) === J([...palette(jr)]));
    check("the other six worlds too: tinted slots equal the real ones", [3, 4, 5, 6, 7, 8].every((lv) => SLOTS.every((k) => worldTokens(lv).biome[k] === biomeOf(lv)[k])));
  }

  /* ---- roomLayer: painted once per key through cache.js ---- */
  {
    const made = [];
    setFactory((w, h) => { const r = rec(), c = { width: w, height: h, getContext: () => r.ctx, r }; made.push(c); return c; });
    release();
    const tok = worldTokens(3), box = { w: 400, h: 300 };
    const m0 = cacheDbg.misses, a = roomLayer(box, 3, tok, { dpr: 2 });
    check("roomLayer: one miss, a dpr-sized canvas, painted through roomLook at dpr scale", cacheDbg.misses === m0 + 1 && a.width === 800 && a.height === 600 && J(a.r.calls[0]) === J({ op: "scale", a: [2, 2] }) && a.r.paints[a.r.paints.length - 1].style === rgbaOf(toL(tok.bg1, 0.004), 0.5), J(a.r.calls[0]));
    const m1 = cacheDbg.misses, b = roomLayer(box, 3, tok, { dpr: 2 });
    check("roomLayer: the second identical call is a hit (0 new misses, the same canvas)", cacheDbg.misses === m1 && b === a && made.length === 1);
    roomLayer(box, 3, tok, { dpr: 2, veil: 0.45 });
    check("roomLayer: another veil is another layer (never a stale veil)", cacheDbg.misses === m1 + 1 && made.length === 2 && made[1].r.paints[made[1].r.paints.length - 1].style === rgbaOf(toL(tok.bg1, 0.004), 0.45));
    roomLayer(box, 4, worldTokens(4), { dpr: 2 });
    roomLayer({ w: 401, h: 300 }, 3, tok, { dpr: 2 });
    check("roomLayer: a level or a size change misses once each", cacheDbg.misses === m1 + 3);
    release();
    setFactory(null);
  }

  /* ---- lane: the start corner at s = w / cols, MAKO on (1,1), the foe and the tile on their cells, in a 2 px frame ---- */
  for (const lv of [1, 2, 8]) {
    const tok = worldTokens(lv), r = rec(), L = laneGrid(lv);
    const h = lane(r.ctx, 20, 30, 280, 2.5, lv, tok);
    const s = 280 / LANE_COLS, ox = 22, oy = 32 - 0.3 * s;
    check(`L${lv} lane: ${LANE_COLS} columns by default, height = rows x cell`, near(h, 2.5 * s), h);
    const first = r.paints[0], last = r.paints[r.paints.length - 1];
    check(`L${lv} lane: the bed under the cells, the box filled first`, first.op === "fillRect" && first.style === tok.bed && eqBox(first.box, { x: 20, y: 30, w: 280, h }), J(first));
    check(`L${lv} lane: a 2 px #0b0609 frame on the box edge, drawn last`, last.op === "strokeRect" && last.style === "#0b0609" && last.lw === 2 && eqBox(last.box, { x: 21, y: 31, w: 278, h: h - 2 }), J(last));
    check(`L${lv} lane: nothing paints outside the box`, r.paints.every((p) => !p.box || (p.box.x >= 20 - 1e-6 && p.box.y >= 30 - 1e-6 && p.box.x + p.box.w <= 300 + 1e-6 && p.box.y + p.box.h <= 30 + h + 1e-6)));
    const at = cellsOf(r, s / 40);
    let cells = true, n = 0;
    for (let y = 0; y < 3; y++) for (let x = 0; x < LANE_COLS; x++) {
      const v = L.grid[key(x, y)], c = at.get([ox + x * s, oy + y * s].map((q) => +q.toFixed(3)).join(","));
      const tileHere = L.tile.x === x && L.tile.y === y;
      if (c !== (v === T.BRICK ? 2 : 1) + (tileHere ? 1 : 0)) cells = false;
      n++;
    }
    check(`L${lv} lane: every visible cell (${n}) painted from laneGrid: a brick is floor then brick, walls by position`, cells);
    const tx = ox + L.tile.x * s, ty = oy + L.tile.y * s;
    const ti = r.calls.findIndex((q, i) => q.op === "translate" && near(q.a[0], tx) && near(q.a[1], ty) && r.calls.slice(i, i + 8).some((z) => z.op === "rect" && J(z.a) === J([0, 0, 40, 40])));
    check(`L${lv} lane: the floor tile is drawn by featdraw on its own cell (${HOME[biomeOf(lv).name]})`, ti >= 0);
    const mid = (p) => [p.box.x + p.box.w / 2, p.box.y + p.box.h / 2], inCell = (p, cx, cy) => { const [x, y] = mid(p); return x > ox + cx * s && x < ox + (cx + 1) * s && y > oy + cy * s && y < oy + (cy + 1) * s; };
    const fins = r.paints.filter((p) => p.style === "#37f0d0" && p.box);
    check(`L${lv} lane: MAKO's fins (#37f0d0) stand on cell (1,1)`, fins.length > 0 && fins.every((p) => inCell(p, 1, 1)), J(fins.map(mid)));
    const mi = r.calls.findIndex((q) => q.op === "translate" && near(q.a[0], ox + 1.5 * s) && near(q.a[1], oy + 1.5 * s + 0.02 * s));
    check(`L${lv} lane: MAKO at the appendix scale: translate(w/2, h/2 + w*0.02), scale(w/40)`, mi >= 0 && r.calls[mi + 1].op === "scale" && near(r.calls[mi + 1].a[0], s / 40));
    const f = L.foe, fi = r.calls.findIndex((q) => q.op === "translate" && near(q.a[0], ox + (f.x + 0.5) * s) && near(q.a[1], oy + (f.y + 0.5) * s + 0.04 * s));
    check(`L${lv} lane: the foe (${f.type}) at the appendix scale on its cell: translate(w/2, w/2 + w*0.04), scale(w/34)`, fi >= 0 && r.calls[fi + 1].op === "scale" && near(r.calls[fi + 1].a[0], s / 34));
    check(`L${lv} lane: transform and clip restored, no filter`, balanced(r) && !r.writes.some((w) => /^(filter|shadowBlur|shadowColor)$/.test(w.k)));
  }
  {
    const r = rec(), L = laneGrid(4), h = lane(r.ctx, 0, 0, 270, 2.5, 4, worldTokens(4), { cols: 9 }), s = 30;
    const f = L.foe, fi = r.calls.findIndex((q) => q.op === "translate" && near(q.a[0], 2 + (f.x + 0.5) * s) && near(q.a[1], 2 - 0.3 * s + 1.5 * s + 0.04 * s));
    check("o.cols 9 (the narrow crop): cell 30, the foe still drawn inside the clip", near(h, 75) && fi >= 0 && 2 + (f.x + 1) * s <= 270 - 2, h);
  }
  {
    const before = (r) => { r.ctx.fillStyle = "#123456"; r.ctx.strokeStyle = "#654321"; r.ctx.lineWidth = 7; r.ctx.globalAlpha = 0.8; };
    const same = (r) => r.ctx.fillStyle === "#123456" && r.ctx.strokeStyle === "#654321" && r.ctx.lineWidth === 7 && r.ctx.globalAlpha === 0.8 && balanced(r);
    const a = rec(); before(a); roomLook(a.ctx, { x: 0, y: 0, w: 300, h: 260 }, 2, worldTokens(2));
    const b = rec(); before(b); lane(b.ctx, 0, 0, 280, 2.5, 8, worldTokens(8));
    check("roomLook and lane leave the caller's fillStyle, strokeStyle, lineWidth, globalAlpha and transform as they found them", same(a) && same(b), J([a.ctx.fillStyle, b.ctx.fillStyle, b.ctx.strokeStyle, b.ctx.lineWidth]));
    check("the tile code is feat.js's own first code of the kind (CONVEYOR and STREAM flow east)", laneGrid(3).tile.code === F.BELT_E && laneGrid(4).tile.code === F.STREAM_E && laneGrid(2).tile.code === F.GLIDE && laneGrid(8).tile.code === F.GATE);
    const src = readFileSync(join(ROOT, "src/render/kit/room.js"), "utf8");
    check("room.js does not restate feat.js's kind -> code table", !/BELT:\s*F\.|STREAM:\s*F\./.test(src));
  }
}

/* ---- covered: CLASSIC ---- */
const EVS = () => [{ t: "boom", x: 140, y: 140 }, { t: "brick", x: 180, y: 140 }, { t: "kill", x: 220, y: 140, type: "walker", color: "#8affc1" }];
const playWorld = (lv = 1) => { const w = createWorld(4242, lv); loadLevel(w, lv); w.state = "PLAY"; return w; };
{
  const run = (covered, o = {}) => {
    initFx();
    const r = rec(), plays = [];
    const cv = { width: 600, height: 520, getContext: () => r.ctx };
    const rd = createRenderer(cv, { kind: "2d", audio: { play: (s) => plays.push(s) }, ...o });
    const w = playWorld();
    rd.render(w, STEP);
    const n0 = r.calls.length, w0 = r.writes.length, r0 = rd._dbg.rasters;
    w.time += STEP;
    w.events.push(...EVS());
    rd.render(w, STEP, covered ? { covered: true } : undefined);
    return { rd, r, w, plays, calls: r.calls.length - n0, writes: r.writes.length - w0, rasters: rd._dbg.rasters - r0, fx: getFx().length };
  };
  const a = run(false), b = run(true);
  check("CLASSIC covered: no board raster (_dbg.rasters unchanged)", b.rasters === 0 && a.rasters === 1, b.rasters);
  check("CLASSIC covered: not one canvas call or property write that frame (no board, no HUD, no clear)", b.calls === 0 && b.writes === 0, b.calls + " calls, " + b.writes + " writes");
  check("CLASSIC covered: world.events drained", b.w.events.length === 0);
  check("CLASSIC covered: the same sounds and the same fx state as an uncovered frame", J(b.plays) === J(a.plays) && b.plays.length > 0 && b.fx === a.fx && b.fx > 0, J(b.plays) + " fx " + b.fx + "/" + a.fx);
  b.w.time += STEP;
  const r0 = b.rd._dbg.rasters;
  b.rd.render(b.w, STEP);
  check("CLASSIC: the first frame after the cover lifts rasters again", b.rd._dbg.rasters === r0 + 1);
  /* covered:false is the plain path */
  const log = (o) => {
    const real = Math.random;
    let s = 12345;
    Math.random = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    try { initFx(); const r = rec(); const rd = createRenderer({ width: 600, height: 520, getContext: () => r.ctx }, { kind: "2d" }); const w = playWorld(); rd.render(w, STEP, o); w.time += STEP; w.events.push(...EVS()); rd.render(w, STEP, o); return J(r.calls) + J(r.writes); } finally { Math.random = real; }
  };
  check("CLASSIC covered:false draws the same call log as no options", log({ covered: false }) === log(undefined));
  /* armed: the first uncovered frame never blits the snapshot taken before the cover */
  let now = 0;
  initFx();
  const ar = rec(), snaps = [];
  const rd = createRenderer({ width: 600, height: 520, getContext: () => ar.ctx }, { kind: "2d", now: () => now, mk: (w, h) => { const s = rec(); const c = { width: w, height: h, getContext: () => s.ctx }; snaps.push(c); return c; } });
  rd.setPerf({ epoch: 1 });
  const w = playWorld();
  w.state = "PAUSE";
  for (const t of [0, 20, 40, 60]) { now = t; rd.render(w, STEP); }
  const blits0 = rd._dbg.blits, ras0 = rd._dbg.rasters;
  now = 80; rd.render(w, STEP, { covered: true });
  now = 100; rd.render(w, STEP);
  check("CLASSIC armed: still frames blit before the cover; after it the first frame rasters fresh", blits0 >= 1 && rd._dbg.rasters === ras0 + 1 && rd._dbg.blits === blits0, blits0 + " blits, rasters " + ras0 + " -> " + rd._dbg.rasters);
}

/* ---- covered: PIXEL ---- */
{
  const run = (covered) => {
    initFx();
    const log = [], plays = [];
    let n = 0;
    const cvOf = (w, h, tag) => {
      const base = { imageSmoothingEnabled: true, imageSmoothingQuality: "high", globalAlpha: 1, fillStyle: "#000", getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), measureText: () => ({ width: 10 }) };
      const ctx = new Proxy(base, {
        get: (t, k) => (k in t ? t[k] : (...a) => { log.push(tag + "." + String(k)); return String(k).startsWith("create") ? { addColorStop() {} } : undefined; }),
        set: (t, k, v) => { log.push(tag + "=" + String(k)); t[k] = v; return true; },
      });
      return { width: w, height: h, clientWidth: 0, clientHeight: 0, dataset: {}, tag, getContext: () => ctx };
    };
    const px = cvOf(600, 520, "px"), ov = cvOf(600, 520, "ov");
    const r = createPixelRenderer(px, ov, { mkCanvas: (w, h) => cvOf(w, h, ["probe", "native", "hi"][n++] || "x"), surf: surfRGBA, audio: { play: (s) => plays.push(s) } });
    const w = playWorld();
    r.render(w, STEP);
    const l0 = log.length, r0 = r._dbg.stat.rasters, t0 = r._dbg.clock.t;
    w.time += STEP;
    w.events.push(...EVS());
    r.render(w, STEP, covered ? { covered: true } : undefined);
    return { r, w, plays, calls: log.slice(l0), rasters: r._dbg.stat.rasters - r0, dt: r._dbg.clock.t - t0, shots: r._dbg.view.shots.count(), fx: getFx().length };
  };
  const a = run(false), b = run(true);
  check("PIXEL covered: no raster (stat.rasters unchanged)", b.rasters === 0 && a.rasters === 1, b.rasters);
  check("PIXEL covered: no call on #px, #c, the native or the hi canvas (no blit, no overlay clear)", b.calls.length === 0, b.calls.slice(0, 6).join());
  check("PIXEL covered: events drained into the same sounds, one-shots and fx as uncovered", b.w.events.length === 0 && J(b.plays) === J(a.plays) && b.plays.length > 0 && b.shots === a.shots && b.shots > 0 && b.fx === a.fx, J(b.plays) + " shots " + b.shots + "/" + a.shots);
  check("PIXEL covered: the anim clock advances exactly as uncovered (no jump when the cover lifts)", near(b.dt, a.dt) && b.dt > 0, b.dt + " vs " + a.dt);
  b.w.time += STEP;
  b.r.render(b.w, STEP);
  check("PIXEL: the first frame after the cover lifts rasters again", b.r._dbg.stat.rasters === 2);
}

/* ---- covered: REAL 3D (fake GL; a covered frame on another room rebuilds nothing) ---- */
{
  const run = (covered) => {
    initFx();
    let builds = 0;
    const plays = [], ovLog = [];
    const g = { renders: 0, shadowRenders: 0, toneMapping: 0, debug: { checkShaderErrors: true }, domElement: { width: 0, height: 0 }, ratio: 1, info: { programs: [] },
      shadowMap: { enabled: true, type: 0, autoUpdate: true, needsUpdate: false },
      setPixelRatio(d) { g.ratio = d; }, setSize(w, h) { g.domElement.width = Math.floor(w * g.ratio); g.domElement.height = Math.floor(h * g.ratio); },
      render() { g.renders++; if (g.shadowMap.enabled && (g.shadowMap.autoUpdate || g.shadowMap.needsUpdate)) g.shadowRenders++; g.shadowMap.needsUpdate = false; },
      dispose() {}, forceContextLoss() {} };
    const ovCtx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { ovLog.push(String(k)); return { addColorStop() {} }; }), set: (t, k, v) => { ovLog.push("=" + String(k)); t[k] = v; return true; } });
    const glCv = { width: 0, height: 0, style: {}, getContext: () => ({}), addEventListener() {}, removeEventListener() {} };
    const r = createRenderer3D(glCv, { width: 600, height: 520, style: {}, getContext: () => ovCtx }, { audio: { play: (s) => plays.push(s) }, perf: { aa: true, dpr3d: 1, shadow: "soft", partK: 1, epoch: 1 },
      makeGL: () => g, buildSprites: () => null, buildWorld: () => { builds++; return null; } });
    r.setPerf({ aa: true, dpr3d: 1, shadow: "soft", partK: 1, epoch: 1 });
    r.render(playWorld(1), STEP);
    const w = playWorld(3);
    w.events.push(...EVS());
    const b0 = builds, g0 = g.renders, s0 = g.shadowRenders, o0 = ovLog.length;
    r.render(w, STEP, covered ? { covered: true } : undefined);
    return { r, w, g, plays, builds: builds - b0, renders: g.renders - g0, shadows: g.shadowRenders - s0, ov: ovLog.slice(o0), fx: getFx().length, total: () => [builds, g.renders] };
  };
  const a = run(false), b = run(true);
  check("REAL 3D uncovered on another room: builds its world and renders (the stub counts are live)", a.builds === 1 && a.renders >= 1 && a.shadows >= 1, J([a.builds, a.renders, a.shadows]));
  check("REAL 3D covered on another room: no world build, no renderer.render, no shadow map", b.builds === 0 && b.renders === 0 && b.shadows === 0, J([b.builds, b.renders, b.shadows]));
  check("REAL 3D covered: no call on the #c overlay (no clear)", b.ov.length === 0, b.ov.slice(0, 6).join());
  check("REAL 3D covered: events drained into the same sounds and fx as uncovered", b.w.events.length === 0 && J(b.plays) === J(a.plays) && b.plays.length > 0 && b.fx === a.fx, J(b.plays));
  const [b1, g1] = b.total();
  b.w.time += STEP;
  b.r.render(b.w, STEP);
  const [b2, g2] = b.total();
  check("REAL 3D: the first frame after the cover lifts builds the room and renders", b2 === b1 + 1 && g2 > g1, J([b1, g1, b2, g2]));
}

/* ---- covered: PIXEL leaves #c's style alone too, and the next uncovered frame still sets the glow for the current level ---- */
{
  initFx();
  let n = 0;
  const writes = [];
  const cvOf = (w, h) => {
    const base = { imageSmoothingEnabled: true, imageSmoothingQuality: "high", globalAlpha: 1, fillStyle: "#000", getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), measureText: () => ({ width: 10 }) };
    const ctx = new Proxy(base, { get: (t, k) => (k in t ? t[k] : () => (String(k).startsWith("create") ? { addColorStop() {} } : undefined)) });
    return { width: w, height: h, clientWidth: 0, clientHeight: 0, dataset: {}, getContext: () => ctx };
  };
  const ov = cvOf(600, 520);
  ov.style = new Proxy({}, { set: (t, k, v) => { writes.push(String(k) + "=" + v); t[k] = v; return true; } });
  const r = createPixelRenderer(cvOf(600, 520), ov, { mkCanvas: (w, h) => (n++, cvOf(w, h)), surf: surfRGBA });
  r.render(playWorld(1), STEP);
  const w0 = writes.length, w3 = playWorld(3);
  r.render(w3, STEP, { covered: true });
  const w1 = writes.length;
  r.render(w3, STEP);
  check("PIXEL covered: #c's style is not written (stageGlow skipped, as CLASSIC)", w0 === 1 && w1 === w0, w0 + " -> " + w1);
  check("PIXEL: the first uncovered frame still writes the new level's glow", writes.length === 2 && writes[1] !== writes[0] && /^boxShadow=/.test(writes[1]), writes.length);
}

/* ---- covered: REAL 3D on the SAME world replays nothing on uncover, and a covered WIN still prepares the next room ---- */
const rig3d = () => {
  initFx();
  const builds = [];
  const g = { renders: 0, shadowRenders: 0, inits: 0, toneMapping: 0, debug: { checkShaderErrors: true }, domElement: { width: 0, height: 0 }, ratio: 1, info: { programs: [] },
    shadowMap: { enabled: true, type: 0, autoUpdate: true, needsUpdate: false },
    setPixelRatio(d) { g.ratio = d; }, setSize(w, h) { g.domElement.width = Math.floor(w * g.ratio); g.domElement.height = Math.floor(h * g.ratio); },
    render() { g.renders++; if (g.shadowMap.enabled && (g.shadowMap.autoUpdate || g.shadowMap.needsUpdate)) g.shadowRenders++; g.shadowMap.needsUpdate = false; },
    initTexture() { g.inits++; }, dispose() {}, forceContextLoss() {} };
  const ovCtx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })) });
  const glCv = { width: 0, height: 0, style: {}, getContext: () => ({}), addEventListener() {}, removeEventListener() {} };
  const perf = { aa: true, dpr3d: 1, shadow: "soft", partK: 1, epoch: 1 };
  const r = createRenderer3D(glCv, { width: 600, height: 520, style: {}, getContext: () => ovCtx }, { audio: null, perf, makeGL: () => g, buildSprites: () => null,
    buildWorld: (u, lvl) => { builds.push(lvl); return lvl === 1 ? null : { floor: { isTexture: true, dispose() {} } }; } });
  r.setPerf(perf);
  return { r, g, builds };
};
{
  const { r } = rig3d(), w = playWorld(1), fx = fxOf(w, "3d");
  const it = { x: 140, y: 220, t: POWER[0].t, col: POWER[0].col, taken: false, buried: false };
  w.items.push(it);
  r.render(w, STEP);
  w.time += STEP; r.render(w, STEP);
  const n0 = w.enemies.length, grid0 = w.grid;
  w.enemies.shift();
  it.taken = true;
  w.time += STEP; r.render(w, STEP, { covered: true });
  w.time += STEP; r.render(w, STEP);
  const g1 = fx.ghosts(w.time).length, b1 = fx.bursts(w.time).length;
  check("REAL 3D same world: a foe killed and a pickup taken under the cover feed no ghost and no burst on uncover", n0 >= 2 && w.grid === grid0 && g1 === 0 && b1 === 0, "ghosts " + g1 + ", bursts " + b1);
  w.enemies.shift();
  w.time += STEP; r.render(w, STEP);
  check("REAL 3D same world: a foe killed after the uncover still gets its death ghost", fx.ghosts(w.time).length === 1, fx.ghosts(w.time).length);
}
{
  const { r, g, builds } = rig3d(), w = playWorld(1);
  r.render(w, STEP);
  const g0 = g.renders;
  w.state = "WIN";
  w.time += STEP; r.render(w, STEP, { covered: true });
  const b1 = builds.slice(), i1 = g.inits;
  w.time += STEP; r.render(w, STEP, { covered: true });
  check("REAL 3D covered WIN: the next room's world is built and uploaded once (prepareNext)", J(b1) === J([1, 2]) && i1 === 1 && g.renders === g0, J(b1) + " inits " + i1);
  check("REAL 3D covered WIN: a second covered WIN frame does not repeat it", J(builds) === J([1, 2]) && g.inits === 1, J(builds) + " inits " + g.inits);
}

/* ---- bookkeeping: the precache knows room.js; since MENU paints the room look (v202 Task 3.1) it is a boot module, out of LATER ---- */
{
  const shell = readFileSync(join(ROOT, "src/pwa/shell.js"), "utf8"), { BOOT, LOOK_LATER } = await import("../src/pwa/shell.js");
  check("src/pwa/shell.js lists room.js in SRC, in the boot set and not in LATER (MENU's backdrop)", /"src\/render\/kit\/room\.js"/.test(shell) && BOOT.includes("./src/render/kit/room.js") && !LOOK_LATER.includes("./src/render/kit/room.js"));
}

console.log(fail ? "KIT ROOM FAIL" : "KIT ROOM OK", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
