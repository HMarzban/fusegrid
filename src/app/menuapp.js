// APP SHELL STATE MACHINE — pure logic, no canvas/DOM. Owns BOOT->INTRO->MENU
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
});
export const ITEMS = Object.freeze([
  "START GAME",
  "LEVEL SELECT",
  "RENDER",
  "SOUND",
  "HOW TO PLAY",
  "ITEMS",
  "ENEMIES",
  "HIGH SCORES",
  "SOURCE",
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
  const app = {
    screen: o.autoplay ? SCREEN.GAME : SCREEN.INTRO,
    cursor: 0,
    level: Math.min(roomCap(o.pactUnlocked), Math.max(1, o.level | 0 || 1)),
    heat: clampHeat(o.heat),
    pact: clampPact(o.pact),
    pace: clampPace(o.pace),
    pactUnlocked: !!o.pactUnlocked,
    sound: o.sound !== false,
    render3d: !!o.render3d,
    inGame: !!o.autoplay,
    subT: 0,
    repT: 0,
    repDir: 0,
    repAxis: 0,
    prevConfirm: false,
    idleT: 0,
    togT: -1, // MENU toggle-flash timestamp (§3): subT at last RENDER/SOUND
    // flip, -1 sentinel otherwise; cleared wherever subT resets
    worldState: null,
    _taps: {},
    /* Advance the shell by dt seconds. Reads held axes + confirmHeld only. */
    update(dt, input) {
      const d = Math.max(0, dt || 0);
      const ch = !!(input && input.confirmHeld);
      const rising = ch && !this.prevConfirm;
      this.prevConfirm = ch;
      this.subT += d;
      if (this.screen === SCREEN.GAME) {
        this.repT = 0;
        this.repDir = 0;
        this._hot = false;
        this._taps = {};
        return;
      }
      if (this.screen === SCREEN.ATTRACT) return; // subT already advanced -> hint blink
      const ax = (input && input.input) || {};
      let dir = 0,
        axis = 0;
      if (this.screen === SCREEN.MENU) dir = ax.up ? -1 : ax.down ? 1 : 0;
      else if (this.screen === SCREEN.LEVEL) {
        if (ax.left || ax.right) {
          dir = ax.left ? -1 : 1;
          axis = 0;
        } else if (ax.up || ax.down) {
          dir = ax.up ? -1 : 1;
          axis = 1;
        }
      }
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
      if (rising) this.confirm();
      this._taps = {};
      if (this.screen === SCREEN.MENU) {
        this.idleT += d;
        if (this.idleT >= IDLE_T) this.enterAttract();
      } else this.idleT = 0;
    },
    /* Discrete key tap (Enter/Esc/Backspace/M + arrows-as-tap fallback). */
    key(code) {
      if (this.screen === SCREEN.ATTRACT) return this.exitAttract();
      this.idleT = 0;
      switch (code) {
        case "Enter":
        case "NumpadEnter":
          return this.confirm();
        case "Escape":
        case "Backspace":
          if (this.screen === SCREEN.INTRO) return this.skip();
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
        case "BracketLeft":
          return this.adjustPace(-1);
        case "BracketRight":
          return this.adjustPace(1);
      }
      return false;
    },
    _tapMove(dir, lat) {
      this.idleT = 0;
      if (this.screen === SCREEN.INTRO) return this.skip();
      if (this.screen === SCREEN.MENU && !lat && this.move(dir, 0)) {
        this._taps[dir + ":0"] = true;
        return true;
      }
      if (this.screen === SCREEN.LEVEL && this.move(dir, lat ? 0 : 1)) {
        this._taps[dir + ":" + (lat ? 0 : 1)] = true;
        return true;
      }
      return false;
    },
    confirm() {
      if (this.screen === SCREEN.ATTRACT) return this.exitAttract();
      this.idleT = 0;
      switch (this.screen) {
        case SCREEN.INTRO:
          return this.skip();
        case SCREEN.MENU: {
          switch (ITEMS[this.cursor]) {
            case "START GAME":
              return this.startRun();
            case "LEVEL SELECT":
              return this._push(SCREEN.LEVEL);
            case "RENDER":
              this.render3d = !this.render3d;
              this.togT = this.subT;
              return true;
            case "SOUND":
              if (audio) this.sound = !!audio.toggle();
              else this.sound = !this.sound;
              this.togT = this.subT;
              return true;
            case "HOW TO PLAY":
              return this._push(SCREEN.HOWTO);
            case "ITEMS":
              return this._push(SCREEN.ITEMS);
            case "ENEMIES":
              return this._push(SCREEN.ENEMIES);
            case "HIGH SCORES":
              return this._push(SCREEN.SCORES);
            case "SOURCE":
              if (onSource) onSource();
              return true;
          }
          return false;
        }
        case SCREEN.LEVEL:
          return this.startRun();
        case SCREEN.HOWTO:
        case SCREEN.SCORES:
        case SCREEN.ITEMS:
        case SCREEN.ENEMIES:
          return this.back();
      }
      return false;
    },
    back() {
      if (
        this.screen === SCREEN.LEVEL ||
        this.screen === SCREEN.HOWTO ||
        this.screen === SCREEN.SCORES ||
        this.screen === SCREEN.ITEMS ||
        this.screen === SCREEN.ENEMIES
      )
        return this._push(SCREEN.MENU);
      return false;
    },
    skip() {
      return this.screen === SCREEN.INTRO ? this._push(SCREEN.MENU) : false;
    },
    move(dir, axis) {
      this.idleT = 0;
      if (this.screen === SCREEN.MENU) {
        this.cursor = (this.cursor + dir + ITEMS.length) % ITEMS.length;
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
    togglePactBit(bit) {
      this.idleT = 0;
      if (this.screen !== SCREEN.LEVEL || !this.pactUnlocked) return false;
      this.pact = togglePact(this.pact, bit);
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
  return app;
}
