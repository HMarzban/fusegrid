import { biomeOf } from "../core/config.js";
import { SCREEN } from "../app/menuapp.js";

/* Pure pattern data: 8 bars @100BPM eighths = 64 steps (A-A-F-G x2), lead
   octave-up bars 5-8, offbeat hats. Sparse [step,freqHz,durSteps] lists over
   absolute steps 0..63 mapped to {s,f,d,t,v}; pump looks each up by stepIdx. */
export const MUSIC_PATTERN = (() => {
  const S = 0.15,
    L = 64,
    bass = [],
    lead = [],
    hat = [];
  const roots = [
    [55, 82.4],
    [55, 82.4],
    [43.65, 65.4],
    [49, 73.42],
    [55, 82.4],
    [55, 82.4],
    [43.65, 65.4],
    [49, 73.42],
  ];
  roots.forEach(([r, q], b) => {
    const o = b * 8;
    bass.push([o, r, 2], [o + 2, r, 2], [o + 4, q, 2], [o + 6, r, 2]);
  });
  const ph = [
    [
      [0, 220],
      [2, 261.6],
      [3, 293.7],
      [4, 329.6],
      [6, 293.7],
    ],
    [
      [0, 261.6],
      [1, 392],
      [3, 329.6],
    ],
    [
      [0, 246.9],
      [2, 293.7],
      [3, 349.2],
      [5, 329.6],
    ],
    [
      [0, 220],
      [2, 196],
      [4, 246.9],
    ],
  ];
  ph.forEach((bar, i) =>
    bar.forEach(([s, f]) => {
      lead.push([i * 8 + s, f, 2]);
      lead.push([32 + i * 8 + s, f * 2, 2]);
    }),
  );
  for (let i = 1; i < L; i += 2) hat.push([i, 4800, 1]);
  const E = (a, t, v) => a.map(([s, f, d]) => ({ s, f, d: d * S, t, v }));
  return Object.freeze({
    STEP: S,
    LEN: L,
    bass: Object.freeze(E(bass, "square", 0.1)),
    lead: Object.freeze(E(lead, "square", 0.07)),
    hat: Object.freeze(E(hat, "triangle", 0.02)),
  });
})();

/* B SECTION (design-dept long-session fatigue fix): D–C–Bb–G descent under a
   higher lead contour. Identical rhythm skeleton, instrument mix and step
   count as A so the two interleave as one seamless loop: pump cycles
   A→A→B→B (MUSIC_SECTIONS) before wrapping, instead of A forever. */
export const MUSIC_PATTERN_B = (() => {
  const S = 0.15,
    L = 64,
    bass = [],
    lead = [],
    hat = [];
  const roots = [
    [73.42, 110],
    [65.4, 98],
    [58.27, 87.31],
    [49, 73.42],
    [73.42, 110],
    [65.4, 98],
    [58.27, 87.31],
    [49, 73.42],
  ];
  roots.forEach(([r, q], b) => {
    const o = b * 8;
    bass.push([o, r, 2], [o + 2, r, 2], [o + 4, q, 2], [o + 6, r, 2]);
  });
  const ph = [
    [
      [0, 293.7],
      [2, 349.2],
      [4, 440],
      [6, 349.2],
    ],
    [
      [0, 329.6],
      [2, 392],
      [3, 523.2],
      [5, 392],
    ],
    [
      [0, 349.2],
      [2, 466.2],
      [3, 440],
      [5, 349.2],
    ],
    [
      [0, 293.7],
      [2, 246.9],
      [4, 196],
    ],
  ];
  ph.forEach((bar, i) =>
    bar.forEach(([s, f]) => {
      lead.push([i * 8 + s, f, 2]);
      lead.push([32 + i * 8 + s, f * 2, 2]);
    }),
  );
  for (let i = 1; i < L; i += 2) hat.push([i, 4800, 1]);
  const E = (a, t, v) => a.map(([s, f, d]) => ({ s, f, d: d * S, t, v }));
  return Object.freeze({
    STEP: S,
    LEN: L,
    bass: Object.freeze(E(bass, "square", 0.1)),
    lead: Object.freeze(E(lead, "square", 0.07)),
    hat: Object.freeze(E(hat, "triangle", 0.02)),
  });
})();
/* Macro-loop section order: two passes of A then two of B per full cycle. */
export const MUSIC_SECTIONS = Object.freeze(["A", "A", "B", "B"]);
function mkPat(S, L, bass, lead, hat, mix, pad) {
  const E = (a, t, v) =>
    Object.freeze(
      a.map(([s, f, d]) => Object.freeze({ s, f, d: d * S, t, v })),
    );
  const o = {
    STEP: S,
    LEN: L,
    bass: E(bass, mix[0], mix[1]),
    lead: E(lead, mix[2], mix[3]),
    hat: E(hat, mix[4], mix[5]),
  };
  if (pad && pad.length)
    o.pad = E(pad, mix[6] || "triangle", mix[7] == null ? 0.03 : mix[7]);
  return Object.freeze(o);
}
function pulse(roots) {
  const b = [];
  roots.forEach(([r, q], i) => {
    const o = i * 8;
    b.push([o, r, 2], [o + 2, r, 2], [o + 4, q, 2], [o + 6, r, 2]);
  });
  return b;
}
function oct(ph) {
  const L = [];
  ph.forEach((bar, i) =>
    bar.forEach(([s, f, d]) => {
      const du = d == null ? 2 : d;
      L.push([i * 8 + s, f, du], [32 + i * 8 + s, f * 2, du]);
    }),
  );
  return L;
}
function hats(L, f, step) {
  const h = [];
  for (let i = step > 1 ? 1 : 0; i < L; i += step) h.push([i, f, 1]);
  return h;
}
function transp(P, r) {
  const T = (a) =>
    Object.freeze(
      a.map((n) =>
        Object.freeze({ s: n.s, f: n.f * r, d: n.d, t: n.t, v: n.v }),
      ),
    );
  return Object.freeze({
    STEP: P.STEP,
    LEN: P.LEN,
    bass: T(P.bass),
    lead: T(P.lead),
    hat: P.hat,
    pad: P.pad ? T(P.pad) : undefined,
  });
}
function tr(A, B, secs) {
  return Object.freeze({ A, B, sections: secs || MUSIC_SECTIONS });
}
const INTRO_A = mkPat(
  0.2,
  32,
  [
    [0, 55, 4],
    [8, 49, 4],
    [16, 43.65, 4],
    [24, 55, 4],
  ],
  [
    [4, 220, 3],
    [12, 246.9, 3],
    [20, 196, 4],
    [28, 329.6, 2],
  ],
  [
    [7, 3200, 1],
    [15, 3200, 1],
    [23, 3200, 1],
    [31, 3200, 1],
  ],
  ["triangle", 0.08, "triangle", 0.05, "triangle", 0.015, "triangle", 0.025],
  [
    [0, 110, 8],
    [16, 98, 8],
  ],
);
const JUNGLE_A = mkPat(
  0.14,
  64,
  pulse([
    [82.4, 123.47],
    [82.4, 123.47],
    [73.42, 110],
    [65.41, 98],
  ]),
  oct([
    [
      [0, 164.8],
      [2, 196],
      [4, 220],
      [6, 246.9],
    ],
    [
      [0, 196],
      [3, 329.6],
      [5, 246.9],
    ],
    [
      [0, 146.8],
      [2, 164.8],
      [4, 196],
      [6, 164.8],
    ],
    [
      [0, 220],
      [2, 196],
      [4, 164.8],
    ],
  ]),
  hats(64, 3600, 2),
  ["square", 0.1, "triangle", 0.08, "triangle", 0.018],
);
const ICE_A = mkPat(
  0.18,
  64,
  pulse([
    [73.42, 110],
    [65.41, 98],
    [58.27, 87.31],
    [73.42, 146.8],
  ]),
  oct([
    [
      [0, 587.3],
      [3, 698.5],
      [6, 880],
    ],
    [
      [0, 659.3],
      [2, 784],
      [5, 659.3],
    ],
    [
      [0, 523.3],
      [4, 698.5],
    ],
    [
      [0, 587.3],
      [3, 440],
      [6, 523.3],
    ],
  ]),
  hats(64, 6200, 4),
  ["triangle", 0.08, "triangle", 0.06, "triangle", 0.015, "triangle", 0.028],
  [
    [0, 293.7, 8],
    [16, 261.6, 8],
    [32, 246.9, 8],
    [48, 293.7, 8],
  ],
);
const FACTORY_A = mkPat(
  0.12,
  64,
  pulse([
    [65.41, 98],
    [65.41, 98],
    [77.78, 116.54],
    [98, 130.81],
  ]),
  oct([
    [
      [0, 261.6, 1],
      [1, 261.6, 1],
      [4, 311.1, 1],
      [5, 261.6, 1],
    ],
    [
      [0, 196],
      [2, 261.6],
      [4, 311.1],
      [6, 349.2],
    ],
    [
      [0, 233.1],
      [3, 196],
      [6, 261.6],
    ],
    [
      [0, 196],
      [2, 174.6],
      [4, 196],
    ],
  ]),
  hats(64, 2400, 1),
  ["square", 0.11, "square", 0.08, "triangle", 0.022],
);
const WATER_A = mkPat(
  0.16,
  64,
  pulse([
    [61.74, 92.5],
    [55, 82.4],
    [49, 73.42],
    [61.74, 92.5],
  ]),
  oct([
    [
      [0, 220, 3],
      [3, 246.9, 3],
      [6, 196, 2],
    ],
    [
      [0, 164.8, 4],
      [4, 220, 3],
    ],
    [
      [0, 174.6, 3],
      [3, 196, 2],
      [5, 220, 3],
    ],
    [
      [0, 246.9, 4],
      [4, 196, 3],
    ],
  ]),
  [
    [2, 4000, 1],
    [10, 4000, 1],
    [18, 4000, 1],
    [26, 4000, 1],
    [34, 4000, 1],
    [42, 4000, 1],
    [50, 4000, 1],
    [58, 4000, 1],
  ],
  ["triangle", 0.09, "triangle", 0.07, "triangle", 0.016, "triangle", 0.03],
  [
    [0, 123.47, 16],
    [32, 110, 16],
  ],
);
const ARENA_A = mkPat(
  0.11,
  64,
  pulse([
    [87.31, 130.81],
    [87.31, 130.81],
    [103.83, 155.56],
    [77.78, 116.54],
  ]),
  oct([
    [
      [0, 349.2, 1],
      [1, 392, 1],
      [2, 349.2, 1],
      [4, 466.2],
      [6, 392],
    ],
    [
      [0, 311.1],
      [2, 349.2],
      [3, 415.3],
      [5, 349.2],
    ],
    [
      [0, 277.2],
      [2, 311.1],
      [4, 349.2],
      [6, 415.3],
    ],
    [
      [0, 349.2],
      [2, 277.2],
      [4, 233.1],
    ],
  ]),
  hats(64, 5200, 2),
  ["square", 0.12, "square", 0.09, "triangle", 0.028],
);
const SAND_A = mkPat(
  0.17,
  64,
  pulse([
    [69.3, 103.83],
    [69.3, 103.83],
    [77.78, 116.54],
    [61.74, 92.5],
  ]),
  oct([
    [
      [0, 207.7],
      [2, 246.9],
      [4, 277.2],
      [6, 311.1],
    ],
    [
      [0, 233.1],
      [3, 349.2],
      [5, 277.2],
    ],
    [
      [0, 185],
      [2, 207.7],
      [4, 246.9],
      [6, 207.7],
    ],
    [
      [0, 277.2],
      [2, 246.9],
      [4, 207.7],
    ],
  ]),
  hats(64, 2800, 2),
  ["square", 0.09, "triangle", 0.07, "triangle", 0.016],
);
const VOID_A = mkPat(
  0.19,
  64,
  pulse([
    [49, 73.42],
    [46.25, 69.3],
    [43.65, 65.41],
    [49, 82.4],
  ]),
  oct([
    [
      [0, 196, 3],
      [4, 146.8, 4],
    ],
    [
      [0, 174.6, 4],
      [5, 220, 3],
    ],
    [
      [0, 164.8, 3],
      [3, 196, 3],
    ],
    [
      [0, 146.8, 4],
      [4, 174.6, 3],
    ],
  ]),
  hats(64, 1800, 4),
  ["triangle", 0.07, "triangle", 0.05, "triangle", 0.012, "triangle", 0.022],
  [
    [0, 98, 16],
    [32, 87.31, 16],
  ],
);
const CROWN_A = mkPat(
  0.13,
  64,
  pulse([
    [98, 146.8],
    [98, 146.8],
    [110, 164.8],
    [87.31, 130.81],
  ]),
  oct([
    [
      [0, 392, 1],
      [1, 440, 1],
      [2, 392, 1],
      [4, 523.3],
      [6, 440],
    ],
    [
      [0, 349.2],
      [2, 392],
      [3, 466.2],
      [5, 392],
    ],
    [
      [0, 329.6],
      [2, 349.2],
      [4, 392],
      [6, 466.2],
    ],
    [
      [0, 392],
      [2, 329.6],
      [4, 261.6],
    ],
  ]),
  hats(64, 4800, 2),
  ["square", 0.11, "square", 0.08, "triangle", 0.024],
);
export const MUSIC_TRACKS = Object.freeze({
  intro: tr(INTRO_A, null, Object.freeze(["A"])),
  menu: tr(MUSIC_PATTERN, MUSIC_PATTERN_B, MUSIC_SECTIONS),
  jungle: tr(JUNGLE_A, transp(JUNGLE_A, 1.125)),
  ice: tr(ICE_A, transp(ICE_A, 1.122462)),
  factory: tr(FACTORY_A, transp(FACTORY_A, 1.189207)),
  water: tr(WATER_A, transp(WATER_A, 1.122462)),
  arena: tr(ARENA_A, transp(ARENA_A, 1.059463)),
  sand: tr(SAND_A, transp(SAND_A, 1.122462)),
  void: tr(VOID_A, transp(VOID_A, 1.059463)),
  crown: tr(CROWN_A, transp(CROWN_A, 1.125)),
});
export function musicCue(screen, level) {
  if ((screen | 0) === SCREEN.INTRO) return "intro";
  if (screen === SCREEN.GAME || screen === SCREEN.ATTRACT)
    return biomeOf(level).name.toLowerCase();
  return "menu";
}
