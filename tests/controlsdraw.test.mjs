// CONTROLS page geometry and paint (T4): hit = paint, type floors, copy, states.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { layout, bandOf, drawSettings, lockGlyph, ACCENT, TEXT, MUTED, DANGER, WARM, PLATE, LINE } from "../src/render/menudraw.js";
import { CAPTION, geomOf, geoFor, hitPage, rowsOf, statusOf, footOf, padStates, keyStates, padLabels, keyLabels, keyName, moveLabel, softAliasesOf, BTN, DEF_KEY, DEF_PAD, DEF_VIB, VIB_LEVELS, SENS_LEVELS, sensIdx, vibWord, NO_VIB, FEEL_NOTHING, STATUS } from "../src/render/controlsgeo.js";
import { PARTS, BODY_PATH, KB_ROWS, trace, glyph, drawPad, drawKeys } from "../src/render/padart.js";
import { drawControls } from "../src/render/controlsdraw.js";
import * as model from "../src/app/controls.js";
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
    arc(...a) { log.push("a" + a.join()); }, arcTo(...a) { log.push("at" + a.join()); },
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
const L600 = layout(600, 520), G2 = geoFor(L600, false, false), PR = { state: "ready", name: "CONTROLLER 1", rumble: true }, NON = { state: "nonstd", name: "CONTROLLER 1 · BUTTONS 0-16", rumble: false };
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

// geometry
check("600x520 keyboard: MENU's split, the shared pitch, the kit's group gaps", G2.x === 20 && G2.w === 560 && G2.list.x === 20 && G2.list.w === 272 && G2.pane.x === 294 && G2.pane.w === 276 && G2.list.rows[0].h === 26 && G2.list.rows[5].y0 === G2.list.rows[4].y1 + 6 && G2.list.rows[7].y0 === G2.list.rows[6].y1 + 6, JSON.stringify([G2.x, G2.y, G2.w, G2.h]));
check("the row band sits at drawList's insets", geomOf(0, G2).x === 28 && geomOf(0, G2).w === 256 && geomOf(0, G2).h === 24);
check("the pane spans the list", G2.pane.y === G2.list.rows[0].y0 && G2.pane.h === G2.list.rows[7].y1 - G2.list.rows[0].y0, JSON.stringify(G2.pane));
check("the diagram is drawn as large as the pane allows", G2.pad.k >= 0.8 && G2.keys.k >= 0.8, [G2.pad.k, G2.keys.k].join());
check("the keyboard centres in its pane on its 162 box", G2.keys.k === Math.min(1.25, (G2.pane.w - 12) / 318, G2.art.h / 162) && G2.keys.y === G2.art.y + (G2.art.h - 162 * G2.keys.k) / 2, [G2.keys.k, G2.keys.y].join());

for (const [nm, Lx, touch, narrow, scale] of BOXES) {
  const G = geoFor(Lx, touch, narrow, scale), v = padV();
  let ok = true;
  const rows = rowsOf(v);
  for (let i = 0; i < 8; i++) {
    const g = geomOf(i, G), h = hitPage(v, g.x + g.w / 2, g.y + g.h / 2, G);
    if (h.row !== i) ok = false;
  }
  const { c, texts } = recCtx();
  drawControls(c, Lx, v, { touch, narrow, scale, t: 0 });
  rows.forEach((r, i) => {
    const hit = texts.findLast((t) => t.s === (r.label || r.id) && t.y >= geomOf(i, G).y && t.y <= geomOf(i, G).y + geomOf(i, G).h && t.x >= geomOf(i, G).x && t.x <= geomOf(i, G).x + geomOf(i, G).w);
    if (!hit || hitPage(v, hit.x, hit.y, G).row !== i) ok = false;
  });
  check("hit geometry equals paint geometry: " + nm, ok);
  const [t0, t1] = G.tabs, ty = t0.y + t0.h / 2;
  const tw = Math.min(touch ? 130 : 100, G.S.iw / 3);
  check("tabs are HIGH SCORES' size, centred on the plate: " + nm, t0.w === tw && t1.w === tw && t0.x === G.S.mid - tw && t1.x === G.S.mid && t0.y === G.S.by && t0.h === t1.h, [t0.x, t0.w, G.S.mid].join());
  check("tab words fit their tab: " + nm, ["KEYBOARD", "CONTROLLER"].every((s, i) => { const q = texts.find((t) => t.s === s); return q && q.left >= G.tabs[i].x && q.right <= G.tabs[i].x + G.tabs[i].w; }));
  check("tabs abut, each taps to itself: " + nm, t0.x + t0.w === t1.x && hitPage(v, t1.x - 1, ty, G).tab === "key" && hitPage(v, t1.x + 1, ty, G).tab === "pad");
  check("off the plate is {off:1}: " + nm, hitPage(v, G.x - 3, G.y + 40, G).off === 1 && hitPage(v, G.x + 40, G.y + G.h + 3, G).off === 1 && hitPage(v, G.x + 40, G.y - 3, G).off === 1);
  check("a miss on the plate is inert: " + nm, Object.keys(hitPage(v, G.x + 6, G.y + 6, G)).length === 0 && (!G.pane || Object.keys(hitPage(v, G.pane.x + G.pane.w / 2, G.pane.y + G.pane.h / 2, G)).length === 0));
  const B = bandOf(Lx, touch);
  check("plate fits inside the pageBox band: " + nm, G.y >= B.top - 0.5 && G.y + G.h <= B.bot + 0.5 && G.x >= 0 && G.x + G.w <= Lx.cx * 2, [G.y, G.y + G.h, B.top, B.bot].join());
  check("page content stays on the plate: " + nm, G.list.rows[7].y1 <= G.S.footY - 8 && (!G.pane || (G.pane.x >= G.x && G.pane.x + G.pane.w <= G.x + G.w && G.pane.y + G.pane.h <= G.S.footY)), G.list.rows[7].y1 + "/" + G.S.footY);
  check("tabs, pane and rows never overlap: " + nm, G.tabs[0].y + G.tabs[0].h <= (G.pane ? G.pane.y : G.list.rows[0].y0) && (!G.pane || !narrow || G.pane.y + G.pane.h <= G.list.rows[0].y0) && (!G.pane || narrow || G.pane.x >= G.list.x + G.list.w));
}
{
  const g = geoFor(layout(608, 352), false, false);
  check("the guard box scales the pitch as every page does, the plate still fits", g.list.f < 1 && g.y + g.h <= 324.5 && g.list.rows[7].y1 <= g.S.footY, g.list.f);
}
const nar = geoFor(layout(436, 946), true, true, 0.9);
check("narrow: the pane above the list, both full width", nar.pane.y + nar.pane.h <= nar.list.rows[0].y0 && nar.list.w === nar.w && nar.pane.w === nar.w - 16);
check("narrow: the diagram grows past the keyboard's", nar.pad.k > 1.1, nar.pad.k);

// touch floors, with the real fit numbers. Eight rows at 44 CSS need 70 logical at 0.63, 560 of a 416 room: only #sh holds the floor for rows; every box holds it for tabs
for (const s of [0.63, 0.73, 0.9]) {
  const G = geoFor(L600, true, false, s);
  check("touch tab height >= 44 CSS at " + s, G.tabs.every((g) => g.h * s >= 44), G.tabs[0].h * s);
  check("#c touch rows stay above OPTIONS' pitch on the same stage at " + s, G.list.rows[0].h >= 37, G.list.rows[0].h);
}
{
  const sh = shellGeo(393, 852), G = geoFor(layout(sh.w, sh.h, sh.logo), true, sh.w < 560, sh.s);
  check("393x852 shell box: narrow, plate fits, pitch 52 clears the 44 CSS floor, pane stays", sh.w < 560 && G.y >= 8 && G.y + G.h <= sh.h - 8 && G.list.rows[0].h === 52 && 52 * sh.s >= 44 && G.tabs[0].h * sh.s >= 44 && !!G.pane, [sh.w, sh.h, sh.s, G.h].join());
  const se = shellGeo(375, 667), GS = geoFor(layout(se.w, se.h, se.logo), true, se.w < 560, se.s);
  check("375x667 shell box: rows still clear the floor", GS.list.rows[0].h * se.s >= 44 && GS.y + GS.h <= se.h - 8, GS.list.rows[0].h * se.s);
  const land = fitBox(852, 393, true, 600, 520), GL = geoFor(L600, true, false, land.s);
  check("852x393 landscape #c fits with the pane", GL.y >= 8 && GL.y + GL.h <= 512 && !!GL.pane, [land.s, GL.h].join());
  const P = geoFor(L600, true, false, 0.63);
  check("PAUSE on #c at 0.63 fits with the pane", P.y >= 8 && P.y + P.h <= 512 && !!P.pane, P.h);
}
const capV = padV({ capture: CAP }), r0 = geomOf(0, G2);
check("while capturing, a tap off the capture plate is {off:1}", hitPage(capV, G2.cap.x - 3, G2.cap.y + 5, G2).off === 1 && hitPage(capV, r0.x + 5, r0.y + 5, G2).off === 1);
check("while capturing, a tap on the capture plate is inert", Object.keys(hitPage(capV, G2.cap.x + 5, G2.cap.y + 5, G2)).length === 0);

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
  check("rowsOf(pad) has SENSITIVITY / VIBRATION / RESET PAD", p.map((r) => r.id).join() === "MOVE,BOMB,THROW,REMOTE,PAUSE,SENSITIVITY,VIBRATION,RESET" && p[7].label === "RESET PAD" && p[5].text === "MEDIUM" && p[6].text === "MEDIUM");
  check("pad values use position words", p[1].val[0].w === "SOUTH" && p[2].val[0].w === "WEST" && p[3].val[0].w === "EAST" && p[4].val[0].w === "START" && p[4].val[1].w === "SELECT" && p[0].val[0].w === "D-PAD" && p[0].val[1].w === "L-STICK");
  check("a stick swap reads R-STICK", rowsOf(padV({ stick: "R" }))[0].val[1].w === "R-STICK");
  const n = rowsOf(padV({ pad: NON }));
  check("nonstd reads BUTTON n", n[1].val[0].cap === "BUTTON 0" && n[2].val[0].cap === "BUTTON 2" && n[3].val[0].cap === "BUTTON 1" && n[4].val[0].cap === "BUTTON 9" && n[4].val[1].cap === "BUTTON 8" && n[6].text === "NONE");
  check("a pad with no actuator reads NONE, the levels follow the store", rowsOf(padV({ pad: { ...PR, rumble: false } }))[6].text === "NONE" && VIB_LEVELS.every((w, i) => rowsOf(padV({ vib: i }))[6].text === w) && statusOf(padV({ row: 6, pad: { ...PR, rumble: false } }), rowsOf(padV())[6]) === NO_VIB && NO_VIB === "NO VIBRATION ON THIS CONTROLLER OR BROWSER");
  check("no actuator keeps the stored level, and shows no change", !rowsOf(padV({ vib: 0, pad: { ...PR, rumble: false } }))[6].changed && !rowsOf(padV({ vib: 0, pad: { ...PR, rumble: false } }))[6].bar);
  check("SENSITIVITY reads the level name, off-level values snap to the nearest", SENS_LEVELS.every((l) => rowsOf(padV({ dead: l.dead }))[5].text === l.name) && rowsOf(padV({ dead: 30 }))[5].text === "MEDIUM" && rowsOf(padV({ dead: 5 }))[5].text === "MAX" && rowsOf(padV({ dead: 55 }))[5].text === "MIN" && sensIdx(25) === 2);
  check("the segment bars fill by level index, never by the dead value", rowsOf(padV({ dead: 60 }))[5].bar.join() === "1,5" && rowsOf(padV({ dead: 8 }))[5].bar.join() === "5,5" && rowsOf(padV({ vib: 0 }))[6].bar.join() === "0,3" && rowsOf(padV({ vib: 3 }))[6].bar.join() === "3,3");
  check("the unknown-effects line joins only while on", statusOf(padV({ pad: { ...PR, effects: null } }), rowsOf(padV())[6]) === "HITS, BLASTS, PLANTS AND MENUS · LOW SKIPS MENUS · " + FEEL_NOTHING && statusOf(padV({ vib: 0, pad: { ...PR, effects: null } }), rowsOf(padV())[6]) === "NO VIBRATION AT ALL" && statusOf(padV(), rowsOf(padV())[6]) === "HITS, BLASTS, PLANTS AND MENUS · LOW SKIPS MENUS");
  check("the rule follows the level", ["NO VIBRATION AT ALL", "HITS, BIG BLASTS AND ROOM ENDS · NO MENU BUZZ", "HITS, BLASTS, PLANTS AND MENUS · LOW SKIPS MENUS", "HITS, BLASTS, PLANTS AND MENUS · STRONGEST"].every((w, i) => statusOf(padV({ vib: i }), rowsOf(padV())[6]) === w));
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
    ["key default rule", keyV({ row: 2 }), "NEEDS THE THROW POWER · TOSS A BOMB"],
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
  const ft = (v, w) => footOf(v, rowsOf(v)[v.row], w);
  check("foot, keys", ft(keyV()) === "↑↓ ROW · ←→ TAB · ENTER REBIND · ESC BACK", ft(keyV()));
  check("foot, pad", ft(padV()) === "↑↓ ROW · ←→ TAB · SOUTH REBIND · EAST BACK", ft(padV()));
  check("foot, a value row adjusts and still names the tab, on keys and on a pad; SENSITIVITY names the D-PAD on a pad", ft(padV({ row: 6 })) === "↑↓ ROW · ←→ ADJUST · L R TAB · SOUTH CYCLE · EAST BACK" && ft(padV({ row: 6, device: "key" })) === "↑↓ ROW · ←→ ADJUST · [ ] TAB · ENTER CYCLE · ESC BACK" && ft(padV({ row: 5 })) === "↑↓ ROW · D-PAD ADJUST · L R TAB · SOUTH CYCLE · EAST BACK" && ft(padV({ row: 5, pad: NON })) === "↑↓ ROW · ←→ ADJUST · BUTTON 4 5 TAB · BUTTON 0 CYCLE · BUTTON 1 BACK" && ft(padV({ row: 5, device: "key" })) === "↑↓ ROW · ←→ ADJUST · [ ] TAB · ENTER CYCLE · ESC BACK", ft(padV({ row: 5 })));
  { const Gg = geoFor(layout(608, 352), false, false), all = [padV({ row: 5 }), padV({ row: 5, device: "key" }), padV({ row: 5, pad: NON }), padV({ row: 6 }), padV({ row: 6, device: "key" }), padV({ row: 6, pad: { ...NON, rumble: true } })];
    const over = all.filter((v) => { const r = recCtx(); drawControls(r.c, layout(608, 352), v, {}); const q = r.texts.find((t) => t.s === ft(v)); return !q || q.left < Gg.x + 4 || q.right > Gg.x + Gg.w - 4; });
    check("the value-row foot fits the 608x352 guard plate", !over.length, over.length); }
  { const W = "SENSITIVE: A WORN STICK CAN KEEP WALKING";
    check("the worn-stick line is no longer than the line it replaces", W.length <= "HOW FAR THE STICK MOVES BEFORE IT COUNTS".length);
    for (const [nm, L] of [["608x352", layout(608, 352)], ["600x520", L600]]) {
      const Gq = geoFor(L, false, false);
      for (const dead of [15, 8]) {
        const r = recCtx(); drawControls(r.c, L, padV({ row: 5, dead }), {});
        const rule = r.texts.filter((t) => W.split(" ").some((w) => t.s.includes(w)) && t.s.includes("SENSITIVE") || t.s.includes("WORN") || t.s.includes("WALKING"));
        check("the worn-stick rule draws and fits the plate: " + nm + " dead " + dead, rule.length >= 1 && rule.every((t) => t.left >= Gq.x && t.right <= Gq.x + Gq.w), rule.length);
      }
    } }
  check("foot, a fixed row offers no verb", ft(keyV({ row: 5 })) === "↑↓ ROW · ←→ TAB · ESC BACK");
  check("foot, a short form drops the tab words, never the verb", footOf(padV({ row: 6, pad: { ...NON, rumble: true } }), rowsOf(padV())[6], {}, true) === "↑↓ ROW · ←→ ADJUST · BUTTON 0 CYCLE · BUTTON 1 BACK");
  check("foot, no pad: ←→ is the tab, even on SENSITIVITY", ft(keyV({ tab: "pad", row: 5 })) === "↑↓ ROW · ←→ TAB · ESC BACK");
  check("foot, nonstd names buttons", ft(padV({ pad: NON })) === "↑↓ ROW · ←→ TAB · BUTTON 0 REBIND · BUTTON 1 BACK");
  check("foot, pad rows", ft(padV({ row: 6 })).includes("SOUTH CYCLE") && ft(padV({ row: 0 })).includes("SOUTH STICK") && ft(padV({ row: 7 })).includes("SOUTH RESET"));
  check("foot, no actuator offers no cycle", ft(padV({ row: 6, pad: { ...PR, rumble: false } })) === "↑↓ ROW · ←→ TAB · EAST BACK");
  check("foot follows the words handed in", ft(keyV(), { dev: "key", ok: "RETURN", back: "BKSP" }) === "↑↓ ROW · ←→ TAB · RETURN REBIND · BKSP BACK");
  check("foot, touch never names a key", ft(padV({ device: "touch" })) === "TAP A ROW TO CHANGE IT · TAP OUTSIDE TO GO BACK");
  check("padStates: selected BOMB lights its bind", padStates(padV(), "BOMB").S === "lit" && padStates(padV({ binds: { ...DEF_PAD, BOMB: "TRL" } }), "BOMB").TRL === "lit");
  check("padStates: MOVE lights D-PAD and the live stick", padStates(padV({ stick: "R" }), "MOVE").dpad === "lit" && padStates(padV({ stick: "R" }), "MOVE").RS === "lit");
  check("padStates: PAUSE lights START, alias on SELECT", padStates(padV(), "PAUSE").START === "lit" && padStates(padV(), "PAUSE").SELECT === "alias");
  check("padStates: a swap marks the displaced part", padStates(padV({ swap: { row: "REMOTE", part: "S" } }), "BOMB").S === "swap");
  const ks = keyStates(keyV(), "BOMB");
  check("keyStates: SPACE lit, J and X alias", ks.Space === "lit" && ks.KeyJ === "alias" && ks.KeyX === "alias");
  check("keyStates: an alias vanishes once taken", keyStates(keyV({ key: { ...DEF_KEY, THROW: "KeyX" } }), "BOMB").KeyX === undefined);
  check("keyStates: MOVE lights the set, arrows alias", keyStates(keyV(), "MOVE").KeyW === "lit" && keyStates(keyV(), "MOVE").ArrowUp === "alias");
  check("keyStates: CONFIRM and BACK", keyStates(keyV(), "CONFIRM").Enter === "lit" && keyStates(keyV(), "BACK").Escape === "lit");
  const pl = padLabels(padV());
  check("padLabels name every action on its bound part", pl.S === "BOMB" && pl.W === "THROW" && pl.E === "REMOTE" && pl.SELECT === "PAUSE" && pl.START === "PAUSE" && pl.dpad === "MOVE" && pl.LS === "MOVE");
  check("padLabels follow the stick and the binds", padLabels(padV({ stick: "R" })).RS === "MOVE" && padLabels(padV({ binds: { ...DEF_PAD, BOMB: "TRL" } })).TRL === "BOMB");
  { const sp = keyLabels(keyV(), "BOMB")[0], x = 72 + 61;
    check("keyLabels: SPACE's leader runs down, under the keyboard", JSON.stringify(sp[0]) === JSON.stringify([[x, 129], [x, 146]]) && sp[1] === x && sp[2] === 154, JSON.stringify(sp));
    const z = keyLabels(keyV({ key: { ...DEF_KEY, THROW: "KeyZ" } }), "THROW")[0];
    check("keyLabels: the Z row runs down too", z[2] === 154 && z[0][0][1] === 109 && z[0][1][1] === 146, JSON.stringify(z));
    const ar = keyLabels(keyV(), "MOVE").find((l) => l[4] === "ARROWS");
    check("keyLabels: ArrowUp stays up", ar[2] === 8 && ar[0][1][1] === 14, JSON.stringify(ar));
    const e = keyLabels(keyV(), "THROW")[0];
    check("keyLabels: an upper-row key stays up", e[2] === 8, JSON.stringify(e)); }
  check("keyLabels: a leader off the bound key", keyLabels(keyV(), "THROW")[0][4] === "THROW" && keyLabels(keyV(), "BOMB")[0][4] === "BOMB" && keyLabels(keyV(), "MOVE").map((l) => l[4]).join() === "WASD,ARROWS");
  check("keyLabels: a key off the diagram has none and draws no crash", keyLabels(keyV({ key: { ...DEF_KEY, THROW: "Numpad7" } }), "THROW").length === 0);
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

// paint, every state in every box
for (const [box, Lx, touch, narrow, scale] of BOXES) {
  let threw = "", small = [], off = [], wide = [];
  const G = geoFor(Lx, touch, narrow, scale), guard = box.includes("guard"), labels = new Set(["MOVE", "BOMB", "THROW", "REMOTE", "PAUSE", "CONFIRM", "BACK", "SENSITIVITY", "VIBRATION", "RESET KEYS", "RESET PAD"]);
  for (const nm in STATES) {
    const { c, texts } = recCtx();
    try { drawControls(c, Lx, STATES[nm], { touch, narrow, scale, t: 1.5 }); }
    catch (e) { threw = nm + ": " + e.message; continue; }
    for (const t of texts) {
      if (t.px < (!guard && labels.has(t.s) && !t.mono ? 13 : 10) - 1e-6) small.push(nm + ":" + t.s + "@" + t.px.toFixed(1));
      if (t.left < G.x - 0.5 || t.right > G.x + G.w + 0.5) off.push(nm + ":" + t.s);
      if (STATES[nm].capture) continue;
      for (let i = 0; i < 8; i++) {
        const g = geomOf(i, G);
        if (t.x >= g.x && t.x <= g.x + g.w && t.y >= g.y && t.y <= g.y + g.h && (t.left < g.x - 0.5 || t.right > g.x + g.w + 0.5)) wide.push(nm + ":" + t.s);
      }
    }
  }
  check("drawControls runs in every state: " + box, !threw, threw);
  check("type floors, the kit's kicker included: " + box, !small.length, [...new Set(small)].slice(0, 6).join(" "));
  check("all text stays on the plate: " + box, !off.length, [...new Set(off)].slice(0, 6).join(" "));
  check("row text fits its own row: " + box, !wide.length, [...new Set(wide)].slice(0, 6).join(" "));
}
const paint = (v, ui, Lx = L600) => { const r = recCtx(); drawControls(r.c, Lx, v, { t: 0, ...ui }); return r; };
/* Row labels and values must not collide, in every state, in the two boxes a player reads most. */
{
  const clash = [];
  for (const nm in STATES) if (!STATES[nm].capture) for (const [Lx, touch, narrow, scale] of [[L600, false, false], [layout(436, 946), true, true, 0.9]]) {
    const G = geoFor(Lx, touch, narrow, scale), { c, texts } = recCtx();
    drawControls(c, Lx, STATES[nm], { touch, narrow, scale });
    for (let i = 0; i < 8; i++) {
      const g = geomOf(i, G), T = texts.filter((t) => t.y >= g.y && t.y <= g.y + g.h && t.x >= g.x && t.x <= g.x + g.w).sort((a, b) => a.left - b.left);
      for (let k = 1; k < T.length; k++) if (T[k].left < T[k - 1].right - 0.5) clash.push(nm + ":" + T[k - 1].s + "/" + T[k].s);
    }
  }
  check("no two words in a row overlap", !clash.length, [...new Set(clash)].slice(0, 6).join(" "));
}
/* The page paints through the kit: the same plate and selected-row ops OPTIONS makes, on one recorder. */
{
  const opts = recCtx();
  drawSettings(opts.c, L600, 0, { row: 0, vals: {} });
  const ctl = paint(keyV({ row: 0 }));
  const plateOps = (log) => log.filter((x) => x === "f" + PLATE || x === "k#2a3550" || x === "frgba(0,0,0,0.35)").slice(0, 3);
  check("plate: the same shadow, fill and border as OPTIONS", ctl.log.includes("f" + PLATE) && ctl.log.includes("k#2a3550") && plateOps(ctl.log).join() === plateOps(opts.log).join(), plateOps(ctl.log).join());
  const selOf = (r) => { const i = r.rects.findIndex((q, j) => q.fill === "rgba(55,240,208,0.12)" && r.rects[j + 1] && r.rects[j + 1].w === 3); return [r.rects[i], r.rects[i + 1]]; };
  const [oB, oN] = selOf(opts), [cB, cN] = selOf(ctl), g0 = geomOf(0, G2);
  check("selected band: alpha 0.12 accent, as OPTIONS", !!cB && !!oB && cB.fill === oB.fill);
  check("notch: 3px, accent, the band's height, as OPTIONS", cN.fill === ACCENT && oN.fill === ACCENT && cN.w === 3 && oN.w === 3 && cN.h === cB.h && cN.x === cB.x);
  check("the band is the row the tap reads", cB.x === g0.x && cB.y === g0.y && cB.w === g0.w && cB.h === g0.h);
  check("a caret on the selected row, from the kit", ctl.log.some((x) => x === "f" + ACCENT));
  const lab = (r, s) => r.texts.find((t) => t.s === s);
  check("the label's font and colour are OPTIONS' own", lab(ctl, "MOVE").fill === lab(opts, "MUSIC").fill && lab(ctl, "BOMB").fill === MUTED && lab(ctl, "MOVE").px === lab(opts, "MUSIC").px && !lab(ctl, "MOVE").mono);
  const head1 = lab(ctl, "CONTROLS"), head2 = lab(opts, "OPTIONS");
  check("the title is head(): same size and colour", head1.px === head2.px && head1.fill === head2.fill && head1.x === head2.x);
  const noRound = paint(padV());
  const radii = (r) => r.log.filter((x) => x.startsWith("at")).map((x) => +x.slice(2).split(",")[4]);
  const big = Object.keys(STATES).flatMap((nm) => radii(paint(STATES[nm])).filter((v) => v > 6).map((v) => nm + ":" + v));
  check("no tile, pill or large radius: every corner on the page is at most the kit plate's 6", !big.length, big.slice(0, 5).join(" "));
  check("values are mono on the right, no boxed cap", lab(ctl, "WASD · ARROWS").mono && noRound.texts.find((t) => t.s === "SOUTH").mono);
}
{
  const has = (r, s) => r.texts.some((t) => t.s === s);
  const selT = paint(keyV());
  const swapP = paint(padV({ swap: { row: "REMOTE" } })), g3 = geomOf(3, G2);
  check("swapped: a warm 0.12 band, a warm 3px notch, no caret, the word", swapP.rects.some((q) => q.fill === "rgba(255,212,71,0.12)" && q.x === g3.x && q.y === g3.y && q.w === g3.w) && swapP.rects.some((q) => q.fill === WARM && q.w === 3 && q.y === g3.y) && has(swapP, "SWAPPED") && swapP.texts.find((t) => t.s === "REMOTE" && t.y === g3.y + g3.h / 2).fill === TEXT);
  check("swapped: the opposed arrows stroke in gold before the word", swapP.log.lastIndexOf("k" + WARM) < swapP.log.indexOf("xSWAPPED") && swapP.log.includes("k" + WARM));
  const onSel = paint(padV({ row: 3, swap: { row: "REMOTE" } }));
  check("a swapped row under the cursor keeps a caret, in gold", onSel.log.filter((x) => x === "f" + WARM).length > swapP.log.filter((x) => x === "f" + WARM).length);
  const lock0 = recCtx(), g5 = geomOf(5, G2);
  lockGlyph(lock0.c, g5.x + g5.w - 18, g5.y + g5.h / 2, 12, MUTED);
  const fx = paint(keyV({ row: 5 }));
  check("fixed: the existing padlock in muted, value at full alpha", fx.log.join(";").includes(lock0.log.join(";")) && lock0.rects.length > 0 && lock0.rects.every((q) => q.fill === MUTED) && fx.texts.find((t) => t.s === "ENTER" && t.mono && t.y === g5.y + g5.h / 2).alpha === 1);
  const ch = paint(keyV({ key: { ...DEF_KEY, THROW: "KeyZ" }, row: 2 })), unch = paint(keyV({ row: 2 })), chOther = paint(keyV({ key: { ...DEF_KEY, THROW: "KeyZ" }, row: 1 }));
  check("changed: a dot on the row, CHANGED in the pane on the selected row only", has(ch, "CHANGED") && !has(unch, "CHANGED") && !has(chOther, "CHANGED") && chOther.log.filter((x) => x === "f" + ACCENT).length > paint(keyV({ row: 1 })).log.filter((x) => x === "f" + ACCENT).length);
  const armed = paint(keyV({ row: 7, armed: true })), g7 = geomOf(7, G2);
  check("reset is a danger row: the red band and PRESS AGAIN when armed", armed.rects.some((q) => q.fill === "rgba(255,93,115,0.12)" && q.y === g7.y) && armed.rects.some((q) => q.fill === DANGER && q.w === 3) && has(armed, "PRESS AGAIN") && !has(paint(keyV({ row: 7 })), "PRESS AGAIN"));
  const cap = paint(padV({ capture: CAP }));
  check("capture: a kit plate, head, the words and the foot line", cap.log.filter((x) => x === "f" + PLATE).length === 2 && has(cap, "PRESS A BUTTON") && has(cap, "REBIND THROW") && has(cap, "NOW WEST") && has(cap, CAP.foot));
  check("capture: the lit fuse", cap.log.includes("f#ff8a3c") && cap.log.some((x) => x.startsWith("bz")));
  check("capture: the page veil over the box", cap.rects.some((q) => q.x === 0 && q.y === 0 && q.w === 600 && q.h === 520));
  const a = paint(padV({ capture: CAP }), { t: 0 }).log.join(), b = paint(padV({ capture: CAP }), { t: 37.5 }).log.join();
  check("no frame depends on the clock: listening is static", a === b);
  check("the selected page is static too", paint(keyV(), { t: 0 }).log.join() === paint(keyV(), { t: 9 }).log.join());
  const no = paint(keyV({ tab: "pad" }));
  check("no pad: NO CONTROLLER YET and the pane line, no leader words, no lit fuse", has(no, "NO CONTROLLER YET") && has(no, CAPTION.none) && !no.log.includes("f#ff8a3c"));
  check("touch, no pad: the touch pane line", has(paint(keyV({ tab: "pad", device: "touch" })), CAPTION.touch));
  const lost = paint(padV({ pad: { state: "lost" } }));
  check("lost: CONTROLLER LOST kicker and the plug-in rule", has(lost, "CONTROLLER LOST") && lost.texts.some((t) => t.s.startsWith("PLUG IT BACK IN")));
  check("connected: the fuse is lit", paint(padV()).log.includes("f#ff8a3c"));
  check("the pad name comes only from view.pad.name", has(paint(padV()), "CONNECTED · " + PR.name) && !paint(padV({ pad: { state: "ready", rumble: true } })).texts.some((t) => t.s.includes("USB")));
  check("nonstd: NO DIAGRAM FOR THIS PAD", has(paint(padV({ pad: NON })), "NO DIAGRAM FOR THIS PAD"));
  check("sensitivity: the live stick view reads the resolver's word, never its own sum", has(paint(padV({ row: 5, stickVal: [0.42, -0.1], reads: "RIGHT" })), "READS RIGHT") && has(paint(padV({ row: 5, stickVal: [0.42, -0.1] })), "READS NOTHING"));
  const lit = paint(padV());
  check("the pad's bound part draws its leader word, lit in accent", lit.texts.find((t) => t.s === "BOMB" && t.fill === ACCENT && t.mono));
  for (const [box, Lx, touch, narrow, scale] of BOXES) {
    const r = recCtx(); drawControls(r.c, Lx, padV(), { touch, narrow, scale });
    check("only the lit part draws a leader word: " + box, !r.texts.some((t) => t.mono && (t.s === "THROW" || t.s === "REMOTE" || t.s === "MOVE" || t.s === "PAUSE")), r.texts.filter((t) => t.mono).map((t) => t.s).join());
    const sw = recCtx(); drawControls(sw.c, Lx, padV({ binds: { ...DEF_PAD, BOMB: "E", REMOTE: "S" }, swap: { row: "REMOTE", part: "S" } }), { touch, narrow, scale });
    check("a swap's displaced part keeps its word: " + box, !geoFor(Lx, touch, narrow, scale).pane || sw.texts.some((t) => t.s === "REMOTE" && t.mono && t.fill === WARM) && sw.texts.some((t) => t.s === "BOMB" && t.mono && t.fill === ACCENT));
  }
  check("the pane's words read at game size", lit.texts.filter((t) => t.mono).every((t) => t.px >= 10 - 1e-6));
  const kb = paint(keyV());
  check("the keyboard's leader names the action", kb.texts.some((t) => t.s === "BOMB" && t.fill === ACCENT && t.mono));
  check("tabs both read, the open one banded as HEAT | PACE", has(selT, "KEYBOARD") && has(selT, "CONTROLLER") && selT.rects.some((q) => q.fill === "rgba(55,240,208,0.12)" && q.y === G2.tabs[0].y && q.w === G2.tabs[0].w) && selT.texts.find((t) => t.s === "KEYBOARD").fill === ACCENT && selT.texts.find((t) => t.s === "CONTROLLER").fill === MUTED);
  check("the kicker names the controller, never a mapping word", has(paint(padV()), "CONNECTED · CONTROLLER 1") && has(paint(padV({ pad: NON })), "CONNECTED · CONTROLLER 1 · BUTTONS 0-16"));
  check("the foot is the kit's line", selT.texts.some((t) => t.s === "↑↓ ROW · ←→ TAB · ENTER REBIND · ESC BACK" && t.y === G2.S.footY && t.fill === MUTED));
  const row = paint(padV({ row: 5 }));
  const segs = (r, g, fill) => r.rects.filter((q) => q.fill === fill && q.w === 6 && q.h === 8 && q.y === g.y + g.h / 2 - 4);
  check("the selected SENSITIVITY row draws five segments, three lit at MEDIUM", segs(row, geomOf(5, G2), ACCENT).length === 3 && segs(row, geomOf(5, G2), LINE).length === 2);
  { const vr = paint(padV({ row: 6, vib: 1 })), g6 = geomOf(6, G2);
    check("the selected VIBRATION row draws three segments, one lit at LOW; the other row none", segs(vr, g6, ACCENT).length === 1 && segs(vr, g6, LINE).length === 2 && !segs(vr, geomOf(5, G2), ACCENT).length);
    check("OFF lights no segment", segs(paint(padV({ row: 6, vib: 0 })), g6, ACCENT).length === 0);
    check("no actuator: no bar", !segs(paint(padV({ row: 6, pad: { ...PR, rumble: false } })), g6, LINE).length);
    const barX = (d) => Math.min(...segs(paint(padV({ row: 5, dead: d })), geomOf(5, G2), LINE).concat(segs(paint(padV({ row: 5, dead: d })), geomOf(5, G2), ACCENT)).map((q) => q.x));
    check("the bar never jumps with the word", barX(60) === barX(25) && barX(8) === barX(15)); }
  { const sv = paint(padV({ row: 5, stickVal: [-0.42, -0.1], reads: "LEFT", drift: 0.07 }));
    check("the stick pane names the direction and the held DRIFT", has(sv, "READS LEFT") && has(sv, "DRIFT 0.07") && !has(sv, "READS A MOVE"));
    check("the stick pane at rest reads nothing", has(paint(padV({ row: 5 })), "READS NOTHING"));
    const hd = sv.texts.find((t) => t.s === "SENSITIVITY" && t.y < G2.pane.y + 26);
    check("the pane's head carries the level word", !!hd && sv.texts.some((t) => t.s === "MEDIUM" && t.y < G2.pane.y + 26 && t.fill === ACCENT)); }
  { const lit = (v) => paint(v).log.includes("m54,128");
    const col = (o) => { const d = recCtx(); drawPad(d.c, 0, 0, 1, o); return d.log.filter((q) => q === "m54,128").length; };
    check("drawPad's grips stroke again only when lit", col({ grips: true }) === col({}) + 2);
    const vp = paint(padV({ row: 6 }));
    check("the VIBRATION pane has the level word and the rule", vp.texts.some((t) => t.s === "MEDIUM" && t.y < G2.pane.y + 26) && lit(padV({ row: 6 })));
    const stroke = (v) => paint(v).log.filter((q) => q === "m54,128").length;
    check("both grips light at LOW and above, never at OFF or NONE", stroke(padV({ row: 6, vib: 1 })) === stroke(padV({ row: 6, vib: 0 })) + 2 && stroke(padV({ row: 6, pad: { ...PR, rumble: false } })) === stroke(padV({ row: 6, vib: 0 }))); 
    const none = paint(padV({ row: 6, pad: { ...PR, rumble: false } }));
    check("no actuator: NONE muted in the head, and the status says why", none.texts.some((t) => t.s === "NONE" && t.y < G2.pane.y + 26 && t.fill === MUTED) && none.texts.map((t) => t.s).join(" ").includes("NO VIBRATION ON THIS CONTROLLER OR BROWSER")); }
  {
    const v = keyV({ key: { ...DEF_KEY, THROW: "KeyZ" }, row: 1 }), r = paint(v), g2 = geomOf(2, G2), cy2 = g2.y + g2.h / 2, lab = r.texts.find((t) => t.s === "THROW" && t.y === cy2);
    const end = g2.x + 26 + (lab.right - lab.left), dot = "a" + [end + 6, cy2 - 5, 2, 0, 7].join();
    check("changed: the dot sits after the label, up a little", r.log.includes(dot), dot);
    check("changed: no dot in the caret's column", !r.log.includes("a" + [g2.x + 21, cy2, 2, 0, 7].join()));
    const sw = paint(padV({ binds: { ...DEF_PAD, BOMB: "E", REMOTE: "S" }, swap: { row: "REMOTE", part: "S" } })), g3 = geomOf(3, G2), cy3 = g3.y + g3.h / 2, l3 = sw.texts.find((t) => t.s === "REMOTE" && t.y === cy3 && !t.mono);
    check("a swapped row shows SWAPPED, no dot", !sw.log.includes("a" + [g3.x + 26 + (l3.right - l3.left) + 6, cy3 - 5, 2, 0, 7].join()) && has(sw, "SWAPPED"));
    const gb = geomOf(1, G2), cyb = gb.y + gb.h / 2, lb = sw.texts.find((t) => t.s === "BOMB" && t.y === cyb && !t.mono);
    check("the other changed row keeps its dot", sw.log.includes("a" + [gb.x + 26 + (lb.right - lb.left) + 6, cyb - 5, 2, 0, 7].join()));
  }
  {
    const off = paint(keyV({ tab: "pad", row: 1 })), g0 = geomOf(0, G2), g1 = geomOf(1, G2), lab = (r, s, g) => r.texts.find((t) => t.s === s && t.y === g.y + g.h / 2);
    check("no pad: the whole row dims to 0.45, label and value, as OPTIONS", lab(off, "MOVE", g0).alpha === 0.45 && lab(off, "BOMB", g1).alpha === 0.45 && lab(off, "SOUTH", g1).alpha === 0.45);
    check("and the band too", off.rects.some((q) => q.y === g1.y && q.w === 3 && q.alpha === 0.45));
    check("nothing past the rows dims", off.texts.find((t) => t.s === "CONTROLS").alpha === 1 && off.texts.find((t) => t.s === CAPTION.none).alpha === 1 && off.texts.at(-1).alpha === 1);
    const nb = paint(padV({ row: 1, pad: { ...PR, rumble: false } })), g6 = geomOf(6, G2);
    check("NONE on a connected pad dims the row too", lab(nb, "VIBRATION", g6).alpha === 0.45 && lab(nb, "NONE", g6).alpha === 0.45 && lab(nb, "BOMB", g1).alpha === 1);
    const on = paint(padV({ row: 1 }));
    check("a live VIBRATION row stays at full alpha", lab(on, "VIBRATION", g6).alpha === 1 && lab(on, "MEDIUM", g6).alpha === 1);
    const fx2 = paint(keyV({ row: 1 })), g5b = geomOf(5, G2), lock = fx2.rects.filter((q) => q.fill === MUTED && q.y >= g5b.y && q.y <= g5b.y + g5b.h);
    check("fixed rows stay undimmed, padlock included", lab(fx2, "CONFIRM", g5b).alpha === 1 && lock.length > 0 && lock.every((q) => q.alpha === 1));
  }
  {
    const r = paint(padV({ row: 0 })), g0 = geomOf(0, G2), cy = g0.y + g0.h / 2, a = r.texts.find((t) => t.s === "D-PAD" && t.y === cy), b = r.texts.find((t) => t.s === "L-STICK" && t.y === cy);
    check("value tokens sit 12 apart, glyph between", Math.abs(b.left - a.right - (12 + 18 + 4)) < 1e-6, b.left - a.right);
  }
  {
    const row = (y) => KB_ROWS.find((q) => q[0] === y)[1], en = row(72).find((q) => q[0] === "Enter"), es = row(30).find((q) => q[0] === "Escape");
    check("ENTER is 44 wide, 216..260; ESC is 30", en[2] === 216 && en[3] === 44 && es[3] === 30, [en, es].join("|"));
    for (const k of [G2.keys.k, 1, 1.25]) {
      const d = recCtx(); drawKeys(d.c, 0, 0, k, { keys: {} });
      const fit = (s, x, w) => { const q = d.texts.find((t) => t.s === s); return q && q.left >= x * k && q.right <= (x + w) * k; };
      check("ENTER and ESC fit their caps at k " + k.toFixed(2), fit("ENTER", en[2], en[3]) && fit("ESC", es[2], es[3]));
    }
  }
  {
    const d = recCtx(); drawPad(d.c, 0, 0, 1, { parts: { N: "lit", E: "lit", S: "lit", W: "lit" }, labels: { N: "THROW", E: "REMOTE", S: "BOMB", W: "PAUSE" } });
    const R = Math.PI * 2;
    check("the face buttons are radius 8, spaced 18 round (216,82)", [[216, 64], [234, 82], [216, 100], [198, 82]].every(([x, y]) => d.log.includes("a" + [x, y, 8, 0, R].join())));
    check("the lit dot is 2.5", [[216, 64], [234, 82], [216, 100], [198, 82]].every(([x, y]) => d.log.includes("a" + [x, y, 2.5, 0, 7].join())));
    check("the leaders start on the new rim", ["m224,64", "m242,82", "m224,100", "m201,89"].every((q) => d.log.includes(q)) && d.log.includes("l210,112") && d.log.includes("l258,112"));
    const faces = [[216, 64], [234, 82], [216, 100], [198, 82]];
    check("the face buttons clear the right stick's well", faces.every(([x, y]) => Math.hypot(x - 180, y - 112) >= 8 + 13 + 1), faces.map(([x, y]) => (Math.hypot(x - 180, y - 112) - 21).toFixed(1)).join());
    const segDist = (px, py, ax, ay, bx, by) => { const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2))); return Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay)); };
    check("WEST's leader clears SOUTH and the right stick", segDist(216, 100, 201, 89, 210, 112) > 8 && segDist(216, 100, 210, 112, 258, 112) > 8 && segDist(180, 112, 201, 89, 210, 112) > 13);
    const pz = paint(padV({ row: 2 })).texts.find((t) => t.s === "THROW" && t.mono);
    check("WEST's word sits level with its leader's end", !!pz && pz.y === G2.pad.y + 112 * G2.pad.k, pz && pz.y);
  }
  {
    const P = G2.pane, v = padV({ row: 6 }), r = paint(v), L = r.texts.filter((t) => t.y > P.y + P.h - 40 && t.y < P.y + P.h && t.left >= P.x);
    check("the VIBRATION rule keeps every word and stays in the pane", L.map((t) => t.s).join(" ") === "HITS, BLASTS, PLANTS AND MENUS LOW SKIPS MENUS" && L.every((t) => t.left >= P.x + 4 && t.right <= P.x + P.w - 4), L.map((t) => t.s).join("|"));
    check("no word sits alone in the rule", L.length === 1 || L.every((t) => t.s.includes(" ")), L.map((t) => t.s).join("|"));
    const u = paint(padV({ row: 6, pad: { ...PR, effects: null } })), U = u.texts.filter((t) => t.y > P.y + P.h - 70 && t.y < P.y + P.h && t.left >= P.x && t.fill === TEXT);
    check("with effects unknown the rule keeps every word, inside the pane, on the pad's empty foot", U.map((t) => t.s).join(" ") === "HITS, BLASTS, PLANTS AND MENUS LOW SKIPS MENUS · " + FEEL_NOTHING && U.every((t) => t.left >= P.x + 4 && t.right <= P.x + P.w - 4 && t.s.includes(" ")) && U[0].y >= G2.pad.y + 165 * G2.pad.k, U.map((t) => t.s + "@" + t.y).join("|"));
    { const Lg = layout(608, 352), Gg = geoFor(Lg, false, false), q = paint(padV({ row: 6, pad: { ...PR, effects: null } }), {}, Lg), T0 = q.texts.filter((t) => t.y > Gg.pane.y + 40 && t.left >= Gg.pane.x && t.fill === TEXT && t.s !== "CONTROLS" && /^HITS, BLASTS/.test(t.s))[0], m = q.log.indexOf("m54,144"), bot = Gg.pad.y + 165 * Gg.pad.k;
      check("608x352, effects unknown: the four-line rule clears the lifted grips", !!T0 && m >= 0 && T0.y - 6 >= bot - Math.max(0, Math.min(24 * Gg.pad.k, 2 * 13 - 31 * Gg.pad.k)), T0 && [T0.y, bot].join()); }
    const Ls = layout(400, 520), Gg = geoFor(Ls, true, true, 0.9), g = paint(padV({ row: 5, stickVal: [0.5, 0], reads: "RIGHT", drift: 0.04 }), { touch: true, narrow: true, scale: 0.9 }, Ls), R0 = g.texts.find((t) => t.s.includes("READS RIGHT"));
    check("a box with no pane reads the stick in one line, inside the plate", !Gg.pane && !!R0 && R0.s.includes("DRIFT 0.04") && R0.left >= Gg.x + 4 && R0.right <= Gg.x + Gg.w - 4, g.texts.map((t) => t.s).join("|"));
  }
}

// the OPTIONS door reads the level where it fits the row, at both pitches
for (const [nm, Lx, touch] of [["keyboard 27", L600, false], ["touch 37", L600, true], ["touch 400 wide", layout(400, 700), true], ["guard 608x352", layout(608, 352), false]]) {
  const r = recCtx();
  drawSettings(r.c, Lx, 1, { row: 10, vals: {}, ctlDoor: "CONTROLLER ›", padVib: "MEDIUM", touch });
  const v = r.texts.find((t) => t.s === "VIBRATION MEDIUM ›"), lab = r.texts.find((t) => t.s === "CONTROLS");
  check("the door fits beside its label: " + nm, !!v && !!lab && v.left >= lab.right + 12 && v.y === lab.y, v && [lab.right, v.left].join());
}
{
  const r = recCtx();
  drawSettings(r.c, L600, 1, { row: 10, vals: {}, ctlDoor: "KEYBOARD ›", touch: false });
  check("no level, the door stays as today", r.texts.some((t) => t.s === "KEYBOARD ›") && !r.texts.some((t) => t.s.startsWith("VIBRATION")));
}

// art primitives on a context with no Path2D
{
  const r = recCtx();
  trace(r.c, BODY_PATH);
  check("the path reader emits canvas calls for the mock's body string", r.log[0] === "bp" && r.log.some((x) => x.startsWith("bz")) && r.log.at(-1) === "cp");
  const r2 = recCtx();
  trace(r2.c, "M1,2 H3 V4 L5,6 Q7,8 9,10 Z");
  check("M H V L Q Z read exactly", r2.log.join() === "bp,m1,2,l3,2,l3,4,l5,6,q7,8,9,10,cp", r2.log.join());
  check("every pad part can trace", ["TRL", "TRR", "SHL", "SHR", "dpad", "LS", "RS", "SELECT", "START", "N", "E", "S", "W"].every((id) => { try { PARTS[id](recCtx().c); return true; } catch (e) { return false; } }));
  const g = recCtx();
  let ok = true;
  for (const [k, v] of [["face", "S"], ["dpad", "all"], ["dpad", "U"], ["shoulder", "R"], ["trigger", "L"], ["stick", "L"], ["centre", "START"]]) ok = glyph(g.c, k, 0, 0, 16, v, TEXT) > 0 && ok;
  check("each glyph kind paints and reports a width", ok && g.log.length > 20);
  const d = recCtx();
  drawPad(d.c, 0, 0, 1, { parts: { S: "lit", dpad: "alias", N: "swap", LS: "lit", RS: "alias", START: "lit", SELECT: "alias" }, labels: { S: "BOMB" }, spark: true, fs: 12 });
  drawKeys(d.c, 0, 0, 1.3, { keys: { Space: "lit", KeyJ: "alias", KeyQ: "swap", ArrowUp: "alias" }, base: new Set(["KeyQ"]) });
  check("pad and keyboard diagrams draw on the headless stand-in", d.texts.some((t) => t.s === "BOMB") && d.texts.some((t) => t.s === "SPACE"));
}

// nothing of the old skin
{
  const lum = (h) => { const n = parseInt(h.slice(1), 16), f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  check("#dfe7f5 on the plate's ground >= 4.5", TEXT === "#dfe7f5" && cr(TEXT, "#0a0e18") >= 4.5, cr(TEXT, "#0a0e18").toFixed(2));
  check("muted #7385ad outlines read on the pad body >= 3", cr(MUTED, "#16203a") >= 3, cr(MUTED, "#16203a").toFixed(2));
  check("accent on the plate >= 4.5", cr(ACCENT, "#0a0e18") >= 4.5);
}

// source rules
{
  const FILES = ["src/render/controlsgeo.js", "src/render/padart.js", "src/render/controlsdraw.js"], src = Object.fromEntries(FILES.map((f) => [f, readFileSync(join(ROOT, f), "utf8")]));
  const all = Object.values(src).join("\n"), lower = all.toLowerCase();
  const maker = ["bomber" + "man", "xb" + "ox", "play" + "station", "dual" + "shock", "dual" + "sense", "nin" + "tendo", "son" + "y", "micro" + "soft", "log" + "itech"];
  check("no maker names in the three files", maker.every((w) => !lower.includes(w)), maker.filter((w) => lower.includes(w)).join());
  check("no LB, RB, LT, RT ids in the three files", !/\b(LB|RB|LT|RT)\b/.test(all));
  check("no src/app import in the three files", !/from\s+["'][^"']*\/app\//.test(all));
  check("no Path2D, roundRect or setLineDash: the headless stub has none", !/Path2D|roundRect|setLineDash/.test(all));
  check("no timers or clocks", !/performance\.now|Date\.now|new Date|Math\.random|setTimeout/.test(all));
  check("every state keeps a shape and a word in the source", ["SWAPPED", "CHANGED", "PRESS AGAIN", "lockGlyph"].every((w) => all.includes(w)));
  check("no selection ring function", !/function ring\b/.test(all));
  check("the old skin is gone", !/\b(drawTile|drawChip|pillTabs|drawPrompts|chipIcon|tileGeom|chipGeom|THEME|padHit|promptsOf|drawCapture2|drawPad2|drawKeys2)\b/.test(all), (all.match(/\b(drawTile|drawChip|pillTabs|drawPrompts|chipIcon|tileGeom|chipGeom|THEME|padHit|promptsOf|drawCapture2|drawPad2|drawKeys2)\b/) || [""])[0]);
  check("the page's rows, plate and tabs come from the kit, never a copy", /paintRow\(/.test(src["src/render/controlsdraw.js"]) && /\bplate\(/.test(src["src/render/controlsdraw.js"]) && /\bsegs\(/.test(src["src/render/controlsdraw.js"]) && /listGeom\(/.test(src["src/render/controlsgeo.js"]) && /listHit\(/.test(src["src/render/controlsgeo.js"]) && !/function (plate|paintRow|segs|head|foot)\b/.test(all));
}

console.log(fail ? `CONTROLSDRAW FAIL (${pass} pass, ${fail} fail)` : `CONTROLSDRAW OK (${pass} pass)`);
process.exit(fail ? 1 : 0);
