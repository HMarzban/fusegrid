import { step, createWorld, newIntent, loadLevel } from "../src/core/sim.js";
import { HEAT, heatRoster, heatProfile, heatScore } from "../src/core/heat.js";
import { PACT, applyPact } from "../src/core/pact.js";
import { CFG, T, key, ROOM_LOCK, ROOM_MAX, isFinale, roomCap } from "../src/core/config.js";
import { winHeadline } from "../src/render/scenes.js";
import { scoreEntry } from "../src/app/highscores.js";
import { PACT_KEY, loadPactUnlocked, savePactUnlocked } from "../src/app/pactstore.js";
import { readFileSync } from "node:fs";

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

check("ROOM_LOCK/MAX are 5/8", ROOM_LOCK === 5 && ROOM_MAX === 8);
check(
  "isFinale L5 and L8 only",
  isFinale(5) &&
    isFinale(8) &&
    isFinale(9) &&
    !isFinale(1) &&
    !isFinale(4) &&
    !isFinale(6) &&
    !isFinale(7),
);
check("roomCap locked 5 unlocked 8", roomCap(false) === 5 && roomCap(true) === 8);
check(
  "winHeadline L6/L7 are room clears",
  winHeadline({ level: 6, finale: false }) === "LEVEL 6 CLEARED" &&
    winHeadline({ level: 7, finale: false }) === "LEVEL 7 CLEARED",
);
check(
  "winHeadline L5/L8 are FUSE/GRID CLEAR",
  winHeadline({ level: 5, finale: false }) === "FUSE/GRID CLEAR" &&
    winHeadline({ level: 8, finale: false }) === "FUSE/GRID CLEAR",
);
check(
  "winHeadline finale latch wins",
  winHeadline({ level: 6, finale: true }) === "FUSE/GRID CLEAR",
);

check("heatScore CORE 1200 stays 1200", heatScore(1200, 0) === 1200);
check("heatScore PLUS 1200 -> 2400", heatScore(1200, 1) === 2400);
check("heatScore MAX 1200 -> 3600", heatScore(1200, 2) === 3600);
check("heatScore clamps junk heat to CORE", heatScore(1200, -3) === 1200);
check("heatScore clamps 99 heat to MAX", heatScore(1200, 99) === 3600);

{
  const e = scoreEntry({ score: 1234, level: 3, heat: 0 }, "2026-09-02");
  const m = scoreEntry({ score: 1234, level: 1, heat: 2 }, "2026-09-02");
  check(
    "scoreEntry CORE keeps raw; MAX triples",
    e.s === 1234 && e.l === 3 && e.d === "2026-09-02" && !("t" in e) &&
      m.s === 3702 && m.t === 2,
    JSON.stringify({ e, m }),
  );
}

check(
  "R20 CORE roster L1-5",
  heatRoster(1, 0).join() === "walker,walker,stationary" &&
    heatRoster(2, HEAT.CORE).join() === "walker,walker,fast,stationary" &&
    heatRoster(5, 0).includes("rocket"),
);
check(
  "R20 PLUS introduces next foe; L1 frozen",
  heatRoster(1, HEAT.PLUS).join() === "walker,walker,stationary" &&
    heatRoster(2, HEAT.PLUS).includes("chaser") &&
    !heatRoster(2, HEAT.PLUS).includes("boomerang") &&
    heatRoster(5, HEAT.PLUS).filter((t) => t === "chaser").length === 2,
);
check(
  "R20 MAX L2 uses L3 roster; pass stays out of L1-2",
  heatRoster(2, HEAT.MAX).join() === heatRoster(3, 0).join() &&
    !heatRoster(2, HEAT.MAX).includes("boomerang") &&
    heatRoster(4, HEAT.MAX).includes("rocket") &&
    heatRoster(5, HEAT.MAX).filter((t) => t === "boomerang").length === 2,
);
check(
  "R22 extra rooms reuse L5 roster plus new foes",
  heatRoster(6, 0).filter((t) => t === "fast").length ===
    heatRoster(5, 0).filter((t) => t === "fast").length + 1 &&
    heatRoster(8, 0).includes("rocket") &&
    heatRoster(5, 0).join() ===
      "walker,chaser,fast,stationary,boomerang,rocket",
);

{
  const a = createWorld(20260823, 1);
  loadLevel(a, 1, false);
  const b = createWorld(20260823, 1);
  b.heat = 0;
  loadLevel(b, 1, false);
  check(
    "R20 CORE heat=0 matches omitted heat (grid+roster+fuse+lives)",
    a.fuse === CFG.FUSE &&
      a.lives === 3 &&
      a.enemies.map((e) => e.type).join() ===
        b.enemies.map((e) => e.type).join() &&
      [...a.grid].every((v, i) => v === b.grid[i]),
  );
  const plus = createWorld(20260823, 2);
  plus.heat = HEAT.PLUS;
  loadLevel(plus, 2, false);
  check(
    "R20 PLUS L2 has chaser and fuse 2.3",
    plus.enemies.some((e) => e.type === "chaser") &&
      plus.fuse === 2.3 &&
      plus.lives === 3,
    plus.enemies.map((e) => e.type).join(),
  );
  const mx = createWorld(7, 1);
  mx.heat = HEAT.MAX;
  loadLevel(mx, 1, false);
  const teach = ["fire", "bomb"].every((t) =>
    mx.items.some((it) => it.buried && it.t === t),
  );
  check(
    "R20 MAX L1 still teaches fire+bomb; 2 lives; fuse 2.1",
    teach && mx.lives === 2 && mx.fuse === 2.1 && heatProfile(2).carve === 0.24,
  );
}

{
  const last = createWorld(9, 1);
  last.pact = PACT.LAST;
  loadLevel(last, 1, false);
  check("R21 LAST fresh run is 1 life", last.lives === 1 && last.pact === PACT.LAST);
  last.lives = 2;
  loadLevel(last, 2, true);
  check("R21 LAST carry keeps lives on WIN→next", last.lives === 2);
  const bare = createWorld(9, 1);
  bare.pact = PACT.BARE;
  loadLevel(bare, 1, false);
  check(
    "R21 BARE drops all floor cubes",
    bare.items.filter((it) => !it.buried).length === 0,
  );
  const thin = createWorld(9, 1);
  thin.pact = PACT.THIN;
  loadLevel(thin, 1, false);
  const base = createWorld(9, 1);
  loadLevel(base, 1, false);
  check(
    "R21 THIN buries one fewer cube (min 3)",
    thin.items.filter((it) => it.buried).length ===
      base.items.filter((it) => it.buried).length - 1 &&
      thin.items.filter((it) => it.buried).length >= 3,
  );
  const sh = createWorld(3, 1);
  sh.pact = PACT.SHRINK;
  loadLevel(sh, 1, false);
  sh.state = "PLAY";
  check("R21 SHRINK arms 25s clock", sh.shrinkT === 25 && sh.shrinkGen === 0);
  const k12 = key(1, 2);
  for (let i = 0; i < 1510; i++) step(sh, CFG.STEP, { 0: newIntent() });
  check(
    "R21 SHRINK closes rim after 25s; spawn stays EMPTY",
    sh.grid[k12] === T.WALL &&
      sh.grid[key(1, 1)] === T.EMPTY &&
      sh.shrinkGen === 1,
    "gen=" + sh.shrinkGen + " (1,2)=" + sh.grid[k12],
  );
}

{
  const P = heatProfile(0);
  const last = applyPact(P, PACT.LAST);
  const thin = applyPact(P, PACT.THIN);
  const bare = applyPact(P, PACT.BARE);
  const shrink = applyPact(P, PACT.SHRINK);
  check(
    "applyPact LAST/THIN/BARE/SHRINK",
    last.lives === 1 &&
      thin.buriedAdd === P.buriedAdd - 1 &&
      bare.bare === true &&
      shrink.shrinkT === 25 &&
      applyPact(P, 0).shrinkT === 0 &&
      P.lives === 3,
  );
}

{
  const src = readFileSync(new URL("../src/core/pact.js", import.meta.url), "utf8");
  check(
    "pact.js has no localStorage persist",
    !src.includes("localStorage") && !src.includes("PACT_KEY"),
  );
  const st = {
    m: new Map(),
    getItem(k) {
      return this.m.has(k) ? this.m.get(k) : null;
    },
    setItem(k, v) {
      this.m.set(k, String(v));
    },
  };
  check("loadPactUnlocked empty is false", loadPactUnlocked(st) === false);
  check("savePactUnlocked writes nb.pact.v1=1", savePactUnlocked(st) === true && st.getItem(PACT_KEY) === "1");
  check("loadPactUnlocked after save", loadPactUnlocked(st) === true);
}

console.log("\n  HEAT RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
