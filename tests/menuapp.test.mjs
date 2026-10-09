import {
  SCREEN,
  ITEMS,
  OPT_ROWS,
  GUIDE_ROWS,
  SOURCE_URL,
  IDLE_T,
  createMenuApp,
} from "../src/app/menuapp.js";
import { SHOW_DUR, TITLE_IN } from "../src/app/intro.js";
import { Input } from "../src/input.js";
import { createAudio } from "../src/audio.js";
import { readFileSync } from "node:fs";

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

// update() input contract: {input:{up,down,left,right}, confirmHeld:boolean}
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

// ---- surface & frozen enums ----
check(
  "SCREEN frozen with BOOT..GAME",
  Object.isFrozen(SCREEN) &&
    SCREEN.BOOT === 0 &&
    SCREEN.INTRO === 1 &&
    SCREEN.MENU === 2 &&
    SCREEN.LEVEL === 3 &&
    SCREEN.HOWTO === 4 &&
    SCREEN.SCORES === 5 &&
    SCREEN.GAME === 6,
  JSON.stringify(SCREEN),
);
check(
  "ITEMS frozen, 8 entries",
  Object.isFrozen(ITEMS) &&
    ITEMS.length === 8 &&
    ITEMS[0] === "PLAY" &&
    ITEMS[2] === "DAILY" &&
    ITEMS[3] === "OPTIONS" &&
    ITEMS[4] === "GUIDE" &&
    ITEMS[6] === "STATS" &&
    ITEMS[7] === "SOURCE",
  JSON.stringify(ITEMS),
);
check(
  "SETTINGS appended at 10, GUIDE at 11, STATS at 12 — never inserted",
  SCREEN.SETTINGS === 10 &&
    SCREEN.GUIDE === 11 &&
    SCREEN.STATS === 12 &&
    SCREEN.ENEMIES === 9 &&
    SCREEN.ITEMS === 8,
  JSON.stringify(SCREEN),
);
check(
  "GUIDE_ROWS frozen, the three folded rows in order",
  Object.isFrozen(GUIDE_ROWS) &&
    GUIDE_ROWS.join("|") === "HOW TO PLAY|ITEMS|ENEMIES",
  GUIDE_ROWS.join("|"),
);
check(
  "OPT_ROWS frozen, the nine spec rows in order",
  Object.isFrozen(OPT_ROWS) &&
    OPT_ROWS.join("|") ===
      "MUSIC|SFX|SOUND|RENDER|CAMERA|BRIGHTNESS|SCREEN SHAKE|REDUCE FLASH|RESET DEFAULTS",
  OPT_ROWS.join("|"),
);
check(
  "SOURCE_URL is the public repo",
  SOURCE_URL === "https://github.com/HMarzban/fusegrid",
);
{
  const a = createMenuApp();
  const surf = [
    "screen",
    "cursor",
    "level",
    "sound",
    "render3d",
    "subT",
    "repT",
    "repDir",
    "prevConfirm",
    "update",
    "key",
    "confirm",
    "back",
    "skip",
    "move",
    "startRun",
    "noteWorldEdge",
    "quitToMenu",
    "toMenu",
  ];
  check(
    "surface complete (spec §7 + quitToMenu/toMenu)",
    surf.every((k) => k in a),
    surf.filter((k) => !(k in a)).join(","),
  );
  check(
    "fn-typed members",
    [
      "update",
      "key",
      "confirm",
      "back",
      "skip",
      "move",
      "startRun",
      "noteWorldEdge",
      "quitToMenu",
      "toMenu",
    ].every((k) => typeof a[k] === "function"),
  );
}

// ---- boot state ----
{
  const a = createMenuApp();
  check("boots into INTRO (BOOT folded)", a.screen === SCREEN.INTRO, a.screen);
  check(
    "defaults: level 1, sound on, 2d, not inGame",
    a.level === 1 &&
      a.sound === true &&
      a.render3d === false &&
      a.inGame === false,
  );
}
{
  const a = createMenuApp({ autoplay: true });
  check(
    "autoplay boots straight into GAME+inGame",
    a.screen === SCREEN.GAME && a.inGame === true,
  );
}
{
  const a = createMenuApp({ level: 9, sound: false, render3d: true });
  check(
    "opts: level clamped 1..5, sound/render3d honored",
    a.level === 5 && a.sound === false && a.render3d === true,
  );
}

// ---- opening (spec 2026-10-09 §6/§8): INTRO is title (stage 0) then show
// (stage 1). The title ignores every gesture (main's armUnlock calls
// beginShow); the show skips on any gesture past SKIP_GUARD. skip() stays the
// ungated programmatic jump. Every visit, the first included, lands on MENU
// at cursor 0 (reverses plan 7's first-visit Play Now). ----
const ALLKEYS = ["Enter", "NumpadEnter", "Escape", "Backspace", "ArrowUp", "KeyW", "ArrowDown", "KeyS",
  "ArrowLeft", "KeyA", "ArrowRight", "KeyD", "KeyR", "KeyM", "KeyQ", "KeyT", "Digit1", "BracketLeft", "Space"];
const inShow = (o) => { const a = createMenuApp(o); a.beginShow(); frames(a, 13, DT, null, false); return a; }; // past the 0.2 s guard
{
  const a = createMenuApp({ cabinetSeen: true });
  a.skip();
  check("skip(): INTRO->MENU (seen cabinet)", a.screen === SCREEN.MENU);
  check(
    "skip() outside INTRO is no-op",
    a.skip() === false && a.screen === SCREEN.MENU,
  );
  const b = createMenuApp();
  b.beginShow();
  b.skip();
  check("skip() from the show is the same direct jump (ungated)", b.screen === SCREEN.MENU && b.cursor === 0);
}
{
  const bad = [];
  for (const c of ALLKEYS) {
    const a = createMenuApp();
    a.key(c);
    a._tapMove(1, false);
    a.confirm();
    a.skipShow();
    frames(a, 3, DT, { down: true }, true);
    if (a.screen !== SCREEN.INTRO || a.introStage !== 0) bad.push(c);
  }
  check("title: every key, _tapMove, confirm, skipShow and a rising confirmHeld leave INTRO stage 0", bad.length === 0, bad.join());
}
{
  const a = createMenuApp();
  a.subT = 1.7;
  check("beginShow(): stage 1, pressT = title subT, subT 0, prevConfirm true",
    a.beginShow() === true && a.introStage === 1 && a.pressT === 1.7 && a.subT === 0 && a.prevConfirm === true);
  check("beginShow() again is a no-op", a.beginShow() === false && a.introStage === 1);
  const m = createMenuApp({ cabinetSeen: true });
  m.skip();
  check("beginShow() outside INTRO is a no-op", m.beginShow() === false && m.screen === SCREEN.MENU);
}
{
  const bad = [];
  for (const c of ALLKEYS) {
    const a = createMenuApp();
    a.beginShow();
    frames(a, 6, DT, null, false); // 0.1 s: inside the guard
    a.key(c);
    a.confirm();
    a.skipShow();
    if (a.screen !== SCREEN.INTRO) bad.push(c);
  }
  check("show inside SKIP_GUARD: every gesture is a no-op", bad.length === 0, bad.join());
}
{
  const bad = [];
  for (const c of ALLKEYS) {
    let n = 0;
    const a = inShow({ onStart: () => n++ });
    a.key(c);
    if (a.screen !== SCREEN.MENU || a.cursor !== 0 || a.inGame || n) bad.push(c);
  }
  check("show past the guard: every key skips to MENU at cursor 0, inGame false, no run", bad.length === 0, bad.join());
}
{
  let n = 0;
  const a = inShow({ onStart: () => n++ });
  frames(a, 2, DT, null, true); // a rising Space
  frames(a, 20, DT, null, true); // held on through MENU
  check("show past the guard: a rising Space skips to MENU and the held press starts nothing",
    a.screen === SCREEN.MENU && a.cursor === 0 && n === 0, a.screen + "/" + n);
}
{
  let n = 0;
  const a = createMenuApp({ onStart: () => n++ });
  frames(a, 5, DT, null, true); // Space held on the title (rising edge consumed)
  a.beginShow(); // the press that started the show
  frames(a, Math.ceil((SHOW_DUR + 1.2) * 60), DT, null, true); // held through the natural end
  frames(a, 20, DT, null, true);
  check("Space held across title -> show -> MENU never starts a run", a.screen === SCREEN.MENU && n === 0, a.screen + "/" + n);
  a.update(DT, mkInput(null, false));
  a.update(DT, mkInput(null, true));
  check("release + re-press then confirms PLAY normally", n === 1 && a.screen === SCREEN.GAME);
}
{
  const a = createMenuApp();
  a.beginShow();
  frames(a, 100, DT, { down: true }, false);
  a.showBoom = true;
  frames(a, 1, DT, { down: true }, false);
  check("natural end (the boom) -> MENU at cursor 0 with fromShow; an arrow held since the press does not move off PLAY",
    a.screen === SCREEN.MENU && a.cursor === 0 && a.fromShow === true, a.screen + "/" + a.cursor);
  frames(a, 10, DT, { down: true }, false);
  check("...and the hold repeats only past REP_FIRST, as on any MENU hold", a.cursor === 0);
  const b = createMenuApp();
  b.beginShow();
  frames(b, Math.ceil(SHOW_DUR * 60) + 2, DT, null, false);
  check("no boom yet: SHOW_DUR alone does not open MENU (the boom does)", b.screen === SCREEN.INTRO);
  frames(b, 62, DT, null, false);
  check("safety net: SHOW_DUR + 1 s opens MENU with fromShow", b.screen === SCREEN.MENU && b.fromShow === true);
}
{
  const a = createMenuApp();
  a.beginShow();
  a.showBoom = true;
  frames(a, 1, DT, null, false);
  a.startRun();
  frames(a, 2, DT, null, false);
  a.noteWorldEdge("PLAY", "PAUSE");
  a.key("KeyM");
  frames(a, 1, DT, null, false);
  check("natural end -> PLAY -> PAUSE -> M lands on MENU with fromShow false (no replayed slam)",
    a.screen === SCREEN.MENU && a.fromShow === false);
  const b = inShow();
  b.key("Enter");
  check("a skip leaves fromShow false (today's fade)", b.screen === SCREEN.MENU && b.fromShow === false);
}
{
  const a = createMenuApp();
  a.boardReady = false;
  a.subT = 2;
  a.beginShow();
  check("board not ready: beginShow only marks the show pending", a._showPending === true && a.introStage === 0 && a.pressT === 2);
  a.key("KeyA");
  check("the press that set it pending never also skips", a.screen === SCREEN.INTRO);
  frames(a, 13, DT, null, false);
  check("pending: the title keeps drifting (subT not reset)", a.introStage === 0 && a.subT > 2.2);
  a.key("KeyA");
  check("a press while pending, past the guard, goes to MENU at cursor 0", a.screen === SCREEN.MENU && a.cursor === 0);
  const b = createMenuApp();
  b.boardReady = false;
  b.beginShow();
  frames(b, 5, DT, null, false);
  const t0 = b.subT;
  b.boardReady = true;
  frames(b, 1, DT, null, false);
  check("pending show begins on the first ready frame, from the title pose it leaves",
    b.introStage === 1 && b._showPending === false && Math.abs(b.pressT - (t0 + DT)) < 1e-12 && b.subT === 0, b.pressT);
}
{
  // eye-check 2026-10-09: REAL 3D froze for ~1.7 s on a half-revealed logo
  // while three loaded. A title waiting on the board stands settled instead.
  const a = createMenuApp();
  a.boardReady = false;
  frames(a, 1, DT, null, false);
  const s1 = a.subT;
  frames(a, 3, DT, null, false);
  const s4 = a.subT;
  a.boardReady = true;
  frames(a, 2, DT, null, false);
  check("a title waiting on the board holds its clock at the settled reveal (TITLE_IN) from the first frame, then runs on, never back",
    s1 >= TITLE_IN && s4 >= s1 && a.subT > s4 && a.introStage === 0, s1 + " / " + s4 + " / " + a.subT);
  const r = createMenuApp();
  frames(r, 1, DT, null, false);
  check("a ready board (2D) keeps the reveal from 0", r.subT < 0.1, r.subT);
}
{
  let marked = 0, n = 0;
  const a = createMenuApp({ markCabinet: () => marked++, onStart: () => n++ });
  a.beginShow();
  a.showBoom = true;
  frames(a, 1, DT, null, false);
  check("unseen cabinet: the show lands on MENU at cursor 0, not a run (ruling 2026-10-09 reversal)",
    a.screen === SCREEN.MENU && a.cursor === 0 && n === 0 && a.inGame === false);
  check("unseen cabinet: markCabinet is still called once", marked === 1 && a.cabinetSeen === true, marked);
}

// ---- menu cursor: wrap both directions ----
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  a.move(-1);
  check("cursor wraps UP past top", a.cursor === ITEMS.length - 1, a.cursor);
  a.move(1);
  check("cursor wraps back to 0", a.cursor === 0);
  a.move(1);
  a.move(1);
  check("cursor advances down", a.cursor === 2, a.cursor);
}
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  a.key("ArrowUp");
  check("ArrowUp tap = cursor-1", a.cursor === ITEMS.length - 1, a.cursor);
  const b = createMenuApp();
  b.screen = SCREEN.MENU;
  b.key("KeyS");
  check("KeyS tap = cursor+1", b.cursor === 1, b.cursor);
}

// ---- confirm dispatch per cursor index (spec §1 table) ----
{
  let started = null;
  const a = createMenuApp({
    onStart: (x) => {
      started = x;
    },
  });
  a.screen = SCREEN.MENU;
  a.cursor = 0;
  a.confirm();
  check(
    "cursor 0 PLAY -> onStart({level}) + GAME + inGame",
    a.screen === SCREEN.GAME &&
      a.inGame === true &&
      started &&
      started.level === 1 &&
      typeof started.level === "number",
    JSON.stringify(started),
  );
}
{
  for (const [cur, screen] of [
    [1, SCREEN.LEVEL],
    [3, SCREEN.SETTINGS],
    [4, SCREEN.GUIDE],
    [5, SCREEN.SCORES],
    [6, SCREEN.STATS],
  ]) {
    const a = createMenuApp();
    a.screen = SCREEN.MENU;
    a.cursor = cur;
    a.confirm();
    check(
      "cursor " + cur + " (" + ITEMS[cur] + ") -> screen " + screen,
      a.screen === screen,
      String(a.screen),
    );
  }
  let srcHits = 0;
  const s = createMenuApp({
    onSource: () => {
      srcHits++;
    },
  });
  s.screen = SCREEN.MENU;
  s.cursor = 7;
  s.confirm();
  check(
    "cursor 7 SOURCE -> onSource(), screen stays MENU",
    srcHits === 1 && s.screen === SCREEN.MENU,
    srcHits + "/" + s.screen,
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  a.cursor = 4;
  a.confirm();
  check(
    "GUIDE entry resets guideRow",
    a.screen === SCREEN.GUIDE && a.guideRow === 0,
    a.guideRow,
  );
  for (const [row, screen] of [
    [0, SCREEN.HOWTO],
    [1, SCREEN.ITEMS],
    [2, SCREEN.ENEMIES],
  ]) {
    const g = createMenuApp();
    g.screen = SCREEN.MENU;
    g.cursor = 4;
    g.confirm(); // -> GUIDE, guideRow 0
    g.guideRow = row;
    g.confirm();
    check(
      "GUIDE row " + row + " (" + GUIDE_ROWS[row] + ") -> screen " + screen,
      g.screen === screen,
      String(g.screen),
    );
    check(
      "back() from " + GUIDE_ROWS[row] + " returns to GUIDE, not MENU",
      g.back() === true && g.screen === SCREEN.GUIDE && g.guideRow === row,
      String(g.screen),
    );
  }
  check(
    "back() from GUIDE returns to MENU",
    a.back() === true && a.screen === SCREEN.MENU,
    String(a.screen),
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.GUIDE;
  a.guideRow = 0;
  a.move(-1);
  check("GUIDE cursor wraps UP past top", a.guideRow === 2, a.guideRow);
  a.move(1);
  a.move(1);
  check("GUIDE cursor wraps DOWN past bottom", a.guideRow === 1, a.guideRow);
}
{
  const a = createMenuApp();
  a.screen = SCREEN.GUIDE;
  a.key("ArrowDown");
  check("GUIDE ArrowDown tap = guideRow+1", a.guideRow === 1, a.guideRow);
  a.idleT = 5;
  frames(a, 300, DT); // 5s more — GUIDE must not accumulate toward ATTRACT
  check(
    "GUIDE never accumulates idle toward ATTRACT",
    a.screen === SCREEN.GUIDE && a.idleT === 0,
    a.idleT,
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  a.cursor = 3;
  a.confirm();
  check("OPTIONS entry resets optRow and clears togT", a.optRow === 0 && a.togT === -1);
  check(
    "SETTINGS joins back()'s poppable list",
    a.key("Escape") === true && a.screen === SCREEN.MENU,
    String(a.screen),
  );
  a.cursor = 3;
  a.confirm();
  check(
    "confirm on SETTINGS is NOT back — Enter is consumed by the row",
    a.confirm() === true && a.screen === SCREEN.SETTINGS,
    String(a.screen),
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.GAME;
  check(
    "confirm() in GAME is no-op",
    a.confirm() === false && a.screen === SCREEN.GAME,
  );
}

// ---- OPTIONS knobs: clamp, wrap, 3D gating, reset ----
{
  const seen = [];
  const a = createMenuApp({
    onSettings: (s, k) => {
      seen.push(k);
    },
  });
  a.screen = SCREEN.SETTINGS;
  check(
    "settings default to the shipped blob",
    a.settings.mus === 100 && a.settings.sfx === 100 && a.settings.bri === 100 && a.settings.cam === 0,
    JSON.stringify(a.settings),
  );
  a.cursor = 5;
  a.optMove(1);
  check("optMove moves optRow and never the MENU cursor", a.optRow === 1 && a.cursor === 5, a.optRow + "/" + a.cursor);
  a.optRow = 0;
  check("MUSIC left steps down by 10", a.move(-1, 0) === true && a.settings.mus === 90, a.settings.mus);
  for (let i = 0; i < 20; i++) a.move(-1, 0);
  check(
    "MUSIC clamps at 0 and reports no-change (adjust never wraps)",
    a.settings.mus === 0 && a.move(-1, 0) === false,
    a.settings.mus,
  );
  check("MUSIC Enter wraps 0 -> 10", a.optCycle() === true && a.settings.mus === 10, a.settings.mus);
  a.settings.mus = 100;
  check("MUSIC Enter wraps 100 -> 0", a.optCycle() === true && a.settings.mus === 0, a.settings.mus);
  a.optRow = 8;
  check(
    "RESET DEFAULTS restores every field",
    a.optCycle() === true && a.settings.mus === 100 && a.settings.bri === 100 && a.settings.shk === 1,
    JSON.stringify(a.settings),
  );
  check(
    "every accepted change reports through onSettings",
    seen.indexOf("mus") >= 0 && seen.indexOf("reset") >= 0,
    seen.join(","),
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.SETTINGS;
  a.optRow = 4;
  check("CAMERA rejects adjust in CLASSIC 2D", a.move(1, 0) === false && a.settings.cam === 0);
  check("CAMERA rejects Enter in CLASSIC 2D", a.optCycle() === false && a.settings.cam === 0);
  a.optRow = 5;
  check("BRIGHTNESS rejects adjust in CLASSIC 2D", a.move(1, 0) === false && a.settings.bri === 100);
  a.optRow = 3;
  a.optCycle();
  check("RENDER flips render3d and r3d together", a.render3d === true && a.settings.r3d === 1);
  a.optRow = 4;
  check("CAMERA cycles STANDARD -> WIDE in REAL 3D", a.optCycle() === true && a.settings.cam === 1);
  a.move(1, 0);
  check("CAMERA adjusts to FAR then clamps", a.settings.cam === 2 && a.move(1, 0) === false, a.settings.cam);
  check("CAMERA Enter wraps FAR -> STANDARD", a.optCycle() === true && a.settings.cam === 0);
  a.optRow = 5;
  for (let i = 0; i < 10; i++) a.move(1, 0);
  check("BRIGHTNESS clamps at 130", a.settings.bri === 130 && a.move(1, 0) === false, a.settings.bri);
  check("BRIGHTNESS Enter wraps 130 -> 70", a.optCycle() === true && a.settings.bri === 70, a.settings.bri);
  a.optRow = 3;
  a.optCycle();
  check("RENDER back to CLASSIC 2D re-locks the two 3D rows", a.render3d === false && a.settings.r3d === 0);
}
{
  let toggles = 0;
  const a = createMenuApp({
    audio: {
      toggle: () => {
        toggles++;
        return false;
      },
    },
  });
  a.screen = SCREEN.SETTINGS;
  a.optRow = 2;
  a.optCycle();
  check(
    "SOUND row drives audio.toggle() and syncs both flags",
    toggles === 1 && a.sound === false && a.settings.snd === 0,
    toggles + "/" + a.sound + "/" + a.settings.snd,
  );
  check("SOUND left is a no-op when already OFF", a.move(-1, 0) === false && toggles === 1);
}
{
  const a = createMenuApp();
  a.screen = SCREEN.SETTINGS;
  a.optRow = 8;
  a.optMove(1);
  check("optMove wraps 8 -> 0", a.optRow === 0, a.optRow);
  a.optMove(-1);
  check("optMove wraps 0 -> 8", a.optRow === 8, a.optRow);
  a.optRow = 0;
  a.key("ArrowDown");
  check("ArrowDown tap moves the row (axis 1)", a.optRow === 1, a.optRow);
  a.key("ArrowLeft");
  check("ArrowLeft tap adjusts the row (axis 0)", a.settings.sfx === 90, a.settings.sfx);
}

// ---- confirm rising-edge discipline (held != double) ----
{
  let n = 0;
  const a = createMenuApp({
    onStart: () => {
      n++;
    },
  });
  a.screen = SCREEN.MENU;
  frames(a, 10, DT, null, true);
  check("holding confirm 10 frames starts exactly once", n === 1, n);
}
// ---- back-stack MENU <-> subscreens ----
{
  const a = createMenuApp();
  a.screen = SCREEN.HOWTO;
  a.back();
  check("back(): HOWTO->GUIDE", a.screen === SCREEN.GUIDE);
  a.back();
  check(
    "back() at MENU root is no-op",
    a.back() === false && a.screen === SCREEN.MENU,
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  a.cursor = 1;
  a.confirm();
  a.key("Escape");
  check("Esc pops LEVEL->MENU", a.screen === SCREEN.MENU);
  a.confirm();
  check("re-enter LEVEL after pop", a.screen === SCREEN.LEVEL);
  a.key("Backspace");
  check("Backspace pops too", a.screen === SCREEN.MENU);
}
{
  const a = createMenuApp();
  a.screen = SCREEN.SCORES;
  a.confirm();
  check("Enter/confirm in SCORES = back", a.screen === SCREEN.MENU);
  const b = createMenuApp();
  b.screen = SCREEN.HOWTO;
  b.confirm();
  check("Enter/confirm in HOWTO = back", b.screen === SCREEN.GUIDE);
  const i = createMenuApp();
  i.screen = SCREEN.ITEMS;
  i.confirm();
  check("Enter/confirm in ITEMS = back", i.screen === SCREEN.GUIDE);
  i.screen = SCREEN.ITEMS;
  i.back();
  check("back(): ITEMS->GUIDE", i.screen === SCREEN.GUIDE);
  const f = createMenuApp();
  f.screen = SCREEN.ENEMIES;
  f.confirm();
  check("Enter/confirm in ENEMIES = back", f.screen === SCREEN.GUIDE);
  f.screen = SCREEN.ENEMIES;
  f.back();
  check("back(): ENEMIES->GUIDE", f.screen === SCREEN.GUIDE);
}

// ---- SCORES: scoreHeat is display-only, cycled by move(dir,0) ----
// NOTE: the real move() contract on MENU ignores `axis` entirely (ANY dir
// call moves the cursor and returns true) — verified against menuapp.js
// before writing this block. So "MENU left/right" below asserts scoreHeat
// is untouched, not that move() returns false (it returns true, same as
// any other MENU move).
{
  const a = createMenuApp();
  a.screen = SCREEN.SCORES;
  check("scoreHeat defaults CORE", (a.scoreHeat | 0) === 0);
  check(
    "SCORES right heats PLUS",
    a.move(1, 0) === true && a.scoreHeat === 1,
  );
  check("SCORES right again MAX", a.move(1, 0) && a.scoreHeat === 2);
  check(
    "SCORES right sticks at MAX",
    a.move(1, 0) === false && a.scoreHeat === 2,
  );
  check("SCORES left back to PLUS", a.move(-1, 0) && a.scoreHeat === 1);
  a.screen = SCREEN.MENU;
  const cursorBefore = a.cursor;
  const menuMoved = a.move(1, 0);
  check(
    "MENU left/right do not touch scoreHeat (real MENU move() ignores axis, always moves cursor)",
    menuMoved === true && a.cursor !== cursorBefore && a.scoreHeat === 1,
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.SCORES;
  check(
    "key ArrowRight (lateral tap) cycles scoreHeat via _tapMove",
    a.key("ArrowRight") === true && a.scoreHeat === 1,
  );
  check(
    "key ArrowUp (non-lateral tap) on SCORES is a no-op for scoreHeat",
    a.key("ArrowUp") === false && a.scoreHeat === 1,
  );
}

// ---- cursor repeat timing (synthetic dt) ----
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  frames(a, 1, DT, { up: true }); // tap frame
  frames(a, 3, DT, null); // release
  check("single tap = exactly 1 move", a.cursor === ITEMS.length - 1, a.cursor);
}
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  const c0 = a.cursor;
  frames(a, 20, DT, { up: true });
  check(
    "hold 333ms: no repeat yet (still 1 move)",
    a.cursor === (c0 + ITEMS.length - 1) % ITEMS.length &&
      a.cursor === ITEMS.length - 1,
    a.cursor - c0,
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  const c0 = a.cursor;
  frames(a, 23, DT, { up: true }); // 383ms
  check(
    "first repeat landed by 383ms (2 moves total)",
    Math.abs(a.cursor - c0) === 2 ||
      Math.abs(a.cursor - c0) === ITEMS.length - 2,
    "delta=" +
      ((((a.cursor - c0) % ITEMS.length) + ITEMS.length) % ITEMS.length),
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  const orig = a.move.bind(a);
  let moves = 0;
  a.move = (d) => {
    if (orig(d)) moves++;
    return true;
  };
  frames(a, 60, DT, { down: true }); // 1s hold
  check(
    "1s hold: 6..8 moves (350ms first, ~110ms cadence)",
    moves >= 6 && moves <= 8,
    moves,
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  a.cursor = 0;
  frames(a, 30, DT, { down: true }); // tap + >=1 repeat
  const afterDown = a.cursor;
  a.update(DT, mkInput({ down: false }));
  a.update(DT, mkInput({ up: true }));
  check(
    "direction switch re-taps immediately",
    a.cursor === (afterDown + ITEMS.length - 1) % ITEMS.length,
    a.cursor,
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  a.cursor = 0;
  frames(a, 10, DT, { down: true });
  a.update(DT, mkInput()); // release
  const mid = a.cursor;
  frames(a, 25, DT, { down: true }); // fresh hold 25 frames = 417ms
  const delta =
    (((a.cursor - mid) % ITEMS.length) + ITEMS.length) % ITEMS.length;
  check(
    "release resets timer: fresh press = tap + 1 repeat max",
    delta >= 1 && delta <= 2,
    delta,
  );
}

// ---- key() tap + update() axis dedupe (wired-together contract) ----
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  a.cursor = 0;
  a.key("ArrowUp");
  frames(a, 3, DT, { up: true });
  check(
    "key() tap + held axis same frame = 1 move",
    a.cursor === ITEMS.length - 1,
    a.cursor,
  );
  a.update(DT, mkInput());
  a.key("ArrowUp");
  frames(a, 3, DT, { up: true });
  check(
    "second tap not swallowed (flags are per-press)",
    a.cursor === ITEMS.length - 2,
    a.cursor,
  );
}

// ---- GAME isolation ----
{
  const a = createMenuApp({ autoplay: true });
  frames(a, 5, DT, { up: true, down: true, left: true, right: true }, true);
  check(
    "GAME: update ignores axes+confirm (no cursor drift)",
    a.screen === SCREEN.GAME && a.cursor === 0,
  );
  check(
    "GAME: move()/confirm() no-ops",
    a.move(1) === false && a.confirm() === false,
  );
  check(
    "GAME: Escape not handled by machine (onPause path)",
    a.key("Escape") === false,
  );
  check("GAME: arrows inert via key()", a.key("ArrowUp") === false);
}

// ---- M-quit gating ----
{
  const a = createMenuApp({ autoplay: true });
  check(
    "quitToMenu('PLAY') rejected",
    a.quitToMenu("PLAY") === false && a.screen === SCREEN.GAME,
  );
  check(
    "quitToMenu('PAUSE') accepted",
    a.quitToMenu("PAUSE") === true &&
      a.screen === SCREEN.MENU &&
      a.inGame === false,
  );
}
{
  // keys pass (v167): INTRO now skips on ANY key (its own on-screen hint), so
  // the outside-GAME M no-op is pinned on MENU instead
  const a = createMenuApp({ cabinetSeen: true });
  a.skip();
  check(
    "key('KeyM') outside GAME no-op",
    a.key("KeyM") === false && a.screen === SCREEN.MENU,
  );
  const b = inShow({ cabinetSeen: true });
  check(
    "any unmapped key skips the show (ANY KEY TO SKIP)",
    b.key("KeyQ") === true && b.screen === SCREEN.MENU,
  );
}
{
  const a = createMenuApp({ autoplay: true });
  a.noteWorldEdge("PAUSE", "PAUSE", null);
  check(
    "key('KeyM') quits when world noted PAUSE",
    a.key("KeyM") === true && a.screen === SCREEN.MENU,
  );
}
{
  const a = createMenuApp({ autoplay: true });
  a.noteWorldEdge("PLAY", "PLAY", null);
  a.key("KeyM");
  check("key('KeyM') blocked while world PLAY", a.screen === SCREEN.GAME);
}

// ---- toMenu ----
{
  const a = createMenuApp({ autoplay: true });
  check(
    "toMenu() from GAME returns true",
    a.toMenu() === true && a.screen === SCREEN.MENU && a.inGame === false,
  );
  check("toMenu() at MENU returns false", a.toMenu() === false);
}

// ---- noteWorldEdge: records exactly once on PLAY|WIN->LOSE ----
{
  const a = createMenuApp({ autoplay: true });
  check("PLAY->LOSE is a persist edge", a.noteWorldEdge("PLAY", "LOSE") === true);
  check("WIN->LOSE also records", a.noteWorldEdge("WIN", "LOSE") === true);
  check(
    "LOSE->LOSE (stay dead) is not an edge",
    a.noteWorldEdge("LOSE", "LOSE") === false,
  );
  check(
    "PLAY->WIN is not an edge (run continues)",
    a.noteWorldEdge("PLAY", "WIN") === false,
  );
  check("PAUSE->LOSE is not an edge", a.noteWorldEdge("PAUSE", "LOSE") === false);
}
{
  const a = createMenuApp({ autoplay: true });
  const seq = [
    ["PLAY", "PLAY"],
    ["PLAY", "LOSE"],
    ["LOSE", "LOSE"],
    ["LOSE", "LOSE"],
  ];
  const got = seq.map(([p, c]) => a.noteWorldEdge(p, c)).filter(Boolean);
  check(
    "frame-polled sequence records EXACTLY once",
    got.length === 1,
    got.length,
  );
}
{
  const a = createMenuApp({ autoplay: true });
  a.noteWorldEdge("PLAY", "PAUSE", null);
  check(
    "noteWorldEdge latches worldState for key-M path",
    a.worldState === "PAUSE",
    a.worldState,
  );
}
{
  const a = createMenuApp({ autoplay: true });
  a.noteWorldEdge("PLAY", "PLAY", null);
  a.noteWorldEdge("PLAY", "LOSE");
  a.noteWorldEdge("LOSE", "LOSE");
  check("worldState tracks latest", a.worldState === "LOSE", a.worldState);
}

// ---- repeat/timer state resets on transitions ----
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  a.cursor = 1;
  a.confirm();
  check(
    "push resets subT/repeat",
    a.subT === 0 && a.repT === 0 && a.repDir === 0,
    a.subT,
  );
  frames(a, 4, DT);
  check("update advances subT", a.subT > 0, a.subT.toFixed(3));
}

// ---- input side-channel: onUiKey fires BEFORE the game switch ----
{
  const inp = new Input(null);
  const seen = [];
  inp.onUiKey = (c) => seen.push(c);
  const pd = () => {};
  inp._onKey({ code: "KeyQ", preventDefault: pd });
  inp._onKey({ code: "Space", preventDefault: pd });
  check(
    "onUiKey receives every keydown code, in order",
    seen.join() === "KeyQ,Space",
    seen.join(),
  );
  check(
    "game switch still ran after side-channel (remote+fire latched)",
    inp._intent.remote === true && inp._intent.fire === true,
  );
}
{
  const inp = new Input(null);
  const pd = () => {};
  inp._onKey({ code: "ArrowUp", preventDefault: pd });
  inp._onKey({ code: "KeyP", preventDefault: pd });
  check(
    "unset onUiKey: zero behavior change (axes + onPause intact)",
    inp.input.up === true,
  );
}
{
  const inp = new Input(null);
  let n = 0;
  inp.onUiKey = () => n++;
  inp._onKeyUp({ code: "Space" });
  check("keyup does NOT hit onUiKey (keydown-only channel)", n === 0);
}

// ---- I3: OS key-repeat filter (repeats never re-dispatch UI or game logic) ----
{
  const inp = new Input(null);
  const seen = [];
  inp.onUiKey = (c) => seen.push(c);
  const pd = () => {};
  inp._onKey({ code: "ArrowDown", repeat: true, preventDefault: pd });
  check(
    "I3 repeat keydown: onUiKey NOT dispatched",
    seen.length === 0,
    JSON.stringify(seen),
  );
  check("I3 repeat keydown does not latch axis", inp.input.down === false);
  inp._onKey({ code: "ArrowDown", preventDefault: pd });
  check(
    "I3 first press dispatches once + latches axis",
    seen.join() === "ArrowDown" && inp.input.down === true,
  );
  inp._onKey({ code: "ArrowDown", repeat: true, preventDefault: pd });
  check(
    "I3 held-key repeat does not re-dispatch",
    seen.length === 1,
    JSON.stringify(seen),
  );
  inp._onKeyUp({ code: "ArrowDown" });
  check("I3 keyup clears axis normally", inp.input.down === false);
}
{
  const inp = new Input(null);
  const pd = () => {};
  inp._onKey({ code: "Space", repeat: true, preventDefault: pd });
  check("I3 fire repeat cannot CREATE fire latch", inp._intent.fire === false);
  inp._onKey({ code: "Space", preventDefault: pd });
  inp._onKey({ code: "Space", repeat: true, preventDefault: pd });
  check(
    "I3 held fire stays latched through repeats",
    inp._intent.fire === true,
  );
}

// ---- audio cue sheet (§5): jingle scheduling + muted guard ----
{
  const a = createAudio();
  const realST = globalThis.setTimeout;
  const calls = [];
  const ids = [];
  globalThis.setTimeout = (fn, ms) => {
    calls.push(ms);
    ids.push(realST(() => {}, 1e9));
    return ids[ids.length - 1];
  };
  try {
    a.play("uiJingle");
    check(
      "uiJingle unmuted: arpeggio 0/120/240/360ms + closer 480ms",
      calls.length === 5 &&
        calls[0] === 0 &&
        calls[1] === 120 &&
        calls[2] === 240 &&
        calls[3] === 360 &&
        calls[4] === 480,
      JSON.stringify(calls),
    );
    calls.length = 0;
    a.toggle(); // -> muted
    a.play("uiJingle");
    check("uiJingle muted: ZERO timers scheduled", calls.length === 0);
    a.toggle(); // -> unmuted
    calls.length = 0;
    a.play("uiSel");
    check(
      "uiSel schedules one 70ms follow-up",
      calls.length === 1 && calls[0] === 70,
      JSON.stringify(calls),
    );
    calls.length = 0;
    ["uiMove", "uiBack", "uiTog", "uiDenied"].forEach((n) => a.play(n));
    check(
      "simple cues are immediate beeps (no timers)",
      calls.length === 0,
      JSON.stringify(calls),
    );
  } finally {
    globalThis.setTimeout = realST;
    ids.forEach((id) => clearTimeout(id));
  }
}
{
  let ok = true;
  try {
    const a = createAudio();
    ["uiJingle", "uiMove", "uiSel", "uiBack", "uiTog", "uiDenied"].forEach(
      (n) => a.play(n),
    );
  } catch (e) {
    ok = false;
  }
  check(
    "all six cues headless no-throw (createAudio importable/instantiable)",
    ok,
  );
}

// ---- ATTRACT (spec §1): idle bookkeeping, entry/exit, guards ----
{
  check(
    "SCREEN.ATTRACT appended =7, still frozen",
    Object.isFrozen(SCREEN) && SCREEN.ATTRACT === 7,
    JSON.stringify(SCREEN),
  );
  check("SCREEN.ITEMS appended =8", SCREEN.ITEMS === 8, JSON.stringify(SCREEN));
  check(
    "SCREEN.ENEMIES appended =9",
    SCREEN.ENEMIES === 9,
    JSON.stringify(SCREEN),
  );
  check(
    "indices stable",
    SCREEN.BOOT === 0 &&
      SCREEN.INTRO === 1 &&
      SCREEN.MENU === 2 &&
      SCREEN.LEVEL === 3 &&
      SCREEN.HOWTO === 4 &&
      SCREEN.SCORES === 5 &&
      SCREEN.GAME === 6,
  );
  check("IDLE_T exported =10", IDLE_T === 10);
}
{
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  a.cursor = 3;
  frames(a, 594, DT); // 9.90s of empty updates
  check(
    "9.9s idle stays MENU (below threshold)",
    a.screen === SCREEN.MENU && a.idleT < IDLE_T,
    a.idleT.toFixed(2),
  );
  frames(a, 12, DT); // +0.20s -> crosses 10s mid-window
  check(
    ">=10s idle enters ATTRACT; cursor preserved; timers reset",
    a.screen === SCREEN.ATTRACT &&
      a.cursor === 3 &&
      a.subT <= 12 * DT &&
      a.repT === 0 &&
      a.repDir === 0,
    a.cursor + "/" + a.subT.toFixed(3),
  );
  frames(a, 120, DT, { down: true }); // held axes in ATTRACT
  check(
    "axes ignored in ATTRACT: no exit, no cursor drift",
    a.screen === SCREEN.ATTRACT && a.cursor === 3,
  );
  check(
    "subT still advances in ATTRACT (hint blink)",
    a.subT > 0,
    a.subT.toFixed(2),
  );
  const b = createMenuApp();
  check(
    "exitAttract() outside ATTRACT is false no-op",
    b.exitAttract() === false && b.screen === SCREEN.INTRO,
  );
  check(
    "key(Escape) exits ATTRACT to MENU + resets idle",
    a.key("Escape") === true && a.screen === SCREEN.MENU && a.idleT === 0,
  );
  check("cursor survived the attract round-trip", a.cursor === 3);
  a.key("Escape"); // at MENU now: plain back no-op
  check("post-exit Escape at MENU does not bounce", a.screen === SCREEN.MENU);
  frames(a, 601, DT); // idle again -> re-enter
  check("idle re-entry after exit works", a.screen === SCREEN.ATTRACT);
  check(
    "confirm() on ATTRACT plays",
    a.confirm() !== false && a.screen === SCREEN.GAME,
  );
}
{
  const started = [];
  const a = createMenuApp({
    onStart: (args) => started.push(args),
  });
  a.screen = SCREEN.MENU;
  a.level = 4;
  a.heat = 2;
  a.pact = 1;
  a.pace = 1;
  a.cursor = 3;
  a.enterAttract();
  const args = a.playFromAttract();
  check(
    "playFromAttract starts CORE L1 and keeps LEVEL SELECT picks",
    a.screen === SCREEN.GAME &&
      a.inGame === true &&
      args.level === 1 &&
      args.heat === 0 &&
      args.pact === 0 &&
      args.pace === 1 &&
      a.level === 4 &&
      a.heat === 2 &&
      a.pact === 1 &&
      started.length === 1,
    JSON.stringify(args) + " heat=" + a.heat,
  );
  const b = createMenuApp();
  check(
    "playFromAttract outside ATTRACT is false",
    b.playFromAttract() === false && b.screen === SCREEN.INTRO,
  );
  const c = createMenuApp({ onStart: (args) => started.push(args) });
  c.enterAttract();
  check(
    "Escape still exits to MENU (no run)",
    c.key("Escape") === true &&
      c.screen === SCREEN.MENU &&
      started.length === 1,
  );
  c.enterAttract();
  check(
    "confirm on ATTRACT plays",
    c.confirm() && c.screen === SCREEN.GAME,
  );
}
{
  const a = createMenuApp();
  a.screen = SCREEN.LEVEL;
  a.level = 1;
  frames(a, 700, DT); // 11.7s parked outside MENU
  check(
    "idleT reset outside MENU blocks entry from LEVEL",
    a.screen === SCREEN.LEVEL,
    a.screen,
  );
}
{
  const a = createMenuApp({ autoplay: true });
  frames(a, 700, DT, { up: true }, true);
  check(
    "GAME branch never accumulates idle nor enters ATTRACT",
    a.screen === SCREEN.GAME && a.idleT === 0,
  );
}

// ---- togT flip timestamp (§2): stamped on every SETTINGS knob change ----
{
  const a = createMenuApp();
  a.screen = SCREEN.SETTINGS;
  check("togT exposed, sentinel -1 before any change", a.togT === -1, a.togT);
  frames(a, 10, DT);
  const tAt = a.subT;
  a.optRow = 6;
  a.optCycle();
  check(
    "knob change stamps togT=subT",
    a.togT === tAt && a.settings.shk === 0,
    a.togT + " vs " + tAt,
  );
  const hold = a.togT;
  frames(a, 7, DT);
  a.optMove(1);
  check("row moves leave togT untouched", a.togT === hold, a.togT);
  frames(a, 5, DT);
  a.optRow = 7;
  a.optCycle();
  check("second change re-stamps togT to the new subT", a.togT === a.subT && a.togT > hold, a.togT + "/" + hold);
  a.back();
  check("screen transition clears the togT sentinel", a.screen === SCREEN.MENU && a.togT === -1, a.togT);
}
{
  const a = createMenuApp();
  a.screen = SCREEN.SETTINGS;
  a.optRow = 4;
  frames(a, 10, DT);
  a.optCycle();
  check("a REJECTED 3D-only change never stamps togT", a.togT === -1, a.togT);
}

{
  const src = readFileSync("src/app/menuapp.js", "utf8");
  check(
    "MENU confirm dispatches by ITEMS label, not item===N",
    !/item === \d/.test(src) && /ITEMS\[this\.cursor\]/.test(src),
  );
  const want = {
    PLAY: SCREEN.GAME,
    "LEVEL SELECT": SCREEN.LEVEL,
    // no o.dailySeed here, so DAILY is inert and stays on MENU (R3)
    DAILY: SCREEN.MENU,
    OPTIONS: SCREEN.SETTINGS,
    GUIDE: SCREEN.GUIDE,
    "HIGH SCORES": SCREEN.SCORES,
    STATS: SCREEN.STATS,
    SOURCE: SCREEN.MENU,
  };
  let srcHits = 0,
    started = 0;
  const a = createMenuApp({
    onStart: () => {
      started++;
    },
    onSource: () => {
      srcHits++;
    },
  });
  let ok = true,
    det = [];
  for (const label of ITEMS) {
    a.screen = SCREEN.MENU;
    a.inGame = false;
    a.cursor = ITEMS.indexOf(label);
    a.confirm();
    if (a.screen !== want[label]) {
      ok = false;
      det.push(label + "->" + a.screen);
    }
  }
  check(
    "confirm follows ITEMS labels (SOURCE stays MENU, PLAY starts the run)",
    ok && started === 1 && srcHits === 1 && want.OPTIONS === SCREEN.SETTINGS,
    det.join(" ") || "ok",
  );
}

// ---- R6: SCREEN.TROPHIES (the MEDALS page) is appended, opened from STATS by T ----
{
  check(
    "R6 TROPHIES appended at 13 — never inserted, STATS stays 12",
    SCREEN.TROPHIES === 13 && SCREEN.STATS === 12 &&
      Object.keys(SCREEN).length === 14,
    JSON.stringify(SCREEN),
  );
  check(
    "R6 ITEMS is unchanged: eight rows, same order, no trophy row",
    ITEMS.join("|") === "PLAY|LEVEL SELECT|DAILY|OPTIONS|GUIDE|HIGH SCORES|STATS|SOURCE",
    ITEMS.join("|"),
  );
  const a = createMenuApp();
  a.screen = SCREEN.MENU;
  check("R6 KeyT on MENU does nothing", a.key("KeyT") === false && a.screen === SCREEN.MENU,
    String(a.screen));
  a.screen = SCREEN.STATS;
  check("R6 KeyT on STATS pushes TROPHIES", a.key("KeyT") === true && a.screen === SCREEN.TROPHIES,
    String(a.screen));
  check("R6 KeyT on TROPHIES does nothing", a.key("KeyT") === false && a.screen === SCREEN.TROPHIES,
    String(a.screen));
  check("R6 back() on TROPHIES returns to STATS", a.back() === true && a.screen === SCREEN.STATS,
    String(a.screen));
  a.key("KeyT");
  check("R6 confirm() on TROPHIES returns to STATS", a.confirm() === true && a.screen === SCREEN.STATS,
    String(a.screen));
  a.key("KeyT");
  a.key("Escape");
  check("R6 Escape on TROPHIES returns to STATS", a.screen === SCREEN.STATS, String(a.screen));
}

console.log("\n  MENUAPP RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
