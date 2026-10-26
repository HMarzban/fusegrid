# Changelog

> **PATCH NOTES.** Every player-facing change to Fusegrid, newest first.
> Insert coin, scroll down, see how the cabinet grew.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
each release lists what was **Added**, **Changed**, **Fixed** or **Removed**.
Fusegrid has no version number of its own. Each release is named after the
PWA shell revision that shipped it (`CACHE_NAME` in `src/pwa/shell.js`),
because that's what makes an installed copy update, and it's dated. The
public launch came two days before the first shell, so that one is named
by its date.

Entries are written for players. How a change works lives in
[docs/architecture.md](docs/architecture.md); how to ship one is in
[CONTRIBUTING.md](CONTRIBUTING.md#-shipping-a-release).

## shell v187 · 2026-10-26

### Changed
- **The play-stats question no longer stops the game.** It's now a small card
  in the bottom-right corner (along the bottom on a phone), with no dimmed
  background, so you can keep playing and answer whenever you like. During a
  run it shows only when it fits beside the board, and never over the controls
  on a phone; otherwise it waits for the menus.

## shell v186 · 2026-10-26

### Fixed
- **The play-stats card now goes away.** ALLOW and NO THANKS saved your choice
  but left the card on screen, and it also showed on the title screen. It now
  closes the moment you answer, and appears only on the menus.
- **The NEW VERSION READY card now goes away too.** LATER didn't hide it, and it
  could stay up during a run. If you're updating from v185 or older, press
  RELOAD on it once and the fixed version takes over.

## shell v185 · 2026-10-26

The board gets a whole new look in all three looks (CLASSIC 2D, PIXEL, REAL 3D):
walls, floor, outline, depth, motion, foes and pickups. The boards themselves are
today's boards, so challenge codes, dailies and ghost races work exactly as
before.

### Added
- **A preview of floor tiles.** Eight tiles, one per world, are drawn in all
  three looks: BOOSTER, ICE PATCH, CONVEYOR, STREAM, TRAP, QUICKSAND, PORTAL and
  GATE. They are not on today's boards yet; they arrive with the new boards.
  The GUIDE's FLOOR page shows them now, marked PREVIEW.
- **New walls** in every world, and a **new floor** under everything.
- **GUIDE grows a fourth door, FLOOR.** It previews the eight tiles at CORE,
  PLUS and MAX as each look draws them, with a rule line only for the four tiles
  that have one (the other four say LOOK ONLY FOR NOW). GUIDE is now a 2x2 of doors on a
  keyboard screen and four stacked rows on touch.
- **The guide pages are alive.** ITEMS, ENEMIES, HOW TO and the MENU preview now
  show the foes blinking and bobbing and the pickups with their rings and glint,
  in CLASSIC 2D and in PIXEL (the PIXEL pages play the board's own frames).
- **A board outline per world** (a continuous rail with corner pieces) set in a
  recessed well with a glow, replacing the plain border.
- **Depth.** Walls, bricks, pickups, bombs and foes cast soft shadows, bricks
  are calmer so pickups stand out, and REAL 3D gains relief and gloss.
- **Enemies and pickups come alive.** Every foe blinks, breathes and bobs, pops
  in when it spawns, squashes and flashes once when it dies, and hunters narrow
  their eyes and lean toward you. Pickups hover on a soft shadow with a glint,
  and each kind bursts its own way when you collect it (rings, spark fans,
  streaks, rising diamonds). All three looks share one timing table, REAL 3D
  pickups are now glyph badges, and PIXEL foes got a 4-phase walk.
- **Foes and pickups got a last pass.** PIXEL chaser, burrow, boomerang, rocket
  and fast have richer surface detail. In REAL 3D a pause no longer cuts a death
  or collect effect short, the JUNGLE and ARENA motes read, and the ICE rim is
  lighter. Foes now fade in and out in REAL 3D instead of popping.
- **PIXEL tiles polished.** All eight tiles were cleaned up at every heat, so
  CORE, PLUS and MAX read apart more clearly, and FAST got a fuller body and a
  real side view.
- **The PIXEL tiles are hand-drawn**, every tile at every heat.
- **Finished top corners.** The HUD bar now ends in caps at the top of the board
  outline, with the corner piece just below it, instead of covering it.
- **Ambient motion.** Pollen, snow, steam, ripples, dust, sand, wisps and gold
  dust drift on the play clock. It freezes on pause, halves on EFFECTS LOW and
  turns off if your device asks for reduced motion. The ATTRACT demo shows it
  too; menus never do.
- **Opt-in play stats.** The first time you reach the menu, the game asks
  whether to share play stats through Google Analytics: opens, the
  runs you start and the room you reach. Nothing is sent unless you press
  ALLOW, and **OPTIONS → ANALYTICS** switches it off again (it also deletes the
  cookies). Only the official site sends anything. Details:
  [docs/privacy.md](docs/privacy.md).

### Changed
- PIXEL loads on demand, so CLASSIC 2D never downloads it.
- On a phone held upright the board sits better between the pause pill and the
  controls.

### Not yet
- The tile boards are a test build: add `?gen=2` to the URL to play them. They
  become the default with the new boards (random board every run, fairness,
  new codes: #10–#13) and the tile balance pass (#28). STREAM, QUICKSAND,
  PORTAL and GATE have no rules yet (#26, #27), and no tip teaches tiles (#24).
- Frame times on a real GPU are not measured (#34), and the tiles have no
  colour-vision gate yet (#33). The gaps are tracked in #35.

Details: [docs/superpowers/specs/2026-10-25-board-look-depth-ambient-design.md](docs/superpowers/specs/2026-10-25-board-look-depth-ambient-design.md).

## shell v184 · 2026-10-21

### Fixed
- **The kick hint tells the truth.** HOW TO PLAY and OPTIONS used to say
  K + MOVE kicks a bomb, but K never did anything. With the KICK power you
  just walk into a bomb and it slides, and that's what HOW TO PLAY says now.

## shell v183 · 2026-10-21

### Added
- **See which version you're playing.** The main menu now shows the build
  number, the same shell number these notes are named by: next to the key
  hints on a laptop, under the tiles on a phone, and on the SOURCE tile on a
  sideways phone. The NEW VERSION READY card also tells you which build
  you're on before you reload.

### Fixed
- **SHRINK walls show up in REAL 3D.** With the SHRINK mode on, the walls
  that close in on the room now appear in REAL 3D too. Before, a brick on
  the closing ring just vanished and an invisible wall blocked you.

## shell v182 · 2026-10-19

### Added
- **Screenshots in the install dialog.** Installing Fusegrid from Chrome
  now shows two real shots of the game (REAL 3D on a laptop, CLASSIC 2D on
  a phone) instead of a bare name and icon.

### Changed
- **A new share card.** Links to Fusegrid in chat apps and social posts now
  preview a fresh card that shows all three looks: CLASSIC 2D, PIXEL and
  REAL 3D. Some apps keep showing the old preview for a while.

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

Shell v179 was built the same day but never deployed, so v180 carries it.

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
- **Join the build.** A contributing guide, a code of conduct, a security
  policy, bug and idea templates, and a docs map, for anyone who wants to
  help build the cabinet. Nothing in the game itself changes.

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
- **A touch pause button.** While the game isn't playing, the pad and the
  bomb button hide so they don't cover the pause rows.
- The canvas HUD shows the room number and the foes left as chips.
- OPTIONS shows the shell revision, so you can tell if you're on an old
  build.

### Fixed
- RESTART from the pause menu saves your score before it resets the run.

### Removed
- The HTML toolbar, legend and HUD strip below the canvas. The canvas HUD
  is the only HUD.

## shell v31 · 2026-09-05 · pushed (`569bc0a`)

The arcade loop, plus everything built since shell v1.

### Added
- **The arcade loop.** The attract demo starts a run on any input, an
  honest end screen speaks SPACE / TAP, `C` copies your run, HIGH SCORES
  gets CORE / PLUS / MAX tabs, a ghost coach shows WASD / SPACE on your
  first run, four local plaques light up on HIGH SCORES, a first visit goes
  straight into CORE room 1, and the store-listing art is in `media/`.
- **Pace.** EASY / NORM / HARD on LEVEL SELECT (`[` `]`) scales how fast
  you and the foes move, and the game remembers it.
- **Stereo music.** The chiptune now pans its voices left and right.
- HIGH SCORES gains a column for the Pact toggles a run used.
- **Each pickup has its own glyph and grab chime**, in CLASSIC 2D and on the
  REAL 3D cubes, and walking onto one throws a coloured burst. HOW TO, the
  HUD chips and planted bombs use the same glyphs.

### Changed
- **Foes are characters now.** Every foe has its own silhouette, a face or
  a lens, shading, and a pose that turns with where it's heading, in
  CLASSIC 2D and REAL 3D. Each one dies with its own sound. Rooms 6–8 add
  three foes of their own: BURROW, SHADE and KNIGHT.
- **REAL 3D looks brighter and bigger.** The camera sits lower, the board
  fills more of the screen, the fog that hid the far half of the board is
  gone, and the four crossing border rails are one cabinet rim.

### Fixed
- An installed copy now reloads itself when a new version is out, instead
  of staying on the old one until you clear site data.
- Embedded listings (an iframe or `?embed=1`) no longer install the offline
  cabinet, so they can't take over the main site's copy.
- Holding Space through the start of a run no longer drops a bomb on the
  first frame, and a long pause no longer uses up the first-run coach.

## shell v1 · 2026-09-03

### Added
- **Heat.** LEVEL SELECT gets CORE / PLUS / MAX. PLUS and MAX bring the
  next foe sooner and tighten the fuse, the floor cubes and the chase.
  HIGH SCORES stores score × heat (CORE ×1, PLUS ×2, MAX ×3); the live HUD
  shows your raw score.
- **Pact and rooms 6–8.** Clear room 5 once and LEVEL SELECT opens four
  Pact toggles on `1`–`4` (LAST, BARE, THIN, SHRINK) and three new rooms:
  SAND, VOID and CROWN, each with its own look, theme tune and boom. Room 8
  is a second finale.
- **ITEMS and ENEMIES pages** in the menu explain every pickup and foe.
- **A tune for every room**, and layered sound effects instead of single
  beeps: kills rise, hurts fall, and the boom follows the room.
- **Play offline.** Fusegrid installs as an app and plays offline after
  your first visit.
- Solid pillars inside the board, pickups lying on the floor to walk up, a
  staged foe roster and a room-5 finale.

### Changed
- The attract demo plays like a person: it plants and leaves, goes for
  pickups and stays out of its own blasts.

### Fixed
- Planting a bomb in a one-tile corridor no longer traps you; holding the
  direction slides you clear.

## 2026-09-01 · Fusegrid goes public

### Added
- **Fusegrid is live** at <https://hmarzban.github.io/fusegrid/>, MIT
  licensed, with the FUSE/GRID wordmark and a share card for link
  previews. Already in the cabinet: CLASSIC 2D and REAL 3D, a title and
  menus, an attract demo, chiptune music, a touch pad and high scores.
- **Five looks.** Rooms 1–5 are JUNGLE, ICE, FACTORY, WATER and ARENA,
  each with its own palette.
- A SOURCE row in the menu opens the code on GitHub (2026-09-02).

### Changed
- Foes wander in four directions.
- REAL 3D frames the whole board.

### Fixed
- Surviving a hit no longer wipes the bombs and blasts already on the
  board.
- REAL 3D no longer crops to the bottom-left quarter on Retina screens.

**CONTINUE?** How the game got here, from the first commit, is in
[the dev diary](docs/diary.md). Every change is in `git log` and the
repository's [`MEMORY.md`](MEMORY.md).
