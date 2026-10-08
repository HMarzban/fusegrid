import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CLEAR_KEYS, KEEP_KEYS, clearCabinet } from "../src/app/reset.js";
import { SETTINGS_KEY } from "../src/app/settings.js";
import { PACE_KEY } from "../src/app/pacestore.js";
import { createMenuApp, SCREEN } from "../src/app/menuapp.js";

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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
  });
const srcFiles = walk(join(ROOT, "src"));
const appFiles = walk(join(ROOT, "src/app"));

// 1) the literal sweep: every nb.* literal in src/ is classified
{
  const all = new Set([...CLEAR_KEYS, ...KEEP_KEYS]);
  const found = new Set();
  for (const f of srcFiles)
    for (const m of readFileSync(f, "utf8").matchAll(/["'`](nb\.[^"'`\s]+)["'`]/g)) found.add(m[1]);
  const loose = [...found].filter((k) => !all.has(k));
  check("every nb.* literal in src/ is in CLEAR_KEYS or KEEP_KEYS", loose.length === 0, loose.join(","));
  check("CLEAR_KEYS and KEEP_KEYS are disjoint", CLEAR_KEYS.every((k) => !KEEP_KEYS.includes(k)));
  const missing = [...all].filter((k) => !found.has(k));
  check("every listed key appears in src/", missing.length === 0, missing.join(","));
  check("KEEP_KEYS is exactly the settings and pace keys",
    KEEP_KEYS.length === 2 && KEEP_KEYS.includes(SETTINGS_KEY) && KEEP_KEYS.includes(PACE_KEY),
    KEEP_KEYS.join(","));
  check("CLEAR_KEYS holds 12 distinct keys", CLEAR_KEYS.length === 12 && new Set(CLEAR_KEYS).size === 12,
    CLEAR_KEYS.join(","));
  check("both lists are frozen", Object.isFrozen(CLEAR_KEYS) && Object.isFrozen(KEEP_KEYS));
}

// 1b) no storage call in src/app takes a literal key
{
  const bad = [];
  for (const f of appFiles) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/\b(?:getItem|setItem|removeItem)\(\s*["'`]/g)) bad.push(f.slice(ROOT.length + 1) + "@" + m.index);
  }
  check("no getItem/setItem/removeItem in src/app takes a literal key", bad.length === 0, bad.join(","));
}

// 2) clearCabinet
function mapStore(throwOn) {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => {
      if (k === throwOn) throw new Error("boom");
      m.delete(k);
    },
  };
}
{
  const st = mapStore();
  for (const k of [...CLEAR_KEYS, ...KEEP_KEYS, "other.app"]) st.setItem(k, "1");
  check("fixture holds all 14 keys plus other.app", st.m.size === 15);
  clearCabinet(st);
  check("clearCabinet leaves exactly the 2 KEEP keys and other.app",
    st.m.size === 3 && KEEP_KEYS.every((k) => st.m.has(k)) && st.m.has("other.app"),
    [...st.m.keys()].join(","));
}
{
  const st = mapStore(CLEAR_KEYS[3]);
  for (const k of [...CLEAR_KEYS, ...KEEP_KEYS]) st.setItem(k, "1");
  let threw = false;
  try { clearCabinet(st); } catch (_) { threw = true; }
  check("a throwing removeItem never throws out of clearCabinet", !threw);
  check("a throwing removeItem still removes every other CLEAR key",
    st.m.size === 3 && st.m.has(CLEAR_KEYS[3]) && KEEP_KEYS.every((k) => st.m.has(k)),
    [...st.m.keys()].join(","));
}
{
  let threw = false;
  try { clearCabinet(null); clearCabinet({}); } catch (_) { threw = true; }
  check("a null or method-less store is a no-op", !threw);
}

// 3) menuapp two-press confirm
{
  let n = 0;
  const app = createMenuApp({ onReset: () => n++ });
  app.screen = SCREEN.STATS;
  check("resetArm starts false", app.resetArm === false);
  check("KeyR on STATS arms", app.key("KeyR") === true && app.resetArm === true && n === 0);
  check("a second KeyR fires onReset once and disarms",
    app.key("KeyR") === true && n === 1 && app.resetArm === false, n + "/" + app.resetArm);
  app.key("KeyR");
  app.back();
  check("back() from an armed STATS disarms", app.resetArm === false && app.screen === SCREEN.MENU);
  app._push(SCREEN.STATS);
  app.key("KeyR");
  check("KeyR, back, STATS again, KeyR only arms", app.resetArm === true && n === 1, n + "/" + app.resetArm);
  app.key("KeyT");
  check("KeyT on STATS disarms (via _push)", app.screen === SCREEN.TROPHIES && app.resetArm === false);
  app._push(SCREEN.MENU);
  check("KeyR on MENU returns false and does not arm",
    app.key("KeyR") === false && app.resetArm === false && n === 1);
}
{
  const app = createMenuApp({});
  app._push(SCREEN.STATS);
  app.key("KeyR");
  let threw = false;
  try { app.key("KeyR"); } catch (_) { threw = true; }
  check("a second KeyR with no onReset wired does not throw", !threw && app.resetArm === false);
}

console.log("\n  RESET RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
