// Stage reserves for the new HUD (UI upgrade Task 8.1, round 5 09-hud): the stage gives the chip plate and the power-ups
// bar their own rows on a keyboard screen and on a phone in portrait, and the gutters on a landscape phone, so the HUD
// never sits on the board. Numbers: the mock's own desktop board is 0.84 of today's scale (round5/S5-pages/screen.js
// HK = 0.84, "the HUD is above the board in its own rampart plate"), the phone mock keeps the board at full width.
import test from "node:test";
import assert from "node:assert/strict";
import { FIT_RES, HUD_RES, PORT_GEO, PORT_GAME, fitBox, hudGeo, hudReach, mountFit, portraitGeo } from "../src/app/fit.js";
import { cardClears, reach, CARD_H } from "../src/app/analytics.js";

const OLD = { d: [40, 48], p: [16, 250], l: [332, 16] }; // the reserves before the HUD left the board (shell v202)
const old = (W, H, lay) => Math.max(0.3, Math.min((W - OLD[lay][0]) / 600, (H - OLD[lay][1]) / 520, 1.8));
const now = (W, H, lay) => fitBox(W, H, lay !== "d", 600, 520, true).s; // the HUD on (GAME)
const D = [[1366, 768], [1280, 720], [1440, 900], [1920, 1080], [1024, 640], [1280, 800], [1536, 864], [2560, 1440], [800, 600]];
const P = [[393, 852], [390, 844], [430, 932], [412, 915], [375, 812], [375, 667], [360, 740], [768, 1024]];
const L = [[844, 390], [932, 430], [852, 393], [667, 375], [740, 360], [1024, 768], [1180, 820]];
const bottom = (r) => r.y + r.h, right = (r) => r.x + r.w;

test("HUD_RES and FIT_RES: the desktop reserve is exactly the plate rows above plus the bar rows below", () => {
  const d = HUD_RES.d, p = HUD_RES.p;
  assert.ok(Object.isFrozen(HUD_RES) && Object.isFrozen(d) && Object.isFrozen(p) && Object.isFrozen(HUD_RES.l));
  assert.equal(d.top, d.air + d.ring + d.box + d.ring + 3);
  assert.equal(d.bot, d.gap + d.bar + 7);
  assert.deepEqual(FIT_RES.d, [40, d.top + d.bot]);
  assert.equal(p.top, p.air + p.ring + p.box + p.ring + 3 + 3);
  assert.deepEqual(FIT_RES.p, [16, p.top + p.gap + p.bar + 8 + PORT_GEO.pad[0] + PORT_GEO.edge]);
  assert.deepEqual(FIT_RES.l, OLD.l);
  assert.equal(PORT_GAME.top, p.top);
  assert.equal(d.tip.card, 16 + CARD_H + 8, "the tip column stops above the analytics card's corner");
});

/* R3 (fix round 1): every window keeps 0.84 of today's board in GAME (the mock's HK) except these, named for the owner at O4 with
   their measured ratio held as a floor: short windows where the plate and bar rows cost more than 16 % of the height */
const EXEMPT = { "d 1280x720": 0.8289, "d 1366x657": 0.8112, "d 1024x640": 0.8057, "d 800x600": 0.7917, "p 320x568": 0.6832 };

test("R3: GAME keeps 0.84 of today's board everywhere but the named exemptions, which hold their measured ratio; off GAME the scale is today's", () => {
  const rows = [...[...D, [1366, 657], [1024, 768]].map(([W, H]) => ["d", W, H]), ...[...P, [360, 640], [320, 568]].map(([W, H]) => ["p", W, H])];
  for (const [lay, W, H] of rows) {
    const k = lay + " " + W + "x" + H, r = now(W, H, lay) / old(W, H, lay), floor = EXEMPT[k] ?? 0.84;
    assert.ok(r >= floor - 1e-4, `${k}: ${r.toFixed(4)} < ${floor}`);
    if (k in EXEMPT) assert.ok(r < 0.84, `${k} reaches 0.84 now: drop its exemption`);
    assert.equal(fitBox(W, H, lay !== "d", 600, 520).s, old(W, H, lay), `${k}: off GAME (no HUD) the board keeps today's scale`);
  }
  assert.ok(now(360, 640, "p") / old(360, 640, "p") >= 0.84, "360x640 reaches the floor (pad floor 148, plate air 8)");
  for (const k of Object.keys(EXEMPT)) assert.ok(rows.some(([l, W, H]) => l + " " + W + "x" + H === k), k + " is measured");
});

test("the board never shrinks below today's scale by more than the mock allows", () => {
  assert.ok(now(1366, 768, "d") / old(1366, 768, "d") >= 0.84 - 1e-3, "1366x768 keeps the mock's HK 0.84");
  for (const [W, H] of D) {
    const lost = 520 * (old(W, H, "d") - now(W, H, "d"));
    assert.ok(lost <= FIT_RES.d[1] - OLD.d[1] + 1e-6, `d ${W}x${H} gives up ${lost.toFixed(1)} px of board height`);
  }
  assert.equal(now(393, 852, "p"), old(393, 852, "p"), "the phone mock's own 393x852 keeps the board at full width");
  for (const [W, H] of P) assert.ok(now(W, H, "p") / old(W, H, "p") >= 0.84 - 1e-3, `p ${W}x${H} ${(now(W, H, "p") / old(W, H, "p")).toFixed(3)}`);
  for (const [W, H] of L) assert.equal(now(W, H, "l"), old(W, H, "l"), `l ${W}x${H}: a landscape phone keeps its whole board`);
});

test("chips never overlap board row 0, and every HUD slot sits inside the viewport", () => {
  for (const [W, H] of D) {
    const g = hudGeo(W, H, 600, 520, "d");
    const ring = HUD_RES.d.ring;
    assert.ok(bottom(g.plate) + ring <= g.stage.y + 1e-6, `d ${W}x${H}: plate ring ends at ${bottom(g.plate) + ring}, board at ${g.stage.y}`);
    assert.ok(g.plate.y - ring >= 0 && g.bar.y >= bottom(g.stage) + 8 - 1e-6 && bottom(g.bar) <= H + 1e-6, `d ${W}x${H}`);
    assert.ok(Math.abs(g.stage.w - 600 * g.s) < 1e-6 && Math.abs(g.stage.x - (W - g.stage.w) / 2) < 1e-6);
    if (g.tip) assert.ok(g.tip.x >= right(g.stage) + 8 && right(g.tip) <= W && g.tip.y1 <= H - HUD_RES.d.tip.card && g.tip.y1 > g.tip.y0, `d ${W}x${H} tip ${JSON.stringify(g.tip)}`);
  }
  assert.ok(hudGeo(1366, 768, 600, 520, "d").tip.w >= 260, "the mock's own window has the tip column beside the board");
  for (const [W, H] of P) {
    assert.equal(hudGeo(W, H, 600, 520, "p", false), null, "no HUD off GAME");
    const g = hudGeo(W, H, 600, 520, "p", true);
    assert.ok(bottom(g.plate) + HUD_RES.p.ring + 3 <= g.stage.y + 1e-6 && g.plate.y >= HUD_RES.p.ring, `p ${W}x${H} plate`);
    assert.ok(g.band.y >= bottom(g.stage) + 8 && g.band.h >= HUD_RES.p.bar && bottom(g.band) + 8 <= g.ctl.y + 1e-6 && bottom(g.ctl) <= H - PORT_GEO.edge + 1e-6, `p ${W}x${H} ${JSON.stringify(g)}`);
    assert.equal(g.stage.y, portraitGeo(W, H, 600, 520, true).top);
  }
  for (const [W, H] of L) {
    const g = hudGeo(W, H, 600, 520, "l");
    for (const k of ["left", "right"]) {
      const r = g[k];
      assert.ok(r.x >= 0 && right(r) <= W && r.y >= 0 && bottom(r) <= H && r.w > 0 && r.h > 0, `l ${W}x${H} ${k} ${JSON.stringify(r)}`);
      assert.ok(right(r) <= g.stage.x - 8 + 1e-6 || r.x >= right(g.stage) + 8 - 1e-6, `l ${W}x${H} ${k} stays off the board`);
    }
  }
});

test("the analytics card still clears the play column where it did, and never meets the tip", () => {
  const card = (W, H, g) => cardClears(hudReach(g), W, H);
  for (const [W, H] of [[1920, 1080], [2560, 1440]]) {
    const g = hudGeo(W, H, 600, 520, "d"), was = { right: (W + 600 * old(W, H, "d")) / 2, bottom: (H + 520 * old(W, H, "d")) / 2 };
    assert.ok(cardClears(was, W, H) && card(W, H, g), `${W}x${H} clears beside the column`);
    assert.ok(hudReach(g).bottom >= bottom(g.bar) && hudReach(g).right >= right(g.stage));
  }
  for (const [W, H] of [[1366, 768], [1280, 720], [1440, 900]]) assert.equal(card(W, H, hudGeo(W, H, 600, 520, "d")), false, `${W}x${H}: the column reaches the corner, so the card waits (as today)`);
  const r = { getBoundingClientRect: () => ({ right: 900, bottom: 600 }) };
  assert.deepEqual(reach(r, { dataset: { r: "950,700" } }), { right: 950, bottom: 700 });
  assert.deepEqual(reach(r, { dataset: { r: "" } }), { right: 900, bottom: 600 });
  assert.deepEqual(reach(r, null), { right: 900, bottom: 600 });
});

test("mountFit: the HUD's reserve, #wrap's rows and #hud's backing exist only while the HUD shows (R2); off, the backing sleeps at 1x1", () => {
  const props = {}, hud = { width: 300, height: 150, hidden: true, style: {}, dataset: {}, getContext: () => ctx }, log = [], cv = { width: 600, height: 520, style: {} };
  const ctx = { setTransform: (...a) => log.push(a) };
  globalThis.window = { innerWidth: 1366, innerHeight: 768, addEventListener() {} };
  globalThis.document = { getElementById: (id) => (id === "hud" ? hud : null), body: { setAttribute() {}, style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: (k) => { delete props[k]; } } } };
  globalThis.devicePixelRatio = 2;
  try {
    const fit = mountFit(cv), g = hudGeo(1366, 768, 600, 520, "d");
    assert.equal(cv.style.width, 600 * old(1366, 768, "d") + "px", "INTRO / MENU / ATTRACT: today's board scale");
    assert.ok(!("--ht" in props) && !("--hb" in props) && hud.width === 300 && hud.style.width === "1366px");
    assert.ok(hud.hidden && fit.hud(0) === null && hud.hidden && hud.width === 1 && hud.height === 1);
    const g0 = fit.hudGen(), h = fit.hud(1);
    assert.equal(cv.style.width, 600 * now(1366, 768, "d") + "px", "GAME: the HUD's reserve");
    assert.equal(props["--ht"], HUD_RES.d.top + "px");
    assert.equal(props["--hb"], HUD_RES.d.bot + "px");
    assert.ok(hud.width === 2732 && hud.height === 1536 && fit.hudGen() > g0, "the backing is restored (and the HUD told to repaint)");
    assert.ok(!hud.hidden && h.ctx === ctx && h.w === 1366 && h.h === 768 && JSON.stringify(h.geo) === JSON.stringify(g));
    assert.deepEqual(log.at(-1), [2, 0, 0, 2, 0, 0]);
    hud.dataset.r = "999,700"; fit();
    assert.equal(hud.dataset.r, "999,700", "a re-fit leaves data-r to the painter (the reach as drawn)");
    assert.ok(fit.hud(false) === null && hud.hidden && hud.width === 1 && hud.height === 1 && hud.dataset.r === "");
    assert.ok(!("--ht" in props) && cv.style.width === 600 * old(1366, 768, "d") + "px", "leaving GAME gives today's scale back");
  } finally { delete globalThis.window; delete globalThis.document; delete globalThis.devicePixelRatio; }
});

test("index.html: #hud is the click-through viewport canvas under #sh, hidden by default, and #wrap's desktop padding carries the rows", async () => {
  const html = (await import("node:fs")).readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<canvas id="hud" hidden aria-hidden="true"><\/canvas>\s*<canvas id="sh"/);
  const rule = (html.match(/#hud\{[^}]*\}/) || [""])[0];
  assert.match(rule, /position:fixed/);
  assert.match(rule, /pointer-events:none/);
  assert.match(rule, /z-index:3/);
  assert.match(html, /#hud\[hidden\]\{display:none\}/);
  assert.match(html, /body\[data-lay=d\] #wrap\{padding:var\(--ht,14px\) 14px var\(--hb,14px\)\}/);
});
