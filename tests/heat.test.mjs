import { step, createWorld, newIntent, loadLevel } from "../src/core/sim.js";
import { HEAT, heatRoster, heatProfile, heatScore } from "../src/core/heat.js";
import { PACT, applyPact } from "../src/core/pact.js";
import { CFG, T, key, ROOM_LOCK, ROOM_MAX, isFinale, roomCap } from "../src/core/config.js";
import { winHeadline, overlayCue, runStamp, copyPayload, drawOverlay,
  overlayBox, pauseHit, PAUSE_ROWS, PAUSE_ROW_H } from "../src/render/scenes.js";
import { scoreEntry } from "../src/app/highscores.js";
import { PACT_KEY, loadPactUnlocked, savePactUnlocked } from "../src/app/pactstore.js";
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

check("ROOM_LOCK/MAX are 5/8", ROOM_LOCK === 5 && ROOM_MAX === 8);
check(
  "isFinale L5 and L8 only",
  isFinale(5) &&
    isFinale(8) &&
    isFinale(9) &&
    !isFinale(1) &&
    !isFinale(4) &&
    !isFinale(6) &&
    !isFinale(7),
);
check("roomCap locked 5 unlocked 8", roomCap(false) === 5 && roomCap(true) === 8);
check(
  "winHeadline L6/L7 are room clears",
  winHeadline({ level: 6, finale: false }) === "LEVEL 6 CLEARED" &&
    winHeadline({ level: 7, finale: false }) === "LEVEL 7 CLEARED",
);
check(
  "winHeadline L5/L8 are FUSE/GRID CLEAR",
  winHeadline({ level: 5, finale: false }) === "FUSE/GRID CLEAR" &&
    winHeadline({ level: 8, finale: false }) === "FUSE/GRID CLEAR",
);
check(
  "winHeadline finale latch wins",
  winHeadline({ level: 6, finale: true }) === "FUSE/GRID CLEAR",
);

check(
  "overlayCue WIN mid",
  overlayCue({ state: "WIN", level: 3, finale: false, score: 10, heat: 0 }) ===
    "SPACE / TAP · next room",
);
check(
  "overlayCue WIN finale",
  overlayCue({ state: "WIN", level: 5, finale: false, score: 10, heat: 1 }) ===
    "SPACE / TAP · menu",
);
check(
  "overlayCue LOSE",
  overlayCue({ state: "LOSE", level: 4, score: 99, heat: 2 }) ===
    "SPACE / TAP · new run",
);
check(
  "overlayCue PAUSE is the pause-list cue, exactly",
  overlayCue({ state: "PAUSE", heat: 1 }) ===
    "↑↓ SELECT · ENTER CONFIRM · P RESUME · M QUIT",
  overlayCue({ state: "PAUSE", heat: 1 }),
);
check(
  "runStamp is raw score + biome + heat",
  runStamp({ level: 3, heat: 1, score: 1840 }) === "L3 FACTORY · PLUS · 1840",
);
check(
  "runStamp CORE",
  runStamp({ level: 1, heat: 0, score: 0 }) === "L1 JUNGLE · CORE · 0",
);
check(
  "copyPayload appends the play URL with a trailing slash",
  copyPayload({ level: 1, heat: 0, score: 0 }) ===
    "L1 JUNGLE · CORE · 0 https://hmarzban.github.io/fusegrid/",
);

check("heatScore CORE 1200 stays 1200", heatScore(1200, 0) === 1200);
check("heatScore PLUS 1200 -> 2400", heatScore(1200, 1) === 2400);
check("heatScore MAX 1200 -> 3600", heatScore(1200, 2) === 3600);
check("heatScore clamps junk heat to CORE", heatScore(1200, -3) === 1200);
check("heatScore clamps 99 heat to MAX", heatScore(1200, 99) === 3600);

{
  const e = scoreEntry({ score: 1234, level: 3, heat: 0 }, "2026-09-02");
  const m = scoreEntry({ score: 1234, level: 1, heat: 2 }, "2026-09-02");
  check(
    "scoreEntry CORE keeps raw; MAX triples",
    e.s === 1234 && e.l === 3 && e.d === "2026-09-02" && !("t" in e) &&
      m.s === 3702 && m.t === 2,
    JSON.stringify({ e, m }),
  );
}

check(
  "R20 CORE roster L1-5",
  heatRoster(1, 0).join() === "walker,walker,stationary" &&
    heatRoster(2, HEAT.CORE).join() === "walker,walker,fast,stationary" &&
    heatRoster(5, 0).includes("rocket"),
);
check(
  "R20 PLUS introduces next foe; L1 frozen",
  heatRoster(1, HEAT.PLUS).join() === "walker,walker,stationary" &&
    heatRoster(2, HEAT.PLUS).includes("chaser") &&
    !heatRoster(2, HEAT.PLUS).includes("boomerang") &&
    heatRoster(5, HEAT.PLUS).filter((t) => t === "chaser").length === 2,
);
check(
  "R20 MAX L2 uses L3 roster; pass stays out of L1-2",
  heatRoster(2, HEAT.MAX).join() === heatRoster(3, 0).join() &&
    !heatRoster(2, HEAT.MAX).includes("boomerang") &&
    heatRoster(4, HEAT.MAX).includes("rocket") &&
    heatRoster(5, HEAT.MAX).filter((t) => t === "boomerang").length === 2,
);
check(
  "R22 extra rooms keep L5 CORE string and add exclusive foes",
  heatRoster(5, 0).join() ===
    "walker,chaser,fast,stationary,boomerang,rocket" &&
    heatRoster(6, 0).join() ===
      "walker,chaser,fast,stationary,boomerang,rocket,burrow" &&
    heatRoster(7, 0).includes("shade") &&
    heatRoster(8, 0).includes("knight") &&
    heatRoster(6, 0).filter((t) => t === "fast").length ===
      heatRoster(5, 0).filter((t) => t === "fast").length,
);

{
  const a = createWorld(20260823, 1);
  loadLevel(a, 1, false);
  const b = createWorld(20260823, 1);
  b.heat = 0;
  loadLevel(b, 1, false);
  check(
    "R20 CORE heat=0 matches omitted heat (grid+roster+fuse+lives)",
    a.fuse === CFG.FUSE &&
      a.lives === 3 &&
      a.enemies.map((e) => e.type).join() ===
        b.enemies.map((e) => e.type).join() &&
      [...a.grid].every((v, i) => v === b.grid[i]),
  );
  const plus = createWorld(20260823, 2);
  plus.heat = HEAT.PLUS;
  loadLevel(plus, 2, false);
  check(
    "R20 PLUS L2 has chaser and fuse 2.3",
    plus.enemies.some((e) => e.type === "chaser") &&
      plus.fuse === 2.3 &&
      plus.lives === 3,
    plus.enemies.map((e) => e.type).join(),
  );
  const mx = createWorld(7, 1);
  mx.heat = HEAT.MAX;
  loadLevel(mx, 1, false);
  const teach = ["fire", "bomb"].every((t) =>
    mx.items.some((it) => it.buried && it.t === t),
  );
  check(
    "R20 MAX L1 still teaches fire+bomb; 2 lives; fuse 2.1",
    teach && mx.lives === 2 && mx.fuse === 2.1 && heatProfile(2).carve === 0.24,
  );
}

{
  const last = createWorld(9, 1);
  last.pact = PACT.LAST;
  loadLevel(last, 1, false);
  check("R21 LAST fresh run is 1 life", last.lives === 1 && last.pact === PACT.LAST);
  last.lives = 2;
  loadLevel(last, 2, true);
  check("R21 LAST carry keeps lives on WIN→next", last.lives === 2);
  const bare = createWorld(9, 1);
  bare.pact = PACT.BARE;
  loadLevel(bare, 1, false);
  check(
    "R21 BARE drops all floor cubes",
    bare.items.filter((it) => !it.buried).length === 0,
  );
  const thin = createWorld(9, 1);
  thin.pact = PACT.THIN;
  loadLevel(thin, 1, false);
  const base = createWorld(9, 1);
  loadLevel(base, 1, false);
  check(
    "R21 THIN buries one fewer cube (min 3)",
    thin.items.filter((it) => it.buried).length ===
      base.items.filter((it) => it.buried).length - 1 &&
      thin.items.filter((it) => it.buried).length >= 3,
  );
  const sh = createWorld(3, 1);
  sh.pact = PACT.SHRINK;
  loadLevel(sh, 1, false);
  sh.state = "PLAY";
  check("R21 SHRINK arms 25s clock", sh.shrinkT === 25 && sh.shrinkGen === 0);
  const k12 = key(1, 2);
  for (let i = 0; i < 1510; i++) step(sh, CFG.STEP, { 0: newIntent() });
  check(
    "R21 SHRINK closes rim after 25s; spawn stays EMPTY",
    sh.grid[k12] === T.WALL &&
      sh.grid[key(1, 1)] === T.EMPTY &&
      sh.shrinkGen === 1,
    "gen=" + sh.shrinkGen + " (1,2)=" + sh.grid[k12],
  );
}

{
  const P = heatProfile(0);
  const last = applyPact(P, PACT.LAST);
  const thin = applyPact(P, PACT.THIN);
  const bare = applyPact(P, PACT.BARE);
  const shrink = applyPact(P, PACT.SHRINK);
  check(
    "applyPact LAST/THIN/BARE/SHRINK",
    last.lives === 1 &&
      thin.buriedAdd === P.buriedAdd - 1 &&
      bare.bare === true &&
      shrink.shrinkT === 25 &&
      applyPact(P, 0).shrinkT === 0 &&
      P.lives === 3,
  );
}

{
  const src = readFileSync(new URL("../src/core/pact.js", import.meta.url), "utf8");
  check(
    "pact.js has no localStorage persist",
    !src.includes("localStorage") && !src.includes("PACT_KEY"),
  );
  const st = {
    m: new Map(),
    getItem(k) {
      return this.m.has(k) ? this.m.get(k) : null;
    },
    setItem(k, v) {
      this.m.set(k, String(v));
    },
  };
  check("loadPactUnlocked empty is false", loadPactUnlocked(st) === false);
  check("savePactUnlocked writes nb.pact.v1=1", savePactUnlocked(st) === true && st.getItem(PACT_KEY) === "1");
  check("loadPactUnlocked after save", loadPactUnlocked(st) === true);
}

// ---- pause chrome: one named box feeds both draws and both hit tests ----
{
  check(
    "PAUSE_ROWS is the four-verb list, frozen, pitch 26",
    Object.isFrozen(PAUSE_ROWS) &&
      PAUSE_ROWS.join("|") === "RESUME|RESTART|OPTIONS|QUIT TO MENU" &&
      PAUSE_ROW_H === 26,
    PAUSE_ROWS.join("|"),
  );
  const b2 = overlayBox("2d"),
    b3 = overlayBox("3d"),
    bi = overlayBox("iso");
  check(
    "overlayBox: 2d and real 3d share the 600x520 centred box",
    b2.w === 600 && b2.h === 520 && b2.cx === 300 && b2.cy === 260 &&
      JSON.stringify(b3) === JSON.stringify(b2),
    JSON.stringify(b2),
  );
  check(
    "overlayBox: iso keeps today's projected box at 304,188",
    bi.w === 608 && bi.h === 352 && bi.cx === 304 && bi.cy === 188,
    JSON.stringify(bi),
  );
  for (const B of [b2, bi]) {
    const tag = B.w + "x" + B.h;
    let all = true;
    for (let i = 0; i < 4; i++)
      if (pauseHit(B.cx, B.cy - 30 + i * PAUSE_ROW_H, B) !== i) all = false;
    check("pauseHit maps every row centre in " + tag, all);
    check(
      "pauseHit vertical band is +-13 in " + tag,
      pauseHit(B.cx, B.cy - 30 + 13, B) === 0 && pauseHit(B.cx, B.cy - 30 - 14, B) === -1,
    );
    check(
      "pauseHit horizontal band is +-130 in " + tag,
      pauseHit(B.cx + 130, B.cy - 30, B) === 0 && pauseHit(B.cx + 131, B.cy - 30, B) === -1,
    );
    check(
      "pauseHit off the rows is -1 in " + tag,
      pauseHit(B.cx, B.cy + 86, B) === -1 && pauseHit(B.cx, B.cy - 70, B) === -1,
    );
    check(
      "the whole list (cy-70 .. cy+86) clears the " + tag + " box",
      B.cy - 70 > 0 && B.cy + 86 < B.h,
      B.cy - 70 + ".." + (B.cy + 86),
    );
  }
}
{
  const texts = [];
  const c = new Proxy(function () {}, {
    get: (t, p) => {
      if (p === Symbol.toPrimitive) return () => "";
      return (...a) => {
        if (p === "fillText") texts.push(String(a[0]));
        return c;
      };
    },
    apply: () => c,
    set: () => true,
  });
  const B = overlayBox("2d");
  drawOverlay(c, { state: "PAUSE" }, B.w, B.h, B.cx, B.cy);
  check(
    "drawOverlay PAUSE defaults to the list at cursor 0",
    texts.includes("PAUSED") &&
      PAUSE_ROWS.every((r) => texts.includes(r)) &&
      texts.includes("↑↓ SELECT · ENTER CONFIRM · P RESUME · M QUIT"),
    texts.join("|"),
  );
  texts.length = 0;
  drawOverlay(c, { state: "PAUSE" }, B.w, B.h, B.cx, B.cy, { view: 1, cursor: 0 });
  check(
    "drawOverlay view 1 paints the veil only — no PAUSED under the settings plate",
    texts.length === 0,
    texts.join("|"),
  );
  texts.length = 0;
  drawOverlay(
    c,
    { state: "WIN", level: 3, finale: false, score: 10, heat: 0 },
    B.w, B.h, B.cx, B.cy,
    { view: 1, cursor: 2 },
  );
  check(
    "drawOverlay WIN/LOSE branches ignore ui entirely",
    texts.some((s) => s.indexOf("CLEARED") >= 0),
    texts.join("|"),
  );
}

console.log("\n  HEAT RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
