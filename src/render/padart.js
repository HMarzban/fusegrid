// Controller and keyboard diagrams and the position glyphs, on the menu kit's colours: vector only, no images, no maker shapes. Ids are positions.
import { ACCENT, TEXT, MUTED, LINE, EDGE, WARM, font } from "./menudraw.js";
import { rr } from "./icons.js";

const FLAME = "#ff8a3c", WELL = "#0a0e18", CAP = "rgba(4,7,14,0.9)", BODY = "#16203a";

/** Reads an SVG-style path (M L H V C Q Z, absolute) into canvas calls, so the art draws on the headless stub too. */
export function trace(c, d) {
  const n = d.match(/[MLHVCQZ]|-?[\d.]+/g);
  let i = 0, x = 0, y = 0, op = "";
  const num = () => +n[i++];
  c.beginPath();
  while (i < n.length) {
    if (/[A-Z]/.test(n[i])) op = n[i++];
    if (op === "Z") { c.closePath(); continue; }
    if (op === "M") { x = num(); y = num(); c.moveTo(x, y); op = "L"; }
    else if (op === "L") { x = num(); y = num(); c.lineTo(x, y); }
    else if (op === "H") { x = num(); c.lineTo(x, y); }
    else if (op === "V") { y = num(); c.lineTo(x, y); }
    else if (op === "Q") { const a = num(), b = num(); x = num(); y = num(); c.quadraticCurveTo(a, b, x, y); }
    else if (op === "C") { const a = num(), b = num(), e = num(), f = num(); x = num(); y = num(); c.bezierCurveTo(a, b, e, f, x, y); }
  }
}
const circ = (x, y, r) => (c) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const rrp = (x, y, w, h, r) => (c) => rr(c, x, y, w, h, r);
const svg = (d) => (c) => trace(c, d);

export const BODY_PATH = "M150,48 L98,48 C84,48 72,50 64,58 C54,70 46,96 44,122 C42,144 46,160 58,164 C68,166 76,158 82,150 L98,138 C102,135 106,134 112,134 L188,134 C194,134 198,135 202,138 L218,150 C224,158 232,166 242,164 C254,160 258,144 256,122 C254,96 246,70 236,58 C228,50 216,48 202,48 Z";
const FUSE_PATH = "M150,58 C150,50 156,46 156,40 C156,34 150,34 150,28";
const CROSS = "M76,66 H88 V76 H98 V88 H88 V98 H76 V88 H66 V76 H76 Z";
const TRIG_L = "M72,40 L72,30 Q72,24 78,24 L102,24 Q108,24 108,30 L108,40 Z", TRIG_R = "M228,40 L228,30 Q228,24 222,24 L198,24 Q192,24 192,30 L192,40 Z";
const FACE = { N: [216, 64], E: [234, 82], S: [216, 100], W: [198, 82] };
/* leader: part -> [[points...], label x, label y, align] */
const LEAD = {
  TRL: [[[90, 24], [90, 14]], 90, 8, "center"], TRR: [[[210, 24], [210, 14]], 210, 8, "center"],
  SHL: [[[66, 44], [42, 44]], 40, 44, "right"], SHR: [[[234, 44], [258, 44]], 260, 44, "left"],
  dpad: [[[66, 82], [42, 82]], 40, 82, "right"],
  N: [[[224, 64], [252, 60], [258, 60]], 260, 60, "left"], E: [[[242, 82], [252, 76], [258, 76]], 260, 76, "left"],
  S: [[[224, 100], [252, 92], [258, 92]], 260, 92, "left"], W: [[[201, 89], [210, 112], [258, 112]], 260, 112, "left"],
  LS: [[[120, 125], [120, 176]], 120, 184, "center"], RS: [[[180, 125], [180, 172], [206, 172], [206, 176]], 206, 184, "center"],
  SELECT: [[[139, 78], [139, 176]], 139, 196, "center"], START: [[[161, 78], [161, 176]], 161, 184, "center"],
};
/** Each part as a function that builds its path on c. */
export const PARTS = {
  TRL: svg(TRIG_L), TRR: svg(TRIG_R), SHL: rrp(66, 38, 46, 22, 4), SHR: rrp(188, 38, 46, 22, 4), dpad: svg(CROSS),
  LS: circ(120, 112, 9), RS: circ(180, 112, 9), SELECT: rrp(132, 70, 14, 8, 4), START: rrp(154, 70, 14, 8, 4),
  N: circ(216, 64, 8), E: circ(234, 82, 8), S: circ(216, 100, 8), W: circ(198, 82, 8),
};
/** The fuse's lit tip: flame star, warm heart. */
export function spark(c, x, y, s) {
  c.fillStyle = FLAME;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2, r = (i % 2 ? 2 : 6) * s;
    i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  c.fillStyle = WARM;
  c.beginPath();
  c.arc(x, y, 2 * s, 0, 7);
  c.fill();
}
/* One highlight rule for pad and keyboard, on the path already built: lit = solid accent with a soft edge, alias = accent outline, swap = gold outline. */
function paintBuilt(c, s) {
  if (s === "lit") {
    c.save();
    c.strokeStyle = ACCENT; c.lineJoin = "round";
    c.globalAlpha = 0.12; c.lineWidth = 10; c.stroke();
    c.globalAlpha = 0.25; c.lineWidth = 6; c.stroke();
    c.restore();
    c.fillStyle = ACCENT; c.fill();
    return;
  }
  c.fillStyle = CAP; c.fill();
  c.lineWidth = s ? 2 : 1;
  c.strokeStyle = s === "alias" ? ACCENT : s === "swap" ? WARM : MUTED;
  c.stroke();
}
const paintPart = (c, id, s) => { PARTS[id](c); paintBuilt(c, s); };
const inkOf = (s) => (s === "lit" ? WELL : s === "alias" ? ACCENT : s === "swap" ? WARM : MUTED);
const GRIPS = [[54, 128, 64, 134], [54, 136, 66, 143], [54, 144, 66, 151], [246, 128, 236, 134], [246, 136, 234, 143], [246, 144, 234, 151]];
const ARROWS = [[82, 69, 79, 74, 85, 74], [82, 95, 79, 90, 85, 90], [69, 82, 74, 79, 74, 85], [95, 82, 90, 79, 90, 85]];
/** The controller. o: {parts:{id:state}, labels:{id:"WORD"}, spark, fs, grips}; state = lit | alias | swap. */
export function drawPad(c, x, y, k, o) {
  const q = o || {}, st = q.parts || {}, labels = q.labels || {};
  c.save(); c.translate(x, y); c.scale(k, k);
  for (const id of ["TRL", "TRR", "SHL", "SHR"]) paintPart(c, id, st[id]);
  trace(c, BODY_PATH); c.fillStyle = BODY; c.fill();
  c.strokeStyle = MUTED; c.lineWidth = 1.5; c.stroke();
  c.strokeStyle = LINE; c.lineWidth = 2; c.lineCap = "round";
  for (const [a, b, d, e] of GRIPS) { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); }
  if (q.grips) {
    for (const [w, al] of [[6, 0.25], [2, 1]]) {
      c.strokeStyle = ACCENT; c.lineWidth = w; c.globalAlpha = al;
      for (const [a, b, d, e] of GRIPS) { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); }
    }
    c.globalAlpha = 1;
  }
  // a fuse rises from the centre plate, lit only while a pad is connected
  c.strokeStyle = MUTED;
  trace(c, FUSE_PATH); c.stroke();
  c.lineCap = "butt";
  if (q.spark) spark(c, 150, 24, 1);
  rr(c, 126, 58, 48, 32, 4); c.fillStyle = WELL; c.fill();
  c.strokeStyle = EDGE; c.lineWidth = 1; c.stroke();
  paintPart(c, "dpad", st.dpad);
  c.fillStyle = inkOf(st.dpad);
  for (const [a, b, d, e, f, g] of ARROWS) { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.lineTo(f, g); c.closePath(); c.fill(); }
  for (const [id, cx] of [["LS", 120], ["RS", 180]]) {
    c.fillStyle = WELL; c.strokeStyle = EDGE; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, 112, 13, 0, 7); c.fill(); c.stroke();
    const s = st[id];
    if (s === "lit") paintPart(c, id, s);
    else { PARTS[id](c); c.fillStyle = BODY; c.fill(); c.strokeStyle = s === "alias" ? ACCENT : MUTED; c.lineWidth = s === "alias" ? 2 : 1; c.stroke(); }
    c.strokeStyle = s === "lit" ? WELL : LINE; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, 112, 5, 0, 7); c.stroke();
  }
  for (const f in FACE) {
    paintPart(c, f, st[f]);
    if (st[f] === "lit") { c.fillStyle = WELL; c.beginPath(); c.arc(FACE[f][0], FACE[f][1], 2.5, 0, 7); c.fill(); }
  }
  for (const id of ["SELECT", "START"]) paintPart(c, id, st[id]);
  for (const id in labels) {
    const L = LEAD[id];
    if (!L || (id === "SELECT" && labels.START === labels.SELECT)) continue; // the alias keeps its row; no second leader
    const s = st[id], col = s === "swap" ? WARM : s ? ACCENT : LINE;
    c.strokeStyle = col; c.lineWidth = s ? 1.5 : 1;
    c.beginPath();
    L[0].forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.stroke();
    c.fillStyle = s ? col : MUTED;
    c.font = font((q.fs || 10) / k, s ? "900" : ""); c.textAlign = L[3]; c.textBaseline = "middle";
    c.fillText(labels[id], L[1], L[2]);
  }
  c.restore();
}
/* Keyboard, u=20, true stagger. [id,label,x,w]; a null label is a ghost cap. */
const LETTERS = (s, x0) => [...s].map((ch, i) => ["Key" + ch, null, x0 + i * 20]);
export const KB_ROWS = [
  [30, [["Escape", "ESC", 0, 30]]],
  [52, [[0, null, 0, 28], ...LETTERS("QWERTYUIOP", 30)]],
  [72, [[0, null, 0, 34], ...LETTERS("ASDFGHJKL", 36), ["Enter", "ENTER", 216, 44]]],
  [92, [["ShiftLeft", null, 0, 44], ...LETTERS("ZXCVBNM", 46), ["Comma", null, 186], ["Period", null, 206], ["Slash", null, 226], ["ArrowUp", "U", 260]]],
  [112, [[0, null, 0, 30], [0, null, 32, 38], ["Space", "SPACE", 72, 122], [0, null, 196, 30], ["ArrowLeft", "L", 240], ["ArrowDown", "D", 260], ["ArrowRight", "R", 280]]],
];
const ARROW = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const shortKey = (id) => (id === "ShiftLeft" ? "SHIFT" : id === "Comma" ? "," : id === "Period" ? "." : id === "Slash" ? "/" : id.replace("Key", ""));
/** The keyboard. o: {keys:{code:state}, base:Set of always-labelled codes, names:{code:printed}, labels:[[points],x,y,align,word], fs}. Type floors at 10 px on screen. */
export function drawKeys(c, x, y, k, o) {
  const q = o || {}, st = q.keys || {}, base = q.base || new Set(), names = q.names || {};
  c.save(); c.translate(x, y); c.scale(k, k);
  rr(c, -6, 24, 312, 112, 6); c.fillStyle = BODY; c.fill();
  c.strokeStyle = MUTED; c.lineWidth = 1.5; c.stroke();
  for (const [ry, row] of KB_ROWS) for (const [id, lab0, kx, kw] of row) {
    const w = kw || 18, s = st[id], lab = lab0 || (id && (s || base.has(id)) ? (names[id] ? String(names[id]).toUpperCase() : shortKey(id)) : null);
    rr(c, kx + 0.5, ry + 0.5, w - 1, 17, 2);
    if (!lab) {
      c.fillStyle = CAP; c.fill();
      c.save(); c.globalAlpha = 0.45; c.strokeStyle = MUTED; c.lineWidth = 1; c.stroke(); c.restore();
      continue;
    }
    paintBuilt(c, s);
    const ink = s === "lit" ? WELL : s === "alias" ? ACCENT : s === "swap" ? WARM : TEXT;
    if (ARROW[id]) {
      const [dx, dy] = ARROW[id], mx = kx + w / 2, my = ry + 9;
      c.fillStyle = ink; c.beginPath();
      c.moveTo(mx + dx * 4, my + dy * 4); c.lineTo(mx - dx * 3 + dy * 4, my - dy * 3 + dx * 4); c.lineTo(mx - dx * 3 - dy * 4, my - dy * 3 - dx * 4);
      c.closePath(); c.fill();
    } else {
      c.fillStyle = ink; c.font = font(Math.max(lab.length > 1 ? 9 : 11, 10 / k), "900"); c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(lab, kx + w / 2, ry + 9.5);
    }
  }
  for (const [pts, lx, ly, al, word] of q.labels || []) {
    c.strokeStyle = ACCENT; c.lineWidth = 1.5;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.stroke();
    c.fillStyle = ACCENT; c.font = font((q.fs || 10) / k, "900"); c.textAlign = al; c.textBaseline = "middle";
    c.fillText(word, lx, ly);
  }
  c.restore();
}
/* A rounded rect with square bottom corners, for the trigger glyph. */
function rrTop(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x, y + h); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
  c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h); c.closePath();
}
/** A position glyph, box h tall, top-left at x,y-h/2; returns its width. Always shown beside a word. */
export function glyph(c, kind, x, y, h, v, col) {
  const k = h / 16, on = col || TEXT, off = MUTED;
  c.save(); c.translate(x, y - h / 2); c.scale(k, k); c.lineWidth = 1.2; c.lineJoin = "round";
  let w = 16;
  if (kind === "face") {
    const D = { N: [8, 3.5], E: [12.5, 8], S: [8, 12.5], W: [3.5, 8] };
    for (const f in D) { c.fillStyle = f === v ? on : off; c.beginPath(); c.arc(D[f][0], D[f][1], f === v ? 3 : 1.4, 0, 7); c.fill(); }
  } else if (kind === "dpad") {
    trace(c, "M5.5,1 H10.5 V5.5 H15 V10.5 H10.5 V15 H5.5 V10.5 H1 V5.5 H5.5 Z");
    c.strokeStyle = off; c.stroke();
    c.fillStyle = on;
    if (v === "all") c.fill();
    if (v === "U") c.fillRect(5.5, 1, 5, 5);
    if (v === "D") c.fillRect(5.5, 10, 5, 5);
    if (v === "L") c.fillRect(1, 5.5, 5, 5);
    if (v === "R") c.fillRect(10, 5.5, 5, 5);
  } else if (kind === "shoulder" || kind === "trigger") {
    rr(c, 1, 10, 14, 4, 2); c.strokeStyle = off; c.stroke();
    for (const m of [0, 1]) {
      const act = (m ? "R" : "L") === v;
      if (kind === "shoulder") rr(c, m ? 8.5 : 1.5, 6, 6, 3, 1);
      else if (act) rrTop(c, m ? 9 : 2, 1, 5, 8, 2.5);
      else rrTop(c, m ? 9 : 2, 4, 5, 5, 2.5);
      if (act) { c.fillStyle = on; c.fill(); } else { c.strokeStyle = off; c.stroke(); }
    }
  } else if (kind === "stick") {
    w = 18;
    for (const m of [0, 1]) {
      const act = (m ? "R" : "L") === v, cx = m ? 13.5 : 4.5;
      c.strokeStyle = act ? on : off; c.beginPath(); c.arc(cx, 8, act ? 4 : 2, 0, 7); c.stroke();
      if (act) { c.fillStyle = on; c.beginPath(); c.arc(cx, 8, 2.5, 0, 7); c.fill(); }
    }
  } else if (kind === "centre") {
    for (const [px, id] of [[0.5, "SELECT"], [8.5, "START"]]) {
      rr(c, px, 5.5, 7, 5, 2.5);
      if (v === id) { c.fillStyle = on; c.fill(); } else { c.strokeStyle = off; c.lineWidth = 1; c.stroke(); }
    }
  }
  c.restore();
  return w * k;
}
