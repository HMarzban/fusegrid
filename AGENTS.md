# AGENTS.md

## Project

Fusegrid ("rollblock") — a modular, deterministic arcade game.
Public GitHub is https://github.com/HMarzban/fusegrid. In-game wordmark is
FUSE/GRID; the local folder stays `rollblock`.
Pure ES modules. **Zero `package.json` runtime dependencies.** The sim is
framework-free so it runs identically under Node (tests) and the browser.

The product path is **REAL 3D ⇄ CLASSIC 2D**. Three.js r160 is **vendored**
(`vendor/three.module.js`, MIT, relative import — not an npm dep). The 2026-08-16
"no Three" lock applies to the **sim** only; the render layer reversed it.

This is a **single-player** game. Lockstep is a local two-world **harness**, not
internet play. Do not swap `WebSocketTransport` in and call it multiplayer —
`step()` only consumes `inputs[0]` / `players[0]`.

## Architecture

Single thread, three stages: `input → sim → render`.

Two state machines:

| Layer | States | Owner |
|---|---|---|
| Shell | INTRO → MENU ⇄ LEVEL/HOWTO/SCORES → GAME; idle → ATTRACT | `src/app/menuapp.js` |
| Sim | PLAY / WIN / LOSE / PAUSE | `src/core/sim.js` |

The sim ticks only while the shell is GAME. PAUSE/WIN/LOSE are `world.state`,
not shell screens. Do not add them as `SCREEN` values.

- `src/main.js` — **browser entry only**. RAF loop, URL flags, toolbar, attract
  harness, kind switch. Never imported by sim or renderer.
- `src/core/` — deterministic simulation, no DOM, no browser globals.
  - `world.js` — `createWorld`, `loadLevel` (re-exported from `sim.js`).
  - `sim.js` — `step(world, dt, intents)`.
  - `config.js` — frozen `CFG`, `T`, `BIOMES` (array frozen; **entries are not**).
    Five looks: JUNGLE, ICE, FACTORY, WATER, ARENA (level 5 is ARENA).
  - `board.js`, `entities.js`, `rng.js` — sim support.
- `src/render/` — reads world; drains `world.events` into fx/audio.
  - kind `"2d"` — classic Canvas (`createRenderer`). Do not statically import
    `vendor/three.module.js` on this path; lazy-load via `src/render/three/load.js`.
  - kind `"3d"` — `createRenderer3D` (`#gl` WebGL under `#c` overlay).
  - kind `"iso"` — legacy dimetric (`r3d/`), pinned by `?render=iso` only.
    `createRenderer({kind:"3d"|"iso"})` is the **dimetric** branch. Real 3D
    never enters that factory. Menu RENDER flips 3D ⇄ 2D only.
  - Live 3D default rig (polar `el` from +Y): `{az:0, el:0.419, dist:1000}`.
    Must frame the whole 15×13 board (all four corners + ICE trim).
    Spec text that says `el:1.152` / `dist:700` or live `dist:800` is stale.
    Never assign `#gl.width`/`#gl.height` from `sizeCanvases` — wrapper owns
    the Retina drawing buffer (`setPixelRatio` + `setSize`). Stomping it
    crops WebGL to the bottom-left quarter on dpr=2.
- `src/app/` — menu shell, intro beats, demobot, highscores. Not read by `step()`.
- `src/ai/enemies.js` — enemy AI on sim state.
- `src/net/` — `protocol.js`, `lockstep.js`, `transport.js`.
  Default play uses **no** transport. `?net=local` is a 1P pair proof.
  `applySnapshot` was removed (lockstep-only). `makeSnapshot` remains for harness dumps.
- `src/input.js`, `src/touch.js`, `src/audio.js` — input + chiptune.

## Commands

- `npm test` / `node --test` — run tests (`tests/*.test.mjs`).
- `npm start` / `node serve.js` — loopback only: `http://127.0.0.1:8080/index.html`.
- Public play is **GitHub Pages** (`https://hmarzban.github.io/fusegrid/`).
  Static files only (`.nojekyll`, relative asset hrefs). Do not rebind `serve.js`.
  Social/SEO: keep `og.png` (1200×630), `robots.txt`, and `sitemap.xml` in the
  Pages stage set. `og:image` must stay an absolute Pages URL.

Flags: `?render=3d|iso`, `?play=1`, `?net=local`, `?orbit=1`, `?debug=1`.

Node v26, `"type": "module"`. No build step, no bundler.

## Conventions

- **Determinism**: `step()` is pure w.r.t. world + intent. No time/DOM/`Math.random`
  in the sim — use `src/core/rng.js`. Replay/outcome validity: **baseline v5**
  (enemy candidates DIRS4, no diagonal wander) begins at the GitHub Pages ship.
- **No DOM in `src/core`**. Render factories may touch DOM (atlas, WebGL, HUD).
  Node-testable three **math** stays DOM-free.
- Frozen `CFG` — mutate world, not config. `BIOMES` elements are shallow.
- Keep zero **npm** deps. Vendored render libs are OK.
- 3D draw-call budget is `<=500` (fat-world currently 186). Child-index
  contracts in `three.test.mjs` are ABI — do not "flex" them in a drive-by.
- No comments unless the file already uses explanatory block comments (its style).
  Match the compact, no-whitespace-after-key style already in the codebase.

## Testing

Tests live in `tests/*.test.mjs` and run under `node --test`. Keep the sim
importable without a DOM. `tests/browser_integration.html` is manual. Visual 3D feel is
not covered by Node — play-verify in a browser after render changes.

## Memory

- **Durable memory** lives here (`AGENTS.md`): conventions, architecture, "how
  we do things". Edit when a decision changes.
- **Episodic memory** lives in `MEMORY.md`: a dated, append-only log of what each
  session did/decided/left open. Both are auto-loaded via `opencode.json`
  `instructions`.
- **Standing rule:** after any non-trivial change, append a dated entry to
  `MEMORY.md` (newest first) so the next session/agent inherits context. Keep it
  to 1–2 lines: what changed, why, or what's left open.

## Learned User Preferences
- Public name and wordmark are Fusegrid / FUSE/GRID; keep the local checkout as `rollblock`; do not put Bomberman on public surfaces.
- This repository is the arcade game only — do not add unrelated demos.

## Learned Workspace Facts
- Surviving a hit leaves live bombs and blades in the world.
