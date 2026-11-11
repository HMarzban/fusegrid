/* The screens tools/ui/shots.mjs can capture, how each is reached, which gates each must pass, and the capture file names. Pure data and string
   helpers (dev only, never imported by src/). ORDER is the capture order inside one page load: the title, MENU, the menu pages (each reached from
   MENU and left with the debug hook's reset), then the run screens, each on a run of its own (a run writes stores, so they go last).
   A recipe names MENU rows, OPTIONS rows and GUIDE doors by LABEL (any label in the list; Task 2.2 renames OPTIONS to SETTINGS), never by index:
     menu   MENU row labels (app.cursor over menuapp ITEMS), then confirm
     opt    OPTIONS row labels (app.optRow over OPT_ROWS), then confirm. optRow indexes the rows on screen (v202 Task 2.4: CAMERA and
            BRIGHTNESS only in REAL 3D), so only a row above CAMERA has the same index in every look; the doors are reached by keys
     guide  GUIDE door labels (app.guideRow over GUIDE_ROWS), then confirm
     key    a key code, or a list of them pressed in order, on the page reached (RECORDS opens on SCORES; E steps one tab: STATS, then MEDALS)
     wait   "controls": the lazy CONTROLS page must be in (app.controls.loading false) before the frames are stepped; "records": the lazy RECORDS
            page (pages/lazy.js) must be in
     run    a run screen: play, pause, win or lose
     state  what window.__GAME__.state() must read before the capture; a mismatch is an error and no PNG
     settle virtual ms stepped before the capture (default 600)
     exempt {gate: "reason"}: an EXEMPTABLE gate (tools/ui/lib/gatelib.mjs: the ten REQUIRED ones, plus touch and gap for a phone screen with no
            tap targets of its own, the title's tap-anywhere, PLAY's DOM touch strip) this screen has nothing for, each with a one-line reason.
            DEFAULT-DENY: every other EXEMPTABLE gate is in the screen's `need`, so once the page records into the probe, a required gate it does not
            declare is skipped ("required, not declared") and fails --strict. Only this tracked table exempts, in review, when a page task instruments
            its page; the page under test cannot exempt itself. MENU (v202 Task 3.1) is the first instrumented screen, LEVEL SELECT (Task 3.3) the second. */
import { EXEMPTABLE } from "./gatelib.mjs";

const ROWS = {
  title: { state: "INTRO", settle: 1200 },
  menu: { state: "MENU", settle: 1200, exempt: { chosen: "MENU shows no chosen / unchosen values: every row is a door or the PLAY key", locked: "MENU shows no locked value: every row is open" } },
  level: { menu: ["LEVEL SELECT"], state: "LEVEL", exempt: { ring: "LEVEL SELECT's rows take the band and bomb with no key ring (the d-03 frame's focused LEVEL row); the ring is START's, a door key's or an open list entry's, measured whenever one is focused (the phone's tap mode)", locked: "after the first CLEAR (the world 6-8 captures open rooms 6-8) no level is locked; before it the wall keys record locked pairs, measured when present" } },
  options: { menu: ["OPTIONS", "SETTINGS"], state: "SETTINGS", exempt: { ring: "SETTINGS has no focused key: the focused row wears the band and the bomb", locked: "SETTINGS shows no locked value: CAMERA and BRIGHTNESS are hidden outside REAL 3D, never locked" } },
  graphics: { menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "ArrowUp", "Enter"], state: "GRAPHICS", exempt: { ring: "GRAPHICS has no focused key: the focused row wears the band and the bomb", locked: "REAL 3D locks no GRAPHICS row (CLASSIC 2D and PIXEL declare their locked pair and are measured)" } }, // ↑ from the top wraps: RESET DEFAULTS, CONTROLS, GRAPHICS (the last three rows in every look)
  controls: { menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "Enter"], wait: "controls", state: "CONTROLS" },
  guide: { menu: ["GUIDE"], state: "GUIDE", exempt: { chosen: "GUIDE pages show no chosen / unchosen values: doors, foes and read-only rows", locked: "GUIDE pages show no locked value" } }, // v202 Task 3.5: GUIDE and its four pages on the world kit
  howto: { menu: ["GUIDE"], guide: ["HOW TO PLAY"], state: "HOWTO", exempt: { chosen: "GUIDE pages show no chosen / unchosen values: doors, foes and read-only rows", locked: "GUIDE pages show no locked value", band: "a read-only page has no focus: any tap or key backs out", ring: "a read-only page has no focus, so no ring", gap: "one tap target at most (the phone BACK key)", info: "no non-text mark carries information: each icon and keycap repeats its row's word" } },
  items: { menu: ["GUIDE"], guide: ["ITEMS", "POWER-UPS"], state: "ITEMS", exempt: { chosen: "GUIDE pages show no chosen / unchosen values: doors, foes and read-only rows", locked: "GUIDE pages show no locked value", band: "a read-only page has no focus: any tap or key backs out", ring: "a read-only page has no focus, so no ring", gap: "one tap target at most (the phone BACK key)" } },
  enemies: { menu: ["GUIDE"], guide: ["ENEMIES"], key: ["ArrowLeft", "Enter"], state: "ENEMIES", exempt: { chosen: "GUIDE pages show no chosen / unchosen values: doors, foes and read-only rows", locked: "GUIDE pages show no locked value" } }, // ← from WALKER wraps to KNIGHT and Enter opens its points tooltip (the round 6 frame; a key move alone opens it on a keyboard)
  floor: { menu: ["GUIDE"], guide: ["FLOOR"], state: "FLOOR", exempt: { chosen: "GUIDE pages show no chosen / unchosen values: doors, foes and read-only rows", locked: "GUIDE pages show no locked value", band: "a read-only page has no focus: any tap or key backs out", ring: "a read-only page has no focus, so no ring", gap: "one tap target at most (the phone BACK key)", info: "no non-text mark carries information: the tile cells are pictures, each row's words name them" } },
  scores: { menu: ["RECORDS"], wait: "records", state: "SCORES", exempt: { locked: "SCORES shows no locked value: the badges not yet earned are lock tags on a dark chip, not wall cells, and every key is open" } }, // v202 Task 4.1
  stats: { menu: ["RECORDS"], key: "KeyE", wait: "records", state: "STATS", exempt: { locked: "STATS from a fresh profile draws no level course (no run is saved), the one place a locked level shows as a wall cell" } }, // v202 Task 4.2
  statsreset: { menu: ["RECORDS"], key: ["KeyE", "KeyR"], wait: "records", state: "STATS", exempt: { locked: "the armed STATS page from a fresh profile draws no level course (no run is saved)" } }, // STATS armed: the confirm plate
  medals: { menu: ["RECORDS"], key: ["KeyE", "KeyE"], wait: "records", state: "TROPHIES", exempt: { locked: "MEDALS shows no locked value: a medal not yet earned is a goal tile, read-only, never a wall cell" } },
  play: { run: "play", state: "PLAY", settle: 900 },
  pause: { run: "pause", state: "PAUSE", settle: 300 },
  win: { run: "win", state: "WIN", settle: 1800 },
  lose: { run: "lose", state: "LOSE", settle: 1600 },
};
/* a row's need from its exemptions: EXEMPTABLE minus each exempt gate, which must be EXEMPTABLE and carry a non-empty reason */
export function needOf(name, exempt = {}) {
  for (const [g, why] of Object.entries(exempt)) if (!EXEMPTABLE.includes(g) || typeof why !== "string" || !why.trim()) throw new Error("screens: " + name + " exempts " + g + " without a reason, or it is not an EXEMPTABLE gate");
  return Object.freeze(EXEMPTABLE.filter((g) => !exempt[g]));
}
for (const [n, r] of Object.entries(ROWS)) {
  r.need = needOf(n, r.exempt);
  r.exempt = Object.freeze({ ...(r.exempt || {}) });
  Object.freeze(r);
}
export const SCREENS = Object.freeze(ROWS);
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
