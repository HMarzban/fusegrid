import { CFG, T, key, biomeOf, BIOMES } from "../core/config.js";
import { drawIcon, rr, RIM, ITEM_FAMILY, dk, lt, poly, seal } from "./icons.js";
import { drawEnemyBody } from "./enemybody.js";
export { drawIcon, drawEnemyBody };

/* RENDER LAYER — reads world, never mutates it. Every draw fn takes a 2D
   context as its first argument (no global ctx) and is a pure function of
   (world, time). Sprites are BAKED to offscreen canvases once (if the browser
   can make canvases); otherwise we fall back to the identical vector draws so
   headless/non-DOM contexts still render. */

export function canMakeCanvas() {
  try {
    const el =
      typeof document !== "undefined" &&
      document.createElement &&
      document.createElement("canvas");
    return !!(el && el.getContext && el.getContext("2d"));
  } catch (_) {
    return false;
  }
}

/* Capture any translate-free body painter into an offscreen canvas — real DOM
   canvas in the browser, injected factory in Node tests. Returns null when
   neither source exists so callers keep their vector/color fallbacks (the
   real-3D zero-asset texture pipeline feeds these canvases to CanvasTexture). */
export function captureSprite(w, h, paint, mk) {
  const c = mk
    ? mk()
    : canMakeCanvas()
      ? document.createElement("canvas")
      : null;
  if (!c || typeof c.getContext !== "function") return null;
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  paint(ctx);
  return c;
}

/* ---- one-time sprite atlas (per biome) ---- */
const BAKED = { floorA: {}, floorB: {}, wall: {}, brick: {}, ready: false };
export function bakeAtlas() {
  if (BAKED.ready || !canMakeCanvas()) return;
  const make = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  biomeOf(1); // touch
  for (let i = 0; i < BIOMES.length; i++) {
    const b = biomeOf(i + 1);
    const fA = make(CFG.TILE, CFG.TILE),
      a = fA.getContext("2d");
    a.fillStyle = b.floor0;
    a.fillRect(0, 0, CFG.TILE, CFG.TILE);
    a.strokeStyle = b.floor1;
    a.globalAlpha = 0.25;
    a.strokeRect(1, 1, CFG.TILE - 2, CFG.TILE - 2);
    BAKED.floorA[i] = fA;
    const fB = make(CFG.TILE, CFG.TILE),
      bb = fB.getContext("2d");
    bb.fillStyle = b.floor1;
    bb.fillRect(0, 0, CFG.TILE, CFG.TILE);
    bb.strokeStyle = b.floor0;
    bb.globalAlpha = 0.25;
    bb.strokeRect(1, 1, CFG.TILE - 2, CFG.TILE - 2);
    BAKED.floorB[i] = fB;
    const w = make(CFG.TILE, CFG.TILE),
      wc = w.getContext("2d");
    wc.fillStyle = b.wall;
    rr(wc, 0, 0, CFG.TILE, CFG.TILE, 4);
    wc.fill();
    wc.fillStyle = b.wallHi;
    wc.fillRect(3, 3, CFG.TILE - 6, CFG.TILE * 0.4);
    wc.fillStyle = "rgba(0,0,0,0.35)";
    wc.fillRect(3, CFG.TILE * 0.5 + 2, CFG.TILE - 6, CFG.TILE * 0.44);
    wc.fillStyle = "rgba(255,255,255,0.15)";
    wc.fillRect(5, 5, 3, 3);
    wc.fillRect(CFG.TILE - 8, 5, 3, 3);
    wc.fillRect(5, CFG.TILE - 8, 3, 3);
    wc.fillRect(CFG.TILE - 8, CFG.TILE - 8, 3, 3);
    BAKED.wall[i] = w;
    const bk = make(CFG.TILE, CFG.TILE),
      bc = bk.getContext("2d");
    bc.fillStyle = b.brickB;
    rr(bc, 1, 1, CFG.TILE - 2, CFG.TILE - 2, 4);
    bc.fill();
    bc.fillStyle = b.brickA;
    rr(bc, 2, 2, CFG.TILE - 4, CFG.TILE * 0.46, 4);
    bc.fill();
    bc.fillStyle = b.brickHi;
    bc.globalAlpha = 0.55;
    rr(bc, 3, 3, CFG.TILE - 6, CFG.TILE * 0.2, 3);
    bc.fill();
    bc.globalAlpha = 1;
    bc.strokeStyle = "rgba(0,0,0,0.4)";
    bc.lineWidth = 1.5;
    rr(bc, 1, 1, CFG.TILE - 2, CFG.TILE - 2, 4);
    bc.stroke();
    BAKED.brick[i] = bk;
  }
  BAKED.ready = true;
}

/* Standalone baked tile source for the 3D textured top faces (spec §2).
   type: "wall" | "brick". Null until baked / in headless contexts. */
export function bakedTile(bi, type) {
  const s = BAKED.ready && BAKED[type] && BAKED[type][bi];
  return s || null;
}

function biomeIndex(level) {
  return (Math.max(1, level) - 1) % BIOMES.length;
}

/* ---- tiles ---- */
export function drawGrid(c, world) {
  const bi = biomeIndex(world.level),
    b = biomeOf(world.level);
  const fA = BAKED.floorA[bi],
    fB = BAKED.floorB[bi],
    wTile = BAKED.wall[bi];
  for (let y = 0; y < CFG.ROWS; y++)
    for (let x = 0; x < CFG.COLS; x++) {
      const t = world.grid[key(x, y)],
        px = x * CFG.TILE,
        py = y * CFG.TILE;
      if (t === T.WALL) {
        if (wTile) {
          c.drawImage(wTile, px, py);
          continue;
        }
        c.fillStyle = b.wall;
        rr(c, px, py, CFG.TILE, CFG.TILE, 4);
        c.fill();
        c.fillStyle = b.wallHi;
        c.fillRect(px + 3, py + 3, CFG.TILE - 6, CFG.TILE * 0.4);
        c.fillStyle = "rgba(0,0,0,0.35)";
        c.fillRect(
          px + 3,
          py + CFG.TILE * 0.5 + 2,
          CFG.TILE - 6,
          CFG.TILE * 0.44,
        );
        c.fillStyle = "rgba(255,255,255,0.15)";
        c.fillRect(px + 5, py + 5, 3, 3);
        c.fillRect(px + CFG.TILE - 8, py + 5, 3, 3);
        c.fillRect(px + 5, py + CFG.TILE - 8, 3, 3);
        c.fillRect(px + CFG.TILE - 8, py + CFG.TILE - 8, 3, 3);
      } else if (fA) {
        c.drawImage((x + y) & 1 ? fB : fA, px, py);
      } else {
        c.fillStyle = (x + y) & 1 ? b.floor1 : b.floor0;
        c.fillRect(px, py, CFG.TILE, CFG.TILE);
        c.strokeStyle = "rgba(120,160,220,0.05)";
        c.lineWidth = 1;
        c.strokeRect(px + 0.5, py + 0.5, CFG.TILE - 1, CFG.TILE - 1);
      }
    }
}
export function drawBricks(c, world) {
  const bi = biomeIndex(world.level),
    b = BAKED.brick[bi],
    B = biomeOf(world.level);
  for (let y = 0; y < CFG.ROWS; y++)
    for (let x = 0; x < CFG.COLS; x++)
      if (world.grid[key(x, y)] === T.BRICK) {
        const px = x * CFG.TILE,
          py = y * CFG.TILE;
        if (b) {
          c.drawImage(b, px, py);
          continue;
        }
        c.save();
        c.translate(px, py);
        c.fillStyle = B.brickB;
        rr(c, 1, 1, CFG.TILE - 2, CFG.TILE - 2, 4);
        c.fill();
        c.fillStyle = B.brickA;
        rr(c, 2, 2, CFG.TILE - 4, CFG.TILE * 0.46, 4);
        c.fill();
        c.fillStyle = B.brickHi;
        c.globalAlpha = 0.55;
        rr(c, 3, 3, CFG.TILE - 6, CFG.TILE * 0.2, 3);
        c.fill();
        c.globalAlpha = 1;
        c.strokeStyle = "rgba(0,0,0,0.4)";
        c.lineWidth = 1.5;
        rr(c, 1, 1, CFG.TILE - 2, CFG.TILE - 2, 4);
        c.stroke();
        c.restore();
      }
}
export function drawBiomeBackground(c, world) {
  const b = biomeOf(world.level);
  const g = c.createLinearGradient(0, 0, 0, CFG.ROWS * CFG.TILE);
  g.addColorStop(0, b.bg0);
  g.addColorStop(1, b.bg1);
  c.fillStyle = g;
  c.fillRect(0, 0, CFG.COLS * CFG.TILE, CFG.ROWS * CFG.TILE);
}

/* 64² REAL 3D cube face: navy plate + cabinet glyph. Atlas key item_<t>. */
export function paintItemFace(c, type, col) {
  c.fillStyle = "#0b1020";
  c.fillRect(0, 0, 64, 64);
  c.save();
  c.translate(32, 32);
  c.scale(2.35, 2.35);
  drawIcon(c, type, col, 0);
  c.restore();
  c.strokeStyle = "rgba(255,255,255,0.16)";
  c.lineWidth = 2;
  c.beginPath();
  c.rect(2, 2, 60, 60);
  c.stroke();
  c.beginPath();
  c.stroke();
}
/* The ring language a player learns in REAL 3D has to be recognisable in
   CLASSIC 2D, which has no additive ring at all — so the old double it.col
   ring (which only restated the hue the body already states) becomes the
   family echo. Dashes are arcs: the headless stub has no setLineDash. */
export function drawItemChrome(c, fam, t, ph) {
  const T = CFG.TILE;
  if (fam === "cap") {
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, T * 0.36, 0, 7);
    c.stroke();
    return;
  }
  if (fam === "vit") {
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, T * 0.3, 0, 7);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, T * 0.42, 0, 7);
    c.stroke();
    return;
  }
  if (fam === "utl") {
    c.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      c.beginPath();
      c.arc(0, 0, T * 0.38, a, a + Math.PI / 5);
      c.stroke();
    }
    return;
  }
  c.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(9 * t + ph));
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(0, 0, T * 0.33, 0, 7);
  c.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    c.beginPath();
    c.moveTo(Math.cos(a) * T * 0.36, Math.sin(a) * T * 0.36);
    c.lineTo(Math.cos(a) * T * 0.46, Math.sin(a) * T * 0.46);
    c.stroke();
  }
}
export function drawItemBody(c, world, it) {
  const T = CFG.TILE,
    t = world.time || 0,
    fam = ITEM_FAMILY[it.t] || "cap";
  /* slot is a compaction index, so collecting one pickup re-indexes its
     neighbours and their animation jumps. Grid phase is stable and is the
     same number the 3D update() writes. */
  const ph = (it.x * 0.7 + it.y * 1.3) / T;
  if (fam === "cap") {
    const k = 1 + 0.07 * Math.sin(3 * t + ph);
    c.scale(k, k);
  } else if (fam === "vit") c.translate(0, 1.8 * Math.sin(2.4 * t + ph));
  else if (fam === "utl") c.rotate(0.1 * Math.sin(7 * t + ph));
  c.fillStyle = "rgba(8,12,24,0.92)";
  c.beginPath();
  c.arc(0, 0, T * 0.34, 0, 7);
  c.fill();
  c.strokeStyle = it.col || "rgba(255,255,255,0.25)";
  c.globalAlpha = 0.85;
  drawItemChrome(c, fam, t, ph);
  c.globalAlpha = 1;
  drawIcon(c, it.t, it.col, t);
}
export function drawItems(c, world) {
  for (const it of world.items) {
    if (it.taken || it.buried) continue;
    c.save();
    c.translate(it.x, it.y);
    drawItemBody(c, world, it);
    c.restore();
  }
}

/* ---- entities ---- */
/* drawEnemyBody draws one enemy at origin; the render bob stays in the
   drawEnemies wrapper (positioning concern) so bodies stay translate-free. */
export function drawEnemies(c, world) {
  for (const e of world.enemies) {
    if (e.dead) continue;
    c.save();
    c.translate(e.x, e.y);
    const bob =
      e.type === "stationary"
        ? Math.sin(world.time * 3) * 1.5
        : e.speed > 0
          ? Math.sin(world.time * 12 + e.home.x * 0.7) * 1.6
          : 0;
    c.translate(0, bob);
    drawEnemyBody(c, world, e);
    c.restore();
  }
}
/* SIGNAL RUNNER — R1 (items-player-art 2026-09-05, revised same day after
   the user rejected P1: "looks a bit too silly and doesn't feel mature
   enough"). P1 optimised the WALKER collision and won it on paper; at the
   28px live size the body still read as a WHITE EGG WITH A CAP, because a
   near-circular outline filled 90%-luminance white is a cute shape however
   many facets it has. R1 keeps the whole separation story and re-cuts the
   three things that carry maturity at 28px:

   TAPER — the outline is a shouldered wedge, not a barrel: widest at the
   pauldron line (0.9r, upper third), shedding 1.9x of that width within
   half a radius, closing at a 0.5r waist. The hull STOPS at the waist and
   two long dark legs carry the lower third, so the bright mass is a third
   smaller and the figure has a stance instead of a base.
   VALUE — the hull drops from #dfe7f2 (L 0.90) to gunmetal #8d97ac (L 0.59).
   Brightness is what read as cute; a mid value also separates BETTER from
   walker's mint, and it leaves the visor pip as the one bright thing.
   EDGE — the p.color cap becomes a swept CREST with every vertex inside the
   helmet contour, and the soft sheen ellipse becomes hard armour facets.
   Zero-arc rule holds: nothing here is an arc.
   Unchanged: p.color placement (crest only), the single specular visor, the
   RIM seal, the five beats, no antenna / ball / round eyes / dome. */
export const PLAYER_HULL = "#8d97ac";
const HULL = PLAYER_HULL;
/* The shoulder is a LEDGE, not a slope: the jaw runs out to +-0.92r almost
   level, then drops down a vertical pauldron edge. Iteration 1 used a single
   diagonal from helmet to shoulder tip and it read as a cloak / bell. */
const S_RUNNER = poly([
  [-0.36, -1.0], [0.36, -1.0], [0.52, -0.8], [0.44, -0.54],
  [0.34, -0.46], [0.86, -0.4], [0.9, -0.06], [0.68, 0.12],
  [0.56, 0.32], [0.5, 0.54], [-0.5, 0.54], [-0.56, 0.32],
  [-0.68, 0.12], [-0.9, -0.06], [-0.86, -0.4], [-0.34, -0.46],
  [-0.44, -0.54], [-0.52, -0.8],
]);
/* A crest, not a cap. Iteration 1 let the wings overhang the helmet and the
   horizontal underside instantly became a peaked cap brim — the exact
   silliness the rejection named. R1 keeps every vertex INSIDE the helmet
   contour, so this is the helmet's own pointed upper shell. */
const CREST = poly([
  [0, -1.09], [0.32, -0.96], [0.48, -0.8], [0.44, -0.7],
  [-0.44, -0.7], [-0.48, -0.8], [-0.32, -0.96],
]);
/* Leg + boot in one contour, hip to toe — 0.58r of dark below the hull. The
   P1 boots were 0.06r chips glued to the egg's underside. */
function boot(c, r, s) {
  c.beginPath();
  c.moveTo(s * r * 0.08, r * 0.42);
  c.lineTo(s * r * 0.44, r * 0.42);
  c.lineTo(s * r * 0.46, r * 0.88);
  c.lineTo(s * r * 0.56, r * 1.06);
  c.lineTo(s * r * 0.1, r * 1.06);
  c.closePath();
  c.fill();
}
export function drawPlayerBody(c, world, p) {
  const r = CFG.TILE * 0.36,
    col = p.color || "#37f0d0";
  const moving = !!(p.face.x || p.face.y) && p.iFrames <= 0;
  const bob = moving
    ? Math.sin(p.walk * 18) * 1.8
    : Math.sin(world.time * 4) * 1.0;
  c.translate(0, bob);
  if (p.iFrames > 0 && Math.floor(p.iFrames * 12) % 2) c.globalAlpha = 0.4;
  c.fillStyle = "rgba(0,0,0,0.34)";
  c.beginPath();
  c.ellipse(0, r * 1.0, r * 0.6, r * 0.18, 0, 0, 7);
  c.fill();
  S_RUNNER(c, r, 1, 0, 0);
  c.fillStyle = dk(HULL, 0.56);
  c.fill();
  seal(c);
  S_RUNNER(c, r, 0.8, 0, -r * 0.09);
  c.fillStyle = HULL;
  c.fill();
  /* Beat 4 — hard armour facets, not a soft sheen: the two pauldron TOP
     plates, which is what actually draws the shoulder ledge at this size.
     Both sit inside the k=0.8 inset so the dark contour stays unbroken. Two
     subpaths, one fill: still one beat. */
  c.fillStyle = lt(HULL, 0.42);
  c.beginPath();
  c.moveTo(-r * 0.7, -r * 0.38);
  c.lineTo(-r * 0.36, -r * 0.42);
  c.lineTo(-r * 0.32, -r * 0.24);
  c.lineTo(-r * 0.66, -r * 0.2);
  c.closePath();
  c.moveTo(r * 0.36, -r * 0.42);
  c.lineTo(r * 0.7, -r * 0.38);
  c.lineTo(r * 0.66, -r * 0.2);
  c.lineTo(r * 0.32, -r * 0.24);
  c.closePath();
  c.fill();
  const fx = Math.max(-1, Math.min(1, p.face.x || 0)) * r * 0.1;
  CREST(c, r, 1, 0, 0);
  c.fillStyle = col;
  c.fill();
  seal(c);
  if (p.face.y < -0.5) {
    c.fillStyle = dk(HULL, 0.34);
    c.beginPath();
    c.moveTo(-r * 0.42, -r * 0.68);
    c.lineTo(r * 0.42, -r * 0.68);
    c.lineTo(r * 0.36, -r * 0.5);
    c.lineTo(-r * 0.36, -r * 0.5);
    c.closePath();
    c.fill();
    c.fillStyle = dk(HULL, 0.62);
    c.beginPath();
    c.moveTo(-r * 0.24, -r * 0.28);
    c.lineTo(r * 0.24, -r * 0.28);
    c.lineTo(r * 0.2, r * 0.16);
    c.lineTo(-r * 0.2, r * 0.16);
    c.closePath();
    c.fill();
  } else {
    /* The visor is a SLIT: a deep near-black well, a hairline lit core and
       one white pip. R1 halves the core bar — against a mid-value hull a fat
       cyan band was the second bright element and read as a cartoon eye. */
    c.fillStyle = "#0b1020";
    c.beginPath();
    c.moveTo(-r * 0.42 + fx, -r * 0.68);
    c.lineTo(r * 0.42 + fx, -r * 0.68);
    c.lineTo(r * 0.36 + fx, -r * 0.48);
    c.lineTo(-r * 0.36 + fx, -r * 0.48);
    c.closePath();
    c.fill();
    c.fillStyle = "#7fe0ff";
    c.beginPath();
    c.moveTo(-r * 0.32 + fx, -r * 0.63);
    c.lineTo(r * 0.32 + fx, -r * 0.63);
    c.lineTo(r * 0.31 + fx, -r * 0.54);
    c.lineTo(-r * 0.31 + fx, -r * 0.54);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(-r * 0.36 + fx, -r * 0.66);
    c.lineTo(-r * 0.24 + fx, -r * 0.66);
    c.lineTo(-r * 0.27 + fx, -r * 0.58);
    c.lineTo(-r * 0.39 + fx, -r * 0.58);
    c.closePath();
    c.fill();
  }
  c.fillStyle = p.kick ? "#c07a3a" : "#0d3f78";
  boot(c, r, -1);
  boot(c, r, 1);
  if (p.shield) {
    c.strokeStyle = "#6fb7ff";
    c.lineWidth = 2.5;
    c.globalAlpha = 0.7;
    c.beginPath();
    c.arc(0, 0, r * 1.4, 0, 7);
    c.stroke();
    c.globalAlpha = 1;
  }
  if (p.kick) {
    c.fillStyle = "#c07a3a";
    rr(c, -r * 0.86, r * 0.7, r * 0.34, r * 0.36, 2);
    c.fill();
    rr(c, r * 0.52, r * 0.7, r * 0.34, r * 0.36, 2);
    c.fill();
  }
  if (p.passing) {
    c.strokeStyle = "rgba(119,255,153,0.6)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, r * 1.25, 0, 7);
    c.stroke();
  }
}
export function drawPlayer(c, world) {
  for (const p of world.players) {
    if (p.alive === false) continue;
    c.save();
    c.translate(p.x, p.y);
    drawPlayerBody(c, world, p);
    c.restore();
  }
}
export function drawBombBody(c, world, bm) {
  const fuse = world && world.fuse != null ? world.fuse : CFG.FUSE;
  const t = 1 - Math.max(0, bm.timer) / fuse;
  const pulse = 1 + Math.sin(world.time * 18) * 0.1 * t;
  c.scale(pulse, pulse);
  const r = CFG.TILE * 0.3;
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.beginPath();
  c.ellipse(0, r * 0.98, r * 0.8, r * 0.25, 0, 0, 7);
  c.fill();
  c.fillStyle = "#15181f";
  c.beginPath();
  c.arc(0, r * 0.08, r, 0, 7);
  c.fill();
  c.strokeStyle = "#0a0d14";
  c.lineWidth = 1.75;
  c.beginPath();
  c.arc(0, r * 0.08, r, 0, 7);
  c.stroke();
  if (bm.variant === "power") {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283;
      c.fillStyle = "#0a0d14";
      c.beginPath();
      c.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      c.lineTo(Math.cos(a + 0.14) * r * 1.25, Math.sin(a + 0.14) * r * 1.25);
      c.lineTo(Math.cos(a - 0.14) * r * 1.25, Math.sin(a - 0.14) * r * 1.25);
      c.fill();
    }
  } else if (bm.variant === "pierce") {
    c.strokeStyle = "#8f8fff";
    c.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283 + world.time * 3;
      c.beginPath();
      c.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      c.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35);
      c.stroke();
    }
  }
  c.fillStyle = "rgba(255,255,255,0.45)";
  c.beginPath();
  c.arc(-r * 0.3, -r * 0.18, r * 0.26, 0, 7);
  c.fill();
  c.strokeStyle = "#fff";
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(-r * 0.28, r * 0.08);
  c.lineTo(r * 0.28, r * 0.08);
  c.moveTo(0, -r * 0.2);
  c.lineTo(0, r * 0.36);
  c.stroke();
  c.strokeStyle = "#ff9d5a";
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(r * 0.22, -r * 0.62);
  c.quadraticCurveTo(r * 0.48, -r * 0.95, r * 0.58, -r * 1.22);
  c.stroke();
  c.fillStyle = Math.floor(world.time * 14) % 2 ? "#ff5d73" : "#ffd447";
  c.beginPath();
  c.arc(r * 0.6, -r * 1.26, r * 0.13 + Math.sin(world.time * 30) * 0.03, 0, 7);
  c.fill();
  if (bm.variant === "line") {
    c.fillStyle = "#15181f";
    for (let i = -1; i <= 1; i++) {
      if (i === 0) continue;
      c.beginPath();
      c.arc(i * r * 0.9, r * 0.08, r * 0.5, 0, 7);
      c.fill();
    }
  }
}
export function drawBombs(c, world) {
  for (const bm of world.bombs) {
    c.save();
    c.translate(bm.x, bm.y);
    drawBombBody(c, world, bm);
    c.restore();
  }
}
/* drawBladeBody draws one blade tile at origin; positioning stays in the
   drawBlades wrapper so bodies stay translate-free. */
export function drawBladeBody(c, world, bl, t) {
  const age = bl.t / bl.ttl;
  const s = CFG.TILE * 0.92,
    h = s / 2,
    core = s * 0.42;
  const fill = age < 0.3 ? "#fff3b0" : age < 0.7 ? "#ffb347" : "#ff5d73";
  c.save();
  c.globalAlpha = Math.max(0, 1 - age);
  c.fillStyle = fill;
  rr(c, -h, -h, s, s, 6);
  c.fill();
  c.strokeStyle = "#0a0d14";
  c.lineWidth = 1.75;
  rr(c, -h, -h, s, s, 6);
  c.stroke();
  c.fillStyle = age < 0.7 ? "#ffffff" : "#fff3b0";
  rr(c, -core / 2, -core / 2, core, core, 4);
  c.fill();
  c.restore();
}
export function stampBombIcon(c) {
  c.save();
  drawIcon(c, "bomb", "#ff5d73", 0);
  c.restore();
}
export function paintBombPad(el) {
  if (!el) return false;
  let cv = el.querySelector("canvas");
  if (!cv) {
    if (typeof document === "undefined") return false;
    cv = document.createElement("canvas");
    cv.setAttribute("aria-hidden", "true");
    el.appendChild(cv);
  }
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext && cv.getContext("2d");
  if (!ctx) return false;
  ctx.clearRect(0, 0, 64, 64);
  ctx.save();
  ctx.translate(32, 36);
  ctx.scale(1.4, 1.4);
  stampBombIcon(ctx);
  ctx.restore();
  return true;
}
export function drawBlades(c, world) {
  for (const bl of world.blades) {
    for (const t of bl.tiles) {
      c.save();
      c.translate(
        t.tx * CFG.TILE + CFG.TILE / 2,
        t.ty * CFG.TILE + CFG.TILE / 2,
      );
      drawBladeBody(c, world, bl, t);
      c.restore();
    }
    c.globalAlpha = 1;
  }
}
