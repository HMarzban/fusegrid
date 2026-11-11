/* PLAYER WORDS (UI upgrade v202, design record §3; owner: "we must use the name that users know about"): the one table of the
   words a player reads for a run's settings and the shell's renamed labels. Display only: stores keep their keys, bits and
   indices (nb.pact.v1, heat 0..2, pace -1..1, medal bits), and core keeps HEAT_NAME / PACE_NAME / PACT_NAME / pactLabel for
   the HUD heat token and the scores letters (Phase 8, R9 / R10). src/app may not import this file: its few player strings are
   literals pinned equal to it in tests/words.test.mjs. A difficulty or speed value is printed with its setting's name
   (EXPERT DIFFICULTY, FAST SPEED) wherever nothing beside it names the setting: NORMAL is both a difficulty and a speed. */
import { clampHeat } from "../core/heat.js";
import { clampPace } from "../core/pace.js";
import { PACT, clampPact } from "../core/pact.js";

export const DIFF = Object.freeze(["NORMAL", "HARD", "EXPERT"]); // by heat 0..2
export const SPEED = Object.freeze(["SLOW", "NORMAL", "FAST"]); // by pace + 1
export const MOD = Object.freeze({ [PACT.LAST]: "ONE LIFE", [PACT.BARE]: "NO FLOOR ITEMS", [PACT.THIN]: "FEWER ITEMS", [PACT.SHRINK]: "SHRINK" }); // by PACT bit (R10)
export const MOD_BITS = Object.freeze([PACT.LAST, PACT.BARE, PACT.THIN, PACT.SHRINK]); // chip and list order
export const TIME_TRIAL = "TIME TRIAL";
export const LABEL = Object.freeze({
  SETTINGS: "SETTINGS",
  LEVEL_SELECT: "LEVEL SELECT",
  RECORDS: "RECORDS",
  ART_STYLE: "ART STYLE",
  POWER_UPS: "POWER-UPS",
  LEVEL: "LEVEL",
  LEVELS: "LEVELS",
  DIFFICULTY: "DIFFICULTY",
  GAME_SPEED: "GAME SPEED",
  MODIFIER: "MODIFIER",
  MODIFIERS: "MODIFIERS",
  TAB: "TAB", // RECORDS' foot hints: ←→ TAB on the tab row, ↑ TABS back to it from a page body
  TABS: "TABS",
  START: "START", // LEVEL SELECT's hero row and the last of its rows (menuapp LEVEL_ROWS)
  CLOSE: "CLOSE", // LEVEL SELECT's open MODIFIERS list: ESC / EAST CLOSE, TAP OUTSIDE TO CLOSE
});
/* RECORDS' tabs, in the order ←/→ walk them (menuapp.js RECORD_SCREENS: SCORES, STATS, TROPHIES). */
export const RECORD_TABS = Object.freeze(["SCORES", "STATS", "MEDALS"]);
/* NORMAL difficulty, NORMAL speed, no modifiers: the plain run, as PAUSE's tag row reads it ("only non-default rules"). */
export const DEFAULT_RULES = "DEFAULT RULES";
export const diffWord = (h) => DIFF[clampHeat(h)];
export const speedWord = (p) => SPEED[clampPace(p) + 1];
export const diffTag = (h) => diffWord(h) + " DIFFICULTY";
export const speedTag = (p) => speedWord(p) + " SPEED";
export const modWords = (mask) => MOD_BITS.filter((b) => clampPact(mask) & b).map((b) => MOD[b]);
export const modCount = (mask) => modWords(mask).length;
/* "1 MODIFIER", "4 MODIFIERS", "" for none. */
export const modsCount = (mask) => { const n = modCount(mask); return n ? n + " " + (n === 1 ? LABEL.MODIFIER : LABEL.MODIFIERS) : ""; };
/* A level span as FOES.rooms writes it: "LEVEL 8" for one, "LEVELS 1-8" / "LEVELS 1-3, 5-8" for more. */
export const levelsOf = (span) => (/^\d+$/.test(String(span).trim()) ? LABEL.LEVEL : LABEL.LEVELS) + " " + span;
/* run = {heat, pace, pact, time}, the one non-default filter: each part names its setting. o.all: every setting, defaults
   included; o.diff: the difficulty always; o.count: the modifiers as a count; o.terse: EXPERT bare (the one value no other
   setting or foe shares). */
export function runParts(run, o) {
  const p = o || {}, r = run || {}, h = clampHeat(r.heat), s = clampPace(r.pace), out = [];
  if (p.all || p.diff || h) out.push(p.terse && h === 2 ? DIFF[2] : diffTag(h));
  if (p.all || s) out.push(speedTag(s));
  if (p.count) { const c = modsCount(r.pact); if (c) out.push(c); } else out.push(...modWords(r.pact));
  if (r.time) out.push(TIME_TRIAL);
  return out;
}
export const runWords = (run) => runParts(run, { all: true }).join(" · ");
export const tagFor = (run) => runParts(run).join(" · ");
/* MENU (v202 Task 3.1): the rows in order (menuapp ITEMS is pinned equal), the art styles by RENDER value 0..2, and the page's
   teaser and foot words (round 7 S7-menu). */
export const MENU_ROWS = Object.freeze(["PLAY", LABEL.LEVEL_SELECT, "DAILY", LABEL.RECORDS, LABEL.SETTINGS, "GUIDE", "SOURCE"]);
export const ART_STYLES = Object.freeze(["CLASSIC 2D", "PIXEL", "REAL 3D"]);
export const MENU_WORDS = Object.freeze({
  LEVEL_TEASE: LABEL.LEVEL + " · " + LABEL.DIFFICULTY + " · SPEED", NEW: "NEW · TODAY'S BOARD", NEW_SHORT: "NEW TODAY",
  TRIES: "YOUR TRIES TODAY", TRIES_SHORT: "TRIES TODAY", TRIES_MIN: "TRIES", BEST: "BEST", NO_RUNS: "NO RUNS YET", PAGES: "PAGES",
  GITHUB: "GITHUB", MOVE: "MOVE", START: "START", OPEN: "OPEN", TAP: "TAP A ROW",
  SOURCE_PAD: "NEEDS A CLICK OR ENTER", // a controller press opens no browser tab: SOURCE's foot says so while a controller drives MENU
});
