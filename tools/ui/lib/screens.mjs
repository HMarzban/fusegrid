/* The screens tools/ui/shots.mjs can capture, how each is reached, which gates each must pass, and the capture file names. Pure data and string
   helpers (dev only, never imported by src/). ORDER is the capture order inside one page load: the title, MENU, the menu pages (each reached from
   MENU and left with the debug hook's reset), then the run screens, each on a run of its own (a run writes stores, so they go last).
   A recipe names MENU rows, OPTIONS rows and GUIDE doors by LABEL (any label in the list; Task 2.2 renames OPTIONS to SETTINGS), never by index:
     menu   MENU row labels (app.cursor over menuapp ITEMS), then confirm
     opt    OPTIONS row labels (app.optRow over OPT_ROWS), then confirm. optRow indexes the rows on screen (v202 Task 2.4: CAMERA and
            BRIGHTNESS only in REAL 3D), so only a row above CAMERA has the same index in every look; the doors are reached by keys
     guide  GUIDE door labels (app.guideRow over GUIDE_ROWS), then confirm
     key    a key code, or a list of them pressed in order, on the page reached (RECORDS opens on SCORES; E steps one tab: STATS, then MEDALS)
     real   press the keys as real key events on a phone capture too (else a phone capture calls app.key, which keeps tap mode)
     wait   "controls": the lazy CONTROLS page must be in (app.controls.loading false) before the frames are stepped; "records": the lazy RECORDS
            page (pages/lazy.js) must be in
     run    a run screen: play, pause, win or lose (store: localStorage items set before the run, e.g. a saved best; daily: the run is MENU's DAILY)
     tags   (a pause screen) the run's rules seeded through the debug hook before PAUSE: EXPERT, FAST, every modifier, TIME TRIAL (the tag row)
     state  what window.__GAME__.state() must read before the capture; a mismatch is an error and no PNG
     settle virtual ms stepped before the capture (default 600)
     exempt {gate: "reason"}: an EXEMPTABLE gate (tools/ui/lib/gatelib.mjs: the ten REQUIRED ones, plus touch and gap for a phone screen with no
            tap targets of its own, the title's tap-anywhere, PLAY's DOM touch strip) this screen has nothing for, each with a one-line reason.
            DEFAULT-DENY: every other EXEMPTABLE gate is in the screen's `need`, so once the page records into the probe, a required gate it does not
            declare is skipped ("required, not declared") and fails --strict. Only this tracked table exempts, in review, when a page task instruments
            its page; the page under test cannot exempt itself. MENU (v202 Task 3.1) is the first instrumented screen, LEVEL SELECT (Task 3.3) the second.
     exemptPhone {gate: "reason"}: more exemptions for the .phone captures only (needPhone), on the same rules (RECORDS, v202 fix round 1: a phone
            capture is tap mode, where the page shows no focus).
     exemptIfNo {gate: {rect: "regex", why: "reason"}}: the gate is exempt on a capture only where the page's probe recorded no rect whose name
            matches (needFor): where the part the gate measures is drawn, the gate is required (RECORDS' filled STATS, locked: a locked level). */
import { EXEMPTABLE } from "./gatelib.mjs";

const ROWS = {
  title: { state: "INTRO", settle: 1200 },
  menu: { state: "MENU", settle: 1200, exempt: { chosen: "MENU shows no chosen / unchosen values: every row is a door or the PLAY key", locked: "MENU shows no locked value: every row is open" } },
  level: { menu: ["LEVEL SELECT"], state: "LEVEL", exempt: { ring: "LEVEL SELECT's rows take the band and bomb with no key ring (the d-03 frame's focused LEVEL row); the ring is START's, a door key's or an open list entry's, measured whenever one is focused (the phone's tap mode)", locked: "after the first CLEAR (the world 6-8 captures open rooms 6-8) no level is locked; before it the wall keys record locked pairs, measured when present" } },
  options: { menu: ["OPTIONS", "SETTINGS"], state: "SETTINGS", exemptPhone: { band: "a phone capture is tap mode (the title press a tap, the rest through __GAME__.app): R1 cohesion ruling 5, tap mode shows no focus (no focused row, so no band)" }, exempt: { ring: "SETTINGS has no focused key: the focused row wears the band and the bomb", locked: "SETTINGS shows no locked value: CAMERA and BRIGHTNESS are hidden outside REAL 3D, never locked" }, exemptIfNo: { chosen: { rect: "^two-state ", why: "a page that shows no rocker and no meter with an empty cell has no chosen pair (a 667 x 375 phone's first page: MUSIC and SFX, both full)" } } },
  graphics: { menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "ArrowUp", "Enter"], state: "GRAPHICS", exemptPhone: { band: "a phone capture is tap mode (the title press a tap, the rest through __GAME__.app): R1 cohesion ruling 5, tap mode shows no focus (no focused row, so no band)" }, exempt: { ring: "GRAPHICS has no focused key: the focused row wears the band and the bomb", locked: "REAL 3D locks no GRAPHICS row (CLASSIC 2D and PIXEL declare their locked pair and are measured)" }, exemptIfNo: { chosen: { rect: "^two-state ", why: "a GRAPHICS page that shows no two-state part (a landscape phone's paged column, its steppers door rows there, as on a phone) has no chosen pair; where the FPS METER rocker is drawn (the desk included) it is measured (R1 cohesion 12, SETTINGS' rule)" } } }, // ↑ from the top wraps: RESET DEFAULTS, CONTROLS, GRAPHICS (the last three rows in every look)
  controls: { menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "Enter"], wait: "controls", state: "CONTROLS" },
  guide: { menu: ["GUIDE"], state: "GUIDE", exemptPhone: { band: "a phone capture is tap mode (the title press a tap, the rest through __GAME__.app): R1 cohesion ruling 5, tap mode shows no focus (no focused door, so no band)", ring: "a phone capture is tap mode (the title press a tap, the rest through __GAME__.app): R1 cohesion ruling 5, tap mode shows no focus (no focused door, so no ring)" }, exempt: { chosen: "GUIDE pages show no chosen / unchosen values: doors, foes and read-only rows", locked: "GUIDE pages show no locked value" } }, // v202 Task 3.5: GUIDE and its four pages on the world kit
  howto: { menu: ["GUIDE"], guide: ["HOW TO PLAY"], state: "HOWTO", exempt: { chosen: "GUIDE pages show no chosen / unchosen values: doors, foes and read-only rows", locked: "GUIDE pages show no locked value", band: "a read-only page has no focus: any tap or key backs out", ring: "a read-only page has no focus, so no ring", gap: "one tap target at most (the phone BACK key)", info: "no non-text mark carries information: each icon and keycap repeats its row's word" } },
  items: { menu: ["GUIDE"], guide: ["ITEMS", "POWER-UPS"], state: "ITEMS", exempt: { chosen: "GUIDE pages show no chosen / unchosen values: doors, foes and read-only rows", locked: "GUIDE pages show no locked value", band: "a read-only page has no focus: any tap or key backs out", ring: "a read-only page has no focus, so no ring", gap: "one tap target at most (the phone BACK key)" } },
  enemies: { menu: ["GUIDE"], guide: ["ENEMIES"], key: ["ArrowLeft", "Enter"], state: "ENEMIES", exempt: { chosen: "GUIDE pages show no chosen / unchosen values: doors, foes and read-only rows", locked: "GUIDE pages show no locked value" } }, // ← from WALKER wraps to KNIGHT and Enter opens its points tooltip (the round 6 frame; a key move alone opens it on a keyboard)
  floor: { menu: ["GUIDE"], guide: ["FLOOR"], state: "FLOOR", exempt: { chosen: "GUIDE pages show no chosen / unchosen values: doors, foes and read-only rows", locked: "GUIDE pages show no locked value", band: "a read-only page has no focus: any tap or key backs out", ring: "a read-only page has no focus, so no ring", gap: "one tap target at most (the phone BACK key)", info: "no non-text mark carries information: the tile cells are pictures, each row's words name them" } },
  /* R1 release (c): the same pages reached by REAL key presses (real: a phone capture presses the recipe keys as CDP key events, not app.key), so
     app.lastDev is the keyboard and the page shows its focus: the band and ring stay gated on the phone, where the tap captures above are exempt */
  optionskeys: { menu: ["OPTIONS", "SETTINGS"], key: ["ArrowDown", "ArrowUp"], real: true, state: "SETTINGS", settle: 1000, exempt: { ring: "SETTINGS has no focused key: the focused row wears the band and the bomb", locked: "SETTINGS shows no locked value: CAMERA and BRIGHTNESS are hidden outside REAL 3D, never locked" }, exemptIfNo: { chosen: { rect: "^two-state ", why: "a page that shows no rocker and no meter with an empty cell has no chosen pair (a 667 x 375 phone's first page: MUSIC and SFX, both full)" } } },
  graphicskeys: { menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "ArrowUp", "Enter"], real: true, state: "GRAPHICS", settle: 1000, exempt: { ring: "GRAPHICS has no focused key: the focused row wears the band and the bomb", locked: "REAL 3D locks no GRAPHICS row (CLASSIC 2D and PIXEL declare their locked pair and are measured)" }, exemptIfNo: { chosen: { rect: "^two-state ", why: "a GRAPHICS page that shows no two-state part (a landscape phone's paged column, its steppers door rows there, as on a phone) has no chosen pair; where the FPS METER rocker is drawn (the desk included) it is measured (R1 cohesion 12, SETTINGS' rule)" } } },
  guidekeys: { menu: ["GUIDE"], key: ["ArrowDown", "ArrowUp"], real: true, state: "GUIDE", settle: 1000, exempt: { chosen: "GUIDE pages show no chosen / unchosen values: doors, foes and read-only rows", locked: "GUIDE pages show no locked value" } },
  /* review Minor 6 (fix round 1b): RECORDS reached through the real lazy load, MENU's lazy.idle() in the page's own idle callback; its wait never asks
     want() itself. Run it first among the RECORDS rows of a run (or alone), or an earlier row's forced want() stands in for the idle load */
  scoresidle: { menu: ["RECORDS"], wait: "records-idle", state: "SCORES", exemptPhone: { ring: "a phone capture is tap mode (touch hints, no controller): the page shows no focus, as LEVEL SELECT (v202 fix round 1)", band: "a phone capture is tap mode: no focus band" }, exempt: { locked: "SCORES shows no locked value: the badges not yet earned are lock tags on a dark chip, not wall cells, and every key is open" } },
  scores: { menu: ["RECORDS"], wait: "records", state: "SCORES", exemptPhone: { ring: "a phone capture is tap mode (touch hints, no controller): the page shows no focus, as LEVEL SELECT (v202 fix round 1)", band: "a phone capture is tap mode: no focus band" }, exempt: { locked: "SCORES shows no locked value: the badges not yet earned are lock tags on a dark chip, not wall cells, and every key is open" } }, // v202 Task 4.1
  stats: { menu: ["RECORDS"], key: "KeyE", wait: "records", state: "STATS", exemptPhone: { ring: "a phone capture is tap mode (touch hints, no controller): the page shows no focus, as LEVEL SELECT (v202 fix round 1)", band: "a phone capture is tap mode: no focus band" }, exempt: { locked: "STATS from a fresh profile draws no level course (no run is saved), the one place a locked level shows as a wall cell" } }, // v202 Task 4.2
  statsreset: { menu: ["RECORDS"], key: ["KeyE", "KeyR"], wait: "records", state: "STATS", exempt: { locked: "the armed STATS page from a fresh profile draws no level course (no run is saved)" }, exemptIfNo: { chosen: { rect: "^tab ", why: "a landscape phone's armed confirm plate is the page's plate: the tabs (the page's one chosen pair) are hidden under it (R1 release ruling)" } } }, // STATS armed: the confirm plate
  /* fix round 1b: a paged STATS (a small phone) on its second page: ↓ into the body, ↓ again (on an unpaged box the second ↓ does nothing) */
  statspage2: { menu: ["RECORDS"], key: ["KeyE", "ArrowDown", "ArrowDown"], wait: "records", state: "STATS", exemptPhone: { ring: "a phone capture is tap mode (touch hints, no controller): the page shows no focus, as LEVEL SELECT (v202 fix round 1)", band: "a phone capture is tap mode: no focus band" }, exempt: { locked: "the second page holds LIFETIME and BEST BY DIFFICULTY, no level course; unpaged, a fresh profile draws none" } },
  medals: { menu: ["RECORDS"], key: ["KeyE", "KeyE"], wait: "records", state: "TROPHIES", exemptPhone: { ring: "a phone capture is tap mode (touch hints, no controller): the page shows no focus, as LEVEL SELECT (v202 fix round 1)", band: "a phone capture is tap mode: no focus band" }, exempt: { locked: "MEDALS shows no locked value: a medal not yet earned is a goal tile, read-only, never a wall cell" } },
  /* v202 fix round 1: a played-looking cabinet (window.__GAME__.seedRecords(), debug only) for a FILLED SCORES table, badges and a STATS hero; after
     the fresh-profile pages, since the seeded storage stays for the rest of the page load */
  scoresfull: { menu: ["RECORDS"], seed: "records", wait: "records", state: "SCORES", exemptPhone: { ring: "a phone capture is tap mode (touch hints, no controller): the page shows no focus, as LEVEL SELECT (v202 fix round 1)", band: "a phone capture is tap mode: no focus band" }, exempt: { locked: "SCORES shows no locked value: the badges not yet earned are lock tags on a dark chip, not wall cells, and every key is open" } },
  statsfull: { menu: ["RECORDS"], seed: "records", key: "KeyE", wait: "records", state: "STATS", exemptPhone: { ring: "a phone capture is tap mode (touch hints, no controller): the page shows no focus, as LEVEL SELECT (v202 fix round 1)", band: "a phone capture is tap mode: no focus band" }, exemptIfNo: { locked: { rect: "^level \\d locked$", why: "no locked level drawn: world 8 opens levels 6-8, and a phone at its step 2 or a later STATS page draws no course" } } },
  play: { run: "play", state: "PLAY", settle: 900 },
  pause: { run: "pause", state: "PAUSE", settle: 300, exempt: { chosen: "PAUSE shows no chosen / unchosen values: every row is a verb or a door", locked: "PAUSE shows no locked value: every row is open" } },
  pausetags: { run: "pause", tags: true, state: "PAUSE", settle: 300, exempt: { chosen: "PAUSE shows no chosen / unchosen values: every row is a verb or a door", locked: "PAUSE shows no locked value: every row is open" } },
  win: { run: "win", state: "WIN", settle: 3400, exempt: { chosen: "a level clear has no chosen / unchosen value (the finale records its course: won vs locked)", locked: "a level clear and a finale with levels 6-8 open show no locked part (a first finale records its locked levels)" } },
  lose: { run: "lose", state: "LOSE", settle: 1600, exempt: { locked: "levels 6-8 open (world 6-8 captures) show no locked level; a first-run capture records its locked levels" } },
  loseshort: { run: "lose", store: { "nb.bests.v1": '{"b":{"0:0:1":{"s":5000,"r":5}}}' }, state: "LOSE", settle: 1600, exempt: { locked: "levels 6-8 open (world 6-8 captures) show no locked level; a first-run capture records its locked levels" } }, // a saved NORMAL best of 5000: the shortfall line
  losedaily: { run: "lose", daily: true, state: "LOSE", settle: 1600 }, // today's DAILY (level 1, JUNGLE, whatever --world): Same board and the day's line
};
/* a row's need from its exemptions: EXEMPTABLE minus each exempt gate, which must be EXEMPTABLE and carry a non-empty reason */
export function needOf(name, exempt = {}) {
  for (const [g, why] of Object.entries(exempt)) if (!EXEMPTABLE.includes(g) || typeof why !== "string" || !why.trim()) throw new Error("screens: " + name + " exempts " + g + " without a reason, or it is not an EXEMPTABLE gate");
  return Object.freeze(EXEMPTABLE.filter((g) => !exempt[g]));
}
for (const [n, r] of Object.entries(ROWS)) {
  r.need = needOf(n, r.exempt);
  r.needPhone = r.exemptPhone ? needOf(n, { ...r.exempt, ...r.exemptPhone }) : r.need;
  for (const [g, c] of Object.entries(r.exemptIfNo || {})) if (!EXEMPTABLE.includes(g) || !c || typeof c.rect !== "string" || !String(c.why || "").trim()) throw new Error("screens: " + n + " exemptIfNo " + g + " wants an EXEMPTABLE gate, a rect pattern and a reason");
  r.exempt = Object.freeze({ ...(r.exempt || {}) });
  if (r.exemptPhone) r.exemptPhone = Object.freeze({ ...r.exemptPhone });
  Object.freeze(r);
}
export const SCREENS = Object.freeze(ROWS);
/* a capture's need: its row's (needPhone on a .phone capture), less each exemptIfNo gate whose part the probe did not record */
export function needFor(row, d) {
  let need = d && d.flags && d.flags.phone ? row.needPhone : row.need;
  const rects = (d && d.ui && d.ui.rects) || [];
  for (const [g, c] of Object.entries(row.exemptIfNo || {})) { const re = new RegExp(c.rect); if (!rects.some((r) => re.test(r.name || ""))) need = need.filter((x) => x !== g); }
  return need;
}
export const ORDER = Object.freeze(Object.keys(SCREENS));
export const ALIAS = Object.freeze({ settings: "options" });
export const LOOKS = Object.freeze(["2d", "px", "3d"]);

export const canon = (n) => { const s = String(n || "").toLowerCase(); return SCREENS[s] ? s : ALIAS[s] || null; };
/* <screen>.<look>.w<n>[.t125][.phone]; the PNG and the JSON dump add .png / .json, the text-hidden twin .notext.png */
export const capName = (o) => [o.screen, o.look, "w" + o.world, ...(o.t125 ? ["t125"] : []), ...(o.phone ? ["phone"] : [])].join(".");
const RE = new RegExp("^(" + ORDER.join("|") + ")\\.(" + LOOKS.join("|") + ")\\.w([1-8])(\\.t125)?(\\.phone)?\\.png$");
export function parseCapName(f) {
  const m = RE.exec(f);
  return m ? { screen: m[1], look: m[2], world: +m[3], t125: !!m[4], phone: !!m[5] } : null;
}
