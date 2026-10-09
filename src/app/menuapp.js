// APP SHELL STATE MACHINE — pure logic, no canvas/DOM. Owns BOOT->INTRO(title->show)->MENU
// <-> subscreens -> GAME routing outside the sim (spec §1). The sim's world is
// untouched; nothing here is ever read by step().
//
// update(dt, input) input contract: { input:{up,down,left,right},  // held axes,
//   live via Input's public getter; confirmHeld:boolean }           // held fire
// Confirm/repeat edges are computed here: rising-edge only, repeats 350ms then
// 110ms. key(code) is the discrete side-channel (Enter/Esc/Backspace/M +
// arrows/WASD as taps); taps are handed to update() via a per-frame consume map
// so wiring BOTH channels never double-moves.
import { roomCap } from "../core/config.js";
import { clampHeat } from "../core/heat.js";
import { clampPact, PACT, togglePact } from "../core/pact.js";
import { clampPace } from "../core/pace.js";
import { clampSettings, DEFAULTS } from "./settings.js";
import { SHOW_DUR, SKIP_GUARD, TITLE_IN } from "./intro.js";
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
});
export const ITEMS = Object.freeze([
  "PLAY",
  "LEVEL SELECT",
  "DAILY",
  "OPTIONS",
  "GUIDE",
  "HIGH SCORES",
  "STATS",
  "SOURCE",
]);
/* GUIDE rows, frozen and index-addressed: guideRow, drawGuide and confirm's
   GUIDE dispatch all count this array. */
export const GUIDE_ROWS = Object.freeze(["HOW TO PLAY", "ITEMS", "ENEMIES"]);
/* OPTIONS rows, frozen and index-addressed: optRow, drawSettings and
   settingsHit all agree because they all count this array. */
export const OPT_ROWS = Object.freeze([
  "MUSIC",
  "SFX",
  "SOUND",
  "RENDER",
  "CAMERA",
  "BRIGHTNESS",
  "SCREEN SHAKE",
  "REDUCE FLASH",
  "RESET DEFAULTS",
]);
/* PAUSE list (spec §3). world.state stays PAUSE and the shell stays GAME —
   that is what keeps the room's track playing, the HUD gate open, the touch
   gate honest and every screen===GAME guard true. */
export const PAUSE_ITEMS = Object.freeze([
  "RESUME",
  "RESTART",
  "OPTIONS",
  "QUIT TO MENU",
]);
export const SOURCE_URL = "https://github.com/HMarzban/fusegrid";
const REP_FIRST = 0.35,
  REP_NEXT = 0.11;
export const IDLE_T = 10; // MENU idle seconds before ATTRACT takes over

export function createMenuApp(opts = {}) {
  const o = opts || {};
  const audio = o.audio || null;
  const onStart = o.onStart || null;
  const onSource = o.onSource || null;
  const onStats = o.onStats || null;
  const onSettings = o.onSettings || null;
  const onPauseCmd = o.onPauseCmd || null;
  const app = {
    screen: o.autoplay ? SCREEN.GAME : SCREEN.INTRO,
    cursor: 0,
    level: Math.min(roomCap(o.pactUnlocked), Math.max(1, o.level | 0 || 1)),
    heat: clampHeat(o.heat),
    scoreHeat: 0,
    settings: clampSettings(o.settings),
    optRow: 0, // OPTIONS row cursor — its OWN field, so the MENU cursor
    // survives a round trip through the page
    guideRow: 0, // GUIDE row cursor — its OWN field too, same reason
    pauseCursor: 0,
    pauseView: 0, // 0 list / 1 inline OPTIONS; both reset on the PLAY->PAUSE edge
    pact: clampPact(o.pact),
    pace: clampPace(o.pace),
    dailyTag: o.dailyTag || "NEW",
    timeAttack: !!o.timeAttack,
    pactUnlocked: !!o.pactUnlocked,
    sound: o.sound !== false,
    render3d: !!o.render3d,
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
      if (this.boardReady) this.readyT += d;
      if (this.screen === SCREEN.GAME) {
        if (this.worldState === "PAUSE") {
          const ax = (input && input.input) || {};
          let dir = 0,
            axis = 1;
          if (this.pauseView === 1 && (ax.left || ax.right)) {
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
      if (this.screen === SCREEN.ATTRACT) return; // subT already advanced -> hint blink
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
      if (this.screen === SCREEN.MENU || this.screen === SCREEN.GUIDE)
        dir = ax.up ? -1 : ax.down ? 1 : 0;
      else if (this.screen === SCREEN.LEVEL || this.screen === SCREEN.SETTINGS) {
        if (ax.left || ax.right) {
          dir = ax.left ? -1 : 1;
          axis = 0;
        } else if (ax.up || ax.down) {
          dir = ax.up ? -1 : 1;
          axis = 1;
        }
      }
      this._repeat(d, dir, axis);
      if (rising) this.confirm();
      this._taps = {};
      if (this.screen === SCREEN.MENU) {
        this.idleT += d;
        if (this.idleT >= IDLE_T) this.enterAttract();
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
            this.move(dir, axis);
            this.repT -= thr;
            this._hot = true;
          }
        }
      } else {
        this.repDir = 0;
        this.repAxis = 0;
        this.repT = 0;
        this._hot = false;
      }
    },
    /* Discrete key tap (Enter/Esc/Backspace/M + arrows-as-tap fallback). */
    key(code) {
      if (this.screen === SCREEN.ATTRACT) {
        if (code === "Escape" || code === "Backspace") return this.exitAttract();
        return this.playFromAttract();
      }
      if (this.screen === SCREEN.INTRO) return this._skipKey(); // title: no-op; show: "ANY KEY TO SKIP"
      this.idleT = 0;
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
        case "KeyW":
          return this._tapMove(-1, false);
        case "ArrowDown":
        case "KeyS":
          return this._tapMove(1, false);
        case "ArrowLeft":
        case "KeyA":
          return this._tapMove(-1, true);
        case "ArrowRight":
        case "KeyD":
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
          return this.adjustPace(-1);
        case "BracketRight":
          return this.adjustPace(1);
        case "KeyT":
          return this.screen === SCREEN.STATS ? this._push(SCREEN.TROPHIES) : false;
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
      if (this.screen === SCREEN.GUIDE && !lat && this.move(dir, 0)) {
        this._taps[dir + ":0"] = true;
        return true;
      }
      if (this.screen === SCREEN.LEVEL && this.move(dir, lat ? 0 : 1)) {
        this._taps[dir + ":" + (lat ? 0 : 1)] = true;
        return true;
      }
      if (this.screen === SCREEN.SETTINGS && this.move(dir, lat ? 0 : 1)) {
        this._taps[dir + ":" + (lat ? 0 : 1)] = true;
        return true;
      }
      if (this.screen === SCREEN.SCORES && lat && this.move(dir, 0)) {
        this._taps[dir + ":0"] = true;
        return true;
      }
      return false;
    },
    confirm() {
      if (this.screen === SCREEN.ATTRACT) return this.playFromAttract();
      this.idleT = 0;
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
              return this._push(SCREEN.LEVEL);
            case "DAILY":
              return this.startDaily();
            case "OPTIONS":
              this.optRow = 0;
              return this._push(SCREEN.SETTINGS);
            case "GUIDE":
              this.guideRow = 0;
              return this._push(SCREEN.GUIDE);
            case "HIGH SCORES":
              return this._push(SCREEN.SCORES);
            case "STATS":
              if (onStats) onStats();
              return this._push(SCREEN.STATS);
            case "SOURCE":
              if (onSource) onSource();
              return true;
          }
          return false;
        }
        case SCREEN.LEVEL:
          return this.startRun();
        case SCREEN.SETTINGS:
          return this.optCycle();
        case SCREEN.GUIDE:
          switch (GUIDE_ROWS[this.guideRow]) {
            case "HOW TO PLAY":
              return this._push(SCREEN.HOWTO);
            case "ITEMS":
              return this._push(SCREEN.ITEMS);
            case "ENEMIES":
              return this._push(SCREEN.ENEMIES);
          }
          return false;
        case SCREEN.HOWTO:
        case SCREEN.SCORES:
        case SCREEN.ITEMS:
        case SCREEN.ENEMIES:
        case SCREEN.STATS:
        case SCREEN.TROPHIES:
          return this.back();
      }
      return false;
    },
    back() {
      if (
        this.screen === SCREEN.HOWTO ||
        this.screen === SCREEN.ITEMS ||
        this.screen === SCREEN.ENEMIES
      )
        return this._push(SCREEN.GUIDE);
      if (this.screen === SCREEN.TROPHIES) return this._push(SCREEN.STATS);
      if (
        this.screen === SCREEN.LEVEL ||
        this.screen === SCREEN.SCORES ||
        this.screen === SCREEN.SETTINGS ||
        this.screen === SCREEN.GUIDE ||
        this.screen === SCREEN.STATS
      )
        return this._push(SCREEN.MENU);
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
    move(dir, axis) {
      this.idleT = 0;
      if (this.screen === SCREEN.GAME) {
        if (this.worldState !== "PAUSE") return false;
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
      if (this.screen === SCREEN.LEVEL) {
        if ((axis | 0) === 1) {
          const nh = clampHeat(this.heat + (dir < 0 ? 1 : -1));
          if (nh === this.heat) return false;
          this.heat = nh;
          return true;
        }
        const cap = roomCap(this.pactUnlocked);
        const nl = Math.min(cap, Math.max(1, this.level + dir));
        if (nl === this.level) return false;
        this.level = nl;
        return true;
      }
      if (this.screen === SCREEN.SCORES) {
        if ((axis | 0) !== 0) return false;
        const nh = clampHeat(this.scoreHeat + dir);
        if (nh === this.scoreHeat) return false;
        this.scoreHeat = nh;
        return true;
      }
      if (this.screen === SCREEN.SETTINGS)
        return (axis | 0) === 1 ? this.optMove(dir) : this.optAdjust(dir);
      return false;
    },
    adjustPace(dir) {
      this.idleT = 0;
      if (this.screen !== SCREEN.LEVEL) return false;
      const np = clampPace(this.pace + (dir < 0 ? -1 : 1));
      if (np === this.pace) return false;
      this.pace = np;
      if (o.onPaceChange) o.onPaceChange(np);
      return true;
    },
    /* OPTIONS knobs (spec §2). LEVEL SELECT is the only precedent for
       in-subscreen adjustment, so this copies its move(dir,axis) shape: axis 1
       = up/down = row, axis 0 = left/right = adjust. Adjust CLAMPS, Enter
       CYCLES (which is what gives touch full control, since a tap maps to
       Enter on the row it hits). Every accepted change stamps togT and reports
       through o.onSettings — the same shape onPaceChange already uses. */
    optMove(dir) {
      this.idleT = 0;
      const n = OPT_ROWS.length;
      this.optRow = (this.optRow + (dir < 0 ? -1 : 1) + n) % n;
      return true;
    },
    _optSet(key, v) {
      if (this.settings[key] === v) return false;
      this.settings[key] = v;
      if (key === "r3d") this.render3d = !!v;
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
    _opt3dLocked(r) {
      return (r === "CAMERA" || r === "BRIGHTNESS") && !this.render3d;
    },
    optAdjust(dir) {
      this.idleT = 0;
      const r = OPT_ROWS[this.optRow],
        d = dir < 0 ? -1 : 1;
      if (this._opt3dLocked(r)) return false;
      if (r === "MUSIC" || r === "SFX") {
        const k = r === "MUSIC" ? "mus" : "sfx";
        return this._optSet(k, Math.min(100, Math.max(0, this.settings[k] + d * 10)));
      }
      if (r === "BRIGHTNESS")
        return this._optSet("bri", Math.min(130, Math.max(70, this.settings.bri + d * 10)));
      if (r === "CAMERA")
        return this._optSet("cam", Math.min(2, Math.max(0, this.settings.cam + d)));
      if (r === "SOUND") return this._optSound(d > 0 ? 1 : 0);
      if (r === "RENDER") return this._optSet("r3d", d > 0 ? 1 : 0);
      if (r === "SCREEN SHAKE") return this._optSet("shk", d > 0 ? 1 : 0);
      if (r === "REDUCE FLASH") return this._optSet("flx", d > 0 ? 1 : 0);
      return false;
    },
    optCycle() {
      this.idleT = 0;
      const r = OPT_ROWS[this.optRow];
      if (this._opt3dLocked(r)) return false;
      if (r === "MUSIC" || r === "SFX") {
        const k = r === "MUSIC" ? "mus" : "sfx";
        return this._optSet(k, this.settings[k] >= 100 ? 0 : this.settings[k] + 10);
      }
      if (r === "BRIGHTNESS")
        return this._optSet("bri", this.settings.bri >= 130 ? 70 : this.settings.bri + 10);
      if (r === "CAMERA") return this._optSet("cam", (this.settings.cam + 1) % 3);
      if (r === "SOUND") return this._optSound(this.settings.snd ? 0 : 1);
      if (r === "RENDER") return this._optSet("r3d", this.settings.r3d ? 0 : 1);
      if (r === "SCREEN SHAKE") return this._optSet("shk", this.settings.shk ? 0 : 1);
      if (r === "REDUCE FLASH") return this._optSet("flx", this.settings.flx ? 0 : 1);
      if (r === "RESET DEFAULTS") return this.optReset();
      return false;
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
      this.render3d = !!this.settings.r3d;
      this.togT = this.subT;
      if (onSettings) onSettings(this.settings, "reset");
      return true;
    },
    /* OPTIONS here is an INLINE page, not a screen jump: jumping to
       SCREEN.SETTINGS would flip musicCue from the room's biome track to the
       menu track mid-run, hide the touch pad and falsify every screen===GAME
       guard, for a page the player closes in four seconds. */
    confirmPause() {
      if (this.pauseView === 1) return this.optCycle();
      const cmd = PAUSE_ITEMS[this.pauseCursor];
      if (cmd === "OPTIONS") {
        this.pauseView = 1;
        this.optRow = 0;
        this.togT = -1;
        return true;
      }
      if (onPauseCmd) onPauseCmd(cmd);
      return true;
    },
    pauseBack() {
      if (this.pauseView !== 1) return false;
      this.pauseView = 0;
      this.togT = -1;
      return true;
    },
    enterPause() {
      this.pauseCursor = 0;
      this.pauseView = 0;
      this.togT = -1;
      return true;
    },
    togglePactBit(bit) {
      this.idleT = 0;
      if (this.screen !== SCREEN.LEVEL || !this.pactUnlocked) return false;
      this.pact = togglePact(this.pact, bit);
      return true;
    },
    /* TIME ATTACK is a DISPLAY toggle: it gates the stopwatch chip and the
       CLEARED time line and nothing else. It is deliberately absent from
       startRun's args — it never reaches onStart, world or step(). */
    toggleTimeAttack() {
      this.idleT = 0;
      if (this.screen !== SCREEN.LEVEL || !this.pactUnlocked) return false;
      this.timeAttack = !this.timeAttack;
      if (o.onTimeAttack) o.onTimeAttack(this.timeAttack);
      return true;
    },
    /* Start a run at app.level; main's onStart does loadLevel/score/state. */
    startRun() {
      const args = {
        level: this.level,
        heat: this.heat | 0,
        pact: this.pactUnlocked ? clampPact(this.pact) : 0,
        pace: this.pace | 0,
      };
      this.screen = SCREEN.GAME;
      this.inGame = true;
      this.subT = 0;
      this.repT = 0;
      this.repDir = 0;
      this._hot = false;
      this._taps = {};
      this.togT = -1;
      this.idleT = 0;
      if (onStart) onStart(args);
      return args;
    },
    /* ATTRACT (spec §1): idle demo takeover. The machine never creates the
       demo world — main owns that harness; entry/exit only flip state here. */
    enterAttract() {
      this.screen = SCREEN.ATTRACT;
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
      this._push(SCREEN.MENU);
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
                              seed: d.seed, daily: d.date });
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
      });
    },
    /* Shared CORE handoff for playFromAttract/startDaily/playChallenge: reset
       the shell into GAME and hand args to main's onStart. Callers gate the
       screen check themselves before reaching here. */
    _playCore(args) {
      this.screen = SCREEN.GAME;
      this.inGame = true;
      this.subT = 0;
      this.repT = 0;
      this.repDir = 0;
      this._hot = false;
      this._taps = {};
      this.togT = -1;
      this.idleT = 0;
      if (onStart) onStart(args);
      return args;
    },
    /* M-quit: valid ONLY while in GAME with world paused (state passed in). */
    quitToMenu(worldState) {
      if (this.screen !== SCREEN.GAME || worldState !== "PAUSE") return false;
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
    _push(s) {
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
    /* §1 score edge, frame-polled: returns true once on PLAY|WIN→LOSE.
       Caller persists via scoreEntry(world). Latches worldState for KeyM. */
    noteWorldEdge(prevSt, st) {
      this.worldState = st || null;
      return (prevSt === "PLAY" || prevSt === "WIN") && st === "LOSE";
    },
  };
  /* ?render=3d / opts.render3d win at boot over the persisted r3d, so the blob
     is re-seeded IN MEMORY to whatever actually took effect — display and
     storage never disagree, and a URL override is never written to disk. */
  app.settings.r3d = app.render3d ? 1 : 0;
  app.settings.snd = app.sound ? 1 : 0;
  return app;
}
