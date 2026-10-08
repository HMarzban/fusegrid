import { initFx } from "../src/render/fx.js";
import { readFileSync } from "node:fs";

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
      md.drawIntroChrome(stub, 0.3, W, H); // logo reveal beat
      md.drawIntroChrome(stub, 2.0, W, H); // mid-flyover
      md.drawIntroChrome(stub, 4.6, W, H); // settle/tagline beat
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
    return { c, texts, rects, lines, get quads() { return quads; } };
  };
  const plateOf = (rects) => rects.find((r) => r.fill === "rgba(8,12,22,0.92)");
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
      const { c, texts } = rec();
      md.drawLevelSelect(c, 3, L, 1, 1);
      const all = texts.map((t) => t.s).join("|");
      check(
        `level select LOCKED stays byte-identical at ${W}x${H} — no MODES rail`,
        !/IRON|TIME|MODES/.test(all),
        all,
      );
    }
    {
      const { c, texts, rects } = rec();
      md.drawLevelSelect(c, 3, L, 1, 1, 0, true, 0, true);
      const all = texts.map((t) => t.s);
      const p = plateOf(rects);
      const gloss = texts.find((t) => t.s.indexOf("TIME ATTACK") >= 0);
      const time = texts.find((t) => t.s === "5 TIME");
      check(
        `level select UNLOCKED shows the five MODES chips at ${W}x${H}`,
        all.includes("1 IRON") &&
          all.includes("2 BARE") &&
          all.includes("3 THIN") &&
          all.includes("4 SHRINK") &&
          all.includes("5 TIME") &&
          !all.includes("1 LAST"),
        all.join("|"),
      );
      check(
        `modes gloss + head + foot copy at ${W}x${H}`,
        !!gloss &&
          gloss.s === "5 TIME ATTACK · stopwatch + per-room best" &&
          all.some((s) => s.indexOf("ROOM + HEAT + PACE + MODES") >= 0) &&
          all.some((s) => s.indexOf("1–5 MODES") >= 0),
        all.join("|"),
      );
      check(
        `modes rail + gloss stay inside the plate at ${W}x${H}`,
        !!p && !!time && !!gloss &&
          time.y > p.y + 8 &&
          gloss.y > time.y &&
          gloss.y < p.y + p.h - 8,
        JSON.stringify({ py: p && p.y, ph: p && p.h, time, gloss }),
      );
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
      const touch = texts.find((t) => t.s.indexOf("TAP PAUSE PILL") >= 0);
      const ft = texts.find((t) => t.s.indexOf("ENTER CYCLE") >= 0);
      const kick = texts.find((t) => t.s === "BUILD v99");
      check(
        `options plate: nine rows, both notes and the foot all inside at ${W}x${H}`,
        !!p &&
          !!first &&
          !!lastRow &&
          !!note &&
          !!touch &&
          !!ft &&
          !!kick &&
          first.y > p.y + 8 &&
          lastRow.y < note.y &&
          note.y < touch.y &&
          touch.y < ft.y &&
          ft.y < p.y + p.h - 8,
        JSON.stringify({ p, first, lastRow, note, touch, ft }),
      );
      check(
        `options row pitch matches the spec budget at ${W}x${H}`,
        Math.abs(g.rowH - (H === 520 ? 30 : 173.68 / 9)) < 0.01 &&
          Math.abs(g.y0 - (H === 520 ? 121.2 : 94.32)) < 0.01 &&
          Math.abs(g.noteY - (H === 520 ? 446 : 278)) < 0.01,
        [g.y0, g.rowH, g.noteY].join("/"),
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
        `CLASSIC 2D still draws all nine labels — rows never hide at ${W}x${H}`,
        [
          "MUSIC",
          "SFX",
          "SOUND",
          "RENDER",
          "CAMERA",
          "BRIGHTNESS",
          "SCREEN SHAKE",
          "REDUCE FLASH",
          "RESET DEFAULTS",
        ].every((n) => texts.some((t) => t.s === n)),
        texts.map((t) => t.s).join("|"),
      );
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
          "SINCE 2026-08-30 · LAST 2026-09-07 · 42 SESSIONS · BESTS: NO PACT · NORM",
        ],
      });
      const all = texts.map((t) => t.s);
      const p = plateOf(rects);
      check(
        // Minor-6: the rule (moveTo/lineTo, previously unrecorded) must sit
        // strictly between the DAYS PLAYED (row 7) and CORE BEST (row 8)
        // baselines — that is what separates the seven lifetime counters from
        // the three per-heat bests (R12).
        `the lifetime/bests rule sits strictly between DAYS PLAYED and CORE BEST at ${W}x${H}`,
        (() => {
          const daysY = (texts.find((t) => t.s === "DAYS PLAYED") || {}).y;
          const coreY = (texts.find((t) => t.s === "CORE BEST") || {}).y;
          const ruleY = lines.length ? lines[lines.length - 1].y0 : undefined;
          return (
            daysY != null && coreY != null && ruleY != null &&
            daysY < ruleY && ruleY < coreY
          );
        })(),
        JSON.stringify({
          lines,
          daysY: (texts.find((t) => t.s === "DAYS PLAYED") || {}).y,
          coreY: (texts.find((t) => t.s === "CORE BEST") || {}).y,
        }),
      );
      {
        const e = rec();
        md.drawStats(e.c, L, 0.4, { rows: [], notes: [] });
        check(
          `R12: an empty row list draws the rule where ten rows would, never up in the head at ${W}x${H}`,
          e.lines.length > 0 && lines.length > 0 &&
            e.lines[e.lines.length - 1].y0 === lines[lines.length - 1].y0,
          JSON.stringify({ empty: e.lines, ten: lines }),
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
          all.some((s) => s.indexOf("BESTS: NO PACT · NORM") >= 0) &&
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
    const texts = [], rects = [];
    const c = {
      fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1, font: "",
      textAlign: "left", textBaseline: "middle",
      fillRect(x, y, w, h) { rects.push({ x, y, w, h, fill: c.fillStyle }); },
      strokeRect() {},
      fillText(s, x, y) {
        texts.push({ s: String(s), x, y, fill: c.fillStyle, a: c.globalAlpha, align: c.textAlign });
      },
    };
    return { c, texts, rects };
  };
  const plateOf = (rects) => rects.find((r) => r.fill === "rgba(8,12,22,0.92)");
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    const rows = medalRows(MEDAL.IRONCROWN | MEDAL.FLAWLESS);
    const { c, texts, rects } = rec();
    md.drawTrophies(c, L, 0.4, rows);
    const all = texts.map((t) => t.s);
    const p = plateOf(rects);
    check(
      `R6 MEDALS page paints the head, the 2/8 kicker, all eight names and the foot at ${W}x${H}`,
      all.includes("MEDALS") && all.includes("2/8") &&
        rows.every((r) => all.includes(r[0]) && all.includes(r[1])) &&
        all.includes("ENTER / ESC BACK TO STATS"),
      all.join("|"),
    );
    check(
      `R6 every MEDALS line stays inside the plate at ${W}x${H}`,
      !!p && texts.every((t) => t.y > p.y && t.y < p.y + p.h &&
        (t.align !== "left" || t.x >= p.x) && (t.align !== "right" || t.x <= p.x + p.w)),
      JSON.stringify({ p, last: texts[texts.length - 1] }),
    );
    const on = texts.find((t) => t.s === "IRON CROWN"), off = texts.find((t) => t.s === "SPRINT");
    check(
      `R6 unlocked rows read accent at full alpha, locked rows muted at 0.45 at ${W}x${H}`,
      on && off && on.fill === "#37f0d0" && on.a === 1 && off.fill === "#7385ad" && off.a === 0.45,
      JSON.stringify({ on, off }),
    );
    check(
      `R6 the page leaves globalAlpha at 1 at ${W}x${H}`,
      c.globalAlpha === 1,
      String(c.globalAlpha),
    );
    const e = rec();
    let threw = false;
    try { md.drawTrophies(e.c, L, 0.4, undefined); } catch (_) { threw = true; }
    const names = rows.map((r) => r[0]);
    check(
      `R6 rows undefined paints 8 locked, name-free placeholders without throwing at ${W}x${H}`,
      !threw && e.texts.filter((t) => t.a === 0.45).length >= 8 &&
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
    "ERASES STATS + DAYS PLAYED · RELOCKS ROOMS 6-8 · PACTS · TIME ATTACK",
    "R AGAIN ERASES + RELOADS · ANY OTHER KEY CANCELS · KEEPS OPTIONS + PACE",
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
    return { c, texts, rects };
  };
  const plateOf = (rects) => rects.find((r) => r.fill === "rgba(8,12,22,0.92)");
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

// 13e) settingsHit: the tap map derived from the same shellBox the page draws
{
  const md = await import("../src/render/menudraw.js");
  for (const [W, H] of [
    [600, 520],
    [608, 352],
  ]) {
    const L = md.layout(W, H);
    const g = md.settingsGeom(L);
    const mid = g.S.ix + g.S.iw / 2;
    let all = true;
    for (let i = 0; i < 9; i++) {
      const y = g.y0 + i * g.rowH + g.rowH / 2;
      if (md.settingsHit(mid, y, L) !== i) all = false;
    }
    check(`settingsHit maps every row centre at ${W}x${H}`, all);
    check(`settingsHit above the band is -1 at ${W}x${H}`, md.settingsHit(mid, g.y0 - 1, L) === -1);
    check(
      `settingsHit below the band is -1 at ${W}x${H}`,
      md.settingsHit(mid, g.y0 + 9 * g.rowH + 1, L) === -1,
    );
    check(`settingsHit left of the plate is -1 at ${W}x${H}`, md.settingsHit(g.S.ix - 2, g.y0 + 2, L) === -1);
    check(
      `settingsHit right of the plate is -1 at ${W}x${H}`,
      md.settingsHit(g.S.ix + g.S.iw + 2, g.y0 + 2, L) === -1,
    );
    check(
      `settingsHit rows are contiguous — no dead gutter at ${W}x${H}`,
      md.settingsHit(mid, g.y0 + g.rowH - 0.001, L) === 0 && md.settingsHit(mid, g.y0 + g.rowH, L) === 1,
      String(md.settingsHit(mid, g.y0 + g.rowH, L)),
    );
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
    const g = md.menuGeom(L, n);
    const mid = g.bx + g.rw / 2, top = g.y0 + g.padY;
    check(`menuHit above the rows is -1 at ${W}x${H}`, md.menuHit(mid, top - 1, L, n) === -1);
    check(`menuHit below the rows is -1 at ${W}x${H}`, md.menuHit(mid, top + n * g.span + 1, L, n) === -1);
    check(`menuHit left of the plate is -1 at ${W}x${H}`, md.menuHit(g.bx - 2, top + 2, L, n) === -1);
    check(`menuHit right of the plate is -1 at ${W}x${H}`, md.menuHit(g.bx + g.rw + 2, top + 2, L, n) === -1);
    check(`menuHit rows are contiguous — no dead gutter at ${W}x${H}`,
      md.menuHit(mid, top + g.span - 0.001, L, n) === 0 && md.menuHit(mid, top + g.span, L, n) === 1);
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
      [false, ["KeyT", null, "KeyR", null]],
      [true, ["KeyR", null, null]],
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
    return { c, texts, rects };
  };
  const plateOf = (rects) => rects.find((r) => r.fill === "rgba(8,12,22,0.92)");
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
      check(
        `unlocked chips (CLEAR/MAX) read bright/full-alpha, locked chips (PLUS/CROWN) read dim at ${W}x${H}`,
        !!clear &&
          !!max &&
          !!plus &&
          !!crown &&
          clear.alpha === 1 &&
          max.alpha === 1 &&
          plus.alpha < 1 &&
          crown.alpha < 1,
        JSON.stringify({ clear, plus, max, crown }),
      );
      check(
        `plaque chips still leave the 10-row table + heat-tabs foot inside the plate at ${W}x${H}`,
        !!ten && !!esc && ten.y < esc.y && esc.y < p.y + p.h - 4 && ten.y > p.y + 8,
        JSON.stringify({ ten: ten && ten.y, esc: esc && esc.y, py: p && p.y, ph: p && p.h }),
      );
    }
    {
      // all locked (mask omitted / 0): every chip reads dim
      const { c, texts } = rec();
      md.drawScores(c, DEFAULT_SCORES, L, 1, 0);
      const { clear, plus, max, crown } = chipsOf(texts);
      const chips = [clear, plus, max, crown];
      check(
        `no mask arg -> all four chips locked/dim at ${W}x${H}`,
        chips.every((t) => !!t && t.alpha < 1),
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
      if (H === 352) {
        check(
          "608x352 plaques sit on the heat-tab row (compact)",
          !!plusTab && !!clear && Math.abs(clear.y - plusTab.y) < 0.5,
          JSON.stringify({ plusY: plusTab && plusTab.y, clearY: clear && clear.y }),
        );
      } else {
        check(
          "600x520 plaques stay on a dedicated row under the heat tabs",
          !!plusTab && !!clear && clear.y > plusTab.y + 16,
          JSON.stringify({ plusY: plusTab && plusTab.y, clearY: clear && clear.y }),
        );
      }
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
    "shellview passes app.scoreHeat into the getter and into drawScores",
    /getScores\(app\.scoreHeat\)/.test(shellSrc) &&
      /drawScores\(\s*c,\s*getScores\(app\.scoreHeat\),\s*L,\s*app\.subT,\s*app\.scoreHeat,\s*getPlaques/.test(
        shellSrc,
      ),
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

console.log("\n  MENUDRAW RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
