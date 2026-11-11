// Player words (UI upgrade v202 Task 2.1; design record §3, owner: "the naming and typo must be revise and make them simple",
// "we must use the name that users know about"). src/render/words.js is the one table; no old word reaches a screen in any
// look (render sweep through the shared recorder); the app-side literals that cannot import words.js are pinned equal to it;
// analytics events stay byte-identical; a source grep stays as a tripwire. HUD chips (Phase 8, R9) and medal proper names
// are the only allow-listed old words.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { rec } from "./lib/textrec.mjs";
import * as W from "../src/render/words.js";
import { PACT } from "../src/core/pact.js";
import { POWER, FOES } from "../src/core/entities.js";
import { TILE_HELP, TILE_NAME, tileTip, FEAT_PROFILE } from "../src/core/feat.js";
import { SCREEN, ITEMS, OPT_ROWS, PAUSE_ITEMS, GUIDE_ROWS, LEVEL_ROWS, optRows, createMenuApp } from "../src/app/menuapp.js";
import { createControlsPage } from "../src/app/controlspage.js";
import { DEF_CONTROLS } from "../src/app/controls.js";
import { wordsOf } from "../src/app/hints.js";
import { statsRows, statsNotes, statsPayload, clampStats } from "../src/app/stats.js";
import { MEDAL_ROWS, SPRINT_S, medalRows, medalLine } from "../src/app/medals.js";
import { dailyStamp } from "../src/app/daily.js";
import { recordBest } from "../src/app/bests.js";
import { LOCK_3D, gfxView } from "../src/app/gfx.js";
import { mountAnalytics, GA_HOST } from "../src/app/analytics.js";
import { coachTip } from "../src/app/coach.js";
import * as md from "../src/render/menudraw.js";
import * as lazyPages from "../src/render/pages/lazy.js";
import * as settingsPage from "../src/render/pages/settings.js";
lazyPages._set("settings", settingsPage); // the lazy SETTINGS / GRAPHICS page, in as if its import had landed (R20)
import * as kitCache from "../src/render/kit/cache.js";
/* A recorder layer factory (v202 Task 3.4 fix round 1, for speed): the kit pages paint their static parts into layer canvases, once per distinct
   state, and blit them on repeats. Each layer's texts join the draw that made it (same design px frame as the live texts), so every distinct
   page state is still read word for word, exactly once, instead of being painted in full on every one of the sweep's 8000 draws. */
const made = [];
class LayerCv { constructor(w, h) { this.width = w; this.height = h; this.r = rec({ widthK: 0.648 }); made.push(this); } getContext() { return this.r.ctx; } }
globalThis.OffscreenCanvas = LayerCv;
kitCache.setFactory((w, h) => new LayerCv(w, h));
const withLayers = (R, n0) => { const T = R.texts.slice(); for (const cv of made.slice(n0)) T.push(...cv.r.texts); made.length = n0; return T; };
import { drawShell, loadControlsArt } from "../src/render/shellview.js";
import { want as wantPage } from "../src/render/pages/lazy.js";
const RP = await wantPage("records"); // RECORDS is a lazy page (R20): the sweep paints it, not its LOADING plate
import { drawOverlay, overlayBox, drawHudChips, drawAbilityBar, PAUSE_ROWS, runStamp, copyPayload, pauseKicker } from "../src/render/scenes.js";
import { pickupLabel, labelText } from "../src/render/fx.js";
import { setHints } from "../src/render/hintcopy.js";
import { setPixelArt } from "../src/render/hudart.js";
import { createAtlas } from "../src/render/pixel/atlas.js";
import { surfRGBA } from "../tools/pixel/rgba.mjs";
import { drawControls } from "../src/render/controlsdraw.js";
import { DEF_KEY, DEF_PAD } from "../src/render/controlsgeo.js";
import { heatToken } from "../src/core/heat.js";
import { _set as setLazyPage } from "../src/render/pages/lazy.js";
setLazyPage("guide", await import("../src/render/pages/guide.js")); // the lazy GUIDE pages (v202 Task 3.5), as if their import had landed

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = JSON.stringify;
await loadControlsArt();

/* ---- the table ---- */
check("DIFF by heat 0..2: NORMAL / HARD / EXPERT", J(W.DIFF) === J(["NORMAL", "HARD", "EXPERT"]) && Object.isFrozen(W.DIFF));
check("SPEED by pace + 1: SLOW / NORMAL / FAST", J(W.SPEED) === J(["SLOW", "NORMAL", "FAST"]) && Object.isFrozen(W.SPEED));
check("MOD is keyed by PACT bit values (R10)", W.MOD[PACT.LAST] === "ONE LIFE" && W.MOD[PACT.BARE] === "NO FLOOR ITEMS" && W.MOD[PACT.THIN] === "FEWER ITEMS" && W.MOD[PACT.SHRINK] === "SHRINK" && Object.keys(W.MOD).length === 4 && Object.isFrozen(W.MOD));
check("TIME_TRIAL", W.TIME_TRIAL === "TIME TRIAL");
check("LABEL: SETTINGS, LEVEL SELECT, RECORDS, ART STYLE, POWER-UPS", W.LABEL.SETTINGS === "SETTINGS" && W.LABEL.LEVEL_SELECT === "LEVEL SELECT" && W.LABEL.RECORDS === "RECORDS" && W.LABEL.ART_STYLE === "ART STYLE" && W.LABEL.POWER_UPS === "POWER-UPS" && Object.isFrozen(W.LABEL));
check("diffWord clamps like clampHeat", W.diffWord(0) === "NORMAL" && W.diffWord(1) === "HARD" && W.diffWord(2) === "EXPERT" && W.diffWord(-4) === "NORMAL" && W.diffWord(9) === "EXPERT" && W.diffWord(undefined) === "NORMAL");
check("speedWord clamps like clampPace", W.speedWord(-1) === "SLOW" && W.speedWord(0) === "NORMAL" && W.speedWord(1) === "FAST" && W.speedWord(-7) === "SLOW" && W.speedWord(5) === "FAST" && W.speedWord(undefined) === "NORMAL");
check("modWords follows the chip order and the 4 bits only", J(W.modWords(15)) === J(["ONE LIFE", "NO FLOOR ITEMS", "FEWER ITEMS", "SHRINK"]) && J(W.modWords(PACT.SHRINK | PACT.LAST)) === J(["ONE LIFE", "SHRINK"]) && J(W.modWords(0)) === "[]" && J(W.modWords(16)) === "[]");
check("modCount", W.modCount(0) === 0 && W.modCount(15) === 4 && W.modCount(PACT.BARE | PACT.THIN) === 2 && W.modCount(31) === 4);
check("tagFor: a default run has no tag", W.tagFor({ heat: 0, pace: 0, pact: 0 }) === "" && W.tagFor({}) === "" && W.tagFor() === "");
{
  const t = W.tagFor({ heat: 2, pace: 1, pact: PACT.LAST });
  check("tagFor({heat:2,pace:1,pact:LAST}) names EXPERT DIFFICULTY, FAST SPEED, ONE LIFE", t === "EXPERT DIFFICULTY · FAST SPEED · ONE LIFE", t);
}
check("tagFor: only what differs from a default run, each naming its setting", W.tagFor({ heat: 1 }) === "HARD DIFFICULTY" && W.tagFor({ pace: -1 }) === "SLOW SPEED" && W.tagFor({ pact: PACT.BARE }) === "NO FLOOR ITEMS" && W.tagFor({ time: true }) === "TIME TRIAL");
check("tagFor: the longest run (appendix §12 row 6)", W.tagFor({ heat: 2, pace: 1, pact: 15, time: true }) === "EXPERT DIFFICULTY · FAST SPEED · ONE LIFE · NO FLOOR ITEMS · FEWER ITEMS · SHRINK · TIME TRIAL");
check("modsCount: the one singular / plural", W.modsCount(0) === "" && W.modsCount(PACT.THIN) === "1 " + W.LABEL.MODIFIER && W.modsCount(15) === "4 " + W.LABEL.MODIFIERS);
check("runParts: the one non-default filter (all / diff / count / terse), which tagFor, runWords, bestLabel and setupVals call",
  J(W.runParts({ heat: 2, pace: 0, pact: 3 }, { count: true, terse: true })) === J(["EXPERT", "2 MODIFIERS"]) && J(W.runParts({ heat: 0, pace: 1 }, { diff: true })) === J(["NORMAL DIFFICULTY", "FAST SPEED"]) &&
    J(W.runParts({}, { all: true, count: true })) === J(["NORMAL DIFFICULTY", "NORMAL SPEED"]) && J(W.runParts({ heat: 1 }, { terse: true })) === J(["HARD DIFFICULTY"]));
check("DEFAULT_RULES: the plain run (NORMAL difficulty and speed, no modifiers), as PAUSE's tag row reads it", W.DEFAULT_RULES === "DEFAULT RULES" && W.tagFor({}) === "");
check("runWords: every setting, defaults included", W.runWords({}) === "NORMAL DIFFICULTY · NORMAL SPEED" && W.runWords({ heat: 2, pace: -1, pact: PACT.THIN }) === "EXPERT DIFFICULTY · SLOW SPEED · FEWER ITEMS");

/* ---- labels the app dispatches by (confirm() reads the label): the strings changed, the rows and their order did not ---- */
check("MENU row OPTIONS is SETTINGS; seven rows in the design record's order, RECORDS for HIGH SCORES and STATS (Task 2.2)", J(ITEMS) === J(["PLAY", W.LABEL.LEVEL_SELECT, "DAILY", W.LABEL.RECORDS, W.LABEL.SETTINGS, "GUIDE", "SOURCE"]));
check("RECORDS' tabs: SCORES · STATS · MEDALS, frozen, in tab order; the hint words TAB / TABS", J(W.RECORD_TABS) === J(["SCORES", "STATS", "MEDALS"]) && Object.isFrozen(W.RECORD_TABS) && W.LABEL.TAB === "TAB" && W.LABEL.TABS === "TABS");
{
  const { CLEAR_KEYS, KEEP_KEYS } = await import("../src/app/reset.js");
  check("words.js RESET_GROUP is keyed by exactly reset.js's CLEAR and KEEP stores; RESET_DEFAULT is the sentence over those lists (STATS' armed plate)",
    J(Object.keys(W.RESET_GROUP).sort()) === J([...CLEAR_KEYS, ...KEEP_KEYS].sort()) && W.RESET_DEFAULT === W.resetSentence(CLEAR_KEYS, KEEP_KEYS) &&
      W.RESET_DEFAULT === "Erases every score, best, time, daily try, ghost, medal, badge and stat, shows the first-time tips again and locks levels 6–8, modifiers and time trial again. Keeps your settings, game speed, analytics choice and controls.");
}
check("the RECORDS feet build their TAB and DIFFICULTY words from words.js (keycap glyphs stay with the painter)", RP.footItems("scores", "tabs", wordsOf("key", DEF_CONTROLS))[0].t === W.LABEL.TAB && RP.footItems("scores", "body", wordsOf("key", DEF_CONTROLS))[0].t === W.LABEL.DIFFICULTY && RP.footItems("stats", "tabs", wordsOf("key", DEF_CONTROLS))[2].t === W.LABEL.TAB);
check("PAUSE rows: RESUME, SETTINGS, RESTART, QUIT TO MENU (design record §4, Task 2.4); scenes' copy mirrors it", J(PAUSE_ITEMS) === J(["RESUME", W.LABEL.SETTINGS, "RESTART", "QUIT TO MENU"]) && J(PAUSE_ROWS) === J(PAUSE_ITEMS));
check("SETTINGS row RENDER is ART STYLE: twelve rows in order, ten on screen outside REAL 3D (no CAMERA / BRIGHTNESS), no render-side copy", OPT_ROWS.length === 12 && OPT_ROWS[3] === W.LABEL.ART_STYLE && optRows(false).length === 10 && optRows(false)[3] === W.LABEL.ART_STYLE && !optRows(false).includes("CAMERA") && !optRows(false).includes("BRIGHTNESS") && optRows(true) === OPT_ROWS && md.OPT_N === undefined);
check("GUIDE door ITEMS is POWER-UPS", J(GUIDE_ROWS) === J(["HOW TO PLAY", W.LABEL.POWER_UPS, "ENEMIES", "FLOOR"]));
{
  const { LOOK_LABEL } = await import("../src/app/jobs.js");
  check("MENU (v202 Task 3.1): words.js MENU_ROWS is menuapp ITEMS, ART_STYLES the app's look labels (jobs.js LOOK_LABEL) by RENDER value", J(W.MENU_ROWS) === J(ITEMS) && J(W.ART_STYLES) === J([LOOK_LABEL["2d"], LOOK_LABEL.px, LOOK_LABEL["3d"]]) && Object.isFrozen(W.MENU_ROWS) && Object.isFrozen(W.ART_STYLES));
  check("MENU words: the teasers and the foot name settings with LABEL's words; frozen", W.MENU_WORDS.LEVEL_TEASE === W.LABEL.LEVEL + " · " + W.LABEL.DIFFICULTY + " · SPEED" && W.MENU_WORDS.START === W.LABEL.START && Object.isFrozen(W.MENU_WORDS) && Object.values(W.MENU_WORDS).every((v) => typeof v === "string" && v === v.toUpperCase()));
}
check("LEVEL SELECT rows (Task 2.3): LEVEL, DIFFICULTY, GAME SPEED, MODIFIERS from words.js, then START", J(LEVEL_ROWS) === J([W.LABEL.LEVEL, W.LABEL.DIFFICULTY, W.LABEL.GAME_SPEED, W.LABEL.MODIFIERS, W.LABEL.START]) && W.LABEL.START === "START" && W.LABEL.CLOSE === "CLOSE" && md.LEVEL_TAP_LIST.endsWith(" " + W.LABEL.CLOSE));
check("POWER (the pickup) is POWER BOMB in POWER[].name, still the one source", POWER.find((p) => p.t === "power").name === "POWER BOMB");

/* ---- app-side literals pinned equal to words.js (src/app may not import src/render) ---- */
{
  const L = W.LABEL, lv = (a, b) => L.LEVELS + " " + a + "-" + b;
  const want = [
    ["FLAWLESS", lv(1, 5) + " IN ONE RUN · NO LIFE LOST"],
    ["UNSCATHED", lv(6, 8) + " IN ONE RUN · NO LIFE LOST"],
    ["ALL IN", lv(1, 5) + " IN ONE RUN · ALL FOUR " + L.MODIFIERS],
    ["ALL OUT", lv(6, 8) + " IN ONE RUN · ALL FOUR " + L.MODIFIERS],
    ["OVERDRIVE", lv(1, 5) + " IN ONE RUN AT " + W.speedTag(1)],
    ["REDLINE", lv(6, 8) + " IN ONE RUN AT " + W.speedTag(1)],
    ["SPRINT", lv(1, 5) + " UNDER " + Math.floor(SPRINT_S / 60) + ":" + String(SPRINT_S % 60).padStart(2, "0") + " · " + W.DEFAULT_RULES], // the predicate is runT < SPRINT_S (strict: UNDER) at heat 0, pace 0, pact 0 (DEFAULT RULES)
    ["IRON CROWN", lv(6, 8) + " IN ONE RUN ON " + W.diffTag(2)],
  ];
  check("medals.js rule copy = the words.js words; the proper names stay", J(MEDAL_ROWS) === J(want) && W.DEFAULT_RULES === "DEFAULT RULES", J(MEDAL_ROWS));
}
{
  const st = clampStats({ a: { runs: 118, rooms: 214, deaths: 301, kills: 4820, picks: 913, bricks: 7702, secs: 50820, sessions: 42, days: 9, first: "2026-08-30", last: "2026-09-07" } });
  let b = recordBest({}, "0:0:1", 1840, 5);
  b = recordBest(b, "1:0:1", 2210, 4);
  const rows = statsRows(st, b);
  check("stats.js rows: LEVELS CLEARED, POWER-UPS, the three difficulty bests named, LEVEL n",
    rows[1][0] === W.LABEL.LEVELS + " CLEARED" && rows[4][0] === W.LABEL.POWER_UPS && rows[7][0] === W.diffTag(0) && rows[8][0] === W.diffTag(1) && rows[9][0] === W.diffTag(2) &&
      rows[7][1] === "1840 · " + W.LABEL.LEVEL + " 5" && rows[8][1] === "2210 · " + W.LABEL.LEVEL + " 4" && rows[9][1] === "—", J(rows));
  const notes = statsNotes(st, null, "2026-09-07");
  check("stats.js note: the session line (the BESTS row on the page names the bucket: the words outgrew the note)", notes[0] === "SINCE 2026-08-30 · LAST 2026-09-07 · 42 SESSIONS", notes[0]);
  const lines = statsPayload(st, b, { b: { "1:0:0:1": 389 } }, "2026-09-07").split("\n");
  check("stats.js clipboard payload uses the new words (R10)",
    lines[1] === "RUNS 118 · " + W.LABEL.LEVELS + " 214 · DEATHS 301 · KILLS 4820 · " + W.LABEL.POWER_UPS + " 913 · BRICKS 7702 · TIME 14h 07m" &&
      lines[2] === "BESTS · NO " + W.LABEL.MODIFIERS + " · " + W.speedTag(0) + " · " + W.diffTag(0) + " 1840/" + W.LABEL.LEVEL + " 5 · " + W.diffTag(1) + " 2210/" + W.LABEL.LEVEL + " 4 · " + W.diffTag(2) + " — · " + W.LABEL.LEVEL + " 1 " + W.diffTag(0) + " BEST TIME 0:38.9", J(lines));
}
check("daily.js share line (what C copies at a daily WIN / LOSE) says LEVEL n", dailyStamp("2026-11-10", 3, 1840) === "DAILY 2026-11-10 · " + W.LABEL.LEVEL + " 3 · 1840 · https://hmarzban.github.io/fusegrid/", dailyStamp("2026-11-10", 3, 1840));
check("gfx.js lock line names ART STYLE and SETTINGS", LOCK_3D === "REAL 3D ONLY · CHANGE " + W.LABEL.ART_STYLE + " IN " + W.LABEL.SETTINGS, LOCK_3D);

/* ---- the old words ---- */
const OLD = /\b(HEAT|CORE|PLUS|MAX|PACE|NORM|MODES|IRON|BARE|THIN|ROOMS?|LV|OPTIONS|RENDER|CHANGE RUN|EASY|PICKS|PICKUPS?|CUBES?)\b/i;
const ALLOW_HUD = new Set(["LV", heatToken(0), heatToken(1), heatToken(2)]); // drawHudChips only, Phase 8 (R9)
/* the narrow allow: the medal name; the two modifier names that hold ITEMS; MAX beside the power-up it caps (the pickup label
   FLAME / BOMB / SPEED MAX, the ability bar's SPD MAX, the catalogue's "(max 8)"); and FRAME RATE's own MAX value and help line
   on GRAPHICS (a frame rate, not a difficulty) */
const ENTRIES_NAME = (i) => ["ONE LIFE", "NO FLOOR ITEMS", "FEWER ITEMS", "SHRINK", "TIME TRIAL"][i];
const scrub = (s) => s.replace(/IRON CROWN/g, "").replace(/NO FLOOR ITEMS|FEWER ITEMS/gi, "").replace(/\b(FLAME|BOMB|SPEED|SPD) MAX\b/g, "").replace(/\(max \d+\)/g, "").replace(/^30 SAVES MOST BATTERY · MAX IS(?: UP(?: TO(?: YOUR(?: SCREEN,(?: HOTTEST)?)?)?)?)?$/, "").replace(/^(FRAME RATE|SENSITIVITY) MAX$/, "");
const bad = (s) => OLD.test(scrub(s)) || /\bITEMS?\b/i.test(scrub(s)) || /\b[LR]\d\b/.test(s) || /\bHARD\W{0,3}(SPEED|PACE)\b|\b(SPEED|PACE)\W{0,3}HARD\b/i.test(s);
const found = new Map();
/* ruling 7: a bare NORMAL (a difficulty and a speed) or HARD (a speed before v202) only where its own drawn line, or the row
   it sits on (a text within ROW px of its baseline, as a segmented control's caption cell), names the setting. EXEMPT: the
   two table pages Phase 3 redraws (HIGH SCORES' difficulty tabs and plaques under BEST RUNS BY DIFFICULTY; FLOOR's columns
   and row prefixes under ONE PER WORLD · BY DIFFICULTY), exactly those tokens */
const bare = [], ROW = 10, CAP = 64;
const EXEMPT = [[/^SCORES /, /^(NORMAL|HARD)$/], [/^FLOOR /, /^(NORMAL|HARD)$|^NORMAL · /]];
const named = (where, texts) => {
  const T = texts.filter((t) => t && typeof t.s === "string");
  for (const t of T) {
    const b = /\b(NORMAL|HARD)\b(?! (DIFFICULTY|SPEED)\b)/.exec(t.s);
    if (!b) continue;
    const need = b[1] === "HARD" ? /DIFFICULTY/ : /DIFFICULTY|SPEED/;
    if (need.test(t.s) || T.some((u) => u !== t && typeof u.y === "number" && Math.abs(u.y - t.y) <= ROW && need.test(u.s))) continue;
    /* LEVEL SELECT's phone and compact rows (v202 Task 3.3, the approved p-03 frame): the setting's label sits on the line over its bank, inside the
       one focus band; a bare value is named by the caption directly over its bank (within CAP px above, never below) */
    if (/^LEVEL /.test(where) && T.some((u) => u !== t && typeof u.y === "number" && u.y < t.y && t.y - u.y <= CAP && /^(DIFFICULTY|GAME SPEED)$/.test(u.s) && need.test(u.s) && !T.some((v) => v !== u && /^(DIFFICULTY|GAME SPEED)$/.test(v.s) && v.y > u.y && v.y < t.y))) continue;
    if (EXEMPT.some(([w, r]) => w.test(where) && r.test(t.s))) continue;
    bare.push(where + " :: " + t.s);
  }
};
/* a chip name broken over two lines (NO FLOOR / ITEMS) and the ability bar's SPD + MAX are read back as one; a value MAX is
   read with its row's FRAME RATE or SENSITIVITY label (its own setting, not a difficulty) */
const note = (where, texts, draw) => {
  if (draw) named(where, texts);
  const ss = texts.map((t) => String(typeof t === "string" ? t : t && t.s != null ? t.s : t));
  for (let i = 0; i < ss.length; i++) {
    const t = texts[i], lab = ss[i] === "MAX" && t && typeof t.y === "number" ? texts.find((u) => u && /^(FRAME RATE|SENSITIVITY)$/.test(u.s) && Math.abs(u.y - t.y) <= ROW) : null;
    const s = lab ? lab.s + " MAX" : (ss[i] === "ITEMS" && /(NO FLOOR|FEWER)$/.test(ss[i - 1] || "")) || (ss[i] === "MAX" && ss[i - 1] === "SPD") ? ss[i - 1] + " " + ss[i] : ss[i];
    if (!found.has(s)) found.set(s, where);
  }
};

/* ---- the render sweep: every SCREEN, pauseViews 0-3, WIN level / finale, LOSE, in all three looks, every layout and device ---- */
const PX = createAtlas(surfRGBA);
const st0 = clampStats({ a: { runs: 3, rooms: 7, deaths: 2, kills: 40, picks: 9, bricks: 70, secs: 900, sessions: 2, days: 2, first: "2026-11-01", last: "2026-11-10" } });
const bests0 = recordBest(recordBest(recordBest({}, "0:0:1", 1840, 5), "1:0:1", 2210, 4), "2:0:1", 99, 1);
const STATS = { rows: statsRows(st0, bests0), notes: statsNotes(st0, { d: "2026-11-10", best: 900, played: 2, g: 3 }, "2026-11-10"), trophies: medalRows(0b10100101) };
const TOP = [{ s: 4210, l: 5, d: "2026-11-09", t: 0, p: 0 }, { s: 2210, l: 4, d: "2026-11-08", t: 1, p: 5 }, { s: 99, l: 1, d: "2026-11-07", t: 2, p: 15 }];
const CABS = [
  () => ({ tiles: true, times: { b: { "1:0:0:1": 389, "3:2:5:2": 412 } }, medals: 165, stats: { a: { days: 4, runs: 9, rooms: 21, kills: 300 } }, daily: { played: 2, best: 900 }, top: TOP }),
  () => ({}),
];
const SCORES = [() => TOP.map((r) => ({ ...r })), () => []];
const page = () => createControlsPage({ get: () => DEF_CONTROLS, set() {}, padView: () => ({ state: "ready", name: "CONTROLLER 1", rumble: true }), say() {} });
const mkApp = (screen, o) => Object.assign(createMenuApp({ settings: { fpm: 1 }, controls: page(), anaOpen: () => true }), { screen, subT: 5, stats: STATS, dailyTag: "PLAYED" }, o || {});
const box = (w, h, lay) => ({ width: w, height: h, ownerDocument: { body: { getAttribute: () => lay } }, getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }) });
const APPS = [];
for (let cur = 0; cur < ITEMS.length; cur++) for (const o of [{}, { pactUnlocked: true, heat: 2, pace: 1, pact: 15, timeAttack: true, level: 7, padNote: "CONTROLLER READY · VIBRATION MEDIUM" }]) APPS.push(["MENU", { cursor: cur, ...o }]);
APPS.push(["MENU", { soundNote: "NO SOUND YET · PRESS A KEY OR TAP" }], ["MENU", { padNote: "CONTROLLER READY" }]);
for (const o of [{}, { pactUnlocked: true }, { pactUnlocked: true, heat: 1, pace: -1, pact: 15, timeAttack: true, level: 8 }, { pactUnlocked: false, lockR: 7, lockT: 4.9 }]) APPS.push(["LEVEL", o]);
for (const U of [false, true]) for (const r of U ? [0, 1, 2, 3, 4] : [0, 1, 2, 4]) APPS.push(["LEVEL", { pactUnlocked: U, levelRow: r }]); // every row focused (Task 2.3)
for (let c = 0; c < 5; c++) APPS.push(["LEVEL", { pactUnlocked: true, levelRow: 3, modOpen: true, modeCur: c, pact: 5 }]); // the MODIFIERS list open, each entry
APPS.push(["LEVEL", { pactUnlocked: true, lastDev: "touch" }], ["LEVEL", { pactUnlocked: true, levelRow: 3, modOpen: true, modeCur: 0, lastDev: "touch" }]); // tap mode (ruling 4, Task 3.3): the tap rule's foot
for (const s of ["HOWTO", "ITEMS", "ENEMIES", "FLOOR", "TROPHIES", "CONTROLS"]) APPS.push([s, {}]);
for (let r = 0; r < 4; r++) APPS.push(["GUIDE", { guideRow: r }]);
for (let h = 0; h < 3; h++) APPS.push(["SCORES", { scoreHeat: h }], ["SCORES", { scoreHeat: h, recFocus: 1 }]); // RECORDS: the tab row (an app's default), then the page body
APPS.push(["STATS", {}], ["STATS", { recFocus: 1 }], ["STATS", { resetArm: true }], ["STATS", { toast: { s: "COPIED", ok: true, t: 1 } }]);
for (const r3d of [false, true]) for (const lab of optRows(r3d)) APPS.push(["SETTINGS", { render3d: r3d, optRow: optRows(r3d).indexOf(lab), lookJob: lab === W.LABEL.ART_STYLE ? { k: "px", state: "failed" } : null, _anaSaid: lab === "ANALYTICS" }]); // both row sets (Task 2.4), every row focused
APPS.push(["MENU", { cursor: ITEMS.indexOf(W.LABEL.SETTINGS), render3d: true }]); // the SETTINGS pane in REAL 3D: twelve rows, CAMERA · BRIGHTNESS
for (let r = 0; r < 8; r++) APPS.push(["GRAPHICS", { gfxRow: r }]);
APPS.push(["GRAPHICS", { gfxRow: 1, settings: { fpm: 1, fps: 2, res: 2, shd: 2, aa: 2, fxq: 1, dmo: 2 } }]); // FRAME RATE MAX: a frame rate's MAX
APPS.push(["INTRO", { introStage: 0 }], ["INTRO", { introStage: 1, subT: 1 }], ["ATTRACT", { subT: 0.2 }]);
const LAYS = [["d", 600, 520], ["d", 1366, 768], ["l", 1024, 768], ["p", 436, 946], ["d", 608, 352]];
const DEVS = [["key", null], ["pad", wordsOf("pad", DEF_CONTROLS)], ["touch", wordsOf("touch", DEF_CONTROLS)]];
let draws = 0;
for (const kind of ["2d", "px", "3d"]) {
  setPixelArt(kind === "px" ? PX : null);
  for (const [lay, w, h] of LAYS) for (const [dev, words] of DEVS) {
    setHints(words);
    CABS.forEach((cab, ci) => APPS.forEach(([scr, o]) => {
      const a = mkApp(SCREEN[scr], o), R = rec({ widthK: 0.648 });
      if (scr === "GRAPHICS") a.gfxView = () => gfxView(a.settings, kind, {});
      const n0 = made.length;
      drawShell(R.ctx, a, { state: "PLAY", time: 1, level: 1 }, box(w, h, lay), kind, SCORES[ci], () => 0b0110, cab);
      note(scr + " " + kind + " " + lay + w + " " + dev, withLayers(R, n0), true);
      draws++;
    }));
    /* GAME: PAUSE views 1-3 through drawShell, view 0 and WIN / LOSE through drawOverlay (every look calls it with its overlayBox) */
    for (const wo of [{ level: 3, heat: 0, pace: 0, pact: 0 }, { level: 8, heat: 2, pace: 1, pact: 15 }, { level: 6, heat: 1, pace: -1, pact: PACT.BARE }]) {
      for (const v of [1, 2, 3]) {
        for (const r3d of v === 1 ? [false, true] : [false]) { // view 1 is the SETTINGS rows: both row sets
          const a = mkApp(SCREEN.GAME, { pauseView: v, gfxRow: 1, render3d: r3d }), R = rec({ widthK: 0.648 });
          a.optRow = a.optRows().indexOf(W.LABEL.ART_STYLE);
          a.gfxView = () => gfxView(a.settings, kind, {});
          const n0 = made.length;
          drawShell(R.ctx, a, { state: "PAUSE", time: 1, ...wo }, box(w, h, lay), kind, SCORES[0], () => 0, CABS[0]);
          note("PAUSE view " + v + " " + kind, withLayers(R, n0), true);
        }
      }
      const B = overlayBox(kind), touch = lay !== "d";
      const RUNS = [null, { r: 3, k: 12, p: 4, t: 200 }, { r: 5, k: 40, p: 9, t: 700, best: { s: 99999, r: 8 }, fromStart: true, md: medalLine(255) }, { r: 5, k: 40, p: 9, t: 700, best: { s: 1, r: 1 }, md: medalLine(128) },
        { r: 2, k: 4, p: 1, t: 90, best: null }, { r: 1, k: 1, p: 0, t: 60, daily: "2026-11-10", tries: 3, dbest: 1840 }, { r: 3, k: 1, p: 0, t: 60, best: { s: 1234, r: 3 } }];
      for (const run of RUNS) for (const [state, lv] of [["PAUSE", wo.level], ["WIN", 3], ["WIN", 5], ["WIN", 8], ["LOSE", wo.level]]) for (const ui of [{ view: 0, cursor: PAUSE_ITEMS.indexOf("RESTART"), touch }, { view: 0, cursor: PAUSE_ITEMS.indexOf("RESUME"), touch, note: "CONTROLLER LOST" }, { view: 0, cursor: PAUSE_ITEMS.indexOf(W.LABEL.SETTINGS), touch, next: "REAL 3D NEXT" }]) {
        const R = rec({ widthK: 0.648 }), world = { ...wo, state, level: lv, score: 1234, players: [{}] };
        drawOverlay(R.ctx, world, B.w, B.h, B.cx, B.cy, ui, { on: true, t: 41.2, best: 38.9 }, run, { s: "COPIED", ok: true });
        note(state + " " + lv + " " + kind + " " + lay + w + " " + dev, R.texts, true);
      }
    }
  }
}
setHints(null);
setPixelArt(null);
/* CONTROLS rows that only a pad view reaches (VIBRATION's rule, THROW / REMOTE help), and the HUD + ability bar + pickup labels + coach tips */
{
  const keyV = (o) => ({ tab: "key", device: "key", row: 1, pad: { state: "none" }, key: DEF_KEY, binds: DEF_PAD, stick: "L", dead: 25, vib: 2, stickVal: [0, 0], reads: "", drift: 0.06, armed: false, swap: null, status: "", capture: null, echo: null, ...o });
  const PR = { state: "ready", name: "CONTROLLER 1", rumble: true };
  for (const o of [{ row: 2 }, { row: 3 }, { row: 7, armed: true }, ...[0, 1, 2, 3].map((vib) => ({ tab: "pad", device: "pad", pad: PR, row: 6, vib })), { tab: "pad", device: "pad", pad: PR, row: 2 }, { tab: "pad", device: "pad", pad: PR, row: 3 }, { tab: "pad", device: "pad", pad: PR, row: 5 }, { tab: "pad", device: "pad", pad: PR, row: 5, dead: 8 }])
    for (const T of [false, true]) { const R = rec({ widthK: 0.648 }); drawControls(R.ctx, md.layout(600, 520), keyV(o), { touch: T, narrow: false }); note("CONTROLS " + J(o), R.texts, true); }
  const hud = rec({ widthK: 0.648 });
  drawHudChips(hud.ctx, { players: [{ bombs: 2, range: 3 }], lives: 3, level: 4, enemies: [1], heat: 1, score: 1234, state: "PLAY" }, { on: true, t: 12 });
  const hudTexts = hud.texts.map((t) => t.s);
  check("the HUD chips still print LV and the heat token: Phase 8 (R9), never this task", hudTexts.includes("LV") && hudTexts.includes(heatToken(1)));
  for (const s of hudTexts) if (!ALLOW_HUD.has(s)) note("HUD", [s]);
  const bar = rec({ widthK: 0.648 });
  drawAbilityBar(bar.ctx, { state: "PLAY", players: [{ shield: true, kick: true, throw: true, passing: true, bombKind: "power", remote: true, speed: 999 }] }, null, []);
  note("ABILITY BAR", bar.texts);
  for (const p of POWER) for (const prev of [null, "line", "power", "pierce"]) { const l = pickupLabel(p.t, { range: 8, bombs: 8, speed: 999 }, prev); note("PICKUP LABEL", [labelText(l), l.sub].filter(Boolean)); const m = pickupLabel(p.t, {}, prev); note("PICKUP LABEL", [labelText(m), m.sub].filter(Boolean)); }
  for (const k of ["kick", "throw", "remote", "pass", "line", "power", "pierce", "shield"]) for (const lay of ["d", "p"]) note("COACH", [coachTip(k, lay, null, wordsOf(lay === "p" ? "touch" : "key", DEF_CONTROLS))]);
  for (const k of Object.keys(TILE_NAME)) for (const pr of FEAT_PROFILE) note("TILE TIP", [tileTip(k, pr)]);
  for (const k of Object.keys(TILE_HELP)) note("TILE HELP", TILE_HELP[k]);
  for (const p of POWER) note("POWER", [p.name, p.help]);
  for (const f of FOES) note("FOES", [f.name, f.help]);
}
/* clipboard payloads and the strings handed to a page from outside the sweep */
note("CLIPBOARD", [copyPayload({ level: 3, heat: 2, score: 1234 }), statsPayload(st0, bests0, { b: { "1:0:0:1": 389 } }, "2026-11-10"), dailyStamp("2026-11-10", 3, 1840), pauseKicker({ level: 3, heat: 1, pace: -1, pact: 15 }, { daily: true })]);
/* the DOM cards: the analytics consent card, NEW VERSION READY, the load card and every other player string in index.html */
{
  const mkEl = (tag) => { const kids = {}; return { tag, id: "", hidden: false, innerHTML: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {}, querySelector(sel) { return (kids[sel] = kids[sel] || mkEl(sel)); } }; };
  const body = [], doc = { body: { appendChild: (el) => body.push(el), dataset: { lay: "d" } }, head: { appendChild() {} }, createElement: mkEl, cookie: "" };
  const m = new Map();
  mountAnalytics({ id: "G-TEST1234", store: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }, win: { addEventListener() {} }, doc, loc: { hostname: GA_HOST, pathname: "/fusegrid/" } });
  const card = body.find((e) => e.id === "ana");
  const text = card ? card.innerHTML.replace(/<[^>]+>/g, " ") : "";
  check("the consent card names SETTINGS and the level you reach (card copy only)", !!card && text.indexOf("any time in " + W.LABEL.SETTINGS) >= 0 && text.indexOf("the " + W.LABEL.LEVEL.toLowerCase() + " you reach") >= 0, text);
  note("CARD #ana", [text, card.attrs["aria-label"]]);
  const upd = readFileSync(join(ROOT, "src/app/update.js"), "utf8").match(/card\.innerHTML = ([\s\S]*?);\n/)[1];
  note("CARD #upd", [upd.replace(/<[^>]+>/g, " ")]);
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  /* storefront copy (meta description, og / twitter text and image alt, JSON-LD) follows in the separate docs step (design record §3); the alt text describes og.png, which still shows the old words */
  const page = html.replace(/<meta [^>]*>/g, "").replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "").replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const scripts = [...page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
  const markup = page.replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");
  const strs = scripts.flatMap((js) => literals(js).map((x) => x[1])).concat([...markup.matchAll(/(?:aria-label|alt|title|placeholder)="([^"]*)"|>([^<]+)</g)].map((x) => x[1] || x[2])).filter((s) => s && /[A-Za-z]{3}/.test(s) && (/\s/.test(s.trim()) || /^[A-Z][A-Z0-9 -]*$/.test(s.trim()))); // player text, not paths or code
  note("index.html", strs);
  check("index.html: the load chip points at SETTINGS › ART STYLE", /DID NOT LOAD · SETTINGS › ART STYLE/.test(html));
}
const hits = [...found].filter(([s]) => bad(s));
check(`render sweep (${draws} shell draws + overlays, 3 looks x 5 boxes x 3 devices) prints no old word; HUD chips and medal names allow-listed`, hits.length === 0, hits.slice(0, 40).map(([s, w]) => w + " :: " + s).join("\n      "));
check("ruling 7: a bare NORMAL or HARD only where its own line or row names its setting (DIFFICULTY / SPEED)", bare.length === 0, [...new Set(bare)].slice(0, 20).join("\n      "));
{
  /* one marker per branch the sweep must reach, so a narrowed sweep cannot pass by seeing less */
  const SEEN = ["SETTINGS", "ART STYLE", "POWER-UPS", "NORMAL", "EXPERT", "GAME SPEED", "DIFFICULTY", "MODIFIERS", "ONE LIFE", "NO FLOOR ITEMS", "TIME TRIAL", "POWER BOMB", "IRON CROWN",
    "FURTHEST LEVEL YET", "MATCHED YOUR", "FROM YOUR", "DAILY 2026-11-10 · NORMAL SPEED", "PAUSED · LEVEL 3", "LEVEL ENDS", "THROW POWER-UP", "CLEAR LEVEL 5 TO OPEN", "REBIND IN SETTINGS",
    "ANY OTHER KEY CANCELS", "replaces POWER BOMB", "NO NORMAL DIFFICULTY RUNS YET", "BEST 4,210", "LEVELS 1-5 IN ONE RUN", "BESTS · NO MODIFIERS", "YOUR TRIES TODAY", "4 PAGES", "GITHUB", "CHANGE ART STYLE",
    "LEVEL 8 · CROWN", "the level you reach", "DID NOT LOAD · SETTINGS", "· next level", "Levels 5 and 8 end in a finale.", "Clear level 5 to open 6 to 8.", "NO VIBRATION AT ALL", "NO TIME YET", "Walls close in from 25s.", "ONE LIFE · FEWER ITEMS",
    "DEFAULT RULES", "UNDER 3:00", "DAILY 2026-11-10 · LEVEL 3 · 1840", "RECORDS", "BADGES", "EARNED", "COPY MY STATS", "BEST BY DIFFICULTY", "SPD MAX", "FRAME RATE MAX", "SENSITIVITY MAX", "LEVEL 8", "ROW", "CHANGE", "OPEN", "PICK", "TOGGLE", "SOUTH", "TAP OUTSIDE TO CLOSE", "TAP OUTSIDE TO GO BACK",
    "STANDARD", "CONTROLLER READY · VIBRATION MEDIUM · SETTINGS › CONTROLS", "NEEDS A CLICK OR ENTER", "TAP A ROW", "LEVEL 1 · JUNGLE"]; // Task 2.4: only the REAL 3D rows draw STANDARD (CAMERA's value); Task 3.1: the MENU page's teasers, foot and signpost (its old preview panes are gone)
  const all = [...found.keys()], miss = SEEN.filter((w) => !all.some((s) => s.indexOf(w) >= 0));
  check("the sweep reached every branch it claims (one marker each)", miss.length === 0, miss.join(" | "));
  /* RECORDS' feet by focus (fix round 1: the body-focus foot has no word of its own, so the page records each page:focus it painted) */
  const foci = (await import("../src/render/pages/records.js"))._dbg.foci;
  check("the sweep painted RECORDS' tab row, body and armed feet (scores / stats tabs + body, stats arm, medals tabs)", ["scores:tabs", "scores:body", "stats:tabs", "stats:body", "stats:arm", "medals:tabs"].every((k) => foci.has(k)), J([...foci]));
  check("ENEMIES: one level reads LEVEL 8, a span LEVELS 1-8 (words.js levelsOf); no LEVELS n for a single level", found.has("LEVEL 8") && found.has("LEVELS 1-8") && ![...found.keys()].some((k) => /^LEVELS \d+$/.test(k) && !/^LEVELS \d+ ·/.test(k) && !/RUN|KILLS/.test(k)) && W.levelsOf("8") === "LEVEL 8" && W.levelsOf("1-3, 5-8") === "LEVELS 1-3, 5-8");
}

/* ---- fit: the longer words keep what the old slots said ---- */
{
  /* PAUSE: a daily keeps DAILY (a daily is always a default run), a heavy run keeps its modifier count; the kicker fits the plate */
  for (const [name, B, touch] of [["keyboard", overlayBox("2d"), false], ["touch", overlayBox("2d"), true], ["iso", overlayBox("iso"), false]]) {
    const kick = (w, run) => { const R = rec({ widthK: 0.7 }); drawOverlay(R.ctx, { state: "PAUSE", ...w }, B.w, B.h, B.cx, B.cy, { view: 0, cursor: 0, touch }, null, run); return R.texts.find((t) => /^LEVEL \d/.test(t.s)); };
    const d = kick({ level: 1, heat: 0, pace: 0, pact: 0 }, { daily: "2026-11-10" }), h = kick({ level: 8, heat: 2, pace: 1, pact: 15 }, null), plain = kick({ level: 3, heat: 0, pace: 0, pact: 0 }, null);
    check(`PAUSE kicker (${name}): a daily keeps DAILY, a heavy run keeps its modifier count, a default run reads LEVEL n · world`,
      !!d && d.s === "LEVEL 1 · JUNGLE · DAILY" && !!h && /4 MODIFIERS$/.test(h.s) && /^LEVEL 8 · /.test(h.s) && !!plain && plain.s === "LEVEL 3 · FACTORY", J([d && d.s, h && h.s, plain && plain.s]));
  }
  /* LEVEL SELECT (v202 Task 3.3): a MODIFIERS list entry's name, broken over two lines where one will not fit, stays inside its key, in the iso
     guard, the touch boxes and the narrow phone, at text scale 1 and 1.25 (the two-line path is reached at least once) */
  const { setTextScale } = await import("../src/render/kit/type.js");
  const lvp = await import("../src/render/pages/level.js");
  const OC = globalThis.OffscreenCanvas; delete globalThis.OffscreenCanvas; // this check reads the list's words where they land on the target: no layer source here, as in Node without the sweep's recorder layers (merge of Task 3.3 and 3.4)
  let two = 0;
  for (const ts of [1, 1.25]) for (const [name, L, T] of [["iso 608x352", md.layout(608, 352), false], ["iso touch", md.layout(608, 352), true], ["narrow touch", md.layout(436, 946, 255, 0.9), true], ["600x520", md.layout(600, 520), false], ["landscape phone", md.layout(600, 520, undefined, 0.725), true]]) {
    setTextScale(ts);
    const R = rec({ widthK: 0.648 }), G = md.levelGeom(L, true, T, true), u = G.u;
    md.drawLevelSelect(R.ctx, 3, L, 1, 1, 15, true, 1, true, T, { open: true, cur: 0, row: W.LABEL.MODIFIERS });
    const out = [], n = [];
    lvp._dbg.last.P.list.forEach((q) => {
      const r = q.r, lines = R.texts.filter((t) => q.lines.includes(t.s) && t.y >= r.y - 4 && t.y <= r.y + r.h + 4);
      n.push(q.lines.length);
      q.lines.forEach((s0, i) => { const w = q.ws[i], x = r.x + 8 + 28 + 6; if (x + w > r.x + r.w - 2 || q.lines.length * q.px * ts * 1.1 > r.h) out.push(ENTRIES_NAME(q.i) + ":" + s0); });
      if (!lines.length) out.push(q.i + " not drawn");
    });
    two += n.filter((k) => k === 2).length;
    check(`MODIFIERS list (${name}, x${ts}): every entry's name drawn whole inside its key, on one line or two`, out.length === 0 && n.length === 5 && n.every((k) => k === 1 || k === 2), out.join(" | ") + " " + J(n));
  }
  setTextScale(1);
  globalThis.OffscreenCanvas = OC;
  check("MODIFIERS list: the two-line path is reached (a name too wide for its key breaks once, never cut)", two > 0, two);
}

/* ---- fit, fix round 1: the iso MENU pane and the ability bar ---- */
{
  /* MENU (v202 Task 3.1; the preview pane and its MODIFIERS list are gone, LEVEL SELECT prints them): with LEVEL SELECT focused and a heavy run,
     in the iso guard and at 600x520, every MENU word lies inside its key and the plate, PLAY's tag one whole candidate, the foot under the plate */
  const pgm = await import("../src/render/pages/menu.js");
  for (const [name, W0, H0] of [["608x352 (iso)", 608, 352], ["600x520", 600, 520]]) {
    const L = md.layout(W0, H0), R = rec({ widthK: 0.648 }), run = { heat: 2, pace: 1, pact: 15, time: true };
    md.drawMenu(R.ctx, { rows: ITEMS, focus: W.LABEL.LEVEL_SELECT, level: 7, run, rev: "v0", enterT: 9 }, L, 9);
    const { G, P } = pgm._dbg.last, d = G.d, out = [];
    for (const l of ITEMS) {
      const o = P.rows[l], r = o.r, sp = o.k === "main" ? [[o.word.rest, o.word.w], o.tag && [o.tag.x - o.tag.w, o.tag.w]] : [[l === W.LABEL.LEVEL_SELECT ? o.foc.x : o.rest.x, o.label.w], o.tz && [o.tz.x - o.tz.w, o.tz.w]];
      for (const q of sp.filter(Boolean)) if (q[0] < r.x || q[0] + q[1] > r.x + r.w || r.x < d.plate.x || r.y + r.h > d.plate.y + d.plate.h) out.push(l + "@" + q[0].toFixed(1));
    }
    const tag = P.rows.PLAY.tag, F = P.foot.OPEN;
    check(`MENU, LEVEL SELECT focused, a heavy run (${name}): every word inside its key and the plate; PLAY's tag one whole candidate; the foot under the plate`, out.length === 0 && !!tag && pgm.playTags({ run, level: 7 }).includes(tag.lines.join(" ")) && tag.lines.every((t) => R.texts.some((q) => q.s === t)) && F.y > d.plate.y + d.plate.h, out.join(" | ") + " " + J(tag && tag.lines));
  }
  /* the ability bar with every ability held fits the overlay (ABAR.x in from each side) at the recorder's +8 % width, in the
     CLASSIC / REAL 3D vector form and with PIXEL's icon painter; only a row that may overflow measures itself and shrinks */
  const ALL = (bombKind) => ({ state: "PLAY", players: [{ shield: true, kick: true, throw: true, passing: true, bombKind, remote: true, speed: 999 }] });
  const bar = (w, ico, k) => { const R = rec({ widthK: k }); drawAbilityBar(R.ctx, w, ico, []); return R; };
  const fontPx = (t) => +/(\d+)px/.exec(t.font)[1];
  for (const kind of ["line", "power", "pierce"]) for (const [look, ico] of [["CLASSIC 2D / REAL 3D", undefined], ["PIXEL", () => {}]]) {
    const R = bar(ALL(kind), ico, 0.648), panels = R.rects.filter((r) => r.fill === "rgba(13,18,32,0.72)"), last = panels[panels.length - 1];
    const inPanel = R.texts.every((t) => panels.some((r) => t.x >= r.x && t.x + t.w <= r.x + r.w + 0.01));
    check(`ability bar, every ability held, ${kind === "power" ? "POWER BOMB" : kind.toUpperCase()} (${look}, +8 %): inside 16..584, each word inside its chip, type >= 9 px`,
      panels.length === 7 && panels[0].x === 16 && last.x + last.w <= 600 - 16 && inPanel && R.texts.every((t) => fontPx(t) >= 9), J([last, R.texts.map((t) => t.s + "@" + fontPx(t))]));
  }
  {
    const old = bar(ALL("pierce"), undefined, 0.6), pb = bar(ALL("power"), undefined, 0.6), one = bar({ state: "PLAY", players: [{ kick: true }] }, undefined, 0.6);
    const sizes = (R) => [...new Set(R.texts.map(fontPx))].join();
    check("ability bar: at the recorder's own width the old full row keeps 13 px, the POWER BOMB row steps to 12, a short row measures once and keeps 13 (its call log unchanged)",
      sizes(old) === "13" && sizes(pb) === "12" && sizes(one) === "13" && one.calls.filter((c) => c.op === "measureText").length === 1, sizes(old) + " / " + sizes(pb) + " / " + one.calls.filter((c) => c.op === "measureText").length);
  }
}

/* ---- source grep: a string literal anywhere in src/ that carries an old word (comments and identifiers are not player text) ---- */
function literals(src) {
  const out = [];
  let i = 0, line = 1;
  const re = (p) => { const b = src.slice(Math.max(0, p - 12), p).trimEnd(); return !b || /[(,=:[!&|?{};+\-*%<>~^]$/.test(b) || /\b(return|typeof|case)$/.test(b); }; // a "/" that opens a regex, never a division
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === "\n") { line++; i++; }
    else if (c === "/" && d === "/") { while (i < src.length && src[i] !== "\n") i++; }
    else if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); for (let k = i; k < e; k++) if (src[k] === "\n") line++; i = e + 2; }
    else if (c === "/" && re(i)) { i++; while (i < src.length && src[i] !== "/") { if (src[i] === "\\") i++; else if (src[i] === "[") { while (src[i] !== "]") { if (src[i] === "\\") i++; i++; } } i++; } i++; }
    else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== c) { if (src[j] === "\\") { s += src[j + 1]; j += 2; continue; } if (src[j] === "\n") line++; s += src[j++]; }
      let k = j + 1;
      while (k < src.length && (src[k] === " " || src[k] === "\n")) k++;
      out.push([line, s, src[k], c === "`"]);
      i = j + 1;
    } else i++;
  }
  return out;
}
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : []; });
/* the only literals allowed an old word, each by its file and the source line that holds it: core's name tables the HUD
   heat token reads until Phase 8 (HEAT_NAME, R9) and the two the screens no longer read (PACE_NAME, PACT_NAME's words: dead,
   pinned unread below); the HUD's LV chip (Phase 8); MAX as a capped power-up (fx.js), FRAME RATE's MAX value (gfx.js) and
   the SENSITIVITY level MAX (controls, controlsgeo). IRON CROWN is scrubbed like on screen. */
const SRC_ALLOW = [
  ["src/core/heat.js", /^export const HEAT_NAME = /, /^(CORE|PLUS|MAX)$/], ["src/core/pace.js", /^export const PACE_NAME = /, /^(EASY|NORM)$/],
  ["src/core/pact.js", /^export const PACT_NAME=/, /^(BARE|THIN)$/], ["src/render/scenes.js", /chip\(314, 64, "LV"/, /^LV$/],
  ["src/render/fx.js", /cap=\(v,m\)=>|CFG\.MAX_SPEED\?/, /^MAX$/], ["src/app/gfx.js", /^\s*fps: Object\.freeze\(\["30", "60", "MAX"\]\)/, /^MAX$/],
  ["src/app/controls.js", /^export const SENS_LEVELS = /, /^MAX$/], ["src/render/controlsgeo.js", /^export const SENS_LEVELS = /, /^MAX$/],
];
const OLD_CAPS = new RegExp(OLD.source);
/* a level / heat / pace shorthand built at runtime: a literal that ends in a lone L, R or LV just before a "+", or a template
   that puts one before a ${...} (the daily share line's " · L" + level slipped past the word grep) */
const SHORT = /(^|[\s·/(])(L|R|LV)\s*$/, SHORT_T = /(^|[^A-Za-z])(L|R|LV) ?\$\{/;
const srcHits = [], unread = [];
for (const f of walk(join(ROOT, "src"))) {
  const rel = relative(ROOT, f).split("\\").join("/"), text = readFileSync(f, "utf8"), lines = text.split("\n");
  if (rel !== "src/core/pace.js" && /\b(PACE_NAME|paceToken)\b/.test(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))) unread.push(rel); // code, not comments
  for (const [ln, s, after, tmpl] of literals(text)) {
    if ((after === "+" && SHORT.test(s)) || (tmpl && SHORT_T.test(s))) { srcHits.push(rel + ":" + ln + " builds a shorthand " + J(s)); continue; }
    if (!OLD_CAPS.test(scrub(s)) && !/\b[LR]\d\b/.test(s)) continue; // labels are CAPS; lowercase prose is the sweep's and the cards' job
    if (SRC_ALLOW.some(([p, l, r]) => p === rel && l.test(lines[ln - 1] || "") && r.test(s))) continue;
    srcHits.push(rel + ":" + ln + " " + J(s));
  }
}
check("PACE_NAME and paceToken are unread outside src/core/pace.js (dead tables, kept there by the no-core-change rule)", unread.length === 0, unread.join());
check("source grep (tripwire): no string literal in src/ carries an old word outside the allow-list", srcHits.length === 0, srcHits.join("\n      "));

/* ---- analytics: event names and params byte-identical to v202 before the renames (captured at 4677b8e) ---- */
{
  const m = new Map([["nb.analytics.v1", "1"]]);
  const had = "window" in globalThis, prev = globalThis.window;
  globalThis.window = { localStorage: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }, addEventListener() {}, removeEventListener() {} };
  try {
    const { createGame } = await import("../src/main.js");
    await import("../src/core/board3.js");
    const g = createGame(null, { seed: 7, debug: true }), ga = window.__GAME__.ga;
    let t = 0;
    const tick = (n = 1) => { for (let i = 0; i < n; i++) { t += 16; g.loop(t); } };
    g.app.cabinetSeen = true; g.app.skip(); tick();
    g.app.confirm(); tick(3);
    g.world.score = 1234; g.world.state = "LOSE"; tick(3);
    g.app.screen = SCREEN.MENU; tick();
    Object.assign(g.app, { pactUnlocked: true, screen: SCREEN.LEVEL, level: 3, heat: 2, pace: 1, pact: 5, timeAttack: true }); tick();
    g.app.confirm(); tick(3);
    g.input.onPause(); tick(2);
    g.app.pauseCursor = PAUSE_ITEMS.indexOf("QUIT TO MENU"); g.app.confirm(); tick(3);
    const ev = J(ga.log.filter((a) => a[0] === "event"));
    const PIN = '[["event","run_start",{"mode":"run","room":1,"heat":0,"pact":0,"pace":0}],["event","run_end",{"mode":"run","room":1,"result":"lose","heat":0,"pace":0,"score":1234,"secs":0}],["event","run_start",{"mode":"run","room":3,"heat":2,"pact":5,"pace":1}],["event","run_end",{"mode":"run","room":3,"result":"quit","heat":2,"pace":1,"score":0,"secs":0}]]';
    check("analytics: run_start / run_end names and params byte-identical (lose, and a quit from a LEVEL SELECT run)", ev === PIN, ev);
  } finally { if (had) globalThis.window = prev; else delete globalThis.window; }
}

console.log("\n  WORDS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
