// The router from pad state to Input and the shell. Plan: docs/superpowers/plans/2026-11-02-controls-feature.md T7.
import { SCREEN as SHELL } from "./menuapp.js";

const NONE = Object.freeze({ up: false, down: false, left: false, right: false });
const TAPS = [["up", "ArrowUp"], ["right", "ArrowRight"], ["down", "ArrowDown"], ["left", "ArrowLeft"]];
const BRACKET = { SHL: "BracketLeft", SHR: "BracketRight" };
const LATERAL = { SHL: "ArrowLeft", SHR: "ArrowRight" };
const DPAD = ["dU", "dD", "dL", "dR"];
const END_COPY = { W: "KeyC", N: "KeyB" }, STATS_KEY = { N: "KeyT", W: "KeyC" }, TRIGGER = { TRL: -1, TRR: 1 };
const CARD_GUARD = 500; // ms: a press begun sooner after a card shows answers nothing
const isClear = (d) => !d.up && !d.down && !d.left && !d.right;

/** The layer a press belongs to; the backdrop world sits in PLAY behind every menu, so the screen decides first. */
export function layerOf(app, world) {
  return app.screen === SHELL.GAME && world.state === "PLAY" && !app.pauseView ? "play" : "menu";
}

/** Pad to Input and shell, once a poll. A press acts only in the layer it began in; route returns edge = a real press. */
export function createPadRouter({ input, app, SCREEN, binds, world, onPause, onUiKey, page }) {
  let was = null, fireBy = null, remBy = null, card = null, cardT = 0;
  let soft = false, hard = false, deaf = false, woke = false, prev = NONE, benchHeld = false;

  const drop = () => {
    if (fireBy !== null) { fireBy = null; input.gpFire(false); }
    if (remBy !== null) { remBy = null; input.gpRemote(false); }
  };
  const sig = () => app.screen + "|" + app.pauseView + "|" + world().state;

  /* app.padCards: the cards a pad may answer, {live(padLast), press(id)}. Never the consent card. */
  const liveCard = (t) => {
    const c = (app.padCards || []).find((k) => k.live(app.lastDev === "pad")) || null;
    if (c !== card) { card = c; cardT = t; }
    return c;
  };

  function playPress(press) {
    const B = binds().pad;
    if (press.some((id) => id === "START" || id === B.PAUSE)) return void onPause();
    if (press.includes(B.BOMB)) { fireBy = B.BOMB; input.gpFire(true); }
    if (press.includes(B.REMOTE)) { remBy = B.REMOTE; input.gpRemote(true); }
    if (press.includes(B.THROW)) input.gpThrow();
  }

  function menuPress(press, t) {
    const scr = app.screen, game = scr === SCREEN.GAME;
    const onPage = scr === SCREEN.CONTROLS || (game && app.pauseView === 3);
    const st = world().state, ended = game && (st === "WIN" || st === "LOSE");
    const alias = binds().pad.PAUSE, was0 = sig();
    let ok = false;
    const enter = () => { if (!ok) { ok = true; onUiKey("Enter"); } };
    for (const id of press) {
      if (onPage && page && page.feedBtn(id, t)) continue;
      if (ended) { if (id === "S" || id === "START") enter(); else if (END_COPY[id]) onUiKey(END_COPY[id]); }
      else if (game) {
        if (id === "S") enter();
        else if (onPage && BRACKET[id]) onUiKey(BRACKET[id]); // before the alias: a shoulder bound as PAUSE still changes tab here
        else if (id === "E" || id === "START" || id === alias) onPause();
      }
      else if (id === "S" || id === "START") enter();
      else if (id === "E") onUiKey("Escape");
      else if ((onPage || scr === SCREEN.LEVEL) && BRACKET[id]) onUiKey(BRACKET[id]);
      else if (scr === SCREEN.SCORES && LATERAL[id]) onUiKey(LATERAL[id]);
      else if (scr === SCREEN.STATS && STATS_KEY[id]) onUiKey(STATS_KEY[id]);
      else if (scr === SCREEN.LEVEL && app.pactUnlocked && TRIGGER[id]) app.modeWalk(TRIGGER[id]);
      else if (scr === SCREEN.LEVEL && app.pactUnlocked && id === "N") { if (app.modeCur < 0) app.modeWalk(1); else onUiKey("Digit" + (app.modeCur + 1)); }
      if (sig() !== was0) return false;
    }
    return true;
  }

  return {
    /** One poll's routing; never calls Input when no pad is or was connected. */
    route(snap, t) {
      if (!snap.connected && !snap.lost) { deaf = false; return { edge: false }; }
      const lay = layerOf(app, world()), scr = app.screen;
      const front = scr === SCREEN.INTRO || scr === SCREEN.ATTRACT;
      if (lay !== was) {
        if (lay === "play") soft = false;
        else if (was === "play") soft = true;
        drop();
        was = lay;
      }
      if (!snap.connected) {
        deaf = false;
        woke = true;
        drop();
        input.gpMove(NONE, true);
        prev = NONE;
        benchHeld = false;
        return { edge: false };
      }
      for (const id of snap.release) {
        if (id === fireBy) { fireBy = null; input.gpFire(false); }
        if (id === remBy) { remBy = null; input.gpRemote(false); }
      }
      const swallow = deaf || ((snap.found || woke) && !front);
      const press = swallow ? [] : snap.press;
      let edge = !deaf && snap.press.length > 0;
      if (edge) woke = false;
      deaf = false;
      /* The SENSITIVITY row is the stick's test bench: there a push only shows in the live view, and the D-PAD walks and adjusts. */
      const dpad = DPAD.some((id) => snap.down.has(id)), onCtl = !!(app.onControls && app.onControls());
      /* A stick pushed on the bench stays latched until it returns to centre, wherever the D-PAD took the cursor: its release must not read as a fresh push. */
      if (!onCtl || (!dpad && isClear(snap.menuDir))) benchHeld = false;
      else if (!dpad && app.controls && app.controls.stickBench) benchHeld = true;
      const bench = (benchHeld || !!(onCtl && app.controls && app.controls.stickBench)) && !dpad;
      const md = bench ? NONE : snap.menuDir, cap = !!(page && page.capturing), modal = !cap && lay !== "play" ? liveCard(t) : (card = null);
      if (hard && isClear(lay === "play" ? snap.dir : md)) hard = false;
      if (soft && isClear(md)) soft = false;
      if ((swallow || front || cap || modal) && !isClear(snap.dir)) hard = true;
      const free = !hard && !front && !cap && !modal;
      const rise = free ? TAPS.filter(([a]) => md[a] && !prev[a]) : [];
      const stickRise = cap && !swallow && !DPAD.some((id) => snap.down.has(id)) && TAPS.some(([a]) => md[a] && !prev[a]);
      prev = md;
      if (lay === "play") {
        if (rise.length) edge = true;
        input.gpMove(hard ? NONE : snap.dir, false);
        if (press.length) playPress(press);
        return { edge };
      }
      input.gpMove(free && !soft ? md : NONE, true);
      if (cap) {
        for (const id of press) if (page.capturing) page.feedBtn(id, t);
        if (stickRise && page.capturing) page.feedBtn(binds().stick === "R" ? "RS" : "LS", t);
        return { edge };
      }
      if (modal) { // nothing reaches the screen behind a card; EAST wins a same-poll tie, the way that changes nothing
        const id = press.includes("E") ? "E" : press.includes("S") ? "S" : null;
        if (id && t - cardT >= CARD_GUARD) modal.press(id);
        return { edge };
      }
      if (front) {
        if (press.length) onUiKey(scr === SCREEN.ATTRACT && press[0] === "E" ? "Escape" : "Enter");
        return { edge };
      }
      if (rise.length && !soft) edge = true;
      if (press.length && !menuPress(press, t)) return { edge };
      if (!soft) for (const [, code] of rise) onUiKey(code);
      return { edge };
    },
    /** Blur or a hidden tab: latches off, and whatever is down when polling returns is no press until seen released. */
    clear() {
      drop();
      input.gpMove(NONE, true);
      prev = NONE;
      benchHeld = false;
      deaf = true;
    },
  };
}
