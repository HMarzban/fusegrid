# Floor tiles, direction D (A + B): design record

2026-10-25. Owner ruling after the options page (four directions, one critique
and one fix round). Owner, verbatim: "Go with D, the A+B mix. Plan the real
build from the round-3 worktree." This record fixes the look. The build plan is
`docs/superpowers/plans/2026-10-25-floor-tiles-direction-d.md`. Supersedes the
round-3 emblem-in-a-frame look (art approach C in the 2026-10-21 tiles record,
§5) wherever they differ; that record's sim rules, dials and fairness checks
are untouched.

## Why

Round 3 drew every tile as a flat emblem on a flat bed inside a dashed or
keylined square. The frame was also the heat tell, so the tiles read as
stickers on the floor, not parts of it. Owner ask: "Make them look like a real,
mature game."

## The rule

Built worlds get hardware sunk into the floor (direction A, FIXTURE). Living
ground (JUNGLE, WATER, SAND) is the floor itself changed (direction B,
TERRAIN). One top-left key light, one well value, one single-glyph silhouette
at 40 px.

| Tile | World | From | Look in one line | Heat tell (never colour) |
|---|---|---|---|---|
| BOOSTER | JUNGLE | B | an East-pointing spear-leaf growth out of root loam | side shoots: none / one pair / two pairs; tip rounded to sharp |
| ICE PATCH | ICE | A | glazed plate between steel rails | etched grooves 1 / 2 / 3, glaze and rail edge value |
| CONVEYOR | FACTORY | A | real rollers between rails | rollers 4 / 5 / 8, metal value |
| STREAM | WATER | B | a dark channel with banks, flow ripples, a channel mouth at run ends | ripple shape round / looped / saw-tooth, channel narrows and darkens |
| TRAP | ARENA | A | a cast plate sunk in a well | cleats 1 / 2 / 3 (= blast reach) |
| QUICKSAND | SAND | B | a slumped funnel, intact rim at every heat | 2 / 3 / 4 steeper, darker terraces |
| PORTAL | VOID | A | the ONLY concentric-square tile: a ring stack in a dark socket | rings 2 / 3 / 4, pair id 1 / 2 / 3 ticks on the lip |
| GATE | CROWN | A | a recessed gilt portcullis inlay | bars 3 / 4 / 5, tip blunt to spear, timer strip |

Picks come from `.superpowers/sdd/2026-10-25-tile-art-d/source/` (`dirA.js`,
`dirB.js`, `dirD.js` = the pick table). B's PORTAL was rejected (its slots read
as brick courses); C (SIGNAL) is not used and is not mixed in.

## Rules that bind (unchanged from the tiles record, restated)

- Heat is shown by structure, count, value and tip shape, never colour: the
  same slots at CORE, PLUS and MAX.
- A tile never starts damage on its own: no blast, spike-as-damage or fire read.
- No new hex: biome slots, slot mixes, `#000` / `#fff` at alpha. Never
  `brickA` / `brickB` / `brickHi`.
- VOID: nothing brighter than `wallHi`.
- No "+" and no round disc as a whole tile idea.
- Bevelled raised slabs belong to WALLS: no tile is a raised chamfered square.
  Tiles are sunk wells, plates and grown ground. (Proposed in the critique,
  accepted with direction D; revisit only if the owner says so.)
- Every mark has a cause; nothing under 1.2 units.
- The tile stays distinguishable from the biome's WALL and BRICK, a pickup, bomb
  or foe, at true size (40 px CLASSIC 2D, k≈3 PIXEL, rig C in REAL 3D).
- REAL 3D: ONE InstancedMesh, 142 draws in a tile room, frozen light recipe,
  NoToneMapping, no fog. Depth is painted into the atlas; the shader reads it
  as relief.

## Known weak spots going in (from the critique and the painters)

- A's ICE and CONVEYOR keep bright raised-looking metal; they may sit close to
  the FACTORY wall slabs and the white ICE brick. Check at true size first.
- A's TRAP is a plain sunk plate; it must still telegraph the wind-up.
- B's STREAM can read as a tube; B's QUICKSAND terrace count is faint in
  grayscale.
- Auto-quantised PIXEL previews were murky; the real PIXEL cells are
  hand-pixelled.

## Non-goals

- No sim change, no new tile rules, no heat-dial tuning (issue #28 owns that).
- No port to `main` and no push: the build stays on the local prototype stack
  until the owner says otherwise (tiles #19–#22 are not build-ready).
- No walls work (issues #17 / #31).
