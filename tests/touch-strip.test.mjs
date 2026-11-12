// The phone touch strip and the tile tip (UI upgrade Task 8.3, round 5 09-hud): the D-PAD as four keys, THROW and REMOTE as keys, BOMB the
// yellow main key, the PAUSE key in the HUD (the plate's grid on a portrait phone, the right gutter's head on a landscape one); every control
// >= 44 CSS px with >= 8 px between them; THROW / REMOTE only while held; the floor-tile tip beside the board on a leader, never over it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rec } from "./lib/textrec.mjs";
import { hudGeo, HUD_RES, STRIP } from "../src/app/fit.js";
import { drawHud, hudGeom, hudState, tipOf, createHud } from "../src/render/hud.js";
import { worldTokens } from "../src/render/kit/tokens.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { CFG, key } from "../src/core/config.js";
import { F, FEAT_PROFILE, tileTip } from "../src/core/feat.js";
import { setTextScale } from "../src/render/kit/type.js";
import * as P from "../src/render/kit/probe.js";
import { release, _dbg } from "../src/render/kit/cache.js";

const W0 = (o = {}) => ({ state: "PLAY", lives: 3, level: 3, heat: 0, score: 1240, enemies: [1, 2, 3, 4], players: [{ bombs: 2, range: 3, x: 60, y: 60 }], ...o });
const P_BOX = [[393, 852], [390, 844], [430, 932], [375, 667], [360, 740], [412, 915], [768, 1024]];
const L_BOX = [[844, 390], [932, 430], [667, 375], [740, 360], [1024, 768], [1024, 600], [800, 600], [1366, 1024]];
const sep = (a, b, m) => a.x + a.w + m <= b.x + 1e-6 || b.x + b.w + m <= a.x + 1e-6 || a.y + a.h + m <= b.y + 1e-6 || b.y + b.h + m <= a.y + 1e-6;
const off = (a, b) => sep(a, b, 0);
const geom = (lay, W, H, w) => { const r = rec(), st = hudState(w || W0({ players: [{ bombs: 2, range: 3, throw: true, remote: true, shield: true, kick: true, passing: true, bombKind: "pierce", speed: 999 }] }), { time: { t: 1 } }); return { r, st, G: hudGeom(r.ctx, hudGeo(W, H, 600, 520, lay, true), st, { w: W, h: H }) }; };
const controls = (G) => [...Object.values(G.strip.keys), G.strip.bomb, G.strip.thr, G.strip.rem, G.pause];

test("every touch control is >= 44 CSS px with >= 8 px between them, and none sits on the board or the HUD's chips", () => {
  for (const [lay, list] of [["p", P_BOX], ["l", L_BOX]]) for (const [W, H] of list) {
    const { G } = geom(lay, W, H), geo = hudGeo(W, H, 600, 520, lay, true), cs = controls(G);
    for (const c of cs) assert.ok(c.w >= 44 - 1e-9 && c.h >= 44 - 1e-9, `${lay} ${W}x${H}: ${JSON.stringify(c)} >= 44`);
    cs.forEach((a, i) => cs.forEach((b, j) => { if (i < j) assert.ok(sep(a, b, 8), `${lay} ${W}x${H}: ${JSON.stringify(a)} vs ${JSON.stringify(b)} 8 apart`); }));
    if (G.bar) assert.ok(cs.every((c) => off(c, G.bar)), `${lay} ${W}x${H}: the power-ups bar keeps off the strip`);
    for (const c of cs) {
      assert.ok(off(c, geo.stage), `${lay} ${W}x${H}: off the board`);
      assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= W + 1e-6 && c.y + c.h <= H + 1e-6, `${lay} ${W}x${H}: in the viewport`);
      for (const ch of Object.values(G.chips)) assert.ok(off(c, ch) || c === G.pause, `${lay} ${W}x${H}: off the chips`);
    }
  }
});

test("the round 5 phone frame: D-PAD keys 52 with 10 between, BOMB 130x90 at 16 from the right, the PAUSE key in the grid's fourth column", () => {
  const { G } = geom("p", 393, 852);
  const k = G.strip.keys;
  assert.deepEqual([k.up.w, k.up.h, k.lf.x + k.lf.w + 10, k.dn.y - (k.lf.y + k.lf.h)], [52, 52, k.up.x, 10]);
  assert.equal(Math.round(k.lf.x), STRIP.dpad);
  assert.deepEqual([G.strip.bomb.w, G.strip.bomb.h, Math.round(393 - G.strip.bomb.x - G.strip.bomb.w)], [130, 90, STRIP.right]);
  assert.ok(G.pause.y === G.chips.lives.y && G.pause.x > G.chips.flame.x + G.chips.flame.w && G.pause.x === G.chips.score.x);
});

test("the strip paints only in PLAY: THROW and REMOTE only while held, BOMB the one yellow (#ffd447), PAUSE reads RESUME while paused", () => {
  const draw = (w) => { const { r, st, G } = geom("p", 393, 852, w); drawHud(r.ctx, G, st, worldTokens(3), {}); return r; };
  const words = (r) => r.texts.map((t) => t.s);
  const none = draw(W0()), both = draw(W0({ players: [{ bombs: 2, range: 3, throw: true, remote: true }] })), paused = draw(W0({ state: "PAUSE", players: [{ bombs: 2, range: 3, throw: true }] }));
  assert.ok(!words(none).includes("THROW") && !words(none).includes("REMOTE") && words(none).includes("BOMB") && words(none).includes("PAUSE"));
  assert.ok(words(both).filter((s) => s === "THROW").length >= 1 && words(both).includes("REMOTE"));
  const yel = (r) => r.paints.filter((q) => (q.op === "fill" || q.op === "fillRect") && /ffd447/i.test(String(q.style)) && q.box && q.box.w >= 44);
  assert.equal(yel(none).length, 1, "BOMB is the one yellow part");
  assert.ok(!words(paused).includes("BOMB") && words(paused).includes("RESUME") && yel(paused).length === 0, "PAUSE: no strip, the PAUSE key reads RESUME");
  const desk = (() => { const { r, st, G } = geom("d", 1366, 768); drawHud(r.ctx, G, st, worldTokens(3), {}); return r; })();
  assert.equal(yel(desk).length, 0, "the desktop HUD has no yellow and no strip");
});

test("the strip's DOM: #tpad, #tbomb, #tthrow, #tremote and #tpause are transparent hit areas over the painted keys on a touch layout", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /body\[data-lay=p\] #touchpad>div,body\[data-lay=l\] #touchpad>div\{[^}]*background:transparent[^}]*border:0[^}]*opacity:1/);
  assert.match(html, /body\[data-lay=p\] #touchpad>div:active,body\[data-lay=l\] #touchpad>div:active\{[^}]*background:rgba\(255,242,223,\.16\)/);
  assert.match(html, /body\[data-lay=l\] #tpad\{left:auto;right:calc\(100% \+ 8px\);bottom:0;width:152px;height:152px\}/);
  assert.equal(HUD_RES.l.pad, 152);
});

test("landscape: index.html places #tpad, #tbomb, #tthrow and #tremote with HUD_RES.l's own numbers, which the HUD paints (one source, cross-checked)", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8"), L = HUD_RES.l;
  const rule = (id) => (html.match(new RegExp("body\\[data-lay=l\\] #" + id + "\\{[^}]*\\}")) || [""])[0], base = (id) => (html.match(new RegExp("\\n\\s*#" + id + "\\{[^}]*\\}")) || [""])[0];
  const num = (re, t) => +((t.match(re) || [])[1]);
  const pad = rule("tpad");
  assert.deepEqual([num(/right:calc\(100% \+ (\d+)px\)/, pad), num(/bottom:(\d+)/, pad), num(/width:(\d+)px/, pad), num(/height:(\d+)px/, pad)], [L.padR, 0, L.pad, L.pad], "the D-PAD");
  for (const [id, v] of [["tbomb", L.bomb], ["tthrow", L.thr], ["tremote", L.rem]]) {
    const r = rule(id), w = num(/width:(\d+)px/, base(id));
    assert.deepEqual([num(/left:calc\(100% \+ (\d+)px\)/, r), num(/bottom:(\d+)px/, r), w, num(/height:(\d+)px/, base(id))], [v[0], v[1], v[2], v[2]], id + " left gap, bottom, size");
  }
  for (const [W, H] of L_BOX) {
    const geo = hudGeo(W, H, 600, 520, "l", true), st = geo.stage, sr = st.x + st.w, sb = st.y + st.h, S = geo.strip;
    assert.deepEqual([S.pad.x, S.pad.y, S.pad.w], [st.x - L.padR - L.pad, sb - L.pad, L.pad], `l ${W}x${H}: the painted D-PAD is the CSS one`);
    for (const [k, v] of [["bomb", L.bomb], ["thr", L.thr], ["rem", L.rem]]) assert.deepEqual([S[k].x, S[k].y, S[k].w, S[k].h], [sr + v[0], sb - v[1] - v[2], v[2], v[2]], `l ${W}x${H}: the painted ${k} is the CSS one`);
  }
});

test("createHud docks #tpause on the PAUSE key it paints (stage-relative CSS), once per change", () => {
  const r = rec(), geo = hudGeo(393, 852, 600, 520, "p", true), el = { style: {} }, writes = [];
  const style = new Proxy(el.style, { set: (o, k, v) => { writes.push(k); o[k] = v; return true; } });
  const pause = { style };
  globalThis.document = { getElementById: (id) => (id === "tpause" ? pause : null) };
  try {
    const fit = { hudGeo: () => geo, hud: () => ({ ctx: r.ctx, geo, w: 393, h: 852, el: { width: 1179 } }) }, hud = createHud();
    hud.frame(fit, W0(), { time: { t: 1 } }, "2d");
    const G = hudGeom(rec().ctx, geo, hudState(W0(), { time: { t: 1 } }), { w: 393, h: 852 });
    assert.equal(style.left, G.pause.x - geo.stage.x + "px");
    assert.equal(style.top, G.pause.y - geo.stage.y + "px");
    assert.equal(style.width, G.pause.w + "px");
    const n = writes.length;
    hud.frame(fit, W0(), { time: { t: 1.2 } }, "2d");
    assert.equal(writes.length, n, "no style write while the slot stands");
  } finally { delete globalThis.document; }
});

test("the floor-tile tip sits beside the board on a leader to the nearest tile of its kind, never over the board", () => {
  const w = createWorld(4242, 3);
  w.gen = 1; loadLevel(w, 3); w.state = "PLAY";
  w.feat = {};
  w.feat[key(9, 7)] = F.BELT_E; w.feat[key(3, 3)] = F.BELT_E;
  w.players[0].x = 2.5 * CFG.TILE; w.players[0].y = 2.5 * CFG.TILE;
  const o = { time: { t: 1 }, coach2: { a: 1, s: "CONVEYOR · CARRIES YOUR BOMBS, NOT YOU", k: "BELT" } };
  for (const [lay, W, H] of [["d", 1366, 768], ["d", 1920, 1080], ["d", 1024, 640], ["p", 393, 852], ["p", 375, 667], ["l", 844, 390], ["l", 667, 375]]) {
    const r = rec(), geo = hudGeo(W, H, 600, 520, lay, true), st = hudState(w, o), G = hudGeom(r.ctx, geo, st, { w: W, h: H });
    drawHud(r.ctx, G, st, worldTokens(3), {});
    assert.ok(G.tip, `${lay} ${W}x${H}: a tip`);
    assert.ok(off(G.tip.box, geo.stage), `${lay} ${W}x${H}: the tip never covers the board ${JSON.stringify(G.tip.box)}`);
    assert.ok(G.tip.box.x >= 0 && G.tip.box.x + G.tip.box.w <= W + 0.5 && G.tip.box.y >= 0 && G.tip.box.y + G.tip.box.h <= H + 0.5, `${lay} ${W}x${H}: in the viewport`);
    assert.ok(r.texts.some((t) => t.s === "CONVEYOR"), `${lay} ${W}x${H}: names the tile`);
    if (G.tip.lead) {
      const [x0, y0] = G.tip.lead[0], s = geo.s;
      assert.ok(Math.abs(x0 - (geo.stage.x + 3.5 * CFG.TILE * s)) < 1 && Math.abs(y0 - (geo.stage.y + 3.5 * CFG.TILE * s)) < 1, `${lay} ${W}x${H}: the leader starts on the nearest CONVEYOR (3,3)`);
      const end = G.tip.lead[G.tip.lead.length - 1];
      assert.ok(Math.abs(end[0] - G.tip.box.x) < 1 || Math.abs(end[1] - G.tip.box.y) < 1 || Math.abs(end[1] - (G.tip.box.y + G.tip.box.h)) < 1, `${lay} ${W}x${H}: the leader ends on the tip`);
    }
    if (lay === "d") assert.ok(G.tip.lead && G.tip.lead.length >= 2, "desktop: a leader");
  }
  assert.deepEqual(tipOf("CONVEYOR · CARRIES YOUR BOMBS, NOT YOU"), ["CONVEYOR", "CARRIES YOUR BOMBS, NOT YOU"]);
  const st = hudState(w, { time: { t: 1 }, coach2: { a: 1, s: "KICK · WALK INTO A BOMB", k: "kick" } }), G = hudGeom(rec().ctx, hudGeo(1366, 768, 600, 520, "d"), st, { w: 1366, h: 768 });
  assert.equal(G.tip, null, "a power-up's coach tip stays the board's own panel");
});

/* R4 (fix round 1): the longest tips (GATE, TRAP) at every heat, on the windows where the tip once covered the board (4:3 / 5:4 desks), spilled
   onto the D-PAD (small landscape phones) or hid the PAUSE key (short / wide portraits), at text 1 and 1.25, with every power-up and THROW /
   REMOTE held: the tip names its tile, never covers the board or a live control, stays in the viewport, and every word sits inside its plate by
   the painter's own measure (the recorder at a wide 0.648 em per char); no line starts or ends with a separator; the body never under its floor */
test("R4: the tile tip never covers the board or a live control and never spills, GATE and TRAP, at text 1 and 1.25", () => {
  const BOX = [["d", 1024, 768], ["d", 1152, 864], ["d", 1280, 1024], ["d", 1366, 768], ["l", 667, 375], ["l", 740, 360], ["p", 375, 667], ["p", 360, 740], ["p", 768, 1024], ["p", 393, 852]];
  const ALLP = { bombs: 2, range: 3, throw: true, remote: true, shield: true, kick: true, passing: true, bombKind: "pierce", speed: 999 };
  const used = {};
  for (const K of [1, 1.25]) {
    setTextScale(K);
    try {
      for (const [kind, k, code] of [["GATE", "GATE", F.GATE], ["TRAP", "PLATE", F.PLATE]]) for (const heat of [0, 1, 2]) for (const [lay, W, H] of BOX) {
        const w = createWorld(4242, 3);
        w.gen = 1; loadLevel(w, 3); w.state = "PLAY"; w.heat = heat;
        w.feat = {}; w.feat[key(9, 7)] = code;
        Object.assign(w.players[0], ALLP, { x: 2.5 * CFG.TILE, y: 2.5 * CFG.TILE });
        const text = tileTip(k, FEAT_PROFILE[heat]), tag = `${kind} heat ${heat} ${lay} ${W}x${H} @${K}`;
        const r = rec({ widthK: 0.648 }), geo = hudGeo(W, H, 600, 520, lay, true), st = hudState(w, { time: { t: 1 }, coach2: { a: 1, s: text, k } }), G = hudGeom(r.ctx, geo, st, { w: W, h: H });
        drawHud(r.ctx, G, st, worldTokens(3), {});
        const t = G.tip;
        assert.ok(t, tag + ": a tip");
        assert.ok(r.texts.some((q) => q.s === kind), tag + ": names the tile");
        assert.ok(off(t.box, geo.stage), `${tag}: never over the board ${JSON.stringify(t.box)}`);
        const live = G.strip ? [geo.strip.pad, G.strip.bomb, G.strip.thr, G.strip.rem] : [];
        if (G.pause) live.push(G.pause);
        for (const c of live) assert.ok(off(t.box, c), `${tag}: never over a live control ${JSON.stringify(c)}`);
        assert.ok(t.box.x >= 0 && t.box.y >= 0 && t.box.x + t.box.w <= W + 0.5 && t.box.y + t.box.h <= H + 0.5, tag + ": in the viewport");
        const mine = r.texts.filter((q) => q.s === t.name || t.lines.includes(q.s));
        assert.equal(mine.length, 1 + t.lines.length, tag + ": the name and every line drawn");
        for (const q of mine) assert.ok(q.x >= t.in.x && q.x + q.w <= t.in.x + t.in.w + 0.5 && q.y >= t.in.y && q.y <= t.in.y + t.in.h, `${tag}: "${q.s}" inside the plate ${JSON.stringify(t.in)} (x ${q.x} w ${q.w} y ${q.y})`);
        const last = t.lines.length ? (t.in.y + 10 + t.D.pri * K + 6 + t.lines.length * t.px * K * 1.25) : t.in.y + 10 + t.D.pri * K;
        assert.ok(last <= t.in.y + t.in.h + 0.5, `${tag}: the last line ends inside the plate`);
        assert.ok(t.lines.length <= 2 && t.lines.every((l) => !/^·|·$/.test(l.trim())), `${tag}: one or two lines, no separator at an edge: ${JSON.stringify(t.lines)}`);
        if (t.lines.length) assert.ok(t.px * K >= (lay === "d" ? 17.9 : 14.1) - 1e-6, `${tag}: body at ${t.px * K}px`);
        const step = t.body;
        used[lay + " " + W + "x" + H + " @" + K] = (used[lay + " " + W + "x" + H + " @" + K] || new Set()).add(step);
      }
    } finally { setTextScale(1); }
  }
  console.log("tip steps:", Object.entries(used).map(([k, v]) => k + " " + [...v].join("/")).join("; "));
});

test("the renderers leave a floor-tile tip to the HUD and keep every other coach tip", async () => {
  const { boardTip } = await import("../src/render/scenes.js");
  assert.equal(boardTip({ a: 1, s: "x", k: "BELT" }), 0);
  assert.equal(boardTip({ a: 1, s: "x", k: "BRAKE" }), 0);
  assert.equal(boardTip({ a: 0.5, s: "x", k: "kick" }), 0.5);
  assert.equal(boardTip(null), 0);
  for (const f of ["src/render/renderer.js", "src/render/three/wrapper.js", "src/render/pixel/renderer.js"]) assert.match(readFileSync(f, "utf8"), /drawCoach2\([^)]*boardTip\(o(&&|\s*&&\s*)o\.coach2\)/);
});

test("the probe records the strip and the PAUSE key as touch targets on a phone", () => {
  P.setOn(true);
  try {
    const r = rec(), geo = hudGeo(393, 852, 600, 520, "p", true);
    createHud().frame({ hudGeo: () => geo, hud: () => ({ ctx: r.ctx, geo, w: 393, h: 852, el: { width: 1179 } }) }, W0({ players: [{ bombs: 2, range: 3, throw: true }] }), { time: { t: 3 } }, "2d");
    const t = P.snapshot().rects.filter((q) => q.touch);
    assert.ok(t.length >= 7 && t.every((q) => q.w >= 44 && q.h >= 44), JSON.stringify(t));
    assert.equal(P.snapshot().rects.filter((q) => q.fill === "#ffd447").length, 1);
  } finally { P.setOn(false); }
});

test("frame cost: a phone repaint with every part live (chips, power-ups, strip, tile tip) stays <= 400 canvas calls once its layers are made", () => {
  const noop = () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === "measureText" ? () => ({ width: 8 }) : k.startsWith && k.startsWith("create") ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => ((o[k] = v), true) });
  globalThis.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; } getContext() { return noop(); } };
  try {
    release();
    const w = createWorld(4242, 3);
    w.gen = 1; loadLevel(w, 3); w.state = "PLAY";
    w.feat = { [key(3, 3)]: F.BELT_E };
    Object.assign(w.players[0], { x: 2.5 * CFG.TILE, y: 2.5 * CFG.TILE, shield: true, kick: true, throw: true, remote: true, bombKind: "line" });
    const geo = hudGeo(393, 852, 600, 520, "p", true), o = (t) => ({ time: { t }, coach2: { a: 1, s: "CONVEYOR · CARRIES YOUR BOMBS, NOT YOU", k: "BELT" } });
    const r = rec(), hud = createHud(), fit = { hudGeo: () => geo, hud: () => ({ ctx: r.ctx, geo, w: 393, h: 852, el: { width: 1179 } }) };
    hud.frame(fit, w, o(1), "2d");
    const m0 = _dbg.misses, n0 = r.calls.length;
    hud.frame(fit, w, o(1.2), "2d");
    const n = r.calls.length - n0;
    assert.ok(n > 0 && n <= 400, n + " calls");
    assert.equal(_dbg.misses, m0, "a repaint makes no layer");
  } finally { delete globalThis.OffscreenCanvas; release(); }
});

test("every word on a strip key or the PAUSE key is whole inside it, at text scale 1 and 1.25, never under the secondary floor", async () => {
  const { setTextScale } = await import("../src/render/kit/type.js");
  for (const k of [1, 1.25]) {
    setTextScale(k);
    try {
      for (const [lay, list] of [["p", P_BOX], ["l", L_BOX]]) for (const [W, H] of list) {
        const { r, st, G } = geom(lay, W, H);
        drawHud(r.ctx, G, st, worldTokens(3), {});
        const keys = [G.strip.thr, G.strip.rem, G.strip.bomb, G.pause];
        for (const t of r.texts) {
          const x0 = t.align === "center" ? t.x - t.w / 2 : t.x, kr = keys.find((q) => t.y >= q.y && t.y <= q.y + q.h && x0 + t.w / 2 >= q.x && x0 + t.w / 2 <= q.x + q.w);
          if (!kr) continue;
          assert.ok(x0 >= kr.x - 0.5 && x0 + t.w <= kr.x + kr.w + 0.5, `${lay} ${W}x${H} @${k}: ${t.s} whole in its key`);
          assert.ok(+/(\d+(?:\.\d+)?)px/.exec(t.font)[1] * 0.704 >= 9 - 0.05, `${lay} ${W}x${H} @${k}: ${t.s} cap >= 9`);
        }
      }
    } finally { setTextScale(1); }
  }
});

/* R4 carry-in (Task 8 re-review): REMOTE's word (and THROW's) is drawn whole inside its key on the 393 x 852 phone, at text scale 1 and 1.25 */
test("393x852: REMOTE and THROW are drawn whole inside their keys, at text scale 1 and 1.25", () => {
  try {
    for (const ts of [1, 1.25]) {
      setTextScale(ts);
      const { r, st, G } = geom("p", 393, 852, W0({ players: [{ bombs: 2, range: 3, throw: true, remote: true }] }));
      drawHud(r.ctx, G, st, worldTokens(3), {});
      for (const [word, k] of [["REMOTE", G.strip.rem], ["THROW", G.strip.thr]]) {
        const t = r.texts.filter((q) => q.s === word);
        assert.ok(k && t.length >= 1, `x${ts}: ${word} is drawn on its key`);
        const q = t[t.length - 1], x0 = q.align === "center" ? q.x - q.w / 2 : q.align === "right" || q.align === "end" ? q.x - q.w : q.x;
        assert.ok(x0 >= k.x - 1e-6 && x0 + q.w <= k.x + k.w + 1e-6 && q.y >= k.y && q.y <= k.y + k.h, `x${ts}: ${word} ${JSON.stringify([x0, q.w, q.y])} inside ${JSON.stringify(k)}`);
      }
    }
  } finally { setTextScale(1); }
});
