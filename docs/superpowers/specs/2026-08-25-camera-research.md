# Camera Research — rollblock real-3D rig (2026-08-25)

Problem: default `DEF={az:-0.6,el:0.9,dist:560}` (camrig.js:11) ≈ 51.6° low tilt,
corners clipped, player hard to track. Gameplay is a flat 15×13 grid (600×520wu)
projected to 3D → top-down-ish by nature.

## §1 Research findings

- **Super Bomberman R** — story mode used a dynamic isometric follow camera;
  reviewers lost lives because bombs/enemies were unreadable and depth was
  unjudgeable (Nintendo World Report hands-on, 2017-03-02); "camera pans out so
  far… almost impossible to see what's going on" (the-pixels.com review).
  Konami shipped a camera-fix SETTING in v1.1 (official support KB) — a patch
  apology for their own default. The praised multiplayer mode uses "the
  traditional top-down Bomberman camera" (NWR). Lesson: fixed high-angle,
  whole board, zero motion during play.
- **Bomberman 64** — manual rotation was panned ("changing the camera… the
  whole way through is completely annoying", Archive 64 review; Gamebits:
  hard to find a view into nooks). Crucially the manual LOCKS the camera in
  Battle Mode and boss fights (N64 instruction booklet p8): even Hudson
  conceded arenas need a fixed single-screen view.
- **Classic SNES Bomberman / SBR battle mode** — pure overhead-to-steep fixed
  angle, entire arena on one screen, never rotates during play.
- **Crossy Road** — orthographic, FIXED azimuth+elevation for the whole run
  (position ~[300,-300,300], iso-style); chosen explicitly for arcade/boxy
  readability; clones/tutorials replicate exactly this (javascriptgametutorials
  Crossy Road series). No follow rotation, only world scroll.
- **Isometric conventions** — classic iso = az 45° + el ~35.26°; action/top-down
  rigs tilt steeper, "typically around 60°" (Unity discussions; Kongregate iso
  overview: floors/walls at 30–45° so "you can read the map at a glance").
  Steeper elevation ⇒ better lane readability; some tilt kept for block-height
  depth cues.
- **"Spike Chasm"** — no such title found in any source; treated as
  unverified/typo, dropped from the evidence set.

## §2 Options analysis

| Option | Verdict | Rationale |
|---|---|---|
| (a) Fixed high-angle, full board | **RECOMMEND** | Whole-arena info = core bomberman skill (bomb chains, enemy tracking); matches SNES/SBR-battle/Crossy evidence; zero per-frame camera logic; netcode/spectator friendly |
| (b) Follow-cam zoomed on player | REJECT | Fatal board-awareness loss; exactly what SBR story mode shipped and got roasted for |
| (c) Current free-orbit | Demote | Keep code, gate behind opt-in toggle; B64 shows constant manual orbit annoys |
| (d) Hybrid lean/parallax | Defer | At 600×520 whole-board scale there is nothing to lean toward; motion without payoff |

## §3 Recommended default rig (decisive)

Board X∈[-300,300], Z∈[-260,260]; FOV 45° vert (wrapper.js:61), aspect 600/520
⇒ tanHalfV=0.41421, tanHalfH=0.47794. Fit worst biome ICE wall 30+trim≈36:

- Vertical footprint V = 520·sin(el)+36·cos(el); horizontal U = 600 (+8% margin).
- **az = 0** (axis-aligned: grid columns vertical on screen, +X right, row 0 far;
  reads identically to the 2D map; no diagonal ambiguity).
- **el = 66° above horizon = polar 0.419 rad from +Y** (`camrig` `el` is polar,
  not elevation-from-horizon; `1.152` was the unit-bug that framed at 24°).
- **dist = 800**: full-board fit after the polar fix (was 700 under the wrong el).
- **target = [0,-25,0]** (board center, slight Y drop for ICE trim).
- Dolly band live: `DIST_MIN=560`, `DIST_MAX=1000`. Clamp `EL_MIN=0.21`, `EL_MAX=0.87`.

## §4 Implementation deltas

- `camrig.js` (HEAD): `DEF={az:0,el:0.419,dist:800,target:[0,-25,0]}`;
  `DIST_MIN=560`, `DIST_MAX=1000`. Orbit math untouched.
- `flythrough.js`: `BASE_DIST=800`; settle `el=0.419` so INTRO last frame ==
  `createRig()` defaults — handoff stays seamless by construction.
- `main.js`: pass an orbit-enabled gate into mountOrbitCtl getActive:
  `GAME && kind==="3d" && (opts.orbit ?? /[?&]orbit=1/.test(location.search))`.
  Wheel/pinch dolly stays always-on within clamps; right-drag orbit becomes
  opt-in (`?orbit=1`, later a menu toggle). KeyR reset already restores DEF.
- Tests: update three.test.mjs camrig/flythrough constants + intro-snap check;
  battery must stay green; core/, net/, input/ diff = 0.

## §5 Acceptance checklist

1. Spawn frame: all 4 corners + border trim fully visible, ≥20px CSS margin.
2. Player legible (~≥30px) in all four corners with NO camera input.
3. Bomb fuse/spark + enemy silhouettes distinguishable at dist 800.
4. Grid columns render vertically (az=0); lanes unambiguous.
5. Default play: zero camera motion except shake; WIN/LOSE unaffected.
6. Without `?orbit=1`: right-drag inert; wheel dollies clamped 560..1000; pinch same.
7. With `?orbit=1`: orbit works, KeyR returns to exact authored rig.
8. INTRO last frame == createRig() defaults (no visible snap at handoff).
9. ATTRACT/demobot fully readable single-screen (no camera drift over 20s cap).
10. Node battery green; draw-call budget unchanged (camera-only change).
