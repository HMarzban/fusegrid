# Soundtrack — design (2026-09-05)

> **Direction v3 — 2026-09-06, on user feedback.** The v2 score was rejected on a
> listen. The user's words: the songs are **too harsh, too fast and scary**, they
> must be **better**, and **"each song for each part also must be different than
> the other one."** That is three separate complaints and v3 answers all three
> separately — a **timbre and dynamics** answer (soft), a **tempo** answer (a
> slower band), and a **variety** answer (the shared leitmotif is retired). The
> identity (§0a), the motif section (§1 — now "no shared motif"), the key/mode
> table (§1b), every per-track row in §2, the tempo ladder and the pin sheet in
> §5/§6 are rewritten. **What survives:** the engine's shape (oscillator-only,
> ≤ 4 channels, integer step grid, zero deps), `MUS_PAN`, `transp`, the
> hand-authored-B staging, `LEN 64` / `["A","A","B","B"]` / `CYC 256`, the
> `[s,f,d,v?]` tuple, the bounce harness (§3) and the refuse list (§4).
> **What is withdrawn:** the one-motif-everywhere spine, the 104–140 BPM band,
> `square` and `sawtooth` as default music timbres, the white-key
> one-collection/eight-rotations scheme, "energy first, mood second", and every
> dark-room device that reads as menace rather than as mystery.
>
> Rewrite lands in three waves. **Preview wave** = `menu`, `jungle`, `void` —
> the friendly baseline, the bright stage and the proof that a dark room can be
> pleasant. **Wave 2** = `water`, `sand`, `ice`, `factory`. **Wave 3** = `crown`,
> `intro`, `arena`. §7 carries the ordering constraints that keep the suite green
> between them.

Ten tracks that were all the same idea: a bass pump, an octave-doubled lead, a
hat on every other step, and a "B section" that is A pitch-shifted. v2 fixed the
energy and kept the sameness — one motif in ten rotations, one waveform roster,
one density target. The user heard exactly that.

Program R3 now writes **ten different pieces of music** that happen to share an
engine: each room gets its own key, its own tempo, its own rhythmic feel, its own
instrumentation recipe and its own hook. The engine keeps its shape. What changes
is what is written on the grid.

## Locked decisions

### 0a. Identity (v3)

**Soft, warm, cheerful chiptune on 3–4 voices at a walking tempo — music you
would leave on. Every room is its own piece: no two tracks share a hook, a
rhythmic feel or an instrumentation recipe. Dark rooms are mysterious and
pleasant, never frightening.**

Four consequences that decide every argument downstream:

1. **Timbre is soft by default.** Leads and basses are `triangle` or `sine`.
   `square` survives only as a *low-velocity colour* — a channel every one of
   whose notes is at `v ≤ 0.035`. **`sawtooth` is not a v3 music timbre at all**
   (it stays in the SFX layer, where transients want it). Hats are sparse and
   quiet, or absent on a calm room.
2. **Tempo lives in 96–120 BPM.** `STEP = 15 / BPM`, so the band is
   `STEP ∈ [0.125, 0.156]`. The v2 band's top (140 BPM) is gone; "energy" is now
   bought with rhythm and register, never with transport speed. Every track sits
   at its **own** value — ten distinct `STEP`s, as before.
3. **Cheerful modes for lit rooms, gentle minor for dark ones.** Lit rooms are
   major, Lydian, Mixolydian, Dorian or major-pentatonic. Dark rooms (`void`,
   `sand`) are minor-pentatonic or Dorian *at gentle dynamics* — mystery, not
   menace. **Banned outright: tritone stings, dissonant clusters (two notes a
   semitone or a tritone apart struck on the same step), and low rumbles
   (nothing below 55 Hz).**
   *(Re-synced 2026-09-06. The 55 Hz floor meets the one root §1b freezes below
   it: water's biome root is G1 **49.00**, so the two sentences cannot both be
   literal. Moving the root would break the ROOT table, the pre-move check and
   the runtime "water downbeat is 49.00, not menu's 98.00" identity pin — which
   would INVERT — so the floor ships as a **global uniqueness claim**: among the
   composed patterns exactly ONE bass note sits under 55 Hz, it is water's
   downbeat at step 0, and it is 49.00. The exception names its own offender by
   track, step and value, so it cannot drift into a second note.)*
4. **Headroom is authored, not mixed in.** Per-channel `v` ceilings are
   `bass ≤ 0.09`, `lead ≤ 0.07`, `hat ≤ 0.02`, `pad ≤ 0.03`, and the **sum of a
   pattern's channel peaks is ≤ 0.20**. (v2's arena sums to 0.268; that is the
   loudness the user called harsh.)

**Withdrawn by name, so nobody re-derives them:** one motif in eight rotations;
`square`/`sawtooth` as default lead and bass timbres; "the rhythm section never
stops" as an occupancy *floor* (motion is still the default, but a spacious room
is now allowed to be spacious); the 104–140 BPM band; "energy first, mood
second"; and the claim that the score's only chromatic guests are menu's F♯ and
sand's G♯ — v3 gives rooms their own keys, so accidentals are local by design.

### 0. The grid, named

One step is a **sixteenth**. Eight steps is one **2/4 bar**. `LEN = 64` is eight
bars (`intro` is 32). Quarter-note **BPM = 15 / STEP** — verified against the
shipped data: `menu`'s v2 `STEP 0.121` is `15/0.121 = 123.97 ≈ 124 BPM`, which is
what the v2 table claimed. The v3 band `96–120 BPM` is therefore
`STEP 0.15625 … 0.125`; every value below is stated in both, with BPM rounded to
one decimal.

Pitch is absolute Hz, 12-TET, **A4 = 440, 2 decimals**. A scale degree becomes Hz
by `f = tonic * 2^(semi/12) * 2^oct`. Collections used in v3:

| Collection | semitones above the tonic |
|---|---|
| major pentatonic | 0, 2, 4, 7, 9 |
| minor pentatonic | 0, 3, 5, 7, 10 |
| major hexatonic (major, no leading tone) | 0, 2, 4, 5, 7, 9 |
| Ionian | 0, 2, 4, 5, 7, 9, 11 |
| Dorian | 0, 2, 3, 5, 7, 9, 10 |
| Lydian | 0, 2, 4, 6, 7, 9, 11 |
| Mixolydian | 0, 2, 4, 5, 7, 9, 10 |

**Neither pentatonic contains a tritone** (no pair of its members is 6 semitones
apart), and neither contains a semitone. That is why the two "no harsh interval"
facts in §0a.3 are *free* on a pentatonic track: they hold by construction, not
by inspection.

### 1. No shared motif

**The five-note `1̂–3̂–5̂–6̂–5̂` figure is retired.** It was the spine of v1 and v2
and it is the single largest reason "each song sounds like the other one". There
is no score-wide leitmotif in v3 and there will not be one.

Each track instead owns **one hook**: a short figure, in that track's own
collection, stated at a **named bar** and returning inside a single pass. Hooks
are pinned positionally (like v2's) but each pin is *local to its track*, and the
retired figure is pinned **out**: on a v3 track, `motifV2Head` returns `-1` in
both the lead and the bass, in both sections.

| Track | Hook | Where |
|---|---|---|
| `menu` | rising head `1̂ 3̂ 5̂ 6̂` on steps 0/2/4/6 | bars 0 and 4 (bar 4 an octave up) |
| `jungle` | offbeat bounce `5̂ 3̂ 5̂` on steps 2/4/5 | bars 0 and 4 |
| `void` | three adjacent collection steps falling, on 0/3/5 | all four odd bars; pinned at 0 and 4 |
| `ice` | bell arpeggio `1̂ 3̂ 5̂ 7̂` rising over two bars | bars 0 and 4 |
| `water` | dotted 3-step cell, `5̂ 6̂ 1̂` across the beat | bars 0 and 4 |
| `factory` | staccato two-note pump `1̂ 5̂` answered a bar later | bars 0 and 2 |
| `arena` | four-note fanfare on the beat, `1̂ 5̂ 1̂ 3̂` | bars 0 and 4 |
| `sand` | lazy dotted fall `6̂ 5̂ 3̂` | bars 0 and 4 |
| `crown` | fanfare `1̂ 3̂ 5̂ 8̂` with the octave held | bars 0 and 4 |
| `intro` | the menu head, one bar, unaccompanied at the top | bar 0 |

`intro` quoting `menu`'s head is the **one** deliberate cross-reference in the
score — the cabinet playing its own theme — and it is stated once, in a 32-step
bed nobody hears for more than four seconds. It is not a leitmotif.

**`reveal` is not a track.** It is an SFX name in `audio.js`'s `play()` switch,
direct-to-destination, and it does not move (§4).

### 1b. Ten rooms, ten keys

v2's "one white-key collection, eight modal rotations" is withdrawn. It is a
*coherence* device, and coherence is what the user rejected. Each room gets a key
and a collection chosen for its own mood.

| Track | Tonic | Collection | `A.bass[0].f` | Note |
|---|---|---|---|---|
| `intro` | C | major hexatonic | 65.41 (C2) | short warm bed, `sections ["A"]` |
| `menu` | G | major hexatonic (G A B C D E) | **98.00** (G2) | the 4̂ (C) is what lets it walk I–vi–IV–V |
| `jungle` | D | major pentatonic (D E F♯ A B) | **73.42** (D2) | root unchanged from v2 |
| `ice` | F | Lydian | 87.31 (F2) | root unchanged |
| `factory` | E | Dorian | 82.41 (E2) | root unchanged; Phrygian's ♭2 was the menace |
| `water` | G | Mixolydian | 49.00 (G1) | root unchanged |
| `arena` | A | Dorian | 55.00 (A1) | root unchanged; Aeolian → Dorian lifts the 6̂ |
| `sand` | E | Mixolydian, opening on its fifth | 123.47 (B2) | root unchanged; keeps sand's G♯ |
| `void` | B | minor pentatonic (B D E F♯ A) | **61.74** (B1) | root unchanged |
| `crown` | C | Ionian | 65.41 (C2) | root unchanged; still the only Ionian |

**Roots do not move in v3.** All eight biome values are the shipped ones, so the
biome-root distinctness pin holds through every wave by construction; only `menu`
moves (73.42 → 98.00, and `menu` is not in that pin's set). This is deliberate:
v3 changes what is *written*, and asking it to also re-plan the root ladder would
put two migrations in one commit.

**Two collection facts that are load-bearing and easy to break:**

- **`sand` keeps G♯** (207.65 / 415.30) and is still the only A section that
  sounds it. E Mixolydian owns G♯, so the pin survives sand's rewrite — but no
  other track may reach for it, and the failure message names *sand*, not the
  offender.
- **`crown` keeps the Ionian pair.** It is the only A section that sounds both a
  perfect fourth **and** a leading tone above its tonic. `menu`'s hexatonic has
  the 4̂ and no leading tone; `ice`'s Lydian has the leading tone and a ♯4 rather
  than a perfect 4th; every other v3 collection has at most one of the two.
  Check any new collection against this before writing a note.

**The F♯ marker is menu-local.** `music.test.mjs` detects the A-A-B-B section
order by pumping the **default track** (`menu`) and looking for pitches only its
`B` sounds. In v3 `menu.A` is G major hexatonic (no F♯) and `menu.B` is D major
pentatonic (F♯ throughout), so the marker set `{92.50, 185.00, 369.99, 739.99,
1479.98}` still works — but `jungle` and `void` now sound F♯ in their **A**
sections, so the old "the score's two chromatic guests are menu's F♯ and sand's
G♯" claim is **false in v3 and is retired by name**. The marker is a property of
`MUSIC_PATTERN` / `MUSIC_PATTERN_B`, not of the score.

### 2. Per-track spec

Shared rules, true of all ten and pinned once (§6): `LEN = 64` (`intro` 32);
`sections = ["A","A","B","B"]` (`intro` `["A"]`); `max(bass.f) < min(lead.f)`;
**no track puts a note on all of its steps**; ten distinct `STEP` values; and,
for every v3 track, the softness and distinctness facts of §0a and §6.

Panning is untouched: `MUS_PAN` stays `{bass:-0.32, lead:0.32, hat:0.1,
pad:-0.06}` and no track authors `n.p` (§4).

**Format below.** BPM (`STEP = 15/BPM`) · tonic/collection · **instrumentation
recipe** (`channel timbre @ peak v`) · **rhythmic feel** (the bass step-set is
the identity; no two tracks share one) · hook · A/B relationship · occupancy.

---

**`menu` — friendly, memorable, medium. [PREVIEW]** G major hexatonic ·
`STEP 0.137` (109.5 BPM) · hand-authored B.
Recipe: bass `triangle` @ 0.085, lead `triangle` @ 0.06, hat **`sine`** @ 0.012
(5000 Hz), no pad — a three-voice track, the lightest scoring in the set. Sum
0.157.
Feel: an **even walking oom-pah** — bass on steps 0/2/4/6 of every bar, each note
ringing a full eighth so the four cells meet end to end and the low end never
lets go, with a one-step pickup on step 7 of bars 4 and 8. The lead is in
**eighths, on even steps**, with three sixteenth turns (steps 15, 31, 47) lifting
into the next phrase. Hat is two soft sine ticks a bar, on 2 and 6.
Harmony: **G – Em – C – D**, twice. The 4̂ is the whole reason the collection is
hexatonic rather than pentatonic: I–vi–IV–V is the friendliest progression there
is and it needs a C.
Hook: the head `G B D E` rising on steps 0/2/4/6, restated an octave up at bar 4,
then developed away through bars 6–8.
B: **D major pentatonic** — a dominant-side lift that imports F♯, the section
marker. Same timbres, same per-channel note counts and the same `v` set, so A and
B interleave as one loop; what differs is the harmony, the melody, and the bass
accent (`0/3/4/6` against A's `0/2/4/6`).
Occupancy **36 of 64** (A) / **44** (B). `pulseGap 1`.

**`jungle` — bouncy, bright. [PREVIEW]** D major pentatonic · `STEP 0.132`
(113.6 BPM) · hand-authored B.
Recipe: bass `triangle` @ 0.08, lead `triangle` @ 0.065, hat `triangle` @ 0.016
(3200 Hz), pad `sine` @ 0.026. Sum 0.187.
Feel: the **3+3+2 tresillo** on steps 0/3/6, with durations 3/3/2 so the three
cells tile the bar exactly — the bass is continuous *and* syncopated, which is
what "bouncy" means here. Hat is a light off-tick on 1 and 4 only (16 hits, down
from v2's 24). The lead sits **in the pockets** at 2, 4 and 5, plus a step-7
pickup in even bars: a skipping, off-the-beat tune over a swung bass.
Hook: `A F♯ A` (5̂ 3̂ 5̂) on steps 2/4/5, stated at bars 0 and 4.
B: **A major pentatonic**, the dominant, with the tresillo *re-cut* to 0/2/5
(durations 2/3/3) and the hat moved to 3/6 — a hand-authored B, not a
transposition, so `jungle` moves from the `transp` list to the hand-authored one.
Occupancy **60 of 64**, A and B alike. `pulseGap 1`.

**`void` — spacious, mysterious, pleasant. [PREVIEW]** B minor pentatonic ·
`STEP 0.152` (98.7 BPM) · hand-authored B.
Recipe: bass `triangle` @ 0.05, lead **`sine`** @ 0.05 (still the only sine lead
in the score, still void's identity marker), hat `triangle` @ 0.010 (2400 Hz),
pad `sine` @ 0.022. Sum 0.132 — the quietest track in the game, by design.
Feel: **half-time and long-breathed.** Bass is root against its own octave on
steps 0 and 4, each ringing four steps, so the low end is unbroken while the
onsets stay half-speed. Hat is a soft off-tick on 2 and 6. The lead alternates
**a falling three-note figure (bars 1, 3, 5, 7) with two held notes (bars 2, 4,
6, 8)** — 20 notes in 64 steps, the sparsest lead in the score.
Hook: three adjacent members of the collection, falling, on steps 0/3/5 —
`F♯ E D` at bar 0, `B A F♯` at bar 4. Because it is defined on **collection
steps**, not semitones, it reads as the same gesture from any degree.
B: **E minor pentatonic** — down a fourth, the same half-time bed re-cut to a
bass on 0/5 (durations 5/3) and a hat on 3/7, with the lead's odd/even bar roles
swapped.
Why this is not scary: minor pentatonic has **no tritone and no semitone**, the
dynamics are the lowest in the score, and nothing sits below 55 Hz. Dread was v2's
brief; v3's is *mystery*, and mystery is space plus a soft sine.
Occupancy **40 of 64** (A) / **36** (B). `pulseGap 1` (A), `2` (B).

---

The remaining seven, specified but not yet composed. Each row is binding on its
own wave; the roots and the two collection facts of §1b are already fixed.

**`water` — flowing, 3-against-4. [WAVE 2]** G Mixolydian · `STEP 0.144`
(104.2 BPM). Bass `triangle`, lead `triangle`, pad `sine`, **no hat** — a calm
room. *(Re-synced 2026-09-06: this row and the waveform roster below both said
lead `sine`, which contradicts §5 row 8 — "exactly one sine lead, and it is
VOID" — in the same document. The suite encodes row 8, so water shipped a
`triangle` lead and VOID keeps the score's only `sine` one. The prose was the
half that was wrong.)*
Feel: **dotted three-step cells against the eight-step bar**, which is how a
3-against-4 lilt is spelt on an integer grid; the cells walk out of phase with
the bar and re-align every three bars. Hook: the dotted `5̂ 6̂ 1̂` cell at bars 0
and 4. B: hand-authored, a lift to the ♭7̂ (F) with the cells re-phased.

**`sand` — dotted, lazy, warm. [WAVE 2]** E Mixolydian, opening on its fifth
(`A.bass[0].f` stays **123.47**) · `STEP 0.148` (101.4 BPM). Bass `triangle`,
lead `triangle`, pad `sine`, **no hat**. Feel: dotted and behind the beat —
3-step cells like water's but *slower and heavier*, and phrased in long
descending arcs. **Keeps G♯** (§1b). Hook: the lazy fall `6̂ 5̂ 3̂` at bars 0 and 4.

**`ice` — bell-like, high. [WAVE 2]** F Lydian · `STEP 0.135` (111.1 BPM). Bass
`triangle` low and slow, lead `triangle` **above C5** in bell arpeggios, hat
`sine` very sparse, pad `sine` holding the ♯4. Feel: **arpeggios, not scales** —
the lead outlines a chord per bar in rising thirds rather than stepping. Hook:
`1̂ 3̂ 5̂ 7̂` rising across two bars, at bars 0 and 4.

**`factory` — playful mechanical staccato. [WAVE 2]** E **Dorian** ·
`STEP 0.130` (115.4 BPM). Bass `triangle`, lead `triangle`, hat **`square`
@ ≤ 0.035** — the score's one square colour, and the only place a chip edge is
wanted. *(Re-synced 2026-09-06: this row put the `square` on the LEAD while the
§5 allow-list the suite encodes admits `square` on a `hat` only. Resolved to the
hat, and factory's identity survives as "one square colour in the composed
score, and it is FACTORY's hat" — a pin, where the lead reading was prose.)*
Feel: **short notes, one step long, on a strict 2-against-3
interlock**; playful, not menacing. Phrygian's ♭2 goes; the Dorian ♮6 is what
turns the machine friendly. No pad. Hook: the `1̂ 5̂` pump at bar 0, answered by
the lead at bar 2.

**`crown` — triumphant major fanfare. [WAVE 3]** C Ionian · `STEP 0.128`
(117.2 BPM). Bass `triangle`, lead `triangle`, hat `triangle` sparse, pad `sine`
doubling the lead an octave up (the v2 `sawtooth` pad is withdrawn — that timbre
is what made the finale blare). **Keeps the Ionian pair** (§1b). Feel: dotted
fanfare, root–fifth–octave. Hook: `1̂ 3̂ 5̂ 8̂` with the octave held, at bars 0 and
4. B keeps the **CROWN-quotes-ARENA payoff**: `crown.B.hat` reproduces
`arena.A.hat`'s step pattern verbatim. That pin outlives arena's own rewrite only
if arena is rewritten **first** — see §7.

**`intro` — a short warm bed. [WAVE 3]** C major hexatonic · `STEP 0.140`
(107.1 BPM) · `LEN 32`, `sections ["A"]`, no B. Bass `triangle`, lead `triangle`,
pad `sine`, **no hat**. Four bars: the menu head once, unaccompanied at the top,
then the band under it. The one cross-reference in the score (§1).

**`arena` — energetic but soft-timbred. [WAVE 3]** A **Dorian** · `STEP 0.125`
(120.0 BPM — the top of the v3 band). Bass `triangle` @ ≤ 0.09, lead `triangle`,
hat `triangle`, pad `sine`. **This is the track v2 got most wrong for v3**: it is
the loudest (channel-peak sum 0.268), the fastest (140 BPM) and the only one with
two `square` channels *and* a `sawtooth` pad. Energy is re-bought with a
four-note on-the-beat fanfare and a driving tresillo, at soft timbres and 120 BPM.
Aeolian → Dorian for the lifted 6̂. Hook: `1̂ 5̂ 1̂ 3̂` at bars 0 and 4.

---

**Hand-authored B after the preview wave: `menu`, `jungle`, `void`, `arena`,
`crown`.** `transp` B (unchanged, still sharing `A`'s hat array by identity):
`ice`, `factory`, `water`, `sand` — each of those becomes hand-authored on its
own wave, because a transposed B on an identical rhythm is exactly the sameness
v3 exists to remove. `intro` keeps `sections ["A"]` and no B.

**Tempo ladder (v3)** — ten distinct values inside 96–120 BPM. The spacing is
tighter than v2's because the band is narrower; distinctness is carried by
rhythm and register as well as by transport speed.

| | arena | crown | factory | jungle | ice | menu | intro | water | sand | void |
|---|---|---|---|---|---|---|---|---|---|---|
| BPM | 120.0 | 117.2 | 115.4 | 113.6 | 111.1 | 109.5 | 107.1 | 104.2 | 101.4 | 98.7 |
| `STEP` | .125 | .128 | .130 | **.132** | .135 | **.137** | .140 | .144 | .148 | **.152** |
| wave | 3 | 3 | 2 | **preview** | 2 | **preview** | 3 | 2 | 2 | **preview** |

**Migration ordering — load-bearing.** The ladder pin quantifies over all ten, so
a track may only move into a `STEP` that is already vacant. After the preview
wave the occupied set is `{.107 arena, .110 crown, .114 factory, .125 intro,
.129 ice, .134 sand, .139 water}` (v2 values) `∪ {.132 jungle, .137 menu,
.152 void}` (v3). A feasible order exists and is the ship order:

- **preview:** `menu` `.137`, `jungle` `.132`, `void` `.152` — all three vacant
  from the start.
- **wave 2:** `water` `.139 → .144` (vacant), then `sand` `.134 → .148`, then
  `ice` `.129 → .135`, then `factory` `.114 → .130`.
- **wave 3:** `crown` `.110 → .128`, then `intro` `.125 → .140`, then `arena`
  `.107 → .125` — which only becomes vacant once `intro` has left it. **`arena`
  must also be rewritten before or with `crown`** if `crown.B`'s hat quotation is
  to keep quoting the *v3* arena; ship `arena` first inside wave 3 and re-derive
  the quote.
- **As shipped:** the two constraints above are in tension — `arena` had to go
  first for the quotation and could not take `.125` until `intro` left it — so
  `arena` shipped at a temporary **`.126`** (119.0 BPM, in band, and vacant) for
  two commits, through `crown`, and moved to `.125` inside the `intro` commit.
  The authored ladder is now exactly the one above.

**Waveform roster (v3).** `triangle` is the default for every role; `sine` for
pads, for the **one** soft lead (`void`) and for `menu`'s hat; `square` only as a
low-velocity colour (`factory`'s **hat**, `v ≤ 0.035`); **`sawtooth` nowhere in
the music layer.** Every track still uses at least two distinct waveforms. The v2
scarcity markers change accordingly: `sine` lead = VOID survives; **`sawtooth`
bass = FACTORY does not** — factory's identity becomes its staccato and its
square colour. *(Re-synced 2026-09-06 on both counts: this sentence used to list
`water` as a second `sine` lead, which §5 row 8 forbids in the same document, and
to place the `square` on factory's lead, which the allow-list above forbids. Both
resolved the way the suite reads them — water's lead is `triangle`, factory's
`square` is the hat.)*

**Per-note velocity** stays legal (`[s, f, d, v?]`) and stays scarce. v3 spells
accent as a *pitch* choice wherever it can, so the "authored only where the spec
asks" pin keeps naming a short list; the preview wave authors none, which is why
`menu`'s "B mix matches A" `v`-set pin stays trivially true.

### 3. Engine seam for listening

Unchanged by v3, and shipped. `createAudio(opts)` takes an optional `opts.ctx`
used instead of `window.AudioContext` inside `ensure()`; `bounceTrack(id,
seconds)` is the bulk scheduler that walks `stepN = 0,1,2,…` accumulating
`t += P.STEP` from a **local `t = 0`** through the same `patOf()` / `emitStep()`
/ `note()` the live path uses, restores `curId`/`stepN`, and returns the step
count. `nextT` is never read or written, so a stray call cannot desync `pump()`,
and nothing under `src/` calls it.

Dev-only, outside `src/` and absent from the precache list: `tools/bounce/`
(`index.html`, `bounce.js`, the hand-rolled RIFF/PCM16 `wav.js`, and
`sink.mjs`), writing to a gitignored `out/`. Bounce length is one full cycle plus
a two-second tail, floored at 20 s:
`Math.max(20, A.LEN * sections.length * A.STEP + 2)`.

**`CYC` literal: does not move.** `LEN` stays 64 and `MUSIC_SECTIONS` stays
`["A","A","B","B"]`, so the wrap test's `CYC = 256` is correct unchanged. Its
`S = MUSIC_PATTERN.STEP` and its `expected = 2·occ(A) + 2·occ(B)` threshold are
already derived from the frozen tables and survive any recomposition.

### 4. What refuses to change

SFX tables and tints (`boom.js`, `item.js`, `foe.js`, and the `reveal` cue) —
untouched, in content and routing. The SFX direct-to-destination architecture and
its pin. `duck()` and its `0.5 → 0.16` / 0.35 s / 0.6 s ramps. `setVols` scaling
semantics and `MUS_FLOOR`. `musicCue`'s screen/level routing and the exact 10-key
`MUSIC_TRACKS` set. `MUS_PAN` — panning stays engine-side, per channel role,
identical across every track; **no track authors `n.p`.** `CYC = 256`, `LEN 64`,
`["A","A","B","B"]`. Zero npm deps. No samples, no `decodeAudioData`. The note
schema `{s,f,d,t,v}`. `pump()`'s lookahead/catch-up model and the per-note voice
graph. `src/core/*` and determinism: nothing here reaches `step()`.

### 5. Pin renegotiation — v2 → v3

These are not "content that happens to change"; each encodes a rejected idea and
is renegotiated rather than re-valued. The **Scope** column says whether the pin
is deleted, or kept and scoped to the tracks still carrying v2 data — the suite
must stay green with a mixed v2/v3 tree, so every all-ten sweep that encodes a v2
idea is quantified over an **explicit list of not-yet-composed ids**, exactly as
wave A did, and shrinks by one id per commit.

| # | v2 pin | v3 disposition | Scope |
|---|---|---|---|
| 1 | `motifV2At` at a named bar on **all ten** (`HOOK` table) | **kept for v2 tracks only**, and inverted for v3 ones: `motifV2Head(lead) === -1` and `motifV2Head(bass) === -1`, both sections | scoped |
| 2 | "the hook returns a second time" on nine of ten (`RETURN`) | same — v2 ids only; v3 tracks pin their **own** hook's return | scoped |
| 3 | all ten `pulseGap ≤ 1` (A and B) | v3 relaxes to **`≤ 3`**, plus a stronger fact in its place: **bass note spans cover every step of the loop** — the low end never lets go, which is what `pulseGap` was really reaching for | scoped + replaced |
| 4 | all ten "every bar carries lead AND bass" | kept for v2 ids; v3 keeps `barsWithBass === 8` but drops the lead clause (a spacious room may rest a lead bar) | scoped |
| 5 | occupancy **bands with floors** (`intro` 28–31, most 58–63) | kept as a per-track band table. Preview rows `menu` 32–44, `jungle` 54–62, `void` 34–46; **as shipped, the other seven re-valued too** — `ice` 28–40, `factory` 54–62, `water` 34–46, `arena` 42–54, `sand` 44–54, `crown` 58–63, `intro` 14–22 (of its own 32 steps, not 64) | re-valued |
| 6 | tempo ladder `.107 … .144` (104–140 BPM) | re-valued to the v3 ladder; the **distinctness** clause is unchanged and is what forces the migration order | re-valued |
| 7 | "exactly one sawtooth bass, and it is FACTORY" | **deleted** at the end of wave 2 — v3 has no sawtooth music timbre. Kept until factory is recomposed, because it is true of the shipped data until then | scoped, then deleted |
| 8 | "exactly one sine lead, and it is VOID" | **kept**, unchanged — void keeps the sine lead. This is the row §2's `water` line and the waveform roster were re-synced against on 2026-09-06: a green pin outranks prose that contradicts it | — |
| 8a | "VOID is the sparsest of the ten by rhythm-section density" (`bass ∪ hat` strikes fewer steps than anyone else's) | **retired.** It does not survive v3: `water` and `sand` get **no hat**, so their rhythm sections are bass onsets only and will read sparser than void's 32 the moment wave 2 lands — and the failure would name *water* while the disagreement is void's. Replaced by the v3-correct identity claim, **void is quieter than every other track** (channel-peak sum, a comparison rather than a ceiling, so it survives a composer making the track denser): 0.132 against 0.157–0.268 | preview |
| 9 | menu `A.bass.length === 40` on `0/2/3/4/6`; `A.hat.length === 32` even; `A.lead` 44–56 | `A.bass.length === 34` on `0/2/4/6` + a step-7 pickup in bars 4 and 8; `A.hat.length === 16` on `2/6`; `A.lead.length === 35` | re-valued |
| 10 | menu roots `73.42 / 49.00 / 55.00 / 73.42` at steps 0/8/16/24 | `98.00 / 82.41 / 65.41 / 73.42` — G–Em–C–D | re-valued |
| 11 | `B.hat.length === 32`, even steps | `=== 16`, on `2/6`, same skeleton as A | re-valued |
| 12 | "B tonicizes G major and imports the one F♯ the collection does not own" | "B tonicizes **D major** and imports the F♯ **`menu.A` does not own**" — the marker set and the derived `EXP` are unchanged in *mechanism*, and the claim is narrowed from the score to `menu` (§1b) | re-worded |
| 13 | "water downbeat is 49.00, not menu's 73.42" / "setTrack menu restores 73.42" | `…not menu's 98.00` / `restores the G2 98.00 identity bass` | re-valued |
| 14 | `TONIC.menu = 293.66` | `392.00` (G4). `jungle` 293.66 and `void` 493.88 are unchanged. **`TONIC.intro` moved too, 293.66 → `261.63`** with intro's rewrite into C major hexatonic: that table feeds every interval pin and the score-wide Ionian-pair sweep, so leaving it on D would have measured the wrong degrees on one track and nowhere else | re-valued |
| 15 | staging: `HAND = menu/arena/void/crown`, `TRANSP = jungle/ice/factory/water/sand` | `jungle` moves to `HAND` in the preview wave; `ice`/`factory`/`water`/`sand` follow on wave 2 | re-valued |
| 16 | "only CROWN's A sounds a perfect fourth **and** a leading tone" | **kept**, unchanged — and it is a trap for every new collection (§1b) | — |
| 17 | "sand raises the third to G♯ and is the only A section that sounds it" | **kept**, unchanged — E Mixolydian keeps G♯ | — |
| 18 | `CACHE_NAME` / `sw.js` `REV` (currently `fusegrid-shell-v87`; read it, never assume) | +1 per commit that changes shipped bytes, both files together | each |

**New in v3** — facts that did not exist before, all quantified over the explicit
v3 id list so they never straitjacket a track that has not been rewritten yet:

| Fact | Statement |
|---|---|
| tempo band | `96 ≤ 15/STEP ≤ 120` for every v3 track |
| waveform allow-list | `bass`,`lead`,`pad` ∈ {`triangle`,`sine`}; `hat` ∈ {`triangle`,`sine`,`square`}; **no `sawtooth` anywhere**; any `square` channel has every `v ≤ 0.035` |
| velocity ceiling | `bass ≤ 0.09`, `lead ≤ 0.07`, `hat ≤ 0.02`, `pad ≤ 0.03` |
| headroom | the sum of a pattern's channel peak `v` is `≤ 0.20` |
| in-collection | every `bass`/`lead`/`pad` pitch class lies in that **pattern's** declared collection (per-section: A and B may differ). Kills tritone stings and semitone clusters by construction on the pentatonic tracks |
| no rumble | **as shipped:** exactly ONE `bass` note in the composed score sits under 55 Hz — water's G1 `49.00` at step 0 — and every other pitch is `≥ 55 Hz`. Stated as uniqueness rather than as a floor because §1b freezes that root (see §0a.3) |
| no shared motif | `motifV2Head` is `-1` in the lead and the bass of every v3 pattern |
| distinct contour | **every pattern's** lead is a different `(Δstep, Δsemitone)` sequence — all nineteen, not the ten A sections — not a Hz list, which differs vacuously between keys |
| distinct feel | **every pattern's** `bass` **groove** is its own: the step-set mod 8 AND the **cut** (the note lengths in steps at each struck residue), pairwise over all nineteen patterns. The cut is half the fact because a step-set alone reads `0/3/6` as 3+3+2 and as 3+4+2 the same way. Scoped separately: `lead` step-sets mod 8 are pairwise distinct across the **ten A sections only** — a B section may sit its melody on another room's grid, and four of them do |
| distinct triple | no two of the ten share `(root, collection, STEP)`; no two share `STEP` at all |
| A ≠ B | for each v3 track: `B.hat !== A.hat` (identity), `B`'s bass step-set mod 8 differs from `A`'s, and `B`'s root progression differs from `A`'s |
| low end holds | the union of a pattern's `bass` note **spans** (`[s, s + d/STEP)`) covers every step of the loop |
| one square colour | **replaces the retired "one sawtooth bass, and it is FACTORY"** (v3 has no sawtooth in the music layer, so that pin read green over an empty set): the composed score carries exactly one `square` channel and it is **`factory`'s hat**, both sections |
| ice leaps | `ice`'s lead never steps — no interval between consecutive notes is under a **minor third** — which is what makes "arpeggios, not scales" checkable rather than described |
| factory interlock | the bass grid and the lead grid coincide **exactly once a bar**, on step 4 — the count, not just the shape, is pinned |
| crown fanfare | the hook is `1̂ 3̂ 5̂ 8̂` with the **octave HELD** (`d ≥ 4` steps) at bars 0 and 4, and the pad doubles the lead an octave up on `≥ 8` shared steps |
| intro quotation | `intro`'s lead opens on menu's head `1̂ 3̂ 5̂ 6̂` on 0/2/4/6 from `C4 261.63` — the score's one deliberate cross-track quotation besides `crown.B`'s hat |

### 6. Verification

**Node (`node --test`), `music.test.mjs`, one block per track plus two sweeps** —
one over the ids still carrying v2 data, one over the v3 ids. Helpers, all pure
over frozen data:

- `semi(f, f0) = 12 * Math.log2(f / f0)`, 0.05-semitone tolerance; `pcOf` for
  pitch class; `isDeg` for degree membership.
- `motifV2At` / `motifV2Head` **survive as the retired figure's detector** — v3
  uses them to prove the shared motif is *absent*.
- `degIdx(f, f0, set)` — the note's index in the declared collection, extended
  across octaves (`5·octave + position`), so "three adjacent collection steps
  falling" is `idx, idx−1, idx−2` and reads the same from any degree. This is
  what makes void's hook pinnable without pinning semitones.
- `bassSpan(P)` — the set of steps covered by a bass note's `[s, s + d/STEP)`
  interval, cyclically. `covers every step` is the v3 replacement for
  `pulseGap ≤ 1`.
- `contour(chan)` — the `(Δstep, Δsemitone)` sequence, for the pairwise
  distinctness pin.
- `pulseGap`, `barsWithLead`, `barsWithBass`, `occ`, `lanes`, `waves` — unchanged
  from v2.

**Hook pins stay positional.** A hook is pinned at a **named bar** and, where the
track restates it, at the named bar of its return. Counting matches anywhere is
satisfiable by a scale run.

**Durations are never pinned by equality.** `d = steps × STEP` is a float; every
duration fact is `Math.round(n.d / P.STEP)` or an inequality.

**Two facts must be verified by running, never by reasoning**, before each data
commit — both have bitten this program already:

1. `motifV2Head(lead, tonic, 64) === -1` on each composed lead. It is *trivially*
   true on `void` (minor pentatonic has no 6̂, so the detector can never fire),
   so it tests nothing there — void's melodic content is pinned by its own hook
   instead. On `menu` and `jungle` it rests on a structural argument (no four
   consecutive occupied lead steps) that must be confirmed against the frozen
   table, not against the intent.
2. `menu`'s derived F♯ step list and `soundsFs(MUSIC_PATTERN) === false`.
   `secIsB` asserts both "these steps" and "no others", so an F♯ that leaks into
   `A` breaks section detection with a message that names the *section*, not the
   note.

**The human loop is still the acceptance gate.** `node tools/bounce/sink.mjs`,
open `tools/bounce/index.html`, bounce the wave, listen in run order against the
previous bounce. Machine pre-check per track, off the WAV:

1. `ffmpeg -af silencedetect=n=-50dB:d=0.15` — **v3 changes what this number
   means.** v2 chased zero holes; v3 has spacious tracks by design, so the bar is
   "no hole the *bass spans* do not cover", and the `bassSpan` pin is the
   structural version of it. A `void` bounce with a handful of intervals is
   correct; a `menu` bounce with them is not.
2. RMS via `-af astats`, against the same track's v2 bounce: v3 must read
   **measurably quieter** — that is the point.
3. `showspectrumpic` — the top octave should thin out relative to v2 (that is
   `square` and `sawtooth` leaving), and the lead band should visibly repeat.

Accepted, v3, only when a listener can say all four:

1. **Nothing is harsh.** No edge on any lead, no blaring pad, no hat that
   pierces. Turn it up and it stays pleasant.
2. **Nothing is rushed.** Every track sits in a walking tempo; a room reads as
   urgent through its rhythm, never through its BPM.
3. **The dark rooms are inviting.** `void` and `sand` are mysterious and warm;
   neither would startle someone who walked past the cabinet.
4. **Each room is its own piece.** Played back to back, no two tracks share a
   tune, a groove or an instrument palette — this is the criterion the whole
   direction exists to satisfy, and it is the one a green pin sheet is least able
   to certify.

Controller listens first, then the user, and both sign off **before** the wave
ships. A track that passes every Node pin and fails a listen gets rewritten; the
pins exist to stop regressions, not to grant approval.

### 7. Ship order

One commit per track. Each commit carries its own pin renegotiation, its data and
a `CACHE_NAME`/`REV` +1 (`tracks.js` is precached). `npm test` is green at every
commit — that is what makes a mid-migration tree reviewable, and it is why the
ordering constraints under "Tempo ladder (v3)" are not optional.

- **Docs commit** — this rewrite, alone.
- **Preview wave — `menu` → `jungle` → `void`.** `menu` goes first because it
  carries almost all the coupled machinery: the `MUSIC_PATTERN`/`_B` identity
  triple, the F♯ markers and the derived `EXP`, `secIsB`'s "and no others"
  clause, `CYC = 256`, the `bass[0]` envelope probe and the two `setTrack`
  identity pins. With `menu` green the other two are nearly free-standing.
  **Listening checkpoint before wave 2** — these three are the direction's
  proof: the friendly baseline, the bright stage, and a dark room that is
  pleasant.
- **Wave 2 — `water` → `sand` → `ice` → `factory`**, in that order for the
  tempo ladder. Retires the sawtooth-bass pin with `factory`.
- **Wave 3 — `arena` → `crown` → `intro`.** `arena` first so `crown.B`'s hat
  quotation lands on the v3 arena; `intro` last so `arena` can take `.125`.

## Refuse

Samples of any kind, `decodeAudioData`, any npm dependency. Sub-step timing — no
fractional `s`, no smaller `STEP` bought to fake triplets, no non-integer lookup
in `pump()`; every rhythmic device here is whole-step by construction (the
3-against-4 lilt is dotted **3-step cells**, not triplets). Touching SFX tables,
tints, `reveal`, or the direct-to-destination path. Changing `duck`, `setVols`,
`MUS_BASE`/`MUS_DUCK`, or `MUS_FLOOR`. Adding, removing or renaming a
`MUSIC_TRACKS` key, or changing `musicCue`. Changing `LEN`, `MUSIC_SECTIONS` or
`CYC`. Per-track or per-heat panning tables, per-heat texture swaps, and any
runtime music generation. New note fields (`n.p` stays engine-supplied). Reverb,
delay, sends, sidechain — space is written in, not processed in. A pattern-player
abstraction or a `sched.js` extraction (§3). Anything reaching `src/core` or
`step()`.

## Self-review — direction v3 (2026-09-06)

- **v2's self-review was internally consistent and still wrong, for the second
  time.** Every v2 entry defends a choice made under "energy first, mood second";
  none is a mistake *within* that reading. The reading itself failed the only
  gate that matters. Recorded again, because the pattern is now twice-observed: a
  clean pin sheet is not an accepted direction, and the pins that most needed
  renegotiating were the ones that had been green longest.
- **The shared motif was the answer to the wrong question.** It was chosen for
  coherence and it delivered coherence; the user asked for *variety* and heard
  the coherence as repetition. Retiring it is the single largest v3 change and it
  is why §1 is now a table of ten different hooks rather than one figure in ten
  rotations.
- **"Different from each other" is the hardest thing here to pin.** Comparing
  lead Hz lists between tracks in different keys is *vacuously* unequal and pins
  nothing. The two pins that actually bite are the `(Δstep, Δsemitone)` contour
  comparison and the `bass`/`lead` step-set-mod-8 comparison — shape and groove,
  independent of key. Both are quantified pairwise over the composed ids.
- **`menu` and `jungle` nearly shipped on the same collection.** The first v3
  draft had both on major pentatonic, justified by a distinctness pin that reads
  the `(root, collection, STEP)` *triple*. That is a pin passing while the
  direction fails — the v2 failure exactly. `menu` moved to major **hexatonic**,
  which also buys it the 4̂ that I–vi–IV–V needs; `jungle` keeps the pentatonic
  the brief names for it.
- **Two rejected candidates for jungle, recorded so they are not re-derived.**
  Mixolydian pentatonic (`0,2,4,7,10`) contains a tritone between its 3̂ and its
  ♭7̂; Lydian pentatonic (`0,2,4,6,9`) puts a G♯ in a D-rooted track and would
  break sand's uniqueness pin with a message naming sand. Any new collection gets
  checked against three filters before a note is written: **no 6-semitone pair,
  no G♯, and not both the perfect fourth and the leading tone.**
- **`square` was moved off `menu`'s hat.** The hat is the highest-frequency,
  highest-onset channel in any pattern — the worst possible home for the one
  waveform the user called harsh. A `sine` hat buys the `waves >= 2` pin at zero
  harshness cost, and nothing in the suite reads hat timbre.
- **Per-channel `v` ceilings do not bound simultaneity.** Four channels each
  under their own ceiling still sum. The channel-peak-sum ≤ 0.20 fact is the
  checkable form of "leave headroom", and it is the one that separates v3 from
  v2's arena at 0.268.
- **`pulseGap ≤ 1` had to go, but not to nothing.** It was v2's device for
  "never sags", and a spacious room cannot satisfy it honestly. Replacing it with
  **bass spans cover every step** keeps the property that mattered — the low end
  never lets go — while allowing onsets to be half-time. It is also a better
  fact: `pulseGap` bounds the grid, and this one bounds the *sound*.
- **The F♯ marker claim was scoped, not deleted.** `jungle` and `void` both sound
  F♯ in `A` now, so the score-wide "two chromatic guests" line is false. The
  marker still works because the AABB drive only ever pumps `menu`; saying so
  explicitly is what stops a later wave from breaking section detection while
  every menu pin stays green.
- **`void`'s no-shared-motif pin is trivially true and is labelled as such.**
  Minor pentatonic has no 6̂, so the detector cannot fire whatever void plays.
  The real melodic content is pinned by void's own falling-collection-steps hook,
  which is why `degIdx` exists.
- **One v2 pin was a wave-2 landmine and was defused in the preview wave, not
  left for the commit that would trip it.** VOID's "sparsest by rhythm-section
  density" pin compares `bass ∪ hat` onset counts across every 64-step track,
  and §2 gives `water` and `sand` no hat — so the first wave-2 commit would
  have gone red with a message naming *water* while the actual disagreement was
  void's identity claim. Retired and replaced by the quietest-track comparison
  (§5 row 8a). The general lesson: a cross-track pin written for one track's
  identity fails on the *other* track, and the failure message points the
  wrong way.
- **A second latent trap, same shape, same fix.** The v2 hook-return sweep
  asserted `RET.length === V2ONLY.length - 1`, encoding "arena is the one
  not-yet-composed id absent from the RETURN table". Wave 3 composes `arena`
  first, at which point arena leaves `V2ONLY` and the subtraction no longer
  applies — red, with an empty detail string. Rewritten against the filtered
  list, so it stays true through every wave.
- **Roots deliberately did not move.** v3 already changes tempo, mode, timbre,
  rhythm and melody on every track; moving the root ladder as well would make the
  biome-root pin a second migration with its own ordering constraints, for no
  audible gain. `menu` is the one exception, and `menu` is not in that pin's set.
