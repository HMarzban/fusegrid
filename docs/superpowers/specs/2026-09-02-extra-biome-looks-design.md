# Extra biome looks for rooms 6–8 (2026-09-02)

Plate C, after score × heat. Adviser-validated: append three palettes.
Public copy never uses Bomberman. Rooms 1–5 stay the current five looks.
Music stays the five-theme wrap.

## Player-facing

After unlock, rooms 6 / 7 / 8 each have their own colors and block
heights. They no longer reuse JUNGLE / ICE / FACTORY. LEVEL SELECT chips
stay numbers. No new music themes. Boom SFX tints still follow the
five-track cue.

## Rule

Append three `{name, bg0, bg1, brickA, brickB, brickHi, wall, wallHi,
floor0, floor1, hWall, hBrick, sky}` rows on `BIOMES` in
`src/core/config.js`. Leave `biomeOf` as
`(level-1) % BIOMES.length`. Entries 0–4 stay byte-identical.

`hWall` ≤ ICE 36 so the live rig still frames the 15×13 board. Fat-world
draw-call count stays 186 (board + entities, not palette count).
Sprites / 3D / iso already loop `BIOMES.length` or `indexOf(biomeOf)`.

Music for 6–8 is a later plate (sand / void / crown tracks).

## Tests / docs

Rewrite `tests/headless.test.mjs` “five biomes: selectable 1-5 never
wrap”: rooms 1–5 stay `JUNGLE,ICE,FACTORY,WATER,ARENA` and
`biomeOf(1)!==biomeOf(5)`. Then pin `BIOMES.length===8` and
`biomeOf(6).name !== biomeOf(1).name`. Leave `music.test.mjs` 1..5 pins.
Do not restyle rooms 1–5. Do not add enemy types, shaders, or chip tints.

Names: room 6 SAND, room 7 VOID, room 8 CROWN. Not a theme system.

## Out of this pass

New tracks, mid-run heat, always-on Sudden Death, Easy/Hard, internet
play, restyled rooms 1–5.
