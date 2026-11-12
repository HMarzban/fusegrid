/* Boot-graph diet (v202 delivery, step 3a). Code the title never runs stays out of the
   boot graph, each behind one seam that its module fills on load and its user checks
   (board2 hasGen3, attract demoReady, renderer.js setIso / loadIso, main's opts.createLocalPair):
   gen 3 (board3 + featplace + featchecks) and the ATTRACT bot load in the title's first
   idle, the service worker registration's own hook; the deep links (?play=1, ?code=,
   ?render=iso, ?net=local) load theirs before createGame, behind the boot plate. Once in,
   every call is synchronous again. All stay precached (src/pwa/shell.js BOOT). */
import { hasGen3 } from "../core/board2.js";
import { demoReady } from "./attract.js";
import { readFlags } from "./flags.js";
import { lookPlan, TILES } from "./loadbar.js";
import { deferRegister } from "../pwa/register.js";

/* one import in flight; a failed one is retried by the next ask */
const once = (ok, f) => { let p = null; return () => (ok() ? Promise.resolve() : (p ||= f().then(() => {}, (e) => { p = null; throw e; }))); };
export const loadGen3 = once(hasGen3, () => import("../core/board3.js"));
export const loadDemobot = once(demoReady, () => import("./demobot.js"));

/* the title's first idle: gen 3 first (every ordinary run deals it), then the bot (MENU waits for it before ATTRACT) */
export const warmBoot = (env) => deferRegister(() => { loadGen3().catch(() => {}); loadDemobot().catch(() => {}); }, env);

/* index.html's entry: what a deep link's first frame needs, in before createGame; resolves to the opts */
export function deepLoad(search, opts = {}) {
  const f = readFlags(search, opts), w = [];
  if (f.autoplay || f.code) w.push(loadGen3());
  if (f.urlKind === "iso") w.push(opts.loadIso()); // renderer.js's own loader, handed in: src/app never imports src/render
  if (f.netLocal && !opts.createLocalPair) w.push(import("../net/localpair.js").then((m) => { opts.createLocalPair = m.createLocalPair; }));
  return Promise.all(w).then(() => opts);
}

/* One held run start (v202): gen 3 not in yet (a link slower than the intro show), or a
   deep link's lazy look not on screen yet (look() true: rcache's boot stand-in). The world
   stays frozen behind the plate (FLOOR TILES, or PREPARING <LOOK>), a held start counts as
   idle so the look's job runs, and the start runs ONCE: a second ask while held only
   replaces its args (one run_start per run). release() is polled each frame for the look.
   cancel() drops the start and returns to MENU: BACK TO MENU on the FLOOR TILES card
   (Escape, the pad's back word, a tap), and P / Escape while held. */
export function createHold({ run, menu, look = () => false, ok = hasGen3, load = loadGen3, L }) {
  let args = null, why = null, tok = 0;
  const LB = () => (L !== undefined ? L : globalThis.__load);
  const go = () => { const a = args; why = null; args = null; run(a); };
  const h = {
    get on() { return why !== null; },
    get why() { return why; },
    /* true: the start is held (or joined the held one); false: run it now */
    start(a) {
      if (why) return (args = a), true;
      if (!(a && a.seed != null && a.gen !== 3) && !ok()) { args = a; why = "gen3"; tiles(++tok); return true; }
      if (look()) { args = a; why = "look"; return true; }
      return false;
    },
    release() { if (why === "look" && !look()) go(); },
    cancel() {
      if (!why) return false;
      const w = why, l = LB();
      why = null; args = null; tok++;
      if (w === "gen3" && l) l.end("tiles", true); // its FLOOR TILES plate or failure card goes too
      menu();
      return true;
    },
  };
  function tiles(t) {
    const l = LB();
    if (l) l.begin("tiles", lookPlan(null, TILES), false);
    return load().then(() => { if (t !== tok) return; if (l) l.end("tiles"); go(); }, (e) => { if (t !== tok) return; if (l) l.fail("tiles", () => h.cancel(), () => tiles(t), "BACK TO MENU"); else console.error(e); });
  }
  return h;
}
