/* Colour-vision gate inputs (#33), pure Node: the eight floor tiles (plus the worst states) x CORE / PLUS / MAX as PIXEL cells, with the base floor (both parities,
   every FLOOR_V variant), the interior WALL cells (base, v1, v2, acc, over both floors) and the BRICK cell (over both floors) of the same world, all at 8x = 160 px.
   The CLASSIC 2D twin is rendered in Chrome by gates.mjs (PAGE3) from the same CVD_ENT list. */
import {BIOMES} from "../../src/core/config.js";
import {featPxCell} from "../../src/render/featpx.js";
import {floorPxCell} from "../../src/render/featpxcells.js";
import {cellRGBA} from "../../src/render/pixel/grid.js";
import {createAtlas} from "../../src/render/pixel/atlas.js";
import {FLOOR_V} from "../../src/render/floorart.js";
const ALL = ["N", "E", "S", "W"];
/* [id, biome, spec]: the readability set of gates.mjs (idle + worst states) plus GATE open (lit 0) and the run ends (cellSpec turns a BELT / STREAM exit into an
   outer side); tiles with rules first */
export const CVD_ENT = [["booster", "JUNGLE", {kind: "BLOOM"}], ["ice-patch", "ICE", {kind: "GLIDE", gx: 3, gy: 4}], ["conveyor", "FACTORY", {kind: "BELT", dir: 0, outer: ["N", "S"]}], ["trap", "ARENA", {kind: "PLATE"}],
  ["stream", "WATER", {kind: "STREAM", dir: 0, outer: ["N", "S"]}], ["quicksand", "SAND", {kind: "QUICK"}], ["portal", "VOID", {kind: "PORTAL", pair: 1}], ["gate", "CROWN", {kind: "GATE", lit: 2}],
  ["booster-flare", "JUNGLE", {kind: "BLOOM", state: 1}], ["trap-wind", "ARENA", {kind: "PLATE", state: 1, lit: 4}], ["portal-3", "VOID", {kind: "PORTAL", pair: 3}], ["gate-shut", "CROWN", {kind: "GATE", lit: 4}],
  ["gate-open", "CROWN", {kind: "GATE", lit: 0}], ["conveyor-end", "FACTORY", {kind: "BELT", dir: 0, outer: ["N", "S", "E"]}],
  ["stream-end", "WATER", {kind: "STREAM", dir: 0, outer: ["N", "S", "E"]}]].map(([id, bn, s]) => [id, bn, {outer: ALL, ...s}]);
export const RULED = new Set(["booster", "ice-patch", "conveyor", "trap", "booster-flare", "trap-wind", "conveyor-end"]);
const K = 8, S = 20 * K;
const up = (a) => { const o = new Uint8ClampedArray(S * S * 4); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) for (let i = 0; i < 4; i++) o[(y * S + x) * 4 + i] = a[((y / K | 0) * 20 + (x / K | 0)) * 4 + i]; return o; };
const over = (top, base) => { const o = Uint8ClampedArray.from(base); for (let i = 0; i < o.length; i += 4) if (top[i + 3] > 127) for (let k = 0; k < 4; k++) o[i + k] = top[i + k]; return o; };
export function pxSets() {
  const A = createAtlas((w, h, d) => ({width: w, height: h, data: d})), out = [], refs = new Map();
  for (const [id, bn, s] of CVD_ENT) {
    const bi = BIOMES.findIndex((b) => b.name === bn), b = BIOMES[bi], ctx = {biome: b}, cell = (c) => cellRGBA(c, c.pal, ctx);
    if (!refs.has(bn)) {
      const T = A.tiles(bi), fl = [0, 1].map((p) => Array.from({length: FLOOR_V}, (_, v) => cell(floorPxCell(bn, p, v))));
      refs.set(bn, {floor: fl.flat().map(up), wall: [0, 1].flatMap((p) => [0, 1, 2, 3].map((c) => up(T.wallV[p][c].im.data))), brick: [0, 1].map((p) => up(over(T.brick.im.data, fl[p][0]))), brickHex: [b.brickA, b.brickB]});
    }
    out.push({id, bn, ruled: RULED.has(id), S, heats: [0, 1, 2].map((h) => up(cell(featPxCell(b, {...s, h})))), ...refs.get(bn)});
  }
  return out;
}
