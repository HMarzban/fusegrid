// v202 delivery review fixes 1, 3 and 4: a held run start. A deep link straight into a run
// (?play=1, ?code=, ?render=3d&play=1) whose lazy look is not on screen yet holds behind the
// plate, the sim frozen, while the look's job runs (a held start is idle for jobs); it starts
// on the swap, or in CLASSIC for this session when the look fails at boot (the saved setting
// stays, the next boot retries). The gen-3 hold gains BACK TO MENU, and two held starts run
// onStart once.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHold } from "../src/app/lazyload.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const run = (code) => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: ROOT, encoding: "utf8" });
  return { out: r.status === 0 ? JSON.parse(r.stdout.trim().split("\n").pop()) : null, err: (r.stderr || "").slice(process.env.DH_ERR ? -1500 : 0, process.env.DH_ERR ? undefined : 400) };
};

/* a page: window + localStorage, a stub __load that logs, and a fake lazy renderer with
   prepare (steps through job.step(), so it parks whenever the gate says not idle) / activate */
const PAGE = (search, saved, prep) => `
  const mem = ${JSON.stringify(saved ? { "nb.settings.v1": JSON.stringify(saved) } : {})};
  const LS = {}; globalThis.window = { addEventListener: (ty, f) => { (LS[ty] = LS[ty] || []).push(f); }, removeEventListener() {}, innerWidth: 1440, innerHeight: 900, open() {},
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } } };
  globalThis.location = { search: ${JSON.stringify(search)}, reload() {} };
  const L = [];
  globalThis.__load = { begin: (k, p, r) => L.push("begin:" + k), phase: (k) => L.push("phase:" + k), progress() {}, focus() {}, end: (k, f) => L.push("end:" + k + (f ? "!" : "")), miss: (k, kept) => L.push("miss:" + k + ">" + kept), fail: (k, d, a, l) => L.push("fail:" + k + ":" + l), spot() {}, wants: () => false };
  await import("./src/core/board3.js");
  const { createGame } = await import("./src/main.js");
  const { SCREEN, OPT_ROWS } = await import("./src/app/menuapp.js");
  const made = [];
  const fake = (tag) => (el, cv, o) => {
    const r = { tag, renders: 0, activated: 0, steps: 0, render() { r.renders++; }, consumeEvents() {}, setPerf() {}, invalidate() {}, activate() { r.activated++; }, liveAA: tag === "3d" ? true : undefined,
      prepare: (job) => (async () => { for (let i = 0; i < 6; i++) { await job.step(); r.steps++; } ${prep === "fail" ? 'throw new Error("link");' : prep === "never" ? "await new Promise(() => {});" : ""} })() };
    made.push(r);
    return r;
  };
  const g = createGame(null, { seed: 42, createPixelRenderer: fake("px"), createRenderer3D: fake("3d") });
  let t = 0;
  const tick = (n) => { for (let i = 0; i < n; i++) { t += 1000 / 60; g.loop(t); } };
  const key = (code) => { for (const ty of ["keydown", "keyup"]) (LS[ty] || []).forEach((f) => f({ code, key: code === "Escape" ? "Escape" : code, repeat: false, preventDefault() {}, stopPropagation() {} })); };
  const wait = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 1)); };
`;

/* fix 1: ?play=1 with a saved PIXEL look, a page loader present */
{
  const { out, err } = run(PAGE("?play=1", { px: 1 }, "ok") + `
    const s0 = g.app.screen;
    tick(30);
    const held = { screen: g.app.screen === SCREEN.GAME, tick: g.world.tick, gen: g.world.gen, renderer: g.renderer.tag || "classic" };
    for (let i = 0; i < 100 && !(g.renderer && g.renderer.tag === "px"); i++) { await wait(2); tick(1); }
    const swapped = { renderer: g.renderer.tag, activated: made[0] && made[0].activated, steps: made[0] && made[0].steps };
    tick(30);
    console.log(JSON.stringify({ held, swapped, after: { tick: g.world.tick, gen: g.world.gen, seed: g.world.seed, feat: !!g.world.feat, screen: g.app.screen === SCREEN.GAME, pixel: g.app.pixel }, saved: JSON.parse(mem["nb.settings.v1"]).px, L }));
    process.exit(0);`);
  check("deep link + saved PIXEL + page loader: the run start holds in GAME, the sim frozen and the board not dealt", !!out && out.held.screen && out.held.tick === 0 && out.held.gen === 1, err || JSON.stringify(out && out.held));
  check("the look's job runs during the hold (a held start is idle for jobs): prepared, then swapped in with no key pressed", !!out && out.swapped.renderer === "px" && out.swapped.activated === 1 && out.swapped.steps === 6, out && JSON.stringify(out.swapped));
  check("then the run starts: gen 3 dealt from the boot seed, the sim steps, in PIXEL", !!out && out.after.tick > 0 && out.after.gen === 3 && out.after.feat && out.after.seed === 42 && out.after.screen && out.after.pixel, out && JSON.stringify(out.after));
  check("the loader saw the look's plate begin during the boot (PREPARING PIXEL), never a miss", !!out && out.L.includes("begin:px") && !out.L.some((s) => s.startsWith("miss")), out && out.L.join());
}
{
  const { out, err } = run(PAGE("?render=3d&play=1", null, "ok") + `
    tick(30);
    const t0 = g.world.tick;
    for (let i = 0; i < 100 && !(g.renderer && g.renderer.tag === "3d"); i++) { await wait(2); tick(1); }
    tick(20);
    console.log(JSON.stringify({ t0, tag: g.renderer.tag, tick: g.world.tick, gen: g.world.gen }));
    process.exit(0);`);
  check("?render=3d&play=1 (no saved look): held frozen, then REAL 3D swaps in and the run steps", !!out && out.t0 === 0 && out.tag === "3d" && out.tick > 0 && out.gen === 3, err || JSON.stringify(out));
}
{
  const { out, err } = run(PAGE("?code=F3", { px: 1 }, "ok").replace('"?code=F3"', "(await import('./src/app/code.js')).encodeChallenge ? '?code=' + (await import('./src/app/code.js')).encodeChallenge({ seed: 77, heat: 0, pact: 0, pace: 0, gen: 3 }) : '?code='") + `
    tick(30);
    const t0 = g.world.tick;
    for (let i = 0; i < 100 && !(g.renderer && g.renderer.tag === "px"); i++) { await wait(2); tick(1); }
    tick(20);
    console.log(JSON.stringify({ t0, tag: g.renderer.tag, tick: g.world.tick, seed: g.world.seed }));
    process.exit(0);`);
  check("?code= + saved PIXEL: held, then PIXEL swaps in and the code's board runs", !!out && out.t0 === 0 && out.tag === "px" && out.tick > 0 && out.seed === 77, err || JSON.stringify(out));
}
/* fix 3 (+1): the saved look fails at boot */
{
  const { out, err } = run(PAGE("?play=1", { px: 1, mus: 40 }, "fail") + `
    const before = mem["nb.settings.v1"];
    tick(10);
    for (let i = 0; i < 100 && g.world.tick === 0; i++) { await wait(2); tick(1); }
    tick(20);
    const after = { tick: g.world.tick, gen: g.world.gen, pixel: g.app.pixel, job: g.app.lookJob && g.app.lookJob.k + ":" + g.app.lookJob.state, same: mem["nb.settings.v1"] === before };
    g.app.toMenu(); g.app.screen = SCREEN.SETTINGS; // OPTIONS: an idle state, so the retry job runs
    g.app.optRow = g.app.optRows().indexOf("ART STYLE");
    const retry = g.app.optCycle(), pixelAfterRetry = g.app.pixel;
    for (let i = 0; i < 100 && g.app.pixel; i++) { await wait(2); tick(1); }
    const again = { pixel: g.app.pixel, savedPx: JSON.parse(mem["nb.settings.v1"]).px, built: made.length };
    console.log(JSON.stringify({ after, retry, pixelAfterRetry, again, savedPx: JSON.parse(mem["nb.settings.v1"]).px, L }));
    process.exit(0);`);
  check("a saved look that fails at boot: the held run starts in CLASSIC for this session (gen 3, the sim steps)", !!out && out.after.tick > 0 && out.after.gen === 3 && out.after.pixel === false, err || JSON.stringify(out && out.after));
  check("nb.settings.v1 is left exactly as saved (px stays 1): the next boot retries", !!out && out.after.same && out.savedPx === 1, out && JSON.stringify(out.after));
  check("the chip says it (__load.miss(px, CLASSIC 2D)) and the RENDER row shows the failure", !!out && out.L.includes("miss:px>CLASSIC 2D") && out.after.job === "px:failed", out && out.L.join() + " " + out.after.job);
  check("Enter on the RENDER row retries the saved look (the pick moves back to PIXEL)", !!out && out.retry === true && out.pixelAfterRetry === true);
  check("a retry that fails again is still session-only: CLASSIC on screen, nb.settings.v1 still says PIXEL", !!out && out.again.built === 2 && out.again.pixel === false && out.again.savedPx === 1, out && JSON.stringify(out.again));
}
/* fix 4 (look hold): P / Escape (the real keydown listeners) on a held start go back to MENU, no run */
for (const code of ["Escape", "KeyP"]) {
  const { out, err } = run(PAGE("?play=1", { px: 1 }, "never") + `
    tick(10);
    key("${code}");
    tick(10);
    await wait(20);
    tick(10);
    console.log(JSON.stringify({ menu: g.app.screen === SCREEN.MENU, tick: g.world.tick, gen: g.world.gen, inGame: g.app.inGame }));
    process.exit(0);`);
  check(code + " while a deep link's look holds the start: back to MENU, the run never starts", !!out && out.menu && out.tick === 0 && out.gen === 1 && !out.inGame, err || JSON.stringify(out));
}

/* fix 4: createHold, the gen-3 hold's exit and one start per run */
{
  const L = [], runs = [];
  let menus = 0, rej = null, res = null, ok = false, loads = 0;
  const fake = { begin: (k) => L.push("begin:" + k), end: (k, f) => L.push("end:" + k + (f ? "!" : "")), fail: (k, d, a, l) => { L.push("fail:" + k + ":" + l); fake.drop = d; fake.again = a; } };
  const load = () => { loads++; return new Promise((a, b) => { res = () => { ok = true; a(); }; rej = () => b(new Error("offline")); }); };
  const h = createHold({ run: (a) => runs.push(a), menu: () => menus++, ok: () => ok, load, L: fake });
  check("a gen-3 start with gen 3 missing holds and puts up FLOOR TILES", h.start({ level: 1 }) === true && h.on && h.why === "gen3" && L.join() === "begin:tiles");
  check("a second start while held joins it: no second fetch", h.start({ level: 2 }) === true && loads === 1);
  rej();
  await new Promise((r) => setTimeout(r, 0));
  check("a failed fetch is the card with RETRY and BACK TO MENU", L.includes("fail:tiles:BACK TO MENU") && typeof fake.drop === "function" && typeof fake.again === "function");
  fake.again();
  check("RETRY fetches again behind the plate", loads === 2 && L[L.length - 1] === "begin:tiles");
  res();
  await new Promise((r) => setTimeout(r, 0));
  check("gen 3 in: the start runs ONCE, with the latest args (one run_start per run)", runs.length === 1 && runs[0].level === 2 && !h.on && menus === 0);
  ok = false;
  h.start({ level: 3 });
  rej();
  await new Promise((r) => setTimeout(r, 0));
  fake.drop();
  check("BACK TO MENU (Escape, the pad's back word, a tap on the second button) cancels the held start and goes to MENU", !h.on && menus === 1 && runs.length === 1 && L[L.length - 1] === "end:tiles!");
  h.start({ level: 4 });
  check("P / Escape while it loads cancels too; a late success never starts that run", h.cancel() === true && menus === 2);
  res();
  await new Promise((r) => setTimeout(r, 0));
  check("(the late fetch landed, the cancelled start stayed dropped)", runs.length === 1 && !h.on);
  check("cancel with nothing held is a no-op (P in a live run still pauses)", h.cancel() === false && menus === 2);
  let lk = true;
  const h2 = createHold({ run: (a) => runs.push(a), menu: () => {}, ok: () => true, look: () => lk, L: null });
  check("a start whose look is not on screen holds; release() waits for it", h2.start({ level: 5 }) === true && h2.why === "look" && (h2.release(), runs.length === 1));
  lk = false;
  h2.release();
  check("the look on screen: release() runs the start once", runs.length === 2 && runs[1].level === 5 && !h2.on && (h2.release(), runs.length === 2));
}
/* fix 4 in createGame: gen 3 not loaded, two starts while held, then P */
{
  const BASE = `
    const mem = {};
    const LS = {}; globalThis.window = { addEventListener: (ty, f) => { (LS[ty] = LS[ty] || []).push(f); }, removeEventListener() {}, innerWidth: 1440, innerHeight: 900, open() {},
      localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } } };
    globalThis.location = { search: "", reload() {} };
    const L = [];
    globalThis.__load = { begin: (k) => L.push("begin:" + k), phase() {}, progress() {}, focus() {}, end: (k, f) => L.push("end:" + k + (f ? "!" : "")), miss() {}, fail() {}, spot() {}, wants: () => false };
    const { createGame } = await import("./src/main.js");
    const { hasGen3 } = await import("./src/core/board2.js");
    const { SCREEN } = await import("./src/app/menuapp.js");
    const g = createGame(null, { seed: 42 });
    let t = 0;
    const tick = (n) => { for (let i = 0; i < n; i++) { t += 1000 / 60; g.loop(t); } };
    const key = (code) => { for (const ty of ["keydown", "keyup"]) (LS[ty] || []).forEach((f) => f({ code, key: code === "Escape" ? "Escape" : code, repeat: false, preventDefault() {}, stopPropagation() {} })); };
    tick(2); g.app.skip(); tick(2);`;
  const two = run(BASE + `
    g.app.startRun(); g.app.toMenu(); g.app.startRun();
    for (let i = 0; i < 200 && !hasGen3(); i++) await new Promise((r) => setTimeout(r, 5));
    await new Promise((r) => setTimeout(r, 0));
    tick(10);
    console.log(JSON.stringify({ seed: g.world.seed, next: g.world.nextSeed, gen: g.world.gen, tick: g.world.tick }));
    process.exit(0);`);
  const { runSeed } = await import("../src/core/rng.js");
  check("two starts while the gen-3 hold is up run onStart once (the first run's seed, the second armed)", !!two.out && two.out.seed === 42 && two.out.next === runSeed(42, 1) && two.out.gen === 3 && two.out.tick > 0, two.err || JSON.stringify(two.out));
  for (const code of ["Escape", "KeyP"]) {
  const esc = run(BASE + `
    g.app.startRun();
    tick(3);
    key("${code}");
    const menu = g.app.screen === SCREEN.MENU;
    for (let i = 0; i < 200 && !hasGen3(); i++) await new Promise((r) => setTimeout(r, 5));
    await new Promise((r) => setTimeout(r, 0));
    tick(10);
    console.log(JSON.stringify({ menu, still: g.app.screen === SCREEN.MENU, gen: g.world.gen, L }));
    process.exit(0);`);
  check(code + " on the FLOOR TILES hold: MENU at once, its plate ended, and the late gen 3 starts nothing", !!esc.out && esc.out.menu && esc.out.still && esc.out.gen === 1 && esc.out.L.includes("end:tiles!"), esc.err || JSON.stringify(esc.out));
  }
}

console.log(fail ? "DELIVERY HOLD FAIL" : "DELIVERY HOLD OK", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
