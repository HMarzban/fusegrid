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

test("writes logs every property write; paints log fills and strokes with style, width, alpha, rule and device-space bounds", () => {
  const r = rec();
  r.ctx.fillStyle = "#123"; r.ctx.lineWidth = 3; r.ctx.globalAlpha = 0.5;
  assert.deepEqual(r.writes, [{ k: "fillStyle", v: "#123" }, { k: "lineWidth", v: 3 }, { k: "globalAlpha", v: 0.5 }]);
  r.ctx.save(); r.ctx.translate(10, 20); r.ctx.scale(2, 2);
  r.ctx.beginPath(); r.ctx.rect(0, 0, 5, 5); r.ctx.rect(1, 1, 2, 2); r.ctx.fill("evenodd");
  r.ctx.strokeStyle = "#456"; r.ctx.beginPath(); r.ctx.arc(5, 5, 1, 0, 7); r.ctx.stroke();
  r.ctx.fillRect(1, 1, 1, 1);
  r.ctx.restore();
  assert.equal(r.ctx.lineWidth, 3);
  const [f, s, q] = r.paints;
  assert.deepEqual([f.op, f.style, f.rule, f.alpha, f.box, f.subs], ["fill", "#123", "evenodd", 0.5, { x: 10, y: 20, w: 10, h: 10 }, [{ x: 10, y: 20, w: 10, h: 10 }, { x: 12, y: 22, w: 4, h: 4 }]]);
  assert.deepEqual([s.op, s.style, s.lw, s.box], ["stroke", "#456", 3, { x: 18, y: 28, w: 4, h: 4 }]);
  assert.deepEqual([q.op, q.style, q.box], ["fillRect", "#123", { x: 12, y: 22, w: 2, h: 2 }]);
  assert.deepEqual(r.rects.map((x) => [x.x, x.y, x.w, x.h]), [[1, 1, 1, 1]]);
});

test("rounded paths built from arcTo, and lineWidth restore", () => {
  const r = rec();
  r.ctx.beginPath(); r.ctx.moveTo(4, 0); r.ctx.arcTo(10, 0, 10, 6, 4); r.ctx.arcTo(10, 6, 0, 6, 4); r.ctx.arcTo(0, 6, 0, 0, 4); r.ctx.arcTo(0, 0, 10, 0, 4); r.ctx.closePath();
  r.ctx.save(); r.ctx.lineWidth = 7; r.ctx.restore();
  r.ctx.fill();
  assert.deepEqual([r.paints[0].box, r.paints[0].rule, r.paints[0].lw], [{ x: 0, y: 0, w: 10, h: 6 }, "nonzero", 1]);
});

test("a clip cuts paint boxes to its bounds until restore; subs stay unclipped", () => {
  const r = rec();
  r.ctx.save(); r.ctx.beginPath(); r.ctx.rect(0, 0, 10, 10); r.ctx.clip();
  r.ctx.fillRect(5, 5, 20, 20);
  r.ctx.beginPath(); r.ctx.rect(2, 2, 4, 4); r.ctx.rect(2, 6, 4, 9); r.ctx.fill("evenodd");
  r.ctx.fillRect(30, 30, 2, 2);
  r.ctx.restore();
  r.ctx.fillRect(5, 5, 20, 20);
  assert.deepEqual(r.paints.map((p) => p.box), [{ x: 5, y: 5, w: 5, h: 5 }, { x: 2, y: 2, w: 4, h: 8 }, null, { x: 5, y: 5, w: 20, h: 20 }]);
  assert.deepEqual(r.paints[1].subs, [{ x: 2, y: 2, w: 4, h: 4 }, { x: 2, y: 6, w: 4, h: 9 }]);
});
