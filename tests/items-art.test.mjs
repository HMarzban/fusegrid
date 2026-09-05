import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { CFG } from "../src/core/config.js";
import { POWER } from "../src/core/entities.js";
import { drawIcon, RIM, ITEM_FAMILY } from "../src/render/icons.js";
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

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
