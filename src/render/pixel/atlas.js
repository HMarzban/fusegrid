/* PIXEL atlas: bakes palette-slot grids into drawable frames, LAZILY, when
   the px renderer is first created (never at app boot). surf(w,h,rgba) turns
   bytes into something ctx.drawImage accepts: a canvas in the browser, a raw
   {width,height,data} image under the Node RGBA shim. A frame is
   {im,w,h,ax,ay,tip}; world.js blits im at (X-ax, Y-ay). Lookups the hot path
   makes are plain property / array reads (no string building per frame).
   Tiles bake per biome on first use, MAKO per fin colour (p.color). */
import {BIOMES} from "../../core/config.js";
import {POWER, FOES} from "../../core/entities.js";
import {ITEM_FAMILY} from "../icons.js";
import {HEX} from "./palette.js";
import {anchorOf, cellRGBA, flipX, rot90, swapCell, overlayCell} from "./grid.js";
import {fallbackCell} from "./fallback.js";
import {ART} from "./art/index.js";
import {featPxCell} from "../featpx.js";
import {floorPxCell, SHADOW_CELLS, brickPal} from "../featpxcells.js";
import {rim, ringCell, shine, passOf, squeeze, stretch, squash, silhouette, blinkOf, blob, scaled, wings, up1} from "./foegen.js";
import {MAKO_FACES, MAKO_CYCLE, layoutOf, BOMB_MARKS, BLAST_PIECES, BLAST_AGES} from "./manifest.js";

/* foes that get a 1 px ink contour on the board (the brick floor competes with a 20 px sprite) */
const RIM = {walker: 1, chaser: 1, knight: 1, burrow: 1, fast: 1};
export const faceRows = (h) => Math.max(2, Math.min(10, Math.round((h || 0) / 4)));

function composeFace(top, face, fh) {
  const rows = top.rows.slice(0, top.h - fh).concat(face.rows.slice(0, fh));
  while (rows.length < top.h) rows.push(rows[rows.length - 1]);
  return {...top, rows, pal: {...(top.pal || {}), ...(face.pal || {})}};
}

/* wall code -> [cell, mirrored] (wallvar.js WALL_VARS order); every wall
   frame is pre-composed over floor0 / floor1 so the chamfer corners show the
   board, still one drawImage per wall */
const WALL_SRC = [["base"], ["v1"], ["v2"], ["acc"], ["h"], ["vl"], ["vr"], ["ctl"], ["ctr"], ["cbl"], ["cbr"]];
const mirrorCell = (c) => ({...c, rows: c.rows.map((r) => [...r].reverse().join(""))});

export function createAtlas(surf, art = ART) {
  const pending = new Set(), used = new Set();
  function cellOf(group, name) {
    used.add(group + "/" + name);
    const sh = art[group], c = sh && sh.cells && sh.cells[name];
    if (c) return {...c, pal: {...(sh.pal || {}), ...(c.pal || {})}};
    pending.add(group + "/" + name);
    return fallbackCell(group, name);
  }
  function frame(cell, ctx) {
    const [ax, ay] = anchorOf(cell);
    return {im: surf(cell.w, cell.h, cellRGBA(cell, cell.pal, ctx)), w: cell.w, h: cell.h, ax, ay, tip: cell.tip || null};
  }
  const fadeOf = (c) => swapCell(c, {0: "2", 1: "3", 2: "3"});

  const makoSets = new Map();
  function makoSet(fin, kick) {
    const ctx = {body: HEX.hull, fin: fin || HEX.fin, feet: kick ? HEX.kick : HEX.feet};
    const cyc = {};
    for (const f of MAKO_FACES) cyc[f] = MAKO_CYCLE.map((c) => cellOf("mako", f + "." + c));
    const fr = (c) => frame(c, ctx), dz = {...ctx, desat: true};
    const one = (n) => cellOf("mako", n);
    return {
      cyc: [cyc.front.map(fr), cyc.back.map(fr), cyc.side.map(fr), cyc.side.map((c) => fr(flipX(c)))],
      death: [0, 1, 2, 3, 4, 5].map((i) => fr(one("death" + i))),
      corpse: [0, 1, 2].map((i) => frame(one("death" + i), dz)),
      mat: [0, 1, 2].map((i) => fr(one("mat" + i))),
      win: [0, 1].map((i) => fr(one("win" + i))),
      kick: fr(one("kick")), throw: fr(one("throw")),
      shield: [fr(one("shield0")), fr(one("shield1"))], passing: fr(one("passing")),
    };
  }
  function mako(fin, kick) {
    const k = fin || HEX.fin;
    let pair = makoSets.get(k);
    if (!pair) { pair = [null, null]; makoSets.set(k, pair); }
    const i = kick ? 1 : 0;
    return pair[i] || (pair[i] = makoSet(k, kick));
  }

  const foe = {}, puff = {};
  const bake = (cl, fr, to) => { const f = fr(cl), b = blinkOf(cl, to); f.blink = b ? fr(b) : null; return f; };
  const lift = (f) => ({...f, ay: f.ay + 1, blink: f.blink && {...f.blink, ay: f.blink.ay + 1}});
  for (const f of FOES) {
    const t = f.t, L = layoutOf(t), ctx = {body: f.col}, c = (n) => shine(cellOf("foes", t + "." + n)), fp = (cl) => frame(cl, ctx), fr = (cl) => fp(RIM[t] ? rim(cl) : cl), bk = (cl) => bake(cl, fr, t === "stationary" ? "m" : t === "chaser" ? "s" : "k");
    const st = c("stunned"), set = {layout: L, stun: fr(st), face: null, still: null, extra: null, walk: null, idle: null, flash: fp(silhouette(st, "w")), tint: fp(silhouette(st, "l")), squash: fr(squash(st)), mat: null};
    let base = null;
    if (L === "step" || L === "burrow") {
      const fs = [c("front0"), c("front1")], bs = [c("back0"), c("back1")], ss = [c("side0"), c("side1")], fast = t === "fast";
      set.face = [fs.map(fr), bs.map(fr), ss.map(fr), ss.map((x) => fr(flipX(x)))];
      const kit = (p, fl) => { const [a, b] = fl ? p.map(flipX) : p; return fast ? {w: [a, wings(a) || up1(a), b, wings(b) || up1(b)].map(bk), i: [a, b].map(bk)} : {w: [a, passOf(a), b, passOf(b)].map((x, i) => (i & 1 ? lift(bk(x)) : bk(x))), i: [bk(a), bk(squeeze(a))]}; };
      const K = [kit(fs), kit(bs), kit(ss), kit(ss, true)];
      set.walk = K.map((k) => k.w); set.idle = K.map((k) => k.i);
      if (L === "burrow") set.extra = [0, 1, 2].map((i) => fp(c("plume" + i)));
      base = fs[0];
    } else if (L === "rocket") {
      const tr = (n) => [c(n + "0"), c(n + "1"), c(n + "2")], dn = tr("down"), up = tr("up"), ss = tr("side");
      set.face = [dn.map(fr), up.map(fr), ss.map(fr), ss.map((x) => fr(flipX(x)))];
      base = up[0];
    } else if (L === "still") { const cs = [c("idle0"), c("idle1"), c("idle2")]; set.still = cs.map(bk); base = cs[0]; }
    else if (L === "spin") { const a = c("spin0"), b = c("spin1"); set.still = [0, 1, 2, 3].flatMap((r) => [fr(rot90(a, r)), fr(rot90(b, r))]); base = a; }
    else if (L === "shade") { const cs = [c("float0"), c("float1"), c("float2")]; set.still = cs.map(bk); set.extra = fp(c("hem")); base = cs[0]; }
    if (t === "fast") set.streak = [{w: 3, h: 2, rows: ["sbl", "sbl"]}, {w: 2, h: 3, rows: ["ss", "bb", "ll"]}].map((q) => fp({...q, axis: 0, anchor: [0, 0], pal: {s: "body.shadow", b: "body.base", l: "body.light"}}));
    set.mat = [blob(base, 0.5), scaled(base, 0.75), stretch(base)].map(fr);
    const rings = new Map();
    set.ring = (r) => rings.get(r) || (rings.set(r, fp(ringCell(r))), rings.get(r));
    foe[t] = set;
    puff[t] = [0, 1, 2, 3].map((i) => frame(cellOf("fx", "puff" + i), ctx));
  }

  const B = (n) => cellOf("bomb", n), bctx = {};
  const fuses = [0, 1, 2, 3].map((i) => B("fuse" + i)), spark = B("spark");
  const bomb = {
    body: frame(B("body"), bctx), swell: [frame(B("swell0"), bctx), frame(B("swell1"), bctx)],
    fuse: fuses.map((c) => frame(c, bctx)),
    spark: [frame(spark, bctx), frame(swapCell(spark, {s: "S", S: "s"}), bctx)],
    mark: Object.fromEntries(BOMB_MARKS.map((m) => [m, frame(B("mark." + m), bctx)])),
    roll: [frame(B("roll0"), bctx), frame(B("roll1"), bctx)],
  };
  bomb.swellSeq = [bomb.body, bomb.swell[0], bomb.swell[1]];

  const blast = {};
  for (const p of BLAST_PIECES) {
    const ages = BLAST_AGES.map((a) => cellOf("blast", p + "." + a));
    ages.push(fadeOf(ages[2]));
    const rots = p === "cross" ? 1 : p === "straight" ? 2 : 4;
    blast[p] = Array.from({length: rots}, (_, r) => ages.map((c) => frame(rot90(c, r), bctx)));
  }

  const items = {glyph: {}, ring: {}, well: frame(cellOf("items", "well"), {})};
  for (const p of POWER) {
    const ctx = {body: p.col}, fam = ITEM_FAMILY[p.t] || "cap";
    items.glyph[p.t] = frame(cellOf("items", p.t), ctx);
    const r0 = cellOf("items", "ring." + fam), r1 = fam === "utl" || fam === "bls" ? cellOf("items", "ring." + fam + "1") : r0;
    items.ring[p.t] = [frame(r0, ctx), frame(r1, ctx)];
  }
  for (const n of ["ring.cap", "ring.vit", "ring.utl", "ring.bls", "ring.utl1", "ring.bls1"]) cellOf("items", n);

  const X = (n) => frame(cellOf("fx", n), {body: HEX.spark});
  const fx = {reveal: [X("reveal0"), X("reveal1")], glint: [X("glint0"), X("glint1"), X("glint2")], puff};

  const shadow = Object.fromEntries(Object.entries(SHADOW_CELLS).map(([k, c]) => [k, frame(c, {})]));

  const tileSets = new Array(BIOMES.length).fill(null);
  function tiles(bi) {
    const i = ((bi | 0) % BIOMES.length + BIOMES.length) % BIOMES.length;
    if (tileSets[i]) return tileSets[i];
    const b = BIOMES[i], ctx = {biome: b}, T = (n) => cellOf("tiles", n), fr = (c) => frame(c, ctx);
    const wTop = T("wallTop"), wFace = T("wallFace"), bTop = T("brickTop"), bFace = T("brickFace");
    const fhW = faceRows(b.hWall), fhB = faceRows(b.hBrick), BP = brickPal(b.name), bk = (c) => ({...c, pal: {...c.pal, ...BP}}), fl = new Map(), f0 = floorPxCell(b.name, 0, 0), f1 = floorPxCell(b.name, 1, 0);
    tileSets[i] = {
      floor: (alt, v, n, w, nw) => { const k = (((alt * 4 + v) * 3 + n) * 3 + w) * 3 + nw; let f = fl.get(k); if (!f) fl.set(k, f = fr(floorPxCell(b.name, alt, v, n, w, nw))); return f; },
      wall: fr(composeFace(wTop, wFace, fhW)),
      brick: fr(composeFace(bk(bTop), bk(bFace), fhB)),
      crumble: [0, 1, 2, 3].map((k) => fr(composeFace(bk(T("crumble" + k)), bk(bFace), fhB))),
      slam: [0, 1, 2].map((k) => fr(T("slam" + k))),
      motif: [T("motif." + b.name + ".0"), T("motif." + b.name + ".1")],
      wallV: [f0, f1].map((f) => WALL_SRC.map(([n, m]) => { const w = cellOf("walls", b.name + "." + n); return fr(overlayCell(f, m ? mirrorCell(w) : w)); })),
    };
    return tileSets[i];
  }
  const featSet = new Map(), FEAT_MAX = 400;
  function feat(bi, s0, ft) {
    const s = s0.kind === "BELT" ? {...s0, ph: (s0.phase >> 1) % (s0.h > 1 ? 4 : 5)} : s0.kind === "STREAM" ? {...s0, ph: Math.floor((ft || 0) * 5) % 10} : s0;
    const i = ((bi | 0) % BIOMES.length + BIOMES.length) % BIOMES.length, k = (s.ph | 0) + "|" + i + "|" + s.kind + "|" + s.h + "|" + (s.dir | 0) + "|" + (s.outer ? s.outer.join("") : "NESW") + "|" + (s.state | 0) + "|" + (s.lit | 0) + "|" + (s.pair | 0);
    let f = featSet.get(k);
    if (!f) {
      f = frame(featPxCell(BIOMES[i], s), {biome: BIOMES[i]});
      if (featSet.size >= FEAT_MAX) featSet.clear();
      featSet.set(k, f);
    }
    return f;
  }
  tiles(0);
  mako(HEX.fin, false);

  return {mako, foe, bomb, blast, items, fx, tiles, feat, shadow, pending, used,
    bakeAll() { for (let i = 0; i < BIOMES.length; i++) tiles(i); mako(HEX.fin, true); return pending; }};
}
