import { readFileSync, readdirSync } from "node:fs";
import { setFactory, layer, invalidate, release, capDpr, keyOf, _dbg, BUDGET } from "../src/render/kit/cache.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

let made = [];
setFactory((w, h) => {
  const c = { width: w, height: h, getContext: () => ({}) };
  made.push(c);
  return c;
});
const K = (o) => ({ layer: "bg", biome: 0, level: 1, W: 393, H: 852, dpr: 3, look: 0, textScale: 1, ...o });
let paints = 0;
const paint = () => paints++;
const reset = () => {
  release();
  invalidate("test");
  _dbg.misses = 0;
  made = [];
  paints = 0;
};

check("budget is 24 MB", BUDGET === 24 * 1024 * 1024);
check("touch dpr is capped at 2", capDpr(3, true) === 2 && capDpr(1.5, true) === 1.5 && capDpr(3, false) === 3);
check("key distinguishes every field", new Set(["layer", "biome", "level", "W", "H", "dpr", "look", "textScale"].map((f) => keyOf(K({ [f]: f === "layer" ? "x" : 9 })))).size === 8 && keyOf(K({ layer: "a|b" })) !== keyOf(K({ layer: "a", biome: "b|0" })));

reset();
const a = layer(K(), 100, 100, paint);
const b = layer(K(), 100, 100, paint);
check("second identical request is a hit", a === b && _dbg.misses === 1 && paints === 1 && made.length === 1, _dbg.misses);

for (const f of [{ W: 400 }, { H: 800 }, { dpr: 2 }, { biome: 1 }, { level: 2 }, { look: 1 }, { textScale: 1.25 }]) {
  reset();
  layer(K(), 10, 10, paint);
  layer(K(f), 10, 10, paint);
  layer(K(f), 10, 10, paint);
  check("change " + JSON.stringify(f) + " misses once", _dbg.misses === 2 && paints === 2, _dbg.misses);
}

reset();
let peak = 0;
for (let i = 0; i < 8; i++) {
  layer(K({ biome: i }), 1179, 2556, paint);
  peak = Math.max(peak, _dbg.bytes);
}
check("8 worlds at 1179x2556 never exceed 24 MB", peak <= BUDGET && _dbg.bytes <= BUDGET, peak);
check("only the newest worlds stay", _dbg.bytes === 1179 * 2556 * 4 * 2 && made.slice(0, 6).every((c) => c.width === 0 && c.height === 0) && made[7].width === 1179);

reset();
const L = (i) => layer(K({ biome: i }), 2000, 1000, paint);
L(0), L(1), L(2);
L(0);
L(3);
const m = _dbg.misses;
L(0);
L(2);
const kept = _dbg.misses === m;
L(1);
check("a hit refreshes recency: the least recently used layer is freed first", m === 4 && kept && _dbg.misses === m + 1, [m, _dbg.misses].join());

reset();
const big = layer(K(), 4000, 4000, paint);
check("a layer larger than the budget is still created", big.width === 4000 && _dbg.bytes === 4000 * 4000 * 4 && _dbg.bytes > BUDGET);
layer(K({ biome: 1 }), 10, 10, paint);
check("and is freed first when the next layer arrives", big.width === 0 && _dbg.bytes === 400);

reset();
const c1 = layer(K(), 10, 10, paint);
invalidate("resize");
check("invalidate drops layers, records the reason, adds no misses", c1.width === 0 && _dbg.bytes === 0 && _dbg.reason === "resize" && _dbg.misses === 1);
layer(K(), 10, 10, paint);
check("after invalidate the same key misses again", _dbg.misses === 2 && paints === 2);

reset();
layer(K(), 500, 500, paint);
layer(K({ biome: 1 }), 500, 500, paint);
const live = made.slice();
release();
check("release returns bytes to 0 and zeroes canvases", _dbg.bytes === 0 && live.every((c) => c.width === 0 && c.height === 0));

reset();
let threw = false;
try {
  layer(K(), 10, 10, () => {
    throw new Error("font not ready");
  });
} catch (e) {
  threw = e.message === "font not ready";
}
check("a throwing paint rethrows and leaves nothing cached", threw && _dbg.bytes === 0 && made[0].width === 0);
layer(K(), 10, 10, paint);
check("the same key then misses again and paints", _dbg.misses === 2 && paints === 1 && _dbg.bytes === 400);

reset();
let seen;
layer(K(), 7, 9, (ctx, canvas) => (seen = [ctx, canvas]));
check("paint receives ctx and canvas, canvas is w by h", seen && seen[1].width === 7 && seen[1].height === 9 && typeof seen[0] === "object");

const dir = new URL("../src/render/kit/", import.meta.url);
const bad = /getImageData|toDataURL|\bfilter\b|shadowBlur|shadowColor/;
const offenders = readdirSync(dir).filter((f) => f.endsWith(".js") && bad.test(readFileSync(new URL(f, dir), "utf8")));
check("kit files use no getImageData / toDataURL / filter / shadow blur", offenders.length === 0, offenders.join());

console.log(pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
