import { SCREEN, createMenuApp } from "../src/app/menuapp.js";
import { PACT } from "../src/core/pact.js";

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
function mkInput(held, confirmHeld) {
  return {
    input: {
      up: !!(held && held.up),
      down: !!(held && held.down),
      left: !!(held && held.left),
      right: !!(held && held.right),
    },
    confirmHeld: !!confirmHeld,
  };
}
function frames(app, n, dt, held, confirmHeld) {
  const inp = mkInput(held, confirmHeld);
  for (let i = 0; i < n; i++) app.update(dt, inp);
}
const DT = 1 / 60;

// ---- LEVEL select: clamp no-wrap, keys, repeat ----
{
  const a = createMenuApp();
  a.screen = SCREEN.LEVEL;
  a.level = 1;
  a.move(-1);
  check("slot clamps at 1 (no wrap)", a.level === 1);
  a.level = 5;
  a.move(1);
  check("slot clamps at 5 (no wrap)", a.level === 5);
  a.move(-1);
  check("slot steps down from 5", a.level === 4);
  a.pactUnlocked = true;
  a.level = 5;
  a.move(1);
  check("unlocked slot reaches 6", a.level === 6);
  a.level = 8;
  a.move(1);
  check("unlocked slot clamps at 8", a.level === 8);
}
{
  const a = createMenuApp();
  a.screen = SCREEN.LEVEL;
  a.key("ArrowRight");
  a.key("KeyD");
  check("Right/D taps move slot to 3", a.level === 3, a.level);
  a.key("ArrowLeft");
  check("Left tap moves slot to 2", a.level === 2);
}
{
  const started = [];
  const a = createMenuApp({ onStart: (x) => started.push(x) });
  a.screen = SCREEN.LEVEL;
  a.level = 4;
  a.confirm();
  check(
    "LEVEL confirm starts at chosen level",
    a.screen === SCREEN.GAME &&
      started.length === 1 &&
      started[0].level === 4 &&
      started[0].heat === 0,
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.LEVEL;
  check("default heat is CORE", a.heat === 0);
  a.key("ArrowUp");
  check("LEVEL ArrowUp heats to PLUS", a.heat === 1 && a.level === 1);
  a.key("ArrowUp");
  a.key("ArrowUp");
  check("LEVEL heat clamps at MAX", a.heat === 2);
  a.key("ArrowDown");
  check("LEVEL ArrowDown cools to PLUS", a.heat === 1);
  a.move(-1);
  check("LEVEL move() without axis still steps room", a.level === 1);
}
{
  const started = [];
  const a = createMenuApp({ onStart: (x) => started.push(x) });
  a.screen = SCREEN.LEVEL;
  a.heat = 2;
  a.confirm();
  check("LEVEL START carries heat", started[0] && started[0].heat === 2);
}
{
  const a = createMenuApp();
  a.screen = SCREEN.LEVEL;
  check("locked Pact Digit1 is a no-op", a.key("Digit1") === false && a.pact === 0);
  a.pactUnlocked = true;
  check("unlocked Digit1 arms LAST", a.key("Digit1") === true && a.pact === PACT.LAST);
  a.key("Digit2");
  check("Digit2 stacks BARE", (a.pact & PACT.BARE) !== 0 && (a.pact & PACT.LAST) !== 0);
  const started = [];
  const b = createMenuApp({
    pactUnlocked: true,
    pact: PACT.LAST | PACT.THIN,
    onStart: (x) => started.push(x),
  });
  b.screen = SCREEN.LEVEL;
  b.confirm();
  check(
    "LEVEL START carries pact when unlocked",
    started[0] && started[0].pact === (PACT.LAST | PACT.THIN),
  );
  const c = createMenuApp({ pact: PACT.SHRINK, onStart: (x) => started.push(x) });
  c.screen = SCREEN.LEVEL;
  c.confirm();
  check("locked START strips pact", started[1] && started[1].pact === 0);
}
{
  const a = createMenuApp({ onStart: () => {} });
  a.screen = SCREEN.LEVEL;
  a.level = 2;
  a.confirm();
  a.toMenu();
  a.screen = SCREEN.MENU;
  a.cursor = 0;
  a.confirm();
  check("chosen level persists as Start Game default", a.level === 2, a.level);
}
{
  const a = createMenuApp();
  a.screen = SCREEN.LEVEL;
  a.level = 1;
  frames(a, 60, DT, { right: true });
  check("LEVEL hold-right clamps at 5", a.level === 5, a.level);
}

console.log("\n  MENU-LEVEL RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
