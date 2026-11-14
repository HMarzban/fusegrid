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
            page (pages/lazy.js) must be in; "level": the lazy LEVEL SELECT page (Task 9.14) must be in
     block  a lazy page's name (pages/lazy.js): its import never lands while the capture is taken (menudraw's ask held, the module out), so the page
            paints THE LOADING plate; put back after it (levelloading)
     pad    a standard controller in slot 0 (shots.mjs PAD: navigator.getGamepads) from the page open to the capture, taken away after it
     ctl    calls on the CONTROLS page reducer (app.controls), in order, after the wait: tab('pad'), walk(1, 1), confirm(0)
     usb    a WebUSB on macOS (shots.mjs USB: navigator.usb and its userAgentData, headless Chrome's own are not relied on) before CONTROLS opens, so
            switch2.js reaches and the CONTROLLER tab draws the CONNECT row (every-controller Task 3); shots.mjs waits for __GAME__.ctl.sw2().shown.
            Once in, the waker stays for the page load: every later CONTROLS capture of the run shows the row too
     run    a run screen: play, pause, win or lose (store: localStorage items set before the run, e.g. a saved best; daily: the run is MENU's DAILY;
            from1: the run starts at level 1 and every room up to --world is cleared through the debug hook, NEXT LEVEL between them, so the
            capture is a from-start run's end, e.g. winrun --world 5: the finale of a run from level 1 with its won course and run tally;
            key: keys sent through input.onUiKey at the run end, e.g. ArrowDown for a paged end's second page)
     tags   (a pause screen) the run's rules seeded through the debug hook before PAUSE: EXPERT, FAST, every modifier, TIME TRIAL (the tag row)
     state  what window.__GAME__.state() must read before the capture; a mismatch is an error and no PNG
     settle virtual ms stepped before the capture (default 600)
     exempt {gate: "reason"} or {gate: {why, when: [{phone?, world?: [n..]}, ..]}}: a scoped exemption holds only on the captures one `when` names
            (phone: the --phone flag; world: the --world numbers), and the gate is required on every other capture of the row (needFor). An
            EXEMPTABLE gate (tools/ui/lib/gatelib.mjs: the ten REQUIRED ones, plus touch and gap for a phone screen with no
            tap targets of its own, the title's tap-anywhere, PLAY's DOM touch strip) this screen has nothing for, each with a one-line reason.
            DEFAULT-DENY: every other EXEMPTABLE gate is in the screen's `need`, so once the page records into the probe, a required gate it does not
            declare is skipped ("required, not declared") and fails --strict. Only this tracked table exempts, in review, when a page task instruments
            its page; the page under test cannot exempt itself. MENU (v202 Task 3.1) is the first instrumented screen, LEVEL SELECT (Task 3.3) the second.
     exemptPhone {gate: "reason"}: more exemptions for the .phone captures only (needPhone), on the same rules (RECORDS, v202 fix round 1: a phone
            capture is tap mode, where the page shows no focus).
     exemptIfNo {gate: {rect: "regex", why: "reason"}}: the gate is exempt on a capture only where the page's probe recorded no rect whose name
            matches (needFor): where the part the gate measures is drawn, the gate is required (RECORDS' filled STATS, locked: a locked level). */
import { EXEMPTABLE } from "./gatelib.mjs";

/* CONTROLS is on the world kit since Task 6.3 (the owner's "I think you forgot to work on the cntroller side ha?" reversed the CONSOLE PANEL ruling): its
   four captures record the probe like every page; they exempt only what a capture has none of */
const CTL_ROW = {
  exemptPhone: { band: "a phone capture is tap mode (the title press a tap, the rest through __GAME__.app): R1 cohesion ruling 5, tap mode shows no focus (no focused row, so no band)" },
  exemptIfNo: {
    ring: { rect: "^ring ", why: "the drawing rings the focused row's button; a capture with none (no controller, SENSITIVITY or RESET focused, tap mode, a drawing that does not fit) has no ring, and where a ring is drawn it is measured" },
    locked: { rect: "^locked ", why: "the locked parts are a FIXED input's wall plaque and the NO CONTROLLER body; a capture that shows neither (a paged phone page without PAUSE, CONFIRM or BACK) has no locked pair" },
  },
};
const ROWS = {
  title: { state: "INTRO", settle: 1200, exempt: { chosen: "the title shows no values: the logo and one prompt", band: "the title has no focus: any key or tap starts", ring: "the title has no focus ring", locked: "the title shows nothing locked", touch: "the title's tap is the whole screen, no target of its own", gap: "the title has no tap targets to space" } },
  menu: { state: "MENU", settle: 1200, exempt: { chosen: "MENU shows no chosen / unchosen values: every row is a door or the PLAY key", locked: "MENU shows no locked value: every row is open" } },
  menupadxbox: { pad: "xbox", padPress: 3, state: "MENU", settle: 1200, exempt: { chosen: "MENU shows no chosen / unchosen values: every row is a door or the PLAY key", locked: "MENU shows no locked value: every row is open" } }, // R-LABELS: an Xbox controller in hand, one press so the hints name it (MENU's foot)
  menupadps: { pad: "ps", padPress: 3, state: "MENU", settle: 1200, exempt: { chosen: "MENU shows no chosen / unchosen values: every row is a door or the PLAY key", locked: "MENU shows no locked value: every row is open" } }, // R-LABELS: a PlayStation controller: its START cap painted as the cross glyph
  level: { menu: ["LEVEL SELECT"], wait: "level", state: "LEVEL", exempt: { ring: "LEVEL SELECT's rows take the band and bomb with no key ring (the d-03 frame's focused LEVEL row); the ring is START's, a door key's or an open list entry's, measured whenever one is focused (the phone's tap mode)", locked: "after the first CLEAR (the world 6-8 captures open rooms 6-8) no level is locked; before it the wall keys record locked pairs, measured when present" } },
  levelloading: { menu: ["LEVEL SELECT"], block: "level", state: "LEVEL", exempt: { chosen: "THE LOADING plate shows no values: a title and one line", band: "the LOADING plate has no focus", ring: "the LOADING plate has no focus ring", locked: "the LOADING plate shows nothing locked", touch: "the LOADING plate has no tap target: a tap on it is inert, off it waits (or backs out once it says DID NOT LOAD)", gap: "the LOADING plate has no tap targets to space", info: "the LOADING plate draws no non-text mark: its title and one line are text (the text gate)", yellow: "the LOADING plate records no fill: no key, no PLAY, nothing yellow" } }, // Task 9.14: LEVEL SELECT while its import has not landed
  options: { menu: ["OPTIONS", "SETTINGS"], state: "SETTINGS", exemptPhone: { band: "a phone capture is tap mode (the title press a tap, the rest through __GAME__.app): R1 cohesion ruling 5, tap mode shows no focus (no focused row, so no band)" }, exempt: { ring: "SETTINGS has no focused key: the focused row wears the band and the bomb", locked: "SETTINGS shows no locked value: CAMERA and BRIGHTNESS are hidden outside REAL 3D, never locked" }, exemptIfNo: { chosen: { rect: "^two-state ", why: "a page that shows no rocker and no meter with an empty cell has no chosen pair (a 667 x 375 phone's first page: MUSIC and SFX, both full)" } } },
  graphics: { menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "ArrowUp", "Enter"], state: "GRAPHICS", exemptPhone: { band: "a phone capture is tap mode (the title press a tap, the rest through __GAME__.app): R1 cohesion ruling 5, tap mode shows no focus (no focused row, so no band)" }, exempt: { ring: "GRAPHICS has no focused key: the focused row wears the band and the bomb", locked: "REAL 3D locks no GRAPHICS row (CLASSIC 2D and PIXEL declare their locked pair and are measured)" }, exemptIfNo: { chosen: { rect: "^two-state ", why: "a GRAPHICS page that shows no two-state part (a landscape phone's paged column, its steppers door rows there, as on a phone) has no chosen pair; where the FPS METER rocker is drawn (the desk included) it is measured (R1 cohesion 12, SETTINGS' rule)" } } }, // ↑ from the top wraps: RESET DEFAULTS, CONTROLS, GRAPHICS (the last three rows in every look)
  controls: { menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "Enter"], wait: "controls", ctl: ["tab('key')"], state: "CONTROLS", ...CTL_ROW },
  controlsnone: { menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "Enter"], wait: "controls", usb: true, ctl: ["tab('pad')"], state: "CONTROLS", ...CTL_ROW },
  controlspad: { menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "Enter"], wait: "controls", usb: true, pad: true, ctl: ["tab('pad')"], state: "CONTROLS", ...CTL_ROW },
  controlscapture: { menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "Enter"], wait: "controls", usb: true, pad: true, ctl: ["tab('pad')", "walk(1, 1)", "confirm(0)"], state: "CONTROLS", ...CTL_ROW },
  controlspadxbox: { pad: "xbox", padPress: 3, menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "Enter"], wait: "controls", usb: true, ctl: ["tab('pad')", "pick(1)"], state: "CONTROLS", ...CTL_ROW }, // R-LABELS: the pad tab with an Xbox controller: A B X Y on the rows, the drawing and the callouts
  controlspadps: { pad: "ps", padPress: 3, menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "Enter"], wait: "controls", usb: true, ctl: ["tab('pad')", "pick(1)"], state: "CONTROLS", ...CTL_ROW }, // R-LABELS: a PlayStation controller: the face glyphs on the keys and the drawing
  controlsconnect: { menu: ["OPTIONS", "SETTINGS"], key: ["ArrowUp", "ArrowUp", "Enter"], wait: "controls", usb: true, ctl: ["tab('pad')", "pick(7)"], state: "CONTROLS", ...CTL_ROW }, // every-controller Task 3: the CONNECT row focused, no controller (its help in the pane's rule on the desk)
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
  play: { run: "play", state: "PLAY", settle: 900, exempt: { chosen: "the HUD shows values, never a chosen / unchosen pair", band: "the HUD has no focus: nothing on it is selectable", ring: "the HUD has no focus ring", locked: "the HUD shows no locked value" } }, // page "hud" (src/render/hud.js, Task 8.2) on #hud
  padtoast: { run: "play", state: "PLAY", settle: 600, exempt: { chosen: "the HUD shows values, never a chosen / unchosen pair", band: "the HUD has no focus: nothing on it is selectable", ring: "the HUD has no focus ring", locked: "the HUD shows no locked value" } }, // a controller plugged in mid-run (owner 2026-11-12): the HUD toast in the tile tip's plate
  hud: { run: "hud", state: "PLAY", settle: 3600, exempt: { chosen: "the HUD shows values, never a chosen / unchosen pair", band: "the HUD has no focus: nothing on it is selectable", ring: "the HUD has no focus ring", locked: "the HUD shows no locked value" } }, // PLAY with every power held and the player on a floor tile, 3.6 s in: the power-ups bar, THROW / REMOTE and the tile tip (round 5 09-hud)
  pause: { run: "pause", state: "PAUSE", settle: 300, exempt: { chosen: "PAUSE shows no chosen / unchosen values: every row is a verb or a door", locked: "PAUSE shows no locked value: every row is open" } },
  pausetags: { run: "pause", tags: true, state: "PAUSE", settle: 300, exempt: { chosen: "PAUSE shows no chosen / unchosen values: every row is a verb or a door", locked: "PAUSE shows no locked value: every row is open" } },
  pausepadxbox: { pad: "xbox", padPress: 3, run: "pause", state: "PAUSE", settle: 300, exempt: { chosen: "PAUSE shows no chosen / unchosen values: every row is a verb or a door", locked: "PAUSE shows no locked value: every row is open" } }, // R-LABELS: PAUSE with an Xbox controller in hand: RESUME's B cap and the foot's A
  pausepadps: { pad: "ps", padPress: 3, run: "pause", state: "PAUSE", settle: 300, exempt: { chosen: "PAUSE shows no chosen / unchosen values: every row is a verb or a door", locked: "PAUSE shows no locked value: every row is open" } }, // R-LABELS: PAUSE with a PlayStation controller: RESUME's circle glyph
  win: { run: "win", state: "WIN", settle: 3400, exempt: {
    chosen: { why: "a level clear (worlds other than 5 and 8) has no course", when: [{ world: [1, 2, 3, 4, 6, 7] }] },
    locked: "no WIN shows a locked level in play: a finale opens 6-8 on its own run-end edge (LEVELS 6 TO 8 NOW OPEN), and a level clear has no course; page-endwin pins the pair where one is drawn" }, exemptIfNo: { info: { rect: "^(up|down|cell \\d)", why: "a level clear that fits one page (a phone's over box since Task 9.8) draws no pager and no course, so no non-text mark; where either is drawn it is measured" }, gap: { rect: "^(up|down|copy|map)$", why: "a level clear that fits one page has one touch target (NEXT LEVEL); where a pager or the copy keys are drawn the gaps are measured" }, chosen: { rect: "^cell \\d", why: "a page that draws no course (a short box's paged run end, its first page) has no course pair; wherever the course is drawn it is measured (a phone's run end draws it on its first page since Task 9.8)" } } },
  winrun: { run: "win", from1: true, state: "WIN", settle: 3400, exempt: {
    chosen: { why: "a level clear (worlds other than 5 and 8) has no course", when: [{ world: [1, 2, 3, 4, 6, 7] }] },
    locked: "no WIN shows a locked level in play: a finale opens 6-8 on its own run-end edge, and a level clear has no course" }, exemptIfNo: { info: { rect: "^(up|down|cell \\d)", why: "a level clear that fits one page (a phone's over box since Task 9.8) draws no pager and no course, so no non-text mark; where either is drawn it is measured" }, gap: { rect: "^(up|down|copy|map)$", why: "a level clear that fits one page has one touch target (NEXT LEVEL); where a pager or the copy keys are drawn the gaps are measured" }, chosen: { rect: "^cell \\d", why: "a page that draws no course (a short box's paged run end, its first page) has no course pair; wherever the course is drawn it is measured (a phone's run end draws it on its first page since Task 9.8)" } } }, // O2: the from-start finale (levels 1-4 won on the course), as the E7 frame
  win2: { run: "win", key: "ArrowDown", state: "WIN", settle: 3400, exempt: {
    chosen: { why: "a level clear (worlds other than 5 and 8) has no course", when: [{ world: [1, 2, 3, 4, 6, 7] }] },
    locked: "no WIN shows a locked level in play: a finale opens 6-8 on its own run-end edge, and a level clear has no course" }, exemptIfNo: { info: { rect: "^(up|down|cell \\d)", why: "a level clear that fits one page (a phone's over box since Task 9.8) draws no pager and no course, so no non-text mark; where either is drawn it is measured" }, gap: { rect: "^(up|down|copy|map)$", why: "a level clear that fits one page has one touch target (NEXT LEVEL); where a pager or the copy keys are drawn the gaps are measured" }, chosen: { rect: "^cell \\d", why: "a finale that fits one page keeps its course on page 1 (\u2193 keeps page 1): wherever the course is drawn it is measured" } } }, // a paged run end's second page (a short box: the phone, a small window)
  lose: { run: "lose", state: "LOSE", settle: 1600, exempt: {
    info: { why: "a desk death on levels 6-8 (open) shows no finale flag ahead and no pager; the other worlds, and every phone page (its pager), record one", when: [{ world: [6, 7, 8], phone: false }] },
    chosen: { why: "a death on levels 6-8 (open) leaves no reached-not level beside a cleared one", when: [{ world: [6, 7, 8] }] },
    locked: { why: "levels 6-8 open (world 6-8 captures) show no locked level", when: [{ world: [6, 7, 8] }] } }, exemptIfNo: { chosen: { rect: "^cell \\d", why: "a page that draws no course (a short box's paged run end, its first page) has no course pair; wherever the course is drawn it is measured (a phone's run end draws it on its first page since Task 9.8)" }, locked: { rect: "^cell \\d locked$", why: "a page that draws no locked level has no locked pair: levels 6-8 open (a world 6-8 capture, or a run that opened them), or a short box's paged run end whose first page draws no course" } } },
  loseshort: { run: "lose", store: { "nb.bests.v1": '{"b":{"0:0:1":{"s":5000,"r":5}}}' }, state: "LOSE", settle: 1600, exempt: {
    info: { why: "a desk death on levels 6-8 (open) shows no finale flag ahead and no pager", when: [{ world: [6, 7, 8], phone: false }] },
    chosen: { why: "a death on levels 6-8 leaves no reached-not level", when: [{ world: [6, 7, 8] }] },
    locked: { why: "levels 6-8 open show no locked level", when: [{ world: [6, 7, 8] }] } }, exemptIfNo: { chosen: { rect: "^cell \\d", why: "a page that draws no course (a short box's paged run end, its first page) has no course pair; wherever the course is drawn it is measured (a phone's run end draws it on its first page since Task 9.8)" }, locked: { rect: "^cell \\d locked$", why: "a page that draws no locked level has no locked pair: levels 6-8 open (a world 6-8 capture, or a run that opened them), or a short box's paged run end whose first page draws no course" } } }, // a saved best over the run's score: the shortfall line
  losedaily: { run: "lose", daily: true, state: "LOSE", settle: 1600, exemptIfNo: { chosen: { rect: "^cell \\d", why: "a page that draws no course (a short box's paged run end, its first page) has no course pair; wherever the course is drawn it is measured (a phone's run end draws it on its first page since Task 9.8)" }, locked: { rect: "^cell \\d locked$", why: "a page that draws no locked level has no locked pair: levels 6-8 open (a world 6-8 capture, or a run that opened them), or a short box's paged run end whose first page draws no course" } } }, // today's DAILY (level 1, JUNGLE, whatever --world): Same board and the day's line
  lose2: { run: "lose", key: "ArrowDown", state: "LOSE", settle: 1600, exempt: {
    chosen: { why: "a death on levels 6-8 (open) leaves no reached-not level beside a cleared one", when: [{ world: [6, 7, 8] }] },
    locked: { why: "levels 6-8 open show no locked level", when: [{ world: [6, 7, 8] }] } }, exemptIfNo: { locked: { rect: "^cell \\d locked$", why: "a page that draws no locked level has no locked pair: levels 6-8 open (a world 6-8 capture, or a run that opened them)" } } }, // a paged GAME OVER's second page (a short box); where GAME OVER fits one page (a phone's over box since Task 9.8) ↓ keeps page 1, its course
};
/* a row's need from its exemptions: EXEMPTABLE minus each exempt gate, which must be EXEMPTABLE and carry a non-empty reason */
export const whyOf = (v) => (typeof v === "string" ? v : v && typeof v.why === "string" ? v.why : "");
const scoped = (v) => v && typeof v === "object" && Array.isArray(v.when);
export function needOf(name, exempt = {}) {
  for (const [g, v] of Object.entries(exempt)) {
    if (!EXEMPTABLE.includes(g) || !whyOf(v).trim()) throw new Error("screens: " + name + " exempts " + g + " without a reason, or it is not an EXEMPTABLE gate");
    if (typeof v !== "string" && !(scoped(v) && v.when.length && v.when.every((c) => c && (c.phone != null || Array.isArray(c.world))))) throw new Error("screens: " + name + " scopes " + g + " without a when");
  }
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
/* a capture's need: its row's (needPhone on a .phone capture), with each scoped exemption whose `when` misses it, less each exemptIfNo gate whose part the probe did not record */
export function needFor(row, d) {
  const flags = (d && d.flags) || {}, hit = (c) => (c.phone == null || !!flags.phone === c.phone) && (!Array.isArray(c.world) || c.world.includes(flags.world | 0));
  let need = flags.phone ? row.needPhone : row.need;
  /* a scoped exemption (exempt {gate: {why, when}}) counts only where one of its `when`s matches the capture's flags (phone, world) */
  const back = EXEMPTABLE.filter((g) => { const v = row.exempt && row.exempt[g]; return scoped(v) && !v.when.some(hit) && !(flags.phone && row.exemptPhone && row.exemptPhone[g]); });
  if (back.length) need = EXEMPTABLE.filter((g) => need.includes(g) || back.includes(g));
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
