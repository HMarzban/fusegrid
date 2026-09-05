import { createAudio, MUSIC_TRACKS } from "../../src/audio.js";
import { encodeWav } from "./wav.js";

export const IDS = Object.freeze([
  "intro",
  "menu",
  "jungle",
  "ice",
  "factory",
  "water",
  "arena",
  "sand",
  "void",
  "crown",
]);
export const lengthOf = (id) => {
  const t = MUSIC_TRACKS[id];
  return Math.max(20, t.A.LEN * t.sections.length * t.A.STEP + 2);
};
/* unlock() calls ctx.resume() whenever ctx.state is "suspended", which is
   exactly an OfflineAudioContext's state before startRendering(); where that
   call throws, unlock()'s catch would swallow it and skip building musicGain,
   and bounceTrack would return 0. The shim reports "running" and forwards every
   factory to the real context — including createStereoPanner, because emitStep
   sets p from MUS_PAN on EVERY music note. Shipped code stays at two additions. */
function shim(ctx) {
  return {
    state: "running",
    resume() {},
    get currentTime() {
      return ctx.currentTime;
    },
    get sampleRate() {
      return ctx.sampleRate;
    },
    get destination() {
      return ctx.destination;
    },
    createGain: () => ctx.createGain(),
    createOscillator: () => ctx.createOscillator(),
    createStereoPanner: () => ctx.createStereoPanner(),
    createBiquadFilter: () => ctx.createBiquadFilter(),
    createBuffer: (a, b, c) => ctx.createBuffer(a, b, c),
    createBufferSource: () => ctx.createBufferSource(),
  };
}
export async function renderTrack(id, rate) {
  const secs = lengthOf(id),
    sr = rate || 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(secs * sr), sr);
  const a = createAudio({ ctx: shim(ctx) });
  a.unlock();
  const steps = a.bounceTrack(id, secs);
  const wav = encodeWav(await ctx.startRendering());
  return { id, secs, steps, wav };
}
export async function post(sink, id, wav) {
  const r = await fetch(sink + "/" + id + ".wav", { method: "POST", body: wav });
  if (!r.ok) throw new Error(id + ": sink " + r.status);
}
