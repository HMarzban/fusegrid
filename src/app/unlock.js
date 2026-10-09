/* Audio unlock (opening spec §5). Stays armed until the AudioContext is
   actually running: Escape and a touch pointerdown carry no activation, so
   their resume() leaves the ctx suspended and must not consume the listener.
   unlock() runs synchronously inside the handler (WebKit's rule). Hatch: the
   second counted press (a non-repeat keydown that is not Escape or a
   modifier/lock key, or a pointerup) that still finds the ctx not running
   calls onReady 250 ms later unless its own resume() lands first, so a ctx
   that never runs cannot strand the player; onReady's unlocked() gate skips
   the sting. onReady is the one-shot part: the listeners stay armed and keep
   calling unlock() until the ctx runs, so the music still joins.
   No WebAudio (Node, or unlock() false): the first gesture that is not
   Escape or a modifier/lock key, so the Node key matrix matches the browser. */
export const UNLOCK_EV = Object.freeze(["keydown", "pointerdown", "pointerup", "touchend", "click"]);
const isEsc = (ev) => !!ev && (ev.code === "Escape" || ev.key === "Escape");
const MODS = ["Shift", "Control", "Alt", "AltGraph", "Meta", "CapsLock", "Fn", "FnLock", "NumLock", "ScrollLock", "Symbol", "SymbolLock", "Hyper", "Super"];
const isMod = (ev) => !!ev && MODS.includes(ev.key);
export function armUnlock(target, audio, onReady) {
  let done = false,
    ready = false,
    presses = 0;
  const hs = UNLOCK_EV.map((ty) => [ty, (ev) => handle(ty, ev)]);
  const disarm = () => {
    if (target.removeEventListener) for (const [ty, fn] of hs) target.removeEventListener(ty, fn, true);
  };
  const fire = () => {
    if (ready) return;
    ready = true;
    onReady();
  };
  const finish = () => {
    if (done) return;
    done = true;
    disarm();
    fire();
  };
  function handle(ty, ev) {
    if (done) return;
    const esc = ty === "keydown" && isEsc(ev);
    const r = audio && audio.unlock ? audio.unlock() : false;
    if (r === false) return esc || (ty === "keydown" && isMod(ev)) ? undefined : finish();
    if (audio.unlocked()) return finish();
    if ((ty === "keydown" && !esc && !isMod(ev) && !(ev && ev.repeat)) || ty === "pointerup") presses++;
    if (presses >= 2 && !ready) setTimeout(fire, 250);
    Promise.resolve(r).then(() => audio.unlocked() && finish(), finish);
  }
  for (const [ty, fn] of hs) target.addEventListener(ty, fn, true);
  return () => {
    done = ready = true;
    disarm();
  };
}
