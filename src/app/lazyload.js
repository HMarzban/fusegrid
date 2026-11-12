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

/* A run start that needs gen 3 before it is in (a link slower than the intro show): go()
   runs once it is, behind the FLOOR TILES plate; a failed fetch is that plate's RETRY card. */
export function holdGen3(go, L = globalThis.__load) {
  const run = () => {
    if (L) L.begin("tiles", lookPlan(null, TILES), false);
    return loadGen3().then(() => { if (L) L.end("tiles"); go(); }, (e) => { if (L) L.fail("tiles", null, run); else console.error(e); });
  };
  return run();
}
