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
import {anchorOf, cellRGBA, flipX, rot90, swapCell} from "./grid.js";
import {fallbackCell} from "./fallback.js";
import {ART} from "./art/index.js";
import {MAKO_FACES, MAKO_CYCLE, layoutOf, BOMB_MARKS, BLAST_PIECES, BLAST_AGES} from "./manifest.js";

export const faceRows = (h) => Math.max(2, Math.min(10, Math.round((h || 0) / 4)));

function composeFace(top, face, fh) {
  const rows = top.rows.slice(0, top.h - fh).concat(face.rows.slice(0, fh));
  while (rows.length < top.h) rows.push(rows[rows.length - 1]);
  return {...top, rows, pal: {...(top.pal || {}), ...(face.pal || {})}};
}

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
  for (const f of FOES) {
    const t = f.t, L = layoutOf(t), ctx = {body: f.col}, c = (n) => cellOf("foes", t + "." + n), fr = (cl) => frame(cl, ctx);
    const set = {layout: L, stun: fr(c("stunned")), face: null, still: null, extra: null};
    if (L === "step" || L === "burrow") {
      const fs = [c("front0"), c("front1")], bs = [c("back0"), c("back1")], ss = [c("side0"), c("side1")];
      set.face = [fs.map(fr), bs.map(fr), ss.map(fr), ss.map((x) => fr(flipX(x)))];
      if (L === "burrow") set.extra = [0, 1, 2].map((i) => fr(c("plume" + i)));
    } else if (L === "rocket") {
      const ss = [c("side0"), c("side1")];
      set.face = [[fr(c("down0")), fr(c("down1"))], [fr(c("up0")), fr(c("up1"))], ss.map(fr), ss.map((x) => fr(flipX(x)))];
    } else if (L === "still") set.still = [fr(c("idle0")), fr(c("idle1"))];
    else if (L === "spin") { const a = c("spin0"), b = c("spin1"); set.still = [0, 1, 2, 3].flatMap((r) => [fr(rot90(a, r)), fr(rot90(b, r))]); }
    else if (L === "shade") { set.still = [fr(c("float0")), fr(c("float1"))]; set.extra = fr(c("hem")); }
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
  const fx = {reveal: [X("reveal0"), X("reveal1")], sparkle: [X("sparkle0"), X("sparkle1"), X("sparkle2")], glint: [X("glint0"), X("glint1"), X("glint2")], puff};

  const tileSets = new Array(BIOMES.length).fill(null);
  function tiles(bi) {
    const i = ((bi | 0) % BIOMES.length + BIOMES.length) % BIOMES.length;
    if (tileSets[i]) return tileSets[i];
    const b = BIOMES[i], ctx = {biome: b}, T = (n) => cellOf("tiles", n), fr = (c) => frame(c, ctx);
    const f0 = T("floor0"), f1 = T("floor1"), band = (c, s) => ({...c, rows: c.rows.map((r, y) => (y < 3 ? r.replace(/[^.]/g, "§") : r)), pal: {...c.pal, "§": s}});
    const wTop = T("wallTop"), wFace = T("wallFace"), bTop = T("brickTop"), bFace = T("brickFace");
    const fhW = faceRows(b.hWall), fhB = faceRows(b.hBrick);
    tileSets[i] = {
      floor: [fr(f0), fr(f1)],
      floorC: [fr(band(f0, "tile.floor0.shadow")), fr(band(f1, "tile.floor1.shadow"))],
      wall: fr(composeFace(wTop, wFace, fhW)),
      brick: fr(composeFace(bTop, bFace, fhB)),
      crumble: [0, 1, 2, 3].map((k) => fr(composeFace(T("crumble" + k), bFace, fhB))),
      slam: [0, 1, 2].map((k) => fr(T("slam" + k))),
      motif: [fr(T("motif." + b.name + ".0")), fr(T("motif." + b.name + ".1"))],
    };
    return tileSets[i];
  }
  tiles(0);
  mako(HEX.fin, false);

  return {mako, foe, bomb, blast, items, fx, tiles, pending, used,
    bakeAll() { for (let i = 0; i < BIOMES.length; i++) tiles(i); mako(HEX.fin, true); return pending; }};
}
