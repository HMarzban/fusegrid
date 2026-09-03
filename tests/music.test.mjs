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
    "STEP=0.15 LEN=64 (100BPM eighths, 8 bars)",
    MUSIC_PATTERN.STEP === 0.15 && MUSIC_PATTERN.LEN === 64,
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
    "bass 8 bars x 4 notes = 32",
    MUSIC_PATTERN.bass.length === 32,
    MUSIC_PATTERN.bass.length,
  );
  check(
    "lead doubled to octave-up bars 5-8 (30 entries)",
    MUSIC_PATTERN.lead.length === 30,
    MUSIC_PATTERN.lead.length,
  );
  check(
    "hats on odd steps only",
    MUSIC_PATTERN.hat.length === 32 &&
      MUSIC_PATTERN.hat.every((n) => n.s % 2 === 1),
  );
  const bassByS = new Map(MUSIC_PATTERN.bass.map((n) => [n.s, n]));
  check(
    "A-A-F-G roots (A1=55 F1=43.65 G1=49)",
    bassByS.get(0).f === 55 &&
      bassByS.get(2).f === 55 &&
      bassByS.get(4).f === 82.4 &&
      bassByS.get(16).f === 43.65 &&
      bassByS.get(24).f === 49,
  );
  const leadLo = new Map(
    MUSIC_PATTERN.lead.filter((n) => n.s < 32).map((n) => [n.s, n]),
  );
  const octOk = MUSIC_PATTERN.lead
    .filter((n) => n.s >= 32)
    .every(
      (n) => leadLo.has(n.s - 32) && near(n.f, leadLo.get(n.s - 32).f * 2),
    );
  check("bars 5-8 lead is bars 1-4 up one octave", octOk);
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
  const T_OF = { bass: "square", lead: "square", hat: "triangle" },
    V_OF = { bass: 0.1, lead: 0.07, hat: 0.02 };
  check(
    "B instrument mix matches A exactly (count+type+volume per track)",
    ["bass", "lead", "hat"].every(
      (k) =>
        MUSIC_PATTERN_B[k].length === MUSIC_PATTERN[k].length &&
        MUSIC_PATTERN_B[k].every((n) => n.t === T_OF[k] && near(n.v, V_OF[k])),
    ),
    MUSIC_PATTERN_B.bass.length +
      "," +
      MUSIC_PATTERN_B.lead.length +
      "," +
      MUSIC_PATTERN_B.hat.length,
  );
  check(
    "B hats on odd steps only",
    MUSIC_PATTERN_B.hat.length === 32 &&
      MUSIC_PATTERN_B.hat.every((n) => n.s % 2 === 1),
  );
  const roots = (p) =>
    [0, 8, 16, 24].map((s) => p.bass.find((n) => n.s === s).f);
  check(
    "B root progression differs from A",
    JSON.stringify(roots(MUSIC_PATTERN_B)) !==
      JSON.stringify(roots(MUSIC_PATTERN)),
    roots(MUSIC_PATTERN).join("/") + " vs " + roots(MUSIC_PATTERN_B).join("/"),
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
  check(
    "frame pump advances lookahead monotonically",
    ac.starts.every((s, i) => i === 0 || s.t >= ac.starts[i - 1].t) &&
      ac.starts.some((s) => near(s.t, 0.2, 1e-9)),
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
  check(
    "seamless wrap: step k+256 === step k (full AABB cycle)",
    wrap && probe > 250,
    "compared " + probe + " steps",
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
  } // 52s ≈ 346 steps
  // B-exclusive pitches (absent from every A track: A bass is
  // {55,82.4,43.65,65.4,49,73.42}, A lead >=196): Bb1 root/quint family + A2
  const isBmark = (f) =>
    [110, 58.27, 87.31].some((m) => Math.abs(f - m) < 0.02);
  const isB = new Set();
  // derive the anchor from the first start: unlock's nextT=now+0.05 may be
  // clamped once if the first pump lags the clock — shift cancels in k-space
  const t0 = ac.starts[0].t,
    S = MUSIC_PATTERN.STEP;
  for (const st of ac.starts)
    if (isBmark(st.f)) isB.add(Math.round((st.t - t0) / S));
  // B bass marker steps within a 64-step section: D bar quint (4), Bb bar
  // roots+quints (16,18,20,22), then the octave-up repeat (+32)
  const EXP = [4, 16, 18, 20, 22, 36, 48, 50, 52, 54];
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
    MUSIC_TRACKS.sand.A.STEP === 0.17 &&
      MUSIC_TRACKS.void.A.STEP === 0.19 &&
      MUSIC_TRACKS.crown.A.STEP === 0.13 &&
      MUSIC_TRACKS.sand.A.bass[0].f === 69.3 &&
      MUSIC_TRACKS.void.A.bass[0].f === 49 &&
      MUSIC_TRACKS.crown.A.bass[0].f === 98,
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
      musicCue(SCREEN.SCORES, 1) === "menu",
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
    "water downbeat is B1=61.74, not menu A1",
    ac.starts.some((s) => near(s.f, 61.74, 0.05)) &&
      !ac.starts.some((s) => near(s.f, 55, 0.05)),
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
    "setTrack menu restores A1=55 identity bass",
    ac.starts.some((s) => near(s.f, 55, 0.05)),
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

console.log("\n  MUSIC RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
