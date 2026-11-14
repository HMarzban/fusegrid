# Every Controller And The Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal (owner, 2026-11-14):** "all gamers must can play the game with all controllers and also keyboard properly". What this plan delivers toward it, stated without overclaiming: pads a browser already maps (`standard`) keep working as today; the Switch 2 Pro Controller plays fully, vibration included, over a USB cable in Chrome on macOS, with no tool to install; unknown pads whose layout is captured get a `KNOWN` row; every other pad keeps the CONTROLS rebind path; keycaps and letter shortcuts follow the player's own keyboard layout.

**Architecture:** Three layers on the existing CONTROLS seams. (1) Layout: `gamepad.js` `KNOWN` / `asStandard` / `standardPads` (Task 0, done) put a known pad in the standard order once, in `controlswire`; captures from a probe page add rows; a hat-switch reader covers captured hat pads. (2) Reach: a lazy `src/app/switch2.js` wakes the Switch 2 Pro over WebUSB (one chooser, then automatic) and drives its rumble over WebHID through a `vibrationActuator` stand-in, so `rumble.js`, `routesOf`, `canBuzz` and `padInfo` stay as they are. (3) Keyboard: a session name map (layout map + plain keydowns) feeds every printed key, and letter shortcuts match the letter, not the position.

**Tech Stack:** Plain ES modules, WebUSB, WebHID, Gamepad API, Keyboard Map API, `node --test`. Zero npm dependencies.

**Spec:** No spec document; the plan carries its fixed values. Measured facts (owner's pad, Chrome, macOS 27.0.1, 2026-11-14):
- Switch 2 Pro Controller, USB `057e:2069`. Interfaces: 0 HID, 1 vendor (bulk OUT `0x02`, IN `0x82`), 2-4 audio. Nothing reaches a browser until a start-up sequence goes to interface 1.
- The 10 packets in Task 2 (SDL's, with the report-format packet set to `09` instead of SDL's `05`) make the pad send HID report `0x09`; Chrome then shows a 21-button, 6-axis pad, mapping `""`, no actuator. Task 0's `KNOWN` row maps it; verified in play.
- WebUSB in a page: `requestDevice`, `open`, `claimInterface(1)`, all 10 `transferOut(2)` ok; `getDevices()` returns the pad on later clicks with no chooser; waking an awake pad again is harmless (trial page, `.superpowers/sdd/2026-11-14-switch2-webusb-spike/RESULT.md`, git-ignored).
- WebHID in the same page: `sendReport(0x02, 63 bytes)` of SDL's HD rumble in format `09`: the owner felt it ("Yes, it shook").
- Other Switch 2 ids (Joy-Con 2 R `2066`, L `2067`, pair `2068`, NSO GameCube `2073`) are not measured.
- The ported packets and the HD-rumble encoder come from SDL (`src/joystick/hidapi/SDL_hidapi_switch2.c`, zlib licence): credited in the module header and `docs/architecture.md`.

## Not in this plan (told to the owner before work, 2026-11-14)

- Any controller over Bluetooth for Switch 2 (no browser sees it; Web Bluetooth would be its own plan).
- Joy-Con 2 and the NSO GameCube pad, until probe captures exist.
- Safari, Firefox, every iOS browser: no WebUSB / WebHID; a Switch 2 controller there needs an outside tool. The row is hidden.
- Windows (needs a WinUSB driver on interface 1), Linux (needs a udev rule), Android (WebUSB, no WebHID), an itch.io iframe (permissions policy): the CONNECT row stays hidden until each is measured.

## Owner rulings

- **R-LABELS (2026-11-14, owner, verbatim):** "you know it might user connect the playstastion controller or xbox controller or other regular controller, so our system must be smart and detact true and show the users the right lable". This reverses AGENTS.md CONTROLS "Button names are by position only … no maker's name anywhere" for the words a player reads: the game names a button the way the connected controller prints it (Task 9). Positions (`S E W N …`) stay the internal ids, the binds and the store; an unknown pad keeps the position words. The CONNECT row reads `SWITCH 2 CONTROLLER` (it is for exactly that pad).

## Global Constraints

- Zero `package.json` runtime dependencies; no build step.
- `src/app` never imports `src/render`; player strings in `src/app` are literals pinned to `src/render/words.js` by `tests/words.test.mjs`.
- The device id is matched, never printed or stored. No GA event or user property names a controller.
- No pad route to the consent card, the STATS wipe or the camera reset.
- `src/app/switch2.js` is loaded by dynamic `import()` only; it joins `tests/loadbar.test.mjs` `LAZY` (near line 101) and `src/pwa/shell.js` `SRC` / `LATER`, never `BOOT`.
- Rumble obeys `rumble.js` `LIMITS` and the VIBRATION level; OFF is zero calls; it plays only while `app.lastDev` is the pad (the row's test pulse excepted), as today.
- Before every owner check of shipped bytes, bump `CACHE_NAME` (`src/pwa/shell.js`) and `REV` (`sw.js`) together on the branch; at merge, renumber to the next number free on `main`.
- A new key, row or screen joins `tests/keys.test.mjs`; a new CONTROLS row is re-measured in `tests/page-controls.test.mjs` and `tests/landscape.test.mjs`.
- Never push. Work only in the worktree `.claude/worktrees/every-controller` on `feature/every-controller`; other sessions commit in the main checkout. A dated `MEMORY.md` line per task.

## Review Focus

- A browser or platform the matrix has not measured never shows the CONNECT row, and nothing throws there: Task 3.
- A woken pad unplugged and plugged back in, or the page reloaded, plays again with no chooser: Task 1b (real pad), Task 2 (fake).
- The chooser cancelled, the claim refused, or the page blocked by policy: the row names the real reason, the page keeps working: Tasks 2 and 3.
- A pad another app is already driving is left alone; only an explicit CONNECT wakes a visible pad again: Task 2.
- A vibration in flight stops when the tab hides, the page closes or the pad leaves, and a newer effect is never cut by an older one's end: Task 4.

---

### Task 0: Switch 2 Pro layout fix · DONE

Commits `4b81d1a` and `5d9c3bc` on `feature/every-controller`: `KNOWN` (id plus 21 buttons / 6 axes), `asStandard`, `standardPads` in `controlswire`; tests in `tests/gamepad.test.mjs`; AGENTS / architecture / MEMORY lines. The main checkout still holds the same three files uncommitted; restore them there (`git checkout -- src/app/gamepad.js src/app/controlswire.js tests/gamepad.test.mjs`) once the owner agrees, never a bare `git diff` / `git apply` of the whole tree (another session's v216 work sits there too).

### Task 1 / 1b: Trials · DONE (GO)

Owner sessions on the trial page, 2026-11-14 (`RESULT.md` beside it): wake from the page works; the pad keeps streaming after `releaseInterface(1)` + `close()`; a replug fires `connect` and wakes with no chooser; waking again is harmless; 05 -> 09 switches with no replug (the local tool); WebHID vibration felt. Not measured: a reload with the pad awake, a second tab (`auto()` re-waking a pad it cannot see yet covers both). An "XBOX 360 For Windows" pad on the same Mac reads `standard`, 17 buttons, 4 axes, actuator true.

### Task 2: `src/app/switch2.js`, the waker

**Files:**
- Create: `src/app/switch2.js`, `tests/switch2.test.mjs`
- Modify: `src/pwa/shell.js` (`SRC`, `LATER`), `tests/loadbar.test.mjs` (`LAZY`)

**Interfaces:**
- Produces:
  - `export const SW2_USB = [0x2069]` (vendor `0x057e`; another id joins only with its `KNOWN` row from a capture)
  - `export function initPackets(): Uint8Array[]`, exactly these, in order:
    ```
    07 91 00 01 00 00 00 00
    0c 91 00 02 00 04 00 00 27 00 00 00
    11 91 00 01 00 00 00 00
    0a 91 00 08 00 14 00 00 01 ff ff ff ff ff ff ff ff 35 00 46 00 00 00 00 00 00 00 00
    0c 91 00 04 00 04 00 00 27 00 00 00
    01 91 00 0c 00 00 00 00
    01 91 00 01 00 00 00 00
    08 91 00 02 00 04 00 00 01 00 00 00
    03 91 00 0a 00 04 00 00 09 00 00 00
    03 91 00 0d 00 08 00 00 01 00 ff ff ff ff ff ff
    ```
  - `export async function wake(device): Promise<"woken"|"busy"|"failed">`: `open()` if not open, `selectConfiguration(1)` only if `configuration` is null, `claimInterface(1)` (a refusal is `"busy"`), every packet `transferOut(2, p)` (any non-`ok` is `"failed"`), no `transferIn`; then `releaseInterface(1)` and `close()` (Task 1b: the pad keeps streaming).
  - `export function usbReach({usb, policy, platform}): boolean`: true only when `usb` exists, `policy` allows `"usb"` (`document.permissionsPolicy?.allowsFeature("usb")`, or `document.featurePolicy`), and `platform` is a measured one (today `"macOS"`, from `navigator.userAgentData?.platform`, falling back to `/Mac OS X/` in the user agent).
  - `export function createWaker({usb, pads}): {request(): Promise<"woken"|"cancelled"|"busy"|"failed"|"blocked">, auto(): Promise<number>, state(): "idle"|"waking"|"woken"|"cancelled"|"busy"|"failed"|"blocked", stop(): void}`. `pads()` is `getGamepads`. `auto()` wakes each `getDevices()` pad that `pads()` does not already show (a visible pad is left alone), and listens on `usb` `connect` for `SW2_USB` devices until `stop()`. `request()` is the chooser: `NotFoundError` is `"cancelled"`, `SecurityError` is `"blocked"`; it always wakes, visible or not.

- [ ] **Step 1: Write the failing tests** (`tests/switch2.test.mjs`, fake `usb` and devices recording every call):
  - `initPackets()` deep-equals the bytes the local bridge sent and the trial page verified (the table above, fixture copied from `.superpowers/sdd/2026-11-14-switch2-pro-bridge/pro2wake.py` with byte 8 of packet 9 set to `0x09`); each length is `p[5] + 8`.
  - `wake` order: `open`, `claimInterface(1)`, ten `transferOut(2, …)` equal to `initPackets()`, then the Task 1b close; `selectConfiguration` only when `configuration` is null; a rejected claim gives `"busy"`, a `transferOut` status `"stall"` gives `"failed"`.
  - `auto()` wakes a permitted pad with no `requestDevice` call; skips it when `pads()` already holds a `057e`/`2069` pad; a `connect` for `SW2_USB` wakes; a `connect` for another vendor does nothing; after `stop()` a `connect` does nothing.
  - `request()` gives `"cancelled"` / `"blocked"` / `"busy"` / `"woken"` for `NotFoundError` / `SecurityError` / a refused claim / success; a second `request()` while `"waking"` returns the first one's promise.
  - `usbReach`: false with no `usb`, false when the policy denies `usb`, false on `"Windows"`, `"Linux"`, `"Android"`, true on `"macOS"`.
- [ ] **Step 2:** `node --test tests/switch2.test.mjs`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement. No DOM or `navigator` read inside the functions: everything is injected. Header comment credits SDL (zlib).
- [ ] **Step 4:** `node --test tests/switch2.test.mjs`. Expected: PASS.
- [ ] **Step 5:** Add the module to `SRC`, `LATER` and `LAZY`; `npm test`. Expected: all pass.
- [ ] **Step 6:** Commit `switch2: wake a Switch 2 Pro Controller over WebUSB`; MEMORY line.

### Task 3: The CONNECT row on CONTROLS

**Files:**
- Modify: `src/app/controlswire.js` (load and own the waker; `auto()` at the title through the injected `defer` / `idle`, the `later(warm)` path), `src/app/controlspage.js` (row `SW2`; exempt it from the `noPad()` early return in `confirm`), `src/render/controlsgeo.js` (exempt it from the `gone` verb blanking, near line 124), `src/render/pages/controls.js` (draw it on the CONTROLLER tab, in the NO CONTROLLER body too), `src/render/words.js` (`SW2_WORDS`), `src/app/pointer.js` only if the tap path needs `pointerup`
- Test: `tests/controlswire.test.mjs`, `tests/controlspage.test.mjs`, `tests/page-controls.test.mjs` (the list-rect count near line 211 and the callout fits at 1366 / 1280 re-measured), `tests/landscape.test.mjs`, `tests/words.test.mjs`, `tests/keys.test.mjs`, `tools/ui/lib/screens.mjs` plus a `tools/ui/shots.mjs` recipe that fakes `navigator.usb` (as `pad` fakes `getGamepads`), so `controls` captures draw the row on purpose

**Interfaces:**
- Consumes: `createWaker`, `usbReach` (Task 2).
- Produces: `ctl.sw2(): {shown: boolean, state: string}`; row id `SW2` on the CONTROLLER tab after VIBRATION, before RESET; `SW2_WORDS = {row: "SWITCH 2 CONTROLLER", door: "CONNECT", ok: "CONNECTED", cancel: "NOT CONNECTED · TRY AGAIN", busy: "IN USE BY ANOTHER APP", failed: "COULD NOT START IT HERE", blocked: "NOT ALLOWED ON THIS PAGE", pad: "PRESS ENTER OR CLICK", vib: "ALLOW VIBRATION", help: "It needs a USB cable. Your browser asks once which controller, and once more for vibration."}`, mirrored as a literal in `src/app` and pinned.

- [ ] **Step 1: Write the failing tests:**
  - `usbReach` false: no `SW2` row on either tab, `ctl.sw2().shown === false`, nothing throws.
  - `usbReach` true and no pad connected (`padView().state === "none"`): the row is drawn and walkable in the NO CONTROLLER body; Enter, a click and a touch tap (on `pointerup`) call `request()` once; SOUTH shows `SW2_WORDS.pad` and calls nothing (a pad press is no user activation).
  - Each `request()` result shows its word (`ok`, `cancel`, `busy`, `failed`, `blocked`).
  - With a permitted pad, `auto()` runs at the title (before MENU), once.
  - `keys.test`: the row on the CONTROLS screen and in PAUSE view 3 (Enter opens the chooser, SOUTH shows the pad word, EAST / Esc back out).
  - `page-controls` / `landscape`: every layout keeps its floors with the extra row (re-measure, never loosen a floor).
- [ ] **Step 2:** Run those files. Expected: the new cases FAIL.
- [ ] **Step 3:** Implement. `request()` is called inside the keydown / click / pointerup handler itself, so the chooser keeps its activation.
- [ ] **Step 4:** `npm test`; `node tools/ui/shots.mjs` CONTROLS captures and `node tools/ui/gates.mjs <dir> --strict`. Expected: all pass.
- [ ] **Step 5:** Bump `CACHE_NAME` / `REV`; owner check in Chrome on macOS: CONNECT, pick the pad, play a run; reload, plays with no chooser; unplug and replug, plays.
- [ ] **Step 6:** Commit `CONTROLS: connect a Switch 2 Pro Controller from the page`; MEMORY line.

### Task 4: Probe page and the controller matrix

`KNOWN` rows and the hat reader come only from captures.

**Files:**
- Create: `tools/pads/probe.html` (dev-only, never in `SRC`), `docs/controllers.md`
- Modify: `docs/README.md` (map the new doc)

- [ ] **Step 1:** `probe.html` walks a guided list (SOUTH, EAST, WEST, NORTH, L, R, L TRIGGER, R TRIGGER, SELECT, START, D-PAD up / down / left / right, L-STICK up / right, R-STICK up / right, HOME), records each input's raw button index or axis and sign, the resting value of every axis, and the browser engine (`navigator.userAgentData` brands or the user agent); prints a ready `KNOWN` row keyed by id, engine and the button / axis counts, and the raw facts for the matrix. Nothing is stored or sent.
- [ ] **Step 2:** `docs/controllers.md`: one table, controller × (Chrome / Edge, Safari, Firefox) × (macOS, Windows, Linux, Android, iOS as one WebKit column); each cell `standard`, `known`, `hat`, `needs CONNECT`, `rebind` or `not seen`, else `not measured`. Seeded with today's measured cell: Switch 2 Pro, Chrome macOS USB = `needs CONNECT` + `known`; Switch 2 over Bluetooth = `not seen`.
- [ ] **Step 3:** Owner runs the probe on every pad and browser at hand. Each non-standard result becomes a `KNOWN` row (Task 0's test pattern) in its own commit.
- [ ] **Step 4:** Commit `tools: pad probe and the controller matrix`; MEMORY line.

### Task 5: Hat-switch D-PAD, from a captured pad

Runs only once Task 4 holds at least one captured hat pad; its capture is the test fixture. If none turns up, the task stays open and the matrix says so.

**Files:** Modify `src/app/gamepad.js`; Test `tests/gamepad.test.mjs`.

**Interfaces:**
- Produces: `export function hatDir(v): {up, down, left, right}`: the nearest of the 8 steps `-1 + k·2/7` (k 0..7: up, up-right, right, down-right, down, down-left, left, up-left) within `0.1`, else none (so Chrome's start-up `0` and the rest value `9/7` read nothing). `standardPads` keeps, per pad index, the hat axis (the first axis seen resting above `1.05`) in its own closure; `asStandard` stays stateless. For a non-standard pad not in `KNOWN`, buttons 12-15 are ORed with the hat (the pad's own 12-15 still count); the result keeps the pad's own button count (`nb`) and `mapping` `""`, so CONTROLS still reads `NON-STANDARD BUTTONS · TEST EACH ONE · REBIND IF WRONG` and the name keeps its true `BUTTONS 0-N`.

- [ ] **Step 1: Write the failing tests** from the capture: each of the 8 steps and the rest value; a poll at rest, then the captured `left` value, reads `dL`; a pad never resting above `1.05` comes back as the same object.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit `gamepad: hat-switch D-pad on a captured pad`; MEMORY line.

### Task 6: The keyboard in the player's own layout

Binds stay physical (`code`): WASD stays put on AZERTY. Two things are wrong today: printed keys show the US letter (`controls.js` `keyName` and its copy in `controlsgeo.js` fall back to the code; names are learned only while rebinding, `controlspage.js` `names`, and lost on reload), and letter shortcuts match the position (`analytics.js` near line 163 `KeyY` / `KeyN`, `update.js` `KeyU`, and the R / C / T / Q / E / M shortcuts), so on QWERTZ the key printed Z answers ALLOW.

**Files:**
- Modify: `src/app/controlswire.js` (`keyNames()`), `src/app/controlspage.js` (seed `names` through a new `createControlsPage` parameter), `src/app/hints.js` (`wordsOf(dev, c, names)`; the `syncWords` memo keys on the names map too), `src/render/padart.js` (`drawKeys` prints `KB_KEYS[].leg` through the names map, `kbPrints` measures with it, the layer key `sig` includes it), `src/render/controlsgeo.js`, `src/app/analytics.js`, `src/app/update.js` and each letter-shortcut handler Step 0 finds, `index.html` only if a card prints a letter
- Test: `tests/controls.test.mjs`, `tests/controlspage.test.mjs`, `tests/padart.test.mjs`, `tests/keys.test.mjs`, `tests/hints.test.mjs` if it exists, else the hints cases go in `controlswire.test.mjs`

**Interfaces:**
- Produces: controlswire `keyNames(): Record<string, string>`, session only, never stored: from `navigator.keyboard.getLayoutMap()` (rejection caught; read again on window `focus`) and from each keydown whose `key` is one Latin letter or digit with no Shift, Alt, AltGraph, Control or Meta held; a value is kept only if it is `A`-`Z` or `0`-`9` after upper-casing, else the code letter stays. A letter shortcut fires when `e.key` (upper-cased) is its letter, whatever the position; movement and the binds keep `code`.

- [ ] **Step 0:** List every printed key and every letter shortcut: `grep -rn "keyName\|wordsOf\|hints()" src`, every `e.code === "Key` and `ev.code === "Key` in `src/app`, and the cards in `index.html` (`ALLOW Y`, `RELOAD U`). Each one gets a Step 1 case.
- [ ] **Step 1: Write the failing tests:** layout map `{KeyW: "z", KeyA: "q"}`: MOVE reads `ZQSD`, the HUD / MENU hint words and the CONTROLS keyboard drawing's W key print `Z`; no map: `WASD` as today; a Persian or Cyrillic map value is ignored (`W` stays); a keydown `KeyQ` / `"a"` makes REMOTE print `A`; Shift + `Digit1` learns nothing; on QWERTZ (`code` `KeyY`, `key` `"z"`) the consent card does not answer and `key` `"y"` (`code` `KeyZ`) answers ALLOW; `Space`, arrows and `Escape` keep their fixed words.
- [ ] **Step 2:** Run those files. Expected: the new cases FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test`. Expected: all pass; any hint or HUD pin that moves is re-pinned only by ruling, as AGENTS.md requires.
- [ ] **Step 5:** Bump `CACHE_NAME` / `REV`; owner check: macOS on French (AZERTY), reload: caps read Z Q S D, play moves as before, `Y` / `N` on the consent card answer by their letters.
- [ ] **Step 6:** Commit `keyboard: keys and shortcuts in the player's own layout`; MEMORY line.

### Task 7: Switch 2 vibration over WebHID (opt-in, last)

**Files:** Modify `src/app/switch2.js`, `src/app/gamepad.js` (`standardPads` takes an optional `actuatorFor(g)`), `src/app/controlswire.js`; Test `tests/switch2.test.mjs`, `tests/rumble.test.mjs`.

**Interfaces:**
- Produces:
  - `export function rumblePacket(seq, strong, weak): Uint8Array`: the 63 data bytes of HID output report `0x02` (`sendReport(0x02, …)` takes the id apart). Byte 0 `0x50 | (seq & 15)`; bytes 1-5 SDL's `EncodeHDRumble(0x187, hi, 0x112, lo)` with `lo = round(strong · 29000)`, `hi = round(weak · 29000)` (inputs 0..1); bytes 0-5 copied to `0x10`-`0x15`.
  - `createWaker` gains `actuator(): {type: "dual-rumble", effects: ["dual-rumble"], playEffect(type, p): Promise<string>, reset(): Promise<string>} | null`, backed by the WebHID device the player allowed (`navigator.hid.getDevices()` restores it; `ALLOW VIBRATION` on the CONNECT row asks, on its own press, since one chooser per activation). The row offers it only where `navigator.hid` exists.
  - `standardPads(get, actuatorFor)` puts that actuator on a `KNOWN` Switch 2 pad whose own `vibrationActuator` is null. `routesOf`, `rumble.js`, `canBuzz` and `padInfo` need no change; a real actuator always wins.

- [ ] **Step 1: Write the failing tests:** `rumblePacket(0, 0, 0)` has no amplitude bits; `rumblePacket(3, 1, 0.5)` byte 0 is `0x53` and bytes 0-5 equal `0x10`-`0x15`; while on it sends every 12 ms and ends with one zero packet; a second `playEffect` before the first ends is not cut by the first one's end; `reset()`, `visibilitychange` to hidden, `pagehide` and a HID `disconnect` each send one zero packet at once; `rumble.test`: the VIBRATION test pulse and a run's blast reach the stand-in, OFF makes zero calls, a pad with a real actuator never gets the stand-in, with two pads only the active one buzzes.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test`. Expected: all pass.
- [ ] **Step 5:** Bump `CACHE_NAME` / `REV`; owner check: ALLOW VIBRATION once, the test buzz and blasts at LOW / MEDIUM / HIGH, OFF silent, switching tabs stops a buzz.
- [ ] **Step 6:** Commit `switch2: vibration over WebHID`; MEMORY line.

### Task 9: Button labels for the controller in your hands (R-LABELS)

**Files:**
- Create: `src/app/padfamily.js` (pure), `tests/padfamily.test.mjs`
- Modify: `src/app/gamepad.js` (snap gains `family`), `src/app/hints.js` (`wordsOf(dev, c, names, family)`), `src/app/controls.js` (label lookup by family beside `BTN[...].w` / `.s`), `src/render/controlsgeo.js`, `src/render/pages/controls.js`, `src/render/padart.js` (the face buttons' legends and the callouts), `src/render/kit/paint.js` (`glyph` gains `cross`, `circle`, `square`, `triangle` shapes), `src/render/words.js` (`PAD_FAMILY_WORDS`), every place `hints()` words are printed (HUD toast, MENU note, pages' feet, PAUSE foot, run ends)
- Test: `tests/padfamily.test.mjs`, `tests/hints*.test.mjs` or `controlswire.test.mjs`, `tests/page-controls.test.mjs`, `tests/padart.test.mjs`, `tests/words.test.mjs`, `tests/keys.test.mjs`

**Interfaces:**
- Produces:
  - `export function familyOf(id): "xbox" | "playstation" | "nintendo" | "generic"`: from the vendor id in the gamepad id (`045e` xbox, `054c` playstation, `057e` nintendo; Chrome `Vendor: xxxx`, Firefox `xxxx-yyyy-`), else by name (`/xbox/i`, `/dualsense|dualshock|playstation/i`, `/pro controller|joy-con|switch/i`), else `generic`. Matched, never printed or stored.
  - `export const FAMILY_LABEL`: per family, the printed word and short word for `S E W N SHL SHR TRL TRR SELECT START`:
    - xbox: `A B X Y`, `LB RB LT RT`, `VIEW MENU`
    - playstation: `CROSS CIRCLE SQUARE TRIANGLE` (drawn as the ✕ ○ □ △ glyphs wherever a keycap is painted; the word wherever only text fits and in the live region), `L1 R1 L2 R2`, `CREATE OPTIONS`
    - nintendo: `B A Y X` (by position: Nintendo's B is SOUTH), `L R ZL ZR`, `− +` (words `MINUS PLUS` for the live region)
    - generic: today's `SOUTH EAST WEST NORTH`, `L SHOULDER …`, `SELECT START`
  - pad snap `family`; `hints()` words use it, so `MOVE D-PAD · BOMB SOUTH` reads `BOMB A` on an Xbox pad and `BOMB ✕` on a PlayStation pad.
- [ ] **Step 1: Write the failing tests:** `familyOf` on real id strings (Chrome and Firefox forms for each vendor, the Switch 2 bridge id, an unknown pad); with an Xbox pad the MENU note, PAUSE foot and CONTROLS rows read `A` / `B`; with a PlayStation pad they read the glyphs (paint) and `CROSS` (live region); a Nintendo pad reads `B` for SOUTH; a generic pad reads `SOUTH` exactly as today (the existing pins unchanged); a family switch (unplug Xbox, plug PlayStation) re-lays every hint once.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement; the controller drawing keeps its generic body, only its legends follow the family.
- [ ] **Step 4:** `npm test`; CONTROLS / MENU / PAUSE captures with a fake Xbox and a fake PlayStation pad pass gates `--strict` (new `tools/ui/shots.mjs` recipes).
- [ ] **Step 5:** Bump `CACHE_NAME` / `REV`; owner check with every pad at hand.
- [ ] **Step 6:** Commit `controls: button labels for the controller in your hands`; AGENTS.md CONTROLS rewritten for R-LABELS; MEMORY line.

### Task 8: Release

- [ ] **Step 1:** Renumber `CACHE_NAME` / `REV` to the next number free on `main`.
- [ ] **Step 2:** AGENTS.md (CONTROLS: the waker, the row, R-LABELS, the family labels, the stand-in actuator, the hat, the names map and the letter rule), `docs/architecture.md` (SDL credit), CHANGELOG in player words of exactly what was measured (standard pads as before; the Switch 2 Pro over a USB cable in Chrome on macOS, CONNECT in CONTROLS; keys follow your keyboard layout; anything else: rebind on CONTROLS), `docs/privacy.md` (USB and HID grants are per site, and `hmarzban.github.io` hosts other pages; how to revoke them in Chrome's site settings; nothing about a controller is sent anywhere), with a test that no analytics event or user property carries a controller field.
- [ ] **Step 3:** `npm test`; CONTROLS captures and gates `--strict`.
- [ ] **Step 4:** Owner acceptance on the hardware at hand, then the owner merges and pushes.
