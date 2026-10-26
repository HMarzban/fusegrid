/* Google Analytics (GA4), opt-in (owner 2026-10-26: "we need a tracker in
   order to see how many people stay in game or open the game"; consent pick
   "ask once, with an OPTIONS switch"). The ask is a corner card that never
   blocks play (owner: "let user to play and if they like it they can then
   answer"): no backdrop, no keyboard grab, Y / N only while it shows. Nothing reaches Google before ALLOW:
   no gtag.js request, no cookie, no event. NO THANKS or no answer sends
   nothing. Live only on the public Pages host with a real Measurement ID;
   ?debug=1 anywhere else is DRY (the card and the row work, every gtag call
   lands in `log`, never the network). Attract and the intro show never send:
   main calls event() only from its own world's run edges. OPTIONS ANALYTICS
   OFF sets ga-disable, denies consent and drops the _ga cookies. src/app
   never calls Date, so main injects `now` for gtag's js stamp. */
import { defaultStore } from "./store.js";

export const ANALYTICS_KEY = "nb.analytics.v1";
export const GA_PLACEHOLDER = "G-XXXXXXXXXX";
export const GA_ID = "G-C3MW30HPQ0"; // the Fusegrid GA4 web stream (owner 2026-10-26)
export const GA_HOST = "hmarzban.github.io";
const GA_SRC = "https://www.googletagmanager.com/gtag/js?id=";
const PRIVACY_URL = "https://github.com/HMarzban/fusegrid/blob/main/docs/privacy.md";

/* 1 allowed, 0 declined, -1 never asked */
export function loadConsent(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return -1;
    const v = st.getItem(ANALYTICS_KEY);
    return v === "1" ? 1 : v === "0" ? 0 : -1;
  } catch (_) {
    return -1;
  }
}

export function saveConsent(v, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function") st.setItem(ANALYTICS_KEY, v ? "1" : "0");
  } catch (_) {}
}

export function daysBucket(n) {
  const d = typeof n === "number" && isFinite(n) ? Math.max(0, n | 0) : 0;
  return d <= 1 ? String(d) : d <= 3 ? "2-3" : d <= 7 ? "4-7" : d <= 14 ? "8-14" : "15+";
}

export const gaLive = (id, host) => /^G-[A-Z0-9]{4,}$/.test(id || "") && id !== GA_PLACEHOLDER && host === GA_HOST;

/* Pure: may the consent card show on this frame? MENU, its pages and, on a
   keyboard screen, the run itself when the card clears the board (`roomy`).
   Never INTRO or ATTRACT (any key leaves them), and never a touch run, whose
   bomb button owns that corner. */
export function cardVisible(screen, S, touch, roomy) {
  if (screen === S.GAME) return !touch && roomy !== false;
  return screen !== S.BOOT && screen !== S.INTRO && screen !== S.ATTRACT;
}
/* Pure: does the card (CARD_W wide, ch tall, docked 16px from the
   bottom-right corner of a vw x vh viewport) clear the stage rect r, beside
   it or under it? ch is the card's last measured height. */
export const CARD_W = 330, CARD_H = 160;
export function cardClears(r, vw, vh, ch) {
  if (!r) return true;
  const x = vw - 16 - Math.min(CARD_W, vw - 32), y = vh - 16 - (ch || CARD_H);
  return r.right + 8 <= x || r.bottom + 8 <= y;
}

/* The game's own directory, so the _ga cookies never cover the rest of the
   shared github.io origin. */
export const cookiePath = (p) => (typeof p === "string" && p.charAt(0) === "/" ? p.replace(/[^/]*$/, "") : "/");

export function mountAnalytics(env) {
  const e = env || {},
    win = e.win !== undefined ? e.win : typeof window !== "undefined" ? window : null,
    doc = e.doc !== undefined ? e.doc : typeof document !== "undefined" ? document : null,
    loc = e.loc !== undefined ? e.loc : typeof location !== "undefined" ? location : null,
    host = loc && typeof loc.hostname === "string" ? loc.hostname : "",
    path = cookiePath(loc && loc.pathname),
    id = e.id || GA_ID,
    live = gaLive(id, host) && !!win && !!doc,
    dry = !live && !!e.dry,
    log = [];
  let consent = loadConsent(e.store),
    booted = false,
    card = null;
  function gtag() {
    if (dry) log.push(Array.prototype.slice.call(arguments));
    else win.dataLayer.push(arguments); // gtag.js reads Arguments objects, never plain arrays
  }
  const boot = () => {
    if (!live && !dry) return;
    if (!dry) win["ga-disable-" + id] = false;
    if (booted) return gtag("consent", "update", { analytics_storage: "granted" });
    booted = true;
    if (!dry) win.dataLayer = win.dataLayer || [];
    gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    gtag("js", e.now ? e.now() : null);
    gtag("set", "user_properties", { days_played: daysBucket(e.days), look: e.look ? e.look() : "2d" });
    gtag("config", id, { cookie_path: path, cookie_flags: "SameSite=Lax;Secure" });
    if (dry) return;
    const s = doc.createElement("script");
    s.async = true;
    s.src = GA_SRC + id;
    doc.head.appendChild(s);
  };
  const dropCookies = () => {
    if (!doc || typeof doc.cookie !== "string") return;
    for (const c of doc.cookie.split(";")) {
      const n = c.split("=")[0].trim();
      if (n.indexOf("_ga") !== 0) continue;
      for (const p of [path, "/"])
        for (const d of ["", ";domain=" + host, ";domain=." + host])
          doc.cookie = n + "=;Max-Age=0;path=" + p + d;
    }
  };
  const off = () => {
    if (!booted) return;
    if (!dry) win["ga-disable-" + id] = true;
    gtag("consent", "update", { analytics_storage: "denied" });
    dropCookies();
  };
  const hide = () => { if (card) card.hidden = true; };
  const set = (v) => {
    consent = v ? 1 : 0;
    saveConsent(consent, e.store);
    hide();
    if (consent) boot();
    else off();
    if (e.onChange) e.onChange(!!consent);
  };
  const shown = () => !!card && !card.hidden;
  const build = () => {
    card = doc.createElement("div");
    card.id = "ana";
    card.hidden = true;
    card.setAttribute("role", "region");
    card.setAttribute("aria-label", "Share play stats");
    card.innerHTML = "<b>HELP TUNE FUSE/GRID?</b><i>Share play stats with Google Analytics: opens, runs and the room " +
      'you reach. It sets a cookie that recognises you when you come back. Change it any time in OPTIONS. <a href="' + PRIVACY_URL +
      '" target="_blank" rel="noopener noreferrer">Privacy</a></i>' +
      '<span class="yes" role="button" tabindex="-1"><kbd>Y</kbd>ALLOW</span>' +
      '<span class="no" role="button" tabindex="-1"><kbd>N</kbd>NO THANKS</span>';
    const tap = (sel, fn) => {
      const el = card.querySelector(sel);
      el.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      el.addEventListener("pointerup", (ev) => { ev.stopPropagation(); fn(); });
    };
    tap(".yes", () => set(1));
    tap(".no", () => set(0));
    card.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    card.addEventListener("pointerup", (ev) => ev.stopPropagation());
    doc.body.appendChild(card);
    /* Y / N answer while it shows; every other key goes on to the game */
    win.addEventListener("keydown", (ev) => {
      if (!shown() || ev.repeat || (ev.code !== "KeyY" && ev.code !== "KeyN")) return;
      ev.stopImmediatePropagation();
      set(ev.code === "KeyY" ? 1 : 0);
    }, true);
  };
  const tick = () => {
    if (!card) return;
    const g = e.get && e.get();
    if (!g || !g.app) return;
    const lay = doc.body && doc.body.dataset ? doc.body.dataset.lay : "d",
      stage = g.app.screen === g.SCREEN.GAME && doc.getElementById ? doc.getElementById("c") : null,
      roomy = !stage || !win.innerWidth || cardClears(stage.getBoundingClientRect(), win.innerWidth, win.innerHeight, card.offsetHeight),
      show = consent === -1 && !(g.busy && g.busy()) && cardVisible(g.app.screen, g.SCREEN, lay === "p" || lay === "l", roomy);
    if (card.hidden === show) card.hidden = !show;
  };
  if (consent === 1) boot();
  if ((live || dry) && consent === -1 && doc && win) {
    build();
    setInterval(tick, 250);
  }
  return {
    event(name, params) {
      if (booted && consent === 1) gtag("event", name, params || {});
    },
    set,
    tick,
    log,
    get consent() { return consent; },
    get shown() { return shown(); },
    get live() { return live; },
    get dry() { return dry; },
  };
}
