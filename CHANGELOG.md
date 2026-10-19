# Changelog

> **PATCH NOTES.** Every player-facing change to Fusegrid, newest first.
> Insert coin, scroll down, see how the cabinet grew.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
each release lists what was **Added**, **Changed**, **Fixed** or **Removed**.
Fusegrid has no version number of its own. Each release is named after the
PWA shell revision that shipped it (`CACHE_NAME` in `src/pwa/shell.js`),
because that's what makes an installed copy update, and it's dated.

Entries are written for players. How a change works lives in
[docs/architecture.md](docs/architecture.md); how to ship one is in
[CONTRIBUTING.md](CONTRIBUTING.md#-shipping-a-release).

## Unreleased

## shell v181 · 2026-10-19

### Changed
- **Phone menus use the whole screen.** On a phone held upright, the main
  menu and every menu page now fill the screen instead of a strip the size
  of the board, so rows, tiles and text are about 40% bigger. The board
  still sits behind the logo. LEVEL SELECT puts the room card under the room
  grid, HOW TO PLAY stacks its two rules, ENEMIES shows two columns and
  MEDALS one, so every line reads in full.
- **LEVEL SELECT doesn't promise a time early.** The room card only says NO
  TIME YET once TIME mode is open. A best time you already set still shows.

### Fixed
- In the legacy iso view, MEDALS goals, STATS labels and the HIGH SCORES
  plaque chips no longer spill out of their boxes.

## shell v180 · 2026-10-19

### Changed
- **Menu pages, redesigned.** LEVEL SELECT is now a grid of room tiles with
  a big room card beside it: the world, the foes you'll meet, your best
  time, and what each heat changes (lives, fuse, score). Locked rooms say
  what opens them. On a keyboard the main menu shows a preview of whatever
  you point at; on a phone it's a hub of big tiles. GUIDE, OPTIONS, GRAPHICS,
  HIGH SCORES and STATS are slimmer and only as tall as they need to be.
  Pacts are now called MODES everywhere.
- **New menus.** The main menu and the pause menu are now one system: the
  same quiet panel, the same selected-row look and the same controls, in
  CLASSIC 2D, PIXEL and REAL 3D, on a laptop or a phone. PLAY is the big
  top row and shows the run it will start (room, heat, pace). The pause menu
  says where you are (room, world, heat, pace), RESUME is the big row, and
  RESTART and QUIT turn red when selected. On a keyboard the pause panel is
  compact; on a phone its rows grow to thumb size. OPTIONS, GRAPHICS and GUIDE wear
  the same panel. Hints at the bottom match your device: keys on a
  keyboard, taps on a touch screen.

### Added
- **NEW VERSION READY.** When a new build of the cabinet is out, a card in
  the middle of the screen, over a blurred backdrop, says so on the menus or after a finished run (never mid-run) with a RELOAD
  button (or press `U`). Your scores stay. LATER hides it until you're back
  from your next run.

### Fixed
- **Stuck on an old version.** The installed game could keep serving an old
  build. Updates now download with fresh files and wait for your RELOAD.
  Updating also no longer clears other sites' offline data on the same host.
- **Phone taps in the menus.** A tap just above or below the main menu no
  longer starts a run. Tapping a row anywhere across the screen picks that
  row. GUIDE rows are tappable, and a tap off them goes back. LEVEL SELECT
  rooms, heat, pace and modes, and the HIGH SCORES heat tabs, all work by
  touch now. Pause rows are taller on a phone, so they're easier to hit.
- **Bigger menu rows on phones.** On a touch screen the main menu tucks the
  FUSE/GRID logo up top at half size so all eight rows grow to thumb size
  (about 50% taller on a phone).
- **LEVEL SELECT speaks touch.** On a phone its bottom hint explains the
  taps (tap a chip to set it, the panel to start, outside to go back)
  instead of listing keys.
- **Taps click like keys.** Tapping a room, heat, pace or HIGH SCORES tab
  plays the same menu blip as the arrow keys, and the `[` `]` pace keys
  blip now too. Tapping the chip that's already set stays quiet.

### Added
- **Join the build.** A contributing guide, a code of conduct, a security
  policy, bug and idea templates, and a docs map, for anyone who wants to
  help build the cabinet. Nothing in the game itself changes.

## shell v178 · 2026-10-11

### Added
- **PIXEL, a third look.** OPTIONS → RENDER now cycles CLASSIC 2D → PIXEL →
  REAL 3D. PIXEL is a hand-drawn sprite version of the whole game: board,
  MAKO, every foe and pickup, blasts, the HUD and the GUIDE pages, the
  opening, the end-of-room cheer and your ghost. It switches live with no
  reload, and the game remembers your pick.
- **Pickups say what they did.** Grabbing a cube floats a label with your
  new value (`FLAME 4`, `BOMB 3`, or a dimmed `MAX` once it is capped).
  Swapping one special bomb for another adds `replaces` and the old name.
  The matching HUD chip or heart row pulses at the same moment.
- **Ability bar.** A strip along the bottom of the board lists what you are
  holding (SHIELD, KICK, THROW, PASS, your bomb type, REMOTE, SPEED). When
  a hit or a spent shield takes something away, its chip dims and fades.
- **GRAPHICS settings.** A new GRAPHICS page, opened from OPTIONS or the
  pause menu. QUALITY sets everything in one press: BATTERY (coolest),
  AUTO (the default) or HIGH (uncapped). Change any single row and it reads
  CUSTOM. The rows are FRAME RATE (30 / 60 / MAX), RESOLUTION, SHADOWS
  (OFF / SHARP / SOFT), ANTI-ALIAS, EFFECTS, DEMO and an FPS METER. Rows
  that do not apply to your current look are locked. Game speed never
  changes, whatever you pick.
- **More first-use tips.** The coach now gives one short tip the first time
  you pick up each of eight powers: KICK, THROW, REMOTE, PASS, LINE, POWER,
  PIERCE and SHIELD. Each tip still shows only once.

### Changed
- **Cooler and quieter when nothing is moving.** Menus and the pause screen
  redraw at 30 frames a second (never below 20), and the game skips
  redrawing a picture that has not changed. On a 120 Hz laptop that cut CPU
  use by more than half on menus and pause, and by about a third during
  play. Music and sound sleep
  while the tab is hidden or silent.
- **Pause freezes the board** in every look, with no shake or flashing.
- **The attract demo stops after a minute** on the default DEMO SHORT
  setting. Set DEMO to ON for the old endless demo, or OFF to never start
  it.
- Sparks and debris now fly the same distance on 120 Hz and faster screens
  as they do at 60 Hz.

### Fixed
- **THROW and REMOTE work on phones.** While you hold either power, a
  THROW or REMOTE button appears next to the bomb button (portrait) or in
  the right-hand gutter (landscape). Their tips now name the button.
- FRAME RATE and BATTERY now take effect on 180 Hz and 200 Hz screens.
- Switching RENDER back to PIXEL no longer shows a frozen board.
- REAL 3D no longer loads late and replaces the look you had just picked.
- REAL 3D recovers cleanly when the browser drops its graphics context.
- A tip about a power you just lost (THROW after a hit, say) now closes and
  comes back the next time you pick that power up.

## shell v177 · 2026-10-10

### Changed
- **Explosions look 3D in REAL 3D.** Blasts are now billowing fireballs,
  with a bigger burst on the bomb tile and a glowing plate on every tile
  that can hurt you, so the danger zone is easy to read. They used to be
  flat, faint cards. Reduce flash now also dims the light they throw.
- **More room for your thumbs on a portrait phone.** During a run the board
  moves up to just under the pause button, and the D-pad and bomb button
  grow a little into the space that frees.

### Fixed
- After arming Reset on STATS, you can now tap `C COPY` to copy your stats.
  Like pressing `C`, it cancels the reset.

## shell v176 · 2026-10-10

### Changed
- **Better use of a portrait phone screen.** The board now sits in the
  middle of the screen on the title, the opening and the menus. During a
  run the D-pad and bomb button are bigger and sit low, where your thumbs
  are, instead of leaving an empty band at the bottom.

### Fixed
- **STATS says when it copied.** Pressing `C` on STATS now shows `COPIED`
  (or `COPY FAILED`). On touch, tap `C COPY MY STATS` to copy.
- `R` and `M` now leave the attract demo like every other key.
- Menu sounds no longer play late if you press a key before the browser
  has finished turning the audio on.
- The first key press of the opening no longer stutters for a frame on a
  fresh browser start.

## shell v175 · 2026-10-09

### Fixed
- Skipping the opening show after MAKO lights the fuse no longer flashes and
  shakes the menu a moment later.

## shell v174 · 2026-10-09

### Added
- **A new opening.** The game starts on a FUSE/GRID title over a slowly
  drifting board (2D or 3D, following your RENDER setting). Press any key or
  tap to start: the music comes in with a sting and a short show plays (the
  camera sweeps in, MAKO pops up, lights a fuse, and the blast reveals the
  menu). Any key skips the show.

### Fixed
- Music now starts reliably on phones, including after a long press.
- Pressing Escape first no longer leaves the game silent.

### Changed
- A first visit now goes to the menu after the opening, instead of straight
  into a run.

## shell v167 · 2026-10-09

### Fixed
- **Enter works on the end screen.** After a cleared room, the finale or
  GAME OVER, Enter (like Space or a tap) moves on: next room, back to the
  menu, or a new run. The cue now reads `SPACE / ENTER / TAP`.
- **C and B say what they did.** Copying your result (`C`) or the board
  link (`B`) on the end screen now shows `COPIED` or `BOARD LINK COPIED`
  for a moment, and `COPY FAILED` if the browser refused the clipboard.
- Choosing RESUME on the pause list with Space no longer drops a bomb the
  moment play resumes.
- Any key now skips the intro, as its hint says; an arrow key that skips it
  no longer also moves the menu cursor.
- Pressing P or Esc to leave the intro or the attract demo now starts the
  run playing, not paused.

## shell v166 · 2026-10-09

### Changed
- **REAL 3D near border wall is lower.** The wall along the bottom edge of the
  board is cut down so you, your bombs and foes on the last row never hide
  behind it.

### Fixed
- Zoom now snaps back to your camera preset on the very first frame of a new
  room, instead of one frame late.
- Your first visit now counts as one session, not two.

## shell v163 · 2026-10-08

### Added
- **Medals.** Eight medals, each earned on a finale clear (room 5 or room 8)
  and settled only when the run ends. A newly won medal is named once, in
  gold, on the run summary. Press `T` (or tap `T MEDALS`) on STATS to open
  the MEDALS page (`n/8`, earned rows lit); Esc, Enter or a tap goes back.
  Store: `nb.medals.v1`.
- **Ghost replay.** Clear a room faster than before and the cabinet keeps
  your route. Next time you play that exact board (same seed, room, heat,
  pact and pace), a translucent copy of you races alongside in CLASSIC 2D
  and REAL 3D. It freezes with PAUSE, only ever saves a faster clear, and
  never touches the game itself. Store: `nb.ghost.v1`.
- **DAYS PLAYED.** STATS gains a lifetime count of the days you entered a
  room; `C` copies it too. Never a streak.
- **Reset my cabinet.** On STATS, `R` (or a tap on `R RESET`) arms a red
  confirm and a second `R` (or a tap on `R AGAIN`) wipes scores, bests,
  stats, daily, times, medals, plaques, ghosts, pact and coach, then
  reloads. Your settings and pace are kept. Anything else cancels.

### Changed
- **New REAL 3D camera.** A lower 3/4 angle through a flatter lens, so
  block fronts read on every row, the board is centred with no skew, and it
  is noticeably bigger on screen. The whole board stays visible; WIDE and
  FAR still pull back, and the intro fly-in lands on whichever you chose.
- **Zoom resets each room.** Wheel or pinch still zooms in 3D, but the
  camera returns to your CAMERA preset at every room and run start, so a
  stray trackpad scroll never sticks.
- **Bigger game on screen.** The stage now fills more of the window on
  desktop and phone, and re-fits when you resize or rotate.
- **Phone controls off the board.** In portrait the pad and bomb button sit
  below the board and pause above it; on landscape they sit in the side
  gutters. The bomb button hides when you are not playing.
- **Touch.** MEDALS and Reset on STATS are tappable, and the PAUSE footer
  reads `ENTER / TAP CONFIRM`.

### Fixed
- MENU rows are tappable, so every row is reachable without a keyboard.
- Taps on PAUSE and OPTIONS rows land on the right row on a scaled canvas.
- With CAMERA set to WIDE or FAR, the intro no longer jumps at the end.
- After a slow load, the ghost no longer runs ahead of you on the same
  route.
- Internal: `fit()` moved to `src/app/fit.js`; `main.js` line pin now 799;
  `sitemap.xml` lastmod refreshed.

## shell v145 · 2026-10-08

### Fixed
- **Touch pause button no longer hides your score.** On a portrait phone the
  round pause button sat over the top-right HUD score; it now sits just above
  the play area, so every digit stays readable during a run.

### Removed
- Internal: dead DOM HUD helpers left over from an older renderer. Nothing
  on screen changes.

## shell v143 · 2026-09-07 · pushed (`18f9d9d`)

### Added
- **Run summary.** GAME OVER and the finale show the run's tally (rooms,
  kills, pickups, time) and a delta against your saved best for that heat,
  pact and pace: `NEW BEST`, `FURTHEST ROOM YET`, `MATCHED YOUR CORE BEST`,
  or `+N FROM YOUR CORE BEST`. Every claim comes from a persisted record;
  a retry can never print a false NEW BEST. Store: `nb.bests.v1`.
- **STATS.** A cabinet page (menu row above SOURCE) with lifetime runs,
  rooms cleared, deaths, kills, pickups, play time and the CORE / PLUS / MAX
  bests. `C` copies it as plain text. Store: `nb.stats.v1`.
- **DAILY.** A menu row that starts one board a day, seeded from the date.
  The end screen adds `DAILY <date> · NORM · TRY n · YOUR BEST s`. Honour
  system, this device only, your own attempts only. Store: `nb.daily.v1`.
- **Challenge code.** `B` on the end screen copies a twelve-character board
  code carrying seed, heat, pact and pace only — never a score or a name.
  Opening `?code=…` boots that board directly with no prompt. Typos are
  refused by a checksum.
- **Coach v2.** One short first-use tip per verb (KICK, THROW, REMOTE),
  worded from the GUIDE's own help text, on a clock that pause cannot burn
  and never painted over the pause or end veils. Store: `nb.coach.v2`.
- **Combo and chain callouts** and a **close-call flash** during play; both
  obey the REDUCE FLASH and SHAKE settings and never paint over PAUSED,
  WIN or LOSE.
- **TIME ATTACK** on `5` in the LEVEL SELECT rail (renamed MODES): a
  play-only stopwatch in the HUD and a per-room best on the CLEARED line.
  Store: `nb.times.v1`.
- **App icon set** redrawn as MAKO's face: `icon-512.png`, `icon-192.png`,
  `apple-touch-icon.png`, `favicon.svg`.

### Changed
- Main menu order is now PLAY, LEVEL SELECT, DAILY, OPTIONS, GUIDE,
  HIGH SCORES, STATS, SOURCE.
- The end-screen cue reads `SPACE / TAP · new run · C copy · B board`.
- The STATS bests note names the real filter: `BESTS: NO PACT · NORM`.
- A run started from LEVEL SELECT above room 1 still counts for score but
  never claims FURTHEST ROOM YET. A first-ever run that scores zero prints
  no delta line.
- Colourblind audit: SAND's brick highlight moved off a colliding swatch.

### Fixed
- Combo callouts no longer paint over the pause, win or lose veils, and no
  longer leak into a same-room restart.
- The stopwatch value recorded on a room clear is now the value the CLEARED
  line shows.
- Pause verified against seven states it had never been tested on.
- An ordinary run after a DAILY run plays the session's own seed again
  instead of replaying the day's board.

## shell v103 · 2026-09-06 · pushed (`397c283`)

### Added
- **MAKO**, a non-human reef-critter hero, in both CLASSIC 2D and REAL 3D.
- Twelve redrawn pickup icons that read as nameable objects, with distinct
  plan-view bodies in REAL 3D.
- **OPTIONS** page: music and SFX volume, RENDER, 3D camera preset,
  brightness, screen shake, reduce-flash. A pause menu with RESUME /
  RESTART / OPTIONS / QUIT TO MENU.
- **GUIDE** page folding HOW TO, ITEMS and ENEMIES one hop under the menu.
- **Soundtrack v3**: ten room themes, each its own tempo and mode, soft
  timbres, no shared motif.
- A tree-wide test that keeps a private reference name out of every
  committed file.

### Removed
- The HTML toolbar, legend and HUD strip below the canvas. The canvas HUD
  is the only HUD.

## 2026-09-04 · arcade loop

### Added
- Attract mode that starts a run on any input, an honest end screen, scores
  kept per heat, a ghost coach for the first bomb, four local plaques on
  HIGH SCORES, a first-visit handoff straight into CORE room 1, and the
  store-listing art.

**CONTINUE?** Earlier history is in `git log` and the repository's
[`MEMORY.md`](MEMORY.md).
