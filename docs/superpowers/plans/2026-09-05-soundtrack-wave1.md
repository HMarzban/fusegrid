# R3b — wave 1: intro, menu, arena, void, crown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write the motif's whole arc — bare statement (`intro`), home theme
(`menu`), anticipation (`arena`), subtraction (`void`), resolution (`crown`) —
so the spine is proved before the five `transp` biomes follow it. Four of these
five get a genuinely hand-authored B. This wave carries most of the ABI ledger.

**Architecture:** Data only. Every change is a note table in
`src/audio/tracks.js` plus the pins in `tests/music.test.mjs` that hold it.
`mkPat`/`pulse`/`oct`/`hats`/`transp`/`tr` keep the shapes R3a gave them; no new
builder, no pattern-player abstraction, no engine edit. `MUSIC_PATTERN` and
`MUSIC_PATTERN_B` stay the exported bindings `menu.A`/`menu.B` point at
(`music.test.mjs:695-700` is an identity pin).

Every A section is pure white-key against a parent collection whose home is
D Dorian, with exactly one chromatic guest in this wave: **F♯, in `menu.B`**.

**Tech Stack:** Pure ES modules, WebAudio oscillators only, `node --test`.
Zero npm deps, no samples. Integer steps only — no fractional `s`, no smaller
`STEP` bought to fake triplets.

**Spec:** `docs/superpowers/specs/2026-09-05-soundtrack-design.md` §1, §2, §5, §6

**Depends on:** R3a (`docs/superpowers/plans/2026-09-05-soundtrack-seam.md`) —
the bounce harness and the `[s, f, d, v?]` tuple must both be landed and green.

## Global Constraints

- **Tasks run strictly in order: helpers → intro → menu → arena → void → crown →
  cross-track → listen.** Do not parallelize. `crown.B.hat` deep-equals
  `arena.A.hat` by step pattern, and three tempo/root pre-moves are folded into
  specific commits (below) without which `music.test.mjs:701-718` and `:719-732`
  go red mid-wave.
- **Three pre-moves ride in the commit of the track that forces them.** They are
  the minimum edit that keeps the two distinctness pins green at every commit
  boundary while wave-2 data is still old:
  - `sand.A.STEP` `0.17 → 0.139` — **with the `intro` task** (intro's new
    `0.170` *is* `0.17`).
  - `water.A.bass[0].f` `61.74 → 49.00` — **in the same commit as** `void`'s
    `49 → 61.74`. This pair is a swap, not a stagger: split across two commits,
    one of them is always red.
  - `factory.A.bass[0].f` `65.41 → 82.41` — **with the `crown` task** (crown
    takes 65.41; 82.41 is factory's own new E2 tonic and is distinct from
    jungle's 82.4).
  Nothing else about those three tracks moves here. `sand`'s `d` values stay
  baked at `steps × 0.17`, so sand plays ~22 % legato for one wave. Intentional;
  R3c rewrites it.
- **Wave 1 authors ONE `v` per channel.** The `[s,f,d,v?]` tuple exists but its
  first user is R3c's `water`. If a track here genuinely needs stepped dynamics,
  narrow R3a's uniform-`v` pin in the same commit and re-home its ledger row —
  never leave it red.
- **All-ten-quantified pins belong to R3c**, because they are evaluated against
  pre-rewrite wave-2 data while this wave is in flight. Wave 1 asserts the same
  properties restricted to its five tracks. The two exceptions, safe here and
  pinned in Task 7: the `B.hat` staging pair, and "exactly one sine lead".
- Shared and pinned once for all five: `LEN = 64` (`intro` 32); `sections =
  ["A","A","B","B"]` (`intro` `["A"]`); `max(bass.f) < min(lead.f)`; no track
  puts a note on all 64 steps; every track has a **breath bar** — 8 consecutive
  steps with zero `lead` notes.
- **Panning is untouched.** `MUS_PAN` stays `{bass:-0.32, lead:0.32, hat:0.1,
  pad:-0.06}` and **no track authors `n.p`.**
- **Durations are never pinned by equality** — always `Math.round(n.d / P.STEP)`
  or an inequality.
- `duck`, `setVols`, `MUS_BASE`/`MUS_DUCK`/`MUS_FLOOR`, the SFX
  direct-to-destination path, the `reveal` cue, the ten `MUSIC_TRACKS` keys and
  `musicCue`'s routing do not change. Nothing reaches `src/core/`.
- **PWA:** every commit that touches `src/audio/tracks.js` bumps `CACHE_NAME`
  (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`) together, `current vN → vN+1`.
  **Read the current value first.** Tests-only and `MEMORY.md`-only commits get
  no bump.
- No comments unless the file already uses explanatory block comments —
  `tracks.js` does. Match its compact style.
- Never write the banned grid-bomb franchise name into any committed file.

**Motif vocabulary** (locked; every transformation lands on whole steps):

| Name | Definition | Steps / durations |
|---|---|---|
| `PLAIN` | 1̂ 3̂ 5̂ 6̂ 5̂ as authored | 0,1,2,3,6 / 1,1,1,3,1 |
| `AUG` | ×2 durations, two bars | 0,2,4,6,12 / 2,2,2,6,2 |
| `FRAG-MID` | notes 2–4 only (3̂ 5̂ 6̂) | 1,2,3 / 1,1,3 |
| `ANTIC` | whole figure one step early | b·8−1 … / same |
| `INV` | scale-step mirror below the tonic | 0,1,2,3,6 / 1,1,1,3,1 |
| `CANON` | `PLAIN` restated in a second channel 8 steps later | +8 |
| `RESOLVED` | `PLAIN` + a 6th note, 1̂ one octave above the head | +7 / 2 |

---

### Task 1: shared pin helpers — tonic-relative motif detection

**Files:**
- Modify: `tests/music.test.mjs` — one helper block inserted **immediately after
  the `near` definition (`:22`)**, before the fake-`AudioContext` section

**Interfaces:**
- Consumes: nothing
- Produces (module-local to the test file): `TONIC`, `semi`, `pcOf`, `isDeg`,
  `DEG1`/`DEG3`/`DEG5`/`DEG6`, `figureAt`, `motifAt`, `fragMidAt`, `motifHead`,
  `chansOf`, `occ`, `breathBar`, `lanes`, `waves`, `soundsDeg`

**Placement matters:** the wrap-consistency block at `:349-390` calls `occ`, and
a `const` is in its temporal dead zone before its own line. The helpers go near
the top of the file, not at the bottom with the new track blocks.

- [ ] **Step 1: Write the helpers and their self-tests**

Insert after `const near = ...` (`music.test.mjs:22`):

```js
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
const soundsDeg = (P, f0, d) =>
  ["bass", "lead", "pad"].some(
    (k) => P[k] && P[k].some((n) => isDeg(n.f, f0, [d])),
  );
```

Append the self-tests as a new block **at the end of the file**, before the
`MUSIC RESULT` line (they run over synthetic literals, not track data, so they
are green the moment the helpers exist):

```js
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
```

- [ ] **Step 2: Run to PASS**

```bash
node --test tests/music.test.mjs
```

Expected: green, including every pre-existing pin. No track data has moved yet.

- [ ] **Step 3: Commit (no PWA bump — tests only)**

```bash
git add tests/music.test.mjs
git commit -m "$(cat <<'EOF'
Add tonic-relative motif helpers to the music tests.

motifAt/fragMidAt/motifHead match scale degrees as pitch classes above a frozen
TONIC table, not against A.bass[0].f — intro's bass sits on the dominant and
sand's on the drone fifth, so inferring the tonic from the bass would measure
the wrong intervals on two tracks. One degree helper covers all eight modes
because the motif's degrees are the ones every mode agrees on to within a pair.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `intro` — held breath (+ the sand `STEP` pre-move)

**Files:**
- Modify: `src/audio/tracks.js` — `INTRO_A` (`:194-219`), `SAND_A`'s `STEP`
  argument (`:416`)
- Modify: `tests/music.test.mjs` — `:733-741` sand `STEP` half; new `intro` block
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `mkPat`, `TONIC.intro`
- Produces: `MUSIC_TRACKS.intro` at `STEP 0.17`, `LEN 32`, `sections ["A"]`,
  `B === null`; `MUSIC_TRACKS.sand.A.STEP === 0.139`

- [ ] **Step 1: Write the failing tests**

In `tests/music.test.mjs`, in the existing `"sand void crown STEP and first
bass"` check, change `MUSIC_TRACKS.sand.A.STEP === 0.17` to
`MUSIC_TRACKS.sand.A.STEP === 0.139`. Leave void's and crown's assertions alone
— they move in Tasks 5 and 6.

Append a new block before the `MUSIC RESULT` line:

```js
// ---- intro: held breath (D Dorian, PLAIN unaccompanied) ----
{
  const T = MUSIC_TRACKS.intro,
    A = T.A,
    f0 = TONIC.intro;
  check(
    "intro STEP 0.17 (88 BPM), LEN 32, sections [A], no B at all",
    A.STEP === 0.17 &&
      A.LEN === 32 &&
      JSON.stringify(T.sections) === '["A"]' &&
      T.B === null,
    A.STEP + "/" + A.LEN + "/" + JSON.stringify(T.sections),
  );
  check("intro has no hat at all", A.hat.length === 0, A.hat.length);
  check(
    "intro bass is ONE A1 pedal on the dominant, entering at step 16",
    A.bass.length === 1 &&
      A.bass[0].s === 16 &&
      A.bass[0].f === 55 &&
      Math.round(A.bass[0].d / A.STEP) === 16,
    JSON.stringify(A.bass),
  );
  check(
    "intro bar 1 is lead and nothing else — the motif arrives unharmonized",
    A.lead.some((n) => n.s < 8) &&
      !A.bass.some((n) => n.s < 8) &&
      !A.hat.some((n) => n.s < 8) &&
      !(A.pad || []).some((n) => n.s < 8),
  );
  check("intro states PLAIN on D4 at step 0", motifAt(A.lead, 0, f0, 1));
  const lo = Math.min(...A.lead.filter((n) => n.s < 8).map((n) => n.f)),
    hi = Math.min(
      ...A.lead.filter((n) => n.s >= 16 && n.s < 24).map((n) => n.f),
    );
  check(
    "intro bar 2 rests; bar 3 restates the motif one octave up",
    !A.lead.some((n) => n.s >= 8 && n.s < 16) &&
      motifAt(A.lead, 16, f0, 1) &&
      Math.abs(semi(hi, lo) - 12) <= 0.05,
    lo + " -> " + hi,
  );
  const b4 = A.lead.filter((n) => n.s >= 24);
  check(
    "intro bar 4 holds the 6th alone — the modal fingerprint, sustained",
    b4.length === 1 &&
      isDeg(b4[0].f, f0, DEG6) &&
      Math.round(b4[0].d / A.STEP) >= 4,
    JSON.stringify(b4),
  );
  check(
    "intro pad is one 16-step D3 drone from step 8",
    A.pad &&
      A.pad.length === 1 &&
      A.pad[0].s === 8 &&
      near(A.pad[0].f, 146.83, 0.01) &&
      Math.round(A.pad[0].d / A.STEP) === 16,
    JSON.stringify(A.pad),
  );
  check("intro occupies at most 18 of its 32 steps", occ(A) <= 18, occ(A));
  check("intro register lanes never cross", lanes(A));
}
{
  check(
    "R3c pre-move: sand STEP is 0.139, so intro's 0.17 stays unique",
    MUSIC_TRACKS.sand.A.STEP === 0.139,
    MUSIC_TRACKS.sand.A.STEP,
  );
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/music.test.mjs
```

Expected: FAIL — `intro STEP 0.17 ... -> 0.2/32/["A"]`, `intro has no hat at
all -> 8`, and the sand pre-move check reports `0.17`.

- [ ] **Step 3: Compose `INTRO_A`** — compositional directives, not note data

Rewrite `INTRO_A`'s `mkPat` call. Compose within these, and nothing else is
prescribed — the pins above are the contract:

- **Mode / tonic:** D Dorian on D4 (293.66). `STEP 0.17` (88 BPM), `LEN 32`,
  `sections` stays `["A"]` and `B` stays `null`.
- **Form:** four bars. Bar 1 — lead `triangle` states `PLAIN` on D4, *alone*.
  Bar 2 — lead rests entirely. Bar 3 — `PLAIN` restated one octave up. Bar 4 —
  the 6̂ held by itself, at least 4 steps.
- **Roles:** pad `sine` enters at step 8 with one 16-step D3 (146.83) drone.
  Bass `triangle` enters at step 16 with **one** note: A1 55.00, 16 steps — a
  pedal on the *dominant*, so the bed never states the tonic in the bass.
  **No hat at all** — pass an empty array.
- **Creative move:** the motif is introduced unharmonized, so every later
  biome's reharmonization of it is a discovery rather than a repeat.
- Pitch is absolute Hz, 12-TET, A4 = 440, **rounded to 2 decimals**.

Then, in the same file, change `SAND_A`'s first `mkPat` argument from `0.17` to
`0.139`. **Nothing else about `SAND_A` moves in this wave** — its note `d`
values stay baked at `steps × 0.17`, so sand plays ~22 % legato until R3c
rewrites it. That is deliberate: it is the smallest edit that keeps
`music.test.mjs:701-718` green now that intro owns `0.17`.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green, `:701-718` ("every track has a distinct tempo") included.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/audio/tracks.js tests/music.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Rewrite the intro bed as the motif's first, unharmonized statement.

Four bars of held breath at 88 BPM: the lead states the figure alone, rests a
whole bar, restates it an octave up, then holds the sixth — the note that names
the mode — by itself. A sine pad drone joins at step 8 and one A1 pedal enters
at step 16, on the DOMINANT, so the bed never grounds the tonic. No hat.

Every later biome's reharmonization of the figure is now a discovery rather
than a repeat.

Also moves sand's STEP to its final 0.139 — intro's new 0.170 is 0.17, which is
sand's old tempo, and the distinct-tempo pin has to hold at every commit. Sand's
durations stay baked at the old step until R3c rewrites it.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `menu` — the identity theme (carries most of the ABI ledger)

**Files:**
- Modify: `src/audio/tracks.js` — `MUSIC_PATTERN` (`:7-67`), `MUSIC_PATTERN_B`
  (`:73-133`), and their header comments (`:4-6`, `:69-72`)
- Modify: `tests/music.test.mjs` — `:187-190`, `:204-208`, `:209-213`,
  `:214-218`, `:219-227`, `:231-236`, `:265-279`, `:280-284`, `:285-292`,
  `:349-390`, `:623-674`, `:805-811`; new `menu` block
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `TONIC.menu`, `occ`, `breathBar`, `lanes`, `motifAt`
- Produces: `MUSIC_PATTERN` / `MUSIC_PATTERN_B` at `STEP 0.134`, `LEN 64`.
  Their identity as `menu.A` / `menu.B` (`:695-700`) is unchanged.

- [ ] **Step 1: Rewrite the twelve moving assertions**

**`:188-190`** →

```js
  check(
    "STEP=0.134 LEN=64 (112 BPM sixteenths, 8 bars of 2/4)",
    MUSIC_PATTERN.STEP === 0.134 && MUSIC_PATTERN.LEN === 64,
  );
```

**`:204-208`** →

```js
  check(
    "bass 20 tresillo hits — every one on step 0, 3 or 6 of its bar",
    MUSIC_PATTERN.bass.length === 20 &&
      MUSIC_PATTERN.bass.every((n) => [0, 3, 6].includes(n.s % 8)),
    MUSIC_PATTERN.bass.length +
      ":" +
      [...new Set(MUSIC_PATTERN.bass.map((n) => n.s % 8))].sort().join(","),
  );
```

**`:209-213`** →

```js
  check(
    "lead 24-32 notes, silent through bars 4 and 8",
    MUSIC_PATTERN.lead.length >= 24 &&
      MUSIC_PATTERN.lead.length <= 32 &&
      !MUSIC_PATTERN.lead.some((n) => (n.s >= 24 && n.s < 32) || n.s >= 56),
    MUSIC_PATTERN.lead.length,
  );
```

**`:214-218`** →

```js
  check(
    "hat 16 offbeat ticks — steps 2 and 6 of each bar, never the downbeat",
    MUSIC_PATTERN.hat.length === 16 &&
      MUSIC_PATTERN.hat.every((n) => n.s % 8 === 2 || n.s % 8 === 6),
    MUSIC_PATTERN.hat.length,
  );
```

**`:219-227`** — the old `bassByS.get(2)`/`get(4)` lookups no longer exist under
a tresillo, so replace the whole check with the bar-downbeat walk:

```js
  const bassByS = new Map(MUSIC_PATTERN.bass.map((n) => [n.s, n]));
  check(
    "Dm - G - Am - Dm walk (D2 73.42, G1 49, A1 55, D2 73.42)",
    bassByS.get(0).f === 73.42 &&
      bassByS.get(8).f === 49 &&
      bassByS.get(16).f === 55 &&
      bassByS.get(24).f === 73.42,
    [0, 8, 16, 24].map((s) => bassByS.get(s) && bassByS.get(s).f).join("/"),
  );
```

**`:231-236`** — delete the `leadLo`/`octOk` block outright (`oct()` is no longer
used on menu) and replace it with:

```js
  const loBar = new Map(
    MUSIC_PATTERN.lead.filter((n) => n.s < 32).map((n) => [n.s, n.f]),
  );
  const differ = MUSIC_PATTERN.lead.filter(
    (n) =>
      n.s >= 32 &&
      (!loBar.has(n.s - 32) || !near(n.f, loBar.get(n.s - 32) * 2, 0.05)),
  ).length;
  check(
    "bars 5-8 are a varied restatement, not an octave copy (oct() unused on menu)",
    differ >= 4,
    differ + " of " + MUSIC_PATTERN.lead.filter((n) => n.s >= 32).length,
  );
```

**`:265-279`** — per-note `v` is legal now, so the mix rule compares the `v`
**set** per channel, not per-note equality:

```js
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
```

(The old `V_OF` literal map is deleted with it.)

**`:280-284`** →

```js
  check(
    "B hat 16 offbeat ticks, same skeleton as A",
    MUSIC_PATTERN_B.hat.length === 16 &&
      MUSIC_PATTERN_B.hat.every((n) => n.s % 8 === 2 || n.s % 8 === 6),
    MUSIC_PATTERN_B.hat.length,
  );
```

**`:285-292`** — keep the existing "B root progression differs from A" check
exactly as written (its `roots` helper reads steps 0/8/16/24, which are still
bar downbeats), and add immediately after it:

```js
  const FS = [92.5, 185.0, 369.99];
  const soundsFs = (p) =>
    ["bass", "lead", "hat"].some((k) =>
      p[k].some((n) => FS.some((m) => Math.abs(n.f - m) < 0.02)),
    );
  check(
    "B tonicizes G major and imports the one F# the collection does not own",
    soundsFs(MUSIC_PATTERN_B) && !soundsFs(MUSIC_PATTERN),
  );
```

**`:349-390`** — `CYC = 256` does **not** move. Only the density threshold does,
and it now derives from the same occupancy the menu pins fix, so the wrap pin
and the density pin cannot disagree:

```js
  const expected = 2 * occ(MUSIC_PATTERN) + 2 * occ(MUSIC_PATTERN_B);
  check(
    "seamless wrap: step k+256 === step k (full AABB cycle)",
    wrap && probe >= expected - 2,
    "compared " + probe + " of " + expected + " occupied steps",
  );
```

**`:623-674`** — new B markers, new expected steps, and an explicit re-derivation
of the drive length (the `520`-iteration loop was sized against `STEP 0.15`;
**check it, do not assume it**). Replace the `isBmark` comment and definition,
add the coverage check right after the drive loop, and replace `EXP`:

```js
  // B-exclusive pitches: the F# that only menu's B section sounds (spec 1b —
  // every A section is pure white-key, and the two chromatic guests in the
  // score are menu's F# and sand's G#).
  const isBmark = (f) =>
    [92.5, 185.0, 369.99].some((m) => Math.abs(f - m) < 0.02);
```

```js
  const covered = Math.floor((520 * 0.1) / MUSIC_PATTERN.STEP);
  check(
    "B-marker drive still reaches past step 320 at the new tempo",
    covered > 330,
    covered + " steps in 52 s at STEP " + MUSIC_PATTERN.STEP,
  );
```

```js
  // F# lands on one step per bar of B's four-bar phrase, doubled across the
  // 8-bar section
  const EXP = [11, 29, 43, 61];
```

**`:805-811`** →

```js
  check(
    "setTrack menu restores the D2 73.42 identity bass",
    ac.starts.some((s) => near(s.f, 73.42, 0.05)),
    ac.starts
      .slice(0, 6)
      .map((s) => s.f.toFixed(1))
      .join(","),
  );
```

Finally, append a new block before the `MUSIC RESULT` line:

```js
// ---- menu: confident, swaggering (D Dorian, the identity theme) ----
{
  const A = MUSIC_PATTERN,
    B = MUSIC_PATTERN_B,
    f0 = TONIC.menu;
  check("menu bar 1 states PLAIN", motifAt(A.lead, 0, f0, 1));
  check(
    "menu A and B each occupy 46 +/- 2 of 64 steps",
    occ(A) >= 44 && occ(A) <= 48 && occ(B) >= 44 && occ(B) <= 48,
    occ(A) + "/" + occ(B),
  );
  check(
    "menu breathes in both sections",
    breathBar(A) >= 0 && breathBar(B) >= 0,
    breathBar(A) + "/" + breathBar(B),
  );
  check("menu register lanes never cross, A and B", lanes(A) && lanes(B));
  check("menu B is hand-authored — its hat is not A's array", B.hat !== A.hat);
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/music.test.mjs
```

Expected: FAIL across the menu blocks — `STEP=0.134 ... -> false`, `bass 20
tresillo hits -> 32:0,2,4,6`, `hat 16 offbeat ticks -> 32`, and the AABB
section checks reporting no B markers found.

- [ ] **Step 3: Compose `MUSIC_PATTERN` and `MUSIC_PATTERN_B`** — directives only

- **Mode / tonic:** D Dorian on D. `STEP 0.134` (112 BPM), `LEN 64`.
- **A — form:** 8 bars. Bass `square` on the tresillo (`s % 8 ∈ {0,3,6}`)
  walking **Dm → G → Am → Dm-breath** (bar downbeats D2 73.42, G1 49.00,
  A1 55.00, D2 73.42), 20 hits total — the four dropped hits are what makes bars
  4 and 8 read as breath rather than as a mistake. Lead `square` in straight
  sixteenths *against* the tresillo — rhythmic counterpoint, **never unison**.
  Hat `triangle` on the offbeats only (`s % 8 ∈ {2,6}`), 16 ticks. **No pad.**
  Bars 4 and 8 drop the lead entirely. Bars 5–8 are a **varied restatement, not
  an octave copy** — do not call `oct()` for menu's lead.
  **The four dropped bass hits belong at `{3,6}` of bars 4 and 8, never on a bar
  downbeat.** `bassByS.get(0/8/16/24)` and the retained `roots()` helper both do
  `.find(…).f`, so a missing downbeat throws a TypeError instead of failing a
  check — a stack trace where a red pin belongs.
  **Occupancy is tighter than it reads:** bass (20) ∪ hat (16) already covers 30
  steps — `{0,2,3,6}` in active bars, `{0,2,6}` in breath bars — so the lead may
  add only ~16 *new* steps to land at 46. Counterpoint here means never doubling
  the bass contour; it does **not** mean never sharing a step. A lead that fills
  all four free steps (`{1,4,5,7}`) of each active bar lands near 54 and reds
  the band on the first attempt.
- **A — motif:** bar 1 is `PLAIN`; bars 2–3 and 5–7 develop it.
- **B — form:** hand-authored (keep the existing `MUSIC_PATTERN_B` IIFE shape).
  Identical rhythmic skeleton, identical instrument mix and step count as A so
  the two interleave seamlessly, but a genuinely different harmonic
  destination: **tonicize G major for eight bars and snap back**, which imports
  the one F♯ the parent collection does not own. Sound F♯ (92.50 / 185.00 /
  369.99) at exactly steps **11, 29, 43, 61** and nowhere else; `A` sounds none
  of those three pitches.
  **"Identical skeleton" means the tresillo bass and offbeat hat grid, not
  bar-for-bar lead silence.** Steps 29 and 61 are `s % 8 === 5`, which the bass
  (`{0,3,6}`) and hat (`{2,6}`) cannot reach and menu has no pad — so those two
  F♯s must be **lead** notes, inside `[24,32)` and `[56,64)`, exactly where
  `A`'s lead is pinned silent. `B` therefore breathes in *different* bars than
  `A`. `breathBar(B) >= 0` and `occ(B)` 44–48 still hold; the lead is
  redistributed, not lengthened — `:265-279` pins the per-channel note **count**,
  not its placement. (Steps 11 and 43 are `s % 8 === 3` and legal for either
  voice; 43 = 11+32 and 61 = 29+32 fall out of the bars-5-8 restatement.)
- **Occupancy is a number, not a band:** `occ(A)` and `occ(B)` are each **46 ±
  2**. This is pinned tightly because the wrap test's `expected` derives from it
  — a menu authored down at 41 would leave both pins consistent while quietly
  shipping a sparser theme than the spec asks for.
- **Creative move:** B is the template the other three hand-authored Bs follow —
  same skeleton, same mix, a genuinely different harmonic destination.
- Update both header comment blocks so they describe the tresillo bass, the
  offbeat hat and the G-major B rather than "A-A-F-G x2, lead octave-up".

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green. Watch four in particular: the wrap probe (`compared 184 of
184` at 46/46), the four AABB section checks, `:701-718`'s distinct tempos, and
the envelope probe at `:391-406` — that one needs **no code edit**, it derives
from `MUSIC_PATTERN.bass[0]` and simply reads 73.42 now, but it must stay green.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/audio/tracks.js tests/music.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Rewrite the menu theme as the score's identity: tresillo bass, real counterpoint.

The bass walks Dm-G-Am-Dm on steps 0/3/6 of each bar instead of pumping four
even hits, the lead answers it in sixteenths rather than doubling it, the hat
moved to the offbeats, and bars 4 and 8 drop the lead outright — the loop now
breathes twice per pass. Bars 5-8 are a varied restatement, so oct() is gone
from menu entirely.

B still tonicizes a genuinely different key (G major, the one F# the collection
does not own) on the same rhythmic skeleton, which is the template the other
hand-authored B sections follow.

The wrap test's density threshold now derives from the same occupancy numbers
the menu pins fix, so writing rests can never quietly fight the loop-wrap pin.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `arena` — aggressive, combat-ready

**Files:**
- Modify: `src/audio/tracks.js` — `ARENA_A` (`:377-414`) and the
  `arena:` entry in `MUSIC_TRACKS` (`:531`), which stops using `transp`
- Modify: `tests/music.test.mjs` — new `arena` block
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `TONIC.arena`, `motifAt`, `occ`, `breathBar`, `lanes`
- Produces: `MUSIC_TRACKS.arena` with a **hand-authored `B`** —
  `tr(ARENA_A, ARENA_B)`, no `transp`

- [ ] **Step 1: Write the failing test**

Append before the `MUSIC RESULT` line:

```js
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
    "arena ANTIC: the motif head sits at step 15, one step before bar 3",
    motifAt(A.lead, 15, f0, 1),
    motifHead(A.lead, f0, 1, 64),
  );
  check(
    "arena stabs on the and of 2 and 4 (lead notes at 3 and 7 mod 8)",
    A.lead.some((n) => n.s % 8 === 3) && A.lead.some((n) => n.s % 8 === 7),
  );
  check("arena B is hand-authored — its hat is not A's array", B.hat !== A.hat);
  check(
    "arena is dense but not solid: at most 62 of 64 steps, and it still breathes",
    occ(A) <= 62 && breathBar(A) >= 0,
    occ(A) + "/" + breathBar(A),
  );
  check("arena register lanes never cross, A and B", lanes(A) && lanes(B));
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/music.test.mjs
```

Expected: FAIL — `arena STEP 0.107 ... -> 0.11/87.31`, `arena is the one track
with all four channels dense -> 3` (no pad today), and `arena B is
hand-authored` false (`transp` shares the hat array).

- [ ] **Step 3: Compose `ARENA_A` and `ARENA_B`** — directives only

- **Mode / tonic:** A Aeolian on A. `STEP 0.107` (140 BPM), `LEN 64`,
  `A.bass[0].f = 55.00` (A1).
- **Roles:** all four voices — bass `square`, lead `square`, hat `triangle` on
  every even step, pad `sawtooth`. Syncopated stabs on the "and" of 2 and 4
  (lead notes at steps ≡ 3 and ≡ 7 mod 8 — still whole-step positions, just off
  the downbeat).
- **Motif treatment:** `ANTIC`. The head lands **one step before** the expected
  downbeat — specifically at step **15**, anticipating bar 3 — so the fanfare
  punches ahead of the grid without any sub-step timing.
- **B:** hand-authored, not `transp`. Same rhythmic skeleton and instrument mix
  as A (so the AABB interleave stays seamless), a genuinely different harmonic
  destination, and **its own hat array** — that array identity is what the
  staging pin reads. Change `MUSIC_TRACKS.arena` to `tr(ARENA_A, ARENA_B)`.
- **Creative move:** whole-step anticipation. Aeolian with **no** colour tones —
  deliberately plainer and harder than the modal biomes around it.
- Density tracks the mood: this is the score's dense end, but it still leaves a
  breath bar and never occupies all 64 steps. Leave the strong beats
  comparatively open where a blast is likely to land — SFX render outside
  `musicGain` and always sit on top, so the music has to leave the holes.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/audio/tracks.js tests/music.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Rewrite arena as the anticipation track and give it a real B section.

The motif head now lands one whole step BEFORE the downbeat it belongs to, so
the fanfare punches ahead of the grid without any sub-step timing the engine
cannot express. Four voices, plain Aeolian with no colour tones — deliberately
harder than the modal biomes around it — and a sawtooth pad that makes it the
one track with all four channels dense.

B is hand-authored rather than transposed, so it owns its own hat array; a
listener's ear clocks pitch-shifted repetition as repetition, not new material.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `void` — dread, subtraction (+ the water root pre-move)

**Files:**
- Modify: `src/audio/tracks.js` — `VOID_A` (`:451-484`), the `void:` entry in
  `MUSIC_TRACKS` (`:532`), `WATER_A`'s first `pulse` root (`:335`)
- Modify: `tests/music.test.mjs` — `:733-741` void half, `:788-793` water
  downbeat; new `void` block
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `TONIC.void`, `fragMidAt`, `motifAt`, `isDeg`, `occ`, `lanes`
- Produces: `MUSIC_TRACKS.void` with a hand-authored `B`;
  `MUSIC_TRACKS.water.A.bass[0].f === 49`

**This task's two data edits must land in one commit.** Void takes 61.74, which
is water's current root; water takes 49.00, which is void's current root. It is
a swap, not a stagger — split it and `music.test.mjs:719-732` is red either way.

- [ ] **Step 1: Write the failing tests**

In the `"sand void crown STEP and first bass"` check, change void's two
assertions to `MUSIC_TRACKS.void.A.STEP === 0.234` and
`MUSIC_TRACKS.void.A.bass[0].f === 61.74`. Leave crown's alone.

Replace the `"water downbeat is B1=61.74, not menu A1"` check with:

```js
  check(
    "water downbeat is G1=49.00, not menu's D2=73.42",
    ac.starts.some((s) => near(s.f, 49, 0.05)) &&
      !ac.starts.some((s) => near(s.f, 73.42, 0.05)),
    ac.starts
      .slice(0, 6)
      .map((s) => s.f.toFixed(1))
      .join(","),
  );
```

Append before the `MUSIC RESULT` line:

```js
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
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/music.test.mjs
```

Expected: FAIL — `void STEP 0.234 ... -> 0.19/49`; `void is two voices` (void
has both a hat and a pad today); `void is the only sine lead ... -> triangle`;
and the water pre-move check reporting `61.74`.

- [ ] **Step 3: Compose `VOID_A` / `VOID_B`, and move water's root** — directives

- **Mode / tonic:** B Locrian on B. `STEP 0.234` (64 BPM) — the one deliberate
  exception to the 104–140 band. `LEN 64`, `A.bass[0].f = 61.74` (B1).
- **Roles: two voices only.** Bass `triangle`, a single sustained B1 pedal at
  very low `v` (below 0.05). Lead **`sine`** — the only sine lead in the score,
  one of the two scarce identity timbres. `hat` is an **empty array**. **No
  pad** — pass nothing, so the key is absent, not empty.
- **Motif treatment:** `FRAG-MID` and nothing else — degrees 3̂ 5̂ 6̂ on bar-
  relative steps 1, 2, 3. At least two bars carry it; **no bar** matches
  `PLAIN`. The lead never sounds degree 1̂ at any octave.
- **B:** hand-authored, its own hat array (still empty), same mix and skeleton.
- **Creative move: subtraction.** Both ends of the motif are removed — no tonic
  under the figure, no settle after it. The incompleteness is the horror;
  nothing dissonant is added to get it. `A` puts notes on at most **20** of its
  64 steps, the sparsest in the game.
- **The `fin` pin holds unchanged** (`music.test.mjs:742-754`): it runs on
  `bass`/`lead`/`hat` only, never `pad`, and `fin([])` is `true`, so an empty
  hat and an absent pad pass as written. Verified, not assumed.
- **In the same edit**, change `WATER_A`'s first `pulse` root from `61.74` to
  `49` (leave its fifth at 92.5). Nothing else about `WATER_A` moves in this
  wave.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green, `:719-732` ("biome bass roots all distinct") included —
that pin is the reason the two edits share a commit.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/audio/tracks.js tests/music.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Rewrite void by subtraction: two voices, a sine lead, and no resolution.

The motif loses both ends. There is no tonic under the figure and no settle
after it — just the middle three degrees over a single sustained pedal at the
lowest gain in the score, at 64 BPM, on at most 20 of 64 steps. The
incompleteness is the horror; nothing dissonant was added to get it, and CROWN
is what finally finishes the phrase.

Water's root moves to G1 49.00 in the same commit because void is taking 61.74
and water is taking void's old 49 — the two roots swap, so staging them apart
would leave the biome-root distinctness pin red either way.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `crown` — finale gold (+ the factory root pre-move)

**Files:**
- Modify: `src/audio/tracks.js` — `CROWN_A` (`:485-522`), the `crown:` entry in
  `MUSIC_TRACKS` (`:533`), `FACTORY_A`'s first `pulse` root (`:299`)
- Modify: `tests/music.test.mjs` — `:733-741` crown half; new `crown` block
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `TONIC.crown`, `motifHead`, `semi`, `soundsDeg`,
  `MUSIC_TRACKS.arena.A.hat`
- Produces: `MUSIC_TRACKS.crown` with a hand-authored `B`;
  `MUSIC_TRACKS.factory.A.bass[0].f === 82.41`

- [ ] **Step 1: Write the failing tests**

In the `"sand void crown STEP and first bass"` check, change crown's two
assertions to `MUSIC_TRACKS.crown.A.STEP === 0.113` and
`MUSIC_TRACKS.crown.A.bass[0].f === 65.41`.

Append before the `MUSIC RESULT` line:

```js
// ---- crown: finale gold (C Ionian, RESOLVED — the only pure major) ----
{
  const T = MUSIC_TRACKS.crown,
    A = T.A,
    B = T.B,
    f0 = TONIC.crown;
  check(
    "crown STEP 0.113 (133 BPM), C2 65.41 root",
    A.STEP === 0.113 && A.bass[0].f === 65.41,
    A.STEP + "/" + A.bass[0].f,
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
  const head = motifHead(B.lead, f0, 1, 64);
  const headF = head >= 0 && B.lead.find((n) => n.s === head).f;
  const tail = B.lead.filter((n) => n.s === head + 7);
  check(
    "crown B states RESOLVED — the tonic VOID withheld, an octave above the head",
    head >= 0 &&
      tail.length === 1 &&
      Math.abs(semi(tail[0].f, headF) - 12) <= 0.05 &&
      Math.round(tail[0].d / B.STEP) >= 2,
    head + " -> " + JSON.stringify(tail),
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
    "crown is full but not solid: 40-58 of 64 steps, and it breathes",
    occ(A) >= 40 && occ(A) <= 58 && breathBar(A) >= 0,
    occ(A) + "/" + breathBar(A),
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
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/music.test.mjs
```

Expected: FAIL — `crown STEP 0.113 ... -> 0.13/98`, the hat quotation false
(`transp` shares A's array), no pad today, and the factory pre-move check
reporting `65.41`.

- [ ] **Step 3: Compose `CROWN_A` / `CROWN_B`, and move factory's root** — directives

- **Mode / tonic:** C Ionian on C — the only pure major in the game, earned by
  contrast with everything before it. `STEP 0.113` (133 BPM), `LEN 64`,
  `A.bass[0].f = 65.41` (C2).
- **Roles:** bass `square`; lead `square` in a dotted fanfare; hat `triangle`;
  pad `sawtooth` doubling the lead one octave up for brass weight, on at least
  8 shared steps.
- **Motif treatment:** `RESOLVED` — `PLAIN` plus a sixth note, degree 1̂ one
  octave above the head, at head + 7, at least 2 steps long. Pin it in
  **`crown.B.lead`** (the payoff section); authoring it in `A` too is allowed.
- **Creative move: payoff quotation.** `crown.B`'s hat reproduces `arena.A`'s
  hat **step pattern verbatim** — a victory lap past the arena — and the lead
  supplies the tonic VOID refused to play. **The quote is of the step pattern,
  not the wall clock:** `crown .113` against `arena .107` plays the same figure
  about 5 % broader, which is what a victory lap should sound like. Do not try
  to match durations; that breaks the pin and the point.
- **Ionian fingerprint:** `crown.A` must sound both a perfect fourth (5
  semitones) and a leading tone (11) above C. That pair is what separates Ionian
  from Lydian (which has 11 but a ♯4) and from every flat-seventh mode in the
  run. R3c pins the "and no other A section sounds both" half, once every A
  section exists.
- **B:** hand-authored, own hat array, same mix and skeleton as A.
- **In the same edit**, change `FACTORY_A`'s first `pulse` root from `65.41` to
  `82.41` — factory's own new E2 tonic, and distinct from jungle's current 82.4.
  Nothing else about `FACTORY_A` moves in this wave.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/audio/tracks.js tests/music.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Rewrite crown as the payoff: the only pure major, and the phrase void left open.

The lead finally supplies the tonic VOID refused to play, and B's hat quotes
arena's step pattern verbatim — a victory lap past the room the player fought
through. The quote is of the STEP pattern, not the wall clock: at .113 against
arena's .107 the same figure plays about 5% broader, which is what a victory lap
should sound like.

Ionian is pinned by the pair that actually isolates it — a perfect fourth AND a
leading tone — not by "major third plus major sixth", which also describes ice
and water.

Factory's root moves to its own new E2 82.41 in the same commit, because crown
is taking the 65.41 factory currently holds.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: wave-1 cross-track pins — staging, scarcity, sweep

**Files:**
- Modify: `tests/music.test.mjs` — one new block

**Interfaces:**
- Consumes: `lanes`, `breathBar`, `occ`, `waves`
- Produces: the staging pin that fixes which four tracks have a hand-authored B

- [ ] **Step 1: Write the pins**

Append before the `MUSIC RESULT` line:

```js
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
  const W1 = ["intro", "menu", "arena", "void", "crown"];
  check(
    "wave 1: every A keeps its register lanes and has a breath bar",
    W1.every(
      (k) => lanes(MUSIC_TRACKS[k].A) && breathBar(MUSIC_TRACKS[k].A) >= 0,
    ),
    W1.filter(
      (k) => !lanes(MUSIC_TRACKS[k].A) || breathBar(MUSIC_TRACKS[k].A) < 0,
    ).join(","),
  );
  check(
    "wave 1: no rewritten track occupies every step of its loop",
    W1.every((k) => occ(MUSIC_TRACKS[k].A) < MUSIC_TRACKS[k].A.LEN),
    W1.map((k) => k + ":" + occ(MUSIC_TRACKS[k].A)).join(" "),
  );
  check(
    "wave 1: every rewritten track uses at least two distinct waveforms",
    W1.every((k) => waves(MUSIC_TRACKS[k].A) >= 2),
    W1.map((k) => k + ":" + waves(MUSIC_TRACKS[k].A)).join(" "),
  );
}
```

The all-ten versions of the last three — plus "exactly one sawtooth bass" — land
in R3c, because today's wave-2 data violates them (`WATER_A`'s mix is
all-`triangle`; `JUNGLE_A`'s `pulse` evens ∪ `hats(64,f,2)` odds cover all 64
steps) and no wave-1 commit can be green while asserting them.

- [ ] **Step 2: Run to PASS**

```bash
node --test
```

Expected: green. If the staging pin fails, a `tr(X_A, transp(X_A, r))` was left
in place for one of the four, or a hand-authored B reused `A.hat` by reference.

- [ ] **Step 3: Commit (no PWA bump — tests only)**

```bash
git add tests/music.test.mjs
git commit -m "$(cat <<'EOF'
Pin the hand-authored-B staging and the wave-1 structural sweep.

transp returns the SAME hat array by identity, so one line separates the four
tracks with a genuinely authored B section from the five still transposing A —
no note comparison needed. Sine lead scarcity, register lanes, breath bars,
occupancy and waveform variety are asserted over wave 1 only; the all-ten
versions land with wave 2, because today's un-rewritten data violates several
of them.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: LISTENING CHECKPOINT — bounce, A/B, sign off

**Files:**
- Modify: `MEMORY.md`

**Interfaces:**
- Consumes: `tools/bounce/` (R3a), the R3a reference set in
  `.superpowers/sdd/2026-09-05-soundtrack/wav/before/`
- Produces: sign-off. **R3c does not start until this gate is signed.**

- [ ] **Step 1: Bounce the five**

```bash
mkdir -p .superpowers/sdd/2026-09-05-soundtrack/wav
node tools/bounce/sink.mjs --out .superpowers/sdd/2026-09-05-soundtrack/wav &
npm start &
```

Open `http://127.0.0.1:8080/tools/bounce/index.html` and bounce `intro`, `menu`,
`arena`, `void`, `crown` (BOUNCE ALL is fine — the other five are still the old
tracks and are useful context).

```bash
ls -l .superpowers/sdd/2026-09-05-soundtrack/wav/
git status --short
```

Expected: the five files exist and are megabytes, not 44 bytes; `git status`
shows no WAV anywhere.

- [ ] **Step 2: Controller listens, A/B against the reference**

Play each new bounce against `wav/before/<id>.wav`. Judge on all four
acceptance criteria — the pins do not grant approval, they only stop
regressions:

1. **Rests are audible.** There is somewhere in every track where you notice
   the silence. VOID is mostly silence.
2. **The motif is traceable by ear** across the five without being told where it
   is — including that CROWN finishes the phrase VOID leaves hanging.
3. **No constant-beep density.** No track is an unbroken sixteenth carpet; no
   two feel like the same patch at different pitches.
4. **Mood matches the table** blind: played without labels, a listener sorts
   them into roughly the right slots.

- [ ] **Step 3: The user listens and signs off**

Present the five bounces and the four criteria. **A track that passes every Node
pin and fails a listen gets rewritten** — return to its task, recompose within
the same pins, re-bounce, re-listen. Only both sign-offs close this gate.

- [ ] **Step 4: MEMORY + commit (no PWA bump)**

Append to `MEMORY.md` under a `## 2026-09-05 — R3b soundtrack wave 1` heading
(newest first, 1–2 lines): that `intro`/`menu`/`arena`/`void`/`crown` are
rewritten around one motif with hand-authored B sections for the last four, that
`menu` now walks a tresillo bass with the lead in counterpoint and `oct()` is
gone from it, that three wave-2 numbers (sand `STEP`, water root, factory root)
were pre-moved to keep the tempo/root distinctness pins green mid-wave, and that
both listens are signed so R3c may start.

```bash
git add MEMORY.md
git commit -m "$(cat <<'EOF'
Sign off wave 1 of the soundtrack rewrite after the listening gate.

Five tracks bounced to WAV and A/B'd against the pre-rewrite reference by the
controller and the user. Rests audible, motif traceable across all five, no
constant-beep density, moods sort correctly blind.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
