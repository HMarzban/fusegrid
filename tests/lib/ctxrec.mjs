/* Recording canvas context for Node tests: every call and property write is logged; gradients and patterns return a recorder. */
export function rec() {
  const log = [];
  const fmt = (v) => (typeof v === "number" ? +v.toFixed(3) : v && typeof v === "object" ? "{o}" : v);
  const mk = (tag) => new Proxy({}, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === "canvas") return {width: 80, height: 80};
      return (...a) => { log.push({op: tag + String(k), a: a.map(fmt)}); return String(k).startsWith("create") ? mk("g.") : undefined; };
    },
    set(o, k, v) { log.push({op: tag + "=" + String(k), a: [fmt(v)]}); o[k] = v; return true; },
  });
  return {ctx: mk(""), log};
}
