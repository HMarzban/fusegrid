import { biomeOf } from "../core/config.js";
import { SCREEN } from "../app/menuapp.js";

/* MENU — the score's identity theme. D Dorian, STEP 0.134 (112 BPM
   sixteenths), 8 bars of 2/4 = 64 steps. The bass walks Dm-G-Am-Dm on the
   3+3+2 tresillo (steps 0, 3 and 6 of each bar) rather than pumping four even
   hits; the lead answers it in sixteenths off those accents instead of
   doubling them; the hat ticks the offbeats only. Bars 4 and 8 drop the lead
   and two thirds of the bass, so the loop breathes twice a pass, and bars 5-8
   are a varied restatement rather than an octave copy. Bar 1 states the motif
   (1-3-5-6-5) plain. Sparse [step,freqHz,durSteps,vel?] lists over absolute
   steps 0..63 mapped to {s,f,d,t,v}; vel defaults to the channel's mix value
   when omitted. pump looks each up by stepIdx. */
export const MUSIC_PATTERN = (() => {
  const S = 0.134,
    L = 64,
    bass = [],
    hat = [];
  /* [root, fifth]; a zero fifth marks a breath bar — downbeat only, the {3,6}
     hits dropped, which is what makes bars 4 and 8 read as rest not mistake */
  const bars = [
    [73.42, 110.0],
    [49, 73.42],
    [55, 82.41],
    [73.42, 0],
    [73.42, 110.0],
    [49, 73.42],
    [55, 82.41],
    [73.42, 0],
  ];
  bars.forEach(([r, q], b) => {
    const o = b * 8;
    if (!q) return bass.push([o, r, 3]);
    bass.push([o, r, 2], [o + 3, r, 2], [o + 6, q, 2]);
  });
  const lead = [
    [0, 293.66, 1],
    [1, 349.23, 1],
    [2, 440.0, 1],
    [3, 493.88, 3],
    [6, 440.0, 1],
    [9, 493.88, 1],
    [12, 440.0, 1],
    [13, 392.0, 1],
    [15, 329.63, 1],
    [16, 440.0, 1],
    [17, 523.25, 1],
    [20, 493.88, 1],
    [21, 440.0, 1],
    [32, 440.0, 1],
    [33, 587.33, 2],
    [36, 523.25, 1],
    [37, 493.88, 1],
    [40, 392.0, 1],
    [41, 440.0, 1],
    [44, 493.88, 1],
    [45, 523.25, 2],
    [48, 587.33, 1],
    [49, 523.25, 1],
    [52, 493.88, 2],
    [54, 440.0, 2],
  ];
  for (let b = 0; b * 8 < L; b++)
    hat.push([b * 8 + 2, 4800, 1], [b * 8 + 6, 4800, 1]);
  const E = (a, t, v) =>
    a.map(([s, f, d, nv]) => ({ s, f, d: d * S, t, v: nv == null ? v : nv }));
  return Object.freeze({
    STEP: S,
    LEN: L,
    bass: Object.freeze(E(bass, "square", 0.1)),
    lead: Object.freeze(E(lead, "square", 0.07)),
    hat: Object.freeze(E(hat, "triangle", 0.02)),
  });
})();

/* B SECTION: same tresillo skeleton, same instrument mix and the same note
   count per channel as A, so the two interleave as one seamless loop — pump
   cycles A→A→B→B (MUSIC_SECTIONS) before wrapping. What changes is the
   destination: B tonicizes G major for eight bars and snaps back, which
   imports the one F# the parent white-key collection does not own (the bass
   arpeggiates D-F#-A in bars 2 and 6; the lead leans on F# into G in bars 4
   and 8). B breathes in different bars than A — bars 3 and 7 — because those
   leaning F#s live exactly where A's lead is silent. This is the template the
   other three hand-authored B sections follow. */
export const MUSIC_PATTERN_B = (() => {
  const S = 0.134,
    L = 64,
    bass = [],
    hat = [];
  /* per bar, the three tresillo pitches; a one-entry bar is a downbeat-only
     breath bar, matching A's skeleton hit for hit */
  const bars = [
    [49, 49, 73.42],
    [73.42, 92.5, 110.0],
    [65.41, 65.41, 98.0],
    [49],
  ];
  for (let b = 0; b * 8 < L; b++) {
    const o = b * 8,
      c = bars[b % 4];
    if (c.length === 1) bass.push([o, c[0], 3]);
    else bass.push([o, c[0], 2], [o + 3, c[1], 2], [o + 6, c[2], 2]);
  }
  const lead = [
    [0, 392.0, 1],
    [1, 493.88, 1],
    [2, 587.33, 1],
    [3, 659.26, 3],
    [6, 587.33, 1],
    [8, 587.33, 1],
    [9, 523.25, 1],
    [12, 493.88, 1],
    [13, 440.0, 1],
    [15, 392.0, 1],
    [26, 440.0, 1],
    [27, 493.88, 1],
    [29, 369.99, 2],
    [31, 392.0, 1],
    [32, 587.33, 1],
    [33, 659.26, 1],
    [36, 783.99, 2],
    [37, 659.26, 1],
    [40, 587.33, 1],
    [41, 523.25, 1],
    [44, 493.88, 1],
    [45, 392.0, 1],
    [59, 493.88, 1],
    [61, 369.99, 2],
    [63, 392.0, 1],
  ];
  for (let b = 0; b * 8 < L; b++)
    hat.push([b * 8 + 2, 4800, 1], [b * 8 + 6, 4800, 1]);
  const E = (a, t, v) =>
    a.map(([s, f, d, nv]) => ({ s, f, d: d * S, t, v: nv == null ? v : nv }));
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
      a.map(([s, f, d, nv]) =>
        Object.freeze({ s, f, d: d * S, t, v: nv == null ? v : nv }),
      ),
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
  roots.forEach(([r, q, v], i) => {
    const o = i * 8;
    b.push([o, r, 2, v], [o + 2, r, 2, v], [o + 4, q, 2, v], [o + 6, r, 2, v]);
  });
  return b;
}
function oct(ph) {
  const L = [];
  ph.forEach((bar, i) =>
    bar.forEach(([s, f, d, v]) => {
      const du = d == null ? 2 : d;
      L.push([i * 8 + s, f, du, v], [32 + i * 8 + s, f * 2, du, v]);
    }),
  );
  return L;
}
function hats(L, f, step, v) {
  const h = [];
  for (let i = step > 1 ? 1 : 0; i < L; i += step) h.push([i, f, 1, v]);
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
/* INTRO — held breath. D Dorian on D4, STEP 0.17 (88 BPM), 4 bars of 32 steps,
   sections ["A"] and no B. Bar 1 states the motif (1-3-5-6-5) alone, bar 2
   rests outright, bar 3 restates it an octave up, bar 4 holds the 6th — the
   note that names the mode — by itself. The sine pad drone joins at step 8 and
   the single A1 bass pedal at step 16 sits on the DOMINANT, so the bed never
   grounds the tonic. No hat: every later biome's reharmonization of the figure
   is then a discovery rather than a repeat. */
const INTRO_A = mkPat(
  0.17,
  32,
  [[16, 55, 16]],
  [
    [0, 293.66, 1],
    [1, 349.23, 1],
    [2, 440.0, 1],
    [3, 493.88, 3],
    [6, 440.0, 1],
    [16, 587.33, 1],
    [17, 698.46, 1],
    [18, 880.0, 1],
    [19, 987.77, 3],
    [22, 880.0, 1],
    [24, 493.88, 7],
  ],
  [],
  ["triangle", 0.08, "triangle", 0.05, "triangle", 0.015, "sine", 0.03],
  [[8, 146.83, 16]],
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
    [82.41, 98],
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
    [49, 92.5],
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
/* Straight eighths: one hit on every even step of bars 1-7, tacet through the
   silent last bar. ARENA authors this figure; CROWN's B quotes the step
   pattern verbatim as its victory lap past the room the player fought. */
const EVEN8 = Object.freeze(Array.from({ length: 28 }, (_, i) => i * 2));
/* ARENA — aggressive, combat-ready. A Aeolian on A, STEP 0.107 (140 BPM), all
   four voices dense. The motif head lands at step 15, one whole step BEFORE
   the bar-3 downbeat it belongs to, so the fanfare punches ahead of the grid
   without any sub-step timing the engine cannot express; the rest of the lead
   stabs the "and" of 2 and 4. Plain Aeolian, no colour tones — deliberately
   harder than the modal biomes around it. The whole band stops for bar 8: SFX
   render outside musicGain and always sit on top, so the music leaves the
   hole rather than fighting for it. */
const ARENA_A = mkPat(
  0.107,
  64,
  [
    [55, 82.41],
    [55, 82.41],
    [43.65, 65.41],
    [49, 73.42],
    [55, 82.41],
    [55, 82.41],
    [43.65, 65.41],
  ].flatMap(([r, q], b) => [
    [b * 8, r, 2],
    [b * 8 + 3, r, 2],
    [b * 8 + 6, q, 2],
  ]),
  [
    [0, 440.0, 1],
    [3, 523.25, 1],
    [5, 493.88, 1],
    [7, 440.0, 1],
    [8, 523.25, 1],
    [11, 587.33, 1],
    [13, 523.25, 1],
    [15, 440.0, 1],
    [16, 523.25, 1],
    [17, 659.26, 1],
    [18, 698.46, 3],
    [21, 659.26, 1],
    [23, 587.33, 1],
    [25, 587.33, 1],
    [27, 493.88, 1],
    [29, 440.0, 1],
    [31, 392.0, 1],
    [32, 440.0, 1],
    [33, 523.25, 1],
    [35, 659.26, 1],
    [37, 587.33, 1],
    [39, 523.25, 1],
    [41, 440.0, 1],
    [43, 698.46, 1],
    [45, 659.26, 1],
    [47, 587.33, 1],
    [48, 523.25, 2],
    [51, 493.88, 1],
    [53, 440.0, 1],
    [55, 392.0, 1],
  ],
  EVEN8.map((s) => [s, 5200, 1]),
  ["square", 0.12, "square", 0.09, "triangle", 0.028, "sawtooth", 0.03],
  [
    [0, 220.0, 6],
    [8, 220.0, 6],
    [16, 174.61, 6],
    [24, 196.0, 6],
    [32, 220.0, 6],
    [40, 220.0, 6],
    [48, 174.61, 6],
  ],
);
/* ARENA B — hand-authored, not transposed: a listener's ear clocks a
   pitch-shifted repeat as repetition, not new material. Same skeleton, same
   mix, same silent last bar; the destination is C major, the relative major,
   and the anticipated head restates the motif on C. */
const ARENA_B = mkPat(
  0.107,
  64,
  [
    [65.41, 98.0],
    [65.41, 98.0],
    [49, 73.42],
    [55, 82.41],
    [65.41, 98.0],
    [65.41, 98.0],
    [43.65, 65.41],
  ].flatMap(([r, q], b) => [
    [b * 8, r, 2],
    [b * 8 + 3, r, 2],
    [b * 8 + 6, q, 2],
  ]),
  [
    [0, 523.25, 1],
    [3, 659.26, 1],
    [5, 587.33, 1],
    [7, 523.25, 1],
    [8, 659.26, 1],
    [11, 698.46, 1],
    [13, 659.26, 1],
    [15, 523.25, 1],
    [16, 659.26, 1],
    [17, 783.99, 1],
    [18, 880.0, 3],
    [21, 783.99, 1],
    [23, 698.46, 1],
    [25, 698.46, 1],
    [27, 659.26, 1],
    [29, 587.33, 1],
    [31, 523.25, 1],
    [32, 523.25, 1],
    [33, 659.26, 1],
    [35, 783.99, 1],
    [37, 698.46, 1],
    [39, 659.26, 1],
    [41, 523.25, 1],
    [43, 880.0, 1],
    [45, 783.99, 1],
    [47, 698.46, 1],
    [48, 659.26, 2],
    [51, 587.33, 1],
    [53, 523.25, 1],
    [55, 493.88, 1],
  ],
  EVEN8.map((s) => [s, 5200, 1]),
  ["square", 0.12, "square", 0.09, "triangle", 0.028, "sawtooth", 0.03],
  [
    [0, 130.81, 6],
    [8, 130.81, 6],
    [16, 196.0, 6],
    [24, 220.0, 6],
    [32, 130.81, 6],
    [40, 130.81, 6],
    [48, 174.61, 6],
  ],
);
const SAND_A = mkPat(
  0.139,
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
/* VOID — dread, subtraction. B Locrian on B, STEP 0.234 (64 BPM), the one
   deliberate exception to the 104-140 band. TWO voices: a triangle pedal on B1
   at the lowest gain in the score, and the score's only sine lead. The lead
   plays FRAG-MID — degrees 3-5-6 on steps 1, 2, 3 of a bar — and nothing else,
   so both ends of the motif are gone: no tonic under the figure (the lead
   never sounds degree 1 at any octave) and no settle after it. The
   incompleteness is the horror; nothing dissonant was added to get it, and
   CROWN is what finally finishes the phrase. Empty hat, no pad key at all. */
const VOID_A = mkPat(
  0.234,
  64,
  [
    [0, 61.74, 32],
    [32, 61.74, 32],
  ],
  [
    [4, 392.0, 3],
    [9, 293.66, 1],
    [10, 349.23, 1],
    [11, 392.0, 3],
    [20, 349.23, 4],
    [33, 587.33, 1],
    [34, 698.46, 1],
    [35, 783.99, 3],
    [42, 523.25, 4],
    [49, 293.66, 1],
    [50, 349.23, 1],
    [51, 392.0, 3],
    [58, 261.63, 6],
  ],
  [],
  ["triangle", 0.04, "sine", 0.05, "triangle", 0.012],
);
/* VOID B — hand-authored (its own, still empty, hat array), same two voices.
   The pedal drops to the flat fifth and the fragment moves in register: the
   same dread from another angle, still with nothing resolved. */
const VOID_B = mkPat(
  0.234,
  64,
  [
    [0, 43.65, 32],
    [32, 43.65, 32],
  ],
  [
    [5, 349.23, 3],
    [17, 587.33, 1],
    [18, 698.46, 1],
    [19, 783.99, 3],
    [28, 440.0, 4],
    [41, 293.66, 1],
    [42, 349.23, 1],
    [43, 392.0, 3],
    [54, 329.63, 4],
    [61, 261.63, 3],
  ],
  [],
  ["triangle", 0.04, "sine", 0.05, "triangle", 0.012],
);
/* CROWN — finale gold. C Ionian on C, the only pure major in the game, earned
   by contrast with everything before it; STEP 0.113 (133 BPM). Bass on the
   dotted 0/3/6, lead a dotted fanfare, sawtooth pad doubling the lead one
   octave up for brass weight. Ionian is what the perfect fourth and the
   leading tone together name — the pair that separates it from Lydian's #4 and
   from every flat-seventh mode in the run. The whole band stops for bar 4:
   the finale takes a breath before it climbs. */
const CROWN_A = mkPat(
  0.113,
  64,
  [
    [0, 65.41, 3],
    [3, 65.41, 3],
    [6, 98.0, 2],
    [8, 49.0, 3],
    [11, 49.0, 3],
    [14, 73.42, 2],
    [16, 55.0, 3],
    [19, 55.0, 3],
    [22, 82.41, 2],
    [32, 65.41, 3],
    [35, 65.41, 3],
    [38, 98.0, 2],
    [40, 43.65, 3],
    [43, 43.65, 3],
    [46, 65.41, 2],
    [48, 49.0, 3],
    [51, 49.0, 3],
    [54, 73.42, 2],
    [56, 65.41, 3],
    [59, 65.41, 3],
    [62, 98.0, 2],
  ],
  [
    [0, 261.63, 1],
    [1, 329.63, 1],
    [2, 392.0, 1],
    [3, 440.0, 3],
    [6, 392.0, 1],
    [8, 523.25, 3],
    [11, 493.88, 1],
    [12, 440.0, 1],
    [13, 392.0, 1],
    [15, 329.63, 1],
    [16, 349.23, 3],
    [19, 392.0, 1],
    [20, 440.0, 1],
    [21, 493.88, 1],
    [23, 523.25, 1],
    [32, 523.25, 1],
    [33, 659.26, 1],
    [34, 783.99, 1],
    [35, 880.0, 3],
    [38, 783.99, 1],
    [40, 698.46, 3],
    [43, 659.26, 1],
    [44, 587.33, 1],
    [45, 523.25, 1],
    [47, 493.88, 1],
    [48, 523.25, 1],
    [49, 587.33, 1],
    [51, 659.26, 1],
    [52, 587.33, 1],
    [55, 523.25, 1],
    [56, 261.63, 3],
    [59, 329.63, 1],
    [60, 392.0, 1],
    [63, 523.25, 2],
  ],
  [2, 6, 10, 14, 18, 22, 34, 38, 42, 46, 50, 54, 58, 62].map((s) => [
    s,
    4800,
    1,
  ]),
  ["square", 0.11, "square", 0.08, "triangle", 0.024, "sawtooth", 0.03],
  [
    [0, 523.25, 3],
    [3, 880.0, 3],
    [6, 783.99, 2],
    [16, 698.46, 3],
    [20, 880.0, 1],
    [23, 1046.5, 1],
    [56, 523.25, 3],
    [59, 659.26, 1],
    [60, 783.99, 1],
    [63, 1046.5, 2],
  ],
);
/* CROWN B — the payoff. Its hat quotes ARENA A's step pattern verbatim, a
   victory lap past the room the player fought through; the quote is of the
   STEP pattern, not the wall clock, so at .113 against arena's .107 the same
   figure plays about 5% broader. Bar 1 states RESOLVED: the motif plus a sixth
   note, the tonic one octave above the head, supplying the note VOID refused
   to play. The progression then tours away — Am, F, G, Em, Dm — and leaves on
   the dominant, which is how it hands back to A. */
const CROWN_B = mkPat(
  0.113,
  64,
  [
    [65.41, 98.0],
    [55.0, 82.41],
    [43.65, 65.41],
    [49.0, 73.42],
    [41.2, 61.74],
    [55.0, 82.41],
    [73.42, 110.0],
    [49.0, 73.42],
  ].flatMap(([r, q], b) => [
    [b * 8, r, 3],
    [b * 8 + 3, r, 3],
    [b * 8 + 6, q, 2],
  ]),
  [
    [0, 261.63, 1],
    [1, 329.63, 1],
    [2, 392.0, 1],
    [3, 440.0, 3],
    [6, 392.0, 1],
    [7, 523.25, 2],
    [9, 440.0, 1],
    [11, 523.25, 1],
    [12, 493.88, 1],
    [15, 440.0, 1],
    [16, 349.23, 3],
    [19, 440.0, 1],
    [21, 523.25, 1],
    [23, 587.33, 1],
    [24, 587.33, 3],
    [27, 493.88, 1],
    [29, 440.0, 1],
    [31, 392.0, 1],
    [40, 329.63, 1],
    [41, 440.0, 1],
    [43, 523.25, 1],
    [45, 493.88, 1],
    [47, 440.0, 1],
    [48, 587.33, 3],
    [51, 523.25, 1],
    [53, 493.88, 1],
    [55, 440.0, 1],
    [56, 392.0, 3],
    [59, 493.88, 1],
    [61, 587.33, 1],
    [63, 523.25, 1],
  ],
  EVEN8.map((s) => [s, 4800, 1]),
  ["square", 0.11, "square", 0.08, "triangle", 0.024, "sawtooth", 0.03],
  [
    [0, 523.25, 3],
    [3, 880.0, 3],
    [6, 783.99, 1],
    [7, 1046.5, 2],
    [16, 698.46, 3],
    [19, 880.0, 1],
    [40, 659.26, 1],
    [41, 880.0, 1],
    [56, 783.99, 3],
    [59, 987.77, 1],
  ],
);
export const MUSIC_TRACKS = Object.freeze({
  intro: tr(INTRO_A, null, Object.freeze(["A"])),
  menu: tr(MUSIC_PATTERN, MUSIC_PATTERN_B, MUSIC_SECTIONS),
  jungle: tr(JUNGLE_A, transp(JUNGLE_A, 1.125)),
  ice: tr(ICE_A, transp(ICE_A, 1.122462)),
  factory: tr(FACTORY_A, transp(FACTORY_A, 1.189207)),
  water: tr(WATER_A, transp(WATER_A, 1.122462)),
  arena: tr(ARENA_A, ARENA_B),
  sand: tr(SAND_A, transp(SAND_A, 1.122462)),
  void: tr(VOID_A, VOID_B),
  crown: tr(CROWN_A, CROWN_B),
});
export function musicCue(screen, level) {
  if ((screen | 0) === SCREEN.INTRO) return "intro";
  if (screen === SCREEN.GAME || screen === SCREEN.ATTRACT)
    return biomeOf(level).name.toLowerCase();
  return "menu";
}
