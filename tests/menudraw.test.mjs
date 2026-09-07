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
          ["KILLS", "4820"], ["PICKUPS", "913"], ["PLAY TIME", "14h 07m"],
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
        // strictly between the PLAY TIME (row 6) and CORE BEST (row 7)
        // baselines — that is what separates the six lifetime counters from
        // the three per-heat bests.
        `the lifetime/bests rule sits strictly between PLAY TIME and CORE BEST at ${W}x${H}`,
        (() => {
          const playY = (texts.find((t) => t.s === "PLAY TIME") || {}).y;
          const coreY = (texts.find((t) => t.s === "CORE BEST") || {}).y;
          const ruleY = lines.length ? lines[lines.length - 1].y0 : undefined;
          return (
            playY != null && coreY != null && ruleY != null &&
            playY < ruleY && ruleY < coreY
          );
        })(),
        JSON.stringify({
          lines,
          playY: (texts.find((t) => t.s === "PLAY TIME") || {}).y,
          coreY: (texts.find((t) => t.s === "CORE BEST") || {}).y,
        }),
      );
      check(
        `stats plate paints all nine labels and the head at ${W}x${H}`,
        ["RUNS", "ROOMS CLEARED", "DEATHS", "KILLS", "PICKUPS", "PLAY TIME",
          "CORE BEST", "PLUS BEST", "MAX BEST", "STATS", "YOUR CABINET"]
          .every((s) => all.includes(s)),
        all.join("|"),
      );
      check(
        `stats plate paints both notes and the copy foot at ${W}x${H}`,
        all.some((s) => s.indexOf("NOT PLAYED YET") >= 0) &&
          all.some((s) => s.indexOf("BESTS: NO PACT · NORM") >= 0) &&
          all.includes("C COPY MY STATS · ESC BACK"),
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
