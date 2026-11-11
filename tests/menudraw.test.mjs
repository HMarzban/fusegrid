import { initFx } from "../src/render/fx.js";
import { readFileSync } from "node:fs";
import { rec as textrec } from "./lib/textrec.mjs";
import { OPT_ROWS as ALL_OPT, optRows } from "../src/app/menuapp.js";
import * as lazyPages from "../src/render/pages/lazy.js";
import { worldTokens } from "../src/render/kit/tokens.js";
import * as settingsPage from "../src/render/pages/settings.js";
lazyPages._set("settings", settingsPage); // the lazy SETTINGS / GRAPHICS page (v202 Task 3.4), in as if its import had landed (R20)
/* The console-panel plate is a rounded path (icons.js rr): a filled path that
   used arcTo is recorded as its bbox rect, so the plate checks keep reading
   rects. Carets and glyphs (no arcTo) are not recorded. */
const PLATE_FILL = "rgba(10,14,24,0.94)";
const pathRects = (c, rects) => {
  let pts = [], arc = false;
  const wrap = (k, f) => { const o = c[k]; c[k] = (...a) => { f(a); return o ? o.apply(c, a) : undefined; }; };
  wrap("beginPath", () => { pts = []; arc = false; });
  wrap("moveTo", (a) => pts.push(a));
  wrap("lineTo", (a) => pts.push(a));
  wrap("arcTo", (a) => { arc = true; pts.push([a[0], a[1]], [a[2], a[3]]); });
  wrap("fill", () => {
    if (!arc || !pts.length) return;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys);
    rects.push({ x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, fill: c.fillStyle, path: true });
  });
  for (const k of ["closePath", "stroke", "quadraticCurveTo"]) if (!c[k]) c[k] = () => {};
  return c;
};

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

// 12) menudraw.layout(): normalized fields sane for BOTH canvas sizes
{
  const { layout } = await import("../src/render/menudraw.js");
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = layout(W, H);
    check(`layout(${W},${H}) returns frozen object`, !!L && Object.isFrozen(L));
    check(
      `layout(${W},${H}) all 11 numeric fields present`,
      [
        "cx",
        "top",
        "logoCy",
        "logoScale",
        "itemsY",
        "itemH",
        "footY",
        "chipW",
        "chipGap",
        "tableY",
        "rowH",
      ].every((k) => typeof L[k] === "number"),
      Object.keys(L).join(","),
    );
    check(
      `layout(${W},${H}) cx==W/2 and top in (0,H*0.17)`,
      L.cx === W / 2 && L.top > 0 && L.top < H * 0.17,
      L.cx + "," + L.top,
    );
    check(
      `layout(${W},${H}) logoCy in (0,H/2)`,
      L.logoCy > 0 && L.logoCy < H * 0.5,
      L.logoCy + "",
    );
    check(
      `layout(${W},${H}) logoScale clamped [0.72,1.0]`,
      L.logoScale >= 0.72 && L.logoScale <= 1.0,
      L.logoScale + "",
    );
    check(
      `layout(${W},${H}) itemsY within [0.45H,0.55H]; itemH int clamp [24,34]`,
      L.itemsY >= H * 0.45 &&
        L.itemsY <= H * 0.55 &&
        Number.isInteger(L.itemH) &&
        L.itemH >= 24 &&
        L.itemH <= 34,
      L.itemsY + "," + L.itemH,
    );
    check(
      `layout(${W},${H}) footY==H-20; chipW 44; chipGap 14`,
      L.footY === H - 20 && L.chipW === 44 && L.chipGap === 14,
      L.footY + "," + L.chipW + "," + L.chipGap,
    );
    check(
      `layout(${W},${H}) tableY above itemsY; rowH>0`,
      L.tableY > 0 && L.tableY < L.itemsY && L.rowH > 0,
      L.tableY + "," + L.rowH,
    );
  }
  check(
    "logoScale clamps to 0.72 for short canvas",
    layout(400, 200).logoScale === 0.72,
    layout(400, 200).logoScale + "",
  );
}

// 13) menu/intro draw fns: Proxy-stub-canvas smoke at BOTH sizes (no throw)
{
  const md = await import("../src/render/menudraw.js");
  const { DEFAULT_SCORES } = await import("../src/app/highscores.js");
  const { ITEMS } = await import("../src/app/menuapp.js");
  initFx();
  const stub = new Proxy(function () {}, {
    get: (t, p) => (p === Symbol.toPrimitive ? () => "" : stub),
    apply: () => stub,
    set: () => true,
  });
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    let ok = true;
    try {
      md.drawIntroChrome(stub, 0, 0.3, W, H, "d"); // title: logo reveal beat
      md.drawIntroChrome(stub, 0, 2.0, W, H, "p", 0); // title: board not ready
      md.drawIntroChrome(stub, 1, 2.0, W, H, "l"); // show: mid-sweep
      // the MENU page (pages/menu.js) with shellview's names and values: the shipped rows, a focused door, a non-default run, a played daily
      md.drawMenu(stub, { rows: ITEMS, focus: ITEMS[2], level: 1, run: { heat: 1, pace: 1, pact: 3 }, daily: 2, best: 1234, look: 1, pages: 4, rev: "v0", enterT: 0.5 }, L, 0.5);
      md.drawMenu(stub, { rows: ITEMS, focus: ITEMS[0], level: 8, enterT: 0 }, L, 0.5, true);
      md.drawLevelSelect(stub, 3, L, 0.4, 1);
      md.drawHowTo(stub, L, 0.4);
      md.drawItemsHelp(stub, L, 0.4);
      md.drawEnemiesHelp(stub, L, 0.4);
      md.drawGuide(stub, L, 0.4, 0);
      md.drawScores(stub, DEFAULT_SCORES, L, 0.4);
      const sv = { mus: 100, sfx: 100, snd: 1, r3d: 0, cam: 0, bri: 100, shk: 1, flx: 0 };
      md.drawSettings(stub, L, 0.4, { rows: optRows(false), row: "MUSIC", vals: sv, r3d: false, togT: -1, rev: "v0" });
      md.drawSettings(stub, L, 0.4, { rows: optRows(true), row: "ANALYTICS", vals: sv, r3d: true, togT: 0.3, rev: "v0" });
      md.drawSettings(stub, L, 0.4, {});
      md.drawTrophies(stub, L, 0.4, undefined);
      md.drawTrophies(stub, L, 0.4, [["A", "B", true]]);
      md.drawDim(stub, 0.62, W, H);
    } catch (e) {
      ok = false;
      console.log(W + "x" + H + " smoke:", e.message);
    }
    check(`all menu draw fns no-throw on stub ctx at ${W}x${H}`, ok);
  }
}

// 13b) toggle-flash (§2 pinned row): the changed OPTIONS value glows accent
//        for 120ms after the machine's togT stamp; idle sentinel draws clean
{
  const md = await import("../src/render/menudraw.js");
  const L = md.layout(600, 520);
  const vals = { mus: 100, sfx: 100, snd: 1, r3d: 1, cam: 0, bri: 100, shk: 1, flx: 0 };
  const mk = () => {
    const sets = [];
    const stub = new Proxy(function () {}, {
      get: (t, p) => (p === Symbol.toPrimitive ? () => "" : stub),
      apply: () => stub,
      set: (t, p, v) => {
        if (p === "shadowBlur") sets.push(v);
        return true;
      },
    });
    return { stub, sets };
  };
  /* v202 Task 3.4: no shadowBlur in a paint path (the kit's rule): the changed value flashes as a hard cream overlay on its row, fading over 120 ms */
  const flashOf = (togT) => {
    const r = textrec();
    md.drawSettings(r.ctx, L, 1.0, { rows: optRows(true), row: "MUSIC", vals, r3d: true, togT, rev: "v0" });
    const G = md.settingsGeom(L, false, optRows(true)), row = G.rows.MUSIC;
    return { f: r.paints.filter((p) => p.op === "fillRect" && p.style === "#fff2df" && p.alpha > 0 && p.alpha < 1 && p.box && p.box.y >= row.y - 0.5 && p.box.y + p.box.h <= row.y + row.h + 0.5), blur: r.writes.filter((w) => /shadow|filter/.test(w.k)) };
  };
  {
    const { f, blur } = flashOf(0.97);
    check("toggle-flash: mid-window a hard overlay on the changed row, no blur or filter", f.length === 1 && f[0].alpha <= 0.3 && !blur.length, JSON.stringify([f, blur]));
  }
  {
    const { f, blur } = flashOf(-1);
    check("toggle-flash: idle sentinel (-1) never flashes", f.length === 0 && !blur.length, JSON.stringify(f));
  }
  {
    const { f } = flashOf(0.85);
    check("toggle-flash: window closed after 120ms", f.length === 0, JSON.stringify(f));
  }
  {
    const { stub, sets } = mk();
    md.drawMenu(
      stub,
      { cursor: 2, enterT: 1.0, togT: 0.97, items: ["PLAY|NORMAL DIFFICULTY", "LEVEL SELECT|NORMAL DIFFICULTY", "SETTINGS"] },
      L,
      1.0,
    );
    check(
      "drawMenu ignores a stray togT — the flash is a SETTINGS concept now",
      sets.length === 0,
      JSON.stringify(sets),
    );
  }
}

// 13c) menu chrome fit: selected row + 10 score rows stay inside the plate
{
  const md = await import("../src/render/menudraw.js");
  const { DEFAULT_SCORES } = await import("../src/app/highscores.js");
  const rec = () => {
    const texts = [],
      rects = [],
      lines = []; // Minor-6: moveTo/lineTo segments, so stroked rules are observable
    let quads = 0,
      curX = null,
      curY = null;
    const c = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
      font: "",
      textAlign: "left",
      textBaseline: "middle",
      shadowColor: "",
      shadowBlur: 0,
      lineJoin: "round",
      lineCap: "round",
      fillRect(x, y, w, h) {
        rects.push({ x, y, w, h, fill: c.fillStyle });
      },
      strokeRect() {},
      clearRect() {},
      fillText(s, x, y) {
        const m = /(\d+(?:\.\d+)?)px/.exec(c.font);
        texts.push({
          s: String(s),
          x,
          y,
          font: c.font,
          px: m ? +m[1] : 10,
          align: c.textAlign,
        });
      },
      strokeText() {},
      beginPath() {},
      moveTo(x, y) { curX = x; curY = y; },
      lineTo(x, y) {
        lines.push({ x0: curX, y0: curY, x1: x, y1: y });
        curX = x; curY = y;
      },
      closePath() {},
      fill() {},
      stroke() {},
      arc() {},
      arcTo() {},
      ellipse() {},
      quadraticCurveTo() {
        quads++;
      },
      bezierCurveTo() {},
      save() {},
      restore() {},
      translate() {},
      scale() {},
      rotate() {},
    };
    pathRects(c, rects);
    return { c, texts, rects, lines, get quads() { return quads; } };
  };
  const plateOf = (rects) => rects.find((r) => r.fill === PLATE_FILL);
  const last = (arr) => arr[arr.length - 1];
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    {
      /* the MENU page (v202 Task 3.1): its plan's PLAY word and SOURCE label sit inside the plate's bed, 8+ px in; the foot (MOVE) under the plate */
      const { c } = rec(), { ITEMS } = await import("../src/app/menuapp.js"), pg = await import("../src/render/pages/menu.js");
      md.drawMenu(c, { rows: ITEMS, focus: "PLAY", level: 1, rev: "v0", enterT: 1 }, L, 1);
      const { G, P } = pg._dbg.last, d = G.d, p = d.plate, start = P.rows.PLAY.word, src = P.rows.SOURCE, move = P.foot.START.parts.find((q) => q.t === "MOVE");
      check(
        `menu plate+rows inset at ${W}x${H}`,
        !!start && !!src && !!move && start.y > p.y + 8 && src.label.y < p.y + p.h - 8 && P.foot.START.mid > p.y + p.h && G.mode === "desk",
        JSON.stringify({ p, start: start && start.y, src: src && src.label.y, move: P.foot.START.mid }),
      );
    }
    /* LEVEL SELECT (v202 Task 3.3, pages/level.js): this recorder has no clip, so the page hands back its plan; the checks read what it would paint */
    const lvp = await import("../src/render/pages/level.js"), J = JSON.stringify;
    {
      md.drawLevelSelect(rec().c, 3, L, 1, 1);
      const P = lvp._dbg.last.P, heat = P.keys.filter((q) => q.set === "heat");
      check(
        `level select difficulty bank at ${W}x${H}`,
        J(heat.map((q) => q.s)) === J(["NORMAL", "HARD", "EXPERT"]) && heat[1].kind === "lit" && P.rows.DIFFICULTY.label.s === "DIFFICULTY",
        J(heat.map((q) => q.s + ":" + q.kind)),
      );
    }
    {
      /* LOCKED (no first CLEAR): no MODIFIERS row, door or list in the shared geometry; levels 6-8 wall keys; the help says how to open them */
      md.drawLevelSelect(rec().c, 3, L, 1, 1);
      const { P } = lvp._dbg.last, G = md.levelGeom(L, false);
      check(
        `level select LOCKED draws no MODIFIERS row at ${W}x${H}`,
        !P.rows.MODIFIERS && G.mods === null && G.mode.length === 0 && G.list === null && G.rows.MODIFIERS === null &&
          P.keys.filter((q) => q.set === "level" && q.lock).length === 3 && P.help.lines.join(" ") === "Level 3 of 8. Clear level 5 to open 6 to 8.",
        J([P.help && P.help.lines, G.rows.MODIFIERS]),
      );
    }
    {
      md.drawLevelSelect(rec().c, 3, L, 1, 1, 0, true, 0, true, false, { row: "MODIFIERS", open: true, cur: 4 });
      const { P, G, verb } = lvp._dbg.last, d = G.d, p = d.plate, names = P.list.map((q) => q.lines.join(" "));
      check(
        `level select UNLOCKED, the list open: the five MODIFIERS entries, TIME TRIAL on at ${W}x${H}`,
        J(names) === J(["ONE LIFE", "NO FLOOR ITEMS", "FEWER ITEMS", "SHRINK", "TIME TRIAL"]) && P.list[4].on && !P.list[0].on && G.mode.length === 5,
        J(names),
      );
      check(
        `the list's help, the head and the foot at ${W}x${H}`,
        P.help.lines.join(" ") === "A timer and a best time for each level." && P.title.s === "LEVEL SELECT" && P.rows.MODIFIERS.label.s === "MODIFIERS" && verb === "list" && md.levelFoot("MODIFIERS", true) === "PICK ↑↓ · TOGGLE ENTER · CLOSE ESC",
        J([P.help.lines, verb]),
      );
      const inside = (r, q) => r.x >= q.x && r.y >= q.y && r.x + r.w <= q.x + q.w && r.y + r.h <= q.y + q.h;
      check(
        `the list stays inside the plate, under the MODIFIERS row, its help under it; START inside the plate at ${W}x${H}`,
        d.mode5.every((r) => inside(r, p) && r.y >= d.mods.y + d.mods.h) && P.help.ys[0] > d.mode5[4].y && inside(d.start, p),
        J({ p, list: d.listR, help: P.help.ys, start: d.start }),
      );
    }
    /* levelHit is levelGeom's own table: every painted rect's centre maps to its target (levels past the cap read lock), a blank spot on the
       plate is inert and only a tap off the plate backs out */
    for (const U of [false, true]) for (const T of [false, true]) for (const open of U ? [false, true] : [false]) for (const fr of open ? ["MODIFIERS"] : (() => { const G0 = md.levelGeom(L, U, T); return G0.pages > 1 ? G0.d.pages.map((q) => q[0]) : ["LEVEL"]; })()) {
      /* a paged compact (608x352 touch): every page, its row's geometry */
      const G = md.levelGeom(L, U, T, open, fr), S = G.S, ctr = (r) => [r.x + r.w / 2, r.y + r.h / 2];
      const hit = (r) => md.levelHit(...ctr(r), L, U, T, open, fr);
      const bad = [], over = open && G.lay === "compact";
      if (!over) G.room.forEach((r, i) => { const h = hit(r); if (h.k !== (i < G.cap ? "room" : "lock") || h.i !== i) bad.push("room" + i); });
      for (const k of over ? ["mode"] : ["heat", "pace", "mode"]) G[k].forEach((r, i) => { const h = hit(r); if (h.k !== k || h.i !== i) bad.push(k + i); });
      if (G.mods && hit(G.mods).k !== "mods") bad.push("mods");
      if (G.pageKeys) G.pageKeys.forEach((r, i) => { const p = G.page + (i ? 1 : -1), h = hit(r); if (p >= 0 && p < G.pages ? h.k !== "page" || h.row !== G.d.pages[p][0] : h.k !== "none") bad.push("page" + i); });
      if (hit(G.start).k !== "start") bad.push("start");
      if (G.back && hit(G.back).k !== "back") bad.push("BACK");
      if (md.levelHit(S.x + S.w - 4, S.y + 4, L, U, T, open, fr).k !== "none") bad.push("blank");
      if (md.levelHit(S.x - G.T - 2, S.y + S.h / 2, L, U, T, open, fr).k !== "back" && S.x - G.T - 2 > 0) bad.push("back");
      if (G.mode.length !== (open ? 5 : 0) || G.cap !== (U ? 8 : 5)) bad.push("shape");
      check(`levelHit round-trips levelGeom (${U ? "unlocked" : "locked"}${T ? " touch" : ""}${open ? ", list open" : ""}) at ${W}x${H}`, bad.length === 0, bad.join());
    }
    {
      const { c, texts, rects } = rec();
      md.drawScores(c, DEFAULT_SCORES, L, 1, 0);
      const p = plateOf(rects);
      const esc = texts.find((t) => t.s.indexOf("ESC BACK") >= 0);
      const ten = texts.find((t) => t.s === "10");
      const dates = texts.filter((t) => t.s === "2026-08-23");
      const tabs = ["NORMAL", "HARD", "EXPERT"].map((n) =>
        texts.find((t) => t.s === n),
      );
      check(
        `scores NORMAL/HARD/EXPERT tabs + 10 rows + foot inside plate at ${W}x${H}`,
        !!p &&
          !!esc &&
          !!ten &&
          dates.length === 10 &&
          tabs.every((t) => !!t) &&
          tabs.every((t) => t.y > p.y + 8 && t.y < ten.y) &&
          esc.s.indexOf("DIFFICULTY") >= 0 &&
          ten.y < esc.y &&
          esc.y < p.y + p.h - 4 &&
          last(dates).y < esc.y &&
          ten.y > p.y + 8,
        JSON.stringify({
          py: p && p.y,
          ph: p && p.h,
          ten: ten && ten.y,
          esc: esc && esc.y,
          tabsY: tabs.map((t) => t && t.y),
        }),
      );
    }
    {
      const { c, texts } = rec();
      md.drawScores(c, [], L, 1, 1);
      check(
        `empty HARD tab shows NO HARD DIFFICULTY RUNS YET at ${W}x${H}`,
        texts.some((t) => t.s === "NO HARD DIFFICULTY RUNS YET"),
        texts.map((t) => t.s).join("|"),
      );
    }
    {
      const { c, texts, rects } = rec();
      md.drawEnemiesHelp(c, L, 1);
      const p = plateOf(rects);
      const names = [
        "WALKER",
        "SENTRY",
        "FAST",
        "CHASER",
        "PHANTOM",
        "ROCKET",
        "BURROW",
        "SHADE",
        "KNIGHT",
      ];
      const hits = names.map((n) => texts.find((t) => t.s === n));
      const esc = texts.find((t) => t.s.indexOf("ESC BACK") >= 0);
      const cards = rects.filter((r) => r.fill === "rgba(4,7,14,0.72)");
      const textEnd = (t) => {
        const w = t.s.length * t.px * 0.62;
        return t.align === "center" ? t.x + w / 2 : t.x + w;
      };
      const inPlate = (t) =>
        t.y > p.y + 8 &&
        t.y < p.y + p.h - 4 &&
        t.x > p.x + 4 &&
        textEnd(t) < p.x + p.w - 8;
      const cardIn = cards.every(
        (r) =>
          r.x >= p.x + 8 &&
          r.y >= p.y + 8 &&
          r.x + r.w <= p.x + p.w - 8 &&
          r.y + r.h <= p.y + p.h - 8,
      );
      const rooms = texts.filter((t) => /^LEVELS? \d/.test(t.s)); // LEVEL 8 for KNIGHT's one level
      check(
        `enemies 9 + ESC inside plate at ${W}x${H}`,
        !!p &&
          !!esc &&
          hits.every((h) => !!h) &&
          hits.every((h) => inPlate(h)) &&
          rooms.length === 9 &&
          rooms.every((t) => inPlate(t)) &&
          cards.length === 9 &&
          cardIn &&
          inPlate(esc) &&
          esc.s === "ESC BACK" &&
          cards.every((r) => r.y + r.h < esc.y - 4),
        JSON.stringify({
          py: p && p.y,
          ph: p && p.h,
          pw: p && p.w,
          px: p && p.x,
          esc,
          hits,
          rooms: rooms.map((t) => ({ s: t.s, x: t.x, y: t.y, end: textEnd(t) })),
          cards: cards.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
        }),
      );
    }
    {
      const recd = rec();
      md.drawHowTo(recd.c, L, 1);
      const { texts, rects, quads } = recd;
      const p = plateOf(rects);
      const names = ["BOMB", "THROW", "REMOTE", "KICK"];
      const hits = names.map((n) =>
        texts.find((t) => t.s === n || t.s.indexOf(n) === 0),
      );
      const title = texts.find((t) => t.s === "HOW TO PLAY");
      const esc = texts.find((t) => t.s.indexOf("ESC") >= 0);
      check(
        `how to catalog glyphs + plate at ${W}x${H}`,
        !!p &&
          !!title &&
          !!esc &&
          hits.every((h) => !!h) &&
          hits.every((h) => h.y > p.y + 8 && h.y < p.y + p.h - 8) &&
          title.y > p.y &&
          title.y < p.y + p.h &&
          esc.y < p.y + p.h - 4 &&
          quads >= 1 &&
          !texts.some((t) => t.s === "bomb") &&
          !texts.some((t) => t.s.indexOf("5 rooms") >= 0),
        JSON.stringify({
          py: p && p.y,
          ph: p && p.h,
          quads,
          labels: texts.map((t) => t.s),
          hits: hits.map((h) => h && h.y),
        }),
      );
    }
    {
      const { c, texts, rects } = rec();
      md.drawGuide(c, L, 1, 1);
      const p = plateOf(rects);
      const rows = ["HOW TO PLAY", "POWER-UPS", "ENEMIES"];
      const hits = rows.map((n) => texts.find((t) => t.s === n));
      const esc = texts.find((t) => t.s.indexOf("ESC BACK") >= 0);
      check(
        `guide: three rows + ESC inside the plate at ${W}x${H}`,
        !!p &&
          !!esc &&
          hits.every((h) => !!h) &&
          hits.every((h) => h.y > p.y + 8 && h.y < p.y + p.h - 8) &&
          esc.y < p.y + p.h - 4,
        JSON.stringify({ py: p && p.y, ph: p && p.h, hits, esc }),
      );
    }
    /* v202 Task 3.4: SETTINGS is the world-kit page (pages/settings.js); this box is its single column (no pane), scaled as one piece. Read with
       the shared recorder (it clips, so the page paints; texts are design px, the geometry's G.d). */
    const V12 = { mus: 100, sfx: 100, snd: 1, r3d: 1, cam: 2, bri: 130, shk: 1, flx: 0 }, SP = settingsPage;
    const opt = (R, ui, touch) => { const r = textrec(); md.drawSettings(r.ctx, L, 1, { rows: R, vals: V12, togT: -1, rev: "v99", touch, ...ui }); return { r, G: md.settingsGeom(L, !!touch, R), Pl: SP._dbg.last.Pl }; };
    {
      const K = opt(optRows(true), { row: "CAMERA", r3d: true }), texts = K.r.texts, d = K.G.d, F = K.Pl.foot;
      const first = texts.find((t) => t.s === "MUSIC"), lastRow = texts.find((t) => t.s === "RESET DEFAULTS"), kick = texts.find((t) => t.s === "BUILD v99");
      const T = opt(optRows(true), { row: "CAMERA", r3d: true }, true), dT = T.G.d, FT = T.Pl.foot, pgT = T.G.pageOf.CAMERA, ftT = T.r.texts.find((t) => t.s === "PAGE " + (pgT + 1) + " OF " + T.G.pages.length); // a touch column pages its 44 CSS px rows (fix round 1): the page keys' strip where the foot was
      /* Twelve rows and the foot, no line of key chords on either layout: a fixed line would lie after a rebind (HOW TO keeps the long form).
         Touch names the tap model in the foot. */
      check(
        `options plate: twelve rows and the foot inside, the fixed key line is gone at ${W}x${H}`,
        !!first && !!lastRow && !!kick && !!F && !texts.some((t) => /BOMB SPACE|MOVE WASD/.test(t.s)) &&
          ["ROW", "CHANGE", "BACK"].every((s) => texts.some((t) => t.s === s)) &&
          first.y > d.plate.y + 8 && lastRow.y < F.y && F.y + F.h < d.plate.y + d.plate.h - 8 + 0.01,
        JSON.stringify({ p: d.plate, first, lastRow, F }),
      );
      const bed = T.r.paints.find((q) => q.op === "fillRect" && q.style === worldTokens(1).bedA);
      const lastOn = T.G.pages[pgT].at(-1), K2 = dT.keys;
      check(
        `options touch: no controls line, the page keys' strip (PAGE n OF m, ▲ ▼) under the focused row's page, inside the touch plate, the plate where the geometry puts it at ${W}x${H}`,
        !!ftT && !FT && !!K2 && T.G.pages.length > 1 && !T.r.texts.some((t) => /BOMB SPACE|TAP PAUSE PILL/.test(t.s)) && !T.r.texts.some((t) => t.s === "CHANGE") && !texts.some((t) => t.s === md.FOOT_TAP) &&
          ftT.y > T.r.texts.find((t) => t.s === lastOn).y && K2.up.y + K2.up.h < dT.plate.y + dT.plate.h - 8 + 0.01 &&
          !!bed && Math.abs(bed.box.x - T.G.plate.x) <= 0.01 && Math.abs(bed.box.y - T.G.plate.y) <= 0.01 && Math.abs(bed.box.h - T.G.plate.h) <= 0.01,
        JSON.stringify({ plate: T.G.plate, bed: bed && bed.box, FT }),
      );
      /* The single column's rows are 34 design px, its courses 10 (a touch box floors them at 44 CSS px while the page keeps FLOOR_U, else they give
         way); the page scales as one piece to the box, its plate and ring inside; the drawn labels sit on the geometry's row centres (draw ->
         settingsHit share one table). */
      /* keyboard: the single column's rows are 34 design px, its courses 10, scaled as one piece; touch (fix round 1): every row >= 44 CSS px (css 1
         here: box px) and >= 8 apart, paged; the plate and ring inside the box; the drawn labels (the shown page) sit on the geometry's row centres */
      const rowsOk = (G, touch) => G.mode === "col" && G.u <= 1 && G.order.length === 12 && G.order.every((l) => (touch ? G.rows[l].h >= 43.99 : G.d.rows[l].h === 34)) &&
        (!touch || G.pages.every((pr) => pr.every((l, i) => !i || G.rows[l].y - G.rows[pr[i - 1]].y - G.rows[pr[i - 1]].h >= 7.99))) &&
        G.plate.x - G.T >= -0.01 && G.plate.y - G.T >= -0.01 && G.plate.x + G.plate.w + G.T <= W + 0.01 && G.plate.y + G.plate.h + G.T <= H + 0.01;
      const centred = (r, G, pg) => G.pages[pg].every((l) => { const t = r.texts.find((q) => q.s === l); return t && Math.abs(t.y - (G.d.rows[l].y + G.d.rows[l].h / 2)) < 0.01; });
      check(
        `options rows: 34 design px on keys, >= 44 CSS px 8 apart on touch (paged), courses between groups, plate inside the box at ${W}x${H}`,
        rowsOk(K.G, false) && rowsOk(T.G, true) && centred(K.r, K.G, 0) && centred(T.r, T.G, pgT) && d.divs.length === 5,
        JSON.stringify([K.G.u, T.G.u, d.divs.length]),
      );
      check(`3D rows show a real value in REAL 3D at ${W}x${H}`, texts.some((t) => t.s === "FAR") && texts.some((t) => t.s === "130%"), texts.map((t) => t.s).join("|"));
    }
    {
      const K = opt(optRows(false), { row: "MUSIC", r3d: false }), texts = K.r.texts, seen = new Set(), labs = texts.filter((t) => ALL_OPT.includes(t.s) && !seen.has(t.s) && seen.add(t.s));
      check(
        `3D-only rows are not drawn in CLASSIC 2D (no em dash, no CAMERA / BRIGHTNESS value) at ${W}x${H}`,
        texts.filter((t) => t.s === "—").length === 0 && !texts.some((t) => t.s === "FAR" || t.s === "130%"),
        texts.map((t) => t.s).join("|"),
      );
      check(
        `CLASSIC 2D draws its ten labels in order, CAMERA and BRIGHTNESS hidden, each on its row centre at ${W}x${H}`,
        JSON.stringify(labs.map((t) => t.s)) === JSON.stringify(["MUSIC", "SFX", "SOUND", "ART STYLE", "SCREEN SHAKE", "REDUCE FLASH", "ANALYTICS", "GRAPHICS", "CONTROLS", "RESET DEFAULTS"]) &&
          labs.every((t) => Math.abs(t.y - (K.G.d.rows[t.s].y + K.G.d.rows[t.s].h / 2)) < 0.01) && K.G.order.length === 10,
        texts.map((t) => t.s).join("|"),
      );
      check(`RENDER reads CLASSIC 2D with px unset at ${W}x${H}`, texts.some((t) => t.s === "CLASSIC 2D") && !texts.some((t) => t.s === "PIXEL"));
    }
    {
      const { r } = opt(optRows(false), { row: "ART STYLE", vals: { ...V12, r3d: 0, px: 1 }, r3d: false, px: true }), texts = r.texts;
      check(`RENDER reads PIXEL and the two 3D-only rows are not drawn at ${W}x${H}`,
        texts.some((t) => t.s === "PIXEL") && !texts.some((t) => t.s === "CLASSIC 2D") && texts.filter((t) => t.s === "—").length === 0 && !texts.some((t) => t.s === "FAR" || t.s === "CAMERA" || t.s === "BRIGHTNESS"),
        texts.map((t) => t.s).join("|"));
      const AS = (r3d, px) => SP.settingsRows(optRows(r3d), {}, r3d, px)[optRows(r3d).indexOf("ART STYLE")];
      check("settingsRows three-way label, r3d wins", AS(false, false) === "CLASSIC 2D" && AS(false, true) === "PIXEL" && AS(true, true) === "REAL 3D");
    }
    {
      const { c, texts, rects, lines } = rec();
      md.drawStats(c, L, 0.4, {
        rows: [
          ["RUNS", "118"], ["LEVELS CLEARED", "214"], ["DEATHS", "301"],
          ["KILLS", "4820"], ["POWER-UPS", "913"], ["PLAY TIME", "14h 07m"], ["DAYS PLAYED", "12"],
          ["NORMAL DIFFICULTY", "1840 · LEVEL 5"], ["HARD DIFFICULTY", "—"], ["EXPERT DIFFICULTY", "—"],
        ],
        notes: [
          "DAILY 2026-09-07 · NOT PLAYED YET",
          "SINCE 2026-08-30 · LAST 2026-09-07 · 42 SESSIONS",
        ],
      });
      const all = texts.map((t) => t.s);
      const p = plateOf(rects);
      /* ATLAS: the BESTS caption replaced the old rule as the line that
         separates the seven lifetime tiles (+ MEDALS n/8) from the three
         per-heat best tiles (R12). It must sit strictly below every lifetime
         label and above every best value, and in the same place for an empty
         row list (geometry, never data, places it; never up in the head). */
      const CAP = "BESTS · NO MODIFIERS · NORMAL SPEED";
      const capOf = (tx) => tx.find((t) => t.s === CAP);
      check(
        `the BESTS caption sits strictly between the lifetime tiles and the NORMAL DIFFICULTY best at ${W}x${H}`,
        (() => {
          const cap = capOf(texts), core = texts.find((t) => t.s === "1840 · LEVEL 5");
          const life = ["RUNS", "LEVELS CLEARED", "DEATHS", "KILLS", "POWER-UPS", "PLAY TIME", "DAYS PLAYED", "MEDALS"].map((n) => texts.find((t) => t.s === n));
          return !!cap && !!core && life.every((t) => t && t.y < cap.y) && cap.y < core.y &&
            cap.y < (texts.find((t) => t.s === "NORMAL DIFFICULTY") || {}).y;
        })(),
        JSON.stringify({
          cap: capOf(texts),
          daysY: (texts.find((t) => t.s === "DAYS PLAYED") || {}).y,
          coreY: (texts.find((t) => t.s === "NORMAL DIFFICULTY") || {}).y,
        }),
      );
      {
        const e = rec();
        md.drawStats(e.c, L, 0.4, { rows: [], notes: [] });
        const S = md.statsGeom(L).S;
        check(
          `R12: an empty row list draws the BESTS caption where ten rows would, never up in the head at ${W}x${H}`,
          !!capOf(e.texts) && !!capOf(texts) && capOf(e.texts).y === capOf(texts).y && capOf(texts).y > S.by &&
            e.texts.some((t) => t.s === "0/8"),
          JSON.stringify({ empty: capOf(e.texts), ten: capOf(texts), by: S.by }),
        );
      }
      check(
        `stats plate paints all ten labels and the head at ${W}x${H}`,
        ["RUNS", "LEVELS CLEARED", "DEATHS", "KILLS", "POWER-UPS", "PLAY TIME", "DAYS PLAYED",
          "NORMAL DIFFICULTY", "HARD DIFFICULTY", "EXPERT DIFFICULTY", "STATS", "YOUR CABINET"]
          .every((s) => all.includes(s)),
        all.join("|"),
      );
      check(
        `stats plate paints both notes and the copy foot at ${W}x${H}`,
        all.some((s) => s.indexOf("NOT PLAYED YET") >= 0) &&
          all.some((s) => s.indexOf("42 SESSIONS") >= 0) && all.includes(CAP) &&
          all.includes("↑ TABS · T MEDALS · C COPY MY STATS · R RESET · ESC BACK"), // the body's foot (no tab-row flag): ↑ TABS leads it
        all.join("|"),
      );
      check(
        `stats plate shows NO json at ${W}x${H} — it is a screen, not a debug dump`,
        !all.some((s) => /[{}\[\]]/.test(s)),
        all.join("|"),
      );
      const last = texts[texts.length - 1];
      check(
        `every stats line stays inside the plate at ${W}x${H}`,
        !!p && texts.every((t) => t.y > p.y && t.y < p.y + p.h),
        JSON.stringify({ py: p && p.y, ph: p && p.h, last }),
      );
    }
  }
}

// 13f) R6 MEDALS page (SCREEN.TROPHIES): head, eight rows, foot, all inside the plate
{
  const md = await import("../src/render/menudraw.js");
  const { medalRows, MEDAL } = await import("../src/app/medals.js");
  const rec = () => {
    const texts = [], rects = [], rings = [];
    const c = {
      fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1, font: "",
      textAlign: "left", textBaseline: "middle",
      fillRect(x, y, w, h) { rects.push({ x, y, w, h, fill: c.fillStyle }); },
      strokeRect() {},
      stroke() { rings.push(c.strokeStyle); },
      fillText(s, x, y) {
        texts.push({ s: String(s), x, y, fill: c.fillStyle, a: c.globalAlpha, align: c.textAlign });
      },
    };
    pathRects(c, rects);
    return { c, texts, rects, rings };
  };
  const plateOf = (rects) => rects.find((r) => r.fill === PLATE_FILL);
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    const rows = medalRows(MEDAL.IRONCROWN | MEDAL.FLAWLESS);
    const { c, texts, rects, rings } = rec();
    md.drawTrophies(c, L, 0.4, rows);
    const all = texts.map((t) => t.s);
    const p = plateOf(rects);
    /* A goal wraps to at most two lines in its tile: rebuild each one from
       the lines painted under its name (same x, until the next tile). */
    const descOf = (name) => {
      const i = texts.findIndex((t) => t.s === name);
      if (i < 0) return null;
      const out = [];
      for (let j = i + 1; j < texts.length && texts[j].x === texts[i].x && texts[j].y > texts[i].y; j++) out.push(texts[j].s);
      return out.join(" ");
    };
    check(
      `R6 MEDALS page paints the head, the 2/8 kicker, all eight names, every whole goal and the foot at ${W}x${H}`,
      all.includes("MEDALS") && all.includes("2/8") &&
        rows.every((r) => all.includes(r[0]) && descOf(r[0]) === r[1]) &&
        !all.some((s) => s.indexOf("…") >= 0) &&
        all.includes("←→ TAB · ENTER / ESC BACK"),
      all.join("|") + " :: " + rows.map((r) => descOf(r[0])).join(" / "),
    );
    check(
      `R6 every MEDALS line stays inside the plate at ${W}x${H}`,
      !!p && texts.every((t) => t.y > p.y && t.y < p.y + p.h &&
        (t.align !== "left" || t.x >= p.x) && (t.align !== "right" || t.x <= p.x + p.w)),
      JSON.stringify({ p, last: texts[texts.length - 1] }),
    );
    /* ATLAS: the lock lives in the disc, never in a 0.45 alpha. Earned = an
       accent-filled 22px disc with a dark star, name in TEXT; a goal = a hollow
       muted ring, name in the soft #b6c2dc. The head bar fills n/8. */
    const on = texts.find((t) => t.s === "IRON CROWN"), off = texts.find((t) => t.s === "SPRINT");
    const stars = texts.filter((t) => t.s === "★"), discs = rects.filter((r) => r.path && r.fill === "#37f0d0" && Math.abs(r.w - 22) < 0.01 && Math.abs(r.h - 22) < 0.01);
    const tileOf = (t) => rects.find((r) => r.fill === "rgba(4,7,14,0.55)" && t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h);
    const earned = rows.filter((r) => r[2]).map((r) => tileOf(texts.find((t) => t.s === r[0])));
    check(
      `R6 earned medals fill their disc with a star, goals stay a hollow ring, never 0.45 alpha at ${W}x${H}`,
      on && off && on.fill === "#dfe7f5" && on.a === 1 && off.fill === "#b6c2dc" && off.a === 1 &&
        stars.length === 2 && stars.every((t) => t.fill === "#0a0e18" && earned.includes(tileOf(t))) &&
        discs.length === 2 && discs.every((d) => earned.includes(tileOf({ x: d.x + 11, y: d.y + 11 }))) &&
        rings.filter((k) => k === "#7385ad").length === 6 &&
        texts.every((t) => t.a === 1) &&
        rects.some((r) => r.fill === "#37f0d0" && r.h === 3 && r.w === 160 * 2 / 8),
      JSON.stringify({ on, off, stars: stars.length, discs: discs.length, rings }),
    );
    check(
      `R6 the page leaves globalAlpha at 1 at ${W}x${H}`,
      c.globalAlpha === 1,
      String(c.globalAlpha),
    );
    if (H === 520) {
      const lines = texts.filter((t) => t.align === "left");
      check(
        `R6 every medal name and goal line sits inside its own tile at ${W}x${H}`,
        lines.length >= 16 && lines.every((t) => !!tileOf(t)),
        JSON.stringify(lines.filter((t) => !tileOf(t))),
      );
    }
    const e = rec();
    let threw = false;
    try { md.drawTrophies(e.c, L, 0.4, undefined); } catch (_) { threw = true; }
    const names = rows.map((r) => r[0]);
    check(
      `R6 rows undefined paints 8 goal rings with name-free placeholders without throwing at ${W}x${H}`,
      !threw && e.texts.filter((t) => t.s === "—").length === 8 &&
        e.rings.filter((k) => k === "#7385ad").length === 8 &&
        !e.texts.some((t) => t.s === "★") &&
        e.texts.some((t) => t.s === "0/8") &&
        !e.texts.some((t) => names.includes(t.s)),
      e.texts.map((t) => t.s).join("|"),
    );
  }
}

// 13g) Reset (wave-3 §7.4): STATS idle foot names R RESET; armed, two red
// notes replace the daily/since notes and the foot turns red, all inside S
{
  const md = await import("../src/render/menudraw.js");
  const IDLE = "↑ TABS · T MEDALS · C COPY MY STATS · R RESET · ESC BACK"; // the body's foot: RECORDS' ↑ TABS lead (fix round 1)
  const ARMED = [
    "ERASES SCORES · BESTS · TIMES · DAILY · MEDALS · PLAQUES · GHOSTS",
    "ERASES STATS + DAYS PLAYED · RELOCKS LEVELS 6-8 · MODIFIERS · TIME TRIAL",
    "R AGAIN ERASES · OTHER KEYS CANCEL · KEEPS SETTINGS + GAME SPEED · C COPY",
  ];
  const rec = () => {
    const texts = [], rects = [];
    const c = {
      fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1, font: "",
      textAlign: "left", textBaseline: "middle",
      fillRect(x, y, w, h) { rects.push({ x, y, w, h, fill: c.fillStyle }); },
      strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      fillText(s, x, y) { texts.push({ s: String(s), x, y, fill: c.fillStyle }); },
    };
    pathRects(c, rects);
    return { c, texts, rects };
  };
  const plateOf = (rects) => rects.find((r) => r.fill === PLATE_FILL);
  const ui = { rows: [["RUNS", "1"]], notes: ["DAILY 2026-10-08 · NOT PLAYED YET", "SINCE 2026-10-01 · 3 SESSIONS"] };
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    {
      const { c, texts, rects } = rec();
      md.drawStats(c, L, 0.4, ui);
      const p = plateOf(rects), ft = texts.find((t) => t.s === IDLE);
      check(`Reset: the idle STATS foot names R RESET, muted, inside the plate at ${W}x${H}`,
        !!p && !!ft && ft.fill === "#7385ad" && ft.y > p.y && ft.y < p.y + p.h &&
          texts.some((t) => t.s === ui.notes[0]) && !texts.some((t) => ARMED.includes(t.s)),
        texts.map((t) => t.s).join("|"));
      check(`Reset: an explicit arm=false draws exactly the idle plate at ${W}x${H}`,
        (() => { const e = rec(); md.drawStats(e.c, L, 0.4, ui, false);
          return JSON.stringify(e.texts) === JSON.stringify(texts); })());
    }
    {
      const { c, texts, rects } = rec();
      md.drawStats(c, L, 0.4, ui, true);
      const p = plateOf(rects), iw = p ? p.w - 32 : 0;
      const got = ARMED.map((s) => texts.find((t) => t.s === s));
      check(`Reset: armed, both notes and the foot paint in #ff5d73 at ${W}x${H}`,
        got.every((t) => t && t.fill === "#ff5d73"), JSON.stringify(got));
      check(`Reset: armed lines replace the daily/since notes and the idle foot at ${W}x${H}`,
        !texts.some((t) => ui.notes.includes(t.s) || t.s === IDLE), texts.map((t) => t.s).join("|"));
      check(`Reset: armed lines stay inside the plate, notes above the foot at ${W}x${H}`,
        !!p && got.every((t) => t && t.y > p.y && t.y < p.y + p.h) && got[0].y < got[1].y && got[1].y < got[2].y,
        JSON.stringify({ p, got }));
      check(`Reset: every idle and armed string fits S.iw at the 0.6 em advance at ${W}x${H}`,
        iw > 0 && [IDLE, ...ARMED].every((s) => [...s].length <= 74 && [...s].length * 10 * 0.6 <= iw),
        String(iw));
    }
  }
}

// 13e) settingsHit: the tap map derived from the same geometry the page draws (v202 Task 3.4: pages/settings.js, rows by name).
// ATLAS rule: a row = its index; on the plate but off the rows (head, foot, courses' outer margins) = -2, inert; off the plate = -1, main backs out.
{
  const md = await import("../src/render/menudraw.js");
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    for (const touch of [false, true]) for (const R of [optRows(false), optRows(true)]) {
      const n = R.length, tag = `${W}x${H}${touch ? " touch" : ""}, ${n} rows`;
      const g = md.settingsGeom(L, touch, R), S = g.plate, rr = (l) => g.rows[l], hr = (l) => g.hit[l], last = rr(R[n - 1]);
      const mid = rr(R[0]).x + rr(R[0]).w / 2, cy = rr(R[0]).y + rr(R[0]).h / 2;
      /* the page on screen is the focused row's (L.focus, an index into R; fix round 1): each page is tapped with its own first row focused */
      const hitOn = (l) => (x, y) => md.settingsHit(x, y, { ...L, focus: R.indexOf(g.pages[g.pageOf[l]][0]) }, R, touch), hit = hitOn(R[0]), hitL = hitOn(R[n - 1]);
      check(`settingsHit maps every row centre at ${tag} (${g.pages.length} page(s))`, R.every((l, i) => hitOn(l)(mid, rr(l).y + rr(l).h / 2) === i) && g.order.length === n);
      check(`settingsHit on the plate above the rows (head) is -2, inert at ${tag}`, hit(mid, hr(R[0]).y - 0.5) === -2 && hit(mid, S.y + 4) === -2);
      check(`settingsHit the last row (${n - 1}) is RESET DEFAULTS' band, its whole height at ${tag}`, R[n - 1] === "RESET DEFAULTS" && hitL(mid, last.y + last.h / 2) === n - 1 && hitL(mid, last.y + last.h - 0.001) === n - 1);
      check(`settingsHit on the plate below the rows (foot / page keys' strip off its keys) is -2, inert at ${tag}`, hitL(mid, hr(R[n - 1]).y + hr(R[n - 1]).h + 0.5) === -2 && hitL(S.x + 6, S.y + S.h - 4) === -2);
      check(`settingsHit off the plate is -1 (back) at ${tag}`,
        hit(S.x - 2, cy) === -1 && hit(S.x + S.w + 2, cy) === -1 && hit(mid, S.y - 2) === -1 && hit(mid, S.y + S.h + 2) === -1);
      check(`settingsHit: the plate's side margin beside a row is that row (a row owns its lane out to the plate's edge) at ${tag}`, hit(S.x + 4, cy) === 0 && hit(S.x + S.w - 4, cy) === 0);
      check(
        `settingsHit rows are contiguous on each page — no dead gutter, a gap owned half by each side at ${tag}`,
        g.pages.every((pr) => pr.every((l, i) => !i || Math.abs(hr(l).y - (hr(pr[i - 1]).y + hr(pr[i - 1]).h)) < 1e-6)) && hit(mid, hr(R[1]).y - 0.001) === 0 && hit(mid, hr(R[1]).y + 0.001) === 1,
        String(hit(mid, hr(R[1]).y)),
      );
    }
  }
}

// 13e2) GRAPHICS page (unified spec 2026-10-10 §5): geometry, tap map, rows,
// locks, preset glow, help lines, the door value and the FPS METER chip
{
  const md = await import("../src/render/menudraw.js");
  const { OPT_ROWS, SCREEN, createMenuApp } = await import("../src/app/menuapp.js");
  const gfx = await import("../src/app/gfx.js");
  const { drawShell } = await import("../src/render/shellview.js");
  const J = JSON.stringify;
  const rec = () => {
    const texts = [], rects = [];
    const c = {
      fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1, font: "", textAlign: "left", textBaseline: "middle", shadowColor: "", shadowBlur: 0,
      fillRect(x, y, w, h) { rects.push({ x, y, w, h, fill: c.fillStyle, a: c.globalAlpha }); },
      fillText(s, x, y) { const m = /(\d+(?:\.\d+)?)px/.exec(c.font); texts.push({ s: String(s), x, y, px: m ? +m[1] : 0, font: c.font, a: c.globalAlpha, blur: c.shadowBlur, fill: c.fillStyle, align: c.textAlign }); },
      measureText(s) { const m = /(\d+(?:\.\d+)?)px/.exec(c.font); return { width: String(s).length * 0.6 * (m ? +m[1] : 10) }; }, // the world-kit pages measure (v202 Task 3.4)
      strokeRect() {}, strokeText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, arc() {}, arcTo() {}, rect() {}, clip() {}, quadraticCurveTo() {}, ellipse() {}, bezierCurveTo() {}, save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, drawImage() {}, setTransform() {},
    };
    pathRects(c, rects);
    return { c, texts, rects };
  };
  check("no render-side copy of the SETTINGS rows: OPT_N is gone, the geometry sizes to the visible list it is handed (12 / 10)", md.OPT_N === undefined && md.settingsGeom(md.layout(600, 520), false, OPT_ROWS).order.length === 12 && md.settingsGeom(md.layout(600, 520), false, optRows(false)).order.length === 10);
  check("GFX_N === GFX_ROWS.length (8)", md.GFX_N === gfx.GFX_ROWS.length && md.GFX_N === 8);
  for (const R of [optRows(false), optRows(true)]) {
    const v = (lab, ...a) => settingsPage.settingsRows(R, {}, ...a)[R.indexOf(lab)], n = R.length; // moved with the page (v202 Task 3.4)
    check("settingsRows carries the door value at the GRAPHICS row (" + n + " rows)", v("GRAPHICS", false, false, "CUSTOM ›") === "CUSTOM ›" && v("GRAPHICS", false, false) === "›");
    check("settingsRows carries the CONTROLS door, RESET DEFAULTS has no value, one value per visible row (" + n + " rows)", v("CONTROLS", false, false, "AUTO ›", false, "CONTROLLER ›") === "CONTROLLER ›" && v("CONTROLS", false, false) === "›" && v("GRAPHICS", false, false) === "›" && v("RESET DEFAULTS", false, false) === "" && settingsPage.settingsRows(R, {}, false, false).length === n);
    check("settingsRows shows ANALYTICS ON/OFF from its own flag (" + n + " rows)", v("ANALYTICS", false, false, "", true) === "ON" && v("ANALYTICS", false, false) === "OFF");
  }
  const S = (o) => ({ ...(gfx.PRESETS.AUTO), fpm: 0, ...o });
  for (const [W, H] of [[600, 520], [608, 352]]) {
    const L = md.layout(W, H);
    for (const touch of [false, true]) {
      /* v202 Task 3.4: the single column in this box (rows 34 design px, touch floored or 34), scaled as one piece; the help sits under the rows */
      const g = md.graphicsGeom(L, touch), S = g.plate, rr = (i) => g.rows[g.order[i]], mid = rr(0).x + rr(0).w / 2, cy = rr(0).y + rr(0).h / 2, tg = `${W}x${H}${touch ? " touch" : ""}`;
      const hitOn = (i) => (x, y) => md.graphicsHit(x, y, { ...L, focus: g.order.indexOf(g.pages[g.pageOf[g.order[i]]][0]) }, 0, touch), hit = hitOn(0), hit7 = hitOn(7);
      const lastOf = (i) => g.pages[g.pageOf[g.order[i]]].at(-1);
      check(`graphics rows: 34 design px on keys, >= 44 CSS px 8 apart on touch (paged), the help under the shown page's last row, plate and ring inside the box (${tg})`,
        g.mode === "col" && g.u <= 1 && g.order.every((l) => (touch ? g.rows[l].h >= 43.99 : g.d.rows[l].h === 34)) && !!g.d.help && g.d.help.y >= g.d.rows[lastOf(7)].y + g.d.rows[lastOf(7)].h &&
          S.x - g.T >= -0.01 && S.y - g.T >= -0.01 && S.x + S.w + g.T <= W + 0.01 && S.y + S.h + g.T <= H + 0.01, J([g.u, g.d.help]));
      check(`graphicsHit maps every row centre at ${tg} (${g.pages.length} page(s))`, g.order.every((l, i) => hitOn(i)(mid, rr(i).y + rr(i).h / 2) === i));
      check(`graphicsHit on the plate off the rows is -2 (inert), off the plate -1 (back) at ${tg}`,
        hit(mid, g.hit[g.order[0]].y - 0.5) === -2 && hit7(S.x + 6, S.y + S.h - 4) === -2 &&
          hit(S.x - 2, cy) === -1 && hit(S.x + S.w + 2, cy) === -1 && hit(mid, S.y - 2) === -1 && hit(mid, S.y + S.h + 2) === -1);
      check(`graphicsHit: the plate's side margin beside a row is that row at ${tg}`, hit(S.x + 4, cy) === 0 && hit(S.x + S.w - 4, cy) === 0);
      check(`graphicsHit rows are contiguous at ${tg}`, hit(mid, g.hit[g.order[1]].y - 0.001) === 0 && hit(mid, g.hit[g.order[1]].y + 0.001) === 1);
    }
    for (const touch of [false, true]) for (const kind of ["2d", "px", "3d"]) {
      const g = md.graphicsGeom(L, touch);
      const { c, texts, rects } = rec();
      const view = gfx.gfxView(S({ fxq: 0 }), kind, { dpr3d: 1.5, dprPx: 1.5, limit: true, pendingAA: true });
      md.drawGraphics(c, L, 1, { row: 1, view, togT: 0.95, chg: 0b11, touch });
      const tag = `${kind}${touch ? " touch" : ""} ${W}x${H}`, d = g.d, Pl = settingsPage._dbg.last.Pl, gp = settingsPage._dbg.last.gp;
      const shown = g.pages[g.pageOf[gfx.GFX_ROWS[1]]], labels = shown.map((n) => texts.find((t) => t.s === n)), lastL = labels.at(-1); // the focused row's page (a touch column pages: fix round 1)
      check(`graphics: the shown page's labels (${shown.length} of 8) in the label face at the desk primary size inside the plate, no other row's (${tag})`, labels.every((t) => t && t.px === 21 && /^700 /.test(t.font) && /system-ui/.test(t.font) && t.y > d.plate.y + 8 && t.y < d.plate.y + d.plate.h - 8) && !gfx.GFX_ROWS.filter((n) => !shown.includes(n)).some((n) => texts.some((t) => t.s === n)) && (touch || shown.length === 8));
      check(`graphics: the title + its kicker (${tag})`, texts.some((t) => t.s === "GRAPHICS" && /^900 /.test(t.font)) && texts.some((t) => t.s === "PERFORMANCE · BATTERY"));
      const hs = gp.lines.map((q) => q.s), F = Pl.foot;
      check(`graphics: the selected row's help under the rows (the limit line kept first), then the foot (${tag})`, hs.length >= 1 && hs.length <= 2 && hs.join(" ").includes(gfx.HELP_LIMIT) && gp.lines.every((q) => texts.some((t) => t.s === q.s && t.y === q.y)) &&
        lastL.y < gp.lines[0].y && (F ? gp.lines.at(-1).y < F.y && F.y + F.h <= d.plate.y + d.plate.h + 0.01 : gp.lines.at(-1).y < d.keys.up.y), J(hs));
      check(`graphics: help lines fit the list width, whole (${tag})`, gp.lines.every((q) => q.w <= d.help.w + 0.01) && !texts.some((t) => /…/.test(t.s)));
      const lk = view.rows.filter((r) => r.locked).map((r) => r.label);
      const lockR = Object.values(Pl.rows).filter((o) => o.spec.t === "lock").map((o) => o.l), dash = texts.filter((t) => t.s === "—"), lkShown = lk.filter((n) => shown.includes(n));
      const lockParts = shown.reduce((n, l) => n + Pl.rows[l].val.P.filter((q) => q.k === "lock").length, 0);
      check(`graphics: locked rows are the wall key reading —, one lock part and one — each, drawn on the shown page (${tag})`, J(lockR) === J(lk) && dash.length === lkShown.length && lockParts === lkShown.length && lk.every((n) => Pl.rows[n].val.P.filter((q) => q.k === "lock").length === 1), J([dash.length, lkShown.length, lockParts]));
      const fl = rects.filter((r) => r.fill === "#fff2df" && r.a > 0 && r.a < 1);
      check(`graphics: the togT flash lights every changed row (chg mask), a hard overlay, no blur (${tag})`, fl.length === 2 && texts.every((t) => !t.blur), fl.length);
    }
  }
  {
    const { c, texts, rects } = rec();
    md.drawGraphics(c, md.layout(600, 520), 5, { row: 0, view: gfx.gfxView(S({}), "3d", {}), togT: -1, chg: 255 });
    check("graphics: no glow once togT is spent", texts.every((t) => !t.blur) && !rects.some((r) => r.fill === "#fff2df" && r.a > 0 && r.a < 1));
    const r2 = rec();
    md.drawGraphics(r2.c, md.layout(600, 520), 0, {});
    check("graphics: a missing view still paints the plate without throwing", r2.texts.some((t) => t.s === "GRAPHICS"));
  }
  // FPS METER
  check("meter: fps, density only in 3D / PIXEL, LIMIT", md.meterText({ fps: 58.4, kind: "3d", dpr3d: 1.5 }) === "58 FPS · 1.5X" &&
    md.meterText({ fps: 30, kind: "px", dprPx: 2, limit: true }) === "30 FPS · 2X · LIMIT" && md.meterText({ fps: 60, kind: "2d", dpr3d: 2 }) === "60 FPS" &&
    md.meterText(null) === "-- FPS");
  check("meter: IDLE tags the idle-gated screens, before LIMIT", md.meterText({ fps: 30, kind: "3d", dpr3d: 1.5 }, true) === "30 FPS · 1.5X · IDLE" &&
    md.meterText({ fps: 20, kind: "2d", limit: true }, true) === "20 FPS · IDLE · LIMIT" && md.meterText({ fps: 60, kind: "2d" }, false) === "60 FPS");
  check("OPTIONS / GRAPHICS foot: keys on desktop (label first, keycap last: the page's parts), the tap model on touch (one string, <=60)", md.FOOT_KEYS === undefined &&
    md.FOOT_TAP === "TAP A ROW TO CHANGE IT · TAP OUTSIDE TO GO BACK" && [...md.FOOT_TAP].length <= 60);
  for (const touch of [false, true]) {
    const { c, texts } = rec(), T2 = rec();
    md.drawSettings(c, md.layout(600, 520), 1, { rows: optRows(false), row: "MUSIC", vals: {}, touch });
    md.drawSettings(T2.c, md.layout(1024, 768, 207), 1, { rows: optRows(false), row: "MUSIC", vals: {}, touch }); // the tablet's desk: a foot in the pane
    const tapW = (q) => q.some((t) => t.s === md.FOOT_TAP || t.s === settingsPage.COPY.tapRow), keys = (q) => ["ROW", "CHANGE", "BACK"].every((s) => q.some((t) => t.s === s));
    check(`OPTIONS foot ${touch ? "touch: the tap model on the desk, the page keys' strip on a paged 600x520 column (fix round 1)" : "desktop"}`,
      touch ? tapW(T2.texts) && !keys(T2.texts) && texts.some((t) => /^PAGE 1 OF \d$/.test(t.s)) && !keys(texts) && !tapW(texts) : keys(texts) && !tapW(texts) && keys(T2.texts));
  }
  check("meter density format matches gfx.xOf", [1, 1.25, 1.5, 1.75, 2, 3].every((v) => md.meterText({ fps: 1, kind: "3d", dpr3d: v }) === "1 FPS · " + gfx.xOf(v)));
  {
    const { c, texts, rects } = rec();
    md.drawMeter(c, 600, 520, { fps: 58, kind: "3d", dpr3d: 1.5 });
    const t = texts[0], r = rects[0];
    check("meter: 9px muted chip at the bottom-right, inside the box", texts.length === 1 && t.px === 9 && t.fill === "#7385ad" && t.align === "right" &&
      r.x > 300 && r.x + r.w <= 600 && r.y + r.h <= 520 && r.x <= t.x - t.s.length * 5.4, JSON.stringify({ t, r }));
  }
  // shellview: the GRAPHICS screen, pause view 2, the door value and the meter on every screen
  {
    const world = { state: "PLAY", time: 0 };
    const a = createMenuApp({ settings: {} });
    const draw = () => { const R = rec(); drawShell(R.c, a, world, null, "2d", () => [], () => 0); return R.texts.map((t) => t.s); };
    a.screen = SCREEN.SETTINGS;
    check("shellview: OPTIONS shows the door value AUTO (its › the chevron)", draw().includes("AUTO"));
    a.screen = SCREEN.GRAPHICS; a.gfxRow = 2;
    let T = draw();
    check("shellview routes SCREEN.GRAPHICS to drawGraphics with the app's view", T.includes("PERFORMANCE · BATTERY") && T.includes(gfx.LOCK_RES) && !T.some((s) => / FPS/.test(s)));
    a.settings.fpm = 1; a.gfx = { fps: 30, kind: "2d" };
    const seen = [];
    for (const sc of ["MENU", "SETTINGS", "GRAPHICS", "LEVEL", "SCORES", "GUIDE", "STATS", "ATTRACT", "INTRO"]) {
      a.screen = SCREEN[sc]; if (draw().includes("30 FPS · IDLE")) seen.push(sc);
    }
    check("shellview: FPS METER chip on every shell screen, tagged IDLE off GAME PLAY", seen.length === 9, seen.join());
    a.screen = SCREEN.INTRO; a.introStage = 1;
    check("shellview: the INTRO show runs at the GAME cap, so no IDLE tag", draw().includes("30 FPS")); a.introStage = 0;
    a.screen = SCREEN.GAME;
    check("shellview: FPS METER in GAME PLAY too, untagged", draw().includes("30 FPS"));
    world.state = "PAUSE"; a.pauseView = 2;
    T = draw();
    check("shellview: PAUSE view 2 draws the GRAPHICS page against overlayBox, kicked as the pause", T.includes("GRAPHICS") && T.some((s) => /^PAUSED · LEVEL \d+$/.test(s)) && T.includes("30 FPS · IDLE"));
    a.pauseView = 1;
    check("shellview: PAUSE view 1 still draws OPTIONS with the door", draw().includes("AUTO") && draw().includes("GRAPHICS"));
    a.settings.fpm = 0; a.screen = SCREEN.MENU;
    check("shellview: meter OFF draws no chip", !draw().some((s) => / FPS$/.test(s)));
    a.screen = SCREEN.BOOT; a.settings.fpm = 1;
    check("shellview: BOOT draws nothing, meter included", draw().length === 0);
  }
  // SCORES memo: the getter runs on entry and on a heat change only
  {
    const a = createMenuApp({ settings: {} });
    let n = 0, pn = 0;
    const gs = () => { n++; return []; }, gp = () => { pn++; return 0; };
    const R = rec();
    a.screen = SCREEN.MENU; drawShell(R.c, a, { state: "PLAY", time: 0 }, null, "2d", gs, gp);
    a.screen = SCREEN.SCORES;
    for (let i = 0; i < 5; i++) drawShell(R.c, a, { state: "PLAY", time: 0 }, null, "2d", gs, gp);
    check("scores memo: five SCORES frames read the store once", n === 1 && pn === 1, n + "/" + pn);
    a.scoreHeat = 1; drawShell(R.c, a, { state: "PLAY", time: 0 }, null, "2d", gs, gp);
    check("scores memo: a heat change re-reads", n === 2, n);
    a.screen = SCREEN.MENU; drawShell(R.c, a, { state: "PLAY", time: 0 }, null, "2d", gs, gp);
    a.screen = SCREEN.SCORES; drawShell(R.c, a, { state: "PLAY", time: 0 }, null, "2d", gs, gp);
    check("scores memo: re-entering SCORES re-reads", n === 3 && pn === 2, n + "/" + pn);
    const fresh = () => { n += 10; return []; };
    drawShell(R.c, a, { state: "PLAY", time: 0 }, null, "2d", fresh, gp);
    check("scores memo: a different getter is never served stale data", n === 13, n);
  }
  // build tag on MENU (owner 2026-10-21: "a game version in some where in the display or menue"; v202 Task 3.1, the round 7 frames):
  // the keyboard foot ends with | vREV, the touch-landscape foot too; the phone carries it as SOURCE's teaser; painted once, inside the box, off
  // every key but SOURCE's, under the plate's fade (enterT 0 paints the plate at alpha 0); no rev, no tag
  {
    const { CACHE_NAME } = await import("../src/pwa/shell.js");
    const { shellGeo } = await import("../src/app/fit.js");
    const { ITEMS } = await import("../src/app/menuapp.js");
    const pg = await import("../src/render/pages/menu.js");
    const want = "v" + CACHE_NAME.match(/(\d+)$/)[1];
    const sg = shellGeo(393, 852);
    for (const [nm, W, H, touch, lg, css] of [["600x520 d", 600, 520, false], ["608x352 d", 608, 352, false], ["600x520 l", 600, 520, true], ["1366x768 #sh d", 1366, 768, false, 200, 1], ["phone #sh p", sg.w, sg.h, true, sg.logo, sg.s]]) {
      const L = md.layout(W, H, lg, css);
      const paint = (rev, et = 9) => { const R = textrec({ widthK: 0.6 }); md.drawMenu(R.ctx, { rows: ITEMS, focus: "PLAY", rev, level: 1, enterT: et }, L, 9, touch); return { R, last: pg._dbg.last }; };
      const { R, last } = paint("v99"), hit = R.texts.filter((t) => t.s.indexOf("v99") >= 0), G = last.G, u = G.u, phone = G.dev === "p"; // the phone column and the compact tiles carry it on SOURCE
      const where = phone ? last.P.rows.SOURCE.tz : last.P.foot[last.verb], tagY = phone ? where.ys[0] : where.mid, inBox = tagY * u > 0 && tagY * u < H;
      const onKey = !phone && ITEMS.some((l) => { const r = G.rows[l]; return tagY * u >= r.y && tagY * u <= r.y + r.h; });
      check(`MENU build tag painted once, inside the box, ${phone ? "as SOURCE's teaser" : "at the foot's end after a bar, off every key"} (${nm})`,
        hit.length === 1 && hit[0].s === "v99" && inBox && !onKey && (phone ? where.lines[0] === "v99" : where.parts[where.parts.length - 1].t === "v99" && where.parts[where.parts.length - 2].sep === "|"), JSON.stringify({ n: hit.length, tagY, u }));
      check(`MENU without rev paints no build tag (${nm})`, !paint("").R.texts.some((x) => /\bv\d+\b/.test(x.s)));
      const fade = paint("v99", 0), alphas = fade.R.writes.filter((w) => w.k === "globalAlpha").map((w) => w.v);
      check(`MENU build tag waits for the plate: at enterT 0 the plate, foot and logo draw at alpha 0 (${nm})`, alphas.includes(0), JSON.stringify(alphas));
    }
    const a = createMenuApp({ settings: {} });
    a.screen = SCREEN.MENU;
    const Rs = textrec({ widthK: 0.6 }); drawShell(Rs.ctx, a, { state: "PLAY", time: 0 }, null, "2d", () => [], () => 0);
    check("shellview: MENU foot carries the CACHE_NAME build tag end to end", Rs.texts.some((x) => x.s === want) && pg._dbg.last.P.foot[pg._dbg.last.verb].parts.some((q) => q.t === want), want);
  }
}

// 13f) menuHit: the MENU tap map is the page's one geometry (pages/menu.js menuGeom): every painted label lands on its own row; the logo above the
//      rows and the plate's foot padding below them are -1; a tap on the plate's bed beside a row is that row; the next-run card's slot is -1; a
//      row owns half of each gap beside it (no dead gutter), the 24 px breaks included.
{
  const md = await import("../src/render/menudraw.js");
  const pg = await import("../src/render/pages/menu.js");
  const items = ["PLAY", "LEVEL SELECT", "DAILY", "RECORDS", "SETTINGS", "GUIDE", "SOURCE"];
  const n = items.length;
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    md.drawMenu(textrec().ctx, { rows: items, focus: "PLAY", level: 1, enterT: 9 }, L, 9);
    const { G, P } = pg._dbg.last, u = G.u, at = Object.fromEntries(items.map((l) => { const o = P.rows[l]; return [l, o.k === "main" ? [o.word.foc * u, o.word.y * u] : [o.rest.x * u + 2, o.label.y * u]]; }));
    check(`menuHit maps every painted label to its row at ${W}x${H}`,
      items.every((s, i) => md.menuHit(at[s][0], at[s][1], L, n) === i), JSON.stringify(at));
    const g = md.menuGeom(L, n), R = items.map((l) => g.rows[l]), mid = R[0].x + R[0].w / 2;
    check(`menuHit above the rows (the logo) is -1 at ${W}x${H}`, md.menuHit(mid, R[0].y - 13 * u, L, n) === -1 && md.menuHit(mid, g.logo.y + g.logo.h / 2, L, n) === -1);
    check(`menuHit below the rows is -1 at ${W}x${H}`, md.menuHit(mid, R[n - 1].y + R[n - 1].h + 14 * u, L, n) === -1);
    check(`menuHit: a tap on the plate's bed beside a row is that row; the card's slot and off the plate are -1 at ${W}x${H}`,
      md.menuHit(g.plate.x + 2, R[0].y + R[0].h / 2, L, n) === 0 && md.menuHit(g.plate.x + 2, R[n - 1].y + R[n - 1].h / 2, L, n) === n - 1 && md.menuHit(g.card.x + g.card.w / 2, R[2].y + R[2].h / 2, L, n) === -1 && md.menuHit(1, R[2].y + R[2].h / 2, L, n) === -1);
    check(`menuHit rows are contiguous across gaps and breaks — no dead gutter at ${W}x${H}`,
      R.slice(0, -1).every((r, i) => { const m = (r.y + r.h + R[i + 1].y) / 2; return md.menuHit(mid, m - 0.01, L, n) === i && md.menuHit(mid, m + 0.01, L, n) === i + 1; }));
    check(`menu hero row (PLAY) is taller than the rest at ${W}x${H}`, R[0].h > R[1].h);
  }
}

// 13h) statsHit (T1): the STATS foot tap map rides the foot drawStats paints —
//      zones are derived from the painted string and its x/y at the 0.6 em
//      advance, half a separator wide on each side of a token.
{
  const md = await import("../src/render/menudraw.js");
  const paint = (L, arm) => {
    const texts = [];
    const c = new Proxy({}, {
      get: (t, p) => (p === "fillText" ? (s, x, y) => texts.push({ s: String(s), x, y }) : () => {}),
      set: () => true,
    });
    md.drawStats(c, L, 0.4, { rows: [], notes: [] }, arm);
    return texts[texts.length - 1];
  };
  const zones = (f) => {
    const x0 = f.x - f.s.length * 3, out = [];
    let a = 0;
    for (const tok of f.s.split(" · ")) {
      const b = a + tok.length;
      out.push([x0 + 6 * (a - 1.5), x0 + 6 * (b + 1.5)]);
      a = b + 3;
    }
    return out;
  };
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    for (const [arm, want] of [
      [false, [null, "KeyT", "KeyC", "KeyR", null]], // the body's ↑ TABS lead is no tap
      [true, ["KeyR", null, null, "KeyC"]],
    ]) {
      const f = paint(L, arm), z = zones(f), tag = `${arm ? "armed" : "idle"} at ${W}x${H}`;
      const mid = (i) => (z[i][0] + z[i][1]) / 2, live = want.findIndex((k) => k); // the first token that taps
      check(`statsHit: the ${tag} foot is the last line painted and splits into ${want.length} tokens`,
        !!f && z.length === want.length && f.s.startsWith(arm ? "R AGAIN" : "↑ TABS · T MEDALS"), f && f.s);
      check(`statsHit: every ${tag} token centre maps to its key`,
        want.every((k, i) => md.statsHit(mid(i), f.y, L, arm) === k),
        JSON.stringify(want.map((k, i) => md.statsHit(mid(i), f.y, L, arm))));
      check(`statsHit: 1 px outside each live ${tag} zone edge is not that key`,
        want.every((k, i) => !k || (md.statsHit(z[i][0] - 1, f.y, L, arm) !== k &&
          md.statsHit(z[i][1] + 1, f.y, L, arm) !== k && md.statsHit(z[i][0] + 1, f.y, L, arm) === k &&
          md.statsHit(z[i][1] - 1, f.y, L, arm) === k)));
      check(`statsHit: 1 px above the band (foot y - 12) is null ${tag}`,
        md.statsHit(mid(live), f.y - 13, L, arm) === null && md.statsHit(mid(live), f.y - 12, L, arm) !== null);
      check(`statsHit: the band reaches the plate bottom and no further ${tag}`,
        md.statsHit(mid(live), f.y + 16, L, arm) !== null && md.statsHit(mid(live), f.y + 17, L, arm) === null);
    }
  }
  const L = md.layout(600, 520), f = paint(L, false), z = zones(f);
  check("statsHit: the 600x520 idle zones are T 177-243 and R 351-411 on the band 464-492 (spec §4.1, moved by the ↑ TABS lead)",
    z[1][0] === 177 && z[1][1] === 243 && z[3][0] === 351 && z[3][1] === 411 && f.y === 476, JSON.stringify(z));
  const fa = paint(L, true), za = zones(fa);
  check("statsHit: the 600x520 armed zones are R AGAIN 72-174 and C COPY 474-528, both inside the 60-540 plate",
    za[0][0] === 72 && za[0][1] === 174 && za[3][0] === 474 && za[3][1] === 528 && fa.y === 476, JSON.stringify(za));
  check("statsHit: armed, no tap on the idle C COPY MY STATS zone (243-351) can land on R AGAIN",
    za[0][1] < z[2][0] && md.statsHit(z[2][0], f.y, L, true) === null, JSON.stringify([za[0], z[2]]));
}

// 13d) plaque chips on the SCORES plate: four labels, locked vs unlocked
//      styling distinct, chips stay inside the plate at both sizes, and
//      the pre-existing rows/tabs/foot still stay inside the plate too.
{
  const md = await import("../src/render/menudraw.js");
  const { DEFAULT_SCORES } = await import("../src/app/highscores.js");
  const rec = () => {
    const texts = [],
      rects = [];
    const c = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
      font: "",
      textAlign: "left",
      textBaseline: "middle",
      shadowColor: "",
      shadowBlur: 0,
      fillRect(x, y, w, h) {
        rects.push({ x, y, w, h, fill: c.fillStyle });
      },
      strokeRect() {},
      clearRect() {},
      fillText(s, x, y) {
        texts.push({
          s: String(s),
          x,
          y,
          fill: c.fillStyle,
          alpha: c.globalAlpha,
          align: c.textAlign,
        });
      },
      strokeText() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() {},
      stroke() {},
      arc() {},
      save() {},
      restore() {},
      translate() {},
      scale() {},
    };
    pathRects(c, rects);
    return { c, texts, rects };
  };
  const plateOf = (rects) => rects.find((r) => r.fill === PLATE_FILL);
  const PLAQUE = { CLEAR: 1, PLUS: 2, MAX: 4, CROWN: 8 };
  // "HARD"/"EXPERT" (the PLUS / MAX plaques) also name the DIFFICULTY tabs drawn above the chip row, so
  // disambiguate every chip by the unique "CLEAR" text's row-y, not by
  // first-match on the label string alone.
  const chipsOf = (texts) => {
    const clear = texts.find((t) => t.s === "CLEAR");
    const rowY = clear && clear.y;
    const rightmost = (s) => {
      const hits = texts.filter(
        (t) => t.s === s && Math.abs(t.y - rowY) < 0.01,
      );
      return hits.sort((a, b) => a.x - b.x)[hits.length - 1];
    };
    return {
      clear,
      plus: rightmost("HARD"),
      max: rightmost("EXPERT"),
      crown: texts.find((t) => t.s === "CROWN"),
    };
  };
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    {
      // mixed mask: CLEAR + MAX unlocked, PLUS + CROWN still locked
      const { c, texts, rects } = rec();
      md.drawScores(
        c,
        DEFAULT_SCORES,
        L,
        1,
        0,
        PLAQUE.CLEAR | PLAQUE.MAX,
      );
      const p = plateOf(rects);
      const { clear, plus, max, crown } = chipsOf(texts);
      const esc = texts.find((t) => t.s.indexOf("ESC BACK") >= 0);
      const ten = texts.find((t) => t.s === "10");
      check(
        `all four plaque labels (CLEAR/PLUS/MAX/CROWN) painted inside the plate at ${W}x${H}`,
        !!p &&
          !!clear &&
          !!plus &&
          !!max &&
          !!crown &&
          [clear, plus, max, crown].every(
            (t) => t.x > p.x && t.x < p.x + p.w && t.y > p.y + 8 && t.y < p.y + p.h - 4,
          ),
        JSON.stringify({ py: p && p.y, ph: p && p.h, clear, plus, max, crown }),
      );
      /* ATLAS: a locked plaque stays legible (muted label, full alpha, never
         faded); an earned one reads accent with a 0.14 accent fill. */
      const lit = rects.filter((r) => r.fill === "rgba(55,240,208,0.14)");
      check(
        `unlocked chips (CLEAR/MAX) read accent + filled, locked chips (PLUS/CROWN) muted but never faded at ${W}x${H}`,
        !!clear &&
          !!max &&
          !!plus &&
          !!crown &&
          clear.fill === "#37f0d0" && max.fill === "#37f0d0" &&
          plus.fill === "#7385ad" && crown.fill === "#7385ad" &&
          [clear, plus, max, crown].every((t) => t.alpha === 1) &&
          lit.length === 2 && lit.every((r) => Math.abs(r.x + r.w / 2 - clear.x) < 0.01 || Math.abs(r.x + r.w / 2 - max.x) < 0.01),
        JSON.stringify({ clear, plus, max, crown, lit }),
      );
      check(
        `plaque chips still leave the 10-row table + heat-tabs foot inside the plate at ${W}x${H}`,
        !!ten && !!esc && ten.y < esc.y && esc.y < p.y + p.h - 4 && ten.y > p.y + 8,
        JSON.stringify({ ten: ten && ten.y, esc: esc && esc.y, py: p && p.y, ph: p && p.h }),
      );
    }
    {
      // all locked (mask omitted / 0): every chip reads muted
      const { c, texts, rects } = rec();
      md.drawScores(c, DEFAULT_SCORES, L, 1, 0);
      const { clear, plus, max, crown } = chipsOf(texts);
      const chips = [clear, plus, max, crown];
      check(
        `no mask arg -> all four chips locked: muted, full alpha, no accent fill at ${W}x${H}`,
        chips.every((t) => !!t && t.fill === "#7385ad" && t.alpha === 1) &&
          !rects.some((r) => r.fill === "rgba(55,240,208,0.14)"),
        JSON.stringify(chips),
      );
    }
    {
      // all unlocked (mask 15): every chip reads bright/full-alpha
      const { c, texts } = rec();
      md.drawScores(c, DEFAULT_SCORES, L, 1, 0, 15);
      const { clear, plus, max, crown } = chipsOf(texts);
      const chips = [clear, plus, max, crown];
      check(
        `mask 15 -> all four chips unlocked/full-alpha at ${W}x${H}`,
        chips.every((t) => !!t && t.alpha === 1),
        JSON.stringify(chips),
      );
    }
    {
      const { c, texts } = rec();
      md.drawScores(c, DEFAULT_SCORES, L, 1, 0, 15);
      const plusTab = texts.find((t) => t.s === "HARD");
      const clear = texts.find((t) => t.s === "CLEAR");
      /* ATLAS: one chip row under the heat tabs in every box (scoresGeom.chipY);
         a short box scales the page (f) instead of folding the plaques onto the
         tab row. */
      const g = md.scoresGeom(L), rank = texts.find((t) => t.s === "RANK");
      check(
        `${W}x${H} plaques sit on their own row (scoresGeom.chipY) between the heat tabs and the table`,
        !!plusTab && !!clear && !!rank && Math.abs(clear.y - (g.chipY + (g.f < 1 ? 7 : 10))) < 0.01 && // iso: the chip shrinks to 12 so it ends above bodyTop
          clear.y > plusTab.y + 8 && clear.y < rank.y && g.chipY >= g.tabs[0].y + g.tabs[0].h,
        JSON.stringify({ plusY: plusTab && plusTab.y, clearY: clear && clear.y, rankY: rank && rank.y, chipY: g.chipY }),
      );
    }
  }
}

// 14) drawAttractHint: attract now plays on tap, so the copy says so
{
  const md = await import("../src/render/menudraw.js");
  const texts = [];
  const c = {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "middle",
    fillRect() {},
    strokeRect() {},
    fillText(s) {
      texts.push(String(s));
    },
  };
  const L = md.layout(600, 520);
  md.drawAttractHint(c, L, 0);
  check(
    "attract hint says TAP TO PLAY",
    texts.some((t) => t.includes("TAP TO PLAY")),
    texts.join("|"),
  );
}

// 15) wiring check: scoreHeat reaches drawScores through shellview + main's
//     getScores getter, and the plaques mask now rides the same shell-router
//     path via a getPlaques getter (untested by any direct call — this only
//     exercises the drawScores/menudraw side, not the browser entry point)
{
  const shellSrc = readFileSync("src/render/shellview.js", "utf8");
  check(
    "shellview passes app.scoreHeat into the (memoised) getter and into drawScores",
    /getScores\(app\.scoreHeat\)/.test(shellSrc) && /getPlaques \? getPlaques\(\)/.test(shellSrc) &&
      /drawScores\(\s*c,\s*sd\.s,\s*L,\s*app\.subT,\s*app\.scoreHeat,\s*sd\.p,\s*touchLay\(canvas\),\s*app\.recFocus === 0\)/.test(shellSrc),
    shellSrc.match(/menudraw\.drawScores\([^;]*\);/s)?.[0],
  );
  const mainSrc = readFileSync("src/main.js", "utf8");
  check(
    "main.js wires scoresForHeat and loadPlaques into the getters passed to drawShell",
    /scoresForHeat/.test(mainSrc) &&
      /\(heat\)\s*=>\s*scoresForHeat\(loadScores\(\),\s*heat\)/.test(mainSrc) &&
      /\(\)\s*=>\s*loadPlaques\(\)/.test(mainSrc),
    mainSrc.match(/drawShell\([^;]*\);/s)?.[0],
  );
  check(
    "main.js only calls unlockPlaques on the finale-WIN persist edge (never inside step()/attract, never from a LOSE)",
    /if\s*\(world\.finale\s*&&\s*world\.state\s*===\s*"MENU"\)\s*\{[^}]*savePlaques\(unlockPlaques\(loadPlaques\(\),\s*world\)\)/s.test(
      mainSrc,
    ) &&
      (mainSrc.match(/unlockPlaques\(/g) || []).length === 1,
    (mainSrc.match(/if\s*\(world\.finale[^\n]*\n(?:.*\n){0,8}/)||[])[0],
  );
  const attractSrc = readFileSync("src/app/attract.js", "utf8");
  check(
    "attract.js never references the plaques unlock (ATTRACT can't reach the finale-WIN edge)",
    !/unlockPlaques|savePlaques|plaques\.js/.test(attractSrc),
  );
  check(
    "shellview derives the build kicker from CACHE_NAME and passes it as rev",
    /import\s*\{\s*CACHE_NAME\s*\}\s*from\s*"\.\.\/pwa\/shell\.js"/.test(shellSrc) &&
      /CACHE_NAME\.replace\("fusegrid-shell-",\s*""\)/.test(shellSrc) &&
      /rev:\s*REV/.test(shellSrc),
    shellSrc.match(/const REV[^\n]*/)?.[0],
  );
  check(
    "shellview routes SCREEN.SETTINGS to drawSettings with the visible rows (app.optRows()), the focused label (app.optLabel()) + app.settings",
    /SCREEN\.SETTINGS/.test(shellSrc) &&
      /rows:\s*app\.optRows\(\)/.test(shellSrc) &&
      /row:\s*app\.optLabel\(\)/.test(shellSrc) &&
      !/row:\s*app\.optRow\b/.test(shellSrc) &&
      /vals:\s*app\.settings/.test(shellSrc),
    shellSrc.match(/menudraw\.drawSettings\([^;]*\);/s)?.[0],
  );
  check(
    "main.js persists every settings change and re-applies it live",
    /onSettings:/.test(mainSrc) &&
      /saveSettings\(/.test(mainSrc) &&
      /applySettings\(/.test(mainSrc),
    mainSrc.match(/onSettings:[^\n]*\n(?:.*\n){0,3}/)?.[0],
  );
}

// ---- opening (2026-10-09 §7/§11): title prompt per data-lay, skip hint only
// past the guard, all four strings fit, opaque veil while the board loads ----
{
  const md = await import("../src/render/menudraw.js");
  const intro = await import("../src/app/intro.js");
  check("menudraw's SHOW_STEP / SKIP_GUARD / TITLE_IN copies equal src/app/intro.js",
    md.SHOW_STEP === intro.SHOW_STEP && md.SKIP_GUARD === intro.SKIP_GUARD && md.TITLE_IN === intro.TITLE_IN);
  const rec = () => {
    const texts = [], fills = [];
    const c = new Proxy({}, {
      get: (t, p) => p === "fillText" ? (s, x, y) => texts.push({ s: String(s), x, y, a: t.globalAlpha, font: t.font })
        : p === "fillRect" ? () => fills.push(t.fillStyle)
        : p in t ? t[p] : () => {},
      set: (t, p, v) => { t[p] = v; return true; },
    });
    c.globalAlpha = 1;
    return { c, texts, fills };
  };
  for (const [W, H] of [[600, 520], [608, 352]]) {
    for (const lay of ["d", "p", "l"]) {
      const r = rec();
      md.drawIntroChrome(r.c, 0, 1.0, W, H, lay);
      const want = lay === "d" ? "PRESS ANY KEY OR BUTTON" : "TAP TO START";
      const got = r.texts.map((x) => x.s);
      check(`title ${W}x${H} lay ${lay}: paints ${want}, never PRESS ENTER, no skip hint`,
        got.includes(want) && !got.includes("PRESS ENTER") && !got.some((x) => /SKIP/.test(x)), got.join("|"));
    }
    const pre = rec();
    md.drawIntroChrome(pre.c, 1, 0.19, W, H, "d");
    const post = rec();
    md.drawIntroChrome(post.c, 1, 0.6, W, H, "p");
    check(`show ${W}x${H}: no skip hint inside SKIP_GUARD, TAP TO SKIP after it on touch`,
      !pre.texts.some((x) => /SKIP/.test(x.s)) && post.texts.some((x) => x.s === "TAP TO SKIP"),
      post.texts.map((x) => x.s).join("|"));
    const fits = [["PRESS ANY KEY OR BUTTON", 18], ["TAP TO START", 26], ["ANY KEY TO SKIP", 10], ["ANY BUTTON TO SKIP", 10], ["TAP TO SKIP", 18]]
      .every(([str, px]) => str.length * px * 0.6 <= W - 28);
    check(`every opening string fits W-28 at ${W}x${H} (0.6 em mono advance, touch copy at its phone size)`, fits);
    const px = (r, re) => { const x = r.texts.find((t) => re.test(t.s)); return x ? parseFloat(/(\d+)px/.exec(x.font)[1]) : 0; };
    const tp = rec(); md.drawIntroChrome(tp.c, 0, 1.0, W, H, "p");
    const ts = rec(); md.drawIntroChrome(ts.c, 1, 0.6, W, H, "l");
    const dk = rec(); md.drawIntroChrome(dk.c, 1, 0.6, W, H, "d");
    check(`touch copy is phone-sized at ${W}x${H}: TAP TO START 26 px, TAP TO SKIP 18 px; desktop keeps 18 / 10`,
      px(tp, /TAP TO START/) === 26 && px(ts, /TAP TO SKIP/) === 18 && px(rec0(), /PRESS ANY KEY/) === 18 && px(dk, /ANY KEY TO SKIP/) === 10);
    check(`prompt and skip hint each sit on a dark backing box (contrast over bright bricks) at ${W}x${H}`,
      tp.fills.filter((f) => f === "rgba(7,10,18,0.9)").length === 1 && ts.fills.filter((f) => f === "rgba(7,10,18,0.9)").length === 1,
      tp.fills.join("|") + " // " + ts.fills.join("|"));
    function rec0() { const r = rec(); md.drawIntroChrome(r.c, 0, 1.0, W, H, "d"); return r; }
    const nr = rec();
    md.drawIntroChrome(nr.c, 0, 3, W, H, "d", 0);
    const rd = rec();
    md.drawIntroChrome(rd.c, 0, 3, W, H, "d", 1);
    check(`title veil is opaque while the board is not ready, 0.45 once it is (${W}x${H})`,
      nr.fills[0] === "rgba(7,10,18,1)" && rd.fills[0] === "rgba(7,10,18,0.45)", nr.fills[0] + " / " + rd.fills[0]);
  }
  {
    /* MENU entry (v202 Task 3.1; the slam over the show's blast is gone: the room look covers the board from MENU's first frame): every entry,
       the show's end and a skip alike, paints the room opaque at once and fades the plate, logo and foot in over 0.25 s */
    const L = md.layout(600, 520), { ITEMS } = await import("../src/app/menuapp.js");
    const paint = (et) => { const r = textrec(); md.drawMenu(r.ctx, { rows: ITEMS, focus: "PLAY", level: 1, enterT: et }, L, 0); return r; };
    const first = paint(0), mid = paint(0.125), set = paint(1);
    const fill0 = first.paints[0], alpha = (r) => r.writes.filter((w) => w.k === "globalAlpha").map((w) => w.v);
    check("MENU entry: the first frame's first paint is the room, opaque over the whole box; the plate starts at alpha 0, is at 0.5 by 0.125 s and 1 from 0.25 s",
      !!fill0 && fill0.alpha === 1 && fill0.box && fill0.box.w >= 600 && fill0.box.h >= 520 && alpha(first)[0] === 0 && alpha(mid)[0] === 0.5 && alpha(set)[0] === 1,
      JSON.stringify({ fill0, a0: alpha(first), a1: alpha(mid) }));
  }
}

// iso 608x352 guard (polish 2026-10-19): every MEDALS / STATS tile text stays
// inside its tile (y ± px/2), the HIGH SCORES plaque chips end above bodyTop,
// and the 600x520 box keeps its exact text positions; NO TIME YET waits for
// TIME (MODES open) and never shows on the DAILY card.
{
  const md = await import("../src/render/menudraw.js");
  const rec = () => {
    const texts = [], cells = [], strokes = [];
    const c = new Proxy({ fillStyle: "", font: "", globalAlpha: 1, textAlign: "left", textBaseline: "middle", shadowBlur: 0, measureText: (s) => ({ width: String(s).length * 6 }) }, {
      get: (t, k) => k in t ? t[k] : k === "fillText" ? (s, x, y) => { const m = /(\d+)px/.exec(t.font); texts.push({ s: String(s), x, y, px: m ? +m[1] : 0 }); }
        : k === "fillRect" ? (x, y, w, h) => { if (/^rgba\(4,7,14/.test(t.fillStyle)) cells.push({ x, y, w, h }); }
        : k === "strokeRect" ? (x, y, w, h) => strokes.push({ x, y, w, h }) : () => {},
      set: (t, k, v) => ((t[k] = v), true),
    });
    return { c, texts, cells, strokes };
  };
  const body = (recd, L, p) => recd.cells.filter((r) => r.y >= md.recPlate(L, p, false).by - 0.5); // the tiles; RECORDS' tab strip (v202 Task 2.2) paints its unselected tabs in the same fill, in the head
  /* every cell the page paints is a tile or one of the strip's two unselected tabs (the shown tab is banded, not in this fill): nothing else in the head */
  const strip = (recd, L, p) => { const T = md.recTabsGeom(md.recPlate(L, p, false), false); return recd.cells.length === body(recd, L, p).length + 2 && recd.cells.filter((r) => !body(recd, L, p).includes(r)).every((r) => T.some((q, i) => i !== p && q.x === r.x && q.y === r.y && q.w === r.w && q.h === r.h)); };
  const inside = (r, recd) => recd.texts.filter((t) => t.x > r.x && t.x < r.x + r.w && t.y > r.y && t.y < r.y + r.h).every((t) => t.y - t.px / 2 >= r.y - 0.5 && t.y + t.px / 2 <= r.y + r.h + 0.5);
  const rows = Array.from({ length: 8 }, (_, i) => ["MEDAL " + i, "ROOMS 1-5 IN ONE RUN · NO LIFE LOST · ALL FOUR MODES", i < 2]);
  const stats = { rows: Array.from({ length: 10 }, (_, i) => ["DAYS PLAYED", "1234"]), notes: ["N1", "N2"], trophies: rows };
  const pos = {};
  for (const [W, H] of [[600, 520], [608, 352]]) {
    const L = md.layout(W, H), tg = `${W}x${H}`;
    const m = rec();
    md.drawTrophies(m.c, L, 1, rows);
    check(`MEDALS: name + both goal lines inside each tile at ${tg}`, body(m, L, 2).length === 8 && body(m, L, 2).every((r) => inside(r, m)) && strip(m, L, 2));
    const st = rec();
    md.drawStats(st.c, L, 1, stats, false, null);
    check(`STATS: value + label inside each of the 11 tiles at ${tg}`, body(st, L, 1).length === 11 && body(st, L, 1).every((r) => inside(r, st)) && strip(st, L, 1));
    const sc = rec(), g = md.scoresGeom(L, false);
    md.drawScores(sc.c, [], L, 1, 0, 0b11, false);
    const chips = sc.strokes.filter((r) => Math.abs(r.y - (g.chipY + 0.5)) < 1e-9);
    check(`SCORES: four plaque chips end above bodyTop at ${tg}`, chips.length === 4 && chips.every((r) => r.y + r.h + 0.5 <= g.bodyTop), chips.map((r) => r.y + r.h).join(",") + " vs " + g.bodyTop);
    pos[tg] = [m, st].map((r) => r.texts.map((t) => t.s + "@" + t.y + "/" + t.px).join("|"));
  }
  check("MEDALS / STATS text at 600x520 is the pre-guard layout (name at tile+15, goals +32/+44; value 18px at -6, label 10px at +12)",
    /MEDAL 0@\d+(\.\d+)?\/13/.test(pos["600x520"][0]) && (() => { const r = rec(); md.drawTrophies(r.c, md.layout(600, 520), 1, rows); const c0 = body(r, md.layout(600, 520), 2)[0], n = r.texts.find((t) => t.s === "MEDAL 0"), d = r.texts.filter((t) => t.x === n.x && t.y > n.y); return n.y === c0.y + 15 && d[0].y === c0.y + 32 && d[1].y === c0.y + 44; })()
      && (() => { const r = rec(); md.drawStats(r.c, md.layout(600, 520), 1, stats, false, null); const c0 = body(r, md.layout(600, 520), 1)[0], v = r.texts.find((t) => t.s === "1234"), l = r.texts.find((t) => t.s === "DAYS PLAYED"); return v.px === 18 && v.y === c0.y + c0.h / 2 - 6 && l.px === 10 && l.y === c0.y + c0.h / 2 + 12; })());
  const L = md.layout(600, 520), lv = (U, best) => { const r = rec(); md.drawLevelSelect(r.c, 2, L, 1, 0, 0, U, 0, false, false, { best: best ? [null, "0:38.9"] : [] }); return r.texts.map((t) => t.s); };
  check("LEVEL SELECT: no NO TIME YET before MODES / TIME open; it shows once open; a saved best shows either way",
    !lv(false).includes("NO TIME YET") && lv(true).includes("NO TIME YET") && lv(false, true).includes("✓ BEST 0:38.9") && lv(true, true).includes("✓ BEST 0:38.9"));
  /* MENU (v202 Task 3.1) prints no time at all: the run's BEST line belongs to the next-run card (Task 3.2), which takes LEVEL SELECT's rule above */
  const mn = (row) => { const r = rec(); md.drawMenu(r.c, { rows: ["PLAY", "LEVEL SELECT", "DAILY", "RECORDS", "SETTINGS", "GUIDE", "SOURCE"], focus: ["PLAY", "LEVEL SELECT", "DAILY"][row], level: 1, enterT: 1 }, L, 1); return r.texts.map((t) => t.s); };
  check("MENU: PLAY, LEVEL SELECT or DAILY focused, no time claim (NO TIME YET never shows; the card takes LEVEL SELECT's rule in Task 3.2)",
    [0, 1, 2].every((i) => mn(i).length > 10 && !mn(i).includes("NO TIME YET") && !mn(i).some((t) => /BEST \d+:\d/.test(t))));
}

// touch-portrait shell box (polish 2026-10-19, fit.js shellGeo): at the phone
// boxes every page fits its plate inside the box, the narrow re-flows keep
// every rect inside the plate, and each drawn rect's centre taps back to it
// through the same hit function main.js calls (a tap lands where it is drawn)
{
  const md = await import("../src/render/menudraw.js");
  const { shellGeo } = await import("../src/app/fit.js");
  const { geoFor, geomOf, hitPage } = await import("../src/render/controlsgeo.js");
  for (const [VW, VH] of [[393, 852], [360, 640], [430, 932]]) {
    const g = shellGeo(VW, VH, 600, 520), L = md.layout(g.w, g.h, g.logo), tg = `${VW}x${VH} box ${g.w}x${g.h}`;
    const inBox = (S) => S.x >= 0 && S.y >= 0 && S.x + S.w <= g.w && S.y + S.h <= g.h && S.f === 1;
    const inPlate = (r, S) => r.x >= S.x && r.y >= S.y && r.x + r.w <= S.x + S.w + 0.01 && r.y + r.h <= S.y + S.h + 0.01;
    const ctr = (r) => [r.x + r.w / 2, r.y + r.h / 2];
    check(`shell layout is tall + narrow, logo on the board line (${tg})`, L.tall && L.narrow && L.logoCy === g.logo);
    const hub = md.menuGeom(md.layout(g.w, g.h, g.logo, g.s), 7, true), HR = ["PLAY", "LEVEL SELECT", "DAILY", "RECORDS", "SETTINGS", "GUIDE", "SOURCE"].map((l) => hub.rows[l]);
    check(`MENU phone column (v202 Task 3.1): the logo heads the plate, the rows hang under it, inside the box, every row taps to itself (${tg})`,
      hub.mode === "phone" && hub.logo.y + hub.logo.h < HR[0].y && hub.plate.y >= 0 && hub.plate.y + hub.plate.h <= g.h &&
        HR.every((r, i) => md.menuHit(r.x + r.w / 2, r.y + r.h / 2, md.layout(g.w, g.h, g.logo, g.s), 7, true) === i), JSON.stringify(hub.plate));
    for (const U of [false, true]) for (const open of U ? [false, true] : [false]) {
      /* LEVEL SELECT (v202 Task 3.3): the phone column on the page's own box (the touch floors need the shell box's css) */
      const LP = md.layout(g.w, g.h, g.logo, g.s), G = md.levelGeom(LP, U, true, open), S = G.S, rects = [...G.room, G.pane, ...G.heat, ...G.pace, ...(U ? [G.mods, G.list] : []), ...G.mode, G.start, G.back, ...Object.values(G.rows).filter(Boolean)];
      check(`LEVEL SELECT phone${U ? " (modifiers offered)" : ""}${open ? ", the list open" : ""}: the phone column, its plate in the box, every rect in the plate (${tg})`, G.lay === "phone" && S.x >= 0 && S.y >= 0 && S.x + S.w <= g.w && S.y + S.h <= g.h && rects.every((r) => inPlate(r, { ...S, x: S.x - 1, w: S.w + 2 })));
      const hits = [...G.room.map((r, i) => [r, i < G.cap ? "room" : "lock", i]), ...G.heat.map((r, i) => [r, "heat", i]), ...G.pace.map((r, i) => [r, "pace", i]), ...G.mode.map((r, i) => [r, "mode", i]), ...(U ? [[G.mods, "mods"]] : []), [G.start, "start"], [G.back, "back"]];
      check(`LEVEL SELECT phone${U ? " (modifiers offered)" : ""}${open ? ", the list open" : ""}: every key / cell / entry / START / BACK taps to itself, the card inert, off-plate backs (${tg})`,
        hits.every(([r, k, i]) => { const h = md.levelHit(...ctr(r), LP, U, true, open); return h.k === k && (i == null || h.i === i); }) &&
          (open || md.levelHit(...ctr(G.pane), LP, U, true, open).k === "none") && md.levelHit(1, 1, LP, U, true, open).k === "back");
    }
    const sc = md.scoresGeom(L, true);
    check(`HIGH SCORES: tabs inside the plate, each taps to itself (${tg})`, inBox(sc.S) && sc.tabs.every((r, i) => inPlate(r, sc.S) && md.scoresHit(...ctr(r), L, true) === i));
    for (const [nm, geo, hit, n, R] of [["SETTINGS (ten)", md.settingsGeom, md.settingsHit, 10, optRows(false)], ["SETTINGS (twelve)", md.settingsGeom, md.settingsHit, 12, optRows(true)], ["GRAPHICS", md.graphicsGeom, md.graphicsHit, md.GFX_N, 0]]) {
      /* v202 Task 3.4: the phone column in CSS px (css: the box's scale, as shellview's dims hands it to the draw and the pointer), rows by name */
      const Lc = md.layout(g.w, g.h, g.logo, g.s), q = geo(Lc, true, R), Lf = (l) => ({ ...Lc, focus: q.order.indexOf(q.pages[q.pageOf[l]][0]) }); // its page on screen (paged: fix round 1)
      check(`${nm}: rows inside the box, each taps to itself (${tg})`, inBox({ ...q.plate, f: 1 }) && q.order.length === n && q.order.every((l, i) => inPlate(q.rows[l], q.plate) && hit(...ctr(q.rows[l]), Lf(l), R, true) === i));
    }
    /* rows 44 CSS px, 8 apart, on every phone (fix round 1, lead ruling): a phone too short for every row (640 tall) pages them, with the page keys
       >= 44 CSS px under them; the 852 / 932 phones hold all of them on one page */
    const pitch = (R) => {
      const q = md.settingsGeom(md.layout(g.w, g.h, g.logo, g.s), true, R), hs = q.order.map((l) => q.rows[l].h * g.s);
      const gaps = q.pages.flatMap((pr) => pr.slice(1).map((l, i) => (q.rows[l].y - q.rows[pr[i]].y - q.rows[pr[i]].h) * g.s));
      const keysOk = q.pages.length === 1 ? VH >= 800 : !!q.keys && q.keys.up.h * g.s >= 43.99 && q.keys.dn.w * g.s >= 43.99 && VH < 800;
      return q.mode === "phone" && hs.every((h) => Math.abs(h - 44) < 0.01) && gaps.every((v) => v >= 7.99) && keysOk ? true : hs.join() + " | " + q.pages.length;
    };
    check(`OPTIONS on the phone column: rows 44 CSS px 8 apart, paged on a 640-tall phone, ten or twelve rows (${tg})`, pitch(optRows(true)) === true && pitch(optRows(false)) === true, [pitch(optRows(true)), pitch(optRows(false))].join(" / "));
    const cg = geoFor(L, true, L.narrow, g.s);
    check(`CONTROLS: plate inside the box, every row inside it and tapping to itself, off the plate backs out (${tg})`,
      cg.x >= 0 && cg.y >= 0 && cg.x + cg.w <= g.w && cg.y + cg.h <= g.h &&
        Array.from({ length: 8 }, (_, i) => geomOf(i, cg)).every((r, i) => inPlate(r, cg) && hitPage({}, ...ctr(r), cg).row === i) &&
        hitPage({}, 1, 1, cg).off === 1);
    const gd = md.guideGeom(L, true);
    check(`GUIDE: doors inside the box, each taps to itself (${tg})`, inBox(gd.S) && gd.tiles.every((r, i) => md.guideHit(...ctr(r), L, 0, true) === i));
    const st = md.statsGeom(L).S;
    check(`STATS: centred in the tall box (not pinned to its floor), foot T taps KeyT (${tg})`,
      inBox(st) && st.y + st.h < g.h - 20 && md.statsHit(st.mid - 47 * 3 + 24, st.footY, L, false) === "KeyT");
  }
}

// issue #6: KICK is walk-into (POWER[].help); no page may say K + MOVE.
// HOW TO is one draw in every look (PIXEL swaps only the glyph).
{
  const md = await import("../src/render/menudraw.js");
  const { POWER } = await import("../src/core/entities.js");
  const { shellGeo } = await import("../src/app/fit.js");
  const rec = () => { const r = textrec(); return { texts: r.texts, c: r.ctx }; };
  const K = /\bK\s*\+\s*MOVE\b/i;
  check("KICK's own help says walk-into", POWER.find((p) => p.t === "kick").help === "walk into a bomb to slide it");
  const g = shellGeo(393, 852, 600, 520);
  for (const [tg, L] of [["600x520", md.layout(600, 520)], ["608x352", md.layout(608, 352)], ["narrow " + g.w + "x" + g.h, md.layout(g.w, g.h, g.logo)]]) {
    for (const touch of [false, true]) {
      const h = rec();
      md.drawHowTo(h.c, L, 1, "2d", touch);
      const walk = h.texts.find((t) => t.s === "WALK INTO BOMB"), pk = h.texts.find((t) => t.s === "P");
      check(`HOW TO says WALK INTO BOMB beside KICK *, never K + MOVE, and the key fits its cell (${tg}${touch ? " touch" : ""})`,
        !!walk && !!pk && h.texts.some((t) => t.s === "KICK *") && !h.texts.some((t) => K.test(t.s)) && walk.x + walk.w < pk.x - 8,
        walk && pk && walk.x + walk.w + " < " + pk.x);
      for (const r3d of [false, true]) {
        const o = rec();
        md.drawSettings(o.c, L, 1, { rows: optRows(r3d), row: "RESET DEFAULTS", touch, rev: "v0" }); // RESET DEFAULTS focused: its page on screen where the rows page
        const line = o.texts.find((t) => t.s.indexOf("MOVE WASD") === 0);
        check(`OPTIONS never says K+MOVE and prints no fixed key line (${tg}${touch ? " touch" : ""}, ${optRows(r3d).length} rows drawn)`,
          !o.texts.some((t) => K.test(t.s)) && !line && o.texts.some((t) => t.s === "RESET DEFAULTS"), line && line.s);
      }
    }
  }
}

// FLOOR page + the fourth GUIDE door: every tile named once, only the four tiles with rules claim a rule, the doors tile the plate without overlap, taps hit them
{
  const md = await import("../src/render/menudraw.js"), { shellGeo } = await import("../src/app/fit.js"), { TILE_HELP } = await import("../src/core/feat.js");
  const rec = () => {
    const texts = [], o = {
      font: "10px x", textAlign: "left",
      fillText(s, x, y) { texts.push({ s: String(s), x, y, w: o.measureText(s).width, align: o.textAlign }); },
      measureText(s) { const m = /(\d+(?:\.\d+)?)px/.exec(o.font); return { width: String(s).length * 0.6 * (m ? +m[1] : 10) }; },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    };
    return { texts, c: new Proxy(o, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }) };
  };
  const g = shellGeo(393, 852, 600, 520), NAMES = ["BOOSTER", "ICE PATCH", "CONVEYOR", "STREAM", "TRAP", "QUICKSAND", "PORTAL", "GATE"];
  for (const [tg, L] of [["600x520", md.layout(600, 520)], ["608x352", md.layout(608, 352)], ["narrow", md.layout(g.w, g.h, g.logo)]]) {
    for (const touch of [false, true]) {
      const h = rec();
      md.drawFloorHelp(h.c, L, 1.25, "2d", touch);
      const ts = h.texts.map((t) => t.s), tag = `${tg}${touch ? " touch" : ""}`;
      check(`FLOOR names all eight tiles once (${tag})`, NAMES.every((n) => ts.filter((x) => x === n).length === 1), ts.length);
      check(`FLOOR claims a rule only for the ${Object.keys(TILE_HELP).length} tiles that have one (${tag})`,
        ts.filter((x) => /^NORMAL · /.test(x)).length === Object.keys(TILE_HELP).length && ts.filter((x) => /^LOOK ONLY/.test(x)).length === NAMES.length - Object.keys(TILE_HELP).length);
      for (const [k, help] of Object.entries(TILE_HELP)) check(`FLOOR draws ${k}'s NORMAL and EXPERT help whole, never clipped (${tag})`, ts.includes("NORMAL · " + help[0]) && ts.includes("EXPERT · " + help[2]), ts.filter((x) => /^(NORMAL|EXPERT) · /.test(x)).join(" | "));
      const gd = md.guideGeom(L, touch), T = gd.tiles;
      const inside =T.every((r) => r.x >= gd.S.x && r.x + r.w <= gd.S.x + gd.S.w && r.y >= gd.S.y && r.y + r.h <= gd.S.y + gd.S.h);
      const apart = T.every((a, i) => T.every((b, j) => i >= j || a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y));
      check(`GUIDE has four doors inside the plate that never overlap (${tag})`, T.length === 4 && inside && apart);
      check(`GUIDE taps hit each door, off it backs out (${tag})`, T.every((r, i) => md.guideHit(r.x + r.w / 2, r.y + r.h / 2, L, 8, touch) === i) && md.guideHit(1, 1, L, 8, touch) === -1);
      const d = rec();
      md.drawGuide(d.c, L, 1.25, 3, "2d", touch);
      if (!touch && !L.narrow) {
        const left = d.texts.filter((t) => t.align !== "right" && t.align !== "center" && t.s !== "›");
        check(`GUIDE keyboard door words stop before the preview strip (${tag})`, T.every((r) => left.filter((t) => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y <= r.y + r.h).every((t) => t.x + t.w <= r.x + r.w - 118 - 4)));
      }
      check(`GUIDE draws the FLOOR door and its label (${tag})`, d.texts.some((t) => t.s === "FLOOR") && d.texts.some((t) => /^8/.test(t.s)));
    }
  }
}

// CONTROLS (T9): shellview's routes, the real box scale, the door, the consent note, the MENU pane.
{
  const md = await import("../src/render/menudraw.js");
  const { SCREEN, OPT_ROWS, ITEMS, createMenuApp } = await import("../src/app/menuapp.js");
  const { drawShell, isShellScreen, controlsGeo, controlsHit, loadControlsArt } = await import("../src/render/shellview.js");
  await loadControlsArt(); // the CONTROLS paint is lazy (v202)
  const { createControlsPage } = await import("../src/app/controlspage.js");
  const { DEF_CONTROLS } = await import("../src/app/controls.js");
  const { geoFor, geomOf } = await import("../src/render/controlsgeo.js");
  const { shellGeo } = await import("../src/app/fit.js");
  const rec = () => {
    const texts = [];
    const o = {
      font: "10px x", textAlign: "left", globalAlpha: 1,
      fillText(s, x, y) { texts.push({ s: String(s), x, y, w: o.measureText(s).width, align: o.textAlign }); },
      measureText(s) { const m = /(\d+(?:\.\d+)?)px/.exec(o.font); return { width: String(s).length * 0.6 * (m ? +m[1] : 10) }; },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    };
    return { texts, c: new Proxy(o, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }) };
  };
  const boxOf = (w, h, cssW, lay, logo) => ({ width: w, height: h, logo, ownerDocument: { body: { getAttribute: () => lay } }, getBoundingClientRect: () => ({ width: cssW }) });
  const mk = (state = "ready", o = {}, rumble = true) => {
    const a = createMenuApp({ settings: {}, controls: createControlsPage({ get: () => DEF_CONTROLS, set() {}, padView: () => ({ state, name: "CONTROLLER 1 · STANDARD", rumble }), say() {} }), ...o });
    return a;
  };
  const draw = (a, world, canvas) => { const R = rec(); drawShell(R.c, a, world, canvas || null, "2d", () => [], () => 0); return R; };
  const has = (R, s) => R.texts.some((t) => t.s === s);
  const PLAY = { state: "PLAY", time: 0 }, PAUSE = { state: "PAUSE", time: 0, level: 3 };

  check("isShellScreen(SCREEN.CONTROLS), PAUSE stays on the board canvas", isShellScreen(SCREEN.CONTROLS) && !isShellScreen(SCREEN.GAME));
  {
    const a = mk();
    a.screen = SCREEN.CONTROLS;
    const R = draw(a, PLAY);
    check("shellview routes SCREEN.CONTROLS to drawControls, never drawSettings", has(R, "CONTROLS") && has(R, "CONTROLLER") && has(R, "BOMB") && !has(R, "MUSIC") && !has(R, "RESET DEFAULTS"), R.texts.map((t) => t.s).join("|"));
    a.screen = SCREEN.GAME; a.pauseView = 3;
    const P = draw(a, PAUSE);
    check("shellview routes pauseView 3 to drawControls against overlayBox, never drawSettings", has(P, "CONTROLS") && has(P, "BOMB") && !has(P, "MUSIC") && !has(P, "RESET DEFAULTS") && !has(P, "OPTIONS"));
    const G = geoFor(md.layout(600, 520), false, false);
    check("PAUSE CONTROLS paints on overlayBox's geometry", P.texts.some((t) => t.s === "CONTROLS" && t.y === G.S.headY + 8));
    {
      const strip = (cv) => { const rs = []; const R = rec(); const c = new Proxy(R.c, { get: (t, p) => (p === "fillRect" ? (x, y, w, h) => rs.push({ x, y, w, h, fill: t.fillStyle }) : t[p]), set: (t, p, v) => ((t[p] = v), true) }); drawShell(c, a, PAUSE, cv, "2d", () => [], () => 0); return rs.find((q) => q.x === 4 && q.y === 10 && q.w === 592 && q.h === 30); };
      const q = strip(boxOf(600, 520, 378, "p"));
      check("PAUSE CONTROLS on a phone: the plate reaches the HUD strip, so the strip is covered whole, opaque, no heart sliver at its edge", !!q && /^#/.test(q.fill), q && q.fill);
      check("and in landscape", !!strip(boxOf(600, 520, 435, "l")));
      check("PAUSE CONTROLS on a keyboard clears the strip: nothing covered", !strip(null) && !strip(boxOf(600, 520, 600, "d")));
    }
    a.pauseView = 1;
    check("pauseView 1 still draws OPTIONS", has(draw(a, PAUSE), "MUSIC"));
    a.pauseView = 3; PLAY.state = "PLAY";
    check("pauseView 3 outside PAUSE draws no page", !has(draw(a, PLAY), "CONTROLS"));
  }
  {
    const a = createMenuApp({ settings: {} });
    a.screen = SCREEN.GAME; a.pauseView = 3;
    let threw = null, R = null;
    try { R = draw(a, PAUSE); } catch (e) { threw = e; }
    check("no page: view 3 draws nothing and never falls through to OPTIONS", !threw && !has(R, "MUSIC"), String(threw));
    a.screen = SCREEN.CONTROLS; threw = null;
    try { R = draw(a, PLAY); } catch (e) { threw = e; }
    check("no page: SCREEN.CONTROLS draws no plate and does not throw", !threw && !has(R, "BOMB"), String(threw));
  }
  // PAUSE CONTROLS: a whole-canvas veil under the plate, so the HUD reads as behind it. View 3 only.
  {
    const veilOf = (a, world) => {
      const log = [], o = {
        font: "10px x", textAlign: "left", globalAlpha: 1, fillStyle: "",
        fillRect(x, y, w, h) { log.push({ k: "rect", x, y, w, h, fill: o.fillStyle, alpha: o.globalAlpha }); },
        fillText(s) { log.push({ k: "text", s: String(s) }); },
        measureText(s) { return { width: String(s).length * 6 }; },
        createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
      };
      drawShell(new Proxy(o, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }), a, world, null, "2d", () => [], () => 0);
      return { log, full: log.findIndex((e) => e.k === "rect" && /,0\.72\)$/.test(e.fill) && e.x === 0 && e.y === 0 && e.w === 600 && e.h === 520), first: log.findIndex((e) => e.k === "text") };
    };
    const a = mk();
    a.screen = SCREEN.GAME; a.pauseView = 3;
    const V = veilOf(a, PAUSE);
    check("view 3 paints a whole-canvas veil before the page", V.full === 0 && V.first > 0, V.full + "/" + V.first);
    for (const v of [0, 1, 2]) { a.pauseView = v; check("view " + v + " paints no veil", veilOf(a, PAUSE).full === -1, v); }
    a.pauseView = 3;
    check("view 3 outside PAUSE paints no veil", veilOf(a, PLAY).full === -1);
    const n = createMenuApp({ settings: {} }); n.screen = SCREEN.GAME; n.pauseView = 3;
    check("no page: no veil", veilOf(n, PAUSE).full === -1);
  }
  // The real box scale reaches the floor: #sh at 0.9 keeps pitch 52 (46.8 CSS), the 0.63 default would ask for 70
  {
    const g = shellGeo(393, 852, 600, 520), box = boxOf(g.w, g.h, g.w * g.s, "p", g.logo), L = md.layout(g.w, g.h, g.logo), a = mk();
    const G = geoFor(L, true, L.narrow, g.s), row = geomOf(7, G);
    a.screen = SCREEN.CONTROLS;
    a.controls.open("key");
    const R = draw(a, PLAY, box), reset = R.texts.find((t) => t.s === "RESET KEYS");
    check("#sh: the real box scale keeps the shared pitch 52, not the default's 70", G.list.rows[0].h === 52 && geoFor(L, true, L.narrow).list.rows[0].h === 70 && 52 * g.s >= 44);
    check("#sh: paint uses that geometry", !!reset && Math.abs(reset.y - (row.y + row.h / 2)) < 0.01, reset && reset.y);
    const H = controlsGeo(box, "2d", false);
    check("controlsGeo is the paint's geometry on #sh", geomOf(7, H).h === row.h && geomOf(7, H).y === row.y && H.narrow === true);
    check("controlsHit: every painted row taps to itself on #sh", Array.from({ length: 8 }, (_, i) => geomOf(i, G)).every((r, i) => controlsHit(a.controls.view(0), r.x + r.w / 2, r.y + r.h / 2, box, "2d", false).row === i));
    check("controlsHit: off the plate backs out on #sh", controlsHit(a.controls.view(0), 1, 1, box, "2d", false).off === 1);
  }
  {
    const c0 = boxOf(600, 520, 378, "p"), L = md.layout(600, 520), a = mk();
    const G = geoFor(L, true, false, 0.63), row = geomOf(7, G);
    a.screen = SCREEN.GAME; a.pauseView = 3;
    a.controls.open("key");
    const reset = draw(a, PAUSE, c0).texts.find((t) => t.s === "RESET KEYS");
    check("PAUSE #c at 0.63: paint uses the real scale, inside the touch band", !!reset && Math.abs(reset.y - (row.y + row.h / 2)) < 0.01 && G.y >= 8 && G.y + G.h <= 512 && G.tabs[0].h * 0.63 >= 44);
    check("PAUSE #c: controlsHit taps its own rows", Array.from({ length: 8 }, (_, i) => geomOf(i, G)).every((r, i) => controlsHit(a.controls.view(0), r.x + r.w / 2, r.y + r.h / 2, c0, "2d", true).row === i));
    const k = boxOf(600, 520, 900, "d"), K = controlsGeo(k, "2d", true);
    check("a keyboard layout keeps pitch 26 at any scale", K.list.rows[0].h === 26 && K.x === 20);
    for (const [tg, bad] of [["no rect", { width: 600, height: 520, ownerDocument: c0.ownerDocument }], ["a 0 wide rect", boxOf(600, 520, 0, "p")], ["a 0 wide canvas", boxOf(0, 520, 300, "p")]])
      check(`${tg} falls back to the 0.63 worst case`, controlsGeo(bad, "2d", true).tabs[0].h === 70, controlsGeo(bad, "2d", true).tabs[0].h);
  }
  // The door follows the device; a touch layout reads CONTROLLER
  {
    const a = mk("ready", {}, false), door = (R) => { const r = R.texts.find((t) => t.s === "KEYBOARD" || t.s === "CONTROLLER"); return r && r.s; }; // v202 Task 3.4: the door's › is its chevron glyph
    a.screen = SCREEN.SETTINGS;
    check("door reads KEYBOARD on keys", door(draw(a, PLAY)) === "KEYBOARD");
    a.lastDev = "pad";
    check("door reads CONTROLLER on a pad", door(draw(a, PLAY)) === "CONTROLLER");
    a.lastDev = "key";
    const ctlRow = (q) => { q.optRow = q.optRows().indexOf("CONTROLS"); return q; }; // a touch 600x520 column pages its rows (fix round 1): the CONTROLS row's page on screen
    check("door reads CONTROLLER on a touch layout", door(draw(ctlRow(a), PLAY, boxOf(600, 520, 378, "p"))) === "CONTROLLER");
    a.screen = SCREEN.GAME; a.pauseView = 1; a.lastDev = "pad";
    check("PAUSE OPTIONS carries the same door", door(draw(a, PAUSE)) === "CONTROLLER");
    const v = mk(), vd = (R) => R.texts.some((t) => t.s === "VIBRATION MEDIUM");
    v.screen = SCREEN.SETTINGS;
    check("a pad with an actuator: the door reads the level, on keys and on a pad", vd(draw(v, PLAY)) && (v.lastDev = "pad", vd(draw(v, PLAY))) && !has(draw(v, PLAY), "CONTROLLER"));
    check("and on a touch layout", vd(draw(ctlRow(v), PLAY, boxOf(600, 520, 378, "p"))));
    v.screen = SCREEN.GAME; v.pauseView = 1;
    check("and in PAUSE OPTIONS", vd(draw(v, PAUSE)));
    const gone = mk("lost"); gone.screen = SCREEN.SETTINGS;
    check("a lost pad keeps today's door", !vd(draw(gone, PLAY)) && door(draw(gone, PLAY)) === "KEYBOARD");
  }
  // Q11: the ANALYTICS row says why it did nothing, whole, on its own row
  {
    const a = mk("ready", { anaOpen: () => true }), NOTE = "ANSWER THE CARD WITH Y OR N";
    a.screen = SCREEN.SETTINGS; a.lastDev = "pad"; a.optRow = a.optRows().indexOf("ANALYTICS");
    check("no note before the press", !has(draw(a, PLAY), NOTE));
    a.optCycle();
    check("app holds the note after a pad press", a.anaNote === NOTE);
    const row = (R, s) => R.texts.find((t) => t.s === s);
    const shG = shellGeo(360, 640, 600, 520);
    /* v202 Task 3.4 (pages/settings.js): the note replaces the rocker beside its label where it fits (600x520: the single column), else it takes the
       row's second line under its label (the phone column); whole either way, on the ANALYTICS row's band. The shell box's layout carries its css. */
    for (const [tg, cv, Lx, two] of [["600x520", null, md.layout(600, 520), false], ["400-wide shell", boxOf(shG.w, shG.h, shG.w * shG.s, "p", shG.logo), md.layout(shG.w, shG.h, shG.logo, shG.s), true]]) {
      const R = draw(a, PLAY, cv), n = row(R, NOTE), lab = row(R, "ANALYTICS"), g = md.settingsGeom(Lx, !!cv, a.optRows()), rr = g.d.rows.ANALYTICS;
      check(`the note is the ANALYTICS row's value, unclipped, clear of its label (${tg})`, !!n && !!lab && n.y > rr.y && n.y < rr.y + rr.h && lab.y > rr.y && lab.y < rr.y + rr.h &&
        (two ? n.y > lab.y && n.x === lab.x : n.y === lab.y && n.x > lab.x + lab.w), n && [n.x, n.w, lab.x, lab.w].join());
    }
    a.screen = SCREEN.GAME; a.pauseView = 1;
    check("PAUSE OPTIONS shows it too", has(draw(a, PAUSE), NOTE));
    a.pauseView = 0; a.screen = SCREEN.SETTINGS;
    const b = mk("ready", { anaOpen: () => false });
    b.screen = SCREEN.SETTINGS;
    check("an answered card shows ON/OFF, no note", !has(draw(b, PLAY), NOTE) && has(draw(b, PLAY), "OFF"));
  }
  // MENU's SETTINGS row (v202 Task 3.1: the preview pane is gone; the rows it counted live on the SETTINGS page, Task 2.4): its teaser is the art
  // style the visible rows follow, whatever the controller's state; the controller's arrival is the foot's signpost while the note lives
  {
    const tease = (state, look) => {
      const a = state ? mk(state) : createMenuApp({ settings: {} });
      if (look) a._optRender(look);
      a.screen = SCREEN.MENU; a.cursor = ITEMS.indexOf("SETTINGS");
      return draw(a, PLAY).texts;
    };
    check("SETTINGS row: outside REAL 3D its teaser is CLASSIC 2D (the ten-row look), never a row count or CAMERA · BRIGHTNESS", tease("ready").some((t) => t.s === "CLASSIC 2D") && !tease("ready").some((t) => /ROWS$|CAMERA/.test(t.s)));
    check("SETTINGS row in REAL 3D: its teaser is REAL 3D (CAMERA and BRIGHTNESS are on the page it opens)", tease("ready", 2).some((t) => t.s === "REAL 3D"));
    {
      const R = rec();
      md.drawMenu(R.c, { rows: ITEMS, focus: "SETTINGS", rev: "v", level: 1, look: 2, pad: "CONTROLLER READY", enterT: 9 }, md.layout(608, 352), 9);
      check("iso 608x352: the controller's signpost fits the foot whole, and the SETTINGS teaser stays", R.texts.some((t) => t.s === "CONTROLLER READY · SETTINGS › CONTROLS") && R.texts.some((t) => t.s === "REAL 3D") && !R.texts.some((t) => /…/.test(t.s)));
    }
    {
      /* The signpost owns the foot only while the note lives; the build tag stays at the foot's end. */
      const a = mk("ready");
      a.screen = SCREEN.MENU; a.cursor = ITEMS.indexOf("SETTINGS"); a.padNote = "CONTROLLER READY · VIBRATION MEDIUM";
      const S = draw(a, PLAY).texts;
      check("MENU foot: CONTROLLER READY signposts SETTINGS › CONTROLS with the vibration level, the build tag after it", S.some((t) => /^CONTROLLER READY · VIBRATION MEDIUM · SETTINGS › CONTROLS$/.test(t.s)) && S.some((t) => /^v\d+$/.test(t.s)) && S.some((t) => t.s === "CLASSIC 2D"));
      a.padNote = "CONTROLLER LOST";
      check("MENU foot: CONTROLLER LOST is no signpost", !draw(a, PLAY).texts.some((t) => t.s.includes("SETTINGS › CONTROLS")));
    }
    for (const st of ["nonstd", "none", "lost", null]) check(`SETTINGS row: a ${st} controller leaves the teaser on the art style`, tease(st).some((t) => t.s === "CLASSIC 2D"));
  }
}

console.log("\n  MENUDRAW RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
