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
/* MAKO — the reef critter. 2026-09-06, on the user's veto of every humanoid
   hero ("the main character also must not be like a human, it must be a
   creative character like [the genre classic]"). An art-direction round put
   three non-human concepts on all eight floors beside a real WALKER and
   recommended this one; the ruling was to build it with two tweaks — a
   PLAYFUL grin instead of the concept's two pointed fangs, and a LIGHTER
   body value so it pops on VOID's purple. Signal Runner and IONVEST are
   superseded; their commits stay in history.

   Species: an animal, and the only member of the cast with a real mouth.
   Head and body are ONE mass — no shoulders, no torso-over-legs, no arms,
   which is what made all three previous heroes read as a person in armour.

   THE HOOK is a pair of swept teal ear-fins whose tips run past the body's
   own half-width, so the outline is a broad CHEVRON. That is the one shape
   class nothing in the enemy cast has (every foe is a dome or a box), and at
   the frozen 59.1 deg rig the plan-view footprint is the primary read, so
   the same hook carries both renderers. Fin tips stop at 1.30r = 18.7px
   against the 20px tile half-width; the walk-flick rotation adds 0.2px and
   the fit gate cannot see it, which is why the static number leaves room.

   THE FACE is two bulging cream eyes that BREAK the crown of the silhouette
   — an outline cue no dome-headed foe has, and the largest, highest-contrast
   facial feature in the game at 1:1 — over a wide ink grin. Pupils track
   `face.x` inside fixed eyes, so facing costs no geometry.

   THE VALUE. The concept base was #9a4ff0 (L .418). That collides with VOID,
   which is a violet room: `wallHi` #8a70b0 is L .479 and the brick highlight
   the player actually stands beside is `brickHi` composited at alpha 0.55
   over `brickA` = #a266e6, L .486 — i.e. the naive reading of "lift the
   value" walks straight into the brick. Clearing both by dL 0.12 in-family
   means L >= .606, and #c39cff (L .672, chroma .388, hue 263.6 — 4.4 deg
   from the concept base) is the value that also maximises the Lab distance
   to VOID's brick face (55.0 dE) while holding the chroma floor.
   DISCLOSED: no hex in this family also clears the `stationary` foe's light
   violet #c58aff on value AND hue while staying chromatic (the window is
   L <= .359, which is invisible on VOID, or L >= .752, which is pastel).
   Separation from the CAST is AGENTS.md's standing rule — structure, never a
   re-hue — and a finned chevron with two cream eyes and a grin is not a dark
   square bunker with a magenta slit. */
export const PLAYER_SUIT = "#c39cff";
/* 2D and 3D diverged for exactly one round — IONVEST's orchid against the
   gunmetal Signal Runner — because gunmetal vanished into FACTORY's wall in
   2D and was still correct in 3D, which has no dark contour. MAKO retires
   that split: one character, one body hex, both renderers. The name survives
   only because three/entities.js imports it; do not give it a second value. */
export const PLAYER_HULL = PLAYER_SUIT;
const HULL = PLAYER_SUIT;
const EYE = "#f2e6d2",
  INK = "#12121e",
  FOOT_COL = "#2e1a4e";
/* Low and wide: the widest slice is at the flanks, not at a shoulder line,
   and the mass is 1.8r tall against 1.96r across before the fins. Quadratics
   only — the zero-arc rule holds, and the two ellipse families on this body
   (contact shade, eyes) are deliberate exceptions the gates name. */
const BODY = poly([
  [0, -0.74],
  [0.5, -0.56, 0.3, -0.78],
  [0.88, -0.02, 0.84, -0.32],
  [0.9, 0.32, 0.98, 0.12],
  [0.46, 0.64, 0.8, 0.58],
  [-0.46, 0.64, 0, 0.8],
  [-0.9, 0.32, -0.8, 0.58],
  [-0.88, -0.02, -0.98, 0.12],
  [-0.5, -0.56, -0.84, -0.32],
  [0, -0.74, -0.3, -0.78],
]);
/* Swept BLADES, not round paddles, and BOTH in one path so the pair is one
   fillStyle write — the one-placement rule counts placements, and two poly()
   calls would also discard the first blade, since poly() opens its own path. */
function fins(c, r) {
  /* Iteration 1 rooted the blade at y -0.42 and it landed BEHIND the eyes:
     the eye lids cover x 0.10..0.82 and the body covers out to 0.98, so only
     0.32r of blade ever cleared the silhouette and the pair read as
     earmuffs. The root drops below the eye line instead and the blade sweeps
     up-and-out, so it is outside the body across most of its height — a
     blade, and the chevron the whole concept rests on.
     Iteration 2 cleared the body but the blade was a 4.8px sliver hugging the
     flank. The tip now rises to -0.84r, level with the eye tops and ABOVE the
     body's own crown, so the fin is part of the outline rather than a
     marking beside it, and the outer edge sits at the 1.30r ceiling through
     the whole of its height instead of only at one vertex. */
  const P = [
    [0.48, 0.38], [0.62, -0.36], [0.96, -0.84], [1.3, -0.46], [1.2, 0.12], [0.84, 0.44],
  ];
  c.beginPath();
  for (const s of [-1, 1]) {
    for (let i = 0; i < P.length; i++) {
      const x = s * P[i][0] * r,
        y = P[i][1] * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
  }
}
/* Two stubby feet, one path, one fill. Not legs: MAKO sits low on the floor,
   and 0.44r of dark under a wide mass is grounding, not stance. */
function feet(c, r) {
  const P = [[0.16, 0.48], [0.62, 0.5], [0.7, 0.92], [0.2, 0.92]];
  c.beginPath();
  for (const s of [-1, 1]) {
    for (let i = 0; i < P.length; i++) {
      const x = s * P[i][0] * r,
        y = P[i][1] * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
  }
}
/* The grin. Corners sit 0.13r HIGHER than the centre of the upper lip, which
   is what makes a wide dark shape read as a smile rather than a maw at 29px. */
const GRIN = poly([
  [-0.44, 0.02],
  [-0.16, 0.15, -0.32, 0.12],
  [0.16, 0.15, 0, 0.2],
  [0.44, 0.02, 0.32, 0.12],
  [0.3, 0.3, 0.44, 0.2],
  [0, 0.44, 0.18, 0.44],
  [-0.3, 0.3, -0.18, 0.44],
  [-0.44, 0.02, -0.44, 0.2],
]);
/* THE TWEAK: the concept hung two pointed fangs off the upper lip and read
   as a small predator. Two blunt front teeth instead — same beat, same one
   fill, and the character reads as a cheeky hero rather than a monster. */
function teeth(c, r) {
  c.beginPath();
  for (const s of [-1, 1]) {
    c.moveTo(s * 0.04 * r, 0.16 * r);
    c.lineTo(s * 0.2 * r, 0.135 * r);
    c.lineTo(s * 0.22 * r, 0.28 * r);
    c.lineTo(s * 0.06 * r, 0.305 * r);
    c.closePath();
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
  /* Beat 1 — contact shade, widened to the body it belongs to. */
  c.fillStyle = "rgba(0,0,0,0.34)";
  c.beginPath();
  c.ellipse(0, r * 0.96, r * 0.68, r * 0.18, 0, 0, 7);
  c.fill();
  /* Feet and fins go down FIRST so the body's own contour and seal cap their
     roots and the whole thing reads as one animal rather than a kit of parts.
     That also means the body contour is no longer the second beginPath —
     the gates find parts by fill, never by index. */
  c.fillStyle = p.kick ? "#c07a3a" : FOOT_COL;
  feet(c, r);
  c.fill();
  seal(c);
  /* HOOK — the ear-fins, and the only p.color on the character. They flick
     against the walk bob, which is what sells an animal over a costume. */
  c.save();
  c.rotate(Math.sin(world.time * 6) * 0.03);
  fins(c, r);
  c.fillStyle = col;
  c.fill();
  seal(c);
  c.restore();
  /* Beats 2+3 — dark form and seal, then the lit body inset and lifted so
     the leftover crescent underneath is the form shadow. */
  BODY(c, r, 1, 0, 0);
  c.fillStyle = dk(HULL, 0.56);
  c.fill();
  seal(c);
  BODY(c, r, 0.82, 0, -r * 0.07);
  c.fillStyle = HULL;
  c.fill();
  /* Beat 4 — one hard facet on the lit flank. Held to lt(HULL,0.2), not the
     0.42 the gunmetal hull used: at L .672 a 0.42 lift lands near L .77 and
     starts competing with the cream eyes, and the eyes being the brightest
     field on the character is the entire readability case for this concept.
     Placed on the lower-left FLANK, not the crown: the eye lids own the whole
     upper body (x 0.10..0.82, y -0.85..-0.15), so iteration 1's crown facet
     was painted and then covered. Every vertex stays inside the k=0.82 inset
     so the dark contour band is never broken. */
  c.fillStyle = lt(HULL, 0.2);
  c.beginPath();
  c.moveTo(-r * 0.68, 0);
  c.lineTo(-r * 0.46, -r * 0.18);
  c.lineTo(-r * 0.3, r * 0.04);
  c.lineTo(-r * 0.54, r * 0.26);
  c.closePath();
  c.fill();
  const fx = Math.max(-1, Math.min(1, p.face.x || 0)) * r * 0.1;
  if (p.face.y < -0.5) {
    /* Walking away: a dark dorsal panel and a gill slot, no face at all. The
       fins still flag the outline, so the hero stays identifiable from behind. */
    c.fillStyle = dk(HULL, 0.34);
    c.beginPath();
    c.moveTo(-r * 0.44, -r * 0.34);
    c.lineTo(r * 0.44, -r * 0.34);
    c.lineTo(r * 0.36, r * 0.3);
    c.lineTo(-r * 0.36, r * 0.3);
    c.closePath();
    c.fill();
    c.fillStyle = INK;
    c.fillRect(-r * 0.3, -r * 0.06, r * 0.6, r * 0.13);
  } else {
    /* Beat 5 — the face. Grin first, then the eyes on top of it, so a wide
       eye can overlap the mouth without a hole in the lid. */
    GRIN(c, r, 1, fx * 0.4, 0);
    c.fillStyle = INK;
    c.fill();
    c.fillStyle = "#ffffff";
    teeth(c, r);
    c.fill();
    /* Stacked opaque fills, never clip(): the dark lid ellipse lands first
       and the cream eye lands offset OUTWARD and UP, so the leftover crescent
       is thickest on the INNER-LOWER side. One shape doing brow, lid and
       shading, and the lid is what breaks the crown of the silhouette. */
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(s * r * 0.46, -r * 0.5, r * 0.36, r * 0.35, 0, 0, 7);
      c.fillStyle = dk(HULL, 0.46);
      c.fill();
      seal(c);
      c.beginPath();
      c.ellipse(s * r * 0.51, -r * 0.44, r * 0.29, r * 0.28, 0, 0, 7);
      c.fillStyle = EYE;
      c.fill();
      c.beginPath();
      c.ellipse(s * r * 0.51 + fx * 0.9, -r * 0.41, r * 0.145, r * 0.155, 0, 0, 7);
      c.fillStyle = INK;
      c.fill();
      /* The specular does NOT track: the eye is a fixed glassy bulge lit from
         the upper left like every other body in the cabinet, and the pupil
         slides underneath it. */
      c.beginPath();
      c.ellipse(s * r * 0.51 - r * 0.07, -r * 0.52, r * 0.062, r * 0.062, 0, 0, 7);
      c.fillStyle = "#ffffff";
      c.fill();
    }
  }
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
