// src/app/audiopower.js (graphics spec §4.3): hidden / pagehide suspend the
// AudioContext, visible + SOUND on resumes only our own suspend, a refused
// resume retries on the next gesture, and nothing here arms the unlock or
// fires its onReady / the jingle / the show.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mountAudioPower, WAKE_EV } from "../src/app/audiopower.js";
import { createAudio } from "../src/audio.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const flush = () => new Promise((r) => setTimeout(r, 0));
function mkTarget() {
  const L = [];
  return {
    L,
    addEventListener(ty, fn, o) { L.push({ ty, fn, cap: o === true }); },
    removeEventListener(ty, fn, o) {
      const i = L.findIndex((x) => x.ty === ty && x.fn === fn && x.cap === (o === true));
      if (i >= 0) L.splice(i, 1);
    },
    fire(ty, ev) { L.filter((x) => x.ty === ty).forEach((x) => x.fn(ev || {})); },
  };
}
function mkDoc() {
  const d = mkTarget();
  d.hidden = false;
  d.visibilityState = "visible";
  d.show = (v) => { d.hidden = !v; d.visibilityState = v ? "visible" : "hidden"; d.fire("visibilitychange"); };
  return d;
}
function spy(o) {
  const log = [];
  const a = {
    log,
    slept: false,
    want: false,
    sleep() { log.push("sleep"); return true; },
    wake() { log.push("wake"); return true; },
    wantWake() { log.push("want"); return a.want; },
    play(n) { log.push("play:" + n); },
    unlock() { log.push("unlock"); return true; },
    unlocked() { return true; },
    toggle() { log.push("toggle"); return true; },
  };
  return Object.assign(a, o);
}

{
  const win = mkTarget(),
    doc = mkDoc(),
    a = spy();
  let on = true;
  const off = mountAudioPower(win, doc, a, () => on);
  check("listeners: visibilitychange on doc only", doc.L.length === 1 && doc.L[0].ty === "visibilitychange" && !doc.L[0].cap);
  check("listeners: pagehide + capture retries on win",
    win.L.map((x) => x.ty + (x.cap ? "!" : "")).join() === "pagehide," + WAKE_EV.map((t) => t + "!").join(),
    win.L.map((x) => x.ty).join());
  check("retry set is pointerup/touchend/click/keydown", WAKE_EV.join() === "pointerup,touchend,click,keydown");
  doc.show(false);
  check("hidden -> sleep", a.log.join() === "sleep", a.log.join());
  a.log.length = 0;
  doc.show(true);
  check("visible + SOUND on -> wake", a.log.join() === "wake", a.log.join());
  a.log.length = 0;
  on = false;
  doc.show(true);
  check("visible + SOUND off -> nothing", a.log.length === 0, a.log.join());
  on = true;
  win.fire("pagehide");
  check("pagehide -> sleep", a.log.join() === "sleep", a.log.join());
  a.log.length = 0;
  for (const ty of WAKE_EV) win.fire(ty, { code: "KeyX" });
  check("gestures while !wantWake: only the probe, never wake", a.log.every((x) => x === "want") && a.log.length === 4, a.log.join());
  a.log.length = 0;
  a.want = true;
  win.fire("pointerup", {});
  check("pointerup while wantWake -> wake", a.log.join() === "want,wake", a.log.join());
  a.log.length = 0;
  on = false;
  win.fire("click", {});
  check("retry respects SOUND off", !a.log.includes("wake"), a.log.join());
  on = true;
  doc.show(false);
  doc.show(true);
  for (const ty of WAKE_EV) win.fire(ty, {});
  check("never unlock / play / toggle (no onReady, no jingle, no show)",
    !a.log.some((x) => x === "unlock" || x === "toggle" || x.startsWith("play:")), a.log.join());
  off();
  check("disposer removes every listener", win.L.length === 0 && doc.L.length === 0);
  a.log.length = 0;
  doc.show(false);
  win.fire("pointerup", {});
  check("after dispose nothing fires", a.log.length === 0);
}
// total: null audio / partial audio / null doc / listener-less win
{
  let threw = false;
  try {
    const win = mkTarget(),
      doc = mkDoc();
    mountAudioPower(win, doc, null, () => true);
    doc.show(false); doc.show(true); win.fire("pagehide"); for (const ty of WAKE_EV) win.fire(ty, {});
    const bare = { play() { throw new Error("played"); }, unlock() { throw new Error("unlocked"); } };
    mountAudioPower(win, doc, bare, () => true);
    doc.show(false); doc.show(true); win.fire("pagehide"); for (const ty of WAKE_EV) win.fire(ty, {});
    mountAudioPower(null, null, bare, () => true)();
    mountAudioPower({}, { hidden: false }, bare)();
    mountAudioPower(win, null, spy(), undefined);
  } catch (e) {
    threw = e.message;
  }
  check("total over null audio, no sleep/wake/wantWake, null doc, bare win, no isOn", threw === false, threw);
}
// integration with the real createAudio and a ctx that can suspend
{
  const ac = {
    currentTime: 0, state: "running", sampleRate: 44100, destination: {}, sus: 0, res: 0, refuse: false, osc: 0,
    suspend() { ac.sus++; ac.state = "suspended"; return Promise.resolve(); },
    resume() { ac.res++; if (!ac.refuse) ac.state = "running"; return Promise.resolve(); },
    createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {} }; },
    createOscillator() { ac.osc++; return { frequency: { value: 0, setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; },
  };
  const audio = createAudio({ ctx: ac });
  const win = mkTarget(),
    doc = mkDoc();
  let snd = true;
  mountAudioPower(win, doc, audio, () => snd);
  audio.unlock();
  doc.show(false);
  check("int hidden: real ctx suspended once", ac.sus === 1 && ac.state === "suspended");
  ac.refuse = true;
  doc.show(true);
  await flush();
  check("int visible but resume refused: still suspended, wantWake", ac.res === 1 && ac.state === "suspended" && audio.wantWake());
  ac.refuse = false;
  win.fire("keydown", { code: "Escape" });
  win.fire("pointerup", {});
  await flush();
  check("int next gesture retries and resumes", ac.state === "running" && !audio.wantWake(), ac.res);
  const r0 = ac.res;
  win.fire("pointerup", {});
  check("int running: gestures stop resuming", ac.res === r0);
  win.fire("pagehide");
  check("int pagehide suspends", ac.sus === 2 && ac.state === "suspended");
  doc.show(true);
  await flush();
  check("int visible after pagehide resumes", ac.state === "running");
  snd = false;
  audio.toggle();
  check("int SOUND off suspends", ac.sus === 3 && ac.state === "suspended");
  doc.show(false);
  doc.show(true);
  win.fire("pointerup", {});
  check("int SOUND off: hide/show/gesture never resume", ac.state === "suspended", ac.res);
  /* capture keydown runs before main's toggle: on the unmute press the
     retry sees wantWake false (muted), then toggle() wakes */
  const r1 = ac.res;
  win.fire("keydown", { code: "KeyM" });
  check("int unmute press: the capture retry stays out (muted at capture time)", ac.res === r1);
  snd = true;
  audio.toggle();
  check("int unmute: toggle wakes", ac.state === "running" && ac.res === r1 + 1);
}
// a ctx that was never unlocked: hidden/visible never touch it
{
  const ac = { state: "suspended", currentTime: 0, destination: {}, n: 0, suspend() { ac.n++; }, resume() { ac.n++; } };
  const audio = createAudio({ ctx: ac });
  const win = mkTarget(),
    doc = mkDoc();
  mountAudioPower(win, doc, audio, () => true);
  doc.show(false); doc.show(true); win.fire("pagehide"); for (const ty of WAKE_EV) win.fire(ty, {});
  check("never-running ctx: no suspend, no resume from audiopower", ac.n === 0, ac.n);
}
{
  const src = readFileSync(join(ROOT, "src/app/audiopower.js"), "utf8");
  check("audiopower never imports or arms the unlock", !/unlock/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")));
  check("audiopower has no timers", !/setTimeout|setInterval/.test(src));
  const shell = readFileSync(join(ROOT, "src/pwa/shell.js"), "utf8");
  check("audiopower is in the app-shell precache", shell.includes('"src/app/audiopower.js"'));
}

console.log("\n  AUDIOPOWER RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
