import { readFileSync } from "node:fs";
import { createControlsPage } from "../src/app/controlspage.js";
import { DEF_CONTROLS, clampControls, bindBtn } from "../src/app/controls.js";

let pass = 0, fail = 0;
function check(n, c, d) { c ? pass++ : fail++; console.log((c ? "  PASS " : "  FAIL ") + n + (d !== undefined ? " -> " + d : "")); }
const J = JSON.stringify;
const CANCEL = "CANCELLED · NOTHING CHANGED";
function rig(o) {
  const r = { c: (o && o.c) || DEF_CONTROLS, writes: [], flags: [], said: [], pv: { state: "ready", name: "CONTROLLER 1", rumble: true, ...(o && o.pv) } };
  r.p = createControlsPage({ get: () => r.c, set: (c, f) => { r.c = c; r.writes.push(c); r.flags.push(f || {}); }, padView: () => r.pv, say: (s) => r.said.push(s) });
  return r;
}
const row = (r, i) => { while (r.p.view(0).row !== i) r.p.walk(1, 1); };
const arm = (r, t) => { r.p.tick(t, false); r.p.tick(t + 200, false); return t + 200; };
const open = (dev, o) => { const r = rig(o); r.p.open(dev); return r; };

{
  const r = open("key");
  const v = r.p.view(0);
  check("view() has the mock's S shape", J(Object.keys(v).sort()) === J(["armed", "binds", "capture", "device", "dead", "echo", "key", "names", "pad", "reads", "drift", "vib", "row", "status", "stick", "stickVal", "swap", "tab"].sort()), J(Object.keys(v)));
  check("view values", v.tab === "key" && v.device === "key" && v.row === 1 && v.key === r.c.key && v.binds === r.c.pad && v.stick === "L" && v.dead === 25 && v.vib === 2 && v.armed === false && v.swap === null && v.status === "" && v.capture === null && v.echo === null && J(v.stickVal) === J([0, 0]) && v.pad.state === "ready" && v.pad.name === "CONTROLLER 1");
  check("open says one sentence", J(r.said) === J(["Controls, keyboard."]));
  check("opens on the last-used tab", open("pad").p.view(0).tab === "pad" && open("touch").p.view(0).tab === "pad" && open("touch").p.view(0).device === "touch");
}
{
  const r = open("key");
  r.p.walk(1, 1); check("down walks one row", r.p.view(0).row === 2);
  r.p.walk(-1, 1); r.p.walk(-1, 1); check("up walks back", r.p.view(0).row === 0);
  r.p.walk(-1, 1); check("up wraps to the last row", r.p.view(0).row === 7);
  r.p.walk(1, 1); check("down wraps to the first row", r.p.view(0).row === 0);
  r.p.walk(1, 1); r.p.walk(1, 1); r.p.walk(1, 1);
  check("the walk passes every row in order", r.p.view(0).row === 3);
  check("left on the tab already set is silent", r.p.walk(-1, 0) === false && r.p.view(0).tab === "key");
  check("right changes the tab, row kept", r.p.walk(1, 0) === true && r.p.view(0).tab === "pad" && r.p.view(0).row === 3);
  check("left changes it back", r.p.walk(-1, 0) === true && r.p.view(0).tab === "key");
  r.said.length = 0; r.p.walk(-1, 1);
  check("a row move says label, binding and place", J(r.said) === J(["Throw, E. 3 of 8."]), J(r.said));
}
{
  const r = open("pad");
  r.p.confirm(0); arm(r, 10);
  const line = "EAST WAS REMOTE · REMOTE NOW SOUTH";
  check("feedBtn swallows in capture", r.p.feedBtn("E", 300) === true);
  const v = r.p.view(300);
  check("swap sets swap row and status line", v.status === line && v.swap && v.swap.row === "REMOTE" && v.swap.part === "S" && v.capture === null, J(v.swap));
  check("swap writes the swapped pad", r.c.pad.BOMB === "E" && r.c.pad.REMOTE === "S");
  check("set() is called exactly once per commit with the saved Controls", r.writes.length === 1 && r.writes[0] === r.c);
  check("the swap reads to the live region once", r.said.filter((s) => s === line).length === 1);
  r.p.tick(301, false); r.p.tick(6000, false);
  check("the swap lasts up to 6 s", r.p.view(6000).swap !== null);
  r.p.tick(6301, false);
  check("the swap ends at 6 s by t", r.p.view(6301).swap === null && r.p.view(6301).status === "");
  r.c = bindBtn(DEF_CONTROLS, "BOMB", "S").c;
  r.p.confirm(7000); r.p.tick(7001, false); r.p.tick(7201, false); r.p.feedBtn("E", 7300);
  r.p.tick(7301, false);
  r.p.feedBtn("N", 7400);
  check("the next press ends the swap", r.p.view(7400).swap === null && r.p.view(7400).status === "");
}
{
  const r = open("key");
  row(r, 2); r.p.confirm(0); check("capture opens on a key row", r.p.capturing === true && r.p.view(0).capture.action === "THROW" && r.p.view(0).capture.prompt === "PRESS A KEY" && r.p.view(0).capture.foot === "ESC CANCELS · E KEEPS IT", J(r.p.view(0).capture));
  arm(r, 10);
  check("capture says its prompt", r.said.at(-1) === "PRESS A KEY for THROW.", r.said.at(-1));
  r.p.feedKey("Space", " ", 300);
  check("a key held by another action swaps", r.c.key.THROW === "Space" && r.c.key.BOMB === "KeyE" && r.p.view(300).swap.row === "BOMB" && r.p.view(300).status === "SPACE WAS BOMB · BOMB NOW E" && r.writes.length === 1, r.p.view(300).status);
}
{
  const r = open("key");
  r.p.confirm(0); arm(r, 10);
  r.p.feedKey("KeyW", "w", 300);
  check("a key held by MOVE swaps with that direction", r.c.key.BOMB === "KeyW" && r.c.key.MOVE[0] === "Space" && r.p.view(300).swap.row === "MOVE" && r.p.view(300).status === "W WAS MOVE UP · MOVE UP NOW SPACE", r.p.view(300).status);
}
{
  const r = open("key");
  r.p.confirm(0); arm(r, 10);
  r.p.feedKey("Space", " ", 300);
  check("the current key keeps it: NO CHANGE, zero writes", r.p.view(300).status === "NO CHANGE" && r.writes.length === 0 && r.p.capturing === false);
  r.p.confirm(400); arm(r, 410);
  r.p.feedKey("KeyR", "r", 700);
  check("a refused key writes nothing and keeps listening", r.writes.length === 0 && r.p.capturing === true && r.p.view(700).capture.sub === "R IS THE CAMERA · PICK ANOTHER" && r.said.at(-1) === "R IS THE CAMERA · PICK ANOTHER");
  check("cancel closes with the line and no write", r.p.cancel() === true && r.p.view(700).status === CANCEL && r.writes.length === 0);
  check("cancel off capture is false", r.p.cancel() === false);
}
{
  const r = open("key");
  r.p.confirm(0); arm(r, 10);
  check("ESC in capture is swallowed", r.p.feedKey("Escape", "Escape", 300) === true && r.p.capturing === false && r.writes.length === 0 && r.p.view(300).status === CANCEL);
  r.p.confirm(400);
  check("back() in capture cancels and reports cap", r.p.back() === "cap" && r.p.capturing === false && r.writes.length === 0);
  check("back() off capture leaves the page", r.p.back() === "page");
}
{
  const r = open("key");
  r.p.confirm(0); arm(r, 10);
  check("EAST cancels a keyboard capture: it can never be a binding there", r.p.feedBtn("E", 300) === true && r.p.capturing === false && r.writes.length === 0 && r.p.view(300).status === CANCEL && r.said.at(-1) === CANCEL);
  const u = open("key"); u.p.confirm(0);
  check("EAST cancels before the arm clock too, as ESC does", u.p.feedBtn("E", 1) === true && u.p.capturing === false);
  const s = open("key"); s.p.confirm(0); arm(s, 10);
  check("another button in a keyboard capture is still ignored", s.p.feedBtn("S", 300) === true && s.p.capturing === true && s.writes.length === 0);
}
{
  const r = open("key");
  r.p.confirm(0);
  check("in capture nothing else moves the page", r.p.walk(1, 0) === false && r.p.walk(1, 1) === false && r.p.tab("pad") === false && r.p.confirm(1) === false && r.p.view(1).row === 1 && r.p.view(1).tab === "key");
}
{
  const r = open("key");
  row(r, 0); r.p.confirm(0);
  check("MOVE on keys opens the walk", r.p.view(0).capture.action === "MOVE · 1 OF 4");
  let t = arm(r, 10);
  for (const c of ["KeyI", "KeyL", "KeyK"]) { check("MOVE step " + c + " writes nothing", r.p.feedKey(c, c.slice(3).toLowerCase(), t) === true && r.writes.length === 0); t = arm(r, t + 1) + 1; r.p.tick(t, false); }
  r.p.feedKey("Space", " ", t);
  check("MOVE commits once after step 4", r.writes.length === 1 && J(r.c.key.MOVE) === J(["KeyI", "KeyL", "KeyK", "Space"]) && r.p.capturing === false);
  check("an action inside the new set takes a freed key, and the line names it", r.c.key.BOMB === "KeyW" && r.p.view(t).status === "MOVE NOW ISPACEKL · BOMB NOW W", r.p.view(t).status);
  check("the moved action reads SWAPPED", r.p.view(t).swap.row === "BOMB");
}
{
  const r = open("key");
  row(r, 0); r.p.confirm(0);
  let t = arm(r, 10);
  r.p.feedKey("KeyI", "i", t); t = arm(r, t + 1) + 1; r.p.tick(t, false);
  r.p.feedKey("KeyL", "l", t);
  r.p.feedKey("Escape", "Escape", t + 1);
  check("MOVE ESC at step 3 reverts all four", r.writes.length === 0 && J(r.c.key.MOVE) === J(DEF_CONTROLS.key.MOVE) && r.p.view(t).status === CANCEL);
}
{
  const r = open("key");
  row(r, 0); r.p.confirm(0);
  let t = arm(r, 10);
  for (const c of ["KeyW", "KeyD", "KeyS", "KeyA"]) { r.p.feedKey(c, c.slice(3).toLowerCase(), t); t = arm(r, t + 1) + 1; r.p.tick(t, false); }
  check("MOVE re-entered as it was: NO CHANGE, zero writes", r.writes.length === 0 && r.p.view(t).status === "NO CHANGE");
}
{
  const r = open("key");
  row(r, 7);
  r.c = bindBtn(DEF_CONTROLS, "BOMB", "E").c;
  r.p.confirm(0);
  check("reset arms", r.p.view(0).armed === true && r.writes.length === 0 && r.said.at(-1) === "Press again to reset this tab.");
  check("Enter does not disarm its own press", r.p.feedKey("Enter", "Enter", 1) === false && r.p.view(1).armed === true);
  r.p.confirm(2);
  check("reset second press on default keys: nothing to do", r.writes.length === 0 && r.p.view(2).status === "ALREADY ON THE DEFAULTS" && r.p.view(2).armed === false);
  const pad = r.c.pad;
  r.c = clampControls({ ...r.c, key: { ...r.c.key, BOMB: "KeyZ" } });
  r.p.confirm(3); r.p.confirm(4);
  check("reset keys resets, leaves the pad", r.writes.length === 1 && r.c.key.BOMB === "Space" && J(r.c.pad) === J(pad));
  check("reset keys line", r.p.view(4).status === "KEYBOARD BACK TO DEFAULTS");
}
{
  const r = open("pad");
  row(r, 7);
  r.c = clampControls({ ...DEF_CONTROLS, pad: { BOMB: "E", THROW: "W", REMOTE: "S", PAUSE: "SELECT" }, dead: 40, vib: 3, stick: "R", key: { ...DEF_CONTROLS.key, BOMB: "KeyZ" } });
  r.p.confirm(0); r.p.confirm(1);
  check("reset pad restores sensitivity, vibration, stick, leaves keys", r.writes.length === 1 && r.c.pad.BOMB === "S" && r.c.dead === 25 && r.c.vib === 2 && r.c.stick === "L" && r.c.key.BOMB === "KeyZ" && r.p.view(1).status === "CONTROLLER BACK TO DEFAULTS");
  check("and tells the wire it is a reset, so it does not buzz", r.flags.at(-1).reset === true);
  const off = open("pad"); row(off, 7);
  off.c = clampControls({ ...DEF_CONTROLS, dead: 40, vib: 0 });
  off.p.confirm(0); off.p.confirm(1);
  check("reset pad keeps a chosen OFF", off.c.vib === 0 && off.c.dead === 25);
}
{
  for (const [name, act] of [
    ["a walk", (r) => r.p.walk(-1, 1)], ["a tab", (r) => r.p.tab("key")], ["ESC", (r) => r.p.back()],
    ["another key", (r) => r.p.feedKey("KeyG", "g", 1)], ["another button", (r) => r.p.feedBtn("N", 1)],
  ]) {
    const r = open("pad"); row(r, 7);
    r.c = clampControls({ ...DEF_CONTROLS, dead: 40 });
    r.p.confirm(0); act(r);
    check("any other input disarms: " + name, r.p.view(1).armed === false);
    if (name === "ESC") check("ESC on an armed reset stays on the page", r.p.back() === "page");
    row(r, 7); r.p.confirm(2);
    check("the next confirm only arms again: " + name, r.writes.length === 0);
  }
  const r = open("pad"); row(r, 7); r.p.confirm(0);
  check("back() on an armed reset reports disarm", r.p.back() === "disarm");
  for (const code of ["Escape", "Backspace"]) { const q = open("pad"); row(q, 7); q.p.confirm(0); q.p.feedKey(code, code, 1); check(code + " on an armed reset disarms and stays on the page", q.p.back() === "disarm" && q.p.view(1).armed === false); }
  { const q = open("pad"); row(q, 7); q.p.confirm(0); q.p.feedBtn("E", 1); check("EAST on an armed reset disarms and stays on the page", q.p.back() === "disarm" && q.p.view(1).armed === false); }
  for (const id of ["S", "START"]) { const q = open("pad"); row(q, 7); q.p.confirm(0); check(id + " does not disarm its own press", q.p.feedBtn(id, 1) === false && q.p.view(1).armed === true); }
  for (const code of ["Space", "KeyJ", "KeyX"]) { const q = open("key", { c: clampControls({ ...DEF_CONTROLS, key: { ...DEF_CONTROLS.key, THROW: "KeyZ" } }) }); row(q, 7); q.p.confirm(0); check("the live BOMB key or alias does not disarm its own press: " + code, q.p.feedKey(code, code, 1) === false && q.p.view(1).armed === true); q.p.confirm(2); check("and the second press finishes the reset: " + code, q.c.key.THROW === "KeyE" && q.p.view(2).armed === false); }
  { const q = open("key", { c: clampControls({ ...DEF_CONTROLS, key: { ...DEF_CONTROLS.key, BOMB: "KeyZ" } }) }); row(q, 7); q.p.confirm(0); q.p.feedKey("KeyZ", "z", 1); check("a rebound BOMB key confirms too", q.p.view(1).armed === true); q.p.feedKey("Space", " ", 2); check("Space off BOMB is just another key: it disarms", q.p.view(2).armed === false); }
  { const q = open("key", { c: clampControls({ ...DEF_CONTROLS, key: { ...DEF_CONTROLS.key, BOMB: "KeyZ" } }) }); row(q, 7); q.p.confirm(0); q.p.feedKey("KeyJ", "j", 1); check("J is no alias once BOMB moved: it disarms", q.p.view(1).armed === false); }
}
{
  const SAY25 = "Sensitivity, medium. The stick must move 25 percent before it counts.", SAY15 = "Sensitivity, high. The stick must move 15 percent before it counts.";
  const r = open("pad");
  row(r, 5);
  r.c = clampControls({ ...DEF_CONTROLS, dead: 15 });
  r.p.confirm(0); check("SENSITIVITY Enter steps toward MAX", r.c.dead === 8 && r.writes.length === 1);
  r.p.confirm(1); check("SENSITIVITY wraps MAX to MIN", r.c.dead === 60 && r.writes.length === 2);
  check("the step says the note's line", r.said.at(-1) === "Sensitivity, min. The stick must move 60 percent before it counts.", r.said.at(-1));
  const w = r.writes.length;
  check("the page is on its value row", r.p.onValue === true);
  r.p.walk(1, 0);
  check("right steps up a level, row kept", r.p.view(0).row === 5 && r.c.dead === 40 && r.writes.length === w + 1);
  r.p.walk(-1, 0);
  check("left steps back", r.c.dead === 60 && r.writes.length === w + 2);
  check("left clamps at MIN, silent, no write", r.p.walk(-1, 0) === false && r.c.dead === 60 && r.writes.length === w + 2);
  r.c = clampControls({ ...r.c, dead: 8 });
  check("right clamps at MAX, silent, no write", r.p.walk(1, 0) === false && r.c.dead === 8 && r.writes.length === w + 2);
  check("a tab stays put on the value row", r.p.view(0).tab === "pad");
  r.c = clampControls({ ...r.c, dead: 25 });
  check("a held adjust keeps adjusting", r.p.walk(1, 0, true) === true && r.c.dead === 15 && r.said.at(-1) === SAY15);
  r.p.walk(-1, 1);
  check("up walks off SENSITIVITY and writes nothing new", r.p.view(0).row === 4 && r.c.dead === 15 && r.p.onValue === false);
  check("a held lateral off a value row is silent: the tab changes once, on the press", r.p.walk(-1, 0, true) === false && r.p.view(0).tab === "pad");
  r.p.walk(1, 1);
  check("the walk says the note's line with its place", r.said.at(-1) === SAY15 + " 6 of 8.", r.said.at(-1));
  const k = open("key"); k.p.pick(5);
  check("→ from CONFIRM: a tab change onto PAUSE, never onto SENSITIVITY", k.p.walk(1, 0) === true && k.p.view(0).tab === "pad" && k.p.view(0).row === 4);
  check("the hold that follows steps nothing", k.p.walk(1, 0, true) === false && k.c.dead === 25);
  check("← then only changes tab back: no write, ever", k.p.walk(-1, 0) === true && k.p.view(0).tab === "key" && k.p.view(0).row === 4 && k.writes.length === 0);
  const kb = open("key"); kb.p.pick(6); kb.p.walk(1, 0);
  check("→ from BACK lands on PAUSE, never on VIBRATION", kb.p.view(0).tab === "pad" && kb.p.view(0).row === 4 && kb.writes.length === 0);
  const pk = open("pad"); pk.p.pick(5); pk.p.tab("key");
  check("a tab off SENSITIVITY lands on PAUSE, never on CONFIRM", pk.p.view(0).tab === "key" && pk.p.view(0).row === 4);
  const pk2 = open("pad"); pk2.p.pick(6); pk2.p.tab("key");
  check("a tab off VIBRATION lands on PAUSE, never on BACK", pk2.p.view(0).row === 4);
  for (const i of [0, 1, 2, 3, 4, 7]) { const q = open("key"); q.p.pick(i === 1 ? 0 : 1); q.p.pick(i); q.p.tab("pad"); check("a shared row keeps its place across a tab: " + i, q.p.view(0).row === i); }
  const dz = open("pad"); dz.p.pick(5);
  check("a press on SENSITIVITY itself still adjusts", dz.p.walk(1, 0) === true && dz.c.dead === 15);
  const n = open("pad", { pv: { state: "none" } }); row(n, 5);
  check("with no pad SENSITIVITY takes no step and ←→ still changes tab", n.p.onValue === false && n.p.adjust(1) === false && n.p.walk(-1, 0) === true && n.p.view(0).tab === "key" && n.writes.length === 0);
  const cp = open("pad"); row(cp, 1); cp.p.confirm(0);
  check("adjust is inert in capture", cp.p.adjust(1) === false);
  check("no stale line: the first walk there reads MEDIUM", (() => { const q = open("pad"); q.p.pick(5); return q.said.at(-1) === SAY25 + " 6 of 8."; })());
}
{
  const NV = "NO VIBRATION ON THIS CONTROLLER OR BROWSER", SAY = "Vibration, none. No vibration on this controller or browser.";
  const r = open("pad", { pv: { rumble: false } });
  row(r, 6);
  check("no actuator: the walk says the note's line", r.said.at(-1) === SAY + " 7 of 8.", r.said.at(-1));
  r.p.confirm(0);
  check("VIBRATION inert without an actuator, the level kept", r.c.vib === 2 && r.writes.length === 0 && r.p.view(0).status === NV && r.said.at(-1) === SAY);
  check("the refusal returns false: no cue, the status still says why", r.p.confirm(1) === false && r.p.view(1).status === NV);
  check("no actuator: not a value row, ←→ changes tab", r.p.onValue === false && r.p.adjust(1) === false && r.p.walk(-1, 0) === true && r.p.view(0).tab === "key" && r.writes.length === 0);
  const n = open("pad", { pv: { state: "nonstd", name: "CONTROLLER 1 · BUTTONS 0-11", rumble: true } });
  row(n, 6); n.p.confirm(0);
  check("a non-standard pad with an actuator cycles like any other", n.writes.length === 1 && n.c.vib === 3);
  const nn = open("pad", { pv: { state: "nonstd", name: "CONTROLLER 1 · BUTTONS 0-11", rumble: false } });
  row(nn, 6); nn.p.confirm(0);
  check("a non-standard pad with none is inert", nn.writes.length === 0);
  const u = open("pad", { pv: { rumble: undefined } });
  row(u, 6); u.p.confirm(0);
  check("VIBRATION fails closed when the flag is missing", u.writes.length === 0);
  { const b = open("pad"); check("off the row the stick walks", b.p.stickBench === false);
    row(b, 5); check("on SENSITIVITY the stick is under test", b.p.stickBench === true);
    row(b, 6); check("VIBRATION is no test bench", b.p.stickBench === false);
    const nb = open("pad", { pv: { state: "none" } }); row(nb, 5); check("no pad, no bench", nb.p.stickBench === false);
    const ns = open("pad", { pv: { state: "nonstd", name: "x", rumble: true } }); row(ns, 5); check("a non-standard pad keeps its stick: it may have no D-PAD", ns.p.stickBench === false);
    const ky = open("key"); ky.p.pick(5); check("the keyboard tab's row 5 is no bench", ky.p.stickBench === false); }
  const a = open("pad");
  row(a, 6);
  check("the walk says the level", a.said.at(-1) === "Vibration, medium. Menus buzz too. Left and right change it. 7 of 8.", a.said.at(-1));
  check("VIBRATION is a value row with an actuator", a.p.onValue === true);
  a.p.confirm(0);
  check("Enter steps MEDIUM to HIGH", a.c.vib === 3 && a.writes.length === 1 && a.said.at(-1) === "Vibration, high. Menus buzz too. Left and right change it.", a.said.at(-1));
  a.p.confirm(1);
  check("Enter wraps HIGH to OFF, and says so", a.c.vib === 0 && a.writes.length === 2 && a.said.at(-1) === "Vibration off. No buzz at all.", a.said.at(-1));
  a.p.confirm(2);
  check("Enter steps OFF to LOW", a.c.vib === 1 && a.said.at(-1) === "Vibration, low. No menu buzz. Left and right change it.", a.said.at(-1));
  a.p.walk(-1, 0);
  check("left steps down", a.c.vib === 0 && a.writes.length === 4);
  check("left clamps at OFF, silent, no write", a.p.walk(-1, 0) === false && a.writes.length === 4);
  a.c = clampControls({ ...a.c, vib: 3 });
  check("right clamps at HIGH, silent, no write", a.p.walk(1, 0) === false && a.writes.length === 4);
  a.p.walk(-1, 0, true);
  check("a held step keeps adjusting, and tells the wire it is a repeat", a.c.vib === 2 && a.flags.at(-1).repeat === true);
  a.p.walk(-1, 0);
  check("a fresh step is no repeat", a.c.vib === 1 && a.flags.at(-1).repeat === false);
  check("a clean press off the row takes no tab: shoulders do", a.p.view(0).tab === "pad" && a.p.tab("key") === true && a.p.view(0).tab === "key");
}
{
  const r = open("pad"), V = (t) => r.p.view(t);
  r.pv = { ...r.pv, stickVal: [0.1, 0.05] };
  r.p.tick(1000, false);
  check("at rest READS nothing and DRIFT reads the stick", V(1000).reads === "" && Math.abs(V(1000).drift - Math.hypot(0.1, 0.05)) < 1e-9);
  r.pv = { ...r.pv, stickVal: [0.02, 0] };
  r.p.tick(2500, false);
  check("DRIFT holds the peak at rest", Math.abs(V(2500).drift - Math.hypot(0.1, 0.05)) < 1e-9);
  r.p.tick(3001, false);
  check("the peak leaves after 2 s", Math.abs(V(3001).drift - 0.02) < 1e-9, V(3001).drift);
  r.pv = { ...r.pv, stickVal: [-0.9, 0.1] };
  r.p.tick(3100, false);
  check("READS names the direction, from the resolver", V(3100).reads === "LEFT", V(3100).reads);
  check("a push is no drift", Math.abs(V(3100).drift - 0.02) < 1e-9, V(3100).drift);
  r.pv = { ...r.pv, stickVal: [0.21, 0] };
  r.p.tick(3150, false);
  check("the resolver's release holds it on under the engage ring, as the game reads it", V(3150).reads === "RIGHT" || V(3150).reads === "LEFT", V(3150).reads);
  r.pv = { ...r.pv, stickVal: [0.15, 0] };
  r.p.tick(3200, false);
  check("past the release it reads nothing", V(3200).reads === "");
  check("a stick on its way home is no drift", Math.abs(V(3200).drift - 0.02) < 1e-9, V(3200).drift);
  r.p.tick(3350, false);
  check("settled, it counts again", Math.abs(V(3350).drift - 0.15) < 1e-9, V(3350).drift);
  r.pv = { ...r.pv, stickVal: [0, -0.2] }; r.c = clampControls({ ...r.c, dead: 15 }); r.p.open("pad"); r.p.tick(9000, false);
  check("the read follows the live level: 0.20 counts at HIGH", V(9000).reads === "UP", V(9000).reads);
  r.pv = { ...r.pv, stickVal: [0, 0] };
  r.p.open("pad");
  check("opening the page starts a clean read", V(5500).reads === "" && V(5500).drift === 0);
}
{
  const r = open("pad");
  row(r, 0); r.p.confirm(0);
  check("MOVE on pad flips the stick, no capture", r.c.stick === "R" && r.p.capturing === false && r.writes.length === 1 && r.p.view(0).status === "MOVE NOW ON D-PAD · R-STICK", r.p.view(0).status);
  r.p.confirm(1);
  check("and back", r.c.stick === "L" && r.writes.length === 2);
}
{
  const r = open("key");
  row(r, 5); r.p.confirm(0);
  check("a locked row says why, no capture", r.p.capturing === false && r.writes.length === 0 && r.p.view(0).status === "ENTER AND ESC STAY PUT SO YOU CAN ALWAYS GET BACK");
  row(r, 6); r.p.confirm(1);
  check("BACK is locked too", r.p.capturing === false);
  check("a fixed row refuses, typed \"refused\" for the wire's deny: no cue, the status still says why", r.p.confirm(2) === "refused" && r.p.view(2).status === "ENTER AND ESC STAY PUT SO YOU CAN ALWAYS GET BACK");
}
for (const state of ["none", "lost"]) {
  const r = open("pad", { pv: { state } });
  for (let i = 0; i < 8; i++) { row(r, i); r.p.confirm(i); r.p.confirm(i); }
  check("a no-pad pad tab is not rebindable: " + state, r.p.capturing === false && r.writes.length === 0);
}
{
  const r = open("pad");
  r.p.confirm(0); r.p.tick(10, false);
  r.pv = { state: "lost" };
  r.p.tick(20, false);
  check("pad lost mid-capture cancels", r.p.capturing === false && r.writes.length === 0 && r.p.view(20).status === CANCEL);
  r.pv = { state: "ready", name: "CONTROLLER 1", rumble: true };
  r.p.tick(30, false);
  check("pad back reads CONTROLLER BACK", r.p.view(30).status === "CONTROLLER BACK");
  const k = open("key");
  k.p.confirm(0); k.pv = { state: "lost" }; k.p.tick(20, false);
  check("pad lost does not touch a key capture", k.p.capturing === true);
  const n = open("pad", { pv: { state: "none" } });
  n.pv = { state: "ready", name: "CONTROLLER 1", rumble: true }; n.p.tick(5, false);
  check("a pad first seen on the page reads SEEN", n.p.view(5).status === "CONTROLLER SEEN · READY");
  const g = open("pad"); row(g, 7); g.p.confirm(0); g.pv = { state: "lost" }; g.p.tick(5, false);
  check("pad lost disarms RESET PAD", g.p.view(5).armed === false);
}
{
  const r = open("key");
  r.p.walk(1, 1);
  check("tab switch keeps row clamped", r.p.tab("pad") === true && r.p.view(0).tab === "pad" && r.p.view(0).row === 2 && r.said.at(-1) === "Controls, controller.");
  check("the tab already set is silent", r.p.tab("pad") === false);
  check("a bad tab is refused", r.p.tab("nope") === false && r.p.view(0).tab === "pad");
  const j = open("key"); j.p.pick(7); j.p.tab("pad");
  check("the last row survives a tab switch", j.p.view(0).row === 7);
}
{
  const r = open("key");
  check("pick jumps to a row", r.p.pick(4) === true && r.p.view(0).row === 4);
  check("pick on the row already selected is false", r.p.pick(4) === false);
  check("pick off the rows is false", r.p.pick(9) === false && r.p.view(0).row === 4);
  r.p.pick(7); r.p.confirm(0); r.p.pick(7);
  check("a tap on the armed RESET keeps it armed", r.p.view(0).armed === true);
  r.p.pick(1);
  check("a tap elsewhere disarms", r.p.view(0).armed === false);
  r.p.confirm(1);
  check("pick is inert in capture", r.p.pick(3) === false && r.p.view(1).row === 1);
}
{
  const r = open("pad");
  r.p.feedBtn("N", 100);
  check("a pad press echoes on the pad tab", r.p.view(100).echo === "N");
  r.p.tick(219, false); check("the echo holds under 120 ms", r.p.view(219).echo === "N");
  r.p.tick(220, false); check("the echo ends at 120 ms by t", r.p.view(220).echo === null);
  r.p.feedBtn("dU", 300); check("D-PAD does not echo", r.p.view(300).echo === null);
  const k = open("key"); k.p.feedBtn("N", 1); check("no echo on the key tab", k.p.view(1).echo === null);
  const s = open("pad", { pv: { stickVal: [0.4, -0.1] } });
  check("stickVal comes through padView", J(s.p.view(0).stickVal) === J([0.4, -0.1]));
}
{
  const r = open("key");
  r.p.confirm(0); arm(r, 10);
  r.p.feedKey("KeyZ", "z", 300);
  check("a commit press repeating is swallowed until released", r.p.feedKey("KeyZ", "z", 310) === true && r.p.view(310).status === "BOMB NOW Z");
  r.p.tick(320, true);
  check("still held, still swallowed", r.p.feedKey("KeyZ", "z", 330) === true);
  r.p.tick(340, false);
  check("released, the key is ordinary again", r.p.feedKey("KeyZ", "z", 350) === false);
  check("a printed name is kept for the chips", r.p.view(350).names.KeyZ === "z");
  const f = open("key");
  f.p.confirm(0); arm(f, 10);
  f.p.feedKey("KeyQ", "a", 300);
  check("B4: the status line names the printed key on its first bind", f.p.view(300).status === "A WAS REMOTE · REMOTE NOW SPACE" && f.c.key.BOMB === "KeyQ", f.p.view(300).status);
  f.p.tick(310, false); f.p.tick(520, false);
  f.p.confirm(520);
  check("B4: the capture plate names it too", f.p.view(520).capture.sub === "NOW A", f.p.view(520).capture.sub);
  f.p.tick(530, false); f.p.tick(740, false);
  f.p.feedKey("KeyZ", "w", 740);
  check("B4: a later line names the new key through names", f.p.view(740).status === "BOMB NOW W", f.p.view(740).status);
  const m = open("key");
  row(m, 0); m.p.confirm(0);
  let tm = arm(m, 10);
  for (const [c, k] of [["KeyI", "z"], ["KeyL", "y"], ["KeyK", "x"]]) { m.p.feedKey(c, k, tm); tm = arm(m, tm + 1) + 1; m.p.tick(tm, false); }
  m.p.feedKey("KeyJ", "v", tm);
  check("B4: a MOVE set reads through names", m.p.view(tm).status === "MOVE NOW ZVXY", m.p.view(tm).status);
  const g = open("key");
  g.p.confirm(0); arm(g, 10);
  g.p.feedKey("KeyR", "k", 300);
  check("a refused key leaves no name behind", g.p.view(300).names.KeyR === undefined);
  check("outside capture an unrelated key is not taken", r.p.feedKey("KeyG", "g", 360) === false);
}
{
  const n = open("pad", { pv: { state: "nonstd", name: "CONTROLLER 1 · BUTTONS 0-11" } });
  n.p.confirm(0);
  check("non-standard capture words read BUTTON n", n.p.view(0).capture.sub === "NOW BUTTON 0", n.p.view(0).capture.sub);
  arm(n, 10); n.p.feedBtn("E", 300);
  check("non-standard swap line reads BUTTON n", n.p.view(300).status === "BUTTON 1 WAS REMOTE · REMOTE NOW BUTTON 0", n.p.view(300).status);
}
{
  const r = open("pad");
  r.p.confirm(0);
  check("device word follows the pad", r.p.view(0).capture.foot === "START CANCELS · SOUTH KEEPS IT", r.p.view(0).capture.foot);
  let d = "key";
  const q = { c: DEF_CONTROLS, pv: { state: "ready", name: "x", rumble: true } };
  const g = createControlsPage({ get: () => q.c, set: (c) => { q.c = c; }, padView: () => q.pv, say: () => {}, device: () => d });
  g.open("key"); g.confirm(0);
  check("the device getter wins and the foot follows it", g.view(0).device === "key" && g.view(0).capture.foot === "ESC CANCELS · SPACE KEEPS IT");
  d = "pad";
  check("a device flip redraws the foot", g.view(0).device === "pad" && g.view(0).capture.foot === "START CANCELS · SPACE KEEPS IT");
  d = "touch";
  check("a touch player is told how to cancel", g.view(0).capture.foot === "TAP OFF THE PLATE CANCELS · SPACE KEEPS IT");
}
{
  const src = readFileSync(new URL("../src/app/controlspage.js", import.meta.url), "utf8");
  check("no wall clock or timer in controlspage.js", !/performance\.now|Date\b|setTimeout|setInterval/.test(src));
  check("the page never saves on its own", !/saveControls|localStorage/.test(src));
}

{
  const r = open("pad");
  row(r, 1); r.p.confirm(0); arm(r, 10);
  r.p.feedBtn("LS", 300);
  const v = r.p.view(300).capture;
  check("B9: a stick in pad capture reads the word and stays open", r.p.capturing === true && v.sub === "STICKS ALWAYS MOVE · PICK ANOTHER" && v.warn === 1 && r.writes.length === 0, J(v));
  check("B9: and it is spoken", r.said[r.said.length - 1] === "STICKS ALWAYS MOVE · PICK ANOTHER");
}

// ---- the walk names the binding (a11y R7.2, T14) ----
{
  const walkAll = (r) => { const out = []; for (let i = 0; i < 8; i++) { r.said.length = 0; if (r.p.view(0).row === i) r.p.pick(i === 0 ? 1 : 0); r.said.length = 0; r.p.pick(i); out.push(r.said[0]); } return out; };
  const k = walkAll(open("key"));
  check("keyboard walk", J(k) === J(["Move, WASD. 1 of 8.", "Bomb, SPACE. 2 of 8.", "Throw, E. 3 of 8.", "Remote, Q. 4 of 8.", "Pause, P. 5 of 8.", "Confirm, ENTER. 6 of 8.", "Back, ESC. 7 of 8.", "Reset keys. 8 of 8."]), J(k));
  const p = walkAll(open("pad"));
  check("pad walk", J(p) === J(["Move, D-PAD and L-STICK. 1 of 8.", "Bomb, SOUTH. 2 of 8.", "Throw, WEST. 3 of 8.", "Remote, EAST. 4 of 8.", "Pause, START and SELECT. 5 of 8.", "Sensitivity, medium. The stick must move 25 percent before it counts. 6 of 8.", "Vibration, medium. Menus buzz too. Left and right change it. 7 of 8.", "Reset pad. 8 of 8."]), J(p));
  const r = open("key");
  r.p.pick(2); r.p.confirm(0); r.p.tick(1, false); r.p.tick(300, false); r.p.feedKey("KeyZ", "z", 301); r.p.tick(302, true); r.p.tick(600, false);
  r.said.length = 0; r.p.pick(3); r.said.length = 0; r.p.pick(2);
  check("the walk reads the live bind, and the printed key", r.said[0] === "Throw, Z. 3 of 8.", r.said[0]);
  const n = open("pad"); n.pv = { state: "nonstd", name: "CONTROLLER 1 · BUTTONS 0-9" };
  n.said.length = 0; n.p.pick(2);
  check("a non-standard pad says BUTTON n", n.said[0] === "Throw, BUTTON 2. 3 of 8.", n.said[0]);
  const no = open("pad"); no.pv = { state: "ready", name: "x", rumble: false }; no.p.pick(6);
  check("no actuator says so", no.said.at(-1) === "Vibration, none. No vibration on this controller or browser. 7 of 8.", no.said.at(-1));
  const on = open("pad"); on.pv = { state: "ready", name: "x", rumble: true }; on.c = { ...on.c, vib: 1 };
  on.p.pick(6);
  check("vibration says low", on.said.at(-1) === "Vibration, low. No menu buzz. Left and right change it. 7 of 8.", on.said.at(-1));
  on.c = { ...on.c, vib: 0 }; on.p.pick(1); on.p.pick(6);
  check("vibration says off", on.said.at(-1) === "Vibration off. No buzz at all. 7 of 8.", on.said.at(-1));
}

console.log("\n  CONTROLS PAGE RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
