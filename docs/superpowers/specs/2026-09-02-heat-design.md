# Heat grades — CORE / PLUS / MAX (2026-09-02)

Player-facing difficulty for Fusegrid. Approved 2026-09-02. Public copy never uses
Bomberman. Default **CORE** is today’s v6 story, bit-identical.

## Player-facing

Three Heat grades, not a global speed slider. Room = where you start. Heat = how
hot the telling is. First visit stays the five-room ladder. Veterans ask for the
next foe sooner.

| Mark | Word | Color | Role |
|---|---|---|---|
| `·` | CORE | `#7385ad` | Today’s v6 path |
| `+` | PLUS | `#37f0d0` | Next foe one room early |
| `×` | MAX | `#ff5d73` | Next room’s full roster, tighter fuse |

## Control

- Chips on **LEVEL SELECT** (second rail). `←/→` room, `↑/↓` heat (up = hotter).
- Echo as a value token on `START GAME` and `LEVEL SELECT` in the main list.
- No tenth MENU row. No new `SCREEN` value. Mid-run change is off.
- Last heat persists on the shell. Attract **always** loads CORE.
- `startRun` args: `{level, heat}`. `world.heat` rides WIN→next and LOSE→retry.

## Sim knobs (on `world`, never thaw `CFG`)

CORE numbers equal today’s CFG / roster / carve. PLUS/MAX may diverge.

| Knob | CORE | PLUS | MAX |
|---|---|---|---|
| Fuse (s) | 2.5 | 2.3 | 2.1 |
| Lives (new run) | 3 | 3 | 2 |
| Enemy curve | 0.12 | 0.16 | 0.18 |
| Chase cd (fast/chaser) | 0.35 | 0.28 | 0.22 |
| Enemy spawn invuln | 1.2 | 1.4 | 1.6 |
| Player i-frames | 1.4 | 1.4 | 1.1 |
| Brick carve | 0.32 | 0.28 | 0.24 |
| Buried | `4+level` | `4+level` | `3+level` |
| Floor | `2+level` min 2 | `1+level` min 2 | `level` min 1 |

Roster: Room 1 frozen on all heats (`walker, walker, stationary`). Pass-through
types never enter rooms 1–2.

- PLUS 2–4 gain the next room’s new type; Room 5 adds one extra CHASER.
- MAX 2–4 use the next room’s full CORE roster; Room 4 is the full six; Room 5
  is the six plus an extra PHANTOM.

L1 buried FLAME + BOMB guaranteed on every heat. Plant-and-leave / R16 untouched.
Type speed multiples stay 2.0 / 1.3 / 1.6 / 0.7. Player move speed stays 3.4.
No extra WALL pillars. No spawn inside `SPAWN_CLEAR`. No biome restyle.

## Scores / HUD

- Rows `{s,l,d,t}` with `t` in `0|1|2`. Missing `t` = CORE. Keep key
  `nb.highscores.v1`. Sort score, then heat, then room, then date.
- LEVEL column folds the mark: `3·` `4+` `5×`. No fifth column.
- Overlay SCORE kicker becomes `· CORE` / `+ PLUS` / `× MAX`. No seventh HUD stat.

## Out of v1

Unlock-gated Pact, extra rooms / NG+, adaptive mid-run heat, score multipliers,
global Easy/Hard speed sticks, Sudden Death walls.
