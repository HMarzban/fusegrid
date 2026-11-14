# Controller discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player who plugs in any controller is told what to do, and the game names what it found, without the player having to find SETTINGS › CONTROLS.

**Architecture:** Three pieces on top of shell v219.

1. A small DOM help card, `#padhelp` (new boot module `src/app/padhelp.js`, the same pattern as the consent card `#ana`). It shows on MENU while no controller is in, says "press any button", and on Chrome for macOS carries a CONNECT SWITCH 2 key. A click on that key is the user activation Chrome needs to open its USB chooser.
2. The menu note and the HUD toast that `controlswire.js` already raises on connect / back / lost now name the controller family (`XBOX CONTROLLER READY`).
3. A controller in an unknown button order (mapping `""`, not in `gamepad.js` `KNOWN`) gets the note and toast `NON-STANDARD BUTTONS` with the way to CONTROLS. That page already handles this state (`controlsgeo.js` "NON-STANDARD BUTTONS · TEST EACH ONE · REBIND IF WRONG").

**Tech Stack:** Pure ES modules, zero npm deps, `node --test` style check scripts in `tests/*.test.mjs`.

**Spec:** There is no separate design doc. The binding source is the owner's request, verbatim (2026-11-14): "can we do this automaticly, I mean when chrome find the controller show a propmt or something? beacuse users report that they have diffrent controller and they plug and unplug and the game must discover and track this behavior automaticly". The owner then answered "Yes, write the plan" to the three proposals this plan builds. Background on the controller work: `docs/superpowers/plans/2026-11-14-every-controller-and-keyboard.md`, `docs/controllers.md`, and AGENTS.md's CONTROLS paragraph.

**What the browser forbids (why this is not "fully automatic"):**

- Chrome shows a page no USB device the page was not granted, and fires no `connect` event for one, so an un-granted Switch 2 Pro is invisible until the chooser.
- `navigator.usb.requestDevice` opens only inside a user activation (a click, key or tap).
- Every browser hides a gamepad until its first button press (fingerprinting rule).

So the card cannot appear *because* a controller was plugged in. It is shown proactively and leaves once a controller is seen. Everything after the first grant is already automatic in v219: `switch2.js` `auto()` runs on every visit and on USB `connect`, and `controlswire` tracks found / lost.

**Lead rulings (the owner may veto each):**

- **L1:** the card shows on MENU only, on the keyboard layout `d` only (a touch layout's corner belongs to the bomb key, and phones rarely carry a controller).
- **L2:** the card retires for good once any controller has been seen in this browser, or after GOT IT, or after 3 runs started with no controller seen (a keyboard player is not nagged).
- **L3:** notes and the toast print the family name: XBOX CONTROLLER, PLAYSTATION CONTROLLER, NINTENDO CONTROLLER, else CONTROLLER. This follows R-LABELS ("detect true and show the users the right label"). CONTROLLER LOST stays generic: the pad is gone, and that string is pinned across PAUSE.
- **L4:** the unknown-order wording is the CONTROLS page's own `NON-STANDARD BUTTONS`.

## Global Constraints

- Zero npm deps. No build step. Node v26, `"type": "module"`.
- `src/app` never imports `src/render`. Every player string in `src/app` is a literal that `tests/words.test.mjs` pins equal to `src/render/words.js`.
- `src/app` never calls `Date`. Times come in as frame time `t` (ms) or from main.
- One `nb.*` key per store. A new key joins `src/app/reset.js` `KEEP_KEYS` or `CLEAR_KEYS`, or `tests/reset.test.mjs` fails.
- DOM cards take colours only from the `--k-*` custom properties in `index.html`. Every `#id` display rule needs its `[hidden]{display:none}` twin (`tests/hidden-css.test.mjs`).
- The controller id is matched only in `padfamily.js` / `gamepad.js`. It is never printed, stored or sent, and the family never reaches analytics (`tests/analytics.test.mjs`).
- No new letter shortcut. The card answers clicks only. The shortcut letter list stays R C B T Q E M Y N U.
- `src/main.js` stays `<= 799` lines (`tests/headless.test.mjs`).
- Any shipped file change bumps `CACHE_NAME` in `src/pwa/shell.js` and `REV` in `sw.js` together, to `fusegrid-shell-v220`.
- Code style: compact, no whitespace after keys, comments only where the file already uses them.

## Review Focus

1. **A keyboard-only player.** The card must stop after GOT IT or after 3 runs, and never show during a run, INTRO or ATTRACT. Pinned in Task 3 (`help retires after three runs`, `help never off MENU`).
2. **CONNECT with nothing to pick.** When Chrome's chooser closes empty or is cancelled, the card says `NOT CONNECTED · TRY AGAIN`, stays, and a second click asks again. Pinned in Task 3 (`connect cancelled keeps the card`).
3. **Three cards at once.** The consent card, NEW VERSION READY and the help card share the bottom-right corner. Only one shows: help waits while either other card is up. Pinned in Task 3 (`help waits for ana and upd`).
4. **Switching controllers.** An Xbox pad out, then a PlayStation pad in, must re-name the note. A non-standard pad must read `CONTROLLER`, never a family. Pinned in Task 2 (`note follows the family`, `nonstd note is generic`).
5. **Storage that throws** (private mode, blocked site data). The card still works and simply forgets. Pinned in Task 3 (`store throws, card still works`).

---

### Task 1: Words — family names, unknown-order note, help-card copy

**Files:**
- Modify: `src/render/words.js` (beside `PAD_TOAST`, `PAD_FAMILY_WORDS`)
- Modify: `src/app/padfamily.js`
- Modify: `src/render/pages/menu.js:186-191` (`padSign`, `noteCands`)
- Modify: `src/render/hud.js:74-79` (`toastState`)
- Test: `tests/words.test.mjs`, `tests/padfamily.test.mjs`, `tests/hud-toast.test.mjs` (`toastState`), `tests/page-menu.test.mjs` (`padSign`, `noteCands`; neither has a direct test today)

**Interfaces:**
- Produces in `words.js`:
  - `PAD_NAME` = frozen `{xbox:"XBOX CONTROLLER", playstation:"PLAYSTATION CONTROLLER", nintendo:"NINTENDO CONTROLLER", generic:"CONTROLLER"}`
  - `PAD_ODD` = `"NON-STANDARD BUTTONS"`
  - `PAD_HELP_WORDS` = frozen `{title:"PLAYING WITH A CONTROLLER?", body:"Plug it in and press any button on it. A browser shows a controller to a game only after its first press.", sw2:"A Switch 2 Pro Controller on a cable needs one click here first.", go:"CONNECT SWITCH 2", no:"GOT IT", press:"PRESS ANY BUTTON ON IT"}`
  - `PAD_TOAST` gains `ODD_BODY: PAD_ODD + " · " + TO_CONTROLS`
- Produces in `padfamily.js`: `FAMILY_NAME`, a literal equal to `PAD_NAME`, and `nameOf(family) -> string` (unknown family → `"CONTROLLER"`).
- Note grammar that Task 2 writes and `menu.js` reads:
  - `<NAME> READY`
  - `<NAME> READY · VIBRATION <LEVEL>`
  - `<NAME> BACK`
  - `CONTROLLER READY · NON-STANDARD BUTTONS`
  - `CONTROLLER LOST`
- `app.padToast` gains two fields: `name` (a `PAD_NAME` value) and `odd` (bool).

- [ ] **Step 1: Write the failing tests**
  - `words.test`, "padfamily FAMILY_NAME is words.js PAD_NAME": `J(PF.FAMILY_NAME) === J(W.PAD_NAME)`.
  - `padfamily.test`, "nameOf": `nameOf("xbox") === "XBOX CONTROLLER"`, `nameOf("generic") === "CONTROLLER"`, `nameOf("zzz") === "CONTROLLER"`.
  - MENU test, "padSign takes family names":
    - `padSign("PLAYSTATION CONTROLLER BACK")` and `padSign("XBOX CONTROLLER READY · VIBRATION HIGH")` are non-empty.
    - `padSign("CONTROLLER READY · NON-STANDARD BUTTONS")` is non-empty.
    - `padSign("CONTROLLER LOST") === ""`.
  - MENU test, "nonstd note candidates": `noteCands({pad:"CONTROLLER READY · NON-STANDARD BUTTONS"})[0] === "NON-STANDARD BUTTONS · " + TO_CONTROLS`, and its last entry is `"NON-STANDARD BUTTONS"`. `noteCands` is module-private today (`menu.js:188`): export it as `_noteCands`, a test seam.
  - HUD toast test:
    - `toastState(play, {padToast:{k:"ready", name:"XBOX CONTROLLER", move:"D-PAD", bomb:"A", a:1}}).s` starts with `"XBOX CONTROLLER READY · "`.
    - Its `.alt` starts with `"CONTROLLER · READY · "`.
    - With `odd:true`, `.s === "CONTROLLER READY · NON-STANDARD BUTTONS · " + TO_CONTROLS`.
    - A toast with no `name` reads exactly as today (`"CONTROLLER READY · "`).

- [ ] **Step 2: Run them, expect FAIL** — `node --test tests/words.test.mjs tests/padfamily.test.mjs tests/hud-toast.test.mjs tests/page-menu.test.mjs`.

- [ ] **Step 3: Implement**
  - `PAD_NAME`, `PAD_ODD`, `PAD_HELP_WORDS` and `PAD_TOAST.ODD_BODY` in `words.js`.
  - `FAMILY_NAME` / `nameOf` in `padfamily.js`.
  - In `menu.js`, `padSign` matches `^(XBOX |PLAYSTATION |NINTENDO )?CONTROLLER (READY|BACK)( · VIBRATION \w+)?$` (built from `PAD_NAME` and `SETTINGS_WORDS.vib`, never a hand-typed list) plus the exact odd note. `noteCands` for the odd note returns the three candidates above. For a family READY note it keeps today's step-down, with the family name in place of `CONTROLLER`.
  - In `hud.js`, `toastState` builds the head as `(q.name || PAD_TOAST.SHORT) + " " + STATE`. `alt` becomes `PAD_TOAST.SHORT + " · " + STATE + " · " + body`, which replaces the `head.slice(...)` that assumed the head starts with `CONTROLLER`. The body is `PAD_TOAST.ODD_BODY` when `q.odd`.

- [ ] **Step 4: Run the tests, expect PASS.** Then run `npm test` and expect the full suite green. Any pinned string that moved is a failure to look at, not to re-pin blindly.

- [ ] **Step 5: Commit** — `git commit -m "words: controller family names and the non-standard note"`

### Task 2: The wire names what it found and gives CONNECT one entry point

**Files:**
- Modify: `src/app/controlswire.js` (constants line 8, `noteTick` ~304-317, `toastTick` ~321-326, the `snap.found` branch ~341-345, `connect` ~104-110, the returned API ~396-408)
- Test: `tests/controlswire.test.mjs`

**Interfaces:**
- Consumes: `nameOf` and literals equal to Task 1's `PAD_ODD` (`src/app` keeps its own literal, pinned by `words.test`).
- Produces on the object `mountControls` returns:
  - `padIn() -> boolean`: a controller is connected now (`pad.snap().connected`).
  - `sw2Connect() -> Promise<"woken"|"cancelled"|"busy"|"failed"|"blocked"|"pad"|"none">`:
    - `"none"` when no waker exists (not Chrome on macOS, or `switch2.js` not in yet).
    - `"pad"` when the call has no user activation.
    - Otherwise the result of `waker.request()`.
    - It never needs the CONTROLS page. The page's `connect()` keeps its behaviour and calls the same inner function.
- The note and toast words follow the Task 1 grammar. The family is `famNow()`, so a non-standard pad is generic.

- [ ] **Step 1: Write the failing tests** (fake `getGamepads`, as the file's existing pad tests do)
  - "note follows the family":
    - A standard pad whose id carries `Vendor: 045e` is found on MENU, so `app.padNote === "XBOX CONTROLLER READY"`.
    - Lose it and find a `Vendor: 054c` pad, so the note reads `"PLAYSTATION CONTROLLER READY"`. The note for the loss in between is `"CONTROLLER LOST"`.
  - "back names the family": lose and re-find the same Xbox pad, so the note is `"XBOX CONTROLLER BACK"`.
  - "nonstd note is generic": a `mapping:""` pad with 20 buttons and an Xbox vendor id, so the note is `"CONTROLLER READY · NON-STANDARD BUTTONS"`.
  - "toast carries name and odd": found during a PLAYing run, so `app.padToast.name === "XBOX CONTROLLER"` and `odd === false`. For the non-standard pad, `name === "CONTROLLER"` and `odd === true`.
  - "padIn": false before a press, true after the found poll.
  - "sw2Connect without a waker": `await ctl.sw2Connect() === "none"`.
  - "sw2Connect needs activation": with an injected `importSwitch2` waker stub and `activation:{isActive:false}`, the result is `"pad"` and the stub's `request` is not called. With `isActive:true`, `request` is called once and its value is returned.
  - Existing tests that assert `"CONTROLLER READY"` for a generic pad must still pass unchanged.

- [ ] **Step 2: Run, expect FAIL** — `node --test tests/controlswire.test.mjs`.

- [ ] **Step 3: Implement.**
  - Build `READY` / `BACK` from `nameOf(famNow())` at the moment the note or toast is written, not from the constants alone.
  - For the odd note use `"CONTROLLER READY · " + ODD` and skip the vibration tail.
  - Add `name` and `odd` to `app.padToast`, keeping its change check so the HUD repaints only on change.
  - Split `connect()` into an inner `ask()` that returns the request promise. `connect()` keeps writing `page.sw2Said(...)`, and `sw2Connect` returns the raw result.

- [ ] **Step 4: Run, expect PASS.** Then `npm test` all green (`words.test` pins the new `src/app` literals).

- [ ] **Step 5: Commit** — `git commit -m "controls: notes and toast name the controller; one CONNECT entry"`

### Task 3: The help card

**Files:**
- Create: `src/app/padhelp.js`
- Modify: `src/main.js` (one mount line after `mountControls`, line ~470)
- Modify: `index.html` (the `#padhelp` CSS beside `#ana`, including its `[hidden]` twin and the reduced-motion rule)
- Modify: `src/app/reset.js` (`PADHELP_KEY` into `KEEP_KEYS`)
- Modify: `src/app/controlspage.js` (import `SW2_WORDS` from `padhelp.js` and re-export it, instead of defining it, so the boot module owns the one copy)
- Test: create `tests/padhelp.test.mjs`. Also touched: `tests/reset.test.mjs` and `tests/words.test.mjs` (pins `HELP_WORDS` to `PAD_HELP_WORDS` and the moved `SW2_WORDS`).

**Interfaces:**
- Consumes: `ctl.padIn()`, `ctl.sw2()` (`.shown`), `ctl.sw2Connect()` from Task 2; `upd.shown` and `ga.shown`.
- Produces from `src/app/padhelp.js`:
  - `PADHELP_KEY = "nb.padhelp.v1"`.
  - `HELP_WORDS`: a literal equal to `PAD_HELP_WORDS`.
  - `SW2_WORDS`, moved byte for byte from `controlspage.js`.
  - `loadHelp(store) -> {s:0|1, x:0|1, r:number}` returns the defaults for missing, junk or a throwing store. `saveHelp(v, store)` swallows a throw.
  - `helpDone(st) -> boolean` is `st.s || st.x || st.r >= 3`.
  - `helpVisible({screen, S, lay, busy, padIn, done, capturing}) -> boolean` is true only on `screen === S.MENU && lay === "d" && !busy && !padIn && !done && !capturing`.
  - `mountPadHelp({get, ctl, store, doc, win}) -> {tick, get shown(), get state()}`:
    - It builds `#padhelp` with `role="region"` and `aria-label="Controller help"`.
    - It ticks every 250 ms, like `analytics.js`.
- Card content, in order:
  - `<b>` title
  - `<i>` body
  - while `ctl.sw2().shown`: an `<i>` with the `sw2` line, then `.go` CONNECT SWITCH 2
  - `.no` GOT IT
  - a status `<i class="st">`, empty at rest
- Behaviour:
  - Clicks act on `pointerup` with `stopPropagation` on `pointerdown` and `pointerup`, exactly as `#ana`, so no tap reaches the canvas.
  - The `.go` pointerup calls `ctl.sw2Connect()` once per press. A press while an earlier one is still pending does nothing.
  - On the result:
    - `"woken"`: status `SW2_WORDS.ok + " · " + HELP_WORDS.press`, and the card stays until a pad is in.
    - `"cancelled"`, `"busy"`, `"failed"` or `"blocked"`: status is that `SW2_WORDS` line, and the card stays.
    - `"pad"` or `"none"`: status stays empty.
  - `.no` sets `x=1`, saves and hides.
- The tick:
  - When `ctl.padIn()` turns true, set `s=1`, save and hide for good.
  - Count a run on each MENU→GAME screen edge it sees (`r++`, saved).
  - Visibility is `helpVisible(...)`, with `busy = upd.shown || ga.shown`.

- [ ] **Step 1: Write the failing tests** (fake doc and store, in the style of `tests/analytics.test.mjs`)
  - "loadHelp defaults": no key, `"{bad"`, and a store whose `getItem` throws all give `{s:0,x:0,r:0}`.
  - "help never off MENU": `helpVisible` is false for GAME, INTRO, ATTRACT, SETTINGS and CONTROLS, and true for MENU with `lay:"d"` and all flags clear.
  - "help waits for ana and upd": with `busy:true`, `helpVisible` is false.
  - "help hides while a pad is in": with `padIn:true`, false.
  - "help retires after three runs": mount, step the fake app MENU→GAME→MENU three times through `tick()`, and the card is hidden with `loadHelp(store).r === 3`. A fresh mount on the same store never shows.
  - "seen pad retires it": `padIn` true for one tick sets `s:1` in the store. Later ticks with `padIn` false keep it hidden.
  - "GOT IT": a pointerup on `.no` saves `x:1` and hides.
  - "connect button only where it reaches": with `ctl.sw2()` `{shown:false}` there is no `.go` element (or it is hidden); with `{shown:true}` it is present.
  - "connect woken": `sw2Connect` resolves `"woken"`, so the status text is `"CONNECTED · PRESS ANY BUTTON ON IT"` and the card is still shown.
  - "connect cancelled keeps the card": the status is `"NOT CONNECTED · TRY AGAIN"`, the card is still shown, and a second pointerup calls `sw2Connect` a second time.
  - "one ask at a time": two pointerups before the promise settles make one call.
  - "taps stop at the card": pointerdown and pointerup events on the card have `stopPropagation` called.
  - "store throws, card still works": a store whose `setItem` throws still lets GOT IT hide the card for this session.
  - `reset.test`: `KEEP_KEYS` includes `"nb.padhelp.v1"`. The existing unclassified-literal check passes.
  - `words.test`: `HELP_WORDS` deep-equals `PAD_HELP_WORDS`, and `SW2_WORDS` (now from `padhelp.js`) still equals `words.js` `SW2_WORDS`.
  - `hidden-css.test` passes with the new `#padhelp` rules.

- [ ] **Step 2: Run, expect FAIL** — `node --test tests/padhelp.test.mjs tests/reset.test.mjs tests/words.test.mjs tests/hidden-css.test.mjs`.

- [ ] **Step 3: Implement**
  - Write `padhelp.js`.
  - Add the CSS: `#padhelp` reuses `#ana`'s rule set (position bottom-right 16 px, width `min(330px,calc(100vw - 32px))`, the kit plate) with `.go` and `.no` styled like `#ana .yes` / `.no`, plus `#padhelp[hidden]{display:none}` and the reduced-motion line.
  - Add the main mount line: `const help = mountPadHelp({ get: () => ({ app, SCREEN, busy: () => upd.shown || ga.shown }), ctl });`. Keep main at `<= 799` lines.
  - Add `PADHELP_KEY` to `KEEP_KEYS`.
  - Move `SW2_WORDS`.

- [ ] **Step 4: Run, expect PASS.** Then `npm test` all green. `tests/loadbar.test.mjs` will fail on the new boot file: re-pin with its `--write` and check that the only change is `src/app/padhelp.js` joining the boot graph.

- [ ] **Step 5: Headed check.** Run `PORT=0 node serve.js`, then open it in a fresh Chrome profile with no controller granted:
  - On MENU the card shows with CONNECT SWITCH 2.
  - A click opens Chrome's chooser.
  - Cancel gives `NOT CONNECTED · TRY AGAIN`.
  - GOT IT hides the card, and a reload keeps it hidden.
  - Stop the server by PID.
  - The real Switch 2 grant is the owner's step in Task 4.

- [ ] **Step 6: Commit** — `git commit -m "padhelp: a corner card that tells a player how to bring a controller in"`

### Task 4: Release v220 and docs

**Files:**
- Modify: `src/pwa/shell.js` (`CACHE_NAME = "fusegrid-shell-v220"`, `padhelp.js` in `SRC`, boot)
- Modify: `sw.js` (`REV` to v220)
- Modify: `AGENTS.md` (CONTROLS paragraph: the card, the family notes, the odd note; the `src/app` seams list gains `padhelp.js`; a release-state line)
- Modify: `CHANGELOG.md` (v220), `docs/architecture.md`, `docs/controllers.md` (what is automatic, what needs one click and why), `docs/diary.md`, `MEMORY.md`, `sitemap.xml` `lastmod` at release

- [ ] **Step 1:** Bump `CACHE_NAME` / `REV` and add the file to the shell lists. Run `node --test tests/pwa.test.mjs tests/loadbar.test.mjs` and expect PASS.
- [ ] **Step 2:** Write the docs. In particular:
  - Name the three browser rules from this plan's Architecture section in `docs/controllers.md`.
  - Record L1–L4 as lead rulings the owner may veto.
- [ ] **Step 3:** Run `npm test` and expect every test green. Record the count.
- [ ] **Step 4: Owner hardware checks**, listed in CHANGELOG as open until the owner reports:
  - (a) On the live-like build, the card shows, CONNECT SWITCH 2 opens the chooser, picking the controller then pressing a button gives `NINTENDO CONTROLLER READY`, and the card is gone.
  - (b) An Xbox-type controller reads `XBOX CONTROLLER READY` on MENU, and unplugging it in a run pauses with CONTROLLER LOST.
  - (c) A keyboard-only browser sees the card at most until GOT IT or 3 runs.
- [ ] **Step 5: Commit** — `git commit -m "Release v220: controller discovery"`. Do not push: pushing is the owner's call.
