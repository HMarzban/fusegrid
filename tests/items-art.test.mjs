import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { CFG } from "../src/core/config.js";
import { POWER } from "../src/core/entities.js";
import { drawIcon, RIM, ITEM_FAMILY, ITEM_SHAPE, ITEM_ACCENT } from "../src/render/icons.js";
import { drawItemBody, drawPlayerBody } from "../src/render/sprites.js";

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
  const bigOutline = IDS.filter((t) => !ITEM_SHAPE[t] || ITEM_SHAPE[t].length > 12);
  check("outline budget <= 12 vertices", !bigOutline.length, bigOutline.join(" ") || "ok");
  const bigAccent = [],
    hairline = [],
    noFill = [];
  for (const t of IDS) {
    const c = stub();
    ITEM_ACCENT[t](c, S, "#ffffff");
    const ops = c._ops;
    if (paints(ops) > 3) bigAccent.push(t + ":" + paints(ops));
    if (!setsOf(ops, "fillStyle").length) noFill.push(t);
    const lw = setsOf(ops, "lineWidth").map(Number);
    if (names(ops).includes("stroke") && !lw.every((w) => w >= S * 0.12)) hairline.push(t);
  }
  check("accent budget <= 3 paint ops", !bigAccent.length, bigAccent.join(" ") || "ok");
  check("every accent writes a fillStyle (solid shape)", !noFill.length, noFill.join(" ") || "ok");
  check("no accent is a hairline stroke", !hairline.length, hairline.join(" ") || "ok");
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

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
