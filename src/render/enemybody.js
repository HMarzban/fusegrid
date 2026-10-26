import { rr, RIM, tone, dk, lt, poly, oval, seal } from "./icons.js";
import { CFG } from "../core/config.js";
import { MOTION, foeM, phaseOf, bobAt, breatheAt, blinkAt, spawnK, deathK, leanAt, lockK } from "./motion.js";
import { lockOn } from "./lockon.js";
import { fxOf } from "./entityfx.js";
import { contact as floorContact } from "./depth2d.js";
import { getFxOpts } from "./fx.js";
import { mix } from "./featart/kit.js";

/* drawEnemyBody draws one enemy at origin; the render bob stays in the
   drawEnemies wrapper (positioning concern) so bodies stay translate-free.

   Character build (enemy-character-art 2026-09-04). Every foe runs the same
   five beats — contact shade, dark contour, inset body, upper-left sheen,
   sculpted eye — and only its SHAPE varies, so nine outlines stay apart
   while the family reads as one cast. Shading stacks opaque fills instead
   of clipping or grading: the headless ctx has neither clip() nor a usable
   gradient. Tones are lerped off e.color, so spawnEnemy stays the single
   palette source. No scale() anywhere, so bounds are exact and every body
   fits the ENEMIES well at r=14.

   ENTITY MOTION (2026-10-25). The body takes an optional 4th argument X, the
   LIVE frame state only drawFoes passes (blink, hunter glow, brow flick,
   spawn/death alpha). With no X the body is the clean static pose every other
   caller bakes or lists (ENEMIES page, the 3D atlas at time 0, iso, tests):
   no blink, no hem or plume wobble. All timing is motion.js (FOE_M, phaseOf,
   bobAt, blinkAt ...), so the walk bob, the feet and the lean share ONE
   phase, bobW*t + ph*2pi. Whole-body moves (bob, lean, squash, spawn pop,
   death) are drawFoes transforms, never a scale inside a body. The rim light
   is a 1 px crescent of lt(col) peeking out up-left of the lit body, the
   same side as the frozen warm key and the sheen. */

const ROCK = "#0b0e16";
const VOID = "#080a16";
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function contact(c, r, w) {
  c.fillStyle = "rgba(0,0,0,0.34)";
  c.beginPath();
  c.ellipse(0, r * 0.86, r * w, r * 0.17, 0, 0, 7);
  c.fill();
}
/* shape(c,r,k,ox,oy): the contour at inset k, nudged by (ox,oy). Pass 1 is
   the dark form plus the rim, pass 1b the thin up-left rim light, pass 2 the
   lit body lifted off the floor so the leftover crescent below is the form
   shadow, pass 3 a tilted sheen pinned upper-left to agree with the frozen
   3D warm key. */
let HALO = 0;
function shell(c, r, col, shape, sx, sy, sw, lf) {
  const lift = lf || 0;
  if (HALO > 0.02) {
    const ga = c.globalAlpha;
    shape(c, r, 1.13, 0, 0);
    c.globalAlpha = ga * HALO * 0.8;
    c.fillStyle = lt(col, 0.45);
    c.fill();
    c.globalAlpha = ga;
  }
  shape(c, r, 1, 0, 0);
  c.fillStyle = dk(col, 0.56 - lift * 0.5);
  c.fill();
  seal(c);
  shape(c, r, 0.8, -r * 0.075, -r * 0.155);
  c.fillStyle = lt(col, 0.5 + lift * 1.5);
  c.fill();
  shape(c, r, 0.8, 0, -r * 0.09);
  c.fillStyle = lift ? lt(col, lift) : col;
  c.fill();
  c.fillStyle = lt(col, 0.4 + lift * 1.2);
  c.beginPath();
  c.ellipse(r * sx, r * sy, r * sw, r * sw * 0.5, -0.6, 0, 7);
  c.fill();
}
/* A rivet / bolt head: a dark dot with a one-pixel lit edge, the low-contrast
   "something was fastened here" detail. */
function stud(c, x, y, u, col) {
  c.fillStyle = dk(col, 0.5);
  c.beginPath();
  c.arc(x, y, u, 0, 7);
  c.fill();
  c.fillStyle = lt(col, 0.5);
  c.beginPath();
  c.arc(x - u * 0.3, y - u * 0.3, u * 0.45, 0, 7);
  c.fill();
}
/* hunter glow: a soft halo behind the eye, strength g 0..1 from leanAt */
function halo(c, x, y, rad, col, g, a) {
  if (!(g > 0.03)) return;
  c.globalAlpha = a * 0.6 * g;
  c.fillStyle = lt(col, 0.6);
  c.beginPath();
  c.arc(x, y, rad * 1.6, 0, 7);
  c.fill();
  c.globalAlpha = a;
}
/* Creatures get an eye — bright sclera, tinted iris, dark pupil, specular —
   because a pale disc with a dark centre is the most legible face a 4px
   feature can be, and the iris offset gives the gaze a direction. Machines
   get a lens instead: dark well, glowing ring, hot core. bl is the eyelid
   closed amount 0..1: the eye squashes flat (never a clip), so a blink is the
   socket thinning to a slot. */
function eye(c, x, y, rad, col, gx, bl) {
  const o = bl > 0.02 ? 1 - bl * 0.9 : 1;
  c.fillStyle = ROCK;
  c.beginPath();
  if (o < 1) c.ellipse(x, y, rad, rad * (0.3 + 0.7 * o), 0, 0, 7);
  else c.arc(x, y, rad, 0, 7);
  c.fill();
  if (o < 0.25) return;
  c.fillStyle = "#f4f7ff";
  c.beginPath();
  if (o < 1) c.ellipse(x, y, rad * 0.74, rad * 0.74 * o, 0, 0, 7);
  else c.arc(x, y, rad * 0.74, 0, 7);
  c.fill();
  c.fillStyle = dk(col, 0.34);
  c.beginPath();
  if (o < 1) c.ellipse(x + gx, y + rad * 0.08, rad * 0.46, rad * 0.46 * o, 0, 0, 7);
  else c.arc(x + gx, y + rad * 0.08, rad * 0.46, 0, 7);
  c.fill();
  c.fillStyle = ROCK;
  c.beginPath();
  if (o < 1) c.ellipse(x + gx, y + rad * 0.08, rad * 0.21, rad * 0.21 * o, 0, 0, 7);
  else c.arc(x + gx, y + rad * 0.08, rad * 0.21, 0, 7);
  c.fill();
  if (o < 0.45) return;
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.arc(x - rad * 0.3, y - rad * 0.32, rad * 0.17, 0, 7);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.5)";
  c.beginPath();
  c.arc(x + rad * 0.3, y + rad * 0.36, rad * 0.08, 0, 7);
  c.fill();
}
function lens(c, x, y, rad, col, bl, cx) {
  const o = bl > 0.02 ? 1 - bl * 0.85 : 1;
  c.fillStyle = ROCK;
  c.beginPath();
  if (o < 1) c.ellipse(x, y, rad, rad * (0.3 + 0.7 * o), 0, 0, 7);
  else c.arc(x, y, rad, 0, 7);
  c.fill();
  c.strokeStyle = lt(col, 0.5);
  c.lineWidth = Math.max(1.5, rad * 0.32);
  c.beginPath();
  if (o < 1) c.ellipse(x, y, rad * 0.6, rad * 0.6 * o, 0, 0, 7);
  else c.arc(x, y, rad * 0.6, 0, 7);
  c.stroke();
  c.fillStyle = "#ffffff";
  c.beginPath();
  if (o < 1) c.ellipse(x + (cx || 0), y, rad * 0.26, rad * 0.26 * o, 0, 0, 7);
  else c.arc(x + (cx || 0), y, rad * 0.26, 0, 7);
  c.fill();
}
/* poly with a per-vertex offset table W (unit r, x then y): the same contour,
   so a zeroed table is the static shape exactly. Controls move with their vertex. */
function polyW(pts, W) {
  return (c, r, k, ox, oy) => {
    c.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i],
        dx = W[i * 2],
        dy = W[i * 2 + 1],
        x = ox + (p[0] + dx) * r * k,
        y = oy + (p[1] + dy) * r * k;
      if (i === 0) c.moveTo(x, y);
      else if (p.length === 4) c.quadraticCurveTo(ox + (p[2] + dx) * r * k, oy + (p[3] + dy) * r * k, x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  };
}

const S_WALKER = poly([
  [-0.86, 0.6],
  [-0.86, -0.1],
  [0, -0.98, -0.86, -0.98],
  [0.86, -0.1, 0.86, -0.98],
  [0.86, 0.6],
]);
const S_SENTRY = poly([
  [-0.56, -0.9],
  [0.56, -0.9],
  [0.86, 0.14],
  [0.94, 0.64],
  [-0.94, 0.64],
  [-0.86, 0.14],
]);
const S_LENS = poly([
  [0, -0.62],
  [0.32, -0.44],
  [0.32, -0.1],
  [0, 0.08],
  [-0.32, -0.1],
  [-0.32, -0.44],
]);
const S_FAST = poly([
  [0, 0.9],
  [0.44, 0.16],
  [0.9, -0.32],
  [0.6, -0.44],
  [0, -0.28],
  [-0.6, -0.44],
  [-0.9, -0.32],
  [-0.44, 0.16],
]);
const S_CHASER = poly([
  [0, -0.94],
  [0.8, 0.16, 0.74, -0.6],
  [0, 0.78, 0.82, 0.72],
  [-0.8, 0.16, -0.82, 0.72],
  [0, -0.94, -0.74, -0.6],
]);
const S_ROCKET = poly([
  [0, -1],
  [0.46, 0.1, 0.46, -0.52],
  [0.46, 0.62],
  [-0.46, 0.62],
  [-0.46, 0.1],
  [0, -1, -0.46, -0.52],
]);
const WS = new Float32Array(24),
  WK = new Float32Array(26);
const S_SHADE = polyW(
  [
    [0, -1],
    [0.72, -0.06, 0.6, -0.72],
    [0.78, 0.42],
    [0.56, 0.12],
    [0.4, 0.54],
    [0.18, 0.18],
    [-0.04, 0.58],
    [-0.3, 0.16],
    [-0.52, 0.5],
    [-0.78, 0.4],
    [-0.72, -0.06],
    [0, -1, -0.6, -0.72],
  ],
  WS,
);
const S_HOOD = poly([
  [0, -0.72],
  [0.46, -0.04, 0.4, -0.48],
  [0.3, 0.28],
  [-0.3, 0.28],
  [-0.46, -0.04],
  [0, -0.72, -0.4, -0.48],
]);
const S_KNIGHT = polyW(
  [
    [-0.72, -0.28],
    [-0.72, -0.64],
    [-0.46, -0.96],
    [-0.24, -0.64],
    [0, -1],
    [0.24, -0.64],
    [0.46, -0.96],
    [0.72, -0.64],
    [0.72, -0.28],
    [0.6, 0.34],
    [0.3, 0.7],
    [-0.3, 0.7],
    [-0.6, 0.34],
  ],
  WK,
);
const S_GRUB = oval(0.26, 0.9, 0.5);

/* One row per type: (ctx, {r,col,t,back,fx,a,ph,bl,gl,fl,live,wp,mv}). back is
   "walking away from the player", which hides the eye and shows a nape — the
   front/back tell. fx slides the face along dir.x for a three-quarter turn.
   bl blink 0..1, gl hunter glow 0..1, fl brow flick 0..1, wp the walk phase
   (feet, bob and lean share it); bl/gl/fl are 0 and live false without X. */
const BODY = {
  walker(c, P) {
    const { r, col, back, fx, bl, gl, a, wp, mv } = P;
    contact(c, r, 0.62);
    const st = mv ? Math.sin(wp) : 0;
    c.fillStyle = ROCK;
    rr(c, -r * 0.5, r * 0.54 + Math.max(0, st) * r * 0.1, r * 0.36, r * 0.3, 3);
    c.fill();
    rr(c, r * 0.14, r * 0.54 + Math.max(0, -st) * r * 0.1, r * 0.36, r * 0.3, 3);
    c.fill();
    c.fillStyle = dk(col, 0.44);
    rr(c, -r * 1.02, r * 0.2, r * 0.44, r * 0.36, 5);
    c.fill();
    seal(c);
    rr(c, r * 0.58, r * 0.2, r * 0.44, r * 0.36, 5);
    c.fill();
    seal(c);
    c.fillStyle = lt(col, 0.3);
    c.fillRect(-r * 0.92, r * 0.27, r * 0.2, r * 0.045);
    c.fillRect(r * 0.7, r * 0.33, r * 0.2, r * 0.045);
    shell(c, r, col, S_WALKER, -0.32, -0.54, 0.32);
    if (back) {
      c.fillStyle = dk(col, 0.5);
      rr(c, -r * 0.34, -r * 0.34, r * 0.68, r * 0.6, 4);
      c.fill();
      seal(c);
      c.fillStyle = ROCK;
      c.fillRect(-r * 0.24, -r * 0.18, r * 0.48, r * 0.12);
    } else {
      halo(c, fx, -r * 0.02, r * 0.36, col, gl, a);
      eye(c, fx, -r * 0.02, r * 0.36, col, fx * 0.6, bl);
      c.fillStyle = dk(col, 0.68);
      rr(c, -r * 0.66, -r * 0.56, r * 1.32, r * 0.18, 3);
      c.fill();
      stud(c, -r * 0.52, -r * 0.47, r * 0.055, col);
      stud(c, r * 0.52, -r * 0.47, r * 0.055, col);
    }
  },
  stationary(c, P) {
    const { r, col, t, ph, bl, live } = P;
    const k = 1 + Math.sin(t * 3 + (live ? ph * 6.283 : 0)) * 0.04,
      R = r * k,
      br = clamp01((k - 0.96) / 0.08);
    contact(c, r, 0.74);
    shell(c, R, col, S_SENTRY, -0.28, -0.5, 0.28);
    c.fillStyle = dk(col, 0.72);
    c.fillRect(-R * 0.6, -R * 0.02, R * 1.2, R * 0.045);
    c.fillStyle = dk(col, 0.62);
    c.fillRect(-R * 0.92, R * 0.48, R * 1.84, R * 0.16);
    c.fillStyle = dk(col, 0.7 - 0.2 * br);
    for (const rx of [-0.7, -0.24, 0.24, 0.7]) {
      c.beginPath();
      c.arc(R * rx, R * 0.34, R * 0.07, 0, 7);
      c.fill();
    }
    c.fillStyle = dk(col, 0.66);
    c.fillRect(-R * 0.12, -R * 1.02, R * 0.24, R * 0.22);
    S_LENS(c, R, 1, 0, 0);
    c.fillStyle = ROCK;
    c.fill();
    seal(c);
    lens(c, 0, -R * 0.26, R * 0.27 + R * 0.02 * Math.sin(t * 3), col, bl, live ? Math.sin(t * 1.3 + ph * 6.283) * R * 0.09 : 0);
  },
  fast(c, P) {
    const { r, col, back, fx, a, bl, gl } = P;
    contact(c, r, 0.46);
    c.globalAlpha = a * 0.5;
    c.fillStyle = lt(col, 0.35);
    for (let i = 0; i < 3; i++) {
      const w = r * (0.5 - i * 0.14),
        sy = -r * (0.58 + i * 0.16);
      c.beginPath();
      c.moveTo(-w, sy);
      c.lineTo(0, sy + r * 0.14);
      c.lineTo(w, sy);
      c.lineTo(0, sy + r * 0.04);
      c.closePath();
      c.fill();
    }
    c.globalAlpha = a;
    shell(c, r, col, S_FAST, -0.3, -0.14, 0.26, 0.06);
    c.fillStyle = dk(col, 0.7);
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * r * 0.5, -r * 0.4);
      c.lineTo(s * r * 0.84, -r * 0.33);
      c.lineTo(s * r * 0.5, -r * 0.31);
      c.closePath();
      c.fill();
    }
    if (back) {
      c.fillStyle = ROCK;
      c.fillRect(-r * 0.28, -r * 0.14, r * 0.56, r * 0.14);
    } else {
      c.fillStyle = ROCK;
      rr(c, -r * 0.4, r * 0.08, r * 0.8, r * 0.32, 6);
      c.fill();
      halo(c, fx, r * 0.24, r * 0.17, col, gl, a);
      lens(c, fx, r * 0.24, r * 0.17, col, bl, 0);
    }
  },
  chaser(c, P) {
    const { r, col, back, fx, bl, gl, fl, a, wp, mv, live } = P;
    contact(c, r, 0.66);
    c.fillStyle = dk(col, 0.42);
    c.beginPath();
    c.moveTo(-r * 0.32, -r * 0.66);
    c.lineTo(0, -r * 1.02);
    c.lineTo(r * 0.32, -r * 0.66);
    c.closePath();
    c.fill();
    seal(c);
    shell(c, r, col, S_CHASER, -0.3, -0.3, 0.28);
    const st = live && mv ? Math.sin(wp) : 0;
    c.fillStyle = ROCK;
    c.fillRect(-r * 0.58, r * 0.62 + Math.max(0, st) * r * 0.08, r * 0.36, r * 0.2);
    c.fillRect(r * 0.22, r * 0.62 + Math.max(0, -st) * r * 0.08, r * 0.36, r * 0.2);
    if (back) {
      c.fillStyle = dk(col, 0.5);
      c.fillRect(-r * 0.4, -r * 0.1, r * 0.8, r * 0.44);
      c.fillStyle = ROCK;
      c.fillRect(-r * 0.3, r * 0.04, r * 0.6, r * 0.12);
    } else {
      halo(c, fx, r * 0.2, r * 0.36, col, gl, a);
      eye(c, fx, r * 0.2, r * 0.36, col, fx * 0.6, bl);
      const f = live ? Math.min(1, 0.18 + gl * 0.85 + fl * 0.4) : 0;
      c.fillStyle = dk(col, 0.7);
      c.beginPath();
      c.moveTo(-r * 0.56, -r * 0.3);
      c.lineTo(0, -r * (0.3 - 0.08 * f));
      c.lineTo(r * 0.56, -r * 0.3);
      c.lineTo(r * 0.44, -r * 0.1);
      c.lineTo(0, -r * (0.1 - 0.2 * f));
      c.lineTo(-r * 0.44, -r * 0.1);
      c.closePath();
      c.fill();
      stud(c, -r * 0.47, -r * 0.24, r * 0.05, col);
      stud(c, r * 0.47, -r * 0.24, r * 0.05, col);
    }
  },
  boomerang(c, P) {
    const { r, col, t, a } = P;
    c.globalAlpha = a * 0.4;
    contact(c, r, 0.56);
    c.globalAlpha = a * 0.66;
    c.save();
    c.rotate(t * 10);
    c.strokeStyle = dk(col, 0.55);
    c.lineWidth = r * 0.42;
    c.lineCap = "round";
    c.beginPath();
    c.arc(0, 0, r * 0.7, 0, Math.PI * 1.45);
    c.stroke();
    c.strokeStyle = col;
    c.lineWidth = r * 0.24;
    c.beginPath();
    c.arc(0, 0, r * 0.7, 0, Math.PI * 1.45);
    c.stroke();
    c.fillStyle = lt(col, 0.45);
    for (let i = 0; i < 3; i++) {
      const an = 0.34 + i * 0.44;
      c.beginPath();
      c.moveTo(Math.cos(an) * r * 0.6, Math.sin(an) * r * 0.6);
      c.lineTo(Math.cos(an + 0.15) * r * 0.98, Math.sin(an + 0.15) * r * 0.98);
      c.lineTo(Math.cos(an + 0.3) * r * 0.6, Math.sin(an + 0.3) * r * 0.6);
      c.closePath();
      c.fill();
    }
    c.fillStyle = dk(col, 0.6);
    c.beginPath();
    c.arc(Math.cos(3.5) * r * 0.7, Math.sin(3.5) * r * 0.7, r * 0.07, 0, 7);
    c.fill();
    c.restore();
    c.globalAlpha = a;
    c.fillStyle = VOID;
    c.beginPath();
    c.arc(0, 0, r * 0.3, 0, 7);
    c.fill();
    c.strokeStyle = lt(col, 0.5);
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, r * 0.3, 0, 7);
    c.stroke();
    c.globalAlpha = a * 0.85;
    lens(c, 0, 0, r * 0.19, col, 0, 0);
    c.globalAlpha = a;
  },
  rocket(c, P) {
    const { r, col, t, ph, a } = P;
    contact(c, r, 0.46);
    c.fillStyle = dk(col, 0.5);
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * r * 0.4, r * 0.14);
      c.lineTo(s * r * 0.92, r * 0.66);
      c.lineTo(s * r * 0.38, r * 0.66);
      c.closePath();
      c.fill();
      seal(c);
    }
    shell(c, r, col, S_ROCKET, -0.16, -0.5, 0.19);
    c.fillStyle = dk(col, 0.72);
    c.fillRect(-r * 0.3, -r * 0.62, r * 0.6, r * 0.04);
    c.fillStyle = ROCK;
    c.fillRect(-r * 0.44, r * 0.06, r * 0.88, r * 0.2);
    c.fillStyle = lt(col, 0.5);
    c.fillRect(-r * 0.44, r * 0.11, r * 0.88, r * 0.06);
    for (const sx of [-0.3, 0, 0.3]) stud(c, r * sx, r * 0.31, r * 0.04, col);
    c.fillStyle = dk(col, 0.74);
    c.beginPath();
    c.ellipse(0, r * 0.56, r * 0.3, r * 0.08, 0, 0, 7);
    c.fill();
    const fk = 0.5 + 0.5 * Math.sin(t * 9 + ph * 6.283),
      L = 1 + Math.sin(t * 20) * 0.04 + Math.sin(t * 33 + 1) * 0.03;
    c.fillStyle = "#ff7a3a";
    c.beginPath();
    c.moveTo(-r * 0.28, r * 0.58);
    c.lineTo(0, r * L);
    c.lineTo(r * 0.28, r * 0.58);
    c.closePath();
    c.fill();
    c.globalAlpha = a * (0.25 + 0.6 * fk);
    c.fillStyle = "#ffb347";
    c.fill();
    c.globalAlpha = a;
    c.fillStyle = "#ffde7a";
    c.beginPath();
    c.moveTo(-r * 0.13, r * 0.58);
    c.lineTo(0, r * (0.84 * L));
    c.lineTo(r * 0.13, r * 0.58);
    c.closePath();
    c.fill();
    c.globalAlpha = a * (0.25 + 0.6 * (1 - fk));
    c.fillStyle = "#fff3b0";
    c.fill();
    c.globalAlpha = a;
    lens(c, 0, -r * 0.42, r * 0.2, col, 0, 0);
  },
  burrow(c, P) {
    const { r, col, t, back, fx, a, bl, ph, live, wp } = P;
    contact(c, r, 0.76);
    c.globalAlpha = a * 0.4;
    c.fillStyle = lt(col, 0.4);
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(
        r * (i - 1) * 0.34,
        -r * (0.6 + Math.abs(i - 1) * 0.1) + Math.sin(t * 9 + i) * r * 0.04,
        r * 0.2,
        r * 0.13,
        0,
        0,
        7,
      );
      c.fill();
    }
    c.globalAlpha = a;
    let n = 0;
    for (const seg of [
      [0.68, -0.46, 0.54, 0.34],
      [0.48, -0.12, 0.72, 0.42],
    ]) {
      c.fillStyle = dk(col, seg[0]);
      c.beginPath();
      c.ellipse(live ? Math.sin(wp - n * 1.1) * r * 0.07 : 0, seg[1] * r, seg[2] * r, seg[3] * r, 0, 0, 7);
      c.fill();
      seal(c);
      n++;
    }
    shell(c, r, col, S_GRUB, -0.32, 0.1, 0.3, 0.2);
    c.strokeStyle = dk(col, 0.3);
    c.lineWidth = 1;
    for (const sc of [
      [-0.5, 0.06],
      [-0.12, 0.0],
      [0.3, 0.07],
      [0.62, 0.0],
    ]) {
      c.beginPath();
      c.arc(r * sc[0], r * sc[1], r * 0.12, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
    }
    c.fillStyle = dk(col, 0.72);
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * r * 0.62, r * 0.24);
      c.lineTo(s * r, r * 0.66);
      c.lineTo(s * r * 0.5, r * 0.6);
      c.closePath();
      c.fill();
      seal(c);
    }
    if (back) {
      c.fillStyle = ROCK;
      c.fillRect(-r * 0.3, r * 0.2, r * 0.6, r * 0.14);
    } else {
      c.fillStyle = dk(col, 0.74);
      rr(c, -r * 0.6, -r * 0.04, r * 1.2, r * 0.14, 4);
      c.fill();
      eye(c, fx - r * 0.31, r * 0.3, r * 0.235, col, fx * 0.5, bl);
      eye(c, fx + r * 0.31, r * 0.3, r * 0.235, col, fx * 0.5, bl);
    }
  },
  shade(c, P) {
    const { r, col, t, a, bl, live } = P;
    const wv = foeM("shade").idleW;
    for (let i = 2; i <= 9; i++) {
      WS[i * 2] = live ? Math.sin(wv * t + i * 0.9) * 0.025 : 0;
      WS[i * 2 + 1] = live ? Math.sin(wv * t * 1.4 + i * 1.7) * 0.075 : 0;
    }
    c.globalAlpha = a * 0.3;
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(0, r * 0.84, r * 0.6, r * 0.19, 0, 0, 7);
    c.fill();
    c.globalAlpha = a;
    shell(c, r, col, S_SHADE, -0.28, -0.52, 0.26);
    S_HOOD(c, r, 1, 0, 0);
    c.fillStyle = VOID;
    c.fill();
    c.globalAlpha = a * 0.4;
    c.fillStyle = lt(col, 0.3);
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(
        r * (i - 1) * 0.4,
        r * (0.66 + Math.sin(t * 5 + i * 2) * 0.08),
        r * 0.14,
        r * 0.1,
        0,
        0,
        7,
      );
      c.fill();
    }
    c.globalAlpha = a;
    const g = 0.5 + 0.5 * Math.sin(t * 4);
    c.globalAlpha = a * (0.3 + 0.3 * g);
    c.fillStyle = lt(col, 0.5);
    c.beginPath();
    c.ellipse(0, -r * 0.26, r * 0.42, r * 0.24, 0, 0, 7);
    c.fill();
    c.globalAlpha = a;
    const o = bl > 0.02 ? 1 - bl * 0.9 : 1;
    for (const s of [-1, 1]) {
      c.fillStyle = "#ffffff";
      c.beginPath();
      if (o < 1) c.ellipse(s * r * 0.2, -r * 0.26, r * 0.16, r * 0.16 * o, 0, 0, 7);
      else c.arc(s * r * 0.2, -r * 0.26, r * 0.16, 0, 7);
      c.fill();
      if (o < 0.3) continue;
      c.fillStyle = lt(col, 0.35 + 0.4 * g);
      c.beginPath();
      if (o < 1) c.ellipse(s * r * 0.2, -r * 0.26, r * 0.11, r * 0.11 * o, 0, 0, 7);
      else c.arc(s * r * 0.2, -r * 0.26, r * 0.11, 0, 7);
      c.fill();
      c.fillStyle = ROCK;
      c.beginPath();
      if (o < 1) c.ellipse(s * r * 0.2, -r * 0.24, r * 0.05, r * 0.05 * o, 0, 0, 7);
      else c.arc(s * r * 0.2, -r * 0.24, r * 0.05, 0, 7);
      c.fill();
    }
  },
  knight(c, P) {
    const { r, col, back, fx, t, bl, gl, a, live, mv, wp } = P;
    const wv = foeM("knight").idleW;
    const sy = live ? Math.sin(wv * t + P.ph * 6.283) : 0;
    WK[8] = sy * 0.09;
    WK[4] = WK[12] = sy * -0.03;
    WK[6] = WK[10] = sy * 0.035;
    contact(c, r, 0.7);
    const st = live && mv ? Math.sin(wp) : 0;
    c.fillStyle = dk(col, 0.5);
    for (const s of [-1, 1]) {
      rr(c, s > 0 ? r * 0.5 : -r * 1.02, r * 0.16 + (s > 0 ? Math.max(0, -st) : Math.max(0, st)) * r * 0.06, r * 0.52, r * 0.3, 5);
      c.fill();
      seal(c);
    }
    shell(c, r, col, S_KNIGHT, -0.3, -0.42, 0.28);
    c.fillStyle = dk(col, 0.44);
    c.fillRect(-r * 0.34, r * 0.54, r * 0.68, r * 0.18);
    if (back) {
      c.fillStyle = dk(col, 0.56);
      c.fillRect(-r * 0.5, -r * 0.24, r, r * 0.5);
      c.fillStyle = ROCK;
      c.fillRect(-r * 0.34, -r * 0.06, r * 0.68, r * 0.12);
    } else {
      c.fillStyle = ROCK;
      rr(c, -r * 0.5, -r * 0.26, r, r * 0.5, 3);
      c.fill();
      halo(c, fx, -r * 0.01, r * 0.24, col, gl, a);
      eye(c, fx - r * 0.24, -r * 0.01, r * 0.19, col, fx * 0.4, bl);
      eye(c, fx + r * 0.24, -r * 0.01, r * 0.19, col, fx * 0.4, bl);
      c.fillStyle = lt(col, 0.32);
      c.fillRect(-r * 0.09, -r * 0.34, r * 0.18, r * 0.92);
      c.fillStyle = dk(col, 0.2);
      c.fillRect(-r * 0.09, -r * 0.34, r * 0.06, r * 0.92);
      c.fillStyle = dk(col, 0.62);
      c.fillRect(-r * 0.5, r * 0.2, r, r * 0.14);
      stud(c, -r * 0.44, r * 0.27, r * 0.05, col);
      stud(c, r * 0.44, r * 0.27, r * 0.05, col);
      c.strokeStyle = lt(col, 0.45);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(r * 0.5, -r * 0.62);
      c.lineTo(r * 0.28, -r * 0.4);
      c.stroke();
    }
  },
};

export function drawEnemyBody(c, world, e, X) {
  const t = world.time || 0;
  const d = e.dir || { x: 0, y: 1 };
  const live = !!X,
    m = foeM(e.type),
    ph = live ? phaseOf(e.type, e.home) : 0;
  const a = live && X.a != null ? X.a : !live && e.invuln && Math.floor(t * 12) % 2 ? 0.5 : 1;
  c.globalAlpha = a;
  HALO = live ? X.gl * (0.55 + 0.45 * Math.sin(1.9 * t + ph * 6.283)) : 0;
  (BODY[e.type] || BODY.walker)(c, {
    r: e.r,
    col: e.color,
    t,
    back: d.y < -0.5,
    fx: e.r * 0.15 * Math.max(-1, Math.min(1, d.x)),
    a,
    ph,
    live,
    mv: e.speed == null || e.speed > 0,
    wp: m.bobW * t + ph * 6.283,
    bl: live ? (X.bl != null ? X.bl : Math.max(blinkAt(e.type, ph, t), X.gl * 0.55)) : 0,
    gl: live ? X.gl : 0,
    fl: live ? X.fl : 0,
  });
}

/* ---- the live foe pass: bob, lean, squash, spawn pop, death ghosts ---- */
export const FOE_RAD = { walker: 0.34, fast: 0.32, chaser: 0.33, stationary: 0.3, boomerang: 0.3, rocket: 0.4, burrow: 0.32, shade: 0.3, knight: 0.34 };
const XS = { a: 1, gl: 0, fl: 0, bl: null };
const GE = { type: "walker", color: "#8affc1", r: 14, home: null, dir: { x: 0, y: 1 }, speed: 1, invuln: false };
const FS = new WeakMap();
const TINT = {};
const tintOf = (col) => TINT[col] || (TINT[col] = mix("#ffffff", col, 0.35));
const FLICK_T = 0.3;
const fstate = (e) => {
  let s = FS.get(e);
  if (!s) FS.set(e, (s = { i0: 0, f0: -9, near: false, tx: e.dir ? e.dir.x : 0, ty: e.dir ? e.dir.y : 0, tT: -1 }));
  return s;
};

/* LOCK-ON (issue #32): chevrons on the floor from the foe down its lane to the player, fading with distance, over a dark under-stroke so they hold on
   every floor; static (no march, no pulse) so REDUCE FLASH and reduced motion keep the same steady mark. k is lockK's ramp; nothing is drawn at k = 0. */
function laneMarks(c, s, k, col) {
  const T = CFG.TILE, fx = s.ldx || 0, fy = s.ldy || 0, end = Math.max(0.6 * T, (s.ld || T) - 0.55 * T), hi = lt(col, 0.45);
  for (let d = 0.6 * T, i = 0; d <= end + 0.01 && i < 7; d += 0.5 * T, i++) {
    const a = k * (0.9 - 0.07 * i), P = (f, q) => [fx * (d + f * T) - fy * q * T, fy * (d + f * T) + fx * q * T];
    const A = P(-0.08, -0.17), B = P(0.1, 0), C = P(-0.08, 0.17);
    for (let pass = 0; pass < 2; pass++) {
      c.globalAlpha = pass ? a : a * 0.55;
      c.strokeStyle = pass ? hi : ROCK;
      c.lineWidth = pass ? 2.5 : 5;
      c.beginPath();
      c.moveTo(A[0], A[1]);
      c.lineTo(B[0], B[1]);
      c.lineTo(C[0], C[1]);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
}

/* the lane pass, on the FLOOR before drawItems so a pickup is never covered (lead ruling 2026-10-26). It owns the ramp: lockK runs here once per frame per
   foe on the same clock as drawFoes (world.time, the PAUSE time swapped in), and drawFoes reuses s.lk when s.lt is already this frame's t. */
const lockOf = (world, e, s, t) => (s.lt === t ? s.lk : lockK(s, lockOn(world, e), t));
export function drawLanes(c, world) {
  const t = world.time || 0;
  for (const e of world.enemies || []) {
    if (e.dead || !e.hunt) continue;
    const s = fstate(e), lk = lockOf(world, e, s, t);
    if (!(lk > 0.01)) continue;
    c.save();
    c.translate(e.x, e.y);
    laneMarks(c, s, lk, e.color);
    c.restore();
  }
}

export function drawFoes(c, world) {
  const t = world.time || 0,
    TL = CFG.TILE,
    p0 = world.players && world.players[0],
    pl = p0 && p0.alive !== false ? p0 : null;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const type = e.type,
      m = foeM(type),
      ph = phaseOf(type, e.home),
      r = e.r || 14,
      mv = e.speed > 0,
      s = fstate(e);
    let sp = null,
      sa = 1;
    if (e.invuln && e.invulnT != null) {
      if (e.invulnT > s.i0) s.i0 = e.invulnT;
      const pp = clamp01((Math.max(s.i0, MOTION.SPAWN_T) - e.invulnT) / MOTION.SPAWN_T),
        u = (pp * MOTION.SPAWN_T) / MOTION.POP_T;
      sp = spawnK(pp, t);
      sa = u > 0.999 && u < 1.4 ? 1 + (sp.a - 1) * ((u - 1) / 0.4) : sp.a;
      if (e.invulnT < 0.15) sa = 1 + (sa - 1) * (e.invulnT / 0.15);
    }
    const ln = pl && e.hunt && !e.invuln ? leanAt(type, e.hunt, pl.x - e.x, pl.y - e.y, TL) : null,
      lk = e.hunt ? lockOf(world, e, s, t) : 0;
    if (ln && !s.near) s.f0 = t;
    s.near = !!ln;
    let fl = 0;
    if (t - s.f0 < FLICK_T && t >= s.f0) fl = Math.sin(((t - s.f0) / FLICK_T) * Math.PI);
    const cue = ln ? clamp01(ln.glow * 3) : 0,
      sc = (sp ? sp.s : 1) * (type === "fast" ? 1.12 : 1),
      wp = m.bobW * t + ph * 6.283,
      sw = mv && (type === "walker" || type === "knight" || type === "chaser") ? Math.sin(wp) : 0;
    let ox = (ln ? ln.ox : 0) - sw * 1 + (lk ? s.ldx * 1.8 * lk : 0),
      oy = (ln ? ln.oy : 0) + bobAt(type, ph, t, mv) + (lk ? s.ldy * 1.8 * lk : 0),
      rot = -sw * 0.035;
    if (type === "boomerang") {
      const d = e.dir || s;
      if (s.tT < 0 || t < s.tT) {
        s.tx = d.x || 0;
        s.ty = d.y || 0;
      } else {
        const k = 1 - Math.exp(-10 * Math.min(0.1, t - s.tT));
        s.tx += ((d.x || 0) - s.tx) * k;
        s.ty += ((d.y || 0) - s.ty) * k;
      }
      s.tT = t;
      ox += s.tx * 1.6;
      oy += s.ty * 1.1;
      rot += s.tx * m.sway;
    } else if (type === "rocket") {
      ox += Math.sin(t * 47 + ph * 6.283) * 0.45;
      rot += Math.sin(t * 31 + ph * 6.283) * m.sway;
    } else if (type === "shade") rot += Math.sin(m.idleW * t + ph * 6.283) * m.sway;
    c.save();
    c.translate(e.x, e.y);
    floorContact(c, r * 0.95 * sc, r * 0.26 * sc, 1.8, r * 0.86, sa);
    if (sp && sp.ring) {
      c.globalAlpha = sp.ring.a;
      c.strokeStyle = lt(e.color, 0.35);
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(0, r * 0.86, sp.ring.r, sp.ring.r * 0.38, 0, 0, 7);
      c.stroke();
      c.globalAlpha = 1;
    }
    if (cue > 0.04) {
      c.globalAlpha = cue * (0.38 + 0.3 * (0.5 + 0.5 * Math.sin(1.9 * t + ph * 6.283)));
      c.strokeStyle = lt(e.color, 0.35);
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(0, r * 0.86, r * 1.35, r * 0.52, 0, 0, 7);
      c.stroke();
      c.globalAlpha = 1;
    }
    const fy = r * 0.86,
      br = type === "stationary" ? 1 : breatheAt(type, ph, t);
    c.translate(ox, oy + fy);
    if (rot) c.rotate(rot);
    if (sc !== 1 || br !== 1 || lk) c.scale(sc * (2 - br) * (1 + 0.06 * lk), sc * br * (1 - 0.09 * lk));
    c.translate(0, -fy);
    XS.a = sa;
    XS.gl = cue;
    XS.fl = fl;
    XS.bl = null;
    drawEnemyBody(c, world, e, XS);
    c.restore();
  }
  const gs = fxOf(world, "2d").ghosts(t);
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i],
      k = deathK(g.age);
    if (!k) continue;
    const r = CFG.TILE * (FOE_RAD[g.type] || 0.34),
      base = g.col || "#8affc1";
    GE.type = g.type;
    GE.r = r;
    GE.color = k.flash ? (getFxOpts().flashK >= 1 ? "#ffffff" : tintOf(base)) : base;
    c.save();
    c.translate(g.x, g.y);
    floorContact(c, r * 0.95 * k.sx, r * 0.26 * k.sy, 1.8, r * 0.86, k.a);
    const fy = r * 0.86;
    c.translate(0, fy);
    c.scale(k.sx, k.sy);
    c.translate(0, -fy);
    XS.a = k.a;
    XS.gl = 0;
    XS.fl = 0;
    XS.bl = g.age > 0.04 ? 1 : 0;
    drawEnemyBody(c, world, GE, XS);
    c.restore();
  }
}
