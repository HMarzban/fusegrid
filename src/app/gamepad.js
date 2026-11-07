// The pad poller and the stick, pure over an injected getGamepads. Plan: docs/superpowers/plans/2026-11-02-controls-feature.md T3.
import { PAD_IDX as IDX, SENS_LEVELS } from "./controls.js";
const IDS = Object.keys(IDX).map(Number);
const DPAD = { dU: "up", dD: "down", dL: "left", dR: "right" };
const T_ON = 0.5,
  T_OFF = 0.35,
  MENU_BIAS = 1.25,
  MENU_DEAD = 0.5,
  MENU_REARM = 0.35;
const NODIR = () => ({ up: false, down: false, left: false, right: false });

/* The axis flip of the level nearest this deadzone; the store only ever holds level values. */
const flipOf = (dead) => SENS_LEVELS.reduce((a, b) => (Math.abs(b.dead / 100 - dead) < Math.abs(a.dead / 100 - dead) ? b : a)).flip;
/* Lets go below the deadzone: 0.05 under it, 0.10 at 40 and above, never under the 0.03 a resting stick can read. */
const releaseOf = (dead) => Math.max(0.03, Math.round((dead - (dead >= 0.4 ? 0.1 : 0.05)) * 1000) / 1000);

/** One stick step: radial deadzone with hysteresis, 4-way by dominant axis. bias = the first engage favours vertical until x leads y by that much (menus only); flip = the level's turn, when dead is not the level's own. Pure. */
export function resolveStick(prev, x, y, dead, rel, bias, flip = flipOf(dead)) {
  const r = Math.hypot(x, y);
  const off = rel === undefined ? releaseOf(dead) : rel;
  const on = prev && prev.on ? r > off : r >= dead;
  if (!on) return { ax: null, sx: 0, sy: 0, on: false, dir: NODIR() };
  const ax = Math.abs(x),
    ay = Math.abs(y);
  let a = prev && prev.on ? prev.ax : null;
  if (!a) a = ax > (bias || 1) * ay ? "x" : "y";
  else if (a === "x" && ay > flip * ax) a = "y";
  else if (a === "y" && ax > flip * ay) a = "x";
  const dir = NODIR();
  const sx = a === "x" ? Math.sign(x) : 0,
    sy = a === "y" ? Math.sign(y) : 0;
  if (sx) dir[sx < 0 ? "left" : "right"] = true;
  if (sy) dir[sy < 0 ? "up" : "down"] = true;
  return { ax: a, sx, sy, on: true, dir };
}

/** The neutral pad name; the device id is never read. */
export function padName(snap) {
  if (!snap || !snap.connected) return "";
  if (snap.mapping === "standard") return "CONTROLLER 1";
  return "CONTROLLER 1 · BUTTONS 0-" + Math.max(0, (snap.nb || 1) - 1);
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const fresh = () => ({ down: new Set(), order: [], st: null, mst: null });

function emptySnap() {
  return { connected: false, found: false, lost: false, count: 0, index: null, mapping: "standard", name: "", nb: 0, down: new Set(), press: [], release: [], dir: NODIR(), menuDir: NODIR(), mag: 0, anyDown: false };
}

/** The poller: one poll per rAF; PadSnap in, no side effects beyond its own latches. */
export function createPad(o = {}) {
  const get = o.getGamepads;
  let dead = typeof o.dead === "number" ? o.dead : 0.25;
  let stick = o.stick === "R" ? "R" : "L";
  const pads = new Map();
  let active = null,
    was = false,
    last = emptySnap();

  function read(g, ps) {
    const bs = g.buttons || [];
    const down = new Set(),
      press = [],
      release = [];
    for (const i of IDS) {
      const b = bs[i];
      if (!b) continue;
      const id = IDX[i];
      let on;
      if (i === 6 || i === 7) {
        const v = typeof b.value === "number" ? b.value : b.pressed ? 1 : 0;
        on = ps.down.has(id) ? v > T_OFF : v >= T_ON;
      } else on = typeof b.pressed === "boolean" ? b.pressed : num(b.value) >= T_ON;
      if (on) down.add(id);
      if (on && !ps.down.has(id)) press.push(id);
      if (!on && ps.down.has(id)) release.push(id);
    }
    for (const id of release) {
      const k = ps.order.indexOf(id);
      if (k >= 0) ps.order.splice(k, 1);
    }
    for (const id of press) if (DPAD[id]) ps.order.push(id);
    ps.down = down;
    return { press, release };
  }

  function poll(t) {
    let list = null;
    try {
      list = get ? get() : null;
    } catch (_) {
      list = null;
    }
    const seen = new Map();
    const n = list && typeof list.length === "number" ? list.length : 0;
    for (let i = 0; i < n; i++) {
      const g = list[i];
      if (g && g.connected !== false) seen.set(i, g);
    }
    for (const k of [...pads.keys()]) if (!seen.has(k)) pads.delete(k);
    const ev = new Map();
    let claim = null;
    for (const [k, g] of seen) {
      let ps = pads.get(k);
      if (!ps) pads.set(k, (ps = fresh()));
      const e = read(g, ps);
      ev.set(k, e);
      if (e.press.length) claim = k;
    }
    let dropped = [];
    if (active !== null && !pads.has(active)) {
      active = null;
      claim = null;
    }
    if (claim !== null && claim !== active) {
      if (active !== null) {
        const ev0 = pads.get(active);
        dropped = [...ev0.down];
        ev0.order = [];
        ev0.st = ev0.mst = null;
      }
      active = claim;
    }
    if (active === null && seen.size === 1 && !was) active = [...seen.keys()][0];
    const s = emptySnap();
    s.count = seen.size;
    if (active !== null) {
      const g = seen.get(active),
        ps = pads.get(active),
        e = ev.get(active);
      const nb = (g.buttons || []).length;
      const std = g.mapping === "standard";
      s.connected = true;
      s.index = active;
      s.mapping = std ? "standard" : "other";
      s.nb = nb;
      s.name = padName({ connected: true, mapping: s.mapping, nb });
      s.down = ps.down;
      s.press = e.press;
      s.release = dropped.length ? e.release.concat(dropped) : e.release;
      s.anyDown = ps.down.size > 0;
      const ax = g.axes || [];
      const a = stick === "R" ? 2 : 0;
      const x = num(ax[a]),
        y = num(ax[a + 1]); // on any pad, alongside its buttons; a pressed D-PAD index wins below (lead ruling)
      s.mag = Math.hypot(x, y);
      ps.st = resolveStick(ps.st, x, y, dead);
      const md = Math.max(dead, MENU_DEAD);
      ps.mst = resolveStick(ps.mst, x, y, md, Math.min(MENU_REARM, md - 0.05), MENU_BIAS, flipOf(dead));
      const top = ps.order.length ? DPAD[ps.order[ps.order.length - 1]] : null;
      if (top) {
        s.dir[top] = true;
        s.menuDir[top] = true;
      } else {
        Object.assign(s.dir, ps.st.dir);
        Object.assign(s.menuDir, ps.mst.dir);
      }
    }
    s.found = s.connected && !was;
    s.lost = !s.connected && was;
    was = s.connected;
    last = s;
    return s;
  }

  return {
    poll,
    setDead(d) {
      if (typeof d === "number" && Number.isFinite(d)) dead = d;
    },
    setStick(s) {
      stick = s === "R" ? "R" : "L";
    },
    snap: () => last,
  };
}
