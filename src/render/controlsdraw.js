// CONTROLS page paint, on the menu kit: plate, head, foot, paintRow, segs and the MENU pane's cell, paneHead and paneLine. Static: nothing here reads the clock.
import { ACCENT, TEXT, MUTED, LINE, WARM, font, sans, spaced, mw, clip, wrap, plate, head, foot, paintRow, lockGlyph, cell, segs, paneHead, paneLine, drawDim } from "./menudraw.js";
import { drawPad, drawCallouts, drawKeys, glyph, padBox, kbPrints, kbLegend, KB_AT } from "./padart.js";
import { geoFor, geomOf, rowsOf, statusOf, footOf, padStates, padRing, padCallouts, padFit, keyStates, keyRing, keyCallouts, kbFit, CAPTION, PAD_TALL } from "./controlsgeo.js";
import { worldTokens } from "./kit/tokens.js";
import { textScale } from "./kit/type.js";
import { CONTROLS_WORDS } from "./words.js";

const ARMED = ["PRESS AGAIN", "AGAIN"], VAL_PX = 12, GLYPH_H = 16, TOK_GAP = 12, TAB_LABEL = ["KEYBOARD", "CONTROLLER"], SEG_W = 6, SEG_GAP = 2, WIDEST = "MEDIUM";
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
  if (armed) { c.fillStyle = TEXT; c.font = font(VAL_PX); c.textAlign = "right"; c.textBaseline = "middle"; const say = ARMED.find((w) => mw(c, w) <= rx - left); if (say) c.fillText(say, rx, cy); } // a long label steps the word down, then leaves it to the rule line
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
const ruleMemo = new WeakMap(); // per context: the lines of (text, width), so a steady frame measures no rule
function ruleLines(c, s, w) {
  let M = ruleMemo.get(c);
  if (!M) ruleMemo.set(c, (M = new Map()));
  const k = s + "|" + w;
  if (!M.has(k)) { if (M.size > 32) M.clear(); M.set(k, ruleLines0(c, s, w)); }
  return M.get(k);
}
function ruleLines0(c, s, w) {
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
/* The callout type: ACTION at the pane's primary size, the position a step down, both scaled with the kit's text scale. */
const metrics = (c) => { const ts = textScale(); return { pri: 13 * ts, sec: 11 * ts, wOf: (s, px) => { c.font = sans(px, "700"); return mw(c, s); } }; };
/* The last fit, kept while its inputs hold, so a steady frame never re-plans. */
let fitMemo = { k: "", F: null };
function fitPad(c, aw, ah, it, lit) {
  const k = [aw, ah, textScale(), JSON.stringify(it)].join("|");
  if (fitMemo.k !== k) fitMemo = { k, F: padFit(aw, ah, it, metrics(c), lit) };
  return fitMemo.F;
}
/** The controller in its art box: every bound input in the world's brick, the focused row's button ringed, the callouts where they fit (else none:
    the row and its value name the button). off = no controller: the locked body, every input a well, the plaque under it. */
function drawPadArt(c, s, row, A, tok, ui) {
  const off = padOff(s), lit = off ? {} : padStates(s), it = off ? [] : padCallouts(s), plq = off ? 34 : 0;
  const F = fitPad(c, A.w, A.h - plq, it, lit), ox = A.x + F.ox, oy = A.y + F.oy, W = off ? F.W * 0.82 : F.W;
  drawPad(c, ox + (F.W - W) / 2, oy, W, { tok, lit, lock: off, ring: off ? null : padRing(s, row.id), press: s.echo, grips: row.id === "VIBRATION" && !off && !row.none && row.text !== "OFF", reduced: !!ui.reduced });
  _dbg.plan = F.plan;
  if (F.plan) drawCallouts(c, ox, oy, F.plan, tok);
  if (off) {
    const P = { x: A.x, w: A.w }, y = A.y + A.h - plq;
    c.fillStyle = TEXT; c.font = sans(13, "800"); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(NO_PAD, A.x + A.w / 2, y + 8);
    paneLine(c, P, y + 26, CAPTION.none, TEXT, 10, "center");
  }
}
const NO_PAD = CONTROLS_WORDS.NONE;
/** The plan the last drawing used (null when it drew no leaders): tests hold its callout strings apart, as MENU's card. */
export const _dbg = { plan: null, legends: [] };
let kbMemo = { k: "", F: null };
/** The keyboard in its art box: the bound keys and the fixed ESC and arrows in the brick, the focused row's key ringed, the callouts where they fit;
    legends print where they fit their top face (none at a phone's pitch: the rows name every key). */
function drawKeyArt(c, s, row, A, tok) {
  const lit = keyStates(s), it = keyCallouts(s), ts = textScale(), key = [A.w, A.h, ts, JSON.stringify(it), Object.keys(lit).sort().join()].join("|");
  if (kbMemo.k !== key) { // the fit and the printed legends measure once, never on a steady frame
    const m = metrics(c), F = kbFit(A.w, A.h, it, m), prints = kbPrints(F.k, lit, m.wOf, ts);
    kbMemo = { k: key, F, prints, legends: Object.keys(prints).filter((id) => id !== "Backspace").map((id) => KB_AT[id].leg) };
  }
  const { F, prints } = kbMemo, ox = A.x + F.ox, oy = A.y + F.oy;
  _dbg.legends = kbMemo.legends;
  drawKeys(c, ox, oy, F.k, { tok, lit, ring: keyRing(s, row.id), prints, px: kbLegend(F.k, ts) });
  _dbg.plan = F.plan;
  if (F.plan) drawCallouts(c, ox, oy, F.plan, tok);
}
/** The preview pane, as MENU's: head, drawing, rule. */
function drawPane(c, s, row, G, tok, ui) {
  const P = G.pane, off = padOff(s), nonstd = s.tab === "pad" && !off && s.pad.state === "nonstd", A = G.art;
  cell(c, P);
  const lv = !off && row.text; // the level word; the row's dot still says changed
  paneHead(c, P, row.label || row.id, lv || (row.changed ? "CHANGED" : ""), lv && (row.none || row.text === "OFF") ? MUTED : ACCENT);
  const rule = statusOf(s, row), more = Math.max(0, ruleLines(c, rule, P.w - 20).length - 1) * 13; // a long rule takes the drawing's foot
  if (row.id === "SENSITIVITY" && !off) {
    const r = Math.min(56, A.h / 2 - 4);
    stickView(c, s, P.x + 16 + r, A.y + A.h / 2, r);
  } else if (s.tab === "key") drawKeyArt(c, s, row, { x: P.x + 6, y: A.y, w: P.w - 12, h: A.h - more }, tok);
  else if (nonstd) paneLine(c, P, A.y + A.h / 2, NO_DRAWING, MUTED, 11, "center");
  else drawPadArt(c, s, row, { x: P.x + 6, y: A.y, w: P.w - 12, h: A.h - more }, tok, ui);
  drawRule(c, P, P.y + P.h - 10, rule, s.swap ? WARM : TEXT);
}
const NO_DRAWING = "NO DRAWING FOR THIS CONTROLLER";
/** The listening plate: a kit plate, the prompt, what is listened for and how to cancel. Static: nothing counts down. On the controller tab the drawing
    shows every input quiet but the action's own button, ringed; on the keyboard a dashed slot waits for the key. */
export function drawCapture(c, cap, G, pad) {
  const { x, y, w, h } = G.cap, mid = x + w / 2;
  drawDim(c, 0.72, G.W, G.H);
  plate(c, x, y, w, h);
  head(c, { mid, headY: y + 26 }, cap.prompt, "REBIND " + cap.action);
  const top = y + 48, room = h - 48 - 52;
  if (pad && pad.tok) {
    const W = Math.min(150, w - 40, room / PAD_TALL), B = padBox(W), px = mid - W / 2, py = top + (room - (B.y1 - B.y0)) / 2 - B.y0;
    drawPad(c, px, py, W, { tok: pad.tok, lit: pad.ring ? { [pad.ring]: "lit" } : {}, ring: pad.ring });
  } else {
    const sw = 64, sh = 30, sx = mid - sw / 2, sy = top + (room - sh) / 2;
    c.strokeStyle = TEXT; c.lineWidth = 2;
    dashLine(c, sx, sy, sx + sw, sy); dashLine(c, sx + sw, sy, sx + sw, sy + sh); dashLine(c, sx + sw, sy + sh, sx, sy + sh); dashLine(c, sx, sy + sh, sx, sy);
    c.fillStyle = TEXT; c.font = font(14, "900"); c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("· · ·", mid, sy + sh / 2 + 0.5);
  }
  paneLine(c, G.cap, y + h - 40, cap.sub || "", cap.warn ? WARM : MUTED, 11, "center");
  foot(c, { mid, footY: y + h - 16 }, clip(c, cap.foot || "", w - 16));
}
/** The whole page. view = the reducer's View; ui = {touch, narrow, scale, words, level, reduced}: level dresses the drawing (the room the menus show,
    or the room being played from PAUSE), reduced = REDUCE FLASH. */
export function drawControls(c, L, view, ui) {
  const u = ui || {}, s = view, G = geoFor(L, u.touch, u.narrow, u.scale), S = G.S, rows = rowsOf(s), sel = Math.min(s.row | 0, rows.length - 1), row = rows[sel], st = s.pad && s.pad.state, off = padOff(s), tok = worldTokens(u.level | 0 || 1);
  _dbg.plan = null; _dbg.legends = [];
  plate(c, S.x, S.y, S.w, S.h);
  c.font = sans(10, "600");
  spaced(c, true); // head() draws its kicker spaced: measure it so, or a long pad id overruns
  const kicker = clip(c, s.tab === "key" ? "KEYS + CONTROLLER" : off ? (st === "lost" ? "CONTROLLER LOST" : "NO CONTROLLER YET") : "CONNECTED · " + ((s.pad && s.pad.name) || "CONTROLLER"), S.w - 40);
  spaced(c, false);
  head(c, S, "CONTROLS", kicker);
  segs(c, G.tabs, TAB_LABEL, s.tab === "key" ? 0 : 1, null, G.touch);
  rows.forEach((r, i) => drawRow(c, r, geomOf(i, G), i === sel, s, G.touch));
  if (G.pane) drawPane(c, s, row, G, tok, u);
  else drawRule(c, { x: S.ix - 8, w: S.iw + 16 }, G.statusY + 13, statusOf(s, row) + (row.id === "SENSITIVITY" && !off && !s.status ? " · " + driftWord(s) + " · " + readsWord(s) : ""), s.swap ? WARM : TEXT);
  const ft = footOf(s, row, u.words);
  c.font = font(10);
  foot(c, S, mw(c, ft) <= S.w - 24 ? ft : footOf(s, row, u.words, true));
  if (s.capture) drawCapture(c, s.capture, G, s.tab === "pad" && !off && st !== "nonstd" ? { tok, ring: padRing(s, row.id) } : null);
}
