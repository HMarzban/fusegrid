import { readFileSync } from "node:fs";
import {
  ACTIONS, MOVE_ORDER, DEF_KEY, DEF_PAD, DEF_CONTROLS, PAD_IDX, BTN, CONTROLS_KEY,
  clampControls, loadControls, saveControls, refuseKey, refuseBtn, bindKey, bindMoveSet, bindBtn,
  resetDevice, keyName, moveLabel, softAliases, boundKeys, VIB_LEVELS, SENS_LEVELS, stepVib, stepSens,
} from "../src/app/controls.js";

let pass = 0, fail = 0;
function check(n, c, d) { c ? pass++ : fail++; console.log((c ? "  PASS " : "  FAIL ") + n + (d !== undefined ? " -> " + d : "")); }
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const J = JSON.stringify;
const D = DEF_CONTROLS;

check("defaults are exactly the record's table",
  J(ACTIONS) === J(["BOMB", "THROW", "REMOTE", "PAUSE"]) && J(MOVE_ORDER) === J(["UP", "RIGHT", "DOWN", "LEFT"]) &&
  J(DEF_KEY) === J({ BOMB: "Space", THROW: "KeyE", REMOTE: "KeyQ", PAUSE: "KeyP", MOVE: ["KeyW", "KeyD", "KeyS", "KeyA"] }) &&
  J(DEF_PAD) === J({ BOMB: "S", THROW: "W", REMOTE: "E", PAUSE: "SELECT" }) &&
  D.stick === "L" && D.dead === 25 && D.rumble === 1 && D.vib === 2 && CONTROLS_KEY === "nb.controls.v1" &&
  Object.isFrozen(D) && Object.isFrozen(D.key) && Object.isFrozen(D.key.MOVE) && Object.isFrozen(PAD_IDX) &&
  PAD_IDX[0] === "S" && PAD_IDX[8] === "SELECT" && PAD_IDX[15] === "dR" && BTN.SHL.w === "L SHOULDER" && BTN.SHL.s === "L SHLDR" && BTN.S.w === "SOUTH");

const refused = ["Escape", "Enter", "NumpadEnter", "Backspace", "ArrowUp", "ArrowLeft", "Tab", "F5", "F12", "ShiftLeft", "ControlRight", "AltLeft", "MetaLeft", "CapsLock", "NumLock", "ScrollLock", "ContextMenu",
  "KeyM", "KeyR", "KeyT", "KeyC", "KeyB", "KeyU", "KeyY", "KeyN", "Digit1", "Digit5", "Numpad1", "Numpad5", "BracketLeft", "BracketRight"];
check("refuses each listed key with a non-empty line, allows KeyE/KeyK/Period",
  refused.every((k) => refuseKey(k) !== "") && ["KeyE", "KeyK", "Period", "KeyP", "Digit6", "Digit0", "Space", "Slash"].every((k) => refuseKey(k) === ""),
  refused.filter((k) => !refuseKey(k)).join());

let r = bindKey(D, "REMOTE", "KeyE");
check("swap within one device, line = \"E WAS THROW · THROW NOW Q\"", r.kind === "swap" && r.other === "THROW" && r.c.key.REMOTE === "KeyE" && r.c.key.THROW === "KeyQ" && r.line === "E WAS THROW · THROW NOW Q", r.line);
r = bindBtn(D, "BOMB", "E");
check("pad swap line = \"EAST WAS REMOTE · REMOTE NOW SOUTH\"", r.kind === "swap" && r.c.pad.BOMB === "E" && r.c.pad.REMOTE === "S" && r.line === "EAST WAS REMOTE · REMOTE NOW SOUTH", r.line);
r = bindKey(D, "BOMB", "KeyW");
check("a key held by MOVE swaps with that MOVE direction", r.kind === "move" && r.other === "UP" && r.c.key.BOMB === "KeyW" && r.c.key.MOVE[0] === "Space" && r.line === "W WAS MOVE UP · MOVE UP NOW SPACE", r.line);
r = bindKey(D, "BOMB", "Space");
check("same bind = NO CHANGE", r.kind === "same" && r.c === D && r.line === "NO CHANGE");
r = bindKey(D, "BOMB", "KeyZ");
check("plain set names the action", r.kind === "set" && r.other === null && r.line === "BOMB NOW Z" && r.c.key.BOMB === "KeyZ");
r = bindKey(D, "BOMB", "Escape");
check("a refused key changes nothing and says why", r.kind === "refused" && r.c === D && r.line === refuseKey("Escape"));
r = bindBtn(D, "BOMB", "START");
check("refuseBtn names the sticks", refuseBtn("LS") === "STICKS ALWAYS MOVE · PICK ANOTHER" && refuseBtn("RS") === "STICKS ALWAYS MOVE · PICK ANOTHER");
{
  const nm = { KeyZ: "w", KeyQ: "a" };
  check("bind lines name keys through names (B4)", bindKey(D, "BOMB", "KeyZ", nm).line === "BOMB NOW W");
  const sw = bindKey(D, "BOMB", "KeyQ", nm);
  check("a swap line names the taken key through names", sw.line === "A WAS REMOTE · REMOTE NOW SPACE", sw.line);
  const back = bindKey(sw.c, "BOMB", "KeyE", nm);
  check("a swap line names the displaced key through names", back.line === "E WAS THROW · THROW NOW A", back.line);
  check("a MOVE line names through names", bindKey(D, "BOMB", "KeyW", { KeyW: "z" }).line === "Z WAS MOVE UP · MOVE UP NOW SPACE");
  check("a MOVE set line names through names", bindMoveSet(D, ["KeyI", "KeyL", "KeyK", "KeyJ"], { KeyI: "ю" }).line === "MOVE NOW ЮJKL");
  check("no names reads as ever", bindKey(D, "BOMB", "KeyZ").line === "BOMB NOW Z");
}
check("refuseBtn words", refuseBtn("START") === "START IS PAUSE · PICK ANOTHER" && refuseBtn("dU") === "D-PAD ALWAYS MOVES · PICK ANOTHER" && refuseBtn("dR") === "D-PAD ALWAYS MOVES · PICK ANOTHER" && refuseBtn("S") === "" && refuseBtn("TRR") === "" && refuseBtn("zz") !== "" && r.kind === "refused" && r.c === D);

let c2 = bindBtn(bindKey(D, "BOMB", "KeyZ").c, "BOMB", "N").c;
check("keys and pad never conflict", c2.key.BOMB === "KeyZ" && c2.pad.BOMB === "N" && bindKey(D, "PAUSE", "KeyP").kind === "same" && bindBtn(D, "BOMB", "SELECT").c.pad.PAUSE === "S");

let m = bindMoveSet(D, ["ArrowUp", "KeyL", "KeyK", "KeyJ"]);
check("bindMoveSet refuses a refused key", m.c === D && m.moved.length === 0 && m.line !== "");
m = bindMoveSet(D, ["KeyI", "KeyL", "KeyK", "KeyI"]);
check("bindMoveSet duplicates refused", m.c === D && m.line === "ALREADY IN THIS MOVE SET");
m = bindMoveSet(D, ["KeyI", "KeyL", "KeyK", "KeyJ"]);
check("bindMoveSet 4 unique keys commit", J(m.c.key.MOVE) === J(["KeyI", "KeyL", "KeyK", "KeyJ"]) && m.moved.length === 0 && m.line === "MOVE NOW IJKL", m.line);
m = bindMoveSet(D, ["KeyQ", "Space", "KeyS", "KeyE"]);
const k = m.c.key, all = [...k.MOVE, k.BOMB, k.THROW, k.REMOTE, k.PAUSE];
check("an action key inside the new set takes a freed old MOVE key", J(k.MOVE) === J(["KeyQ", "Space", "KeyS", "KeyE"]) && new Set(all).size === 8 && ["KeyW", "KeyD", "KeyA"].includes(k.BOMB) && m.moved.includes("BOMB") && m.moved.includes("THROW") && m.moved.includes("REMOTE"), J(k));

const bad = { key: { BOMB: "Escape", THROW: "KeyE", REMOTE: "KeyQ", PAUSE: "KeyP", MOVE: ["KeyW", "KeyD", "KeyS", "KeyA"] }, pad: { BOMB: "W", THROW: "S", REMOTE: "E", PAUSE: "N" }, stick: "R", dead: 40, rumble: 1 };
let cc = clampControls(bad);
check("clampControls resets only the bad device", J(cc.key) === J(DEF_KEY) && J(cc.pad) === J({ BOMB: "W", THROW: "S", REMOTE: "E", PAUSE: "N" }) && cc.stick === "R" && cc.dead === 40 && cc.rumble === 1);
cc = clampControls({ ...bad, key: D.key, pad: { BOMB: "S", THROW: "S", REMOTE: "E", PAUSE: "N" } });
check("a duplicate pad block resets the pad only (stick, dead, rumble too)", J(cc.pad) === J(DEF_PAD) && cc.stick === "L" && cc.dead === 25 && cc.rumble === 1 && J(cc.key) === J(DEF_KEY));
check("a stored OFF stays the player's choice, even when the rest of the pad block resets", clampControls({ ...D, vib: 0 }).vib === 0 && clampControls({ ...D, vib: 0 }).rumble === 0 && clampControls({ ...bad, vib: 0, pad: { BOMB: "S", THROW: "S", REMOTE: "E", PAUSE: "N" } }).vib === 0);
const OLD = (rumble) => { const { vib, ...o } = D; return { ...o, rumble }; };
check("an old store migrates: rumble 0 is OFF, rumble 1 is MEDIUM, neither is MEDIUM", clampControls(OLD(0)).vib === 0 && clampControls(OLD(1)).vib === 2 && clampControls({ key: D.key, pad: D.pad, stick: "L", dead: 25 }).vib === 2);
check("an old store's OFF survives a bad pad block", clampControls({ ...OLD(0), pad: { BOMB: "S", THROW: "S", REMOTE: "E", PAUSE: "N" } }).vib === 0);
check("a valid vib wins over rumble", clampControls({ ...D, vib: 3, rumble: 0 }).vib === 3 && clampControls({ ...D, vib: 3, rumble: 0 }).rumble === 1 && clampControls({ ...D, vib: 0, rumble: 1 }).vib === 0);
{
  const mine = { ...D, pad: { BOMB: "N", THROW: "W", REMOTE: "E", PAUSE: "S" }, stick: "R", dead: 40 };
  for (const v of [9, -1, 1.5, "2", null, NaN, {}]) {
    const a = clampControls({ ...mine, vib: v, rumble: 1 }), b = clampControls({ ...mine, vib: v, rumble: 0 }), n = clampControls({ ...mine, vib: v, rumble: 7 });
    check("a bad vib " + J(v) + " never resets the binds, and falls back to rumble", J(a.pad) === J(mine.pad) && a.stick === "R" && a.dead === 40 && a.vib === 2 && b.vib === 0 && J(n.pad) === J(mine.pad) && n.vib === 2);
  }
}
check("rumble is always written, so an older cached page keeps the pad block", [0, 1, 2, 3].every((v) => { const c = clampControls({ ...D, vib: v }); return c.rumble === (v > 0 ? 1 : 0); }));
{
  const st4 = mem(); saveControls({ ...D, vib: 3 }, st4);
  const raw = JSON.parse(st4.m.get(CONTROLS_KEY));
  check("the store keeps v 1, both fields", raw.v === 1 && raw.vib === 3 && raw.rumble === 1);
  const st5 = mem(); st5.setItem(CONTROLS_KEY, J({ v: 1, key: D.key, pad: { BOMB: "W", THROW: "S", REMOTE: "E", PAUSE: "N" }, stick: "R", dead: 25, rumble: 0 }));
  const l5 = loadControls(st5);
  check("an old store loads with its binds and its OFF", l5.vib === 0 && l5.pad.BOMB === "W" && l5.stick === "R");
}
check("VIB_LEVELS", J(VIB_LEVELS) === J(["OFF", "LOW", "MEDIUM", "HIGH"]) && Object.isFrozen(VIB_LEVELS));
check("stepVib clamps and steps", stepVib(2, 1) === 3 && stepVib(3, 1) === 3 && stepVib(1, -1) === 0 && stepVib(0, -1) === 0 && stepVib(9, 1) === 3);
check("SENS_LEVELS: five levels, MIN to MAX", J(SENS_LEVELS.map((l) => [l.name, l.dead, l.flip])) === J([["MIN", 60, 1.4], ["LOW", 40, 1.35], ["MEDIUM", 25, 1.25], ["HIGH", 15, 1.15], ["MAX", 8, 1.1]]) && Object.isFrozen(SENS_LEVELS[0]));
check("stepSens walks the levels and clamps, right is more sensitive", stepSens(25, 1) === 15 && stepSens(15, 1) === 8 && stepSens(8, 1) === 8 && stepSens(25, -1) === 40 && stepSens(40, -1) === 60 && stepSens(60, -1) === 60 && stepSens(30, 1) === 15 && stepSens("x", 1) === 15);
const dupK = clampControls({ ...bad, key: { ...DEF_KEY, THROW: "Space" }, pad: bad.pad });
check("a duplicate key block resets keys", J(dupK.key) === J(DEF_KEY) && dupK.pad.BOMB === "W");
check("MOVE not four keys, START bound, unknown code all reset their device",
  J(clampControls({ key: { ...DEF_KEY, MOVE: ["KeyW"] }, pad: DEF_PAD }).key) === J(DEF_KEY) &&
  J(clampControls({ key: DEF_KEY, pad: { ...DEF_PAD, BOMB: "START" } }).pad) === J(DEF_PAD) &&
  J(clampControls({ key: DEF_KEY, pad: { ...DEF_PAD, BOMB: "ZZ" } }).pad) === J(DEF_PAD) &&
  J(clampControls({ key: { ...DEF_KEY, BOMB: 5 }, pad: DEF_PAD }).key) === J(DEF_KEY));
check("off-level dead snaps to the nearest level; a tie takes the bigger", J([5, 10, 12, 20, 21, 30, 33, 35, 45, 50, 55, 0, 99].map((n) => clampControls({ ...D, dead: n }).dead)) === J([8, 8, 15, 25, 25, 25, 40, 40, 40, 60, 60, 8, 60]));
check("garbage in clampControls gives defaults", J(clampControls(null)) === J(D) && J(clampControls("x")) === J(D) && J(clampControls({ stick: "Q", dead: "a", rumble: 3 })) === J(D) && J(clampControls({ stick: "Q", dead: "a", vib: "z" })) === J(D));

const st0 = mem(); saveControls({ ...D, vib: 0 }, st0);
check("default MEDIUM, and a saved OFF loads as OFF", loadControls(mem()).vib === 2 && loadControls(mem()).rumble === 1 && loadControls(st0).vib === 0 && loadControls(st0).rumble === 0);
const st = mem(); const mine = { ...bindKey(bindBtn(D, "BOMB", "N").c, "BOMB", "KeyZ").c, dead: 40, stick: "R" };
saveControls(mine, st);
check("save/load round-trips", J(loadControls(st)) === J(mine) && JSON.parse(st.m.get(CONTROLS_KEY)).v === 1);
const s2 = mem(); s2.setItem(CONTROLS_KEY, "{nope");
const s3 = mem(); s3.setItem(CONTROLS_KEY, J({ v: 2, key: 1 }));
const thrower = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } };
let threw = false; try { saveControls(mine, thrower); loadControls(thrower); } catch (_) { threw = true; }
check("absent/garbage/throwing store loads DEF_CONTROLS", J(loadControls(mem())) === J(D) && J(loadControls(s2)) === J(D) && J(loadControls(s3)) === J(D) && J(loadControls(thrower)) === J(D) && !threw && J(loadControls(null)) === J(D));

check("softAliases J/X while BOMB is Space", J(softAliases(D)) === J(["KeyJ", "KeyX"]));
check("J/X aliases vanish once BOMB is rebound", softAliases(bindKey(D, "BOMB", "KeyZ").c).length === 0);
check("each alias stops once its key is captured elsewhere", J(softAliases(bindKey(D, "THROW", "KeyX").c)) === J(["KeyJ"]) && J(softAliases(bindKey(D, "THROW", "KeyJ").c)) === J(["KeyX"]) && J(softAliases(bindMoveSet(D, ["KeyI", "KeyL", "KeyK", "KeyJ"]).c)) === J(["KeyX"]));
check("RESET KEYS restores the aliases", softAliases(resetDevice(bindKey(D, "BOMB", "KeyZ").c, "key")).length === 2);
check("boundKeys covers binds, MOVE and aliases", boundKeys(D).has("Space") && boundKeys(D).has("KeyW") && boundKeys(D).has("KeyJ") && boundKeys(D).has("KeyX") && !boundKeys(bindKey(D, "BOMB", "KeyZ").c).has("KeyJ") && boundKeys(bindKey(D, "BOMB", "Slash").c).has("Slash"));

const p0 = { ...bindBtn(D, "BOMB", "N").c, dead: 40, vib: 3, rumble: 1, stick: "R" };
const p1 = resetDevice(p0, "pad");
check("reset pad restores dead, stick, MEDIUM, leaves keys", J(p1.pad) === J(DEF_PAD) && p1.dead === 25 && p1.vib === 2 && p1.rumble === 1 && p1.stick === "L");
const pOff = resetDevice({ ...p0, vib: 0, rumble: 0 }, "pad");
check("reset pad keeps a chosen OFF", pOff.vib === 0 && pOff.rumble === 0 && pOff.dead === 25);
check("reset pad takes LOW to MEDIUM too", resetDevice({ ...p0, vib: 1 }, "pad").vib === 2);
const k1 = resetDevice(bindKey(p0, "BOMB", "KeyZ").c, "key");
check("reset keys leaves the pad alone", J(k1.key) === J(DEF_KEY) && k1.pad.BOMB === "N" && k1.dead === 40 && k1.vib === 3);

check("keyName and moveLabel", keyName("Space") === "SPACE" && keyName("KeyE") === "E" && keyName("Digit7") === "7" && keyName("Period") === "." && keyName("Slash") === "/" && keyName("KeyZ", "w") === "W" && keyName("KeyA", "q") === "Q" && keyName("Space", " ") === "SPACE" && moveLabel(DEF_KEY.MOVE) === "WASD");

const src = readFileSync(new URL("../src/app/controls.js", import.meta.url), "utf8").toLowerCase();
const maker = ["bomber" + "man", "xb" + "ox", "play" + "station", "dual" + "shock", "dual" + "sense", "nin" + "tendo", "son" + "y", "micro" + "soft", "log" + "itech"];
check("no maker names in controls.js", maker.every((w) => !src.includes(w)), maker.filter((w) => src.includes(w)).join());
check("no performance.now or Date in controls.js", !/performance\.now|Date\b/.test(src));

console.log("\n  CONTROLS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
