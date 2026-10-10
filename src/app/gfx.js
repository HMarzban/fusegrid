export const GFX_ROWS = Object.freeze(["QUALITY", "FRAME RATE", "RESOLUTION", "SHADOWS", "ANTI-ALIAS", "EFFECTS", "DEMO", "FPS METER"]);
export const GFX_KEYS = Object.freeze([null, "fps", "res", "shd", "aa", "fxq", "dmo", "fpm"]);
export const GOVERNED = Object.freeze(["fps", "res", "shd", "aa", "fxq", "dmo"]);
export const PRESET_NAMES = Object.freeze(["BATTERY", "AUTO", "HIGH"]);
export const PRESETS = Object.freeze({
  BATTERY: Object.freeze({ fps: 0, res: 0, shd: 0, aa: 0, fxq: 0, dmo: 0 }),
  AUTO: Object.freeze({ fps: 1, res: 1, shd: 2, aa: 1, fxq: 1, dmo: 1 }),
  HIGH: Object.freeze({ fps: 2, res: 2, shd: 2, aa: 2, fxq: 1, dmo: 2 }),
});
export const IDLE_MIN = 20, DEMO_T = 60, DPR_AUTO_D = 2, DPR_AUTO_T = 1.5, DPR_FULL_3D = 3;
export const VALUES = Object.freeze({
  fps: Object.freeze(["30", "60", "MAX"]), res: Object.freeze(["LOW", "AUTO", "FULL"]), shd: Object.freeze(["OFF", "SHARP", "SOFT"]),
  aa: Object.freeze(["OFF", "AUTO", "ON"]), fxq: Object.freeze(["LOW", "FULL"]), dmo: Object.freeze(["OFF", "SHORT", "ON"]), fpm: Object.freeze(["OFF", "ON"]),
});
const CAPS = [30, 60, Infinity];

export function presetOf(s) {
  const v = s || {};
  for (const n of PRESET_NAMES) if (GOVERNED.every((k) => v[k] === PRESETS[n][k])) return n;
  return "CUSTOM";
}
export function applyPreset(s, name) {
  const p = PRESETS[name];
  if (p) for (const k of GOVERNED) s[k] = p[k];
  return s;
}
export function locked(key, kind) {
  if (kind === "3d") return false;
  if (kind === "px") return key === "shd" || key === "aa";
  return key === "res" || key === "shd" || key === "aa";
}
export function resolve(s, dev) {
  const d = dev || {}, touch = !!d.lay && d.lay !== "d", dpr = d.dpr > 0 ? d.dpr : 1, sc = d.scale > 0 ? d.scale : 1;
  return {
    fpsCap: CAPS[s.fps],
    idleFps: Math.max(IDLE_MIN, Math.min(s.fps === 2 ? 60 : 30, CAPS[s.fps])),
    dpr3d: s.res === 0 ? 1 : s.res === 2 ? Math.min(dpr, DPR_FULL_3D)
      : touch ? Math.max(1, Math.min(DPR_AUTO_T, dpr, sc * dpr)) : Math.min(dpr, DPR_AUTO_D),
    dprPx: s.res === 0 ? 1 : s.res === 2 ? dpr : Math.min(dpr, touch ? DPR_AUTO_T : DPR_AUTO_D),
    aa: s.aa !== 0,
    shadow: ["off", "sharp", "soft"][s.shd],
    partK: s.fxq ? 1 : 0.5,
    demo: ["off", "short", "on"][s.dmo], demoT: DEMO_T,
    meter: s.fpm === 1,
    dyn: s.res === 1,
    power: "default",
  };
}

export const xOf = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "") + "X";
const HELP = {
  QUALITY: ["ONE PRESS SETS THE ROWS BELOW · AUDIO SLEEPS WHEN HIDDEN", "BATTERY RUNS COOLEST · HIGH IS UNCAPPED"],
  "FRAME RATE": ["HOW OFTEN THE SCREEN REDRAWS · GAME SPEED NEVER CHANGES", "30 SAVES MOST BATTERY · MAX IS UP TO YOUR SCREEN, HOTTEST"],
  RESOLUTION: ["PIXEL DENSITY OF THE BOARD · ITS SIZE NEVER CHANGES", "LOW SAVES MOST · AUTO DROPS A STEP IF FRAMES RUN LONG"],
  SHADOWS: ["SOFT IS THE ORIGINAL LOOK · SHARP IS CHEAPER", "OFF SAVES THE MOST ON PHONES"],
  "ANTI-ALIAS": ["SMOOTHS JAGGED 3D EDGES · AUTO IS ON", "APPLIES WHEN YOU LEAVE THIS PAGE"],
  EFFECTS: ["SPARKS, DEBRIS AND GLOW · BLASTS ALWAYS SHOW IN FULL", "LOW HALVES PARTICLES"],
  DEMO: ["THE SELF-PLAYING DEMO AFTER 10 S ON THE MENU", "SHORT PLAYS ONE MINUTE · OFF NEVER STARTS IT"],
  "FPS METER": ["SHOWS FRAMES PER SECOND IN THE CORNER", "NOT PART OF ANY PRESET"],
};
export const HELP_CUSTOM = "CUSTOM · YOU CHANGED A ROW · ENTER = AUTO";
export const HELP_LIMIT = "YOUR DEVICE IS HOLDING 30 · LOW POWER MODE?";
export const HELP_PX_RES = "LOW SAVES MOST · AUTO CAPS THE DENSITY ON PHONES";
export const LOCK_3D = "REAL 3D ONLY · CHANGE RENDER IN OPTIONS", LOCK_RES = "REAL 3D AND PIXEL ONLY";

export function gfxView(s, kind, info) {
  const v = s || {}, i = info || {}, k = kind === "3d" || kind === "px" || kind === "iso" ? kind : "2d";
  const preset = presetOf(v);
  const live = k === "3d" ? i.dpr3d : k === "px" ? i.dprPx : undefined;
  const rows = GFX_ROWS.map((label, r) => {
    const key = GFX_KEYS[r], lk = !!key && locked(key, k), h = HELP[label];
    let val, help2 = h[1];
    if (!key) val = preset;
    else if (key === "res") val = v.res === 0 ? "LOW 1X" : VALUES.res[v.res] + (typeof live === "number" && live > 0 ? " " + xOf(live) : "");
    else if (key === "aa") val = (v.aa === 1 ? "AUTO ON" : VALUES.aa[v.aa]) + (i.pendingAA ? "*" : "");
    else val = VALUES[key][v[key]];
    if (!key && preset === "CUSTOM") help2 = HELP_CUSTOM;
    if (key === "fps" && i.limit) help2 = HELP_LIMIT;
    if (key === "res" && k === "px") help2 = HELP_PX_RES;
    if (lk) { val = "—"; help2 = key === "res" ? LOCK_RES : LOCK_3D; }
    return { label, val: val === undefined ? "" : val, locked: lk, help1: h[0], help2 };
  });
  return { preset, door: preset + " ›", rows };
}
