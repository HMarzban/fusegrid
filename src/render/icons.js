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

/* ---- items / power-up icons (cabinet glyphs, readable at 40px) ---- */
export const ITEM_SHAPE = {
  fire: [
    [0, -1.05],
    [0.34, -0.42, 0.3, -0.8],
    [0.62, 0.12, 0.62, -0.16],
    [0.44, 0.72, 0.62, 0.52],
    [0, 0.92, 0.2, 0.92],
    [-0.44, 0.72, -0.2, 0.92],
    [-0.62, 0.12, -0.62, 0.52],
    [-0.34, -0.42, -0.62, -0.16],
  ],
  bomb: [
    [0, -0.92],
    [0.46, -0.6, 0.3, -0.86],
    [0.38, -0.34],
    [0.62, -0.06],
    [0.52, 0.28],
    [0.74, 0.52, 0.7, 0.36],
    [0, 0.96, 0.52, 0.96],
    [-0.74, 0.52, -0.52, 0.96],
    [-0.52, 0.28, -0.7, 0.36],
    [-0.62, -0.06],
    [-0.38, -0.34],
    [-0.46, -0.6],
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
  kick: [[-0.9, -0.34], [0.34, -0.42], [0.98, -0.8], [1.06, -0.1], [0.4, 0.44], [-0.86, 0.36]],
  throw: [[0, -1.0], [0.66, 0.1], [0.34, 0.62], [0, 0.44], [-0.34, 0.62], [-0.66, 0.1]],
  pass: [
    [-0.92, -0.62], [-0.34, -0.62], [-0.34, 0.16], [0.34, 0.16],
    [0.34, -0.62], [0.92, -0.62], [0.92, 0.7], [-0.92, 0.7],
  ],
  remote: [[-0.86, -0.56], [0.3, -0.56], [0.3, -0.16], [0.86, -0.16], [0.86, 0.62], [-0.86, 0.62]],
  line: [[-1.1, 0], [-0.22, -0.2], [0.22, -0.2], [1.1, 0], [0.22, 0.2], [-0.22, 0.2]],
  power: [
    [0, -1.1], [0.26, -0.26], [1.1, 0], [0.26, 0.26],
    [0, 1.1], [-0.26, 0.26], [-1.1, 0], [-0.26, -0.26],
  ],
  pierce: [
    [0, -1.15], [0.2, -0.34], [0.54, -0.16], [0.28, 0.06], [0.34, 0.66],
    [0, 0.44], [-0.34, 0.66], [-0.28, 0.06], [-0.54, -0.16], [-0.2, -0.34],
  ],
};
export const ITEM_ACCENT = {
  fire: (c, s) => {
    c.fillStyle = "#ffd447";
    c.beginPath();
    c.moveTo(0, -s * 0.46);
    c.quadraticCurveTo(s * 0.3, s * 0.1, 0, s * 0.5);
    c.quadraticCurveTo(-s * 0.3, s * 0.1, 0, -s * 0.46);
    c.fill();
  },
  bomb: (c, s) => {
    c.strokeStyle = "#ffd447";
    c.lineWidth = s * 0.16;
    c.beginPath();
    c.moveTo(s * 0.2, -s * 0.72);
    c.quadraticCurveTo(s * 0.46, -s * 0.9, s * 0.52, -s * 1.06);
    c.stroke();
    c.fillStyle = "#ffd447";
    c.beginPath();
    c.moveTo(s * 0.52, -s * 1.14);
    c.lineTo(s * 0.68, -s * 1.0);
    c.lineTo(s * 0.52, -s * 0.86);
    c.lineTo(s * 0.36, -s * 1.0);
    c.closePath();
    c.fill();
    c.strokeStyle = "#ffffff";
    c.lineWidth = s * 0.14;
    c.beginPath();
    c.moveTo(-s * 0.2, s * 0.2);
    c.lineTo(s * 0.2, s * 0.2);
    c.moveTo(0, 0);
    c.lineTo(0, s * 0.4);
    c.stroke();
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
  kick: (c, s) => {
    c.fillStyle = "#ffce8a";
    c.beginPath();
    c.moveTo(s * 0.4, -s * 0.52);
    c.lineTo(s * 0.92, -s * 0.66);
    c.lineTo(s * 0.96, -s * 0.14);
    c.lineTo(s * 0.46, s * 0.1);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(-s * 0.98, -s * 0.14);
    c.lineTo(-s * 0.56, s * 0.02);
    c.lineTo(-s * 0.98, s * 0.18);
    c.lineTo(-s * 0.78, s * 0.02);
    c.closePath();
    c.fill();
  },
  throw: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(0, -s * 0.72);
    c.lineTo(s * 0.2, s * 0.06);
    c.lineTo(0, s * 0.3);
    c.lineTo(-s * 0.2, s * 0.06);
    c.closePath();
    c.fill();
    c.strokeStyle = "#fff3b0";
    c.lineWidth = s * 0.14;
    c.beginPath();
    c.moveTo(-s * 0.86, s * 0.52);
    c.quadraticCurveTo(-s * 0.3, -s * 0.3, s * 0.52, s * 0.1);
    c.stroke();
  },
  pass: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(-s * 0.6, -s * 0.48);
    c.lineTo(-s * 0.38, -s * 0.48);
    c.lineTo(-s * 0.38, s * 0.16);
    c.lineTo(-s * 0.6, s * 0.16);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(s * 0.38, -s * 0.48);
    c.lineTo(s * 0.6, -s * 0.48);
    c.lineTo(s * 0.6, s * 0.16);
    c.lineTo(s * 0.38, s * 0.16);
    c.closePath();
    c.fill();
  },
  remote: (c, s) => {
    c.fillStyle = "#ff5d73";
    c.beginPath();
    c.moveTo(s * 0.38, -s * 0.06);
    c.lineTo(s * 0.78, -s * 0.06);
    c.lineTo(s * 0.78, s * 0.3);
    c.lineTo(s * 0.38, s * 0.3);
    c.closePath();
    c.fill();
  },
  line: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(-s * 0.86, 0);
    c.lineTo(-s * 0.18, -s * 0.08);
    c.lineTo(s * 0.18, -s * 0.08);
    c.lineTo(s * 0.86, 0);
    c.lineTo(s * 0.18, s * 0.08);
    c.lineTo(-s * 0.18, s * 0.08);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(-s * 0.52, -s * 0.34);
    c.lineTo(-s * 0.28, -s * 0.34);
    c.lineTo(-s * 0.28, -s * 0.24);
    c.lineTo(-s * 0.52, -s * 0.24);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(s * 0.28, s * 0.24);
    c.lineTo(s * 0.52, s * 0.24);
    c.lineTo(s * 0.52, s * 0.34);
    c.lineTo(s * 0.28, s * 0.34);
    c.closePath();
    c.fill();
  },
  power: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(0, -s * 0.86);
    c.lineTo(s * 0.14, -s * 0.14);
    c.lineTo(s * 0.86, 0);
    c.lineTo(s * 0.14, s * 0.14);
    c.lineTo(0, s * 0.86);
    c.lineTo(-s * 0.14, s * 0.14);
    c.lineTo(-s * 0.86, 0);
    c.lineTo(-s * 0.14, -s * 0.14);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(-s * 0.16, 0);
    c.lineTo(0, -s * 0.16);
    c.lineTo(s * 0.16, 0);
    c.lineTo(0, s * 0.16);
    c.closePath();
    c.fill();
  },
  pierce: (c, s) => {
    c.fillStyle = "#12203a";
    c.beginPath();
    c.moveTo(-s * 0.86, -s * 0.2);
    c.lineTo(-s * 0.44, -s * 0.2);
    c.lineTo(-s * 0.44, s * 0.34);
    c.lineTo(-s * 0.86, s * 0.34);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(s * 0.44, -s * 0.2);
    c.lineTo(s * 0.86, -s * 0.2);
    c.lineTo(s * 0.86, s * 0.34);
    c.lineTo(s * 0.44, s * 0.34);
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
