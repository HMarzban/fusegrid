/* Owner preview page for direction D: tiles only, no board. Reads the exports (2d/ px/ 3d/ 3d-anim/ under <dir>) and the round-3 exports, writes one self-contained HTML
   (data URIs). node tools/tileart/previewpage.mjs <exportDir> <round3Dir> <out.html> */
import {readFileSync, writeFileSync, existsSync} from "node:fs";
const [dir, r3, out] = process.argv.slice(2);
const TILES = [["jungle", "booster", "BOOSTER", "JUNGLE"], ["ice", "ice-patch", "ICE PATCH", "ICE"], ["factory", "conveyor", "CONVEYOR", "FACTORY"], ["water", "stream", "STREAM", "WATER"], ["arena", "trap", "TRAP", "ARENA"], ["sand", "quicksand", "QUICKSAND", "SAND"], ["void", "portal", "PORTAL", "VOID"], ["crown", "gate", "GATE", "CROWN"]];
const H = ["core", "plus", "max"];
const img = (f) => (existsSync(f) ? "data:image/png;base64," + readFileSync(f).toString("base64") : "");
const D = {};
for (const [w, p] of TILES) for (const h of H) { const n = `${w}-${p}-${h}`; D[n] = {d2: img(`${dir}/2d/${n}.png`), px: img(`${dir}/px/${n}.png`), d3: img(`${dir}/3d/${n}.png`), an: img(`${dir}/3d-anim/${n}.png`), o2: img(`${r3}/2d/${n}.png`), op: img(`${r3}/px/${n}.png`), o3: img(`${r3}/3d/${n}.png`)}; }
const html = `<title>Floor Tiles Direction D</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#f2f4f9;--panel:#fff;--line:#d3d9e6;--tx:#12182a;--mu:#556080;--ac:#2456c8;--acbg:#e6edfc}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0b0f1a;--panel:#121929;--line:#27324d;--tx:#e6ecf8;--mu:#8d9ab8;--ac:#86b4ff;--acbg:#16254a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0b0f1a;--panel:#121929;--line:#27324d;--tx:#e6ecf8;--mu:#8d9ab8;--ac:#86b4ff;--acbg:#16254a;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 ui-sans-serif,system-ui,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding-block:20px 60px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:24px;margin:0 0 6px}h3{font-size:15px;margin:0}p{color:var(--mu);margin:4px 0;max-width:80ch}
.bar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;position:sticky;top:env(safe-area-inset-top,0px);background:var(--bg);padding-block:8px;z-index:5;border-bottom:1px solid var(--line)}
button{border:1px solid var(--line);background:var(--panel);color:var(--tx);border-radius:8px;padding:7px 12px;font:inherit;cursor:pointer;min-height:38px}
button[aria-pressed=true]{border-color:var(--ac);color:var(--ac);background:var(--acbg);font-weight:600}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:12px 0}
.row{display:flex;flex-wrap:wrap;gap:16px;margin-top:8px}.cell{display:flex;flex-direction:column;gap:4px}
.cap{font:600 11px/1 ui-monospace,Menlo,monospace;color:var(--mu);letter-spacing:.07em;text-transform:uppercase}
.three{display:flex;gap:4px}img{display:block;border-radius:3px;max-width:100%;height:auto}.px img{image-rendering:pixelated}
.gray img{filter:grayscale(1)}
</style>
<div class="wrap"><h1>Floor tiles, direction D</h1>
<p>Hardware sunk into the floor for ICE PATCH, CONVEYOR, TRAP, PORTAL and GATE; the ground itself changed for BOOSTER, STREAM and QUICKSAND. Tiles alone, no board. Each group is CORE, PLUS, MAX. Today is round 3.</p>
<div class="bar"><button id="b1" aria-pressed="false">True size</button><button id="b2" aria-pressed="false">Grayscale</button><button id="b3" aria-pressed="true">Show today</button></div><div id="o"></div></div>
<script>
const D=${JSON.stringify(D)},T=${JSON.stringify(TILES)},H=["core","plus","max"];
let tr=false,gr=false,td=true;
const el=(t,a,...k)=>{const e=document.createElement(t);for(const x in a||{})e.setAttribute(x,a[x]);for(const c of k.flat())e.append(c);return e};
const imgs=(n,k,w)=>{const r=el("div",{class:"three"});H.forEach((h,i)=>{const s=D[n(h)][k];if(s){const m=el("img",{src:s,width:w,alt:n(h)});r.append(m)}});return r};
function draw(){const o=document.getElementById("o");o.textContent="";
 for(const [w,p,name,bio] of T){const card=el("div",{class:"card"+(gr?" gray":"")});card.append(el("h3",{},name+" · "+bio));
  const n=(h)=>w+"-"+p+"-"+h,row=el("div",{class:"row"});
  const add=(lab,k,wd,cls)=>{const c=el("div",{class:"cell "+(cls||"")});c.append(el("div",{class:"cap"},lab),imgs(n,k,wd));row.append(c)};
  add("CLASSIC 2D","d2",tr?40:120);if(td)add("today","o2",tr?40:120);
  add("PIXEL","px",tr?60:120,"px");if(td)add("today","op",tr?60:120,"px");
  add("REAL 3D","d3",tr?60:140);if(td)add("today","o3",tr?60:140);
  card.append(row);const an=H.map(h=>D[n(h)].an).filter(Boolean);
  if(an.length&&!tr){const r2=el("div",{class:"row"});H.forEach(h=>{const s=D[n(h)].an;if(s){const c=el("div",{class:"cell"});c.append(el("div",{class:"cap"},"REAL 3D motion · "+h),el("img",{src:s,width:380,alt:"motion "+h}));r2.append(c)}});card.append(r2)}
  o.append(card)}}
for(const [id,f] of [["b1",()=>tr=!tr],["b2",()=>gr=!gr],["b3",()=>td=!td]]){const b=document.getElementById(id);b.onclick=()=>{f();b.setAttribute("aria-pressed",String(id==="b1"?tr:id==="b2"?gr:td));draw()}}
draw();
</script>`;
writeFileSync(out, html); console.log("wrote", out, (html.length / 1e6).toFixed(2) + " MB");
