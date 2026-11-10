/* The one tap router on #c and #sh, moved out of main.js whole (v202 Task 0.4).
   src/app never imports src/render, so main hands the hit functions and the
   layout in (hit); kind and ctl are getters, read at the tap. */
import { ITEMS, SCREEN } from "./menuapp.js";

/* pointer outside GAME = skip (INTRO) / confirm (menus) / play (ATTRACT).
   C1 single-fire: Input's fire latch listens on the SAME event (registered
   first, in the constructor), so swallow it here — otherwise the latched
   intent.fire re-enters as a rising-edge confirm on the next frame
   (auto-start after skip, toggles bouncing back, subscreens bouncing). */
export function mountPointer({ canvas, fit, input, app, world, kind, ctl, hit: { overlayBox, pauseHit, touchLay, controlsHit, dims, menuHit, settingsHit, graphicsHit, guideHit, levelHit, scoresHit, statsHit, layout: menuLayout } }) {
  let statsC = false; // a touch pointerdown carries no activation, so a touch C tap copies on its pointerup
  const onDown = (ev) => {
    if (app.screen === SCREEN.GAME) {
      if (world.state !== "PAUSE") return;
      input._intent.fire = false;
      /* Client px times k (buffer px per CSS px) of the OVERLAY canvas —
         never #gl's Retina drawing buffer, which the wrapper owns. */
      const r = canvas.getBoundingClientRect();
      const k = canvas.width / (r.width || canvas.width);
      const px = (ev.clientX - r.left) * k,
        py = (ev.clientY - r.top) * k;
      const B = overlayBox(kind());
      if (app.pauseView === 3) return void ctl().tap(controlsHit(app.controls.view(app.ctlT), px, py, canvas, kind(), true));
      if (app.pauseView) {
        const row = (app.pauseView === 2 ? graphicsHit : settingsHit)(px, py, menuLayout(B.w, B.h), 0, touchLay(canvas));
        if (row < 0) { if (row === -1) app.pauseBack(); } // -2: on the plate, off the rows (inert)
        else {
          app[app.pauseView === 2 ? "gfxRow" : "optRow"] = row;
          app.confirm();
        }
        return;
      }
      const row = pauseHit(px, py, B, touchLay(canvas));
      if (row >= 0) {
        app.pauseCursor = row;
        app.confirm();
      }
      return;
    }
    input._intent.fire = false;
    const cv = (ev.currentTarget !== canvas && fit && fit.box()) || canvas; // a touch-portrait shell page is drawn (and so tapped) on #sh's box
    if (app.screen === SCREEN.ATTRACT) {
      app.playFromAttract();
      return;
    }
    if (app.screen === SCREEN.INTRO) app.skipShow();
    else if (app.screen === SCREEN.CONTROLS) { const r = cv.getBoundingClientRect(), k = cv.width / (r.width || cv.width); ctl().tap(controlsHit(app.controls.view(app.ctlT), (ev.clientX - r.left) * k, (ev.clientY - r.top) * k, cv, kind(), false)); }
    else if (app.screen === SCREEN.SETTINGS || app.screen === SCREEN.MENU || app.screen === SCREEN.GRAPHICS || app.screen === SCREEN.GUIDE) {
      /* One rule with PAUSE: tap a row = Enter on it; off the rows a page
         backs out and a root list (MENU, the PAUSE list) does nothing. Client px map through
         the CSS scale of the OVERLAY canvas — never #gl's Retina buffer. */
      const menu = app.screen === SCREEN.MENU, gx = app.screen === SCREEN.GRAPHICS, gd = app.screen === SCREEN.GUIDE;
      const r = cv.getBoundingClientRect();
      const k = cv.width / (r.width || cv.width);
      const { cw, ch, lg } = dims(cv, kind());
      const row = (menu ? menuHit : gx ? graphicsHit : gd ? guideHit : settingsHit)(
        (ev.clientX - r.left) * k,
        (ev.clientY - r.top) * k,
        menuLayout(cw, ch, lg),
        ITEMS.length,
        touchLay(cv),
      );
      if (row < 0) return menu || row < -1 ? undefined : app.back(); // -2: on the plate, off the rows (inert)
      app[menu ? "cursor" : gx ? "gfxRow" : gd ? "guideRow" : "optRow"] = row;
      app.confirm();
    } else if (app.screen === SCREEN.LEVEL || app.screen === SCREEN.SCORES) {
      /* A chip / tab tap sets it (modes ride their 1–5 keys); LEVEL: only START starts, a locked room shows its card, the rest of the plate is inert, outside backs out. */
      const r = cv.getBoundingClientRect(), k = cv.width / (r.width || cv.width), { cw, ch } = dims(cv, kind()), x = (ev.clientX - r.left) * k, y = (ev.clientY - r.top) * k, L = menuLayout(cw, ch);
      // every chip is ONE call through the cued key path: one uiMove per change, none on the chip already set
      if (app.screen === SCREEN.SCORES) { const i = scoresHit(x, y, L, touchLay(cv)); return i >= 0 ? void app.move(i - app.scoreHeat, 0) : i === -1 ? app.confirm() : null; }
      const h = levelHit(x, y, L, app.pactUnlocked, touchLay(cv));
      if (h.k === "room") app.move(h.i + 1 - app.level, 0); else if (h.k === "heat") app.move(app.heat - h.i, 1); else if (h.k === "pace") app.adjustPace(h.i - 1 - app.pace); else if (h.k === "mode") input.onUiKey("Digit" + (h.i + 1)); else if (h.k === "lock") { app.lockR = h.i + 1; app.lockT = app.subT; } else if (h.k === "back") app.back(); else if (h.k === "start") app.confirm();
    } else if (app.screen === SCREEN.STATS) {
      const r = cv.getBoundingClientRect(), k = cv.width / (r.width || cv.width), { cw, ch } = dims(cv, kind());
      const hit = statsHit((ev.clientX - r.left) * k, (ev.clientY - r.top) * k, menuLayout(cw, ch), app.resetArm);
      if (hit === "KeyC" && ev.pointerType && ev.pointerType !== "mouse") statsC = true; else if (hit) input.onUiKey(hit); else if (app.resetArm) app.resetArm = false; else app.confirm(); // a label tap IS its key (C copies + notes)
    } else app.confirm();
  };
  for (const el of [canvas, fit && fit.sh]) if (el) {
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", () => { if (statsC && app.screen === SCREEN.STATS) input.onUiKey("KeyC"); statsC = false; });
    for (const t of ["pointercancel", "pointerleave"]) el.addEventListener(t, () => { statsC = false; }); // a cancelled C touch never copies on a later pointerup
  }
}
