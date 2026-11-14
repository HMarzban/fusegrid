// The CONTROLS page reducer.
import { BTN, PAD_IDX, SENS_LEVELS, VIB_LEVELS, bindBtn, bindKey, bindMoveSet, clampControls, keyName, layoutName, moveLabel, resetDevice, softAliases, stepSens, stepVib } from "./controls.js";
import { createCapture } from "./capture.js";
import { resolveStick } from "./gamepad.js";
import { btnSay, btnWord as famWord } from "./padfamily.js";

const ROWS = {
  key: ["MOVE", "BOMB", "THROW", "REMOTE", "PAUSE", "CONFIRM", "BACK", "RESET"],
  pad: ["MOVE", "BOMB", "THROW", "REMOTE", "PAUSE", "SENSITIVITY", "VIBRATION", "RESET"],
};
/* The CONNECT row's words (src/render/words.js SW2_WORDS, pinned equal in tests/words.test.mjs: src/app never imports src/render); padhelp.js owns them,
   in the boot graph, since the help card shows the CONNECT results before this page is in (controller discovery, 2026-11-14). */
import { SW2_WORDS } from "./padhelp.js";
export { SW2_WORDS };
const SW2_SAY = { pad: "pad", woken: "ok", cancelled: "cancel", busy: "busy", failed: "failed", blocked: "blocked" };
const PAD_SW2 = [...ROWS.pad.slice(0, -1), "SW2", "RESET"];
const NO_VIB = "NO VIBRATION ON THIS CONTROLLER OR BROWSER", NO_VIB_SAY = "Vibration, none. No vibration on this controller or browser.";
const DRIFT_MS = 2000, REST_MS = 200; // a stick let go still passes under the ring on its way home: that is no drift
const NOTE_MS = 6000, ECHO_MS = 120, CANCELLED = "CANCELLED · NOTHING CHANGED", PAUSE_ROW = 4;
const TAB_SAY = { key: "Controls, keyboard.", pad: "Controls, controller." };
const FIXED_KEY = { CONFIRM: "ENTER", BACK: "ESC" };
const CANCEL_WORD = { key: "ESC", pad: "START", touch: "TAP OFF THE PLATE" };
const LABEL = { key: "RESET KEYS", pad: "RESET CONTROLLER" };
const J = JSON.stringify;
const absent = (s) => s === "none" || s === "lost";
const isDpad = (id) => id === "dU" || id === "dD" || id === "dL" || id === "dR";
const vibSay = (v) => (v ? "Vibration, " + VIB_LEVELS[v].toLowerCase() + ". " + (v === 1 ? "No menu buzz." : "Menus buzz too.") + " Left and right change it." : "Vibration off. No buzz at all.");
const sensSay = (dead) => {
  const l = SENS_LEVELS.find((q) => q.dead === dead) || SENS_LEVELS.reduce((b, q) => (Math.abs(q.dead - dead) < Math.abs(b.dead - dead) ? q : b));
  return "Sensitivity, " + l.name.toLowerCase() + ". The stick must move " + l.dead + " percent before it counts.";
};
const btnNo = (id) => "BUTTON " + Object.keys(PAD_IDX).find((i) => PAD_IDX[i] === id);

/** The page's walk, tabs, capture and writes; it reads and saves only through get / set. names = the wire's printed key names (controlswire keyNames),
    read live; a name the capture saw only fills a code they lack. namesV = their version (the wire's namesV): view().names is one object until
    either moves, so a steady frame allocates none. */
export function createControlsPage({ get, set, padView, say, device, sw2, names: seed, namesV }) {
  const cap = createCapture();
  let tabId = "key", dev = "key", row = 1, armed = false, swap = null, status = "", noteT = null;
  let echo = null, echoEnd = 0, held = null, padWas = padView().state, adjusting = false;
  let st = null, restAt = 0, peaks = [], fed = "";
  const learned = {};
  let learnedV = 0, nmObj = null, nmKey, nmL = -1;
  const nm = () => {
    const k = namesV ? namesV() : seed ? seed() : null; // no version handed in: the seed's own object stands for it
    if (nmObj && k === nmKey && nmL === learnedV) return nmObj;
    nmKey = k; nmL = learnedV;
    return (nmObj = seed ? { ...learned, ...seed() } : { ...learned });
  };
  const sw2View = () => { const v = sw2 ? sw2() : null; return { shown: !!(v && v.shown), state: (v && v.state) || "idle", vib: !!(v && v.vib), seen: !!(v && v.seen), hid: !!(v && v.hid) }; };
  const rowsFor = (id) => (id === "pad" && sw2View().shown ? PAD_SW2 : ROWS[id]); // SW2 only where the wire's waker exists (switch2.js usbReach)
  const rows = () => rowsFor(tabId);
  let seen = null; // [the rows, the focused id] at the last tick: a row that appears never moves the focus
  const sw2Door = () => { const v = sw2View(); return v.vib ? SW2_WORDS.vib : v.seen ? SW2_WORDS.ok : SW2_WORDS.door; }; // the wire's: vib = ALLOW VIBRATION offered (WebHID, a Switch 2 playing, none allowed); seen = a Switch 2 in getGamepads, whoever woke it (controlsgeo rowsOf reads the same two)
  const capturing = () => cap.view() !== null;
  const noPad = () => tabId === "pad" && absent(padView().state);
  const noVib = () => padView().rumble !== true;
  const nonstd = () => padView().state === "nonstd";
  const devNow = (t) => (device ? device(t) : dev);
  const label = (id) => (id === "RESET" ? LABEL[tabId] : id === "SW2" ? SW2_WORDS.row : id);
  const clearNote = () => { swap = null; status = ""; noteT = null; };
  const note = (s, sw) => { status = s; swap = sw || null; noteT = null; say(s); };
  const fam = () => padView().family || "generic"; // the controller in hand names its buttons (R-LABELS); the binds stay positions
  const btnWord = (id) => (nonstd() ? btnNo(id) : famWord(id, fam()));
  const btnSaid = (id) => (nonstd() ? btnNo(id) : btnSay(id, fam())); // the live region's word: MINUS for −, CROSS for the ✕ cap
  /* The row's value in the screen's own words, for the live region; "" = the row has none. */
  const boundWord = (id) => {
    const c = get(), isKey = tabId === "key";
    if (id === "RESET") return "";
    if (id === "SW2") return sw2Door();
    if (isKey) return FIXED_KEY[id] || (id === "MOVE" ? moveLabel(c.key.MOVE, nm()) : keyName(c.key[id], nm()[c.key[id]]));
    if (id === "MOVE") return "D-PAD and " + c.stick + "-STICK";
    return id === "PAUSE" ? btnSaid("START") + " and " + btnSaid(c.pad.PAUSE) : btnSaid(c.pad[id]);
  };
  const vibLine = () => (noVib() ? NO_VIB_SAY : vibSay(get().vib));
  const sayRow = (id) => {
    if (id === "SENSITIVITY") return sensSay(get().dead);
    if (id === "VIBRATION") return vibLine();
    const n = label(id), w = boundWord(id);
    return n[0] + n.slice(1).toLowerCase() + (w ? ", " + w : "") + ".";
  };
  const onValue = () => !noPad() && (rows()[row] === "SENSITIVITY" || (rows()[row] === "VIBRATION" && !noVib()));
  const switchTab = (id) => {
    if (!ROWS[id] || id === tabId) return false;
    const at = rowsFor(id).indexOf(rows()[row]);
    tabId = id; armed = false; clearNote();
    row = at >= 0 ? at : PAUSE_ROW; // never onto a row the other tab means differently: ← on a value row writes
    say(TAB_SAY[id]);
    return true;
  };
  const goTo = (i) => {
    row = i; armed = false; adjusting = false; clearNote();
    say(sayRow(rows()[row]) + " " + (row + 1) + " of " + rows().length + ".");
    return true;
  };
  const padLine = (r, id, old) => (nonstd() || fam() !== "generic" ? r.line.split(BTN[id].w).join(btnWord(id)).split(BTN[old].w).join(btnWord(old)) : r.line);
  const startCapture = (id, t) => {
    const c = get(), isKey = tabId === "key";
    if (isKey && id === "MOVE") cap.open({ action: "MOVE", dev: "key" }, t);
    else if (isKey) cap.open({ action: id, dev: "key", cur: c.key[id], curName: keyName(c.key[id], nm()[c.key[id]]) }, t);
    else cap.open({ action: id, dev: "pad", cur: c.pad[id], curName: btnWord(c.pad[id]) }, t);
    say(cap.view().prompt + " for " + id + ".");
    return true;
  };
  const commitKey = (spec, value) => {
    const c = get(), names = nm();
    if (spec.moveCap) {
      if (J(value) === J(c.key.MOVE)) return note("NO CHANGE");
      const r = bindMoveSet(c, value, names);
      set(r.c);
      const moved = r.moved.map((a) => a + " NOW " + keyName(r.c.key[a], names[r.c.key[a]])).join(" · ");
      return note(r.line + (moved ? " · " + moved : ""), r.moved.length ? { row: r.moved[0] } : null);
    }
    const r = bindKey(c, spec.id, value, names);
    if (r.kind === "same") return note(r.line);
    set(r.c);
    note(r.line, r.kind === "swap" ? { row: r.other } : r.kind === "move" ? { row: "MOVE" } : null);
  };
  const commitBtn = (spec, value) => {
    const c = get(), old = c.pad[spec.id], r = bindBtn(c, spec.id, value);
    if (r.kind === "same") return note(r.line);
    set(r.c);
    note(padLine(r, value, old), r.kind === "swap" ? { row: r.other, part: old } : null);
  };
  /* set's second argument tells the wire what this write is: a hold repeat and a reset play no test pulse. */
  const writeDead = (dead, repeat) => { set(clampControls({ ...get(), dead }), { repeat: !!repeat }); say(sensSay(dead)); return true; };
  const writeVib = (vib, repeat) => { set(clampControls({ ...get(), vib }), { repeat: !!repeat }); say(vibSay(vib)); return true; };
  /* The game's own resolver on the live stick at the live level; DRIFT is the 2 s peak of what it reads at rest. */
  const stickTick = (t) => {
    const v = padView().stickVal || [0, 0], m = Math.hypot(v[0], v[1]);
    st = resolveStick(st, v[0], v[1], get().dead / 100);
    while (peaks.length && t - peaks[0][0] > DRIFT_MS) peaks.shift();
    if (st.on) restAt = t + REST_MS;
    else if (t >= restAt) {
      while (peaks.length && peaks[peaks.length - 1][1] <= m) peaks.pop();
      peaks.push([t, m]);
    }
  };
  const readsOf = () => {
    const d = st && st.on ? Object.keys(st.dir).find((k) => st.dir[k]) : "";
    return d ? d.toUpperCase() : "";
  };
  const doReset = () => {
    armed = false;
    const c = get(), n = resetDevice(c, tabId);
    if (J(n) === J(c)) { note("ALREADY ON THE DEFAULTS"); return; }
    set(n, { reset: true });
    note(tabId === "key" ? "KEYBOARD BACK TO DEFAULTS" : "CONTROLLER BACK TO DEFAULTS");
  };
  const feed = (kind, id, t, key) => {
    const spec = cap.view(), r = cap.feed(kind, id, t, key);
    fed = r.kind;
    if (layoutName(key) && (r.kind === "step" || r.kind === "commit") && learned[id] !== layoutName(key)) { learned[id] = layoutName(key); learnedV++; } // the wire's rule: printable ASCII only, so another script keeps the code's letter
    if (r.kind === "cancel") note(r.line);
    else if (r.kind === "refused") say(r.line);
    else if (r.kind === "step") say(cap.view().prompt + ".");
    else if (r.kind === "commit") { if (spec.dev === "key") commitKey(spec, r.value); else commitBtn(spec, r.value); }
    return r;
  };
  return {
    /** The state the painter draws. */
    view(t) {
      const c = get(), p = padView();
      return { tab: tabId, device: devNow(t), row, pad: { state: p.state, name: p.name, family: p.family || "generic", rumble: p.rumble === true, effects: p.effects }, key: c.key, binds: c.pad, stick: c.stick, dead: c.dead, vib: c.vib,
        stickVal: p.stickVal || [0, 0], reads: readsOf(), drift: peaks.length ? peaks[0][1] : 0, armed, swap, status, capture: cap.view(devNow(t) === "pad" ? famWord("START", fam()) : CANCEL_WORD[devNow(t)]), echo, names: nm(), sw2: sw2View() };
    },
    /** Enters the page on the last-used device's tab; touch opens CONTROLLER. */
    open(d) {
      cap.cancel();
      dev = d; tabId = d === "key" ? "key" : "pad"; row = 1; armed = false; echo = null; held = null; padWas = padView().state; st = null; restAt = 0; peaks = []; seen = null; // a row that appeared while the page was shut moves no focus
      clearNote();
      say(TAB_SAY[tabId]);
    },
    /** As OPTIONS: axis 1 walks the rows with wrap; axis 0 adjusts the value row, else changes tab. held = a hold-repeat: it keeps adjusting, and never turns a tab change into a step. */
    walk(d, axis, held) {
      if (capturing()) return false;
      if (axis) return goTo((row + d + rows().length) % rows().length);
      if (held && !adjusting) return false;
      if (onValue()) { adjusting = true; return this.adjust(d, held); }
      adjusting = false;
      return switchTab(d < 0 ? "key" : "pad");
    },
    /** ←→ on a value row: one step, clamped, silent at the end as OPTIONS. */
    adjust(d, repeat) {
      if (capturing() || !onValue()) return false;
      const c = get();
      if (rows()[row] === "VIBRATION") {
        const vib = stepVib(c.vib, d);
        return vib === c.vib ? false : writeVib(vib, repeat);
      }
      const dead = stepSens(c.dead, d);
      return dead === c.dead ? false : writeDead(dead, repeat);
    },
    /** True on the row where the stick is under test, so it neither walks nor adjusts. Not on a non-standard pad: it may have no D-PAD to leave with. */
    get stickBench() { return rows()[row] === "SENSITIVITY" && !noPad() && !capturing() && !nonstd(); },
    /** True on the row ←→ adjusts. */
    get onValue() { return onValue(); },
    /** Jumps to a row from a tap; the row already selected stays as it is. */
    pick(i) {
      if (capturing() || !(i >= 0 && i < rows().length) || i === row) return false;
      return goTo(i);
    },
    /** Switches tab; the tab already set is silent. */
    tab(id) {
      if (capturing()) return false;
      adjusting = false;
      return switchTab(id);
    },
    /** Enter on the selected row. */
    confirm(t) {
      if (capturing()) return false;
      if (rows()[row] === "SW2") { armed = false; return "sw2"; } // the wire's: only a press with user activation may open the chooser, a pad press never does
      if (noPad()) return false;
      const id = rows()[row], c = get();
      if (id === "CONFIRM" || id === "BACK") { note("ENTER AND ESC STAY PUT SO YOU CAN ALWAYS GET BACK"); return "refused"; } // a refusal shown on the page: no cue, a pad's deny
      if (id === "RESET") {
        if (armed) doReset();
        else { armed = true; clearNote(); say("Press again to reset this tab."); }
        return true;
      }
      if (id === "SENSITIVITY") {
        const dead = stepSens(c.dead, 1);
        return writeDead(dead === c.dead ? SENS_LEVELS[0].dead : dead);
      }
      if (id === "VIBRATION") {
        if (noVib()) { status = NO_VIB; swap = null; noteT = null; say(NO_VIB_SAY); return false; }
        const vib = stepVib(c.vib, 1);
        return writeVib(vib === c.vib ? 0 : vib);
      }
      if (id === "MOVE" && tabId === "pad") {
        const stick = c.stick === "L" ? "R" : "L";
        set(clampControls({ ...c, stick }));
        note("MOVE NOW ON D-PAD · " + stick + "-STICK");
        return true;
      }
      return startCapture(id, t);
    },
    /** What came of a CONNECT: a request() result, or "pad" (a press with no user activation); anything else writes nothing. */
    sw2Said(r) { if (SW2_SAY[r]) note(SW2_WORDS[SW2_SAY[r]]); },
    /** The id of row i on the open tab (the wire's tap reads it). */
    idAt(i) { return rows()[i] || null; },
    /** ESC or EAST: ends a capture, then an armed reset, then asks the shell to leave. */
    back() {
      if (capturing()) { cap.cancel(); note(CANCELLED); return "cap"; }
      if (armed) { armed = false; return "disarm"; }
      return "page";
    },
    /** Closes a capture, from a tap off the plate; false when none is open. */
    cancel() {
      if (!capturing()) return false;
      cap.cancel();
      note(CANCELLED);
      return true;
    },
    /** A keydown; true means the page took it and nothing else may see it. */
    feedKey(code, key, t) {
      if (capturing()) {
        feed("key", code, t, key);
        if (!capturing()) held = code;
        return true;
      }
      if (held === code) return true;
      const c = get(); // the live BOMB key confirms through the fire latch: it may not disarm its own press
      if (code !== "Enter" && code !== "NumpadEnter" && code !== "Escape" && code !== "Backspace" && code !== c.key.BOMB && !softAliases(c).includes(code)) armed = false;
      clearNote();
      return false;
    },
    /** A pad button's rising edge; true means the page took it. */
    feedBtn(id, t) {
      if (tabId === "pad" && !isDpad(id)) { echo = id; echoEnd = t + ECHO_MS; }
      if (capturing()) {
        if (id === "E" && cap.view().dev === "key") { cap.cancel(); note(CANCELLED); fed = "cancel"; return true; } // never a binding there, and it is a pad player's back
        feed("btn", id, t);
        return true;
      }
      if (id !== "S" && id !== "START" && id !== "E") armed = false;
      clearNote();
      return false;
    },
    /** Once a frame: the arm clock, a lost pad, and the notes' ages. */
    tick(t, anyDown) {
      const ids = tabId + ":" + rows().join(); // the same tab's rows changed (SW2 arrived), never a tab switch
      if (seen && seen[0] !== ids && seen[0].startsWith(tabId + ":")) { const at = rows().indexOf(seen[1]); row = at >= 0 ? at : Math.min(row, rows().length - 1); armed = false; }
      seen = [ids, rows()[row]];
      cap.tick(t, anyDown);
      stickTick(t);
      if (!anyDown) held = null;
      const state = padView().state, spec = cap.view();
      if (absent(state)) {
        if (spec && spec.dev === "pad") { cap.cancel(); note(CANCELLED); }
        if (tabId === "pad") armed = false;
      } else if (absent(padWas)) note(padWas === "lost" ? "CONTROLLER BACK" : "CONTROLLER SEEN · READY");
      padWas = state;
      if (status || swap) {
        if (noteT === null) noteT = t;
        else if (t - noteT >= NOTE_MS) clearNote();
      }
      if (echo && t >= echoEnd) echo = null;
    },
    /** True while a capture owns the input. */
    get capturing() { return capturing(); },
    /** The last capture press's result: "commit", "step", "cancel", "refused" (shown on the plate) or "ignored". */
    get fed() { return fed; },
  };
}
