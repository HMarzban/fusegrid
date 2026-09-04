import { rr, RIM } from "./icons.js";

/* drawEnemyBody draws one enemy at origin; the render bob stays in the
   drawEnemies wrapper (positioning concern) so bodies stay translate-free.

   Character build (enemy-character-art 2026-09-04). Every foe runs the same
   five beats — contact shade, dark contour, inset body, upper-left sheen,
   sculpted eye — and only its SHAPE varies, so nine outlines stay apart
   while the family reads as one cast. Shading stacks opaque fills instead
   of clipping or grading: the headless ctx has neither clip() nor a usable
   gradient. Tones are lerped off e.color, so spawnEnemy stays the single
   palette source. No scale() anywhere, so bounds are exact and every body
   fits the ENEMIES well at r=14. */

const ROCK = "#0b0e16";
const VOID = "#080a16";

/* Tones are quantised to 1/32 and memoised: bodies ask for ~10 each and 16
   of them repaint every frame, so a fresh rgb() string per ask would churn. */
const TONES = {};
function tone(col, k, to) {
  const q = Math.round(k * 32) / 32;
  const key = col + q + to;
  let v = TONES[key];
  if (v) return v;
  const n = parseInt(String(col).slice(1), 16) || 0;
  const m = (b) => Math.round(b + (to - b) * q);
  v =
    "rgb(" +
    m((n >> 16) & 255) +
    "," +
    m((n >> 8) & 255) +
    "," +
    m(n & 255) +
    ")";
  return (TONES[key] = v);
}
const dk = (col, k) => tone(col, k, 0);
const lt = (col, k) => tone(col, k, 255);

function contact(c, r, w) {
  c.fillStyle = "rgba(0,0,0,0.34)";
  c.beginPath();
  c.ellipse(0, r * 0.86, r * w, r * 0.17, 0, 0, 7);
  c.fill();
}
function seal(c) {
  c.strokeStyle = RIM;
  c.lineWidth = 2;
  c.lineJoin = "round";
  c.stroke();
}
/* shape(c,r,k,ox,oy): the contour at inset k, nudged by (ox,oy). Pass 1 is
   the dark form plus the rim, pass 2 the lit body lifted off the floor so
   the leftover crescent below is the form shadow, pass 3 a tilted sheen
   pinned upper-left to agree with the frozen 3D warm key. */
function shell(c, r, col, shape, sx, sy, sw) {
  shape(c, r, 1, 0, 0);
  c.fillStyle = dk(col, 0.56);
  c.fill();
  seal(c);
  shape(c, r, 0.8, 0, -r * 0.09);
  c.fillStyle = col;
  c.fill();
  c.fillStyle = lt(col, 0.4);
  c.beginPath();
  c.ellipse(r * sx, r * sy, r * sw, r * sw * 0.5, -0.6, 0, 7);
  c.fill();
}
/* Creatures get an eye — bright sclera, tinted iris, dark pupil, specular —
   because a pale disc with a dark centre is the most legible face a 4px
   feature can be, and the iris offset gives the gaze a direction. Machines
   get a lens instead: dark well, glowing ring, hot core. */
function eye(c, x, y, rad, col, gx) {
  c.fillStyle = ROCK;
  c.beginPath();
  c.arc(x, y, rad, 0, 7);
  c.fill();
  c.fillStyle = "#f4f7ff";
  c.beginPath();
  c.arc(x, y, rad * 0.74, 0, 7);
  c.fill();
  c.fillStyle = dk(col, 0.34);
  c.beginPath();
  c.arc(x + gx, y + rad * 0.08, rad * 0.46, 0, 7);
  c.fill();
  c.fillStyle = ROCK;
  c.beginPath();
  c.arc(x + gx, y + rad * 0.08, rad * 0.21, 0, 7);
  c.fill();
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.arc(x - rad * 0.3, y - rad * 0.32, rad * 0.17, 0, 7);
  c.fill();
}
function lens(c, x, y, rad, col) {
  c.fillStyle = ROCK;
  c.beginPath();
  c.arc(x, y, rad, 0, 7);
  c.fill();
  c.strokeStyle = lt(col, 0.5);
  c.lineWidth = Math.max(1.5, rad * 0.32);
  c.beginPath();
  c.arc(x, y, rad * 0.6, 0, 7);
  c.stroke();
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.arc(x, y, rad * 0.26, 0, 7);
  c.fill();
}
/* A vertex is [x,y] for a line or [x,y,cx,cy] for a quadratic. */
function poly(pts) {
  return (c, r, k, ox, oy) => {
    c.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i],
        x = ox + p[0] * r * k,
        y = oy + p[1] * r * k;
      if (i === 0) c.moveTo(x, y);
      else if (p.length === 4)
        c.quadraticCurveTo(ox + p[2] * r * k, oy + p[3] * r * k, x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  };
}
/* Plates keep their centre and only thin their radii, so a body built from
   offset ovals does not drift when shell insets it. */
function oval(cy, rx, ry) {
  return (c, r, k, ox, oy) => {
    c.beginPath();
    c.ellipse(ox, oy + cy * r, rx * r * k, ry * r * k, 0, 0, 7);
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
const S_SHADE = poly([
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
]);
const S_HOOD = poly([
  [0, -0.72],
  [0.46, -0.04, 0.4, -0.48],
  [0.3, 0.28],
  [-0.3, 0.28],
  [-0.46, -0.04],
  [0, -0.72, -0.4, -0.48],
]);
const S_KNIGHT = poly([
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
]);
const S_GRUB = oval(0.26, 0.9, 0.5);

/* One row per type: (ctx, {r,col,t,back,fx,a}). back is "walking away from
   the player", which hides the eye and shows a nape — the front/back tell.
   fx slides the face along dir.x for a three-quarter turn. */
const BODY = {
  walker(c, P) {
    const { r, col, t, back, fx } = P;
    contact(c, r, 0.62);
    const st = Math.sin(t * 12);
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
    shell(c, r, col, S_WALKER, -0.32, -0.54, 0.32);
    if (back) {
      c.fillStyle = dk(col, 0.5);
      rr(c, -r * 0.34, -r * 0.34, r * 0.68, r * 0.6, 4);
      c.fill();
      seal(c);
      c.fillStyle = ROCK;
      c.fillRect(-r * 0.24, -r * 0.18, r * 0.48, r * 0.12);
    } else {
      eye(c, fx, -r * 0.02, r * 0.36, col, fx * 0.6);
      c.fillStyle = dk(col, 0.68);
      rr(c, -r * 0.66, -r * 0.56, r * 1.32, r * 0.18, 3);
      c.fill();
    }
  },
  stationary(c, P) {
    const { r, col, t } = P;
    contact(c, r, 0.74);
    shell(c, r * (1 + Math.sin(t * 3) * 0.04), col, S_SENTRY, -0.28, -0.5, 0.28);
    c.fillStyle = dk(col, 0.62);
    c.fillRect(-r * 0.92, r * 0.48, r * 1.84, r * 0.16);
    for (const rx of [-0.7, -0.24, 0.24, 0.7]) {
      c.beginPath();
      c.arc(r * rx, r * 0.34, r * 0.07, 0, 7);
      c.fill();
    }
    c.fillStyle = dk(col, 0.66);
    c.fillRect(-r * 0.12, -r * 1.02, r * 0.24, r * 0.22);
    S_LENS(c, r, 1, 0, 0);
    c.fillStyle = ROCK;
    c.fill();
    seal(c);
    lens(c, 0, -r * 0.26, r * 0.27 + r * 0.02 * Math.sin(t * 3), col);
  },
  fast(c, P) {
    const { r, col, t, back, fx, a } = P;
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
    c.globalAlpha = a * 0.3;
    c.beginPath();
    c.ellipse(0, r * 0.72, r * 0.62, r * 0.16, 0, 0, 7);
    c.fill();
    c.globalAlpha = a;
    shell(c, r, col, S_FAST, -0.3, -0.14, 0.26);
    if (back) {
      c.fillStyle = ROCK;
      c.fillRect(-r * 0.28, -r * 0.14, r * 0.56, r * 0.14);
    } else {
      c.fillStyle = ROCK;
      rr(c, -r * 0.4, r * 0.08, r * 0.8, r * 0.32, 6);
      c.fill();
      lens(c, fx, r * 0.24, r * 0.17, col);
    }
  },
  chaser(c, P) {
    const { r, col, back, fx } = P;
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
    c.fillStyle = ROCK;
    c.fillRect(-r * 0.58, r * 0.62, r * 0.36, r * 0.2);
    c.fillRect(r * 0.22, r * 0.62, r * 0.36, r * 0.2);
    if (back) {
      c.fillStyle = dk(col, 0.5);
      c.fillRect(-r * 0.4, -r * 0.1, r * 0.8, r * 0.44);
      c.fillStyle = ROCK;
      c.fillRect(-r * 0.3, r * 0.04, r * 0.6, r * 0.12);
    } else {
      eye(c, fx, r * 0.2, r * 0.36, col, fx * 0.6);
      c.fillStyle = dk(col, 0.7);
      c.beginPath();
      c.moveTo(-r * 0.56, -r * 0.3);
      c.lineTo(r * 0.56, -r * 0.3);
      c.lineTo(r * 0.44, -r * 0.1);
      c.lineTo(-r * 0.44, -r * 0.1);
      c.closePath();
      c.fill();
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
    lens(c, 0, 0, r * 0.19, col);
    c.globalAlpha = a;
  },
  rocket(c, P) {
    const { r, col, t } = P;
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
    c.fillStyle = ROCK;
    c.fillRect(-r * 0.44, r * 0.06, r * 0.88, r * 0.2);
    c.fillStyle = lt(col, 0.5);
    c.fillRect(-r * 0.44, r * 0.11, r * 0.88, r * 0.06);
    const f = Math.floor(t * 10) % 2;
    c.fillStyle = f ? "#ff7a3a" : "#ffb347";
    c.beginPath();
    c.moveTo(-r * 0.28, r * 0.58);
    c.lineTo(0, r * (1 + Math.sin(t * 20) * 0.05));
    c.lineTo(r * 0.28, r * 0.58);
    c.closePath();
    c.fill();
    c.fillStyle = f ? "#ffde7a" : "#fff3b0";
    c.beginPath();
    c.moveTo(-r * 0.13, r * 0.58);
    c.lineTo(0, r * 0.84);
    c.lineTo(r * 0.13, r * 0.58);
    c.closePath();
    c.fill();
    lens(c, 0, -r * 0.42, r * 0.2, col);
  },
  burrow(c, P) {
    const { r, col, t, back, fx, a } = P;
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
    for (const seg of [
      [0.68, -0.46, 0.54, 0.34],
      [0.48, -0.12, 0.72, 0.42],
    ]) {
      c.fillStyle = dk(col, seg[0]);
      c.beginPath();
      c.ellipse(0, seg[1] * r, seg[2] * r, seg[3] * r, 0, 0, 7);
      c.fill();
      seal(c);
    }
    shell(c, r, col, S_GRUB, -0.32, 0.1, 0.3);
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
      eye(c, fx - r * 0.26, r * 0.3, r * 0.17, col, fx * 0.4);
      eye(c, fx + r * 0.26, r * 0.3, r * 0.17, col, fx * 0.4);
      c.fillStyle = dk(col, 0.74);
      rr(c, -r * 0.58, r * 0.02, r * 1.16, r * 0.18, 4);
      c.fill();
    }
  },
  shade(c, P) {
    const { r, col, t, a } = P;
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
    for (const s of [-1, 1]) {
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(s * r * 0.2, -r * 0.26, r * 0.16, 0, 7);
      c.fill();
      c.fillStyle = lt(col, 0.35 + 0.4 * g);
      c.beginPath();
      c.arc(s * r * 0.2, -r * 0.26, r * 0.11, 0, 7);
      c.fill();
      c.fillStyle = ROCK;
      c.beginPath();
      c.arc(s * r * 0.2, -r * 0.24, r * 0.05, 0, 7);
      c.fill();
    }
  },
  knight(c, P) {
    const { r, col, back, fx } = P;
    contact(c, r, 0.7);
    c.fillStyle = dk(col, 0.5);
    for (const s of [-1, 1]) {
      rr(c, s > 0 ? r * 0.5 : -r * 1.02, r * 0.16, r * 0.52, r * 0.3, 5);
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
      eye(c, fx - r * 0.24, -r * 0.01, r * 0.19, col, fx * 0.4);
      eye(c, fx + r * 0.24, -r * 0.01, r * 0.19, col, fx * 0.4);
      c.fillStyle = lt(col, 0.32);
      c.fillRect(-r * 0.09, -r * 0.34, r * 0.18, r * 0.92);
      c.fillStyle = dk(col, 0.2);
      c.fillRect(-r * 0.09, -r * 0.34, r * 0.06, r * 0.92);
      c.fillStyle = dk(col, 0.62);
      c.fillRect(-r * 0.5, r * 0.2, r, r * 0.14);
    }
  },
};

export function drawEnemyBody(c, world, e) {
  const t = world.time || 0;
  const d = e.dir || { x: 0, y: 1 };
  const a = e.invuln && Math.floor(t * 12) % 2 ? 0.5 : 1;
  c.globalAlpha = a;
  (BODY[e.type] || BODY.walker)(c, {
    r: e.r,
    col: e.color,
    t,
    back: d.y < -0.5,
    fx: e.r * 0.15 * Math.max(-1, Math.min(1, d.x)),
    a,
  });
}
