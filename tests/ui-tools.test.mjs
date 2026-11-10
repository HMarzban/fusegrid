/* tools/ui (Task 1.5): shots / gates / compare and the kit probe (R15). Nothing here starts a browser: the pure parts are imported from
   tools/ui/lib, the gates and compare CLIs run on synthetic captures in a temp dir, and the probe runs in Node. The CLASSIC determinism check
   (two shots.mjs runs, byte-identical PNGs) is run by hand in the task, not here. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { createRGBA, png, unpng } from "../tools/pixel/rgba.mjs";
import { PRECACHE } from "../src/pwa/shell.js";
import * as P from "../src/render/kit/probe.js";
import { squint, stat, evaluate, tally, FLOOR, CAP } from "../tools/ui/lib/gatelib.mjs";
import { ORDER, SCREENS, canon, capName, parseCapName } from "../tools/ui/lib/screens.mjs";
import { refKeys, findRef, compareHtml } from "../tools/ui/lib/refs.mjs";
import { parseArgs as shotsArgs } from "../tools/ui/shots.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = join(ROOT, "tools/ui");
const tmp = () => mkdtempSync(join(tmpdir(), "fg-ui-"));

test("each tool's header documents every flag it parses", () => {
  for (const [f, min] of [["shots.mjs", 10], ["gates.mjs", 1], ["compare.mjs", 2]]) {
    const src = readFileSync(join(UI, f), "utf8"), head = src.slice(0, src.indexOf("*/"));
    const flags = new Set([...src.matchAll(/k === "(--[a-z0-9]+)"/g)].map((m) => m[1]));
    assert.ok(flags.size >= min, f + ": " + [...flags].join(" "));
    for (const g of flags) assert.match(head, new RegExp("^\\s+" + g + "\\b", "m"), f + ": " + g + " missing from the header");
  }
});

test("sheet.html and every tools/ui path stay out of the precache; src never imports tools/", () => {
  assert.ok(existsSync(join(UI, "sheet.html")));
  assert.doesNotMatch(readFileSync(join(ROOT, "src/pwa/shell.js"), "utf8"), /tools\//);
  assert.deepEqual(PRECACHE.filter((p) => /tools\//.test(p)), []);
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(m?js|html)$/.test(f) ? [p] : []; });
  const bad = walk(join(ROOT, "src")).filter((f) => /["'](?:\.\.\/)+tools\/|["']\/tools\//.test(readFileSync(f, "utf8")));
  assert.deepEqual(bad, []);
});

test("main hands the probe and the text scale to the debug hook; the debug hook owns __GAME__.ui", async () => {
  const main = readFileSync(join(ROOT, "src/main.js"), "utf8");
  assert.match(main, /from "\.\/render\/kit\/probe\.js"/);
  assert.match(main, /from "\.\/render\/kit\/type\.js"/);
  assert.match(main, /\bui: \{/);
  const { mountDebugHook } = await import("../src/app/debughook.js");
  const ons = [], ui = { snap: () => P.snapshot(), on: (b) => ons.push(b), textScale: () => 1 };
  globalThis.window = {};
  try {
    mountDebugHook({ world: {}, input: {}, app: {}, renderer: () => null, demo: () => null, ui });
    assert.equal(window.__GAME__.ui, ui);
    assert.deepEqual(ons, [true], "the hook switches the probe on");
  } finally { delete globalThis.window; }
});

test("probe: off is a no-op, on records, setOn(false) clears, snapshot is plain JSON", () => {
  P.setOn(false);
  P.begin("menu", { w: 600, h: 520, dpr: 2, el: "sh" });
  P.rect("play", 1, 2, 3, 4, { touch: true });
  P.text("PLAY", 1, 2, 30, 14.8, { role: "primary" });
  P.pair("nope", { x: 0, y: 0 }, { x: 1, y: 1 });
  assert.deepEqual(P.snapshot(), { page: "", box: null, rects: [], texts: [], pairs: [], frames: 0 });
  P.setOn(true);
  P.begin("menu", { w: 600, h: 520, dpr: 2, el: "sh" });
  P.rect("play", 10, 20, 200, 44, { touch: true, set: "list", kind: "list", fill: "#ffd447", fn: () => 1, deep: { a: 1 } });
  P.text("PLAY", 12, 30, 40, 14.8, { role: "primary", col: "#fff2df" });
  P.pair("chosen", [0, 0, 10, 10], { x: 20, y: 0, w: 10, h: 10 });
  P.pair("locked", { x: 0, y: 0, w: 4, h: 4 }, { x: 5, y: 5 }, { floor: { x: 9, y: 9, w: 2, h: 2 }, name: "lock" });
  assert.throws(() => P.pair("glow", { x: 0, y: 0 }, { x: 0, y: 0 }), /unknown pair kind/);
  const s = P.snapshot();
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s, "JSON round trip");
  assert.equal(s.page, "menu");
  assert.deepEqual(s.box, { w: 600, h: 520, dpr: 2, el: "sh" });
  assert.deepEqual(s.rects, [{ touch: true, set: "list", kind: "list", fill: "#ffd447", name: "play", x: 10, y: 20, w: 200, h: 44 }]);
  assert.equal(s.texts[0].role, "primary");
  assert.deepEqual(s.pairs[0].a, { x: 0, y: 0, w: 10, h: 10 });
  assert.deepEqual(s.pairs[1].b, { x: 5, y: 5, w: 0, h: 0 });
  assert.deepEqual(s.pairs[1].floor, { x: 9, y: 9, w: 2, h: 2 });
  s.rects[0].x = 99;
  assert.equal(P.snapshot().rects[0].x, 10, "a snapshot is a copy");
  P.begin("level");
  assert.deepEqual([P.snapshot().rects.length, P.snapshot().frames, P.snapshot().box], [0, 2, null], "begin clears the last frame");
  P.setOn(false);
  assert.deepEqual(P.snapshot(), { page: "", box: null, rects: [], texts: [], pairs: [], frames: 0 });
});

/* a hand-built 8-bit RGB PNG with filters None, Sub, Up, Average and Paeth (Chrome screenshots use all five) */
function filteredRGB(w, h, px) {
  const bpp = 3, st = w * bpp, rows = [], prev = Buffer.alloc(st);
  for (let y = 0; y < h; y++) {
    const cur = Buffer.alloc(st);
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) cur[x * 3 + k] = px(x, y)[k];
    const f = y % 5, out = Buffer.alloc(st + 1);
    out[0] = f;
    for (let i = 0; i < st; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      out[i + 1] = (cur[i] - pred) & 255;
    }
    rows.push(out); cur.copy(prev);
  }
  const T = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = T[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cc]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}

test("PNG decode: an RGBA round trip and a filtered RGB PNG", () => {
  const img = createRGBA(3, 2, "#102030");
  img.data.set([255, 0, 0, 255], 4);
  const back = unpng(png(img));
  assert.deepEqual([back.width, back.height, [...back.data]], [3, 2, [...img.data]]);
  const px = (x, y) => [(x * 37 + y * 11) & 255, (x * 5 + y * 91) & 255, (x * y * 13 + 7) & 255];
  const d = unpng(filteredRGB(7, 10, px));
  for (let y = 0; y < 10; y++) for (let x = 0; x < 7; x++) assert.deepEqual([...d.data.subarray((y * 7 + x) * 4, (y * 7 + x) * 4 + 4)], [...px(x, y), 255], x + "," + y);
});

/* CSS w x h at dpr, left half `a`, right half `b` */
const twoTone = (w, h, dpr, a, b) => { const img = createRGBA(w * dpr, h * dpr, a), r = createRGBA(1, 1, b); for (let y = 0; y < h * dpr; y++) for (let x = (w * dpr) / 2; x < w * dpr; x++) img.data.set(r.data, (y * w * dpr + x) * 4); return img; };

test("squint: greyscale at half size, 2 x dpr box, mean contrast", () => {
  const img = twoTone(40, 20, 2, "#ffffff", "#000000"), sq = squint(img, 2);
  assert.deepEqual([sq.w, sq.h, sq.s], [20, 10, 0.5]);
  const L = stat(sq, { x: 0, y: 0, w: 20, h: 20 }), D = stat(sq, { x: 20, y: 0, w: 20, h: 20 });
  assert.ok(Math.abs(L.mean - 1) < 1e-6 && D.mean === 0 && L.sd < 1e-6);
  assert.equal(+((L.mean + 0.05) / (D.mean + 0.05)).toFixed(2), 21);
  assert.deepEqual([squint(createRGBA(30, 30), 3).w, squint(createRGBA(30, 30), 1).w], [5, 15], "k = 2 x dpr");
  /* the mock's order: average the 8-bit channels over the box, THEN linearise (1 px black / white stripes average to 127.5, not to L 0.5) */
  const st = createRGBA(4, 4, "#000000");
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x += 2) st.data.set([255, 255, 255, 255], (y * 4 + x) * 4);
  const m = stat(squint(st, 1), { x: 0, y: 0, w: 4, h: 4 }).mean;
  assert.ok(Math.abs(m - Math.pow((127.5 / 255 + 0.055) / 1.055, 2.4)) < 1e-4, String(m));
});

const dump = (ui, o = {}) => ({ screen: "menu", file: "menu.2d.w1.png", flags: { look: "2d", world: 1, phone: !!o.phone, t125: false, size: o.size || [40, 20], dpr: o.dpr || 2 },
  read: { lay: o.phone ? "p" : "d" }, canvases: { sh: { x: 0, y: 0, w: (o.size || [40, 20])[0], h: (o.size || [40, 20])[1], hidden: false }, c: null }, ui });
const ui = (o) => ({ page: "menu", box: { w: 40, h: 20, dpr: 2, el: "sh" }, rects: [], texts: [], pairs: [], frames: 1, ...o });

test("gates: no probe data skips every gate, never a pass; --strict makes the skips fail", () => {
  const img = twoTone(40, 20, 2, "#ffffff", "#000000");
  for (const u of [null, ui({ box: null, page: "" })]) {
    const g = evaluate(dump(u), img, null);
    assert.ok(Object.keys(g).length >= 10, Object.keys(g).join(" "));
    for (const [n, r] of Object.entries(g)) assert.equal(r.status, "skipped", n);
    assert.match(g.chosen.note, /no probe data/);
    const t = tally([{ gates: g }]);
    assert.deepEqual([t.pass, t.fail, t.skipped, t.exit(false), t.exit(true)], [0, 0, Object.keys(g).length, 0, 1]);
  }
});

test("gates: squint pairs, ring max, locked texture, info contrast", () => {
  const img = twoTone(40, 20, 2, "#ffffff", "#000000"), W = { x: 0, y: 0, w: 20, h: 20 }, B = { x: 20, y: 0, w: 20, h: 20 };
  const g = evaluate(dump(ui({ pairs: [{ kind: "chosen", a: W, b: B }, { kind: "band", a: W, b: W, name: "flat" }, { kind: "ring", a: W, b: B }, { kind: "info", a: W, b: B }, { kind: "locked", a: W, b: B, floor: B }] })), img, null);
  assert.equal(g.chosen.status, "pass"); assert.equal(g.chosen.value, 21); assert.equal(g.chosen.threshold, FLOOR.chosen);
  assert.equal(g.band.status, "fail"); assert.equal(g.band.value, 1); assert.match(g.band.on, /flat/);
  assert.equal(g.ring.status, "pass");
  assert.equal(g.info.status, "pass");
  assert.equal(g.locked.status, "fail", "a flat locked face: sd 0 / max(1e-4, floor sd) = 0 < 2, as the mock divides");
  assert.deepEqual(g.locked.items.map((i) => [i.status, i.value]), [["pass", 21], ["fail", 0]]);
  assert.match(g.locked.on, /texture sd/);
  const t = tally([{ gates: g }]);
  assert.equal(t.exit(false), 1, "a real fail exits 1");
  const n = evaluate(dump(ui({ rects: [{ name: "x", x: 0, y: 0, w: 4, h: 4 }] })), img, null);
  assert.equal(n.chosen.status, "n/a", "an instrumented page with no chosen pair: nothing to measure, never a pass");
  assert.equal(tally([{ gates: n }]).exit(true), 0, "--strict fails skips, not n/a");
});

test("gates: touch targets and gaps (phone), text inside the page box, cap floors by role and device, one yellow", () => {
  const img = createRGBA(80, 40, "#000000");
  const R = (name, x, y, w, h, o) => ({ name, x, y, w, h, ...o });
  const ph = evaluate(dump(ui({ rects: [R("a", 0, 0, 44, 44, { touch: true, set: "s" }), R("b", 48, 0, 44, 44, { touch: true, set: "s" }), R("c", 0, 50, 30, 44, { touch: true, set: "t" }),
    R("l1", 0, 100, 44, 44, { touch: true, set: "u", kind: "list" }), R("l2", 0, 145, 44, 44, { touch: true, set: "u", kind: "list" })] }), { phone: true }), img, null);
  assert.equal(ph.touch.status, "fail"); assert.equal(ph.touch.value, 30); assert.match(ph.touch.on, /\bc\b/);
  assert.equal(ph.gap.status, "fail"); assert.equal(ph.gap.value, 4); assert.match(ph.gap.on, /a .* b/);
  const ok = evaluate(dump(ui({ rects: [R("a", 0, 0, 44, 44, { touch: true, set: "s" }), R("b", 52, 0, 44, 44, { touch: true, set: "s" })] }), { phone: true }), img, null);
  assert.deepEqual([ok.touch.status, ok.gap.status, ok.gap.value], ["pass", "pass", 8]);
  const dk = evaluate(dump(ui({ rects: [R("a", 0, 0, 10, 10, { touch: true })] })), img, null);
  assert.equal(dk.touch.status, "n/a", "desktop: no touch gate");
  const T = (s, x, y, w, capH, o) => ({ s, x, y, w, capH, role: "primary", ...o });
  const tx = evaluate(dump(ui({ texts: [T("PLAY", 1, 1, 20, 14.8), T("SUB", 1, 5, 20, 10.9, { role: "secondary" }), T("WIDE", 30, 1, 20, 14)] })), img, null);
  assert.equal(tx.inside.status, "fail"); assert.match(tx.inside.on, /WIDE/);
  assert.equal(tx.cap.status, "fail"); assert.equal(tx.cap.value, 10.9); assert.match(tx.cap.on, /SUB/);
  const pc = evaluate(dump(ui({ texts: [T("SUB", 1, 5, 20, 9.5, { role: "secondary" }), T("HUD", 1, 5, 20, 14.9, { role: "hud" }), T("Body", 1, 5, 20, 10, { role: "body", px: 15 })] }), { phone: true }), img, null);
  assert.equal(pc.cap.status, "pass", JSON.stringify(pc.cap));
  assert.equal(CAP.d.primary, 14); assert.equal(CAP.p.body, 14.1);
  const y = evaluate(dump(ui({ rects: [R("play", 0, 0, 4, 4, { fill: "#FFD447" }), R("start", 5, 0, 4, 4, { fill: "#ffd447" }), R("k", 0, 0, 4, 4, { fill: "#222" })] })), img, null);
  assert.deepEqual([y.yellow.status, y.yellow.value], ["fail", 2]);
  const y1 = evaluate(dump(ui({ rects: [R("play", 0, 0, 4, 4, { fill: "#ffd447" }), R("play", 0, 0, 4, 4, { fill: "#ffd447" })] })), img, null);
  assert.deepEqual([y1.yellow.status, y1.yellow.value], ["pass", 1], "one part drawn twice is still one part");
});

test("gates CLI: writes gates.json, exit 0 with skips, 1 under --strict, 1 on a fail, 1 on an empty dir", () => {
  const d = tmp();
  try {
    const run = (...a) => spawnSync(process.execPath, [join(UI, "gates.mjs"), d, ...a], { encoding: "utf8", timeout: 30000 });
    assert.equal(run().status, 1, "an empty dir is an error, never a pass");
    writeFileSync(join(d, "menu.2d.w1.png"), png(twoTone(40, 20, 2, "#ffffff", "#000000")));
    writeFileSync(join(d, "menu.2d.w1.json"), JSON.stringify(dump(null)));
    const r = run();
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const G = JSON.parse(readFileSync(join(d, "gates.json"), "utf8"));
    assert.equal(G.summary.captures, 1);
    assert.equal(G.summary.pass, 0);
    assert.ok(G.screens["menu.2d.w1"].gates.chosen.status === "skipped");
    assert.equal(run("--strict").status, 1);
    writeFileSync(join(d, "menu.2d.w1.json"), JSON.stringify(dump(ui({ pairs: [{ kind: "chosen", a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 2, y: 2, w: 4, h: 4 } }] }))));
    assert.equal(run().status, 1, "chosen 1:1 fails");
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("shots: flags, lists, aliases, phone defaults, refusals", () => {
  const a = shotsArgs([]);
  assert.deepEqual(a.screens, ORDER);
  assert.deepEqual([a.looks, a.worlds, a.seed, a.t125, a.phone, a.w, a.h, a.dpr], [["2d"], [1], null, false, false, 1366, 768, 2]);
  assert.match(a.out, /tools\/ui\/out$/);
  const b = shotsArgs(["--screens", "pause,settings,menu", "--look", "2d,px,3d", "--world", "1,2,8", "--seed", "4242", "--t125", "--phone", "--out", "/tmp/x", "--notext", "--gpu"]);
  assert.deepEqual(b.screens, ["menu", "options", "pause"], "canonical order: menu pages before runs");
  assert.deepEqual([b.looks, b.worlds, b.seed, b.t125, b.phone, b.w, b.h, b.dpr, b.out, b.notext, b.gpu], [["2d", "px", "3d"], [1, 2, 8], 4242, true, true, 393, 852, 3, "/tmp/x", true, true]);
  assert.deepEqual([shotsArgs(["--phone", "--size", "430x932", "--dpr", "2"]).w, shotsArgs(["--size", "800x600"]).h, shotsArgs(["--dpr", "1"]).dpr], [430, 600, 1]);
  for (const v of [["--screens", "nope"], ["--screens"], ["--look", "iso"], ["--world", "0"], ["--world", "9"], ["--seed", "-1"], ["--seed", "4294967296"], ["--size", "big"], ["--dpr", "x"], ["--bogus"]])
    assert.throws(() => shotsArgs(v), Error, v.join(" "));
});

test("screens: every name has a recipe and a state; aliases; capture names round trip", () => {
  assert.deepEqual(ORDER, ["title", "menu", "level", "options", "graphics", "controls", "guide", "howto", "items", "enemies", "floor", "scores", "stats", "medals", "play", "pause", "win", "lose"]);
  for (const n of ORDER) assert.ok(SCREENS[n] && SCREENS[n].state, n);
  assert.equal(canon("settings"), "options");
  assert.equal(canon("SETTINGS"), "options");
  assert.equal(canon("nope"), null);
  const o = { screen: "menu", look: "2d", world: 2, t125: true, phone: true };
  assert.equal(capName(o), "menu.2d.w2.t125.phone");
  assert.equal(capName({ ...o, t125: false, phone: false }), "menu.2d.w2");
  assert.deepEqual(parseCapName("menu.2d.w2.t125.phone.png"), o);
  assert.deepEqual(parseCapName("lose.px.w8.png"), { screen: "lose", look: "px", world: 8, t125: false, phone: false });
  assert.equal(parseCapName("menu.2d.w2.notext.png"), null);
  assert.equal(parseCapName("gates.json"), null);
});

test("refmap: known screens, relative round 7 frames, most specific key first", () => {
  const map = JSON.parse(readFileSync(join(UI, "refmap.json"), "utf8"));
  const keys = Object.keys(map).filter((k) => !k.startsWith("_"));
  assert.ok(keys.length >= 20, keys.length + " keys");
  for (const k of keys) {
    assert.match(k, /^[a-z]+(\.(2d|px|3d))?(\.w[1-8])?(\.t125)?(\.phone)?$/, k);
    assert.ok(ORDER.includes(k.split(".")[0]), k);
    assert.match(map[k], /^[A-Z]7-[a-z]+\/png\/[dp]-[a-z0-9-]+\.png$/, k);
    assert.equal(/\.phone$/.test(k), /\/p-/.test(map[k]), k + " phone key, phone frame");
    assert.equal(/\.t125/.test(k), /-t125\.png$/.test(map[k]), k + " t125 key, t125 frame");
  }
  assert.deepEqual(refKeys({ screen: "menu", look: "px", world: 2, t125: false, phone: true }), ["menu.px.w2.phone", "menu.w2.phone", "menu.px.phone", "menu.phone"]);
  assert.equal(findRef(map, { screen: "menu", look: "2d", world: 2, t125: false, phone: false }), map["menu.w2"]);
  assert.equal(findRef(map, { screen: "win", look: "2d", world: 5, t125: false, phone: false }), "E7-end/png/d-11-win.png");
  assert.equal(findRef(map, { screen: "win", look: "2d", world: 3, t125: false, phone: false }), "E7-end/png/d-11-win-level.png");
  assert.equal(findRef(map, { screen: "graphics", look: "2d", world: 1, t125: false, phone: false }), null);
  assert.equal(findRef(map, { screen: "win", look: "2d", world: 3, t125: true, phone: false }), null, "never a 100 % frame for a 125 % capture");
});

test("compare: the mock beside the capture by absolute file URL, 'no reference' when unmapped", () => {
  const d = tmp(), ref = tmp();
  try {
    writeFileSync(join(d, "menu.2d.w1.png"), png(createRGBA(2, 2)));
    writeFileSync(join(d, "floor.2d.w1.png"), png(createRGBA(2, 2)));
    writeFileSync(join(d, "menu.2d.w1.notext.png"), png(createRGBA(2, 2)));
    const map = { "menu": "S7-menu/png/d-m1-menu.png" };
    const html = compareHtml(d, ref, map, (p) => p.endsWith("d-m1-menu.png"));
    assert.match(html, /menu\.2d\.w1\.png/);
    assert.match(html, /d-m1-menu\.png/);
    assert.ok(html.includes("file://" + ref), "mock by absolute file URL");
    assert.match(html, /floor\.2d\.w1\.png[\s\S]*no reference/);
    assert.doesNotMatch(html, /notext/);
    const r = spawnSync(process.execPath, [join(UI, "compare.mjs"), d, "--ref", ref], { encoding: "utf8", timeout: 30000 });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(d, "compare.html")));
    assert.deepEqual(readdirSync(d).filter((f) => f.startsWith("d-")), [], "no mock frame is copied");
    assert.notEqual(spawnSync(process.execPath, [join(UI, "compare.mjs"), d], { encoding: "utf8" }).status, 0, "--ref is required");
  } finally { rmSync(d, { recursive: true, force: true }); rmSync(ref, { recursive: true, force: true }); }
});
