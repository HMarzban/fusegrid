/* Audio power (graphics spec §4.3). A hidden page or pagehide suspends the
   AudioContext through audio.sleep(); visible with SOUND on resumes it through
   audio.wake(), which only undoes its own sleep. A resume refused outside a
   gesture (iOS) is retried by persistent capture listeners on the next
   activating gesture while audio.wantWake() holds. Never arms the unlock and
   never fires its onReady, the jingle or the show; every audio method is
   feature-checked on each call, and doc / win may be null or listener-less. */
export const WAKE_EV = Object.freeze(["pointerup", "touchend", "click", "keydown"]);
const fn = (a, k) => !!a && typeof a[k] === "function";
export function mountAudioPower(win, doc, audio, isOn) {
  const on = () => typeof isOn !== "function" || !!isOn();
  const sleep = () => fn(audio, "sleep") && audio.sleep();
  const wake = () => on() && fn(audio, "wake") && audio.wake();
  const vis = () => (doc.hidden || doc.visibilityState === "hidden" ? sleep() : wake());
  const retry = () => fn(audio, "wantWake") && audio.wantWake() && wake();
  const hs = [];
  const add = (t, ty, h, cap) => {
    if (!t || typeof t.addEventListener !== "function") return;
    t.addEventListener(ty, h, cap);
    hs.push([t, ty, h, cap]);
  };
  add(doc, "visibilitychange", vis, false);
  add(win, "pagehide", sleep, false);
  for (const ty of WAKE_EV) add(win, ty, retry, true);
  return () => {
    for (const [t, ty, h, cap] of hs.splice(0)) if (typeof t.removeEventListener === "function") t.removeEventListener(ty, h, cap);
  };
}
