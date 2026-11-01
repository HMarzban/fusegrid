/* ?net=local dev aid: world A stays the live game world; a mirror peer B
   runs the same lockstep protocol over crossed LocalTransports. B is driven by
   a deterministic script so both peers keep stepping. This is a LOCAL
   two-world proof, never internet play — step() still consumes inputs[0] /
   players[0] only. Flag off = default path untouched.
   B follows the real run with no hook in main: a new A grid that no tick made
   is a run start (onStart, PAUSE RESTART), so B takes A's knobs and deals the
   board itself, never a copy of it. A room change or the GAME OVER restart
   happens inside step(), so each world does its own, on the seed B was handed. */
import { CFG } from "../core/config.js";
import { createWorld, loadLevel } from "../core/sim.js";
import { createLockstep } from "./lockstep.js";
import { LocalTransport } from "./transport.js";

export function createLocalPair(world, input) {
  const wB = createWorld(world.seed, world.level);
  const follow = () => {
    wB.seed = world.seed;
    wB.gen = world.gen;
    wB.heat = world.heat;
    wB.pact = world.pact;
    wB.pace = world.pace;
    loadLevel(wB, world.level, false);
    wB.state = world.state;
    wB.fireEdge = world.fireEdge;
  };
  follow();
  let gridA = world.grid;
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
      if (world.grid !== gridA) follow();
      // all the shell writes on A between ticks: the re-armed seed, PAUSE, RESUME's held-fire guard
      wB.nextSeed = world.nextSeed;
      if (world.state === "PAUSE") wB.state = "PAUSE";
      else if (wB.state === "PAUSE") {
        wB.state = world.state;
        wB.fireEdge = world.fireEdge;
      }
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
      });
      bf++;
      lsA.tick();
      lsB.tick();
      gridA = world.grid;
    },
  };
}
