/* Run-end keys (GAME, world WIN / LOSE): Enter advances like Space, C copies
   the result line, B the board link. Every copy reports back on the overlay
   for TOAST_T seconds — "COPIED" only once the clipboard actually took it,
   "COPY FAILED" otherwise, so the note can never claim a copy that did not
   happen. Enter rides Input.pulse(): ONE fire edge for step(), never a latch,
   so the next room never inherits a held fire. STATS C rides the same note
   (main hangs the one toast on app.toast for shellview to paint).
   Esc (R19, v202 Task 5.2) goes to MENU at a run end only: a finale WIN takes
   the same fire edge as Enter (the sim's MENU edge is where main saves the
   finale), GAME OVER calls main's toMenu (the LOSE edge already saved the run);
   a mid-run WIN is no run end, so Esc does nothing there. ↑ / ↓ turn a paged
   end screen's page (act.page; the D-PAD and the ▲ / ▼ taps send the same). */
import { SCREEN } from "./menuapp.js";
import { encodeChallenge } from "./code.js";
import { isFinale } from "../core/config.js";

export const TOAST_T = 1.5;
export const BOARD_URL = "https://hmarzban.github.io/fusegrid/?code=";
export function createToast() {
  return { s: "", ok: true, t: 0 };
}
export function copyText(text, toast, okMsg) {
  const set = (ok) => { if (toast) { toast.s = ok ? okMsg : "COPY FAILED"; toast.ok = ok; toast.t = TOAST_T; } };
  const cb = typeof navigator !== "undefined" && navigator.clipboard;
  if (!cb || typeof cb.writeText !== "function") return set(false);
  try { Promise.resolve(cb.writeText(text)).then(() => set(true), () => set(false)); } catch (e) { set(false); }
}
const ended = (world) => world.state === "WIN" || world.state === "LOSE";
const finale = (world) => world.state === "WIN" && (isFinale(world.level) || !!world.finale);
export function endKey(code, app, world, input, toast, resultLine, act = {}) {
  if (app.screen !== SCREEN.GAME || !ended(world)) return false;
  if (code === "Enter" || code === "NumpadEnter") { input.pulse(); return true; }
  if (code === "Escape") {
    if (world.state === "LOSE") { if (act.menu) act.menu(); return true; }
    if (finale(world)) { input.pulse(); return true; }
    return false;
  }
  if (code === "ArrowUp" || code === "ArrowDown") { if (act.page) act.page(code === "ArrowUp" ? -1 : 1); return true; } // a paged run end (endgeom on a short box)
  if (code === "KeyC") { copyText(resultLine(), toast, "COPIED"); return true; }
  if (code === "KeyB") {
    copyText(BOARD_URL + encodeChallenge({ seed: world.seed, heat: world.heat, pact: world.pact, pace: world.pace, gen: world.gen }), toast, "BOARD LINK COPIED");
    return true;
  }
  return false;
}
export function toastTick(toast, world, dt, app) {
  const on = app ? (app.screen === SCREEN.GAME && ended(world)) || app.screen === SCREEN.STATS : ended(world);
  toast.t = on ? Math.max(0, toast.t - dt) : 0;
}
export function toastOf(toast) {
  return toast.t > 0 ? { s: toast.s, ok: toast.ok } : null;
}
