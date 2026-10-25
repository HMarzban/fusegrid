import { initFx } from "../src/render/fx.js";
import { readFileSync } from "node:fs";
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
  const { heatToken } = await import("../src/core/heat.js");
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
      md.drawMenu(
        stub,
        {
          cursor: 2,
          enterT: 0.5,
          // real shipped rows: shellview.js's own MENU items array
          // (PLAY/LEVEL SELECT carry a heatToken suffix, the rest don't).
          items: [
            ITEMS[0] + "|" + heatToken(0),
            ITEMS[1] + "|" + heatToken(0),
            ITEMS[2],
            ITEMS[3],
            ITEMS[4],
            ITEMS[5],
            ITEMS[6],
            ITEMS[7],
          ],
        },
        L,
        0.5,
      );
      md.drawLevelSelect(stub, 3, L, 0.4, 1);
      md.drawHowTo(stub, L, 0.4);
      md.drawItemsHelp(stub, L, 0.4);
      md.drawEnemiesHelp(stub, L, 0.4);
      md.drawGuide(stub, L, 0.4, 0);
      md.drawScores(stub, DEFAULT_SCORES, L, 0.4);
      const sv = { mus: 100, sfx: 100, snd: 1, r3d: 0, cam: 0, bri: 100, shk: 1, flx: 0 };
      md.drawSettings(stub, L, 0.4, { row: 0, vals: sv, r3d: false, togT: -1, rev: "v0" });
      md.drawSettings(stub, L, 0.4, { row: 8, vals: sv, r3d: true, togT: 0.3, rev: "v0" });
      md.drawSettings(stub, L, 0.4, {});
      md.drawTrophies(stub, L, 0.4, undefined);
      md.drawTrophies(stub, L, 0.4, [["A", "B", true]]);
      md.drawDim(stub, 0.62, W, H);
      md.drawFade(stub, 0.5, W, H);
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
  {
    const { stub, sets } = mk();
    md.drawSettings(stub, L, 1.0, { row: 0, vals, r3d: true, togT: 0.97, rev: "v0" });
    check(
      "toggle-flash: mid-window glow on the changed row",
      sets.some((v) => v > 0 && v <= 14) && !sets.some((v) => v < 0),
      JSON.stringify(sets),
    );
  }
  {
    const { stub, sets } = mk();
    md.drawSettings(stub, L, 1.0, { row: 0, vals, r3d: true, togT: -1, rev: "v0" });
    check("toggle-flash: idle sentinel (-1) never glows", sets.length === 0, JSON.stringify(sets));
  }
  {
    const { stub, sets } = mk();
    md.drawSettings(stub, L, 1.0, { row: 0, vals, r3d: true, togT: 0.85, rev: "v0" });
    check("toggle-flash: window closed after 120ms", sets.length === 0, JSON.stringify(sets));
  }
  {
    const { stub, sets } = mk();
    md.drawMenu(
      stub,
      { cursor: 2, enterT: 1.0, togT: 0.97, items: ["PLAY|CORE", "LEVEL SELECT|CORE", "OPTIONS"] },
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
      const { c, texts, rects } = rec();
      md.drawMenu(
        c,
        {
          cursor: 0,
          enterT: 1,
          items: [
            "PLAY|CORE",
            "LEVEL SELECT|CORE",
            "DAILY",
            "OPTIONS",
            "GUIDE",
            "HIGH SCORES",
            "STATS",
            "SOURCE",
          ],
        },
        L,
        1,
      );
      const p = plateOf(rects);
      const start = texts.find((t) => t.s === "PLAY");
      const src = texts.find((t) => t.s === "SOURCE");
      const move = texts.find((t) => t.s.indexOf("MOVE") >= 0);
      check(
        `menu plate+rows inset at ${W}x${H}`,
        !!p &&
          !!start &&
          !!src &&
          !!move &&
          start.y > p.y + 8 &&
          src.y < p.y + p.h - 8 &&
          move.y > p.y + p.h,
        JSON.stringify({ p, start, src, move }),
      );
    }
    {
      const { c, texts } = rec();
      md.drawLevelSelect(c, 3, L, 1, 1);
      check(
        `level select heat chips at ${W}x${H}`,
        ["CORE", "PLUS", "MAX"].every((n) =>
          texts.some((t) => t.s.indexOf(n) >= 0),
        ) && texts.some((t) => t.s.indexOf("HEAT") >= 0),
        texts.map((t) => t.s).join("|"),
      );
    }
    {
      /* LOCKED (no first CLEAR): no MODES cap, no mode chip, no help line and
         no mode rects in the shared geometry. The room card's own "NO TIME
         YET" best-time line is not the rail. */
      const { c, texts } = rec();
      md.drawLevelSelect(c, 3, L, 1, 1);
      const all = texts.map((t) => t.s);
      const G = md.levelGeom(L, false);
      check(
        `level select LOCKED draws no MODES rail at ${W}x${H}`,
        !all.includes("MODES") && !all.includes("1–5") &&
          !all.some((s) => /^\d (IRON|BARE|THIN|SHRINK|TIME)$/.test(s)) &&
          !all.includes(md.modeHelp(0, false)) && !all.includes(md.modeHelp(0, true)) &&
          G.mode.length === 0 && G.modeCap === null && G.help === null &&
          all.includes("5 ROOMS · 3 LOCKED"),
        all.join("|"),
      );
    }
    {
      const { c, texts, rects } = rec();
      md.drawLevelSelect(c, 3, L, 1, 1, 0, true, 0, true);
      const all = texts.map((t) => t.s);
      const p = plateOf(rects);
      const G = md.levelGeom(L, true);
      const gloss = texts.find((t) => t.s === md.modeHelp(0, true));
      const time = texts.find((t) => t.s === "5 TIME");
      check(
        `level select UNLOCKED shows the five MODES chips at ${W}x${H}`,
        all.includes("1 IRON") &&
          all.includes("2 BARE") &&
          all.includes("3 THIN") &&
          all.includes("4 SHRINK") &&
          all.includes("5 TIME") &&
          !all.includes("1 LAST") &&
          G.mode.length === 5,
        all.join("|"),
      );
      check(
        `modes help + head + cap copy at ${W}x${H}`,
        !!gloss &&
          gloss.s === "TIME stopwatch + per-room best" &&
          all.includes("8 ROOMS · MODES OPEN") &&
          all.includes("MODES") && all.includes("1–5") &&
          all.includes("ENTER START · ESC BACK"),
        all.join("|"),
      );
      const inR = (r, t) => t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h;
      check(
        `modes chips + help stay inside the plate, between the mode row and START at ${W}x${H}`,
        !!p && !!time && !!gloss &&
          inR(G.mode[4], time) &&
          time.y > p.y + 8 &&
          gloss.y > time.y &&
          gloss.y >= G.help.y && gloss.y <= G.help.y + G.help.h + 1 &&
          gloss.y < G.start.y &&
          G.start.y + G.start.h < p.y + p.h - 8 &&
          G.mode.every((r) => r.x >= p.x && r.x + r.w <= p.x + p.w),
        JSON.stringify({ py: p && p.y, ph: p && p.h, time, gloss, help: G.help, start: G.start }),
      );
    }
    /* levelHit is levelGeom's own table: every painted rect's centre maps to
       its target (rooms past the cap read lock), a blank spot on the plate is
       inert and only a tap off the plate backs out. */
    for (const U of [false, true]) for (const T of [false, true]) {
      const G = md.levelGeom(L, U, T), S = G.S, ctr = (r) => [r.x + r.w / 2, r.y + r.h / 2];
      const hit = (r) => md.levelHit(...ctr(r), L, U, T);
      const bad = [];
      G.room.forEach((r, i) => { const h = hit(r); if (h.k !== (i < G.cap ? "room" : "lock") || h.i !== i) bad.push("room" + i); });
      for (const k of ["heat", "pace", "mode"]) G[k].forEach((r, i) => { const h = hit(r); if (h.k !== k || h.i !== i) bad.push(k + i); });
      if (hit(G.start).k !== "start") bad.push("start");
      if (md.levelHit(S.x + 4, S.y + 4, L, U, T).k !== "none") bad.push("blank");
      if (md.levelHit(S.x - 2, S.y + S.h / 2, L, U, T).k !== "back" || md.levelHit(S.mid, S.y + S.h + 2, L, U, T).k !== "back") bad.push("back");
      if (G.mode.length !== (U ? 5 : 0) || G.cap !== (U ? 8 : 5)) bad.push("shape");
      check(`levelHit round-trips levelGeom (${U ? "unlocked" : "locked"}${T ? " touch" : ""}) at ${W}x${H}`, bad.length === 0, bad.join());
    }
    {
      const { c, texts, rects } = rec();
      md.drawScores(c, DEFAULT_SCORES, L, 1, 0);
      const p = plateOf(rects);
      const esc = texts.find((t) => t.s.indexOf("ESC BACK") >= 0);
      const ten = texts.find((t) => t.s === "10");
      const dates = texts.filter((t) => t.s === "2026-08-23");
      const tabs = ["CORE", "PLUS", "MAX"].map((n) =>
        texts.find((t) => t.s === n),
      );
      check(
        `scores CORE/PLUS/MAX tabs + 10 rows + foot inside plate at ${W}x${H}`,
        !!p &&
          !!esc &&
          !!ten &&
          dates.length === 10 &&
          tabs.every((t) => !!t) &&
          tabs.every((t) => t.y > p.y + 8 && t.y < ten.y) &&
          esc.s.indexOf("HEAT") >= 0 &&
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
        `empty PLUS tab shows NO PLUS RUNS YET at ${W}x${H}`,
        texts.some((t) => t.s === "NO PLUS RUNS YET"),
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
      const rooms = texts.filter((t) => t.s.indexOf("ROOMS ") === 0);
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
      const rows = ["HOW TO PLAY", "ITEMS", "ENEMIES"];
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
    {
      const { c, texts, rects } = rec();
      const g = md.settingsGeom(L);
      md.drawSettings(c, L, 1, {
        row: 4,
        vals: { mus: 100, sfx: 100, snd: 1, r3d: 1, cam: 2, bri: 130, shk: 1, flx: 0 },
        r3d: true,
        togT: -1,
        rev: "v99",
      });
      const p = plateOf(rects);
      const first = texts.find((t) => t.s === "MUSIC");
      const lastRow = texts.find((t) => t.s === "RESET DEFAULTS");
      const note = texts.find((t) => t.s.indexOf("BOMB SPACE") >= 0);
      const T2 = rec();
      md.drawSettings(T2.c, L, 1, { row: 4, vals: { mus: 100, sfx: 100, snd: 1, r3d: 1, cam: 2, bri: 130, shk: 1, flx: 0 }, r3d: true, togT: -1, rev: "v99", touch: true });
      const gT = md.settingsGeom(L, true), pT = plateOf(T2.rects);
      const ftT = T2.texts.find((t) => t.s === md.FOOT_TAP);
      const ft = texts.find((t) => t.s.indexOf("ENTER CYCLE") >= 0);
      const kick = texts.find((t) => t.s === "BUILD v99");
      /* Keyboard: ten rows, the one CONTROLS line under them, the foot. Touch
         drops the CONTROLS line (no key chords on a phone; the rows take the
         room) and names the tap model in the foot. */
      check(
        `options plate: ten rows, the keyboard's one controls line and the foot all inside at ${W}x${H}`,
        !!p &&
          !!first &&
          !!lastRow &&
          !!note &&
          !!ft &&
          !!kick &&
          first.y > p.y + 8 &&
          lastRow.y < note.y &&
          note.y < ft.y &&
          ft.y < p.y + p.h - 8 &&
          Math.abs(note.y - (g.noteY + 4)) < 0.01,
        JSON.stringify({ p, first, lastRow, note, ft }),
      );
      check(
        `options touch: no controls line, the tap foot inside the touch plate at ${W}x${H}`,
        !!pT && !!ftT &&
          !T2.texts.some((t) => t.s.indexOf("BOMB SPACE") >= 0 || t.s.indexOf("TAP PAUSE PILL") >= 0) &&
          !T2.texts.some((t) => t.s === md.FOOT_KEYS) &&
          !texts.some((t) => t.s === md.FOOT_TAP) &&
          ftT.y > T2.texts.find((t) => t.s === "RESET DEFAULTS").y &&
          ftT.y < pT.y + pT.h - 8 &&
          Math.abs(pT.x - gT.S.x) <= 1 && Math.abs(pT.y - gT.S.y) <= 1 && Math.abs(pT.h - gT.S.h) <= 1, // plate() snaps to even px
        JSON.stringify({ pT, ftT }),
      );
      /* The pitch is a cap (28 keyboard / 41 touch, ATLAS "not fat"); a short
         box scales it by the plate's f. Rows start under the head (S.by), the
         note line sits 6 under the last row, and the drawn labels sit on the
         geometry's row centres (draw -> settingsHit share one table). */
      const pitchOk = (G, pitch, B) =>
        Math.abs(G.rowH - pitch * G.S.f) < 1e-9 &&
        (H === 520 ? G.S.f === 1 : G.S.f > 0.5 && G.S.f < 1) &&
        G.y0 === G.S.by &&
        Math.abs(G.noteY - (G.y0 + md.OPT_N * G.rowH + 6)) < 1e-9 &&
        G.S.y >= B.top - 0.5 && G.S.y + G.S.h <= B.bot + 0.5;
      const firstT = T2.texts.find((t) => t.s === "MUSIC"), lastT = T2.texts.find((t) => t.s === "RESET DEFAULTS");
      check(
        `options row pitch: 28 keyboard / 41 touch, scaled only in a short box, plate inside its band at ${W}x${H}`,
        pitchOk(g, 28, md.bandOf(L, false)) &&
          pitchOk(gT, 41, md.bandOf(L, true)) &&
          Math.abs(first.y - (g.y0 + g.rowH / 2)) < 0.01 &&
          Math.abs(lastRow.y - (g.y0 + 9.5 * g.rowH)) < 0.01 &&
          Math.abs(firstT.y - (gT.y0 + gT.rowH / 2)) < 0.01 &&
          Math.abs(lastT.y - (gT.y0 + 9.5 * gT.rowH)) < 0.01,
        [g.y0, g.rowH, g.noteY, g.S.f, gT.y0, gT.rowH, gT.S.f].join("/"),
      );
      check(
        `3D rows show a real value in REAL 3D at ${W}x${H}`,
        texts.some((t) => t.s === "FAR") && texts.some((t) => t.s === "130"),
        texts.map((t) => t.s).join("|"),
      );
    }
    {
      const { c, texts } = rec();
      md.drawSettings(c, L, 1, {
        row: 0,
        vals: { mus: 100, sfx: 100, snd: 1, r3d: 0, cam: 2, bri: 130, shk: 1, flx: 0 },
        r3d: false,
        togT: -1,
        rev: "v99",
      });
      check(
        `3D-only rows read an em dash in CLASSIC 2D at ${W}x${H}`,
        texts.filter((t) => t.s === "—").length === 2 && !texts.some((t) => t.s === "FAR"),
        texts.map((t) => t.s).join("|"),
      );
      check(
        `CLASSIC 2D still draws all ten labels — rows never hide at ${W}x${H}`,
        [
          "MUSIC",
          "SFX",
          "SOUND",
          "RENDER",
          "CAMERA",
          "BRIGHTNESS",
          "SCREEN SHAKE",
          "REDUCE FLASH",
          "GRAPHICS",
          "RESET DEFAULTS",
        ].every((n) => texts.some((t) => t.s === n)),
        texts.map((t) => t.s).join("|"),
      );
      check(`RENDER reads CLASSIC 2D with px unset at ${W}x${H}`, texts.some((t) => t.s === "CLASSIC 2D") && !texts.some((t) => t.s === "PIXEL"));
    }
    {
      const { c, texts } = rec();
      md.drawSettings(c, L, 1, { row: 3, vals: { mus: 100, sfx: 100, snd: 1, r3d: 0, cam: 2, bri: 130, shk: 1, flx: 0, px: 1 }, r3d: false, px: true, togT: -1, rev: "v99" });
      check(`RENDER reads PIXEL and the two 3D-only rows dim to an em dash at ${W}x${H}`,
        texts.some((t) => t.s === "PIXEL") && !texts.some((t) => t.s === "CLASSIC 2D") && texts.filter((t) => t.s === "—").length === 2 && !texts.some((t) => t.s === "FAR"),
        texts.map((t) => t.s).join("|"));
      check("settingsRows three-way label, r3d wins", md.settingsRows({}, false, false)[3] === "CLASSIC 2D" && md.settingsRows({}, false, true)[3] === "PIXEL" && md.settingsRows({}, true, true)[3] === "REAL 3D");
    }
    {
      const { c, texts, rects, lines } = rec();
      md.drawStats(c, L, 0.4, {
        rows: [
          ["RUNS", "118"], ["ROOMS CLEARED", "214"], ["DEATHS", "301"],
          ["KILLS", "4820"], ["PICKUPS", "913"], ["PLAY TIME", "14h 07m"], ["DAYS PLAYED", "12"],
          ["CORE BEST", "1840 · R5"], ["PLUS BEST", "—"], ["MAX BEST", "—"],
        ],
        notes: [
          "DAILY 2026-09-07 · NOT PLAYED YET",
          "SINCE 2026-08-30 · LAST 2026-09-07 · 42 SESSIONS · BESTS: NO MODES · NORM",
        ],
      });
      const all = texts.map((t) => t.s);
      const p = plateOf(rects);
      /* ATLAS: the BESTS caption replaced the old rule as the line that
         separates the seven lifetime tiles (+ MEDALS n/8) from the three
         per-heat best tiles (R12). It must sit strictly below every lifetime
         label and above every best value, and in the same place for an empty
         row list (geometry, never data, places it; never up in the head). */
      const CAP = "BESTS · NO MODES · NORM";
      const capOf = (tx) => tx.find((t) => t.s === CAP);
      check(
        `the BESTS caption sits strictly between the lifetime tiles and CORE BEST at ${W}x${H}`,
        (() => {
          const cap = capOf(texts), core = texts.find((t) => t.s === "1840 · R5");
          const life = ["RUNS", "ROOMS CLEARED", "DEATHS", "KILLS", "PICKUPS", "PLAY TIME", "DAYS PLAYED", "MEDALS"].map((n) => texts.find((t) => t.s === n));
          return !!cap && !!core && life.every((t) => t && t.y < cap.y) && cap.y < core.y &&
            cap.y < (texts.find((t) => t.s === "CORE BEST") || {}).y;
        })(),
        JSON.stringify({
          cap: capOf(texts),
          daysY: (texts.find((t) => t.s === "DAYS PLAYED") || {}).y,
          coreY: (texts.find((t) => t.s === "CORE BEST") || {}).y,
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
        ["RUNS", "ROOMS CLEARED", "DEATHS", "KILLS", "PICKUPS", "PLAY TIME", "DAYS PLAYED",
          "CORE BEST", "PLUS BEST", "MAX BEST", "STATS", "YOUR CABINET"]
          .every((s) => all.includes(s)),
        all.join("|"),
      );
      check(
        `stats plate paints both notes and the copy foot at ${W}x${H}`,
        all.some((s) => s.indexOf("NOT PLAYED YET") >= 0) &&
          all.some((s) => s.indexOf("BESTS: NO MODES · NORM") >= 0) &&
          all.includes("T MEDALS · C COPY MY STATS · R RESET · ESC BACK"),
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
        all.includes("ENTER / ESC BACK TO STATS"),
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
  const IDLE = "T MEDALS · C COPY MY STATS · R RESET · ESC BACK";
  const ARMED = [
    "ERASES SCORES · BESTS · TIMES · DAILY · MEDALS · PLAQUES · GHOSTS",
    "ERASES STATS + DAYS PLAYED · RELOCKS ROOMS 6-8 · MODES · TIME ATTACK",
    "R AGAIN ERASES · ANY OTHER KEY CANCELS · KEEPS OPTIONS + PACE · C COPY",
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

// 13e) settingsHit: the tap map derived from the same geometry the page draws.
// ATLAS rule: a row = its index; on the plate but off the rows (head, foot,
// side margins) = -2, inert; off the plate = -1, main backs out.
{
  const md = await import("../src/render/menudraw.js");
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    for (const touch of [false, true]) {
      const tag = `${W}x${H}${touch ? " touch" : ""}`;
      const g = md.settingsGeom(L, touch), S = g.S;
      const mid = S.ix + S.iw / 2, cy = g.y0 + g.rowH / 2;
      const hit = (x, y) => md.settingsHit(x, y, L, 0, touch);
      let all = true;
      for (let i = 0; i < md.OPT_N; i++) if (hit(mid, g.y0 + i * g.rowH + g.rowH / 2) !== i) all = false;
      check(`settingsHit maps every row centre at ${tag}`, all);
      check(`settingsHit on the plate above the rows (head) is -2, inert at ${tag}`, hit(mid, g.y0 - 1) === -2 && hit(mid, S.y + 4) === -2);
      check(`settingsHit on the plate below the rows (note / foot) is -2, inert at ${tag}`, hit(mid, g.y0 + md.OPT_N * g.rowH + 1) === -2 && hit(mid, S.y + S.h - 4) === -2);
      check(`settingsHit in the plate's outer margin is -2, inert at ${tag}`, hit(S.x + 4, cy) === -2 && hit(S.x + S.w - 4, cy) === -2);
      check(`settingsHit off the plate is -1 (back) at ${tag}`,
        hit(S.x - 2, cy) === -1 && hit(S.x + S.w + 2, cy) === -1 && hit(mid, S.y - 2) === -1 && hit(mid, S.y + S.h + 2) === -1);
      check(
        `settingsHit rows are contiguous — no dead gutter at ${tag}`,
        hit(mid, g.y0 + g.rowH - 0.001) === 0 && hit(mid, g.y0 + g.rowH) === 1,
        String(hit(mid, g.y0 + g.rowH)),
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
  const rec = () => {
    const texts = [], rects = [];
    const c = {
      fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1, font: "", textAlign: "left", textBaseline: "middle", shadowColor: "", shadowBlur: 0,
      fillRect(x, y, w, h) { rects.push({ x, y, w, h, fill: c.fillStyle }); },
      fillText(s, x, y) { const m = /(\d+)px/.exec(c.font); texts.push({ s: String(s), x, y, px: m ? +m[1] : 0, font: c.font, a: c.globalAlpha, blur: c.shadowBlur, fill: c.fillStyle, align: c.textAlign }); },
      strokeRect() {}, strokeText() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, arc() {}, ellipse() {}, bezierCurveTo() {}, save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, drawImage() {}, setTransform() {},
    };
    pathRects(c, rects);
    return { c, texts, rects };
  };
  check("OPT_N === OPT_ROWS.length (10)", md.OPT_N === OPT_ROWS.length && md.OPT_N === 10);
  check("GFX_N === GFX_ROWS.length (8)", md.GFX_N === gfx.GFX_ROWS.length && md.GFX_N === 8);
  check("settingsRows carries the door value at the GRAPHICS row", md.settingsRows({}, false, false, "CUSTOM ›")[OPT_ROWS.indexOf("GRAPHICS")] === "CUSTOM ›" && md.settingsRows({}, false, false)[8] === "›");
  const S = (o) => ({ ...(gfx.PRESETS.AUTO), fpm: 0, ...o });
  for (const [W, H] of [[600, 520], [608, 352]]) {
    const L = md.layout(W, H);
    for (const touch of [false, true]) {
      const g = md.graphicsGeom(L, touch), S = g.S, mid = S.ix + S.iw / 2, cy = g.y0 + g.rowH / 2, tg = `${W}x${H}${touch ? " touch" : ""}`;
      const hit = (x, y) => md.graphicsHit(x, y, L, 0, touch), B = md.bandOf(L, touch);
      /* pitch cap 28 keyboard / 41 touch (ATLAS, "not fat"), scaled by f only in a short box; help sits 6 under row 8 */
      check(`graphics row pitch: ${touch ? 41 : 28} x f, f = 1 at 520, plate inside its band (${tg})`,
        Math.abs(g.rowH - (touch ? 41 : 28) * S.f) < 1e-9 && (H === 520 ? S.f === 1 : S.f > 0.5 && S.f < 1) && g.y0 === S.by &&
          Math.abs(g.noteY - (g.y0 + md.GFX_N * g.rowH + 6)) < 1e-9 && S.y >= B.top - 0.5 && S.y + S.h <= B.bot + 0.5, [g.y0, g.rowH, g.noteY, S.f].join("/"));
      let all = true;
      for (let i = 0; i < md.GFX_N; i++) if (hit(mid, g.y0 + (i + 0.5) * g.rowH) !== i) all = false;
      check(`graphicsHit maps every row centre at ${tg}`, all);
      check(`graphicsHit on the plate off the rows is -2 (inert), off the plate -1 (back) at ${tg}`,
        hit(mid, g.y0 - 1) === -2 && hit(mid, g.y0 + md.GFX_N * g.rowH + 1) === -2 && hit(S.x + 4, cy) === -2 && hit(S.x + S.w - 4, cy) === -2 &&
          hit(S.x - 2, cy) === -1 && hit(S.x + S.w + 2, cy) === -1 && hit(mid, S.y - 2) === -1 && hit(mid, S.y + S.h + 2) === -1);
      check(`graphicsHit rows are contiguous at ${tg}`, hit(mid, g.y0 + g.rowH - 0.001) === 0 && hit(mid, g.y0 + g.rowH) === 1);
    }
    for (const touch of [false, true]) for (const kind of ["2d", "px", "3d"]) {
      const g = md.graphicsGeom(L, touch);
      const { c, texts, rects } = rec();
      const view = gfx.gfxView(S({ fxq: 0 }), kind, { dpr3d: 1.5, dprPx: 1.5, limit: true, pendingAA: true });
      md.drawGraphics(c, L, 1, { row: 1, view, togT: 0.95, chg: 0b11, touch });
      const tag = `${kind}${touch ? " touch" : ""} ${W}x${H}`;
      const p = rects.find((r) => r.fill === PLATE_FILL);
      const labels = gfx.GFX_ROWS.map((n) => texts.find((t) => t.s === n));
      /* paintRow: sans labels, 15px (17 touch) capped by 0.62 x the row band, never under 10 */
      const lpx = Math.max(10, Math.min(touch ? 17 : 15, Math.round((g.rowH - 2) * 0.62)));
      check(`graphics: eight sans labels at ${lpx}px inside the plate (${tag})`, !!p && labels.every((t) => t && t.px === lpx && /system-ui/.test(t.font) && t.y > p.y + 8 && t.y < p.y + p.h - 8));
      check(`graphics: head + kicker (${tag})`, texts.some((t) => t.s === "GRAPHICS" && t.px === 18) && texts.some((t) => t.s === "PERFORMANCE · BATTERY"));
      const h1 = texts.find((t) => t.s === view.rows[1].help1), h2 = texts.find((t) => t.s === view.rows[1].help2);
      const ft = texts.find((t) => t.s === (touch ? md.FOOT_TAP : md.FOOT_KEYS));
      check(`graphics: two help lines for the selected row, then the foot (${tag})`, !!h1 && !!h2 && !!ft && h1.px === (touch ? 11 : 10) && h1.fill === "#7385ad" && h2.fill === "#dfe7f5" &&
        labels[7].y < h1.y && h1.y < h2.y && h2.y < ft.y && ft.y < p.y + p.h - 4 && h2.s === gfx.HELP_LIMIT);
      check(`graphics: help lines fit the plate width (${tag})`, [h1, h2].every((t) => [...t.s].length * t.px * 0.6 <= g.S.iw));
      const lk = view.rows.filter((r) => r.locked).map((r) => r.label);
      const dash = texts.filter((t) => t.s === "—");
      check(`graphics: locked rows read an em dash at alpha 0.45 (${tag})`, dash.length === lk.length && dash.every((t) => t.a === 0.45) && lk.every((n) => texts.find((t) => t.s === n).a === 0.45));
      const glow = texts.filter((t) => t.blur > 0).map((t) => t.s);
      check(`graphics: the togT glow lights every changed row (chg mask) (${tag})`, glow.join() === [view.rows[0].val, view.rows[1].val].join(), glow.join());
    }
  }
  {
    const { c, texts } = rec();
    md.drawGraphics(c, md.layout(600, 520), 5, { row: 0, view: gfx.gfxView(S({}), "3d", {}), togT: -1, chg: 255 });
    check("graphics: no glow once togT is spent", texts.every((t) => !t.blur));
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
  check("OPTIONS / GRAPHICS foot: keys on desktop, the tap model on touch (one string each, <=60)", md.FOOT_KEYS === "↑↓ ROW · ←→ ADJUST · ENTER CYCLE · ESC BACK" &&
    md.FOOT_TAP === "TAP A ROW TO CHANGE IT · TAP OUTSIDE TO GO BACK" && [...md.FOOT_TAP].length <= 60);
  for (const touch of [false, true]) {
    const { c, texts } = rec();
    md.drawSettings(c, md.layout(600, 520), 1, { row: 0, vals: {}, touch });
    check(`OPTIONS foot ${touch ? "touch" : "desktop"}`, texts.some((t) => t.s === (touch ? md.FOOT_TAP : md.FOOT_KEYS)) && !texts.some((t) => t.s === (touch ? md.FOOT_KEYS : md.FOOT_TAP)));
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
    check("shellview: OPTIONS shows the door value AUTO ›", draw().includes("AUTO ›"));
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
    check("shellview: PAUSE view 2 draws the GRAPHICS page against overlayBox, kicked as the pause", T.includes("GRAPHICS") && T.some((s) => /^PAUSED · ROOM \d+$/.test(s)) && T.includes("30 FPS · IDLE"));
    a.pauseView = 1;
    check("shellview: PAUSE view 1 still draws OPTIONS with the door", draw().includes("AUTO ›"));
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
  // build tag on MENU (owner 2026-10-21: "a game version in some where in the display or menue"):
  // painted once, inside the box, off every tile / row, under the plate's fade
  {
    const { CACHE_NAME } = await import("../src/pwa/shell.js");
    const { shellGeo } = await import("../src/app/fit.js");
    const want = "v" + CACHE_NAME.match(/(\d+)$/)[1];
    const items = ["PLAY|X", "LEVEL SELECT", "DAILY|NEW", "OPTIONS", "GUIDE", "HIGH SCORES", "STATS", "SOURCE"];
    const sg = shellGeo(393, 852);
    for (const [nm, W, H, touch, lg] of [["600x520 d", 600, 520, false], ["608x352 d", 608, 352, false], ["600x520 l", 600, 520, true], ["608x352 l", 608, 352, true], ["phone #sh p", sg.w, sg.h, true, sg.logo]]) {
      const L = md.layout(W, H, lg), g = md.menuList(L, 8, touch);
      const paint = (rev, et = 9) => { const R = rec(); md.drawMenu(R.c, { cursor: 0, enterT: et, items, touch, rev, info: { level: 1, best: [] } }, L, 9); return R; };
      const R = paint("v99"), hit = R.texts.filter((t) => t.s.indexOf("v99") >= 0), t = hit[0] || {};
      const src = g.rows[7], inSource = touch && t.s === "v99 · github.com/HMarzban/fusegrid" && t.y > src.y && t.y < src.y + src.h && t.x - t.s.length * t.px * 0.6 > src.x + 24 + 80; // clear of the SOURCE label
      check(`MENU build tag painted once, inside the box, never on a row (${nm})`,
        hit.length === 1 && t.x > 0 && t.x < W && t.y > 0 && t.y < H - 18 &&
          (inSource || t.y > g.y + g.h || t.y < g.y) &&
          (touch ? true : t.s === "↑↓ MOVE · ENTER SELECT · v99"),
        JSON.stringify({ t, plate: [g.y, g.y + g.h] }));
      check(`MENU without rev paints no build tag (${nm})`, !paint("").texts.some((x) => /\bv\d+\b/.test(x.s)));
      check(`MENU build tag waits for the plate (enterT < -0.12 paints nothing) (${nm})`, paint("v99", -0.5).texts.length === 0);
    }
    const Lp = md.layout(sg.w, sg.h, sg.logo), gp2 = md.menuList(Lp, 8, true);
    const Rp = rec(); md.drawMenu(Rp.c, { cursor: 0, enterT: 9, items, touch: true, rev: "v99" }, Lp, 9);
    const tp = Rp.texts.find((x) => x.s === "v99");
    check("phone #sh: the tag hangs under the hub on its own line, the SOURCE tile keeps the bare URL",
      !!tp && tp.y > gp2.y + gp2.h && tp.y < Lp.footY && Rp.texts.some((x) => x.s === "github.com/HMarzban/fusegrid"));
    const Rl = rec(); md.drawMenu(Rl.c, { cursor: 0, enterT: 9, items, touch: true, rev: "v99" }, md.layout(600, 520), 9);
    check("touch landscape (no room under the hub): the tag rides the SOURCE tile", Rl.texts.some((x) => x.s === "v99 · github.com/HMarzban/fusegrid"));
    const a = createMenuApp({ settings: {} });
    a.screen = SCREEN.MENU;
    const Rs = rec(); drawShell(Rs.c, a, { state: "PLAY", time: 0 }, null, "2d", () => [], () => 0);
    check("shellview: MENU foot carries the CACHE_NAME build tag end to end", Rs.texts.some((x) => x.s === "↑↓ MOVE · ENTER SELECT · " + want), want);
  }
}

// 13f) menuHit: the MENU tap map shares drawMenu's geometry — every painted
//      label lands on its own row, the plate edges are -1, bands contiguous.
{
  const md = await import("../src/render/menudraw.js");
  const items = ["PLAY", "LEVEL SELECT", "DAILY", "OPTIONS", "GUIDE", "HIGH SCORES", "STATS", "SOURCE"];
  const n = items.length;
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    const at = {};
    const rc = new Proxy({}, {
      get: (t, p) => (p === "fillText" ? (s, x, y) => (at[s] = [x, y]) : () => {}),
      set: () => true,
    });
    md.drawMenu(rc, { cursor: 0, items, enterT: 9 }, L, 9);
    check(`menuHit maps every painted label to its row at ${W}x${H}`,
      items.every((s, i) => at[s] && md.menuHit(at[s][0], at[s][1], L, n) === i), JSON.stringify(at));
    const g = md.menuGeom(L, n), R = g.rows;
    const mid = g.bx + g.rw / 2;
    check(`menuHit above the rows is -1 at ${W}x${H}`, md.menuHit(mid, R[0].y0 - 1, L, n) === -1);
    check(`menuHit below the rows is -1 at ${W}x${H}`, md.menuHit(mid, R[n - 1].y1 + 1, L, n) === -1);
    check(`menuHit bands run the full stage width (a side tap is its row) at ${W}x${H}`,
      md.menuHit(2, R[0].cy, L, n) === 0 && md.menuHit(W - 2, R[n - 1].cy, L, n) === n - 1);
    check(`menuHit rows are contiguous across group gaps — no dead gutter at ${W}x${H}`,
      R.slice(0, -1).every((r, i) => md.menuHit(mid, r.b - 0.001, L, n) === i && md.menuHit(mid, r.b, L, n) === i + 1));
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
      [false, ["KeyT", "KeyC", "KeyR", null]],
      [true, ["KeyR", null, null, "KeyC"]],
    ]) {
      const f = paint(L, arm), z = zones(f), tag = `${arm ? "armed" : "idle"} at ${W}x${H}`;
      const mid = (i) => (z[i][0] + z[i][1]) / 2;
      check(`statsHit: the ${tag} foot is the last line painted and splits into ${want.length} tokens`,
        !!f && z.length === want.length && f.s.startsWith(arm ? "R AGAIN" : "T MEDALS"), f && f.s);
      check(`statsHit: every ${tag} token centre maps to its key`,
        want.every((k, i) => md.statsHit(mid(i), f.y, L, arm) === k),
        JSON.stringify(want.map((k, i) => md.statsHit(mid(i), f.y, L, arm))));
      check(`statsHit: 1 px outside each live ${tag} zone edge is not that key`,
        want.every((k, i) => !k || (md.statsHit(z[i][0] - 1, f.y, L, arm) !== k &&
          md.statsHit(z[i][1] + 1, f.y, L, arm) !== k && md.statsHit(z[i][0] + 1, f.y, L, arm) === k &&
          md.statsHit(z[i][1] - 1, f.y, L, arm) === k)));
      check(`statsHit: 1 px above the band (foot y - 12) is null ${tag}`,
        md.statsHit(mid(0), f.y - 13, L, arm) === null && md.statsHit(mid(0), f.y - 12, L, arm) !== null);
      check(`statsHit: the band reaches the plate bottom and no further ${tag}`,
        md.statsHit(mid(0), f.y + 16, L, arm) !== null && md.statsHit(mid(0), f.y + 17, L, arm) === null);
    }
  }
  const L = md.layout(600, 520), f = paint(L, false), z = zones(f);
  check("statsHit: the 600x520 idle zones are T 150-216 and R 324-384 on the band 464-492 (spec §4.1)",
    z[0][0] === 150 && z[0][1] === 216 && z[2][0] === 324 && z[2][1] === 384 && f.y === 476, JSON.stringify(z));
  const fa = paint(L, true), za = zones(fa);
  check("statsHit: the 600x520 armed zones are R AGAIN 81-183 and C COPY 465-519, both inside the 60-540 plate",
    za[0][0] === 81 && za[0][1] === 183 && za[3][0] === 465 && za[3][1] === 519 && fa.y === 476, JSON.stringify(za));
  check("statsHit: armed, no tap on the idle C COPY MY STATS zone (216-324) can land on R AGAIN",
    za[0][1] < z[1][0] && md.statsHit(z[1][0], f.y, L, true) === null, JSON.stringify([za[0], z[1]]));
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
  // "PLUS"/"MAX" also name the HEAT tabs drawn above the chip row, so
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
      plus: rightmost("PLUS"),
      max: rightmost("MAX"),
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
      const plusTab = texts.find((t) => t.s === "PLUS");
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
      /drawScores\(\s*c,\s*sd\.s,\s*L,\s*app\.subT,\s*app\.scoreHeat,\s*sd\.p,\s*touchLay\(canvas\)\)/.test(shellSrc),
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
    "shellview routes SCREEN.SETTINGS to drawSettings with app.optRow + app.settings",
    /SCREEN\.SETTINGS/.test(shellSrc) &&
      /row:\s*app\.optRow/.test(shellSrc) &&
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
      const want = lay === "d" ? "PRESS ANY KEY" : "TAP TO START";
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
    const fits = [["PRESS ANY KEY", 18], ["TAP TO START", 26], ["ANY KEY TO SKIP", 10], ["TAP TO SKIP", 18]]
      .every(([str, px]) => str.length * px * 0.6 <= W - 28);
    check(`all four opening strings fit W-28 at ${W}x${H} (0.6 em mono advance, touch copy at its phone size)`, fits);
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
  const a = md.slamOf(0), b = md.slamOf(0.12), h = md.slamOf(2 * md.SHOW_STEP), e = md.slamOf(2 * md.SHOW_STEP + 0.35);
  check("MENU slam after the show: logo 1.35 -> 1, alpha 0 -> 1 over 0.12 s on the downbeat; the dim holds 0.12 for 2S, then 0.62 over 0.35 s",
    a.s === 1.35 && a.a === 0 && a.dim === 0.12 && b.s === 1 && b.a === 1 && h.dim === 0.12 && e.dim === 0.62 && a.hold === 2 * md.SHOW_STEP,
    JSON.stringify([a, b, h, e]));
  {
    // the blast reads first: with enterT held back the plate and rows are not painted, then fade in
    const L = md.layout(600, 520), items = ["PLAY|CORE", "LEVEL SELECT|CORE", "DAILY", "OPTIONS", "GUIDE", "HIGH SCORES", "STATS", "SOURCE"];
    const paint = (et) => { const r = rec(); md.drawMenu(r.c, { cursor: 0, enterT: et, items }, L, 0); return r; };
    const held = paint(-0.2), mid = paint(-0.06), set = paint(1);
    check("MENU held behind the blast: enterT < -0.12 paints no plate and no rows; the plate fades in over the last 0.12 s",
      held.fills.length === 0 && !held.texts.some((t) => t.a > 0) && mid.fills.length > 0 && set.texts.some((t) => t.s === "PLAY" && t.a === 1),
      held.fills.length + " fills / " + mid.fills.length);
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
  const inside = (r, recd) => recd.texts.filter((t) => t.x > r.x && t.x < r.x + r.w && t.y > r.y && t.y < r.y + r.h).every((t) => t.y - t.px / 2 >= r.y - 0.5 && t.y + t.px / 2 <= r.y + r.h + 0.5);
  const rows = Array.from({ length: 8 }, (_, i) => ["MEDAL " + i, "ROOMS 1-5 IN ONE RUN · NO LIFE LOST · ALL FOUR MODES", i < 2]);
  const stats = { rows: Array.from({ length: 10 }, (_, i) => ["DAYS PLAYED", "1234"]), notes: ["N1", "N2"], trophies: rows };
  const pos = {};
  for (const [W, H] of [[600, 520], [608, 352]]) {
    const L = md.layout(W, H), tg = `${W}x${H}`;
    const m = rec();
    md.drawTrophies(m.c, L, 1, rows);
    check(`MEDALS: name + both goal lines inside each tile at ${tg}`, m.cells.length === 8 && m.cells.every((r) => inside(r, m)));
    const st = rec();
    md.drawStats(st.c, L, 1, stats, false, null);
    check(`STATS: value + label inside each of the 11 tiles at ${tg}`, st.cells.length === 11 && st.cells.every((r) => inside(r, st)));
    const sc = rec(), g = md.scoresGeom(L, false);
    md.drawScores(sc.c, [], L, 1, 0, 0b11, false);
    const chips = sc.strokes.filter((r) => Math.abs(r.y - (g.chipY + 0.5)) < 1e-9);
    check(`SCORES: four plaque chips end above bodyTop at ${tg}`, chips.length === 4 && chips.every((r) => r.y + r.h + 0.5 <= g.bodyTop), chips.map((r) => r.y + r.h).join(",") + " vs " + g.bodyTop);
    pos[tg] = [m, st].map((r) => r.texts.map((t) => t.s + "@" + t.y + "/" + t.px).join("|"));
  }
  check("MEDALS / STATS text at 600x520 is the pre-guard layout (name at tile+15, goals +32/+44; value 18px at -6, label 10px at +12)",
    /MEDAL 0@\d+(\.\d+)?\/13/.test(pos["600x520"][0]) && (() => { const r = rec(); md.drawTrophies(r.c, md.layout(600, 520), 1, rows); const c0 = r.cells[0], n = r.texts.find((t) => t.s === "MEDAL 0"), d = r.texts.filter((t) => t.x === n.x && t.y > n.y); return n.y === c0.y + 15 && d[0].y === c0.y + 32 && d[1].y === c0.y + 44; })()
      && (() => { const r = rec(); md.drawStats(r.c, md.layout(600, 520), 1, stats, false, null); const c0 = r.cells[0], v = r.texts.find((t) => t.s === "1234"), l = r.texts.find((t) => t.s === "DAYS PLAYED"); return v.px === 18 && v.y === c0.y + c0.h / 2 - 6 && l.px === 10 && l.y === c0.y + c0.h / 2 + 12; })());
  const L = md.layout(600, 520), lv = (U, best) => { const r = rec(); md.drawLevelSelect(r.c, 2, L, 1, 0, 0, U, 0, false, false, { best: best ? [null, "0:38.9"] : [] }); return r.texts.map((t) => t.s); };
  check("LEVEL SELECT: no NO TIME YET before MODES / TIME open; it shows once open; a saved best shows either way",
    !lv(false).includes("NO TIME YET") && lv(true).includes("NO TIME YET") && lv(false, true).includes("✓ BEST 0:38.9") && lv(true, true).includes("✓ BEST 0:38.9"));
  const mn = (row, U) => { const r = rec(); md.drawMenu(r.c, { cursor: row, items: ["PLAY|X", "LEVEL SELECT", "DAILY|NEW", "OPTIONS", "GUIDE", "HIGH SCORES", "STATS", "SOURCE"], info: { level: 1, unlocked: U, best: [] } }, L, 1); return r.texts.map((t) => t.s); };
  check("MENU pane: PLAY card follows the same rule, DAILY never says NO TIME YET",
    !mn(0, false).includes("NO TIME YET") && mn(0, true).includes("NO TIME YET") && !mn(2, true).includes("NO TIME YET") && !mn(2, false).includes("NO TIME YET"));
}

// touch-portrait shell box (polish 2026-10-19, fit.js shellGeo): at the phone
// boxes every page fits its plate inside the box, the narrow re-flows keep
// every rect inside the plate, and each drawn rect's centre taps back to it
// through the same hit function main.js calls (a tap lands where it is drawn)
{
  const md = await import("../src/render/menudraw.js");
  const { shellGeo } = await import("../src/app/fit.js");
  for (const [VW, VH] of [[393, 852], [360, 640], [430, 932]]) {
    const g = shellGeo(VW, VH, 600, 520), L = md.layout(g.w, g.h, g.logo), tg = `${VW}x${VH} box ${g.w}x${g.h}`;
    const inBox = (S) => S.x >= 0 && S.y >= 0 && S.x + S.w <= g.w && S.y + S.h <= g.h && S.f === 1;
    const inPlate = (r, S) => r.x >= S.x && r.y >= S.y && r.x + r.w <= S.x + S.w + 0.01 && r.y + r.h <= S.y + S.h + 0.01;
    const ctr = (r) => [r.x + r.w / 2, r.y + r.h / 2];
    check(`shell layout is tall + narrow, logo on the board line (${tg})`, L.tall && L.narrow && L.logoCy === g.logo);
    const hub = md.menuGeom(L, 8, true);
    const lg = md.menuLogo(L);
    check(`MENU hub hangs under the logo, inside the box, every tile taps to itself (${tg})`,
      hub.hub && hub.h === 362 && Math.abs(hub.y0 - Math.round(lg.cy + 10 * lg.s + 8)) <= 1 && hub.y0 + hub.h <= g.h &&
        hub.rows.every((r, i) => md.menuHit(r.x + r.w / 2, r.cy, L, 8, true) === i), hub.y0 + "+" + hub.h);
    for (const U of [false, true]) {
      const G = md.levelGeom(L, U, true), S = G.S, rects = [...G.room, G.pane, G.heatCap, ...G.heat, G.paceCap, ...G.pace, ...(U ? [G.modeCap, ...G.mode, G.help] : []), G.start];
      check(`LEVEL SELECT narrow${U ? " (modes open)" : ""}: plate in the box, every rect in the plate (${tg})`, G.narrow && inBox(S) && rects.every((r) => inPlate(r, { ...S, x: S.x - 1, w: S.w + 2 })));
      const hits = [...G.room.map((r, i) => [r, i < G.cap ? "room" : "lock", i]), ...G.heat.map((r, i) => [r, "heat", i]), ...G.pace.map((r, i) => [r, "pace", i]), ...G.mode.map((r, i) => [r, "mode", i]), [G.start, "start"]];
      check(`LEVEL SELECT narrow${U ? " (modes open)" : ""}: every chip / tile / START taps to itself, card inert, off-plate backs (${tg})`,
        hits.every(([r, k, i]) => { const h = md.levelHit(...ctr(r), L, U, true); return h.k === k && (i == null || h.i === i); }) &&
          md.levelHit(...ctr(G.pane), L, U, true).k === "none" && md.levelHit(4, 4, L, U, true).k === "back");
    }
    const sc = md.scoresGeom(L, true);
    check(`HIGH SCORES: tabs inside the plate, each taps to itself (${tg})`, inBox(sc.S) && sc.tabs.every((r, i) => inPlate(r, sc.S) && md.scoresHit(...ctr(r), L, true) === i));
    for (const [nm, geo, hit, n] of [["OPTIONS", md.settingsGeom, md.settingsHit, md.OPT_N], ["GRAPHICS", md.graphicsGeom, md.graphicsHit, md.GFX_N]]) {
      const q = geo(L, true);
      check(`${nm}: rows inside the box, each taps to itself (${tg})`, inBox(q.S) && Array.from({ length: n }, (_, i) => hit(q.S.mid, q.y0 + (i + 0.5) * q.rowH, L, 0, true) === i).every(Boolean));
    }
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
  const rec = () => {
    const texts = [];
    const o = {
      font: "10px x", textAlign: "left",
      fillText(s, x) { texts.push({ s: String(s), x, w: o.measureText(s).width, align: o.textAlign }); },
      measureText(s) { const m = /(\d+(?:\.\d+)?)px/.exec(o.font); return { width: String(s).length * 0.6 * (m ? +m[1] : 10) }; },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    };
    return { texts, c: new Proxy(o, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }) };
  };
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
      const o = rec();
      md.drawSettings(o.c, L, 1, { touch, rev: "v0" });
      const line = o.texts.find((t) => t.s.indexOf("MOVE WASD") === 0);
      check(`OPTIONS never says K+MOVE; the keyboard key line fits unclipped (${tg}${touch ? " touch" : ""})`,
        !o.texts.some((t) => K.test(t.s)) && (touch ? !line : !!line && (L.narrow || /PAUSE P$/.test(line.s))), line && line.s);
    }
  }
}

// FLOOR page + the fourth GUIDE door: every tile named once, only the four tiles with rules claim a rule, the doors tile the plate without overlap, taps hit them
{
  const md = await import("../src/render/menudraw.js"), { shellGeo } = await import("../src/app/fit.js"), { TILE_HELP } = await import("../src/core/feat.js");
  const rec = () => {
    const texts = [], o = {
      font: "10px x", textAlign: "left",
      fillText(s) { texts.push({ s: String(s) }); },
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
        ts.filter((x) => /^CORE · /.test(x)).length === Object.keys(TILE_HELP).length && ts.filter((x) => /^LOOK ONLY/.test(x)).length === NAMES.length - Object.keys(TILE_HELP).length);
      const gd = md.guideGeom(L, touch), T = gd.tiles;
      const inside = T.every((r) => r.x >= gd.S.x && r.x + r.w <= gd.S.x + gd.S.w && r.y >= gd.S.y && r.y + r.h <= gd.S.y + gd.S.h);
      const apart = T.every((a, i) => T.every((b, j) => i >= j || a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y));
      check(`GUIDE has four doors inside the plate that never overlap (${tag})`, T.length === 4 && inside && apart);
      check(`GUIDE taps hit each door, off it backs out (${tag})`, T.every((r, i) => md.guideHit(r.x + r.w / 2, r.y + r.h / 2, L, 8, touch) === i) && md.guideHit(1, 1, L, 8, touch) === -1);
      const d = rec();
      md.drawGuide(d.c, L, 1.25, 3, "2d", touch);
      check(`GUIDE draws the FLOOR door and its label (${tag})`, d.texts.some((t) => t.s === "FLOOR") && d.texts.some((t) => /^8/.test(t.s)));
    }
  }
}

console.log("\n  MENUDRAW RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
