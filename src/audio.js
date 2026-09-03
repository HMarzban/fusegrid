// Audio layer — WebAudio oscillator SFX + chiptune tracks. Graceful: no-op if
// unavailable. createAudio() returns { play(name), toggle(), unlock(), duck(on),
// pump(), unlocked(), setTrack(id), cue(screen,level), track() } plus the pure
// frozen MUSIC_PATTERN / MUSIC_PATTERN_B / MUSIC_SECTIONS / MUSIC_TRACKS /
// musicCue / BOOM_DEFAULT / BOOM_TINTS / boomOf exports. Default track is
// menu (AABB). GAME/ATTRACT follow biome. Boom tints live in ./audio/boom.js.
//
// MUSIC ENGINE (spec §3): oscillator-only; graph per note is
// osc→noteGain→musicGain→destination while SFX layers stay direct-to-destination
// (osc/noise→filter?→gain→dest) so ducking never touches them. Scheduling is frame-driven lookahead on the
// WebAudio clock ONLY — main calls pump() once per RAF; there is deliberately
// NO setInterval/setTimeout/Date anywhere in note scheduling.

import { boomOf } from "./audio/boom.js";
import {
  MUSIC_PATTERN,
  MUSIC_PATTERN_B,
  MUSIC_SECTIONS,
  MUSIC_TRACKS,
  musicCue,
} from "./audio/tracks.js";
export { BOOM_DEFAULT, BOOM_TINTS, boomOf } from "./audio/boom.js";
export {
  MUSIC_PATTERN,
  MUSIC_PATTERN_B,
  MUSIC_SECTIONS,
  MUSIC_TRACKS,
  musicCue,
};

const MUS_BASE = 0.5,
  MUS_DUCK = 0.16,
  LOOKAHEAD = 0.12,
  MUS_FLOOR = 0.0001,
  MUS_PAN = Object.freeze({ bass: -0.32, lead: 0.32, hat: 0.1, pad: -0.06 });

export function createAudio() {
  let ctx = null,
    muted = false,
    ok = true;
  let musicGain = null,
    nextT = 0,
    stepN = 0,
    ducked = false;
  let curId = "menu",
    wantId = "menu";
  let nbuf = null;
  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = AC ? new AC() : null;
      } catch (e) {
        ok = false;
      }
    }
    return ctx && ok;
  }
  function beep(freq, dur, type, vol) {
    voice(type || "square", freq, freq, dur, vol || 0.12);
  }
  function noiseBuf() {
    if (nbuf) return nbuf;
    if (!ctx || !ctx.createBuffer) return null;
    const rate = ctx.sampleRate || 44100,
      n = (rate * 0.4) | 0;
    nbuf = ctx.createBuffer(1, n, rate);
    const d = nbuf.getChannelData(0);
    let s = 0xc0ffee;
    for (let i = 0; i < n; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      d[i] = ((s >>> 8) & 0xffff) / 32768 - 1;
    }
    return nbuf;
  }
  function filt(c, spec, t, dur) {
    if (!spec || !c.createBiquadFilter) return null;
    const f = c.createBiquadFilter();
    f.type = spec.t || "lowpass";
    f.frequency.setValueAtTime(spec.f0, t);
    if (spec.f1) f.frequency.exponentialRampToValueAtTime(spec.f1, t + dur);
    if (spec.q) f.Q.value = spec.q;
    return f;
  }
  function voice(type, f0, f1, dur, vol, spec, when) {
    if (muted || !ensure()) return;
    const c = ctx;
    try {
      if (c.state === "suspended") c.resume();
      const t = c.currentTime + (when || 0);
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = type || "square";
      const a = Math.max(1, f0),
        b = Math.max(1, f1 == null ? f0 : f1);
      if (o.frequency.setValueAtTime) o.frequency.setValueAtTime(a, t);
      else o.frequency.value = a;
      if (b !== a && o.frequency.exponentialRampToValueAtTime)
        o.frequency.exponentialRampToValueAtTime(b, t + dur);
      const fl = filt(c, spec, t, dur);
      if (fl) {
        o.connect(fl);
        fl.connect(g);
      } else o.connect(g);
      g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.03);
    } catch (e) {}
  }
  function noise(dur, vol, spec, when) {
    if (muted || !ensure()) return;
    const c = ctx,
      buf = noiseBuf();
    if (!buf || !c.createBufferSource) return;
    try {
      if (c.state === "suspended") c.resume();
      const t = c.currentTime + (when || 0);
      const s = c.createBufferSource(),
        g = c.createGain();
      s.buffer = buf;
      const fl = filt(c, spec, t, dur);
      if (fl) {
        s.connect(fl);
        fl.connect(g);
      } else s.connect(g);
      g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.start(t);
      s.stop(t + dur + 0.02);
    } catch (e) {}
  }
  /* ---- music engine (spec §3/§4) ---- */
  function rampMusicGain(v, dur) {
    try {
      const g = musicGain.gain,
        t = ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(MUS_FLOOR, g.value), t);
      g.exponentialRampToValueAtTime(v, t + dur);
    } catch (e) {}
  }
  function note(n, t) {
    try {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = n.t;
      o.frequency.value = n.f;
      o.connect(g);
      let dest = musicGain;
      const pv = n.p;
      if (pv != null && ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = pv;
        pan.connect(musicGain);
        dest = pan;
      }
      g.connect(dest);
      g.gain.setValueAtTime(n.v, t);
      g.gain.exponentialRampToValueAtTime(MUS_FLOOR, t + n.d);
      o.start(t);
      o.stop(t + n.d + 0.03);
    } catch (e) {}
  }
  function emitStep(P, s, t) {
    for (const k of ["bass", "lead", "hat", "pad"]) {
      const a = P[k];
      if (!a) continue;
      const pan = MUS_PAN[k];
      for (const n of a)
        if (n.s === s) note({ ...n, p: n.p != null ? n.p : pan }, t);
    }
  }
  function patOf(n) {
    const tr = MUSIC_TRACKS[curId] || MUSIC_TRACKS.menu;
    const len = tr.A.LEN;
    const tag = tr.sections[Math.floor(n / len) % tr.sections.length];
    return tag === "B" && tr.B ? tr.B : tr.A;
  }
  function applyTrack() {
    if (wantId === curId) return;
    curId = wantId;
    stepN = 0;
    if (ctx) nextT = ctx.currentTime + 0.05;
  }
  function unlock() {
    if (!ensure()) return false;
    try {
      if (ctx.state === "suspended") ctx.resume();
      if (!musicGain) {
        musicGain = ctx.createGain();
        musicGain.gain.value = muted ? MUS_FLOOR : MUS_BASE;
        musicGain.connect(ctx.destination);
      }
      nextT = ctx.currentTime + 0.05;
      return true;
    } catch (e) {
      return false;
    }
  }
  function unlocked() {
    return !!ctx && !!musicGain;
  }
  function duck(on) {
    on = !!on;
    if (!musicGain || on === ducked) return;
    ducked = on;
    rampMusicGain(on ? MUS_DUCK : MUS_BASE, on ? 0.35 : 0.6);
  }
  function pump() {
    applyTrack();
    if (!ctx || !musicGain || muted) return;
    try {
      /* catch-up clamp: RAF pauses on hidden tabs while ctx.currentTime keeps
         running; without this, resume schedules every missed step at past
         timestamps as one burst glitch */
      if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
      const horizon = ctx.currentTime + LOOKAHEAD;
      while (nextT <= horizon) {
        const P = patOf(stepN);
        emitStep(P, stepN % P.LEN, nextT);
        nextT += P.STEP;
        stepN++;
      }
    } catch (e) {}
  }
  return {
    play(name) {
      const ice = curId === "ice",
        fact = curId === "factory";
      switch (name) {
        case "bomb":
          voice("square", 185, 110, 0.055, 0.09, { t: "highpass", f0: 120 });
          voice("sine", 98, 72, 0.14, 0.07);
          noise(0.028, 0.035, { t: "bandpass", f0: 1400, q: 1.8 });
          break;
        case "boom": {
          const B = boomOf(curId);
          noise(B.crack.dur, B.crack.vol, {
            t: B.crack.t,
            f0: B.crack.f0,
            f1: B.crack.f1,
            q: B.crack.q,
          });
          voice("sine", B.kick.f0, B.kick.f1, B.kick.dur, B.kick.vol);
          voice("sawtooth", B.body.f0, B.body.f1, B.body.dur, B.body.vol, {
            t: "lowpass",
            f0: B.body.lp0,
            f1: B.body.lp1,
          });
          voice("square", B.snap.f0, B.snap.f1, B.snap.dur, B.snap.vol, {
            t: "highpass",
            f0: B.snap.hp,
          });
          noise(B.tail.dur, B.tail.vol, {
            t: "lowpass",
            f0: B.tail.f0,
            f1: B.tail.f1,
          });
          break;
        }
        case "power":
          voice("square", 659.3, 659.3, 0.1, 0.1, { t: "highpass", f0: 280 });
          voice("sine", 329.6, 329.6, 0.12, 0.05);
          voice("square", 880, 880, 0.12, 0.11, { t: "highpass", f0: 280 }, 0.09);
          voice("triangle", 1760, 1320, 0.09, 0.04, { t: "highpass", f0: 900 }, 0.09);
          break;
        case "kill":
          voice("triangle", 196, 392, 0.14, 0.12);
          voice("sine", 784, 1175, 0.1, 0.06, { t: "highpass", f0: 600 });
          noise(0.045, 0.05, { t: "highpass", f0: 2800 });
          voice("square", 523, 523, 0.04, 0.04, { t: "highpass", f0: 400 }, 0.02);
          break;
        case "hurt":
          voice("sawtooth", 185, 92.5, 0.28, 0.14, { t: "lowpass", f0: 900, f1: 240 });
          voice("square", 155, 78, 0.22, 0.08, { t: "lowpass", f0: 500 });
          noise(0.1, 0.07, { t: "bandpass", f0: 520, q: 1.1 });
          voice("triangle", 311, 196, 0.08, 0.05);
          break;
        case "brick":
          noise(0.048, fact ? 0.09 : 0.08, {
            t: "bandpass",
            f0: ice ? 1600 : 1150,
            q: 2.4,
          });
          voice("square", 240, 88, 0.042, 0.06, { t: "highpass", f0: ice ? 900 : 160 });
          voice("triangle", 1880, 620, 0.032, 0.045, { t: "highpass", f0: 700 });
          break;
        case "kick":
          voice("sine", 70, 48, 0.16, 0.12);
          voice("triangle", 148, 96, 0.11, 0.08, { t: "lowpass", f0: 600 });
          noise(0.07, 0.05, { t: "bandpass", f0: 700, q: 0.9 });
          voice("sawtooth", 210, 140, 0.06, 0.04, { t: "highpass", f0: 200 });
          break;
        case "throw":
          noise(0.11, 0.07, { t: "highpass", f0: 900, f1: 2200 });
          voice("sawtooth", 420, 760, 0.1, 0.07, { t: "highpass", f0: 350 });
          voice("triangle", 640, 480, 0.08, 0.04);
          break;
        case "remote":
          voice("square", 1880, 1240, 0.028, 0.055, { t: "highpass", f0: 900 });
          voice("triangle", 2510, 2510, 0.018, 0.03, { t: "highpass", f0: 1400 });
          break;
        case "reveal":
          voice("triangle", 740, 1180, 0.11, 0.06, { t: "highpass", f0: 520 });
          voice("sine", 1480, 1760, 0.08, 0.035, { t: "highpass", f0: 1100 });
          noise(0.035, 0.025, { t: "highpass", f0: 2400 });
          break;
        case "win":
          [523, 659, 784, 1046].forEach((f, i) => {
            voice("square", f, f, 0.18, 0.11, { t: "highpass", f0: 220 }, i * 0.11);
            voice("triangle", f * 2, f * 2, 0.16, 0.045, { t: "highpass", f0: 800 }, i * 0.11);
          });
          voice("sine", 261.6, 261.6, 0.55, 0.05, { t: "lowpass", f0: 400 }, 0.33);
          break;
        case "lose":
          [349, 262, 196].forEach((f, i) => {
            voice("sawtooth", f, f * 0.78, 0.28, 0.12, { t: "lowpass", f0: 700, f1: 280 }, i * 0.15);
            voice("sine", f / 2, (f / 2) * 0.85, 0.36, 0.07, null, i * 0.15);
          });
          noise(0.22, 0.04, { t: "lowpass", f0: 400 }, 0.3);
          break;
        case "uiJingle":
          if (!muted) {
            [392, 523, 659, 784].forEach((f, i) =>
              setTimeout(() => {
                voice("square", f, f, 0.16, 0.09, { t: "highpass", f0: 420 });
                voice("sine", f / 2, f / 2, 0.16, 0.035, { t: "highpass", f0: 200 });
              }, i * 120),
            );
            setTimeout(() => {
              voice("triangle", 1046, 1046, 0.3, 0.1, { t: "highpass", f0: 420 });
              voice("sine", 523, 523, 0.3, 0.035, { t: "highpass", f0: 200 });
              voice("triangle", 2093, 1568, 0.22, 0.03, { t: "highpass", f0: 1200 });
            }, 480);
          }
          break;
        case "uiMove":
          voice("square", 520, 520, 0.045, 0.055, { t: "highpass", f0: 400 });
          voice("sine", 1040, 1040, 0.028, 0.025, { t: "highpass", f0: 800 });
          break;
        case "uiSel":
          voice("square", 880, 880, 0.08, 0.09, { t: "highpass", f0: 350 });
          voice("sine", 440, 440, 0.09, 0.03);
          setTimeout(() => {
            voice("square", 1318, 1318, 0.1, 0.08, { t: "highpass", f0: 350 });
            voice("triangle", 2636, 1976, 0.08, 0.03, { t: "highpass", f0: 1000 });
          }, 70);
          break;
        case "uiBack":
          voice("triangle", 300, 196, 0.09, 0.07, { t: "highpass", f0: 180 });
          voice("sine", 150, 110, 0.1, 0.03);
          break;
        case "uiTog":
          voice("square", 700, 700, 0.055, 0.07, { t: "highpass", f0: 300 });
          voice("triangle", 1400, 1050, 0.05, 0.035, { t: "highpass", f0: 700 });
          break;
        case "uiDenied":
          voice("square", 174, 174, 0.1, 0.065, { t: "highpass", f0: 120 });
          voice("sawtooth", 185, 155, 0.09, 0.04, { t: "lowpass", f0: 600 });
          noise(0.03, 0.025, { t: "bandpass", f0: 900, q: 2 });
          break;
      }
    },
    toggle() {
      muted = !muted;
      /* duck-aware restore (F2): unmute while ducked must return to MUS_DUCK,
         else main's frame-polled duck(true) idempotently no-ops until the
         screen flips and music blasts at full volume inside GAME */
      if (musicGain)
        rampMusicGain(
          muted ? MUS_FLOOR : ducked ? MUS_DUCK : MUS_BASE,
          muted ? 0.01 : 0.6,
        );
      return !muted;
    },
    unlock,
    unlocked,
    duck,
    pump,
    setTrack(id) {
      if (id && MUSIC_TRACKS[id]) wantId = id;
      applyTrack();
      return curId;
    },
    cue: musicCue,
    track() {
      return curId;
    },
  };
}
