# AGENTS.md

## Project

Neo-Bomberman ("rollblock") — a modular, deterministic, Canvas-2D arcade game.
Pure ES modules, **zero runtime dependencies**. The authoritative simulation is
framework-free so it runs identically under Node (tests) and the browser.

## Architecture

Single thread, three stages: `input → sim → render`.

- `src/main.js` — **browser entry only**. Owns the `requestAnimationFrame` loop,
  wires input to sim to renderer. Never imported by sim or renderer.
- `src/core/` — deterministic simulation, no DOM, no browser globals.
  - `sim.js` — `createWorld`, `loadLevel`, `step(world, dt, intents)`.
  - `config.js` — frozen `CFG`, tile constants `T`, `BIOMES`, helpers.
  - `board.js`, `world.js`, `entities.js`, `rng.js` — sim support.
- `src/render/` — renderer + sprites/scenes/fx. Pure read of world state.
  - `src/render/three/` — real-3D path (S1+): vendored `vendor/three.module.js`
    (r160, MIT, relative import — no npm dep). `wrapper.js` createRenderer3D
    renders WebGL into `#gl` under the classic overlay `#c`; kind "iso" pins
    legacy dimetric (`r3d/`), menu RENDER toggles REAL 3D ⇄ CLASSIC 2D.
    Scene/camrig/lights are Node-testable; sim/protocol untouched.
- `src/ai/enemies.js` — enemy AI, operates on sim state.
- `src/net/` — `protocol.js`, `transport.js`. Multiplayer-ready: swap
  `LocalTransport` → `WebSocketTransport` in `main.js`.
- `src/input.js` — `Input` (keyboard + buttons). `src/audio.js` — `createAudio`.

Future multiplayer: replace `LocalTransport` with `WebSocketTransport` in
`main.js`; the sim stays authoritative.

## Commands

- `npm test` / `node --test` — run tests (`tests/*.test.mjs`).
- `npm start` / `node serve.js` — static server at `http://localhost:8080/index.html`.

Node v26, `"type": "module"`. No build step, no bundler.

## Conventions

- **Determinism**: `step()` must be pure w.r.t. world state + intent. Never read
  time/DOM/`Math.random` inside the sim — use `src/core/rng.js`.
- **No DOM in sim/render logic** that must stay Node-testable — guard with
  `typeof document === "undefined"` only at the `main.js`/entry boundary.
- Frozen config objects (`Object.freeze`) — mutate world state, not `CFG`/`BIOMES`.
- Keep the zero-dependency invariant; do not add `package.json` deps.
- No comments unless the file already uses explanatory block comments (its style).
  Match the compact, no-whitespace-after-key style already in the codebase.

## Testing

Tests live in `tests/*.test.mjs` and run under `node --test`. Keep the sim
importable without a DOM. `tests/browser_integration.html` is for manual browser
checks via the served page.

## Memory

- **Durable memory** lives here (`AGENTS.md`): conventions, architecture, "how
  we do things". Edit when a decision changes.
- **Episodic memory** lives in `MEMORY.md`: a dated, append-only log of what each
  session did/decided/left open. Both are auto-loaded via `opencode.json`
  `instructions`.
- **Standing rule:** after any non-trivial change, append a dated entry to
  `MEMORY.md` (newest first) so the next session/agent inherits context. Keep it
  to 1–2 lines: what changed, why, or what's left open.
