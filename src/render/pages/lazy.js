/* Lazy page modules (R20). SETTINGS / GRAPHICS, GUIDE, RECORDS, the run ends and LEVEL SELECT (Task 9.14) stay
   out of the boot graph: each is one entry in LOAD. want(name) starts its one import (a
   failed one is retried by the next ask) and get(name) is the module once it is in, else
   null, so a page paints its LOADING plate and its hit finds nothing until then. idle()
   asks for every page once, in the first idle after MENU's first frame (shellview calls
   it there; a 300 ms timer where a page has no idle callback); in Node it does nothing,
   so tests import what they use. */
const LOAD = {
  settings: () => import("./settings.js"),
  guide: () => import("./guide.js"),
  records: () => import("./records.js"),
  endwin: () => import("./endwin.js"),
  endlose: () => import("./endlose.js"),
  level: () => import("./level.js"),
};
const mods = {}, wait = {};

export const NAMES = Object.freeze(Object.keys(LOAD));
export const get = (name) => mods[name] || null;
export function want(name) {
  if (mods[name]) return Promise.resolve(mods[name]);
  if (!LOAD[name]) return Promise.reject(new Error("no lazy page " + name));
  return wait[name] || (wait[name] = LOAD[name]().then((m) => (mods[name] = m), (e) => { wait[name] = null; throw e; }));
}
let asked = false;
export function idle(g = globalThis) {
  const ric = typeof g.requestIdleCallback === "function" ? (f) => g.requestIdleCallback(f) : g.document ? (f) => g.setTimeout(f, 300) : null;
  if (asked || !ric) return;
  asked = true;
  ric(() => { for (const n of NAMES) want(n).catch(() => {}); });
}
/** Test seam: a module handed in as if its import had landed. */
export const _set = (name, m) => { mods[name] = m; };
