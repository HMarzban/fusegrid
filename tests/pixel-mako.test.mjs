// PIXEL MAKO sheet pins (art/mako.js): the canonical front silhouette (M0),
// p.color on fins only (M8, by slot), the R18 mirror contract for 3/4 cells,
// the R11 faceless back, feet-only walk cycles (no bob, opaque spread <=3%),
// the R-G0-1 two-ring edge on every biome backdrop, and state overlays that
// clear every body frame by a 1-px gap (posed TRUE, never skipped).
import { BIOMES } from "../src/core/config.js";
import { resolveSlot } from "../src/render/pixel/palette.js";
import { anchorOf, flipX, validateCell } from "../src/render/pixel/grid.js";
import { SHEET } from "../src/render/pixel/art/mako.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const C = SHEET.cells, P = SHEET.pal, ctx = { body: "#c39cff", fin: "#37f0d0", feet: "#2e1a4e" };
const slotOf = (ch) => P[ch] || "";
const isFin = (ch) => slotOf(ch).startsWith("fin");
const isFill = (ch) => /^(body\.(shadow|base|light)|eye|ink|spec)/.test(slotOf(ch));
const CANON = [
  "......##...##.......", "...#.####.####.#....", "..###############...", ".#################..",
  "###################.", "###################.", ".#################..", "..###############...",
  "...#############....", "...#############....", "....###########.....", "....###########.....",
  "....#####.#####.....", ".....###...###......",
];
const FACES = ["front", "side", "back"], CYC = ["idle0", "idle1", "walk0", "walk1"];
const BODY = [...FACES.flatMap((f) => CYC.map((c) => f + "." + c)), "win0", "win1", "kick", "throw"];

check("palette <= 16 slots, all resolvable", Object.keys(P).length <= 16 && Object.values(P).every((s) => resolveSlot(s, ctx)), Object.keys(P).length);
check("every cell valid", Object.entries(C).every(([, c]) => validateCell(c, P).length === 0));
check("M0 front.idle0 silhouette == canonical mask (IoU 1.000)", C["front.idle0"].rows.slice(4, 18).every((r, y) => r.replace(/[^.]/g, "#") === CANON[y]) && C["front.idle0"].rows.every((r, y) => (y >= 4 && y < 18) || !/[^.]/.test(r)));
check("M7 front.idle0 teeth: two 2-px spec blocks, ink seam on axis col 9", C["front.idle0"].rows[12].slice(6, 13) === "kwwkwwk" && slotOf("w") === "spec" && slotOf("k") === "ink");
{
  let bad = [];
  for (const [n, c] of Object.entries(C)) for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (isFin(c.rows[y][x])) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = c.rows[y + b] && c.rows[y + b][x + a]; if (q && isFill(q)) bad.push(n + "@" + x + "," + y); }
  check("M8 fin slots never touch body/face fill (p.color on fins only)", bad.length === 0, bad.slice(0, 4).join(" "));
}
check("R18 3/4 cells sit on axis 9 with column 19 empty", CYC.every((s) => C["side." + s].axis === 9 && C["side." + s].rows.every((r) => r[19] === ".")));
check("R11 back: no cream, ink or teeth", CYC.every((s) => !/[eEkw]/.test(C["back." + s].rows.join(""))));
check("A ramp: light step <= 4 px on every body frame", BODY.every((n) => (C[n].rows.join("").match(/l/g) || []).length <= 4));
for (const f of FACES) {
  const cy = CYC.map((s) => C[f + "." + s].rows), cnt = cy.map((r) => r.join("").replace(/\./g, "").length), top = cy.map((r) => r.findIndex((x) => /[^.]/.test(x)));
  const face = (r) => r.slice(4, 15).map((x) => x.replace(/[^kwEe]/g, ".")).join("|");
  check(f + " walk: feet only (no bob, face fixed, opaque spread <= 3%)", top.every((t) => t === top[0]) && cy.every((r) => face(r) === face(cy[0])) && (Math.max(...cnt) - Math.min(...cnt)) / Math.max(...cnt) <= 0.03, cnt.join("/"));
}
{
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const lab = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); const X = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047), Y = f(r * 0.2126 + g * 0.7152 + b * 0.0722), Z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883); return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; };
  const dE = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  const over = (hi, lo, a) => "#" + rgb(hi).map((v, i) => Math.round(v * a + rgb(lo)[i] * (1 - a)).toString(16).padStart(2, "0")).join("");
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  const ring = (c, bg) => { const R = c.rows, at = (x, y) => (R[y] && R[y][x]) || ".", hx = (ch) => resolveSlot(P[ch], ctx); let n = 0, ok = 0;
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) { const ch = R[y][x]; if (ch === ".") continue; const ns = D8.filter(([a, b]) => at(x + a, y + b) === "."); if (!ns.some(([a, b]) => !a || !b)) continue; n++;
      if (ns.every(([a, b]) => { if (dE(hx(ch), bg) >= 14) return true; let X = x - a, Y = y - b; while (at(X, Y) === "o" || at(X, Y) === ch) { X -= a; Y -= b; } const q = at(X, Y); return q !== "." && dE(hx(q), bg) >= 14; })) ok++; }
    return ok / n; };
  let worst = 1, where = "";
  for (const n of [...BODY, "death0", "death1", "death2", "mat1", "mat2"]) for (const b of BIOMES) for (const [s, bg] of [["floor0", b.floor0], ["floor1", b.floor1], ["wall", b.wall], ["wallHi", b.wallHi], ["brickA", b.brickA], ["brickHi", over(b.brickHi, b.brickA, 0.55)]]) { const v = ring(C[n], bg); if (v < worst) { worst = v; where = n + " " + b.name + "." + s; } }
  check("R-G0-1 two-ring edge >= 85% on every biome backdrop", worst >= 0.85, (100 * worst).toFixed(0) + "% worst at " + where);
}
for (const o of ["shield0", "shield1", "passing"]) {
  const oc = C[o], [oax, oay] = anchorOf(oc);
  let hit = "";
  for (const n of BODY) for (const bc of n.startsWith("side") ? [C[n], flipX(C[n])] : [C[n]]) { const [bax, bay] = anchorOf(bc);
    for (let y = 0; y < oc.h && !hit; y++) for (let x = 0; x < oc.w && !hit; x++) { if (oc.rows[y][x] === ".") continue; const bx = x - oax + bax, by = y - oay + bay;
      for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const q = bc.rows[by + b] && bc.rows[by + b][bx + a]; if (q && q !== ".") hit = n + "@" + bx + "," + by; } } }
  check(o + " clears every body frame by >= 1 px (fin shoulder included)", !hit, hit);
}
check("overlays centred on MAKO's anchor", ["shield0", "shield1", "passing"].every((o) => { const c = C[o], [ax, ay] = anchorOf(c); return c.rows[ay][0] !== "." && c.rows[ay][c.w - 1] !== "." && 2 * ax === c.w - 1; }));

console.log("\n  PIXEL MAKO RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
