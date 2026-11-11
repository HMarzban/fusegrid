// APP SHELL STATE MACHINE — pure logic, no canvas/DOM. Owns BOOT->INTRO(title->show)->MENU
// <-> subscreens -> GAME routing outside the sim (spec §1). The sim's world is
// untouched; nothing here is ever read by step().
//
// update(dt, input) input contract: { input:{up,down,left,right},  // held axes,
//   live via Input's public getter; confirmHeld:boolean,            // held fire
//   anyDown?:boolean }   // any key or pad button down: the CONTROLS capture's arm clock
// Confirm/repeat edges are computed here: rising-edge only, repeats 350ms then
// 110ms. key(code) is the discrete side-channel (Enter/Esc/Backspace/M +
// arrows/WASD as taps); taps are handed to update() via a per-frame consume map
// so wiring BOTH channels never double-moves.
import { roomCap, ROOM_MAX } from "../core/config.js";
import { clampHeat } from "../core/heat.js";
import { clampPact, PACT, togglePact } from "../core/pact.js";
import { clampPace } from "../core/pace.js";
import { FOES } from "../core/entities.js";
import { clampSettings, DEFAULTS } from "./settings.js";
import { RENDER_KINDS, renderBits, renderVal } from "./renderkind.js";
import { LOOK_LABEL } from "./jobs.js";
import { SHOW_DUR, SKIP_GUARD, TITLE_IN } from "./intro.js";
import { GFX_ROWS, GFX_KEYS, VALUES, PRESET_NAMES, DEMO_T, presetOf, applyPreset, locked, gfxView } from "./gfx.js";
export const SCREEN = Object.freeze({
  BOOT: 0,
  INTRO: 1,
  MENU: 2,
  LEVEL: 3,
  HOWTO: 4,
  SCORES: 5,
  GAME: 6,
  ATTRACT: 7,
  ITEMS: 8,
  ENEMIES: 9,
  SETTINGS: 10, // appended — inserting shifts every frozen value after it
  GUIDE: 11, // appended — folds HOW TO PLAY/ITEMS/ENEMIES one hop deeper
  STATS: 12, // appended — the opt-in cabinet counters (R5)
  TROPHIES: 13, // appended — the MEDALS page, opened from STATS by T (R6)
  GRAPHICS: 14, // appended — the GRAPHICS page, opened from the SETTINGS door row
  FLOOR: 15, // appended — the floor-tile page, the fourth GUIDE door
  CONTROLS: 16, // appended — the CONTROLS page, opened from the SETTINGS door row
});
/* Menu feels by rank, highest first (controlswire.js plays them on a pad). */
export const FEELS = Object.freeze(["launch", "enter", "deny", "back", "confirm", "move"]);
export const ITEMS = Object.freeze([
  "PLAY",
  "LEVEL SELECT",
  "DAILY",
  "RECORDS",
  "SETTINGS",
  "GUIDE",
  "SOURCE",
]);
/* RECORDS is no SCREEN of its own: the three pages its row opens, in tab order (words.js RECORD_TABS
   SCORES · STATS · MEDALS). The tab strip is the top row of each page's ↑↓ walk (recFocus 0); the body under it is
   recFocus 1 where the page has one (SCORES' difficulty filter, STATS' foot actions; MEDALS has none). */
export const RECORD_SCREENS = Object.freeze([SCREEN.SCORES, SCREEN.STATS, SCREEN.TROPHIES]);
/** One of RECORDS' three pages. */
export const isRecords = (s) => RECORD_SCREENS.indexOf(s) >= 0;
/* LEVEL SELECT rows (v202 Task 2.3; design record §4, "LEVEL SELECT: one path"), frozen and index-addressed: levelRow and
   menudraw's levelGeom rows count this array. ↑↓ walk them (MODIFIERS only once modifiers are offered, the first CLEAR), ←→
   change the focused one, confirm starts the run; on MODIFIERS it opens the inline list (app.modOpen, modeCur its cursor:
   the four modifier bits, then TIME TRIAL, the Digit1-5 order). No SCREEN. */
export const LEVEL_ROWS = Object.freeze(["LEVEL", "DIFFICULTY", "GAME SPEED", "MODIFIERS", "START"]);
const LV_MODS = LEVEL_ROWS.indexOf("MODIFIERS"),
  LV_START = LEVEL_ROWS.indexOf("START"),
  MODS_N = 5;
/* GUIDE rows, frozen and index-addressed: guideRow, drawGuide and confirm's
   GUIDE dispatch all count this array. */
export const GUIDE_ROWS = Object.freeze(["HOW TO PLAY", "POWER-UPS", "ENEMIES", "FLOOR"]);
/* SETTINGS rows (design record §4, plan R11). OPT_ROWS is every row in order; the rows on screen are optRows(r3d): all twelve
   while ART STYLE is REAL 3D, the ten without CAMERA and BRIGHTNESS otherwise. optRow indexes that visible list, the one list
   shellview hands drawSettings (as labels) and settingsHit maps a tap into, so every reader acts by the label drawn there. */
export const OPT_ROWS = Object.freeze([
  "MUSIC",
  "SFX",
  "SOUND",
  "ART STYLE",
  "CAMERA",
  "BRIGHTNESS",
  "SCREEN SHAKE",
  "REDUCE FLASH",
  "ANALYTICS",
  "GRAPHICS",
  "CONTROLS",
  "RESET DEFAULTS",
]);
const OPT_3D = Object.freeze(["CAMERA", "BRIGHTNESS"]),
  OPT_FLAT = Object.freeze(OPT_ROWS.filter((r) => OPT_3D.indexOf(r) < 0));
/** The SETTINGS rows on screen, in OPT_ROWS order: all twelve when r3d (ART STYLE is REAL 3D), else the ten without CAMERA and BRIGHTNESS. */
export const optRows = (r3d) => (r3d ? OPT_ROWS : OPT_FLAT);
/* PAUSE list (spec §3). world.state stays PAUSE and the shell stays GAME —
   that is what keeps the room's track playing, the HUD gate open, the touch
   gate honest and every screen===GAME guard true. */
export const PAUSE_ITEMS = Object.freeze([ // design record §4: RESUME, SETTINGS, then (past the divider) the two danger rows; read by label
  "RESUME",
  "SETTINGS",
  "RESTART",
  "QUIT TO MENU",
]);
export const SOURCE_URL = "https://github.com/HMarzban/fusegrid";
const REP_FIRST = 0.35,
  REP_NEXT = 0.11;
export const IDLE_T = 10; // MENU idle seconds before ATTRACT takes over
export const WARM_T = 0.4; // s on the ART STYLE row before the next look warms
const DEF_MOVE = Object.freeze(["KeyW", "KeyD", "KeyS", "KeyA"]); // UP RIGHT DOWN LEFT; no controls.js import, it is not in this file's boot graph
const ANA_NOTE = "ANSWER THE CARD WITH Y OR N";

export function createMenuApp(opts = {}) {
  const o = opts || {};
  const audio = o.audio || null;
  const onStart = o.onStart || null;
  const onSource = o.onSource || null;
  const onStats = o.onStats || null;
  const onMedals = o.onMedals || null; // the MEDALS page's rows, read on every arrival; never the STATS opt-in (a tap may skip STATS)
  const onSettings = o.onSettings || null;
  const onPauseCmd = o.onPauseCmd || null;
  const onWarm = o.onWarm || null;
  const app = {
    screen: o.autoplay ? SCREEN.GAME : SCREEN.INTRO,
    cursor: 0,
    level: Math.min(roomCap(o.pactUnlocked), Math.max(1, o.level | 0 || 1)),
    heat: clampHeat(o.heat),
    scoreHeat: 0,
    settings: clampSettings(o.settings),
    analytics: !!o.analytics, // SETTINGS ANALYTICS: its truth lives in nb.analytics.v1 (src/app/analytics.js), like SOUND's in audio
    optRow: 0, // SETTINGS row cursor, an index into optRows() — its OWN field, so the MENU cursor
    // survives a round trip through the page
    guideRow: 0, // GUIDE row cursor — its OWN field too, same reason
    foeRow: 0, // ENEMIES: the focused foe (core FOES order); every arrival lands on the first
    foeTip: false, // ENEMIES: its points tooltip is open (on keys it follows focus, arrival included; a pad move closes it; Enter / SOUTH or a tap opens it; Esc / Backspace / EAST close it before leaving)
    infoPg: 0, // HOW TO PLAY, POWER-UPS, FLOOR: the page shown where the box pages them (opts.pageCount); every arrival lands on the first
    recFocus: 0, // RECORDS: 0 the tab row, 1 the page body; every arrival lands on the tab row
    levelRow: 0, // LEVEL SELECT's focused row (LEVEL_ROWS); every entry lands on LEVEL
    modOpen: false, // LEVEL SELECT's MODIFIERS list is open inline, modeCur its cursor
    pauseCursor: 0,
    pauseView: 0, // 0 list / 1 inline SETTINGS / 2 inline GRAPHICS / 3 inline CONTROLS; reset on the PLAY->PAUSE edge
    controls: o.controls || null, // the CONTROLS page (controlspage.js); null = the door is inert
    ctlT: 0, // ms, summed from update()'s dt: the ONE clock the page's tick, confirm and feeds share
    feel: "", // the one menu feel the last presses asked for, highest FEELS rank kept; controlswire arms it before a pad poll routes and reads it after
    lastDev: "key", // raw last-used device "key" | "pad" | "touch", no dwell: opens the page's tab and gates the consent row
    padNote: "", // CONTROLLER LOST / BACK / READY, written by the controls seam
    padCards: [], // the cards a pad may answer, {live, press}: never the consent card (padroute.js)
    modeCur: -1, // LEVEL SELECT's MODIFIERS chip in focus: the open list's cursor, or a pad's TRIGGER cursor; -1 = none. Shell-only, never reaches a run
    _anaSaid: false,
    gfxRow: 0, // GRAPHICS row cursor — its own field, like guideRow
    gfxChg: 0, // GRAPHICS rows (bitmask) the last accepted change touched: the togT glow lights them all
    gfx: null, // live frame info {fps,hz,kind,dpr3d,dprPx,liveAA,pendingAA,limit,gov}, written by main's frame loop
    attractT: 0, // seconds in this ATTRACT visit (DEMO SHORT ends it at DEMO_T)
    parked: false, // DEMO SHORT ended ATTRACT: MENU stops counting idle until the next input
    pact: clampPact(o.pact),
    pace: clampPace(o.pace),
    dailyTag: o.dailyTag || "NEW",
    timeAttack: !!o.timeAttack,
    pactUnlocked: !!o.pactUnlocked,
    sound: o.sound !== false,
    render3d: !!o.render3d,
    pixel: !!o.pixel && !o.render3d,
    cabinetSeen: !!o.cabinetSeen,
    resetArm: false,
    inGame: !!o.autoplay,
    subT: 0,
    repT: 0,
    repDir: 0,
    repAxis: 0,
    prevConfirm: false,
    idleT: 0,
    togT: -1, // SETTINGS knob-flash timestamp (§2): subT at the last accepted
    // change, -1 sentinel otherwise; cleared wherever subT resets
    worldState: null,
    _taps: {},
    /* Opening (spec 2026-10-09): INTRO is two phases. introStage 0 = title,
       1 = show; pressT = the title subT at the press (the show starts from that
       pose); boardReady/readyT are set by main (3D waits on three); showBoom is
       set by stepShow on the show bomb's boom; fromShow turns on MENU's slam. */
    introStage: 0,
    pressT: 0,
    fromShow: false,
    boardReady: true,
    readyT: 0,
    warmT: 0, _warmA: null, _warmK: null, // v202 warm on intent: the rest on the ART STYLE row
    lookJob: null, // v202: the ART STYLE row's look job, set by main from rcache: {k, state "loading"|"preparing"|"ready"|"failed", phase, done, total, f, ind, fails} or null
    _showPending: false,
    showBoom: false,
    /* Advance the shell by dt seconds. Reads held axes + confirmHeld only. */
    update(dt, input) {
      if (this.screen !== SCREEN.MENU) this.fromShow = false; // startRun/_toMenuInner/enterAttract bypass _push
      const d = Math.max(0, dt || 0);
      const ch = !!(input && input.confirmHeld);
      let rising = ch && !this.prevConfirm;
      this.prevConfirm = ch;
      this.subT += d;
      this.ctlT += d * 1000;
      this._warmTick(d);
      if (this.boardReady) this.readyT += d;
      if (this.onControls()) {
        const h = (input && input.input) || {};
        this.controls.tick(this.ctlT, !!((input && input.anyDown) || ch || h.up || h.down || h.left || h.right));
        if (this.capturing) {
          this._repeat(d, 0, 0);
          this._taps = {};
          return;
        }
      }
      if (this.screen === SCREEN.GAME) {
        if (this.worldState === "PAUSE") {
          const ax = (input && input.input) || {};
          let dir = 0,
            axis = 1;
          if (this.pauseView >= 1 && (ax.left || ax.right)) {
            dir = ax.left ? -1 : 1;
            axis = 0;
          } else dir = ax.up ? -1 : ax.down ? 1 : 0;
          this._repeat(d, dir, axis);
          if (rising) this.confirm();
          this._taps = {};
          return;
        }
        this.repT = 0;
        this.repDir = 0;
        this._hot = false;
        this._taps = {};
        return;
      }
      if (this.screen === SCREEN.ATTRACT) { // subT already advanced -> hint blink
        this.attractT += d;
        if (this.settings.dmo === 1 && this.attractT >= DEMO_T && this.exitAttract()) this.parked = true;
        return;
      }
      if (this.screen === SCREEN.INTRO) {
        if (this._showPending && this.boardReady) this._show();
        // a title waiting on the board (3D loading) stands settled, so a load
        // stall never freezes a half-revealed logo (eye-check 2026-10-09)
        if (this.introStage === 0 && !this.boardReady) this.subT = Math.max(this.subT, TITLE_IN);
        /* The boom (not the clock) ends the show; +1 s is the safety net. It
           runs before the axis read so an arrow held since the press keeps
           the landing frame on PLAY (the _skipKey taps latch). */
        const end = this.introStage === 1 && (this.showBoom || this.subT >= SHOW_DUR + 1);
        if (end || rising) this._skipKey(end);
        if (end && this.screen === SCREEN.MENU) this.fromShow = true;
        if (this.screen === SCREEN.INTRO) return void (this._taps = {});
        rising = false; // the edge that skipped is spent
      }
      const ax = (input && input.input) || {};
      let dir = 0,
        axis = 0;
      if (this.screen === SCREEN.MENU || this.screen === SCREEN.GUIDE || this.screen === SCREEN.ENEMIES || this._isInfo()) {
        const g = this.screen !== SCREEN.MENU; // GUIDE's doors and ENEMIES' foes sit side by side: ←/→ walk them too (a read-only page's pages too)
        dir = ax.up || (g && ax.left) ? -1 : ax.down || (g && ax.right) ? 1 : 0;
      }
      else if (this.screen === SCREEN.LEVEL || this.screen === SCREEN.SETTINGS || this.screen === SCREEN.GRAPHICS || this.screen === SCREEN.CONTROLS) {
        if (ax.left || ax.right) {
          dir = ax.left ? -1 : 1;
          axis = 0;
        } else if (ax.up || ax.down) {
          dir = ax.up ? -1 : 1;
          axis = 1;
        }
      }
      else if (isRecords(this.screen)) { // a held ←/→ repeats only on the tab row: the SCORES body filter steps per press, as before
        if ((ax.left || ax.right) && !this.recFocus) dir = ax.left ? -1 : 1;
        else if (ax.up || ax.down) {
          dir = ax.up ? -1 : 1;
          axis = 1;
        }
      }
      this._repeat(d, dir, axis);
      if (rising) this.confirm();
      this._taps = {};
      if (this.screen === SCREEN.MENU && !this.parked && this.settings.dmo !== 0) {
        this.idleT += d;
        if (this.idleT >= IDLE_T && (!o.canAttract || o.canAttract())) this.enterAttract(); // MENU waits for the lazy bot (main's attract.js demoReady)
      } else this.idleT = 0;
    },
    /* Shared hold-to-repeat: first move at REP_FIRST, then REP_NEXT. The
       _taps map is how key()'s discrete channel and this held-axis channel
       avoid double-moving on the same frame. */
    _repeat(d, dir, axis) {
      if (dir) {
        if (this.repDir !== dir || this.repAxis !== axis) {
          this.repDir = dir;
          this.repAxis = axis;
          this.repT = 0;
          this._hot = false;
          if (!this._taps[dir + ":" + axis]) this.move(dir, axis);
        } else {
          this.repT += d;
          let g = 0;
          while (g++ < 64) {
            const thr = this._hot ? REP_NEXT : REP_FIRST;
            if (this.repT < thr) break;
            this._repHeld = true; // main's cue wrapper passes only (dir, axis); a held ←→ may not turn a tab change into a value step
            this.move(dir, axis);
            this._repHeld = false;
            this.repT -= thr;
            this._hot = true;
          }
        }
      } else {
        this.repDir = 0;
        this.repAxis = 0;
        this.repT = 0;
        this._hot = false;
        this._lockHeld = false; // released: the next press may flash LEVEL SELECT's lock again
      }
    },
    /* Discrete key tap (Enter/Esc/Backspace/M + arrows-as-tap fallback). */
    key(code) {
      if (this.capturing) return false; // the capture owns the key (controlspage.js)
      if (this.screen === SCREEN.ATTRACT) {
        if (code === "Escape" || code === "Backspace") return this.exitAttract();
        return this.playFromAttract();
      }
      if (this.screen === SCREEN.INTRO) return this._skipKey(); // title: no-op; show: "ANY KEY TO SKIP"
      this.idleT = 0;
      this.parked = false;
      const mi = this.moveKeys.indexOf(code); // UP RIGHT DOWN LEFT, live binds; ARROWS always work
      if (mi >= 0) return this._tapMove(mi === 1 || mi === 2 ? 1 : -1, mi === 1 || mi === 3);
      switch (code) {
        case "Enter":
        case "NumpadEnter":
          return this.confirm();
        case "Escape":
        case "Backspace":
          if (this.screen === SCREEN.GAME) return false;
          return this.back();
        case "KeyM":
          return this.quitToMenu(this.worldState);
        case "ArrowUp":
          return this._tapMove(-1, false);
        case "ArrowDown":
          return this._tapMove(1, false);
        case "ArrowLeft":
          return this._tapMove(-1, true);
        case "ArrowRight":
          return this._tapMove(1, true);
        case "Digit1":
        case "Numpad1":
          return this.togglePactBit(PACT.LAST);
        case "Digit2":
        case "Numpad2":
          return this.togglePactBit(PACT.BARE);
        case "Digit3":
        case "Numpad3":
          return this.togglePactBit(PACT.THIN);
        case "Digit4":
        case "Numpad4":
          return this.togglePactBit(PACT.SHRINK);
        case "Digit5":
        case "Numpad5":
          return this.toggleTimeAttack();
        case "BracketLeft":
          return this.onControls() ? this.controls.tab("key") : this.adjustPace(-1);
        case "BracketRight":
          return this.onControls() ? this.controls.tab("pad") : this.adjustPace(1);
        case "KeyQ": // RECORDS' tab keys from anywhere on its pages (keyboard only; off them recTab is false)
        case "KeyE":
          if (isRecords(this.screen)) this.prevConfirm = true; // one press, one action: a Q / E that is also the rebound confirm (BOMB) only steps the tab here
          return this.recTab(code === "KeyQ" ? -1 : 1);
        case "KeyT": // STATS' T MEDALS: the MEDALS tab
          return this.screen === SCREEN.STATS ? this.recTab(1) : false;
        case "KeyR":
          if (this.screen !== SCREEN.STATS) return false;
          if (this.resetArm) { this.resetArm = false; if (o.onReset) o.onReset(); return true; }
          this.resetArm = true;
          return true;
      }
      return false;
    },
    /* A key spent skipping INTRO is spent: its held axis or fire must not also
       move or confirm on the screen it lands on (taps + prevConfirm are the
       same guards key() and a held confirm already use). Gated unless the
       show ended on its own: the title ignores it (armUnlock starts the
       show), and so does the show's guard. */
    _skipKey(ended) {
      this.prevConfirm = true;
      const r = ended ? this.skip() : this.skipShow();
      this._taps = { "-1:0": true, "1:0": true, "-1:1": true, "1:1": true };
      return r;
    },
    _tapMove(dir, lat) {
      this.idleT = 0;
      this.parked = false;
      if (
        this.screen === SCREEN.GAME &&
        this.worldState === "PAUSE" &&
        this.move(dir, lat ? 0 : 1)
      ) {
        this._taps[dir + ":" + (lat ? 0 : 1)] = true;
        return true;
      }
      if (this.screen === SCREEN.MENU && !lat && this.move(dir, 0)) {
        this._taps[dir + ":0"] = true;
        return true;
      }
      if ((this.screen === SCREEN.GUIDE || this.screen === SCREEN.ENEMIES || this._isInfo()) && this.move(dir, 0)) {
        this._taps[dir + ":0"] = true;
        return true;
      }
      if (this.screen === SCREEN.LEVEL && this.move(dir, lat ? 0 : 1)) {
        this._taps[dir + ":" + (lat ? 0 : 1)] = true;
        return true;
      }
      if ((this.screen === SCREEN.SETTINGS || this.screen === SCREEN.GRAPHICS || this.screen === SCREEN.CONTROLS) && this.move(dir, lat ? 0 : 1)) {
        this._taps[dir + ":" + (lat ? 0 : 1)] = true;
        return true;
      }
      if (isRecords(this.screen) && this.move(dir, lat ? 0 : 1)) {
        this._taps[dir + ":" + (lat ? 0 : 1)] = true;
        return true;
      }
      return false;
    },
    confirm() {
      if (this.capturing) return false;
      if (this.screen === SCREEN.ATTRACT) return this.playFromAttract();
      this.idleT = 0;
      this.parked = false;
      switch (this.screen) {
        case SCREEN.INTRO:
          return this.skipShow();
        case SCREEN.GAME:
          return this.worldState === "PAUSE" ? this.confirmPause() : false;
        case SCREEN.MENU: {
          switch (ITEMS[this.cursor]) {
            case "PLAY":
              return this.startRun();
            case "LEVEL SELECT":
              this.modeCur = -1;
              this.levelRow = 0;
              this.modOpen = false;
              this._lockHeld = false;
              return this._push(SCREEN.LEVEL);
            case "DAILY":
              return this.startDaily();
            case "SETTINGS":
              this.optRow = 0; // the top row of either list (MUSIC)
              return this._push(SCREEN.SETTINGS);
            case "GUIDE":
              this.guideRow = 0;
              return this._push(SCREEN.GUIDE);
            case "RECORDS":
              this.recFocus = 0;
              return this._push(SCREEN.SCORES);
            case "SOURCE":
              if (onSource) onSource();
              return this._feel("confirm");
          }
          return false;
        }
        case SCREEN.LEVEL:
          return this._levelConfirm();
        case SCREEN.SETTINGS:
          return this._conf(this.optCycle());
        case SCREEN.GRAPHICS:
          return this._conf(this.gfxCycle());
        case SCREEN.CONTROLS:
          return this.controls ? this.controls.confirm(this.ctlT) : false;
        case SCREEN.GUIDE:
          switch (GUIDE_ROWS[this.guideRow]) {
            case "HOW TO PLAY":
              this.infoPg = 0;
              return this._push(SCREEN.HOWTO);
            case "POWER-UPS":
              this.infoPg = 0;
              return this._push(SCREEN.ITEMS);
            case "ENEMIES":
              this.foeRow = 0;
              this.foeTip = this.lastDev === "key"; // on keys the tooltip follows focus from the first foe (ruling R3)
              return this._push(SCREEN.ENEMIES);
            case "FLOOR":
              this.infoPg = 0;
              return this._push(SCREEN.FLOOR);
          }
          return false;
        case SCREEN.ENEMIES: // Enter / SOUTH opens the focused foe's points tooltip; Esc / EAST leaves (back)
          if (this.foeTip) return false;
          this.foeTip = true;
          return this._feel("confirm");
        case SCREEN.HOWTO:
        case SCREEN.SCORES:
        case SCREEN.ITEMS:
        case SCREEN.FLOOR:
        case SCREEN.STATS:
        case SCREEN.TROPHIES:
          return this.back();
      }
      return false;
    },
    back() {
      this.parked = false;
      if (this.screen === SCREEN.CONTROLS) {
        if (this.controls && this.controls.back() !== "page") return true; // a capture or an armed reset ends first
        this._optTo("CONTROLS");
        return this._push(SCREEN.SETTINGS, 1);
      }
      if (this.screen === SCREEN.GRAPHICS) {
        this._optTo("GRAPHICS");
        return this._push(SCREEN.SETTINGS, 1);
      }
      if (this.screen === SCREEN.ENEMIES && this.foeTip) { // Esc / Backspace / EAST close an open tooltip first; a second leaves
        this.foeTip = false;
        return this._feel("back");
      }
      if (
        this.screen === SCREEN.HOWTO ||
        this.screen === SCREEN.ITEMS ||
        this.screen === SCREEN.ENEMIES ||
        this.screen === SCREEN.FLOOR
      )
        return this._push(SCREEN.GUIDE, 1);
      if (isRecords(this.screen)) { // any tab, tab row or body: MENU on RECORDS
        this.cursor = ITEMS.indexOf("RECORDS");
        return this._push(SCREEN.MENU, 1);
      }
      if (this.screen === SCREEN.LEVEL && this.modOpen) { // the open list closes first, onto its MODIFIERS row
        this._modClose();
        return this._feel("back");
      }
      if (
        this.screen === SCREEN.LEVEL ||
        this.screen === SCREEN.SETTINGS ||
        this.screen === SCREEN.GUIDE
      )
        return this._push(SCREEN.MENU, 1);
      return false;
    },
    /* Direct programmatic jump from either stage (tests, debughook). Never
       gated: every GESTURE goes through skipShow() instead. */
    skip() {
      return this.screen === SCREEN.INTRO ? this.bootFromIntro() : false;
    },
    /* Gesture skip: a no-op on the title and inside the show's SKIP_GUARD, so
       the press that starts the show never also skips it. A show pending on
       the 3D board skips once past the guard from that press: a hung three
       fetch can never hold a music-playing title. */
    skipShow() {
      if (this.screen !== SCREEN.INTRO) return false;
      if (this._showPending) return this.subT - this.pressT >= SKIP_GUARD ? this.skip() : false;
      return this.introStage === 1 && this.subT >= SKIP_GUARD ? this.skip() : false;
    },
    /* The title's press (main's armUnlock onReady). Sets prevConfirm so a held
       Space makes no rising edge. A board still loading (3D) only marks the
       show pending; update() begins it on the first ready frame. */
    beginShow() {
      if (this.screen !== SCREEN.INTRO || this.introStage !== 0 || this._showPending) return false;
      this.pressT = this.subT;
      this.prevConfirm = true;
      if (!this.boardReady) return (this._showPending = true);
      return this._show();
    },
    _show() {
      this._showPending = false;
      this.introStage = 1;
      this.pressT = this.subT; // re-captured: the show starts from the title pose it leaves
      this.subT = 0;
      this.showBoom = false;
      return true;
    },
    /* Every visit, the first included, lands on MENU with PLAY highlighted
       (ruling 2026-10-09, user pick "Show, then menu": reverses plan 7 / R4's
       first-visit Play Now). nb.cabinet.v1 is still written on the first
       exit and no longer branches anything. */
    bootFromIntro() {
      if (this.screen !== SCREEN.INTRO) return false;
      if (!this.cabinetSeen) {
        this.cabinetSeen = true;
        if (o.markCabinet) o.markCabinet();
      }
      this._showPending = false;
      this.cursor = 0;
      return this._push(SCREEN.MENU);
    },
    /* A step on a value row (SETTINGS, GRAPHICS, a CONTROLS value) is a write: confirm; any other accepted step is move. */
    move(dir, axis) {
      const g = this.screen === SCREEN.GAME, adj = (axis | 0) === 0 && (this.ctlAdjusts(0) || this.screen === SCREEN.SETTINGS || this.screen === SCREEN.GRAPHICS || (g && (this.pauseView === 1 || this.pauseView === 2)));
      return adj ? this._conf(this._move(dir, axis)) : this._move(dir, axis) && this._feel("move");
    },
    _move(dir, axis) {
      if (this.capturing) return false;
      this.idleT = 0;
      this.parked = false;
      if (this.screen === SCREEN.CONTROLS) return this.controls ? this.controls.walk(dir, axis | 0, !!this._repHeld) : false;
      if (this.screen === SCREEN.GAME) {
        if (this.worldState !== "PAUSE") return false;
        if (this.pauseView === 3) return this.controls ? this.controls.walk(dir, axis | 0, !!this._repHeld) : false;
        if (this.pauseView === 2)
          return (axis | 0) === 1 ? this.gfxMove(dir) : this.gfxAdjust(dir);
        if (this.pauseView === 1)
          return (axis | 0) === 1 ? this.optMove(dir) : this.optAdjust(dir);
        if ((axis | 0) !== 1) return false;
        const n = PAUSE_ITEMS.length;
        this.pauseCursor = (this.pauseCursor + (dir < 0 ? -1 : 1) + n) % n;
        return true;
      }
      if (this.screen === SCREEN.MENU) {
        this.cursor = (this.cursor + dir + ITEMS.length) % ITEMS.length;
        return true;
      }
      if (this.screen === SCREEN.GUIDE) {
        this.guideRow =
          (this.guideRow + dir + GUIDE_ROWS.length) % GUIDE_ROWS.length;
        return true;
      }
      if (this.screen === SCREEN.ENEMIES) { // one walk over the foes in order, wrapping; the tooltip follows a key's focus, a pad's move closes it
        this.foeRow = (this.foeRow + (dir < 0 ? -1 : 1) + FOES.length) % FOES.length;
        this.foeTip = this.lastDev === "key";
        return true;
      }
      if (this._isInfo()) { // a read-only page steps its pages, clamped (never wraps), where the box pages it
        const n = Math.max(1, (o.pageCount ? o.pageCount() : 1) | 0), p = Math.max(0, Math.min(n - 1, this.infoPg + (dir < 0 ? -1 : 1)));
        if (p === this.infoPg) return false;
        this.infoPg = p;
        return true;
      }
      if (this.screen === SCREEN.LEVEL) {
        if ((axis | 0) === 1) return this.modOpen ? this._modStep(dir) : this._rowStep(dir);
        if (this.modOpen) return false; // ←→ do nothing in the open list
        const r = LEVEL_ROWS[this.levelRow];
        if (r === "LEVEL") return this._levelStep(dir);
        if (r === "GAME SPEED") return this._pace(dir);
        if (r !== "DIFFICULTY") return false; // MODIFIERS and START have no value
        const nh = clampHeat(this.heat + dir); // → raises it; any delta, so a segment tap is one move
        if (nh === this.heat) return false;
        this.heat = nh;
        return true;
      }
      if (isRecords(this.screen)) {
        if ((axis | 0) === 1) return this._recFocus(dir);
        if (!this.recFocus) return this._recTab(dir); // the tab row; the move() wrapper cues it, so never the public recTab here
        if (this.screen !== SCREEN.SCORES) return false; // STATS' body has no lateral control
        const nh = clampHeat(this.scoreHeat + dir); // any delta, so a difficulty tab tap is one move
        if (nh === this.scoreHeat) return false;
        this.scoreHeat = nh;
        return true;
      }
      if (this.screen === SCREEN.SETTINGS)
        return (axis | 0) === 1 ? this.optMove(dir) : this.optAdjust(dir);
      if (this.screen === SCREEN.GRAPHICS)
        return (axis | 0) === 1 ? this.gfxMove(dir) : this.gfxAdjust(dir);
      return false;
    },
    /* RECORDS' tab step by d tabs (a key ±1, a tap the delta to its tab), clamped, never wrapping. Lands on the tab row,
       and every arrival at STATS calls onStats (the event ring's opt-in, as opening STATS from MENU did), every arrival at
       MEDALS onMedals (its rows only). main wraps this for the one uiMove; false (no cue, no feel) at a clamped edge, on the
       tab already shown, and off the three pages. ANY call on the three pages disarms an armed STATS reset, a step that does
       not move included (a tap on the tab shown): R arms, anything but a second R cancels. */
    recTab(d) {
      return this._recTab(d);
    },
    _recTab(d) {
      if (this.capturing) return false;
      const i = RECORD_SCREENS.indexOf(this.screen),
        j = Math.max(0, Math.min(RECORD_SCREENS.length - 1, i + Math.round(d || 0)));
      if (i < 0) return false;
      this.resetArm = false; // before the no-move return: a tap on the tab shown cancels the reset too
      if (j === i) return false;
      this.idleT = 0;
      this.parked = false;
      const s = RECORD_SCREENS[j];
      if (s === SCREEN.STATS && onStats) onStats();
      if (s === SCREEN.TROPHIES && onMedals) onMedals();
      this.screen = s; // no _push: the repeat state stays, so a held arrow and its own key press make one step, never two
      this.recFocus = 0;
      this.subT = 0;
      this.togT = -1;
      return this._feel("move");
    },
    /* ↓ from the tab row into the page body where it has one, ↑ back; MEDALS has no body. */
    _recFocus(dir) {
      const f = dir > 0 ? 1 : 0;
      if (f === this.recFocus || (f && this.screen === SCREEN.TROPHIES)) return false;
      this.recFocus = f;
      return true;
    },
    /* The [ ] keys, a controller's shoulders and a GAME SPEED tap; ←→ on the GAME SPEED row step the same _pace through move(). */
    adjustPace(dir) {
      this.idleT = 0;
      if (this.screen !== SCREEN.LEVEL) return false;
      return this._pace(dir) && this._feel("confirm");
    },
    _pace(dir) {
      const np = clampPace(this.pace + dir);
      if (np === this.pace) return false;
      this.pace = np;
      if (o.onPaceChange) o.onPaceChange(np);
      return true;
    },
    /* ↑↓ on LEVEL SELECT: the next row, MODIFIERS skipped until modifiers are offered; clamped, never wrapping. */
    _rowStep(dir) {
      const s = dir < 0 ? -1 : 1;
      let r = this.levelRow + s;
      if (r === LV_MODS && !this.pactUnlocked) r += s;
      if (r < 0 || r > LV_START) return false;
      this.levelRow = r;
      return true;
    },
    /* ↑↓ in the open MODIFIERS list: clamped at both ends, ↑ on the first entry stays (the list closes on Esc only). */
    _modStep(dir) {
      const n = Math.max(0, Math.min(MODS_N - 1, this.modeCur + (dir < 0 ? -1 : 1)));
      if (n === this.modeCur) return false;
      this.modeCur = n;
      return true;
    },
    _modClose() {
      this.modOpen = false;
      this.modeCur = -1;
    },
    /* ←→ on the LEVEL row (a tile tap passes its delta). Past the last open level a locked one is refused, never selected:
       its card flashes CLEAR LEVEL 5 TO OPEN as a tap on its tile does (lockR / lockT) and the feel is deny, once a press or
       a hold (_lockHeld, cleared when the arrows are let go). */
    _levelStep(d) {
      const cap = roomCap(this.pactUnlocked);
      if (this.level === cap && this.level + d > cap) {
        if (cap < ROOM_MAX && !this._lockHeld) {
          this._lockHeld = true;
          this.lockR = cap + 1;
          this.lockT = this.subT;
          this._feel("deny");
        }
        return false;
      }
      const nl = Math.min(cap, Math.max(1, this.level + d));
      if (nl === this.level) return false;
      this.level = nl;
      return true;
    },
    /* Enter, the BOMB alias, SOUTH on LEVEL SELECT: in the open list toggle the focused entry through its digit (the path the
       1-5 keys take), on MODIFIERS open the list, on any other row start the run. */
    _levelConfirm() {
      if (this.modOpen) return this.key("Digit" + (this.modeCur + 1));
      if (this.levelRow === LV_MODS && this.pactUnlocked) {
        this.modOpen = true;
        this.modeCur = 0; // always its first entry: a controller's TRIGGER cursor from the shut list never leaks in
        return this._feel("enter");
      }
      return this.startRun();
    },
    /* A tap's row (pointer.js) and a controller's START (padroute.js): the focus moves to the row first, leaving MODIFIERS
       closes the list, a chip tap in the open list moves its cursor there. No cue, no feel: what follows cues itself. */
    levelFocus(r, i) {
      if (this.screen !== SCREEN.LEVEL || !(r >= 0 && r <= LV_START) || (r === LV_MODS && !this.pactUnlocked)) return false;
      this.idleT = 0;
      this.parked = false;
      this.levelRow = r;
      if (r !== LV_MODS) this._modClose();
      else if (this.modOpen && i >= 0 && i < MODS_N) this.modeCur = i;
      return true;
    },
    /* SETTINGS knobs (spec §2). LEVEL SELECT is the only precedent for
       in-subscreen adjustment, so this copies its move(dir,axis) shape: axis 1
       = up/down = row, axis 0 = left/right = adjust. Adjust CLAMPS, Enter
       CYCLES (which is what gives touch full control, since a tap maps to
       Enter on the row it hits). Every accepted change stamps togT and reports
       through o.onSettings — the same shape onPaceChange already uses. */
    optMove(dir) {
      this.idleT = 0;
      this._anaSaid = false;
      const L = this.optRows(), n = L.length;
      this.optRow = (L.indexOf(this.optLabel()) + (dir < 0 ? -1 : 1) + n) % n;
      return true;
    },
    /* The visible SETTINGS rows: r3d is the ART STYLE row's value (render3d, what the row shows and what a pick sets at once,
       while the look may still load), never the live renderer; one predicate for every reader. */
    optRows() {
      return optRows(this.render3d);
    },
    /* The focused row's label, what every optRow reader acts on (clamped into the list as a last guard; _setR3d keeps it in). */
    optLabel() {
      const L = this.optRows();
      return L[Math.max(0, Math.min(L.length - 1, this.optRow | 0))];
    },
    /* optRow onto a label of the visible list; a label not in it (CAMERA, BRIGHTNESS outside REAL 3D) lands on ART STYLE. */
    _optTo(label) {
      const L = this.optRows(), i = L.indexOf(label);
      this.optRow = i >= 0 ? i : L.indexOf("ART STYLE");
    },
    /* Every ART STYLE write goes through here, before onSettings: the list may change, so the cursor keeps its label, or lands
       on ART STYLE when its row went away (lead ruling, refining R11). */
    _setR3d(v) {
      const lab = this.optLabel();
      this.render3d = !!v;
      this._optTo(lab);
    },
    _optSet(key, v) {
      if (this.settings[key] === v) return false;
      this.settings[key] = v;
      if (key === "r3d") this._setR3d(v);
      this.togT = this.subT;
      if (onSettings) onSettings(this.settings, key);
      return true;
    },
    /* SOUND is the one row whose truth lives outside the blob: audio.toggle()
       owns the mute, the blob only records where it landed. */
    _optSound(v) {
      if (this.settings.snd === (v ? 1 : 0)) return false;
      if (audio) this.sound = !!audio.toggle();
      else this.sound = !this.sound;
      this.settings.snd = this.sound ? 1 : 0;
      this.togT = this.subT;
      if (onSettings) onSettings(this.settings, "snd");
      return true;
    },
    /* ANALYTICS: the consent store is main's (o.onAnalytics); RESET DEFAULTS
       never touches it, because it is a choice, not a setting. */
    _optAna(v) {
      if (this.analytics === !!v) return false;
      this.analytics = !!v;
      this.togT = this.subT;
      if (o.onAnalytics) o.onAnalytics(this.analytics);
      return true;
    },
    /* Consent ruling (Q11): a stray pad button must not consent, so with no
       answer yet the row does nothing on a pad and says why. o.anaOpen = the
       card is still unanswered; a pad with no getter blocks. */
    _anaOpen() {
      return o.anaOpen ? !!o.anaOpen() : true;
    },
    _anaBlocked() {
      if (this.lastDev !== "pad" || !this._anaOpen()) return false;
      this._anaSaid = true;
      this._feel("deny");
      return true;
    },
    get anaNote() {
      return this._anaSaid && this._anaOpen() ? ANA_NOTE : "";
    },
    /* RENDER (R4): 0 CLASSIC 2D, 1 PIXEL, 2 REAL 3D. r3d and px move together
       and report through onSettings once, never as two half-states. */
    _optRender(v) {
      const b = renderBits(v);
      if (this.settings.r3d === b.r3d && this.settings.px === b.px) return false;
      this.settings.r3d = b.r3d;
      this.settings.px = b.px;
      this._setR3d(b.r3d);
      this.pixel = !!b.px;
      this.togT = this.subT;
      if (onSettings) onSettings(this.settings, "render");
      return true;
    },
    /* v202 Q4: a look that did not load leaves the pick on the look still on screen (on), never CLASSIC 2D by default */
    lookFailed(k, on) {
      if (RENDER_KINDS[renderVal(this)] === k) this._optRender(Math.max(0, RENDER_KINDS.indexOf(on)));
    },
    /* PAUSE kicker (Q1): a look picked mid-run waits for an idle state: "REAL 3D NEXT" while it builds, "REAL 3D READY" once parked for the swap */
    get lookNext() {
      const j = this.lookJob;
      if (this.restoring) return LOOK_LABEL[j.k] + " · RESTORING";
      if (!j || j.on || j.rebuild || j.state === "failed") return "";
      return LOOK_LABEL[j.k] + (j.state === "ready" ? " READY" : " NEXT");
    },
    /* a lost REAL 3D context is being rebuilt: RESUME waits for it (blind play would never rebuild, the job parks in PLAY) */
    get restoring() {
      const j = this.lookJob;
      return !!(j && j.restore && !j.on && j.state !== "failed");
    },
    /* warm on intent (Q3): the cursor resting WARM_T on the ART STYLE row (SETTINGS, or PAUSE's SETTINGS view) warms the next look of the cycle once per rest; live PLAY never */
    _warmTick(d) {
      const on = this.optLabel() === "ART STYLE" && (this.screen === SCREEN.SETTINGS || (this.screen === SCREEN.GAME && this.worldState === "PAUSE" && this.pauseView === 1));
      if (!on) { this.warmT = 0; this._warmA = this._warmK = null; return; }
      const nx = RENDER_KINDS[(renderVal(this) + 1) % RENDER_KINDS.length];
      if (nx !== this._warmA) { this._warmA = nx; this.warmT = 0; }
      this.warmT += d;
      if (this.warmT >= WARM_T && this._warmK !== nx) { this._warmK = nx; if (onWarm) onWarm(nx); }
    },
    /* the 10 s look release waits while the player compares looks: SETTINGS, GRAPHICS, CONTROLS and PAUSE's views */
    lookHold() {
      const s = this.screen;
      return s === SCREEN.SETTINGS || s === SCREEN.GRAPHICS || s === SCREEN.CONTROLS || (s === SCREEN.GAME && this.worldState === "PAUSE" && this.pauseView >= 1);
    },
    optAdjust(dir) {
      this.idleT = 0;
      const r = this.optLabel(),
        d = dir < 0 ? -1 : 1;
      if (r === "MUSIC" || r === "SFX") {
        const k = r === "MUSIC" ? "mus" : "sfx";
        return this._optSet(k, Math.min(100, Math.max(0, this.settings[k] + d * 10)));
      }
      if (r === "BRIGHTNESS")
        return this._optSet("bri", Math.min(130, Math.max(70, this.settings.bri + d * 10)));
      if (r === "CAMERA")
        return this._optSet("cam", Math.min(2, Math.max(0, this.settings.cam + d)));
      if (r === "SOUND") return this._optSound(d > 0 ? 1 : 0);
      if (r === "ART STYLE") return this._optRender(renderVal(this) + d);
      if (r === "SCREEN SHAKE") return this._optSet("shk", d > 0 ? 1 : 0);
      if (r === "REDUCE FLASH") return this._optSet("flx", d > 0 ? 1 : 0);
      if (r === "ANALYTICS") return this._anaBlocked() ? false : this._optAna(d > 0);
      return false;
    },
    optCycle() {
      this.idleT = 0;
      const r = this.optLabel();
      if (r === "MUSIC" || r === "SFX") {
        const k = r === "MUSIC" ? "mus" : "sfx";
        return this._optSet(k, this.settings[k] >= 100 ? 0 : this.settings[k] + 10);
      }
      if (r === "BRIGHTNESS")
        return this._optSet("bri", this.settings.bri >= 130 ? 70 : this.settings.bri + 10);
      if (r === "CAMERA") return this._optSet("cam", (this.settings.cam + 1) % 3);
      if (r === "SOUND") return this._optSound(this.settings.snd ? 0 : 1);
      if (r === "ART STYLE") return this._optRender(this.lookJob && this.lookJob.state === "failed" ? RENDER_KINDS.indexOf(this.lookJob.k) : (renderVal(this) + 1) % 3); // Enter on a look that did not load retries it
      if (r === "SCREEN SHAKE") return this._optSet("shk", this.settings.shk ? 0 : 1);
      if (r === "REDUCE FLASH") return this._optSet("flx", this.settings.flx ? 0 : 1);
      if (r === "ANALYTICS") return this._anaBlocked() ? false : this._optAna(!this.analytics);
      if (r === "GRAPHICS") return this._gfxOpen();
      if (r === "CONTROLS") return this._ctlOpen();
      if (r === "RESET DEFAULTS") return this.optReset();
      return false;
    },
    /* GRAPHICS (unified spec 2026-10-10 §5): the SETTINGS door row opens a
       SCREEN from the menu and the inline pauseView 2 from PAUSE (the room
       track keeps playing). Rows, presets, locks and value strings all come
       from gfx.js; QUALITY is derived from the six governed rows, never
       stored. ←/→ clamp, Enter cycles; a preset writes all six (locked rows
       too) and reports through onSettings once. */
    _gfxOpen() {
      this.gfxRow = 0;
      this.gfxChg = 0;
      if (this.screen !== SCREEN.GAME) return this._push(SCREEN.GRAPHICS);
      this.pauseView = 2;
      this.togT = -1;
      return this._feel("enter");
    },
    /* CONTROLS (record 2026-11-02): the door opens a SCREEN from the menu and
       the inline pauseView 3 from PAUSE, like GRAPHICS. The page owns its rows;
       the shell owns the walk, the clock and every way out. Keys and buttons
       reach the page FIRST through ctlKey / ctlBtn. */
    onControls() {
      if (!this.controls) return false;
      return this.screen === SCREEN.CONTROLS || (this.screen === SCREEN.GAME && this.worldState === "PAUSE" && this.pauseView === 3);
    },
    get capturing() {
      return !!(this.controls && this.controls.capturing);
    },
    /* ←→ on the page's live value row: the move was a write, which cues itself. */
    ctlAdjusts(axis) {
      return (axis | 0) === 0 && this.onControls() && this.controls.onValue;
    },
    get ctlTab() {
      return this.controls ? this.controls.view(this.ctlT).tab : "key";
    },
    get moveKeys() {
      return this.controls ? this.controls.view(this.ctlT).key.MOVE : DEF_MOVE;
    },
    ctlKey(code, key) {
      return this.onControls() ? this.controls.feedKey(code, key, this.ctlT) : false;
    },
    ctlBtn(id) {
      return this.onControls() ? this.controls.feedBtn(id, this.ctlT) : false;
    },
    _ctlOpen() {
      if (!this.controls) return false;
      if (this.screen === SCREEN.GAME) {
        this.pauseView = 3;
        this.togT = -1;
        this._feel("enter");
      } else this._push(SCREEN.CONTROLS);
      this.controls.open(this.lastDev);
      return true;
    },
    _ctlCancel() {
      if (this.controls) this.controls.cancel();
      this._anaSaid = false;
    },
    /* A pad wake: an input was seen, whatever it went on to do. */
    wake() {
      this.idleT = 0;
      this.parked = false;
    },
    _gfxKind() {
      return this.gfx && this.gfx.kind === "iso" ? "iso" : this.render3d ? "3d" : this.pixel ? "px" : "2d"; // the flags flip with RENDER at once; app.gfx lags up to 0.5 s
    },
    gfxView() {
      return gfxView(this.settings, this._gfxKind(), this.gfx);
    },
    gfxPreset() {
      return presetOf(this.settings);
    },
    gfxMove(dir) {
      this.idleT = 0;
      const n = GFX_ROWS.length;
      this.gfxRow = (this.gfxRow + (dir < 0 ? -1 : 1) + n) % n;
      return true;
    },
    /* No togT stamp: the frame loop's AA revert lands here, off any input. */
    setGfx(key, v) {
      if (this.settings[key] === v) return false;
      this.settings[key] = v;
      if (onSettings) onSettings(this.settings, key);
      return true;
    },
    _gfxSet(key, v) {
      const p0 = presetOf(this.settings);
      if (!this.setGfx(key, v)) return false;
      this.gfxChg = (1 << GFX_KEYS.indexOf(key)) | (presetOf(this.settings) !== p0 ? 1 : 0);
      this.togT = this.subT;
      return true;
    },
    _gfxPreset(name) {
      const s0 = { ...this.settings };
      applyPreset(this.settings, name);
      let m = 0;
      GFX_KEYS.forEach((k, i) => { if (k && s0[k] !== this.settings[k]) m |= 1 << i; });
      if (!m) return false;
      this.gfxChg = m | 1;
      this.togT = this.subT;
      if (onSettings) onSettings(this.settings, "gfx");
      return true;
    },
    gfxAdjust(dir) {
      this.idleT = 0;
      const key = GFX_KEYS[this.gfxRow],
        d = dir < 0 ? -1 : 1;
      if (!key) {
        const i = PRESET_NAMES.indexOf(presetOf(this.settings));
        const n = i < 0 ? (d < 0 ? 0 : PRESET_NAMES.length - 1) : Math.min(PRESET_NAMES.length - 1, Math.max(0, i + d));
        return n === i ? false : this._gfxPreset(PRESET_NAMES[n]);
      }
      if (locked(key, this._gfxKind())) return !this._feel("deny");
      return this._gfxSet(key, Math.min(VALUES[key].length - 1, Math.max(0, this.settings[key] + d)));
    },
    gfxCycle() {
      this.idleT = 0;
      const key = GFX_KEYS[this.gfxRow];
      if (!key) {
        const p = presetOf(this.settings);
        return this._gfxPreset(p === "AUTO" ? "HIGH" : p === "HIGH" ? "BATTERY" : "AUTO");
      }
      if (locked(key, this._gfxKind())) return !this._feel("deny");
      return this._gfxSet(key, (this.settings[key] + 1) % VALUES[key].length);
    },
    /* Writes DEFAULTS and re-applies every knob live. Progress data
       (highscores / plaques / pact / pace) lives under other keys and is never
       touched. */
    optReset() {
      this.idleT = 0;
      const d = clampSettings(DEFAULTS);
      if (this.sound !== !!d.snd) {
        if (audio) this.sound = !!audio.toggle();
        else this.sound = !this.sound;
      }
      for (const k in d) this.settings[k] = d[k];
      this.settings.snd = this.sound ? 1 : 0;
      this._setR3d(this.settings.r3d); // the cursor stays on RESET DEFAULTS, the list may have lost CAMERA and BRIGHTNESS
      this.pixel = !this.render3d && !!this.settings.px;
      this.togT = this.subT;
      if (onSettings) onSettings(this.settings, "reset");
      return true;
    },
    /* SETTINGS here is an INLINE page, not a screen jump: jumping to
       SCREEN.SETTINGS would flip musicCue from the room's biome track to the
       menu track mid-run, hide the touch pad and falsify every screen===GAME
       guard, for a page the player closes in four seconds. */
    confirmPause() {
      if (this.pauseView === 3) return this.controls ? this.controls.confirm(this.ctlT) : false;
      if (this.pauseView === 2) return this._conf(this.gfxCycle());
      if (this.pauseView === 1) return this._conf(this.optCycle());
      const cmd = PAUSE_ITEMS[this.pauseCursor];
      if (cmd === "SETTINGS") {
        this.pauseView = 1;
        this.optRow = 0; // the top row of either list (MUSIC)
        this.togT = -1;
        return this._feel("enter");
      }
      if (cmd === "RESUME" && this.restoring) return this._feel("deny"), false; // the kicker says REAL 3D · RESTORING
      this._feel(cmd === "RESTART" ? "launch" : "back");
      if (onPauseCmd) onPauseCmd(cmd);
      return true;
    },
    pauseBack() {
      if (this.pauseView === 3) {
        if (this.controls && this.controls.back() !== "page") return true; // a capture or an armed reset ends first
        this.pauseView = 1; // 3 -> 1 on the door, never 3 -> 2
        this._feel("back");
        this._optTo("CONTROLS");
        this.togT = -1;
        return true;
      }
      if (this.pauseView !== 1 && this.pauseView !== 2) return false;
      this._anaSaid = false;
      if (this.pauseView === 2) this._optTo("GRAPHICS"); // 2 -> 1 on the GRAPHICS door
      else this.pauseCursor = PAUSE_ITEMS.indexOf("SETTINGS"); // 1 -> 0 on the row that opened it
      this.pauseView--;
      this.togT = -1;
      return this._feel("back");
    },
    enterPause() {
      this._ctlCancel();
      this.pauseCursor = PAUSE_ITEMS.indexOf("RESUME");
      this.pauseView = 0;
      this.togT = -1;
      return this._feel("enter");
    },
    /* A pad's L/R TRIGGER on LEVEL SELECT, with the list open or shut (one cursor over the chips). The first step lands on an
       end; the ends clamp and are silent. */
    modeWalk(d) {
      this.idleT = 0;
      if (this.screen !== SCREEN.LEVEL || !this.pactUnlocked) return false;
      const n = this.modeCur < 0 ? (d > 0 ? 0 : MODS_N - 1) : Math.max(0, Math.min(MODS_N - 1, this.modeCur + d));
      if (n === this.modeCur) return false;
      this.modeCur = n;
      return this._feel("move");
    },
    togglePactBit(bit) {
      this.idleT = 0;
      if (this.screen !== SCREEN.LEVEL || !this.pactUnlocked) return false;
      this.pact = togglePact(this.pact, bit);
      return this._feel("confirm");
    },
    /* TIME ATTACK is a DISPLAY toggle: it gates the stopwatch chip and the
       CLEARED time line and nothing else. It is deliberately absent from
       startRun's args — it never reaches onStart, world or step(). */
    toggleTimeAttack() {
      this.idleT = 0;
      if (this.screen !== SCREEN.LEVEL || !this.pactUnlocked) return false;
      this.timeAttack = !this.timeAttack;
      if (o.onTimeAttack) o.onTimeAttack(this.timeAttack);
      return this._feel("confirm");
    },
    /* Start a run at app.level; main's onStart does loadLevel/score/state. */
    startRun() {
      const args = {
        level: this.level,
        heat: this.heat | 0,
        pact: this.pactUnlocked ? clampPact(this.pact) : 0,
        pace: this.pace | 0,
      };
      this._ctlCancel();
      this.pauseView = 0;
      this.screen = SCREEN.GAME;
      this.inGame = true;
      this.subT = 0;
      this.repT = 0;
      this.repDir = 0;
      this._hot = false;
      this._taps = {};
      this.togT = -1;
      this.idleT = 0;
      this._feel("launch");
      if (onStart) onStart(args);
      return args;
    },
    /* ATTRACT (spec §1): idle demo takeover. The machine never creates the
       demo world — main owns that harness; entry/exit only flip state here. */
    enterAttract() {
      this._ctlCancel();
      this.screen = SCREEN.ATTRACT;
      this.attractT = 0;
      this.subT = 0;
      this.repT = 0;
      this.repDir = 0;
      this._hot = false;
      this._taps = {};
      this.togT = -1;
      return true;
    },
    exitAttract() {
      if (this.screen !== SCREEN.ATTRACT) return false;
      this.idleT = 0;
      this._push(SCREEN.MENU, 1);
      return true;
    },
    /* Tap/confirm/non-Escape key on ATTRACT: start a CORE room-1 run, keeping
       LEVEL SELECT's level/heat/pact picks untouched for next time. */
    playFromAttract() {
      if (this.screen !== SCREEN.ATTRACT) return false;
      return this._playCore({ level: 1, heat: 0, pact: 0, pace: this.pace | 0 });
    },
    /* The daily config is PINNED, not inherited: heat changes the roster, pact
       changes the item count and therefore the rng draw order, and pace scales
       player speed — the only claim this feature makes is that YOUR OWN
       attempts are comparable to each other. There is no DAILY screen: the
       standing record lives on STATS and the day's verdict on the run-end
       overlay. Without o.dailySeed the row is inert rather than starting a
       board derived from nothing. */
    startDaily() {
      if (this.screen !== SCREEN.MENU) return false;
      const d = o.dailySeed ? o.dailySeed() : null;
      if (!d) return false;
      return this._playCore({ level: 1, heat: 0, pact: 0, pace: 0,
                              seed: d.seed, daily: d.date, gen: d.gen });
    },
    /* A challenge run honours the DECODED pact bits even when pactUnlocked is
       false, and never writes nb.pact.v1. That gate governs what a player may
       choose FOR THEMSELVES; it cannot govern what a shared board CONTAINS,
       because pact changes the board (applyPact's buriedAdd -> item count ->
       rng draw order) — stripping it would hand the recipient a different board
       under the same code, the one thing this feature exists to prevent. A
       locked recipient still stops at room 5 via roomCap: same boards, shorter
       run. Both disclosed. */
    playChallenge(t) {
      const c = t || {};
      return this._playCore({
        level: 1,
        heat: clampHeat(c.heat),
        pact: clampPact(c.pact),
        pace: clampPace(c.pace),
        seed: c.seed >>> 0,
        gen: c.gen === 3 ? 3 : c.gen === 2 ? 2 : 1,
      });
    },
    /* Shared CORE handoff for playFromAttract/startDaily/playChallenge: reset
       the shell into GAME and hand args to main's onStart. Callers gate the
       screen check themselves before reaching here. */
    _playCore(args) {
      this._ctlCancel();
      this.pauseView = 0;
      this.screen = SCREEN.GAME;
      this.inGame = true;
      this.subT = 0;
      this.repT = 0;
      this.repDir = 0;
      this._hot = false;
      this._taps = {};
      this.togT = -1;
      this.idleT = 0;
      this._feel("launch");
      if (onStart) onStart(args);
      return args;
    },
    /* M-quit: valid ONLY while in GAME with world paused (state passed in). */
    quitToMenu(worldState) {
      if (this.screen !== SCREEN.GAME || worldState !== "PAUSE") return false;
      this._feel("back");
      this._toMenuInner();
      return true;
    },
    /* Debug/reset hook target: force back to MENU from anywhere. */
    toMenu() {
      const was = this.screen !== SCREEN.MENU;
      this._toMenuInner();
      return was;
    },
    _toMenuInner() {
      this._ctlCancel();
      this.pauseView = 0; // a stale view would make the next run's first pause a pauseBack
      this.screen = SCREEN.MENU;
      this.inGame = false;
      this.subT = 0;
      this.repT = 0;
      this.repDir = 0;
      this._hot = false;
      this._taps = {};
      this.togT = -1;
      this.idleT = 0;
    },
    _feel(n) {
      if (!this.feel || FEELS.indexOf(n) < FEELS.indexOf(this.feel)) this.feel = n;
      return true;
    },
    _conf(r) {
      if (r) this._feel("confirm");
      return r;
    },
    _push(s, back) {
      this._feel(back ? "back" : "enter");
      this._ctlCancel();
      this.screen = s;
      this.resetArm = false;
      this.subT = 0;
      this.repT = 0;
      this.repDir = 0;
      this._hot = false;
      this._taps = {};
      this.togT = -1;
      return true;
    },
    /* ENEMIES taps (pointer.js): a points value focuses its foe and opens the tooltip; any other tap closes an open one. */
    foeTap(i) {
      if (this.screen !== SCREEN.ENEMIES || !(i >= 0 && i < FOES.length)) return false;
      this.idleT = 0;
      this.foeRow = i | 0;
      this.foeTip = true;
      return this._feel("confirm");
    },
    _isInfo() { return this.screen === SCREEN.HOWTO || this.screen === SCREEN.ITEMS || this.screen === SCREEN.FLOOR; },
    /* a tap on a read-only page's ▲ / ▼ key: one page step, cued as a move */
    infoStep(d) { return this._isInfo() && this.move(d < 0 ? -1 : 1, 0); },
    /* a tap on a GUIDE page key: the first door of the page it shows, focused */
    guideFocus(i) {
      if (this.screen !== SCREEN.GUIDE || !(i >= 0 && i < GUIDE_ROWS.length) || (i | 0) === this.guideRow) return false;
      this.guideRow = i | 0;
      this.idleT = 0;
      return this._feel("move");
    },
    /* a tap on an ENEMIES page key: the first foe of the page it shows, focused, its tooltip shut */
    foeFocus(i) {
      if (this.screen !== SCREEN.ENEMIES || !(i >= 0 && i < FOES.length) || (i | 0) === this.foeRow) return false;
      this.foeRow = i | 0;
      this.foeTip = false;
      this.idleT = 0;
      return this._feel("move");
    },
    foeClose() {
      if (this.screen !== SCREEN.ENEMIES || !this.foeTip) return false;
      this.foeTip = false;
      return this._feel("back");
    },
    /* §1 score edge, frame-polled: returns true once on PLAY|WIN→LOSE.
       Caller persists via scoreEntry(world). Latches worldState for KeyM. */
    noteWorldEdge(prevSt, st) {
      this.worldState = st || null;
      return (prevSt === "PLAY" || prevSt === "WIN") && st === "LOSE";
    },
  };
  /* ?render=3d|px / opts.render3d win at boot over the persisted r3d/px, so the blob
     is re-seeded IN MEMORY to whatever actually took effect — display and
     storage never disagree, and a URL override is never written to disk. */
  app.settings.r3d = app.render3d ? 1 : 0;
  app.settings.px = app.pixel ? 1 : 0;
  app.settings.snd = app.sound ? 1 : 0;
  return app;
}
