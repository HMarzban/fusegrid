/* Controller discovery (owner 2026-11-14: "when chrome find the controller show a propmt or something? ... the game must discover and track this
   behavior automaticly"). A browser shows a page no controller before its first press and no un-granted USB device at all, so #padhelp is shown up
   front on MENU and leaves once a controller is in: "press any button", and on Chrome for macOS a CONNECT SWITCH 2 key whose click is the user
   activation Chrome's chooser needs. It retires for good once a controller is seen, after GOT IT, or after 3 runs with none. */
import { PADHELP_KEY, HELP_WORDS, SW2_WORDS, loadHelp, saveHelp, helpDone, helpVisible, mountPadHelp } from "../src/app/padhelp.js";
import { SCREEN } from "../src/app/menuapp.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v), flush = () => new Promise((r) => setImmediate(r));
const mkStore = (init, o = {}) => {
  const m = new Map(Object.entries(init || {}));
  return { m, getItem: (k) => { if (o.getThrows) throw new Error("blocked"); return m.has(k) ? m.get(k) : null; }, setItem: (k, v) => { if (o.setThrows) throw new Error("blocked"); m.set(k, String(v)); } };
};
const mkEl = (tag) => {
  const L = {}, kids = {};
  return { tag, id: "", hidden: false, innerHTML: "", textContent: "", attrs: {}, L,
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(t, f) { (L[t] = L[t] || []).push(f); },
    querySelector(sel) { return (kids[sel] = kids[sel] || mkEl(sel)); },
    fire(t, ev) { (L[t] || []).forEach((f) => f(ev)); } };
};
const mkDom = (lay) => {
  const body = [];
  return { body, doc: { body: { appendChild: (el) => body.push(el), dataset: { lay: lay || "d" } }, createElement: mkEl }, win: {} };
};
const ptr = () => { const e = { n: 0, stopPropagation() { e.n++; } }; return e; };
const mkCtl = (o = {}) => ({ calls: 0, padNow: false, reach: !!o.reach, res: o.res || (() => Promise.resolve("cancelled")),
  padIn() { return this.padNow; }, sw2() { return { shown: this.reach }; }, sw2Connect() { this.calls++; return this.res(); } });
const mount = (o = {}) => {
  const dom = mkDom(o.lay), app = { screen: SCREEN.MENU }, ctl = o.ctl || mkCtl(), store = o.store || mkStore(), busy = { v: false };
  const h = mountPadHelp({ get: () => ({ app, SCREEN, busy: () => busy.v }), ctl, store, doc: dom.doc, win: dom.win, every: 0 });
  h.tick();
  return { h, dom, app, ctl, store, busy, card: () => dom.body.find((e) => e.id === "padhelp") };
};
const V = (o) => helpVisible({ screen: SCREEN.MENU, S: SCREEN, lay: "d", busy: false, padIn: false, done: false, capturing: false, ...o });

// ---- the store ----
check("PADHELP_KEY is nb.padhelp.v1", PADHELP_KEY === "nb.padhelp.v1");
check("loadHelp defaults: no key", J(loadHelp(mkStore())) === J({ s: 0, x: 0, r: 0 }));
check("loadHelp defaults: junk", J(loadHelp(mkStore({ [PADHELP_KEY]: "{bad" }))) === J({ s: 0, x: 0, r: 0 }));
check("loadHelp defaults: a store that throws", J(loadHelp(mkStore({}, { getThrows: true }))) === J({ s: 0, x: 0, r: 0 }));
check("loadHelp defaults: no store", J(loadHelp(null)) === J({ s: 0, x: 0, r: 0 }));
{
  const st = mkStore();
  saveHelp({ s: 0, x: 1, r: 2 }, st);
  check("saveHelp then loadHelp round-trips", J(loadHelp(st)) === J({ s: 0, x: 1, r: 2 }), st.m.get(PADHELP_KEY));
  let threw = false;
  try { saveHelp({ s: 1, x: 0, r: 0 }, mkStore({}, { setThrows: true })); } catch (_) { threw = true; }
  check("saveHelp swallows a throwing store", !threw);
}
check("helpDone: seen, dismissed or 3 runs", helpDone({ s: 1, x: 0, r: 0 }) && helpDone({ s: 0, x: 1, r: 0 }) && helpDone({ s: 0, x: 0, r: 3 }) && !helpDone({ s: 0, x: 0, r: 2 }));

// ---- when it shows ----
check("help shows on MENU, keyboard layout, nothing in the way", V({}) === true);
check("help never off MENU", [SCREEN.GAME, SCREEN.INTRO, SCREEN.ATTRACT, SCREEN.SETTINGS, SCREEN.CONTROLS].every((screen) => V({ screen }) === false));
check("help waits for ana and upd", V({ busy: true }) === false);
check("help hides while a pad is in", V({ padIn: true }) === false);
check("help never on a touch layout", V({ lay: "p" }) === false && V({ lay: "l" }) === false);
check("help never once done, never during a capture", V({ done: true }) === false && V({ capturing: true }) === false);

// ---- the card ----
{
  const t = mount();
  const c = t.card();
  check("the card is built on MENU and shown", !!c && c.hidden === false && c.attrs.role === "region" && c.attrs["aria-label"] === "Controller help", J(c && c.attrs));
  check("its words are HELP_WORDS", c.innerHTML.includes(HELP_WORDS.title) && c.innerHTML.includes(HELP_WORDS.body) && c.innerHTML.includes(HELP_WORDS.no), c.innerHTML);
  t.busy.v = true; t.h.tick();
  check("help waits for ana and upd: the card hides while one shows", c.hidden === true);
  t.busy.v = false; t.h.tick();
  check("and comes back after", c.hidden === false);
  t.app.screen = SCREEN.SETTINGS; t.h.tick();
  check("help never off MENU: hidden on SETTINGS", c.hidden === true);
}
{
  const t = mount();
  for (let i = 0; i < 3; i++) { t.app.screen = SCREEN.GAME; t.h.tick(); t.app.screen = SCREEN.MENU; t.h.tick(); }
  check("help retires after three runs", t.card().hidden === true && loadHelp(t.store).r === 3, J(loadHelp(t.store)));
  const u = mount({ store: t.store });
  check("help retires after three runs: a fresh mount on the same store never shows", !u.card() || u.card().hidden === true);
}
{
  const t = mount();
  t.app.screen = SCREEN.LEVEL; t.h.tick(); t.app.screen = SCREEN.GAME; t.h.tick(); t.app.screen = SCREEN.MENU; t.h.tick();
  check("a run started from LEVEL SELECT counts too", loadHelp(t.store).r === 1, J(loadHelp(t.store)));
}
{
  const t = mount();
  t.ctl.padNow = true; t.h.tick();
  check("seen pad retires it: hidden and s:1 stored", t.card().hidden === true && loadHelp(t.store).s === 1, J(loadHelp(t.store)));
  t.ctl.padNow = false; t.h.tick();
  check("seen pad retires it: it stays hidden after the pad leaves", t.card().hidden === true);
}
{
  const t = mount();
  const e = ptr();
  t.card().querySelector(".no").fire("pointerup", e);
  check("GOT IT: x:1 stored and the card hides", t.card().hidden === true && loadHelp(t.store).x === 1 && e.n > 0, J(loadHelp(t.store)));
  t.h.tick();
  check("GOT IT: a later tick keeps it hidden", t.card().hidden === true);
}
{
  const t = mount({ ctl: mkCtl({ reach: false }) });
  check("connect button only where it reaches: hidden without a waker", t.card().querySelector(".go").hidden === true && t.card().querySelector(".sw2").hidden === true);
  t.ctl.reach = true; t.h.tick();
  check("connect button only where it reaches: shown once the waker is there", t.card().querySelector(".go").hidden === false && t.card().querySelector(".sw2").hidden === false);
  check("its words are HELP_WORDS'", t.card().innerHTML.includes(HELP_WORDS.go) && t.card().innerHTML.includes(HELP_WORDS.sw2), t.card().innerHTML);
}
{
  const t = mount({ ctl: mkCtl({ reach: true, res: () => Promise.resolve("woken") }) });
  t.card().querySelector(".go").fire("pointerup", ptr()); await flush(); await flush();
  check("connect woken: CONNECTED · PRESS ANY BUTTON ON IT, the card stays", t.card().querySelector(".st").textContent === SW2_WORDS.ok + " · " + HELP_WORDS.press && t.card().hidden === false && t.ctl.calls === 1, t.card().querySelector(".st").textContent);
}
{
  const t = mount({ ctl: mkCtl({ reach: true }) });
  const go = t.card().querySelector(".go");
  go.fire("pointerup", ptr()); await flush(); await flush();
  check("connect cancelled keeps the card: NOT CONNECTED · TRY AGAIN", t.card().querySelector(".st").textContent === SW2_WORDS.cancel && t.card().hidden === false, t.card().querySelector(".st").textContent);
  go.fire("pointerup", ptr()); await flush();
  check("connect cancelled keeps the card: a second click asks again", t.ctl.calls === 2, t.ctl.calls);
}
for (const [r, w] of [["busy", SW2_WORDS.busy], ["failed", SW2_WORDS.failed], ["blocked", SW2_WORDS.blocked], ["pad", ""], ["none", ""]]) {
  const t = mount({ ctl: mkCtl({ reach: true, res: () => Promise.resolve(r) }) });
  t.card().querySelector(".go").fire("pointerup", ptr()); await flush(); await flush();
  check(`connect ${r}: the status reads ${J(w)}`, t.card().querySelector(".st").textContent === w, t.card().querySelector(".st").textContent);
}
{
  let ok;
  const t = mount({ ctl: mkCtl({ reach: true, res: () => new Promise((r) => { ok = r; }) }) });
  const go = t.card().querySelector(".go");
  go.fire("pointerup", ptr()); go.fire("pointerup", ptr());
  check("one ask at a time: two clicks before the answer make one call", t.ctl.calls === 1, t.ctl.calls);
  ok("cancelled"); await flush(); await flush();
  go.fire("pointerup", ptr());
  check("one ask at a time: after the answer a click asks again", t.ctl.calls === 2, t.ctl.calls);
}
{
  const t = mount({ ctl: mkCtl({ reach: true }) });
  const d = ptr(), u = ptr(), gd = ptr();
  t.card().fire("pointerdown", d); t.card().fire("pointerup", u); t.card().querySelector(".go").fire("pointerdown", gd);
  check("taps stop at the card", d.n > 0 && u.n > 0 && gd.n > 0, J([d.n, u.n, gd.n]));
}
{
  const t = mount({ store: mkStore({}, { setThrows: true }) });
  t.card().querySelector(".no").fire("pointerup", ptr());
  check("store throws, card still works: GOT IT hides it", t.card().hidden === true);
  t.h.tick();
  check("store throws, card still works: and it stays hidden this session", t.card().hidden === true);
}
{
  const t = mount({ lay: "p" });
  check("a touch layout never shows it", !t.card() || t.card().hidden === true);
}

{
  let threw = false, h;
  try { h = mountPadHelp({ get: () => ({ app: { screen: SCREEN.MENU }, SCREEN }), ctl: mkCtl(), store: mkStore(), doc: { body: {} }, win: {}, every: 0 }); h.tick(); } catch (_) { threw = true; }
  check("a document that cannot make elements: no card, nothing throws", !threw && h && h.shown === false);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
