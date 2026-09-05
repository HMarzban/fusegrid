import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { CFG } from "../src/core/config.js";
import { POWER } from "../src/core/entities.js";
import { drawIcon, RIM, ITEM_FAMILY, ITEM_SHAPE, ITEM_ACCENT } from "../src/render/icons.js";
import { drawItemBody, drawItemChrome, drawPlayerBody } from "../src/render/sprites.js";

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
  check("player fits +-1.05r horizontally", hx <= R * 1.05 + 1e-6, hx.toFixed(2));
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

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
