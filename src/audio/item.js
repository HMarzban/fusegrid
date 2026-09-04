/* Per-pickup grab tints. Same layered recipe (osc + harmonic + optional
   noise/pip), distinct pitch/filter per POWER.t. Direct-to-destination;
   never musicGain. Names are item_<t> so they do not collide with plant /
   kick / throw / remote action SFX. */

export const ITEM_CUE = Object.freeze({
  fire: Object.freeze({
    f0: 392, f1: 784, osc: "sawtooth", dur: 0.1, hp: 240,
    harm: 196, noise: 2200, q: 1.2,
  }),
  bomb: Object.freeze({
    f0: 196, f1: 330, osc: "square", dur: 0.12, hp: 100,
    harm: 98, noise: 800, q: 0.8,
  }),
  speed: Object.freeze({
    f0: 880, f1: 1480, osc: "sawtooth", dur: 0.08, hp: 500,
    harm: 440, noise: 3200, q: 1.4,
  }),
  heart: Object.freeze({
    f0: 523, f1: 523, osc: "sine", dur: 0.12, hp: 180,
    harm: 392, pip: 784, when: 0.07, pdur: 0.09,
  }),
  shield: Object.freeze({
    f0: 740, f1: 520, osc: "triangle", dur: 0.1, hp: 400,
    harm: 1480, noise: 1800, q: 2.2,
  }),
  kick: Object.freeze({
    f0: 165, f1: 98, osc: "sine", dur: 0.11, hp: 80,
    harm: 220, noise: 600, q: 0.9,
  }),
  throw: Object.freeze({
    f0: 420, f1: 760, osc: "sawtooth", dur: 0.1, hp: 350,
    harm: 640, noise: 2000, q: 1.1,
  }),
  pass: Object.freeze({
    f0: 622, f1: 830, osc: "triangle", dur: 0.12, hp: 300,
    harm: 933, noise: 1400, q: 1.6,
  }),
  line: Object.freeze({
    f0: 1480, f1: 990, osc: "square", dur: 0.06, hp: 800,
    harm: 2220, noise: 4000, q: 1.8,
  }),
  power: Object.freeze({
    f0: 659, f1: 659, osc: "square", dur: 0.1, hp: 280,
    harm: 988, pip: 1318, when: 0.05, pdur: 0.08,
  }),
  pierce: Object.freeze({
    f0: 988, f1: 440, osc: "sawtooth", dur: 0.09, hp: 600,
    harm: 1976, noise: 5000, q: 1.3,
  }),
  remote: Object.freeze({
    f0: 1880, f1: 1240, osc: "square", dur: 0.04, hp: 900,
    pip: 2510, when: 0.06, pdur: 0.03, pvol: 0.03,
  }),
});

export function itemOf(t) {
  return ITEM_CUE[t] || ITEM_CUE.fire;
}

export function sfxOf(ev) {
  if (ev && ev.t === "power" && ev.kind) return "item_" + ev.kind;
  if (ev && ev.t === "kill" && ev.type) return "foe_" + ev.type;
  return ev && ev.t;
}
