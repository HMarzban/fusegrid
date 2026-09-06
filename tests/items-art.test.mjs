import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { CFG, BIOMES } from "../src/core/config.js";
import { POWER } from "../src/core/entities.js";
import { drawIcon, RIM, ITEM_FAMILY, ITEM_SHAPE, ITEM_ACCENT, dk } from "../src/render/icons.js";
import {
  drawItemBody,
  drawItemChrome,
  drawPlayerBody,
  PLAYER_HULL,
  PLAYER_SUIT,
} from "../src/render/sprites.js";

/* Rec.709 relative luminance of a #rrggbb literal, 0..1. */
const lum = (h) => {
  const n = parseInt(String(h).slice(1), 16) || 0;
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};
/* Same, but tolerant of the "rgb(r,g,b)" strings tone()/dk()/lt() return —
   the outline gate has to weigh a SHADE against its own base hex. */
const lumOf = (v) => {
  const s = String(v);
  if (s[0] === "#") return lum(s);
  const m = s.match(/(\d+)\D+(\d+)\D+(\d+)/);
  return m ? (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255 : NaN;
};
const rgbOf = (h) => {
  const n = parseInt(String(h).slice(1), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/* HSL hue in degrees. */
const hueOf = (h) => {
  const [r, g, b] = rgbOf(h).map((v) => v / 255);
  const mx = Math.max(r, g, b),
    d = mx - Math.min(r, g, b);
  if (!d) return 0;
  const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (x * 60 + 360) % 360;
};
/* Chroma as normalised channel spread. Preferred over HSL saturation because
   it has no pathology near L=0.5 and is what actually decides whether the
   hue axis means anything: two NEAR-NEUTRAL colours at the same value are
   the same colour however far apart their nominal hue angles sit. */
const chromaOf = (h) => {
  const c = rgbOf(h);
  return (Math.max(...c) - Math.min(...c)) / 255;
};
const dHue = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
/* CIE Lab + dE76. The AND gate below is the SHIPPED gate; dE is the second
   opinion the MAKO round needs, because VOID is the one room where the hero
   and the scenery are the same hue by construction and a hue axis therefore
   says nothing. */
const labOf = (hex) => {
  let [r, g, b] = rgbOf(hex).map((v) => v / 255);
  const f = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  r = f(r);
  g = f(g);
  b = f(b);
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047,
    Y = r * 0.2126 + g * 0.7152 + b * 0.0722,
    Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const k = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * k(Y) - 16, 500 * (k(X) - k(Y)), 200 * (k(Y) - k(Z))];
};
const dE = (a, b) => {
  const A = labOf(a),
    B = labOf(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
};
/* bakeAtlas paints brickHi at globalAlpha 0.55 OVER brickA, so the swatch a
   player actually stands beside is the COMPOSITE, not the raw hex. On VOID
   that composite is #a266e6 — which is exactly "#9a4ff0 lifted in value",
   i.e. the naive reading of the MAKO value tweak walks straight into the
   brick. Nothing in the shipped 5-swatch list could see that, so the sixth
   swatch is computed here. */
const overA = (hi, lo, a) =>
  "#" +
  rgbOf(hi)
    .map((v, i) => Math.round(a * v + (1 - a) * rgbOf(lo)[i]).toString(16).padStart(2, "0"))
    .join("");
/* SEVEN per biome, not the shipped five. `wallHi` is painted OPAQUE over the
   top 40% of every wall tile (bakeAtlas), so it is a backdrop the hero stands
   beside as surely as `wall` is; leaving it out is how #9a4ff0 looked clean
   on paper. Raw `brickHi` is deliberately NOT listed — it is never painted at
   full opacity, only ever as the composite above. */
const biomeSwatches = (B) =>
  ["floor0", "floor1", "wall", "wallHi", "brickA", "brickB"]
    .map((k) => [B.name + "." + k, B[k]])
    .concat([[B.name + ".brickHi@.55", overA(B.brickHi, B.brickA, 0.55)]]);
const ALL_SWATCHES = BIOMES.flatMap(biomeSwatches);

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""),
  );
}

const IDS = POWER.map((p) => p.t);
const S = CFG.TILE * 0.3;

/* Recording context. Unlike pickups.test.mjs's op-name stub this one keeps
   the ARGUMENTS and the assigned VALUES: several gates below read colors and
   coordinates, not just which call happened. */
function stub() {
  const ops = [];
  const rec =
    (n) =>
    (...a) => {
      ops.push([n, ...a.map((v) => (typeof v === "number" ? +v.toFixed(3) : v))]);
    };
  const c = { _ops: ops };
  for (const n of [
    "save", "restore", "translate", "scale", "rotate", "beginPath", "closePath",
    "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "arc", "arcTo",
    "ellipse", "fill", "stroke", "fillRect", "rect", "fillText", "clearRect",
  ])
    c[n] = rec(n);
  return new Proxy(c, {
    set(t, p, v) {
      if (typeof p !== "symbol") t._ops.push(["set", String(p), String(v)]);
      t[p] = v;
      return true;
    },
  });
}
/* Axis-aligned extent recorder, same shape as enemies-art.test.mjs's. */
function box(opt) {
  const b = { x0: 0, x1: 0, y0: 0, y1: 0 };
  const at = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    b.x0 = Math.min(b.x0, x);
    b.x1 = Math.max(b.x1, x);
    b.y0 = Math.min(b.y0, y);
    b.y1 = Math.max(b.y1, y);
  };
  const noE = !!(opt && opt.noEllipse);
  const c = {
    _b: b,
    save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
    beginPath() {}, closePath() {}, fill() {}, stroke() {},
    moveTo: at,
    lineTo: at,
    quadraticCurveTo(cx, cy, x, y) { at(cx, cy); at(x, y); },
    bezierCurveTo(ax, ay, bx, by, x, y) { at(ax, ay); at(bx, by); at(x, y); },
    arc(x, y, r) { at(x - r, y - r); at(x + r, y + r); },
    arcTo(x1, y1, x2, y2) { at(x1, y1); at(x2, y2); },
    ellipse(x, y, rx, ry) { if (noE) return; at(x - rx, y - ry); at(x + rx, y + ry); },
    fillRect(x, y, w, h) { at(x, y); at(x + w, y + h); },
    rect(x, y, w, h) { at(x, y); at(x + w, y + h); },
  };
  return new Proxy(c, { set(t, p, v) { t[p] = v; return true; } });
}
const names = (ops) => ops.map((o) => o[0]);
/* Split a recorded stream into PATH BLOCKS — every beginPath..fill, with the
   vertices (quadratic control points and ellipse extents included), the
   fillStyle in force, and whether a RIM seal followed. MAKO draws feet and
   fins BEFORE the body so its contour is no longer "the second beginPath";
   the humanoid-era gates read that fixed index and would have silently
   measured a foot. Blocks are found by what they are, not by where they sit. */
function blocks(ops) {
  const out = [];
  let cur = null,
    fs = null;
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (o[0] === "set" && o[1] === "fillStyle") fs = o[2];
    else if (o[0] === "beginPath") cur = { pts: [], fill: null, el: null };
    else if (!cur) continue;
    else if (o[0] === "moveTo" || o[0] === "lineTo") cur.pts.push([o[1], o[2]]);
    else if (o[0] === "quadraticCurveTo") cur.pts.push([o[1], o[2]], [o[3], o[4]]);
    else if (o[0] === "ellipse") {
      cur.el = { x: o[1], y: o[2], rx: o[3], ry: o[4] };
      cur.pts.push([o[1] - o[3], o[2] - o[4]], [o[1] + o[3], o[2] + o[4]]);
    } else if (o[0] === "fill") {
      cur.fill = fs;
      cur.at = i;
      cur.sealed = ops
        .slice(i + 1, i + 5)
        .some((q) => q[0] === "set" && q[1] === "strokeStyle" && q[2] === RIM);
      out.push(cur);
      cur = null;
    }
  }
  return out;
}
const spanX = (b) => Math.max(...b.pts.map((p) => Math.abs(p[0])));
const setsOf = (ops, prop) =>
  ops.filter((o) => o[0] === "set" && o[1] === prop).map((o) => o[2]);
const paints = (ops) =>
  names(ops).filter((n) => n === "fill" || n === "stroke" || n === "fillRect").length;
const maxAbs = (b) => Math.max(-b.x0, b.x1, -b.y0, b.y1);

{
  const fams = IDS.map((t) => ITEM_FAMILY[t]);
  check(
    "ITEM_FAMILY covers all 12 POWER kinds",
    fams.every(Boolean) && Object.keys(ITEM_FAMILY).length === 12,
    fams.join(","),
  );
  check(
    "ITEM_FAMILY has exactly 4 distinct families",
    new Set(fams).size === 4,
    [...new Set(fams)].join(","),
  );
  const cap = IDS.filter((t) => ITEM_FAMILY[t] === "cap").join(",");
  const perm = POWER.filter((p) => p.permanent === true).map((p) => p.t).join(",");
  check('ITEM_FAMILY "cap" is exactly the permanent set', cap === perm, cap + " vs " + perm);
}

{
  const eb = await import("../src/render/enemybody.js");
  const ic = await import("../src/render/icons.js");
  check(
    "five-beat helpers live in icons.js",
    typeof ic.tone === "function" &&
      typeof ic.dk === "function" &&
      typeof ic.lt === "function" &&
      typeof ic.seal === "function" &&
      typeof ic.poly === "function" &&
      typeof ic.oval === "function",
  );
  check(
    "enemybody.js re-declares none of them",
    !/^(const|function)\s+(tone|dk|lt|seal|poly|oval)\b/m.test(
      (await import("node:fs")).readFileSync("src/render/enemybody.js", "utf8"),
    ),
  );
  check("enemybody still exports drawEnemyBody", typeof eb.drawEnemyBody === "function");
}

{
  const sig = {};
  for (const t of IDS) {
    const c = stub();
    drawIcon(c, t, "#ffffff", 0);
    const ops = c._ops;
    sig[t] = JSON.stringify(ops);
    const fills = setsOf(ops, "fillStyle");
    check(
      "five-beat value stack: " + t + " writes >=4 distinct fillStyle",
      new Set(fills).size >= 4,
      [...new Set(fills)].join(" "),
    );
    check(
      "five-beat paints: " + t + " >= 3",
      paints(ops) >= 3,
      String(paints(ops)),
    );
    const iRim = ops.findIndex((o) => o[0] === "set" && o[1] === "strokeStyle" && o[2] === RIM);
    const iStroke = ops.findIndex((o) => o[0] === "stroke");
    check(
      "glyph seals with RIM: " + t,
      iRim >= 0 && iStroke > iRim,
      iRim + "/" + iStroke,
    );
    check(
      "dark form precedes the lit body: " + t,
      fills.length > 0 && fills[0] !== "#ffffff",
      String(fills[0]),
    );
    check("no fillText in " + t, !names(ops).includes("fillText"));
  }
  let distinct = true;
  for (let i = 0; i < IDS.length; i++)
    for (let j = i + 1; j < IDS.length; j++)
      if (sig[IDS[i]] === sig[IDS[j]]) distinct = false;
  check("all 12 drawIcon op streams are pairwise distinct", distinct);
}

{
  const over = [];
  for (const t of IDS) {
    const c = box();
    drawIcon(c, t, "#ffffff", 0);
    if (!(maxAbs(c._b) <= 1.2 * S + 1e-6)) over.push(t + ":" + maxAbs(c._b).toFixed(2));
  }
  check("every glyph fits +-1.20*s", !over.length, over.join(" ") || "<=" + (1.2 * S));
}

{
  const bigOutline = IDS.filter((t) => !ITEM_SHAPE[t] || ITEM_SHAPE[t].length > 14);
  check("outline budget <= 14 vertices", !bigOutline.length, bigOutline.join(" ") || "ok");
  const bigAccent = [],
    hairline = [],
    noFill = [];
  for (const t of IDS) {
    const c = stub();
    ITEM_ACCENT[t](c, S, "#ffffff");
    const ops = c._ops;
    if (paints(ops) > 4) bigAccent.push(t + ":" + paints(ops));
    if (!setsOf(ops, "fillStyle").length) noFill.push(t);
    const lw = setsOf(ops, "lineWidth").map(Number);
    if (names(ops).includes("stroke") && !lw.every((w) => w >= S * 0.12)) hairline.push(t);
  }
  check("accent budget <= 4 paint ops", !bigAccent.length, bigAccent.join(" ") || "ok");
  check("every accent writes a fillStyle (solid shape)", !noFill.length, noFill.join(" ") || "ok");
  check("no accent is a hairline stroke", !hairline.length, hairline.join(" ") || "ok");
  /* drawIcon's beat 1 repaints the outline offset by (+0.07s, +0.09s), so
     the headroom is one-sided: a positive vertex may reach 1.13 / 1.11, a
     negative one the full -1.20. */
  const spill = [];
  for (const t of IDS) {
    const xs = ITEM_SHAPE[t].map((p) => p[0]),
      ys = ITEM_SHAPE[t].map((p) => p[1]);
    if (
      Math.max(...xs) > 1.13 + 1e-9 ||
      Math.max(...ys) > 1.11 + 1e-9 ||
      Math.min(...xs) < -1.2 - 1e-9 ||
      Math.min(...ys) < -1.2 - 1e-9
    )
      spill.push(t);
  }
  check("outline leaves room for the form-shadow offset", !spill.length, spill.join(" ") || "ok");
}

/* Per-kind outline pins. Distinctness alone would let a future pass re-skin
   every glyph back into abstract silhouettes without a single red line — the
   failure that cost this program a whole revision. Vertex count plus the
   rounded outline bbox is coarse enough to survive nudges and specific
   enough that swapping the object trips it. */
{
  const PIN = {
    fire: [8, 1.32, 2.1],
    bomb: [8, 1.48, 1.7],
    speed: [6, 1.28, 2.04],
    heart: [8, 2.0, 1.76],
    shield: [8, 1.68, 1.92],
    kick: [8, 1.72, 1.76],
    throw: [8, 1.04, 1.44],
    pass: [8, 2.2, 1.4],
    remote: [8, 1.72, 2.0],
    line: [9, 2.2, 1.0],
    power: [14, 2.24, 2.16],
    pierce: [8, 1.24, 2.12],
  };
  const wrong = [];
  const dims = {};
  for (const t of IDS) {
    const p = ITEM_SHAPE[t];
    const xs = p.map((v) => v[0]),
      ys = p.map((v) => v[1]);
    const w = +(Math.max(...xs) - Math.min(...xs)).toFixed(2),
      h = +(Math.max(...ys) - Math.min(...ys)).toFixed(2);
    dims[t] = [p.length, w, h];
    const e = PIN[t];
    if (!e || e[0] !== p.length || Math.abs(e[1] - w) > 0.02 || Math.abs(e[2] - h) > 0.02)
      wrong.push(t + ":" + dims[t].join("/"));
  }
  check("every outline matches its per-kind pin", !wrong.length, wrong.join(" ") || "ok");
  /* The three pairs the op-stream gates structurally cannot catch, because
     two different objects always differ in coordinates. They are held apart
     by MASS, so mass is what gets asserted. */
  const ar = (t) => dims[t][1] / dims[t][2];
  const area = (t) => dims[t][1] * dims[t][2];
  const apart = (a, b, k) =>
    check(
      "closest pair " + a + "/" + b + " separates on outline aspect",
      Math.abs(ar(a) - ar(b)) >= k,
      ar(a).toFixed(2) + " vs " + ar(b).toFixed(2) + " (need " + k + ")",
    );
  apart("pass", "pierce", 0.9);
  apart("line", "pierce", 1.4);
  /* bomb/throw are both "orb plus curve" at nearly the same aspect, so the
     one that matters is bulk: BOMB is a big centred orb, THROW a small orb
     that gave its room to the arc. */
  check(
    "closest pair bomb/throw separates on outline bulk",
    area("bomb") / area("throw") >= 1.4,
    (area("bomb") / area("throw")).toFixed(2) + "x (need 1.4)",
  );
}

{
  const w = createWorld(42, 1);
  loadLevel(w, 1, false);
  w.state = "PLAY";
  const start = w.enemies
    .map((e) => e.type + "," + e.x.toFixed(2) + "," + e.y.toFixed(2))
    .join("|");
  check(
    "art-only: seed-42 L1 roster unchanged",
    start === "walker,180.00,220.00|walker,300.00,100.00|stationary,300.00,140.00",
    start,
  );
  const intent = { move: { x: 0, y: 0 }, fire: false, firePrev: false, shift: false, remote: false, kick: false };
  for (let i = 0; i < 180; i++) step(w, CFG.STEP, { 0: intent });
  const end = w.enemies
    .map((e) => e.type + "," + (e.dead ? 1 : 0) + "," + e.x.toFixed(2) + "," + e.y.toFixed(2))
    .join("|");
  check(
    "art-only: 180 PLAY steps unchanged",
    end === "walker,0,182.16,220.00|walker,0,300.00,100.00|stationary,0,300.00,140.00",
    end,
  );
  const cat = POWER.map((p) => p.t + ":" + p.col + ":" + (p.permanent ? 1 : 0)).join("|");
  check(
    "art-only: POWER catalog fingerprint unchanged",
    cat ===
      "fire:#ff8a3c:1|bomb:#ff5d73:1|speed:#3db4ff:1|heart:#ff3b5c:0|shield:#6fb7ff:0" +
        "|kick:#c07a3a:0|throw:#ffb347:0|pass:#77ff99:0|line:#d0e4ff:0|power:#ff4d5e:0" +
        "|pierce:#8f8fff:0|remote:#e8c35a:0",
    cat,
  );
}

{
  const chrome = {};
  for (const fam of ["cap", "vit", "utl", "bls"]) {
    const c = stub();
    drawItemChrome(c, fam, 0, 0);
    chrome[fam] = JSON.stringify(c._ops);
  }
  const vals = Object.values(chrome);
  check("four distinct family chrome signatures", new Set(vals).size === 4);
  const byKind = {};
  for (const t of IDS) {
    const c = stub();
    drawItemChrome(c, ITEM_FAMILY[t], 0, 0);
    byKind[t] = JSON.stringify(c._ops);
  }
  const wrong = IDS.filter((t) => byKind[t] !== chrome[ITEM_FAMILY[t]]);
  check("kinds inside one family share a chrome signature", !wrong.length, wrong.join(" "));
  const noDisc = [];
  for (const t of IDS) {
    const c = stub();
    drawItemBody(c, { time: 0 }, { t, col: "#ffffff", x: 0, y: 0 });
    const disc = c._ops.some(
      (o) => o[0] === "arc" && Math.abs(o[3] - CFG.TILE * 0.34) < 1e-6,
    );
    if (!disc) noDisc.push(t);
  }
  check("base disc present for all 12", !noDisc.length, noDisc.join(" ") || "ok");
  const dashed = [];
  for (const fam of ["cap", "vit", "utl", "bls"]) {
    const c = stub();
    drawItemChrome(c, fam, 0, 0);
    if (names(c._ops).includes("setLineDash")) dashed.push(fam);
  }
  check("no setLineDash anywhere in the chrome", !dashed.length, dashed.join(" ") || "ok");
}

{
  const still = [],
    slotty = [],
    unstable = [];
  for (const t of IDS) {
    const a = stub(),
      b = stub();
    drawItemBody(a, { time: 0 }, { t, col: "#ffffff", x: 80, y: 120 });
    drawItemBody(b, { time: 0.5 }, { t, col: "#ffffff", x: 80, y: 120 });
    if (JSON.stringify(a._ops) === JSON.stringify(b._ops)) still.push(t);
    const c1 = stub(),
      c2 = stub();
    drawItemBody(c1, { time: 0.3 }, { t, col: "#ffffff", x: 80, y: 120 });
    drawItemBody(c2, { time: 0.3 }, { t, col: "#ffffff", x: 80, y: 120 });
    if (JSON.stringify(c1._ops) !== JSON.stringify(c2._ops)) unstable.push(t);
    const d1 = stub(),
      d2 = stub();
    drawItemBody(d1, { time: 0.3 }, { t, col: "#ffffff", x: 80, y: 120 });
    drawItemBody(d2, { time: 0.3 }, { t, col: "#ffffff", x: 200, y: 40 });
    if (JSON.stringify(d1._ops) === JSON.stringify(d2._ops)) slotty.push(t);
  }
  check("idle echo is live (t 0 vs 0.5 differ)", !still.length, still.join(" ") || "ok");
  check("same kind at same (x,y) is identical", !unstable.length, unstable.join(" ") || "ok");
  check("phase comes from grid position, not slot", !slotty.length, slotty.join(" ") || "ok");
}

const R = CFG.TILE * 0.36;
/* MAKO's fixed fields. TEAL is p.color's default and the one placement (the
   ear-fins); CREAM is the eye field that carries the face at 29px; BOOT is
   the ground contact, and p.kick still flips it. */
const TEAL = "#37f0d0",
  CREAM = "#f2e6d2",
  BOOT = "#2e1a4e",
  INK = "#12121e";
const P = (o) =>
  Object.assign(
    {
      x: 0, y: 0, color: "#37f0d0", face: { x: 0, y: 1 },
      iFrames: 0, walk: 0, shield: false, kick: false, passing: false,
    },
    o || {},
  );

{
  const c = stub();
  drawPlayerBody(c, { time: 0 }, P());
  const ops = c._ops;
  const arcs = names(ops).filter((n) => n === "arc").length;
  check("zero-arc rule: shield and passing false emit no arc", arcs === 0, String(arcs));
  check(
    "antenna ball gone: no #ff5d73 fill or stroke",
    !setsOf(ops, "fillStyle").includes("#ff5d73") &&
      !setsOf(ops, "strokeStyle").includes("#ff5d73"),
  );
  check("no fillText in drawPlayerBody", !names(ops).includes("fillText"));
  check("beat 1 is a contact ellipse", names(ops).includes("ellipse"));
  const iRim = ops.findIndex((o) => o[0] === "set" && o[1] === "strokeStyle" && o[2] === RIM);
  check(
    "player seals its contour with RIM",
    iRim >= 0 && ops.findIndex((o) => o[0] === "stroke") > iRim,
    String(iRim),
  );
}

{
  const b1 = box();
  drawPlayerBody(b1, { time: 0 }, P());
  const hx = Math.max(-b1._b.x0, b1._b.x1),
    vy = Math.max(-b1._b.y0, b1._b.y1);
  /* MOVED PIN (MAKO 2026-09-06): +-1.05r -> +-1.34r. The hook of this
     character is a pair of ear-fins whose tips run PAST the body's own
     half-width — that is what makes the plan outline a chevron instead of
     one more rounded mass, so the old box would have vetoed the concept
     itself. The real constraint the old number stood for is that the hero
     must not bleed into the neighbouring tile, so THAT is now asserted
     directly: 1.34r = 19.3px against the 20px tile half-width. */
  check("player fits +-1.34r horizontally (fin tips)", hx <= R * 1.34 + 1e-6, hx.toFixed(2));
  check(
    "player stays inside its own 40px tile (half-width 20px)",
    hx <= CFG.TILE / 2 + 1e-6,
    hx.toFixed(2) + " vs " + CFG.TILE / 2,
  );
  check("player fits +-1.20r vertically", vy <= R * 1.2 + 1e-6, vy.toFixed(2));
  const b2 = box({ noEllipse: true });
  drawPlayerBody(b2, { time: 0 }, P());
  const vy2 = Math.max(-b2._b.y0, b2._b.y1);
  check(
    "only the contact shade passes +-1.10r vertically",
    vy2 <= R * 1.1 + 1e-6,
    vy2.toFixed(2),
  );
}

/* ==================================================================== MAKO
   2026-09-06, on the user's veto of every humanoid hero ("the main character
   also must not be like a human, it must be a creative character like [the
   genre classic]") and the art-direction round that answered it. MAKO is a
   reef critter: ONE low wide mass, two swept teal ear-fins whose tips run
   past the body's own half-width, two bulging cream eyes that break the
   crown of the silhouette, and a grin.

   FOUR humanoid-era gates are DELETED here rather than weakened, because
   they encode the anatomy the user rejected and no MAKO can ever pass them:
     - "R1 taper: hull sheds >= 1.55x its width 0.50r below the shoulder"
       — MAKO has no shoulder line; its widest slice is a pair of fins.
     - "R1 stance: legs run >= 0.50r below the hull contour"
       — MAKO has feet, not legs. 0.44r of dark, deliberately.
     - "IONVEST seam gate reads a real neck pinch" + "head module is 38-50%"
       — head and body are ONE mass. There is no neck to measure, and that
       is the whole point of the concept.
     - "R1 beat 2 is the hull contour" — index-addressed, and MAKO draws its
       feet and fins BEFORE the body, so the contour is no longer the second
       beginPath. blocks() finds every part by its FILL instead.
   What those four stood for — a silhouette that is not one more rounded
   mass, and a figure that still reads at 29px — is re-asserted below in
   MAKO's own terms. */
{
  const c = stub();
  drawPlayerBody(c, { time: 0 }, P());
  const bl = blocks(c._ops);
  const CONTOUR = dk(PLAYER_SUIT, 0.56),
    LID = dk(PLAYER_SUIT, 0.46);
  const byFill = (v) => bl.filter((b) => b.fill === v);
  const fins = byFill(TEAL),
    contour = byFill(CONTOUR),
    lit = byFill(PLAYER_SUIT),
    feet = byFill(BOOT),
    lids = byFill(LID),
    eyes = byFill(CREAM);
  /* Fail LOUDLY before any measurement: every gate below reads one of these
     blocks, and a silently-missing block would otherwise read as a passing
     measurement of the wrong shape. */
  check(
    "MAKO parts are addressable by fill (contour / lit body / fins / feet)",
    contour.length === 1 && lit.length === 1 && fins.length === 1 && feet.length === 1,
    "contour " + contour.length + " lit " + lit.length + " fins " + fins.length +
      " feet " + feet.length,
  );
  /* THE concept gate. The designer's whole case for MAKO over the two
     alternatives was the plan-view footprint at the frozen 59.1 deg rig, and
     the 2D silhouette is where that lives in this renderer: a chevron that
     spreads sideways, never a standing mass.
     Measured on the noEllipse box ON PURPOSE. The contact shade is scenery,
     not the character: it reaches r*1.14 below the origin, which drags the
     full box to 1.92r tall and the aspect to 1.37 — it would veto a body
     that is in fact 1.53 wide. noEllipse also drops the eyes, which costs
     nothing here because the body's own crown control point sits above
     them. Do not "fix" this back to box(). */
  const bw = box({ noEllipse: true });
  drawPlayerBody(bw, { time: 0 }, P());
  const W = bw._b.x1 - bw._b.x0,
    H = bw._b.y1 - bw._b.y0;
  check(
    "MAKO silhouette: low and wide, aspect >= 1.40 (a chevron, not a stander)",
    H > 0 && W / H >= 1.4,
    (W / H).toFixed(2) + " (" + (W / R).toFixed(2) + "r x " + (H / R).toFixed(2) + "r)",
  );
  /* The hook has to be EXTERIOR or it is not a hook: blades that stop at the
     body's own edge are a paint job, and the enemy cast is already full of
     rounded masses with markings on them. */
  check(
    "MAKO hook: the fin tips run >= 1.20x past the body's own half-width",
    spanX(fins[0]) >= spanX(contour[0]) * 1.2,
    (spanX(fins[0]) / spanX(contour[0])).toFixed(2) + "x",
  );
  /* Two eyes is the enemy-family separation beat: every foe in the cast is a
     dome or a box carrying ONE lens or a slit (enemybody.js), so a mirrored
     PAIR of bulging eyes is an outline cue nothing else in the game has. */
  check(
    "MAKO face: exactly two cream eyes, mirrored across the spine, above the waist",
    eyes.length === 2 &&
      eyes.every((e) => e.el && e.el.y < 0) &&
      Math.abs(eyes[0].el.x + eyes[1].el.x) < 1e-6,
    eyes.length + " eyes at x " + eyes.map((e) => e.el && e.el.x.toFixed(2)).join("/"),
  );
  const crown = Math.min(...contour[0].pts.map((p) => p[1]));
  const lidTop = lids.length ? Math.min(...lids.map((b) => b.el.y - b.el.ry)) : Infinity;
  check(
    "MAKO eyes BREAK the crown (they are bulges, not markings on a dome)",
    lids.length === 2 && lidTop < crown - 1e-6,
    "lid top " + (lidTop / R).toFixed(2) + "r vs crown " + (crown / R).toFixed(2) + "r",
  );
  /* KEPT from IONVEST, retargeted from an op index to the contour block. The
     RIM seal is a 2px 55%-alpha line; what actually makes the silhouette
     survive a same-value backdrop is the DARK CONTOUR BAND it is drawn on.
     Weigh the band, don't just check that seal() ran — a call-order check
     passed on the rejected build too. */
  check(
    "MAKO outline: the contour band is >= 0.12 darker than the body, and sealed",
    contour.length === 1 &&
      lum(PLAYER_SUIT) - lumOf(contour[0].fill) >= 0.12 &&
      contour[0].sealed,
    contour.length
      ? (lum(PLAYER_SUIT) - lumOf(contour[0].fill)).toFixed(3) +
        (contour[0].sealed ? " sealed" : " UNSEALED")
      : "no contour block",
  );
}

/* MAKO gate — PER-BIOME SEPARATION. Inherited from IONVEST (2026-09-06, on
   "in the 2D the main charecter is terrible look") and made stricter twice:

   1. SEVEN swatches per biome, not five. `wallHi` is an opaque band over the
      top 40% of every wall tile and the brick highlight is a REAL composite,
      `brickHi` at globalAlpha 0.55 over `brickA`. On VOID that composite is
      #a266e6 — which is precisely "#9a4ff0 lifted in value", i.e. the naive
      reading of the controller's tweak walks straight into the brick. The
      shipped five-swatch list could not see it.
   2. A Lab dE floor on VOID specifically. VOID is the one room where hero and
      scenery are the SAME HUE by construction (brickA #6a20c8, wallHi
      #8a70b0, the composite above), so the hue axis says nothing there and
      the AND gate degenerates to a value check. dE is the second opinion.

   DISCLOSED, and deliberately NOT gated: `stationary` carries #c58aff, a
   light violet, and no hex in MAKO's family clears it on the AND gate while
   holding chroma >= 0.35 — the window would be L <= 0.359 (darker than the
   base, and invisible on VOID) or L >= 0.752 (chroma collapses to pastel).
   Swept the whole violet band to confirm. Separation from the CAST is
   AGENTS.md's standing rule — structure, never a re-hue — and MAKO is a
   finned chevron with two cream eyes and a grin against a dark square bunker
   with a magenta slit. The AND gate is a BACKDROP gate; that is the failure
   the user actually reported, and it is what it is held to. */
{
  const L = lum(PLAYER_SUIT),
    H = hueOf(PLAYER_SUIT);
  const bad = [];
  let near = 0,
    worst = 360,
    worstAt = "";
  for (const [n, s] of ALL_SWATCHES) {
    const dL = Math.abs(L - lum(s)),
      dH = dHue(H, hueOf(s));
    if (dL >= 0.12) continue;
    near++;
    if (dH < worst) {
      worst = dH;
      worstAt = n + " " + s;
    }
    if (dH < 25) bad.push(n + " " + s + " dL" + dL.toFixed(3) + " dH" + dH.toFixed(1));
  }
  check(
    "MAKO separation: no biome swatch collapses on BOTH value and hue (56 swatches)",
    !bad.length,
    bad.join("; ") ||
      near + " within dL 0.12, worst dHue " + worst.toFixed(1) + " (" + worstAt + ")",
  );
  check(
    "MAKO chroma: the body is saturated, so the hue axis above is real",
    chromaOf(PLAYER_SUIT) >= 0.35,
    PLAYER_SUIT + " C=" + chromaOf(PLAYER_SUIT).toFixed(3),
  );
  const V = BIOMES.find((b) => b.name === "VOID");
  const vs = biomeSwatches(V);
  let vMin = 1e9,
    vAt = "";
  for (const [n, s] of vs) {
    const d = dE(PLAYER_SUIT, s);
    if (d < vMin) {
      vMin = d;
      vAt = n + " " + s;
    }
  }
  check(
    "MAKO on VOID: every VOID swatch is >= 14 dE away (the hue-blind room)",
    vMin >= 14,
    vMin.toFixed(1) + " dE at " + vAt,
  );
  check(
    "MAKO on VOID: the brick face itself is >= 40 dE away",
    dE(PLAYER_SUIT, V.brickA) >= 40,
    dE(PLAYER_SUIT, V.brickA).toFixed(1) + " dE vs brickA " + V.brickA,
  );
  /* The value lift the controller asked for, pinned so a later "restore the
     concept hex" cannot quietly undo it: the art-direction base was #9a4ff0
     (L .418), which collides with VOID's own brick highlight composite. */
  check(
    "MAKO body is lifted IN FAMILY off the concept base #9a4ff0",
    Math.abs(hueOf(PLAYER_SUIT) - hueOf("#9a4ff0")) <= 12 &&
      lum(PLAYER_SUIT) - lum("#9a4ff0") >= 0.15,
    "dHue " + Math.abs(hueOf(PLAYER_SUIT) - hueOf("#9a4ff0")).toFixed(1) +
      " dL +" + (lum(PLAYER_SUIT) - lum("#9a4ff0")).toFixed(3),
  );
  /* CONVERGENCE, replacing IONVEST's divergence pin. The split existed for
     exactly one round and for exactly one reason — gunmetal vanished into
     FACTORY's wall in 2D (ΔL .008, Δhue 8.3°) and was still correct in 3D,
     which has no dark contour. MAKO's body clears the backdrop gate in both,
     so the hero is ONE character again and there is one body hex. Pinned so a
     future "3D needs its own value" cannot re-split it without saying why. */
  check(
    "MAKO convergence: PLAYER_HULL and PLAYER_SUIT are the same body hex",
    PLAYER_HULL === PLAYER_SUIT && PLAYER_SUIT !== "#8d97ac",
    PLAYER_HULL + " / " + PLAYER_SUIT,
  );
}

{
  const c = stub();
  drawPlayerBody(c, { time: 0 }, P());
  const fills = setsOf(c._ops, "fillStyle");
  check(
    "player writes >=4 distinct fillStyle",
    new Set(fills).size >= 4,
    [...new Set(fills)].join(" "),
  );
  /* MOVED PIN: the visor triad (#0b1020 well / #7fe0ff core / #ffffff pip)
     belonged to a helmet. MAKO's face is a MOUTH and a pair of eyes, so the
     triad becomes cream field / ink pupil-and-grin / white specular. */
  check(
    "MAKO face triad: cream eye field, ink pupils and grin, white specular",
    fills.includes(CREAM) && fills.includes(INK) && fills.includes("#ffffff"),
    fills.join(" "),
  );
  /* Both blades are ONE path and ONE fill, so this still counts placements
     rather than parts — two poly() calls would read as two placements and
     would also hide the second blade from blocks(). */
  check(
    "one-placement rule: p.color is exactly one fillStyle",
    fills.filter((v) => v === TEAL).length === 1,
    String(fills.filter((v) => v === TEAL).length),
  );
}

{
  const up = stub(),
    down = stub();
  drawPlayerBody(up, { time: 0 }, P({ face: { x: 0, y: -1 } }));
  drawPlayerBody(down, { time: 0 }, P({ face: { x: 0, y: 1 } }));
  check(
    "back pose differs from front",
    JSON.stringify(up._ops) !== JSON.stringify(down._ops),
  );
  /* Walking away, you see MAKO's back: a dark dorsal panel, no eyes at all.
     The fins are what still flags the outline, so p.color must survive — a
     back pose that drops the hook leaves an unrecognisable lump. */
  check(
    "back pose shows the dorsal panel, no eyes, fins still flagging",
    !setsOf(up._ops, "fillStyle").includes(CREAM) &&
      setsOf(up._ops, "fillStyle").includes(TEAL),
  );
  const lf = stub(),
    rt = stub();
  drawPlayerBody(lf, { time: 0 }, P({ face: { x: -1, y: 0 } }));
  drawPlayerBody(rt, { time: 0 }, P({ face: { x: 1, y: 0 } }));
  check(
    "face.x tracks the pupils inside fixed eyes",
    JSON.stringify(lf._ops) !== JSON.stringify(rt._ops),
  );
  const k0 = stub(),
    k1 = stub();
  drawPlayerBody(k0, { time: 0 }, P());
  drawPlayerBody(k1, { time: 0 }, P({ kick: true }));
  /* MOVED PIN: the resting boot hex was navy #0d3f78 under the humanoid. It
     is now MAKO's own #2e1a4e, the concept's foot colour. The KICK hex
     #c07a3a is unchanged — it is a gameplay tell, not an art choice. */
  check(
    "p.kick flips the foot fill",
    setsOf(k0._ops, "fillStyle").includes(BOOT) &&
      setsOf(k1._ops, "fillStyle").includes("#c07a3a") &&
      !setsOf(k1._ops, "fillStyle").includes(BOOT),
  );
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
