# UI upgrade (v202+): numbers appendix

Date 2026-11-10. This is the binding numbers appendix of `2026-11-10-ui-upgrade-v202-design.md`. Later build tasks (canvas painters in `src/render/kit/`, the logo, the controller drawing, the end screens) read only this file for their numbers. The mock sources it was copied from are local only (git-ignored `.superpowers/sdd/notes/v202-ui-upgrade/`); each section names the file it came from. Paths below are relative to that folder.

## 0. Rules for reading this file

- Values are copied as built and measured in the round 7 mock-ups. Where the written direction (`round6/art/*.md`, `round7/art/logo-b.md`) and the built mock disagree, the built value is listed and the other is named under "Open: sources disagree" (section 14).
- Round 7 rule, binding everywhere: no burning cord, no spark and no "fuse leader" as a focus or selection marker. Focus is the bare bomb body at the row start plus the row band; a focused key also gets a 3 px cream ring at offset 3 px. Any "cord", "fuse burns" or "spark" text in a round 5 or 6 source quoted below is superseded. The logo's own lit fuse is the one exception (it is the logo).
- Player-facing words: "controller", never a maker's name, shape or button symbol. Buttons are named by position only (SOUTH EAST WEST NORTH, L/R SHOULDER, L/R TRIGGER, SELECT, START, D-PAD, L-STICK, R-STICK).
- Units: `px` are CSS px at the real screen size (desktop 1366x768, phone 393x852). `L` = label cap height (desktop 14.8 px, phone 11.3 px at 100 % text). `C` = logo cap height. `W` = controller body width. `k` = keyboard key pitch.
- Relative luminance everywhere is Rec.709 on linearised sRGB: `0.2126 R + 0.7152 G + 0.0722 B`.

## 1. World tokens

Source: `round7/K7-kit/kit5.js` (`CONST`, `LUM`, `TINT`, `toL`, `tint`, `uiBiome`, `tokens`).

### 1.1 Constants (the same in every world)

```js
export const CONST = {ink: "#fff2df", t2: "#dccbb8", off: "#8f8476", dk: "#1e1216", ol: "#0b0609",
  yel: "#ffd447", yelInk: "#2a1426", yelLip: "#c8981e", cor: "#ff5d73", cord: "#ff9d5a", cord2: "#b8582a", medal: "#ffd447"};
```

| Token | Hex | Role |
|---|---|---|
| ink | `#fff2df` | cream text |
| t2 | `#dccbb8` | secondary text |
| off | `#8f8476` | locked legends only |
| dk | `#1e1216` | dark ink on bricks |
| ol | `#0b0609` | every outline |
| yel | `#ffd447` | the one main action per screen |
| yelInk | `#2a1426` | text and cap on yellow |
| yelLip | `#c8981e` | main key bottom inset |
| cor | `#ff5d73` | danger only |
| cord, cord2 | `#ff9d5a`, `#b8582a` | the logo's and the bomb's cord, burnt-out bomb stub (not a focus marker) |
| medal | `#ffd447` | medal outline (stroke, never fill) |

Other literals the kit uses: the yellow key top highlight `#fff3b8`; the yellow cap shadow `#6a4a08`; the quiet teaser colour `#bcad9a` (weight 600, still >= 4.5:1); the body background `#0e0a0c`.

### 1.2 Pinned state lightness (relative luminance)

```js
export const LUM = {bed: 0.012, bedA: 0.010, bedB: 0.014, pane: 0.006, well: 0.007, key: 0.022, band: 0.07,
  mid: 0.24, lit: 0.72, lit2: 0.5, lip: 0.22, rule: 0.03, wallTex: 0.06};
```

### 1.3 Derivation (copy exactly)

```js
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (h) => { const [r, g, b] = hx(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const hex = (a) => "#" + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mixA = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgba = (h, a) => { const [r, g, b] = hx(h); return `rgba(${r},${g},${b},${a})`; };
/* the world hue at a fixed lightness: mix toward black (or white) until relative L = target */
function toL(h, target) {
  const c = hx(h), dark = lum(h) > target, to = dark ? [0, 0, 0] : [255, 255, 255];
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; const L = lum(hex(mixA(c, to, m))); if ((L > target) === dark) lo = m; else hi = m; }
  return hex(mixA(c, to, (lo + hi) / 2));
}
const toHsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };
const fromHsl = ([h, s, l]) => { const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return [f(0), f(8), f(4)].map((v) => v * 255); };
/* move a hex to hue h, scale its saturation by s, then mix w toward warm cream; lightness is re-pinned by toL after */
function tint(h, t) {
  if (!t) return h;
  const [, S, Lh] = toHsl(hx(h));
  let c = fromHsl([t.h, Math.min(1, S * t.s), Lh]);
  if (t.warm) c = mixA(c, hx("#fff2df"), t.warm);
  return hex(c);
}
export const TINT = {ICE: {h: 192, s: 0.62, brick: {h: 190, s: 1.1}, frame: {h: 196, s: 0.5, warm: 0.06}}};
function uiBiome(b) {
  const t = TINT[b.name];
  if (!t) return b;
  const f = t.frame || t, keepL = (h, tt) => toL(tint(h, tt), lum(h));
  return {...b, bg0: keepL(b.bg0, t), bg1: keepL(b.bg1, t), floor0: keepL(b.floor0, t), floor1: keepL(b.floor1, t),
    wall: keepL(b.wall, f), wallHi: keepL(b.wallHi, f),
    brickA: keepL(b.brickA, t.brick || t), brickB: keepL(b.brickB, t.brick || t), brickHi: keepL(b.brickHi, t.brick || t)};
}
function tokens(b0) {
  const b = uiBiome(b0);
  return {...CONST,
    bed: toL(b.bg1, LUM.bed), bedA: toL(b.floor0, LUM.bedA), bedB: toL(b.floor1, LUM.bedB), pane: toL(b.bg1, LUM.pane),
    well: toL(b.floor0, LUM.well), key: toL(b.wall, LUM.key), keyhi: rgba(b.wallHi, 0.22), band: toL(b.wallHi, LUM.band), rule: toL(b.wall, LUM.rule),
    lit: toL(b.brickA, LUM.lit), lithi: rgba(toL(b.brickHi, 0.92), 0.7), lit2: toL(b.brickB, LUM.lit2), lip: toL(b.brickB, LUM.lip), mid: toL(b.brickB, LUM.mid),
    wall: b.wall, wallHi: b.wallHi, bg1: b.bg1, glow: rgba(b.name === "ICE" ? b.bg0 : b.brickA, 0.25)};
}
```

ICE tint inputs: hue 192, saturation x0.62 for bed, floor, key and band; bricks hue 190, saturation x1.1; frame metal (`wall`, `wallHi`) hue 196, saturation x0.5, mixed 6 % toward `#fff2df`. Lightness is re-pinned by `toL` after tinting. The board backdrop keeps the game's real ICE art; only its veil is tinted. Any other world can be retinted by adding a `TINT` entry.

### 1.4 Inputs: the game's biome slots (`src/core/config.js` `BIOMES`, read 2026-11-10)

| Level | World | bg0 | bg1 | floor0 | floor1 | wall | wallHi | brickA | brickB | brickHi |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | JUNGLE | `#0e4a28` | `#062416` | `#1a7a30` | `#126024` | `#d4a030` | `#ffe878` | `#42f024` | `#14a018` | `#d4ff70` |
| 2 | ICE | `#4a9ae0` | `#0a2048` | `#7eb8e0` | `#5a9cc8` | `#2e4a78` | `#d0e8f8` | `#f4fcff` | `#b0dcf0` | `#ffffff` |
| 3 | FACTORY | `#3d4a58` | `#0e1218` | `#3a3c40` | `#282a2e` | `#8a96a4` | `#d0d8e0` | `#ff9a20` | `#c45010` | `#ffe06a` |
| 4 | WATER | `#0a3a48` | `#041820` | `#0e4a58` | `#0a3844` | `#6a7a88` | `#c0d0dc` | `#3ad0c8` | `#1a7a78` | `#b8fff4` |
| 5 | ARENA | `#4a2058` | `#140818` | `#3a2848` | `#281830` | `#6a6460` | `#c8b8b0` | `#ff6a8c` | `#c23058` | `#ffc0d0` |
| 6 | SAND | `#6a4a18` | `#241808` | `#c49840` | `#a07828` | `#c4a070` | `#f0e0c0` | `#e8b040` | `#a07020` | `#fbf1a0` |
| 7 | VOID | `#0a0614` | `#020108` | `#140e20` | `#0a0814` | `#1a1428` | `#8a70b0` | `#6a20c8` | `#3a1070` | `#d0a0ff` |
| 8 | CROWN | `#3a2010` | `#140808` | `#5a3020` | `#3a2018` | `#8a6040` | `#f0d080` | `#ffd447` | `#c49020` | `#fff0a8` |

ICE after `uiBiome` (the other seven are unchanged):

| bg0 | bg1 | floor0 | floor1 | wall | wallHi | brickA | brickB | brickHi |
|---|---|---|---|---|---|---|---|---|
| `#5c9faf` | `#0f2429` | `#8bb9c4` | `#6a9eab` | `#3a4d54` | `#dae6ea` | `#f4fcfe` | `#a7dfea` | `#ffffff` |

### 1.5 Results: `tokens()` per world (computed by running the mock's own functions under Node)

| World | bed | bedA | bedB | pane | well | key | band | rule | lit | lit2 | lip | mid |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| JUNGLE | `#062114` | `#061e0c` | `#07250e` | `#04160d` | `#051709` | `#34270c` | `#524b27` | `#3e2e0e` | `#87f674` | `#82cd84` | `#139516` | `#149c17` |
| ICE | `#0d1f24` | `#141b1c` | `#162224` | `#081316` | `#0f1516` | `#202b2e` | `#484b4d` | `#263337` | `#d7dedf` | `#92c4cd` | `#65878d` | `#698c93` |
| FACTORY | `#191d22` | `#191a1b` | `#1e1f22` | `#0f1218` | `#141416` | `#262a2d` | `#494b4e` | `#2d3135` | `#ffd6a4` | `#e5b194` | `#cb652c` | `#cd6c36` |
| WATER | `#0c1f27` | `#051d22` | `#06232a` | `#03141b` | `#04161b` | `#242a2e` | `#464c50` | `#2b3237` | `#a5eae6` | `#99c3c3` | `#3c8d8c` | `#449291` |
| ARENA | `#241827` | `#1f1627` | `#291931` | `#190d1d` | `#18111e` | `#2b2827` | `#504a46` | `#33302e` | `#ffd1dc` | `#e6acbc` | `#cf5b7a` | `#d16281` |
| SAND | `#261a0b` | `#20190a` | `#271e0a` | `#191005` | `#191408` | `#30271c` | `#504b40` | `#392e21` | `#f4daa4` | `#d0b991` | `#a6792f` | `#aa7f37` |
| VOID | `#1c1c22` | `#1c1728` | `#201f29` | `#121218` | `#171123` | `#2c2638` | `#53436a` | `#332d3f` | `#e5d7f5` | `#c3b6d4` | `#8f77ad` | `#937db1` |
| CROWN | `#251919` | `#28150e` | `#301a14` | `#1a0f0f` | `#1f100b` | `#362519` | `#55492d` | `#402c1e` | `#ffd95f` | `#d9b76f` | `#a67a1b` | `#ac7f1c` |

| World | keyhi | lithi | glow | wall | wallHi | bg1 |
|---|---|---|---|---|---|---|
| JUNGLE | `rgba(255,232,120,0.22)` | `rgba(232,255,180,0.7)` | `rgba(66,240,36,0.25)` | `#d4a030` | `#ffe878` | `#062416` |
| ICE | `rgba(218,230,234,0.22)` | `rgba(245,245,245,0.7)` | `rgba(92,159,175,0.25)` | `#3a4d54` | `#dae6ea` | `#0f2429` |
| FACTORY | `rgba(208,216,224,0.22)` | `rgba(255,246,213,0.7)` | `rgba(255,154,32,0.25)` | `#8a96a4` | `#d0d8e0` | `#0e1218` |
| WATER | `rgba(192,208,220,0.22)` | `rgba(211,255,248,0.7)` | `rgba(58,208,200,0.25)` | `#6a7a88` | `#c0d0dc` | `#041820` |
| ARENA | `rgba(200,184,176,0.22)` | `rgba(255,243,246,0.7)` | `rgba(255,106,140,0.25)` | `#6a6460` | `#c8b8b0` | `#140818` |
| SAND | `rgba(240,224,192,0.22)` | `rgba(253,247,204,0.7)` | `rgba(232,176,64,0.25)` | `#c4a070` | `#f0e0c0` | `#241808` |
| VOID | `rgba(138,112,176,0.22)` | `rgba(249,243,255,0.7)` | `rgba(106,32,200,0.25)` | `#1a1428` | `#8a70b0` | `#020108` |
| CROWN | `rgba(240,208,128,0.22)` | `rgba(255,246,206,0.7)` | `rgba(255,212,71,0.25)` | `#8a6040` | `#f0d080` | `#140808` |

Measured deviation of those 8-bit hexes from `LUM`, worst of the eight worlds (hex quantisation, not a bug):

| State | Target | Max absolute deviation | Max relative |
|---|---|---|---|
| bed | 0.012 | 0.0004 | 3.4 % |
| bedA | 0.010 | 0.0003 | 2.6 % |
| bedB | 0.014 | 0.0005 | 3.4 % |
| pane | 0.006 | 0.0003 | 4.8 % |
| well | 0.007 | 0.0004 | 5.0 % |
| key | 0.022 | 0.0006 | 2.6 % |
| band | 0.07 | 0.0011 | 1.6 % |
| rule | 0.03 | 0.0007 | 2.4 % |
| lit | 0.72 | 0.0056 | 0.8 % |
| lit2 | 0.5 | 0.0026 | 0.5 % |
| lip | 0.22 | 0.0031 | 1.4 % |
| mid | 0.24 | 0.0017 | 0.7 % |

See section 14, item 1: a flat +-0.002 tolerance fails `lit`, `lit2` and `lip`.

### 1.6 Locked-wall texture (`WALLTEX_A`)

Source: `kit5.js` `wallTex`, `paintBoard`. The LOCKED face is the world's own wall cell (`wallShapes(b, 1)` painted at 0,0 on a 40x40 canvas, `b = uiBiome(world)`), then a dark veil `rgba(toL(b.bg1, 0.002), a)` over the whole cell. `a` is solved per world by 14 bisection steps (`lo 0, hi 1`; `a = (lo+hi)/2`; if the cell's mean relative luminance > target then `lo = a` else `hi = a`) so the cell's mean relative luminance equals `LUM.wallTex` 0.06. The mock measures with `getImageData`; the build solves it offline (`tools/ui/walltex.mjs`) and commits `WALLTEX_A` per biome. The per-world alphas were not computed here (no canvas in Node); run the tool. The texture tiles `left top / auto 100% repeat-x` over a `well` base. Gate: locked texture standard deviation >= 2x a floor cell's.

## 2. Type and device metrics

Source: `round7/K7-kit/kit5.css`.

```css
--sans: system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
--disp: "Rubik","Arial Rounded MT Bold",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;  /* first release: the system heavy stack */
.lbl  { font: 700 var(--pri)/1.15 var(--sans); letter-spacing: 0 }
.sub  { font: 700 var(--sec)/1.2  var(--sans); letter-spacing: 0; color: var(--t2) }
.body { font: 400 var(--bod)/1.5  var(--sans); color: var(--t2); max-width: 60ch }   /* .body b: 700, ink */
.num  { font-size: var(--pri); font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: 0 }
.num.hud { font: 800 var(--hud)/1 var(--disp) }
/* display = the logo recipe: heavy, dark outline 0.12em, hard drop 0.08em, never a glow */
.dsp  { font-family: var(--disp); font-weight: 900; line-height: 1.05; letter-spacing: 0; color: var(--ink);
        -webkit-text-stroke: .12em var(--ol); paint-order: stroke fill; text-shadow: 0 .08em 0 var(--ol) }
.dsp.ttl { font-size: var(--ttl) }   /* .dsp.y color yel, .dsp.c color cor */
```

Canvas equivalent for display: CSS `-webkit-text-stroke` is centred on the glyph edge and `paint-order: stroke fill` lets the fill hide the inner half, so stroke the text with `lineWidth = 0.12 em` in `#0b0609` (round joins), then fill it in the face colour (the visible ring outside the glyph is then 0.06 em); the drop is the same text offset +0.08 em in y, `#0b0609`, drawn first. Labels CAPS for three words or fewer, letter-spacing 0, no monospace for words, units unspaced (`2.5s`).

Device variables (`body.d` desktop, `body.p` phone; `--ts` = text scale, 1 or 1.25 in `body.t125`; sizes marked `*ts` are multiplied):

| Variable | Desktop | Phone |
|---|---|---|
| `--pri` (label, primary) | 21 * ts | 16 * ts |
| `--sec` (secondary) | 16 * ts | 13.5 * ts |
| `--hud` (HUD values) | 27 * ts | 20 * ts |
| `--bod` (body) | 18 * ts | 15 * ts |
| `--ttl` (page title) | 40 * ts | 30 * ts |
| `--rowh` | 40 | 52 |
| `--keyh` | 30 | 44 |
| `--btnh` | 50 | 52 |
| `--capw` / `--caph` | 34 / 30 | 30 / 28 |
| `--rkw` (rocker cell width) | 64 | 54 |
| `--mcw` / `--mch` (meter cell) | 12 / 26 | 9 / 28 |
| `--bkh` (bank, modifier, tab key height) | 36 | 44 |
| `--lch` / `--lcw` (course cell) | 40 / 40 | 44 / 36 |
| `--sdw` / `--sdh` / `--sdf` (score digit) | 38 / 52 / 34 | 32 / 46 / 28 |
| `--tg` (tag height) | 26 | 24 |
| `--bombs` (focus bomb) | 30 | 28 |
| `--labx` (row label inset) | 50 | 42 |
| `--T` (plate ring width) | 16 | 10 |

Measured cap-height ratio of the system sans 700 on macOS: 0.705 (so 21 px = 14.8 cap, 16 px = 11.27 cap, 16 px secondary = 11.27, 13.5 px = 9.51). Plate background tile: 80 px desktop, 56 px phone.

## 3. The key (one painter for every pressable or valued part)

Source: `kit5.css` ("THE key"), `kit5.js` `key()`. Shape: 2 px outline `#0b0609`, radius 6, hard unblurred drop, legend ink `#fff2df`, 700. Height `--keyh`, min width `--keyh`; legend padding `0 10px`, gap 8.

```css
/* ---------- THE key (B): thick dark outline, rounded 6, hard unblurred drop; face from the world, ink constant ---------- */
.k{position:relative;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;flex:none;height:var(--keyh);min-width:var(--keyh);
  border:2px solid var(--ol);border-radius:6px;color:var(--ink);font:700 var(--pri)/1 var(--sans)}
.k .fc{display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;padding:0 10px;max-width:100%}
.k.key{background:var(--key);box-shadow:0 4px 0 var(--ol),inset 0 2px 0 var(--keyhi)}
.k.main{background:var(--yel);color:var(--yelInk);box-shadow:0 5px 0 var(--ol),inset 0 -5px 0 var(--yelLip),inset 0 2px 0 #fff3b8}
.k.dng{background:var(--key);color:var(--cor);border-color:var(--ol);box-shadow:0 4px 0 var(--ol),inset 0 0 0 2px var(--cor)}
/* CHOSEN: the world's brick standing up (brickA face, brickHi strip, brickB lip), dark ink */
/* the brick's own two-tone (paintBrick): a lit top face over a darker lower body, the brickHi strip on top. This
   two-tone is what tells a CHOSEN brick from the flat sunny-yellow MAIN key, even in CROWN where both are gold */
.k.lit{background:linear-gradient(var(--lithi),var(--lithi)) 3px 3px/calc(100% - 6px) 3px no-repeat,linear-gradient(var(--lit) 0 54%,var(--lit2) 54%);color:var(--dk);box-shadow:0 4px 0 var(--ol),inset 0 -4px 0 var(--lip);transform:translateY(-2px)}
.k.mid{background:var(--mid);box-shadow:0 3px 0 var(--ol),inset 0 -4px 0 rgba(0,0,0,.25)}
/* UNCHOSEN: the world's floor, sunk: no drop, an inner shade */
.k.well{background:var(--well);color:var(--t2);box-shadow:inset 0 3px 0 rgba(0,0,0,.6)}
.k.well.dorm{background:var(--well)}
/* LOCKED: the world's wall cell, dark; legend on its own dark chip */
.k.wall{background:var(--walltex) left top/auto 100% repeat-x,var(--well);color:var(--off);box-shadow:inset 0 2px 0 rgba(0,0,0,.4)}
.lkc{display:inline-flex;align-items:center;gap:6px;background:var(--ol);border-radius:4px;padding:2px 8px;font:700 var(--sec)/1 var(--sans);color:var(--off)}
/* sizes */
.k.cap{height:var(--caph);min-width:var(--capw);font:700 var(--sec)/1 var(--sans);color:var(--t2)}
.k.cap .fc{padding:0 8px}
.k.btn{height:var(--btnh);min-width:120px}
.k.btn .fc{gap:12px;padding:0 18px}
.k.btn .k.cap{color:var(--t2)}
.k.main.btn .k.cap{background:var(--yelInk);color:var(--yel);box-shadow:0 3px 0 #6a4a08}
.k.back{height:44px}
.chev{display:inline-flex;color:var(--t2)}
```

| Kind | Face | Drop below | Inner | Legend colour | Other |
|---|---|---|---|---|---|
| key | `key` | 4 px `#0b0609` | top inset 2 px `keyhi` | ink | the plain pressable |
| main | `#ffd447` | 5 px | bottom inset 5 px `#c8981e`, top inset 2 px `#fff3b8` | `#2a1426` | the ONE main action |
| dng | `key` | 4 px | inner ring 2 px `#ff5d73` | `#ff5d73` | danger |
| lit | brick two-tone (`lit` top 54 %, `lit2` below, `lithi` strip 3 px at inset 3, 3 px tall) | 4 px | bottom inset 4 px `lip` | `#1e1216` | raised 2 px |
| mid | `mid` | 3 px | bottom inset 4 px black at .25 | ink | meter body cell |
| well | `well` | none | top inset 3 px black at .6 | `#dccbb8` | sunk |
| wall | wall texture over `well` | none | top inset 2 px black at .4 | `#8f8476` on `.lkc` chip | locked |

Every key reads label first, keycap last. Phone shows no keycaps. A key legend that is wider than its key is a gate failure.

## 4. Values, rows and marks

Source: `kit5.css`, `kit5.js`.

```css
/* ---------- frames ---------- */
/* plate: the panel cut into the world's rampart; bed = the world's floor checker in shadow; the ring is the border */
.plate{position:relative;background:repeating-conic-gradient(var(--bedA) 0 25%,var(--bedB) 0 50%) 0 0/80px 80px;box-shadow:inset 0 3px 0 rgba(0,0,0,.45),inset 3px 0 0 rgba(0,0,0,.3)}
body.p .plate{background-size:56px 56px}
.pane{position:relative;background:var(--pane);border:2px solid var(--ol);border-radius:6px;box-shadow:inset 0 3px 0 rgba(0,0,0,.4)}
.phd{display:flex;flex-direction:column;gap:6px}
.hair{height:2px;background:var(--ol);margin:6px 0}
.grp{height:12px;position:relative}.grp::after{content:"";position:absolute;left:0;right:0;top:5px;height:2px;background:var(--ol)}
/* ---------- values ---------- */
.rk{display:inline-flex;gap:4px;padding:3px;background:var(--ol);border-radius:8px}
.rk>.k{width:var(--rkw);height:calc(var(--keyh) - 2px);font-size:var(--pri)}
.rk>.k.well{border-color:transparent}
.rk.lkd{background:none;padding:0}
.rk.lkd>.k{width:calc(var(--rkw)*2 + 10px)}
.lv{display:inline-flex;align-items:center;gap:10px}
.mt{display:inline-flex;gap:3px;align-items:flex-end;height:calc(var(--mch) + 4px)}
.mt>.k.mc{width:var(--mcw);min-width:0;height:var(--mch);border-radius:3px;border-width:2px}
.mt>.k.mc.lit{box-shadow:0 3px 0 var(--ol),inset 0 -4px 0 var(--lip)}
.sp{display:inline-flex;gap:6px;align-items:center}
.sp>.k.ar{width:var(--keyh);min-width:0}
.sp>.k.ar .fc{padding:0}
.sp>.k.win{min-width:180px;justify-content:flex-start}
.sp>.k.win .fc{gap:10px}
.pips{display:inline-flex;gap:3px}.pips i{width:8px;height:8px;border:1.5px solid var(--t2);border-radius:2px}.pips i.on{background:var(--ink);border-color:var(--ink)}
.bk{display:inline-flex;flex-wrap:wrap;gap:4px;padding:3px;background:var(--ol);border-radius:8px}
.bk>.k{flex:1 0 auto;min-width:var(--bkw,108px);height:var(--bkh)}
/* 125 % text: a bank reflows (wraps), it never shrinks its type */
.mds{display:inline-flex;flex-wrap:wrap;gap:10px}
.mds>.k{height:var(--bkh)}
.mds>.k .fc{padding:0 14px}
.tbs{display:flex;gap:6px;align-items:flex-end;border-bottom:4px solid var(--ol)}
.tbs>.k.tb{height:var(--bkh);border-bottom:0;border-radius:6px 6px 0 0;padding:0 6px}
.tbs>.k.tb.on{box-shadow:inset 0 2px 0 var(--keyhi);height:calc(var(--bkh) + 4px);color:var(--ink)}
.tbs>.k.tb.well{color:var(--t2)}

/* ---------- rows: label left, value right; focused = band + bomb + fuse ---------- */
.row{position:relative;display:flex;align-items:center;justify-content:space-between;min-height:var(--rowh);padding:0 12px 0 var(--labx);color:var(--ink);border-radius:6px;white-space:nowrap}
.row .lab{flex:1 1 auto;min-width:0}
.row .v{display:inline-flex;align-items:center;gap:10px;flex:none;margin-left:12px}
.row.sel{background:var(--band);box-shadow:inset 0 0 0 2px var(--ol)}
.row.lk .lab{color:var(--off)}
.row.dng .lab{color:var(--cor)}
.row.dng.sel .lab{color:var(--ink)} /* coral on the band is 3.5:1: the band, cord and reset glyph carry danger */
.row.dng .v{color:var(--cor)}
.row.hero{min-height:calc(var(--btnh) + 14px)}

/* ---------- tags: stamped plates, outline 2px ---------- */
.tg{display:inline-flex;align-items:center;gap:6px;height:var(--tg);padding:0 8px;border:2px solid var(--rc,var(--t2));border-radius:4px;background:var(--ol);color:var(--rc,var(--t2));font:700 var(--sec)/1 var(--sans);letter-spacing:0;white-space:nowrap}
.tg.new,.tg.best{--rc:var(--ink)}.tg.swap{--rc:var(--t2)}.tg.again{--rc:var(--cor)}.tg.fin{--rc:var(--t2)}.tg.lock{--rc:var(--off)}.tg.mult{--rc:var(--t2)}
.tg.medal{--rc:var(--medal)} /* medal: gold OUTLINE + octagon glyph; the yellow FILL belongs to the main action */
/* ---------- game parts ---------- */
.crs{display:inline-flex;gap:5px;align-items:flex-end}
.crs>.k.lc{width:var(--lcw);height:var(--lch);min-width:0;font-size:var(--pri)}
.crs>.k.lc .fc{gap:3px;padding:0 4px}
.sc{display:inline-flex;gap:4px;align-items:flex-end}
.sc>.k.sd{width:var(--sdw);height:var(--sdh);min-width:0;font:800 var(--sdf)/1 var(--disp)}
.sc>.k.sd .fc{padding:0}
.sc>.k.sd.sep{width:calc(var(--sdw)*.6)}
.hearts{display:inline-flex;gap:4px;align-items:center}
.sch{display:inline-block;padding:4px;background:var(--wall);border:2px solid var(--ol);border-radius:4px;box-shadow:0 4px 0 var(--ol)}
.sch canvas{display:block}
.hudb{display:flex;gap:4px;padding:4px;background:var(--ol);border-radius:8px}
.hc{flex:1;display:flex;flex-direction:column;gap:6px;padding:8px 10px 9px;background:var(--pane);border-radius:5px;box-shadow:inset 0 2px 0 rgba(0,0,0,.4);min-width:0}
.hv{display:flex;align-items:center;gap:6px;font:800 var(--hud)/1 var(--disp);color:var(--ink);height:var(--hud);white-space:nowrap}
/* ---------- feedback ---------- */
.card{padding:22px 24px 24px;display:flex;flex-direction:column;gap:12px}
.card .ct{font-size:calc(var(--ttl)*.72)}
.cbt{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px}
.cbt>.k{width:100%;min-width:0}
.gg{display:flex;flex-direction:column;gap:8px}
.gcs{display:flex;gap:3px}
.gcs>.k.gc{flex:1;min-width:0;height:22px;border-radius:3px}
.ts{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;background:var(--bed);border:2px solid var(--ol);border-radius:8px;box-shadow:0 4px 0 var(--ol);color:var(--ink)}
.ts.err{color:var(--cor)}
/* ---------- prompts ---------- */
.foot{position:relative;display:inline-flex;align-items:center;gap:12px;padding:9px 16px 11px;background:var(--bed);border:2px solid var(--ol);border-radius:8px;box-shadow:0 4px 0 var(--ol),inset 0 2px 0 var(--keyhi);white-space:nowrap;flex-wrap:wrap;justify-content:center}
.pm{display:inline-flex;align-items:center;gap:8px}
.ch{display:inline-flex;gap:5px}
.sep{color:var(--off);font-weight:700}

```

Builder behaviour (`kit5.js`): `rocker(state)` state `on | off | unset | lock` (unset: neither cell stands; lock: one wall key with legend `—` plus the lock icon); `meter(v, {n = 10})` cell i < v is `mid` (or `well` when dormant), cell v is `lit` (`mid` when dormant), the rest `well`, then `num(v * 10)` min-width 2.2em right-aligned; `stepper(value, i, n)` = key `chl` + a well window holding `n` position pips (pip i `on`) and the word + key `chev`, an arrow that cannot move (`clamp`) is a `well`; `bank(labels, chosen)` chosen is `lit`, others `well`; `mods(list)` each its own toggle key, on `lit`, off `well`; `tabs(labels, active)` open tab `key` joined to the pane, others `well`; `row(label, value, {sel, lock, dng, hero})`; `course(n, {cleared, cur, locked, finale = [5, 8]})` cell kind `wall` if locked, `lit` if r <= cleared, `key` if r == cur, else `well`, finale cells carry the flag icon; `score(v)` thousands separators via `\B(?=(\d{3})+(?!\d))`, the comma is a `well` key `sd sep`, every digit a `lit` key; `lives(n)` n <= 5 hearts (item `heart`), more: one heart plus `num(n)`; `gauge(p, {n = 15, fail})` cells i < round(p n) `lit`, with `fail` the next cell `dng`; `toast(text, kind)` icon `check` (`ok`) or `warn` (`err`) at 14 desktop / 16 phone.

Tag kinds: `new`, `best`, `swap`, `again`, `fin`, `lock`, `mult`, `medal`. Medal tag = gold outline plus the octagon glyph; the yellow fill belongs to the main action.

Card `kind main` = the yellow key: a card holds at most one. Two buttons of equal weight where the choice is a real choice (ALLOW / NO THANKS).

### 4.1 Icons (16-unit grid, round caps; `ic(name, size)`, default 16 desktop / 18 phone)

```js
chev:  '<path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
chl:   '<path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
back:  '<path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
ext:   '<path d="M9 2h5v5M14 2L7 9M12 10v4H2V4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
lock:  '<path d="M4.5 7V5a3.5 3.5 0 017 0v2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor"/>',
reset: '<path d="M3.5 8a4.5 4.5 0 104.5-4.5H5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6.5 1L4 3.5 6.5 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
check: '<path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
flag:  '<path d="M4 15V2M4 2.5h8l-2 3 2 3H4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
clock: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
up: '<path d="M3 11l5-6 5 6z" fill="currentColor"/>', dn: '<path d="M3 5l5 6 5-6z" fill="currentColor"/>',
lf: '<path d="M11 3L5 8l6 5z" fill="currentColor"/>', rt: '<path d="M5 3l6 5-6 5z" fill="currentColor"/>',
medal: '<polygon points="5,1 11,1 15,5 15,11 11,15 5,15 1,11 1,5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8" r="3" fill="currentColor"/>',
warn:  '<path d="M8 1.5l7 12.5H1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 6v3.5M8 11.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
```

Stepped (pixel) stepper triangles, `round7/C7-controls/screen.js`: left `M4 7h2V5h2V3h2V1h2v14h-2v-2H8v-2H6V9H4z`, right `M12 7h-2V5H8V3H6V1H4v14h2v-2h2v-2h2V9h2z` (16-unit grid, filled).

## 5. Focus

Source: `kit5.css` (round 7 block), `kit5.js` `fuse()` / `paint()`.

- The bomb: the game's `drawBombBody` with the body only (`{bare:true}`, plan R8). Draw call used by the mock: `translate(w/2, h/2 + h*0.04); scale(w/30)`; args `{time: 0.3, fuse: 2.5}`, `{timer: 1, variant: null}`. Size `--bombs` (30 desktop, 28 phone). Position inside a row: `left 8px`, `top 50%`, `translateY(-46%)`.
- The band: `band` token (L .07) fill with a 2 px `#0b0609` inner outline (`.row.sel`). Row radius 6.
- A focused key (PLAY, START, RESUME, TRY AGAIN, a chip, the focused ENEMIES points value): `outline: 3px solid #fff2df; outline-offset: 3px` and `padding-left: --bombs + 6px` so the legend clears the bomb (the bomb sits inside the key at its start). Ring outer reach 6 px past the key: keep clear space (phone TRY AGAIN dock gap 18, foot 24).
- Controller drawing: the ring is a circle at radius `btnR + 3 + 1.5`, stroked `#fff2df` 3 px over an underlay `#0b0609` 5 px at opacity .7.
- Removed: `.fz .cord{display:none}`; no spark, no burning animation anywhere.

## 6. Plate frame (rampart ring), boss, board backdrop

Source: `kit5.js` `ring()`, `paintBoard()`, `boardBg()`. The ring is drawn outside the plate box, so leave `T` px of clear space on every side. `T` = `data-t` or 16 desktop / 10 phone. The rail and boss shapes come from the game's tracked painters `frameart.js` `railOf` / `bossOf` and `wallart.js` `paintShapes`; the mock imports them, the kit must too.

```
k = T / 22, pad = 2; canvas = (w + 2T + 2 pad) x (h + 2T + 2 pad), placed at plate.left - T - pad, plate.top - T - pad; translate(pad, pad)
1  drop:      fill #0b0609 evenodd: rect(-1, 2, w+2T+2, h+2T+1) minus rect(T, T, w, h)
2  base:      fill b.wall evenodd: rect(0, 0, w+2T, h+2T) minus rect(T, T, w, h)         (b = uiBiome(world))
3  rails:     four bands, each clipped to its rect, translate(x, y), scale(k):
             top (T, 0, w, T, "h"), bottom (T, T+h, w, T, "h"), left (0, T, T, h, "v"), right (T+w, T, T, h, "v")
             for u = 0; u < L + 40; u += 40:  paintShapes(c, b, railOf(b, axis, 0, 40), axis "h" ? u : 0, axis "h" ? 0 : u), L = band length / k
4  bosses:    at (0,0) (T+w,0) (0,T+h) (T+w,T+h): translate, scale(k), fill b.wall rect(0,0,22,22), paintShapes(c, b, bossOf(b, 1, 11), 0, 0)
5  light:     b.wallHi at alpha .6: fillRect(0, 0, w+2T, 1.5) and fillRect(0, 0, 1.5, h+2T)
6  ink:       lineWidth 2 #0b0609: strokeRect(-1, -1, w+2T+2, h+2T+2) and strokeRect(T-1, T-1, w+2, h+2)
```

Plate fill inside the ring: `repeating-conic-gradient(bedA 0 25%, bedB 0 50%)` on an 80 px tile (56 phone), plus inset shadows `rgba(0,0,0,.45)` 3 px from the top and `rgba(0,0,0,.3)` 3 px from the left.

Board backdrop (`data-board=<level>`, veil `data-veil` default .5; WIN level clear .45, GAME OVER .72 in the mock, plan R18 replaces the GAME OVER desaturation with a cool grey veil): fill `bg1`; scale `s = max(w/600, h/520) * (data-k || 1)`; centre `(w - 600 s)/2, (h - 520 s)/2`; paint the board; veil `rgba(toL(uiBiome(b).bg1, 0.004), veil)`.

Board painter (`paintBoard`, tile T = 40, `COLS x ROWS` from `CFG`): per cell, border cells and even-even interior pillars paint `wallShapes(b, border ? borderCode(x,y) : [0,0,1,2][floor(hsh(x,y,seed)*4)])`; other cells paint `paintFloor(c, b, (x+y)&1, floorVar(x,y,level))`, then a brick when `!(x+y <= 3 || x+y >= COLS+ROWS-5) && hsh(x,y,seed+3) < 0.42`. Default seed 7.

```js
const hsh = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
```

Game art calls the mock makes on small canvases (`paint()`): foe `translate(w/2, w/2 + w*0.04); scale(w/34)`; item `translate(w/2, w/2); scale(w/26)` through `drawIcon(c, t, p.col, 0)`; MAKO `translate(w/2, h/2 + w*0.02); scale(w/40)` with colour `#37f0d0`; schematic `schem(c, 0, 0, w/15, BIOMES[(level-1) % 8])`. Default sizes: foe 24 desktop / 26 phone, item 20 / 22; schematic canvas 15*ts x 13*ts.

## 7. Custom parts: recipes by lane ("New parts")

Sources: `round6/art/allparts.md`, `round6/S6-menu/notes.md`, `round6/S6-pages/notes.md`, `round6/E6-end/notes.md`, `round6/C6-controls/notes.md`, `round7/*/notes.md`, `round7/S7-menu/screen.css`.

### 7.1 Widgets (allparts.md; every widget is a piece of the board)

| Generic | Becomes | Recipe |
|---|---|---|
| Tabs | Bricks in a wall trough | Trough = wall strip 0.3 key tall under the tabs. Chosen tab = lit brick up 2 px; others = floor wells in the trough. Each tab is a B key in shape. Open vs not squint 12.3 (RECORDS mock), >= 3 required. |
| Tooltip | Sign plaque | Bed L .012 plate, 2 px outline, hard 3 px drop. Title cream 700, then 1-2 lines sentence case t2. Pointer = a stepped notch of two square steps of 0.4L (mock draws a wall-colour wedge `polygon(50% 0,100% 100%,0 100%)`, 18x14 desktop / 16x10 phone, at `top:-24px`). Shows on focus or hover; touch: a tap on the number shows it, a tap anywhere hides it. Snaps to whole slots so it never half-covers a neighbour; ring T 8 desktop / 6 phone; padding `12px 16px 14px`; hard shadow `0 6px 0 rgba(0,0,0,.5)`. |
| Stat card | Sunk floor tile | Well, no drop. Glyph top-left, label t2, value `num()` cream. A card holding a record becomes a lit brick. |
| List row | Floor lane | Rest: nothing behind. Focus: band + bomb. Value right in t2 with a chevron. Danger rows coral label, cream when focused. |
| Toggle | Two-cell rocker | See section 4. Words ON / OFF on the cells. |
| Stepper | Key, cells, key | Chunky B keys with stepped triangles; the value is a word followed by level cells (filled = small bricks with the head carrying the brickHi strip, empty = wells). Phone: word + cells + chevron as a door value. |
| Meter | Course of bricks in a wall trough | N cells; filled = bricks, head carries brickHi strip, empty = wells. Loading = the same course filling left to right; failure stops on a coral cell. |
| Badge / tag | Plaque by meaning | 2 px outline, 0.8L, no drop. NEW BEST = brick body with one swallowtail end; NEW = cream outline with a spark dot (a dot, not a marker); FIXED / locked = wall texture on a dark chip; SWAPPED = cream outline with the swap glyph; x2 = number cell; medal = octagon outline. |
| Divider | Wall course | 2 px `#0b0609` groove, 1 px band-L lip under it, square studs 3 px wide every 32 px (`wc()`). |
| Scroll hint | Floor continues | Last visible row cut by the plate rim (half row); a stepped down key with `3 MORE`. |
| Toast (COPIED) | Brick tag dropping in | Lit brick tag drops 8 px from the top in 160 ms, no bounce, holds 1.4 s, lifts. Reduced motion: appears and disappears. |
| Section kicker | Plain label | t2, 700, caps, no tracking, no line. |
| Level course | Row of level cells | Cleared brick; current raised key; not reached well; locked wall + lock; failed = cracked brick. |
| Modal card | Rampart plate | A plate inside the world's ring; two keys of equal weight for a real choice. |

### 7.2 Menu lane (round 6 new parts, `round6/S6-menu/notes.md`; metrics `round7/S7-menu/screen.css`)

| Part | Recipe |
|---|---|
| `lane(level, {cols, rows})` | The board's start corner by `wallart` / `floorart` / `paintBrick` / `featdraw.drawSpec` per cell. MAKO stands on spawn floor cell (1,1), a foe of the room on a floor cell, the room's floor tile on floor cells. Cell size = lane width / cols; height = rows x cell. Frame `border 2px #0b0609`, desktop height 84, bg `bed`. Only true facts: the sealed spawn pocket, the roster, the floor tile (plan R5). |
| `slab(html)` | Panel of the world's floor framed in its own wall cells: 10 px (phone 8 px) frame. Padding `20px 22px` (phone 14). |
| `foeCell(t, s, world)` | A foe on a floor cell of the world it first appears in. |
| `tileCell(s)` | The world's floor tile from `drawSpec`, labelled FLOOR TILE. |
| `pts(v)` | A foe's points as block-score digits + PTS: digit key 27x36, font 25 px, gap 2. |
| `levelKeys(cur)` | 8 level keys in one course: chosen brick, rest floor, finale flag on 5 and 8; key 48x44, gap 6; phone 4x2 grid gap 10, key height 46. |
| `tip(html, {up})` | Tooltip (above). Text under an open tip is excluded from gates. |
| `mark(glyph, word)` | NEW / FINALE / BEST as the game's glyph plus a word, never a pill. |
| Ledger line, counter, difficulty pip, quiet reset key, confirm plate, PAUSE title block, RESUME with end keycap, calendar glyph | Section 7.3. |

### 7.3 Pages (round 6 S6-pages + round 7 S7-pages)

| Part | Recipe |
|---|---|
| Stat tile `counter()` | Sunk floor tile (well, 2 px outline, inner shade, no drop). Game glyph top-left, number at HUD size, name in t2 below. |
| Ledger line | Read-only. Glyph cell 28, label, a leader of floor-tile dots, right-aligned `num()`. Kicker plain t2, no line. |
| Difficulty pip | A 24 px well holding the rank; the best one is the world's brick two-tone. |
| Quiet reset key | Plain B key, legend t2, only the reset glyph coral. Danger shows at the armed step. |
| Confirm plate (reset armed) | Rampart plate over the dimmed, inert page. Coral display title with warn glyph, one body sentence, the danger key plus an equal plain key. Armed AGAIN ERASES key: band face and cream label (coral on the band is 2.95:1; unfocused it measured 1.48 against 1.5). |
| PAUSE title block `.pzh` | Centred column, gap 6, padding-top 6: kicker `LEVEL 3 · FACTORY` (label size, t2), `PAUSED` (display 34 px; 28 phone), tag row (gap 6, only non-default rules). Margin below: 30 px desktop, 34 at 125 %, 24 phone, 26 phone 125 %. |
| PAUSE rows | RESUME (yellow main key, ESC cap at its right end), SETTINGS with chevron, wall-course divider, RESTART (danger), QUIT TO MENU (danger, M cap at its end on desktop). RESUME bomb to SETTINGS gap 12. Foot hint `↑↓ MOVE · ENTER CONFIRM` (phone `TAP A ROW`) centred, margin-top 14. Veil .6. Plate width 380 touch, 340 keyboard. Plate top to RESUME top: 145 desktop (164 at 125 %), 123 phone (136). |
| PAUSE tags | At most 3 at 0.8L, 0.6L under the headline; only non-default; a non-default value names its noun (`HARD DIFFICULTY`, `FAST SPEED`); modifiers by name. |
| Tabs in a trough `trough()` | See 7.1; trough height 11 px (0.3 key). |
| Level stepper `lvStep()` | Stepped-triangle keys around a well window holding the word and level cells. |
| FIXED tag | Wall-cell plaque; the word on a dark chip. |
| Sign plaque | Bed plate, 2 px outline, hard 3 px drop (no notch). |
| Calendar glyph | DAYS PLAYED, 16-unit grid, round caps. |

### 7.4 MENU metrics (round 7, `round7/S7-menu/screen.css`, `notes.md`)

Rows in order: PLAY, LEVEL SELECT, DAILY, RECORDS, SETTINGS, GUIDE, SOURCE (GUIDE sits directly above SOURCE).

| Metric | Desktop | Desktop 125 % | Phone | Phone 125 % |
|---|---|---|---|---|
| Top margin to the block | 70 | 56 | 40 | 26 |
| Plate padding | `30px 26px 26px` | `22px 24px 20px` | `12px 12px 14px` | |
| Logo block margin below | 28 | 18 | | |
| Block gap | 18 (stage), 26 (columns) | 14 | | |
| Door key height | 46 | 49 | 50 | 50 |
| PLAY hero height | 64 | 72 | 62 | |
| PLAY word | 38 px display | | | |
| Row pitch | 8 | | 10 (tiles) | |
| Group breaks | 24 after PLAY and before GUIDE | | | |
| Phone tile height | | | 58 | 58 |
| Phone logo padding | | | `18px 0 10px` | `10px 0 6px` |
| Door legend padding | `0 16px 0 22px` | | | |
| Left list width | 480 | | | |
| Next-run card padding | `18px 22px` | | | |

PLAY's ring stands 6 px outside the list's left and right edges (3 offset + 3 stroke). Teasers: `.sub.tz` weight 600, colour `#bcad9a`, yellow-key teaser colour `#2a1426`. Copy: DAILY `NEW · TODAY'S BOARD`, SETTINGS `CLASSIC 2D` (the look name), SOURCE `GITHUB` desktop and `v201` (the build tag) on phone. Phone tile order: PLAY bar, card, DAILY | RECORDS, SETTINGS | GUIDE, SOURCE full width.

## 8. Logo B (LIT FUSE)

Sources: `round7/art/logo-b.md` (spec), `round7/L7-logo/logo.js` (built geometry), `round7/L7-logo/notes.md` (14 deviations). `C` = cap height; the bomb parts use `D` = bomb diameter. Every hex below already exists in the repo.

### 8.1 Palette and worlds (`logo.js` `P`, `WORLDS`)

```js
P = {ol:"#0b0609", dk:"#1e1216", cream:"#fff2df", t2:"#dccbb8", white:"#ffffff", yel:"#ffd447", yelLip:"#c8981e", pale:"#fff3b0",
  cor:"#ff5d73", corLip:"#c23058", corHi:"#ffc0d0", amb:"#ffb347", cord:"#ff9d5a", cord2:"#b8582a",
  bomb:"#15181f", bombOl:"#0a0d14", lobe:"#2a3550", steel:"#8a96a4", steelHi:"#d0d8e0", steelDk:"#3d4a58",
  fillRim:"#2e4a78", spec:"#fff8ec", key:"#fff4e2", fill:"#bcd4ff"}
```

| World | Side colour | Plate bed (`bg1`) | Frame (`wall`) | Frame highlight (`wallHi`) | PIXEL side slot |
|---|---|---|---|---|---|
| JUNGLE | `#0e4a28` | `#062416` | `#d4a030` | `#ffe878` | `tile.bg0` |
| ICE | `#2e4a78` | `#0a2048` | `#2e4a78` | `#d0e8f8` | `tile.wall` |
| FACTORY | `#3d4a58` | `#0e1218` | `#8a96a4` | `#d0d8e0` | `tile.bg0` |
| WATER | `#0a3a48` | `#041820` | `#6a7a88` | `#c0d0dc` | `tile.bg0` |
| ARENA | `#4a2058` | `#140818` | `#6a6460` | `#c8b8b0` | `tile.bg0` |
| SAND | `#6a4a18` | `#241808` | `#c4a070` | `#f0e0c0` | `tile.bg0` |
| VOID | `#3a1070` | `#020108` | `#1a1428` | `#8a70b0` | `tile.brickB` |
| CROWN | `#c49020` | `#140808` | `#8a6040` | `#f0d080` | `tile.brickB` |

The logo plate uses the game's own biome slots (ICE bed `#0a2048`, side and frame `#2e4a78`: navy), NOT the glacier-cyan UI biome of section 1 (`TINT.ICE`: bed `#0f2429`, wall `#3a4d54`). See section 14, item 13. Plate bed is solid at 0.94. Faces never change by world: FUSE `#ffd447`, GRID `#ff5d73`.

### 8.2 Letters (`logo.js` `GL`; `C = 1`, y down, cap line 0, baseline 1; each entry `[x, y, corner radius]`)

Optical weights: vertical stems 0.26C, horizontal arms and bowl bars 0.23C (R bars 0.22 / 0.21C), diagonals 0.28C (see deviations 1, 2). Corners: bowl outer R 0.30C, stem outer R 0.08C, counter R 0.05C; terminals flat and horizontal; round tops and bottoms overshoot 0.015C (applied to any point with R >= .2 on y 0 or y 1). Radii are clamped to half the adjoining edge.

```js
GL = {
  F: {w: 0.58, sh: [[[[0, 0, .08], [.58, 0, .02], [.58, .23, .02], [.26, .23, .05], [.26, .345, .05], [.40, .345, .02], [.40, .575, .02], [.26, .575, .05], [.26, 1, .02], [0, 1, .08]]]], bot: [[0, .26]]},
  U: {w: 0.70, sh: [[[[0, 0, .02], [.25, 0, .02], [.25, .77, .05], [.45, .77, .05], [.45, 0, .02], [.70, 0, .02], [.70, 1, .30], [0, 1, .30]]]], bot: [[.12, .58]], top: [[.02, .23], [.47, .68]]},
  S: {w: 0.66, sh: [[[[.02, 0, .30], [.64, 0, .22], [.64, .30, .02], [.38, .30, .02], [.38, .22, .05], [.28, .22, .05], [.28, .40, .05], [.66, .40, .30], [.66, 1, .30], [0, 1, .22], [0, .70, .02], [.26, .70, .02], [.26, .78, .05], [.40, .78, .05], [.40, .60, .05], [.02, .60, .30]]]], bot: [[.10, .54]]},
  E: {w: 0.60, sh: [[[[0, 0, .08], [.60, 0, .02], [.60, .23, .02], [.26, .23, .05], [.26, .395, .05], [.50, .395, .02], [.50, .605, .02], [.26, .605, .05], [.26, .77, .05], [.60, .77, .02], [.60, 1, .02], [0, 1, .08]]]], bot: [[.04, .56]], top: [[.04, .56]]},
  G: {w: 0.72, sh: [[[[0, 0, .30], [.72, 0, .22], [.72, .30, .02], [.46, .30, .02], [.46, .23, .05], [.26, .23, .05], [.26, .77, .05], [.46, .77, .05], [.46, .70, .02], [.40, .70, .02], [.40, .50, .02], [.72, .50, .04], [.72, 1, .30], [0, 1, .30]]]], bot: [[.12, .60]], top: [[.14, .66]]},
  /* R: bowl to 0.55 (bars 0.22 / 0.21 so the counter stays 0.13 tall), leg 0.28 at 18 deg; the leg's top-left corner
     is pulled 0.04 off the stem, the ink trap where bowl meets stem */
  R: {w: 0.68, sh: [[[[0, 0, .08], [.68, 0, .30], [.68, .55, .30], [.26, .55, .02], [.26, 1, .02], [0, 1, .08]], [[.26, .22, .05], [.42, .22, .05], [.42, .34, .05], [.26, .34, .05]]], [[[.30, .50, .02], [.5175, .50, .02], [.68, 1, .02], [.40, 1, .02], [.268, .59, .02]]]], bot: [[0, .26], [.40, .68]], top: [[.04, .50]]},
  I: {w: 0.28, sh: [[[[0, 0, .06], [.28, 0, .06], [.28, 1, .06], [0, 1, .06]]]], bot: [[0, .28]], top: [[.02, .26]]},
  D: {w: 0.70, sh: [[[[0, 0, .08], [.70, 0, .38], [.70, 1, .38], [0, 1, .08]], [[.26, .23, .05], [.46, .23, .12], [.46, .77, .12], [.26, .77, .05]]]], bot: [[.04, .50]], top: [[.04, .46]]},
};
GL.F.top = [[.04, .56]];
```

`bot` and `top` are lists of `[x0, x1]` runs in C units across the glyph (read from the values: F `bot [[0,.26]]` is the stem foot, U `top [[.02,.23],[.47,.68]]` the two stem tops); the world motifs (rivets, studs, drips, icicles, snow caps, drifts) are placed along these flat runs. Each `sh` is a list of shapes; each shape is a list of rings (the first is the outer contour, later rings are counters, filled even-odd); R has a second shape (the leg). Ring path: start at the midpoint of the last-to-first edge, `arcTo` through each point with its clamped radius. Widths and construction notes: F 0.58C (middle arm 0.40C long, centred 0.46C from the top); U 0.70C (counter 0.20C); S 0.66C (top bowl 0.04C narrower than the bottom, top terminal cut flat at 0.30C, bottom at 0.70C, apertures >= 0.10C); E 0.60C (arms 0.60 / 0.50 / 0.60, middle arm 0.21C thick, counters 0.165C each); G 0.72C (top terminal flat at 0.30C; spur bar 0.20C thick from x 0.40C to the right edge at 0.50-0.70C from the top; aperture >= 0.12C; no foot spur); R 0.68C (bowl to 0.55C, 0.04C ink trap, leg 0.28C wide, straight, 18 degrees from vertical, flat foot); I 0.28C; D 0.70C (square stem side, bowl right side R 0.38C, counter 0.20C).

Gaps face to face: F-U 0.07C, U-S 0.09C, S-E 0.09C, G-R 0.10C, R-I 0.09C (at the R's foot), I-D 0.11C. FUSE is 2.79C wide, GRID 2.68C (spec says 2.69C).

```js
const GAP = {FU: .07, US: .09, SE: .09, GR: .10, RI: .09, ID: .11};   // wordW = sum of widths + gaps
```

### 8.3 Layout (C units; the fixed envelope)

```js
BD = 0.72  // bomb diameter in the logo
// one-line ("line"): FUSE at x 0, y 0; xe = end of FUSE; bomb centre x = xe + .10 + BD/2, y = 1 - BD/2; GRID starts at xe + .90
//   cord (origin = baseline point under the bomb centre, y up): [.31,.73] [.39,.82] [.40,1.03] [.54,1.18]
//   face box 6.37 x 1
// stacked ("stack"): GRID at x 0, y 1.30; bomb centre x = end of GRID + .10 + BD/2, y = 2.30 - BD/2
//   cord: [.31,.73] [.45,.95] [.22,1.55] [.42,2.46]
//   FUSE y 0, indent solved so that at FUSE's midline (y .5 on the cord) the E face sits 0.10C from the cord outline
//     (cord outline = half cord width + .035; half width = (.11 - .02 t)/2); built value indent 0.504C, gap 0.100C
//   face box 3.74 x 2.30
// envelope (every world, every look, never sized from what a world draws):
//   env = { l: -.20, t: -.40, w: face.w + .40, h: face.h + .76 }    // 0.40C above, 0.36C below, 0.20C each side
```

Envelope contents: above the cap line the spark is +0.37C, the CROWN coronet with outline +0.28C, ICE snow +0.05C; below the baseline extrusion and outline 0.24C, ICE icicles 0.21C, VOID rings 0.10 to 0.24C. Sizes: one-line 6.78C x 1.76C with the envelope (MENU cap 36 = 244 px wide; desktop title cap 88 = 597 px); stacked 4.14C x 3.06C with the envelope (phone title width <= 330 px so cap <= 79 px; desktop stacked hero cap 96-120). Cord start: from the bomb collar tip; the first 6 segments join the collar to P0, then 90 samples of the cubic.

Cap tiers (`tierOf`): `ver mono|ink` or cap < 20 mono (one colour); `ver menu` or cap 32-39 menu; cap < 32 small; 40-63 token; >= 64 title.

| Cap | Change |
|---|---|
| >= 64 | Everything. |
| 40-63 | Light band drops; shade band >= 2 px. Braid every 0.16C. Motif = world token. |
| 32-39 (MENU) | Cream faces `#fff2df`, shade band `#dccbb8`, light band `#ffffff`. Token motif. Solid cord plus key-light line. 4-ray spark. |
| < 32 (the 40 px-tall logo) | No motif, no bevel. Side colour >= 2 px. Outline >= 2 px, cord >= 3 px, spark >= 8 px across. Bomb uses its <= 24 recipe. |
| < 20 | One colour. |

### 8.4 Layer stack (CLASSIC, bottom to top)

1. Outer outline: face plus extrusion grown 0.10C, `#0b0609`, slab-closed (any ink gap < 0.16C between two outlines is filled: a morphological close of 0.08C radius, run on a padded canvas).
2. Extrusion: the face swept 0.14C straight down in the world side colour (`#1e1216` when no world).
3. Face: flat. FUSE `#ffd447`, GRID `#ff5d73`.
4. One bevel clipped to the face: shade band = face minus face shifted (-0.04C, -0.06C) in the lip colour (FUSE `#c8981e`, GRID `#c23058`); light band = face minus face shifted (+0.025C, +0.035C) in the highlight colour (FUSE `#fff3b0`, GRID `#ffc0d0`). Key light from the upper left.
5. World motif (8.8).
6. Cord, bomb, spark on top. The cord passes in front of the G's top-left corner. GRID draws over FUSE's extrusion.

Stacked: GRID at x 0; the bomb on GRID's baseline 0.10C right of the D; FUSE above with a 0.30C line gap face to face, indented 0.50C; the stacked cord tip is 0.18C above FUSE's cap line, right of the E.

### 8.5 Cord and spark

Cord: width 0.11C at the root tapering to 0.09C at the tip (min 3 px), fill `#ff9d5a`, outline `max(0.035C, 1.2 px)` (2 px at the small tier) `#0b0609`. Two-ply braid: ticks 0.025C wide (min 1 px) `#b8582a`, 0.2C long, at 35 degrees to the axis, every 0.10C (title) or 0.16C (token), none at menu/small. Key-light line 0.015C `#fff3b0` along the upper-left edge (not at the small tier), inset `half width - max(.022, 1.4 px)`. Burnt end: the last 0.07C is `#b8582a` at 1.3x width, then a 0.03C `#1e1216` char ring (min 1.5 px) across the tip.

Spark (centred 0.04C past the tip at the title tier, 0 at token and MENU, -0.04C at the 40 px build; deviation 7):

| Part | Spec |
|---|---|
| Core | disc r 0.065C `#fff3b0` with a 0.025C `#0b0609` ring |
| Frame A | 4 tapered rays in a + rotated 15 degrees, 0.17C from the centre, 0.05C wide at the root, `#ffd447`; embers 0.03C squares `#ffb347` at (+0.18, +0.08) and (-0.10, +0.16) |
| Frame B | 4 rays in a x rotated 45 degrees, 0.13C from the centre, `#ff5d73`; embers at (+0.12, +0.18) and (+0.20, -0.04) |
| Rate | A and B alternate at 14 Hz (`floor(t * 14) & 1`); embers flip with the frame and never travel |
| Intro | on the first press the spark runs UP the cord from the collar to the tip in 300 ms, then flickers; never down |
| Reduced (REDUCE FLASH or prefers-reduced-motion) | core `#ffb347`, frame A rays in `#ffb347`, no embers, nothing moves |
| Ink | ray outline `max(0.02C, 1 px)` `#0b0609` |

### 8.6 The hero bomb (logo only; `drawBombBody` and the PIXEL bomb cells in the game do not change)

Origin at the bomb centre, y down, units of `D`. Body: ellipse rx 0.50, ry 0.48, centre (0, +0.02), fill `#15181f`, outline 0.05D `#0a0d14`. Lit lobe: circle r 0.36 at (-0.10, -0.12) clipped to the body, `#2a3550`, hard edge. Key rim: 0.035D arc just inside the outline from 8 to 11 o'clock, `#8a96a4`. Fill rim: 0.05D crescent inside the outline from 3 to 6 o'clock, `#2e4a78`. Highlight: hard ellipse 0.20 x 0.12 rotated -35 degrees at (-0.20, -0.24), `#ffffff` at alpha 0.45; pin dot r 0.035 at (-0.27, -0.30), `#fff8ec`. Cross: horizontal arm +-0.14 at y +0.04 bowed down 0.02 at the middle; vertical arm -0.10 to +0.18; stroke 0.08D `#ffffff` round caps; shadow line 0.02D `#0a0d14` offset (+0.015, +0.02). Collar at 1:30 o'clock, axis 40 degrees right of vertical, centre at 0.52D along the axis: rounded rect 0.24D across x 0.14D along, buried 0.04D; face `#8a96a4`; outer end cap ellipse 0.24 x 0.08 `#d0d8e0`; outline 0.03D `#0a0d14`; mid band line 0.02D `#3d4a58`; one rivet per side 0.035D `#d0d8e0` with a 0.01D ink edge (these are the only rivets outside FACTORY). In the logo the bomb takes the letters' 0.14C extrusion and outline; standalone it gets a contact shadow, ellipse 0.40 x 0.09 at (0, +0.49), `#000000` at alpha 0.35, hard edge.

| Diameter | Recipe |
|---|---|
| >= 64 px (hero) | Everything above. |
| 40 px | No rivets, no collar band line. One highlight oval plus the pin. Key rim and fill rim 2 px each. Collar in two tones. Cross 4 px. Outline 2 px. |
| <= 24 px | Body, outline 2 px, cross 3 px, one highlight oval, collar one `#8a96a4` block. No rims. Shadow or extrusion kept. |

PIXEL bomb cells use `bomb.js` `pal` letters (`o` stroke, `k` bomb, `r` pow.line.outline, `q` pow.shield.outline, `h` pow.line.shadow, `w` spec). New cells `logo_bomb18` (title) and `logo_bomb11` (MENU):

```
logo_bomb18 (18x18)                logo_bomb11 (11x11)
..................                 .......ooo.
...........oooo...                 ...oooooro.
......oooooorqo...                 .oorrkkooo.
....oorrrkkoooo...                 .orhwkkko..
...orrkkkkkkkko...                 orhkkwkkko.
..orhwwkkkkkkkko..                 orkkkwkkqo.
..orhwhkkkkkkkko..                 okkwwwwwqo.
.orhhhkkkwkkkkkko.                 okkkkwkkqo.
.orhkkkkkwkkkkkqo.                 .okkkwqqo..
.orkkkkkkwkkkkkqo.                 .ookqqqoo..
.okkkkwwwwwwwkkqo.                 ...oooo....
.okkkkkkkwkkkkkqo.
.okkkkkkkwkkkkkqo.
..okkkkkkwkkkkqo..
..okkkkkkkkkkqqo..
...okkkkkkkqqqo...
....ookkqqqqoo....
......oooooo......
```

### 8.7 PIXEL build

1 art px = 2 logical px; the logo is its own canvas, integer-scaled with NEAREST. Two builds: Title (cap 24 art px, x3, desktop one-line cap 72 / phone stacked) and MENU (cap 12 art px, x3 = cap 36; x2 = the 40 px-tall build). Stroke 3 art px at cap 12 (6 at 24); horizontals 3 at 12 (5 at 24); letter gap 2 px at 12 (3 at 24); outline 1 art px; extrusion 2 px at 12, 3 at 24, straight down. Bevel at 24: 1 px `.light` top and left, 1 px `.shadow` bottom and right plus 1 px of a 50 % checker of `.shadow` and base; at 12: 1 px `.light` on top and 1 px `.shadow` on the bottom, no dither. Envelope in art px: top `max(ceil(.40 A), 7)`, bottom `ceil(.36 A)`, sides `ceil(.20 A)`.

| Role | Slot |
|---|---|
| FUSE face | `spark` (`#ffd447`) |
| GRID face | `sparkB` (`#ff5d73`) |
| Bevels | their `.light` / `.shadow` steps (`pxRamp`, OKLCH-derived, deliberately not the CLASSIC lip hexes) |
| Outline | `stroke` |
| Highlight, spark core | `blast1` |
| Menu cream | `eye` (`#f2e6d2`) |
| Cord | `fuse`; braid `fuse.shadow`, alternating every 2 px along a 2 px stair |
| Sides | `tile.bg0` (JUNGLE, FACTORY, WATER, ARENA, SAND), `tile.wall` (ICE), `tile.brickB` (VOID, CROWN) |
| Motifs | `tile.<field>`, the same fields as the CLASSIC hexes |

Spark 5x5 (`s` = `spark`, `S` = `sparkB`), frames swap at `PX_T.SPARK_HZ` 14 (read from `pixel/timing.js`):

```
A: ..s..   B: S...S
   ..s..      .s.s.
   ssSss      ..s..
   ..s..      .s.s.
   ..s..      S...S
```

12-cap glyphs (`#` = face; built grids from `logo.js` `G12`; the 24-cap glyphs are the vector `GL` glyphs sampled at pixel centres at 24 px cap, `alpha > 127`):

```
F(7)     U(8)       S(8)       E(7)     G(9)         R(8)       I(3)  D(8)
.######  ###..###   ..#####.   .######  ..######.    #######.   ###   ######..
#######  ###..###   .#######   #######  .########    ########   ###   #######.
#######  ###..###   ###...##   #######  ###....##    ########   ###   ########
###....  ###..###   ###.....   ###....  ###......    ###..###   ###   ###..###
###....  ###..###   #######.   ###....  ###......    ###..###   ###   ###..###
#####..  ###..###   .#######   ######.  ###..####    ########   ###   ###..###
#####..  ###..###   ..######   ######.  ###..####    ######..   ###   ###..###
###....  ###..###   .....###   ###....  ###...###    ###.###.   ###   ###..###
###....  ###..###   ##...###   ###....  ###...###    ###.###.   ###   ###..###
###....  ########   ########   #######  #########    ###..###   ###   ########
###....  .######.   #######.   #######  .#######.    ###..###   ###   #######.
###....  ..####..   .#####..   .######  ..#####..    ###..###   ###   ######..
```

PIXEL motifs at the 24 cap: JUNGLE vine 1 px, leaves 3x2 px; ICE snow lumps 2 px, icicles 2x4 px; FACTORY rivets 1 px; WATER drips 2x3 px; ARENA studs as a 2x2 checker; SAND grain 1 px at 4 %, drifts 3 px tall; VOID rings 1 px + 1 px; CROWN coronet 7x4 px. At the 12 cap: tokens only.

### 8.8 Worlds: side, motif, token (CLASSIC; title cap >= 64 and token cap 32-63)

| World | Motif (title) | Token |
|---|---|---|
| JUNGLE | One vine wraps the F stem 1.5 turns (stem 0.06C `#14a018`), then runs along the slab under FUSE to a curl under the U. Leaves are teardrops 0.16 x 0.08C `#42f024` with a 0.015C `#14a018` vein: 2 on the F, 1 under the U. A 0.30C tendril with 1 leaf hangs from the D's top-right. 4 leaves in all, none pointing at the cord. | One leaf on the F's top-left. |
| ICE | Frost rim: the bevel's light band becomes `#f4fcff`. Snow caps on the top edges of F, E, G, R, D and the tops of U and I: 0.07-0.11C thick, 3 lumps per 0.5C, `#f4fcff`, 0.02C `#b0dcf0` underside line, rising at most +0.05C. Icicles under E, G and D: 0.06C at the root, 0.16 / 0.12 / 0.18C long, `#d0e8f8`, 0.015C `#ffffff` left edge. | Snow caps on F and G. |
| FACTORY | Rivets centred in the side band: 0.045C `#d0d8e0` with a 0.015C ink edge, one near each end of a bottom run longer than 0.30C, at most 2 per letter. Plate frame has a bolt in each corner. No face material. | 2 rivets, under the U and the D. |
| WATER | Wet sheen: one gloss streak per letter, 0.05 x 0.35C at 45 degrees on the upper-left third, `#ffffff` at alpha 0.35, hard edge, clipped to the face. Drips under U, E, R and D: 0.03C neck into a 0.07C drop, 0.10-0.18C long, `#3ad0c8` with a 0.02C `#b8fff4` pin. Bubbles: 2 rings (0.05 and 0.035C, 0.015C `#b8fff4` stroke) at the bomb's left shoulder. | 2 drips, under the U and the D. |
| ARENA | Pyramid studs in the side band, one per letter under its widest bottom run: diamonds with the two upper-left facets `#c8b8b0` and the two lower-right `#6a6460`, 0.02C ink. Studs also mark the plate frame's top and bottom centres. | Studs under the F and the D. |
| SAND | Grain: 0.014C squares in the face's own lip colour, 5 % density on the top 60 % of the face and 10 % on the bottom 40 %, fixed pattern seeded by letter index, kept 0.03C from the edges. Drifts: mounds banked against the left feet of U, E and R, 0.10C tall, 0.30C long, steeper on the letter side, `#e8b040`, 0.02C `#fbf1a0` crest, ink edge. | Grain only. |
| VOID | Stepped rim (R4): two rings outside the outer outline, 0.05C `#6a20c8` then 0.05C `#3a1070`, flat, no blur, no alpha (built 0.04C + 0.04C, deviation 10). Nothing else. | The inner ring only. |
| CROWN | Gilt side: a 0.02C `#fff0a8` catch line along the side's bottom edge, plus a required 0.03C ink line between face and side. Coronet on the I (owner's call, kept): 0.30C wide, 0.16C tall, 0.05C band and 3 points tipped with 0.04C dots, `#c49020` with `#fff0a8` tips, ink edge, sitting 0.02C above the I. No CROWN motif may use `#ffd447`; use `#c49020` / `#fff0a8`. | Gilt side; the coronet down to cap 40. |

Motif rules: L2 a motif covers at most 12 % of any letter's face, never enters a counter, stays at least 0.05C from the cord, bomb and spark. L3 every motif part carries an ink edge where it meets a face (0.025C CLASSIC, 1 art px PIXEL). L4 the 40 px-tall build shows no motif and must still read FUSE GRID. L1 every letter face >= 3:1 against its plate bed, measured on rendered pixels (p5 to p95, worst case).

### 8.9 REAL 3D build

Letters are `ExtrudeGeometry` from the same glyph paths: depth 0.36C, bevel 0.05C, 2 segments. One fixed orthographic view, face tilted back 22 degrees; the south-facing sides show 0.135C below each face (CLASSIC's 0.14C drop); faces foreshorten by 0.93 about the baseline. Light: the game's frozen recipe, no per-world light, no tone mapping (key `#fff4e2` 1.26 upper left; fill `#bcd4ff` 0.54 lower right, behind; hemi 0.72; ambient 0.30).

| Surface | Colour |
|---|---|
| Front face | the face hex |
| Upper-left bevel facets | the highlight hex |
| Lower-right bevel facets | the face hex x 0.70 |
| Visible bottom sides | built: a 70 / 30 mix of the lip hex and the world side colour, darkening to x 0.72 at depth (spec: the lip hex, darkening to face x 0.80); CROWN's side is Phong shininess 60, specular `#fff0a8`, one hotspot |

Inverted-hull outline 0.06C `#0b0609` (built). Shadow: soft cast shadow on the plate offset (+0.08C, +0.12C), sigma 0.02C (a visible edge about 0.04-0.05C), `#000` alpha 0.45; contact AO 0.05C under the baseline. Bomb: Phong sphere squat 0.96, `#15181f`, shininess 40, diffuse about `#2a3550` upper left to `#0a0d14` lower right; key specular 0.16 x 0.10D at (-0.22, -0.26)D `#fff4e2`; fill rim 0.04D `#bcd4ff` alpha 0.35 lower right; cross raised 0.01D; collar a cylinder `#8a96a4` with `#d0d8e0` cap. Cord: a tube r 0.055C along the same curve, Lambert `#ff9d5a`, two-ply helix stripe `#b8582a`, lighter toward `#ffb347` on the key side. Spark: unlit, core plus camera-facing ray quads, no bloom, no halo. Motifs become geometry (vine tube and leaf planes; snow as a rounded extrude and icicle cones; rivets as hemispheres; glossy Phong drops; stud pyramids; drift mounds and a 2-tone grain texture; VOID rings as a back plate extruded 0.02C behind; CROWN gilt sides and an extruded coronet). Budget: about 9 draws, INTRO and MENU only, never in GAME; `three/wrapper.js` never imports `logo/`.

### 8.10 The 14 builder deviations (`L7-logo/notes.md`; built values are binding)

1. R bowl bars are 0.22 / 0.21C, not 0.23C (a 0.23C bar leaves a 0.09C counter; it is 0.13C).
2. The S spine is a 0.20C horizontal bar, not a 0.28C diagonal (flat terminals at 0.30 and 0.70 with 0.22 arms leave 0.20C).
3. The R ink trap is the leg's top-left corner pulled 0.04C off the stem; the outline fills the notch. No separate cut.
4. JUNGLE vine: CLASSIC / 3D stem 0.036C (spec 0.06), ink edge 0.015C, two front passes across the F stem (back passes hidden): 0.06C with three passes covered 28 % of the F, with two 14 %, now <= 12 %. PIXEL: one front pass; the vine climbs the F's outline column.
5. ICE snow caps sit 0.045-0.065C into the face (0.035-0.05C at token tier), not 0.07-0.11C (deeper caps measured 14 % of a letter). PIXEL snow sits on the 1 px outline, 2 rows plus lumps, rising 3-4 art px (about 0.15C), inside the 0.40C envelope.
6. Sizes need a stated unit: ARENA studs 0.12C across (spec 0.08C was unreadable at cap 64); FACTORY rivets 0.045C radius; WATER bubbles 0.05 / 0.035C radii.
7. Spark offset 0.04C past the tip at title tier, 0 at token / MENU, -0.04C at the 40 px build; the cord tip is 0.18C above the cap line, not 0.20C (cord points P2 y 1.03, P3 y 1.18 for the line build), so the spark and its ink stay inside the 0.40C envelope.
8. PIXEL envelope top is 7 art px at cap 12, not 5 (the 5x5 spark needs it). The spec's "1 art px = 2 logical px" conflicts with its own table (x3 at caps 72 and 36); the table was followed: x3, and x2 for the 40 px build.
9. REAL 3D side colour is a 70 / 30 mix of the lip hex and the world side colour, x 0.72 at depth; the 0.06C inverted-hull outline is drawn.
10. VOID rings are 0.04C + 0.04C (0.05 + 0.05 lands on the 0.20C side envelope and touches the canvas edge). In VOID the slab is closed at 0.16C before the rings and closed pockets are inked. Closings run on a padded canvas.
11. Soft shadow sigma 0.02C so its tail stays inside the 0.36C below the baseline.
12. The anatomy frame is at cap 150, not 160 (mock layout only).
13. The title-px and title-3d frames use the CLASSIC board (mock only).
14. Rendered faces are measured against the bed (spec estimate vs solid `bg1`: FUSE 11-15, GRID 5.4 on ICE to 7.0 on VOID).

Fallbacks (spec's own): R1 CLASSIC logo over 3D; R2 hard 0.14C drop in 3D; R3 rivets on the FACTORY plate frame only; R4 drop the inner ring; R6 both words left-aligned with the cord in an empty notch; CROWN coronet removable by deleting its branch.

Measured in the mock (regression reference): face vs bed worst 5.38 (ICE GRID) in all three looks; by world JUNGLE 5.52, ICE 5.38, FACTORY 6.32, WATER 6.11, ARENA 6.56, SAND 5.84, VOID 6.99, CROWN 6.62; cream MENU marks 13-19; GRID shade band `#c23058` is 2.94:1 on the ICE bed (an inner bevel, disclosed, not gated); motif coverage max 12.0 % (JUNGLE F); MENU logo yellow under 0.5 % (CLASSIC 0.01-0.02 %, PIXEL 0.37 %); 40 px build outline 2.27 px, cord 3 px, spark 8 px, bomb 16.4 px (PIXEL x2: 2, 4, 10, 22).

## 9. Controller drawing

Sources: `round7/C7-controls/screen.js` (`PADG`, `HALF`, `BUMP`, `padArt`), `round7/C7-controls/notes.md`, `round6/art/controller.md` (rules that still hold). All sizes are fractions of the body width `W`; the picture is one SVG; callouts are text labels beside it.

### 9.1 Body and part positions (round 7 built)

```js
PADG = { LS: [0.215, 0.245, 0.078], DPAD: [0.36, 0.39, 0.088], RS: [0.64, 0.39, 0.078],   // [cx, cy, well radius]
         fc: [0.785, 0.245], off: 0.088, br: 0.052,                                       // face diamond centre, button offset from centre, button radius
         SEL: [0.44, 0.245], STA: [0.56, 0.245] }
// face buttons: N (fx, fy-off) E (fx+off, fy) S (fx, fy+off) W (fx-off, fy); fx, fy = fc; button face radius br*W, well radius (br + 0.009)*W
// each face button is 0.104 W across (spec said 0.111 W; at 1/9 the wells touch)
// right half of the outline, top centre to bottom centre, cubic segments [c1, c2, end]; the left half is the mirror x -> 1 - x
HALF = [[0.5, 0.03],
  [[0.63, 0.03], [0.73, 0.04], [0.82, 0.065]],
  [[0.905, 0.09], [0.955, 0.14], [0.972, 0.23]],
  [[0.988, 0.32], [1.0, 0.42], [0.995, 0.5]],
  [[0.99, 0.6], [0.94, 0.648], [0.875, 0.645]],
  [[0.82, 0.642], [0.79, 0.6], [0.765, 0.555]],
  [[0.74, 0.51], [0.7, 0.49], [0.64, 0.488]],
  [[0.58, 0.487], [0.54, 0.49], [0.5, 0.49]]]
// path: M HALF[0]; for i = 1..7: C HALF[i][0] HALF[i][1] HALF[i][2]; then back along the mirror:
//       for i = 7..1: C M(HALF[i][1]) M(HALF[i][0]) M(prev) with prev = HALF[0] if i == 1 else HALF[i-1][2]; Z
// shoulder bumper centreline (right; left = mirror), points in W: [0.62,0.034] [0.7,0.036] [0.76,0.05] [0.82,0.065] [0.905,0.09] [0.952,0.135] [0.966,0.19]
//   path: M p0 C p1 p2 p3 C p4 p5 p6, stroke width 0.072 W (+3.5 px outline) round caps, highlight line translate(0, -0.022 W) white .16 alpha 2 px
// triggers: rounded rect 0.2 W x 0.1 W, rx 0.035 W, at centre x 0.24 (left, rotate -9) / 0.76 (right, rotate +9), y from -0.03 W, rotation about (cx, 0.02 W), outline 2 px
// body height including grips about 0.648 W; ratio 1 : 0.648 (about 1.54 : 1)
```

Body rendering order: shadow (body path, translate(0, 0.03 W), black .5, gaussian blur sigma 0.016 W; the mock uses SVG blur, the game kit may not, see plan "no filters": use a hard offset fill), underside fill (gradient `gu`), body shifted up by lip `0.026 W` over the underside with gradient `gb`, grip shading (two ellipses at (0.14 W, 0.62 W) and (0.86 W, 0.62 W), rx 0.16 W, ry 0.12 W, black radial .34 to 0), top highlight gradient, outline 2.5 px `#0b0609` round joins. Parts order: triggers, bumpers, body, L stick, d-pad, R stick, face N E S W, SELECT, START pills, then the focus ring.

Gradients (token names are the world tokens of section 1):

| Id | Direction | Stops |
|---|---|---|
| `gb` body top face | top to bottom | 0: `bodyTop` 74 % over white; .3: 88 % over white; .62: `bodyTop`; 1: `bodyTop` 62 % over black. `bodyTop` = `band` (no controller: `rule`) |
| `gu` underside / trigger well | top to bottom | `key` 70 % over black to `key` 40 % over black |
| `gg` grip shade | radial (.5, 1) r .9 | black alpha .34 to 0 |
| `hl` top highlight | top to bottom | white .34 at 0, 0 at .18 |
| `bo` face button unbound | radial (.38, .3) r .8 | `key` 62 % over white; .55 `key`; 1 `key` 45 % over black |
| `bl` face button bound | radial (.38, .3) r .8 | `lit` 55 % over white; .5 `lit`; 1 `lit2` |
| `wl` well | radial (.5, .42) r .6 | `key` 40 % over black to `#050304` |
| `rm` well rim lit from below | top to bottom | black .55 at 0, white 0 at .55, white .3 at 1 |
| `co` stick cap rim unbound | top to bottom | `key` 55 % over white to `key` 55 % over black |
| `cl` stick cap rim bound | top to bottom | `lit` 60 % over white to `lit2` |
| `do` stick dish unbound | top to bottom | `key` 45 % over black to `key` 80 % over white |
| `dl` stick dish bound | top to bottom | `lit2` to `lit` 70 % over white |
| `pl` pill unbound | top to bottom | `key` 70 % over white to `key` 60 % over black |

Face button: well (circle radius `br*W + 0.009 W`, fill `wl`, stroke `#0b0609` 1.5, inner rim circle radius -1.5 stroke `rm` 2), drop circle at y + 2 black .55, button circle radius `br*W` stroke 1.6, specular ellipse at (-0.22 r, -0.36 r) rx 0.45 r ry 0.26 r white .22. Stick: well radius `PADG[id][2]*W`, cap radius 0.056 W (drop at y + 3 black .6), dashed grip ring radius `(0.056+0.039)/2 W` stroke black .28 `0.01 W` dash `1.6 2.4`, dish radius 0.039 W. Pills: 0.05 W x 0.026 W, well pad 2.5 px, radius half height. D-pad: rounded plus arm half-length 0.07 W, arm half-width 0.024 W, corner 0.008 W, in a round recess radius 0.088 W, drop y + 3, top highlight line, centre dimple radius 0.016 W. Bound inputs use the `l`-gradients (lit), unbound the `o`-gradients (quiet). No controller: the body takes the `rule` top, every input unbound, wall texture at .3 opacity over the body (pattern 0.15 W).

### 9.2 Layout, leaders, callouts

- Desktop controller width `W = min(460, floor((inner - GL - GR - 40) / 1.1))`; gutters `GL, GR` = 142, 140 (178, 176 at 125 %). Desktop page: plate width 1270 (1300 at 125 %), list column 440 (520), preview pane = plate - 40 - 20 - list, inner = pane - 36. Phone widths: live 300 (270 at 125 %), capture 180 (160), no controller 220 (200); no controller on desktop is 0.82 x the live width.
- Callout: two lines, ACTION in cream 700 at primary size, then the position name in t2 secondary (`BOMB` / `SOUTH`, `THROW` / `WEST`, `REMOTE` / `EAST`, `PAUSE` / `START` with a FIXED tag, `PAUSE` / `SELECT`, `MOVE` / `L-STICK · D-PAD`). Pitch between stacked labels `2.4 x PRI` (PRI = 21 desktop, 16 phone, times text scale).
- Leaders: plain orthogonal lines, 1.5 px t2 (`#dccbb8`) over a 3.5 px `#0b0609` underlay, round joins, 3 px dot (stroke 1.2 `#0b0609`) on the button. Right gutter x `1.04 W + 22`, knee x `1.0 W + 8` (+9 for EAST), left gutter x `-0.04 W - 12`. Right side top to bottom: START (route up past the triggers: button, up to `yTop = min(-0.13 W, yW - pitch)`, then right), WEST (up beside NORTH to `yW = 0.07 W`, then right), EAST (straight out, or a knee down one pitch when it would meet WEST), SOUTH (straight out, knee down one pitch when it would meet EAST). Left gutter: SELECT (up to `yTop`, then left), MOVE (L-STICK and D-PAD each straight left to one spine at x = left gutter, one label at the spine midpoint). Lower leaders take the inner knee so leaders never cross. At 125 %, START rises a pitch above THROW.
- Crossing gate (`window.GATE().cross`): leader segment vs leader segment; a leader within `r + 2` px of any button or stick other than its own (own for MOVE: L-STICK and D-PAD); a leader through any key other than its own. Result 0 in every frame. Obstacle radii: well radii of sticks and D-pad, `br*W + 0.009 W` for face buttons, `0.03 W` for the pills.
- Focus ring on the focused row's button (SOUTH for BOMB, WEST in capture, SPACE on the keyboard tab; none for SENSITIVITY). No cord, no spark, no bomb at the label.
- Button states: bound = world brick two-tone (lit); unbound = quiet dark cap; fixed (START, SOUTH or START confirm, EAST back) = lit with a FIXED wall tag beside its label; pressed live = the face drops 2 px and flashes `#fff3b0` at .5 for 120 ms (REDUCE FLASH: the drop only).
- Default bindings shown: BOMB SOUTH, THROW WEST, REMOTE EAST, PAUSE SELECT, START fixed. Bound in the live frame: D-PAD, L-STICK, SOUTH, WEST, EAST, SELECT, START. Unbound: NORTH, R-STICK, bumpers, triggers.
- Rebind capture: every button a well except the one being set; status `PRESS A BUTTON FOR BOMB`; no timeout, nothing counts down; on a press that button lights and a `SWAPPED` tag marks any action it took over (copy: `SOUTH WAS BOMB · BOMB NOW WEST`); cancel: START or ESC cancels, WEST keeps it.
- No controller: body in LOCKED wall tones, every button a well; centred plaque `NO CONTROLLER` and, in t2, `Connect one and press a button.` (desktop adds `A cable or Bluetooth both work. Your keyboard keeps working.`).
- Status line: `CONTROLLER 1 · STANDARD`, or `BUTTONS 0-N` for a non-standard one; the device id is never printed.
- Never: letters, shape symbols or numbers on buttons; four differently coloured face buttons; a touchpad, light bar, centre logo or home button; any maker's outline; a body in yellow or coral; a countdown during capture.

Round 6 geometry (superseded by the built round 7 drawing, kept only for the record): flat-topped bar, top edge 0.84 W, radius 0.08 W, grips 0.30 W wide reaching 1.0 H angled 8 degrees; D-PAD (0.22, 0.36), sticks (0.36, 0.64) / (0.64, 0.64), face diamond centre (0.78, 0.36) with 0.07 W buttons at 0.068 W, SELECT / START (0.43, 0.30) / (0.57, 0.30).

### 9.3 Keyboard drawing (tenkeyless)

Unit `k` (desktop `floor((inner - GL - 0.38*34 - 16) / 18.5)` with `GL` 118 (150 at 125 %), phone 17.4). Key gap `g = max(2, 0.1 k)`; a key at unit (x, y, w) is drawn at `(x k + g/2, y k + g/2)` with size `(w k - g) x (k - g)`. Deck margin `dk = 0.38 k`; deck size `(18.5 k + 2 dk) x (6.5 k + 2 dk)`, origin `(-dk, -dk)`.

| Row | y (units) | Keys, left to right (widths in units; `_` = gap) |
|---|---|---|
| F-row | 0 | ESC 1.5, `_` 0.5, F1 F2 F3 F4, `_` 0.5, F5 F6 F7 F8, `_` 0.5, F9 F10 F11 F12 |
| Numbers | 1.5 | ` 1 2 3 4 5 6 7 8 9 0 - =, BACKSPACE 2 |
| Top letters | 2.5 | TAB 1.5, Q W E R T Y U I O P [ ], \ 1.5 |
| Home | 3.5 | CAPS 1.75, A S D F G H J K L ; ', ENTER 2.25 |
| Bottom letters | 4.5 | SHIFT 2.25, Z X C V B N M , . /, SHIFT 2.75 |
| Space row | 5.5 | CTRL 1.75, ALT 2, SPACE 6.25, ALT 2, FN 1.25, CTRL 1.75 |
| Arrows (inverted T after a 0.5 gap) | | UP at (16.5, 4.5); LEFT (15.5, 5.5), DOWN (16.5, 5.5), RIGHT (17.5, 5.5), each 1 wide |

Every row spans 15 units; the whole drawing 18.5 units wide, 6.5 tall. ESC is 1.5 wide so its print fits.

Keycap anatomy: a darker skirt (the side) under a top face set back more at the front.

```css
.deck{border:2.5px solid #0b0609;border-radius:calc(k*.32);
  background:linear-gradient(color-mix(band 80% over white), band 30%, color-mix(band 70% over black));
  box-shadow:inset 0 2px 0 rgba(255,255,255,.16), inset 0 calc(k*-.18) 0 color-mix(key 60% over black), 0 calc(k*.3) calc(k*.45) rgba(0,0,0,.55)}  /* the soft shadow: use a hard offset fill in the canvas kit */
.kc{border:1.5px solid #0b0609;border-radius:calc(k*.16);background:linear-gradient(color-mix(key 70% over black), color-mix(key 35% over black));box-shadow:0 1px 0 rgba(0,0,0,.6)}
.kc .tf{left:calc(k*.08);right:calc(k*.08);top:calc(k*.04);bottom:calc(k*.18);border-radius:calc(k*.11);
  background:linear-gradient(color-mix(key 88% over white), key 30%, color-mix(key 85% over black));box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}
.kc.on{background:linear-gradient(lit2, lip)}   .kc.on .tf{background:linear-gradient(color-mix(lit 70% over white), lit 60%);box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}
.kc.rg{outline:3px solid #fff2df;outline-offset:3px}      /* the focus ring */
```

Legend print: bound keys dark ink `#1e1216`; unbound faint `#8f8476`; size `--kl` 15.8 px desktop, 12.8 phone, 700. A legend wider than its top face is left off; the F-row prints all or none; a bound key is never blanked. Phone prints only the arrow glyphs (a 1-unit key is about 10 px tall there). Backspace glyph: `M21 6H4M8 1.5L3 6l5 4.5` in a 22x12 box, stroke 2.2 round.

States: bound lit (SPACE BOMB, E THROW, Q REMOTE, P PAUSE, W A S D MOVE); fixed lit with the FIXED tag (ESC, the four arrows); everything else off. Never advertise J, X or SHIFT + BOMB; K is unbound. Callouts: ESC (BACK, FIXED) straight left; Q (REMOTE) and W (MOVE, `W A S D`) straight up through a key gap then left to the left gutter (Q's label at `yR = min(-1.2 k, yB - pitch)`, W's at `min(yR - 1.5 k, yR - pitch)`); E (THROW) and P (PAUSE) straight up to `yT = min(-1.2 k, -dk - 6 - 2.3 PRI + LH)` then right by 0.75 k; SPACE (BOMB) and the arrows (MOVE, `ARROWS`, FIXED) straight down to `6.5 k + dk + 0.25 k + 14`, label centred.

Round 6 keyboard slice (superseded): ESC at x 0, Q row from 0.5 k, A row 0.75 k, Z row 1.25 k, SPACE 6 k wide at 3 k, arrows at 11.5 k; pitch desktop 32 px, phone 22 px.

## 10. End screens

Sources: `round6/art/endscreens.md` (direction), `round6/E6-end/notes.md` (built parts), `round7/E7-end/notes.md`, `round7/E7-end/screen.css`. `L` = label cap height, `H` = headline cap height.

### 10.1 The contrast

| | WIN | GAME OVER |
|---|---|---|
| Layout | centred, symmetric, wide plate (finale desktop 840) | left-weighted, narrow plate (desktop 620), two columns |
| Headline | raised: display face, 0.12 em outline, hard drop 0.10 H, stands up | sunk: same face, no drop and no outline, inner top shadow 0.06 H `#0b0609` at .6, a slightly darker foot (built with a per-line `background-clip:text` gradient) |
| Hero | the score on the world's bricks | the burnt-out bomb |
| Backdrop veil | .45, full colour, plus a static blast cross | .72 (R18: a cool grey veil `toL(grey, .01)`, alpha about 0.65, in all three looks); no cross |
| Light | warm core `#fff3b0` at .10 behind the headline | none |
| Records | ribbons and medals | at most one quiet salvaged plaque |
| Main key | MENU (finale) / NEXT LEVEL (level clear), normal height | TRY AGAIN, full column width, `1.32 x --btnh` (66 px desktop, 64 phone) |

Kit tokens stay pinned. Yellow is the one main key on both. Coral never says "you lost". Mood comes from layout, veil, raised vs sunk, motion. Copy is plain and short; never "next time", "almost", "you'll get it", "so close". Every number is a persisted one computed at a run end (`isRunEnd`); first-ever run on a bucket scoring 0 prints no delta line; a run that began above level 1 prints no furthest-level line; medals only newly saved.

### 10.2 LEVEL CLEAR (levels 1-4, 6, 7)

Plate desktop 520 wide; phone full width minus 24. Top to bottom, 1.6 L between sections: kicker `LEVEL 3 · FACTORY` (t2); headline `LEVEL 3 CLEAR` raised, H = 2.4 L; one row of three stat cards (TIME, ENEMIES with foe glyph, POWER-UPS with item glyph), card height 3.4 L, gaps 1 L; one ribbon centred under the cards if a level time record was saved now; main key `NEXT LEVEL`. No score digits, no course.

### 10.3 FUSE/GRID CLEAR (finale: level 5 or 8)

Desktop plate 840 x up to 600, centred. Gaps 2.4 L between sections, 1 L inside.

1. Headline band, height 6 L: kicker `LEVEL 5 · ARENA · NORMAL` (t2) above `FUSE/GRID CLEAR` raised, H = 3.2 L, centred. Behind it a static blast cross: two crossed bands 1.4 H thick, `#fff3b0` at alpha .08 (built; spec .10), ends feathered over 1 H, plus a radial warm core `#fff3b0` at .10 (26 L x 9 L). Built geometry in `L`: horizontal band 54 L wide, 6.2 L tall, vertical band 6.2 L wide, 13 L tall from -8 L, centred at 50 % / 58 % of the band; compact variant 30 L x 4.6 L and 4.6 L x 8.5 L.
2. Score hero: the block-score digits on the world's bricks, digit cell 3.4 L tall, centred; under it, t2, `SCORE · NORMAL ×1` naming the multiplier that was saved.
3. Course: one row of level cells, centred. Played levels are lit bricks with a 0.3-cell check notch cut into the top-right corner (built 0.44 cell, dark `--dk`); the finale cell carries the medal octagon outline instead of the flag. No tag here.
4. Tally: three stat cards, 230 wide each on desktop: ENEMIES, POWER-UPS, TIME. Icon top-left, label, value with `num()`. Stat card: a sunk floor slab; the glyph sits in a raised wall-block socket top-left, label over value in the HUD face. Phone: label above, glyph inline with the value; phone at 125 %: a one-line ledger row.
5. Earned (the shelf): up to 3 pieces side by side, centred, 1.6 L between them. The shelf is a wall course (the world's wall texture, outlined, hard drop) 0.5 L above them; pieces hang from hook studs. Order: score record, time record, medal. More than 3: the third slot is a ribbon `+2 MORE`; never shrink the pieces. Phone: one shelf per row of pieces.
6. Keys: main `MENU` yellow, left; `COPY RESULT` and `COPY MAP` as plain B keys, right, height 0.85x (46 px on phone). Every key is label first, keycap last (`MENU … ENTER`, `COPY RESULT … C`, `COPY MAP … B`, `NEXT LEVEL … ENTER`); phone shows no keycaps.

Ribbon (record piece): body = world brick lit two-tone, 2 px `#0b0609` outline, no drop, at least 9 L wide, at least 4.2 L tall (padding `8px 16px 9px`, phone `7px 9px 8px`); line 1 `NEW BEST` in `#2a1426`, line 2 the record name (`SCORE · NORMAL`, `LEVEL 5 TIME`), line 3 the value in `num()` at 1.6 L (font size `L x 1.6 / 0.72`, 800 display). Tails: two swallowtails hanging from the body bottom, each 1.6 L wide x 1.4 L long, V notch 0.6 L deep, brickB, splayed +-10 degrees from vertical, 1.2 L apart. Hook: a 0.6 L square stud of the world's wall at the body's top centre, touching the shelf line.

Medal (record piece): octagon outline (kit medal shape), stroke 0.35 L `#ffd447` over a dark outline, inner dot `#ffd447`, diameter 4 L; hangs from two brickB straps 1.2 L that meet at the hook stud; under it the name in cream (`FLAWLESS`), tag `NEW` beside it, body copy t2 sentence case (`Levels 1 to 5 in one run, no life lost.`). In CROWN the medal ring sits on a `#1e1216` disc so it never touches a gold brick. Phone: octagon left, words right.

### 10.4 WIN motion (total 1.6 s; any key or tap jumps to the end state)

| Time (ms) | Beat |
|---|---|
| 0 | Plate in: scale 0.96 to 1.0, 160 ms ease-out |
| 120 | Headline drops 0.5 H with a 6 % overshoot, 200 ms |
| 300 | Score digits flip left to right, 60 ms apart |
| 600 | Course cells pop up one by one, 50 ms apart, each with the pickup sparkle (`fx` collect) |
| 1000 | Ribbons and medal swing in from their hook: -8 to +4 to 0 degrees, 500 ms; the existing win confetti (`#ffd447 #ff5d73 #37f0d0 #7fe0ff`), one burst, finale only |
| 1500 | MENU (finale) or NEXT LEVEL takes focus (round 7: the bomb and the 3 px ring, no fuse) |

Reduced motion / REDUCE FLASH: no confetti, no swing, no overshoot; everything at its end state with one 200 ms fade.

### 10.5 GAME OVER

Plate desktop 620: left column 200 (the hero), right column 360 (facts), 60 between. The plate sits at the board's centre.

Left column, the burnt-out bomb (`burnt(R, w, h)`): the game bomb shape at diameter 9 L (about 133 px desktop), tipped 12 degrees onto its contact point; body `#15181f` with char blotches `#07080b`, ash speckle and three soot cracks each with a cold lit edge; outline `#0a0d14`; white cross dulled with its right arm sooted over; highlight alpha .25 (spec .45 to .25). Cord: a stub 0.3 of normal length (spec 0.35), burnt to char `#3a302c` to `#1a1614`, frayed with an ash tip (spec: `#b8582a` with the last 0.08 `#15181f`); no spark, no orange. Soot ring: ellipse 1.3 x the bomb width, `#15181f` at .35, edge softened 4 px (the only soft edge on the screen), with grey ash flecks. Smoke: three fading puffs of diameter 0.8 L, 1.1 L, 1.5 L drifting up-left, t2 `#dccbb8` at alpha .18 to 0, plus two curling wisps rising straight up from the stub. No MAKO, foe, skull, tear or X eyes. The charred stub stays (round 7 note: part of the illustration, not a focus marker).

Right column, top to bottom, gaps 1.4 L: kicker `LEVEL 4 · WATER · NORMAL` (t2); headline `GAME OVER` sunk, H = 2.6 L, left-aligned, cream; `Reached level 4 of 5.` (cream 700 at 1.3 L; "of N" = the run's finale level, 5 or 8); the course with four states; Score; shortfall; salvaged plaque.

| Course state | Look |
|---|---|
| Cleared | lit world brick raised 2 px |
| The level you fell on | the same lit brick plus a crack and soot. Built: a bold dark split `#0b0609` 0.13 cell wide zigzagging top to bottom with a lit broken edge on its right, two short side fractures, a chipped top-left corner (dark triangle with a lit edge), a `#15181f` radial soot on the lower half at .35; the digit nudged right 7 px (9 px at desktop 125 %). Spec: a 3-segment zigzag 0.08 cell wide. The crack is at least 2 px wide at 40 px cells. Squint cracked vs not-reached >= 3:1 |
| Not reached | floor well sunk, number in t2 |
| Locked (levels 6-8 before the first clear) | wall cell with the lock glyph |

Score: one line, `SCORE` label t2, value `num()` at 1.6 L cream, no bricks. Shortfall (one line, body size, sentence case):

| Case | Copy |
|---|---|
| Saved best in this bucket, run below it | `120 points short of your NORMAL best (1,480).` |
| No saved best yet | no line |
| Run set a new best anyway | no shortfall line; show the plaque |

Units: saved scores are score x difficulty (NORMAL x1, HARD x2, EXPERT x3), the HUD shows the raw score. When a delta is shown the Score line shows the saved number with its multiplier (`2,720 ×2 HARD`) and the delta compares saved to saved; never a raw score beside a saved best. Salvaged plaque (only when a record was saved during a loss): a small wall-texture note (wall cell solved to L .07 through `wallTex(b, 0.07)`), 2.6 L tall, check icon plus `FURTHEST LEVEL YET` or `NEW BEST · NORMAL` on a dark inset chip; no tails, medal or brick.

Keys: main `TRY AGAIN` yellow, full right-column width, `1.32 x --btnh` high (66 px desktop; phone 64), display face, label first with the ENTER keycap at the right end, sub-line inside the key in `#2a1426` at label size: ordinary run `New board · level 1`; DAILY or code run `Same board`. It takes focus first (the bomb at the key start and the 3 px ring). Foot row of plain keys at 0.85x height: `MENU`, `COPY RESULT`, `COPY MAP`. No countdown on TRY AGAIN (there is no continue timer).

Phone (393 x 852): one column; the bomb shrinks to 5 L and sits left of the headline in one row; then Reached, the course (cells >= 30 px), Score, shortfall, plaque. `TRY AGAIN` docked at the bottom, full width minus 32, height 64; the foot keys in one row above it, each >= 44 tall with 8 px gaps. Dock: `left/right 16, bottom 24`, gap between the foot row and the key 18 (round 7 changed 12 to 18 and the foot 18 to 24 so the ring clears).

### 10.6 GAME OVER motion (total 1.4 s, downward, no overshoot; any key or tap jumps to the end state)

| Time (ms) | Beat |
|---|---|
| 0 | Backdrop veil eases .45 to .72 and darkens over 500 ms; the plate fades in over 300 ms, no scale |
| 200 | Headline settles down 0.25 H to rest, 300 ms ease-out |
| 300 | The bomb's spark gutters: on 80 ms, off 120, on 60, off 200, on 40, then out; over the same 500 ms the cord shortens to the stub and its tip turns `#15181f` |
| 800 | The failed level's crack draws in one 200 ms stroke with one dust puff of 6 particles `#c9793f` |
| 1100 | Smoke starts: each puff rises 3 L over 3.2 s and fades; a new puff every 1.1 s (loop >= 2.4 s) |
| 1400 | TRY AGAIN takes focus (round 7: the ring appears; the key's fuse of round 6 is gone). The yellow key stays the only warm thing |

Reduced motion / REDUCE FLASH: no guttering, the bomb drawn already burnt out, one static smoke puff at .12, the crack drawn, one 200 ms fade. Never on GAME OVER: confetti, rays, cross, sparkle, flip digits on bricks, ribbons, a raised headline, a coral headline, a red wash, a centred symmetric stack, a sad mascot, "so close" or "next time" copy.

## 11. Readability gates (binding for every screen)

Source: design record section 7, `round7/K7-kit/kit5.js` `audit()`, `round7/K7-kit/measure.mjs`, `round7/*/measure.mjs`. Label: **Node** = token math or the text recorder in `npm test`; **Chrome** = `tools/ui/gates.mjs` on captures.

| Gate | Floor | Method | Where |
|---|---|---|---|
| Chosen vs unchosen (rocker ON/OFF, bank, modifier key, meter head vs empty, tab, level cell) | >= 3:1 | greyscale at half size: box filter 4 px at 2x capture then x0.5, Rec.709 Y, mean over the part's marked rect; contrast `(max + .05) / (min + .05)` | Chrome; Node twin on token luminance |
| Keycap vs chosen | >= 3:1 | as above | Chrome |
| Focus band vs rest | >= 1.5:1 | the focused key's zone (key + ring) vs an unfocused part's same zone | Chrome; Node on `band` vs `bed` |
| Focus ring vs plate | >= 3:1 | `crmax = (ring max L + .05) / (surround mean + .05)`; also ring vs the body under it >= 3 on the controller drawing | Chrome; Node: ring `#fff2df` vs plate |
| Locked texture | sd >= 2x a floor cell; locked mean vs chosen >= 3:1 | as above | Chrome |
| Same lightness across worlds | spread of the world means <= 1.15 | max/min of means per state over JUNGLE, ICE, CROWN (and the 8 worlds in Node) | Node (`LUM` tolerance, section 14 item 1) |
| Text floors by measured cap height | desktop primary >= 14, secondary >= 11, HUD >= 18, body font size >= 17.9; phone primary >= 11, secondary >= 9, HUD >= 11, body >= 14.1 | cap = font px x cap ratio of that font (measure `H` ascent); body uses font px; at 125 % the same floors with scaled px | Node (recorder fonts) + Chrome |
| Secondary text classes | `.sub .tg .cap .foot .sub .pm .lkc .sep` | | |
| No monospace for words; tracking 0 | letter-spacing <= 0.021 em | | Node |
| Information contrast | >= 4.5:1; locked legends and separators >= 3:1 | each glyph band (the text's own line box trimmed to its middle 60 %) vs the brightest (light text) or darkest (dark text) pixel under it with all text hidden: light text `(Lt + .05) / (max bg + .05)`, dark text `(min bg + .05) / (Lt + .05)` | Chrome |
| Touch targets (phone) | >= 44 x 44 (43.95 tolerance) | | Node geometry + Chrome |
| Touch gap | >= 8 px between targets of one set (same-kind list / tab / bank / step members exempt) | | Node + Chrome |
| Yellow fills | at most 1 per screen / world group | count `.k.main` | Node + Chrome |
| Overflow | label meets value, value past row, legend wider than key, text past plate, text past viewport, plate ring past viewport: all 0 | | Node (recorder) + Chrome |
| 125 % text | no overflow; a bank reflows (wraps), never shrinks type; card buttons stack | scale every kit font px by 1.25 | Node (`textScale` 1.25) + Chrome |
| Every longest string drawn whole | no `…` at text scale 1 and 1.25 | exact string present in the recorded `fillText` calls and inside its slot | Node |
| Leaders | 0 crossings; 0 rendered cord or spark | section 9.2 | Node + Chrome |
| Logo | L1 face >= 3:1 vs its plate (p5-p95 worst); L2 motif <= 12 % of a letter; MENU logo yellow < 0.5 %; 40 px build outline >= 2 px, cord >= 3 px, bomb >= 12 px; envelope never reflows between worlds; no text inside a wordmark | section 8.8 | Chrome |
| Ring inside viewport | each plate keeps its `T` px ring on screen | | Chrome |

Measured in the mocks, kept as regression references (not floors): desktop smallest primary cap 14.8, secondary 11.27, HUD 20.1, body 18; 125 % primary 18.5; phone primary 11.27, secondary 9.51, HUD 14.9, body 15; phone smallest touch 44 x 44 with smallest gap 8; worst information text 4.89:1 (coral RESET DEFAULTS) in the kit sheets, `ON` 4.63 at 125 %, `·` separators 4.64; worst locked legend 4.46:1; kit squint (JUNGLE / ICE / CROWN) rocker 3.30 / 3.30 / 3.35, difficulty bank 3.56 / 3.59 / 3.57, modifier 3.36 / 3.36 / 3.32, meter head vs empty 6.8 / 6.1 / 6.1, keycap vs chosen 4.32 / 4.41 / 4.36, focus band 1.76 / 1.97 / 1.93, locked vs chosen 5.9 / 5.7 / 5.8; controller: band 1.86, ring vs plate 16.89 (capture 10.29), ring vs body 6.98 (capture 3.40), bound vs unbound 4.89; end screens: focus band 2.94-4.64, ring 14.88-15.61, cracked vs not reached 3.61 (3.31 at 125 %); MENU ring 14.76-15.87.

Text recorder (plan R13, R14, QA review finding 5): fake `measureText` width = `len x 0.6 x px` at text scale 1 and `0.75 x px` per character at scale 1.25 (QA wording: "1.0 and 1.25 -> 0.75 x px"); fit tests use a factor 8 % wider than macOS. `clip()` / `fitKicker()` shorten with `…`, so "inside its slot" alone passes when text is cut: assert the exact string is present and no `…`. The module-level text scale is set only by tests and `shots.mjs --t125`; it is not a player setting.

## 12. Longest-string table (QA review finding 5)

Each string must be drawn whole (no `…`) inside its slot at text scale 1 and 1.25, on every page that shows it. QA review finding 5 lists exactly these strings: a 7-digit score, `FUSE/GRID CLEAR`, `NO FLOOR ITEMS`, `CONTROLLER 1 · STANDARD`, the shortfall line, `EXPERT DIFFICULTY · FAST SPEED · ONE LIFE · …` (every modifier on), `QUIT TO MENU`, `VIBRATION MEDIUM ›`. Everything else in this section (the concrete digits, the worst-case shortfall, the completed modifier string, the "Where" column, the "Also check" list) is EXTRAPOLATED by the appendix author and was not reviewed in QA §5.

| # | String (concrete forms are extrapolated, not in QA §5) | Where it is the longest case (extrapolated) |
|---|---|---|
| 1 | a 7-digit score, `1,234,567` (with separators; saved form `1,234,567 ×3 EXPERT` on GAME OVER) | score digits, STATS best run, ledgers, HUD SCORE chip |
| 2 | `FUSE/GRID CLEAR` | finale headline (display, H = 3.2 L); phone width |
| 3 | `NO FLOOR ITEMS` | MODIFIERS key and tag, PAUSE tag row |
| 4 | `CONTROLLER 1 · STANDARD` | CONTROLS status line, phone |
| 5 | the shortfall line, `120 points short of your NORMAL best (1,480).`; worst case `9,999,999 points short of your EXPERT best (9,999,999).` | GAME OVER right column (360 wide) |
| 6 | every modifier on: `EXPERT DIFFICULTY · FAST SPEED · ONE LIFE · NO FLOOR ITEMS · FEWER ITEMS · SHRINK · TIME TRIAL` (the PAUSE tag row shows at most 3 tags and `+N`; LEVEL SELECT and the next-run card print the longest form) | PAUSE tag row, LEVEL SELECT card, MENU PLAY tag |
| 7 | `QUIT TO MENU` | PAUSE danger row with the M cap |
| 8 | `VIBRATION MEDIUM ›` | SETTINGS door row (touch pitch) |

Also check at both scales (extrapolated, not in QA §5): `LEVEL 5 · ARENA · NORMAL` (finale kicker), `NEW · TODAY'S BOARD`, `PRESS A BUTTON FOR THROW`, `SOUTH WAS BOMB · BOMB NOW WEST`, `FURTHEST LEVEL YET`, `NEW BEST · NORMAL`, `New board · level 1`, `RESET CONTROLLER`, `BUTTON ALREADY IN USE?`.

## 13. Names in the mocks (display words)

OPTIONS is SETTINGS; ROOM and LV are LEVEL; HEAT CORE / PLUS / MAX is DIFFICULTY NORMAL / HARD / EXPERT; PACE EASY / NORM / HARD is GAME SPEED SLOW / NORMAL / FAST; MODES IRON / BARE / THIN / SHRINK + TIME are MODIFIERS ONE LIFE / NO FLOOR ITEMS / FEWER ITEMS / SHRINK + TIME TRIAL; RENDER is ART STYLE; PICKS and ITEMS are POWER-UPS; CHANGE RUN is LEVEL SELECT; HIGH SCORES and STATS are RECORDS. Stores keep their keys, bits and indices. The design record section 3 is the owner of this table.

## 14. Open: sources disagree

Nothing here was guessed; both values are given and the file names are named.

1. **Luminance tolerance.** The plan's Task 1.1 test asks every state token's `lum` within +-0.002 of `LUM[state]`. The mock's own `toL` output, rounded to 8-bit hex, misses that for `lit` (worst deviation 0.0056, WATER), `lit2` (0.0026) and `lip` (0.0031); all other states pass (section 1.5). Sources: plan Task 1.1 vs `round7/K7-kit/kit5.js` run under Node. Suggested resolution for the lead: a relative tolerance of 6 % (covers every state) or per-state absolute floors (dark states 0.0006, `band` 0.0011, `mid` 0.0017, `lit` 0.006). The mock's own gate is the same-lightness spread <= 1.15 across worlds, not an absolute tolerance.
2. **TRY AGAIN key height.** `round6/art/endscreens.md` says 1.5x key height (about 66 px); `round6/E6-end/notes.md` and `round7/E7-end/screen.css` build `calc(var(--btnh) * 1.32)` = 66 px desktop, 64 px phone. The pixels agree; the multiplier does not. Section 10 uses the built 1.32.
3. **Burnt-out bomb cord and crack.** `endscreens.md`: stub 0.35 of normal length, `#b8582a`, last 0.08 `#15181f`; crack a 3-segment zigzag 0.08 cell wide. `E6-end/notes.md` (built after a fix pass): stub 0.3, char `#3a302c` to `#1a1614` with an ash tip; crack 0.13 cell with fractures and a chipped corner. Section 10 uses the built values.
4. **Blast cross alpha.** `endscreens.md` .10 for the cross bands and the core; `E6-end/screen.css` builds the cross at .08 and the core at .10. Section 10 uses the built values.
5. **Logo cord tip and stacked tip.** `round7/art/logo-b.md` P2 (0.40, 1.04), P3 (0.54, 1.20) for the line build and stacked P3 (0.42, 2.48); `round7/L7-logo/logo.js` builds (0.40, 1.03), (0.54, 1.18) and (0.42, 2.46) (documented deviation 7). Section 8 uses the built values.
6. **GRID width.** `logo-b.md` says 2.69C; `L7-logo/notes.md` measures 2.68C. Immaterial; section 8 gives both.
7. **VOID rings.** `logo-b.md` 0.05C + 0.05C; built 0.04C + 0.04C (deviation 10). Built value used.
8. **REAL 3D bottom sides.** `logo-b.md` lip hex darkening to face x 0.80; built a 70 / 30 mix of lip and side colour darkening to x 0.72 (deviation 9). Built value used; the owner may prefer the spec.
9. **Controller geometry.** `round6/art/controller.md` (flat-topped bar, D-PAD at (0.22, 0.36)) is superseded by the owner's round 7 request; the built round 7 drawing (section 9) is binding. The round 6 file's state, callout and capture rules that the round 7 notes keep are copied in 9.2. The round 7 drawing deliberately breaks round 6's "no gradient plastic, no blur" rule (the owner's request wins, `C7-controls/notes.md`); the canvas kit must still obey the plan's "no filters" rule: replace the SVG blur with a hard offset fill.
10. **Keyboard on phone.** The built round 7 phone keyboard prints only the arrow glyphs (round 6 printed legends). The mock lists a 75 % layout (about 16 units, arrows tucked into the corner) as the owner's alternative; undecided.
11. **WIN confetti and GAME OVER spark timings** quote the round 6 direction; round 7 removed the fuse from the focus key but kept the bomb's guttering spark inside the burnt-out bomb illustration (it is the bomb art, not a focus marker). Treat the guttering beat at 300 ms as part of the GAME OVER illustration only.
12. **PAUSE tag row.** `round6/art/pause.md` says the difficulty tag always shows; `round6/S6-pages/notes.md` (coordinator fix) and the design record show only non-default rules. The design record wins.
13. **ICE logo plate.** `round7/L7-logo/logo.js` `WORLDS.ICE` and `round7/art/logo-b.md` section 3 use the game's untinted navy (bed `#0a2048`, side and frame `#2e4a78`, frame highlight `#d0e8f8`). The kit (`round7/K7-kit/kit5.js` `TINT.ICE`) and the design record section 1 move ICE's UI to glacier cyan (bed `#0f2429`, wall `#3a4d54`, wallHi `#dae6ea`) because the owner read the navy as "space ship". The logo's L1 worst case (5.38, ICE GRID) and the plate, side colour and token measurements were taken on the navy bed; the logo was never measured on the cyan one. Section 8 gives the navy values as built. A decision is needed before the logo task: keep the navy for the logo plate (as built and measured) or retint it through `uiBiome` and re-measure.
