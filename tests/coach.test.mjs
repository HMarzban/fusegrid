import {
  COACH_DUR,
  loadCoachSeen,
  saveCoachSeen,
  coachOpen,
} from "../src/app/coach.js";

let pass = 0, fail = 0;
function check(n, c, d) { c ? pass++ : fail++; console.log((c ? "  PASS " : "  FAIL ") + n + (d !== undefined ? " -> " + d : "")); }

const mem = new Map();
const store = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
};

check("unseen store is false", loadCoachSeen(store) === false);
check("open at t=0", coachOpen(false, 0, false) === true);
check("closed after DUR", coachOpen(false, COACH_DUR, false) === false);
check("closed after plant", coachOpen(false, 0.4, true) === false);
check("seen never opens", coachOpen(true, 0, false) === false);
saveCoachSeen(store);
check("round-trip", loadCoachSeen(store) === true);

console.log("\n  COACH RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
