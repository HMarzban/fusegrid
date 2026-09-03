export const BOOM_DEFAULT = Object.freeze({
  crack: Object.freeze({
    dur: 0.12,
    vol: 0.16,
    t: "lowpass",
    f0: 4200,
    f1: 160,
    q: 0.7,
  }),
  kick: Object.freeze({ f0: 55, f1: 28, dur: 0.48, vol: 0.22 }),
  body: Object.freeze({
    f0: 88,
    f1: 42,
    dur: 0.3,
    vol: 0.14,
    lp0: 700,
    lp1: 120,
  }),
  snap: Object.freeze({ f0: 310, f1: 95, dur: 0.085, vol: 0.1, hp: 180 }),
  tail: Object.freeze({ dur: 0.2, vol: 0.05, f0: 900, f1: 220 }),
});

function tint(over) {
  const o = {};
  for (const k of Object.keys(BOOM_DEFAULT))
    o[k] = Object.freeze(Object.assign({}, BOOM_DEFAULT[k], over[k]));
  return Object.freeze(o);
}

export const BOOM_TINTS = Object.freeze({
  ice: tint({ crack: { f0: 3200 } }),
  water: tint({ kick: { f0: 48, dur: 0.56 }, tail: { dur: 0.28 } }),
  arena: tint({ crack: { vol: 0.18 }, kick: { f0: 62, vol: 0.25 } }),
  sand: tint({
    crack: { vol: 0.175, f0: 5000, f1: 240, q: 1.35 },
    kick: { f0: 69, f1: 33, dur: 0.42, vol: 0.19 },
    body: { f0: 102, f1: 48, dur: 0.24, vol: 0.1, lp0: 820, lp1: 160 },
    snap: { f0: 380, f1: 120, dur: 0.068, vol: 0.085, hp: 260 },
    tail: { dur: 0.15, vol: 0.04, f0: 1500, f1: 400 },
  }),
  void: tint({
    crack: { vol: 0.12, f0: 1600, f1: 80, q: 0.45 },
    kick: { f0: 40, f1: 22, dur: 0.64, vol: 0.2 },
    body: { f0: 64, f1: 30, dur: 0.4, vol: 0.11, lp0: 380, lp1: 70 },
    snap: { f0: 190, f1: 60, dur: 0.11, vol: 0.055, hp: 80 },
    tail: { dur: 0.36, vol: 0.06, f0: 420, f1: 100 },
  }),
  crown: tint({
    crack: { vol: 0.17, f0: 5800, f1: 260, q: 1.15 },
    kick: { f0: 82, f1: 36, dur: 0.38, vol: 0.24 },
    body: { f0: 118, f1: 56, dur: 0.22, vol: 0.13, lp0: 1200, lp1: 220 },
    snap: { f0: 540, f1: 180, dur: 0.065, vol: 0.14, hp: 360 },
    tail: { dur: 0.12, vol: 0.038, f0: 2000, f1: 560 },
  }),
});

export function boomOf(id) {
  return BOOM_TINTS[id] || BOOM_DEFAULT;
}
