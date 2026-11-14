/* The controller toast (owner 2026-11-12: "I connected the controller and it does not a toast or something that show user they can use
   controller"). controlswire writes app.padToast while a run PLAYs; main hands it to the HUD as o.padToast; the HUD shows it in the tile tip's
   plate and slots (beside the board on a desktop, under it on a portrait phone, the left gutter on a landscape one), never over the board or a
   live control, its words from words.js. It takes the slot over a tile tip for its 3 s, then the tile tip comes back. */
import test from "node:test";
import assert from "node:assert/strict";
import { rec } from "./lib/textrec.mjs";
import { hudGeo } from "../src/app/fit.js";
import { hudGeom, hudState } from "../src/render/hud.js";
import { PAD_TOAST } from "../src/render/words.js";
import { setTextScale } from "../src/render/kit/type.js";

const W0 = (o = {}) => ({ state: "PLAY", lives: 3, level: 3, heat: 0, score: 1240, enemies: [1, 2, 3, 4], players: [{ bombs: 2, range: 3, speed: 0, x: 60, y: 60 }], ...o });
const BOXES = [["d", 1366, 768], ["d", 1280, 720], ["d", 1024, 768], ["d", 1024, 640], ["p", 393, 852], ["p", 375, 667], ["l", 844, 390], ["l", 667, 375], ["l", 932, 430]];
const READY = { k: "ready", move: "D-PAD", bomb: "SOUTH", a: 1 };
const off = (a, b) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
const inView = (a, W, H) => a.x >= -0.5 && a.y >= -0.5 && a.x + a.w <= W + 0.5 && a.y + a.h <= H + 0.5;
const geomOf = (lay, W, H, world, o) => { const r = rec(), geo = hudGeo(W, H, 600, 520, lay, true), st = hudState(world, { time: { t: 3 }, ...o }); return { geo, st, G: hudGeom(r.ctx, geo, st, { w: W, h: H }) }; };

test("the toast's words are words.js's: the title, then the controller's own MOVE and BOMB", () => {
  const { st } = geomOf("d", 1366, 768, W0(), { padToast: READY });
  assert.equal(st.tip.s, PAD_TOAST.READY + " · " + PAD_TOAST.body("D-PAD", "SOUTH"));
  assert.equal(PAD_TOAST.body("D-PAD", "SOUTH"), "MOVE\u00a0D-PAD · BOMB\u00a0SOUTH");
  assert.equal(st.tip.t, null);
  assert.equal(geomOf("d", 1366, 768, W0(), { padToast: { ...READY, k: "back" } }).st.tip.s.split(" · ")[0], PAD_TOAST.BACK);
  assert.equal(geomOf("d", 1366, 768, W0(), { padToast: { ...READY, k: "lost" } }).st.tip.s, PAD_TOAST.LOST + " · " + PAD_TOAST.LOST_BODY);
});

for (const ts of [1, 1.25]) for (const [lay, W, H] of BOXES) test(`${lay} ${W}x${H} at ${ts}: the toast shows whole, off the board and the controls, no leader`, () => {
  setTextScale(ts);
  const { geo, G } = geomOf(lay, W, H, W0(), { padToast: READY });
  setTextScale(1);
  assert.ok(G.tip, "a slot takes it");
  const short = G.tip.name === PAD_TOAST.SHORT;
  assert.ok(G.tip.name === PAD_TOAST.READY || (lay === "l" && short), G.tip.name);
  assert.equal(G.tip.body, "whole", "the MOVE / BOMB line is kept");
  const said = [G.tip.name, ...G.tip.lines].join(" ");
  for (const w of ["READY", "MOVE", "D-PAD", "BOMB", "SOUTH"]) assert.ok(said.includes(w), said);
  for (const l of G.tip.lines) assert.ok(!/(^|\s)(D-PAD|SOUTH)$/.test(l.split("\u00a0")[0]) && !/(MOVE|BOMB)$/.test(l), "an action stays with its button: " + JSON.stringify(G.tip.lines));
  assert.equal(G.tip.lead, null);
  assert.ok(inView(G.tip.box, W, H), JSON.stringify(G.tip.box));
  assert.ok(off(G.tip.box, geo.stage), "never over the board");
  for (const r of Object.values(geo.strip || {})) assert.ok(off(G.tip.box, r), "never over a touch control");
  if (lay === "d") assert.ok(G.tip.box.y <= geo.stage.y + 24, "a desktop toast stands at the board's top, not its middle");
});

test("the toast takes the slot over a tile tip; off PLAY there is none", () => {
  const coach2 = { a: 1, s: "CONVEYOR · it carries you", k: "CONVEYOR" }, feat = new Uint8Array(15 * 13).fill(0);
  const tile = geomOf("d", 1366, 768, W0({ feat }), { coach2 });
  const both = geomOf("d", 1366, 768, W0({ feat }), { coach2, padToast: READY });
  assert.equal(both.st.tip.s.split(" · ")[0], PAD_TOAST.READY, JSON.stringify([tile.st.tip, both.st.tip]));
  assert.equal(geomOf("d", 1366, 768, W0({ state: "PAUSE" }), { padToast: READY }).st.tip, null);
});

test("the fade rides the tip's alpha", () => {
  assert.equal(geomOf("d", 1366, 768, W0(), { padToast: { ...READY, a: 0.4 } }).st.tip.a, 0.4);
});

/* R-LABELS fix round 1 (controller ruling 2026-11-14): a PlayStation pad's toast paints BOMB ✕, the glyph inline at the run's cap height; the text
   the probe and the live region read keeps the word, and the fit counts the glyph's own width */
test("a PlayStation pad's toast paints BOMB with the cross glyph inline, never the word", async () => {
  const { drawHud } = await import("../src/render/hud.js");
  const { worldTokens } = await import("../src/render/kit/tokens.js");
  const { runW } = await import("../src/render/kit/paint.js");
  const { T } = await import("../src/render/kit/type.js");
  const PS = { ...READY, bomb: "CROSS" };
  for (const [lay, W, H] of [["d", 1366, 768], ["p", 393, 852]]) {
    const { st, G } = geomOf(lay, W, H, W0(), { padToast: PS });
    assert.ok(G.tip && G.tip.body === "whole", lay);
    assert.ok(G.tip.lines.some((l) => /BOMB CROSS/.test(l)), "the plan keeps the word: " + JSON.stringify(G.tip.lines));
    const r = rec();
    drawHud(r.ctx, G, st, worldTokens(3), { rec: false });
    const ts = r.texts.map((t) => t.s);
    assert.ok(!ts.some((s) => /CROSS/.test(s)), "no CROSS written: " + JSON.stringify(ts));
    assert.ok(ts.some((s) => /BOMB $/.test(s)), "BOMB, then the glyph: " + JSON.stringify(ts));
  }
  const c = rec().ctx, f = T.body(18);
  assert.ok(runW(c, f, "BOMB CROSS") < runW(c, f, "BOMB SOUTH"), "the fit counts the glyph's width, not the word's");
});
