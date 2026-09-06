import { biomeOf } from "../core/config.js";
import { SCREEN } from "../app/menuapp.js";

/* MENU — the score's identity theme. D Dorian, STEP 0.121 (124 BPM
   sixteenths), 8 bars of 2/4 = 64 steps. The bass still walks Dm-G-Am-Dm and
   the 3+3+2 tresillo still carries the accent, but it now rides a continuous
   eighth pulse: five hits a bar on steps 0, 2, 3, 4 and 6, with the root on the
   tresillo steps, the octave on 2 and 6 and the fifth on 4. The accent is spelt
   in PITCH rather than velocity, which is why no menu channel authors the [s,f,
   d,v] tuple. The hat doubles from offbeats-only to every even step. Bar 4 now
   lands on the tonic instead of breathing, every bar carries lead, and the
   motif (1-3-5-6-5, v2 rhythm: two-step flash, settle on 5, pickup on 6-7) is
   stated at bar 1 AND bar 5 so the hook returns inside one pass. Bars 5-8 stay
   a varied restatement rather than an octave copy. Exactly one step in the loop
   is unstruck — 63, the lift into the turnaround. Sparse [step,freqHz,durSteps,
   vel?] lists over absolute steps 0..63 mapped to {s,f,d,t,v}; vel defaults to
   the channel's mix value when omitted. pump looks each up by stepIdx. */
export const MUSIC_PATTERN = (() => {
  const S = 0.121,
    L = 64,
    bass = [],
    hat = [];
  /* [root, fifth]; the octave is derived, so one row says the whole bar */
  const bars = [
    [73.42, 110.0],
    [49, 73.42],
    [55, 82.41],
    [73.42, 110.0],
    [73.42, 110.0],
    [49, 73.42],
    [55, 82.41],
    [73.42, 110.0],
  ];
  bars.forEach(([r, q], b) => {
    const o = b * 8;
    bass.push(
      [o, r, 2],
      [o + 2, r * 2, 1],
      [o + 3, r, 2],
      [o + 4, q, 1],
      [o + 6, r * 2, 2],
    );
  });
  const lead = [
    [0, 293.66, 1],
    [1, 349.23, 1],
    [2, 440.0, 1],
    [3, 493.88, 2],
    [5, 440.0, 1],
    [6, 392.0, 1],
    [7, 349.23, 1],
    [8, 329.63, 1],
    [9, 293.66, 1],
    [11, 349.23, 1],
    [12, 440.0, 1],
    [13, 493.88, 1],
    [15, 587.33, 1],
    [16, 440.0, 1],
    [17, 523.25, 1],
    [18, 587.33, 1],
    [19, 659.26, 2],
    [21, 587.33, 1],
    [22, 523.25, 1],
    [23, 440.0, 1],
    [24, 493.88, 1],
    [25, 440.0, 1],
    [27, 392.0, 1],
    [28, 349.23, 1],
    [29, 329.63, 1],
    [31, 293.66, 1],
    [32, 587.33, 1],
    [33, 698.46, 1],
    [34, 880.0, 1],
    [35, 987.77, 2],
    [37, 880.0, 1],
    [38, 783.99, 1],
    [39, 698.46, 1],
    [40, 659.26, 1],
    [41, 587.33, 1],
    [43, 698.46, 1],
    [44, 880.0, 1],
    [45, 987.77, 1],
    [47, 880.0, 1],
    [48, 783.99, 1],
    [49, 880.0, 1],
    [50, 987.77, 1],
    [51, 1046.5, 2],
    [53, 987.77, 1],
    [54, 880.0, 1],
    [55, 783.99, 1],
    [56, 698.46, 1],
    [57, 659.26, 1],
    [59, 587.33, 1],
    [60, 523.25, 1],
    [61, 440.0, 2],
  ];
  for (let b = 0; b * 8 < L; b++)
    for (const o of [0, 2, 4, 6]) hat.push([b * 8 + o, 4800, 1]);
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

/* B SECTION: same five-hits-a-bar skeleton, same instrument mix and the same
   note count per channel as A, so the two interleave as one seamless loop —
   pump cycles A→A→B→B (MUSIC_SECTIONS) before wrapping. What changes is the
   destination: B tonicizes G major for eight bars and snaps back, which imports
   the one F# the parent white-key collection does not own. The lead is A's
   contour read through a scale MAP (D→G E→A F→B G→C A→D B→E C→F#), so it lands
   on the same steps with a genuinely different harmony rather than a pitch
   shift; the bass arpeggiates D-F#-A in bars 2, 6 and 8. Nothing breathes here
   either — B is as dense as A, one free step at 63. This is the template the
   other three hand-authored B sections follow. */
export const MUSIC_PATTERN_B = (() => {
  const S = 0.121,
    L = 64,
    bass = [],
    hat = [];
  /* per bar, the five pitches in step order 0,2,3,4,6 */
  const bars = [
    [49, 98.0, 49, 73.42, 98.0],
    [73.42, 92.5, 73.42, 110.0, 146.83],
    [65.41, 130.81, 65.41, 98.0, 130.81],
    [49, 98.0, 49, 73.42, 98.0],
    [49, 98.0, 49, 73.42, 98.0],
    [73.42, 92.5, 73.42, 110.0, 146.83],
    [82.41, 164.81, 82.41, 123.47, 164.81],
    [73.42, 92.5, 73.42, 110.0, 146.83],
  ];
  bars.forEach((c, b) => {
    const o = b * 8;
    bass.push(
      [o, c[0], 2],
      [o + 2, c[1], 1],
      [o + 3, c[2], 2],
      [o + 4, c[3], 1],
      [o + 6, c[4], 2],
    );
  });
  const MAP = {
    293.66: 392.0,
    329.63: 440.0,
    349.23: 493.88,
    392.0: 523.25,
    440.0: 587.33,
    493.88: 659.26,
    523.25: 369.99,
    587.33: 783.99,
    659.26: 880.0,
    698.46: 987.77,
    783.99: 1046.5,
    880.0: 1174.66,
    987.77: 1318.51,
    1046.5: 1479.98,
  };
  const lead = MUSIC_PATTERN.lead.map((n) => [
    n.s,
    MAP[n.f],
    Math.round(n.d / S),
  ]);
  for (let b = 0; b * 8 < L; b++)
    for (const o of [0, 2, 4, 6]) hat.push([b * 8 + o, 4800, 1]);
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
/* INTRO — the cabinet powering up. D Dorian on D4, STEP 0.125 (120 BPM), 4 bars
   of 32 steps, sections ["A"] and no B. The whole band is in at step 0: the
   bass bounces straight eighths, root against its own octave (D2 73.42 on the
   beats, D3 146.83 between them) and states the TONIC immediately rather than
   pedalling the dominant; bar 4 lifts the pair to A1/A2 as a turnaround. The
   lead states the motif (1-3-5-6-5, v2 rhythm: flash two steps, settle on 5,
   pickup on 6-7) in bar 1 and restates it an octave up in bar 3, with running
   answers in bars 2 and 4 — no bar is lead-free. A sixteenth hat ticks every
   odd step. Two sine drones, D3 then A2, sit under all of it. The one unstruck
   step in the loop is the last: a single-step lift back into the top, which is
   also what keeps the "no track fills every step" rule true here. */
const INTRO_A = mkPat(
  0.125,
  32,
  [[73.42, 146.83], [73.42, 146.83], [73.42, 146.83], [55.0, 110.0]].flatMap(
    ([r, o], b) => [
      [b * 8, r, 2],
      [b * 8 + 2, o, 2],
      [b * 8 + 4, r, 2],
      [b * 8 + 6, o, 2],
    ],
  ),
  [
    [0, 293.66, 1],
    [1, 349.23, 1],
    [2, 440.0, 1],
    [3, 493.88, 2],
    [5, 440.0, 1],
    [6, 392.0, 1],
    [7, 349.23, 1],
    [8, 440.0, 1],
    [9, 493.88, 1],
    [10, 587.33, 2],
    [12, 523.25, 1],
    [13, 493.88, 1],
    [14, 440.0, 1],
    [15, 392.0, 1],
    [16, 587.33, 1],
    [17, 698.46, 1],
    [18, 880.0, 1],
    [19, 987.77, 2],
    [21, 880.0, 1],
    [22, 783.99, 1],
    [23, 698.46, 1],
    [24, 659.26, 1],
    [25, 587.33, 1],
    [26, 523.25, 1],
    [27, 493.88, 2],
    [29, 440.0, 1],
    [30, 392.0, 2],
  ],
  [0, 1, 2, 3]
    .flatMap((b) => [1, 3, 5, 7].map((o) => b * 8 + o))
    .filter((s) => s !== 31)
    .map((s) => [s, 4800, 1]),
  ["triangle", 0.08, "triangle", 0.05, "triangle", 0.015, "sine", 0.03],
  [
    [0, 146.83, 16],
    [16, 110.0, 16],
  ],
);
/* JUNGLE — overgrown, humid, alive. D Dorian on D, STEP 0.117 (128 BPM), and
   its root is deliberately the menu's D2: room 1 is home, in the menu's own
   key. Call and response as INTERLOCK, not alternation: the bass asks in 3+3+2
   on steps 0/3/6 of all eight bars — it never sits a bar out — and the hat
   echoes each hit one step late on 1/4/7 like a drip off a leaf. The two
   together strike six of every eight steps, leaving single-step pockets at 2
   and 5, and the lead answers INTO those pockets and across them: sharing a
   step with the bass is now allowed, which is what lets the ostinato keep its
   step-3 hit in every bar. The motif (1-3-5-6-5, v2 rhythm) is stated at bar 1
   and again an octave up at bar 5, with the short answer figure looping in
   between, so the earworm arrives four times a pass instead of once. Two long
   sine drones — A2 then D3 — are the canopy over all of it. Step 61 is the
   loop's one unstruck step. */
const JUNGLE_A = mkPat(
  0.117,
  64,
  [
    [73.42, 73.42, 110.0],
    [73.42, 73.42, 110.0],
    [98.0, 98.0, 73.42],
    [110.0, 110.0, 82.41],
    [73.42, 73.42, 110.0],
    [87.31, 87.31, 130.81],
    [98.0, 98.0, 146.83],
    [73.42, 110.0, 82.41],
  ].flatMap((c, b) => [
    [b * 8, c[0], 2],
    [b * 8 + 3, c[1], 2],
    [b * 8 + 6, c[2], 2],
  ]),
  [
    [0, 293.66, 1],
    [1, 349.23, 1],
    [2, 440.0, 1],
    [3, 493.88, 2],
    [5, 440.0, 1],
    [6, 392.0, 1],
    [7, 440.0, 1],
    [9, 349.23, 1],
    [10, 440.0, 1],
    [11, 493.88, 2],
    [13, 440.0, 1],
    [14, 392.0, 1],
    [16, 392.0, 1],
    [17, 440.0, 1],
    [18, 493.88, 1],
    [19, 523.25, 2],
    [21, 493.88, 1],
    [22, 440.0, 1],
    [24, 440.0, 1],
    [26, 392.0, 1],
    [27, 349.23, 2],
    [29, 329.63, 1],
    [30, 293.66, 1],
    [32, 587.33, 1],
    [33, 698.46, 1],
    [34, 880.0, 1],
    [35, 987.77, 2],
    [37, 880.0, 1],
    [38, 783.99, 1],
    [39, 698.46, 1],
    [41, 698.46, 1],
    [42, 880.0, 1],
    [43, 987.77, 2],
    [45, 880.0, 1],
    [46, 783.99, 1],
    [48, 783.99, 1],
    [49, 880.0, 1],
    [50, 987.77, 1],
    [51, 1046.5, 2],
    [53, 987.77, 1],
    [54, 880.0, 1],
    [56, 880.0, 1],
    [58, 783.99, 1],
    [59, 698.46, 2],
    [62, 587.33, 1],
  ],
  [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) =>
    [1, 4, 7].map((o) => [b * 8 + o, 3600, 1]),
  ),
  ["square", 0.1, "triangle", 0.08, "triangle", 0.018, "sine", 0.03],
  [
    [0, 110.0, 32],
    [32, 146.83, 32],
  ],
);
/* ICE — brittle, glittering. F Lydian on F, STEP 0.129 (116 BPM). The cold is
   the mode and the register, not an absent low end: the bass is a full
   root-fifth alternation on EVERY off-eighth — steps 1, 3, 5 and 7 of every bar
   — and it is the only bass in the score that lives entirely off the beat. The
   6200 Hz hat answers it with a bell ON the beat, steps 0 and 4, so the two
   voices cover the bar between them and the pulse never gaps. The lead states
   the motif at normal speed (v2 rhythm) at bars 1 and 5, two octaves above the
   bass and never below C5, and it stays off step 6 of every bar: that recurring
   single-step pocket is the glitter, and it is one step, not one bar. The sine
   pad holds Lydian chord tones including the raised fourth (B3), the glassy note
   that names the mode. Nothing here reaches for a perfect fourth above F — that
   Bb would collide with CROWN's Ionian-pair pin, and Lydian does not want it. */
const ICE_A = mkPat(
  0.129,
  64,
  [
    [87.31, 130.81],
    [87.31, 130.81],
    [98.0, 146.83],
    [110.0, 164.81],
    [87.31, 130.81],
    [87.31, 130.81],
    [98.0, 146.83],
    [123.47, 164.81],
  ].flatMap(([r, q], b) => [
    [b * 8 + 1, r, 1],
    [b * 8 + 3, q, 1],
    [b * 8 + 5, r, 1],
    [b * 8 + 7, q, 1],
  ]),
  [
    [0, 698.46, 1],
    [1, 880.0, 1],
    [2, 1046.5, 1],
    [3, 1174.66, 2],
    [5, 1046.5, 1],
    [8, 987.77, 1],
    [9, 1046.5, 1],
    [10, 880.0, 1],
    [11, 783.99, 2],
    [13, 698.46, 1],
    [16, 880.0, 1],
    [17, 987.77, 1],
    [18, 1046.5, 1],
    [19, 1174.66, 2],
    [21, 1046.5, 1],
    [24, 987.77, 1],
    [25, 880.0, 1],
    [26, 783.99, 1],
    [27, 698.46, 2],
    [29, 659.26, 1],
    [32, 698.46, 1],
    [33, 880.0, 1],
    [34, 1046.5, 1],
    [35, 1174.66, 2],
    [37, 1046.5, 1],
    [40, 1174.66, 1],
    [41, 1046.5, 1],
    [42, 987.77, 1],
    [43, 880.0, 2],
    [45, 783.99, 1],
    [48, 698.46, 1],
    [49, 783.99, 1],
    [50, 880.0, 1],
    [51, 987.77, 2],
    [53, 1046.5, 1],
    [56, 1046.5, 1],
    [57, 987.77, 1],
    [58, 880.0, 1],
    [59, 783.99, 2],
    [61, 698.46, 1],
  ],
  [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) =>
    [0, 4].map((o) => [b * 8 + o, 6200, 1]),
  ),
  ["triangle", 0.08, "triangle", 0.06, "triangle", 0.015, "sine", 0.03],
  [
    [0, 349.23, 12],
    [16, 246.94, 12],
    [32, 261.63, 12],
    [48, 329.63, 12],
  ],
);
/* FACTORY — mechanical, cold competence. E Phrygian on E, STEP 0.114 (132 BPM),
   and the flat second is the menace. The smallest diff of the ten: the sawtooth
   engine bass, the 2-against-3 interlock and the CANON were already the right
   idea. The sawtooth bass — the only one in the score, an identity marker rather
   than a fourth default timbre — states the motif low in bar 1 (v2 rhythm), and
   the square lead answers it exactly eight steps later, one octave up, after a
   two-note anacrusis on steps 5 and 7 that leans in on the Phrygian flat
   second. The engine ostinato that follows sustains 3+3+2 (three-step cells,
   then a two-step one) in every bar against a square hat on every even step of
   every bar, so the two grids coincide only twice a bar: the interlock. The old
   bar-5 cut-out is filled in — the machine no longer skips a beat, and SFX still
   sit on top because they render outside musicGain. Nothing reaches for D#: that
   leading tone plus the perfect fourth this mode already owns would make factory
   a second Ionian-pair track and break CROWN's uniqueness pin. No pad. The
   B-section metric modulation the brief asks for is still not attempted: transp
   returns the SAME hat array by identity, so a regrouping B hat cannot exist. */
const FACTORY_A = mkPat(
  0.114,
  64,
  [
    [0, 82.41, 1],
    [1, 98.0, 1],
    [2, 123.47, 1],
    [3, 130.81, 2],
    [5, 123.47, 1],
    ...[
      [82.41, 123.47],
      [87.31, 130.81],
      [98.0, 123.47],
      [82.41, 123.47],
      [82.41, 130.81],
      [110.0, 82.41],
      [87.31, 82.41],
    ].flatMap(([r, q], i) => [
      [(i + 1) * 8, r, 3],
      [(i + 1) * 8 + 3, r, 3],
      [(i + 1) * 8 + 6, q, 2],
    ]),
  ],
  [
    [5, 174.61, 1],
    [7, 146.83, 1],
    [8, 164.81, 1],
    [9, 196.0, 1],
    [10, 246.94, 1],
    [11, 261.63, 2],
    [13, 246.94, 1],
    [17, 220.0, 1],
    [19, 196.0, 1],
    [21, 174.61, 1],
    [23, 164.81, 1],
    [24, 196.0, 1],
    [25, 246.94, 1],
    [27, 261.63, 2],
    [29, 246.94, 1],
    [31, 220.0, 1],
    [33, 164.81, 1],
    [35, 196.0, 1],
    [37, 246.94, 1],
    [39, 261.63, 1],
    [40, 329.63, 1],
    [41, 392.0, 1],
    [42, 493.88, 1],
    [43, 523.25, 2],
    [45, 493.88, 1],
    [49, 440.0, 1],
    [51, 392.0, 1],
    [53, 349.23, 1],
    [55, 329.63, 1],
    [56, 392.0, 1],
    [57, 493.88, 1],
    [59, 523.25, 2],
    [61, 493.88, 1],
    [63, 440.0, 1],
  ],
  [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) =>
    [0, 2, 4, 6].map((o) => [b * 8 + o, 2400, 1]),
  ),
  ["sawtooth", 0.09, "square", 0.075, "square", 0.018],
);
/* WATER — flowing, undertow. G Mixolydian on G, STEP 0.15 (100 BPM); the flat
   seventh is what makes it major-but-not-quite, wet rather than bright. Two
   independent lines, not harmony-by-doubling: the lead states the motif with
   its two long notes stretched so the flash and the settle tie ACROSS bar
   lines, and the sine pad answers it with INV — the same figure mirrored below
   the tonic — so that at every step where both sound, one rises exactly where
   the other falls. Deliberately not the house tresillo: water's identity is
   long ties, so it never collapses into another syncopated track.
   The bass is the first channel in the score to author the [s,f,d,v] tuple:
   eight long notes crescendoing through stepped velocities across each
   four-bar phrase, a swell the old one-v-per-channel encoding could not say at
   all. Bar 8 is bass and pad alone, ringing out. */
const WATER_A = mkPat(
  0.15,
  64,
  [
    [0, 49, 6, 0.05],
    [8, 49, 6, 0.07],
    [16, 65.41, 6, 0.09],
    [24, 43.65, 6, 0.11],
    [32, 49, 6, 0.06],
    [40, 55.0, 6, 0.08],
    [48, 65.41, 6, 0.1],
    [56, 49, 8, 0.12],
  ],
  [
    [0, 392.0, 2],
    [1, 493.88, 2],
    [2, 587.33, 2],
    [3, 659.26, 6],
    [6, 587.33, 5],
    [12, 349.23, 4],
    [16, 523.25, 6],
    [22, 587.33, 5],
    [32, 440.0, 8],
    [40, 493.88, 5],
    [46, 587.33, 6],
    [48, 523.25, 3],
    [52, 659.26, 4],
  ],
  [0, 1, 2, 3, 4, 5, 6].flatMap((b) =>
    [2, 6].map((o) => [b * 8 + o, 4000, 1]),
  ),
  ["triangle", 0.09, "triangle", 0.07, "triangle", 0.016, "sine", 0.03],
  [
    [0, 196.0, 2],
    [1, 164.81, 2],
    [2, 130.81, 2],
    [3, 123.47, 6],
    [6, 130.81, 5],
    [10, 146.83, 6],
    [18, 146.83, 6],
    [26, 174.61, 6],
    [32, 196.0, 2],
    [33, 164.81, 2],
    [34, 130.81, 2],
    [35, 123.47, 6],
    [38, 130.81, 5],
    [44, 164.81, 4],
    [50, 130.81, 5],
    [56, 146.83, 8],
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
/* SAND — heat-shimmer, mirage. E Phrygian natural 3 on E: FACTORY's mode with
   the third raised, the same machine under a hotter sun. STEP 0.139 (108 BPM).
   The bass opens on the drone FIFTH B2 rather than the tonic, which is what
   lets sand share E with FACTORY while keeping the eight biome roots distinct
   and holding the whole score to ONE chromatic guest here — the raised third
   G#. Three tacet-heavy drone notes are the entire bass part.
   The lead states the motif with a one-step appoggiatura leaning into that G#:
   a full extra step at low velocity, since the engine has no sub-step grace
   notes. Every phrase crescendos through stepped [s,f,d,v] velocities and then
   drops out rather than holding one level — the heat waves — over long trailing
   rests: four of the eight bars are empty of lead entirely. Mirage is things
   fading, not looping cleanly. */
const SAND_A = mkPat(
  0.139,
  64,
  [
    [0, 123.47, 20],
    [24, 82.41, 12],
    [44, 123.47, 16],
  ],
  [
    [0, 329.63, 1, 0.04],
    [1, 349.23, 1, 0.03],
    [2, 415.3, 1, 0.06],
    [3, 493.88, 1, 0.07],
    [4, 523.25, 3, 0.09],
    [7, 493.88, 2, 0.05],
    [16, 329.63, 1, 0.04],
    [17, 415.3, 2, 0.07],
    [19, 493.88, 3, 0.09],
    [32, 659.26, 1, 0.04],
    [33, 698.46, 1, 0.03],
    [34, 830.61, 1, 0.06],
    [35, 987.77, 1, 0.08],
    [36, 1046.5, 3, 0.1],
    [39, 987.77, 2, 0.05],
    [48, 415.3, 1, 0.05],
    [49, 523.25, 1, 0.07],
    [51, 493.88, 4, 0.09],
  ],
  [0, 1, 2, 3, 4, 5].map((b) => [b * 8 + 6, 2800, 1]),
  ["triangle", 0.07, "square", 0.07, "triangle", 0.014, "sine", 0.025],
  [
    [12, 207.65, 4],
    [28, 246.94, 4],
    [44, 261.63, 6],
    [60, 207.65, 4],
  ],
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
  jungle: tr(JUNGLE_A, transp(JUNGLE_A, 1.189207)),
  ice: tr(ICE_A, transp(ICE_A, 1.122462)),
  factory: tr(FACTORY_A, transp(FACTORY_A, 0.890899)),
  water: tr(WATER_A, transp(WATER_A, 1.33484)),
  arena: tr(ARENA_A, ARENA_B),
  sand: tr(SAND_A, transp(SAND_A, 1.059463)),
  void: tr(VOID_A, VOID_B),
  crown: tr(CROWN_A, CROWN_B),
});
export function musicCue(screen, level) {
  if ((screen | 0) === SCREEN.INTRO) return "intro";
  if (screen === SCREEN.GAME || screen === SCREEN.ATTRACT)
    return biomeOf(level).name.toLowerCase();
  return "menu";
}
