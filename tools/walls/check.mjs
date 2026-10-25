#!/usr/bin/env node
/* Wall round prototype self-checks (throwaway): code distribution, SHRINK
   stays base, rng untouched, and the REAL 3D aWv refresh on a new seed /
   grid at the same level (the stale-variant bug the tech plan names). */
import {createWorld, loadLevel} from "../../src/core/world.js";
import {CFG, T} from "../../src/core/config.js";
import {wallCodes, WV} from "../../src/render/wallvar.js";
import {buildScene} from "../../src/render/three/scene.js";
const mk = (s, l) => { const w = createWorld(s, l); loadLevel(w, l, false); return w; };
let ok = true; const check = (n, c, v = "") => { console.log((c ? "PASS " : "FAIL ") + n + (v !== "" ? " -> " + v : "")); ok = ok && !!c; };
/* distribution over 400 seeds x 8 rooms */
const cnt = [0, 0, 0, 0], acc = []; let border = 0, bad = 0;
for (let s = 1; s <= 400; s++) for (let l = 1; l <= 8; l++) {
  const w = mk(s * 7919, l), C = wallCodes(w); let a = 0;
  for (let i = 0; i < C.length; i++) if (w.grid[i] === T.WALL) { const c = C[i]; if (c <= 3) cnt[c]++; else border++; if (c === WV.ACC) a++; }
  acc.push(a); if (a !== 1) bad++;
}
const P = cnt.reduce((a, b) => a + b, 0);
check("exactly one accent per room (3200 rooms)", bad === 0, bad);
check("pillar shares base/v1/v2/acc %", cnt[0] / P > 0.5, cnt.map((v) => (100 * v / P).toFixed(1)).join(" / "));
/* rng untouched, memo stable */
{ const w = mk(4242, 1), u = mk(4242, 1); const a = wallCodes(w), b = wallCodes(w); check("memo returns the same array", a === b);
  const nx = (r) => (typeof r === "function" ? r() : r.next ? r.next() : r.float ? r.float() : r.int(1 << 30)); check("world.rng untouched (next draws equal)", [0, 1, 2].every(() => nx(w.rng) === nx(u.rng))); }
/* SHRINK: new walls read base, pillars keep their code */
{ const w = mk(4242, 1); const c0 = wallCodes(w).slice(); for (let y = 0; y < CFG.ROWS; y++) for (let x = 0; x < CFG.COLS; x++) if (Math.min(x, CFG.COLS - 1 - x, y, CFG.ROWS - 1 - y) <= 3) w.grid[y * CFG.COLS + x] = T.WALL;
  const c1 = wallCodes(w); let fresh = 0, keep = true; for (let i = 0; i < c1.length; i++) { if (w.grid[i] === T.WALL && c0[i] === 0 && c1[i] !== 0) fresh++; if (c0[i] && c1[i] !== c0[i]) keep = false; }
  check("SHRINK walls are the base block", fresh === 0, fresh); check("existing walls keep their code after SHRINK", keep); }
/* 3D: aWv follows a new seed at the same level */
{ const w = mk(4242, 1), sc = buildScene(w, null), wall = sc.group.children.find((o) => o.userData.tag === "wall"), A = wall.geometry.attributes.aWv;
  const s0 = Array.from(A.array.slice(0, wall.count)); w.seed = 777; loadLevel(w, 1, true); sc.update(w); const s1 = Array.from(A.array.slice(0, wall.count));
  const exp = []; const C = wallCodes(w); for (let i = 0; i < C.length; i++) if (w.grid[i] === T.WALL) exp.push(C[i]);
  check("3D aWv refreshes on a new seed, same level", JSON.stringify(s1) === JSON.stringify(exp) && JSON.stringify(s0) !== JSON.stringify(s1));
  check("3D aWv capacity = COLS*ROWS", A.count === CFG.COLS * CFG.ROWS, A.count);
  const near = []; for (let i = 0; i < C.length; i++) if (w.grid[i] === T.WALL && ((i / CFG.COLS) | 0) === CFG.ROWS - 1) near.push(C[i]); check("near row is border / corner only", near.every((c) => c >= WV.H), [...new Set(near)].join()); }
process.exit(ok ? 0 : 1);
