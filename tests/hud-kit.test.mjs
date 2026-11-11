// The HUD on the world kit (UI upgrade Task 8.2, round 5 09-hud): seven labelled chips in order above the board, the power-ups bar below it, all on
// #hud and never on the board; values at the HUD size (cap >= 18 desktop, >= 11 phone) at text scale 1 and 1.25; LEVEL and the difficulty words
// (R9); an idle frame makes no canvas call; the board canvases draw no HUD (the CLASSIC hash drops exactly the old HUD segment).
import test from "node:test";
import assert from "node:assert/strict";
import { rec } from "./lib/textrec.mjs";
import { hudGeo, mountFit } from "../src/app/fit.js";
import { CAPR, CHIP_NAMES, HUD, createHud, drawHud, hudGeom, hudState } from "../src/render/hud.js";
import { HUD_CHIPS, DIFF } from "../src/render/words.js";
import { worldTokens } from "../src/render/kit/tokens.js";
import { setTextScale } from "../src/render/kit/type.js";
import { initFx, feedFx } from "../src/render/fx.js";
import { createRenderer } from "../src/render/renderer.js";
import * as P from "../src/render/kit/probe.js";
import { hints, setHints } from "../src/render/hintcopy.js";

const W0 = (o = {}) => ({ state: "PLAY", lives: 3, level: 3, heat: 0, score: 1240, enemies: [1, 2, 3, 4], players: [{ bombs: 2, range: 3, speed: 0 }], ...o });
const ALL = { shield: true, kick: true, throw: true, passing: true, bombKind: "pierce", remote: true, speed: 999 };
const LONG = (o = {}) => W0({ lives: 9, heat: 2, score: 1234567, enemies: Array.from({ length: 12 }, (_, i) => i), players: [{ bombs: 8, range: 8, ...ALL }], ...o });
const BOXES = [["d", 1366, 768], ["d", 1366, 657], ["d", 1280, 720], ["d", 1024, 768], ["d", 1920, 1080], ["d", 1024, 640], ["p", 393, 852], ["p", 375, 667], ["p", 430, 932], ["l", 844, 390], ["l", 667, 375], ["l", 932, 430]];
const geoOf = (lay, W, H) => hudGeo(W, H, 600, 520, lay, true);
const paint = (lay, W, H, world, o = {}) => {
  const r = rec(o.rec || {}), geo = geoOf(lay, W, H), st = hudState(world, { time: { t: o.t ?? 31.4 } }), G = hudGeom(r.ctx, geo, st, { w: W, h: H });
  drawHud(r.ctx, G, st, worldTokens(world.level), { px: false });
  return { r, G, st, geo };
};
const inside = (a, b) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;
const off = (a, b) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

test("seven labelled chips in order: LIVES BOMBS FLAME LEVEL ENEMIES TIME SCORE (LEVEL, never LV)", () => {
  assert.deepEqual(HUD_CHIPS, ["LIVES", "BOMBS", "FLAME", "LEVEL", "ENEMIES", "TIME", "SCORE"]);
  assert.deepEqual(CHIP_NAMES, ["lives", "bombs", "flame", "level", "enemies", "time", "score"]);
  for (const [lay, W, H] of BOXES) {
    const { r, G } = paint(lay, W, H, W0());
    const labels = r.texts.filter((t) => HUD_CHIPS.includes(t.s)).map((t) => t.s);
    assert.deepEqual(labels, HUD_CHIPS, `${lay} ${W}x${H}`);
    const xs = CHIP_NAMES.map((n) => G.chips[n]);
    if (lay === "d") assert.ok(xs.every((q, i) => !i || q.x > xs[i - 1].x + xs[i - 1].w), "one row left to right");
    if (lay === "p") assert.ok(G.chips.lives.y === G.chips.flame.y && G.chips.level.y > G.chips.lives.y && G.chips.score.x > G.chips.time.x && G.pause && G.pause.y === G.chips.lives.y, "the round 5 grid: three over four, PAUSE in column 4");
    assert.ok(!r.texts.some((t) => /^(LV|CORE|PLUS|MAX|· CORE)$/.test(t.s)), "no old HUD word");
  }
});

test("the difficulty word sits by the level only off NORMAL (R9), and LIVES follows kit5 lives(): up to five hearts, else one heart and the count", () => {
  for (const h of [0, 1, 2]) {
    const { r } = paint("d", 1366, 768, W0({ heat: h }));
    const ws = r.texts.map((t) => t.s);
    assert.equal(ws.includes(DIFF[1]) || ws.includes(DIFF[2]), h > 0, "heat " + h);
    if (h) assert.ok(ws.includes(DIFF[h]));
  }
  const n5 = paint("d", 1366, 768, W0({ lives: 5 })), n6 = paint("d", 1366, 768, W0({ lives: 6 }));
  assert.ok(!n5.r.texts.some((t) => t.s === "5"), "five lives are five hearts");
  assert.ok(n6.r.texts.some((t) => t.s === "6"), "six lives are a heart and 6");
});

test("HUD values at the HUD size: cap >= 18 desktop, >= 11 phone, at text scale 1 and 1.25, every string whole in its chip", () => {
  for (const k of [1, 1.25]) {
    setTextScale(k);
    try {
      for (const [lay, W, H] of BOXES) for (const w of [W0(), LONG()]) {
        const { r, G, geo } = paint(lay, W, H, w, { t: 599.9 });
        const vals = r.texts.filter((t) => /^800 /.test(t.font));
        assert.ok(vals.length > 0);
        const floor = lay === "d" ? 18 : 11;
        for (const t of vals) { const px = +/(\d+(?:\.\d+)?)px/.exec(t.font)[1]; assert.ok(px * CAPR.num >= floor - 0.05, `${lay} ${W}x${H} @${k}: ${t.s} at ${px}px`); }
        for (const n of CHIP_NAMES) {
          const c = G.chips[n];
          assert.ok(r.texts.filter((t) => t.y >= c.y && t.y <= c.y + c.h && t.x >= c.x - 1 && t.x < c.x + c.w).every((t) => { const x0 = t.align === "center" ? t.x - t.w / 2 : t.x; return x0 >= c.x - 0.5 && x0 + t.w <= c.x + c.w + 0.5; }), `${lay} ${W}x${H} @${k}: ${n} text whole`);
        }
        const all = [G.plate, ...(G.cols || []), ...Object.values(G.chips), G.bar].filter(Boolean);
        assert.ok(all.every((q) => q.x >= 0 && q.y >= 0 && q.x + q.w <= W + 0.5 && q.y + q.h <= H + 0.5), `${lay} ${W}x${H} @${k}: in the viewport`);
        assert.ok(all.every((q) => off(q, geo.stage)), `${lay} ${W}x${H} @${k}: nothing on the board`);
        if (G.bar) assert.ok(G.bar.items.every((q) => inside(q, G.bar)), `${lay} ${W}x${H} @${k}: power-ups inside the bar`);
        if (lay === "d") assert.ok(G.plate.y + G.plate.h + HUD.d.ring <= geo.stage.y + 1e-6 && (!G.bar || G.bar.y >= geo.stage.y + geo.stage.h), `${lay} ${W}x${H}: chips above, power-ups below`);
      }
    } finally { setTextScale(1); }
  }
});

test("power-ups: the held ones in order with key caps on a keyboard layout; a hit's ghost dims; nothing held paints no bar", () => {
  const none = paint("d", 1366, 768, W0());
  assert.equal(none.G.bar, null);
  const { r, G } = paint("d", 1366, 768, W0({ players: [{ bombs: 2, range: 3, kick: true, throw: true, remote: true }] }));
  const ws = r.texts.map((t) => t.s);
  assert.ok(G.bar && G.bar.items.length === 3);
  assert.ok(ws.indexOf("KICK") < ws.indexOf("THROW") && ws.indexOf("THROW") < ws.indexOf("REMOTE"));
  assert.ok(ws.includes("E") && ws.includes("Q"), "THROW E, REMOTE Q (label first, keycap last)");
  assert.ok(ws.indexOf("E") > ws.indexOf("THROW"));
  setHints({ ...hints(), dev: "touch", tapPage: true });
  const ph = paint("p", 393, 852, W0({ players: [{ bombs: 2, range: 3, throw: true }] }));
  assert.ok(!ph.r.texts.some((t) => t.s === "E"), "no key caps for a touch player");
  setHints({ ...hints(), dev: "pad", throw: "WEST", remote: "EAST", tapPage: false });
  for (const [lay, W, H] of [["d", 1366, 768], ["p", 393, 852]]) {
    const pd = paint(lay, W, H, W0({ players: [{ bombs: 2, range: 3, throw: true, remote: true }] })), ws = pd.r.texts.map((t) => t.s);
    assert.ok(ws.indexOf("WEST") > ws.indexOf("THROW") && ws.indexOf("EAST") > ws.indexOf("REMOTE"), lay + ": a controller player gets the bound buttons as caps, label first");
  }
  setHints(null);
  initFx();
  const w = W0({ players: [{ bombs: 2, range: 3, kick: true }] });
  feedFx(w, 1 / 60);
  w.players[0].kick = false;
  feedFx(w, 1 / 60);
  const g = paint("d", 1366, 768, w);
  assert.ok(g.G.bar && g.r.paints.some((q) => q.alpha > 0 && q.alpha < 1), "the stripped KICK fades dimmed");
  initFx();
});

test("the pulse: a changed BOMBS value rings its chip for the pulse time, then nothing; LIVES and BOMBS pulsing together never meet", () => {
  initFx();
  const w = W0();
  feedFx(w, 1 / 60);
  w.players[0].bombs = 3;
  feedFx(w, 1 / 60);
  const { r, G } = paint("d", 1366, 768, w), b = G.chips.bombs;
  assert.ok(r.paints.some((q) => q.op === "stroke" && q.style === "#ff5d73" && q.box && inside(q.box, b)), "BOMBS pulses, a ring inside its chip");
  w.lives = 9;
  feedFx(w, 1 / 60);
  const two = paint("d", 1366, 768, w), lr = two.r.paints.find((q) => q.op === "stroke" && q.style === "#ff3b5c"), br = two.r.paints.find((q) => q.op === "stroke" && q.style === "#ff5d73");
  assert.ok(lr && br && lr.box.x + lr.box.w + 1.5 <= br.box.x - 1.5, "the LIVES ring ends before the BOMBS ring, strokes included");
  for (let i = 0; i < 60; i++) feedFx(w, 1 / 60);
  assert.ok(!paint("d", 1366, 768, w).r.paints.some((q) => q.op === "stroke" && q.style === "#ff5d73"), "gone after LBL.pulse");
  initFx();
});

test("no yellow part: #ffd447 appears only as a glyph's own accent (a flame tongue, a fuse spark), never a chip, plate or bar fill", () => {
  for (const [lay, W, H] of BOXES) {
    const { r, G } = paint(lay, W, H, LONG()), parts = [...Object.values(G.chips), ...(G.bar ? G.bar.items : [])];
    const y = r.paints.filter((q) => /ffd447/i.test(String(q.style)));
    assert.ok(y.every((q) => q.box && q.box.w <= 26 && q.box.h <= 26 && parts.some((c) => inside(q.box, c))), lay + " " + W + " " + JSON.stringify(y.find((q) => !(q.box && q.box.w <= 26)) || null));
  }
});

test("createHud: paints on a change only, so an idle frame (PAUSE, a still TIME) makes no canvas call; off GAME hides #hud once", () => {
  const r = rec(), geo = geoOf("d", 1366, 768), log = [];
  let hidden = true;
  const fit = { hudGeo: () => geo, hud: (on) => { log.push(on); if (!on) { hidden = true; return null; } hidden = false; return { ctx: r.ctx, geo, w: 1366, h: 768, el: { width: 2732 } }; } };
  const hud = createHud(), w = W0(), o = (t) => ({ time: { t } });
  hud.frame(fit, w, o(1), "2d");
  const n1 = r.calls.length;
  assert.ok(n1 > 0 && !hidden);
  hud.frame(fit, w, o(1.04), "2d");
  assert.equal(r.calls.length, n1, "same tenth of a second: nothing");
  w.state = "PAUSE";
  hud.frame(fit, w, o(1.04), "2d");
  const n2 = r.calls.length;
  hud.frame(fit, w, o(1.04), "2d");
  hud.frame(fit, w, o(1.04), "2d");
  assert.equal(r.calls.length, n2, "a held PAUSE: nothing");
  w.state = "PLAY";
  hud.frame(fit, w, o(1.1), "2d");
  assert.ok(r.calls.length > n2, "TIME ticks: one repaint");
  hud.frame(fit, null, null, "2d");
  hud.frame(fit, null, null, "2d");
  assert.equal(log.filter((v) => !v).length, 1, "hidden once");
  assert.ok(hidden);
});

test("createHud repaints after #hud's backing is reassigned (a dpr change clears the canvas), even with nothing else changed", () => {
  const r = rec(), geo = geoOf("d", 1366, 768);
  let gen = 0;
  const fit = { hudGeo: () => geo, hudGen: () => gen, hud: () => ({ ctx: r.ctx, geo, w: 1366, h: 768, el: { width: 2732 } }) }, hud = createHud(), w = W0({ state: "PAUSE" });
  hud.frame(fit, w, { time: { t: 1 } }, "2d");
  const n = r.calls.length;
  hud.frame(fit, w, { time: { t: 1 } }, "2d");
  assert.equal(r.calls.length, n);
  gen++;
  hud.frame(fit, w, { time: { t: 1 } }, "2d");
  assert.ok(r.calls.length > n, "a new backing repaints the held PAUSE HUD");
});

test("fit bumps hudGen when it reassigns #hud's backing (a dpr change with no resize)", () => {
  const hud = { width: 300, height: 150, hidden: true, style: {}, dataset: {}, getContext: () => ({ setTransform() {} }) }, mq = [];
  globalThis.window = { innerWidth: 1366, innerHeight: 768, addEventListener() {}, matchMedia: (m) => { const e = { m, addEventListener(t, f) { e.f = f; } }; mq.push(e); return e; } };
  globalThis.document = { getElementById: (id) => (id === "hud" ? hud : null), body: { setAttribute() {}, style: { setProperty() {} } } };
  globalThis.devicePixelRatio = 2;
  try {
    const fit = mountFit({ width: 600, height: 520, style: {} }), g0 = fit.hudGen();
    globalThis.devicePixelRatio = 1; mq[0].f();
    assert.ok(fit.hudGen() > g0 && hud.width === 1366);
    const g1 = fit.hudGen(); fit();
    assert.equal(fit.hudGen(), g1, "an unchanged backing bumps nothing");
  } finally { delete globalThis.window; delete globalThis.document; delete globalThis.devicePixelRatio; }
});

test("createHud records page hud into the probe while PLAYing (rects, hud / secondary texts, the plate's ring)", () => {
  P.setOn(true);
  try {
    const r = rec(), geo = geoOf("d", 1366, 768);
    const fit = { hudGeo: () => geo, hud: () => ({ ctx: r.ctx, geo, w: 1366, h: 768, el: { width: 2732 } }) };
    createHud().frame(fit, W0(), { time: { t: 3 } }, "2d");
    const s = P.snapshot();
    assert.equal(s.page, "hud");
    assert.deepEqual(s.box, { w: 1366, h: 768, dpr: 2, el: "hud" });
    assert.ok(s.rects.some((q) => q.name === "plate" && q.plate === HUD.d.ring));
    assert.ok(s.texts.some((t) => t.role === "hud") && s.texts.some((t) => t.role === "secondary"));
    assert.ok(s.pairs.some((q) => q.kind === "info"));
    for (const [lay, W, H] of [["p", 393, 852], ["l", 844, 390], ["l", 667, 375]]) {
      const r2 = rec(), g2 = geoOf(lay, W, H);
      createHud().frame({ hudGeo: () => g2, hud: () => ({ ctx: r2.ctx, geo: g2, w: W, h: H, el: { width: W * 3 } }) }, W0(), { time: { t: 3 } }, "2d");
      const s2 = P.snapshot();
      assert.ok(!s2.fault && s2.page === "hud" && s2.rects.some((q) => typeof q.plate === "number" && q.plate > 0), lay + " " + W + ": the probe records a plate, no fault");
    }
  } finally { P.setOn(false); }
});

test("the board canvases draw no HUD: a CLASSIC hud:true frame paints no chip word", () => {
  const r = rec(), cv = { width: 600, height: 520, getContext: () => r.ctx };
  r.ctx.canvas = cv;
  const ren = createRenderer(cv, { kind: "2d" }), w = W0();
  initFx();
  try { ren.render({ ...w, grid: [], bombs: [], blades: [], items: [], enemies: [], events: [], time: 0 }, 1 / 60, { hud: true }); } catch { /* a stub world may stop the board early; the HUD words must still be absent */ }
  assert.ok(!r.texts.some((t) => /^(BOMB|FLAME|LV|ENEMIES|LIVES|SCORE|TIME)$/.test(t.s)));
});

test("the HUD painter's call log is pinned (the CLASSIC hash no longer covers the HUD)", () => {
  const r = rec(), geo = geoOf("d", 1366, 768), w = LONG(), st = hudState(w, { time: { t: 42.5 } }), G = hudGeom(r.ctx, geo, st, { w: 1366, h: 768 });
  drawHud(r.ctx, G, st, worldTokens(3), { px: false });
  const s = JSON.stringify([r.texts.map((t) => [t.s, Math.round(t.x), Math.round(t.y), t.font, t.fill]), r.paints.length]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  assert.equal(h.toString(16).padStart(8, "0") + ":" + r.paints.length, HUD_PIN);
});
const HUD_PIN = "c9343aa8:2906"; // the HUD painter (LONG world, 1366x768, CLASSIC glyphs); a change here is a HUD art change, re-pinned by ruling like the CLASSIC hash
