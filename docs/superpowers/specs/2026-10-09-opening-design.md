# Fusegrid — opening sequence (title, show, menu), binding design (2026-10-09)

Binding spec for one item, **O1**: the boot path from first paint to MENU. It
replaces the 5 s INTRO flyover with a **title** that waits for a press and a
**~4.4 s show** that starts the music and ends on MENU. It ships as one code
commit with one paired `CACHE_NAME` + `sw.js` REV bump, then docs. The work
stays inside `SCREEN.INTRO` as two phases. There is no new `SCREEN` value and
no new store.

Measured at `33472ac` (shell v167). `src/main.js` is 788 lines by the
`split("\n").length` pin; another agent is still committing keyboard work on
`main`. **Re-measure every line number and the budget in §9 at implementation
start.** Public copy never names the private reference game.

**Reviewed 2026-10-09** against HEAD `33472ac`:
- The user's Q1/Q2 answers are recorded as rulings.
- The `33472ac` "any key skips INTRO" behaviour is split. On the title, a
  press starts the show. In the show, any key skips.
- Corrections are tagged "review 2026-10-09" inline. The main ones:
  - a `pump()` gate on a running ctx;
  - an unlock hatch so the title can never strand a player;
  - a pending-board press exits to MENU;
  - `fromShow` cleared outside `_push`;
  - the wider test flip census.

## Rulings this spec is built on

- **User request, 2026-10-09 (verbatim):** "when user open the game, the game
  intro not very good at all and there is no music in background untile the
  menue apear, let's create a better senario for this step in to the game
  menue."
- **Ruling 2026-10-09 (opening, user pick "Title screen, then show"):**
  - Boot lands on a lively **title**: the FUSE/GRID logo over a slowly
    drifting board, with a pulsing **PRESS ANY KEY** / **TAP TO START**.
  - That press starts the music with a short sting, then a **~4 s
    cinematic**: the camera sweeps the board, MAKO pops in, a fuse lights, and
    a bomb blast reveals the menu.
  - Music plays from the first frame of the show into the menu.
  - Any key skips the show.
- **Ruling 2026-10-09 (first visit, user pick "Show, then menu"):** every
  visit, the first one included, goes **press → show → MENU with PLAY
  highlighted** (cursor 0).
  - This **reverses** the first-visit Play Now path: plan 7
    (`2026-09-04-arcade-loop-design.md` step 7), R4
    (`2026-09-06-retention-wave1-design.md` §5) and `bootFromIntro`'s
    unseen-cabinet branch, which booted a first visit straight into a CORE
    room-1 run.
  - R4's sub-90 s target still holds, now through the MENU: press, then
    4.4 s of show, then Enter on PLAY.
- **Ruling 2026-10-09 (Q1, user):** the title look **follows the RENDER
  setting**. CLASSIC 2D players get the 2D title drift, REAL 3D players get
  the 3D one. Three is never force-loaded for the title (§13).
- **Ruling 2026-10-09 (Q2, user):** the show plays the **MENU theme
  throughout**, from the press into MENU. There is no intro-track handoff.
  The `intro` track stays in code, pinned and unused (§4, §13).
- **Browser rule (not a choice):** no audio can play before a user activation.
  The title is therefore silent by construction. The fix for "no music until
  the menu" is that the **first press** starts the music, and the show runs
  under it. It is not music on the title.
- **Unchanged:** CORE is the replay baseline (the show world is a throwaway,
  like attract). There is one global 3D rig, C at the selected CAMERA preset.
  The light recipe is untouched. Soundtrack v3 is the user-approved baseline.

**Hard gates:**
- The `src/core` diff stays EMPTY.
- `main.js` stays at or under the `<=799` pin (§9).
- One paired `CACHE_NAME` + `sw.js` REV bump per code commit.
- No new `SCREEN`. No new `nb.*` store.
- No new tones: the sting is `uiJingle`, the blast is `bomb` + `boom`.
- The draw-call budget does not move: fat-world stays 141. The show world
  uses the same slots attract uses.

---

## 1. Measured: the audio unlock at HEAD

Harness:
- Headless Chromium 153.0.8010.12 over CDP, run from scratchpad scripts
  `opening/unlock.mjs` and `opening/osc.mjs`.
- Throwaway profile, one fresh browser context per case.
- Served by a private loopback static server on a free port, with `sw.js`
  404'd so no controllerchange reload interferes.
- Real input via `Input.dispatchKeyEvent`, `Input.dispatchMouseEvent`, and
  `Input.dispatchTouchEvent` (with touch emulation on).
- Two pages:
  - A probe page records `navigator.userActivation` per event and calls
    `resume()` in exactly one event type.
  - The real `index.html?debug=1`, with `window.AudioContext` wrapped to
    capture the game's instance.

**The requested flag is the wrong instrument.** With
`--autoplay-policy=user-gesture-required`, the no-gesture control was already
`running`: a context created at load runs with no gesture at all. That held in
both `chrome-headless-shell` and the full Chrome for Testing build, so that
run proves nothing about Web Audio. Every result below is from
`--autoplay-policy=document-user-activation-required`. With that flag the
control is `suspended` at load, and `resume()` without a gesture leaves it
`suspended`.

**Which events carry activation** (probe; `isActive` read inside each
listener):

| Gesture | Event sequence with activation | `resume()` inside the listener |
|---|---|---|
| Key `a` | keydown ✔ keyup ✔ | keydown → `running` |
| **Escape** | keydown ✘ keyup ✘ (sticky stays false) | keydown → **`suspended`**. A later `resume()` outside any handler stays `suspended`. |
| Mouse click | pointerdown ✔ mousedown ✔ pointerup ✔ click ✔ | pointerdown → `running`, mousedown → `running` |
| **Touch tap** | **pointerdown ✘ touchstart ✘** pointerup ✔ touchend ✔ (compat mousedown/mouseup) click ✔ | **pointerdown → `suspended`, touchstart → `suspended`**. pointerup, touchend and click → `running`. |

After a touch tap whose `resume()` in pointerdown failed, both a later
`resume()` and a later `OscillatorNode.start()`, outside any handler, flip the
context to `running`. Chromium accepts **sticky** activation from the
`touchend`. WebKit/iOS was not measured; it wants `resume()` inside the
gesture handler.

**The real game at HEAD:**

| Case | After the press |
|---|---|
| Key `a` / mouse click | `running`, music plays |
| Touch tap, 60 ms | `running`, but **by luck** (see below) |
| **Touch long-press, 800 ms** (seen cabinet) | **`suspended` on MENU, silent**, and it stays that way. This was measured with `osc.mjs` (hold 800), but the output is not in the archived JSONs. Acceptance #2 re-measures it. |
| **Escape** (seen cabinet) | `unlocked()` is **true** but the ctx is **`suspended`**. MENU is silent until the next sound-making key. |
| **Escape** (first visit) | Boots a CORE run with the ctx **`suspended`**. ArrowDown in GAME plays no sound, so the room stays silent until the first SFX. |

Why the 60 ms tap works:
- `unlockOnce` runs on `pointerdown`, which carries no activation, so its
  `resume()` fails.
- The `{once:true}` listener is gone at that point.
- `uiJingle`'s `setTimeout` voices fire at 120–480 ms. Each calls
  `c.resume()` in `voice()`, which runs after the `touchend` has granted
  sticky activation.
- An 800 ms press ends after the last jingle timeout, so nothing ever resumes
  the context.

Two more defects at HEAD:
- **Escape consumes the one-shot listener**, leaves `unlocked()` lying, and
  fires the jingle into a frozen ctx. That is the exact chord-blob the P1 pin
  exists to prevent, replayed on the next resume.
- The P1 Node stub cannot see any of this, because its `unlock()` always
  succeeds.

A third defect (review 2026-10-09, from code):
- Every `unlock()` creates `musicGain`, even one that leaves the ctx
  suspended.
- `pump()` gates only on `musicGain` (`audio.js:286`). So after an Escape or
  a touch `pointerdown`, it schedules step 0 at a frozen `currentTime` (0.05
  is within `LOOKAHEAD` 0.12) and advances `stepN`.
- The next activating press then plays that stale step 0 on top of step 1.
  This is the same chord-blob as P1, on the music side.

**Verdict:** the unlock code **must change** (§5). The rule: listen on
`keydown`, `pointerdown`, `pointerup`, `touchend` and `click`; stay armed
until the ctx is actually `running`; make `unlocked()` honest; and gate
`pump()` on it.

The first-visit Escape → GAME → **PAUSE** double-handling was observed on the
pre-`33472ac` tree. `33472ac` fixed it: Input now pauses before the shell sees
the key. At HEAD the same press lands in a PLAYING run.

## 2. Flow: two phases inside `SCREEN.INTRO`

```
boot ─┬─ ?play=1 / autoplay / decodable ?code= ──► GAME   (no title, unchanged)
      └─► INTRO.title ──(gesture that leaves the ctx RUNNING)──► INTRO.show ──► MENU, cursor 0
                │  idle forever; never auto-advances               │ any key / tap after the
                │  Escape, failed unlocks, long holds: stay        │ guard = skip ─► MENU, cursor 0
```

- `app.introStage`: `0` is the title, `1` is the show. It is set to `0` at
  construction. Only `beginShow()` moves it to `1`.
- `app.subT` is the phase clock. It resets to `0` at `beginShow()`.
- `app.pressT` is the title `subT` captured at `beginShow()`, so the show
  starts from the exact title pose (§7).
- The title **never times out**. There is no ATTRACT from the title, and the
  idle counter still runs on MENU only.
- `bootFromIntro()` **always** `_push(SCREEN.MENU)` with cursor 0. It still
  calls `markCabinet()` once when `cabinetSeen` is false. `nb.cabinet.v1` is
  still written, stays in reset's CLEAR list, and **no longer branches
  anything**. That is disclosed, not removed (no store change).
- MENU entered at the natural end of the show sets `app.fromShow = true`,
  which turns on the logo slam and the dim ramp in §7. A user skip leaves it
  `false` and keeps today's 0.25 s `drawFade`.
- Fix 2026-10-09 (shell v175): a user skip also **drops the show world**.
  The live world backs MENU, as before the opening, and the 0.25 s fade hides
  the swap. Only the natural end keeps the show world as MENU's backdrop.
  v172-v174 kept stepping it behind MENU (`stepShow` mode 2, `sfx:!show`), so
  a skip after the plant (`subT >= 1.88`) still blew the bomb 0.4-2.5 s later:
  muted, but its flash (up to 0.94) and shake (1.6-2.0) leaked onto MENU. Both
  the mode and the gate are gone: past the boom the script never fires and
  emits no event (pinned over 60 s), so the natural end's tail is silent.

## 3. Beats

The show clock is `subT` (frame dt). There is no audio-clock bus. The unit is
the **menu track step** `S = 0.137 s` (109.5 BPM sixteenths), defined in
`intro.js` as `SHOW_STEP = 0.137`, with a pin that it equals
`MUSIC_TRACKS.menu.A.STEP`.

The menu track starts at its step 0 when the ctx first runs, which is also
when the show begins. So the show's step grid is the music's grid. Accepted
skew is one frame plus the unlock's 0.05 s scheduling anchor.

This holds only because `pump()` is gated on a running ctx (§5). It does not
hold when the show waits on the 3D board (`_showPending`, §7). In that case
the music and the sting start at the press, the show starts later, and the
two grids are offset. That offset is disclosed in §13.

**Title (loop, silent, `introStage 0`):**
- **Logo:** at `L.logoCy`, the same place the MENU logo sits. It reveals with
  today's fade + slide over 0.9 s, then idles with a ±2 px bob, period
  `16S`.
- **Prompt:** `PRESS ANY KEY` (layout `d`) or `TAP TO START` (layouts `p`/`l`)
  at `L.footY`. Weight 900, 18 logical px, accent. It fades in from 0.6 s,
  then pulses alpha 0.45↔1 on the beat (`4S` = 0.548 s).
- **Board:**
  - Veil 0.45.
  - Camera drifts. In 3D the azimuth is `0.10·sin(2πt/(32S))` around a wide,
    slightly lower pose. `el` is polar from +Y, so `el 0.80` sits 44.2°
    above the horizon, against C's 52.2° (review 2026-10-09: the draft
    called this "high"). In 2D: zoom 1.12, `camX 0.5±0.04`, `camY 0.5±0.03` on
    incommensurate periods (`32S` / `24S`).
  - **MAKO is not drawn** (`pop 0`). The world does not step.
- No skip hint (there is nothing to skip). No REV string.

**Show (`introStage 1`, `SHOW_DUR = 32S = 4.384 s`, two bars):**

| t | step | Beat |
|---|---|---|
| 0 | 0 | Unlock resolved: the menu track plays from step 0, and `uiJingle` fires once (the sting). The title logo exits up and fades over 0.3 s. The camera starts sweeping from the title pose at `pressT` toward MAKO's spawn corner. The veil goes 0.45 → 0.12 by `8S`. |
| 0.20 s | — | The skip guard opens: before this, every skip path is a no-op (§6). The skip hint fades in at 10 px, muted, bottom-right: `ANY KEY TO SKIP` / `TAP TO SKIP`. |
| 0.548 | 4S | **MAKO pops in:** `pop` runs 0 → 1 with `easeOutBack` over 0.25 s, overshooting ~1.1. |
| 1.096 | 8S | The camera reaches the close-up on MAKO and holds. |
| 1.884 | 32S − FUSE | **The fuse lights:** the scripted fire edge plants a bomb on (3,1). The sim's own fuse spark and the `bomb` SFX come from the renderer's event drain. Eye-check fix 2026-10-09: it is a PIERCE bomb (the throwaway player's `bombKind`), so the reveal is a 13-tile T through 7 bricks, not a 3-tile corner cross. |
| ~1.9–2.8 | — | MAKO walks plant-and-leave back to the spawn tile and down to (1,2), off both arms. |
| 2.192 | 16S | The camera pulls back (`easeInOutCubic`). It lands **exactly** on rig C at the selected CAMERA preset at `32S`. |
| **4.384** | **32S** | **Blast = reveal** (detail below). The sim detonates (`FUSE 2.5`, within one `CFG.STEP` of `32S`, pinned), playing `boom` plus the renderer's own flash and shake. |

**The reveal** (moved out of the table in review 2026-10-09; bullets inside a
table cell broke the markdown):
- **MENU is flipped by the boom, not by the clock.** `stepShow` scans each
  tick's events for the show bomb's `boom` and sets `app.showBoom`. It runs
  after `app.update()` and before the renderer drains `world.events`.
  `update()` flips to MENU at cursor 0 with `fromShow` on the next frame.
- This matters because the sim's anti-spiral cap drops time on a long frame.
  A hitch in the first seconds of 3D (bundle parse, shader compile) would
  otherwise open MENU before the bomb blows.
- The camera reaches rig C at `subT = 32S` and holds there until the boom, so
  there is no pop.
- Safety net: `subT >= SHOW_DUR + 1.0` flips to MENU anyway.
- **Eye-check fix 2026-10-09 (the blast is the climax):** the plate, rows
  and footer hold back for `2S` (0.274 s) so the blast plays unobstructed
  under the slamming logo. The plate fades in over the last 0.12 s of the
  hold, the rows enter at `enterT = subT − 2S`, and the dim ramps 0.12 → 0.62
  over the 0.35 s after the hold. The 3D flame-cross flicker runs on the
  freshest blast's own clock (`cos(24·age)`), so every blast is born at full
  opacity. On the world clock, the show's deterministic boom landed on the
  trough at 0.1 opacity. Same-instant `brick` SFX play once: seven coherent
  copies peaked at 1.22 and clipped; the measured peak is now 0.52, against
  0.49 for the old single-brick boom.
- **The logo slams** on the bar downbeat: scale 1.35 → 1.0, alpha 0 → 1,
  `easeOutBack`, 0.12 s. The MENU dim ramps 0.12 → 0.62 over 0.35 s, so the
  blast reads before the menu settles. The rows use today's `enterT`
  entrance.

The plant time is derived, not authored: `SHOW_PLANT = SHOW_DUR − CFG.FUSE`.
A FUSE retune moves the plant, never the reveal.

## 4. Music

- `musicCue(SCREEN.INTRO, …)` returns **`"menu"`**, flipping the
  `music.test.mjs` pin at line 1016. The change deletes the INTRO line in
  `musicCue` (`tracks.js:1287`), so INTRO falls through to `"menu"`.
- The menu track is therefore armed on the title. It starts at step 0 when the
  ctx first runs, and INTRO → MENU is a `setTrack("menu")` **no-op**. That is
  verified: `applyTrack()` early-returns when `wantId === curId`, so neither
  `stepN` nor `nextT` is touched. No seam, by construction.
- **The sting** is the existing `uiJingle` through `fireJingle`, fired once
  from the unlock-ready callback **only when the screen is INTRO title** and
  only when `audio.unlocked()` is true.
  - The boot-time `if (audio.unlocked && audio.unlocked()) fireJingle();`
    (`main.js:328`) is deleted. The sting belongs to the press only.
  - Deep links (`?play=1`, `?code=`) get no sting; their room track just
    starts. Today the jingle plays mid-run on the first gesture of a
    `?code=` link.
  - `autoplay` stays excluded, as today.
- **The blast** uses the existing `bomb` and `boom` SFX from the renderer's
  event drain. `boomOf("menu")` is the default boom.
- No track-table edit. No new oscillator recipe. `tests/music.test.mjs`'s
  Soundtrack v3 rules are untouched. The only change there is the cue pin.
- **Ruled (Q2, 2026-10-09):** the hand-authored `intro` track (C major
  hexatonic, 32 steps, `MUSIC_TRACKS.intro`) becomes **unreachable**. It is
  kept, not deleted: it is in the v3 baseline and still pinned (§13).
- With SOUND off, the ctx still unlocks (muted). The show runs on the same
  clock, visual-only.

## 5. Unlock seam: `src/app/unlock.js` (new, Node-testable)

```js
export const UNLOCK_EV = Object.freeze(["keydown","pointerdown","pointerup","touchend","click"]);
export function armUnlock(target, audio, onReady)  // returns disarm()
```

- **Listeners.** Each event in `UNLOCK_EV` is added in the capture phase. The
  handler is a no-op once done. Otherwise it calls `r = audio.unlock()`
  **synchronously inside the handler** (WebKit needs that):
  - `r === false` means no WebAudio: finish, because there is nothing to wait
    for.
  - If `audio.unlocked()` is already true: finish.
  - Otherwise `Promise.resolve(r).then(() => audio.unlocked() && finish(),
    finish)`. A rejected `resume()` (closed ctx) finishes rather than
    stranding the title.
- **Hatch (review 2026-10-09).** Two cases are a risk: WebKit/iOS is
  unmeasured, and iOS can report `interrupted`, or a `resume()` that never
  settles. Either one would leave every press a no-op and lock the player
  out of the game. So:
  - Count **physical presses**: a `keydown` that is not `Escape`, not a
    modifier or lock key (`Shift` / `Control` / `Alt` / `Meta` / `CapsLock`,
    which carry no activation either: measured, review 2026-10-09; also
    Chromium's other modifiers `AltGraph` / `Fn` / `FnLock` / `NumLock` /
    `ScrollLock` / `Symbol` / `SymbolLock` / `Hyper` / `Super`, measured for
    the first four, O1 review 2), and not
    `ev.repeat` (OS auto-repeat is one press), or a `pointerup`. Never count
    `pointerdown` or `touchstart`, which carry no activation on touch.
  - The **second** counted press that still finds the ctx not running
    calls `onReady` 250 ms later, never synchronously, so that press's own
    `resume()` can land first (Shift+A, or two quick presses inside resume
    latency, then still get the sting). If it does not, the show runs silent.
  - The sting is skipped, because `onAudioReady` gates it on `unlocked()`.
  - The hatch does **not** disarm. `onReady` is the one-shot part; the
    listeners stay armed and every later gesture calls `unlock()` again, and
    they are removed only once the ctx runs, on `r === false`, or on a
    rejected `resume()`. So the music starts once a later activating gesture
    runs the ctx, because `pump()` is gated on `unlocked()` (no sting:
    `onReady` already fired).
  - Escape still never starts a show.
- **No WebAudio** (`audio` null or lacking `unlock`, which is Node only:
  `index.html:120` always passes `createAudio()`), or `r === false`: finish
  on the first gesture except an `Escape` keydown.
  - That key-code check is a Node-side proxy for "carries no activation",
    which keeps the key matrix identical to the browser. It is not a
    whitelist.
- **finish()** removes every listener once, then calls `onReady()` unless
  the hatch already did. It
  tolerates a target with no `removeEventListener`: the P1 pin's fake
  `window` has only `addEventListener`, and the `done` flag already makes the
  handler inert.
- **Listener order does not matter.** In the browser, a capture listener on
  `window` fires before Input's keydown and main's canvas `pointerdown`. In
  the Node stubs, registration order puts Input first.
  - When `onReady` runs synchronously inside the handler (the ctx was already
    running), the same press then reaches `app.key` or the canvas handler.
  - `skipShow()` is still inside `SKIP_GUARD` at that point, so the starting
    press can never also skip.
- **`audio.js` changes, small:**
  - `unlock()` returns `ctx.resume()`'s promise when the ctx is suspended,
    `true` when it is running, and `false` when there is no WebAudio.
  - `unlocked()` becomes **honest**: `!!ctx && !!musicGain &&
    ctx.state === "running"`.
  - **`pump()` returns early unless `unlocked()`** (review 2026-10-09; §1's
    third defect). Before this, `pump()` checked `musicGain`, so a failed
    unlock scheduled step 0 into a frozen clock.
    - Eye-check fix 2026-10-09: in a running stream (`stepN > 0`), a gap
      under 1 s drops the missed steps whole, so the grid holds. Step 0 and
      long gaps still re-anchor. A cold 260 ms raster stall had dragged the
      grid +0.092 s.
    - With the gate, the first running `pump()` hits the catch-up clamp and
      plays step 0 at or after `currentTime`.
  - The `music.test.mjs` `mkAC` stub already carries `state: "running"`, and
    its `resume()` sets that state. Its `resume()` returns `undefined`, not a
    promise, so `unlock()` returns `true` and its pins keep passing (549–550,
    1332).
  - main's `duck()` frame poll (`main.js:582`) already passes `unlocked()` and
    benefits from the change.
- **`main.js`:** the 10-line `unlockOnce` block (`main.js:475–484`) becomes
  one call, guarded only by `typeof window !== "undefined"` (no longer by
  `audio`): `armUnlock(window, audio, onAudioReady)`.
  - `onAudioReady` is `if (app.screen === SCREEN.INTRO) { fireJingle();
    app.beginShow(); }`.
  - `fireJingle` gains a `!audio.unlocked()` early return.
  - Without audio (`opts.audio` null; Node and tests) the title must still be
    leavable through the no-WebAudio rule above.
- What this fixes:
  - Escape never starts a silent show, because the ctx is not running. The
    listener stays armed, and the next real press starts the show with sound.
  - A long-press starts the show on its `pointerup` / `touchend`.
  - Modifier keys and future activation rules need no whitelist: the gate is
    the ctx state.
- P1 still holds:
  - Nothing is scheduled before the first gesture.
  - Exactly one `uiJingle` fires, and never a second one.
  - It now also holds for Escape and touch `pointerdown`. The jingle fires
    only once the ctx is `running`, and music only pumps while it runs.

## 6. Input matrix (INTRO)

| Input | Title (`stage 0`) | Show, `subT < 0.20` (guard) | Show, `subT >= 0.20` |
|---|---|---|---|
| Any key that unlocks (letters, digits, arrows, Enter, Space, Backspace, R, M, …) | `app.key` / `_tapMove` / confirm / `skipShow` are **no-ops**. `armUnlock` starts the show when the ctx runs. | no-op | `skipShow()` → MENU at cursor 0 |
| **Escape** | no-op, and **no show** (the ctx stays suspended, the listener stays armed, and Escape never counts toward the §5 hatch) | no-op | skip → MENU (Input's pre-shell pause is a no-op outside GAME) |
| Any press while `_showPending` (ctx running, 3D board not ready) | `skip()` → MENU at cursor 0 once `subT − pressT >= SKIP_GUARD`; before that, a no-op, so the press that started the show never also skips it (review 2026-10-09: a hung three fetch must not hold a music-playing title) | — | — |
| Mouse click on canvas | main's `pointerdown` now calls `app.skipShow()` (today it calls `app.skip()`, `main.js:438`), a no-op on the title; unlock on `pointerdown` → show | no-op | skip → MENU |
| Touch tap / **long-press** | no-op; unlock completes on `pointerup` / `touchend` → show | no-op | skip on `pointerdown` → MENU |
| **Space held** across title → show → MENU | `beginShow()` sets `prevConfirm = true`, so the held fire makes no rising edge | no rising edge | no rising edge until release and press; never starts a run |
| Enter that skips the show | — | — | MENU, `inGame` false; Input drops `e.repeat`; no PLAY |
| Arrow that skips the show | — | — | MENU at cursor **0**. `_skipKey`'s `_taps` latch stops the held axis moving the cursor on the landing frame (`33472ac`). A hold past `REP_FIRST` repeats, as on any MENU hold. |
| Arrow held from the title press through the natural end | — | — | MENU at cursor **0**: the natural end also goes through `_skipKey()` (§8) |

Notes:
- **`skip()` stays the direct programmatic jump.** From either stage it goes
  to `bootFromIntro()`, which is MENU. 34 Node call sites use
  `g.app.skip()` to reach MENU (headless 23, menuapp 4, daily 3, coach 2,
  cabinetseen 1, stats 1), and so does the debughook; all keep working.
  Node games with no `window` have no gesture to leave the title, so they
  use `skip()` or `beginShow()`.
- **Every gesture path goes through the new gated `skipShow()`**: `key()` /
  `_skipKey()`, `confirm()`, the `update()` rising edge, and main's canvas
  `pointerdown`. It returns `false` on the title and inside the guard, and
  otherwise calls `skip()`. The one exception is `_showPending`, where it
  calls `skip()` as the row above says.
- `_skipKey()` (`33472ac`, `menuapp.js:253`) calls `skipShow()` in place of
  `skip()`. It keeps the prevConfirm latch and the `_taps` latch.
  - On the title, `skipShow`, `confirm` and the `update` rising edge are
    no-ops.
  - **`skip()` is not gated** (review 2026-10-09: the draft listed it among
    the title no-ops, which contradicted the first note above).
- `main.js:374`'s comment ("INTRO: M and R fall through to app.key's any-key
  skip") becomes true only for the show. Reword it in place.
- `beginShow()` is a no-op unless the screen is INTRO, the stage is 0 and the
  show has not already begun.
- **Deep links bypass the title:** `?play=1` / autoplay (screen GAME at
  construction) and a decodable `?code=` (`playChallenge`). The armed unlock
  then just starts that room's track on the first activating gesture, with no
  sting.

## 7. Rendering

- **One clock, three kinds.** `introPhase(stage, t, pressT)` in `intro.js`
  and `introCam(stage, t, base, pressT)` in `flythrough.js` are pure. Both
  replace the old single-argument forms; the old 5 s `introPhase` beat table
  and `createIntro` (unused in `src/`) are deleted.
- **CLASSIC 2D** (the default: `DEFAULTS.r3d` is 0, so most first visits see
  this):
  - The canvas transform at `main.js` (today's lines 698–704) is edited in
    place to read `introPhase(app.introStage, app.subT, app.pressT)`.
  - Title drift is as in §3.
  - The show pushes to zoom 1.8 toward MAKO's spawn tile, with `camX` / `camY`
    clamped to `[0.5/zoom, 1−0.5/zoom]` so no edge gap ever shows.
  - It returns to zoom 1, `cam 0.5/0.5` at `32S`, which is MENU's
    untransformed frame. No pop.
- **REAL 3D:**
  - `ro.intro = {stage, t, pressT}` drives `introCam` in `wrapper.js:128`.
  - Title pose: `el 0.80`, `dist base·1.12`, `target [0,TARGET_Y,0]`, with the
    az drift from §3.
  - Close-up (eye-check fix 2026-10-09; the old spawn-tile aim at el 0.80,
    az −0.35, `base·0.55` was half void, with MAKO walking off-centre):
    target `(2.75, 2.75)` tiles, inside the corner. `el 0.55`, `az −0.1`, and
    `dist BASE_DIST·0.40`, fixed for every preset. At most 12% of the frame
    lies past the rim, and the walk (1,1)/(3,1)/(1,2) stays inside
    |ndc| 0.45 (pinned). Was: target on MAKO's spawn-tile centre, `dist base·0.55`,
    `el 0.80`, `az −0.35`.
  - `introCam(1, 0, base, pT)` must deep-equal `introCam(0, pT, base)`: no
    pop at the press.
  - `introCam(1, SHOW_DUR, base)` must equal rig C (`el 0.66`, `az 0`,
    `target [0,-17,0]`, `dist = base`) for **all three CAMERA presets**: no
    pop at MENU. This keeps the D1 "lands on the preset" contract.
- **iso** (pinned legacy, `?render=iso` only): it rides the same 2D canvas
  transform as today. MAKO's pop is not honoured; he is simply present.
  Accepted.
- **Eye-check fix 2026-10-09:** a title waiting on the board holds `subT`
  at or above `TITLE_IN` (0.9), so it is drawn settled. A load stall then
  freezes a whole logo, not a half-revealed one. The 3D wrapper also runs a
  one-off warm pass per scene: every pooled mesh is shown, an empty instanced
  pool gets one instance, and the frame is discarded. The GPU then builds
  MAKO's and the blast's pipelines on the title, not on the pop and reveal
  frames. Outer blades carry `instanceColor` from the build.
- **First paint never waits for three.**
  - The overlay title (logo and prompt) draws from frame 1 on `#c`.
  - While kind is `3d` and the lazy bundle has not arrived, the board under
    the title is **not** the 2D fallback. Paint the bg plus an opaque veil, so
    there is no 2D → 3D board swap on screen.
  - `app.boardReady` is set by `main.js`: `true` at construction for `2d` and
    `iso`. For `3d` it is set when the three-load promise **settles**, on
    resolve **or reject**, at both `loadRenderer3D` sites. A failed import
    leaves the 2D fallback renderer in place and must never strand the title
    with music playing.
  - `app.readyT` accumulates dt in `update()` once ready. `shellview` passes
    `min(1, readyT/0.4)` as the board alpha, so the veil eases from opaque to
    the title's 0.45 over 0.4 s.
  - The show cannot begin before then. `beginShow()` on a not-ready board
    sets `_showPending` instead, and `update()` begins the show on the first
    ready frame. The music is already playing.
  - Any press while the show is pending goes to MENU once past the guard (§6). A three fetch
    that hangs, rather than rejecting, can never hold the player on the
    title.
  - `app.boardReady` at construction is `curKind !== "3d" ||
    !!createRenderer3D`. The second term covers `opts.createRenderer3D`,
    which is how Node tests and `three.test` are ready at once.
- **The show world** (`createShow()` / `stepShow(show, dt, app, live)` in
  `intro.js`, mirroring attract's `createDemo` / `stepDemo` with the same
  anti-spiral cap raised to a whole 0.25 s frame (main's dt clamp), so a
  stall never drops show time and the boom stays within a frame of `32S`;
  eye-check fix 2026-10-09, was `n > 6`; one signature, matching §10):
  - CORE level 1 at fixed `SHOW_SEED`: heat 0, pact 0, pace 0.
  - `state` forced to PLAY.
  - Every enemy is held with `e.speed = 0`, set on the throwaway world's
    entities and never on `CFG`. `updateEnemies` already skips
    `speed === 0`, so the all-clear auto-advance can never fire.
  - Stepped only in the show and afterwards, with a scripted intent table
    (`SHOW_SCRIPT`). After the script, NOOP intents keep flames and fx
    finishing on MENU.
  - It never touches the live `world`, which becomes the run's world.
- **Backdrop rule in `main.js`:**
  - The show gets its **own local**, `let show`, **not** the `demo` slot.
    Reusing `demo` would let `stepDemo` call `show.bot.intent` and throw, and
    it would change what `g.demo` means (`headless.test.mjs:568` pins
    `g.demo === null` on MENU).
  - `show = createShow()` at boot when the screen is INTRO; `null` for deep
    links and autoplay.
  - It renders `attract && demo ? demo.world : show ? show.world : world`.
  - After the natural end, `show` stays on MENU and its subscreens, so the
    post-blast board (broken bricks, MAKO moved) does not pop back to the
    live world. It is stepped there with NOOP intents.
  - It is set to `null` the first frame the screen is GAME or ATTRACT, or the
    first frame past INTRO after a user skip (fix 2026-10-09, shell v175; see
    §2), and is never recreated.
  - After that, the live world backs MENU, as today.
  - The game handle gains `get show()` for tests.
- **MAKO pop:** `ro.pop` is in `[0, ~1.1]`.
  - The 2D renderer scales `players[0]` about its centre and skips it at
    `pop 0`.
  - The 3D wrapper scales the player slot group. No mesh is added and the
    child-index ABI is untouched.
  - `ro.pop` is absent outside INTRO, which means 1.
- **Settings:**
  - The blast's flash and shake are the renderer's own `boom` fx, so REDUCE
    FLASH (`flashK`) and SCREEN SHAKE (`shakeK`) apply unchanged.
  - The reveal overlay adds **no** white flash of its own; the dim ramp is
    the reveal.
  - BRIGHTNESS applies in 3D as on every screen.
- **Touch controls stay hidden** through title and show
  (`touch.update(app.screen === SCREEN.GAME, …)` already guarantees it;
  pinned).
- **Copy and fit:**
  - `drawIntroChrome(c, stage, t, W, H, lay)`. `shellview` reads `lay` from
    `canvas.ownerDocument.body`'s `data-lay`, the one predicate `fit.js`
    writes, and defaults to `"d"` in Node. No `ontouchstart` re-check.
  - No new render → `src/app/` import. `flythrough.js` already imports
    `app/intro.js` (an exception from before this spec), and it keeps that
    import. `menudraw.js` keeps local copies of `SHOW_STEP` and `SKIP_GUARD`,
    as it does today with `DUR` (`menudraw.js:30`). A `menudraw.test` pin
    checks that the copies equal `intro.js`'s values.
  - Eye-check fix 2026-10-09: the prompt and the skip hint each sit on a dark
    backing box (`drawAttractHint`'s idiom). The prompt's minimum contrast is
    now 3.5:1 over JUNGLE bricks, against 1.6:1 before. Touch copy is sized
    for phones: `TAP TO START` 26 px and `TAP TO SKIP` 18 px, about 15.5 and
    10.8 CSS px at `p`. Desktop keeps 18 and 10.
  - Strings: `PRESS ANY KEY` and `TAP TO START` (18 px, weight 900);
    `ANY KEY TO SKIP` and `TAP TO SKIP` (10 px).
  - Each must fit inside `W − 28` at 600×520 and 608×352 by the 0.6 em mono
    advance rule `menudraw.test` already uses.
  - Phone layouts `p` / `l` scale that same logical box: 18 px at
    `p`'s `s ≈ 0.62` (390 × 844) is about 11 CSS px.

## 8. `menuapp.js` changes

- New fields: `introStage: 0`, `pressT: 0`, `fromShow: false`,
  `boardReady: false`, `readyT: 0`, `_showPending: false`, `showBoom: false`.
- `beginShow()` (guarded per §6) sets:
  - `introStage = 1`
  - `pressT = subT`
  - `subT = 0`
  - `prevConfirm = true`
  - It does not latch `_taps`. That latch would do nothing, because
    `update()` clears `_taps` every frame outside GAME, and INTRO reads no
    axis (review 2026-10-09).
- `update()` gets these INTRO rules:
  - Title: the rising edge is consumed with no action.
  - Show: `showBoom` (or `subT >= SHOW_DUR + 1.0`) → `_skipKey()`, then
    `fromShow = true`, set after the `_push` so it survives. This **moves**
    the auto-advance out of `main.js` (today's lines 672–674).
    - It runs **before** the axis read. The MENU `_repeat` then sees the
      `_taps` latch on the landing frame, so an arrow held since the title
      press does not move the cursor off PLAY (review 2026-10-09).
  - A pending show begins on the first `boardReady` frame. `readyT`
    advances while ready.
  - **`fromShow` is cleared on any frame where the screen is not MENU**, as
    the first line of `update()`.
    - Review 2026-10-09: the draft cleared it in `_push()` only. But
      `startRun()`, `_playCore()`, `_toMenuInner()` and `enterAttract()`
      bypass `_push`.
    - So "show ends → PLAY → PAUSE → M" would land on MENU with `fromShow`
      still true and replay the slam.
- A pending `beginShow()` also sets `pressT = subT`. It does not reset `subT`, so the title drift never jumps.
- New `skipShow()`: while `_showPending`, it calls `skip()` once `subT − pressT >= SKIP_GUARD`, and is a no-op before that. Otherwise it
  returns `false` on the title, and in the show while `subT < SKIP_GUARD`
  (0.20), and calls `skip()` in every other case. `key()` (`_skipKey()`),
  `confirm()` and the `update()` rising edge call `skipShow()`, never
  `skip()`. `skip()` itself stays ungated (§6).
- `bootFromIntro()`: MENU always, cursor 0, `markCabinet()` on the first
  visit. Its header comment is rewritten to cite this ruling.
- Only the show's natural-end MENU entry sets `fromShow` to true, after its
  own `_push`. The slam and dim ramp are bounded by MENU `subT`.

## 9. `main.js` line budget (pin `tests/headless.test.mjs`, `<=799`)

Today 788, 11 lines of headroom; re-measure first.

| Change | Δ |
|---|---|
| `unlockOnce` block → `armUnlock(window, audio, onAudioReady)`, plus the `onAudioReady` arrow | about −7 |
| Boot-time `fireJingle()` (`main.js:328`) deleted; `fireJingle` gains `!audio.unlocked()` in its existing guard line | −1 |
| Auto-advance (comment + line) moved into `menuapp.update` | −3 |
| 2D transform, `ro` intro branch, `ro.pop`: edited in place | 0 to +2 |
| Show slot: its own `let show` (create at boot, step while it backs the shell, drop at GAME/ATTRACT, render pick) + `get show()` | +5 to +7 |
| Canvas `pointerdown`: `app.skip()` → `app.skipShow()` | 0 |
| `boardReady` on reject too (two `loadRenderer3D` sites, `main.js:530`, `:555`) | +1 |
| Imports (`armUnlock`; `createShow` / `stepShow` replace `INTRO_DUR`) | +1 |
| `app.boardReady = true` in the three-load `.then` (2d/iso are ready at construction) | +1 |

Net is about −3 to +1 against 11 lines of headroom. If a later commit eats
the headroom, the show-slot logic
moves into an `intro.js` helper (`showSlot(demo, app, dt)`); the pin is never
raised.

## 10. File map

| File | Change |
|---|---|
| `src/app/unlock.js` | **new**: `UNLOCK_EV`, `armUnlock` (§5) |
| `src/app/intro.js` | `SHOW_STEP`, `SHOW_DUR`, `SHOW_PLANT`, `SKIP_GUARD`, `SHOW_SEED`, `SHOW_SCRIPT`; `introPhase(stage,t,pressT)`, `popOf(t)`, `createShow()`, `stepShow(show,dt,app,live)` (steps only when `live`, i.e. not the title; sets `app.showBoom` on the show bomb's `boom`). `INTRO_DUR` / `createIntro` deleted. |
| `src/app/menuapp.js` | §8 |
| `src/audio.js` | `unlock()` return value; honest `unlocked()`; `pump()` gated on `unlocked()` |
| `src/audio/tracks.js` | `musicCue(INTRO)` → `"menu"` (one line deleted) |
| `src/main.js` | §9 only |
| `src/render/three/flythrough.js` | `introCam(stage,t,base,pressT)`; header comment rewritten |
| `src/render/three/wrapper.js` | `o.intro` object form; player-slot scale from `o.pop` |
| `src/render/renderer.js` (2D) | `o.pop` scale on `players[0]` |
| `src/render/menudraw.js` | `drawIntroChrome(c,stage,t,W,H,lay)`; the local `DUR` copy is replaced by the stage beats |
| `src/render/shellview.js` | `lay` read; MENU logo slam and dim ramp when `app.fromShow`; fade only when `!fromShow` |
| `src/pwa/shell.js` + `sw.js` | add `src/app/unlock.js`; bump to the next free `fusegrid-shell-vN` (v168 if nothing lands first) |

`src/input.js`, `src/core/**`, `src/render/r3d/**` and `index.html` are
untouched.

## 11. Tests (add, flip, keep)

- **`tests/unlock.test.mjs` (new):**
  - Fake target plus fake audio with a ctx state machine.
  - A failed gesture (Escape-like: `unlock()` leaves it suspended) means no
    `onReady`, and all 5 listeners stay.
  - A touch sequence where `pointerdown` fails and `pointerup` succeeds gives
    exactly one `onReady`, and every listener is removed.
  - No WebAudio (`unlock()` returns `false`, or `audio` null) gives `onReady`
    on the first gesture except an `Escape` keydown.
  - A rejected `resume()` promise gives one `onReady`.
  - **Hatch:** a ctx that never runs gives no `onReady` after one counted
    press. A second counted press (a keydown that is not Escape or a
    modifier/lock key, or a `pointerup`) gives exactly one `onReady`, 250 ms
    later, with all 5 listeners still armed; a later activating gesture
    calls `unlock()`, runs the ctx and only then removes them, with no second
    `onReady`. Two modifier keydowns (incl. AltGraph / NumLock / ScrollLock /
    Fn) never trip it. A `resume()` that settles with the ctx still
    suspended keeps every listener armed. Shift then an activating
    key, or two activating presses back to back, give one `onReady` with
    `unlocked()` true. Any number of Escapes, `pointerdown`s and
    `touchstart`s never trips it.
  - `onReady` never fires twice.
- **`tests/music.test.mjs`:**
  - `musicCue(SCREEN.INTRO,1) === "menu"`.
  - A `mkAC` with `state: "suspended"` reads `unlocked() === false` after
    `unlock()` until `resume` flips it.
  - **Frozen-clock pin:** that suspended `mkAC`, `unlock()` and then several
    `pump()` calls schedule **zero** oscillators. After the state flips to
    `running`, the first `pump()` emits step 0 at or after `currentTime`.
  - `setTrack("menu")` twice leaves `stepN` / `nextT` untouched (the no-op
    pin).
  - The `intro` track pins stay.
- **`tests/intro.test.mjs` (rewrite):**
  - `SHOW_STEP === MUSIC_TRACKS.menu.A.STEP`; `SHOW_DUR === 32*SHOW_STEP`;
    `SHOW_PLANT === SHOW_DUR − CFG.FUSE`.
  - The title drift keeps zoom at or above 1 and the pan inside the no-gap
    clamp for t in [0, 120] s.
  - `introPhase(1,0,pT)` equals `introPhase(0,pT)`.
  - `introPhase(1,SHOW_DUR)` is zoom 1, cam 0.5/0.5, exact.
  - `popOf` is 0 before `4S` and 1 from `4S+0.25` on.
  - The show world, stepped through `SHOW_DUR` from `createShow()`:
    - exactly one `bomb` event at `SHOW_PLANT` ± `CFG.STEP`;
    - a `boom` within `CFG.STEP` of `SHOW_DUR`;
    - MAKO alive, `state === "PLAY"`;
    - no `kill` / `hurt` / `win` event;
    - every enemy at `speed 0`;
    - deterministic across two runs.
  - **Hitch pin:** drive app plus show with
    `dt = [0.25, 0.25, 0.25, then 1/60…]` from `beginShow`. MENU never opens
    before the show bomb's `boom`, and opens exactly one frame after it.
- **`tests/three.test.mjs` §S3.C (rewrite):**
  - Press continuity.
  - Show end equals rig C at each preset `dist` (the D1 preset pin, kept).
  - Per-frame camera delta bounded at 60 fps over the whole show.
  - The wrapper with `o.intro` drives the camera exactly through
    `introCam` + `applyOrbit`.
  - `o.pop` scales the player slot, and `SLOT_MESH.player` is still 5.
- **`tests/menuapp.test.mjs` (167–280 flip) and `tests/keys.test.mjs` INTRO
  block (flip)** — the §6 matrix.
  - `tests/keys.test.mjs` and `_skipKey` came from the concurrent keyboard
    agent (`33472ac`). Coordinate the flip with whoever owns that file at
    implementation time.
  - Its INTRO block drives real listeners with no audio (`createGame(null,
    {seed:42})`). So the title → show step comes from the no-WebAudio
    `armUnlock` rule, and Escape stays on the title exactly as in the
    browser.
  - **The flip is wider than the INTRO block** (review 2026-10-09).
    - `keys.test`'s `menu()` helper (line 49) does `press(g,"Enter")` from
      INTRO. `run()` and nearly every block after it enter through that
      helper.
    - Under this spec that press only starts the show. The helper becomes:
      press, then tick past `SKIP_GUARD`, then press Enter. That keeps it a
      real-key path. `g.app.skip()` is the fallback.
  - **Gesture exits from INTRO elsewhere** also flip, because the title
    ignores them. A bare `skip()` keeps working. The census at `33472ac`:
    - `menuapp.test` 167–280: key, confirm and `confirmHeld` paths on a fresh
      `createMenuApp`.
    - `cabinetseen.test` 140–160: skip, confirm and any-key on an unseen
      cabinet.
    - `headless.test` 43–160, plus 178–186 ("C1 intro click", a canvas
      `pointerdown` on INTRO).
    - `keys.test` 55–77, plus the `menu()` helper.
    - Re-grep at implementation time for `press(`, `fire("pointerdown"`, and
      `key(` / `confirm()` / `update(` on a `createGame` or `createMenuApp`
      that has not set `screen` or called `skip()` first.
  - Plain `skip()` still lands on MENU. The gated `skipShow()` carries the
    matrix:
  - Title: every key code, confirm, `skipShow`, `_tapMove` and a rising
    `confirmHeld` leave `screen INTRO`, `introStage 0`.
  - `beginShow()` gives stage 1, `subT 0`, `prevConfirm true`.
  - In the guard: no-ops.
  - After the guard: Enter / Escape / Backspace / arrows / letters / R / M /
    a rising Space each give MENU at cursor 0 with `inGame` false.
  - Space held across both edges never starts a run.
  - Natural end gives MENU with `fromShow` true. An arrow held from the title
    press lands on cursor 0.
  - Natural end, then PLAY, then PAUSE, then M gives MENU with `fromShow`
    false (no replayed slam).
  - A press while `_showPending` gives MENU once past `SKIP_GUARD`. The press that set it pending does not.
  - **Unseen cabinet gives MENU (reversal)**, and `markCabinet` is called once.
- **`tests/cabinetseen.test.mjs`:** the unseen `bootFromIntro` block flips to
  MENU at cursor 0, with the args untouched and `markCabinet` called once.
- **`tests/headless.test.mjs`:**
  - 43–160 flip: first visit, then press, then `SHOW_DUR` of frames gives MENU
    at cursor 0. The title **never** auto-advances (120 s of frames, still
    INTRO stage 0).
  - **P1 pins kept:**
    - nothing scheduled before the first gesture;
    - exactly one `uiJingle`;
    - never a second one.
  - **P1 pins added:**
    - a stub whose `unlock()` fails fires no jingle and stays on the title;
    - a `?code=` / autoplay boot fires no jingle on its first gesture;
    - touch controls hidden throughout title and show.
  - The `main.js` `<=799` pin is unchanged.
- **`tests/menudraw.test.mjs`:**
  - The title paints the prompt matching `lay` and no `PRESS ENTER`.
  - The show paints the skip hint only after `SKIP_GUARD`.
  - All four strings fit at 600×520 and 608×352.
  - With the board not ready, the title veil is opaque.
- **`tests/pwa.test.mjs`:** `unlock.js` is in the shell list; `REV` equals
  `CACHE_NAME`.

## 12. Acceptance

Run `npm test` green, then a **headed CDP check**:
- Real Chromium, `--autoplay-policy=document-user-activation-required`,
  throwaway profile, SW and caches cleared on the loopback origin used.
- The `MessageChannel` rAF shim, with assertions on `window.__GAME__` and the
  captured ctx, not on pixels.

1. Boot shows the title in frame 1, in 2D and in 3D. In 3D, no 2D board
   appears while three loads. The game's own `ctx` is `none` or `suspended`
   *(2026-10-10: `primeDevice()` builds and closes one throwaway context at
   boot to warm the audio device, so a harness that records every constructed
   context sees one `closed` context too; assert on the game's ctx only)*.
2. Key `a`, mouse click, a 60 ms tap and an 800 ms long-press each give
   `ctx running` and `introStage 1` within 2 frames of the activating event.
   MENU arrives at cursor 0 4.384 s ± 1 frame after the **show start**
   (`introStage` 1), not after the press: in 3D the show can wait on the
   board. The track reads `menu` from the press on, and `stepN` is never
   reset at MENU entry. The 800 ms long-press row of §1 is re-measured here
   at HEAD before the change.
3. Escape on the title: still INTRO stage 0, `ctx suspended`, listeners
   armed. Then key `a` gives the show, with the jingle heard once.
4. A second press after the guard gives MENU at cursor 0. Enter-skip and
   Space-skip never start a run.
5. A first visit (empty storage) gives MENU, not GAME.
6. `?play=1` and `?code=<valid>` boot straight to GAME with no title and no
   sting.
7. REDUCE FLASH on: the blast frame's flash ≤ 0.25 of default. SHAKE off: zero
   shake.
8. The 3D MENU camera equals rig C at each CAMERA preset on the first MENU
   frame.
9. A headed look at 390×844 (`p`) and 844×390 (`l`): the prompt is readable,
   the pad is hidden, and nothing clips.

Save notes and captures under `.superpowers/sdd/2026-10-09-opening/`. Before
trusting any headed 3D capture, unregister the service worker and delete its
caches.

## 13. Owner rulings and accepted trade-offs

- **Q1. Title in REAL 3D for everyone? Ruling 2026-10-09 (user): no. The
  title look follows the RENDER setting.**
  - "Drifting 3D board" is literally true only for RENDER = 3D.
  - The default is CLASSIC 2D, so most first visits see the 2D drift.
  - Forcing 3D would have lazy-loaded three for every visitor and swapped
    kinds at MENU.
- **Q2. The `intro` track goes dormant. Ruling 2026-10-09 (user): the MENU
  theme plays throughout. The `intro` track stays in code, pinned and
  unused.**
  - The rejected alternative: play `intro` for the show and hand off to
    `menu` on the bar line. That would have needed `applyTrack` to keep
    `nextT` on a switch, plus a flip timed under the 0.12 s lookahead.
- **Q3. The title never times out** to ATTRACT, and stays silent: the browser
  rule. Accepted per the user's pick.
- **Accepted:**
  - Up to one frame plus about 0.05 s of skew between the visual grid and the
    menu track's step 0.
  - When the 3D board is still loading at the press, the music and sting
    start at the press and the show starts later, off the music's grid.
  - The §5 hatch can start a silent show on a device whose ctx never runs.
    The music joins at the next activating gesture (the listeners stay
    armed), off-grid and with no sting.
  - A tab hidden mid-show pauses the visuals while the music continues.
  - WebKit/iOS unlock is reasoned from its handler rule, not measured (no
    CDP).

## 14. PWA bump and docs

**PWA:** one paired bump, `CACHE_NAME` = `REV` = the next free
`fusegrid-shell-vN`, with `src/app/unlock.js` added to the shell list.

**AGENTS.md text to update:**

- **Shell table row.** Replace `INTRO → MENU` with:
  `INTRO (title → show) → MENU`.
  Add: "INTRO is two phases inside one SCREEN (`app.introStage` 0 title / 1
  show), never a new SCREEN value. The title waits silently for a press; the
  first press that leaves the AudioContext running starts the menu track,
  the `uiJingle` sting and a 32-step (4.384 s) show; the blast lands MENU at
  cursor 0. Every visit, the first included (ruling 2026-10-09, reverses
  first-visit Play Now). Deep links and autoplay bypass it."
- **Audio paragraph.** Replace "`reveal` is a cue" context with: "Unlock is
  `src/app/unlock.js` `armUnlock`: keydown / pointerdown / pointerup /
  touchend / click, armed until `ctx.state === "running"` (Escape and a touch
  `pointerdown` carry no activation); a second press that is not Escape or a
  modifier/lock key, with the ctx still not running 250 ms later, starts the
  show silent. `unlocked()` means running and
  gates `pump()`. `musicCue(INTRO)` is `menu`; the `intro` track is dormant
  (ruling 2026-10-09)."
- **`src/app/` retention paragraph.** Amend `nb.cabinet.v1`: "still written
  on the first INTRO exit, no longer branches."
- **Learned User Preferences.** Add: "Opening (2026-10-09): title, then press,
  then a ~4 s show (camera sweep, MAKO pop-in, fuse, blast reveals MENU),
  with music from the press. Any key skips the show (the title waits for a
  press). First visits land on MENU at PLAY, not in a run. The title follows
  RENDER; the show plays the MENU theme throughout, and the `intro` track
  is kept unused."
- **`MEMORY.md`.** Add a dated entry with the unlock measurements from §1 and
  the reversal.
