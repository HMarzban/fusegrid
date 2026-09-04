# Fusegrid

**FUSE/GRID** is a single-player, deterministic bomb-grid arcade you play in the browser. Flip **REAL 3D ⇄ CLASSIC 2D** from the cabinet menu, pick your Heat on LEVEL SELECT, and clear every enemy to advance.

[![Play Fusegrid in the browser — share card shows the real 3D board mid-blast, Heat chips, and the FUSE/GRID wordmark](og.png)](https://hmarzban.github.io/fusegrid/)

**Play now:** [https://hmarzban.github.io/fusegrid/](https://hmarzban.github.io/fusegrid/)

Share that URL **with the trailing slash** so chat apps load the preview card (`og.png`, 1200×630). The no-slash redirect drops Open Graph tags.

## Features

- **REAL 3D ⇄ CLASSIC 2D** — menu **RENDER** toggles WebGL and classic Canvas; no reload.
- **Heat** — CORE / PLUS / MAX on LEVEL SELECT (`↑/↓`). CORE is the baseline run; PLUS and MAX tighten fuse, spawns, and pressure.
- **Eight rooms** — five biomes on a fresh install (JUNGLE → ARENA), then SAND, VOID, and CROWN after your first clear.
- **Pact afterburner** — optional LAST / BARE / THIN / SHRINK toggles (`1`–`4`) unlock with rooms 6–8; CORE with every toggle off matches baseline v6.
- **Cabinet help** — HOW TO, ITEMS, ENEMIES, HIGH SCORES, and **SOURCE** (opens [github.com/HMarzban/fusegrid](https://github.com/HMarzban/fusegrid)).
- **Chiptune + boom** — each room has its own theme and blast tint.
- **PWA** — install from the browser; offline play after the first visit (first load still needs network).
- **Pure ES modules** — no bundler, no npm runtime dependencies. Three.js r160 is vendored for 3D only.

This is **single-player** arcade play. Internet multiplayer is not shipped. The sim is deterministic: same inputs, same outcome.

## How to play

Clear every enemy in the room to advance. Gold **WALL** never breaks; green **BRICK** breaks and stops a normal blast. Collect floor cubes for bombs, flame range, kick, throw, remote, and shield. Surviving a hit leaves live bombs and blades in the world.

| Input | Action |
|---|---|
| WASD / arrows | Move |
| Space | Place bomb |
| Shift + Space | Throw *(needs throw power-up)* |
| Q | Detonate remote *(needs remote power-up)* |
| K + move | Kick *(needs kick power-up)* |
| P | Pause |
| M / Menu | Quit to menu |

On touch devices during a run, a virtual D-pad and bomb button overlay the stage. Power-ups marked with `*` in the in-game HOW TO need their pickup first.

## Progression

### Rooms

| Room | Look | Notes |
|---|---|---|
| 1 | JUNGLE | Bright grass, gold stumps |
| 2 | ICE | White cubes, navy cliffs |
| 3 | FACTORY | Amber crates, steel |
| 4 | WATER | Teal sewer / ruins |
| 5 | ARENA | Night court, rose bricks — **finale on first run** |
| 6 | SAND | Ochre dunes *(unlocks after first CLEAR)* |
| 7 | VOID | Violet dark, tall cliffs *(unlocks after first CLEAR)* |
| 8 | CROWN | Gold court — **finale after unlock** *(unlocks after first CLEAR)* |

On LEVEL SELECT, `←/→` picks the room and `↑/↓` picks Heat.

### Heat

| Grade | Effect |
|---|---|
| **CORE** | Baseline v6 — replay reference |
| **PLUS** | Harder spawns and tighter fuse |
| **MAX** | Highest pressure |

Attract mode always runs CORE with Pact off, regardless of your last selection.

### Unlock: rooms 6–8 and Pact

Beat room 5 (FUSE/GRID CLEAR) once and LEVEL SELECT unlocks rooms 6–8 plus four optional **Pact** toggles. Fresh installs show rooms 1–5 only — that is intentional gating, not a bug.

| Key | Pact | Rule |
|---|---|---|
| `1` | LAST | Start with one life |
| `2` | BARE | No walkable floor cubes |
| `3` | THIN | One fewer buried cube under breakables |
| `4` | SHRINK | Arena walls close inward over time |

Toggle with `1`–`4` on LEVEL SELECT. A CORE run with all Pact toggles off stays bit-identical to baseline v6.

### Scoring

The live HUD shows raw points during play. **HIGH SCORES** stores Heat-scaled totals only: CORE ×1, PLUS ×2, MAX ×3.

## Play online and install

- **Browser:** [https://hmarzban.github.io/fusegrid/](https://hmarzban.github.io/fusegrid/)
- **Install (PWA):** use Add to Home Screen / Install app in a supporting browser. The app shell precaches on first visit; later sessions work offline. The first visit still needs network.

## Development

The public game is **Fusegrid**; this repository folder is **`rollblock`**. Clone, serve locally, and run tests — no build step.

**Requirements:** Node.js v26 ( `"type": "module"` ).

```bash
git clone https://github.com/HMarzban/fusegrid.git rollblock
cd rollblock
npm start          # http://127.0.0.1:8080/index.html  (loopback only)
npm test           # node --test
```

`serve.js` binds **127.0.0.1** on purpose. Public play is GitHub Pages (static files), not a rebind of the local server.

**URL flags** (append to `index.html`):

| Flag | Purpose |
|---|---|
| `?render=3d` | Start in REAL 3D |
| `?render=iso` | Legacy dimetric renderer |
| `?play=1` | Skip intro |
| `?orbit=1` | Orbit camera (3D) |
| `?net=local` | Local lockstep harness (1P proof, not multiplayer) |
| `?debug=1` | Debug overlay |

**Test Pact locally without clearing room 5:** in devtools console, `localStorage.setItem('nb.pact.v1','1')` then reload LEVEL SELECT.

Architecture, conventions, and agent notes live in [`AGENTS.md`](AGENTS.md).

## License

MIT — see [`LICENSE`](LICENSE). Three.js r160 is vendored under MIT in `vendor/three.module.js`.

## Repository

[https://github.com/HMarzban/fusegrid](https://github.com/HMarzban/fusegrid)
