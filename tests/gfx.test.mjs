/* GRAPHICS policy (src/app/gfx.js): presets, the derived QUALITY, per-RENDER
   locks, the resolved knobs K and the page strings. Pure — no DOM. */
import {
  GFX_ROWS, GFX_KEYS, GOVERNED, PRESET_NAMES, PRESETS, VALUES, IDLE_MIN, DEMO_T,
  presetOf, applyPreset, locked, resolve, gfxView, xOf, LOCK_3D, LOCK_RES, HELP_CUSTOM, HELP_LIMIT,
} from "../src/app/gfx.js";
import { clampSettings, DEFAULTS } from "../src/app/settings.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const S = (o) => ({ ...clampSettings(null), ...o });

check("eight rows in the UX order", GFX_ROWS.join("|") === "QUALITY|FRAME RATE|RESOLUTION|SHADOWS|ANTI-ALIAS|EFFECTS|DEMO|FPS METER");
check("row -> key map, QUALITY has none", GFX_KEYS.join() === ",fps,res,shd,aa,fxq,dmo,fpm" && GFX_KEYS.length === GFX_ROWS.length);
check("presets govern six rows, never the meter", GOVERNED.join() === "fps,res,shd,aa,fxq,dmo" && !GOVERNED.includes("fpm"));
check("three stops, no BALANCED", PRESET_NAMES.join() === "BATTERY,AUTO,HIGH" && Object.keys(PRESETS).length === 3);
check("everything frozen", [GFX_ROWS, GFX_KEYS, GOVERNED, PRESET_NAMES, PRESETS, PRESETS.AUTO, VALUES, VALUES.fps].every(Object.isFrozen));
check("preset table matches the spec", JSON.stringify(PRESETS) ===
  '{"BATTERY":{"fps":0,"res":0,"shd":0,"aa":0,"fxq":0,"dmo":0},"AUTO":{"fps":1,"res":1,"shd":2,"aa":1,"fxq":1,"dmo":1},"HIGH":{"fps":2,"res":2,"shd":2,"aa":2,"fxq":1,"dmo":2}}');
check("settings DEFAULTS are the AUTO preset", presetOf(DEFAULTS) === "AUTO" && GOVERNED.every((k) => DEFAULTS[k] === PRESETS.AUTO[k]));
check("every value list matches its clamp range", ["fps", "res", "shd", "aa", "dmo"].every((k) => VALUES[k].length === 3) && VALUES.fxq.length === 2 && VALUES.fpm.length === 2);

// ---- presets / CUSTOM ----
for (const n of PRESET_NAMES) {
  const s = applyPreset(S({ fpm: 1 }), n);
  check(n + " applies and reads back as " + n + ", meter untouched", presetOf(s) === n && s.fpm === 1);
}
{
  const s = S({});
  check("a hand edit derives CUSTOM", presetOf({ ...s, fxq: 0 }) === "CUSTOM" && presetOf({ ...s, fps: 2 }) === "CUSTOM");
  check("the meter never makes CUSTOM", presetOf({ ...s, fpm: 1 }) === "AUTO");
  check("presetOf tolerates junk", presetOf(null) === "CUSTOM" && presetOf({}) === "CUSTOM");
  const r = applyPreset(s, "NOPE");
  check("an unknown preset name writes nothing", r === s && presetOf(s) === "AUTO");
  check("applyPreset mutates and returns the same object", applyPreset(s, "HIGH") === s && s.fps === 2);
}

// ---- locks per RENDER ----
{
  const lk = (kind) => GFX_KEYS.filter((k) => k && locked(k, kind)).join();
  check("CLASSIC 2D locks RESOLUTION / SHADOWS / ANTI-ALIAS", lk("2d") === "res,shd,aa", lk("2d"));
  check("iso locks like CLASSIC 2D", lk("iso") === "res,shd,aa", lk("iso"));
  check("PIXEL locks SHADOWS / ANTI-ALIAS", lk("px") === "shd,aa", lk("px"));
  check("REAL 3D locks nothing", lk("3d") === "", lk("3d"));
}

// ---- resolve: lay d/p/l x dpr x scale x every value ----
{
  let bad = [];
  for (const lay of ["d", "p", "l"]) for (const dpr of [1, 1.5, 2, 3]) for (const scale of [0.5, 1, 1.8])
    for (let fps = 0; fps < 3; fps++) for (let res = 0; res < 3; res++) for (let shd = 0; shd < 3; shd++)
      for (let aa = 0; aa < 3; aa++) for (let fxq = 0; fxq < 2; fxq++) for (let dmo = 0; dmo < 3; dmo++) {
        const s = S({ fps, res, shd, aa, fxq, dmo }), K = resolve(s, { lay, dpr, scale }), touch = lay !== "d";
        const why = [];
        if (K.fpsCap !== [30, 60, Infinity][fps]) why.push("cap");
        if (K.idleFps < IDLE_MIN || K.idleFps !== (fps === 2 ? 60 : 30)) why.push("idle");
        if (res === 1 && !touch && K.dpr3d !== Math.min(dpr, 2)) why.push("d auto");
        if (res === 1 && touch && (K.dpr3d > 1.5 || K.dpr3d < 1 || K.dpr3d !== Math.max(1, Math.min(1.5, dpr, scale * dpr)))) why.push("t auto");
        if (res === 0 && (K.dpr3d !== 1 || K.dprPx !== 1)) why.push("low");
        if (res === 2 && (K.dpr3d !== Math.min(dpr, 3) || K.dprPx !== dpr)) why.push("full");
        if (res === 1 && K.dprPx !== Math.min(dpr, touch ? 1.5 : 2)) why.push("px auto");
        if (K.aa !== (aa !== 0)) why.push("aa");
        if (K.shadow !== ["off", "sharp", "soft"][shd]) why.push("shd");
        if (K.partK !== (fxq ? 1 : 0.5)) why.push("partK");
        if (K.demo !== ["off", "short", "on"][dmo] || K.demoT !== DEMO_T) why.push("demo");
        if (K.dyn !== (res === 1) || K.power !== "default" || K.meter !== false) why.push("misc");
        if (why.length) bad.push(lay + dpr + "x" + scale + JSON.stringify({ fps, res, shd, aa, fxq, dmo }) + why);
      }
  check("resolve over lay x dpr x scale x every row value", bad.length === 0, bad.slice(0, 3).join(" | ") || "all");
  check("meter follows fpm", resolve(S({ fpm: 1 }), { lay: "d", dpr: 1 }).meter === true);
  check("desktop AUTO is today's look: min(dpr,2), AA on, SOFT, full fx", (() => {
    const K = resolve(S({}), { lay: "d", dpr: 2, scale: 0.5 });
    return K.dpr3d === 2 && K.dprPx === 2 && K.aa === true && K.shadow === "soft" && K.partK === 1 && K.fpsCap === 60 && K.idleFps === 30;
  })());
  check("a dpr-3 phone in AUTO holds 3D at 1.5, PIXEL at 1.5", (() => {
    const K = resolve(S({}), { lay: "p", dpr: 3, scale: 1 });
    return K.dpr3d === 1.5 && K.dprPx === 1.5 && K.aa === true;
  })());
  check("a phone shown small (scale 0.4) matches its displayed density, floor 1", resolve(S({}), { lay: "p", dpr: 2, scale: 0.4 }).dpr3d === 1);
  const K0 = resolve(S({}), null), K1 = resolve(S({}), { lay: "d", dpr: 0, scale: -1 });
  check("a missing or bogus dev reads desktop dpr 1", K0.dpr3d === 1 && K1.dpr3d === 1 && K1.dprPx === 1);
  check("BATTERY idles at 30, MAX idles at 60, never under the floor", resolve(applyPreset(S({}), "BATTERY"), {}).idleFps === 30 && resolve(applyPreset(S({}), "HIGH"), {}).idleFps === 60 && IDLE_MIN === 20);
}

// ---- gfxView: the page strings show resolved truth ----
{
  const v3 = gfxView(S({}), "3d", { dpr3d: 1.5, dprPx: 2, liveAA: true, pendingAA: false });
  const vals = v3.rows.map((r) => r.val).join("|");
  check("AUTO in REAL 3D reads the live density", vals === "AUTO|60|AUTO 1.5X|SOFT|AUTO ON|FULL|SHORT|OFF", vals);
  check("door value is the preset plus ›", v3.door === "AUTO ›" && v3.preset === "AUTO");
  check("labels come from GFX_ROWS", v3.rows.map((r) => r.label).join("|") === GFX_ROWS.join("|"));
  check("PIXEL reads dprPx", gfxView(S({}), "px", { dpr3d: 1, dprPx: 2 }).rows[2].val === "AUTO 2X");
  check("FULL reads the device value", gfxView(S({ res: 2 }), "3d", { dpr3d: 3 }).rows[2].val === "FULL 3X");
  check("LOW always reads 1X", gfxView(S({ res: 0 }), "3d", { dpr3d: 1.75 }).rows[2].val === "LOW 1X");
  check("no info yet: AUTO / FULL read bare, no invented density", gfxView(S({}), "3d", undefined).rows[2].val === "AUTO" && gfxView(S({ res: 2 }), "px", null).rows[2].val === "FULL");
  check("xOf: one decimal, trailing .0 dropped", xOf(1.5) === "1.5X" && xOf(2) === "2X" && xOf(1.25) === "1.3X" && xOf(1.75) === "1.8X");
  const pa = gfxView(S({ aa: 0 }), "3d", { pendingAA: true });
  check("a pending AA change carries a *", pa.rows[4].val === "OFF*" && gfxView(S({ aa: 2 }), "3d", { pendingAA: true }).rows[4].val === "ON*", pa.rows[4].val);
  check("CUSTOM door and help line", (() => { const c = gfxView(S({ fxq: 0 }), "3d", {}); return c.door === "CUSTOM ›" && c.rows[0].val === "CUSTOM" && c.rows[0].help2 === HELP_CUSTOM; })());
  check("FRAME RATE line 2 names a held device rate", gfxView(S({}), "3d", { limit: true }).rows[1].help2 === HELP_LIMIT);
  check("FRAME RATE line 2 names the rate the device actually holds", gfxView(S({ fps: 0 }), "3d", { limit: true, fps: 19.6 }).rows[1].help2 === "YOUR DEVICE IS HOLDING 20 · LOW POWER MODE?" &&
    gfxView(S({}), "2d", { limit: true, fps: 30 }).rows[1].help2 === HELP_LIMIT);
  const v2 = gfxView(S({}), "2d", {});
  check("CLASSIC 2D: three locked rows read an em dash", v2.rows.filter((r) => r.locked).map((r) => r.label + "=" + r.val).join() === "RESOLUTION=—,SHADOWS=—,ANTI-ALIAS=—");
  check("locked line 2 names the look that unlocks it", v2.rows[2].help2 === LOCK_RES && v2.rows[3].help2 === LOCK_3D && v2.rows[4].help2 === LOCK_3D);
  const vp = gfxView(S({}), "px", {});
  check("PIXEL: SHADOWS and ANTI-ALIAS locked, RESOLUTION live", vp.rows.filter((r) => r.locked).map((r) => r.label).join() === "SHADOWS,ANTI-ALIAS" && !vp.rows[2].locked);
  check("an unknown kind locks like CLASSIC 2D", gfxView(S({}), undefined, {}).rows.filter((r) => r.locked).length === 3);
  let long = [];
  for (const kind of ["2d", "px", "3d"]) for (const info of [{}, { limit: true, pendingAA: true }]) for (const s of [S({}), S({ fxq: 0 })])
    for (const r of gfxView(s, kind, info).rows) for (const h of [r.help1, r.help2]) if (!h || [...h].length > 60) long.push(h);
  check("every help line exists and is <= 60 characters", long.length === 0, long.join(" | "));
}

console.log("\n  GFX RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
