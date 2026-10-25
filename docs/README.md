# The docs map

> **YOU ARE HERE.** Every Fusegrid doc, the one fact each one owns, and the
> dated design history behind the cabinet.

Fusegrid keeps **one source of truth per fact**. When two docs need the same
fact, one owns it and the other links to it. If you catch a doc repeating
something another doc owns, that's a bug. Replace the copy with a link.

---

## 🧭 Who owns what

| Fact | Owner | Audience |
|---|---|---|
| What the game is, how to play, controls, rooms, Heat, Pact, scoring | [README.md](../README.md) | Players |
| What changed in each release | [CHANGELOG.md](../CHANGELOG.md) | Players |
| The story of how it was built | [diary.md](diary.md) | Players and contributors |
| Setup, URL flags, tests, sending a change, shipping a release | [CONTRIBUTING.md](../CONTRIBUTING.md) | Contributors |
| How the game works, and the trade-offs behind it | [architecture.md](architecture.md) | Contributors |
| The binding rulebook: pinned numbers, test contracts, owner rulings | [AGENTS.md](../AGENTS.md) | Maintainers and coding agents |
| What each work session did, decided or left open | [MEMORY.md](../MEMORY.md) | Maintainers and coding agents |
| Store art and clips, install-dialog screenshots, the itch blurb and the upload zip recipe | [media/README.md](../media/README.md) | Whoever lists the game |
| Pitch copy, platform tags, launch checklist, GitHub About text and topics | [marketing/README.md](marketing/README.md) | Whoever promotes the game |
| How we treat each other | [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Everyone |
| How to report a vulnerability | [SECURITY.md](../SECURITY.md) | Everyone |
| Why a past decision was made | [Design history](#-design-history) below | Anyone digging |
| Pickup and foe names and help text | The game's own `POWER` and foe tables, shown in **GUIDE** in-game | Players |

Two deliberate exceptions keep the front door useful. README keeps a
three-command quick start as a teaser, and CONTRIBUTING owns every setup
detail behind it. README's feature list describes the cabinet *today*, and
CHANGELOG tells how it got there.

The last row matters too: the in-game GUIDE is generated from the same tables the
game plays by, so no doc keeps its own copy of pickup or foe wording.

---

## ✍️ House style for docs

Fusegrid's docs speak in the cabinet's voice: punchy, playful, a little
arcade. Under the voice, every fact stays exact.

- **Facts beat flavour.** Keys, room order, numbers, file paths and test pins
  are copied exactly. A joke never rounds a number.
- **Talk to the reader.** Use "you" for players and contributors, active voice
  and short sentences. Use *they/them* for anyone whose pronouns you don't
  know.
- **Lead with play.** Public copy leads with play-in-the-browser, REAL 3D ⇄
  CLASSIC 2D and Heat. "Deterministic" is a word for contributors, not the
  storefront headline.
- **No rivalry.** Fusegrid ranks you against your own past runs only. Never
  write copy about beating friends, climbing a global board, keeping a streak
  alive or "welcome back". DAILY is honour-system and single-device.
- **Shipped means shipped.** Public docs describe only what's live. Concepts
  and plans that haven't been built stay out of the README and the
  architecture page.
- **The name is Fusegrid.** Never name the classic grid-bomb franchise
  Fusegrid is compared to, in any committed file. A test enforces it.
- **Show it.** Give a command, a key or a table before a paragraph. One shell
  command per code block.

---

## 📚 Design history

`docs/superpowers/` holds every **dated spec** (the *why* and the *what*) and
**plan** (the step-by-step build) since the project began. They're a
decision log, the game's save files. They aren't living docs, so:

- **Never rewrite one.** A later decision gets its own new dated spec. If an
  old one needs a pointer, append a dated *Superseded* note and leave the body
  alone. (Some tests parse these files; see `tests/pwa.test.mjs` and
  `tests/pixel-render.test.mjs`.)
- **The present lives elsewhere.** For how things work *today*, read
  [architecture.md](architecture.md) and [AGENTS.md](../AGENTS.md).

The tables below sort the log by area. ⚠️ marks a record whose headline
decision was later replaced. The note says by what.

### 🎨 Looks and cameras

| Date | Record | Note |
|---|---|---|
| 2026-08-16 | [Dimetric 3D renderer](superpowers/specs/2026-08-16-dimetric-3d-renderer-design.md) | Now the legacy `?render=iso` look |
| 2026-08-23 | [Master plan: stabilize, purge, dimetric](superpowers/plans/2026-08-23-master-plan.md) | |
| 2026-08-23 | [Renderer v2 polish](superpowers/specs/2026-08-23-renderer-v2-design.md) | |
| 2026-08-23 | [Camera control (pan and zoom)](superpowers/specs/2026-08-23-camera-control-design.md) | |
| 2026-08-24 | [REAL 3D renderer (vendored Three.js)](superpowers/specs/2026-08-24-real3d-design.md) | |
| 2026-08-25 | [Camera research](superpowers/specs/2026-08-25-camera-research.md) | ⚠️ Rig replaced by the 2026-10-08 camera design |
| 2026-08-25 | [Elements redesign](superpowers/specs/2026-08-25-elements-redesign.md) | |
| 2026-09-04 | [3D camera, lights, board frame](superpowers/specs/2026-09-04-3d-cam-light-frame-design.md) | ⚠️ Rig replaced by the 2026-10-08 camera design |
| 2026-09-04 | [3D framing and brightness](superpowers/specs/2026-09-04-3d-framing-brightness-design.md) | ⚠️ Rig replaced by the 2026-10-08 camera design |
| 2026-09-04 | [Unique 3D meshes](superpowers/specs/2026-09-04-unique-3d-meshes-design.md) | |
| 2026-10-08 | [REAL 3D camera and phone fit](superpowers/specs/2026-10-08-3d-camera-design.md) | The live rig |
| 2026-10-09 | [PIXEL look: art spike and roadmap](superpowers/plans/2026-10-09-pixel-art-spike-plan.md) | Shipped in shell v178 |

### 👾 The cast: hero, foes and pickups

| Date | Record | Note |
|---|---|---|
| 2026-08-25 | [Rules audit: bomb solidity and power canon](superpowers/specs/2026-08-25-rules-audit.md) | |
| 2026-08-25 | [Enemy identity in 3D](superpowers/specs/2026-08-25-enemy-identity.md) | |
| 2026-09-03 | [Pickup redesign](superpowers/specs/2026-09-03-pickup-redesign-design.md) | |
| 2026-09-04 | [Enemy redesign](superpowers/specs/2026-09-04-enemy-redesign-design.md) | |
| 2026-09-04 | [Enemy character art](superpowers/specs/2026-09-04-enemy-character-art-design.md) | |
| 2026-09-04 | [Enemy 3D bodies](superpowers/specs/2026-09-04-enemy-3d-bodies-design.md) | |
| 2026-09-04 | [Mature enemies](superpowers/specs/2026-09-04-mature-enemies-design.md) · [plan](superpowers/plans/2026-09-04-mature-enemies.md) | |
| 2026-09-04 | [Pickup 3D faces](superpowers/specs/2026-09-04-pickup-3d-design.md) | |
| 2026-09-05 | [Items and player art](superpowers/specs/2026-09-05-items-player-art-design.md) · [program index](superpowers/plans/2026-09-05-items-player-art.md) | |
| 2026-09-05 | [Item glyphs (P1)](superpowers/plans/2026-09-05-item-glyphs.md) · [Item 3D bodies (P2)](superpowers/plans/2026-09-05-item-3d.md) | |
| 2026-09-05 | [Player 2D (P3)](superpowers/plans/2026-09-05-player-2d.md) · [Player 3D (P4)](superpowers/plans/2026-09-05-player-3d.md) | ⚠️ Hero replaced by MAKO (2026-09-06); P4's five-mesh stack still stands |
| 2026-09-05 | [Art acceptance and media recapture (P5)](superpowers/plans/2026-09-05-art-media.md) | |
| 2026-09-06 | [Colourblind (CVD) audit](superpowers/specs/2026-09-06-cvd-audit.md) · [audits plan](superpowers/plans/2026-09-06-audits.md) | |

### 🗺️ Rooms, Heat and difficulty

| Date | Record | Note |
|---|---|---|
| 2026-09-02 | [Extra rooms 6–8](superpowers/specs/2026-09-02-extra-rooms-design.md) | |
| 2026-09-02 | [Extra biome looks](superpowers/specs/2026-09-02-extra-biome-looks-design.md) · [plan](superpowers/plans/2026-09-02-extra-biome-looks.md) | |
| 2026-09-02 | [Heat grades: CORE / PLUS / MAX](superpowers/specs/2026-09-02-heat-design.md) | |
| 2026-09-02 | [Pact](superpowers/specs/2026-09-02-pact-design.md) | |
| 2026-09-02 | [Score × Heat](superpowers/specs/2026-09-02-score-heat-design.md) · [plan](superpowers/plans/2026-09-02-score-heat.md) | |
| 2026-09-03 | [Brick tints, rooms 6–8](superpowers/specs/2026-09-03-brick-tints-6-8-design.md) | |
| 2026-09-03 | [Global pace](superpowers/specs/2026-09-03-pace-design.md) | |
| 2026-09-03 | [Score × Pact](superpowers/specs/2026-09-03-score-pact-design.md) | |
| 2026-09-04 | [HIGH SCORES by Heat](superpowers/plans/2026-09-04-scores-by-heat.md) | |
| 2026-10-20 | [Level variety: random boards, bold biome mazes](superpowers/specs/2026-10-20-level-variety-design.md) | ⚠️ Designed, not built (issue #8); its tile section is replaced by the 2026-10-21 tiles record |
| 2026-10-20 | [Level variety: the 14 bold layouts](superpowers/specs/2026-10-20-level-variety-layouts.md) | The ASCII templates, edit grammar and fair-start pocket for #12 |
| 2026-10-21 | [Difficulty tiles: fun on easy, tough on hard](superpowers/specs/2026-10-21-difficulty-tiles-design.md) | ⚠️ Designed, wave 1 in prototype; art round 3 addendum 2026-10-23, direction D addendum 2026-10-25 (issue #16) |
| 2026-10-21 | [Walls: a living wall family for every world](superpowers/specs/2026-10-21-wall-art-design.md) | ⚠️ Designed and prototyped, not built; art round 3 addendum 2026-10-23, merged into the local build 2026-10-25 (issues #17, #31) |
| 2026-10-25 | [The board look: outline, depth, ambient motion](superpowers/specs/2026-10-25-board-look-depth-ambient-design.md) | ⚠️ Built and playable on a local branch, not in the game (issues #15, #16, #17, #23, #31) |
| 2026-10-25 | [Floor tiles, direction D: hardware and living ground](superpowers/specs/2026-10-25-floor-tiles-direction-d-design.md) · [build plan](superpowers/plans/2026-10-25-floor-tiles-direction-d.md) | ⚠️ Built on a local prototype branch in all three looks, not in the game (issues #16, #23) |

### 🎵 Sound

| Date | Record | Note |
|---|---|---|
| 2026-08-23 | [Music everywhere and the attract bot](superpowers/specs/2026-08-23-music-attract-design.md) | |
| 2026-09-02 | [Extra biome music](superpowers/specs/2026-09-02-extra-biome-music-design.md) | |
| 2026-09-02 | [Extra biome boom SFX](superpowers/specs/2026-09-02-extra-biome-boom-design.md) | |
| 2026-09-03 | [Streamed stereo music](superpowers/specs/2026-09-03-streamed-stereo-music-design.md) | |
| 2026-09-05 | [Soundtrack v3](superpowers/specs/2026-09-05-soundtrack-design.md) · [program index](superpowers/plans/2026-09-05-soundtrack.md) | The approved baseline |
| 2026-09-05 | [Engine seam](superpowers/plans/2026-09-05-soundtrack-seam.md) · [wave 1](superpowers/plans/2026-09-05-soundtrack-wave1.md) · [wave 2](superpowers/plans/2026-09-05-soundtrack-wave2.md) | |

### 🕹️ Cabinet shell, menus and touch

| Date | Record | Note |
|---|---|---|
| 2026-08-23 | [Cinematic intro and menus](superpowers/specs/2026-08-23-menu-intro-design.md) · [plan](superpowers/plans/2026-08-23-menu-intro.md) | ⚠️ Opening replaced by the 2026-10-09 opening design |
| 2026-08-23 | [Touch controls](superpowers/specs/2026-08-23-touch-controls-design.md) | |
| 2026-09-02 | [Human-like attract demobot](superpowers/specs/2026-09-02-demobot-human-design.md) | |
| 2026-09-04 | [Cabinet rest](superpowers/specs/2026-09-04-cabinet-rest-design.md) · [plan](superpowers/plans/2026-09-04-cabinet-rest.md) | |
| 2026-09-05 | [Settings and menus](superpowers/specs/2026-09-05-settings-menu-design.md) · [program index](superpowers/plans/2026-09-05-settings-menu.md) | |
| 2026-09-05 | [Settings store (S1)](superpowers/plans/2026-09-05-settings-store.md) · [OPTIONS (S2)](superpowers/plans/2026-09-05-options-screen.md) · [Pause and chrome (S3)](superpowers/plans/2026-09-05-pause-chrome.md) | |
| 2026-09-05 | [GUIDE and HUD](superpowers/specs/2026-09-05-guide-hud-design.md) · [plan](superpowers/plans/2026-09-05-guide-hud.md) | |
| 2026-10-09 | [Opening: title, show, menu](superpowers/specs/2026-10-09-opening-design.md) | The live opening |

### 🏆 The arcade loop and coming back for more

| Date | Record | Note |
|---|---|---|
| 2026-09-04 | [Arcade loop](superpowers/specs/2026-09-04-arcade-loop-design.md) · [plan index](superpowers/plans/2026-09-04-arcade-loop.md) | |
| 2026-09-04 | [Attract starts a run](superpowers/plans/2026-09-04-attract-starts-run.md) · [Honest end screen](superpowers/plans/2026-09-04-end-screen.md) · [Ghost coach](superpowers/plans/2026-09-04-ghost-coach.md) | |
| 2026-09-04 | [First-visit Play Now](superpowers/plans/2026-09-04-first-visit-play.md) | ⚠️ Reversed 2026-10-09: first visits land on MENU |
| 2026-09-04 | [Local plaques](superpowers/plans/2026-09-04-local-plaques.md) · [Listing pack](superpowers/plans/2026-09-04-listing-pack.md) | |
| 2026-09-06 | [Gamification and retention report](superpowers/specs/2026-09-06-retention-report.md) | |
| 2026-09-06 | [Retention wave 1](superpowers/specs/2026-09-06-retention-wave1-design.md) · [program index](superpowers/plans/2026-09-06-retention-wave1.md) | |
| 2026-09-06 | [Combo callouts](superpowers/plans/2026-09-06-combo-callouts.md) · [First-play verify](superpowers/plans/2026-09-06-first-play-verify.md) · [Stopwatch and MODES](superpowers/plans/2026-09-06-stopwatch-modes.md) | |
| 2026-09-07 | [Retention wave 2](superpowers/specs/2026-09-07-retention-wave2-design.md) · [program index](superpowers/plans/2026-09-07-retention-wave2.md) | |
| 2026-09-07 | [Run summary](superpowers/plans/2026-09-07-run-summary.md) · [STATS](superpowers/plans/2026-09-07-stats-screen.md) · [DAILY](superpowers/plans/2026-09-07-daily-seed.md) · [Challenge code](superpowers/plans/2026-09-07-challenge-code.md) · [Coach v2](superpowers/plans/2026-09-07-coach-v2.md) || ⚠️ Its rule that a seedless run replays the session's `bootSeed` is set to be replaced by a random board every run (#10) |
| 2026-10-08 | [Retention wave 3](superpowers/specs/2026-10-08-retention-wave3-design.md) | Medals, ghost, DAYS PLAYED, reset |

### 🌐 Platform

| Date | Record | Note |
|---|---|---|
| 2026-08-23 | [Lockstep netcode](superpowers/specs/2026-08-23-netcode-lockstep-design.md) | A local harness only; Fusegrid is single-player |
| 2026-09-03 | [PWA offline cabinet](superpowers/specs/2026-09-03-pwa-offline-design.md) | |

---

**CONTINUE?** Back to the [README](../README.md), or straight to
[how it works](architecture.md).
