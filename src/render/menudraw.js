/* MENU DRAWING LAYER: the entry names shellview, the pointer and the tests call. The pages are src/render/pages/ (the world kit, kit/); this
   file keeps the INTRO chrome, the ATTRACT hint, the FPS meter, the RENDER row's job note and THE LOADING plate's ask, and the CONSOLE PANEL
   kit (plate, head, foot, paintRow, listGeom) that the PAUSE list and CONTROLS still wear: accent #37f0d0, text #dfe7f5, muted #7385ad, veils
   rgba(7,10,18,a). Easing helpers duplicated from the intro beat table (spec §3): this file must not import from src/app. */
import { LABEL, runParts } from "./words.js";
import { hints, tapAt } from "./hintcopy.js";
import { drawLogo2d, deviceScale, TITLE_RUNUP } from "./logo/draw2d.js";
import * as menuPage from "./pages/menu.js";
import * as levelPage from "./pages/level.js";
import * as kitProbe from "./kit/probe.js";
import { rosterOf } from "./pages/card.js";
import * as lazy from "./pages/lazy.js";
import { capDpr } from "./kit/cache.js";
import { loadingPlate, loadBox } from "./kit/room.js";
import { FOOT_TAP, LOOK_NAME, lookVal, LOAD_WORDS } from "./kit/copy.js";
const ACCENT = "#37f0d0",
  TEXT = "#dfe7f5",
  MUTED = "#7385ad";
const MONO = "ui-monospace,monospace";
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutBack = (t) => {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
/* Local copies of src/app/intro.js beats (pinned equal in menudraw.test). */
export const SHOW_STEP = 0.137,
  SKIP_GUARD = 0.2,
  TITLE_IN = 0.9;
const font = (size, weight) => (weight || "") + " " + size + "px " + MONO;
/* Labels in the system sans stack (no font file; disclosed: system-ui varies
   by OS), the meter and the attract hint mono. */
const SANS = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
const sans = (size, weight) => (weight || "") + " " + size + "px " + SANS;
const LINE = "#26324a";
/* the controller drawings' quiet glyph (padart.js) read these three; every page is on the world kit since Task 6.3 */
export { TEXT, MUTED, sans };
export const VIB_LEVELS = Object.freeze(["OFF", "LOW", "MEDIUM", "HIGH"]);
/** The OPTIONS door's VIBRATION word: a pad that is here, can buzz and has a stored level; "" otherwise. Boot-side, so the door never waits on the lazy CONTROLS paint. */
export const vibWord = (s) => (s && s.pad && s.pad.state !== "none" && s.pad.state !== "lost" && s.pad.rumble === true && s.vib != null ? VIB_LEVELS[s.vib] || "" : "");
/* heatRoster deduped to [{t, n}] in first-seen order: the next-run card's (pages/card.js), the one roster. */
export { rosterOf };
/* A run's setup for one value slot, longest first (the first that fits is kept): every setting named; the modifiers as a count; only what
   differs from a default run (the approved PLAY tag); the same with EXPERT
   bare; the same without the world, which the MENU pane beside the list
   already names. The words and the non-default filter are words.js runParts. */
export function setupVals(world, run) {
  const j = (a) => [world].concat(a).join(" · "), terse = runParts(run, { count: true, terse: true });
  return [j(runParts(run, { all: true })), j(runParts(run, { all: true, count: true })), j(runParts(run, { count: true })), j(terse), terse.join(" · ") || world];
}
/* lg: the shell box's logo line (fit.js shellGeo, the board's own 0.27 in #sh
   units, on every layout that has a shell box); tall marks a box over 1.3x as
   tall as wide (a portrait phone's #sh or a tall window: the touch MENU hub
   then hangs under the logo instead of centring in the band, STATS centres
   instead of pinning to the floor) and narrow any box under 560 wide
   (pages re-flow: LEVEL SELECT stacks its card under the grid, MEDALS goes to
   one column). Neither ever holds at 600x520 or 608x352. */
export function layout(W, H, lg, css, play) {
  return Object.freeze({
    W,
    H,
    play: play > 0 ? play : undefined, // box units per board unit in a run on this layout (fit.js shellGeo play): the room behind a page at play scale; none on #c (its box is the board: COVER = 1)
    shell: typeof lg === "number", // dims hands lg only for #sh's shell box
    css: css > 0 ? css : 1, // CSS px per box unit on a touch layout (the MENU's touch floors and its phone column and compact tiles are in CSS px)
    cx: W / 2,
    tall: H > W * 1.3,
    narrow: W < 560,
    top: H * 0.16,
    logoCy: typeof lg === "number" ? lg : H * 0.27,
    logoScale: Math.max(0.72, Math.min(1.0, (H / 520) * 1.0)),
    itemsY: H * 0.45,
    itemH: Math.max(24, Math.min(34, Math.round(H * 0.062))),
    footY: H - 20,
    chipW: 44,
    chipGap: 14,
    tableY: H * 0.42,
    rowH: H * 0.055,
  });
}

/* The title's logo box (logo B on the kit plate, logo/draw2d.js): the board
   canvas inside a 12 px margin, above the prompt's backing by 10 px, centred
   on the old wordmark's line (logoCy - 35.5 x logoScale); the stacked build on
   touch portrait, the line build elsewhere. It keeps its last answer, so a
   steady frame allocates no box. MENU's logo is the page header's (pages/menu.js). */
let tlb = null;
export function titleLogoBox(W, H, lay) {
  if (tlb && tlb.W === W && tlb.H === H && tlb.lay === lay) return tlb.v;
  const L = layout(W, H),
    px = lay === "p" || lay === "l" ? 26 : 18,
    m = 12;
  tlb = { W, H, lay, v: Object.freeze({ box: Object.freeze({ x: m, y: m, w: W - 2 * m, h: L.footY - (px + 12) / 2 - 10 - m }), cy: L.logoCy - 35.5 * L.logoScale, dev: lay === "p" ? "p" : "d" }) };
  return tlb.v;
}
/* INTRO chrome (opening spec §3/§7). Title (stage 0): logo reveal (fade +
   slide 0.9 s, a 0.92 -> 1 pop over 0.45 s: the old GRID letters' pop, on
   the whole logo) then a +-2 px bob on 16S, and a prompt that fades in from
   0.6 s and pulses 0.45<->1 on the beat (4S). Show (stage 1): logo and prompt
   exit up over 0.3 s, the spark still flickering at the tip (it runs up the
   cord over that 0.3 s only if TITLE_RUNUP), the veil drops 0.45 -> 0.12 by
   8S, and the skip hint
   appears only past SKIP_GUARD. lay is body[data-lay] (p/l = touch copy);
   rk is the board-ready fraction: 0 paints an opaque veil (3D still loading),
   1 the stage veil. o: {level (the world the logo wears), reduced (REDUCE FLASH)}. */
export function drawIntroChrome(c, stage, t, W, H, lay, rk = 1, o = {}) {
  const L = layout(W, H),
    touch = lay === "p" || lay === "l",
    show = stage === 1,
    dpr = deviceScale(c);
  if (kitProbe.probe.on) kitProbe.begin("title", { w: W, h: H, dpr, el: "c" });
  const v0 = show ? 0.45 + (0.12 - 0.45) * easeInOutCubic(seg(t, 0, 8 * SHOW_STEP)) : 0.45;
  c.fillStyle = "rgba(7,10,18," + (rk >= 1 ? v0 : 1 - clamp01(rk) * (1 - v0)) + ")";
  c.fillRect(0, 0, W, H);
  const reveal = show ? 1 : easeOutCubic(seg(t, 0, TITLE_IN)),
    exit = show ? easeInCubic(seg(t, 0, 0.3)) : 0;
  const a = reveal * (1 - exit);
  if (a > 0.01) {
    const bob = show ? 0 : 2 * Math.sin((2 * Math.PI * t) / (16 * SHOW_STEP));
    const slide = 14 * (1 - reveal) - 20 * exit + bob;
    c.save();
    c.translate(0, slide);
    c.globalAlpha *= a;
    const B = titleLogoBox(W, H, lay);
    drawLogo2d(c, { level: o.level, place: "title", box: B.box, cy: B.cy, dev: B.dev, dpr, touch, t, run: show && TITLE_RUNUP ? seg(t, 0, 0.3) : undefined, reduced: o.reduced, scale: show ? 1 : 0.92 + 0.08 * easeOutBack(seg(t, 0, 0.45)) });
    c.restore();
  }
  const pin = show ? 1 - exit : easeOutCubic(seg(t, 0.6, TITLE_IN));
  if (pin > 0.01) {
    // touch copy is phone-sized: the stage scales to ~0.6 on a portrait phone
    const px = touch ? 26 : 18,
      prompt = touch ? "TAP TO START" : "PRESS ANY KEY OR BUTTON";
    // a steady dark box (drawAttractHint's idiom) under a fill that pulses
    // 0.45<->1 on the beat: legible at the pulse minimum over bright bricks
    c.globalAlpha = pin;
    backing(c, L.cx, L.footY, prompt.length * px * 0.6 + 24, px + 12);
    c.font = font(px, "900");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.globalAlpha = show ? pin : pin * (0.725 + 0.275 * Math.cos((2 * Math.PI * t) / (4 * SHOW_STEP)));
    c.fillStyle = ACCENT;
    c.fillText(prompt, L.cx, L.footY);
    c.globalAlpha = 1;
    if (kitProbe.probe.on) { const w = c.measureText(prompt).width; kitProbe.text(prompt, L.cx - w / 2, L.footY - 0.35 * px, w, 0.7 * px, { role: "primary", col: ACCENT, px }); }
  }
  const ha = show ? easeOutCubic(seg(t, SKIP_GUARD, SKIP_GUARD + 0.3)) : 0;
  if (ha > 0) {
    const px = touch ? 18 : 10,
      hint = tapAt(touch, o.tap) ? "TAP TO SKIP" : hints().dev === "pad" ? "ANY BUTTON TO SKIP" : "ANY KEY TO SKIP",
      w = hint.length * px * 0.6,
      y = H - 8 - px / 2;
    c.globalAlpha = ha;
    backing(c, W - 14 - w / 2, y, w + 16, px + 8);
    c.fillStyle = MUTED;
    c.font = font(px);
    c.textAlign = "right";
    c.textBaseline = "middle";
    c.fillText(hint, W - 14, y);
    c.globalAlpha = 1;
  }
}
function backing(c, cx, cy, w, h) {
  c.fillStyle = "rgba(7,10,18,0.9)";
  c.fillRect(cx - w / 2, cy - h / 2, w, h);
  c.strokeStyle = LINE;
  c.lineWidth = 1;
  c.strokeRect(cx - w / 2 + 0.5, cy - h / 2 + 0.5, w - 1, h - 1);
}
/* MAIN MENU: the page is src/render/pages/menu.js (UI upgrade v202 Task 3.1): one geometry for draw and tap, rows by name. These keep the
   entry names shellview, the pointer and the tests call; L is layout(W, H, lg, css) for the box the page draws on (css: CSS px per box unit, the
   touch floors' scale), touch body[data-lay] p / l, the same argument for draw and tap. */
/* tap: THE tap mode (shellview tapOf) a draw hands in through its ui; a hit's frame (the pointer has none) takes the mode the last page frame was
   drawn in, so a tap's geometry is the one on screen (GUIDE's lines follow it); undefined until a page is drawn (the page's fallback, hintcopy tapAt) */
let tapNow;
const drawn = (tap) => (tapNow = tap == null ? undefined : !!tap);
const frameOf = (L, touch, tap) => ({ W: L.W, H: L.H, touch: !!touch, shell: !!L.shell, css: L.css, play: L.play, tap: tap !== undefined ? tap : tapNow });
export const menuGeom = (L, _n, touch) => menuPage.menuGeom(frameOf(L, touch));
export const menuHit = (x, y, L, _n, touch) => menuPage.menuHit(x, y, frameOf(L, touch));
export const drawMenu = (c, ui, L, t, touch) => menuPage.drawMenuPage(c, frameOf(L, touch, drawn((ui || {}).tap)), ui || {}, t);

/* LEVEL SELECT: the page is src/render/pages/level.js (UI upgrade v202 Task 3.3): one geometry for draw and tap, rects by name. These keep the
   entry names shellview, the pointer and the tests call; L is layout(W, H, lg, css) for the box the page draws on, touch body[data-lay] p / l, open
   the MODIFIERS list (app.modOpen): the same arguments for draw and tap. */
const NO_FOCUS = () => -1;
let modeFocus = NO_FOCUS;
/** The LEVEL SELECT MODIFIERS entry a controller's TRIGGER has focused, as a getter: -1 = none. Set once by main; shellview's info does not carry it. */
export function setModeFocus(f) { modeFocus = f || NO_FOCUS; }
export function modeFocusOf() { return modeFocus(); }
const lvOpt = (unlocked, open, row) => ({ unlocked: !!unlocked, open: !!open, row: row || LABEL.LEVEL });
/* row: the focused row's name (app.levelRow), which picks a paged compact's page */
export const levelGeom = (L, unlocked, touch, open, row) => levelPage.levelGeom(frameOf(L, touch), lvOpt(unlocked, open, row));
export const levelHit = (x, y, L, unlocked, touch, open, row) => levelPage.levelHit(x, y, frameOf(L, touch), lvOpt(unlocked, open, row));
export const LEVEL_TAP = levelPage.LEVEL_TAP, LEVEL_TAP_LIST = levelPage.LEVEL_TAP_LIST;
/** LEVEL SELECT's foot words for the focused row (or the open list), label first and keycap last: the page's footItems as one line. */
export const levelFoot = (row, open) => levelPage.footText(levelPage.footItems(row || LABEL.LEVEL, !!open));
/* info = {best: [8 formatted times or null] at this difficulty, speed and modifiers, row (the focused row's name), open, cur (the list), tap (THE tap mode,
   shellview tapOf; absent = the mode the last page frame was drawn in, else hintcopy tapAt), lockR, lockT, enterT, rev (MENU's build tag: the shared room's dpr)} from shellview (times arrive formatted; this file never reads a store). */
export function drawLevelSelect(c, sel, L, t, heat, pact, unlocked, pace, timeAttack, touch, info) {
  const I = info || {}, U = !!unlocked, lv = sel | 0 || 1;
  levelPage.drawLevelPage(c, frameOf(L, touch, drawn(I.tap)), { level: lv, heat, pace, pact: U ? pact | 0 : 0, time: U && !!timeAttack, unlocked: U, best: (I.best || [])[lv - 1] || null, row: I.row || LABEL.LEVEL, open: !!I.open, cur: I.cur, trig: modeFocus(), tap: I.tap, lockR: I.lockR, lockT: I.lockT, enterT: I.enterT, rev: I.rev }, t);
}

/* LAZY PAGES (R20, R1: one plate, one ask; AGENTS.md "Lazy pages"). _rec.want: the test seam. */
export const _rec = { want: (n) => lazy.want(n) };
const RETRY_MS = 3000, nowMs = () => (globalThis.performance && typeof performance.now === "function" ? performance.now() : 0), asks = {};
function lazyMod(name) {
  const m = lazy.get(name);
  if (m) return m;
  const a = asks[name] || (asks[name] = { fails: 0, at: -Infinity, seen: null });
  if (a.fails < 2 || nowMs() - a.at >= RETRY_MS)
    Promise.resolve().then(() => {
      const p = _rec.want(name);
      return Promise.resolve(p).then(() => { a.fails = 0; }, () => { if (a.seen !== p) { a.seen = p; a.fails++; a.at = nowMs(); } });
    });
  return null;
}
const loadHit = (x, y, F) => { const B = loadBox(F); return x >= B.x && x < B.x + B.w && y >= B.y && y < B.y + B.h ? -2 : -1; };
const failedOf = (name) => !!(asks[name] && asks[name].fails > 0);
/* the run ends (scenes.js, v202 Tasks 5.2-5.4) reach their lazy pages through the same one ask and the same failed state */
export { lazyMod as lazyPage, failedOf as lazyFailed, loadBox };
/* a lazy page's hit before its module is in: inert (-2) while it loads; once the plate says DID NOT LOAD, SETTINGS' rule on every lazy page: -2 on
   the plate, -1 off it (backs out), so a touch player is never stuck on a failed page (lane lesson 5) */
const lazyHit = (name, x, y, F) => (failedOf(name) ? loadHit(x, y, F) : -2);
/** THE LOADING plate (kit room.js loadingPlate); DID NOT LOAD while name's last import failed. ui: {level, rev, paused, failed}. */
export function loadingPage(c, F, title, ui, name) {
  const u = ui || {}, a = asks[name];
  loadingPlate(c, F, { level: u.level, rev: u.rev, paused: u.paused, title, dpr: capDpr(deviceScale(c), !!F.touch), line: u.failed || (a && a.fails > 0) ? LOAD_WORDS.failed : LOAD_WORDS.loading });
}

/* GUIDE and its four pages are src/render/pages/guide.js (UI upgrade v202 Task 3.5), lazy (pages/lazy.js "guide"): one geometry for draw and
   tap, names by label. These keep the entry names shellview, the pointer and the tests call; L is layout(W, H, lg, css) for the box the page draws
   on, touch body[data-lay] p / l, o = {level (the world), foe (ENEMIES' focused foe), tip (its tooltip open)}. Until the module is in, a page
   paints the LOADING plate (loadingPage) and its hits find nothing (-2: inert, so a tap while it loads never backs out) until the plate says DID NOT
   LOAD: then a tap off the plate backs out (lazyHit, SETTINGS' rule). */
const guideMod = () => lazy.get("guide");
const gui = (page, kind, L, o, focus) => ({ page, focus, tip: !!(o && o.tip), pg: (o && o.pg) | 0, level: (o && o.level) | 0 || 1, look: kind === "px" ? "px" : "2d", narrow: !!L.narrow, rev: o && o.rev });
const guideLoading = (c, L, touch, title, o) => loadingPage(c, frameOf(L, touch, drawn(o && o.tap)), title, { level: o && o.level, rev: o && o.rev }, "guide");
const guidePage = (page) => (c, L, t, kind, touch, o) => { const g = lazyMod("guide"); if (!g) return guideLoading(c, L, touch, page, o); g.drawGuidePage(c, frameOf(L, touch, drawn(o && o.tap)), gui(page, kind, L, o, o && o.foe != null ? o.foe : null), t); };
export const drawHowTo = guidePage("HOW TO PLAY");
export const drawItemsHelp = guidePage(LABEL.POWER_UPS);
export const drawEnemiesHelp = guidePage("ENEMIES");
export const drawFloorHelp = guidePage("FLOOR");
export function drawGuide(c, L, t, cursor, kind, touch, o) {
  const g = lazyMod("guide");
  if (!g) return guideLoading(c, L, touch, "GUIDE", o);
  g.drawGuidePage(c, frameOf(L, touch, drawn(o && o.tap)), gui("GUIDE", kind, L, o, g.DOORS[cursor | 0]), t);
}
/** The GUIDE page's geometry (pages/guide.js guideGeom), null until the module is in. */
export const guideGeom = (L, touch, page) => { const g = guideMod(); return g ? g.guideGeom(frameOf(L, touch), page || "GUIDE") : null; };
export const guideHit = (x, y, L, _n, touch, focus) => { const g = guideMod(), F = frameOf(L, touch); return g ? g.guideHit(x, y, F, focus | 0) : lazyHit("guide", x, y, F); };
export const enemiesHit = (x, y, L, touch, focus, tip) => { const g = guideMod(), F = frameOf(L, touch); return g ? g.enemiesHit(x, y, F, focus | 0, !!tip) : lazyHit("guide", x, y, F); };
/** A read-only page (HOW TO PLAY, POWER-UPS, FLOOR) showing page pg: the kit's {k: "page", d, to} on its page keys, else -1 (backs out); -2 while it loads (DID NOT LOAD: -1 off the plate). */
export const guideReadHit = (x, y, L, touch, page, pg) => { const g = guideMod(), F = frameOf(L, touch); return g ? g.readHit(x, y, F, page, pg | 0) : lazyHit("guide", x, y, F); };
/** How many pages a GUIDE page takes on this box (1 until the module is in). */
export const guidePages = (L, touch, page) => { const g = guideMod(); return g ? g.guideGeom(frameOf(L, touch), page).pages : 1; };

/* RECORDS' three tabs (SCORES, STATS, MEDALS) are src/render/pages/records.js (UI upgrade v202 Tasks 4.1 / 4.2), a lazy page (pages/lazy.js): until it
   lands they paint the LOADING plate and every hit is inert (-2, or "plate"), until the plate says DID NOT LOAD: then a tap off it backs out. The entry names stay: shellview, the pointer and the tests call them. ui is
   the page's (records.js drawRecordsPage); L is layout(W, H, lg, css) for the box the page draws on, touch body[data-lay] p / l. */
const recMod = () => lazy.get("records");
const recDraw = (page) => (c, ui, L, t, touch) => {
  const m = lazyMod("records"), F = frameOf(L, touch, drawn(ui && ui.tap));
  if (m) return m.drawRecordsPage(c, F, { ...ui, page }, t);
  return loadingPage(c, F, LABEL.RECORDS, ui || {}, "records");
};
export const drawScores = recDraw("scores"), drawStats = recDraw("stats"), drawTrophies = recDraw("medals");
/* The RECORDS tab under a tap, else -1; -2 while the page module is still loading (inert; DID NOT LOAD: -1 off the plate). */
export const recTabHit = (x, y, L, _page, touch) => { const m = recMod(), F = frameOf(L, touch); return m ? m.tabHit(x, y, F) : lazyHit("records", x, y, F); };
/* SCORES: the difficulty under a tap, -2 on the plate (inert), -1 off it or on the BACK key (main backs out). */
export const scoresHit = (x, y, L, touch, spage) => { const m = recMod(), F = frameOf(L, touch); return m ? m.scoresHit(x, y, F, spage | 0) : lazyHit("records", x, y, F); }; // spage: the page shown (a split SCORES' bank answers on its first only)
/* STATS: a key code (KeyC / KeyR / KeyT), "back", "plate" (inert) or, armed, "cancel" (records.js statsHit); "plate" while loading, "back" off a DID NOT LOAD plate. */
export const statsHit = (x, y, L, arm, _tabs, touch, spage) => { const m = recMod(), F = frameOf(L, touch); return m ? m.statsHit(x, y, F, arm, spage | 0) : lazyHit("records", x, y, F) === -1 ? "back" : "plate"; }; // spage: the page shown (a paged #c STATS keeps COPY / RESET on its last)
/* A RECORDS tab's page count on this box (records.js recPages: 1 where its body fits unpaged, and while the module loads); page scores | stats | medals. */
export const recPages = (L, touch, page, rows) => { const m = recMod(); return m ? m.recPages(frameOf(L, touch), page, rows) : 1; };
/* A RECORDS tab's page keys under a tap: the kit's {k: "page", d, to}, else null (rows: SCORES' rows, whose count sets its pages). */
export const recPageHit = (x, y, L, touch, page, rows) => { const m = recMod(); return m ? m.pageKeyHit(x, y, frameOf(L, touch), page, rows) : null; };

/* SETTINGS and GRAPHICS (SCREEN.SETTINGS / GRAPHICS; PAUSE views 1 and 2): the page is src/render/pages/settings.js (UI upgrade v202 Task 3.4),
   lazy (R20) through pages/lazy.js. These keep the entry names shellview, the pointer and the tests call, with the same arguments for draw and
   tap: L is layout(W, H, lg, css) for the box the page draws on (PAUSE: overlayBox's), touch body[data-lay] p / l (the draw reads ui.touch).
   Until the module is in: THE LOADING plate, -2 on it, -1 off it, *Geom null. ui is the page's (see its header); rows the visible list. */
const page = () => lazy.get("settings");
const setFrame = (L, touch, tap) => ({ ...frameOf(L, touch, tap), paused: !!L.paused, free: !!L.free, focus: L.focus });
/* kit/copy.js words (CONTROLS' foot reads FOOT_TAP too) */
export { FOOT_TAP, LOOK_NAME, lookVal };
/** SETTINGS' geometry for the visible rows (pages/settings.js settingsGeom on this box); null until the page is in. */
export const settingsGeom = (L, touch, rows) => { const m = page(); return m ? m.settingsGeom(setFrame(L, touch), rows) : null; };
export const graphicsGeom = (L, touch) => { const m = page(); return m ? m.graphicsGeom(setFrame(L, touch)) : null; };
/** A tap's index into rows (the visible list optRow indexes, R11); -2 inert on the plate, -1 off it (or on the phone's BACK). */
export const settingsHit = (x, y, L, rows, touch) => { const m = page(), F = setFrame(L, touch); return m ? m.settingsHit(x, y, F, rows) : loadHit(x, y, F); };
export const graphicsHit = (x, y, L, _n, touch) => { const m = page(), F = setFrame(L, touch); return m ? m.graphicsHit(x, y, F) : loadHit(x, y, F); };
export function drawSettings(c, L, t, ui) {
  const u = ui || {}, F = setFrame(L, u.touch, drawn(u.tap)), m = page();
  if (lazyMod("settings")) return m.drawSettingsPage(c, F, u, t);
  loadingPage(c, F, LABEL.SETTINGS, u, "settings");
}

/* RENDER row job states (v202 delivery, design 2026-11-06 "What the player
   sees"). The value slot carries the job of the look being prepared and a 2 px
   line along the band's bottom its honest fill; nothing reflows. app.lookJob =
   {k, state:"loading"|"preparing"|"ready"|"failed", phase, done, total} (fill /
   slow when jobs.js hands them); lookNote is the pure memo step shellview runs
   every frame: a live wait shows nothing new for NOTE_HOLD, a finished one that
   was shown reads READY for READY_T, a failure shows at once. */
export const NOTE_HOLD = 0.4, READY_T = 0.8;
const PH_ORDER = ["bake", "build", "shaders", "warm"];
/* 0..1, or -1 = no count (still stripes, never a made-up share). Without
   job.fill: files own [0, .5), each prepare phase a fixed eighth after them. */
export function jobFill(j) {
  if (typeof j.fill === "number") return clamp01(j.fill);
  const n = j.total > 0 ? clamp01((j.done | 0) / j.total) : -1;
  if (j.state === "loading") return n < 0 ? -1 : 0.5 * n;
  const i = PH_ORDER.indexOf(j.phase);
  return i < 0 || n < 0 ? -1 : 0.5 + 0.125 * (i + n);
}
const lookOf = (j) => (j && LOOK_NAME[j.k] ? j : null);
export function lookNote(m, job, now, pick) {
  const j = lookOf(job);
  if (j && j.state !== "ready") {
    if (!m || m.k !== j.k || m.readyT != null) m = { k: j.k, t0: now, fill: 0, shown: false };
    if (j.state === "failed") { m.shown = m.fail = true; return { m, n: { k: j.k, st: "fail", fill: -1 } }; }
    m.fail = false;
    const f = jobFill(j);
    if (f >= 0) m.fill = Math.max(m.fill, f);
    if (!m.shown && now - m.t0 < NOTE_HOLD) return { m, n: null };
    m.shown = true;
    return { m, n: { k: j.k, st: j.state, phase: j.phase, done: Math.min(j.done | 0, j.total | 0), total: j.total | 0, slow: !!j.slow, fill: f < 0 ? -1 : m.fill } };
  }
  if (m && m.shown && !m.fail && m.k === pick && (!j || j.k === m.k)) {
    if (m.readyT == null) m.readyT = now;
    if (now - m.readyT < READY_T) return { m, n: { k: m.k, st: "ready", fill: 1 } };
  }
  return { m: null, n: null };
}
/* GRAPHICS' rows arrive finished from the app (gfx.js owns every string; this file must not import src/app): ui = {row, view, togT, chg, kicker,
   touch, level, paused}; the page draws them (pages/settings.js drawGraphicsPage). */
export const GFX_N = 8; // pinned equal to gfx.js GFX_ROWS.length
export function drawGraphics(c, L, t, ui) {
  const u = ui || {}, F = setFrame(L, u.touch, drawn(u.tap)), m = page();
  if (lazyMod("settings")) return m.drawGraphicsPage(c, F, u, t);
  loadingPage(c, F, "GRAPHICS", u, "settings");
}


/* FPS METER chip (GRAPHICS row 7): bottom-right of the box on every screen.
   info is app.gfx {fps, kind, dpr3d, dprPx, limit} or null before the frame
   loop has reported; density shows only in REAL 3D and PIXEL. idle tags the
   screens the gate holds at the idle rate (menus, PAUSE, WIN/LOSE, ATTRACT),
   so a 30 read beside FRAME RATE 60 explains itself. xOf mirrors
   gfx.js's one-decimal format (pinned equal in menudraw.test). */
const xOf = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "") + "X";
export function meterText(info, idle) {
  const i = info || {},
    d = i.kind === "3d" ? i.dpr3d : i.kind === "px" ? i.dprPx : 0;
  return (typeof i.fps === "number" ? String(Math.round(i.fps)) : "--") + " FPS" +
    (d > 0 ? " · " + xOf(d) : "") + (idle ? " · IDLE" : "") + (i.limit ? " · LIMIT" : "");
}
export function drawMeter(c, W, H, info, idle) {
  const s = meterText(info, idle),
    w = s.length * 5.4 + 10;
  c.fillStyle = "rgba(8,12,22,0.78)";
  c.fillRect(W - 4 - w, H - 18, w, 14);
  c.fillStyle = MUTED;
  c.font = font(9, "900");
  c.textAlign = "right";
  c.textBaseline = "middle";
  c.fillText(s, W - 9, H - 11);
}

/* ATTRACT hint: 1Hz-blink footer over the live demo (spec §5.6). */
export function drawAttractHint(c, L, t) {
  if (t % 1 >= 0.6 && t < 100) return;
  const w = 220;
  c.fillStyle = "rgba(8,12,22,0.78)";
  c.fillRect(L.cx - w / 2, L.footY - 12, w, 24);
  c.strokeStyle = LINE;
  c.strokeRect(L.cx - w / 2 + 0.5, L.footY - 11.5, w - 1, 23);
  c.fillStyle = ACCENT;
  c.font = font(11, "900");
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(hints().dev === "pad" ? "DEMO — PRESS ANY BUTTON" : "DEMO — TAP TO PLAY", L.cx, L.footY);
}

/* Full-canvas veil washes. */
export function drawDim(c, alpha, W, H) {
  c.fillStyle = "rgba(7,10,18," + Math.max(0, Math.min(1, alpha)) + ")";
  c.fillRect(0, 0, W, H);
}
