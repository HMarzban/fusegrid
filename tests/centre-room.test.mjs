/* UI upgrade Task 9.6 (owner: "the menu is not in center of screen, and why the board behind is too big?!"). Ruling 1: every plated page on #sh
   centres its plate + foot block in a box taller than it needs; the old top margins are the minimum, never a fixed top, so no page leaves more empty
   box under its block than over it. Ruling 2: the room behind a page is drawn at the board's GAME scale for that box (fit.js fitBox with the HUD
   reserves, handed through the #sh stand-in as play, box units per board unit), never at COVER; the field continues past the board's rampart so the
   box is covered, and the room layer still fits the 24 MiB budget beside MENU's plate. */
import { rec } from "./lib/textrec.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
const K8 = 0.6 * 1.08;
const made = [];
class Cv { constructor(w, h) { this.width = w; this.height = h; this.r = rec({ widthK: K8 }); made.push(this); } getContext() { return this.r.ctx; } }
globalThis.OffscreenCanvas = Cv;
const cache = await import("../src/render/kit/cache.js");
cache.setFactory((w, h) => new Cv(w, h));
const MP = await import("../src/render/pages/menu.js");
const LP = await import("../src/render/pages/level.js");
const SP = await import("../src/render/pages/settings.js");
const CP = await import("../src/render/pages/controls.js"); // Task 6.3: CONTROLS on the world kit, the same rules
const { DEF_KEY: CK, DEF_PAD: CPAD } = await import("../src/render/controlsgeo.js");
const CV = { tab: "pad", device: "pad", row: 1, pad: { state: "ready", name: "CONTROLLER 1 · STANDARD", rumble: true }, key: CK, binds: CPAD, stick: "L", dead: 25, vib: 2 };
const GP = await import("../src/render/pages/guide.js");
const RP = await import("../src/render/pages/records.js");
const md = await import("../src/render/menudraw.js");
const SV = await import("../src/render/shellview.js");
const room = await import("../src/render/kit/room.js");
const { setTextScale } = await import("../src/render/kit/type.js");
const { ITEMS, optRows } = await import("../src/app/menuapp.js");
const { medalRows } = await import("../src/app/medals.js");
const { shellGeo, fitBox } = await import("../src/app/fit.js");
const { biomeOf } = await import("../src/core/config.js");
const { worldTokens } = await import("../src/render/kit/tokens.js");

const fresh = () => { cache.release(); cache._dbg.misses = 0; };
const SIZES = [[1366, 768], [1440, 1100], [1920, 1080]];
const desk = (W, H, ts) => ({ W, H, touch: false, shell: true, css: 1, ts });
const PG = shellGeo(393, 852), phone = (ts) => ({ W: PG.w, H: PG.h, touch: true, shell: true, css: PG.s, ts });
const R10 = optRows(false), VALS = { mus: 70, sfx: 80, snd: 1, cam: 0, bri: 100, shk: 1, flx: 0 };
const GUIDE_PAGES = ["GUIDE", "HOW TO PLAY", "POWER-UPS", "ENEMIES", "FLOOR"];
const MIN_TOP = 70;

/* the plated block: the plate and, where it hangs under the plate, the foot */
const footOf = (G) => G.foot || (G.d && G.d.foot ? { x: G.d.foot.x * G.u, y: G.d.foot.y * G.u, w: G.d.foot.w * G.u, h: G.d.foot.h * G.u } : null); // SETTINGS keeps its foot in G.d (design px)
const block = (G) => { const f0 = footOf(G), f = f0 && f0.y >= G.plate.y + G.plate.h - 0.01 ? f0 : null, b = f ? f.y + f.h : G.plate.y + G.plate.h; return { top: G.plate.y, bot: b }; };
const geoms = (F) => {
  const out = { MENU: MP.menuGeom(F, ITEMS), "LEVEL SELECT": LP.levelGeom(F, { unlocked: true }), "LEVEL SELECT 1-5": LP.levelGeom(F, { unlocked: false }), SETTINGS: SP.settingsGeom(F, R10), GRAPHICS: SP.graphicsGeom(F) };
  for (const p of GUIDE_PAGES) out[p] = GP.guideGeom(F, p);
  out.RECORDS = RP.recordsGeom(F);
  out.CONTROLS = CP.controlsGeom(F, CV);
  out.LOADING = { plate: (({ x, y, w, h }) => ({ x, y, w, h }))(room.loadBox(F)), foot: null, u: 1 };
  return out;
};

/* ---- ruling 1: centred, the old margin a minimum ---- */
for (const ts of [1, 1.25]) {
  setTextScale(ts);
  for (const [W, H] of SIZES) {
    const F = desk(W, H, ts), G = geoms(F);
    for (const [name, g] of Object.entries(G)) {
      const b = block(g), above = b.top, below = H - b.bot; // a *Geom's rects are box units
      check(`${W}x${H} @${ts} ${name}: no more empty box under the block than over it (over ${above.toFixed(2)}, under ${below.toFixed(2)})`, below <= above + 1, J([above, below]));
      check(`${W}x${H} @${ts} ${name}: centred within 1 px, or held at its minimum top margin (<= ${MIN_TOP})`, Math.abs(above - below) <= 1 || above <= MIN_TOP + 0.01, J([above, below]));
    }
  }
  /* MENU at 1366 x 768: the centred top (64.32) is under the 70 px minimum, so the plate keeps the mock's y 70; at 125 % the centred top (58.32) clears the 56 minimum, so it centres 
  const m = MP.menuGeom(desk(1366, 768, ts), ITEMS);
  check(`MENU 1366x768 @${ts}: the plate at y ${ts > 1 ? "58.32 (centred, over the 56 minimum)" : "70 (the minimum: centred would be 64.32)"}`, Math.abs(m.plate.y - (ts > 1 ? 58.32 : 70)) < 0.01, m.plate.y);
  for (const [W, H] of [[1440, 1100], [1920, 1080]]) {
    const g = MP.menuGeom(desk(W, H, ts), ITEMS), b = block(g);
    check(`MENU ${W}x${H} @${ts}: plate + foot centred (top ${b.top.toFixed(2)} = ${(H - b.bot).toFixed(2)})`, Math.abs(b.top - (H - b.bot)) <= 1 && b.top > 70, J(b));
  }
  /* a short window: the old give-way rule stands (the minimum margin, the block never pushed under the box) */
  for (const [W, H] of [[1366, 657], [1280, 650]]) {
    const F = desk(W, H, ts), G = geoms(F);
    for (const [name, g] of Object.entries(G)) {
      const b = block(g), above = b.top, below = H - b.bot; // a *Geom's rects are box units
      check(`short ${W}x${H} @${ts} ${name}: inside the box, never more empty under than over`, below >= -0.01 && below <= above + 1, J([above, below]));
    }
  }
  /* phone: a short column centres (GUIDE's pages), a column that fills the height stays anchored */
  {
    const F = phone(ts), G = geoms(F);
    for (const [name, g] of Object.entries(G)) {
      const b = block(g), above = b.top, below = F.H - b.bot;
      check(`phone 393x852 @${ts} ${name}: no more empty box under the column than over it (beyond the page's own bottom margin, <= 20 CSS px)`, below <= above + 20 / F.css, J([above, below]));
    }
  }
}
setTextScale(1);

/* ---- ruling 2: the room at play scale ---- */
const GAME = (W, H, lay) => fitBox(W, H, lay !== "d", 600, 520, true).s;
for (const [W, H] of SIZES) {
  const g = shellGeo(W, H, 600, 520, "d");
  check(`shellGeo ${W}x${H} d hands play = the GAME stage scale (fitBox with the HUD reserves) per box unit`, g && Math.abs(g.play * g.s - GAME(W, H, "d")) < 1e-9, J(g));
}
{
  const g = shellGeo(393, 852, 600, 520, "p"), l = shellGeo(1024, 768, 600, 520, "l");
  check("shellGeo 393x852 p: a room cell (40 x play box units x css) is the GAME board's cell in CSS px", g && Math.abs(40 * g.play * g.s - 40 * GAME(393, 852, "p")) < 1e-9, J(g));
  check("shellGeo 1024x768 l: play is the landscape GAME scale", l && Math.abs(l.play - GAME(1024, 768, "l")) < 1e-9, J(l));
}
const boardOf = (r) => { const i = r.calls.findIndex((q) => q.op === "translate"); return i >= 0 && r.calls[i + 1] && r.calls[i + 1].op === "scale" ? { tx: r.calls[i].a[0], ty: r.calls[i].a[1], s: r.calls[i + 1].a[0] } : null; };
{
  const d = SV.dims({ width: 1366, height: 768, logo: 200, css: 1, play: 1.1635 }, "2d");
  check("shellview dims hands the box's play", d.play === 1.1635, J(d));
  const L = md.layout(1366, 768, 200, undefined, 1.1635);
  check("menudraw layout keeps play (the frame every page is handed)", L.play === 1.1635, J(L.play));
  const r0 = rec(); room.roomLook(r0.ctx, { x: 0, y: 0, w: 600, h: 520 }, 1, worldTokens(1), { play: md.layout(600, 520).play });
  check("menudraw layout with no play (#c, the board's own canvas) hands none, and the room there is the board at scale 1 (COVER of 600 x 520)", md.layout(600, 520).play === undefined && boardOf(r0) && Math.abs(boardOf(r0).s - 1) < 1e-9 && boardOf(r0).tx === 0, J(boardOf(r0)));
}
/* roomLook: the board at play scale, the field continued to cover the box */
const cellXY = (r) => { const out = []; let s0 = false; for (let i = 0; i + 2 < r.calls.length; i++) { const [a, b, c] = [r.calls[i], r.calls[i + 1], r.calls[i + 2]]; if (!s0 && a.op === "translate") { s0 = true; continue; } if (s0 && a.op === "save" && b.op === "translate" && c.op === "scale" && Math.abs(c.a[0] - 1) < 2e-3) out.push(b.a); } return out; };
for (const [W, H] of SIZES) {
  const play = GAME(W, H, "d"), r = rec(), tok = worldTokens(1);
  room.roomLook(r.ctx, { x: 0, y: 0, w: W, h: H }, 1, tok, { play });
  const B = boardOf(r), cells = cellXY(r), xs = cells.map((p) => p[0]), ys = cells.map((p) => p[1]);
  check(`roomLook ${W}x${H}: the board at the GAME scale ${play.toFixed(3)} (cover would be ${Math.max(W / 600, H / 520).toFixed(3)}), within 1 %`, B && Math.abs(B.s / play - 1) < 0.01, J(B));
  check(`roomLook ${W}x${H}: the board centred in the box`, B && Math.abs(B.tx - (W - 600 * play) / 2) < 0.01 && Math.abs(B.ty - (H - 520 * play) / 2) < 0.01, J(B));
  const left = B.tx + Math.min(...xs) * B.s, right = B.tx + (Math.max(...xs) + 40) * B.s, top = B.ty + Math.min(...ys) * B.s, bot = B.ty + (Math.max(...ys) + 40) * B.s;
  check(`roomLook ${W}x${H}: the field continues past the board and covers the box (no bare bg1)`, left <= 0 && top <= 0 && right >= W && bot >= H && cells.length > 195, J([left, top, right, bot, cells.length]));
  const brick = cells.filter((p) => p[0] < 0 || p[1] < 0).length;
  check(`roomLook ${W}x${H}: the outer field has cells on every side of the board`, cells.some((p) => p[0] < 0) && cells.some((p) => p[1] < 0) && cells.some((p) => p[0] >= 600) && cells.some((p) => p[1] >= 520) && brick > 0);
}
check("the field helper is gone with the walls and bricks behind the menus (veto 1 D)", room._field === undefined);
{
  const tok = worldTokens(3), m0 = cache._dbg.misses;
  const a = room.roomLayer({ w: 1366, h: 768 }, 3, tok, { dpr: 2, play: 1.1635 }), b = room.roomLayer({ w: 1366, h: 768 }, 3, tok, { dpr: 2, play: 1.1635 }), c = room.roomLayer({ w: 1366, h: 768 }, 3, tok, { dpr: 2, play: 1.8 });
  check("roomLayer: play joins the key (same play a hit, another play another layer)", a === b && a !== c && cache._dbg.misses === m0 + 2, cache._dbg.misses - m0);
  const B = boardOf(a.r);
  check("roomLayer paints the board at play scale under the dpr scale", J(a.r.calls[0]) === J({ op: "scale", a: [2, 2] }) && B && Math.abs(B.s - 1.1635) < 2e-3, J(B));
}
/* every page hands F.play to the one room layer: the room's cell is the GAME cell for its box, and MENU -> page -> MENU refills no room */
/* the room layer: a box-shaped canvas whose first paint is bg1 over all of it (the recorder logs boxes in device px) */
const roomCv = (n0, F) => made.slice(n0).find((c) => c.width > 0 && c.r.paints.length && c.r.calls[0].op === "scale" && c.r.paints[0].op === "fillRect" && /^#/.test(c.r.paints[0].style) && c.r.paints[0].box.x === 0 && c.r.paints[0].box.y === 0 && Math.abs(c.r.paints[0].box.w - c.width) < 1 && Math.abs(c.width / c.height - F.W / F.H) < 0.01);
for (const [W, H] of SIZES) {
  const play = GAME(W, H, "d"), F = { ...desk(W, H, 1), play }, t = rec({ widthK: K8 });
  t.ctx.setTransform(2, 0, 0, 2, 0, 0);
  fresh();
  const pages = {
    MENU: () => MP.drawMenuPage(t.ctx, F, { rows: ITEMS, focus: "PLAY", level: 1, run: { heat: 0, pace: 0, pact: 0 }, daily: null, best: null, look: 0, pages: 4, rev: "v201", note: "", pad: "", enterT: 9 }, 0),
    "LEVEL SELECT": () => LP.drawLevelPage(t.ctx, F, { level: 1, heat: 0, pace: 0, pact: 0, time: false, unlocked: true, best: null, row: "LEVEL", open: false, cur: -1, trig: -1, tap: false, enterT: 9, rev: "v201" }, 0),
    SETTINGS: () => SP.drawSettingsPage(t.ctx, F, { rows: R10, row: "ART STYLE", vals: VALS, r3d: false, px: false, togT: -1, rev: "v201", door: "AUTO ›", ctlDoor: "KEYBOARD ›", padVib: "", ana: true, anaNote: "", level: 1 }, 0),
    GUIDE: () => GP.drawGuidePage(t.ctx, F, { page: "GUIDE", focus: "ENEMIES", tip: false, level: 1, look: "2d", rev: "v201" }, 0),
    RECORDS: () => RP.drawRecordsPage(t.ctx, F, { page: "scores", level: 1, focus: "tabs", heat: 0, scores: [], plaques: 0, rows: medalRows(0), rev: "v201" }, 0),
    CONTROLS: () => CP.drawControlsPage(t.ctx, F, CV, { level: 1, rev: "v201", tap: false }),
    LOADING: () => room.loadingPlate(t.ctx, F, { level: 1, title: "GUIDE", line: "LOADING", rev: "v201", dpr: 2 }),
  };
  /* MENU -> page -> MENU, as the hops a player makes: the page reuses MENU's room (no new room canvas) and MENU finds it again */
  for (const [name, draw] of Object.entries(pages)) {
    fresh();
    let n0 = made.length;
    pages.MENU();
    const first = roomCv(n0, F), B = first && boardOf(first.r);
    if (name === "MENU") { check(`${W}x${H} MENU: the room's cell is the GAME board's cell (40 x ${play.toFixed(3)} CSS px) within 1 %`, B && Math.abs(B.s / play - 1) < 0.01, J(B)); continue; }
    n0 = made.length;
    draw();
    const own = roomCv(n0, F);
    n0 = made.length;
    pages.MENU();
    check(`${W}x${H} ${name}: MENU's room layer at play scale, no refill there or back`, !!B && !own && !roomCv(n0, F) && first.width > 0, J([!!own, first && first.width]));
  }
}
/* menudraw's frame carries play from the layout to the page (MENU and the LOADING plate through menudraw) */
{
  const play = GAME(1920, 1080, "d"), L = md.layout(1920, 1080, 200, undefined, play), t = rec({ widthK: K8 });
  t.ctx.setTransform(2, 0, 0, 2, 0, 0);
  fresh();
  let n0 = made.length;
  md.drawMenu(t.ctx, { rows: ITEMS, focus: "PLAY", level: 1, run: { heat: 0, pace: 0, pact: 0 }, daily: null, best: null, look: 0, pages: 4, rev: "v201", note: "", pad: "", enterT: 9 }, L, 0, false);
  const a = roomCv(n0, { W: 1920, H: 1080 }), A = a && boardOf(a.r);
  check("menudraw drawMenu: the frame hands the layout's play to MENU's room", A && Math.abs(A.s / play - 1) < 0.01, J(A));
  fresh(); n0 = made.length;
  md.loadingPage(t.ctx, { W: 1920, H: 1080, touch: false, shell: true, css: 1, play }, "GUIDE", { level: 1, rev: "v201" }, "guide");
  const b = roomCv(n0, { W: 1920, H: 1080 }), Bb = b && boardOf(b.r);
  check("the LOADING plate's room is at play scale", Bb && Math.abs(Bb.s / play - 1) < 0.01, J(Bb));
}
/* the budget: the room layer is still the box at the room dpr, inside BUDGET with MENU's plate, its foot reserve and the logo reserve */
{
  const out = {};
  for (const [W, H, ts] of [[1366, 768, 1], [1366, 768, 1.25], [1920, 1080, 1], [1920, 1080, 1.25]]) {
    setTextScale(ts); fresh();
    const t = rec({ widthK: K8 }); t.ctx.setTransform(2, 0, 0, 2, 0, 0);
    const F = { ...desk(W, H, ts), play: GAME(W, H, "d") };
    MP.drawMenuPage(t.ctx, F, { rows: ITEMS, focus: "PLAY", level: 1, run: { heat: 0, pace: 0, pact: 0 }, daily: null, best: null, look: 0, pages: 4, rev: "v206", note: "", pad: "", enterT: 9 }, 0);
    const S = MP._dbg.last.S;
    out[`${W}x${H}@2 t${ts}`] = { rd: S.rd, bytes: cache._dbg.bytes };
    check(`${W}x${H}@2 text ${ts}: MENU with its room inside the 24 MiB budget (room dpr ${S.rd})`, cache._dbg.bytes <= cache.BUDGET && S.rd >= 1, J(out[`${W}x${H}@2 t${ts}`]));
  }
  setTextScale(1);
  console.log("  NOTE room dpr " + J(out));
}

/* the one path: every page's room call hands play, and its room key comes from kit room.js roomKey (a page that builds its own "room" key or leaves
   play out paints COVER again and keeps a second box-sized room beside MENU's) */
{
  const { readFileSync, readdirSync } = await import("node:fs");
  const dir = new URL("../src/render/pages/", import.meta.url), bad = []; let n = 0;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".js"))) {
    const s = readFileSync(new URL(f, dir), "utf8");
    for (const m of s.matchAll(/roomLayer\(([^;]*?)\)\s*[;)]/g)) { n++; if (!/\bplay:/.test(m[1])) bad.push(f + ": " + m[0].slice(0, 80)); }
    if (/keyOf\(\{\s*layer:\s*"room/.test(s)) bad.push(f + ": a hand-built room key");
  }
  check(`every page's roomLayer call passes play (${n} calls: MENU, LEVEL SELECT, SETTINGS, GUIDE, RECORDS, CONTROLS) and no page builds its own room key (kit room.js roomKey)`, n >= 6 && bad.length === 0, J([n, bad]));
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
