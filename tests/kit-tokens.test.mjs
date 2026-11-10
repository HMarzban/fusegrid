import { readFileSync, readdirSync, statSync } from "node:fs";
import { BIOMES, biomeOf } from "../src/core/config.js";
import { CONST, LUM, TINT, lum, toL, tint, uiBiome, WALLTEX_A, worldTokens } from "../src/render/kit/tokens.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

const LV = [1, 2, 3, 4, 5, 6, 7, 8];
const HEX = /^#[0-9a-f]{6}$/;
const STATE = Object.keys(LUM).filter((k) => k !== "wallTex");
const tol = (target) => Math.max(0.002, 0.02 * target);
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hue = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255),
    mx = Math.max(r, g, b),
    d = mx - Math.min(r, g, b);
  if (!d) return 0;
  const k = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return k * 60;
};
const rows = (s) => Object.fromEntries(s.trim().split("\n").map((l) => { const [w, ...v] = l.trim().split(/\s+/); return [w, v]; }));

/* appendix 1.5, first table: bed bedA bedB pane well key band rule lit lit2 lip mid */
const PIN = rows(`
JUNGLE  #062114 #061e0c #07250e #04160d #051709 #34270c #524b27 #3e2e0e #87f674 #82cd84 #139516 #149c17
ICE     #0d1f24 #141b1c #162224 #081316 #0f1516 #202b2e #484b4d #263337 #d7dedf #92c4cd #65878d #698c93
FACTORY #191d22 #191a1b #1e1f22 #0f1218 #141416 #262a2d #494b4e #2d3135 #ffd6a4 #e5b194 #cb652c #cd6c36
WATER   #0c1f27 #051d22 #06232a #03141b #04161b #242a2e #464c50 #2b3237 #a5eae6 #99c3c3 #3c8d8c #449291
ARENA   #241827 #1f1627 #291931 #190d1d #18111e #2b2827 #504a46 #33302e #ffd1dc #e6acbc #cf5b7a #d16281
SAND    #261a0b #20190a #271e0a #191005 #191408 #30271c #504b40 #392e21 #f4daa4 #d0b991 #a6792f #aa7f37
VOID    #1c1c22 #1c1728 #201f29 #121218 #171123 #2c2638 #53436a #332d3f #e5d7f5 #c3b6d4 #8f77ad #937db1
CROWN   #251919 #28150e #301a14 #1a0f0f #1f100b #362519 #55492d #402c1e #ffd95f #d9b76f #a67a1b #ac7f1c`);
const PIN_K = ["bed", "bedA", "bedB", "pane", "well", "key", "band", "rule", "lit", "lit2", "lip", "mid"];
/* appendix 1.5, second table: keyhi lithi glow wall wallHi bg1 */
const PIN2 = rows(`
JUNGLE  rgba(255,232,120,0.22) rgba(232,255,180,0.7) rgba(66,240,36,0.25)  #d4a030 #ffe878 #062416
ICE     rgba(218,230,234,0.22) rgba(245,245,245,0.7) rgba(92,159,175,0.25) #3a4d54 #dae6ea #0f2429
FACTORY rgba(208,216,224,0.22) rgba(255,246,213,0.7) rgba(255,154,32,0.25) #8a96a4 #d0d8e0 #0e1218
WATER   rgba(192,208,220,0.22) rgba(211,255,248,0.7) rgba(58,208,200,0.25) #6a7a88 #c0d0dc #041820
ARENA   rgba(200,184,176,0.22) rgba(255,243,246,0.7) rgba(255,106,140,0.25) #6a6460 #c8b8b0 #140818
SAND    rgba(240,224,192,0.22) rgba(253,247,204,0.7) rgba(232,176,64,0.25) #c4a070 #f0e0c0 #241808
VOID    rgba(138,112,176,0.22) rgba(249,243,255,0.7) rgba(106,32,200,0.25) #1a1428 #8a70b0 #020108
CROWN   rgba(240,208,128,0.22) rgba(255,246,206,0.7) rgba(255,212,71,0.25) #8a6040 #f0d080 #140808`);
const PIN2_K = ["keyhi", "lithi", "glow", "wall", "wallHi", "bg1"];
/* appendix 1.4, ICE after uiBiome */
const ICE_UI = { bg0: "#5c9faf", bg1: "#0f2429", floor0: "#8bb9c4", floor1: "#6a9eab", wall: "#3a4d54", wallHi: "#dae6ea", brickA: "#f4fcfe", brickB: "#a7dfea", brickHi: "#ffffff" };

check("constants are the appendix's", JSON.stringify(CONST) === JSON.stringify({ ink: "#fff2df", t2: "#dccbb8", off: "#8f8476", dk: "#1e1216", ol: "#0b0609", yel: "#ffd447", yelInk: "#2a1426", yelLip: "#c8981e", cor: "#ff5d73", cord: "#ff9d5a", cord2: "#b8582a", medal: "#ffd447" }));
check("state lightness is the appendix's", JSON.stringify(LUM) === JSON.stringify({ bed: 0.012, bedA: 0.01, bedB: 0.014, pane: 0.006, well: 0.007, key: 0.022, band: 0.07, mid: 0.24, lit: 0.72, lit2: 0.5, lip: 0.22, rule: 0.03, wallTex: 0.06 }));
check("ICE tint is the appendix's", JSON.stringify(TINT) === JSON.stringify({ ICE: { h: 192, s: 0.62, brick: { h: 190, s: 1.1 }, frame: { h: 196, s: 0.5, warm: 0.06 } } }));
check("CONST, LUM, TINT are frozen to the leaves", [CONST, LUM, TINT, TINT.ICE, TINT.ICE.brick, TINT.ICE.frame].every(Object.isFrozen));
check("lum is Rec.709 on linear sRGB", lum("#ffffff") === 1 && lum("#000000") === 0 && Math.abs(lum("#808080") - 0.2158605) < 1e-6);
check("tint with no entry returns the hex unchanged", tint("#2e4a78") === "#2e4a78" && tint("#2e4a78", null) === "#2e4a78");

let worst = ["", 0];
for (const L of LV) {
  const t = worldTokens(L);
  for (const k of STATE) {
    const d = HEX.test(t[k]) ? Math.abs(lum(t[k]) - LUM[k]) : Infinity;
    if (d / tol(LUM[k]) > worst[1]) worst = [t.name + "." + k + " " + t[k] + " off " + d.toFixed(4), d / tol(LUM[k])];
  }
}
check("every state token lands on its pinned lightness in all eight worlds", worst[1] <= 1, worst[0]);
check("lit vs well >= 3:1 in every world", LV.every((L) => ratio(worldTokens(L).lit, worldTokens(L).well) >= 3), LV.map((L) => ratio(worldTokens(L).lit, worldTokens(L).well).toFixed(2)).join());
check("ink vs bed >= 4.5:1 in every world", LV.every((L) => ratio(CONST.ink, worldTokens(L).bed) >= 4.5), LV.map((L) => ratio(CONST.ink, worldTokens(L).bed).toFixed(2)).join());

const ice = worldTokens(2);
check("ICE brickA hue is within 10 degrees of 190", ice.name === "ICE" && Math.abs(hue(ice.brickA) - 190) <= 10, hue(ice.brickA).toFixed(1));
check("ICE UI slots are the tinted cyan, never the raw navy", Object.entries(ICE_UI).every(([k, v]) => ice.biome[k] === v && uiBiome(BIOMES[1])[k] === v) && ice.wall === "#3a4d54" && ice.brickA === "#f4fcfe" && ice.bg1 !== BIOMES[1].bg1);
check("the other seven worlds keep their game slots", LV.filter((L) => L !== 2).every((L) => uiBiome(biomeOf(L)) === biomeOf(L)));

const bad = [];
for (const L of LV) {
  const t = worldTokens(L);
  PIN_K.forEach((k, i) => t[k] !== PIN[t.name][i] && bad.push(t.name + "." + k + " " + t[k] + "!=" + PIN[t.name][i]));
  PIN2_K.forEach((k, i) => t[k] !== PIN2[t.name][i] && bad.push(t.name + "." + k + " " + t[k] + "!=" + PIN2[t.name][i]));
}
check("every token equals the appendix's result table (toL pinned)", bad.length === 0 && Object.keys(PIN).length === 8 && Object.keys(PIN2).length === 8, bad.join(" "));

const BRIEF = ["frame", "boss", "bed", "bedA", "bedB", "pane", "well", "key", "band", "mid", "lit", "lit2", "lip", "rule", "wallTex", "brickA", "brickB", "floor0", "floor1", "wall"];
const MOCK = ["keyhi", "lithi", "glow", "wallHi", "bg1", ...Object.keys(CONST)];
check("every world has the brief's tokens, the mock's and biome + name", LV.every((L) => [...BRIEF, ...MOCK, "biome", "name"].every((k) => worldTokens(L)[k] !== undefined)));
check("CONST rides along unchanged", LV.every((L) => Object.keys(CONST).every((k) => worldTokens(L)[k] === CONST[k])));
check("slots pass through from the tinted biome", LV.every((L) => { const t = worldTokens(L); return ["brickA", "brickB", "floor0", "floor1", "wall", "wallHi", "bg1"].every((k) => t[k] === t.biome[k] && HEX.test(t[k])) && t.name === t.biome.name; }));
check("biome keeps every field the painters read", LV.every((L) => Object.keys(biomeOf(L)).every((k) => worldTokens(L).biome[k] !== undefined)) && worldTokens(1).biome.hWall === 22 && worldTokens(2).biome.hWall === 36);
check("frame is the wall, boss is wallHi", LV.every((L) => { const t = worldTokens(L); return t.frame === t.wall && t.boss === t.wallHi; }));
let veilOff = 0;
for (const L of LV) veilOff = Math.max(veilOff, Math.abs(lum(worldTokens(L).wallTex.veil) - 0.002));
check("wallTex is {veil, a}: the bg1 veil at L .002 and the solved alpha", LV.every((L) => { const t = worldTokens(L), w = t.wallTex; return Object.isFrozen(w) && Object.keys(w).join() === "veil,a" && w.veil === toL(t.bg1, 0.002) && w.a === WALLTEX_A[t.name]; }) && veilOff <= tol(0.002), veilOff.toFixed(5));

check("WALLTEX_A: one alpha in (0,1) per biome", Object.isFrozen(WALLTEX_A) && Object.keys(WALLTEX_A).join() === BIOMES.map((b) => b.name).join() && Object.values(WALLTEX_A).every((a) => typeof a === "number" && a > 0 && a < 1), JSON.stringify(WALLTEX_A));

check("cached per biome: the same object every call", worldTokens(3) === worldTokens(3) && worldTokens(1) === worldTokens(9) && worldTokens(8) === worldTokens(16) && new Set(LV.map(worldTokens)).size === 8);
check("frozen, nested parts included", LV.every((L) => { const t = worldTokens(L); return Object.isFrozen(t) && Object.isFrozen(t.biome) && Object.isFrozen(t.wallTex); }));
check("level maps to a world exactly as biomeOf does (0 and below are JUNGLE)", [-3, 0, ...LV, 9, 12, 16].every((L) => worldTokens(L).name === biomeOf(L).name) && worldTokens(0) === worldTokens(1));
check("the game's BIOMES entries are never frozen or changed", BIOMES.every((b) => !Object.isFrozen(b)) && BIOMES[1].wall === "#2e4a78" && BIOMES[1].bg1 === "#0a2048");

const kit = new URL("../src/render/kit/", import.meta.url);
const walk = (u) => readdirSync(u).flatMap((f) => (statSync(new URL(f, u)).isDirectory() ? walk(new URL(f + "/", u)) : f.endsWith(".js") ? [new URL(f, u)] : []));
const banned = /getImageData|toDataURL|\bfilter\b|shadowBlur|shadowColor/;
const files = walk(kit);
check("no getImageData / toDataURL / filter / shadow blur anywhere under src/render/kit/**", files.length >= 2 && files.every((u) => !banned.test(readFileSync(u, "utf8"))), files.filter((u) => banned.test(readFileSync(u, "utf8"))).map((u) => u.pathname).join());
const imports = [...readFileSync(new URL("tokens.js", kit), "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
check("tokens.js imports only core config", imports.join() === "../../core/config.js", imports.join());

console.log(pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
