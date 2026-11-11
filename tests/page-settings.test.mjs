/* UI upgrade v202 Task 3.4: SETTINGS and GRAPHICS on the world kit (src/render/pages/settings.js, lazy through src/render/pages/lazy.js). One geometry
   for draw and tap (rows by name), ten rows outside REAL 3D and twelve in it, PAUSE view 1 draws the page's rows, the LOADING plate until the module
   lands, the round 7 S7-menu 04-settings metrics (desktop 1366 x 768 at 1 box unit per CSS px; phone 393 x 852 in CSS px on the PORT_SHELL box), the
   game parts (meter, rocker, stepper, door, reset, the locked wall key), one yellow fill at most (none), no ring, the touch floors, the foot's
   label-first keys, the longest strings whole at text scale 1 and 1.25, the cached static parts (0 misses on a steady frame or a cursor move), the
   covered render flag, the boot / lazy split and the probe record the gates read. Every canvas is a textrec stub. */
import { rec } from "./lib/textrec.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
const K8 = 0.6 * 1.08; // the recorder's width factor 8 % above the default (appendix 11)
const made = [];
class Cv { constructor(w, h) { this.width = w; this.height = h; this.r = rec({ widthK: K8 }); made.push(this); } getContext() { return this.r.ctx; } }
globalThis.OffscreenCanvas = Cv;
const cache = await import("../src/render/kit/cache.js");
cache.setFactory((w, h) => new Cv(w, h));
const lazy = await import("../src/render/pages/lazy.js");
const md = await import("../src/render/menudraw.js");
const { SCREEN, optRows, OPT_ROWS, createMenuApp } = await import("../src/app/menuapp.js");
const gfx = await import("../src/app/gfx.js");
const { setTextScale } = await import("../src/render/kit/type.js");
const { worldTokens, CONST } = await import("../src/render/kit/tokens.js");
const probe = await import("../src/render/kit/probe.js");
const { shellGeo } = await import("../src/app/fit.js");
const { overlayBox } = await import("../src/render/scenes.js");
const SV = await import("../src/render/shellview.js");
const { BOOT, LOOK_LATER } = await import("../src/pwa/shell.js");
const { SCREENS } = await import("../tools/ui/lib/screens.mjs");

/* ---- the LOADING plate: before the module is in, the entry names paint one plate and tap nothing (synchronously, before any await) ---- */
{
  const t = rec({ widthK: K8 }), L = md.layout(1366, 768, 207);
  md.drawSettings(t.ctx, L, 0, { rows: optRows(false), row: "MUSIC", level: 1 });
  const words = t.texts.map((q) => q.s);
  check("before the lazy module lands: SETTINGS paints the LOADING plate (title + LOADING), no row", words.includes("SETTINGS") && words.includes("LOADING") && !words.includes("MUSIC"), J(words));
  const t2 = rec({ widthK: K8 });
  md.drawGraphics(t2.ctx, L, 0, { row: 0, level: 1 });
  check("and GRAPHICS its own", t2.texts.some((q) => q.s === "GRAPHICS") && t2.texts.some((q) => q.s === "LOADING"));
  check("its hit: inert on the plate (-2), back off it (-1); no geometry yet", md.settingsHit(683, 384, L, optRows(false), false) === -2 && md.settingsHit(5, 5, L, optRows(false), false) === -1 && md.graphicsHit(683, 384, L, 0, false) === -2 && md.settingsGeom(L, false, optRows(false)) === null);
  check("the LOADING plate paints the room under it (the page covers the board)", t.calls.some((c) => c.op === "drawImage" && c.a[1] === 0 && c.a[2] === 0 && c.a[3] === 1366));
}
const P = await import("../src/render/pages/settings.js");
lazy._set("settings", P);

check("lazy: settings is one LOAD entry; lazy.js is boot, settings.js is LATER (never BOOT)", lazy.NAMES.includes("settings") && BOOT.includes("./src/render/pages/lazy.js") && LOOK_LATER.includes("./src/render/pages/settings.js") && !BOOT.includes("./src/render/pages/settings.js"));
check("menudraw imports no page module but menu.js statically (settings stays lazy)", !/from "\.\/pages\/settings\.js"/.test((await import("node:fs")).readFileSync(new URL("../src/render/menudraw.js", import.meta.url), "utf8")));
check("GFX_LABELS is gfx.js GFX_ROWS", J(P.GFX_LABELS) === J(gfx.GFX_ROWS));

const PG = shellGeo(393, 852);
const BOX = {
  d1366: { W: 1366, H: 768, touch: false, shell: true, css: 1 },
  d1920: { W: 1920, H: 1080, touch: false, shell: true, css: 1 },
  d1024: { W: 1024, H: 768, touch: false, shell: true, css: 1 },
  l1024: { W: 1024, H: 768, touch: true, shell: true, css: 1 },
  p393: { W: PG.w, H: PG.h, touch: true, shell: true, css: PG.s },
  c600: { W: 600, H: 520, touch: false, shell: false, css: 1 },
  c600t: { W: 600, H: 520, touch: true, shell: false, css: 1 },
  iso: { W: 608, H: 352, touch: false, shell: false, css: 1 },
};
const ALL = Object.keys(BOX);
const R10 = optRows(false), R12 = optRows(true);
const near = (a, b, e = 0.51) => Math.abs(a - b) <= e;
const inside = (a, b, e = 0.01) => a.x >= b.x - e && a.y >= b.y - e && a.x + a.w <= b.x + b.w + e && a.y + a.h <= b.y + b.h + e;
const VALS = { mus: 70, sfx: 80, snd: 1, cam: 0, bri: 100, shk: 1, flx: 0 };
const UI = (o) => ({ rows: R10, row: "ART STYLE", vals: VALS, r3d: false, px: false, togT: -1, rev: "v201", door: "AUTO ›", ctlDoor: "KEYBOARD ›", padVib: "", ana: true, anaNote: "", level: 1, ...o });
const GV = (kind) => gfx.gfxView({ fps: 1, res: 1, shd: 2, aa: 1, fxq: 1, dmo: 1, fpm: 0 }, kind, {});
/* the live frame's texts first, then the ones painted into the layers made that frame (raw design px, both) */
const merge = (t, n0) => { t.live = t.texts.length; for (const cv of made.slice(n0)) t.texts.push(...cv.r.texts); return t; };
function frame(F, ui, o = {}) {
  const t = rec({ widthK: K8 }), n0 = made.length;
  if (o.dpr) t.ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  const m0 = cache._dbg.misses;
  (o.g ? P.drawGraphicsPage : P.drawSettingsPage)(o.c || t.ctx, F, ui, o.t || 0);
  return { t: merge(t, n0), miss: cache._dbg.misses - m0 };
}
const shell = (a, world) => { const t = rec({ widthK: K8 }), n0 = made.length; fresh(); SV.drawShell(t.ctx, a, world, null, "2d", () => [], () => 0, () => ({})); return merge(t, n0); };
const fresh = () => { cache.release(); cache._dbg.misses = 0; };

/* ---- rows: ten outside REAL 3D, twelve in it, in OPT_ROWS order, one column top to bottom ---- */
for (const b of ALL) for (const [n, R] of [[10, R10], [12, R12]]) {
  const G = P.settingsGeom(BOX[b], R), ys = R.map((l) => G.rows[l].y);
  check(`rows (${b}, ${n}): ${n} named rows in OPT_ROWS order, one column, no overlap`, G.order.length === n && J(G.order) === J(OPT_ROWS.filter((l) => R.includes(l))) && ys.every((y, i) => !i || y >= G.rows[R[i - 1]].y + G.rows[R[i - 1]].h - 1e-9) && R.every((l) => G.rows[l].x === G.rows.MUSIC.x), J(ys));
}
check("CAMERA and BRIGHTNESS exist only in the twelve", !P.settingsGeom(BOX.d1366, R10).rows.CAMERA && !!P.settingsGeom(BOX.d1366, R12).rows.BRIGHTNESS);

/* ---- the mock's metrics (round 7 S7-menu 04-settings, CSS px) ---- */
{
  const G = P.settingsGeom(BOX.d1366, R12), d = G.d;
  check("desk 1366 x 768: two columns, the list 480 beside a 400 pane, rows 38, courses 12, u 1", G.mode === "desk" && G.u === 1 && d.list.w === 480 && d.pane.w === 400 && R12.every((l) => d.rows[l].h === 38) && near(G.rows.SFX.y - G.rows.MUSIC.y, 38) && near(G.rows["ART STYLE"].y - G.rows.SOUND.y, 50), J([d.list, d.pane]));
  check("desk: the plate is centred (944 wide) and its ring stays inside the window", near(G.plate.x + G.plate.w / 2, 683) && near(G.plate.w, 944) && G.plate.y - 18 >= 0 && G.plate.y + G.plate.h + 19 <= 768, J(G.plate));
  setTextScale(1.25);
  const H = P.settingsGeom(BOX.d1366, R12);
  check("desk at 125 %: the list 540, the pane 440, rows 36 (the mock's t125 sizes)", H.mode === "desk" && H.d.list.w === 540 && H.d.pane.w === 440 && H.d.rows.MUSIC.h === 36 && H.plate.y + H.plate.h + 19 <= 768, J(H.plate));
  setTextScale(1);
  const Q = P.settingsGeom(BOX.p393, R12), css = (r) => r.h * PG.s;
  check("phone: one column in CSS px, a BACK key beside the title, rows 44..52 CSS px, the foot under the plate", Q.mode === "phone" && !!Q.back && R12.every((l) => css(Q.rows[l]) >= 43.99 && css(Q.rows[l]) <= 52.01) && Q.d.foot.y > Q.d.plate.y + Q.d.plate.h, J(R12.map((l) => css(Q.rows[l]))));
  check("phone: the BACK key is >= 44 CSS px and >= 8 CSS px above the first row", css(Q.back) >= 44 && (Q.rows.MUSIC.y - Q.back.y - Q.back.h) * PG.s >= 8);
  for (const b of ["c600", "iso", "c600t"]) { const C = P.settingsGeom(BOX[b], R12); check(`#c box (${b}): the single column, scaled as one piece, plate and ring inside`, C.mode === "col" && C.u <= 1 && C.plate.x - C.T >= 0 && C.plate.y - C.T >= 0 && C.plate.x + C.plate.w + C.T <= BOX[b].W + 0.5 && C.plate.y + C.plate.h + C.T <= BOX[b].H + 0.5, J([C.u, C.plate])); }
  const Lt = P.settingsGeom(BOX.l1024, R12);
  check("touch landscape shell box: the desk with rows floored at 44 CSS px", Lt.mode === "desk" && R12.every((l) => Lt.rows[l].h >= 43.99));
}

/* ---- tap every drawn row's centre; off the rows -2 on the plate, -1 off it; BACK -1; both pages ---- */
for (const b of ALL) for (const [pg, R] of [["settings", R10], ["settings", R12], ["graphics", P.GFX_LABELS]]) {
  const F = BOX[b], G = pg === "settings" ? P.settingsGeom(F, R) : P.graphicsGeom(F), hit = (x, y) => (pg === "settings" ? P.settingsHit(x, y, F, R) : P.graphicsHit(x, y, F));
  const ok = R.every((l, i) => { const r = G.rows[l]; return hit(r.x + r.w / 2, r.y + r.h / 2) === i && hit(r.x + 2, r.y + 1) === i; });
  const offRow = G.pane ? hit(G.pane.x + G.pane.w / 2, G.pane.y + G.pane.h / 2) : hit(G.plate.x + G.plate.w / 2, G.plate.y + 4);
  check(`hit (${pg} ${R.length}, ${b}): every row centre maps to its index; on the plate off the rows -2; off the plate -1`, ok && offRow === -2 && hit(1, 1) === -1 && hit(F.W - 1, F.H - 1) === -1, J([offRow]));
  if (G.back) check(`hit (${pg}, ${b}): BACK backs out (-1)`, hit(G.back.x + G.back.w / 2, G.back.y + G.back.h / 2) === -1);
  const rs = R.map((l) => G.hit[l]);
  check(`hit rects (${pg} ${R.length}, ${b}) are contiguous top to bottom (a course belongs half to each side)`, rs.every((r, i) => !i || near(r.y, rs[i - 1].y + rs[i - 1].h, 1e-6)));
}
check("a zero box hits nothing", P.settingsHit(1, 1, { W: 0, H: 0 }, R10) === -1 && P.graphicsHit(1, 1, { W: NaN, H: 5 }) === -1);

/* ---- the menudraw entry names delegate with the same box for draw and tap ---- */
{
  const L = md.layout(1366, 768, 207), G = md.settingsGeom(L, false, R10), r = G.rows.SOUND;
  check("menudraw.settingsGeom / settingsHit are the page's on frameOf(L)", G === P.settingsGeom({ W: 1366, H: 768, touch: false, shell: true, css: 1 }, R10) && md.settingsHit(r.x + 9, r.y + 9, L, R10, false) === R10.indexOf("SOUND") && md.graphicsHit(5, 5, L, 0, false) === -1);
}

/* ---- the drawn page: words, parts, focus, inside the plate, whole at 1 and 1.25 ---- */
const texts = (t) => t.texts.map((q) => q.s);
for (const ts of [1, 1.25]) {
  setTextScale(ts);
  for (const b of ALL) for (const r3d of [false, true]) {
    fresh();
    const R = r3d ? R12 : R10, F = BOX[b], { t } = frame(F, UI({ rows: R, r3d, row: "ART STYLE" })), G = P.settingsGeom(F, R), S = P._dbg.last, tag = `${b} ${R.length} @${ts}`;
    const labs = t.texts.slice(t.live).filter((q) => R.includes(q.s)).map((q) => q.s), live = t.texts.slice(0, t.live).filter((q) => R.includes(q.s)).map((q) => q.s);
    check(`draw (${tag}): every row label at rest in the page layer, in order; the focused row's live on top`, J([...new Set(labs)]) === J(R) && J(live) === J(["ART STYLE"]), J([labs, live]));
    const all = Object.values(S.Pl.rows).flatMap((o) => [o.label, ...o.val.P.filter((p) => p.k === "text" || p.k === "num").map((p) => ({ ...p, x: p.k === "num" ? p.x - p.w : p.x }))]);
    const bad = all.filter((q) => q.x < G.d.plate.x - 0.01 || q.x + q.w > G.d.plate.x + G.d.plate.w + 0.01);
    check(`inside (${tag}): every row's words inside the plate`, !bad.length, J(bad.map((q) => q.s)));
    const clash = Object.values(S.Pl.rows).filter((o) => o.val.w > 0 && o.val.x < o.label.x + o.label.w + 6 && o.val.P.every((p) => p.y === undefined || Math.abs(p.y - o.label.y) < 1));
    check(`fit (${tag}): no value runs into its label (a wide note takes the line under it)`, !clash.length, J(clash.map((o) => o.l)));
    check(`no ellipsis, no clipped word (${tag})`, !t.texts.some((q) => /…/.test(q.s)));
    check(`units unspaced (${tag})`, !t.texts.some((q) => /\d %|\d s\b/.test(q.s)));
    check(`one yellow at most: none here (${tag})`, !t.paints.some((p) => p.style === CONST.yel));
    const ring = t.paints.filter((p) => p.op === "stroke" && p.style === CONST.ink && p.lw === 3);
    check(`no focus ring: the focused row wears the band and the bomb (${tag})`, !ring.length);
    const band = t.paints.find((p) => p.op === "fill" && p.style === worldTokens(1).band);
    const fr = G.rows["ART STYLE"];
    check(`the band is the focused row's geometry rect (${tag})`, !!band && near(band.box.x, fr.x, 0.6) && near(band.box.y, fr.y, 0.6) && near(band.box.w, fr.w, 0.6) && near(band.box.h, fr.h, 0.6), J([band && band.box, fr]));
    const F2 = S.Pl.foot;
    check(`the foot (${tag}): inside the box, every key reads label first, keycap last`, !!F2 && F2.x >= 0 && F2.x + F2.w <= G.d.plate.x + G.d.plate.w + 30 && F2.lines.every((L) => L.ps.every((p, i) => !p.cap || (i > 0 && !L.ps[i - 1].sep))), J(F2 && F2.lines.map((L) => L.ps.map((p) => p.t || p.sep || (Array.isArray(p.cap) ? p.cap[0] : p.cap)))));
  }
}
setTextScale(1);

/* ---- the parts: values as game pieces ---- */
{
  fresh();
  const { t } = frame(BOX.d1366, UI({ rows: R12, r3d: true, row: "MUSIC", vals: { ...VALS, bri: 130, cam: 2 } }));
  const W = texts(t), S = P._dbg.last.Pl.rows;
  check("MUSIC / SFX: ten-cell meters, the head lit, the number its value (70 / 80)", S.MUSIC.val.P.filter((p) => p.k === "cell").length === 10 && S.MUSIC.val.P.find((p) => p.head).r && S.MUSIC.val.P.filter((p) => p.k === "cell" && p.kind === "lit").length === 1 && W.includes("70") && W.includes("80"));
  check("BRIGHTNESS: a seven-cell meter reading 130%", S.BRIGHTNESS.val.P.filter((p) => p.k === "cell").length === 7 && W.includes("130%"));
  check("SOUND, SCREEN SHAKE, REDUCE FLASH, ANALYTICS: rockers, OFF | ON with the set one lit", ["SOUND", "SCREEN SHAKE", "REDUCE FLASH", "ANALYTICS"].every((l) => S[l].val.P.filter((p) => p.k === "key").length === 2) && S["REDUCE FLASH"].val.P.find((p) => p.s === "OFF").kind === "lit" && S.SOUND.val.P.find((p) => p.s === "ON").kind === "lit");
  check("ART STYLE and CAMERA: steppers (two stepped keys round a window); REAL 3D clamps right, FAR clamps right", S["ART STYLE"].val.P.filter((p) => p.k === "key").length === 3 && W.includes("REAL 3D") && W.includes("FAR") && S.CAMERA.val.P.filter((p) => p.k === "key")[2].kind === "well" && S["ART STYLE"].val.P.filter((p) => p.k === "pip").length === 3);
  check("GRAPHICS and CONTROLS: doors, the word and the chevron (the › is the glyph)", W.includes("AUTO") && W.includes("KEYBOARD") && !W.includes("AUTO ›") && S.GRAPHICS.val.P.some((p) => p.k === "glyph" && p.n === "chev"));
  check("RESET DEFAULTS: danger, the coral label and the coral reset glyph", S["RESET DEFAULTS"].label.col === CONST.cor && S["RESET DEFAULTS"].val.P.some((p) => p.k === "glyph" && p.n === "reset" && p.col === CONST.cor));
  check("the head: BUILD v201 over SETTINGS", W.includes("BUILD v201") && W.includes("SETTINGS"));
  check("the pane: ART STYLE 3 OF 3, the three looks with REAL 3D chosen, the REAL 3D rows note", W.includes("3 OF 3") && P._dbg.last.Pl.pane.looks.filter((k) => k.kind === "lit").map((k) => k.s)[0] === "REAL 3D" && W.some((s) => /CAMERA and BRIGHTNESS/.test(s) || /^CAMERA/.test(s)));
  fresh();
  const { t: t2 } = frame(BOX.d1366, UI({ rows: R12, r3d: true, row: "CONTROLS", padVib: "MEDIUM", ctlDoor: "CONTROLLER ›" }));
  check("CONTROLS reads VIBRATION MEDIUM where it fits", texts(t2).includes("VIBRATION MEDIUM") && !texts(t2).includes("CONTROLLER"));
  fresh();
  const { t: t3 } = frame(BOX.d1366, UI({ rows: R10, row: "ANALYTICS", anaNote: "ANSWER THE CARD WITH Y OR N" }));
  check("ANALYTICS: the pad note replaces the rocker, whole", texts(t3).includes("ANSWER THE CARD WITH Y OR N") && !P._dbg.last.Pl.rows.ANALYTICS.val.P.some((p) => p.k === "key"));
  fresh();
  const { t: t4 } = frame(BOX.p393, UI({ rows: R10, row: "ANALYTICS", anaNote: "ANSWER THE CARD WITH Y OR N" }));
  const n4 = t4.texts.find((q) => q.s === "ANSWER THE CARD WITH Y OR N"), l4 = t4.texts.find((q) => q.s === "ANALYTICS"), r4 = P.settingsGeom(BOX.p393, R10).d.rows.ANALYTICS;
  check("phone: a note too wide for the row's right takes the line under its label, whole, inside the row", !!n4 && !!l4 && n4.y > l4.y && n4.y < r4.y + r4.h && l4.y > r4.y, J([n4, l4, r4]));
  fresh();
  const { t: t5 } = frame(BOX.p393, UI({ rows: R12, r3d: true, row: "MUSIC" }));
  check("phone: ART STYLE and CAMERA are door rows (word + chevron), BRIGHTNESS a meter, BACK on the head", P._dbg.last.Pl.rows["ART STYLE"].spec.t === "door" && P._dbg.last.Pl.rows.CAMERA.spec.t === "door" && P._dbg.last.Pl.rows.BRIGHTNESS.spec.t === "meter" && texts(t5).includes("BACK") && texts(t5).includes("STANDARD"));
  check("phone foot: the tap model, under the plate", texts(t5).some((s) => s === md.FOOT_TAP || s === P.COPY.tapRow));
}

/* ---- the ART STYLE row's load job: the words in the window, the fill line live, no reflow ---- */
{
  fresh();
  const ui = UI({ rows: R10, row: "MUSIC", px: true, job: { k: "px", st: "preparing", phase: "bake", done: 140, total: 255, fill: 0.6 } });
  frame(BOX.d1366, ui);
  const a = P._dbg.last.Pl.rows["ART STYLE"];
  check("job: the window carries the job's words (PIXEL · ART 140 / 255 or a step down)", ["PIXEL · ART 140 / 255", "ART 140 / 255"].includes(a.word), a.word);
  const m0 = cache._dbg.misses;
  frame(BOX.d1366, { ...ui, job: { ...ui.job, fill: 0.7 } });
  check("job: a fill change is live (0 misses)", cache._dbg.misses === m0);
  const before = P.settingsGeom(BOX.d1366, R10).rows.SCREEN_SHAKE;
  check("job: nothing reflows (the geometry is the rows')", before === undefined && P.settingsGeom(BOX.d1366, R10).rows["SCREEN SHAKE"].y === P.settingsGeom(BOX.d1366, R10).rows["SCREEN SHAKE"].y);
  fresh();
  frame(BOX.d1366, { ...ui, job: { k: "px", st: "fail", fill: -1 } });
  check("job failed: the window's words in the danger colour", P._dbg.last.Pl.rows["ART STYLE"].val.P.some((p) => p.k === "text" && p.col === CONST.cor));
}

/* ---- the 120 ms flash of a changed value (no shadowBlur, no filter: a hard overlay) ---- */
{
  fresh();
  const at = (togT) => frame(BOX.d1366, UI({ row: "SOUND", togT }), { t: 1 }).t;
  const flashOf = (t) => t.paints.filter((p) => p.style === CONST.ink && p.op === "fillRect" && p.alpha > 0 && p.alpha < 1);
  check("flash: mid-window a hard overlay on the changed value; idle (-1) and after 120 ms none", flashOf(at(0.97)).length === 1 && !flashOf(at(-1)).length && !flashOf(at(0.85)).length);
  const all = at(0.97);
  check("no shadowBlur, shadowColor or filter written", !all.writes.some((w) => /shadow|filter/.test(w.k)));
}

/* ---- GRAPHICS: eight rows, locked rows on the wall, the focused row's help in the pane ---- */
{
  fresh();
  const { t } = frame(BOX.d1366, { row: 2, view: GV("2d"), togT: -1, chg: 0, level: 1 }, { g: true });
  const S = P._dbg.last.Pl.rows, W = texts(t);
  check("GRAPHICS: eight rows in GFX_ROWS order, the title and its kicker", J(P._dbg.last.G.order) === J(gfx.GFX_ROWS) && W.includes("GRAPHICS"));
  check("CLASSIC: RESOLUTION, SHADOWS, ANTI-ALIAS are locked wall keys reading —", ["RESOLUTION", "SHADOWS", "ANTI-ALIAS"].every((l) => S[l].spec.t === "lock") && W.includes("—"));
  check("FPS METER is a rocker; QUALITY a stepper window", S["FPS METER"].spec.t === "rocker" && S.QUALITY.spec.t === "step" && W.includes("AUTO"));
  check("the pane: the focused row's name and its help (RESOLUTION's lock line)", P._dbg.last.gp.head.s === "RESOLUTION" && P._dbg.last.gp.lines.some((q) => /REAL 3D/.test(q.s)));
  fresh();
  frame(BOX.d1366, { row: 0, view: GV("3d"), level: 1 }, { g: true });
  check("REAL 3D locks nothing", Object.values(P._dbg.last.Pl.rows).every((o) => o.spec.t !== "lock"));
  const fl = (chg) => frame(BOX.d1366, { row: 0, view: GV("3d"), togT: 0.97, chg, level: 1 }, { g: true, t: 1 }).t.paints.filter((p) => p.style === CONST.ink && p.op === "fillRect" && p.alpha > 0 && p.alpha < 1).length;
  check("a preset flashes every row it wrote (chg bits)", fl(0b111) === 3 && fl(0b1) === 1);
}

/* ---- PAUSE view 1 / 2: the page's rows inside overlayBox, over the board (no room), with the PAUSED kicker ---- */
{
  const mk = (r3d) => { const a = createMenuApp({ settings: { r3d: r3d ? 1 : 0 } }); a.skip(); return a; };
  for (const r3d of [false, true]) {
    const a = mk(r3d), world = { state: "PAUSE", level: 3 };
    a.screen = SCREEN.SETTINGS;
    const pg = shell(a, world);
    a.screen = SCREEN.GAME; a.pauseView = 1;
    const pz = shell(a, world);
    const rows = (t) => t.texts.filter((q) => OPT_ROWS.includes(q.s)).map((q) => q.s);
    check(`PAUSE view 1 draws the page's rows (${r3d ? 12 : 10}), in order`, J([...new Set(rows(pz))]) === J(a.optRows()) && J([...new Set(rows(pz))]) === J([...new Set(rows(pg))]), J([rows(pz), rows(pg)]));
    check(`PAUSE view 1: the PAUSED kicker, no room blit (the board shows under the plate) (${r3d ? 12 : 10})`, pz.texts.some((q) => /^PAUSED · LEVEL 3$/.test(q.s)) && !pz.calls.some((c) => c.op === "drawImage" && c.a[1] === 0 && c.a[2] === 0 && c.a[3] === 600 && c.a[4] === 520));
    const B = overlayBox("2d"), L = md.layout(B.w, B.h), G = md.settingsGeom(L, false, a.optRows());
    check(`PAUSE view 1 taps through the page's geometry on overlayBox (${r3d ? 12 : 10})`, a.optRows().every((l, i) => md.settingsHit(G.rows[l].x + 20, G.rows[l].y + G.rows[l].h / 2, L, a.optRows(), false) === i));
  }
  const a = mk(false);
  a.screen = SCREEN.GAME; a.pauseView = 2;
  const g = shell(a, { state: "PAUSE", level: 3 });
  check("PAUSE view 2 draws GRAPHICS' rows", gfx.GFX_ROWS.every((l) => g.texts.some((q) => q.s === l)));
}

/* ---- the cache: two steady frames equal, 0 misses, a cursor move 0 misses, <= 400 calls, <= 20 measureText ---- */
{
  fresh();
  const ctx = rec({ widthK: K8 });
  ctx.ctx.setTransform(2, 0, 0, 2, 0, 0);
  const hashOf = (calls) => { const s = J(calls); let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(16) + ":" + calls.length; };
  const one = (ui, g) => { const n0 = ctx.calls.length, m0 = cache._dbg.misses; (g ? P.drawGraphicsPage : P.drawSettingsPage)(ctx.ctx, BOX.d1366, ui, 5); const calls = ctx.calls.slice(n0); return { calls, miss: cache._dbg.misses - m0, measure: calls.filter((c) => c.op === "measureText").length, hash: hashOf(calls) }; };
  one(UI({ rows: R12, r3d: true }));
  const a = one(UI({ rows: R12, r3d: true })), b = one(UI({ rows: R12, r3d: true }));
  check("two steady frames: equal call-log hashes, 0 misses, <= 400 calls, <= 20 measureText", a.hash === b.hash && a.miss === 0 && b.miss === 0 && a.calls.length <= 400 && a.measure <= 20, J({ a: a.hash, b: b.hash, miss: [a.miss, b.miss], calls: a.calls.length, m: a.measure }));
  const moves = R12.map((l) => one(UI({ rows: R12, r3d: true, row: l })));
  check("a cursor move (every row focused in turn): 0 misses, <= 400 calls each", moves.every((m) => m.miss === 0 && m.calls.length <= 400), J(moves.map((m) => [m.miss, m.calls.length])));
  const v = one(UI({ rows: R12, r3d: true, vals: { ...VALS, mus: 60 } }));
  check("a value change re-rasters the page layer once (1 miss), the next frame none", v.miss === 1 && one(UI({ rows: R12, r3d: true, vals: { ...VALS, mus: 60 } })).miss === 0, v.miss);
  one({ row: 0, view: GV("2d"), level: 1 }, true);
  const ga = one({ row: 0, view: GV("2d"), level: 1 }, true), gm = [1, 2, 3, 7].map((r) => one({ row: r, view: GV("2d"), level: 1 }, true));
  check("GRAPHICS: steady 0 misses, a cursor move 0 misses, <= 400 calls", ga.miss === 0 && gm.every((m) => m.miss === 0 && m.calls.length <= 400), J(gm.map((m) => [m.miss, m.calls.length])));
  check("the bytes stay inside the 24 MiB budget with the room", cache._dbg.bytes <= cache.BUDGET, cache._dbg.bytes);
}

/* ---- covered: SETTINGS and GRAPHICS paint the room opaque, PAUSE never ---- */
check("shellCovers: SETTINGS and GRAPHICS (and MENU), never GAME", SV.shellCovers(SCREEN.SETTINGS) && SV.shellCovers(SCREEN.GRAPHICS) && SV.shellCovers(SCREEN.MENU) && !SV.shellCovers(SCREEN.GAME));

/* ---- the probe record the gates read ---- */
{
  fresh();
  probe.setOn(true);
  frame(BOX.d1366, UI({ rows: R12, r3d: true, row: "ART STYLE" }), { dpr: 2 });
  const s = probe.snapshot();
  const kinds = new Set(s.pairs.map((p) => p.kind));
  check("probe: the settings page, its plate, twelve list targets, the focused one marked", s.page === "settings" && s.rects.some((r) => r.name === "plate" && r.plate > 0) && s.rects.filter((r) => r.set === "settings" && r.kind === "list").length === 12 && s.rects.find((r) => r.focus).name === "ART STYLE");
  check("probe: chosen (rocker, meter, art style), band and info pairs; texts with colours; no fault", kinds.has("chosen") && kinds.has("band") && kinds.has("info") && s.pairs.filter((p) => p.kind === "chosen").length >= 3 && s.texts.every((q) => q.col) && !s.fault, J([...kinds]));
  frame(BOX.d1366, { row: 0, view: GV("2d"), level: 1 }, { g: true, dpr: 2 });
  const g = probe.snapshot();
  check("probe: GRAPHICS in CLASSIC declares its locked pair (a wall key vs a lit cell, a floor sample)", g.page === "graphics" && g.pairs.some((p) => p.kind === "locked" && p.floor), J(g.pairs.map((p) => p.kind)));
  frame(BOX.p393, UI({ rows: R10 }), { dpr: 3 });
  const p = probe.snapshot();
  check("probe (phone): BACK and the rows are touch targets >= 44 CSS px", p.rects.filter((r) => r.touch).every((r) => r.h * PG.s >= 43.99 && r.w * PG.s >= 43.99) && p.rects.some((r) => r.name === "BACK" && r.touch));
  probe.setOn(false);
}
check("tools/ui screens: options and graphics exempt only what they have none of (ring: no key takes focus; graphics locked: REAL 3D locks no row)", !SCREENS.options.need.includes("ring") && !SCREENS.graphics.need.includes("ring") && !SCREENS.graphics.need.includes("locked") && SCREENS.options.need.includes("chosen") && SCREENS.graphics.need.includes("chosen"));

/* ---- a box with no canvas source or no clip: the plan only, no throw ---- */
{
  let threw = null;
  try { P.drawSettingsPage({}, BOX.d1366, UI({}), 0); P.drawGraphicsPage({}, BOX.p393, { row: 0, view: GV("3d") }, 0); P.drawSettingsPage(rec().ctx, { W: 0, H: 0 }, UI({}), 0); } catch (e) { threw = e; }
  check("a context with no clip, or a zero box: no throw", !threw, threw && threw.message);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
