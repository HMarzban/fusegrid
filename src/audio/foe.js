/* Per-foe kill tints. Same layered recipe as item.js (osc + harmonic +
   optional noise), distinct pitch/filter per FOES.t. Direct-to-destination;
   never musicGain. Names are foe_<t> so they do not collide with plant /
   kick / throw / remote or item_* grab SFX. */

export const FOE_CUE = Object.freeze({
  walker: Object.freeze({
    f0: 196, f1: 110, osc: "sine", dur: 0.11, hp: 90,
    harm: 98, noise: 500, q: 0.8,
  }),
  stationary: Object.freeze({
    f0: 110, f1: 82, osc: "square", dur: 0.14, hp: 70,
    harm: 55, noise: 280, q: 1.6,
  }),
  fast: Object.freeze({
    f0: 880, f1: 1320, osc: "sawtooth", dur: 0.07, hp: 520,
    harm: 1760, noise: 3600, q: 1.4,
  }),
  chaser: Object.freeze({
    f0: 494, f1: 740, osc: "triangle", dur: 0.12, hp: 220,
    harm: 247, noise: 1400, q: 1.1,
  }),
  boomerang: Object.freeze({
    f0: 740, f1: 420, osc: "sine", dur: 0.13, hp: 380,
    harm: 1110, noise: 2200, q: 2.0,
  }),
  rocket: Object.freeze({
    f0: 82, f1: 55, osc: "sawtooth", dur: 0.16, hp: 60,
    harm: 41, noise: 180, q: 0.7,
  }),
});

export function foeOf(t) {
  return FOE_CUE[t] || FOE_CUE.walker;
}
