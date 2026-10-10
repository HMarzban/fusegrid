/* Run-end keys (GAME, world WIN / LOSE): Enter advances like Space, C copies
   the result line, B the board link. Every copy reports back on the overlay
   for TOAST_T seconds — "COPIED" only once the clipboard actually took it,
   "COPY FAILED" otherwise, so the note can never claim a copy that did not
   happen. Enter rides Input.pulse(): ONE fire edge for step(), never a latch,
   so the next room never inherits a held fire. STATS C rides the same note
   (main hangs the one toast on app.toast for shellview to paint). */
import { SCREEN } from "./menuapp.js";
import { encodeChallenge } from "./code.js";

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
export function endKey(code, app, world, input, toast, resultLine) {
  if (app.screen !== SCREEN.GAME || !ended(world)) return false;
  if (code === "Enter" || code === "NumpadEnter") { input.pulse(); return true; }
  if (code === "KeyC") { copyText(resultLine(), toast, "COPIED"); return true; }
  if (code === "KeyB") {
    copyText(BOARD_URL + encodeChallenge({ seed: world.seed, heat: world.heat, pact: world.pact, pace: world.pace }), toast, "BOARD LINK COPIED");
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
