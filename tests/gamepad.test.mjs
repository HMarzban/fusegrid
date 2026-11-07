import test from "node:test";
import assert from "node:assert/strict";
import { createPad, resolveStick, padName } from "../src/app/gamepad.js";
import { SENS_LEVELS } from "../src/app/controls.js";

const btn = (v) => ({ pressed: v >= 0.5, value: +v });
function mk(o = {}) {
  const b = Array.from({ length: o.n || 17 }, () => btn(0));
  for (const [i, v] of Object.entries(o.b || {})) b[i] = btn(v);
  return { id: o.id || "Vendor 1234 Product abcd", index: o.index || 0, connected: true, mapping: o.mapping === undefined ? "standard" : o.mapping, buttons: b, axes: o.axes || [0, 0, 0, 0] };
}
function rig(pads, opts = {}) {
  const st = { pads };
  const pad = createPad({ getGamepads: () => st.pads, ...opts });
  return { st, pad };
}
const none = (d) => !d.up && !d.down && !d.left && !d.right;

test("deadzone 0.25: 0.24 reads nothing, 0.26 engages, releases at 0.20", () => {
  const { st, pad } = rig([mk({ axes: [0.24, 0, 0, 0] })], { dead: 0.25 });
  assert.ok(none(pad.poll(0).dir));
  st.pads = [mk({ axes: [0.26, 0, 0, 0] })];
  assert.ok(pad.poll(1).dir.right);
  st.pads = [mk({ axes: [0.21, 0, 0, 0] })];
  assert.ok(pad.poll(2).dir.right);
  st.pads = [mk({ axes: [0.2, 0, 0, 0] })];
  assert.ok(none(pad.poll(3).dir));
  st.pads = [mk({ axes: [0.255 / Math.SQRT2, 0.255 / Math.SQRT2, 0, 0] })];
  assert.ok(!none(pad.poll(4).dir));
});

test("resting stick releases at every deadzone stop 5..60", () => {
  for (let d = 5; d <= 60; d += 5) {
    const dz = d / 100;
    let s = resolveStick({ ax: null, sx: 0, sy: 0, on: false }, 0.9, 0, dz);
    assert.ok(s.on);
    s = resolveStick(s, 0.02, 0, dz);
    assert.ok(!s.on, "dead " + d);
  }
});

test("dominant axis: 1.2x holds, 1.3x flips; tie goes vertical", () => {
  let s = resolveStick({ ax: null, sx: 0, sy: 0, on: false }, 0.6, 0.1, 0.25);
  assert.equal(s.ax, "x");
  s = resolveStick(s, 0.6, 0.72, 0.25);
  assert.equal(s.ax, "x");
  s = resolveStick(s, 0.6, 0.78, 0.25);
  assert.equal(s.ax, "y");
  assert.ok(s.dir.down);
  s = resolveStick({ ax: null, sx: 0, sy: 0, on: false }, 0.7, 0.7, 0.25);
  assert.equal(s.ax, "y");
});

test("sign flip on one axis is immediate", () => {
  let s = resolveStick({ ax: null, sx: 0, sy: 0, on: false }, 0.8, 0, 0.25);
  assert.ok(s.dir.right);
  s = resolveStick(s, -0.8, 0, 0.25);
  assert.ok(s.dir.left && !s.dir.right);
});

test("every level: engages at its dead, lets go at dead - 0.05 (0.10 at 40 and above, floor 0.03), rests clear of drift", () => {
  const want = { 60: 0.5, 40: 0.3, 25: 0.2, 15: 0.1, 8: 0.03 };
  for (const { dead } of SENS_LEVELS) {
    const dz = dead / 100, rel = want[dead];
    assert.ok(!resolveStick(null, dz - 0.001, 0, dz).on, "under " + dead);
    let s = resolveStick(null, dz, 0, dz);
    assert.ok(s.on, "at " + dead);
    s = resolveStick(s, rel + 0.001, 0, dz);
    assert.ok(s.on, "held above release " + dead);
    assert.ok(!resolveStick(s, rel, 0, dz).on, "released at " + dead);
  }
});
test("axis flip by level: the turn angle the note gives, per level", () => {
  const want = { 60: 1.4, 40: 1.35, 25: 1.25, 15: 1.15, 8: 1.1 };
  for (const { dead, flip } of SENS_LEVELS) {
    assert.equal(flip, want[dead]);
    const dz = dead / 100;
    const held = resolveStick(null, 0.7, 0, dz);
    assert.equal(resolveStick(held, 0.5, 0.5 * flip - 0.002, dz).ax, "x", "holds " + dead);
    assert.equal(resolveStick(held, 0.5, 0.5 * flip + 0.002, dz).ax, "y", "turns " + dead);
  }
});
test("setDead moves the flip with the level, in PLAY and in menus", () => {
  const { st, pad } = rig([mk({ axes: [0.7, 0, 0, 0] })], { dead: 0.08 });
  assert.ok(pad.poll(0).dir.right);
  st.pads = [mk({ axes: [0.5, 0.56, 0, 0] })];
  assert.ok(pad.poll(1).dir.down, "1.12 turns at MAX");
  const b = rig([mk({ axes: [0.7, 0, 0, 0] })], { dead: 0.25 });
  assert.ok(b.pad.poll(0).dir.right);
  b.st.pads = [mk({ axes: [0.5, 0.56, 0, 0] })];
  assert.ok(b.pad.poll(1).dir.right, "1.12 holds at MEDIUM");
});
test("the menu stick turns at the player's level too, though its threshold is at least 0.5", () => {
  for (const [dead, turns] of [[0.08, true], [0.25, false]]) {
    const { st, pad } = rig([mk({ axes: [0.8, 0, 0, 0] })], { dead });
    assert.ok(pad.poll(0).menuDir.right);
    st.pads = [mk({ axes: [0.6, 0.67, 0, 0] })]; // y leads by 1.117
    const m = pad.poll(1).menuDir;
    assert.equal(!!m.down, turns, "dead " + dead);
  }
});
test("menu stick: the first engage favours vertical unless x leads by 1.25; PLAY keeps plain dominance", () => {
  const side = rig([mk({ axes: [0.6, 0.5, 0, 0] })], { dead: 0.25 });
  const s = side.pad.poll(0);
  assert.ok(s.menuDir.down && !s.menuDir.right, "1.2 reads vertical in a menu");
  assert.ok(s.dir.right && !s.dir.down, "and sideways in PLAY");
  const x = rig([mk({ axes: [0.7, 0.5, 0, 0] })], { dead: 0.25 });
  assert.ok(x.pad.poll(0).menuDir.right, "1.4 is sideways in both");
  const up = rig([mk({ axes: [-0.62, -0.5, 0, 0] })], { dead: 0.25 });
  assert.ok(up.pad.poll(0).menuDir.up, "the sign carries");
  assert.equal(resolveStick(null, 0.6, 0.5, 0.25).ax, "x", "the bias is opt-in");
});
test("menuDir uses max(dead, 0.5): drift 0.4 never moves a menu", () => {
  const { st, pad } = rig([mk({ axes: [0.4, 0, 0, 0] })], { dead: 0.25 });
  const s = pad.poll(0);
  assert.ok(s.dir.right);
  assert.ok(none(s.menuDir));
  st.pads = [mk({ axes: [0.55, 0, 0, 0] })];
  assert.ok(pad.poll(1).menuDir.right);
  st.pads = [mk({ axes: [0.4, 0, 0, 0] })];
  assert.ok(pad.poll(2).menuDir.right);
  st.pads = [mk({ axes: [0.34, 0, 0, 0] })];
  assert.ok(none(pad.poll(3).menuDir));
});

test("dead 0.60 menuDir threshold is 0.60", () => {
  const { st, pad } = rig([mk({ axes: [0.55, 0, 0, 0] })], { dead: 0.6 });
  assert.ok(none(pad.poll(0).menuDir));
  st.pads = [mk({ axes: [0.61, 0, 0, 0] })];
  assert.ok(pad.poll(1).menuDir.right);
});

test("trigger press at 0.5, release at 0.35, none between", () => {
  const { st, pad } = rig([mk({ b: { 7: 0.45 } })]);
  let s = pad.poll(0);
  assert.ok(!s.down.has("TRR"));
  st.pads = [mk({ b: { 7: 0.5 } })];
  s = pad.poll(1);
  assert.deepEqual(s.press, ["TRR"]);
  st.pads = [mk({ b: { 7: 0.4 } })];
  s = pad.poll(2);
  assert.ok(s.down.has("TRR") && s.release.length === 0);
  st.pads = [mk({ b: { 7: 0.35 } })];
  s = pad.poll(3);
  assert.deepEqual(s.release, ["TRR"]);
  st.pads = [mk({ b: { 7: 0.45 } })];
  assert.ok(!pad.poll(4).down.has("TRR"));
});

test("button ids map and a held button reports one press", () => {
  const { pad } = rig([mk({ b: { 0: 1, 8: 1, 9: 1 } })]);
  const s = pad.poll(0);
  assert.deepEqual([...s.press].sort(), ["S", "SELECT", "START"]);
  assert.ok(pad.poll(1).press.length === 0);
  assert.ok(s.anyDown);
});

test("D-PAD wins over the stick", () => {
  const { pad } = rig([mk({ b: { 14: 1 }, axes: [0.9, 0, 0, 0] })]);
  const s = pad.poll(0);
  assert.ok(s.dir.left && !s.dir.right);
});

test("two D-PAD buttons: newest wins, release falls back", () => {
  const { st, pad } = rig([mk({ b: { 12: 1 } })]);
  assert.ok(pad.poll(0).dir.up);
  st.pads = [mk({ b: { 12: 1, 15: 1 } })];
  let s = pad.poll(1);
  assert.ok(s.dir.right && !s.dir.up);
  st.pads = [mk({ b: { 12: 1 } })];
  s = pad.poll(2);
  assert.ok(s.dir.up && !s.dir.right);
  assert.ok(s.menuDir.up);
});

test("no diagonal ever", () => {
  const { st, pad } = rig([mk()]);
  let seed = 7;
  const r = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 2000; i++) {
    const b = {};
    for (const k of [12, 13, 14, 15]) if (r() < 0.4) b[k] = 1;
    st.pads = [mk({ b, axes: [r() * 2 - 1, r() * 2 - 1, 0, 0] })];
    const d = pad.poll(i).dir;
    assert.ok(+d.up + +d.down + +d.left + +d.right <= 1);
  }
});

test("first sight with a button down reports a press", () => {
  const { pad } = rig([null]);
  assert.equal(pad.poll(0).connected, false);
  const { pad: p2 } = rig([mk({ b: { 1: 1 } })]);
  const s = p2.poll(0);
  assert.deepEqual(s.press, ["E"]);
  assert.ok(s.found);
});

test("two pads: last to press wins, stuck axis never claims", () => {
  const a = (o) => mk({ index: 0, ...o });
  const b = (o) => mk({ index: 1, ...o });
  const { st, pad } = rig([a({ b: { 0: 1 } }), b({ axes: [1, 0, 0, 0] })]);
  let s = pad.poll(0);
  assert.equal(s.count, 2);
  assert.ok(none(s.dir));
  assert.ok(s.down.has("S"));
  st.pads = [a({ b: { 0: 1 } }), b({ axes: [1, 0, 0, 0], b: { 2: 1 } })];
  s = pad.poll(1);
  assert.ok(s.dir.right);
  assert.deepEqual(s.press, ["W"]);
  assert.deepEqual(s.release, ["S"]);
  assert.ok(!s.down.has("S"));
  st.pads = [a({ b: { 0: 1 } }), b({ axes: [1, 0, 0, 0], b: { 2: 1 } })];
  s = pad.poll(2);
  assert.ok(s.dir.right && s.press.length === 0);
});

test("the snap names the active pad's slot, and it follows a press", () => {
  const { st, pad } = rig([]);
  assert.equal(pad.poll(0).index, null, "no pad, no slot");
  st.pads = [null, mk({ index: 1 })];
  assert.equal(pad.poll(1).index, 1, "a lone pad in a later slot");
  st.pads = [mk({ index: 0 }), mk({ index: 1 })];
  assert.equal(pad.poll(2).index, 1, "a second pad claims nothing at rest");
  st.pads = [mk({ index: 0, b: { 0: 1 } }), mk({ index: 1 })];
  assert.equal(pad.poll(3).index, 0, "a press moves it");
  assert.equal(pad.snap().index, 0);
  st.pads = [mk({ index: 0 }), mk({ index: 1, axes: [1, 0, 0, 0] })];
  assert.equal(pad.poll(4).index, 0, "a stick never claims");
  st.pads = [null, mk({ index: 1 })];
  assert.equal(pad.poll(5).index, null, "the active pad gone: no slot this poll");
  assert.equal(pad.poll(6).index, 1, "the other one adopted on the next");
});

test("E1 E4: the active pad unplugged with the other's stick stuck: lost now, found next poll", () => {
  const a = mk({ index: 0, b: { 0: 1 } }), b = mk({ index: 1, axes: [0.9, 0, 0, 0] });
  const { st, pad } = rig([a, b]);
  pad.poll(0);
  st.pads = [null, b];
  let s = pad.poll(1);
  assert.ok(s.lost && !s.connected, "this poll reports the loss");
  assert.ok(none(s.dir));
  s = pad.poll(2);
  assert.ok(s.found && s.connected, "the next poll adopts the other pad");
  assert.ok(s.dir.right);
  s = pad.poll(3);
  assert.ok(!s.found && !s.lost);
});

test("E1 E4: the active pad unplugged while the other presses in that poll still reports lost", () => {
  const a = mk({ index: 0, b: { 0: 1 } }), b = mk({ index: 1 });
  const { st, pad } = rig([a, b]);
  pad.poll(0);
  st.pads = [null, mk({ index: 1, b: { 0: 1 } })];
  let s = pad.poll(1);
  assert.ok(s.lost && !s.connected);
  assert.deepEqual(s.press, []);
  s = pad.poll(2);
  assert.ok(s.found && s.down.has("S"));
  assert.deepEqual(s.press, []);
});

test("first sight of one pad needs no earlier connection", () => {
  const { st, pad } = rig([null]);
  pad.poll(0);
  st.pads = [mk({ axes: [0.9, 0, 0, 0] })];
  const s = pad.poll(1);
  assert.ok(s.found && s.dir.right);
});

test("found/lost edges once", () => {
  const { st, pad } = rig([null]);
  assert.ok(!pad.poll(0).found);
  st.pads = [mk()];
  assert.ok(pad.poll(1).found);
  assert.ok(!pad.poll(2).found && pad.poll(3).connected);
  st.pads = [null];
  let s = pad.poll(4);
  assert.ok(s.lost && !s.connected);
  assert.ok(!pad.poll(5).lost);
});

test("null getGamepads and a throwing getGamepads are inert", () => {
  for (const f of [() => null, () => { throw new Error("x"); }, undefined]) {
    const pad = createPad({ getGamepads: f });
    const s = pad.poll(0);
    assert.equal(s.connected, false);
    assert.ok(none(s.dir) && s.down.size === 0);
  }
});

test("non-standard pad keeps indices and reports mapping other", () => {
  const { pad } = rig([mk({ mapping: "", n: 10, b: { 0: 1 }, axes: [0.9, 0] })]);
  const s = pad.poll(0);
  assert.equal(s.mapping, "other");
  assert.ok(s.down.has("S"));
  assert.ok(s.dir.right);
  const { pad: p2 } = rig([mk({ mapping: "", n: 16, b: { 12: 1 }, axes: [0.9, 0] })]);
  const t = p2.poll(0);
  assert.ok(t.dir.up && !t.dir.right);
  const { pad: p3 } = rig([mk({ mapping: "", n: 16, axes: [0.9, 0] })]);
  assert.ok(p3.poll(0).dir.right, "lead ruling: on 16+ buttons the stick works alongside them");
  assert.ok(p3.snap().menuDir.right, "and it walks the menus");
  for (const n of [13, 14, 15]) {
    const { pad: px } = rig([mk({ mapping: "", n, axes: [0.9, 0] })]);
    assert.ok(px.poll(0).dir.right, "E5: " + n + " buttons have no D-PAD, the stick moves");
  }
});

test("non-standard, 16+ buttons: a stuck stick never claims the pad, and R-STICK reads the right axes", () => {
  const a = (o) => mk({ index: 0, ...o }), b = (o) => mk({ index: 1, mapping: "", n: 16, ...o });
  const { st, pad } = rig([a({ b: { 0: 1 } }), b()]);
  assert.equal(pad.poll(0).index, 0);
  st.pads = [a(), b({ axes: [1, 0, 0, 0] })];
  assert.equal(pad.poll(1).index, 0, "a stuck stick never claims");
  assert.ok(none(pad.snap().dir), "and walks nobody");
  const { pad: r } = rig([mk({ mapping: "", n: 16, axes: [0.9, 0, 0, -0.9] })], { stick: "R" });
  assert.ok(r.poll(0).dir.up && !r.snap().dir.right);
});

test("short buttons, missing axes and stick selection", () => {
  const { pad } = rig([{ index: 0, connected: true, mapping: "standard", buttons: [btn(1)] }]);
  const s = pad.poll(0);
  assert.ok(s.down.has("S") && none(s.dir));
  const { pad: p } = rig([mk({ axes: [0.9, 0, 0, -0.9] })], { stick: "R" });
  assert.ok(p.poll(0).dir.up);
  p.setStick("L");
  assert.ok(p.poll(1).dir.right);
  p.setDead(1);
  assert.ok(none(p.poll(2).dir));
});

test("index 16 and stick clicks are never read", () => {
  const { pad } = rig([mk({ b: { 10: 1, 11: 1, 16: 1 } })]);
  const s = pad.poll(0);
  assert.equal(s.down.size, 0);
  assert.equal(s.anyDown, false);
});

test("name never contains the device id", () => {
  const { pad } = rig([mk({ id: "Vendor 1234 Product abcd" })]);
  const s = pad.poll(0);
  assert.equal(s.name, "CONTROLLER 1");
  assert.equal(padName(s), s.name);
  const { pad: p } = rig([mk({ mapping: "", n: 10, id: "Zed 99" })]);
  const t = p.poll(0);
  assert.equal(t.name, "CONTROLLER 1 · BUTTONS 0-9");
  assert.ok(!/Zed|99 /.test(t.name) || t.name.includes("0-9"));
  assert.equal(padName({ connected: false }), "");
});
