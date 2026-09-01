# Design — Cinematic Intro + Menu System (rollblock)

**Date:** 2026-08-23
**Status:** v1 — ready for cold execution (user-locked decisions baked in; see §0)
**Scope:** app-level shell only. Zero changes to `src/core/sim.js` logic,
`src/net/`, or determinism. New code lives in `src/app/` + `src/render/menudraw.js`
plus small wiring edits in `main.js`, `scenes.js`, `audio.js`.

## 0. Locked decisions

1. **Intro**: animated logo reveal → dimetric arena flyover/camera drop → settles
   into MENU. Any key/click skips. Total ≈5.0 s (bounded 4–6 s).
2. **Menu items** (keyboard cursor): Start Game · Level Select (1–5) · Render
   2D/3D toggle · Sound On/Off toggle · How to Play · High Scores.
3. **Art direction**: minimal-modern — typographic hierarchy, whitespace, subtle
   eases/fades/slides. NO scanlines/CRT. Sits on the existing page background;
   palette restricted to `#37f0d0` (accent), `#dfe7f5` (text), `#7385ad`
   (muted), panel washes of `rgba(7,10,18,α)` matching `--bg`.
4. **Audio**: intro jingle + cursor blip + confirm tone via `beep()` extension.
   No music loop.

Non-goals: mouse hover navigation (pointerdown = confirm only), gamepad, touch
layouts, settings persistence beyond sound flag (localStorage), i18n, animated
menu backgrounds other than the frozen arena.

## §1 Flow & app state machine

The **sim's `world.state` is untouched** (`MENU PLAY WIN LOSE PAUSE`). A new
**app machine** owns the shell. States:

```
BOOT → INTRO → MENU ⇄ LEVEL | HOWTO | SCORES
                 └→ GAME(=hand off to world: PLAY/WIN/LOSE/PAUSE)
```

| State | Meaning | World stepped? |
|---|---|---|
| `BOOT` | one-frame init (canvas sizing, audio lazy) | no |
| `INTRO` | cinematic; world exists frozen as backdrop | no |
| `MENU` | main menu over dimmed frozen arena | no |
| `LEVEL` | level-select subscreen | no |
| `HOWTO` | controls screen | no |
| `SCORES` | high-score table | no |
| `GAME` | previous behavior verbatim: `step()` runs, WIN/LOSE/PAUSE overlays via `drawOverlay` | yes |

**Transitions**

- `BOOT→INTRO` immediate. `?play=1` short-circuits `BOOT→GAME` (flag kept working).
- `INTRO→MENU` at t≥INTRO_DUR or on skip (any key / pointerdown). 0.25 s fade-out.
- `MENU`: Up/Down move cursor; confirm dispatches per item:
  - Start Game → `GAME` (fresh run: `loadLevel(w, app.level, false)`, `w.score=0`,
    `w.state="PLAY"`).
  - Level Select → `LEVEL`; How to Play → `HOWTO`; High Scores → `SCORES`.
  - Render toggle flips `app.render3d` **live** (rebuild renderer with new kind —
    see §7) without leaving MENU. Sound toggle flips `audio.toggle()` +
    `app.sound` flag.
  - `Escape`/`Backspace` in subscreens → `MENU`.
- `LEVEL`: Left/Right move slot (1–5, clamped, no wrap), confirm → start at that
  level (`GAME`), Esc → `MENU`. Confirming here also makes it the default for
  later Start Game selections within the session.
- `GAME→MENU` paths:
  - **PAUSE**: `P`/`Escape` resume (unchanged); **new:** `M` while PAUSED =
    quit-to-menu — records a high score if `score>0`, then `MENU`. Arena stays
    frozen behind the menu until next start reloads it.
  - **LOSE**: `FIRE` retry keeps current sim behavior (restart at level 1, score
    reset) — no menu round-trip. High score recorded at the PLAY→LOSE edge
    (below).
  - No new route from WIN (auto-advance chain unchanged; levels >5 keep
    generating via biome cycle — Level Select only picks the *starting* level).
- **Score-record edge** (app-level, frame-polled, pure): snapshot
  `prevWorldState` each frame; on `PLAY|WIN → LOSE` call
  `recordScore({s:world.score, l:world.level, d:dateStr()})`. Same hook fires
  for the PAUSE→`M` quit. Nothing else observes world internals.

**Sim `MENU` state disposition: obsolete-but-harmless — KEPT, not deleted.**
Rationale: `main.js` simply stops ever assigning `world.state="MENU"` (boot now
creates the world with `state="PLAY"` but never steps it until handoff). The
`step()` MENU/WIN/LOSE fire-edge branches remain reachable for WIN/LOSE and dead
for MENU; deleting the branch would churn `core/` + existing sim tests for zero
behavioral gain. Existing tests that assert `reset()`/`begin()` semantics keep
passing because those debug hooks are re-pointed at the app machine (§7).

**Determinism rule:** no app field (`screen`, `cursor`, `t`, toggles) is ever
read by `step()`/`world`/protocol. The frozen backdrop world is byte-identical
to a freshly loaded level; replay validity is unaffected.

## §2 Screen-by-screen layouts

All coordinates are **normalized** `(u,v) ∈ [0,1]² × W,H` resolved by one shared
helper so 2D (600×520) and 3D (608×352) derive identically:

```js
// menudraw.layout(W,H) → frozen {
//   cx:W/2, top:H*0.16, logoCy:H*0.27, logoScale:(H/520)*1.0 clamp[0.72,1.0],
//   itemsY:H*0.50, itemH:Math.round(H*0.075) clamp[24,34],
//   footY:H-20, chipW:44, chipGap:14, tableY:H*0.42, rowH:H*0.055 }
```

Fonts: `900 Npx ui-monospace,monospace` for headings (same stack as
`drawLogo`/`drawOverlay`), `12–13px` body, `11px` footer. Text always
`textAlign:"center"` unless noted. Panel wash where specified:
`fillStyle="rgba(7,10,18,0.72)"` rounded rect (plain `fillRect` acceptable v1).

### INTRO (drawn OVER the live arena render)

Backdrop: the real arena rendered full-canvas (either kind) under a
flyover transform (§3), plus `drawDim(c, α)` black veil whose α animates
0.55→0.18 during flyover, →0.62 as it settles into MENU.

Beats (nominal 5.0 s):

| t (s) | Beat |
|---|---|
| 0.00–0.90 | Logo reveal: "FUSE" fades/slides down 14px (easeOutCubic), "GRID" wipes in via per-letter alpha stagger 60 ms + scale 0.92→1 (easeOutBack). Jingle fires at t=0.15. |
| 0.90–1.50 | Logo hold (static). |
| 1.40–4.20 | Flyover: arena zoom 1.55→1.18, camera drift from board lower-third to center (easeInOutCubic on both), veil α 0.55→0.18. Logo exits upward 20px + fade (easeInCubic, 1.40–1.90). |
| 4.20–5.00 | Settle: zoom→1.00 easeOutCubic; veil→0.62; tagline "PRESS ENTER" fades in at `footY` (blinking 1 Hz). |
| ≥5.00 or skip | 0.25 s fade-to-MENU (veil→0.72, menu staggers in per §3). |

Skip hint: bottom-right, 10px muted "ANY KEY TO SKIP", appears from t=0.6.
Flyover transform applies to the **arena render only** (`ctx.save(); translate/
scale; renderer.render(); ctx.restore()` — legal: renderer saves/restores
internally relative to the outer transform; zoom ≥1 so no edge gaps; 2D kind
uses the identical transform so the intro is kind-independent by construction,
and `?render=3d` automatically yields the dimetric flyover).

### MAIN MENU

- Frozen arena backdrop, veil α 0.62.
- Logo: reuse `drawLogo(c,time,cx,logoCy)` at `logoScale` via `ctx.scale`.
- Items (centered column at `itemsY`, spacing `itemH`), in order, value part in
  accent when applicable:
  `START GAME` · `LEVEL SELECT` · `RENDER <2D|3D>` · `SOUND <ON|OFF>` ·
  `HOW TO PLAY` · `HIGH SCORES`
- Cursor: 10px `▸` accent glyph at `cx − maxItemW/2 − 14`, selected item `#dfe7f5`
  full alpha, others `#7385ad`. No per-item boxes/borders (minimal-modern).
- Footer (`footY`, 11px muted): `↑↓ MOVE · ENTER SELECT · ESC BACK` — Esc line
  omitted on MENU root.

### LEVEL SELECT

Header `SELECT LEVEL` (20px, y=`top`) over veil α 0.72; row of five chips
(`chipW`×34, gap `chipGap`, centered at `itemsY`): number `1–5` centered, chip
border 1px `#26324a`; selected chip border+text accent. Below chips (13px):
`ENTER START · ←/→ CHOOSE · ESC BACK` at `footY`. Confirm starts the run.

### HOW TO PLAY

Veil α 0.72. Header `HOW TO PLAY` at `top`. Body block (left-aligned within a
centered 420px column starting `itemsY−10`, line-height `itemH*0.8`, 12px),
verbatim control rows mirroring the page `.hint`: move / bomb / throw* /
remote* / kick* / pause, asterisk footnote `*needs its power-up`, plus goal
line `clear every enemy to advance · collect power-ups` (accent-muted).
Footer: `ESC / ENTER BACK`.

### HIGH SCORES

Veil α 0.72. Header `HIGH SCORES` at `top`. Table centered at `tableY`,
`rowH` rows, columns `RANK SCORE LEVEL DATE` (header row muted 11px; data 13px,
score right-padded, date `YYYY-MM-DD`). Rank 1 score tinted accent. Footer:
`ESC BACK`. Table shows the seeded defaults when empty (§6).

## §3 Motion design

All timings in ms; helpers in `menudraw.js`:

```js
const easeOutCubic=t=>1-Math.pow(1-t,3);
const easeInCubic=t=>t*t*t;
const easeInOutCubic=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const easeOutBack=t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);};
const clamp01=t=>Math.max(0,Math.min(1,t));
const seg=(t,a,b)=>clamp01((t-a)/(b-a));   // progress of t within [a,b] (seconds)
```

| What | Curve / duration |
|---|---|
| Intro logo in | fade easeOutCubic 500ms; slide 14px easeOutCubic; letter scale easeOutBack 450ms |
| Letter stagger | per-letter delay 60ms, LTR across "GRID" |
| Flyover zoom/drift | easeInOutCubic over seg(1.40,4.20) |
| Settle | easeOutCubic 800ms |
| Skip fade | linear 250ms veil ramp |
| Menu enter | items stagger: slide-up 8px + fade, 220ms each, 30ms/item delay, easeOutCubic; runs once per MENU entry (`enterT`) |
| Cursor move | instant position swap (audio blip is the feedback) |
| Screen push/pop (MENU⇄sub) | outgoing content fade 120ms, incoming fade 160ms, easeOutCubic |
| Toggle flip | value text swaps instantly; 120ms accent flash on value |
| Blink (PRESS ENTER / hints) | α = 0.55+0.45*sin(2π·t) — render-time only |

Nothing eases with spring physics beyond easeOutBack-on-logo. No motion loops
other than the blink and the existing `world.time` bob (frozen world ⇒ static,
acceptable).

## §4 Input map

Routing lives in ONE place: `main.onPause` becomes `onShellKey(code)` which
asks the app machine first:

| Code | INTRO | MENU | LEVEL | HOWTO | SCORES | GAME/PAUSE |
|---|---|---|---|---|---|---|
| ArrowUp/KeyW | skip | cursor −1 | — | — | — | move (sim) |
| ArrowDown/KeyS | skip | cursor +1 | — | — | — | move (sim) |
| ArrowLeft/KeyA · Right/KeyD | skip | — | slot ∓1 (clamped) | — | — | move (sim) |
| Space/Enter*/KeyJ/KeyX | skip | confirm | confirm=start | back | back | fire (sim) |
| Escape | skip | — (root) | back | back | back | pause-toggle (via existing onPause path) |
| Backspace | skip | — | back | back | back | — |
| KeyM | — | — | — | — | — | PAUSE only: quit→MENU |

`Enter` is menu-only (not a game fire key — `Input` is untouched; the app reads
`e.code` through a new tiny listener, see below). `P` retains pause semantics
in GAME.

- **Mechanism:** `Input` gains a passive side-channel, NOT new intent fields:
  `input.onUiKey = fn` invoked from `_onKey` for every keydown **before** the
  game switch (fn receives `e.code`; game codes still `preventDefault` as
  today). In GAME states `onUiKey` is null/no-op so play input is untouched.
- **Cursor repeat:** app-side, driven by `update(dt)` reading the live held
  flags via `input.input.{up,down,left,right}` (public getter). First repeat
  after **350 ms** hold, then every **110 ms**; releasing resets. Diagonals
  impossible (Input axis logic already exclusive).
- **Fire-edge discipline:** app keeps `prevConfirm`; confirm fires only on
  rising edge (prevents Space-hold auto-starting the game).
- **Focus/back stack:** explicit two-level stack only (MENU ↔ one subscreen);
  `back()` pops or no-ops at root. No deeper nesting exists.
- Pointer: canvas `pointerdown` during non-GAME states = skip (INTRO) or
  confirm (elsewhere); routed through the same `confirm()/skip()` API. Existing
  `_onFireDown` mapping to `intent.fire` is irrelevant outside GAME (no steps).

## §5 Audio cue sheet

Extend `createAudio().play(name)` switch (all via existing `beep(freq,dur,type,vol)`):

| Event (event name) | Params |
|---|---|
| Intro jingle (`uiJingle`) at intro t=0.15 | `[392,523,659,784].forEach((f,i)=>setTimeout(()=>beep(f,0.16,"square",0.11),i*120))` + closing `beep(1046,0.30,"triangle",0.10)` at 480ms |
| Cursor move (`uiMove`) | `beep(520,0.05,"square",0.06)` |
| Confirm (`uiSel`) | `beep(880,0.08,"square",0.10)` + `setTimeout(()=>beep(1318,0.10,"square",0.09),70)` |
| Back (`uiBack`) | `beep(300,0.08,"triangle",0.08)` |
| Toggle (`uiTog`) | `beep(700,0.06,"square",0.08)` |
| Denied/no-op (unused v1, reserved) | `beep(180,0.09,"square",0.07)` |

Rules: cues fire from the app layer only (never from render code); every cue
respects `muted` automatically via `beep`; Sound OFF also silences the jingle
(check `muted` before scheduling timeouts — guard inside `play`).
Game-event sounds (`bomb/boom/win/lose/...`) unchanged.

## §6 Persistence — high scores

Module `src/app/highscores.js`, pure & Node-importable; storage injected
(default: guarded localStorage).

```js
export const HS_KEY="nb.highscores.v1";
export const DEFAULT_SCORES=[{s:5000,l:5},{s:3800,l:4},{s:2900,l:4},{s:2200,l:3},
  {s:1700,l:3},{s:1250,l:2},{s:900,l:2},{s:600,l:1},{s:400,l:1},{s:250,l:1}]
  .map(r=>({...r,d:"2026-08-23"}));          // frozen at module load
export function loadScores(store)            // parse HS_KEY; ANY failure (missing,
  // bad JSON, non-array, malformed rows) → return DEFAULT_SCORES copy; never throws
export function recordScore(list,entry)      // append, sort by s desc then l desc
  // then d asc, slice 10; returns NEW array (no mutation)
export function qualifies(score,list)        // score > last.s || list.length<10
export function saveScores(list,store)       // best-effort write; try/catch swallow
```

- Storage accessor: `typeof window!=="undefined" && window.localStorage` inside
  try/catch (private-mode Safari throws on access). Tests pass a Map-backed
  fake store `{getItem,setItem}`.
- Schema: JSON array of `{s:number, l:number, d:"YYYY-MM-DD"}`, newest-run
  sorted by score. **No migration path needed**: key is versioned (`.v1`);
  anything unreadable falls back to defaults (self-healing, migration-free by
  contract). Date from `new Date().toISOString().slice(0,10)` — app layer only,
  never sim.
- Record points: PLAY→LOSE edge; PAUSE→`M` quit (if score>0). Not on WIN
  (run continues) and not on `btnRestart` quick-restart (documented lossy edge;
  acceptable v1).

## §7 File layout & integration

New modules (all zero-dep, DOM-guarded, Node-importable):

```
src/app/intro.js       — timeline model only.
  export const INTRO_DUR=5.0;
  export function introPhase(t) -> {zoom, camX, camY, veil, logoP, tagP, done}
    (pure; all easing math lives here; t in seconds, clamped past DUR)
  export function createIntro() -> {t:0, update(dt), skip()}   // thin mutable wrapper

src/app/menuapp.js     — THE app state machine (pure logic, no canvas).
  export const SCREEN=Object.freeze({BOOT:0,INTRO:1,MENU:2,LEVEL:3,HOWTO:4,SCORES:5,GAME:6});
  export const ITEMS=Object.freeze(["START GAME","LEVEL SELECT","RENDER","SOUND",
    "HOW TO PLAY","HIGH SCORES"]);
  export function createMenuApp(opts={level:1,sound:true,render3d:false,
    audio:null,onStart:null}) ->
    { screen, cursor, level, sound, render3d, subT (state timer), repT/repDir,
      prevConfirm,
      update(dt, input),          // dt seconds; reads held axes + confirm edge
      key(code),                  // discrete keys (Enter/Esc/Backspace/M/arrows-as-tap fallback)
      confirm(), back(), skip(), move(dir),
      startRun(),                 // builds run args, calls opts.onStart(level)
      noteWorldEdge(prevSt,st,scores) }   // §1 score-record edge; pure given inputs

src/app/highscores.js  — §6 exports.

src/render/menudraw.js — ALL menu pixels (pure draw; takes ctx + plain data).
  export function layout(W,H)
  export function drawIntroChrome(c,t,W,H)         // logo reveal, veil, tagline, skip hint
  export function drawMenu(c,ui,L,t)               // ui={cursor,items values,enterT}
  export function drawLevelSelect(c,sel,L,t)
  export function drawHowTo(c,L,t)
  export function drawScores(c,scores,L,t)
  export function drawDim(c,alpha,W,H)
  export function drawFade(c,k,W,H)                // skip/settle 0.25s fades
```

Edits to existing files (small, enumerated):

1. **`src/main.js`** — owns the shell loop:
   - Parse flags once (`is3d` as today); add `createMenuApp({onStart})`;
     `onStart(args)` performs `loadLevel(world,args.level,false); world.score=0;
     world.state="PLAY"` and stores `app.inGame=true`.
   - Boot: world created exactly as today but **never** forced to `"MENU"`
     (leave `"PLAY"` from `loadLevel`; it is simply not stepped outside GAME).
     Remove the `world.state="MENU"` assignment at line 16 and in `reset()`
     (debug `reset()` → app.toMenu()).
   - Loop branch: `if(app.screen===GAME){ …fixed-step sim exactly as today… }`
     else `{ app.update(dt,input); }` — then render:
     `ctx.save(); apply introPhase transform if INTRO; renderer.render(world,dt);
     ctx.restore();` then `menudraw.draw<X>` per screen; `renderer.render` still
     drains events/fx so a frozen world stays visually stable and WIN/LOSE
     overlays keep working inside GAME.
   - `onPause` extended: if PAUSE && code==="KeyM" → `noteWorldEdge` + app→MENU;
     else existing toggle.
   - Render toggle rebuild: dispose old renderer (`stop()` rAF flag already
     exists; simplest: keep one renderer per kind lazily cached
     `{ "2d":r2, "3d":r3 }` — both share the canvas; `bakeAtlas` idempotent) and
     resize canvas W/H per kind before render.
   - `__GAME__` (debug): add `app` ref; `state()` returns `app.screenName()`
     when not in GAME else `world.state`; `begin()` → `app.startRun()`.
   - High-score wiring: on LOSE edge / M-quit call `noteWorldEdge`, then
     `saveScores(recordScore(loadScores(store),entry),store)`.
2. **`src/input.js`** — add `this.onUiKey=null;` and in `_onKey` first line:
   `if(this.onUiKey)this.onUiKey(e.code);` (before the switch; no behavior
   change when unset).
3. **`src/audio.js`** — add the six §5 cases to `play()`; no signature change.
4. **`src/render/scenes.js`** — no change required (its `MENU` branch becomes
   dead-but-harmless alongside sim's; WIN/LOSE/PAUSE still used).
5. **`index.html`** — no markup change (HUD/buttons/hint remain; accepted v1
   that page chrome is visible during INTRO/MENU).

## §8 Testing strategy

Headless (`node --test`, no DOM; stub canvas only where a draw smoke is needed):

| File | Covers |
|---|---|
| `tests/menuapp.test.mjs` | transitions incl. skip paths (`?play=1` equivalent via `startRun`), cursor wrap/clamp, LEVEL slot clamp, confirm edge (held Space ≠ double-confirm), back-stack, repeat-rate timing (advance update() by synthetic dt: first repeat 350ms, cadence 110ms), toggle flags flip, M-quit only from PAUSE, `noteWorldEdge` records exactly once on PLAY→LOSE |
| `tests/highscores.test.mjs` | defaults when empty; corrupt JSON/garbage/non-array → defaults; sort+trim to 10; tie-break order; immutability of `recordScore`; Map-store round-trip |
| `tests/intro.test.mjs` | `introPhase` continuity/monotonicity (zoom single-minimum, veil endpoints 0.55/0.18/0.62), `done` at DUR, `skip()` jumps to done, total duration == 5.0 (bounds 4–6 asserted) |
| `tests/renderer.test.mjs`(extend or new smoke) | `layout()` sane for BOTH 600×520 and 608×352 (all fields ints in-range); Proxy-stub-canvas smoke: `drawMenu/drawScores/...` execute without throw on noop ctx (pattern already proven in r3d suite) |

Manual-only (browser via `npm start`): visual composition both kinds; jingle/blip
timbre; skip feel; `?render=3d` flyover framing; focus/blur quirks; pointer-skip.

Not tested (explicit): pixel positions beyond layout sanity; audio output;
localStorage browser quirks.

## §9 Acceptance criteria

1. Fresh load (no flags) shows INTRO ≈5 s: logo reveal → flyover → MENU, no console errors.
2. Any key/click during INTRO skips immediately to MENU with ≤250 ms fade.
3. `?render=3d` + no other flags: intro flyover renders the dimetric arena; menu overlays correctly on 608×352.
4. Default 2D: menu overlays correctly on 600×520; identical structure/proportions per `layout()`.
5. All six menu items present, navigable with Arrows/WASD (wrap-around), selectable with Enter/Space/J/X.
6. Cursor repeat: single tap = 1 move; hold = move after 350 ms then 110 ms cadence.
7. Render toggle switches arena backdrop between kinds live, without reload; canvas resizes.
8. Sound toggle mutes/unmutes menu cues AND game SFX (single `audio.toggle()`).
9. Level Select starts a run at the chosen level 1–5 (HUD LV matches).
10. How to Play lists all controls incl. power-gated ones; Esc/Enter returns.
11. High Scores shows top-10 (defaults on first run); finishing a run (death) inserts `{score,level,date}` sorted desc, trimmed to 10; survives reload via `nb.highscores.v1`; corrupted storage self-heals to defaults.
12. `M` in PAUSE returns to MENU (recording score if >0); `P`/`Esc` in PAUSE still resume; LOSE+FIRE still retries directly.
13. `?play=1` boots straight into PLAY (no intro/menu); `?debug=1` exposes `__GAME__.app` and `state()` reflects shell.
14. Zero new dependencies; no external fonts/images; no DOM access at module top level of any new file (all imports pass `node --test`).
15. `grep`-verifiable purity: no `app.`/`screen`/`cursor` references inside `src/core/**`; `git diff src/core/` limited to (at most) the removed boot `"MENU"` assignment in callers — sim logic untouched.
