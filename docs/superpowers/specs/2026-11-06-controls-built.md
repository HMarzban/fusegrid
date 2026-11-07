# CONTROLS, as built: shell v201 (record)

**Status:** built on a local branch and released as shell **v201** on 2026-11-07, one squashed commit on `main`, on the owner's word (planned for Sunday 2026-11-08, moved up a day). The owner played it on a real controller on 2026-11-02 and reported that it works; the details are not yet reported, so M1 to M7 stay open and ship open. **On 2026-11-03 the owner felt the VIBRATION row's test buzz on a real controller on macOS, so a real motor is reached; the in-run patterns and each level are not yet reported.** Every pad test uses a fake pad, and the browser pass used a stubbed `navigator.getGamepads`. SENSITIVITY, turn and VIBRATION numbers are starting values. Synced to the code at `ee2a34e` on 2026-11-03.

Design: [2026-11-02 record](2026-11-02-controls-menu-design.md), which keeps its "design only" line. Tasks: [plan](../plans/2026-11-02-controls-feature.md). Checklist: [acceptance](../plans/2026-11-02-controls-acceptance.md).

## Rebuilt after the owner played (2026-11-02)

The owner, after that play: "the controller UI is not like the rest of the menue ui we have to deliver a cohesive and unify menu ui", and "since we have controller so we have to vibration too". Two lead rulings answer them, and this record states them in place of the tile description. It was written alongside the rebuild, so a number from the tile build says so and gets measured again.

- **The page is the kit.** CONTROLS is rebuilt in the CONSOLE PANEL look like every other menu: list on the left, preview pane on the right, HEAT-style tabs, kit band, notch and caret. ↑↓ rows, ←→ tab, ←→ on SENSITIVITY or VIBRATION adjusts. The tile style is dropped for the page. The other menus do not change, and the all-menus restyle is no longer planned for this release.
- **Vibration is ON by default.** Its row turns it off, and it stays independent of REDUCE FLASH. The 2026-11-03 section below has the levels and patterns that replaced the first ON/OFF row.
- **A note on MENU.** `CONTROLLER READY · OPTIONS › CONTROLS`, with the build tag kept after it. Where it fits, a pad with an actuator reads `CONTROLLER READY · VIBRATION MEDIUM · OPTIONS › CONTROLS`.
- **Where the tile code remains.** `.superpowers/sdd/notes/v200-controls-design/ui/mock/page2.js`, in the git-ignored notes on the owner's machine, with the tile cards. The cards show a page that no longer ships: re-render them before any use.

## VIBRATION and SENSITIVITY (2026-11-03, `ee2a34e`)

The owner: "for controller, we need a sensetive UI and controller and option for vibration, let's work on this and put the option in the menu ... see how can we improve the vibration for controller". Research and rulings: `.superpowers/sdd/notes/v201-controls-build/vibration-sensitivity-design.md`, in the git-ignored notes. Its lead rulings overrule its own tables, and this section states the code. The sim is untouched.

### VIBRATION

- **The row.** VIBRATION replaced RUMBLE in the same slot of the CONTROLLER tab, so the page still has 8 rows. `OFF / LOW / MEDIUM / HIGH`, default MEDIUM. ←→ steps and clamps, a hold repeats, SOUTH, ENTER or a tap cycles and wraps from HIGH to OFF.
- **Strength.** Magnitude x 0.4 / 0.75 / 1 gives x. From 0.5 up x plays as it is; below 0.5 it plays at `0.35 + 0.3x`, so a motor can start and small values stay apart by level (a plain 0.35 floor made MEDIUM and HIGH ticks the same). LOW never passes 0.40. Durations never scale. Per-pattern numbers: `.superpowers/sdd/notes/v201-controls-build/menu-haptics/engine-report.md`.
- **LOW** drops plant, near blast and both menu ticks, and cuts win to its first and last pulse. Its rule line reads `HITS, BIG BLASTS AND ROOM ENDS · NO MENU BUZZ` (room ends are win and lose). MEDIUM reads `HITS, BLASTS, PLANTS AND MENUS · LOW SKIPS MENUS` and HIGH `HITS, BLASTS, PLANTS AND MENUS · STRONGEST`.
- **OFF is really off.** The gate sits in the one fire function, so OFF makes zero effect calls, test and ticks included. Entering OFF resets the motor once and drops any running pattern.
- **Test pulse.** `160 ms / 0.7 / 0.7` at the selected level on an accepted change, at most one per 250 ms. None from a hold repeat, from RESET PAD or on entering OFF.
- **RESET PAD** gives MEDIUM, keeps a chosen OFF and does not buzz.
- **No actuator.** Value `NONE`, status `NO VIBRATION ON THIS CONTROLLER OR BROWSER`, stored level kept. The actuator decides, whatever the pad's mapping, so a non-standard pad with one buzzes. When the browser does not say what the pad offers, the rule line adds `FEEL NOTHING? THIS PAD OR BROWSER MAY NOT VIBRATE`.
- **Routes** (`routesOf`): `dual-rumble`; `trigger-rumble` only without it; then the older `hapticActuators` pulse. A throw falls to the next route, a rejection only loses that buzz. `__GAME__.ctl.rumbleInfo()` under `?debug=1` says what the live pad offers.
- **Store.** `nb.controls.v1` stays `v:1` and gains `vib` 0-3. `rumble` is still written as `vib > 0 ? 1 : 0`, because an older cached page throws away the pad block without it. A valid `vib` wins, then old `rumble` (0 OFF, 1 MEDIUM), then MEDIUM. A bad value never touches the binds, and a stored OFF survives a pad-block reset.
- **Where it shows.** No 13th OPTIONS row and no PAUSE row. PAUSE › OPTIONS › CONTROLS reaches it, and the page opens on the CONTROLLER tab for a pad player. Two reads add no row: the OPTIONS door reads `VIBRATION MEDIUM ›` and the MENU note names the level, each only with an actuator connected and only where it fits.

### Patterns

Steps are `ms / weak / strong` before scaling. Rhythm carries the meaning, since a cheap pad may drive both motors alike and the `pulse` route has one magnitude. Lower priority number wins.

| P | Pattern | Trigger | Steps | ms |
|---|---|---|---|---|
| 0 | lose | `lose` | 300/.5/1 · gap 80 · 120/0/.6 | 500 |
| 1 | hurt | `hurt`, lives dropped | 180/.4/1 · 120/0/.5 | 300 |
| 2 | win | `win` | 90/.5/0 · gap 80 · 90/.7/0 · gap 80 · 160/.7/.4 | 500 |
| 3 | SHIELD | `hurt`, lives unchanged | 70/.7/0 · gap 80 · 70/.7/0 | 220 |
| 4 | chain | 2 or more booms, each within 250 ms of the last | up to 4 hits of 70 ms, rising to .7 / .7, then 120 ms at .6 of the last strong; a gap of 80 once a pulse would pass 300 ms | 260-480 |
| 5 | close | one boom within 1 tile | 110/.6/.9 · 120/0/.45 | 230 |
| 6 | near | one boom within 3 tiles | 80/.55/0 | 80 |
| 7 | plant | `bomb` | 60/.45/0 | 60 |
| 7.5 | test | the row | 160/.7/.7 | 160 |
| 7.8 | launch | see Menu feels | 60/.5/0 · gap 80 · 110/.7/0 | 250 |
| 8 | enter | see Menu feels | 90/.6/0 | 90 |
| 8.1 | hello | see Menu feels | 120/.6/0 | 120 |
| 8.2 | deny | see Menu feels | 60/.5/0 · gap 80 · 60/.5/0 | 200 |
| 8.5 | confirm | see Menu feels | 70/.55/0 | 70 |
| 8.8 | back | see Menu feels | 70/0/.3 | 70 |
| 9 | move | see Menu feels | 60/.4/0 | 60 |

- **Limits (`LIMITS`, computed over the table in `tests/rumble.test.mjs`).** A pattern is at most 500 ms and 3 pulses, one pulse at most 300 ms, gaps at least 80 ms. Above 0.7 only for hurt, lose and close; no menu feel passes 0.7. In any second: 4 pulses at MEDIUM or HIGH, 2 at LOW, motor on at most about 50 %. Hurt and lose may break those two. Near and plant share 900 ms per rolling 10 s and drop past it.
- **Motor share, on a stub.** The demobot trace in `tests/rumble.test.mjs` reads 0.7 % to 2.9 % of PLAY across five seeds, against a cap of 8 %. That is a stub and a bot, not a felt result.
- **Chain.** Counted across the board. Past 3 tiles the magnitudes take x 0.7. A boom inside the window raises the count and rebuilds the rest from the running step.
- **Playback.** One `playEffect` call per step, because a new call replaces the running one and `startDelay` cannot chain. `tick` runs on every rAF above the frame gate. A step that runs straight into another gets 34 ms extra so a late rAF leaves no hole, and no call passes 334 ms, so a dead rAF stops the motor by itself. Higher priority replaces at once; same or lower is dropped, never queued; only chain merges.
- **Stops at once** on PAUSE, a hidden page, a pad gone, OFF, leaving GAME, or a key or tap taking over as the last-used device. Win and lose keep stepping past PLAY and stop when PLAY returns.
- **Never alone.** Every pattern doubles something on screen. No buzz on kill, pickup, kick, brick, reveal, warp, plate, bloom or remote. A fuse tick and a lane warning stay cut.

### Menu feels (2026-11-03)

The owner: "I would be good to add subtle vibration when menu changes, I mean when user enter to a new menue or when the press button to start the game. let's work on these ideas and improve and enhance and expand it". Research, accessibility review, game design review and lead spec: `.superpowers/sdd/notes/v201-controls-build/menu-haptics/`. Each shell call site writes the feel it means into one ranked slot, `app.feel` (`menuapp.js` `FEELS`, `_feel`); `controlswire.js` arms it before a pad poll routes, reads it after, and plays it through `rumble.js` `menu(name, t)`. Only two feels are seen across polls: launch when the sim turns WIN or LOSE into PLAY after a pad press, and the title's enter when the show begins after a pad press (also on a 3D board slower than a second).

- **One feel per pad press**, picked in the order launch > enter > deny > back > confirm > move. **launch**: a run starts (PLAY, DAILY, LEVEL SELECT START, PAUSE RESTART, a pad press taking WIN or LOSE back to PLAY, ATTRACT left into a run). **enter**: a page or PAUSE view opens, PAUSE opens, the title press starts the show, a pad skips the show. **back**: a page closes, RESUME, QUIT TO MENU, ATTRACT left to MENU. **deny**: only a refusal the screen already shows (the fixed CONFIRM / BACK rows, ANALYTICS before the card is answered, locked GRAPHICS rows, a refused rebind button; CONTROLS returns a typed `"refused"`); a pad cannot reach a locked room. **confirm**: a value changed on the same page. **move**: a real cursor or tab change. **hello**: a controller connects on any screen but GAME PLAY.
- **Subtle by design.** Menu feels use the weak motor, except back, which is the strong motor alone at 0.3, so going out feels dull and going in crisp. None is over 250 ms or 2 pulses, and every step lasts at least 60 ms so a motor can spin up.
- **Never** on a hold repeat, a clamped edge, the title idle, the show's own blast, ATTRACT idle, the update and consent cards, or for a keyboard or touch player (only hello ignores the last-used device, since the pad just arrived). Move and confirm keep the 100 ms gap.
- **Limits.** Gameplay always preempts a menu feel. LOW and OFF play none. Menu feels share 900 ms of motor time per rolling 10 s (the plant budget; 600 ms silenced the cursor partway through ordinary browsing); cursor ticks drop past it and past the per-second limits. Page feels (enter, back, deny) always play but count, so the ticks around them drop first, and launch and hello sit outside both, so a page or a start is never lost after a fast scroll. PAUSE's motor stop runs before its enter. A menu feel is cut only by OFF or a lost pad, and a late frame plays its next step late and whole rather than skipping it (a run's first frame builds the board; gameplay keeps skipping overdue steps).
- **Browser proof.** `.superpowers/sdd/notes/v201-controls-build/menu-haptics/buzzsmoke.mjs`: the real page, a fake pad whose actuator records each call, 11 of 11 (title, show landing silent, fast scroll then enter, move, enter, back, wrap, launch's two pulses, PAUSE reset then enter, RESUME back, keyboard silent). A stub, not a felt result.
- **Never alone.** Every feel doubles a visible change (a new page, a moved cursor, a refusal line, the MENU note), and a sound cue where the menu has one; refusals and hello have no sound. Nothing is told by vibration alone.

### SENSITIVITY

SENSITIVITY replaced DEADZONE in the same slot. Rule line `HOW FAR THE STICK MOVES BEFORE IT COUNTS`.

| Level | Stored `dead` | Release | Turn: other axis must lead by |
|---|---|---|---|
| MIN | 60 | .50 | 1.40x |
| LOW | 40 | .30 | 1.35x |
| MEDIUM (default) | 25 | .20 | 1.25x |
| HIGH | 15 | .10 | 1.15x |
| MAX | 8 | .03 | 1.10x |

- Both ends stay for players with a tremor or a worn stick. Release is `dead - 0.05`, `dead - 0.10` at 40 and above, never under 0.03. An off-level stored value snaps to the nearest level, and a tie takes the bigger deadzone, because a stick that walks on after you let go is the worse mistake.
- ←→ steps and clamps, ENTER or SOUTH cycles and wraps from MAX to MIN. On a standard pad the stick is under test on this row, so it neither walks nor adjusts: the D-PAD does, and the foot says so.
- **Live view.** The pane draws a ring at the level, the stick's dot, `DRIFT` (the peak at rest over 2 s) and `READS LEFT` or `READS NOTHING`, from the game's own resolver. A short box with no pane gets the same words on one line.
- **No response curve.** `intent()` sends -1, 0 or 1 and speed is `p.speed`, so stick distance never reaches the sim. This is comfort, not speed.
- Parked: a both-axes wedge, and any lane assist that reads the world. The first moves at 1.41x on open floor, the second breaks key parity.

### Menus

- **Repeat stays 350 then 110 ms, threshold stays 0.50 / 0.35.** First step lands in the same rAF as before.
- **Steadier, keys too.** A held direction (`app.repDir`) now runs its frame at up to 60 Hz (`HELD_FPS`, under the player's FRAME RATE cap), because held repeats were landing on 20-30 FPS idle frames. Idle returns on release.
- **A sideways push walks.** On first engage the menu stick takes vertical unless x leads y by 1.25x (`MENU_BIAS`). PLAY keeps plain dominance.
- **A light tick.** MEDIUM and HIGH only, from the pad last used, at least 100 ms apart: `move` on a real cursor change, `confirm` on a row confirm that stays on the screen. Never on a clamped edge, a hold repeat, a capture, back, a page opening or closing, a RESET that runs, INTRO, ATTRACT, live PLAY or a run end; PAUSE and its pages do tick. Sound stays one cue for all devices.
- **Screen reader.** `Vibration, low. No menu buzz. Left and right change it.` (MEDIUM and HIGH: `Menus buzz too.`) · `Vibration off. No buzz at all.` · `Vibration, none. No vibration on this controller or browser.` · `Sensitivity, high. The stick must move 15 percent before it counts.`

## What was built

- **Pad play.** D-PAD plus one stick (L by default, R on the MOVE row). SOUTH bomb, WEST throw, EAST remote, START or SELECT pause. Menus use a fixed layer: SOUTH or START confirms, EAST backs, shoulders change tab or PACE. One press is one press; the sim never sees a pad and the wire shape did not move.
- **Rebinding on both devices.** Store `nb.controls.v1`, on the KEEP list. Conflicts swap, and one line names both inputs.
- **The CONTROLS page.** `SCREEN.CONTROLS = 16`, a door row in OPTIONS between GRAPHICS and RESET DEFAULTS, inline `pauseView 3` from PAUSE. List and preview pane in the CONSOLE PANEL kit, as above.
- **Hints follow the last-used device.** A real press flips them, 0.75 s dwell. Prompts compose from live binds.
- **Keyboard THROW is E.** The old chord still works and is not advertised.
- **Hardware states.** Disconnect in PLAY with the pad last used pauses (`CONTROLLER LOST`) and never resumes. Two pads: the last to press is active. A non-standard pad is never refused.

## What differs from the design record

| Design | Built | Why |
|---|---|---|
| A drawing at 600x520 keyboard only | One geometry for every layout (`controlsgeo.js`), now the kit's list and pane. The tile build's 3 + 2 wrap went with the tile page. Tabs hold 44 CSS; rows are pitch caps like every list, so `geoFor` gives 31 CSS in phone landscape and 26 in PAUSE on a phone, and a pane too small to read goes. No read-only PAUSE fallback | Lead ruling on plan Q1, then the kit ruling |
| Pad name left to the owner | `CONTROLLER 1 · STANDARD`; a non-standard pad reads `CONTROLLER 1 · BUTTONS 0-N`. The device id is never printed or stored | Lead ruling on plan Q3; the owner may overrule |
| Mock arms capture on a timer | All input released, then 200 ms, for the first press. Later MOVE steps and a retry after a refusal need only the release | A held opening press must not bind; quick typing must not be dropped |
| T14 was droppable | Kept. A pad reaches LEVEL MODES (TRIGGERS walk, NORTH toggles), STATS NORTH = MEDALS and WEST = copy, run-end WEST = copy and NORTH = board, the NEW VERSION card (SOUTH RELOAD, EAST LATER, only a press begun >= 0.5 s after it shows) and the load card (SOUTH RETRY, EAST USE CLASSIC 2D) | Lead ruling on plan Q2 |
| Owner ruling: the skin replaces CONSOLE PANEL on every menu, PAUSE included, once built | **Not planned for this release.** No page is in the tile skin: CONTROLS joined CONSOLE PANEL, and PAUSE, OPTIONS and every other menu keep it. Theirs changed only in hint text, the OPTIONS row count and the MENU note | Lead ruling 2026-11-02 on the owner's ask for one cohesive menu: restyling every menu by Friday is big and risky. The owner may overrule |
| Silent on OPTIONS ANALYTICS for a pad | With no answer yet the row does nothing on a pad and says `ANSWER THE CARD WITH Y OR N`. Once answered it toggles as today | Lead ruling on Q11: a stray button must not consent |

Also as the record planned: OPTIONS is twelve rows at keyboard pitch 27 (note line removed), touch 37 where the box fits, else 34. The stale `K` cap in the GUIDE preview is gone.

## Rulings and what each one costs

The ledger's rulings carry the cost the ledger states. For the plan's lead rulings (touch, T14, pad name, `main.js`, the `Q` items, D1), which state none, the cost is this record's own reading.

| Ruling | Cost, if it turns out wrong |
|---|---|
| Parallel lanes in one checkout, reviewed per wave | A stray edit across lanes costs a wave's rework |
| Touch: tabs hold 44 CSS; rows are 31 CSS in phone landscape and 26 in PAUSE on a phone, in line with PAUSE OPTIONS | Small thumb targets on a phone with the page opened mid-run; the diagram goes on a short box |
| T14 in | More pad routes to keep true; a MODES ring on LEVEL SELECT |
| Pad name stays neutral | A player with two similar pads cannot tell them apart by name |
| `main.js` pin stays 799; code moves to a seam | One more module; `main.js` measures 784 by split length |
| Q1 stick release (2026-11-03: `dead - 0.05`, `dead - 0.10` at 40 and above, floor 0.03, replacing `max(0.02, deadzone - 0.05)`) | A low level may feel sticky or may chatter; only a real stick can tell |
| Q2 a held key beats the pad on a mixed axis | Mixing devices can feel one-sided |
| Q3 same-poll press: bomb first | A same-poll throw comes after the plant |
| Q4 SPACE to E rolls like SOUTH to WEST | A solo E rolls a held fire, accepted below |
| Q5 a held menu stick repeats like a held key | A drifting stick past 0.50 keeps walking |
| Q8 RESET takes two presses | One more press |
| Q9 ICE tip reads `STOP EARLY: PRESS THE OTHER WAY` | Copy only |
| Q10 the wake press acts on title, show and ATTRACT, and is swallowed elsewhere | One lost press after a reconnect |
| Q11 no consent from a pad | A pad-only player leaves the card up, and nothing is sent |
| D1 replay equality is pinned for the defined script | Four differences stay outside it: key diagonals, sub-tick taps, SHIFT latch against WEST pulse, SPACE keyup clearing `remote` on keys only |
| An off-level stored value snaps to the nearest SENSITIVITY level and keeps binds (B13 amended) | An odd stored value is silently rounded |
| CONTROLS ↑↓ walks rows, ←→ changes tab, ←→ on SENSITIVITY or VIBRATION adjusts (replaces arrows walking tiles and chips) | On those two rows ←→ does not change tab; the shoulders and `[ ]` still do |
| CONTROLS is in the kit, the tile style is dropped for the page, no all-menus restyle this release | The owner wanted the tile look everywhere; `page2.js` and the tile cards remain in notes |
| Vibration default ON (MEDIUM), the owner's call, over the accessibility default OFF; the row turns it off; independent of REDUCE FLASH | This record's reading: a player who dislikes vibration feels it until they find the row |
| **Departure:** menu ticks have no separate off; LOW and OFF turn them off, since the page holds 8 rows | The accessibility review asked for a separate switch. A player who wants strong game vibration and no menu tick cannot have both |
| Keyboard-only player gets no buzz: a run and menu ticks buzz only while the pad is the last-used device. One exception: the row's test pulse plays on a level change from any device, so the player can feel the choice | A player mixing devices misses some buzzes |
| Patterns capped at 500 ms and 3 pulses, gaps >= 80 ms, one pulse <= 300 ms, per-second limits; hurt and lose may break the per-second limits. Chain caps at 4 hits, not the note's 6; lose is 500 ms, not its 960 | A chain of 5 feels like a chain of 4, and a loss is shorter than first drawn |
| LOW scale 0.4, over the note's 0.5 | LOW may be faint on a stiff motor; the floor stays 0.35 |
| No actuator reads `NONE`, not a bare dash | None known |
| A fuse tick and a lane warning stay cut: every pattern doubles something visible | A player gets no warning of a blast from the motor; a pad player gets nothing a keyboard player lacks |
| Default SENSITIVITY stays 25 | A few ms on engage and turn, against a stick that walks on after release |
| Keys and pointer share one fire latch, the pad has its own | None known; a solo E rolls a pointer-held fire, accepted |
| `pauseView` resets to 0 at menu return and run start | A pause inline page closes early |
| A direction held from a menu into play still walks (F8 amended; the game designer agreed) | A one-step drift at run start |
| A plant right after a throw lands one tick late on a pad or solo E, never on the old path | One tick on that roll |
| STATS armed foot stays `KEEPS OPTIONS + PACE` (H8 amended); its tap zones are pinned | A player is unsure whether controls survive a wipe; they do |
| HOW TO says E for THROW, so the `pixel-hud` GUIDE pins moved | A hidden art change in HOW TO, if the diff were more than the copy |
| Touch ITEMS names buttons or a tap, not keys, on a phone (H6) | None known |
| On a non-standard pad the stick always works alongside any buttons | A drifting stick on an odd pad walks; SENSITIVITY handles it |
| Taps off the plate on CONTROLS work anywhere in the viewport; other pages keep their dead gutter | A stray gutter tap backs out of CONTROLS |
| The consent card covering part of LEVEL SELECT is existing behaviour | **Not confirmed against v200.** If it is new, it is a bug in this branch |
| About 111 KB stays in the boot graph | See below |

## Boot weight: static, on purpose

Measured from the code at `ee2a34e`. The twelve new modules are 111,107 bytes raw (90,966 on the tile build), all in the static boot graph: `controlswire.js`, `gamepad.js`, `padroute.js`, `capture.js`, `controlspage.js`, `controls.js`, `hints.js`, `rumble.js`, `controlsgeo.js`, `controlsdraw.js`, `padart.js`, `hintcopy.js`. Edits to existing files bring the boot graph, and all of `src/` with it, to +137,052 bytes against the plan's base `8853efc` (+113,411 on the tile build); the lazy PIXEL and REAL 3D trees did not change. `data-files` went from 102 to 114, and `tests/loadbar.test.mjs` pins it to the real graph. Lazy paint is a later job; the cost is a slower first load for visitors who never open CONTROLS. Those bytes are not yet measured on a real phone.

## Disclosed

- Keyboard diagonals still move about 1.41x on open floor while a pad is 4-way. Changing keys would alter feel and old bests.
- A pad has no route to the STATS wipe, the camera reset or the consent card, on purpose.
- A pad press leaves the title in every case. If the browser will not run the audio context, the show runs silent and `NO SOUND YET · PRESS A KEY OR TAP` shows. No browser is confirmed with real hardware until the details of the owner's play are in.
- The owner felt the row's test buzz on a real pad (2026-11-03), so a motor is reached; the in-run patterns are not yet reported, so the motor numbers (floor 0.35, steps from 60 ms, gaps of 80 ms) are assumptions until M6. If a pad offers no actuator in any mode, the row reads `NONE` and the copy promises nothing, and release text must say vibration was not felt.

## Pins that moved

Listed at the v201 close-out and extended on 2026-11-03. `reset.test` KEEP 3 to 4, fixture sizes · `menuapp.test` OPT_ROWS literal, row literals and wraps, SCREEN count · `menudraw.test` OPT_N 12, keyboard pitch 27, no note line, `ENTER CONFIRM`, `PRESS ANY KEY OR BUTTON` · `headless.test` title string · `heat.test` PAUSE cue · `coach.test` and `coach-tiles.test` `E tosses a bomb` · `pixel-hud.test` HOW TO and ITEMS page and shell pins · `index.html` `data-files` 114 · `CACHE_NAME` and `REV` v201 · `sitemap.xml` `lastmod` 2026-11-06. Since the close-out, for the rebuild and the 2026-11-03 work: `controls`, `controlsa11y`, `controlsdraw`, `controlspage`, `controlswire`, `frameloop`, `gamepad`, `hints`, `keys`, `menuapp`, `menudraw`, `padroute` and `rumble`.

Not moved: CLASSIC `9fb48f0a:72431`, `7e57d1aa:71503`, the PIXEL board pin, fat-world 156.

## Release-day go/no-go (planned Sunday 2026-11-08, run 2026-11-07)

A failed agent item is a no-go. The owner pushes and tags.

**Agent items, state at the v201 release commit (2026-11-07; the code is `5aca633`'s):**

- [x] A1 `npm test` green on Node v26.13.0: 578 pass, 0 fail.
- [x] A2 BROWSER script with a stubbed pad, run against the release tree. Clean: the pad, keyboard, touch portrait and landscape, cards, misc, non-standard pad and hidden-tab routes, title to QUIT TO MENU, and the menu-feel smoke (11 of 11). Phone portrait and landscape: every row rebinds on both tabs, no clipping, no overlap, zero page errors. What still fails also fails on `e1384f5`, the last commit the script was written against: the old MENU note wording, the `DEADZONE` / `RUMBLE` row names and `rumble` view field, the ON/OFF vibration toggle, pre-level pulse numbers and a silent title, which `5aca633`'s menu feels changed on purpose. Timing checks (repeat jitter, pattern limits, rhythm) fail on both builds in different subsets. Two-pad, tab, rebind and bomb-again checks failed once and passed on a re-run. `H2-dwell` reads 710 to 720 ms against a 730 floor from a 16 ms sampler; `hints.js` is unchanged since `e1384f5` and its 750 ms frame-time dwell is pinned in `hints.test`. The phone row pitch (31 CSS in landscape, 26 in PAUSE) is the cost disclosed above. The script itself is not in the repo and was not rewritten.
- [x] A3 Moved pins are the ones listed above; `pixel-hud` was not on the plan's list, and the ledger names it. `classic-perf`, `pixel-render` and `three` are unedited since v200, so CLASSIC and fat-world stand.
- [x] A4 `src/main.js` 783 of 799, zero npm deps, SCREEN appended, `CACHE_NAME` and `REV` v201 together, new files precached (`pwa.test` green).
- [x] A5 Maker-name grep over `src/`, `tests/` and `docs/`: none in `src/` or `tests/`. The test controller's brand in this record, the acceptance list and AGENTS now reads "a real controller". The one older hit predates this feature: a source citation in the dated `specs/2026-08-25-camera-research.md`, which is never rewritten.
- [x] A6 AGENTS, MEMORY, CHANGELOG, diary and this record synced for the 2026-11-07 release; `sitemap.xml` says 2026-11-07. The 2026-11-02 record keeps its "design only" line by the owner's instruction. Stray servers and browsers: every run stopped its own by PID; none left.

**Human items, NOT DONE. The owner has played on a real controller and reported it works; the details are not yet reported, so none is ticked:**

- [ ] M1 Headed Chrome, fresh profile: a pad press leaves the title; note whether music starts or the show runs silent. Then Firefox and Safari, or a disclosed "not tested".
- [ ] M2 Clear a room with no keyboard or mouse, title to QUIT TO MENU, on a USB pad and on Bluetooth.
- [ ] M3 Feel of SENSITIVITY, each level's turn and D-PAD corners in gen-3 corridors; HIGH and MAX let go in four directions, ten times each, `READS NOTHING` returning; a flicked row steps once, and a hold through 12 rows is even; thumb roll SOUTH to WEST after picking up THROW; a real fast tap planting at 60 Hz, and 120 Hz if a display is there.
- [ ] M4 A worn or drifting stick: menus stay put, SENSITIVITY fixes play, MAX does not walk on its own.
- [ ] M5 Pull the cable and let Bluetooth sleep in a run: pause, kicker, reconnect with no resume. Two pads at once. A non-standard pad, if one exists.
- [ ] M6 **Test buzz felt on a real controller on macOS (owner, 2026-11-03); the rest is not reported.** `__GAME__.ctl.rumbleInfo()` first, in each connection mode and browser. VIBRATION at each level with an actuator: plant felt at MEDIUM; eyes shut, hurt against SHIELD and a chain of 2, 3 and 4; PAUSE and a tab switch mid-lose stop the motor; ten minutes with no numbness (cut plant first, then near); the menu tick not later than the sound; the row without an actuator; COPY and SOURCE from a pad give an honest toast or a blocked tab.
- [ ] M7 CONTROLS read at game size on laptop and phone, a phone with a paired pad, hints flipping between keys and pad without flicker.

If M1 to M7 are still open on release day, the owner decides explicitly, and release text claims nothing about feel or browsers. **Decided 2026-11-07:** the owner said "let's make it ready and push it up", so v201 ships with M1 to M7 open, and the CHANGELOG claims nothing about feel or browsers.

**Owner calls still open:** pad name, the SOUTH / EAST / WEST / NORTH words, the fuse on the pad, MOVE STYLE and hand presets. Closed by the 2026-11-02 rulings: vibration default (ON), the ring (gone with the tile style), the all-menus skin (not planned for this release). New on 2026-11-03: a separate menu-tick off, if the owner wants the accessibility ask honoured; HIGH as the default SENSITIVITY after M3.
