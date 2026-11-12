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
export const POINTS_RULE = DIFF[1] + " ×2 · " + DIFF[2] + " ×3"; // ENEMIES' one-line compact tooltip: the points rule only (R1 landscape)
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
/* the saved-score multiplier, named: "×2 HARD DIFFICULTY" (score × difficulty is what the score tables keep) */
export const multTag = (h) => "×" + (clampHeat(h) + 1) + " " + diffTag(h);
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
/* SHELL WORDS (R1 cohesion): the verbs and touch lines more than one page reads, each defined once (kit/copy.js re-exports the kit's). */
export const BACK = "BACK", OPEN = "OPEN", PAGE = "PAGE", OF = "OF", ROW = "ROW", CHANGE = "CHANGE", ON = "ON", OFF = "OFF", MENU = "MENU";
export const BACK_TAP = "TAP OUTSIDE TO GO " + BACK;
export const TAP_ROW = "TAP A ROW TO CHANGE IT";
export const FOOT_TAP = TAP_ROW + " · " + BACK_TAP;
export const LOAD_WORDS = Object.freeze({loading: "LOADING", failed: "DID NOT LOAD"});
export const TO_CONTROLS = LABEL.SETTINGS + " › CONTROLS"; // the controller's signpost: where rebinding lives
/* the RENDER row's job words (kit/copy.js lookVal): a failure's retry, READY, a slow fetch, the prepare phases */
export const LOOK_WORDS = Object.freeze({RETRY: "RETRY", TAP_RETRY: "TAP TO RETRY", READY: "READY", SLOW: "SLOW, STILL TRYING", PREPARING: "PREPARING",
  PH: Object.freeze({bake: "ART", build: "BUILDING", shaders: "SHADERS"})});
/* MENU (v202 Task 3.1): the rows in order (menuapp ITEMS is pinned equal), the art styles by RENDER value 0..2, and the page's
   teaser and foot words (round 7 S7-menu). */
/* PAUSE (v202 Task 5.1): its rows (menuapp PAUSE_ITEMS, pinned equal), title, the daily tag and the foot verb */
export const PAUSE_WORDS = Object.freeze({RESUME: "RESUME", RESTART: "RESTART", QUIT: "QUIT TO MENU", PAUSED: "PAUSED", DAILY: "DAILY", CONFIRM: "CONFIRM"});
/* the run ends (v202 Tasks 5.2-5.4): headlines, stat names, keys and the controller caps of COPY RESULT / COPY MAP; MENU is words.js MENU */
export const END_WORDS = Object.freeze({TIME: "TIME", DAILY: "DAILY", CLEAR: "CLEAR", ENEMIES: "ENEMIES", NEXT: "NEXT LEVEL", FUSE_CLEAR: "FUSE/GRID CLEAR", SCORE: "SCORE",
  OPEN: "6 TO 8 NOW OPEN", OVER: "GAME OVER", NEW_BEST: "NEW BEST", NEW: "NEW", FURTHEST: "FURTHEST", YET: "YET", AGAIN: "TRY AGAIN", MORE: "MORE",
  COPY: "COPY RESULT", MAP: "COPY MAP", CAP_COPY: "WEST", CAP_MAP: "NORTH"});
export const MENU_ROWS = Object.freeze(["PLAY", LABEL.LEVEL_SELECT, "DAILY", LABEL.RECORDS, LABEL.SETTINGS, "GUIDE", "SOURCE"]);
export const ART_STYLES = Object.freeze(["CLASSIC 2D", "PIXEL", "REAL 3D"]);
export const MENU_WORDS = Object.freeze({
  LEVEL_TEASE: LABEL.LEVEL + " · " + LABEL.DIFFICULTY + " · SPEED", NEW: "NEW · TODAY'S BOARD", NEW_SHORT: "NEW TODAY",
  TRIES: "YOUR TRIES TODAY", TRIES_SHORT: "TRIES TODAY", TRIES_MIN: "TRIES", BEST: "BEST", NO_RUNS: "NO RUNS YET", PAGES: "PAGES",
  GITHUB: "GITHUB", MOVE: "MOVE", START: "START", OPEN, TAP: "TAP A ROW",
  SOURCE_PAD: "NEEDS A CLICK OR ENTER", // a controller press opens no browser tab: SOURCE's foot says so while a controller drives MENU
  SOURCE_PAD_SHORT: "CLICK OR ENTER", // its step-down on the phone / compact SOURCE row, where the whole sentence does not fit
  PAD_READY: "CONTROLLER READY", PAD_BACK: "CONTROLLER BACK", // the app's pad notes (controlswire), read back to make the signpost
});
/* CONTROLS (v202 Task 6.1, appendix 9.2): the no-controller plaque and its line, the appendix's own sentence. */
export const CONTROLS_WORDS = Object.freeze({ NONE: "NO CONTROLLER", CONNECT: "Connect one and press a button.",
  /* the CONTROLS page on the world kit (v202 Task 6.3, the round 7 C7-controls frames): head, tabs, the pane's head and rule, the row parts, the foot's verbs */
  TITLE: "CONTROLS", KEYBOARD: "KEYBOARD", CONTROLLER: "CONTROLLER", LOST: "CONTROLLER LOST", ALSO: "ALWAYS ON, ALONGSIDE A CONTROLLER", TEST: "PRESS ANY BUTTON TO TEST IT",
  RULE_PAD: "In menus SOUTH or START confirms and EAST goes back. Those never change.", RULE_KEY: "ENTER confirms and ESC goes back in every menu. Those never change.",
  FIXED: "FIXED", SWAPPED: "SWAPPED", AGAIN: Object.freeze(["PRESS AGAIN", "AGAIN"]), PLUS: "+ ", NO_DRAWING: "NO DRAWING FOR THIS CONTROLLER", LISTEN: "REBIND", NO_LIMIT: "NO TIME LIMIT", CHANGED: "CHANGED", FOR: " FOR ", DRIFT: "DRIFT ", READS: "READS ", NOTHING: "NOTHING",
  ROW, TAB: "TAB", CHANGE, ADJUST: "ADJUST", RESET: "RESET", BACK, CANCELS: " CANCELS", KEEPS: " KEEPS IT" });
/* The next-run card (v202 Task 3.2, MENU; LEVEL SELECT reuses it): its kicker, the level's mark (level 1, a finale, the last one), its
   section labels and its stat cells. ENEMIES counts the kinds when their names do not fit (the GUIDE page's word). */
export const CARD_WORDS = Object.freeze({
  NEXT: "NEXT RUN", FIRST: "YOUR FIRST LEVEL", FINALE: "FINALE", LAST: "THE LAST FINALE", MEET: "YOU'LL MEET", ENEMIES: "ENEMIES",
  TILE: "FLOOR TILE", LIVES: "LIVES", FUSE: "FUSE", SCORE: "SCORE",
  ALL_EACH: "ALL NINE · ONE OF EACH", // YOU'LL MEET where the roster is every foe kind once (the approved CROWN mock, NORMAL only)
});
/* LEVEL SELECT (v202 Task 3.3, the round 7 S7-menu d-03 / p-03 frames): the foot's verbs (label first, keycap last), the MODIFIERS door's teaser
   words, the lock tip, the card's BEST mark, the touch foot and the desk's help line (one sentence, sentence case; units unspaced). */
const MOD_SENT = Object.freeze(["One life for the whole run.", "No power-ups wait on the floor.", "Fewer power-ups hide in bricks.", "Walls close in from 25s.", "A timer and a best time for each level."]);
export const LEVEL_WORDS = Object.freeze({
  ROW, CHANGE, PICK: "PICK", TOGGLE: "TOGGLE", OPEN, BACK, ON, OFF, NONE: "NONE",
  LOCKED: "CLEAR LEVEL 5 TO OPEN", BEST: "BEST", NO_TIME: "NO TIME YET",
  TAP: "TAP START TO PLAY · " + BACK_TAP, TAP_LIST: "TAP START TO PLAY · TAP OUTSIDE TO " + LABEL.CLOSE,
  MOD_HELP: MOD_SENT, PAD_HELP: "TRIGGERS pick a modifier, NORTH toggles it.", // a controller's shortcut: TRIGGERS walk the list shut, NORTH toggles // by list entry: the four modifier bits in MOD_BITS order, then TIME TRIAL
  help: (n, open) => "Level " + n + " of 8. " + (open ? "Levels 5 and 8 end in a finale." : "Clear level 5 to open 6 to 8."),
});
/* RECORDS (v202 Tasks 4.1 / 4.2, pages/records.js): the page's own words. Badges are the four plaques (src/app/plaques.js bit order CLEAR, PLUS, MAX,
   CROWN), the two difficulty ones read as their difficulty. */
export const REC_WORDS = Object.freeze({
  MENU, BACK, TAB: LABEL.TAB, BADGES: "BADGES", RANK: "RANK", SCORE: "SCORE", DATE: "DATE",
  NONE: "—", NO_MODS: "NO " + LABEL.MODIFIERS, EARNED: "EARNED", TAP: "TAP A TAB · " + BACK_TAP,
  WEST: "WEST", NORTH: "NORTH", // STATS' controller keys (src/app/controls.js BTN names): COPY and MEDALS
});
/* SETTINGS and GRAPHICS (v202 Task 3.4, pages/settings.js): the page's own words; the row labels are menuapp OPT_ROWS / gfx.js GFX_ROWS (pinned). */
export const SETTINGS_WORDS = Object.freeze({
  looks: "The same game in three looks. PIXEL and REAL 3D download the first time you pick them.",
  add3d: "REAL 3D adds two rows here: CAMERA and BRIGHTNESS.",
  on3d: "CAMERA and BRIGHTNESS are on the list while REAL 3D is your art style.",
  of: OF, row: ROW, change: CHANGE, back: BACK, tapRow: TAP_ROW, build: "BUILD", perf: "PERFORMANCE · BATTERY", on: ON, off: OFF,
  cam: Object.freeze(["STANDARD", "WIDE", "FAR"]), vib: "VIBRATION",
});
/* GUIDE (v202 Task 3.5, pages/guide.js): the page titles, the doors' teasers, HOW TO's rules, controls and note, the foot's verbs, ENEMIES'
   points words, hint and tooltip, FLOOR's head and its placeholder lines. */
export const GUIDE_WORDS = Object.freeze({
  GUIDE: "GUIDE", HOW: "HOW TO PLAY", ENEMIES: "ENEMIES", FLOOR: "FLOOR", MENU,
  POINTS: "POINTS", PTS: "PTS", APPEARS: "APPEARS IN ",
  RULES: Object.freeze(["CLEAR EVERY ENEMY", "GOLD WALL NEVER BREAKS"]),
  NOTE_KEY: "* NEEDS ITS POWER-UP", NOTE_TAP: "TOUCH · D-PAD MOVES · RIGHT BUTTON BOMBS",
  MOVE: "MOVE", BOMB: "BOMB", THROW: "THROW", REMOTE: "REMOTE", KICK: "KICK", PAUSE: "PAUSE", WALK_INTO: "WALK INTO BOMB",
  PICK: "PICK", OPEN, BACK, PAGE, TAP_DOOR: "TAP A DOOR", TAP_POINTS: "TAP A POINTS VALUE", COLLECT: "WALK OVER A POWER-UP TO COLLECT",
  REBIND: "REBIND IN " + TO_CONTROLS,
  RULES_N: "2 RULES", CONTROLS_N: "6 CONTROLS", KEYS_N: "6 KEYS", FOES: "FOES", TILES: "TILES",
  LOOK_ONLY: "LOOK ONLY FOR NOW", RULE_LATER: "ITS RULE COMES LATER",
  HINT_KEY: "Move to a points value to see what it means.", HINT_TAP: "Tap a points value to see what it means.",
  tip: (name) => "What you score each time your blast takes out a " + name + ". Saved scores count ×2 on " + DIFF[1] + " and ×3 on " + DIFF[2] + ".",
});
export const BADGE_NAMES = Object.freeze(["CLEAR", DIFF[1], DIFF[2], "CROWN"]);
export const noRunsYet = (h) => "NO " + diffTag(h) + " RUNS YET";
export const pickToSet = (h) => "PICK " + diffTag(h) + " ON " + LABEL.LEVEL_SELECT + " TO SET ONE";
/* RECORDS' STATS (v202 Task 4.2): the page's words, and the armed reset's one sentence built from src/app/reset.js CLEAR_KEYS / KEEP_KEYS (handed in by
   main; this file cannot import src/app). RESET_GROUP names each store key's player group; tests/words.test.mjs pins its keys equal to the two lists, so
   a store that joins either list must join this table. Groups print in RESET_ORDER; the sentence names every group with at least one key in its list. */
export const STATS_WORDS = Object.freeze({
  BEST_SCORE: "BEST SCORE", FURTHEST: "FURTHEST " + LABEL.LEVEL, NO_BEST: "NO RUNS YET", LIFETIME: "LIFETIME", BY_DIFF: "BEST BY " + LABEL.DIFFICULTY,
  RUNS: "RUNS", PLAY_TIME: "PLAY TIME", MEDALS: "MEDALS", CLEARED: "LEVELS CLEARED", KILLS: "KILLS", PICKS: LABEL.POWER_UPS, DEATHS: "DEATHS", DAYS: "DAYS PLAYED",
  COPY: "COPY MY STATS", COPY_SHORT: "COPY STATS", RESET: "RESET", ERASE: "ERASE", COPY_ARMED: "COPY", AGAIN: "AGAIN ERASES", CANCEL: "ANY OTHER KEY CANCELS",
  TAP_CANCEL: "TAP ANYWHERE ELSE TO CANCEL", TITLE: "ERASE ALL RECORDS?", MEDALS_T: "MEDALS",
});
export const RESET_GROUP = Object.freeze({
  "nb.highscores.v1": "score", "nb.bests.v1": "best", "nb.times.v1": "time", "nb.daily.v1": "daily try", "nb.ghost.v1": "ghost", "nb.medals.v1": "medal",
  "nb.plaques.v1": "badge", "nb.stats.v1": "stat", "nb.coach.v1": "tips", "nb.coach.v2": "tips", "nb.cabinet.v1": "tips", "nb.pact.v1": "locks",
  "nb.settings.v1": "settings", "nb.pace.v1": "game speed", "nb.analytics.v1": "analytics choice", "nb.controls.v1": "controls",
});
const ERASE_NOUNS = ["score", "best", "time", "daily try", "ghost", "medal", "badge", "stat"], KEEP_NOUNS = ["settings", "game speed", "analytics choice", "controls"];
/* the two groups that are not nouns: how each reads when kept (fix round 1: every group prints in either list, or the sentence throws) */
const KEEP_PHRASE = Object.freeze({tips: "first-time tips already seen", locks: "unlocked levels, modifiers and time trial"});
export const RESET_WORDED = Object.freeze([...ERASE_NOUNS, ...KEEP_NOUNS, "tips", "locks"]);
const andList = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
/** The armed reset's sentence: what clear erases, what keep keeps, each by its group (sentence case). */
export function resetSentence(clear, keep) {
  const g = (l) => new Set((l || []).map((k) => RESET_GROUP[k]).filter(Boolean)), C = g(clear), K = g(keep);
  for (const x of [...C, ...K]) if (!RESET_WORDED.includes(x)) throw new Error("resetSentence: no words for the group " + x + " (add it to the noun lists)");
  const er = ERASE_NOUNS.filter((n) => C.has(n)), parts = [];
  if (er.length) parts.push("erases every " + andList(er));
  if (C.has("tips")) parts.push("shows the first-time tips again");
  if (C.has("locks")) parts.push("locks levels 6–8, modifiers and time trial again");
  const rs = KEEP_NOUNS.filter((n) => C.has(n));
  if (rs.length) parts.push("resets your " + andList(rs)); // a kept group moved to CLEAR is named too
  const kp = [...KEEP_NOUNS, ...ERASE_NOUNS].filter((n) => K.has(n)).concat(Object.keys(KEEP_PHRASE).filter((n) => K.has(n)).map((n) => KEEP_PHRASE[n]));
  const s = parts.length ? parts[0][0].toUpperCase() + andList(parts).slice(1) + "." : "";
  return (s + (kp.length ? " Keeps your " + andList(kp) + "." : "")).trim();
}
/* the short form (R1 release ruling: a landscape phone's armed plate): the same groups, each still named, as plural nouns ("seen tips", "unlocks") */
const PLURAL = Object.freeze({score: "scores", best: "bests", time: "times", "daily try": "daily tries", ghost: "ghosts", medal: "medals", badge: "badges", stat: "stats", tips: "seen tips", locks: "unlocks"});
/** The armed reset's short sentence: every group resetSentence names, in fewer words. */
export function resetShort(clear, keep) {
  const g = (l) => new Set((l || []).map((k) => RESET_GROUP[k]).filter(Boolean)), C = g(clear), K = g(keep);
  for (const x of [...C, ...K]) if (!RESET_WORDED.includes(x)) throw new Error("resetShort: no words for the group " + x + " (add it to the noun lists)");
  const pl = (n) => PLURAL[n] || n, er = [...ERASE_NOUNS, "tips", "locks"].filter((n) => C.has(n)).map(pl), rs = KEEP_NOUNS.filter((n) => C.has(n));
  const kp = [...KEEP_NOUNS, ...ERASE_NOUNS, "tips", "locks"].filter((n) => K.has(n)).map(pl), parts = [];
  if (er.length) parts.push("erases " + andList(er));
  if (rs.length) parts.push("resets " + andList(rs));
  const s = parts.length ? parts[0][0].toUpperCase() + andList(parts).slice(1) + "." : "";
  return (s + (kp.length ? " Keeps " + andList(kp) + "." : "")).trim();
}
/** The sentence for every store this table knows (CLEAR = every group not kept): what the confirm plate is sized for. */
const ALL_CLEAR = Object.keys(RESET_GROUP).filter((k) => !KEEP_NOUNS.includes(RESET_GROUP[k])), ALL_KEEP = Object.keys(RESET_GROUP).filter((k) => KEEP_NOUNS.includes(RESET_GROUP[k]));
export const RESET_DEFAULT = resetSentence(ALL_CLEAR, ALL_KEEP), RESET_SHORT = resetShort(ALL_CLEAR, ALL_KEEP);
/* The HUD (v202 Task 8.2, round 5 09-hud; R9): the seven chips in order, LEVEL for the old LV chip (no difficulty word: lead ruling R1), and the
   phone strip's PAUSE / RESUME and BOMB keys. */
export const HUD_CHIPS = Object.freeze(["LIVES", "BOMBS", "FLAME", LABEL.LEVEL, "ENEMIES", "TIME", "SCORE"]);
export const HUD_WORDS = Object.freeze({ PAUSE: "PAUSE", RESUME: "RESUME", BOMB: "BOMB" });
