import { test } from "node:test";
import assert from "node:assert/strict";
import { rec } from "./lib/textrec.mjs";

test("measureText = len x widthK x px x scale, px from the live font", () => {
  const r = rec();
  r.ctx.font = "900 24px system-ui,sans-serif";
  assert.equal(r.ctx.measureText("ABCDE").width, 5 * 0.6 * 24);
  r.ctx.font = "10px x";
  assert.equal(r.ctx.measureText("ABCD").width, 4 * 0.6 * 10);
  const w = rec({ widthK: 0.65, scale: 2 });
  w.ctx.font = "20px mono";
  assert.equal(w.ctx.measureText("abcd").width, 4 * 0.65 * 20 * 2);
});

test("fillText and strokeText record position, width, font and style at call time", () => {
  const r = rec({ scale: 2 });
  r.ctx.font = "10px a"; r.ctx.fillStyle = "#111"; r.ctx.fillText("HELLO", 5, 7);
  r.ctx.font = "20px b"; r.ctx.fillStyle = "#222"; r.ctx.strokeStyle = "#333"; r.ctx.strokeText("AB", 1, 2);
  assert.deepEqual(r.texts.map((t) => [t.s, t.x, t.y, t.w, t.font, t.fill]), [
    ["HELLO", 5, 7, 5 * 0.6 * 10 * 2, "10px a", "#111"],
    ["AB", 1, 2, 2 * 0.6 * 20 * 2, "20px b", "#222"],
  ]);
  assert.equal(r.texts[1].stroke, "#333");
});

test("fillRect and strokeRect record geometry and style; styles lists distinct values", () => {
  const r = rec();
  r.ctx.fillStyle = "#abc"; r.ctx.fillRect(1, 2, 3, 4);
  r.ctx.strokeStyle = "#def"; r.ctx.strokeRect(5, 6, 7, 8);
  r.ctx.fillRect(9, 9, 1, 1);
  assert.deepEqual(r.rects.map((q) => [q.x, q.y, q.w, q.h, q.fill, q.stroke]), [
    [1, 2, 3, 4, "#abc", undefined], [5, 6, 7, 8, undefined, "#def"], [9, 9, 1, 1, "#abc", undefined]]);
  assert.deepEqual([...r.styles].sort(), ["#abc", "#def"]);
});

test("calls log method names with args; unknown methods never throw; gradients are recorders", () => {
  const r = rec();
  r.ctx.save(); r.ctx.beginPath(); r.ctx.arc(1, 2, 3, 0, 6);
  const g = r.ctx.createLinearGradient(0, 0, 1, 1); g.addColorStop(0, "#fff"); r.ctx.fillStyle = g;
  r.ctx.fillText("x", 0, 0);
  assert.deepEqual(r.calls.slice(0, 3).map((c) => c.op), ["save", "beginPath", "arc"]);
  assert.deepEqual(r.calls[2].a, [1, 2, 3, 0, 6]);
  assert.ok(r.calls.some((c) => c.op === "fillText"));
});

test("getTransform follows translate, scale and setTransform", () => {
  const r = rec();
  assert.deepEqual([r.ctx.getTransform().a, r.ctx.getTransform().e], [1, 0]);
  r.ctx.translate(10, 20); r.ctx.scale(2, 3);
  const m = r.ctx.getTransform();
  assert.deepEqual([m.a, m.d, m.e, m.f], [2, 3, 10, 20]);
  r.ctx.setTransform(1, 0, 0, 1, 4, 5);
  assert.deepEqual([r.ctx.getTransform().e, r.ctx.getTransform().f], [4, 5]);
});
