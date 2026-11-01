/* REAL 3D colour-vision measure (browser only, imported by gates.mjs into its headless page). The real createRenderer3D (its NoToneMapping, PCFSoft shadow, rig C, lens,
   VIEW_DY, atlas maps, floor / wall / brick / tile shaders and the frozen light recipe), on a fixed fixture world per biome x heat: the same CVD_ENT tiles, on both
   floor parities, with EMPTY round them; 18 floor cells; WALL tops (codes 0..3) and BRICK tops (A, B, Hi) on row 9. No tile or floor cell has a wall inside the AO's
   2-cell reach or under a cast shadow, so this is the lit tile against the lit floor: no foes, pickups, player or ambient motes. Each cell's top face is resampled
   through the live camera (bilinear, from a dpr 3 buffer: a tile covers about 100 device px) to a 160 px square, which is what cvdSep's 40-px view reads. The tile
   shaders run on world.featT, so every tile is measured at six PLAY-clock phases (anim.mjs) and the caller keeps the worst. */
import {createRenderer3D, projBoard} from "../../src/render/three/wrapper.js";
import {createWorld, loadLevel} from "../../src/core/sim.js";
import {CFG, T, BIOMES, key} from "../../src/core/config.js";
import {setWallOverride} from "../../src/render/wallvar.js";
import {cvdSep} from "./gatefns.mjs";

const S = 160, TL = CFG.TILE, C = CFG.COLS, R = CFG.ROWS, N = C * R, DPR = 3;
const CODE = {BELT: 1, GLIDE: 5, BLOOM: 6, PLATE: 7, STREAM: 8, QUICK: 12, PORTAL: 13, GATE: 14}, COLS = [3, 6, 9], Y = 4;
const FLOORS = [5, 6].flatMap((y) => [3, 4, 5, 6, 7, 8, 9, 10, 11].map((x) => [x, y]));
const WALLS = [[2, 9, 0], [4, 9, 1], [6, 9, 2], [8, 9, 3]], BRICKS = [[11, 9], [10, 9], [13, 9]];
const OVR = new Map(WALLS.map(([x, y, c]) => [key(x, y), c]));

/* a room's tiles to cells: a BELT / STREAM mid and end share one 3-run (entry, mid, exit), each other tile stands alone. s shifts the set one column (the other floor parity) */
function layout(ents, s) {
  const out = [], feat = new Uint8Array(N), M = new Uint8Array(N), P = new Uint8Array(N); let slot = 0;
  for (const [id, , sp] of ents) {
    const run = sp.kind === "BELT" || sp.kind === "STREAM", x = (run ? (id.endsWith("-end") ? 8 : 7) : COLS[slot++]) + s, k = key(x, Y);
    if (run) for (const q of [6, 7, 8]) feat[key(q + s, Y)] = CODE[sp.kind]; else feat[k] = CODE[sp.kind];
    if (sp.kind === "GATE") M[k] = sp.lit | 0;
    if (sp.kind === "PORTAL") P[k] = sp.pair;
    if (sp.kind === "BLOOM" || sp.kind === "PLATE") M[k] = sp.state | 0;
    out.push({id, x});
  }
  return {cells: out, feat, M, P};
}
function fixture(room, h, L) {
  const w = createWorld(4242, room);
  w.gen = 3; w.heat = h; loadLevel(w, room); w.heat = h; w.featTier = h; w.pace = 0; w.state = "PLAY";
  w.enemies = []; w.items = []; w.bombs = []; w.blades = [];
  const g = new w.grid.constructor(N);
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) g[key(x, y)] = x === 0 || y === 0 || x === C - 1 || y === R - 1 ? T.WALL : T.EMPTY;
  for (const [x, y] of WALLS) g[key(x, y)] = T.WALL;
  for (const [x, y] of BRICKS) g[key(x, y)] = T.BRICK;
  /* fresh arrays: a new world.feat object is what rebuilds the tile layer at this heat */
  w.grid = g; w.feat = Uint8Array.from(L.feat); w.featM = Uint8Array.from(L.M); w.featS = new Float32Array(N); w.featPair = Uint8Array.from(L.P); w.featT = 0; w.featPend = [];
  return w;
}
/* the device-px map of a cell's top face at height hgt, cached (the camera never moves) */
function mapper(r) {
  const cam = r._dbg.camera, MAPS = new Map();
  return (x, y, hgt) => {
    const k = x + "," + y + "," + hgt;
    if (MAPS.has(k)) return MAPS.get(k);
    const m = new Float32Array(S * S * 2);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const p = projBoard(cam, (x + (i + 0.5) / S) * TL, (y + (j + 0.5) / S) * TL, hgt, j + i > 0); m[(j * S + i) * 2] = p.x * DPR - 0.5; m[(j * S + i) * 2 + 1] = p.y * DPR - 0.5; }
    MAPS.set(k, m);
    return m;
  };
}
function sample(px, W, H, m) {
  const o = new Uint8ClampedArray(S * S * 4);
  for (let q = 0; q < S * S; q++) {
    const fx = m[q * 2], fy = m[q * 2 + 1], x0 = Math.max(0, Math.min(W - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(H - 2, Math.floor(fy))), ax = fx - x0, ay = fy - y0;
    for (let c = 0; c < 4; c++) o[q * 4 + c] = (px[(y0 * W + x0) * 4 + c] * (1 - ax) + px[(y0 * W + x0 + 1) * 4 + c] * ax) * (1 - ay) + (px[((y0 + 1) * W + x0) * 4 + c] * (1 - ax) + px[((y0 + 1) * W + x0 + 1) * 4 + c] * ax) * ay;
  }
  return o;
}
const flipRead = (gl, W, H) => { const a = new Uint8Array(W * H * 4), o = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a); for (let y = 0; y < H; y++) o.set(a.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); return o; };
const peak = (u, c) => { let m = 0; for (let i = 0; i < u.length; i += 4) m = Math.max(m, Math.abs(u[i] - c[i]), Math.abs(u[i + 1] - c[i + 1]), Math.abs(u[i + 2] - c[i + 2])); return m; };
/* ents: CVD_ENT. Returns one row per tile x parity x phase, the bite probe (a tile cell left as bare floor), the largest channel drift of the references across heats (they
   must not move), and with dump the sampled cells of phase 0 as RGBA arrays for a contact sheet */
export function measure3D(ents, ANIM, {dump = false} = {}) {
  const gc = document.createElement("canvas"), ov = document.createElement("canvas"); ov.width = 600; ov.height = 520;
  const r = createRenderer3D(gc, ov, {perf: {dpr3d: DPR, aa: true, shadow: "soft"}}), gl = r._dbg.gl;
  if (!gl) throw new Error("no WebGL");
  const ctx = gl.getContext(), mp = mapper(r), out = [], sheet = [], drift = {};
  setWallOverride((x, y, k) => (OVR.has(key(x, y)) ? OVR.get(key(x, y)) : k));
  const shot = (w, t) => { w.featT = t; r.render(w, 0, {pop: 0, sfx: false}); return flipRead(ctx, gc.width, gc.height); };
  const refsOf = (px, b) => {
    const G = (x, y, hgt) => sample(px, gc.width, gc.height, mp(x, y, hgt));
    return {floor: FLOORS.map(([x, y]) => G(x, y, 0.4)), wall: WALLS.map(([x, y]) => G(x, y, b.hWall)), brick: BRICKS.map(([x, y]) => G(x, y, b.hBrick)), brickHex: [b.brickA, b.brickB]};
  };
  let bite = null;
  try {
    BIOMES.forEach((b, bi) => {
      const room = bi + 1, list = ents.filter((e) => e[1] === b.name);
      if (!list.length) return;
      const [t0, dt] = ANIM[list[0][2].kind];
      let refs = null;
      for (const s of [0, 1]) {
        const L = layout(list, s), byPh = Array.from({length: 6}, () => L.cells.map(() => []));
        for (let h = 0; h < 3; h++) {
          const W = fixture(room, h, L);
          for (let f = 0; f < 6; f++) {
            const px = shot(W, t0 + f * dt);
            if (!refs) { refs = refsOf(px, b); if (dump) sheet.push({bn: b.name, part: "floor", cells: refs.floor}, {bn: b.name, part: "wall", cells: refs.wall}, {bn: b.name, part: "brick", cells: refs.brick}); }
            else if (f === 0) { const A = refsOf(px, b); drift[b.name] = Math.max(drift[b.name] || 0, ...["floor", "wall", "brick"].flatMap((k) => A[k].map((v, i) => peak(v, refs[k][i])))); }
            L.cells.forEach((c, i) => byPh[f][i].push(sample(px, gc.width, gc.height, mp(c.x, Y, 0.7))));
          }
        }
        byPh.forEach((P, f) => L.cells.forEach((c, i) => {
          const res = cvdSep({heats: P[i], ...refs}, S, ["none", "protan", "deutan", "tritan"]);
          out.push({id: c.id, bn: b.name, par: (c.x + Y) & 1, t: +(t0 + f * dt).toFixed(2), rows: res.rows, heat: res.heat});
          if (dump && f === 0 && s === 0) sheet.push({bn: b.name, part: c.id, cells: P[i]});
        }));
        if (!bite) {
          const P = [0, 1, 2].map((h) => { const E = new Uint8Array(N), W = fixture(room, h, {feat: E, M: E, P: E}); return sample(shot(W, t0), gc.width, gc.height, mp(COLS[0], Y, 0.7)); });
          bite = cvdSep({heats: P, ...refs}, S);
        }
      }
    });
  } finally { setWallOverride(null); r.dispose(); }
  return {out, bite, drift, size: {w: gc.width, h: gc.height}, sheet: dump ? sheet.map((e) => ({...e, cells: e.cells.map((c) => Array.from(c))})) : []};
}
