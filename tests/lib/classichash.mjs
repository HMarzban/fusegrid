/* CLASSIC 2D call-log hash: a seeded, staged world rendered through the
   classic createRenderer into a recording ctx; every method call and property
   write is logged (numbers at 3 decimals) and FNV-1a hashed. PIXEL must leave
   this value byte-identical. imp(path) imports a repo module, so the same
   recipe can be pointed at another checkout to re-derive the pin. arm (a
   GRAPHICS knob object) arms render-on-change first; raw returns the log. */
export async function classicHash(imp, arm, raw) {
  const {createWorld, loadLevel} = await imp("src/core/sim.js");
  const {createRenderer} = await imp("src/render/renderer.js");
  const {initFx} = await imp("src/render/fx.js");
  const {CFG, T, key} = await imp("src/core/config.js");
  const {POWER, spawnEnemy} = await imp("src/core/entities.js");
  const log = [];
  const fmt = (v) => (typeof v === "number" ? v.toFixed(3) : typeof v === "string" ? v : v && typeof v === "object" ? "{o}" : String(v));
  const rec = (tag) => new Proxy({}, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === "canvas") return {width: 600, height: 520};
      return (...a) => { log.push(tag + k + "(" + a.map(fmt).join(",") + ")"); return k.startsWith("create") ? rec("g.") : undefined; };
    },
    set(o, k, v) { log.push(tag + k + "=" + fmt(v)); o[k] = v; return true; },
  });
  const ctx = rec("");
  const canvas = {width: 600, height: 520, getContext: () => ctx};
  const real = Math.random;
  let s = 12345;
  Math.random = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  try {
    initFx();
    const r = createRenderer(canvas, {kind: "2d"});
    if (arm) r.setPerf(arm);
    const w = createWorld(4242, 1);
    loadLevel(w, 1);
    w.state = "PLAY";
    const free = [];
    for (let y = 1; y < CFG.ROWS - 1; y++) for (let x = 1; x < CFG.COLS - 1; x++) if (w.grid[key(x, y)] !== T.WALL && (x > 2 || y > 2)) free.push([x, y]);
    const take = (i) => { const c = free[(i * 11) % free.length]; w.grid[key(c[0], c[1])] = T.EMPTY; return c; };
    const ctr = (v) => (v + 0.5) * CFG.TILE;
    POWER.forEach((p, i) => { const [x, y] = take(i); w.items.push({x: ctr(x), y: ctr(y), t: p.t, col: p.col, taken: false, buried: false}); });
    ["normal", "line", "power", "pierce"].forEach((v, i) => { const [x, y] = take(20 + i); w.bombs.push({x: ctr(x), y: ctr(y), tx: x, ty: y, timer: 1 + i * 0.3, radius: 2, variant: v, dead: false}); });
    const [bx, by] = take(30);
    w.blades.push({x: ctr(bx), y: ctr(by), tiles: [{tx: bx, ty: by}, {tx: bx + 1, ty: by}, {tx: bx - 1, ty: by}], t: 0.1, ttl: CFG.BLADE_TTL});
    ["walker", "fast", "rocket", "knight"].forEach((t, i) => { const [x, y] = take(40 + i); w.enemies.push(spawnEnemy(t, x, y, 1, null)); });
    w.events.push({t: "boom", x: ctr(bx), y: ctr(by)});
    for (let f = 0; f < 3; f++) { w.time += 1 / 60; r.render(w, 1 / 60, f === 2 ? {hud: true, ghost: {x: 100, y: 100, fx: 1, fy: 0, t: 0.2}} : undefined); }
  } finally { Math.random = real; }
  if (raw) return log;
  let h = 0x811c9dc5;
  const str = log.join("\n");
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0") + ":" + log.length;
}
