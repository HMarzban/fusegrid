/* The screens tools/ui/shots.mjs can capture, how each is reached, which gates each must pass, and the capture file names. Pure data and string
   helpers (dev only, never imported by src/). ORDER is the capture order inside one page load: the title, MENU, the menu pages (each reached from
   MENU and left with the debug hook's reset), then the run screens, each on a run of its own (a run writes stores, so they go last).
   A recipe names MENU rows, OPTIONS rows and GUIDE doors by LABEL (any label in the list; Task 2.2 renames OPTIONS to SETTINGS), never by index:
     menu   MENU row labels (app.cursor over menuapp ITEMS), then confirm
     opt    OPTIONS row labels (app.optRow over OPT_ROWS), then confirm
     guide  GUIDE door labels (app.guideRow over GUIDE_ROWS), then confirm
     key    a key code pressed on the page reached (STATS: T opens MEDALS)
     wait   "controls": the lazy CONTROLS page must be in (app.controls.loading false) before the frames are stepped
     run    a run screen: play, pause, win or lose
     state  what window.__GAME__.state() must read before the capture; a mismatch is an error and no PNG
     settle virtual ms stepped before the capture (default 600)
     exempt {gate: "reason"}: a REQUIRED gate (tools/ui/lib/gatelib.mjs) this screen has nothing for, each with a one-line reason. DEFAULT-DENY: every
            other REQUIRED gate is in the screen's `need`, so once the page records into the probe, a required gate it does not declare is skipped
            ("required, not declared") and fails --strict. Only this tracked table exempts, in review, when a page task instruments its page;
            the page under test cannot exempt itself. No screen is instrumented yet, so no row exempts anything yet. */
import { REQUIRED } from "./gatelib.mjs";

const ROWS = {
  title: { state: "INTRO", settle: 1200 },
  menu: { state: "MENU", settle: 1200 },
  level: { menu: ["LEVEL SELECT"], state: "LEVEL" },
  options: { menu: ["OPTIONS", "SETTINGS"], state: "SETTINGS" },
  graphics: { menu: ["OPTIONS", "SETTINGS"], opt: ["GRAPHICS"], state: "GRAPHICS" },
  controls: { menu: ["OPTIONS", "SETTINGS"], opt: ["CONTROLS"], wait: "controls", state: "CONTROLS" },
  guide: { menu: ["GUIDE"], state: "GUIDE" },
  howto: { menu: ["GUIDE"], guide: ["HOW TO PLAY"], state: "HOWTO" },
  items: { menu: ["GUIDE"], guide: ["ITEMS", "POWER-UPS"], state: "ITEMS" },
  enemies: { menu: ["GUIDE"], guide: ["ENEMIES"], state: "ENEMIES" },
  floor: { menu: ["GUIDE"], guide: ["FLOOR"], state: "FLOOR" },
  scores: { menu: ["HIGH SCORES", "RECORDS"], state: "SCORES" },
  stats: { menu: ["STATS", "RECORDS"], state: "STATS" },
  medals: { menu: ["STATS", "RECORDS"], key: "KeyT", state: "TROPHIES" },
  play: { run: "play", state: "PLAY", settle: 900 },
  pause: { run: "pause", state: "PAUSE", settle: 300 },
  win: { run: "win", state: "WIN", settle: 1800 },
  lose: { run: "lose", state: "LOSE", settle: 1600 },
};
for (const [n, r] of Object.entries(ROWS)) {
  const ex = r.exempt || {};
  for (const [g, why] of Object.entries(ex)) if (!REQUIRED.includes(g) || typeof why !== "string" || !why.trim()) throw new Error("screens: " + n + " exempts " + g + " without a reason, or it is not a REQUIRED gate");
  r.exempt = Object.freeze({ ...ex });
  r.need = Object.freeze(REQUIRED.filter((g) => !ex[g]));
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
