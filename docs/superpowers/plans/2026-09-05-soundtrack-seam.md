# R3a — engine seam + bounce harness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the score an audible verification path without moving a single
note. `src/audio.js` gains an injectable `AudioContext` and one bulk scheduler;
`src/audio/tracks.js` gains the `[s, f, d, v?]` note tuple; `tools/bounce/`
gains a dev-only page that renders any track to a WAV file through
`OfflineAudioContext`. **No track data changes** — every existing music pin
passes byte-identically, which is the property that makes this wave reviewable.

**Architecture:** Additive only. `bounceTrack` reuses the *same*
`patOf()` / `emitStep()` / `note()` the live path uses and owns a **local `t`
starting at 0** — `nextT` is never read and never written, so a stray call
cannot desync a live `pump()`. It returns `0` when `!ctx || !musicGain`, and
nothing under `src/` calls it: in production it is unreachable code that no
`window` path enters. The `v?` tuple is a source-encoding change in three
readers inside `tracks.js`; the note schema `{s, f, d, t, v}` is unchanged.
Everything else lives outside `src/`, absent from `src/pwa/shell.js`'s `SRC`
list, never referenced from `index.html`.

**Tech Stack:** Pure ES modules, WebAudio, `node --test` / `tests/*.test.mjs`,
`node:http`. Zero npm runtime deps. No samples, no `decodeAudioData`. The WAV
encoder is hand-rolled RIFF/PCM16.

**Spec:** `docs/superpowers/specs/2026-09-05-soundtrack-design.md` §3, §7

**Depends on:** nothing. This is the first wave of program R3.

## Global Constraints

- **Zero track-content change.** After this plan, a dump of every note in
  `MUSIC_TRACKS` must be byte-identical to the dump taken before it. Task 2
  proves this with an explicit before/after diff.
- **`src/audio.js` gains exactly two things** — `createAudio(opts)` honouring
  `opts.ctx`, and `bounceTrack(id, seconds)` on the returned object. Not a
  `src/audio/sched.js` extraction: that is the same bytes relocated plus a new
  precache entry and an extra module fetch, and it costs a rewrite of the live
  scheduler (`note`/`emitStep`/`patOf` all close over `ctx`, `musicGain` or
  `curId`). `pump()` is left alone.
- **`main.js` is untouched.** Callers that pass nothing behave byte-identically.
- `audio.js` must stay free of `Math.random` / `Date.` / `setInterval` — the
  seam and `bounceTrack` use none (`music.test.mjs:983-992` is a literal grep).
- **`tools/bounce/**` and every WAV output are never precached and never
  referenced from `index.html`.** Their commits get **no PWA bump**. The commits
  that touch `src/audio.js` or `src/audio/tracks.js` **do** — read
  `src/pwa/shell.js:1` and `sw.js:3` first, bump both together, `current vN →
  vN+1`.
- SFX tables, tints, the `reveal` cue, `duck`, `setVols`, `MUS_PAN`,
  `musicCue` and the ten-key `MUSIC_TRACKS` set do not change.
- No comments unless the file already uses explanatory block comments — both
  `audio.js` and `tracks.js` do. Match their compact style.
- Never write the banned grid-bomb franchise name into any committed file.
- **Tasks run in order.** Task 4 cannot bounce anything until Tasks 1 and 3 land.

---

### Task 1: `createAudio({ctx})` and `bounceTrack(id, seconds)`

**Files:**
- Modify: `src/audio.js` — `createAudio` signature (`:43`), `ctx` initializer
  (`:44`), new `bounceTrack` beside `pump` (after `:300`), returned object
  (`:301-475`)
- Modify: `tests/music.test.mjs` — two new blocks appended before the
  `MUSIC RESULT` summary (`:1065`)
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `createAudio(opts)` — `opts.ctx`, when present, is used instead of
    `window.AudioContext` inside `ensure()`
  - `bounceTrack(id, seconds) -> stepCount` on the returned object (11 keys now)

- [ ] **Step 1: Write the failing tests**

Append both blocks to `tests/music.test.mjs`, immediately **before** the final
`console.log("\n  MUSIC RESULT: ...")` line:

```js
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
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/music.test.mjs
```

Expected: FAIL — `bounceTrack is on the returned object` fails, and the checks
after it throw on `a.bounceTrack is not a function`.

- [ ] **Step 3: Implement** — `src/audio.js`

Change the factory signature and the `ctx` initializer (`audio.js:43-44`):

```js
export function createAudio(opts) {
  let ctx = (opts && opts.ctx) || null,
```

`ensure()` is left exactly as it is — a pre-seeded `ctx` makes its `if (!ctx)`
guard skip the `window.AudioContext` lookup, which is the whole seam.

Add `bounceTrack` immediately after `pump()` (`audio.js:300`), before the
`return {` block:

```js
  /* Offline bulk scheduler — dev-only (tools/bounce/), unreachable in the
     shipped game: nothing under src/ calls it. Walks steps from a LOCAL t=0
     through the same patOf/emitStep/note the live path uses; nextT is never
     read or written, so a stray call cannot desync pump(). */
  function bounceTrack(id, seconds) {
    if (!ctx || !musicGain) return 0;
    const pid = curId,
      pstep = stepN;
    if (id && MUSIC_TRACKS[id]) curId = id;
    let t = 0,
      n = 0;
    while (t < seconds) {
      const P = patOf(n);
      emitStep(P, n % P.LEN, t);
      t += P.STEP;
      n++;
    }
    curId = pid;
    stepN = pstep;
    return n;
  }
```

Add `bounceTrack,` to the returned object, beside `pump,`.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green. Every pre-existing music pin must still pass untouched —
if any of them moved, the seam was not additive.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/audio.js tests/music.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add an injectable AudioContext and a bulk bounce scheduler to the audio engine.

createAudio(opts) seeds the module-closure ctx from opts.ctx so ensure() skips
the window lookup; callers that pass nothing are byte-identical and main.js is
untouched. bounceTrack(id, seconds) walks steps from a local t=0 through the
same patOf/emitStep/note the live path uses — it never reads or writes nextT,
so it cannot desync pump(), and nothing under src/ calls it.

This is the seam an offline WAV render needs: pump()'s lookahead relies on wall
time elapsing between RAF calls, which an OfflineAudioContext never provides.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: the `[s, f, d, v?]` note tuple — three readers, zero content change

**Files:**
- Modify: `src/audio/tracks.js` — `MUSIC_PATTERN`'s IIFE `E` (`:59`),
  `MUSIC_PATTERN_B`'s IIFE `E` (`:125`), `mkPat`'s inner `E` (`:137-140`),
  `pulse` (`:152-159`), `oct` (`:160-169`), `hats` (`:170-174`)
- Modify: `tests/music.test.mjs` — one new block appended before the
  `MUSIC RESULT` summary
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: nothing new
- Produces: note tuples may be `[s, f, d]` (v falls back to the channel's `mix`
  value) or `[s, f, d, v]` (v overrides for that note only). `pulse` takes
  `[root, fifth, v?]` triples; `oct` passes a phrase tuple's 4th element to both
  the low and the octave-up copy; `hats(L, f, step, v?)` stamps `v` on every
  tick. The note schema `{s, f, d, t, v}` is unchanged, and `transp` already
  copies `v` per note, so a per-note `v` survives transposition.

- [ ] **Step 1: Capture the "before" dump and write the failing test**

Dump every note in the table before touching anything:

```bash
node --input-type=module -e '
import { MUSIC_TRACKS } from "./src/audio/tracks.js";
const out = [];
for (const id of Object.keys(MUSIC_TRACKS)) {
  const tr = MUSIC_TRACKS[id];
  for (const sec of ["A", "B"]) {
    const P = tr[sec];
    if (!P) { out.push(id + "." + sec + " = null"); continue; }
    out.push(id + "." + sec + " STEP=" + P.STEP + " LEN=" + P.LEN);
    for (const k of ["bass", "lead", "hat", "pad"]) {
      const a = P[k];
      if (!a) { out.push(id + "." + sec + "." + k + " = undefined"); continue; }
      for (const n of a) out.push([id, sec, k, n.s, n.f, n.d, n.t, n.v].join("\t"));
    }
  }
}
console.log(out.join("\n"));
' > /tmp/fusegrid-tracks-before.txt
wc -l /tmp/fusegrid-tracks-before.txt
```

Append this block to `tests/music.test.mjs`, before the `MUSIC RESULT` line:

```js
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
  const spread = chans.filter(([, a]) => new Set(a.map((n) => n.v)).size !== 1);
  check(
    "every channel stamps exactly one v — stepped dynamics land in R3c, not here",
    chans.length > 30 && spread.length === 0,
    chans.length + " channels, spread: " + spread.map(([n]) => n).join(","),
  );
}
```

- [ ] **Step 2: Run to see PASS (this pin guards, it does not drive)**

```bash
node --test tests/music.test.mjs
```

Expected: green. This is the **guard** pin — it documents that no channel
carries mixed velocities today and it is what the R3c `water` task deliberately
retires. The *driving* proof for this task is the before/after diff in Step 4.

- [ ] **Step 3: Implement** — `src/audio/tracks.js`

Replace the tuple reader in `MUSIC_PATTERN`'s IIFE (`:59`) **and** the identical
one in `MUSIC_PATTERN_B`'s IIFE (`:125`) with:

```js
  const E = (a, t, v) =>
    a.map(([s, f, d, nv]) => ({ s, f, d: d * S, t, v: nv == null ? v : nv }));
```

Replace `mkPat`'s inner `E` (`:137-140`) with:

```js
  const E = (a, t, v) =>
    Object.freeze(
      a.map(([s, f, d, nv]) =>
        Object.freeze({ s, f, d: d * S, t, v: nv == null ? v : nv }),
      ),
    );
```

Replace the three helpers so the 4th element travels:

```js
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
```

Update the header comment block at `tracks.js:4-6` so it names the new tuple:
`[step, freqHz, durSteps, vel?]`, `vel` defaulting to the channel's mix value.

Every existing call site passes 2-element roots, 3-element phrase tuples and a
3-argument `hats`, so `nv`/`v` is `undefined` at every one of them and each note
falls back to the channel's `mix` value — the reason this edit is inert.

- [ ] **Step 4: Prove zero content change**

```bash
node --input-type=module -e '
import { MUSIC_TRACKS } from "./src/audio/tracks.js";
const out = [];
for (const id of Object.keys(MUSIC_TRACKS)) {
  const tr = MUSIC_TRACKS[id];
  for (const sec of ["A", "B"]) {
    const P = tr[sec];
    if (!P) { out.push(id + "." + sec + " = null"); continue; }
    out.push(id + "." + sec + " STEP=" + P.STEP + " LEN=" + P.LEN);
    for (const k of ["bass", "lead", "hat", "pad"]) {
      const a = P[k];
      if (!a) { out.push(id + "." + sec + "." + k + " = undefined"); continue; }
      for (const n of a) out.push([id, sec, k, n.s, n.f, n.d, n.t, n.v].join("\t"));
    }
  }
}
console.log(out.join("\n"));
' > /tmp/fusegrid-tracks-after.txt
diff /tmp/fusegrid-tracks-before.txt /tmp/fusegrid-tracks-after.txt && echo "IDENTICAL"
node --test
```

Expected: `diff` prints nothing and echoes `IDENTICAL`; `node --test` is all
green. If `diff` reports a single line, the edit was not inert — fix it before
committing, do not update the dump.

Note honestly what this does **not** prove: that a 4th element is actually
*honoured*. No track authors one yet, so the first permanent proof of the
pass-through arrives with R3c's `water` task, where `A.bass` needs
`new Set(map(n => n.v)).size >= 3`.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/audio/tracks.js tests/music.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Teach the three note-tuple readers a per-note velocity: [s, f, d, v?].

mkPat's E stamps one v on every note in a channel, so stepped dynamics — the
direction brief's main maturity lever — could not be authored at all. Both
pattern IIFEs carry their own copy of that reader, so all three change together
or menu can never author a swell.

pulse/oct/hats pass the 4th element through. Every existing call site passes
three, so every note falls back to the channel's mix value and the whole table
dumps byte-identical before and after. transp already copies v per note.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `tools/bounce/` — the offline WAV harness

**Files:**
- Create: `tools/bounce/wav.js`, `tools/bounce/bounce.js`,
  `tools/bounce/index.html`, `tools/bounce/sink.mjs`
- Create: `tests/wav.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `createAudio` (`src/audio.js`), `MUSIC_TRACKS` (`src/audio.js`
  re-export)
- Produces:
  - `encodeWav(buf) -> Uint8Array` — 44-byte RIFF header + interleaved PCM16
  - `bounceAll()` on the page — renders all ten and POSTs each to the sink
  - `node tools/bounce/sink.mjs [--port 8081] [--out <dir>]`

- [ ] **Step 1: Write the failing test**

Create `tests/wav.test.mjs`:

```js
import { encodeWav } from "../tools/bounce/wav.js";

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
const mkBuf = (chans, len, rate) => ({
  numberOfChannels: chans.length,
  sampleRate: rate,
  length: len,
  getChannelData: (i) => chans[i],
});

{
  const L = Float32Array.from([0, 0.5, -0.5, 1]);
  const R = Float32Array.from([0, -1, 2, -2]);
  const w = encodeWav(mkBuf([L, R], 4, 44100));
  const dv = new DataView(w.buffer, w.byteOffset, w.byteLength);
  const str = (o, n) => String.fromCharCode(...w.slice(o, o + n));
  check(
    "RIFF / WAVE / fmt  / data chunk ids",
    str(0, 4) === "RIFF" &&
      str(8, 4) === "WAVE" &&
      str(12, 4) === "fmt " &&
      str(36, 4) === "data",
    str(0, 4) + str(8, 4) + str(12, 4) + str(36, 4),
  );
  check(
    "44-byte header + 2ch x 4 frames x 2 bytes",
    w instanceof Uint8Array && w.length === 44 + 16,
    w.length,
  );
  check(
    "RIFF size = total - 8, fmt size 16, data size = payload",
    dv.getUint32(4, true) === w.length - 8 &&
      dv.getUint32(16, true) === 16 &&
      dv.getUint32(40, true) === 16,
    dv.getUint32(4, true) + "/" + dv.getUint32(40, true),
  );
  check(
    "PCM16 stereo @44100: blockAlign 4, byteRate 176400",
    dv.getUint16(20, true) === 1 &&
      dv.getUint16(22, true) === 2 &&
      dv.getUint32(24, true) === 44100 &&
      dv.getUint32(28, true) === 176400 &&
      dv.getUint16(32, true) === 4 &&
      dv.getUint16(34, true) === 16,
  );
  check(
    "frames interleave L,R,L,R",
    dv.getInt16(44, true) === 0 &&
      dv.getInt16(46, true) === 0 &&
      dv.getInt16(48, true) === 16384 &&
      dv.getInt16(50, true) === -32767 &&
      dv.getInt16(52, true) === -16383,
    [44, 46, 48, 50, 52].map((o) => dv.getInt16(o, true)).join(","),
  );
  check(
    "out-of-range samples clamp to +/-32767",
    dv.getInt16(54, true) === 32767 && dv.getInt16(58, true) === -32767,
    dv.getInt16(54, true) + "," + dv.getInt16(58, true),
  );
}
{
  const M = Float32Array.from([0.25, -0.25]);
  const w = encodeWav(mkBuf([M], 2, 22050));
  const dv = new DataView(w.buffer, w.byteOffset, w.byteLength);
  check(
    "mono @22050: 1 channel, blockAlign 2, byteRate 44100, 4 payload bytes",
    w.length === 44 + 4 &&
      dv.getUint16(22, true) === 1 &&
      dv.getUint32(24, true) === 22050 &&
      dv.getUint32(28, true) === 44100 &&
      dv.getUint16(32, true) === 2,
    w.length,
  );
}

console.log("\n  WAV RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/wav.test.mjs
```

Expected: FAIL — `Cannot find module .../tools/bounce/wav.js`.

- [ ] **Step 3: Implement**

**3a — `tools/bounce/wav.js`** (pure, DOM-free, zero deps, Node-importable):

```js
/* Hand-rolled RIFF/PCM16 encoder — zero deps, so no wavefile/audiobuffer-to-wav
   package. Takes anything AudioBuffer-shaped ({numberOfChannels, sampleRate,
   length, getChannelData(i)}) so Node can test it against a synthetic object. */
export function encodeWav(buf) {
  const ch = buf.numberOfChannels,
    rate = buf.sampleRate,
    len = buf.length;
  const bytes = len * ch * 2,
    out = new Uint8Array(44 + bytes),
    dv = new DataView(out.buffer);
  const tag = (o, s) => {
    for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i);
  };
  tag(0, "RIFF");
  dv.setUint32(4, 36 + bytes, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, ch, true);
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * ch * 2, true);
  dv.setUint16(32, ch * 2, true);
  dv.setUint16(34, 16, true);
  tag(36, "data");
  dv.setUint32(40, bytes, true);
  const src = [];
  for (let c = 0; c < ch; c++) src.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++)
    for (let c = 0; c < ch; c++, o += 2) {
      const x = Math.max(-1, Math.min(1, src[c][i]));
      dv.setInt16(o, Math.round(x * 32767), true);
    }
  return out;
}
```

**3b — `tools/bounce/bounce.js`**:

```js
import { createAudio, MUSIC_TRACKS } from "../../src/audio.js";
import { encodeWav } from "./wav.js";

export const IDS = Object.freeze([
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
]);
export const lengthOf = (id) => {
  const t = MUSIC_TRACKS[id];
  return Math.max(20, t.A.LEN * t.sections.length * t.A.STEP + 2);
};
/* unlock() calls ctx.resume() whenever ctx.state is "suspended", which is
   exactly an OfflineAudioContext's state before startRendering(); where that
   call throws, unlock()'s catch would swallow it and skip building musicGain,
   and bounceTrack would return 0. The shim reports "running" and forwards every
   factory to the real context — including createStereoPanner, because emitStep
   sets p from MUS_PAN on EVERY music note. Shipped code stays at two additions. */
function shim(ctx) {
  return {
    state: "running",
    resume() {},
    get currentTime() {
      return ctx.currentTime;
    },
    get sampleRate() {
      return ctx.sampleRate;
    },
    get destination() {
      return ctx.destination;
    },
    createGain: () => ctx.createGain(),
    createOscillator: () => ctx.createOscillator(),
    createStereoPanner: () => ctx.createStereoPanner(),
    createBiquadFilter: () => ctx.createBiquadFilter(),
    createBuffer: (a, b, c) => ctx.createBuffer(a, b, c),
    createBufferSource: () => ctx.createBufferSource(),
  };
}
export async function renderTrack(id, rate) {
  const secs = lengthOf(id),
    sr = rate || 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(secs * sr), sr);
  const a = createAudio({ ctx: shim(ctx) });
  a.unlock();
  const steps = a.bounceTrack(id, secs);
  const wav = encodeWav(await ctx.startRendering());
  return { id, secs, steps, wav };
}
export async function post(sink, id, wav) {
  const r = await fetch(sink + "/" + id + ".wav", { method: "POST", body: wav });
  if (!r.ok) throw new Error(id + ": sink " + r.status);
}
```

**3c — `tools/bounce/index.html`** — a dev page, not part of the game. It
imports `./bounce.js`, reads the sink URL from an input defaulting to
`http://127.0.0.1:8081`, and offers one button per id plus a **BOUNCE ALL**
button that loops `IDS`, calls `renderTrack(id)` then `post(sinkUrl, id, wav)`,
and appends one line per track (`id · seconds · steps · bytes · ok/error`) to a
`<pre>` log. No styling beyond a monospace body. **It is never linked from
`index.html` and never added to `src/pwa/shell.js`'s `SRC` list.**

**3d — `tools/bounce/sink.mjs`**:

```js
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const OUT = resolve(arg("--out", "tools/bounce/out"));
const PORT = Number(arg("--port", "8081"));
mkdirSync(OUT, { recursive: true });

createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  if (req.method !== "POST") return res.writeHead(405).end("POST only");
  const name = basename(decodeURIComponent(req.url || "")).replace(
    /[^a-z0-9._-]/gi,
    "",
  );
  if (!/^[a-z0-9._-]+\.wav$/i.test(name))
    return res.writeHead(400).end("bad name");
  const parts = [];
  req.on("data", (c) => parts.push(c));
  req.on("end", () => {
    const b = Buffer.concat(parts);
    writeFileSync(resolve(OUT, name), b);
    console.log(name + "  " + b.length + " bytes");
    res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
  });
}).listen(PORT, "127.0.0.1", () =>
  console.log("bounce sink -> " + OUT + "  on http://127.0.0.1:" + PORT),
);
```

**3e — `.gitignore`.** Append, after the `e2e-artifacts/` block:

```
# Offline music bounces: regenerated on demand, never shipped, never reviewed
tools/bounce/out/
```

(`.superpowers/sdd/**` is already ignored by `.superpowers/sdd/.gitignore`, so
bounces written there need no new rule. **No WAV is ever committed.**)

- [ ] **Step 4: Run to PASS**

```bash
node --test
```

Expected: all green, including the new `tests/wav.test.mjs`.

Confirm the harness is genuinely outside the shipped surface:

```bash
grep -rn "tools/bounce" src/ index.html sw.js || echo "NOT SHIPPED — correct"
grep -n "bounce" src/pwa/shell.js || echo "NOT PRECACHED — correct"
```

Expected: both echo their message and print nothing else.

- [ ] **Step 5: Commit (no PWA bump — nothing precached changed)**

```bash
git add tools/bounce/wav.js tools/bounce/bounce.js tools/bounce/index.html tools/bounce/sink.mjs tests/wav.test.mjs .gitignore
git commit -m "$(cat <<'EOF'
Add the dev-only offline bounce harness under tools/bounce/.

An OfflineAudioContext page drives bounceTrack, renders each track through the
same voice graph the game uses, and POSTs a hand-rolled RIFF/PCM16 file to a
node:http sink. Zero deps, no samples, nothing under src/ imports it, and it is
absent from the PWA precache — so no cache bump.

bounce.js shims the offline context to report state "running": unlock() calls
resume() on a suspended ctx, and an offline context is suspended until
startRendering(), which would cost us musicGain. The shim forwards every
factory including createStereoPanner, since emitStep pans every music note.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: bounce the ten current tracks as the "before" reference

**Files:**
- Modify: `MEMORY.md`

**Interfaces:**
- Consumes: `tools/bounce/sink.mjs`, `tools/bounce/index.html`
- Produces: ten WAVs in `.superpowers/sdd/2026-09-05-soundtrack/wav/before/`
  (gitignored) — the A/B reference every later listening checkpoint compares
  against

- [ ] **Step 1: Start the sink and the static server**

```bash
mkdir -p .superpowers/sdd/2026-09-05-soundtrack/wav/before
node tools/bounce/sink.mjs --out .superpowers/sdd/2026-09-05-soundtrack/wav/before &
npm start &
```

- [ ] **Step 2: Bounce all ten**

Open `http://127.0.0.1:8080/tools/bounce/index.html`, leave the sink URL at
`http://127.0.0.1:8081`, press **BOUNCE ALL**. Ten lines must log `ok`, and the
sink terminal must print ten filenames with byte counts.

- [ ] **Step 3: Verify the reference set**

```bash
ls -l .superpowers/sdd/2026-09-05-soundtrack/wav/before/
```

Expected: exactly ten files — `intro.wav menu.wav jungle.wav ice.wav
factory.wav water.wav arena.wav sand.wav void.wav crown.wav`. Sizes must match
`44 + ceil(seconds * 44100) * 4` bytes for each id's
`Math.max(20, LEN * sections.length * STEP + 2)` — roughly 3.5 MB for the 20 s
`intro`, 7.5 MB for the 42.8 s `menu` at today's `STEP 0.15`. A file at exactly
44 bytes means `bounceTrack` returned 0 — the shim or `unlock()` failed; fix
before proceeding.

- [ ] **Step 4: Listen once, as the baseline**

Play the ten in run order. This is not a pass/fail gate — it is the "what
shipped" recording that R3b and R3c A/B against. Note in one line per track what
the current version sounds like, so the later comparison is against a written
impression and not a memory.

```bash
git status --short
```

Expected: no WAV appears — they are all inside an ignored tree. If any shows up
as untracked, stop and fix the ignore rule before committing.

- [ ] **Step 5: MEMORY + commit (no PWA bump)**

Append to `MEMORY.md` under a `## 2026-09-05 — R3a soundtrack seam` heading
(newest first, 1–2 lines): that `createAudio({ctx})` + `bounceTrack` now let an
`OfflineAudioContext` render any track to WAV via `tools/bounce/` (dev-only,
never precached, `out/` gitignored), that `tracks.js` note tuples accept an
optional 4th velocity element which no track authors yet, and that the ten
pre-rewrite bounces are parked in
`.superpowers/sdd/2026-09-05-soundtrack/wav/before/` as the A/B reference for
waves 1 and 2.

```bash
git add MEMORY.md
git commit -m "$(cat <<'EOF'
Bounce the ten shipped tracks as the before-reference for the R3 rewrite.

Nothing has ever been listened to before shipping in this repo; every music
test is structural. These ten WAVs are the baseline the wave-1 and wave-2
listening gates A/B against, parked in an ignored tree — audio is never
committed.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
