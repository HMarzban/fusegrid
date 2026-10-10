import { CFG } from "../src/core/config.js";
import { POWER } from "../src/core/entities.js";
import {
  pickupLabel, labelText, labelBox, coachKind, drawPickupFx, getLabels, getPulse, LBL,
  feedFx, initFx, syncFx, setFxOpts,
} from "../src/render/fx.js";
import { coachTip } from "../src/app/coach.js";
import { createRenderer } from "../src/render/renderer.js";
import { createRenderer3D, projBoard } from "../src/render/three/wrapper.js";
import { createRig, applyOrbit, CAM_PRESET } from "../src/render/three/camrig.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { PROJ, project } from "../src/render/r3d/camera.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const T = CFG.TILE, ctr = (t) => (t + 0.5) * T;
const P0 = () => ({ alive: true, iFrames: 0, x: ctr(5), y: ctr(5), bombs: 1, range: 1, speed: 3.4, bombKind: "normal" });
const mkW = (over) => ({ state: "PLAY", seed: 1, level: 1, rng: {}, lives: 3, players: [Object.assign(P0(), over || {})], blades: [], events: [] });
const pw = (kind, tx, ty) => ({ t: "power", x: ctr(tx), y: ctr(ty), col: "#fff", kind });
const feed = (w, evs, dt) => { w.events = evs || []; feedFx(w, dt === undefined ? CFG.STEP : dt); w.events = []; };
const fresh = (over) => { initFx(); const w = mkW(over); syncFx(w); feed(w); return w; };

// ---- 1. pickupLabel: the value AFTER the pickup, all 12 kinds, caps ----
{
  const txt = (k, p, prev) => { const l = pickupLabel(k, p, prev); return l ? labelText(l) + (l.sub ? " / " + l.sub : "") : null; };
  const rows = [
    ["fire", { range: 3 }, null, "FLAME 3"], ["fire", { range: CFG.MAX_RANGE }, null, "FLAME MAX"],
    ["bomb", { bombs: 2 }, null, "BOMB 2"], ["bomb", { bombs: CFG.MAX_BOMBS }, null, "BOMB MAX"],
    ["speed", { speed: 4.2 }, null, "SPEED UP"], ["speed", { speed: CFG.MAX_SPEED }, null, "SPEED MAX"],
    ["heart", {}, null, "+1 LIFE"], ["shield", {}, null, "SHIELD"], ["kick", {}, null, "KICK"],
    ["throw", {}, null, "THROW"], ["pass", {}, null, "PASS"], ["remote", {}, null, "REMOTE"],
    ["line", {}, "normal", "LINE BOMB"], ["power", {}, "normal", "POWER BOMB"], ["pierce", {}, "normal", "PIERCE BOMB"],
    ["power", {}, "line", "POWER BOMB / replaces LINE"], ["line", {}, "pierce", "LINE BOMB / replaces PIERCE"],
    ["pierce", {}, "power", "PIERCE BOMB / replaces POWER"], ["line", {}, "line", "LINE BOMB"],
  ];
  for (const [k, p, prev, want] of rows) check("pickupLabel " + k + " " + JSON.stringify(p) + " prev " + prev + " -> " + want, txt(k, p, prev) === want, txt(k, p, prev));
  check("every POWER kind has a label", POWER.every((d) => !!pickupLabel(d.t, {})), POWER.length);
  check("label names come from POWER[].name (no second copy)", POWER.every((d) => labelText(pickupLabel(d.t, {})).includes(d.name) || d.t === "heart"));
  check("an unknown kind has no label", pickupLabel("nope", {}) === null);
  const mx = pickupLabel("fire", { range: CFG.MAX_RANGE });
  check("MAX is its own muted part, never '+1'", mx.s === "FLAME" && mx.m === "MAX" && POWER.every((d) => !labelText(pickupLabel(d.t, {})).includes("+1 ") || d.t === "heart"));
}

// ---- 2. feedFx builds the label from the post-apply player ----
{
  const w = fresh({ range: 2 });
  w.players[0].range = 3;
  feed(w, [pw("fire", 4, 6)]);
  const L = getLabels();
  check("a power event makes one label at its tile", L.length === 1 && L[0].tx === 4 && L[0].ty === 6 && labelText(L[0]) === "FLAME 3", JSON.stringify(L));
  feed(w, [pw("bomb", 9, 9)]);
  w.players[0].bombKind = "line";
  feed(w, [pw("line", 9, 9)]);
  w.players[0].bombKind = "power";
  feed(w, [pw("power", 9, 9)]);
  const pl = getLabels().find((l) => l.k === "power");
  check("a bomb-kind swap reads the PREVIOUS kind from the shadow", pl && pl.sub === "replaces LINE", pl && pl.sub);
  const w2 = fresh();
  w2.players[0].bombKind = "pierce";
  feed(w2, [pw("line", 2, 2), pw("pierce", 3, 2)]);
  const ps = getLabels().find((l) => l.k === "pierce");
  check("two kinds in one batch chain the shadow", ps && ps.sub === "replaces LINE", ps && ps.sub);
}

// ---- 3. merge / stack / drop oldest ----
{
  const w = fresh({ range: 2 });
  feed(w, [pw("fire", 4, 4)]);
  feed(w, [], 0.3);
  w.players[0].range = 3;
  feed(w, [pw("fire", 5, 4)]);
  const L = getLabels();
  check("same kind within life merges: one label, text updated, timer restarted", L.length === 1 && labelText(L[0]) === "FLAME 3" && L[0].t === 0, JSON.stringify(L));
  feed(w, [pw("kick", 5, 5)], 0.1);
  check("a different kind within 250 ms and 1.5 tiles stacks one step higher", getLabels()[1].st === 1, getLabels()[1].st);
  feed(w, [pw("shield", 12, 10)], 0.05);
  check("a far pickup does not stack", getLabels()[2].st === 0, getLabels()[2].st);
  feed(w, [pw("pass", 5, 4)], 0.05);
  const k = getLabels().map((l) => l.k).join(",");
  check("max 3 labels, oldest dropped", getLabels().length === LBL.max && k === "kick,shield,pass", k);
  const w3 = fresh();
  feed(w3, [pw("kick", 2, 2)]);
  feed(w3, [pw("shield", 8, 2)], 0.1);
  feed(w3, [pw("throw", 12, 2)], 0.1);
  feed(w3, [pw("kick", 2, 8)], 0.1);
  feed(w3, [pw("pass", 12, 8)], 0.1);
  const k3 = getLabels().map((l) => l.k).join(",");
  check("drop oldest means the largest t, not array order: a merged label survives", k3 === "kick,throw,pass", k3);
  const w2 = fresh();
  feed(w2, [pw("kick", 4, 4)]);
  feed(w2, [], 0.3);
  feed(w2, [pw("throw", 4, 4)]);
  check("past 250 ms a near pickup does not stack", getLabels()[1].st === 0, getLabels()[1].st);
}

// ---- 4. PLAY-only clock, life, wipe on world change ----
{
  const w = fresh();
  feed(w, [pw("kick", 4, 4)]);
  w.state = "PAUSE";
  for (let i = 0; i < 200; i++) feed(w, [], 0.1);
  check("PAUSE freezes the label clock", getLabels().length === 1 && getLabels()[0].t === 0, getLabels()[0] && getLabels()[0].t);
  w.state = "PLAY";
  feed(w, [], 0.85);
  check("alive before 900 ms", getLabels().length === 1);
  feed(w, [], 0.06);
  check("gone after 900 ms of PLAY", getLabels().length === 0);
  feed(w, [pw("kick", 4, 4)]);
  w.players[0].range = 5;
  feed(w, []);
  check("a range change pulses the FLAME chip", getPulse().r === LBL.pulse, JSON.stringify(getPulse()));
  const w2 = mkW({ range: 9 });
  w2.rng = {};
  syncFx(w2);
  check("a world change wipes labels and pulses", getLabels().length === 0 && getPulse().r === 0);
  feed(w2, []);
  check("the first feed after a wipe only seeds the baseline (no pulse)", getPulse().r === 0 && getPulse().b === 0 && getPulse().l === 0);
  w2.lives = 2;
  w2.players[0].bombs = 2;
  feed(w2, [], 0.1);
  check("lives and bombs changes pulse the heart row and BOMB chip", getPulse().l === LBL.pulse && getPulse().b === LBL.pulse);
  feed(w2, [], 0.4);
  check("the pulse decays on the PLAY clock", Math.abs(getPulse().l - 0.2) < 1e-9, getPulse().l);
}

// ---- 5. labelBox: rise, y46 floor, callout, fade, clamp ----
{
  const L = (o) => Object.assign({ k: "kick", s: "KICK", m: "", sub: "", tx: 7, ty: 6, t: 0, st: 0 }, o);
  const b0 = labelBox(L({ t: 0 }), null, false, null), b1 = labelBox(L({ t: 0.6 }), null, false, null);
  check("the label sits above the tile top and rises 22 px over 600 ms", b0.y === 6 * T - 12 && b1.y === 6 * T - 12 - 22, b0.y + "/" + b1.y);
  check("still (REDUCE FLASH / SHAKE off) does not rise", labelBox(L({ t: 0.6 }), null, true, null).y === b0.y);
  check("a stacked label sits one full line (>= 18 px, the 18 px type) higher", LBL.step >= 18 && labelBox(L({ st: 1 }), null, false, null).y === b0.y - LBL.step, LBL.step);
  const top = labelBox(L({ ty: 1, t: 0.3 }), null, false, null);
  check("a top-row label drops below the tile instead of crossing y46", top.below && top.y > 2 * T && top.y - 9 >= LBL.top, JSON.stringify(top));
  check("the y46 rule never crosses the HUD lane at any phase", [0, 0.2, 0.6, 0.9].every((t) => [1, 2, 3].every((ty) => labelBox(L({ ty, t }), null, false, null).y - 9 >= LBL.top)));
  const cal = labelBox(L({ tx: 7, ty: 3, t: 0 }), null, false, { s: "TRIPLE" });
  check("an above-side label overlapping the combo callout hops over it, clear of y46 and the coach lane", cal.y + 9 <= 96 - 13 && cal.y - 9 >= LBL.top, cal.y);
  const calS = labelBox(L({ tx: 7, ty: 3, t: 0, st: 1 }), null, false, { s: "TRIPLE" });
  check("a stacked one with no room above drops under the callout instead", calS.y - 9 >= 96 + 13, calS.y);
  const calB = labelBox(L({ tx: 7, ty: 1, t: 0 }), null, false, { s: "TRIPLE" });
  check("a below-side label that meets the callout drops under it, never back onto its tile", calB.below && calB.y - 9 >= 96 + 13, calB.y);
  check("a measured callout width replaces the estimate", labelBox(L({ tx: 2, ty: 3 }), null, false, { s: "TRIPLE", w: 520 }).y !== 3 * T - 12);
  check("callout far away leaves the label alone", labelBox(L({ tx: 1, ty: 3 }), null, false, { s: "TRIPLE" }).y === 3 * T - 12);
  check("alpha holds then fades over the last 350 ms", labelBox(L({ t: 0.5 }), null, false, null).a === 1 && Math.abs(labelBox(L({ t: 0.725 }), null, false, null).a - 0.5) < 1e-9);
  const edge = labelBox(L({ tx: 14, s: "PIERCE BOMB" }), null, false, null);
  check("the label is clamped inside the 600 px board", edge.x >= 4 && edge.x + edge.w <= CFG.COLS * T - 4, edge.x + "+" + edge.w);
  const pr = labelBox(L({}), (x, y, h) => ({ x: x + 10, y: y + 100 - (h || 0) }), false, null);
  check("a proj hook moves the anchor (3D path) and the lift applies to the top only", pr.y === 6 * T + 100 - LBL.lift - 12, pr.y);
  const sq = (x, y) => ({ x, y: y * 0.85 }), f0 = labelBox(L({ t: 0 }), sq, false, null), f1 = labelBox(L({ t: 0.6 }), sq, false, null);
  check("the rise scales with the projected tile height (a 34 px far row rises 85% of 22)", f0.y - f1.y === Math.round(LBL.rise * 0.85), f0.y - f1.y);
  const tiny = (x, y) => ({ x, y: 300 + y * 0.1 });
  check("the rise scale floors at half", labelBox(L({ t: 0 }), tiny, false, null).y - labelBox(L({ t: 0.6 }), tiny, false, null).y === LBL.rise / 2);
  check("a measured word width replaces the per-character estimate", labelBox(L({ tw: 100 }), null, false, null).w === 118);
  const wide = labelBox(L({ tx: 14, s: "PIERCE BOMB" }), null, false, null, 608);
  check("bw widens the x clamp (the 608 px iso canvas)", wide.x + wide.w <= 604 && wide.x > edge.x, wide.x + " vs " + edge.x);
}

// ---- 6. coach suppression ----
{
  for (const k of ["kick", "throw", "remote"]) check("coachKind never parses the tip text (" + k + "): no k, no suppression", coachKind({ a: 0.5, s: coachTip(k) }) === null, coachTip(k));
  check("coachKind prefers an explicit k", coachKind({ a: 0.5, s: "", k: "pass" }) === "pass");
  check("a closed panel suppresses nothing", coachKind({ a: 0, s: coachTip("kick"), k: "kick" }) === null && coachKind(null) === null);
  const main = readFileSync("src/main.js", "utf8");
  check("main passes the coach kind on the coach2 render opt", /coach2:[^\n]*k: coach2\.kind/.test(main));
}

// ---- 7. drawPickupFx: idle emits nothing, live paints icon + word ----
const rec = () => {
  const ops = [];
  const c = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : (...a) => { ops.push([k, a]); }),
    set: (o, k, v) => { ops.push(["=" + k, v]); o[k] = v; return true; },
  });
  return { c, ops };
};
{
  setFxOpts({ flashK: 1, shakeK: 1 });
  const w = fresh();
  const a = rec();
  drawPickupFx(a.c, {});
  check("idle drawPickupFx emits zero ops (call logs byte-identical)", a.ops.length === 0, a.ops.length);
  w.players[0].range = CFG.MAX_RANGE;
  feed(w, [pw("fire", 7, 6)]);
  const b = rec();
  drawPickupFx(b.c, {});
  const fills = b.ops.filter((o) => o[0] === "fillText").map((o) => o[1][0]);
  const strokes = b.ops.filter((o) => o[0] === "strokeText").map((o) => o[1][0]);
  check("a live label strokes then fills FLAME and MAX", fills.join("|") === "FLAME|MAX" && strokes.join("|") === "FLAME|MAX", fills.join("|"));
  const styles = b.ops.filter((o) => o[0] === "=fillStyle").map((o) => o[1]);
  check("word #eef3ff, MAX muted #9fb3d8", styles.includes("#eef3ff") && styles.includes("#9fb3d8"));
  check("font is 900 18px mono with a 4 px dark stroke", b.ops.some((o) => o[0] === "=font" && o[1] === "900 18px ui-monospace,monospace") && b.ops.some((o) => o[0] === "=lineWidth" && o[1] === 4));
  check("the pulse outlines the FLAME chip once its value changed", b.ops.some((o) => o[0] === "strokeRect" && o[1][0] === 224 - 2), JSON.stringify(b.ops.filter((o) => o[0] === "strokeRect")));
  const ic = [];
  const d = rec();
  drawPickupFx(d.c, { ico: (c, t, col, x, y) => ic.push([t, x, y]) });
  check("PIXEL's icon painter replaces drawIcon", ic.length === 1 && ic[0][0] === "fire" && !d.ops.some((o) => o[0] === "scale"), JSON.stringify(ic));
  const w4 = fresh();
  feed(w4, [pw("kick", 7, 6), pw("throw", 8, 6)]);
  const g = rec();
  drawPickupFx(g.c, { proj: (x, y) => ({ x, y: y + x / 4 }) });
  const ys = {};
  for (const o of g.ops) if (o[0] === "fillText") ys[o[1][0]] = o[1][2];
  check("a stacked pair the projection skews back together (iso diagonal) is pushed a full line apart", Math.abs(ys.KICK - ys.THROW) >= LBL.step, JSON.stringify(ys));
  check("every live label icon sits on a mid-slate disc with a dark rim (dark PIXEL glyphs read on any floor)", g.ops.filter((o) => o[0] === "arc").length === 2 && g.ops.some((o) => o[0] === "=fillStyle" && o[1] === "#3b4868"));
  const w6 = fresh();
  feed(w6, [pw("kick", 7, 6)]);
  feed(w6, [], 0.3);
  feed(w6, [pw("throw", 7, 6)]);
  let prevY = null, back = 0, n = 0;
  for (let i = 0; i < 40 && getLabels().some((l) => l.k === "throw"); i++) {
    const h = rec();
    drawPickupFx(h.c, {});
    const fy = {};
    for (const o of h.ops) if (o[0] === "fillText") fy[o[1][0]] = o[1][2];
    if (fy.THROW !== undefined && fy.KICK !== undefined) { n++; if (Math.abs(fy.THROW - fy.KICK) < LBL.step) back = 99; }
    if (prevY !== null && fy.THROW !== undefined) back = Math.max(back, fy.THROW - prevY);
    if (fy.THROW !== undefined) prevY = fy.THROW;
    feed(w6, [], CFG.STEP);
  }
  check("two rise phases on one tile never overlap and the pushed label never snaps back toward its tile", n > 5 && back <= 2, "frames " + n + " worst back " + back);
  const w5 = fresh({ range: 2 });
  w5.players[0].range = 3;
  feed(w5, [pw("fire", 7, 6)]);
  const e = rec();
  drawPickupFx(e.c, { coach: { a: 1, s: "", k: "fire" } });
  check("the coach panel's own kind suppresses its label", !e.ops.some((o) => o[0] === "fillText"));
  const f = rec();
  drawPickupFx(f.c, {});
  check("a suppressed label stays suppressed after the panel closes", !f.ops.some((o) => o[0] === "fillText"));
}

// ---- 8. renderer wiring: GAME paints, hud:false (ATTRACT) does not ----
{
  const texts = (r, w, o) => {
    const out = [];
    r.ctx.fillText = (s) => out.push(String(s));
    w.events.push(pw("kick", 6, 6));
    r.render(w, CFG.STEP, o);
    return out;
  };
  const mk = () => { const w = createWorld(7, 1); loadLevel(w, 1); w.state = "PLAY"; return w; };
  initFx();
  const r = createRenderer(null, { kind: "2d" });
  check("CLASSIC 2D paints the label under hud:true", texts(r, mk(), { hud: true }).includes("KICK"));
  initFx();
  check("CLASSIC 2D paints no label under hud:false (ATTRACT)", !texts(createRenderer(null, { kind: "2d" }), mk(), { hud: false }).includes("KICK"));
  for (const f of ["src/render/renderer.js", "src/render/three/wrapper.js", "src/render/pixel/renderer.js"]) {
    const src = readFileSync(f, "utf8"), line = (src.match(/^.*drawPickupFx\(.*$/m) || [""])[0];
    check(f + ": drawPickupFx is gated on hud===true and PLAY", /o\s*&&\s*o\.hud\s*===\s*true\s*&&\s*world\.state\s*===\s*"PLAY"/.test(line), line.trim());
    check(f + ": drawn after the HUD chips and before the coach", src.indexOf("drawHudChips(") < src.indexOf("drawPickupFx(") && src.indexOf("drawPickupFx(") < src.lastIndexOf("drawCoach("));
  }
  const at = (r, tx, ty) => {
    const out = [];
    r.ctx.fillText = (t, x, y) => out.push([String(t), x, y]);
    const w = mk();
    w.events.push(pw("kick", tx, ty));
    r.render(w, CFG.STEP, { hud: true });
    return out.find((o) => o[0] === "KICK");
  };
  initFx();
  const iso = at(createRenderer(null, { kind: "iso" }), 3, 11), w0 = 18 + 4 * 10.8;
  const ic = project(3.5, 11.5), itop = project(3.5, 11);
  check("?render=iso projects the label through the dimetric camera: centred on the tile, above it, on the 608x352 canvas",
    iso && Math.abs(iso[1] - 18 + w0 / 2 - ic.sx) < 1 && iso[2] < itop.sy && iso[2] > 0 && iso[2] < PROJ.canvasH, JSON.stringify(iso) + " tile " + JSON.stringify(ic));
  initFx();
  const flat = at(createRenderer(null, { kind: "2d" }), 3, 11);
  check("CLASSIC 2D keeps board space for the same pickup (x 140, y past 352)", flat && Math.abs(flat[1] - 18 + w0 / 2 - ctr(3)) < 1 && flat[2] > PROJ.canvasH, JSON.stringify(flat));
  check("renderer.js hands the iso branch its projector and canvas width", /kind==="3d"\?\{coach:o\.coach2,proj:isoProj,bw:PROJ\.canvasW\}/.test(readFileSync("src/render/renderer.js", "utf8")));
  check("PIXEL passes its icon painter", /drawPickupFx\(ovCtx, \{[^}]*ico: hudIco/.test(readFileSync("src/render/pixel/renderer.js", "utf8")));
  check("REAL 3D passes the live projection", /drawPickupFx\(ovCtx,\{[^}]*proj\}/.test(readFileSync("src/render/three/wrapper.js", "utf8")));
}

// ---- 9. projBoard: the live camera, every call ----
{
  const r3 = createRenderer3D(null, null, {});
  const cam = r3._dbg.camera, W = CFG.COLS * T, H = CFG.ROWS * T;
  const rig = createRig();
  applyOrbit(cam, rig, { x: 0, y: 0 });
  const mid = projBoard(cam, W / 2, H / 2, 0);
  check("the board centre projects near the overlay centre", Math.abs(mid.x - W / 2) < 1 && Math.abs(mid.y - H / 2) < 60, JSON.stringify(mid));
  const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => projBoard(cam, x, y, 0));
  check("all four board corners land inside the 600x520 overlay", corners.every((p) => p.x > 0 && p.x < W && p.y > 0 && p.y < H), JSON.stringify(corners));
  check("near corners are wider than far ones (perspective)", corners[3].x - corners[2].x > corners[1].x - corners[0].x);
  const a = projBoard(cam, ctr(2), ctr(2), 0);
  for (const dist of CAM_PRESET.slice(1)) {
    rig.dist = dist;
    applyOrbit(cam, rig, { x: 0, y: 0 });
    const b = projBoard(cam, ctr(2), ctr(2), 0);
    check("a dolly to " + dist + " moves the projected tile toward the centre", Math.abs(b.x - W / 2) < Math.abs(a.x - W / 2) && Math.abs(b.y - H / 2) < Math.abs(a.y - H / 2), JSON.stringify(b));
  }
  const up = projBoard(cam, W / 2, H / 2, 40), dn = projBoard(cam, W / 2, H / 2, 0);
  check("world height lifts the point up the screen", up.y < dn.y);
  initFx();
  const w = createWorld(7, 1); loadLevel(w, 1); w.state = "PLAY";
  const out = [];
  r3.ctx.fillText = (s) => out.push(String(s));
  w.events.push(pw("throw", 6, 6));
  r3.render(w, CFG.STEP, { hud: true });
  check("REAL 3D paints the label on the overlay", out.includes("THROW"), out.join("|"));
}

// ---- 10. the "replaces X" sub-line: phone-legible and part of the label's height ----
{
  setFxOpts({ flashK: 1, shakeK: 1 });
  const boxes = (ops) => {
    const out = [];
    let font = "";
    for (const o of ops) {
      if (o[0] === "=font") font = o[1];
      if (o[0] !== "fillText") continue;
      const [s, x, y] = o[1], px = +(/(\d+)px/.exec(font) || [0, 18])[1];
      out.push({ s, y0: y - px / 2, y1: y + px / 2, px, sub: s.startsWith("replaces ") });
    }
    return out;
  };
  const run = (ty, seq) => {
    const w = fresh();
    let worst = 99, frames = 0, subPx = 0;
    seq.forEach(([k, tx], i) => { w.players[0].bombKind = k; feed(w, [pw(k, tx, ty)], i ? 0.1 : CFG.STEP); });
    for (let i = 0; i < 50 && getLabels().length; i++) {
      const r = rec();
      drawPickupFx(r.c, {});
      const B = boxes(r.ops);
      if (B.some((b) => b.sub)) frames++;
      for (const b of B) if (b.sub) subPx = b.px;
      for (const p of B) for (const q of B) if (p !== q && p.y0 <= q.y0) worst = Math.min(worst, q.y0 - p.y1);
      feed(w, [], CFG.STEP);
    }
    return { worst, frames, subPx };
  };
  for (const [side, ty] of [["above", 6], ["below", 1]]) {
    const a = run(ty, [["line", 7], ["power", 8]]);
    check("LINE then POWER on adjacent tiles (" + side + " the tile): the sub-line is drawn", a.frames > 5, a.frames);
    check("LINE then POWER (" + side + "): POWER's sub-line and LINE's text never intersect", a.worst >= 0, "min gap " + a.worst);
    const b = run(ty, [["line", 7], ["power", 8], ["pierce", 7]]);
    check("LINE, POWER, PIERCE chained (" + side + "): no two lines of text ever intersect", b.worst >= 0, "min gap " + b.worst);
    check("the sub-line is at least 13 px (about 8 CSS px on a phone)", a.subPx >= 13, a.subPx);
  }
  const L = (o) => Object.assign({ k: "power", s: "POWER BOMB", m: "", sub: "", tx: 7, ty: 6, t: 0, st: 0 }, o);
  const plain = labelBox(L({}), null, true, null), withSub = labelBox(L({ st: 1, sub: "replaces LINE" }), null, true, null);
  check("a stacked label with a sub sits its full 36 px higher above the tile", plain.y - withSub.y === LBL.step + LBL.subH && withSub.dn === LBL.subDn, plain.y + "/" + withSub.y);
  const lo = labelBox(L({ ty: 1 }), null, true, null), lo2 = labelBox(L({ ty: 1, st: 1, sb: true }), null, true, null);
  check("below the tile a label stacked on one with a sub clears that sub", lo.below && lo2.y - lo.y === LBL.step + LBL.subH, lo.y + "/" + lo2.y);
  const cs = labelBox(L({ tx: 7, ty: 4, sub: "replaces LINE" }), null, true, { s: "TRIPLE" });
  check("a label with a sub hops the callout with its sub clear of the callout too", cs.y + LBL.subDn <= 96 - 13 || cs.y - 9 >= 96 + 13, cs.y);
  const co = labelBox(L({ tx: 7, ty: 4 }), null, true, null, 600, 300);
  check("an open coach v2 panel is routed around like the callout", co.y + 9 <= 130 - 13 || co.y - 9 >= 130 + 13, co.y);
  check("a shut coach panel leaves the label alone", labelBox(L({ tx: 7, ty: 4 }), null, true, null, 600, 0).y === 4 * T - 12);
  const iso = labelBox(L({ tx: 7, ty: 3 }), null, true, { s: "TRIPLE", w: 100 }, 608);
  check("the callout centres on the overlay width passed in (iso 608)", iso.y !== 3 * T - 12 || 3 * T - 12 - 9 > 96 + 13);
}

// ---- 11. heart-row pulse stays clear of the BOMB chip pulse ----
{
  setFxOpts({ flashK: 1, shakeK: 1 });
  const w = fresh();
  w.lives = 9; w.players[0].bombs = 2;
  feed(w, [], 0.01);
  const r = rec();
  drawPickupFx(r.c, {});
  const rs = r.ops.filter((o) => o[0] === "strokeRect").map((o) => o[1]);
  const heart = rs.find((a) => a[0] === 3), bomb = rs.find((a) => a[0] === 138);
  check("with lives > 6 the heart pulse box (plus its 4 px stroke) ends before the BOMB chip pulse at 136", heart && bomb && heart[0] + heart[2] + 2 <= bomb[0] - 2, JSON.stringify(rs));
}

console.log("\n  PICKUP LABEL RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
