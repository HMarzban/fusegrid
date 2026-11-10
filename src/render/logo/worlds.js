/* LOGO B WORLDS: what each of the eight worlds changes on the wordmark (appendix 8.8, built values): the side colour (the extrusion), the plate and one
   motif; faces, cord, bomb and spark never change. Rows read the kit's world tokens, so there is one colour source: bed = bg1, frame = frame (wall),
   frame highlight = boss (wallHi), side = the biome slot the PIXEL side slot names (ICE takes the kit's glacier cyan, lead ruling on appendix 14 item
   13). ICE frost, VOID rings and CROWN gilt are layer-stack dressing, each with its tiers; motif(world, build, tier, px) returns the parts (glyphs.js
   part kinds, layout units, each tagged with the letter it sits on, or "bomb") in draw order; MOTIF.set says which set a tier wears.
   PLATE says what the logo sits on, as the approved mock places it, in CSS px that never scale with the cap: on the title, the kit's plate() with
   worldTokens(level) (its bed box = the logo canvas, layout(build).env x cap, grown by PLATE.title[dev].pad; the kit draws its T-wide ring outside
   that box, so the plate is painted beneath the logo canvas, not inside it); in the MENU, no plate (the logo sits centred in the menu panel's header,
   pad = the header's padding, below = the space from the header's bottom edge to the next item: its bottom margin plus the panel's flex gap); the mono
   and ink builds on a plain rounded ground; PLATE.sheet (the row's bed, frame, frameHi and corner mark, sizes border-box as the kit's CSS sets them) is
   the logo sheet's presentation only, never a default. PLATE.scales says what scales and when: the full placement (the mock's full-window title,
   kept for a later full-window title) never scales; the FITTED title placement (PLATE.title.fitted: the title drawn into a box the caller has, such
   as the board canvas) is the mock's plate scaled as one piece: pad, ring T and bed tile x cap / PLATE.title[dev].cap, the kit plate's own fixed
   overhang past the ring (reach: top, right, bottom, left, in the caller's units) added outside, and the tier is title whatever the cap.
   titleFit(dev, w, h) solves that placement for a w x h box (the caller's units): the largest cap, floored to .01, whose plate outer extent fits.
   plan(world, {cap, ver, dpr, css, build, dev, place, fit}) is the CLASSIC paint list for one size: glyphs.js LAYERS filtered by each layer's tiers,
   world and place, every width resolved to C units (CSS minimums n / (cap x css), device n / (cap x dpr); dpr = device px and css = CSS px per unit
   the cap is given in, css 1 by default). fit {w, h} asks for the fitted title: cap, tier title and the plate's box, T, tile and outer extent come
   from titleFit. place: title (the default at the title tier only), menu (the default at the MENU tier), none (the default at token and small: no
   plate), sheet (only when asked), ground (the mono and ink builds, which take no other); an unknown world or an impossible place throws. It returns
   {tier, place, build, dev, cap, layers}: lay the logo out with that build. plateBox(build, cap, pad) and groundBox(build, cap) are boxes from the
   logo canvas's top-left.
   Its mask words: src = what a layer is built from (solid = faces + bomb body, side, outline, ringInner); grow = dilate by; close = closings in order,
   on a padded canvas; sweep = swept straight down by; band = the bottom band of the side that tall, minus the solid; shift = the face minus itself
   moved by (shade, light); col [FUSE, GRID] per word for face, shade and light.
   px = the cap height in CSS px. Pure: no DOM, clock or randomness (SAND grain is a fixed LCG pattern seeded by the letter's layout index). */
import {BIOMES} from "../../core/config.js";
import {worldTokens} from "../kit/tokens.js";
import {GL, P, BD, STACK, LAYERS, MONO_LAYERS, CORD, SPARK, BOMB, MONO, layout, inGlyph, faces} from "./glyphs.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object" && !Object.isFrozen(v)) deep(v); return Object.freeze(o); };
const rad = (d) => (d * Math.PI) / 180;
const T3 = ["title", "token", "menu"], T4 = [...T3, "small"];
const SIDE = {JUNGLE: "bg0", ICE: "wall", FACTORY: "bg0", WATER: "bg0", ARENA: "bg0", SAND: "bg0", VOID: "brickB", CROWN: "brickB"};
const CORNER = {FACTORY: {kind: "bolt", size: 7, radii: [3.5, 3.5, 3.5, 3.5], rot: 0}, ARENA: {kind: "stud", size: 7, radii: [0, 0, 0, 0], rot: 45}, CROWN: {kind: "filigree", size: 9, radii: [2, 4.5, 2, 4.5], rot: 0}};
const DRESS = {ICE: {frost: {col: "#f4fcff", tiers: ["title"]}},
  VOID: {ring: {close: {w: .16, tiers: T3}, inner: {w: .04, col: "#6a20c8", tiers: T3}, outer: {w: .04, col: "#3a1070", tiers: ["title"]}}},
  CROWN: {gilt: {tiers: T4, line: {w: .02, min: {px: 1, unit: "device"}, col: "#fff0a8"}, ink: {w: .03, min: {px: 1.2, unit: "device"}, col: P.ol}}}};
export const WORLDS = deep(Object.fromEntries(BIOMES.map((b, i) => {
  const t = worldTokens(i + 1), f = SIDE[b.name];
  return [b.name, {name: b.name, level: i + 1, side: t.biome[f], bed: t.bg1, frame: t.frame, frameHi: t.boss, px: "tile." + f, corner: CORNER[b.name] || null, ...DRESS[b.name]}];
})));
export const PLATE = deep({unit: "css", scales: {full: [], fitted: ["pad", "T", "tile"]},
  title: {plate: "kit", d: {build: "line", cap: 88, pad: [26, 54, 28, 54], T: 16, tile: 80}, p: {build: "stack", cap: 76, pad: [16, 12, 18, 12], T: 10, tile: 56},
    fitted: {by: "cap / PLATE.title[dev].cap", reach: [2, 2, 3, 2], tier: "title", unit: "box"}},
  menu: {plate: "none", host: "the MENU panel header", build: "line", cap: 36, ver: "menu", align: "centre",
    d: {pad: [0, 0, 0, 0], below: 28}, d125: {pad: [0, 0, 4, 0], below: 18}, p: {pad: [18, 0, 10, 0], below: 10}, p125: {pad: [10, 0, 6, 0], below: 10}},
  ground: {radius: 6, pad: [8, 10, 8, 10], mono: P.dk, ink: P.cream},
  sheet: {radius: 6, pad: [8, 10, 8, 10], ink: {w: 2, col: P.ol}, frame: {w: 3}, inner: [{w: 2, col: P.ol}, {w: 1, col: "frameHi"}], bed: {a: 1},
    corner: {inset: 4, border: 1, ink: P.ol, fill: "frameHi"}}});
export const plateBox = (build, cap, pad) => { const E = layout(build).env; return deep({x: -pad[3], y: -pad[0], w: E.w * cap + pad[1] + pad[3], h: E.h * cap + pad[0] + pad[2]}); };
export const groundBox = (build, cap) => plateBox(build, cap, PLATE.ground.pad);
export function titleFit(dev, w, h) {
  const t = PLATE.title, d = t[dev === "p" ? "p" : "d"], R = t.fitted.reach, E = layout(d.build).env;
  const ex = (d.pad[1] + d.pad[3] + 2 * d.T) / d.cap, ey = (d.pad[0] + d.pad[2] + 2 * d.T) / d.cap;
  const cap = Math.max(0, Math.floor(Math.min((w - R[1] - R[3]) / (E.w + ex), (h - R[0] - R[2]) / (E.h + ey)) * 100) / 100), k = cap / d.cap;
  const pad = d.pad.map((v) => v * k), T = d.T * k, box = plateBox(d.build, cap, pad);
  return deep({build: d.build, dev: dev === "p" ? "p" : "d", cap, k, pad, T, tile: d.tile * k, box,
    outer: {x: box.x - T - R[3], y: box.y - T - R[0], w: box.w + 2 * T + R[1] + R[3], h: box.h + 2 * T + R[0] + R[2]}});
}
const PLACES = ["title", "menu", "none", "sheet"];
export const worldOf = (w) => (typeof w === "number" ? WORLDS[worldTokens(w).name] : WORLDS[w]) || null;
export function tierOf(o) {
  if (o.ver === "mono" || o.ver === "ink" || o.cap < 20) return "mono";
  if (o.ver === "menu" || (o.cap >= 32 && o.cap < 40)) return "menu";
  if (o.cap < 32) return "small";
  if (o.cap < 64) return "token";
  return "title";
}
export const MOTIF = deep({set: {title: "title", token: "token", menu: "token"}, none: ["VOID"], edge: .025, edgeMin: {px: 2, unit: "css"}, vine: {w: .036, ink: .015, pass: [.50, .82], col: "#14a018"}, leaf: {l: .16, w: .08, vein: .015, col: "#42f024"},
  snow: {title: [.045, .065], token: [.035, .05], col: "#f4fcff", under: "#b0dcf0"}, icicle: {at: [["E", .40, .16], ["G", .30, .12], ["D", .26, .18]], col: "#d0e8f8", edge: "#ffffff"},
  rivet: {r: .045, ink: .015, glint: .013, y: .075, run: .30, col: "#d0d8e0"}, drip: {title: [["U", .35, .14], ["E", .30, .10], ["R", .13, .18], ["D", .30, .16]], token: [["U", .35, .14], ["D", .30, .16]], col: "#3ad0c8", pin: "#b8fff4"},
  gloss: {w: .05, l: .35, a: .35}, bubble: {r: [.05, .035], w: .015, ink: .015}, stud: {h: .06, ink: .02, y: .075, col: ["#c8b8b0", "#e2d6ce", "#6a6460", "#8a8480"]},
  grain: {q: .014, dens: [.05, .10], split: .6, edge: .03}, drift: {at: ["U", "E", "R"], col: "#e8b040", crest: "#fbf1a0"}, coronet: {tiers: ["title", "token"], w: .15, h: .16, lift: .02, col: "#c49020", tip: "#fff0a8"}});

const M = MOTIF, LET = (L, ch) => L.letters.find((l) => l.ch === ch), bl = (l) => l.y + 1, mn = (c, n, px) => Math.max(c, n / px);
const inked = (o, on, d, col, px) => o.push({on, k: "fill", d, col, ink: mn(2 * M.edge, M.edgeMin.px, px)});
const PAINT = {
  JUNGLE(o, L, tok, px) {
    const F = LET(L, "F"), U = LET(L, "U"), D = LET(L, "D"), cap = tok ? "butt" : "round";
    const leaf = (on, bx, by, deg) => {
      const a = rad(deg), c = Math.cos(a), s = Math.sin(a), T = (x, y) => [bx + x * c - y * s, by + x * s + y * c], l = M.leaf.l, w = M.leaf.w;
      inked(o, on, [["M", ...T(0, 0)], ["Q", ...T(l * .45, -w * .95), ...T(l, 0)], ["Q", ...T(l * .45, w * .95), ...T(0, 0)], ["Z"]], M.leaf.col, px);
      o.push({on, k: "line", d: [["M", ...T(.01, 0)], ["L", ...T(.12, 0)]], w: mn(M.leaf.vein, 1, px), col: M.vine.col, cap});
    };
    if (tok) return leaf("F", F.x + .06, F.y + .05, -150);
    const vine = (on, d, mj) => o.push({on, k: "line", d, w: M.vine.w + 2 * M.vine.ink, col: P.ol, cap: "round", ...(mj && {join: "miter"})}, {on, k: "line", d, w: M.vine.w, col: M.vine.col, cap: "round", ...(mj && {join: "miter"})});
    for (const yy of M.vine.pass) vine("F", [["M", F.x - .04, F.y + yy + .035], ["Q", F.x + .12, F.y + yy + .045, F.x + .30, F.y + yy - .03]], true);
    vine("F", [["M", F.x + .27, bl(F) + .07], ["C", F.x + .55, bl(F) + .07, U.x + .10, bl(U) + .07, U.x + .40, bl(U) + .07], ["A", U.x + .40, bl(U) + .13, .06, -Math.PI / 2, Math.PI * 1.2, false]], true);
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
      const r = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, col = l.word ? P.corLip : P.yelLip, ns = GL[l.ch].sh.length, w = GL[l.ch].w;
      for (let gy = .03; gy < .97; gy += .014) for (let gx = .03; gx < w - .03; gx += .014) {
        const dens = (gy < G.split ? G.dens[0] : G.dens[1]) * df;
        let hit = false;
        if (r() < dens) for (let k = 0; k < ns && !hit; k++) hit = OFF.every(([dx, dy]) => inGlyph(l.ch, gx + dx, gy + dy, k));
        if (hit) o.push({on: l.ch, k: "rect", x: l.x + gx, y: l.y + gy, w: q, h: q, col});
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
const hasMotif = (w, tier) => !!M.set[tier] && !M.none.includes(w.name) && (w.name !== "CROWN" || M.coronet.tiers.includes(tier));
export function motif(world, build, tier, px = Infinity) {
  const w = worldOf(world), L = layout(build);
  if (!w || !hasMotif(w, tier)) return NONE;
  const out = [];
  PAINT[w.name](out, L, M.set[tier] === "token", px);
  return deep(out);
}
export function plan(world, o) {
  const w = worldOf(world);
  if (!w) throw new Error("logo plan: unknown world " + world);
  const dev = o.dev === "p" ? "p" : "d", fitted = o.fit ? titleFit(dev, o.fit.w, o.fit.h) : null;
  const cap = fitted ? fitted.cap : o.cap, dpr = o.dpr || 1, css = o.css > 0 ? o.css : 1, tier = fitted ? PLATE.title.fitted.tier : tierOf(o), F = faces(tier, fitted ? undefined : o.ver), on = (r) => !!r && r.tiers.includes(tier);
  const mn = (v, m) => (m && (!m.tiers || m.tiers.includes(tier)) ? Math.max(v, m.px / (m.unit === "device" ? cap * dpr : cap * css)) : v);
  const place = fitted ? "title" : o.place || (tier === "mono" ? "ground" : tier === "title" ? "title" : tier === "menu" ? "menu" : "none");
  if (tier === "mono" ? place !== "ground" : !PLACES.includes(place)) throw new Error("logo plan: place " + place + (tier === "mono" ? " (the mono and ink builds sit on a ground)" : place === "ground" ? " is for the mono and ink builds only" : " is not one of " + PLACES.join(", ")));
  const build = fitted ? fitted.build : o.build || (place === "title" ? PLATE.title[dev].build : place === "menu" ? PLATE.menu.build : "line");
  if (tier === "mono") {
    const col = F.f[0], g = PLATE.ground;
    return deep({tier, place, build, dev, cap, layers: MONO_LAYERS.map((id) => (id === "ground" ? {id, col: o.ver === "ink" ? g.ink : g.mono, radius: g.radius, pad: g.pad, box: groundBox(build, cap), unit: PLATE.unit}
      : id === "monoFace" ? {id, col} : id === "monoBomb" ? {id, x: 0, y: BOMB.oy, rx: BOMB.rx, ry: BOMB.ry, unit: "D", col}
      : id === "monoCord" ? {id, w: mn(MONO.w, MONO.min), col, join: "miter"} : {id, off: MONO.ring.off, r: MONO.ring.r, w: mn(MONO.ring.w, MONO.ring.min), col}))});
  }
  const sh0 = PLATE.sheet, ti = PLATE.title[dev];
  const plate = fitted ? {kind: "kit", level: w.level, phone: dev === "p", T: fitted.T, tile: fitted.tile, box: fitted.box, outer: fitted.outer, unit: PLATE.title.fitted.unit}
    : place === "title" ? {kind: "kit", level: w.level, phone: dev === "p", T: ti.T, tile: ti.tile, box: plateBox(build, cap, ti.pad), unit: PLATE.unit}
    : place === "sheet" ? {kind: "sheet", radius: sh0.radius, pad: sh0.pad, box: plateBox(build, cap, sh0.pad), ink: sh0.ink, frame: {w: sh0.frame.w, col: w.frame}, inner: [sh0.inner[0], {w: sh0.inner[1].w, col: w.frameHi}],
      bed: {col: w.bed, a: sh0.bed.a}, corner: w.corner && {...w.corner, inset: sh0.corner.inset, border: sh0.corner.border, ink: sh0.corner.ink, fill: w.frameHi}, unit: PLATE.unit} : null;
  const S = STACK, R = w.ring, G = w.gilt, sh = S.shade.shift, ICE = on(w.frost) ? w.frost.col : null;
  const L = {
    plate: () => plate,
    ringOuter: () => R && on(R.outer) && {src: "ringInner", grow: R.outer.w, col: R.outer.col},
    ringInner: () => R && on(R.inner) && {src: "outline", grow: R.inner.w, col: R.inner.col},
    outline: () => ({src: S.outline.src, grow: mn(S.outline.grow, S.outline.min), close: R && on(R.close) ? [S.outline.close, R.close.w] : [S.outline.close], padded: S.outline.padded, clean: S.outline.clean.below, col: S.outline.col}),
    side: () => ({src: S.side.src, sweep: mn(S.side.sweep, S.side.min), col: w.side}),
    gilt: () => on(G) && {src: "side", band: mn(G.line.w, G.line.min), minus: "solid", col: G.line.col},
    giltInk: () => on(G) && {src: "solid", grow: mn(G.ink.w, G.ink.min), col: G.ink.col},
    face: () => on(S.face) && {col: [F.f[0], F.g[0]]},
    shade: () => on(S.shade) && {shift: [-mn(-sh[0], S.shade.min), -mn(-sh[1], S.shade.min)], col: [F.f[1], F.g[1]], clip: S.shade.clip},
    light: () => on(S.light) && {shift: S.light.shift, col: [ICE || F.f[2], ICE || F.g[2]], clip: S.light.clip},
    motif: () => hasMotif(w, tier) && {set: M.set[tier]},
    bomb: () => ({dpx: BD * cap * css, unit: "css"}),
    cordInk: () => on(CORD) && {w: Math.max(CORD.ink.w, CORD.ink.min.px[tier] / (cap * css)), col: CORD.ink.col},
    rope: () => on(CORD) && {over: CORD.over.filter((k) => on(CORD[k])), clip: "rope"},
    spark: () => on(SPARK) && {off: SPARK.off[tier], embers: SPARK.embers.includes(tier), grow: on(SPARK.grow)},
  };
  return deep({tier, place, build, dev, cap, layers: LAYERS.map((id) => { const v = L[id](); return v && {id, ...v}; }).filter(Boolean)});
}
