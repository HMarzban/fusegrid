/* QA: one real gen-2 room in the live renderer (2d default, argv[5] 3d) with the new tile
   art (FACTORY room 3, CONVEYOR, MAX). Foes frozen for the still; the seed is
   the one whose tiles are most visible (fewest under bricks). */
import {writeFileSync} from "node:fs";
import {withPage, sleep, OUT, WT} from "./harness.mjs";
const {genBoard2} = await import(WT + "/src/core/board2.js");
const {T} = await import(WT + "/src/core/config.js");
const fmix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const ROOM = +(process.argv[2] || 3), HEAT = +(process.argv[3] || 2), FILE = process.argv[4] || OUT + "qa-in-game-2d.png", KIND = process.argv[5] || "2d";
let best = null;
for (let s = 0; s < 300; s++) {
  const seed = fmix(s * 7919 + 13), b = genBoard2(seed, ROOM, HEAT);
  if (!b.feat || b.layout.fallback) continue;
  let vis = 0; b.feat.forEach((v, k) => { if (v && b.grid[k] === T.EMPTY) vis++; });
  if (!best || vis > best.vis) best = {seed, vis};
}
await withPage(async (P) => {
  await P.key("Enter"); await sleep(5400); await P.ev("window.__GAME__.begin()"); await sleep(KIND === "3d" ? 4000 : 900);
  const r = await P.ev(`import('/src/core/sim.js').then(m=>{const G=window.__GAME__.G;G.gen=2;G.seed=${best.seed};G.heat=${HEAT};G.pact=0;G.featTier=null;m.loadLevel(G,${ROOM},false);G.state='PLAY';G.players[0].iFrames=1e9;for(const e of G.enemies){e.speed=0;e.invuln=true;e.invulnT=1e9;}G.featT=0.4;return Array.from(G.feat||[]).filter(v=>v).length;})`);
  await sleep(KIND === "3d" ? 3000 : 700);
  const rect = await P.ev(`(()=>{const r=document.getElementById('c').getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height};})()`);
  const shot = await P.S("Page.captureScreenshot", {format: "png", clip: {...rect, scale: 2}});
  writeFileSync(FILE, Buffer.from(shot.data, "base64"));
  console.log("room", ROOM, "heat", HEAT, "seed", best.seed, "tiles", r, P.errors);
}, {render: KIND});
