# MEMORY.md

Episodic log — dated, append-only notes of what a session/agent did, decided,
or left for the next person. Newest first. One or two lines per entry.

This file is auto-loaded by opencode (see `instructions` in `opencode.json`)
and is a standing instruction target: `AGENTS.md` requires every session to
append an entry when it makes a non-trivial change.

## Format

```
## YYYY-MM-DD — <one-line subject>
- what changed / decided, and why (or: what was left open for later).
```

## Log

## 2026-09-06 — Closing fix wave: tree-wide banned-name gate, AGENTS v3 audio bullet, spec/README sync
- New `tests/banned-name.test.mjs` walks `git ls-files` (skipping binaries/NUL-sniffed files) and asserts no tracked file contains the private reference game's name, built by concatenation and never as a literal. RED on the current tree, naming `AGENTS.md` — its own rule text spelled the name out; GREEN once both `AGENTS.md` bullets were reworded to talk about "the private reference game" instead. No other survivors in the tracked tree.
- `AGENTS.md`: fixed the stale "menu AABB (identity)" audio line (all nine B sections are hand-authored now, no identity B), renamed "the player visor" to "the player face plate" (already renamed elsewhere in the file), and added a Learned Workspace Facts bullet summarizing Soundtrack Direction v3 (tempo band, timbre rules, headroom, no shared motif, all-nine-hand-authored) with a pointer to `docs/superpowers/specs/2026-09-05-soundtrack-design.md`.
- Soundtrack spec §2/§5 re-synced against the shipped `src/audio/tracks.js`: jungle's B tresillo is the limping `0/2/3/5` step set (`2+3+3` even bars, `3+2+3` odd), occupancy 60 (A) / 56 (B), not "0/2/5, 60 alike"; ice/factory/water/sand are hand-authored Bs, not `transp`; dropped `transp` from "what survives"; added that occupancy bands are per-A-section only — `factory.B` 52 / `water.B` 48 / `arena.B` 56 / `crown.B` 34 all sit outside their own A band by design.
- `media/README.md` og.png provenance: disclosed that the card's background outside the text glyphs is a calibrated radial-gradient approximation of the previous card (within ~9 RGB units at the corner), not a per-pixel restore like the glyphs and board/hero renders.
- `docs/superpowers/specs/2026-09-05-items-player-art-design.md` §2.5: marked the hull-taper and leg-length gate rows retired by §2.7 (MAKO has no shoulder line and no legs to measure), matching the luminance row's existing annotation.
- Full `npm test`: 32/32 files green, 0 fail.

## 2026-09-06 — MAKO: the hero is a reef critter now, in BOTH renderers
- User vetoed every humanoid ("the main character also must not be like a human, it must be a creative character"). An art-direction round drew three non-human concepts with the repo's own helpers on all 8 floors beside a real WALKER and recommended **C · MAKO**; controller ruled build it with two tweaks — **playful grin instead of the concept's two pointed fangs**, and a **lighter body value** so it pops on VOID. SIGNAL RUNNER (3D) and IONVEST (2D) are superseded; **the IONVEST 2D/3D palette split is retired** and `PLAYER_HULL === PLAYER_SUIT === #c39cff`.
- **The colour finding that matters.** The concept base `#9a4ff0` (L .418) collides with VOID — but only against a swatch nobody had listed: `bakeAtlas` paints `brickHi` at `globalAlpha 0.55` OVER `brickA`, so the highlight a player stands beside is the **composite `#a266e6` (L .486)**, which is literally "#9a4ff0 lifted in value". `wallHi` is opaque too. The shipped 5-swatch list saw neither, so the gate now runs **7 per biome (56 total)**. Clearing both in-family needs L ≥ .606; `#c39cff` (L .672, chroma .388, hue 263.6 — 4.3° off the base) also maximises Lab ΔE to VOID's brick face (**55.0**).
- **Disclosed, deliberately NOT gated:** `stationary` carries `#c58aff`, a light violet, and **no hex in MAKO's family clears that foe on value AND hue while staying chromatic** — swept the whole violet band; the window is L ≤ .359 (invisible on VOID) or L ≥ .752 (pastel). Foe separation is AGENTS.md's standing rule — structure, never a re-hue. The AND gate is a **backdrop** gate; that is the failure the user actually reported.
- **Gates deleted, not weakened** (they encode the rejected anatomy): taper, leg-length stance, neck pinch, head ratio. Parts are now found by **fill**, never by op index, because MAKO draws feet and fins before the body. Fit box `±1.05r → ±1.34r` (the fins ARE the concept) with the real constraint asserted directly — the hero must stay inside its own 40px tile.
- **3D: same 5 meshes, same 5 geometry types, roles reassigned** — Lathe = squat body (`children[0]`), Buffer = merged fin pair (the one `p.color`), Extrude = face plate (the one Phong), 2 Box = feet. `SLOT_MESH.player` 5 and fat-world 141 unchanged. Moved pins: face-plate height floor `TILE*0.5 → TILE*0.34` (authored for a helmet visor; MAKO's crown is at 23.0), atlas key `visor → face` at `128×32 → 128×128`, `p.color` locator Lathe → Buffer.
- **Trap worth remembering:** `ExtrudeGeometry`'s `WorldUVGenerator` writes world x/y straight into `uv`, so any texture on an extruded plate clamps to one smeared edge pixel. New `fitUV()` in `three/entities.js` renormalises the caps. The old visor had this bug all along; it just never showed on a 4×2-unit slit.
- Live captures, both renderers, 3 rooms each (2D iterated twice: fins were earmuffs, then a 4.8px sliver, then blades; 3D iterated once: face was sitting under a bare dome and the fins were foreshortened). Squint: JUNGLE/FACTORY/VOID all PASS in 2D and 3D. Measured 3D footprint **40.4 × 27.1 = 1.49:1**. PWA v90→v93. Report: `.superpowers/sdd/2026-09-06-taste-revision/task-mako-report.md`.
- **State overlays (shield/kick/passing) were still humanoid geometry, and no gate could see it** — every fit/shape test poses the hero with all three false, so the rings/pads survived the character swap unmeasured. 2D rings re-fit to the fins' aspect and 3D shield now drives `emissive` instead of multiplying the painted face (PWA v93). A fix round the same day found `passing`'s re-fit ellipse (`r*1.5 x r*1.16`) still grazing the fin's own `[0.96,-0.84]` vertex by 0.36 unit once the 2px stroke is counted — re-fit to `r*1.58 x r*1.22` and pinned directly against every fin vertex for both rings (`tests/items-art.test.mjs`). PWA v99→v100. **The binding vertex is the swept SHOULDER `[0.96,-0.84]`, not the tip `[1.3,-0.46]`** — the tip reaches further out but points where the ellipse is widest (it cleared by 0.97 where the shoulder cleared by 0.64), so a ring fitted by eye to the outermost vertex is fitted to the wrong one. Both texts said the tip until 2026-09-06.

## 2026-09-06 — IONVEST: the 2D hero re-hued and re-proportioned; 2D/3D palettes split
- User rejected R1's 2D body ("in the 2D the main charecter is terrible look", FACTORY screenshot) and **explicitly allowed 2D and 3D to look different**. Two measured defects, both fixed in `drawPlayerBody` only: (a) `PLAYER_HULL #8d97ac` vs FACTORY `wall #8a96a4` is ΔL **0.008** / Δhue **8.3°** — value AND hue collapse on the SAME swatch, so a 2px 55%-alpha seal was doing all the separation at 29px; (b) the figure was **29% head** (~3.4 heads), adult proportions on a 29px sprite, so there were never enough pixels for a face. New `PLAYER_SUIT #cd5ac3` orchid (L .479, chroma .451, hue 305) + shoulder-ledge seam `-0.46r → -0.20r` = **41.4% head**, plus one swept crest FIN as the silhouette hook. `PLAYER_HULL` keeps its value and export — **3D is untouched**; `three/entities.js` unchanged. Do not re-merge the two hexes.
- Hex NOT taken from the research table. `research-2d-hero.md`'s recommended `#b83fc0` shipped in capture iteration 1 and read weakly in VOID, where `brickA #6a20c8` sat **32.0 Lab ΔE** away — the tightest pair in the game. Same hue family lifted to L .479 → worst pair **44.6 ΔE**, and it is the only value in the family that also clears BOTH bright floors (ICE .671, SAND .608) on value alone. ΔE was the selection method; the shipped gate stays ΔL/Δhue.
- Moved pins (RED on the R1 body, GREEN now): R1's `lum(PLAYER_HULL) ∈ [0.28,0.62]` **retired** — a band on one hex cannot see the backdrop and it stayed green on the rejected build. Replaced by a per-biome **AND** gate over all 8 biomes × `{floor0,floor1,wall,brickA,brickB}` (`ΔL<0.12 ⟹ Δhue≥25°`; R1 failed on FACTORY.wall + both ICE floors, IONVEST's worst is 41.1°), a **chroma floor** ≥0.35 (R1 0.122 → 0.451), a **head-ratio band** 0.38–0.50 (0.293 → 0.414), an outline-backing gate, and a 2D/3D divergence pin.
- **The research's §5 gate 1 is arithmetically unsatisfiable and was deliberately folded into gate 2, not dropped silently.** `min ΔL >= 0.12` over all 40 swatches holds for NO hex — the swatches cover the value axis densely; `#b83fc0`'s own true minimum is JUNGLE `floor0` at ΔL 0.007 (the research quoted 0.254, which is ARENA `floor0`, not the minimum). The research's own gate 2 names the real failure — both axes collapsing on the *same* swatch — so the AND is what ships. Also: all repo numbers are **Rec.709** (`items-art.test.mjs`'s `lum`); the research tabulates Rec.601, and the two agree on gunmetal only because it is near-neutral.
- Live-captured 3 rooms + a 4x zoom (loopback :8080, SW/caches cleared, `__GAME__` forced render + `toDataURL`, enemies cleared off the tile): JUNGLE/FACTORY/VOID all squint-PASS at 1:1. Capture gotcha for next time: the browser rejects a cross-origin `fetch` to the `e2e-artifacts/capture/receiver.mjs` port unless `mode:"no-cors"` — the receiver's own comment claims no CORS bookkeeping is needed, which is true for the *request* but not for reading the *response*. PWA v79→v80. Full report: `.superpowers/sdd/2026-09-06-taste-revision/task-2dhero-report.md`.

## 2026-09-05 — Closing fix wave: iso pause geometry test, still-jungle recapture, AGENTS.md drift, minor batch
- Correction: commit `9ecd8ca`'s subject ("...after listening to the whole score in run order") overclaimed a listening sign-off. The gate actually run was structural (bounced to WAV, A/B'd against the pre-rewrite reference, smoke-checked live for cue routing) — the entry body already said so ("both the user listen and the live play-verify are still open") but the subject reads as if a real listen happened. The user listen, to be delivered via the MP3s, is still open.
- Reviewed the "iso pause-list geometry mismatch" finding: empirically, `renderer.js`'s dimetric-kind ternary and `main.js`/`shellview.js`'s `overlayBox(curKind)` hit test already resolve to the same PROJ box for `"iso"` (verified by instrumenting `render()` and by a new `three.test.mjs` §7b regression test asserting drawn row-0 y round-trips through `pauseHit` to row 0) — no source bug found. Did **not** move the dimetric special-case inside `overlayBox` as the finding suggested: that would make `overlayBox("3d")` (real 3D's box, pinned by `heat.test.mjs`) return the PROJ box too and break real-3D's overlay.
- `media/still-jungle.png` had a transparent cream border (RGBA 255,230,170,30) — the same `scene.background=null` alpha-haze the P5 report already documented, apparently from an unpromoted earlier candidate. Recaptured live (loopback :8080, SW/caches cleared, `__GAME__` forced render, natural level-1 roster): new border is opaque JUNGLE `bg1` `#062416` at alpha 255, matching `still-ice`/`still-crown`'s pattern.
- `AGENTS.md`: removed the deleted `src/app/toolbar.js` seam from the `main.js`/`src/app` bullets and the "toolbar Source control" wording, fixed the Shell state-machine row to match the real `SCREEN` enum (`INTRO → MENU ⇄ LEVEL/SCORES/SETTINGS/GUIDE(→HOWTO/ITEMS/ENEMIES) → GAME; idle → ATTRACT`), and added a hazard note that the cabinet bezel sits at `|ndc| 1.0974` of the `<=1.10` gate with `CAM_PRESET` STANDARD (870) exactly there.
- Minor batch: `debughook.js`'s `SCREEN_NAME` gained SETTINGS/GUIDE; dead `pulse()`/`oct()` removed from `src/audio/tracks.js` (zero call sites; `music.test.mjs:317`'s label reworded since it named `oct()`); `menudraw.test.mjs`'s stale MENU fixture swapped for the real shipped rows (`PLAY|· CORE`, `LEVEL SELECT|· CORE`, `OPTIONS`, `GUIDE`, `HIGH SCORES`, `SOURCE`); `headless.test.mjs`'s `main.js` line-count gate tightened 743→706 (measured 701, +5); `docs/superpowers/plans/2026-09-05-soundtrack-wave1.md`'s "sand plays ~22% legato" prose corrected — the `STEP` pre-move only changes tempo, the articulation ratio is unchanged.

## 2026-09-05 — P5: headed art-acceptance sweep + full media recapture
- Scored the §5/settings/guide headed checklist against real rendered pixels (JUNGLE/VOID/FACTORY 3D+2D, bomb-vs-power, MENU/GUIDE/OPTIONS/pause, all three camera presets, brightness 70/100/130): every line PASS, zero source fixes needed — P1–P4/R1/S1–S3 already closed the gaps. FACTORY hull-vs-wall watch item resolved with a number, not a guess: authored albedo ΔL(wall−hull) = **−0.0076** (`#8a96a4` vs `PLAYER_HULL #8d97ac`), i.e. essentially no value gap — separation is 100% shape/contour (2D: dark seal outline; 3D: crest + shouldered silhouette against black floor), exactly the risk R1 already flagged; no hull edit made. `#hud` confirmed fully gone (`getElementById` null, no `id="hud"` in index.html).
- Recaptured all seven listing binaries in place: a prior capture run (this morning, before R1/R2/R3 landed) was stale and is superseded. `og.png` rebuilt from a live transparent-clear JUNGLE hero (bomb planted, player retreats, blast opens a brick) composited onto the locked card layout — found and fixed a real bug in the capture tooling along the way: `scene.background=null` clears to alpha **55** (cream), not 0, so the naive bbox-crop left a visible rectangular halo behind the diamond board; fix scrubs any pixel `alpha<128` to fully transparent before computing the box and drawing, verified by sampling three field points post-fix (all within noise of each other). `play.gif` (43 frames, 12fps, 630px, ffmpeg palette pipeline) hit two more sim gotchas worth remembering: clearing `world.enemies` to `[]` trips the instant-WIN branch in `sim.js` (`updateEnemies` returns `{advance:true}` on zero enemies) — relocate them instead; and standing on your own bomb through detonation calls `hurtPlayer`, which **teleports the player to `(1.5,1.5)*TILE`** — looked like a rendering bug (player "vanished") until traced to spawn-iFrames blink (`Math.floor(p.iFrames*12)%2` gating `player.visible`) plus this respawn-snap; both are `src/core` behaviour, not touched, just now documented as capture-script hazards.
- `media/README.md` provenance rewritten to state plainly what each row's capture actually did (direct `w.grid`/`w.bombs` mutation, shortened fuse, relocated enemies, forced `iFrames=0`) rather than reading as untouched natural play. `AGENTS.md` needed no edit (recipe unchanged). No PWA bump (zero src bytes changed). Full report: `.superpowers/sdd/2026-09-05-items-player-art/task-p5-report.md`.

## 2026-09-05 — R3c soundtrack wave 2
- `ice`/`jungle`/`factory`/`water`/`sand` rewritten, so all ten tracks now share one motif (1̂3̂5̂6̂5̂) over one parent collection in eight modal rotations; these five keep a `transp` B at its stated ratio (ice ×1.122462, jungle ×1.189207, factory ×0.890899, water ×1.33484, sand ×1.059463) while `menu`/`arena`/`void`/`crown` have hand-authored ones. `water.A/B.bass` and `sand.A/B.lead` are the only channels using per-note velocity — R3a's uniform-`v` pin is now an explicit allow-list of exactly those four.
- The all-ten-quantified pins (tempo ladder, biome roots, timbre scarcity, lanes, breath bars, per-track occupancy bands, Ionian uniqueness) land here because they could only be true once every track was rewritten. Controller render gate signed (rests visible, mood ordering correct, every B measurably modulates); **both the user listen and the live play-verify are still open**. Flag for a later pass: `sand` first, then `factory`, want hand-authored Bs — a semitone `transp` reads as repetition, and the hat shared by identity anchors the spectrum through every modulation (which is also why factory's metric modulation stays deferred). Bounces + PNGs + MP3s in `.superpowers/sdd/2026-09-05-soundtrack/wav/wave2/`.

## 2026-09-05 — R3b soundtrack wave 1
- `intro`/`menu`/`arena`/`void`/`crown` rewritten around one motif (1̂3̂5̂6̂5̂) with hand-authored B sections for the last four; `menu` walks a tresillo bass with the lead in counterpoint and `oct()` is gone from it; `arena` and `crown` stop the whole band for a bar so SFX have a hole to land in, and `crown.B`'s hat quotes `arena.A`'s step pattern.
- Three wave-2 numbers were pre-moved to keep the tempo/root distinctness pins green mid-wave: sand `STEP` 0.139, water root 49.00, factory root 82.41. Controller render gate signed (rests visible, A/B contrast visible, mood ordering correct); **user listen still open** — R3c waits on it. Bounces + waveform/spectrogram PNGs + MP3s in `.superpowers/sdd/2026-09-05-soundtrack/wav/wave1/`.

## 2026-09-05 — R3a soundtrack seam
- `createAudio({ctx})` + `bounceTrack(id, seconds)` let an `OfflineAudioContext` render any track to WAV via `tools/bounce/` (dev-only, never precached, `out/` gitignored); `tracks.js` note tuples now accept an optional 4th velocity element (`[s,f,d,v?]`) which no track authors yet.
- The ten pre-rewrite bounces are parked in `.superpowers/sdd/2026-09-05-soundtrack/wav/before/` as the A/B reference for R3b/R3c's listening checkpoints.

## 2026-09-05 — GUIDE fold + HUD strip removal
- MENU is six rows now (PLAY/LEVEL SELECT/OPTIONS/GUIDE/HIGH SCORES/SOURCE); HOW TO PLAY/ITEMS/ENEMIES fold under a new `GUIDE` row (`SCREEN.GUIDE`=11, appended after `SETTINGS`:10) with its own cursor and MENU's own wrap-both-ways navigation, and `back()` from those three now returns to GUIDE, not MENU.
- This explicitly reverses the S3 "keep `#hud`, gated to `SCREEN.GAME`" call: the DOM `#hud` strip is deleted outright (markup + CSS + `main.js`'s gate), not kept behind a flag. Its two facts the canvas didn't already have (`LV`, `ENEMIES` remaining) are now painted as two more chips beside BOMB/FLAME in `drawHudChips`.

## 2026-09-05 — Pause menu + chrome removal (S3)
- The PAUSE overlay is now a four-verb list (RESUME/RESTART/OPTIONS/QUIT TO MENU); `world.state` stays `PAUSE` and the shell stays `GAME` throughout, so the room's track keeps playing and every `screen===GAME` guard stays true. `overlayBox(kind)` names the one coordinate space `drawOverlay` and `pauseHit` both read, so the list and the tap map can never disagree by a pixel.
- OPTIONS from pause is an inline `app.pauseView===1` page on the same `drawSettings` body, not a `_push(SCREEN.SETTINGS)` jump — a screen jump would flip the music cue to the menu track and close the HUD/touch gates mid-run for a page the player closes in four seconds. `RESTART` now calls `persistScore()` before zeroing the run, banking the score the toolbar button used to drop silently.
- `main.js` calls `app.update(dt, shellInput)` unconditionally every GAME frame (not just while paused) so `prevConfirm` keeps tracking the fire latch across the PLAY→PAUSE edge; skipping PLAY frames would let a held-fire press of P read a false rising edge and instant-confirm RESUME.
- `index.html`'s `#controls` toolbar and `.hint` keyboard legend are gone; `src/app/toolbar.js` is deleted. Audio unlock never depended on the toolbar — `main.js` binds `keydown`/`pointerdown` on `window` with `{once:true}`, so canvas and `#stage` gestures unlock identically. `#hud` is now gated to `SCREEN.GAME` (found and fixed a real bug along the way: `#hud{display:flex}` is an author rule that beat the browser's own `[hidden]{display:none}` UA rule, so the JS gate alone never actually hid it — needed an explicit `#hud[hidden]{display:none}`, the same pattern `#gl` already used).
- Touch gets a 44px `#tpause` pill (third child of `#touchpad`, two CSS bars, no canvas); `touch.update(inGame, playing)` additionally hides the 128px move pad and 72px bomb button whenever `world.state!=="PLAY"` (they sit in the pause rows' corners), while the pill stays as the touch player's way to resume.

## 2026-09-05 — OPTIONS screen + eight-row menu (S2)
- `SCREEN.SETTINGS` is 10, appended after `ENEMIES:9` (never inserted); `ITEMS` drops to 8 with PLAY/LEVEL SELECT/OPTIONS/HOW TO PLAY/ITEMS/ENEMIES/HIGH SCORES/SOURCE. RENDER and SOUND fold into OPTIONS' nine `OPT_ROWS`, so there is one write path per persisted `nb.settings.v1` value instead of a mirrored menu toggle.
- `app.optRow` is its own cursor, separate from `app.cursor` — entering/leaving OPTIONS never disturbs where the MENU list was left. `drawSettings`/`settingsHit`/`settingsGeom` share one layout budget so a tap can never land on a row the plate did not paint; `drawMenu` drops the `togT` toggle-flash arg entirely (it moved to `drawSettings` with the knobs it now flashes).
- The OPTIONS head kicker reads `CACHE_NAME` (via `shellview.js`'s `REV`) so a player can self-diagnose stale cached bytes from the screen itself.

## 2026-09-05 — Settings store + live knobs (S1 of the settings-menu program)
- `src/app/settings.js`: one `nb.settings.v1` JSON blob (8 knobs) on the `store.js` scaffold, clamped identically on load and save; corrupt/partial/non-object payloads self-heal per field and nothing here ever throws.
- `audio.js` `setVols({mus,sfx})` scales the value at the existing peak-amplitude ramp sites (`voice`/`noise`) and the three `musicGain` targets — no new gain node, so SFX stay wired direct-to-destination and `duck()` still never touches them; `sfxVol<=0` early-returns beside `muted`.
- `fx.js` `setFxOpts({flashK,shakeK})` damps inside `getFlash`/`getShake` (both render paths, no draw-site edits); `initFx()` deliberately does not reset the two knobs. `lights.js` exports `LIGHT_BASE` so `createLights(biome,k)` (k defaults to 1) and the new `applyBright(L,k)` read one table; key:fill holds 2.3333 at every k. `scene.js`/`wrapper.js` thread `bright` through `buildScene` and `o.bright` in `render()`.
- `camrig.js` `CAM_PRESET=[870,960,1040]` (all >=870, none dollies past the 1.10 bezel gate) with `CAM_NAME`/`camPreset(i)`; `main.js` loads the blob once at boot, applies every knob (`applySettings`), and re-applies `rig.dist` after every `resetOrbit` (onStart, KeyR). S1 ships no UI; at shipped defaults every existing pin (SFX direct-to-destination, duck ramps, camera rig, `NoToneMapping`, wrapper surface keys) passes byte-identically.
- Deviation: `main.js`'s pinned line-count gate in `headless.test.mjs` (<=640) had to move to <=655 — the `applySettings(S)` closure the INDEX plan requires plus the boot-apply wiring adds ~13 lines even after trimming comments, and that gate wasn't listed as a kept pin anywhere in the settings-menu program docs.

## 2026-09-05 — Hero rebuilt as a five-mesh stack; fat-world 143 -> 141
- P4 of the items-player-art program. `SLOT_MESH.player` 7->5: one merged matte hull (`mergeGeos` fuses the torso lathe with two pre-transformed yoke chips into one `BufferGeometry` draw — never added as children), one `p.color` crown lathe, one Phong visor (the player's only specular surface, raked `visor.rotation.x=-0.6`, `e_fast`'s exact face rake), two boots. The dome, the antenna rod+ball and the two round cyan eyes are deleted from both renderers for good. All four fat-world pins (`three.test.mjs` formula + bare literal, `pickup-3d.test.mjs` formula, `enemies-art.test.mjs`'s one permitted literal) plus three `AGENTS.md` lines moved together in this change; the S4.A histogram is rewritten (0 Sphere, 0 Cylinder, 2 Box, 1 each Buffer/Lathe/Extrude) and its hemisphere-dome and visor-band probes are replaced by a crown-flare probe and a Phong+rake+hull-Lambert probe.
- `paintVisor` (`textures.js`) repainted from "navy band + two cyan glints" to the same 2D-slit read `drawPlayerBody` paints: near-black well, one lit core bar, one white specular pip — both renderers now show one face. Two spec-missed sites also fixed here: the `R.headless player` probe (now hull Lambert `#dfe7f2` + crown lathe + Phong visor `#0b1020` fallback) and the S2.R visor check-name label.
- Banned franchise word rewritten in `entities.js`'s module header + player block comments and `tests/three.test.mjs`'s S4.A check name (plus one occurrence the plan's ledger missed, in that same test file's own module header, at line 19) — all replaced with "signal-runner", never describing the deleted dome/antenna/sphere as present. Two purely historical wave-log mentions of "143" (`three.test.mjs` lines 25 and 1541, describing what the 2026-08-25 enemy-identity wave contributed at the time) were deliberately left alone.
- Headed 3D sanity check (JUNGLE room 1, player two tiles from a WALKER, `?render=3d`, SW unregistered + caches cleared, `__GAME__.step(0)` forced render + `#gl.toDataURL()`): the hull reads as a light matte kite-yoked silhouette right next to WALKER's rounded mint dome; the crown is the only teal (`p.color`) surface; a single specular pip sits inside the dark visor band. Screenshot saved to `.superpowers/sdd/2026-09-05-items-player-art/p4-player-3d.png`. PWA v41->v43 (two commits, this plan only).

## 2026-09-05 — Player 2D rebuilt as SIGNAL RUNNER: kite hull, one-placement p.color crown, zero-arc visor slit
- P3 of the items-player-art program. `drawPlayerBody` runs the same five-beat shell `enemybody.js` uses (contact ellipse, dark contour, inset lit body, upper-left sheen, face) plus grounding and a back pose: a shoulder-yoked kite silhouette (`S_RUNNER`) in a light matte `#dfe7f2` hull carrying dark parts (near-black visor slot, navy/orange boots) — the WALKER separation is structural (shape + value), never a hue nudge, per the three-golds lesson. `p.color` moves to the crown band and nowhere else on the body (one-placement rule). Antenna rod, antenna ball, the two round cyan eyes and the balloon dome are deleted outright; the zero-arc rule holds (contact shade is an `ellipse`, visor core a rect, specular pip a quad — only `p.shield`/`p.passing` still draw arcs).
- Visor cluster slides on `face.x` and is replaced by a `dk(HULL)` nape bar + pack chip when `face.y < -0.5`, matching the walker/chaser back-pose convention. `p.kick` still flips the boot fill AND paints the cleats; `p.shield`/`p.passing` rings and the iFrames flicker are untouched. Fit gate splits per the resolved ambiguity: `±1.05r` horizontal, `±1.20r` vertical overall, `±1.10r` vertical for everything but the contact shade (which reaches `1.18r` by its own §2.2 numbers).
- Headed 2D sanity check (JUNGLE room 1, player two tiles from a WALKER): the new hull reads as a distinct faceted machine body next to WALKER's rounded mint blob — crown carries the only `p.color`, one specular pip on the visor, hull stays flat matte. PWA v39->v41 (two commits, this plan only).

## 2026-09-05 — Item 3D bodies rebuilt: twelve plan-view-distinct pickups, four family rings, per-family idle rhythm
- P2 of the items-player-art program. `ITEM_MAKE` rebuilt on the plan-view law: CAPACITY/VITALITY are low-`seg` lathes (fire 3-gon, bomb 4-gon, speed 3-gon elongated, heart twin 6-gon, shield 8-gon), UTILITY/BLAST-SPECIAL are `mesa()` shelf+mesa plates cut straight from `icons.js`'s `ITEM_SHAPE`/`ITEM_ACCENT` tables (one table now feeds both renderers). `plate()` learned quadratics (`[x,y,cx,cy]` vertices) so `kick`'s rounded toe and `throw`'s orb tessellate instead of chording. Closest built pair: `kick`/`power` both rounded to `maxR 12` at the same `r=0.24*TILE` — nudged `power`'s mesa radius to `0.23*TILE` per the spec's collision remedy (adjust the smaller kind's `r` by `±0.01*TILE`, never re-hue or merge geometries); all 12 footprints now pairwise distinct (`(w/d, maxR)`).
- `iringGeo` (one shared `RingGeometry` restating `pdef.col`) became `ITEM_RING_GEO` — four family profiles keyed by `ITEM_FAMILY`: CAPACITY hairline, VITALITY concentric double, UTILITY six dashes, BLAST-SPECIAL ring+eight ticks. Twelve ring `InstancedMesh`es still draw twelve; `RING_SCALE` (`line .86 / pierce 1 / power 1.16`) puts blast reach into the per-instance ring scale. `update()`'s item loop now phases bob/spin/sway/ring-pulse per family off `ph=(x*0.7+y*1.3)/TILE` (grid position, not `slot`), so collecting a neighbour no longer jumps an item's animation.
- `SLOT_MESH.player` never moved in this plan, so fat-world held at **143** with zero new literals (the 143->141 move is P4's alone). PWA v36->v39 (one bump per commit, three commits).

## 2026-09-05 — Pickup glyphs re-cut semantic-first after the user rejected the first pass
- User feedback verbatim: *"the new itemts are not really intutive design graphic and people confiuse from the look, let's review it, and make more intiutive and more reall look."* The P1 glyphs optimised plan-view distinctness and craft, and shipped a berry (BOMB), a slipper (KICK), a magnet (PASS), a sparkle (POWER) and a folder (REMOTE). New binding rule in spec §1.6: every glyph must be a **nameable object** at both the ITEMS chip and the HUD chip, and semantics beat the plan-view budget when they conflict — so 2D `bomb` is a round orb while 3D `bomb` stays a low-`seg` 4-gon lathe (a sphere is a circle from 59.1°). Nine of twelve `ITEM_SHAPE`/`ITEM_ACCENT` rows re-authored; `speed`/`heart`/`shield` byte-identical because they already read (`heart` also feeds the S4.D `>=12` curve-op HUD-lives gate — never re-author it as a polygon).
- Budgets renegotiated in the spec *and* the tests, not silently: outline `<= 12 -> <= 14` verts (only `power`'s seven-spike explosion spends it), accent `<= 3 -> <= 4` paint ops (only `bomb` reaches 3). `±1.20*s` fit unchanged; its headroom is **one-sided** because beat 1 offsets the form shadow by `(+0.07s,+0.09s)`. Two traps recorded: a partial `arc` is bounded by its whole circle in the fit recorder (so `remote`'s signal arcs and round button are quadratics), and many subpaths in one `beginPath` cost **one** paint op. New gates in `items-art.test.mjs`: per-kind outline pins + mass-separation over `pass`/`pierce`, `bomb`/`throw`, `line`/`pierce` — distinctness alone would have let this whole revision slip through green. PWA v35->v36.

## 2026-09-05 — Restart fireEdge hole closed, SCORES chip row goes compact, RIM_W doubled
- Toolbar `onRestart` now sets `world.fireEdge=true` right after its `loadLevel`/state reset (closed the held-fire-across-Restart plant hole flagged in the prior wave); `drawScores` inlines the four plaque chips on the heat-tab row's right side when `L.logoScale<1` (608x352), reclaiming the dedicated chip row's height for the score table; `RIM_W` 18->36 in `three/scene.js` (bezel bleed now 1.097 `|ndc|`, still under the 1.10 gate). PWA v34->v35.
- Found while chasing "why is npm test still red": `three.test.mjs`'s pre-existing "S4.D lives drawn as heart glyphs (bezierCurveTo)" check already fails on unmodified HEAD — `drawHudChips` reuses `icons.js`'s shared `drawIcon`, which draws with `quadraticCurveTo`/`lineTo`, never `bezierCurveTo`; unrelated to this wave's 4 items, left untouched, so `npm test` still shows 1 failure.

## 2026-09-05 — Pickup glyphs rebuilt on the cabinet five-beat
- `tone`/`dk`/`lt`/`poly`/`oval`/`seal` moved out of `enemybody.js` into `icons.js` (imports-only diff on the enemy side; `tests/enemies-art.test.mjs` stayed green with zero edits, fat-world still 143). `icons.js` grew `ITEM_FAMILY`/`ITEM_SHAPE`/`ITEM_ACCENT` and `drawIcon` now runs the same five-beat stack as foes (form shadow, RIM seal, body, sheen, one accent) instead of a flat per-kind `switch`.
- `drawItemBody`'s double `it.col` ring (which only restated the hue the body already states) is now `drawItemChrome` — four family ring profiles (hairline / double / dashed / spiked) — plus a grid-phased idle echo (`ph = (x*0.7+y*1.3)/TILE`, not `slot`) so collecting a neighbour no longer jumps an item's animation. New `tests/items-art.test.mjs` (P1 of the items-player-art program). One known side effect: `tests/pickup-3d.test.mjs`'s old op-name-only "12 item_* 3D face signatures are distinct" check now collides `speed`/`remote` (structurally uniform five-beat driver vs. the old hand-varied switch); flagged as a follow-up, not fixed here (fixing it means editing the shared 2D/3D `ITEM_SHAPE`/`ITEM_ACCENT` tables or the test itself, both out of P1's scope). PWA v31->v34.

## 2026-09-05 — Final fix wave: held-fire plant, coach/pause desync, and a live-capture cover
- CRITICAL: a Space held across INTRO boot/MENU START/ATTRACT (all funnel through `main.js`'s `onStart`) survived `loadLevel`'s `world.fireEdge=false` reset and read as a same-frame bomb plant, also instant-latching `coachPlanted` and killing the coach in ~2 frames. Fixed with one line: `onStart` now sets `world.fireEdge=true` right after `state="PLAY"` (the fire that started the run is never a plant). `src/core` untouched.
- IMPORTANT: `world.time` accumulates through PAUSE (sim.js bumps it before the early-return) and `loadLevel` never resets it, so a long pause could exhaust the coach's `time<COACH_DUR` gate for the whole session. Added `coachT`, a main.js-owned accumulator that only advances while `screen===GAME && state==="PLAY"`, reset in `onStart` beside `coachPlanted`; `coachOpen`/the fade alpha now read `coachT`, never `world.time`. Both regressions got a real TDD round-trip (temporarily reverted each fix, confirmed the new test fails, restored, confirmed green) before landing.
- Minor cleanups in the same commit: `?play=1`/autoplay now calls `saveCabinetSeen()` too (it skipped `bootFromIntro`'s own marker, so a shared autoplay link never persisted `nb.cabinet.v1`); `KeyC`'s early return is now GAME-only so it falls through to `app.key` on ATTRACT (tap-to-play was accidentally swallowed); `drawCoach` dropped its unused `world` param (renderer.js/wrapper.js/tests updated) and its header comment now says 3D's coach is a fixed HUD overlay, not tied to spawn (1,1); `isEmbedded`'s `?embed=1` regex now also terminates on `#`; `highscores.test.mjs`'s duplicated post-`process.exit` block (dead since some earlier edit, ~50 lines, referenced an unimported `scoreEntry`) was deduped, imported, and moved before the real exit — all 4 assertions passed as-is, no stale behavior found; restored the `g.demo===null` post-Escape-exit assertion in `headless.test.mjs`'s ATTRACT block (dropped by a later commit). SKIPPED the SCORES-plate chip-suppression idea (608×352 squeezes rows to ~13px) — properly adjusting `menudraw.test.mjs`'s 13d block for a suppressed 608×352 case would break 5 existing chrome-fit assertions there, well past the ~15-line budget. main.js's own line-count pin bumped 622->640 (now 638).
- `media/cover-630x500.png` was a center-crop of `og.png` that always clipped a text/pill-border sliver (no 630×500 crop of the 1200-wide source avoids it). Replaced with a dedicated capture: live `?render=3d&debug=1` on loopback (SW unregistered, caches cleared), JUNGLE room 1, a bomb planted+detonated via the debug hook's `step(n)` (RAF stays paused while the capture tab is backgrounded, so wall-clock RAF isn't viable — same workaround the GIF capture used), caught ~50ms into the blast. `#gl`+`#c` composited at native 2x-DPR (1200×1040) then downscaled-only (0.525×, no upscale) to a 630×500 cover-fit crop. No `{hud:true}` in the debug hook's render call, so there's no HUD text at all in the shot — nothing left to cut off. `media/README.md` provenance row updated; `tests/media.test.mjs`'s 630×500 pin stays green. PWA bumped v30->v31 (main.js/scenes.js/wrapper.js/register.js precache bytes changed by the code-fix commit; the cover commit alone touches no precached bytes).
- Left alone (out of scope for this wave, flagging for later): the toolbar Restart button's `onRestart` handler has the same `loadLevel`-clears-`fireEdge` shape as the CRITICAL fix but isn't behind `onStart`, so a held-fire Restart could still plant on frame 1 — not in the reviewer's finding list, untouched here. Also, `tests/pwa.test.mjs` still carries 3 literal-string checks-for-absence of the banned franchise name (pre-existing per an earlier session's compliance note); not touched since it wasn't one of this wave's findings.

## 2026-09-04 — First-visit Play Now: unseen cabinets skip INTRO straight to CORE
- `src/app/cabinetseen.js` persists `nb.cabinet.v1` (mirrors coach.js's "1"-flag). Every INTRO exit path (skip/confirm/any-key tap/main's ~5s auto-advance) already funneled through one choke point, `menuapp.js`'s `skip()`; it now delegates to a new `bootFromIntro()` that boots straight to a CORE room-1 GAME (and marks the cabinet seen) unless `cabinetSeen` or `pactUnlocked` is already true, in which case it still lands on MENU. `playFromAttract` and `bootFromIntro` now share one `_playCore(args)` reset+onStart helper (the prior duplication a deferred review flagged). No backfill of the flag on pact-unlock: any path to pact-unlock already implies cabinetSeen is true (bootFromIntro sets it before the very first run) except the `?play=1`/autoplay bypass, which the `pactUnlocked` OR-check already covers. PWA v29->v30 (cabinetseen.js added to SRC).

## 2026-09-04 — Added the four local cabinet plaques (CLEAR/PLUS/MAX/CROWN)
- `src/app/plaques.js` persists `nb.plaques.v1` (bitmask, mirrors `pactstore.js`); `unlockPlaques` is called from main.js ONLY at the existing finale-WIN persist edge (`if (world.finale && world.state === "MENU")`, beside `savePactUnlocked`) — a LOSE never sets `world.finale` and ATTRACT steps a separate `demo.world`, so neither can reach it. Four chips painted on the SCORES plate under the heat tabs in `menudraw.js`'s `drawScores` (dim when locked); the mask reaches the draw via a `getPlaques` callback threaded through `drawShell` alongside the existing `getScores` path, so `menudraw.js` still never imports `src/app`. PWA bumped v27->v28 (Task 1: added plaques.js to SRC) ->v29 (Task 2: wiring + chip paint).

## 2026-09-04 — Added the ghost coach (first-run WASD/SPACE nudge)
- `src/app/coach.js` persists `nb.coach.v1`; `drawCoach` (scenes.js) paints faded W/A/S/D + SPACE near spawn (1,1), alpha `1-time/3`, gated by a pre-computed `open` (render/ can't import app/, so scenes.js can't read `COACH_DUR` from coach.js — its own local copy must stay in sync by hand). main.js latches the first `bomb` event and persists dismissal right after the physics step, before that same frame's `renderer.render()` drains `world.events` — the one place in the RAF loop where a just-planted bomb is still visible. Never draws on ATTRACT (demo world is state PLAY too) since `coach` is only passed alongside `{hud:true}`, itself gated on `app.screen===GAME`. PWA bumped v24->v25->v26.

## 2026-09-04 — Committed a real media/ listing pack
- Captured `media/` from the live game on loopback (SW unregistered + caches cleared first): `cover-630x500.png` (cropped from the real `og.png` hero, no upscale), `still-jungle/ice/crown/menu.png` (JUNGLE/ICE via direct sim `loadLevel`, CROWN via room 8 the same way — no Pact-unlock save-scum needed since the sim itself has no gate; MENU from `#c` in 2D kind), and `play.gif` (~4.2s/12fps/630px, a real JUNGLE run: move, plant, fuse, blast opens a brick, movement resumes). `media/README.md` documents each asset, the zip recipe (omits `tests/`, `docs/`, `.git`, `media/`, `og.png`), and the itch blurb. Root `README.md` points at `media/`. `tests/media.test.mjs` pins the cover at 630×500 and guards `media/`/`og.png` out of the PWA precache. Note: the automation browser tab runs backgrounded (`document.hidden`), which fully pauses `requestAnimationFrame` — the GIF was captured by driving the real deterministic `step()`/`render()` via the debug hook's `step(n)` instead of relying on wall-clock RAF.

## 2026-09-04 — registerSW no-ops in iframes and ?embed=1
- Added `isEmbedded(env)` (top !== self, or `[?&]embed=1` in href) to `src/pwa/register.js`; `registerSW` returns false before calling `navigator.serviceWorker.register` when embedded, so an iframe listing (itch/Newgrounds/Game Jolt) never steals the SW/cache from the top-level Pages origin. PWA v23 -> v24 (register.js precached bytes changed).

## 2026-09-04 — HIGH SCORES gained CORE/PLUS/MAX tabs
- `scoresForHeat(list, heat)` filters the one persisted `nb.highscores.v1` list at draw time (CORE keeps legacy rows with no `t`); `app.scoreHeat` is a display-only `clampHeat` value cycled with `←/→` while on SCORES (`move`/`_tapMove`), and `drawScores` gained a `heat` param for the tab row + `NO <NAME> RUNS YET` empty state. PWA v23.

## 2026-09-04 — Honest end screen: SPACE/TAP cues, a copyable run stamp, KeyC
- `scenes.js` gained `overlayCue`/`runStamp`/`copyPayload` (raw `world.score`, `biomeOf`, `HEAT_NAME`); WIN/LOSE/PAUSE overlays now speak SPACE/TAP instead of FIRE/"retry", and drop the dead `state==="MENU"` branch (grep found nothing else paints it — the shell's MENU chrome always paints over it the same frame). `KeyC` in `main.js` copies the stamp + Pages URL on WIN/LOSE inside GAME. PWA bumped to v22.

## 2026-09-04 — Attract now starts a run instead of just exiting
- Added `playFromAttract()` on the shell: tap/pointer/#stage/confirm/any non-Escape key from ATTRACT now starts a CORE room-1 run (keeping LEVEL SELECT's level/heat/pact picks for next time); only Escape/Backspace still exit to MENU. Hint copy is now `DEMO — TAP TO PLAY`. PWA bumped to v21 (menuapp.js/main.js/menudraw.js precache bytes changed).

## 2026-09-04 — Arcade-loop spec + seven step plans
- Locked the portal-inspired work as `docs/superpowers/specs/2026-09-04-arcade-loop-design.md` and one plan per step under `docs/superpowers/plans/2026-09-04-*.md` (index: attract play, end screen, scores-by-heat, ghost coach, plaques, listing pack, first-visit). Not implemented yet.

## 2026-09-04 — Public SEO: About copy, topics, and page metadata
- GitHub About no longer leads with "deterministic" (a contributor word). Description is play-in-browser + REAL 3D ⇄ CLASSIC 2D + Heat; topics filled (javascript / game / arcade / webgl / threejs / pwa / …). Repo Settings → Social preview has no API — still needs a manual `og.png` upload.
- `index.html` title/description/OG/Twitter/JSON-LD now match that storefront (free VideoGame + WebApplication, sr-only H1 + crawler paragraph). Manifest + package.json copy aligned. PWA v20.

## 2026-09-04 — REAL 3D framing filled out, and the murk was two bugs
- Rig is now `{az:0, el:0.54, dist:870, target:[0,-48,0]}` (59.1°) fitted to the
  PLAYFIELD corners instead of the decorative bezel: board area 38.9% -> 50.9% of the
  canvas, dead height 38% -> 28%, ICE occlusion 0.64 -> 0.54 tile. The brief's premise
  was backwards — X binds the fit at EVERY elevation, so vertical fill DECREASES as the
  camera lowers; a higher camera fills more frame AND hides less.
- "Too dark" was not the light values. `Fog(bg1,700,1600)` was erasing 43% of the far
  corners (89% at `DIST_MAX`) and ACES@1.0 crushed linear 0.02->0.007, capped white at
  0.763, and zeroed JUNGLE `floor0`'s red channel outright. Fog dropped, `NoToneMapping`
  for CLASSIC 2D palette parity, recipe lifted x1.2 with key:fill held at exactly 2.3333.
  VOID is still the darkest room; its darkness is albedo, not rig.
- `§4b` gained FLOORS (worst >= 0.90, ndc_y span >= 1.32) that both fail the old rig, so
  the gate now catches a board shrinking back into a void, not just one leaving frame.
  24/24 tests, 143 draw calls, PWA v19. Left open: the residual ~28% background band can
  only go by widening `RIM_W` so the cabinet fills the surround — costs the biome
  `bg1`/`sky` read, so it needs the user's eye first.

## 2026-09-04 — REAL 3D enemy bodies rebuilt to the 2D character language
- Nine `ENEMY_3D` hulls replaced the spheres/boxes: lathe profiles (walker bell,
  rocket ogive, shade cowl) plus extruded plates (fast delta, tail fins), fused by
  a now-variadic, index-tolerant `mergeGeos` INSIDE the existing four-mesh slot, so
  `SLOT_MESH.enemy` stays 4 and fat-world stays 143 draw calls.
- Authored for the frozen rig: at 54.5° the plan-view footprint carries the read, so
  every foe got a distinct footprint, and brows / warning bands are lathe profile
  steps rather than extra meshes. Six `three.test.mjs` pins re-pinned deliberately
  with exact numbers (reasons in the spec); `EYT.e_stationary[2]`, the `GD.e_rocket`
  ref-swap, the magenta-core-on-`children[0]` pins and 143 all held. AI untouched.
- Play-verify caught three things Node could not: `stationary`'s lens hung off the
  hull, `shade`'s eyes were edge-on, `rocket`'s scorch read as a puddle. Also a
  stale `fusegrid-shell-v9` SW served pre-change bytes twice — clear the SW before
  trusting a 3D screenshot. PWA v17 -> v18.

## 2026-09-04 — Foes rebuilt as characters, not colored tokens
- The `926c368` "mature silhouettes" pass never landed in 2D: bodies were still one flat fill of `e.color` with a `fillRect` visor, no floor contact, and walker/chaser/fast all fell out of the same circle branch. `enemybody.js` is now one shared five-beat build (contact shade, dark contour, inset body, upper-left sheen, sculpted eye) over nine distinct contours — bell, pillbox, delta, leaning hull, open ring, missile, grub, ragged hood, crowned helm. Creatures get an eye (sclera / iris / pupil / specular), machines get a lens.
- Shading stacks opaque fills because the headless ctx has neither `clip()` nor gradients; tones lerp off `e.color` (quantised + memoised) so `spawnEnemy` stays the one palette source. No `c.scale()` in any body, so a bounds test can pin every foe inside the ENEMIES well at r=14 — `fast` used to overflow it by 60%. `e.dir` now drives a three-quarter face shift and a real turn-your-back pose. Art only: seed-42 roster and the 180-step AI pin are untouched, draw calls stay 143. PWA v17.

## 2026-09-04 — Share card rebuilt on a real 3D board render
- The old `og.png` predated `1a13216`, so it advertised a look the game no longer has (and its CTA pill ran off the bottom edge). New card composites an actual live capture: JUNGLE, the 54.5° rig, warm key + cool fill, the one cabinet rim, and a blast mid-detonation. Captured headed by setting `scene.background=null` so the WebGL clear is transparent and the board drops straight onto the card field — no chroma key, no pasted screenshot rectangle.
- 1200×630, 644 KB (was 1.25 MB). Alignment from `29e7e4a` preserved and now asserted at build time: CTA left == CORE left (120), CTA right == MAX right (575), chip gaps 20/20. Type sits at a 10% left inset, 22.7% top, 19.4% bottom. `index.html` / README alt copy rewritten to match; PWA v16 since `index.html` bytes moved.

## 2026-09-04 — Split main.js into its seams (865 -> 567) + ignore capture noise
- `main.js` keeps only the RAF loop, fixed-step accumulator, renderer cache and handler wiring; the six seams it inlined moved to `app/flags.js`, `app/attract.js`, `app/toolbar.js`, `app/debughook.js`, `net/localpair.js` and `render/shellview.js` (which also owns `kindSize`/`dims`, collapsing four copies of the canvas/kind fallback). The mid-file import run after `DEMO_SEED` is gone; `headless.test.mjs` now gates line count AND import position so it cannot come back. Behaviour unchanged: 24/24, fat-world still 143, MENU + REAL 3D play-verified headed. PWA v15 for the six new files.
- `.gitignore` now covers `.cursor/` and `e2e-artifacts/` so browser-MCP capture scratch stops showing up in `git status`.

## 2026-09-04 — REAL 3D cam/light/frame: 54.5° rig, key+fill, one cabinet rim
- Rig is now `{az:0,el:0.62,dist:960,target:[0,-44,0]}`: X binds the fit at every elevation, so the 3/4 read cost ~40 units of dolly; `el:0.419` (66°) was a ceiling security-cam. Lights split into warm key `#fff4e2` 1.05 (only caster) + cool fill `#bcd4ff` 0.45 opposite-and-behind, hemi 0.55, ambient 0.18 — 2.3:1, since `PCFSoftShadowMap` ignores `shadow.radius`. The 4 crossing `wallHi` rails became ONE `ExtrudeGeometry` rim with a hole, so fat-world 146 -> **143**. `three.test.mjs` gains a framing gate (all 8 biomes' corners + rim tops, worst ICE `|ndc| 0.913`) and a rim gate (one mesh, real hole, reach == RIM_W). PWA v14. Left open: play-verify headed on JUNGLE + ICE.

## 2026-09-04 — Thermo-nuclear judo 1–6
- Deleted the unused 3D item Group pool (one InstancedMesh write); split `drawIcon`/`drawEnemyBody`; `ENEMY_3D` + `ITEM_MAKE` tables; `crossedQuads` calls `mergeGeos`; MENU confirm follows `ITEMS` labels; one `defaultStore`. Fat-world 146. PWA v13.

## 2026-09-04 — Leftovers 1–6 headed + fat-world 146
- REAL 3D rooms 6–8 BURROW/SHADE/KNIGHT read on frozen `{az:0,el:0.419,dist:1000}`; ENEMIES plate fits 608×352 and 600×520 with `ESC BACK`; 12 `item_*` + 9 `foe_*` play with 0 console errors (`item_burrow` is not a cue); `#tbomb` paints `drawIcon("bomb")`; per-kind InstancedMesh pickups pin fat-world **146**. PWA v12.

## 2026-09-04 — Share-card CTA on heat-chip grid
- Root `og.png` 1200×630: PLAY IN THE BROWSER left = CORE left (x=44), right = MAX right (x=731); CORE/PLUS/MAX gaps stay 20/21px. Art otherwise unchanged.

## 2026-09-04 — PWA reload on new CACHE_NAME
- Returning installs were stuck on cache-first until site data clear. `registerSW` now calls `registration.update()` and reloads once on `controllerchange`. skipWaiting + claim already in `sw.js`. Shell `fusegrid-shell-v11`.

## 2026-09-04 — Leftovers 1–6 (3D foes, plate, cues, #tbomb, instanced pickups)
- Headed REAL 3D rooms 6–8: BURROW/SHADE/KNIGHT read on frozen rig `{az:0,el:0.419,dist:1000}`; geos kept. ENEMIES plate stacks on 608×352 with `ESC BACK`. item_burrow is not a pickup; 9 unique `foe_*` recipes. `#tbomb` paints HUD `drawIcon("bomb")`. Per-kind InstancedMesh pickups pin fat-world **146**. PWA v10.

## 2026-09-04 — Share card og.png refresh
- Replaced root `og.png` 1200×630: one-line FUSE/GRID, REAL 3D ⇄ CLASSIC 2D, CORE/PLUS/MAX chips, knight helm + cabinet bomb; alt copy matches.

## 2026-09-04 — Mature foes + L6–8 exclusive bodies
- Redrew the six cabinet/arena faces (visor, bunker, drone, helm, wraith, missile). Rooms 6–8 append BURROW / SHADE / KNIGHT (`ROOM_EXTRA`); CORE L1–5 roster strings stay v6. Hunt flag `e.hunt`. Fat-world still 186. Spec `2026-09-04-mature-enemies-design.md`. PWA v9.

## 2026-09-04 — Unique 3D pickup geos keep 186
- 12 shared body geos swapped in `SLOT_MESH.item === 2` (cone/sphere/octa/heart-merge/etc.). Foe slots stay 4 (already unique). Fat-world still 186. Spec `2026-09-04-unique-3d-meshes-design.md`. PWA v8.

## 2026-09-04 — Cabinet rest (HOW TO / HUD / bombs)
- HOW TO paints `drawIcon` wells for BOMB / THROW / REMOTE / KICK; HUD BOMB chip uses POWER `#ff5d73`; 2D planted bombs share the pickup silhouette (curved fuse, + pip, dark charge). 3D bomb slot stays 5 / fat-world 186. Spec `2026-09-04-cabinet-rest-design.md`. PWA v7.

## 2026-09-04 — Enemy cabinet silhouettes + kill tints
- WALKER pack / CHASER egg / FAST puck in `drawEnemyBody` (3D faces reuse the same paint). Kill emit gains `type`; `foe_*` table in `src/audio/foe.js`. AI untouched. Spec `2026-09-04-enemy-redesign-design.md`. PWA v6.

## 2026-09-04 — Collect grab burst
- `power` FX is 16+6 sparks + 6 streaks (2D overlay; 3D Points already consume the store). Item cue pairs KICK/THROW and BOMB/POWER pinned. Event still `t:power`+`kind`.

## 2026-09-04 — REAL 3D pickup faces
- 3D cubes reuse `paintItemFace` (`drawIcon` on a navy 64²). `GLYPH` table deleted. Slot still 2 meshes; fat-world 186. Spec `2026-09-04-pickup-3d-design.md`. Collect FX + foe art still next.

## 2026-09-03 — Pickup visual + SFX redesign
- Cabinet glyphs in `drawIcon` + 3D `GLYPH`; 12-tint grab cues (`item_*` via `sfxOf`). applyPower unchanged; THROW/LINE/REMOTE colors unique. Spec `2026-09-03-pickup-redesign-design.md`. Headed 3D look + ear-check still open.

## 2026-09-03 — Demobot far-board (12,11) pin
- L-shaped corridor hunger test + spec append; logic already in intent FSM combat-cube hunt.

## 2026-09-03 — Roadmap phases 1–4 (stereo, bricks, pact HS, pace)
- WebAudio stereo pan per voice; iso brickA/B/Hi; HIGH SCORES PACT column + `p` field; global pace EASY/NORM/HARD on `world.pace` + `nb.pace.v1`. Specs under `docs/superpowers/specs/2026-09-03-*`. PWA shell v2.

## 2026-09-03 — Production QA pass (8/8 Pages)
- Headed smoke on https://hmarzban.github.io/fusegrid/: boot, locked LEVEL SELECT, play/pause, 3D⇄2D, attract, PWA SW `fusegrid-shell-v1`, zero console errors. Pact unlock verified then cleaned on test profile.

## 2026-09-03 — README refresh
- Two-audience README (`1ee877b`): play link, Heat/Pact/unlock, PWA, dev setup; aligned with AGENTS and index meta.

## 2026-09-03 — PWA app-shell offline
- Precache app-shell (not network-first): `manifest.webmanifest` + module `sw.js` + `src/pwa/shell.js`. Three.js is cached; `og.png` is not. Relative `./` scope covers Pages `/fusegrid/` and loopback. First visit still needs network.

## 2026-09-03 — Share card sells Heat + 3D
- Regenerated `og.png` 1200×630 (3D jungle board + CORE / PLUS / MAX chips). `index.html` / README copy match Heat, Pact, rooms 6–8. Favicon bomb mark kept — still crisp in the same navy / gold / teal family.

## 2026-09-03 — Docs inherit Heat / Pact / rooms / attract
- AGENTS/README now match CORE/PLUS/MAX, attract CORE+pact=0, `isFinale` overlay, `boomOf`, `pactstore.js`, `scoreEntry`/`noteWorldEdge`, and the parked list.

## 2026-09-03 — Headed QA pass (rooms + persist)
- L6/L7 overlay advances (same `isFinale` as sim); LEVEL SELECT 1–8 after CLEAR; rooms 6–8 looks/themes/booms; #gl 1200×1040 at dpr=2; attract CORE/pact=0; MAX persist writes heat `t`.

## 2026-09-03 — Attract demobot hunger pass
- Same intent FSM: combat cubes (FLAME/BOMB/KICK) hunt beyond Manhattan 8; reachable foes beat spawn-brick nibble; hunger wander aims at a blocked mid-board foe. Soft hearts stay capped. Headed 20s re-watch still useful.

## 2026-09-02 — Attract demobot plays like a casual
- Intent FSM + sticky heading in `src/app/demobot.js`: plant-then-leave (R16), no fuse-hug, floor cubes before far foes, brick plants only if useful+escape. Attract still CORE/pact=0. Headed 20s watch still needed.

## 2026-09-02 — SAND / VOID / CROWN boom tints
- Rooms 6–8 boom now uses `boomOf` (`src/audio/boom.js`): sand dry kick 69, void swallowed kick 40, crown metallic kick 82. Ice/water/arena numbers unchanged; menu/intro/jungle/factory stay default. Music STEP/bass untouched.

## 2026-09-02 — Thermo-nuclear judo (eight blockers)
- One `isFinale`/`ROOM_LOCK`/`ROOM_MAX` (L6/L7 overlay no longer says CLEAR). `scoreEntry` + boolean `noteWorldEdge`. Pact persist left core. Heat/pact tables + `applyPact`. Track tables peeled. Tests split under 1k.

## 2026-09-02 — SAND / VOID / CROWN chiptune themes
- Rooms 6–8 cue sand / void / crown. Distinct STEP and bass roots. Boom SFX stay on the five-theme tints.

## 2026-09-02 — Headed cam/light QA rooms 1–8
- REAL 3D and CLASSIC 2D: frozen rig {az:0,el:0.419,dist:1000} and frozen lights hold. #gl is 1200×1040 at dpr=2. VOID is dark on purpose. No per-biome retune.

## 2026-09-02 — SAND / VOID / CROWN for rooms 6–8
- Appended three palettes. Rooms 1–5 unchanged. Music still wraps jungle→arena. Draw-call 186 stays.

## 2026-09-02 — Score × heat at persist
- Board stores CORE ×1 / PLUS ×2 / MAX ×3 via `heatScore`. Live `world.score` and HUD stay raw. M-quit / Menu / finale now write heat `t` so MAX cannot land as CORE.

## 2026-09-02 — Extra rooms 6–8 after first CLEAR
- Same unlock as Pact. Rooms 6–8 reuse biomes (wrap) and add fast/chaser/rocket on top of the room-5 roster. L5 still finales; L6–7 advance; L8 finales.

## 2026-09-02 — Pact afterburner (LAST / BARE / THIN / SHRINK)
- After first room-5 CLEAR, LEVEL SELECT `1–4` toggles spice that Heat does not set. Attract and locked START stay pact 0. CORE with no toggles stays v6.

## 2026-09-02 — Leftover closeout (shake pins + attract CORE)
- three.test now pins live SHAKE_3D_K 0.09 and boom shake +0.22. Attract demo stays CORE even if shell heat is MAX. 3D bomb pulse pin uses world.fuse.

## 2026-09-02 — Heat grades CORE / PLUS / MAX
- LEVEL SELECT gained a second chip rail. CORE is today’s v6 path bit-identical. PLUS/MAX introduce the next foe sooner and tighten fuse / floor cubes / chase. Attract stays CORE. Scores tag `t` and fold the mark into LEVEL. Audio wrapper now forwards `move(dir,axis)` so ↑/↓ actually change heat in the browser. Audio wrapper now forwards `move(dir,axis)` so ↑/↓ actually change heat in the browser.

## 2026-09-02 — ENEMIES field-guide menu
- MENU gained ENEMIES (SCREEN.ENEMIES=9, after ITEMS): live 2D bodies + name/help/rooms for all 6 FOES. ITEMS stays the cube catalog. HOW TO points at both pages.

## 2026-09-02 — Layered production SFX
- Game cues are stacks now (pitch envelope + noise + filter), not one beep. Kill rises, hurt falls; boom tints with the biome track; unbury `reveal` finally plays. UI timer ABI (jingle 0/120/240/360/480, sel 70ms) unchanged.

## 2026-09-02 — Per-biome chiptune tracks
- Music is a track table now: intro bed, menu AABB identity, and one theme per biome (tempo + roots + voicing). GAME/ATTRACT follow the room; other shell screens stay on menu. Default pump without setTrack is still AABB.

## 2026-09-02 — Menu shell fit + selection
- Padded inset on every overlay; selected row is a rail + drawn caret, not a flush bar. HIGH SCORES derives row pitch from the inner body so all 10 runs and ESC BACK stay inside the plate at 520 and 352.

## 2026-09-02 — Arcade cabinet menu chrome
- Shared plate / kicker / icon-well chrome on MENU, LEVEL, HOW TO, ITEMS, SCORES. ITEMS is now a two-column card catalog (teal keep-rail on permanent pickups). Layout ABI unchanged.

## 2026-09-02 — ITEMS menu + walkable pickups
- MENU has ITEMS (SCREEN.ITEMS=8): icon + name + help for all 12 powers. Brick pickups stay buried until the brick breaks; loadLevel also drops floor cubes on EMPTY tiles so you can walk them up. Re-entry/apply behavior of each power is unchanged.

## 2026-09-02 — Plant-and-leave in 1-tile corridors
- Off-center plant was a soft-lock: bomb zone rejected recentering and the pillar AABB ate the held axis. On-tile bombs now skip solidity; `moveEntity` lane-slides toward tile center so hold-escape works (R16/b/c). Re-entry after leaving the tile is still blocked.

## 2026-09-02 — Feel + pillars + biome atlas + finale
- Tracks A/B/C landed: stacked boom shake/flash + kick/throw/remote SFX; interior WALL pillars, floor pickups, staged roster, L5 FIRE → menu; per-level 3D atlas/fog and 2D teal hero / CLEAR copy. Replay baseline v6. Attract bot now stays out of a live blast pocket. `three.test` still pins shake 0.06/0.3 (live 0.09/0.22); file edits were gated.

## 2026-09-02 — Menu SOURCE + share-card review
- MENU has SOURCE (opens github.com/HMarzban/fusegrid); toolbar Source link; footer shows the repo path. Share preview fails on the no-slash Pages 301 (no OG tags); share `…/fusegrid/` with the trailing slash.

## 2026-09-01 — SEO + social preview
- Pages now has title/description/canonical, Open Graph + Twitter large card, og.png 1200x630, apple-touch-icon, robots.txt, sitemap. Repo README shows the same card.

## 2026-09-01 — 3D camera frames the full board
- Default rig dist 800→1000. sizeCanvases no longer assigns #gl width/height (Retina 2× buffer was cropped to the bottom-left quarter). START resets the 3D rig; wrapper re-syncs setSize when the buffer drifts.

## 2026-09-01 — GitHub Pages + public basics + DIRS4
- Static Pages deploy (relative favicon, .nojekyll, Actions workflow). MIT LICENSE, README play link, FUSE/GRID spec copy. Enemies wander DIRS4 (COULD 6); replay baseline v5. Local ancestor branches deleted after push.

## 2026-09-01 — Public rename to Fusegrid
- GitHub is https://github.com/HMarzban/fusegrid (public). In-game wordmark is FUSE/GRID; title, README, package name, and serve log match. Local folder stays rollblock.

## 2026-09-01 — Leftovers + five-biome looks
- COULD 7: survive no longer wipes bombs/blades. 2D boot no longer statically imports Three (loadRenderer3D + opts.createRenderer3D). applySnapshot removed. Favicon.svg. Five biomes JUNGLE/ICE/FACTORY/WATER/ARENA (no L5 wrap). Iso stays museum via ?render=iso.

## 2026-09-01 — Headed play-verify + Restart label
- Closed the 3D follow-up: S2 iFrames guard so live-sim detonation measures blades (three.test THREE OK); headed 3D HUD/orbit/overlay/RENDER toggle/own-bomb hurt all checked. Restart-from-PAUSE now resets the Pause label (F3 assert). Battery 15/15. Still no commit.

## 2026-09-01 — Production hardening campaign (prod/hardening)
- HoE staff review locked findings, then a file-owned fleet: sim rules v4 (center-tile blast, no abort-on-death chain, checkContact alive, place via world.fireEdge, throw refuses enemy tile), 3D shared rig + DOM HUD + overlay clear, applySnapshot pid quarantine, AGENTS.md truth, camera spec amended to polar el 0.419 / dist 800. Replay baseline **v4**. Not internet MP; serve.js stays loopback. `ui/bookshelf/` quarantined (not this game). Left: headed play-verify of toggle/HUD/orbit.

## 2026-08-26 — Enemy identity 3D shipped (b4f2c8a RED + eeb38d6 GREEN)
- Spec 2026-08-25-enemy-identity §2/§4/§5/§6 executed: rocket upright 3-sided pyramid (no pre-rot) + pad + flame swap @10Hz; boomerang FLAT C-torus arc 4.7 + hub/bead + slot yaw override (t*10)%2π; trio Phong60 w/ baked scales (chaser tall+crest/snout, fast low+MERGED fins(72idx)+trail .30) + walker feet stomp; stationary #2a1030 shell + core cube + slit-plane z r*1.16 + breathe; big tilted face planes via new GF/EYR tables; boldened eyes + slit painter. GD/EH/EYT/GF/EYR exported (§6 probes required). Δdraws=0 → 186 ≤500 across 6-type mix. Battery 15/15, three.test 189/0. Interpretations in task-report-enemy-id.md (walker-only stomp; core fully enclosed at literal sizes). Left: §7 browser screenshot smoke.

## 2026-08-26 — Enemy-identity 3D spec written (docs/superpowers/specs/2026-08-25-enemy-identity.md, read-only session)
- Root insight: 2D view is TOP-DOWN ⇒ sprite = from-above footprint; spec mandates footprint-first redesign (rocket = upright 3-sided pyramid nose-up — old cone's rotateX(π/2) was the side-lying bug; boomerang = FLAT C-torus + white hub, spin yaw t*10 overrides facing). Blob trio: Phong gloss + big tilted face plane + per-type baked scale (chaser tall+crest, fast low+fins/trail); stationary keeps square + slit. Children contract (length===3, eyes last) preserved via geometry merge trick; Δdraws=0 (186≤500). Scope when implemented: entities.js/textures.js/three.test.mjs only.

## 2026-08-26 — RULES OVERHAUL complete: bombs tile-solid, sliding kick, chaser BFS routes bombs — DETERMINISM BASELINE v3
- Canon per spec 2026-08-25-rules-audit §3 MUSTs: bombs are tile-solid for player+non-pass enemies with own-tile walk-off/no-re-entry exemption (board.js bombsBlock); kick = real slider replacing brick-break (launchSlider/advanceSlider, KICK_SPEED=4.5, halts on WALL/BRICK/bomb/enemy, fuse ticks mid-slide, chain intact); bfsNext(blocked) + chaser/fast route around live bomb tiles (pass types exempt) + corner-escape rescan when a bomb zone bounces a lane-transition step (pixel-vs-tile deadlock). RED→GREEN R1–R9 in sim.test.mjs (R8b/R9 discriminated pre-fix HEAD; R8b needed the escape-rescan beyond naive BFS gating). Battery 15/15. REPLAY BASELINE v3: validity begins at 59e06c0 — rng draw sequence may shift (escape rescan consumes extra draws on bomb-zone bounces).
- Commits d12b0bc + 8ff0476 (prior session, legs 1–2), 59e06c0 (leg 3 this session), memory commit follows. SHOULD 5 / COULD 6–7 skipped by scope; report .superpowers/sdd/2026-08-25-polish/task-report-rules.md.

## 2026-08-25 — 3D ELEMENTS REDESIGN shipped (d1bb0cb): pickups, glossy bombs, silhouettes, flame crosses
- Spec 2026-08-25-elements-redesign §2–§5 executed RED→GREEN (24 fails→173 checks OK): items = capsule-box pickups w/ all-face glyph textures + additive POWER rings; bomb = Phong #15181f shininess110 sphere (highlight child deleted) + variant base TORUS hues (normal hidden, body never recolored); enemies get eye strips children[2] + chaser visor wedge/fast swept fins/rocket ID tip; player = helmeted-hero stack (sphere body+π/2 dome+open visor band+antenna); blasts = crossedQuads(8v/12idx) Basic additive fire-ramp (emissive purged); 4 new texture painters ×12/×6/visor/fire, atlas `_shared=true`. Fat-world formula 138→186 ≤500. Scope=3 files only; battery 15/15. Interpretations in task-report-elements.md (rocket=[fin,ID-tipCone], item slot origin at floor). Left: manual browser smoke of §6 acceptance 1–7.

## 2026-08-25 — Camera overhaul + toolbar Menu button (5de5b0d..24c1295)
- Fixed full-board rig DEF={az0,el1.152,dist700}, DIST band 500–880, flythrough re-keyed (BASE 700, az 0, el 1.28→1.152 snap); free-orbit demoted behind ?orbit=1 via NEW mountOrbitCtl getDolly gate (wheel/pinch stay always-on, right-drag opt-in), g.rig getter added; btnMenu after Restart = GAME-gated KeyM-quit clone (persist-if->0, quitToMenu("PAUSE"), label reset, blur). RED 20 fails → GREEN, battery 15/15, core/net untouched. Left: manual browser smoke of §5 checklist. Report: .superpowers/sdd/2026-08-25-polish/task-report-cam-menu.md

## 2026-08-24 — 3D overlay fix (83561ff): WIN/LOSE/PAUSE now paint the 2D layer in kind 3d
- wrapper.js render tail: state-gated drawOverlay(ovCtx,world) (defaults already 600×520 classic space) + updateHud(hud,world) routed like kind 2d ({hud:false} suppresses); chips stay opt-in and draw after the veil; MENU excluded (shell owns menus). RED→GREEN: new S5.overlay section in three.test.mjs (8 checks), battery 15/15.

## 2026-08-24 — REAL-3D S4 art pass shipped (bc2d554..550991d): hero/enemy silhouettes, layered blasts + flash pool, HUD chips, checker+trim
- User critique "elements not game-like" fixed: player = 7-mesh hero (capsule/helmet-sphere/atlas-textured visor/antenna/boots), enemies keep S2.F base-geometry contract + 2 ref-swapped detail children per type (feet/nose/trail/turret/wings/fins) w/ per-type bob, boomerang wing pinwheel; bombs gain highlight blob + metal cap (children[0]/[2] indices preserved); blades = outer(exact prior ttl contract, biome.brickHi-tinted emissive)+white-hot additive core w/ spawn overshoot pop 0.88→0.55sc; FLASH_CAP=3 pooled PointLights ride blast centers; drawHudChips (hearts ≤6 + "+n", BOMB/FLAME icon chips, menudraw palette) opt-in ONLY via main's GAME-screen {hud:true} — wrapper clears overlay first, menus byte-untouched; scene adds checker InstancedMesh (instanceColor floor0/floor1) over kept plane + 4 wallHi trim rails. RED raced clean (102 prior green), GREEN 136 checks incl. exact 138-call fat-world budget ≤500; battery 15/15; core/net/input diff=0. Test-side fixes: recorder gradient chain, HUD_STUB quadraticCurveTo, compose/decompose scale tol 1e-6. Left: browser smoke (art feel, DPR crispness); 3D PAUSE/WIN overlay still absent (pre-existing). Report: .superpowers/sdd/2026-08-24-real3d/task-report-S4.md

## 2026-08-24 — REAL-3D S3 shipped (1119bc7): fx particles, intro flythrough, attract-3D, perf gate
- three/particles.js PART_CAP=384 Points pool consumes getFx() store (drawRange-culled, additive ttl-dim vertex colors, confetti sky-rain rule), hooked at wrapper scene ROOT so rebuilds never orphan bursts; entities.js blades got emissive pulse curve (.8→1.0→.36 off freshest sc) + spark now Basic glow w/ exact 2D flicker parity 1±.23sin(30t); three/flythrough.js pure introCam(subT) dist=560/zoom endpoints snap to rig defaults, main passes {intro:subT} only for INTRO∧3d; shake proven end-to-end deterministically (Math.random stub .75 → ±1.275px → quaternion shift); scene.countDrawCalls + non-enumerable wrapper._dbg keep surface keys frozen — fat world = 79 calls ≤500, DPR_MAX=2. RED raced process.exit until top-level await sec(); test-side bugs (stride-3 color index, root-vs-traverse find, confetti Z=−270) fixed on GREEN pass. 102 checks, battery 15/15, core/net/input diff=0. Left: browser smoke (flythrough feel, DPR, mobile fps). Report: .superpowers/sdd/2026-08-24-real3d/task-report-S3.md

## 2026-08-24 — REAL-3D S2 shipped (0fc3a05): entity/item/bomb/blade pools + zero-asset textures
- three/entities.js createPools: visibility-toggled fixed slots player1/enemies16/bombs8/items32 + blades ONE InstancedMesh cap528 (16×33 tiles; deviation from 16-groups documented — arms-only parity w/ 2D drawBlades, ttl scale fade); per-type geos (sphere/box/torus/cone tip+Z), identity colors imported from core spawnEnemy table (no core edit); bomb pulse/tint/spark-parity mirror drawBombBody exactly; update() zero-alloc (scratch mats, ref-swap, `_shared` flag exempts pooled resources from disposeGroup). three/textures.js atlasSources/buildAtlas: 64² captures of existing sprites fns via new captureSprite helper (sprites otherwise untouched), NearestFilter+sRGB, headless⇒null⇒flat Lambert fallbacks. wrapper lazy getAtlas→buildScene(world,atlas). RED(module-missing)→GREEN 74/74 checks (was 36) incl. live-sim detonation count-vs-blast + fs grep gate core/net/input three-free; mutation spot-check bites. Battery 15/15 files. Left: browser smoke (pickup/detonation/texture crispness). Report: .superpowers/sdd/2026-08-24-real3d/task-report-S2.md

## 2026-08-24 — REAL-3D S1 skeleton shipped (1b53a41..aabd953): vendored three + dual-canvas tri-state
- src/render/three/{scene,materials,lights,camrig,wrapper}: buildScene instanced walls/bricks (X=x−300/Z=y−260, in-place rescan, level-rebuild flag), frozen §6 light rig, orbit/dolly/reset + GAME-gated mount, createRenderer3D {canvas,overlay,ctx,render,consumeEvents,getShake} with headless stub mode; main.js tri-state 2d/3d/iso (?render=3d|iso), RENDER toggle REAL 3D⇄CLASSIC 2D, #gl under #c, flyover+camTransform gated to non-3d, KeyR resets orbit; renderer.js "iso" alias. Drive-by fix: g.renderer now a live getter (was boot-time stale copy). RED→GREEN 36 checks (tests/three.test.mjs), battery 15/15 green, sim/net/input/core diff=0. Left: manual browser smoke (shadows/orbit/iso-parity/DPR). Report: .superpowers/sdd/2026-08-24-real3d/task-report-S1.md

## 2026-08-24 — Camera control shipped (bccb0b4..3cbdcef): GAME-only pan/zoom/reset
- cameraCtl.js pure math (anchor pan1=d−(z1/z0)(d−pan0), clampAxis degenerate→0, wheel exp(−ΔY·.0015), pinch ratio, transform triple); input.js button≠0 fire-guard; main.js cam closure + mountCameraCtl (GAME-gated, getKind follows RENDER toggle), KeyR/onStart reset, outer transform in GAME branch only — renderer/core/net diff 0. Battery 14/14 files, camera 37/0, headless +12 checks (f/g/h incl. exact drag deltas + MENU-frame triple-absence). Left: manual browser/device smokes per spec §5. Report: task-report-CAM.md.

## 2026-08-24 — V1.1 polish pack (82a0f00..1f465aa): music B-section, __audio gate, toggle-flash, canvasEl warn, serve test fixes
- Music loop now AABB (MUSIC_PATTERN_B D–C–Bb–G + MUSIC_SECTIONS, pump selects per stepN — tests derive t0 from first start since unlock anchor may clamp once); menuapp togT stamp (-1 sentinel, cleared at every subT reset) drives drawMenu's 120ms accent glow on the selected value row; distinct opts.canvasEl now console.warns once (C1 swallow stays render-canvas-bound by design); serve.test dropped decoy dir + awaits child exit before rmSync; fx.js header documents single-renderer singleton. RED→GREEN areas 1/3/4; battery 13/13 green. Left: manual ?debug=1/__audio, flash-feel, A/B listen smokes. Report: .superpowers/sdd/2026-08-23-campaigns/task-report-POLISH.md

## 2026-08-24 — Micro-polish: unlock-gated jingle, attract-exit fade pinned, dead imports
- P1: boot uiJingle now defers to first gesture via fireJingle latch on unlockOnce (suspended ctx froze all 5 oscillators into a chord-blob); I1 test re-pointed to deferral + new window-stub block proves once-only post-unlock firing; drive-by: main.js debug hook `location` guard aligned with file's own typeof pattern (latent headless crash). P2: ATTRACT→MENU veil already rode _push(MENU) subT reset — probe+regression test pinned (k≈0.94 frame-1, settles ≤0.73), zero prod change. P4: demobot tileOf/solidAt imports removed (bfsNext kept) + fs grep gate. Headless 59→66 checks; battery 13 files green.

## 2026-08-24 — Music+attract fix round F1-F3 (ea3b42d): clamp, duck-aware unmute, GAME-gated toolbar
- audio.js pump catch-up clamp (hidden-tab gap → ONE step @now+0.05, was 61-step burst) + toggle() restores ducked?MUS_DUCK:MUS_BASE (old "unmute→0.5" test superseded); main.js btnPause/btnRestart onclick early-return unless GAME (restart was wiping live backdrop during ATTRACT; in-GAME behavior byte-identical). RED→GREEN: music 39/0, headless +6 checks, battery 13 files green. Report: task-report-D.md fix section (.superpowers gitignored, on disk).

## 2026-08-23 — Music + attract mode shipped (34b3ca8..598c903): chiptune loop, demobot, idle demo
- audio.js: MUSIC_PATTERN (entries carry `s` — spec snippet dropped it; also fixed its paren typo), frame-pumped lookahead on ctx.currentTime only, duck 0.5↔0.16 @.35/.6s, toggle=single mute gate; demobot.js per §2 (flee BFS must walk THROUGH danger tiles or corner bots freeze; state setter added for purity test); menuapp ATTRACT=7 + IDLE_T=10 + guards; main demo harness seed 20260823 cycles 1..3 cap 20s, {hud:false}, window-once unlock, #stage exits but toolbar doesn't; EXTRA idleT resets in startRun/_toMenuInner else stale ≥10s idle instantly re-enters ATTRACT after M-quit. Music 37/0, demobot 21/0, menuapp 108/0, headless +16, battery 13 files green. Report: .superpowers/sdd/2026-08-23-campaigns/task-report-D.md. Left: manual browser/device smoke (§6 MANUAL list).

## 2026-08-23 — Netcode fix round F1-F4 (76bfd8a): seq-first, neutral LEAVE, pinned codes, fail-closed decode
- F1: onInput classifies dup/stale/gap BEFORE tick floor; fresh seq consumes ledger slot even when payload dropped (below-floor drop no longer freezes lastSeq → recovery traffic can't fabricate bad_seq halts). F2: LEAVE is neutral — hurtPlayer removed, survivor keeps lives/score. F3: ERROR_CODES pinned {bad_seq,bad_seed,bad_shape,unknown_pid}, makeError coerces, bad_host/bad_tick folded to bad_shape, WELCOME invalid → bad_seed+close. F4: decode never throws (null), capsOk §4.3 ≤64 deep cap, WebSocketTransport._onmessage guarded boundary + _validate hook (v2). Spec A1-A3 (+§2.3 corrected to neutral). RED→GREEN: net_lockstep 59/0, protocol 15/0, full battery 11/11.

## 2026-08-23 — Netcode lockstep v1 shipped (d3e1bcc..1d2f325): gates, two-world proof, ?net=local
- protocol.js WELCOME/PAUSE/RESUME/RESTART/MENU/ERROR + validateInput/validateWelcome fail-closed
  gates (seq dup/stale/gap classes, u31 seed, DELAY=2 window; windowLen=Infinity buffer mode for
  catch-up); new net/lockstep.js (stall/no-advance, stallEvent@30, pid-ascending consume, LEAVE→
  hurtPlayer+leave event+unknown_pid halt, host RPCs at tick alignment); LocalTransport.dropped;
  main.js ?net=local dual-peer harness (flag-off byte-identical). Proof: sameWorld replica +
  meta-paced settle barrier, 52 checks incl. lag/blackout/dup/gap/leave/pause cases. ⚠️ Spec file
  2026-08-23-netcode-lockstep-design.md MISSING from repo despite f5d4269 message claiming it —
  implemented from task brief; report: .superpowers/sdd/2026-08-23-campaigns/task-report-C.md.

## 2026-08-23 — Renderer v2 independent review (fd18448..ea6b250): Approved, §3 deviation ACCEPTED
- Independently reconstructed depth-0 counterexample (board.js:15 border wall
  @(0,0)=BLOCK@d0 vs player shadow @d≈2.x ⇒ global lastShadow<firstBlock chain
  impossible under depth-primary byDepth; shadow-special comparator proven
  non-transitive via 3-cycle block<d22/entity>d25/shadow) → per-slot invariant
  is the correct spec reading; §3/§6 need one-line amendment. Hand-recomputed
  diamondTransform {a:.5,b:.25,c:-.5,d:.25,284,124} ✓; tiers/literals/camera-
  frozen/bakeAtlas-guard/additive-sprites all verified; battery re-run green.
  Flagged: spec §5.4 "sprites.js NO CHANGE" self-contradicts §2 (BAKED not
  exported — accessor unavoidable); BIOMES elements shallow-frozen only.

## 2026-08-23 — Renderer v2 polish shipped: textured diamond tops + shadow tier + biome heights
- scene3d: TIERS renumber (F0/S1/E2/B3/L4), diamondTransform (spec §2 vector
  pinned), heightFor (BIOMES hWall/hBrick ?? PROJ; J24/14 I30/18 F18/10 A26/15),
  blockPainter affine-textured tops w/ per-call smoothing, lazy 64px radial
  shadow disc (blocks .22 bbox-inscribed, entities .26 rx*0.5 squash); renderer
  bakeAtlas unconditional + noop ctx transform; sprites additive bakedTile()
  accessor only (2D draw fns untouched); camera.js byte-frozen. RED→GREEN r3d
  67/0, full battery green. DEVIATION (documented in test #16): spec §3's
  GLOBAL shadow-band chain is unsatisfiable with "byDepth untouched" +
  "shadow.depth=caster depth" + v1 depth-interleaved occlusion (depth-0 border
  wall vs spawn entity) → shadows ride caster depth slot (floor<shadow<upper
  per slot pinned instead); far-behind fringes = accepted stylization.

## 2026-08-23 — Touch controls independent review (fd18448): Approved, spec ✅ §1-§7
- Verified vs spec+report+diff: routing purity grep-clean (setIntent/padFire
  only; input.js strictly +3, keyboard byte-identical), pid bookkeeping sound
  (up/cancel/lostpointercapture idempotent), C1 intact (main.js:135 swallow is
  pre-existing), GAME-gate survives M-quit/LOSE/WIN both ways, [hidden] not
  overridden by author CSS, scope = 5 files no core/net/ui. Re-ran touch 39/0 +
  full battery green. Minors: capture-fail stuck-axis on ancient WebViews,
  same-pid dual-claim API edge, move-through-dead-center untested. Cannot
  verify: real-device manual list (latency/safe-area/ghost-click/fit).

## 2026-08-23 — Touch controls shipped (fd18448): virtual pad via Input pipeline
- src/touch.js (hasTouch/PadMapper/mountTouch; per-control pid claim, 4-way
  cross zones w/ 20% dead center, setIntent/padFire-only routing, zero canvas
  listeners), input.padFire, main.js touch.update(GAME gate), index.html
  #touchpad skeleton+CSS. RED→GREEN: touch 39/0; full battery green (sim 29,
  menuapp 93, r3d 51…). Left open: real-device manual smoke (latency/safe-area/
  iOS ghost-click) per spec §6 MANUAL list.

## 2026-08-23 — Menu/intro FINAL FIX WAVE (C1/I1/I2/I3) — all four fixed, 9/9 green
- One commit: pointer single-fire (non-GAME pointerdown swallows Input's fire
  latch; _attach now registers el listeners headless so C1 is testable), cue
  sheet live via main.js app-method wrappers (move/back/confirm/tog + boot
  jingle), onPause gated to GAME (ghost pause dead), keydown repeats filtered
  before dispatch. menuapp 93/0, headless +15 checks; core/net/ui untouched.

## 2026-08-23 — Menu/intro FINAL whole-feature gate: NOT-READY (C1/I1/I2/I3)
- Proven at HEAD: pointer confirm double-fires (direct call + fire-latch rising
  edge) → intro click-skip auto-starts run, RENDER/SOUND clicks net no-op,
  subscreens bounce; ui* cue sheet has ZERO callers (jingle never fires, §0.4);
  Esc/P/btnPause outside GAME flip hidden world→PAUSE (ghost overlay behind
  menus); OS key-repeat unfiltered breaks AC6 cadence in browsers. AC table
  11✓/2✗; six deferred minors re-triaged DEFER. Fix list + repro recipe in
  session log; core/ still untouched, suites 9/9 green.

## 2026-08-23 — Menu shell fix round 2 (4aeaa3b): intro natural end
- main loop now auto-calls app.skip() (machine's own transition) when
  screen===INTRO && subT>=INTRO_DUR — spec §1 t≥DUR + §9.1; fade path shared
  with user skip. Headless 14→15 (330 frames no-key → MENU). All green.

## 2026-08-23 — Menu T5/T6 fix round 1 (2062af8): MENU logo + skip fade
- F1: drawShell MENU branch now translates/scales to L.logoCy/L.logoScale and
  reuses scenes.drawLogo(c,world.time,0,0). F2: drawFade wired — extra veil
  k=1-subT/0.25 over first 0.25s of MENU entry (covers skip + natural end).
  Headless 11→14 via recording-proxy canvas (fillText/fillStyle spy). All green.

## 2026-08-23 — Menu/intro T5+T6 independent review (954208e..319f217)
- T6 Approved/spec✅ (all sub-edits verified, core diff=0, battery green; KeyM-wrapper +
  PLAY-repoint + last==null fix judged sound). T5 Needs-fixes/spec❌: MENU screen never
  draws the §2 logo (drawShell MENU branch = dim+items only); minors: drawFade unwired
  (no skip fade), push/pop+toggle-flash absent, veil ramp [1.40,2.80] vs spec-text
  [1.40,4.20] (pre-existing T2, byte-consistent dup).

## 2026-08-23 — Menu/intro T5+T6 executed (menudraw layer + main.js shell; f0c34b6..319f217)
- `f0c34b6`: src/render/menudraw.js (layout frozen, 8 draw fns, local easing dup,
  mono-advance estimate) + r3d layout/smoke checks both sizes (51/0). `319f217`:
  main.js shell wiring — app/onStart, PLAY-frozen backdrop, INTRO flyover
  transform (introPhase fractions), per-kind renderer cache + live toggle resize,
  onUiKey M-quit persist, frame-latched noteWorldEdge LOSE record, __GAME__
  app/state/begin re-point; headless 2→11. Fixed latent `if(!last)` t=0 bug.
  Left: manual browser smoke (visuals/audio/skip/3d flyover).

## 2026-08-23 — Action fixes: remote edge-latch, button blur, hint copy (18c2412..3c68ac2)
- Q/remote was latching (no KeyQ keyup) and level-triggered in sim; fixed with
  world.remoteEdge beside fireEdge (same alive-gated discipline, not reset in
  loadLevel — matches fireEdge). RED 27/2→GREEN 29/0; all suites green.
  btnPause/Sound/Restart blur after click; hint marks throw/remote/kick as
  power-gated. Left: manual smoke (button focus+Space, Q feel); ui/ untracked.

## 2026-08-23 — Debt sweep executed (6 parked findings, 852a9c9..c30f377)
- One commit per area: sameWorld full-field comparator; input pointercancel/
  pointerleave + strict document guard + public-getter tests; serve.js root→404
  (GET / still serves index) + single normalize; renderer strict kind + BIOMES-
  length bake + spec fx.js:73 ref; r3d split wall/brick tier-2 counts + blade
  translate exactly-once; runSteps fireEdge functional. All suites green.
  Report: task-report-debt-sweep.md. Left: touch-device manual smoke.

## 2026-08-23 — T21+T22 executed (dual-kind render smoke + P5 dead-code sweep; P4/P5 shipped)
- `289ba27`: r3d #11 renders MENU world via createRenderer kind:"2d"+"3d" on Proxy-stub
  canvas (spec §6 step 7), 31/31. Sweep commit: deleted POWER_BY_TYPE, audio.prime/isMuted,
  transport MSG re-export+import, world.lastBlades, unused imports (sim isBrick/solidAt;
  enemies key/clamp/aabb/DIRS4-import; board clamp), main.js dup imports; biomeIndex
  %4→%BIOMES.length; __GAME__ gated behind opts.debug||?debug=1 (browser_integration passes
  {debug:true}). All suites green; kept net/, rng accessors, BIOMES[].name, dual paint path.
  Left open: manual npm-start browser smoke (sound toggle/?debug=1); ui/bookshelf untouched.

## 2026-08-23 — T19+T20 executed (?render=3d wiring + parameterized overlays; blade billboard pre-work)
- `7b602a0`: main.js ?render=3d → PROJ backing store + kind:"3d"; renderer 3D
  branch live. Controller pre-work done RED→GREEN: drawBladeBody now
  translate-free (translate in 2D wrapper), scene3d blades billboard at
  project(tx+.5,ty+.5) — new r3d check #10 proves (284,98). `2b75e97`:
  drawOverlay/drawLogo parameterized (2D-preserving defaults), 3D epilogue
  centers overlay at (304,188). All suites green per commit. Left: step-7
  dual-kind smoke test; browser visual check. Report: task-report-t19-t20.md

## 2026-08-23 — T18 executed (scene3d painter list + shade/background + step-4 tests)
- `994923d`: buildPainters/byDepth/shade/draw3dBackground per §4.3/§4.4; blade painter
  calls drawBladeBody with NO pre-translate (self-translating body) — but body still
  lands at flat 2D coords, so projected-position mismatch deferred to steps 5–7.
  r3d suite 28/28 (counts, liveness exclusions, equal-depth occlusion, shade), full
  suite green. Report: task-report-t18.md

## 2026-08-23 — T17 independent diff review: PASS with one forward-compat flag
- Verified exhaustively (normalized line-multiset + per-body extraction vs 0f028d7):
  bodies verbatim moves, only wrapper scaffolding added; exports/scope/tests clean.
  Flag for steps 4–5: drawBladeBody self-translates to absolute tile coords (not
  translate-free like the other four) — scene3d must not pre-translate or blades
  render far off-position; step-7 no-throw smoke would NOT catch it.

## 2026-08-23 — T17 executed (draw*Body extraction; 2D wrappers behavior-preserving)
- `150661d`: five exported body fns in sprites.js (verbatim line moves, ws-insensitive
  diff verified); drawPlayer loops world.players internally (skip alive===false, §4.3
  round-5), renderer call site collapsed to one call; enemy bob + per-blade alpha=1 stay
  in wrappers. Suite green. Note: alive-filter edge (undefined) now draws — unreachable
  with sim's boolean alive. Report: task-report-t17.md

## 2026-08-23 — T15+T16 executed (renderer kind adapter; dimetric camera PROJ + tests)
- `5dc4871`: createRenderer takes opts.kind (default "2d", bakeAtlas gated), shared
  prologue/epilogue per §4.4, empty 3D stub; 2D default unchanged. `0f028d7`:
  src/render/r3d/camera.js (project + frozen PROJ derived from §4.5 formulas) and
  tests/r3d.test.mjs (10 checks: corner map, bbox/margins, monotonic sy, margin eqs).
  RED→GREEN observed; full suite 6/6 files green. Report: task-report-t15-t16.md

## 2026-08-23 — T9 fix-round-1 re-review: F1/F2 ADDRESSED, deviation upheld
- Independently reproduced RED at e84d3b9 (3 seeds unequal, DIRS8 mutated) and GREEN
  post-fix; probe counted 5–8 real AI-decision executions/seed in 1800 ticks. Residuals
  flagged non-blocking: sameWorld still omits player tx/ty/bombs/iFrames/shield, enemy
  cd/invulnT/speed, w.winTimer; harness self-proof label satisfied by bounce flips too.

## 2026-08-23 — T9 fix round 1: deepened harness caught shared-DIRS corruption
- `e.dir` aliasing frozen DIRS4/DIRS8 literals fixed by copying candidates on assignment (`e56eadf`, enemies.js:46).
  Correction: replay/outcome validity begins at e56eadf (contamination altered outcomes even in pristine runs); rng-draw-sequence stability from e84d3b9.

## 2026-08-23 — T9–T13 adversarial review (determinism purge)
- Verified: substitutions semantics-exact (21k-case fuzz, 0 diffs), purity gate clean (broad grep), commit scopes exact. Found: replay harness fires ZERO enemy-AI decisions in 300 ticks (cd init ≥4s) so T13's branch is unexercised; sameWorld omits player pos/bomb timers/item taken. Fix when touching harness next.

## 2026-08-23 — Determinism baseline v2
- Purged transcendentals from sim (squared distances, integer substeps, render-only bob),
  deduped enemy candidate dirs. Replay/outcome validity begins at e56eadf or later; rng-draw-sequence stability from e84d3b9.

## 2026-08-23 — T8 executed (balance tunables hoisted into frozen CFG; pure rename)
- `4329aec`: 12 new CFG keys (CONTACT_R…ENEMY_INVULN_T) replace scattered literals across
  sim/world/entities/enemies — values verbatim, killEnemy ternary left structural. All
  suites green. Note: `tests/determinism.test.mjs` from the plan doesn't exist; replay
  checks live in sim/protocol tests. Report: task-report-t8.md

## 2026-08-23 — T6+T7 executed (input latch/axes fixed; WIN state + win/lose events live)
- `4caea59`: pointer down/up split (_onFireDown/_onFireUp) + setIntent sign fix (routed
  through `input` getter — brief's literal `_held.` crashes fresh headless Input).
  `32e90de`: board clear → WIN+win event, fire edge advances with carry; hurtPlayer emits
  lose. Suite 22/22 sim, all green; browser smoke of overlays left to user.
  Report: .superpowers/sdd/2026-08-23-master-plan/task-report-t6-t7.md

## 2026-08-23 — T4+T5 executed (contact damage via hurtPlayer; chain by blast coverage)
- `041cdec`: checkContact now calls hurtPlayer (shield→hurt event, else life loss); `aad680b`:
  detonate() chains any bomb on a blast-covered tile (was Manhattan-1). Suite 14/14 sim green.
- Two brief-test drifts fixed minimally, documented: T4 needed e.home={x:1,y:1} (stationary
  branch teleports y to home each tick); T5 bomb-A radius 1→2 (radius-1 footprint can't reach
  distance 2 — wall case was vacuous). Auto-advance stayed green; no superseded markers.
  Report: .superpowers/sdd/2026-08-23-master-plan/task-report-t4-t5.md

## 2026-08-23 — T3 executed (serve.js hardened: traversal/400/ACAO/stream/loopback)
- `4893b30`: path.relative containment (kills string-prefix sibling leak — proven 200 TOPSECRET
  pre-fix via raw socket), decode-before-join → 400 on bad %, ACAO:* deleted, stream error→404,
  binds 127.0.0.1 + prints server.address().port for PORT=0. tests/serve.test.mjs: traversal
  checks MUST use raw sockets — fetch/curl collapse ../ AND %2e%2e client-side. Stream-error
  handler untested (race-prone); browser smoke left to user. Report:
  .superpowers/sdd/2026-08-23-master-plan/task-report-t3.md

## 2026-08-23 — T1+T2 executed (replay harness feeds inputs; headless import fixes)
- T1 `e12fbff`: runSteps now applies inputFn output (full map or bare intent); new
  check 1b proves rightward input moves x (was 60 vs 60 vacuous). T2 `84bfc3e`:
  main.js debug globals guarded by `typeof window` (`__GAME__` name kept), renderer
  null-canvas fallback is a real noop ctx — brief's list missed arcTo/bezierCurveTo/
  quadraticCurveTo, added them. Full suite 3/3 green. Report:
  .superpowers/sdd/2026-08-23-master-plan/task-report-t1-t2.md

## 2026-08-23 — Master plan finalized (planning team: architect + test strategist + design calls)
- Wrote docs/superpowers/plans/2026-08-23-master-plan.md: P0 harness/env fixes →
  P1 gameplay bugs → P2 determinism purge (ONE baseline-v2 bump) → P3 fx out of world →
  P4 dimetric renderer (spec steps 1–7) → P5 cleanup. Design calls locked: WIN-state
  routing for level clear (fanfare/confetti wired), audio.prime deleted not wired,
  debug globals gated behind ?debug=1, all balance tunables hoisted to CFG.
- Spec §5.1 (hypot stays) and step-4 fx source amended BY the plan tasks before P4 runs.

## 2026-08-23 — Five-agent codebase review (arch/code-quality/dead-code/tests/security)
- Ran 5 parallel review agents. Verified live bugs: enemy contact damage never calls
  `hurtPlayer` (enemies.js:75 only emits an event); determinism test harness discards its
  generated inputs (sim.test.mjs:17-18, replay tests are vacuous); pointer `pointerup`
  latches fire=true; chain detonation only chains distance-1 bombs (sim.js:170).
- serve.js prefix-match traversal gap (`startsWith(ROOT)` without sep) + `ACAO:*`.
- Open decisions left: wire-vs-delete fx "win" branch & audio.prime; gate debug globals;
  snapshot completeness vs lockstep-only netcode (applySnapshot fabricates enemy dynamics).

## 2026-08-16 — Initialized opencode for rollblock
- Added `opencode.json` (schema + `instructions` + `permission`) and `AGENTS.md`
   (architecture, commands, conventions).
- Established this episodic-memory convention; agents must append here after
  any non-trivial change.

## 2026-08-16 — git baseline commit
- `git init` + `.gitignore` (ignores `.DS_Store`, `node_modules/`, the two
  unreferenced ~5.6MB `Gemini_Generated_Image_*.jpeg` moodboard assets, logs/.env).
- Committed baseline `d3975af`: full deterministic single-player sim + procedural
  render + netcode seam, 16/16 tests passing. Not yet a remote/VCS-tracked branch.

## 2026-08-16 — 2D→3D direction-set (research team, 4 agents)
- Ran a parallel research team (engine landscape / determinism-netcode / architecture-preserving migration / scope-perf-assets). Consensus: "need a heavy engine" is the wrong instinct — the decoupled deterministic `src/core` makes 3D a *renderer* change; a heavy engine (Three/Babylon/WebGPU) buys zero determinism value and breaks the zero-dep + no-build invariants.
- DECISION (user): (1) keep zero-dependency — no Three.js, no build; (2) target option (b) **pseudo-3D dimetric** — tilt camera ~30°, extrude bricks/walls to depth-sorted blocks on Canvas-2D. Touches NO sim/protocol code; all 16 tests stay green. Deferred: option (c) full 3D arena (forces sim+protocol changes; big swing).
- Determinism rule locked: all spatial/visual math stays in the renderer; sim collision/kill/fuse stay keyed to fixed integers; camera is a render-only input stream, never fed to `step()`. Silent-killer noted: any sim float feeding a branch/count (e.g. `board.js:78` `Math.ceil(Math.hypot(...))`) is the ULP desync risk.
- Next: design the dimetric renderer (renderer adapter + camera view + depth-sort + faux extrude/shadow). Implementation gate held pending design approval.
## 2026-08-23 — Campaigns trio shipped on campaigns/touch-render-net
- A touch pad (fd18448, multitouch move+bomb via Input pipeline, 39 checks) · B renderer v2 (ea6b250, affine diamond tops + caster-slot shadows after spec-chain proven unsatisfiable, biome heights, 67 r3d) · C lockstep v1 (d3e1bcc..35b8572, seq-first windows, neutral LEAVE, pinned codes, fail-closed decode, two-world proof 59 checks; ?net=local). Specs committed incl restored netcode doc.
## 2026-08-24 — ENGINE DECISION REVERSAL: Path A vendored Three.js approved by user
- User judged dimetric 'not really 3D' and game elements 'not game-like'; explicitly approved vendored three.module.js (no npm, no build, MIT) + keep 2D fallback. Sim/protocol/tests untouched by design. Dimetric demotes to ?render=iso legacy. Branch campaign/real3d. This supersedes the 2026-08-16 zero-dep-renderer lock for the RENDER LAYER ONLY — sim purity invariants unchanged.
## 2026-08-25 — Black-screen 3D toggle bug root-caused + fixed (56c6db5)
- #c 2D context first-call-wins: boot 2D renderer claimed {alpha:false}; 3D overlay then inherited the OPAQUE context → clearRect composited black over #gl (toggle-path black screen; boot ?render=3d unaffected). Fix: main pre-claims #c ctx {alpha:true} before any renderer + regression tests (getContext order, live __GAME__.renderer — was a stale boot copy, now a getter). Repro'd+verified via Playwright (headed Chrome DPR2, WebKit DPR2): toggle→3D green, toggle-back→2D green.
## 2026-09-05 — R1: player redesigned after user rejection ("too silly / not mature enough")
- P1's SIGNAL RUNNER read as a WHITE EGG WITH A TEAL CAP at the live 28px size, in both renderers, while every gate stayed green — a fit box and an op-stream recorder structurally cannot see roundness, brightness or stubbiness. Three levers: TAPER (2D hull is a shouldered wedge with a neck step, a near-level shoulder ledge and a `±0.50r` waist, shedding 1.71× within half a radius; the lower third is two long dark legs, not the hull's base), VALUE (`PLAYER_HULL` `#dfe7f2` L0.90 → `#8d97ac` L0.59 — brightness WAS the cuteness; hex chosen from the 3D capture because 3D has no dark contour and value alone separates it from the floor), EDGE (cap → pointed crest wholly inside the helmet contour; sheen ellipse → two hard pauldron facets).
- 3D reshaped, never retyped: `SLOT_MESH.player` still 5, fat-world still 141, histogram unchanged (2 Box, 1 each Buffer/Lathe/Extrude). Tapered `TORSO_P`; yoke chips → canted asymmetric WEDGE pauldrons mirrored by negating x AND reversing point order (`ExtrudeGeometry` cap normals follow signed area); crown seg 6 → seg 5 `rotateY(PI/5)` because three.js lathes start a VERTEX at +Z and the visor needs a flat FACE. Hero is now `31.8×20.6×30.0` vs walker `29.0×26.5×27.5` — tallest, widest, and the only shouldered footprint.
- Five new gates, all RED on the P1 body: taper 1.06, value 0.90, stance 0.06r, 3D half-span 12.08 (< its own 13.6 collision radius), plan aspect 1.36. `PLAYER_HULL` is now exported from `sprites.js` and imported by `three/entities.js` so one hex feeds both renderers. Spec §2 rewritten + §3.R1 pin table; P3/P4 plans carry supersede notes. PWA v55.
- Iteration log worth keeping: overhanging crest wings = peaked cap; one diagonal from helmet to shoulder tip = cloak; seg-4 crown = box; symmetric flat yoke slabs = coat hanger; crown at the torso's own radius hides the chest (head must stay ~41% of the shoulder span).

## 2026-09-06 — R3 direction v2: soundtrack recomposed as arcade pop (wave A)
- User rejected the shipped score on a listen: it does not sound like the classic bomber-arcade game it is modelled on. The first reading of the spec made RESTS the maturity lever — mandatory breath bars, withheld tonics, a 64 BPM outlier, basslines specced "mostly tacet", `hat.length === 0` — and every one of those pins passed while the music failed the only gate that mattered. Recorded because the pin sheet was clean the whole time: a green suite is not an accepted direction.
- New identity: **bright, driving, hummable arcade pop on 3-4 voices; energy first, mood second; darkness from timbre and mode, never from tempo collapse or silence.** Three measurable consequences replaced the rest-based ones — `pulseGap <= 1` (longest cyclic run with no bass and no hat note, keyed off `P.LEN` so intro's 32 reads right), `barsWithLead`/`barsWithBass` full on every track, and occupancy bands that gained FLOORS as well as ceilings. "Constant pulse" resolved against the surviving "no track fills every step" rule as *maximum density short of full occupancy* — one deliberate unstruck step per loop (intro 31, menu 63, jungle 61, ice's step-6 pocket, factory 15).
- Motif keeps its contour (1-3-5-6-5) and loses its rhythm: three-step flash -> two, settle moves to step 5, steps 6-7 carry a pickup instead of a rest. `motifV2At` (offsets 0,1,2,3,5) added alongside v1 `motifAt`, which survives for the wave-B tracks. Hook pins are POSITIONAL (named bars) because the v2 figure is easier to satisfy by accident in a dense sixteenth texture. `AUG` and `INV` retired.
- Wave A shipped one commit per track in ladder-migration order — **intro .125 / menu .121 / jungle .117 / ice .129 / factory .114** — because the ladder pin quantifies over all ten and a track may only move into a vacant `STEP`: ice cannot take .129 until jungle leaves it (wave B: sand must vacate .139 before water takes it). Every commit green, PWA v72 -> v77.
- Per track: intro gained 16 bass notes and 15 hat ticks where it had 1 and 0; menu's tresillo became an ACCENT inside a five-hits-a-bar eighth pulse, spelt in pitch not velocity so the `[s,f,d,v?]` "stepped dynamics only where the spec asks" pin stays true; jungle's never-share-a-step pin was deleted (it was what forced the thinning) and call-and-response became interlock; ice's bass went 4 long cracks -> 32 off-eighth notes; factory only needed a tempo nudge, its bar-5 cut-out filled, and a two-note anacrusis so no bar is lead-free.
- Two pins were traps checked BEFORE composing: CROWN's Ionian-uniqueness (perfect fourth AND leading tone) breaks if ice's root-fifth bass reaches Bb or factory's reaches D#, and the failure message names *crown*; and menu B's F# markers had to be DERIVED from the frozen table because `secIsB` asserts both "these steps" and "no others" — a dense bass tonicizing G major sounds the leading tone far more than four times.
- `hats()` lost its last caller with ice's rewrite and was deleted; `pulse()`/`oct()` were already gone.

## 2026-09-06 — R3 direction v2: soundtrack recomposed as arcade pop (wave B, score complete)
- Wave B recomposed the last five — **arena → crown → sand → water → void** — plus one render iteration and a menu-B fix. Six data commits, PWA v80 → v87, one test-only close. Music pins 222 → 239, `npm test` 31/31 green before every commit. The score now has **no track outside the 104-140 BPM band and no pin encoding silence as a feature**.
- **Ladder order was NOT the spec's.** Spec said `crown → sand → water → void` with arena unmoved; arena had to go FIRST because `EVEN8` is shared by `arena.A.hat` and `crown.B.hat` (the payoff quotation), and crown's new B could not satisfy `pulseGap <= 1` while quoting a 28-hit hat that stopped at bar 7. Tempo ordering (`sand` vacates `.139` before `water` takes it) was still honoured inside that.
- **The reference track was the worst offender.** ARENA is what the research calls already-arcade-correct, and its bar 8 stopped the whole band: the offline render measured **0.92 s under −50 dB, four times per bounce** — the largest hole in the score. Nothing pinned it because the wave-1 sweep asserted `breathBar(A) >= 0`, which *required* it. Wave A's report had recorded arena at "4 intervals / 0.20 s" and used that as the yardstick other tracks were held to; the real figure is 0.92 s. **A track named as the standard was never actually measured against the standard.**
- **B sections were an unpinned blind spot.** Every v2 sweep read `.A`. `arena.B` carried the same silent bar (`pulseGap` 9), `void.B` had `hat: []` and a 2-onset bass (`pulseGap` 31), `crown.B` read 2. A-A-B-B is what a listener hears, so `pulseGap`, `barsWith*` and occupancy are now pinned on both sections of the hand-authored tracks and a B-side sweep runs over all ten.
- Per track: crown's bar-4 full-band stop went and its bass became the dotted fanfare root-fifth-octave on 0/3/4/6 the spec had always named but never written (21 → 32 notes); A's hat moved to the offbeat 1/5/7 *so that* B's even-step quote of arena reads as a borrowing rather than as more of the same. Sand's "drone, mostly tacet" (3 notes, all ≥8 steps, 4 lead-free bars, **46 silence intervals**) became 32 notes on 0/3/5/7 weighted to the fifth. Water's cross-barline legato and INV contrary-motion pad were replaced *by their negation* — nothing over an eighth, nothing crossing a bar line — so they cannot return as "colour". Void moved 64 → 104 BPM and got back a hat (2000 Hz, the darkest in the score), a pad, its tonic and the whole motif.
- **`pulseGap` bounds the grid, not the ear — a second time, at a different scale.** VOID v2 passed every pin at occupancy 53 (bass+hat cover every even step) and still rendered **28** sub-−50 dB intervals: at void's gains, the lowest in the score, one unstruck step at `.144` dips under the threshold even with a note ringing through it. Filling the lead's odd steps took it to 4. Wave A learned this on ice; the rule "one unstruck step per LOOP, never one per bar" holds for *occupancy*, not just for the rhythm section.
- **VOID keeps its identity through a comparison, not a number.** "Sparsest track in the game" was `occ <= 20`. It is now pinned as *bass+hat strike fewer steps than any other track's* (32 vs 48+) with occupancy banded 58-63 — contrast by relative density, which survives a composer making the track denser, where a ceiling only survived them making it emptier.
- Menu B was wave A's flagged weakness (harmonically a real modulation, rhythmically identical to A). Fixed inside the existing pins: B's bass accents 0/1/3/4/6 against A's 0/2/3/4/6, note count/mix/hat/harmony untouched, so the wrap threshold and F# derivations were unaffected. Pinned as a **difference between the accent sets**, not as a step list.
- Retired with their last callers: `motifAt`/`motifHead` (v1 offsets 0,1,2,3,6) once arena's ANTIC, void's fragment and crown's RESOLVED moved to the v2 figure, and `breathBar` when water took the last of its four. `AUG` and `INV` are gone from the vocabulary.
- ΔRMS vs the pre-recompose bounce: void **+2.82**, sand +1.54, arena +0.51, crown +0.34, water **+0.06**. Water's near-zero is wave A's factory trade again — shortening notes costs more sustained energy than added onsets return — and is reported, not chased. Whole-score regression: menu and jungle re-bounced from live data measure identical to wave A's files.
- Spec `docs/superpowers/specs/2026-09-05-soundtrack-design.md` was NOT edited this round (another writer held `docs/`). Four corrections are owed to it: ARENA's silence figure, the arena-first commit order, the wave-B band/ladder rows, and menu B's accent change.

## 2026-09-06 — R3 direction v3: soundtrack rewritten SOFT and room-distinct (preview wave)
- User rejected v2 on a listen, in three separate complaints: **too harsh, too fast, too scary**, and **"each song for each part also must be different than the other one."** v1 was somber Dorian chamber music, v2 was 104-140 BPM square-wave drive with one motif everywhere. Both were internally consistent, both had a green pin sheet, both missed. **Second time recorded: a clean pin sheet is not an accepted direction, and the pins that most needed renegotiating were the ones that had been green longest.**
- v3 answers the three complaints with three separate levers, which is the whole structure of the rewrite. **Harsh** -> `triangle`/`sine` only, `sawtooth` leaves the music layer entirely, `square` only as a low-velocity hat colour (v <= 0.035), per-channel v ceilings AND a **channel-peak-sum <= 0.20** headroom bound (v2's arena summed to 0.268 — per-channel ceilings do not bound simultaneity). **Fast** -> band 96-120 BPM (`STEP = 15/BPM`, verified against shipped data: menu's .121 is 124.0 BPM as v2 claimed). **Scary** -> dark rooms move to minor **pentatonic**, a collection with no tritone and no semitone, so "no sting, no cluster" is free by construction rather than inspected; plus no bass below 55 Hz.
- **The shared five-note motif is RETIRED.** It was chosen for coherence, it delivered coherence, and the user heard the coherence as repetition. Each room now owns one hook, pinned positionally and locally; the retired figure is pinned OUT (`motifV2Head === -1` in lead and bass, both sections). `motifV2At`/`motifV2Head` survive as the *detector for its absence*.
- **Preview wave: menu -> jungle -> void**, one commit each, PWA v87 -> v90, `npm test` 31/31 before every commit, music pins 239 -> 261. menu first because it carries the coupled machinery (MUSIC_PATTERN/_B identity, F# markers + derived EXP, `secIsB`'s "and no others", CYC=256, the `bass[0]` envelope probe, the two setTrack identity pins). RED counts before each data drop: 22 / 22 / 15.
  - **menu** G major HEXATONIC on G2 98.00 (was D Dorian on D2 73.42), .137 = 109.5 BPM. Hexatonic not pentatonic because I-vi-IV-V needs the 4th. Even walking eighth bass on 0/2/4/6 (d2, cells tile the bar), lead in eighths on even steps with three sixteenth turn-pairs, **sine** hat on 2/6 at v 0.012. Peak sum 0.157, occ 36/64. B lifts to D major pentatonic (the F# marker) with the bass re-cut to 0/3/4/6.
  - **jungle** D major pentatonic, root unchanged, .132 = 113.6 BPM. The 3+3+2 tresillo survives but its cells now TILE the bar (d 3/3/2); lead skips in the pockets (2/4/5 + a step-7 pickup); hat 24 -> 16 hits. B is now HAND-AUTHORED (tresillo re-cut to 0/2/5, hat to 3/6) — jungle moves from the `transp` staging list to `HAND`, because a transp B shares A's hat array *by identity* and therefore cannot re-cut a rhythm.
  - **void** B minor pentatonic, root unchanged, .152 = 98.7 BPM, the slowest of the ten and still in band. Half-time root-octave bass on 0/4 ringing four steps, softest hat in the score (2400 Hz, v 0.010), 20-note sine lead. Peak sum 0.132, occ 40/64. B drops a fourth to E minor pentatonic and swaps the lead's odd/even bar roles.
- **`pulseGap <= 1` had to go, but not to nothing.** A spacious room cannot satisfy it honestly. Replaced by **bass note SPANS cover every step of the loop** (`[s, s + d/STEP)` union == LEN) — the property v2 was actually reaching for, and a better fact: `pulseGap` bounds the onset grid, this bounds the *sound*. All six v3 patterns are 64/64.
- **"Different from each other" is the hardest thing here to pin.** A lead-Hz-list comparison between tracks in different keys is *vacuously* unequal and pins nothing. The two that bite are the `(Δstep, Δsemitone)` **contour** and the **step-set mod 8** groove, both pairwise over the composed ids — empty on a wave's first commit, biting from the second.
- **menu and jungle nearly shipped on the same collection** (both major pentatonic), justified by a distinctness pin reading the `(root, collection, STEP)` *triple*. That is a pin passing while the direction fails — the v2 failure exactly. Rejected jungle candidates recorded so they are not re-derived: mixolydian pentatonic has a tritone between 3̂ and ♭7̂; Lydian pentatonic puts a G♯ in a D-rooted track and would break sand's uniqueness pin *with a message naming sand*. Three filters before writing a note in any new collection: **no 6-semitone pair, no G♯, and not both the perfect fourth and the leading tone** (CROWN's).
- **Two ENGINE-ABI pins were silently assuming DENSITY** and only broke once a sparse track existed. "frame pump advances lookahead monotonically" asserted a start at `0.05 + 1*STEP` — pinning tempo through occupancy — and menu's step 1 is empty; it now asserts every start sits on the `0.05 + k*STEP` anchor grid. And its clock must advance in 0.1 s frames: `STEP .137` now EXCEEDS a frame, so one `currentTime` leap puts `nextT` behind the clock, fires the catch-up clamp, re-anchors the grid, and desyncs the `CYC=256` wrap test (probe fell to 1 of 160). Found by running, not by reasoning.
- **The F# B-marker is menu-LOCAL now, and saying so is load-bearing.** The AABB drive only ever pumps the default track, so the marker is a property of `MUSIC_PATTERN`/`_B`. `jungle` and `void` sound F# in their own A sections under v3, so the v2 claim "the score's two chromatic guests are menu's F# and sand's G#" is **false and retired by name** — leaving it in would let a later wave break section detection while every menu pin stayed green.
- **`void`'s no-shared-motif pin is trivially true and is labelled as such**: minor pentatonic has no 6̂, so the detector cannot fire whatever void plays. Its melody is pinned by its own hook instead — three adjacent COLLECTION steps falling on 0/3/5, read from a different degree in each odd bar — which needed a new `degIdx(f, f0, set)` helper indexing a note inside its collection across octaves, so a gesture is pinnable as a shape rather than as semitones.
- Roots deliberately did NOT move (only menu's, and menu is not in the biome-root pin's set): v3 already changes tempo, mode, timbre, rhythm and melody everywhere, and moving the root ladder too would be a second migration with its own ordering constraints for no audible gain.
- **Remaining seven, ship order forced by the ladder pin** (a track may only move into a vacant STEP): wave 2 `water .139->.144` -> `sand .134->.148` -> `ice .129->.135` -> `factory .114->.130`; wave 3 `arena` first (so `crown.B`'s hat quotation lands on the v3 arena) -> `crown .110->.128` -> `intro .125->.140`, with arena taking `.125` only after intro leaves it. Report: `.superpowers/sdd/2026-09-06-taste-revision/task-v3-preview-report.md`.
- **Nothing has been heard.** The Browser pane belonged to another agent this dispatch; `tools/bounce/` is untouched and the controller bounces separately. Per the spec's own gate, the listening checkpoint on these three is what unlocks wave 2.

## 2026-09-06 — R3 direction v3: the remaining SEVEN recomposed (waves 2 and 3, score complete)
- Wave 2 (`water` -> `sand` -> `ice` -> `factory`) and wave 3 (`arena` -> `crown` -> `intro`), one commit each, PWA v93 -> v101, `npm test` 31/31 green before every commit. **All ten tracks are now v3**; `V2ONLY` is empty and every sweep in `music.test.mjs` ranges over the whole score. Music pins 261 -> 257 — the count FALLS because the last commit retires seven v2 sweeps that had become vacuous, while 33 pins were added across the wave.
- **Ship order was forced by the ladder pin, not chosen** (a track may only move into a VACANT `STEP`): `water .139->.144`, `sand .134->.148`, `ice .129->.135`, `factory .114->.130`; then `arena` FIRST in wave 3 so `crown.B`'s hat quotation lands on the v3 arena, `crown .110->.128`, `intro .125->.140`. **`arena` could not take `.125` until `intro` left it**, so it shipped at a temporary `.126` (119.0 BPM, in band) for two commits and moved to `.125` inside the intro commit. The authored ladder is now exactly the spec's.
- Per track: **water** dotted three-step cells against the eight-step bar, re-phasing at step 32 so the hook lands on bar 4's downbeat — the only bass in the score touching all eight residues, and no hat. **sand** the same dot cut the other way (3+2+3 inside the bar), lead one step BEHIND every downbeat, keeps G# at 415.30. **ice** stopped being brittle by subtracting ONSETS not volume: one bass note a bar (sparsest onset grid in the score), eight sine glints, occupancy 63 -> 32, and a lead pinned as ARPEGGIOS by a floor — no two consecutive notes closer than a minor third, so it cannot walk stepwise by accident. **factory** strict 2-against-3 made literal: bass in twos, one-step staccato lead in threes, the two grids coinciding EXACTLY ONCE A BAR and that count pinned. **arena** was v2's self-declared reference and v3's worst offender (0.268 peak sum, 140 BPM, two square channels and a sawtooth pad) — all withdrawn, energy re-bought from an on-the-beat fanfare and a 2+3+3 tresillo at 0.196. **crown** kept its dotted bass fanfare untouched because the figure was always right and the TIMBRE was wrong; sawtooth pad -> sine, 0.244 -> 0.194. **intro** is 32 steps of C major hexatonic quoting menu's head.
- **Three spec contradictions had to be ADJUDICATED, not resolved by picking the nearer sentence.** The spec was off-limits (another writer holds `docs/`), so each is recorded in the test comment, the `tracks.js` block comment, the commit message and here. (1) §2 gives water a SINE lead while §5 row 8 keeps "exactly one sine lead, and it is VOID" *unchanged* — the roster asserts both in one breath. **Pin sheet wins**; honouring prose by loosening a green pin is the exact anti-pattern this program has now recorded twice. (2) §2 puts `square` on factory's LEAD while the §5 fact table the suite encodes allows square on HATS only — resolved to the hat, and factory's identity claim survives as "one square colour in the score, and it is FACTORY's hat". (3) §1b freezes water's root at G1 **49.00** while §0a.3 bans anything under 55 Hz. Moving the root would break three pins at once (the ROOT table, the R3c pre-move check, and the runtime "water downbeat is 49.00, NOT menu's 98.00" identity pin, which would *invert*). Resolved as a **global uniqueness claim** — exactly one bass note in the score under 55 Hz, named by track, step and value — so the exception cannot drift into a second note.
- **A pin about a timbre the direction no longer has is dead, not green.** "Exactly one sawtooth bass, and it is FACTORY" passed every commit while sawtooth was leaving the music layer, and would have gone on passing forever over an empty set. Deleted with factory and replaced by the v3-correct scarcity marker. Same shape as the `transp` retirement: with `TRANSP` empty, `TRANSP.every(...)` reads green over nothing, so the two-list staging check collapsed into one claim over all nine B-bearing tracks and `transp()` was deleted from `tracks.js`.
- **"Unaccompanied at the top" (intro) and "bass in every bar" (v3) cannot both be literal.** The head is written as the THINNEST bar the sweeps allow — two long bass notes, no pad until bar 1 — rather than a silent one, and the pin says exactly that. Note `TONIC.intro` moved 293.66 -> **261.63** with the rewrite: that table feeds every interval pin and the score-wide Ionian-pair sweep, so leaving it on D would have silently measured the wrong degrees on one track and nowhere else.
- **The distinctness pins bit for the first time at the end.** Pairwise lead CONTOUR and `bass`/`lead` step-set mod 8 were vacuous on the preview wave's first commit; with all ten composed they now separate **45 pairs**. What they still cannot see: `water` and `sand` share a palette (triangle/triangle/sine pad/no hat), the same mode family and adjacent tempos, so their separation is **register and phrase length** — water opens on G1 49.00 and roams two octaves, sand sits on B2 123.47 inside one — and that had to be written into the block comments because no pin measures it.
- **A concurrent session `git stash`ed this session's working tree mid-commit** ("composer WIP set-aside for docs commit") and swept the intro commit's v99 -> v100 PWA bump into an unrelated MAKO commit. `git add` then staged nothing and `git commit` reported "no changes added"; the work was recovered intact from `stash@{0}` and the intro commit carries its own v100 -> v101 bump. **Check `git status` and the reflog before assuming an empty commit means an empty diff.**
- **Nothing has been heard, again.** The Browser pane was out of scope; bouncing is dispatched separately. Per the spec's own gate a green pin sheet is not an accepted direction — all ten need a listen in run order against the four criteria, and `water`/`sand` is the pair most likely to fail "each room is its own piece". Report: `.superpowers/sdd/2026-09-06-taste-revision/task-v3-rest-report.md`.

## 2026-09-06 — Fix wave: the B sections were never swept, and the spec had drifted
- **The "every room its own piece" sweep only ever looked at half the score.** `music.test.mjs` built its pairwise distinctness list from `V3.map(k => k + ".A")`, so nine of the nineteen patterns — every B section — were compared to nothing. Four had shipped on a groove another pattern already owned: `factory.B`, `water.B` and `sand.B` all landed on **jungle.A's tresillo** `0,3,6 [3,3,2]` (and `factory.B` on jungle's own **D2 73.42 root**, one rung away on the tempo ladder — the closest two rooms came to sounding alike anywhere), `jungle.B` on **arena.A** `0,2,5`, `ice.B` on **void.A** `0,4`, `arena.B` on **sand.A** `0,3,5`. Nine colliding pairs. A room the player hears in its B half is a room they hear; a sweep quantified over `.A` cannot say that.
- **A step-set is only half a groove.** `0/3/6` cut 3+3+2 and cut 3+4+2 are not the same rhythm, so the pin is now the pair — step-set mod 8 AND the **cut**, the note lengths in steps at each struck residue (`bassCut`/`groove`, proved on synthetic bars). Its one blind spot is written into the helper comment: the cut keeps a SET per residue, so a two-bar phrase and its mirror collapse to one signature. Nothing relies on that today — the nineteen are distinct on step-sets alone — and the four two-bar phrases additionally pin their first phrase note by note, which is the bar PARITY the signature cannot see.
- **Lead step-sets could NOT be extended the same way, and finding that out first mattered.** `menu.A`/`menu.B` share `0,2,4,6,7`; `ice.A`/`ice.B`/`factory.B`/`arena.B` all share `0,2,4,6`. That clause stays scoped to the ten A sections on purpose — a B is separated by its contour and by the low end under it, not by which steps its tune starts on — and the spec row now says so rather than claiming a score-wide fact the suite cannot hold. Lead CONTOUR did extend to all nineteen: it was already clean.
- **Six B basslines re-cut; the constraint that shaped every one of them was the room's own pins, not taste.** `jungle.B` 0,2,5 → **limping tresillo** 2+3+3 | 3+2+3 (occ 60→56, and jungle is the one track whose 54-62 band is pinned on BOTH sections — every onset outside `0,2,5` doubles one the lead or hat already strikes, so the limp cost exactly four steps and no more were available). `ice.B` 4+4 → **6+2** (4+4 on 0/4 was void's half-time bed exactly). `factory.B` → **3+3+3+3+2+2 across the barline**, 2-against-3 at phrase length (occ 56→52, authored: the holes are the phrase). `water.B` → the cut **TURNS** inside the bar, 3+3+2 then 2+3+3, both bars still starting on the downbeat. `arena.B` → keeps A's 2+3 head and **HOLDS** the third cell to the barline, because with the hat on 1/3/5 steps 6-7 are the only adjacent pair left and `pulseGap(B) === 2` is pinned. `sand.B` → the lean **SLIPS** back to 3+2+3 every second bar. Pitch material, roots, note counts, timbres and velocities are untouched in all six: only the timing moved.
- **Two candidates died on arithmetic, and both looked fine in prose.** Giving jungle the cross-bar tresillo puts its onsets on the lead (1/4) and hat (3/6) steps and drops occ to **40** — a hard fail on its own band, and a room getting duller in a wave meant to make rooms distinct. Giving factory `0,3,6,7` fills all 64 steps and deletes the step-7 hole its own block comment claims. Compute occupancy for a candidate BEFORE writing its notes.
- **Spec re-synced (docs-only commit, no bump).** Seven corrections, four of them places where the document contradicted its own pin sheet: water's lead is `triangle` not `sine` (§5 row 8 keeps sine for VOID alone), factory's `square` is the HAT not the lead, the sub-55 Hz ban ships as the global one-note uniqueness claim naming water's G1 49.00, and `arena`'s transient `.126` for two commits is recorded in the ship order. Plus the seven re-valued occupancy rows, `TONIC.intro` 293.66 → 261.63, and the "New in v3" table's replacements for retired facts. **A green pin outranks prose that contradicts it — this is the third time that rule has been needed, and now the spec says which row adjudicated what.**
- **The MAKO ring near-miss was recorded against the wrong vertex.** `sprites.js` and MEMORY both named the fin TIP `[1.3,-0.46]`; the binding vertex is the swept SHOULDER `[0.96,-0.84]`, which cleared by 0.64 where the tip cleared by 0.97. The 0.64/0.36 numbers were always the shoulder's. The tip reaches further out but points where the ellipse is widest, so **a ring fitted by eye to the outermost vertex is fitted to the wrong one** — which is exactly the mistake the original `r*1.5 x r*1.16` fit made. Fixed in `sprites.js`, `items-art.test.mjs` and here.
- PWA v101 → v103 (two shipped-byte commits: `tracks.js`, then `sprites.js`). `npm test` 31/31 before each; music pins 257 → 261.
- **Still nothing has been heard.** The Browser pane belonged to another agent again this dispatch; the controller re-bounces `jungle.B`, `ice.B`, `factory.B`, `water.B`, `arena.B` and `sand.B`. Report: `.superpowers/sdd/2026-09-06-taste-revision/task-fixwave-report.md`.
