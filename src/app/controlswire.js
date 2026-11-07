// The seam that wires CONTROLS into main, frameloop and unlock. Plan: docs/superpowers/plans/2026-11-02-controls-feature.md T11.
import { VIB_LEVELS, clampControls, loadControls, saveControls } from "./controls.js";
import { createPad } from "./gamepad.js";
import { createControlsPage } from "./controlspage.js";
import { createPadRouter } from "./padroute.js";
import { createRumble, padInfo } from "./rumble.js";
import { createHintDev, keyPress, pointerPress, wordsOf } from "./hints.js";

const LOST = "CONTROLLER LOST", BACK = "CONTROLLER BACK", READY = "CONTROLLER READY", NOTE_MS = 6000, TICK_GAP = 100, HELLO_QUIET = 300, ARM_MS = 1000;
export const NO_SOUND = "NO SOUND YET · PRESS A KEY OR TAP";
const on = (o, t, f, c) => { if (o && typeof o.addEventListener === "function") { o.addEventListener(t, f, c); return () => o.removeEventListener && o.removeEventListener(t, f, c); } return () => {}; };
const anyOf = (d) => d.up || d.down || d.left || d.right;
const browserKey = (c) => c === "Tab" || /^F\d+$/.test(c);
/* A press landing on none of these is off the plate: the plate only ever paints on a canvas, and a canvas tap is main's. */
const NOT_OFF = "canvas,#touchpad,#upd,#updbg,#ana,#load";
const offCanvas = (e) => !!(e.target && e.target.closest) && !(e.button > 0) && !e.target.closest(NOT_OFF);
const padsOf = () => (typeof navigator !== "undefined" && navigator && typeof navigator.getGamepads === "function" ? () => navigator.getGamepads() : null);

/** Mounts the pad, the page, the hints and rumble on the live shell. poll(t) belongs above the frame gate. */
export function mountControls({ win, doc, input, app, SCREEN, world, onPause, getGamepads, store, audio, unlock, setHints }) {
  const W = win !== undefined ? win : typeof window !== "undefined" ? window : null;
  const D = doc !== undefined ? doc : typeof document !== "undefined" ? document : null;
  const gp = getGamepads || padsOf();
  let c = loadControls(store), everSeen = false, lastT = 0, wasDir = false, wasPause = false;
  let pending = "", shownT = null, wasLost = false, wordDev = null, wordC = null, writing = false, keysAs = null;
  let held = false, tickT = -Infinity, didReset = false;
  let helloT = -Infinity, helloP = -Infinity, titleT = -Infinity, endT = -Infinity, showWas = false, endSt = world.state;
  const keys = new Set();
  const pad = createPad({ getGamepads: gp, dead: c.dead / 100, stick: c.stick });
  const hintDev = createHintDev({ lay: () => (D && D.body && D.body.dataset && D.body.dataset.lay) || "d" });
  const list = () => { try { return (gp && gp()) || []; } catch (_) { return []; } };
  const activePad = () => {
    const i = pad.snap().index;
    return i === null ? null : list()[i] || null;
  };
  const rumble = createRumble({
    level: () => c.vib,
    gamepad: activePad, // any mapping: a pad that offers an actuator buzzes
    playing: () => app.lastDev === "pad" && app.screen === SCREEN.GAME && !(D && D.hidden), // a keyboard player with an idle pad connected feels nothing; the VIBRATION row's test pulse and the menu ticks are apart
    state: () => world.state,
  });
  const stopRumble = () => { if (c.vib > 0) rumble.stop(); };
  const padView = () => {
    const s = pad.snap(), g = activePad(), ax = (g && g.axes) || [], a = c.stick === "R" ? 2 : 0;
    return { state: s.connected ? (s.mapping === "standard" ? "ready" : "nonstd") : everSeen ? "lost" : "none", name: s.name, rumble: rumble.supported(), effects: padInfo(g).effects, stickVal: [+ax[a] || 0, +ax[a + 1] || 0] };
  };
  /* The one live region (a11y R7.2): this page only, never in PLAY. A repeat gets a trailing no-break space, or a reader stays silent. */
  const sayEl = D && D.getElementById ? D.getElementById("ctlsay") : null;
  const onPage = () => app.onControls() && !(app.screen === SCREEN.GAME && world.state !== "PAUSE");
  const say = (s) => { if (sayEl && s && onPage()) sayEl.textContent = sayEl.textContent === s ? s + "\u00a0" : s; };
  const unsay = () => { if (sayEl && sayEl.textContent && !onPage()) sayEl.textContent = ""; };
  const play = (cue) => { if (audio && audio.play) audio.play(cue); };
  /* setKeyBinds lets held keys go, so only a changed key block may call it: a held ←→ on DEADZONE writes every repeat. */
  const apply = (n) => {
    c = n;
    const ks = JSON.stringify(n.key);
    if (ks !== keysAs) { keysAs = ks; input.setKeyBinds(n.key); }
    pad.setDead(n.dead / 100); pad.setStick(n.stick);
  };
  const page = createControlsPage({
    get: () => c,
    set: (n, how) => {
      const was = c.vib, m = clampControls(n), o = how || {};
      didReset = !!o.reset;
      saveControls(m, store); apply(m); writing = true; play("uiTog");
      if (m.vib === was) return;
      if (m.vib === 0) { held = false; rumble.stop(); } // entering OFF resets once; nothing plays after it
      else if (o.reset) held = false;
      else if (o.repeat || app._repHeld) held = true; // a hold repeat never buzzes; its last level plays once when the hold ends
      else rumble.test(lastT); // a reset never buzzes; rumble spaces the pulses and plays the last of a quick run
    },
    padView,
    say,
    device: () => hintDev.device(app.ctlT),
  });
  /* Cues live here, not in main's wrapper: a write is uiTog (a capture commit has no confirm behind it), anything else on a row is uiSel, a tab is uiMove as ←→ is, and a refusal is silent. */
  const conf0 = page.confirm, tab0 = page.tab;
  page.confirm = (t) => {
    writing = false; didReset = false;
    const r = conf0(t);
    if (r === "refused") { app._feel("deny"); return false; } // the page shows why
    if (r && !writing) play("uiSel");
    if (r && !didReset) app._feel("confirm"); // a reset never buzzes
    return r;
  };
  page.tab = (id) => { const r = tab0(id); if (r) { play("uiMove"); app._feel("move"); } return r; };
  app.controls = page;
  apply(c);
  input.gate = { canThrow: () => app.screen === SCREEN.GAME && world.state === "PLAY" && !!(world.players[0] && world.players[0].throw) };
  /* The one key entry: Input runs it first, before onPause and onUiKey, in the browser and under the Node stubs alike. */
  input.guard = (e) => {
    const code = e.code;
    if (!e.metaKey) keys.add(code);
    if (keyPress(e)) { app.lastDev = "key"; hintDev.key(e, app.ctlT); }
    const cap = app.capturing;
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return cap;
    if (cap && !browserKey(code)) e.preventDefault();
    return app.ctlKey(code, e.key);
  };
  /* Menu feels: the shell writes ONE ranked feel into app.feel at each call site; poll arms it before routing and plays it after. A hold repeat runs in app.update, outside that window, so it never counts. */
  const ended = () => app.screen === SCREEN.GAME && world.state !== "PLAY" && world.state !== "PAUSE";
  const padKey = (code) => {
    if (!input.onUiKey) return;
    if (code === "Enter" && ended()) endT = lastT; // the step after this poll flips WIN / LOSE to PLAY
    input.onUiKey(code);
  };
  /* A capture's pad press, typed by the page: a commit that writes, a cancel, or a refusal shown on the plate. */
  const padBtn = (id) => {
    const cap = app.capturing;
    writing = false;
    const r = app.ctlBtn(id), k = page.fed;
    const f = !cap ? "" : k === "refused" ? "deny" : k === "cancel" ? "back" : k === "commit" && writing ? "confirm" : "";
    if (f) app._feel(f);
    return r;
  };
  const router = createPadRouter({
    input, app, SCREEN, binds: () => c, world: () => world, onPause,
    onUiKey: padKey,
    page: { feedBtn: padBtn, get capturing() { return app.capturing; } }, // the shell's gate and its ctlT clock, never the rAF t
  });
  const blurAll = () => {
    if (input._onBlur) input._onBlur();
    if (pad.snap().connected) router.clear();
    keys.clear();
  };
  const offs = [
    on(W, "keyup", (e) => { keys.delete(e.code); }),
    on(W, "pointerdown", (e) => {
      const p = pointerPress(e);
      if (p) { app.lastDev = p; hintDev.pointer(e, app.ctlT); }
      else if (e && e.pointerType === "mouse") app.lastDev = "key"; // raw only: a click is no pad press, and the hints stay put
      if (onPage() && offCanvas(e)) tap({ off: 1 }); // the words say TAP OUTSIDE, and the viewport is bigger than the canvas
    }, true),
    on(W, "blur", blurAll),
    on(D, "visibilitychange", () => { blurAll(); if (D.hidden) stopRumble(); }),
  ];
  /* A tap resolved by controlsHit: a row is Enter on it; off the plate cancels a capture, else backs out. */
  function tap(h) {
    if (h.off) {
      if (app.capturing) page.cancel();
      else if (app.screen === SCREEN.GAME) app.pauseBack();
      else app.back();
      return;
    }
    if (app.capturing) return;
    if (h.tab) page.tab(h.tab);
    else if (h.row != null) { page.pick(h.row); app.confirm(); }
  }
  const syncWords = () => {
    const d = hintDev.device(app.ctlT);
    if (d === wordDev && c === wordC) return;
    wordDev = d; wordC = c;
    if (setHints) setHints(wordsOf(d, c));
  };
  /* One chip at the next non-PLAY moment; LOST holds while it is true, the others age out. */
  const noteTick = (t) => {
    const scr = app.screen;
    const open = scr !== SCREEN.INTRO && scr !== SCREEN.ATTRACT && !app.capturing && !(scr === SCREEN.GAME && world.state === "PLAY");
    if (!pending) { app.padNote = ""; return; }
    if (!open) {
      app.padNote = "";
      if (shownT !== null) { pending = ""; shownT = null; }
      return;
    }
    if (pending !== LOST && app.soundNote) shownT = null; // the sound note holds the foot: an unseen sign does not age
    else if (shownT === null) shownT = t;
    if (pending !== LOST && shownT !== null && t - shownT >= NOTE_MS) { pending = ""; shownT = null; app.padNote = ""; return; }
    app.padNote = pending === READY && rumble.supported() ? READY + " · VIBRATION " + VIB_LEVELS[c.vib] : pending;
  };
  syncWords();
  return {
    /** One pad poll; true on a real press, which wakes the shell and pokes the frame gate. */
    poll(t) {
      lastT = t;
      if (held && !app.repDir) { held = false; rumble.test(t); }
      if (D && D.hidden) { rumble.tick(t); return false; }
      const snap = pad.poll(t), pressed = snap.press.length > 0, dir = anyOf(snap.menuDir);
      if (pressed || (dir && !wasDir)) app.lastDev = "pad"; // before routing, or SOUTH could consent
      wasDir = dir;
      hintDev.pad(snap, app.ctlT);
      if (snap.found) { everSeen = true; pending = wasLost ? BACK : READY; shownT = null; wasLost = false; }
      if (snap.lost) {
        if (app.lastDev === "pad" && app.screen === SCREEN.GAME && world.state === "PLAY" && !app.pauseView) onPause();
        pending = LOST; shownT = null; wasLost = true;
      }
      if (pressed && app.screen === SCREEN.INTRO && !showWas) titleT = t;
      if (pressed && unlock && !(app.padCards || []).some((k) => k.live(true))) unlock(); // the title starts here; a later press retries the context. A press a live card answers starts nothing behind it
      /* The step after a run-end press flips WIN / LOSE to PLAY in the loop, after that poll: this one sees it. */
      const relaunch = app.screen === SCREEN.GAME && endSt !== "PLAY" && endSt !== "PAUSE" && world.state === "PLAY" && t - endT < ARM_MS;
      const vib0 = c.vib;
      app.feel = "";
      const edge = router.route(snap, app.ctlT).edge;
      if (edge) app.wake();
      const pz = app.screen === SCREEN.GAME && world.state === "PAUSE";
      if (pz && !wasPause) stopRumble();
      wasPause = pz;
      /* One feel a poll, after PAUSE's stop so it survives it; hello takes a free poll only, and only it ignores lastDev: the pad just arrived. */
      const show = app.screen === SCREEN.INTRO && (app.introStage === 1 || !!app._showPending); // a 3D board still loading marks the show pending on the press
      const okHello = app.screen !== SCREEN.ATTRACT && !(app.screen === SCREEN.GAME && world.state === "PLAY");
      const due = okHello && (snap.found || t - helloP < ARM_MS);
      if (relaunch) app._feel("launch");
      if (show && !showWas && t - titleT < ARM_MS && !due && t - helloT >= HELLO_QUIET) app._feel("enter");
      let f = app.feel;
      app.feel = "";
      if (f === "confirm" && c.vib !== vib0) f = ""; // a VIBRATION change plays its own test pulse
      if (f) {
        if (snap.found && okHello) helloP = t; // blocked: it waits for the next free poll
        if (app.lastDev === "pad" && ((f !== "move" && f !== "confirm") || lastT - tickT >= TICK_GAP) && rumble.menu(f, lastT)) tickT = lastT;
      } else if (due) {
        const ok = rumble.menu("hello", lastT);
        if (ok) helloT = t;
        if (ok || snap.found) helloP = -Infinity; // a first try that finds no motor is not retried
      }
      if (relaunch) endT = -Infinity;
      showWas = show; endSt = world.state;
      rumble.tick(t);
      app.soundNote = app.lastDev === "pad" && app.sound && audio && audio.unlocked && !audio.unlocked() ? NO_SOUND : "";
      noteTick(t);
      unsay();
      syncWords();
      return edge || (pressed && app.screen === SCREEN.INTRO);
    },
    /** Feeds rumble; call before the renderer drains world.events. */
    afterStep(events, player) { rumble.feed(events, lastT, player, world.lives); },
    /** What the active pad offers; window.__GAME__.ctl.rumbleInfo() under ?debug=1. */
    rumbleInfo() { return padInfo(activePad()); },
    /** Any key or pad button down: the capture's arm clock. */
    anyDown() { return keys.size > 0 || pad.snap().anyDown; },
    tap,
    /** The device the hints name now. */
    device() { return hintDev.device(app.ctlT); },
    blurAll,
    capturing() { return app.capturing; },
    dispose() { for (const f of offs) f(); input.guard = null; input.gate = null; if (setHints) setHints(null); },
  };
}
