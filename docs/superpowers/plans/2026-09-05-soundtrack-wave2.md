# R3c — wave 2: ice, jungle, factory, water, sand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the five biomes that keep a `transp` B this pass, each at its
stated diatonic ratio, so all eight rotations of the parent collection exist and
the run reads as one voyage rather than eight unrelated jingles. Finishes the
ABI ledger and the all-ten structural pins.

**Architecture:** Data only, exactly as wave 1. Each track is one `mkPat` call
plus `tr(X_A, transp(X_A, ratio))`. `transp` is a real chromatic transposition:
B leaves the parent collection for eight bars and snaps back — **that departure
is the modulation and it is audible as one.** It is also why a hand-authored B
is better, which is why wave 1 staged four of them rather than converting nine
at once.

**Tech Stack:** Pure ES modules, WebAudio oscillators only, `node --test`.
Zero npm deps, no samples. Integer steps only.

**Spec:** `docs/superpowers/specs/2026-09-05-soundtrack-design.md` §1, §2, §5, §6

**Depends on:** R3a (`…-soundtrack-seam.md`) and R3b
(`…-soundtrack-wave1.md`) — **both landed, and wave 1's listening gate signed
by the controller and the user.** R3c does not start before that signature.

## Global Constraints

- **Tasks run strictly in order: ice → jungle → factory → water → sand →
  all-ten pins → full-score listen.** Do not parallelize. **Ice must precede
  jungle**: jungle's new root is 73.42, which is ice's *current* root, and ice
  can only vacate it for 87.31 because wave 1's arena already gave 87.31 up.
  The spec lists these five jungle-first; that is a listing order, not a task
  order.
- **The three wave-1 pre-moves are already in place** — `sand.A.STEP = 0.139`,
  `water.A.bass[0].f = 49.00`, `factory.A.bass[0].f = 82.41`. Each track's task
  keeps its pre-moved number and rewrites everything around it. Do not move them
  back.
- **`transp` shares the `hat` array by identity.** All five keep
  `tr(X_A, transp(X_A, ratio))`, so `B.hat === A.hat` stays true for exactly
  these five — that one line is the whole hand-authored-B staging pin, and wave
  1 already asserts both halves of it.
- **FACTORY's metric modulation is not attempted.** The brief's "hat switches to
  3+3+2 at B" is impossible under a shared hat array. Deferred to whichever pass
  gives FACTORY a hand-authored B; the 2-against-3 interlock inside `A` replaces
  it. Do not invent a workaround.
- **The `v?` tuple's first users are here.** `water.A.bass` and `sand.A.lead`
  carry stepped dynamics; R3a's uniform-`v` pin is narrowed to an explicit
  allow-list by the `water` task and extended once by the `sand` task. Nothing
  else drifts.
- **Accidental facts are scoped to `A` sections.** A `transp` B is a chromatic
  transposition, so `jungle.B` lands on F Dorian and necessarily sounds A♭ — the
  same frequency as SAND's G♯. Both accidental pins (menu's F♯, sand's G♯) read
  `A` sections only, where they are true by construction.
- Shared and pinned for all ten in Task 6: `max(bass.f) < min(lead.f)`; no track
  puts a note on all 64 steps; every track has a breath bar; the occupancy
  bands; the tempo ladder; the biome roots; timbre scarcity.
- **Panning is untouched.** `MUS_PAN` stays as authored and **no track authors
  `n.p`.** Durations are never pinned by equality. `duck`, `setVols`, the SFX
  direct-to-destination path, the `reveal` cue, the ten `MUSIC_TRACKS` keys and
  `musicCue`'s routing do not change. Nothing reaches `src/core/`.
- **PWA:** every commit that touches `src/audio/tracks.js` bumps `CACHE_NAME`
  (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`) together, `current vN → vN+1`.
  **Read the current value first.** Tests-only and `MEMORY.md`-only commits get
  no bump.
- No comments unless the file already uses explanatory block comments —
  `tracks.js` does. Match its compact style.
- Never write the banned grid-bomb franchise name into any committed file.

---

### Task 1: `ice` — brittle, echoing

**Files:**
- Modify: `src/audio/tracks.js` — `ICE_A` (`:257-295`), `ice:` entry (`:527`)
- Modify: `tests/music.test.mjs` — new `ice` block
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `TONIC.ice`, `motifAt`, `isDeg`, `occ`, `breathBar`, `lanes`
- Produces: `MUSIC_TRACKS.ice` at `STEP 0.144`, root `87.31`, `B = transp(A, 1.122462)`

- [ ] **Step 1: Write the failing test**

Append before the `MUSIC RESULT` line:

```js
// ---- ice: brittle, echoing (F Lydian, AUG — register separation is the idea) ----
{
  const T = MUSIC_TRACKS.ice,
    A = T.A,
    B = T.B,
    f0 = TONIC.ice;
  check(
    "ice STEP 0.144 (104 BPM), F2 87.31 root, B up a whole tone",
    A.STEP === 0.144 &&
      A.bass[0].f === 87.31 &&
      Math.abs(B.bass[0].f / A.bass[0].f - 1.122462) < 1e-9,
    A.STEP + "/" + A.bass[0].f,
  );
  check(
    "ice bass is reduced to occasional cracks: <= 6 notes, none under 4 steps",
    A.bass.length <= 6 &&
      A.bass.every((n) => Math.round(n.d / A.STEP) >= 4),
    A.bass.length + " notes",
  );
  check(
    "ice lead lives above C5 — the absence of low end IS the ice",
    A.lead.length > 0 && A.lead.every((n) => n.f >= 523.25),
    Math.min(...A.lead.map((n) => n.f)),
  );
  check(
    "ice states the motif in AUG — steps 0,2,4,6,12, two bars per statement",
    motifAt(A.lead, 0, f0, 2),
    motifHead(A.lead, f0, 2, 64),
  );
  check(
    "ice pad sounds the Lydian sharp 4 — the glassy, uncanny tone",
    !!A.pad && A.pad.some((n) => isDeg(n.f, f0, [6])),
    (A.pad || []).map((n) => pcOf(n.f, f0).toFixed(1)).join(","),
  );
  check(
    "ice hat ticks every 8 steps at 6200 Hz",
    A.hat.length > 0 &&
      A.hat.every((n) => n.s % 8 === A.hat[0].s % 8 && n.f === 6200),
    A.hat.length,
  );
  check(
    "ice is sparse: at most 34 of 64 steps, and it breathes",
    occ(A) <= 34 && breathBar(A) >= 0,
    occ(A) + "/" + breathBar(A),
  );
  check("ice register lanes never cross, A and B", lanes(A) && lanes(B));
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/music.test.mjs
```

Expected: FAIL — `ice STEP 0.144 ... -> 0.18/73.42` and the lead-register and
AUG checks with it.

- [ ] **Step 3: Compose `ICE_A`** — compositional directives only

- **Mode / tonic:** F Lydian on F. `STEP 0.144` (104 BPM), `LEN 64`,
  `A.bass[0].f = 87.31` (F2). `B = transp(A, 1.122462)` — up a whole tone, the
  shimmer brightening a step.
- **Roles:** pad `sine` holding Lydian chord tones **including the ♯4** (B,
  246.94 / 493.88); lead `triangle` running `AUG`; bass `triangle` reduced to
  occasional cracks (≤ 6 notes, each ≥ 4 steps); hat `triangle` at 6200 Hz every
  8 steps.
- **Motif treatment:** `AUG` — the figure in slow motion, ×2 durations, two bars
  per statement, on steps 0, 2, 4, 6, 12.
- **Creative move:** **register separation is the whole idea.** Nothing melodic
  below the bass cracks; every lead note at or above C5 (523.25). The *absence*
  of low end is the ice.
- Quarter-note pulse, long sustains, wide rests; at most 34 of 64 steps occupied.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green, `:701-718` and `:719-732` included — ice can take 87.31
only because wave 1's arena vacated it.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/audio/tracks.js tests/music.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Rewrite ice around register separation: the absence of low end is the ice.

The motif runs in augmentation — two bars per statement — over sustained Lydian
pad tones including the raised fourth, with the bass cut back to a handful of
long cracks and nothing melodic below C5. Wide rests, a hat tick every eight
steps, 34 of 64 steps occupied.

Ice goes first in wave 2 because jungle's new root is ice's current one; ice can
only vacate it now that arena has given up 87.31.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `jungle` — overgrown, humid, alive

**Files:**
- Modify: `src/audio/tracks.js` — `JUNGLE_A` (`:221-256`), `jungle:` entry (`:526`)
- Modify: `tests/music.test.mjs` — new `jungle` block
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `TONIC.jungle`, `motifAt`, `fragMidAt`, `occ`, `breathBar`, `lanes`
- Produces: `MUSIC_TRACKS.jungle` at `STEP 0.129`, root `73.42`,
  `B = transp(A, 1.189207)`

- [ ] **Step 1: Write the failing test**

Append before the `MUSIC RESULT` line:

```js
// ---- jungle: overgrown, humid, alive (D Dorian, strict call-and-response) ----
{
  const T = MUSIC_TRACKS.jungle,
    A = T.A,
    B = T.B,
    f0 = TONIC.jungle;
  check(
    "jungle STEP 0.129 (116 BPM), D2 73.42 root — room 1 is literally the menu's key",
    A.STEP === 0.129 &&
      A.bass[0].f === 73.42 &&
      Math.abs(B.bass[0].f / A.bass[0].f - 1.189207) < 1e-9,
    A.STEP + "/" + A.bass[0].f,
  );
  const leadS = new Set(A.lead.map((n) => n.s));
  check(
    "call and response: no step carries both a bass and a lead note",
    !A.bass.some((n) => leadS.has(n.s)),
    A.bass.filter((n) => leadS.has(n.s)).map((n) => n.s).join(","),
  );
  check(
    "jungle bass is a 3+3+2 ostinato — every hit on step 0, 3 or 6 of its bar",
    A.bass.every((n) => [0, 3, 6].includes(n.s % 8)),
    [...new Set(A.bass.map((n) => n.s % 8))].sort().join(","),
  );
  check(
    "jungle bass rests through bars 5 and 8 — the lead owns them",
    !A.bass.some((n) => (n.s >= 32 && n.s < 40) || n.s >= 56),
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
  let frags = 0;
  for (let b = 0; b < 8; b++) if (fragMidAt(A.lead, b * 8, f0)) frags++;
  check(
    "jungle answers in FRAG-MID and states PLAIN once, at bar 5",
    frags >= 3 && motifAt(A.lead, 32, f0, 1),
    frags + " frag bars",
  );
  check(
    "jungle is alive but not solid: 40-58 of 64 steps, and it breathes",
    occ(A) >= 40 && occ(A) <= 58 && breathBar(A) >= 0,
    occ(A) + "/" + breathBar(A),
  );
  check("jungle register lanes never cross, A and B", lanes(A) && lanes(B));
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/music.test.mjs
```

Expected: FAIL — `jungle STEP 0.129 ... -> 0.14/82.4`, the no-overlap check
listing many steps, and `jungle pad is two 32-step canopy drones -> undefined`.

- [ ] **Step 3: Compose `JUNGLE_A`** — compositional directives only

- **Mode / tonic:** D Dorian on D. `STEP 0.129` (116 BPM), `LEN 64`,
  `A.bass[0].f = 73.42` (D2) — **deliberately identical to `menu`'s root**:
  room 1 is home, in the menu's own key. `B = transp(A, 1.189207)` — up a minor
  third, into the relative major's key.
- **Roles:** bass `square` 3+3+2 ostinato; lead `triangle` answering in the
  gaps; hat `triangle`; pad `sine` canopy — exactly **two** 32-step drones,
  A2 110.00 then D3 146.83.
- **Motif treatment:** `FRAG-MID` in the answer slots; `PLAIN` once, at **bar 5**
  (steps 32–39).
- **Creative move: strict call-and-response.** The bass asks, the lead answers,
  and they never speak over each other — **no step carries both**. Two
  consequences, both authored rather than accidental: the bass rests through
  bars 5 and 8 (where the lead's full `PLAIN` statement and the breath bar
  live), and in the six answer bars **the ostinato drops its step-3 hit**,
  because `FRAG-MID` occupies steps 1, 2, 3 and step 3 is a tresillo step. Call
  bars are the full 0-3-6; answer bars are 0-6, opened up for the lead.

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
Rewrite jungle as strict call-and-response, in the menu's own key.

Room 1 is home, so its root is deliberately the menu's D2. The bass asks in
3+3+2 and the lead answers in the gaps — no step carries both — which forced two
authored consequences rather than accidents: the ostinato drops its step-3 hit
in the six answer bars, because the answering fragment sits on steps 1-3, and
the bass rests entirely through the two bars the lead owns.

Two long sine drones sit under it as canopy.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `factory` — mechanical, cold competence

**Files:**
- Modify: `src/audio/tracks.js` — `FACTORY_A` (`:296-331`), `factory:` entry (`:528`)
- Modify: `tests/music.test.mjs` — new `factory` block
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `TONIC.factory`, `motifHead`, `isDeg`, `occ`, `breathBar`, `lanes`
- Produces: `MUSIC_TRACKS.factory` at `STEP 0.119`, root `82.41` (unchanged from
  wave 1's pre-move), `B = transp(A, 0.890899)`

- [ ] **Step 1: Write the failing test**

Append before the `MUSIC RESULT` line:

```js
// ---- factory: mechanical, cold competence (E Phrygian, CANON) ----
{
  const T = MUSIC_TRACKS.factory,
    A = T.A,
    B = T.B,
    f0 = TONIC.factory;
  check(
    "factory STEP 0.119 (126 BPM), E2 82.41 root, B down a whole tone",
    A.STEP === 0.119 &&
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
    "factory hat is square on every even step — the 2 side of the interlock",
    A.hat.length > 0 &&
      A.hat.every((n) => n.t === "square" && n.s % 2 === 0),
    A.hat.length + "/" + A.hat[0].t,
  );
  check("factory has no pad at all", A.pad === undefined, String(A.pad));
  const bh = motifHead(A.bass, f0, 1, 64),
    lh = motifHead(A.lead, f0, 1, 64);
  const bf = bh >= 0 && A.bass.find((n) => n.s === bh).f,
    lf = lh >= 0 && A.lead.find((n) => n.s === lh).f;
  check(
    "CANON: the lead states the motif exactly 8 steps after the bass, an octave up",
    bh >= 0 && lh === bh + 8 && lf > bf && isDeg(lf, bf, DEG1),
    "bass@" + bh + " lead@" + lh,
  );
  check(
    "factory drives without filling: 40-58 of 64 steps, and it breathes",
    occ(A) >= 40 && occ(A) <= 58 && breathBar(A) >= 0,
    occ(A) + "/" + breathBar(A),
  );
  check("factory register lanes never cross, A and B", lanes(A) && lanes(B));
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/music.test.mjs
```

Expected: FAIL — `factory STEP 0.119 ... -> 0.12/82.41`, `factory bass is
sawtooth -> square`, and the CANON check reporting `bass@-1`.

- [ ] **Step 3: Compose `FACTORY_A`** — compositional directives only

- **Mode / tonic:** E Phrygian on E (♭2 is the mechanical menace). `STEP 0.119`
  (126 BPM), `LEN 64`, `A.bass[0].f = 82.41` (E2, already pre-moved in wave 1).
  `B = transp(A, 0.890899)` — down a whole tone, the machine gearing down.
- **Roles:** bass **`sawtooth`** — the only sawtooth bass in the score, one of
  the two scarce identity timbres — stating the motif low in bar 1 and running
  an engine ostinato after; lead `square` answering `CANON` at bar 2, an octave
  up; hat **`square`** on every even step. **No pad.**
- **Motif treatment:** `CANON` — bass states it, lead answers exactly 8 steps
  later, an octave above.
- **Creative move: 2-against-3 interlock** — the ostinato groups in 3s against a
  hat in 2s, coinciding only twice a bar.
- **Do not attempt the metric modulation at B.** `transp` shares the hat array
  by identity, so a B-section hat that regroups to 3+3+2 cannot exist here.
  Deferred, not worked around.
- SFX render outside `musicGain` and always sit on top, so leave the strong
  beats comparatively open where a blast is likely to land.

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
Rewrite factory as a canon over a 2-against-3 interlock.

The sawtooth bass — the only one in the score, an identity marker rather than a
fourth default timbre — states the motif low, and the lead answers it exactly
eight steps later an octave up. The ostinato groups in threes against a square
hat in twos, so the two coincide only twice a bar.

The brief's metric modulation at B is not attempted: transp returns the SAME hat
array by identity, so a B-section hat that regroups cannot exist under a
transposed B. Deferred to whichever pass gives factory a hand-authored B.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `water` — flowing, undertow (first user of the `v?` tuple)

**Files:**
- Modify: `src/audio/tracks.js` — `WATER_A` (`:332-376`), `water:` entry (`:529`)
- Modify: `tests/music.test.mjs` — R3a's uniform-`v` pin (narrowed); new `water` block
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `TONIC.water`, `occ`, `breathBar`, `lanes`
- Produces: `MUSIC_TRACKS.water` at `STEP 0.15`, root `49` (unchanged from wave
  1's pre-move), `B = transp(A, 1.33484)`; the first authored `[s, f, d, v]`
  tuples in the codebase

- [ ] **Step 1: Narrow the uniform-`v` pin and write the failing test**

Inside R3a's `"the v? tuple is legal to author and authored nowhere yet"` block,
replace its `const spread = …` line **and** the `check()` that follows with an
explicit allow-list, so stepped dynamics land where the spec asks for them and
nowhere else. The block's `chans` array is built above and stays as it is:

```js
  /* Stepped dynamics is the direction brief's main maturity lever and the whole
     reason the [s,f,d,v?] tuple exists. Exactly these channels use it. */
  const STEPPED = ["water.A.bass", "water.B.bass"];
  const spread = chans.filter(([, a]) => new Set(a.map((n) => n.v)).size !== 1);
  check(
    "per-note velocity is authored only where the spec asks for it",
    chans.length > 30 && spread.every(([n]) => STEPPED.includes(n)),
    spread.map(([n]) => n).join(","),
  );
```

Append before the `MUSIC RESULT` line:

```js
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
    A.lead.some(
      (n) => n.s % 8 >= 6 && n.s % 8 + Math.round(n.d / A.STEP) > 8,
    ),
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
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/music.test.mjs
```

Expected: FAIL — `water STEP 0.15 ... -> 0.16/49`, `water bass swells through
stepped velocity -> 0.09` (one value), and the contrary-motion check reporting
too few shared steps.

- [ ] **Step 3: Compose `WATER_A`** — compositional directives only

- **Mode / tonic:** G Mixolydian on G (♭7 — major-but-not-quite, "wet").
  `STEP 0.15` (100 BPM), `LEN 64`, `A.bass[0].f = 49.00` (G1, already pre-moved
  in wave 1). `B = transp(A, 1.33484)` — up a perfect fourth.
- **Roles:** lead `triangle` in long legato values that hold **across bar
  lines**; bass `triangle` swelling through stepped `v` (author it as
  `[s, f, d, v]` tuples — at least three distinct velocities); pad `sine`
  running `INV` **below** the lead in contrary motion; hat `triangle`, sparse.
- **Motif treatment:** `PLAIN` with stretched durations; the pad runs `INV`
  against it.
- **Creative move:** two independent lines, not harmony-by-doubling — when the
  lead rises the pad falls, at **every** step where both sound, over at least
  four shared steps. Deliberately **not** the house tresillo: water's identity is
  long ties, not syncopation, so it does not collapse into another tresillo
  track.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green, including the narrowed velocity pin — `water.A.bass` and
`water.B.bass` are the only channels allowed to spread, and `transp` copies
per-note `v`, which is why B lands in the allow-list too.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/audio/tracks.js tests/music.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Rewrite water as two independent lines with a bass that actually swells.

The lead holds long legato values across bar lines instead of pulsing, and the
sine pad moves in contrary motion beneath it — when the lead rises the pad
falls, at every step where both sound. Not harmony-by-doubling, and deliberately
not the house tresillo: water's identity is long ties, so it never collapses
into another syncopated track.

This is the first track to author the [s, f, d, v] tuple R3a added: the bass
crescendos through stepped velocities across the phrase, which the old
one-v-per-channel encoding could not express at all.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `sand` — heat-shimmer, mirage

**Files:**
- Modify: `src/audio/tracks.js` — `SAND_A` (`:415-450`), `sand:` entry (`:530`)
- Modify: `tests/music.test.mjs` — `:733-741` sand root half; the `STEPPED`
  allow-list; new `sand` block
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `TONIC.sand`, `chansOf`, `occ`, `breathBar`, `lanes`
- Produces: `MUSIC_TRACKS.sand` at `STEP 0.139` (unchanged from wave 1's
  pre-move), root `123.47`, `B = transp(A, 1.059463)`

- [ ] **Step 1: Write the failing tests**

In the `"sand void crown STEP and first bass"` check, change
`MUSIC_TRACKS.sand.A.bass[0].f === 69.3` to `=== 123.47`. That is the last row
of the spec's `:733-741` split.

Extend the `STEPPED` allow-list to `["water.A.bass", "water.B.bass",
"sand.A.lead", "sand.B.lead"]`.

Append before the `MUSIC RESULT` line:

```js
// ---- sand: heat-shimmer, mirage (E Phrygian n3 — factory's mode, third raised) ----
{
  const T = MUSIC_TRACKS.sand,
    A = T.A,
    B = T.B;
  check(
    "sand STEP 0.139 (108 BPM), opens on its drone FIFTH B2 123.47, B up a semitone",
    A.STEP === 0.139 &&
      A.bass[0].f === 123.47 &&
      Math.abs(B.bass[0].f / A.bass[0].f - 1.059463) < 1e-9,
    A.STEP + "/" + A.bass[0].f,
  );
  check(
    "sand bass is a drone, mostly tacet: <= 4 notes, none under 8 steps",
    A.bass.length <= 4 &&
      A.bass.every((n) => Math.round(n.d / A.STEP) >= 8),
    A.bass.length + " notes",
  );
  const GS = [207.65, 415.3];
  const soundsGs = (P) =>
    chansOf(P).some((a) => a.some((n) => GS.some((m) => Math.abs(n.f - m) < 0.02)));
  const others = Object.keys(MUSIC_TRACKS).filter((k) => k !== "sand");
  check(
    "sand.A raises the third to G#, and it is the only A section that sounds it",
    soundsGs(A) && !others.some((k) => soundsGs(MUSIC_TRACKS[k].A)),
    others.filter((k) => soundsGs(MUSIC_TRACKS[k].A)).join(","),
  );
  const appo = A.lead.filter((n) => {
    const nxt = A.lead.find((m) => m.s === n.s + 1);
    return (
      nxt && n.v < nxt.v && GS.some((m) => Math.abs(nxt.f - m) < 0.02)
    );
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
    "sand is front-loaded phrases and long trailing rests: <= 38 of 64 steps",
    occ(A) <= 38 && breathBar(A) >= 0,
    occ(A) + "/" + breathBar(A),
  );
  check("sand register lanes never cross, A and B", lanes(A) && lanes(B));
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/music.test.mjs
```

Expected: FAIL — `sand STEP 0.139 ... -> 0.139/69.3`, the G♯ check false, the
appoggiatura check `-> ` empty, and the velocity spread reporting one value.

- [ ] **Step 3: Compose `SAND_A`** — compositional directives only

- **Mode / tonic:** E Phrygian ♮3 on E — **FACTORY's mode with the third
  raised**, the same machine under a hotter sun. `STEP 0.139` (108 BPM),
  `LEN 64`. `B = transp(A, 1.059463)` — up a semitone, the haze.
- **Root:** `A.bass[0].f = 123.47` (B2) — sand opens on its **drone fifth**, not
  its tonic, which is what lets it share E with FACTORY while keeping the biome
  roots distinct and the score down to **one** chromatic guest here (G♯) rather
  than two.
- **Roles:** bass `triangle` drone on the fifth, mostly tacet (≤ 4 notes, each
  ≥ 8 steps); lead `square` with a one-step appoggiatura **at low `v`** resolving
  into the G♯ on the next step; hat `triangle`, sparse; pad `sine` glassy
  interjections.
- **Motif treatment:** `PLAIN` with a one-step appoggiatura before the ♮3̂ (G♯) —
  a full extra step at low velocity, not a sub-step grace note, which the engine
  cannot place.
- **Creative move: stepped swells.** Each phrase crescendos and drops out rather
  than holding one level — the heat waves. At least three distinct lead
  velocities, authored as `[s, f, d, v]` tuples.
- Sparse, front-loaded phrases with long trailing rests: at most 38 of 64 steps.
  Mirage is things fading, not looping cleanly.

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
Rewrite sand as factory's mode with the third raised — one accidental, not two.

Sand shares E with factory on purpose: same machine, hotter sun. It opens on its
drone fifth rather than its tonic, which keeps the biome roots distinct and holds
the score to a single chromatic guest here — the raised third G#, leaned into by
a quiet one-step appoggiatura, since the engine has no sub-step grace notes.

Phrases crescendo through stepped velocities and drop out rather than holding
one level, over long trailing rests: 38 of 64 steps. The heat waves.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: the all-ten structural pins

**Files:**
- Modify: `tests/music.test.mjs` — one new block

**Interfaces:**
- Consumes: `lanes`, `breathBar`, `occ`, `waves`, `soundsDeg`, `TONIC`
- Produces: the score-wide contract — every property wave 1 could only assert
  over its own five, now asserted over all ten

- [ ] **Step 1: Write the pins**

Append before the `MUSIC RESULT` line:

```js
// ---- R3c: the whole score, quantified over all ten tracks ----
{
  const IDS = Object.keys(MUSIC_TRACKS);
  const LADDER = {
    arena: 0.107,
    crown: 0.113,
    factory: 0.119,
    jungle: 0.129,
    menu: 0.134,
    sand: 0.139,
    ice: 0.144,
    water: 0.15,
    intro: 0.17,
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
    Object.keys(ROOT).map((k) => MUSIC_TRACKS[k].A.bass[0].f).join(","),
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
  check(
    "every track has a breath bar — 8 consecutive steps with zero lead",
    IDS.every((k) => breathBar(MUSIC_TRACKS[k].A) >= 0),
    IDS.filter((k) => breathBar(MUSIC_TRACKS[k].A) < 0).join(","),
  );
  const BAND = {
    intro: [0, 18],
    menu: [44, 48],
    jungle: [40, 58],
    ice: [0, 34],
    factory: [40, 58],
    water: [0, 44],
    arena: [0, 62],
    sand: [0, 38],
    void: [0, 20],
    crown: [40, 58],
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
```

The last pin is the pair that actually isolates Ionian: "major third **and**
major sixth" would also describe ICE (Lydian) and WATER (Mixolydian). A perfect
fourth separates it from Lydian's ♯4, and a leading tone from every
flat-seventh mode in the run.

- [ ] **Step 2: Run to PASS**

```bash
node --test
```

Expected: green. If the Ionian pin names a second track, that track's A section
accidentally sounds both intervals above its own tonic — retune that note, do
not weaken the pin.

- [ ] **Step 3: Commit (no PWA bump — tests only)**

```bash
git add tests/music.test.mjs
git commit -m "$(cat <<'EOF'
Pin the whole score: tempo ladder, roots, timbre scarcity, lanes, rests.

These are the assertions that quantify over all ten tracks, so they could only
land once every track was rewritten — asserting them mid-program would have
measured half-old data. Occupancy is banded per track rather than globally,
because "rests are a compositional decision" only means something if the sparse
tracks are actually sparser than the dense ones.

Ionian is isolated by a perfect fourth AND a leading tone: "major third plus
major sixth" would also describe ice and water.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: full-score listen in run order, and sign-off

**Files:**
- Modify: `MEMORY.md`

**Interfaces:**
- Consumes: `tools/bounce/`, the R3a reference set in
  `.superpowers/sdd/2026-09-05-soundtrack/wav/before/`
- Produces: the program's acceptance. **This is the gate, not the pins.**

- [ ] **Step 1: Bounce all ten**

```bash
node tools/bounce/sink.mjs --out .superpowers/sdd/2026-09-05-soundtrack/wav &
npm start &
```

Open `http://127.0.0.1:8080/tools/bounce/index.html` and press **BOUNCE ALL**.

```bash
ls -l .superpowers/sdd/2026-09-05-soundtrack/wav/
git status --short
```

Expected: ten files, all megabytes; `git status` shows no WAV anywhere. A
44-byte file means `bounceTrack` returned 0 — fix before listening.

- [ ] **Step 2: Listen to the whole score in run order**

`intro → menu → jungle → ice → factory → water → arena → sand → void → crown`.
Not just the five new ones: the point of wave 2 is whether the *run* holds
together, and the five wave-1 tracks are half of that. A/B each against
`wav/before/<id>.wav`.

Judge on all four criteria:

1. **Rests are audible.** There is somewhere in every track where you notice
   the silence. VOID is mostly silence.
2. **The motif is traceable by ear** across all ten without being told where it
   is — including that CROWN finishes the phrase VOID leaves hanging.
3. **No constant-beep density.** No track is an unbroken sixteenth carpet; no
   two feel like the same patch at different pitches.
4. **Mood matches the table** blind: played without labels, a listener sorts
   them into roughly the right biomes.

Plus one wave-2-specific question the pins cannot ask: **does each `transp` B
read as a modulation rather than as the same tune moved?** That departure from
the parent collection is the whole justification for keeping `transp` on these
five; if a B reads as mechanical repetition, say so in the notes — it is the
evidence for giving that track a hand-authored B in a later pass.

- [ ] **Step 3: The user listens and signs off**

Present all ten and the four criteria. **A track that passes every Node pin and
fails a listen gets rewritten** — return to its task, recompose within the same
pins, re-bounce, re-listen. Only both sign-offs close program R3.

- [ ] **Step 4: Play-verify in the browser**

Node cannot hear anything, so confirm the live path once by hand: load the game,
let the intro play, enter the menu, start a run and walk rooms 1–5, then check
the three unlocked rooms. Confirm the right track plays on each screen
(`musicCue`'s routing is untouched, so this is a regression check, not a
feature check), that pausing and unpausing does not desync, and that a bomb
blast still ducks the music and sits on top of it.

- [ ] **Step 5: MEMORY + commit (no PWA bump)**

Append to `MEMORY.md` under a `## 2026-09-05 — R3c soundtrack wave 2` heading
(newest first, 1–2 lines): that all ten tracks now share one motif over one
parent collection in eight modal rotations, that `ice`/`jungle`/`factory`/
`water`/`sand` keep a `transp` B at the stated ratio while `menu`/`arena`/
`void`/`crown` have hand-authored ones, that `water.bass` and `sand.lead` are
the only channels using per-note velocity, and that the whole score was listened
to in run order and signed off. Note any track flagged for a hand-authored B in
a later pass.

```bash
git add MEMORY.md
git commit -m "$(cat <<'EOF'
Sign off the soundtrack rewrite after listening to the whole score in run order.

Ten tracks, one motif, one parent pitch collection in eight modal rotations, and
rests written in on purpose. Bounced to WAV and A/B'd against the pre-rewrite
reference by the controller and the user, then play-verified live for cue
routing and ducking.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
