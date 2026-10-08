# Changelog

All notable player-facing changes to Fusegrid. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Fusegrid has no
version number of its own; each entry is dated and names the PWA shell
revision (`CACHE_NAME` in `src/pwa/shell.js`) that shipped it, since that is
what makes an installed copy update.

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
