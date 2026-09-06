import { biomeOf } from "../core/config.js";
import { SCREEN } from "../app/menuapp.js";

/* MENU — direction v3: friendly, memorable, medium. G major HEXATONIC (G A B C
   D E — major without the leading tone), STEP 0.137 (109.5 BPM sixteenths), 8
   bars of 2/4 = 64 steps. The collection is hexatonic rather than pentatonic
   for one reason: the 4th (C) is what I-vi-IV-V needs, and G - Em - C - D twice
   is the friendliest progression there is. It also keeps menu clear of the
   Ionian pair (a perfect fourth AND a leading tone) that is CROWN's alone.
   The bass is an EVEN WALKING EIGHTH — 0/2/4/6 of every bar, root, fifth,
   octave, fifth, each note ringing a full eighth so the four cells meet end to
   end and the low end never lets go — with a one-step pickup on step 7 of bars
   4 and 8. No syncopation anywhere: this is the "medium" in the brief.
   The lead is in EIGHTHS on even steps, so the tune moves at half the grid's
   rate and is singable at first hearing: the head 1-3-5-6 (G B D E) rises
   across bar 1 and returns at bar 5 an octave up, then bars 6-8 walk it back
   down through C. The only sixteenths in the whole channel are three two-note
   turns at 14/15, 30/31 and 46/47 lifting into the next phrase — which is also
   why no four consecutive lead steps are ever struck, and therefore why the
   retired five-note motif cannot appear here by accident.
   The hat is SINE, not square: it is the highest and most-struck channel in any
   pattern, so it is the worst possible place for the one waveform the direction
   calls harsh. Two ticks a bar at 5000 Hz and v 0.012 — a texture, not a pulse.
   Three voices, no pad; channel peaks sum to 0.157. Sparse [step,freqHz,
   durSteps,vel?] lists over absolute steps 0..63 mapped to {s,f,d,t,v}; vel
   defaults to the channel's mix value when omitted (menu authors none).
   pump looks each up by stepIdx. */
const MENU_HAT = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) =>
  [2, 6].map((o) => [b * 8 + o, 5000, 1]),
);
const MENU_MIX = ["triangle", 0.085, "triangle", 0.06, "sine", 0.012];
export const MUSIC_PATTERN = mkPat(
  0.137,
  64,
  /* [root, fifth, octave, fifth] on steps 0/2/4/6; bars 4 and 8 add a pickup */
  [
    [98.0, 146.83, 196.0, 146.83],
    [82.41, 123.47, 164.81, 123.47],
    [65.41, 98.0, 130.81, 98.0],
    [73.42, 110.0, 146.83, 110.0],
    [98.0, 146.83, 196.0, 146.83],
    [82.41, 123.47, 164.81, 123.47],
    [65.41, 98.0, 130.81, 98.0],
    [73.42, 110.0, 146.83, 110.0],
  ].flatMap((c, b) => {
    const o = b * 8,
      row = [
        [o, c[0], 2],
        [o + 2, c[1], 2],
        [o + 4, c[2], 2],
        [o + 6, c[3], 2],
      ];
    if (b === 3) row.push([o + 7, 123.47, 1]);
    if (b === 7) row.push([o + 7, 164.81, 1]);
    return row;
  }),
  [
    [0, 392.0, 2],
    [2, 493.88, 2],
    [4, 587.33, 2],
    [6, 659.26, 2],
    [8, 587.33, 2],
    [10, 493.88, 2],
    [12, 440.0, 2],
    [14, 493.88, 1],
    [15, 523.25, 1],
    [16, 587.33, 2],
    [18, 523.25, 2],
    [20, 659.26, 2],
    [22, 587.33, 2],
    [24, 493.88, 2],
    [26, 440.0, 2],
    [28, 392.0, 2],
    [30, 440.0, 1],
    [31, 493.88, 1],
    [32, 783.99, 2],
    [34, 987.77, 2],
    [36, 1174.66, 2],
    [38, 1318.51, 2],
    [40, 987.77, 2],
    [42, 880.0, 2],
    [44, 783.99, 2],
    [46, 880.0, 1],
    [47, 987.77, 1],
    [48, 1046.5, 2],
    [50, 987.77, 2],
    [52, 880.0, 2],
    [54, 783.99, 2],
    [56, 880.0, 2],
    [58, 783.99, 2],
    [60, 659.26, 2],
    [62, 587.33, 2],
  ],
  MENU_HAT,
  MENU_MIX,
);

/* MENU B — hand-authored, and a real second piece of writing rather than a
   pitch shift. It lifts to D MAJOR PENTATONIC (D E F# A B), the dominant side,
   for eight bars and snaps back: D - D - Bm - A - D - D - Em - A. That import
   is the F# menu's own A does not own, and it is what music.test.mjs reads to
   prove the A-A-B-B section order — the drive only ever pumps the DEFAULT
   track, so the marker is a property of this pair, not of the score (jungle and
   void sound F# in their own A sections under v3).
   Same STEP, same LEN, same three timbres, the same per-channel note counts and
   the same v set as A, so the two interleave as one seamless loop. What differs
   is the harmony, the melody, and the bass ACCENT: B walks 0/3/4/6 (durations
   3/1/2/2, still meeting end to end) where A walks 0/2/4/6, so B leans where A
   strolls. The hat skeleton is deliberately identical — it is the stitch that
   keeps the two halves one piece. */
const MENU_B_MIX = MENU_MIX;
export const MUSIC_PATTERN_B = mkPat(
  0.137,
  64,
  [
    [73.42, 110.0, 146.83, 110.0],
    [73.42, 110.0, 146.83, 185.0],
    [123.47, 185.0, 246.94, 185.0],
    [110.0, 164.81, 220.0, 164.81],
    [73.42, 110.0, 146.83, 110.0],
    [73.42, 110.0, 146.83, 185.0],
    [82.41, 123.47, 164.81, 123.47],
    [110.0, 164.81, 220.0, 164.81],
  ].flatMap((c, b) => {
    const o = b * 8,
      row = [
        [o, c[0], 3],
        [o + 3, c[1], 1],
        [o + 4, c[2], 2],
        [o + 6, c[3], 2],
      ];
    if (b === 3) row.push([o + 7, 185.0, 1]);
    if (b === 7) row.push([o + 7, 92.5, 1]);
    return row;
  }),
  [
    [0, 440.0, 2],
    [2, 587.33, 2],
    [4, 739.99, 2],
    [6, 659.26, 2],
    [8, 587.33, 2],
    [10, 493.88, 2],
    [12, 440.0, 2],
    [14, 493.88, 1],
    [15, 587.33, 1],
    [16, 739.99, 2],
    [18, 659.26, 2],
    [20, 587.33, 2],
    [22, 493.88, 2],
    [24, 440.0, 2],
    [26, 493.88, 2],
    [28, 587.33, 2],
    [30, 659.26, 1],
    [31, 739.99, 1],
    [32, 880.0, 2],
    [34, 739.99, 2],
    [36, 659.26, 2],
    [38, 587.33, 2],
    [40, 493.88, 2],
    [42, 587.33, 2],
    [44, 659.26, 2],
    [46, 739.99, 1],
    [47, 880.0, 1],
    [48, 987.77, 2],
    [50, 880.0, 2],
    [52, 659.26, 2],
    [54, 587.33, 2],
    [56, 659.26, 2],
    [58, 587.33, 2],
    [60, 493.88, 2],
    [62, 440.0, 2],
  ],
  [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) =>
    [2, 6].map((o) => [b * 8 + o, 5000, 1]),
  ),
  MENU_B_MIX,
);
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
/* JUNGLE — direction v3: bouncy and bright. D MAJOR PENTATONIC (D E F# A B),
   STEP 0.132 (113.6 BPM). Room 1 keeps its D2 root but no longer keeps the
   menu's key — under v3 every room is its own piece, and D pentatonic sits a
   fifth below menu's G hexatonic with a different collection, a different
   tempo, a different groove and a different palette.
   The 3+3+2 tresillo survives from v2 because it is the right groove for a
   room like this, but its cells now TILE the bar: steps 0 and 3 ring three
   steps, step 6 rings two, so the three cells meet end to end and the bass is
   continuous as well as syncopated. That is what "bouncy" costs — motion, not
   volume.
   The hat drops from three hits a bar to two (1 and 4, 3200 Hz, v 0.016): a
   light off-tick behind the first two tresillo cells, not a drive. The lead
   skips in the POCKETS the tresillo leaves — 2, 4 and 5, plus a step-7 pickup
   in the even bars — so it is off the beat everywhere and never runs four
   consecutive steps, which is also why the retired five-note motif cannot
   appear here by accident. The hook is the bounce 5-3-5 (A F# A) on 2/4/5,
   stated at bars 1 and 5. Two long sine drones, A3 then D4, are the canopy.
   Channel peaks sum to 0.187. */
const JUNGLE_A = mkPat(
  0.132,
  64,
  [
    [73.42, 73.42, 110.0],
    [73.42, 110.0, 146.83],
    [123.47, 123.47, 185.0],
    [110.0, 110.0, 164.81],
    [73.42, 73.42, 110.0],
    [73.42, 110.0, 146.83],
    [82.41, 123.47, 164.81],
    [110.0, 164.81, 110.0],
  ].flatMap((c, b) => [
    [b * 8, c[0], 3],
    [b * 8 + 3, c[1], 3],
    [b * 8 + 6, c[2], 2],
  ]),
  [
    [2, 880.0, 1],
    [4, 739.99, 1],
    [5, 880.0, 2],
    [10, 987.77, 1],
    [12, 880.0, 1],
    [13, 739.99, 2],
    [15, 659.26, 1],
    [18, 739.99, 1],
    [20, 587.33, 1],
    [21, 739.99, 2],
    [26, 659.26, 1],
    [28, 739.99, 1],
    [29, 659.26, 2],
    [31, 587.33, 1],
    [34, 880.0, 1],
    [36, 739.99, 1],
    [37, 880.0, 2],
    [42, 1174.66, 1],
    [44, 987.77, 1],
    [45, 880.0, 2],
    [47, 739.99, 1],
    [50, 987.77, 1],
    [52, 880.0, 1],
    [53, 739.99, 2],
    [58, 659.26, 1],
    [60, 739.99, 1],
    [61, 659.26, 2],
    [63, 587.33, 1],
  ],
  [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) =>
    [1, 4].map((o) => [b * 8 + o, 3200, 1]),
  ),
  ["triangle", 0.08, "triangle", 0.065, "triangle", 0.016, "sine", 0.026],
  [
    [0, 220.0, 32],
    [32, 293.66, 32],
  ],
);
/* JUNGLE B — hand-authored, which is new: a transp B shares A's hat array by
   identity and so cannot re-cut a rhythm, and an un-re-cut B is exactly the
   sameness v3 exists to remove. B lifts to A MAJOR PENTATONIC (A B C# E F#),
   the dominant, and RE-CUTS the tresillo from 0/3/6 to 0/2/5 (durations 2/3/3,
   still tiling the bar) with the hat moved to 3/6. Same four timbres, same
   velocities, same note counts in bass and hat — the groove is what moves. */
const JUNGLE_B = mkPat(
  0.132,
  64,
  [
    [110.0, 110.0, 164.81],
    [110.0, 164.81, 220.0],
    [92.5, 92.5, 138.59],
    [82.41, 123.47, 164.81],
    [110.0, 110.0, 164.81],
    [110.0, 164.81, 220.0],
    [123.47, 123.47, 185.0],
    [82.41, 123.47, 164.81],
  ].flatMap((c, b) => [
    [b * 8, c[0], 2],
    [b * 8 + 2, c[1], 3],
    [b * 8 + 5, c[2], 3],
  ]),
  [
    [1, 1108.73, 2],
    [4, 987.77, 3],
    [9, 880.0, 2],
    [12, 739.99, 3],
    [15, 659.26, 1],
    [17, 739.99, 2],
    [20, 880.0, 3],
    [25, 987.77, 2],
    [28, 880.0, 3],
    [31, 739.99, 1],
    [33, 1318.51, 2],
    [36, 1108.73, 3],
    [41, 987.77, 2],
    [44, 880.0, 3],
    [47, 739.99, 1],
    [49, 880.0, 2],
    [52, 739.99, 3],
    [57, 659.26, 2],
    [60, 739.99, 3],
    [63, 880.0, 1],
  ],
  [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) =>
    [3, 6].map((o) => [b * 8 + o, 3200, 1]),
  ),
  ["triangle", 0.08, "triangle", 0.065, "triangle", 0.016, "sine", 0.026],
  [
    [0, 329.63, 32],
    [32, 220.0, 32],
  ],
);
/* ICE — brittle, glittering. F Lydian on F, STEP 0.129 (116 BPM). The cold is
   the mode and the register, not an absent low end: the bass is a full
   root-fifth alternation on EVERY off-eighth — steps 1, 3, 5 and 7 of every bar,
   each ringing an eighth long so the line connects rather than ticks — and it is
   the only bass in the score that lives entirely off the beat. The 6200 Hz hat
   answers it with a bell on every even step, so the two voices cover the bar
   between them and the pulse never gaps; the hat skips step 62 and nothing else
   plays there, which is the loop's one deliberate hole. (A first cut put the
   bell only on 0 and 4 and left step 6 of EVERY bar unstruck: the offline render
   showed 34 sub-50 dB holes, one per bar — a rest heard as a feature, which is
   exactly what this direction withdraws.) The lead states the motif at normal
   speed (v2 rhythm) at bars 1 and 5, two octaves above the bass and never below
   C5. The sine
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
    [b * 8 + 1, r, 2],
    [b * 8 + 3, q, 2],
    [b * 8 + 5, r, 2],
    [b * 8 + 7, q, 2],
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
  [0, 1, 2, 3, 4, 5, 6, 7]
    .flatMap((b) => [0, 2, 4, 6].map((o) => b * 8 + o))
    .filter((s) => s !== 62)
    .map((s) => [s, 6200, 1]),
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
   second. Every answer note that is not inside a motif run rings an eighth
   rather than a sixteenth, so the machine hums continuously between statements
   instead of ticking (a staccato first cut measured 3 dB quieter than the
   version it replaced, which is the wrong direction for this brief). The engine ostinato that follows sustains 3+3+2 (three-step cells,
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
    [5, 174.61, 2],
    [7, 146.83, 1],
    [8, 164.81, 1],
    [9, 196.0, 1],
    [10, 246.94, 1],
    [11, 261.63, 2],
    [13, 246.94, 2],
    [17, 220.0, 2],
    [19, 196.0, 2],
    [21, 174.61, 2],
    [23, 164.81, 1],
    [24, 196.0, 1],
    [25, 246.94, 2],
    [27, 261.63, 2],
    [29, 246.94, 2],
    [31, 220.0, 2],
    [33, 164.81, 2],
    [35, 196.0, 2],
    [37, 246.94, 2],
    [39, 261.63, 1],
    [40, 329.63, 1],
    [41, 392.0, 1],
    [42, 493.88, 1],
    [43, 523.25, 2],
    [45, 493.88, 2],
    [49, 440.0, 2],
    [51, 392.0, 2],
    [53, 349.23, 2],
    [55, 329.63, 1],
    [56, 392.0, 1],
    [57, 493.88, 2],
    [59, 523.25, 2],
    [61, 493.88, 2],
    [63, 440.0, 2],
  ],
  [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) =>
    [0, 2, 4, 6].map((o) => [b * 8 + o, 2400, 1]),
  ),
  ["sawtooth", 0.09, "square", 0.075, "square", 0.018],
);
/* WATER — direction v3: flowing, 3-against-4. G MIXOLYDIAN on G, STEP 0.144
   (104.2 BPM). The flat seventh is what makes it major-but-not-quite, wet
   rather than bright, and it is also where B goes.
   The identity is DOTTED THREE-STEP CELLS against the eight-step bar: the bass
   moves every three steps and each cell rings until the next begins, so the
   line is unbroken while its accents walk out of phase with the bar — a
   3-against-4 lilt spelt entirely on integers, with no fractional step and no
   smaller STEP bought to fake a triplet. Eleven cells fill each half of the
   loop (the eleventh rings two steps rather than three), so the grid RE-PHASES
   at step 32 and the hook lands back on the downbeat of bar 4. The bass step
   set is therefore all eight residues of the bar — the one such pattern in the
   score, and water's groove signature.
   This is a CALM ROOM: no hat at all, so the pulse is the cells themselves,
   and the lead is dotted too — 21 notes, never less than three steps apart,
   nothing hurried. The hook is the cell 5-6-1 (D E G) on 0/3/6, stated at bars
   0 and 4 an octave apart. Four long sine drones sit under all of it.
   Two spec conflicts resolved here rather than left to trip a later commit.
   (1) §2 asks for a SINE lead; §5 row 8 keeps "exactly one sine lead, and it is
   VOID" unchanged, and the waveform roster asserts both in one breath. The pin
   sheet wins — this lead is triangle, and water's softness comes from register,
   an empty hat lane and v 0.06. (2) The biome root G1 49.00 does not move (§1b)
   and the no-rumble floor is 55 Hz, so 49.00 is authored EXACTLY ONCE, at step
   0, and every other bass note here is G2 98.00 or above 55; the test states
   that as a score-wide uniqueness claim rather than as a per-pattern excuse.
   Channel peaks sum to 0.173. The hat slots in the mix array are inert — mkPat
   reads the pad's timbre and velocity from mix[6]/mix[7], so the pair has to
   stay in place even on a track whose hat array is empty. */
const WATER_CELLS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
const WATER_A = mkPat(
  0.144,
  64,
  [
    [49.0, 73.42, 98.0, 123.47, 110.0, 98.0, 87.31, 130.81, 110.0, 87.31, 73.42],
    [98.0, 73.42, 82.41, 98.0, 130.81, 110.0, 87.31, 73.42, 82.41, 98.0, 73.42],
  ].flatMap((half, h) =>
    WATER_CELLS.map((s, i) => [s + h * 32, half[i], i === 10 ? 2 : 3]),
  ),
  [
    [0, 293.66, 3],
    [3, 329.63, 3],
    [6, 392.0, 3],
    [10, 440.0, 3],
    [13, 493.88, 3],
    [16, 523.25, 3],
    [19, 493.88, 3],
    [22, 440.0, 3],
    [25, 392.0, 3],
    [28, 329.63, 3],
    [32, 587.33, 3],
    [35, 659.26, 3],
    [38, 783.99, 3],
    [42, 698.46, 3],
    [45, 659.26, 3],
    [48, 523.25, 3],
    [51, 587.33, 3],
    [54, 659.26, 3],
    [57, 523.25, 3],
    [60, 440.0, 3],
    [63, 392.0, 1],
  ],
  [],
  ["triangle", 0.085, "triangle", 0.06, "triangle", 0.012, "sine", 0.028],
  [
    [0, 196.0, 16],
    [16, 174.61, 16],
    [32, 261.63, 16],
    [48, 196.0, 16],
  ],
);
/* WATER B — hand-authored: the lift is to the FLAT SEVENTH, F major pentatonic
   (F G A C D), five notes G Mixolydian already owns, so the modulation is modal
   rather than chromatic and the room never changes colour. What changes is the
   phase: A's cells walk ACROSS the bar, B's sit INSIDE it — 0/3/6 of every bar,
   durations 3/3/2 — so the same dotted lilt suddenly agrees with the barline
   and the second half of the cycle feels like it has settled. The lead answers
   in the pockets on 1/4/7. B opens on F2 87.31 where A opens on G1 49.00. */
const WATER_B = mkPat(
  0.144,
  64,
  [
    [87.31, 130.81, 110.0],
    [87.31, 130.81, 174.61],
    [130.81, 196.0, 130.81],
    [98.0, 146.83, 110.0],
    [87.31, 130.81, 110.0],
    [87.31, 130.81, 174.61],
    [110.0, 146.83, 130.81],
    [130.81, 196.0, 146.83],
  ].flatMap(([r, q, o], b) => [
    [b * 8, r, 3],
    [b * 8 + 3, q, 3],
    [b * 8 + 6, o, 2],
  ]),
  [
    [261.63, 293.66, 349.23],
    [392.0, 440.0, 523.25],
    [587.33, 523.25, 440.0],
    [392.0, 349.23, 293.66],
    [261.63, 349.23, 440.0],
    [523.25, 587.33, 698.46],
    [587.33, 523.25, 440.0],
    [392.0, 349.23, 261.63],
  ].flatMap((c, b) => [
    [b * 8 + 1, c[0], 3],
    [b * 8 + 4, c[1], 3],
    [b * 8 + 7, c[2], 2],
  ]),
  [],
  ["triangle", 0.085, "triangle", 0.06, "triangle", 0.012, "sine", 0.028],
  [
    [0, 174.61, 16],
    [16, 261.63, 16],
    [32, 220.0, 16],
    [48, 174.61, 16],
  ],
);
/* Straight eighths: one hit on every even step of all eight bars. ARENA authors
   this figure; CROWN's B quotes the step pattern verbatim as its victory lap
   past the room the player fought. */
const EVEN8 = Object.freeze(Array.from({ length: 32 }, (_, i) => i * 2));
/* ARENA — aggressive, combat-ready. A Aeolian on A, STEP 0.107 (140 BPM), all
   four voices dense. The reference track for what arcade-correct sounds like:
   tempo, mode, root, density and the anticipation hook are all as authored.
   The motif head lands at step 15, one whole step BEFORE the bar-3 downbeat it
   belongs to, so the fanfare punches ahead of the grid without any sub-step
   timing the engine cannot express; it carries the v2 rhythm like every other
   track (two-step flash at 18, settle at 20), and the rest of the lead stabs
   the "and" of 2 and 4. Plain Aeolian, no colour tones — deliberately harder
   than the modal biomes around it, and clear of G# so the leading tone stays
   CROWN's and SAND's. The one v2 correction is bar 8: it used to stop the
   whole band, which the offline render measured as 0.92 s under -50 dB four
   times per bounce — by far the largest hole in the score, in the very track
   the direction calls already correct. Every voice now plays it, on an E
   turnaround that hands back to the top. */
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
    [41.2, 61.74],
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
    [18, 698.46, 2],
    [20, 659.26, 1],
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
    [56, 440.0, 1],
    [57, 523.25, 1],
    [59, 493.88, 1],
    [61, 440.0, 1],
    [63, 392.0, 1],
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
    [56, 164.81, 6],
  ],
);
/* ARENA B — hand-authored, not transposed: a listener's ear clocks a
   pitch-shifted repeat as repetition, not new material. Same skeleton, same
   mix, same eight played bars; the destination is C major, the relative major,
   the anticipated head restates the motif on C, and bar 8 turns around on G. */
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
    [49, 73.42],
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
    [18, 880.0, 2],
    [20, 783.99, 1],
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
    [56, 523.25, 1],
    [57, 659.26, 1],
    [59, 587.33, 1],
    [61, 523.25, 1],
    [63, 493.88, 1],
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
    [56, 196.0, 6],
  ],
);
/* SAND — heat-shimmer, mirage. E Phrygian natural 3 on E: FACTORY's mode with
   the third raised, the same machine under a hotter sun. STEP 0.134 (112 BPM).
   The bass still opens on the drone FIFTH B2 123.47 — which is what lets sand
   share E with FACTORY while keeping the eight biome roots distinct, and holds
   the whole score to ONE chromatic guest here, the raised third G#. What has
   gone is the drone itself: three tacet notes of eight-plus steps are now a
   moving root-fifth pattern, four hits a bar on 0, 3, 5 and 7 of all eight
   bars, weighted to the fifth (three of the four) and putting two of those
   fifths off the beat. The four sustains meet end to end, so the shimmer never
   drops out, and the hat takes the beats the bass leaves — 2, 4 and 6.
   The lead states the motif at bars 1 and 5 and keeps the one-step
   appoggiatura leaning into the G#: a quiet step immediately before it, since
   the engine has no sub-step grace notes. It still swells through stepped
   [s,f,d,v] velocities — sand's lead and water's bass are the only two
   channels in the score that author per-note velocity — but the swell now
   decorates a bouncing bass instead of trailing off into empty bars. Mirage is
   heat moving, not sound stopping. Step 57 is the loop's one unstruck step. */
const SAND_A = mkPat(
  0.134,
  64,
  [
    [123.47, 82.41],
    [130.81, 87.31],
    [123.47, 82.41],
    [164.81, 110.0],
    [123.47, 82.41],
    [130.81, 87.31],
    [98.0, 65.41],
    [123.47, 82.41],
  ].flatMap(([q, r], b) => [
    [b * 8, q, 3],
    [b * 8 + 3, r, 2],
    [b * 8 + 5, q, 2],
    [b * 8 + 7, q, 1],
  ]),
  [
    [0, 329.63, 1, 0.05],
    [1, 415.3, 1, 0.08],
    [2, 493.88, 1, 0.08],
    [3, 523.25, 2, 0.09],
    [5, 493.88, 1, 0.07],
    [6, 440.0, 1, 0.06],
    [7, 415.3, 1, 0.06],
    [8, 349.23, 1, 0.06],
    [9, 440.0, 1, 0.07],
    [11, 523.25, 2, 0.08],
    [13, 440.0, 1, 0.06],
    [15, 349.23, 1, 0.05],
    [16, 349.23, 1, 0.04],
    [17, 415.3, 2, 0.09],
    [19, 493.88, 1, 0.07],
    [21, 440.0, 1, 0.06],
    [23, 415.3, 1, 0.06],
    [24, 440.0, 1, 0.06],
    [25, 523.25, 1, 0.07],
    [27, 659.26, 2, 0.09],
    [29, 523.25, 1, 0.07],
    [31, 440.0, 1, 0.05],
    [32, 659.26, 1, 0.05],
    [33, 830.61, 1, 0.08],
    [34, 987.77, 1, 0.08],
    [35, 1046.5, 2, 0.09],
    [37, 987.77, 1, 0.07],
    [38, 880.0, 1, 0.06],
    [39, 830.61, 1, 0.06],
    [40, 698.46, 1, 0.06],
    [41, 880.0, 1, 0.07],
    [43, 1046.5, 2, 0.08],
    [45, 880.0, 1, 0.06],
    [47, 698.46, 1, 0.05],
    [48, 523.25, 1, 0.06],
    [49, 659.26, 1, 0.07],
    [51, 830.61, 2, 0.09],
    [53, 659.26, 1, 0.07],
    [55, 523.25, 1, 0.05],
    [56, 493.88, 1, 0.06],
    [59, 440.0, 1, 0.06],
    [61, 415.3, 1, 0.05],
    [63, 329.63, 2, 0.04],
  ],
  [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) =>
    [2, 4, 6].map((o) => [b * 8 + o, 2800, 1]),
  ),
  ["triangle", 0.07, "square", 0.07, "triangle", 0.014, "sine", 0.025],
  [
    [12, 207.65, 4],
    [28, 246.94, 4],
    [44, 261.63, 6],
    [60, 207.65, 4],
  ],
);
/* VOID — direction v3: spacious, mysterious and PLEASANT. B MINOR PENTATONIC
   (B D E F# A) on B1 61.74, STEP 0.152 (98.7 BPM) — the slowest of the ten and
   still inside the band. v2 bought dread with B Locrian's tritone at 104 BPM;
   v3's brief is mystery, and dread was the wrong target. The levers here are
   all subtraction of TENSION rather than subtraction of sound: minor pentatonic
   contains neither a tritone nor a semitone, so no interval in the track can
   sting; nothing sits below 55 Hz, so there is no rumble; and the four channel
   peaks sum to 0.132, the quietest track in the game.
   The bed is half-time and unbroken: root against its own octave on steps 0 and
   4, each ringing four steps, so the bass SPANS every step of the loop while
   its onsets stay at half speed. The hat is the softest tick in the score —
   2400 Hz at v 0.010, on 2 and 6.
   The sine lead survives as void's identity marker, and it now carries the
   melodic weight, because the score-wide "the retired motif is gone" pin is
   trivially true here (minor pentatonic has no 6th degree, so the detector can
   never fire whatever this track plays). void's own hook is three ADJACENT
   COLLECTION STEPS FALLING on 0/3/5 — F#-E-D at bar 1, A-F#-E at bar 3,
   B-A-F# at bar 5, D-B-A at bar 7 — the same gesture read from a different
   degree each time, with the even bars answering in two held notes. 20 lead
   notes in 64 steps, none shorter than two steps: the sparsest lead in the
   score, and still the densest thing about the track. */
const VOID_A = mkPat(
  0.152,
  64,
  [
    [61.74, 123.47],
    [61.74, 123.47],
    [73.42, 146.83],
    [55.0, 110.0],
    [61.74, 123.47],
    [61.74, 123.47],
    [82.41, 164.81],
    [92.5, 185.0],
  ].flatMap(([r, o], b) => [
    [b * 8, r, 4],
    [b * 8 + 4, o, 4],
  ]),
  [
    [0, 739.99, 3],
    [3, 659.26, 2],
    [5, 587.33, 3],
    [8, 493.88, 4],
    [12, 587.33, 4],
    [16, 880.0, 3],
    [19, 739.99, 2],
    [21, 659.26, 3],
    [24, 739.99, 4],
    [28, 659.26, 4],
    [32, 987.77, 3],
    [35, 880.0, 2],
    [37, 739.99, 3],
    [40, 659.26, 4],
    [44, 739.99, 4],
    [48, 587.33, 3],
    [51, 493.88, 2],
    [53, 440.0, 3],
    [56, 739.99, 4],
    [60, 587.33, 3],
  ],
  [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) =>
    [2, 6].map((o) => [b * 8 + o, 2400, 1]),
  ),
  ["triangle", 0.05, "sine", 0.05, "triangle", 0.01, "sine", 0.022],
  [
    [0, 246.94, 32],
    [32, 185.0, 32],
  ],
);
/* VOID B — hand-authored, and the bed is RE-CUT rather than transposed: the
   bass moves to 0 and 5 (durations 5 and 3, still spanning the whole bar) and
   the hat to 3 and 7, so B breathes on a different part of the bar. The key
   drops a fourth to E MINOR PENTATONIC (E G A B D), which swaps F# out for G —
   the same softness from one step further down. The lead's roles swap with it:
   here the EVEN bars carry the falling hook and the odd bars answer, so the
   A-A-B-B cycle inverts its own phrasing halfway through. */
const VOID_B = mkPat(
  0.152,
  64,
  [
    [82.41, 164.81],
    [82.41, 164.81],
    [98.0, 196.0],
    [73.42, 146.83],
    [82.41, 164.81],
    [82.41, 164.81],
    [110.0, 220.0],
    [123.47, 246.94],
  ].flatMap(([r, o], b) => [
    [b * 8, r, 5],
    [b * 8 + 5, o, 3],
  ]),
  [
    [0, 493.88, 4],
    [4, 440.0, 4],
    [8, 587.33, 3],
    [11, 493.88, 2],
    [13, 440.0, 3],
    [16, 392.0, 4],
    [20, 440.0, 4],
    [24, 493.88, 3],
    [27, 440.0, 2],
    [29, 392.0, 3],
    [32, 659.26, 4],
    [36, 587.33, 4],
    [40, 783.99, 3],
    [43, 659.26, 2],
    [45, 587.33, 3],
    [48, 493.88, 4],
    [52, 587.33, 4],
    [56, 587.33, 3],
    [59, 493.88, 2],
    [61, 440.0, 3],
  ],
  [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) =>
    [3, 7].map((o) => [b * 8 + o, 2400, 1]),
  ),
  ["triangle", 0.05, "sine", 0.05, "triangle", 0.01, "sine", 0.022],
  [
    [0, 246.94, 32],
    [32, 164.81, 32],
  ],
);
/* CROWN — finale gold. C Ionian on C, the only pure major in the game, earned
   by contrast with everything before it; STEP 0.110 (136 BPM). Ionian is what
   the perfect fourth and the leading tone together name — the pair that
   separates it from Lydian's #4 and from every flat-seventh mode in the run,
   and CROWN is the only A section in the score that sounds both.
   The bass is a dotted FANFARE, root-fifth-octave: a dotted-eighth root on
   step 0, then the fifth on 3, the octave on 4 and the fifth again on 6, in
   all eight bars over C-G-Am-F-C-F-G-C. Its four sustains meet end to end, so
   the low end never lets go, and its step set belongs to no other track. The
   hat answers offbeat on 1, 5 and 7 — deliberately NOT the even-step pattern,
   because that pattern is the quote B is saving. The lead states RESOLVED (the
   v2 motif plus a sixth note: the tonic an octave above the head, on step 7)
   at bar 1 and again an octave up at bar 5, so the finale hands over the note
   VOID refuses twice a pass instead of withholding it until B. Sawtooth pad
   doubles the lead an octave up for brass weight. The bar-4 full-band stop is
   gone: the finale no longer takes a breath before it climbs, it climbs. Step
   58 is the loop's one unstruck step. */
const CROWN_A = mkPat(
  0.11,
  64,
  [
    [65.41, 98.0, 130.81],
    [49.0, 73.42, 98.0],
    [55.0, 82.41, 110.0],
    [43.65, 65.41, 87.31],
    [65.41, 98.0, 130.81],
    [43.65, 65.41, 87.31],
    [49.0, 73.42, 98.0],
    [65.41, 98.0, 130.81],
  ].flatMap(([r, q, o], b) => [
    [b * 8, r, 3],
    [b * 8 + 3, q, 1],
    [b * 8 + 4, o, 2],
    [b * 8 + 6, q, 2],
  ]),
  [
    [0, 261.63, 1],
    [1, 329.63, 1],
    [2, 392.0, 1],
    [3, 440.0, 2],
    [5, 392.0, 1],
    [7, 523.25, 2],
    [8, 493.88, 1],
    [9, 440.0, 1],
    [10, 392.0, 1],
    [11, 587.33, 2],
    [13, 493.88, 1],
    [15, 392.0, 1],
    [16, 440.0, 1],
    [17, 523.25, 1],
    [18, 659.26, 2],
    [20, 523.25, 1],
    [21, 493.88, 1],
    [23, 440.0, 1],
    [24, 349.23, 1],
    [25, 440.0, 1],
    [26, 523.25, 1],
    [27, 587.33, 2],
    [29, 523.25, 1],
    [31, 440.0, 1],
    [32, 523.25, 1],
    [33, 659.26, 1],
    [34, 783.99, 1],
    [35, 880.0, 2],
    [37, 783.99, 1],
    [39, 1046.5, 2],
    [40, 698.46, 1],
    [41, 880.0, 1],
    [42, 783.99, 1],
    [43, 698.46, 2],
    [45, 659.26, 1],
    [47, 523.25, 1],
    [48, 587.33, 1],
    [49, 783.99, 1],
    [50, 698.46, 1],
    [51, 587.33, 2],
    [53, 493.88, 1],
    [55, 392.0, 1],
    [56, 523.25, 1],
    [59, 659.26, 1],
    [60, 783.99, 1],
    [61, 1046.5, 3],
  ],
  [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) =>
    [1, 5, 7].map((o) => [b * 8 + o, 4800, 1]),
  ),
  ["square", 0.11, "square", 0.08, "triangle", 0.024, "sawtooth", 0.03],
  [
    [0, 523.25, 3],
    [3, 880.0, 2],
    [5, 783.99, 2],
    [7, 1046.5, 2],
    [16, 880.0, 2],
    [18, 1318.51, 2],
    [24, 698.46, 2],
    [27, 1174.66, 2],
    [48, 1174.66, 2],
    [51, 1174.66, 2],
    [56, 1046.5, 3],
    [59, 1318.51, 2],
  ],
);
/* CROWN B — the payoff. Its hat quotes ARENA A's step pattern verbatim, a
   victory lap past the room the player fought through; the quote is of the
   STEP pattern, not the wall clock, so at .110 against arena's .107 the same
   figure plays about 3% broader, and it lands ON the beat against A's offbeat
   hat, which is what makes the borrowed figure audible as a borrowing. Bar 1
   states RESOLVED again on the same skeleton as A. The progression tours away
   — Am, F, G, Em, Dm — and leaves on the dominant, which is how it hands back
   to A. Step 63 is B's one unstruck step. */
const CROWN_B = mkPat(
  0.11,
  64,
  [
    [65.41, 98.0, 130.81],
    [55.0, 82.41, 110.0],
    [43.65, 65.41, 87.31],
    [49.0, 73.42, 98.0],
    [41.2, 61.74, 82.41],
    [55.0, 82.41, 110.0],
    [73.42, 110.0, 146.83],
    [49.0, 73.42, 98.0],
  ].flatMap(([r, q, o], b) => [
    [b * 8, r, 3],
    [b * 8 + 3, q, 1],
    [b * 8 + 4, o, 2],
    [b * 8 + 6, q, 2],
  ]),
  [
    [0, 261.63, 1],
    [1, 329.63, 1],
    [2, 392.0, 1],
    [3, 440.0, 2],
    [5, 392.0, 1],
    [7, 523.25, 2],
    [8, 440.0, 1],
    [9, 523.25, 1],
    [11, 493.88, 1],
    [12, 440.0, 1],
    [13, 392.0, 1],
    [15, 349.23, 1],
    [16, 349.23, 1],
    [17, 392.0, 1],
    [19, 440.0, 1],
    [21, 523.25, 1],
    [23, 587.33, 1],
    [24, 587.33, 1],
    [25, 659.26, 1],
    [27, 493.88, 1],
    [29, 440.0, 1],
    [31, 392.0, 1],
    [32, 329.63, 1],
    [33, 392.0, 1],
    [35, 493.88, 1],
    [37, 440.0, 1],
    [39, 392.0, 1],
    [40, 329.63, 1],
    [41, 440.0, 1],
    [43, 523.25, 1],
    [45, 493.88, 1],
    [47, 440.0, 1],
    [48, 587.33, 1],
    [49, 698.46, 1],
    [51, 587.33, 1],
    [53, 523.25, 1],
    [55, 493.88, 1],
    [56, 392.0, 1],
    [57, 493.88, 1],
    [59, 587.33, 1],
    [61, 493.88, 2],
  ],
  EVEN8.map((s) => [s, 4800, 1]),
  ["square", 0.11, "square", 0.08, "triangle", 0.024, "sawtooth", 0.03],
  [
    [0, 523.25, 3],
    [3, 880.0, 2],
    [5, 783.99, 2],
    [7, 1046.5, 2],
    [16, 698.46, 2],
    [19, 880.0, 1],
    [40, 659.26, 1],
    [41, 880.0, 1],
    [56, 783.99, 3],
    [59, 1174.66, 1],
  ],
);
export const MUSIC_TRACKS = Object.freeze({
  intro: tr(INTRO_A, null, Object.freeze(["A"])),
  menu: tr(MUSIC_PATTERN, MUSIC_PATTERN_B, MUSIC_SECTIONS),
  jungle: tr(JUNGLE_A, JUNGLE_B),
  ice: tr(ICE_A, transp(ICE_A, 1.122462)),
  factory: tr(FACTORY_A, transp(FACTORY_A, 0.890899)),
  water: tr(WATER_A, WATER_B),
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
