# AGENTS.md

## Project

Fusegrid ("rollblock") — a modular, deterministic arcade game.
Public GitHub is https://github.com/HMarzban/fusegrid. In-game wordmark is
FUSE/GRID; the local folder stays `rollblock`.
Pure ES modules. **Zero `package.json` runtime dependencies.** The sim is
framework-free so it runs identically under Node (tests) and the browser.

The product path is **REAL 3D ⇄ CLASSIC 2D**. Three.js r160 is **vendored**
(`vendor/three.module.js`, MIT, relative import — not an npm dep). The 2026-08-16
"no Three" lock applies to the **sim** only; the render layer reversed it.

This is a **single-player** game. Lockstep is a local two-world **harness**, not
internet play. Do not swap `WebSocketTransport` in and call it multiplayer —
`step()` only consumes `inputs[0]` / `players[0]`.

## Architecture

Single thread, three stages: `input → sim → render`.

Two state machines:

| Layer | States | Owner |
|---|---|---|
| Shell | INTRO → MENU ⇄ LEVEL/SCORES/SETTINGS/GUIDE(→HOWTO/ITEMS/ENEMIES) → GAME; idle → ATTRACT | `src/app/menuapp.js` |

Heat grades CORE / PLUS / MAX live on LEVEL SELECT (`←/→` room, `↑/↓` heat). CORE is replay baseline v6. Attract is always CORE + pact=0. After a first FUSE/GRID CLEAR, LEVEL SELECT also offers Pact toggles (`1–4`). Knobs live on `world`, not frozen `CFG`. Score × heat is persist-only (CORE ×1 / PLUS ×2 / MAX ×3); live HUD stays raw.

MENU is eight rows in this order: `PLAY, LEVEL SELECT, DAILY, OPTIONS, GUIDE,
HIGH SCORES, STATS, SOURCE`. `confirm()` dispatches by **label**, so an insert
moves no runtime index — but `tests/headless.test.mjs`'s index-driven MENU
confirms and `tests/menuapp.test.mjs`'s literals must be renegotiated with any
reorder. `SCREEN.STATS = 12` is **appended** (`menuapp.js:27`'s own rule:
appended, never inserted). WIN/LOSE run summaries are **not** a SCREEN — they
live in `drawOverlay`.
| Sim | PLAY / WIN / LOSE / PAUSE | `src/core/sim.js` |

The sim ticks only while the shell is GAME. PAUSE/WIN/LOSE are `world.state`,
not shell screens. Do not add them as `SCREEN` values.

- `src/main.js` — **browser entry only**. RAF loop, fixed-step accumulator,
  renderer cache + kind switch, and the handler wiring that binds them. Never
  imported by sim or renderer. Its seams live beside it and must stay OUT of
  `main.js`: `src/app/flags.js` (URL/opts, pure over a search string),
  `src/app/attract.js` (demo world + `stepDemo`), `src/app/debughook.js`
  (`window.__GAME__`), `src/net/localpair.js` (`?net=local`),
  `src/render/shellview.js` (`drawShell` + the `kindSize`/`dims` logical box).
- `src/core/` — deterministic simulation, no DOM, no browser globals.
  - `world.js` — `createWorld`, `loadLevel` (re-exported from `sim.js`).
  - `sim.js` — `step(world, dt, intents)`.
  - `config.js` — frozen `CFG`, `T`, `BIOMES` (array frozen; **entries are not**).
    Eight looks: JUNGLE, ICE, FACTORY, WATER, ARENA, then SAND, VOID, CROWN
    (rooms 6–8 after first CLEAR). One chiptune theme per look.
    Room policy: `ROOM_LOCK=5`, `ROOM_MAX=8`, `isFinale`, `roomCap`
    (L5 and L8 finale; L6/L7 advance). Overlay must use the same `isFinale`
    predicate.
  - `heat.js` / `pact.js` — heat tables + bitmask/`applyPact`. Persist is
    `src/app/pactstore.js`, not `src/core`.
  - `board.js`, `entities.js`, `rng.js` — sim support.
- `src/render/` — reads world; drains `world.events` into fx/audio.
  - kind `"2d"` — classic Canvas (`createRenderer`). Do not statically import
    `vendor/three.module.js` on this path; lazy-load via `src/render/three/load.js`.
  - kind `"3d"` — `createRenderer3D` (`#gl` WebGL under `#c` overlay).
  - kind `"iso"` — legacy dimetric (`r3d/`), pinned by `?render=iso` only.
    `createRenderer({kind:"3d"|"iso"})` is the **dimetric** branch. Real 3D
    never enters that factory. Menu RENDER flips 3D ⇄ 2D only.
  - Live 3D default rig (polar `el` from +Y): `{az:0, el:0.54, dist:870,
    target:[0,-48,0]}` — 59.1° above horizon, a readable 3/4. X binds the fit
    at EVERY elevation (always the near ICE wall-top corner), so vertical fill
    DECREASES as the camera lowers — a higher camera fills more frame AND
    hides less. All `el` buys is the 3/4 read, `side:top = tan(el)`:
    `el:0.419` scored 0.445 and was a ceiling security-cam, 0.54 scores
    0.599. The fit basis is the PLAYFIELD (`|x|<=300`, `|z|<=260`,
    `y<=hWall`), NOT the decorative bezel, which may bleed ~2.4% past the two
    bottom corners the way a cabinet well runs off screen. Must frame the whole
    15×13 board (all four corners + ICE tall walls); worst case ICE sits at
    `|ndc| 0.9449` and the board fills 50.9% of the canvas. Any text saying
    `el:0.62` / `dist:960` / `target:[0,-44,0]` / `|ndc| 0.913` /
    `el:0.419` / `dist:1000` / `el:1.152` / `dist:700` / `dist:800` is
    stale.
    Hazard: the cabinet bezel gate sits at `|ndc| 1.0974` against the `<=1.10`
    ceiling, with `CAM_PRESET` STANDARD (`dist:870`) landing exactly there —
    any camera/rig/`RIM_W` change must re-run `tests/three.test.mjs` §4b first.
    Never assign `#gl.width`/`#gl.height` from `sizeCanvases` — wrapper owns
    the Retina drawing buffer (`setPixelRatio` + `setSize`). Stomping it
    crops WebGL to the bottom-left quarter on dpr=2.
  - The board border is ONE extruded cabinet rim (`tag:"trim"`, `RIM_W 36` /
    `RIM_LIP 6`) with a hole — never four rails, which crossed at the corners.
  - Enemy bodies: one `ENEMY_3D[type]` row per foe, each exactly FOUR meshes
    (hull + two ref-swapped details + `eye_<type>` face plane), so
    `SLOT_MESH.enemy` stays 4 and fat-world stays 141. Parts are
    pre-transformed and fused by `mergeGeos` (variadic, and it synthesises an
    index because `ExtrudeGeometry` emits none) — never added as children.
    `lathe(pts,seg,r)` profiles run bottom -> top or normals invert; a radius
    that flares then narrows is a brow / warning band, which is how a
    one-material hull gets a two-tone read. Detail channel order is PER TYPE,
    not global (`stationary` keeps its magenta Basic core on `children[0]`
    because two tests pin it there; `walker` splits into mirrored halves so
    the alternating stomp keeps two transforms). `shade` is the only foe with
    `castShadow=false`; additive accents never cast.
  - Player body — **MAKO, the reef critter (2026-09-06, spec §2.7)**. Every
    humanoid hero was vetoed by the user ("the main character also must not be
    like a human, it must be a creative character"), so SIGNAL RUNNER and
    IONVEST are superseded and **2D and 3D share ONE character again, by
    design**: `PLAYER_HULL` and `PLAYER_SUIT` are the same hex `#c39cff`, both
    exported from `sprites.js`. Do not re-split them without a measured reason
    — the IONVEST split existed only because gunmetal died on FACTORY's wall
    in 2D and was still correct in 3D.
    Head and body are ONE mass: no shoulders, no torso-over-legs, no arms.
    That single rule is what all three previous heroes broke. The hook is two
    swept teal ear-fins whose tips run PAST the body's own half-width, so the
    outline is a CHEVRON — the one shape class no foe has, since every foe is
    a dome or a box. The face is two bulging cream `#f2e6d2` eyes that BREAK
    the crown of the silhouette, over a grin with two BLUNT teeth. Never
    fangs: hero, not monster. `p.color` lives on the fins and nowhere else, in
    both renderers.
    3D is still a FIVE-mesh stack — `SLOT_MESH.player` 5, fat-world 141 — with
    the SAME five geometry types, roles reassigned rather than added to:
    **Lathe = squat body** (`children[0]`, matte Lambert, the `p.passing`
    lerp target), **Buffer = merged ear-fin pair** (the one `p.color` mesh),
    **Extrude = face plate** (the one Phong, raked `-0.6` to face the rig,
    its own OUTLINE carrying the two eye lobes), **2 Box = feet**
    (`children[3]` still flips on `p.kick`). `ExtrudeGeometry`'s UV generator
    writes world x/y into `uv`, so the face plate is passed through `fitUV`
    or the atlas texture clamps to one smeared edge pixel. No sphere, no
    capsule, no cylinder, no antenna. Hold the plan footprint at
    `x/z >= 1.40` (fins 40.4 across, 27.1 deep = 1.49) and the half-span at
    or past the player's own `TILE*0.34` collision radius — at `el:0.54` the
    plan outline is the primary cue and a lathe alone is a circle from up
    there. Separation from foes is that structure, **never a re-hue**.
    The 2D colour gate is per-biome over SEVEN swatches (`wallHi` is opaque
    over 40% of a wall tile, and the brick highlight is the real
    `brickHi`-at-alpha-0.55-over-`brickA` composite): no swatch may collapse
    on value AND hue at once, the body must stay chromatic, and every VOID
    swatch must clear a Lab ΔE floor, because VOID is the one room where hero
    and scenery share a hue by construction and the hue axis says nothing.
    Disclosed, not gated: `stationary`'s `#c58aff` is un-clearable by ANY
    chromatic hex in MAKO's family — the whole violet band was swept.
  - `shellview.js` routes `app.screen` to `menudraw.js` and owns `kindSize` /
    `dims`, the one logical box every screen measures against (a real canvas
    wins, otherwise kind picks the classic box or the projected one). It is
    the only render module that may read `src/app/` — screen constants only,
    and scores arrive as a getter so `highscores` stays on the app side.
- `src/app/` — menu shell, intro beats, demobot, highscores, `pactstore.js`,
  plus the entry seams above (`flags` / `attract` / `debughook`).
  Not read by `step()`.
  Retention stores (wave 2, 2026-09-07), one key per module, all `Date`-free
  and DOM-free: `bests.js` (`nb.bests.v1`, per-run score/room bests keyed
  `<heat>:<pact>:<pace+1>`, cap 48) · `stats.js` (`nb.stats.v1`, lifetime
  aggregates always, a 200-entry event ring only after the player opens STATS
  once) · `daily.js` (`nb.daily.v1`, one board a day from a **date string**,
  pure FNV-1a `dailySeed`) · `code.js` (no store; a 12-char `F1` challenge code
  with a checksum). Every date is a string computed in `main.js` (`todayStr`
  local, `dateStr` UTC) and passed in — `src/app/` never calls `Date`.
  `nb.times.v1` stays the one best-TIMES store; STATS **reads** both and
  copies neither.
  Demobot is an intent FSM (plant-and-leave, hunger for combat cubes / corridor
  foes); attract still CORE/pact=0. Highscores use `scoreEntry`; `noteWorldEdge`
  is a boolean edge, not a score writer.
- `src/ai/enemies.js` — enemy AI on sim state.
- `src/net/` — `protocol.js`, `lockstep.js`, `transport.js`.
  Default play uses **no** transport. `?net=local` is a 1P pair proof.
  `applySnapshot` was removed (lockstep-only). `makeSnapshot` remains for harness dumps.
- `src/input.js`, `src/touch.js`, `src/audio.js` — input + chiptune.
  Track tables live in `src/audio/tracks.js`. Boom tints live in
  `src/audio/boom.js` (`boomOf`). Pickup grab tints live in
  `src/audio/item.js` (`itemOf` / `sfxOf`); `play("item_"+kind)` from power
  events that carry `kind`. Catalog stays 12; `applyPower` semantics unchanged.
  Pickup glyphs live in `drawIcon`; HOW TO / HUD chips / 2D bombs reuse them.
  3D pickups use one shared geo per kind plus one `InstancedMesh` body
  and ring per POWER.t (`SLOT_MESH.item === 2`); `paintItemFace` stays
  for atlas tests. N FLAME cubes are one draw.
  Foe kill tints live in `src/audio/foe.js` (`foeOf`); `sfxOf` maps
  `kill`+`type` to `foe_<t>`. ENEMIES / arena 2D use `drawEnemyBody`
  (visor grunt / bunker / drone / hunter helm / wraith / missile, plus
  BURROW / SHADE / KNIGHT on rooms 6–8). Hunt is `e.hunt` at spawn; do not
  retune wander / still / chase / phase algorithms.
  `musicCue` uses `biomeOf(level).name`.
  Oscillator SFX stay direct-to-destination (layered voice + noise + filter,
  never musicGain). Music is a track table: `AABB` per track, all nine B
  sections hand-authored (no identity B), one theme per biome. `setTrack` +
  `musicCue(screen,level)` from the shell; GAME/ATTRACT follow the room,
  everything else plays menu. `reveal` is a cue.
- `src/pwa/` — Node-testable app-shell list + SW register. `src/main.js`
  registers `./sw.js` (module, scope `./`). Precache lives in `shell.js`
  (`fusegrid-shell-vN`). Must include `vendor/three.module.js`. Never cache
  `og.png`. Never imported by `src/core`. Bump `CACHE_NAME` and the REV
  token in `sw.js` together when the file list or shipped bytes change.
  Returning clients call `registration.update()` and reload once on
  `controllerchange` (skipWaiting + claim already in `sw.js`).

## Commands

- `npm test` / `node --test` — run tests (`tests/*.test.mjs`).
- `npm start` / `node serve.js` — loopback only: `http://127.0.0.1:8080/index.html`.
- Public play is **GitHub Pages** (`https://hmarzban.github.io/fusegrid/`).
  Static files only (`.nojekyll`, relative asset hrefs). Do not rebind `serve.js`.
  Social/SEO: keep `og.png` (1200×630), `robots.txt`, and `sitemap.xml` in the
  Pages stage set. `og:image` must stay an absolute Pages URL. GitHub About
  description + topics are live SEO (not in git): lead with play-in-browser +
  REAL 3D ⇄ CLASSIC 2D + Heat, not "deterministic". Keep topics filled. Repo
  Settings → Social preview has no API — upload `og.png` there when the card
  changes.
  PWA: also stage `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`.
  `serve.js` MIME includes `.webmanifest`.

Flags: `?render=3d|iso`, `?play=1`, `?net=local`, `?orbit=1`, `?debug=1`.

Node v26, `"type": "module"`. No build step, no bundler.

## Conventions

- **Determinism**: `step()` is pure w.r.t. world + intent. No time/DOM/`Math.random`
  in the sim — use `src/core/rng.js`. Replay/outcome validity: **baseline v6**
  (interior WALL pillars, floor pickups, staged roster, L5 finale; DIRS4
  wander) begins after the 2026-09-02 gameplay pass. v5 was DIRS4-only.
- **No DOM in `src/core`**. Render factories may touch DOM (atlas, WebGL, HUD).
  Node-testable three **math** stays DOM-free.
- Frozen `CFG` — mutate world, not config. `BIOMES` elements are shallow.
- Keep zero **npm** deps. Vendored render libs are OK.
- 3D draw-call budget is `<=500` (fat-world currently 141). Child-index
  contracts in `three.test.mjs` are ABI — do not "flex" them in a drive-by.
- No comments unless the file already uses explanatory block comments (its style).
  Match the compact, no-whitespace-after-key style already in the codebase.
- **A delta that cannot lie.** Anything the run summary claims (`NEW BEST`,
  `FURTHEST ROOM YET`, `MATCHED…`, `+N FROM…`) is computed from a **persisted**
  number or it is not shown, and only at a run end — `isRunEnd(world)` is the
  one predicate for both display and persist, and it reuses the same
  `isFinale` the overlay already uses. `bestRun` is a **run-start snapshot**,
  read once per run, never re-read mid-run. A run that began above room 1
  writes no room record and prints no FURTHEST form. A first-ever run on a
  bucket that scores exactly 0 prints **no delta line at all** (Ruling
  2026-09-07, Nit-6) — a zero-point run set no record worth naming.
- **The daily is honour-system and single-device.** No enforcement, no
  consecutive-day read, no streak/at-risk/welcome-back copy, never framed as
  competing with anyone — the only claim is *your own attempts are comparable
  to each other*. Its config is pinned `{level:1, heat:0, pact:0, pace:0}`
  **and stamped**: a record whose stamped pace differs from this run's is
  treated as absent, never silently compared. A run that supplies no seed
  plays the session's remembered `bootSeed`, so an ordinary run is
  indistinguishable before and after a daily.
- **The challenge code carries a board, never a claim.** `?code=` is 12 chars
  (`F1` + seed + cfg + checksum), seed/heat/pact/pace only — **no score
  field**, and no `window.prompt` / DOM paste box (entry is through
  `flags.js` alone). The word `leaderboard` is refused in `src/` and `tests/`
  and executably gated by `tests/banned-name.test.mjs`; `docs/` is exempt
  because the spec names the term to refuse it.
- Coach v2 (`nb.coach.v2`) shows **one first-use tip per verb**, once ever,
  for KICK / THROW / REMOTE, on a **PLAY-only** clock that PAUSE cannot burn.
  Its copy is composed from `POWER[].help` — never write a second source for
  those three strings. v1's ghost coach wins ties; a new trigger replaces a
  live tip (dismissed `rn:"replace"` first, so shown/dismissed pair exactly
  once — except an abandoned run mid-tip, which leaves that tip's
  `coach_shown` unpaired by design). The latch resets at **every** run-start
  path.

## Testing

Tests live in `tests/*.test.mjs` and run under `node --test`. Keep the sim
importable without a DOM. `tests/browser_integration.html` is manual. Visual 3D feel is
not covered by Node — play-verify in a browser after render changes.

## Memory

- **Durable memory** lives here (`AGENTS.md`): conventions, architecture, "how
  we do things". Edit when a decision changes.
- **Episodic memory** lives in `MEMORY.md`: a dated, append-only log of what each
  session did/decided/left open. Both are auto-loaded via `opencode.json`
  `instructions`.
- **Standing rule:** after any non-trivial change, append a dated entry to
  `MEMORY.md` (newest first) so the next session/agent inherits context. Keep it
  to 1–2 lines: what changed, why, or what's left open.

## Learned User Preferences
- Public name and wordmark are Fusegrid / FUSE/GRID; keep the local checkout as `rollblock`. Never write the name of the private reference game (the well-known grid-bomb franchise this project is measured against) into any committed file (specs, comments, commit messages, docs, alt text, tags) — it is a private quality reference only; `docs/` is public.
- This repository is the arcade game only — do not add unrelated demos.
- Keep a visible path to the public repo: menu SOURCE opens https://github.com/HMarzban/fusegrid.
- Keep ITEMS, ENEMIES, and HOW TO as in-menu help so pickups and foes are explained in the shell, not only as HUD chips.
- Difficulty is Heat on LEVEL SELECT (CORE / PLUS / MAX). Global **pace** (EASY / NORM / HARD) is a separate LEVEL SELECT control (`[`/`]`), persisted in `nb.pace.v1`, scaling player/enemy move speed on `world.pace` — not frozen `CFG`. Pact (`1–4`) and rooms 6–8 unlock after the first FUSE/GRID CLEAR. Score × heat is persist-only; HIGH SCORES fifth column tags pact bitmask (`p`). Music uses WebAudio stereo panning on the oscillator engine (zero npm deps). Mid-run heat, always-on Sudden Death, and internet play stay parked.
- Foes must read as arcade characters (distinct silhouette, face or lens, shading, facing) in CLASSIC 2D and REAL 3D, not flat colored tokens. `enemybody.js` is the 2D five-beat build; 3D matches via merged hulls in the four-mesh slot. Art only — do not retune AI.
- Do not commit `.cursor/` or `e2e-artifacts/` (both gitignored).

## Learned Workspace Facts
- Surviving a hit leaves live bombs and blades in the world.
- Share the play URL with a trailing slash (`https://hmarzban.github.io/fusegrid/`); the no-slash GitHub Pages 301 has no Open Graph tags, so link previews fail. Share card is root `og.png` (1200×630); `og:image` stays the absolute Pages URL. The hero is a REAL screenshot of the live 3D board (JUNGLE, transparent clear via `scene.background=null`, blast mid-detonation) — never generated key art, which drifts from the game. Card sells REAL 3D ⇄ CLASSIC 2D plus CORE / PLUS / MAX; the PLAY IN THE BROWSER pill spans that chip row (left = CORE left, right = MAX right) and type keeps a 10% inset. Never the reference game's name on the image or tags. Public About/meta copy leads with play-in-browser + REAL 3D ⇄ CLASSIC 2D + Heat; "deterministic" stays a contributor word, not the storefront lead.
- A just-planted bomb is not solid while the bomber still occupies that tile; after leaving, re-entry is blocked (plant-and-leave / R16).
- FLAME is blast length in tiles (starts at 1, caps at 8, persists across death and rooms); BOMB is how many bombs can be live at once.
- Gold WALL never breaks; green BRICK breaks and stops a normal blast.
- Rooms 6–8 use SAND / VOID / CROWN palettes, chiptune cues (`sand` / `void` / `crown`), and boom tints (kick 69 / 40 / 82). Those rooms append exclusive BURROW / SHADE / KNIGHT (`ROOM_EXTRA`); do not replace CORE L1–5 spawn lists. Rooms 1–5 stay JUNGLE–ARENA. Ice/water/arena boom numbers stay. Menu/intro use the default boom.
- Soundtrack Direction v3 (`docs/superpowers/specs/2026-09-05-soundtrack-design.md`), user-approved baseline 2026-09-06: every track sits at its own tempo in the ~96–120 BPM band; leads are `triangle`/`sine`; `sawtooth` is not a music-layer timbre; `square` survives only as a factory hat colour at `v <= 0.035`; per-channel `v` ceilings plus a channel-peak sum `<= 0.20`; no shared motif across tracks; all nine B sections are hand-authored (no identity B); all 19 patterns are pairwise distinct in bass groove and lead contour. Pinned in `tests/music.test.mjs`.
- Live 3D uses one frozen rig `{az:0, el:0.54, dist:870, target:[0,-48,0]}` (59.1° 3/4) and one frozen light recipe — warm key `#fff4e2` 1.26 with the only shadow, cool fill `#bcd4ff` 0.54 opposite-and-behind (never casts), hemi 0.72, ambient 0.30. Key:fill 2.3333:1; `PCFSoftShadowMap` ignores `shadow.radius`, so softness is the ratio, not blur. The renderer runs `NoToneMapping` and the scene carries NO fog: ACES at exposure 1 mapped linear 0.02→0.007, capped white at 0.763 and zeroed JUNGLE `floor0`'s red channel, while `Fog(bg1,700,1600)` replaced 43% of the far board corners with `bg1` (89% at the `DIST_MAX` dolly clamp). CLASSIC 2D blits the authored hex, so REAL 3D must not regrade the same palette. Do not add a per-biome camera or light table. VOID staying dark is the look, not a bug — its darkness is albedo, not rig, so one global recipe preserves it. Stale: `el:0.62` / `dist:960` / `target y -44`, key 1.05 / fill 0.45 / hemi 0.55 / ambient 0.18, ACES tone mapping, and any `scene.fog`.
- The 3D board sits in a cabinet well: ONE `ExtrudeGeometry` rim with a hole, tinted `wall`→`bg1` so it recedes. Four rails crossed at the corners and stuck out — never go back. Border is 1 draw call, so fat-world is 141.
- At `el:0.54` the camera sits 59.1° above the horizon — past 45°, so it reads more TOP than side. The PLAN-VIEW FOOTPRINT is an enemy's primary cue, and nine distinguishable footprints beat nine distinguishable profiles: three scaled spheres were three circles from up there. Detail below the waist buys grounding and shadow shape, not visibility, and a face plane has to face the RIG (rake it up) rather than the direction of travel.
- A stale service worker serves pre-change bytes and looks exactly like a render change that did not land. Unregister the SW and delete its caches before trusting any headed 3D screenshot.
- CROWN's collision is its `brickA` `#ffd447`, which is `fast`'s identity colour exactly. The three golds separate on value and shape, never hue: `knight` is the only bright-specular Phong **foe** plus an unlit pale nasal bar — the player face plate is the cast's one other Phong surface, `fast` carries dark fins over a straight-edged delta, `burrow` is a duller value with an additive plume. Do not restyle the biome to fix this.
- PWA is a versioned app-shell precache (`fusegrid-shell-vN`). Offline after the first visit; first visit still needs network. Relative `./` scope covers Pages `/fusegrid/` and loopback. New `CACHE_NAME`/REV: `register.update` + one-shot `controllerchange` reload. iOS install is Add to Home Screen; module SW wants 16.4+.
- A hidden browser tab pauses `requestAnimationFrame`, so a headed check on an
  unfocused pane freezes the game loop and every screenshot is stale. Drive the
  loop through a `MessageChannel`-backed rAF shim, and assert on
  `window.__GAME__` + a `fillText` recorder rather than on pixels.
