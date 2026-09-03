# Pact — unlock-gated afterburner (2026-09-02)

Approved as leftover-then-Pact (approach B). Public copy never uses
Bomberman. Heat stays the telling. Pact is spice you author after a first
clear.

## Player-facing

After the first FUSE/GRID CLEAR (room 5 WIN / finale), LEVEL SELECT gains a
third rail of four toggles. Fresh installs never see it. Attract never runs
it. A CORE run with every toggle off stays bit-identical to v6.

| Key | Word | Color | Rule |
|---|---|---|---|
| `1` | LAST | `#ff5d73` | Start with 1 life |
| `2` | BARE | `#7385ad` | No walkable floor cubes |
| `3` | THIN | `#37f0d0` | One fewer buried cube (floor still 3 min) |
| `4` | SHRINK | `#ffd447` | After 25s, a WALL ring closes 1 tile every 8s |

`←/→` room, `↑/↓` heat, `1–4` pact. Enter still starts. No new `SCREEN`.
No tenth MENU row. Mid-run change is off.

## Unlock / persist

- Latch on live-world WIN when `level>=5` or `finale`.
- Store `nb.pact.v1` = `1` in localStorage (same store style as scores).
- Shell `app.pactUnlocked` is the runtime flag. Attract / demo never writes it.

## Sim (on `world`, never thaw `CFG`)

`world.pact` is a bitmask `0..15` frozen at `startRun` / `loadLevel`.

| Bit | Name | Effect |
|---|---|---|
| 1 | LAST | `w.lives = 1` on a fresh run (carry still wins on WIN→next) |
| 2 | BARE | `nFloor = 0` |
| 3 | THIN | `buriedAdd` is `P.buriedAdd-1`, still clamped `>=3` |
| 4 | SHRINK | `w.shrinkT=25`, then every 8s convert the current empty rim toward center to WALL. Never overwrite the (1,1) spawn tile. Entities on a new WALL are not auto-killed; the tile is just blocked. Deterministic, no `Math.random`. |

L1 roster stays frozen. Player speed stays 3.4. Heat fuse / chase / carve
unchanged. Plant-and-leave / R16 untouched. Pass-through types still stay
out of rooms 1–2.

## Scores / HUD

- Rows stay `{s,l,d,t}`. No multiplier. Optional `p` (0–15) may be stored
  later; v1 Pact does not require a fifth column.
- Overlay kicker stays the heat token. Pact chips are LEVEL SELECT only.
- Attract demo: `heat=0` and `pact=0`.

## Out of this pass

Extra rooms / NG+, mid-run heat, Easy/Hard speed sticks, score × heat,
always-on Sudden Death, a fourth Heat grade.
