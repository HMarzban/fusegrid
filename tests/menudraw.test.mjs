import { initFx } from "../src/render/fx.js";

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
          items: [
            "START GAME",
            "LEVEL SELECT",
            "RENDER 3D",
            "SOUND OFF",
            "HOW TO PLAY",
            "HIGH SCORES",
          ],
        },
        L,
        0.5,
      );
      md.drawLevelSelect(stub, 3, L, 0.4, 1);
      md.drawHowTo(stub, L, 0.4);
      md.drawItemsHelp(stub, L, 0.4);
      md.drawEnemiesHelp(stub, L, 0.4);
      md.drawScores(stub, DEFAULT_SCORES, L, 0.4);
      md.drawDim(stub, 0.62, W, H);
      md.drawFade(stub, 0.5, W, H);
    } catch (e) {
      ok = false;
      console.log(W + "x" + H + " smoke:", e.message);
    }
    check(`all menu draw fns no-throw on stub ctx at ${W}x${H}`, ok);
  }
}

// 13b) toggle-flash (§3 pinned row): selected value row glows accent for
//        120ms after the machine's togT stamp; idle sentinel draws clean
{
  const md = await import("../src/render/menudraw.js");
  const L = md.layout(600, 520);
  const items = [
    "START GAME",
    "LEVEL SELECT",
    "RENDER 3D",
    "SOUND OFF",
    "HOW TO PLAY",
    "HIGH SCORES",
  ];
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
    md.drawMenu(stub, { cursor: 2, enterT: 1.0, togT: 0.97, items }, L, 1.0);
    check(
      "toggle-flash: mid-window glow on flipped row",
      sets.some((v) => v > 0 && v <= 14) && !sets.some((v) => v < 0),
      JSON.stringify(sets),
    );
  }
  {
    const { stub, sets } = mk();
    md.drawMenu(stub, { cursor: 2, enterT: 1.0, togT: -1, items }, L, 1.0);
    check("toggle-flash: idle sentinel (-1) never glows", sets.length === 0);
  }
  {
    const { stub, sets } = mk();
    md.drawMenu(stub, { cursor: 2, enterT: 1.0, togT: 0.85, items }, L, 1.0);
    check(
      "toggle-flash: window closed after 120ms",
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
      rects = [];
    let quads = 0;
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
        texts.push({ s: String(s), x, y });
      },
      strokeText() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
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
    return { c, texts, rects, get quads() { return quads; } };
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
            "START GAME",
            "LEVEL SELECT",
            "RENDER REAL 3D",
            "SOUND ON",
            "HOW TO PLAY",
            "ITEMS",
            "ENEMIES",
            "HIGH SCORES",
            "SOURCE",
          ],
        },
        L,
        1,
      );
      const p = plateOf(rects);
      const start = texts.find((t) => t.s === "START GAME");
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
      const { c, texts, rects } = rec();
      md.drawScores(c, DEFAULT_SCORES, L, 1);
      const p = plateOf(rects);
      const esc = texts.find((t) => t.s === "ESC BACK");
      const ten = texts.find((t) => t.s === "10");
      const dates = texts.filter((t) => t.s === "2026-08-23");
      check(
        `scores 10 + ESC inside plate at ${W}x${H}`,
        !!p &&
          !!esc &&
          !!ten &&
          dates.length === 10 &&
          ten.y < esc.y &&
          esc.y < p.y + p.h - 4 &&
          last(dates).y < esc.y &&
          ten.y > p.y + 8,
        JSON.stringify({
          py: p && p.y,
          ph: p && p.h,
          ten: ten && ten.y,
          esc: esc && esc.y,
        }),
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
      check(
        `enemies 9 + ESC inside plate at ${W}x${H}`,
        !!p &&
          !!esc &&
          hits.every((h) => !!h) &&
          hits.every((h) => h.y > p.y + 8 && h.y < p.y + p.h - 8) &&
          esc.y < p.y + p.h - 4,
        JSON.stringify({
          py: p && p.y,
          ph: p && p.h,
          esc: esc && esc.y,
          hits: hits.map((h) => h && h.y),
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
  }
}

console.log("\n  MENUDRAW RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
