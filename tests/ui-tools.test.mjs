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
import { squint, stat, evaluate, tally, colOf, FLOOR, CAP, GATES, REQUIRED, EXEMPTABLE, MIN_SAMPLE } from "../tools/ui/lib/gatelib.mjs";
import { ORDER, SCREENS, canon, capName, parseCapName, needOf } from "../tools/ui/lib/screens.mjs";
import { refKeys, findRef, compareHtml } from "../tools/ui/lib/refs.mjs";
import { parseArgs as shotsArgs, intended, manifest, ledger } from "../tools/ui/shots.mjs";
import { SCREEN, ITEMS, OPT_ROWS, GUIDE_ROWS, createMenuApp } from "../src/app/menuapp.js";
import { createControlsPage } from "../src/app/controlspage.js";
import { DEF_CONTROLS } from "../src/app/controls.js";

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
  const OFF = { page: "", box: null, rects: [], texts: [], pairs: [], frames: 0, overflow: false, fault: null };
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
  P.pair("locked", { x: 0, y: 0, w: 4, h: 4 }, { x: 5, y: 5, w: 2, h: 2 }, { floor: { x: 9, y: 9, w: 2, h: 2 }, name: "lock" });
  assert.throws(() => P.pair("glow", { x: 0, y: 0 }, { x: 0, y: 0 }), /unknown pair kind/);
  const s = P.snapshot();
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s, "JSON round trip");
  assert.equal(s.page, "menu");
  assert.deepEqual(s.box, { w: 600, h: 520, dpr: 2, el: "sh" });
  assert.deepEqual(s.rects, [{ touch: true, set: "list", kind: "list", fill: "#ffd447", name: "play", x: 10, y: 20, w: 200, h: 44 }]);
  assert.equal(s.texts[0].role, "primary");
  assert.deepEqual(s.pairs[0].a, { x: 0, y: 0, w: 10, h: 10 });
  assert.deepEqual(s.pairs[1].b, { x: 5, y: 5, w: 2, h: 2 });
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
      ["8-digit hex, even ff", () => P.text("A", 0, 0, 1, 1, { col: "#ffd447ff" }), /colour/],
      ["channel over 255", () => P.rect("k", 0, 0, 1, 1, { fill: "rgb(256,0,0)" }), /colour/],
      ["a point pair: the mocks sample rects only", () => P.pair("chosen", { x: 0, y: 0 }, [0, 0, 4, 4]), /finite/],
      ["a zero-width region", () => P.pair("band", [0, 0, 0, 4], [0, 0, 4, 4]), /area/],
      ["a point floor", () => P.pair("locked", [0, 0, 4, 4], [0, 0, 4, 4], { floor: [9, 9, 0, 0] }), /area/],
      ["a negative rect height", () => P.rect("k", 0, 0, 4, -1), /area/],
      ["a negative cap height", () => P.text("A", 0, 0, 4, -1), /area/],
      ["an empty text box", () => P.text("A", 0, 0, 0, 10), /area/],
    ]) assert.throws(f, re, what);
    assert.match(P.snapshot().fault, /unknown role title/, "the first fault is kept in the record");
    P.begin("menu", { w: 600, h: 520, el: "c" });
    assert.match(P.snapshot().fault, /unknown role/, "begin keeps it: a fault stands until setOn");
    P.setOn(false); P.setOn(true);
    assert.equal(P.snapshot().fault, null);
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
    assert.deepEqual(s.need, EXEMPTABLE.filter((k) => !s.exempt[k]), n);
    for (const [k, why] of Object.entries(s.exempt)) assert.ok(EXEMPTABLE.includes(k) && why.trim(), n + " exempts " + k + " with a reason");
  }
  assert.deepEqual(REQUIRED, ["chosen", "band", "ring", "locked", "info", "text", "cap", "inside", "plate", "yellow"]);
  assert.deepEqual(EXEMPTABLE, [...REQUIRED, "touch", "gap"]);
  assert.deepEqual(needOf("title", { touch: "tap anywhere starts", gap: "no tap targets of its own" }), REQUIRED, "a row can exempt touch and gap");
  for (const ex of [{ record: "x" }, { touch: "" }, { glow: "x" }]) assert.throws(() => needOf("t", ex), /reason|EXEMPTABLE/, JSON.stringify(ex));
  const ph = dump(ui({ rects: [R("x", 0, 0, 4, 4)] }), { phone: true });
  assert.deepEqual([evaluate(ph, img, null).touch.status, evaluate(ph, img, null).gap.status], ["skipped", "skipped"], "phone: no targets declared is a skip");
  assert.deepEqual([evaluate(ph, img, null, needOf("t", { touch: "tap anywhere", gap: "tap anywhere" })).touch.status, evaluate(ph, img, null, needOf("t", { touch: "tap anywhere", gap: "tap anywhere" })).gap.status], ["n/a", "n/a"], "unless the screen row exempts them");
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
  assert.deepEqual([colOf("#fff").rgb, colOf("rgba(255,212,71,1)").rgb, colOf("rgb(255, 212, 71)").rgb], [[255, 255, 255], [255, 212, 71], [255, 212, 71]]);
  for (const c of ["#ffd44780", "#ffd447ff", "rgba(1,2,3,0.5)", "white", "rgb(300,0,0)", "rgb(1.5,2,3)", null]) assert.ok(colOf(c).err, String(c));
  /* the probe and colOf agree on every colour: the stricter syntax, no 8-digit hex */
  P.setOn(true);
  try {
    for (const c of ["#fff", "#FFD447", "#ffd447ff", "#ffd44780", "rgb(255,212,71)", "rgba(255, 212, 71, 1)", "rgba(255,212,71,1.0)", "rgba(255,212,71,.5)", "rgb(256,0,0)", "rgb(1.5,2,3)", "hsl(0,0%,0%)", "white", ""]) {
      let threw = false;
      try { P.text("A", 0, 0, 1, 1, { col: c }); } catch { threw = true; }
      assert.equal(threw, !!colOf(c).err, c);
    }
  } finally { P.setOn(false); }
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
  assert.equal(evaluate(dump(ui({ rects: [R("a", 0, 0, 44, 44, { touch: true })] }), { phone: true }), img, null).gap.status, "skipped", "one target: no gap to measure");
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

test("gates: a faulted, overflowed or unjudgeable capture fails record in both modes", () => {
  const img = twoTone(40, 20, 2, "#ffffff", "#000000"), W = { x: 0, y: 0, w: 20, h: 20 }, B = { x: 20, y: 0, w: 20, h: 20 };
  const all = { pairs: [{ kind: "chosen", a: W, b: B }, { kind: "band", a: W, b: B }, { kind: "ring", a: W, b: B }, { kind: "locked", a: W, b: B, floor: B }, { kind: "info", a: W, b: B, col: "#fff" }],
    rects: [R("p", 10, 6, 4, 4, { plate: 1, fill: "#ffd447" })], texts: [T("A", 1, 1, 10, 14.8, { col: "#fff" })] };
  const faulted = evaluate(dump(ui({ ...all, fault: "kit probe: text \"B\" col is not an opaque #rrggbb, #rgb, rgb() or rgba(.., 1) colour: rgba(255,255,255,0.5)" })), img, img, NONE);
  assert.equal(faulted.record.status, "fail"); assert.match(faulted.record.note, /probe fault/);
  assert.deepEqual([tally([{ gates: faulted }]).exit(false), tally([{ gates: faulted }]).exit(true)], [1, 1], "every required gate has data, yet the half-drawn page cannot pass");
  const early = evaluate(dump(ui({ fault: "kit probe: box w is not a finite number: NaN" })), img, null);
  assert.equal(early.record.status, "fail", "a fault before any entry is still an instrumented capture");
  for (const dpr of [null, undefined, NaN, 0, "2"]) {
    const g = evaluate({ ...dump(ui(all)), flags: { ...dump(null).flags, dpr } }, img, img, NONE);
    assert.deepEqual([g.record.status, g.chosen.status, g.text.status], ["fail", "fail", "fail"], "dpr " + dpr + " is never read as 1");
    assert.equal(evaluate({ ...dump(null), flags: { ...dump(null).flags, dpr } }, img, null).record.status, "fail", "even with no probe data");
  }
  const cv = evaluate(dump(ui(all), { canvases: { sh: { x: 0, y: NaN, w: 40, h: 20 } } }), img, img, NONE);
  assert.deepEqual([cv.chosen.status, cv.cap.status, cv.plate.status], ["fail", "fail", "fail"]); assert.match(cv.chosen.note, /canvas rect/);
  const bx = evaluate(dump(ui({ ...all, box: { w: 0, h: 20, el: "sh" } })), img, img, NONE);
  assert.deepEqual([bx.chosen.status, bx.inside.status, bx.plate.status], ["fail", "fail", "fail"], "a page box without area fails");
});

test("gates: regions need area, and a measured sample at least 4 x 4 CSS px", () => {
  const img = paint(80, 40, 2, "#606060", [[40, 80, "#ffffff", 20, 40]]), C = { x: 40, y: 20, w: 40, h: 20 }, face = { x: 0, y: 0, w: 40, h: 20 };
  const g = (pairs, o) => evaluate(dump(ui({ box: { w: 80, h: 40, el: "sh" }, pairs }), { size: [80, 40], ...o }), img, null, NONE);
  const pf = g([{ kind: "locked", a: face, b: C, floor: { x: 9, y: 30, w: 0, h: 0 }, name: "pt" }]).locked;
  assert.deepEqual([pf.status, pf.items[1].status], ["fail", "fail"], "a point floor (sd 0, divisor 1e-4) is never a pass"); assert.match(pf.items[1].note, /without area/);
  const sf = g([{ kind: "locked", a: face, b: C, floor: { x: 0, y: 30, w: 3, h: 3 } }]).locked;
  assert.equal(sf.status, "fail"); assert.match(sf.items[1].note, /too small to measure/);
  const sl = g([{ kind: "locked", a: { x: 0, y: 0, w: 15, h: 20 }, b: C, floor: { x: 0, y: 24, w: 30, h: 10 } }]).locked;
  assert.equal(sl.status, "fail"); assert.match(sl.items[1].note, /lip .* too small/, "a 15 px part has a 3 px lip");
  assert.equal(MIN_SAMPLE, 4);
  const ib = g([{ kind: "info", a: { x: 50, y: 25, w: 4, h: 4 }, b: { x: 0, y: 0, w: 3, h: 3 }, col: "#fff" }]).info;
  assert.equal(ib.status, "fail"); assert.match(ib.note, /too small/);
  for (const [k, a] of [["chosen", { x: 0, y: 0, w: 0, h: 10 }], ["band", { x: 0, y: 0, w: 10, h: -2 }]]) {
    const r = g([{ kind: k, a, b: C }])[k];
    assert.equal(r.status, "fail", k); assert.match(r.note, /without area/);
  }
  const tx = evaluate(dump(ui({ texts: [T("NEG", 30, 1, -40, 10), T("ZERO", 1, 1, 10, 0)] })), img, null, NONE);
  assert.deepEqual([tx.inside.status, tx.inside.value, tx.cap.status], ["fail", 2, "fail"], "a negative w cannot hide an overflow");
  const rt = evaluate(dump(ui({ rects: [R("k", 0, 0, 0, 4, { fill: "#ffd447" })] })), img, null, NONE);
  assert.equal(rt.yellow.status, "fail");
});

test("gates: gap across sets: apart is not measured (and the note says so), overlapping fails", () => {
  const img = createRGBA(80, 40, "#000000"), gap = (rects) => evaluate(dump(ui({ rects }), { phone: true }), img, null, NONE).gap;
  const apart = gap([R("tab", 0, 0, 44, 44, { touch: true, set: "tabs" }), R("row", 0, 46, 44, 44, { touch: true, set: "rows" })]);
  assert.deepEqual([apart.status, apart.value], ["pass", null]); assert.match(apart.note, /1 across sets, 0 exempt/);
  const over = gap([R("tab", 0, 0, 44, 44, { touch: true, set: "tabs" }), R("row", 20, 20, 44, 44, { touch: true, set: "rows" })]);
  assert.deepEqual([over.status, over.on], ["fail", "tab / row"]); assert.match(over.note, /two sets overlap/);
  const inside = gap([R("plate", 0, 0, 200, 200, { touch: true, set: "back" }), R("key", 20, 20, 44, 44, { touch: true, set: "keys" })]);
  assert.equal(inside.status, "fail", "nesting across sets is an overlap too");
});

test("gates: an info mark inside its background is masked out of b", () => {
  /* a black 20 x 20 CSS field with a white 4 x 4 mark painted in its middle */
  const img = paint(40, 20, 2, "#000000", [[8, 12, "#ffffff", 8, 12]]), field = { x: 0, y: 0, w: 20, h: 20 }, mark = { x: 8, y: 8, w: 4, h: 4 };
  const g = (a, b) => evaluate(dump(ui({ pairs: [{ kind: "info", a, b, col: "#ffffff", name: "chevron" }] })), img, null, NONE).info;
  const m = g(mark, field);
  assert.deepEqual([m.status, m.value, m.items[0].masked > 0], ["pass", 21, true], "unmasked, the mark itself would be b's brightest pixel and read 1");
  const nothing = g(mark, mark);
  assert.equal(nothing.status, "fail"); assert.match(nothing.note, /nothing of b is left/);
});

test("gates CLI: gates.json, exit 0 with skips, 1 under --strict, on a fail, on an empty dir; a stale gates.json never survives", () => {
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
    const readG = () => JSON.parse(readFileSync(join(d, "gates.json"), "utf8")), good = png(twoTone(40, 20, 2, "#ffffff", "#000000"));
    writeFileSync(join(d, "gates.json"), JSON.stringify({ summary: { exit: 0 }, stale: true }));
    writeFileSync(join(d, "menu.2d.w1.png"), Buffer.from("not a png at all"));
    assert.equal(run().status, 1, "a corrupt PNG is an error for its capture");
    assert.ok(readG().screens["menu.2d.w1"].error && !readG().stale, "the earlier gates.json is gone");
    writeFileSync(join(d, "menu.2d.w1.png"), good);
    writeFileSync(join(d, "menu.2d.w1.json"), "{ half a dump");
    assert.equal(run().status, 1, "a dump that does not parse is an error for its capture");
    writeFileSync(join(d, "menu.2d.w1.json"), JSON.stringify(dump(null)));
    writeFileSync(join(d, "gates.json"), JSON.stringify({ summary: { exit: 0 }, stale: true }));
    writeFileSync(join(d, "shots.json"), "{ not json");
    assert.equal(run().status, 1, "an unreadable manifest aborts");
    assert.deepEqual([readG().summary.exit, typeof readG().error, readG().stale], [1, "string", undefined], "an aborted run overwrites gates.json with error and why");
    rmSync(join(d, "shots.json"));
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

test("shots: the manifest keeps every run, the latest last, each with what it meant to take", () => {
  const a = shotsArgs(["--screens", "menu,pause", "--look", "2d,px", "--world", "1,8", "--t125", "--phone"]);
  assert.deepEqual(intended(a), ["menu.2d.w1.t125.phone", "pause.2d.w1.t125.phone", "menu.2d.w8.t125.phone", "pause.2d.w8.t125.phone",
    "menu.px.w1.t125.phone", "pause.px.w1.t125.phone", "menu.px.w8.t125.phone", "pause.px.w8.t125.phone"]);
  const r1 = { n: 1 }, m1 = manifest(null, r1), r2 = { n: 2 };
  assert.deepEqual(m1, { runs: [r1] });
  assert.deepEqual(manifest(JSON.parse(JSON.stringify(m1)), r2), { runs: [{ n: 1 }, r2] });
  assert.deepEqual(manifest({ intended: ["old format"] }, r1), { runs: [r1] });
  assert.match(readFileSync(join(UI, "shots.mjs"), "utf8"), /rmSync\(join\(a\.out, n \+ ext\)/, "each intended capture's files are deleted before the run takes it");
  assert.match(readFileSync(join(UI, "shots.mjs"), "utf8"), /rep\.done = true; \/\/ completed/, "done is set only when the loop completed, never in finally");
});

test("shots: the ledger charges a page error to the capture it falls in, else to the run", () => {
  const rep = { captures: [], failed: {}, errors: [] }, errs = [], L = ledger(rep, "2d.w1", errs);
  errs.push("exception: boot");
  L.flush("at boot");
  L.close("title.2d.w1");
  errs.push("exception: kit probe: text \"A\" col is not an opaque ...");
  L.close("menu.2d.w1");
  L.fail("level.2d.w1", "expected LEVEL, got MENU (no capture)");
  L.close("level.2d.w1");
  errs.push("warning: between");
  L.flush("outside a capture");
  L.close("pause.2d.w1");
  assert.deepEqual(rep.captures, ["title.2d.w1", "pause.2d.w1"]);
  assert.deepEqual(Object.keys(rep.failed), ["menu.2d.w1", "level.2d.w1"]);
  assert.match(rep.failed["menu.2d.w1"], /page error while the capture was reached, settled or taken: exception: kit probe/);
  assert.deepEqual(rep.errors.map((e) => e.split(":")[0]), ["2d.w1", "menu.2d.w1", "level.2d.w1", "2d.w1"], "boot and between-capture errors are the run's");
});

test("gates: only the latest run is judged; a stale capture or a failed one can never pass", () => {
  const d = tmp();
  try {
    const run = (...a) => spawnSync(process.execPath, [join(UI, "gates.mjs"), d, ...a], { encoding: "utf8", timeout: 30000 }), readG = () => JSON.parse(readFileSync(join(d, "gates.json"), "utf8"));
    const put = (n) => { writeFileSync(join(d, n + ".png"), png(twoTone(40, 20, 2, "#ffffff", "#000000"))); writeFileSync(join(d, n + ".json"), JSON.stringify({ ...dump(null), screen: n.split(".")[0], file: n + ".png" })); };
    const r = (o) => ({ flags: {}, intended: [], captures: [], failed: {}, errors: [], warnings: [], done: true, ...o });
    const man = (...runs) => writeFileSync(join(d, "shots.json"), JSON.stringify({ runs }));
    put("menu.2d.w1"); put("level.2d.w1");
    man(r({ intended: ["level.2d.w1"], captures: ["level.2d.w1"] }), r({ intended: ["menu.2d.w1", "level.2d.w1"], captures: ["menu.2d.w1"], failed: { "level.2d.w1": "expected LEVEL, got MENU (no capture)" }, errors: ["level.2d.w1: expected LEVEL, got MENU (no capture)"] }));
    for (const f of [[], ["--strict"]]) assert.equal(run(...f).status, 1, "run 1's level capture cannot stand in for the one run 2 failed " + f);
    const G = readG();
    assert.match(G.summary.errors.join("\n"), /level\.2d\.w1: not taken by the latest run \(expected LEVEL, got MENU/);
    assert.equal(G.summary.captures, 1, "only menu is judged");
    assert.equal(G.screens["level.2d.w1"].gates, undefined);
    assert.match(G.summary.warnings.join("\n"), /level\.2d\.w1: in the dir but not taken by the latest run, ignored/);
    man(r({ intended: ["menu.2d.w1"], captures: ["menu.2d.w1"] }));
    assert.equal(run().status, 0, "a clean latest run with skips only: exit 0 by default");
    assert.equal(readG().summary.captures, 1, "the stray level dump is ignored, never judged");
    man(r({ intended: ["menu.2d.w1"], captures: [], failed: { "menu.2d.w1": "page error while the capture was reached, settled or taken: exception: kit probe ..." }, errors: ["menu.2d.w1: page error ..."] }));
    assert.equal(run().status, 1, "a capture with a page exception fails in both modes");
    man(r({ intended: ["menu.2d.w1"], captures: ["menu.2d.w1"], done: false }));
    assert.equal(run().status, 1, "a run that did not complete fails");
    assert.match(readG().summary.errors.join(), /did not complete/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

/* A recipe cannot rot silently (Task 2.2 fix round 1: RECORDS moved STATS / MEDALS off MENU and the medals recipe stopped reaching
   MEDALS). Every screen's recipe is walked through the REAL menu app the way shots.mjs walks the page: from MENU (__GAME__.reset), each
   of menu / opt / guide picks the first row in that table whose label the recipe lists and confirms, then the keys are pressed in order
   (the phone path's app.key); the screen reached must be the recipe's state. A run screen starts from MENU PLAY. No browser. */
test("screens: every recipe reaches its state through the real menu app", () => {
  const PICK = [["menu", "cursor", ITEMS], ["opt", "optRow", OPT_ROWS], ["guide", "guideRow", GUIDE_ROWS]];
  const nameOf = (s) => Object.keys(SCREEN).find((k) => SCREEN[k] === s);
  const page = () => createControlsPage({ get: () => DEF_CONTROLS, set() {}, padView: () => ({ state: "none" }), say() {} });
  for (const n of ORDER) {
    const R = SCREENS[n], a = createMenuApp({ controls: page() });
    if (n === "title") { assert.equal(nameOf(a.screen), R.state, n); continue; }
    a.skip();
    assert.equal(a.screen, SCREEN.MENU, n + ": MENU after the show");
    if (R.run) {
      a.cursor = ITEMS.indexOf("PLAY");
      a.confirm();
      assert.equal(a.screen, SCREEN.GAME, n + ": MENU PLAY starts the run");
      assert.ok(["PLAY", "PAUSE", "WIN", "LOSE"].includes(R.state) && R.run.toUpperCase() === R.state, n + ": a run screen's state is its world state");
      continue;
    }
    a.toMenu();
    for (const [f, field, rows] of PICK) {
      if (!R[f]) continue;
      const i = rows.findIndex((x) => R[f].includes(x));
      assert.ok(i >= 0, n + ": no " + R[f].join(" / ") + " row in " + f);
      a[field] = i;
      a.confirm();
    }
    for (const k of [].concat(R.key || [])) a.key(k);
    assert.equal(nameOf(a.screen), R.state, n + ": reached " + nameOf(a.screen));
  }
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
