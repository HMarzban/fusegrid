import { CFG } from "../core/config.js";

/* The dark seal every cabinet glyph and every foe contour strokes itself
   with — one constant so the two families keep the same craft. */
export const RIM = "rgba(0,0,0,0.55)";

export function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* Tones are quantised to 1/32 and memoised: bodies and glyphs ask for ~10
   each and 16 of them repaint every frame, so a fresh rgb() string per ask
   would churn. One table for the whole cabinet since the craft is shared. */
const TONES = {};
export function tone(col, k, to) {
  const q = Math.round(k * 32) / 32;
  const key = col + q + to;
  let v = TONES[key];
  if (v) return v;
  const n = parseInt(String(col).slice(1), 16) || 0;
  const m = (b) => Math.round(b + (to - b) * q);
  v = "rgb(" + m((n >> 16) & 255) + "," + m((n >> 8) & 255) + "," + m(n & 255) + ")";
  return (TONES[key] = v);
}
export const dk = (col, k) => tone(col, k, 0);
export const lt = (col, k) => tone(col, k, 255);
export function seal(c) {
  c.strokeStyle = RIM;
  c.lineWidth = 2;
  c.lineJoin = "round";
  c.stroke();
}
/* A vertex is [x,y] for a line or [x,y,cx,cy] for a quadratic. */
export function poly(pts) {
  return (c, r, k, ox, oy) => {
    c.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i],
        x = ox + p[0] * r * k,
        y = oy + p[1] * r * k;
      if (i === 0) c.moveTo(x, y);
      else if (p.length === 4) c.quadraticCurveTo(ox + p[2] * r * k, oy + p[3] * r * k, x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  };
}
/* Plates keep their centre and only thin their radii, so a body built from
   offset ovals does not drift when shell insets it. */
export function oval(cy, rx, ry) {
  return (c, r, k, ox, oy) => {
    c.beginPath();
    c.ellipse(ox, oy + cy * r, rx * r * k, ry * r * k, 0, 0, 7);
  };
}
/* The mechanical split already encoded in POWER: permanent stat growth,
   survival, transient toggle, bombKind selector. Families separate on
   silhouette, ring profile and idle rhythm — never on hue. */
export const ITEM_FAMILY = {
  fire: "cap",
  bomb: "cap",
  speed: "cap",
  heart: "vit",
  shield: "vit",
  kick: "utl",
  throw: "utl",
  pass: "utl",
  remote: "utl",
  line: "bls",
  power: "bls",
  pierce: "bls",
};

/* ---- items / power-up icons (cabinet glyphs, readable at 40px) ----
   Semantic-first (P1.5): every outline is a real object a player can name in
   one second at the 16px well, not an abstract silhouette chosen for
   plan-view distinctness. Where the two rules fight, the nameable object
   wins and the 3D body carries the plan-view separation instead. */
export const ITEM_SHAPE = {
  /* FLAME — teardrop, licking tip, one notch where the tongue peels off. */
  fire: [
    [0.08, -1.16],
    [0.5, -0.24, 0.46, -0.76],
    [0.66, 0.36, 0.78, 0.02],
    [0, 0.94, 0.5, 0.88],
    [-0.66, 0.36, -0.5, 0.88],
    [-0.5, -0.2, -0.78, 0.02],
    [-0.2, -0.64, -0.36, -0.5],
    [-0.08, -0.9],
  ],
  /* BOMB — the classic orb: round body, collared neck for the fuse. The
     in-game 2D bomb reuses this read, so the two must agree. */
  bomb: [
    [-0.74, 0.32],
    [-0.24, -0.36, -0.78, -0.14],
    [-0.24, -0.62],
    [0.24, -0.62],
    [0.24, -0.36],
    [0.74, 0.32, 0.78, -0.14],
    [0, 1.08, 0.74, 1.02],
    [-0.74, 0.32, -0.74, 1.02],
  ],
  speed: [[0.3, -1.02], [-0.62, 0.02], [-0.06, 0.02], [-0.34, 1.02], [0.66, -0.1], [0.1, -0.1]],
  heart: [
    [0, 0.98],
    [-0.62, 0.2, -0.42, 0.72],
    [-1.0, -0.34, -0.94, -0.1],
    [-0.54, -0.78, -0.94, -0.72],
    [0, -0.2, -0.22, -0.62],
    [0.54, -0.78, 0.22, -0.62],
    [1.0, -0.34, 0.94, -0.72],
    [0.62, 0.2, 0.94, -0.1],
  ],
  shield: [
    [0, -0.94],
    [0.84, -0.62],
    [0.76, 0.16],
    [0.4, 0.72, 0.68, 0.52],
    [0, 0.98, 0.16, 0.92],
    [-0.4, 0.72, -0.16, 0.92],
    [-0.76, 0.16, -0.68, 0.52],
    [-0.84, -0.62],
  ],
  /* KICK — a boot in profile mid-kick. The foot has to stay thin and run
     nearly twice the shaft's length, or the ankle bend reads as an elbow. */
  kick: [
    [-0.66, -1.1],
    [0.1, -1.1],
    [0.14, 0.02],
    [0.92, -0.18, 0.52, 0.08],
    [1.0, 0.3, 1.1, 0.02],
    [0, 0.62],
    [-0.36, 0.66],
    [-0.72, 0.46],
  ],
  /* THROW — the same orb BOMB uses, half the size and thrown clear of
     centre; the trajectory it rode is the accent. Mass distribution is the
     whole separation from BOMB: big centred orb there, small orb plus a long
     arc here. */
  throw: [
    [0.66, 0.36],
    [0.14, -0.16, 0.66, -0.16],
    [-0.08, -0.24],
    [0, -0.56],
    [-0.24, -0.48],
    [-0.38, 0.36, -0.38, -0.16],
    [0.14, 0.88, -0.38, 0.88],
    [0.66, 0.36, 0.66, 0.88],
  ],
  /* PASS — a brick wall, wider than it is tall, with a gap knocked through
     the middle. The arrow that threads the gap is the accent. */
  pass: [
    [-1.1, -0.66], [-0.24, -0.66], [-0.24, 0.1], [0.24, 0.1],
    [0.24, -0.66], [1.1, -0.66], [1.1, 0.74], [-1.1, 0.74],
  ],
  /* REMOTE — a hand detonator: a wide low box with a thin antenna standing
     off the right shoulder. The plunger button is the accent. */
  remote: [
    [-0.86, -0.12], [0.3, -0.12], [0.4, -1.12], [0.58, -1.12],
    [0.5, -0.12], [0.86, -0.12], [0.86, 0.88], [-0.86, 0.88],
  ],
  /* LINE — a directed beam: flared origin, long shaft, arrowhead tip. The
     asymmetry is what stops it reading as a plain double-headed arrow. */
  line: [
    [-1.1, -0.44], [-0.62, -0.17], [0.3, -0.17], [0.3, -0.5], [1.1, 0],
    [0.3, 0.5], [0.3, 0.17], [-0.62, 0.17], [-1.1, 0.44],
  ],
  /* POWER — a blast, not a sparkle: seven spikes of deliberately uneven
     length, the comic-explosion outline every player already knows. */
  power: [
    [0, -1.12], [0.3, -0.42], [0.86, -0.74], [0.5, -0.14],
    [1.12, 0.16], [0.42, 0.36], [0.66, 1.02], [0.06, 0.52],
    [-0.5, 1.04], [-0.42, 0.34], [-1.12, 0.3], [-0.44, -0.16],
    [-0.8, -0.86], [-0.28, -0.4],
  ],
  /* PIERCE — one broad arrowhead, tip-dominant, with a notched tail. The
     brick it punched through is the accent, spraying behind the tip. */
  pierce: [
    [0, -1.14], [0.62, -0.18], [0.26, -0.18], [0.34, 0.98],
    [0, 0.72], [-0.34, 0.98], [-0.26, -0.18], [-0.62, -0.18],
  ],
};
export const ITEM_ACCENT = {
  /* the inner tongue */
  fire: (c, s) => {
    c.fillStyle = "#ffd447";
    c.beginPath();
    c.moveTo(s * 0.02, -s * 0.42);
    c.quadraticCurveTo(s * 0.3, s * 0.14, 0, s * 0.62);
    c.quadraticCurveTo(-s * 0.3, s * 0.14, s * 0.02, -s * 0.42);
    c.fill();
  },
  /* fuse curling off the collar, lit tip, one specular crescent on the orb */
  bomb: (c, s) => {
    c.strokeStyle = "#ffd447";
    c.lineWidth = s * 0.18;
    c.beginPath();
    c.moveTo(s * 0.12, -s * 0.58);
    c.quadraticCurveTo(s * 0.52, -s * 0.68, s * 0.5, -s * 0.94);
    c.stroke();
    c.fillStyle = "#ffd447";
    c.beginPath();
    c.moveTo(s * 0.5, -s * 1.16);
    c.lineTo(s * 0.66, -s * 0.98);
    c.lineTo(s * 0.5, -s * 0.8);
    c.lineTo(s * 0.34, -s * 0.98);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(-s * 0.46, s * 0.26);
    c.quadraticCurveTo(-s * 0.54, -s * 0.16, -s * 0.14, -s * 0.26);
    c.quadraticCurveTo(-s * 0.38, -s * 0.02, -s * 0.3, s * 0.32);
    c.closePath();
    c.fill();
  },
  speed: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(s * 0.22, -s * 0.78);
    c.lineTo(-s * 0.3, -s * 0.02);
    c.lineTo(-s * 0.04, -s * 0.02);
    c.lineTo(s * 0.06, -s * 0.34);
    c.closePath();
    c.fill();
  },
  heart: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(-s * 0.74, -s * 0.52);
    c.quadraticCurveTo(-s * 0.4, -s * 0.76, -s * 0.2, -s * 0.5);
    c.quadraticCurveTo(-s * 0.44, -s * 0.6, -s * 0.62, -s * 0.34);
    c.closePath();
    c.fill();
  },
  shield: (c, s) => {
    c.fillStyle = "#0d3f78";
    c.beginPath();
    c.moveTo(0, -s * 0.46);
    c.lineTo(s * 0.34, -s * 0.02);
    c.lineTo(0, s * 0.44);
    c.lineTo(-s * 0.34, -s * 0.02);
    c.lineTo(0, s * 0.1);
    c.closePath();
    c.fill();
  },
  /* the dark sole that makes it a shoe, then the toe cap and two chevrons */
  kick: (c, s, col) => {
    c.fillStyle = dk(col, 0.62);
    c.beginPath();
    c.moveTo(s * 1.0, s * 0.3);
    c.lineTo(0, s * 0.62);
    c.lineTo(-s * 0.36, s * 0.66);
    c.lineTo(-s * 0.42, s * 0.36);
    c.lineTo(0, s * 0.32);
    c.lineTo(s * 0.94, s * 0.02);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffce8a";
    c.beginPath();
    c.moveTo(s * 0.56, -s * 0.08);
    c.lineTo(s * 0.9, -s * 0.2);
    c.lineTo(s * 1.0, s * 0.12);
    c.lineTo(s * 0.62, s * 0.22);
    c.closePath();
    c.moveTo(-s * 1.18, -s * 0.66);
    c.lineTo(-s * 0.92, -s * 0.4);
    c.lineTo(-s * 1.18, -s * 0.14);
    c.lineTo(-s * 1.06, -s * 0.4);
    c.closePath();
    c.moveTo(-s * 1.18, s * 0.06);
    c.lineTo(-s * 0.92, s * 0.32);
    c.lineTo(-s * 1.18, s * 0.58);
    c.lineTo(-s * 1.06, s * 0.32);
    c.closePath();
    c.fill();
  },
  /* the throwing arc, drawn as a real arrow so the verb reads, arcing over
     the orb and away */
  throw: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(-s * 1.04, s * 0.66);
    c.quadraticCurveTo(-s * 0.84, -s * 0.94, s * 0.6, -s * 0.92);
    c.lineTo(s * 0.46, -s * 1.16);
    c.lineTo(s * 1.1, -s * 0.7);
    c.lineTo(s * 0.4, -s * 0.44);
    c.lineTo(s * 0.52, -s * 0.68);
    c.quadraticCurveTo(-s * 0.58, -s * 0.66, -s * 0.8, s * 0.66);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffd447";
    c.beginPath();
    c.moveTo(-s * 0.12, -s * 0.76);
    c.lineTo(s * 0.06, -s * 0.58);
    c.lineTo(-s * 0.12, -s * 0.4);
    c.lineTo(-s * 0.3, -s * 0.58);
    c.closePath();
    c.fill();
  },
  /* mortar courses make it masonry; the arrow threads the knocked-out gap */
  pass: (c, s, col) => {
    c.fillStyle = dk(col, 0.62);
    c.beginPath();
    c.moveTo(-s * 1.1, s * 0.16);
    c.lineTo(s * 1.1, s * 0.16);
    c.lineTo(s * 1.1, s * 0.3);
    c.lineTo(-s * 1.1, s * 0.3);
    c.closePath();
    c.moveTo(-s * 0.68, -s * 0.66);
    c.lineTo(-s * 0.54, -s * 0.66);
    c.lineTo(-s * 0.54, s * 0.16);
    c.lineTo(-s * 0.68, s * 0.16);
    c.closePath();
    c.moveTo(s * 0.54, -s * 0.66);
    c.lineTo(s * 0.68, -s * 0.66);
    c.lineTo(s * 0.68, s * 0.16);
    c.lineTo(s * 0.54, s * 0.16);
    c.closePath();
    c.moveTo(-s * 0.4, s * 0.3);
    c.lineTo(-s * 0.26, s * 0.3);
    c.lineTo(-s * 0.26, s * 0.74);
    c.lineTo(-s * 0.4, s * 0.74);
    c.closePath();
    c.moveTo(s * 0.26, s * 0.3);
    c.lineTo(s * 0.4, s * 0.3);
    c.lineTo(s * 0.4, s * 0.74);
    c.lineTo(s * 0.26, s * 0.74);
    c.closePath();
    c.fill();
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(0, -s * 1.16);
    c.lineTo(s * 0.4, -s * 0.6);
    c.lineTo(s * 0.16, -s * 0.6);
    c.lineTo(s * 0.16, s * 0.98);
    c.lineTo(-s * 0.16, s * 0.98);
    c.lineTo(-s * 0.16, -s * 0.6);
    c.lineTo(-s * 0.4, -s * 0.6);
    c.closePath();
    c.fill();
  },
  /* the big red plunger button, and the signal leaving the antenna */
  remote: (c, s) => {
    c.fillStyle = "#ff5d73";
    c.beginPath();
    c.moveTo(-s * 0.34, s * 0.38);
    c.quadraticCurveTo(-s * 0.34, s * 0.04, 0, s * 0.04);
    c.quadraticCurveTo(s * 0.34, s * 0.04, s * 0.34, s * 0.38);
    c.quadraticCurveTo(s * 0.34, s * 0.72, 0, s * 0.72);
    c.quadraticCurveTo(-s * 0.34, s * 0.72, -s * 0.34, s * 0.38);
    c.fill();
    c.strokeStyle = "#fff3b0";
    c.lineWidth = s * 0.14;
    c.beginPath();
    c.moveTo(s * 0.7, -s * 1.16);
    c.quadraticCurveTo(s * 0.9, -s * 0.96, s * 0.76, -s * 0.76);
    c.moveTo(s * 0.9, -s * 1.18);
    c.quadraticCurveTo(s * 1.18, -s * 0.92, s * 0.96, -s * 0.64);
    c.stroke();
  },
  /* the hot core down the shaft, and the muzzle burst it was fired from */
  line: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(-s * 0.86, -s * 0.07);
    c.lineTo(s * 0.3, -s * 0.07);
    c.lineTo(s * 0.3, -s * 0.28);
    c.lineTo(s * 0.88, 0);
    c.lineTo(s * 0.3, s * 0.28);
    c.lineTo(s * 0.3, s * 0.07);
    c.lineTo(-s * 0.86, s * 0.07);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        r = i % 2 ? 0.15 : 0.42;
      const x = -s * 0.74 + Math.cos(a) * s * r,
        y = Math.sin(a) * s * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
    c.fill();
  },
  /* the white-hot heart of the blast, ringed by its inner flare */
  power: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        r = i % 2 ? 0.24 : 0.56;
      const x = Math.cos(a) * s * r,
        y = Math.sin(a) * s * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(-s * 0.22, 0);
    c.lineTo(0, -s * 0.22);
    c.lineTo(s * 0.22, 0);
    c.lineTo(0, s * 0.22);
    c.closePath();
    c.fill();
  },
  /* the brick it went through, split into shards behind the tip */
  pierce: (c, s) => {
    c.fillStyle = "#12203a";
    c.beginPath();
    c.moveTo(-s * 1.04, -s * 0.36);
    c.lineTo(-s * 0.66, -s * 0.16);
    c.lineTo(-s * 0.98, s * 0.04);
    c.closePath();
    c.moveTo(s * 1.04, -s * 0.36);
    c.lineTo(s * 0.66, -s * 0.16);
    c.lineTo(s * 0.98, s * 0.04);
    c.closePath();
    c.moveTo(-s * 0.88, s * 0.34);
    c.lineTo(-s * 0.5, s * 0.22);
    c.lineTo(-s * 0.68, s * 0.62);
    c.closePath();
    c.moveTo(s * 0.88, s * 0.34);
    c.lineTo(s * 0.5, s * 0.22);
    c.lineTo(s * 0.68, s * 0.62);
    c.closePath();
    c.fill();
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(0, -s * 0.92);
    c.lineTo(s * 0.22, -s * 0.4);
    c.lineTo(0, -s * 0.52);
    c.lineTo(-s * 0.22, -s * 0.4);
    c.closePath();
    c.fill();
  },
};
/* The cabinet five-beat: form shadow offset down-right (opposite the frozen
   warm key), RIM seal, body, upper-left sheen, one accent. A glyph in a
   well() is not standing on a floor, so beat 1 is a form shadow, not a
   contact ellipse. `time` is kept in the signature: every call site passes
   it and the idle echo lives in drawItemBody, not here. */
export function drawIcon(c, type, col, time) {
  const shape = ITEM_SHAPE[type];
  if (!shape) return;
  const s = CFG.TILE * 0.3,
    path = poly(shape);
  c.save();
  c.lineJoin = "round";
  c.lineCap = "round";
  path(c, s, 1, s * 0.07, s * 0.09);
  c.fillStyle = dk(col, 0.58);
  c.fill();
  path(c, s, 1, 0, 0);
  seal(c);
  c.fillStyle = col;
  c.fill();
  path(c, s, 0.62, 0, -s * 0.1);
  c.fillStyle = lt(col, 0.34);
  c.fill();
  ITEM_ACCENT[type](c, s, col);
  c.restore();
}
