import { readFileSync } from "node:fs";
import { createCapture } from "../src/app/capture.js";

let pass = 0, fail = 0;
function check(n, c, d) { c ? pass++ : fail++; console.log((c ? "  PASS " : "  FAIL ") + n + (d !== undefined ? " -> " + d : "")); }
const J = JSON.stringify;
const CANCEL = "CANCELLED · NOTHING CHANGED";
const armedCap = (spec) => { const k = createCapture(); k.open(spec, 0); k.tick(16, true); k.tick(32, false); k.tick(232, false); return k; };
const again = (k, t) => { k.tick(t, true); k.tick(t + 1, false); k.tick(t + 201, false); return t + 201; };

{
  const k = createCapture();
  k.open({ action: "BOMB", dev: "key", cur: "Space" }, 0);
  for (let t = 16; t < 2000; t += 16) k.tick(t, true);
  check("does not arm while a key is still down", k.armed(2000) === false && k.feed("key", "KeyZ", 2000).kind === "ignored" && k.view() !== null);
  k.tick(2016, false);
  check("still down at open means the opening press counts until the first release", k.armed(2100) === false);
}
{
  const k = createCapture();
  k.open({ action: "BOMB", dev: "key", cur: "Space" }, 0);
  k.tick(10, true); k.tick(100, false);
  check("not armed 199 ms after the last release", k.armed(299) === false);
  k.tick(299, false);
  check("arms exactly 200 ms after the last release (injected t)", k.armed(300) === true);
  k.tick(299, false);
  check("later quiet ticks do not move the release time", k.armed(300) === true);
  const r = k.feed("key", "KeyZ", 300);
  check("an armed press commits", r.kind === "commit" && r.value === "KeyZ" && k.view() === null, J(r));
}
{
  const k = createCapture();
  k.open({ action: "BOMB", dev: "key", cur: "Space" }, 0);
  k.tick(0, false);
  k.tick(50, false);
  check("the timer alone never arms before 200 ms even with nothing down", k.armed(150) === false);
}
{
  const k = createCapture();
  k.open({ action: "BOMB", dev: "key", cur: "Space" }, 0);
  k.tick(0, true); k.tick(100, false); k.tick(150, true); k.tick(200, false);
  check("a bounce before 200 ms restarts the clock", k.armed(350) === false && k.armed(399) === false && k.armed(400) === true);
}
{
  const k = createCapture();
  k.open({ action: "BOMB", dev: "key", cur: "Space" }, 0);
  k.tick(0, false);
  const r = k.feed("key", "KeyZ", 100);
  check("a double tap binds nothing", r.kind === "ignored" && k.view() !== null);
  check("the early press restarts the clock even with no down tick seen", k.armed(250) === false);
  k.tick(116, false);
  check("the clock restarts from the release after that press", k.armed(315) === false && k.armed(316) === true);
}
{
  const k = createCapture();
  k.open({ action: "BOMB", dev: "key", cur: "Space" }, 0);
  const early = k.feed("key", "Escape", 1);
  check("ESC cancels before arm and writes nothing", early.kind === "cancel" && early.line === CANCEL && early.value === undefined && k.view() === null);
  const a = armedCap({ action: "BOMB", dev: "key", cur: "Space" });
  const late = a.feed("key", "Escape", 300);
  check("ESC cancels when armed", late.kind === "cancel" && late.line === CANCEL && a.view() === null);
}
{
  const k = armedCap({ action: "BOMB", dev: "key", cur: "Space" });
  for (let t = 300; t < 600000; t += 1000) k.tick(t, false);
  check("no timeout: still listening after 10 minutes of ticks", k.view() !== null && k.armed(600000) === true && k.feed("key", "KeyZ", 600000).kind === "commit");
}
{
  const k = armedCap({ action: "BOMB", dev: "key", cur: "Space" });
  const r = k.feed("key", "KeyR", 300);
  check("refused key keeps the plate open with its line", r.kind === "refused" && r.line === "R IS THE CAMERA · PICK ANOTHER" && k.view().sub === r.line && k.view().warn === 1);
  check("a refused press needs a release before the next one counts", k.feed("key", "KeyZ", 301).kind === "ignored");
  again(k, 310);
  check("the plate takes a good key after a refusal", k.feed("key", "KeyZ", 600).value === "KeyZ");
  for (const code of ["Enter", "NumpadEnter", "Backspace", "ArrowUp", "Tab", "F5", "ShiftLeft", "KeyM", "KeyY", "Digit1", "BracketLeft"]) {
    const q = armedCap({ action: "BOMB", dev: "key", cur: "Space" });
    const res = q.feed("key", code, 300);
    check("refuses " + code, res.kind === "refused" && !!res.line && q.view() !== null);
  }
}
{
  const k = armedCap({ action: "BOMB", dev: "key", cur: "Space" });
  const r = k.feed("key", "Space", 300);
  check("pressing the current bind = NO CHANGE", r.kind === "commit" && r.line === "NO CHANGE" && r.same === true && k.view() === null, J(r));
  const p = armedCap({ action: "THROW", dev: "pad", cur: "W" });
  const q = p.feed("btn", "W", 300);
  check("pressing the current button = NO CHANGE", q.kind === "commit" && q.line === "NO CHANGE" && q.same === true && p.view() === null, J(q));
}
{
  const k = armedCap({ action: "MOVE", dev: "key" });
  check("MOVE opens on step 1", k.view().action === "MOVE · 1 OF 4" && k.view().prompt === "PRESS UP" && k.view().sub === "ARROWS STAY ON");
  let t = 300, r = k.feed("key", "KeyI", t);
  check("MOVE step 1 is a step", r.kind === "step" && J(r.value) === J(["KeyI"]) && k.view().prompt === "PRESS RIGHT");
  check("the same press repeating does not fill the next step", k.feed("key", "KeyI", t + 30).kind === "ignored");
  t = again(k, t + 40); r = k.feed("key", "KeyL", t);
  check("MOVE step 2 reads step 3 next", r.kind === "step" && k.view().action === "MOVE · 3 OF 4" && k.view().prompt === "PRESS DOWN");
  t = again(k, t + 10); r = k.feed("key", "KeyL", t);
  check("duplicate in the MOVE set refused", r.kind === "refused" && r.line === "ALREADY IN THIS MOVE SET" && k.view().step === 2);
  t = again(k, t + 10); r = k.feed("key", "KeyK", t);
  check("MOVE step 3", r.kind === "step" && k.view().prompt === "PRESS LEFT");
  t = again(k, t + 10); r = k.feed("key", "KeyJ", t);
  check("MOVE 4 steps commits once", r.kind === "commit" && J(r.value) === J(["KeyI", "KeyL", "KeyK", "KeyJ"]) && k.view() === null, J(r));
  check("nothing more after the commit", k.feed("key", "KeyZ", t + 500).kind === "ignored");
}
{
  const k = createCapture();
  k.open({ action: "MOVE", dev: "key" }, 0);
  k.tick(10, false);
  check("MOVE keeps the 200 ms guard when capture opens", k.feed("key", "KeyI", 209).kind === "ignored" && k.view().step === 0);
  k.tick(220, false);
  check("the guard restarts from that release", k.armed(419) === false);
  let t = 420, r = k.feed("key", "KeyI", t), steps = r.kind === "step" ? 1 : 0;
  check("a later step ignores a key while the previous one is still down", k.feed("key", "KeyL", t + 8).kind === "ignored" && k.view().step === 1);
  k.tick(t + 16, true);
  check("still down at the next tick, still ignored", k.feed("key", "KeyL", t + 24).kind === "ignored");
  for (const code of ["KeyL", "KeyK", "KeyJ"]) { k.tick(t + 32, false); t += 32; r = k.feed("key", code, t + 1); k.tick(t + 16, true); t += 16; if (r.kind === "step" || r.kind === "commit") steps++; }
  check("four keys typed quickly lose nothing, far under 200 ms apart", steps === 4 && r.kind === "commit" && J(r.value) === J(["KeyI", "KeyL", "KeyK", "KeyJ"]), J(r));
  const n = armedCap({ action: "MOVE", dev: "key" });
  n.feed("key", "KeyR", 300); n.tick(310, false);
  check("a refused press re-arms on its release alone in MOVE", n.feed("key", "KeyI", 311).kind === "step");
  const b = armedCap({ action: "BOMB", dev: "key", cur: "Space" });
  b.feed("key", "KeyR", 300); b.tick(310, false);
  check("a refused press re-arms on its release alone in a one-press capture", b.feed("key", "KeyZ", 311).value === "KeyZ");
  const h = armedCap({ action: "BOMB", dev: "key", cur: "Space" });
  h.feed("key", "KeyR", 300);
  check("the refused key still held blocks a retry", h.feed("key", "KeyZ", 301).kind === "ignored");
  h.tick(310, true);
  check("still held at the next tick, still blocked", h.feed("key", "KeyZ", 311).kind === "ignored");
  h.tick(320, false);
  check("the first quiet tick lets the retry through", h.feed("key", "KeyZ", 321).value === "KeyZ");
  const p = armedCap({ action: "BOMB", dev: "pad", cur: "S" });
  p.feed("btn", "dU", 300); p.tick(310, false);
  check("a refused button re-arms on its release alone", p.feed("btn", "TRL", 311).value === "TRL");
  const f = createCapture(); f.open({ action: "BOMB", dev: "key", cur: "Space" }, 0); f.tick(1, false);
  f.feed("key", "KeyR", 50); f.tick(60, false);
  check("a press inside the first guard is no refusal and earns no shortcut", f.view().warn === 0 && f.feed("key", "KeyZ", 61).kind === "ignored");
}
{
  const k = armedCap({ action: "MOVE", dev: "key" });
  let t = 300; k.feed("key", "KeyI", t);
  t = again(k, t + 10); k.feed("key", "KeyL", t);
  t = again(k, t + 10);
  const r = k.feed("key", "Escape", t);
  check("MOVE ESC at step 3 reverts: no value handed back", r.kind === "cancel" && r.value === undefined && k.view() === null);
}
{
  const k = armedCap({ action: "BOMB", dev: "pad", cur: "S" });
  check("pad capture has its own prompt", k.view().prompt === "PRESS A BUTTON" && k.view().sub === "NOW SOUTH");
  const d = k.feed("btn", "dU", 300);
  check("pad capture never binds the D-PAD, and says so", d.kind === "refused" && d.line === "D-PAD ALWAYS MOVES · PICK ANOTHER" && k.view() !== null);
  const j = armedCap({ action: "BOMB", dev: "pad", cur: "S" });
  const STICKS = "STICKS ALWAYS MOVE · PICK ANOTHER", ls = j.feed("btn", "LS", 300), rs = j.feed("btn", "RS", 301);
  check("pad capture refuses a stick and says why (B9)", ls.kind === "refused" && ls.line === STICKS && rs.kind === "refused" && rs.line === STICKS && j.view().sub === STICKS && j.view().warn === 1 && j.view() !== null);
  check("a stick id does not restart the clock", j.armed(302) === true);
  const u = createCapture(); u.open({ action: "BOMB", dev: "pad", cur: "S" }, 0); u.tick(1, false);
  check("a stick id before arm gets the word and leaves the clock alone", u.feed("btn", "LS", 50).kind === "refused" && u.armed(200) === false && u.armed(201) === true);
  const ks = armedCap({ action: "BOMB", dev: "key", cur: "Space" });
  check("a key capture ignores a stick", ks.feed("btn", "LS", 300).kind === "ignored" && ks.view().warn === 0);
  const s = j.feed("btn", "START", 302);
  check("START cancels a pad capture, never binds", s.kind === "cancel" && s.line === CANCEL && j.view() === null);
  const e = createCapture(); e.open({ action: "BOMB", dev: "pad", cur: "S" }, 0);
  check("START cancels before arm too", e.feed("btn", "START", 1).kind === "cancel");
  const g = armedCap({ action: "BOMB", dev: "pad", cur: "S" });
  const r = g.feed("btn", "TRL", 300);
  check("an armed trigger commits", r.kind === "commit" && r.value === "TRL");
}
{
  const k = armedCap({ action: "BOMB", dev: "key", cur: "Space" });
  check("a pad button other than START does nothing in a key capture", k.feed("btn", "S", 300).kind === "ignored" && k.view() !== null);
  const s = armedCap({ action: "BOMB", dev: "key", cur: "Space" });
  check("START cancels a key capture opened on a pad (no trap)", s.feed("btn", "START", 300).kind === "cancel");
  const p = armedCap({ action: "BOMB", dev: "pad", cur: "S" });
  check("a key other than ESC does nothing in a pad capture", p.feed("key", "KeyZ", 300).kind === "ignored" && p.view() !== null);
  const q = armedCap({ action: "BOMB", dev: "pad", cur: "S" });
  check("ESC cancels a pad capture", q.feed("key", "Escape", 300).kind === "cancel");
}
{
  const k = createCapture();
  check("closed capture: view null, not armed, feed ignored", k.view() === null && k.armed(999) === false && k.feed("key", "KeyZ", 999).kind === "ignored");
  k.tick(1000, false);
  k.open({ action: "BOMB", dev: "key", cur: "Space" }, 1000);
  check("reopening starts unarmed", k.armed(5000) === false);
  k.cancel();
  check("cancel closes", k.view() === null);
}
{
  const src = readFileSync(new URL("../src/app/capture.js", import.meta.url), "utf8");
  check("no wall clock or timer in capture.js", !/performance\.now|Date\b|setTimeout|setInterval/.test(src));
}

console.log("\n  CAPTURE RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
