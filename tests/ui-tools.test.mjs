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
import { squint, stat, evaluate, tally, colOf, FLOOR, CAP, GATES, REQUIRED } from "../tools/ui/lib/gatelib.mjs";
import { ORDER, SCREENS, canon, capName, parseCapName } from "../tools/ui/lib/screens.mjs";
import { refKeys, findRef, compareHtml } from "../tools/ui/lib/refs.mjs";
import { parseArgs as shotsArgs, intended, manifest } from "../tools/ui/shots.mjs";

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

test("main hands the probe and the text scale to the debug hook; the hook exposes __GAME__.ui but never switches it on", async () => {
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
    assert.deepEqual(ons, [], "a ?debug=1 session (tools/pixel/shot.mjs, headed debugging) records nothing: only shots.mjs calls ui.on(true)");
  } finally { delete globalThis.window; }
  assert.match(readFileSync(join(UI, "shots.mjs"), "utf8"), /u\.on\(true\)/, "shots.mjs switches it on itself");
});

test("probe: off is a no-op, on records, setOn(false) clears, snapshot is plain JSON", () => {
  const OFF = { page: "", box: null, rects: [], texts: [], pairs: [], frames: 0, overflow: false };
  P.setOn(false);
  P.begin("menu", { w: 600, h: 520, dpr: 2, el: "sh" });
  P.rect("play", 1, 2, 3, 4, { touch: true });
  P.text("PLAY", 1, 2, 30, 14.8, { role: "primary" });
  P.pair("nope", { x: 0, y: 0 }, { x: 1, y: 1 });
  P.rect("nan", NaN, 0, 1, 1);
  assert.deepEqual(P.snapshot(), OFF, "off: nothing recorded and nothing thrown, even for bad input");
  assert.deepEqual(P.PAIR_KINDS, ["chosen", "band", "ring", "info", "locked"]);
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
  assert.deepEqual(P.snapshot(), OFF);
});

test("probe, while on: bad input throws (a page bug the gates could not judge), and the lists are bounded", () => {
  P.setOn(true);
  try {
    P.begin("menu", { w: 600, h: 520, el: "c" });
    for (const [what, f, re] of [
      ["unknown role", () => P.text("A", 0, 0, 1, 1, { role: "title" }), /unknown role/],
      ["body without px", () => P.text("A", 0, 0, 1, 1, { role: "body" }), /px/],
      ["translucent text colour", () => P.text("A", 0, 0, 1, 1, { col: "rgba(255,255,255,0.5)" }), /colour/],
      ["named text colour", () => P.text("A", 0, 0, 1, 1, { col: "white" }), /colour/],
      ["#rrggbbaa fill", () => P.rect("k", 0, 0, 1, 1, { fill: "#ffd44780" }), /colour/],
      ["NaN x", () => P.rect("k", NaN, 0, 1, 1), /finite/],
      ["undefined capH", () => P.text("A", 0, 0, 1, undefined), /finite/],
      ["null pair point", () => P.pair("chosen", { x: null, y: 0 }, { x: 0, y: 0 }), /finite/],
      ["string w", () => P.pair("band", [0, 0, "10", 1], [0, 0]), /finite/],
      ["Infinity floor", () => P.pair("locked", [0, 0], [0, 0], { floor: [0, 0, Infinity, 1] }), /finite/],
      ["info without its mark colour", () => P.pair("info", [0, 0, 4, 4], [0, 0, 8, 8]), /colour/],
      ["plate T NaN", () => P.rect("p", 0, 0, 1, 1, { plate: NaN }), /finite/],
      ["box NaN", () => P.begin("x", { w: NaN, h: 1 }), /finite/],
      ["box 0 wide", () => P.begin("x", { w: 0, h: 1 }), /> 0/],
    ]) assert.throws(f, re, what);
    P.begin("menu", { w: 600, h: 520, el: "c" });
    P.text("Body", 0, 0, 1, 1, { role: "body", px: 18, col: "rgb(220, 203, 184)" });
    P.pair("info", [0, 0, 4, 4], [0, 0, 8, 8], { col: "#fff" });
    P.rect("k", 0, 0, 1, 1, { fill: "rgba(255,212,71,1)", plate: true });
    assert.deepEqual([P.snapshot().texts.length, P.snapshot().pairs[0].col, P.snapshot().rects[0].plate], [1, "#fff", true]);
    for (let i = 0; i < P.CAP_N + 5; i++) P.rect("r" + i, 0, 0, 1, 1);
    const s = P.snapshot();
    assert.deepEqual([s.rects.length, s.overflow], [P.CAP_N, true], "a page recording without begin cannot grow the lists without limit");
    P.begin("menu");
    assert.equal(P.snapshot().overflow, false, "begin clears it");
  } finally { P.setOn(false); }
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

const dump = (ui, o = {}) => ({ screen: o.screen || "menu", file: "menu.2d.w1.png", flags: { look: "2d", world: 1, phone: !!o.phone, t125: false, size: o.size || [40, 20], dpr: o.dpr || 2 },
  read: { lay: o.phone ? "p" : "d" }, canvases: o.canvases || { sh: { x: 0, y: 0, w: (o.size || [40, 20])[0], h: (o.size || [40, 20])[1], hidden: false }, c: null }, ui });
const ui = (o) => ({ page: "menu", box: { w: 40, h: 20, dpr: 2, el: "sh" }, rects: [], texts: [], pairs: [], frames: 1, overflow: false, ...o });
const NONE = []; // need nothing: look at the declared gates alone
/* CSS w x h at dpr, vertical bands [x0, x1, colour] over a base colour */
const paint = (w, h, dpr, base, bands = []) => {
  const img = createRGBA(w * dpr, h * dpr, base);
  for (const [x0, x1, col, y0 = 0, y1 = h] of bands) { const c = createRGBA(1, 1, col).data; for (let y = y0 * dpr; y < y1 * dpr; y++) for (let x = x0 * dpr; x < x1 * dpr; x++) img.data.set(c, (y * w * dpr + x) * 4); }
  return img;
};
const R = (name, x, y, w, h, o) => ({ name, x, y, w, h, ...o });
const T = (s, x, y, w, capH, o) => ({ s, x, y, w, capH, role: "primary", ...o });

test("gates: no probe data skips every gate, never a pass; --strict makes the skips fail", () => {
  const img = twoTone(40, 20, 2, "#ffffff", "#000000");
  for (const u of [null, ui({ box: null, page: "" })]) {
    const g = evaluate(dump(u), img, null);
    assert.deepEqual(Object.keys(g), GATES);
    for (const [n, r] of Object.entries(g)) assert.equal(r.status, "skipped", n);
    assert.match(g.chosen.note, /no probe data/);
    const t = tally([{ gates: g }]);
    assert.deepEqual([t.pass, t.fail, t.skipped, t.exit(false), t.exit(true)], [0, 0, GATES.length, 0, 1]);
  }
});

test("gates: REQUIRED is default-deny; n/a only for touch and gap on a desktop capture", () => {
  const img = twoTone(40, 20, 2, "#ffffff", "#000000"), one = dump(ui({ rects: [R("x", 0, 0, 4, 4)] }));
  const g = evaluate(one, img, null);
  for (const k of REQUIRED) { assert.equal(g[k].status, "skipped", k); assert.match(g[k].note, /required, not declared/, k); }
  assert.deepEqual([g.record.status, g.touch.status, g.gap.status], ["pass", "n/a", "n/a"]);
  assert.deepEqual([tally([{ gates: g }]).exit(false), tally([{ gates: g }]).exit(true)], [0, 1], "a page that records one rect cannot pass --strict");
  const free = evaluate(one, img, null, NONE);
  assert.equal(free.chosen.status, "n/a", "only a screen row's exemption (need) turns a required gate into n/a");
  assert.equal(tally([{ gates: free }]).exit(true), 0);
  for (const n of ORDER) {
    const s = SCREENS[n];
    assert.deepEqual(s.need, REQUIRED.filter((k) => !s.exempt[k]), n);
    for (const [k, why] of Object.entries(s.exempt)) assert.ok(REQUIRED.includes(k) && why.trim(), n + " exempts " + k + " with a reason");
  }
  assert.deepEqual(REQUIRED, ["chosen", "band", "ring", "locked", "info", "text", "cap", "inside", "plate", "yellow"]);
});

test("gates: squint pairs and ring max", () => {
  const img = twoTone(40, 20, 2, "#ffffff", "#000000"), W = { x: 0, y: 0, w: 20, h: 20 }, B = { x: 20, y: 0, w: 20, h: 20 };
  const g = evaluate(dump(ui({ pairs: [{ kind: "chosen", a: W, b: B }, { kind: "band", a: W, b: W, name: "flat" }, { kind: "ring", a: W, b: B }] })), img, null, NONE);
  assert.equal(g.chosen.status, "pass"); assert.equal(g.chosen.value, 21); assert.equal(g.chosen.threshold, FLOOR.chosen);
  assert.equal(g.band.status, "fail"); assert.equal(g.band.value, 1); assert.match(g.band.on, /flat/);
  assert.equal(g.ring.status, "pass");
  assert.equal(tally([{ gates: g }]).exit(false), 1, "a real fail exits 1");
  const bad = evaluate(dump(ui({ pairs: [{ kind: "chosen", a: { x: null, y: 0, w: 4, h: 4 }, b: B, name: "nul" }] })), img, null, NONE);
  assert.deepEqual([bad.chosen.status, bad.chosen.on], ["fail", "nul"], "a null coordinate fails, never measures the corner");
  assert.match(bad.chosen.note, /non-finite/);
});

test("gates: locked texture sd on the lip, so an outline cannot pass a flat face", () => {
  /* 80 x 40 CSS at 2x: a flat #606060 face with a 2 px #000 outline, a striped face with the same outline, a faint floor cell, a white chosen part */
  const out = (x0, y0) => [[x0, x0 + 40, "#000000", y0, y0 + 2], [x0, x0 + 40, "#000000", y0 + 18, y0 + 20], [x0, x0 + 2, "#000000", y0, y0 + 20], [x0 + 38, x0 + 40, "#000000", y0, y0 + 20]];
  const stripes = (x0, y0, a, b) => Array.from({ length: 10 }, (_, i) => [x0 + i * 4, x0 + i * 4 + 4, i % 2 ? b : a, y0, y0 + 20]);
  const img = paint(80, 40, 2, "#606060", [...stripes(40, 0, "#404040", "#a0a0a0"), ...out(0, 0), ...out(40, 0), ...stripes(0, 20, "#505050", "#585858"), [40, 80, "#ffffff", 20, 40]]);
  const F = { x: 0, y: 20, w: 40, h: 20 }, C = { x: 40, y: 20, w: 40, h: 20 }, flat = { x: 0, y: 0, w: 40, h: 20 }, tex = { x: 40, y: 0, w: 40, h: 20 };
  const d = (a, name) => dump(ui({ box: { w: 80, h: 40, el: "sh" }, pairs: [{ kind: "locked", a, b: C, floor: F, name }] }), { size: [80, 40] });
  const sq = squint(img, 2);
  assert.ok(stat(sq, flat).sd / stat(sq, F).sd >= 2, "the whole outlined rect would clear 2x: the old reading passed a flat face");
  const g1 = evaluate(d(flat, "flat"), img, null, NONE);
  assert.deepEqual(g1.locked.items.map((i) => i.status), ["pass", "fail"], JSON.stringify(g1.locked.items));
  assert.equal(g1.locked.status, "fail"); assert.match(g1.locked.on, /flat texture sd/);
  const g2 = evaluate(d(tex, "tex"), img, null, NONE);
  assert.equal(g2.locked.status, "pass", JSON.stringify(g2.locked.items));
  assert.deepEqual(g2.locked.items[1].lip, { x: 43, y: 3, w: 8, h: 14 });
  const nf = evaluate(dump(ui({ box: { w: 80, h: 40, el: "sh" }, pairs: [{ kind: "locked", a: tex, b: C }] }), { size: [80, 40] }), img, null, NONE);
  assert.equal(nf.locked.status, "skipped", "a locked pair without o.floor leaves the texture unmeasured, a skip under --strict");
});

test("gates: info marks by their declared colour against the background's extreme, both branches, lock floor", () => {
  /* 60 x 20 CSS: black 0..20, grey #808080 20..40, white 40..60 */
  const img = paint(60, 20, 2, "#000000", [[20, 40, "#808080"], [40, 60, "#ffffff"]]), K = { x: 0, y: 0, w: 20, h: 20 }, G = { x: 20, y: 0, w: 20, h: 20 }, Wt = { x: 40, y: 0, w: 20, h: 20 };
  const at = { x: 5, y: 5, w: 4, h: 4 }, run = (pairs) => evaluate(dump(ui({ box: { w: 60, h: 20, el: "sh" }, pairs }), { size: [60, 20] }), img, null, NONE).info;
  const g = run([{ kind: "info", a: at, b: K, col: "#ffffff", name: "light" }, { kind: "info", a: at, b: Wt, col: "#000000", name: "dark" }, { kind: "info", a: at, b: G, col: "#fff", lock: true, name: "lock" }]);
  assert.equal(g.status, "pass", JSON.stringify(g.items));
  assert.deepEqual(g.items.map((i) => [i.on, i.light, i.value, i.threshold]), [["light", true, 21, 4.5], ["dark", false, 21, 4.5], ["lock", true, 3.95, 3]]);
  assert.deepEqual(run([{ kind: "info", a: at, b: G, col: "#ffffff" }]).value, 3.95, "4.5 without o.lock");
  assert.equal(run([{ kind: "info", a: at, b: G, col: "#ffffff" }]).status, "fail");
  assert.equal(run([{ kind: "info", a: Wt, b: K, col: "#101010", name: "dark on black" }]).status, "fail", "the dark branch fails too; a only locates the mark");
  assert.equal(run([{ kind: "info", a: at, b: K, col: "rgba(255,255,255,0.5)" }]).status, "fail", "a translucent colour cannot be judged");
});

test("gates: text by its declared colour on the text-hidden twin, the appendix method", () => {
  const cap = paint(60, 20, 2, "#ff00ff"), twin = paint(60, 20, 2, "#000000", [[20, 40, "#808080"], [40, 60, "#ffffff"]]);
  const d = (texts) => dump(ui({ box: { w: 60, h: 20, el: "sh" }, texts }), { size: [60, 20] });
  const g = evaluate(d([T("ON BLACK", 2, 5, 15, 10, { col: "#ffffff" }), T("ON GREY", 22, 5, 15, 10, { col: "#ffffff" }), T("LOCKED", 22, 5, 15, 10, { col: "#ffffff", lock: true }),
    T("DARK", 42, 5, 15, 10, { col: "#000" }), T("BARE", 42, 5, 15, 10)]), cap, twin, NONE);
  assert.deepEqual(g.text.items.map((i) => [i.on, i.status, i.value]), [["ON BLACK", "pass", 21], ["ON GREY", "fail", 3.95], ["LOCKED", "pass", 3.95], ["DARK", "pass", 21], ["BARE", "skipped", null]]);
  assert.equal(g.text.status, "fail"); assert.equal(g.text.on, "ON GREY");
  assert.equal(evaluate(d([T("BARE", 42, 5, 15, 10)]), cap, twin, NONE).text.status, "skipped", "a text without o.col is unmeasured, never a pass");
  assert.equal(evaluate(d([T("A", 2, 5, 15, 10, { col: "#fff" })]), cap, null, NONE).text.status, "skipped", "no twin, no text gate");
  assert.equal(evaluate(d([T("A", 2, 5, 15, 10, { col: "rgba(255,255,255,.4)" })]), cap, twin, NONE).text.status, "fail");
  assert.deepEqual([colOf("#fff").rgb, colOf("#ffd447ff").rgb, colOf("rgb(255, 212, 71)").rgb], [[255, 255, 255], [255, 212, 71], [255, 212, 71]]);
  for (const c of ["#ffd44780", "rgba(1,2,3,0.5)", "white", "rgb(300,0,0)", null]) assert.ok(colOf(c).err, String(c));
});

test("gates: box px are scaled onto the canvas content box (600 x 520 on 831 x 720)", () => {
  const cv = { c: { x: 10, y: 5, w: 831, h: 720 }, sh: null }, size = [850, 730], u = (o) => ui({ box: { w: 600, h: 520, el: "c" }, ...o });
  const img = paint(850, 730, 1, "#000000", [[149, 287, "#ffffff", 144, 212]]); // box (100, 100, 100, 50) mapped
  const g = evaluate(dump(u({ pairs: [{ kind: "chosen", a: { x: 110, y: 110, w: 60, h: 20 }, b: { x: 300, y: 300, w: 50, h: 50 } }], texts: [T("PLAY", 300, 300, 60, 10)] }), { size, dpr: 1, canvases: cv }), img, null, NONE);
  assert.equal(g.chosen.value, 21, "1:1 would sample black and read 1");
  assert.deepEqual([g.cap.status, g.cap.value], ["fail", 13.85], "10 box px is 13.85 CSS px");
  const t = evaluate(dump(u({ rects: [R("ok", 10, 10, 32, 32, { touch: true }), R("small", 100, 10, 31, 31, { touch: true })] }), { size, dpr: 1, canvases: cv, phone: true }), img, null, NONE);
  assert.deepEqual(t.touch.items.map((i) => [i.on, i.status, i.value]), [["ok", "pass", 44.31], ["small", "fail", 42.92]]);
  const p = evaluate(dump(u({ rects: [R("edge", 5, 100, 50, 50, { plate: true }), R("room", 20, 100, 50, 50, { plate: true })] }), { size, dpr: 1, canvases: cv }), img, null, NONE);
  assert.deepEqual([p.plate.status, p.plate.value, p.plate.on], ["fail", 1, "edge"], "T 16 CSS px is 11.55 box px: 5 is too close, 20 is not");
});

test("gates: plate, touch and gap, cap, inside, yellow, record", () => {
  const img = createRGBA(80, 40, "#000000");
  const pl = (rects) => evaluate(dump(ui({ rects })), img, null, NONE).plate;
  assert.deepEqual([pl([R("in", 20, 6, 4, 4, { plate: 2 })]).status, pl([R("in", 20, 6, 4, 4, { plate: 2 })]).value], ["pass", 0]);
  assert.deepEqual([pl([R("in", 20, 6, 4, 4, { plate: 2 }), R("out", 1, 1, 4, 4, { plate: true })]).status, pl([R("out", 1, 1, 4, 4, { plate: true })]).on], ["fail", "out"]);
  const ph = evaluate(dump(ui({ rects: [R("a", 0, 0, 44, 44, { touch: true, set: "s" }), R("b", 48, 0, 44, 44, { touch: true, set: "s" }), R("c", 0, 50, 30, 44, { touch: true, set: "t" }),
    R("free", 94, 0, 44, 44, { touch: true }), R("l1", 0, 100, 44, 44, { touch: true, set: "u", kind: "list" }), R("l2", 0, 145, 44, 44, { touch: true, set: "u", kind: "list" })] }), { phone: true }), img, null, NONE);
  assert.equal(ph.touch.status, "fail"); assert.equal(ph.touch.value, 30); assert.match(ph.touch.on, /\bc\b/);
  assert.equal(ph.gap.status, "fail"); assert.equal(ph.gap.value, 2); assert.equal(ph.gap.on, "b / free", "a target without a set is checked against every target");
  assert.ok(ph.gap.items.some((i) => i.on === "a / b" && i.value === 4) && !ph.gap.items.some((i) => i.on === "a / c" || i.on === "l1 / l2"), "two sets are apart; same-kind list members are exempt");
  const ok = evaluate(dump(ui({ rects: [R("a", 0, 0, 44, 44, { touch: true, set: "s" }), R("b", 52, 0, 44, 44, { touch: true, set: "s" })] }), { phone: true }), img, null, NONE);
  assert.deepEqual([ok.touch.status, ok.gap.status, ok.gap.value], ["pass", "pass", 8]);
  const ex = evaluate(dump(ui({ rects: [R("l1", 0, 0, 44, 44, { touch: true, set: "u", kind: "list" }), R("l2", 0, 45, 44, 44, { touch: true, set: "u", kind: "list" })] }), { phone: true }), img, null, NONE);
  assert.deepEqual([ex.gap.status, ex.gap.value], ["pass", null]); assert.match(ex.gap.note, /exempt/);
  assert.equal(evaluate(dump(ui({ rects: [R("a", 0, 0, 44, 44, { touch: true })] }), { phone: true }), img, null, NONE).gap.status, "skipped", "one target: no gap to measure");
  const dk = evaluate(dump(ui({ rects: [R("a", 0, 0, 10, 10, { touch: true })] })), img, null, NONE);
  assert.deepEqual([dk.touch.status, dk.gap.status], ["n/a", "n/a"], "desktop: no touch gates");
  const tx = evaluate(dump(ui({ texts: [T("PLAY", 1, 1, 20, 14.8), T("SUB", 1, 5, 20, 10.9, { role: "secondary" }), T("WIDE", 30, 1, 20, 14), T("NUL", null, 1, 4, 14)] })), img, null, NONE);
  assert.equal(tx.inside.status, "fail"); assert.equal(tx.inside.value, 2); assert.match(tx.inside.on, /WIDE/);
  assert.equal(tx.cap.status, "fail"); assert.equal(tx.cap.value, 10.9); assert.match(tx.cap.on, /SUB/);
  const pc = evaluate(dump(ui({ texts: [T("SUB", 1, 5, 20, 9.5, { role: "secondary" }), T("HUD", 1, 5, 20, 14.9, { role: "hud" }), T("Body", 1, 5, 20, 10, { role: "body", px: 15 })] }), { phone: true }), img, null, NONE);
  assert.equal(pc.cap.status, "pass", JSON.stringify(pc.cap));
  for (const t of [T("Who", 1, 1, 4, 14, { role: "title" }), T("Body", 1, 1, 4, 14, { role: "body" })]) assert.equal(evaluate(dump(ui({ texts: [t] })), img, null, NONE).cap.status, "fail", t.role + " " + t.px);
  assert.equal(CAP.d.primary, 14); assert.equal(CAP.p.body, 14.1);
  const yl = (rects) => evaluate(dump(ui({ rects })), img, null, NONE).yellow;
  const one = yl([R("play", 0, 0, 4, 4, { fill: "#FFD447" }), R("k", 5, 0, 4, 4, { fill: "#222" })]);
  assert.deepEqual([one.status, one.value, one.on], ["pass", 1, "play"], "only the yellow fill counts");
  assert.deepEqual([yl([R("main", 0, 0, 4, 4, { fill: "#ffd447" }), R("main", 5, 0, 4, 4, { fill: "#ffd447" })]).status, yl([R("main", 0, 0, 4, 4, { fill: "#ffd447" }), R("main", 5, 0, 4, 4, { fill: "#ffd447" })]).value], ["fail", 2], "two parts named main are two parts");
  assert.deepEqual([yl([R("play", 0, 0, 4, 4, { fill: "#ffd447" }), R("play", 0, 0, 4, 4, { fill: "#ffd447" })]).status, yl([R("play", 0, 0, 4, 4, { fill: "#ffd447" }), R("play", 0, 0, 4, 4, { fill: "#ffd447" })]).value], ["pass", 1], "one part drawn twice is one part");
  assert.equal(yl([R("play", 0, 0, 4, 4, { fill: "#ffd447" }), R("start", 5, 0, 4, 4, { fill: "rgb(255,212,71)" })]).value, 2, "rgb() counts");
  assert.equal(yl([R("glass", 0, 0, 4, 4, { fill: "rgba(255,212,71,0.5)" })]).status, "fail");
  assert.equal(evaluate(dump(ui({ rects: [R("x", 0, 0, 4, 4)], overflow: true })), img, null, NONE).record.status, "fail", "an overflowed record fails");
});

test("gates CLI: gates.json, exit 0 with skips, 1 under --strict, on a fail, on an empty dir, and on a capture shots.json lists but lacks", () => {
  const d = tmp();
  try {
    const run = (...a) => spawnSync(process.execPath, [join(UI, "gates.mjs"), d, ...a], { encoding: "utf8", timeout: 30000 });
    assert.equal(run().status, 1, "an empty dir is an error, never a pass");
    writeFileSync(join(d, "menu.2d.w1.png"), png(twoTone(40, 20, 2, "#ffffff", "#000000")));
    writeFileSync(join(d, "menu.2d.w1.json"), JSON.stringify(dump(null)));
    const r = run();
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stderr, /no shots\.json manifest/);
    const G = JSON.parse(readFileSync(join(d, "gates.json"), "utf8"));
    assert.deepEqual([G.summary.captures, G.summary.pass], [1, 0]);
    assert.equal(G.screens["menu.2d.w1"].gates.chosen.status, "skipped");
    assert.deepEqual(G.screens["menu.2d.w1"].need, SCREENS.menu.need);
    assert.equal(run("--strict").status, 1);
    writeFileSync(join(d, "shots.json"), JSON.stringify({ intended: ["menu.2d.w1", "level.2d.w1"], runs: [] }));
    const m = run();
    assert.equal(m.status, 1, "a screen shots.mjs meant to take and did not is an error");
    assert.match(JSON.parse(readFileSync(join(d, "gates.json"), "utf8")).summary.errors.join(), /level\.2d\.w1: listed in shots\.json, no capture/);
    writeFileSync(join(d, "shots.json"), JSON.stringify({ intended: ["menu.2d.w1"], runs: [] }));
    assert.equal(run().status, 0);
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

test("shots: the manifest lists every capture a run means to take, a union across runs into one dir", () => {
  const a = shotsArgs(["--screens", "menu,pause", "--look", "2d,px", "--world", "1,8", "--t125", "--phone"]);
  assert.deepEqual(intended(a), ["menu.2d.w1.t125.phone", "pause.2d.w1.t125.phone", "menu.2d.w8.t125.phone", "pause.2d.w8.t125.phone",
    "menu.px.w1.t125.phone", "pause.px.w1.t125.phone", "menu.px.w8.t125.phone", "pause.px.w8.t125.phone"]);
  const r1 = { n: 1 }, m1 = manifest(null, shotsArgs(["--screens", "menu"]), r1), r2 = { n: 2 }, m2 = manifest(JSON.parse(JSON.stringify(m1)), shotsArgs(["--screens", "level", "--t125"]), r2);
  assert.deepEqual(m1, { intended: ["menu.2d.w1"], runs: [r1] });
  assert.deepEqual(m2, { intended: ["menu.2d.w1", "level.2d.w1.t125"], runs: [{ n: 1 }, r2] });
  assert.deepEqual(manifest({ captures: ["old format"] }, shotsArgs(["--screens", "menu"]), r1).intended, ["menu.2d.w1"]);
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
