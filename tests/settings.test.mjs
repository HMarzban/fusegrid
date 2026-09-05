import {
  SETTINGS_KEY,
  DEFAULTS,
  clampSettings,
  loadSettings,
  saveSettings,
} from "../src/app/settings.js";
import {
  setFxOpts,
  getFxOpts,
  getShake,
  getFlash,
  initFx,
  onEvent,
  updateFx,
} from "../src/render/fx.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""),
  );
}

/* Map-backed store, the shape every nb.* suite injects. */
const mkStore = () => {
  const mem = new Map();
  return {
    mem,
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
  };
};
const KEYS = "mus,sfx,snd,r3d,cam,bri,shk,flx";
const DEF_JSON =
  '{"mus":100,"sfx":100,"snd":1,"r3d":0,"cam":0,"bri":100,"shk":1,"flx":0}';

check("key is nb.settings.v1", SETTINGS_KEY === "nb.settings.v1", SETTINGS_KEY);
check(
  "DEFAULTS frozen, 100/100 mix and the six spec flags",
  Object.isFrozen(DEFAULTS) && JSON.stringify(DEFAULTS) === DEF_JSON,
  JSON.stringify(DEFAULTS),
);
check(
  "empty store loads DEFAULTS",
  JSON.stringify(loadSettings(mkStore())) === DEF_JSON,
  JSON.stringify(loadSettings(mkStore())),
);
check(
  "no store at all still loads DEFAULTS (headless)",
  JSON.stringify(loadSettings(null)) === DEF_JSON,
);
check("clampSettings returns a fresh object, never DEFAULTS itself", clampSettings(null) !== DEFAULTS);
check(
  "clampSettings key order matches DEFAULTS and carries no extras",
  Object.keys(clampSettings({ mus: 10, zz: 1 })).join() === KEYS,
  Object.keys(clampSettings({ mus: 10, zz: 1 })).join(),
);

{
  const c = clampSettings({ mus: 37, sfx: -40, snd: "yes", r3d: 9, cam: 7, bri: 5, shk: 0, flx: 2 });
  check("mus 37 snaps to the nearest 10", c.mus === 40, c.mus);
  check("sfx -40 clamps up to 0", c.sfx === 0, c.sfx);
  check("snd truthy string -> 1", c.snd === 1, c.snd);
  check("r3d 9 -> 1", c.r3d === 1, c.r3d);
  check("cam 7 clamps down to 2", c.cam === 2, c.cam);
  check("bri 5 clamps up to 70", c.bri === 70, c.bri);
  check("shk 0 stays 0 (a real off, not a missing key)", c.shk === 0, c.shk);
  check("flx 2 -> 1", c.flx === 1, c.flx);
}
{
  const c = clampSettings({ mus: 104, bri: 129, cam: -3, sfx: 95 });
  check("mus 104 clamps down to 100", c.mus === 100, c.mus);
  check("bri 129 snaps to 130", c.bri === 130, c.bri);
  check("cam -3 clamps up to 0", c.cam === 0, c.cam);
  check("sfx 95 rounds half-up to 100", c.sfx === 100, c.sfx);
  check(
    "missing keys fall back to their own default, not to zero",
    c.snd === 1 && c.r3d === 0 && c.shk === 1 && c.flx === 0,
    [c.snd, c.r3d, c.shk, c.flx].join(),
  );
}
{
  for (const bad of [null, undefined, 42, "x", true, []]) {
    check(
      "clampSettings(" + JSON.stringify(bad) + ") is DEFAULTS",
      JSON.stringify(clampSettings(bad)) === DEF_JSON,
      JSON.stringify(clampSettings(bad)),
    );
  }
}
{
  for (const raw of ["", "{", "null", "[1,2]", '"nope"', "undefined", '{"mus":"loud"}']) {
    const st = mkStore();
    st.mem.set(SETTINGS_KEY, raw);
    let threw = false,
      got = null;
    try {
      got = loadSettings(st);
    } catch (_) {
      threw = true;
    }
    check(
      "corrupt " + JSON.stringify(raw) + " self-heals without throwing",
      !threw && !!got && Object.keys(got).join() === KEYS && got.snd === 1 && got.bri === 100 && got.mus === 100,
      threw ? "THREW" : JSON.stringify(got),
    );
  }
}
{
  const st = mkStore();
  saveSettings({ mus: 40, sfx: 0, snd: 0, r3d: 1, cam: 2, bri: 130, shk: 0, flx: 1 }, st);
  check(
    "Map-store round-trip is byte-exact",
    JSON.stringify(loadSettings(st)) ===
      '{"mus":40,"sfx":0,"snd":0,"r3d":1,"cam":2,"bri":130,"shk":0,"flx":1}',
    JSON.stringify(loadSettings(st)),
  );
  check(
    "one JSON object under one key (no six-module fan-out)",
    st.mem.size === 1 && st.mem.has(SETTINGS_KEY),
    [...st.mem.keys()].join(),
  );
  saveSettings({ mus: 37, bri: 1000 }, st);
  check(
    "save clamps on the way out too",
    loadSettings(st).mus === 40 && loadSettings(st).bri === 130,
    JSON.stringify(loadSettings(st)),
  );
}
{
  let threw = false;
  try {
    saveSettings(DEFAULTS, {
      setItem() {
        throw new Error("quota");
      },
    });
    saveSettings(DEFAULTS, null);
    loadSettings({
      getItem() {
        throw new Error("blocked");
      },
    });
  } catch (_) {
    threw = true;
  }
  check("a throwing store never escapes load/save", !threw);
}

{
  initFx();
  setFxOpts({ flashK: 1, shakeK: 1 });
  check(
    "setFxOpts defaults are 1/1",
    JSON.stringify(getFxOpts()) === '{"flashK":1,"shakeK":1}',
    JSON.stringify(getFxOpts()),
  );
  onEvent({ seed: 1, level: 1 }, { t: "boom", x: 10, y: 10 }, 0);
  updateFx(0);
  const rawFlash = getFlash(),
    rawShake = getShake();
  check(
    "boom leaves a live flash and a live shake to damp",
    rawFlash > 0 && (Math.abs(rawShake.x) > 0 || Math.abs(rawShake.y) > 0),
    rawFlash + "/" + JSON.stringify(rawShake),
  );
  setFxOpts({ flashK: 0.25 });
  check(
    "flashK 0.25 quarters getFlash() (the #ffe8a8 wash peaks at 0.07, not 0.28)",
    Math.abs(getFlash() - rawFlash * 0.25) < 1e-9,
    rawFlash + " -> " + getFlash(),
  );
  setFxOpts({ shakeK: 0 });
  check("shakeK 0 zeroes BOTH getShake axes", getShake().x === 0 && getShake().y === 0, JSON.stringify(getShake()));
  setFxOpts({ flashK: 1, shakeK: 1 });
  check(
    "restoring 1/1 returns the raw values untouched",
    Math.abs(getFlash() - rawFlash) < 1e-9 && Math.abs(getShake().x - rawShake.x) < 1e-9,
    getFlash() + "/" + getShake().x,
  );
  setFxOpts({ flashK: 0.25, shakeK: 0 });
  initFx();
  check(
    "initFx() clears fx state but NOT the user knobs (every renderer build calls it)",
    getFlash() === 0 && JSON.stringify(getFxOpts()) === '{"flashK":0.25,"shakeK":0}',
    JSON.stringify(getFxOpts()),
  );
  check(
    "setFxOpts clamps out of range and ignores missing keys",
    JSON.stringify(setFxOpts({ flashK: 5 })) === '{"flashK":1,"shakeK":0}' &&
      JSON.stringify(setFxOpts({ shakeK: -1 })) === '{"flashK":1,"shakeK":0}',
    JSON.stringify(getFxOpts()),
  );
  setFxOpts({ flashK: 1, shakeK: 1 });
}

console.log("\n  SETTINGS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
