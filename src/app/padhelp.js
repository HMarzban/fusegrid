// The help card #padhelp (controller discovery, owner 2026-11-14: "when chrome find the controller show a propmt or something?"). A browser shows a page
// no controller before its first press and no un-granted USB device at all, so the card cannot answer a plug-in: it is shown up front on MENU, a
// keyboard layout, and retires for good once a controller is seen, after GOT IT, or after 3 runs with none. On Chrome for macOS (the waker's reach)
// it carries CONNECT SWITCH 2: its click is the user activation Chrome's USB chooser needs. Plan: docs/superpowers/plans/2026-11-14-controller-discovery.md.
import { defaultStore } from "./store.js";

export const PADHELP_KEY = "nb.padhelp.v1";
/* words.js PAD_HELP_WORDS and SW2_WORDS, pinned equal in tests/words.test.mjs: src/app never imports src/render. SW2_WORDS lives here, in the boot
   graph, since the card shows the CONNECT results before the CONTROLS page is in; controlspage.js re-exports it. */
export const HELP_WORDS = Object.freeze({ title: "PLAYING WITH A CONTROLLER?", body: "Plug it in and press any button on it. A browser shows a controller to a game only after its first press.",
  sw2: "A Switch 2 Pro Controller on a cable needs one click here first.", go: "CONNECT SWITCH 2", no: "GOT IT", press: "PRESS ANY BUTTON ON IT" });
export const SW2_WORDS = Object.freeze({ row: "SWITCH 2 CONTROLLER", door: "CONNECT", ok: "CONNECTED", cancel: "NOT CONNECTED · TRY AGAIN", busy: "IN USE BY ANOTHER APP", failed: "COULD NOT START IT HERE", blocked: "NOT ALLOWED ON THIS PAGE", pad: "PRESS ENTER OR CLICK", vib: "ALLOW VIBRATION", allow: "ALLOW", help: "It needs a USB cable. Your browser asks once which controller.", helpVib: "It needs a USB cable. Your browser asks once which controller, and once more for vibration." });
const SAY = { woken: SW2_WORDS.ok + " · " + HELP_WORDS.press, cancelled: SW2_WORDS.cancel, busy: SW2_WORDS.busy, failed: SW2_WORDS.failed, blocked: SW2_WORDS.blocked };
const RUNS = 3;

const fresh = () => ({ s: 0, x: 0, r: 0 });
const storeOf = (store) => { if (store !== undefined) return store; try { return defaultStore(); } catch (_) { return null; } };
/** {s: a controller was seen, x: GOT IT, r: runs started}; missing, junk or a throwing store reads fresh. */
export function loadHelp(store) {
  try {
    const st = storeOf(store), v = st ? JSON.parse(st.getItem(PADHELP_KEY)) : null;
    return v && typeof v === "object" ? { s: v.s ? 1 : 0, x: v.x ? 1 : 0, r: Math.max(0, v.r | 0) } : fresh();
  } catch (_) { return fresh(); }
}
export function saveHelp(v, store) { try { const st = storeOf(store); if (st) st.setItem(PADHELP_KEY, JSON.stringify({ s: v.s ? 1 : 0, x: v.x ? 1 : 0, r: v.r | 0 })); } catch (_) {} }
export const helpDone = (st) => !!(st.s || st.x || st.r >= RUNS);
/* Under ROOM the card's corner meets MENU's rows (600 x 520 covers SETTINGS, GUIDE and SOURCE): no card there (final review, 2026-11-14) */
export const ROOM = Object.freeze({ w: 1024, h: 700 });
/** Pure: MENU on a keyboard layout with room, no other card up, no controller in, not retired, no CONTROLS capture. */
export function helpVisible({ screen, S, lay, busy, padIn, done, capturing, roomy = true }) {
  return screen === S.MENU && lay === "d" && roomy && !busy && !padIn && !done && !capturing;
}

/** Mounts the card; tick() every `every` ms (250, as the consent card), 0 = the caller ticks. */
export function mountPadHelp(env) {
  const e = env || {},
    win = e.win !== undefined ? e.win : typeof window !== "undefined" ? window : null,
    doc = e.doc !== undefined ? e.doc : typeof document !== "undefined" ? document : null,
    ctl = e.ctl, every = e.every !== undefined ? e.every : 250;
  let st = loadHelp(e.store), card = null, asking = false, was, seen = false; // seen: the card showed since the last run counted
  const save = () => saveHelp(st, e.store);
  const hide = () => { if (card) card.hidden = true; };
  const build = () => {
    card = doc.createElement("div");
    card.id = "padhelp";
    card.hidden = true;
    card.setAttribute("role", "region");
    card.setAttribute("aria-label", "Controller help");
    card.innerHTML = "<b>" + HELP_WORDS.title + "</b><i>" + HELP_WORDS.body + '</i><i class="sw2" hidden>' + HELP_WORDS.sw2 + "</i>" +
      '<span class="go" role="button" tabindex="-1" hidden>' + HELP_WORDS.go + "</span>" +
      '<span class="no" role="button" tabindex="-1">' + HELP_WORDS.no + '</span><i class="st" aria-live="polite"></i>';
    const tap = (sel, fn) => {
      const el = card.querySelector(sel);
      el.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      el.addEventListener("pointerup", (ev) => { ev.stopPropagation(); fn(); });
    };
    const said = (r) => { const s = card.querySelector(".st"); s.textContent = SAY[r] || ""; };
    tap(".go", () => { // the click itself is the activation: sw2Connect asks Chrome inside this pointerup
      if (asking || !ctl) return;
      asking = true;
      Promise.resolve(ctl.sw2Connect()).then(said, () => said("failed")).then(() => { asking = false; });
    });
    tap(".no", () => { st.x = 1; save(); hide(); });
    card.addEventListener("pointerdown", (ev) => ev.stopPropagation()); // a tap on the card's body stops here: it never reaches the canvas
    card.addEventListener("pointerup", (ev) => ev.stopPropagation());
    doc.body.appendChild(card);
  };
  const tick = () => {
    if (!card) return;
    const g = e.get && e.get();
    if (!g || !g.app) return;
    const scr = g.app.screen, S = g.SCREEN;
    if (was !== undefined && was !== S.GAME && scr === S.GAME && seen && !helpDone(st)) { st.r++; seen = false; save(); } // a run started, from any screen, after the card showed: a card hidden behind another uses up nothing
    was = scr;
    const padIn = !!(ctl && ctl.padIn());
    if (padIn && !st.s) { st.s = 1; save(); } // a controller is in: the card's job is done, for good
    const reach = !!(ctl && ctl.sw2 && ctl.sw2().shown), go = card.querySelector(".go"), line = card.querySelector(".sw2");
    if (go.hidden === reach) { go.hidden = !reach; line.hidden = !reach; }
    const lay = doc.body && doc.body.dataset ? doc.body.dataset.lay : "d",
      roomy = !win || !win.innerWidth || (win.innerWidth >= ROOM.w && win.innerHeight >= ROOM.h),
      show = helpVisible({ screen: scr, S, lay, busy: !!(g.busy && g.busy()), padIn, done: helpDone(st), capturing: !!g.app.capturing, roomy });
    if (show) seen = true;
    if (card.hidden === show) card.hidden = !show;
  };
  if (doc && typeof doc.createElement === "function" && doc.body && typeof doc.body.appendChild === "function" && !helpDone(st)) { // a harness document without elements: no card
    build();
    if (every > 0 && win && typeof setInterval === "function") setInterval(tick, every);
  }
  return { tick, get shown() { return !!card && !card.hidden; }, get state() { return { ...st }; } };
}
