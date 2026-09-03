# Extra biome boom SFX — SAND / VOID / CROWN (2026-09-02)

Rooms 6–8 already have looks and chiptune beds. Boom still used the
five-theme tint (ice / water / arena; factory was identity). New ids
fell through to the default stack. This plate tints boom only.

Public copy never uses Bomberman. Music STEP / bass roots, cameras,
and lights stay frozen.

## Approaches

**A. Frozen biome-id → recipe table + `boomOf(id)` (recommended).**
Same five-layer family (crack noise, kick sine, body saw, snap square,
tail noise). Unknown / menu / intro / jungle / factory → `BOOM_DEFAULT`.
Node can pin the table without WebAudio.

**B. Grow the `play("boom")` if/else.** Smallest diff. Untestable as
data; factory already sits unused on this path; every new look adds
another ternary.

**C. Derive boom from track STEP + bass root.** Couples SFX to music.
A STEP edit would retune the explosion. Jungle and factory would drift
off today’s default. Rejected.

Ship A. Lookup is `curId` after `setTrack` / `musicCue`. Menu and intro
never enter the tint map.

## Player-facing

Same Fusegrid explosion: layered voice + noise + filter, direct-to-
destination, never `musicGain`. Rooms 6 / 7 / 8 just change the color
of the blast.

| Room | Cue | Character | Kick Hz | Why |
|---|---|---|---|---|
| 6 | sand | dry, dusty, hollow grit | 69 | sits on bass 69.3; shorter dry tail |
| 7 | void | swallowed, muffled, low | 40 | below water’s 48; long dark wash |
| 8 | crown | bright metallic snap | 82 | toward bass 98; tight STEP 0.13 |

Kick Hz stay far from the live set: default/jungle/factory/ice **55**,
water **48**, arena **62**.

## Rule

Pure table in `src/audio/boom.js`, re-exported from `audio.js` next to
`play("boom")`. Do not fold it into the music track dump. `boomOf(id)`
returns `BOOM_TINTS[id] || BOOM_DEFAULT`.

Existing tints stay byte-identical:

- ice: crack `f0` 3200 only
- factory: identity (default)
- water: kick 48 / 0.56, tail 0.28
- arena: crack vol 0.18, kick 62 / 0.25

No samples. No new `SCREEN`. No per-biome camera or light.

## Tests

`boomOf` pins ice / water / arena numbers and factory === default.
`boomOf("sand"|"void"|"crown")` signatures distinct from each other
and from `boomOf()` / jungle. `boomOf("menu"|"intro"|"nope")` is
default. `musicCue(GAME, 6|7|8)` still sand / void / crown, and
`play("boom")` after `setTrack` uses that kick.

## Out of this pass

Mid-run heat, streamed songs, stereo, brick tints for 6–8, per-biome
cameras / lights, score × Pact.
