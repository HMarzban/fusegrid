/* NEW VERSION READY card (owner 2026-10-19: "let the users to know and hit the
   button to reload"). sw.js installs a new shell and WAITS; register.js hands
   the waiting registration here. The card is a DOM element (a real tap target,
   no per-look hit map, renderers untouched) shown only where a reload cannot
   cost a run: menus and a finished run's WIN / LOSE, never INTRO, ATTRACT,
   live PLAY or PAUSE. U or the button posts SKIP_WAITING; register.js's one
   controllerchange listener does the single reload. LATER snoozes until the
   next return to the menus from a run (or the next boot). No store. */
import { registerSW, applyUpdate } from "../pwa/register.js";

/* Pure: may the card show on this frame? */
export function updVisible(screen, state, runEnd, S) {
  if (screen === S.GAME) return (state === "WIN" || state === "LOSE") && !!runEnd;
  return screen !== S.BOOT && screen !== S.INTRO && screen !== S.ATTRACT;
}

export function mountUpdate(get, env) {
  const doc = typeof document !== "undefined" ? document : null;
  let reg = null,
    snoozed = false,
    wasGame = false,
    card = null;
  const go = () => reg && applyUpdate(reg);
  const build = () => {
    card = doc.createElement("div");
    card.id = "upd";
    card.hidden = true;
    card.setAttribute("role", "status");
    card.setAttribute("aria-live", "polite");
    card.innerHTML = '<b>NEW VERSION READY</b><i>Reload to play the latest build. Your scores stay.</i>' +
      '<span class="go" role="button" tabindex="-1" aria-label="Reload to update"><kbd>U</kbd>RELOAD</span>' +
      '<span class="later" role="button" tabindex="-1" aria-label="Later">LATER</span>';
    const tap = (sel, fn) => {
      const el = card.querySelector(sel);
      el.addEventListener("pointerdown", (e) => e.stopPropagation());
      el.addEventListener("pointerup", (e) => { e.stopPropagation(); fn(); });
    };
    tap(".go", go);
    tap(".later", () => { snoozed = true; card.hidden = true; });
    doc.body.appendChild(card);
    doc.addEventListener("keydown", (e) => { if (e.code === "KeyU" && !e.repeat && card && !card.hidden) go(); });
  };
  const tick = () => {
    const g = get();
    if (!g || !g.app || !card) return;
    const { app, world, isRunEnd, SCREEN } = g,
      inGame = app.screen === SCREEN.GAME;
    if (wasGame && !inGame) snoozed = false;
    wasGame = inGame;
    const show = !!reg && !snoozed && updVisible(app.screen, world.state, isRunEnd(world), SCREEN);
    card.dataset.ctx = inGame ? "end" : "menu";
    if (card.hidden === show) card.hidden = !show;
  };
  const ok = registerSW({ ...(env || {}), onUpdate: (r) => { reg = r; if (doc && !card) build(); tick(); } });
  if (ok && doc) setInterval(tick, 250);
  return { tick, get ready() { return !!reg; } };
}
