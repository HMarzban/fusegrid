// PIXEL art data: format validity of every art sheet, the frozen pxRamp
// values (plan P1-P3), the manifest derived from code, and the PENDING list
// of manifest cells still served by the generated placeholders.
//
// PENDING: one line per art group. "all" means every manifest cell of that
// group is still a placeholder. When you draw cells, replace "all" on YOUR
// group's line with the explicit list of keys still missing (or [] when the
// group is complete). A drawn cell still listed here FAILS (stale list), and
// a missing cell not listed here FAILS (silent fallback). Must be empty at
// W-INT.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BIOMES } from "../src/core/config.js";
import { POWER, FOES } from "../src/core/entities.js";
import { PLAYER_HULL } from "../src/render/sprites.js";
import { pxRamp, resolveSlot, HEX } from "../src/render/pixel/palette.js";
import { validateCell, flipX, rot90, swapCell, cellRGBA, axisOf } from "../src/render/pixel/grid.js";
import { MANIFEST, pendingOf, FOE_TYPES, ITEM_TYPES, BOMB_MARKS, BLAST_PIECES, BLAST_AGES, MAKO_FACES, MAKO_CYCLE, MAKO_ONE, MAKO_OVER } from "../src/render/pixel/manifest.js";
import { ART } from "../src/render/pixel/art/index.js";
import { createAtlas } from "../src/render/pixel/atlas.js";
import { fallbackCell } from "../src/render/pixel/fallback.js";
import { surfRGBA } from "../tools/pixel/rgba.mjs";

const PENDING = {
  mako: "all",
  foes: "all",
  tiles: [],
  bomb: [],
  blast: [],
  items: "all",
  fx: [],
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

// ---- palette ----
{
  const m = pxRamp(PLAYER_HULL);
  check("P3 MAKO ramp frozen: #3d427e / #8183dc / #c39cff / #e2b2ff",
    m.outline === "#3d427e" && m.shadow === "#8183dc" && m.base === "#c39cff" && m.light === "#e2b2ff", JSON.stringify(m));
  const f = pxRamp("#37f0d0");
  check("fin ramp frozen: #00747c / #00c4c9 / #37f0d0 / #7fffd9",
    f.outline === "#00747c" && f.shadow === "#00c4c9" && f.light === "#7fffd9", JSON.stringify(f));
  const repo = [...BIOMES.flatMap((b) => ["bg0", "bg1", "brickA", "brickB", "brickHi", "wall", "wallHi", "floor0", "floor1"].map((k) => b[k])),
    ...FOES.map((x) => x.col), ...POWER.map((x) => x.col), ...Object.values(HEX)];
  check("P2 every repo hex is the verbatim base step", repo.every((h) => pxRamp(h).base === h.toLowerCase()), repo.length);
  check("slot grammar: contextual, fixed, foe./pow./tile. sources resolve; unknown is null",
    resolveSlot("body.shadow", {body: PLAYER_HULL}) === "#8183dc" && resolveSlot("fin", {fin: "#37f0d0"}) === "#37f0d0"
    && resolveSlot("ink") === "#12121e" && resolveSlot("foe.fast") === "#ffd447" && resolveSlot("pow.kick") === "#c07a3a"
    && resolveSlot("tile.wall", {biome: BIOMES[7]}) === "#8a6040" && resolveSlot("nope") === null && resolveSlot("ink.light") === null);
  check("L3 MAKO light step stays below the eye cream (eyes brightest)", (() => { const L = (h) => { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; }; return L(m.light) < L(HEX.eye) && L(m.light) <= 0.8; })());
  check("hurt desat swap greys the contextual ramps", /^#([0-9a-f]{2})\1\1$/.test(resolveSlot("body.base", {desat: true})));
}

// ---- grid helpers ----
{
  const c = {w: 7, h: 1, axis: 2, rows: ["ab.cd.."], pal: {a: "ink", b: "ink", c: "ink", d: "ink"}};
  check("flipX mirrors about the AXIS column, not the cell edge", flipX(c).rows[0] === "dc.ba.." && axisOf(flipX(c)) === 2, flipX(c).rows[0]);
  const q = {w: 3, h: 2, rows: ["abc", "def"]};
  check("rot90 x4 is identity; one turn swaps w/h", rot90(q, 1).w === 2 && rot90(q, 1).rows.join("|") === "da|eb|fc" && rot90(q, 4).rows.join("|") === "abc|def", rot90(q, 1).rows.join("|"));
  check("swapCell is a palette swap (chars only)", swapCell(q, {a: "z"}).rows[0] === "zbc");
  const px = cellRGBA({w: 2, h: 1, rows: ["a."], pal: {a: "ink"}}, null, {});
  check("cells bake with alpha 0 or 255 only (P5)", px[3] === 255 && px[7] === 0);
}

// ---- art sheets ----
{
  for (const [g, sh] of Object.entries(ART)) {
    const errs = [];
    const palN = Object.keys(sh.pal || {}).length;
    for (const [n, c] of Object.entries(sh.cells || {})) for (const e of validateCell(c, sh.pal)) errs.push(n + ": " + e);
    check("art/" + g + ".js: every cell valid, sheet palette <= 16 slots", !errs.length && palN <= 16, errs.slice(0, 4).join("; ") || palN);
  }
  const files = readdirSync(join(ROOT, "src/render/pixel/art")).filter((f) => f.endsWith(".js"));
  const hex = files.filter((f) => /#[0-9a-fA-F]{6}\b|#000\b/.test(readFileSync(join(ROOT, "src/render/pixel/art", f), "utf8")));
  check("art files hold slots, never hex (plan P2)", hex.length === 0, hex.join());
  const unknown = Object.entries(ART).flatMap(([g, sh]) => Object.keys(sh.cells || {}).map((n) => g + "/" + n)).filter((k) => !MANIFEST.includes(k));
  check("every authored cell is a manifest key (no orphan art)", unknown.length === 0, unknown.slice(0, 5).join());
}

// ---- manifest, derived from code ----
{
  check("manifest: every FOES type (" + FOE_TYPES.length + ")", FOES.every((f) => MANIFEST.some((k) => k.startsWith("foes/" + f.t + "."))));
  check("manifest: the 12 POWER kinds", ITEM_TYPES.length === 12 && POWER.every((p) => MANIFEST.includes("items/" + p.t)));
  check("manifest: a floor motif pair per biome (" + BIOMES.length + ")", BIOMES.every((b) => MANIFEST.includes("tiles/motif." + b.name + ".0") && MANIFEST.includes("tiles/motif." + b.name + ".1")));
  check("manifest: 3 bomb variant marks (bombKind line/power/pierce; normal has none)", BOMB_MARKS.length === 3 && BOMB_MARKS.every((m) => MANIFEST.includes("bomb/mark." + m)));
  check("manifest: 3 blast pieces x 3 authored ages (fade generated)", BLAST_PIECES.length * BLAST_AGES.length === MANIFEST.filter((k) => k.startsWith("blast/")).length);
  check("manifest: MAKO 3 facings x 4 + 13 one-shots + 3 overlays", MAKO_FACES.length * MAKO_CYCLE.length + MAKO_ONE.length + MAKO_OVER.length === MANIFEST.filter((k) => k.startsWith("mako/")).length && MANIFEST.filter((k) => k.startsWith("mako/")).length === 28);
  check("manifest keys unique", new Set(MANIFEST).size === MANIFEST.length, MANIFEST.length);
}

// ---- PENDING ----
{
  const pend = pendingOf(ART);
  const declared = Object.entries(PENDING).flatMap(([g, v]) => (v === "all" ? MANIFEST.filter((k) => k.startsWith(g + "/")) : v.map((n) => (n.includes("/") ? n : g + "/" + n))));
  const silent = pend.filter((k) => !declared.includes(k)), stale = declared.filter((k) => !pend.includes(k));
  check("every placeholder cell is declared PENDING (no silent fallback)", silent.length === 0, silent.slice(0, 6).join());
  check("no drawn cell is still declared PENDING (keep the list honest)", stale.length === 0, stale.slice(0, 6).join());
  const byG = {};
  for (const k of pend) { const g = k.split("/")[0]; byG[g] = (byG[g] || 0) + 1; }
  console.log("  PIXEL PENDING: " + pend.length + " / " + MANIFEST.length + " cells still placeholders " + JSON.stringify(byG));
  check("PENDING count printed (" + pend.length + ")", true);
}

// ---- bake ----
{
  const A = createAtlas(surfRGBA);
  A.bakeAll();
  let bad = 0, black = 0, frames = 0;
  const seen = new Set();
  const visit = (o) => {
    if (!o || typeof o !== "object" || seen.has(o)) return;
    seen.add(o);
    if (o.im && o.im.data) { frames++; const d = o.im.data; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] !== 0 && d[i + 3] !== 255) bad++; if (d[i + 3] && !d[i] && !d[i + 1] && !d[i + 2]) black++; } return; }
    for (const v of Object.values(o)) visit(v);
  };
  visit({foe: A.foe, bomb: A.bomb, blast: A.blast, items: A.items, fx: A.fx, m0: A.mako(null, false), m1: A.mako(null, true), t: Array.from({length: BIOMES.length}, (_, i) => A.tiles(i))});
  check("every frame bakes (" + frames + "), opaque or clear only, never #000000 (P5, P6)", frames > 300 && bad === 0 && black === 0, bad + " " + black);
  const fins = A.mako("#ff3060", false);
  check("fins recolour per p.color (cached set per colour)", fins !== A.mako(null, false) && A.mako("#ff3060", false) === fins);
  check("every manifest key bakes through fallback when undrawn", MANIFEST.every((k) => { const i = k.indexOf("/"); const c = fallbackCell(k.slice(0, i), k.slice(i + 1)); return validateCell(c, c.pal).length === 0; }));
}

console.log("\n  PIXEL ART RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
