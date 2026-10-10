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
  mako: [],
  foes: [],
  tiles: [],
  bomb: [],
  blast: [],
  items: [],
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

// ---- foe cast gates (plan §3.8, G0 R-G0-1 / R-G0-4 / frozen style) ----
{
  const F = ART.foes, C = F.cells || {}, has = (n) => !!C[n];
  const rgb = (h) => { const v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
  const lab = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }), X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + b * 0.0722, Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883, k = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * k(Y) - 16, 500 * (k(X) - k(Y)), 200 * (k(Y) - k(Z))]; };
  const dE = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  const over = (hi, lo, a) => "#" + rgb(hi).map((v, i) => Math.round(v * a + rgb(lo)[i] * (1 - a)).toString(16).padStart(2, "0")).join("");
  const mask = (c) => c.rows.map((r) => [...r].map((ch) => ch !== "."));
  const width = (c) => { let a = 99, b = -1; for (const r of c.rows) for (let x = 0; x < r.length; x++) if (r[x] !== ".") { a = Math.min(a, x); b = Math.max(b, x); } return b - a + 1; };
  const firstOf = (t) => C[t + ".front0"] || C[t + ".idle0"] || C[t + ".spin0"] || C[t + ".up0"] || C[t + ".float0"];
  const fronts = FOES.map((f) => [f.t, firstOf(f.t)]).filter((x) => x[1]);
  if (fronts.length) {
    const mk = ART.mako.cells && ART.mako.cells["front.idle0"], mw = mk ? width(mk) : 19;
    check("foes: every front narrower than MAKO (" + mw + ")", fronts.every(([, c]) => width(c) < mw), fronts.map(([t, c]) => t + " " + width(c)).join(" "));
    let worst = 0, wp = "";
    for (let i = 0; i < fronts.length; i++) for (let j = i + 1; j < fronts.length; j++) { const a = mask(fronts[i][1]), b = mask(fronts[j][1]); let n = 0, u = 0; for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) { if (a[y][x] && b[y][x]) n++; if (a[y][x] || b[y][x]) u++; } if (n / u > worst) { worst = n / u; wp = fronts[i][0] + "/" + fronts[j][0]; } }
    check("foes: pairwise silhouette IoU <= 0.80", worst <= 0.8, wp + " " + worst.toFixed(3));
  }
  check("foes: no cream slot (sclera is pow.line)", !Object.values(F.pal || {}).some((v) => String(v).startsWith("eye")));
  const specd = Object.entries(C).filter(([, c]) => c.rows.join("").includes("w"));
  check("foes: spec on knight only, 1-3 px", specd.every(([n, c]) => n.startsWith("knight.") && (c.rows.join("").match(/w/g) || []).length <= 3), specd.map(([n]) => n).join());
  const Lof = (n, ch) => { const t = FOES.find((f) => n.startsWith(f.t + ".")); return lab(resolveSlot({...F.pal, ...(C[n].pal || {})}[ch], {body: t && t.col}))[0]; };
  const fastN = Object.keys(C).filter((n) => n.startsWith("fast."));
  if (fastN.length) { let lo = 1, at = ""; for (const n of fastN) { const px = [...C[n].rows.join("")].filter((ch) => ch !== "."), v = px.filter((ch) => Lof(n, ch) <= 50).length / px.length; if (v < lo) { lo = v; at = n; } }
    check("foes: FAST dark share >= 60% on every cell, dark = resolved L* <= 50 (outline L* 45 + ink count; shadow #b6ba3c L* 73 does not)", lo >= 0.6, (100 * lo).toFixed(1) + "% worst at " + at); }
  if (has("fast.front0")) { const R = C["fast.front0"].rows, top = R.findIndex((r) => /[^.]/.test(r)); let dp = 0; while (R[top + dp] && R[top + dp][10] === ".") dp++; check("foes: FAST V-notch >= 3 px deep at the top centre (plan §3.8)", dp >= 3, dp + " px"); }
  if (has("burrow.front0") && has("fast.front0")) { const lb = Lof("burrow.front0", "b"), lf = Lof("fast.front0", "b"); check("foes: BURROW body.base >= 15 L* below FAST (G0 #11)", lf - lb >= 15, lb.toFixed(1) + " vs " + lf.toFixed(1)); }
  const tops = (rows) => Array.from({length: 20}, (_, x) => { const y = rows.findIndex((r) => r[x] && r[x] !== "."); return y < 0 ? 99 : y; });
  const sweptUp = (c) => { const t = tops(c.rows), ax = c.axis ?? 10; return t.some((v, x) => Math.abs(x - ax) > 4 && v < 99 && v < t[x < ax ? x + 1 : x - 1]); };
  { const mk = ART.mako.cells && ART.mako.cells["front.idle0"], up = Object.entries(C).filter(([n, c]) => !/^(rocket|boomerang)\.|plume|hem/.test(n) && sweptUp(c)).map(([n]) => n);
    check("foes: MAKO the only swept-up side protrusion (plan §3.8; rocket tail fins and the spinning phantom exempt by name)", (!mk || sweptUp(mk)) && !up.length, up.join() || "mako only"); }
  const ringN = Object.keys(C).filter((n) => /^(fast|knight|burrow)\./.test(n) && !/plume/.test(n)), open = [];
  for (const n of ringN) { const R = C[n].rows; R.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "." || ch === "o" || ch === "k") return; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !R[y + b] || !R[y + b][x + a] || R[y + b][x + a] === ".")) open.push(n + "@" + x + "," + y); })); }
  check("foes: FAST, KNIGHT, BURROW keep a full dark ring (G0 §4; disclosed: knight feet are outline-colour stubs below the body ring)", !open.length, open.slice(0, 4).join(" ") || ringN.length + " cells");
  if (has("stationary.idle0")) { const c = C["stationary.idle0"], h = c.rows.filter((r) => /[^.]/.test(r)).length; check("foes: SENTRY >= 14 tall, >= 12 wide, foe.boomerang core", h >= 14 && width(c) >= 12 && c.rows.join("").includes("m") && F.pal.m === "foe.boomerang", h + "x" + width(c)); }
  { const pl = Object.keys(C).filter((n) => /^burrow\.plume/.test(n)), body = Object.keys(C).filter((n) => /^burrow\./.test(n) && !/plume/.test(n)), hit = [];
    for (const p of pl) for (const b of body) C[p].rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== "." && C[b].rows[y] && C[b].rows[y][x] === "o") hit.push(p + ">" + b + "@" + x + "," + y); }));
    if (pl.length) check("foes: BURROW plume never overwrites a body outline pixel (shared anchor)", !hit.length, hit.slice(0, 4).join(" ") || pl.length + "x" + body.length); }
  { const bk = Object.keys(C).filter((n) => /^(walker|fast|knight|burrow|chaser)\.back/.test(n)), seen = bk.filter((n) => C[n].rows.join("").includes("e"));
    if (bk.length) check("foes: back frames show no sclera or lens (facing: a back never reads as a face)", !seen.length, seen.join() || bk.length + " cells"); }
  const first = {walker: 1, stationary: 1, fast: 2, chaser: 3, boomerang: 4, rocket: 5, burrow: 6, shade: 7, knight: 8}, D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const GD_EXC = {};
  let gw = 1, gat = "";
  const exc = [];
  for (const f of FOES) for (const [n, c] of Object.entries(C)) {
    if (!n.startsWith(f.t + ".") || /plume|hem/.test(n)) continue;
    const P = {...F.pal, ...(c.pal || {})}, at = (x, y) => (c.rows[y] && c.rows[y][x]) || ".";
    for (let r = first[f.t] || 1; r <= 8; r++) { const b = BIOMES[r - 1], ctx = {body: f.col, biome: b};
      for (const [k, bg] of [["floor0", b.floor0], ["floor1", b.floor1], ["wall", b.wall], ["wallHi", b.wallHi], ["brickA", b.brickA], ["brickHi", over(b.brickHi, b.brickA, 0.55)]]) {
        let per = 0, okc = 0;
        for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) { const ch = at(x, y); if (ch === ".") continue; const ns = D8.filter(([a, q]) => at(x + a, y + q) === "."); if (!ns.length) continue; per++;
          if (dE(resolveSlot(P[ch], ctx), bg) >= 14 || ns.some(([a, q]) => { const i = at(x - a, y - q); return i !== "." && dE(resolveSlot(P[i], ctx), bg) >= 14; })) okc++; }
        const key = n + "@" + b.name + "." + k, v = per ? okc / per : 1;
        if (GD_EXC[key] != null) { exc.push(key + " " + (100 * v).toFixed(0) + "%"); if (v < GD_EXC[key]) { gw = 0; gat = key + " below its exception floor"; } continue; }
        if (v < gw) { gw = v; gat = key; } } } }
  if (gat) check("foes: G-D two-ring >= 85% on every spawn biome floor/wall/wallHi/brick (R-G0-1)", gw >= 0.85, (100 * gw).toFixed(0) + "% worst at " + gat);
  const stale = Object.keys(GD_EXC).filter((k) => !exc.some((e) => e.startsWith(k + " ")));
  check("foes: G-D named exceptions (R-G0-1 fallback) are live and above their floor", !stale.length, exc.join("; ") || "none");
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
