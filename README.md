# FUSE/GRID

> **INSERT COIN.** Light the fuse, clear the level, don't stand in the blast.

**Fusegrid** is a single-player bomb-grid arcade you play right in your browser.
Flip **REAL 3D ⇄ CLASSIC 2D** (or hand-pixelled **PIXEL**) whenever you like, set
the **DIFFICULTY** to NORMAL, HARD or EXPERT, and blow your way through eight levels of
bricks, foes and chiptune.

[![Pages](https://github.com/HMarzban/fusegrid/actions/workflows/pages.yml/badge.svg)](https://github.com/HMarzban/fusegrid/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-c39cff.svg)](LICENSE)
[![Play in the browser](https://img.shields.io/badge/play-in%20the%20browser-ffd447.svg)](https://hmarzban.github.io/fusegrid/)

[![FUSE/GRID, a browser arcade bomber, in pixel art: real PIXEL boards from all eight worlds, JUNGLE to CROWN, side by side inside a hand-pixelled cabinet frame, with the PIXEL FUSE/GRID logo on a sign hung from two chains, the keys NORMAL, HARD, EXPERT and PLAY IN THE BROWSER, and the world names on coloured bricks along the foot.](og.png)](https://hmarzban.github.io/fusegrid/)

### ▶ PRESS START: [hmarzban.github.io/fusegrid/](https://hmarzban.github.io/fusegrid/)

No install needed, no account, no server. Just press start.

> **Sharing the link?** Keep the **trailing slash**:
> `https://hmarzban.github.io/fusegrid/`. The no-slash redirect drops the
> Open Graph tags, so chat apps show no preview card (`og.png`, 1200×630).

---

## 🕹️ How to play

**The one rule:** clear every enemy in the level to advance.

- Gold **WALL** never breaks. Green **BRICK** breaks, and stops a normal blast.
- Every world has its own floor tile: BOOSTER, ICE PATCH, CONVEYOR, STREAM, TRAP, QUICKSAND,
  PORTAL or GATE. On NORMAL it helps you; on EXPERT it fights you.
- Power-ups lie in the open and hide under bricks: more bombs, longer
  flames, kick, throw, remote, shield and more. Grab them.
- Take a hit and you lose a heart, but the level keeps going. Any bombs and
  blades already lit stay lit, so step lively.

### Controls

| Keyboard | Controller | Action |
|---|---|---|
| WASD / arrows | D-PAD / left stick | Move |
| Space (or J / X) | SOUTH | Place bomb |
| E | WEST | Throw *(needs THROW)* |
| Q | EAST | Detonate remote *(needs REMOTE)* |
| Walk into a bomb | Walk into a bomb | Kick it so it slides *(needs KICK)* |
| R *(in a run)* | none | Reset the camera and zoom |
| P / Esc | START / SELECT | Pause (RESUME / SETTINGS / RESTART / QUIT TO MENU); ↑↓ + Enter or SOUTH pick a row |
| M *(paused)* | none, QUIT TO MENU is a row | Quit to menu |
| Space / Enter *(end screen)* | SOUTH / START | NEXT LEVEL, MENU after the finale, or TRY AGAIN after GAME OVER |
| Esc *(finale or GAME OVER)* | EAST | Back to the menu |
| C *(end screen or STATS)* | WEST | COPY RESULT or COPY MY STATS as text (both say COPIED, or COPY FAILED) |
| B *(end screen)* | NORTH | COPY MAP: the board's challenge link (BOARD LINK COPIED) |
| Q / E *(RECORDS)* | D-PAD on the tabs | Switch between SCORES, STATS and MEDALS |
| T *(STATS)* | NORTH | Jump to MEDALS |
| R, R *(STATS)* | none | Reset my cabinet (two presses; any other key cancels) |

Menus run on the arrows, Enter and Esc, or on the D-PAD or stick, SOUTH or START, and EAST.
Buttons are named by position. Powers marked `*` in the in-game HOW TO need their power-up first.

**Your binds, your call.** **SETTINGS → CONTROLS** rebinds both devices. The table
shows the defaults. Arrows, Esc, Enter, the D-PAD and START stay put, so you can always get back.
Plug a controller in mid-run and a short CONTROLLER READY note beside the board names its MOVE
and BOMB buttons.

**On a phone or tablet,** a touch strip sits off the board: a D-PAD of four
keys and a yellow BOMB key, every key at least 44 px. In portrait the strip docks
low in the thumb zone under the board, and PAUSE sits in the HUD above it; in
landscape the controls fill the side gutters, with PAUSE at the head of the right
one. Holding THROW or REMOTE? Its key appears beside BOMB. Every menu row, tab and
key is a tap target, and a page too long for the screen turns into pages with
▲ / ▼ keys instead of shrinking its text.

Want the full cast of power-ups and foes? Open **GUIDE → POWER-UPS / ENEMIES** in the
game. The cabinet explains itself, and its wording comes straight from the
game's own item table, so it's never out of date.

---

## 🗺️ The run

### Eight levels

| Level | World | Notes |
|---|---|---|
| 1 | JUNGLE | Bright grass, gold stumps |
| 2 | ICE | White cubes, navy cliffs |
| 3 | FACTORY | Amber crates, steel |
| 4 | WATER | Teal sewer / ruins |
| 5 | ARENA | Night court, rose bricks. **Finale on your first run** |
| 6 | SAND | Ochre dunes *(unlocks after your first CLEAR)* |
| 7 | VOID | Violet dark, tall cliffs *(unlocks after your first CLEAR)* |
| 8 | CROWN | Gold court. **Finale after unlock** *(unlocks after your first CLEAR)* |

Every level has its own chiptune theme and its own blast tint. Fresh installs
show levels 1–5 only. That's the gate, not a bug: beat level 5 and the map grows.

### Turn up the DIFFICULTY

LEVEL SELECT is a short list: LEVEL, DIFFICULTY, GAME SPEED, MODIFIERS (once
open) and START. `↑/↓` walk the rows, `←/→` change the one you're on, and `[`/`]`
step GAME SPEED (SLOW / NORMAL / FAST) from anywhere. Enter starts, Esc backs out.
A card beside the list shows the run you're about to play: its world, the foes
you'll meet, its floor tile, lives, fuse and score multiplier.

| Difficulty | What changes |
|---|---|
| **NORMAL** | The baseline run (baseline v6, the replay reference) |
| **HARD** | Harder spawns and a tighter fuse |
| **EXPERT** | Highest pressure |

The attract demo always runs NORMAL with every modifier off, whatever you picked last.

### Stack the MODIFIERS *(after your first FUSE/GRID CLEAR)*

Clear level 5 once and LEVEL SELECT also offers four optional **MODIFIERS**,
each a voluntary handicap:

| Key | Modifier | Rule |
|---|---|---|
| `1` | ONE LIFE | Start with one life |
| `2` | NO FLOOR ITEMS | No power-ups lying in the open |
| `3` | FEWER ITEMS | One fewer power-up buried under breakables |
| `4` | SHRINK | Arena walls close inward over time |

`5` adds **TIME TRIAL**: a play-only stopwatch with a per-level best. A NORMAL run
with every modifier off is bit-identical to baseline v6.

### Score

The live HUD shows raw points. **RECORDS → SCORES** saves difficulty-scaled totals:
NORMAL ×1, HARD ×2, EXPERT ×3.

---

## ✨ What's in the cabinet

- **The opening.** While the game loads, the title builds itself where it will stand: the level's floor
  fills in and the FUSE/GRID fuse burns toward its tip as the files arrive. Then the title waits, centred
  on the board, its fuse sparking, for any key, tap or controller button.
  That press drops the music and a ~4 s show that blasts the menu open. Any key skips it. The
  wordmark is drawn in the art style you picked.
- **A new board every run.** Every PLAY, restart and GAME OVER retry deals a
  fresh board; losing a life keeps the one you're on. Each world has its own
  bold level shape (fourteen in all), and you start sealed in a brick corner
  with every foe at least 10 steps away. Every board passes a fairness check
  before you see it.
- **Three looks, one game.** **SETTINGS → ART STYLE** cycles CLASSIC 2D (Canvas),
  PIXEL (hand-drawn sprites over the same board) and REAL 3D (WebGL), live, no
  reload. REAL 3D frames the whole board from one 3/4 camera; wheel or pinch to
  zoom, and zoom snaps back to your CAMERA preset every level. SETTINGS also
  holds music and SFX volume, the 3D camera preset, brightness, screen shake
  and reduce-flash.
- **GRAPHICS.** One page (under SETTINGS, and in the pause menu) for look versus
  frame rate: QUALITY BATTERY / AUTO / HIGH in one press, or tune FRAME RATE
  (30 / 60 / MAX), RESOLUTION, SHADOWS, ANTI-ALIAS, EFFECTS, DEMO and an FPS
  METER yourself (CUSTOM). Game speed never changes. Menus and pause idle at
  30 fps, and audio sleeps while the tab is hidden.
- **A HUD off the board.** Seven labelled chips (LIVES, BOMBS, FLAME, LEVEL,
  ENEMIES, TIME, SCORE) sit in the level's own frame, never over the play, and a
  power-ups bar lists the powers you hold. Every power-up floats a label with your
  new value (`FLAME 4`, `MAX`, or `replaces …` on a bomb swap) and pulses its chip.
  The first time you step on a floor tile, a tip explains it beside the board.
- **Coach.** A ghost demonstrates your first bomb on a fresh install, then you
  get one short tip the first time you grab KICK, THROW, REMOTE, PASS, LINE,
  POWER BOMB, PIERCE or SHIELD. Once each, ever.
- **The end of a run.** LEVEL CLEAR shows your time, enemies and power-ups for the
  level. The finale (FUSE/GRID CLEAR) shows the whole run on its level course, the
  score with its difficulty and any medals you just earned. GAME OVER shows how far
  you got and, only from a saved best for that difficulty, NEW BEST, FURTHEST LEVEL
  YET, a match or how far short you fell. Combo callouts and a close-call flash fire
  during play (both respect reduce-flash).
- **DAILY.** One board a day, seeded from the date. Your tries and your best
  for the day stay on this device. Nobody is ranked; it's you against you.
- **Challenge code.** On the end screen, `B` copies a twelve-character board
  code (seed, difficulty, modifiers, game speed and which board maker built it, never a score;
  `F3` codes are today's boards with floor tiles, `F2` the tile-free mazes, `F1` the original boards). Open
  `…/fusegrid/?code=XXXXXXXXXXXX` to play that same board.
- **Ghost.** On a DAILY or challenge board (the boards you can play twice),
  clear a level faster than ever and replaying that exact board (same seed,
  level, difficulty, modifiers, game speed) races a translucent copy of your best
  route, in every look.
- **RECORDS.** Three tabs. **SCORES**: your ten best runs per difficulty and four
  badges (CLEAR, HARD, EXPERT, CROWN). **STATS**: lifetime runs, levels, deaths, kills,
  power-ups, play time, DAYS PLAYED, your best score, furthest level and your NORMAL /
  HARD / EXPERT bests; `C` (or a tap on COPY STATS) copies it as text. **MEDALS**:
  eight of them, each earned on a finale clear.
- **Reset my cabinet.** On STATS press `R` twice (or tap RESET, then AGAIN ERASES)
  to wipe progress and reload. A card names everything it erases and keeps: settings,
  game speed, controls and your analytics answer are kept. Anything else cancels
  (`C` cancels and copies your stats).
- **Help on the cabinet.** **GUIDE** (HOW TO PLAY, POWER-UPS, ENEMIES, FLOOR) and
  **SOURCE**, which opens this repository.
- **Menus that wear the world.** MENU (PLAY, LEVEL SELECT, DAILY, RECORDS, SETTINGS,
  GUIDE, SOURCE) and every page sit centred on the look of the level you picked, drawn
  at the size you play on, in its own colours, with a card showing the run PLAY starts.
  PAUSE and the end of a run are drawn at your screen's full resolution in every look. Keyboard, controller and touch
  all work everywhere; on a phone every row and key is at least 44 px.
- **Plays offline.** Install it from the browser as a PWA. After your first
  online visit it runs offline.
- **Updates on your timing.** When a new version is ready, a **NEW VERSION
  READY** card offers RELOAD (or `U`) on the menus or after a finished run,
  never in the middle of one. LATER hides it until your next run ends or
  the next time you open the game.
- **Know your build.** The main menu shows which version you're running
  (for example `v214`), so you can tell when an update has landed.

Everything the game remembers lives in your browser's local storage. There is
no account, no server and no global ranking. The game asks once whether to
share play stats through Google Analytics; nothing is sent unless you
allow it, and **SETTINGS → ANALYTICS** changes your mind
([privacy](docs/privacy.md)).

---

## 📲 Install

- **Browser:** [hmarzban.github.io/fusegrid/](https://hmarzban.github.io/fusegrid/)
- **As an app (PWA):** use *Install app* or *Add to Home Screen* in a
  supporting browser. The first visit precaches the game and needs network;
  every visit after that works offline. (iOS: Add to Home Screen, 16.4+.)

---

## 🛠️ Build it yourself

No bundler, no build step and zero npm runtime dependencies. It's plain ES
modules, and Three.js r160 is vendored for REAL 3D only. You need **Node.js 26**.

```bash
git clone https://github.com/HMarzban/fusegrid.git rollblock
```

```bash
npm start
```

Then open `http://127.0.0.1:8080/index.html`. Run the whole test suite with:

```bash
npm test
```

Under the hood the simulation is deterministic: same seed, same inputs, same
outcome, in Node and in the browser. Read on:

| You want to… | Go to |
|---|---|
| Set up, use URL flags, send a pull request | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Understand how the game works and why | [docs/architecture.md](docs/architecture.md) |
| Find any doc (and which one owns which fact) | [docs/README.md](docs/README.md) |
| See what changed in each release | [CHANGELOG.md](CHANGELOG.md) |
| Read the story of how it was built | [docs/diary.md](docs/diary.md) |
| Grab store art or zip the game for itch | [media/README.md](media/README.md) (listing art lives in `media/`) |
| Report a security issue | [SECURITY.md](SECURITY.md) |

Everyone in the arcade follows the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📜 License

MIT. See [`LICENSE`](LICENSE). Three.js r160 is vendored under MIT in
`vendor/three.module.js`.

**Source:** [github.com/HMarzban/fusegrid](https://github.com/HMarzban/fusegrid).
The public game is Fusegrid; a local checkout is conventionally named
`rollblock`.

**GAME OVER?** Press Space. One more run.
