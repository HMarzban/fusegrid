/* Top corner pieces of the HUD plate (frame.js hudPlate, CLASSIC + PIXEL):
   the end caps and the corner boss are drawn after the plate body (above it),
   never inside the HUD band drawHudChips paints next (its panel, the hearts at
   their widest PIXEL x2 size, the score column), never on the playfield, only
   in the two top corner cells' columns; hudPlate leaves the ctx as it found
   it, so the HUD band call log after it is byte-identical. */
import test from "node:test";
import assert from "node:assert/strict";
import {CFG} from "../src/core/config.js";
import {hudPlate, CAPS} from "../src/render/frame.js";
import {drawHudChips} from "../src/render/scenes.js";

const W = CFG.COLS * CFG.TILE, H = CFG.ROWS * CFG.TILE, T = CFG.TILE;

function rec() {
  const ops = [], log = [];
  let pts = [], depth = 0;
  const st = {globalAlpha: 1, fillStyle: "#000000", strokeStyle: "#000000", lineWidth: 1};
  const box = (p, pad = 0) => { const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]); return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]; };
  const base = {
    save() { depth++; log.push("save"); }, restore() { depth--; log.push("restore"); },
    beginPath() { pts = []; }, moveTo(x, y) { pts.push([x, y]); }, lineTo(x, y) { pts.push([x, y]); },
    arcTo(x1, y1, x2, y2) { pts.push([x1, y1], [x2, y2]); }, closePath() {},
    fillRect(x, y, w, h) { log.push("fillRect(" + [x, y, w, h] + ")" + st.fillStyle + "@" + st.globalAlpha); ops.push({k: "rect", b: [x, y, x + w, y + h], a: st.globalAlpha}); },
    strokeRect(x, y, w, h) { const d = st.lineWidth / 2; log.push("strokeRect(" + [x, y, w, h] + ")"); ops.push({k: "srect", b: [x - d, y - d, x + w + d, y + h + d]}); },
    fill() { log.push("fill"); if (pts.length) ops.push({k: "path", b: box(pts), a: st.globalAlpha}); },
    stroke() { log.push("stroke"); if (pts.length) ops.push({k: "line", b: box(pts, st.lineWidth / 2 + 1), a: st.globalAlpha}); },
    fillText(s, x, y) { log.push("text(" + s + "," + x + "," + y + ")" + st.fillStyle + st.textAlign); ops.push({k: "text", s, x, y, al: st.textAlign}); },
    measureText: (s) => ({width: String(s).length * 8}),
  };
  const c = new Proxy(base, {
    get(o, k) { if (k in o) return o[k]; if (k in st) return st[k]; return () => {}; },
    set(o, k, v) { st[k] = v; log.push(k + "=" + v); return true; },
  });
  return {c, ops, log, st, depth: () => depth};
}
const world = (level) => ({level, lives: 3, heat: 0, score: 123456, enemies: [], players: [{bombs: 1, range: 2}]});
const over = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/* the HUD band's occluders, read from drawHudChips itself */
function occluders(level) {
  const r = rec();
  drawHudChips(r.c, world(level), {on: true, t: 61});
  const o = r.ops.filter((p) => p.k === "rect" || p.k === "srect").map((p) => p.b);
  for (const p of r.ops.filter((q) => q.k === "text")) o.push(p.al === "right" ? [p.x - 8 * p.s.length, p.y - 7, p.x, p.y + 7] : [p.x, p.y - 7, p.x + 8 * p.s.length, p.y + 7]);
  /* hearts at their widest: the PIXEL x2 heart cell's opaque box (10x9 art px) */
  for (let i = 0; i < 3; i++) o.push([16 + i * 19 - 10, 16, 16 + i * 19 + 10, 34]);
  return o;
}

for (const px of [false, true]) {
  test("top corner pieces sit above the plate, off the HUD band and the playfield (" + (px ? "PIXEL" : "CLASSIC") + ")", () => {
    for (let level = 1; level <= 8; level++) {
      const r = rec(), occ = occluders(level);
      hudPlate(r.c, px, level);
      const plate = [8, 6, W - 8, T];
      const body = r.ops.findIndex((p) => p.a > 0.85 && (p.k === "path" || p.k === "rect") && p.b[2] - p.b[0] > W - 40);
      assert.ok(body >= 0, "plate body drawn");
      const caps = r.ops.slice(0, body), after = r.ops.slice(body + 1);
      const boss = after.filter((p) => p.b[3] > T && p.a === 1);
      for (const side of [0, 1]) {
        const mine = boss.filter((p) => (side ? p.b[0] > W - T : p.b[2] < T));
        assert.ok(mine.length >= 3, "L" + level + " side " + side + ": boss drawn after the plate (" + mine.length + ")");
        const [x0, y0, x1, y1] = mine.reduce((a, p) => [Math.min(a[0], p.b[0]), Math.min(a[1], p.b[1]), Math.max(a[2], p.b[2]), Math.max(a[3], p.b[3])], [1e9, 1e9, -1e9, -1e9]);
        assert.ok(y0 >= T && y1 <= 2 * T && x1 - x0 >= 20 && y1 - y0 >= 20, "L" + level + " boss whole under the plate: " + [x0, y0, x1, y1].map((v) => v.toFixed(1)));
      }
      for (const p of caps.concat(boss)) {
        const tag = "L" + level + " " + p.k + " " + p.b.map((v) => v.toFixed(1));
        assert.ok(p.b[2] <= T || p.b[0] >= W - T, tag + " stays in the corner columns");
        assert.ok(p.b[3] <= 2 * T, tag + " stays in the top two rows");
        assert.ok(!over(p.b, [T, T, W - T, H - T]), tag + " off the playfield");
        for (const o of occ) assert.ok(!over(p.b, o), tag + " clear of HUD item " + o);
      }
      for (const p of boss) assert.ok(!over(p.b, plate), "boss clear of the plate");
      assert.equal(r.depth(), 0, "save/restore balanced");
    }
  });
  test("hudPlate leaves the HUD band call log untouched (" + (px ? "PIXEL" : "CLASSIC") + ")", () => {
    const a = rec(), b = rec();
    drawHudChips(a.c, world(3), null);
    hudPlate(b.c, px, 3);
    const n = b.log.length;
    drawHudChips(b.c, world(3), null);
    assert.deepEqual(b.log.slice(n), a.log);
    assert.equal(b.st.globalAlpha, 1);
  });
}

test("CAPS: even logical px (PIXEL art grid), in the outer margin left of the panel", () => {
  for (const [x, y, w, h] of CAPS) {
    for (const v of [x, y, w, h]) assert.equal(v % 2, 0);
    assert.ok(y + h <= T);
  }
});
