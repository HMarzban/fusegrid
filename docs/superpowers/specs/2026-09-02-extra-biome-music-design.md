# Extra biome music — SAND / VOID / CROWN (2026-09-02)

Approach A. Same chiptune table as the five. Public copy never uses
Bomberman. Rooms 1–5 cues stay jungle / ice / factory / water / arena.

## Player-facing

GAME and ATTRACT follow the room. Rooms 6 / 7 / 8 each play their own
bed. Menu and intro are unchanged. Attract still demos rooms 1–3.

| Room | Cue | Feel | STEP | First bass Hz |
|---|---|---|---|---|
| 6 | sand | dry, mid, open | 0.17 | 69.30 |
| 7 | void | slow, low, sparse | 0.19 | 49.00 |
| 8 | crown | bright, tight | 0.13 | 98.00 |

STEP 0.17 (not 0.15) so sand stays off the menu AABB clock.

## Rule

Three `mkPat` + `transp` B entries on `MUSIC_TRACKS`. `BIOME_IDS` is
`jungle, ice, factory, water, arena, sand, void, crown`. `musicCue`
uses `% BIOME_IDS.length`. Boom SFX keep the ice / factory / water /
arena tints; new ids use the default boom.

No samples. No new `SCREEN`. Oscillator-only.

## Tests

Ten frozen cues. Eight distinct biome bass roots. Distinct STEP on every
track including intro/menu. `musicCue(GAME, 6|7|8)` → sand / void / crown.
Rooms 1–5 pins unchanged.

## Out of this pass

Per-biome boom tables, streamed songs, stereo, mid-run heat.
