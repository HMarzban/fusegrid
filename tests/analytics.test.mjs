import {
  ANALYTICS_KEY,
  GA_HOST,
  GA_PLACEHOLDER,
  GA_ID,
  loadConsent,
  saveConsent,
  daysBucket,
  gaLive,
  cardVisible,
  cardClears,
  cookiePath,
  mountAnalytics,
} from "../src/app/analytics.js";
import { SCREEN, OPT_ROWS, createMenuApp } from "../src/app/menuapp.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") +
      name +
      (detail !== undefined ? " -> " + detail : ""),
  );
}

const mkStore = (init) => {
  const m = new Map(Object.entries(init || {}));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};
/* a DOM just big enough for the card: elements keep their listeners, the
   window keeps its capture keydown, document.cookie records every write */
const mkEl = (tag) => {
  const L = {}, kids = {};
  return {
    tag, id: "", hidden: false, innerHTML: "", attrs: {}, L, src: "", async: false,
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(t, f) { (L[t] = L[t] || []).push(f); },
    querySelector(sel) { return (kids[sel] = kids[sel] || mkEl(sel)); },
    fire(t, ev) { (L[t] || []).forEach((f) => f(ev)); },
  };
};
const mkDom = (cookie, lay) => {
  const body = [], head = [], writes = [], WL = [];
  const doc = {
    body: { appendChild: (el) => body.push(el), dataset: { lay: lay || "d" } },
    head: { appendChild: (el) => head.push(el) },
    createElement: mkEl,
    get cookie() { return cookie || ""; },
    set cookie(v) { writes.push(v); },
  };
  const win = { addEventListener: (t, f, cap) => WL.push({ t, f, cap }) };
  const key = (code, repeat) => {
    const ev = { code, repeat: !!repeat, stopped: false, stopImmediatePropagation() { this.stopped = true; } };
    WL.filter((l) => l.t === "keydown" && l.cap === true).forEach((l) => l.f(ev));
    return ev;
  };
  return { doc, win, body, head, writes, key, card: () => body.find((e) => e.id === "ana") };
};
const ptr = () => ({ stopPropagation() {} });
const LOC = { hostname: GA_HOST, pathname: "/fusegrid/index.html" };
const ID = "G-TEST1234";
const atMenu = (screen) => ({ get: () => ({ app: { screen }, SCREEN }) });
const dl = (win) => (win.dataLayer || []).map((a) => Array.prototype.slice.call(a));

// ---- store ----
check("ANALYTICS_KEY is nb.analytics.v1", ANALYTICS_KEY === "nb.analytics.v1");
{
  const st = mkStore();
  check("an empty store reads never asked (-1)", loadConsent(st) === -1);
  saveConsent(1, st);
  check("ALLOW saves \"1\" and loads 1", st.m.get(ANALYTICS_KEY) === "1" && loadConsent(st) === 1);
  saveConsent(0, st);
  check("NO THANKS saves \"0\" and loads 0", st.m.get(ANALYTICS_KEY) === "0" && loadConsent(st) === 0);
  check("a junk value reads never asked", loadConsent(mkStore({ [ANALYTICS_KEY]: "yes" })) === -1);
  check("a throwing store reads never asked", loadConsent({ getItem() { throw new Error("x"); } }) === -1);
  check("no store at all reads never asked", loadConsent(null) === -1);
}

// ---- pure helpers ----
check("daysBucket: 0 / 1 / 2-3 / 4-7 / 8-14 / 15+",
  [0, 1, 2, 3, 4, 7, 8, 14, 15, 400].map(daysBucket).join(",") === "0,1,2-3,2-3,4-7,4-7,8-14,8-14,15+,15+",
  [0, 1, 2, 3, 4, 7, 8, 14, 15, 400].map(daysBucket).join(","));
check("daysBucket: junk reads 0", daysBucket(undefined) === "0" && daysBucket(NaN) === "0" && daysBucket(-3) === "0");
check("gaLive: the placeholder ID never runs, even on the Pages host", !gaLive(GA_PLACEHOLDER, GA_HOST));
check("gaLive: a real ID runs only on the Pages host",
  gaLive(ID, GA_HOST) && !gaLive(ID, "127.0.0.1") && !gaLive(ID, "localhost") && !gaLive(ID, "someone.github.io") && !gaLive("UA-1", GA_HOST));
check("cardVisible: MENU and its pages, never BOOT / INTRO / ATTRACT",
  cardVisible(SCREEN.MENU, SCREEN) && cardVisible(SCREEN.SETTINGS, SCREEN) && cardVisible(SCREEN.STATS, SCREEN) &&
  !cardVisible(SCREEN.BOOT, SCREEN) && !cardVisible(SCREEN.INTRO, SCREEN) && !cardVisible(SCREEN.ATTRACT, SCREEN));
check("cardClears: beside or under the stage clears; a stage reaching the corner does not",
  cardClears({ right: 600, bottom: 760 }, 1440, 900) && cardClears({ right: 1000, bottom: 600 }, 1024, 900) &&
  !cardClears({ right: 1000, bottom: 760 }, 1024, 768) && cardClears(null, 800, 600));
check("cardVisible: a keyboard run that leaves no room for the card waits for the menus",
  !cardVisible(SCREEN.GAME, SCREEN, false, false) && cardVisible(SCREEN.MENU, SCREEN, false, false));
check("cardVisible: a keyboard run keeps the card; a touch run (bomb button corner) hides it",
  cardVisible(SCREEN.GAME, SCREEN, false) && !cardVisible(SCREEN.GAME, SCREEN, true) && cardVisible(SCREEN.MENU, SCREEN, true));
check("cookiePath keeps the cookies on the game's own directory",
  cookiePath("/fusegrid/index.html") === "/fusegrid/" && cookiePath("/fusegrid/") === "/fusegrid/" && cookiePath(undefined) === "/" && cookiePath("") === "/");

// ---- Node / no DOM: inert ----
{
  const st = mkStore();
  const ga = mountAnalytics({ store: st, win: null, doc: null, loc: null });
  let threw = false;
  try { ga.event("run_start", { room: 1 }); ga.set(1); ga.event("run_end", {}); ga.tick(); } catch (_) { threw = true; }
  check("no window: never live, never dry, never throws", !ga.live && !ga.dry && !threw);
  check("no window: the OPTIONS switch still records the choice", st.m.get(ANALYTICS_KEY) === "1" && ga.consent === 1);
}
// ---- placeholder ID on the Pages host: no card, no script ----
{
  const D = mkDom();
  const ga = mountAnalytics({ id: GA_PLACEHOLDER, store: mkStore(), win: D.win, doc: D.doc, loc: LOC, ...atMenu(SCREEN.MENU) });
  check("placeholder ID: no card, no script, not live", !ga.live && D.body.length === 0 && D.head.length === 0);
  check("GA_ID is a real GA4 ID, live on the Pages host only", gaLive(GA_ID, GA_HOST) && !gaLive(GA_ID, "127.0.0.1"), GA_ID);
}
// ---- live, never asked ----
{
  const D = mkDom(), st = mkStore(), seen = [];
  let screen = SCREEN.INTRO, busy = false;
  const ga = mountAnalytics({ id: ID, store: st, win: D.win, doc: D.doc, loc: LOC, now: () => "NOW", days: 5, look: () => "px",
    get: () => ({ app: { screen }, SCREEN, busy: () => busy }), onChange: (v) => seen.push(v) });
  check("live + never asked: the card is built hidden, nothing loads",
    ga.live && !!D.card() && D.card().hidden && D.head.length === 0 && D.win.dataLayer === undefined);
  check("the card names Google Analytics, the cookie and OPTIONS",
    /Google Analytics/.test(D.card().innerHTML) && /cookie/.test(D.card().innerHTML) && /OPTIONS/.test(D.card().innerHTML));
  ga.event("run_start", { room: 1 });
  check("an event before an answer sends nothing", D.win.dataLayer === undefined);
  ga.tick();
  check("INTRO: the card stays hidden", D.card().hidden);
  screen = SCREEN.MENU; ga.tick();
  check("MENU: the card shows, with no backdrop built at all", !D.card().hidden && ga.shown && D.body.length === 1);
  busy = true; ga.tick();
  check("the NEW VERSION card up: the consent card waits", D.card().hidden);
  busy = false; screen = SCREEN.GAME; ga.tick();
  check("GAME on a keyboard screen: the card stays up in its corner while you play", !D.card().hidden);
  const ent = D.key("Enter"), esc = D.key("Escape"), sp = D.key("Space");
  check("it never takes the keyboard: Enter, Escape and Space reach the game, nothing recorded",
    !ent.stopped && !esc.stopped && !sp.stopped && ga.consent === -1 && !D.card().hidden);
  screen = SCREEN.MENU; ga.tick();
  const y = D.key("KeyY");
  check("Y = ALLOW: saved, card gone, onChange(true)", y.stopped && st.m.get(ANALYTICS_KEY) === "1" && ga.consent === 1 && D.card().hidden && seen.join() === "true");
  const s = D.head[0];
  check("ALLOW loads gtag.js once, async, with this ID", D.head.length === 1 && s.async && s.src === "https://www.googletagmanager.com/gtag/js?id=" + ID, s && s.src);
  const q = dl(D.win);
  check("the first gtag call grants analytics and denies every ad signal",
    q[0][0] === "consent" && q[0][1] === "default" && q[0][2].analytics_storage === "granted" &&
    q[0][2].ad_storage === "denied" && q[0][2].ad_user_data === "denied" && q[0][2].ad_personalization === "denied", JSON.stringify(q[0]));
  check("gtag js stamp comes from the injected clock", q[1][0] === "js" && q[1][1] === "NOW");
  check("user properties carry the days bucket and the look", q[2][0] === "set" && q[2][1] === "user_properties" && q[2][2].days_played === "4-7" && q[2][2].look === "px", JSON.stringify(q[2]));
  check("config: this ID, cookies on the game's own path", q[3][0] === "config" && q[3][1] === ID && q[3][2].cookie_path === "/fusegrid/", JSON.stringify(q[3]));
  check("dataLayer holds Arguments objects (what gtag.js reads), never arrays", Object.prototype.toString.call(D.win.dataLayer[0]) === "[object Arguments]");
  ga.event("run_start", { mode: "run", room: 1 });
  const last = dl(D.win).at(-1);
  check("after ALLOW an event reaches the dataLayer", last[0] === "event" && last[1] === "run_start" && last[2].room === 1, JSON.stringify(last));
  const z = D.key("KeyZ");
  check("with the card gone, keys pass through to the game", !z.stopped);
  screen = SCREEN.MENU; ga.tick();
  check("answered: the card never comes back", D.card().hidden);
}
// ---- N = NO THANKS ----
{
  const D = mkDom(), st = mkStore();
  const ga = mountAnalytics({ id: ID, store: st, win: D.win, doc: D.doc, loc: LOC, ...atMenu(SCREEN.MENU) });
  ga.tick(); D.key("KeyN");
  ga.event("run_start", {});
  check("N = NO THANKS: saved 0, no script, no dataLayer, events dropped",
    st.m.get(ANALYTICS_KEY) === "0" && D.head.length === 0 && D.win.dataLayer === undefined && D.card().hidden);
}
// ---- touch: the card waits out a run (the bomb button owns that corner) ----
{
  const D = mkDom("", "p"), st = mkStore();
  let screen = SCREEN.MENU;
  const ga = mountAnalytics({ id: ID, store: st, win: D.win, doc: D.doc, loc: LOC, get: () => ({ app: { screen }, SCREEN }) });
  ga.tick();
  check("touch MENU: the card shows", !D.card().hidden);
  screen = SCREEN.GAME; ga.tick();
  check("touch run: hidden, nothing recorded", D.card().hidden && !st.m.has(ANALYTICS_KEY));
  screen = SCREEN.MENU; ga.tick();
  check("back on the touch menus: it shows again", !D.card().hidden);
}
// ---- taps ----
{
  const D3 = mkDom(), st3 = mkStore();
  const ga3 = mountAnalytics({ id: ID, store: st3, win: D3.win, doc: D3.doc, loc: LOC, ...atMenu(SCREEN.MENU) });
  ga3.tick(); D3.card().querySelector(".yes").fire("pointerup", ptr());
  check("a tap on ALLOW allows", st3.m.get(ANALYTICS_KEY) === "1" && D3.head.length === 1);
  const D4 = mkDom(), st4 = mkStore();
  const ga4 = mountAnalytics({ id: ID, store: st4, win: D4.win, doc: D4.doc, loc: LOC, ...atMenu(SCREEN.MENU) });
  ga4.tick(); D4.card().querySelector(".no").fire("pointerup", ptr());
  check("a tap on NO THANKS declines", st4.m.get(ANALYTICS_KEY) === "0" && D4.head.length === 0);
}
// ---- an earlier yes: boot at mount, no card; OFF withdraws ----
{
  const D = mkDom("_ga=GA1.1.5; _ga_TEST1234=GS1; other=1"), st = mkStore({ [ANALYTICS_KEY]: "1" });
  const ga = mountAnalytics({ id: ID, store: st, win: D.win, doc: D.doc, loc: LOC, ...atMenu(SCREEN.MENU) });
  check("an earlier ALLOW loads gtag.js at boot and builds no card", D.head.length === 1 && !D.card());
  ga.set(0);
  const last = dl(D.win).at(-1);
  check("OFF: ga-disable set and consent updated to denied",
    D.win["ga-disable-" + ID] === true && last[0] === "consent" && last[1] === "update" && last[2].analytics_storage === "denied");
  check("OFF: both _ga cookies expire on the game's path, other cookies untouched",
    D.writes.includes("_ga=;Max-Age=0;path=/fusegrid/") && D.writes.includes("_ga_TEST1234=;Max-Age=0;path=/fusegrid/;domain=" + GA_HOST) &&
    !D.writes.some((w) => w.indexOf("other=") === 0), D.writes.join(" | "));
  const n = D.win.dataLayer.length;
  ga.event("run_end", {});
  check("OFF: later events are dropped", D.win.dataLayer.length === n);
  ga.set(1);
  check("ON again in the same session: no second script, consent granted, ga-disable cleared",
    D.head.length === 1 && dl(D.win).at(-1)[2].analytics_storage === "granted" && D.win["ga-disable-" + ID] === false);
}
// ---- DRY (?debug=1 off the Pages host): the log, never the network ----
{
  const D = mkDom(), st = mkStore();
  const ga = mountAnalytics({ store: st, win: D.win, doc: D.doc, loc: { hostname: "127.0.0.1", pathname: "/index.html" }, dry: true, ...atMenu(SCREEN.MENU) });
  check("dry: not live, the card is built", ga.dry && !ga.live && !!D.card());
  ga.tick(); D.key("KeyY");
  ga.event("run_end", { result: "lose" });
  check("dry: ALLOW logs the gtag calls, loads no script, touches no dataLayer",
    D.head.length === 0 && D.win.dataLayer === undefined && ga.log.some((a) => a[0] === "config") && ga.log.at(-1)[1] === "run_end", JSON.stringify(ga.log.at(-1)));
  const off = mountAnalytics({ store: mkStore(), win: D.win, doc: D.doc, loc: { hostname: "127.0.0.1", pathname: "/" } });
  check("loopback without ?debug=1: neither live nor dry", !off.live && !off.dry);
}

// ---- OPTIONS ANALYTICS row (menuapp) ----
{
  const calls = [];
  const a = createMenuApp({ analytics: false, onAnalytics: (v) => calls.push(v) });
  a.screen = SCREEN.SETTINGS;
  a.optRow = OPT_ROWS.indexOf("ANALYTICS");
  check("ANALYTICS sits right after REDUCE FLASH", OPT_ROWS[a.optRow - 1] === "REDUCE FLASH" && OPT_ROWS[a.optRow + 1] === "GRAPHICS");
  check("Enter cycles OFF -> ON and reports it", a.optCycle() === true && a.analytics === true && calls.join() === "true");
  check("→ at ON is a no-op", a.optAdjust(1) === false && calls.length === 1);
  check("← turns it OFF and reports it", a.optAdjust(-1) === true && a.analytics === false && calls.join() === "true,false");
  a.optCycle();
  a.optRow = OPT_ROWS.indexOf("RESET DEFAULTS");
  a.optCycle();
  check("RESET DEFAULTS never touches the consent", a.analytics === true && calls.length === 3);
  check("the app boots with the stored consent", createMenuApp({ analytics: true }).analytics === true && createMenuApp().analytics === false);
}

console.log("\n  ANALYTICS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
