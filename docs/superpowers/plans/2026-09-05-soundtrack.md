# Soundtrack (program R3) — Implementation Plan INDEX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ten tracks that are all the same patch — bass pump, octave-doubled
lead, hat every other step, B = A pitch-shifted — become one score: **one
motif, one parent pitch collection, eight modal rotations of it, and rests
written in on purpose.** Plus the thing this repo has never had: an offline
bounce to WAV, so a human can *hear* a track before it ships.

**Architecture:** Three waves behind one engine seam.

- **R3a (seam)** — `src/audio.js` gains exactly two things: `createAudio(opts)`
  honouring `opts.ctx`, and `bounceTrack(id, seconds)`, a bulk scheduler that
  reuses the live `patOf()` / `emitStep()` / `note()` and never reads or writes
  `nextT`. `src/audio/tracks.js` gains the `[s, f, d, v?]` note tuple in all
  **three** tuple readers. Zero track-content change. Everything else is
  dev-only under `tools/bounce/` — outside `src/`, absent from the PWA
  precache, never fetched by a player.
- **R3b (wave 1)** — `intro`, `menu`, `arena`, `void`, `crown`: the motif's whole
  arc (bare statement → home theme → anticipation → subtraction → resolution).
  Carries most of the ABI ledger.
- **R3c (wave 2)** — `ice`, `jungle`, `factory`, `water`, `sand`: the five that
  keep a `transp` B at its stated ratio. Finishes the ledger.

The voice architecture does not move. `pump()`'s lookahead/catch-up model, the
per-note voice graph, `duck()`, `setVols`, `MUS_PAN`, the SFX
direct-to-destination path and `musicCue`'s routing are all untouched. Nothing
here reaches `src/core/` or `step()`.

**Tech Stack:** Pure ES modules, WebAudio oscillators only, `node --test` /
`tests/*.test.mjs`. Zero npm runtime deps. No samples, no `decodeAudioData`.
The bounce harness is hand-rolled: `OfflineAudioContext` + a ~50-line RIFF/PCM16
encoder + a `node:http` sink.

**Spec:** `docs/superpowers/specs/2026-09-05-soundtrack-design.md`

**Depends on:** nothing new. Engine map:
`.superpowers/sdd/2026-09-05-soundtrack/research-audio-code.md`. Direction
brief: `.superpowers/sdd/2026-09-05-soundtrack/research-music-direction.md`.

---

## Global Constraints

- **The SFX direct-to-destination pin is untouchable.**
  `tests/music.test.mjs:503-536` ("sfx routes direct-to-destination, music via
  musicGain") does not move, and no new music-adjacent voice may reach
  `musicGain`. SFX tables and tints (`boom.js`, `item.js`, `foe.js`) and the
  `reveal` cue are untouched in both content and routing. **`reveal` is an SFX
  name in `audio.js`'s `play()` switch, not a track.**
- **The `MUSIC_TRACKS` key set is frozen at exactly ten** — `intro`, `menu`,
  `jungle`, `ice`, `factory`, `water`, `arena`, `sand`, `void`, `crown` — and
  `musicCue`'s screen/level routing is frozen with it. No key added, removed or
  renamed; no routing change.
- **Zero npm deps. No samples.** Every note stays a synthesized
  `OscillatorNode`. The WAV encoder is hand-rolled.
- **`CYC = 256` holds.** `LEN` stays 64 and `MUSIC_SECTIONS` stays
  `["A","A","B","B"]`, so `music.test.mjs:349-390`'s cycle constant is correct
  unchanged. Only the `probe > 250` density threshold moves, and only because
  this program writes rests.
- **`duck`, `setVols`, `MUS_BASE`, `MUS_DUCK`, `MUS_FLOOR` and `MUS_PAN` do not
  change.** Panning stays engine-side per channel role; **no track authors
  `n.p`.** The note schema stays `{s, f, d, t, v}` — the `v?` tuple element is a
  *source-encoding* change in `tracks.js`, not a new note field.
- **Integer steps only.** No fractional `s`, no smaller `STEP` bought to fake
  triplets, no non-integer lookup in `pump()`. Every rhythmic device in this
  program is whole-step by construction.
- **The sim is untouched.** Nothing here imports from or is imported by
  `src/core/`. `audio.js` must stay free of `Math.random` / `Date.` /
  `setInterval` (`music.test.mjs:983-992` is a literal source grep).
- **Durations are never pinned by equality.** `d = steps × STEP` is a float
  (`3 × 0.107 = 0.32100000000000004`). Every duration fact is written as
  `Math.round(n.d / P.STEP)` or as an inequality.
- **All-ten-quantified pins land in R3c, not R3b.** A cross-track assertion that
  loops over every entry of `MUSIC_TRACKS` is evaluated against *pre-rewrite*
  wave-2 data while R3b is in flight, and today's data violates several of them
  (`WATER_A`'s mix is all-`triangle`, so "≥ 2 distinct waveforms" fails;
  `JUNGLE_A`'s `pulse` evens ∪ `hats(64,f,2)` odds cover all 64 steps, so "no
  track occupies all 64" fails). R3b asserts the same properties **restricted to
  its five tracks**; R3c generalizes each to all ten. Two exceptions are safe in
  R3b and stated there: the `B.hat` staging pair, and "exactly one sine lead"
  (today's tables are `square`/`triangle` only).
- **Wave 1 authors one `v` per channel.** The `[s,f,d,v?]` tuple exists after
  R3a but stays unused until R3c's `water` task, which is where the R3a
  uniform-`v` pin retires. If a wave-1 track genuinely needs stepped dynamics,
  narrow that pin **in the same commit** and re-home its ledger row — never
  leave it red.
- **Tasks inside a wave are strictly ordered; do not parallelize them.** Three
  reasons: `crown.B.hat` deep-equals `arena.A.hat` by step pattern (crown must
  follow arena); the tempo/root distinctness pins only survive if the ordering
  and the pre-moves below happen together; and each task's commit must be green
  on its own.
- **PWA bump:** bump `CACHE_NAME` (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`)
  **together**, `current vN → vN+1`, in **every commit that touches
  `src/audio.js` or `src/audio/tracks.js`** — both are in the precache `SRC`
  list. `tools/bounce/**` and every WAV output are **not** precached and never
  referenced from `index.html`, so their commits get **no bump**. Commits that
  touch only `tests/` or `MEMORY.md` get no bump either. **Read the current
  value first** — a concurrent implementer bumps the same two lines.
- **MEMORY.md** gets a dated append in each plan's final commit.
- Never write the banned grid-bomb franchise name into any committed file.
- No comments unless the file already uses explanatory block comments — both
  `audio.js` and `tracks.js` do, so match their compact style.

---

## File map

| File | R3a | R3b | R3c |
|---|---|---|---|
| `src/audio.js` | `createAudio(opts)`, `bounceTrack` | — | — |
| `src/audio/tracks.js` | `v?` in 3 tuple readers + helpers | 5 tracks rewritten + 3 pre-moves | 5 tracks rewritten |
| `tests/music.test.mjs` | seam pins + uniform-`v` pin | pin helpers + 5 track blocks + ABI | 5 track blocks + all-ten pins |
| `tests/wav.test.mjs` | new | — | — |
| `tools/bounce/index.html` | new | — | — |
| `tools/bounce/bounce.js` | new | — | — |
| `tools/bounce/wav.js` | new | — | — |
| `tools/bounce/sink.mjs` | new | — | — |
| `.gitignore` | `tools/bounce/out/` | — | — |
| `src/pwa/shell.js` + `sw.js` | bump ×2 | bump ×5 | bump ×5 |
| `MEMORY.md` | final commit | final commit | final commit |

Not touched by any plan: `src/main.js`, `src/audio/boom.js`, `src/audio/item.js`,
`src/audio/foe.js`, `index.html`, `src/core/**`.

---

## Shared interfaces

Every signature below is fixed by R3a and consumed unchanged by R3b/R3c.

```js
// src/audio.js — the injection seam. Callers that pass nothing behave
// byte-identically; main.js is untouched.
export function createAudio(opts);   // opts?.ctx seeds the module-closure ctx,
                                     // so ensure() skips the window lookup

// on the returned object, alongside the existing ten keys
bounceTrack(id, seconds) -> stepCount // 0 when !ctx || !musicGain
```

`bounceTrack` sets `curId`, walks `stepN = 0,1,2,…` accumulating a **local `t`
starting at 0**, calls the same `patOf()` / `emitStep()` / `note()` the live
path uses, stops at `t >= seconds`, restores `curId`/`stepN`, and returns the
step count. **`nextT` is never read and never written**, so a stray call cannot
desync a live `pump()`. Nothing under `src/` calls it.

```js
// src/audio/tracks.js — note tuples
[s, f, d]            // still legal; v falls back to the channel's mix value
[s, f, d, v]         // v overrides for this note only
```

The 4th element is read by **three** tuple readers, all of which change in R3a:
`MUSIC_PATTERN`'s IIFE `E` (`tracks.js:59`), `MUSIC_PATTERN_B`'s IIFE `E`
(`tracks.js:125`), and `mkPat`'s inner `E` (`tracks.js:137-140`). The helpers
`pulse` / `oct` / `hats` pass it through.

```js
// tools/bounce/wav.js — pure, DOM-free, zero deps, Node-testable
export function encodeWav(buf) -> Uint8Array
// buf: { numberOfChannels, sampleRate, length, getChannelData(i) -> Float32Array }
// returns a 44-byte RIFF header + interleaved little-endian PCM16, samples
// clamped to [-1, 1] before scaling
```

```js
// tools/bounce/sink.mjs — node:http, zero deps
// node tools/bounce/sink.mjs [--port 8081] [--out <dir>]
// default out dir: tools/bounce/out
// POST /<id>.wav  -> writes <out>/<id>.wav, replies 200 text/plain
// OPTIONS /*      -> 204 preflight
// every response carries Access-Control-Allow-Origin: *
```

**Bounce length**, identical in the harness and in every listening step:

```js
const seconds = Math.max(20, A.LEN * sections.length * A.STEP + 2);
// 20 s for intro, 36 s for menu, 62 s for void
```

---

## Execution order

```
R3a  docs/superpowers/plans/2026-09-05-soundtrack-seam.md    (4 tasks)
        seam + v-tuple + tools/bounce/ + the "before" reference bounce
          |
          v
R3b  docs/superpowers/plans/2026-09-05-soundtrack-wave1.md   (8 tasks)
        intro -> menu -> arena -> void -> crown, strictly in that order
          |
   ###  LISTENING CHECKPOINT  ###
   Bounce all five to .superpowers/sdd/2026-09-05-soundtrack/wav/, A/B each
   against wav/before/<id>.wav, controller listens first, then the user. Both
   sign off BEFORE wave 1's final commit is final. A track that passes every
   Node pin and fails a listen gets rewritten — the pins stop regressions, they
   do not grant approval. R3c does not start until this gate is signed.
          |
          v
R3c  docs/superpowers/plans/2026-09-05-soundtrack-wave2.md   (7 tasks)
        ice -> jungle -> factory -> water -> sand, strictly in that order,
        then the whole score listened in run order:
        intro -> menu -> jungle -> ice -> factory -> water -> arena -> sand
        -> void -> crown
```

**Why ice before jungle** (the spec lists them the other way): jungle's new root
is 73.42, which is ice's *current* root. Ice must vacate 73.42 for 87.31 first,
and it can only take 87.31 once arena has vacated it in wave 1.

**Acceptance for a listen** — a listener must be able to say all four:
rests are audible; the motif is traceable by ear across all ten without being
told where it is (including that CROWN finishes the phrase VOID leaves
hanging); no constant-beep density; mood matches the table blind.

---

## ABI ledger — every content pin that moves, and its single owner

The unit of ownership is **an assertion**, not a line range: where a spec row
covers several independent assertions, it is split below and each half has
exactly one owner. Nothing is listed twice.

Line numbers are as of the **pre-R3** `tests/music.test.mjs` and drift as blocks
are inserted — R3b's helper block goes in near the top on purpose (see that
plan's Task 1). **Locate an assertion by its `check()` name, not by its line.**

| Assertion (site) | Today | New | Owner |
|---|---|---|---|
| `:187-190` menu `STEP`/`LEN` | `0.15` / `64` | `0.134` / `64` (LEN holds ⇒ `CYC` holds) | R3b menu |
| `:204-208` `A.bass.length` | `=== 32` | `=== 20`, every `s % 8 ∈ {0,3,6}` | R3b menu |
| `:209-213` `A.lead.length` | `=== 30` | 24–32, zero lead in steps 24–31 and 56–63 | R3b menu |
| `:214-218` `A.hat` | `=== 32`, odd steps | `=== 16`, every `s % 8 ∈ {2,6}` | R3b menu |
| `:219-227` `bassByS` roots | 0/2/4→55/55/82.4, 16→43.65, 24→49 | 0→73.42, 8→49.00, 16→55.00, 24→73.42 | R3b menu |
| `:231-236` bars 5-8 = bars 1-4 ×2 | `oct()` doubling | **deleted** → "≥ 4 lead steps in bars 5-8 differ from bars 1-4" | R3b menu |
| `:237-242` durations positive, in span | — | **unchanged** (inequality, float-safe) | — |
| `:247-252` `MUSIC_SECTIONS` | `["A","A","B","B"]` | **unchanged** | — |
| `:260-264` B `STEP`/`LEN` match A | — | **unchanged** | — |
| `:265-279` B mix matches A | per-note `t` **and** `v` equal A's | same `t` per channel; same **set** of `v` per channel | R3b menu |
| `:280-284` B hat | 32, odd steps | `=== 16`, every `s % 8 ∈ {2,6}` | R3b menu |
| `:285-292` B roots ≠ A roots | — | keep, **plus** B sounds F♯ (92.50/185.00/369.99), A sounds none | R3b menu |
| `:293-299` B lead contour ≠ A | — | **unchanged** | — |
| `:349-390` wrap `CYC` | `CYC=256`, `probe > 250` | `CYC = 256` **unchanged**; `expected = 2·occ(menu.A) + 2·occ(menu.B)`, assert `probe >= expected - 2` | R3b menu |
| `:391-406` envelope probe | via `MUSIC_PATTERN.bass[0]` | derived — no code edit, new value (73.42); verify green | R3b menu |
| `:623-674` B-marker drive | `isBmark [110, 58.27, 87.31]`, `EXP [4,16,18,20,22,36,48,50,52,54]` | `isBmark [92.50, 185.00, 369.99]`, `EXP [11, 29, 43, 61]`; **re-derive the 520-iteration drive, do not assume** | R3b menu |
| `:695-700` menu identity triple | — | **unchanged** (`MUSIC_PATTERN` stays the exported binding) | — |
| `:701-718` 10 distinct tempos | — | **unchanged code**; kept green by the sand-`STEP` pre-move (R3b intro) | — |
| `:719-732` 8 distinct biome roots | — | **unchanged code**; kept green by the water-root pre-move (R3b void) and the factory-root pre-move (R3b crown) | — |
| `:733-741a` sand `STEP` | `0.17` | `0.139` | R3b intro |
| `:733-741b` void `STEP` + root | `0.19` / `49` | `0.234` / `61.74` | R3b void |
| `:733-741c` crown `STEP` + root | `0.13` / `98` | `0.113` / `65.41` | R3b crown |
| `:733-741d` sand root | `69.3` | `123.47` | R3c sand |
| `:742-754` all voices finite | — | **unchanged** — `fin` runs on `bass`/`lead`/`hat` only, never `pad`, and `fin([])` is `true`, so VOID's empty hat and absent pad pass as written | — |
| `:756-781` `musicCue` routing | — | **unchanged** | — |
| `:788-793` water downbeat | `61.74`, not menu `55` | `49.00`, and no 73.42 in water's downbeat | **R3b void** (spec says R3c — **corrected**, see resolved ambiguities) |
| `:805-811` `setTrack menu` restores root | `55` | `73.42` | R3b menu |
| `:983-992` `audio.js` grep gate | — | **unchanged** — the ctx seam and `bounceTrack` use no `Math.random`/`Date.`/`setInterval` | — |
| `audio.js:43` `createAudio()` | no args | `createAudio(opts)`, `opts.ctx` optional | R3a |
| `audio.js` returned object | 10 keys | `+ bounceTrack` (11) | R3a |
| `tracks.js` tuples | `[s, f, d]` | `[s, f, d, v?]`, three readers | R3a |
| uniform-`v` pin (new in R3a) | — | every channel of every A and B has `new Set(map(n=>n.v)).size === 1` | **created** R3a |
| …same pin, narrowed | every channel | an explicit `STEPPED` allow-list: `water.A.bass`, `water.B.bass` | R3c water |
| …same pin, extended | that allow-list | `+ sand.A.lead`, `sand.B.lead` | R3c sand |
| `CACHE_NAME` / `sw.js` `REV` | `fusegrid-shell-vN` (moves under us; read it, never assume) | +1 per precache-touching commit, both files together | each |

**Single-owner self-check:** every row above names exactly one owning task, and
no assertion appears under two owners. The four rows split from spec §5's
`:733-741` and the corrected `:788-793` row are the only places where the
spec's coarser table needed subdividing.

---

## Resolved ambiguities

1. **Three tuple readers, not one.** Spec §"One data-encoding change" says
   "`tracks.js` only" and names `mkPat`. But `MUSIC_PATTERN` and
   `MUSIC_PATTERN_B` are IIFEs at `tracks.js:7-67` and `:73-133`, each with its
   own local `E` that destructures `[s, f, d]`. All three change in R3a, or
   `menu` cannot author per-note `v` later without a second encoding pass.
2. **Two tempo/root collisions the spec's ship order does not survive, and one
   that is a 2-cycle.** With wave-1 values landing while wave-2 data is still
   old: `intro .170` collides with `sand .17`; `crown 65.41` collides with
   `factory 65.41`; `void 61.74` collides with `water 61.74` — and water's
   *target* root is 49.00, which is void's *current* root, so those two are a
   swap that cannot be staged apart. Resolution: **fold each pre-move into the
   commit of the wave-1 track that forces it** — sand `STEP → 0.139` with the
   intro task, factory root `65.41 → 82.41` with the crown task, and water root
   `61.74 → 49.00` **in the same commit as** void's `49 → 61.74`. Walked
   commit-by-commit, `:701-718` and `:719-732` are then green at every boundary.
   Both pre-moved roots are in key or better (82.41 is factory's own new E2
   tonic); sand's `d` values stay baked at `steps × 0.17` for one wave, so sand
   plays ~22 % legato until R3c rewrites it. Intentional, not a bug.
3. **`:788-793` belongs to R3b, not R3c.** Water's root moves in R3b's void
   commit (ambiguity 2), so the assertion that reads it must move there too. The
   spec's table row is corrected in the ledger above.
4. **Interval pins read a frozen `TONIC` table, never `A.bass[0].f`.** Spec §1b
   deliberately puts `intro`'s bass on the *dominant* (A1 under a D tonic) and
   `sand`'s on the *drone fifth* (B2 under an E tonic). A helper that inferred
   the tonic from `bass[0]` would silently measure the wrong intervals on two
   tracks — including CROWN's "no other A section sounds both" uniqueness pin.
   `TONIC` is a frozen ten-entry Hz table in `music.test.mjs`, and `motifAt` /
   `fragMidAt` / the CROWN pin all measure pitch classes above it.
5. **`fragMidAt` is tonic-relative, not head-relative.** Head-relative intervals
   for a 3-note fragment (3̂ 5̂ 6̂) are too loose to mean anything — nearly any
   rising figure matches. It matches degrees against `TONIC` like `motifAt`.
6. **`menu` occupancy is 46 ± 2, binding.** The spec's parenthetical
   decomposition ("6 bars at ~6 occupied steps plus two 3-step breath bars")
   sums to 42, not 46. The parenthetical is illustrative; **the pin is
   `occ(menu.A)` and `occ(menu.B)` each in [44, 48]**, and the wrap test's
   `expected` derives from the same numbers so the two pins cannot disagree.
7. **`bounce.js` wraps the `OfflineAudioContext` in a thin shim.** `unlock()`
   calls `ctx.resume()` when `ctx.state === "suspended"`, which is exactly an
   offline context's state before `startRendering()`, and where that call throws
   synchronously `unlock()`'s `catch` would swallow it and **skip building
   `musicGain`**, leaving `bounceTrack` returning 0. The shim reports
   `state: "running"` and forwards every factory (including
   `createStereoPanner` — `emitStep` sets `p` from `MUS_PAN` on *every* music
   note) plus `destination`/`currentTime`/`sampleRate` to the real context. This
   keeps shipped code at exactly the two additions §3 allows.
8. **WAV output lives outside the repo tree.** The sink defaults to
   `tools/bounce/out/` (gitignored by R3a) and takes `--out <dir>`; both
   listening checkpoints point it at
   `.superpowers/sdd/2026-09-05-soundtrack/wav/`, which is already ignored via
   `.superpowers/sdd/.gitignore`. **No WAV is ever committed.**
9. **Two PWA-bump rules reconciled.** Spec §7 says "+1 per plan"; the house rule
   (`AGENTS.md`) says bump whenever shipped bytes change. The house rule wins and
   is stricter: **one bump per precache-touching commit**, always read-then-`+1`.
10. **`crown`'s `RESOLVED` statement is pinned on `crown.B.lead`.** The spec's
    creative-move sentence is scoped to `crown.B` (the payoff section that also
    carries the ARENA hat quotation). Authoring `RESOLVED` in `A` as well is
    allowed; the pin only requires it in `B`.
11. **Vacuous pins get minimum-count guards.** Water's contrary-motion rule
    ("opposite sign at every shared pad/lead step") is trivially true at 0–1
    shared steps, so it carries `>= 4` shared steps. Factory's canon pin needs a
    `motifHead(chan)` helper that returns a *step*, not a boolean, or the
    "exactly 8 steps after" fact cannot be written at all.
12. **FACTORY's metric modulation is not attempted.** `transp` returns the same
    `hat` array by identity, so a B-section hat that regroups to 3+3+2 is
    impossible under a `transp` B. Deferred to whichever pass gives FACTORY a
    hand-authored B; the 2-against-3 interlock inside `A` replaces it.
