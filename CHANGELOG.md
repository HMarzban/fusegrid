# Changelog

All notable player-facing changes to Fusegrid. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Fusegrid has no
version number of its own; each entry is dated and names the PWA shell
revision (`CACHE_NAME` in `src/pwa/shell.js`) that shipped it, since that is
what makes an installed copy update.

## shell v177 · 2026-10-10

### Changed
- **Explosions look 3D in REAL 3D.** Blasts are now billowing fireballs with
  a white-hot core along every arm, a big burst on the bomb tile, and a
  glowing plate on each deadly tile, so you can see exactly where it hurts.
  They used to be flat, faint cards.
- **More room to play on a portrait phone.** During a run the board moves up
  under the pause button and the D-pad grows a little; the menu stays
  centred.

### Fixed
- If you arm Reset on STATS by mistake, you can still tap `C COPY` to copy
  your stats (it also cancels the reset).

## shell v176 · 2026-10-10

### Changed
- **Better use of a portrait phone screen.** The board now sits in the
  middle of the screen on the title, the opening and the menu, and during a
  run the D-pad and bomb button are bigger and sit low, where your thumbs
  are, instead of leaving an empty band at the bottom.

### Fixed
- **STATS says when it copied.** Pressing `C` on STATS now shows `COPIED`
  (or `COPY FAILED`), and on touch you can tap `C COPY MY STATS` to copy.
- `R` and `M` now leave the attract demo like every other key.
- Menu sounds no longer pile up and play late if a key is pressed before
  the browser has finished turning the audio on.
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

Earlier history is in `git log` and the repository's `MEMORY.md`.
