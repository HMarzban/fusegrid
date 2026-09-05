import {
  CABINET_KEY,
  loadCabinetSeen,
  saveCabinetSeen,
} from "../src/app/cabinetseen.js";
import { SCREEN, createMenuApp } from "../src/app/menuapp.js";

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

// ---- store round-trip (mirrors coach.js / pactstore.js "1"-flag pattern) ----
check("CABINET_KEY is nb.cabinet.v1", CABINET_KEY === "nb.cabinet.v1");

const mem = new Map();
const store = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
};
check("unseen store loads false", loadCabinetSeen(store) === false);
saveCabinetSeen(store);
check("round-trip: seen after save", loadCabinetSeen(store) === true);
check(
  "persisted value is the literal '1' flag",
  mem.get(CABINET_KEY) === "1",
  mem.get(CABINET_KEY),
);
check(
  "no-store load never throws, defaults false",
  loadCabinetSeen(null) === false,
);
check(
  "no-store save never throws",
  (() => {
    try {
      saveCabinetSeen(null);
      return true;
    } catch (_) {
      return false;
    }
  })(),
);
check(
  "a store missing getItem loads false",
  loadCabinetSeen({}) === false,
);

// ---- bootFromIntro: unseen cabinet boots straight to CORE room 1 ----
{
  const started = [];
  let marked = 0;
  const a = createMenuApp({
    onStart: (args) => started.push(args),
    markCabinet: () => {
      marked++;
    },
  });
  a.level = 4;
  a.heat = 2;
  a.pact = 1;
  a.pace = 1; // LEVEL SELECT picks must survive the CORE handoff untouched
  check(
    "boots unseen by default (no cabinet flag, no pact unlock)",
    a.cabinetSeen === false && a.pactUnlocked === false,
  );
  const args = a.bootFromIntro();
  check(
    "bootFromIntro unseen -> GAME with CORE room-1 args",
    a.screen === SCREEN.GAME &&
      a.inGame === true &&
      args.level === 1 &&
      args.heat === 0 &&
      args.pact === 0 &&
      args.pace === 1,
    JSON.stringify(args),
  );
  check(
    "LEVEL SELECT picks (level/heat/pact) untouched by the CORE handoff",
    a.level === 4 && a.heat === 2 && a.pact === 1,
  );
  check(
    "bootFromIntro marks the cabinet seen: app field flips + persist callback fires",
    a.cabinetSeen === true && marked === 1,
    "cabinetSeen=" + a.cabinetSeen + " marked=" + marked,
  );
  check(
    "onStart received the CORE args exactly once",
    started.length === 1 && started[0] === args,
  );
}

// ---- bootFromIntro: cabinet already seen (persisted) -> today's MENU ----
{
  const started = [];
  const a = createMenuApp({
    cabinetSeen: true,
    onStart: (args) => started.push(args),
  });
  const r = a.bootFromIntro();
  check(
    "bootFromIntro seen -> MENU, no CORE handoff",
    a.screen === SCREEN.MENU && started.length === 0 && r === true,
    String(r),
  );
}

// ---- bootFromIntro: pact-unlocked veteran -> MENU even with an unseen cabinet ----
{
  const started = [];
  const a = createMenuApp({
    pactUnlocked: true,
    onStart: (args) => started.push(args),
  });
  check("cabinet flag itself is still unseen", a.cabinetSeen === false);
  a.bootFromIntro();
  check(
    "pact-unlock alone is enough to reach MENU (default score rows never count)",
    a.screen === SCREEN.MENU && started.length === 0,
  );
}

// ---- bootFromIntro: no-op outside INTRO ----
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  check(
    "bootFromIntro outside INTRO is a false no-op",
    a.bootFromIntro() === false && a.screen === SCREEN.MENU,
  );
}

// ---- every INTRO gesture funnels through bootFromIntro for an unseen cabinet ----
{
  const a = createMenuApp();
  a.skip();
  check(
    "skip() on an unseen cabinet boots CORE GAME (not MENU)",
    a.screen === SCREEN.GAME,
  );
}
{
  const a = createMenuApp();
  a.confirm();
  check(
    "confirm() on an unseen cabinet boots CORE GAME (not MENU)",
    a.screen === SCREEN.GAME,
  );
}
{
  const a = createMenuApp();
  a.key("ArrowDown"); // any-key tap path (_tapMove -> skip)
  check(
    "any-key tap on an unseen cabinet boots CORE GAME (not MENU)",
    a.screen === SCREEN.GAME,
  );
}

console.log("\n  CABINETSEEN RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
