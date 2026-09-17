# How Fusegrid works

Fusegrid runs as static ES modules with no build step or npm runtime dependencies. The browser owns input and presentation; the simulation is importable directly in Node.

## One simulation, two views

[`src/main.js`](../src/main.js) collects intents, advances an accumulator in fixed [`CFG.STEP`](../src/core/config.js) increments, and renders the resulting world. [`step`](../src/core/sim.js) changes that world using seeded randomness from [`rng.js`](../src/core/rng.js), with no DOM or wall clock in the core. This makes a recorded seed and input sequence reproducible without starting a browser.

Canvas 2D and WebGL 3D read the same simulation state. Three.js is vendored and loaded only for the 3D renderer. Keeping rendering separate allows a visual change without changing game rules, though GPU output and visual readability still need browser checks. The shell state machine owns menus; pause, win, and loss belong to the world.

## Evidence and limits

- [Determinism tests](../tests/determinism.test.mjs) replay mixed input over 1,800 ticks and compare state across worlds and seeds.
- [Lockstep tests](../tests/net_lockstep.test.mjs) exercise the local synchronization protocol. The [`?net=local` harness](../src/net/localpair.js) drives two worlds, but the simulation still consumes player zero. Internet multiplayer would require actual multiplayer simulation, session ownership, disconnect/rejoin policy, and network testing.
- The tests in [`tests/`](../tests/) also cover storage, menus, rendering contracts, and the PWA shell. `npm test` is a deployment gate; it does not establish visual correctness on every browser or GPU.

## Persistence and offline play

Progress and personal records live in browser local storage. They are local to that browser and can be cleared; there is no account or server record. Daily boards and challenge codes reproduce a board, not a verified score.

The [service worker](../sw.js) precaches the versioned [app shell](../src/pwa/shell.js), including the vendored 3D library. A successful online first visit is needed before offline use. Cache updates use a new version and reload after the new worker takes control. First-time offline loading and synchronizing progress between devices are outside this design.
