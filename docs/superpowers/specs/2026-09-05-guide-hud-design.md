# GUIDE + HUD strip — design (2026-09-05)

Two asks, one pass. The menu list has three arrows (HOW TO PLAY / ITEMS /
ENEMIES) sitting at the same level as PLAY and OPTIONS — user's words: "put
those three part in one sub page in order to make clean the game menu and
make it more mature." Separately, the page ships a full HTML `#hud` strip
directly under a canvas that already draws its own HUD chips — user's words:
"is this necessary? if it does not, let's remove it." It does not: every
fact in `#hud` except two (`LV`, `ENEMIES`) is already painted by
`drawHudChips`. The strip goes, its two unique facts migrate into the
canvas row, and the three help screens fold under one `GUIDE` row.

This explicitly **reverses** the 2026-09-05 S3 decision recorded in
`MEMORY.md` ("`#hud` is now gated to `SCREEN.GAME`") and the settings-menu
spec's "keep, gated" verdict for `#hud` — that was the right call before a
controller ruling asked for full removal; it is superseded now, by direct
instruction, not by drift. It also **overturns** that same settings-menu
spec's "No HELP hub" refusal (folding HOW TO / ITEMS / ENEMIES was refused
there as adding a SCREEN + draw fn + back-stack "to shorten a list already
inside norms at 8"). Both refusals were correct answers to a different
question; this session's question is "make the menu cleaner," asked
directly by the user and ruled on by the controller, which is exactly the
class of instruction those refusals reserved room for.

## Locked decisions

### 1. Menu IA

`ITEMS` drops from 8 entries to 6, frozen, in this order:

| # | Row | Confirm | Note |
|---|---|---|---|
| 0 | `PLAY` | `startRun()` | unchanged |
| 1 | `LEVEL SELECT` | `_push(LEVEL)` | unchanged |
| 2 | `OPTIONS` | `optRow=0; _push(SETTINGS)` | unchanged — cursor index **also** unchanged (still 2) |
| 3 | `GUIDE` | `guideRow=0; _push(GUIDE)` | new — replaces the HOW TO PLAY / ITEMS / ENEMIES rows |
| 4 | `HIGH SCORES` | `_push(SCORES)` | moved from cursor 6 |
| 5 | `SOURCE` | `onSource()` | moved from cursor 7 |

`SCREEN.GUIDE = 11`, appended after `SETTINGS:10` — never inserted, same
append-only discipline `SETTINGS` itself followed. `SCREEN.HOWTO`(4),
`SCREEN.ITEMS`(8) and `SCREEN.ENEMIES`(9) **do not move and do not get
renamed** — they are still real screens, reached one hop further down.
Nothing about their draw functions (`drawHowTo`/`drawItemsHelp`/
`drawEnemiesHelp`), their `SCREEN` values, or their existing tests changes.

`shellview.js`'s inline MENU items array shrinks from `ITEMS[0..7]` to
`ITEMS[0..5]` verbatim — no new value tokens, no reordering beyond what the
table above already encodes into `ITEMS` itself.

### 2. GUIDE screen (`SCREEN.GUIDE`)

A shell page following the HOWTO/ITEMS/ENEMIES scaffold (`shell` → `head` →
body → `foot`, `drawDim(0.72)`, `_push` transition reset, Esc/Backspace
back) — same chrome family, not the SETTINGS knob machinery, because GUIDE
rows aren't values to adjust, they're doors to open. Three rows, one new
frozen table:

```js
export const GUIDE_ROWS = Object.freeze(["HOW TO PLAY", "ITEMS", "ENEMIES"]);
```

Own cursor, `app.guideRow` (0–2), separate from `app.cursor` — same reason
`optRow` is separate from `cursor`: a round trip through GUIDE must never
disturb where the MENU list was left. Navigation mirrors MENU's own model
exactly, because GUIDE **is** architecturally a second flat list, not a
value-adjust page: `update()`'s dir computation folds
`SCREEN.GUIDE` into the same branch as `SCREEN.MENU` (`dir = up?-1:down?1:0`,
axis stays 0, wraps both directions), `move()` gets a `SCREEN.GUIDE` arm
identical in shape to the `SCREEN.MENU` one, and `_tapMove` gets the same
`!lat` guard MENU has. GUIDE does **not** join `SCREEN.MENU`'s idle→ATTRACT
accumulation — like every other subscreen (LEVEL, HOWTO, SETTINGS, SCORES),
it resets `idleT` to 0 every frame, so browsing GUIDE cannot itself trigger
ATTRACT.

Confirm dispatch, by `GUIDE_ROWS[this.guideRow]` (label-keyed, matching how
MENU already dispatches by `ITEMS[this.cursor]` rather than a raw index):

| `guideRow` | Row | Confirm |
|---|---|---|
| 0 | `HOW TO PLAY` | `_push(SCREEN.HOWTO)` |
| 1 | `ITEMS` | `_push(SCREEN.ITEMS)` |
| 2 | `ENEMIES` | `_push(SCREEN.ENEMIES)` |

**Back-stack renegotiation** (the one mechanic the ruling named but didn't
spell out): HOWTO / ITEMS / ENEMIES are no longer directly reachable from
MENU, so their `back()` target changes from `SCREEN.MENU` to
`SCREEN.GUIDE`. `back()`'s condition group splits in two:

```js
back() {
  if (this.screen===SCREEN.HOWTO||this.screen===SCREEN.ITEMS
      ||this.screen===SCREEN.ENEMIES)
    return this._push(SCREEN.GUIDE);
  if (this.screen===SCREEN.LEVEL||this.screen===SCREEN.SCORES
      ||this.screen===SCREEN.SETTINGS||this.screen===SCREEN.GUIDE)
    return this._push(SCREEN.MENU);
  return false;
}
```

`confirm()`'s existing `case SCREEN.HOWTO: case SCREEN.SCORES: case
SCREEN.ITEMS: case SCREEN.ENEMIES: return this.back();` group is untouched —
Enter-as-back on those four screens still just calls `back()`, which now
routes three of them one level shallower than before. `guideRow` is left
untouched by the round trip (nothing resets it on `back()` or `_push`), so
returning from ITEMS re-selects the ITEMS row in GUIDE — the natural,
already-idiomatic behavior, not new code.

**Decided, not specified by the ruling** (both because the alternative was
strictly more code for no behavioral gain, and because MENU is the closer
precedent than SETTINGS): no dedicated `guideHit` touch-precision helper.
MENU itself has no per-row tap hit-test — a canvas tap outside GAME/PAUSE
falls through to a flat `else app.confirm()` in `main.js`, acting on
whatever row is currently selected, for MENU **and** for every read-only
subscreen (HOWTO/ITEMS/ENEMIES/SCORES) alike. `settingsHit` exists only
because SETTINGS is a value-adjust page where a tap must be able to select
*and* act on an arbitrary row in one gesture. GUIDE is not that; it inherits
MENU's existing tap-confirms-current-row behavior for free, in
`shellview.js`'s and `main.js`'s catch-all branches, with no new code in
either.

Draw function, new export in `menudraw.js`:

```
drawGuide(c, L, t, cursor)
```

Following the HOWTO/ITEMS/ENEMIES/SETTINGS precedent of a private
`*Geom(L)` companion so the page can never draw a row its own layout math
disagrees with:

```js
export function guideGeom(L) {
  const S = shellBox(L, 480);
  const y0 = S.headY + 26, y1 = S.footY - 14;
  return { S, y0, rowH: (y1 - y0) / 3 };
}
```

`drawGuide` draws `shell(c,L,480)` + `head(c,S,"GUIDE","HOW TO · ITEMS ·
ENEMIES")`, then the three `GUIDE_ROWS` labels at `guideGeom`'s row centers
with the same selected-row treatment `drawSettings` already uses (accent
fill band + left accent bar + `caret`) minus the value column — there is
nothing to show on the right, only a door to open — then
`foot(c,S,"↑↓ ROW · ENTER OPEN · ESC BACK")`. `shellview.js` gets one new
branch in `drawShell`'s subscreen chain: `else if (s===SCREEN.GUIDE) {
drawDim(0.72); drawGuide(c,L,app.subT,app.guideRow); }`, same shape as every
sibling branch there.

### 3. HUD strip removal

Of `#hud`'s six facts (`SCORE`, `LV`, `LIVES`, `ENEMIES`, `BOMB`, `FLAME`),
four are already painted by `drawHudChips` on the canvas: `SCORE`
(right-aligned above the heat token), `LIVES` (as heart glyphs, capped at 6
with `+n` overflow), `BOMB` and `FLAME` (icon + label + count chips). Only
`LV` and `ENEMIES` (foes remaining) have no canvas equivalent. So:

- `index.html`'s `#hud` div (lines 97–104) is deleted entirely — the
  markup, its six child `<span>`/`<b id="…">` elements, and the CSS rules
  scoped to it (`#hud{…}`, `#hud[hidden]{…}`, `#hud b{…}`, `#hud .sep{…}`).
- `src/main.js`'s `hudEl` lookup (`document.getElementById("hud")`) and its
  one call site (`if (hudEl) hudEl.hidden = app.screen !== SCREEN.GAME;`)
  are deleted. `makeHud(dom)` / `updateHud(hud, world)` in
  `src/render/scenes.js` are **not** touched — they're a generic
  `{score,level,lives,enemies,bombs,range}` DOM-id contract exercised today
  by synthetic `dom` stubs in three tests (`three.test.mjs` S4.D/S5,
  `headless.test.mjs`'s `hud:false` block), none of which read the real
  `index.html`. With no `#hud` div in the page, `makeHud(document)` simply
  returns `{score:null,level:null,…}` at runtime (every `getElementById`
  miss) and `updateHud`'s `if (hud && hud[id])` guard already no-ops on
  that — dead but harmless, same as any renderer built with `hud:null`
  today. No code changes needed there beyond the deletions above.
- `drawHudChips` (`src/render/scenes.js`) gains two more chips, same
  `chip(x,w,label,count,col,icon)` helper, extended with an optional 6th
  `icon` param: falsy `icon` skips the `drawIcon` translate/scale block and
  starts label/count text at `x+10` instead of `x+31` (no icon column to
  clear). `col` still exists for the `chip` signature's sake but is unused
  when `icon` is falsy — LV/ENEMIES have no pickup glyph to tint, same as
  the existing SCORE column, which has never had an icon either.

Locked geometry — same 40px-tall band (`y 10..40`) the existing chips
share, extending it rightward with the same 8px gap BOMB→FLAME already
uses:

| Chip | x | w | span | Label | Value |
|---|---|---|---|---|---|
| BOMB (unchanged) | 140 | 76 | 140–216 | `BOMB` | `p.bombs` |
| FLAME (unchanged) | 224 | 82 | 224–306 | `FLAME` | `p.range` |
| **LV (new)** | **314** | **64** | **314–378** | `LV` | `world.level` |
| **ENEMIES (new)** | **386** | **94** | **386–480** | `ENEMIES` | `world.enemies.length` |

Board is 600px wide (`CFG.COLS*CFG.TILE`); SCORE's right edge sits at
`scx=588`. `480` to `588` leaves 108px clear for the heat-token+score
column, which is right-aligned text with no fixed left bound — comfortably
clear even for a 6-digit score. Widths scale from BOMB/FLAME's own
progression (`~6px` per label character beyond a `76px`/4-char baseline):
`LV` (2 chars) → `64`, `ENEMIES` (7 chars) → `94`. Labels are the exact
words `#hud` already used (`LV`, `ENEMIES`) — not invented abbreviations
(`FOES` never appears anywhere player-facing: not in the menu row, not in
the GUIDE row, not in the field-guide title), so nothing new to learn.
Values are plain numbers via `String(count)`, same as BOMB/FLAME — never a
combined `"LV 3"` string; label and value are always two separate
`fillText` calls in this row, and LV/ENEMIES keep that.

`drawHudChips` must read `world.enemies` and `world.level` defensively —
real `world` objects always carry both, but two existing test call sites
build minimal world literals missing one or both fields (see ABI table).
`world.enemies.length` becomes `(Array.isArray(world.enemies) ?
world.enemies.length : 0)`; `world.level` stays `world.level | 0`
(bitwise-or already coerces `undefined` to `0` with no throw, matching how
`world.lives`/`world.score` are already read in this function).

## ABI renegotiation

| Site | Today | New | Task |
|---|---|---|---|
| `menuapp.js` `SCREEN` | `…SETTINGS:10` | `+ GUIDE:11` (appended) | 1 |
| `menuapp.js` `ITEMS` | 8 entries | 6 entries, §1 table | 1 |
| `menuapp.js` new export | — | `GUIDE_ROWS` (3 entries) | 1 |
| `menuapp.js` app fields | `optRow` only | `+ guideRow: 0` | 1 |
| `menuapp.js` `update()` dir branch | `if (screen===MENU) dir=…` | `if (screen===MENU\|\|screen===GUIDE) dir=…` | 1 |
| `menuapp.js` `move()` | MENU arm only | `+` GUIDE arm (same shape) | 1 |
| `menuapp.js` `_tapMove()` | MENU arm only | `+` GUIDE arm (same shape) | 1 |
| `menuapp.js` `confirm()` MENU switch | `case "HOW TO PLAY"/"ITEMS"/"ENEMIES"` push their own screens | those three cases removed; `case "GUIDE"` added | 1 |
| `menuapp.js` `confirm()` screen switch | no `SCREEN.GUIDE` case | `+ case SCREEN.GUIDE:` dispatches by `GUIDE_ROWS` | 1 |
| `menuapp.js` `back()` | `LEVEL\|HOWTO\|SCORES\|ITEMS\|ENEMIES\|SETTINGS → MENU` | `HOWTO\|ITEMS\|ENEMIES → GUIDE`; `LEVEL\|SCORES\|SETTINGS\|GUIDE → MENU` | 1 |
| `menuapp.test.mjs:55-63` | `ITEMS` frozen, 8 entries, `[0]/[2]/[7]` | 6 entries, `[0]=PLAY`,`[2]=OPTIONS`,`[3]=GUIDE`,`[5]=SOURCE` | 1 |
| `menuapp.test.mjs:64-68` | `SETTINGS===10` appended-not-inserted check | `+ GUIDE===11` appended-not-inserted check | 1 |
| `menuapp.test.mjs:312-330` | `[cur,screen]` loop: `1→LEVEL,2→SETTINGS,3→HOWTO,4→ITEMS,5→ENEMIES,6→SCORES` | `1→LEVEL,2→SETTINGS,3→GUIDE,4→SCORES` | 1 |
| `menuapp.test.mjs:331-344` | `cursor=7` SOURCE | `cursor=5` SOURCE | 1 |
| `menuapp.test.mjs:346-364` | OPTIONS at `cursor=2` | unchanged (cursor index doesn't move) | — |
| `headless.test.mjs:185-199` | `cursor=3` click expects `SCREEN.HOWTO` | expects `SCREEN.GUIDE` | 2 |
| `headless.test.mjs:279-283` | `cursor=3` confirm "push HOWTO" then Esc, cue `"uiSel,uiBack"` | same cue sequence, target renamed to `SCREEN.GUIDE` | 2 |
| `menudraw.test.mjs:103-119` smoke `items` literal | 6 arbitrary unshipped labels (`START GAME`/`RENDER 3D`/…) | untouched — never pinned to real `ITEMS`, out of scope | — |
| `menudraw.test.mjs:121-128` smoke calls | `drawHowTo`/`drawItemsHelp`/`drawEnemiesHelp`/`drawScores`/`drawSettings` | `+ drawGuide(stub,L,0.4,0)` | 2 |
| `menudraw.test.mjs:264-273` §13c menu items array | 8 entries (`OPTIONS`..`SOURCE`) | 6 entries: `PLAY\|CORE`,`LEVEL SELECT\|CORE`,`OPTIONS`,`GUIDE`,`HIGH SCORES`,`SOURCE` | 2 |
| `shellview.js` MENU items array | `ITEMS[0..7]` (8 lines) | `ITEMS[0..5]` (6 lines) | 2 |
| `shellview.js` subscreen chain | no GUIDE branch | `+ else if (s===SCREEN.GUIDE)` branch | 2 |
| `scenes.js` `drawHudChips` `chip` helper | `chip(x,w,label,count,col)`, icon picked by `label==="BOMB"?"bomb":"fire"` | `chip(x,w,label,count,col,icon)`, icon optional, ternary replaced by explicit `icon` args at each call site | 3 |
| `scenes.js` `drawHudChips` body | 2 chips (BOMB, FLAME) | 4 chips (BOMB, FLAME, LV, ENEMIES) per §3 table | 3 |
| `index.html:97-104` | `#hud` div + 6 children | deleted | 3 |
| `index.html` `<style>` | `#hud{…}`,`#hud[hidden]{…}`,`#hud b{…}`,`#hud .sep{…}` rules | deleted | 3 |
| `main.js` `hudEl` | declared, gated every frame | deleted (declaration + the one gate call site) | 3 |
| `headless.test.mjs:519-541` | S3.2 `#hud` strip gate block (`hudEl.hidden` assertions) | deleted — nothing left to gate | 3 |
| `headless.test.mjs:551-559` | CSS regex `#hud\[hidden\]{display:none}` against `index.html` | deleted — `#hud` no longer exists in `index.html` | 3 |
| `pickups.test.mjs:465-470` | `drawHudChips` world literal: `{lives,score,heat,players}`, no `enemies`/`level` | `+ enemies:[…], level: N`; assertions extended for `"LV"`/`"ENEMIES"` texts | 3 |
| `three.test.mjs` S4.D `mkW` | `{state,lives,enemies:[],players}`, no `level` | `+ level` field; assertions extended for `"LV"`/`"ENEMIES"` texts | 3 |

**Does not move.** `SCREEN.BOOT..GAME`(0–6), `SCREEN.ATTRACT`(7),
`SCREEN.ITEMS`(8), `SCREEN.ENEMIES`(9), `SCREEN.SETTINGS`(10) — all pinned
by `menuapp.test.mjs:42-53` and `:966-989`, none of which reference cursor
position or ITEMS length, only the enum values themselves.
`menuapp.test.mjs:268-289,598-698` (cursor-wrap/repeat-timing tests) —
these all read `ITEMS.length` dynamically, never a literal `6`/`8`, so a
shorter `ITEMS` needs no edits there. `menuapp.test.mjs:991-1038` (ATTRACT
idle/round-trip using `a.cursor=3`) — this exercises cursor bookkeeping
only, never `ITEMS[cursor]`'s label, so `cursor=3` landing on `GUIDE`
instead of `HOW TO PLAY` needs no edit. `music.test.mjs:757-765`
(`musicCue(SCREEN.HOWTO/ITEMS/ENEMIES/SCORES,1)==="menu"`) — `musicCue`'s
fallthrough (`src/audio/tracks.js:539`, `return "menu"` for anything not
INTRO/GAME/ATTRACT) already covers `SCREEN.GUIDE` for free; no source edit,
though Task 1 adds one assertion line confirming it rather than leaving it
untested. `coach.test.mjs` — swept for cursor/ITEMS/SCREEN pins tied to
menu row count; the only `SCREEN` reference in the file is
`SCREEN.ATTRACT` bookkeeping, unrelated to this change — no edits.
`touch.test.mjs` — `#tpad`/`#tbomb`/`#tpause` visibility keys off
`world.state`, never `app.screen`'s menu row count — no edits. Every
`three.test.mjs` DOM-hud pin (`updateHud`/`makeHud` contract, S4.D/S5
blocks) — verified these build their own synthetic `dom` objects and never
read `index.html`; `makeHud`/`updateHud` signatures are untouched. PAUSE
list, `PAUSE_ITEMS`, `pauseView`, `overlayBox`/`pauseHit`, `settingsHit`,
`OPT_ROWS`/`drawSettings` — none of this session's changes touch the pause
surface or the OPTIONS knob machinery; SETTINGS' own cursor index (2) does
not move.

## Refuse

Renaming or renumbering `SCREEN.HOWTO`/`ITEMS`/`ENEMIES` — they are still
real screens with real content; only their entry point moves one hop
deeper. A `guideHit` touch-precision helper — GUIDE is a flat list like
MENU, which has never had one; SETTINGS earned `settingsHit` because it is
a value-adjust page, GUIDE isn't. An icon for the LV/ENEMIES chips — there
is no pickup glyph for "current level" or "foes remaining," and the SCORE
column has shipped icon-less since S4; inventing one is scope creep this
task didn't ask for. Merging LIVES into the new chips — it isn't a gap,
it's already drawn as hearts; nothing to migrate. Keeping `#hud` "just in
case" behind a flag — the user asked a direct yes/no question and the
controller ruled removal; a flag reopens the exact mirrored-control problem
S2's spec spent a section refusing for RENDER/SOUND. Touching
`PAUSE_ITEMS`, `pauseView`, or any OPTIONS/pause-page code — out of scope
for a menu-IA-plus-HUD-strip pass. Abbreviating `ENEMIES` to `FOES` on the
chip — `FOES` is an internal variable name (`src/core/entities.js`'s
`FOES` array) that has never once been shown to a player; the menu row,
the GUIDE row and the field-guide title all say `ENEMIES` and the chip
matches them, not the source's internal naming.

## Tests

`node --test` only, per task:

- **Task 1** (`menuapp.js` pure logic) — `menuapp.test.mjs`: frozen-shape
  edits (§1 table), the `[cur,screen]` cursor-dispatch loop rewrite, GUIDE
  row confirm dispatch (`guideRow` 0/1/2 → HOWTO/ITEMS/ENEMIES), GUIDE
  `move`/`_tapMove` wrap-both-directions parity with MENU, `back()` from
  HOWTO/ITEMS/ENEMIES landing on `SCREEN.GUIDE` (new), `back()` from GUIDE
  landing on `SCREEN.MENU`, `guideRow` surviving a GUIDE↔leaf round trip.
  `music.test.mjs`: one new `musicCue(SCREEN.GUIDE,1)==="menu"` assertion.
- **Task 2** (render + routing) — `menudraw.test.mjs`: `drawGuide` smoke
  (no-throw, both canvas sizes), a chrome-fit check mirroring the
  HOWTO/ENEMIES pattern (three row labels + `ESC BACK` all inside the
  plate), the §13c menu-items array shrink. `headless.test.mjs`: the two
  `cursor=3` pins retargeted from `SCREEN.HOWTO` to `SCREEN.GUIDE`,
  including the `uiSel,uiBack` cue-sequence assertion (unchanged shape,
  renamed target).
- **Task 3** (HUD strip removal) — `pickups.test.mjs` and `three.test.mjs`:
  extend the two `drawHudChips` world literals with `enemies`/`level` and
  assert the new `"LV"`/`"ENEMIES"` chip texts render. `headless.test.mjs`:
  delete the S3.2 `#hud` gate block and the `#hud[hidden]` CSS regex — both
  assert on markup that no longer exists. No new browser-only test: the
  live check is visual (see below).

Visual pass (`npm start`, unregister the service worker + delete its caches
first — a stale SW serves pre-change bytes and looks exactly like a change
that did not land):

1. MENU shows 6 rows: PLAY, LEVEL SELECT, OPTIONS, GUIDE, HIGH SCORES,
   SOURCE. No `#hud` strip above the canvas.
2. `GUIDE` opens a 3-row list; each row opens its target screen; `Esc` from
   any of the three returns to GUIDE (not MENU); `Esc` from GUIDE returns
   to MENU.
3. In a running game, the canvas HUD row reads (left to right): hearts,
   BOMB chip, FLAME chip, `LV` chip, `ENEMIES` chip, then the heat token +
   score in the top-right corner — none overlapping at both 600×520 and
   608×352.
4. `LV` and `ENEMIES` update live as the run progresses (level changes
   between rooms, enemies count drops as foes die).
