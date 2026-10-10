import { CFG } from "../src/core/config.js";
import { POWER } from "../src/core/entities.js";
import { abilityList, abilityText, abilityOrd, getStrip, feedFx, initFx, syncFx } from "../src/render/fx.js";
import { drawAbilityBar, abilityChips, drawHudChips, ABAR } from "../src/render/scenes.js";
import { createRenderer } from "../src/render/renderer.js";
import { createRenderer3D, projBoard } from "../src/render/three/wrapper.js";
import { createRig, applyOrbit, CAM_PRESET } from "../src/render/three/camrig.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { readFileSync } from "node:fs";

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
  const c = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : (...a) => { ops.push([k, a]); }),
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

// ---- 5. drawAbilityBar: idle paints nothing, chips sit in the y 484-516 lane ----
{
  initFx();
  const idle = rec();
  drawAbilityBar(idle.c, mkW({}));
  check("holding nothing paints nothing at all (not even a save)", idle.ops.length === 0, idle.ops.length);
  for (const st of ["WIN", "LOSE", "PAUSE", "PLAY"]) {
    const r = rec();
    drawAbilityBar(r.c, mkW({ kick: true }, st), undefined, []);
    const want = st === "PLAY" || st === "PAUSE";
    check(st + (want ? " paints" : " paints nothing (the summary owns the screen)"), want ? words(r.ops).includes("KICK") : r.ops.length === 0);
  }
  const r = rec();
  drawAbilityBar(r.c, mkW(ALL), undefined, []);
  check("all seven chips read in order", words(r.ops).join("|") === "SHIELD|KICK|THROW|PASS|PIERCE|REMOTE|SPD|MAX", words(r.ops).join("|"));
  const rects = r.ops.filter((o) => o[0] === "fillRect").map((o) => o[1]);
  check("seven panels, each inside the y 484-516 lane", rects.length === 7 && rects.every(([, y, , h]) => y >= 484 && y + h <= 516), JSON.stringify(rects));
  check("the bar starts at x16 and the full set ends inside the 600-wide overlay", rects[0][0] === 16 && rects[6][0] + rects[6][2] <= 600 - 16, JSON.stringify(rects[6]));
  check("panels never overlap", rects.every((q, i) => !i || q[0] >= rects[i - 1][0] + rects[i - 1][2]));
  check("MAX is the muted part", r.ops.some((o, i) => o[0] === "fillText" && o[1][0] === "MAX" && r.ops.slice(0, i).reverse().find((q) => q[0] === "=fillStyle")[1] === "#9fb3d8"));
  check("no blink: alpha set only to fixed per-chip values", r.ops.filter((o) => o[0] === "=globalAlpha").every((o) => o[1] === 1));
  const g = rec();
  drawAbilityBar(g.c, mkW({ throw: true }), undefined, [{ k: "kick", t: ABAR.fade }]);
  const al = g.ops.filter((o) => o[0] === "=globalAlpha").map((o) => o[1]);
  check("a stripped chip paints dimmed, then the active one at full", al.join() === ABAR.dim + ",1" && words(g.ops).join() === "KICK,THROW", al.join() + " " + words(g.ops).join());
  const z = rec();
  drawAbilityBar(z.c, mkW({}), undefined, [{ k: "kick", t: 0 }]);
  check("a spent ghost paints no chip", !words(z.ops).length);
  const ic = [];
  const p = rec();
  drawAbilityBar(p.c, mkW({ kick: true, bombKind: "line" }), (c, k, col, x, y) => ic.push([k, col, x, y]), []);
  check("PIXEL's painter gets each kind, its colour and the chip centre", ic.map((q) => q[0]).join() === "kick,line" && ic.every((q) => q[3] === ABAR.y + ABAR.h / 2), JSON.stringify(ic));
  check("PIXEL's painter replaces the vector icon", !p.ops.some((o) => o[0] === "translate"));
  const y2 = rec();
  drawAbilityBar(y2.c, mkW({ kick: true }), undefined, [], 300);
  check("y moves the lane", y2.ops.find((o) => o[0] === "fillRect")[1][1] === 300);
}

// ---- 6. drawHudChips' call log does not depend on abilities ----
{
  const a = rec(), b = rec();
  drawHudChips(a.c, mkW({}));
  drawHudChips(b.c, mkW(ALL));
  check("drawHudChips is byte-identical with and without abilities", JSON.stringify(a.ops) === JSON.stringify(b.ops), a.ops.length + " vs " + b.ops.length);
}

// ---- 7. renderer wiring ----
{
  const texts = (r, w, o) => { const out = []; r.ctx.fillText = (s) => out.push(String(s)); r.render(w, CFG.STEP, o); return out; };
  const mk = (over) => { const w = createWorld(7, 1); loadLevel(w, 1); w.state = "PLAY"; Object.assign(w.players[0], over || {}); return w; };
  initFx();
  check("CLASSIC 2D paints the bar under hud:true", texts(createRenderer(null, { kind: "2d" }), mk({ kick: true }), { hud: true }).includes("KICK"));
  initFx();
  check("hud:false (ATTRACT) paints no bar", !texts(createRenderer(null, { kind: "2d" }), mk({ kick: true }), { hud: false }).includes("KICK"));
  initFx();
  check("?render=iso has no bar (its 352-tall canvas has no free lane)", !texts(createRenderer(null, { kind: "iso" }), mk({ kick: true }), { hud: true }).includes("KICK"));
  const files = [["src/render/renderer.js", /drawAbilityBar\(ctx, world\)/], ["src/render/three/wrapper.js", /drawAbilityBar\(ovCtx,world\)/], ["src/render/pixel/renderer.js", /drawAbilityBar\(ovCtx, world, hudIco\)/]];
  for (const [f, re] of files) {
    const src = readFileSync(f, "utf8"), line = (src.match(/^.*drawAbilityBar\(.*$/m) || [""])[0];
    check(f + ": the bar is gated on hud===true", /o\s*&&\s*o\.hud\s*===\s*true/.test(line) && re.test(line), line.trim());
    check(f + ": drawn right after the HUD chips, before the labels", src.indexOf("drawHudChips(") < src.indexOf("drawAbilityBar(") && src.indexOf("drawAbilityBar(") < src.indexOf("drawPickupFx("));
  }
  const cv = [];
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (...a) => { if (k === "fillText") cv.push(String(a[0])); }), set: (o, k, v) => { o[k] = v; return true; } });
  initFx();
  const r3 = createRenderer3D(null, { getContext: () => ctx }, { audio: null });
  r3.render(mk({ remote: true }), CFG.STEP, { hud: true });
  check("REAL 3D paints the bar on its overlay", cv.includes("REMOTE"), cv.join("|"));
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
