# Item Glyphs (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All twelve cabinet glyphs run the same five shading beats instead of one flat fill, `drawItemBody` shows family instead of restating hue, and `icons.js` becomes the one craft module the whole cabinet shares.

> **Revision P1.5 — 2026-09-05.** The first pass shipped and was rejected: *"the new itemts are not really intutive design graphic and people confiuse from the look, let's review it, and make more intiutive and more reall look."* Every `ITEM_SHAPE` / `ITEM_ACCENT` block below is the **re-authored, semantic-first** set — each glyph is now a real nameable object (flame, bomb, bolt, heart, shield, boot, thrown bomb, brick wall, beam, explosion, arrowhead, detonator), per the spec's rewritten §1.6. `speed` / `heart` / `shield` are byte-identical to the first pass because they already read. Budgets moved with it: outline `<= 14` verts, accent `<= 4` paint ops (spec §1.7). The five-beat driver, the family tables and `drawItemChrome` are unchanged.

**Architecture:** `tone` / `dk` / `lt` / `poly` / `oval` / `seal` move out of `enemybody.js` into `icons.js`; `enemybody.js` takes an **imports-only** diff so the foe op streams stay byte-identical. `icons.js` grows three tables — `ITEM_FAMILY` (the mechanical split already encoded in `POWER`), `ITEM_SHAPE` (one `poly()` outline per kind), `ITEM_ACCENT` (one small tell per kind) — and `drawIcon` becomes a single five-beat driver over them. `drawItemBody` gains `drawItemChrome`, the 2D echo of the 3D family ring, on the grid-derived phase.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, Canvas 2D. Zero npm runtime deps. `icons.js` imports `CFG` and nothing else — the kind-`"2d"` path must never reach three.

**Spec:** `docs/superpowers/specs/2026-09-05-items-player-art-design.md`

## Global Constraints

- `POWER` catalog is byte-identical: 12 rows, pinned `IDS` order, every `t` / `name` / `help` / `col` / `permanent` / `apply`. **No hue moves.** Not one hex in `src/core/entities.js`, `src/render/scenes.js:165-166`, or `src/render/sprites.js:482`.
- `enemybody.js`'s change is **imports-only**: delete the six local definitions, add one import line. `ROCK`, `VOID`, the `S_*` contours, `contact`, `shell`, `eye`, `lens`, the `BODY` table and `drawEnemyBody` stay byte-identical.
- `tests/enemies-art.test.mjs` must stay green with **zero edits**. If it goes red, the move was done wrong — do not edit the suite to make it pass.
- `tests/pickups.test.mjs`, `menudraw.test.mjs`, `touch.test.mjs`, `r3d.test.mjs`, `media.test.mjs` all stay green with zero edits.
- One clock: `world.time`, read render-side. `performance.now()` is forbidden. Per-instance phase is `ph = (it.x * 0.7 + it.y * 1.3) / CFG.TILE`, never `slot`.
- Legibility budget (P1.5 numbers): outline `<= 14` vertices, accent `<= 4` paint ops and never a hairline (`lineWidth >= s*0.12`), nothing painted outside `±1.20 * s`, no `fillText` in any glyph ever. Only `power` reaches 14 verts and only `bomb` reaches 3 accent ops. The `±1.20 * s` fit is the one number that did **not** move — it is real containment from `well()`. Its headroom is one-sided: beat 1 repaints the outline offset by `(+0.07s, +0.09s)`, so a *positive* outline vertex may reach `1.13 / 1.11` while a negative one may use the full `-1.20`.
- No `arc` or `ellipse` in an accent unless a full circle is meant: the fit recorder bounds a partial arc by its whole circle, so a 40° signal arc fails the gate for pixels it never paints. `remote`'s signal arcs and its round button are `quadraticCurveTo`.
- `setLineDash` is not available on the headless stub context and must not be used — draw the dashes as arcs.
- `drawBombBody` is **not touched**; its `quad`-fuse / `+`-pip / no-`fillRect` pins live there and take zero edits. The `bomb` *glyph* mirrors its story, not its ops: a `quadraticCurveTo` fuse and a `#ffd447` spark, no `fillRect`. (P1.5 dropped the glyph's `+` pip for a white specular crescent — the pip was a `drawBombBody` pin, never a `drawIcon` one, and the crescent is what makes the orb read as a solid body rather than a berry.)
- No comments unless the file already uses explanatory block comments (its style). `icons.js` and `enemybody.js` both do — sparse, at decision points.
- Never write the banned grid-bomb franchise name into any committed file.
- PWA: bump `CACHE_NAME` (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`) **together**, `current vN → vN+1`, in every commit here — all three touch `SRC` bytes.

---

### Task 1: Move the craft into `icons.js` + publish `ITEM_FAMILY`

**Files:**
- Modify: `src/render/icons.js` (add after `rr`, ~line 15)
- Modify: `src/render/enemybody.js` (line 1 import; delete lines 18–52 `TONES`/`tone`/`dk`/`lt`/`seal` and lines 111–134 `poly`/`oval`)
- Create: `tests/items-art.test.mjs`
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `CFG` (`src/core/config.js`), `POWER` (`src/core/entities.js`, test-side only)
- Produces:
  - `export function tone(col, k, to)`
  - `export const dk = (col, k) => tone(col, k, 0)`
  - `export const lt = (col, k) => tone(col, k, 255)`
  - `export function seal(c)`
  - `export function poly(pts)` → `(c, r, k, ox, oy) => void`
  - `export function oval(cy, rx, ry)` → `(c, r, k, ox, oy) => void`
  - `export const ITEM_FAMILY = {fire:"cap",bomb:"cap",speed:"cap",heart:"vit",shield:"vit",kick:"utl",throw:"utl",pass:"utl",remote:"utl",line:"bls",power:"bls",pierce:"bls"}`

- [ ] **Step 1: Write the failing test** — create `tests/items-art.test.mjs` with the shared harness plus §4.6

```js
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { CFG } from "../src/core/config.js";
import { POWER } from "../src/core/entities.js";
import { drawIcon, RIM, ITEM_FAMILY } from "../src/render/icons.js";
import { drawItemBody, drawPlayerBody } from "../src/render/sprites.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""),
  );
}

const IDS = POWER.map((p) => p.t);
const S = CFG.TILE * 0.3;

/* Recording context. Unlike pickups.test.mjs's op-name stub this one keeps
   the ARGUMENTS and the assigned VALUES: several gates below read colors and
   coordinates, not just which call happened. */
function stub() {
  const ops = [];
  const rec =
    (n) =>
    (...a) => {
      ops.push([n, ...a.map((v) => (typeof v === "number" ? +v.toFixed(3) : v))]);
    };
  const c = { _ops: ops };
  for (const n of [
    "save", "restore", "translate", "scale", "rotate", "beginPath", "closePath",
    "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "arc", "arcTo",
    "ellipse", "fill", "stroke", "fillRect", "rect", "fillText", "clearRect",
  ])
    c[n] = rec(n);
  return new Proxy(c, {
    set(t, p, v) {
      if (typeof p !== "symbol") t._ops.push(["set", String(p), String(v)]);
      t[p] = v;
      return true;
    },
  });
}
/* Axis-aligned extent recorder, same shape as enemies-art.test.mjs's. */
function box(opt) {
  const b = { x0: 0, x1: 0, y0: 0, y1: 0 };
  const at = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    b.x0 = Math.min(b.x0, x);
    b.x1 = Math.max(b.x1, x);
    b.y0 = Math.min(b.y0, y);
    b.y1 = Math.max(b.y1, y);
  };
  const noE = !!(opt && opt.noEllipse);
  const c = {
    _b: b,
    save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
    beginPath() {}, closePath() {}, fill() {}, stroke() {},
    moveTo: at,
    lineTo: at,
    quadraticCurveTo(cx, cy, x, y) { at(cx, cy); at(x, y); },
    bezierCurveTo(ax, ay, bx, by, x, y) { at(ax, ay); at(bx, by); at(x, y); },
    arc(x, y, r) { at(x - r, y - r); at(x + r, y + r); },
    arcTo(x1, y1, x2, y2) { at(x1, y1); at(x2, y2); },
    ellipse(x, y, rx, ry) { if (noE) return; at(x - rx, y - ry); at(x + rx, y + ry); },
    fillRect(x, y, w, h) { at(x, y); at(x + w, y + h); },
    rect(x, y, w, h) { at(x, y); at(x + w, y + h); },
  };
  return new Proxy(c, { set(t, p, v) { t[p] = v; return true; } });
}
const names = (ops) => ops.map((o) => o[0]);
const setsOf = (ops, prop) =>
  ops.filter((o) => o[0] === "set" && o[1] === prop).map((o) => o[2]);
const paints = (ops) =>
  names(ops).filter((n) => n === "fill" || n === "stroke" || n === "fillRect").length;
const maxAbs = (b) => Math.max(-b.x0, b.x1, -b.y0, b.y1);

{
  const fams = IDS.map((t) => ITEM_FAMILY[t]);
  check(
    "ITEM_FAMILY covers all 12 POWER kinds",
    fams.every(Boolean) && Object.keys(ITEM_FAMILY).length === 12,
    fams.join(","),
  );
  check(
    "ITEM_FAMILY has exactly 4 distinct families",
    new Set(fams).size === 4,
    [...new Set(fams)].join(","),
  );
  const cap = IDS.filter((t) => ITEM_FAMILY[t] === "cap").join(",");
  const perm = POWER.filter((p) => p.permanent === true).map((p) => p.t).join(",");
  check('ITEM_FAMILY "cap" is exactly the permanent set', cap === perm, cap + " vs " + perm);
}

{
  const eb = await import("../src/render/enemybody.js");
  const ic = await import("../src/render/icons.js");
  check(
    "five-beat helpers live in icons.js",
    typeof ic.tone === "function" &&
      typeof ic.dk === "function" &&
      typeof ic.lt === "function" &&
      typeof ic.seal === "function" &&
      typeof ic.poly === "function" &&
      typeof ic.oval === "function",
  );
  check(
    "enemybody.js re-declares none of them",
    !/^(const|function)\s+(tone|dk|lt|seal|poly|oval)\b/m.test(
      (await import("node:fs")).readFileSync("src/render/enemybody.js", "utf8"),
    ),
  );
  check("enemybody still exports drawEnemyBody", typeof eb.drawEnemyBody === "function");
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
```

Import staging matters: this header names only what already exists plus `ITEM_FAMILY`, so the RED state is exactly the missing export and nothing else. Task 2 adds `ITEM_SHAPE, ITEM_ACCENT` to the `icons.js` import and Task 3 adds `drawItemChrome` to the `sprites.js` import, each in the same step that writes the tests using them — never earlier, or an unrelated `SyntaxError` masks the assertion you are trying to fail. `createWorld` / `loadLevel` / `step` / `CFG` / `drawPlayerBody` are unused until Task 2 and P3; they are imported now so the header stays stable for the rest of the program.

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/items-art.test.mjs
```

Expected: FAIL — `SyntaxError: The requested module '../src/render/icons.js' does not provide an export named 'ITEM_FAMILY'`.

- [ ] **Step 3: Implement**

In `src/render/icons.js`, after `rr` (~line 15), add — the `TONES` block comment moves across with its function so `enemybody.js`'s reason for memoising is not lost:

```js
/* Tones are quantised to 1/32 and memoised: bodies and glyphs ask for ~10
   each and 16 of them repaint every frame, so a fresh rgb() string per ask
   would churn. One table for the whole cabinet since the craft is shared. */
const TONES = {};
export function tone(col, k, to) {
  const q = Math.round(k * 32) / 32;
  const key = col + q + to;
  let v = TONES[key];
  if (v) return v;
  const n = parseInt(String(col).slice(1), 16) || 0;
  const m = (b) => Math.round(b + (to - b) * q);
  v = "rgb(" + m((n >> 16) & 255) + "," + m((n >> 8) & 255) + "," + m(n & 255) + ")";
  return (TONES[key] = v);
}
export const dk = (col, k) => tone(col, k, 0);
export const lt = (col, k) => tone(col, k, 255);
export function seal(c) {
  c.strokeStyle = RIM;
  c.lineWidth = 2;
  c.lineJoin = "round";
  c.stroke();
}
/* A vertex is [x,y] for a line or [x,y,cx,cy] for a quadratic. */
export function poly(pts) {
  return (c, r, k, ox, oy) => {
    c.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i],
        x = ox + p[0] * r * k,
        y = oy + p[1] * r * k;
      if (i === 0) c.moveTo(x, y);
      else if (p.length === 4) c.quadraticCurveTo(ox + p[2] * r * k, oy + p[3] * r * k, x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  };
}
/* Plates keep their centre and only thin their radii, so a body built from
   offset ovals does not drift when shell insets it. */
export function oval(cy, rx, ry) {
  return (c, r, k, ox, oy) => {
    c.beginPath();
    c.ellipse(ox, oy + cy * r, rx * r * k, ry * r * k, 0, 0, 7);
  };
}
/* The mechanical split already encoded in POWER: permanent stat growth,
   survival, transient toggle, bombKind selector. Families separate on
   silhouette, ring profile and idle rhythm — never on hue. */
export const ITEM_FAMILY = {
  fire: "cap",
  bomb: "cap",
  speed: "cap",
  heart: "vit",
  shield: "vit",
  kick: "utl",
  throw: "utl",
  pass: "utl",
  remote: "utl",
  line: "bls",
  power: "bls",
  pierce: "bls",
};
```

In `src/render/enemybody.js`, replace line 1 with:

```js
import { rr, RIM, tone, dk, lt, poly, oval, seal } from "./icons.js";
```

then delete exactly two runs: the `TONES` block comment + `tone` + `dk` + `lt` + `seal` (lines 18–52) and the `poly` + `oval` block-commented pair (lines 111–134), moving both block comments across as shown above. Nothing else in the file changes.

- [ ] **Step 4: Run to PASS — and the zero-edit foe guard**

```bash
node --test tests/items-art.test.mjs tests/enemies-art.test.mjs tests/pickups.test.mjs tests/menudraw.test.mjs
```

Expected: all green. `enemies-art.test.mjs` must pass with **zero edits to that file** — the helpers are pure, so every foe op stream is byte-identical. If it is red, revert and redo the move; do not touch the suite.

- [ ] **Step 5: PWA bump + commit**

Bump `src/pwa/shell.js:1` `CACHE_NAME` and `sw.js:3` `REV` together, `current vN → vN+1` (read the current value first — do not assume).

```bash
git add src/render/icons.js src/render/enemybody.js tests/items-art.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Move the five-beat craft helpers into icons.js and publish ITEM_FAMILY.

tone/dk/lt/poly/oval/seal are now one cabinet-wide craft; enemybody.js
takes an imports-only diff so every foe op stream stays byte-identical.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The twelve glyphs on the five-beat

**Files:**
- Modify: `src/render/icons.js` — replace `drawIcon`'s `switch` body (lines 17–268) with `ITEM_SHAPE` + `ITEM_ACCENT` + the five-beat driver
- Modify: `tests/items-art.test.mjs` — add §4.1–4.5, §4.14, §4.15–4.16
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `CFG`, `RIM`, `dk`, `lt`, `seal`, `poly`
- Produces:
  - `export const ITEM_SHAPE = { <t>: [[x,y] | [x,y,cx,cy], ...] }` — 12 keys, `<= 14` verts each, `s`-units
  - `export const ITEM_ACCENT = { <t>: (c, s, col) => void }` — 12 keys, `<= 4` paint ops each
  - `export function drawIcon(c, type, col, time)` — arity unchanged

- [ ] **Step 1: Write the failing tests** — extend the `icons.js` import to `import { drawIcon, RIM, ITEM_FAMILY, ITEM_SHAPE, ITEM_ACCENT } from "../src/render/icons.js";`, then insert before the `console.log` summary in `tests/items-art.test.mjs`

```js
{
  const sig = {};
  for (const t of IDS) {
    const c = stub();
    drawIcon(c, t, "#ffffff", 0);
    const ops = c._ops;
    sig[t] = JSON.stringify(ops);
    const fills = setsOf(ops, "fillStyle");
    check(
      "five-beat value stack: " + t + " writes >=4 distinct fillStyle",
      new Set(fills).size >= 4,
      [...new Set(fills)].join(" "),
    );
    check(
      "five-beat paints: " + t + " >= 3",
      paints(ops) >= 3,
      String(paints(ops)),
    );
    const iRim = ops.findIndex((o) => o[0] === "set" && o[1] === "strokeStyle" && o[2] === RIM);
    const iStroke = ops.findIndex((o) => o[0] === "stroke");
    check(
      "glyph seals with RIM: " + t,
      iRim >= 0 && iStroke > iRim,
      iRim + "/" + iStroke,
    );
    check(
      "dark form precedes the lit body: " + t,
      fills.length > 0 && fills[0] !== "#ffffff",
      String(fills[0]),
    );
    check("no fillText in " + t, !names(ops).includes("fillText"));
  }
  let distinct = true;
  for (let i = 0; i < IDS.length; i++)
    for (let j = i + 1; j < IDS.length; j++)
      if (sig[IDS[i]] === sig[IDS[j]]) distinct = false;
  check("all 12 drawIcon op streams are pairwise distinct", distinct);
}

{
  const over = [];
  for (const t of IDS) {
    const c = box();
    drawIcon(c, t, "#ffffff", 0);
    if (!(maxAbs(c._b) <= 1.2 * S + 1e-6)) over.push(t + ":" + maxAbs(c._b).toFixed(2));
  }
  check("every glyph fits +-1.20*s", !over.length, over.join(" ") || "<=" + (1.2 * S));
}

{
  const bigOutline = IDS.filter((t) => !ITEM_SHAPE[t] || ITEM_SHAPE[t].length > 12);
  check("outline budget <= 12 vertices", !bigOutline.length, bigOutline.join(" ") || "ok");
  const bigAccent = [],
    hairline = [],
    noFill = [];
  for (const t of IDS) {
    const c = stub();
    ITEM_ACCENT[t](c, S, "#ffffff");
    const ops = c._ops;
    if (paints(ops) > 3) bigAccent.push(t + ":" + paints(ops));
    if (!setsOf(ops, "fillStyle").length) noFill.push(t);
    const lw = setsOf(ops, "lineWidth").map(Number);
    if (names(ops).includes("stroke") && !lw.every((w) => w >= S * 0.12)) hairline.push(t);
  }
  check("accent budget <= 3 paint ops", !bigAccent.length, bigAccent.join(" ") || "ok");
  check("every accent writes a fillStyle (solid shape)", !noFill.length, noFill.join(" ") || "ok");
  check("no accent is a hairline stroke", !hairline.length, hairline.join(" ") || "ok");
}

{
  const w = createWorld(42, 1);
  loadLevel(w, 1, false);
  w.state = "PLAY";
  const start = w.enemies
    .map((e) => e.type + "," + e.x.toFixed(2) + "," + e.y.toFixed(2))
    .join("|");
  check(
    "art-only: seed-42 L1 roster unchanged",
    start === "walker,180.00,220.00|walker,300.00,100.00|stationary,300.00,140.00",
    start,
  );
  const intent = { move: { x: 0, y: 0 }, fire: false, firePrev: false, shift: false, remote: false, kick: false };
  for (let i = 0; i < 180; i++) step(w, CFG.STEP, { 0: intent });
  const end = w.enemies
    .map((e) => e.type + "," + (e.dead ? 1 : 0) + "," + e.x.toFixed(2) + "," + e.y.toFixed(2))
    .join("|");
  check(
    "art-only: 180 PLAY steps unchanged",
    end === "walker,0,182.16,220.00|walker,0,300.00,100.00|stationary,0,300.00,140.00",
    end,
  );
  const cat = POWER.map((p) => p.t + ":" + p.col + ":" + (p.permanent ? 1 : 0)).join("|");
  check(
    "art-only: POWER catalog fingerprint unchanged",
    cat ===
      "fire:#ff8a3c:1|bomb:#ff5d73:1|speed:#3db4ff:1|heart:#ff3b5c:0|shield:#6fb7ff:0" +
        "|kick:#c07a3a:0|throw:#ffb347:0|pass:#77ff99:0|line:#d0e4ff:0|power:#ff4d5e:0" +
        "|pierce:#8f8fff:0|remote:#e8c35a:0",
    cat,
  );
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/items-art.test.mjs
```

Expected: FAIL — `ITEM_SHAPE is not defined` / `>=4 distinct fillStyle` fails for every kind (today's glyphs write 1–3). On the P1.5 re-run the RED is narrower and just as real: `outline budget <= 12 vertices -> power` (the seven-spike explosion is 14) plus the per-kind outline pins of spec §4.5b.

- [ ] **Step 3: Implement**

Replace everything from the `/* ---- items / power-up icons ---- */` comment to the end of `src/render/icons.js` with the three blocks below.

**3a — `ITEM_SHAPE`.** Outlines in `s`-units for `poly()`, semantic-first per the spec's revised §1.6: each one is a nameable object, not an abstract silhouette. The seven flat kinds are still the table `three/entities.js` imports in P2, so the 2D and 3D reads cannot drift; `bomb` is the one declared carve-out (round orb in 2D, low-`seg` faceted lathe in 3D — a sphere is a circle in plan view). `speed` / `heart` / `shield` are byte-identical to the first pass.

```js
export const ITEM_SHAPE = {
  /* FLAME — teardrop, licking tip, one notch where the tongue peels off. */
  fire: [
    [0.08, -1.16],
    [0.5, -0.24, 0.46, -0.76],
    [0.66, 0.36, 0.78, 0.02],
    [0, 0.94, 0.5, 0.88],
    [-0.66, 0.36, -0.5, 0.88],
    [-0.5, -0.2, -0.78, 0.02],
    [-0.2, -0.64, -0.36, -0.5],
    [-0.08, -0.9],
  ],
  /* BOMB — the classic orb: round body, collared neck for the fuse. The
     in-game 2D bomb reuses this read, so the two must agree. */
  bomb: [
    [-0.74, 0.32],
    [-0.24, -0.36, -0.78, -0.14],
    [-0.24, -0.62],
    [0.24, -0.62],
    [0.24, -0.36],
    [0.74, 0.32, 0.78, -0.14],
    [0, 1.08, 0.74, 1.02],
    [-0.74, 0.32, -0.74, 1.02],
  ],
  speed: [[0.3, -1.02], [-0.62, 0.02], [-0.06, 0.02], [-0.34, 1.02], [0.66, -0.1], [0.1, -0.1]],
  heart: [
    [0, 0.98],
    [-0.62, 0.2, -0.42, 0.72],
    [-1.0, -0.34, -0.94, -0.1],
    [-0.54, -0.78, -0.94, -0.72],
    [0, -0.2, -0.22, -0.62],
    [0.54, -0.78, 0.22, -0.62],
    [1.0, -0.34, 0.94, -0.72],
    [0.62, 0.2, 0.94, -0.1],
  ],
  shield: [
    [0, -0.94],
    [0.84, -0.62],
    [0.76, 0.16],
    [0.4, 0.72, 0.68, 0.52],
    [0, 0.98, 0.16, 0.92],
    [-0.4, 0.72, -0.16, 0.92],
    [-0.76, 0.16, -0.68, 0.52],
    [-0.84, -0.62],
  ],
  /* KICK — a boot in profile mid-kick. The foot has to stay thin and run
     nearly twice the shaft's length, or the ankle bend reads as an elbow. */
  kick: [
    [-0.66, -1.1],
    [0.1, -1.1],
    [0.14, 0.02],
    [0.92, -0.18, 0.52, 0.08],
    [1.0, 0.3, 1.1, 0.02],
    [0, 0.62],
    [-0.36, 0.66],
    [-0.72, 0.46],
  ],
  /* THROW — the same orb BOMB uses, half the size and thrown clear of
     centre; the trajectory it rode is the accent. Mass distribution is the
     whole separation from BOMB: big centred orb there, small orb plus a long
     arc here. */
  throw: [
    [0.66, 0.36],
    [0.14, -0.16, 0.66, -0.16],
    [-0.08, -0.24],
    [0, -0.56],
    [-0.24, -0.48],
    [-0.38, 0.36, -0.38, -0.16],
    [0.14, 0.88, -0.38, 0.88],
    [0.66, 0.36, 0.66, 0.88],
  ],
  /* PASS — a brick wall, wider than it is tall, with a gap knocked through
     the middle. The arrow that threads the gap is the accent. */
  pass: [
    [-1.1, -0.66], [-0.24, -0.66], [-0.24, 0.1], [0.24, 0.1],
    [0.24, -0.66], [1.1, -0.66], [1.1, 0.74], [-1.1, 0.74],
  ],
  /* REMOTE — a hand detonator: a wide low box with a thin antenna standing
     off the right shoulder. The plunger button is the accent. */
  remote: [
    [-0.86, -0.12], [0.3, -0.12], [0.4, -1.12], [0.58, -1.12],
    [0.5, -0.12], [0.86, -0.12], [0.86, 0.88], [-0.86, 0.88],
  ],
  /* LINE — a directed beam: flared origin, long shaft, arrowhead tip. The
     asymmetry is what stops it reading as a plain double-headed arrow. */
  line: [
    [-1.1, -0.44], [-0.62, -0.17], [0.3, -0.17], [0.3, -0.5], [1.1, 0],
    [0.3, 0.5], [0.3, 0.17], [-0.62, 0.17], [-1.1, 0.44],
  ],
  /* POWER — a blast, not a sparkle: seven spikes of deliberately uneven
     length, the comic-explosion outline every player already knows. */
  power: [
    [0, -1.12], [0.3, -0.42], [0.86, -0.74], [0.5, -0.14],
    [1.12, 0.16], [0.42, 0.36], [0.66, 1.02], [0.06, 0.52],
    [-0.5, 1.04], [-0.42, 0.34], [-1.12, 0.3], [-0.44, -0.16],
    [-0.8, -0.86], [-0.28, -0.4],
  ],
  /* PIERCE — one broad arrowhead, tip-dominant, with a notched tail. The
     brick it punched through is the accent, spraying behind the tip. */
  pierce: [
    [0, -1.14], [0.62, -0.18], [0.26, -0.18], [0.34, 0.98],
    [0, 0.72], [-0.34, 0.98], [-0.26, -0.18], [-0.62, -0.18],
  ],
};
```

**3b — `ITEM_ACCENT`.** Beat 5, now carrying real semantic load rather than only a bright tell: `kick`'s dark sole is what makes the boot a shoe, `pass`'s mortar is what makes the rectangle masonry, `throw`'s arc-arrow is the verb. Colours stay the kind's existing second colour where it has one (`#ffd447` / `#ffce8a` / `#ff5d73` / `#12203a` / `#0d3f78`), else `#fff3b0`, plus `dk(col, …)` for the two structural accents. Every entry is `<= 4` paint ops, writes at least one `fillStyle`, and any stroke carries `lineWidth >= s*0.12`. Multiple subpaths inside one `beginPath` cost one op — that is how `pass`'s five mortar bars and `pierce`'s four shards stay inside budget.

```js
export const ITEM_ACCENT = {
  /* the inner tongue */
  fire: (c, s) => {
    c.fillStyle = "#ffd447";
    c.beginPath();
    c.moveTo(s * 0.02, -s * 0.42);
    c.quadraticCurveTo(s * 0.3, s * 0.14, 0, s * 0.62);
    c.quadraticCurveTo(-s * 0.3, s * 0.14, s * 0.02, -s * 0.42);
    c.fill();
  },
  /* fuse curling off the collar, lit tip, one specular crescent on the orb */
  bomb: (c, s) => {
    c.strokeStyle = "#ffd447";
    c.lineWidth = s * 0.18;
    c.beginPath();
    c.moveTo(s * 0.12, -s * 0.58);
    c.quadraticCurveTo(s * 0.52, -s * 0.68, s * 0.5, -s * 0.94);
    c.stroke();
    c.fillStyle = "#ffd447";
    c.beginPath();
    c.moveTo(s * 0.5, -s * 1.16);
    c.lineTo(s * 0.66, -s * 0.98);
    c.lineTo(s * 0.5, -s * 0.8);
    c.lineTo(s * 0.34, -s * 0.98);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(-s * 0.46, s * 0.26);
    c.quadraticCurveTo(-s * 0.54, -s * 0.16, -s * 0.14, -s * 0.26);
    c.quadraticCurveTo(-s * 0.38, -s * 0.02, -s * 0.3, s * 0.32);
    c.closePath();
    c.fill();
  },
  speed: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(s * 0.22, -s * 0.78);
    c.lineTo(-s * 0.3, -s * 0.02);
    c.lineTo(-s * 0.04, -s * 0.02);
    c.lineTo(s * 0.06, -s * 0.34);
    c.closePath();
    c.fill();
  },
  heart: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(-s * 0.74, -s * 0.52);
    c.quadraticCurveTo(-s * 0.4, -s * 0.76, -s * 0.2, -s * 0.5);
    c.quadraticCurveTo(-s * 0.44, -s * 0.6, -s * 0.62, -s * 0.34);
    c.closePath();
    c.fill();
  },
  shield: (c, s) => {
    c.fillStyle = "#0d3f78";
    c.beginPath();
    c.moveTo(0, -s * 0.46);
    c.lineTo(s * 0.34, -s * 0.02);
    c.lineTo(0, s * 0.44);
    c.lineTo(-s * 0.34, -s * 0.02);
    c.lineTo(0, s * 0.1);
    c.closePath();
    c.fill();
  },
  /* the dark sole that makes it a shoe, then the toe cap and two chevrons */
  kick: (c, s, col) => {
    c.fillStyle = dk(col, 0.62);
    c.beginPath();
    c.moveTo(s * 1.0, s * 0.3);
    c.lineTo(0, s * 0.62);
    c.lineTo(-s * 0.36, s * 0.66);
    c.lineTo(-s * 0.42, s * 0.36);
    c.lineTo(0, s * 0.32);
    c.lineTo(s * 0.94, s * 0.02);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffce8a";
    c.beginPath();
    c.moveTo(s * 0.56, -s * 0.08);
    c.lineTo(s * 0.9, -s * 0.2);
    c.lineTo(s * 1.0, s * 0.12);
    c.lineTo(s * 0.62, s * 0.22);
    c.closePath();
    c.moveTo(-s * 1.18, -s * 0.66);
    c.lineTo(-s * 0.92, -s * 0.4);
    c.lineTo(-s * 1.18, -s * 0.14);
    c.lineTo(-s * 1.06, -s * 0.4);
    c.closePath();
    c.moveTo(-s * 1.18, s * 0.06);
    c.lineTo(-s * 0.92, s * 0.32);
    c.lineTo(-s * 1.18, s * 0.58);
    c.lineTo(-s * 1.06, s * 0.32);
    c.closePath();
    c.fill();
  },
  /* the throwing arc, drawn as a real arrow so the verb reads, arcing over
     the orb and away */
  throw: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(-s * 1.04, s * 0.66);
    c.quadraticCurveTo(-s * 0.84, -s * 0.94, s * 0.6, -s * 0.92);
    c.lineTo(s * 0.46, -s * 1.16);
    c.lineTo(s * 1.1, -s * 0.7);
    c.lineTo(s * 0.4, -s * 0.44);
    c.lineTo(s * 0.52, -s * 0.68);
    c.quadraticCurveTo(-s * 0.58, -s * 0.66, -s * 0.8, s * 0.66);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffd447";
    c.beginPath();
    c.moveTo(-s * 0.12, -s * 0.76);
    c.lineTo(s * 0.06, -s * 0.58);
    c.lineTo(-s * 0.12, -s * 0.4);
    c.lineTo(-s * 0.3, -s * 0.58);
    c.closePath();
    c.fill();
  },
  /* mortar courses make it masonry; the arrow threads the knocked-out gap */
  pass: (c, s, col) => {
    c.fillStyle = dk(col, 0.62);
    c.beginPath();
    c.moveTo(-s * 1.1, s * 0.16);
    c.lineTo(s * 1.1, s * 0.16);
    c.lineTo(s * 1.1, s * 0.3);
    c.lineTo(-s * 1.1, s * 0.3);
    c.closePath();
    c.moveTo(-s * 0.68, -s * 0.66);
    c.lineTo(-s * 0.54, -s * 0.66);
    c.lineTo(-s * 0.54, s * 0.16);
    c.lineTo(-s * 0.68, s * 0.16);
    c.closePath();
    c.moveTo(s * 0.54, -s * 0.66);
    c.lineTo(s * 0.68, -s * 0.66);
    c.lineTo(s * 0.68, s * 0.16);
    c.lineTo(s * 0.54, s * 0.16);
    c.closePath();
    c.moveTo(-s * 0.4, s * 0.3);
    c.lineTo(-s * 0.26, s * 0.3);
    c.lineTo(-s * 0.26, s * 0.74);
    c.lineTo(-s * 0.4, s * 0.74);
    c.closePath();
    c.moveTo(s * 0.26, s * 0.3);
    c.lineTo(s * 0.4, s * 0.3);
    c.lineTo(s * 0.4, s * 0.74);
    c.lineTo(s * 0.26, s * 0.74);
    c.closePath();
    c.fill();
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(0, -s * 1.16);
    c.lineTo(s * 0.4, -s * 0.6);
    c.lineTo(s * 0.16, -s * 0.6);
    c.lineTo(s * 0.16, s * 0.98);
    c.lineTo(-s * 0.16, s * 0.98);
    c.lineTo(-s * 0.16, -s * 0.6);
    c.lineTo(-s * 0.4, -s * 0.6);
    c.closePath();
    c.fill();
  },
  /* the big red plunger button, and the signal leaving the antenna */
  remote: (c, s) => {
    c.fillStyle = "#ff5d73";
    c.beginPath();
    c.moveTo(-s * 0.34, s * 0.38);
    c.quadraticCurveTo(-s * 0.34, s * 0.04, 0, s * 0.04);
    c.quadraticCurveTo(s * 0.34, s * 0.04, s * 0.34, s * 0.38);
    c.quadraticCurveTo(s * 0.34, s * 0.72, 0, s * 0.72);
    c.quadraticCurveTo(-s * 0.34, s * 0.72, -s * 0.34, s * 0.38);
    c.fill();
    c.strokeStyle = "#fff3b0";
    c.lineWidth = s * 0.14;
    c.beginPath();
    c.moveTo(s * 0.7, -s * 1.16);
    c.quadraticCurveTo(s * 0.9, -s * 0.96, s * 0.76, -s * 0.76);
    c.moveTo(s * 0.9, -s * 1.18);
    c.quadraticCurveTo(s * 1.18, -s * 0.92, s * 0.96, -s * 0.64);
    c.stroke();
  },
  /* the hot core down the shaft, and the muzzle burst it was fired from */
  line: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(-s * 0.86, -s * 0.07);
    c.lineTo(s * 0.3, -s * 0.07);
    c.lineTo(s * 0.3, -s * 0.28);
    c.lineTo(s * 0.88, 0);
    c.lineTo(s * 0.3, s * 0.28);
    c.lineTo(s * 0.3, s * 0.07);
    c.lineTo(-s * 0.86, s * 0.07);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        r = i % 2 ? 0.15 : 0.42;
      const x = -s * 0.74 + Math.cos(a) * s * r,
        y = Math.sin(a) * s * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
    c.fill();
  },
  /* the white-hot heart of the blast, ringed by its inner flare */
  power: (c, s) => {
    c.fillStyle = "#fff3b0";
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        r = i % 2 ? 0.24 : 0.56;
      const x = Math.cos(a) * s * r,
        y = Math.sin(a) * s * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(-s * 0.22, 0);
    c.lineTo(0, -s * 0.22);
    c.lineTo(s * 0.22, 0);
    c.lineTo(0, s * 0.22);
    c.closePath();
    c.fill();
  },
  /* the brick it went through, split into shards behind the tip */
  pierce: (c, s) => {
    c.fillStyle = "#12203a";
    c.beginPath();
    c.moveTo(-s * 1.04, -s * 0.36);
    c.lineTo(-s * 0.66, -s * 0.16);
    c.lineTo(-s * 0.98, s * 0.04);
    c.closePath();
    c.moveTo(s * 1.04, -s * 0.36);
    c.lineTo(s * 0.66, -s * 0.16);
    c.lineTo(s * 0.98, s * 0.04);
    c.closePath();
    c.moveTo(-s * 0.88, s * 0.34);
    c.lineTo(-s * 0.5, s * 0.22);
    c.lineTo(-s * 0.68, s * 0.62);
    c.closePath();
    c.moveTo(s * 0.88, s * 0.34);
    c.lineTo(s * 0.5, s * 0.22);
    c.lineTo(s * 0.68, s * 0.62);
    c.closePath();
    c.fill();
    c.fillStyle = "#fff3b0";
    c.beginPath();
    c.moveTo(0, -s * 0.92);
    c.lineTo(s * 0.22, -s * 0.4);
    c.lineTo(0, -s * 0.52);
    c.lineTo(-s * 0.22, -s * 0.4);
    c.closePath();
    c.fill();
  },
};
```

**3c — the driver.** One function, five beats, only the outline varies.

```js
/* The cabinet five-beat: form shadow offset down-right (opposite the frozen
   warm key), RIM seal, body, upper-left sheen, one accent. A glyph in a
   well() is not standing on a floor, so beat 1 is a form shadow, not a
   contact ellipse. `time` is kept in the signature: every call site passes
   it and the idle echo lives in drawItemBody, not here. */
export function drawIcon(c, type, col, time) {
  const shape = ITEM_SHAPE[type];
  if (!shape) return;
  const s = CFG.TILE * 0.3,
    path = poly(shape);
  c.save();
  c.lineJoin = "round";
  c.lineCap = "round";
  path(c, s, 1, s * 0.07, s * 0.09);
  c.fillStyle = dk(col, 0.58);
  c.fill();
  path(c, s, 1, 0, 0);
  seal(c);
  c.fillStyle = col;
  c.fill();
  path(c, s, 0.62, 0, -s * 0.1);
  c.fillStyle = lt(col, 0.34);
  c.fill();
  ITEM_ACCENT[type](c, s, col);
  c.restore();
}
```

`rr` stays exported — `sprites.js` and `menudraw.js` still use it.

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/items-art.test.mjs tests/pickups.test.mjs tests/enemies-art.test.mjs tests/menudraw.test.mjs tests/touch.test.mjs
```

Expected: all green, all four existing suites with **zero edits** — `pickups.test.mjs`'s `>=3` paints and distinctness gates only get easier, `touch.test.mjs`'s `stampBombIcon` `#ff5d73` fill still lands (it is beat 3's `col`).

- [ ] **Step 5: PWA bump + commit**

Bump `CACHE_NAME` + `REV` together, `current vN → vN+1`.

```bash
git add src/render/icons.js tests/items-art.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Rebuild all twelve pickup glyphs on the cabinet five-beat.

Form shadow, RIM seal, body, upper-left sheen, one accent — the same stack
the foes run. The eight flat outlines are the shared 2D/3D plan table.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `drawItemBody` family chrome + the 2D idle echo

**Files:**
- Modify: `src/render/sprites.js` — `drawItemBody` (lines 224–243), add `drawItemChrome`
- Modify: `tests/items-art.test.mjs` — add §4.7–4.8
- Modify: `MEMORY.md`, `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `CFG`, `ITEM_FAMILY`, `drawIcon`
- Produces: `export function drawItemChrome(c, fam, t, ph)`; `drawItemBody(c, world, it)` with family chrome + the family idle echo

- [ ] **Step 1: Write the failing tests** — extend the `sprites.js` import to `import { drawItemBody, drawItemChrome, drawPlayerBody } from "../src/render/sprites.js";`, then insert before the `console.log` summary

```js
{
  const chrome = {};
  for (const fam of ["cap", "vit", "utl", "bls"]) {
    const c = stub();
    drawItemChrome(c, fam, 0, 0);
    chrome[fam] = JSON.stringify(c._ops);
  }
  const vals = Object.values(chrome);
  check("four distinct family chrome signatures", new Set(vals).size === 4);
  const byKind = {};
  for (const t of IDS) {
    const c = stub();
    drawItemChrome(c, ITEM_FAMILY[t], 0, 0);
    byKind[t] = JSON.stringify(c._ops);
  }
  const wrong = IDS.filter((t) => byKind[t] !== chrome[ITEM_FAMILY[t]]);
  check("kinds inside one family share a chrome signature", !wrong.length, wrong.join(" "));
  const noDisc = [];
  for (const t of IDS) {
    const c = stub();
    drawItemBody(c, { time: 0 }, { t, col: "#ffffff", x: 0, y: 0 });
    const disc = c._ops.some(
      (o) => o[0] === "arc" && Math.abs(o[3] - CFG.TILE * 0.34) < 1e-6,
    );
    if (!disc) noDisc.push(t);
  }
  check("base disc present for all 12", !noDisc.length, noDisc.join(" ") || "ok");
  const dashed = [];
  for (const fam of ["cap", "vit", "utl", "bls"]) {
    const c = stub();
    drawItemChrome(c, fam, 0, 0);
    if (names(c._ops).includes("setLineDash")) dashed.push(fam);
  }
  check("no setLineDash anywhere in the chrome", !dashed.length, dashed.join(" ") || "ok");
}

{
  const still = [],
    slotty = [],
    unstable = [];
  for (const t of IDS) {
    const a = stub(),
      b = stub();
    drawItemBody(a, { time: 0 }, { t, col: "#ffffff", x: 80, y: 120 });
    drawItemBody(b, { time: 0.5 }, { t, col: "#ffffff", x: 80, y: 120 });
    if (JSON.stringify(a._ops) === JSON.stringify(b._ops)) still.push(t);
    const c1 = stub(),
      c2 = stub();
    drawItemBody(c1, { time: 0.3 }, { t, col: "#ffffff", x: 80, y: 120 });
    drawItemBody(c2, { time: 0.3 }, { t, col: "#ffffff", x: 80, y: 120 });
    if (JSON.stringify(c1._ops) !== JSON.stringify(c2._ops)) unstable.push(t);
    const d1 = stub(),
      d2 = stub();
    drawItemBody(d1, { time: 0.3 }, { t, col: "#ffffff", x: 80, y: 120 });
    drawItemBody(d2, { time: 0.3 }, { t, col: "#ffffff", x: 200, y: 40 });
    if (JSON.stringify(d1._ops) === JSON.stringify(d2._ops)) slotty.push(t);
  }
  check("idle echo is live (t 0 vs 0.5 differ)", !still.length, still.join(" ") || "ok");
  check("same kind at same (x,y) is identical", !unstable.length, unstable.join(" ") || "ok");
  check("phase comes from grid position, not slot", !slotty.length, slotty.join(" ") || "ok");
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/items-art.test.mjs
```

Expected: FAIL — `drawItemChrome is not a function`, and "phase comes from grid position" fails because today's `drawItemBody` reads only `world.time`.

- [ ] **Step 3: Implement**

In `src/render/sprites.js`, extend the `icons.js` import to `import { drawIcon, rr, RIM, ITEM_FAMILY } from "./icons.js";` (keep the existing re-export line intact — `tests/pickups.test.mjs:551-561` pins `drawIcon` identity), then replace `drawItemBody` (lines 224–243) with:

```js
/* The ring language a player learns in REAL 3D has to be recognisable in
   CLASSIC 2D, which has no additive ring at all — so the old double it.col
   ring (which only restated the hue the body already states) becomes the
   family echo. Dashes are arcs: the headless stub has no setLineDash. */
export function drawItemChrome(c, fam, t, ph) {
  const T = CFG.TILE;
  if (fam === "cap") {
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, T * 0.36, 0, 7);
    c.stroke();
    return;
  }
  if (fam === "vit") {
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, T * 0.3, 0, 7);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, T * 0.42, 0, 7);
    c.stroke();
    return;
  }
  if (fam === "utl") {
    c.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      c.beginPath();
      c.arc(0, 0, T * 0.38, a, a + Math.PI / 5);
      c.stroke();
    }
    return;
  }
  c.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(9 * t + ph));
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(0, 0, T * 0.33, 0, 7);
  c.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    c.beginPath();
    c.moveTo(Math.cos(a) * T * 0.36, Math.sin(a) * T * 0.36);
    c.lineTo(Math.cos(a) * T * 0.46, Math.sin(a) * T * 0.46);
    c.stroke();
  }
}
export function drawItemBody(c, world, it) {
  const T = CFG.TILE,
    t = world.time || 0,
    fam = ITEM_FAMILY[it.t] || "cap";
  /* slot is a compaction index, so collecting one pickup re-indexes its
     neighbours and their animation jumps. Grid phase is stable and is the
     same number the 3D update() writes. */
  const ph = (it.x * 0.7 + it.y * 1.3) / T;
  if (fam === "cap") {
    const k = 1 + 0.07 * Math.sin(3 * t + ph);
    c.scale(k, k);
  } else if (fam === "vit") c.translate(0, 1.8 * Math.sin(2.4 * t + ph));
  else if (fam === "utl") c.rotate(0.1 * Math.sin(7 * t + ph));
  c.fillStyle = "rgba(8,12,24,0.92)";
  c.beginPath();
  c.arc(0, 0, T * 0.34, 0, 7);
  c.fill();
  c.strokeStyle = it.col || "rgba(255,255,255,0.25)";
  c.globalAlpha = 0.85;
  drawItemChrome(c, fam, t, ph);
  c.globalAlpha = 1;
  drawIcon(c, it.t, it.col, t);
}
```

`drawItems` (lines 244–252) is unchanged — it already `save`/`translate`/`restore`s per item, so the echo transforms stay local.

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/items-art.test.mjs tests/pickups.test.mjs tests/enemies-art.test.mjs tests/r3d.test.mjs tests/menudraw.test.mjs tests/touch.test.mjs
```

Then the full battery:

```bash
node --test
```

Expected: all green, zero edits to any suite other than `tests/items-art.test.mjs`. `r3d.test.mjs` counts painter invocations only, so the legacy iso renderer picks the new body up for free.

- [ ] **Step 5: Headed loop (P1 scope) — §5, ITEMS / HOW TO / HUD / touch**

Unregister the service worker and delete its caches first; a stale SW is indistinguishable from a change that did not land.

```bash
node serve.js
# then, in the browser: DevTools > Application > Service Workers > Unregister,
# Storage > Clear site data, hard reload http://127.0.0.1:8080/index.html
```

Score these lines pass/fail and fix until every one passes:

- [ ] ITEMS well at 16px: all 12 glyphs separable — **and each one nameable in one second without its label** (spec §5 line 14; this is the line the user applied)
- [ ] HUD chips at 14px: HEART / BOMB / FLAME separable
- [ ] HOW TO PLAY rows: bomb / throw / remote / kick glyphs read
- [ ] touch bomb pad still reads as BOMB
- [ ] 2D board: family is readable from the chrome alone — hairline / double / dashed / spiked
- [ ] The four idle rhythms are distinguishable when two families sit side by side

- [ ] **Step 6: PWA bump, MEMORY, commit**

Bump `CACHE_NAME` + `REV` together, `current vN → vN+1`. Append to `MEMORY.md` under a `## 2026-09-05 — Pickup glyphs rebuilt on the cabinet five-beat` heading (newest first, 1–2 lines): what moved into `icons.js`, that `enemies-art.test.mjs` stayed green with zero edits, and that the family chrome + grid phase replaced the hue-restating double ring.

```bash
git add src/render/sprites.js tests/items-art.test.mjs MEMORY.md src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Give pickups family chrome and a grid-phased idle echo in CLASSIC 2D.

The double it.col ring only restated the hue the body already states; it is
now the 2D echo of the four 3D ring profiles, phased off grid position so
collecting a neighbour no longer makes an item jump.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
