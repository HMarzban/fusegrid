/* LOGO B WORLDS: what each of the eight worlds changes on the wordmark (appendix 8.8, built values): the side colour (the extrusion), the plate (bed,
   frame, frame highlight, corner marks) and one motif; faces, cord, bomb and spark never change. Rows read the kit's world tokens, so there is one colour
   source: bed = bg1, frame = frame (wall), frame highlight = boss (wallHi), side = the biome slot the PIXEL side slot names (ICE takes the kit's glacier
   cyan, lead ruling on appendix 14 item 13). ICE frost, VOID rings and CROWN gilt are layer-stack dressing; motif(world, build, tier, px) returns the
   parts (glyphs.js part kinds, layout units, each tagged with the letter it sits on, or "bomb") in draw order: title tier the full motif, token and MENU
   the token, small and mono none, CROWN none at MENU. px = the cap height in CSS px; it only raises the minimum widths. Pure: no DOM, clock or randomness
   (SAND grain is a fixed LCG pattern seeded by the letter's layout index, its inside test run in the letter's own units). */
import {BIOMES} from "../../core/config.js";
import {worldTokens} from "../kit/tokens.js";
import {GL, P, BD, layout, glyph, inShape} from "./glyphs.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object" && !Object.isFrozen(v)) deep(v); return Object.freeze(o); };
const rad = (d) => (d * Math.PI) / 180;
const SIDE = {JUNGLE: "bg0", ICE: "wall", FACTORY: "bg0", WATER: "bg0", ARENA: "bg0", SAND: "bg0", VOID: "brickB", CROWN: "brickB"};
const CORNER = {FACTORY: {kind: "bolt", size: 7, inset: 4}, ARENA: {kind: "stud", size: 7, inset: 4}, CROWN: {kind: "filigree", size: 9, inset: 4}};
const DRESS = {ICE: {frost: "#f4fcff"}, VOID: {ring: {close: .16, w: [.04, .04], col: ["#6a20c8", "#3a1070"]}}, CROWN: {gilt: {line: .02, linePx: 1, col: "#fff0a8", ink: .03, inkPx: 1.2}}};
export const WORLDS = deep(Object.fromEntries(BIOMES.map((b, i) => {
  const t = worldTokens(i + 1), f = SIDE[b.name];
  return [b.name, {name: b.name, level: i + 1, side: t.biome[f], bed: t.bg1, a: .94, frame: t.frame, frameHi: t.boss, px: "tile." + f, corner: CORNER[b.name] || null, ...DRESS[b.name]}];
})));
export const worldOf = (w) => (typeof w === "number" ? WORLDS[worldTokens(w).name] : WORLDS[w]) || null;
export function tierOf(o) {
  if (o.ver === "mono" || o.ver === "ink" || o.cap < 20) return "mono";
  if (o.ver === "menu" || (o.cap >= 32 && o.cap < 40)) return "menu";
  if (o.cap < 32) return "small";
  if (o.cap < 64) return "token";
  return "title";
}
export const MOTIF = deep({edge: .025, edgePx: 2, vine: {w: .036, ink: .015, pass: [.50, .82], col: "#14a018"}, leaf: {l: .16, w: .08, vein: .015, col: "#42f024"},
  snow: {title: [.045, .065], token: [.035, .05], col: "#f4fcff", under: "#b0dcf0"}, icicle: {at: [["E", .40, .16], ["G", .30, .12], ["D", .26, .18]], col: "#d0e8f8", edge: "#ffffff"},
  rivet: {r: .045, ink: .015, glint: .013, y: .075, run: .30, col: "#d0d8e0"}, drip: {title: [["U", .35, .14], ["E", .30, .10], ["R", .13, .18], ["D", .30, .16]], token: [["U", .35, .14], ["D", .30, .16]], col: "#3ad0c8", pin: "#b8fff4"},
  gloss: {w: .05, l: .35, a: .35}, bubble: {r: [.05, .035], w: .015, ink: .015}, stud: {h: .06, ink: .02, y: .075, col: ["#c8b8b0", "#e2d6ce", "#6a6460", "#8a8480"]},
  grain: {q: .014, dens: [.05, .10], split: .6, edge: .03}, drift: {at: ["U", "E", "R"], col: "#e8b040", crest: "#fbf1a0"}, coronet: {w: .15, h: .16, lift: .02, col: "#c49020", tip: "#fff0a8"}});

const M = MOTIF, LET = (L, ch) => L.letters.find((l) => l.ch === ch), bl = (l) => l.y + 1, mn = (c, n, px) => Math.max(c, n / px);
const inked = (o, on, d, col, px) => o.push({on, k: "fill", d, col, ink: mn(2 * M.edge, M.edgePx, px)});
const PAINT = {
  JUNGLE(o, L, tok, px) {
    const F = LET(L, "F"), U = LET(L, "U"), D = LET(L, "D"), cap = tok ? "butt" : "round";
    const leaf = (on, bx, by, deg) => {
      const a = rad(deg), c = Math.cos(a), s = Math.sin(a), T = (x, y) => [bx + x * c - y * s, by + x * s + y * c], l = M.leaf.l, w = M.leaf.w;
      inked(o, on, [["M", ...T(0, 0)], ["Q", ...T(l * .45, -w * .95), ...T(l, 0)], ["Q", ...T(l * .45, w * .95), ...T(0, 0)], ["Z"]], M.leaf.col, px);
      o.push({on, k: "line", d: [["M", ...T(.01, 0)], ["L", ...T(.12, 0)]], w: mn(M.leaf.vein, 1, px), col: M.vine.col, cap});
    };
    if (tok) return leaf("F", F.x + .06, F.y + .05, -150);
    const vine = (on, d) => o.push({on, k: "line", d, w: M.vine.w + 2 * M.vine.ink, col: P.ol, cap: "round"}, {on, k: "line", d, w: M.vine.w, col: M.vine.col, cap: "round"});
    for (const yy of M.vine.pass) vine("F", [["M", F.x - .04, F.y + yy + .035], ["Q", F.x + .12, F.y + yy + .045, F.x + .30, F.y + yy - .03]]);
    vine("F", [["M", F.x + .27, bl(F) + .07], ["C", F.x + .55, bl(F) + .07, U.x + .10, bl(U) + .07, U.x + .40, bl(U) + .07], ["A", U.x + .40, bl(U) + .13, .06, -Math.PI / 2, Math.PI * 1.2, false]]);
    leaf("F", F.x - .005, F.y + .50, 162);
    leaf("F", F.x - .005, F.y + .80, 198);
    leaf("U", U.x + .48, bl(U) + .10, 25);
    vine("D", [["M", D.x + .60, D.y + .10], ["Q", D.x + .80, D.y + .16, D.x + .78, D.y + .40]]);
    leaf("D", D.x + .78, D.y + .40, 105);
  },
  ICE(o, L, tok, px) {
    const caps = tok ? ["F", "G"] : ["F", "U", "E", "G", "R", "I", "D"], [b0, b1] = tok ? M.snow.token : M.snow.title;
    for (const l of L.letters) {
      if (!caps.includes(l.ch)) continue;
      for (const [a, b] of GL[l.ch].top || []) {
        const x0 = l.x + a, x1 = l.x + b, n = Math.max(2, Math.round(((x1 - x0) / .5) * 3)), d = [["M", x0, l.y + .03]], bot = [];
        for (let i = 0; i < n; i++) { const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n; d.push(["Q", (xa + xb) / 2, l.y - .07, xb, l.y - .005]); }
        for (let i = 0; i <= n * 2; i++) bot.push([x1 - ((x1 - x0) * i) / (n * 2), l.y + (i % 2 ? b1 : b0)]);
        d.push(["L", x1, l.y + b0]);
        for (let i = 1; i < bot.length; i += 2) d.push(["Q", bot[i][0], bot[i][1], ...(bot[i + 1] || [x0, l.y + b0])]);
        d.push(["Z"]);
        inked(o, l.ch, d, M.snow.col, px);
        const u = [["M", x1 - .02, l.y + b0 - .015]];
        for (let i = 1; i < bot.length; i++) u.push(["L", bot[i][0], bot[i][1] - .02]);
        o.push({on: l.ch, k: "line", d: u, w: mn(.02, 1, px), col: M.snow.under, cap: "butt"});
      }
    }
    if (tok) return;
    for (const [ch, fx, len] of M.icicle.at) {
      const l = LET(L, ch), cx = l.x + fx, y0 = bl(l) - .01;
      inked(o, ch, [["M", cx - .03, y0], ["L", cx + .03, y0], ["L", cx + .004, y0 + len], ["L", cx - .004, y0 + len], ["Z"]], M.icicle.col, px);
      o.push({on: ch, k: "line", d: [["M", cx - .022, y0 + .01], ["L", cx - .003, y0 + len - .02]], w: mn(.015, 1, px), col: M.icicle.edge, cap: "butt"});
    }
  },
  FACTORY(o, L, tok) {
    const riv = (on, x, y) => o.push({on, k: "disc", x, y, r: M.rivet.r + M.rivet.ink, col: P.ol}, {on, k: "disc", x, y, r: M.rivet.r, col: M.rivet.col}, {on, k: "disc", x: x - .015, y: y - .015, r: M.rivet.glint, col: P.white});
    for (const l of L.letters) {
      const run = GL[l.ch].bot.find(([a, b]) => b - a > M.rivet.run);
      if (!run || (tok && l.ch !== "U" && l.ch !== "D")) continue;
      const y = bl(l) + M.rivet.y;
      if (tok) riv(l.ch, l.x + (run[0] + run[1]) / 2, y);
      else { riv(l.ch, l.x + run[0] + .06, y); riv(l.ch, l.x + run[1] - .06, y); }
    }
  },
  WATER(o, L, tok, px) {
    for (const [ch, fx, len] of tok ? M.drip.token : M.drip.title) {
      const l = LET(L, ch), cx = l.x + fx, y0 = l.y + .99;
      inked(o, ch, [["M", cx - .015, y0], ["L", cx + .015, y0], ["L", cx + .015, y0 + len - .07], ["A", cx, y0 + len - .035, .035, -Math.PI / 2 + .45, Math.PI * 1.5 - .45, false], ["Z"]], M.drip.col, px);
      o.push({on: ch, k: "disc", x: cx - .012, y: y0 + len - .045, r: mn(.01, .7, px), col: M.drip.pin});
    }
    if (tok) return;
    const b = L.bomb, r = BD / 2;
    for (const [dx, dy, rr] of [[-r - .02, -r + .02, M.bubble.r[0]], [-r + .12, -r - .12, M.bubble.r[1]]]) o.push({on: "bomb", k: "ring", x: b.x + dx, y: b.y + dy, r: rr, w: M.bubble.w + 2 * M.bubble.ink, col: P.ol}, {on: "bomb", k: "ring", x: b.x + dx, y: b.y + dy, r: rr, w: mn(M.bubble.w, 1, px), col: M.drip.pin});
    const c = Math.SQRT1_2, w = M.gloss.w / 2, h = M.gloss.l / 2;
    for (const l of L.letters) {
      const cx = l.x + GL[l.ch].w * .30, cy = l.y + .28, R = (x, y) => [cx + (x - y) * c, cy + (x + y) * c];
      o.push({on: l.ch, k: "fill", d: [["M", ...R(-w, -h)], ["L", ...R(w, -h)], ["L", ...R(w, h)], ["L", ...R(-w, h)], ["Z"]], col: P.white, a: M.gloss.a, clip: "face"});
    }
  },
  ARENA(o, L, tok) {
    const h = M.stud.h, g = h + M.stud.ink, [c0, c1, c2, c3] = M.stud.col;
    const stud = (on, x, y) => {
      const N = [x, y - h], E = [x + h, y], S = [x, y + h], W = [x - h, y], tri = (a, b, col) => o.push({on, k: "fill", d: [["M", x, y], ["L", ...a], ["L", ...b], ["Z"]], col});
      o.push({on, k: "fill", d: [["M", x, y - g], ["L", x + g, y], ["L", x, y + g], ["L", x - g, y], ["Z"]], col: P.ol});
      tri(W, N, c0); tri(N, E, c1); tri(E, S, c2); tri(S, W, c3);
    };
    for (const l of L.letters) {
      if (tok && l.ch !== "F" && l.ch !== "D") continue;
      const run = GL[l.ch].bot.reduce((a, r) => (r[1] - r[0] > a[1] - a[0] ? r : a));
      stud(l.ch, l.x + (run[0] + run[1]) / 2, bl(l) + M.stud.y);
    }
  },
  SAND(o, L, tok, px) {
    const G = M.grain, q = mn(G.q, 1, px), df = (G.q / q) ** 2, OFF = [[0, 0], [G.edge, 0], [-G.edge, 0], [0, G.edge], [0, -G.edge]];
    for (const l of L.letters) {
      let seed = l.i * 977 + 13;
      const r = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, col = l.word ? P.corLip : P.yelLip, rings = glyph(l.ch).rings, w = GL[l.ch].w;
      for (let gy = .03; gy < .97; gy += .014) for (let gx = .03; gx < w - .03; gx += .014) {
        const dens = (gy < G.split ? G.dens[0] : G.dens[1]) * df;
        if (r() < dens && rings.some((s) => OFF.every(([dx, dy]) => inShape(s, gx + dx, gy + dy)))) o.push({on: l.ch, k: "rect", x: l.x + gx, y: l.y + gy, w: q, h: q, col});
      }
    }
    if (tok) return;
    for (const ch of M.drift.at) {
      const l = LET(L, ch), xl = l.x + (ch === "U" ? .02 : 0), y = bl(l) + .02;
      inked(o, ch, [["M", xl - .30, y + .04], ["Q", xl - .14, y + .02, xl - .03, y - .085], ["Q", xl + .02, y - .10, xl + .08, y + .04], ["Z"]], M.drift.col, px);
      o.push({on: ch, k: "line", d: [["M", xl - .24, y + .02], ["Q", xl - .12, y + .005, xl - .035, y - .07]], w: mn(.02, 1, px), col: M.drift.crest, cap: "butt"});
    }
  },
  VOID() {},
  CROWN(o, L, tok, px) {
    const I = LET(L, "I"), C = M.coronet, cx = I.x + GL.I.w / 2, b = I.y - C.lift, w = C.w;
    inked(o, "I", [["M", cx - w, b], ["L", cx - w, b - .05], ["L", cx - w + .01, b - C.h], ["L", cx - .07, b - .07], ["L", cx, b - C.h], ["L", cx + .07, b - .07], ["L", cx + w - .01, b - C.h], ["L", cx + w, b - .05], ["L", cx + w, b], ["Z"]], C.col, px);
    o.push({on: "I", k: "rect", x: cx - w + .02, y: b - .045, w: 2 * w - .04, h: mn(.012, 1, px), col: C.tip});
    for (const tx of [cx - w + .01, cx, cx + w - .01]) o.push({on: "I", k: "disc", x: tx, y: b - .17, r: .04, col: P.ol}, {on: "I", k: "disc", x: tx, y: b - .17, r: .02, col: C.tip});
  },
};
const NONE = Object.freeze([]);
export function motif(world, build, tier, px = Infinity) {
  const w = worldOf(world), L = layout(build);
  if (!w || tier === "small" || tier === "mono" || (w.name === "CROWN" && tier === "menu")) return NONE;
  const out = [];
  PAINT[w.name](out, L, tier !== "title", px);
  return deep(out);
}
