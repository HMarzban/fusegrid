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
  menu: 293.66,
  jungle: 293.66,
  ice: 349.23,
  factory: 329.63,
  water: 392.0,
  arena: 440.0,
  sand: 329.63,
  void: 493.88,
  crown: 261.63,
});
/* The one chromatic guest menu's B section imports, in every octave it is
   authored in — every A section is pure white-key (spec 1b). */
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
const motifAt = (chan, s0, f0, k) =>
  figureAt(
    chan,
    s0,
    f0,
    [0, 1, 2, 3, 6].map((x) => x * (k || 1)),
    [DEG1, DEG3, DEG5, DEG6, DEG5],
  );
/* Direction v2 (spec 1): same contour, bouncier rhythm — the flash is two steps
   instead of three and the settle moves to step 5, so steps 6-7 carry a pickup
   rather than a rest. motifAt above survives for the wave-B tracks still on the
   v1 figure. Hook pins using this are always positional (a named bar), because
   a sixteenth run can walk the right pitch classes by accident. */
const motifV2At = (chan, s0, f0) =>
  figureAt(chan, s0, f0, [0, 1, 2, 3, 5], [DEG1, DEG3, DEG5, DEG6, DEG5]);
const motifV2Head = (chan, f0, len) => {
  for (let s = 0; s < (len || 64); s++) if (motifV2At(chan, s, f0)) return s;
  return -1;
};
const fragMidAt = (chan, s0, f0) =>
  figureAt(chan, s0, f0, [1, 2, 3], [DEG3, DEG5, DEG6]);
const motifHead = (chan, f0, k, len) => {
  for (let s = 0; s < (len || 64); s++) if (motifAt(chan, s, f0, k)) return s;
  return -1;
};
const chansOf = (P) =>
  ["bass", "lead", "hat", "pad"].map((k) => P[k]).filter((a) => a && a.length);
const occ = (P) => {
  const s = new Set();
  for (const a of chansOf(P)) for (const n of a) s.add(n.s);
  return s.size;
};
const breathBar = (P) => {
  for (let b = 0; b * 8 < P.LEN; b++)
    if (!P.lead.some((n) => n.s >= b * 8 && n.s < b * 8 + 8)) return b;
  return -1;
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
    "STEP=0.121 LEN=64 (124 BPM sixteenths, 8 bars of 2/4)",
    MUSIC_PATTERN.STEP === 0.121 && MUSIC_PATTERN.LEN === 64,
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
    "bass 40 hits — the tresillo 0/3/6 riding a continuous eighth pulse",
    MUSIC_PATTERN.bass.length === 40 &&
      MUSIC_PATTERN.bass.every((n) => [0, 2, 3, 4, 6].includes(n.s % 8)),
    MUSIC_PATTERN.bass.length +
      ":" +
      [...new Set(MUSIC_PATTERN.bass.map((n) => n.s % 8))].sort().join(","),
  );
  check(
    "lead 44-56 notes and NO lead-free bar — the two silent bars are gone",
    MUSIC_PATTERN.lead.length >= 44 &&
      MUSIC_PATTERN.lead.length <= 56 &&
      barsWithLead(MUSIC_PATTERN) === 8,
    MUSIC_PATTERN.lead.length + " / " + barsWithLead(MUSIC_PATTERN) + " bars",
  );
  check(
    "hat 32 ticks — a straight eighth pulse on every even step",
    MUSIC_PATTERN.hat.length === 32 &&
      MUSIC_PATTERN.hat.every((n) => n.s % 2 === 0),
    MUSIC_PATTERN.hat.length,
  );
  const bassByS = new Map(MUSIC_PATTERN.bass.map((n) => [n.s, n]));
  check(
    "Dm - G - Am - Dm walk (D2 73.42, G1 49, A1 55, D2 73.42)",
    bassByS.get(0).f === 73.42 &&
      bassByS.get(8).f === 49 &&
      bassByS.get(16).f === 55 &&
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
  const T_OF = { bass: "square", lead: "square", hat: "triangle" };
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
    "B hat 32 even-step ticks, same skeleton as A",
    MUSIC_PATTERN_B.hat.length === 32 &&
      MUSIC_PATTERN_B.hat.every((n) => n.s % 2 === 0),
    MUSIC_PATTERN_B.hat.length,
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
    "B tonicizes G major and imports the one F# the collection does not own",
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

  ac.currentTime = 0.11;
  a.pump();
  // step 1 lands one STEP past the 0.05 anchor — derived, not the 0.2 literal
  // the old 0.15 tempo happened to produce (both sides add the same operands)
  const t1 = 0.05 + MUSIC_PATTERN.STEP;
  check(
    "frame pump advances lookahead monotonically",
    ac.starts.every((s, i) => i === 0 || s.t >= ac.starts[i - 1].t) &&
      ac.starts.some((s) => near(s.t, t1, 1e-9)),
    t1,
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
    MUSIC_TRACKS.sand.A.STEP === 0.134 &&
      MUSIC_TRACKS.void.A.STEP === 0.234 &&
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
    "water downbeat is G1=49.00, not menu's D2=73.42",
    ac.starts.some((s) => near(s.f, 49, 0.05)) &&
      !ac.starts.some((s) => near(s.f, 73.42, 0.05)),
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
    "setTrack menu restores the D2 73.42 identity bass",
    ac.starts.some((s) => near(s.f, 73.42, 0.05)),
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
  /* Stepped dynamics is the direction brief's main maturity lever and the whole
     reason the [s,f,d,v?] tuple exists. Exactly these channels use it. */
  const STEPPED = [
    "water.A.bass",
    "water.B.bass",
    "sand.A.lead",
    "sand.B.lead",
  ];
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
  const D = TONIC.menu;
  const plain = mk([
    [0, 293.66],
    [1, 349.23],
    [2, 440.0],
    [3, 493.88],
    [6, 440.0],
  ]);
  check("motifAt matches PLAIN on the tonic", motifAt(plain, 0, D, 1));
  check(
    "motifAt is octave-blind — pitch class, not absolute Hz",
    motifAt(
      mk([
        [0, 587.32],
        [1, 698.46],
        [2, 880.0],
        [3, 987.77],
        [6, 880.0],
      ]),
      0,
      D,
      1,
    ),
  );
  const aug = mk([
    [0, 293.66],
    [2, 349.23],
    [4, 440.0],
    [6, 493.88],
    [12, 440.0],
  ]);
  check(
    "motifAt matches AUG at k=2 and rejects it at k=1",
    motifAt(aug, 0, D, 2) && !motifAt(aug, 0, D, 1),
  );
  check(
    "motifAt rejects a wrong flash note — only 6 (8 or 9 semitones) will do",
    !motifAt(
      mk([
        [0, 293.66],
        [1, 349.23],
        [2, 440.0],
        [3, 392.0],
        [6, 440.0],
      ]),
      0,
      D,
      1,
    ),
  );
  check(
    "motifHead finds an ANTIC head that straddles the bar line",
    motifHead(
      mk([
        [15, 293.66],
        [16, 349.23],
        [17, 440.0],
        [18, 493.88],
        [21, 440.0],
      ]),
      D,
      1,
      64,
    ) === 15,
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
  const v2 = mk([
    [0, 293.66],
    [1, 349.23],
    [2, 440.0],
    [3, 493.88],
    [5, 440.0],
  ]);
  check(
    "motifV2At matches the v2 rhythm (settle at step 5) and rejects the v1 one",
    motifV2At(v2, 0, D, 1) && !motifAt(v2, 0, D, 1) && !motifV2At(plain, 0, D),
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
  check("breathBar finds the first lead-free bar", breathBar(P) === 1, breathBar(P));
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
{
  /* The ladder's last ordering constraint is discharged here: water wants
     .139 and sand has just vacated it, void's .144 was freed by ice in wave A,
     and crown took .110 from nobody. So the pre-move guard that stood in this
     block retires rather than being re-valued into a tautology — what replaces
     it is the fact that made it necessary, checked directly. */
  check(
    "the ladder's last blocked move is unblocked: .139 is vacant for water",
    !Object.keys(MUSIC_TRACKS).some((k) => MUSIC_TRACKS[k].A.STEP === 0.139),
    Object.keys(MUSIC_TRACKS)
      .filter((k) => MUSIC_TRACKS[k].A.STEP === 0.139)
      .join(","),
  );
}

// ---- menu: confident, swaggering (D Dorian, the identity theme) ----
{
  const A = MUSIC_PATTERN,
    B = MUSIC_PATTERN_B,
    f0 = TONIC.menu;
  check(
    "menu states the motif at bar 0 AND bar 4 — the hook returns mid-loop",
    motifV2At(A.lead, 0, f0) && motifV2At(A.lead, 32, f0),
    motifV2Head(A.lead, f0, 64),
  );
  check(
    "menu A and B each occupy 58-63 of 64 steps — one free step, not a rest bar",
    occ(A) >= 58 && occ(A) <= 63 && occ(B) >= 58 && occ(B) <= 63,
    occ(A) + "/" + occ(B),
  );
  check(
    "menu pulse never gaps, in either section",
    pulseGap(A) <= 1 && pulseGap(B) <= 1,
    pulseGap(A) + "/" + pulseGap(B),
  );
  check("menu register lanes never cross, A and B", lanes(A) && lanes(B));
  check("menu B is hand-authored — its hat is not A's array", B.hat !== A.hat);
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

// ---- void: dread, subtraction (B Locrian, FRAG-MID and nothing else) ----
{
  const T = MUSIC_TRACKS.void,
    A = T.A,
    B = T.B,
    f0 = TONIC.void;
  check(
    "void STEP 0.234 (64 BPM), B1 61.74 — outside the tempo band on purpose",
    A.STEP === 0.234 && A.bass[0].f === 61.74,
    A.STEP + "/" + A.bass[0].f,
  );
  check(
    "void is two voices: empty hat array, no pad key at all",
    A.hat.length === 0 && A.pad === undefined,
    A.hat.length + "/" + A.pad,
  );
  check(
    "void is the only sine lead in the score",
    A.lead.length > 0 && A.lead.every((n) => n.t === "sine"),
    A.lead[0] && A.lead[0].t,
  );
  check(
    "void bass is a sustained pedal at the lowest gain in the score",
    A.bass.length <= 2 &&
      A.bass.every((n) => Math.round(n.d / A.STEP) >= 8) &&
      A.bass[0].v < 0.05,
    A.bass.length + " notes @v" + A.bass[0].v,
  );
  check(
    "void lead NEVER sounds degree 1 — no ground under the figure",
    !A.lead.some((n) => isDeg(n.f, f0, DEG1)),
    A.lead.map((n) => pcOf(n.f, f0).toFixed(2)).join(","),
  );
  let frags = 0,
    plains = 0;
  for (let b = 0; b < 8; b++) {
    if (fragMidAt(A.lead, b * 8, f0)) frags++;
    if (motifAt(A.lead, b * 8, f0, 1)) plains++;
  }
  check(
    "void plays FRAG-MID at least twice and the whole motif never",
    frags >= 2 && plains === 0,
    frags + " frag / " + plains + " plain",
  );
  check(
    "void is the sparsest track in the game: at most 20 of 64 steps",
    occ(A) <= 20,
    occ(A),
  );
  check("void B is hand-authored — its hat is not A's array", B.hat !== A.hat);
  check("void register lanes never cross, A and B", lanes(A) && lanes(B));
}
{
  check(
    "R3c pre-move: water root is G1 49.00 now that void has taken 61.74",
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
  const HAND = ["menu", "arena", "void", "crown"];
  const TRANSP = ["jungle", "ice", "factory", "water", "sand"];
  check(
    "hand-authored B: menu/arena/void/crown each own a distinct hat array",
    HAND.every((k) => MUSIC_TRACKS[k].B.hat !== MUSIC_TRACKS[k].A.hat),
    HAND.filter((k) => MUSIC_TRACKS[k].B.hat === MUSIC_TRACKS[k].A.hat).join(","),
  );
  check(
    "transp B: the five biomes still share A's hat array by identity",
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
  /* Direction v2. Grows one id per commit, in the ladder's migration order
     (wave A intro -> menu -> jungle -> ice -> factory, then wave B arena ->
     crown -> sand -> water -> void); the R3c block below takes it over as an
     all-ten sweep once the last track lands. The breath-bar sweep this block
     used to carry is gone with the shared mandate — a v2 track earns its air
     from articulation, not empty bars. */
  const WA = ["intro", "menu", "jungle", "ice", "factory", "arena", "crown", "sand"];
  check(
    "v2 so far: the rhythm section never leaves two steps unstruck",
    WA.every((k) => pulseGap(MUSIC_TRACKS[k].A) <= 1),
    WA.map((k) => k + ":" + pulseGap(MUSIC_TRACKS[k].A)).join(" "),
  );
  check(
    "v2 so far: every bar carries lead AND bass — no dropped-out bars",
    WA.every((k) => {
      const A = MUSIC_TRACKS[k].A,
        b = A.LEN / 8;
      return barsWithLead(A) === b && barsWithBass(A) === b;
    }),
    WA.map(
      (k) =>
        k +
        ":" +
        barsWithLead(MUSIC_TRACKS[k].A) +
        "/" +
        barsWithBass(MUSIC_TRACKS[k].A),
    ).join(" "),
  );
  check(
    "v2 so far: dense but never solid, and at least two waveforms",
    WA.every(
      (k) =>
        occ(MUSIC_TRACKS[k].A) < MUSIC_TRACKS[k].A.LEN &&
        lanes(MUSIC_TRACKS[k].A) &&
        waves(MUSIC_TRACKS[k].A) >= 2,
    ),
    WA.map(
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

// ---- jungle: overgrown, humid, alive (D Dorian, strict call-and-response) ----
{
  const T = MUSIC_TRACKS.jungle,
    A = T.A,
    B = T.B,
    f0 = TONIC.jungle;
  check(
    "jungle STEP 0.117 (128 BPM), D2 73.42 root — room 1 is literally the menu's key",
    A.STEP === 0.117 &&
      A.bass[0].f === 73.42 &&
      Math.abs(B.bass[0].f / A.bass[0].f - 1.189207) < 1e-9,
    A.STEP + "/" + A.bass[0].f,
  );
  check(
    "jungle bass is a 3+3+2 ostinato in ALL EIGHT bars — it never rests a bar",
    A.bass.length === 24 &&
      A.bass.every((n) => [0, 3, 6].includes(n.s % 8)) &&
      barsWithBass(A) === 8,
    A.bass.length +
      ":" +
      [...new Set(A.bass.map((n) => n.s % 8))].sort().join(",") +
      "/" +
      barsWithBass(A),
  );
  check(
    "jungle hat echoes one step behind each tresillo hit — 1/4/7, all eight bars",
    A.hat.length === 24 && A.hat.every((n) => [1, 4, 7].includes(n.s % 8)),
    A.hat.length + ":" + [...new Set(A.hat.map((n) => n.s % 8))].sort().join(","),
  );
  check(
    "jungle interlock leaves single-step pockets at 2 and 5, never a gap",
    pulseGap(A) <= 1 && barsWithLead(A) === 8,
    pulseGap(A) + "/" + barsWithLead(A),
  );
  check(
    "jungle pad is two 32-step canopy drones",
    !!A.pad &&
      A.pad.length === 2 &&
      A.pad.every((n) => Math.round(n.d / A.STEP) === 32) &&
      near(A.pad[0].f, 110, 0.01) &&
      near(A.pad[1].f, 146.83, 0.01),
    JSON.stringify((A.pad || []).map((n) => [n.s, n.f])),
  );
  check(
    "jungle states the motif at bar 0 AND bar 4 — the answer loops between them",
    motifV2At(A.lead, 0, f0) && motifV2At(A.lead, 32, f0),
    motifV2Head(A.lead, f0, 64),
  );
  check(
    "jungle is alive but not solid: 58-63 of 64 steps",
    occ(A) >= 58 && occ(A) <= 63,
    occ(A),
  );
  check("jungle register lanes never cross, A and B", lanes(A) && lanes(B));
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

// ---- water: flowing, undertow (G Mixolydian, PLAIN stretched, pad runs INV) ----
{
  const T = MUSIC_TRACKS.water,
    A = T.A,
    B = T.B;
  check(
    "water STEP 0.15 (100 BPM), G1 49.00 root, B up a perfect fourth",
    A.STEP === 0.15 &&
      A.bass[0].f === 49 &&
      Math.abs(B.bass[0].f / A.bass[0].f - 1.33484) < 1e-9,
    A.STEP + "/" + A.bass[0].f,
  );
  const longs = A.lead.filter((n) => Math.round(n.d / A.STEP) >= 4);
  check(
    "water lead is legato: at least 6 notes of 4+ steps",
    longs.length >= 6,
    longs.length,
  );
  check(
    "at least one lead note starts late in a bar and holds past the bar line",
    A.lead.some((n) => (n.s % 8) + Math.round(n.d / A.STEP) > 8 && n.s % 8 >= 6),
    A.lead
      .filter((n) => n.s % 8 >= 6)
      .map((n) => (n.s % 8) + "+" + Math.round(n.d / A.STEP))
      .join(","),
  );
  check(
    "water bass swells through stepped velocity — 3 or more distinct v values",
    new Set(A.bass.map((n) => n.v)).size >= 3,
    [...new Set(A.bass.map((n) => n.v))].sort().join(","),
  );
  const shared = [...new Set((A.pad || []).map((n) => n.s))]
    .filter((s) => A.lead.some((l) => l.s === s))
    .sort((a, b) => a - b);
  let opp = 0,
    cmp = 0;
  for (let i = 1; i < shared.length; i++) {
    const pf = (s) => A.pad.find((n) => n.s === s).f,
      lf = (s) => A.lead.find((n) => n.s === s).f;
    const dp = pf(shared[i]) - pf(shared[i - 1]),
      dl = lf(shared[i]) - lf(shared[i - 1]);
    if (dp === 0 || dl === 0) continue;
    cmp++;
    if (dp * dl < 0) opp++;
  }
  check(
    "water pad runs INV under the lead — contrary motion at every shared step",
    shared.length >= 4 && cmp >= 3 && opp === cmp,
    opp + "/" + cmp + " over " + shared.length + " shared steps",
  );
  check(
    "water is unhurried: at most 44 of 64 steps, and it breathes",
    occ(A) <= 44 && breathBar(A) >= 0,
    occ(A) + "/" + breathBar(A),
  );
  check("water register lanes never cross, A and B", lanes(A) && lanes(B));
}

// ---- sand: heat-shimmer, mirage (E Phrygian n3 — factory's mode, third raised) ----
{
  const T = MUSIC_TRACKS.sand,
    A = T.A,
    B = T.B,
    f0 = TONIC.sand;
  check(
    "sand STEP 0.134 (112 BPM), opens on its drone FIFTH B2 123.47, B up a semitone",
    A.STEP === 0.134 &&
      A.bass[0].f === 123.47 &&
      Math.abs(B.bass[0].f / A.bass[0].f - 1.059463) < 1e-9,
    A.STEP + "/" + A.bass[0].f,
  );
  /* The drone fifth survives as a COLOUR, not as the whole part: three of the
     four hits a bar are the fifth and two of those are off the beat, so the
     pitch that opened v1's tacet drone is now what the pattern leans on. */
  check(
    "sand bass moves: 32 notes on 0/3/5/7 of all eight bars, none over 3 steps",
    A.bass.length === 32 &&
      A.bass.every((n) => [0, 3, 5, 7].includes(n.s % 8)) &&
      A.bass.every((n) => Math.round(n.d / A.STEP) <= 3) &&
      barsWithBass(A) === 8,
    A.bass.length + ":" + [...new Set(A.bass.map((n) => n.s % 8))].sort().join(","),
  );
  check(
    "sand bass is weighted to the fifth, and off the beat — 24 of its 32 notes",
    A.bass.filter((n) => [0, 5, 7].includes(n.s % 8)).length === 24 &&
      A.bass.filter((n) => [5, 7].includes(n.s % 8)).every((n) => n.s % 2 === 1),
    [...new Set(A.bass.map((n) => n.f))].sort((x, y) => x - y).join(","),
  );
  check(
    "sand hat fills the beats the bass leaves — 2/4/6, all eight bars",
    A.hat.length === 24 && A.hat.every((n) => [2, 4, 6].includes(n.s % 8)),
    A.hat.length + ":" + [...new Set(A.hat.map((n) => n.s % 8))].sort().join(","),
  );
  check(
    "sand states the motif at bars 0 and 4 over the moving bass",
    motifV2At(A.lead, 0, f0) && motifV2At(A.lead, 32, f0),
    motifV2Head(A.lead, f0, 64),
  );
  const GS = [207.65, 415.3];
  const soundsGs = (P) =>
    chansOf(P).some((a) =>
      a.some((n) => GS.some((m) => Math.abs(n.f - m) < 0.02)),
    );
  const others = Object.keys(MUSIC_TRACKS).filter((k) => k !== "sand");
  check(
    "sand.A raises the third to G#, and it is the only A section that sounds it",
    soundsGs(A) && !others.some((k) => soundsGs(MUSIC_TRACKS[k].A)),
    others.filter((k) => soundsGs(MUSIC_TRACKS[k].A)).join(","),
  );
  const appo = A.lead.filter((n) => {
    const nxt = A.lead.find((m) => m.s === n.s + 1);
    return nxt && n.v < nxt.v && GS.some((m) => Math.abs(nxt.f - m) < 0.02);
  });
  check(
    "sand leans into the G# with a quiet one-step appoggiatura before it",
    appo.length >= 1,
    appo.map((n) => n.s).join(","),
  );
  check(
    "sand swells in steps: 3 or more distinct lead velocities — the heat waves",
    new Set(A.lead.map((n) => n.v)).size >= 3,
    [...new Set(A.lead.map((n) => n.v))].sort().join(","),
  );
  check(
    "sand shimmers without stopping: every bar carries lead, pulse never gaps",
    barsWithLead(A) === 8 && pulseGap(A) <= 1,
    barsWithLead(A) + "/" + pulseGap(A),
  );
  check(
    "sand is dense but not solid: 58-63 of 64 steps",
    occ(A) >= 58 && occ(A) <= 63,
    occ(A),
  );
  check("sand register lanes never cross, A and B", lanes(A) && lanes(B));
}

// ---- R3c: the whole score, quantified over all ten tracks ----
{
  const IDS = Object.keys(MUSIC_TRACKS);
  /* The v2 ladder spreads 104-140 BPM at 4 BPM steps. Wave A rows move one per
     commit in migration order; the wave-B rows carry their shipped values until
     their own rewrite, so all ten stay distinct at every commit in between. */
  const LADDER = {
    arena: 0.107,
    crown: 0.11,
    factory: 0.114,
    jungle: 0.117,
    menu: 0.121,
    sand: 0.134,
    ice: 0.129,
    water: 0.15,
    intro: 0.125,
    void: 0.234,
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
  /* The "every track has a breath bar" sweep is GONE, not relocated: direction
     v2 withdrew the shared mandate (spec 2). Occupancy is now banded on both
     sides, so a track cannot drift back toward sparseness either. */
  const BAND = {
    intro: [28, 31],
    menu: [58, 63],
    jungle: [58, 63],
    ice: [58, 63],
    factory: [56, 62],
    water: [0, 44],
    arena: [56, 62],
    sand: [58, 63],
    void: [0, 20],
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

console.log("\n  MUSIC RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
