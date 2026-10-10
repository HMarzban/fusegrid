/* PIXEL manifest: every cell the px look needs, derived from code (FOES,
   POWER, BIOMES, bomb variants), so a new foe, pickup or biome without px
   cells shows up as a fallback row instead of passing silently. Keys are
   "<group>/<name>"; <group> is the art sheet (art/<group>.js) and <name> the
   key in its cells object. */
import {BIOMES} from "../../core/config.js";
import {POWER, FOES} from "../../core/entities.js";

export const MAKO_FACES = Object.freeze(["front", "side", "back"]);
export const MAKO_CYCLE = Object.freeze(["idle0", "idle1", "walk0", "walk1"]);
export const MAKO_ONE = Object.freeze(["death0", "death1", "death2", "death3", "death4", "death5", "mat0", "mat1", "mat2", "win0", "win1", "kick", "throw"]);
export const MAKO_OVER = Object.freeze(["shield0", "shield1", "passing"]);
const STEP7 = ["front0", "front1", "back0", "back1", "side0", "side1", "stunned"];
export const FOE_LAYOUT = Object.freeze({
  walker: "step", fast: "step", chaser: "step", knight: "step",
  stationary: "still", boomerang: "spin", rocket: "rocket", burrow: "burrow", shade: "shade",
});
export const LAYOUT_CELLS = Object.freeze({
  step: Object.freeze(STEP7),
  still: Object.freeze(["idle0", "idle1", "stunned"]),
  spin: Object.freeze(["spin0", "spin1", "stunned"]),
  rocket: Object.freeze(["up0", "up1", "down0", "down1", "side0", "side1", "stunned"]),
  burrow: Object.freeze(STEP7.concat(["plume0", "plume1", "plume2"])),
  shade: Object.freeze(["float0", "float1", "stunned", "hem"]),
});
export const FOE_TYPES = Object.freeze(FOES.map((f) => f.t));
export const layoutOf = (type) => FOE_LAYOUT[type] || "step";
export const TILE_CELLS = Object.freeze(["floor0", "floor1", "wallTop", "wallFace", "brickTop", "brickFace", "crumble0", "crumble1", "crumble2", "crumble3", "slam0", "slam1", "slam2"]);
export const BOMB_CELLS = Object.freeze(["body", "swell0", "swell1", "fuse0", "fuse1", "fuse2", "fuse3", "spark", "mark.power", "mark.pierce", "mark.line", "roll0", "roll1"]);
export const BOMB_MARKS = Object.freeze(["power", "pierce", "line"]);
export const BLAST_PIECES = Object.freeze(["cross", "straight", "end"]);
export const BLAST_AGES = Object.freeze(["grow", "full", "thin"]);
export const ITEM_TYPES = Object.freeze(POWER.map((p) => p.t));
export const ITEM_CHROME = Object.freeze(["well", "ring.cap", "ring.vit", "ring.utl", "ring.bls", "ring.utl1", "ring.bls1"]);
export const FX_CELLS = Object.freeze(["reveal0", "reveal1", "sparkle0", "sparkle1", "sparkle2", "glint0", "glint1", "glint2", "puff0", "puff1", "puff2", "puff3"]);

export const MANIFEST = Object.freeze([
  ...MAKO_FACES.flatMap((f) => MAKO_CYCLE.map((c) => "mako/" + f + "." + c)),
  ...MAKO_ONE.map((n) => "mako/" + n),
  ...MAKO_OVER.map((n) => "mako/" + n),
  ...FOE_TYPES.flatMap((t) => LAYOUT_CELLS[layoutOf(t)].map((c) => "foes/" + t + "." + c)),
  ...TILE_CELLS.map((n) => "tiles/" + n),
  ...BIOMES.flatMap((b) => ["tiles/motif." + b.name + ".0", "tiles/motif." + b.name + ".1"]),
  ...BOMB_CELLS.map((n) => "bomb/" + n),
  ...BLAST_PIECES.flatMap((p) => BLAST_AGES.map((a) => "blast/" + p + "." + a)),
  ...ITEM_TYPES.map((t) => "items/" + t),
  ...ITEM_CHROME.map((n) => "items/" + n),
  ...FX_CELLS.map((n) => "fx/" + n),
]);
/* Manifest keys an art set does not draw yet (served by fallback.js). */
export function pendingOf(art) {
  return MANIFEST.filter((k) => { const i = k.indexOf("/"), sh = art[k.slice(0, i)]; return !(sh && sh.cells && sh.cells[k.slice(i + 1)]); });
}
