import { CFG, T, key, biomeOf, BIOMES } from "../core/config.js";

/* RENDER LAYER — reads world, never mutates it. Every draw fn takes a 2D
   context as its first argument (no global ctx) and is a pure function of
   (world, time). Sprites are BAKED to offscreen canvases once (if the browser
   can make canvases); otherwise we fall back to the identical vector draws so
   headless/non-DOM contexts still render. */

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
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

/* ---- items / power-up icons (cabinet glyphs, readable at 40px) ---- */
export function drawIcon(c, type, col, time) {
  c.save();
  c.lineWidth = 2;
  c.strokeStyle = "rgba(0,0,0,0.55)";
  c.lineJoin = "round";
  c.lineCap = "round";
  c.fillStyle = col;
  const s = CFG.TILE * 0.3;
  const st = () => c.stroke();
  switch (type) {
    case "fire":
      c.beginPath();
      c.moveTo(0, -s * 1.05);
      c.quadraticCurveTo(s * 0.88, -s * 0.12, s * 0.55, s * 0.78);
      c.quadraticCurveTo(s * 0.12, s * 0.32, 0, s * 0.88);
      c.quadraticCurveTo(-s * 0.12, s * 0.32, -s * 0.55, s * 0.78);
      c.quadraticCurveTo(-s * 0.88, -s * 0.12, 0, -s * 1.05);
      c.fill();
      st();
      c.fillStyle = "#ffd447";
      c.beginPath();
      c.moveTo(0, -s * 0.28);
      c.quadraticCurveTo(s * 0.32, s * 0.28, 0, s * 0.58);
      c.quadraticCurveTo(-s * 0.32, s * 0.28, 0, -s * 0.28);
      c.fill();
      c.fillStyle = "#fff3b0";
      c.beginPath();
      c.arc(s * 0.4, -s * 0.52, s * 0.1, 0, 7);
      c.fill();
      break;
    case "bomb":
      c.beginPath();
      c.arc(0, s * 0.14, s * 0.7, 0, 7);
      c.fill();
      st();
      c.strokeStyle = col;
      c.beginPath();
      c.moveTo(s * 0.18, -s * 0.46);
      c.quadraticCurveTo(s * 0.42, -s * 0.72, s * 0.52, -s * 0.95);
      c.stroke();
      c.fillStyle = "#ffd447";
      c.beginPath();
      c.arc(s * 0.55, -s * 0.98, s * 0.14, 0, 7);
      c.fill();
      c.strokeStyle = "#fff";
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(-s * 0.22, s * 0.14);
      c.lineTo(s * 0.22, s * 0.14);
      c.moveTo(0, -s * 0.08);
      c.lineTo(0, s * 0.36);
      c.stroke();
      break;
    case "speed":
      c.beginPath();
      c.moveTo(s * 0.18, -s);
      c.lineTo(-s * 0.55, s * 0.04);
      c.lineTo(-s * 0.04, s * 0.04);
      c.lineTo(-s * 0.22, s);
      c.lineTo(s * 0.62, -s * 0.06);
      c.lineTo(s * 0.1, -s * 0.06);
      c.closePath();
      c.fill();
      st();
      c.strokeStyle = "#cfe6ff";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(s * 0.04, -s * 0.68);
      c.lineTo(-s * 0.26, -s * 0.02);
      c.stroke();
      break;
    case "heart":
      c.beginPath();
      c.moveTo(0, s * 0.72);
      c.bezierCurveTo(-s * 1.05, -s * 0.04, -s * 0.42, -s * 1.02, 0, -s * 0.26);
      c.bezierCurveTo(s * 0.42, -s * 1.02, s * 1.05, -s * 0.04, 0, s * 0.72);
      c.fill();
      st();
      c.fillStyle = "rgba(255,255,255,0.55)";
      c.beginPath();
      c.arc(-s * 0.22, -s * 0.16, s * 0.14, 0, 7);
      c.fill();
      break;
    case "shield":
      c.beginPath();
      c.moveTo(0, -s);
      c.lineTo(s * 0.82, -s * 0.55);
      c.lineTo(s * 0.72, s * 0.28);
      c.quadraticCurveTo(s * 0.48, s * 0.72, 0, s);
      c.quadraticCurveTo(-s * 0.48, s * 0.72, -s * 0.72, s * 0.28);
      c.lineTo(-s * 0.82, -s * 0.55);
      c.closePath();
      c.fill();
      st();
      c.strokeStyle = "#0d3f78";
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(0, -s * 0.42);
      c.lineTo(s * 0.3, -s * 0.04);
      c.lineTo(0, s * 0.4);
      c.lineTo(-s * 0.3, -s * 0.04);
      c.closePath();
      c.stroke();
      break;
    case "kick":
      c.beginPath();
      c.moveTo(-s * 0.12, -s * 0.78);
      c.lineTo(s * 0.3, -s * 0.78);
      c.lineTo(s * 0.34, s * 0.12);
      c.lineTo(s * 0.88, s * 0.26);
      c.lineTo(s * 0.88, s * 0.64);
      c.lineTo(-s * 0.2, s * 0.64);
      c.closePath();
      c.fill();
      st();
      c.fillStyle = "#8a5326";
      c.fillRect(-s * 0.2, s * 0.48, s * 1.08, s * 0.16);
      c.strokeStyle = "#ffce8a";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-s * 0.88, -s * 0.12);
      c.lineTo(-s * 0.42, 0);
      c.lineTo(-s * 0.88, s * 0.12);
      c.stroke();
      break;
    case "throw":
      c.strokeStyle = col;
      c.lineWidth = s * 0.2;
      c.beginPath();
      c.arc(-s * 0.08, s * 0.42, s * 0.88, Math.PI * 1.12, Math.PI * 1.85);
      c.stroke();
      c.fillStyle = col;
      c.beginPath();
      c.arc(s * 0.7, -s * 0.38, s * 0.3, 0, 7);
      c.fill();
      c.strokeStyle = "rgba(0,0,0,0.55)";
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = "#ffd447";
      c.beginPath();
      c.arc(s * 0.8, -s * 0.55, s * 0.1, 0, 7);
      c.fill();
      break;
    case "pass":
      c.strokeStyle = col;
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(-s * 0.55, -s * 0.55);
      c.lineTo(s * 0.55, -s * 0.55);
      c.stroke();
      c.beginPath();
      c.moveTo(-s * 0.55, s * 0.55);
      c.lineTo(s * 0.55, s * 0.55);
      c.stroke();
      c.beginPath();
      c.moveTo(-s * 0.7, -s * 0.32);
      c.lineTo(-s * 0.7, s * 0.32);
      c.stroke();
      c.beginPath();
      c.moveTo(s * 0.7, -s * 0.32);
      c.lineTo(s * 0.7, s * 0.32);
      c.stroke();
      c.lineWidth = s * 0.2;
      c.beginPath();
      c.moveTo(-s * 0.78, 0);
      c.lineTo(s * 0.32, 0);
      c.stroke();
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(s * 0.22, -s * 0.3);
      c.lineTo(s * 0.85, 0);
      c.lineTo(s * 0.22, s * 0.3);
      c.closePath();
      c.fill();
      break;
    case "line":
      c.strokeStyle = col;
      c.lineWidth = s * 0.26;
      c.beginPath();
      c.moveTo(-s, 0);
      c.lineTo(s * 0.32, 0);
      c.stroke();
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(s * 0.18, -s * 0.4);
      c.lineTo(s * 1.05, 0);
      c.lineTo(s * 0.18, s * 0.4);
      c.closePath();
      c.fill();
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-s * 0.55, -s * 0.38);
      c.lineTo(-s * 0.28, -s * 0.38);
      c.moveTo(-s * 0.08, -s * 0.38);
      c.lineTo(s * 0.18, -s * 0.38);
      c.stroke();
      break;
    case "power":
      c.beginPath();
      c.moveTo(0, -s * 1.05);
      c.lineTo(s * 0.22, -s * 0.22);
      c.lineTo(s * 1.05, 0);
      c.lineTo(s * 0.22, s * 0.22);
      c.lineTo(0, s * 1.05);
      c.lineTo(-s * 0.22, s * 0.22);
      c.lineTo(-s * 1.05, 0);
      c.lineTo(-s * 0.22, -s * 0.22);
      c.closePath();
      c.fill();
      st();
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(0, 0, s * 0.16, 0, 7);
      c.fill();
      break;
    case "pierce":
      c.fillStyle = "#12203a";
      c.fillRect(-s * 0.88, -s * 0.72, s * 0.28, s * 0.48);
      c.fillRect(-s * 0.88, s * 0.24, s * 0.28, s * 0.48);
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(-s * 0.98, -s * 0.14);
      c.lineTo(s * 0.22, -s * 0.14);
      c.lineTo(s * 0.22, -s * 0.4);
      c.lineTo(s * 0.98, 0);
      c.lineTo(s * 0.22, s * 0.4);
      c.lineTo(s * 0.22, s * 0.14);
      c.lineTo(-s * 0.98, s * 0.14);
      c.closePath();
      c.fill();
      st();
      break;
    case "remote":
      c.fillStyle = col;
      rr(c, -s * 0.55, s * 0.08, s * 1.1, s * 0.68, 3);
      c.fill();
      st();
      c.fillStyle = "#3a4256";
      rr(c, -s * 0.34, s * 0.22, s * 0.68, s * 0.38, 2);
      c.fill();
      c.fillStyle = col;
      c.fillRect(-s * 0.1, -s * 0.52, s * 0.2, s * 0.64);
      c.fillRect(-s * 0.42, -s * 0.75, s * 0.84, s * 0.22);
      c.fillStyle = "#ff5d73";
      c.beginPath();
      c.arc(s * 0.28, s * 0.4, s * 0.1, 0, 7);
      c.fill();
      break;
  }
  c.restore();
}
export function drawItemBody(c, world, it) {
  const pulse = 1 + Math.sin(world.time * 5) * 0.1;
  c.scale(pulse, pulse);
  c.fillStyle = "rgba(8,12,24,0.92)";
  c.beginPath();
  c.arc(0, 0, CFG.TILE * 0.34, 0, 7);
  c.fill();
  c.strokeStyle = it.col || "rgba(255,255,255,0.25)";
  c.lineWidth = 2;
  c.globalAlpha = 0.85;
  c.beginPath();
  c.arc(0, 0, CFG.TILE * 0.34, 0, 7);
  c.stroke();
  c.globalAlpha = 0.22;
  c.beginPath();
  c.arc(0, 0, CFG.TILE * 0.42, 0, 7);
  c.stroke();
  c.globalAlpha = 1;
  drawIcon(c, it.t, it.col, world.time);
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
export function drawEnemyBody(c, world, e) {
  const r = e.r;
  if (e.type === "stationary") {
    const s = 1 + Math.sin(world.time * 3) * 0.06;
    c.scale(s, s);
    c.fillStyle = "#2a1030";
    rr(c, -r * 0.75, -r * 0.75, r * 1.5, r * 1.5, 6);
    c.fill();
    c.fillStyle = e.color;
    rr(c, -r * 0.55, -r * 0.55, r * 1.1, r * 1.1, 5);
    c.fill();
    c.fillStyle = "#150a1c";
    c.fillRect(-r * 0.35, -r * 0.1, r * 0.7, r * 0.18);
  } else if (e.type === "rocket") {
    c.fillStyle = "#3a1c10";
    rr(c, -r * 0.55, r * 0.1, r * 1.1, r * 0.7, 4);
    c.fill();
    c.fillStyle = e.color;
    c.beginPath();
    c.moveTo(0, -r);
    c.lineTo(r * 0.8, r * 0.4);
    c.lineTo(-r * 0.8, r * 0.4);
    c.closePath();
    c.fill();
    c.fillStyle = Math.floor(world.time * 10) % 2 ? "#ffde7a" : "#ff7a3a";
    c.beginPath();
    c.arc(0, r * 0.6, r * 0.2 + Math.sin(world.time * 20) * 0.03, 0, 7);
    c.fill();
  } else if (e.type === "boomerang") {
    c.save();
    c.rotate(world.time * 10);
    c.strokeStyle = e.color;
    c.lineWidth = r * 0.34;
    c.lineCap = "round";
    c.beginPath();
    c.arc(0, 0, r * 0.7, 0, Math.PI * 1.5);
    c.stroke();
    c.restore();
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(0, 0, r * 0.2, 0, 7);
    c.fill();
  } else {
    const fling = Math.sin(world.time * 14 + e.home.x) > 0;
    c.fillStyle = e.color;
    c.beginPath();
    c.arc(0, 0, r, 0, 7);
    c.fill();
    c.strokeStyle = "#0a0d14";
    c.lineWidth = 1.75;
    c.beginPath();
    c.arc(0, 0, r, 0, 7);
    c.stroke();
    if (e.type === "chaser") {
      c.fillStyle = e.color;
      c.beginPath();
      c.moveTo(-r * 0.28, -r * 0.72);
      c.lineTo(0, -r * 1.28);
      c.lineTo(r * 0.28, -r * 0.72);
      c.closePath();
      c.fill();
      c.strokeStyle = "#0a0d14";
      c.lineWidth = 2;
      c.stroke();
    }
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.beginPath();
    c.arc(-r * 0.32, -r * 0.36, r * 0.3, 0, 7);
    c.fill();
    c.fillStyle = "#0a0f1a";
    c.beginPath();
    c.arc(-r * 0.32, -r * 0.08, fling ? r * 0.22 : r * 0.18, 0, 7);
    c.fill();
    c.beginPath();
    c.arc(r * 0.32, -r * 0.08, fling ? r * 0.18 : r * 0.22, 0, 7);
    c.fill();
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(-r * 0.26, -r * 0.14, r * 0.07, 0, 7);
    c.fill();
    c.beginPath();
    c.arc(r * 0.38, -r * 0.14, r * 0.07, 0, 7);
    c.fill();
    c.fillStyle = "#0a0f1a";
    c.fillRect(-r * 0.5, fling ? r * 0.75 : r * 0.8, r * 0.34, r * 0.24);
    c.fillRect(r * 0.16, fling ? r * 0.8 : r * 0.75, r * 0.34, r * 0.24);
    if (e.type === "fast") {
      c.fillStyle = "rgba(255,210,71,0.5)";
      for (let i = 1; i <= 3; i++)
        c.fillRect(-r * 1.1 - i * 3, -r * 0.1 + i * 0.05, r * 0.5, r * 0.12);
    }
  }
  if (e.invuln && Math.floor(world.time * 12) % 2) c.globalAlpha = 0.5;
}
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
export function drawPlayerBody(c, world, p) {
  const r = CFG.TILE * 0.36,
    col = p.color || "#37f0d0";
  const moving = !!(p.face.x || p.face.y) && p.iFrames <= 0;
  const bob = moving
    ? Math.sin(p.walk * 18) * 1.8
    : Math.sin(world.time * 4) * 1.0;
  c.translate(0, bob);
  if (p.iFrames > 0 && Math.floor(p.iFrames * 12) % 2) c.globalAlpha = 0.4;
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.beginPath();
  c.ellipse(0, r * 1.0, r * 0.7, r * 0.22, 0, 0, 7);
  c.fill();
  c.fillStyle = col;
  rr(c, -r * 0.7, r * 0.05, r * 1.4, r * 0.95, 7);
  c.fill();
  c.strokeStyle = "#0a0d14";
  c.lineWidth = 1.75;
  rr(c, -r * 0.7, r * 0.05, r * 1.4, r * 0.95, 7);
  c.stroke();
  c.fillStyle = "rgba(255,255,255,0.25)";
  rr(c, -r * 0.6, r * 0.13, r * 1.2, r * 0.3, 4);
  c.fill();
  c.fillStyle = "#0d3f78";
  rr(c, -r * 0.7, r * 0.75, r * 1.4, r * 0.3, 4);
  c.fill();
  c.fillStyle = "#f4f7ff";
  rr(c, -r * 0.85, -r * 0.95, r * 1.7, r * 1.35, 9);
  c.fill();
  c.strokeStyle = "#0a0d14";
  c.lineWidth = 1.75;
  rr(c, -r * 0.85, -r * 0.95, r * 1.7, r * 1.35, 9);
  c.stroke();
  c.fillStyle = col;
  rr(c, -r * 0.78, -r * 0.95, r * 1.56, r * 0.52, 8);
  c.fill();
  c.strokeStyle = "#0a0d14";
  c.lineWidth = 1.5;
  rr(c, -r * 0.78, -r * 0.95, r * 1.56, r * 0.52, 8);
  c.stroke();
  c.strokeStyle = "#0a0d14";
  c.lineWidth = 2;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(0, -r * 0.95);
  c.lineTo(0, -r * 1.38);
  c.stroke();
  c.fillStyle = "#ff5d73";
  c.beginPath();
  c.arc(0, -r * 1.42, r * 0.11, 0, 7);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.6)";
  rr(c, -r * 0.6, -r * 0.85, r * 0.6, r * 0.25, 4);
  c.fill();
  c.fillStyle = "#0b1020";
  rr(c, -r * 0.62, -r * 0.5, r * 1.24, r * 0.45, 4);
  c.fill();
  const ex = p.face.x < 0 ? -r * 0.05 : p.face.x > 0 ? r * 0.05 : 0;
  c.fillStyle = "#7fe0ff";
  c.beginPath();
  c.arc(-r * 0.24 + ex, -r * 0.28, r * 0.14, 0, 7);
  c.fill();
  c.beginPath();
  c.arc(r * 0.28 + ex, -r * 0.28, r * 0.14, 0, 7);
  c.fill();
  c.fillStyle = "#08131f";
  c.beginPath();
  c.arc(-r * 0.2 + ex, -r * 0.3, r * 0.06, 0, 7);
  c.fill();
  c.beginPath();
  c.arc(r * 0.32 + ex, -r * 0.3, r * 0.06, 0, 7);
  c.fill();
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
    rr(c, -r * 0.9, r * 0.75, r * 0.44, r * 0.45, 2);
    c.fill();
    rr(c, r * 0.46, r * 0.75, r * 0.44, r * 0.45, 2);
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
  c.ellipse(0, r * 0.9, r * 0.8, r * 0.25, 0, 0, 7);
  c.fill();
  c.fillStyle = "#15181f";
  c.beginPath();
  c.arc(0, 0, r, 0, 7);
  c.fill();
  c.strokeStyle = "#0a0d14";
  c.lineWidth = 1.75;
  c.beginPath();
  c.arc(0, 0, r, 0, 7);
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
  c.arc(-r * 0.32, -r * 0.32, r * 0.3, 0, 7);
  c.fill();
  c.fillStyle = "#0a0d14";
  c.fillRect(-r * 0.18, -r * 1.05, r * 0.36, r * 0.5);
  c.strokeStyle = "#ff9d5a";
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(0, -r * 0.95);
  c.lineTo(0, -r * 1.2);
  c.stroke();
  c.fillStyle = Math.floor(world.time * 14) % 2 ? "#ff5d73" : "#ffd447";
  c.beginPath();
  c.arc(0, -r * 1.24, r * 0.13 + Math.sin(world.time * 30) * 0.03, 0, 7);
  c.fill();
  if (bm.variant === "line") {
    c.fillStyle = "#15181f";
    for (let i = -1; i <= 1; i++) {
      if (i === 0) continue;
      c.beginPath();
      c.arc(i * r * 0.9, 0, r * 0.5, 0, 7);
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
