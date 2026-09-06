# Soundtrack — design (2026-09-05)

> **Direction v2 — 2026-09-06, on user feedback.** The score that shipped under
> the first reading of this document was rejected on a listen: it did not sound
> like the classic bomber-arcade game it is modelled on. The user's words were
> that the soundtrack is *"not like the real game"* of that genre. The identity
> below (§0a), the motif's rhythm (§1), the tempo ladder, and every per-track
> row in §2 are rewritten to the corrected direction. **What survives:** the
> engine's shape, the five-note motif's *contour*, the one-collection /
> eight-rotation scheme, the per-biome mood contrast, `MUS_PAN`, `transp`, the
> hand-authored-B staging, and the CROWN-quotes-ARENA payoff. **What is
> withdrawn:** rests as a structural feature, breath bars as a shared mandate,
> withheld resolutions, chamber dynamics, and tempo used as a mood lever. The
> engine-seam (§3), refuse list (§4) and bounce harness are untouched by v2.
>
> Rewrite lands in two waves: **wave A** = `intro`, `menu`, `jungle`, `ice`,
> `factory`; **wave B** = `water`, `arena`, `sand`, `void`, `crown`. §7 carries
> the ordering constraints that keep the suite green between them.

Ten tracks that were all the same idea: a bass pump, an octave-doubled lead, a
hat on every other step, and a "B section" that is A pitch-shifted. Nothing
developed. That is a jam-build sequencer patch, not a score.

Program R3 rewrites all ten as one score: **one motif, one parent pitch
collection, eight modal rotations of it, and a written arrangement per biome.**
The engine keeps its shape — oscillator-only, ≤4 channels, integer steps, zero
deps. What changes is what is written on the grid, plus one injectable-context
seam so a human can finally *hear* a track before it ships.

## Locked decisions

### 0a. Identity (v2)

**Bright, driving, hummable arcade pop on 3–4 voices — a constant pulse and a
tune you can whistle after one loop. Energy first, mood second; darkness is
expressed through timbre and mode, never through tempo collapse or silence.**

Three consequences that decide every argument downstream:

1. **The rhythm section never stops.** Hat and/or bass carry an audible
   eighth-note-or-better subdivision through the whole loop, on every track, no
   exceptions. Measured as `pulseGap` — the longest run of consecutive steps
   (cyclically) with no `bass` and no `hat` note — which is **≤ 1** everywhere.
2. **The bass is the single biggest feel lever**, and its default state is
   *moving*: root–octave or root–fifth patterns that keep bouncing. The bass is
   never the drone voice, and it never rests for a whole bar.
3. **"Constant pulse" is density, not literal 100% occupancy.** The shared rule
   that no track puts a note on all of its steps stays (a fully occupied channel
   grid is its own monotony, and the pin is cheap). The target is therefore
   **maximum density short of full occupancy — one deliberate gap per loop, not
   a rest-laden texture.** Occupancy is pinned as a *band with a floor*, so a
   track cannot quietly drift back toward sparseness.

**Withdrawn by name, so nobody re-derives them:** mandatory breath bars; the
"unharmonized first statement"; withheld tonics as tension; legato lines held
across bar lines; contrary-motion independent voices; "the absence of low end is
the mood"; and any tempo below the arcade band.

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

**Degrees 1̂ – 3̂ – 5̂ – 6̂ – 5̂ — the contour is unchanged and is not up for
debate. Rhythm (v2): 1-1-1-2-1 steps, at steps 0, 1, 2, 3, 5 of a bar. Steps 6
and 7 carry the phrase's pickup into the next bar — never a rest.**
"Bounce — bounce — bounce — flash — land — run on."

The v1 rhythm (`1-1-1-3-1` at 0,1,2,3,6, step 7 resting) was the chamber
gesture: a three-step held flash and a trailing breath. v2 shortens the flash to
two steps so **no note in the figure is longer than an eighth**, moves the
settle a step earlier so the tail of the bar is free for a pickup, and forbids a
silent step inside the phrase. The figure is then restatable every one or two
bars without the loop ever sagging — which is what makes it hummable.

In the engine's phrase encoding (`[s, f, d]` triples, `d` in steps, exactly what
`mkPat` already takes), on **D4 in D Dorian**:

```js
// MOTIF, PLAIN v2 — menu bar 1, D Dorian on D4, then the pickup
[[0, 293.66, 1], [1, 349.23, 1], [2, 440.00, 1], [3, 493.88, 2], [5, 440.00, 1],
 [6, 392.00, 1], [7, 349.23, 1]]
//   D4 1̂        F4 ♭3̂        A4 5̂          B4 6̂ (2 steps)  A4 5̂   G4 4̂  F4 ♭3̂
```

Why this figure survives eight modes: 1̂/5̂ are fixed in every mode but Locrian,
3̂ swings minor↔major, and **6̂ — the "flash" — is the note that names the mode.**
Dorian's ♮6 (B over D), Phrygian's ♭6, Lydian's ♮6 over a ♯4 world, Locrian's ♭6
over a ♭5. The same five-note gesture reads as eight different colours because
its longest note is always the modal fingerprint. That is the whole spine.

**Transformations** (locked vocabulary — every one lands on whole steps):

| Name | Definition | Steps / durations |
|---|---|---|
| `PLAIN` | as authored (v2) | 0,1,2,3,5 / 1,1,1,2,1 |
| `FRAG-MID` | notes 2–4 only (3̂ 5̂ 6̂) — a colour, never a whole track's diet | 1,2,3 / 1,1,2 |
| `ANTIC` | whole figure one step early | b·8−1 … / same |
| `CANON` | `PLAIN` restated in a second channel exactly 8 steps later | +8 |
| `RESOLVED` | `PLAIN` + a 6th note, 1̂ one octave above the head | +0,1,2,3,5,7 / …,2 |

**Withdrawn in v2:** `AUG` (the motif in slow motion — a tempo-collapse device
under another name) and `INV` (contrary-motion counterpoint against the lead).
Neither has a caller after wave B.

Per-track transformation and mode:

| Track | Mode / tonic | Motif treatment | Wave |
|---|---|---|---|
| `intro` | D Dorian | `PLAIN` at bar 1 over the full band, restated an octave up at bar 3 | A |
| `menu` | D Dorian | `PLAIN` at bars 1 and 5, developed between; B answers it in G major | A |
| `jungle` | D Dorian | `PLAIN` at bars 1 and 5; the call-and-response answer loops between | A |
| `ice` | F Lydian | `PLAIN` at normal speed, bars 1 and 5 — no augmentation | A |
| `factory` | E Phrygian | `CANON` — bass states it, lead answers one bar later, an octave up | A |
| `water` | G Mixolydian | `PLAIN`, even values — no stretched legato, no `INV` pad | B |
| `arena` | A Aeolian | `ANTIC` — the head lands one step before the downbeat | B |
| `sand` | E Phrygian ♮3 | `PLAIN` with a one-step appoggiatura before the ♮3̂ (G♯) | B |
| `void` | B Locrian | `FRAG-MID` as a colour, over a driving bed — the tonic is sounded | B |
| `crown` | C Ionian | `RESOLVED` — the motif plus its own octave, the finale's payoff | B |

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
| `intro` | D | **73.42** (D2) | v2: states the *tonic* from step 0, same D2 as menu/jungle |
| `menu` | D | **73.42** (D2) | the home root, stated on every downbeat |
| `jungle` | D | **73.42** (D2) | deliberately identical to `menu` — room 1 is home |
| `ice` | F | **87.31** (F2) | |
| `factory` | E | **82.41** (E2) | |
| `water` | G | **49.00** (G1) | |
| `arena` | A | **55.00** (A1) | |
| `sand` | E | **123.47** (B2) | opens on its drone *fifth*, not its tonic |
| `void` | B | **61.74** (B1) | |
| `crown` | C | **65.41** (C2) | |

The eight biome values are distinct (73.42 / 87.31 / 82.41 / 49.00 / 55.00 /
123.47 / 61.74 / 65.41) so `music.test.mjs`'s biome-root pin holds by
construction. `menu` and `intro` are not in that set, which is what lets both
share room 1's root on purpose — in v2 all three sound D2 as their first bass
note, and the pin is unaffected because it quantifies over the eight biomes
only. **No mode and no root moves in v2**; the corrected direction is carried
entirely by tempo, rhythm, density and register.

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
(register lanes never cross); **no track puts a note on all 64 steps**; and, for
every v2 track, **`pulseGap ≤ 1`** — the rhythm section never leaves two
consecutive steps unstruck.

**The breath-bar mandate is withdrawn.** "Every track has at least one breath bar
— 8 consecutive steps with zero `lead` notes" institutionalised the exact device
the user rejected. It is dropped as a shared rule and is not replaced by an
optional one: a v2 track earns its air from articulation and register, not from
eight empty steps. (Wave-B tracks keep whatever breath bars their v1 data
already has until their own rewrite lands; nothing pins them.)

Panning is untouched: `MUS_PAN` stays `{bass:-0.32, lead:0.32, hat:0.1,
pad:-0.06}` and no track authors `n.p` (§4).

**Format below.** Each row gives target BPM (`STEP = 15 / BPM`) · mode/root ·
**bass pattern** (the biggest feel lever, and deliberately different on every
track) · hook placement · hat role · occupancy band · what changed from v1.

---

**`intro` — the cabinet powering up. [WAVE A]** D Dorian · `STEP 0.125`
(120 BPM, was 88) · `LEN 32` · `sections ["A"]`, `B` stays `null`.
Bass `triangle`: **straight eighths, plain root–octave alternation** — D2 73.42
on steps 0 and 4 of each bar, D3 146.83 on 2 and 6 — the simplest pattern in the
set, in from step 0, tonic first. Bar 4 lifts the pair to A1/A2 as a turnaround.
Lead `triangle` states `PLAIN` on D4 in bar 1 **over the full band** and restates
it an octave up at bar 3; bars 2 and 4 are running answers, so all four bars
carry lead. Hat `triangle` 4800 Hz on every odd step — a sixteenth shaker
present from the first bar. Pad `sine`: two 16-step drones, D3 then A2.
Creative move: the game's first four seconds are a **fanfare, not a fade-in** —
four voices from step 0, and the only unstruck step in the whole loop is the
last one, a single-step lift back into the loop.
Occupancy **28–31 of 32**. `pulseGap 1`.
**Changed from v1:** tempo +32 BPM; the A1 dominant pedal becomes a moving tonic
bass; the empty hat channel becomes 15 hits; bar 2's outright rest and bar 4's
lone held 6̂ become written answers; `bass.length` 1 → 16.

**`menu` — confident, swaggering. [WAVE A]** D Dorian · `STEP 0.121`
(124 BPM, was 112) · hand-authored B.
A: bass `square` **five hits a bar on steps 0, 2, 3, 4, 6** — the tresillo
(0/3/6) still carries the accent and the harmony, but it now rides a continuous
eighth pulse, with the octave on 2 and 6 and the fifth on 4. The Dm → G → Am →
Dm walk is unchanged (roots 73.42 / 49.00 / 55.00 / 73.42 at steps 0/8/16/24) —
what changed is that bar 4 lands on the tonic instead of breathing. Lead
`square` in sixteenths against it, `PLAIN` at bars 1 and 5, developed between;
**every bar carries lead**. Hat `triangle` on **every even step** — the offbeat-
only tick is doubled into a straight eighth pulse. No pad.
B: tonicizes **G major** for eight bars and snaps back, importing the one F♯ the
collection does not own; same skeleton, same per-channel note counts, same mix.
Creative move: B is the template the other hand-authored Bs follow — same
skeleton, same mix, a genuinely different harmonic destination.
Occupancy **58–63 of 64**, A and B alike (the one free step is 63). `pulseGap 1`.
Pins: `A.bass.length === 40`, every note `s % 8 ∈ {0,2,3,4,6}`; `A.hat.length
=== 32`, every `s % 8` even; `A.lead.length` 44–56 with **no lead-free bar**;
`PLAIN` at bars 0 and 4; **`B` sounds F♯ and `A` sounds none** — the F♯ marker
set is `{92.50, 185.00, 369.99, 739.99, 1479.98}` and the drive's expected step
list is *derived from `MUSIC_PATTERN_B`*, not hand-copied, so the two halves of
the AABB assertion cannot drift apart.

**`jungle` — overgrown, humid, alive. [WAVE A]** D Dorian · `STEP 0.117`
(128 BPM, was 116) · B = `transp(A, 1.189207)`.
Bass `square`: the **3+3+2 tresillo ostinato on steps 0/3/6, in all eight bars** —
the pattern survives, the silence does not. Hat `triangle` 3600 Hz on **1/4/7 of
all eight bars**, the drip one step behind each tresillo hit; bass and hat
interlock into a six-of-eight pulse with single-step pockets at 2 and 5. Lead
`triangle` answers into those pockets and across them — overlap with the bass is
now allowed and expected. `PLAIN` at bars 1 and 5; the short answer figure loops
in between so the earworm arrives four times a pass, not once. Pad `sine`
canopy: two 32-step drones, A2 110.00 then D3 146.83 (unchanged).
Creative move: call-and-response as **interlock, not alternation** — the answer
lands in the tresillo's own gaps instead of waiting for the bass to stop.
Occupancy **58–63 of 64**. `pulseGap 1`.
**Changed from v1:** tempo +12 BPM; the full-bar bass rests in bars 5 and 8 are
gone (`barsWithBass` 6 → 8); the "answer bars drop the step-3 hit" thinning is
gone; the strict never-share-a-step rule is withdrawn with it; the single bar-5
`PLAIN` becomes two statements plus looping answers.

**`ice` — brittle, glittering. [WAVE A]** F Lydian · `STEP 0.129`
(116 BPM, was 104) · B = `transp(A, 1.122462)`.
Bass `triangle`: **root–fifth alternation on every off-eighth** — steps 1, 3, 5,
7 of every bar, each ringing an eighth long, F2/C3 (G/D and A/E in the turnaround
bars) — 32 notes where v1 had four cracks. This is ice's distinct accent: the
only track whose bass lives entirely off the beat. Hat `triangle` 6200 Hz on
every even step — a bell *on* the beat against the bass's *off* it — skipping
step 62, which is the loop's one deliberate hole. Lead `triangle` above C5,
`PLAIN` at normal speed at bars 1 and 5. Pad `sine` holds Lydian chord tones
including the ♯4 (B3 246.94).
Creative move: **the mode and the register are the cold** — a bright Lydian lead
two octaves above a bouncing bass, not an absent low end.
Occupancy **58–63 of 64**. `pulseGap 1`.
**Changed from v1:** tempo +12 BPM; `AUG` withdrawn, motif at normal speed;
`bass.length` 4 → 32; hat 8 ticks → 31; the "absence of low end IS the ice"
framing is deleted outright.
*Render iteration (recorded, not hidden):* a first cut put the bell on 0 and 4
only and left step 6 of **every** bar unstruck. `pulseGap` read 1 and every pin
was green, but the offline render showed **34** sub-−50 dB holes, one per bar —
a rest heard as a feature. The lesson generalises: `pulseGap ≤ 1` bounds the
*grid*, not the *ear*, because a one-step hole plus the engine's exponential
note decay is ~0.2 s of near-silence. **A v2 track's unstruck step must be one
per loop, never one per bar** — which is why every other wave-A track has
exactly one (`intro` 31, `menu`/`jungle` 63/61, `factory` 15).

**`factory` — mechanical, cold competence. [WAVE A]** E Phrygian · `STEP 0.114`
(132 BPM, was 126) · B = `transp(A, 0.890899)`. No pad.
The smallest diff of the ten: the sawtooth engine bass, the 2-against-3
interlock and the `CANON` were already arcade-correct. Bass **`sawtooth`** — the
only one in the score — states `PLAIN` low in bar 1 and runs the 3+3+2 engine
ostinato (0 d3, 3 d3, 6 d2) through bars 2–8, never silent for a bar. Lead
`square` answers `CANON` exactly 8 steps later an octave up, and restates it at
bar 6 an octave higher again. Hat **`square`** on every even step, **all eight
bars**.
Creative move: **2-against-3 interlock** — the ostinato groups in 3s against a
hat in 2s, coinciding only twice a bar.
Occupancy **56–62 of 64**. `pulseGap 1`.
**Changed from v1:** tempo +6 BPM; bar 5's hat-and-lead cut-out is filled in
(hat 28 → 32 hits); the motif's held flash shortens to the v2 rhythm.
*(The metric modulation at B — hat regrouping to 3+3+2 — remains impossible
under `transp`, which shares the hat array by identity. Still deferred.)*

**`water` — flowing, but moving. [WAVE B]** G Mixolydian · `STEP 0.139`
(108 BPM, was 100) · B = `transp(A, 1.334840)`.
Bass `triangle`: **even quarter-pulse root–fifth–octave on steps 0, 2, 4, 6** —
the smoothest, least-syncopated pattern in the set, which is how "flowing" is
said without going legato. Lead `triangle` states `PLAIN` in even values. Hat
`triangle` may stay lighter than the other tracks' as a texture cue but must not
be the only pulse-carrying voice. Stepped `v` survives as an accent on the bass,
not as the bass's whole identity.
**Changed from v1:** tempo +8 BPM; cross-barline legato withdrawn; the `INV`
contrary-motion pad withdrawn; the swell becomes a bounce.

**`arena` — aggressive, combat-ready. [WAVE B — reference track]** A Aeolian ·
`STEP 0.107` (140 BPM) · **hand-authored B.** **Nothing moves here.** All four
voices dense, syncopated stabs on the "and" of 2 and 4, `ANTIC` head at step 15,
mode and root unchanged (A Aeolian / A1 55.00 — combat themes in this genre stay
minor-but-groovy, and a forced mode change risks a root collision). ARENA is the
**reference for what arcade-correct sounds like** when revising the other nine.

**`sand` — heat-shimmer, mirage. [WAVE B]** E Phrygian ♮3 · `STEP 0.134`
(112 BPM, was 108) · B = `transp(A, 1.059463)`.
Bass `triangle`: **root–fifth alternation weighted to the fifth on the
off-beats** — the drone fifth survives as a *colour* (`A.bass[0].f` stays
123.47, so the biome-root pin holds) but becomes a moving pattern. Lead `square`
keeps the one-step appoggiatura into the G♯ — a fine hook ornament, now
decorating a bouncing bass instead of a drone.
**Changed from v1:** tempo +4 BPM; `bass.length` 3 → a full pattern; the
"mostly tacet" framing withdrawn.

**`void` — dread, something watching. [WAVE B — biggest single rewrite]**
B Locrian · `STEP 0.144` (104 BPM, was **64**) · **hand-authored B.**
Tempo joins the **bottom of the arcade band** instead of sitting outside it: the
genre never slows the transport to signal danger. Mode, tonic (B1 61.74) and the
**`sine` lead** — VOID's identity marker, dread bought with timbre at no tempo or
silence cost — are all unchanged. Bass `triangle`: **root–octave at half the
other tracks' pattern density** (hits on steps 0 and 4 of each bar) — still a
real, driving pattern, and the sparsest-*feeling* of the ten by relative
density, not by absence. Hat comes back: lighter than average, but present, so
`pulseGap ≤ 1` holds here too. `FRAG-MID` stays as a colour; the lead **may
sound the tonic**.
**Withdrawn:** the 64 BPM band exception; `A.hat.length === 0`; `A.pad ===
undefined` as a headline; "the lead never sounds degree 1̂"; and the ≤20/64
"sparsest track in the game" ceiling.

**`crown` — finale gold. [WAVE B]** C Ionian, the only pure major · `STEP 0.110`
(136 BPM, was 133) · **hand-authored B.**
Bass `square`: **dotted-fanfare root–fifth–octave**, matching the dotted lead
rhythm — a pattern distinct from the other nine. Lead `square` states
`RESOLVED`; hat `triangle`; pad `sawtooth` doubling the lead an octave up for
brass weight. **The payoff quotation stays exactly as it is** — `crown.B`'s hat
reproduces `arena.A`'s hat step pattern verbatim, and `B.hat !== A.hat`. Quoting
an earlier stage's theme at the finale is genre-authentic and is one of the
things v1 got right. Mode and root untouched; the Ionian pair (perfect fourth
**and** leading tone) remains CROWN's alone.
**Changed from v1:** tempo +3 BPM only, to re-establish ladder distinctness.

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

**Tempo ladder (v2)** — all ten distinct, evenly spread across the 104–140 BPM
arcade band at 4-BPM steps, so every value is audibly and not merely numerically
distinct. **Nothing sits outside the band any more**; VOID moves from 64 BPM to
the band's floor.

| | arena | crown | factory | jungle | menu | intro | ice | sand | water | void |
|---|---|---|---|---|---|---|---|---|---|---|
| BPM | 140 | 136 | 132 | 128 | 124 | 120 | 116 | 112 | 108 | 104 |
| `STEP` | .107 | .110 | .114 | .117 | .121 | .125 | .129 | .134 | .139 | .144 |
| wave | B (fixed) | B | A | A | A | A | A | B | B | B |

`STEP` is the 2-decimal-plus rounding of `15 / BPM` that the file already uses;
the exact quotients are not needed and the rounded values stay distinct.

**Migration ordering — this is load-bearing.** The ladder pin quantifies over all
ten tracks, so a track may only move into a `STEP` value that is already vacant:

- **wave A order: `intro` → `menu` → `jungle` → `ice` → `factory`.** `ice`'s
  target `.129` is `jungle`'s v1 value, so `jungle` must vacate first. Every
  other wave-A target (`.125`, `.121`, `.117`, `.114`) is free from the start.
- **wave B order: `crown` → `sand` → `water` → `void`** (`arena` never moves).
  `water`'s target `.139` is `sand`'s v1 value, so `sand` must vacate first;
  `crown` frees `.113` for nobody but tidies the top of the ladder, and `void`'s
  `.144` is freed by `ice` in wave A.

**Waveform roster.** `square` for hard roles, `triangle` for colour, plus two
scarce timbres used exactly once each as identity markers: **`sawtooth` bass =
FACTORY**, **`sine` lead = VOID**. Pads are `sine` except ARENA/CROWN, which are
`sawtooth`. Every track uses at least two distinct waveforms. (`note()` sets
`o.type = n.t` with no whitelist, and the SFX layer already ships `sine` and
`sawtooth` — a third and fourth music timbre are free.)

**One data-encoding change: per-note velocity.** Stepped dynamics was the v1
brief's main maturity lever and today's `mkPat` cannot express it — `E(a,t,v)`
stamps one `v` on every note in a channel. Note tuples become **`[s, f, d, v?]`**,
`v` defaulting to the channel's `mix` value; `hats` passes the 4th element
through. `tracks.js` only. No engine change, no new note field — `{s,f,d,t,v}` is
unchanged. **v2 demotes it to a local colour**: it is authored only where a track
block asks for it (today `water.bass` and `sand.lead`, both wave B), and no
wave-A track uses it — a bass accent in v2 is spelt as a *pitch* choice (root vs
octave vs fifth) so that the "authored only where the spec asks" pin and the
B-section `v`-set pin both stay trivially true.

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

**v2 addendum — the eight pins that contradict the corrected direction.** These
are not "content that happens to change"; each one encodes a rejected idea, and
each is renegotiated rather than merely re-valued. Wave column says who lands it.

| # | v1 pin | v2 replacement | Wave |
|---|---|---|---|
| 1 | `void` `STEP 0.234`, "the one deliberate exception to the tempo band" | `STEP 0.144` — the band's floor. There is no exception clause any more | B |
| 2 | `void` `A.hat.length === 0`, `A.pad === undefined`, "lead never sounds 1̂", occ ≤ 20 | hat present, tonic sounded, `pulseGap ≤ 1`; dread from mode + `sine` timbre; VOID stays the *relatively* sparsest by pattern density, with its own band | B |
| 3 | all ten: "every track has a breath bar" | **deleted.** Replaced by `pulseGap ≤ 1` on v2 tracks — a floor on motion, not a floor on silence | A (intro) |
| 4 | `intro` "the bed never states the tonic in the bass" (`bass.length === 1`, A1 55) | 16 straight-eighth notes, D2 73.42 at step 0 | A |
| 5 | `ice` `A.bass.length <= 6`, notes ≥ 4 steps, `AUG` motif | 32 off-eighth notes, `PLAIN` at normal speed | A |
| 6 | `sand` `A.bass.length <= 4`, every note ≥ 8 steps, "mostly tacet" | a moving root–fifth pattern; `A.bass[0].f` stays 123.47 so the root pin holds | B |
| 7 | `water` legato across bar lines + `INV` contrary-motion pad | even quarter-pulse bass, `PLAIN` in even values, no `INV` | B |
| 8 | "no track puts a note on all 64 steps" + data-derived wrap threshold "because we are writing rests" | **kept, and given a floor.** "Driving" is defined as *maximum density short of full occupancy*: occupancy bands now have a lower bound as well as an upper one, so a composer chasing constant pulse cannot break the pin and a composer drifting back toward sparseness cannot pass it | A/B |

Additional v2 pin moves, per track, all wave A:

| Site | v1 | v2 |
|---|---|---|
| menu `STEP` | `0.134` | `0.121` |
| menu `A.bass` | `length === 20`, `s % 8 ∈ {0,3,6}` | `length === 40`, `s % 8 ∈ {0,2,3,4,6}` |
| menu `A.lead` | 24–32, silent in 24–31 and 56–63 | 44–56, **no lead-free bar** |
| menu `A.hat` | `length === 16`, `s % 8 ∈ {2,6}` | `length === 32`, every `s` even |
| menu `B.hat` | `length === 16`, `s % 8 ∈ {2,6}` | `length === 32`, every `s` even |
| menu occupancy | 46 ± 2 | 58–63, A and B alike |
| F♯ marker set / `EXP` | `[92.50, 185.00, 369.99]` / hand-written `[11,29,43,61]` | `[92.50, 185.00, 369.99, 739.99, 1479.98]` / **derived from `MUSIC_PATTERN_B`** |
| intro | `STEP 0.17`, `LEN 32`, `hat.length === 0`, bar 2 rests, bar 4 holds 6̂, occ ≤ 18 | `STEP 0.125`, `LEN 32`, `hat.length === 15`, all four bars carry lead, occ 28–31 |
| jungle | `STEP 0.129`; no shared bass/lead step; bass silent 32–39 and 56–63 | `STEP 0.117`; bass in **all eight bars**; overlap allowed; `PLAIN` at bars 0 and 4 |
| ice | `STEP 0.144`; `bass.length <= 6`; `AUG` at 0,2,4,6,12; hat every 8 steps; occ ≤ 34 | `STEP 0.129`; `bass.length === 32`, every `s` odd, each 2 steps long; `PLAIN` at bars 0 and 4; `hat.length === 31`, every `s` even but 62; occ 58–63 |
| factory | `STEP 0.119`; hat 28 hits (bar 5 cut) | `STEP 0.114`; hat 32 hits, every even step, all eight bars; occ 56–62 |
| `motifAt` helper | offsets `[0,1,2,3,6]` | **`motifV2At`, offsets `[0,1,2,3,5]`**, added alongside; v1 `motifAt` stays until wave B retires its last caller |

### 6. Verification

**Node (`node --test`), added to `music.test.mjs` as one new block per track.**
Shared helpers, all pure over frozen data:

- `semi(f, f0) = 12 * Math.log2(f / f0)`, compared with a 0.05-semitone
  tolerance.
- `motifV2At(chan, s0, f0)` — true when the channel has notes at bar-relative
  steps **0,1,2,3,5** whose semitones above the head are `[0, m3, m5, m6, m5]`
  with `m3 ∈ {3,4}`, `m5 ∈ {6,7}`, `m6 ∈ {8,9}`. One helper covers all eight
  modes, because the motif's degrees are exactly the ones every mode agrees on to
  within those pairs. `motifAt` (offsets `0,1,2,3,6`) survives for the wave-B
  tracks still on the v1 rhythm; `fragMidAt` is the 3-note variant.
- `pulseGap(P)` — the longest run of consecutive steps, **read cyclically and
  keyed off `P.LEN` (not a literal 64 — `intro` is 32)**, carrying no `bass` and
  no `hat` note. This is the machine reading of "constant pulse".
- `barsWithLead(P)` / `barsWithBass(P)` — how many 8-step bars carry at least one
  note in that channel. Both are 8 (or 4 for `intro`) on every v2 track: this is
  what kills "bars 4 and 8 drop the lead" and "the bass rests through bars 5
  and 8" without needing a rule about rests.

**Hook pins are positional, never count-based.** `motifV2At` is easier to satisfy
by accident in a dense sixteenth texture than the sparse v1 figure was — a scale
run can walk through the right pitch classes. So the motif is always pinned at
**named bars** ("`PLAIN` at bars 0 and 4", "the canon's bass head at bar 0, its
lead head 8 steps later"), which asserts the hook is where the spec puts it
rather than merely that something motif-shaped exists somewhere.

**Durations are never pinned by equality.** `d = steps × STEP` is a float
(`3 × 0.107 = 0.32100000000000004`); every duration fact is written as
`Math.round(n.d / P.STEP)` or an inequality.

Per track, the pins listed in §2, plus the cross-track set:

- staging: the two `B.hat === / !== A.hat` lines (§2).
- lanes: `max(bass.f) < min(lead.f)` for all ten.
- timbre scarcity: exactly one sawtooth bass (`factory`), exactly one sine lead
  (`void`), every track ≥ 2 distinct waveforms.
- quotation: `crown.B.hat` steps deep-equal `arena.A.hat` steps.
- density: **no track occupies all of its steps**, `pulseGap ≤ 1` on every v2
  track, and occupancy (distinct steps carrying any note) lands in a band with a
  **floor as well as a ceiling** —

  | | intro | menu | jungle | ice | factory | water | arena | sand | void | crown |
  |---|---|---|---|---|---|---|---|---|---|---|
  | v2 band | 28–31 (of 32) | 58–63 | 58–63 | 58–63 | 56–62 | *B* | *B* | *B* | *B* | *B* |
  | v1 band | ≤ 18 | 46 ± 2 | 40–58 | ≤ 34 | 40–58 | ≤ 44 | ≤ 62 | ≤ 38 | ≤ 20 | 40–58 |

  Wave-B tracks keep their v1 band until their own rewrite. `menu` stays pinned
  on both sides because the wrap test's `expected` derives from it
  (`2·occ(menu.A) + 2·occ(menu.B)`); at 63/63 the drive compares 252 of 256
  buckets.
- `wav.js`: round-trips a synthetic 2-channel buffer to a 44-byte-header
  RIFF/PCM16 blob of the expected length, clamps out-of-range samples.

**The human loop — this is the actual acceptance gate.**
`node tools/bounce/sink.mjs`, open `tools/bounce/index.html`, bounce the wave,
then listen in run order: `intro → menu → jungle → ice → factory → water →
arena → sand → void → crown`, A/B against the reference bounce of what shipped.

**Machine pre-check before any listen** — three numbers per track off the WAV,
because "it feels energetic" is not a finding:

1. `ffmpeg -af silencedetect=n=-50dB:d=0.15`. **Zero is not reachable and is not
   the bar**: every v2 track has one deliberately unstruck step per loop, and the
   engine's exponential note decay turns that into ~0.2 s under −50 dB. The bar
   is **at most one interval per loop pass** — which is what ARENA, the track the
   research names as already arcade-correct, measures at. More than that means a
   hole that recurs *within* the loop, and that is the rejected device.
2. RMS from `-af astats`, compared against the same track's shipped bounce: v2
   must read **measurably hotter**.
3. `showwavespic` (1200×300) and `showspectrumpic` (1200×400, `legend=1`) — the
   envelope should show no bar-scale notches, and the spectrogram should show
   continuous bass and hat bands with a lead that visibly *repeats*.

Accepted, v2, only when a listener can say all four:

1. **The pulse never stops.** There is no point in any track where the beat
   drops out; the rhythm section is continuous from the first bar.
2. **The tune is hummable after one loop**, and its statements are frequent
   enough to learn — not one development visited once a pass.
3. **The bass bounces.** It is the moving voice on every track, and no two tracks
   share a bass pattern.
4. **Mood matches the table** blind — carried by mode, timbre and register,
   with every track inside the same tempo band.

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

---

**Direction v2 (2026-09-06) supersedes R3b/R3c's content, not their machinery.**
The rewrite ships in two waves, one commit per track, each commit carrying its
own pin renegotiation, its data, and a `CACHE_NAME`/`REV` +1 (`tracks.js` is
precached). `npm test` is green at every commit — that is the property that makes
a mid-migration tree reviewable, and it is why the ordering constraints under
"Tempo ladder (v2)" are not optional.

**Wave A — `intro` → `menu` → `jungle` → `ice` → `factory`.** Lands the v2 motif
rhythm, the `motifV2At` / `pulseGap` / `barsWith*` helpers, the withdrawal of the
all-ten breath-bar mandate, and the first five rows of the ladder. The all-ten
pins (tempo ladder, occupancy bands, biome roots, timbre scarcity) are kept
satisfiable with mixed v1/v2 data by carrying the wave-B tracks' shipped values
in the same tables, so nothing is scoped away and nothing is left to a TODO.

**Wave B — `crown` → `sand` → `water` → `void`** (`arena` is already correct and
does not move). Finishes the ladder, retires `AUG` and `INV` and the last callers
of the v1 `motifAt`, and replaces the wave-B halves of the occupancy-band and
ladder tables with their v2 values. After wave B no track sits outside the
104–140 BPM band and no pin encodes silence as a feature.

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

### Self-review — direction v2 (2026-09-06)

- **The v1 self-review was internally consistent and still wrong.** Every entry
  above defends a choice made under "rests are the maturity lever"; none of them
  is a mistake *within* that reading. What failed was the reading itself, on the
  only gate that mattered — a listen. Recorded so the next pass does not mistake
  a clean pin sheet for an accepted direction.
- **"Constant pulse" and "no track fills all 64 steps" collide on a literal
  reading.** Resolved in favour of keeping the pin and defining the target as
  maximum density short of full occupancy (§0a.3): occupancy bands gained floors,
  and each v2 track has exactly one deliberately unstruck step (`intro` 31,
  `menu` 63, `jungle` 61, `factory` 63 …). Without the floor, "≤ 63" would still
  pass on a track authored at 20.
- **The tempo ladder is a free choice, not a finding.** No BPM data survived the
  research; the 4-BPM spacing across 104–140 was picked to keep ten `STEP` values
  audibly distinct while moving VOID inside the band. It was re-checked against
  every value the ladder does *not* move, which is what produced the migration
  ordering — `ice` cannot take `.129` until `jungle` leaves it.
- **Two pins were traps for the new bass patterns, and both were checked before
  composing, not after.** The Ionian-uniqueness pin (perfect fourth **and**
  leading tone, CROWN alone) fails the moment ICE's root–fifth bass reaches for
  B♭, or FACTORY's for D♯; both patterns are authored to stay off those degrees.
  And the `[s,f,d,v?]` "stepped dynamics only where the spec asks" pin means no
  wave-A track may author per-note velocity — so menu's tresillo accent is spelt
  with *pitch* (root vs octave vs fifth), not with `v`.
- **`EXP` is derived, not transcribed.** A dense 40-note bass tonicising G major
  sounds F♯ far more than four times a section, and `secIsB` asserts both "these
  steps" and "no others". Reading the expected step list off `MUSIC_PATTERN_B`
  makes the two halves incapable of disagreeing, the same move the wrap test's
  `expected` already used.
- **`motifV2At` is a weaker assertion than `motifAt` was**, because a sixteenth
  run through the right pitch classes can satisfy it by accident. Compensated by
  pinning the motif at named bars rather than by counting matches anywhere.
- **The one thing v2 does not touch is the thing v1 got right.** Modes, roots,
  the white-key rotation, the scarce timbres, the hand-authored-B staging and the
  CROWN-quotes-ARENA payoff all survive unchanged; the complaint was about
  energy, and energy is tempo, density and bass motion.
