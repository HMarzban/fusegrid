// One-way vibration from the event drain: reads events, never touches the world. Each call re-reads the live gamepad, because the browser replaces the objects between polls.
// Note: .superpowers/sdd/notes/v201-controls-build/vibration-sensitivity-design.md; its Lead rulings win.
import { CFG } from "../core/config.js";
const NEAR = 3 * CFG.TILE, CLOSE = CFG.TILE, FAR = 0.7;
/* patMs, pulses, pulseMs, gap, peak bound every pattern; onAdmit leaves onMs room for late rAFs stretching a running step. menuMs: the menu feels' own on-time in the same rolling budgetWin. lateMs: a menu step whose slot ended more than this long ago is dropped with the rest of its feel; a later one starts late and whole. */
export const LIMITS = Object.freeze({ patMs: 500, pulses: 3, pulseMs: 300, gap: 80, callMs: 334, over: 34, peak: 0.7, floor: 0.35, knee: 0.5, onMs: 500, onAdmit: 460, perSec: Object.freeze([0, 2, 4, 4]), budgetMs: 900, budgetWin: 10000, menuMs: 900, lateMs: 250, chainWin: 250, chainN: 4, testMs: 250 });
/* Index = the stored vib. */
export const SCALE = Object.freeze([0, 0.4, 0.75, 1]);
const s = (ms, weak, strong) => Object.freeze({ ms, weak, strong }), g = (gap) => Object.freeze({ gap });
/* p: lower = higher priority. exempt = may break the per-second limits. noLow = LOW drops it. budget = counts to the rolling cap. end = keeps stepping past PLAY. menu = a menu feel: any screen, its own rolling cap (exempt ones skip it); page = one press per page change (enter, back, deny): never dropped by the cap or the per-second limits, but counted, so the cursor ticks around it drop first, under every gameplay pattern; weak motor going in, back alone on the dull strong one going out. Durations never scale.
   Menu feels: .superpowers/sdd/notes/v201-controls-build/menu-haptics/spec.md. */
export const PATTERNS = Object.freeze({
  lose: { p: 0, exempt: true, end: true, steps: [s(300, 0.5, 1), g(80), s(120, 0, 0.6)] },
  hurt: { p: 1, exempt: true, steps: [s(180, 0.4, 1), s(120, 0, 0.5)] },
  win: { p: 2, end: true, steps: [s(90, 0.5, 0), g(80), s(90, 0.7, 0), g(80), s(160, 0.7, 0.4)] },
  shield: { p: 3, steps: [s(70, 0.7, 0), g(80), s(70, 0.7, 0)] },
  chain: { p: 4, steps: [] }, // built by chainSteps
  close: { p: 5, steps: [s(110, 0.6, 0.9), s(120, 0, 0.45)] },
  near: { p: 6, noLow: true, budget: true, steps: [s(80, 0.55, 0)] },
  plant: { p: 7, noLow: true, budget: true, steps: [s(60, 0.45, 0)] },
  test: { p: 7.5, steps: [s(160, 0.7, 0.7)] },
  launch: { p: 7.8, exempt: true, noLow: true, menu: true, steps: [s(60, 0.5, 0), g(80), s(110, 0.7, 0)] },
  enter: { p: 8, noLow: true, menu: true, page: true, steps: [s(90, 0.6, 0)] },
  hello: { p: 8.1, exempt: true, noLow: true, menu: true, steps: [s(120, 0.6, 0)] },
  deny: { p: 8.2, noLow: true, menu: true, page: true, steps: [s(60, 0.5, 0), g(80), s(60, 0.5, 0)] },
  confirm: { p: 8.5, noLow: true, menu: true, steps: [s(70, 0.55, 0)] },
  back: { p: 8.8, noLow: true, menu: true, page: true, steps: [s(70, 0, 0.3)] },
  move: { p: 9, noLow: true, menu: true, steps: [s(60, 0.4, 0)] },
});
const HIT = 70, TAIL = 120;
const hitWeak = (i) => Math.min(LIMITS.peak, 0.5 + 0.1 * i), hitStrong = (i) => Math.min(LIMITS.peak, 0.25 + 0.15 * i);
/** A chain's steps from hit `from` to n, given e ms already spent and an r ms pulse still running. Whatever does not fit in the limits is left out. */
export function chainSteps(n, far, from = 1, e0 = 0, r0 = 0) {
  const k = far ? FAR : 1, out = [];
  let e = e0, r = r0, last = 0;
  const room = (ms) => {
    const gap = r + ms > LIMITS.pulseMs ? LIMITS.gap : 0;
    if (e + gap + ms > LIMITS.patMs) return false;
    if (gap) { out.push(g(gap)); e += gap; r = 0; }
    e += ms; r += ms;
    return true;
  };
  for (let i = from; i <= Math.min(n, LIMITS.chainN); i++) {
    if (!room(HIT)) break;
    last = hitStrong(i);
    out.push({ ms: HIT, weak: hitWeak(i) * k, strong: last * k, hit: true });
  }
  if (last && room(TAIL)) out.push({ ms: TAIL, weak: 0, strong: last * 0.6 * k });
  return out;
}
const pulsesIn = (steps) => { let n = 0, on = false; for (const x of steps) { if (!x.gap && !on) n++; on = !x.gap; } return n; };
const onMsOf = (steps) => steps.reduce((a, x) => a + (x.ms || 0), 0);
/** A pattern's steps at a level. LOW allows two pulses a second, so a longer pattern keeps only its first and last. */
export function stepsAt(name, level) {
  const st = PATTERNS[name].steps;
  if (level !== 1 || pulsesIn(st) <= LIMITS.perSec[1]) return st;
  const a = st.findIndex((x) => x.gap), b = st.length - 1 - [...st].reverse().findIndex((x) => x.gap);
  return [...st.slice(0, a + 1), ...st.slice(b + 1)];
}
/** Magnitude at a level: scaled, unchanged from the knee up; below it spread over floor..knee, so a motor can start and small values stay apart by level where a plain floor clamp merged them. */
export function scaleMag(m, level) {
  if (!(m > 0)) return 0;
  const x = m * SCALE[level], { floor, knee } = LIMITS;
  return Math.min(level === 1 ? SCALE[1] : 1, x >= knee ? x : floor + x * (knee - floor) / knee); // LOW never passes its old top, .40
}
const safe = (f) => { try { return f(); } catch { return undefined; } };
const quiet = (p) => { if (p && typeof p.catch === "function") safe(() => p.catch(() => {})); };
/* effects where the browser has it, else the older single .type, else null = it does not say. */
const effectsOf = (a) => safe(() => (a.effects != null ? Array.from(a.effects) : typeof a.type === "string" ? [a.type] : null));
/** What can buzz this gamepad, best first: dual-rumble, trigger-rumble only without it, then the older hapticActuators pulse. */
export function routesOf(g) {
  const out = [];
  if (!g) return out;
  const a = safe(() => g.vibrationActuator), h = safe(() => g.hapticActuators && g.hapticActuators[0]);
  if (a && typeof a.playEffect === "function") {
    const fx = effectsOf(a);
    if (fx == null || fx.includes("dual-rumble")) out.push({ kind: "dual-rumble", a });
    if (fx != null && fx.includes("trigger-rumble")) out.push({ kind: "trigger-rumble", a });
  }
  if (h && typeof h.pulse === "function") out.push({ kind: "pulse", a: h });
  return out;
}
/** What a gamepad offers, for the debug hook. */
export function padInfo(g) {
  const a = g ? safe(() => g.vibrationActuator) : null, n = g ? safe(() => g.hapticActuators && g.hapticActuators.length) : 0, r = routesOf(g)[0];
  return { id: g && typeof g.id === "string" ? g.id : null, mapping: g ? g.mapping : null, actuator: (a && safe(() => a.type)) || null, playEffect: !!a && typeof a.playEffect === "function", effects: a && safe(() => a.effects != null) ? effectsOf(a) : null, hapticActuators: n | 0, route: r ? r.kind : null };
}
function play(rt, ms, weak, strong) {
  const m = Math.max(strong, weak), base = { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak };
  if (rt.kind === "pulse") return rt.a.pulse(m, ms);
  return rt.a.playEffect(rt.kind, rt.kind === "trigger-rumble" ? { ...base, leftTrigger: m, rightTrigger: m } : base);
}
/** Builds the sink: `feed` every GAME frame before the renderer drains events, `tick` on every rAF. level() is the stored vib. */
export function createRumble({ level, gamepad, playing, state }) {
  let cur = null, busyP = Infinity, busyEnd = 0, clock = 0, lives = null;
  let chainN = 0, chainNear = Infinity, boomT = -Infinity, testAt = -Infinity, pend = -1;
  let on = [], pulseT = [], spent = [], mspent = [];
  const lv = () => { const v = safe(level); return v > 0 ? v : 0; };
  const routes = () => routesOf(safe(gamepad));
  /* The one way to the motors. A throw falls to the next route; a rejection only means this buzz is lost. */
  const fire = (x, ms) => {
    const v = lv();
    if (!v) return false;
    const w = scaleMag(x.weak, v), m = scaleMag(x.strong, v);
    for (const rt of routes()) {
      try { quiet(play(rt, ms, w, m)); return true; } catch { /* next route */ }
    }
    return false;
  };
  const cutOn = (t) => { const e = on[on.length - 1]; if (e && e.b > t) e.b = t; };
  const onRecent = (t, cut) => {
    while (on.length && on[0].b < t - 1000) on.shift();
    let sum = 0;
    for (const e of on) sum += (cut ? Math.min(e.b, t) : e.b) - Math.max(e.a, t - 1000);
    return sum;
  };
  const pulsesRecent = (t) => {
    while (pulseT.length && pulseT[0] <= t - 1000) pulseT.shift();
    return pulseT.length;
  };
  /* Same or lower priority than what runs is dropped, never queued. */
  const activeP = (t) => (cur ? cur.p : t < busyEnd ? busyP : Infinity);
  const used = (arr, t) => { while (arr.length && arr[0].t <= t - LIMITS.budgetWin) arr.shift(); return arr.reduce((a, e) => a + e.ms, 0); };
  const admit = (pat, steps, v, t) => {
    if (pat.exempt) return true;
    if (pat.page) return onRecent(t, true) + onMsOf(steps) <= LIMITS.onAdmit; // free of the pulse count and the menu cap, never of the on-time ceiling
    if (pat.budget && used(spent, t) + onMsOf(steps) > LIMITS.budgetMs) return false;
    if (pat.menu && used(mspent, t) + onMsOf(steps) > LIMITS.menuMs) return false;
    return pulsesRecent(t) + pulsesIn(steps) <= LIMITS.perSec[v] && onRecent(t, true) + onMsOf(steps) <= LIMITS.onAdmit;
  };
  const logStep = (x, t, joined) => {
    if (joined) { const e = on[on.length - 1]; if (e) e.b = t; }
    else pulseT.push(t);
    on.push({ a: t, b: t + x.ms });
  };
  /* Deadlines are absolute from the pattern's start (cur.next += ms): a late frame shortens its step rather than pushing the rest back. */
  const issue = (x, t) => {
    const nx = cur.steps[cur.i + 1], end = cur.next + x.ms, ms = Math.max(1, Math.min(x.ms, end - t));
    if (!fire(x, ms + (nx && !nx.gap ? LIMITS.over : 0))) return false;
    logStep({ ms }, t, cur.lg);
    cur.next = end; cur.e += x.ms; cur.r += x.ms; cur.lg = true;
    if (x.hit) cur.hits++;
    return true;
  };
  const start = (name, steps, t, extra) => {
    const pat = PATTERNS[name];
    if (!admit(pat, steps, lv(), t) || !routes().length) return false;
    const was = cur;
    cur = { name, p: pat.p, end: !!pat.end, menu: !!pat.menu, steps, i: 0, next: t, e: 0, r: 0, hits: 0, lg: false, seen: false, ...extra };
    cutOn(t);
    if (!issue(steps[0], t)) { cur = was; return false; }
    busyEnd = 0;
    if (pat.budget) spent.push({ t, ms: onMsOf(steps) });
    if (pat.menu && !pat.exempt) mspent.push({ t, ms: onMsOf(steps) });
    return true;
  };
  /* One step outside the cursor: nothing follows it, and it may outlive PLAY. */
  const single = (name, t) => {
    const pat = PATTERNS[name], steps = stepsAt(name, lv()), x = steps[0];
    if (!admit(pat, steps, lv(), t) || !fire(x, x.ms)) return false;
    cutOn(t);
    logStep(x, t, false);
    if (pat.menu && !pat.exempt) mspent.push({ t, ms: x.ms });
    cur = null; busyP = pat.p; busyEnd = t + x.ms;
    return true;
  };
  /* A boom inside the window raises n: the rest is rebuilt from the current step, which keeps running. */
  const merge = (n, far, t) => {
    const rest = chainSteps(n, far, cur.hits + 1, cur.e, cur.r);
    if (!rest.length || onRecent(t, false) + onMsOf(rest) > LIMITS.onAdmit) return;
    const x = cur.steps[cur.i], nx = cur.steps[cur.i + 1];
    cur.steps = cur.steps.slice(0, cur.i + 1).concat(rest);
    /* The current step was cut to end exactly; it now runs into another, so it must not leave a hole. */
    if (!x.gap && !rest[0].gap && !(nx && !nx.gap) && cur.next > t) fire(x, Math.min(LIMITS.callMs, cur.next - t + LIMITS.over));
  };
  const halt = () => {
    const rt = routes()[0];
    if (!rt) return;
    /* The older pulse has no reset: a zero pulse is the only stop it offers. */
    const f = rt.kind === "pulse" ? () => rt.a.pulse(0, 1) : typeof rt.a.reset === "function" ? () => rt.a.reset() : null;
    if (f) quiet(safe(f));
  };
  const testNow = (t) => {
    const x = PATTERNS.test.steps[0];
    if (!lv() || !fire(x, x.ms)) return false;
    cutOn(t);
    logStep(x, t, false);
    cur = null; busyP = PATTERNS.test.p; busyEnd = t + x.ms; testAt = t;
    return true;
  };
  const live = (st) => lv() > 0 && playing() && st !== "PAUSE";
  const clear = (t) => { cutOn(t); cur = null; busyEnd = 0; chainN = 0; chainNear = Infinity; boomT = -Infinity; };
  return {
    supported: () => routes().length > 0,
    feed(events, t, player, nowLives) {
      clock = t;
      const known = typeof nowLives === "number", shield = known && lives !== null && nowLives >= lives;
      if (known) lives = nowLives;
      const v = lv(), st = safe(state);
      if (!v || !playing() || st === "PAUSE") return;
      let want = null, flip = false, booms = 0, nearest = Infinity;
      const take = (name) => { if ((v > 1 || !PATTERNS[name].noLow) && (!want || PATTERNS[name].p < PATTERNS[want].p)) want = name; };
      for (const e of events || []) {
        const ty = e && e.t;
        if (ty === "win" || ty === "lose") { flip = true; take(ty); }
        else if (ty === "hurt") take(shield ? "shield" : "hurt");
        else if (ty === "bomb") take("plant");
        else if (ty === "boom" && player) { booms++; nearest = Math.min(nearest, Math.hypot(e.x - player.x, e.y - player.y)); }
      }
      /* afterStep runs after the step, so the step that wins or loses has already left PLAY: that feed still counts, no other does. */
      if (st !== "PLAY" && !flip) return;
      if (booms) {
        const inside = t - boomT <= LIMITS.chainWin;
        chainN = Math.min(LIMITS.chainN, (inside ? chainN : 0) + booms);
        chainNear = inside ? Math.min(chainNear, nearest) : nearest;
        boomT = t;
        if (chainN >= 2) take("chain");
        else if (chainNear <= CLOSE) take("close");
        else if (chainNear <= NEAR) take("near");
      }
      if (!want) return;
      const far = chainNear > NEAR;
      if (want === "chain" && cur && cur.name === "chain") return void merge(chainN, far, t);
      if (PATTERNS[want].p >= activeP(t)) return;
      start(want, want === "chain" ? chainSteps(chainN, far) : stepsAt(want, v), t);
    },
    /** Steps the running pattern, and ends it the moment it may no longer buzz. Every rAF. */
    tick(t) {
      clock = t;
      if (pend >= 0 && t >= pend) { pend = -1; testNow(t); }
      if (!cur) return;
      const st = safe(state);
      if (cur.menu ? !lv() : !live(st)) { clear(t); halt(); return; } // a menu feel steps on any screen, PAUSE included; only OFF cuts it
      if (!routes().length) { clear(t); return; } // the pad is gone: a later pad must not inherit the pattern
      if (cur.end) {
        if (st !== "PLAY") cur.seen = true;
        else if (cur.seen) { clear(t); halt(); return; }
      }
      while (cur && t >= cur.next) {
        const x = cur.steps[++cur.i];
        if (!x) cur = null;
        else if (x.gap) { cur.next += x.gap; cur.e += x.gap; cur.r = 0; cur.lg = false; }
        else if (cur.next + x.ms <= t && !cur.menu) { cur.next += x.ms; cur.e += x.ms; cur.r += x.ms; cur.lg = false; if (x.hit) cur.hits++; } // overdue: skipped to the current step, never bunched
        else {
          if (cur.menu && cur.next < t) { if (t - cur.next - x.ms > LIMITS.lateMs) { cur = null; break; } cur.next = t; } // a menu feel plays late rather than vanish: a run's first frame builds the board
          if (!issue(x, t)) cur = null;
        }
      }
    },
    /** A pad's menu feel: move, confirm, enter, back, launch, deny or hello; true if it buzzed. No repeat notion here: a held direction never reaches it. */
    menu(name, t = clock) {
      clock = t;
      const pat = Object.hasOwn(PATTERNS, name) ? PATTERNS[name] : null, v = lv();
      if (!pat || !pat.menu || !v || (v === 1 && pat.noLow) || pat.p >= activeP(t)) return false;
      return pat.steps.length > 1 ? start(name, stepsAt(name, v), t) : single(name, t);
    },
    /** One pulse at the selected level, so the player can feel it; on any screen. The player's own request: no budget, but 250 ms apart. A change inside that gap plays once, at the level then set, when it ends (trailing). */
    test(t = clock) {
      clock = t;
      if (!lv()) { pend = -1; return false; }
      if (t - testAt >= LIMITS.testMs) { pend = -1; return testNow(t); }
      pend = testAt + LIMITS.testMs;
      return false;
    },
    stop() {
      pend = -1;
      clear(clock);
      halt();
    },
  };
}
