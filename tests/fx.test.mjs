import { CFG } from "../src/core/config.js";
import { comboOf, comboLabel, nearMissOf } from "../src/render/fx.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") +
      name +
      (detail !== undefined ? " -> " + detail : ""),
  );
}

/* Tile centres are (t + 0.5) * TILE, so tile 5 centres at 220px. Every dmin
   below is a Chebyshev distance from the player point to a blade tile CENTRE,
   which is the same geometry sim.js:342's aabb call tests. */
const ctr = (t) => (t + 0.5) * CFG.TILE;
const blade = (...tiles) => ({ tiles: tiles.map(([tx, ty]) => ({ tx, ty })) });
const mkW = (px, py, blades, events, over) => ({
  state: "PLAY",
  seed: 1,
  level: 1,
  players: [Object.assign({ alive: true, iFrames: 0, x: px, y: py }, over || {})],
  blades: blades || [],
  events: events || [],
});

// ---- 1. comboOf: the boom gate is the discriminator ----
{
  const kills = Object.freeze([
    Object.freeze({ t: "kill" }),
    Object.freeze({ t: "kill" }),
    Object.freeze({ t: "kill" }),
  ]);
  check(
    "comboOf: a boom-free batch is blade attrition, scores 0",
    comboOf(kills) === 0,
    comboOf(kills),
  );
  const chain = Object.freeze(kills.concat([Object.freeze({ t: "boom" })]));
  check(
    "comboOf: 3 kills that arrive with a boom are a 3-combo",
    comboOf(chain) === 3,
    comboOf(chain),
  );
  check(
    "comboOf: a boom with no kills is 0",
    comboOf([{ t: "boom" }]) === 0 && comboOf([{ t: "boom" }, { t: "brick" }]) === 0,
  );
  check(
    "comboOf: deep-frozen input, no throw and no mutation",
    kills.length === 3 && chain.length === 4 && comboOf(kills) === 0,
  );
  check(
    "comboOf: junk input is 0, never a throw",
    comboOf(null) === 0 && comboOf(undefined) === 0 && comboOf([]) === 0,
  );
}

// ---- 2. comboLabel: the locked tier copy ----
{
  const want = [
    [0, ""],
    [1, ""],
    [2, "DOUBLE"],
    [3, "TRIPLE"],
    [4, "QUAD"],
    [5, "CHAIN ×5"],
    [11, "CHAIN ×11"],
  ];
  const bad = want.filter(([n, s]) => comboLabel(n) !== s);
  check(
    "comboLabel: 1 silent, 2 DOUBLE, 3 TRIPLE, 4 QUAD, >=5 CHAIN ×n",
    !bad.length,
    JSON.stringify(bad.map(([n]) => [n, comboLabel(n)])),
  );
}

// ---- 3. nearMissOf: a Chebyshev annulus, 32 < dmin <= 44 ----
{
  check(
    "nearMissOf: dmin 0 (standing in the blast) is not a near miss",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([5, 5])])) === false,
  );
  check(
    "nearMissOf: dmin 32 is a HIT (the aabb envelope), not a near miss",
    nearMissOf(mkW(228, ctr(5), [blade([6, 5])])) === false,
  );
  check(
    "nearMissOf: dmin 40 (one aligned tile away) is a near miss",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])])) === true,
  );
  check(
    "nearMissOf: dmin 44 is the outer bound, still a near miss",
    nearMissOf(mkW(216, ctr(5), [blade([6, 5])])) === true,
  );
  check(
    "nearMissOf: dmin 48 is just a blast somewhere, not a near miss",
    nearMissOf(mkW(212, ctr(5), [blade([6, 5])])) === false,
  );
  check(
    "nearMissOf: iFrames > 0 disqualifies",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [], { iFrames: 0.5 })) === false,
  );
  check(
    "nearMissOf: a dead player disqualifies",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [], { alive: false })) === false,
  );
  check(
    "nearMissOf: a {t:'hurt'} in the batch disqualifies (the shielded hit)",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [{ t: "hurt" }])) === false,
  );
  check(
    "nearMissOf: no blades, no near miss",
    nearMissOf(mkW(ctr(5), ctr(5), [])) === false &&
      nearMissOf(mkW(ctr(5), ctr(5), [{ tiles: [] }])) === false,
  );
  /* The MINIMUM over all blades is what stops a player standing inside one
     blast from being congratulated for a second one next door: tile (8,4)
     centres 40 away (dx 20, dy 40) and alone reads as a near miss; tile (8,5)
     centres 20 away and kills it. */
  check(
    "nearMissOf: a single blade at dmin 40 reads as a near miss",
    nearMissOf(mkW(320, ctr(5), [blade([8, 4])])) === true,
  );
  check(
    "nearMissOf: a second blade at dmin 20 takes the minimum and disqualifies",
    nearMissOf(mkW(320, ctr(5), [blade([8, 4]), blade([8, 5])])) === false,
  );
  check(
    "nearMissOf: events defaults to world.events, and the explicit arg wins",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [{ t: "hurt" }])) === false &&
      nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [{ t: "hurt" }]), []) === true,
  );
  const w = mkW(ctr(5), ctr(5), [blade([6, 5])]);
  const before = JSON.stringify(w);
  nearMissOf(w);
  check("nearMissOf: pure — the world is not mutated", JSON.stringify(w) === before);
}

console.log("\n  FX RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
