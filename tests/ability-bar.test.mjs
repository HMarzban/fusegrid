import { CFG } from "../src/core/config.js";
import { POWER } from "../src/core/entities.js";
import { abilityList, abilityText, abilityOrd, getStrip, feedFx, initFx, syncFx } from "../src/render/fx.js";
import { abilityChips, ABAR } from "../src/render/scenes.js";
import { createHud, drawHud, hudGeom, hudState } from "../src/render/hud.js";
import { hudGeo } from "../src/app/fit.js";
import { worldTokens, CONST } from "../src/render/kit/tokens.js";
import { createRenderer } from "../src/render/renderer.js";
import { createRenderer3D, projBoard } from "../src/render/three/wrapper.js";
import { createRig, applyOrbit, CAM_PRESET } from "../src/render/three/camrig.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { readFileSync } from "node:fs";
import "../src/render/r3d/scene3d.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const T = CFG.TILE, S0 = CFG.PLAYER_START.speed, SU = CFG.SPEED_UP;
const P0 = () => ({ alive: true, iFrames: 0, x: 220, y: 220, bombs: 1, range: 1, speed: S0, bombKind: "normal" });
const mkW = (over, st) => ({ state: st || "PLAY", seed: 1, level: 1, rng: {}, lives: 3, players: [Object.assign(P0(), over || {})], blades: [], events: [], enemies: [], heat: 0, score: 0 });
const feed = (w, dt) => { w.events = []; feedFx(w, dt === undefined ? CFG.STEP : dt); };
const fresh = (over) => { initFx(); const w = mkW(over); syncFx(w); feed(w); return w; };
const rec = () => {
  const ops = [];
  const c = new Proxy({ globalAlpha: 1 }, {
    get: (o, k) => (k in o ? o[k] : k === "measureText" ? (s) => ({ width: String(s).length * 8 }) : (...a) => { ops.push([k, a]); }),
    set: (o, k, v) => { ops.push(["=" + k, v]); o[k] = v; return true; },
  });
  return { c, ops };
};
const words = (ops) => ops.filter((o) => o[0] === "fillText").map((o) => String(o[1][0]));
const ALL = { shield: true, kick: true, throw: true, passing: true, bombKind: "pierce", remote: true, speed: CFG.MAX_SPEED };

// ---- 1. abilityList: active entries only, in the spec order ----
{
  check("a fresh player holds nothing", abilityList(P0()).length === 0 && abilityList(null).length === 0 && abilityList({}).length === 0);
  check("all seven slots in order SHIELD, KICK, THROW, PASS, bomb kind, REMOTE, SPD", abilityList(ALL).join() === "shield,kick,throw,pass,pierce,remote,speed", abilityList(ALL).join());
  for (const k of ["line", "power", "pierce"]) check("bomb kind " + k + " takes the fifth slot", abilityList({ bombKind: k, kick: true, remote: true }).join() === "kick," + k + ",remote");
  check("bombKind normal is not an ability", !abilityList({ bombKind: "normal" }).length);
  check("PASS reads p.passing (the field applyPower sets)", abilityList({ passing: true }).join() === "pass" && !abilityList({ pass: true }).length);
  check("start speed shows no SPD chip; one SPEED_UP does", !abilityList({ speed: S0 }).length && abilityList({ speed: S0 + SU }).join() === "speed");
  check("abilityOrd folds the three bomb kinds onto one slot", abilityOrd("line") === abilityOrd("power") && abilityOrd("power") === abilityOrd("pierce") && abilityOrd("pass") < abilityOrd("line") && abilityOrd("line") < abilityOrd("remote"));
}

// ---- 2. abilityText: names from POWER[].name, SPD n / SPD MAX ----
{
  const byT = Object.fromEntries(POWER.map((d) => [d.t, d]));
  for (const k of ["shield", "kick", "throw", "pass", "line", "power", "pierce", "remote"]) {
    const [s, m, col] = abilityText(k, {});
    check("chip " + k + " -> " + byT[k].name + " in its catalog colour", s === byT[k].name && m === "" && col === byT[k].col, s + "/" + col);
  }
  const sp = [[S0 + SU, "SPD 1"], [S0 + 2 * SU, "SPD 2"], [S0 + 3 * SU, "SPD 3"]];
  for (const [v, want] of sp) check("speed " + v.toFixed(1) + " -> " + want, abilityText("speed", { speed: v })[0] === want, abilityText("speed", { speed: v })[0]);
  const mx = abilityText("speed", { speed: CFG.MAX_SPEED });
  check("speed at the cap -> SPD with a separate muted MAX part", mx[0] === "SPD" && mx[1] === "MAX");
  check("an unknown kind has no text", abilityText("nope", {})[0] === "");
}

// ---- 3. the hit-strip fade: tracked render-side on the PLAY-only clock ----
{
  const w = fresh({ kick: true, shield: true, bombKind: "line", speed: S0 + SU });
  check("the first feed after a wipe only seeds the baseline (no fade)", getStrip().length === 0);
  const p = w.players[0];
  p.kick = false; p.shield = false; p.bombKind = "normal";
  feed(w);
  const g = getStrip().map((e) => e.k).sort().join();
  check("a hit fades exactly the chips it stripped (SPD is permanent)", g === "kick,line,shield", g);
  check("a fading chip starts at the full ABAR.fade", getStrip().every((e) => Math.abs(e.t - ABAR.fade) < 1e-9));
  w.state = "PAUSE"; feed(w, 0.3);
  check("PAUSE freezes the fade (PLAY-only clock)", getStrip().every((e) => Math.abs(e.t - ABAR.fade) < 1e-9));
  w.state = "PLAY"; feed(w, 0.3);
  check("PLAY runs it down", getStrip().every((e) => Math.abs(e.t - (ABAR.fade - 0.3)) < 1e-9));
  p.kick = true; feed(w, 0.01);
  check("re-taking a fading ability drops its ghost at once", !getStrip().some((e) => e.k === "kick") && getStrip().length === 2);
  feed(w, 0.4);
  check("after ABAR.fade every ghost is gone", getStrip().length === 0);
  const w2 = fresh({ bombKind: "line" });
  w2.players[0].bombKind = "power"; feed(w2);
  check("a bomb-kind swap is a replacement, not a loss (no fade)", getStrip().length === 0);
  const w7 = fresh({ bombKind: "line" });
  w7.players[0].bombKind = "normal"; feed(w7);
  check("losing the bomb kind to a hit fades it", getStrip().length === 1 && getStrip()[0].k === "line");
  w7.players[0].bombKind = "power"; feed(w7, 0.1);
  check("a new bomb kind inside the fade drops the old kind's ghost (one chip per slot)", getStrip().length === 0);
  const w3 = fresh({ shield: true });
  w3.players[0].shield = false; feed(w3);
  check("a spent SHIELD fades the same way", getStrip().length === 1 && getStrip()[0].k === "shield");
  const w4 = mkW({}); syncFx(w4);
  check("a world change (room / run) wipes the strip", getStrip().length === 0);
  const w5 = fresh({ remote: true, throw: true });
  const w6 = mkW({}); w6.seed = 2; syncFx(w6); feed(w6);
  check("a new run that starts with nothing fades nothing", getStrip().length === 0);
  void w5;
}

// ---- 3b. real restart paths: every loadLevel mints a new rng, so syncFx wipes ----
{
  initFx();
  const w = createWorld(7, 1); loadLevel(w, 1); w.state = "PLAY";
  const hold = () => Object.assign(w.players[0], { kick: true, shield: true, bombKind: "line", remote: true });
  const step = () => { syncFx(w); w.events = []; feedFx(w, CFG.STEP); };
  hold(); step(); step();
  loadLevel(w, 1); w.state = "PLAY"; step(); step();
  check("a same-seed same-level restart (new run / PAUSE RESTART) fades nothing", getStrip().length === 0, getStrip().map((e) => e.k).join());
  hold(); step(); step();
  loadLevel(w, 2, true); w.state = "PLAY"; step(); step();
  check("a next-room carry keeps the abilities and fades nothing", getStrip().length === 0 && abilityList(w.players[0]).join() === "shield,kick,line,remote", abilityList(w.players[0]).join());
  w.players[0].kick = false; step();
  check("a later loss in that room still fades", getStrip().length === 1 && getStrip()[0].k === "kick");
}

// ---- 4. abilityChips: actives at alpha 1, ghosts dimmed, slot order kept ----
{
  const L = abilityChips({ throw: true, remote: true }, [{ k: "kick", t: ABAR.fade }, { k: "shield", t: ABAR.fade / 2 }]);
  check("ghosts keep their slots between actives", L.map((e) => e.k).join() === "shield,kick,throw,remote", L.map((e) => e.k).join());
  check("a fresh ghost is dimmed to ABAR.dim, a half-spent one to half that", L[1].a === ABAR.dim && Math.abs(L[0].a - ABAR.dim / 2) < 1e-9 && L[2].a === 1 && L[3].a === 1);
}

// ---- 5. the power-ups bar (hud.js, UI upgrade Task 8.2): idle paints nothing, the chips sit in hudGeo's bar slot under the board ----
{
  initFx();
  const GEO = hudGeo(1366, 768, 600, 520, "d");
  const bar = (w, gone) => { const r = rec(), st = hudState(w, { time: { t: 1 } }); if (gone) st.ab = abilityChips(w.players[0], gone).filter((e) => e.a > 0).map((e) => { const [s, m, col] = abilityText(e.k, w.players[0]); return { k: e.k, a: e.a, s, m, col, cap: "" }; }); const G = hudGeom(r.c, GEO, st, { w: 1366, h: 768 }); drawHud(r.c, G, st, worldTokens(1), {}); return { ...r, G, st }; };
  const barWords = (b) => { const ws = words(b.ops), i = ws.indexOf("SCORE"); return ws.slice(i + 2); };
  const idle = bar(mkW({}));
  check("holding nothing paints no bar at all", idle.G.bar === null && !words(idle.ops).some((s) => /SHIELD|KICK/.test(s)));
  for (const st of ["WIN", "LOSE", "PAUSE", "PLAY"]) {
    const r = bar(mkW({ kick: true }, st)), want = st === "PLAY" || st === "PAUSE";
    check(st + (want ? " paints" : " paints no bar (the summary owns the screen)"), want ? words(r.ops).includes("KICK") : r.G.bar === null && !words(r.ops).includes("KICK"));
  }
  const r = bar(mkW(ALL));
  check("all seven chips read in order", ["SHIELD", "KICK", "THROW", "PASS", "PIERCE", "REMOTE", "SPD"].every((k, i, a) => !i || words(r.ops).indexOf(k) > words(r.ops).indexOf(a[i - 1])) && words(r.ops).includes("MAX"), words(r.ops).join("|"));
  const rects = r.G.bar.items, B = r.G.bar;
  check("seven panels, each inside the bar under the board", rects.length === 7 && rects.every((q) => q.y >= B.y && q.y + q.h <= B.y + B.h && q.x >= B.x && q.x + q.w <= B.x + B.w) && B.y >= GEO.stage.y + GEO.stage.h, JSON.stringify(B));
  check("the bar takes hudGeo's slot under the board, centred on it, widened only when every label would not fit the board's width", B.y === GEO.bar.y && Math.abs(B.x + B.w / 2 - (GEO.bar.x + GEO.bar.w / 2)) < 1e-6 && B.w >= GEO.bar.w && bar(mkW({ kick: true })).G.bar.w === GEO.bar.w);
  check("panels never overlap", rects.every((q, i) => !i || q.x >= rects[i - 1].x + rects[i - 1].w));
  check("MAX is the muted part", r.ops.some((o, i) => o[0] === "fillText" && o[1][0] === "MAX" && r.ops.slice(0, i).reverse().find((q) => q[0] === "=fillStyle")[1] === CONST.t2));
  check("no blink: with every chip live, alpha is only 1 (and the kit plate's fixed 0.6 lit edge)", r.ops.filter((o) => o[0] === "=globalAlpha").every((o) => o[1] === 1 || o[1] === 0.6), r.ops.filter((o) => o[0] === "=globalAlpha").map((o) => o[1]).join());
  const g = bar(mkW({ throw: true }), [{ k: "kick", t: ABAR.fade }]);
  /* the bar's own ops: the same frame drawn with no bar is an exact prefix (the chips first), so the rest is the bar alone */
  const wb = rec(), nb = rec(); drawHud(wb.c, g.G, g.st, worldTokens(1), {}); drawHud(nb.c, { ...g.G, bar: null }, g.st, worldTokens(1), {});
  const pre = nb.ops.length > 0 && JSON.stringify(wb.ops.slice(0, nb.ops.length)) === JSON.stringify(nb.ops), tail = wb.ops.slice(nb.ops.length);
  const al = tail.filter((o) => o[0] === "=globalAlpha").map((o) => o[1]), bw = words(tail);
  check("a stripped chip paints dimmed, then the active one at full", pre && al.join() === ABAR.dim + ",1" && bw.join() === "KICK,THROW", pre + " " + al.join() + " " + bw.join());
  const z = bar(mkW({}), [{ k: "kick", t: 0 }]);
  check("a spent ghost paints no chip", z.G.bar === null && !words(z.ops).includes("KICK"));
}

// ---- 6. the HUD chips do not depend on abilities ----
{
  const GEO = hudGeo(1366, 768, 600, 520, "d"), chips = (w) => { const r = rec(), st = hudState(w, { time: { t: 1 } }); return hudGeom(r.c, GEO, st, { w: 1366, h: 768 }).chips; };
  check("the chip rects are identical with and without abilities", JSON.stringify(chips(mkW({}))) === JSON.stringify(chips(mkW(ALL))));
}

// ---- 7. renderer wiring: no board canvas paints the bar; the HUD does ----
{
  const texts = (r, w, o) => { const out = []; r.ctx.fillText = (s) => out.push(String(s)); r.render(w, CFG.STEP, o); return out; };
  const mk = (over) => { const w = createWorld(7, 1); loadLevel(w, 1); w.state = "PLAY"; Object.assign(w.players[0], over || {}); return w; };
  initFx();
  check("CLASSIC 2D paints no bar on #c, hud:true or not", !texts(createRenderer(null, { kind: "2d" }), mk({ kick: true }), { hud: true }).includes("KICK"));
  initFx();
  check("?render=iso paints no bar either", !texts(createRenderer(null, { kind: "iso" }), mk({ kick: true }), { hud: true }).includes("KICK"));
  for (const f of ["src/render/renderer.js", "src/render/three/wrapper.js", "src/render/pixel/renderer.js"]) {
    const src = readFileSync(f, "utf8");
    check(f + ": no HUD chips, plate or bar on the board canvas", !/drawAbilityBar\(|drawHudChips\(|hudPlate3?\(/.test(src));
  }
  const cv = [];
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (...a) => { if (k === "fillText") cv.push(String(a[0])); }), set: (o, k, v) => { o[k] = v; return true; } });
  initFx();
  const r3 = createRenderer3D(null, { getContext: () => ctx }, { audio: null });
  r3.render(mk({ remote: true }), CFG.STEP, { hud: true });
  check("REAL 3D paints no bar on its overlay", !cv.includes("REMOTE"), cv.join("|"));
  const hr = rec(), geo = hudGeo(1366, 768, 600, 520, "d");
  createHud().frame({ hudGeo: () => geo, hud: () => ({ ctx: hr.c, geo, w: 1366, h: 768, el: { width: 2732 } }) }, mk({ remote: true }), { time: { t: 0 } }, "3d");
  check("the HUD paints it, in every look", words(hr.ops).includes("REMOTE"));
}

// ---- 8. REAL 3D: the lane covers no playfield at any CAMERA preset ----
{
  const r3 = createRenderer3D(null, null, {});
  const cam = r3._dbg.camera, W = CFG.COLS * T, H = CFG.ROWS * T;
  for (let i = 0; i < CAM_PRESET.length; i++) {
    const rig = createRig(); rig.dist = CAM_PRESET[i];
    applyOrbit(cam, rig, { x: 0, y: 0 });
    const row11 = Math.max(...[T, W / 2, W - T].map((x) => projBoard(cam, x, H - T, 0).y));
    const edge = Math.max(...[0, W / 2, W].map((x) => projBoard(cam, x, H, 0).y));
    check("preset " + i + " (dist " + CAM_PRESET[i] + "): row 11's floor edge (" + row11.toFixed(1) + ") and the board's near edge (" + edge.toFixed(1) + ") sit above the lane", row11 < ABAR.y - 40 && edge < ABAR.y);
  }
}

console.log("\n  ABILITY BAR RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
