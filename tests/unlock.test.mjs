// src/app/unlock.js armUnlock (opening spec §5): stay armed until the ctx is
// actually running. Escape and a touch pointerdown carry no activation, so
// their resume() leaves the ctx suspended and must not consume the listener.
import { UNLOCK_EV, armUnlock } from "../src/app/unlock.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") +
      name +
      (detail !== undefined ? " -> " + detail : ""),
  );
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// a target that records capture listeners and honours capture on removal
function mkTarget() {
  const L = [];
  return {
    L,
    addEventListener(ty, fn, o) { L.push({ ty, fn, cap: o === true || !!(o && o.capture) }); },
    removeEventListener(ty, fn, o) {
      const cap = o === true || !!(o && o.capture);
      const i = L.findIndex((x) => x.ty === ty && x.fn === fn && x.cap === cap);
      if (i >= 0) L.splice(i, 1);
    },
    fire(ty, ev) { L.filter((x) => x.ty === ty).forEach((x) => x.fn(ev || {})); },
  };
}
/* fake audio over a ctx state machine: `act(ty, ev)` says whether that
   gesture carries activation; resume() returns a promise that settles after
   the state flips (or never flips), like Chromium's. */
function mkAudio(o) {
  const a = {
    state: "suspended",
    calls: 0,
    unlock() {
      a.calls++;
      if (o && o.none) return false;
      if (a.state === "running") return true;
      if (o && o.reject) return Promise.reject(new Error("closed"));
      if (o && o.lie && !a._act) return Promise.resolve(); // settles, ctx stays suspended
      if (a._act) {
        return Promise.resolve().then(() => { a.state = "running"; });
      }
      return new Promise(() => {}); // Chromium leaves it pending, never settles
    },
    unlocked() { return a.state === "running"; },
  };
  return a;
}
// wire a gesture: set the activation bit for the handler, then fire
function gesture(t, a, ty, ev, act) {
  a._act = act;
  t.fire(ty, ev);
  a._act = false;
}

check("UNLOCK_EV is the five listened events",
  UNLOCK_EV.join() === "keydown,pointerdown,pointerup,touchend,click", UNLOCK_EV.join());
check("UNLOCK_EV is frozen", Object.isFrozen(UNLOCK_EV));

// ---- registration: five capture listeners ----
{
  const t = mkTarget(), a = mkAudio();
  armUnlock(t, a, () => {});
  check("arms one capture listener per event",
    t.L.length === 5 && t.L.every((x) => x.cap) && UNLOCK_EV.every((ty) => t.L.some((x) => x.ty === ty)),
    JSON.stringify(t.L.map((x) => x.ty + (x.cap ? "!" : ""))));
}

// ---- Escape: resume fails, nothing fires, every listener stays ----
{
  const t = mkTarget(), a = mkAudio();
  let n = 0;
  armUnlock(t, a, () => n++);
  gesture(t, a, "keydown", { code: "Escape", key: "Escape" }, false);
  await flush();
  check("Escape: no onReady", n === 0, n);
  check("Escape: ctx still suspended", a.state === "suspended");
  check("Escape: all five listeners stay armed", t.L.length === 5, t.L.length);
  check("Escape still calls unlock() inside the handler (WebKit rule)", a.calls === 1, a.calls);
  gesture(t, a, "keydown", { code: "KeyA", key: "a" }, true);
  await flush();
  check("then KeyA: exactly one onReady", n === 1, n);
  check("then KeyA: every listener removed", t.L.length === 0, t.L.length);
}

// ---- touch: pointerdown fails, pointerup succeeds ----
{
  const t = mkTarget(), a = mkAudio();
  let n = 0;
  armUnlock(t, a, () => n++);
  gesture(t, a, "pointerdown", { pointerType: "touch" }, false);
  await flush();
  check("touch pointerdown alone: no onReady, still armed", n === 0 && t.L.length === 5);
  gesture(t, a, "pointerup", { pointerType: "touch" }, true);
  gesture(t, a, "touchend", {}, true);
  gesture(t, a, "click", {}, true);
  await flush();
  check("touch pointerup: exactly one onReady", n === 1, n);
  check("touch pointerup: every listener removed", t.L.length === 0, t.L.length);
}

// ---- long-press: the hold's pointerdown fails; the release still unlocks ----
{
  const t = mkTarget(), a = mkAudio();
  let n = 0;
  armUnlock(t, a, () => n++);
  gesture(t, a, "pointerdown", { pointerType: "touch" }, false);
  await new Promise((r) => setTimeout(r, 30)); // the hold
  check("long-press: nothing while held", n === 0 && t.L.length === 5);
  gesture(t, a, "pointerup", { pointerType: "touch" }, true);
  await flush();
  check("long-press: release gives one onReady", n === 1 && a.state === "running", n + "/" + a.state);
}

// ---- already running: finish synchronously inside the handler ----
{
  const t = mkTarget(), a = mkAudio();
  a.state = "running";
  let n = 0;
  armUnlock(t, a, () => n++);
  t.fire("keydown", { code: "KeyA" });
  check("running ctx: onReady synchronously in the handler", n === 1 && t.L.length === 0, n);
  t.fire("keydown", { code: "KeyB" });
  t.fire("pointerup", {});
  check("onReady never fires twice", n === 1 && a.calls === 1, n + "/" + a.calls);
}

// ---- no WebAudio: unlock() false, or audio null / lacking unlock ----
for (const [label, audio] of [
  ["unlock() false", mkAudio({ none: true })],
  ["audio null", null],
  ["audio without unlock", { play() {} }],
]) {
  const t = mkTarget();
  let n = 0;
  armUnlock(t, audio, () => n++);
  t.fire("keydown", { code: "Escape", key: "Escape" });
  check("no WebAudio (" + label + "): Escape does not finish", n === 0 && t.L.length === 5);
  t.fire("pointerdown", {});
  check("no WebAudio (" + label + "): first other gesture finishes once", n === 1 && t.L.length === 0, n);
  t.fire("keydown", { code: "KeyA" });
  check("no WebAudio (" + label + "): never twice", n === 1);
}

// ---- rejected resume (closed ctx): finish rather than strand the title ----
{
  const t = mkTarget(), a = mkAudio({ reject: true });
  let n = 0;
  armUnlock(t, a, () => n++);
  t.fire("pointerdown", {});
  await flush();
  check("rejected resume(): one onReady", n === 1 && t.L.length === 0, n);
  t.fire("pointerup", {});
  await flush();
  check("rejected resume(): never twice", n === 1, n);
}

// ---- a resume() that settles while the ctx stays suspended keeps it armed ----
{
  const t = mkTarget(), a = mkAudio({ lie: true });
  let n = 0;
  armUnlock(t, a, () => n++);
  gesture(t, a, "keydown", { code: "Escape", key: "Escape" }, false);
  gesture(t, a, "pointerdown", { pointerType: "touch" }, false);
  await flush();
  check("settled resume(), ctx suspended: no onReady, all five armed", n === 0 && t.L.length === 5, n + "/" + t.L.length);
  gesture(t, a, "keydown", { code: "KeyA", key: "a" }, true);
  await flush();
  check("settled resume(): an activating press gives one onReady", n === 1 && t.L.length === 0, n + "/" + t.L.length);
}

// ---- hatch: a ctx that never runs finishes on the second counted press ----
{
  const t = mkTarget(), a = mkAudio();
  let n = 0;
  armUnlock(t, a, () => n++);
  for (let i = 0; i < 6; i++) {
    t.fire("keydown", { code: "Escape", key: "Escape" });
    t.fire("pointerdown", {});
    t.fire("touchstart", {});
  }
  t.fire("keydown", { code: "KeyA", repeat: true });
  t.fire("keydown", { code: "KeyA", repeat: true });
  await wait(300);
  check("hatch: Escapes, pointerdowns, touchstarts and auto-repeat never trip it", n === 0 && t.L.length === 5, n);
  t.fire("keydown", { code: "KeyA" });
  await wait(300);
  check("hatch: one counted press is not enough", n === 0 && t.L.length === 5, n);
  t.fire("pointerup", {});
  check("hatch: never synchronous inside the second press", n === 0, n);
  await wait(300);
  check("hatch: the second counted press calls onReady once", n === 1, n);
  check("hatch: the ctx is honestly still suspended", a.unlocked() === false);
  check("hatch: every listener stays armed while the ctx is not running", t.L.length === 5, t.L.length);
  const c0 = a.calls;
  t.fire("keydown", { code: "KeyB" });
  await wait(300);
  check("hatch: never twice", n === 1, n);
  check("hatch: a later gesture still calls unlock()", a.calls === c0 + 1, a.calls - c0);
  gesture(t, a, "keydown", { code: "KeyC", key: "c" }, true);
  await flush();
  check("hatch: a later activating gesture runs the ctx, then disarms",
    a.unlocked() && t.L.length === 0, a.state + "/" + t.L.length);
  check("hatch: onReady still exactly once", n === 1, n);
}
{
  const t = mkTarget(), a = mkAudio();
  let n = 0;
  armUnlock(t, a, () => n++);
  t.fire("keydown", { code: "KeyA" });
  t.fire("keydown", { code: "KeyB" });
  await wait(300);
  check("hatch: two non-Escape keydowns trip it", n === 1, n);
}
// ---- hatch counting: modifier / lock keydowns carry no activation ----
for (const key of ["Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph", "NumLock", "ScrollLock", "Fn"]) {
  const t = mkTarget(), a = mkAudio();
  let n = 0;
  armUnlock(t, a, () => n++);
  gesture(t, a, "keydown", { code: key + "Left", key }, false);
  gesture(t, a, "keydown", { code: key + "Left", key }, false);
  await wait(300);
  check("hatch: two " + key + " keydowns never trip it", n === 0 && t.L.length === 5, n + "/" + t.L.length);
}
{
  const t = mkTarget(), a = mkAudio();
  let n = 0, at = null;
  armUnlock(t, a, () => { n++; at = a.unlocked(); });
  gesture(t, a, "keydown", { code: "ShiftLeft", key: "Shift" }, false);
  gesture(t, a, "keydown", { code: "KeyA", key: "A" }, true);
  await wait(300);
  check("Shift+A (capital letter): one onReady with the ctx running", n === 1 && at === true, n + "/" + at);
}
{
  const t = mkTarget(), a = mkAudio();
  let n = 0, at = null;
  armUnlock(t, a, () => { n++; at = a.unlocked(); });
  gesture(t, a, "keydown", { code: "KeyA", key: "a" }, true);
  gesture(t, a, "keydown", { code: "KeyB", key: "b" }, true);
  await wait(300);
  check("two activating presses inside resume latency: one onReady with the ctx running",
    n === 1 && at === true, n + "/" + at);
}

// ---- disarm: removes every listener, no onReady ----
{
  const t = mkTarget(), a = mkAudio();
  let n = 0;
  const off = armUnlock(t, a, () => n++);
  off();
  check("disarm removes every listener", t.L.length === 0, t.L.length);
  check("disarm fires no onReady", n === 0);
}

// ---- a target with no removeEventListener (the P1 pin's fake window) ----
{
  const L = {};
  const t = { addEventListener: (ty, fn) => { (L[ty] = L[ty] || []).push(fn); } };
  const a = mkAudio();
  a.state = "running";
  let n = 0;
  armUnlock(t, a, () => n++);
  L.keydown.forEach((f) => f({ code: "F15" }));
  L.pointerdown.forEach((f) => f({}));
  L.keydown.forEach((f) => f({ code: "F16" }));
  check("no removeEventListener: tolerated, handler inert after finish", n === 1, n);
}

console.log("\n  UNLOCK RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
