import {
  PLAQUES_KEY,
  PLAQUE,
  loadPlaques,
  savePlaques,
  unlockPlaques,
} from "../src/app/plaques.js";

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

function mapStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

// ---- constants ----
check("PLAQUES_KEY is nb.plaques.v1", PLAQUES_KEY === "nb.plaques.v1", PLAQUES_KEY);
check(
  "PLAQUE bits: CLEAR=1 PLUS=2 MAX=4 CROWN=8",
  PLAQUE.CLEAR === 1 && PLAQUE.PLUS === 2 && PLAQUE.MAX === 4 && PLAQUE.CROWN === 8,
  JSON.stringify(PLAQUE),
);
check("PLAQUE is frozen", Object.isFrozen(PLAQUE));

// ---- load defaults ----
check("loadPlaques with no store returns 0", loadPlaques({}) === 0);
check(
  "loadPlaques with a store missing getItem returns 0",
  loadPlaques({ setItem() {} }) === 0,
);
{
  const st = mapStore();
  check("loadPlaques on empty store returns 0", loadPlaques(st) === 0);
}

// ---- save/load round trip ----
{
  const st = mapStore();
  savePlaques(15, st);
  check(
    "save/load round trip (all four bits)",
    loadPlaques(st) === 15,
    loadPlaques(st),
  );
}
{
  const st = mapStore();
  savePlaques(PLAQUE.CLEAR | PLAQUE.MAX, st);
  check(
    "save/load round trip (CLEAR|MAX)",
    loadPlaques(st) === (PLAQUE.CLEAR | PLAQUE.MAX),
    loadPlaques(st),
  );
}
{
  // clamp out-of-range stored values into 0..15
  const st = mapStore();
  st.setItem(PLAQUES_KEY, "31");
  check("loadPlaques clamps stray bits to 0..15", loadPlaques(st) === 15);
}
{
  // corrupt/non-numeric stored value -> 0
  const st = mapStore();
  st.setItem(PLAQUES_KEY, "nope");
  check("loadPlaques on corrupt value returns 0", loadPlaques(st) === 0);
}

// ---- unlockPlaques: exact scenarios from the plan ----
{
  // L5 CORE world -> CLEAR only
  const world = { level: 5, heat: 0, finale: true };
  check(
    "L5 CORE finale -> CLEAR only",
    unlockPlaques(0, world) === PLAQUE.CLEAR,
    unlockPlaques(0, world),
  );
}
{
  // L5 PLUS -> CLEAR|PLUS
  const world = { level: 5, heat: 1, finale: true };
  check(
    "L5 PLUS finale -> CLEAR|PLUS",
    unlockPlaques(0, world) === (PLAQUE.CLEAR | PLAQUE.PLUS),
    unlockPlaques(0, world),
  );
}
{
  // L8 MAX -> all four
  const world = { level: 8, heat: 2, finale: true };
  check(
    "L8 MAX finale -> all four",
    unlockPlaques(0, world) === 15,
    unlockPlaques(0, world),
  );
}
{
  // L3 PLUS death -> nothing (mask unchanged)
  const world = { level: 3, heat: 1, finale: false };
  check(
    "L3 PLUS death -> mask unchanged",
    unlockPlaques(0, world) === 0,
    unlockPlaques(0, world),
  );
  check(
    "L3 PLUS death -> a pre-existing mask stays unchanged too",
    unlockPlaques(PLAQUE.CLEAR, world) === PLAQUE.CLEAR,
    unlockPlaques(PLAQUE.CLEAR, world),
  );
}
{
  // isFinale(level) alone (without an explicit finale flag) still grants CLEAR
  const world = { level: 5, heat: 0 };
  check(
    "L5 without an explicit finale flag still reads isFinale(level)",
    unlockPlaques(0, world) === PLAQUE.CLEAR,
    unlockPlaques(0, world),
  );
}
{
  // accumulation: OR'd onto an existing mask, never clears earlier bits
  const world = { level: 8, heat: 2, finale: true };
  check(
    "unlock accumulates onto an existing mask (idempotent OR)",
    unlockPlaques(PLAQUE.CLEAR, world) === 15,
    unlockPlaques(PLAQUE.CLEAR, world),
  );
}
{
  // CROWN needs level>=8 regardless of heat
  const world = { level: 8, heat: 0, finale: true };
  check(
    "L8 CORE finale still grants CROWN (level>=8) plus CLEAR only",
    unlockPlaques(0, world) === (PLAQUE.CLEAR | PLAQUE.CROWN),
    unlockPlaques(0, world),
  );
}

console.log("\n  PLAQUES RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
