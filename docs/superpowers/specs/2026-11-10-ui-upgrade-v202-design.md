# UI upgrade (shell v202+): design record

Date 2026-11-10. Status: design approved by the owner over seven review rounds in the private gallery; build plan in `docs/superpowers/plans/2026-11-10-ui-upgrade-v202.md`, revised after a five-reviewer plan review (head of engineering, two staff engineers, art director, QA lead). Nothing here is built yet. Binding numbers: `docs/superpowers/specs/2026-11-10-ui-upgrade-v202-tables.md` (created by the plan's Task 0.2).

Owner, verbatim, at the start (2026-11-06): "we are gonna to upgrade the UI of the game and move on it to the next level and mature it, so let's create a full sets of UI and GUI and first show me then we will walkthrough and enhance or pick the right ones." Later rounds added: "the first menu is too complicated and people are complain", "this is important that the UI is fully customize for the game, and ensure also there is no dificulities to read and underestand the UI", "the naming and typo must be revise and make them simple", "when I say have a custom UI, I want that for the all game elements", and, on the burning-fuse focus marker, "I do not like it at all" (scope: "Everywhere").

The mock-ups, measured gates and per-round notes live in the git-ignored `.superpowers/sdd/notes/v202-ui-upgrade/` (round 5 kit `round5/K5-kit/`, round 7 kit `round7/K7-kit/`, screens `round6/*`, `round7/*`, art direction `round6/art/`, `round7/art/logo-b.md`). They are the visual reference for the build; this file is the binding summary.

## 1. The one rule

**The world dresses the stage; the arcade bomber is the controls and the voice.**

- Per world (varies with the room the next run starts in, or the room being played): the plate frame is that room's rampart (`frameart.js` rail and corner boss), the plate bed is its floor in shadow, the backdrop is its real board under a veil, a CHOSEN value is its brick, an UNCHOSEN value is its floor sunk dark, a LOCKED value is its wall cell. Hue follows the world; lightness never does: every state token is pinned to one relative luminance (`LUM` table below, `toL`), so every world reads the same.
- Constant in every world: one key shape for every pressable thing (thick dark outline, hard unblurred drop); cream ink `#fff2df`; sunny yellow `#ffd447` is the ONE main action on a screen and is never "chosen"; coral `#ff5d73` is danger only; heavy outlined display headings.
- ICE's UI hue is moved from navy to glacier cyan (`TINT.ICE`); its lightness stays pinned.

State lightness (relative luminance): bed .012, pane .006, well .007, key .022, band .07, mid .24, lit .72, lit2 .5, lip .22, rule .03, wall texture .06.

## 1b. Canvas and backdrop

- Menus (MENU and every shell page) and the WIN / GAME OVER screens draw on one full-window canvas on every layout, at the sizes the mock-ups were approved at (owner pick "Full window", 2026-11-10). PAUSE stays over the board.
- The menu backdrop is a cached "room look" of the next run's world (a fixed representative layout drawn by the board painters, under the veil), not the board the run will deal; while it covers the screen the game skips its board render.
- Menus look the same in every art style (CLASSIC 2D, PIXEL, REAL 3D): the kit draws them on the 2D menu canvas; only the logo build and the board behind change with the look.
- The next-run strip is a stylized start corner: true to the sealed spawn pocket, the roster and the floor tile, never presented as the dealt board.

## 2. Focus

Focus is the game's bomb body (`drawBombBody` with a body-only option) at the start of the focused row plus the row band. A focused key (PLAY, START, RESUME, TRY AGAIN, a chip) also gets a 3 px cream ring offset 3 px. **No cord, no spark, no burning fuse as a focus or selection marker anywhere** (owner, round 7). The logo keeps its own lit fuse: it is the logo, not a marker.

## 3. Names and type

Players' words (owner: "we must use the name that users know about"):

| Today | New |
|---|---|
| OPTIONS | SETTINGS (menu row, page title, PAUSE row) |
| ROOM, LV, L3 | LEVEL everywhere |
| HEAT · CORE / PLUS / MAX | DIFFICULTY · NORMAL / HARD / EXPERT |
| PACE · EASY / NORM / HARD | GAME SPEED · SLOW / NORMAL / FAST |
| MODES · IRON / BARE / THIN / SHRINK, TIME | MODIFIERS · ONE LIFE / NO FLOOR ITEMS / FEWER ITEMS / SHRINK, TIME TRIAL |
| POWER (the pickup) | POWER BOMB (edited in `POWER[].name`, still the one source) |
| RENDER | ART STYLE |
| PICKS, ITEMS, CUBES | POWER-UPS |
| CHANGE RUN | LEVEL SELECT |

Renames are display-only: stores keep their keys, bits and indices (`nb.pact.v1`, heat 0..2, pace -1..1, medal bits). The store page About text, the share card and the storefront copy follow in a separate docs step.

Type roles: display (logo, page titles, PLAY, WIN/LOSE headline, big numbers) is a heavy face 800–900 with the logo's dark outline over art; labels are system sans 700, CAPS for three words or fewer, letter-spacing 0 (no wide-spaced kickers); body is sentence case; no monospace for words; numbers draw in fixed-width cells through one helper; units unspaced (`2.5s`). First release uses the system heavy stack; a subset display font (Rubik ExtraBold, under 16 KB) is a later, separate decision.

## 4. Screens

- **MENU** rows in order: PLAY, LEVEL SELECT, DAILY, RECORDS, SETTINGS, GUIDE, SOURCE. PLAY is the yellow hero; its tag names only what differs from a default run (`LEVEL 1 · JUNGLE`). Fixed top margin, one row height, 8 px rhythm with 24 px breaks after PLAY and before GUIDE, quieter teasers. Beside the list a next-run card: world name, a strip of the real start corner with MAKO standing on his spawn floor cell, the foes (with counts), the floor tile, LIVES / FUSE / SCORE. Phone: PLAY bar, card, then tiles DAILY | RECORDS, SETTINGS | GUIDE, SOURCE full width. ICE and CROWN use the JUNGLE layout exactly.
- **RECORDS** (new page, replacing HIGH SCORES and STATS as MENU rows): tabs SCORES · STATS · MEDALS. The tab strip is the top row of the ↑↓ walk (←/→ or the D-PAD there, `Q`/`E`, or a tap switch tabs); in the SCORES body ←/→ and the shoulders keep the difficulty filter; Esc returns to MENU. STATS: one hero (best run: qualifier, score in brick digits, the level course it reached), three tiles (RUNS, PLAY TIME, MEDALS), two calm lists (LIFETIME; BEST BY DIFFICULTY). RESET is quiet at rest; armed, a confirm plate says in one sentence what is erased and what is kept.
- **LEVEL SELECT**: one path. LEVEL keys (8, finale flag on 5 and 8, 6–8 locked until the first clear), DIFFICULTY, GAME SPEED, MODIFIERS behind one door row, one compact card (world, start strip, foes, BEST, LIVES / FUSE / SCORE ×n), START hero. No schematics, no foe-name list, no paragraphs.
- **SETTINGS**: CAMERA and BRIGHTNESS rows exist only while ART STYLE is REAL 3D. Doors to GRAPHICS and CONTROLS stay.
- **GUIDE · ENEMIES**: each foe on a floor cell of its home world; points as brick digits + PTS; a tooltip on the focused points value explains them ("What you score each time your blast takes out a KNIGHT. Saved scores count ×2 on HARD and ×3 on EXPERT.").
- **CONTROLS**: a front-view twin-grip controller illustration (grips angled down and out, shoulders, triggers, concave sticks, recessed d-pad, four face buttons ~0.10 of body width, SELECT and START pills, top-lit shading), generic (no maker shape, logo, symbols or letters). Bound buttons lit in the world's brick, unbound quiet, labels beside each bound button by position, leaders that never cross. KEYBOARD tab: a tenkeyless keyboard with keycaps that have a top face and a darker skirt, real widths (TAB 1.5, CAPS 1.75, SHIFT 2.25/2.75, ENTER 2.25, BACKSPACE 2, SPACE 6.25), an F-row, the arrow cluster as an inverted T. Capture shows no countdown and says how to cancel; NO CONTROLLER is a calm empty state.
- **HUD** (in this upgrade, its own release; owner 2026-11-10): seven labelled chips above the board (LIVES, BOMBS, FLAME, LEVEL, ENEMIES, TIME, SCORE), never over row 0; power-ups below with their key; floor-tile tips beside the board on a leader; the round 5 phone touch strip (PAUSE key, D-PAD keys, yellow BOMB). The stage reserves room above and below the board for it.
- **PAUSE**: centred top block (LEVEL 3 · FACTORY, PAUSED, a tag row showing only non-default rules, each naming its setting when ambiguous), clear space, then RESUME (yellow, ESC cap at its end), SETTINGS, a wall-course divider, RESTART and QUIT TO MENU in danger.
- **End screens**: Enter keeps today's behaviour (next level, finale to MENU, a new run); Esc and a MENU key go to MENU at a run end.
- **WIN**: level clear (short: raised headline, three stat cards, one record ribbon, NEXT LEVEL) and finale (FUSE/GRID CLEAR: score in brick digits, the course with check notches, stat cards, records as ribbons and medals hung from a wall shelf, MENU as the main key).
- **GAME OVER**: its own mood, never WIN's. A cool grey veil darkens the board in all three looks, narrow plate, a burnt-out bomb (tipped, charred, smoking, no spark), engraved headline, "Reached level 4 of 5.", the level fallen on as a cracked brick, the shortfall in one plain line comparing saved to saved (score × difficulty shown), one big TRY AGAIN with "New board · level 1" (DAILY / code runs: "Same board"). A run that set a best shows one quiet plaque, not a ribbon. No confetti on a loss.
- **Cards** (NEW VERSION READY, the analytics consent card, the load failure card; approved in round 5): the kit's plate and keys, behaviour unchanged, ALLOW and NO THANKS at equal weight, copy in the new words.
- Every key reads label first, keycap last.

## 5. Custom game parts

Every widget is a game part (owner: "custom UI for all game elements"): tabs are bricks in a wall trough; tooltips are rampart plaques with a pointer; meters fill with bricks; dividers are wall courses; stat tiles are sunk floor tiles; course cells are lit bricks (won: check notch, fallen: cracked); ribbons, a wall shelf, hanging medals; the next-run strip and foe cells are drawn with the board's own painters (`wallart`, `floorart`, `paintBrick`, `featdraw.drawSpec`, `drawEnemyBody`).

## 6. Logo · B · LIT FUSE

FUSE (yellow) over GRID (coral), letters drawn from geometry (no font), one dark outline per word, one continuous bevel, a fixed layout box shared by every world; the slash is the bomb's own braided cord with a burnt end and a two-frame spark (the logo's one moving part, still under reduced motion); a new logo-only bomb (squat, rim-lit, steel collar, the game's cross). In each of the eight worlds only the side colour, the plate and one small motif change (vines, snow, rivets on the side band, drips, studs, grain, a hard purple ring, gilt and a crown on CROWN's I); faces stay yellow and coral. Each art style has its own build: CLASSIC 2D (flat, hard outline, one bevel), PIXEL (fixed 12 and 24 art-px cap heights, palette slots only), REAL 3D (extruded letters under the game's key light, cord as a tube, bomb as a sphere). Every face >= 3:1 against its plate, measured on rendered pixels. Spec: `round7/art/logo-b.md`. The in-game bomb does not change.

## 7. Readability gates (binding for every screen)

Squint (greyscale at half size): chosen vs unchosen >= 3:1, focus band >= 1.5, ring >= 3:1 against the plate. Text floors by cap height: desktop primary >= 14 px, secondary >= 11, HUD values >= 18; phone >= 11 / >= 9. Contrast >= 4.5:1 for information (3:1 locked), including text over the world. Touch targets >= 44 px with >= 8 px gaps. 125 % text without overflow. Yellow fill at most once per screen.

## 8. Decided defaults (confirmed by the owner 2026-11-10)

TRY AGAIN with the board line; PAUSE order as above; drop the loss confetti; logo faces stay yellow and coral in every world, FACTORY rivets and VOID ring and CROWN's crown kept, new bomb is logo-only; system heavy font for the first release; NORTH, shoulders and triggers stay unbindable.

## 9. Out of scope

Gameplay, sim and AI behaviour (two display strings in core change: the POWER pickup's name and the tile-tip copy), board art, the in-game bomb, the 3D camera, desaturating the 3D or PIXEL board, a player TEXT SIZE setting, the storefront images (a later docs step), a downloaded font.
