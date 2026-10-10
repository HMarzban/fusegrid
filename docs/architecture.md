# How Fusegrid works

Fusegrid runs as static ES modules with no build step or npm runtime dependencies. The browser owns input and presentation; the simulation is importable directly in Node.

## One simulation, two views

[`src/main.js`](../src/main.js) collects intents, advances an accumulator in fixed [`CFG.STEP`](../src/core/config.js) increments, and renders the resulting world. [`step`](../src/core/sim.js) changes that world using seeded randomness from [`rng.js`](../src/core/rng.js), with no DOM or wall clock in the core. This makes a recorded seed and input sequence reproducible without starting a browser.

Canvas 2D and WebGL 3D read the same simulation state. Three.js is vendored and loaded only for the 3D renderer. Keeping rendering separate allows a visual change without changing game rules, though GPU output and visual readability still need browser checks. The shell state machine owns menus; pause, win, and loss belong to the world.

The 3D renderer works to a fixed draw-call budget of 500; the tests' fully populated room draws 141. Repeated things are instanced, so cost does not grow with what is on screen. Every live blast shares two draws in [`blast.js`](../src/render/three/blast.js): an additive danger plate on each deadly tile, which tells the same tile-accurate truth as the 2D square, and one batch of shader-shaded fireballs that adds volume on top of it.

## Browser edges: audio and touch

Browsers only start sound from a user gesture, so the game's audio context is created inside the first press ([`unlock.js`](../src/app/unlock.js)). Until that context is actually running, sound effects are dropped rather than queued, because a queued sound would play late or stacked once the clock starts. The first audio context a browser session creates also spends tens of milliseconds bringing up the device, so [`audio.js`](../src/audio.js) pays that once at boot with a throwaway context and the first press does not stutter. A touch `pointerdown` does not count as a gesture for these rules, so anything a tap must unlock, such as copying STATS to the clipboard, runs on `pointerup`.

One JavaScript predicate picks the layout: [`fit.js`](../src/app/fit.js) writes `body[data-lay]` as desktop, touch portrait, or touch landscape, and the page styles key off that rather than a CSS media query. A portrait phone has spare height, so the stage is centred on menu screens and slides up under the pause button during play, giving the touch controls a larger thumb area below. The geometry is a pure function tested in Node; how it feels in the hand still needs a real phone.

## Evidence and limits

- [Determinism tests](../tests/determinism.test.mjs) replay mixed input over 1,800 ticks and compare state across worlds and seeds.
- [Lockstep tests](../tests/net_lockstep.test.mjs) exercise the local synchronization protocol. The [`?net=local` harness](../src/net/localpair.js) drives two worlds, but the simulation still consumes player zero. Internet multiplayer would require actual multiplayer simulation, session ownership, disconnect/rejoin policy, and network testing.
- The tests in [`tests/`](../tests/) also cover storage, menus, rendering contracts, and the PWA shell. `npm test` is a deployment gate; it does not establish visual correctness on every browser or GPU.

## Persistence and offline play

Progress and personal records live in browser local storage. They are local to that browser and can be cleared; there is no account or server record. Daily boards and challenge codes reproduce a board, not a verified score. When STATS or a run summary copies text, the screen says COPIED or COPY FAILED only after the clipboard has accepted or refused it.

The [service worker](../sw.js) precaches the versioned [app shell](../src/pwa/shell.js), including the vendored 3D library. A successful online first visit is needed before offline use. Cache updates use a new version and reload after the new worker takes control. First-time offline loading and synchronizing progress between devices are outside this design.
