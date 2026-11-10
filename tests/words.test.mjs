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
import { SCREEN, ITEMS, OPT_ROWS, PAUSE_ITEMS, GUIDE_ROWS, createMenuApp } from "../src/app/menuapp.js";
import { createControlsPage } from "../src/app/controlspage.js";
import { DEF_CONTROLS } from "../src/app/controls.js";
import { wordsOf } from "../src/app/hints.js";
import { statsRows, statsNotes, statsPayload, clampStats } from "../src/app/stats.js";
import { MEDAL_ROWS, medalRows, medalLine } from "../src/app/medals.js";
import { recordBest } from "../src/app/bests.js";
import { LOCK_3D, gfxView } from "../src/app/gfx.js";
import { mountAnalytics, GA_HOST } from "../src/app/analytics.js";
import { coachTip } from "../src/app/coach.js";
import * as md from "../src/render/menudraw.js";
import { drawShell, loadControlsArt } from "../src/render/shellview.js";
import { drawOverlay, overlayBox, drawHudChips, drawAbilityBar, PAUSE_ROWS, runStamp, copyPayload, pauseKicker } from "../src/render/scenes.js";
import { pickupLabel, labelText } from "../src/render/fx.js";
import { setHints } from "../src/render/hintcopy.js";
import { setPixelArt } from "../src/render/hudart.js";
import { createAtlas } from "../src/render/pixel/atlas.js";
import { surfRGBA } from "../tools/pixel/rgba.mjs";
import { drawControls } from "../src/render/controlsdraw.js";
import { DEF_KEY, DEF_PAD } from "../src/render/controlsgeo.js";
import { heatToken } from "../src/core/heat.js";

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
check("runWords: every setting, defaults included", W.runWords({}) === "NORMAL DIFFICULTY · NORMAL SPEED" && W.runWords({ heat: 2, pace: -1, pact: PACT.THIN }) === "EXPERT DIFFICULTY · SLOW SPEED · FEWER ITEMS");

/* ---- labels the app dispatches by (confirm() reads the label): the strings changed, the rows and their order did not ---- */
check("MENU row OPTIONS is SETTINGS, same eight rows in today's order", J(ITEMS) === J(["PLAY", W.LABEL.LEVEL_SELECT, "DAILY", W.LABEL.SETTINGS, "GUIDE", "HIGH SCORES", "STATS", "SOURCE"]));
check("PAUSE row OPTIONS is SETTINGS, order kept; scenes' copy mirrors it", J(PAUSE_ITEMS) === J(["RESUME", "RESTART", W.LABEL.SETTINGS, "QUIT TO MENU"]) && J(PAUSE_ROWS) === J(PAUSE_ITEMS));
check("SETTINGS row RENDER is ART STYLE, twelve rows in order", OPT_ROWS.length === 12 && OPT_ROWS[3] === W.LABEL.ART_STYLE && md.OPT_N === 12);
check("GUIDE door ITEMS is POWER-UPS", J(GUIDE_ROWS) === J(["HOW TO PLAY", W.LABEL.POWER_UPS, "ENEMIES", "FLOOR"]));
check("POWER (the pickup) is POWER BOMB in POWER[].name, still the one source", POWER.find((p) => p.t === "power").name === "POWER BOMB");

/* ---- app-side literals pinned equal to words.js (src/app may not import src/render) ---- */
{
  const L = W.LABEL, lv = (a, b) => L.LEVEL + "S " + a + "-" + b;
  const want = [
    ["FLAWLESS", lv(1, 5) + " IN ONE RUN · NO LIFE LOST"],
    ["UNSCATHED", lv(6, 8) + " IN ONE RUN · NO LIFE LOST"],
    ["ALL IN", lv(1, 5) + " IN ONE RUN · ALL FOUR " + L.MODIFIERS],
    ["ALL OUT", lv(6, 8) + " IN ONE RUN · ALL FOUR " + L.MODIFIERS],
    ["OVERDRIVE", lv(1, 5) + " IN ONE RUN AT " + W.speedTag(1)],
    ["REDLINE", lv(6, 8) + " IN ONE RUN AT " + W.speedTag(1)],
    ["SPRINT", lv(1, 5) + " IN 3:00 · ALL " + W.DIFF[0] + " · NO " + L.MODIFIERS], // the medal tile's 46-char budget; ALL NORMAL is honest only while both defaults read NORMAL
    ["IRON CROWN", lv(6, 8) + " IN ONE RUN ON " + W.diffTag(2)],
  ];
  check("medals.js rule copy = the words.js words; the proper names stay", J(MEDAL_ROWS) === J(want) && W.DIFF[0] === W.SPEED[1], J(MEDAL_ROWS));
}
{
  const st = clampStats({ a: { runs: 118, rooms: 214, deaths: 301, kills: 4820, picks: 913, bricks: 7702, secs: 50820, sessions: 42, days: 9, first: "2026-08-30", last: "2026-09-07" } });
  let b = recordBest({}, "0:0:1", 1840, 5);
  b = recordBest(b, "1:0:1", 2210, 4);
  const rows = statsRows(st, b);
  check("stats.js rows: LEVELS CLEARED, POWER-UPS, the three difficulty bests named, LEVEL n",
    rows[1][0] === "LEVELS CLEARED" && rows[4][0] === "POWER-UPS" && rows[7][0] === W.diffTag(0) && rows[8][0] === W.diffTag(1) && rows[9][0] === W.diffTag(2) &&
      rows[7][1] === "1840 · " + W.LABEL.LEVEL + " 5" && rows[8][1] === "2210 · " + W.LABEL.LEVEL + " 4" && rows[9][1] === "—", J(rows));
  const notes = statsNotes(st, null, "2026-09-07");
  check("stats.js note: the session line (the BESTS row on the page names the bucket: the words outgrew the note)", notes[0] === "SINCE 2026-08-30 · LAST 2026-09-07 · 42 SESSIONS", notes[0]);
  const lines = statsPayload(st, b, { b: { "1:0:0:1": 389 } }, "2026-09-07").split("\n");
  check("stats.js clipboard payload uses the new words (R10)",
    lines[1] === "RUNS 118 · LEVELS 214 · DEATHS 301 · KILLS 4820 · POWER-UPS 913 · BRICKS 7702 · TIME 14h 07m" &&
      lines[2] === W.diffTag(0) + " 1840/" + W.LABEL.LEVEL + " 5 · " + W.diffTag(1) + " 2210/" + W.LABEL.LEVEL + " 4 · " + W.diffTag(2) + " — · " + W.LABEL.LEVEL + " 1 " + W.diffTag(0) + " BEST TIME 0:38.9", J(lines));
}
check("gfx.js lock line names ART STYLE and SETTINGS", LOCK_3D === "REAL 3D ONLY · CHANGE " + W.LABEL.ART_STYLE + " IN " + W.LABEL.SETTINGS, LOCK_3D);

/* ---- the old words ---- */
const OLD = /\b(HEAT|CORE|PLUS|PACE|NORM|MODES|IRON|BARE|THIN|ROOMS?|LV|OPTIONS|RENDER|CHANGE RUN|EASY|PICKS|PICKUPS?|CUBES?)\b/i;
const ALLOW_HUD = new Set(["LV", heatToken(0), heatToken(1), heatToken(2)]); // drawHudChips only, Phase 8 (R9)
const scrub = (s) => s.replace(/IRON CROWN/g, "").replace(/NO FLOOR ITEMS|FEWER ITEMS/gi, "");
const bad = (s) => OLD.test(scrub(s)) || /\bITEMS?\b/i.test(scrub(s)) || /\b[LR]\d\b/.test(s) || /\bHARD\W{0,3}(SPEED|PACE)\b|\b(SPEED|PACE)\W{0,3}HARD\b/i.test(s);
const MAX_OK = /^(MAX|(FLAME|BOMB|SPEED|SPD) MAX)$|\(max \d\)|MAX IS UP TO YOUR SCREEN/; // a capped power-up (alone: the ability bar, SENSITIVITY, FRAME RATE values), the help's (max n), FRAME RATE's help
const found = new Map();
/* ruling 7: a bare NORMAL (a difficulty and a speed) or HARD (a speed before v202) only on a draw that names its setting */
const bare = [];
const named = (where, ss) => {
  const all = ss.join("\n").replace(/ALL NORMAL/g, ""), b = /\b(NORMAL|HARD)\b(?! (DIFFICULTY|SPEED)\b)/.exec(all);
  if (b && !/DIFFICULTY|SPEED/.test(all)) bare.push(where + " :: " + b[0]);
  else if (b && b[1] === "HARD" && !/DIFFICULTY/.test(all)) bare.push(where + " :: HARD with no DIFFICULTY");
};
/* a chip name broken over two lines (NO FLOOR / ITEMS) is read back as one */
const note = (where, texts, draw) => {
  const ss = texts.map((t) => String(typeof t === "string" ? t : t && t.s != null ? t.s : t));
  if (draw) named(where, ss);
  for (let i = 0; i < ss.length; i++) {
    const s = ss[i] === "ITEMS" && /(NO FLOOR|FEWER)$/.test(ss[i - 1] || "") ? ss[i - 1] + " " + ss[i] : ss[i];
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
for (let cur = 0; cur < 8; cur++) for (const o of [{}, { pactUnlocked: true, heat: 2, pace: 1, pact: 15, timeAttack: true, level: 7, padNote: "CONTROLLER READY · VIBRATION MEDIUM" }]) APPS.push(["MENU", { cursor: cur, ...o }]);
APPS.push(["MENU", { soundNote: "NO SOUND YET · PRESS A KEY OR TAP" }], ["MENU", { padNote: "CONTROLLER READY" }]);
for (const o of [{}, { pactUnlocked: true }, { pactUnlocked: true, heat: 1, pace: -1, pact: 15, timeAttack: true, level: 8 }, { pactUnlocked: false, lockR: 7, lockT: 4.9 }]) APPS.push(["LEVEL", o]);
for (const s of ["HOWTO", "ITEMS", "ENEMIES", "FLOOR", "TROPHIES", "CONTROLS"]) APPS.push([s, {}]);
for (let r = 0; r < 4; r++) APPS.push(["GUIDE", { guideRow: r }]);
for (let h = 0; h < 3; h++) APPS.push(["SCORES", { scoreHeat: h }]);
APPS.push(["STATS", {}], ["STATS", { resetArm: true }], ["STATS", { toast: { s: "COPIED", ok: true, t: 1 } }]);
for (let r = 0; r < 12; r++) APPS.push(["SETTINGS", { optRow: r, lookJob: r === 3 ? { k: "px", state: "failed" } : null, _anaSaid: r === 8 }]);
for (let r = 0; r < 8; r++) APPS.push(["GRAPHICS", { gfxRow: r }]);
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
      drawShell(R.ctx, a, { state: "PLAY", time: 1, level: 1 }, box(w, h, lay), kind, SCORES[ci], () => 0b0110, cab);
      note(scr + " " + kind + " " + lay + w + " " + dev, R.texts, true);
      draws++;
    }));
    /* GAME: PAUSE views 1-3 through drawShell, view 0 and WIN / LOSE through drawOverlay (every look calls it with its overlayBox) */
    for (const wo of [{ level: 3, heat: 0, pace: 0, pact: 0 }, { level: 8, heat: 2, pace: 1, pact: 15 }, { level: 6, heat: 1, pace: -1, pact: PACT.BARE }]) {
      for (const v of [1, 2, 3]) {
        const a = mkApp(SCREEN.GAME, { pauseView: v, gfxRow: 1, optRow: 3 }), R = rec({ widthK: 0.648 });
        a.gfxView = () => gfxView(a.settings, kind, {});
        drawShell(R.ctx, a, { state: "PAUSE", time: 1, ...wo }, box(w, h, lay), kind, SCORES[0], () => 0, CABS[0]);
        note("PAUSE view " + v + " " + kind, R.texts, true);
      }
      const B = overlayBox(kind), touch = lay !== "d";
      const RUNS = [null, { r: 3, k: 12, p: 4, t: 200 }, { r: 5, k: 40, p: 9, t: 700, best: { s: 99999, r: 8 }, fromStart: true, md: medalLine(255) }, { r: 5, k: 40, p: 9, t: 700, best: { s: 1, r: 1 }, md: medalLine(128) },
        { r: 2, k: 4, p: 1, t: 90, best: null }, { r: 1, k: 1, p: 0, t: 60, daily: "2026-11-10", tries: 3, dbest: 1840 }, { r: 3, k: 1, p: 0, t: 60, best: { s: 1234, r: 3 } }];
      for (const run of RUNS) for (const [state, lv] of [["PAUSE", wo.level], ["WIN", 3], ["WIN", 5], ["WIN", 8], ["LOSE", wo.level]]) for (const ui of [{ view: 0, cursor: 2, touch }, { view: 0, cursor: 0, touch, note: "CONTROLLER LOST" }, { view: 0, cursor: 1, touch, next: "REAL 3D NEXT" }]) {
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
  for (const o of [{ row: 2 }, { row: 3 }, { row: 7, armed: true }, ...[0, 1, 2, 3].map((vib) => ({ tab: "pad", device: "pad", pad: PR, row: 6, vib })), { tab: "pad", device: "pad", pad: PR, row: 2 }, { tab: "pad", device: "pad", pad: PR, row: 3 }, { tab: "pad", device: "pad", pad: PR, row: 5 }])
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
note("CLIPBOARD", [copyPayload({ level: 3, heat: 2, score: 1234 }), statsPayload(st0, bests0, { b: { "1:0:0:1": 389 } }, "2026-11-10"), pauseKicker({ level: 3, heat: 1, pace: -1, pact: 15 }, { daily: true })]);
/* the DOM cards: the analytics consent card, NEW VERSION READY, the load card and every other player string in index.html */
{
  const mkEl = (tag) => { const kids = {}; return { tag, id: "", hidden: false, innerHTML: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {}, querySelector(sel) { return (kids[sel] = kids[sel] || mkEl(sel)); } }; };
  const body = [], doc = { body: { appendChild: (el) => body.push(el), dataset: { lay: "d" } }, head: { appendChild() {} }, createElement: mkEl, cookie: "" };
  const m = new Map();
  mountAnalytics({ id: "G-TEST1234", store: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }, win: { addEventListener() {} }, doc, loc: { hostname: GA_HOST, pathname: "/fusegrid/" } });
  const card = body.find((e) => e.id === "ana");
  const text = card ? card.innerHTML.replace(/<[^>]+>/g, " ") : "";
  check("the consent card names SETTINGS and the level you reach (card copy only)", !!card && text.indexOf("any time in " + W.LABEL.SETTINGS) >= 0 && text.indexOf("the level you reach") >= 0, text);
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
const hits = [...found].filter(([s]) => bad(s)), maxs = [...found].filter(([s]) => /\bMAX\b/i.test(s) && !MAX_OK.test(s));
check(`render sweep (${draws} shell draws + overlays, 3 looks x 5 boxes x 3 devices) prints no old word; HUD chips and medal names allow-listed`, hits.length === 0, hits.slice(0, 40).map(([s, w]) => w + " :: " + s).join("\n      "));
check("ruling 7: a bare NORMAL or HARD only where the same screen names its setting (DIFFICULTY / SPEED)", bare.length === 0, [...new Set(bare)].slice(0, 20).join("\n      "));
check("MAX only as a capped power-up, a SENSITIVITY level or the help's (max n)", maxs.length === 0, maxs.slice(0, 20).map(([s, w]) => w + " :: " + s).join("\n      "));
{
  /* one marker per branch the sweep must reach, so a narrowed sweep cannot pass by seeing less */
  const SEEN = ["SETTINGS", "ART STYLE", "POWER-UPS", "NORMAL", "EXPERT", "GAME SPEED", "DIFFICULTY", "MODIFIERS", "ONE LIFE", "NO FLOOR ITEMS", "TIME TRIAL", "POWER BOMB", "IRON CROWN",
    "FURTHEST LEVEL YET", "MATCHED YOUR", "FROM YOUR", "DAILY 2026-11-10 · NORMAL SPEED", "PAUSED · LEVEL 3", "LEVEL ENDS", "THROW POWER-UP", "CLEAR LEVEL 5 TO OPEN", "REBIND IN SETTINGS",
    "KEEPS SETTINGS", "replaces POWER BOMB", "NO NORMAL DIFFICULTY RUNS YET", "TOP 4210", "LEVELS 1-5 IN ONE RUN", "BESTS · NO MODIFIERS", "NEXT RUN", "MODIFIERS ONE LIFE", "CHANGE ART STYLE",
    "LEVEL 8 · CROWN", "the level you reach", "DID NOT LOAD · SETTINGS", "· next level", "8 LEVELS", "5 LEVELS · 3 LOCKED", "NO VIBRATION AT ALL", "LIVES 1"];
  const all = [...found.keys()], miss = SEEN.filter((w) => !all.some((s) => s.indexOf(w) >= 0));
  check("the sweep reached every branch it claims (one marker each)", miss.length === 0, miss.join(" | "));
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
  /* LEVEL SELECT: a MODIFIERS name broken over two lines stays inside its chip, in the iso guard and on a narrow touch box */
  const px = (t) => +/(\d+(?:\.\d+)?)px/.exec(t.font)[1];
  for (const [name, L, T] of [["iso 608x352", md.layout(608, 352), false], ["iso touch", md.layout(608, 352), true], ["narrow touch", md.layout(436, 946, 255), true], ["600x520", md.layout(600, 520), false]]) {
    const R = rec({ widthK: 0.648 }), G = md.levelGeom(L, true, T);
    md.drawLevelSelect(R.ctx, 3, L, 1, 1, 15, true, 1, true, T, {});
    const out = [];
    G.mode.forEach((r, i) => {
      const lines = R.texts.filter((t) => t.s && Math.abs(t.x - (r.x + r.w / 2)) < 0.01 && t.y >= r.y - 4 && t.y <= r.y + r.h + 4 && t.align === "center"); // this chip's own centred lines
      for (const t of lines) if (t.y - px(t) / 2 < r.y - 0.01 || t.y + px(t) / 2 > r.y + r.h + 0.01 || t.w > r.w) out.push(i + ":" + t.s + "@" + px(t));
    });
    const n = G.mode.map((r) => R.texts.filter((t) => t.s && Math.abs(t.x - (r.x + r.w / 2)) < 0.01 && t.y >= r.y && t.y <= r.y + r.h).length);
    check(`MODIFIERS chips (${name}): every line inside its chip, two-line names included`, out.length === 0 && n.every((k) => k >= 1) && n.some((k) => k === 2), out.join(" | ") + " " + J(n));
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
      out.push([line, s]);
      i = j + 1;
    } else i++;
  }
  return out;
}
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : []; });
/* the only literals allowed an old word: core's own name tables (the HUD heat token and the scores letters read them until
   Phase 8, R9 / R10) and the HUD's LV chip (Phase 8); the IRON CROWN medal name is scrubbed like on screen */
const SRC_ALLOW = [
  ["src/core/heat.js", /^(CORE|PLUS|MAX)$/], ["src/core/pace.js", /^(EASY|NORM|HARD)$/], ["src/core/pact.js", /^(LAST|BARE|THIN|SHRINK)$/],
  ["src/render/scenes.js", /^LV$/],
];
const OLD_CAPS = new RegExp(OLD.source);
const srcHits = [];
for (const f of walk(join(ROOT, "src"))) {
  const rel = relative(ROOT, f).split("\\").join("/");
  for (const [ln, s] of literals(readFileSync(f, "utf8"))) {
    if (!OLD_CAPS.test(scrub(s)) && !/\b[LR]\d\b/.test(s)) continue; // labels are CAPS; lowercase prose is the sweep's and the cards' job
    if (SRC_ALLOW.some(([p, r]) => p === rel && r.test(s))) continue;
    srcHits.push(rel + ":" + ln + " " + J(s));
  }
}
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
