// src/audio.js primeDevice (real-GPU check 2026-10-10): createAudio builds and
// closes ONE throwaway AudioContext at boot so the first gesture's ctx skips the
// ~80 ms device bring-up; the game's own ctx is still made only by unlock().
import { createAudio, primeDevice } from "../src/audio.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const made = [];
class FakeAC {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = {};
    this.closed = 0;
    made.push(this);
  }
  close() { this.closed++; this.state = "closed"; return Promise.resolve(); }
  resume() { return Promise.resolve(); }
  createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {} }; }
}

const saved = globalThis.window;
delete globalThis.window;
check("headless: primeDevice is a no-op false", primeDevice() === false);
createAudio();
check("headless: createAudio still constructs", true);

globalThis.window = { AudioContext: FakeAC };
const a = createAudio();
check("boot: exactly one throwaway ctx", made.length === 1, made.length);
check("boot: the throwaway is closed", made[0] && made[0].closed === 1);
check("boot: the game ctx is not created before a gesture", a.unlocked() === false);
const r = a.unlock();
check("gesture: unlock builds the game's own ctx (a second one)", made.length === 2, made.length);
check("gesture: the game ctx is not the closed probe", made[1] !== made[0] && made[1].closed === 0);
check("gesture: running ctx -> unlock true, unlocked()", r === true && a.unlocked() === true);

made.length = 0;
createAudio({ ctx: new FakeAC() });
check("injected ctx: no probe", made.length === 1, made.length);

globalThis.window = { AudioContext: class { constructor() { throw new Error("blocked"); } } };
check("throwing ctor: primeDevice false, no throw", primeDevice() === false);
globalThis.window = { AudioContext: class { close() { return Promise.reject(new Error("x")); } } };
check("rejecting close: swallowed", primeDevice() === true);
await new Promise((r) => setTimeout(r, 0));

if (saved === undefined) delete globalThis.window;
else globalThis.window = saved;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
