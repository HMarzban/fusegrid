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

// ---- bootFromIntro: an unseen cabinet lands on MENU at PLAY (opening ruling
// 2026-10-09 reverses plan 7's first-visit Play Now); the flag is still
// written once and no longer branches anything ----
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
  a.pace = 1;
  a.cursor = 3;
  check(
    "boots unseen by default (no cabinet flag, no pact unlock)",
    a.cabinetSeen === false && a.pactUnlocked === false,
  );
  const r = a.bootFromIntro();
  check(
    "bootFromIntro unseen -> MENU at cursor 0, no run",
    a.screen === SCREEN.MENU && a.cursor === 0 && a.inGame === false && r === true && started.length === 0,
    String(r),
  );
  check(
    "LEVEL SELECT picks (level/heat/pact/pace) untouched",
    a.level === 4 && a.heat === 2 && a.pact === 1 && a.pace === 1,
  );
  check(
    "bootFromIntro marks the cabinet seen: app field flips + persist callback fires once",
    a.cabinetSeen === true && marked === 1,
    "cabinetSeen=" + a.cabinetSeen + " marked=" + marked,
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

// ---- every INTRO exit lands on MENU for an unseen cabinet too ----
{
  const a = createMenuApp();
  a.skip();
  check(
    "skip() on an unseen cabinet lands on MENU (not a run)",
    a.screen === SCREEN.MENU && a.cabinetSeen === true,
  );
}
{
  const a = createMenuApp();
  a.confirm();
  a.key("ArrowDown");
  check(
    "confirm() and an any-key tap on the title stay on INTRO (the press starts the show)",
    a.screen === SCREEN.INTRO && a.introStage === 0 && a.cabinetSeen === false,
  );
  a.beginShow();
  a.subT = 0.5;
  a.key("ArrowDown");
  check(
    "an any-key tap past the show's guard lands an unseen cabinet on MENU (not a run)",
    a.screen === SCREEN.MENU && a.cursor === 0 && a.cabinetSeen === true,
  );
}

console.log("\n  CABINETSEEN RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
