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
  DIFFICULTY: "DIFFICULTY",
  GAME_SPEED: "GAME SPEED",
  MODIFIERS: "MODIFIERS",
});
export const diffWord = (h) => DIFF[clampHeat(h)];
export const speedWord = (p) => SPEED[clampPace(p) + 1];
export const diffTag = (h) => diffWord(h) + " DIFFICULTY";
export const speedTag = (p) => speedWord(p) + " SPEED";
export const modWords = (mask) => MOD_BITS.filter((b) => clampPact(mask) & b).map((b) => MOD[b]);
export const modCount = (mask) => modWords(mask).length;
/* run = {heat, pace, pact, time}: every setting (all) or only what differs from a default run, each naming its setting. */
function parts(run, all) {
  const r = run || {}, h = clampHeat(r.heat), p = clampPace(r.pace), out = [];
  if (all || h) out.push(diffTag(h));
  if (all || p) out.push(speedTag(p));
  out.push(...modWords(r.pact));
  if (r.time) out.push(TIME_TRIAL);
  return out;
}
export const runWords = (run) => parts(run, true).join(" · ");
export const tagFor = (run) => parts(run, false).join(" · ");
