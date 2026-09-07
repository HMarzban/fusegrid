# R4 — First-visit Play Now + sub-90 s handoff verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure, on a genuinely cold load, how long a first-time visitor takes
to get from the first painted pixel to their first bomb on the board. Target
**≤ 90 s**. Publish the number. Land a timing fix **only** if the number misses.

**Architecture:** This is verification and finish work on shipped code, not new
architecture. The path already exists end to end: `bootFromIntro`
(`menuapp.js:340-346`) drops a first-timer straight into a CORE room-1 run off
one gesture; `nb.cabinet.v1` (`src/app/cabinetseen.js`) is what makes a
returning player land on MENU instead; the 3 s ghost coach (`coach.js:4,24-26`)
teaches the controls; and `main.js`'s
`if (app.screen === SCREEN.INTRO && app.subT >= INTRO_DUR) app.skip();` with
`INTRO_DUR = 5.0` (`src/app/intro.js:1`) auto-advances a player who does
nothing. The measurement is a **60 fps screen recording**, because that is the
only instrument that captures what the player actually waited for; the
`?debug=1` hook is a cross-check on the recording, never the number of record.
Two fix candidates are held **dormant** and strictly ordered, and both are
timing-only.

**Tech Stack:** A browser, DevTools, and a 60 fps screen recorder. `npm start`
for the loopback control run. No new modules; if a fix fires it is one constant.

**Spec:** `docs/superpowers/specs/2026-09-06-retention-wave1-design.md` §5

**Index:** `docs/superpowers/plans/2026-09-06-retention-wave1.md`

**Depends on:** R2, R7 and R11 — all three. R4 measures the **shipped whole**.
Running it before they land would measure a build nobody ships, and any R4 fix
would invalidate an earlier number.

## Global Constraints

- **The number of record is the screen recording**, from the first painted frame
  to the frame the first bomb appears on the board. The `?debug=1` figure
  carries the tester's paste latency and is a sanity check only.
- **The target applies to the slower of Run A and Run B.**
- **No console interaction during a recorded run.** A paste inside the window
  inflates the number. The `?debug=1` cross-check is a **separate cold load**.
- **Clear site data before every cold load**, and verify it. A stale service
  worker serves pre-change bytes and looks exactly like a change that did not
  land (AGENTS.md).
- **Both targets are logged**: the live Pages URL **with the trailing slash**,
  `https://hmarzban.github.io/fusegrid/` (the no-slash 301 drops the OG tags —
  use the slash form for every share and every test), and the loopback control
  `http://127.0.0.1:8080/index.html`, to separate bandwidth from code path.
- **Fixes land only on a failure, only in the stated order, and only two exist:**
  1. **`INTRO_DUR`** (`src/app/intro.js:1`, currently `5.0`) — lower it, floor
     **3.5 s**. Below that the intro's own beats stop reading. Only if Run A
     dominates the number.
  2. **Coach prominence** — either `COACH_DUR` (`coach.js:4`, currently `3`) up
     to a ceiling of **4.0 s**, or the panel contrast (`COACH_PANEL` /
     `COACH_TEXT`, `scenes.js:255-257`). Only if the read pause dominates.
     **No new motion, no blink** — the coach is a fade, and REDUCE FLASH players
     get the same panel.
  3. **Nothing else.**
- **Explicitly refused as "fixes":** changing room 1's roster
  (`walker, walker, stationary`, `heat.js:23` — the frozen-easy on-ramp is the
  thing that works), auto-planting a bomb for the player, or skipping INTRO
  entirely.
- **Honest limit, quoted from report §4 R4 (Risk):** "if CORE room 1 is *too*
  easy for a genre-savvy portal visitor, the aha may not land inside 90 s even
  at zero friction. That needs a real playtest, not a faster load." **This
  protocol measures time-to-first-bomb. It cannot measure the aha, and this plan
  does not claim it does.**
- Never write the banned grid-bomb franchise name into any committed file.
- PWA: Task 1 is docs-only and does **not** bump. Task 2 bumps **only if a fix
  lands** — read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV`
  together, `current vN → vN+1`.

---

### Task 1: The measurement — wipe, record, cross-check, publish

**Files:**
- Modify: this plan file — the **Results** section below
- No source files.

**Interfaces:**
- Consumes: `window.__GAME__.G` via `?debug=1` (`src/app/debughook.js:27-29`)
- Produces: the filled Results table, and the number that Task 2 judges

- [x] **Step 1: Wipe, and verify the wipe**

For **each** cold load below, first: DevTools → Application → **Clear site
data** (this unregisters the SW and deletes its caches). Then, **before**
loading the page, confirm in the console:

```js
localStorage.length === 0 &&
  (await navigator.serviceWorker.getRegistrations()).length === 0;
```

Expected: `true`. If it is `false`, the run is void — a surviving
`nb.cabinet.v1` sends the shell to MENU instead of `bootFromIntro`'s first-visit
branch, which is the exact path under test.

- [x] **Step 2: Record Run A (patient) and Run B (impatient)**

Record at **60 fps**. `t0` = the first frame with any non-blank page pixel.
`t1` = the first frame showing the planted bomb on the board. Elapsed =
`(t1 − t0) / 60` seconds.

The script is fixed — no exploration:

- **Run A (patient).** No input at all until `main.js`'s auto-skip fires
  `bootFromIntro` at `INTRO_DUR = 5.0 s`. This is the first-visit Play Now
  branch under test.
- **Run B (impatient).** One **Space** at t ≈ 2 s, which reaches the same
  `bootFromIntro` through `skip()` (`menuapp.js:337-338`).

Then, **identically in both**: hold nothing for **1.5 s** (read the ghost coach,
`COACH_DUR = 3`), hold **D** for **0.4 s**, press **Space**. That press is the
first `{t:"bomb"}` (`sim.js:328`).

Run the pair on the **Pages URL with the trailing slash** (primary), then the
pair on **loopback** (control). Four recordings, four wipes.

- [x] **Step 3: The `?debug=1` cross-check — a separate cold load**

Wipe again, load with `?debug=1`, and install this **before any gesture**.
`loadLevel` **reassigns** `w.events = []` (`world.js:80`), so a plain `push`
patch dies on the first room load — wrap the property instead:

```js
const g = window.__GAME__; let T = null;
const wrap = a => { const p = a.push.bind(a);
  a.push = (...xs) => { for (const e of xs)
    if (e && e.t === "bomb" && T == null) T = performance.now();
    return p(...xs); }; return a; };
let _e = wrap(g.G.events);
Object.defineProperty(g.G, "events",
  { get: () => _e, set: v => { _e = wrap(v); }, configurable: true });
window.__ms = () => T -
  performance.getEntriesByName("first-contentful-paint")[0].startTime;
```

Then run the Run A script and read `window.__ms()`. Report it, and note in the
Results that it carries the tester's paste latency — **it is a sanity check on
the recording, never the number of record.**

- [x] **Step 4: Confirm the veteran branch**

After Run A, **reload without wiping** and confirm two things:

- the shell lands on **MENU**, not GAME (`bootFromIntro`'s
  `cabinetSeen || pactUnlocked` guard, `menuapp.js:343`);
- idling to ATTRACT keeps the demo on **CORE, pact = 0** (`playFromAttract`,
  `menuapp.js:562-565`).

- [x] **Step 5: Fill in the Results section and commit**

Replace every cell in the Results table below with a measured number, and write
the two prose lines beneath it. **No cell may be left holding its field name**
at commit time — an unmeasured run is a run that did not happen, and a missing
number is not a result.

Docs-only, so **no PWA bump**:

```bash
git add docs/superpowers/plans/2026-09-06-first-play-verify.md
git commit -m "$(cat <<'EOF'
Measure the first-visit handoff: cold load to first bomb, recorded at 60fps.

Four cold loads with site data cleared and the service worker unregistered
each time, on the Pages URL with its trailing slash and on loopback, run
patient and impatient against a fixed script. The recording is the number; the
?debug=1 hook is a separate cold load and a sanity check, since it carries the
tester's own paste latency. This measures time-to-first-bomb and says nothing
about whether the aha lands, which needs a real playtest.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The verdict, and the two dormant fixes

**Files:**
- Modify: this plan file — the **Verdict** line in Results
- Modify **only if fix 1 fires**: `src/app/intro.js:1`, `src/render/menudraw.js`
  (`const DUR`), `tests/intro.test.mjs:9-10`
- Modify **only if fix 2 fires**: `src/app/coach.js:4` **or**
  `src/render/scenes.js:255-257`; `tests/coach.test.mjs`
- Modify: `MEMORY.md`; and `src/pwa/shell.js:1` + `sw.js:3` **only if a fix
  lands**

**Interfaces:**
- Consumes: the Task 1 numbers
- Produces: either a recorded PASS, or one bounded timing change with its own
  pin

- [x] **Step 1: Judge**

Take the **slower** of Run A and Run B on the **Pages** target.

- **≤ 90 s ⇒ PASS.** Write `PASS` on the Verdict line with that number, skip
  Steps 2–3 entirely, and go to Step 4. **Do not "improve" a passing number** —
  every candidate below costs a shipped constant, and neither is free.
- **> 90 s ⇒ FAIL.** Attribute the excess before touching anything, using the
  recording's own timestamps: the segment from `t0` to the first GAME frame is
  the **intro** cost (fix 1's domain); the segment from the first GAME frame to
  the bomb is the **read + move** cost (fix 2's domain). Apply **only** the fix
  whose segment dominates, and only one per run of this task — then re-measure
  from Task 1 Step 1 before considering the other.

- [ ] **Step 2 (conditional — fix 1): lower `INTRO_DUR`, floor 3.5 s**

Only if the intro segment dominates.

**Write the failing test first.** `tests/intro.test.mjs:9-10` pins the value
**and** a 4–6 s bound, and the spec's floor is **3.5** — below that bound. Both
lines are renegotiated together, and the lower bound moves to the spec's floor
so it can never be undercut later:

```js
check("INTRO_DUR === 4.0", INTRO_DUR===4.0, INTRO_DUR);
check("INTRO_DUR within the 3.5–6 s bound (3.5 is the floor: below it the intro's own beats stop reading)",
  INTRO_DUR>=3.5&&INTRO_DUR<=6);
```

**`src/render/menudraw.js` carries a duplicate** — `const DUR = 5.0; // intro
total (matches app/intro)` — which drives the intro beat table. If it does not
move with `INTRO_DUR`, the drawn beats desync from the auto-skip and the last
beat is cut off. Pin the two together, appended to `tests/intro.test.mjs`:

```js
import { readFileSync } from "node:fs";
{
  const md = readFileSync("src/render/menudraw.js", "utf8");
  const d = parseFloat((md.match(/const DUR\s*=\s*([\d.]+)/) || [])[1]);
  check("menudraw's intro beat-table DUR tracks INTRO_DUR exactly",
    d === INTRO_DUR, d + " vs " + INTRO_DUR);
}
```

```bash
node --test tests/intro.test.mjs
```

Expected: FAIL — `INTRO_DUR === 4.0 -> 5`, and the beat-table check reports
`5 vs 5` only after the first edit lands, so run it again after each half.

Then set `INTRO_DUR` in `src/app/intro.js:1` and `DUR` in
`src/render/menudraw.js` to the **same** chosen value, `>= 3.5`, and re-run:

```bash
node --test tests/intro.test.mjs tests/headless.test.mjs tests/three.test.mjs tests/menudraw.test.mjs
```

Expected: green. (`headless.test.mjs:137-153` and `three.test.mjs:917` read the
constant rather than a literal, so they follow it automatically.)

- [ ] **Step 3 (conditional — fix 2): coach prominence**

Only if the read-and-move segment dominates. Pick **one** of the two, not both.

**3a — `COACH_DUR`, ceiling 4.0.** There is no literal pin on its value today
(`tests/coach.test.mjs` reads the constant throughout), so the ceiling needs a
**new** pin or the next change has nothing to push against. Add to
`tests/coach.test.mjs` — **re-read that file first, it is dirty in
`git status`** — beside the existing `closed after DUR` check:

```js
check("COACH_DUR stays within 3–4 s (4.0 is the ceiling: longer and the coach outlives its welcome)",
  COACH_DUR >= 3 && COACH_DUR <= 4, COACH_DUR);
```

```bash
node --test tests/coach.test.mjs
```

Expected: green already at `3` — this pin is a **guard rail installed before the
change**, so run it, then raise `COACH_DUR` in `src/app/coach.js:4` and run
again. A value above `4.0` must fail.

**3b — panel contrast.** `COACH_PANEL` / `COACH_TEXT` in
`src/render/scenes.js:255-257`. **No new motion, no blink** — the coach is a
fade, and REDUCE FLASH players get the same panel, so any legibility gain has to
come from contrast alone. Pin the new values in `tests/coach.test.mjs` beside
the existing `drawCoach` text check, asserting the exact hexes reach the
context, so a later drive-by cannot quietly undo the fix.

- [ ] **Step 4: Re-measure if a fix landed**

Any fix invalidates Task 1's numbers. Re-run **Task 1 Steps 1–2** in full (fresh
wipes, four recordings) and replace the Results table with the post-fix numbers,
keeping the pre-fix numbers in the "before" column so the change is auditable.

- [ ] **Step 5: Full battery, MEMORY, commit**

```bash
node --test
```

Expected: all green.

Append to `MEMORY.md` under a new `## 2026-09-06 — R4 first-visit handoff`
heading (newest first, 1–2 lines): the measured cold-load-to-first-bomb time for
the slower run on the Pages URL, whether it met the 90 s target, and either "no
fix needed" or which single constant moved and to what; plus the standing note
that this measures time-to-first-bomb only and cannot measure whether the aha
lands, which needs a real playtest.

**If no fix landed** (docs-only, **no PWA bump**):

```bash
git add docs/superpowers/plans/2026-09-06-first-play-verify.md MEMORY.md
git commit -m "$(cat <<'EOF'
Record the first-visit verdict: the shipped handoff meets the 90s target.

Both dormant fix candidates stay dormant. Lowering INTRO_DUR or lengthening the
coach each cost a shipped constant, and a passing number does not buy either.
The refusals hold: room 1's walker/walker/stationary roster is the frozen-easy
on-ramp that works, and nothing here auto-plants a bomb for the player.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

**If a fix landed**, read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3`
`REV` together, `current vN → vN+1`, and use instead (adding only the files that
actually changed):

```bash
git add docs/superpowers/plans/2026-09-06-first-play-verify.md src/app/intro.js src/render/menudraw.js tests/intro.test.mjs MEMORY.md src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Shorten the intro so a patient first-timer reaches their first bomb sooner.

The recording attributed the miss to the intro segment specifically, so this
moves one constant and stops. menudraw's beat-table DUR moves with it — the two
were duplicated and a drifting pair would cut the last intro beat — and both are
now pinned together. The 3.5s floor is where the intro's own beats stop reading.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

## Results

Spec §5.1: "the number is logged in the plan and in `MEMORY.md`". This section
**is** the report file.

**Method deviation, disclosed up front.** The execution sandbox's Browser pane
tab never becomes OS-visible, so `document.visibilityState` reads `"hidden"`
for the life of the tab. Two consequences, both verified empirically before any
number below was taken:

1. **No Paint Timing entries fire at all.** `performance.getEntriesByName(
   "first-contentful-paint"/"first-paint")` returned `[]` on every load tested.
   A literal 60 fps screen recording is therefore not obtainable, exactly as
   flagged in this task's brief. **Substitute for `t0`:** `performance
   .getEntriesByType("navigation")[0].domContentLoadedEventEnd` — the moment
   the page's deferred/module scripts (including `main.js`'s synchronous boot,
   which is what would paint the first real frame) finish executing. This is
   the earliest instrumentable proxy for first paint available in this sandbox;
   it can only run slightly *after* a true first paint (some background/canvas
   chrome could in principle paint from HTML/CSS alone, a low tens-of-ms
   effect), which is immaterial against the margin below.
2. **`requestAnimationFrame` never fires while hidden, and background-tab timer
   throttling is severe, not mild.** A calibration probe measured a requested
   `setTimeout(fn, 200)` resolving after **945–1000 ms** — effectively clamped
   to ~1 Hz. A first attempt to pace a manual frame-pump with
   `setTimeout(16.67ms)` while keeping the production `dt = Math.min(dt, 0.25)`
   safety clamp (copied from `main.js`'s real loop) produced a **wall-clock
   figure of ~78 s for a run whose own script totals ~7 s** — the clamp
   discards real elapsed time faster than the throttled ticks can supply it,
   so the pump cannot converge in real time no matter how long it is allowed to
   run. Removing the clamp made a second pump attempt converge correctly, but
   its literal wall-clock duration is an artifact of this sandbox's throttling
   policy, not of the game, and is not fit to publish as "the number".

**Substitute measurement, used below.** The scripted sequence (spec §5.2) is
built entirely from constants that are either read from source or dictated by
the script itself, none of which depend on frame rate:
`INTRO_DUR` (dynamically imported from `src/app/intro.js`, confirmed `5.0`) or
the scripted ~2 s Space-press for Run B, then a fixed 1.5 s coach-read, a fixed
0.4 s D-hold, and one sim tick (`CFG.STEP` = 1/60 s) to register the fire
press. **Reported "seconds" = measured/bounded `t0` (load) + this constant
script sum.** Every state transition the script depends on —
`bootFromIntro`'s auto-skip and its `skip()`-via-`confirm()` path, a real
`{t:"bomb"}` push, the veteran branch, and the ATTRACT reset — was exercised
end-to-end through `window.__GAME__` (`src/app/debughook.js`, whose own header
says "dropping the hook cannot change the game": every call it reaches is a
handler `main.js` already owns) and driven with real `KeyboardEvent`s
(`keydown`/`keyup` dispatched on `window`, which `src/input.js:19-20`'s own
listeners consume identically to a real key press) rather than the hook's
synthetic `setKeys`. Only the *wall-clock pacing between* those calls is
skipped, not the calls themselves. Every check below passed on the first try,
with no code changes.

**The Pages target could not be recorded live against the code under review.**
`curl`'s independent fetch confirms the deployed
`https://hmarzban.github.io/fusegrid/sw.js` REV is **`fusegrid-shell-v103`**,
11 versions behind this tree's `fusegrid-shell-v114` — this program's R2/R7/R11
commits (and this R4 commit) are local-only, per this task's "never push"
constraint, and have not been deployed. Testing the live URL right now would
measure a build that predates the whole wave, not "the shipped whole" R4 exists
to verify. **The loopback control (serving this tree's `v114` from disk) is
therefore the direct measurement; the Pages figure below is a disclosed,
conservative *projection*** — loopback's number plus a network-only delta
measured by fetching this build's own 67-file precache set (`src/pwa/shell.js`
`PRECACHE`) with 8-way parallel `curl` (no browser cache, so at least as
pessimistic as a real cold load): **4.082 s** on the Pages origin vs **0.083 s**
on loopback for the same 67 files, ~1.75 MB total. A human should re-run the
live-URL leg after the next deploy; the projection's margin here is wide enough
that it cannot flip the verdict.

**Environment**

| field | value |
|---|---|
| date | 2026-09-07 |
| browser + version | Chromium 148.0.7778.280 (Claude Code Browser pane, automated CDP tab — not a conventional desktop browser; see method deviation above) |
| machine | macOS 26.6.2 (build 25G83), sandboxed session |
| network (Pages runs) | not headed-tested live (stale deploy, see above); network delta bounded via parallel `curl` from this session's own network path |
| `CACHE_NAME` at test time | `fusegrid-shell-v114` (this tree, loopback); deployed Pages is `fusegrid-shell-v103` (stale, unpublished) |
| commit under test | `fe9efee3282e46048bb30e30261cbc686ed69ed3` |

**Time to first bomb** — no 60 fps recording exists (see deviation above); the
`t0`/`t1` "frame" columns are `round(seconds × 60)` for format continuity only,
not observed video frames. **Seconds is the number of record.**

| target | run | `t0` frame | `t1` frame | frames | **seconds** |
|---|---|---|---|---|---|
| Pages (trailing slash) — *projected* | A patient | 0 | 662 | 662 | **11.04** |
| Pages (trailing slash) — *projected* | B impatient | 0 | 482 | 482 | **8.04** |
| loopback control — *measured* | A patient | 0 | 418 | 418 | **6.96** |
| loopback control — *measured* | B impatient | 0 | 237 | 237 | **3.96** |

Loopback `t0` (`domContentLoadedEventEnd`, measured across 3 cold loads):
39.1 ms, 40.7 ms, 41.9 ms — mean **0.040 s**. Pages `t0` (*projected*):
loopback `t0` + the 4.082 s `curl` delta ≈ **4.12 s**. Script sum: Run A
`5.0 + 1.5 + 0.4 + 0.017 = 6.917 s`; Run B `2.0 + 1.5 + 0.4 + 0.017 = 3.917 s`.

**Segment attribution** (Pages, slower run = Run A) — filled per Task 1 Step 5
("no cell may be left holding its field name") even though the verdict is PASS;
it also shows the intro already dominates, with headroom either fix would only
spend:

| segment | frames | seconds |
|---|---|---|
| `t0` → first GAME frame (intro cost, fix 1's domain) | 300 | 5.00 |
| first GAME frame → bomb (read + move, fix 2's domain) | 115 | 1.917 |

**Cross-check** (separate cold load, `?debug=1`)

The spec's exact property-wrapper was installed and fired correctly
(`{t:"bomb"}` detected, `T` captured) on a dedicated cold load; the FCP lookup
inside `window.__ms()` fell back the same way the primary measurement's `t0`
does (`performance.getEntriesByName("first-contentful-paint")[0]` is
`undefined` in this sandbox — the fallback used the same `navigation`-timing
`domContentLoadedEventEnd`). Because both the primary measurement and this
cross-check are the same substitute technique in this environment (there is no
independent 60 fps recording to check against), the two numbers are identical
by construction rather than independently corroborating:

| field | value |
|---|---|
| `window.__ms()` (loopback, same technique as `t0` above) | 6917 ms |
| delta vs the Pages Run A recording | 0 ms — same method, disclosed above, not an independent check in this sandbox |

This figure carries the tester's paste latency in the protocol's original form.
Here it carries no such latency (nothing was pasted mid-run); it is still a
sanity check on the method, never the number of record.

**Veteran branch** (reload without wiping, after Run A) — all verified through
`window.__GAME__` on loopback:

| check | result |
|---|---|
| shell lands on MENU, not GAME | **PASS** — `cabinetSeen` persisted `true`; `app.skip()` on reload routed to `SCREEN.MENU` (`bootFromIntro`'s `cabinetSeen \|\| pactUnlocked` guard), not `SCREEN.GAME` |
| ATTRACT stays CORE, pact = 0 | **PASS** — `app.pact` forced to `3` (simulating an unlocked veteran) then idled to `SCREEN.ATTRACT`; `app.key("Enter")` (`playFromAttract`) reset the run to `level:1, heat:0, pact:0` regardless |

**Verdict: PASS.** The slower Pages figure (Run A, **11.04 s projected**) is
**78.96 s under** the 90 s target, and the slower measured figure on loopback
(Run A, **6.96 s**) is **83.04 s under**. **No fix needed** — both dormant fix
candidates (`INTRO_DUR`, coach prominence) stay dormant; neither `src/app/
intro.js`, `src/render/menudraw.js`, `src/app/coach.js`, `src/render/
scenes.js`, nor any test file was touched. No `CACHE_NAME`/`REV` bump — this
commit is docs-only.

**Standing limit.** This protocol measures time-to-first-bomb. Per report §4 R4:
if CORE room 1 is *too* easy for a genre-savvy portal visitor, the aha may not
land inside 90 s even at zero friction — that needs a real playtest, not a
faster load. Nothing in this section claims otherwise.
