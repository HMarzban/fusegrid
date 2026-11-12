import { CFG, isFinale, biomeOf } from "../core/config.js";
import { HEAT_COL, heatToken } from "../core/heat.js";
import { drawIcon } from "./sprites.js";
import { rr } from "./icons.js";
import { PROJ } from "./r3d/camera.js";
import { LABEL, diffTag, speedTag, runParts } from "./words.js";
import { abilityList, abilityText, abilityOrd, getStrip } from "./fx.js";
import { drawPause, VEIL as PAUSE_VEIL } from "./pages/pause.js";
import { hints } from "./hintcopy.js";
import { endTap, endMode, endPagesOf } from "./pages/endgeom.js";
import * as lazy from "./pages/lazy.js";
import { loadingPage, lazyPage, lazyFailed, loadBox } from "./menudraw.js";

/* Scene UI: HUD, and the CLEARED / GAME OVER / PAUSED overlays.
   Pure draw; reads world + (optionally) DOM for HUD. The MENU logo is the MENU
   page header's (pages/menu.js). */
export function overlayCue(world, touch, words) {
  const W = words || hints(),
    pad = W.dev === "pad";
  /* PAUSE only: the run ends carry their own keys (pages/endgeom.js endFacts().keys, v202 Task 5.2) */
  if (world.state === "PAUSE") {
    if (pad) return W.pause + " · " + W.back + " RESUME · ↑↓ MOVE · " + W.ok + " CONFIRM";
    return touch ? "TAP A ROW · PAUSE PILL RESUMES" : W.back + " · " + W.pause + " RESUME · ↑↓ MOVE · " + W.ok + " CONFIRM · M QUIT";
  }
  return "";
}
export function runStamp(world) {
  const lv = world.level | 0;
  return LABEL.LEVEL + " " + lv + " · " + biomeOf(lv).name + " · " + diffTag(world.heat) + " · " + (world.score | 0);
}
export function copyPayload(world) {
  return runStamp(world) + " https://hmarzban.github.io/fusegrid/";
}
/* R7 stopwatch formatting. Pure, exported, pinned. Clamped to [0,599.9] and
   FLOORED to tenths so it can never disagree with what times.js stored; a room
   past 9:59.9 pins there, since it is not a time-attack contender. Always six
   characters or fewer, which is what makes the HUD chip's width budget hold. */
export function fmtTime(sec) {
  const n = typeof sec === "number" && isFinite(sec) ? sec : 0;
  const s = Math.min(599.9, Math.max(0, n));
  const d = Math.floor(s * 10);
  const m = Math.floor(d / 10) % 60;
  return (
    Math.floor(d / 600) + ":" + (m < 10 ? "0" + m : String(m)) + "." + (d % 10)
  );
}
/* R1 run formatting. fmtSpan is a THIRD formatter, not a widening of fmtTime:
   fmtTime clamps at 9:59.9 because its six-character guarantee holds the HUD
   chip's width budget, and a run is 4-13 minutes. fmtSpan clamps at 99:59; a
   run left idling in PLAY past 100 minutes pins there, disclosed. STATS'
   lifetime clock is a third range again (fmtLong, src/app/stats.js). */
export function fmtSpan(sec) {
  const n = typeof sec === "number" && isFinite(sec) ? sec : 0;
  const s = Math.floor(Math.min(5999, Math.max(0, n)));
  const m = s % 60;
  return Math.floor(s / 60) + ":" + (m < 10 ? "0" + m : String(m));
}
/* bestLabel names the EXACT bucket the record is kept in, so the sentence can
   never be read against the wrong record: the difficulty always, the speed and
   each modifier when they are not the default, every one named (words.js). */
export function bestLabel(world) {
  const w = world || {};
  return runParts({ heat: w.heat, pace: w.pace, pact: w.pact }, { diff: true }).join(" · ");
}
/* The display edge and the persist edge are the SAME edge. A mid-room NEW BEST
   claims a record that has not been written and that a later death can still
   take back, and repeating it on rooms 3, 4 and 5 cheapens the one line the
   whole feature exists for. isFinale is the same predicate endgeom.endMode
   uses, which AGENTS.md requires of overlay code. */
export function isRunEnd(world) {
  const w = world || {};
  return (
    w.state === "LOSE" ||
    (w.state === "WIN" && (isFinale(w.level) || !!w.finale))
  );
}
/* On a daily run this REPLACES the record line (GAME OVER's tail, a finale's score ribbon): the day's comparison
   is the one that matters that day, and the nb.bests.v1 write still happens so
   nothing is lost from the record. The speed is printed because the daily
   pins NORMAL SPEED and ignores the player's own — an ignored setting is shown,
   never swallowed. "YOUR" is the honesty word and it is free. */
export function dailyLine(world, run) {
  const w = world || {}, r = run || {};
  return (
    "DAILY " + r.daily + " · " + speedTag(w.pace) +
    " · TRY " + (r.tries | 0) + " · YOUR BEST " + (r.dbest | 0)
  );
}
/* PAUSE (v202 Task 5.1) is a page on the world kit, src/render/pages/pause.js: its rows, shape, geometry, tap map and look tail live there and are
   re-exported here, where the overlay and its readers have always found them. */
export { PAUSE_ROWS, PAUSE_SHAPE, PAUSE_ROW_H, PAUSE_ROW_D, pauseGeom, pauseHit, pauseKick, pauseKickers, pauseKicker } from "./pages/pause.js";
/* The ONE named coordinate space for pause chrome: it feeds both drawOverlay
   call sites and both hit tests, so the list, the inline SETTINGS page and the
   tap map can never disagree by a pixel. */
export function overlayBox(kind) {
  if (kind === "iso")
    return { w: PROJ.canvasW, h: PROJ.canvasH, cx: 304, cy: 188 };
  const w = CFG.COLS * CFG.TILE,
    h = CFG.ROWS * CFG.TILE;
  return { w, h, cx: w / 2, cy: h / 2 };
}
/* body[data-lay] p / l (fit.js) = a touch layout: the one predicate the
   pause draw (through its ctx's canvas) and main's tap map both read. */
export const touchLay = (el) => {
  const d = el && el.ownerDocument,
    l = d && d.body && d.body.getAttribute && d.body.getAttribute("data-lay");
  return l === "p" || l === "l";
};
const touchOf = (c) => touchLay(c && c.canvas);
/* The run-end pages by mode (v202 Tasks 5.2-5.4): a mode with no page here keeps today's summary and its tap-anywhere; a registered one draws
   its page once the lazy module is in, a LOADING plate until then, and its taps go through endgeom's keys. endReady(mode) is that state for
   endTap: null (no page), false (loading), true. */
const lazyEnd = (n) => () => (typeof document !== "undefined" ? lazyPage(n) : lazy.get(n)); // the one ask (menudraw lazyPage: re-asked, a failure retried); Node never imports: tests hand the page in (lazy._set)
const END_NAME = Object.freeze({ clear: "endwin", fin: "endwin", lose: "endlose" });
const END_PAGES = Object.freeze({ clear: lazyEnd("endwin"), fin: lazyEnd("endwin"), lose: lazyEnd("endlose") });
const endPage = (mode) => (END_PAGES[mode] ? END_PAGES[mode]() : undefined);
/* a run-end page not in yet: the veil, then THE LOADING plate (menudraw loadingPage: kit room.js loadingPlate, no room under it, DID NOT LOAD once its
   import failed) in the played room's world, titled with the level; its taps find nothing while it loads, and once it failed a tap off the plate
   is MENU (endHitAt), so a touch player is never stuck */
const endFrame = (w, h, run) => ({ W: w, H: h, touch: !!run && (run.lay === "p" || run.lay === "l"), shell: false, css: run && run.css > 0 ? run.css : 0 });
function endLoading(c, world, w, h, run, mode) {
  c.save(); c.fillStyle = "rgba(11,6,9,0.45)"; c.fillRect(0, 0, w, h); c.restore();
  const lv = world.level | 0 || 1;
  loadingPage(c, endFrame(w, h, run), LABEL.LEVEL + " " + lv, { level: lv, paused: true }, END_NAME[mode]);
}
export const endReady = (mode) => { const p = endPage(mode); return p === undefined ? null : !!p; };
/* main's run-end tap: x y in the overlay box of the look (overlayBox), run / tm as main hands them to drawOverlay (run.lay, run.css: the layout
   and the stage's CSS px per box unit) */
let mc;
const mctx = () => { if (mc === undefined) { try { mc = typeof document !== "undefined" && document && typeof document.createElement === "function" ? document.createElement("canvas").getContext("2d") : null; } catch (e) { mc = null; } } return mc; }; // the run end's measure for a tap (the page measures on its own context: same fonts, same widths)
const endOpts = (run) => ({ lay: run && run.lay, css: run && run.css, page: run && run.page, m: mctx() });
export const endHitAt = (x, y, kind, world, run, tm) => {
  const mode = endMode(world), B = overlayBox(kind);
  if (endPage(mode) === null && lazyFailed(END_NAME[mode])) { const P = loadBox(endFrame(B.w, B.h, run)); return x >= P.x && x < P.x + P.w && y >= P.y && y < P.y + P.h ? null : "menu"; }
  return endTap(x, y, B, world, run, tm, endOpts(run), endReady);
};
export const endPagesAt = (kind, world, run, tm) => endPagesOf(overlayBox(kind), world, run, tm, endOpts(run));
export function drawOverlay(
  c,
  world,
  w = CFG.COLS * CFG.TILE,
  h = CFG.ROWS * CFG.TILE,
  cx = w / 2,
  cy = h / 2,
  ui = { view: 0, cursor: 0 },
  tm,
  run,
  toast,
) {
  const mode = endMode(world), page = mode ? endPage(mode) : undefined;
  if (page === null) return endLoading(c, world, w, h, run, mode);
  if (page) return void (mode === "lose" ? page.drawLose : page.drawWin)(c, { w, h }, world, run, tm, toast);
  if (world.state !== "PAUSE") return;
  c.fillStyle = world.state !== "PAUSE" ? "rgba(6,10,20,0.80)" : ui && ui.view | 0 ? "rgba(7,10,18,0.72)" : PAUSE_VEIL; // the PAUSE list wears the kit's veil (.6); the inline pages keep theirs
  c.fillRect(0, 0, w, h);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = 5;
  c.strokeStyle = "#0a0d14";
  c.lineJoin = "round";
  {
    const u = ui || {};
    /* view 1 / 2 / 3 = the inline SETTINGS / GRAPHICS / CONTROLS page: veil only, so
       drawShell's plate never lands on top of a live PAUSED headline. */
    if ((u.view | 0) >= 1) return;
    /* Static (R16: PAUSE freezes everything) — no entry timer. Every look calls this one painter (pages/pause.js). */
    drawPause(c, world, { w, h }, { ...u, touch: u.touch == null ? touchOf(c) : !!u.touch }, tm, run); // css (#c's stage scale) arrives in ui from main, the value pointer.js taps with
  }
}

/* S4 overlay HUD chips (real3d §3): lives as heart glyphs, BOMB/FLAME/LV/
   ENEMIES as icon+count (or label-only) chips, painted on the overlay ctx
   in board space — the sole in-game HUD since the DOM #hud strip was
   removed (GUIDE+HUD plan). Palette and mono type match menudraw.
   Opt-in per frame via o.hud===true so menus/attract keep their authored
   canvases untouched. ico (W5, PIXEL only) paints the heart and chip glyphs
   as ico(c, type, col, cx, cy) in place of the scaled drawIcon block; absent,
   the call log is byte-identical to before. */
const HUD_TEXT = "#dfe7f5",
  HUD_MUTED = "#7385ad",
  HUD_PANEL = "rgba(13,18,32,0.72)",
  HUD_LINE = "#26324a";
export function drawHudChips(c, world, tm, ico) {
  const p = world.players[0] || {};
  c.save();
  c.textBaseline = "middle";
  c.textAlign = "left";
  const lives = Math.max(0, world.lives | 0);
  const n = Math.min(lives, 6);
  /* one band behind the whole row, so the hearts, the chips and the score
     read on the same ground; each chip is an outline on it */
  const panel = (x, w, fill) => {
    if (fill) {
      c.fillStyle = HUD_PANEL;
      c.fillRect(x, 10, w, 30);
    }
    c.strokeStyle = HUD_LINE;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, 10.5, w - 1, 29);
  };
  panel(10, CFG.COLS * CFG.TILE - 22, true);
  for (let i = 0; i < n; i++) {
    if (ico) { ico(c, "heart", "#ff3b5c", 16 + i * 19, 25); continue; }
    c.save();
    c.translate(16 + i * 19, 25);
    c.scale(0.62, 0.62);
    drawIcon(c, "heart", "#ff3b5c", 0);
    c.restore();
  }
  if (lives > n) {
    c.fillStyle = HUD_TEXT;
    c.font = "900 12px ui-monospace,monospace";
    c.fillText("+" + (lives - n), 16 + 6 * 19, 25);
  }
  const chip = (x, w, label, count, col, icon) => {
    panel(x, w);
    let tx = x + 10;
    if (icon && ico) {
      ico(c, icon, col, x + 17, 25);
      tx = x + 31;
    } else if (icon) {
      c.save();
      c.translate(x + 17, 25);
      c.scale(0.55, 0.55);
      drawIcon(c, icon, col, 0);
      c.restore();
      tx = x + 31;
    }
    c.fillStyle = HUD_MUTED;
    c.font = "9px ui-monospace,monospace";
    c.fillText(label, tx, 18);
    c.fillStyle = HUD_TEXT;
    c.font = "900 13px ui-monospace,monospace";
    c.fillText(String(count), tx, 33);
  };
  chip(140, 76, "BOMB", p.bombs || 0, "#ff5d73", "bomb");
  chip(224, 82, "FLAME", p.range || 0, "#ff8a3c", "fire");
  chip(314, 64, "LV", world.level | 0, null, null);
  /* R7: the ENEMIES chip narrows from 94 to 64 to make room for the stopwatch,
     which ends at 530 against the right-aligned score column's left reach of
     541 at six digits. tm absent or tm.on falsy is byte-identical to before —
     which is what keeps three.test.mjs and pickups.test.mjs unmoved. If a
     headed check ever shows overlap, narrow ENEMIES further; never move the
     right-aligned score column. */
  const ta = !!(tm && tm.on);
  chip(
    386,
    ta ? 64 : 94,
    "ENEMIES",
    Array.isArray(world.enemies) ? world.enemies.length : 0,
    null,
    null,
  );
  if (ta) chip(458, 72, "TIME", fmtTime(tm.t), null, null);
  const scx = CFG.COLS * CFG.TILE - 18;
  c.textAlign = "right";
  const hk = world.heat | 0;
  c.fillStyle = HEAT_COL[hk] || HUD_MUTED;
  c.font = "9px ui-monospace,monospace";
  c.fillText(heatToken(hk), scx, 18);
  c.fillStyle = HUD_TEXT;
  c.font = "900 13px ui-monospace,monospace";
  c.fillText(String(world.score | 0), scx, 33);
  c.restore();
}

/* Ability bar (owner ruling 2026-10-10, research D): the abilities a player
   holds right now, as icon+word chips in the bottom lane (y 486-514), which
   is the border wall row in CLASSIC 2D and PIXEL and sits under the near rim
   at every REAL 3D CAMERA preset (row 11's floor edge projects to y 407.5 at
   STANDARD). Active entries only, in the order SHIELD, KICK, THROW, PASS,
   bomb kind, REMOTE, SPD n; a chip a hit took away (fx.js getStrip) stays in
   its slot, dimmed to ABAR.dim and fading out over ABAR.fade — a static
   fade, never a flash. PLAY and PAUSE only: the WIN/LOSE summary owns the
   lower half of the screen. Holding nothing paints nothing at all (not even
   a save), so every idle call log is unchanged. ico is PIXEL's painter, as
   in drawHudChips; y moves the lane for a canvas of another height. */
export const ABAR = Object.freeze({ x: 16, y: 486, h: 28, gap: 5, fade: 0.6, dim: 0.5, ch: 7.8, min: 9 });
export function abilityChips(p, gone) {
  const on = abilityList(p).map((k) => ({ k, a: 1 }));
  for (const e of gone || [])
    if (!on.some((o) => o.k === e.k && o.a === 1))
      on.push({ k: e.k, a: ABAR.dim * Math.max(0, Math.min(1, e.t / ABAR.fade)) });
  return on.sort((a, b) => abilityOrd(a.k) - abilityOrd(b.k));
}
export function drawAbilityBar(c, world, ico, gone, y) {
  if (!world || (world.state !== "PLAY" && world.state !== "PAUSE")) return;
  const p = world.players && world.players[0];
  const L = abilityChips(p, gone === undefined ? getStrip() : gone);
  if (!L.length) return;
  const Y = typeof y === "number" ? y : ABAR.y,
    cy = Y + ABAR.h / 2,
    mw = (s) => {
      const m = c.measureText ? c.measureText(s) : null;
      return m && m.width > 0 ? m.width : s.length * ABAR.ch;
    };
  c.save();
  c.textBaseline = "middle";
  c.textAlign = "left";
  c.font = "900 13px ui-monospace,monospace";
  /* The row fits the overlay, ABAR.x in from each side. An estimate with no ctx
     call (ABAR.ch, 8 % wide as R13's recorder) clears the usual row, whose call
     log is unchanged; only a row that may not fit (every ability with the
     longest bomb kind) measures itself and steps its type down from 13 px until it fits. */
  const live = L.filter((e) => e.a > 0).map((e) => abilityText(e.k, p)), lab = (t) => (t[1] ? t[0] + " " + t[1] : t[0]),
    room = CFG.COLS * CFG.TILE - ABAR.x, span = (f) => live.reduce((a, t) => a + Math.round(f(lab(t)) + 32) + ABAR.gap, ABAR.x) - ABAR.gap;
  if (span((s) => s.length * ABAR.ch * 1.08) > room)
    for (let k = 13; k > ABAR.min && span(mw) > room; ) c.font = "900 " + --k + "px ui-monospace,monospace";
  let x = ABAR.x;
  for (const e of L) {
    if (!(e.a > 0)) continue;
    const [s, m, col] = abilityText(e.k, p);
    const w = Math.round(mw(m ? s + " " + m : s) + 32);
    c.globalAlpha = e.a;
    c.fillStyle = HUD_PANEL;
    c.fillRect(x, Y, w, ABAR.h);
    c.strokeStyle = HUD_LINE;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, Y + 0.5, w - 1, ABAR.h - 1);
    if (ico) ico(c, e.k, col, x + 13, cy);
    else {
      c.save();
      c.translate(x + 13, cy);
      c.scale(0.6, 0.6);
      drawIcon(c, e.k, col, 0);
      c.restore();
    }
    c.fillStyle = HUD_TEXT;
    c.fillText(s, x + 24, cy + 1);
    if (m) {
      c.fillStyle = "#9fb3d8";
      c.fillText(m, x + 24 + mw(s + " "), cy + 1);
    }
    x += w + ABAR.gap;
  }
  c.restore();
}

/* Ghost coach (first-run nudge): faded MOVE caps + a BOMB pill from the live
   binds (W A S D + SPACE by default, a D-PAD pill on a pad) drawn once so a
   first-time player sees the controls, then never again. In CLASSIC 2D this
   paints straight onto the board context near the spawn tile (1,1); in REAL
   3D it paints onto the fixed HUD-space overlay canvas instead (wrapper.js),
   so it is NOT tied to any world tile there — a fixed on-screen panel, same
   as the HUD chips. Persist state (nb.coach.v1) and the fade duration
   (COACH_DUR) live in src/app/coach.js — render/ must not import src/app
   (only shellview.js may, for screen constants), so main.js precomputes the
   fade alpha from COACH_DUR and passes the plain number down; this file
   never re-derives it. */
const COACH_TEXT = "#eef3ff",
  COACH_PANEL = "rgba(10,14,24,0.82)",
  COACH_LINE = "#3a4a6a";
export function drawCoach(c, alpha) {
  if (!(alpha > 0)) return;
  c.save();
  c.globalAlpha = alpha;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = 1;
  c.strokeStyle = COACH_LINE;
  /* the bottom lane (y 486-514, the border row), right end: never on a board
     tile, clear of the ability bar that grows from the left */
  const W = hints(),
    ks = 22,
    gap = 4,
    pw = Math.max(54, W.bomb.length * 6 + 12),
    caps = (W.moveCaps || [W.move]).map((k) => ({ k, w: W.moveCaps ? (k.length > 1 ? k.length * 6 + 8 : ks) : ks * 4 + gap * 3 })),
    mw = caps.reduce((a, k) => a + k.w, 0) + gap * (caps.length - 1),
    ox = CFG.COLS * CFG.TILE - 20 - (mw + 10 + pw),
    oy = ABAR.y + (ABAR.h - ks) / 2;
  const cap = (x, w, label, size) => {
    c.fillStyle = COACH_PANEL;
    rr(c, x, oy, w, ks, 5);
    c.fill();
    c.stroke();
    c.fillStyle = COACH_TEXT;
    c.font = "900 " + size + "px ui-monospace,monospace";
    c.fillText(label, x + w / 2, oy + ks / 2 + 1);
  };
  let x = ox;
  for (const k of caps) { cap(x, k.w, k.k, k.k.length > 1 ? 10 : 12); x += k.w + gap; }
  cap(x + 6, pw, W.bomb, 10);
  c.restore();
}

/* Coach v2 (R10): the same panel language as the ghost coach above, in
   HUD/overlay space so CLASSIC 2D and REAL 3D are identical — the same space
   drawHudChips and drawCoach use. y=130 sits below the combo callout at 96 and
   well below the HUD chip row, which ends at 40. The text arrives FINISHED:
   main.js composes it in app/coach.js and hands it down, and this file never
   re-derives it, exactly as it never re-derives COACH_DUR. A fade and nothing
   else — no blink, no scale-pop, no colour cycling — so REDUCE FLASH players
   get the same panel rather than no panel. */
export function drawCoach2(c, alpha, text) {
  if (!(alpha > 0) || !text) return;
  const s = String(text);
  const x = (CFG.COLS * CFG.TILE) / 2,
    y = 130,
    w = s.length * 7.2 + 24;
  c.save();
  c.globalAlpha = alpha;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = 1;
  c.strokeStyle = COACH_LINE;
  c.fillStyle = COACH_PANEL;
  rr(c, x - w / 2, y - 13, w, 26, 8);
  c.fill();
  c.stroke();
  c.fillStyle = COACH_TEXT;
  c.font = "900 12px ui-monospace,monospace";
  c.fillText(s, x, y + 1);
  c.restore();
}
