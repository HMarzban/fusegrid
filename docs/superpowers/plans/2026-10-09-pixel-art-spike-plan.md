# PIXEL look: art spike plan and gated roadmap (2026-10-09)

> **For agentic workers:** this plan is gated. Do the art spike (§4) first. No
> step after it starts until the user records a pick at G0 (§7.3). Inside a
> stage the agents work on their own. The gates (G0, G1, each G2 wave, G3) are
> the only planned stops for the user.

**Goal:** decide, cheaply and from rendered pixels, whether Fusegrid gets a
third RENDER look called **PIXEL**. PIXEL is hand-pixelled frame art, with walk,
fuse and blast animation, next to CLASSIC 2D and REAL 3D. If it does, build it
in reviewed waves where every step has an owner, a test and a way to stop.

**Status:** a plan only, committed by the finalizer after one review round
(2026-10-09). Nothing in `src/` or `tests/` changes until G0 is a pick.

**Inputs this plan reconciles:**
- the feasibility study `.superpowers/sdd/2026-10-09-pixel/research.json` (five
  researchers plus a skeptic);
- six specialist briefs written for this plan: Art Director, Character
  Designer, Environment/FX/Items Designer, Animation Designer, Tech Lead and
  Producer/QA Lead.

Where the briefs disagreed, §3.13 records the winner and the reason.

**Review round 1 (2026-10-09).** Two reviewers raised 32 findings; all majors,
minors and nits were applied. Where the finalizer departed from a suggested
fix, the one-line reason is dated in place:
- D5 under policy (a) at k ≥ 4 is reported as a spread, not a uniformity pass,
  because a fractional k cannot give uniform pixels (§3.2).
- "Six test files pin RENDER" is written as 4 + 2: four carry the `RENDER`
  literal and two pin the `r3d` bit (§2, §6.3).
- The spike hard stop is T0+3 days, not T0+2.5, because the re-added critical
  path is about 2.85 days (§4).
- G0 keeps P-back (one reviewer cut it, the other kept it), folded into the
  MAKO question, because it is part of MAKO's identity and costs one cell
  edit (§3.13).
- Sharp-bilinear (c) is dropped from G0 rather than built on a separate
  canvas; it returns only through K1-1 (§3.2 D4).
- Direction C's MAKO body stays 15 wide rather than 17, because 17 plus the
  ≥2-px fins on both sides does not fit the 20-px cell, and C does not scale
  MAKO (scaling to 24 rows would fail M2); its extra rows are crown overhang
  only (§3.7, §4.2).
- The odd-width axis rule is scoped to MAKO and walker, not every foe, so
  correct foes drawn to §3.8 do not fail G-A.

---

## 0. The short version (for the owner)

**What we would build.** A third way to see the game, called PIXEL. The sim
does not change: the same rules, scores and replays. CLASSIC 2D and REAL 3D
stay exactly as they are. PIXEL would be hand-drawn 20-pixel art with real
frame animation: MAKO's walk, the bomb's fuse and the blast decay.

**What happens first (2.5 to 3 working days, hard stop at 3).** The art
director first hand-places ONE reference MAKO on the pixel grid, using our own
approved CLASSIC 2D drawing only as a guide underneath, so every direction
shares one anatomy.
Then three artist agents each draw one style direction, A, B and C, using the
same small set of pieces:
- MAKO from four sides;
- four foes;
- the bomb and the blast;
- two pickups: FLAME and KICK (the boot, one of the objects that misread
  before);
- tiles for JUNGLE, VOID and CROWN, plus a SAND strip.

Before you see anything, three checks run:
- automatic checks catch off-model art, such as horn fins, a fang, a box-shaped
  body, or colours that vanish on VOID or CROWN;
- the art director reviews every cell;
- a separate reviewer checks that nothing resembles the genre classic, and
  fresh reviewers who know nothing of the plan are asked whether the art
  reminds them of any existing game.

**What you get.** One page that shows each direction next to today's CLASSIC
2D (and REAL 3D on the JUNGLE board), on the same board at the same moment:
- the boards at the real size of your laptop and your phone;
- one short motion strip per direction: the walk cycle, the fuse and the
  blast ages.

**What you decide.** Which direction, or "none, CLASSIC 2D is better", which
stops everything at no further cost. You also say whether MAKO is still MAKO
(including one back-view pair), and pick how pixels sit on your screen, plus
the blast style if both styles were drawn. You answer by letter. You are never
asked for numbers. Feel questions (motion snap, speed, pause, the intro, the
ghost, a lost life) wait for G1, where you play instead of watching.

**Then, only if you pick a direction:**

| Gate | What you do | What it costs |
|---|---|---|
| G1 | Play a hidden `?render=px` build for one room in each of JUNGLE, VOID and CROWN, then say go or no-go, full look or characters only. | About 4–6 engineering days plus about 1–1.5 weeks of art. |
| G2 | Review the full look in waves: characters (two waves), environment, items and effects, optionally the HUD and menus, then integration. You approve each wave at real size. | The remaining 4–6 engineering days (8–12 in total including G1) plus 4–8 calendar weeks of art. |
| G3 | Release. | |

**When we stop on our own.** There are stopping rules at every gate. Examples:
- no MAKO you like after two rounds;
- PIXEL does not beat CLASSIC 2D in play;
- a wave rejected twice.

A stop is a recorded decision, not a failure. The cheapest fallbacks are
"characters only" (pixel MAKO and foes on today's tiles) and "keep CLASSIC 2D".

**The ongoing cost you should know about now.** If PIXEL ships, every future
foe, pickup or room needs art in three looks instead of two.

---

## 1. Purpose, request, and who decides what

### 1.1 The request (verbatim, 2026-10-09)

> "for art spike let's create a plan document, run all your team of agents and
> get help from the art designers in order to have a cohesive and reliable and
> accountable plan for this new feature"

The same message asked to push the pending fixes first.

**Sequencing rule:** the spike starts from a clean, pushed `main`, so spike
evidence never mixes with unpushed work. **T0** is the moment that push lands;
its SHA is the **spike-start SHA**, recorded in the decision log (§7.3), and
every repo figure in this plan is re-measured there. The spike writes nothing
that git tracks, so it neither blocks the push nor depends on it.

### 1.2 What "cohesive, reliable, accountable" means in this plan

- **Cohesive.** There is one style bible (§3). Every grid, gate and review
  follows it, and a conflict between lanes is settled in §3.13, never left to
  whichever artist draws first.
- **Reliable.** Every rule is backed in one of two ways:
  - a number that a Node script checks (§4.6, later ported to tests);
  - a named human check on a written checklist (§4.7).

  Nothing reaches the user as a candidate that has not passed both. The one
  exception is the K0-1 sheet (§5), which shows failing MAKOs with every gate
  failure labelled in red, so the user can overrule a false positive.
- **Accountable.** For every step the plan states:
  - one owner;
  - inputs, outputs (exact paths) and acceptance criteria;
  - an effort estimate with its confidence;
  - the user gate it feeds;
  - its kill criteria.

  Every gate event becomes a dated row in the decision log (§7.3) and in
  `MEMORY.md`.

### 1.3 Decided by the team vs decided by you

**The team decides craft and engineering.** Each item below is a **team
ruling**. It is recorded with its reason, and you may override any of them:
- the 20-px art grid;
- the palette function;
- the outline rules;
- the gate thresholds;
- the cell list;
- the seams, the tests and the file layout.

**You decide all taste and every contract change:**

| Gate | Your decision |
|---|---|
| G0 | Direction A, B, C, a mix, or "none". Whether MAKO is still MAKO, including MAKO's back view (P-back). The scale policy (P-scale). The blast style (P-blast), only if both styles survive the cut order. |
| G1 | Go or no-go. Full third look or characters only (decided here and only here). The feel picks from play: P-snap, P-speed, P-life, P-ghost, P-pause, P-intro, and the left-facing light flip. The RENDER contract change (§9). Who draws the production art. |
| G2 | Each wave, at real size. |
| G3 | Release. |

The only user words this plan rests on are the request in §1.1. No user ruling
exists yet on any PIXEL question.

### 1.4 Gate names (one vocabulary)

The specialist briefs numbered gates differently. This plan uses one set:

| Plan | Meaning | Brief names it replaces |
|---|---|---|
| **G0** | spike pick from the rendered sheet | the AD's G0; the Character, Animation and Tech Lead briefs' "G1" |
| **G1** | `?render=px` probe go/no-go and contract rulings | the Tech Lead's "G2"; the Animation brief's "G2"; the AD's G1 |
| **G2-W1…W5** | full-look waves, each approved separately | the Producer's G2 waves; the Tech Lead's S4-art batches |
| **G3** | release sign-off | the Tech Lead's S5 |

---

## 2. Research verdict (short)

**Verdict: possible, with caveats.** Five researchers and a skeptic found no
technical blocker:
- the sim is untouched;
- there are no npm dependencies and no image files, because the pixels live as
  palette-indexed text in JS and are baked to an offscreen atlas;
- CLASSIC 2D already disables smoothing (`renderer.js`) and sets
  `image-rendering:pixelated` (`index.html`).

**Recommended form: a third look, not a replacement.** REAL 3D's textures, the
iso path, GUIDE and the HUD chips all call the CLASSIC 2D painters, so
replacing CLASSIC 2D saves no code and throws away approved art.

The caveats are art, not code:

1. **Volume.** About 180–260 authored cells for the full look.
2. **On-model at small size.** Both agent-drawn MAKOs were off-model:
   - `proto/pixart.js` had horn fins and a fang;
   - `proto/bake.mjs` was a box.
3. **Pixel evenness.** The fractional CSS fit, the intro zoom (1.55 to 1.0) and
   pinch zoom resample the art. A px-mode-only fix is needed.
4. **Colour gates cannot see sprites.** VOID and CROWN were never drawn, and
   the existing gates see only `fill*` calls, not `drawImage`.
5. **Brand proximity.** A 16-bit grid-bomber is the genre classic's signature
   look.
6. **A permanent parity tax.** Every future world-space feature needs a third
   look.
7. **Contract churn.** The RENDER row, the `r3d` bit and six pinned test
   files change, but only at W-INT: four carry the `RENDER` literal
   (`headless`, `menuapp`, `menudraw`, `three`) and two pin the `r3d` bit
   (`r3d`, `settings`). `media.test` pins neither.

**Shortcuts that failed.** Pixelating the 3D meshes (B1/B2) gave an unreadable
blob for MAKO and dots for the blast. Downsampling CLASSIC 2D (C) gave noise.
Every frame is therefore authored by hand.

**Evidence** (all git-ignored scratch, under `.superpowers/sdd/2026-10-09-pixel/`):

| Path | What it shows |
|---|---|
| `research.json` | All five research lenses, the skeptic and the synthesis. |
| `sprite-proto.png` | Live CLASSIC 2D, live REAL 3D, variant A, B1, B2 and C on one board, plus MAKO crops. |
| `out/real-2d-board.png`, `out/real-3d-board.png`, `out/snap.json` | The frozen seed-4242 board every panel was drawn from. |
| `out/variantA-nonint-scale.png` | Uneven pixels at a 2.77 fractional scale. |
| `out/atlasA-x8.png`, `proto/mako_sheet_x6.png`, `proto/mako_front.grid.txt` | The two off-model MAKOs, kept as regression fixtures. |
| `proto/pixart.js`, `proto/bake.mjs`, `proto/scaleshot.mjs` | Grid format, a zlib PNG baker and the scale capture. |
| `ad/ramp-gates.mjs`, `ad/spec-check.mjs` | The AD's palette and grid numbers. |
| `env/envde.mjs`, `env/tileavg.mjs`, `env/pairs.mjs` | The environment designer's tile and collision numbers. |

All of these scripts were re-run at `3b17dbb` and reproduce the figures quoted
in this plan. The plan was finalized against `2b3df91` (the O1 audio-unlock
fix, not yet pushed). That diff touches `src/app/unlock.js`, `src/audio.js`,
`src/main.js`, `src/pwa/shell.js` and `sw.js`, and not `config.js`,
`entities.js` or `sprites.js`, so every ΔE and grid figure still holds; the
scripts were not re-run at `2b3df91`.

**Figures that move with the repo are stated as "measured at the spike-start
SHA".** At `2b3df91` they read: `main.js` **781** by `split("\n")` against the
799 cap (18 lines free), and `CACHE_NAME` **`fusegrid-shell-v168`**. The RE
re-measures both at T0 and records them in the decision log; every later
budget in this plan is relative to that record.

**Five corrections the plan carries:**

| # | Stale claim | Correct figure | Source |
|---|---|---|---|
| 1 | `main.js` has 1 line of headroom | `main.js` is **781** at `2b3df91` (788 at `3b17dbb`) against the 799 cap; re-measured at the spike-start SHA | `tests/headless.test.mjs:1056-1057` |
| 2 | `CACHE_NAME` is v166 | it is **`fusegrid-shell-v168`** at `2b3df91`; the probe takes the next free `vN` at its own start | `src/pwa/shell.js:1` |
| 3 | The probe needs no PWA change | `tests/pwa.test.mjs:98-102` walks every `src/**/*.js` and requires it in PRECACHE, so the probe adds SRC entries and bumps `CACHE_NAME` and the `sw.js` REV together | `tests/pwa.test.mjs:98-102` |
| 4 | Integer snap costs about 16% | it costs **7–28%** of board width; see §3.2 | — |
| 5 | Evidence lives at the `research.json` `/private/tmp/...` paths | those paths are session-scoped. Cite only the `.superpowers/...` copies | — |

---

## 3. The PIXEL style bible

**Owner:** Art Director (AD). **Consulted:** Character, Environment and
Animation designers, and the Brand & Spec Guardian (BG). **Locked:** the
canonical MAKO front key frame at spike start (S0b, §4.1), the palette at G0,
and the full MAKO model sheet at G1.

Tags on each rule:
- **[gate]** means a Node check in `spike/gates.mjs` enforces it, and later
  `tests/pixel-art.test.mjs`.
- **[human]** means it is on the AD pre-screen checklist (§4.7).
- **[draft]** means the rule lies outside the spike's scope. It is the team's
  current position and is **re-ruled at G1**, after the user has said yes. This
  covers §3.9's ghost, HUD and the pickups other than FLAME and KICK, and every
  §3.10 motion rule except A10 and the walk-cycle frame counts. Nothing marked
  [draft] is a decision yet.

### 3.1 Grid and units

**[gate] One art grid: 20 art px per 40-unit tile** for every direction, which
is a team ruling.
- One art px is 2 logical px, inside today's unchanged 600×520 box.
- The native board is 300×260.
- Characters sit in a 20×20 cell. Direction C allows 20×24 with up to 4 px of
  overhang upward, anchored bottom-centre, so the footprint read is unchanged.
- **[gate] Characters with a centred odd-width feature have an odd width and
  an axis COLUMN.** This is MAKO (grin, tooth seam and eye notch, M5, M7) and
  walker (its single centred 5-px eye, so walker is 13 wide in §3.8). Other
  foes keep the widths in §3.8 and are not mirrored inside a cycle. MAKO's
  body is an odd number of px wide (13 or 15; the canonical in S0b fixes it).
  Every cell records its `axis` column, and `flipX` mirrors about that column,
  never about the cell edge. In a 20-wide cell this leaves one spare column,
  which is transparent.

Rejected grids, with numbers from `ad/spec-check.mjs` (MAKO r = `TILE*0.36`):

| Grid | Logical/art px | MAKO r | Fin past flank | Eye | Tooth | Verdict |
|---|---|---|---|---|---|---|
| 10 | 4.0 | 3.6 | 1.15 | 2.1 | 0.6 | Rejected. Fins collapse into the horn failure the prototype showed. |
| 16 | 2.5 | 5.8 | 1.84 | 3.3 | 1.0 | Rejected. Not an integer at TILE 40, so it needs a separate world canvas and a logical-box change that ripples into the HUD, overlay and touch hit maps. |
| **20** | **2.0** | **7.2** | **2.30** | **4.2** | **1.2** | **Chosen.** |
| 24 | 1.67 | 8.6 | 2.76 | 5.0 | 1.5 | Rejected as a grid for the same non-integer reason. Its size benefit survives as direction C's 20×24 cell. |
| 40 | 1.0 | 14.4 | 4.61 | 8.4 | 2.5 | Rejected. Four times the pixels per cell, and it reads smooth like CLASSIC 2D. |

### 3.2 Display: how art pixels reach the screen

Device px per art px (`k`) on real devices, from the repo's own `fitBox`, with
the board loss if snapped down to a whole `k`:

| Device | k (20 grid) | Board width lost to integer snap |
|---|---|---|
| Laptop 1366×768, dpr 1 | 2.77 | 28% |
| 1080p, dpr 1 | 3.60 | 17% |
| MacBook 1440×900, dpr 2 | 6.55 | 8% |
| iPhone 15 portrait, dpr 3 | 3.77 | 20% |
| iPhone landscape | 4.35 | 8% |
| iPad portrait | 5.36 | 7% |
| iPhone SE portrait, dpr 2 | 2.39 | 16% |

**"In-game size" (one definition for every taste check).** In-game size means
the device px per art px that the target devices actually get under the scale
policy being judged: about **2.77 on the 1366×768 laptop** and **3.77 on the
iPhone 15 portrait** under (a); 2 and 3 under (b). The AD taste check (M12),
the blind read (§4.7) and sheet row 5 run at these sizes only. A native-size
crop (1 device px per art px, a MAKO about a third of its real size) and every
zoom crop are labelled **"do not judge"**. The word "1×" is not used in this
plan.

Rules:

- **D1 [gate] No cell is ever transformed.**
  - No `ctx.scale` or rotate is applied to a cell.
  - Motion is whole-pixel translation or a frame swap.
  - A 90° rotation is allowed only for emissive or flat art: the blast pieces,
    the line-bomb arrow and the boomerang spin. Rotating shaded art would move
    its light source.
  - **Mirroring shaded art follows the same reason.** A mirror flips the key
    light, so it is allowed only on a **facing change** (3/4-right → 3/4-left,
    one flip when MAKO turns) and **never inside one facing's cycle**, where it
    would make the shading flicker at walk rate. Every frame of a cycle is
    authored. Mirrors use the cell's axis column (§3.1).
- **D2 Sprite positions snap to the art grid.** The default is even logical
  px, `Math.round(x/2)*2`. The 1-px alternative is a G1 pick (P-snap), because
  at NORM speed MAKO moves about 2.27 px per tick, which gives uneven
  2/2/2/4 steps on the 2-px grid. **Screen shake** snaps the same way in px
  mode: the shared shake line (`renderer.js:51`,
  `translate(Math.round(shake.x),Math.round(shake.y))`) rounds to even logical
  px for kind `"px"` only, or an odd shake shifts the board by half an art px
  and shimmers. This is the one declared exception to "the classic branch is
  never edited" (§6.1): the line is shared, the guard is kind-scoped, and the
  CLASSIC 2D call-log hash is unchanged.
- **D3 Intro zoom and pinch zoom are quantized in px mode, wired at G1.**
  - One pure helper, `pxZoom(z,k)`, quantizes against `K = k` when `k` is
    whole (policy (b)) and `K = round(k)` when it is fractional (policy (a)),
    and returns the level `n/K` nearest to `z`, clamped inward to
    `[MIN_Z, MAX_Z]` (`cameraCtl.js:6`: 0.6 and 2.5). So `K·z` is always a
    whole number, an odd `k` never gets a half step, and **`pxZoom(1,k) === 1`
    for every `k` and every policy**: an untouched board is never drawn
    zoomed. Zoom-out keeps the levels `n/K` in `[0.6, 1)`: 2/3 at K 3, 3/4 at
    K 4, and so on. **At K 2 (iPhone SE portrait under (b)) there is no level
    in that range, so zoom-out is lost there**, and this is disclosed on the G1
    sheet.
  - **Pinch and wheel:** in px mode `cam.zoom` itself is snapped through
    `pxZoom` before it is clamped and anchored, so `clampAxis` and
    `zoomAnchor` compute the pan bounds at the zoom that is actually drawn (no
    gutters past the board edge, no cursor drift). This is an optional
    `snapZ` hook on `mountCameraCtl`, identity by default, so the 2D maths and
    `camera.test` are unchanged; it is listed as a px-guarded exception in
    §6.4.
  - **Intro:** `introPhase` keeps its raw value (`intro.test` stays pinned);
    the intro draw site (`main.js:695`, `c.scale(ph.zoom, ph.zoom)`) passes
    `pxZoom(ph.zoom,k)` in px mode, in place.
  - **Pan** is snapped to whole device px at the camera draw site
    (`main.js:703`, the `camTransform` call), in place.
  - This applies to whichever opening is live. The opening spec
    (`docs/superpowers/specs/2026-10-09-opening-design.md`) replaces today's
    1.55 → 1.0 flyover with a title drift at 2D zoom 1.12 and a show that sweeps
    to a close-up on MAKO; see §6.3a.
  - Node tests (G1): `pxZoom(1,k) === 1` for whole and fractional `k`; `pxZoom`
    composed with `clampAxis` at `MIN_Z` and `MAX_Z`, for odd and even `k` and
    for a fractional `k`; no zoom-out level at K 2.
- **D4 Scale policy is a G0 pick from rendered strips.** The candidates:
  - **(a)** nearest-neighbour at today's fractional fit;
  - **(b)** integer snap with letterbox (the CSS stage scale is chosen so `k`
    is whole; the backing store stays 600×520);
  - **(d′)** hybrid: (b) when its loss is 10% or less, else (a).

  Team recommendation: **(d′)**. `fitBox` itself is never changed (`fit.test`
  pins it). A new pure `pxFit` lives in `src/app/fit.js` beside `fitBox`,
  because `src/app/` may not import `src/render/` (`src/app/stats.js:203`).
  - **Dropped for now: (c) sharp-bilinear** (finalizer, 2026-10-09). It needs a
    backing store at a whole multiple of the board, but `#c` is 600×520
    (`sizeCanvases` sets `canvas.width` from `kindSize`) and `dims()` returns
    `canvas.width`, so a hi-res `#c` would move the HUD, the overlay, the
    `cameraCtl` bbox and the touch hit maps; and `index.html` sets
    `image-rendering:pixelated` on every canvas. Building it means a separate
    px world canvas under `#c` (like `#gl`) with its own size and
    `image-rendering`, touching `index.html` CSS, `fit.js` and `main.js`
    `sizeCanvases` (about +2–3 `main.js` lines), for about +1.5–2 engineering
    days. It returns only if the user rejects both (a) and (b) at G1 (K1-1),
    and is never shown at G0, so the sheet offers nothing the plan cannot
    deliver.
- **D5 [gate] Acceptance at G1, per policy,** on the d layout at 1366×768@1
  and 1440×900@2, measured from a CDP screenshot of a known checker cell:
  - **(b), or anywhere `k·z` is whole:** every art pixel is exactly the same
    whole number of device px. This is the only "uniform" claim.
  - **(a) at a fractional `k`:** uniform pixels are impossible (k 4.35 gives 4
    and 5 px). The width spread (for example 3/2 at k 2.77) is **reported as a
    disclosed figure, never as a pass**. (Finalizer note, 2026-10-09: the
    review asked for uniformity under (a) at k ≥ 4 too; declined, because it
    cannot hold at a fractional k.)
  - **(c)**, if it ever returns: the soft edge is at most 1 device px per
    art-pixel edge.

### 3.3 Palette: one function, verbatim bases

- **P1 [gate] One pinned ramp function, `pxRamp(base)`.** It works in OKLCH:

| Step | Lightness | Chroma | Hue |
|---|---|---|---|
| outline | L −0.36 | ×0.7 | shifted toward the 3D fill `#bcd4ff` (hue 262) by up to 24° |
| shadow | L −0.12 | ×0.92 | toward 262 by up to 20° |
| light | L +0.07 | ×0.9 | toward the key `#fff4e2` (hue 80) by up to 8° |
| specular | fixed `#fff8ec` | | not a lerp |

  The cool shadow shift is what clears VOID. MAKO's shadow measures **16.8** ΔE
  from VOID wallHi with the shift and **14.1** without it (`ad/ramp-gates.mjs`).
  `pxRamp` is frozen at G0 and pinned by a test. Any "warmer shadow" tweak
  re-breaks VOID.

- **P2 [gate] Every authored repo hex is the VERBATIM base step.** The existing
  gates therefore keep their meaning. This covers:
  - `BIOMES`;
  - MAKO `#c39cff` and eyes `#f2e6d2`;
  - ink `#12121e` and feet `#2e1a4e`;
  - kick feet `#c07a3a`;
  - the fin default `p.color` `#37f0d0`;
  - the nine `spawnEnemy` hexes;
  - the 12 `POWER` colours;
  - bomb `#15181f` and stroke `#0a0d14`;
  - the blast ramp `#ffffff`/`#fff3b0`/`#ffb347`/`#ff5d73`.

  Grids store **ramp slots, never hex**. The baker resolves:
  - foe slots from `spawnEnemy`'s colour;
  - MAKO from `PLAYER_HULL`;
  - the fin slot from `p.color`.

  The prototype's hard-coded hex breaks this rule.
- **P3 [gate] MAKO ramp:** outline `#3d427e`, shadow `#8183dc`, base `#c39cff`,
  light `#e2b2ff`.
  - Shadow, base and light pass the 56-swatch AND gate.
  - Each clears every VOID swatch by at least 14 ΔE: 16.8, 25.3 and 28.2.
  - The light step's luminance (0.760) stays below the eye cream (0.906), so
    the eyes stay the brightest field.
- **P4 [gate] Colour-count limits:**

| Element | A | B | C | Notes |
|---|---|---|---|---|
| Per-biome tiles | ≤8 | ≤12 | ≤16 | |
| Per character | ≤6 | ≤8 | ≤10 | plus the shared face trio: cream, ink and specular; for MAKO also plus the identity slots below |
| Shared FX, bomb and blast | ≤10 | ≤10 | ≤10 | |
| Global | ≤128 | ≤128 | ≤128 | |

  Characters never re-palette per biome.

  **MAKO's slots, counted (finalizer, 2026-10-09).** MAKO's mandatory slots
  are:
  - **body ramp, inside the cap:** outline, shadow, base `#c39cff`, light
    (O2/P3), plus C's extra shadow step and AA step where used;
  - **identity slots, outside the cap** (like the face trio): fin base
    `p.color`, the fin leading-edge highlight (M4), feet `#2e1a4e` (P2) and the
    cream-shadow tooth seam (M7);
  - **swaps, which replace a slot and never add one:** kick feet `#c07a3a`
    replaces feet; the hurt desaturation replaces the body ramp.

  So MAKO uses 4 of A's 6, 4 of B's 8 and 5–6 of C's 10 cap slots, plus 4
  identity slots and the trio. Before any artist starts, the TE's
  satisfiability step (S0c, §4.1) re-counts this against the canonical MAKO and
  fails the run if any direction's cap cannot hold it.
- **P5 [gate] No alpha inside cells.**
  - The ghost (0.4) and the iFrames blink happen at blit.
  - The contact shadow is an opaque per-biome floor-shadow step, not an alpha
    ellipse.
  - SHADE's faint shadow is that step tinted toward its colour.
- **P6 [gate] Never `#000000` anywhere.**

### 3.4 Outlines

- **O1 [gate]** No outline is pure black.
- **O2 [gate]** Characters, bombs, blast pieces and pickups get a **closed, coloured, dark outline**: the `pxRamp` outline step, and `#0a0d14` for the bomb and blast.
  - In directions B and C, non-gold characters (MAKO, walker, chaser, stationary, shade) may lift 2–4 px of the upper-left arc to the shadow step.
  - **fast, knight and burrow always keep the full dark ring.** CROWN `brickA` equals fast's base exactly (0.0 ΔE), so a lightened arc would erase all three golds on CROWN.
- **O3 [gate] Tiles get no outline**, only value steps:
  - the top face is light;
  - the front face is dark;
  - a 3-px floor-under-wall contact shadow.
- **O4 [human]** Interior lines appear only between same-value regions. Ink `#12121e` is reserved for pupils, the mouth and eye sockets.
- **O5 [human]** Line slopes are 1:1, 1:2, 2:1 or straight, with at most 1 orphan pixel per cell.

### 3.5 Light and form

- **L1 [human]** The key light is upper-left, matching the 3D warm key. A form crescent sits lower-right. Within one facing's cycle the light never changes side (D1). The 3/4-left facing is the mirror of 3/4-right, so its key flips once, on the turn: a **team ruling**, shown as a labelled pair on sheet row 5 and re-ruled at G1 from play (author the left facing instead if the user objects, about +2 cells per direction).
- **L2 [human]** No pillow shading: the light step never touches the lower-right outline.
- **L3 [gate]** MAKO's light step has L ≤ 0.80, so the eyes stay brightest.
- **L4 [gate]** The near-white body specular `#fff8ec` belongs to **knight only** among foes, at 1–3 px.
  - It measures 39.4 ΔE from CROWN wallHi, while knight's lerped light step measures only 6.3.
  - Eye and lens catchlights (≤2 px, inside the face mask) are a separate element and are allowed on every face.

### 3.6 Dithering

- **[gate] No dither on characters, bombs, blast or pickups, in any direction.** At k 2.4–3.8 a dither shimmers.
- **Tiles:**

| Direction | Rule |
|---|---|
| A | No dither. |
| B | No dither. Texture is 1–3 px clusters covering ≤6% of the tile. |
| C | At most one 2×2 checker band per tile face. If it shimmers on the scale strip at k 2.77, the AD removes it before the sheet ships. |

### 3.7 MAKO in pixels: the non-negotiables

These map every AGENTS.md MAKO rule onto pixels. The numbers are for the 20×20 cell. Direction C does **not** scale MAKO: it draws the same body and fins, and its 20×24 cell only adds up to 4 rows of eye and crown overhang above the body. M2's aspect is measured on the body and fin rows and excludes those overhang rows.

**One anatomy for all three directions.** The canonical MAKO front key frame
(S0b, §4.1) is the anatomy every direction renders. **M0 [gate]:** each
direction's MAKO front silhouette has mask IoU **≥ 0.85** against the
canonical mask, compared unscaled in every direction (C's overhang rows are
masked out of the comparison). A, B and C therefore differ in ramp, outline and tiles, not in fin
shape, eye size or taper.

| # | Rule | Check |
|---|---|---|
| M1 | **One mass.** No neck, no shoulders, no arms, no torso-over-legs. Widest at rows 10–13 (the onion taper, never a box): corners chamfered ≥2 px, and no straight vertical body-side run longer than 3 px. | [gate] side-run; [human] |
| M2 | **Front aspect** w/h ≥ 1.35 (vector 1.47; both prototypes 1.05–1.06). Half-span ≥ 6.8 art px (the `TILE*0.34` collision radius); target 9–10. | [gate] |
| M3 | **Chevron fins.** Each fin tip sits ≥2 px outside the body flank column on both sides. The outermost fin column is reached on the middle band of the mass (rows ~7–11), not the top rows. | [gate] |
| M4 | **Fins, not horns.** Root below the eye line (root row ≥ eye-centre row + 3). Highest fin pixel at or below the eye-top row, never above it, and ≥2 px inboard of the outermost fin column. Blade ≥3 px thick across its middle rows, tapering to a **broad tip ≥2 px**, never 1 px; the outer edge follows the vector's broad blade (outermost at about 1.30r, below the tip). No single bright pixel at the tip; the highlight runs ≥2 px along the leading edge. | [gate] |
| M5 | **Eyes break the crown.** Cream `#f2e6d2` occupies at least one full row above the body's top row, with a 1-px notch between the two bulges **on the axis column**, so the eye pair is odd-width and centred. This exaggerates the vector (0.8 art px) on purpose, and is disclosed. | [gate] |
| M6 | **Grin.** About 7×3 px, centred on the axis column. Corners 1 row above the lip centre. | [gate] |
| M7 | **Two blunt teeth, never fangs.** Exactly two white tooth blocks, each ≥2 px wide, height ≤ width, hanging from the top lip. They are separated by exactly one seam column **on the axis column** (2 + 1 + 2 = 5 columns) in the cream shadow step (never ink, never mouth-dark). No 1-px-wide white vertical run ≥2 tall anywhere in the mouth box. No white pixel below the grin. | [gate] |
| M8 | **`p.color` lives on the fins only.** The fin palette slot appears only inside the fin mask. The body base is exactly `#c39cff`. Kick feet are a palette swap to `#c07a3a`. | [gate] |
| M9 | **Value.** White (L* ≥ 90) ≤12% of MAKO's pixels, teeth included. **Outside the tooth mask** cream is the brightest field ≥3 px and only the 1-px eye specular is whiter. The tooth blocks are the vector's `#ffffff` and are exempt from the "only the specular is whiter" clause. | [gate] |
| M10 | **Views.** Front, 3/4 right (3/4 left = mirror about the axis column, one key flip on the turn: team ruling, §3.5 L1) and back. **Never a true profile:** the profile is where both prototypes grew a horn and a fang. The 3/4 view shifts pupils and grin 1 px toward the facing, with both teeth still visible. The near fin is 1 px longer and the far fin 1 px shorter, but still ≥2 px past the body. M3–M8 apply to every facing. **Fallback, matching CLASSIC 2D's facing rule:** front frames plus a 1-px pupil and grin shift for left and right (zero new anatomy); used only as the last cut (§4.3) or the G2 side-view fallback (§7.5). | [gate] per facing |
| M11 | **Back view.** No face. A dorsal panel plus a 1-row gill slot. Both fins keep the low-root sweep. Whether two hull-coloured eye bumps stay on the crown (identical outline in every facing) is the **G0 pick P-back**, folded into the MAKO question (§4.9 Q2), because CLASSIC 2D draws none from behind. | [gate] fins; pick |
| M12 | **Taste.** Angular cuts present, mid-value body, not "round and bright". Judged at in-game size only (§3.2). | [human] |
| M13 | **Death and hurt read as comic, never grim.** A squint, the fins fold, the body deflates, a teal-and-lavender puff. No skull, no X-eyes on a white head, no blood. | [human] |

**[gate] Regression fixtures, both ways:**
- **Negative:** both prototype MAKOs (`proto/pixart.js` MAKO_FRONT_A /
  MAKO_SIDE_A and `proto/mako_front.grid.txt`) **must fail** M2, M3, M4 and
  M7. That proves the gates catch the known failures.
- **Positive:** the canonical MAKO front (S0b), re-coloured into each
  direction's budget, **must pass** G-A and G-F in A, B and C. That proves the
  gates do not fail correct art, so no artist is pushed to drop the tooth seam
  or the fin highlight just to go green.

### 3.8 The foe cast in pixels

The cast is the same as `docs/superpowers/specs/2026-09-04-enemy-character-art-design.md`, with the same identity hexes. Art r = `e.r/2`. Separation always comes from structure, never a re-hue.

| Foe | Silhouette and footprint (art px) | Face | Facing | Must survive | Worst measured collision |
|---|---|---|---|---|---|
| walker `#8affc1` | flat-sided dome 13×13 (odd, axis column), low HORIZONTAL pods to ±6.9 | one 5-px creature eye under a 9-px visor bar | back view | eye, pods | WATER brickA 31.9 ΔE |
| sentry / stationary `#c58aff` | trapezoid wider at the base (7 top, 11 base, 10 tall), antenna nub, rivet row | lens in a dark hex housing, magenta core; a machine with no eyes | none | lens, base flare | MAKO 12.6 ΔE (disclosed; structure only); VOID brickHi composite 14.7 |
| fast `#ffd447` | down-pointing delta 12×9 with a V-notch, the only straight-edged footprint | visor slot with a 2-px lens | back view | delta, dark fins | **CROWN brickA 0.0** |
| chaser `#66c8ff` | up-pointing teardrop 11×12 with a crest spike | one low 5-px eye under an angled brow | back view | brow wedge | — |
| boomerang `#ff9dd6` | open C-ring 11 px, 3 blade teeth, 4-px core | 2-px lens | spins (90° rotations) | teeth | — |
| rocket `#ff7a59` | ogive about 16 tall, swept tail fins to ±7.4 | 3-px lens | 2-frame flame | flame | — |
| burrow `#c48a3a` | wide low oval 12×6–7, segment humps, mandibles | two 2-px eyes under a brow | back view | humps, mandibles | **SAND floor0 8.2 ΔE**, the worst in the cast and its debut room |
| shade `#6b7cff` | pointed hood 9–10 wide, jagged 4-point hem | VOID face hole, two glowing eyes | none | hem, eyes | VOID wallHi 38.2 |
| knight `#d4b05a` | 3-point crenellated top, pauldrons to ±6.9 | T-visor, two eyes split by a pale nasal bar | back view | crenellations, nasal bar | CROWN wallHi 12.2 |

Cast rules:
- **[gate]** MAKO is the widest character and the only one with swept-up side protrusions. Walker pods and knight pauldrons are horizontal.
- **[gate]** Pairwise silhouette-mask IoU ≤ 0.80.
- **[human]** Nothing else in the cast has cream eyes.
- **[human]** stationary always faces front; boomerang spins; rocket and shade never turn a face.

### 3.9 Environment, bomb, blast, pickups, ghost, HUD

- **ENV-1 [gate] Palette slots come only from `BIOMES` fields and `pxRamp`.** No new per-biome hex: AGENTS.md forbids restyling CROWN, and VOID's darkness is albedo.
- **ENV-2 [gate] WALL vs BRICK is structure, never hue.** "Gold wall, green brick" holds only in JUNGLE.
  - **BRICK** has:
    - ≥2 horizontal mortar runs plus staggered joints;
    - ≥12% of its pixels in the mortar slot;
    - a SHORT front face of `round(hBrick/4)` rows, clamped to 2–5.
  - **WALL** has:
    - zero mortar pixels;
    - a 1-px wallHi bevel;
    - ≥2 rivets;
    - a TALL front face of `round(hWall/4)` rows, clamped to 4–8.
  - Face heights reuse REAL 3D's `hWall`/`hBrick`, so the two looks agree on what is tall:

    | Biome | Wall face rows | Brick face rows |
    |---|---|---|
    | JUNGLE | 6 | 3 |
    | ICE | 8 | 5 |
    | FACTORY | 4 | 2 |
    | WATER | 7 | 4 |
    | ARENA | 5 | 3 |
    | SAND | 4 | 2 |
    | VOID | 8 | 4 |
    | CROWN | 6 | 3 |

  - The prototype put brick coursing on WALL. That is fixed.
- **ENV-3 Depth.** A floor tile under a WALL or BRICK draws a 3-px contact band. It reads the grid at draw time, so broken bricks and SHRINK rings update for free.
  - There is no wall autotiling, because SHRINK adds walls with no event.
  - A RIM tile (wall blended 35% toward `bg1`, echoing the 3D cabinet rim) is a W3 item, not part of the spike.
- **ENV-4 [gate] Floor detail** comes from a deterministic hash `(x*7+y*13+level*3)%5===0` and never `Math.random`.
  - It stays within 6 ΔE of the base.
  - It covers ≤10% of a tile's pixels and ≤20% of tiles.
- **T-edge [gate].** Wall and brick boundary pixels against the adjacent floor need ΔL* ≥ 15 on ≥80% of the boundary, in every biome.
  - Tile-average pairs must be **≥ the CLASSIC 2D baseline** for the same pair.
  - At the spike these are report-only; from G1 they are hard gates.
  - CLASSIC baselines (wall–brick / wall–floor / brick–floor), from `env/tileavg.mjs`, approximate to about ±3 ΔE:

    | Biome | Wall–brick | Wall–floor | Brick–floor |
    |---|---|---|---|
    | JUNGLE | 62 | 56 | 36 |
    | ICE | 36 | 26 | 20 |
    | FACTORY | 67 | 37 | 69 |
    | WATER | 26 | 29 | 32 |
    | ARENA | 47 | 38 | 50 |
    | SAND | 29 | 29 | **5** |
    | VOID | 44 | 20 | 57 |
    | CROWN | 29 | 32 | 56 |

  - Structure (mortar, faces, contact band) carries SAND. VOID WALL keeps ≥35% wallHi-slot pixels.
- **Bomb [gate].** A 14×14 art px disc, translated from Fusegrid's own `drawBombBody` and never a generic black lit-fuse bomb.
  - It keeps the **white "+" mark** and the `#15181f` body.
  - It has a lit rim (≥8 px at L* 30–50) and at most a 3-px highlight cluster, with no shine crescent.
  - The fuse burns down in 4 stages keyed to `1 − timer/world.fuse`, which is truthful at every heat (fuse 2.5 / 2.3 / 2.1).
  - Swell is 3 frames, ping-pong.
  - The silhouette must be ≥15 ΔE from both floors in every biome. VOID is 6–9 ΔE today.
- **Blast.** Pieces are classified from the **union** of all live blades with a 4-neighbour mask:
  - 0 or 4 neighbours, perpendicular pairs and T-junctions → CROSS;
  - two opposite neighbours → STRAIGHT;
  - one neighbour → END, rotated.

  A tile's age is that of the youngest covering blade. Rules:
  - **[gate]** Every piece has a `#0a0d14` ink ring on ≥70% of its boundary and ≥25% of its pixels at L* ≥ 95 in the full age. This is what separates it from gold and orange bricks in FACTORY, ARENA, SAND and CROWN (9–20 ΔE today).
  - The default language is **CELL** (per-tile rounded cells joined by bridges). It continues CLASSIC's per-tile read and the GRID name.
  - **BEAM** (a continuous band with node beads) is the shown alternative.
  - **The flame-tongue cross with tapered caps is banned**, because it is the genre classic's signature.
  - On a brick tile the arm band is ≤12 of 20 px, so the crumble shows underneath.
- **Brick-break.** Crumble frames key off `bl.t/bl.ttl` on tiles that the blast marked `{brick:true}`. That needs no fx state, survives a RENDER flip and replays identically.
- **Pickups.** Each pickup is drawn inside a 20×20 cell:
  - a dark round well (14 px);
  - the family ring language from REAL 3D: `cap` a single ring, `vit` a double ring, `utl` 6 dashes, `bls` a ring plus 8 ticks;
  - a glyph ≤12×12 that is a **nameable object** (semantic first).

  **When the glyph conflicts with the ring or the well, the glyph wins:** the
  ring drops to 1-px dashes, or the well shrinks, before the object loses a
  pixel that makes it nameable. FLAME and KICK (a boot) are drawn at the
  spike; the other ten are [draft] until W4.

  Rules:
  - **[gate]** No square cream panels; the prototype had them, and they carry brand and family-read loss.
  - POWER has no L* ≥ 95 core and stays inside its well, so it never reads as a live blast.
  - Motion is frames only: a cap blink, a 1-px vit bob, a utl dash shift, a bls ring pulse.
- **Ghost [draft].** It reuses MAKO's frames at blit alpha **`GHOST_A` 0.4**, the default pinned by `ghost.test`. It needs zero new frames. A 50% checker-dither silhouette is shown on the G1 sheet as a labelled variant only (P-ghost).
- **HUD, overlay, coach and menus stay vector** through the spike and the probe. The sheet shows this honestly, with vector chips drawn over the pixel board. Pixel HUD chips, GUIDE parity and a bitmap font are a G1 decision and an optional wave (W5).

### 3.10 Motion rules

Verified against the sim by the Animation designer. All of it is render-side,
and `src/core` is untouched. **Scope:** at the spike only A10 and the
walk-cycle frame counts in A1 apply; every other rule here is **[draft]** and
is re-ruled at G1, where the user plays it.

- **A1 Walk advances by distance, never by time.**
  - `p.walk` is a free-running clock (+1.0/s even when idle).
  - `p.face` is never cleared.
  - Foes have no walk clock.

  So `frame = floor(distAcc/STRIDE) % n`, with STRIDE 10 logical px:
  - MAKO has 4 frames, giving one cycle per tile: contact (idle), pass-L,
    contact, pass-R. Both passes are authored; the cycle never mirrors (D1);
  - foes have 2 frames.

  State lives in a WeakMap keyed by the entity object (enemies have no id). The ghost uses one fixed slot.
- **A2 Walk rate cap.** `WALK_FPS_MAX` 20 is proposed. Uncapped, MAKO reaches 27.6 fps at MAX_SPEED on HARD. Capped vs uncapped is a G1 pick (P-speed).
- **A3 Idle** means less than 0.5 px of movement over 6 `world.tick`s, counted in ticks rather than render frames, so 30/60/120 Hz agree.
  - On entering idle, MAKO snaps to idle frame 0.
  - MAKO's idle is 2 frames at 450 ms, using a 1-px breathe plus a 1-px fin sway.
- **A4 Facing comes from `p.face` / `e.dir` / the ghost's `fx,fy`, never from the position delta.**
  - The axis rule mirrors `snapFace`.
  - On an exact diagonal, the previous axis is kept (hysteresis).
- **A5 One renderer-local `animT`.**
  - It advances only in PLAY/WIN/LOSE and freezes in PAUSE, because `world.time` keeps climbing through PAUSE.
  - This deliberately differs from CLASSIC 2D, which bobs while paused. It is a G1 pick (P-pause) and can be overridden.
- **A6 Blast ages** are bucketed by `u = t/ttl` at the cuts `[0, .18, .55, .80]`:

  | Frame | Duration at `ttl` 0.34 s |
  |---|---|
  | grow | 61 ms |
  | full | 126 ms |
  | thin | 85 ms |
  | fade | 68 ms |

- **A7 Bomb tempo** steps with the fuse fraction:

  | Fuse fraction | Pulse |
  |---|---|
  | < 0.6 | 4 fps |
  | < 0.85 | 8 fps |
  | ≥ 0.85 | 12 fps, with a hot palette swap |

  The spark alternates `#ff5d73`/`#ffd447` at 8 fps. A kicked bomb rolls by distance.
- **A8 One-shots come from `world.events`.** The sim deletes foes, teleports MAKO and empties bricks on the same tick, so the renderer has to replay them:

  | Event | One-shot | Total time |
  |---|---|---|
  | `brick` | crumble, 4 × 80 ms | 320 ms, within `BLADE_TTL` |
  | `kill` | stunned pose 120 ms, then a shared tinted 4-frame puff | 400 ms |
  | `hurt` | a short desaturated corpse (3 frames) while the live MAKO materializes at spawn | 400 ms |
  | `lose` | the full 6-frame death | 700 ms |

  `win` uses 2 cheer frames. The state is kind-scoped (`fx.js` is a module singleton and is never extended) and is cleared on a RENDER flip, a run start or a new `world.grid`. Because `main.js` caches renderers per kind (`rcache`), a 2D → px → 2D → px flip reuses the same px renderer, so "cleared on a RENDER flip" is detected explicitly: `main.js` calls the px renderer's `reset()` hook inside the existing `if (k !== curKind)` block (`main.js:568`), counted in the `main.js` budget (§6.2). The lost-life read (P-life) is a G1 pick.
- **A9 REDUCE FLASH (`flx`=1):** no frame has a full-sprite near-white fill.
- **A10 [gate] Motion-stability lint:**
  - body-mask pixel count varies ≤10% across a cycle;
  - bob ≤1 art px;
  - the foot baseline stays within ±1;
  - one shared bottom-centre anchor;
  - mirroring may flip the light only on a facing change, never inside one facing's cycle: within a cycle, the centroid of the light-step pixels stays on the same side of the axis column, and the grin and teeth columns are identical across frames.
- **A11 Timing source of truth.** One frozen ES module (`spike/anim/timing.js`, promoted at G1 to `src/render/pixel/timing.js`). A number in two places is a defect.

### 3.11 Brand rules (never name the reference; write "the genre classic")

- **B1** Coloured outlines, never black linework (O1/O2).
- **B2** The hero is never humanoid. It never has a white or near-white round head, an antenna, a pompom or a helmet. MAKO's lavender body and teal chevron appear in every hero frame.
- **B3** Use Fusegrid's mid-value authored hexes and hue-shifted ramps. No primary-RGB pushes.
- **B4** Walls are the biome's own cabinet blocks per `BIOMES`, never grey riveted pillars.
- **B5** The bomb keeps CLASSIC's `#15181f` body, the "+" mark and the variant marks. No generic orb.
- **B6** No flame-tongue blast cross and no square cream power-up panels.
- **B7** No tracing, AI frames, stock packs or downsampled renders. Mood references are our own CLASSIC 2D and REAL 3D captures only. **One carve-out:** Fusegrid's own approved vector (`drawPlayerBody` and the foe bodies in `enemybody.js`) may be rasterized as an **underlay or landmark guide** (S0b). It is never shipped and never downsampled into final pixels; every final pixel is placed by hand.
- **B8** The reference name never appears in grids, IDs, files, comments, captions or review prompts. `banned-name.test.mjs` scans every tracked text file (`git ls-files`), so it covers `src/render/pixel/**` and this plan once committed; it never sees the git-ignored scratch or PNG pixels, so sheet captions get a manual BG check and `spike/` gets G-L.

State this risk openly. A 300×260 native frame sits close to a 16-bit console frame, so resemblance risk lives in character design and palette, which is exactly where B1–B8 apply.

### 3.12 Cohesion with CLASSIC 2D and REAL 3D

- **C1** The same cast and the same identity hexes (P2).
- **C2** The same upper-left key light and lower-right form crescent.
- **C3** The same 3/4 cabinet projection: wall top face plus front face, with characters upright.
- **C4** The same facing rules (§3.8).
- **C5** The same nameable pickup objects as `drawIcon`, redrawn and not reinvented.
- **C6** `p.color` appears on the fins only, and kick feet are `#c07a3a`, in all three looks.
- **C7** Face heights follow REAL 3D's `hWall`/`hBrick` (ENV-2).
- **C8** The GUIDE and HUD explain what the board shows. If the board is pixel and the GUIDE is vector, the mismatch is disclosed, and parity is decided at G1.

### 3.13 Resolved conflicts between the briefs (team rulings; the user may override)

| Topic | Brief positions | Ruling | Reason |
|---|---|---|---|
| Ramp function | AD: `pxRamp` (OKLCH, hue-shifted). Character: `dk`/`lt` lerps. | **`pxRamp`** | Measured: MAKO's shadow clears VOID at 16.8 with the cool shift and only 14.1 with a plain lerp, right at the floor. The Character brief's "ramp slots, not hex" rule is kept. |
| Spike candidate sets | AD: A BOLD / B CLEAN / C LIT. Character: Trace / Cut / Chunk. Env: three ramp/depth/ink/blast bundles. Producer: proportion and fin-angle axes. | **One A/B/C set: the AD's** (§4.2) | "B" must mean one bundle across every lane. Cut's angular rules (M1, M12) are mandatory in all three because they encode the user's maturity taste. Chunk's bigger head lives in C's 20×24 overhang rows. Trace's fidelity is B. MAKO's fin geometry is pinned by M3/M4, not varied as an axis. |
| Character size | Character: S16/S20/S24 strip. AD: 20 grid. | **S20 in A/B, 20×24 in C**, no S16 | S16 kills five foe faces (burrow, shade, fast lens, phantom teeth, knight bar) and MAKO's two teeth. |
| Teeth | AD direction A: 2×2 with a 1-px ink gap. Character: touching, cream-shade seam, never ink. | **M7: a 1-px cream-shadow seam, never ink** | Ink between white blocks re-creates the prototypes' "two pointed columns 2 dark px apart". Two touching blocks with a shadow seam stay two blunt teeth and are gate-countable. |
| Side view | Animation lint: one eye, one tooth or a closed mouth (a near-profile). AD and Character: a 3/4 turn showing both teeth. | **3/4 turn, both teeth** (M10) | The profile is where both prototypes failed. The Animation side lint is rewritten to M3–M8 per facing. |
| Fin margin | Animation: ≥1 px past the half-width. AD, Producer and Tech Lead: ≥2 px. | **≥2 px** (M3) | At 1 px the prototype read as horns. |
| Fin height | AD: tip ≤2 px above the eye top. Character: highest fin pixel never above the eye top. | **Never above the eye top** (M4) | It is stricter, and it matches the vector (the shoulder at −0.84r against the lid top at −0.85r). |
| Proportion gate | Producer: plan footprint ≥1.40. Character: front aspect ≥1.35. | **Front aspect ≥1.35** (M2) | 1.40 is the 3D plan-view rule. The 2D front sprite is grounded in the vector's 1.47. |
| Walk clock | AD and web research: `p.walk` / `world.time` / `e.time`. Animation and integration: distance. | **Distance** (A1) | Probed: `p.walk` runs when idle, and foes have no walk clock. |
| Contact shadow | Character: black ellipse at alpha 0.34. AD: no alpha in cells. | **An opaque floor-shadow step** (P5) | Alpha inside a pixel cell muddies on neon floors and is untestable on palette data. |
| Ghost | Env: checker-dither silhouette. AD: no dither on characters. `ghost.test` pins `GHOST_A` 0.4. | **0.4 alpha at blit** by default; the dither is shown as a labelled variant only | Keeps the pinned contract. The user may still prefer the variant. |
| Edge rule | AD: two-ring 85% at 14 ΔE. Env: ΔL* ≥15 on 80%. Character: dL ≥0.12 or ΔE ≥20. Tech Lead: CROWN ring ≥90%. | **Two-ring for actors (G-D); T-edge for tiles; one CROWN rule (G-E)** | The rules have different subjects: actor vs backdrop, and tile vs floor. One rule per subject. The Character and Tech Lead variants are subsumed. |
| Tile outlines | Env: "ink outline" as a tile axis. AD O3: tiles get value steps only. | **O3** | Ink applies to characters, bombs, blast and pickups in every direction. The tile axis is dropped. |
| Sharp-bilinear | Tech Lead (c): CSS `image-rendering:auto`. AD: integer nearest prescale, then one linear step. | **Neither, for now: (c) is dropped from P-scale** (finalizer, 2026-10-09) | Plain bilinear softens everything, and the AD's technique needs a separate px canvas the plan had not budgeted (§3.2 D4). It returns only via K1-1. |
| Mirroring | Animation: mirror the front pass for a 4-frame walk. AD: L1 upper-left key. | **Never mirror inside one facing's cycle; 3/4-left mirrors once, on the turn** (D1, A10) | A mirrored pass swaps the lit flank and catchlights every other step, a shading flicker; and a cell-edge flip moves the centred grin 1 px. |
| MAKO colour budget | P4 caps (A ≤6) vs the 8 mandatory MAKO slots | **Fin ramp, feet and tooth seam are identity slots outside the cap**, like the face trio | Correct art must be able to pass the gates; S0c proves it with the positive fixture. |
| Teeth vs M9 | M7 white tooth blocks vs M9 "only the specular is whiter" | **The tooth mask is exempt from M9's clause** | The vector's teeth are `#ffffff`; the anti-fang feature must not fail the value gate. |
| Specular | AD: knight only. Character: white catchlight in every creature eye. | **Body specular knight only; eye and lens catchlights ≤2 px everywhere** (L4) | They are different elements. The CROWN risk is body specular. |
| Settings bit | Tech Lead `px`; Producer and research `spr`. | **`px`** (working name) | Matches the short-key style of `nb.settings.v1`. Final at G1. |
| Spike scope | Producer 33 cells; AD 51; Character 41; Env about 100+; Animation 64. | **23 per direction, 69 plus 3 BEAM plus 1 canonical MAKO = 73 (§4.3)** with a written cut order | Fits the art day and a quarter at 15–30 min per on-model cell with three parallel artists, inside the 2.5–3-day box (§4). Everything else moves to G1 or G2. |
| G0 scope | Original plan: direction + MAKO + nine small picks. Two reviewers: cut to the essentials. | **Direction, MAKO check with P-back, P-scale, and P-blast only if BEAM survives the cuts.** Six feel picks move to G1 | Feel is judged better in play; one taste decision should not be diluted. P-back stays because it is part of "is MAKO still MAKO" and costs one cell edit. |
| Spike rooms | AD: JUNGLE/VOID/CROWN. Env and Character: SAND is the worst room (brick–floor 5 ΔE; burrow on floor0 8.2). | **Three full rooms plus a SAND stress strip** | SAND is where burrow debuts, and both designers flagged it independently. |

---

## 4. The art spike (immediate work)

**Owner (DRI, the one A):** the Art Director. The Producer/QA Lead (PQ) runs
the gate process and the decision log (R, not A) and calls the checkpoint and
the hard stop.

**Writes:** only `.superpowers/sdd/2026-10-09-pixel/` (git-ignored). Nothing
under `src/`, `tests/`, `docs/` or root changes.

**Starts:** at T0, after the pending fixes are pushed.

**Time box: 2.5–3 working days, hard stop at T0+3 days**, with at most one
internal fix round. Re-added critical path (finalizer, 2026-10-09; the earlier
1.5–2 days did not add up):

| Step | Days | Runs in parallel with |
|---|---|---|
| S0 tooling (RE, TE builds `gates.mjs`) ∥ S0b canonical MAKO (AD + CD) | 0.5 | each other |
| S0c gate satisfiability (TE) | 0.1 | — |
| Art, 23 cells × 3 directions (PA A/B/C) | 1.25 | staging, sheet shell, strips harness (RE, AN) |
| AD pre-screen | 0.25 | — |
| Blind read ∥ brand review | 0.25 | each other |
| One internal fix round | 0.25 | — |
| Sheet compose + skeptic pass | 0.25 | — |
| **Critical path** | **≈2.85** | ≈2.6 without the fix round |

**End-of-day-1 checkpoint (T0+1.5 days, called by the PQ):** at least **17 of
23** cells per direction are gate-green. If not, the PQ applies cuts 1–3
(§4.3) at once and logs them.

**Hard stop (T0+3 days):** the PQ either ships whatever is green, with a
disclosure line on the sheet naming every missing cell, or invokes **K0-6
"spike overran its box"** and asks the user whether to continue. The same rule
applies to the one extra user round (r2): 1 working day, hard stop at its own
start + 1.5 days.

### 4.1 Pre-flight (S0, Tech Lead, 0.25–0.5 day)

1. **Tooling into git-ignored scratch.** The research tooling lives in the session scratchpad and will vanish. Copy `cdp.mjs`, `serve.mjs` and `scalecheck.mjs` into `.superpowers/sdd/2026-10-09-pixel/tools/`, then:
   - patch `cdp.mjs` to take `{dpr, mobile}` (`deviceScaleFactor`) and to read the browser binary from `$CHROME`;
   - repoint `proto/scaleshot.mjs` to `../tools/cdp.mjs`, because it currently imports a missing `../cdp.mjs`.
2. **Housekeeping.** The research left a GET-only loopback server on port
   8791, several headless-browser processes and throwaway browser-profile dirs
   in the old session scratchpad. Stop the processes and delete the dirs. This is the Tech Lead's first action, and it is outside this plan author's write scope.
3. **Service-worker hygiene before any headed capture.** Unregister the SW and delete caches on **both** `127.0.0.1:8080` and `localhost:8080`, and use a fresh profile (AGENTS.md hazard).

**Acceptance:**
- `node tools/scalecheck.mjs` prints the 7-device table.
- `node proto/scaleshot.mjs` reproduces `out/variantA-nonint-scale.png`.
- `lsof -iTCP:8791` and `pgrep chrome-headless-shell` are empty afterwards.
- No tracked file differs from the spike-start SHA.

### 4.1a Canonical MAKO (S0b, AD + Character Designer, 0.25–0.5 day, parallel to S0)

Both earlier agent MAKOs went off-model. Three artists given only numbers would
also differ in anatomy, and the user's pick would become "whose MAKO came out
best" instead of "which style". So one anatomy is fixed **before** the split:

1. **Landmark masks.** Rasterize Fusegrid's own approved `drawPlayerBody`
   vector, and the four spike foes from `enemybody.js`, at MAKO r = 7.2 art px
   on the 20 grid (headless Chromium via `tools/cdp.mjs`), into landmark masks:
   silhouette, fin polygon, eye centres, grin box, teeth and the lit facet. One
   set per facing the vector has; the 3/4 and back masks derive from the front
   by the M10/M11 rules. This uses the B7 carve-out: underlay and guide only.
2. **One canonical front key frame.** The AD hand-places one MAKO front idle on
   the 20 grid over those masks, on an odd body width with the axis column
   (§3.1), and it must pass G-F. It is:
   - the positive fixture for G-K;
   - the anatomy all three directions render (M0, IoU ≥ 0.85), with C adding
     only crown overhang rows above it;
   - **locked at spike start**, not at G1.
3. **Output:** `spike/canon/mako_front.mjs` plus `spike/canon/masks/*.json`.
   The AD's sign-off goes into `gates.json` → `canon`.

### 4.1b Gate satisfiability (S0c, TE, 0.1 day, before any artist starts)

1. Count MAKO's mandatory slots against each direction's cap (§3.3) and confirm
   the identity-slot rule holds.
2. Check each direction's stated MAKO dimensions (§4.2) against M2/M3 on paper.
3. Run G-A and G-F on the canonical front re-coloured into A, B and C. All
   three must pass, and the negative fixtures must fail.

If any of this is red, the TE and the AD fix the **gate or the spec** (logged
as a team ruling), never the canonical art to fit a broken gate. Artists start
only on a green S0c.

### 4.2 The three directions (all on the 20 grid, plus CLASSIC 2D and REAL 3D as controls)

All three follow §3 in full: M0–M13, the brand rules and ENV-2. All three
render the **canonical MAKO** (§4.1a), so they differ only on these axes, and
never in MAKO's anatomy:

| | **A, BOLD** | **B, CLEAN** | **C, LIT** |
|---|---|---|---|
| Character cell | 20×20 (18×18 working area) | 20×20 | 20×24, ≤4 px overhang up |
| Outline | closed dark ring, no lift | closed ring, 2–4 px lit-arc lift (non-golds) | closed ring, lit-arc lift, plus a 1-px cool rim lower-right (`#bcd4ff`-tinted step), C only |
| Ramp | 2 steps + ≤4-px light cluster | 3 steps + 1-px specular | 4 steps + specular; manual AA ≤1 intermediate px per curve step |
| Colours per character | ≤6 + face trio (+ MAKO identity slots) | ≤8 + face trio (+ MAKO identity slots) | ≤10 + face trio (+ MAKO identity slots) |
| MAKO | the canonical, with ≤1 px exaggeration on the hooks within IoU ≥ 0.85 (chamfer facets; fins 4→2 px taper, ≥3 px across the middle rows, broad tip, outer edge at about 1.30r below the tip); eyes 5×5 | the canonical as drawn: odd body width, fin span 19 (odd, about the axis), eyes 4–5, one lit flank facet | the canonical, unscaled, in the 20×24 cell: body 15 wide (17 would push the ≥2-px fins past the 20-px cell); the ≤4 overhang rows carry taller eyes and crown (eyes may grow 1 px); fins keep the M3/M4 geometry; M2 excludes the overhang rows |
| Tiles | 2 tones + highlight edge, no texture | 3–4 steps, texture ≤6% in 1–3 px clusters; brickA ≤60% of the brick face | 4–5 steps, one 2×2 dither band per face, texture ≤10% |
| Blast arm width | 8 px, 3-tone | 10 px, 4-step | 10 px, 4-step |
| Read | sticker-bold, most robust at low k | "CLASSIC 2D, hand-pixelled" | hi-bit, closest to REAL 3D's light |
| Known risk | chunky can read cute ("silly"), so angular cuts are mandatory | may be hard to tell from A at in-game size (the skeptic checks) | AA and dither may shimmer at k < 3; busier at in-game size; **big eyes on a bigger head is the "round and bright reads silly" risk** (player-art-maturity), so eye growth is capped at +1 px and the AD checks it at in-game size |

Sheet labels stay neutral: A / B / C / CLASSIC 2D / REAL 3D. No direction is
recommended to the user before the pick. A/B/C form a fidelity ladder, so at
about 2.8 device px per art px two of them may look alike on the characters.
If the skeptic's distinguishability check (§4.7) finds that, the sheet says so
plainly (for example "A and B differ mainly in tiles") instead of presenting
three equal options.

### 4.3 Cell list (identical across A, B and C)

Per direction, **23 authored cells**:

| Group | Cells | Count | Why |
|---|---|---|---|
| MAKO | front idle (from the canonical); front walk-pass L; front walk-pass R (both authored, never mirrored: D1); 3/4-right idle; 3/4-right walk-pass; back idle (the P-back eye-bump variant is a ≤6-px edit of the same cell) | 6 | every facing, plus a 4-frame front walk (contact, pass-L, contact, pass-R) |
| Foes | walker front + walker step | 2 | the baseline foe, with motion |
| | fast front | 1 | CROWN gold collision (0.0 ΔE) |
| | sentry front | 1 | violet near-collision with MAKO and VOID |
| | burrow front | 1 | SAND floor0 collision (8.2 ΔE) |
| Bomb | body + swell (hot = palette swap) | 2 | fuse loop |
| Blast | CROSS, STRAIGHT, END at full age (thin and fade by `pxRamp` step-down swap) | 3 | blast loop |
| Brick-break | chunks frame | 1 | crumble read under the arm |
| Tiles | floor0, floor1, wall, brick template, palette-baked to JUNGLE, VOID, CROWN and SAND | 4 | 16 runtime tiles |
| Pickups | FLAME in well + `cap` ring; **KICK as a boot** in well + its family ring | 2 | semantic-first check on the easiest object and on one the user has seen misread (KICK read as a slipper) |

**Plus 3 cells:** BEAM CROSS/STRAIGHT/END in direction B's palette, for the
blast-language pick. **Plus 1:** the canonical MAKO front (AD, S0b), shared by
all three.

**Totals:** 69 + 3 + 1 = **73 authored cells**, about 115 runtime cells after
the 3/4-left mirror, rotations and palette swaps.

**Cut order** (applied at the T0+1.5 checkpoint if it is missed, and at the
hard stop; the PQ logs every cut on the sheet):
1. the BEAM strip (P-blast is then not asked; CELL is the default);
2. the crumble frame;
3. the walker step (foes go still plus a 1-px bob);
4. MAKO's 3/4 walk-pass (3/4 becomes a still);
5. direction C entirely (the sheet shows A and B plus a disclosure);
6. last resort: the 3/4 idle, replaced by CLASSIC 2D's facing rule (front
   frames plus a 1-px pupil and grin shift for left and right, M10).

**Never cut:**
- MAKO's front idle, both front walk-passes and the back;
- the 3/4 idle, except by last-resort cut 6;
- fast, sentry and burrow;
- the tiles for all four biomes;
- the bomb and the blast;
- **both pickups, FLAME and KICK**;
- the CLASSIC 2D column, and REAL 3D on row 1;
- identical slot lists across the surviving directions.

### 4.4 Small picks (not bundled into A/B/C)

G0 asks only what bears on "is it worth it". Everything else is a feel
question, judged better in play at G1, where the probe plays the team default
and the G1 sheet shows the alternative as a clip captured from the live probe
(no bespoke capture harness).

**At G0** (answered by letter on the sheet):

| ID | Pick | Shown as |
|---|---|---|
| P-scale | Display policy (a) nearest / (b) snap / (d′) hybrid (§3.2 D4; (c) is not offered) | MAKO + walker crop at k 2.39, 2.77 and 3.77, captured at real dpr 2/3 |
| P-blast | CELL vs BEAM, **only if the BEAM strip survives the cut order** | blast strip |
| P-back | MAKO back view with or without the eye bumps, folded into the MAKO question | back cell pair |

**Moved to G1** (team default until then, in brackets):

| ID | Pick |
|---|---|
| P-snap | Motion on the 2-px art grid [default] vs the 1-px logical grid |
| P-speed | Top-speed walk capped at 20 fps [default] vs uncapped |
| P-life | Short corpse + materialize [default] vs a minimal fin-fold flash |
| P-ghost | 0.4 alpha [default] vs checker silhouette |
| P-pause | Board frozen in PAUSE [default] vs bobbing (CLASSIC today) |
| P-intro | Stepped intro zoom [default] vs pan-only at zoom 1 |
| P-turn | 3/4-left as a mirror (one key flip on the turn) [default] vs authored |

### 4.5 Tooling and files (all under `.superpowers/sdd/2026-10-09-pixel/spike/`)

| File | Owner | What it does |
|---|---|---|
| `palette.mjs` | colour engineer (TE) | `pxRamp`. Imports `BIOMES` from `src/core/config.js`, the enemy hexes from `src/core/entities.js` and `PLAYER_HULL` from `src/render/sprites.js`, read-only. Builds per-direction palettes. |
| `grid.mjs` | TE | `decodeGrid(rows,pal)` to RGBA in pure Node, plus `mirror`, `flipX(cell, axis)`, `rot90` and `swap` (fins, kick feet, hot bomb). `flipX` mirrors about the cell's own `axis` column, never the cell edge. Mirrors and rotations are generated, never hand-copied. |
| `canon/mako_front.mjs`, `canon/masks/*.json` | AD + CD | The canonical MAKO front and the landmark masks (§4.1a). |
| `dir-a/cells.mjs`, `dir-b/cells.mjs`, `dir-c/cells.mjs` | artist agents A, B and C | Palette-slot string grids. `.` is transparent. Each cell carries meta `{direction, author, axis, gates, adSignoff, userVerdict}`. |
| `gates.mjs` | TE | The **one** gate script (§4.6). Writes `out/gates.json`. |
| `bake.mjs` | TE | Derived from `proto/bake.mjs`; `node:zlib` PNGs. |
| `stage.mjs` | Render engineer (RE) | Builds the staged boards: `createWorld`/`loadLevel` for room 1 (JUNGLE), room 7 (VOID) and room 8 (CROWN), seed 4242 at heat 0, plus a SAND strip. It places the spike cast: MAKO, walker, fast, sentry and burrow; two bombs (fuse stages 1 and 4); one blast crossing another and crumbling at least 2 bricks; 1–2 FLAME pickups; and the ghost. Real rooms 7 and 8 also roster shade and knight, which are not drawn until W2. The staging is labelled. |
| `anim/timing.js`, `anim/strips.mjs` | Animation designer | One motion **frame strip** per direction: the MAKO front walk cycle, the fuse stages and the four blast ages, laid out at in-game size with each frame's ms. No sim-driven capture at the spike (that harness is the live probe at G1). A plain looping APNG built from the same frames is optional. |
| `sheet.html`, `sheet.mjs` | sheet engineer (RE) | Compose the sheet through headless Chromium via `tools/cdp.mjs`. |
| `ref/` | RE | CLASSIC 2D reference captures of the staged states, from the live game at `127.0.0.1:8080` with `?debug=1` (`window.__GAME__` exposes the world, `loadLevel` and `step`), after the SW cleanup in §4.1. **REAL 3D context is the existing JUNGLE capture only** (`out/real-3d-board.png`, row 1). No new VOID or CROWN 3D captures: REAL 3D is not a candidate. |

### 4.6 Gates (`spike/gates.mjs`, one script, one `out/gates.json`)

**Rules for the script:**
- It is zero-dependency Node and runs in under 5 s.
- It exits non-zero on any failure.
- A direction must be green before it can appear on the sheet.
- Formulas (`lum`, `hueOf`, `chromaOf`, `labOf`, `dE` (a ΔE76), `overA`, `biomeSwatches`) are copied **verbatim** from `tests/items-art.test.mjs`, so the later `tests/pixel-art.test.mjs` is a port, not a rewrite.

| ID | Check | Threshold |
|---|---|---|
| G-A | Grid hygiene | Size exactly 20×20 (20×24 for C characters). Every key in the palette. Colour counts per P4 (MAKO identity slots counted outside the cap). MAKO and walker carry an `axis` column and an odd body width. No partial alpha. No `#000000`. |
| G-B | MAKO steps vs the 56-swatch AND gate | Shadow, base and light pass. A swatch fails only if dL < 0.12 **and** dHue < 25. |
| G-C | VOID | Every MAKO step and fin step ≥14 ΔE76 from every VOID swatch. Base ≥40 from VOID brickA. |
| G-D | Two-ring edge rule, per character × spawn biome × {floor0, floor1, brickA, brickHi@.55, wall, wallHi} | ≥85% of perimeter positions have the outline pixel **or** the first inner pixel ≥14 ΔE from the backdrop. |
| G-E | CROWN golds | fast ≥35% of opaque px in outline, shadow or dark-fin steps. Body specular `#fff8ec` on knight only. burrow base L* ≤ fast base L* − 15. |
| G-F | MAKO on-model, every facing | M0 silhouette IoU ≥ 0.85 vs the canonical mask, M1 side-run, M2 aspect and half-span, M3 chevron, M4 horn test, M5 crown and notch, M6 grin corners, M7 teeth, M8 `p.color` mask, M9 white share (tooth mask exempt from the specular clause). |
| G-G | Cast silhouettes | Pairwise mask IoU ≤0.80. MAKO is the only swept-up protrusion. |
| G-H | Environment | ENV-2 structure (mortar on brick ≥12%, zero mortar on wall, rivets, face rows). VOID wall wallHi ≥35%. T-edge and tile-average vs CLASSIC baseline are reported. |
| G-I | Bomb, blast, pickup | Bomb: "+" present, rim and value counts, ≥15 ΔE vs floors in all biomes. Blast: ink ≥70% and white-hot ≥25%. Pickups (FLAME and KICK): no square panel; family ring ≥30 ΔE from VOID floor0. |
| G-J | Motion lint | A10 across each authored walk cycle, including: within one facing's cycle the light-step centroid stays on the same side of the axis column, and the grin and teeth columns are identical in every frame. |
| G-K | Regression fixtures | **Negative:** `proto/pixart.js` MAKO_FRONT_A / MAKO_SIDE_A and `proto/mako_front.grid.txt` **FAIL** G-F. **Positive:** the canonical MAKO front, re-coloured into each direction's budget, **PASSES** G-A and G-F in A, B and C. Either one wrong makes the run red. |
| G-L | Brand grep | The `tests/banned-name.test.mjs` regex over `spike/` returns no match. Raw blind-read answers are stored in `review-raw/`, outside `spike/`, because a naive reviewer may name the genre classic (§4.7); if they were stored under `spike/`, G-L would trip on them by design. |

**Baseline evidence:**
- `ad/ramp-gates.mjs` today shows the MAKO steps passing.
- fast's base is 0.0 ΔE and its light 4.2 ΔE vs CROWN.
- knight's light is 6.3 vs CROWN wallHi.
- burrow's outline is 11.1 vs CROWN floor0, so its shadow step (17.3) carries it.
- MAKO's outline fails the AND gate on ICE.wall and FACTORY.floor0/1 by design, which is exactly why G-D exists.

### 4.7 Human checks before the user sees anything

1. **AD pre-screen** (0.25 day), per cell. Recorded in `gates.json` → `review.ad`.
   - **MAKO, 10 points:**
     - chevron;
     - fins, not horns;
     - eyes break the crown;
     - two blunt teeth and no fang;
     - `p.color` on fins only;
     - mid-value body;
     - eyes the brightest field outside the teeth;
     - back keeps the fins;
     - 3/4 shows both teeth;
     - no profile.
   - **Foes:** distinct contour, a face or lens present, the facing rule obeyed.
   - **Taste at in-game size (§3.2):** not "round and bright", angular cuts present; for C, the eyes are not reading big and cute.
   - **Rounds:** one internal fix round is allowed.
2. **Blind read** (0.1 day, run by the TE). Three fresh reviewer agents see
   **only** in-game-size crops (k 2.77 and 3.77, §3.2), with no spec. Native
   and zoom crops are never shown to them.
   - **Questions on MAKO:** "Describe it in 5 words. What animal or object is
     it? Does it have horns, fangs, a weapon?"
   - **Positive question on an unlabelled cast line-up:** "Which one is the
     player character, the friendly one?"
   - **Foes and pickups:** a foe-to-name match against the in-game FOES help
     lines, and naming both pickups.
   - **Brand question:** "Does this remind you of a specific existing game?
     Which one?"
   - **Fail words, scoped to MAKO only** (the sentry legitimately has an
     antenna nub and reads as a machine): horn, horned, devil, demon, imp,
     fang, vampire, bat, cat-ears, bunny, antenna, robot, box, cube, human,
     person, monster.
   - **Pass:**
     - ≥2 of 3 reviewers use no fail word about MAKO;
     - ≥2 of 3 pick MAKO as the player or the friendly one;
     - each foe is matched by ≥2 of 3;
     - **FLAME and KICK** are each named by ≥2 of 3 (KICK as a boot or shoe
       for kicking, not a slipper).
   - **Brand answers:** any answer naming the genre classic becomes a BG flag,
     which is fixed or the direction is withheld. Raw answers stay in
     git-ignored `review-raw/` and are never quoted in captions or committed
     files.
   - Recorded in `gates.json` → `review.blind` (verdicts only, no raw text).
3. **Brand & Spec Guardian** (0.25 day, in parallel with the blind read). B1–B8
   against the sheet and captions, plus an originality line ("no traced, AI or
   stock pixels; the S0b underlay was guide-only"), plus every brand flag from
   the blind read. Recorded in `review.brand`. The AD cannot overrule a BG
   flag; only the user can.
4. **Skeptic** (0.25 day). An adversarial pass over the composed sheet:
   - does the sheet flatter any column, is every row at its stated k, and is
     the "none" option visible?
   - **one sentence per direction: "is this worth a third look vs CLASSIC
     2D?"** (a value judgement, so it sits here, not with the BG);
   - **distinguishability:** two fresh reviewers sort unlabelled in-game-size
     crops of MAKO and walker on the same floor from A, B and C. If two
     directions cannot be told apart, the sheet says so (for example "A and B
     differ mainly in tiles").

   Recorded in `review.skeptic`.

A direction that fails any of these is fixed once or **withheld**, and the
sheet says which and why.

### 4.8 The pick sheet (the user's decision artifact)

**Primary: `spike/sheet.html`.** Image viewers rescale PNGs, so a PNG cannot
promise true size.
- The page draws every panel from the baked grids at the **game's computed
  `k` for the device's full window size** (the repo's `fitBox` maths fed the
  device's full screen size, not the frame the page sits in), with the same
  `image-rendering:pixelated`. Inside a claude.ai Artifact `fitBox` would
  otherwise run on the artifact iframe's viewport, so the `k` shown would not
  be the in-game `k`.
- **Every row prints the measured `k` and `dpr`** it was drawn at, and the page
  says how `k` was derived, so a wrong size is visible rather than silent.
- The user opens it on the laptop **and** the phone. For the phone, it is
  published as a private claude.ai Artifact page, which needs no repo change.
- It also embeds the motion strips.

**Secondary: per-row PNGs.** `out/pick-sheet-r{n}-*.png` at the laptop's
in-game `k` (2.77), for the record and for SendUserFile, each captioned with
its `k`. A `-zoom` file holds the ×6 craft crops, captioned "zoom — do not
judge here".

Rows, in order. Columns are CLASSIC 2D | A | B | C with neutral labels, the
same board and the same moment in every column. REAL 3D appears on row 1 only,
from the existing JUNGLE capture, as context; it is not a candidate.

| # | Row | Notes |
|---|---|---|
| 1 | JUNGLE room 1, full board, staged state | Vector HUD chips drawn on top for mixed-look honesty. Plus the REAL 3D context column. |
| 2 | VOID room 7, full board | MAKO + sentry + bomb on the wallHi band. |
| 3 | CROWN room 8, full board | fast on gold brick + a blast cross. |
| 4 | SAND stress strip | Wall, brick, floor A/B, bomb, blast-on-brick, burrow, fast. |
| 5 | Cast line-up at in-game size (§3.2) | MAKO (4 facings, the 3/4-left mirror labelled "team ruling: key flips on the turn"), walker, fast, sentry and burrow, on JUNGLE, VOID, CROWN and SAND floors; FLAME and KICK in their wells. A silhouette panel shows every cell flat on white. |
| 6 | Motion strips | Per direction, one frame strip: the MAKO front walk cycle, the fuse stages and the four blast ages, at in-game size with each frame's ms. Looping APNGs optional. |
| 7 | G0 picks | P-scale, P-back, and P-blast only if BEAM survived (§4.4). |
| 8 | Zoom ×6 craft row | Labelled "zoom — do not judge here". |

Native-size crops anywhere on the sheet are labelled "do not judge".

Printed on the sheet:
- **the pick list:** A / B / C / "mix: X's ___ into Y" / "none, keep CLASSIC 2D" / free text ("characters only" is asked at G1, after play);
- **the status block:** round, cells done/planned, gate result x/12, withheld directions, cuts applied, the skeptic's distinguishability line;
- **one honest line:** "HUD and menus stay in today's style during the spike and the probe."

### 4.9 How the user picks (the questions, sent with the sheet)

1. "Open the page on your laptop and your phone. Looking only at the full boards and the motion strips: which do you prefer, **A, B, C, or CLASSIC 2D as it is**?" (Choosing CLASSIC 2D ends PIXEL.)
2. "Is MAKO still MAKO in your pick, from the front, the 3/4 view and from behind? Behind: with or without the eye bumps (P-back)? If not, what is wrong?"
3. "How should the pixels sit on your screen (P-scale)?" and, only if the BEAM strip was drawn, "CELL or BEAM blast (P-blast)?" Either can be answered "no preference", which takes the team default.
4. "Anything from another column you want carried into your pick?" This allows one half-day mix round, once.

The six feel picks and P-turn are asked at G1, after the user has played.

The PQ (the orchestrating session) records the verbatim answer in the
decision log (§7.3) and appends a dated line to `MEMORY.md`.

### 4.10 Spike done-definition

The spike is done when all of the following hold:
- Every shown direction is green in `gates.json` (including both G-K fixtures)
  and carries AD, blind-read and brand sign-off; or K0-1 / K0-6 was invoked and
  logged.
- The sheet's sha256 is in the decision log.
- The user's verdict is recorded verbatim.
- No tracked file differs from the spike-start SHA.
- On a pick:
  - the direction's master palette and `pxRamp` freeze;
  - the decision goes to `MEMORY.md`;
  - the RE may start G1.

---

## 5. Gated roadmap after the spike

Every stage uses the same block: Owner, Inputs, Outputs, Acceptance, Effort,
User gate, Kill.

### G0: spike pick

The spike is §4. The gate outcomes:

| Outcome | What follows |
|---|---|
| Pick A, B or C | Go to G1. |
| "Mix" | One 0.5-day round, then re-show. |
| "None" | Stop: PIXEL is shelved. The grids stay in scratch, and the decision is logged. |

"Characters only" is not a G0 outcome. It is decided once, at G1 (Q2), after
the user has played the probe.

**Kill criteria:**
- **K0-1.** No direction passes G-F/G-K and the blind read after one internal round. The user still gets **one compact sheet**: the best failing MAKO per direction, each gate failure labelled in red, next to CLASSIC 2D, together with the human-artist question (§9 Q3). Several gates are the team's own readings (M5 exaggerates the vector on purpose; M2 uses 1.35), so the user may overrule a false positive from the rendered cells.
- **K0-2.** The user judges no direction better than CLASSIC 2D at in-game size.
- **K0-3.** Two user rounds pass without a pick.
- **K0-4.** A direction passes VOID or CROWN only by re-hueing an authored hex. That direction is dropped.
- **K0-5.** A brand flag cannot be fixed without losing MAKO's identity.
- **K0-6.** The spike overran its box (hard stop at T0+3 days, or r2's own stop). The PQ ships what is green with a disclosure line, or asks the user whether to continue.

### G1: `?render=px` probe (flag only, branch `px-probe`, never merged before the G1 go)

| | |
|---|---|
| **Owner (A)** | RE. The AD is responsible (R) for the probe art. |
| **Inputs** | The G0 pick. The frozen `pxRamp` and master palette. The spike grids and the canonical MAKO. |
| **Probe art (about 81 cells)** | MAKO full set, about 27: 3 facings × (idle 2 + walk 4), plus death 6, win 2, hurt 1. Walker, stationary and fast in full (3 facings × 2 walk + pose each, about 21). **shade, knight and burrow minimal: front idle + 1 step each (6)**, so VOID, CROWN and SAND are judged on drawn actors. The tile template + 4 crumble frames for JUNGLE, VOID and CROWN. Bomb 3 + overlays for 4 variant marks. Blast 3 pieces × 4 ages, in the G0 blast language. Anything still not drawn falls back to the procedural painter, and the G1 sheet lists every fallback actor by name. |
| **Engineering** | §6.2. G1 is the one home of: the scale policy (`pxFit` + the P-scale pick), draw-site zoom and pan quantization (D3), the shake snap (D2), the hurt and lose one-shots (`src/render/pixel/oneshot.js`) and the delivery path below. |
| **Delivery to the phone (owner RE)** | The probe lives on branch `px-probe`, Pages deploys only `main`, and `serve.js` binds `127.0.0.1` only (`serve.js:53`; AGENTS.md "Do not rebind serve.js"). Default path: publish the branch's static tree as a **private multi-file claude.ai Artifact** (static ES modules with relative paths, no build step). The artifact runs on its own origin, so the RE first checks that the SW registration fails soft there and that the page boots with empty storage. Fallback, if that fails: G1 is played on desktop only and the phone is covered by headless dpr-3 captures, said plainly on the G1 sheet. Rebinding `serve.js` to the LAN changes an AGENTS.md rule and needs the user's explicit approval; it is not the default. |
| **Reaching rooms 7 and 8** | A fresh origin has no first FUSE/GRID CLEAR, and `flags.js` has no room parameter. On `px-probe` only: `?room=N` (1–8), honoured **only together with `?debug=1`**, parsed in `flags.js` and applied through `debughook.js`'s existing `loadLevel` path. No store write, no `src/core` change; dropped or re-ruled before any merge. |
| **Outputs** | Branch `px-probe`; `tests/pixel-art.test.mjs` and `tests/pixel-render.test.mjs`; headed captures; the G1 sheet with the feel-pick clips (§4.4); `MEMORY.md` entry. |
| **Acceptance** | See below. |
| **Effort** | Engineering **4–6 days** (re-estimated: renderer, atlas, anim, one-shots, the full G-A…G-L port, two test files, scale policy, zoom quantization, PWA, delivery, headed CDP at three dprs). Art 3.5–5.5 days, in parallel. |
| **User gate (G1)** | See below. |
| **Kill** | See below. |

**Acceptance:**
- `npm test` is green on Node 26 with **zero edits to existing tests**. The new tests and the shell.js SRC entries are additions.
- The `src/core` diff is empty.
- `main.js` grows by **≤ +2 lines** by split against the spike-start SHA (781 at `2b3df91`; see §6.2 and §6.3a), never past 799.
- CLASSIC 2D is byte-identical in behaviour, shown by a call-log hash pin.
- D5 holds **per policy** (§3.2): uniform under (b); the spread is reported under (a).
- The portrait board loss under the chosen P-scale is measured and reported.
- Bake ≤50 ms; px world draw ≤4 ms per frame on the fat world.
- The headed run is done in real headless Chromium at dpr 1/2/3, after the SW and caches are cleared on both loopback origins. The loop is driven by the MessageChannel rAF shim, with assertions on `window.__GAME__`.

**User gate (G1):** the user plays `?render=px&play=1` for one room in each of JUNGLE, VOID and CROWN (via `&debug=1&room=7` and `&room=8`), on desktop and, through the delivery path above, on the phone, and gives a go or no-go. On a go, the user also answers the G1 feel picks (§4.4) and rules on Q1–Q4 in §9, including full look or characters only (Q2). The MAKO model sheet locks here.

**Kill:**
- **K1-1.** Pixel swim or shimmer is still unacceptable under (a) and (b). Fallback: offer (c) with its separate canvas (§3.2 D4, about +1.5–2 engineering days), or characters-only at the best policy, or stop.
- **K1-2.** The in-play feel is not better than CLASSIC 2D. **Stop.**
- **K1-3.** Any `src/core` change would be needed. Stop and escalate; this should be impossible.
- **K1-4.** G1 passes 6 engineering days or 7 art days. Freeze and report to the user before spending more.

### G2: full PIXEL look in waves

**Common rules for every wave:**
- Art takes at most 5 working days per wave, with at most 2 user rejection rounds.
- Each wave has its own contact sheet at in-game size, on the §4.8 template, against live boards.
- `tests/pixel-*.test.mjs` must be green in CI.
- The AD signs off and the BG gives a brand PASS.
- A wave rejected twice escalates to the user with three options: redraw, a human artist, or descope.

| Wave | Owner | Contents (authored cells) | Acceptance specific to the wave | Effort |
|---|---|---|---|---|
| **W1 Characters, part 1 + bomb extras** | Character Designer | Only what the probe did not draw: MAKO materialize 3 and kick/throw poses 2; chaser 7; boomerang 3 (spin by rotation); rocket 7; the shared foe puff 4; bomb roll 2 and fuse-stage overlays 4. About 32. | G-F on every MAKO frame. A10 motion lint. Two-ring on all 8 biomes. | ≤5 art days |
| **W2 Characters, part 2** | Character Designer | The rest of burrow (≈8: facings, walk, plume 3, pose), shade (≈4: float + pose) and knight (≈5), beyond the probe's 6 minimal frames. About 16–19. | CROWN G-E re-run with knight live; burrow on SAND via T-edge and G-D; MAKO still the only chevron. **After W2, "characters only" is a shippable freeze target.** | ≤5 art days |
| **W3 Environment, per biome** | Environment Designer | ICE, FACTORY, WATER, ARENA and SAND tiles; RIM tile; floor-detail variants; SHRINK wall slam 3. The user picks the path at kickoff: palette-swap (about 12 authored) or biome-distinct (about 40–80). | ENV-2 and T-edge hard on all 8; tile averages ≥ CLASSIC baseline; ENV-4 noise caps. | 2–8 art days |
| **W4 Items and FX** | Environment Designer (the Animation designer is R for the FX frames) | The other 10 pickups + family chrome frames; reveal 2; sparkle 3; glint 3; shield 2; crumble set completed. About 25–30. | Cold read: **all 12** pickups named correctly by ≥2 of 3 naive readers at in-game size, and **BOMB, KICK, PASS, LINE and REMOTE by 3 of 3** (the objects the user has seen misread). A misnamed icon is redrawn before the user sees it, never shipped. POWER vs blast Hamming ≥40%. THROW vs BOMB IoU ≤0.5. | 3–5 art days |
| **W5 HUD and menus (optional, only if Q4 = yes)** | Art Director (the RE is R for the code) | Pixel HUD chips; GUIDE ITEMS/ENEMIES/HOW TO in px; optional bitmap font (about 100 glyphs). | HUD glyphs fit the 30-px chip; GUIDE shows the same art the board shows. | +2–4 engineering days, 2–3 art days |
| **W-INT Integration** | RE (the TE is R for the test pins) | §6.3: settings bit, three-way RENDER, the remaining one-shots (kill, brick, win), PWA, docs, HUD/GUIDE if Q4. | §6.5 tests; headed play on all 8 biomes, desktop + phone, d/p/l layouts. | the remaining **4–6 engineering days** (8–12 in total including G1's 4–6) |

**Wave order (auditable):** the art waves run **W1 → W2 → W3 → W4 → (W5)**,
one at a time in user review; the next wave's art may start while the previous
one is in review, but no wave is approved out of order. **W-INT starts at the W2
approval** (the first shippable state) and runs in parallel with W3 and W4; it
must be complete before G3 and before anything ships at a freeze.

**Cell sum (authored, no double counting):**

| Source | Cells |
|---|---|
| G1 probe slice (the reused spike cells are redrawn into it) | ~81 |
| W1 | ~32 |
| W2 | ~16–19 |
| W3 | ~12 (palette-swap) or ~40–80 (biome-distinct) |
| W4 | ~31 (12 glyphs, 8 chrome frames, well, reveal 2, sparkle 3, glint 3, shield 2) |
| **Total** | **~175 (palette-swap tiles) to ~240 (biome-distinct)**, inside the §8 headline of 180–260 within its error. W5 glyphs (~100) are extra and optional. |

**Freeze rules:** any of the following triggers a **freeze**:
- a wave needs more than 2 rejection rounds;
- cumulative art passes 8 calendar weeks from the G1 go;
- engineering passes 18 days (the 12-day top of the estimate +50%).

A freeze ships what is approved. Every reachable state:

| Approved at the freeze | W-INT | What ships |
|---|---|---|
| nothing past G1, or W1 only | any | Stop; the work stays on branch `px-probe`, the grids in scratch |
| W1 + W2 | complete | Characters-only (pixel characters and bombs on today's tiles) |
| W1 + W2 + W3 | complete | Full tiles and characters; **pickups stay vector `drawIcon`** in PIXEL |
| W1–W4 | complete | The full look; the HUD and menus stay vector (W5 not done) |
| W1–W4 + W5 | complete | Everything |
| any of the above | **unfinished** | **Nothing ships**; the work stays on the branch until W-INT is done or the user stops it |

W3 approved before W2 is not reachable under the wave-order rule. If the user
ever reorders the waves, only an approved prefix that contains W1 and W2 can
ship.

A freeze is a logged ruling, not a failure.

### G3: release

| | |
|---|---|
| **Owner** | RE; the PQ runs the checklist. |
| **Inputs** | All wave approvals and green CI. |
| **Acceptance** | See below. |
| **User gate** | Release sign-off. |
| **Effort** | 0.5 day. |

**Acceptance:**
- The Pages deploy is green.
- A returning PWA client reloads once to the new `CACHE_NAME`.
- RENDER cycles CLASSIC 2D → PIXEL → REAL 3D and the choice persists across a reload.
- A smoke test runs on `https://hmarzban.github.io/fusegrid/` (trailing slash).
- AGENTS.md, `docs/architecture.md`, `MEMORY.md` and the changelog are updated.

---

## 6. Engineering plan (Tech Lead)

### 6.1 Architecture

- **Where px code lives.** All px code is in a new `src/render/pixel/` tree. It
  enters through a third kind `"px"` in `createRenderer`, the same seam iso
  uses:
  - the kind-normalising line at `renderer.js:18`;
  - one `else if(kind==="px") drawPixelWorld(ctx,world,o)` before the classic
    `else`;
  - one `if(kind==="px") pxEvent(ev)` inside `consumeEvents`.
- **Shared by construction.** The classic branch text is never edited. The
  overlay, HUD chips, coach, flash and shake therefore stay shared. **One
  declared exception:** the shared shake line (`renderer.js:51`) gets a
  kind-guarded even-px snap for `"px"` (§3.2 D2); for kind `"2d"` the
  expression and the call-log hash are unchanged.
- **No box changes.** `kindSize`, `dims`, `overlayBox`, the `cameraCtl` bbox and
  `sizeCanvases` already treat every non-iso kind as 600×520, so they need no
  change. This holds because P-scale offers only (a), (b) and (d′), which are
  CSS stage-scale choices; (c) would break it and is therefore not offered
  (§3.2 D4).
- **Art data format.**
  - Each frame is `{w,h,pal,rows}`, with ≤16 palette entries per sheet including
    the outline.
  - Frames are baked **lazily** when the px renderer is first created, never at
    app boot.
  - Fins are cached per `p.color`.
  - No PNGs and no npm dependencies.
  - The JS art text is scanned by `banned-name.test.mjs` automatically.

### 6.2 G1 probe changes (branch `px-probe`)

**New files:**

| File | Purpose |
|---|---|
| `src/render/pixel/palette.js` | `pxRamp`, ported from the spike |
| `src/render/pixel/grid.js` | grid decoding and helpers |
| `src/render/pixel/atlas.js` | lazy bake plus the fin swap cache |
| `src/render/pixel/art/{mako,foes,tiles,bomb,blast}.js` | the art data |
| `src/render/pixel/world.js` | `drawPixelWorld`: classic draw order, with procedural fallback for anything not drawn yet |
| `src/render/pixel/anim.js` | pure and DOM-free: `walkFrame`, `facingOf`, `bladeAgeFrame`, `unionAge`, `fuseFrame`, `animClock` |
| `src/render/pixel/oneshot.js` | kind-scoped one-shot state (hurt and lose at G1; kill, brick and win added in W-INT), with a `reset()` hook |
| `src/render/pixel/timing.js` | the timing source of truth |
| `src/render/pixel/snap.js` | pure `pxZoom`, `pxCam` (`pxFit` lives in `src/app/fit.js`, because `src/app/` may not import `src/render/`) |

**Edits:**

| File | Change |
|---|---|
| `src/app/flags.js` | the regex becomes `(3d\|iso\|px)`. The existing `?render=4d → null` pin still holds. Branch-only: `room` parsed under `debug` (§5 G1). |
| `src/render/renderer.js` | the kind line, plus one branch and one event line, plus the kind-guarded shake snap on the shared line 51 (§3.2 D2) |
| `src/render/cameraCtl.js` | an optional `snapZ` hook (identity by default) applied to `cam.zoom` before `clampAxis` / `zoomAnchor`, so pan bounds use the drawn zoom (§3.2 D3). 2D maths and `camera.test` unchanged. |
| `src/main.js` | **≤ +2 lines** against the spike-start SHA. In place (+0): `effKind`'s iso line (`main.js:493`) becomes `if (urlKind === "iso" \|\| urlKind === "px") return urlKind;`, so `render3d` and the persisted `settings.r3d` are never touched (no AND into the boot expression, so `menuapp.js:703` cannot copy a forced `r3d:0` into memory and a later OPTIONS save cannot write it to disk); `getKind` and every `!== "3d"` check already treat px as 2D; the intro scale (`main.js:695`) and the `camTransform` call (`main.js:703`) take `pxZoom`/`pxCam` in place; `snapZ` rides the existing `mountCameraCtl` options. Counted (≤ +2): the `reset()` call on the px renderer inside the existing `if (k !== curKind)` block (`main.js:568`), and the fit setter call in `sizeCanvases`, if either cannot ride an existing line. |
| `src/app/fit.js` | pure `pxFit` beside `fitBox` (untouched). The current kind is kept **in the `mountFit` closure**, set through a setter that `sizeCanvases(kind)` calls; `fit` keeps its signature, because `mountFit` registers it directly as the `resize` and `orientationchange` handler and those calls pass an `Event` as the first argument. `mountFit` also exposes the current `k` for `pxZoom`. |
| `src/pwa/shell.js` | SRC entries for the new files (`pwa.test.mjs:98-102` requires every `src/**/*.js`; its only ordering check is the daily/debughook adjacency). `CACHE_NAME` and the `sw.js` REV are bumped together to the next free `fusegrid-shell-vN`. |

**Not changed during the probe:** settings, OPTIONS rows, menudraw and
AGENTS.md. During the probe the RENDER row still reads CLASSIC 2D / REAL 3D.
While the flag is present it wins: the RENDER row toggles the saved
preference, which takes effect once the flag is removed. This is documented as
probe behaviour.

### 6.3 Full mode changes (W-INT)

- **Settings.**
  - Append the bit `px:0` to `nb.settings.v1`, clamped by `bit()`.
  - `r3d` is untouched, the `r3d 9→1` pin holds, and no new `nb.*` key is added, so `reset.test`'s classification is unaffected.
  - The effective kind is `r3d ? "3d" : px ? "px" : "2d"`.
  - An old blob loads unchanged: `r3d=1` as REAL 3D, otherwise CLASSIC 2D (it has no `px` bit).
  - A stale pre-PIXEL client drops the px pick on its next save, which self-heals after the SW update.
- **RENDER row.**
  - It cycles CLASSIC 2D(0) → PIXEL(1) → REAL 3D(2) with the CAMERA semantics: `optAdjust` clamps 0..2 and `optCycle` wraps %3.
  - A new `_optRender(v)` sets `r3d` and `px` together, so `onSettings` fires once.
  - `OPT_ROWS` stays at nine.
  - `_opt3dLocked` dims CAMERA and BRIGHTNESS in PIXEL for free.
- **`main.js`** grows by at most +3 more lines (`app.pixel`, one import, one spare) over the HEAD at W-INT start, and never past the 799 cap.
- **Draw sites, scale policy, `pxFit` and the hurt/lose one-shots** were done at G1 (their one home). W-INT only:
  - extends `oneshot.js` with kill, brick and win; its `reset()` stays the RENDER-flip detector (`main.js:568`), and it also resets on a run start and a new `world.grid` identity;
  - re-checks the d/p/l layouts, `body[data-lay]`, pad placement and the hit maps (`canvas.width / r.width`) on all 8 biomes;
  - snaps the canvas offset to whole device px.
- **HUD and GUIDE.** If Q4 is yes, thread kind into `drawHudChips` and into the menudraw ITEMS/ENEMIES/HOW TO pages. `drawShell` already receives kind.
- **Pins to renegotiate (append-only where possible), six files:**
  - the `RENDER` literal: `headless`, `menuapp` ("RENDER flips render3d", OPT values), `menudraw`, and `three` (only a literal check is expected);
  - the `r3d` bit: `settings` (KEYS and DEF_JSON) and `r3d`.
  - `media.test` pins neither and is not expected to change.
- **Docs.** AGENTS.md gets the RENDER three-way rule, a px architecture bullet, and a **third column** in every "both renderers" rule.

### 6.3a Interaction with the opening spec (2026-10-09)

The opening spec (user rulings 2026-10-09, committed at `3b17dbb`) is partly
implemented: `2b3df91` landed O1, the audio-unlock fix; the title and the show
are not yet built. It intersects this plan in three places:

- **Intro zoom.** In px mode its 2D camera passes through `pxZoom`/`pxCam` at
  the same draw sites. The title's slow zoom drift around 1.12 can only move
  between coarse whole-`k·z` levels, so in PIXEL it becomes stepped or
  pan-only. The show's close-up steps between the quantized levels. P-intro is a
  G1 pick, judged against the opening that is live when the probe runs.
- **MAKO pop.** The show scales MAKO with `easeOutBack` (`ro.pop`). That is a
  cell transform, which D1 forbids. In px mode the pop becomes a 3-frame
  materialize, reusing the probe's `MATERIALIZE` frames, or an alpha-only
  fade. This is decided at G1 and needs no extra art.
- **Budgets.** That spec plans about −3 to +1 lines in `main.js` and its own
  paired `CACHE_NAME`/REV bump. Every `main.js` figure in this plan (781 at
  `2b3df91`, ≤+2 at G1, ≤+3 more at W-INT) is therefore stated **relative to
  the spike-start SHA** and re-measured at each stage start. The cap stays at
  799 and is never raised for PIXEL.

### 6.4 No-touch list (hard gates, checked by diff at every stage)

| Must stay unchanged | How it is checked |
|---|---|
| `src/core/**`: sim, world, config, heat, pact, board, entities, rng. Replay baseline v6. | Empty diff. |
| `src/ai/**` | Empty diff. |
| CLASSIC 2D painters and the classic branch: `sprites.js` painters, `enemybody.js`, `icons.js`, the classic `else` branch of `renderer.js` | The call-log hash pin is unchanged. Declared exception: the kind-guarded shake snap on shared line 51 (§3.2 D2). |
| REAL 3D: `src/render/three/**`, `vendor/three.module.js`, the rig and lens, the light recipe, `SLOT_MESH`, fat-world 141 (142 with ghost), the draw budget ≤500, `tests/three.test.mjs` | Empty diff (W-INT allows only a RENDER-literal check in `three.test.mjs`). |
| iso: `src/render/r3d/**` | Empty diff. |
| `fitBox`, `FIT_RES`, `cameraCtl` and `introPhase` maths | Untouched for kind 2d. Declared px-guarded exception: `cameraCtl`'s optional `snapZ` hook (identity by default) so pan clamps see the drawn zoom (§3.2 D3); `camera.test` and `intro.test` stay green with no edit. |
| The existing art gates: `items-art`, `enemies-art`, `pickups`, `ghost`, the seven-swatch and VOID ΔE pins | Unchanged. PIXEL gets its own tests. |
| `nb.*` store keys | No new key is added. |

### 6.5 Test and gate list

| Test | Stage | What it proves |
|---|---|---|
| `tests/pixel-art.test.mjs` | G1 onward (hard) | A port of `spike/gates.mjs`: G-A through G-L on the shipped data. `pxRamp` frozen values. Regression fixtures fail. A **manifest** derived from `ENEMY` types, the 12 `POWER` kinds, 8 `BIOMES`, bomb variants, blast pieces and MAKO states, so a future foe, pickup or biome without px frames fails CI (the parity tax is made loud). |
| `tests/pixel-render.test.mjs` | G1 onward | A `drawImage` recorder over the fat world that tracks the **composed** transform (translate/scale stack, including shake), so every entity blits at an even integer in canvas space, and `imageSmoothingEnabled===false`. The CLASSIC 2D call-log hash pin. `snap.js`: `pxZoom(1,k) === 1` for every `k`; `pxZoom` composed with `clampAxis` at `MIN_Z` and `MAX_Z` for odd, even and fractional `k`; `pxFit` per policy. `anim.js`: walk frames by distance at 30/60/120 Hz; idle within 6 ticks; diagonal hysteresis; blast ages cover `[0,ttl)` with no gap; the younger blade wins at a crossing; fuse tempo at f=0.85 for every heat; `animClock` frozen across 120 PAUSE ticks; one-shots cleared on a 2D → px → 2D → px flip through the cached renderer's `reset()`, a run start and a new grid; crumble ≤340 ms; REDUCE FLASH. The flags regex. No `src/core` import of `render/pixel`; no `src/app` import of `src/render`. |
| Existing suite | every stage | Green with no edits at G1. Append-only pin edits at W-INT. |
| `pwa.test.mjs` | G1, W-INT | New SRC entries present; `CACHE_NAME === REV`. |
| `banned-name.test.mjs` | automatic | Scans every tracked text file, so `src/render/pixel/**` and this plan are covered. |
| Headed check | G1, W-INT, G3 | Real headless Chromium at dpr 1/2/3. SW and caches cleared on both loopback origins. MessageChannel rAF shim. Assertions on `window.__GAME__` and a `fillText` recorder, not on pixels. |

**Budgets (measured via CDP on desktop):**
- bake ≤50 ms;
- px draw ≤4 ms per frame;
- at most about 600 `drawImage` calls per frame;
- px JS ≤120 KB uncompressed.

---

## 7. Accountability

### 7.1 Roles

| Code | Role | Owns |
|---|---|---|
| U | **The user (owner)** | Every gate decision and every taste call. The only approver. |
| PQ | Producer / QA Lead | Runs the gate process (R), the decision log, the risk register, status reports, the checkpoint and hard-stop calls, kill and freeze calls (proposed to U). Accountable for the plan document and memory. |
| AD | Art Director | Style bible, the canonical MAKO, palette lock, direction briefs, per-cell pre-screen, cross-lane consistency. DRI for the spike (G0) and responsible for the G1 probe art. |
| CD | Character Designer | MAKO and foe grids, the per-facing rules, the foe table. DRI for W1 and W2. |
| ED | Environment / FX / Items Designer | Tiles, bomb, blast, crumble, pickups, ghost and HUD variants. DRI for W3 and W4. |
| AN | Animation Designer | `timing.js`, the motion strips, motion lint; the FX frames in W4. |
| PA | Pixel artist agents A, B, C | One direction each at the spike; production cells in waves. |
| BG | Brand & Spec Guardian | B1–B8, the originality attestation, the AGENTS.md MAKO and foe rule mapping. Never draws. Only the user can overrule a BG flag. |
| TE | Gate / Test Engineer (incl. colour) | `palette.mjs`, `gates.mjs`, gate satisfiability (S0c), the test ports, the blind read. |
| RE | Render Engineer / Tech Lead | Tooling, staging, the sheet, the probe and its delivery path, full-mode engineering, PWA. DRI for G1, W-INT and G3 engineering. |
| SK | Skeptic | An adversarial review before each user showing, the worth-it line and the distinguishability check. |

**Who carries accountability across sessions.** Every role is an agent hat
with no memory between sessions. **The orchestrating session wears the PQ hat:**
it dispatches the role agents, keeps the decision log (§7.3) and the matching
`MEMORY.md` lines, and hands the next gate to the next stage DRI. A new session
picks the plan up from this file, the decision log and `MEMORY.md`, never from
an agent's recollection.

### 7.2 Per-stage DRI and RACI

**Per-stage DRI (exactly one A each):**

| Stage | DRI (A) | Main R |
|---|---|---|
| Spike (S0 … sheet) | AD | RE, TE, PA, AN, BG, SK; PQ runs the process and log |
| G0 decision | U | PQ logs |
| G1 probe | RE | AD (probe art), TE (test port) |
| G1 decision | U | PQ logs |
| W1, W2 | CD | PA |
| W3 | ED | PA |
| W4 | ED | PA, AN (FX) |
| W5 (optional) | AD | RE (code) |
| W-INT | RE | TE |
| Each wave decision, G3 sign-off | U | PQ logs |
| G3 engineering | RE | PQ (checklist) |

R = does the work, A = accountable (exactly one per row), C = consulted, I = informed.

| Activity | U | PQ | AD | CD | ED | AN | PA | BG | TE | RE | SK |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Style bible (§3) | I | C | **A/R** | C | C | C | I | C | C | C | C |
| S0 tooling and housekeeping | I | I | **A** | I | I | I | I | I | C | **R** | I |
| S0b canonical MAKO | I | I | **A/R** | **R** | I | C | I | C | C | C | I |
| S0c gate satisfiability, `palette.mjs` + `gates.mjs` | I | I | **A** | C | C | C | I | C | **R** | I | C |
| Spike grids (A/B/C) | I | C | **A** | C | C | C | **R** | C | I | I | I |
| Staging, captures, sheet | I | C | **A** | I | I | C | I | I | C | **R** | C |
| Motion strips | I | I | **A** | C | I | **R** | C | I | I | C | I |
| AD pre-screen | I | I | **A/R** | C | C | C | I | I | I | I | I |
| Blind read | I | I | **A** | I | I | I | I | C | **R** | I | C |
| Brand review | I | I | **A** | I | I | I | I | **R** | I | I | C |
| Skeptic review | I | I | **A** | I | I | I | I | C | I | I | **R** |
| Spike gate process, checkpoint, hard stop, decision log | I | **R** | **A** | I | I | I | I | I | C | C | I |
| **G0 pick** | **A/R** | R (log) | C | C | C | C | I | C | I | I | C |
| G1 probe engineering + delivery | I | C | C | I | I | C | I | I | C | **A/R** | C |
| G1 probe art | I | C | **R** | R | R | R | R | C | C | **A** | I |
| **G1 go/no-go + feel picks + Q1–Q4** | **A/R** | R (log) | C | C | C | C | I | C | C | C | C |
| W1, W2 art | I | C | C | **A/R** | C | C | R | C | C | I | C |
| W3 art | I | C | C | C | **A/R** | C | R | C | C | I | C |
| W4 art | I | C | C | C | **A/R** | R | R | C | C | I | C |
| W5 (optional) | I | C | **A/R** | C | C | C | R | C | C | R | C |
| W-INT engineering | I | C | I | I | I | C | I | I | R | **A/R** | C |
| **G2 wave approvals** | **A/R** | R (log) | C | C | C | C | C | C | C | C | C |
| G3 engineering + checklist | I | R | I | I | I | I | I | C | C | **A/R** | C |
| **G3 release sign-off** | **A/R** | R (log) | I | I | I | I | I | C | C | C | C |
| This plan, `MEMORY.md` and AGENTS.md updates | I | **A/R** | C | I | I | I | I | C | I | R | I |

### 7.3 Decision log (newest first; every row mirrored as a 1–2 line dated `MEMORY.md` entry)

| ID | Date | Gate | Artefact (path + sha256) | Options shown | User's verbatim words | Ruling | Kill/freeze status | Rounds used / cap | Next owner + due |
|---|---|---|---|---|---|---|---|---|---|
| P-0 | 2026-10-09 | plan | `docs/superpowers/plans/2026-10-09-pixel-art-spike-plan.md` (sha recorded at commit) | — | "for art spike let's create a plan document, run all your team of agents and get help from the art designers in order to have a cohesive and reliable and accountable plan for this new feature" | Plan written, reviewed once and committed; spike starts after the push (T0) | none | — | PQ (orchestrating session): record T0 and the spike-start SHA when the push lands. AD: S0 + S0b at T0, checkpoint T0+1.5 d, **G0 sheet due T0+3 working days** |
| G0-R1 | | G0 | `spike/out/pick-sheet-r1-*.png`, `spike/sheet.html` | A/B/C/mix/none + P-scale, P-back, P-blast (if drawn) | | | | 1/2 | |

Rulings the user did not give in words are marked **"team ruling"**, and are
listed in each gate report so the user can overturn them.

**Target dates (relative; the PQ converts them to calendar dates when T0 is
recorded):**

| Milestone | Target | DRI |
|---|---|---|
| T0: push lands, spike-start SHA recorded | T0 | PQ |
| S0 + S0b + S0c green | T0 + 0.6 working days | AD |
| End-of-day-1 checkpoint | T0 + 1.5 days | PQ calls it |
| G0 sheet sent (hard stop) | T0 + 3 working days | AD |
| G0 decision | the user's pace; the PQ follows up once after 3 days | U |
| G1 probe and G1 sheet ready | G0 + 1.5 weeks (K1-4 at 6 engineering / 7 art days) | RE |
| W1 sheet | G1 go + 1 week | CD |
| W2 sheet (first shippable state; W-INT starts) | G1 go + 2 weeks | CD |
| W3 sheet | G1 go + 3–4 weeks | ED |
| W4 sheet | G1 go + 5–6 weeks | ED |
| W-INT complete | G1 go + 6–7 weeks | RE |
| G3 release ready | G1 go + 7–8 weeks (freeze at 8) | RE |

### 7.4 Progress reporting

- **One report per gate, no mid-stage pings.** At each gate the PQ sends exactly
  one sheet (SendUserFile, `display: render`) plus the private page link, with a
  5-line status:
  1. stage and round (n/cap);
  2. cells done/planned (measured);
  3. gates x/12 green and reviews passed;
  4. risks that changed;
  5. the one ask (the pick list).
- **Estimates are labelled.** Numbers in status reports are measured. Estimates
  are always marked "order of magnitude".
- **Inside a stage the agents run autonomously.** Gates are the only planned
  stops. This reconciles the autonomous-team rule with the rule that taste is
  picked from rendered candidates.

### 7.5 Kill and freeze criteria (consolidated)

| Gate | Trigger | Fallback |
|---|---|---|
| G0 | K0-1: no on-model MAKO after the internal round | One compact sheet: best failing MAKO per direction with red gate labels, next to CLASSIC 2D, plus the human-artist question; the user may overrule a false positive |
| G0 | K0-2: "not better than CLASSIC 2D" | Stop (keep CLASSIC 2D) |
| G0 | K0-3: two rounds without a pick | Stop; log |
| G0 | K0-4: a direction passes only by re-hue | Drop that direction |
| G0 | K0-5: a brand flag cannot be fixed on-model | Drop that direction |
| G0 | K0-6: the spike overran its box (T0+3 days, or r2's stop) | Ship what is green with a disclosure, or ask the user whether to continue |
| G1 | K1-1: swim or shimmer unacceptable under (a) and (b) | Offer (c) with its separate canvas (+1.5–2 days), characters-only at the best policy, or stop |
| G1 | K1-2: feel not better than CLASSIC 2D in play | Stop |
| G1 | K1-3: a `src/core` change is needed | Stop and escalate |
| G1 | K1-4: G1 over 6 engineering days or 7 art days | Freeze and report to the user |
| G2 | A wave is rejected twice | Escalate: redraw / human artist / descope |
| G2 | Art over 8 weeks or engineering over 18 days | Freeze: ship what is approved, per the freeze table (§5) |
| G2 | Motion rejected for every walk across 2 rounds | Stills plus a 1-px bob (about −50 cells); if stills are also rejected, stop |
| G2 | Side-view lint fails after 2 authoring rounds | Side walk at 2 frames, a still plus bob, or **CLASSIC 2D's facing rule**: front frames plus a 1-px pupil and grin shift for left and right (M10) |
| G2 | Pickups fail the cold read (any of the 12, or a 3-of-3 object) or are rejected twice | Redraw before showing; after two rounds, pickups stay vector `drawIcon` in PIXEL |
| any | BURROW on SAND clears only by a biome or foe re-hue | Escalate to the user; never re-hue silently |

### 7.6 Risk register

| ID | Risk | L / I | Mitigation | Owner | Indicator |
|---|---|---|---|---|---|
| R1 | MAKO off-model or vetoed on taste. Three heroes have been vetoed; both prototypes failed. | High / High | One canonical MAKO before the split (S0b) with IoU ≥ 0.85; M0–M13 gates plus negative and positive fixtures; blind read; three directions; judged at in-game size; budget for at least one rejection | AD | any G-F red, or a G0-R1 rejection |
| R2 | "Possible but not worth it". CLASSIC 2D already reads as clean tile art. | Med / High | CLASSIC 2D column on every row; a "none" option; the skeptic's worth-it line | PQ | user prefers CLASSIC |
| R3 | Pixel swim from the fractional fit, intro zoom and pinch zoom | High / Med | D1–D5; P-scale at G0, P-intro at G1; zoom quantization wired at G1; 7–28% snap loss disclosed | RE | D5 fails |
| R4 | VOID and CROWN collisions invisible to the existing gates | Med / High | G-C, G-D and G-E on palette data; full VOID and CROWN rooms on the sheet | TE | gate red |
| R5 | SAND legibility: brick–floor 5 ΔE; burrow on floor0 8.2 | High / Med | ENV-2 structure, T-edge, contact band, the burrow dark ring; SAND strip at the spike | ED | T-edge < 80% |
| R6 | Brand proximity to the genre classic's 16-bit look | Med / High | B1–B8; BG attestation per sheet; banned-name scan; manual caption check (PNGs are not scanned) | BG | any B flag |
| R7 | Permanent three-look parity tax | Certain / Med | Stated at G0 and G1; the manifest test fails loudly; characters-only limits the tax | PQ | — |
| R8 | Contract churn: RENDER rule, `r3d`, six pinned test files (4 `RENDER` literal + 2 `r3d` bit), PWA | Certain at W-INT / Low–Med | Deferred to W-INT behind Q1; G1 is flag-only with zero existing-test edits | RE | — |
| R9 | A stale service worker makes changes look unlanded | Med / Med | SW and cache clean on both origins; paired `CACHE_NAME`/REV bump | TE | headed capture mismatches the source |
| R10 | Merging the probe publishes it (CI deploys `main` to Pages); and the phone cannot reach an unmerged branch | Med / Med | Branch `px-probe`, never merged before the G1 go; phone delivery through a private Artifact or recorded captures (§5 G1) | RE | — |
| R11 | Mixed look (vector HUD over a pixel board) gets rejected for the mismatch rather than the art | Med / Med | Shown honestly on the sheet; W5 is an explicit choice | AD | user comment |
| R12 | Scope creep: biome-distinct tiles, 4-frame foe walks, font | Med / Med | Lean defaults; each is a user pick at its wave kickoff | PQ | cell count over plan |
| R13 | Two MAKOs on screen when a life is lost (the sim teleports in the same tick) | Certain / Low | Short desaturated corpse; P-life pick; fallback flash | AN | P-life rejected |
| R14 | Agent art reaches only "programmer pixel art" | Med / High | AD pre-screen; one fix round; the human-artist question asked early (Q3) | AD | AD verdict |
| R15 | Evidence in session-scoped paths vanishes | Low / Med | All work under `.superpowers/sdd/2026-10-09-pixel/`; S0 copies the tooling | RE | missing file |

---

## 8. Estimates and scope guard

| Stage | Engineering | Art | Calendar | Confidence |
|---|---|---|---|---|
| Spike (§4) incl. S0, S0b, S0c | about 1 day (tooling, gates incl. satisfiability, staging, sheet, motion strips; no sim-driven loops and no new 3D captures) | 0.25–0.5 day canonical MAKO + 1.25 days, three artists in parallel; 73 cells | **2.5–3 working days, hard stop at T0+3** (critical path ≈2.85, §4) + about 1 day per extra user round, with its own hard stop | Medium. The art pace is unproven for on-model cells. |
| G1 probe | 4–6 days (K1-4 at 6) | 3.5–5.5 days, about 81 cells (K1-4 at 7) | about 1.5 weeks + review | Medium–low |
| G2 full look | the remaining 4–6 days after G1 (8–12 in total including G1; +2–4 with W5) | about 180–260 authored cells; 4–8 calendar weeks gated by user reviews (agent art), or 3–8 weeks + an unverified $3k–15k (human artist) | **6–10 weeks** end to end | Low; an order of magnitude |
| Characters-only fallback | 4–6 days | 2–4 calendar weeks | — | Low–medium |

The headline 180–260 is the skeptic's reconciled figure. The Animation
designer's count is about 186 (lean) to about 226 (biome-distinct) authored,
which comes to about 310–330 runtime cells after mirrors, rotations and
palette swaps.

**Explicitly out of scope (overengineering guard):**

| Item | Status |
|---|---|
| Replacing CLASSIC 2D | Rejected. It saves no code and throws away approved art. |
| Sprites inside Three.js (billboards or a pixelated 3D pass) | Rejected. It breaks the `SLOT_MESH` / fat-world ABI and reads as cardboard. |
| PNG sheets, an Aseprite converter, AI generation, CC0 packs, downsampling | Out. A converter comes back only if a human artist is hired. |
| Any `src/core` change or new sim signal | Out. All motion is derived render-side. |
| A new `nb.*` store | Out. |
| A per-biome camera or light table | Out. |
| Per-biome character re-palettes | Out. |
| A bitmap font, pixel HUD and pixel GUIDE | Out unless Q4 says yes (W5). |
| 16-px or 24-px grids and a logical-box change | Out. |
| Sharp-bilinear (c) and its separate px canvas | Out unless K1-1 fires (§3.2 D4). |
| Sim-driven APNG capture at the spike, new VOID/CROWN REAL 3D captures | Out. The live probe at G1 replaces the first; REAL 3D is not a candidate. |
| A pixel iso path | Out. |
| 4-frame foe walks, biome-distinct crumble | Out unless the user picks them at a wave kickoff. |
| Tooling | No reusable framework is built. The spike reuses `proto/bake.mjs`, `proto/pixart.js` and the repo's own `fitBox`, `loadLevel` and `step`. |

---

## 9. Open questions for the user (only the real ones)

These are separate from the visual picks in §4.4 (G0 on the sheet, the feel
picks at G1). None of them blocks the spike.

1. **Q1 (needed at G1). A third RENDER look.** Is a third RENDER look
   acceptable: OPTIONS cycling CLASSIC 2D → PIXEL → REAL 3D?
   - It changes the AGENTS.md rule "Menu RENDER flips 3D ⇄ 2D only".
   - It adds a `px` bit to saved settings.
   - Should the label read **PIXEL** or **PIXEL 2D**?
2. **Q2 (at G1). Full look or characters only.** If the probe wins, which do
   you want:
   - the **full third look**, about 6–10 weeks with tiles, items and effects;
   - or **characters only**, meaning pixel MAKO and foes on today's tiles, at
     roughly half the art?
3. **Q3 (worth answering before the spike if you already know). Who draws the
   production art?**
   - Agent artists with your review on every wave.
   - Or a commissioned human pixel artist, roughly $3k–15k (unverified), whose
     work would be converted to the same text-grid format.

   If the spike fails on craft (K0-1), this becomes the only way forward.
4. **Q4 (at G1). HUD, GUIDE and menus.** In PIXEL, should the HUD item chips and
   the GUIDE ITEMS / ENEMIES / HOW TO pages switch to the pixel art too?
   - The recommendation is yes, so the help shows the same things the board
     shows.
   - Do you want a pixel font for the HUD and menus (+2–4 days), or is today's
     text fine?
5. **Q5 (at G1). Keep the probe off the public site.** OK to keep the
   `?render=px` probe off the public site until you approve it? Merging to
   `main` deploys to GitHub Pages. The recommendation is yes, on a branch, and
   you play it on the phone through a private claude.ai Artifact copy of the
   branch (or, if that cannot boot, through recorded phone-size captures). A
   LAN-reachable `serve.js` would change an AGENTS.md rule and is done only if
   you ask for it.
6. **Q6 (at the W3 kickoff, flagged now). Tiles per biome.** Should each biome
   get its own pixel tile art (about 40–80 more cells), or should all biomes
   share one recoloured tile set (about 12)?

---

## Appendix A. Reproducing the numbers

These scripts run from `.superpowers/sdd/2026-10-09-pixel/` and need only
`node`:

| Script | What it prints |
|---|---|
| `node ad/ramp-gates.mjs` | The `pxRamp` steps for MAKO, the fin and every foe; the minimum VOID and CROWN ΔE; the AND-gate failures |
| `node ad/spec-check.mjs` | Grid feature sizes (10/16/20/24/40), `k` and snap loss per device, the specular vs CROWN |
| `node env/tileavg.mjs` | The CLASSIC tile-average baselines per biome |
| `node env/pairs.mjs` | Foe and glyph collisions under 20 ΔE per biome |

All four were re-run for this plan at `3b17dbb`, and the figures above are
copied from their output.
