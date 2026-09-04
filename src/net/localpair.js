/* ?net=local dev aid: world A stays the live game world; a mirror peer B
   (same seed) runs the same lockstep protocol over crossed LocalTransports.
   B is driven by a deterministic script so both peers keep stepping.
   This is a LOCAL two-world proof, never internet play — step() still
   consumes inputs[0] / players[0] only. Flag off = default path untouched. */
import { CFG } from "../core/config.js";
import { createWorld, loadLevel } from "../core/sim.js";
import { createLockstep } from "./lockstep.js";
import { LocalTransport } from "./transport.js";

export function createLocalPair(world, input) {
  const wB = createWorld(world.seed, 1);
  loadLevel(wB, 1, false);
  wB.state = "PLAY";
  let lsA = null,
    lsB = null;
  const tA = new LocalTransport((m) => {
    if (lsB) lsB.handleMessage(m);
  });
  const tB = new LocalTransport((m) => {
    if (lsA) lsA.handleMessage(m);
  });
  lsA = createLockstep({
    selfPid: 0,
    world,
    transport: tA,
    dt: CFG.STEP,
    players: [0, 1],
  });
  lsB = createLockstep({
    selfPid: 1,
    world: wB,
    transport: tB,
    dt: CFG.STEP,
    players: [0, 1],
  });
  let bf = 0;
  return {
    lsA,
    lsB,
    wB,
    drive() {
      lsA.pushIntent(input.intent());
      input.advance();
      const m = [
        { x: 0, y: -1 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
      ][bf % 4];
      lsB.pushIntent({
        move: m,
        fire: bf % 19 === 0,
        shift: bf % 41 === 0,
        remote: bf % 97 === 0,
        kick: false,
      });
      bf++;
      lsA.tick();
      lsB.tick();
    },
  };
}
