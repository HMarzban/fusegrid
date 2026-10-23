# The FUSE/GRID dev diary

> **BUILD LOG.** How Fusegrid went from one deterministic simulation to a
> three-look arcade cabinet in your browser, told day by day. Grab a
> controller, this one has cutscenes.

This is the story of how the game was built: the big turns, the dead ends
and what each one taught us. It runs from the first commit on 2026-08-16 to
shell v182 on 2026-10-19: 528 commits in all.

- **What changed in each release** lives in the [CHANGELOG](../CHANGELOG.md).
- **How the game works today** lives in [architecture.md](architecture.md).
- **Why a decision was made** lives in the dated specs and plans under
  [`docs/superpowers/`](README.md#-design-history). Entries below link the
  ones that exist.
- **Every session's own notes** are in [`MEMORY.md`](../MEMORY.md), the raw
  log this diary is cut from.

"The owner" below is the person who runs the project and makes the taste
calls. Much of the work was done by coding agents in parallel sessions,
with reviewers checking each change. That's why so many entries
mention review rounds and contact sheets.

---

## 🗺️ The run at a glance

| Date | Level | What happened |
|---|---|---|
| 2026-08-16 | 1-1 | First commit: a deterministic sim and a plan for fake 3D |
| 2026-08-23 | 1-2 | The big fix-up day: bugs found, menus, touch, music, a netcode harness |
| 2026-08-24 | 1-3 | Engine reversal: REAL 3D on a vendored Three.js |
| 2026-08-26 | 1-4 | Rules overhaul: solid bombs, sliding kicks |
| 2026-09-01 | 2-1 | Fusegrid goes public on GitHub Pages |
| 2026-09-03 | 2-2 | Heat, Pact, rooms 6–8 and the offline cabinet (shell v1) |
| 2026-09-04 | 2-3 | Foes become characters; the arcade loop lands |
| 2026-09-05 | 3-1 | Art, settings and the soundtrack rewrite begin |
| 2026-09-06 | 3-2 | MAKO arrives; soundtrack v3 is approved (shell v103) |
| 2026-09-07 | 3-3 | Retention waves 1 and 2: DAILY, STATS, run summary (shell v143) |
| 2026-09-17 | 3-4 | Tests gate every deploy |
| 2026-10-08 | 4-1 | Medals, ghost, camera rig C, phone layouts (shell v163) |
| 2026-10-09 | 4-2 | The opening show; the key matrix |
| 2026-10-10 | 4-3 | 3D blasts with volume; PIXEL gets the GO |
| 2026-10-11 | 4-4 | Three looks and a cooler cabinet (shell v178) |
| 2026-10-19 | 5-1 | New menus and NEW VERSION READY (shell v180) |
| 2026-10-19 | 5-2 | Phone menus fill the screen; launch prep (shell v181–v182) |

---

## 🕹️ World 1: The core and the third dimension

### 2026-08-16 · Insert coin

The baseline commit (`d3975af`) was already a whole game: a deterministic
single-player simulation, a procedural renderer and a seam for netcode, with
16 tests green. The sim was the crown jewel. `step(world, dt, intents)` reads
no clock, no DOM and no `Math.random`, so the same inputs always replay the
same run, in Node and in the browser.

The first big question was 3D. A four-agent research team looked at engines
and came back with a surprise: "we need a heavy engine" was the wrong
instinct. Because the sim is decoupled, 3D is a *renderer* change and nothing
else. The owner chose to keep zero dependencies and no build step, and to fake
the third dimension: a dimetric camera tilted about 30°, with bricks and walls
extruded into depth-sorted blocks on Canvas 2D. The design spec went through
five review rounds in two days.

📎 [Dimetric 3D renderer spec](superpowers/specs/2026-08-16-dimetric-3d-renderer-design.md)

### 2026-08-23 · The big fix-up day

Sixty-six commits in one day. It opened with a five-agent review of the whole
codebase, which found real bugs hiding under green tests:

- enemy contact never actually hurt you (it only emitted an event),
- the replay harness threw away the inputs it generated, so the replay tests
  proved nothing,
- a pointer *release* latched fire on,
- chain detonation only reached bombs one tile away.

A master plan ordered the work: fix the harness, fix the gameplay bugs,
purge everything non-deterministic from the sim in one go (determinism
baseline v2: no transcendental maths left in the sim), then build the dimetric
renderer. All of it shipped that day, plus five more pieces:

- a cinematic intro and the first menus,
- a touch pad that feeds the same input pipeline as the keyboard,
- renderer v2, with textured diamond tops and per-biome block heights,
- a lockstep netcode harness behind `?net=local`, proving two worlds stay
  identical, *not* internet play. Fusegrid is single-player and still is,
- chiptune music and an attract-mode demo bot that plays when you walk away.

📎 [Master plan](superpowers/plans/2026-08-23-master-plan.md) ·
[Menus and intro](superpowers/specs/2026-08-23-menu-intro-design.md) ·
[Touch controls](superpowers/specs/2026-08-23-touch-controls-design.md) ·
[Renderer v2](superpowers/specs/2026-08-23-renderer-v2-design.md) ·
[Lockstep netcode](superpowers/specs/2026-08-23-netcode-lockstep-design.md) ·
[Music and the attract bot](superpowers/specs/2026-08-23-music-attract-design.md)

### 2026-08-24 · Engine reversal

One day with the dimetric look was enough. The owner judged it "not really
3D" and the pieces on the board not game-like enough. So the eight-day-old
no-Three rule was reversed **for the render layer only**. Three.js r160 went
in *vendored*: one MIT file in `vendor/`, loaded by a relative import, no npm
and no build. The sim kept every purity rule it had. The dimetric renderer
was kept as a museum piece behind `?render=iso`, and CLASSIC 2D stayed as the
other look.

REAL 3D went from skeleton to art pass in four stages that same day. A WebGL
canvas (`#gl`) sits under the 2D canvas (`#c`), which keeps drawing the HUD
and overlays. The stages added pooled entities, particles, an intro
fly-through and a first hero (a capsule body with a helmet, a visor and an
antenna). Pan and zoom arrived too.

📎 [REAL 3D renderer](superpowers/specs/2026-08-24-real3d-design.md) ·
[Camera control](superpowers/specs/2026-08-23-camera-control-design.md)

### 2026-08-25 · The black screen

The first REAL 3D camera overhaul fixed the rig on the full board
(`el 1.152, dist 700`) and hid free orbit behind `?orbit=1`. The elements
got a redesign: pickups with glyphs on every face, glossy bombs, flame
crosses and a helmeted hero.

The day's best bug: toggling from 2D to 3D gave a black screen, but booting
straight into 3D worked. A canvas hands out one 2D context, and the first
request decides its options. The boot 2D renderer had asked for an opaque
one, so the 3D overlay inherited it and painted black over the WebGL board.
The fix was to claim the overlay context first, with alpha on.

📎 [Camera research](superpowers/specs/2026-08-25-camera-research.md) ·
[Elements redesign](superpowers/specs/2026-08-25-elements-redesign.md)

### 2026-08-26 · Rules overhaul

A rules audit set the canon, and the sim moved to determinism baseline v3:
bombs are solid tiles, a kick slides a bomb until it hits something (its fuse
still ticking), and chasers route around live bombs. In 3D, the foes got a
footprint-first redesign. Seen from above, a foe's outline is what you read
first, so the rocket stood up as a pyramid instead of lying on its side.

📎 [Rules audit](superpowers/specs/2026-08-25-rules-audit.md) ·
[Enemy identity in 3D](superpowers/specs/2026-08-25-enemy-identity.md)

---

## 🌐 World 2: Going public

### 2026-09-01 · Fusegrid goes public

A production-hardening pass tightened the sim rules (baseline v4). Then the
game got its public name: **Fusegrid**, with the FUSE/GRID wordmark, at
<https://github.com/HMarzban/fusegrid>. The local folder stayed `rollblock`.
It went live on GitHub Pages under the MIT licence, with a share card for
link previews.

Rooms 1–5 got five looks of their own (JUNGLE, ICE, FACTORY, WATER, ARENA),
and foes switched to wandering in four directions (baseline v5).

REAL 3D also learned a Retina lesson that day. The code that sized the
canvases had been setting `#gl`'s pixel size, which crops a dpr-2 drawing
buffer to its bottom-left quarter. Now only the 3D wrapper sizes `#gl`.

### 2026-09-03 · Heat, Pact and the offline cabinet

The commits landed on the 3rd; the designs are dated the 2nd. This was the
day Fusegrid became a game you come back to:

- **Heat** grades CORE / PLUS / MAX on LEVEL SELECT. CORE is the replay
  baseline (v6), bit for bit. High scores store score × heat.
- **Pact** toggles and **rooms 6–8** (SAND, VOID, CROWN) unlock after your
  first full clear.
- Every room got its own chiptune theme, rooms 6–8 their own boom, and
  sound effects became layered stacks instead of single beeps.
- ITEMS and ENEMIES pages explain the cast in the menu.
- The attract bot learned to play like a casual player: plant, leave, go for
  pickups.
- **PWA shell v1**: Fusegrid installs and plays offline after the first
  visit. Shell v2 the same day added a global pace (EASY / NORM / HARD) and
  stereo panning for the music.

From here on, every shipped build has a shell number, the counter the
[CHANGELOG](../CHANGELOG.md) is organised by.

📎 [Heat](superpowers/specs/2026-09-02-heat-design.md) ·
[Pact](superpowers/specs/2026-09-02-pact-design.md) ·
[Rooms 6–8](superpowers/specs/2026-09-02-extra-rooms-design.md) ·
[Their looks](superpowers/specs/2026-09-02-extra-biome-looks-design.md) ·
[Their music](superpowers/specs/2026-09-02-extra-biome-music-design.md) ·
[Their booms](superpowers/specs/2026-09-02-extra-biome-boom-design.md) ·
[Score × Heat](superpowers/specs/2026-09-02-score-heat-design.md) ·
[Demo bot](superpowers/specs/2026-09-02-demobot-human-design.md) ·
[Pace](superpowers/specs/2026-09-03-pace-design.md) ·
[Stereo music](superpowers/specs/2026-09-03-streamed-stereo-music-design.md) ·
[PWA offline](superpowers/specs/2026-09-03-pwa-offline-design.md)

### 2026-09-04 · Foes with faces, and a brighter board

**The foes became characters.** An earlier "mature silhouettes" pass had
never actually landed in 2D: foes were still flat coloured circles with a
rectangle for a visor. Now one shared five-beat build draws every foe: a
contact shadow, a dark contour, an inset body, a sheen and a sculpted eye.
Creatures get eyes, machines get lenses, and a foe turns its back when it
walks away from you. Rooms 6–8 got three foes of their own (BURROW, SHADE,
KNIGHT). In REAL 3D the spheres and boxes became lathed and extruded hulls,
because from a steep camera three scaled spheres are just three circles.

**REAL 3D got its first real camera and light.** The rig moved from a
66° "security cam" (`el 0.419`) down to 54.5° (`el 0.62`), with a warm key
light and a cool fill. The four border rails, which crossed at the corners,
became one extruded cabinet rim with a hole. Later that day the rig went to
59.1° (`el 0.54`), fitted to the playfield instead of the decorative bezel,
and the board went from 38.9% to 50.9% of the canvas. The "too dark" report
turned out to be two bugs, not the lights. Fog was erasing 43% of the far
corners, and ACES tone mapping was crushing the darks and capping white. Both
went, so REAL 3D now shows the same palette CLASSIC 2D paints.

**The arcade loop** shipped the same day, with its spec and seven step plans
built in a row. It brought an attract demo that starts a run, an honest end
screen, scores per heat, a ghost coach, local plaques, a first-visit handoff
and a store-listing pack.

📎 [Enemy redesign](superpowers/specs/2026-09-04-enemy-redesign-design.md) ·
[Enemy character art](superpowers/specs/2026-09-04-enemy-character-art-design.md) ·
[Enemy 3D bodies](superpowers/specs/2026-09-04-enemy-3d-bodies-design.md) ·
[3D camera, lights, frame](superpowers/specs/2026-09-04-3d-cam-light-frame-design.md) ·
[3D framing and brightness](superpowers/specs/2026-09-04-3d-framing-brightness-design.md) ·
[Arcade loop](superpowers/specs/2026-09-04-arcade-loop-design.md)

---

## 🎨 World 3: Finding the cabinet's face and voice

### 2026-09-05 · The hero problem, part one

Just after midnight, shell v31 went out to players (`569bc0a`). Then the
items and player art program started, with the pickups. The first pass
optimised for distinct shapes and shipped a berry for BOMB, a slipper for
KICK, a magnet for PASS, a sparkle for POWER and a folder for REMOTE. The
owner said players would be confused by them. The new rule: **every glyph is
an object you can name**, and when meaning and distinctness disagree,
meaning wins.

Then the hero. **SIGNAL RUNNER** was a light kite-shaped hull with a teal
crown and a visor slit, and in 3D a five-mesh stack. That stack took the
fat-world draw-call count from 143 to 141, and it still stands under the
current hero. The owner called it too silly and not mature enough. At its
real 28-pixel size it read as a white egg with a teal cap, while every test
stayed green. A re-cut tapered it, darkened it and gave it shoulders.

The settings program landed in parallel. OPTIONS became a real page, pause
became a RESUME / RESTART / OPTIONS / QUIT list, the HTML toolbar and HUD
strip under the canvas were retired, and HOW TO, ITEMS and ENEMIES folded
under one GUIDE row. The first soundtrack rewrite began too: ten tracks
sharing one five-note motif.

📎 [Items and player art](superpowers/specs/2026-09-05-items-player-art-design.md) ·
[Player 2D plan](superpowers/plans/2026-09-05-player-2d.md) ·
[Player 3D plan](superpowers/plans/2026-09-05-player-3d.md) ·
[Settings and menus](superpowers/specs/2026-09-05-settings-menu-design.md) ·
[GUIDE and HUD](superpowers/specs/2026-09-05-guide-hud-design.md)

### 2026-09-06 · MAKO, and the sound of v3

**The hero problem, part two.** The owner rejected the 2D hero next. On
FACTORY its grey hull sat within 0.008 of the wall's value and 8.3° of its
hue, so a thin outline was doing all the work. **IONVEST** answered with an
orchid suit and a bigger head, and split the 2D and 3D palettes. It didn't
last the day. The owner vetoed every human-shaped hero: the main character
had to be a creative character, not a person.

So an art round drew three non-human concepts on all eight floors, next to a
real foe, and **MAKO** won: a reef critter whose head and body are one
mass, with two swept teal ear-fins that make a chevron no foe has. Its
bulging cream eyes break the top of the outline over a grin with two blunt
teeth (the concept's fangs were dropped: hero, not monster). One violet,
`#c39cff`, now paints MAKO in both renderers, and the IONVEST palette split
was retired. In 3D, MAKO reuses SIGNAL RUNNER's five meshes with new jobs.
Neither SIGNAL RUNNER nor IONVEST ever reached the public site. The push went
straight from shell v31 to v103.

**The soundtrack, three times.** The owner listened to the first rewrite and
found it didn't sound arcade enough. It had treated rests and silence as
maturity, and every test passed while the music failed. Direction
v2 went bright arcade pop at 104–140 BPM with one motif everywhere. The owner
listened and had three complaints: too harsh, too fast, too scary. They also
wanted every room to sound like its own piece. **Direction v3** answered each
complaint with its own fix:

- **harsh:** triangle and sine leads only, no sawtooth anywhere in the
  music, and a cap on how loud all the channels can peak together,
- **fast:** every track at its own tempo in a ~96–120 BPM band,
- **scary:** the dark rooms moved to minor pentatonic,
- **all the same:** the shared motif was retired, so each room owns its own
  hook.

v3 became the approved baseline, and that evening a fix wave found the
"every room is distinct" test had only ever compared A sections. Six B
sections were re-cut.

A tree-wide test also went in that day. It keeps one name out of every
committed file: the classic game Fusegrid is compared to. Shell v103 was
pushed (`397c283`).

📎 [Soundtrack v3](superpowers/specs/2026-09-05-soundtrack-design.md) ·
[Soundtrack program](superpowers/plans/2026-09-05-soundtrack.md)

### 2026-09-07 · Reasons to come back

The sphere app icon was retired for MAKO's face. Then two retention waves
shipped in one day, built from a gamification report the day before:

- **Wave 1:** combo and chain callouts, a close-call flash, TIME ATTACK on a
  MODES rail, and a colourblind audit that moved one clashing swatch.
- **Wave 2:** a run summary, STATS, DAILY, a twelve-character challenge code
  and coach v2.

Wave 2 wrote down two rules the cabinet still keeps. First, **a delta that
cannot lie**: NEW BEST and its friends are printed only from a persisted
record, only at a run end. Second, **DAILY is honour-system and
single-device**, with no streaks and no "welcome back". The challenge code
carries a board and never a score, and a test refuses the word for a global
ranking table anywhere in the code. This is the day `CHANGELOG.md` was born.
Shell v143 was pushed (`18f9d9d`).

📎 [Retention report](superpowers/specs/2026-09-06-retention-report.md) ·
[Wave 1](superpowers/specs/2026-09-06-retention-wave1-design.md) ·
[Wave 2](superpowers/specs/2026-09-07-retention-wave2-design.md) ·
[CVD audit](superpowers/specs/2026-09-06-cvd-audit.md)

### 2026-09-17 · Tests guard the door

A Node 26 test job now runs on every pull request and must pass before any
GitHub Pages deploy. The first human-facing architecture note landed with it.

---

## 📱 World 4: Phones, feel and the opening

### 2026-10-08 · Medals, ghosts and camera C

After a three-week break, a loose-ends wave cleared the backlog. Then
retention wave 3 added four things:

- **DAYS PLAYED**, a lifetime count that is never a streak,
- **eight medals**, each needing a finale clear and settled only at a run's
  end,
- a **ghost** of your fastest clear, valid only on the exact same seed,
  room, heat, pact and pace,
- **reset my cabinet**, a two-press wipe that keeps your settings.

A touch audit found the phone bugs. Pause taps scaled the wrong way, so on a
phone they never reached a row. The bomb button's own CSS beat the browser's
`[hidden]` rule, so it never hid. MENU rows weren't tappable at all.

The owner picked **camera rig C** from a contact sheet: `el 0.66` (52.2°)
through a narrow 24° lens from `dist 1503`. It sits lower than the old rig
and still fills *more* of the canvas (54.2% against 50.9%), because a narrow
lens widens the near edge less. A new `fit.js` gave phones their own portrait
and landscape layouts. Shell v163 closed the day.

📎 [REAL 3D camera and phone fit](superpowers/specs/2026-10-08-3d-camera-design.md) ·
[Retention wave 3](superpowers/specs/2026-10-08-retention-wave3-design.md)

### 2026-10-09 · The opening show

At the lower rig, the near border wall in REAL 3D hid actors on the last row.
The owner chose a cutaway over see-through walls or leaving it: that one row
tops out at 22 units, the tallest height where every row-11 actor keeps its
eyes.

A report that B and Enter didn't react after a level turned into a keys
pass and `tests/keys.test.mjs`, which drives every documented key in every
state through the real listeners. An audio pass found that a touch press and
Escape carry no browser activation, so music could stay silent. The unlock
now stays armed until the audio actually runs.

Then the **opening**: a FUSE/GRID title that waits for a press, then a
4.384-second show. The camera sweeps in, MAKO pops up and lights a fuse, and
the blast reveals the menu. This reversed the first-visit rule from
2026-09-04: every visit now lands on the menu.

PIXEL, a hand-pixelled sprite look, got a research team and a full plan that
day, and a firm ruling: planning only, nothing starts until the owner says
so.

📎 [Opening](superpowers/specs/2026-10-09-opening-design.md) ·
[PIXEL plan](superpowers/plans/2026-10-09-pixel-art-spike-plan.md)

### 2026-10-10 · Blasts with volume, and the GO

Four parallel agents fixed six loose ends. Portrait phones got a centred
board with a big thumb-height pad, and a hitch on the first key press was
traced to the browser's first `new AudioContext()`, which blocks for 66–115
ms. Now a throwaway context pays that cost at boot.

The owner wanted REAL 3D explosions that "look like 3D". From a three-way
contact sheet, blast v3 won: shaded fireballs over a glowing danger plate on
every lethal tile, in exactly two instanced draws however many blasts are
live (shell v177).

Then the owner gave PIXEL the GO, overruling the planning-only rule from the
day before, and asked the team to finish it without stopping for questions.
The engine foundation and the first sprite sheets (tiles, bombs and blasts,
MAKO) landed that night.

### 2026-10-11 · Three looks and a cooler cabinet

Shell v178 shipped three programs at once:

- **PIXEL**, the third look: RENDER now cycles CLASSIC 2D → PIXEL → REAL 3D.
  165 sprite cells are authored as palette-slot grids, never raw hex, and a
  test fails if any foe, pickup or room is missing its art.
- **Pickup feedback:** floating value labels, a pulsing HUD chip, an
  ability bar, THROW and REMOTE buttons on phones, and first-use tips for
  eight powers.
- **GRAPHICS and frame pacing:** one settings page, from BATTERY to HIGH. A
  frame-rate cap divides the screen's vsync rather than pacing frames
  unevenly, idle screens drop to 30 fps, and a still board isn't redrawn.
  Measured on one 120 Hz laptop: menus −56…−80% CPU, PAUSE −59…−67%, play
  −27…−36%.

It went live the same day (`e1f3b23`).

---

## 🧰 World 5: The menus

### 2026-10-19 · CONSOLE PANEL, ATLAS and NEW VERSION READY

The day started with a docs pass: a contributing guide, a code of conduct, a
security policy, issue templates and the [docs map](README.md).

The owner asked for a cohesive, mature MENU and PAUSE. A designer workflow
(a game designer, a menu designer, a lead, three prototypes in their own
worktrees and a reviewer) produced a contact sheet. The reviewer scored A
7.5, C 6 and B 5.5, and the owner picked **A, CONSOLE PANEL**: one plate,
one selected-row look, one set of controls for MENU, PAUSE and every page.

While testing, the owner landed on a stale cached copy (shell v167), the
exact trap this project had warned itself about since September. The answer
was **NEW VERSION READY**: a new build installs, waits, and a card offers
RELOAD on the menus or after a finished run, never mid-run. The same fix
stopped the service worker from deleting other sites' caches on the shared
`hmarzban.github.io` origin.

A polish round lifted phone menu rows to 32.7 CSS px on a 393 px phone
(from about 21).
A second design round answered the owner's next asks: slimmer pages, a
card-like LEVEL SELECT, and hooks that show what the game offers. The
reviewer ranked A 7.0, B 6.5, C 6.4, and the owner picked **B, ATLAS**:
pick on the left, see it on the right. It came with one rule, *hooks never
lie*. A score teaser reads only runs you played. Shell v179 was never
deployed on its own, so shell v180 carries both rounds. It went live the
same day.

### 2026-10-19 · Bigger phone menus, then launch prep

The same afternoon, **shell v181** gave phone menus the whole screen. On a
phone held upright, MENU and every page now draw on a full-screen box at
about 0.9 scale instead of 0.63, so hub tiles grew from 41 to 59 CSS px and
the smallest text from 6.3 to 9 px. Narrow pages re-flow: LEVEL SELECT puts
the room card under the grid, ENEMIES drops to two columns. The board stays
put behind them. The same release kept the legacy iso view's MEDALS, STATS
and HIGH SCORES inside their boxes, and stopped the room card promising NO
TIME YET before TIME mode is open.

Then the cabinet got ready to meet people. Several sessions ran in
parallel, each in its own worktree, with one supervising session merging
their branches:

- **This diary**, plus a CHANGELOG backfilled all the way to the public
  launch.
- **An SEO pass and a promotion kit** ([marketing/README.md](marketing/README.md)):
  a meta description and JSON-LD that lead with play-in-the-browser, the
  three looks and Heat; a sitemap `lastmod` a test keeps honest; pitch copy,
  per-platform tags, portal research and a launch checklist.
- **Fresh listing art**, all real captures: install-dialog screenshots in the
  web manifest, a PIXEL still, three short silent gameplay clips and a MENU
  still retaken on v181. Two sessions retook that same still at once; the
  team kept one and dropped the other.
- **A new share card.** From a three-way contact sheet the owner picked
  **C**: the ATLAS LEVEL SELECT in CLASSIC 2D, with all three looks named.
  The share text, the GitHub About description and its 20 topics now say
  the same thing, and "deterministic" no longer leads the storefront.

**Shell v182** shipped the install screenshots and the new card the same
evening. The launch itself waits: the owner parked the whole promotion plan
as [issue #7](https://github.com/HMarzban/fusegrid/issues/7) ("we have lots
of todo before we publish it").

### 2026-10-21 · Walls you can see, and a version you can read

While designing new levels, the team noticed that REAL 3D built its walls
once per room. SHRINK's closing rings were solid but invisible in 3D: a
brick vanished, and a wall you couldn't see blocked you. **Shell v183**
makes the 3D walls follow the grid. The owner also asked to see which
version is running, so the main menu now shows the build tag (`v183`),
read from the same cache name that makes installed copies update.

**Shell v184** followed the same day with a fix for
[issue #6](https://github.com/HMarzban/fusegrid/issues/6): HOW TO PLAY
and OPTIONS said K + MOVE kicks a bomb, but kicking was always just walking
into one. A test pinned the K key's latch, never that the game read it, so
nothing caught the lie.

---

## 🧪 Lessons from the workshop

The bugs and habits worth passing on. Each one cost a real afternoon.

**A stale service worker looks exactly like a change that didn't land.** It
fooled a 3D review twice on 2026-09-04 and the owner on 2026-10-19. Clear
site data, or use a fresh profile, before you trust a screenshot. And
`localhost` and `127.0.0.1` are separate origins with separate workers.

**Hidden tabs pause `requestAnimationFrame`.** A backgrounded capture tab
freezes the game loop, so the store GIF was recorded by stepping the
deterministic sim through the debug hook. Check *state* with a rAF shim, and
measure *frame times* only in headed Chrome on a real GPU.

**Software rendering lies about speed.** A cold 2D stall measured under
SwiftShader didn't reproduce on Metal. On macOS a fresh browser profile isn't
even a cold shader cache.

**Never size the WebGL canvas from outside its owner.** Setting `#gl`'s width
and height cropped Retina screens to a quarter (2026-09-01). PIXEL's `#px`
was given exactly one owner from the start.

**A canvas's first `getContext` call wins.** An opaque 2D context claimed at
boot turned the 3D overlay into a black screen (2026-08-25).

**Your own CSS beats the browser's `[hidden]`.** `#hud{display:flex}` and
later `#tbomb{display:flex}` both ignored `hidden`. Every touch control now
has a matching `[hidden]` rule, and a test checks it.

**A touch `pointerdown` grants no activation.** Clipboard writes and the
audio unlock run on `pointerup`. Escape and modifier keys don't count either.

**The first `AudioContext` is slow.** It blocks for about 70–115 ms while the
audio device starts, so pay that at boot, not on the player's first press.

**Fog and tone mapping repaint your palette.** REAL 3D runs with no fog and
no tone mapping, so it shows the hex values CLASSIC 2D paints.

**Measure what the player actually stands beside.** MAKO's colour gate checks
seven swatches per room. Two of them, an opaque wall highlight and a brick
highlight blended over its base, were missing from the first list of five.

**A green test suite isn't an accepted direction.** SIGNAL RUNNER passed
every gate as a white egg. Soundtrack v1 and v2 both had clean test sheets
and both missed. Judge art at its in-game size, and music by listening.

**For a taste call, show two or three candidates side by side.** Camera C,
blast v3, CONSOLE PANEL, ATLAS and share card C were all picked from
labelled contact sheets, with the owner free to veto.

**A precached file only reaches installed players with a new shell.** The
web manifest is in the app-shell cache, so the install screenshots that
merged after v181 shipped stayed invisible to installed copies until shell
v182 bumped `CACHE_NAME`. Any change to a precached file needs a release,
not just a push.

**Parallel agents need fences.** One session's `git stash` once swept up
another session's work mid-commit (2026-09-06), and agents started right after
a side question once all answered the side question. Now every brief quotes
the owner's request word for word, each agent stops its own servers by PID,
and stray headless browsers get cleaned up after every round. One batch had
run for a day and a half.

---

## 🚧 Explored, not built

Design work that stayed on the drawing board. None of it is in the game.

- Three earlier menu redesign variants (2026-10-11), set aside before the
  CONSOLE PANEL round.
- A story mode (2026-10-11).
- A naming study (2026-10-11). FUSE/GRID stayed.
- A larger game-design bible with new worlds and bosses (2026-10-11).
- A new hero direction with a head, arms and legs (2026-10-11). MAKO is
  still the hero.
- Level variety (2026-10-20). A player-eye report said every room is the same
  maze, and the numbers agreed: 128 of 195 tiles never change, and one session
  replays the same board. Five research lenses and a critic produced the
  plan, and real-renderer mockups showed it. The plan is a random board every
  run, 14 bold biome mazes behind a fairness check, and new BELT / GLIDE /
  CURRENT tiles. It's tracked in issue #8;
  [design record](superpowers/specs/2026-10-20-level-variety-design.md).
- Difficulty tiles (2026-10-21). The owner asked for tiles that give "more
  joy" on easy and "more challenge" on hard. Three designers and a critic
  landed on eight floor tiles, later renamed to the most common names:
  BOOSTER, ICE PATCH, CONVEYOR, STREAM, TRAP, QUICKSAND, PORTAL and GATE,
  one per biome. Heat turns each tile's dial, shown by edge and
  marks rather than colour. It's tracked in issue #16;
  [design record](superpowers/specs/2026-10-21-difficulty-tiles-design.md).
- Living walls (2026-10-21). The owner asked for better walls in all three
  looks, with variants that make each world feel alive. Every world gets its
  own wall material, with built detail only so nothing looks breakable, and
  REAL 3D walls get brighter. A prototype held 141 draws. It's tracked in
  #17 (CLASSIC 2D + REAL 3D, on today's boards) and #31 (PIXEL);
  [design record](superpowers/specs/2026-10-21-wall-art-design.md).
- Art round 3 (2026-10-23). The owner asked for a look that is "more mature",
  with tiny details that matter to players, and more effort on REAL 3D. An
  art-director review at true size found the walls drawn like breakable
  masonry and covered in causeless speckle. The fix: wall faces that can
  never read as brick, marks with a cause, converging QUICKSAND and
  readable PORTAL pips, plus slow REAL 3D tile effects and lit wall relief
  at the same draw count. It's an addendum to both records above.

---

**CONTINUE?** See what each release changed in the
[CHANGELOG](../CHANGELOG.md), how it all works in
[architecture.md](architecture.md), or every dated record in the
[docs map](README.md#-design-history).
