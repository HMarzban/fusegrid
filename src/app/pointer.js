/* The one tap router on #c and #sh, moved out of main.js whole (v202 Task 0.4).
   src/app never imports src/render, so main hands the hit functions and the
   layout in (hit); kind and ctl are getters, read at the tap. */
import { GUIDE_ROWS, ITEMS, LEVEL_ROWS, RECORD_SCREENS, SCREEN, isRecords } from "./menuapp.js";

/* LEVEL SELECT: the row each levelHit kind belongs to (a locked tile is on the LEVEL row too). */
const LEVEL_TAP_ROW = Object.freeze({ room: "LEVEL", lock: "LEVEL", heat: "DIFFICULTY", pace: "GAME SPEED", mode: "MODIFIERS", mods: "MODIFIERS", start: "START" });

/* pointer outside GAME = skip (INTRO) / confirm (menus) / play (ATTRACT).
   C1 single-fire: Input's fire latch listens on the SAME event (registered
   first, in the constructor), so swallow it here — otherwise the latched
   intent.fire re-enters as a rising-edge confirm on the next frame
   (auto-start after skip, toggles bouncing back, subscreens bouncing). */
export function mountPointer({ canvas, fit, input, app, world, kind, ctl, hit: { overlayBox, pauseHit, touchLay, controlsHit, dims, menuHit, settingsHit, graphicsHit, guideHit, enemiesHit, guideReadHit, levelHit, scoresHit, statsHit, recTabHit, recPageHit = () => 0, layout: menuLayout } }) {
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
        /* the PAUSE view's box: overlayBox at #c's CSS scale (the touch floors), paused (the HUD band kept clear) and the focused row (its page is the one on screen) */
        const g2 = app.pauseView === 2, PL = { ...menuLayout(B.w, B.h, undefined, dims(canvas, kind()).css), paused: true, focus: g2 ? app.gfxRow : app.optRow };
        const row = g2 ? graphicsHit(px, py, PL, 0, touchLay(canvas)) : settingsHit(px, py, PL, app.optRows(), touchLay(canvas)); // an index into the visible rows, what optRow is (R11)
        if (row && typeof row === "object") { app[g2 ? "gfxRow" : "optRow"] = row.row; return; } // a page key: focus the first row of the page it opens
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
    const cv = (ev.currentTarget !== canvas && fit && fit.box()) || canvas; // a shell page is drawn (and so tapped) on #sh's box, on every layout that has one
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
      const { cw, ch, lg, css } = dims(cv, kind());
      const L = menuLayout(cw, ch, lg, css); // css: the MENU phone column's CSS px per box unit (shellview dims)
      const row = (menu ? menuHit : gx ? graphicsHit : gd ? guideHit : settingsHit)(
        (ev.clientX - r.left) * k,
        (ev.clientY - r.top) * k,
        menu || gd ? L : { ...L, focus: gx ? app.gfxRow : app.optRow }, // SETTINGS / GRAPHICS: the focused row, whose page is on screen
        app.screen === SCREEN.SETTINGS ? app.optRows() : ITEMS.length, // SETTINGS maps into the visible rows (R11)
        touchLay(cv),
        ...(gd ? [app.guideRow] : []), // GUIDE: the focused door's page is the one on screen
      );
      if (gd && row <= -10) return void app.guideFocus(-10 - row); // a GUIDE page key: that page's first door, focused (no confirm)
      if (row && typeof row === "object") return void (app[gx ? "gfxRow" : "optRow"] = row.row); // a page key: focus the first row of the page it opens
      if (row < 0) return menu || row < -1 ? undefined : app.back(); // -2: on the plate, off the rows (inert)
      app[menu ? "cursor" : gx ? "gfxRow" : gd ? "guideRow" : "optRow"] = row;
      app.confirm();
    } else if (app.screen === SCREEN.ENEMIES) {
      /* a points value (a touch layout's whole foe slot) focuses that foe and opens its tooltip; any other tap closes an open one, else backs out
         (a read-only page); -2: the page is still loading, inert */
      const r = cv.getBoundingClientRect(), k = cv.width / (r.width || cv.width), { cw, ch, lg, css } = dims(cv, kind());
      const i = enemiesHit((ev.clientX - r.left) * k, (ev.clientY - r.top) * k, menuLayout(cw, ch, lg, css), touchLay(cv), app.foeRow, app.foeTip);
      if (i >= 0) app.foeTap(i); else if (i <= -10) app.foeFocus(-10 - i); else if (i !== -2 && !app.foeClose()) app.back(); // -10 - i: a page key, onto that page's first foe
    } else if (app.screen === SCREEN.HOWTO || app.screen === SCREEN.ITEMS || app.screen === SCREEN.FLOOR) {
      /* read-only: a ▲ / ▼ page key steps the pages where the box pages it; any other tap backs out; -2: still loading, inert */
      const r = cv.getBoundingClientRect(), k = cv.width / (r.width || cv.width), { cw, ch, lg, css } = dims(cv, kind());
      const h = guideReadHit((ev.clientX - r.left) * k, (ev.clientY - r.top) * k, menuLayout(cw, ch, lg, css), touchLay(cv), GUIDE_ROWS[app.screen === SCREEN.HOWTO ? 0 : app.screen === SCREEN.ITEMS ? 1 : 3], app.infoPg);
      if (h === "up" || h === "down") app.infoStep(h === "up" ? -1 : 1); else if (h !== -2) app.confirm();
    } else if (app.screen === SCREEN.LEVEL || isRecords(app.screen)) {
      /* A chip / tab tap sets it (modifiers ride their 1–5 keys); LEVEL: the tap first focuses the row it touched (levelFocus), only START starts, a locked level flashes its refusal, the MODIFIERS door opens or closes the list, the rest of the plate is inert, outside or BACK backs out (an open list closes first). */
      const r = cv.getBoundingClientRect(), k = cv.width / (r.width || cv.width), { cw, ch, lg, css } = dims(cv, kind()), x = (ev.clientX - r.left) * k, y = (ev.clientY - r.top) * k, p = RECORD_SCREENS.indexOf(app.screen), L = p < 0 ? menuLayout(cw, ch) : menuLayout(cw, ch, lg, css); // RECORDS: the page's own frame (pages/records.js), as MENU's
      // every chip is ONE call through the cued key path: one uiMove per change, none on the chip already set
      const ti = p < 0 ? -1 : recTabHit(x, y, L, p, touchLay(cv));
      if (ti === -2) return; // the RECORDS page module is still loading: inert
      if (ti >= 0 && app.screen === SCREEN.STATS && app.resetArm) return void (app.resetArm = false); // armed: the confirm plate is modal; a tab tap only cancels it
      if (ti >= 0) return void app.recTab(ti - p); // a RECORDS tab: that tab, the tab row focused; recTab disarms an armed STATS, the tab shown included
      const pk = p >= 0 && !(app.screen === SCREEN.STATS && app.resetArm) ? recPageHit(x, y, L, touchLay(cv), ["scores", "stats", "medals"][p]) : 0;
      if (pk) return void app.recPageStep(pk); // a small phone's page keys (records.js PAGER), any RECORDS tab; tap mode keeps them
      if (app.screen === SCREEN.SCORES) { const i = scoresHit(x, y, L, touchLay(cv)); if (i >= 0) app.recFocus = 1; return i >= 0 ? void app.move(i - app.scoreHeat, 0) : i === -1 ? app.confirm() : null; } // a difficulty tab is in the body
      if (app.screen === SCREEN.STATS) {
        const hit = statsHit(x, y, L, app.resetArm, app.recFocus === 0, touchLay(cv)); // KeyC / KeyR / KeyT, "back", "plate" (inert) or, armed, "cancel"
        if (hit === "KeyC" && ev.pointerType && ev.pointerType !== "mouse") { statsC = true; app.resetArm = false; } // copies on pointerup; disarmed now, so a cancelled C still cancels
        else if (/^Key/.test(hit)) input.onUiKey(hit); // a label or key tap IS its key (C copies + notes, R arms or erases)
        else if (app.resetArm) app.resetArm = false;
        else if (hit === "back") app.confirm();
        return;
      }
      if (app.screen === SCREEN.TROPHIES) return void app.confirm(); // read-only: off a tab, any tap backs out
      const h = levelHit(x, y, menuLayout(cw, ch, lg, css), app.pactUnlocked, touchLay(cv), app.modOpen, LEVEL_ROWS[app.levelRow | 0]), row = LEVEL_TAP_ROW[h.k], was = app.modOpen; // the page's own geometry: its box's css (the touch floors) and the list open or shut
      if (row) app.levelFocus(LEVEL_ROWS.indexOf(row), h.k === "mode" ? h.i : -1);
      if (h.k === "room") app.move(h.i + 1 - app.level, 0); else if (h.k === "heat") app.move(h.i - app.heat, 0); else if (h.k === "pace") app.adjustPace(h.i - 1 - app.pace); else if (h.k === "mode") input.onUiKey("Digit" + (h.i + 1)); else if (h.k === "mods") { if (was) app.back(); else app.confirm(); } else if (h.k === "page") app.levelFocus(LEVEL_ROWS.indexOf(h.row)); else if (h.k === "lock") { app.lockR = h.i + 1; app.lockT = app.subT; } else if (h.k === "back") app.back(); else if (h.k === "start") app.confirm();
    } else app.confirm();
  };
  for (const el of [canvas, fit && fit.sh]) if (el) {
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", () => { if (statsC && app.screen === SCREEN.STATS) input.onUiKey("KeyC"); statsC = false; });
    for (const t of ["pointercancel", "pointerleave"]) el.addEventListener(t, () => { statsC = false; }); // a cancelled C touch never copies on a later pointerup
    if (el !== canvas) el.addEventListener("contextmenu", (e) => e.preventDefault()); // #c's camera controls swallow it there; on #sh a right-click confirms a row as it did on #c, with no browser menu
  }
}
