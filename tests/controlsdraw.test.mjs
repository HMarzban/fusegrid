// CONTROLS page model (T4; Task 6.3 moved the page to the world kit, tests/page-controls.test.mjs): rows, rules, foot items, lit and ringed parts, callout plans, the copies that mirror the model.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { layout, drawSettings } from "../src/render/menudraw.js";
import * as lazyPages from "../src/render/pages/lazy.js";
import * as settingsPage from "../src/render/pages/settings.js";
lazyPages._set("settings", settingsPage); // the lazy SETTINGS page, in as if its import had landed (R20)
import { CAPTION, rowsOf, statusOf, footItems, footText, padStates, padRing, keyStates, keyRing, keyCallouts, kbPlan, padLabels, keyName, moveLabel, softAliasesOf, BTN, DEF_KEY, DEF_PAD, DEF_VIB, VIB_LEVELS, SENS_LEVELS, sensIdx, vibWord, NO_VIB, FEEL_NOTHING, STATUS } from "../src/render/controlsgeo.js";
import { PART_AT, BODY_PATH, KB_AT, keyRect, kbPrints, kbLegend, trace, glyph, drawPad, drawKeys } from "../src/render/padart.js";
import { worldTokens, CONST } from "../src/render/kit/tokens.js";
import * as model from "../src/app/controls.js";
import * as ctlPage from "../src/render/pages/controls.js";
import { optRows } from "../src/app/menuapp.js";
import { FOOT_TAP } from "../src/render/kit/copy.js";
import { shellGeo, fitBox } from "../src/app/fit.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

/* A canvas stand-in: no Path2D, no roundRect, no setLineDash, as the headless stub in renderer.js.
   Tracks translate + uniform scale so a font check reads the size the player sees. */
function recCtx() {
  const stack = [];
  let sx = 1, tx = 0, ty = 0;
  const log = [], texts = [], rects = [];
  const px = (f) => +/([\d.]+)px/.exec(f)[1];
  const c = {
    fillStyle: "#000", strokeStyle: "#000", font: "10px ui-monospace,monospace", globalAlpha: 1, textAlign: "left", textBaseline: "alphabetic", lineWidth: 1, lineCap: "butt", lineJoin: "miter",
    save() { stack.push([sx, tx, ty, c.fillStyle, c.strokeStyle, c.font, c.globalAlpha, c.textAlign, c.textBaseline, c.lineWidth, c.lineCap, c.lineJoin]); log.push("save"); },
    restore() { [sx, tx, ty, c.fillStyle, c.strokeStyle, c.font, c.globalAlpha, c.textAlign, c.textBaseline, c.lineWidth, c.lineCap, c.lineJoin] = stack.pop(); log.push("restore"); },
    translate(x, y) { tx += sx * x; ty += sx * y; log.push("t"); },
    scale(k) { sx *= k; log.push("s"); },
    beginPath() { log.push("bp"); }, closePath() { log.push("cp"); },
    moveTo(x, y) { log.push("m" + x + "," + y); }, lineTo(x, y) { log.push("l" + x + "," + y); },
    arc(x, y, r, a0, a1) { log.push("a" + [tx + sx * x, ty + sx * y, sx * r, a0, a1].join()); }, arcTo(...a) { log.push("at" + a.join()); },
    bezierCurveTo(...a) { log.push("bz" + a.join()); }, quadraticCurveTo(...a) { log.push("q" + a.join()); },
    fill() { log.push("f" + c.fillStyle); }, stroke() { log.push("k" + c.strokeStyle); },
    fillRect(...a) { log.push("fr" + a.join()); rects.push({ x: a[0], y: a[1], w: a[2], h: a[3], fill: c.fillStyle, alpha: c.globalAlpha }); }, strokeRect(...a) { log.push("sr" + a.join()); },
    measureText(s) { return { width: String(s).length * px(c.font) * 0.6 }; },
    fillText(s, x, y) {
      const size = px(c.font), w = String(s).length * size * 0.6 * sx, wx = tx + sx * x, wy = ty + sx * y;
      const left = c.textAlign === "center" ? wx - w / 2 : c.textAlign === "right" ? wx - w : wx;
      texts.push({ s: String(s), x: wx, y: wy, left, right: left + w, px: size * sx, mono: /monospace/.test(c.font), fill: c.fillStyle, alpha: c.globalAlpha });
      log.push("x" + s);
    },
  };
  return { c, log, texts, rects };
}
const L600 = layout(600, 520), PR = { state: "ready", name: "CONTROLLER 1", rumble: true }, NON = { state: "nonstd", name: "CONTROLLER 1 · BUTTONS 0-16", rumble: false };
const keyV = (o) => ({ tab: "key", device: "key", row: 1, pad: { state: "none" }, key: DEF_KEY, binds: DEF_PAD, stick: "L", dead: 25, vib: 2, stickVal: [0.06, -0.03], reads: "", drift: 0.06, armed: false, swap: null, status: "", capture: null, echo: null, ...o });
const padV = (o) => keyV({ tab: "pad", device: "pad", pad: PR, ...o });
const CAP = { action: "THROW", prompt: "PRESS A BUTTON", sub: "NOW WEST", foot: "START CANCELS · WEST KEEPS IT" };
const STATES = {
  keyboard: keyV(), controller: padV(),
  "key CONFIRM (fixed)": keyV({ row: 5 }), "key BACK (fixed)": keyV({ row: 6 }), "key RESET": keyV({ row: 7 }), "key RESET armed": keyV({ row: 7, armed: true }),
  "pad RESET armed": padV({ row: 7, armed: true }), "pad MOVE": padV({ row: 0 }), "pad PAUSE": padV({ row: 4 }), "pad SENSITIVITY": padV({ row: 5, stickVal: [-0.42, -0.1], reads: "LEFT" }), "pad VIBRATION": padV({ row: 6 }), "pad VIBRATION OFF": padV({ row: 6, vib: 0 }), "pad effects unknown": padV({ row: 6, pad: { ...PR, effects: null } }), "pad SENSITIVITY MIN": padV({ row: 5, dead: 60 }), "pad SENSITIVITY MAX": padV({ row: 5, dead: 8 }), "pad no actuator": padV({ row: 6, pad: { ...PR, rumble: false } }),
  "no pad": keyV({ tab: "pad", row: 1 }), "no pad on touch": keyV({ tab: "pad", row: 1, device: "touch" }), lost: padV({ pad: { state: "lost" } }), nonstd: padV({ pad: NON }), "nonstd PAUSE": padV({ pad: NON, row: 4 }),
  "pad swap": padV({ binds: { ...DEF_PAD, BOMB: "E", REMOTE: "S" }, swap: { row: "REMOTE", part: "S" }, status: "EAST WAS REMOTE · REMOTE NOW SOUTH" }),
  "key swap": keyV({ key: { ...DEF_KEY, BOMB: "KeyQ", REMOTE: "Space" }, swap: { row: "REMOTE" }, status: "Q WAS REMOTE · REMOTE NOW SPACE" }),
  "selected swap": padV({ row: 3, swap: { row: "REMOTE" } }), "PAUSE swapped": padV({ row: 1, binds: { ...DEF_PAD, PAUSE: "TRR" }, swap: { row: "PAUSE" } }), "MOVE swapped": keyV({ row: 2, swap: { row: "MOVE" } }), "nonstd with actuator": padV({ pad: { ...NON, rumble: true }, row: 6 }),
  "capture pad": padV({ row: 2, capture: CAP }), "capture key refused": keyV({ row: 2, capture: { action: "MOVE · 1 OF 4", prompt: "PRESS UP", sub: "ARROWS ALWAYS MOVE · PICK ANOTHER", warn: 1, foot: "ESC CANCELS" } }),
  changed: keyV({ key: { ...DEF_KEY, THROW: "KeyZ" }, row: 2 }), "long keys": keyV({ key: { ...DEF_KEY, MOVE: ["Numpad8", "Numpad6", "Numpad9", "Numpad7"], PAUSE: "Backquote" }, row: 0 }), "touch device": padV({ device: "touch" }), echo: padV({ echo: "N" }),
  "long shoulder": padV({ binds: { ...DEF_PAD, BOMB: "SHL", THROW: "TRR" }, row: 2 }), "right stick": padV({ stick: "R", row: 0 }),
};
const BOXES = [["600x520", L600, false, false, undefined], ["608x352 guard", layout(608, 352), false, false, undefined], ["touch #c 0.63", L600, true, false, 0.63], ["touch #c 0.73", L600, true, false, 0.73], ["shell 436x946", layout(436, 946), true, true, 0.9], ["shell 400 wide", layout(400, 700), true, true, 0.76]];

// geometry, hit = paint, touch floors and the paint in every state: tests/page-controls.test.mjs (Task 6.3, the page on the world kit)

// rows and tables
{
  const k = rowsOf(keyV());
  check("rowsOf(key) = 8 rows in the record's order", k.map((r) => r.id).join() === "MOVE,BOMB,THROW,REMOTE,PAUSE,CONFIRM,BACK,RESET");
  check("CONFIRM / BACK fixed, RESET KEYS", k[5].fixed && k[6].fixed && k[7].label === "RESET KEYS" && k[7].reset);
  check("key values read the live binds", k[0].val[0].cap === "WASD" && k[0].val[1].cap === "ARROWS" && k[1].val[0].cap === "SPACE" && k[2].val[0].cap === "E" && k[3].val[0].cap === "Q" && k[4].val[0].cap === "ESC" && k[4].val[1].cap === "P");
  check("J · X note while both still work", k[1].note === "J · X ALSO WORK");
  const x = rowsOf(keyV({ key: { ...DEF_KEY, THROW: "KeyX" } }));
  check("only J left once X is taken: the note does not lie", x[1].note === "J ALSO WORKS");
  check("no alias note once BOMB moves", !rowsOf(keyV({ key: { ...DEF_KEY, BOMB: "KeyZ" } }))[1].note);
  const p = rowsOf(padV());
  check("rowsOf(pad) has SENSITIVITY / VIBRATION / RESET CONTROLLER", p.map((r) => r.id).join() === "MOVE,BOMB,THROW,REMOTE,PAUSE,SENSITIVITY,VIBRATION,RESET" && p[7].label === "RESET CONTROLLER" && p[5].text === "MEDIUM" && p[6].text === "MEDIUM");
  check("pad values use position words", p[1].val[0].w === "SOUTH" && p[2].val[0].w === "WEST" && p[3].val[0].w === "EAST" && p[4].val[0].w === "START" && p[4].val[1].w === "SELECT" && p[0].val[0].w === "D-PAD" && p[0].val[1].w === "L-STICK");
  check("a stick swap reads R-STICK", rowsOf(padV({ stick: "R" }))[0].val[1].w === "R-STICK");
  const n = rowsOf(padV({ pad: NON }));
  check("nonstd reads BUTTON n", n[1].val[0].cap === "BUTTON 0" && n[2].val[0].cap === "BUTTON 2" && n[3].val[0].cap === "BUTTON 1" && n[4].val[0].cap === "BUTTON 9" && n[4].val[1].cap === "BUTTON 8" && n[6].text === "NONE");
  check("a pad with no actuator reads NONE, the levels follow the store", rowsOf(padV({ pad: { ...PR, rumble: false } }))[6].text === "NONE" && VIB_LEVELS.every((w, i) => rowsOf(padV({ vib: i }))[6].text === w) && statusOf(padV({ row: 6, pad: { ...PR, rumble: false } }), rowsOf(padV())[6]) === NO_VIB && NO_VIB === "NO VIBRATION ON THIS CONTROLLER OR BROWSER");
  check("no actuator keeps the stored level, and shows no change", !rowsOf(padV({ vib: 0, pad: { ...PR, rumble: false } }))[6].changed && !rowsOf(padV({ vib: 0, pad: { ...PR, rumble: false } }))[6].bar);
  check("SENSITIVITY reads the level name, off-level values snap to the nearest", SENS_LEVELS.every((l) => rowsOf(padV({ dead: l.dead }))[5].text === l.name) && rowsOf(padV({ dead: 30 }))[5].text === "MEDIUM" && rowsOf(padV({ dead: 5 }))[5].text === "MAX" && rowsOf(padV({ dead: 55 }))[5].text === "MIN" && sensIdx(25) === 2);
  check("the segment bars fill by level index, never by the dead value", rowsOf(padV({ dead: 60 }))[5].bar.join() === "1,5" && rowsOf(padV({ dead: 8 }))[5].bar.join() === "5,5" && rowsOf(padV({ vib: 0 }))[6].bar.join() === "0,3" && rowsOf(padV({ vib: 3 }))[6].bar.join() === "3,3");
  check("the unknown-effects line joins only while on", statusOf(padV({ pad: { ...PR, effects: null } }), rowsOf(padV())[6]) === "HITS, BLASTS, PLANTS AND MENUS · LOW SKIPS MENUS · " + FEEL_NOTHING && statusOf(padV({ vib: 0, pad: { ...PR, effects: null } }), rowsOf(padV())[6]) === "NO VIBRATION AT ALL" && statusOf(padV(), rowsOf(padV())[6]) === "HITS, BLASTS, PLANTS AND MENUS · LOW SKIPS MENUS");
  check("the rule follows the level", ["NO VIBRATION AT ALL", "HITS, BIG BLASTS AND LEVEL ENDS · NO MENU BUZZ", "HITS, BLASTS, PLANTS AND MENUS · LOW SKIPS MENUS", "HITS, BLASTS, PLANTS AND MENUS · STRONGEST"].every((w, i) => statusOf(padV({ vib: i }), rowsOf(padV())[6]) === w));
  check("vibWord: only a connected pad with an actuator and a stored level", vibWord(padV({ vib: 1 })) === "LOW" && vibWord(padV({ vib: 0 })) === "OFF" && vibWord(padV({ pad: { ...PR, rumble: false } })) === "" && vibWord(padV({ pad: { state: "lost", rumble: true } })) === "" && vibWord(keyV()) === "" && vibWord(padV({ vib: undefined })) === "" && vibWord(padV({ pad: { ...NON, rumble: true } })) === "MEDIUM");
  check("a non-standard pad reads its actuator, not its mapping", rowsOf(padV({ pad: NON }))[6].text === "NONE" && rowsOf(padV({ pad: { ...NON, rumble: true } }))[6].text === "MEDIUM" && statusOf(padV({ pad: { ...NON, rumble: true } }), rowsOf(padV())[6]) === "HITS, BLASTS, PLANTS AND MENUS · LOW SKIPS MENUS" && statusOf(padV({ pad: NON }), rowsOf(padV())[5]) === "HOW FAR THE STICK MOVES BEFORE IT COUNTS");
  check("no pad never reads a level: NONE on the dimmed row", rowsOf(keyV({ tab: "pad", pad: { state: "none" } }))[6].text === "NONE" && rowsOf(padV({ pad: { state: "lost" } }))[6].text === "NONE");
  check("vibration changed compares with the default", DEF_VIB === model.DEF_CONTROLS.vib && !rowsOf(padV())[6].changed && rowsOf(padV({ vib: 0 }))[6].changed);
  check("the level copies mirror the model", JSON.stringify(VIB_LEVELS) === JSON.stringify(model.VIB_LEVELS) && SENS_LEVELS.map((l) => l.name + l.dead).join() === model.SENS_LEVELS.map((l) => l.name + l.dead).join() && SENS_LEVELS.map((l) => l.name + l.dead).join() === "MIN60,LOW40,MEDIUM25,HIGH15,MAX8");
  const nm = rowsOf(keyV({ key: { ...DEF_KEY, THROW: "KeyZ", MOVE: ["KeyZ", "KeyD", "KeyS", "KeyA"] }, names: { KeyZ: "y" } }));
  check("a printed key name from the reducer wins (layout honesty)", nm[2].val[0].cap === "Y" && nm[0].val[0].cap === "YASD");
  check("no pad keeps the values, marked off", rowsOf(keyV({ tab: "pad" })).slice(0, 7).every((r) => r.off) && rowsOf(keyV({ tab: "pad" }))[1].val[0].w === "SOUTH");
  check("changed from default is flagged per row", rowsOf(keyV({ key: { ...DEF_KEY, THROW: "KeyZ" } }))[2].changed && !rowsOf(keyV())[2].changed && rowsOf(padV({ dead: 30 }))[5].changed && rowsOf(padV({ stick: "R" }))[0].changed);
}
{
  const say = (v) => statusOf(v, rowsOf(v)[v.row]);
  const T = [
    ["key default rule", keyV({ row: 2 }), "NEEDS THE THROW POWER-UP · TOSS A BOMB"],
    ["key BOMB names the aliases still alive", keyV({ row: 1 }), "PLANT A BOMB · J · X ALSO WORK"],
    ["key MOVE", keyV({ row: 0 }), "ARROWS ALWAYS MOVE · ENTER REBINDS WASD"],
    ["key PAUSE", keyV({ row: 4 }), "ESC ALWAYS PAUSES · ENTER REBINDS THE SECOND KEY"],
    ["locked", keyV({ row: 5 }), "ENTER AND ESC STAY PUT SO YOU CAN ALWAYS GET BACK"],
    ["reset idle", keyV({ row: 7 }), "BACK TO THE DEFAULTS · THIS TAB ONLY"],
    ["reset armed", keyV({ row: 7, armed: true }), "PRESS AGAIN TO RESET THIS TAB"],
    ["reset done keys", keyV({ row: 7, status: STATUS.doneKey }), "KEYBOARD BACK TO DEFAULTS"],
    ["reset done pad", padV({ row: 7, status: STATUS.donePad }), "CONTROLLER BACK TO DEFAULTS"],
    ["reset nothing", keyV({ row: 7, status: STATUS.nothing }), "ALREADY ON THE DEFAULTS"],
    ["no pad", keyV({ tab: "pad" }), "IT WAKES ON ITS FIRST PRESS · USB OR BLUETOOTH"],
    ["no pad, touch", keyV({ tab: "pad", device: "touch" }), "PAIR ONE AND PRESS ANY BUTTON"],
    ["pad lost", padV({ pad: { state: "lost" } }), "PLUG IT BACK IN OR PRESS ANY BUTTON"],
    ["pad back", padV({ status: STATUS.back }), "CONTROLLER BACK"],
    ["cancelled", padV({ status: STATUS.cancelled }), "CANCELLED · NOTHING CHANGED"],
    ["same bind", padV({ status: STATUS.same }), "NO CHANGE"],
    ["swap", padV({ status: "EAST WAS REMOTE · REMOTE NOW SOUTH" }), "EAST WAS REMOTE · REMOTE NOW SOUTH"],
    ["nonstd", padV({ pad: NON }), "NON-STANDARD BUTTONS · TEST EACH ONE · REBIND IF WRONG"],
    ["pad MOVE", padV({ row: 0 }), "D-PAD ALWAYS MOVES · SOUTH SWITCHES THE STICK"],
    ["pad PAUSE", padV({ row: 4 }), "START ALWAYS PAUSES · SOUTH REBINDS THE SECOND BUTTON"],
    ["pad MOVE on keys names ENTER", padV({ row: 0, device: "key" }), "D-PAD ALWAYS MOVES · ENTER SWITCHES THE STICK"],
    ["no actuator", padV({ row: 6, pad: { ...PR, rumble: false } }), "NO VIBRATION ON THIS CONTROLLER OR BROWSER"],
    ["sensitivity rule", padV({ row: 5 }), "HOW FAR THE STICK MOVES BEFORE IT COUNTS"],
    ["sensitivity rule at HIGH", padV({ row: 5, dead: 15 }), "SENSITIVE: A WORN STICK CAN KEEP WALKING"],
    ["sensitivity rule at MAX", padV({ row: 5, dead: 8 }), "SENSITIVE: A WORN STICK CAN KEEP WALKING"],
    ["sensitivity rule at MEDIUM", padV({ row: 5, dead: 25 }), "HOW FAR THE STICK MOVES BEFORE IT COUNTS"],
  ];
  for (const [nm, v, want] of T) check("statusOf " + nm, say(v) === want, say(v));
  const ft = (v, w) => { const it = footItems(v, rowsOf(v)[v.row], w); return it ? footText(it) : FOOT_TAP; };
  check("foot, keys", ft(keyV()) === "ROW ↑↓ · TAB ←→ · CHANGE ENTER · BACK ESC", ft(keyV()));
  check("foot, pad", ft(padV()) === "ROW ↑↓ · TAB ←→ · CHANGE SOUTH · BACK EAST", ft(padV()));
  check("foot, a value row adjusts and still names the tab, on keys and on a pad; SENSITIVITY names the D-PAD on a pad", ft(padV({ row: 6 })) === "ROW ↑↓ · ADJUST ←→ · TAB L R · CHANGE SOUTH · BACK EAST" && ft(padV({ row: 6, device: "key" })) === "ROW ↑↓ · ADJUST ←→ · TAB [ ] · CHANGE ENTER · BACK ESC" && ft(padV({ row: 5 })) === "ROW ↑↓ · ADJUST D-PAD · TAB L R · CHANGE SOUTH · BACK EAST" && ft(padV({ row: 5, pad: NON })) === "ROW ↑↓ · ADJUST ←→ · TAB BUTTON 4 BUTTON 5 · CHANGE BUTTON 0 · BACK BUTTON 1" && ft(padV({ row: 5, device: "key" })) === "ROW ↑↓ · ADJUST ←→ · TAB [ ] · CHANGE ENTER · BACK ESC", ft(padV({ row: 5 })));
  check("foot, a fixed row offers no verb", ft(keyV({ row: 5 })) === "ROW ↑↓ · TAB ←→ · BACK ESC");
  check("foot, a short form drops the tab item, never the verb", footText(footItems(padV({ row: 6, pad: { ...NON, rumble: true } }), rowsOf(padV())[6], {}, true)) === "ROW ↑↓ · ADJUST ←→ · CHANGE BUTTON 0 · BACK BUTTON 1");
  check("foot, no pad: ←→ is the tab, even on SENSITIVITY", ft(keyV({ tab: "pad", row: 5 })) === "ROW ↑↓ · TAB ←→ · BACK ESC");
  check("foot, nonstd names buttons", ft(padV({ pad: NON })) === "ROW ↑↓ · TAB ←→ · CHANGE BUTTON 0 · BACK BUTTON 1");
  check("foot, pad rows: CHANGE on a value row and on MOVE, RESET on RESET", ft(padV({ row: 6 })).includes("CHANGE SOUTH") && ft(padV({ row: 0 })).includes("CHANGE SOUTH") && ft(padV({ row: 7 })).includes("RESET SOUTH"));
  check("foot, no actuator offers no change", ft(padV({ row: 6, pad: { ...PR, rumble: false } })) === "ROW ↑↓ · TAB ←→ · BACK EAST");
  check("foot follows the words handed in", ft(keyV(), { dev: "key", ok: "RETURN", back: "BKSP" }) === "ROW ↑↓ · TAB ←→ · CHANGE RETURN · BACK BKSP");
  check("foot, touch never names a key", ft(padV({ device: "touch" })) === "TAP A ROW TO CHANGE IT · TAP OUTSIDE TO GO BACK");
  check("foot items are label first, keycap last: every item a word then its caps", [keyV(), padV(), padV({ row: 5 }), keyV({ row: 7 })].every((v) => footItems(v, rowsOf(v)[v.row], {}).every((q) => typeof q.t === "string" && q.caps.length > 0)));
  check("padStates: every bound input lights, whatever the row: BOMB's bind included", padStates(padV()).S === "lit" && padStates(padV({ binds: { ...DEF_PAD, BOMB: "TRL" } })).TRL === "lit" && !padStates(padV({ binds: { ...DEF_PAD, BOMB: "TRL" } })).S);
  check("padStates: MOVE lights D-PAD and the live stick", padStates(padV({ stick: "R" })).dpad === "lit" && padStates(padV({ stick: "R" })).RS === "lit" && !padStates(padV({ stick: "R" })).LS);
  check("padStates: PAUSE lights START and its second button, the ring on the second", padStates(padV()).START === "lit" && padStates(padV()).SELECT === "lit" && padRing(padV(), "PAUSE") === "SELECT");
  check("padStates: a swap's displaced button stays lit under its new action", padStates(padV({ binds: { ...DEF_PAD, BOMB: "E", REMOTE: "S" }, swap: { row: "REMOTE", part: "S" } })).S === "lit" && padLabels(padV({ binds: { ...DEF_PAD, BOMB: "E", REMOTE: "S" } })).S === "REMOTE");
  const ks = keyStates(keyV());
  check("keyStates: SPACE lit; the silent J and X never advertised", ks.Space === "lit" && !ks.KeyJ && !ks.KeyX);
  check("keyStates: a rebound key lights, the old one goes dark", keyStates(keyV({ key: { ...DEF_KEY, THROW: "KeyX" } })).KeyX === "lit" && !keyStates(keyV({ key: { ...DEF_KEY, THROW: "KeyX" } })).KeyE);
  check("keyStates: MOVE lights the set, the fixed arrows lit too", ks.KeyW === "lit" && ks.ArrowUp === "lit");
  check("keyStates: ESC lit (fixed); CONFIRM and BACK ring ENTER and ESC", ks.Escape === "lit" && keyRing(keyV(), "CONFIRM") === "Enter" && keyRing(keyV(), "BACK") === "Escape");
  const pl = padLabels(padV());
  check("padLabels name every action on its bound part", pl.S === "BOMB" && pl.W === "THROW" && pl.E === "REMOTE" && pl.SELECT === "PAUSE" && pl.START === "PAUSE" && pl.dpad === "MOVE" && pl.LS === "MOVE");
  check("padLabels follow the stick and the binds", padLabels(padV({ stick: "R" })).RS === "MOVE" && padLabels(padV({ binds: { ...DEF_PAD, BOMB: "TRL" } })).TRL === "BOMB");
  { const M1 = { pri: 13, sec: 11, wOf: (t, px) => t.length * px * 0.6 }, k = 30, P = kbPlan(k, keyCallouts(keyV()), M1), L = (g) => P.lines.find((l) => l.grp === g), sp = keyRect(KB_AT.Space, k);
    check("keyboard: SPACE's leader runs straight down from the key, under the board", L("Space").pts[0][1] === sp.y + sp.h && L("Space").pts.at(-1)[1] > 6.5 * k && L("Space").pts.every((q) => q[0] === sp.x + sp.w / 2), JSON.stringify(L("Space").pts));
    const z = kbPlan(k, keyCallouts(keyV({ key: { ...DEF_KEY, THROW: "KeyZ" } })), M1), zl = z.lines.find((l) => l.grp === "KeyZ");
    check("keyboard: a boxed-in Z row key jogs along a row gap and still gets out", z.ok && zl.pts.length > 2 && zl.pts.slice(1).every((q, i) => q[0] === zl.pts[i][0] || q[1] === zl.pts[i][1]), JSON.stringify(zl && zl.pts));
    check("keyboard: the arrows' leader runs down from DOWN", L("ArrowDown").pts.at(-1)[1] > 6.5 * k);
    check("keyboard: an upper-row key (E) runs up through the key gaps", L("KeyE").pts[1][1] < 0 && L("KeyE").pts[1][0] === L("KeyE").pts[0][0]);
    check("keyboard: ESC runs straight left", L("Escape").pts.at(-1)[0] < 0 && L("Escape").pts.every((q) => q[1] === L("Escape").pts[0][1])); }
  check("keyCallouts: the action on its bound key", keyCallouts(keyV()).find((q) => q.grp === "KeyE").act === "THROW" && keyCallouts(keyV()).find((q) => q.grp === "Space").act === "BOMB" && keyCallouts(keyV()).filter((q) => q.act === "MOVE").map((q) => q.pos[0]).join() === "W A S D,ARROWS");
  check("keyCallouts: a key off the drawing has none and draws no crash", !keyCallouts(keyV({ key: { ...DEF_KEY, THROW: "Numpad7" } })).some((q) => q.act === "THROW") && (() => { try { ctlPage.drawControlsPage(recCtx().c, { W: 1366, H: 768 }, keyV({ key: { ...DEF_KEY, THROW: "Numpad7" }, row: 2 }), {}); return true; } catch (e) { return false; } })());
}

// the render-side copies stay equal to the model (menudraw.js's local-copy idiom)
{
  const same = Object.keys(BTN).every((id) => model.BTN[id] && BTN[id].g === model.BTN[id].g && BTN[id].v === model.BTN[id].v && BTN[id].w === model.BTN[id].w);
  check("BTN mirrors src/app/controls.js", same && Object.keys(BTN).length >= 13);
  check("no button in the model is missing here", Object.values(model.PAD_IDX).every((id) => BTN[id]));
  check("DEF_KEY / DEF_PAD mirror the model", JSON.stringify(DEF_KEY) === JSON.stringify(model.DEF_KEY) && JSON.stringify(DEF_PAD) === JSON.stringify(model.DEF_PAD));
  const codes = ["Space", "KeyQ", "KeyZ", "Digit7", "Digit0", "Period", "Comma", "Slash", "Semicolon", "Quote", "Minus", "Equal", "Backquote", "Backslash", "Numpad7", "ArrowUp", "ShiftLeft"];
  check("keyName mirrors the model", codes.every((k) => keyName(k) === model.keyName(k)), codes.filter((k) => keyName(k) !== model.keyName(k)).join());
  check("moveLabel mirrors the model", moveLabel(DEF_KEY.MOVE) === "WASD" && moveLabel(["KeyI", "KeyL", "KeyK", "KeyJ"]) === model.moveLabel(["KeyI", "KeyL", "KeyK", "KeyJ"]));
  const cc = { key: { ...DEF_KEY, THROW: "KeyX" } };
  check("the alias rule mirrors softAliases", softAliasesOf(cc.key).join() === model.softAliases(cc).join() && softAliasesOf(DEF_KEY).join() === model.softAliases({ key: DEF_KEY }).join() && softAliasesOf({ ...DEF_KEY, BOMB: "KeyZ" }).length === 0);
}

// the OPTIONS door reads the level where it fits the row, at both pitches
for (const [nm, Lx, touch] of [["keyboard 27", L600, false], ["touch 37", L600, true], ["touch 400 wide", layout(400, 700), true], ["guard 608x352", layout(608, 352), false]]) for (const r3d of [false, true]) {
  const r = recCtx();
  drawSettings(r.c, Lx, 1, { rows: optRows(r3d), row: "CONTROLS", vals: {}, ctlDoor: "CONTROLLER ›", padVib: "MEDIUM", touch });
  /* v202 Task 3.4: the page's plan (pages/settings.js; this recorder has no clip, so the page plans and paints nothing); the › is the door's chevron */
  const o = settingsPage._dbg.last.Pl.rows.CONTROLS, v = o.val.P.find((p) => p.k === "text" && p.s === "VIBRATION MEDIUM"), lab = o.label;
  check("the door fits beside its label: " + nm + (r3d ? " (twelve rows)" : " (ten rows)"), !!v && !!lab && v.x >= lab.x + lab.w + 12 && v.y === lab.y, v && [lab.x + lab.w, v.x].join());
}
{
  const r = recCtx();
  drawSettings(r.c, L600, 1, { rows: optRows(false), row: "CONTROLS", vals: {}, ctlDoor: "KEYBOARD ›", touch: false });
  const P = settingsPage._dbg.last.Pl.rows.CONTROLS.val.P.filter((p) => p.k === "text").map((p) => p.s);
  check("no level, the door stays as today", P.includes("KEYBOARD") && !P.some((s) => s.startsWith("VIBRATION")));
}

// art primitives on a context with no Path2D
{
  const r = recCtx();
  trace(r.c, BODY_PATH);
  check("the path reader emits canvas calls for the mock's body string", r.log[0] === "bp" && r.log.some((x) => x.startsWith("bz")) && r.log.at(-1) === "cp");
  const r2 = recCtx();
  trace(r2.c, "M1,2 H3 V4 L5,6 Q7,8 9,10 Z");
  check("M H V L Q Z read exactly", r2.log.join() === "bp,m1,2,l3,2,l3,4,l5,6,q7,8,9,10,cp", r2.log.join());
  check("every input has a place on the drawing", ["TRL", "TRR", "SHL", "SHR", "dpad", "LS", "RS", "SELECT", "START", "N", "E", "S", "W"].every((id) => Array.isArray(PART_AT[id]) && PART_AT[id].every(Number.isFinite)));
  const g = recCtx();
  let ok = true;
  for (const [k, v] of [["face", "S"], ["dpad", "all"], ["dpad", "U"], ["shoulder", "R"], ["trigger", "L"], ["stick", "L"], ["centre", "START"]]) ok = glyph(g.c, k, 0, 0, 16, v, CONST.ink) > 0 && ok;
  check("each glyph kind paints and reports a width", ok && g.log.length > 20);
  const d = recCtx();
  drawPad(d.c, 0, 0, 200, { tok: worldTokens(1), lit: { S: "lit", dpad: "lit", LS: "lit", START: "lit", SELECT: "lit" }, ring: "S", press: "S" });
  drawKeys(d.c, 0, 0, 30, { tok: worldTokens(1), lit: { Space: "lit", ArrowUp: "lit" }, ring: "Space", prints: { Space: true, KeyQ: true }, px: 12 });
  check("controller and keyboard drawings draw on the headless stand-in", d.log.filter((q) => q.startsWith("bz")).length >= 14 && d.texts.some((t) => t.s === "SPACE"));
}

// source rules
{
  const FILES = ["src/render/controlsgeo.js", "src/render/padart.js", "src/render/pages/controls.js"], src = Object.fromEntries(FILES.map((f) => [f, readFileSync(join(ROOT, f), "utf8")]));
  const all = Object.values(src).join("\n"), lower = all.toLowerCase();
  const maker = ["bomber" + "man", "xb" + "ox", "play" + "station", "dual" + "shock", "dual" + "sense", "nin" + "tendo", "son" + "y", "micro" + "soft", "log" + "itech"];
  check("no maker names in the three files", maker.every((w) => !lower.includes(w)), maker.filter((w) => lower.includes(w)).join());
  check("no LB, RB, LT, RT ids in the three files", !/\b(LB|RB|LT|RT)\b/.test(all));
  check("no src/app import in the three files", !/from\s+["'][^"']*\/app\//.test(all));
  check("no Path2D, roundRect or setLineDash: the headless stub has none", !/Path2D|roundRect|setLineDash/.test(all));
  check("no timers or clocks", !/performance\.now|Date\.now|new Date|Math\.random|setTimeout/.test(all));
  check("every state keeps a shape and a word in the source", ["CW.SWAPPED", "CW.AGAIN", "CW.FIXED", "CW.NONE"].every((w) => all.includes(w)));
  check("no selection ring function", !/function ring\b/.test(all));
  check("the old skin is gone", !/\b(drawTile|drawChip|pillTabs|drawPrompts|chipIcon|tileGeom|chipGeom|THEME|padHit|promptsOf|drawCapture2|drawPad2|drawKeys2)\b/.test(all), (all.match(/\b(drawTile|drawChip|pillTabs|drawPrompts|chipIcon|tileGeom|chipGeom|THEME|padHit|promptsOf|drawCapture2|drawPad2|drawKeys2)\b/) || [""])[0]);
  check("the page's rows, plate, tabs and band come from the kit (kit/paint.js), never a copy", /from "\.\.\/kit\/paint\.js"/.test(src["src/render/pages/controls.js"]) && ["plate(", "key(", "band(", "focusBomb("].every((w) => src["src/render/pages/controls.js"].includes(w)) && !/function (plate|key|band)/.test(src["src/render/pages/controls.js"]));
}

console.log(fail ? `CONTROLSDRAW FAIL (${pass} pass, ${fail} fail)` : `CONTROLSDRAW OK (${pass} pass)`);
process.exit(fail ? 1 : 0);
