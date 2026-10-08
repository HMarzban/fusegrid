import {
  MEDALS_KEY,
  MEDAL,
  MEDAL_ROWS,
  SPRINT_S,
  loadMedals,
  saveMedals,
  unlockMedals,
  settleMedals,
  medalLine,
  medalRows,
} from "../src/app/medals.js";
import { PLAQUES_KEY } from "../src/app/plaques.js";

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
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

// ---- 1. store ----
check("MEDALS_KEY is nb.medals.v1", MEDALS_KEY === "nb.medals.v1", MEDALS_KEY);
check(
  "MEDAL bits are frozen, one per bit, in the spec's order",
  Object.isFrozen(MEDAL) &&
    MEDAL.FLAWLESS === 1 && MEDAL.UNSCATHED === 2 && MEDAL.ALLIN === 4 &&
    MEDAL.ALLOUT === 8 && MEDAL.OVERDRIVE === 16 && MEDAL.REDLINE === 32 &&
    MEDAL.SPRINT === 64 && MEDAL.IRONCROWN === 128,
  JSON.stringify(MEDAL),
);
check("SPRINT_S is the measured 180", SPRINT_S === 180, String(SPRINT_S));
{
  const s = mapStore();
  saveMedals(255, s);
  check("round trip 255", loadMedals(s) === 255, String(loadMedals(s)));
  s.setItem(MEDALS_KEY, "999");
  check('"999" loads as 999 & 255', loadMedals(s) === (999 & 255), String(loadMedals(s)));
  s.setItem(MEDALS_KEY, "junk");
  check("junk loads as 0", loadMedals(s) === 0, String(loadMedals(s)));
  check("absent loads as 0", loadMedals(mapStore()) === 0);
  check("a store missing getItem loads 0", loadMedals({ setItem() {} }) === 0);
  const thrower = {
    getItem() { throw new Error("x"); },
    setItem() { throw new Error("x"); },
  };
  let threw = false;
  try {
    check("a throwing store loads 0", loadMedals(thrower) === 0);
    saveMedals(5, thrower);
  } catch (_) {
    threw = true;
  }
  check("save on a throwing store does not throw", !threw);
  saveMedals(300, s);
  check("save masks to & 255", s.getItem(MEDALS_KEY) === String(300 & 255), s.getItem(MEDALS_KEY));
}

// ---- 2. one unlock pin and one no-unlock pin per medal ----
const W = (o) => ({ state: "WIN", level: 5, heat: 0, pact: 0, pace: 0, ...o });
const T = (o) => ({ r: 5, d: 0, kt: {}, ...o });
const has = (w, t, runT, bit) => (unlockMedals(w, t, runT == null ? 999 : runT) & bit) !== 0;
const L8 = (o) => W({ level: 8, ...o });
const T8 = (o) => T({ r: 3, ...o });
const cases = [
  ["FLAWLESS unlocks: L5 WIN, r 5, d 0", has(W(), T(), 999, MEDAL.FLAWLESS)],
  ["FLAWLESS not with d 1", !has(W(), T({ d: 1 }), 999, MEDAL.FLAWLESS)],
  ["FLAWLESS not with r 1 (a LEVEL SELECT start at 5)", !has(W(), T({ r: 1 }), 999, MEDAL.FLAWLESS)],
  ["UNSCATHED unlocks: L8 WIN, r 3, d 0", has(L8(), T8(), 999, MEDAL.UNSCATHED)],
  ["UNSCATHED not with d 1", !has(L8(), T8({ d: 1 }), 999, MEDAL.UNSCATHED)],
  ["UNSCATHED not with r 1 (a start at 8)", !has(L8(), T8({ r: 1 }), 999, MEDAL.UNSCATHED)],
  ["ALL IN unlocks: L5 WIN, r 5, pact 15", has(W({ pact: 15 }), T(), 999, MEDAL.ALLIN)],
  ["ALL IN not with pact 14", !has(W({ pact: 14 }), T(), 999, MEDAL.ALLIN)],
  ["ALL IN not on a LOSE with pact 15", !has(W({ state: "LOSE", pact: 15 }), T(), 999, MEDAL.ALLIN)],
  ["ALL IN not on L8 WIN, r 3, pact 15 (that is ALL OUT)", !has(L8({ pact: 15 }), T8(), 999, MEDAL.ALLIN)],
  ["ALL OUT unlocks: L8 WIN, r 3, pact 15", has(L8({ pact: 15 }), T8(), 999, MEDAL.ALLOUT)],
  ["ALL OUT not with pact 14", !has(L8({ pact: 14 }), T8(), 999, MEDAL.ALLOUT)],
  ["ALL OUT not on L5 WIN, r 5, pact 15 (that is ALL IN)", !has(W({ pact: 15 }), T(), 999, MEDAL.ALLOUT)],
  ["ALL OUT not with r 1 (a start at 8)", !has(L8({ pact: 15 }), T8({ r: 1 }), 999, MEDAL.ALLOUT)],
  ["OVERDRIVE unlocks: L5 WIN, r 5, pace 1", has(W({ pace: 1 }), T(), 999, MEDAL.OVERDRIVE)],
  ["OVERDRIVE not with pace 0", !has(W({ pace: 0 }), T(), 999, MEDAL.OVERDRIVE)],
  ["REDLINE unlocks: L8 WIN, r 3, pace 1", has(L8({ pace: 1 }), T8(), 999, MEDAL.REDLINE)],
  ["REDLINE not on L5 WIN, r 5, pace 1 (that is OVERDRIVE)", !has(W({ pace: 1 }), T(), 999, MEDAL.REDLINE)],
  ["SPRINT unlocks: L5 WIN, r 5, h0/p0/pace0, runT 179.9", has(W(), T(), 179.9, MEDAL.SPRINT)],
  ["SPRINT not at runT 180.0", !has(W(), T(), 180.0, MEDAL.SPRINT)],
  ["SPRINT not at heat 1 even at 120", !has(W({ heat: 1 }), T(), 120, MEDAL.SPRINT)],
  ["SPRINT not with pact 1 even at 120", !has(W({ pact: 1 }), T(), 120, MEDAL.SPRINT)],
  ["SPRINT not on HARD pace even at 120", !has(W({ pace: 1 }), T(), 120, MEDAL.SPRINT)],
  ["SPRINT not on EASY pace even at 120", !has(W({ pace: -1 }), T(), 120, MEDAL.SPRINT)],
  ["IRON CROWN unlocks: L8 WIN, r 3, heat 2", has(L8({ heat: 2 }), T8(), 999, MEDAL.IRONCROWN)],
  ["IRON CROWN not with heat 1", !has(L8({ heat: 1 }), T8(), 999, MEDAL.IRONCROWN)],
  ["IRON CROWN not on L5 WIN, r 5, heat 2 (that is PLAQUE.MAX)", !has(W({ heat: 2 }), T(), 999, MEDAL.IRONCROWN)],
  ["IRON CROWN not on L8 WIN, r 1, heat 2 (a room-8 start)", !has(L8({ heat: 2 }), T8({ r: 1 }), 999, MEDAL.IRONCROWN)],
];
for (const [n, ok] of cases) check(n, ok);
check(
  "a LOSE at L8 with r 2, d 0, pact 15, pace 1, heat 2 and a knight kill unlocks nothing",
  unlockMedals(
    { state: "LOSE", level: 8, heat: 2, pact: 15, pace: 1 },
    { r: 2, d: 0, kt: { knight: 1 } },
    60,
  ) === 0,
);
check(
  "a mid-room WIN (L3) unlocks nothing",
  unlockMedals(W({ level: 3 }), T({ r: 3 }), 10) === 0,
);
check(
  "unlockMedals never throws on empty input",
  unlockMedals(null, null, 0) === 0 && unlockMedals({}, {}, 0) === 0,
);

// ---- 3. settleMedals: the read-back is the announcement ----
{
  const s = mapStore();
  const w = L8({ heat: 2 }), t = T8({ d: 1 });
  const got = settleMedals(w, t, 400, s);
  check("settle returns only newly set bits", got === MEDAL.IRONCROWN, String(got));
  check("settle persisted the bit", loadMedals(s) === MEDAL.IRONCROWN, String(loadMedals(s)));
  check("a second identical settle returns 0", settleMedals(w, t, 400, s) === 0);
  const got2 = settleMedals(L8({ heat: 2 }), T8(), 400, s);
  check(
    "a later settle announces only the bit that was not there before",
    got2 === MEDAL.UNSCATHED && loadMedals(s) === (MEDAL.UNSCATHED | MEDAL.IRONCROWN),
    got2 + "/" + loadMedals(s),
  );
  check("nb.plaques.v1 is untouched by every medal call", !s.m.has(PLAQUES_KEY));
  const quiet = mapStore();
  settleMedals(W({ state: "LOSE" }), T(), 10, quiet);
  check("a settle that unlocks nothing never writes the key", !quiet.m.has(MEDALS_KEY));
  const ro = {
    getItem: () => null,
    setItem() { throw new Error("quota"); },
  };
  check(
    "with a throwing setItem settle returns 0 (no announcement without persistence)",
    settleMedals(L8({ heat: 2 }), T8(), 400, ro) === 0,
  );
  check("a null store is a silent 0", settleMedals(L8({ heat: 2 }), T8(), 400, null) === 0);
}

// ---- 4. medalLine: four forms, each fits at 15px ----
{
  const fit = (s) => [...s].length * 15 * 0.6 <= 552;
  const one = medalLine(MEDAL.IRONCROWN);
  const three = medalLine(MEDAL.UNSCATHED | MEDAL.REDLINE | MEDAL.IRONCROWN);
  const four = medalLine(MEDAL.UNSCATHED | MEDAL.ALLOUT | MEDAL.REDLINE | MEDAL.IRONCROWN);
  check("medalLine(0) is empty", medalLine(0) === "");
  check("one bit is MEDAL · NAME", one === "MEDAL · IRON CROWN", one);
  check(
    "two bits list in bit order",
    medalLine(MEDAL.IRONCROWN | MEDAL.FLAWLESS) === "MEDALS · FLAWLESS · IRON CROWN",
    medalLine(MEDAL.IRONCROWN | MEDAL.FLAWLESS),
  );
  check(
    "three bits is the longest named form",
    three === "MEDALS · UNSCATHED · REDLINE · IRON CROWN",
    three,
  );
  check("four or more bits is a plain count", four === "4 NEW MEDALS", four);
  check("all four forms fit 552px at 15px x 0.6em", [one, three, four].every(fit), [one, three, four].join(" | "));
}

// ---- 5. medalRows: the trophy page's finished strings ----
{
  const rows = medalRows(MEDAL.SPRINT | MEDAL.FLAWLESS);
  const names = rows.map((r) => r[0]);
  check("medalRows returns 8 rows", rows.length === 8 && MEDAL_ROWS.length === 8);
  check("names are unique", new Set(names).size === 8, names.join("|"));
  check(
    "names are the eight medals in bit order",
    names.join("|") === "FLAWLESS|UNSCATHED|ALL IN|ALL OUT|OVERDRIVE|REDLINE|SPRINT|IRON CROWN",
    names.join("|"),
  );
  check(
    "descriptions are <= 46 chars",
    rows.every((r) => typeof r[1] === "string" && r[1].length > 0 && [...r[1]].length <= 46),
    rows.map((r) => [...r[1]].length).join(","),
  );
  check(
    "the on flag follows the mask bit for bit",
    rows.every((r, i) => r[2] === ((((MEDAL.SPRINT | MEDAL.FLAWLESS) >> i) & 1) === 1)),
    rows.map((r) => r[2]).join(","),
  );
  check("medalRows(junk) is all locked", medalRows(undefined).every((r) => r[2] === false));
}

console.log("\n  MEDALS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
