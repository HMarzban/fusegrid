# FUSEGRID

[![FUSE/GRID — play in the browser](og.png)](https://hmarzban.github.io/fusegrid/)

Single-player bomb-grid arcade. Flip REAL 3D ⇄ CLASSIC 2D. Heat CORE / PLUS / MAX. After the first CLEAR: Pact and rooms 6–8. ES modules, no bundler, no npm runtime deps.

**Play:** [hmarzban.github.io/fusegrid/](https://hmarzban.github.io/fusegrid/) — share this URL **with the trailing slash** so chat apps load the preview card.

Cabinet: START, LEVEL SELECT, RENDER, HOW TO, ITEMS, ENEMIES, HIGH SCORES, SOURCE. Each room has its own chiptune and boom.

## Play locally

```bash
npm start          # http://127.0.0.1:8080/index.html  (loopback only)
npm test           # node --test
```

`serve.js` binds **127.0.0.1** on purpose. Public play is GitHub Pages (static files), not a rebind.

## Controls

| Input | Action |
|---|---|
| WASD / arrows | Move |
| Space | Place bomb |
| Shift+Space | Throw (needs throw power-up) |
| Q | Detonate remote (needs remote power-up) |
| K + move | Kick (needs kick power-up) |
| P | Pause |
| M / Menu | Quit to menu |

Menu **RENDER** toggles REAL 3D ⇄ CLASSIC 2D. Flags: `?render=3d`, `?render=iso` (legacy dimetric), `?play=1`, `?orbit=1`, `?net=local` (1P lockstep harness), `?debug=1`.

Internet multiplayer is not shipped — the sim is one player.

## Levels

Five biomes on the first telling (1–5, no wrap). After the first FUSE/GRID CLEAR, rooms 6–8 and Pact toggles (`1`–`4`: LAST / BARE / THIN / SHRINK) unlock.

| Lv | Look |
|---|---|
| 1 | JUNGLE — bright grass, gold stumps |
| 2 | ICE — white cubes, navy cliffs |
| 3 | FACTORY — amber crates, steel |
| 4 | WATER — teal sewer / ruins |
| 5 | ARENA — night court, rose bricks |
| 6 | SAND — ochre dunes, low walls |
| 7 | VOID — violet dark, tall cliffs |
| 8 | CROWN — gold court, finale |

On LEVEL SELECT, ←/→ picks the room and ↑/↓ picks Heat (CORE / PLUS / MAX). Clear every enemy to advance. Collect bombs, flame, kick, throw, remote, and shield. High scores store Heat-scaled points (CORE ×1 / PLUS ×2 / MAX ×3); the live HUD stays raw.

## License

MIT. Three.js r160 is vendored under MIT (`vendor/three.module.js`).
