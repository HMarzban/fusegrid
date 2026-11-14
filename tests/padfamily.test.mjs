/* R-LABELS (owner 2026-11-14): "our system must be smart and detact true and show the users the right lable". The family of the controller in the
   player's hands from its Gamepad id (Chrome and Firefox forms, the Switch 2 bridge), the words each family prints, says and paints, the hint words
   that follow it, a generic pad reading its positions exactly as before, and a family switch that re-lays the hints once. */
import test from "node:test";
import assert from "node:assert/strict";
import { familyOf, FAMILY_LABEL, FAMILIES, btnWord, btnSay, btnCap, tabWord } from "../src/app/padfamily.js";
import { BTN, DEF_CONTROLS, bindBtn } from "../src/app/controls.js";
import { createPad } from "../src/app/gamepad.js";
import { wordsOf } from "../src/app/hints.js";
import { PAD_FAMILY_WORDS, padWord } from "../src/render/words.js";
import { rowsOf, footItems, footText, statusOf, padCallouts, capCallouts, inUseLine, DEF_PAD, BTN as RBTN } from "../src/render/controlsgeo.js";
import { cap, capW, key, glyph, PAD_GLYPH } from "../src/render/kit/paint.js";
import { worldTokens } from "../src/render/kit/tokens.js";
import { drawPad } from "../src/render/padart.js";
import { rec } from "./lib/textrec.mjs";

const ID = {
  xboxChrome: "XBOX 360 For Windows (STANDARD GAMEPAD Vendor: 045e Product: 028e)",
  xboxOne: "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)",
  xboxFirefox: "045e-028e-Microsoft X-Box 360 pad",
  psChrome: "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)",
  ps4Chrome: "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)",
  psFirefox: "054c-0ce6-DualSense Wireless Controller",
  sw2: "Switch 2 Pro Controller (Vendor: 057e Product: 2069)",
  sw2Bridge: "Switch 2 Pro Controller (bridge) (STANDARD GAMEPAD Vendor: 057e Product: 2069)",
  proFirefox: "057e-2009-Pro Controller",
  unknown: "Logitech Dual Action (STANDARD GAMEPAD Vendor: 046d Product: c216)",
};

test("familyOf: the vendor id in Chrome's and Firefox's forms, the Switch 2 and its bridge", () => {
  for (const k of ["xboxChrome", "xboxOne", "xboxFirefox"]) assert.equal(familyOf(ID[k]), "xbox", k);
  for (const k of ["psChrome", "ps4Chrome", "psFirefox"]) assert.equal(familyOf(ID[k]), "playstation", k);
  for (const k of ["sw2", "sw2Bridge", "proFirefox"]) assert.equal(familyOf(ID[k]), "nintendo", k);
  assert.equal(familyOf(ID.unknown), "generic");
});

test("familyOf: by name where no vendor id says; a product id that looks like a vendor is not one", () => {
  assert.equal(familyOf("Xbox Wireless Controller"), "xbox");
  assert.equal(familyOf("Sony DualShock 4"), "playstation");
  assert.equal(familyOf("PLAYSTATION(R)3 Controller"), "playstation");
  assert.equal(familyOf("Joy-Con (L/R)"), "nintendo");
  assert.equal(familyOf("Nintendo Switch Pro Controller"), "nintendo");
  assert.equal(familyOf("Generic USB Joystick (Vendor: 0079 Product: 045e)"), "generic");
  assert.equal(familyOf("8BitDo SN30 (Vendor: 2dc8 Product: 6101)"), "generic");
  for (const v of [undefined, null, "", 42, {}]) assert.equal(familyOf(v), "generic");
});

test("FAMILY_LABEL: the brief's words for every button; nintendo by position; generic is BTN's", () => {
  const w = (f, ids) => ids.map((id) => FAMILY_LABEL[f][id].w);
  const FACE = ["S", "E", "W", "N"], SH = ["SHL", "SHR", "TRL", "TRR"], MID = ["SELECT", "START"];
  assert.deepEqual(w("xbox", FACE), ["A", "B", "X", "Y"]);
  assert.deepEqual(w("xbox", SH), ["LB", "RB", "LT", "RT"]);
  assert.deepEqual(w("xbox", MID), ["VIEW", "MENU"]);
  assert.deepEqual(w("playstation", FACE), ["CROSS", "CIRCLE", "SQUARE", "TRIANGLE"]);
  assert.deepEqual(w("playstation", SH), ["L1", "R1", "L2", "R2"]);
  assert.deepEqual(w("playstation", MID), ["CREATE", "OPTIONS"]);
  assert.deepEqual(w("nintendo", FACE), ["B", "A", "Y", "X"]);
  assert.deepEqual(w("nintendo", SH), ["L", "R", "ZL", "ZR"]);
  assert.deepEqual(w("nintendo", MID), ["−", "+"]);
  assert.deepEqual(MID.map((id) => FAMILY_LABEL.nintendo[id].a), ["MINUS", "PLUS"]);
  for (const id of [...FACE, ...SH, ...MID]) assert.deepEqual([FAMILY_LABEL.generic[id].w, FAMILY_LABEL.generic[id].s], [BTN[id].w, BTN[id].s], id);
  assert.deepEqual(FAMILIES, ["xbox", "playstation", "nintendo", "generic"]);
  assert.equal(btnWord("dpad", "xbox"), "D-PAD");
  assert.equal(btnWord("S", "nonsense"), "SOUTH");
  assert.equal(btnSay("SELECT", "nintendo"), "MINUS");
  assert.equal(tabWord("generic"), "SHOULDERS");
  assert.equal(tabWord("xbox"), "LB RB");
  assert.deepEqual(["S", "E", "W", "N"].map((id) => btnCap(id, "playstation")), ["✕", "○", "□", "△"]);
  assert.equal(btnCap("S", "xbox"), "A");
});

test("words.js PAD_FAMILY_WORDS is FAMILY_LABEL word for word (render never imports src/app)", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(PAD_FAMILY_WORDS)), JSON.parse(JSON.stringify(FAMILY_LABEL)));
  assert.equal(padWord("W", "xbox"), "X");
  assert.equal(padWord("W", undefined), "WEST");
});

test("the pad snap carries the family of the active pad; the id goes no further", () => {
  const list = [{ id: ID.psChrome, index: 0, connected: true, mapping: "standard", buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }];
  const pad = createPad({ getGamepads: () => list });
  const s = pad.poll(0);
  assert.equal(s.family, "playstation");
  assert.ok(!JSON.stringify({ ...s, down: [...s.down] }).includes("054c"), "no id in the snap");
  list[0] = null;
  assert.equal(pad.poll(16).family, "generic");
});

test("wordsOf: a generic pad reads exactly as before; Xbox, PlayStation and Nintendo name their buttons", () => {
  const G = { dev: "pad", ok: "SOUTH", back: "EAST", tab: "SHOULDERS", pause: "START", bomb: "SOUTH", throw: "WEST", remote: "EAST", move: "D-PAD", moveAlt: "L-STICK", moveCaps: null, tapPage: false };
  assert.deepEqual(wordsOf("pad", DEF_CONTROLS), G);
  assert.deepEqual(wordsOf("pad", DEF_CONTROLS, undefined, "generic"), G);
  const x = wordsOf("pad", DEF_CONTROLS, undefined, "xbox");
  assert.deepEqual([x.ok, x.back, x.bomb, x.throw, x.remote, x.pause, x.tab, x.family], ["A", "B", "A", "X", "B", "MENU", "LB RB", "xbox"]);
  const p = wordsOf("pad", DEF_CONTROLS, undefined, "playstation");
  assert.deepEqual([p.ok, p.back, p.bomb, p.pause], ["CROSS", "CIRCLE", "CROSS", "OPTIONS"]);
  assert.equal(p.say.bomb, "CROSS");
  const n = wordsOf("pad", DEF_CONTROLS, undefined, "nintendo");
  assert.deepEqual([n.ok, n.back, n.bomb, n.pause, n.say.pause], ["B", "A", "B", "+", "PLUS"]);
  assert.equal(wordsOf("pad", bindBtn(DEF_CONTROLS, "THROW", "SHL").c, undefined, "xbox").throw, "LB");
  assert.deepEqual(wordsOf("key", DEF_CONTROLS, undefined, "xbox"), wordsOf("key", DEF_CONTROLS), "the keyboard's words never take a family");
});

const view = (family, o = {}) => ({ tab: "pad", device: "pad", row: 1, pad: { state: "ready", name: "CONTROLLER 1", family, rumble: true, effects: ["dual-rumble"] }, key: DEF_CONTROLS.key, binds: DEF_PAD, stick: "L", dead: 25, vib: 2, ...o });
test("CONTROLS rows, foot, status and callouts read the family's words; a generic pad's are BTN's own", () => {
  const rows = (f) => Object.fromEntries(rowsOf(view(f)).map((r) => [r.id, (r.val || []).map((v) => v.w)]));
  assert.deepEqual(rows("xbox").BOMB, ["A"]);
  assert.deepEqual(rows("xbox").REMOTE, ["B"]);
  assert.deepEqual(rows("xbox").PAUSE, ["MENU", "VIEW"]);
  assert.deepEqual(rows("playstation").THROW, ["SQUARE"]);
  assert.deepEqual(rows("nintendo").BOMB, ["B"]);
  const g = rowsOf(view("generic"));
  assert.equal(g.find((r) => r.id === "BOMB").val[0], RBTN.S, "a generic row holds BTN's own object");
  assert.deepEqual(rows("generic").BOMB, ["SOUTH"]);
  const row = rowsOf(view("xbox"))[1];
  assert.equal(footText(footItems(view("xbox"), row, {})), "ROW ↑↓ · TAB ←→ · CHANGE A · BACK B");
  assert.equal(footText(footItems(view("generic"), row, {})), "ROW ↑↓ · TAB ←→ · CHANGE SOUTH · BACK EAST");
  const sens = rowsOf(view("playstation")).find((r) => r.id === "SENSITIVITY");
  assert.deepEqual(footItems(view("playstation"), sens, {}).find((q) => q.t === "TAB").caps, ["L1", "R1"]);
  assert.match(statusOf(view("xbox"), rowsOf(view("xbox")).find((r) => r.id === "PAUSE")), /^MENU ALWAYS PAUSES · A REBINDS/);
  assert.deepEqual(padCallouts(view("xbox")).filter((q) => q.grp === "S" || q.grp === "W").map((q) => q.pos[0]), ["A", "X"]);
  assert.deepEqual(capCallouts(view("playstation"), "BOMB")[0].pos, ["NOW CROSS"]);
  assert.equal(inUseLine(view("xbox"), "BOMB"), "X WAS THROW · THROW NOW A");
  const ns = view("xbox", { pad: { state: "nonstd", name: "CONTROLLER 1 · BUTTONS 0-15", family: "xbox", rumble: false, effects: null } });
  assert.deepEqual(rowsOf(ns).find((r) => r.id === "BOMB").val, [{ cap: "BUTTON 0" }], "a non-standard pad keeps its button numbers");
});

const tok = worldTokens(1);
test("kit keycaps paint PlayStation's four faces as glyphs, never as the word; other caps keep their legends", () => {
  for (const w of ["CROSS", "CIRCLE", "SQUARE", "TRIANGLE"]) {
    const r = rec();
    cap(r.ctx, 0, 0, w, { tok });
    assert.ok(!r.texts.some((t) => t.s === w), w + " is painted, not written");
    assert.ok(r.paints.some((p) => p.op === "stroke"), w + " strokes its glyph");
    assert.equal(capW(r.ctx, w), capW(r.ctx, "A"), "a glyph cap is the narrowest cap");
    const k = rec();
    key(k.ctx, 0, 0, 40, 30, "key", { tok, label: w });
    assert.ok(!k.texts.some((t) => t.s === w));
  }
  const r = rec();
  cap(r.ctx, 0, 0, "A", { tok });
  assert.ok(r.texts.some((t) => t.s === "A"));
  assert.deepEqual(Object.values(PAD_GLYPH), ["cross", "circle", "square", "triangle"]);
  const g = rec();
  for (const n of Object.values(PAD_GLYPH)) glyph(g.ctx, n, 0, 0, 16, "#fff");
  assert.equal(g.paints.filter((p) => p.op === "stroke").length, 4);
});

test("the controller drawing's face legends follow the family; a generic pad draws none (its calls unchanged)", () => {
  const calls = (fam) => { const r = rec(); drawPad(r.ctx, 0, 0, 300, { tok, lit: { S: "lit" }, fam }); return r; };
  const g0 = rec();
  drawPad(g0.ctx, 0, 0, 300, { tok, lit: { S: "lit" } });
  const g = calls("generic");
  assert.equal(JSON.stringify(g.paints), JSON.stringify(g0.paints));
  assert.deepEqual(g.texts.map((t) => t.s), []);
  assert.deepEqual(calls("xbox").texts.map((t) => t.s).sort(), ["A", "B", "X", "Y"]);
  assert.deepEqual(calls("nintendo").texts.map((t) => t.s).sort(), ["A", "B", "X", "Y"]);
  const ps = calls("playstation");
  assert.deepEqual(ps.texts.map((t) => t.s), []);
  assert.ok(ps.paints.filter((p) => p.op === "stroke").length > g.paints.filter((p) => p.op === "stroke").length);
  const lock = rec();
  drawPad(lock.ctx, 0, 0, 300, { tok, lock: true, fam: "xbox" });
  assert.deepEqual(lock.texts.map((t) => t.s), [], "no controller: no legends");
});

import { createControlsPage } from "../src/app/controlspage.js";
test("CONTROLS' live region and its notes say the family's words: CROSS, never the glyph; MINUS for Nintendo's −", () => {
  const rig = (family) => {
    const r = { c: DEF_CONTROLS, said: [], pv: { state: "ready", name: "CONTROLLER 1", family, rumble: true, effects: ["dual-rumble"], stickVal: [0, 0] } };
    r.p = createControlsPage({ get: () => r.c, set: (c) => { r.c = c; }, padView: () => r.pv, say: (s) => r.said.push(s), device: () => "pad" });
    r.p.open("pad");
    return r;
  };
  const ps = rig("playstation");
  ps.p.walk(1, 1); // onto THROW
  assert.equal(ps.said.at(-1), "Throw, SQUARE. 3 of 8.");
  assert.equal(ps.p.view(0).pad.family, "playstation");
  ps.p.walk(-1, 1);
  assert.equal(ps.said.at(-1), "Bomb, CROSS. 2 of 8.");
  ps.p.confirm(0); // listen for BOMB: the capture says what it has now
  assert.equal(ps.p.view(0).capture.sub, "NOW CROSS");
  assert.match(ps.p.view(0).capture.foot, /^OPTIONS CANCELS/);
  ps.p.tick(10, false); ps.p.tick(400, false);
  ps.p.feedBtn("W", 500); // SQUARE is THROW's: the two swap, the note in the pad's own words
  assert.equal(ps.p.view(600).status, "SQUARE WAS THROW · THROW NOW CROSS");
  const n = rig("nintendo");
  for (let i = 0; i < 3; i++) n.p.walk(1, 1); // onto PAUSE
  assert.equal(n.said.at(-1), "Pause, PLUS and MINUS. 5 of 8.");
  const g = rig("generic");
  assert.equal(g.p.view(0).capture, null);
  g.p.walk(-1, 1); g.p.walk(1, 1);
  assert.equal(g.said.at(-1), "Bomb, SOUTH. 2 of 8.");
});

test("the update card's keycaps follow the controller in hand (a DOM keycap: PlayStation's faces as their characters)", () => {
  assert.deepEqual(["S", "E"].map((id) => btnCap(id, "playstation")), ["✕", "○"]);
  assert.deepEqual(["S", "E"].map((id) => btnCap(id, "generic")), ["SOUTH", "EAST"]);
  assert.deepEqual(["S", "E"].map((id) => btnCap(id, "nintendo")), ["B", "A"]);
});

import { runText, runW, hasPadGlyph } from "../src/render/kit/paint.js";
import { text as kitText, measure } from "../src/render/kit/type.js";
test("a painted text run draws a PlayStation face word as its glyph inline; a run without one is kit text call for call", () => {
  const f = "700 16px sans-serif", a = rec(), b = rec();
  runText(a.ctx, "MOVE D-PAD · CONFIRM SOUTH", 100, 50, f, "#fff", "center");
  kitText(b.ctx, "MOVE D-PAD · CONFIRM SOUTH", 100, 50, f, "#fff", "center");
  assert.equal(JSON.stringify([a.texts, a.paints]), JSON.stringify([b.texts, b.paints]));
  assert.equal(runW(a.ctx, f, "A B"), measure(a.ctx, f, "A B"));
  const g = rec();
  runText(g.ctx, "CONFIRM CROSS · BACK CIRCLE", 100, 50, f, "#fff", "center");
  assert.deepEqual(g.texts.map((t) => t.s), ["CONFIRM ", " · BACK "]);
  assert.equal(g.paints.filter((p) => p.op === "stroke").length, 2);
  const w = runW(g.ctx, f, "CONFIRM CROSS · BACK CIRCLE");
  assert.ok(Math.abs(g.texts[0].x - (100 - w / 2)) < 1e-9, "centred on the run's drawn width");
  assert.ok(hasPadGlyph("BOMB CROSS") && !hasPadGlyph("CROSSING") && !hasPadGlyph("SOUTH"));
});
