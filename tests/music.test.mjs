import {
  createAudio,
  MUSIC_PATTERN,
  MUSIC_PATTERN_B,
  MUSIC_SECTIONS,
  MUSIC_TRACKS,
  musicCue,
} from "../src/audio.js";
import * as audioMod from "../src/audio.js";
import { SCREEN } from "../src/app/menuapp.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") +
      name +
      (detail !== undefined ? " -> " + detail : ""),
  );
}
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);

/* Interval pins measure pitch CLASS above the track's own tonic, read from this
   table — never A.bass[0].f, because intro's bass sits on the DOMINANT and
   sand's on the drone FIFTH (spec 1b). Inferring a tonic from bass[0] would
   silently measure the wrong intervals on those two. */
const TONIC = Object.freeze({
  intro: 293.66,
  menu: 392.0,
  jungle: 293.66,
  ice: 349.23,
  factory: 329.63,
  water: 392.0,
  arena: 440.0,
  sand: 329.63,
  void: 493.88,
  crown: 261.63,
});
/* The F# menu's B section imports and menu's A does not own, in every octave it
   is authored in. v3 scopes this to MENU: the AABB drive only ever pumps the
   DEFAULT track, so the marker is a property of MUSIC_PATTERN/_B, not of the
   score — jungle and void sound F# in their own A sections and the v2 claim
   "the score's two chromatic guests are menu's F# and sand's G#" is retired. */
const FSHARP = Object.freeze([92.5, 185.0, 369.99, 739.99, 1479.98]);
const semi = (f, f0) => 12 * Math.log2(f / f0);
const pcOf = (f, f0) => {
  const x = semi(f, f0) % 12;
  return x < 0 ? x + 12 : x;
};
const isDeg = (f, f0, set) => {
  const p = pcOf(f, f0);
  return set.some(
    (d) => Math.abs(p - d) <= 0.05 || Math.abs(p - d - 12) <= 0.05,
  );
};
/* One helper covers all eight modes because the motif's degrees are exactly the
   ones every mode agrees on to within these pairs: 3 swings minor/major, 5 is
   diminished only in Locrian, 6 is the modal fingerprint. */
const DEG1 = [0],
  DEG3 = [3, 4],
  DEG5 = [6, 7],
  DEG6 = [8, 9];
const figureAt = (chan, s0, f0, offs, degs) =>
  offs.every((off, i) =>
    chan.some((n) => n.s === s0 + off && isDeg(n.f, f0, degs[i])),
  );
/* Direction v2 (spec 1): same contour, bouncier rhythm — the flash is two steps
   instead of three and the settle moves to step 5, so steps 6-7 carry a pickup
   rather than a rest. The v1 motifAt (offsets 0,1,2,3,6) and its motifHead are
   GONE: wave B moved arena's ANTIC, void's fragment and crown's RESOLVED onto
   this figure, which were their last three callers. Hook pins using this are
   always positional (a named bar), because a sixteenth run can walk the right
   pitch classes by accident. */
const motifV2At = (chan, s0, f0) =>
  figureAt(chan, s0, f0, [0, 1, 2, 3, 5], [DEG1, DEG3, DEG5, DEG6, DEG5]);
const motifV2Head = (chan, f0, len) => {
  for (let s = 0; s < (len || 64); s++) if (motifV2At(chan, s, f0)) return s;
  return -1;
};
const fragMidAt = (chan, s0, f0) =>
  figureAt(chan, s0, f0, [1, 2, 3], [DEG3, DEG5, DEG6]);
const chansOf = (P) =>
  ["bass", "lead", "hat", "pad"].map((k) => P[k]).filter((a) => a && a.length);
const occ = (P) => {
  const s = new Set();
  for (const a of chansOf(P)) for (const n of a) s.add(n.s);
  return s.size;
};
const lanes = (P) =>
  P.bass.length > 0 &&
  P.lead.length > 0 &&
  Math.max(...P.bass.map((n) => n.f)) < Math.min(...P.lead.map((n) => n.f));
const waves = (P) => new Set(chansOf(P).map((a) => a[0].t)).size;
/* v2 (spec 0a.1): the machine reading of "constant pulse" — the longest run of
   consecutive steps, read CYCLICALLY and keyed off P.LEN (intro is 32, not 64),
   carrying neither a bass nor a hat note. <= 1 on every v2 track. */
const pulseGap = (P) => {
  const on = new Set();
  for (const n of P.bass) on.add(n.s);
  for (const n of P.hat) on.add(n.s);
  if (!on.size) return P.LEN;
  let worst = 0,
    run = 0;
  for (let i = 0; i < P.LEN * 2; i++) {
    if (on.has(i % P.LEN)) run = 0;
    else if (++run > worst && i >= P.LEN) worst = run;
  }
  return worst;
};
/* How many 8-step bars carry a note in that channel. Both are full on a v2
   track: this is what retires "bars 4 and 8 drop the lead" and "the bass rests
   through bars 5 and 8" without a rule about rests. */
const barsIn = (a, LEN) => {
  let c = 0;
  for (let b = 0; b * 8 < LEN; b++)
    if (a.some((n) => n.s >= b * 8 && n.s < b * 8 + 8)) c++;
  return c;
};
const barsWithLead = (P) => barsIn(P.lead, P.LEN);
const barsWithBass = (P) => barsIn(P.bass, P.LEN);
const soundsDeg = (P, f0, d) =>
  ["bass", "lead", "pad"].some(
    (k) => P[k] && P[k].some((n) => isDeg(n.f, f0, [d])),
  );

/* ---- direction v3 (spec 0a / 1 / 6) ----
   V3 grows one id per commit, exactly as the v2 sweeps did. Every v2-direction
   sweep below quantifies over V2ONLY instead of over all ten, so the suite stays
   green on a mixed tree and nothing is scoped away permanently. */
const V3 = ["menu", "jungle", "void", "water", "sand"];
const V2ONLY = Object.keys(MUSIC_TRACKS).filter((k) => !V3.includes(k));
/* Declared per PATTERN, not per track: v3 gives A and B their own key, so the
   in-collection pin has to read a section's own tonic and collection. Neither
   pentatonic contains a 6-semitone pair or a semitone, which is why "no tritone
   sting, no dissonant cluster" is free on those tracks rather than inspected. */
const PENT_MAJ = [0, 2, 4, 7, 9],
  PENT_MIN = [0, 3, 5, 7, 10],
  HEX_MAJ = [0, 2, 4, 5, 7, 9],
  MIXO = [0, 2, 4, 5, 7, 9, 10];
const V3KEY = {
  "menu.A": { f0: 392.0, set: HEX_MAJ, name: "G major hexatonic" },
  "menu.B": { f0: 293.66, set: PENT_MAJ, name: "D major pentatonic" },
  "jungle.A": { f0: 293.66, set: PENT_MAJ, name: "D major pentatonic" },
  "jungle.B": { f0: 440.0, set: PENT_MAJ, name: "A major pentatonic" },
  "void.A": { f0: 493.88, set: PENT_MIN, name: "B minor pentatonic" },
  "void.B": { f0: 329.63, set: PENT_MIN, name: "E minor pentatonic" },
  "water.A": { f0: 392.0, set: MIXO, name: "G Mixolydian" },
  "water.B": { f0: 349.23, set: PENT_MAJ, name: "F major pentatonic" },
  "sand.A": { f0: 329.63, set: MIXO, name: "E Mixolydian" },
  "sand.B": { f0: 440.0, set: MIXO, name: "A Mixolydian" },
};
/* Index in the declared collection, extended across octaves, so "three adjacent
   collection steps falling" is idx, idx-1, idx-2 read from ANY degree — which is
   what lets void's hook be pinned as a gesture rather than as semitones. */
const degIdx = (f, f0, set) => {
  const s = Math.round(semi(f, f0)),
    oct = Math.floor(s / 12),
    pc = s - oct * 12,
    i = set.indexOf(pc);
  return i < 0 ? null : oct * set.length + i;
};
/* The steps a bass note actually SOUNDS through, [s, s + d/STEP), cyclically.
   "spans cover every step" is v3's replacement for the v2 pulseGap <= 1 mandate:
   it bounds the sound, where pulseGap only bounds the onset grid. */
const bassSpan = (P) => {
  const on = new Set();
  for (const n of P.bass) {
    const len = Math.max(1, Math.round(n.d / P.STEP));
    for (let i = 0; i < len; i++) on.add((n.s + i) % P.LEN);
  }
  return on;
};
/* (delta-step, delta-semitone) pairs: melodic SHAPE, independent of key. A Hz
   list comparison between two tracks in different keys is vacuously unequal. */
const contour = (chan) =>
  chan
    .slice(1)
    .map((n, i) => n.s - chan[i].s + ":" + Math.round(semi(n.f, chan[i].f)))
    .join(",");
const stepSet = (chan) =>
  [...new Set(chan.map((n) => n.s % 8))].sort((a, b) => a - b).join(",");
const peakSum = (P) =>
  chansOf(P).reduce((t, a) => t + Math.max(...a.map((n) => n.v)), 0);
const patsOf = (id) =>
  ["A", "B"]
    .filter((s) => MUSIC_TRACKS[id][s])
    .map((s) => [id + "." + s, MUSIC_TRACKS[id][s]]);

// ---- fake AudioContext: records oscillator starts + gain automation ----
function auto(v0) {
  return {
    value: v0 || 0,
    setValueAtTime(v) {
      if (this._f0 == null) this._f0 = v;
      this.value = v;
    },
    exponentialRampToValueAtTime(v) {
      this.value = v;
    },
  };
}
function sink(n) {
  let x = n;
  while (x && x._dst) x = x._dst;
  return x;
}
// walks a start's node chain to the first real GainNode (skips any biquad
// filter hop voice()/noise() insert ahead of the amplitude gain)
function gainNode(s) {
  let x = s.g;
  while (x && !x.gain) x = x._dst;
  return x;
}
function mkAC() {
  const ac = {
    currentTime: 0,
    state: "running",
    sampleRate: 44100,
    destination: { name: "dest" },
    starts: [],
    stops: [],
    resume() {
      ac.state = "running";
    },
    createOscillator() {
      const o = {
        type: "",
        frequency: auto(0),
        _g: null,
        connect(g) {
          o._g = g;
        },
        start(t) {
          ac.starts.push({
            t,
            f: o.frequency.value,
            f0: o.frequency._f0 != null ? o.frequency._f0 : o.frequency.value,
            type: o.type,
            g: o._g,
          });
        },
        stop(t) {
          ac.stops.push(t);
        },
      };
      return o;
    },
    createBiquadFilter() {
      const f = {
        type: "lowpass",
        frequency: auto(350),
        Q: { value: 1 },
        _dst: null,
        connect(dst) {
          f._dst = dst;
          return dst;
        },
      };
      return f;
    },
    createBuffer(ch, len, rate) {
      const data = new Float32Array(len);
      return {
        numberOfChannels: ch,
        length: len,
        sampleRate: rate,
        getChannelData() {
          return data;
        },
      };
    },
    createBufferSource() {
      const s = {
        buffer: null,
        _g: null,
        connect(g) {
          s._g = g;
        },
        start(t) {
          ac.starts.push({ t, f: 0, type: "noise", g: s._g });
        },
        stop(t) {
          ac.stops.push(t);
        },
      };
      return s;
    },
    createGain() {
      const g = {
        _dst: null,
        gain: {
          value: 0,
          _l: [],
          setValueAtTime(v, t) {
            this._l.push(["set", v, t]);
            this.value = v;
          },
          exponentialRampToValueAtTime(v, t) {
            this._l.push(["ramp", v, t]);
            this.value = v;
          },
          cancelScheduledValues() {
            this._l.push(["cancel"]);
          },
        },
        connect(dst) {
          g._dst = dst;
          return dst;
        },
      };
      return g;
    },
  };
  return ac;
}
function installAC(ac) {
  class FakeAC {
    constructor() {
      return ac;
    }
  }
  globalThis.window = { AudioContext: FakeAC };
}

// ---- headless first: window undefined -> every new API is a safe no-op ----
{
  const a = createAudio();
  let threw = false;
  try {
    check("headless: unlock() returns false", a.unlock() === false);
    check("headless: unlocked() false", a.unlocked() === false);
    a.duck(true);
    a.duck(false);
    a.pump();
    a.play("uiMove");
  } catch (e) {
    threw = true;
    console.log(e.message);
  }
  check("headless: unlock/duck/pump/play never throw", !threw);
}

// ---- MUSIC_PATTERN: pure frozen data (spec §3 table) ----
{
  check(
    "pattern frozen (root + tracks)",
    Object.isFrozen(MUSIC_PATTERN) &&
      Object.isFrozen(MUSIC_PATTERN.bass) &&
      Object.isFrozen(MUSIC_PATTERN.lead) &&
      Object.isFrozen(MUSIC_PATTERN.hat),
  );
  check(
    "STEP=0.137 LEN=64 (109.5 BPM sixteenths, 8 bars of 2/4)",
    MUSIC_PATTERN.STEP === 0.137 && MUSIC_PATTERN.LEN === 64,
  );
  const fin = (a) =>
    a.every(
      (n) =>
        ["s", "f", "d", "v"].every(
          (k) => typeof n[k] === "number" && Number.isFinite(n[k]),
        ) && typeof n.t === "string",
    );
  check(
    "all entries finite {s,f,d,t,v}",
    fin(MUSIC_PATTERN.bass) &&
      fin(MUSIC_PATTERN.lead) &&
      fin(MUSIC_PATTERN.hat),
  );
  check(
    "bass 34 hits — an even walking eighth on 0/2/4/6 plus two bar-end pickups",
    MUSIC_PATTERN.bass.length === 34 &&
      MUSIC_PATTERN.bass.every((n) => [0, 2, 4, 6, 7].includes(n.s % 8)) &&
      MUSIC_PATTERN.bass
        .filter((n) => n.s % 8 === 7)
        .map((n) => n.s)
        .join(",") === "31,63",
    MUSIC_PATTERN.bass.length + ":" + stepSet(MUSIC_PATTERN.bass),
  );
  check(
    "lead 35 notes and NO lead-free bar — eighths, with three sixteenth turns",
    MUSIC_PATTERN.lead.length === 35 &&
      barsWithLead(MUSIC_PATTERN) === 8 &&
      MUSIC_PATTERN.lead
        .filter((n) => n.s % 2 === 1)
        .map((n) => n.s)
        .join(",") === "15,31,47",
    MUSIC_PATTERN.lead.length + " / " + barsWithLead(MUSIC_PATTERN) + " bars",
  );
  check(
    "hat 16 soft sine ticks at 5000 Hz, on steps 2 and 6 — not a driving pulse",
    MUSIC_PATTERN.hat.length === 16 &&
      MUSIC_PATTERN.hat.every(
        (n) => [2, 6].includes(n.s % 8) && n.f === 5000 && n.t === "sine",
      ),
    MUSIC_PATTERN.hat.length + ":" + stepSet(MUSIC_PATTERN.hat),
  );
  const bassByS = new Map(MUSIC_PATTERN.bass.map((n) => [n.s, n]));
  check(
    "G - Em - C - D walk (G2 98, E2 82.41, C2 65.41, D2 73.42) — I-vi-IV-V",
    bassByS.get(0).f === 98 &&
      bassByS.get(8).f === 82.41 &&
      bassByS.get(16).f === 65.41 &&
      bassByS.get(24).f === 73.42,
    [0, 8, 16, 24].map((s) => bassByS.get(s) && bassByS.get(s).f).join("/"),
  );
  const loBar = new Map(
    MUSIC_PATTERN.lead.filter((n) => n.s < 32).map((n) => [n.s, n.f]),
  );
  const differ = MUSIC_PATTERN.lead.filter(
    (n) =>
      n.s >= 32 &&
      (!loBar.has(n.s - 32) || !near(n.f, loBar.get(n.s - 32) * 2, 0.05)),
  ).length;
  check(
    "bars 5-8 are a varied restatement, not a mechanical octave copy",
    differ >= 4,
    differ + " of " + MUSIC_PATTERN.lead.filter((n) => n.s >= 32).length,
  );
  const durs = [
    MUSIC_PATTERN.bass,
    MUSIC_PATTERN.lead,
    MUSIC_PATTERN.hat,
  ].every((a) => a.every((n) => n.d > 0 && n.d <= MUSIC_PATTERN.STEP * 8));
  check("durations positive, within pattern span", durs);
}

// ---- B section (AABB cycle): pure frozen data, same mix, new pitches ----
{
  check(
    "sections frozen [A,A,B,B]",
    Object.isFrozen(MUSIC_SECTIONS) &&
      JSON.stringify(MUSIC_SECTIONS) === '["A","A","B","B"]',
    JSON.stringify(MUSIC_SECTIONS),
  );
  check(
    "B pattern frozen (root + tracks)",
    Object.isFrozen(MUSIC_PATTERN_B) &&
      Object.isFrozen(MUSIC_PATTERN_B.bass) &&
      Object.isFrozen(MUSIC_PATTERN_B.lead) &&
      Object.isFrozen(MUSIC_PATTERN_B.hat),
  );
  check(
    "B STEP/LEN match A (interleavable sections)",
    MUSIC_PATTERN_B.STEP === MUSIC_PATTERN.STEP &&
      MUSIC_PATTERN_B.LEN === MUSIC_PATTERN.LEN,
  );
  const T_OF = { bass: "triangle", lead: "triangle", hat: "sine" };
  const vset = (a) => [...new Set(a.map((n) => n.v))].sort().join(",");
  check(
    "B instrument mix matches A (same count, same t per channel, same v set)",
    ["bass", "lead", "hat"].every(
      (k) =>
        MUSIC_PATTERN_B[k].length === MUSIC_PATTERN[k].length &&
        MUSIC_PATTERN_B[k].every((n) => n.t === T_OF[k]) &&
        vset(MUSIC_PATTERN_B[k]) === vset(MUSIC_PATTERN[k]),
    ),
    ["bass", "lead", "hat"].map((k) => vset(MUSIC_PATTERN_B[k])).join(" | "),
  );
  check(
    "B hat 16 ticks on 2 and 6, the same skeleton as A — the section's stitch",
    MUSIC_PATTERN_B.hat.length === 16 &&
      MUSIC_PATTERN_B.hat.every((n) => [2, 6].includes(n.s % 8)),
    MUSIC_PATTERN_B.hat.length + ":" + stepSet(MUSIC_PATTERN_B.hat),
  );
  const roots = (p) =>
    [0, 8, 16, 24].map((s) => p.bass.find((n) => n.s === s).f);
  check(
    "B root progression differs from A",
    JSON.stringify(roots(MUSIC_PATTERN_B)) !==
      JSON.stringify(roots(MUSIC_PATTERN)),
    roots(MUSIC_PATTERN).join("/") + " vs " + roots(MUSIC_PATTERN_B).join("/"),
  );
  const FS = FSHARP;
  const soundsFs = (p) =>
    ["bass", "lead", "hat"].some((k) =>
      p[k].some((n) => FS.some((m) => Math.abs(n.f - m) < 0.02)),
    );
  check(
    "B tonicizes D major and imports the F# menu's own A does not own",
    soundsFs(MUSIC_PATTERN_B) && !soundsFs(MUSIC_PATTERN),
  );
  check(
    "B lead contour differs from A",
    JSON.stringify(MUSIC_PATTERN_B.lead.map((n) => [n.s % 32, n.f])) !==
      JSON.stringify(
        MUSIC_PATTERN.lead.filter((n) => n.s < 32).map((n) => [n.s, n.f]),
      ),
  );
  const fin = (a) =>
    a.every(
      (n) =>
        ["s", "f", "d", "v"].every(
          (k) => typeof n[k] === "number" && Number.isFinite(n[k]),
        ) && typeof n.t === "string",
    );
  check(
    "B entries all finite {s,f,d,t,v}",
    fin(MUSIC_PATTERN_B.bass) &&
      fin(MUSIC_PATTERN_B.lead) &&
      fin(MUSIC_PATTERN_B.hat),
  );
}

// ---- unlock/lazy graph + pump lookahead scheduling ----
{
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  check("pre-unlock: unlocked() false", a.unlocked() === false);
  check("unlock() true", a.unlock() === true);
  check("unlock idempotent", a.unlock() === true && a.unlocked() === true);

  a.pump();
  check(
    "lookahead: first pump schedules only the 0.05s anchor step",
    ac.starts.length > 0 && ac.starts.every((s) => near(s.t, 0.05, 1e-9)),
    JSON.stringify(ac.starts.slice(0, 3)),
  );
  const noteGains = new Set(ac.starts.map((s) => s.g));
  check(
    "per-note gain nodes are distinct",
    noteGains.size === ac.starts.length,
  );
  const mg = [...noteGains][0]._dst;
  check(
    "note gains route through ONE music gain -> destination",
    mg && mg !== ac.destination && mg._dst === ac.destination,
  );

  /* 0.1 s frames, never a jump: STEP is now larger than a frame, so advancing
     the clock in one leap would put nextT behind it and fire the catch-up
     clamp, which re-anchors the grid and would then desync the wrap test. */
  for (let i = 0; i < 4; i++) {
    ac.currentTime += 0.1;
    a.pump();
  }
  /* A v3 pattern is sparse, so "step 1" need not carry a note and asserting a
     start at 0.05 + 1*STEP would pin the tempo through the DENSITY. What the
     scheduler actually guarantees is that every start sits exactly on the
     anchor grid 0.05 + k*STEP — derived from MUSIC_PATTERN.STEP, never a
     literal (the old 0.2 was what STEP 0.15 happened to produce). */
  const S1 = MUSIC_PATTERN.STEP;
  const onGrid = (t) =>
    near(t - 0.05 - Math.round((t - 0.05) / S1) * S1, 0, 1e-9);
  check(
    "frame pump advances lookahead monotonically, on the anchor + k*STEP grid",
    ac.starts.every((s, i) => i === 0 || s.t >= ac.starts[i - 1].t) &&
      ac.starts.every((s) => onGrid(s.t)) &&
      ac.starts.some((s) => s.t > 0.05 + 1e-9),
    [...new Set(ac.starts.map((s) => s.t.toFixed(3)))].join(","),
  );

  // drive 80s in 0.1s pumps => >2 full AABB cycles (256 steps = 38.4s):
  // seamless wrap now means step k+256 === step k across the WHOLE cycle
  const before = ac.starts.length;
  for (let i = 0; i < 800; i++) {
    ac.currentTime += 0.1;
    a.pump();
  }
  check(
    "long drive keeps start times monotonic",
    ac.starts
      .slice(before)
      .every((s, i, arr) => i === 0 || s.t >= arr[i - 1].t),
  );
  const t0 = ac.starts[0].t,
    S = MUSIC_PATTERN.STEP,
    CYC = 256;
  const buckets = new Map();
  for (const s of ac.starts) {
    const k = Math.round((s.t - t0) / S);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(s.type + ":" + s.f.toFixed(1));
  }
  const sig = (k) => {
    const arr = (buckets.get(k) || []).sort();
    return arr.join("|");
  };
  let wrap = true,
    probe = 0;
  for (let k = 0; k < CYC; k++) {
    if (buckets.has(k) && buckets.has(k + CYC)) {
      probe++;
      if (sig(k) !== sig(k + CYC)) {
        wrap = false;
        break;
      }
    }
  }
  const expected = 2 * occ(MUSIC_PATTERN) + 2 * occ(MUSIC_PATTERN_B);
  check(
    "seamless wrap: step k+256 === step k (full AABB cycle)",
    wrap && probe >= expected - 2,
    "compared " + probe + " of " + expected + " occupied steps",
  );

  // note envelope: v -> 0.0001 ramp over d, stop at t+d+0.03
  const bg = MUSIC_PATTERN.bass[0];
  const st = ac.starts.find((s) => near(s.f, bg.f, 0.001) && s.type === bg.t);
  const gl = st.g.gain._l;
  const setE = gl.find((e) => e[0] === "set"),
    rampE = gl.filter((e) => e[0] === "ramp").pop();
  const stopIdx = ac.stops.findIndex(() => true);
  check(
    "note envelope v->0.0001 over d; stop at t+d+0.03",
    near(setE[1], bg.v) &&
      near(rampE[1], 0.0001) &&
      near(rampE[2] - st.t, bg.d, 1e-9) &&
      ac.stops.some((tp) => near(tp, st.t + bg.d + 0.03, 1e-9)),
  );
}

// ---- mute: single source of truth gates pump AND gain ----
{
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  a.unlock();
  for (let i = 0; i < 10; i++) {
    ac.currentTime += 0.1;
    a.pump();
  }
  const nBefore = ac.starts.length;
  check("toggle() -> false (muted)", a.toggle() === false);
  const gL = ac.starts.length;
  ac.starts.length = 0; // isolate
  const musRamps = [];
  // grab music gain via a fresh emitted note chain is gone (muted) — use duck probe:
  // instead inspect via unlock-built node captured earlier trick: pump a silent frame
  a.pump();
  ac.currentTime += 0.5;
  a.pump();
  check(
    "muted: pump emits NOTHING",
    ac.starts.length === 0,
    String(ac.starts.length) + " was " + gL,
  );
  a.toggle(); // unmute
  ac.currentTime += 0.2;
  a.pump();
  check("unmute resumes scheduling", ac.starts.length > 0);
  check(
    "start budget conserved across mute window (no burst catch-up)",
    Math.abs(ac.starts.length - (nBefore - gL)) < 25,
    ac.starts.length + " vs " + (nBefore - gL),
  );
}

// ---- duck endpoints: 0.5->0.16 @0.35s in, 0.16->0.5 @0.6s out ----
{
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  a.unlock();
  ac.currentTime = 3.0;
  // reach into graph via a scheduled note's gain chain (musicGain is _dst)
  a.pump();
  const mg = ac.starts.length ? ac.starts[0].g._dst : null;
  check("musicGain captured from note chain", !!mg);
  const lastRamp = () => {
    const l = mg.gain._l;
    for (let i = l.length - 1; i >= 0; i--) if (l[i][0] === "ramp") return l[i];
    return null;
  };
  const setCnt = () => mg.gain._l.filter((e) => e[0] === "set").length;
  a.duck(true);
  let r = lastRamp();
  check(
    "duck-in targets 0.16 over 0.35s",
    near(r[1], 0.16) && near(r[2] - ac.currentTime, 0.35),
    JSON.stringify(r),
  );
  const setsAfterFirst = setCnt();
  a.duck(true);
  check(
    "duck idempotent (no duplicate automation)",
    setCnt() === setsAfterFirst && lastRamp()[1] === r[1],
  );
  ac.currentTime = 4.0;
  a.duck(false);
  r = lastRamp();
  check(
    "duck-out restores 0.5 over 0.6s",
    near(r[1], 0.5) && near(r[2] - ac.currentTime, 0.6),
    JSON.stringify(r),
  );

  // mute ramp overrides duck state instantly; unmute returns to DUCKED target
  // (fix round F2: restore must respect ducked=true, else frame-polled
  //  duck(true) in GAME idempotently no-ops and music blasts at full volume)
  a.duck(true);
  a.toggle();
  r = lastRamp();
  check(
    "mute silences loop instantly (0.0001)",
    near(r[1], 0.0001) && near(r[2] - ac.currentTime, 0.01, 0.02),
    JSON.stringify(r),
  );
  a.toggle();
  r = lastRamp();
  check(
    "unmute while ducked restores 0.16 NOT 0.5",
    near(r[1], 0.16) && Math.abs(r[1] - 0.5) > 0.1,
    JSON.stringify(r),
  );
}

// ---- SFX path bypasses musicGain (duck never touches beeps) ----
{
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  a.unlock();
  a.duck(true);
  const nStarts = ac.starts.length;
  a.pump();
  const noteDst = ac.starts.length ? ac.starts[0].g._dst : null;
  ac.starts.length = 0;
  a.play("uiMove"); // immediate layers, no setTimeout
  check(
    "sfx still scheduled while ducked",
    ac.starts.length >= 1 &&
      ac.starts.every((s) => sink(s.g) === ac.destination),
    String(ac.starts.length),
  );
  check(
    "sfx routes direct-to-destination, music via musicGain",
    noteDst && noteDst !== ac.destination,
  );
  check(
    "mute kills jingle but pump-gate unaffected",
    (() => {
      a.toggle();
      const before = ac.starts.length;
      a.play("uiSel"); // muted -> silent
      ac.currentTime += 0.2;
      a.pump(); // muted -> no notes
      return ac.starts.length === before;
    })(),
  );
}

// ---- layered SFX character (arcade mix: distinct bands, reveal speaks) ----
{
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  a.unlock();
  ac.starts.length = 0;
  a.play("boom");
  check(
    "boom is a layered stack",
    ac.starts.length >= 4,
    String(ac.starts.length),
  );
  check(
    "boom includes a noise burst",
    ac.starts.some((s) => s.type === "noise"),
  );
  ac.starts.length = 0;
  a.play("kill");
  const kf = ac.starts.filter((s) => s.type !== "noise").map((s) => s.f);
  ac.starts.length = 0;
  a.play("hurt");
  const hf = ac.starts.filter((s) => s.type !== "noise").map((s) => s.f);
  check(
    "kill rises and hurt falls (no shared 150Hz unison)",
    kf.some((f) => f >= 300) &&
      hf.some((f) => f <= 100) &&
      !kf.includes(150) &&
      !hf.includes(150),
    kf.join(",") + " vs " + hf.join(","),
  );
  ac.starts.length = 0;
  a.play("reveal");
  check(
    "reveal (unbury) now speaks",
    ac.starts.length >= 2,
    String(ac.starts.length),
  );
  let threw = false;
  try {
    [
      "bomb",
      "brick",
      "kick",
      "throw",
      "remote",
      "power",
      "win",
      "lose",
      "uiDenied",
    ].forEach((n) => a.play(n));
  } catch (e) {
    threw = true;
  }
  check("game SFX names no-throw", !threw);
}

// ---- fix round F1: scheduler catch-up clamp (tab-hidden RAF resume) ----
{
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  a.unlock(); // nextT=now+0.05
  ac.currentTime = 9.0; // RAF paused ~9s: clock ran past nextT
  a.pump();
  const ts = [...new Set(ac.starts.map((s) => s.t))];
  check(
    "catch-up clamp: long gap collapses to exactly ONE step",
    ac.starts.length > 0 && ts.length === 1,
    "steps=" +
      ts.length +
      " [" +
      ts
        .slice(0, 4)
        .map((t) => t.toFixed(2))
        .join(",") +
      "...]",
  );
  check(
    "catch-up clamp: step lands at clamped now+0.05 (9.05)",
    ts.length === 1 && near(ts[0], 9.05),
    String(ts[0]),
  );
}

// ---- AABB cycle end-to-end (pump level): B-only bass markers prove the
//        section order A(0-63) A(64-127) B(128-191) B(192-255) wrap(256+) ----
{
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  a.unlock(); // nextT=now+0.05 anchor
  for (let i = 0; i < 520; i++) {
    ac.currentTime += 0.1;
    a.pump();
  } // 52s of 0.1s frames
  // B-exclusive pitches: the F# that only menu's B section sounds (spec 1b —
  // every A section is pure white-key, and the two chromatic guests in the
  // score are menu's F# and sand's G#).
  const isBmark = (f) => FSHARP.some((m) => Math.abs(f - m) < 0.02);
  const covered = Math.floor((520 * 0.1) / MUSIC_PATTERN.STEP);
  check(
    "B-marker drive still reaches past step 320 at the new tempo",
    covered > 330,
    covered + " steps in 52 s at STEP " + MUSIC_PATTERN.STEP,
  );
  const isB = new Set();
  // derive the anchor from the first start: unlock's nextT=now+0.05 may be
  // clamped once if the first pump lags the clock — shift cancels in k-space
  const t0 = ac.starts[0].t,
    S = MUSIC_PATTERN.STEP;
  for (const st of ac.starts)
    if (isBmark(st.f)) isB.add(Math.round((st.t - t0) / S));
  // Derived from the frozen B table rather than transcribed: a dense bass
  // tonicizing G major sounds the leading tone far more than four times, and
  // secIsB asserts BOTH "these steps" and "no others" — deriving the list is
  // what stops those two halves from ever disagreeing.
  const EXP = [
    ...new Set(
      ["bass", "lead", "hat"].flatMap((k) =>
        MUSIC_PATTERN_B[k].filter((n) => isBmark(n.f)).map((n) => n.s),
      ),
    ),
  ].sort((a, b) => a - b);
  const secIsB = (lo) =>
    EXP.every((e) => isB.has(lo + e)) &&
    ![...isB].some((k) => k >= lo && k < lo + 64 && !EXP.includes(k - lo));
  check(
    "AABB: section 1 (steps 0-63) plays A — zero B markers",
    ![...isB].some((k) => k >= 0 && k < 64),
    [...isB].filter((k) => k < 64).join(","),
  );
  check(
    "AABB: section 2 (steps 64-127) plays A again",
    ![...isB].some((k) => k >= 64 && k < 127 && isB.has(k)),
  );
  check(
    "AABB: section 3 (steps 128-191) plays B",
    secIsB(128),
    [...isB]
      .filter((k) => k >= 128 && k < 192)
      .sort((x, y) => x - y)
      .join(","),
  );
  check("AABB: section 4 (steps 192-255) plays B again", secIsB(192));
  check(
    "AABB: cycle wraps — steps 256+ play A again",
    ![...isB].some((k) => k >= 256 && k < 320),
    [...isB].filter((k) => k >= 256).join(","),
  );
}

// ---- per-biome + shell tracks (menu AABB stays the default pump) ----
{
  check(
    "MUSIC_TRACKS frozen with 10 cues",
    Object.isFrozen(MUSIC_TRACKS) &&
      [
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
      ].every((k) => MUSIC_TRACKS[k] && Object.isFrozen(MUSIC_TRACKS[k].A)),
    Object.keys(MUSIC_TRACKS).join(","),
  );
  check(
    "menu track is the AABB identity pair",
    MUSIC_TRACKS.menu.A === MUSIC_PATTERN &&
      MUSIC_TRACKS.menu.B === MUSIC_PATTERN_B &&
      MUSIC_TRACKS.menu.sections === MUSIC_SECTIONS,
  );
  const steps = [
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
  ].map((k) => MUSIC_TRACKS[k].A.STEP);
  check(
    "every track has a distinct tempo",
    new Set(steps).size === 10,
    steps.join(","),
  );
  const roots = [
    "jungle",
    "ice",
    "factory",
    "water",
    "arena",
    "sand",
    "void",
    "crown",
  ].map((k) => MUSIC_TRACKS[k].A.bass[0].f);
  check(
    "biome bass roots all distinct",
    new Set(roots).size === 8,
    roots.join(","),
  );
  check(
    "sand void crown STEP and first bass",
    MUSIC_TRACKS.sand.A.STEP === 0.148 &&
      MUSIC_TRACKS.void.A.STEP === 0.152 &&
      MUSIC_TRACKS.crown.A.STEP === 0.11 &&
      MUSIC_TRACKS.sand.A.bass[0].f === 123.47 &&
      MUSIC_TRACKS.void.A.bass[0].f === 61.74 &&
      MUSIC_TRACKS.crown.A.bass[0].f === 65.41,
  );
  const fin = (a) =>
    a &&
    a.every(
      (n) =>
        ["s", "f", "d", "v"].every(
          (k) => typeof n[k] === "number" && Number.isFinite(n[k]),
        ) && typeof n.t === "string",
    );
  check(
    "all track voices finite {s,f,d,t,v}",
    Object.values(MUSIC_TRACKS).every(
      (tr) => fin(tr.A.bass) && fin(tr.A.lead) && fin(tr.A.hat),
    ),
  );
  check(
    "musicCue INTRO / MENU / subscreens",
    musicCue(SCREEN.INTRO, 1) === "intro" &&
      musicCue(SCREEN.MENU, 3) === "menu" &&
      musicCue(SCREEN.LEVEL, 5) === "menu" &&
      musicCue(SCREEN.HOWTO, 1) === "menu" &&
      musicCue(SCREEN.ITEMS, 1) === "menu" &&
      musicCue(SCREEN.ENEMIES, 1) === "menu" &&
      musicCue(SCREEN.SCORES, 1) === "menu" &&
      musicCue(SCREEN.GUIDE, 1) === "menu",
  );
  check(
    "musicCue GAME follows biome 1..8",
    musicCue(SCREEN.GAME, 1) === "jungle" &&
      musicCue(SCREEN.GAME, 2) === "ice" &&
      musicCue(SCREEN.GAME, 3) === "factory" &&
      musicCue(SCREEN.GAME, 4) === "water" &&
      musicCue(SCREEN.GAME, 5) === "arena" &&
      musicCue(SCREEN.GAME, 6) === "sand" &&
      musicCue(SCREEN.GAME, 7) === "void" &&
      musicCue(SCREEN.GAME, 8) === "crown",
  );
  check(
    "musicCue ATTRACT follows demo level",
    musicCue(SCREEN.ATTRACT, 2) === "ice" &&
      musicCue(SCREEN.ATTRACT, 3) === "factory",
  );
}

{
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  check(
    "headless-safe: cue/track on live instance",
    a.cue(SCREEN.GAME, 5) === "arena" && a.track() === "menu",
  );
  a.unlock();
  ac.starts.length = 0;
  check("setTrack water returns water", a.setTrack("water") === "water");
  a.pump();
  check(
    "water downbeat is G1=49.00, not menu's G2=98.00",
    ac.starts.some((s) => near(s.f, 49, 0.05)) &&
      !ac.starts.some((s) => near(s.f, 98, 0.05)),
    ac.starts
      .slice(0, 6)
      .map((s) => s.f.toFixed(1))
      .join(","),
  );
  check(
    "unknown setTrack is a no-op",
    a.setTrack("nope") === "water" && a.track() === "water",
  );
  ac.starts.length = 0;
  a.setTrack("menu");
  a.pump();
  check(
    "setTrack menu restores the G2 98.00 identity bass",
    ac.starts.some((s) => near(s.f, 98, 0.05)),
    ac.starts
      .slice(0, 6)
      .map((s) => s.f.toFixed(1))
      .join(","),
  );
}

// ---- per-biome boom tints (rooms 6-8; ice/water/arena stay pinned) ----
{
  const boomOf = audioMod.boomOf;
  const sig = (b) =>
    !b
      ? ""
      : [
          b.crack.f0,
          b.crack.vol,
          b.kick.f0,
          b.kick.dur,
          b.kick.vol,
          b.snap.f0,
          b.tail.dur,
          b.tail.f0,
        ].join("|");
  check("boomOf exported", typeof boomOf === "function");
  const def = typeof boomOf === "function" ? boomOf() : null;
  const ice = typeof boomOf === "function" ? boomOf("ice") : null;
  const fact = typeof boomOf === "function" ? boomOf("factory") : null;
  const water = typeof boomOf === "function" ? boomOf("water") : null;
  const arena = typeof boomOf === "function" ? boomOf("arena") : null;
  const sand = typeof boomOf === "function" ? boomOf("sand") : null;
  const vvoid = typeof boomOf === "function" ? boomOf("void") : null;
  const crown = typeof boomOf === "function" ? boomOf("crown") : null;
  check(
    "default / jungle / factory boom are the same stack",
    def &&
      fact === def &&
      boomOf("jungle") === def &&
      def.kick.f0 === 55 &&
      def.kick.dur === 0.48 &&
      def.kick.vol === 0.22 &&
      def.crack.f0 === 4200 &&
      def.crack.vol === 0.16 &&
      def.tail.dur === 0.2,
  );
  check(
    "ice boom only drops crack f0 to 3200",
    ice &&
      ice.crack.f0 === 3200 &&
      ice.kick.f0 === 55 &&
      ice.kick.dur === 0.48 &&
      ice.tail.dur === 0.2 &&
      ice.crack.vol === 0.16,
  );
  check(
    "water boom longer darker kick+tail",
    water &&
      water.kick.f0 === 48 &&
      water.kick.dur === 0.56 &&
      water.kick.vol === 0.22 &&
      water.tail.dur === 0.28 &&
      water.crack.f0 === 4200,
  );
  check(
    "arena boom hotter kick",
    arena &&
      arena.crack.vol === 0.18 &&
      arena.kick.f0 === 62 &&
      arena.kick.vol === 0.25 &&
      arena.kick.dur === 0.48 &&
      arena.tail.dur === 0.2,
  );
  check(
    "menu intro unknown stay on default boom",
    def &&
      boomOf("menu") === def &&
      boomOf("intro") === def &&
      boomOf("nope") === def,
  );
  check(
    "sand void crown boom signatures distinct",
    sand &&
      vvoid &&
      crown &&
      sig(sand) !== sig(def) &&
      sig(vvoid) !== sig(def) &&
      sig(crown) !== sig(def) &&
      sig(sand) !== sig(vvoid) &&
      sig(vvoid) !== sig(crown) &&
      sig(sand) !== sig(crown),
    [sig(sand), sig(vvoid), sig(crown), sig(def)].join(" / "),
  );
  check(
    "sand boom dry dusty kick 69",
    sand &&
      sand.kick.f0 === 69 &&
      sand.kick.dur < def.kick.dur &&
      sand.crack.f0 > def.crack.f0 &&
      sand.crack.q > def.crack.q &&
      sand.tail.dur < def.tail.dur &&
      sand.tail.f0 > def.tail.f0,
  );
  check(
    "void boom swallowed kick 40",
    vvoid &&
      vvoid.kick.f0 === 40 &&
      vvoid.kick.dur > def.kick.dur &&
      vvoid.crack.f0 < def.crack.f0 &&
      vvoid.snap.f0 < def.snap.f0 &&
      vvoid.tail.dur > def.tail.dur &&
      vvoid.tail.f0 < def.tail.f0,
  );
  check(
    "crown boom metallic snap kick 82",
    crown &&
      crown.kick.f0 === 82 &&
      crown.snap.f0 > def.snap.f0 &&
      crown.crack.f0 > def.crack.f0 &&
      crown.tail.dur < def.tail.dur &&
      crown.snap.hp > def.snap.hp,
  );
  check(
    "GAME 6/7/8 cue maps onto sand/void/crown boom",
    boomOf &&
      boomOf(musicCue(SCREEN.GAME, 6)) === sand &&
      boomOf(musicCue(SCREEN.GAME, 7)) === vvoid &&
      boomOf(musicCue(SCREEN.GAME, 8)) === crown &&
      boomOf(musicCue(SCREEN.GAME, 1)) === def &&
      boomOf(musicCue(SCREEN.MENU, 6)) === def,
  );
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  a.unlock();
  const kickOf = (id) => {
    a.setTrack(id);
    ac.starts.length = 0;
    a.play("boom");
    const s = ac.starts.find((x) => x.type === "sine");
    return s ? s.f0 : null;
  };
  const kicks = [
    "jungle",
    "ice",
    "factory",
    "water",
    "arena",
    "sand",
    "void",
    "crown",
    "menu",
    "intro",
  ].map((id) => id + ":" + kickOf(id));
  check(
    "play boom kicks follow table (rooms 1-8 + menu)",
    near(kickOf("jungle"), 55) &&
      near(kickOf("ice"), 55) &&
      near(kickOf("factory"), 55) &&
      near(kickOf("water"), 48) &&
      near(kickOf("arena"), 62) &&
      near(kickOf("sand"), 69) &&
      near(kickOf("void"), 40) &&
      near(kickOf("crown"), 82) &&
      near(kickOf("menu"), 55) &&
      near(kickOf("intro"), 55),
    kicks.join(","),
  );
}

// ---- grep gate: no wall-clock/random in scheduling code (spec §6) ----
{
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL("../src/audio.js", import.meta.url),
    "utf8",
  );
  check("audio.js free of Math.random/Date.", !/Math\.random|Date\./.test(src));
  check("audio.js free of setInterval calls", !/\bsetInterval\s*\(/.test(src));
}

// ---- settings volumes (S1): SFX scales the value, music scales its targets ----
{
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  a.unlock();
  check(
    "setVols reports 1/1 by default and clamps to 0..1",
    JSON.stringify(a.setVols({})) === '{"mus":1,"sfx":1}' &&
      JSON.stringify(a.setVols({ mus: 5, sfx: -2 })) === '{"mus":1,"sfx":0}',
    JSON.stringify(a.setVols({})),
  );
  a.setVols({ mus: 1, sfx: 1 });
  ac.starts.length = 0;
  a.play("uiMove");
  const full = gainNode(ac.starts[0]).gain._l.find((e) => e[0] === "ramp")[1];
  a.setVols({ sfx: 0.5 });
  ac.starts.length = 0;
  a.play("uiMove");
  const half = gainNode(ac.starts[0]).gain._l.find((e) => e[0] === "ramp")[1];
  check("sfxVol 0.5 halves the peak ramp", near(half, full * 0.5), full + " -> " + half);
  check(
    "sfx still routes direct-to-destination at a scaled volume",
    ac.starts.every((s) => sink(s.g) === ac.destination),
    String(ac.starts.length),
  );
  a.setVols({ sfx: 0 });
  ac.starts.length = 0;
  a.play("uiMove");
  a.play("boom");
  check(
    "sfxVol 0 creates no node at all (exponentialRamp to 0 would throw)",
    ac.starts.length === 0,
    String(ac.starts.length),
  );
  a.setVols({ sfx: 1 });
  ac.starts.length = 0;
  a.play("uiMove");
  check("sfxVol back to 1 restores the authored peak", near(gainNode(ac.starts[0]).gain._l.find((e) => e[0] === "ramp")[1], full));
}
{
  const ac = mkAC();
  installAC(ac);
  const a = createAudio();
  a.setVols({ mus: 0.5 });
  a.unlock();
  a.pump();
  const mg = ac.starts.length ? ac.starts[0].g._dst : null;
  check("musicGain init scales with musVol", !!mg && near(mg.gain.value, 0.25), String(mg && mg.gain.value));
  const lastRamp = () => {
    const l = mg.gain._l;
    for (let i = l.length - 1; i >= 0; i--) if (l[i][0] === "ramp") return l[i];
    return null;
  };
  a.duck(true);
  check("duck target scales too (0.16 * 0.5)", near(lastRamp()[1], 0.08), JSON.stringify(lastRamp()));
  a.duck(false);
  check("duck-out restores the scaled base", near(lastRamp()[1], 0.25), JSON.stringify(lastRamp()));
  a.setVols({ mus: 0 });
  check("musVol 0 floors at MUS_FLOOR, never a literal 0", near(lastRamp()[1], 0.0001), JSON.stringify(lastRamp()));
  a.setVols({ mus: 1 });
  check(
    "musVol 1 is byte-identical to today's MUS_BASE",
    near(lastRamp()[1], 0.5),
    JSON.stringify(lastRamp()),
  );
  a.toggle();
  check("mute still wins over any musVol", near(lastRamp()[1], 0.0001), JSON.stringify(lastRamp()));
  a.toggle();
  check("unmute returns to the scaled base", near(lastRamp()[1], 0.5), JSON.stringify(lastRamp()));
}

// ---- R3a seam: injectable ctx + bulk bounce scheduler ----
{
  delete globalThis.window;
  const ac = mkAC();
  const a = createAudio({ ctx: ac });
  check(
    "createAudio({ctx}) unlocks with no window at all",
    a.unlock() === true && a.unlocked() === true,
  );
  check(
    "bounceTrack is on the returned object",
    typeof a.bounceTrack === "function",
  );
  ac.starts.length = 0;
  const S = MUSIC_TRACKS.jungle.A.STEP;
  const n = a.bounceTrack("jungle", 6);
  check(
    "bounceTrack returns the step count it scheduled",
    n >= Math.floor(6 / S) && n <= Math.ceil(6 / S) + 1,
    n,
  );
  check(
    "bounce anchors at t=0 and never runs past `seconds`",
    ac.starts.length > 0 &&
      ac.starts.every((s) => s.t >= 0 && s.t < 6) &&
      ac.starts.some((s) => near(s.t, 0, 1e-9)),
    ac.starts.length,
  );
  check(
    "bounceTrack restores curId — the live track is untouched",
    a.track() === "menu",
    a.track(),
  );
  check(
    "bounceTrack is a no-op before unlock (no ctx, no musicGain)",
    createAudio().bounceTrack("menu", 4) === 0,
  );
  check(
    "unknown id bounces the current track, never throws",
    a.bounceTrack("nope", 2) > 0 && a.track() === "menu",
  );
}

// ---- R3a: bounceTrack schedules exactly what pump() schedules ----
{
  const live = mkAC();
  installAC(live);
  const a1 = createAudio();
  a1.unlock();
  a1.setTrack("jungle");
  for (let i = 0; i < 60; i++) {
    live.currentTime += 0.1;
    a1.pump();
  }
  const off = mkAC();
  const a2 = createAudio({ ctx: off });
  a2.unlock();
  a2.bounceTrack("jungle", 6);
  const S = MUSIC_TRACKS.jungle.A.STEP;
  const trace = (ac) => {
    const t0 = ac.starts[0].t;
    return ac.starts.map((s) =>
      [
        Math.round((s.t - t0) / S),
        s.f.toFixed(2),
        s.type,
        s.g.gain._l[0][1].toFixed(4),
      ].join(":"),
    );
  };
  const L = trace(live),
    O = trace(off),
    K = 40;
  check(
    "bounce trace === pump trace (same patOf/emitStep/note, anchor removed)",
    L.length >= K &&
      O.length >= K &&
      L.slice(0, K).join(",") === O.slice(0, K).join(","),
    L.slice(0, 3).join(",") + "  vs  " + O.slice(0, 3).join(","),
  );
}

// ---- R3a: the v? tuple is legal to author and authored nowhere yet ----
{
  const chans = [];
  for (const id of Object.keys(MUSIC_TRACKS)) {
    const tr = MUSIC_TRACKS[id];
    for (const sec of ["A", "B"]) {
      const P = tr[sec];
      if (!P) continue;
      for (const k of ["bass", "lead", "hat", "pad"])
        if (P[k] && P[k].length) chans.push([id + "." + sec + "." + k, P[k]]);
    }
  }
  /* The [s,f,d,v?] tuple stays legal and stays scarce. It was v2's main
     maturity lever; v3 spells accent as a PITCH choice wherever it can, so the
     list shrinks as each track is recomposed and the remaining names are the
     ones still carrying v2 data. */
  const STEPPED = [];
  const spread = chans.filter(([, a]) => new Set(a.map((n) => n.v)).size !== 1);
  check(
    "per-note velocity is authored only where the spec asks for it",
    chans.length > 30 && spread.every(([n]) => STEPPED.includes(n)),
    spread.map(([n]) => n).join(","),
  );
}

// ---- R3b helpers: proved against synthetic channels, not track data ----
{
  const mk = (l) => l.map(([s, f]) => ({ s, f, d: 1, t: "square", v: 0.1 }));
  /* D4, the retired figure's own key — deliberately a literal and not
     TONIC.menu, so these helper proofs stay decoupled from any track's key. */
  const D = 293.66;
  const plain = mk([
    [0, 293.66],
    [1, 349.23],
    [2, 440.0],
    [3, 493.88],
    [5, 440.0],
  ]);
  const v1rhythm = mk([
    [0, 293.66],
    [1, 349.23],
    [2, 440.0],
    [3, 493.88],
    [6, 440.0],
  ]);
  check("motifV2At matches PLAIN on the tonic", motifV2At(plain, 0, D));
  check(
    "motifV2At is octave-blind — pitch class, not absolute Hz",
    motifV2At(
      mk([
        [0, 587.32],
        [1, 698.46],
        [2, 880.0],
        [3, 987.77],
        [5, 880.0],
      ]),
      0,
      D,
    ),
  );
  check(
    "motifV2At rejects a wrong flash note — only 6 (8 or 9 semitones) will do",
    !motifV2At(
      mk([
        [0, 293.66],
        [1, 349.23],
        [2, 440.0],
        [3, 392.0],
        [5, 440.0],
      ]),
      0,
      D,
    ),
  );
  check(
    "fragMidAt is tonic-relative: 3-5-6 with no tonic under it",
    fragMidAt(
      mk([
        [1, 349.23],
        [2, 440.0],
        [3, 493.88],
      ]),
      0,
      D,
    ) &&
      !fragMidAt(
        mk([
          [1, 293.66],
          [2, 349.23],
          [3, 440.0],
        ]),
        0,
        D,
      ),
  );
  const P = {
    LEN: 16,
    STEP: 0.1,
    bass: mk([
      [0, 73.42],
      [3, 73.42],
    ]),
    lead: mk([
      [0, 293.66],
      [2, 349.23],
    ]),
    hat: mk([[2, 4800]]),
  };
  check(
    "motifV2At wants the settle at step 5 — the v1 rhythm does not satisfy it",
    !motifV2At(v1rhythm, 0, D),
  );
  check(
    "motifV2At is positional — the same figure one bar later reads as bar 1",
    motifV2Head(
      mk([
        [8, 293.66],
        [9, 349.23],
        [10, 440.0],
        [11, 493.88],
        [13, 440.0],
      ]),
      D,
      64,
    ) === 8,
  );
  const gapP = (bass, hat, LEN) => ({
    LEN,
    bass: mk(bass),
    hat: mk(hat),
    lead: [],
  });
  check(
    "pulseGap: an 8th hat over an 8th bass leaves single-step pockets",
    pulseGap(gapP([[0, 55]], [[2, 4800]], 4)) === 1,
    pulseGap(gapP([[0, 55]], [[2, 4800]], 4)),
  );
  check(
    "pulseGap wraps around the loop and keys off LEN, not a literal 64",
    pulseGap(gapP([[0, 55]], [], 4)) === 3 &&
      pulseGap(gapP([[1, 55]], [], 32)) === 31 &&
      pulseGap(gapP([], [], 16)) === 16,
    [
      pulseGap(gapP([[0, 55]], [], 4)),
      pulseGap(gapP([[1, 55]], [], 32)),
      pulseGap(gapP([], [], 16)),
    ].join(","),
  );
  check(
    "barsWithLead / barsWithBass count 8-step bars that carry the channel",
    barsWithLead(P) === 1 && barsWithBass(P) === 1,
    barsWithLead(P) + "/" + barsWithBass(P),
  );
  check("occ counts distinct occupied steps across channels", occ(P) === 3, occ(P));
  check("lanes: max bass < min lead", lanes(P));
  check("waves counts distinct channel timbres", waves(P) === 1, waves(P));
  check(
    "soundsDeg reads bass/lead/pad and ignores the hat",
    soundsDeg(P, D, 3) === true &&
      soundsDeg(P, D, 1) === false &&
      soundsDeg({ bass: [], lead: [], hat: mk([[0, 349.23]]) }, D, 3) === false,
  );
}

// ---- intro: the cabinet powering up (D Dorian, PLAIN over the full band) ----
{
  const T = MUSIC_TRACKS.intro,
    A = T.A,
    f0 = TONIC.intro;
  check(
    "intro STEP 0.125 (120 BPM), LEN 32, sections [A], no B at all",
    A.STEP === 0.125 &&
      A.LEN === 32 &&
      JSON.stringify(T.sections) === '["A"]' &&
      T.B === null,
    A.STEP + "/" + A.LEN + "/" + JSON.stringify(T.sections),
  );
  check(
    "intro bass states the TONIC D2 from step 0 in straight eighths",
    A.bass.length === 16 &&
      A.bass[0].s === 0 &&
      A.bass[0].f === 73.42 &&
      A.bass.every((n) => n.s % 2 === 0),
    A.bass.length + " @" + A.bass[0].s + "/" + A.bass[0].f,
  );
  check(
    "intro bass alternates root and octave — D2 73.42 against D3 146.83",
    A.bass.filter((n) => n.s % 4 === 0).every((n) => n.f === 73.42 || n.f === 55) &&
      A.bass
        .filter((n) => n.s % 4 === 2)
        .every((n) => n.f === 146.83 || n.f === 110),
    [...new Set(A.bass.map((n) => n.f))].join(","),
  );
  check(
    "intro hat drives from the first bar — 15 odd-step ticks, not an empty array",
    A.hat.length === 15 && A.hat.every((n) => n.s % 2 === 1),
    A.hat.length,
  );
  check(
    "intro bar 1 is the whole band — the motif arrives harmonized",
    A.lead.some((n) => n.s < 8) &&
      A.bass.some((n) => n.s < 8) &&
      A.hat.some((n) => n.s < 8) &&
      (A.pad || []).some((n) => n.s < 8),
  );
  check("intro states PLAIN on D4 at bar 0", motifV2At(A.lead, 0, f0));
  const lo = Math.min(...A.lead.filter((n) => n.s < 8).map((n) => n.f)),
    hi = Math.min(
      ...A.lead.filter((n) => n.s >= 16 && n.s < 24).map((n) => n.f),
    );
  check(
    "intro restates the motif an octave up at bar 2, and no bar is lead-free",
    motifV2At(A.lead, 16, f0) &&
      Math.abs(semi(hi, lo) - 12) <= 0.05 &&
      barsWithLead(A) === 4,
    lo + " -> " + hi + " / " + barsWithLead(A) + " bars",
  );
  check(
    "intro pulse never gaps — bass and hat interlock across all 32 steps",
    pulseGap(A) <= 1 && barsWithBass(A) === 4,
    pulseGap(A) + "/" + barsWithBass(A),
  );
  check(
    "intro pad is two 16-step drones, D3 then A2",
    A.pad &&
      A.pad.length === 2 &&
      A.pad[0].s === 0 &&
      A.pad[1].s === 16 &&
      near(A.pad[0].f, 146.83, 0.01) &&
      near(A.pad[1].f, 110.0, 0.01) &&
      A.pad.every((n) => Math.round(n.d / A.STEP) === 16),
    JSON.stringify((A.pad || []).map((n) => [n.s, n.f])),
  );
  check(
    "intro is dense but not solid: 28-31 of its 32 steps",
    occ(A) >= 28 && occ(A) <= 31,
    occ(A),
  );
  check("intro register lanes never cross", lanes(A));
}

// ---- menu: friendly, memorable, medium (G major hexatonic — the v3 baseline) ----
{
  const A = MUSIC_PATTERN,
    B = MUSIC_PATTERN_B,
    f0 = TONIC.menu;
  check(
    "menu STEP 0.137 -> 109.5 BPM, inside the v3 96-120 band",
    A.STEP === 0.137 && 15 / A.STEP >= 96 && 15 / A.STEP <= 120,
    (15 / A.STEP).toFixed(1) + " BPM",
  );
  /* Three voices, all soft, and the hat is SINE: the hat is the highest and
     most-struck channel in any pattern, which makes it the worst possible home
     for the one waveform the direction calls harsh. sine buys waves >= 2 at
     zero harshness cost, and nothing in the suite reads hat timbre. */
  check(
    "menu is three soft voices: triangle bass, triangle lead, sine hat, no pad",
    A.bass[0].t === "triangle" &&
      A.lead[0].t === "triangle" &&
      A.hat[0].t === "sine" &&
      A.pad === undefined,
    chansOf(A)
      .map((a) => a[0].t)
      .join(","),
  );
  /* menu's OWN hook, not the retired five-note figure: 1-3-5-6 rising on the
     four even steps of a bar. Positional, at the two bars the spec names. */
  const head = (chan, s0) =>
    figureAt(chan, s0, f0, [0, 2, 4, 6], [DEG1, DEG3, DEG5, DEG6]);
  check(
    "menu's hook is the rising head 1-3-5-6 on steps 0/2/4/6, at bars 0 and 4",
    head(A.lead, 0) && head(A.lead, 32),
  );
  check(
    "the bar-4 restatement is the same head an octave up",
    Math.abs(
      semi(A.lead.find((n) => n.s === 32).f, A.lead.find((n) => n.s === 0).f) -
        12,
    ) <= 0.05,
    A.lead.find((n) => n.s === 0).f + " -> " + A.lead.find((n) => n.s === 32).f,
  );
  check(
    "menu's lead is eighths, and its only sixteenths are the three turn pairs",
    A.lead.every((n) => Math.round(n.d / A.STEP) <= 2) &&
      A.lead
        .filter((n) => Math.round(n.d / A.STEP) === 1)
        .map((n) => n.s)
        .join(",") === "14,15,30,31,46,47",
    [...new Set(A.lead.map((n) => Math.round(n.d / A.STEP)))].sort().join(","),
  );
  check(
    "menu A is MEDIUM, not dense: 32-44 of 64 steps",
    occ(A) >= 32 && occ(A) <= 44 && occ(B) >= 38 && occ(B) <= 50,
    occ(A) + "/" + occ(B),
  );
  check("menu register lanes never cross, A and B", lanes(A) && lanes(B));
  check("menu B is hand-authored — its hat is not A's array", B.hat !== A.hat);
  /* B is a real second piece of writing, not a pitch shift: it lifts to the
     dominant-side D major pentatonic, and it re-cuts the bass accent from
     0/2/4/6 to 0/3/4/6 so the walk leans where A strolls. Note count, timbres,
     v set and the hat skeleton are untouched — that is what keeps A and B
     interleavable as one loop — so the difference is pinned as a DIFFERENCE. */
  check(
    "menu B is not a rhythmic copy of A — its bass accents fall elsewhere",
    stepSet(A.bass) !== stepSet(B.bass) &&
      B.bass.length === A.bass.length &&
      JSON.stringify(A.hat.map((n) => n.s)) ===
        JSON.stringify(B.hat.map((n) => n.s)),
    stepSet(A.bass) + " vs " + stepSet(B.bass),
  );
}

// ---- arena: aggressive, combat-ready (A Aeolian, ANTIC) ----
{
  const T = MUSIC_TRACKS.arena,
    A = T.A,
    B = T.B,
    f0 = TONIC.arena;
  check(
    "arena STEP 0.107 (140 BPM), A1 55.00 root",
    A.STEP === 0.107 && A.bass[0].f === 55,
    A.STEP + "/" + A.bass[0].f,
  );
  check(
    "arena is the one track with all four channels dense",
    A.bass.length > 0 &&
      A.lead.length > 0 &&
      A.hat.length > 0 &&
      !!A.pad &&
      A.pad.length > 0,
    chansOf(A).length,
  );
  check(
    "arena timbres: square bass, square lead, triangle hat, sawtooth pad",
    A.bass[0].t === "square" &&
      A.lead[0].t === "square" &&
      A.hat[0].t === "triangle" &&
      A.pad[0].t === "sawtooth",
    chansOf(A)
      .map((a) => a[0].t)
      .join(","),
  );
  check(
    "arena hat is straight — every hit on an even step",
    A.hat.every((n) => n.s % 2 === 0),
    A.hat.length,
  );
  check(
    "arena ANTIC: the v2 figure one step early — head at 15, settle at 20",
    motifV2At(A.lead, 15, f0),
    motifV2Head(A.lead, f0, 64),
  );
  check(
    "arena stabs on the and of 2 and 4 (lead notes at 3 and 7 mod 8)",
    A.lead.some((n) => n.s % 8 === 3) && A.lead.some((n) => n.s % 8 === 7),
  );
  check("arena B is hand-authored — its hat is not A's array", B.hat !== A.hat);
  /* The reference track's one v2 correction: bar 8 was a full-band stop — the
     whole rhythm section out for eight steps, which the offline render measured
     as 0.92 s under -50 dB, four times per bounce. Every voice now plays it. */
  check(
    "arena plays all eight bars — the full-band stop at bar 8 is gone",
    barsWithLead(A) === 8 &&
      barsWithBass(A) === 8 &&
      barsWithLead(B) === 8 &&
      barsWithBass(B) === 8,
    barsWithLead(A) + "/" + barsWithBass(A) + " " + barsWithLead(B) + "/" + barsWithBass(B),
  );
  check(
    "arena pulse never gaps, in BOTH hand-authored sections",
    pulseGap(A) <= 1 && pulseGap(B) <= 1,
    pulseGap(A) + "/" + pulseGap(B),
  );
  check(
    "arena is dense but not solid: 56-62 of 64 steps, A and B alike",
    occ(A) >= 56 && occ(A) <= 62 && occ(B) >= 56 && occ(B) <= 62,
    occ(A) + "/" + occ(B),
  );
  check("arena register lanes never cross, A and B", lanes(A) && lanes(B));
}

// ---- void: spacious, mysterious, pleasant (B minor pentatonic, sine lead) ----
{
  const T = MUSIC_TRACKS.void,
    A = T.A,
    B = T.B,
    KA = V3KEY["void.A"],
    KB = V3KEY["void.B"];
  check(
    "void STEP 0.152 -> 98.7 BPM, B1 61.74 — the slowest of the ten, in band",
    A.STEP === 0.152 &&
      A.bass[0].f === 61.74 &&
      15 / A.STEP >= 96 &&
      15 / A.STEP <= 120,
    A.STEP + " -> " + (15 / A.STEP).toFixed(1) + " BPM",
  );
  check(
    "void is still the only sine lead in the score — its identity marker",
    A.lead.every((n) => n.t === "sine") && B.lead.every((n) => n.t === "sine"),
    A.lead[0].t,
  );
  /* v2 bought dread with mode and timbre at 104 BPM. v3's brief is MYSTERY, and
     the levers are different: minor pentatonic has neither a tritone nor a
     semitone, nothing sits below 55 Hz, and this is the quietest track in the
     game by channel-peak sum. None of that is a rest — void is spacious, not
     silent, and its bass still rings through every step of the loop. */
  check(
    "void is the quietest track in the game: channel peaks sum to 0.132",
    near(peakSum(A), 0.132, 1e-9) && near(peakSum(B), 0.132, 1e-9),
    peakSum(A).toFixed(3) + "/" + peakSum(B).toFixed(3),
  );
  check(
    "void bass is half-time root-octave on 0 and 4, each ringing four steps",
    A.bass.length === 16 &&
      stepSet(A.bass) === "0,4" &&
      A.bass.every((n) => Math.round(n.d / A.STEP) === 4) &&
      [0, 1, 2, 3, 4, 5, 6, 7].every((b) => {
        const r = (A.bass.find((n) => n.s === b * 8) || { f: 0 }).f,
          o = (A.bass.find((n) => n.s === b * 8 + 4) || { f: 0 }).f;
        return r > 0 && Math.abs(semi(o, r) - 12) <= 0.05;
      }),
    A.bass.length + ":" + stepSet(A.bass),
  );
  check(
    "void hat is the softest tick in the score — 2400 Hz at v 0.010, on 2 and 6",
    A.hat.length === 16 &&
      A.hat.every(
        (n) => [2, 6].includes(n.s % 8) && n.f === 2400 && n.v === 0.01,
      ),
    A.hat.length + ":" + stepSet(A.hat),
  );
  /* void's OWN hook, and the one that has to carry the melodic weight here: the
     score-wide "the retired motif is gone" pin is TRIVIALLY true on this track
     (minor pentatonic has no 6th degree, so the detector can never fire
     whatever void plays), so the melody is pinned as a gesture in COLLECTION
     steps rather than in semitones — idx, idx-1, idx-2 reads as the same
     falling shape started from any degree, which is exactly what it is. */
  const fall3 = (P, K, s0) => {
    const ns = [0, 3, 5].map((o) => P.lead.find((n) => n.s === s0 + o));
    if (ns.some((n) => !n)) return false;
    const i = ns.map((n) => degIdx(n.f, K.f0, K.set));
    return (
      i.every((x) => x != null) && i[1] === i[0] - 1 && i[2] === i[0] - 2
    );
  };
  check(
    "void's hook is three adjacent collection steps FALLING, on 0/3/5",
    [0, 16, 32, 48].every((s0) => fall3(A, KA, s0)),
    [0, 16, 32, 48].map((s0) => (fall3(A, KA, s0) ? "y" : "n")).join(""),
  );
  check(
    "void's odd bars fall, its even bars answer with two held notes",
    [8, 24, 40, 56].every(
      (s0) => A.lead.filter((n) => n.s >= s0 && n.s < s0 + 8).length === 2,
    ),
  );
  check(
    "void's lead is the sparsest in the score: 20 notes, none under two steps",
    A.lead.length === 20 &&
      B.lead.length === 20 &&
      A.lead.every((n) => Math.round(n.d / A.STEP) >= 2),
    A.lead.length + " notes",
  );
  check(
    "void is SPACIOUS, not empty: 34-46 of 64 steps, A and B alike",
    occ(A) >= 34 && occ(A) <= 46 && occ(B) >= 34 && occ(B) <= 46,
    occ(A) + "/" + occ(B),
  );
  /* v2 pinned void's identity as "the sparsest of the ten by rhythm-section
     density" — bass+hat striking fewer steps than anyone else's. That claim
     does NOT survive v3: the spec gives water and sand no hat at all, so their
     rhythm sections are bass onsets only and will read sparser than void's 32
     the moment wave 2 lands — and the failure would name *water* while the
     disagreement is void's. Retired here rather than left as a wave-2 trap.
     What actually distinguishes void under v3 is that it is the QUIETEST track
     in the game, and that is pinned as a comparison rather than as a ceiling so
     it survives a composer making the track denser. */
  const others = Object.keys(MUSIC_TRACKS).filter((k) => k !== "void");
  check(
    "void is quieter than every other track — a comparison, not a ceiling",
    others.every((k) => peakSum(MUSIC_TRACKS[k].A) > peakSum(A)),
    peakSum(A).toFixed(3) +
      " vs " +
      others.map((k) => k + ":" + peakSum(MUSIC_TRACKS[k].A).toFixed(3)).join(" "),
  );
  check(
    "void B drops to E minor pentatonic and re-cuts the bed to 0/5 and 3/7",
    B.hat !== A.hat &&
      stepSet(B.bass) === "0,5" &&
      stepSet(B.hat) === "3,7" &&
      B.bass.every(
        (n) => Math.round(n.d / B.STEP) === (n.s % 8 === 0 ? 5 : 3),
      ),
    stepSet(B.bass) + " / " + stepSet(B.hat),
  );
  check(
    "void B swaps the roles — its EVEN bars carry the falling hook",
    [8, 24, 40, 56].every((s0) => fall3(B, KB, s0)) &&
      [0, 16, 32, 48].every(
        (s0) => B.lead.filter((n) => n.s >= s0 && n.s < s0 + 8).length === 2,
      ),
    [8, 24, 40, 56].map((s0) => (fall3(B, KB, s0) ? "y" : "n")).join(""),
  );
  check("void register lanes never cross, A and B", lanes(A) && lanes(B));
}
{
  check(
    "R3c pre-move: water root is G1 49.00, distinct from void's 61.74",
    MUSIC_TRACKS.water.A.bass[0].f === 49,
    MUSIC_TRACKS.water.A.bass[0].f,
  );
}

// ---- crown: finale gold (C Ionian, RESOLVED — the only pure major) ----
{
  const T = MUSIC_TRACKS.crown,
    A = T.A,
    B = T.B,
    f0 = TONIC.crown;
  check(
    "crown STEP 0.110 (136 BPM), C2 65.41 root",
    A.STEP === 0.11 && A.bass[0].f === 65.41,
    A.STEP + "/" + A.bass[0].f,
  );
  check(
    "crown bass is a dotted fanfare root-fifth-octave in all eight bars",
    A.bass.length === 32 &&
      A.bass.every((n) => [0, 3, 4, 6].includes(n.s % 8)) &&
      barsWithBass(A) === 8 &&
      A.bass.filter((n) => n.s % 8 === 0).every((n) => Math.round(n.d / A.STEP) === 3),
    A.bass.length + ":" + [...new Set(A.bass.map((n) => n.s % 8))].sort().join(","),
  );
  check(
    "crown A's own hat is the offbeat — 1/5/7, never the even-step quote",
    A.hat.length === 24 &&
      A.hat.every((n) => [1, 5, 7].includes(n.s % 8)) &&
      JSON.stringify(A.hat.map((n) => n.s)) !==
        JSON.stringify(B.hat.map((n) => n.s)),
    A.hat.length + ":" + [...new Set(A.hat.map((n) => n.s % 8))].sort().join(","),
  );
  check(
    "crown timbres: square bass, square lead, triangle hat, sawtooth pad",
    A.bass[0].t === "square" &&
      A.lead[0].t === "square" &&
      A.hat[0].t === "triangle" &&
      !!A.pad &&
      A.pad[0].t === "sawtooth",
    chansOf(A)
      .map((a) => a[0].t)
      .join(","),
  );
  check(
    "crown B's hat quotes arena A's step pattern verbatim — the victory lap",
    JSON.stringify(B.hat.map((n) => n.s)) ===
      JSON.stringify(MUSIC_TRACKS.arena.A.hat.map((n) => n.s)) &&
      B.hat !== A.hat,
    B.hat.length + " vs arena " + MUSIC_TRACKS.arena.A.hat.length,
  );
  /* RESOLVED (spec 1) = the v2 PLAIN plus a sixth note, the tonic one octave
     above the head, at offset 7. v2 states it in BOTH sections and twice in A:
     the finale supplies its own payoff rather than withholding it until B. */
  const resolvedAt = (P, s0) => {
    if (!motifV2At(P.lead, s0, f0)) return false;
    const headF = P.lead.find((n) => n.s === s0).f;
    const tail = P.lead.filter((n) => n.s === s0 + 7);
    return (
      tail.length === 1 &&
      Math.abs(semi(tail[0].f, headF) - 12) <= 0.05 &&
      Math.round(tail[0].d / P.STEP) >= 2
    );
  };
  check(
    "crown A states RESOLVED at bars 0 and 4 — the tonic octave, twice a pass",
    resolvedAt(A, 0) && resolvedAt(A, 32),
    motifV2Head(A.lead, f0, 64),
  );
  check(
    "crown B states RESOLVED too — the tonic VOID withheld, an octave up",
    resolvedAt(B, 0),
    motifV2Head(B.lead, f0, 64),
  );
  check(
    "crown.A sounds a perfect fourth AND a leading tone — the Ionian pair",
    soundsDeg(A, f0, 5) && soundsDeg(A, f0, 11),
  );
  const dbl = (A.pad || []).filter((p) =>
    A.lead.some((l) => l.s === p.s && Math.abs(semi(p.f, l.f) - 12) <= 0.05),
  );
  check(
    "crown pad doubles the lead an octave up for brass weight (>= 8 shared steps)",
    dbl.length >= 8,
    dbl.length,
  );
  check(
    "crown plays all eight bars — the bar-4 full-band stop is gone",
    barsWithLead(A) === 8 &&
      barsWithBass(A) === 8 &&
      barsWithLead(B) === 8 &&
      barsWithBass(B) === 8,
    barsWithLead(A) + "/" + barsWithBass(A) + " " + barsWithLead(B) + "/" + barsWithBass(B),
  );
  check(
    "crown pulse never gaps, in BOTH hand-authored sections",
    pulseGap(A) <= 1 && pulseGap(B) <= 1,
    pulseGap(A) + "/" + pulseGap(B),
  );
  check(
    "crown is full but not solid: 58-63 of 64 steps, A and B alike",
    occ(A) >= 58 && occ(A) <= 63 && occ(B) >= 58 && occ(B) <= 63,
    occ(A) + "/" + occ(B),
  );
  check("crown register lanes never cross, A and B", lanes(A) && lanes(B));
}
{
  check(
    "R3c pre-move: factory root is E2 82.41 now that crown has taken 65.41",
    MUSIC_TRACKS.factory.A.bass[0].f === 82.41,
    MUSIC_TRACKS.factory.A.bass[0].f,
  );
}

// ---- R3b cross-track: staging, timbre scarcity, and the wave-1 sweep ----
{
  /* jungle joined HAND with its v3 rewrite: a transposed B shares A's hat array
     by identity and therefore cannot re-cut a rhythm, which is exactly the
     sameness v3 exists to remove. ice/factory/water/sand follow on wave 2. */
  const HAND = ["menu", "jungle", "arena", "void", "crown", "water", "sand"];
  const TRANSP = ["ice", "factory"];
  check(
    "hand-authored B: each of these owns a distinct hat array",
    HAND.every((k) => MUSIC_TRACKS[k].B.hat !== MUSIC_TRACKS[k].A.hat),
    HAND.filter((k) => MUSIC_TRACKS[k].B.hat === MUSIC_TRACKS[k].A.hat).join(","),
  );
  check(
    "transp B: the remaining biomes still share A's hat array by identity",
    TRANSP.every((k) => MUSIC_TRACKS[k].B.hat === MUSIC_TRACKS[k].A.hat),
    TRANSP.filter((k) => MUSIC_TRACKS[k].B.hat !== MUSIC_TRACKS[k].A.hat).join(","),
  );
  const sineLead = Object.keys(MUSIC_TRACKS).filter(
    (k) => MUSIC_TRACKS[k].A.lead[0].t === "sine",
  );
  check(
    "exactly one sine lead in the whole score, and it is VOID",
    sineLead.length === 1 && sineLead[0] === "void",
    sineLead.join(","),
  );
  /* Direction v2's sweep, now SHRINKING one id per commit as v3 composes them
     (it grew one id per commit through waves A and B). Every clause is a floor
     on MOTION and a v3 track cannot honestly satisfy them — a spacious room is
     allowed to be spacious — so they are quantified over the ids still carrying
     v2 data rather than deleted, and the v3 block at the foot of this file
     carries the facts that replace them. */
  const ALL = V2ONLY;
  check(
    "v2, not-yet-composed ids: the rhythm section never leaves two steps unstruck",
    ALL.every((k) => pulseGap(MUSIC_TRACKS[k].A) <= 1),
    ALL.map((k) => k + ":" + pulseGap(MUSIC_TRACKS[k].A)).join(" "),
  );
  /* B sections count too — A-A-B-B is what a listener actually hears, and
     three of the four hand-authored Bs carried a silent bar of their own that
     no A-side pin could see. */
  check(
    "v2, not-yet-composed ids: every B section holds the pulse as well as its A",
    ALL.every((k) => !MUSIC_TRACKS[k].B || pulseGap(MUSIC_TRACKS[k].B) <= 1),
    ALL.filter((k) => MUSIC_TRACKS[k].B && pulseGap(MUSIC_TRACKS[k].B) > 1).join(","),
  );
  check(
    "v2, not-yet-composed ids: every bar carries lead AND bass",
    ALL.every((k) => {
      const A = MUSIC_TRACKS[k].A,
        b = A.LEN / 8;
      return barsWithLead(A) === b && barsWithBass(A) === b;
    }),
    ALL.map(
      (k) =>
        k +
        ":" +
        barsWithLead(MUSIC_TRACKS[k].A) +
        "/" +
        barsWithBass(MUSIC_TRACKS[k].A),
    ).join(" "),
  );
  check(
    "v2, not-yet-composed ids: dense but never solid, and at least two waveforms",
    ALL.every(
      (k) =>
        occ(MUSIC_TRACKS[k].A) < MUSIC_TRACKS[k].A.LEN &&
        lanes(MUSIC_TRACKS[k].A) &&
        waves(MUSIC_TRACKS[k].A) >= 2,
    ),
    ALL.map(
      (k) =>
        k +
        ":" +
        occ(MUSIC_TRACKS[k].A) +
        "/" +
        MUSIC_TRACKS[k].A.LEN +
        " w" +
        waves(MUSIC_TRACKS[k].A),
    ).join(" "),
  );
  /* Hook presence, positional on every track — the whole point of one motif in
     eight rotations is that the tune is the same tune everywhere. factory
     states it in the BASS (the canon's first voice) and arena one step early
     (ANTIC at 15); everyone else states it in the lead on a downbeat. Counting
     matches anywhere would be satisfiable by a scale run, so each is named. */
  const HOOK = {
    intro: ["lead", 0],
    menu: ["lead", 0],
    jungle: ["lead", 0],
    ice: ["lead", 0],
    factory: ["bass", 0],
    water: ["lead", 0],
    arena: ["lead", 15],
    sand: ["lead", 0],
    void: ["lead", 0],
    crown: ["lead", 0],
  };
  check(
    "v2, not-yet-composed ids: every track states the motif where the spec puts it",
    ALL.every((k) => {
      const [ch, at] = HOOK[k];
      return motifV2At(MUSIC_TRACKS[k].A[ch], at, TONIC[k]);
    }),
    ALL.filter((k) => {
      const [ch, at] = HOOK[k];
      return !motifV2At(MUSIC_TRACKS[k].A[ch], at, TONIC[k]);
    }).join(","),
  );
  /* And it comes back inside one pass: nine of the ten state it a SECOND time,
     at a position that is not the one the HOOK table just checked. intro is 32
     steps long and restates at its own bar 3; factory answers in the lead 8
     steps later; everyone else restates at the loop's midpoint. ARENA is
     excluded by name rather than by re-checking step 15 — its anticipation
     head is stated once by design, and asserting the same step twice would
     read green while testing nothing. */
  const RETURN = {
    intro: 16,
    menu: 32,
    jungle: 32,
    ice: 32,
    factory: 8,
    water: 32,
    sand: 32,
    void: 32,
    crown: 32,
  };
  /* RET is V2ONLY minus arena, whose anticipation head is stated once by
     design. The count clause is written against the FILTERED list, not against
     V2ONLY.length - 1: once wave 3 composes arena (it goes first there, so
     crown's hat quotation lands on the v3 arena) arena leaves V2ONLY and the
     "- 1" would want a subtraction that no longer applies, reading red with an
     empty detail string. */
  const RET = Object.keys(RETURN).filter((k) => V2ONLY.includes(k));
  check(
    "v2, not-yet-composed ids bar arena: the hook returns inside a single pass",
    RET.every((k) => motifV2At(MUSIC_TRACKS[k].A.lead, RETURN[k], TONIC[k])) &&
      !RET.includes("arena") &&
      RET.length === V2ONLY.filter((k) => k !== "arena").length,
    RET.filter((k) => !motifV2At(MUSIC_TRACKS[k].A.lead, RETURN[k], TONIC[k]))
      .join(","),
  );

}

// ---- ice: brittle, echoing (F Lydian, AUG — register separation is the idea) ----
{
  const T = MUSIC_TRACKS.ice,
    A = T.A,
    B = T.B,
    f0 = TONIC.ice;
  check(
    "ice STEP 0.129 (116 BPM), F2 87.31 root, B up a whole tone",
    A.STEP === 0.129 &&
      A.bass[0].f === 87.31 &&
      Math.abs(B.bass[0].f / A.bass[0].f - 1.122462) < 1e-9,
    A.STEP + "/" + A.bass[0].f,
  );
  check(
    "ice bass bounces on every off-eighth — 32 notes, every one on an odd step",
    A.bass.length === 32 &&
      A.bass.every((n) => n.s % 2 === 1) &&
      barsWithBass(A) === 8,
    A.bass.length + " notes @" + [...new Set(A.bass.map((n) => n.s % 8))].sort().join(","),
  );
  check(
    "ice bass alternates root and fifth — and never sounds a perfect fourth",
    A.bass.filter((n) => n.s % 4 === 1).length === 16 &&
      !soundsDeg({ bass: A.bass, lead: [], pad: [] }, f0, 5),
    [...new Set(A.bass.map((n) => n.f))].join(","),
  );
  check(
    "ice lead lives above C5 — a bright register over a bouncing bass",
    A.lead.length > 0 && A.lead.every((n) => n.f >= 523.25),
    Math.min(...A.lead.map((n) => n.f)),
  );
  check(
    "ice states the motif at NORMAL speed at bars 0 and 4 — AUG is withdrawn",
    motifV2At(A.lead, 0, f0) && motifV2At(A.lead, 32, f0),
    motifV2Head(A.lead, f0, 64),
  );
  check(
    "ice pad sounds the Lydian sharp 4 — the glassy, uncanny tone",
    !!A.pad && A.pad.some((n) => isDeg(n.f, f0, [6])),
    (A.pad || []).map((n) => pcOf(n.f, f0).toFixed(1)).join(","),
  );
  check(
    "ice hat is a bell on every even step at 6200 Hz, against the off-beat bass",
    A.hat.length === 31 &&
      A.hat.every((n) => n.s % 2 === 0 && n.f === 6200) &&
      !A.hat.some((n) => n.s === 62),
    A.hat.length + ":" + [...new Set(A.hat.map((n) => n.s % 8))].sort().join(","),
  );
  check(
    "ice pulse never gaps — the bell and the off-bass cover it between them",
    pulseGap(A) <= 1 && barsWithLead(A) === 8,
    pulseGap(A) + "/" + barsWithLead(A),
  );
  check(
    "ice bass notes ring an eighth each, so the pulse connects rather than ticks",
    A.bass.every((n) => Math.round(n.d / A.STEP) === 2),
    [...new Set(A.bass.map((n) => Math.round(n.d / A.STEP)))].join(","),
  );
  check(
    "ice is dense but not solid: 58-63 of 64 steps",
    occ(A) >= 58 && occ(A) <= 63,
    occ(A),
  );
  check("ice register lanes never cross, A and B", lanes(A) && lanes(B));
}

// ---- jungle: bouncy, bright (D major pentatonic, tresillo) ----
{
  const T = MUSIC_TRACKS.jungle,
    A = T.A,
    B = T.B,
    f0 = TONIC.jungle;
  check(
    "jungle STEP 0.132 -> 113.6 BPM, D2 73.42 root, a fifth below menu's G",
    A.STEP === 0.132 &&
      A.bass[0].f === 73.42 &&
      15 / A.STEP >= 96 &&
      15 / A.STEP <= 120,
    A.STEP + " -> " + (15 / A.STEP).toFixed(1) + " BPM / " + A.bass[0].f,
  );
  check(
    "jungle timbres: triangle bass, triangle lead, triangle hat, sine pad",
    A.bass[0].t === "triangle" &&
      A.lead[0].t === "triangle" &&
      A.hat[0].t === "triangle" &&
      !!A.pad &&
      A.pad[0].t === "sine",
    chansOf(A)
      .map((a) => a[0].t)
      .join(","),
  );
  /* The 3+3+2 survives from v2 because it is the right groove for this room —
     but its cells now TILE the bar (3, 3, 2 steps long), which is what makes
     the bass continuous as well as syncopated. */
  check(
    "jungle bass is the 3+3+2 tresillo on 0/3/6, and its cells tile the bar",
    A.bass.length === 24 &&
      stepSet(A.bass) === "0,3,6" &&
      barsWithBass(A) === 8 &&
      A.bass.every(
        (n) => Math.round(n.d / A.STEP) === (n.s % 8 === 6 ? 2 : 3),
      ),
    A.bass.length + ":" + stepSet(A.bass),
  );
  check(
    "jungle hat is a light off-tick on 1 and 4 only — 16 hits at 3200 Hz",
    A.hat.length === 16 &&
      A.hat.every((n) => [1, 4].includes(n.s % 8) && n.f === 3200),
    A.hat.length + ":" + stepSet(A.hat),
  );
  check(
    "jungle's lead skips in the tresillo's POCKETS — 2/4/5 plus a step-7 pickup",
    stepSet(A.lead) === "2,4,5,7" &&
      A.lead
        .filter((n) => n.s % 8 === 7)
        .map((n) => n.s)
        .join(",") === "15,31,47,63" &&
      barsWithLead(A) === 8,
    stepSet(A.lead),
  );
  const bounce = (chan, s0) =>
    figureAt(chan, s0, f0, [2, 4, 5], [DEG5, DEG3, DEG5]);
  check(
    "jungle's hook is the offbeat bounce 5-3-5 on steps 2/4/5, at bars 0 and 4",
    bounce(A.lead, 0) && bounce(A.lead, 32),
  );
  check(
    "jungle pad is two 32-step canopy drones, A3 then D4",
    !!A.pad &&
      A.pad.length === 2 &&
      A.pad.every((n) => Math.round(n.d / A.STEP) === 32) &&
      near(A.pad[0].f, 220, 0.01) &&
      near(A.pad[1].f, 293.66, 0.01),
    JSON.stringify((A.pad || []).map((n) => [n.s, n.f])),
  );
  check(
    "jungle is lively but not solid: 54-62 of 64 steps, A and B alike",
    occ(A) >= 54 && occ(A) <= 62 && occ(B) >= 54 && occ(B) <= 62,
    occ(A) + "/" + occ(B),
  );
  check("jungle register lanes never cross, A and B", lanes(A) && lanes(B));
  check(
    "jungle B is hand-authored now, not transp — it owns its own hat array",
    B.hat !== A.hat,
  );
  check(
    "jungle B re-CUTS the tresillo to 0/2/5 and moves the hat to 3/6",
    stepSet(B.bass) === "0,2,5" &&
      stepSet(B.hat) === "3,6" &&
      B.bass.every(
        (n) => Math.round(n.d / B.STEP) === (n.s % 8 === 0 ? 2 : 3),
      ),
    stepSet(B.bass) + " / " + stepSet(B.hat),
  );
}

// ---- factory: mechanical, cold competence (E Phrygian, CANON) ----
{
  const T = MUSIC_TRACKS.factory,
    A = T.A,
    B = T.B,
    f0 = TONIC.factory;
  check(
    "factory STEP 0.114 (132 BPM), E2 82.41 root, B down a whole tone",
    A.STEP === 0.114 &&
      A.bass[0].f === 82.41 &&
      Math.abs(B.bass[0].f / A.bass[0].f - 0.890899) < 1e-9,
    A.STEP + "/" + A.bass[0].f,
  );
  check(
    "factory bass is sawtooth — one of the two scarce identity timbres",
    A.bass.every((n) => n.t === "sawtooth"),
    A.bass[0].t,
  );
  check(
    "factory hat is square on every even step of ALL EIGHT bars — bar 5 no longer cuts",
    A.hat.length === 32 &&
      A.hat.every((n) => n.t === "square" && n.s % 2 === 0),
    A.hat.length + "/" + A.hat[0].t,
  );
  check(
    "factory engine never stalls: bass in every bar, pulse never gaps",
    barsWithBass(A) === 8 && pulseGap(A) <= 1,
    barsWithBass(A) + "/" + pulseGap(A),
  );
  check("factory has no pad at all", A.pad === undefined, String(A.pad));
  const bh = motifV2Head(A.bass, f0, 64),
    lh = motifV2Head(A.lead, f0, 64);
  const bf = bh >= 0 && A.bass.find((n) => n.s === bh).f,
    lf = lh >= 0 && A.lead.find((n) => n.s === lh).f;
  check(
    "CANON: bass head at bar 0, lead head exactly 8 steps later, an octave up",
    bh === 0 && lh === 8 && lf > bf && isDeg(lf, bf, DEG1),
    "bass@" + bh + " lead@" + lh,
  );
  check(
    "factory drives without filling: 56-62 of 64 steps",
    occ(A) >= 56 && occ(A) <= 62,
    occ(A),
  );
  check("factory register lanes never cross, A and B", lanes(A) && lanes(B));
}

// ---- water: flowing, 3-against-4 (G Mixolydian, dotted three-step cells) ----
{
  const T = MUSIC_TRACKS.water,
    A = T.A,
    B = T.B,
    f0 = TONIC.water;
  check(
    "water STEP 0.144 -> 104.2 BPM, G1 49.00 root, inside the v3 96-120 band",
    A.STEP === 0.144 &&
      A.bass[0].f === 49 &&
      15 / A.STEP >= 96 &&
      15 / A.STEP <= 120,
    A.STEP + " -> " + (15 / A.STEP).toFixed(1) + " BPM / " + A.bass[0].f,
  );
  /* A CALM ROOM: no hat at all, so the rhythm section is bass onsets only and
     the pulse is carried by the cells themselves.
     The spec's §2 row asks for a `sine` LEAD here; §5 row 8 keeps "exactly one
     sine lead in the whole score, and it is VOID" unchanged, and the waveform
     roster manages to assert both in one breath. The pin sheet wins: water's
     lead is `triangle`, void keeps its marker, and water's softness is bought
     with register, an empty hat lane and a 0.06 lead instead. */
  check(
    "water is a calm room: triangle bass, triangle lead, sine pad, NO hat",
    A.bass[0].t === "triangle" &&
      A.lead[0].t === "triangle" &&
      A.hat.length === 0 &&
      B.hat.length === 0 &&
      !!A.pad &&
      A.pad[0].t === "sine",
    chansOf(A)
      .map((a) => a[0].t)
      .join(","),
  );
  /* 3-against-4 spelt on an integer grid: DOTTED THREE-STEP CELLS against the
     eight-step bar. The cells tile (each rings until the next begins) and walk
     out of phase with the bar, re-aligning at the halfway point — which is
     what puts the hook back on a downbeat at bar 4 without a fractional step. */
  const HALF = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
  check(
    "water bass is dotted 3-step cells that tile, re-phasing at the halfway mark",
    A.bass.length === 22 &&
      A.bass.map((n) => n.s).join(",") ===
        HALF.concat(HALF.map((s) => s + 32)).join(",") &&
      A.bass.every(
        (n) => Math.round(n.d / A.STEP) === (n.s % 32 === 30 ? 2 : 3),
      ),
    A.bass.length + ":" + A.bass.map((n) => n.s).join(","),
  );
  check(
    "water's cells touch every residue of the bar — the 3-against-8 signature",
    stepSet(A.bass) === "0,1,2,3,4,5,6,7",
    stepSet(A.bass),
  );
  const cell = (chan, s0) =>
    figureAt(chan, s0, f0, [0, 3, 6], [DEG5, DEG6, DEG1]);
  check(
    "water's hook is the dotted cell 5-6-1 (D E G) on 0/3/6, at bars 0 and 4",
    cell(A.lead, 0) && cell(A.lead, 32),
  );
  check(
    "water's lead is dotted too, never under three steps apart — nothing hurries",
    A.lead.length === 21 &&
      A.lead.every((n) => Math.round(n.d / A.STEP) <= 3) &&
      A.lead.every((n, i) => i === 0 || n.s - A.lead[i - 1].s >= 3),
    stepSet(A.lead),
  );
  check(
    "water pad is four 16-step drones under it, not a second pulse",
    !!A.pad &&
      A.pad.length === 4 &&
      A.pad.every((n) => Math.round(n.d / A.STEP) === 16) &&
      A.pad.map((n) => n.s).join(",") === "0,16,32,48",
    JSON.stringify((A.pad || []).map((n) => [n.s, n.f])),
  );
  check(
    "water flows without a hat: bass onsets alone leave no gap over two steps",
    pulseGap(A) <= 2 && pulseGap(B) <= 2 && barsWithLead(A) === 8,
    pulseGap(A) + "/" + pulseGap(B),
  );
  check(
    "water is open, not empty: 34-46 of 64 steps",
    occ(A) >= 34 && occ(A) <= 46,
    occ(A) + "/" + occ(B),
  );
  /* B lifts to the flat seventh — F major pentatonic, five notes G Mixolydian
     already owns, so the lift is modal rather than chromatic — and RE-PHASES
     the cells into the bar (0/3/6 every bar) instead of across it. Note that
     the shared A-vs-B root clause reads bass at steps 0/8/16/24 and A's walking
     grid only lands on two of those, so here that clause is carried by step 0:
     B opens on F2 87.31 where A opens on G1 49.00. */
  check(
    "water B lifts to the flat 7th and re-phases the cells INTO the bar (0/3/6)",
    stepSet(B.bass) === "0,3,6" &&
      B.bass.length === 24 &&
      B.bass[0].f === 87.31 &&
      B.bass.every(
        (n) => Math.round(n.d / B.STEP) === (n.s % 8 === 6 ? 2 : 3),
      ),
    stepSet(A.bass) + " vs " + stepSet(B.bass),
  );
  check("water register lanes never cross, A and B", lanes(A) && lanes(B));
}

// ---- sand: dotted, lazy, warm (E Mixolydian opening on its fifth) ----
{
  const T = MUSIC_TRACKS.sand,
    A = T.A,
    B = T.B,
    f0 = TONIC.sand;
  check(
    "sand STEP 0.148 -> 101.4 BPM, opens on its drone FIFTH B2 123.47, in band",
    A.STEP === 0.148 &&
      A.bass[0].f === 123.47 &&
      15 / A.STEP >= 96 &&
      15 / A.STEP <= 120,
    A.STEP + " -> " + (15 / A.STEP).toFixed(1) + " BPM / " + A.bass[0].f,
  );
  check(
    "sand is the other calm room: triangle bass, triangle lead, sine pad, NO hat",
    A.bass[0].t === "triangle" &&
      A.lead[0].t === "triangle" &&
      A.hat.length === 0 &&
      B.hat.length === 0 &&
      !!A.pad &&
      A.pad[0].t === "sine",
    chansOf(A)
      .map((a) => a[0].t)
      .join(","),
  );
  /* Dotted like water's, but cut the other way round and phrased in long
     descending arcs: 3+2+3 rather than water's rolling threes, INSIDE the bar
     rather than across it, and at a slower STEP. The two calm rooms share a
     palette, so what separates them is REGISTER and phrase: water opens on
     G1 49.00 and roams two octaves; sand sits on B2 123.47 and stays inside
     one, mid-high and compressed. */
  check(
    "sand bass is the lazy dotted cut 3+2+3 on 0/3/5, tiling all eight bars",
    A.bass.length === 24 &&
      stepSet(A.bass) === "0,3,5" &&
      barsWithBass(A) === 8 &&
      A.bass.every(
        (n) => Math.round(n.d / A.STEP) === (n.s % 8 === 3 ? 2 : 3),
      ),
    A.bass.length + ":" + stepSet(A.bass),
  );
  check(
    "sand's lead is BEHIND THE BEAT — 1/4/6, one step after every downbeat",
    A.lead.length === 24 &&
      stepSet(A.lead) === "1,4,6" &&
      barsWithLead(A) === 8,
    A.lead.length + ":" + stepSet(A.lead),
  );
  const fall = (chan, s0) =>
    figureAt(chan, s0, f0, [1, 4, 6], [DEG6, DEG5, DEG3]);
  check(
    "sand's hook is the lazy fall 6-5-3 (C# B G#), at bars 0 and 4",
    fall(A.lead, 0) && fall(A.lead, 32),
  );
  /* Kept from v2, unchanged in mechanism: E Mixolydian owns G# as its third,
     and the failure message names SAND rather than whichever track reached for
     the pitch — so every new collection is checked against it before a note is
     written. Reads chansOf, so a hat at some coincidental frequency would trip
     it too; none of the ten hats sit near G#3 or G#4. */
  const GS = [207.65, 415.3];
  const soundsGs = (P) =>
    chansOf(P).some((a) =>
      a.some((n) => GS.some((m) => Math.abs(n.f - m) < 0.02)),
    );
  const others = Object.keys(MUSIC_TRACKS).filter((k) => k !== "sand");
  check(
    "sand.A keeps G# as its third, and is the only A section that sounds it",
    soundsGs(A) && !others.some((k) => soundsGs(MUSIC_TRACKS[k].A)),
    others.filter((k) => soundsGs(MUSIC_TRACKS[k].A)).join(","),
  );
  check(
    "sand pad is four 16-step drones, and the G# is inside one of them",
    !!A.pad &&
      A.pad.length === 4 &&
      A.pad.every((n) => Math.round(n.d / A.STEP) === 16) &&
      A.pad.some((n) => Math.abs(n.f - 207.65) < 0.02),
    JSON.stringify((A.pad || []).map((n) => [n.s, n.f])),
  );
  check(
    "sand holds its pulse with no hat at all — bass onsets gap by two at most",
    pulseGap(A) <= 2 && pulseGap(B) <= 2,
    pulseGap(A) + "/" + pulseGap(B),
  );
  check(
    "sand is warm and unhurried: 44-54 of 64 steps",
    occ(A) >= 44 && occ(A) <= 54,
    occ(A) + "/" + occ(B),
  );
  check(
    "sand B walks down a fifth to A Mixolydian and re-cuts the bass to 0/3/6",
    stepSet(B.bass) === "0,3,6" && B.bass[0].f === 110.0,
    stepSet(A.bass) + " vs " + stepSet(B.bass),
  );
  check("sand register lanes never cross, A and B", lanes(A) && lanes(B));
}

// ---- R3c: the whole score, quantified over all ten tracks ----
{
  const IDS = Object.keys(MUSIC_TRACKS);
  /* The ladder, mid-migration: v2 rows (104-140 BPM) and v3 rows (96-120 BPM)
     in one table, because the pin quantifies over all ten and a track may only
     move into a VACANT STEP. That constraint is what fixes the ship order —
     v3's targets are arena .125 / crown .128 / factory .130 / jungle .132 /
     ice .135 / menu .137 / intro .140 / water .144 / sand .148 / void .152, and
     arena cannot take .125 until intro leaves it. Listed in ladder order so a
     future move can see its neighbours. */
  const LADDER = {
    arena: 0.107,
    crown: 0.11,
    factory: 0.114,
    intro: 0.125,
    jungle: 0.132,
    ice: 0.129,
    sand: 0.148,
    menu: 0.137,
    water: 0.144,
    void: 0.152,
  };
  check(
    "the tempo ladder is the authored one, ten distinct values",
    IDS.every((k) => MUSIC_TRACKS[k].A.STEP === LADDER[k]) &&
      new Set(Object.values(LADDER)).size === 10,
    IDS.map((k) => k + " " + MUSIC_TRACKS[k].A.STEP).join(" "),
  );
  const ROOT = {
    jungle: 73.42,
    ice: 87.31,
    factory: 82.41,
    water: 49,
    arena: 55,
    sand: 123.47,
    void: 61.74,
    crown: 65.41,
  };
  check(
    "the eight biome roots are the authored ones, all distinct",
    Object.keys(ROOT).every((k) => MUSIC_TRACKS[k].A.bass[0].f === ROOT[k]) &&
      new Set(Object.values(ROOT)).size === 8,
    Object.keys(ROOT)
      .map((k) => MUSIC_TRACKS[k].A.bass[0].f)
      .join(","),
  );
  const sawBass = IDS.filter((k) => MUSIC_TRACKS[k].A.bass[0].t === "sawtooth");
  check(
    "exactly one sawtooth bass in the whole score, and it is FACTORY",
    sawBass.length === 1 && sawBass[0] === "factory",
    sawBass.join(","),
  );
  check(
    "every track uses at least two distinct waveforms",
    IDS.every((k) => waves(MUSIC_TRACKS[k].A) >= 2),
    IDS.map((k) => k + ":" + waves(MUSIC_TRACKS[k].A)).join(" "),
  );
  check(
    "register lanes never cross, in every A and every B",
    IDS.every(
      (k) =>
        lanes(MUSIC_TRACKS[k].A) &&
        (!MUSIC_TRACKS[k].B || lanes(MUSIC_TRACKS[k].B)),
    ),
    IDS.filter((k) => !lanes(MUSIC_TRACKS[k].A)).join(","),
  );
  check(
    "no track puts a note on every step of its loop",
    IDS.every((k) => occ(MUSIC_TRACKS[k].A) < MUSIC_TRACKS[k].A.LEN),
    IDS.map((k) => k + ":" + occ(MUSIC_TRACKS[k].A)).join(" "),
  );
  /* Every band has a FLOOR as well as a ceiling, so a track can drift toward
     neither solidity nor sparseness. The v2 rows sit at 56-63 because v2 read
     "constant pulse" as maximum density short of full occupancy; the v3 rows
     are LOWER by design (menu 32-44) because v3 buys continuity from bass note
     SPANS rather than from onset count — the v3 block's "bass spans cover every
     step" is the fact that lets a medium-density track still never sag. */
  const BAND = {
    intro: [28, 31],
    menu: [32, 44],
    jungle: [54, 62],
    ice: [58, 63],
    factory: [56, 62],
    water: [34, 46],
    arena: [56, 62],
    sand: [44, 54],
    void: [34, 46],
    crown: [58, 63],
  };
  check(
    "occupancy lands in band for all ten — rests are authored, not left over",
    IDS.every((k) => {
      const o = occ(MUSIC_TRACKS[k].A);
      return o >= BAND[k][0] && o <= BAND[k][1];
    }),
    IDS.map((k) => k + ":" + occ(MUSIC_TRACKS[k].A)).join(" "),
  );
  const ionian = IDS.filter(
    (k) =>
      soundsDeg(MUSIC_TRACKS[k].A, TONIC[k], 5) &&
      soundsDeg(MUSIC_TRACKS[k].A, TONIC[k], 11),
  );
  check(
    "only CROWN's A sounds both a perfect fourth and a leading tone — Ionian, alone",
    ionian.length === 1 && ionian[0] === "crown",
    ionian.join(","),
  );
}

// ---- direction v3: what separates a composed track from a v2 one ----
{
  const PATS = V3.flatMap(patsOf);
  const CH = ["bass", "lead", "hat", "pad"];
  const has = (P, k) => P[k] && P[k].length;
  check(
    "v3: every composed track sits in the 96-120 BPM band",
    V3.every((k) => {
      const b = 15 / MUSIC_TRACKS[k].A.STEP;
      return b >= 96 && b <= 120;
    }),
    V3.map((k) => k + " " + (15 / MUSIC_TRACKS[k].A.STEP).toFixed(1)).join(" "),
  );
  /* Soft by default. sawtooth leaves the music layer entirely (it stays in the
     SFX layer, where transients want it); square survives only as a colour, and
     only on a hat, and only quietly. */
  const SOFT = {
    bass: ["triangle", "sine"],
    lead: ["triangle", "sine"],
    pad: ["triangle", "sine"],
    hat: ["triangle", "sine", "square"],
  };
  check(
    "v3: soft timbres only — no sawtooth in the music layer, square hats only",
    PATS.every(([, P]) =>
      CH.every((k) => !has(P, k) || SOFT[k].includes(P[k][0].t)),
    ),
    PATS.map(
      ([n, P]) =>
        n +
        ":" +
        chansOf(P)
          .map((a) => a[0].t)
          .join("/"),
    ).join(" "),
  );
  check(
    "v3: a square channel is a low-velocity COLOUR — every note at v <= 0.035",
    PATS.every(([, P]) =>
      CH.every(
        (k) =>
          !has(P, k) ||
          P[k][0].t !== "square" ||
          P[k].every((n) => n.v <= 0.035),
      ),
    ),
  );
  const CEIL = { bass: 0.09, lead: 0.07, hat: 0.02, pad: 0.03 };
  check(
    "v3: per-channel velocity ceilings — nothing in a v3 track is loud",
    PATS.every(([, P]) =>
      CH.every((k) => !has(P, k) || P[k].every((n) => n.v <= CEIL[k])),
    ),
    PATS.map(
      ([n, P]) =>
        n +
        ":" +
        CH.filter((k) => has(P, k))
          .map((k) => Math.max(...P[k].map((x) => x.v)))
          .join("/"),
    ).join(" "),
  );
  /* Per-channel ceilings do not bound SIMULTANEITY — four channels each under
     their own limit still sum. This is the checkable form of "leave headroom",
     and it is what separates v3 from v2's arena at 0.268. */
  check(
    "v3: headroom — a pattern's channel peaks sum to no more than 0.20",
    PATS.every(([, P]) => peakSum(P) <= 0.2 + 1e-9),
    PATS.map(([n, P]) => n + ":" + peakSum(P).toFixed(3)).join(" "),
  );
  check(
    "v3: every pitch lies in that PATTERN's own declared collection",
    PATS.every(([n, P]) =>
      ["bass", "lead", "pad"].every(
        (c) => !P[c] || P[c].every((x) => isDeg(x.f, V3KEY[n].f0, V3KEY[n].set)),
      ),
    ),
    PATS.map(([n]) => n + " " + V3KEY[n].name).join(" | "),
  );
  /* "Nothing below 55 Hz" (spec 0a.3) meets the one root v3 declined to move:
     water's biome root is G1 49.00 and the ROOT pin holds it there, so the two
     facts cannot both be literally true. Rather than lower the floor per
     pattern, the fact is stated as a GLOBAL UNIQUENESS claim — among composed
     tracks exactly one bass note sits under 55 Hz, it is water's downbeat, and
     it is at step 0 — so the exception names its own offender by value and
     cannot drift into a second track or a second note. */
  const low = PATS.flatMap(([n, P]) =>
    P.bass.filter((x) => x.f < 55).map((x) => n + "@" + x.s + ":" + x.f),
  );
  check(
    "v3: no rumble — the ONE sub-55 Hz bass note in the score is water's G1 root",
    low.length <= 1 && low.every((s) => s === "water.A@0:49"),
    low.join(" ") || "(none)",
  );
  /* The single largest v3 change, pinned as an ABSENCE. NOTE: on a minor-
     pentatonic track this is trivially true (that collection has no 6th degree,
     so the detector can never fire whatever the track plays) — those tracks are
     held to their own hook pin instead, and this line is the score-wide floor. */
  check(
    "v3: the retired five-note motif is GONE from lead and bass, both sections",
    PATS.every(
      ([n, P]) =>
        motifV2Head(P.lead, V3KEY[n].f0, P.LEN) === -1 &&
        motifV2Head(P.bass, V3KEY[n].f0, P.LEN) === -1,
    ),
    PATS.map(([n, P]) => n + ":" + motifV2Head(P.lead, V3KEY[n].f0, P.LEN)).join(
      " ",
    ),
  );
  check(
    "v3: the low end never lets go — bass SPANS cover every step of the loop",
    PATS.every(([, P]) => bassSpan(P).size === P.LEN),
    PATS.map(([n, P]) => n + ":" + bassSpan(P).size + "/" + P.LEN).join(" "),
  );
  check(
    "v3: onsets may be half-time, but the grid still holds — pulseGap <= 3",
    PATS.every(([, P]) => pulseGap(P) <= 3),
    PATS.map(([n, P]) => n + ":" + pulseGap(P)).join(" "),
  );
  check(
    "v3: the bass plays every bar of every composed pattern",
    PATS.every(([, P]) => barsWithBass(P) === P.LEN / 8),
    PATS.map(([n, P]) => n + ":" + barsWithBass(P)).join(" "),
  );
  check(
    "v3: A and B really differ — own hat array, own bass accents, own roots",
    V3.every((k) => {
      const A = MUSIC_TRACKS[k].A,
        B = MUSIC_TRACKS[k].B;
      if (!B) return true;
      const roots = (P) =>
        [0, 8, 16, 24]
          .map((s) => (P.bass.find((n) => n.s === s) || { f: 0 }).f)
          .join("/");
      return (
        B.hat !== A.hat &&
        stepSet(B.bass) !== stepSet(A.bass) &&
        roots(B) !== roots(A)
      );
    }),
    V3.map(
      (k) =>
        k +
        ":" +
        stepSet(MUSIC_TRACKS[k].A.bass) +
        " vs " +
        stepSet(MUSIC_TRACKS[k].B.bass),
    ).join(" "),
  );
  /* "Different from the other one", pinned two ways. A Hz-list comparison
     between tracks in different keys is VACUOUSLY unequal and pins nothing; a
     (delta-step, delta-semitone) contour is the melodic shape, and a step-set
     mod 8 is the groove. Both quantify pairwise over the composed ids, so they
     are empty on the first commit of a wave and bite from the second. */
  const pairs = [];
  for (let i = 0; i < V3.length; i++)
    for (let j = i + 1; j < V3.length; j++) pairs.push([V3[i], V3[j]]);
  check(
    "v3: composed lead contours are pairwise different as SHAPES, not as Hz",
    pairs.every(
      ([a, b]) =>
        contour(MUSIC_TRACKS[a].A.lead) !== contour(MUSIC_TRACKS[b].A.lead),
    ),
    pairs.map(([a, b]) => a + "/" + b).join(" ") || "(1 composed, no pair yet)",
  );
  check(
    "v3: composed bass and lead step-sets are pairwise distinct grooves",
    pairs.every(
      ([a, b]) =>
        stepSet(MUSIC_TRACKS[a].A.bass) !== stepSet(MUSIC_TRACKS[b].A.bass) &&
        stepSet(MUSIC_TRACKS[a].A.lead) !== stepSet(MUSIC_TRACKS[b].A.lead),
    ),
    V3.map(
      (k) =>
        k +
        " b" +
        stepSet(MUSIC_TRACKS[k].A.bass) +
        " l" +
        stepSet(MUSIC_TRACKS[k].A.lead),
    ).join(" | "),
  );
  /* No two of the ten share (root, STEP) — the stronger half of "no two share
     root + collection + STEP", and the clause that forces the migration order. */
  const rs = Object.keys(MUSIC_TRACKS).map(
    (k) => MUSIC_TRACKS[k].A.bass[0].f + "@" + MUSIC_TRACKS[k].A.STEP,
  );
  check(
    "v3: no two of the ten tracks share a (root, STEP) pair",
    new Set(rs).size === rs.length,
    rs.join(" "),
  );
}

console.log("\n  MUSIC RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
