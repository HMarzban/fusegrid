# Soundtrack — design (2026-09-05)

Ten tracks that are all the same idea: a bass pump, an octave-doubled lead, a
hat on every other step, and a "B section" that is A pitch-shifted. Nothing
rests. Nothing develops. That is a jam-build sequencer patch, not a score.

Program R3 rewrites all ten as one score: **one motif, one parent pitch
collection, eight modal rotations of it, and rests written in on purpose.**
The engine keeps its shape — oscillator-only, ≤4 channels, integer steps, zero
deps. What changes is what is written on the grid, plus one injectable-context
seam so a human can finally *hear* a track before it ships.

## Locked decisions

### 0. The grid, named

One step is a **sixteenth**. Eight steps is one **2/4 bar**. `LEN = 64` is
eight bars. Quarter-note **BPM = 15 / STEP** (so today's `STEP 0.15` is the
100 BPM the file header already claims). Every tempo below is stated in both.

The direction brief's 3+3+2 tresillo is therefore literal: accents on steps
**0, 3, 6** of an 8-sixteenth bar is the tresillo, not an approximation of it.

Pitch is absolute Hz, 12-TET, **A4 = 440, rounded to 2 decimals** (the current
table mixes 1- and 2-decimal rounding; the rewrite normalizes). A scale degree
becomes Hz by `f = tonic * 2^(semi/12) * 2^oct`:

| Mode | 1̂ | 2̂ | 3̂ | 4̂ | 5̂ | 6̂ | 7̂ |
|---|---|---|---|---|---|---|---|
| Ionian | 0 | 2 | 4 | 5 | 7 | 9 | 11 |
| Dorian | 0 | 2 | 3 | 5 | 7 | 9 | 10 |
| Phrygian | 0 | 1 | 3 | 5 | 7 | 8 | 10 |
| Lydian | 0 | 2 | 4 | 6 | 7 | 9 | 11 |
| Mixolydian | 0 | 2 | 4 | 5 | 7 | 9 | 10 |
| Aeolian | 0 | 2 | 3 | 5 | 7 | 8 | 10 |
| Locrian | 0 | 1 | 3 | 5 | 6 | 8 | 10 |
| Phrygian ♮3 | 0 | 1 | 4 | 5 | 7 | 8 | 10 |

### 1. The motif

**Degrees 1̂ – 3̂ – 5̂ – 6̂ – 5̂. Rhythm 1-1-1-3-1 steps, at steps 0, 1, 2, 3, 6
of a bar. Step 7 rests.** "Arm — arm — arm — flash — settle — breathe."

In the engine's phrase encoding (`[s, f, d]` triples, `d` in steps, exactly what
`mkPat`/`oct` already take), on **D4 in D Dorian**:

```js
// MOTIF, PLAIN — menu bar 1, D Dorian on D4
[[0, 293.66, 1], [1, 349.23, 1], [2, 440.00, 1], [3, 493.88, 3], [6, 440.00, 1]]
//   D4  1̂        F4  ♭3̂         A4  5̂          B4  6̂ (held)     A4  5̂
```

Why this figure survives eight modes: 1̂/5̂ are fixed in every mode but Locrian,
3̂ swings minor↔major, and **6̂ — the "flash" — is the note that names the mode.**
Dorian's ♮6 (B over D), Phrygian's ♭6, Lydian's ♮6 over a ♯4 world, Locrian's ♭6
over a ♭5. The same five-note gesture reads as eight different colours because
its longest note is always the modal fingerprint. That is the whole spine.

**Transformations** (locked vocabulary — every one lands on whole steps):

| Name | Definition | Steps / durations |
|---|---|---|
| `PLAIN` | as authored | 0,1,2,3,6 / 1,1,1,3,1 |
| `AUG` | ×2 durations, two bars | 0,2,4,6,12 / 2,2,2,6,2 |
| `FRAG-MID` | notes 2–4 only (3̂ 5̂ 6̂) — no tonic, no settle | 1,2,3 / 1,1,3 |
| `ANTIC` | whole figure one step early | b·8−1 … / same |
| `INV` | scale-step mirror below the tonic: 1̂ ↓6̂ ↓4̂ ↓3̂ ↓4̂ | 0,1,2,3,6 / 1,1,1,3,1 |
| `CANON` | `PLAIN` restated in a second channel exactly 8 steps later | +8 |
| `RESOLVED` | `PLAIN` + a 6th note, 1̂ one octave above the head | +0,1,2,3,6,7 / …,2 |

Per-track transformation and mode:

| Track | Mode / tonic | Motif treatment |
|---|---|---|
| `intro` | D Dorian | `PLAIN`, unaccompanied — the motif's first statement in the game |
| `menu` | D Dorian | `PLAIN` (bar 1), developed (bars 2–3, 5–7); B answers it in G major |
| `jungle` | D Dorian | `FRAG-MID` in the answer slots; `PLAIN` once, at bar 5 |
| `ice` | F Lydian | `AUG` — the motif in slow motion, two bars per statement |
| `factory` | E Phrygian | `CANON` — bass states it, lead answers one bar later, an octave up |
| `water` | G Mixolydian | `PLAIN` with stretched durations; pad runs `INV` against it |
| `arena` | A Aeolian | `ANTIC` — the head lands one step before the downbeat |
| `sand` | E Phrygian ♮3 | `PLAIN` with a one-step appoggiatura before the ♮3̂ (G♯) |
| `void` | B Locrian | `FRAG-MID` only — no tonic under it, no resolution after it |
| `crown` | C Ionian | `RESOLVED` — the tonic VOID withheld, finally supplied |

**`reveal` is not a track.** It is an SFX name in `audio.js`'s `play()` switch
(`src/audio.js:378`), direct-to-destination, and it does not move (§4).

### 1b. One collection, eight rotations

Every biome is a **rotation of one white-key collection whose home is D Dorian**
— the menu's key. Room 1 is literally in the menu's key; the run then rotates
the same seven notes through Lydian, Phrygian, Mixolydian, Aeolian, Locrian and
Ionian and lands on the only pure major in the game. **Every `A` section is pure
white-key but one**, and the two chromatic guests in the score are both
load-bearing: **G♯** (SAND's raised third, in `A`) and **F♯** (menu's `B`).

| Track | Tonic | `A.bass[0].f` | Note |
|---|---|---|---|
| `intro` | D | **55.00** (A1) | pedal on the *dominant* — the bed never states the tonic in the bass |
| `menu` | D | **73.42** (D2) | the resolution the intro withholds |
| `jungle` | D | **73.42** (D2) | deliberately identical to `menu` — room 1 is home |
| `ice` | F | **87.31** (F2) | |
| `factory` | E | **82.41** (E2) | |
| `water` | G | **49.00** (G1) | |
| `arena` | A | **55.00** (A1) | |
| `sand` | E | **123.47** (B2) | opens on its drone *fifth*, not its tonic |
| `void` | B | **61.74** (B1) | |
| `crown` | C | **65.41** (C2) | |

The eight biome values are distinct (73.42 / 87.31 / 82.41 / 49.00 / 55.00 /
123.47 / 61.74 / 65.41) so `music.test.mjs:719-732` holds by construction.
`menu` and `intro` are not in that set, which is what lets `menu` share room 1's
root on purpose.

SAND and FACTORY share the tonic E deliberately: **SAND is FACTORY's mode with
the third raised** — the same machine under a hotter sun. One accidental (G♯),
not two, and the roots stay distinct because SAND's bass is a drone fifth.

**The `transp` contradiction, stated once.** `transp(A, r)` is a real chromatic
transposition: for the five tracks that keep it this pass, B leaves the parent
collection for eight bars and snaps back. That departure *is* the modulation and
it is audible as one — but it is also why a hand-authored B is better, and why
the staging in §2 exists at all rather than converting all nine at once.

### 2. Per-track spec

Shared rules, true of all ten and pinned once (§6): `LEN = 64` (`intro` 32);
`sections = ["A","A","B","B"]` (`intro` `["A"]`); `max(bass.f) < min(lead.f)`
(register lanes never cross); no track puts a note on all 64 steps; every track
has at least one **breath bar** — 8 consecutive steps with zero `lead` notes.

Panning is untouched: `MUS_PAN` stays `{bass:-0.32, lead:0.32, hat:0.1,
pad:-0.06}` and no track authors `n.p` (§4).

---

**`intro` — held breath.** D Dorian · `STEP 0.170` (88 BPM) · `LEN 32` ·
`sections ["A"]`, `B` stays `null`.
Lead `triangle` states `PLAIN` on D4 alone; bar 2 rests; bar 3 restates it an
octave up; bar 4 holds the 6̂ by itself. Pad `sine` enters at step 8 with one
16-step D3 drone. Bass `triangle` enters at step 16: **one note**, A1 pedal,
16 steps. **No hat at all.**
Creative move: the motif is introduced unharmonized, so every later biome's
reharmonization is a discovery.
Pins: `hat.length === 0`; `bass.length === 1 && bass[0].s === 16 && bass[0].f
=== 55`; steps 0–7 carry `lead` notes and nothing else; `MUSIC_TRACKS.intro.B
=== null`.

**`menu` — confident, swaggering.** D Dorian · `STEP 0.134` (112 BPM) ·
hand-authored B (kept and rewritten).
A: bass `square` on the tresillo (`s % 8 ∈ {0,3,6}`) walking Dm → G → Am →
Dm-breath; lead `square` in straight sixteenths against it — rhythmic
counterpoint, never unison; hat `triangle` on the offbeats only (`s % 8 ∈
{2,6}`); no pad. Bars 4 and 8 drop the lead entirely. Bars 5–8 are a **varied
restatement, not an octave copy** — `oct()` is not used for menu's lead.
B: tonicizes **G major** for eight bars and snaps back, which imports the one
F♯ the collection does not own.
Creative move: B is the template the other three hand-authored Bs follow — same
skeleton, same mix, a genuinely different harmonic destination.
Pins: every `A.bass` note `s % 8 ∈ {0,3,6}` and `A.bass.length === 20`;
`A.hat.length === 16` with every `s % 8 ∈ {2,6}`; `A.lead` has zero notes in
steps 24–31 and 56–63; **`B` sounds F♯ (92.50 / 185.00 / 369.99) at exactly
steps 11, 29, 43, 61 and `A` sounds none of those three pitches.**

**`jungle` — overgrown, humid, alive.** D Dorian · `STEP 0.129` (116 BPM) ·
B = `transp(A, 1.189207)` (up a minor third — into the relative major's key).
Bass `square` 3+3+2 ostinato; lead `triangle` answering in the gaps; hat
`triangle`; pad `sine` canopy — two 32-step drones, A2 110.00 then D3 146.83.
Creative move: **strict call-and-response.** The bass asks, the lead answers, and
they never speak over each other. Two consequences, both authored, not accidents:
the bass rests through bars 5 and 8 (where the lead's full `PLAIN` statement and
the breath bar live), and in the six answer bars **the ostinato drops its step-3
hit** — `FRAG-MID` occupies steps 1,2,3, and step 3 is a tresillo step. Call bars
are the full 0-3-6; answer bars are 0-6, opened up for the lead.
Pins: no step carries both a `bass` and a `lead` note; every `A.bass` note has
`s % 8 ∈ {0,3,6}`; `A.bass` is silent in steps 32–39 and 56–63; `A.pad.length ===
2` with both durations 32 steps.

**`ice` — brittle, echoing.** F Lydian · `STEP 0.144` (104 BPM) ·
B = `transp(A, 1.122462)` (up a whole tone — the shimmer brightening a step).
Pad `sine` holds Lydian chord tones including the ♯4 (B, 246.94 / 493.88); lead
`triangle` runs `AUG`; bass `triangle` is reduced to occasional cracks; hat
`triangle` at 6200 Hz every 8 steps.
Creative move: **register separation is the whole idea** — the absence of low
end is the ice.
Pins: `A.bass.length <= 6` and every bass note ≥ 4 steps long; every `A.lead.f
>= 523.25` (C5); the lead's first statement is `AUG` at steps 0,2,4,6,12;
the ♯4 is present in `A.pad`.

**`factory` — mechanical, cold competence.** E Phrygian · `STEP 0.119`
(126 BPM) · B = `transp(A, 0.890899)` (down a whole tone — the machine gearing
down). No pad.
Bass **`sawtooth`** — the only sawtooth bass in the score — states the motif low
in bar 1 and runs an engine ostinato after; lead `square` answers `CANON` at bar
2, an octave up; hat **`square`** on every even step.
Creative move: **2-against-3 interlock** — the ostinato groups in 3s against a
hat in 2s, coinciding only twice a bar.
Pins: `A.bass.t === "sawtooth"` and it is the only track whose bass is;
`A.hat` is `square` and every hat `s % 2 === 0`; the lead's motif head is
exactly 8 steps after the bass's; `A.pad === undefined`.
*(The brief's metric modulation at B — hat switching to 3+3+2 — is impossible
under `transp`, which shares the hat array by identity. Deferred to the pass
that gives FACTORY a hand-authored B. Not attempted here.)*

**`water` — flowing, undertow.** G Mixolydian · `STEP 0.150` (100 BPM) ·
B = `transp(A, 1.334840)` (up a perfect fourth).
Lead `triangle` in long legato values that hold across bar lines; bass
`triangle` swelling through stepped `v`; pad `sine` running `INV` **below** the
lead in contrary motion; hat `triangle`, sparse.
Creative move: two independent lines, not harmony-by-doubling — when the lead
rises the pad falls.
Pins: at least 6 `A.lead` notes are ≥ 4 steps long and at least one starts at
`s % 8 >= 6` and runs past the bar line; `new Set(A.bass.map(n => n.v)).size >=
3` (stepped dynamics); at every step where `pad` and `lead` both sound, their
pitch motion since the previous shared step has opposite sign.

**`arena` — aggressive, combat-ready.** A Aeolian · `STEP 0.107` (140 BPM) ·
**hand-authored B.**
All four voices: bass `square`, lead `square`, hat `triangle` on every even step,
pad `sawtooth`. Syncopated stabs on the "and" of 2 and 4.
Creative move: **whole-step anticipation** — the motif head lands one step
*before* the expected downbeat, so the fanfare punches ahead of the grid without
sub-step timing.
Pins: all four channels non-empty and `pad.length > 0` — the only track with all
four dense; the `ANTIC` motif head sits at step 15 (anticipating bar 3);
`A.lead` has notes at steps ≡ 3 and ≡ 7 mod 8; `B.hat !== A.hat` (hand-authored).

**`sand` — heat-shimmer, mirage.** E Phrygian ♮3 · `STEP 0.139` (108 BPM) ·
B = `transp(A, 1.059463)` (up a semitone — the haze).
Bass `triangle` drone on the fifth, mostly tacet; lead `square` with a one-step
appoggiatura at low `v` resolving into the G♯; hat `triangle`, sparse; pad
`sine` glassy interjections.
Creative move: **stepped swells** — each phrase crescendos and drops out rather
than holding one level; the heat waves.
Pins: `A.bass[0].f === 123.47`, `A.bass.length <= 4`, every bass note ≥ 8 steps;
G♯ present (207.65 or 415.30) and `sand.A` is the only **A** section that sounds
it (the `transp` B sections leave the collection by design, §1b); a lead
note at step *s* with `v` below the following note's `v`, where that following
note at *s+1* is the G♯; `new Set(A.lead.map(n => n.v)).size >= 3`.

**`void` — dread, something watching.** B Locrian · `STEP 0.234` (64 BPM) —
the one deliberate exception to the tempo band · **hand-authored B.**
**Two voices.** Bass `triangle`, a single sustained B1 pedal at very low `v`.
Lead **`sine`** — the only sine lead in the score — plays `FRAG-MID` and nothing
else. `hat` is an empty array. No pad.
Creative move: **subtraction.** Both ends of the motif are removed: no tonic
under the figure, no settle after it. The incompleteness is the horror; nothing
dissonant is added to get it.
Pins: `A.hat.length === 0` and `A.pad === undefined`; **`A.lead` never sounds
degree 1̂** — no lead frequency is within 0.05 semitone of a power-of-two
multiple of 61.74; no bar of `A.lead` matches `PLAIN`, and at least two bars
match `FRAG-MID`; `A` puts notes on at most **20** of its 64 steps — the sparsest
track in the game.

**`crown` — finale gold.** C Ionian, the only pure major · `STEP 0.113`
(133 BPM) · **hand-authored B.**
Bass `square`, lead `square` in a dotted fanfare, hat `triangle`, pad `sawtooth`
doubling the lead one octave up for brass weight.
Creative move: **payoff quotation.** `crown.B`'s hat reproduces `arena.A`'s hat
step-pattern verbatim — a victory lap past the arena — and the lead states
`RESOLVED`, supplying the tonic VOID refused to play. **The quote is of the step
pattern, not the wall clock** — `crown .113` against `arena .107` plays the same
figure about 5% broader, which is what a victory lap should sound like. Do not
try to match durations; that breaks the pin and the point.
Pins: `B.hat.map(n => n.s)` deep-equals `arena.A.hat.map(n => n.s)`, and
`B.hat !== A.hat`; the `RESOLVED` statement's last note is within 0.05 semitone
of 2× its head; **`crown.A` sounds both a perfect fourth (5 semitones) and a
leading tone (11) above its tonic, and no other `A` section sounds both** — that
pair is what separates Ionian from Lydian (which has 11 but ♯4) and from every
flat-seventh mode in the run; at least 8 `pad` notes
share a step with a `lead` note at exactly 2× its frequency.

---

**Hand-authored B this pass: `menu`, `arena`, `void`, `crown`.**
`transp` B this pass: `jungle`, `ice`, `factory`, `water`, `sand`.
`intro` keeps `sections ["A"]` and no B — correct for its screen time.

That staging is pinnable in one line, because **`transp` returns the *same* hat
array by identity** (`tracks.js:175-190`, `hat: P.hat`):

```js
["menu","arena","void","crown"].every(k => M[k].B.hat !== M[k].A.hat)
["jungle","ice","factory","water","sand"].every(k => M[k].B.hat === M[k].A.hat)
```

**Tempo ladder** (all ten distinct, so `music.test.mjs:701-718` holds):
`arena .107` · `crown .113` · `factory .119` · `jungle .129` · `menu .134` ·
`sand .139` · `ice .144` · `water .150` · `intro .170` · `void .234`.
Seven biomes sit in the brief's 104–140 band; VOID is outside it on purpose.

**Waveform roster.** `square` for hard roles, `triangle` for colour, plus two
scarce timbres used exactly once each as identity markers: **`sawtooth` bass =
FACTORY**, **`sine` lead = VOID**. Pads are `sine` except ARENA/CROWN, which are
`sawtooth`. Every track uses at least two distinct waveforms. (`note()` sets
`o.type = n.t` with no whitelist, and the SFX layer already ships `sine` and
`sawtooth` — a third and fourth music timbre are free.)

**One data-encoding change: per-note velocity.** Stepped dynamics is the
brief's main maturity lever and today's `mkPat` cannot express it — `E(a,t,v)`
stamps one `v` on every note in a channel. Note tuples become **`[s, f, d, v?]`**,
`v` defaulting to the channel's `mix` value; `pulse`/`oct`/`hats` pass the 4th
element through. `tracks.js` only. No engine change, no new note field — `{s,f,
d,t,v}` is unchanged.

### 3. Engine seam for listening

There is no audible verification path in this repo. Every music test is
structural; nobody has ever heard a track before shipping it. R3 closes that with
an **offline bounce to WAV**, and the shipped game pays almost nothing for it.

**Shipped code gains exactly two things, in `src/audio.js`:**

1. `createAudio(opts)` — `opts.ctx`, when present, is used instead of
   `window.AudioContext` inside `ensure()`. ~5 lines, `audio.js:43-73`. Callers
   that pass nothing behave byte-identically; `main.js` is untouched.
2. `bounceTrack(id, seconds)` on the returned object — the bulk scheduler. It
   sets `curId`, walks `stepN = 0,1,2,…` accumulating `t += P.STEP` from 0, calls
   the **same** `patOf()` / `emitStep()` / `note()` the live path uses, stops at
   `t >= seconds`, restores `curId`/`stepN`, and returns the step count. ~14
   lines. It returns `0` when `!ctx || !musicGain`, and **nothing under `src/`
   calls it** — in production it is unreachable code that no `window` path enters.
   Its time accumulator is a **local `t` starting at 0**: `nextT` is never read
   and never written, so a live `pump()` cannot be desynced by a stray call.

*Why not extract `note`/`emitStep`/`patOf` into a `src/audio/sched.js` that the
harness imports directly?* Because that is the same bytes relocated plus a new
precache entry and an extra module fetch — it does not buy "zero shipped bytes",
and it costs a rewrite of the live scheduler (all three close over `ctx`,
`musicGain` or `curId`) in a program whose §4 says the voice architecture does
not move. The directive's two halves cannot both be literal; this resolves toward
the one that leaves `pump()` alone.

**Everything else is dev-only and lives in `tools/bounce/`** — outside `src/`,
absent from `src/pwa/shell.js`'s `SRC` list, never fetched by a player:

- `tools/bounce/index.html` + `bounce.js` — imports `createAudio` and
  `MUSIC_TRACKS`, and for each of the ten ids builds
  `new OfflineAudioContext(2, seconds * 44100, 44100)`, calls
  `createAudio({ctx})`, `unlock()` (which builds `musicGain` on the injected
  ctx exactly as live), `bounceTrack(id, seconds)`, `await ctx.startRendering()`.
- `tools/bounce/wav.js` — hand-rolled RIFF/PCM16 encoder (interleave, clamp,
  44-byte header). ~50 lines, zero deps, pure, Node-testable against a
  synthetic AudioBuffer-shaped object.
- `tools/bounce/sink.mjs` — `node:http` listener writing `POST` bodies to
  `tools/bounce/out/<id>.wav` (gitignored). Zero deps.

**Bounce length**: one full cycle plus a 2-second tail, floored at 20 s —
`Math.max(20, A.LEN * sections.length * A.STEP + 2)`. That is 20 s for `intro`,
36 s for `menu`, 62 s for `void`.

**CYC literal: does not move.** `LEN` stays 64 and `MUSIC_SECTIONS` stays
`["A","A","B","B"]`, so `music.test.mjs:349-390`'s `CYC = 256` is correct
unchanged. Its sibling `S = MUSIC_PATTERN.STEP` is already derived. Only the
`probe > 250` density threshold moves, and only because we are writing rests
(§5).

### 4. What refuses to change

SFX tables and tints (`boom.js`, `item.js`, `foe.js`, and the `reveal` cue) —
untouched, in both content and routing. The SFX direct-to-destination
architecture and its pin (`music.test.mjs:503-536`). `duck()` and its
`0.5 → 0.16` / 0.35 s / 0.6 s ramps (`:437-501`). `setVols` scaling semantics and
`MUS_FLOOR` (`:994-1063`). `musicCue`'s screen/level routing and the exact
10-key `MUSIC_TRACKS` set (`:695-700`, `:756-781`). `MUS_PAN` — panning stays
engine-side, per channel role, identical across every track; **no track authors
`n.p`.** Zero npm deps. No samples, no `decodeAudioData`. The note schema
`{s,f,d,t,v}`. `pump()`'s lookahead/catch-up model and the whole per-note voice
graph — the injectable ctx and `bounceTrack` are additive and touch neither.
`src/core/*` and determinism: nothing here reaches `step()`.

### 5. ABI renegotiation

| Site | Today | New | Plan |
|---|---|---|---|
| `music.test.mjs:187-190` | `STEP 0.15`, `LEN 64` | `STEP 0.134`, `LEN 64` (LEN holds ⇒ `CYC` holds) | R3b |
| `:204-208` | `bass.length === 32` | `=== 20`, every `s % 8 ∈ {0,3,6}` | R3b |
| `:209-213` | `lead.length === 30` | 24–32, zero lead in steps 24–31 and 56–63 | R3b |
| `:214-218` | `hat.length === 32`, odd steps | `=== 16`, `s % 8 ∈ {2,6}` | R3b |
| `:219-227` | A-A-F-G roots 55/55/82.4/43.65/49 | `bassByS` 0→73.42, 8→49.00, 16→55.00, 24→73.42 | R3b |
| `:231-236` | bars 5-8 lead = bars 1-4 ×2 | **deleted** (`oct()` unused on menu) → "≥ 4 lead steps in bars 5-8 differ from bars 1-4" | R3b |
| `:237-242` | durations positive, within span | unchanged (inequality — safe against float `d`) | — |
| `:247-252` | `MUSIC_SECTIONS === ["A","A","B","B"]` | **unchanged** | — |
| `:260-264` | B `STEP`/`LEN` match A | unchanged | — |
| `:265-279` | B mix: per-note `t` **and** `v` equal A's | same `t` per channel; same **set** of `v` per channel (per-note `v` is now legal) | R3b |
| `:280-284` | B hat 32, odd steps | `B.hat.length === 16`, `s % 8 ∈ {2,6}` | R3b |
| `:285-292` | B roots ≠ A roots | keep, **plus** B sounds F♯ (92.50/185.00/369.99), A sounds none | R3b |
| `:293-299` | B lead contour ≠ A | unchanged | — |
| `:349-390` | wrap `CYC=256`, `probe > 250` | `CYC = 256` **unchanged**; threshold becomes data-derived: `expected = 2·occ(menu.A) + 2·occ(menu.B)` from the frozen tables, assert `probe >= expected - 2` | R3b |
| `:391-406` | envelope probe via `MUSIC_PATTERN.bass[0]` | derived — unchanged code, new value (73.42) | R3b |
| `:623-674` | `isBmark [110, 58.27, 87.31]`, `EXP [4,16,18,20,22,36,48,50,52,54]` | `isBmark [92.50, 185.00, 369.99]`, `EXP [11, 29, 43, 61]`. The `520`-iteration drive was sized against `STEP 0.15`; at 0.134 it covers more steps, so it is safe — **re-derive it, do not assume** | R3b |
| `:695-700` | menu identity triple | **unchanged** | — |
| `:701-718` | 10 distinct tempos | **unchanged** (new ladder is distinct) | R3b/c |
| `:719-732` | 8 distinct biome roots | **unchanged** (new roots are distinct) | R3b/c |
| `:733-741` | `sand .17/69.3`, `void .19/49`, `crown .13/98` | `sand .139/123.47`, `void .234/61.74`, `crown .113/65.41` | R3b/c |
| `:742-754` | all voices finite | **unchanged** — verified: `fin` is called on `bass`/`lead`/`hat` only, never `pad`, and `fin([])` is `true`, so VOID's empty hat and absent pad pass as written | — |
| `:756-781` | `musicCue` routing | **unchanged** | — |
| `:788-793` | "water downbeat is B1=61.74, not menu A1=55" | "water downbeat is 49.00, not menu's 73.42" | R3c |
| `:805-811` | "setTrack menu restores A1=55" | `73.42` | R3b |
| `:983-992` | `audio.js` free of `Math.random`/`Date.`/`setInterval` | **unchanged** — the ctx seam and `bounceTrack` use none | — |
| `audio.js:43` `createAudio()` | no args | `createAudio(opts)`, `opts.ctx` optional | R3a |
| `audio.js` returned object | 10 keys | `+ bounceTrack` | R3a |
| `tracks.js` `mkPat` tuples | `[s, f, d]` | `[s, f, d, v?]` | R3a |
| `CACHE_NAME` / `sw.js` `REV` | `fusegrid-shell-v55` (moves under us; read it, do not assume) | +1 per plan, both files in the same commit | each |

### 6. Verification

**Node (`node --test`), added to `music.test.mjs` as one new block per track.**
Two shared helpers, both pure over frozen data:

- `semi(f, f0) = 12 * Math.log2(f / f0)`, compared with a 0.05-semitone
  tolerance.
- `motifAt(chan, bar)` — true when the channel has notes at bar-relative steps
  0,1,2,3,6 whose semitones above the head are `[0, m3, m5, m6, m5]` with
  `m3 ∈ {3,4}`, `m5 ∈ {6,7}`, `m6 ∈ {8,9}`. One helper covers all eight modes,
  because the motif's degrees are exactly the ones every mode agrees on to within
  those pairs. `fragMidAt` is the 3-note variant.

**Durations are never pinned by equality.** `d = steps × STEP` is a float
(`3 × 0.107 = 0.32100000000000004`); every duration fact is written as
`Math.round(n.d / P.STEP)` or an inequality.

Per track, the pins listed in §2, plus the cross-track set:

- staging: the two `B.hat === / !== A.hat` lines (§2).
- lanes: `max(bass.f) < min(lead.f)` for all ten.
- timbre scarcity: exactly one sawtooth bass (`factory`), exactly one sine lead
  (`void`), every track ≥ 2 distinct waveforms.
- quotation: `crown.B.hat` steps deep-equal `arena.A.hat` steps.
- rests: **no track occupies all 64 steps**, every track has a breath bar, and
  occupancy (distinct steps carrying any note) lands in band —
  `void ≤ 20`, `intro ≤ 18` (of 32), `ice ≤ 34`, `sand ≤ 38`, `water ≤ 44`,
  `jungle`/`factory`/`crown` 40–58, `arena ≤ 62`. **`menu` is a number, not a
  band**: `occ(menu.A)` and `occ(menu.B)` are each **46 ± 2** (target 46 — 6 bars
  at ~6 occupied steps plus two 3-step breath bars). It is pinned tightly because
  the wrap test's `expected` derives from it: at 46/46 the drive compares ~184 of
  256 buckets, and a menu authored down at 41 would leave both pins consistent
  while quietly shipping a sparser theme than this spec asks for.
- `wav.js`: round-trips a synthetic 2-channel buffer to a 44-byte-header
  RIFF/PCM16 blob of the expected length, clamps out-of-range samples.

**The human loop — this is the actual acceptance gate.**
`node tools/bounce/sink.mjs`, open `tools/bounce/index.html`, bounce all ten,
then listen to `out/*.wav` in run order: `intro → menu → jungle → ice → factory
→ water → arena → sand → void → crown`. R3a bounces the *current* tracks first,
so every later listen is an A/B against what shipped.

"Mature" is accepted only when a listener can say all four:

1. **Rests are audible.** There is somewhere in every track where you notice the
   silence. VOID is mostly silence.
2. **The motif is traceable by ear** across all ten without being told where it
   is — including that CROWN finishes the phrase VOID leaves hanging.
3. **No constant-beep density.** No track is an unbroken sixteenth-note carpet;
   no two tracks feel like the same patch at different pitches.
4. **Mood matches the table** blind: played without labels, a listener sorts them
   into roughly the right biomes.

Controller listens first, then the user, and both sign off **before** the pass
ships. A track that passes every Node pin and fails a listen gets rewritten; the
pins exist to stop regressions, not to grant approval.

### 7. Ship order

**R3a — engine seam + bounce harness.** `createAudio(opts)` with `opts.ctx`,
`bounceTrack(id, seconds)`, the `[s,f,d,v?]` tuple in `mkPat`/`pulse`/`oct`,
`tools/bounce/` (page, `wav.js`, `sink.mjs`, gitignored `out/`), the `wav.js`
Node test. **No track data changes** — every existing music pin passes
byte-identically, which is the property that makes this plan reviewable. Bounce
all ten current tracks and keep them as the "before" reference.
`CACHE_NAME`/`REV` +1 from whatever is current, both files in the same commit.

**R3b — wave 1: the four that need a real B.** `intro`, `menu`, `arena`, `void`,
`crown`. This is the motif's whole arc — bare statement, home theme, anticipation,
subtraction, resolution — so it is the wave that proves the spine works. Carries
most of §5's table. **Listening checkpoint before R3c starts:** bounce these five,
A/B against R3a's reference, controller + user sign-off. `CACHE_NAME`/`REV` +1.

**R3c — wave 2: the five `transp` biomes.** `jungle`, `ice`, `factory`, `water`,
`sand`, each with its stated ratio. Finishes §5. Final listen is the whole score
in run order, not just the five. `CACHE_NAME`/`REV` +1.

## Refuse

Samples of any kind, `decodeAudioData`, any npm dependency. Sub-step timing —
no fractional `s`, no smaller `STEP` bought to fake triplets, no non-integer
lookup in `pump()`; every rhythmic device here is whole-step by construction.
Touching SFX tables, tints, `reveal`, or the direct-to-destination path. Changing
`duck`, `setVols`, `MUS_BASE`/`MUS_DUCK`, or `MUS_FLOOR` — the authored mix
balance is already negotiated and the volume defaults depend on it. Adding,
removing or renaming a `MUSIC_TRACKS` key, or changing `musicCue`. Per-track or
per-heat panning tables, per-heat texture swaps, and any runtime music
generation. New note fields (`n.p` stays engine-supplied). Reverb, delay, sends,
sidechain — space is written in, not processed in. A pattern-player abstraction
or a `sched.js` extraction (§3). Anything reaching `src/core` or `step()`.

## Self-review

Fixed inline, before locking:

- **`fin()` scope, verified not assumed.** VOID's `hat: []` + absent `pad`
  looked like it might fail the ENGINE-ABI pin at `:742-754`. Read in full: `fin`
  is called on `bass`/`lead`/`hat` only, and `fin([])` is `true`. The pin holds
  unchanged; the headline VOID fact is safe.
- **Stepped dynamics were impossible.** `mkPat`'s `E(a,t,v)` stamps one `v` per
  channel, so the brief's central maturity lever could not be authored. Added the
  `[s,f,d,v?]` tuple to R3a, and moved the `:265-279` "B mix matches A" pin from
  per-note `v` equality to per-channel `v` sets.
- **`transp` shares `hat` by identity.** Turned that into the single pin for the
  whole hand-authored-B staging — and it killed FACTORY's metric-modulation move,
  which cannot exist under a transposed B. Said so, deferred it, replaced it.
- **`probe > 250` fights the whole program.** Writing rests drops the occupied
  bucket count below 250; the threshold is now derived from the same occupancy
  numbers §6 pins, so the wrap pin and the density pin cannot disagree.
- **VOID's motif contradicted itself.** `FRAG3` (1̂ 3̂ 5̂) sounds the tonic, which
  the "never degree 1̂" fact forbids. Became `FRAG-MID` (3̂ 5̂ 6̂) — no ground under
  it, no resolution after it, and a stronger version of the same idea.
- **SAND kept the one-accidental mode.** Moved its `bass[0].f` to the drone fifth
  B2 123.47 so E Phrygian ♮3 survives without colliding with FACTORY's root —
  one chromatic guest instead of two, and the biome-root distinctness pin holds
  by construction.
- **CROWN's uniqueness pin was false.** "The only track with a major third and a
  major sixth" also describes ICE (Lydian) and WATER (Mixolydian). Replaced with
  the pair that actually isolates Ionian: perfect fourth **and** leading tone.
- **G♯ and F♯ claims scoped to `A`.** A `transp` B is a chromatic transposition,
  so e.g. `jungle.B` lands on F Dorian and necessarily sounds A♭ — the same
  frequency as SAND's G♯. Both accidental facts now read on `A` sections only,
  where they are true by construction.
- **JUNGLE's call-and-response was unsatisfiable.** `FRAG-MID` sits on steps
  1,2,3 and step 3 is a tresillo hit, so the "never the same step" pin failed in
  the six answer bars. Fixed by authoring the ostinato to drop its step-3 hit in
  answer bars — which is better writing than the pin it was rescuing.
- **Float durations.** Every duration fact rewritten as a step count.
- **Tempo units.** The brief's 104–140 BPM band assumed a quarter = 2 steps
  reading that the shipped `STEP` values contradict. Fixed the convention at
  1 step = a sixteenth (BPM = 15/STEP), which reproduces the file header's own
  "100 BPM at STEP 0.15" and makes the 3+3+2 tresillo literal.
- **Scope.** `reveal` is an SFX, not a track — named and excluded. The `sched.js`
  extraction was cut for not buying the property it was chosen for.
