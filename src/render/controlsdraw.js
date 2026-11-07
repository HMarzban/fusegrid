// CONTROLS page paint, on the menu kit: plate, head, foot, paintRow, segs and the MENU pane's cell, paneHead and paneLine. Static: nothing here reads the clock.
import { ACCENT, TEXT, MUTED, LINE, WARM, font, sans, spaced, mw, clip, wrap, plate, head, foot, paintRow, lockGlyph, cell, segs, paneHead, paneLine, drawDim } from "./menudraw.js";
import { drawPad, drawKeys, glyph, spark } from "./padart.js";
import { geoFor, geomOf, rowsOf, statusOf, footOf, padStates, keyStates, padLabels, keyLabels, CAPTION } from "./controlsgeo.js";

const BASE_KEYS = new Set(["KeyQ", "KeyW", "KeyE", "KeyP", "KeyA", "KeyS", "KeyD", "KeyJ", "KeyX"]);
const VAL_PX = 12, GLYPH_H = 16, TOK_GAP = 12, TAB_LABEL = ["KEYBOARD", "CONTROLLER"], SEG_W = 6, SEG_GAP = 2, WIDEST = "MEDIUM";
const tokW = (c, t) => (t.g === "stick" ? 18 : 16) * (GLYPH_H / 16) + 4 + mw(c, t.w);
const padOff = (s) => s.tab === "pad" && (!s.pad || s.pad.state === "none" || s.pad.state === "lost");
/* Dashes are short strokes: the headless stub has no line dash. */
function dashCircle(c, x, y, r, n) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n;
    c.beginPath();
    c.arc(x, y, r, a, a + (Math.PI * 2 * 0.55) / n);
    c.stroke();
  }
}
function dashLine(c, x0, y0, x1, y1) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / 7));
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 0.57) / n;
    c.beginPath(); c.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a); c.lineTo(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b); c.stroke();
  }
}
/* The swap mark: two opposed arrows, in front of the word. */
function swapMark(c, x, cy) {
  c.strokeStyle = WARM; c.lineWidth = 1.5; c.lineCap = "round";
  c.beginPath();
  c.moveTo(x, cy - 3); c.lineTo(x + 11, cy - 3); c.lineTo(x + 8, cy - 6);
  c.moveTo(x + 11, cy + 3); c.lineTo(x, cy + 3); c.lineTo(x + 3, cy + 6);
  c.stroke();
  c.lineCap = "butt";
}
/* The value at the row's right edge: glyph + word on a pad, plain key names as OPTIONS prints values. */
function drawValue(c, v, rx, cy, room) {
  c.font = font(VAL_PX);
  c.textBaseline = "middle";
  c.fillStyle = TEXT;
  if (v[0].cap) {
    c.textAlign = "right";
    c.fillText(clip(c, v.map((t) => t.cap).join(" · "), room), rx, cy);
    return;
  }
  let x = rx - v.reduce((a, t) => a + tokW(c, t), 0) - (v.length - 1) * TOK_GAP;
  c.textAlign = "left";
  for (const t of v) {
    x += glyph(c, t.g, x, cy, GLYPH_H, t.v, TEXT) + 4;
    c.font = font(VAL_PX); c.fillStyle = TEXT; c.textAlign = "left"; c.textBaseline = "middle";
    c.fillText(t.w, x, cy);
    x += mw(c, t.w) + TOK_GAP;
  }
}
const valW = (c, v) => { c.font = font(VAL_PX); return v[0].cap ? mw(c, v.map((t) => t.cap).join(" · ")) : v.reduce((a, t) => a + tokW(c, t), 0) + (v.length - 1) * TOK_GAP; };
/** One row: paintRow, then its value. A row with nothing behind it dims whole, as OPTIONS does (no pad, or no actuator); fixed rows keep full alpha and take the padlock. */
export function drawRow(c, r, g, sel, s, touch) {
  const { x, y, w, h } = g, swapped = !!s.swap && s.swap.row === r.id, armed = !!s.armed && !!r.reset, label = r.label || r.id, cy = y + h / 2, dim = r.off || r.none, dot = r.changed && !swapped;
  c.globalAlpha = dim ? 0.45 : 1;
  paintRow(c, x, y, w, h, label, "", sel || swapped, { touch, danger: !!r.reset, warm: swapped, caret: sel });
  const end = x + 26 + mw(c, label), rx = x + w - 12 - (r.fixed ? 18 : 0);
  let left = dot ? end + 14 : end + 8;
  if (dot) { c.fillStyle = ACCENT; c.beginPath(); c.arc(end + 6, cy - 5, 2, 0, 7); c.fill(); }
  if (swapped) {
    swapMark(c, left, cy);
    c.fillStyle = WARM; c.font = font(10, "900"); c.textAlign = "left"; c.textBaseline = "middle";
    c.fillText("SWAPPED", left + 15, cy);
    left += 15 + mw(c, "SWAPPED") + 8;
  }
  if (armed) { c.fillStyle = TEXT; c.font = font(VAL_PX); c.textAlign = "right"; c.textBaseline = "middle"; c.fillText("PRESS AGAIN", rx, cy); }
  else if (r.val) {
    const whole = valW(c, r.val) <= rx - left, v = whole ? r.val : [r.val[r.id === "PAUSE" ? r.val.length - 1 : 0]];
    drawValue(c, v, rx, cy, rx - left);
  } else if (r.text) { c.fillStyle = TEXT; c.font = font(VAL_PX); c.textAlign = "right"; c.textBaseline = "middle"; c.fillText(r.text, rx, cy); }
  c.globalAlpha = 1;
  if (r.fixed) lockGlyph(c, x + w - 18, cy, 12, MUTED);
  if (r.bar && sel && !r.off) {
    c.font = font(VAL_PX);
    const [lit, n] = r.bar, bw = n * (SEG_W + SEG_GAP) - SEG_GAP, bx = rx - mw(c, WIDEST) - 10 - bw; // a slot sized for the widest word, so the bar never jumps
    if (bx >= left) for (let i = 0; i < n; i++) { c.fillStyle = i < lit ? ACCENT : LINE; c.fillRect(bx + i * (SEG_W + SEG_GAP), cy - 4, SEG_W, 8); }
  }
}
/* What the stick does, in one read: DRIFT is the peak at rest over 2 s, READS the resolver's own on-state. */
const driftWord = (s) => "DRIFT " + (s.drift || 0).toFixed(2), readsWord = (s) => "READS " + (s.reads || "NOTHING");
/** The live stick: a dashed ring at the level, the dot, and what it reads. */
export function stickView(c, s, x, y, r) {
  const dz = (s.dead == null ? 25 : s.dead) / 100, v = s.stickVal || [0, 0], out = !!s.reads, f = (n) => (n >= 0 ? "+" : "") + n.toFixed(2);
  c.strokeStyle = MUTED; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
  c.strokeStyle = TEXT; dashCircle(c, x, y, r * dz, 12);
  c.lineWidth = 1.5; c.strokeStyle = ACCENT; c.fillStyle = ACCENT;
  c.beginPath(); c.arc(x + v[0] * r, y + v[1] * r, 4, 0, 7);
  out ? c.fill() : c.stroke();
  const tx = x + r + 12;
  c.fillStyle = TEXT; c.font = font(10); c.textAlign = "left"; c.textBaseline = "middle";
  c.fillText("X " + f(v[0]) + "  Y " + f(v[1]), tx, y - 16);
  c.fillStyle = MUTED;
  c.fillText(driftWord(s), tx, y);
  c.fillStyle = out ? ACCENT : MUTED; c.font = font(10, "900");
  c.fillText(readsWord(s), tx, y + 16);
}
/* A rule's lines: its parts split at " · " where it runs long, each wrapped to two. */
function ruleLines(c, s, w) {
  c.font = font(10, "700");
  if (mw(c, s) <= w) return [s];
  const i = s.indexOf(" · ");
  return i > 0 ? [...noWidow(wrap(c, s.slice(0, i), w, 2)), ...noWidow(wrap(c, s.slice(i + 3), w, 2))] : noWidow(wrap(c, s, w, 2));
}
/* No word sits alone on a last line: its neighbour comes down with it. */
function noWidow(L) {
  if (L.length < 2 || L[L.length - 1].includes(" ")) return L;
  const a = L[L.length - 2], k = a.lastIndexOf(" ");
  return k < 0 ? L : [...L.slice(0, -2), a.slice(0, k), a.slice(k + 1) + " " + L[L.length - 1]];
}
function drawRule(c, P, bottom, s, col) {
  const L = ruleLines(c, s, P.w - 20);
  L.forEach((l, i) => paneLine(c, P, bottom - (L.length - 1 - i) * 13, l, col, 10, "center"));
}
/** The preview pane, as MENU's: head, diagram, rule. */
function drawPane(c, s, row, G) {
  const P = G.pane, off = padOff(s), nonstd = s.tab === "pad" && !off && s.pad.state === "nonstd", A = G.art;
  cell(c, P);
  const lv = !off && row.text; // the level word; the row's dot still says changed
  paneHead(c, P, row.label || row.id, lv || (row.changed ? "CHANGED" : ""), lv && (row.none || row.text === "OFF") ? MUTED : ACCENT);
  if (row.id === "SENSITIVITY" && !off) {
    const r = Math.min(56, A.h / 2 - 4);
    stickView(c, s, P.x + 16 + r, A.y + A.h / 2, r);
  } else if (s.tab === "key") drawKeys(c, G.keys.x, G.keys.y, G.keys.k, { keys: row.reset ? {} : keyStates(s, row.id), labels: row.reset ? [] : keyLabels(s, row.id), base: BASE_KEYS, names: s.names, fs: 10 });
  else if (nonstd) paneLine(c, P, A.y + A.h / 2, "NO DIAGRAM FOR THIS PAD", MUTED, 11, "center");
  else {
    const parts = off || row.reset ? {} : padStates(s, row.id), all = off || row.reset ? {} : padLabels(s);
    /* A rule past two lines takes the pad's empty foot, then lifts it into the empty top; never over the grips. */
    const k = G.pad.k, lift = Math.max(0, Math.min(24 * k, (ruleLines(c, statusOf(s, row), P.w - 20).length - 2) * 13 - 31 * k));
    drawPad(c, G.pad.x, G.pad.y - lift, k, { parts, labels: Object.fromEntries(Object.entries(all).filter(([id]) => parts[id])), spark: !off, fs: 10, grips: row.id === "VIBRATION" && !off && !row.none && row.text !== "OFF" });
    if (off) paneLine(c, P, A.y + A.h - 8, s.device === "touch" ? CAPTION.touch : CAPTION.none, TEXT, 10, "center");
  }
  drawRule(c, P, P.y + P.h - 10, statusOf(s, row), s.swap ? WARM : TEXT);
}
/** The listening plate: a kit plate, a static dashed slot with the lit fuse running into it. No timer. */
export function drawCapture(c, cap, G) {
  const { x, y, w, h } = G.cap, mid = x + w / 2, sw = 64, sh = 30, sy = y + 58, sx = mid - sw / 2, fy = sy + sh / 2;
  drawDim(c, 0.72, G.W, G.H);
  plate(c, x, y, w, h);
  head(c, { mid, headY: y + 26 }, cap.prompt, "REBIND " + cap.action);
  c.strokeStyle = TEXT; c.lineWidth = 2;
  dashLine(c, sx, sy, sx + sw, sy); dashLine(c, sx + sw, sy, sx + sw, sy + sh); dashLine(c, sx + sw, sy + sh, sx, sy + sh); dashLine(c, sx, sy + sh, sx, sy);
  c.fillStyle = WARM; c.font = font(14, "900"); c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("· · ·", mid, fy + 0.5);
  c.strokeStyle = MUTED; c.lineWidth = 3; c.lineCap = "round";
  c.beginPath(); c.moveTo(sx - 4, fy); c.bezierCurveTo(sx - 26, fy - 6, sx - 34, fy + 8, sx - 54, fy + 2); c.stroke();
  c.lineCap = "butt";
  spark(c, sx - 60, fy + 2, 1.5);
  paneLine(c, G.cap, y + 104, cap.sub || "", cap.warn ? WARM : MUTED, 11, "center");
  foot(c, { mid, footY: y + h - 16 }, clip(c, cap.foot || "", w - 16));
}
/** The whole page. view = the reducer's View; ui = {touch, narrow, scale, words}. */
export function drawControls(c, L, view, ui) {
  const u = ui || {}, s = view, G = geoFor(L, u.touch, u.narrow, u.scale), S = G.S, rows = rowsOf(s), sel = Math.min(s.row | 0, rows.length - 1), row = rows[sel], st = s.pad && s.pad.state, off = padOff(s);
  plate(c, S.x, S.y, S.w, S.h);
  c.font = sans(10, "600");
  spaced(c, true); // head() draws its kicker spaced: measure it so, or a long pad id overruns
  const kicker = clip(c, s.tab === "key" ? "KEYS + CONTROLLER" : off ? (st === "lost" ? "CONTROLLER LOST" : "NO CONTROLLER YET") : "CONNECTED · " + ((s.pad && s.pad.name) || "CONTROLLER"), S.w - 40);
  spaced(c, false);
  head(c, S, "CONTROLS", kicker);
  segs(c, G.tabs, TAB_LABEL, s.tab === "key" ? 0 : 1, null, G.touch);
  rows.forEach((r, i) => drawRow(c, r, geomOf(i, G), i === sel, s, G.touch));
  if (G.pane) drawPane(c, s, row, G);
  else drawRule(c, { x: S.ix - 8, w: S.iw + 16 }, G.statusY + 13, statusOf(s, row) + (row.id === "SENSITIVITY" && !off && !s.status ? " · " + driftWord(s) + " · " + readsWord(s) : ""), s.swap ? WARM : TEXT);
  const ft = footOf(s, row, u.words);
  c.font = font(10);
  foot(c, S, mw(c, ft) <= S.w - 24 ? ft : footOf(s, row, u.words, true));
  if (s.capture) drawCapture(c, s.capture, G);
}
